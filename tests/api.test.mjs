import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHmac, randomUUID } from 'node:crypto';
import { handleApi, ACTIONS } from '../relay/handler.mjs';
const ROOT = new URL('../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, ROOT), 'utf8');
const SECRET = 'test-secret-only-0123456789abcdef0123456789abcdef';
const ORIGIN = 'https://host.example';
const ENV = { GAS_WEB_APP_URL: 'https://script.google.com/macros/s/DEPLOYMENT_TEST/exec', GAS_API_SECRET: SECRET };
const body = (action = 'getAppBootstrap', args = ['session']) => ({ version: 1, requestId: randomUUID(), action, args });
const req = (data = body(), origin = ORIGIN, method = 'POST') => new Request(ORIGIN + '/api', { method, headers: { 'Origin': origin, 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: JSON.stringify(data) } : {}) });
function backend() {
  const cache = new Map(), calls = [];let locked = false;
  const context = vm.createContext({ console, Date, Set,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => ({ GAS_API_SECRET: SECRET, FRONTEND_APP_URL: ORIGIN + '/app.html' })[key] }) },
    Utilities: { Charset: { UTF_8: 'UTF-8' }, computeHmacSha256Signature: (text, key) => Array.from(createHmac('sha256', key).update(text).digest(), n => n > 127 ? n - 256 : n) },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key, value) => cache.set(key, value) }) },
    LockService: { getScriptLock: () => ({ waitLock: () => { assert(!locked); locked = true; }, releaseLock: () => { locked = false; } }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) }
  });
  vm.runInContext(read('apps-script/code.gs'), context);
  for (const action of Object.keys(ACTIONS)) context[action] = (...args) => {
    calls.push({ action, args });
    if (action === 'loginAdmin' || action === 'loginPelatih') return { ok: true, token: 'session-token', appUrl: ENV.GAS_WEB_APP_URL };
    if (action === 'getWarisLink') return { ok: true, url: ENV.GAS_WEB_APP_URL + '?waris=guardian%2Btoken', noRujukan: 'RBL-TEST' };
    return { ok: true, action, args };
  };
  vm.runInContext(read('apps-script/api.gs'), context);
  return { context, calls, get locked() { return locked; }, post: envelope => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(envelope) } }).text) };
}
function sign(data, nonce = randomUUID(), timestamp = Math.floor(Date.now() / 1000)) {
  const payload = JSON.stringify(data);
  return { payload, nonce, timestamp, signature: createHmac('sha256', SECRET).update(`${timestamp}\n${nonce}\n${payload}`).digest('hex') };
}
const upstreamFor = gas => async (url, options) => new Response(JSON.stringify(gas.post(JSON.parse(options.body))), { status: 200 });

