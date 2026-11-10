// Relay pengangkutan sahaja. Semua login, kebenaran dan logik aplikasi kekal dalam Apps Script.
export const ACTIONS = Object.freeze({
  loginPelatih: 1, loginAdmin: 1, logout: 1, getAppBootstrap: 1, getLiveSyncData: 1,
  submitPermohonan: 2, cancelPermohonan: 2, supportPermohonan: 4, approvePermohonan: 4,
  bulkSupportPermohonan: 3, bulkApprovePermohonan: 3, markKeluar: 2, markKembali: 2,
  bulkMarkKembali: 3, pelatihRekodKeluar: 2, pelatihKembaliKeKolej: 3, getWarisLink: 2,
  getWarisConfirmation: 1, submitWarisConfirmation: 1, getReturnGeoStampForDetail: 2,
  getWarisSignatureForDetail: 2, getSecurityPass: 2, getReportPelatihList: 2,
  getPelatihReport: 2, getKeluarMasukRangeReport: 2
});
const MAX_BYTES = 128 * 1024;

async function readBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BYTES) throw new Error('BODY_TOO_LARGE');
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); }
    chunks.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(joined);
}

export async function handleApi(request, env, upstreamFetch = fetch) {
  const origin = request.headers.get('Origin');
  const configured = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowed = configured.length ? configured : [new URL(request.url).origin];
  const originAllowed = !!origin && allowed.includes(origin);
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
  if (originAllowed) headers['Access-Control-Allow-Origin'] = origin;
  let requestId = null;
  const failure = (status, code, message) => new Response(JSON.stringify({ ok: false, requestId, error: { code, message } }), { status, headers });
  if (!originAllowed) return failure(403, 'ORIGIN_DENIED', 'Domain frontend tidak dibenarkan. Semak ALLOWED_ORIGINS pada relay.');
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Accept', 'Access-Control-Max-Age': '600' } });
  }
  if (request.method !== 'POST') return failure(405, 'METHOD_NOT_ALLOWED', 'Gunakan POST untuk API.');
  if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) {
    return failure(415, 'UNSUPPORTED_MEDIA_TYPE', 'API memerlukan Content-Type application/json.');
  }
  let body;
  try { body = JSON.parse(await readBody(request)); }
  catch (error) { return error.message === 'BODY_TOO_LARGE' ? failure(413, 'BODY_TOO_LARGE', 'Permintaan terlalu besar.') : failure(400, 'INVALID_JSON', 'Format JSON tidak sah.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return failure(400, 'INVALID_REQUEST', 'Permintaan API tidak sah.');
  if (typeof body.requestId === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(body.requestId)) requestId = body.requestId;
  if (body.version !== 1 || !requestId || typeof body.action !== 'string' || !Object.hasOwn(ACTIONS, body.action) || !Array.isArray(body.args) || body.args.length !== ACTIONS[body.action]) {
    return failure(400, 'INVALID_REQUEST', 'Tindakan atau parameter API tidak sah.');
  }
  let gasUrl;
  try { gasUrl = new URL(env.GAS_WEB_APP_URL); } catch (error) { return failure(503, 'NOT_CONFIGURED', 'Tetapkan GAS_WEB_APP_URL pada relay.'); }
  if (gasUrl.protocol !== 'https:' || gasUrl.hostname !== 'script.google.com' || !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(gasUrl.pathname) || gasUrl.search || gasUrl.hash) {
    return failure(503, 'NOT_CONFIGURED', 'GAS_WEB_APP_URL mesti URL deployment Apps Script yang berakhir dengan /exec.');
  }
  if (typeof env.GAS_API_SECRET !== 'string' || env.GAS_API_SECRET.length < 32) return failure(503, 'NOT_CONFIGURED', 'Tetapkan GAS_API_SECRET sekurang-kurangnya 32 aksara pada relay.');
  const payload = JSON.stringify({ version: 1, requestId, action: body.action, args: body.args });
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID();
  const signedText = `${timestamp}\n${nonce}\n${payload}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.GAS_API_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedText))), b => b.toString(16).padStart(2, '0')).join('');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await upstreamFetch(gasUrl.href, {
      method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ payload, timestamp, nonce, signature }), signal: controller.signal
    });
    if (!response.ok) return failure(502, 'UPSTREAM_HTTP', 'Apps Script tidak dapat dihubungi. Permintaan mungkin telah diproses; refresh status sebelum mencuba semula.');
    let result;
    try { result = JSON.parse(await response.text()); }
    catch (error) { return failure(502, 'UPSTREAM_NOT_JSON', 'Apps Script tidak memulangkan JSON. Semak doPost, versi deployment dan akses Anyone.'); }
    if (!result || typeof result.ok !== 'boolean' || (result.requestId !== requestId && result.requestId !== null)) return failure(502, 'UPSTREAM_INVALID', 'Respons Apps Script tidak sah.');
    // Jangan dedahkan hasil tidak sepadan atau sebarang respons HTML daripada Google.
    if (result.ok && result.requestId !== requestId) return failure(502, 'UPSTREAM_INVALID', 'Respons Apps Script tidak sepadan.');
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (error) {
    return failure(504, 'UPSTREAM_UNAVAILABLE', 'Sambungan Apps Script terputus atau tamat masa. Permintaan mungkin telah diproses; refresh status sebelum mencuba semula.');
  } finally { clearTimeout(timer); }
}
