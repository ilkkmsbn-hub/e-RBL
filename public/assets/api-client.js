(function (global) {
  'use strict';
  const actions = new Set([
    'loginPelatih', 'loginAdmin', 'logout', 'getAppBootstrap', 'getLiveSyncData',
    'submitPermohonan', 'cancelPermohonan', 'supportPermohonan', 'approvePermohonan',
    'bulkSupportPermohonan', 'bulkApprovePermohonan', 'markKeluar', 'markKembali',
    'bulkMarkKembali', 'pelatihRekodKeluar', 'pelatihKembaliKeKolej', 'getWarisLink',
    'getWarisConfirmation', 'submitWarisConfirmation', 'getReturnGeoStampForDetail',
    'getWarisSignatureForDetail', 'getSecurityPass', 'getReportPelatihList',
    'getPelatihReport', 'getKeluarMasukRangeReport'
  ]);

  async function call(action, args) {
    if (!actions.has(action)) throw new Error('Tindakan API tidak dibenarkan.');
    const config = global.ESO_CONFIG || {};
    const endpoint = new URL(config.apiUrl || './api', global.location.href);
    if (endpoint.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) {
      throw new Error('Alamat API mesti menggunakan HTTPS.');
    }
    const requestId = global.crypto.randomUUID();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs || 70000);
    try {
      const response = await fetch(endpoint.href, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
        body: JSON.stringify({ version: 1, requestId, action, args: args || [] })
      });
      const text = await response.text();
      let payload;
      try { payload = JSON.parse(text); }
      catch (error) { throw new Error('API tidak memulangkan JSON. Semak konfigurasi relay dan deployment Apps Script.'); }
      if (!response.ok || !payload.ok) {
        const error = new Error(payload.error && payload.error.message || 'Permintaan API tidak berjaya.');
        error.code = payload.error && payload.error.code || 'API_ERROR';
        throw error;
      }
      if (payload.requestId !== requestId) throw new Error('Respons API tidak sepadan dengan permintaan.');
      return payload.result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Sambungan mengambil masa terlalu lama. Permintaan mungkin telah diproses. Tekan REFRESH SEKARANG sebelum mencuba semula.');
      }
      if (error instanceof TypeError) throw new Error('Tidak dapat menghubungi API. Semak sambungan dan konfigurasi alamat API.');
      throw error;
    } finally { clearTimeout(timer); }
  }

  function runner(success, failure) {
    return new Proxy(Object.create(null), {
      get(target, name) {
        if (name === 'withSuccessHandler') return fn => runner(fn, failure);
        if (name === 'withFailureHandler') return fn => runner(success, fn);
        if (!actions.has(name)) return undefined;
        return (...args) => {
          call(name, args).then(result => {
            if (typeof success === 'function') success(result);
          }).catch(error => {
            if (typeof failure === 'function') failure(error);
            else console.error('e-SO API:', error.message);
          });
        };
      }
    });
  }
  global.EsoApi = Object.freeze({ call, get run() { return runner(); } });
})(window);
