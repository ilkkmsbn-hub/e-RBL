// Ujian integrasi pelayar dengan perkhidmatan Apps Script simulasi; tiada data sebenar diubah.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHmac, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { handleApi, ACTIONS } from '../relay/handler.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../', import.meta.url));
const SECRET = 'local-browser-test-only-0123456789abcdef';
const cache = new Map(), calls = [];
let locked = false, origin, active = false;
const record = { idPermohonan: 'PMH-TEST', noRujukan: 'RBL-TEST', nama: 'PELATIH UJIAN', noMatrik: '0002', status: 'MENUNGGU_SOKONGAN', canCancel: true, tahunPengajian: 'TAHUN 1', semester: 'SEMESTER II', tarikhKeluar: '13/11/2026', masaKeluar: '17:00', tarikhKembali: '15/11/2026', masaKembali: '22:00', tujuan: 'BALIK_KAMPUNG', program: 'DIPLOMA' };
const traineeData = () => ({ currentStatus: active ? 'MENUNGGU_SEMAKAN' : 'DALAM_HOSTEL', activeApplication: active ? record : null, applications: active ? [record] : [] });
const adminData = () => ({ counts: { pendingSupport: active ? 1 : 0 }, pendingSupport: active ? [record] : [], pendingApproval: [], approved: [], pendingReturn: [], geoWarnings: [], late: [], outside: [], activeForCancellation: active ? [record] : [], all: active ? [record] : [] });
const ctx = vm.createContext({ console, Date, Set,
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => ({ GAS_API_SECRET: SECRET, FRONTEND_APP_URL: 'https://configured.example/app.html' })[k] }) },
  Utilities: { Charset: { UTF_8: 'UTF-8' }, computeHmacSha256Signature: (text, key) => Array.from(createHmac('sha256', key).update(text).digest()) },
  CacheService: { getScriptCache: () => ({ get: k => cache.get(k), put: (k, v) => cache.set(k, v) }) },
  LockService: { getScriptLock: () => ({ waitLock: () => { assert(!locked);locked = true; }, releaseLock: () => locked = false }) },
  ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) }
});
vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/code.gs'), 'utf8'), ctx);
for (const action of Object.keys(ACTIONS)) ctx[action] = (...args) => {
  calls.push({ action, args });
  if (action === 'loginAdmin' || action === 'loginPelatih') return { ok: true, token: action === 'loginAdmin' ? 'admin-token' : 'trainee-token', role: action === 'loginAdmin' ? 'ADMIN' : 'PELATIH', nama: 'PENGGUNA UJIAN', appUrl: 'ignored' };
  if (action === 'getAppBootstrap') {
    if (!['admin-token', 'trainee-token'].includes(args[0])) throw Error('Sesi telah tamat. Sila log masuk semula.');
    const admin = args[0] === 'admin-token';
    return { ok: true, role: admin ? 'ADMIN' : 'PELATIH', user: { nama: 'PENGGUNA UJIAN', noMatrik: '0002', peranan: 'SUPER_ADMIN', tahunPengajian: 'TAHUN 1', semester: 'SEMESTER II', program: 'DIPLOMA' }, settings: { tujuan: [{ kod: 'BALIK_KAMPUNG', label: 'Balik ke rumah keluarga' }], pengangkutan: [{ kod: 'KERETA', label: 'Kereta' }] }, data: admin ? adminData() : traineeData() };
  }
  if (action === 'submitPermohonan') { active = true;return { ok: true, noRujukan: 'RBL-TEST', message: 'Permohonan berjaya dihantar.', data: traineeData() }; }
  if (action === 'cancelPermohonan') { assert.equal(args[0], 'admin-token');active = false;return { ok: true, message: 'Permohonan dibatalkan.', data: adminData() }; }
  if (action === 'getLiveSyncData') return { ok: true, data: args[0] === 'admin-token' ? adminData() : traineeData() };
  if (action === 'getWarisConfirmation') return { ok: true, alreadyConfirmed: true, namaPelatih: 'PELATIH UJIAN', noRujukan: 'RBL-TEST', confirmedAt: '10/11/2026' };
  if (action === 'logout') return { ok: true };
  return { ok: true };
};
vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/api.gs'), 'utf8'), ctx);
const server = http.createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, origin);
    if (url.pathname === '/api') {
      const request = new Request(url, { method: incoming.method, headers: incoming.headers, ...(incoming.method === 'POST' ? { body: incoming, duplex: 'half' } : {}) });
      const response = await handleApi(request, { GAS_WEB_APP_URL: 'https://script.google.com/macros/s/LOCAL_TEST/exec', GAS_API_SECRET: SECRET }, async (url, options) => new Response(ctx.doPost({ postData: { contents: options.body } }).text));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const file = path.join(root, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
    const data = fs.readFileSync(file);
    outgoing.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html' : 'application/javascript', 'Cache-Control': 'no-store' });outgoing.end(data);
  } catch (error) { outgoing.writeHead(500);outgoing.end(error.message); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
origin = 'http://127.0.0.1:' + server.address().port;
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/index.html');
  await page.locator('[data-tab="pelatih"]').click();
  await page.locator('#semesterSheet').selectOption({ index: 1 });
  await page.locator('#noMatrik').fill('0002');await page.locator('#noIc').fill('000000000002');await page.locator('#pelatihSubmit').click();
  await page.waitForURL('**/app.html');await page.locator('#view-dashboard .cancellation-reminder').waitFor();
  assert(!page.url().includes('st='));assert.equal(await page.evaluate(() => sessionStorage.getItem('erblSession')), 'trainee-token');
  await page.locator('#desktopNav [data-view="form"]').click();
  await page.locator('#tarikhKeluar').fill('2099-11-13');await page.locator('#masaKeluar').fill('17:00');await page.locator('#tarikhKembali').fill('2099-11-15');await page.locator('#masaKembali').fill('22:00');
  await page.locator('#tujuan').selectOption('BALIK_KAMPUNG');await page.locator('#pengangkutan').selectOption('KERETA');
  await page.locator('#alamatBermalam').fill('Alamat ujian');await page.locator('#namaWaris').fill('Waris ujian');await page.locator('#hubunganWaris').fill('Ibu');await page.locator('#telWaris').fill('0123456789');await page.locator('#pengakuanPelatih').check();await page.locator('#submitRequestBtn').click();
  await page.locator('#view-dashboard .record .ref').waitFor();assert.equal(await page.locator('#view-dashboard .record .ref').innerText(), 'RBL-TEST');
  await page.locator('#desktopNav [data-view="form"]').click();assert.equal(await page.locator('#requestForm').count(), 0);assert((await page.locator('#view-form').innerText()).includes('Permohonan aktif masih wujud'));
  await page.goto(origin + '/index.html');await page.locator('#adminUser').fill('admin@example.test');await page.locator('#adminPassword').fill('test-password');await page.locator('#adminSubmit').click();
  await page.waitForURL('**/app.html');await page.locator('#activeCancellationPanel tbody tr').waitFor();assert.equal(await page.locator('#activeCancellationPanel tbody tr').count(), 1);
  page.on('dialog', dialog => dialog.accept());await page.locator('#activeCancellationPanel button').click();await page.waitForFunction(() => !document.querySelector('#activeCancellationPanel tbody tr'));
  assert(calls.some(c => c.action === 'cancelPermohonan' && c.args[1] === 'PMH-TEST'));
  // Logout returns to hosted login and clears browser storage.
  await page.locator('#desktopLogoutBtn').count().then(async n => { if (n) await page.locator('#desktopLogoutBtn').click(); else await page.evaluate(() => logoutApp()); });
  await page.waitForURL('**/index.html?reset=1*');assert.equal(await page.evaluate(() => sessionStorage.getItem('erblSession')), null);
  await page.goto(origin + '/app.html?waris=guardian-test');await page.getByText('Pengesahan Telah Lengkap', { exact: true }).waitFor();assert(calls.some(c => c.action === 'getWarisConfirmation' && c.args[0] === 'guardian-test'));
  await page.setViewportSize({ width: 390, height: 844 });assert.equal(await page.locator('#warisRoot').isVisible(), true);
  // An expired hosted session is redirected back to hosted login.
  await page.evaluate(() => sessionStorage.setItem('erblSession', 'expired-token'));await page.goto(origin + '/app.html');await page.waitForURL('**/index.html?reset=1&expired=1*');
  assert.deepEqual(errors, []);
  console.log('Browser integration passed: real fetch → relay → signed Apps Script dispatcher; trainee/admin login, submit, active status, cancellation, logout, guardian and expired session.');
} finally { if (browser) await browser.close();await new Promise(resolve => server.close(resolve)); }
