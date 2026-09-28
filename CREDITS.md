# Kredit dan sumber

## Data roster

Daftar grup dan member berasal dari situs **https://mygirlnine.pages.dev/**
("여돌 구절판"), diambil 2026-09-26. Situs itu adalah sumber data primer proyek ini.

Data profil per grup (nama, generasi, tanggal debut) dirujuk dari **kprofiles.com**
lewat tautan `source` pada tiap grup di `data/roster.json`.

## Foto

Foto profil member disalin dari `https://mygirlnine.pages.dev/photos/` dan
diverifikasi terhadap `sha256` di `data/photo-sources.json`: 457 dari 475 berkas
byte-identik dengan yang disajikan situs itu. Ukurannya beragam — 262 ukuran
berbeda, dari 301×297 sampai 1731×1550, dan hanya satu yang 640×800 — karena
foto-fotonya dikumpulkan dari berbagai sumber.

`data/photo-sources.json` mencatat untuk setiap foto:

- `sourceUrl` — halaman profil kprofiles yang menjadi rujukan
- `imageUrl` — URL gambar asli di kprofiles
- `sourceType` — `web-download-edited`, `official-web-link`, atau `user-upload`
- `providedFile` — nama berkas asli untuk foto yang disediakan operator
- `sha256` — checksum berkas yang disajikan situs asli

Situs asli menyatakan: "사진 권리는 원 권리자에게 있습니다" — hak atas foto tetap
milik pemegang hak aslinya.

## Batasan pemakaian

Konten dan foto **bukan** milik proyek ini. Repo ini dipakai untuk keperluan
pribadi. **Jangan** dipakai untuk keperluan komersial, dan **jangan**
dipublikasikan seolah-olah karya sendiri.

## Kode

Kode di repo ini ditulis ulang dari nol. Struktur fase permainan (setup → heat →
sort → result), tata letak poster, dan skema data mengikuti perilaku situs asal
agar hasilnya setara; tambahan pada versi ini adalah search dan i18n.
