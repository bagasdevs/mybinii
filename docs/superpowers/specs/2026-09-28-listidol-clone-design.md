# listidol — Klon "여돌 구절판" dengan Search & Multi-language

Tanggal: 2026-09-28
Status: menunggu review spec

## 1. Tujuan

Membangun ulang situs `https://mygirlnine.pages.dev/` ("여돌 구절판") sebagai
milik sendiri, dengan dua kemampuan tambahan: **search** dan **multi-language**.

**Pemakai:** pribadi, dibagikan ke teman. Bukan produk publik.

**Kriteria sukses:**

1. Empat fase asli berfungsi penuh: `setup → heat → sort → result`.
2. Poster PNG bisa diunduh, teks Hangul ter-render benar di canvas.
3. Search menemukan member lewat nama Korea **maupun** romanisasi, tanpa
   mengubah pilihan yang sudah dibuat.
4. Seluruh UI bisa berpindah 한국어 ↔ English, termasuk nama member dan grup.
5. `node --test` hijau tanpa satu pun dependensi eksternal.
6. Deploy = unggah folder statis. Tanpa langkah build.

## 2. Non-goals

Sengaja **tidak** dibangun. Jangan tambahkan tanpa keputusan baru:

- URL per member/grup, prerender, SSG, SEO (`sitemap.xml`, `robots.txt`, OG tags).
- Backend, akun, database, analytics.
- Persistensi lintas sesi untuk **hasil atau pilihan**. Situs asli pun tidak
  menyimpan — foto hasil edit hanya hidup di memori. Satu-satunya nilai yang
  disimpan di localStorage adalah preferensi bahasa (`lang`, §8).
- Share link berbasis URL.
- Dark mode.
- Pencarian fuzzy/Levenshtein.
- Search 초성 (konsonan awal Hangul) — ditunda, lihat §12.

## 3. Keputusan yang dikunci

| # | Keputusan | Alasan |
|---|---|---|
| 1 | Vanilla ES modules, **tanpa build step** | Tidak ada kebutuhan routing/prerender; bundler & `node_modules` = lapisan permanen untuk kemampuan yang tidak dipakai |
| 2 | Data: reuse roster hasil scrape + mirror 475 foto | Sudah diekstrak & bersih; pemakaian privat |
| 3 | Bahasa: 한국어 + English | Nama KR & EN sudah ada di data; cukup untuk teman non-Korea |
| 4 | Search: filter live di layar pilih, tanpa halaman baru | Search harus berada di tengah proses memilih 9, bukan halaman terpisah |
| 5 | Semua fase dipertahankan, ditulis ulang bersih | Bagian permainannya adalah inti nilainya |
| 6 | State = satu objek, `render(state)` idempoten | Ganti bahasa butuh re-render penuh; mencegah state nyangkut di DOM |

## 4. Struktur file

```
listidol/
  index.html                 shell: <header> <main id=app> <footer> <dialog> <div id=toast>
  style.css                  port dari aslinya + gaya kotak search
  data/roster.json           sumber data (hasil scrape, 80 grup + 475 member)
  data/roster.js             ES module hasil generate: GROUPS, MEMBERS, CHECKED
  data/photo-sources.json    provenance 478 foto (kredit/atribusi)
  i18n/ko.js  i18n/en.js    kamus datar key→string (export default)
  js/main.js                 bootstrap: locale → kamus → wire event → render()
  js/state.js                satu objek state + semua action
  js/i18n.js                 detectLocale(), createTranslator(), genLabel()  ← murni
  js/search.js               normalize(), buildIndex(), search()             ← murni
  js/game.js                 turnamen + merge-sort                           ← murni
  js/view.js                 helper HTML (esc, portrait, steps, bar, label)   ← murni
  js/render.js               render() dispatch per fase
  js/phases/setup.js
  js/phases/heat.js
  js/phases/sort.js
  js/phases/result.js
  js/poster.js               canvas 1080×1600 → toBlob → download
  js/photo.js                dialog crop, default crop, upload foto sendiri
  js/credits.js              dialog kredit & sumber foto                        ← murni
  test/{roster,i18n,search,game,view,state,credits,i18n-keys}.test.mjs
  tools/build-roster.mjs     regenerate data/roster.js dari data/roster.json
  tools/mirror-photos.mjs    sekali jalan: unduh 475 foto + verifikasi sha256
  photos/                    475 jpg hasil mirror (~35 MB, ikut di-commit: Pages serve dari git)
  CREDITS.md                 atribusi kprofiles & sumber foto
  README.md                  cara jalankan lokal + deploy
  docs/superpowers/          spec (dokumen ini) + plan implementasi
```

