# e-SO Webhosting

Frontend statik untuk Cloudflare Pages, Netlify atau GitHub Pages. Backend kekal Google Apps Script + Google Sheets.

Baca **[PANDUAN.md](PANDUAN.md)** untuk konfigurasi dan pemasangan.

- `public/`: fail frontend yang diterbitkan.
- `apps-script/`: backend lengkap dan API baharu untuk editor Apps Script.
- `functions/` + `relay/`: relay untuk Cloudflare Pages.
- `netlify/` + `netlify.toml`: relay dan routing Netlify.
- `worker/` + `wrangler.toml`: relay berasingan bagi GitHub Pages.
- `tests/`: ujian unit/API dan integrasi pelayar.

Jangan letakkan `GAS_API_SECRET` dalam `public/` atau repository.
