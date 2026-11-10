from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent
for source,dest in [('home.html','index.html'),('main.html','app.html')]:
 s=(root/'apps-script'/source).read_text()
 s=s.replace('    const APP_URL = <?!= JSON.stringify(appUrl) ?>;', "    const APP_URL = new URL('./index.html', window.location.href).href;")
 s=s.replace('    const INITIAL_MODE = <?!= JSON.stringify(appMode) ?>;', "    const INITIAL_MODE = new URLSearchParams(window.location.search).has('waris') ? 'WARIS' : 'APP';")
 s=s.replace('    const WARIS_TOKEN = <?!= JSON.stringify(warisToken) ?>;', "    const WARIS_TOKEN = new URLSearchParams(window.location.search).get('waris') || '';")
 s=s.replace('google.script.run','EsoApi.run')
 s=s.replace('  <base target="_top">', '  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n  <meta name="referrer" content="no-referrer">')
 s=s.replace('  <script>', '  <script src="./assets/config.js"></script>\n  <script src="./assets/api-client.js"></script>\n  <script>',1)
 if dest=='index.html':
  a=s.index('    function buildAppUrl_(');b=s.index('    function goToApp_',a)
  s=s[:a]+'''    function buildAppUrl_(rawBase, result) {
      // Frontend dan dashboard berada pada domain yang sama; token kekal dalam storage.
      return new URL('./app.html', window.location.href).href;
    }

'''+s[b:]
  # Redirect old-style parent links to the hosted guardian view.
  s=s.replace('    const APP_URL =', '''    if (new URLSearchParams(window.location.search).has('waris')) {
      window.location.replace(new URL('./app.html' + window.location.search, window.location.href).href);
    }

    const APP_URL =''',1)
 # Remove obsolete fallback token query consumption; authentication stays in same-origin storage.
 if dest=='app.html':
  a=s.index('    function readEsoSession_()');b=s.index('    function clearEsoSession_',a)
  s=s[:a]+'''    function readEsoSession_() {
      try {
        const token = sessionStorage.getItem('erblSession') || '';
        if (token) return { token, role: sessionStorage.getItem('erblRole') || '' };
      } catch (error) {}
      try {
        return { token: localStorage.getItem('erblSession') || '', role: localStorage.getItem('erblRole') || '' };
      } catch (error) { return { token: '', role: '' }; }
    }

'''+s[b:]
 if dest=='index.html':
  a=s.index('    function saveEsoSession_(');b=s.index('    function clearEsoSession_',a)
  s=s[:a]+"""    function saveEsoSession_(token, role) {
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

"""+s[b:]
  s=s.replace("      saveEsoSession_(result.token, result.role || '');","      if (!saveEsoSession_(result.token, result.role || '')) {\n        showToast('Pelayar tidak dapat menyimpan sesi. Benarkan storan laman ini dan log masuk semula.', 'error');\n        return;\n      }",1)
 (root/'public'/dest).write_text(s)