`js/game.js`, `js/view.js`, dan `js/credits.js` tidak ada di draf pertama spec ini;
ketiganya muncul saat menyusun plan implementasi. Alasannya sama untuk ketiganya:
memisahkan logika yang bisa diuji di Node dari kode yang menyentuh DOM. Lihat
`docs/superpowers/plans/2026-09-28-listidol-clone.md`, bagian File Structure.

## 5. Model data

Diambil apa adanya dari situs asli (`.firecrawl/roster.json`), dirapikan jadi
ES module.

**Group:** `{ id, name, gen, debut, source, disabled?, hidden? }`
**Member:** `{ id, name, english, groups[], displayGroups?, image, crop?, source }`

Fakta terverifikasi yang membentuk desain:

- 80 grup, 475 member. `gen` hanya integer `{2,3,4,5}`; "2.5" hanya ada di label.
- `name` grup hanya 29/80 Hangul; 51 sudah Latin (TWICE, aespa).
- 10 grup punya `id ≠ name` (SNSD/소녀시대, SISTAR/씨스타, Wonder Girls/원더걸스, ...).
- `displayGroups` (19 member) = subset kurasi dari `groups` untuk kartu pendek.
  Contoh: 미나 `groups=[구구단, I.O.I]` → `displayGroups=[I.O.I]`.
- `crop` = `{x:0-100, y:0-100, zoom:1-3}`, default `{x:50, y:25, zoom:1}`.
- 40 nama `english` duplikat (Jisoo, Mina, Chaeyoung, ...).
- Semua member punya `image` dan `english`; semua referensi grup valid; tidak ada id duplikat.
- `ARTMS` = `disabled` + `hidden`.
- `photo-sources.json`: 478 entri = **475 member roster + 3 entri yatim** (`g_aoa_hyejeong`, `g_aoa_seolhyun`, `g_aoa_dohwa`) yang tidak ada di roster. Metadata yatim dibiarkan apa adanya; yang di-mirror hanya 475 yang dirujuk roster.

**Struktur fase (terverifikasi dari `app.js` asli) — menentukan di mana search dipasang:**

| Fase | Grid yang dirender | Isi |
|---|---|---|
| `setup` | `.group-grid` | pilih **grup** + tab generasi + switch urutan debut + 전체 선택/해제 |
| `heat` | `.member-grid` (via `card(id)`) | pilih **member**: "N명 중 3명 선택", per layar/ronde (`heatStage`: `main`/`challenge`/`final`) |
| `sort` | dua kartu | perbandingan berpasangan (merge-sort) |
| `result` | grid poster | judul + unduh PNG + edit foto |

Tidak ada grid member di `setup`; pemilihan member terjadi di `heat`. Karena itu search hanya bermakna di `setup` (cari grup) dan `heat` (cari member).

Aturan tampilan nama:

```
memberLabel(m, lang) = lang === 'en' ? m.english : m.name
groupLabel(g, lang)  = lang === 'en' ? (g.id !== g.name ? g.id : g.name) : g.name
                       → lalu ditimpa oleh EN_GROUP_OVERRIDES
EN_GROUP_OVERRIDES = { 'SNSD': "Girls' Generation", ... }   // daftar kecil, diisi saat implementasi
```

## 6. State

```js
{
  lang: 'ko',
  query: '',
  debutDesc: false,
  selected: Set<groupId>,
  phase: 'setup',
  pool: [memberId],          // member eligible dari grup terpilih
  finalists: [memberId],     // 9 terpilih
  title: '여돌 구절판',
  cropId: null,
  custom: { memberId: { url, x, y, zoom } },   // foto upload user, in-memory saja
  heat:  { stage, round, roundTotal, current, selected, winners, losers, index },
  sort:  { stack, left, right, comparisons, candidateCount, out },
}
```

`state.gen` **tidak ada** di versi ini. Di `app.js` asli, variabel `gen` hanya
di-assign sekali saat inisialisasi (`gen=0`) dan tidak pernah diubah, sehingga
`visibleGroups()` tidak pernah memfilter berdasarkan generasi; tab generasi
sebenarnya hanya melakukan pilih/hapus massal per generasi. Port ini
mempertahankan perilaku itu lewat `toggleGeneration(state, gen)`, dan membuang
variabel matinya.