test('relay → signed Apps Script → original route, for every supported action', async t => {
  for (const [action, count] of Object.entries(ACTIONS)) await t.test(action, async () => {
    const gas = backend();const data = body(action, Array.from({ length: count }, (_, i) => 'arg-' + i));
    const response = await handleApi(req(data), ENV, upstreamFor(gas));const result = await response.json();
    assert.equal(response.status, 200);assert.equal(result.ok, true);assert.equal(result.requestId, data.requestId);
    assert.equal(gas.calls.length, 1);assert.equal(gas.calls[0].action, action);assert.deepEqual(Array.from(gas.calls[0].args), data.args);
    assert.equal(gas.locked, false);
  });
});
test('login and guardian links point to hosted frontend', async () => {
  const gas = backend();
  assert.equal(gas.post(sign(body('loginAdmin', [{}]))).result.appUrl, ORIGIN + '/app.html');
  assert.equal(gas.post(sign(body('getWarisLink', ['s', 'id']))).result.url, ORIGIN + '/app.html?waris=guardian%2Btoken');
});
test('Apps Script rejects tampered and expired envelopes before dispatch', () => {
  const gas = backend(), envelope = sign(body());envelope.signature = '0'.repeat(64);
  assert.equal(gas.post(envelope).ok, false);
  assert.equal(gas.post(sign(body(), randomUUID(), Math.floor(Date.now() / 1000) - 301)).ok, false);
  assert.equal(gas.calls.length, 0);
});
test('Apps Script rejects repeated envelopes and invalid actions', () => {
  const gas = backend(), envelope = sign(body());assert(gas.post(envelope).ok);assert.equal(gas.post(envelope).ok, false);
  for (const action of ['setupERBL', 'setInitialAdminPassword_TEST_ONLY', 'getAdminDashboard_', 'constructor', '__proto__']) assert.equal(gas.post(sign(body(action, []))).ok, false);
  assert.equal(gas.calls.length, 1);assert.equal(gas.locked, false);
});
test('protected function session errors are returned without converting them to success', () => {
  const gas = backend();gas.context.cancelPermohonan = () => { throw Error('Sesi telah tamat. Sila log masuk semula.'); };
  const result = gas.post(sign(body('cancelPermohonan', ['invalid-session', 'id'])));
  assert.equal(result.ok, false);assert.match(result.error.message, /Sesi telah tamat/);
});
test('cross-origin relay accepts only configured frontend and answers preflight', async () => {
  const denied = await handleApi(req(body(), 'https://evil.example'), ENV);assert.equal(denied.status, 403);assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
  const allowedEnv = { ...ENV, ALLOWED_ORIGINS: 'https://someone.github.io' };
  const request = new Request('https://worker.example/api', { method: 'OPTIONS', headers: { Origin: 'https://someone.github.io' } });
  const allowed = await handleApi(request, allowedEnv);assert.equal(allowed.status, 204);assert.equal(allowed.headers.get('Access-Control-Allow-Origin'), 'https://someone.github.io');
});
test('relay validates method, JSON, action, arity and body limit', async () => {
  assert.equal((await handleApi(req(body(), ORIGIN, 'GET'), ENV)).status, 405);
  assert.equal((await handleApi(req({ ...body(), action: 'setupERBL' }), ENV)).status, 400);
  assert.equal((await handleApi(req({ ...body(), action: { toString: null } }), ENV)).status, 400);
  assert.equal((await handleApi(req(body('cancelPermohonan', ['s'])), ENV)).status, 400);
  const invalid = new Request(ORIGIN + '/api', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{invalid' });
  assert.equal((await handleApi(invalid, ENV)).status, 400);
  assert.equal((await handleApi(req({ ...body(), extra: 'x'.repeat(140000) }), ENV)).status, 413);
});
test('relay rejects missing configuration and arbitrary upstream domains', async () => {
  assert.equal((await handleApi(req(), {})).status, 503);
  assert.equal((await handleApi(req(), { ...ENV, GAS_WEB_APP_URL: 'https://evil.example/exec' })).status, 503);
  assert.equal((await handleApi(req(), { ...ENV, GAS_API_SECRET: '' })).status, 503);
});
test('upstream errors are understandable and mutations are never automatically retried', async () => {
  let calls = 0;const upstream = async () => { calls++;throw new Error('network'); };
  const result = await handleApi(req(body('cancelPermohonan', ['s', 'id'])), ENV, upstream);
  assert.equal(result.status, 504);assert.equal(calls, 1);assert.match((await result.json()).error.message, /mungkin telah diproses/);
  assert.equal((await handleApi(req(), ENV, async () => new Response('<html>Login required</html>'))).status, 502);
});
test('mismatched successful upstream response is rejected', async () => {
  const response = await handleApi(req(), ENV, async () => new Response(JSON.stringify({ ok: true, requestId: randomUUID(), result: {} })));
  assert.equal(response.status, 502);
});
test('API client maps success, application errors and immutable callback runners', async () => {
  let sent;const window = { location: { href: ORIGIN + '/app.html' }, crypto: globalThis.crypto, ESO_CONFIG: { apiUrl: './api' } };
  const context = vm.createContext({ window, URL, AbortController, setTimeout, clearTimeout, console, fetch: async (url, options) => {
    sent = JSON.parse(options.body);assert.equal(url, ORIGIN + '/api');assert.equal(options.credentials, 'omit');
    return new Response(JSON.stringify({ ok: true, requestId: sent.requestId, result: { action: sent.action } }));
  } });
  vm.runInContext(read('public/assets/api-client.js'), context);
  assert.equal((await window.EsoApi.call('getAppBootstrap', ['s'])).action, 'getAppBootstrap');
  await new Promise((resolve, reject) => window.EsoApi.run.withSuccessHandler(result => { assert.equal(result.action, 'logout');resolve(); }).withFailureHandler(reject).logout('s'));
  await assert.rejects(window.EsoApi.call('setupERBL', []), /tidak dibenarkan/);
  context.fetch = async () => new Response(JSON.stringify({ ok: false, requestId: sent.requestId, error: { message: 'Tidak dibenarkan' } }));
  await assert.rejects(window.EsoApi.call('cancelPermohonan', ['s', 'id']), /Tidak dibenarkan/);
});
test('hosted pages parse with no Apps Script templates/RPC, and preserve features', () => {
  for (const file of ['public/index.html', 'public/app.html']) {
    const html = read(file);assert(!html.includes('<?'));assert(!html.includes('google.script.run'));
    for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
    assert(html.includes('./assets/api-client.js'));
  }
  assert(read('public/app.html').includes('Senarai Permohonan Aktif — Pembatalan'));
  assert(read('public/app.html').includes('Pengajar Penyelaras / Pegawai Bertugas / Admin'));
  assert(!read('public/index.html').includes("url += '&st='"));
  assert(!read('public/assets/config.js').includes(SECRET));
});
