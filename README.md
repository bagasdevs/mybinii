# listidol

Versi sendiri dari "여돌 구절판": pilih grup girl group K-pop, saring kandidat
lewat turnamen, urutkan 9 favorit lewat perbandingan berpasangan, lalu unduh
poster PNG-nya.

Tambahan dibanding situs asalnya: **search** (nama Korea maupun romanisasi) dan
**i18n 한국어/English**.

## Menjalankan

Tidak ada langkah build dan tidak ada dependensi. Halaman memakai ES modules,
jadi harus disajikan lewat HTTP, bukan `file://`:

```bash
python -m http.server 8080 --directory .
# buka http://localhost:8080/
```

## Test

```bash
node --test
```

Butuh Node 26+. Test memakai runner bawaan; tidak ada framework.

## Deploy

Unggah folder ini apa adanya ke Cloudflare Pages (drag & drop, atau
`npx wrangler pages deploy .`). Tidak ada `node_modules` dan tidak ada artefak
build. Pastikan folder `photos/` ikut terunggah.

## Struktur

```
data/roster.json       sumber data (80 grup, 475 member)
data/roster.js         dihasilkan oleh tools/build-roster.mjs
i18n/ko.js i18n/en.js  kamus UI
js/i18n.js             pemilih locale + interpolasi        [murni]
js/search.js           normalisasi + index + query          [murni]
js/game.js             turnamen + merge-sort                [murni]
js/view.js             helper HTML                          [murni]
js/state.js            satu objek state + semua aksi
js/render.js           dispatch per fase
js/phases/*.js         render tiap fase
js/poster.js           poster canvas 1080x1600
js/photo.js            dialog crop dan unggah foto
js/credits.js          dialog kredit
```

Modul bertanda `[murni]` tidak menyentuh DOM dan diuji langsung di Node.

## Menambah bahasa

1. Salin `i18n/ko.js` menjadi `i18n/<kode>.js` dan terjemahkan nilainya.
2. Tambahkan kode bahasa itu ke `LOCALES` di `js/i18n.js`.
3. Impor dan daftarkan kamusnya di `js/main.js`.

Tidak ada langkah lain. `test/i18n-keys.test.mjs` akan menolak bila ada key yang
belum diterjemahkan.

## Memperbarui data

```bash
node tools/build-roster.mjs    # setelah menyunting data/roster.json
node tools/mirror-photos.mjs   # unduh foto baru, verifikasi sha256
node --test
```

## Kredit dan lisensi

Lihat [CREDITS.md](CREDITS.md). Konten dan foto bukan milik proyek ini; dipakai
untuk keperluan pribadi. Jangan dipakai komersial.
