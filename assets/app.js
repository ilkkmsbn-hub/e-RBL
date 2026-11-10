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
      if (action === 'getWarisLink' && payload.result && payload.result.url) {
        const link = new URL(payload.result.url);
        if (link.pathname.endsWith('/app.html')) link.pathname = link.pathname.slice(0, -8) + 'index.html';
        payload.result.url = link.href;
      }
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

(function () {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  const appMode = params.get('app') === '1' || params.has('waris');
  const rules = Array.from(document.getElementById('esoStyles').sheet.cssRules)
    .filter(rule => rule.type === CSSRule.MEDIA_RULE);
  rules[0].media.mediaText = appMode ? 'not all' : 'all';
  rules[1].media.mediaText = appMode ? 'all' : 'not all';
  document.body.innerHTML = appMode ? "\n  <div class=\"loading-screen\" id=\"loadingScreen\">\n    <div class=\"loader-card\">\n      <div class=\"loader-ring\"></div>\n      <strong>e-SO</strong>\n      <div style=\"margin-top:6px;color:#94a3b8;font-size:12px\">Memuatkan sistem...</div>\n    </div>\n  </div>\n\n  <div id=\"appRoot\" class=\"hidden\">\n    <div class=\"app-shell\">\n      <aside class=\"sidebar\">\n        <div class=\"sidebar-brand\">\n          <div class=\"mini-seal\">e-SO</div>\n          <div>\n            <strong>ILKKM (PP) Seremban</strong>\n            <span>Rekod Bermalam Luar Pelatih</span>\n          </div>\n        </div>\n        <div class=\"nav-title\">Menu</div>\n        <nav class=\"nav\" id=\"desktopNav\"></nav>\n        <div class=\"sidebar-user\">\n          <strong id=\"sidebarUserName\">-</strong>\n          <span id=\"sidebarUserRole\">-</span>\n          <button class=\"logout-btn\" type=\"button\" onclick=\"logoutApp()\">LOG KELUAR</button>\n        </div>\n      </aside>\n\n      <main class=\"main\">\n        <header class=\"topbar\">\n          <div class=\"page-title\">\n            <h1 id=\"viewTitle\">Dashboard</h1>\n            <p id=\"viewSubtitle\">Sistem Rekod Bermalam Luar Pelatih</p>\n          </div>\n          <div class=\"topbar-actions\">\n            <div class=\"date-chip\" id=\"todayChip\"></div>\n            <div class=\"live-sync-chip paused\" id=\"liveSyncChip\" title=\"Refresh manual tanpa auto sync\">\n              <span class=\"live-dot\"></span>\n              <span id=\"liveSyncText\">Sync Manual</span>\n            </div>\n            <button class=\"sync-refresh-btn\" id=\"manualSyncBtn\" type=\"button\">REFRESH SEKARANG</button>\n            <button class=\"sync-refresh-btn mobile-logout-btn\" id=\"mobileLogoutBtn\" type=\"button\">LOG KELUAR</button>\n          </div>\n        </header>\n\n        <section class=\"view active\" id=\"view-dashboard\"></section>\n        <section class=\"view\" id=\"view-form\"></section>\n        <section class=\"view\" id=\"view-records\"></section>\n        <section class=\"view\" id=\"view-outside\"></section>\n        <section class=\"view\" id=\"view-report\"></section>\n\n        <footer class=\"app-watermark\" aria-label=\"Created by: Mohd Norais Mohamed Rashid | Powered by: ILKKM SEREMBAN\">\n          Created by: <strong>Mohd Norais Mohamed Rashid</strong>  |  Powered by: <strong>ILKKM SEREMBAN</strong>\n        </footer>\n      </main>\n\n      <nav class=\"mobile-bar\" id=\"mobileNav\"></nav>\n    </div>\n  </div>\n\n  <div id=\"warisRoot\" class=\"hidden\">\n    <main class=\"waris-shell\">\n      <div class=\"waris-wrap\">\n        <header class=\"waris-brand\">\n          <div class=\"mini-seal\">e-SO</div>\n          <h1>ILKKM (PP) SEREMBAN</h1>\n          <p>Sistem Rekod Bermalam Luar Pelatih</p>\n        </header>\n        <section class=\"waris-card\">\n          <div class=\"waris-card-head\">\n            <h2>Pengesahan Keberadaan Pelatih</h2>\n            <p>Mohon waris / penjaga mengesahkan pelatih telah tiba di alamat bermalam.</p>\n          </div>\n          <div class=\"waris-body\" id=\"warisContent\"></div>\n        </section>\n\n        <div class=\"waris-watermark\" aria-label=\"Created by: Mohd Norais Mohamed Rashid  |  Powered by: ILKKM SEREMBAN\">\n          Created by: <strong>Mohd Norais Mohamed Rashid</strong>  |  Powered by: <strong>ILKKM SEREMBAN</strong>\n        </div>\n      </div>\n    </main>\n  </div>\n\n  <div class=\"modal hidden\" id=\"modal\">\n    <div class=\"modal-card\">\n      <div class=\"modal-head\">\n        <h3 id=\"modalTitle\">Butiran</h3>\n        <button class=\"modal-close\" type=\"button\" onclick=\"closeModal()\">×</button>\n      </div>\n      <div class=\"modal-body\" id=\"modalBody\"></div>\n    </div>\n  </div>\n\n  <div class=\"toast\" id=\"toast\"></div>\n\n" : "\n  <main class=\"page\">\n    <section class=\"shell\">\n      <header class=\"brand\">\n        <div class=\"seal\" aria-label=\"Logo e-SO\">\n          <div class=\"seal-inner\">e-SO<small>ILKKM Seremban</small></div>\n        </div>\n        <h1>ILKKM (PP) SEREMBAN</h1>\n        <p class=\"system\">Sistem Rekod Bermalam Luar Pelatih</p>\n        <div class=\"erbl\">● e-SO</div>\n      </header>\n\n      <section class=\"card\" aria-label=\"Log masuk e-SO\">\n        <div class=\"tabs\" role=\"tablist\">\n          <button class=\"tab active\" id=\"tabAdmin\" type=\"button\" data-tab=\"admin\">Admin / Penyelaras</button>\n          <button class=\"tab\" id=\"tabPelatih\" type=\"button\" data-tab=\"pelatih\">Pelatih</button>\n        </div>\n\n        <div class=\"login-head\">\n          <h2>Log In</h2>\n          <p id=\"accessText\">Akses Admin / Penyelaras</p>\n        </div>\n\n        <div class=\"post-login-box\" id=\"postLoginBox\" aria-live=\"polite\">\n          <strong id=\"postLoginTitle\">Login berjaya</strong>\n          <p id=\"postLoginMessage\">Sila tekan butang di bawah untuk membuka Dashboard e-SO.</p>\n          <a class=\"continue-link\" id=\"continueAppLink\" href=\"#\" target=\"_top\" rel=\"noopener\">TERUSKAN KE DASHBOARD e-SO</a>    \n        </div>\n\n        <form class=\"panel active\" id=\"adminPanel\" autocomplete=\"on\">\n          <div class=\"field\">\n            <label for=\"adminUser\">User ID / Email</label>\n            <input id=\"adminUser\" name=\"username\" type=\"text\" autocomplete=\"username\" placeholder=\"Contoh: admin\" required>\n          </div>\n\n          <div class=\"field\">\n            <label for=\"adminPassword\">Password</label>\n            <div class=\"input-wrap\">\n              <input id=\"adminPassword\" name=\"password\" type=\"password\" autocomplete=\"current-password\" placeholder=\"Password\" required>\n              <button class=\"password-toggle\" id=\"passwordToggle\" type=\"button\" aria-label=\"Papar atau sembunyikan password\">◉</button>\n            </div>\n          </div>\n\n          <button class=\"submit\" id=\"adminSubmit\" type=\"submit\">LOG MASUK</button>\n          <p class=\"helper\">Akses pentadbiran adalah berdasarkan peranan dalam sheet <strong>ADMIN</strong>.</p>\n        </form>\n\n        <form class=\"panel\" id=\"pelatihPanel\" autocomplete=\"off\">\n          <div class=\"field\">\n            <label for=\"semesterSheet\">Semester</label>\n            <div class=\"input-wrap\">\n              <select id=\"semesterSheet\" required>\n                <option value=\"\">Pilih semester</option>\n                <option>Tahun 1 Semester I</option>\n                <option>Tahun 1 Semester II</option>\n                <option>Tahun 2 Semester I</option>\n                <option>Tahun 2 Semester II</option>\n                <option>Tahun 3 Semester I</option>\n                <option>Tahun 3 Semester II</option>\n              </select>\n              <span class=\"select-arrow\">⌄</span>\n            </div>\n          </div>\n\n          <div class=\"field\">\n            <label for=\"noMatrik\">No. Matrik</label>\n            <input id=\"noMatrik\" type=\"text\" autocapitalize=\"characters\" placeholder=\"Contoh: DPMH 1/2026(17)-0001\" required>\n          </div>\n\n          <div class=\"field\">\n            <label for=\"noIc\">No. Kad Pengenalan</label>\n            <input id=\"noIc\" type=\"text\" inputmode=\"numeric\" maxlength=\"12\" placeholder=\"12 digit tanpa tanda -\" required>\n          </div>\n\n          <button class=\"submit\" id=\"pelatihSubmit\" type=\"submit\">LOG MASUK</button>\n          <p class=\"helper\">No. Kad Pengenalan digunakan untuk pengesahan login sahaja dan tidak disalin ke rekod permohonan.</p>\n        </form>\n      </section>\n\n      <div class=\"powered-by\" aria-label=\"Created by: Mohd Norais Mohamed Rashid  |  Powered by: ILKKM SEREMBAN\">\n        Created by: <strong>Mohd Norais Mohamed Rashid</strong>  |  Powered by: <strong>ILKKM SEREMBAN</strong>\n      </div>\n    </section>\n  </main>\n\n  <div class=\"toast\" id=\"toast\" role=\"status\" aria-live=\"polite\"></div>\n\n";
  if (appMode) {
    (function () {


    function readEsoSession_() {
      try {
        const token = sessionStorage.getItem('erblSession') || '';
        if (token) return { token, role: sessionStorage.getItem('erblRole') || '' };
      } catch (error) {}
      try {
        return { token: localStorage.getItem('erblSession') || '', role: localStorage.getItem('erblRole') || '' };
      } catch (error) { return { token: '', role: '' }; }
    }

    function clearEsoSession_() {
      try {
        sessionStorage.removeItem('erblSession');
        sessionStorage.removeItem('erblRole');
      } catch (error) {}

      try {
        localStorage.removeItem('erblSession');
        localStorage.removeItem('erblRole');
      } catch (error) {}
    }


    const APP_URL = new URL('./index.html', window.location.href).href;
    const INITIAL_MODE = new URLSearchParams(window.location.search).has('waris') ? 'WARIS' : 'APP';
    const WARIS_TOKEN = new URLSearchParams(window.location.search).get('waris') || '';

    const state = {
      sessionToken: readEsoSession_().token || '',
      role: '',
      user: null,
      settings: { tujuan: [], pengangkutan: [] },
      data: null,
      activeView: 'dashboard',
      reportList: [],
      reportData: null,
      movementReportData: null,
      adminFilter: { tahun: '', semester: '' },
      allRecordsFilter: { tahun: '', semester: '', status: '', query: '' },
      outsideFilter: { tahun: '', semester: '', status: '', query: '' },
      selectedOutsideRecordIds: new Set(),
      liveSync: {
        enabled: false,
        timerId: null,
        intervalMs: 30000,
        inFlight: false,
        lastSyncText: '',
        lastError: ''
      },
      location: { latitude: '', longitude: '', statusLokasi: 'TIDAK_DIMINTA' }
    };

    const viewMeta = {
      dashboard: ['Dashboard', 'Ringkasan dan status semasa e-SO'],
      form: ['Permohonan Baharu', 'Lengkapkan permohonan bermalam luar'],
      records: ['Rekod Permohonan', 'Semak sejarah dan status permohonan'],
      outside: ['Pemantauan Pelatih', 'Status pelatih di luar hostel'],
      report: ['Laporan Pelatih', 'Cetakan laporan individu rekod e-SO']
    };

    let toastTimer;
    let signature = null;

    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('todayChip').textContent = new Intl.DateTimeFormat('ms-MY', { dateStyle: 'full' }).format(new Date());
      if (INITIAL_MODE === 'WARIS') bootWaris();
      else bootApp();
    });

    function redirectLoginWithReset_() {
      clearEsoSession_();
      state.sessionToken = '';

      const base = APP_URL || window.location.href.split('?')[0];
      const separator = base.indexOf('?') === -1 ? '?' : '&';
      const target = base + separator + 'reset=1&expired=1&t=' + Date.now();

      try {
        window.open(target, '_top');
        return;
      } catch (error) {}

      try {
        window.top.location.href = target;
        return;
      } catch (error) {}

      window.location.href = target;
    }

    function bootApp() {
      if (!state.sessionToken) { redirectLogin(); return; }

      EsoApi.run
        .withSuccessHandler(result => {
          state.role = result.role;
          state.user = result.user;
          state.settings = result.settings || state.settings;
          state.data = result.data;
          document.getElementById('loadingScreen').classList.add('hidden');
          document.getElementById('appRoot').classList.remove('hidden');
          renderNavigation();
          renderApp();
          setupLiveSync();
        })
        .withFailureHandler(error => {
          clearEsoSession_();
          state.sessionToken = '';
          document.getElementById('loadingScreen').classList.add('hidden');
          showToast(readError(error), 'error');
          setTimeout(redirectLoginWithReset_, 900);
        })
        .getAppBootstrap(state.sessionToken);
    }

    function renderApp() {
      document.getElementById('sidebarUserName').textContent = state.user.nama || '-';
      document.getElementById('sidebarUserRole').textContent = state.role === 'PELATIH' ? `${state.user.tahunPengajian} • ${state.user.semester}` : state.user.peranan || 'ADMIN';
      renderDashboard();
      renderForm();
      renderRecords();
      renderOutside();
      renderReport();
      openView(state.activeView, false);
    }


    function setupLiveSync() {
      const chip = document.getElementById('liveSyncChip');
      const manualBtn = document.getElementById('manualSyncBtn');
      const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

      if (mobileLogoutBtn && !mobileLogoutBtn.dataset.bound) {
        mobileLogoutBtn.dataset.bound = '1';
        mobileLogoutBtn.addEventListener('click', () => {
          if (confirm('Log keluar daripada e-SO?')) {
            logoutApp();
          }
        });
      }

      if (!chip || !manualBtn) return;

      if (INITIAL_MODE === 'WARIS') {
        chip.classList.add('hidden');
        manualBtn.classList.add('hidden');
        return;
      }

      // V2.4.9: Auto sync berkala dimatikan.
      // Refresh hanya berlaku apabila pengguna menekan butang REFRESH SEKARANG.
      state.liveSync.enabled = true;
      state.liveSync.intervalMs = 0;

      manualBtn.addEventListener('click', () => {
        performLiveSync('manual');
      });

      updateLiveSyncChip('paused', 'Sync Manual');
    }


    function scheduleLiveSync() {
      // V2.4.9: Auto sync dimatikan untuk mengelakkan gangguan semasa pengguna mengisi data.
      // Fungsi ini dikekalkan supaya panggilan lama tidak menyebabkan ralat.
      stopLiveSyncTimer();
    }


    function stopLiveSyncTimer() {
      if (state.liveSync.timerId) {
        window.clearTimeout(state.liveSync.timerId);
        state.liveSync.timerId = null;
      }
    }


    function shouldSkipLiveSyncRender() {
      const modal = document.getElementById('modal');
      const modalOpen = modal && !modal.classList.contains('hidden');

      // Elakkan borang pelatih yang sedang diisi terpadam semasa auto sync.
      const pelatihFillingForm = state.role === 'PELATIH' && state.activeView === 'form';

      return modalOpen || pelatihFillingForm;
    }


    function performLiveSync(source = 'timer') {
      if (!state.liveSync.enabled || !state.sessionToken) return;
      if (document.hidden) {
        updateLiveSyncChip('paused', 'Live Sync: Pause');
        return;
      }
      if (state.liveSync.inFlight) return;

      if (shouldSkipLiveSyncRender() && source === 'timer') {
        scheduleLiveSync();
        return;
      }

      state.liveSync.inFlight = true;
      updateLiveSyncChip('syncing', 'Live Sync: Mengemas kini...');

      EsoApi.run
        .withSuccessHandler(result => {
          state.liveSync.inFlight = false;
          state.data = result.data || state.data;
          state.liveSync.lastError = '';
          state.liveSync.lastSyncText = formatClock(new Date());

          if (!shouldSkipLiveSyncRender()) {
            renderApp();
          }

          updateLiveSyncChip(
            'active',
            `Sync Manual · ${state.liveSync.lastSyncText}`
          );

          scheduleLiveSync();
        })
        .withFailureHandler(error => {
          state.liveSync.inFlight = false;
          state.liveSync.lastError = readError(error);
          updateLiveSyncChip('error', 'Live Sync: Ralat');
          scheduleLiveSync();
        })
        .getLiveSyncData(state.sessionToken);
    }


    function updateLiveSyncChip(status, text) {
      const chip = document.getElementById('liveSyncChip');
      const textTarget = document.getElementById('liveSyncText');
      if (!chip || !textTarget) return;

      chip.classList.remove('paused', 'error', 'syncing');
      if (status === 'paused') chip.classList.add('paused');
      if (status === 'error') chip.classList.add('error');
      if (status === 'syncing') chip.classList.add('syncing');

      textTarget.textContent = text || 'Live Sync';
    }


    function formatClock(date) {
      return new Intl.DateTimeFormat('ms-MY', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(date);
    }


    function renderNavigation() {
      const items = state.role === 'PELATIH'
        ? [
            { id: 'dashboard', icon: '⌂', label: 'Dashboard' },
            { id: 'form', icon: '＋', label: 'Permohonan Baharu' },
            { id: 'records', icon: '▤', label: 'Permohonan Saya' },
            { id: 'outside', icon: '↗', label: 'Status Semasa' },
            { id: 'report', icon: '⎙', label: 'Laporan Saya' }
          ]
        : [
            { id: 'dashboard', icon: '⌂', label: 'Dashboard' },
            { id: 'records', icon: '◷', label: 'Permohonan' },
            { id: 'outside', icon: '↗', label: 'Di Luar / Lewat' },
            { id: 'form', icon: '▦', label: 'Semua Rekod' },
            { id: 'report', icon: '⎙', label: 'Laporan Pelatih' }
          ];

      document.getElementById('desktopNav').innerHTML = items.map(item => `
        <button class="nav-btn ${item.id === state.activeView ? 'active' : ''}" data-view="${item.id}" type="button">
          <span class="nav-icon">${item.icon}</span><span>${escapeHtml(item.label)}</span>
        </button>`).join('');

      document.getElementById('mobileNav').innerHTML = items.map(item => `
        <button class="mobile-nav-btn ${item.id === state.activeView ? 'active' : ''}" data-view="${item.id}" type="button">
          <span>${item.icon}</span>${escapeHtml(item.label)}
        </button>`).join('');

      document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => openView(btn.dataset.view)));
    }

    function openView(viewId, scroll = true) {
      state.activeView = viewId;
      document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === `view-${viewId}`));
      const meta = viewMeta[viewId] || viewMeta.dashboard;
      document.getElementById('viewTitle').textContent = meta[0];
      document.getElementById('viewSubtitle').textContent = meta[1];
      document.querySelectorAll('[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewId));
      if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderDashboard() {
      const target = document.getElementById('view-dashboard');

      if (state.role === 'PELATIH') {
        const d = state.data;
        const active = d.activeApplication;
        target.innerHTML = `
          <section class="hero">
            <div class="hero-grid">
              <div><div class="eyebrow">Selamat Datang</div><h2>${escapeHtml(state.user.nama)}</h2><p>${escapeHtml(state.user.noMatrik)} · ${escapeHtml(state.user.program)}</p></div>
              ${statusOrbHtml(d.currentStatus)}
            </div>
          </section>
          <div class="grid-2">
            <section class="panel">
              <div class="panel-head"><div><h3>Permohonan Aktif</h3><p>Status permohonan bermalam luar semasa</p></div></div>
              <div class="panel-body">${cancellationReminderHtml()}${active ? recordCardHtml(active) : emptyHtml('✓', 'Tiada permohonan aktif', 'Anda berada dalam status Dalam Hostel.')}</div>
            </section>
            <section class="panel">
              <div class="panel-head"><div><h3>Profil Pelatih</h3><p>Maklumat diambil daripada sheet semester</p></div></div>
              <div class="panel-body"><div class="profile-grid">
                ${profileItem('No. Matrik', state.user.noMatrik)}
                ${profileItem('Program', state.user.program)}
                ${profileItem('Tahun Pengajian', state.user.tahunPengajian)}
                ${profileItem('Semester', state.user.semester)}
              </div></div>
            </section>
          </div>`;
        bindRecordActions(target);
        return;
      }

      const c = state.data.counts || {};
      const pendingSupport = adminFilteredRecords(state.data.pendingSupport || []);
      const pendingApproval = adminFilteredRecords(state.data.pendingApproval || []);
      const supportPanel = canBulkSupport()
        ? bulkRecordsHtml(pendingSupport, 'support')
        : recordsHtml(pendingSupport);
      const approvalPanel = canBulkApprove()
        ? bulkRecordsHtml(pendingApproval, 'approve')
        : recordsHtml(pendingApproval);
      target.innerHTML = `
        <section class="hero">
          <div class="hero-grid">
            <div><div class="eyebrow">${escapeHtml(state.user.peranan || 'ADMIN')}</div><h2>${escapeHtml(state.user.nama)}</h2><p>Pemantauan permohonan dan pergerakan pelatih hostel secara berpusat.</p></div>
            <div class="status-orb"><span class="status-dot" style="background:var(--sky);box-shadow:0 0 0 8px rgba(56,189,248,.12)"></span><strong>e-SO Aktif</strong><span>Dashboard Pentadbiran</span></div>
          </div>
        </section>
        ${adminFilterHtml()}
        <section class="kpi-grid">
          ${kpiHtml('Menunggu Sokongan', c.pendingSupport || 0, 'Tindakan Admin')}
          ${kpiHtml('Menunggu Kelulusan', c.pendingApproval || 0, 'Tindakan Super Admin')}
          ${kpiHtml('Diluluskan', c.approved || 0, 'Menunggu rekod keluar')}
          ${kpiHtml('Di Luar Kolej', c.outside || 0, 'Status semasa')}
          ${kpiHtml('Pengesahan Kembali', c.pendingReturn || 0, 'Perlu disahkan Admin')}
          ${kpiHtml('Amaran Lokasi', c.geoWarnings || 0, 'LUAR RADIUS 1000 METER', 'danger')}
          ${kpiHtml('Belum Disahkan Waris', c.waitingWaris || 0, 'Perlu pemantauan')}
          ${kpiHtml('Lewat Kembali', c.late || 0, 'Perlu tindakan')}
        </section>
        ${activeCancellationTableHtml()}
        <div class="grid-2">
          <section class="panel"><div class="panel-head"><div><h3>Menunggu Sokongan</h3><p>Admin Sokongan · ${pendingSupport.length} rekod selepas tapisan</p></div></div><div class="panel-body">${supportPanel}</div></section>
          <section class="panel"><div class="panel-head"><div><h3>Menunggu Kelulusan</h3><p>SUPER_ADMIN sahaja · ${pendingApproval.length} rekod selepas tapisan</p></div></div><div class="panel-body">${approvalPanel}</div></section>
        </div>
        <section class="panel" style="margin-top:18px"><div class="panel-head"><div><h3>Pengesahan Kembali Pelatih</h3><p>Pelatih telah menekan Kembali Ke Kolej dan menunggu pengesahan Admin</p></div></div><div class="panel-body">${recordsHtml(state.data.pendingReturn)}</div></section>
        </div>
        <section class="panel" style="margin-top:18px">
          <div class="panel-head">
            <div>
              <h3>⚠ Amaran Lokasi Kembali</h3>
              <p>Pelatih menghantar self check kembali dari luar radius 1000 meter kolej</p>
            </div>
          </div>
          <div class="panel-body">
            ${state.data.geoWarnings && state.data.geoWarnings.length
              ? `<div class="geo-warning-banner"><strong>AMARAN:</strong> Rekod di bawah masih boleh dihantar mengikut Option A, tetapi lokasi GPS berada di luar radius kolej. Sila semak BUTIRAN dan Google Maps sebelum mengesahkan kembali.</div>${recordsHtml(state.data.geoWarnings)}`
              : emptyHtml('✓', 'Tiada amaran lokasi', 'Tiada self check kembali dari luar radius 1000 meter.')}
          </div>
        </section>

        <section class="panel" style="margin-top:18px"><div class="panel-head"><div><h3>Lewat Kembali</h3><p>Pelatih melebihi jangka masa kembali</p></div></div><div class="panel-body">${recordsHtml(state.data.late)}</div></section>`;
      bindRecordActions(target);
      bindAdminFilterActions(target);
      bindBulkActions(target);
    }


    function canManageCancellation() {
      return state.role === 'ADMIN' &&
        ['PEGAWAI_BERTUGAS', 'SUPER_ADMIN'].includes(String(state.user && state.user.peranan || '').toUpperCase());
    }

    function cancellationReminderHtml() {
      return `<div class="cancellation-reminder" role="note"><strong>PERINGATAN PEMBATALAN PERMOHONAN</strong><br>
        Jika ingin membatalkan permohonan, sila maklumkan kepada <b>Pengajar Penyelaras / Pegawai Bertugas / Admin</b> melalui telefon, WhatsApp atau kaedah komunikasi lain di luar aplikasi.
        Pembatalan hanya boleh dibuat semasa anda <b>masih berada dalam kolej dan belum menekan butang Rekod Keluar</b>.
        Pegawai Bertugas / Admin akan membuat pembatalan selepas menerima makluman anda.</div>`;
    }

    function activeCancellationTableHtml() {
      if (!canManageCancellation()) return '';
      const records = adminFilteredRecords(state.data.activeForCancellation || []);
      return `<section class="panel" style="margin-bottom:18px" id="activeCancellationPanel">
        <div class="panel-head"><div><h3>Senarai Permohonan Aktif — Pembatalan</h3>
          <p>${records.length} permohonan selepas tapisan · Pelatih masih dalam kolej dan belum direkod keluar</p></div></div>
        <div class="panel-body">
          <p style="color:var(--muted);font-size:13px;margin:0 0 14px;line-height:1.6">Batalkan hanya selepas menerima makluman pelatih melalui komunikasi di luar aplikasi. Semak nama dan nombor rujukan sebelum mengesahkan.</p>
          ${records.length ? `<div class="cancellation-table-wrap"><table class="cancellation-table" aria-label="Permohonan aktif yang boleh dibatalkan">
            <thead><tr><th scope="col">Nama</th><th scope="col">No. Matrik</th><th scope="col">Status Permohonan</th><th scope="col">Pembatalan</th></tr></thead>
            <tbody>${records.map(record => `<tr>
              <td><strong>${escapeHtml(record.nama)}</strong><div class="ref">${escapeHtml(record.noRujukan)}</div></td>
              <td>${escapeHtml(record.noMatrik)}</td>
              <td><span class="status-badge s-${escapeAttr(record.status)}">${escapeHtml(statusLabel(record.status))}</span></td>
              <td><button class="btn btn-red" type="button" data-action="cancel" data-id="${escapeAttr(record.idPermohonan)}"${record.canCancel === true ? '' : ' disabled'}>BATALKAN PERMOHONAN</button></td>
            </tr>`).join('')}</tbody>
          </table></div>` : emptyHtml('✓', 'Tiada permohonan untuk pembatalan', 'Tiada permohonan aktif pelatih yang masih dalam kolej bagi tapisan ini.')}
        </div>
      </section>`;
    }


    function mergeOutsideMonitoringRecords_() {
      const map = new Map();
      [
        ...(state.data.pendingReturn || []),
        ...(state.data.late || []),
        ...(state.data.outside || [])
      ].forEach(record => {
        if (record && record.idPermohonan && !map.has(record.idPermohonan)) {
          map.set(record.idPermohonan, record);
        }
      });
      return Array.from(map.values());
    }


    function outsideFilterHtml(filteredCount, totalCount) {
      const f = state.outsideFilter || {};
      return `
        <section class="outside-filter-card">
          <div class="outside-filter-grid">
            <div class="field" style="margin:0">
              <label>Tapis Tahun Pengajian</label>
              <select data-outside-filter="tahun">
                <option value="">Semua Tahun</option>
                <option value="TAHUN 1" ${f.tahun === 'TAHUN 1' ? 'selected' : ''}>Tahun 1</option>
                <option value="TAHUN 2" ${f.tahun === 'TAHUN 2' ? 'selected' : ''}>Tahun 2</option>
                <option value="TAHUN 3" ${f.tahun === 'TAHUN 3' ? 'selected' : ''}>Tahun 3</option>
              </select>
            </div>
            <div class="field" style="margin:0">
              <label>Tapis Semester</label>
              <select data-outside-filter="semester">
                <option value="">Semua Semester</option>
                <option value="SEMESTER I" ${f.semester === 'SEMESTER I' ? 'selected' : ''}>Semester I</option>
                <option value="SEMESTER II" ${f.semester === 'SEMESTER II' ? 'selected' : ''}>Semester II</option>
              </select>
            </div>
            <div class="field" style="margin:0">
              <label>Tapis Status</label>
              <select data-outside-filter="status">
                <option value="">Semua Status</option>
                <option value="TUNGGU_PENGESAHAN_KEMBALI" ${f.status === 'TUNGGU_PENGESAHAN_KEMBALI' ? 'selected' : ''}>Pengesahan Kembali</option>
                <option value="DI_LUAR" ${f.status === 'DI_LUAR' ? 'selected' : ''}>Di Luar Kolej</option>
                <option value="TUNGGU_WARIS" ${f.status === 'TUNGGU_WARIS' ? 'selected' : ''}>Menunggu Waris</option>
                <option value="DISAHKAN_WARIS" ${f.status === 'DISAHKAN_WARIS' ? 'selected' : ''}>Disahkan Waris</option>
                <option value="LEWAT" ${f.status === 'LEWAT' ? 'selected' : ''}>Lewat</option>
              </select>
            </div>
            <div class="field" style="margin:0">
              <label>Carian Nama / No. Matrik / No. Rujukan</label>
              <input data-outside-filter="query" type="search" value="${escapeAttr(f.query || '')}" placeholder="Contoh: ROSMIYAH / DPMH / RBL">
            </div>
            <button class="btn" type="button" data-outside-filter-reset>RESET</button>
          </div>
          <div class="report-result-count">${Number(filteredCount) || 0} daripada ${Number(totalCount) || 0} rekod dipaparkan.</div>
        </section>`;
    }


    function filterOutsideRecords(records) {
      const f = state.outsideFilter || {};
      const tahun = cleanFilterText(f.tahun);
      const semester = cleanFilterText(f.semester);
      const status = cleanFilterText(f.status);
      const query = cleanFilterText(f.query);

      return (records || []).filter(record => {
        const recordTahun = cleanFilterText(record.tahunPengajian);
        const recordSemester = cleanFilterText(record.semester);
        const recordStatus = cleanFilterText(record.status);
        const haystack = cleanFilterText([
          record.nama,
          record.noMatrik,
          record.noRujukan,
          record.program,
          record.tujuan,
          record.alamatBermalam,
          record.namaWaris
        ].join(' '));

        return (!tahun || recordTahun === tahun)
          && (!semester || recordSemester === semester)
          && (!status || recordStatus === status)
          && (!query || haystack.includes(query));
      });
    }


    function bindOutsideFilterActions(scope = document) {
      scope.querySelectorAll('[data-outside-filter]').forEach(input => {
        const eventName = input.tagName === 'INPUT' ? 'input' : 'change';
        input.addEventListener(eventName, event => {
          const key = event.currentTarget.dataset.outsideFilter;
          state.outsideFilter[key] = event.currentTarget.value;
          renderApp();
        });
      });

      scope.querySelectorAll('[data-outside-filter-reset]').forEach(button => {
        button.addEventListener('click', () => {
          state.outsideFilter = { tahun: '', semester: '', status: '', query: '' };
          state.selectedOutsideRecordIds = new Set();
          renderApp();
        });
      });
    }


    function canBulkReturnRecord_(record) {
      return ['DI_LUAR', 'TUNGGU_WARIS', 'DISAHKAN_WARIS', 'LEWAT', 'TUNGGU_PENGESAHAN_KEMBALI'].includes(String(record && record.status || '').toUpperCase());
    }


    function outsideBulkToolbarHtml(records) {
      if (!records || !records.length) return '';
      const selectedCount = state.selectedOutsideRecordIds ? state.selectedOutsideRecordIds.size : 0;
      const eligibleCount = records.filter(canBulkReturnRecord_).length;
      return `
        <div class="bulk-toolbar">
          <span class="bulk-title">Sahkan Kembali Bulk</span>
          <span class="selected-count-pill">${selectedCount} dipilih</span>
          <span class="muted">${eligibleCount} rekod layak diproses dalam paparan ini</span>
          <button class="btn" type="button" data-outside-bulk-toggle>PILIH SEMUA PAPARAN</button>
          <button class="btn" type="button" data-outside-bulk-clear>KOSONGKAN PILIHAN</button>
          <button class="btn btn-green" type="button" data-outside-bulk-return>SAHKAN KEMBALI TERPILIH</button>
        </div>`;
    }


    function bindOutsideBulkActions(scope = document) {
      scope.querySelectorAll('input[data-bulk-check="outsideReturn"]').forEach(check => {
        check.addEventListener('change', event => {
          const id = event.currentTarget.value;
          if (!state.selectedOutsideRecordIds) state.selectedOutsideRecordIds = new Set();
          if (event.currentTarget.checked) state.selectedOutsideRecordIds.add(id);
          else state.selectedOutsideRecordIds.delete(id);
          renderApp();
        });
      });

      scope.querySelectorAll('[data-outside-bulk-toggle]').forEach(button => {
        button.addEventListener('click', () => {
          const records = filterOutsideRecords(mergeOutsideMonitoringRecords_()).filter(canBulkReturnRecord_);
          if (!state.selectedOutsideRecordIds) state.selectedOutsideRecordIds = new Set();
          records.forEach(record => state.selectedOutsideRecordIds.add(record.idPermohonan));
          renderApp();
        });
      });

      scope.querySelectorAll('[data-outside-bulk-clear]').forEach(button => {
        button.addEventListener('click', () => {
          state.selectedOutsideRecordIds = new Set();
          renderApp();
        });
      });

      scope.querySelectorAll('[data-outside-bulk-return]').forEach(button => {
        button.addEventListener('click', event => {
          const ids = Array.from(state.selectedOutsideRecordIds || []);
          if (!ids.length) {
            showToast('Sila pilih sekurang-kurangnya satu rekod.', 'error');
            return;
          }

          const selectedRecords = ids
            .map(id => findClientRecord(id))
            .filter(Boolean)
            .filter(canBulkReturnRecord_);

          if (!selectedRecords.length) {
            showToast('Tiada rekod terpilih yang layak disahkan kembali.', 'error');
            return;
          }

          if (!confirm(`Sahkan kembali ${selectedRecords.length} pelatih terpilih?\\n\\nTindakan ini akan menandakan rekod sebagai telah kembali dan selesai mengikut semakan backend.`)) {
            return;
          }

          const button = event.currentTarget;
          setButtonLoading(button, true, 'MEMPROSES...');

          EsoApi.run
            .withSuccessHandler(result => {
              setButtonLoading(button, false, 'SAHKAN KEMBALI TERPILIH');
              state.selectedOutsideRecordIds = new Set();

              if (result && result.failed && result.failed.length) {
                showToast(`${result.message} Sila semak semula rekod yang gagal.`, 'error');
              } else {
                showToast(`✓ ${result.message}`, 'success');
              }

              state.data = result.data || state.data;
              renderApp();
              updateLiveSyncChip('paused', `Sync Manual · ${formatClock(new Date())}`);
            })
            .withFailureHandler(error => {
              setButtonLoading(button, false, 'SAHKAN KEMBALI TERPILIH');
              showToast(readError(error), 'error');
            })
            .bulkMarkKembali(state.sessionToken, selectedRecords.map(record => record.idPermohonan), 'Sahkan kembali bulk melalui paparan Di Luar / Lewat.');
        });
      });
    }


    function allRecordsFilterHtml(filteredCount, totalCount) {
      const f = state.allRecordsFilter || {};
      return `
        <section class="all-records-filter-card">
          <div class="all-records-filter-grid">
            <div class="field" style="margin:0">
              <label>Tapis Tahun Pengajian</label>
              <select data-all-filter="tahun">
                <option value="">Semua Tahun</option>
                <option value="TAHUN 1" ${f.tahun === 'TAHUN 1' ? 'selected' : ''}>Tahun 1</option>
                <option value="TAHUN 2" ${f.tahun === 'TAHUN 2' ? 'selected' : ''}>Tahun 2</option>
                <option value="TAHUN 3" ${f.tahun === 'TAHUN 3' ? 'selected' : ''}>Tahun 3</option>
              </select>
            </div>
            <div class="field" style="margin:0">
              <label>Tapis Semester</label>
              <select data-all-filter="semester">
                <option value="">Semua Semester</option>
                <option value="SEMESTER I" ${f.semester === 'SEMESTER I' ? 'selected' : ''}>Semester I</option>
                <option value="SEMESTER II" ${f.semester === 'SEMESTER II' ? 'selected' : ''}>Semester II</option>
              </select>
            </div>
            <div class="field" style="margin:0">
              <label>Tapis Status</label>
              <select data-all-filter="status">
                <option value="">Semua Status</option>
                <option value="MENUNGGU_SOKONGAN" ${f.status === 'MENUNGGU_SOKONGAN' ? 'selected' : ''}>Menunggu Sokongan</option>
                <option value="DISOKONG" ${f.status === 'DISOKONG' ? 'selected' : ''}>Disokong</option>
                <option value="DILULUSKAN" ${f.status === 'DILULUSKAN' ? 'selected' : ''}>Diluluskan</option>
                <option value="DI_LUAR" ${f.status === 'DI_LUAR' ? 'selected' : ''}>Di Luar Kolej</option>
                <option value="TUNGGU_WARIS" ${f.status === 'TUNGGU_WARIS' ? 'selected' : ''}>Menunggu Waris</option>
                <option value="DISAHKAN_WARIS" ${f.status === 'DISAHKAN_WARIS' ? 'selected' : ''}>Disahkan Waris</option>
                <option value="TUNGGU_PENGESAHAN_KEMBALI" ${f.status === 'TUNGGU_PENGESAHAN_KEMBALI' ? 'selected' : ''}>Pengesahan Kembali</option>
                <option value="LEWAT" ${f.status === 'LEWAT' ? 'selected' : ''}>Lewat</option>
                <option value="SELESAI" ${f.status === 'SELESAI' ? 'selected' : ''}>Selesai</option>
                <option value="DITOLAK" ${f.status === 'DITOLAK' ? 'selected' : ''}>Ditolak</option>
                <option value="TIDAK_DISOKONG" ${f.status === 'TIDAK_DISOKONG' ? 'selected' : ''}>Tidak Disokong</option>
                <option value="DIBATALKAN" ${f.status === 'DIBATALKAN' ? 'selected' : ''}>Dibatalkan</option>
              </select>
            </div>
            <div class="field" style="margin:0">
              <label>Carian Nama / No. Matrik / No. Rujukan</label>
              <input data-all-filter="query" type="search" value="${escapeAttr(f.query || '')}" placeholder="Contoh: ROSMIYAH / DPMH / RBL">
            </div>
            <button class="btn" type="button" data-all-filter-reset>RESET</button>
          </div>
          <div class="report-result-count">${Number(filteredCount) || 0} daripada ${Number(totalCount) || 0} rekod dipaparkan.</div>
        </section>`;
    }


    function filterAllRecords(records) {
      const f = state.allRecordsFilter || {};
      const tahun = cleanFilterText(f.tahun);
      const semester = cleanFilterText(f.semester);
      const status = cleanFilterText(f.status);
      const query = cleanFilterText(f.query);

      return (records || []).filter(record => {
        const recordTahun = cleanFilterText(record.tahunPengajian);
        const recordSemester = cleanFilterText(record.semester);
        const recordStatus = cleanFilterText(record.status);
        const haystack = cleanFilterText([
          record.nama,
          record.noMatrik,
          record.noRujukan,
          record.program,
          record.tujuan,
          record.alamatBermalam,
          record.namaWaris
        ].join(' '));

        return (!tahun || recordTahun === tahun)
          && (!semester || recordSemester === semester)
          && (!status || recordStatus === status)
          && (!query || haystack.includes(query));
      });
    }


    function bindAllRecordsFilterActions(scope = document) {
      scope.querySelectorAll('[data-all-filter]').forEach(input => {
        const eventName = input.tagName === 'INPUT' ? 'input' : 'change';
        input.addEventListener(eventName, event => {
          const key = event.currentTarget.dataset.allFilter;
          state.allRecordsFilter[key] = event.currentTarget.value;
          renderApp();
        });
      });

      scope.querySelectorAll('[data-all-filter-reset]').forEach(button => {
        button.addEventListener('click', () => {
          state.allRecordsFilter = { tahun: '', semester: '', status: '', query: '' };
          renderApp();
        });
      });
    }



    function adminFilterHtml() {
      if (state.role === 'PELATIH') return '';
      const tahun = state.adminFilter.tahun || '';
      const semester = state.adminFilter.semester || '';
      return `
        <section class="admin-filter-card">
          <div class="filter-grid">
            <div class="field" style="margin:0">
              <label>Tapis Tahun Pengajian</label>
              <select data-admin-filter="tahun">
                <option value="">Semua Tahun</option>
                <option value="TAHUN 1" ${tahun === 'TAHUN 1' ? 'selected' : ''}>Tahun 1</option>
                <option value="TAHUN 2" ${tahun === 'TAHUN 2' ? 'selected' : ''}>Tahun 2</option>
                <option value="TAHUN 3" ${tahun === 'TAHUN 3' ? 'selected' : ''}>Tahun 3</option>
              </select>
            </div>
            <div class="field" style="margin:0">
              <label>Tapis Semester</label>
              <select data-admin-filter="semester">
                <option value="">Semua Semester</option>
                <option value="SEMESTER I" ${semester === 'SEMESTER I' ? 'selected' : ''}>Semester I</option>
                <option value="SEMESTER II" ${semester === 'SEMESTER II' ? 'selected' : ''}>Semester II</option>
              </select>
            </div>
            <button class="btn" type="button" data-admin-filter-reset>RESET TAPISAN</button>
          </div>
        </section>`;
    }

    function bindAdminFilterActions(scope = document) {
      scope.querySelectorAll('[data-admin-filter]').forEach(select => {
        select.addEventListener('change', event => {
          const key = event.currentTarget.dataset.adminFilter;
          state.adminFilter[key] = event.currentTarget.value;
          renderApp();
        });
      });
      scope.querySelectorAll('[data-admin-filter-reset]').forEach(button => {
        button.addEventListener('click', () => {
          state.adminFilter = { tahun: '', semester: '' };
          renderApp();
        });
      });
    }

    function adminFilteredRecords(records) {
      const tahun = cleanFilterText(state.adminFilter.tahun);
      const semester = cleanFilterText(state.adminFilter.semester);
      return (records || []).filter(record => {
        const recordTahun = cleanFilterText(record.tahunPengajian);
        const recordSemester = cleanFilterText(record.semester);
        return (!tahun || recordTahun === tahun) && (!semester || recordSemester === semester);
      });
    }

    function cleanFilterText(value) {
      return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
    }

    function canBulkSupport() {
      return ['PENYELIA_HOSTEL', 'PEGAWAI_BERTUGAS'].includes(String(state.user && state.user.peranan || '').toUpperCase());
    }

    function canBulkApprove() {
      return String(state.user && state.user.peranan || '').toUpperCase() === 'SUPER_ADMIN';
    }

    function bulkRecordsHtml(records, type) {
      if (!records || !records.length) return emptyHtml('▤', 'Tiada rekod', 'Tiada rekod selepas tapisan semasa.');
      const label = type === 'approve' ? 'Kelulusan Bulk' : 'Sokongan Bulk';
      const buttonLabel = type === 'approve' ? 'LULUSKAN TERPILIH' : 'SOKONG TERPILIH';
      const note = type === 'approve'
        ? 'Pilih permohonan yang telah disokong untuk diluluskan secara serentak.'
        : 'Pilih permohonan menunggu sokongan untuk disokong secara serentak.';
      return `
        <div class="bulk-toolbar">
          <span class="bulk-title">${label}</span>
          <span class="muted">${escapeHtml(note)}</span>
          <button class="btn" type="button" data-bulk-toggle="${escapeAttr(type)}">PILIH SEMUA</button>
          <button class="btn btn-green" type="button" data-bulk-action="${escapeAttr(type)}">${buttonLabel}</button>
        </div>
        <div class="record-list">${records.map(r => recordCardHtml(r, { selectable: true, bulkType: type })).join('')}</div>`;
    }

    function bindBulkActions(scope = document) {
      scope.querySelectorAll('[data-bulk-toggle]').forEach(button => {
        button.addEventListener('click', event => {
          const type = event.currentTarget.dataset.bulkToggle;
          const checks = Array.from(scope.querySelectorAll(`input[data-bulk-check="${type}"]`));
          const shouldCheck = checks.some(check => !check.checked);
          checks.forEach(check => { check.checked = shouldCheck; });
        });
      });
      scope.querySelectorAll('[data-bulk-action]').forEach(button => {
        button.addEventListener('click', event => {
          const type = event.currentTarget.dataset.bulkAction;
          const selected = Array.from(scope.querySelectorAll(`input[data-bulk-check="${type}"]:checked`)).map(check => check.value);
          if (!selected.length) { showToast('Sila tanda sekurang-kurangnya satu permohonan.', 'error'); return; }
          const isApprove = type === 'approve';
          const confirmText = isApprove ? `Luluskan ${selected.length} permohonan terpilih secara bulk?` : `Sokong ${selected.length} permohonan terpilih secara bulk?`;
          if (!confirm(confirmText)) return;
          const resetLabel = isApprove ? 'LULUSKAN TERPILIH' : 'SOKONG TERPILIH';
          setButtonLoading(event.currentTarget, true, 'MEMPROSES...');
          const runner = EsoApi.run
            .withSuccessHandler(result => updateFromServer(result, event.currentTarget, resetLabel))
            .withFailureHandler(error => actionError(error, event.currentTarget, resetLabel));
          if (isApprove) runner.bulkApprovePermohonan(state.sessionToken, selected, 'Kelulusan bulk melalui tapisan Tahun/Semester.');
          else runner.bulkSupportPermohonan(state.sessionToken, selected, 'Sokongan bulk melalui tapisan Tahun/Semester.');
        });
      });
    }

    function renderForm() {
      const target = document.getElementById('view-form');

      if (state.role === 'PELATIH') {
        const hasActive = !!state.data.activeApplication;
        target.innerHTML = `
          <section class="panel section-card">
            <div class="panel-head"><div><h3>Permohonan Bermalam Luar</h3><p>Maklumat profil akan direkod sebagai snapshot ketika permohonan dihantar.</p></div></div>
            <div class="panel-body">
              ${hasActive ? `<div class="empty"><div class="empty-icon">⚠</div><strong>Permohonan aktif masih wujud</strong><div style="margin-top:7px">Selesaikan permohonan semasa atau hubungi Pegawai Bertugas / Super Admin melalui komunikasi luar aplikasi untuk pembatalan sebelum merekod keluar.</div></div>` : `
                <form id="requestForm"><div class="form-grid">
                  <div class="field"><label>Tarikh Keluar</label><input id="tarikhKeluar" type="date" required></div>
                  <div class="field"><label>Masa Keluar</label><input id="masaKeluar" type="time" required></div>
                  <div class="field"><label>Tarikh Kembali</label><input id="tarikhKembali" type="date" required></div>
                  <div class="field"><label>Jangkaan Masa Kembali</label><input id="masaKembali" type="time" required></div>
                  <div class="field"><label>Tujuan Bermalam Luar</label><select id="tujuan" required><option value="">${state.settings.tujuan && state.settings.tujuan.length ? 'Pilih tujuan' : 'Pilihan tujuan tidak tersedia'}</option>${optionList(state.settings.tujuan)}</select></div>
                  <div class="field"><label>Pengangkutan</label><select id="pengangkutan" required><option value="">${state.settings.pengangkutan && state.settings.pengangkutan.length ? 'Pilih pengangkutan' : 'Pilihan pengangkutan tidak tersedia'}</option>${optionList(state.settings.pengangkutan)}</select></div>
                  <div class="field full hidden" id="catatanTujuanWrap"><label>Nyatakan Tujuan</label><textarea id="catatanTujuan" placeholder="Terangkan tujuan bermalam luar"></textarea></div>
                  <div class="field full"><label>Alamat Bermalam</label><textarea id="alamatBermalam" placeholder="Alamat penuh tempat pelatih akan bermalam" required></textarea></div>
                  <div class="field"><label>Nama Waris / Penjaga</label><input id="namaWaris" type="text" placeholder="Nama penuh waris" required></div>
                  <div class="field"><label>Hubungan Waris</label><input id="hubunganWaris" type="text" placeholder="Contoh: Bapa / Ibu / Penjaga" required></div>
                  <div class="field full"><label>No. Telefon Waris</label><input id="telWaris" type="tel" inputmode="tel" placeholder="Contoh: 0123456789" required></div>
                  <div class="field full"><div class="check-row"><input id="pengakuanPelatih" type="checkbox"><label for="pengakuanPelatih">Saya mengesahkan bahawa maklumat yang diberikan adalah benar dan saya bertanggungjawab mematuhi peraturan berkaitan bermalam di luar hostel.</label></div></div>
                </div><div class="submit-row"><button class="btn btn-primary" id="submitRequestBtn" type="submit">HANTAR PERMOHONAN</button></div></form>`}
            </div>
          </section>`;

        if (!hasActive) {
          const today = new Date().toISOString().slice(0, 10);
          document.getElementById('tarikhKeluar').min = today;
          document.getElementById('tarikhKembali').min = today;
          document.getElementById('tujuan').addEventListener('change', event => document.getElementById('catatanTujuanWrap').classList.toggle('hidden', event.target.value !== 'LAIN_LAIN'));
          document.getElementById('requestForm').addEventListener('submit', submitRequest);
        }
        return;
      }

      const filteredAll = filterAllRecords(state.data.all || []);
      target.innerHTML = `
        ${allRecordsFilterHtml(filteredAll.length, (state.data.all || []).length)}
        <section class="panel">
          <div class="panel-head">
            <div>
              <h3>Semua Rekod e-SO</h3>
              <p>${filteredAll.length} / ${(state.data.all || []).length} rekod dipaparkan selepas tapisan</p>
            </div>
          </div>
          <div class="panel-body">
            ${recordsHtml(filteredAll)}
          </div>
        </section>`;
      bindAllRecordsFilterActions(target);
      bindRecordActions(target);
    }

    function renderRecords() {
      const target = document.getElementById('view-records');
      if (state.role === 'PELATIH') {
        target.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Permohonan Saya</h3><p>Sejarah permohonan bermalam luar</p></div></div><div class="panel-body">${recordsHtml(state.data.applications)}</div></section>`;
      } else {
        const pendingSupport = adminFilteredRecords(state.data.pendingSupport || []);
        const pendingApproval = adminFilteredRecords(state.data.pendingApproval || []);
        const pendingReturn = adminFilteredRecords(state.data.pendingReturn || []);
        const approved = adminFilteredRecords(state.data.approved || []);
        target.innerHTML = `
        ${adminFilterHtml()}
        <div class="grid-2">
          <section class="panel"><div class="panel-head"><div><h3>Menunggu Sokongan</h3><p>Admin Sokongan · ${pendingSupport.length} rekod selepas tapisan</p></div></div><div class="panel-body">${canBulkSupport() ? bulkRecordsHtml(pendingSupport, 'support') : recordsHtml(pendingSupport)}</div></section>
          <section class="panel"><div class="panel-head"><div><h3>Menunggu Kelulusan</h3><p>Super Admin · ${pendingApproval.length} rekod selepas tapisan</p></div></div><div class="panel-body">${canBulkApprove() ? bulkRecordsHtml(pendingApproval, 'approve') : recordsHtml(pendingApproval)}</div></section>
        </div>
        <section class="panel" style="margin-top:18px"><div class="panel-head"><div><h3>Pengesahan Kembali Pelatih</h3><p>Menunggu pengesahan Admin</p></div></div><div class="panel-body">${recordsHtml(pendingReturn)}</div></section>
        <section class="panel" style="margin-top:18px"><div class="panel-head"><div><h3>Diluluskan</h3><p>Menunggu rekod keluar kolej</p></div></div><div class="panel-body">${recordsHtml(approved)}</div></section>`;
      }
      bindRecordActions(target);
      bindAdminFilterActions(target);
      bindBulkActions(target);
    }

    function renderOutside() {
      const target = document.getElementById('view-outside');
      if (state.role === 'PELATIH') {
        const active = state.data.activeApplication;
        target.innerHTML = `
          <section class="hero"><div class="hero-grid"><div><div class="eyebrow">Status Semasa Hostel</div><h2>${statusLabel(state.data.currentStatus)}</h2><p>${active ? `No. Rujukan ${escapeHtml(active.noRujukan)} · ${escapeHtml(active.tarikhKeluar)} hingga ${escapeHtml(active.tarikhKembali)}` : 'Tiada rekod bermalam luar yang sedang aktif.'}</p></div>${statusOrbHtml(state.data.currentStatus)}</div></section>
          <section class="panel"><div class="panel-head"><div><h3>Tindakan Berkaitan Waris</h3><p>Pautan pengesahan hanya tersedia selepas permohonan diluluskan</p></div></div><div class="panel-body">${active ? recordCardHtml(active) : emptyHtml('⌂', 'Anda berada dalam hostel', 'Tiada tindakan pengesahan waris diperlukan.')}</div></section>`;
      } else {
        const outsideRecords = mergeOutsideMonitoringRecords_();
        const filteredOutside = filterOutsideRecords(outsideRecords);
        target.innerHTML = `
        ${outsideFilterHtml(filteredOutside.length, outsideRecords.length)}
        <section class="panel">
          <div class="panel-head">
            <div>
              <h3>Di Luar / Lewat / Pengesahan Kembali</h3>
              <p>${filteredOutside.length} / ${outsideRecords.length} rekod dipaparkan selepas tapisan</p>
            </div>
          </div>
          <div class="panel-body">
            ${outsideBulkToolbarHtml(filteredOutside)}
            ${recordsHtml(filteredOutside, { selectable: true, bulkType: 'outsideReturn' })}
          </div>
        </section>`;
      }
      bindOutsideFilterActions(target);
      bindOutsideBulkActions(target);
      bindRecordActions(target);
    }


    function renderReport() {
      const target = document.getElementById('view-report');

      if (state.role === 'PELATIH') {
        target.innerHTML = `
          <section class="hero">
            <div class="hero-grid">
              <div>
                <div class="eyebrow">Laporan Individu e-SO</div>
                <h2>${escapeHtml(state.user.nama)}</h2>
                <p>${escapeHtml(state.user.noMatrik)} · Hanya laporan pelatih yang sedang log masuk boleh dicetak.</p>
              </div>
              <button class="btn btn-primary" id="printOwnReport" type="button" style="min-height:52px">CETAK LAPORAN SAYA</button>
            </div>
          </section>
          <section id="reportPreviewArea">
            ${state.reportData ? reportPreviewHtml(state.reportData) : `<section class="panel"><div class="panel-body">${emptyHtml('⎙','Laporan belum dijana','Tekan Cetak Laporan Saya untuk mendapatkan laporan individu e-SO.')}</div></section>`}
          </section>
        `;

        document.getElementById('printOwnReport').addEventListener('click', () => {
          requestAndPrintReport(state.user.noMatrik);
        });
        bindReportPreviewPrint(target);
        return;
      }

      target.innerHTML = `
        <section class="panel section-card">
          <div class="panel-head">
            <div>
              <h3>Laporan Keluar Masuk Pelatih</h3>
              <p>Cetak laporan harian, mingguan atau julat tarikh berdasarkan tempoh Tarikh Keluar hingga Tarikh Kembali.</p>
            </div>
          </div>
          <div class="panel-body">
            <div class="report-filter">
              <div class="field" style="margin:0">
                <label>Tarikh Mula</label>
                <input id="movementStartDate" type="date">
              </div>
              <div class="field" style="margin:0">
                <label>Tarikh Akhir</label>
                <input id="movementEndDate" type="date">
              </div>
              <div class="field" style="margin:0">
                <label>Jenis Laporan</label>
                <select id="movementReportType">
                  <option value="HARIAN">Harian</option>
                  <option value="MINGGUAN">Mingguan</option>
                  <option value="JULAT_TARIKH">Julat Tarikh</option>
                </select>
              </div>
              <button class="btn btn-primary" id="movementReportBtn" type="button" style="min-height:50px">JANA / CETAK</button>
            </div>
            <div class="report-result-count">Akses: Super Admin, Penyelaras, Penyelia Hostel dan Pegawai Bertugas. Janaan dibuat berdasarkan tempoh Tarikh Keluar hingga Tarikh Kembali. Julat maksimum 31 hari.</div>
          </div>
        </section>

        <section class="panel section-card">
          <div class="panel-head"><div><h3>Carian Pelatih Untuk Laporan Individu</h3><p>Pilih Tahun / Semester atau cari menggunakan Nama / No. Matrik.</p></div></div>
          <div class="panel-body">
            <div class="report-filter">
              <div class="field" style="margin:0">
                <label>Tahun / Semester</label>
                <select id="reportSourceFilter">
                  <option value="">SEMUA TAHUN / SEMESTER</option>
                  <option value="Tahun 1 Semester I">Tahun 1 Semester I</option>
                  <option value="Tahun 1 Semester II">Tahun 1 Semester II</option>
                  <option value="Tahun 2 Semester I">Tahun 2 Semester I</option>
                  <option value="Tahun 2 Semester II">Tahun 2 Semester II</option>
                  <option value="Tahun 3 Semester I">Tahun 3 Semester I</option>
                  <option value="Tahun 3 Semester II">Tahun 3 Semester II</option>
                </select>
              </div>
              <div class="field" style="margin:0">
                <label>Carian Nama / No. Matrik</label>
                <input id="reportSearchQuery" type="search" placeholder="Contoh: AHMAD atau DPMH-T1S1-D0001">
              </div>
              <button class="btn btn-primary" id="reportSearchBtn" type="button" style="min-height:50px">CARI PELATIH</button>
            </div>
            <div class="report-result-count" id="reportResultCount">Gunakan penapis atau carian untuk memaparkan senarai pelatih.</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>Senarai Pelatih</h3><p>Pilih seorang pelatih untuk menjana laporan individu.</p></div></div>
          <div class="panel-body" id="reportTraineeList">${emptyHtml('⌕','Belum ada carian','Pilih Tahun / Semester atau masukkan nama pelatih.')}</div>
        </section>
        <section id="reportPreviewArea" style="margin-top:18px">${state.reportData ? reportPreviewHtml(state.reportData) : ''}</section>
      `;

      document.getElementById('reportSearchBtn').addEventListener('click', searchReportTrainees);
      document.getElementById('reportSearchQuery').addEventListener('keydown', event => {
        if (event.key === 'Enter') searchReportTrainees();
      });

      setupMovementReportControls();

      bindReportListActions(target);
      bindReportPreviewPrint(target);
    }


    function setupMovementReportControls() {
      const start = document.getElementById('movementStartDate');
      const end = document.getElementById('movementEndDate');
      const type = document.getElementById('movementReportType');
      const btn = document.getElementById('movementReportBtn');

      if (!start || !end || !type || !btn) return;

      const today = new Date();
      const yyyyMmDd = date => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      start.value = start.value || yyyyMmDd(today);
      end.value = end.value || yyyyMmDd(today);

      type.addEventListener('change', () => {
        const selected = type.value;
        const base = start.value ? new Date(start.value + 'T00:00:00') : new Date();

        if (selected === 'HARIAN') {
          end.value = start.value;
        }

        if (selected === 'MINGGUAN') {
          const last = new Date(base);
          last.setDate(base.getDate() + 6);
          end.value = yyyyMmDd(last);
        }
      });

      start.addEventListener('change', () => {
        if (type.value === 'HARIAN') end.value = start.value;
        if (type.value === 'MINGGUAN') {
          const base = start.value ? new Date(start.value + 'T00:00:00') : new Date();
          const last = new Date(base);
          last.setDate(base.getDate() + 6);
          end.value = yyyyMmDd(last);
        }
      });

      btn.addEventListener('click', requestAndPrintMovementReport);
    }


    function requestAndPrintMovementReport() {
      const button = document.getElementById('movementReportBtn');
      const tarikhMula = valueOf('movementStartDate');
      const tarikhAkhir = valueOf('movementEndDate');
      const jenisLaporan = valueOf('movementReportType') || 'JULAT_TARIKH';

      if (!tarikhMula || !tarikhAkhir) {
        showToast('Sila pilih tarikh mula dan tarikh akhir.', 'error');
        return;
      }

      const printWindow = window.open('', '_blank');

      if (printWindow) {
        printWindow.document.write('<html><head><title>e-SO — Menjana Laporan Keluar Masuk</title></head><body style="font-family:Arial,sans-serif;padding:40px;color:#1f2937"><h2>e-SO</h2><p>Menjana laporan keluar masuk pelatih...</p></body></html>');
        printWindow.document.close();
      }

      setButtonLoading(button, true, 'MENJANA...');

      EsoApi.run
        .withSuccessHandler(result => {
          setButtonLoading(button, false, 'JANA / CETAK');
          state.movementReportData = result;

          const html = buildPrintableMovementReportHtml(result);

          if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
          } else {
            showToast('Browser menyekat paparan cetakan. Sila benarkan pop-up untuk e-SO.', 'error');
          }
        })
        .withFailureHandler(error => {
          setButtonLoading(button, false, 'JANA / CETAK');
          if (printWindow) printWindow.close();
          showToast(readError(error), 'error');
        })
        .getKeluarMasukRangeReport(state.sessionToken, {
          tarikhMula,
          tarikhAkhir,
          jenisLaporan
        });
    }


    function buildPrintableMovementReportHtml(report) {
      const rows = report.rows || [];
      const summary = report.summary || {};
      const title = report.jenisLaporan === 'HARIAN'
        ? 'LAPORAN HARIAN KELUAR MASUK PELATIH'
        : report.jenisLaporan === 'MINGGUAN'
          ? 'LAPORAN MINGGUAN KELUAR MASUK PELATIH'
          : 'LAPORAN KELUAR MASUK PELATIH';

      const rowHtml = rows.length ? rows.map((r, index) => `
        <tr>
          <td class="center">${index + 1}</td>
          <td>
            <strong>${escapeHtml(r.nama || '-')}</strong>
            <div class="muted">${escapeHtml(r.noMatrik || '-')}</div>
          </td>
          <td>
            ${escapeHtml(r.program || '-')}
            <div class="muted">${escapeHtml((r.tahunPengajian || '-') + ' · ' + (r.semester || '-'))}</div>
          </td>
          <td>
            ${escapeHtml(labelCode(r.tujuan) || r.tujuan || '-')}
            ${r.catatanTujuan ? `<div class="muted">${escapeHtml(r.catatanTujuan)}</div>` : ''}
          </td>
          <td>${escapeHtml(r.alamatBermalam || '-')}</td>
          <td>
            <strong>${escapeHtml(r.noRujukan || '-')}</strong>
            <div class="muted">Tempoh: ${escapeHtml(r.tarikhKeluarDirancang || '-')} → ${escapeHtml(r.tarikhKembaliDirancang || '-')}</div>
          </td>
          <td>
            <strong>${escapeHtml(r.tarikhKeluarSebenar || '-')}</strong>
            <div>${escapeHtml(r.masaKeluarSebenar || '-')}</div>
            <div class="tag keluar">KELUAR</div>
          </td>
          <td>
            <strong>${escapeHtml(r.tarikhMasukSebenar || '-')}</strong>
            <div>${escapeHtml(r.masaMasukSebenar || '-')}</div>
            <div class="tag masuk">MASUK</div>
          </td>
          <td>
            ${escapeHtml(statusLabel(r.statusPermohonan || r.statusRekod || '-'))}
            ${Number(r.minitLewat || 0) > 0 ? `<div class="danger">Lewat ${Number(r.minitLewat)} minit</div>` : ''}
            ${String(r.statusLokasiKembali || '').toUpperCase() === 'LUAR_RADIUS_KOLEJ' ? `<div class="danger">Luar radius${r.jarakKolejMeter ? ' · ' + escapeHtml(String(r.jarakKolejMeter)) + 'm' : ''}</div>` : ''}
          </td>
        </tr>`).join('') : '<tr><td colspan="9" class="center muted">Tiada rekod keluar/masuk dalam julat tarikh ini.</td></tr>';

      return `<!DOCTYPE html><html lang="ms"><head><meta charset="UTF-8">
<title>${escapeHtml(title)} — e-SO</title>
<style>
@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;color:#111827;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:8.7px}
.toolbar{display:flex;justify-content:flex-end;margin-bottom:10px}.print-btn{padding:9px 16px;border:0;border-radius:7px;color:#17305f;background:#f6c945;font-weight:700;cursor:pointer}
.header{display:grid;grid-template-columns:72px 1fr auto;gap:15px;align-items:center;padding-bottom:11px;border-bottom:3px solid #17305f}.logo{width:64px;height:64px;display:grid;place-items:center;border-radius:15px;color:#17305f;background:#f6c945;font-weight:900;font-size:16px}
.header h1{margin:0;font-size:19px;color:#17305f}.header h2{margin:4px 0 0;font-size:12px}.header p{margin:4px 0 0;color:#6b7280}.generated{text-align:right;color:#6b7280;line-height:1.5}
.meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin:11px 0}.box,.stat{border:1px solid #d1d5db;border-radius:6px;padding:7px}.label{color:#6b7280;font-size:7px;font-weight:700;text-transform:uppercase}.value{margin-top:4px;font-weight:700}
.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin-bottom:11px}.stat strong{display:block;margin-top:4px;color:#17305f;font-size:16px}
table{width:100%;border-collapse:collapse;table-layout:fixed}th{padding:6px 4px;color:#fff;background:#17305f;border:1px solid #17305f;font-size:7.5px;text-align:left}td{padding:5px 4px;border:1px solid #d1d5db;vertical-align:top;line-height:1.38;word-wrap:break-word}tr{break-inside:avoid}.center{text-align:center}.muted{color:#6b7280;font-size:7.5px;margin-top:2px}.danger{color:#b91c1c;font-weight:700;margin-top:3px}
.tag{display:inline-block;margin-top:3px;padding:2px 5px;border-radius:999px;font-size:6.5px;font-weight:800}.tag.keluar{color:#92400e;background:#fef3c7}.tag.masuk{color:#166534;background:#dcfce7}
.footer{margin-top:9px;padding-top:8px;border-top:1px solid #d1d5db;color:#6b7280;display:flex;justify-content:space-between;font-size:7.5px}
@media print{.toolbar{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="toolbar"><button class="print-btn" onclick="window.print()">CETAK / SIMPAN PDF</button></div>
<header class="header">
  <div class="logo">e-SO</div>
  <div><h1>ILKKM (PP) SEREMBAN</h1><h2>${escapeHtml(title)}</h2><p>Sistem Rekod Bermalam Luar Pelatih (e-SO)</p></div>
  <div class="generated">Dijana: <strong>${escapeHtml(report.generatedAt || '-')}</strong><br>Oleh: ${escapeHtml(report.generatedBy || '-')}<br>Peranan: ${escapeHtml(report.generatedRole || '-')}</div>
</header>
<section class="meta">
  <div class="box"><div class="label">Tarikh Mula</div><div class="value">${escapeHtml(report.tarikhMula || '-')}</div></div>
  <div class="box"><div class="label">Tarikh Akhir</div><div class="value">${escapeHtml(report.tarikhAkhir || '-')}</div></div>
  <div class="box"><div class="label">Jenis Laporan</div><div class="value">${escapeHtml(title)}</div></div>
</section>
<section class="stats">
  <div class="stat"><div class="label">Jumlah Rekod</div><strong>${Number(summary.jumlahRekod)||0}</strong></div>
  <div class="stat"><div class="label">Telah Keluar</div><strong>${Number(summary.jumlahKeluar)||0}</strong></div>
  <div class="stat"><div class="label">Telah Masuk</div><strong>${Number(summary.jumlahMasuk)||0}</strong></div>
  <div class="stat"><div class="label">Masih Diluar</div><strong>${Number(summary.belumMasuk)||0}</strong></div>
  <div class="stat"><div class="label">Lewat</div><strong>${Number(summary.lewat)||0}</strong></div>
  <div class="stat"><div class="label">Amaran Lokasi</div><strong>${Number(summary.amaranLokasi)||0}</strong></div>
</section>
<table>
<thead><tr>
<th style="width:3%">Bil</th>
<th style="width:14%">Nama / No. Matrik</th>
<th style="width:13%">Program / Semester</th>
<th style="width:11%">Tujuan</th>
<th style="width:18%">Alamat Destinasi</th>
<th style="width:9%">No. Rujukan</th>
<th style="width:9%">Keluar</th>
<th style="width:9%">Masuk</th>
<th style="width:14%">Catatan</th>
</tr></thead>
<tbody>${rowHtml}</tbody>
</table>
<footer class="footer"><span>Laporan dijana berdasarkan tempoh Tarikh Keluar hingga Tarikh Kembali dalam rekod e-SO.</span><span>Created by: <strong>Mohd Norais Mohamed Rashid</strong>  |  Powered by: <strong>ILKKM SEREMBAN</strong></span></footer>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},350)});<\/script>
</body></html>`;
    }


    function searchReportTrainees() {
      const button = document.getElementById('reportSearchBtn');
      setButtonLoading(button, true, 'MENCARI...');

      EsoApi.run
        .withSuccessHandler(result => {
          setButtonLoading(button, false, 'CARI PELATIH');
          state.reportList = result.list || [];
          renderReportTraineeList();
        })
        .withFailureHandler(error => {
          setButtonLoading(button, false, 'CARI PELATIH');
          showToast(readError(error), 'error');
        })
        .getReportPelatihList(state.sessionToken, {
          sourceSheet: valueOf('reportSourceFilter'),
          query: valueOf('reportSearchQuery')
        });
    }


    function renderReportTraineeList() {
      const target = document.getElementById('reportTraineeList');
      const counter = document.getElementById('reportResultCount');
      if (!target) return;

      const list = state.reportList || [];
      if (counter) counter.textContent = `${list.length} pelatih ditemui.`;

      if (!list.length) {
        target.innerHTML = emptyHtml('⌕','Pelatih tidak ditemui','Cuba semak pilihan Tahun / Semester atau carian nama.');
        return;
      }

      target.innerHTML = `<div class="trainee-list">${list.map(p => `
        <div class="trainee-row">
          <div><strong>${escapeHtml(p.nama)}</strong><span>${escapeHtml(p.noMatrik)} · ${escapeHtml(p.tahunPengajian)} · ${escapeHtml(p.semester)}</span></div>
          <button class="btn btn-primary" type="button" data-report-matrik="${escapeAttr(p.noMatrik)}">CETAK LAPORAN</button>
        </div>`).join('')}</div>`;

      bindReportListActions(target);
    }


    function bindReportListActions(scope = document) {
      scope.querySelectorAll('[data-report-matrik]').forEach(button => {
        button.addEventListener('click', event => {
          requestAndPrintReport(event.currentTarget.dataset.reportMatrik);
        });
      });
    }


    function requestAndPrintReport(noMatrik) {
      const printWindow = window.open('', '_blank');

      if (printWindow) {
        printWindow.document.write('<html><head><title>e-SO — Menjana Laporan</title></head><body style="font-family:Arial,sans-serif;padding:40px;color:#1f2937"><h2>e-SO</h2><p>Menjana laporan pelatih...</p></body></html>');
        printWindow.document.close();
      }

      EsoApi.run
        .withSuccessHandler(result => {
          state.reportData = result;

          const preview = document.getElementById('reportPreviewArea');
          if (preview) {
            preview.innerHTML = reportPreviewHtml(result);
            bindReportPreviewPrint(preview);
          }

          const html = buildPrintableReportHtml(result);
          if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
          } else {
            showToast('Browser menyekat paparan cetakan. Sila benarkan pop-up untuk e-SO.','error');
          }
        })
        .withFailureHandler(error => {
          if (printWindow) printWindow.close();
          showToast(readError(error),'error');
        })
        .getPelatihReport(state.sessionToken, noMatrik);
    }


    function reportPreviewHtml(report) {
      const p = report.profile || {};
      const s = report.summary || {};
      return `<section class="report-preview">
        <div class="report-preview-head">
          <div><h3>${escapeHtml(p.nama || '-')}</h3><p>${escapeHtml(p.noMatrik || '-')} · ${escapeHtml(p.tahunPengajian || '-')} · ${escapeHtml(p.semester || '-')}</p></div>
          <button class="btn btn-primary" type="button" data-print-current-report>CETAK SEMULA</button>
        </div>
        <div class="report-summary-grid">
          ${reportSummaryHtml('Jumlah',s.jumlahPermohonan)}
          ${reportSummaryHtml('Selesai',s.selesai)}
          ${reportSummaryHtml('Diluluskan',s.diluluskan)}
          ${reportSummaryHtml('Ditolak',s.ditolak)}
          ${reportSummaryHtml('Lewat',s.lewat)}
          ${reportSummaryHtml('Amaran Lokasi',s.amaranLokasi)}
        </div>
      </section>`;
    }


    function reportSummaryHtml(label, value) {
      return `<div class="report-summary"><span>${escapeHtml(label)}</span><strong>${Number(value)||0}</strong></div>`;
    }


    function bindReportPreviewPrint(scope = document) {
      scope.querySelectorAll('[data-print-current-report]').forEach(button => {
        button.addEventListener('click', () => {
          if (!state.reportData) return;
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            showToast('Browser menyekat paparan cetakan. Sila benarkan pop-up.','error');
            return;
          }
          printWindow.document.write(buildPrintableReportHtml(state.reportData));
          printWindow.document.close();
        });
      });
    }


    function buildPrintableReportHtml(report) {
      const p = report.profile || {};
      const s = report.summary || {};
      const rows = report.rows || [];

      const rowHtml = rows.length ? rows.map((r,index) => `
        <tr>
          <td class="center">${index+1}</td>
          <td><strong>${escapeHtml(r.noRujukan||'-')}</strong><div class="muted">${escapeHtml(r.tarikhMohon||'-')}</div></td>
          <td>${escapeHtml(labelCode(r.tujuan)||'-')}${r.catatanTujuan?`<div class="muted">${escapeHtml(r.catatanTujuan)}</div>`:''}</td>
          <td><strong>Keluar:</strong> ${escapeHtml(r.masaKeluarSebenar||`${r.tarikhKeluar} ${r.masaKeluarDirancang}`)}<br><strong>Kembali:</strong> ${escapeHtml(r.masaKembaliSebenar||'-')}</td>
          <td>${escapeHtml(statusLabel(r.statusSokongan||'BELUM_DISOKONG'))}<br><span class="muted">${escapeHtml(r.disokongOleh||'-')}</span></td>
          <td>${escapeHtml(statusLabel(r.statusKelulusan||'BELUM_DILULUSKAN'))}<br><span class="muted">${escapeHtml(r.diluluskanOleh||'-')}</span></td>
          <td class="waris-cell">
            <strong>${escapeHtml(r.namaWaris || '-')}</strong>
            <div class="muted">${escapeHtml(r.hubunganWaris || '-')}</div>
            ${String(r.statusPengesahanWaris||'').toUpperCase()==='DISAHKAN'
              ? `<div class="success">Disahkan${r.masaPengesahanWaris ? ` · ${escapeHtml(r.masaPengesahanWaris)}` : ''}</div>
                 ${r.tandatanganBase64
                   ? `<div class="signature-print-box">
                        <img class="signature-print" src="data:${escapeAttr(r.tandatanganMime || 'image/png')};base64,${r.tandatanganBase64}" alt="Tandatangan waris">
                      </div>`
                   : `<div class="muted">Imej tandatangan tidak tersedia</div>`}`
              : `<div class="muted">Belum disahkan</div>`}
          </td>
          <td>${escapeHtml(statusLabel(r.status||'-'))}
            ${Number(r.minitLewat||0)>0?`<div class="danger">Lewat ${Number(r.minitLewat)} minit</div>`:''}
            ${String(r.statusLokasiKembali||'').toUpperCase()==='LUAR_RADIUS_KOLEJ'?`<div class="danger">LUAR RADIUS KOLEJ${r.jarakKolejMeter?` · ${escapeHtml(String(r.jarakKolejMeter))}m`:''}</div>`:''}
          </td>
        </tr>`).join('') : '<tr><td colspan="8" class="center muted">Tiada rekod permohonan e-SO.</td></tr>';

      return `<!DOCTYPE html><html lang="ms"><head><meta charset="UTF-8">
<title>Laporan e-SO — ${escapeHtml(p.nama||'')}</title>
<style>
@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#111827;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:9.5px}
.toolbar{display:flex;justify-content:flex-end;margin-bottom:10px}.print-btn{padding:9px 16px;border:0;border-radius:7px;color:#17305f;background:#f6c945;font-weight:700;cursor:pointer}
.header{display:grid;grid-template-columns:72px 1fr auto;gap:15px;align-items:center;padding-bottom:12px;border-bottom:3px solid #17305f}.logo{width:64px;height:64px;display:grid;place-items:center;border-radius:15px;color:#17305f;background:#f6c945;font-weight:900;font-size:16px}
.header h1{margin:0;font-size:20px;color:#17305f}.header h2{margin:4px 0 0;font-size:13px}.header p{margin:4px 0 0;color:#6b7280}.generated{text-align:right;color:#6b7280;line-height:1.5}
.profile{display:grid;grid-template-columns:1.4fr 1fr 1.6fr .8fr .8fr;gap:7px;margin:12px 0}.box,.stat{border:1px solid #d1d5db;border-radius:6px;padding:8px}.label{color:#6b7280;font-size:7.5px;font-weight:700;text-transform:uppercase}.value{margin-top:4px;font-weight:700}
.stats{display:grid;grid-template-columns:repeat(6,1fr);gap:7px;margin-bottom:12px}.stat strong{display:block;margin-top:4px;color:#17305f;font-size:17px}
table{width:100%;border-collapse:collapse;table-layout:fixed}th{padding:7px 5px;color:#fff;background:#17305f;border:1px solid #17305f;font-size:8px;text-align:left}td{padding:6px 5px;border:1px solid #d1d5db;vertical-align:top;line-height:1.45;word-wrap:break-word}tr{break-inside:avoid}.center{text-align:center}.muted{color:#6b7280;font-size:8px;margin-top:2px}.danger{color:#b91c1c;font-weight:700;margin-top:3px}.success{color:#166534;font-weight:700;margin-top:3px}
.waris-cell{min-height:74px}
.signature-print-box{margin-top:5px;padding:3px;border:1px solid #d1d5db;border-radius:4px;background:#fff;text-align:center}
.signature-print{display:block;max-width:100%;width:auto;max-height:50px;margin:0 auto;object-fit:contain}
.footer{margin-top:10px;padding-top:8px;border-top:1px solid #d1d5db;color:#6b7280;display:flex;justify-content:space-between;font-size:8px}
@media print{.toolbar{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.signature-print{max-height:46px}}
</style></head><body>
<div class="toolbar"><button class="print-btn" onclick="window.print()">CETAK / SIMPAN PDF</button></div>
<header class="header"><div class="logo">e-SO</div><div><h1>ILKKM (PP) SEREMBAN</h1><h2>LAPORAN INDIVIDU REKOD BERMALAM LUAR PELATIH</h2><p>Sistem Rekod Bermalam Luar Pelatih (e-SO)</p></div><div class="generated">Dijana: <strong>${escapeHtml(report.generatedAt||'-')}</strong><br>Oleh: ${escapeHtml(report.generatedBy||'-')}</div></header>
<section class="profile">
<div class="box"><div class="label">Nama Pelatih</div><div class="value">${escapeHtml(p.nama||'-')}</div></div>
<div class="box"><div class="label">No. Matrik</div><div class="value">${escapeHtml(p.noMatrik||'-')}</div></div>
<div class="box"><div class="label">Program</div><div class="value">${escapeHtml(p.program||'-')}</div></div>
<div class="box"><div class="label">Tahun</div><div class="value">${escapeHtml(p.tahunPengajian||'-')}</div></div>
<div class="box"><div class="label">Semester</div><div class="value">${escapeHtml(p.semester||'-')}</div></div>
</section>
<section class="stats">
<div class="stat"><div class="label">Jumlah Permohonan</div><strong>${Number(s.jumlahPermohonan)||0}</strong></div>
<div class="stat"><div class="label">Selesai</div><strong>${Number(s.selesai)||0}</strong></div>
<div class="stat"><div class="label">Diluluskan</div><strong>${Number(s.diluluskan)||0}</strong></div>
<div class="stat"><div class="label">Ditolak</div><strong>${Number(s.ditolak)||0}</strong></div>
<div class="stat"><div class="label">Lewat</div><strong>${Number(s.lewat)||0}</strong></div>
<div class="stat"><div class="label">Amaran Lokasi</div><strong>${Number(s.amaranLokasi)||0}</strong></div>
</section>
<table><thead><tr><th style="width:3%">Bil.</th><th style="width:10%">Rujukan / Tarikh Mohon</th><th style="width:13%">Tujuan</th><th style="width:16%">Pergerakan</th><th style="width:11%">Sokongan</th><th style="width:11%">Kelulusan</th><th style="width:20%">Waris / Tandatangan</th><th style="width:16%">Status</th></tr></thead><tbody>${rowHtml}</tbody></table>
<footer class="footer"><span>Laporan dijana daripada rekod digital e-SO.</span><span>Created by: <strong>Mohd Norais Mohamed Rashid</strong>  |  Powered by: <strong>ILKKM SEREMBAN</strong></span></footer>
<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},350)});<\/script>
</body></html>`;
    }


    function submitRequest(event) {
      event.preventDefault();
      const button = document.getElementById('submitRequestBtn');
      setButtonLoading(button, true, 'MENGHANTAR...');

      const payload = {
        tarikhKeluar: valueOf('tarikhKeluar'),
        masaKeluar: valueOf('masaKeluar'),
        tarikhKembali: valueOf('tarikhKembali'),
        masaKembali: valueOf('masaKembali'),
        tujuan: valueOf('tujuan'),
        catatanTujuan: valueOf('catatanTujuan'),
        alamatBermalam: valueOf('alamatBermalam'),
        pengangkutan: valueOf('pengangkutan'),
        namaWaris: valueOf('namaWaris'),
        hubunganWaris: valueOf('hubunganWaris'),
        telWaris: valueOf('telWaris'),
        pengakuan: document.getElementById('pengakuanPelatih').checked
      };

      EsoApi.run
        .withSuccessHandler(result => {
          setButtonLoading(button, false, 'HANTAR PERMOHONAN');
          state.data = result.data;
          showToast(`✓ ${result.message} No. Rujukan: ${result.noRujukan}`, 'success');
          state.activeView = 'dashboard';
          renderApp();
        })
        .withFailureHandler(error => {
          setButtonLoading(button, false, 'HANTAR PERMOHONAN');
          showToast(readError(error), 'error');
        })
        .submitPermohonan(state.sessionToken, payload);
    }

    function bindRecordActions(scope = document) {
      scope.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', event => {
          const button = event.currentTarget;
          handleRecordAction(button.dataset.action, button.dataset.id, button);
        });
      });
    }

    function handleRecordAction(action, id, button) {
      const record = findClientRecord(id);
      if (!record) { showToast('Rekod tidak ditemui dalam paparan semasa.', 'error'); return; }

      if (action === 'detail') { showRecordModal(record); return; }

      if (action === 'cancel') {
        if (state.role !== 'ADMIN' || !['PEGAWAI_BERTUGAS', 'SUPER_ADMIN'].includes(String(state.user.peranan || '').toUpperCase())) {
          showToast('Anda tidak dibenarkan membatalkan permohonan.', 'error'); return;
        }
        if (!confirm(`Sahkan pelatih telah memaklumkan pembatalan melalui komunikasi luar aplikasi.\n\nBatalkan dan padam permohonan ${record.noRujukan} untuk ${record.nama}? Pelatih boleh membuat permohonan baharu selepas ini.`)) return;
        setButtonLoading(button, true, 'MEMPROSES...');
        EsoApi.run.withSuccessHandler(result => updateFromServer(result, button, 'BATALKAN')).withFailureHandler(error => actionError(error, button, 'BATALKAN')).cancelPermohonan(state.sessionToken, id);
        return;
      }

      if (action === 'support' || action === 'notSupport') { supportModal(record, action); return; }
      if (action === 'approveFinal' || action === 'rejectFinal') { approvalModal(record, action); return; }

      if (action === 'keluar') {
        if (!confirm(`Rekod ${record.nama} keluar hostel sekarang?`)) return;
        setButtonLoading(button, true, 'MEREKOD...');
        EsoApi.run.withSuccessHandler(result => updateFromServer(result, button, 'REKOD KELUAR')).withFailureHandler(error => actionError(error, button, 'REKOD KELUAR')).markKeluar(state.sessionToken, id);
        return;
      }

      if (action === 'securityPass') {
        printSecurityPass(record, button);
        return;
      }

      if (action === 'selfCheckout') {
        showSelfCheckoutModal(record);
        return;
      }

      if (action === 'selfReturn') {
        showSelfReturnModal(record);
        return;
      }

      if (action === 'kembali') {
        const isPendingSelfReturn = record.status === 'TUNGGU_PENGESAHAN_KEMBALI';
        const promptText = isPendingSelfReturn
          ? `Pelatih ${record.nama} telah membuat pengesahan kendiri kembali. Sahkan kepulangan pelatih dan lengkapkan rekod?`
          : `Sahkan ${record.nama} telah kembali ke kolej sekarang?`;

        if (!confirm(promptText)) return;

        const resetLabel = isPendingSelfReturn ? 'SAHKAN KEMBALI PELATIH' : 'SAHKAN KEMBALI';
        setButtonLoading(button, true, 'MEREKOD...');
        EsoApi.run.withSuccessHandler(result => updateFromServer(result, button, resetLabel)).withFailureHandler(error => actionError(error, button, resetLabel)).markKembali(state.sessionToken, id);
        return;
      }

      if (action === 'waris') {
        setButtonLoading(button, true, 'MENJANA...');
        EsoApi.run
          .withSuccessHandler(result => { setButtonLoading(button, false, 'PAUTAN WARIS'); showWarisLinkModal(result); })
          .withFailureHandler(error => actionError(error, button, 'PAUTAN WARIS'))
          .getWarisLink(state.sessionToken, id);
      }
    }

    function updateFromServer(result, button, resetLabel) {
      if (button) setButtonLoading(button, false, resetLabel);
      state.data = result.data;
      showToast(`✓ ${result.message}`, 'success');
      closeModal();
      renderApp();
      updateLiveSyncChip('paused', `Sync Manual · ${formatClock(new Date())}`);
      scheduleLiveSync();
    }

    function actionError(error, button, resetLabel) {
      if (button) setButtonLoading(button, false, resetLabel);
      showToast(readError(error), 'error');
    }

    function supportModal(record, action) {
      const reject = action === 'notSupport';
      document.getElementById('modalTitle').textContent = reject ? 'Tidak Sokong Permohonan' : 'Sokong Permohonan';
      document.getElementById('modalBody').innerHTML = `
        ${recordDetailsHtml(record)}
        <div class="field" style="margin-top:16px"><label>${reject ? 'Sebab Tidak Menyokong' : 'Catatan Sokongan'}</label><textarea id="supportNote" placeholder="${reject ? 'Sebab diperlukan' : 'Catatan pilihan'}"></textarea></div>
        <div class="submit-row"><button class="btn" type="button" onclick="closeModal()">BATAL</button><button class="btn ${reject ? 'btn-red':'btn-green'}" id="supportSubmit" type="button">${reject ? 'SAHKAN TIDAK SOKONG':'SOKONG PERMOHONAN'}</button></div>`;
      openModal();
      document.getElementById('supportSubmit').addEventListener('click', event => {
        const note = document.getElementById('supportNote').value.trim();
        if (reject && !note) { showToast('Sebab tidak menyokong perlu dinyatakan.','error'); return; }
        const button = event.currentTarget;
        setButtonLoading(button,true,'MEMPROSES...');
        EsoApi.run.withSuccessHandler(result => updateFromServer(result,button,reject?'SAHKAN TIDAK SOKONG':'SOKONG PERMOHONAN'))
          .withFailureHandler(error => actionError(error,button,reject?'SAHKAN TIDAK SOKONG':'SOKONG PERMOHONAN'))
          .supportPermohonan(state.sessionToken,record.idPermohonan,reject?'TIDAK_SOKONG':'SOKONG',note);
      });
    }

    function approvalModal(record, action) {
      const reject = action === 'rejectFinal';
      document.getElementById('modalTitle').textContent = reject ? 'Tolak Kelulusan Akhir' : 'Kelulusan Akhir Permohonan';
      document.getElementById('modalBody').innerHTML = `
        ${recordDetailsHtml(record)}
        <div class="geo-warning-banner" style="border-color:rgba(139,92,246,.38);background:rgba(76,29,149,.22);color:#ddd6fe"><strong>PERINGKAT KELULUSAN AKHIR:</strong> Permohonan ini telah disokong dan memerlukan keputusan SUPER_ADMIN.</div>
        <div class="field" style="margin-top:16px"><label>${reject ? 'Sebab Penolakan Kelulusan' : 'Catatan Kelulusan'}</label><textarea id="approvalNote" placeholder="${reject ? 'Sebab diperlukan' : 'Catatan pilihan'}"></textarea></div>
        <div class="submit-row"><button class="btn" type="button" onclick="closeModal()">BATAL</button><button class="btn ${reject ? 'btn-red':'btn-green'}" id="approvalSubmit" type="button">${reject ? 'TOLAK KELULUSAN':'LULUSKAN PERMOHONAN'}</button></div>`;
      openModal();
      document.getElementById('approvalSubmit').addEventListener('click', event => {
        const note = document.getElementById('approvalNote').value.trim();
        if (reject && !note) { showToast('Sebab penolakan kelulusan perlu dinyatakan.','error'); return; }
        const button = event.currentTarget;
        setButtonLoading(button,true,'MEMPROSES...');
        EsoApi.run.withSuccessHandler(result => updateFromServer(result,button,reject?'TOLAK KELULUSAN':'LULUSKAN PERMOHONAN'))
          .withFailureHandler(error => actionError(error,button,reject?'TOLAK KELULUSAN':'LULUSKAN PERMOHONAN'))
          .approvePermohonan(state.sessionToken,record.idPermohonan,reject?'TOLAK':'LULUS',note);
      });
    }

    function printSecurityPass(record, sourceButton) {
      const printWindow = window.open('', '_blank');

      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head><title>e-SO — Menjana Pass</title></head>
            <body style="font-family:Arial,sans-serif;padding:40px;color:#1f2937">
              <h2>PASS e-SO</h2>
              <p>Menjana Pass Security...</p>
            </body>
          </html>
        `);
        printWindow.document.close();
      }

      if (sourceButton) {
        setButtonLoading(sourceButton, true, 'MENJANA PASS...');
      }

      EsoApi.run
        .withSuccessHandler(result => {
          if (sourceButton) {
            setButtonLoading(
              sourceButton,
              false,
              record.status === 'DILULUSKAN'
                ? 'CETAK PASS e-SO'
                : 'CETAK SEMULA PASS'
            );
          }

          const html = buildSecurityPassHtml(result);

          if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
          } else {
            showToast(
              'Browser menyekat paparan Pass. Sila benarkan pop-up untuk e-SO.',
              'error'
            );
          }
        })
        .withFailureHandler(error => {
          if (sourceButton) {
            setButtonLoading(
              sourceButton,
              false,
              record.status === 'DILULUSKAN'
                ? 'CETAK PASS e-SO'
                : 'CETAK SEMULA PASS'
            );
          }

          if (printWindow) printWindow.close();
          showToast(readError(error), 'error');
        })
        .getSecurityPass(
          state.sessionToken,
          record.idPermohonan
        );
    }


    function buildSecurityPassHtml(pass) {
      const tujuanText = labelCode(pass.tujuan) || '-';
      const tujuanDetail = pass.catatanTujuan
        ? `${tujuanText} — ${pass.catatanTujuan}`
        : tujuanText;

      return `<!DOCTYPE html>
<html lang="ms">
<head>
  <meta charset="UTF-8">
  <title>Pass e-SO — ${escapeHtml(pass.noRujukan || '')}</title>
  <style>
    @page {
      size: A5 portrait;
      margin: 9mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: #0f172a;
      background: #ffffff;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
    }

    .toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 10px;
    }

    .print-btn {
      padding: 9px 15px;
      border: 0;
      border-radius: 7px;
      color: #17305f;
      background: #f6c945;
      font-weight: 800;
      cursor: pointer;
    }

    .pass {
      border: 2px solid #17305f;
      border-radius: 12px;
      overflow: hidden;
    }

    .head {
      display: grid;
      grid-template-columns: 58px 1fr;
      gap: 13px;
      align-items: center;
      padding: 14px 15px;
      color: #ffffff;
      background: #17305f;
    }

    .logo {
      width: 54px;
      height: 54px;
      display: grid;
      place-items: center;
      border-radius: 13px;
      color: #17305f;
      background: #f6c945;
      font-size: 15px;
      font-weight: 900;
    }

    .head h1 {
      margin: 0;
      font-size: 18px;
    }

    .head h2 {
      margin: 4px 0 0;
      color: #f6c945;
      font-size: 13px;
    }

    .head p {
      margin: 5px 0 0;
      color: #cbd5e1;
      font-size: 8.5px;
    }

    .security-copy {
      padding: 7px 14px;
      color: #7f1d1d;
      background: #fee2e2;
      border-bottom: 1px solid #fecaca;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: .08em;
      text-align: center;
    }

    .reference {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 11px 14px;
      background: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
    }

    .reference strong {
      color: #17305f;
      font-size: 12px;
    }

    .status {
      padding: 5px 9px;
      border-radius: 999px;
      color: #166534;
      background: #dcfce7;
      font-size: 8px;
      font-weight: 900;
    }

    .body {
      padding: 13px 14px 14px;
    }

    .identity {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .box {
      padding: 8px 9px;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      min-height: 49px;
    }

    .box.full {
      grid-column: 1 / -1;
    }

    .label {
      color: #64748b;
      font-size: 7px;
      font-weight: 900;
      letter-spacing: .05em;
      text-transform: uppercase;
    }

    .value {
      margin-top: 5px;
      font-size: 10px;
      font-weight: 800;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }

    .movement {
      margin-top: 11px;
      border: 1px solid #17305f;
      border-radius: 8px;
      overflow: hidden;
    }

    .movement-title {
      padding: 7px 10px;
      color: #ffffff;
      background: #17305f;
      font-size: 8px;
      font-weight: 900;
      letter-spacing: .06em;
      text-transform: uppercase;
    }

    .movement-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .movement-item {
      padding: 10px;
    }

    .movement-item + .movement-item {
      border-left: 1px solid #cbd5e1;
    }

    .movement-item strong {
      display: block;
      margin-top: 5px;
      color: #17305f;
      font-size: 13px;
    }

    .approval {
      margin-top: 10px;
      padding: 9px 10px;
      border-radius: 7px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      line-height: 1.5;
    }

    .security-section {
      margin-top: 11px;
      padding: 11px;
      border: 1px dashed #64748b;
      border-radius: 8px;
    }

    .security-section h3 {
      margin: 0 0 11px;
      color: #17305f;
      font-size: 10px;
    }

    .security-lines {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 13px;
    }

    .line {
      padding-top: 18px;
      border-bottom: 1px solid #334155;
      color: #64748b;
      font-size: 7.5px;
    }

    .notice {
      margin-top: 10px;
      color: #475569;
      font-size: 7.5px;
      line-height: 1.45;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 14px;
      color: #64748b;
      background: #f8fafc;
      border-top: 1px solid #cbd5e1;
      font-size: 7.5px;
    }

    @media print {
      .toolbar {
        display: none;
      }

      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="print-btn" onclick="window.print()">
      CETAK / SIMPAN PDF
    </button>
  </div>

  <section class="pass">
    <header class="head">
      <div class="logo">e-SO</div>
      <div>
        <h1>ILKKM (PP) SEREMBAN</h1>
        <h2>PASS KELUAR e-SO</h2>
        <p>Sistem Rekod Bermalam Luar Pelatih</p>
      </div>
    </header>

    <div class="security-copy">
      UNTUK SIMPANAN SECURITY DI PINTU MASUK / KELUAR
    </div>

    <div class="reference">
      <div>
        <div class="label">No. Rujukan</div>
        <strong>${escapeHtml(pass.noRujukan || '-')}</strong>
      </div>
      <span class="status">DILULUSKAN</span>
    </div>

    <div class="body">
      <section class="identity">
        <div class="box full">
          <div class="label">Nama Pelatih</div>
          <div class="value">${escapeHtml(pass.nama || '-')}</div>
        </div>

        <div class="box">
          <div class="label">No. Kad Pengenalan</div>
          <div class="value">${escapeHtml(pass.noIc || '-')}</div>
        </div>

        <div class="box">
          <div class="label">No. Matrik</div>
          <div class="value">${escapeHtml(pass.noMatrik || '-')}</div>
        </div>

        <div class="box full">
          <div class="label">Program</div>
          <div class="value">${escapeHtml(pass.program || '-')}</div>
        </div>

        <div class="box full">
          <div class="label">Tujuan</div>
          <div class="value">${escapeHtml(tujuanDetail)}</div>
        </div>
      </section>

      <section class="movement">
        <div class="movement-title">
          Tempoh Bermalam Di Luar
        </div>

        <div class="movement-grid">
          <div class="movement-item">
            <div class="label">Tarikh / Masa Keluar</div>
            <strong>
              ${escapeHtml(pass.tarikhKeluar || '-')}<br>
              ${escapeHtml(pass.masaKeluar || '-')}
            </strong>
          </div>

          <div class="movement-item">
            <div class="label">Tarikh / Masa Jangka Kembali</div>
            <strong>
              ${escapeHtml(pass.tarikhKembali || '-')}<br>
              ${escapeHtml(pass.masaKembali || '-')}
            </strong>
          </div>
        </div>
      </section>

      <div class="approval">
        <strong>Kelulusan e-SO:</strong>
        ${escapeHtml(pass.diluluskanOleh || '-')}
        ${pass.masaKelulusan
          ? ` · ${escapeHtml(pass.masaKelulusan)}`
          : ''}
      </div>

      <section class="security-section">
        <h3>UNTUK KEGUNAAN SECURITY</h3>
        <div class="security-lines">
          <div class="line">Tarikh / Masa Pass Diterima</div>
          <div class="line">Nama / Paraf Security</div>
        </div>
      </section>

      <div class="notice">
        Pass ini dijana daripada permohonan e-SO yang telah diluluskan.
        Salinan ini adalah untuk simpanan Security di pintu masuk / keluar kolej.
      </div>
    </div>

    <footer class="footer">
      <span>Dijana: ${escapeHtml(pass.generatedAt || '-')}</span>
      <span>Created by: <strong>Mohd Norais Mohamed Rashid</strong>  |  Powered by: <strong>ILKKM SEREMBAN</strong></span>
    </footer>
  </section>

  <script>
    window.addEventListener('load', function () {
      setTimeout(function () {
        window.print();
      }, 350);
    });
  <\/script>
</body>
</html>`;
    }


    function showSelfCheckoutModal(record) {
      document.getElementById('modalTitle').textContent = 'Rekod Keluar';
      document.getElementById('modalBody').innerHTML = `
        <div class="detail-grid">
          ${detailHtml('No. Rujukan', record.noRujukan)}
          ${detailHtml('Status Permohonan', statusLabel(record.status))}
          ${detailHtml(
            'Jadual Keluar',
            `${record.tarikhKeluar} · ${record.masaKeluar}`,
            true
          )}
          ${detailHtml(
            'Jangka Kembali',
            `${record.tarikhKembali} · ${record.masaKembali}`,
            true
          )}
          ${detailHtml('Alamat Bermalam', record.alamatBermalam, true)}
        </div>

        <div class="location-box" style="margin-top:16px">
          <p>
            Tekan pengesahan ini <strong>semasa anda benar-benar keluar dari kolej</strong>.
            Tarikh dan masa semasa akan direkodkan sebagai masa keluar sebenar.
          </p>
          <p style="margin-top:8px;color:#fde68a">
            Selepas Rekod Keluar berjaya, status anda akan bertukar kepada
            <strong>Menunggu Pengesahan Waris</strong>.
          </p>
        </div>

        <div class="check-row" style="margin-top:14px">
          <input id="selfCheckoutAkuan" type="checkbox">
          <label for="selfCheckoutAkuan">
            Saya mengesahkan bahawa saya sedang keluar dari kolej dan maklumat permohonan ini adalah benar.
          </label>
        </div>

        <div class="submit-row">
          <button class="btn" type="button" onclick="closeModal()">BATAL</button>
          <button
            class="btn btn-primary"
            id="selfCheckoutSubmit"
            type="button"
          >
            SAHKAN REKOD KELUAR
          </button>
        </div>
      `;

      openModal();

      document
        .getElementById('selfCheckoutSubmit')
        .addEventListener('click', event => {
          if (!document.getElementById('selfCheckoutAkuan').checked) {
            showToast(
              'Sila tandakan pengesahan sebelum merekod keluar.',
              'error'
            );
            return;
          }

          const button = event.currentTarget;
          setButtonLoading(button, true, 'MEREKOD...');

          EsoApi.run
            .withSuccessHandler(result => {
              setButtonLoading(
                button,
                false,
                'SAHKAN REKOD KELUAR'
              );

              state.data = result.data;
              closeModal();

              showToast(
                `✓ ${result.message} ${result.waktuKeluar}`,
                'success'
              );

              state.activeView = 'dashboard';
              renderApp();
            })
            .withFailureHandler(error => {
              actionError(
                error,
                button,
                'SAHKAN REKOD KELUAR'
              );
            })
            .pelatihRekodKeluar(
              state.sessionToken,
              record.idPermohonan
            );
        });
    }


    function showSelfReturnModal(record) {
      document.getElementById('modalTitle').textContent = 'Kembali Ke Kolej';
      document.getElementById('modalBody').innerHTML = `
        <div class="detail-grid">
          ${detailHtml('No. Rujukan', record.noRujukan)}
          ${detailHtml('Status Semasa', statusLabel(record.status))}
          ${detailHtml('Jangka Kembali', `${record.tarikhKembali} · ${record.masaKembali}`, true)}
        </div>
        <div class="location-box" style="margin-top:16px">
          <p>Anda boleh membuat pengesahan walaupun kembali lebih awal daripada jangka masa yang dinyatakan. Tarikh dan masa semasa akan direkodkan sebagai <strong>masa pengesahan kendiri kembali</strong>.</p>
          <p style="margin-top:8px;color:#fde68a">Rekod belum selesai sehingga kepulangan anda disahkan oleh Admin / Penyelaras / Pegawai Bertugas.</p>
        </div>

        <section class="geo-stamp">
          <div class="geo-stamp-head">
            <div>
              <h4>Stamp Lokasi Semasa</h4>
              <p>Lokasi semasa wajib direkodkan. Jika anda berada di luar radius 1000 meter dari kolej, pengesahan masih dihantar tetapi Admin akan menerima AMARAN MERAH.</p>
            </div>
            <span class="geo-badge warn" id="selfReturnGeoBadge">BELUM DIREKOD</span>
          </div>
          <div class="geo-preview" id="selfReturnGeoPreview">
            Sistem akan mendapatkan koordinat semasa, accuracy GPS dan menghantarnya bersama pengesahan kembali untuk semakan radius 1000 meter.
          </div>
          <div class="geo-actions">
            <button class="btn btn-blue" type="button" id="captureSelfReturnGeo">DAPATKAN LOKASI SEMASA</button>
          </div>
        </section>

        <div class="check-row" style="margin-top:14px">
          <input id="selfReturnAkuan" type="checkbox">
          <label for="selfReturnAkuan">Saya mengesahkan bahawa saya telah kembali ke kolej pada masa ini.</label>
        </div>
        <div class="submit-row">
          <button class="btn" type="button" onclick="closeModal()">BATAL</button>
          <button class="btn btn-primary" id="selfReturnSubmit" type="button">HANTAR PENGESAHAN KEMBALI</button>
        </div>`;
      openModal();

      let capturedGeo = null;

      const updateGeoPreview = geo => {
        const badge = document.getElementById('selfReturnGeoBadge');
        const preview = document.getElementById('selfReturnGeoPreview');
        if (!badge || !preview) return;

        if (!geo) {
          badge.className = 'geo-badge warn';
          badge.textContent = 'BELUM DIREKOD';
          preview.textContent = 'Sistem akan mendapatkan koordinat semasa, accuracy GPS dan menghantarnya bersama pengesahan kembali untuk semakan radius 1000 meter.';
          return;
        }

        badge.className = 'geo-badge ok';
        badge.textContent = 'LOKASI DIREKOD';
        preview.innerHTML = `
          <strong>Latitude:</strong> ${escapeHtml(String(Number(geo.latitude).toFixed(6)))}<br>
          <strong>Longitude:</strong> ${escapeHtml(String(Number(geo.longitude).toFixed(6)))}<br>
          <strong>Accuracy:</strong> ±${escapeHtml(String(Math.round(Number(geo.accuracy || 0))))} meter<br>
          <strong>Masa GPS:</strong> ${escapeHtml(formatClientDateTime(geo.timestamp))}
        `;
      };

      const captureLocation = async captureBtn => {
        if (!navigator.geolocation) {
          throw new Error('Browser ini tidak menyokong pengesanan lokasi.');
        }

        if (captureBtn) setButtonLoading(captureBtn, true, 'MENDAPATKAN...');
        try {
          const geo = await getCurrentLocation_();
          capturedGeo = geo;
          updateGeoPreview(geo);
          showToast('Lokasi semasa berjaya direkodkan.', 'success');
          return geo;
        } finally {
          if (captureBtn) setButtonLoading(captureBtn, false, 'DAPATKAN LOKASI SEMASA');
        }
      };

      document.getElementById('captureSelfReturnGeo').addEventListener('click', async event => {
        try {
          await captureLocation(event.currentTarget);
        } catch (error) {
          showToast(readError(error), 'error');
        }
      });

      document.getElementById('selfReturnSubmit').addEventListener('click', async event => {
        if (!document.getElementById('selfReturnAkuan').checked) {
          showToast('Sila tandakan pengesahan bahawa anda telah kembali ke kolej.', 'error');
          return;
        }

        const button = event.currentTarget;
        setButtonLoading(button, true, 'MENGHANTAR...');

        try {
          if (!capturedGeo) {
            capturedGeo = await captureLocation();
          }

          EsoApi.run
            .withSuccessHandler(result => {
              setButtonLoading(button, false, 'HANTAR PENGESAHAN KEMBALI');
              state.data = result.data;
              closeModal();
              const isGeoWarning = String(result.geoStatus || '').toUpperCase().includes('LUAR RADIUS');
              showToast(
                `${isGeoWarning ? '⚠' : '✓'} ${result.message} ${result.waktuKembali} · ${result.geoStatus || ''}`,
                isGeoWarning ? 'error' : 'success'
              );
              state.activeView = 'dashboard';
              renderApp();
            })
            .withFailureHandler(error => actionError(error, button, 'HANTAR PENGESAHAN KEMBALI'))
            .pelatihKembaliKeKolej(state.sessionToken, record.idPermohonan, capturedGeo);
        } catch (error) {
          setButtonLoading(button, false, 'HANTAR PENGESAHAN KEMBALI');
          showToast(readError(error), 'error');
        }
      });
    }

    function showRecordModal(record) {
      document.getElementById('modalTitle').textContent = `Butiran ${record.noRujukan}`;
      document.getElementById('modalBody').innerHTML = `
        ${recordDetailsHtml(record)}

        <section class="geo-stamp" id="returnGeoStampDetail">
          <div class="geo-stamp-head">
            <div>
              <h4>Stamp Lokasi Kembali</h4>
              <p>Koordinat semasa yang direkodkan ketika pelatih menekan butang Kembali Ke Kolej.</p>
            </div>
          </div>
          <div class="signature-loading">
            <span class="loader-ring" style="width:17px;height:17px;border-width:2px;display:inline-block;margin:0 8px -4px 0"></span>
            Memuatkan stamp lokasi kembali...
          </div>
        </section>

        <section class="signature-detail" id="warisSignatureDetail">
          <div class="signature-detail-head">
            <div>
              <h4>Tandatangan Waris</h4>
              <p>Pengesahan digital waris bagi keberadaan pelatih di alamat bermalam.</p>
            </div>
          </div>
          <div class="signature-loading">
            <span class="loader-ring" style="width:17px;height:17px;border-width:2px;display:inline-block;margin:0 8px -4px 0"></span>
            Memuatkan tandatangan waris...
          </div>
        </section>

        <div class="submit-row">
          <button class="btn btn-blue" type="button" onclick="closeModal()">TUTUP</button>
        </div>
      `;
      openModal();
      loadReturnGeoStampForDetail(record.idPermohonan);
      loadWarisSignatureForDetail(record.idPermohonan);
    }

    function loadWarisSignatureForDetail(idPermohonan) {
      const target = document.getElementById('warisSignatureDetail');
      if (!target) return;

      EsoApi.run
        .withSuccessHandler(result => {
          const currentTarget = document.getElementById('warisSignatureDetail');
          if (!currentTarget) return;

          if (!result || !result.exists) {
            currentTarget.innerHTML = `
              <div class="signature-detail-head">
                <div>
                  <h4>Tandatangan Waris</h4>
                  <p>Pengesahan digital waris bagi keberadaan pelatih.</p>
                </div>
              </div>
              <div class="signature-empty">
                ${escapeHtml(
                  result && result.message
                    ? result.message
                    : 'Tandatangan waris belum diterima.'
                )}
              </div>
            `;
            return;
          }

          const signatureSrc =
            `data:${result.mime || 'image/png'};base64,${result.signatureBase64}`;

          currentTarget.innerHTML = `
            <div class="signature-detail-head">
              <div>
                <h4>Tandatangan Waris</h4>
                <p>Pengesahan digital telah diterima dan disimpan dalam rekod e-SO.</p>
              </div>
              <span class="signature-status">DISAHKAN</span>
            </div>

            <div class="signature-image-box">
              <img
                src="${escapeAttr(signatureSrc)}"
                alt="Tandatangan waris"
                loading="lazy"
              >
            </div>

            <div class="signature-meta">
              <div class="signature-meta-item">
                <span>Nama Waris</span>
                <strong>${escapeHtml(result.namaWaris || '-')}</strong>
              </div>
              <div class="signature-meta-item">
                <span>Hubungan</span>
                <strong>${escapeHtml(result.hubunganWaris || '-')}</strong>
              </div>
              <div class="signature-meta-item">
                <span>No. Telefon</span>
                <strong>${escapeHtml(result.telWaris || '-')}</strong>
              </div>
              <div class="signature-meta-item">
                <span>Masa Pengesahan</span>
                <strong>${escapeHtml(result.waktuPengesahan || '-')}</strong>
              </div>
            </div>
          `;
        })
        .withFailureHandler(error => {
          const currentTarget = document.getElementById('warisSignatureDetail');
          if (!currentTarget) return;

          currentTarget.innerHTML = `
            <div class="signature-detail-head">
              <div>
                <h4>Tandatangan Waris</h4>
                <p>Pengesahan digital waris bagi keberadaan pelatih.</p>
              </div>
            </div>
            <div class="signature-empty">
              Tandatangan tidak dapat dipaparkan.<br>
              ${escapeHtml(readError(error))}
            </div>
          `;
        })
        .getWarisSignatureForDetail(
          state.sessionToken,
          idPermohonan
        );
    }


    function loadReturnGeoStampForDetail(idPermohonan) {
      const target = document.getElementById('returnGeoStampDetail');
      if (!target) return;

      EsoApi.run
        .withSuccessHandler(result => {
          const currentTarget = document.getElementById('returnGeoStampDetail');
          if (!currentTarget) return;

          if (!result || !result.exists) {
            currentTarget.innerHTML = `
              <div class="geo-stamp-head">
                <div>
                  <h4>Stamp Lokasi Kembali</h4>
                  <p>Koordinat semasa yang direkodkan ketika pelatih menekan butang Kembali Ke Kolej.</p>
                </div>
              </div>
              <div class="signature-empty">${escapeHtml(result && result.message ? result.message : 'Stamp lokasi kembali belum direkodkan.')}</div>
            `;
            return;
          }

          const badgeType =
            result.statusCode === 'DALAM_RADIUS_KOLEJ' ? 'ok' :
            result.statusCode === 'LUAR_RADIUS_KOLEJ' ? 'danger' : 'warn';

          currentTarget.innerHTML = `
            <div class="geo-stamp-head">
              <div>
                <h4>Stamp Lokasi Kembali</h4>
                <p>Koordinat semasa yang direkodkan ketika pelatih menekan butang Kembali Ke Kolej.</p>
              </div>
              <span class="geo-badge ${badgeType}">${escapeHtml(result.statusLabel || '-')}</span>
            </div>

            <div class="signature-meta">
              <div class="signature-meta-item">
                <span>Latitude</span>
                <strong>${escapeHtml(String(Number(result.latitude).toFixed(6)))}</strong>
              </div>
              <div class="signature-meta-item">
                <span>Longitude</span>
                <strong>${escapeHtml(String(Number(result.longitude).toFixed(6)))}</strong>
              </div>
              <div class="signature-meta-item">
                <span>Accuracy</span>
                <strong>±${escapeHtml(result.accuracy !== '' ? String(Math.round(Number(result.accuracy))) : '-')} meter</strong>
              </div>
              <div class="signature-meta-item">
                <span>Masa GPS</span>
                <strong>${escapeHtml(result.gpsTime || '-')}</strong>
              </div>
              <div class="signature-meta-item">
                <span>Jarak ke ${escapeHtml(result.collegeName || 'Kolej')}</span>
                <strong>${escapeHtml(result.distanceMeter !== '' ? String(result.distanceMeter) + ' meter' : '-')}</strong>
              </div>
              <div class="signature-meta-item">
                <span>Radius semakan</span>
                <strong>${escapeHtml(String(result.collegeRadiusMeter || '-'))} meter</strong>
              </div>
            </div>

            <div class="geo-preview">
              <a class="geo-link" href="${escapeAttr(result.mapsLink || '#')}" target="_blank" rel="noopener noreferrer">Buka lokasi di Google Maps</a>
            </div>
          `;
        })
        .withFailureHandler(error => {
          const currentTarget = document.getElementById('returnGeoStampDetail');
          if (!currentTarget) return;
          currentTarget.innerHTML = `
            <div class="geo-stamp-head">
              <div>
                <h4>Stamp Lokasi Kembali</h4>
                <p>Koordinat semasa yang direkodkan ketika pelatih menekan butang Kembali Ke Kolej.</p>
              </div>
            </div>
            <div class="signature-empty">
              Stamp lokasi tidak dapat dipaparkan.<br>
              ${escapeHtml(readError(error))}
            </div>
          `;
        })
        .getReturnGeoStampForDetail(state.sessionToken, idPermohonan);
    }

    function getCurrentLocation_() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Browser ini tidak menyokong pengesanan lokasi.'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          position => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp
            });
          },
          error => {
            let message = 'Lokasi semasa tidak dapat diperoleh.';
            if (error && error.code === 1) message = 'Kebenaran lokasi ditolak. Sila benarkan akses lokasi.';
            if (error && error.code === 2) message = 'Maklumat lokasi tidak tersedia.';
            if (error && error.code === 3) message = 'Permintaan lokasi tamat masa. Sila cuba lagi.';
            reject(new Error(message));
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      });
    }

    function formatClientDateTime(value) {
      try {
        const date = new Date(value);
        if (!value || Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString('ms-MY');
      } catch (error) {
        return '-';
      }
    }


    function showWarisLinkModal(result) {
      document.getElementById('modalTitle').textContent = 'Pautan Pengesahan Waris';
      document.getElementById('modalBody').innerHTML = `
        <div class="detail-grid">${detailHtml('No. Rujukan', result.noRujukan)}${detailHtml('Pelatih', result.nama)}<div class="detail full"><span>Pautan Pengesahan</span><strong id="warisLinkText" style="word-break:break-all">${escapeHtml(result.url)}</strong></div></div>
        <div class="submit-row"><button class="btn btn-blue" id="copyWarisLink" type="button">SALIN PAUTAN</button><button class="btn btn-primary" id="shareWarisLink" type="button">KONGSI</button></div>`;
      openModal();

      document.getElementById('copyWarisLink').addEventListener('click', async () => { await copyText(result.url); showToast('Pautan waris telah disalin.', 'success'); });
      document.getElementById('shareWarisLink').addEventListener('click', async () => {
        const text = `Assalamualaikum.\n\nMohon pengesahan keberadaan pelatih ${result.nama} bagi permohonan ${result.noRujukan} melalui e-SO.\n\n${result.url}\n\nTerima kasih.`;
        if (navigator.share) {
          try { await navigator.share({ title: 'Pengesahan Waris e-SO', text }); } catch (_) {}
        } else {
          await copyText(text);
          showToast('Mesej dan pautan telah disalin.', 'success');
        }
      });
    }

    function bootWaris() {
      document.getElementById('appRoot').classList.add('hidden');
      document.getElementById('warisRoot').classList.remove('hidden');
      EsoApi.run
        .withSuccessHandler(data => { document.getElementById('loadingScreen').classList.add('hidden'); renderWaris(data); })
        .withFailureHandler(error => {
          document.getElementById('loadingScreen').classList.add('hidden');
          document.getElementById('warisContent').innerHTML = `<div class="empty"><div class="empty-icon">!</div><strong>Pengesahan tidak dapat dibuka</strong><div style="margin-top:8px">${escapeHtml(readError(error))}</div></div>`;
        })
        .getWarisConfirmation(WARIS_TOKEN);
    }

    function renderWaris(data) {
      const target = document.getElementById('warisContent');
      if (data.alreadyConfirmed) {
        target.innerHTML = `<div class="success-card"><div class="success-icon">✓</div><h2>Pengesahan Telah Lengkap</h2><p>Rekod ${escapeHtml(data.noRujukan)} telah disahkan oleh waris dan tandatangan telah dikunci.</p><p><strong>${escapeHtml(data.confirmedAt || '')}</strong></p></div>`;
        return;
      }

      target.innerHTML = `
        <div class="detail-grid" style="margin-bottom:18px">
          ${detailHtml('No. Rujukan', data.noRujukan)}${detailHtml('No. Matrik', data.noMatrik)}${detailHtml('Nama Pelatih', data.namaPelatih, true)}${detailHtml('Program', data.program, true)}${detailHtml('Tahun / Semester', `${data.tahunPengajian} · ${data.semester}`, true)}${detailHtml('Tempoh Bermalam', `${data.tarikhKeluar} hingga ${data.tarikhKembali}`, true)}${detailHtml('Alamat Bermalam', data.alamatBermalam, true)}
        </div>
        <form id="warisForm"><div class="form-grid">
          <div class="field"><label>Nama Waris / Penjaga</label><input id="warisNama" type="text" value="${escapeAttr(data.namaWaris || '')}" required></div>
          <div class="field"><label>Hubungan Dengan Pelatih</label><input id="warisHubungan" type="text" value="${escapeAttr(data.hubunganWaris || '')}" required></div>
          <div class="field full"><label>No. Telefon Waris</label><input id="warisTel" type="tel" inputmode="tel" value="${escapeAttr(data.telWaris || '')}" required></div>
          <div class="field full"><label>Lokasi Semasa Pengesahan <span style="color:var(--muted);font-weight:500">(Pilihan)</span></label><div class="location-box"><p>Lokasi digunakan sebagai maklumat sokongan pengesahan. Waris boleh meneruskan tanpa berkongsi lokasi.</p><div class="record-actions"><button class="btn btn-blue" id="locationBtn" type="button">GUNAKAN LOKASI SEMASA</button></div><div class="location-result" id="locationResult">Lokasi belum diminta.</div></div></div>
          <div class="field full"><label>Tandatangan Waris</label><div class="signature-wrap"><canvas id="signatureCanvas"></canvas><div class="signature-help"><span>Tandatangan menggunakan jari atau tetikus.</span><button class="btn" id="clearSignature" type="button" style="min-height:30px;padding:0 10px;color:#334155;background:#e2e8f0">PADAM</button></div></div></div>
          <div class="field full"><div class="check-row"><input id="warisAkuan" type="checkbox"><label for="warisAkuan">Saya mengesahkan bahawa pelatih yang dinyatakan di atas telah tiba dan berada di alamat bermalam seperti yang dinyatakan dalam permohonan e-SO.</label></div></div>
        </div><div class="submit-row"><button class="btn btn-primary" id="warisSubmit" type="submit">SAHKAN PENGESAHAN</button></div></form>`;

      setupSignaturePad();
      document.getElementById('locationBtn').addEventListener('click', requestLocation);
      document.getElementById('warisForm').addEventListener('submit', submitWaris);
    }

    function setupSignaturePad() {
      const canvas = document.getElementById('signatureCanvas');
      const ctx = canvas.getContext('2d');
      signature = { canvas, ctx, drawing: false, hasInk: false };

      function resize() {
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const snapshot = signature.hasInk ? canvas.toDataURL('image/png') : null;
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 2.25;
        if (snapshot) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
          img.src = snapshot;
        }
      }

      resize();
      window.addEventListener('resize', resize, { passive: true });

      function point(event) {
        const rect = canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
      }

      canvas.addEventListener('pointerdown', event => {
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        signature.drawing = true;
        const p = point(event);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      });

      canvas.addEventListener('pointermove', event => {
        if (!signature.drawing) return;
        event.preventDefault();
        const p = point(event);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        signature.hasInk = true;
      });

      ['pointerup', 'pointercancel', 'pointerleave'].forEach(name => canvas.addEventListener(name, () => { signature.drawing = false; ctx.closePath(); }));
      document.getElementById('clearSignature').addEventListener('click', () => {
        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        signature.hasInk = false;
      });
    }

    function requestLocation() {
      const result = document.getElementById('locationResult');
      if (!navigator.geolocation) {
        state.location.statusLokasi = 'TIDAK_DIMINTA';
        result.textContent = 'Peranti ini tidak menyokong perkongsian lokasi.';
        return;
      }

      result.textContent = 'Mendapatkan lokasi...';
      navigator.geolocation.getCurrentPosition(
        position => {
          state.location = { latitude: position.coords.latitude, longitude: position.coords.longitude, statusLokasi: 'DIBENARKAN' };
          result.textContent = `Lokasi diterima: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
        },
        () => {
          state.location = { latitude: '', longitude: '', statusLokasi: 'DITOLAK' };
          result.textContent = 'Kebenaran lokasi tidak diberikan. Pengesahan masih boleh diteruskan.';
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }

    function submitWaris(event) {
      event.preventDefault();
      if (!signature || !signature.hasInk) { showToast('Tandatangan waris diperlukan.', 'error'); return; }
      if (!document.getElementById('warisAkuan').checked) { showToast('Sila sahkan pengakuan waris.', 'error'); return; }

      let base64;
      try { base64 = compactSignatureBase64(); }
      catch (error) { showToast(error.message, 'error'); return; }

      const button = document.getElementById('warisSubmit');
      setButtonLoading(button, true, 'MEREKOD...');

      EsoApi.run
        .withSuccessHandler(result => {
          setButtonLoading(button, false, 'SAHKAN PENGESAHAN');
          document.getElementById('warisContent').innerHTML = `<div class="success-card"><div class="success-icon">✓</div><h2>Pengesahan Berjaya</h2><p>${escapeHtml(result.message)}</p><p>No. Rujukan: <strong>${escapeHtml(result.noRujukan)}</strong><br>${escapeHtml(result.confirmedAt)}</p></div>`;
        })
        .withFailureHandler(error => { setButtonLoading(button, false, 'SAHKAN PENGESAHAN'); showToast(readError(error), 'error'); })
        .submitWarisConfirmation({
          warisToken: WARIS_TOKEN,
          namaWaris: valueOf('warisNama'),
          hubunganWaris: valueOf('warisHubungan'),
          telWaris: valueOf('warisTel'),
          pengakuan: true,
          signatureBase64: base64,
          latitude: state.location.latitude,
          longitude: state.location.longitude,
          statusLokasi: state.location.statusLokasi
        });
    }

    function compactSignatureBase64() {
      const source = signature.canvas;
      const ctx = source.getContext('2d');
      const image = ctx.getImageData(0, 0, source.width, source.height);
      const data = image.data;
      let minX = source.width, minY = source.height, maxX = 0, maxY = 0, found = false;

      for (let y = 0; y < source.height; y += 2) {
        for (let x = 0; x < source.width; x += 2) {
          const alpha = data[(y * source.width + x) * 4 + 3];
          if (alpha > 10) {
            found = true;
            minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          }
        }
      }
      if (!found) throw new Error('Tandatangan tidak dikesan.');

      const padding = 18 * Math.max(window.devicePixelRatio || 1, 1);
      minX = Math.max(0, minX - padding); minY = Math.max(0, minY - padding);
      maxX = Math.min(source.width, maxX + padding); maxY = Math.min(source.height, maxY + padding);
      const cropW = Math.max(1, maxX - minX); const cropH = Math.max(1, maxY - minY);

      const output = document.createElement('canvas');
      output.width = 360; output.height = 120;
      const out = output.getContext('2d');
      out.clearRect(0, 0, output.width, output.height);
      const scale = Math.min((output.width - 24) / cropW, (output.height - 18) / cropH);
      const drawW = cropW * scale, drawH = cropH * scale;
      out.drawImage(source, minX, minY, cropW, cropH, (output.width - drawW) / 2, (output.height - drawH) / 2, drawW, drawH);

      const base64 = output.toDataURL('image/png').split(',')[1];
      if (base64.length > 45000) throw new Error('Saiz tandatangan terlalu besar. Sila padam dan tandatangan semula dengan lebih ringkas.');
      return base64;
    }

    function recordsHtml(records, options = {}) {
      if (!records || !records.length) return emptyHtml('▤', 'Tiada rekod', 'Belum ada rekod untuk kategori ini.');
      return `<div class="record-list">${records.map(r => recordCardHtml(r, options)).join('')}</div>`;
    }

    function recordCardHtml(r, options = {}) {
      const actions = [`<button class="btn" type="button" data-action="detail" data-id="${escapeAttr(r.idPermohonan)}">BUTIRAN</button>`];

      if (state.role === 'PELATIH') {
        if (r.status === 'DILULUSKAN') {
          actions.push(`<button class="btn btn-primary" type="button" data-action="securityPass" data-id="${escapeAttr(r.idPermohonan)}">CETAK PASS e-SO</button>`);
          actions.push(`<button class="btn btn-primary" type="button" data-action="selfCheckout" data-id="${escapeAttr(r.idPermohonan)}">REKOD KELUAR</button>`);
        }

        if (
          ['DI_LUAR', 'TUNGGU_WARIS', 'DISAHKAN_WARIS', 'LEWAT'].includes(r.status)
        ) {
          actions.push(`<button class="btn btn-blue" type="button" data-action="securityPass" data-id="${escapeAttr(r.idPermohonan)}">CETAK SEMULA PASS</button>`);
        }

        if (
          r.adaTokenWaris &&
          ['DI_LUAR', 'TUNGGU_WARIS', 'DISAHKAN_WARIS', 'LEWAT'].includes(r.status)
        ) {
          actions.push(`<button class="btn btn-blue" type="button" data-action="waris" data-id="${escapeAttr(r.idPermohonan)}">PAUTAN WARIS</button>`);
        }

        if (
          ['DI_LUAR', 'TUNGGU_WARIS', 'DISAHKAN_WARIS', 'LEWAT'].includes(r.status)
        ) {
          actions.push(`<button class="btn btn-primary" type="button" data-action="selfReturn" data-id="${escapeAttr(r.idPermohonan)}">KEMBALI KE KOLEJ</button>`);
        }

        if (r.status === 'TUNGGU_PENGESAHAN_KEMBALI') {
          actions.push(`<button class="btn" type="button" disabled>MENUNGGU PENGESAHAN ADMIN</button>`);
        }
      } else {
        if (state.role === 'ADMIN' &&
            ['PEGAWAI_BERTUGAS', 'SUPER_ADMIN'].includes(String(state.user.peranan || '').toUpperCase()) &&
            r.canCancel === true &&
            ['DRAFT', 'MENUNGGU', 'MENUNGGU_SOKONGAN', 'DISOKONG', 'TIDAK_DISOKONG', 'DITOLAK', 'DILULUSKAN'].includes(r.status)) {
          actions.push(`<button class="btn btn-red" type="button" data-action="cancel" data-id="${escapeAttr(r.idPermohonan)}">BATALKAN PERMOHONAN</button>`);
        }

        if (r.status === 'MENUNGGU_SOKONGAN' && ['PENYELIA_HOSTEL','PEGAWAI_BERTUGAS'].includes(String(state.user.peranan || '').toUpperCase())) {
          actions.push(`<button class="btn btn-green" type="button" data-action="support" data-id="${escapeAttr(r.idPermohonan)}">SOKONG</button>`);
          actions.push(`<button class="btn btn-red" type="button" data-action="notSupport" data-id="${escapeAttr(r.idPermohonan)}">TIDAK SOKONG</button>`);
        }
        if (r.status === 'DISOKONG' && String(state.user.peranan || '').toUpperCase() === 'SUPER_ADMIN') {
          actions.push(`<button class="btn btn-green" type="button" data-action="approveFinal" data-id="${escapeAttr(r.idPermohonan)}">LULUS</button>`);
          actions.push(`<button class="btn btn-red" type="button" data-action="rejectFinal" data-id="${escapeAttr(r.idPermohonan)}">TOLAK</button>`);
        }
        if (r.status === 'DILULUSKAN') {
          actions.push(`<button class="btn btn-blue" type="button" data-action="keluar" data-id="${escapeAttr(r.idPermohonan)}">REKOD KELUAR</button>`);
          if (r.adaTokenWaris) actions.push(`<button class="btn" type="button" data-action="waris" data-id="${escapeAttr(r.idPermohonan)}">PAUTAN WARIS</button>`);
        }
        if (['DI_LUAR', 'TUNGGU_WARIS', 'DISAHKAN_WARIS', 'LEWAT', 'TUNGGU_PENGESAHAN_KEMBALI'].includes(r.status)) {
          actions.push(`<button class="btn btn-green" type="button" data-action="kembali" data-id="${escapeAttr(r.idPermohonan)}">${r.status === 'TUNGGU_PENGESAHAN_KEMBALI' ? 'SAHKAN KEMBALI PELATIH' : 'SAHKAN KEMBALI'}</button>`);
          if (r.adaTokenWaris && r.status !== 'TUNGGU_PENGESAHAN_KEMBALI') actions.push(`<button class="btn" type="button" data-action="waris" data-id="${escapeAttr(r.idPermohonan)}">PAUTAN WARIS</button>`);
        }
      }

      const isOutsideBulk = options.bulkType === 'outsideReturn';
      const checkedAttr = isOutsideBulk && state.selectedOutsideRecordIds && state.selectedOutsideRecordIds.has(r.idPermohonan) ? ' checked' : '';
      const selectableHtml = options.selectable
        ? `<label class="bulk-check-wrap" title="Pilih permohonan"><input type="checkbox" data-bulk-check="${escapeAttr(options.bulkType || '')}" value="${escapeAttr(r.idPermohonan)}"${checkedAttr}></label>`
        : '';

      return `<article class="record ${options.selectable ? 'selectable' : ''}">
        ${selectableHtml}
        <div class="record-top"><div><strong>${escapeHtml(r.nama || state.user.nama || '-')}</strong><div class="ref">${escapeHtml(r.noRujukan)}</div></div><span class="status-badge s-${escapeAttr(r.status)}">${escapeHtml(statusLabel(r.status))}</span></div>
        <div class="record-meta"><div>Keluar: <b>${escapeHtml(r.tarikhKeluar)} · ${escapeHtml(r.masaKeluar)}</b></div><div>Kembali: <b>${escapeHtml(r.tarikhKembali)} · ${escapeHtml(r.masaKembali)}</b></div><div>Tujuan: <b>${escapeHtml(labelCode(r.tujuan))}</b></div><div>Semester: <b>${escapeHtml(`${r.tahunPengajian} ${r.semester}`)}</b></div></div>
        ${state.role === 'ADMIN' ? monthlyMovementHtml(r) : ''}
        ${actions.length ? `<div class="record-actions">${actions.join('')}</div>` : ''}
      </article>`;
    }

    function recordDetailsHtml(r) {
      return `<div class="detail-grid">
        ${detailHtml('No. Rujukan', r.noRujukan)}${detailHtml('Status', statusLabel(r.status))}${detailHtml('Nama Pelatih', r.nama, true)}${detailHtml('No. Matrik', r.noMatrik)}${detailHtml('Tahun / Semester', `${r.tahunPengajian} · ${r.semester}`)}${detailHtml('Program', r.program, true)}${detailHtml('Keluar', `${r.tarikhKeluar} · ${r.masaKeluar}`)}${detailHtml('Jangka Kembali', `${r.tarikhKembali} · ${r.masaKembali}`)}${detailHtml('Tujuan', `${labelCode(r.tujuan)}${r.catatanTujuan ? ' — ' + r.catatanTujuan : ''}`, true)}${detailHtml('Alamat Bermalam', r.alamatBermalam, true)}${detailHtml('Pengangkutan', labelCode(r.pengangkutan), true)}${detailHtml('Waris', `${r.namaWaris} · ${r.hubunganWaris} · ${r.telWaris}`, true)}${r.catatanPegawai ? detailHtml('Catatan Pegawai', r.catatanPegawai, true) : ''}
      </div>`;
    }

    function statusOrbHtml(status) {
      const map = {
        DALAM_HOSTEL: ['var(--green)', 'rgba(34,197,94,.12)'],
        MENUNGGU_SEMAKAN: ['var(--amber)', 'rgba(245,158,11,.12)'],
        DI_LUAR: ['var(--sky)', 'rgba(56,189,248,.12)'],
        MENUNGGU_PENGESAHAN_KEMBALI: ['var(--violet)', 'rgba(167,139,250,.12)'],
        LEWAT_KEMBALI: ['var(--red)', 'rgba(239,68,68,.12)']
      };
      const color = map[status] || map.DALAM_HOSTEL;
      return `<div class="status-orb"><span class="status-dot" style="background:${color[0]};box-shadow:0 0 0 8px ${color[1]}"></span><strong>${escapeHtml(statusLabel(status))}</strong><span>Status semasa pelatih</span></div>`;
    }

    function kpiHtml(label, value, note, type = '') { return `<article class="kpi ${escapeAttr(type)}"><span>${escapeHtml(label)}</span><strong>${Number(value) || 0}</strong><small>${escapeHtml(note)}</small></article>`; }
    function profileItem(label, value) { return `<div class="profile-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '-')}</strong></div>`; }
    function detailHtml(label, value, full = false) { return `<div class="detail ${full ? 'full' : ''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '-')}</strong></div>`; }
    function emptyHtml(icon, title, text) { return `<div class="empty"><div class="empty-icon">${icon}</div><strong>${escapeHtml(title)}</strong><div style="margin-top:7px">${escapeHtml(text)}</div></div>`; }
    function optionList(items) { return (items || []).map(item => `<option value="${escapeAttr(item.kod)}">${escapeHtml(item.label)}</option>`).join(''); }

    function labelCode(code) {
      const all = [...(state.settings.tujuan || []), ...(state.settings.pengangkutan || [])];
      const found = all.find(item => item.kod === code);
      return found ? found.label : statusLabel(code);
    }


    function monthlyMovementHtml(record) {
      const info = record.monthlyMovement;
      if (!info || !info.monthLabel) return '';
      const dates = info.dates || [];
      const list = dates.length
        ? `<ul>${dates.map(item => `<li class="${item.isCurrent ? 'current' : ''}">${escapeHtml(item.tarikhKeluar || '-')} ${escapeHtml(item.masaKeluar || '')} · ${escapeHtml(item.noRujukan || '-')} · ${escapeHtml(statusLabel(item.status))}${item.isCurrent ? ' · Permohonan ini' : ''}</li>`).join('')}</ul>`
        : '<div class="muted">Tiada sejarah bulan ini.</div>';
      const kaliText = `${info.count || 0}/${info.limit || 2}`;
      const warning = (info.count || 0) > (info.limit || 2) ? ' · Melebihi had biasa, perlu alasan kukuh' : '';
      return `<div class="monthly-movement ${(info.count || 0) > (info.limit || 2) ? 'danger' : ''}">
        <strong>Rekod bermalam bulan ${escapeHtml(info.monthLabel)}: ${escapeHtml(kaliText)} kali${warning}</strong>
        ${list}
      </div>`;
    }

    function statusLabel(code) {
      const labels = {
        DRAFT: 'Draf', MENUNGGU: 'Menunggu Semakan', MENUNGGU_SOKONGAN: 'Menunggu Sokongan', DISOKONG: 'Disokong — Menunggu Kelulusan', TIDAK_DISOKONG: 'Tidak Disokong', BELUM_DISOKONG: 'Belum Disokong', BELUM_DILULUSKAN: 'Belum Diluluskan', DILULUSKAN: 'Diluluskan', DITOLAK: 'Ditolak', DI_LUAR: 'Di Luar Kolej', TUNGGU_WARIS: 'Menunggu Pengesahan Waris', DISAHKAN_WARIS: 'Disahkan Waris', TUNGGU_PENGESAHAN_KEMBALI: 'Menunggu Pengesahan Admin', KEMBALI: 'Telah Kembali', LEWAT: 'Lewat Kembali', SELESAI: 'Selesai', DIBATALKAN: 'Dibatalkan', DALAM_HOSTEL: 'Dalam Kolej', MENUNGGU_SEMAKAN: 'Permohonan Dalam Semakan', LEWAT_KEMBALI: 'Lewat Kembali'
      };
      return labels[code] || String(code || '').replace(/_/g, ' ');
    }

    function findClientRecord(id) {
      const sources = state.role === 'PELATIH' ? [state.data.applications || []] : [state.data.activeForCancellation || [], state.data.pendingSupport || [], state.data.pendingApproval || [], state.data.notSupported || [], state.data.approved || [], state.data.pendingReturn || [], state.data.geoWarnings || [], state.data.outside || [], state.data.late || [], state.data.all || []];
      for (const source of sources) {
        const found = source.find(item => item.idPermohonan === id);
        if (found) return found;
      }
      return null;
    }

    function openModal() { document.getElementById('modal').classList.remove('hidden'); }
    function closeModal() { document.getElementById('modal').classList.add('hidden'); }
    document.getElementById('modal').addEventListener('click', event => { if (event.target.id === 'modal') closeModal(); });

    function logoutApp() {
      const token = state.sessionToken;
      stopLiveSyncTimer();
      state.liveSync.enabled = false;
      clearEsoSession_();
      EsoApi.run.withSuccessHandler(redirectLogin).withFailureHandler(redirectLogin).logout(token);
    }

    function redirectLogin() {
      clearEsoSession_();
      const base = APP_URL || window.location.href.split('?')[0];
      const separator = base.indexOf('?') === -1 ? '?' : '&';
      const target = base + separator + 'reset=1&t=' + Date.now();

      try {
        window.open(target, '_top');
        return;
      } catch (error) {}

      try {
        window.top.location.href = target;
        return;
      } catch (error) {}

      window.location.href = target;
    }

    function setButtonLoading(button, loading, label) {
      if (!button) return;
      button.disabled = loading;
      button.innerHTML = loading ? `<span class="loader-ring" style="width:16px;height:16px;border-width:2px;display:inline-block;margin:0 7px -3px 0"></span>${escapeHtml(label)}` : escapeHtml(label);
    }

    function valueOf(id) { const element = document.getElementById(id); return element ? element.value.trim() : ''; }
    function readError(error) { const message = error && error.message ? error.message : String(error || 'Ralat tidak diketahui.'); return message.replace(/^Exception:\s*/i, ''); }

    function showToast(message, type = '') {
      const toast = document.getElementById('toast');
      clearTimeout(toastTimer);
      toast.textContent = message;
      toast.className = `toast show ${type}`;
      toastTimer = setTimeout(() => toast.classList.remove('show'), 4600);
    }

    async function copyText(text) {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return; }
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#096;'); }
  
      window.logoutApp = logoutApp;
      window.closeModal = closeModal;
    })();
  } else {
    (function () {


    function cleanIcForLogin_(value) {
      return String(value || '').replace(/\D/g, '').slice(0, 12);
    }

    function saveEsoSession_(token, role) {
      let saved = false;
      try {
        sessionStorage.setItem('erblSession', token);
        sessionStorage.setItem('erblRole', role || '');
        saved = sessionStorage.getItem('erblSession') === token;
      } catch (error) {}
      try {
        localStorage.setItem('erblSession', token);
        localStorage.setItem('erblRole', role || '');
        saved = localStorage.getItem('erblSession') === token || saved;
      } catch (error) {}
      return saved;
    }

    function clearEsoSession_() {
      try {
        sessionStorage.removeItem('erblSession');
        sessionStorage.removeItem('erblRole');
      } catch (error) {}

      try {
        localStorage.removeItem('erblSession');
        localStorage.removeItem('erblRole');
      } catch (error) {}
    }

    function shouldResetSessionFromUrl_() {
      try {
        const params = new URLSearchParams(window.location.search || '');
        return params.get('reset') === '1' || params.get('expired') === '1';
      } catch (error) {
        return false;
      }
    }


    if (new URLSearchParams(window.location.search).has('waris')) {
      window.location.replace(new URL('./app.html' + window.location.search, window.location.href).href);
    }

    const APP_URL = new URL('./index.html', window.location.href).href;

    function buildAppUrl_(rawBase, result) {
      // Frontend dan dashboard berada pada domain yang sama; token kekal dalam storage.
      return new URL('./index.html?app=1', window.location.href).href;
    }

    function goToApp_(rawBase) {
      const targetUrl = buildAppUrl_(rawBase);

      // Apps Script HTML Service berjalan dalam iframe.
      // Jangan guna window.location.assign() dahulu kerana Chrome boleh cuba
      // membuka script.google.com di dalam iframe dan menghasilkan
      // "script.google.com refused to connect".
      try {
        window.open(targetUrl, '_top');
        return;
      } catch (error) {}

      try {
        const link = document.createElement('a');
        link.href = targetUrl;
        link.target = '_top';
        link.rel = 'noopener';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        return;
      } catch (error) {}

      try {
        window.top.location.href = targetUrl;
        return;
      } catch (error) {}

      // Fallback terakhir sahaja. Ini mungkin tidak sesuai untuk iframe,
      // tetapi dikekalkan sekiranya browser tidak menyokong _top.
      try {
        window.location.href = targetUrl;
        return;
      } catch (error) {}

      showToast('Login berjaya. Jika paparan utama tidak terbuka, sila refresh atau buka semula aplikasi.', 'success');
    }



    const tabs = document.querySelectorAll('.tab');
    const adminPanel = document.getElementById('adminPanel');
    const pelatihPanel = document.getElementById('pelatihPanel');
    const accessText = document.getElementById('accessText');
    const toast = document.getElementById('toast');
    let toastTimer;

    document.addEventListener('DOMContentLoaded', () => {
      if (shouldResetSessionFromUrl_()) {
        clearEsoSession_();
        setTimeout(() => {
          showToast('Sesi lama telah dibersihkan. Sila log masuk semula.', 'success');
        }, 250);
      }
    });

    function switchTab(tabName) {
      tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
      adminPanel.classList.toggle('active', tabName === 'admin');
      pelatihPanel.classList.toggle('active', tabName === 'pelatih');
      accessText.textContent = tabName === 'admin' ? 'Akses Admin / Penyelaras' : 'Akses Pelatih e-SO';
    }

    tabs.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

    document.getElementById('passwordToggle').addEventListener('click', () => {
      const input = document.getElementById('adminPassword');
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('noIc').addEventListener('input', event => {
      event.target.value = event.target.value.replace(/\D/g, '').slice(0, 12);
    });

    document.getElementById('noMatrik').addEventListener('input', event => {
      event.target.value = event.target.value.toUpperCase();
    });

    adminPanel.addEventListener('submit', event => {
      event.preventDefault();
      const button = document.getElementById('adminSubmit');
      setLoading(button, true);

      EsoApi.run
        .withSuccessHandler(result => handleLogin(result, button))
        .withFailureHandler(error => handleError(error, button))
        .loginAdmin({
          userId: document.getElementById('adminUser').value,
          password: document.getElementById('adminPassword').value
        });
    });

    pelatihPanel.addEventListener('submit', event => {
      event.preventDefault();
      const button = document.getElementById('pelatihSubmit');
      const noIc = document.getElementById('noIc').value;

      if (noIc.length !== 12) {
        showToast('No. Kad Pengenalan mesti 12 digit tanpa tanda "-".', 'error');
        return;
      }

      setLoading(button, true);

      EsoApi.run
        .withSuccessHandler(result => handleLogin(result, button))
        .withFailureHandler(error => handleError(error, button))
        .loginPelatih({
          semesterSheet: document.getElementById('semesterSheet').value,
          noMatrik: document.getElementById('noMatrik').value,
          noIc: noIc
        });
    });

    function showPostLoginContinue_(result) {
      const targetUrl = buildAppUrl_(result.appUrl || APP_URL, result);
      const box = document.getElementById('postLoginBox');
      const title = document.getElementById('postLoginTitle');
      const message = document.getElementById('postLoginMessage');
      const link = document.getElementById('continueAppLink');

      if (title) title.textContent = `✓ Login berjaya${result.nama ? ' — ' + result.nama : ''}`;
      if (message) message.textContent = 'Sila tekan butang di bawah untuk membuka Dashboard e-SO.';
      if (link) {
        link.href = targetUrl;
        link.onclick = function () {
          try { window.open(targetUrl, '_top'); return false; }
          catch (error) { return true; }
        };
      }
      if (box) {
        box.classList.add('show');
        try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (error) {}
      }
      return targetUrl;
    }


    function handleLogin(result, button) {
      setLoading(button, false);
      if (!result || !result.ok) {
        showToast('Log masuk tidak berjaya.', 'error');
        return;
      }

      if (!saveEsoSession_(result.token, result.role || '')) {
        showToast('Pelayar tidak dapat menyimpan sesi. Benarkan storan laman ini dan log masuk semula.', 'error');
        return;
      }
      showToast(`✓ Login berjaya. Selamat datang ${result.nama || ''}`, 'success');

      const targetUrl = showPostLoginContinue_(result);

      setTimeout(() => {
        try { window.open(targetUrl, '_top'); } catch (error) {}
      }, 900);
    }

    function handleError(error, button) {
      setLoading(button, false);
      showToast(readError(error), 'error');
    }

    function setLoading(button, loading) {
      button.disabled = loading;
      button.innerHTML = loading ? '<span class="spinner"></span>MENGESAHKAN...' : 'LOG MASUK';
    }

    function readError(error) {
      const message = error && error.message ? error.message : String(error || 'Ralat tidak diketahui.');
      return message.replace(/^Exception:\s*/i, '');
    }

    function showToast(message, type = '') {
      clearTimeout(toastTimer);
      toast.textContent = message;
      toast.className = `toast show ${type}`;
      toastTimer = setTimeout(() => toast.classList.remove('show'), 4300);
    }
  
    })();
  }
})();
