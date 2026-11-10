e-LocalPreceptor — Neocities + Google Sheet Backend
===================================================

STRUKTUR
1. Neocities (frontend):
   index.html
   config.js
   assets/app.css
   assets/app.js

2. Google Apps Script (backend):
   Code.gs

3. Google Spreadsheet:
   Sheet utama: Data Local Preceptor
   Sheet Admin: Admin

LANGKAH A — GOOGLE APPS SCRIPT
1. Buka Google Spreadsheet e-LocalPreceptor.
2. Extensions > Apps Script.
3. Gantikan Code.gs dengan fail Code.gs dalam pakej ini.
4. Save.
5. Jalankan setupSystem() sekali dan beri permission Google.
6. Semak sheet Admin. Akaun contoh jika sheet Admin baharu ialah:
      USER_ID: admin
      PASSWORD: 1234
   TUKAR PASSWORD ini sebelum sistem digunakan.
7. Selepas password ditukar, jalankan hashAdminPasswords() sekali.
8. Deploy > New deployment > Web app.
9. Execute as: Me.
10. Who has access: Anyone (atau tetapan paling sesuai yang membolehkan frontend Neocities mengakses API tanpa login Google).
11. Deploy dan salin URL yang berakhir dengan /exec.

LANGKAH B — CONFIG.JS
Buka config.js dan ganti:
  API_URL: 'PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE'

dengan URL /exec tadi.

Contoh:
  API_URL: 'https://script.google.com/macros/s/XXXXXXXXXXXX/exec'

LANGKAH C — NEOCITIES
Upload dengan struktur folder yang sama:
  index.html
  config.js
  assets/app.css
  assets/app.js

Pastikan folder assets dikekalkan.

PRESTASI
- Public Search hanya mencari Nama, No. KP dan Tempat Bertugas.
- Admin memuatkan data sekali selepas login; carian/filter/pagination Admin berlaku terus dalam browser.
- Tambah/Edit/Sahkan/Padam hanya menulis perubahan yang diperlukan ke Google Sheet.
- setupSystem/repairImportedRows TIDAK berjalan setiap kali carian.

DATA BAHARU
- Jika Admin tambah melalui UI: metadata sistem dibuat automatik.
- Jika data ditampal terus ke Google Sheet: jalankan repairImportedRows() sekali selepas import.

LAPORAN
- Cetak / Simpan PDF menggunakan dialog Print browser > Save as PDF.
- Eksport Excel disediakan sebagai CSV UTF-8 yang boleh dibuka terus dalam Microsoft Excel.

KESELAMATAN
- No. KP Public dipaparkan sebagai ******-**-****.
- No. KP penuh hanya dihantar selepas login Admin yang sah.
- Token Admin disimpan dalam sessionStorage browser dan tamat apabila sesi Apps Script tamat.
- Jangan letakkan password Admin dalam config.js atau app.js.

CATATAN CORS / FETCH
Frontend menghantar POST dengan Content-Type text/plain dan redirect: follow untuk mengelakkan preflight dan mengikuti redirect ContentService Google Apps Script.

FOOTER
Created by: Mohd Norais Mohamed Rashid | Powered by: ILKKM SEREMBAN
