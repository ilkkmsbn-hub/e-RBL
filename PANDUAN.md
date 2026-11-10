# e-SO — Frontend Webhosting + Backend Apps Script

Pakej ini memindahkan halaman login dan dashboard ke hosting anda. Google Apps Script dan Google Sheets kekal sebagai backend dan pangkalan data. Jadual pembatalan, peringatan pelatih, laporan, pengesahan waris serta fungsi keluar/kembali dikekalkan.

Aliran: **pelayar → relay API → Apps Script `doPost()` → Google Sheets**.

Relay hanya mengangkut dan menandatangani permintaan. Semua pengesahan sesi, semakan peranan dan logik transaksi kekal dalam fungsi Apps Script asal. Tiada pangkalan data baharu diperlukan. Relay tidak menyimpan data transaksi.

## Pilihan hosting

| Pilihan | Frontend | Relay |
| --- | --- | --- |
| Cloudflare Pages (cadangan) | `public/` | `functions/api.js` pada projek sama |
| Netlify | `public/` | `netlify/functions/api.mjs` pada projek sama |
| GitHub Pages | kandungan `public/` sahaja | Cloudflare Worker berasingan, `worker/index.mjs` |

GitHub Pages tidak boleh menjalankan fungsi API. Oleh itu ia memerlukan Worker berasingan. Jangan menggunakan `fetch(..., {mode: 'no-cors'})`: pelayar tidak akan dapat membaca jawapan transaksi. Pakej ini menggunakan relay untuk mengelakkan masalah tersebut.

## 1. Simpan sandaran

Simpan salinan projek Apps Script dan spreadsheet sebelum pemasangan. Pakej ini dibina daripada versi **jadual pembatalan aktif** terakhir. Jika anda telah mengubah fungsi lain selepas versi itu, gabungkan perubahan tersebut dahulu.

Kod normalisasi nombor matrik dan format penyimpanannya tidak diubah. Pembetulan data matrik yang anda buat dalam spreadsheet kekal diperlukan.

## 2. Sediakan Apps Script

1. Dalam projek Apps Script yang terikat kepada spreadsheet e-SO sedia ada, gunakan `apps-script/code.gs` sebagai kod backend lengkap. Kandungannya sama dengan versi jadual pembatalan aktif terakhir.
2. Tambah fail skrip baharu bernama `api` dan salin kandungan `apps-script/api.gs`. Pastikan hanya ada **satu** fungsi `doPost()` dalam projek.
3. Kekalkan fail HTML asal `home` dan `main` dalam Apps Script. Salinannya disertakan dalam `apps-script/`. Fail tersebut membolehkan halaman Apps Script lama terus berfungsi jika diperlukan; frontend baharu menggunakan fail berbeza dalam `public/`.
4. Buka **Project Settings → Script properties**. Tambah:

   | Property | Nilai |
   | --- | --- |
   | `GAS_API_SECRET` | Rahsia rawak sekurang-kurangnya 32 aksara. Gunakan nilai sama pada relay. |
   | `FRONTEND_APP_URL` | URL penuh dashboard baharu, contohnya `https://eso-anda.pages.dev/app.html` |

   `FRONTEND_APP_URL` mesti HTTPS, berakhir dengan `/app.html`, dan tiada query string atau fragment.
5. Cipta rahsia menggunakan pengurus kata laluan atau jalankan pada komputer sendiri: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Simpan secara peribadi; jangan masukkan ke dalam fail frontend, Git atau chat.
6. **Deploy → Manage deployments → Edit → New version → Deploy**. Jika belum ada deployment web app, pilih **New deployment → Web app**.
7. Tetapkan **Execute as: Me** dan **Who has access: Anyone** supaya relay boleh memanggil endpoint tanpa halaman login Google. API `doPost()` tetap memerlukan tandatangan rahsia dan sesi aplikasi untuk tindakan terlindung.
8. Salin URL deployment yang berakhir dengan `/exec`. Jangan gunakan URL `/dev`, URL editor Apps Script atau URL Google Sheets.

Konfigurasi `FRONTEND_APP_URL` boleh diisi selepas URL hosting diketahui. API akan memulangkan mesej konfigurasi sehingga kedua-dua property ditetapkan. Menukar Script properties tidak memerlukan perubahan kod; perubahan fail skrip memerlukan deployment versi baharu.

## 3A. Cloudflare Pages