Situs asli memakai belasan variabel modul (`let selected=new Set(...), gen=0,
phase='setup', pool=[], ...`). Dikonsolidasi karena ganti bahasa memerlukan
re-render penuh, dan `render(state)` yang idempoten hanya aman bila seluruh
state masukan terkumpul di satu tempat. Efek samping: reset ("새로 만들기")
jadi satu operasi, dan tidak ada state yang tersimpan di DOM.

## 7. Alur data

Satu arah: **event → action → state → render**. Render tidak pernah mengubah state.

```
roster.js ─┐
i18n/*.json ┼→ main.js bootstrap → state → render(state) → app.innerHTML
user event ─┘         ↑
              actions (state.js)
search: state.query → search.query() → subset id → phases/setup.js
```

## 8. i18n

- `i18n/ko.json`, `i18n/en.json`: kamus datar `key → string`. Key berasal dari
  77 string Korea hardcoded di `app.js` asli, ditambah key baru untuk search.
- `t(key, vars)`: lookup → interpolasi `{n}`. Key hilang → `console.warn` sekali
  per key → **kembalikan key itu sendiri**. Terlihat jelas di UI, tidak crash.
- Urutan resolusi locale: `?lang=` → `localStorage.lang` → `navigator.language`
  → `ko`. Nilai tak dikenal **dilewati**, bukan error.
- Switch bahasa: `state.lang` → simpan localStorage (dibungkus `try/catch`) →
  set `<html lang>` dan `<title>` → full re-render.
- UI pemilih bahasa: dua tombol `한국어 / EN` di header. Ganti ke `<select>`
  hanya bila bahasa bertambah menjadi 3+.
- Nama member & grup mengikuti bahasa lewat `memberLabel` / `groupLabel` (§5).
- Angka memakai counter yang benar: `{n}명` vs `{n} members`, `{n}팀` vs `{n} teams`.
- Tanggal kredit memakai `Intl.DateTimeFormat(locale)` — native, tanpa dependensi.
- Nama berkas poster dari kamus: `나의_여돌_구절판.png` vs `my-9-picks.png`.
- **Bahasa UI tidak membatasi bahasa pencarian.** Index memuat nama KR dan EN
  sekaligus (§9).

## 9. Search

Modul murni, tanpa DOM — ini yang membuatnya bisa diuji di Node.

**`normalize(s)`** — lowercase → `NFD` → buang combining mark (`\p{M}+`) →
**`NFC`** → hapus `[^\p{L}\p{N}\s]+` → rapatkan spasi.

Dua detail yang tidak intuitif dan sudah diverifikasi di Node:

- **Harus `NFD` lalu `NFC`, bukan `NFKD`.** `NFKD` ikut mendekomposisi suku kata
  Hangul menjadi jamo (`트와이스` → `트와이스`). `NFD` + buang mark + `NFC`
  mengembalikan Hangul utuh **dan** tetap membuang diakritik Latin (`café` → `cafe`).
- **Tanda baca dihapus, bukan diganti spasi.** Diganti spasi akan membuat index
  berisi `iz one` sehingga query `izone` tidak cocok. Dihapus → `IZ*ONE` → `izone`,
  `woo!ah!` → `wooah`, `H1-KEY` → `h1key`.

**`buildIndex(members, groups)`** — dipanggil sekali saat boot. Satu haystack
per member:

```
name(KR) + english + semua group.name(KR) + semua group.id + displayGroups
+ gen + label gen KO + label gen EN
```

±475 × 60 karakter ≈ 30 KB. Tidak ada reindex per keystroke.

**`query(q, index)`** — `normalize(q)` → split spasi → **semua token harus
muncul sebagai substring** di haystack. Order-free: `"sana twice"` ≡ `"twice sana"`.
Query kosong → semua member lolos.

Substring, bukan fuzzy: 475 item, biaya mikro-detik, tanpa debounce. Fuzzy
menambah kode dan menurunkan presisi.

**Invariant:** filter hanya mengubah **visibilitas**, tidak pernah `selected`.
Mengetik lalu mengubah query tidak boleh mengubah pilihan. Ini bug klasik pada
implementasi search-over-grid dan wajib ditutup test.

**UI — dipasang di dua tempat, tidak di `sort`/`result`:**

| Fase | Yang difilter | Catatan |
|---|---|---|
| `setup` | `.group-grid` (`visibleGroups()`) | cari grup lewat `name`, `id`, atau generasi |
| `heat` | `.member-grid` = `heatCurrent` (layar kandidat saat ini) | bukan seluruh 475 — `heatCurrent` memang per layar |

