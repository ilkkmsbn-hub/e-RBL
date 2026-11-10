e-SO — FRONTEND GITHUB PAGES + BACKEND GOOGLE APPS SCRIPT

Fail frontend:
index.html
config.js
README_SETUP.txt
assets/app.css
assets/app.js

Repository: https://github.com/ilkkmsbn-hub/e-RBL
Laman: https://ilkkmsbn-hub.github.io/e-RBL/

Letakkan LIMA fail ini (termasuk folder assets) terus di ROOT repository, bukan di dalam public/.
Di GitHub > Settings > Pages, pilih Deploy from a branch > main > / (root).

Backend juga WAJIB dikemas kini: tambah github_bridge.gs, tambah bridge.html dan tambah cabang bridge pada doGet dalam code.gs. Semua langkah ada dalam PANDUAN_PASANG.txt di root pakej.
URL Apps Script anda telah dimasukkan ke dalam config.js. Tiada apiUrl ./api, Cloudflare, Worker, relay, API secret atau JSON fetch diperlukan.

Alamat:
Login: https://ilkkmsbn-hub.github.io/e-RBL/index.html
Dashboard: https://ilkkmsbn-hub.github.io/e-RBL/index.html?app=1
Pengesahan waris: index.html?waris=TOKEN

Kekalkan fail home.html dan main.html asal dalam projek Apps Script. Ia tidak perlu dimuat naik ke GitHub.
Folder functions, netlify, relay, worker dan konfigurasi deployment lama tidak digunakan dalam versi ini. Folder itu boleh dibiarkan semasa pemasangan; tidak perlu dipadam untuk sambungan ini berfungsi.

Selepas mengemas kini Apps Script, deploy New version pada deployment /exec yang sama. Buka GitHub Pages dan muat semula tanpa cache.
Jika paparan masih memaparkan README, pastikan index.html berada di root repository dan deployment Pages telah selesai.
Jika sambungan Apps Script tamat masa, semak cabang doGet, nama fail bridge.html, deployment New version, akses Anyone dan sekatan iframe Workspace/pelayar.

Jangan masukkan kata laluan pentadbir atau nombor kad pengenalan sebenar dalam config.js atau GitHub.