1. Masukkan kandungan pakej sebagai root sebuah repository peribadi. Jangan commit sebarang rahsia.
2. Cipta projek Cloudflare Pages menggunakan integrasi Git.
3. Pilih **Framework preset: None**. Build command boleh dikosongkan; build output directory ialah **`public`**. Root directory ialah root pakej ini.
4. Folder `functions/` dan `relay/` mesti kekal di root projek, bersebelahan dengan `public/`.
5. Dalam tetapan environment/variables projek Pages, tambah untuk environment Production:

   | Nama | Nilai |
   | --- | --- |
   | `GAS_WEB_APP_URL` | URL Apps Script `/exec` |
   | `GAS_API_SECRET` | Rahsia yang sama seperti Script properties; simpan sebagai secret/encrypted |

6. Deploy/redeploy projek selepas environment disediakan.
7. Isi `FRONTEND_APP_URL` dalam Script properties dengan URL sebenar seperti `https://nama-projek.pages.dev/app.html`.
8. Buka `https://nama-projek.pages.dev/`. `public/assets/config.js` boleh dikekalkan dengan `apiUrl: './api'`.

Gunakan deployment Git atau Wrangler yang menyokong Pages Functions. Memuat naik folder `public/` sahaja melalui drag-and-drop tidak menyediakan relay API.

Jika menggunakan domain sendiri, kemas kini `FRONTEND_APP_URL` kepada domain tersebut. Pautan waris baharu akan menggunakan domain itu.

## 3B. Netlify

1. Import repository yang mengandungi keseluruhan pakej.
2. Fail `netlify.toml` sudah menetapkan publish directory `public`, fungsi dalam `netlify/functions`, dan laluan `/api`.
3. Tambah environment variables `GAS_WEB_APP_URL` dan `GAS_API_SECRET` pada Netlify. Rahsia mesti sama dengan Apps Script; jangan tambah ke frontend.
4. Deploy/redeploy. Tetapkan `FRONTEND_APP_URL` dalam Script properties kepada `https://nama-laman.netlify.app/app.html`.
5. Kekalkan `apiUrl: './api'` dalam `public/assets/config.js`.

Gunakan deployment repository/build yang membundel Functions. Memuat naik fail statik sahaja tidak mencipta relay.

## 3C. GitHub Pages + Cloudflare Worker

1. Deploy relay Worker daripada root pakej dengan `wrangler.toml` dan entry `worker/index.mjs`. Worker turut mengimport `relay/handler.mjs`; jangan muat naik entry sahaja tanpa membundelnya.
2. Dalam environment Worker, tetapkan:

   | Nama | Nilai |
   | --- | --- |
   | `GAS_WEB_APP_URL` | URL Apps Script `/exec` |
   | `GAS_API_SECRET` | Secret yang sama seperti Apps Script |
   | `ALLOWED_ORIGINS` | Origin frontend, contohnya `https://nama-anda.github.io` |

   `ALLOWED_ORIGINS` tidak mengandungi laluan `/nama-repo/`. Jika perlu beberapa origin, pisahkan dengan koma. Jangan gunakan `*`.
3. Dalam `public/assets/config.js`, tukar `apiUrl` kepada URL Worker penuh seperti `https://eso-api-relay.nama-anda.workers.dev/`.
4. Terbitkan **kandungan `public/` sahaja** ke root laman GitHub Pages anda. Jangan terbitkan folder `apps-script/` atau keseluruhan pakej sebagai laman awam.
5. Tetapkan `FRONTEND_APP_URL` dalam Apps Script kepada URL penuh seperti `https://nama-anda.github.io/eso/app.html`.

Worker membenarkan preflight CORS untuk origin yang disenaraikan sahaja. Gunakan URL Worker terus, bukan URL Apps Script, dalam `config.js`.

## 4. Cara penggunaan

- Login pada `index.html`; dashboard dibuka pada `app.html` pada domain hosting yang sama.
- Token sesi disimpan dalam storan pelayar pada domain hosting. Token tidak dimasukkan ke URL login/dashboard. Pengguna perlu membenarkan storan laman.
- Sesi Apps Script kekal menggunakan mekanisme sedia ada: tempoh gelongsor sehingga enam jam; cache Google boleh menggugurkan sesi lebih awal dan pengguna perlu login semula.
- Pautan pengesahan waris yang dijana melalui API akan menunjuk ke `app.html?waris=...` pada hosting baharu.
- Pautan waris lama yang menunjuk ke Apps Script boleh terus digunakan selagi deployment lama dan fail HTML dikekalkan.
- Jadual pembatalan hanya untuk PEGAWAI_BERTUGAS dan SUPER_ADMIN. Syarat pelatih masih dalam kolej dan belum keluar disemak semula pada backend.
- Jika panggilan transaksi tamat masa, semak status melalui **REFRESH SEKARANG** dahulu. Permintaan mungkin telah diproses. Sistem tidak menghantar semula transaksi secara automatik.