`<input type="search">` dirender di kepala fase + penghitung hasil. Digabung
**AND** dengan tab generasi dan filter grup yang sudah aktif; urutan debut tetap
berlaku. Hasil kosong → empty state terlokalisasi. `sort` dan `result` tidak
memakai search: `sort` hanya menampilkan dua kartu, `result` sudah final.

**`state.query` di-reset ke `''` pada setiap transisi fase.** Satu baris di
action transisi. Alasannya: `heatCurrent` adalah layar baru dengan kandidat yang
berbeda, sehingga query sisa dari `setup` akan menyembunyikan kandidat secara
tak terduga. Reset = perilaku yang bisa diprediksi.

**Disambiguasi.** Karena 40 nama EN duplikat, setiap kartu member selalu
menampilkan baris grup (`labels(m)` = `displayGroups || groups`).

## 10. Poster

- `await document.fonts.load('700 40px "Noto Sans KR"')` dan
  `await document.fonts.ready` **sebelum** menggambar. Tanpa ini teks Hangul di
  canvas bisa ter-render sebagai tofu/kotak — kegagalan paling umum pada poster canvas.
- `canvas.toBlob(cb, 'image/png')` → `URL.createObjectURL` → `<a download>` →
  `URL.revokeObjectURL`. Situs asli tidak me-revoke (bocor memori); ini diperbaiki.
- Judul poster `maxlength=35` seperti aslinya, di-escape.
- Foto dari `custom[id]` bila ada, selain itu `photos/<member.image>`.
- `layout = [3,4,5,1,0,2,6,7,8]` untuk grid poster, sama seperti aslinya.

## 11. Error handling

| Kasus | Perilaku |
|---|---|
| `?lang=fr` | dilewati, lanjut ke sumber berikutnya → `ko` |
| key i18n hilang | `console.warn` sekali per key + tampilkan key, tidak crash |
| localStorage diblokir (private mode) | `try/catch` diam; bahasa tidak persist |
| foto 404 / rusak | `onerror` → avatar inisial dari `english`/`name` |
| upload bukan gambar / >20 MB | toast terlokalisasi (pesan asli sudah ada) |
| `toBlob` mengembalikan null | toast "이미지를 저장하지 못했어요" / padanan EN |
| hasil search kosong | empty state terlokalisasi |
| member eligible < 9 | tombol mulai disabled + pesan asli |

## 12. Testing

`node --test` — runner bawaan Node 26. **Tanpa framework, tanpa dependensi.**
Modul ES murni bisa di-import langsung di Node justru karena tidak ada langkah
build; ini keuntungan nyata dari keputusan #1.

- **`game.test.mjs`** — `roundCount`/`sortLimit` terhadap nilai yang dihitung
tangan, `initialOrder`, `interleave`, `heatSize`, `eligibleMembers`, `sortGroups`
(termasuk `debut` hilang), alur heat 21 member sampai menghasilkan kandidat sort,
dan merge-sort (selalu kiri = urutan tetap, selalu kanan = urutan terbalik, jumlah
perbandingan tidak melebihi `sortLimit`).
- **`view.test.mjs`** — `esc`, `visibleGroups`, label grup KO/EN (termasuk peta
override dan jaminan tidak ada label EN ber-Hangul), `labelsOf`/`groupLines`
dengan id grup asing, `defaultPhoto`/`portrait`, `stepIndex`.
- **`state.test.mjs`** — invariant §9 (filter tidak mengubah `selected`, transisi
fase mengosongkan `query`), pemilihan grup, `startGame` (heat vs sort langsung),
aksi heat, `pickSort`, aksi crop, dan `setTitle`.
- **`credits.test.mjs`** — satu baris per grup non-hidden, tanggal per bahasa,
tautan ke `photo-sources.json`.
- **`i18n-keys.test.mjs`** — memindai `js/**/*.js` untuk key yang dipakai dan
memastikan semuanya ada di kedua kamus, himpunan key ko/en identik, tidak ada
nilai kosong, dan placeholder `{...}` cocok antar bahasa.

- **`search.test.mjs`** — normalize (huruf besar/kecil, tanda baca, diakritik,
  Hangul utuh); token AND order-free; `"twice"` / `"트와이스"` / `"sana"` /
  `"사나"` semua menemukan hasil; query kosong = semua; query tak match = 0;
  **filter tidak mengubah `selected`** (invariant §9); **`query` kembali `''`
  setelah transisi fase** (invariant §9).
