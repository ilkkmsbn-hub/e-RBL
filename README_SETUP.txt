e-SO — STRUKTUR FRONTEND RINGKAS

STRUKTUR
index.html
config.js
README_SETUP.txt
assets/
  app.css
  app.js

Pakej ini menggantikan folder public dalam pakej webhosting yang diberi sebelum ini.
Semua paparan menggunakan index.html:
- Login: index.html
- Dashboard: index.html?app=1
- Pengesahan waris: index.html?waris=TOKEN

1. Simpan sandaran frontend sedia ada.
2. Gantikan kandungan folder public dengan fail dalam pakej ini.
3. Kekalkan folder functions, relay, netlify, worker dan konfigurasi hosting daripada pakej terdahulu. Relay masih diperlukan; memuat naik frontend sahaja tidak menyediakan API.
4. Dalam config.js, gunakan apiUrl: './api' untuk Cloudflare Pages/Netlify dengan relay pada projek sama. Untuk GitHub Pages, gunakan URL penuh Worker yang telah disediakan.
5. Deploy/redeploy frontend dan relay melalui kaedah hosting yang sama seperti sebelum ini.
6. Backend Apps Script dan rahsia API tidak perlu diubah bagi menggunakan frontend ini. Fungsi pembatalan dan kawalan peranan kekal.
7. API terdahulu menghasilkan pautan waris berakhir app.html; frontend ini menukarnya kepada index.html sebelum dipaparkan/dikongsi. Pautan lama yang telah dikongsi dengan app.html perlu diganti kepada index.html dengan token yang sama. Jika perlu menyokong pautan lama secara automatik, sediakan redirect app.html ke index.html pada hosting anda.
8. Kosongkan cache/muat semula selepas deploy. Login, permohonan, pembatalan dan pengesahan waris perlu diuji pada hosting sebenar.

Jangan letakkan GAS_API_SECRET dalam config.js atau mana-mana fail frontend. Ia kekal pada relay dan Script properties Apps Script.

PANDUAN API/RELAY
Rujuk PANDUAN.md dalam e-SO_webhosting_frontend_API.zip yang telah diberikan sebelum ini untuk pemasangan backend dan relay pertama kali.