## 5. Ujian pemasangan sebenar

1. Login pelatih: dashboard dan peringatan pembatalan muncul.
2. Hantar satu permohonan ujian dan pastikan ia muncul sebagai Menunggu Sokongan. Semak juga spreadsheet.
3. Login pegawai: semak senarai sokongan dan jadual pembatalan.
4. Sokong dan luluskan permohonan ujian menggunakan peranan yang betul.
5. Uji pembatalan bagi permohonan lain yang belum keluar; pastikan rekod dipadam dan log wujud.
6. Uji Rekod Keluar, pautan waris, tandatangan waris, Kembali Ke Kolej dan pengesahan kembali menggunakan rekod ujian yang sesuai.
7. Cuba pembatalan selepas keluar: backend mesti menyekatnya.
8. Semak cetakan pass/laporan, paparan telefon, GPS dan logout.

Penggunaan GPS memerlukan HTTPS dan kebenaran lokasi pada pelayar. Pelan hosting/relay mempunyai had penggunaan dan masa pelaksanaan; operasi Apps Script yang lama masih boleh tamat masa. Memindahkan frontend tidak menghapuskan kuota atau kelambatan backend Apps Script/Sheets.

## Penyelesaian masalah

| Mesej/gejala | Semakan |
| --- | --- |
| API tidak memulangkan JSON | Laluan `/api`/fungsi relay telah dideploy; Apps Script mengandungi `api.gs` dan deployment versi terbaharu dengan akses Anyone. |
| Pengesahan relay API gagal | `GAS_API_SECRET` pada relay dan Script properties mesti sama tepat tanpa ruang tambahan. |
| Domain frontend tidak dibenarkan | Tetapkan `ALLOWED_ORIGINS` pada Worker kepada origin hosting sebenar, termasuk `https://`. |
| Ralat `FRONTEND_APP_URL` | Gunakan URL dashboard sebenar yang berakhir `/app.html`. |
| Sesi tamat / kembali ke login | Login semula pada domain hosting. Sesi daripada domain Apps Script tidak dipindahkan secara automatik. |
| Jadual pelatih tidak menemui rekod | Pastikan nilai nombor matrik dalam sheet semester dan transaksi sepadan, termasuk sifar di hadapan seperti yang anda betulkan sebelum ini. |
| Error 404 `/api` | Frontend statik telah dideploy tetapi Function/relay belum dibundel, atau `apiUrl` salah. |
| HTTP 502/504 atau timeout | Semak status terlebih dahulu; jangan ulang tindakan transaksi tanpa menyemak rekod sebenar. |

## Pembangunan dan pengesahan yang disertakan

- `npm test`: 37 ujian API/relay, tandatangan, sekatan tindakan, CORS, ralat dan sintaks frontend. Tiada dependency npm diperlukan untuk ujian ini.
- `npm run dev`: pratonton tempatan pada `http://localhost:8788`. Untuk menghubungi backend sebenar, tetapkan environment `GAS_WEB_APP_URL` dan `GAS_API_SECRET` pada proses Node terlebih dahulu. Rahsia tidak perlu ditulis ke fail.
- `tests/browser-smoke.mjs`: ujian integrasi Chromium/Playwright dengan backend simulasi. Memerlukan Playwright tersedia pada persekitaran ujian; `CHROMIUM_PATH` boleh digunakan untuk memilih executable Chromium yang telah dipasang.
- Ujian pelayar yang dijalankan mengesahkan aliran fetch sebenar melalui relay dan dispatcher Apps Script simulasi: login pelatih/admin, hantar permohonan, paparan status, pembatalan, logout, pautan waris dan sesi tamat.

Ujian setempat tidak menggunakan akaun Google, spreadsheet atau hosting produksi anda. Pakej belum dideploy ke hosting/Apps Script sebenar kerana URL deployment dan akses hosting belum diberikan.