- **`i18n.test.mjs`** — urutan resolusi locale; `?lang=fr` jatuh ke sumber
  berikutnya; interpolasi `{n}`; key hilang mengembalikan key dan warn sekali.
- **`roster.test.mjs`** — id unik; setiap `groups[]` dan `displayGroups[]` member
  menunjuk grup yang ada; `displayGroups ⊆ groups`; `gen ∈ {2,3,4,5}`; setiap
  member punya `image` dan `english`; **setiap `member.image` punya berkas di disk**
  dan ada entri `photo-sources.json` yang cocok. Tiga entri yatim AOA (§5) tidak
  diharapkan ada di disk.

**Smoke manual** (bukan test permanen, dijalankan sekali sebelum selesai, lihat
Task 14 plan): empat fase × dua bahasa; unduh poster dan periksa Hangul
ter-render sebagai huruf; dialog crop termasuk unggah foto; mode offline untuk
memeriksa avatar inisial; `?lang=fr`; refresh tidak mempertahankan pilihan.

**Ditunda:** search 초성 (mis. `"ㅌㅇ"` → 트와이스). Butuh dekomposisi jamo;
tambahkan hanya bila pencarian Korea terasa kurang.

## 13. Sumber data, mirroring, kredit

- `tools/mirror-photos.mjs`: unduh 475 foto dari `https://mygirlnine.pages.dev/photos/<member.image>`
  ke `photos/`, verifikasi `sha256` terhadap `photo-sources.json`, lewati berkas
  yang sudah ada dan cocok. Idempoten — aman dijalankan ulang.
- **Terverifikasi:** `sha256` di `photo-sources.json` adalah hash dari berkas yang
  disajikan situs asli, bukan dari `imageUrl` kprofiles. Contoh `g_exid_solji`:
  75.600 byte, `fda506c0…1453` cocok persis. Karena itu mirror mengambil dari
  situs asli (sudah dinormalkan ke 640×800), bukan dari kprofiles langsung —
  sumber kprofiles hanya dipakai untuk atribusi.
- Hanya 475 id yang dirujuk roster yang diunduh. Tiga entri yatim AOA (§5)
  dilewati; keberadaannya di `photo-sources.json` tidak mengganggu.
- `photo-sources.json` juga mencatat `sourceType` (`web-download-edited`,
  `official-web-link`, `user-upload`) dan `providedFile` (mis. `IMG_5401.jpeg`)
  untuk foto yang disediakan operator. Ini masuk ke `CREDITS.md`.
- `CREDITS.md`: menyebut kprofiles.com sebagai sumber profil & foto, dan situs
  asal sebagai sumber data roster. Situs asli sendiri menyatakan
  "사진 권리는 원 권리자에게 있습니다" (hak foto milik pemegang hak aslinya).
- **Batasan:** konten dan foto bukan milik kami. Aman untuk pemakaian privat;
  **jangan** dipakai komersial atau dipublikasikan sebagai karya sendiri.
  Ini akan ditulis eksplisit di `README.md` dan `CREDITS.md`.

## 14. Deploy

Folder statis apa adanya ke Cloudflare Pages (drag & drop, atau
`npx wrangler pages deploy .`). Tanpa build, tanpa `node_modules`, tanpa
konfigurasi. Pratinjau lokal: server statis apa pun (mis. `npx serve`), karena
ES modules memerlukan `http://`, bukan `file://`.

## 15. Risiko terbuka

1. **Granularitas file.** 14 berkas JS untuk aplikasi sebesar ini bisa terasa
   berlebihan. Diterima karena modul ES native tanpa bundler, dan berkas kecil
   lebih mudah dijaga saat menambah search + i18n. Bila ternyata mengganggu,
   fase-fase bisa digabung jadi satu `phases.js`.
2. **`EN_GROUP_OVERRIDES` manual.** Nama resmi Inggris beberapa grup tidak bisa
   diturunkan dari data (`id` hanya singkatan). Daftar kecil diisi saat
   implementasi; sisanya memakai `id`/`name` apa adanya.
3. **35 MB foto di git.** Diterima untuk pemakaian privat. Bila repo jadi berat,
   pindah ke Git LFS atau `.gitignore` + dokumentasikan `tools/mirror-photos.mjs`.
4. **Ukuran kamus i18n.** 77+ key × 2 bahasa perlu dijaga sinkron. Test i18n
   memeriksa key hilang, bukan key berlebih.
