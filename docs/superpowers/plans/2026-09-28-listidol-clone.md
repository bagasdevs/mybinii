# listidol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Situs statis "여돌 구절판" versi sendiri — pilih grup, turnamen kandidat, ranking berpasangan, poster PNG — dengan **search** dan **i18n 한국어/English**.

**Architecture:** Situs statis tanpa langkah build. Data roster diekspor sebagai ES module. Logika yang punya nilai uji (`i18n`, `search`, `game`) ditulis sebagai modul murni tanpa DOM sehingga bisa diimpor langsung oleh `node --test`; hanya modul render dan I/O yang menyentuh `document`. Satu objek `state` + `render(state)` idempoten, sehingga berpindah bahasa cukup memanggil `render()` lagi.

**Tech Stack:** HTML, CSS, vanilla ES modules, Canvas 2D, `node --test`. **Tanpa dependensi runtime maupun dev.**

**Spec:** `docs/superpowers/specs/2026-09-28-listidol-clone-design.md`

## Global Constraints

- **Nol dependensi.** Tidak ada `package.json`, tidak ada `node_modules`, tidak ada langkah build. Deploy = unggah folder.
- **Node ≥ 26** untuk menjalankan test (`node --test`, regex `\p{...}`).
- **Modul murni** — `js/i18n.js`, `js/search.js`, `js/game.js` **tidak boleh** menyentuh `document`, `window`, atau `localStorage`. Modul ini wajib bisa diimpor di Node.
- **Semua teks yang dilihat pengguna lewat `t(key)`.** Tidak ada literal Korea/Inggris di `js/phases/*`, `js/render.js`, `js/poster.js`, `js/photo.js`, `js/credits.js`.
- **Bahasa:** `ko` (default) dan `en` saja.
- **Nama berkas foto:** `photos/profile-<memberId>.jpg` (nilainya ada di `member.image`).
- **`state.query` di-reset ke `''` pada setiap transisi fase.**
- **Filter tidak pernah mengubah** `state.selected` atau `state.heat.selected`.
- Render tidak pernah mengubah state. Hanya action (`js/state.js`) yang mengubah state.
- Pesan commit: `feat:`, `test:`, `chore:`, `docs:`.

## Review Focus

Lima kelas masukan yang spec implikasikan tapi tidak diuji test mana pun, paling mungkin menggigit pengguna. Tiap baris punya test yang menempel di task pemilik kodenya.

1. **Grup dengan `debut` kosong atau format aneh** — `visibleGroups()` harus tetap deterministik dan tidak melempar. Test di **Task 6**.
2. **`gen` grup di luar {2,3,4,5}** (data diperbarui nanti) — label tidak boleh menjadi `undefined세대`. Test di **Task 3** (`genLabel`) dan **Task 6**.
3. **Member yang hanya ada di grup `disabled`/`hidden`** — tidak boleh ikut `eligible()`. Test di **Task 5** (`eligibleMembers`).
4. **`displayGroups` memuat id grup yang tidak dikenal** — kartu tidak boleh menampilkan `undefined`. Test di **Task 6** (`labelsOf`).
5. **Query search berisi hanya spasi/tanda baca** (`"   "`, `"*"`, `"()"`) — harus diperlakukan sebagai "tanpa filter", bukan "0 hasil". Test di **Task 4**.

## File Structure

```
index.html                     shell: <header> <main id=app> <footer> <dialog> <div id=toast>
style.css                      port dari situs asli + gaya kotak search
data/roster.json               sumber data (hasil scrape, 80 grup + 475 member)
data/photo-sources.json        provenance 478 foto (kredit/atribusi)
data/roster.js                 DIHASILKAN dari data/roster.json oleh tools/build-roster.mjs
i18n/ko.js                     kamus datar key → string (export default)
i18n/en.js                     kamus datar key → string (export default)
js/main.js                     bootstrap: locale, kamus, wire event, render pertama
js/state.js                    createState() + semua action (satu-satunya pengubah state)
js/i18n.js                     detectLocale, interpolate, createTranslator        [murni]
js/search.js                   normalize, buildIndex, search, memberText, groupText [murni]
js/game.js                     roundCount, sortLimit, initialOrder, interleave,
                               heat state machine, merge-sort state machine        [murni]
js/render.js                   render(state, ctx) + helper bersama (esc, bar, steps, portrait, card)
js/phases/setup.js             renderSetup
js/phases/heat.js              renderHeat
js/phases/sort.js              renderSort
js/phases/result.js            renderResult
js/poster.js                   canvas 1080×1600 → toBlob → unduh PNG
js/photo.js                    dialog crop/zoom/posisi + unggah foto sendiri
js/credits.js                  dialog kredit & sumber foto
test/i18n.test.mjs
test/search.test.mjs
test/game.test.mjs
test/roster.test.mjs
tools/build-roster.mjs         regenerate data/roster.js dari data/roster.json
tools/mirror-photos.mjs        unduh 475 foto + verifikasi sha256
photos/                        475 jpg hasil mirror
CREDITS.md
README.md
```

**Catatan penyimpangan dari spec §4:** plan ini menambahkan `js/game.js` yang tidak ada di daftar spec. Alasannya: `app.js` asli menaruh state machine turnamen dan merge-sort di dalam handler DOM. Dipisah menjadi modul murni, bagian itu jadi satu-satunya tempat yang benar-benar berhak diuji di Node, dan fase-fase render menjadi fungsi murni dari state. Spec §4 diperbarui agar cocok.

---

## Task 1: Fondasi data

**Files:**
- Create: `data/roster.json` (salinan bersih dari `.firecrawl/roster.json`)
- Create: `data/photo-sources.json` (salinan dari `.firecrawl/photo-sources.json`)
- Create: `tools/build-roster.mjs`
- Create: `data/roster.js` (dihasilkan, ikut di-commit)
- Create: `test/roster.test.mjs`
- Modify: `.gitignore` (pastikan `photos/` **tidak** diabaikan)

**Interfaces:**
- Consumes: — (task pertama)
- Produces: `data/roster.js` mengekspor `CHECKED: string`, `GROUPS: Group[]`, `MEMBERS: Member[]`; `Group = { id, name, gen, debut, source, disabled?, hidden? }`; `Member = { id, name, english, groups: string[], displayGroups?: string[], image, crop?: {x,y,zoom}, source }`

- [ ] **Step 1: Salin data hasil scrape ke repo**

```bash
mkdir -p data
cp .firecrawl/roster.json data/roster.json
cp .firecrawl/photo-sources.json data/photo-sources.json
node -e "const d=require('./data/roster.json');console.log('groups',d.groups.length,'members',d.members.length,'checked',d.checked)"
```

Expected: `groups 80 members 475 checked 2026-09-26`

- [ ] **Step 2: Tulis generator `data/roster.js`**

`tools/build-roster.mjs`:

```js
// Menghasilkan data/roster.js dari data/roster.json.
// Jalankan: node tools/build-roster.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync(new URL('../data/roster.json', import.meta.url), 'utf8'));

for (const key of ['checked', 'groups', 'members']) {
  if (!(key in src)) throw new Error(`data/roster.json kehilangan kunci "${key}"`);
}

const banner = `// DIHASILKAN oleh tools/build-roster.mjs — jangan diedit manual.
// Sumber: data/roster.json (scrape dari https://mygirlnine.pages.dev/)
`;

const out = `${banner}
export const CHECKED = ${JSON.stringify(src.checked)};
export const GROUPS = ${JSON.stringify(src.groups, null, 2)};
export const MEMBERS = ${JSON.stringify(src.members, null, 2)};
`;

writeFileSync(new URL('../data/roster.js', import.meta.url), out);
console.log(`data/roster.js: ${src.groups.length} grup, ${src.members.length} member`);
```

- [ ] **Step 3: Jalankan generator**

Run: `node tools/build-roster.mjs`
Expected: `data/roster.js: 80 grup, 475 member`

- [ ] **Step 4: Tulis test struktur data**

`test/roster.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHECKED, GROUPS, MEMBERS } from '../data/roster.js';

const PHOTOS = JSON.parse(
  readFileSync(new URL('../data/photo-sources.json', import.meta.url), 'utf8'),
);

test('CHECKED berupa tanggal ISO', () => {
  assert.match(CHECKED, /^\d{4}-\d{2}-\d{2}$/);
});

test('id grup dan id member unik', () => {
  assert.equal(new Set(GROUPS.map((g) => g.id)).size, GROUPS.length, 'id grup duplikat');
  assert.equal(new Set(MEMBERS.map((m) => m.id)).size, MEMBERS.length, 'id member duplikat');
});

test('setiap referensi grup pada member menunjuk grup yang ada', () => {
  const ids = new Set(GROUPS.map((g) => g.id));
  for (const m of MEMBERS) {
    for (const g of m.groups) assert.ok(ids.has(g), `${m.id} -> groups ${g}`);
    for (const g of m.displayGroups ?? []) assert.ok(ids.has(g), `${m.id} -> displayGroups ${g}`);
  }
});

test('displayGroups adalah subset dari groups', () => {
  for (const m of MEMBERS) {
    for (const g of m.displayGroups ?? []) {
      assert.ok(m.groups.includes(g), `${m.id}: ${g} tidak ada di groups`);
    }
  }
});

test('gen grup hanya 2, 3, 4, atau 5', () => {
  for (const g of GROUPS) assert.ok([2, 3, 4, 5].includes(g.gen), `${g.id} gen=${g.gen}`);
});

test('setiap member punya name, english, dan image', () => {
  for (const m of MEMBERS) {
    assert.ok(m.name, `${m.id} tanpa name`);
    assert.ok(m.english, `${m.id} tanpa english`);
    assert.ok(m.image, `${m.id} tanpa image`);
  }
});

test('setiap member punya entri photo-sources dengan sha256', () => {
  const byId = new Map(PHOTOS.map((p) => [p.id, p]));
  for (const m of MEMBERS) {
    const entry = byId.get(m.id);
    assert.ok(entry, `photo-sources tidak punya ${m.id}`);
    assert.match(entry.sha256, /^[0-9a-f]{64}$/, `${m.id} sha256 tidak valid`);
  }
});
```

- [ ] **Step 5: Jalankan test**

Run: `node --test test/roster.test.mjs`
Expected: PASS, 7 test lulus.

- [ ] **Step 6: Pastikan `photos/` tidak diabaikan git**

`.gitignore` sudah memuat `.firecrawl/`. Tambahkan komentar eksplisit bahwa `photos/` **sengaja** ikut di-commit, karena Cloudflare Pages menyajikan berkas langsung dari repo:

```gitignore
# Cache Firecrawl CLI
.firecrawl/

# photos/ SENGAJA tidak diabaikan: 475 foto hasil mirror ikut di-commit
# karena Cloudflare Pages menyajikan berkas langsung dari repo.

# OS / editor
.DS_Store
Thumbs.db
*.swp
```

- [ ] **Step 7: Commit**

```bash
git add .gitignore data/roster.json data/roster.js data/photo-sources.json tools/build-roster.mjs test/roster.test.mjs
git commit -m "feat: data roster sebagai ES module + generator + test struktur"
```

---

## Task 2: Mirror 475 foto

**Files:**
- Create: `tools/mirror-photos.mjs`
- Create: `photos/*.jpg` (475 berkas)
- Modify: `test/roster.test.mjs` (tambah satu test keberadaan berkas)

**Interfaces:**
- Consumes: `MEMBERS` dari `data/roster.js`; `sha256` per member dari `data/photo-sources.json`
- Produces: berkas `photos/profile-<memberId>.jpg` yang sha256-nya cocok dengan `photo-sources.json`

**Konteks penting:** `sha256` di `photo-sources.json` adalah hash dari berkas yang **disajikan situs asli** (`https://mygirlnine.pages.dev/photos/...`), bukan dari `imageUrl` kprofiles. Sudah diverifikasi pada `g_exid_solji` (75.600 byte, `fda506c0…1453`). Karena itu mirror mengambil dari situs asli.

- [ ] **Step 1: Tulis skrip mirror**

`tools/mirror-photos.mjs`:

```js
// Mengunduh 475 foto member ke photos/ dan memverifikasi sha256-nya.
// Idempoten: berkas yang sudah ada dan cocok dilewati.
// Jalankan: node tools/mirror-photos.mjs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { MEMBERS } from '../data/roster.js';

const BASE = 'https://mygirlnine.pages.dev/';
const PHOTOS_DIR = new URL('../photos/', import.meta.url);
const SOURCES = new Map(
  JSON.parse(readFileSync(new URL('../data/photo-sources.json', import.meta.url), 'utf8'))
    .map((p) => [p.id, p]),
);
const CONCURRENCY = 8;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function fetchPhoto(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'listidol-mirror/1.0' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function mirrorOne(member) {
  const entry = SOURCES.get(member.id);
  if (!entry) return { id: member.id, status: 'no-source' };

  const name = member.image.replace(/^photos\//, '');
  const target = new URL(name, PHOTOS_DIR);
  const expected = entry.sha256;

  if (existsSync(target) && sha256(readFileSync(target)) === expected) {
    return { id: member.id, status: 'cached' };
  }

  const buf = await fetchPhoto(new URL(member.image, BASE).href);
  const actual = sha256(buf);
  if (actual !== expected) {
    return { id: member.id, status: 'hash-mismatch', expected, actual };
  }
  writeFileSync(target, buf);
  return { id: member.id, status: 'downloaded' };
}

async function runPool(items, worker, size) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        results.push(await worker(item));
      } catch (err) {
        results.push({ id: item.id, status: 'error', message: err.message });
      }
    }
  });
  await Promise.all(runners);
  return results;
}

mkdirSync(PHOTOS_DIR, { recursive: true });

const results = await runPool(MEMBERS, mirrorOne, CONCURRENCY);
const counts = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
console.log(counts);

const bad = results.filter((r) => r.status !== 'downloaded' && r.status !== 'cached');
if (bad.length) {
  console.error('GAGAL:', bad.slice(0, 10));
  process.exit(1);
}
console.log(`OK: ${results.length} foto terverifikasi di photos/`);
```

- [ ] **Step 2: Jalankan mirror**

Run: `node tools/mirror-photos.mjs`
Expected: `{ downloaded: 475 }` lalu `OK: 475 foto terverifikasi di photos/`

- [ ] **Step 3: Jalankan ulang untuk membuktikan idempoten**

Run: `node tools/mirror-photos.mjs`
Expected: `{ cached: 475 }` lalu `OK: 475 foto terverifikasi di photos/` — tanpa unduhan baru.

- [ ] **Step 4: Tambahkan test keberadaan berkas**

Tambahkan ke `test/roster.test.mjs`:

```js
test('setiap member punya berkas foto di photos/', () => {
  for (const m of MEMBERS) {
    const file = new URL(`../${m.image}`, import.meta.url);
    assert.ok(existsSync(file), `berkas hilang: ${m.image}`);
  }
});
```

Dan ubah baris import di puncak berkas menjadi:

```js
import { existsSync, readFileSync } from 'node:fs';
```

- [ ] **Step 5: Jalankan test**

Run: `node --test test/roster.test.mjs`
Expected: PASS, 8 test lulus.

- [ ] **Step 6: Commit**

```bash
git add tools/mirror-photos.mjs photos test/roster.test.mjs
git commit -m "feat: mirror 475 foto dengan verifikasi sha256"
```

---

## Task 3: Modul i18n + kamus

**Files:**
- Create: `js/i18n.js`
- Create: `i18n/ko.js`, `i18n/en.js`
- Create: `test/i18n.test.mjs`

**Interfaces:**
- Consumes: —
- Produces:
  - `DEFAULT_LOCALE: 'ko'`, `LOCALES: ['ko','en']`
  - `detectLocale({ search?, stored?, navigatorLangs? }) -> 'ko' | 'en'`
  - `interpolate(template: string, vars: object) -> string`
  - `createTranslator(dicts: Record<locale, Record<string,string>>, getLocale: () => string, onMissing?: (key: string) => void) -> (key: string, vars?: object) => string`
  - `genLabel(gen: number, t) -> string` — dipakai Task 6

- [ ] **Step 1: Tulis test yang gagal**

`test/i18n.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LOCALE,
  detectLocale,
  interpolate,
  createTranslator,
  genLabel,
} from '../js/i18n.js';

test('detectLocale: ?lang menang atas sumber lain', () => {
  assert.equal(
    detectLocale({ search: '?lang=en', stored: 'ko', navigatorLangs: ['ko-KR'] }),
    'en',
  );
});

test('detectLocale: ?lang tak dikenal dilewati, lanjut ke stored', () => {
  assert.equal(
    detectLocale({ search: '?lang=fr', stored: 'en', navigatorLangs: ['ko-KR'] }),
    'en',
  );
});

test('detectLocale: tag regional dicocokkan lewat prefix', () => {
  assert.equal(detectLocale({ navigatorLangs: ['en-US', 'ko-KR'] }), 'en');
  assert.equal(detectLocale({ navigatorLangs: ['ko-KR'] }), 'ko');
});

test('detectLocale: tanpa petunjuk apa pun kembali ke default', () => {
  assert.equal(detectLocale({}), DEFAULT_LOCALE);
  assert.equal(detectLocale(), DEFAULT_LOCALE);
  assert.equal(detectLocale({ search: '?lang=', stored: '', navigatorLangs: [] }), 'ko');
});

test('detectLocale: search tanpa tanda tanya pun tetap terbaca', () => {
  assert.equal(detectLocale({ search: 'lang=en' }), 'en');
});

test('interpolate mengganti placeholder dan membiarkan yang asing', () => {
  assert.equal(interpolate('{n}명 / {total}명', { n: 3, total: 9 }), '3명 / 9명');
  assert.equal(interpolate('{n}명', {}), '{n}명');
  assert.equal(interpolate('tanpa placeholder', { n: 1 }), 'tanpa placeholder');
});

test('createTranslator mengembalikan key dan memanggil onMissing sekali saja', () => {
  const missing = [];
  const t = createTranslator({ ko: { a: 'A' } }, () => 'ko', (k) => missing.push(k));
  assert.equal(t('a'), 'A');
  assert.equal(t('tidak.ada'), 'tidak.ada');
  assert.equal(t('tidak.ada'), 'tidak.ada');
  assert.deepEqual(missing, ['tidak.ada']);
});

test('createTranslator jatuh ke default bila locale tidak punya kamus', () => {
  const t = createTranslator({ ko: { a: 'A' }, en: {} }, () => 'en', () => {});
  assert.equal(t('a'), 'a', 'key hilang dikembalikan apa adanya, tidak menebak dari ko');
});

test('genLabel memakai label khusus untuk 2 dan fallback untuk gen tak dikenal', () => {
  const t = createTranslator(
    { ko: { 'gen.2': '2·2.5세대', 'gen.3': '3세대', 'gen.other': '{n}세대' } },
    () => 'ko',
    () => {},
  );
  assert.equal(genLabel(2, t), '2·2.5세대');
  assert.equal(genLabel(3, t), '3세대');
  assert.equal(genLabel(6, t), '6세대');
  assert.equal(genLabel(undefined, t), '0세대');
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `node --test test/i18n.test.mjs`
Expected: FAIL — `Cannot find module '../js/i18n.js'`

- [ ] **Step 3: Tulis `js/i18n.js`**

```js
// Modul murni: tidak menyentuh document/window/localStorage.
export const DEFAULT_LOCALE = 'ko';
export const LOCALES = ['ko', 'en'];

/** Urutan: ?lang= → localStorage → navigator → default. Nilai tak dikenal dilewati. */
export function detectLocale({ search = '', stored = null, navigatorLangs = [] } = {}) {
  let fromQuery = null;
  try {
    fromQuery = new URLSearchParams(String(search).replace(/^\?/, '')).get('lang');
  } catch {
    fromQuery = null;
  }

  for (const candidate of [fromQuery, stored, ...navigatorLangs]) {
    if (!candidate) continue;
    const tag = String(candidate).toLowerCase();
    if (LOCALES.includes(tag)) return tag;
    const prefixed = LOCALES.find((locale) => tag.startsWith(`${locale}-`));
    if (prefixed) return prefixed;
  }
  return DEFAULT_LOCALE;
}

export function interpolate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, name) =>
    vars && Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}

/**
 * @param dicts   { ko: {...}, en: {...} }
 * @param getLocale () => 'ko' | 'en'
 * @param onMissing dipanggil sekali per key yang hilang
 */
export function createTranslator(dicts, getLocale, onMissing) {
  const warned = new Set();
  const warn = onMissing ?? ((key) => console.warn(`[i18n] missing key: ${key}`));

  return function t(key, vars) {
    const dict = dicts[getLocale()] ?? dicts[DEFAULT_LOCALE] ?? {};
    const raw = dict[key];
    if (raw === undefined) {
      if (!warned.has(key)) {
        warned.add(key);
        warn(key);
      }
      return key;
    }
    return vars ? interpolate(raw, vars) : raw;
  };
}

/** Label generasi. Gen di luar {2,3,4,5} memakai 'gen.other'. */
export function genLabel(gen, t) {
  const n = Number(gen) || 0;
  const key = `gen.${n}`;
  const specific = t(key);
  return specific === key ? t('gen.other', { n }) : specific;
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `node --test test/i18n.test.mjs`
Expected: PASS, 9 test lulus.

- [ ] **Step 5: Tulis kamus**

Nilai boleh memuat `<em>` (satu-satunya markup yang diizinkan di kamus; dipakai `heat.pick` dan `sort.pick`). Placeholder memakai `{nama}`.

`i18n/ko.js` dan `i18n/en.js` — keduanya ES module dengan `export default { ... }`
berisi objek datar `key → string`, satu key per baris. Isi persis tabel ini:

| key | ko | en |
|---|---|---|
| `app.title` | 여돌 구절판 — 나의 취향 9선 | My 9 Picks — Girl Group Platter |
| `app.brand` | 여돌 구절판 | My 9 Picks |
| `app.kicker` | 2·2.5·3·4·5세대 여돌 | 2nd–5th gen girl groups |
| `app.eyebrow` | K-POP 여성 아이돌 | K-POP girl groups |
| `step.groups` | 그룹 선택 | Pick groups |
| `step.heat` | 후보 압축 | Shortlist |
| `step.challenge` | 재도전 | Second chance |
| `step.final` | 최종 9명 | Final 9 |
| `step.sort` | 비교 순위 | Rank them |
| `step.result` | 구절판 | Platter |
| `gen.2` | 2·2.5세대 | 2nd–2.5th gen |
| `gen.3` | 3세대 | 3rd gen |
| `gen.4` | 4세대 | 4th gen |
| `gen.5` | 5세대 | 5th gen |
| `gen.other` | {n}세대 | gen {n} |
| `common.members` | {n}명 | {n} members |
| `common.teams` | {n}팀 | {n} teams |
| `setup.tab.all` | 전체 | All |
| `setup.debut.label` | 데뷔순서 | Debut order |
| `setup.debut.asc` | 오름차순 ↑ | Oldest first ↑ |
| `setup.debut.desc` | 내림차순 ↓ | Newest first ↓ |
| `setup.debut.aria` | 데뷔순서 {order} | Debut order {order} |
| `setup.selectAll` | 전체 선택 | Select all |
| `setup.clearAll` | 선택 해제 | Clear |
| `setup.group.meta` | {gen} / {n}명 | {gen} / {n} members |
| `setup.group.disabled` | 프로젝트 종료 · 비교 제외 | Project ended · excluded |
| `setup.count` | {teams}팀 · {members}명 | {teams} teams · {members} members |
| `setup.minMembers` | 최소 9명 선택 | Pick at least 9 |
| `setup.start` | 시작 → | Start → |
| `setup.tooFew` | 9명 이상이 되도록 그룹을 선택해 주세요. | Pick groups so at least 9 members are eligible. |
| `heat.stage.round` | 예선 {round}/{total}라운드 | Heats {round}/{total} |
| `heat.stage.final` | 최종 선발 | Final pick |
| `heat.stage.challenge` | 재도전 | Second chance |
| `heat.screen` | {screen} / {total}판 | Board {screen} / {total} |
| `heat.progress.aria` | {stage} 진행률 | {stage} progress |
| `heat.pick` | {total}명 중 <em>{need}명</em> 선택 | Pick <em>{need}</em> of {total} |
| `heat.count` | {picked} / {need}명 | {picked} / {need} |
| `heat.next` | 다음 → | Next → |
| `heat.toSort` | 순위 비교 → | Rank them → |
| `heat.needMore` | 이번 화면에서 {need}명을 골라 주세요. | Pick {need} on this board. |
| `heat.maxPick` | 이번 화면에서 {need}명까지 고를 수 있어요. | You can pick up to {need} on this board. |
| `sort.title` | 순위 비교 | Rank them |
| `sort.count` | {n} / 최대 {limit}회 | {n} / max {limit} |
| `sort.progress.aria` | 순위 비교 진행률 | Ranking progress |
| `sort.pick` | 둘 중 <em>한 명</em> 선택 | Pick <em>one</em> of the two |
| `result.title` | 결과 | Result |
| `result.titleInput.aria` | 구절판 제목 | Platter title |
| `result.rank` | {n}위 | #{n} |
| `result.editPhoto` | 사진 편집 | Edit photo |
| `result.foot` | MY 9 PICKS · 여돌 구절판 | MY 9 PICKS |
| `result.privacy` | 바꾼 사진은 이 화면에서만 사용하며 서버로 전송하지 않아요. | Changed photos stay on this screen and are never uploaded. |
| `result.restart` | 새로 만들기 | Start over |
| `result.download` | 이미지 저장 ↓ | Save image ↓ |
| `result.downloading` | 이미지 만드는 중… | Building image… |
| `result.saved.title` | 구절판 이미지 | Platter image |
| `result.saved.hint` | 자동 저장이 안 되면 아래 이미지를 길게 눌러 저장해 주세요. | If it does not save automatically, long-press the image below. |
| `result.saved.alt` | 나의 구절판 완성 이미지 | My finished platter |
| `result.filename` | 나의_여돌_구절판.png | my-9-picks.png |
| `result.error` | 이미지를 저장하지 못했어요. 사진을 확인하고 다시 시도해 주세요. | Could not save the image. Check the photos and try again. |
| `crop.title` | {name} 사진 편집 | Edit photo — {name} |
| `crop.choose` | 내 사진 선택 | Choose my photo |
| `crop.reset` | 기본 사진으로 | Reset to default |
| `crop.zoom` | 확대 | Zoom |
| `crop.x` | 좌우 | Left / right |
| `crop.y` | 위아래 | Up / down |
| `crop.preview.alt` | 사진 미리보기 | Photo preview |
| `crop.privacy` | 사진은 기기 안에서만 처리돼요. | Photos are processed on your device only. |
| `crop.errType` | 이미지 파일을 선택해 주세요. | Please choose an image file. |
| `crop.errSize` | 20MB 이하 사진을 선택해 주세요. | Please choose a photo under 20 MB. |
| `crop.errRead` | 읽을 수 없는 사진이에요. JPG 또는 PNG로 다시 선택해 주세요. | Could not read that photo. Try a JPG or PNG. |
| `credits.button` | 멤버 기준 · 사진 출처 | Roster basis · photo credits |
| `credits.title` | 멤버 기준 · 사진 출처 | Roster basis · photo credits |
| `credits.body` | 확인일: {date}. 이달의 소녀는 츄를 포함한 12명이며, 프로젝트 팀 출신 멤버는 확인 가능한 현재 팀 표기를 함께 적었습니다. 기본 사진에는 그룹별 프로필 사진과 운영자가 제공한 사진이 포함되어 있습니다. 사진 권리는 원 권리자에게 있습니다. | Checked {date}. LOONA is counted as 12 including Chuu; members from project teams also show their currently verifiable team. Default photos include per-group profiles and photos provided by the operator. Photo rights belong to their original holders. |
| `credits.openSources` | 사진별 확인 출처 열기 | Open per-photo sources |
| `credits.rosterSource` | 명단·사진 출처 | Roster & photo source |
| `credits.operatorRoster` | 운영자 지정 명단 | Operator-provided roster |
| `credits.update` | 멤버 변동 확인 | Member changes |
| `credits.closed` | 프로젝트 종료 | Project ended |
| `dialog.close` | 닫기 | Close |
| `search.placeholder` | 이름·그룹 검색 | Search name or group |
| `search.aria` | 멤버 또는 그룹 검색 | Search members or groups |
| `search.count.members` | {n}명 / {total}명 | {n} / {total} members |
| `search.count.groups` | {n}팀 / {total}팀 | {n} / {total} teams |
| `search.empty` | 검색 결과가 없습니다 | No matches |
| `search.clear` | 지우기 | Clear |
| `lang.aria` | 언어 선택 | Choose language |

`i18n/ko.js` memakai kolom `ko`; `i18n/en.js` memakai kolom `en`.

**Kenapa `.js` dan bukan `.json`:** berkas JSON butuh `fetch()` (async, plus jalur
error baru dan state "memuat") atau import attributes (belum aman lintas browser).
Modul ES biasa diimpor sinkron dan identik di browser maupun Node, tanpa jalur
kegagalan tambahan. Menambah bahasa ke-3 = menambah `i18n/<kode>.js` dan satu
baris di `js/main.js`.

- [ ] **Step 6: Verifikasi kedua kamus punya key yang identik**

Run: `node -e "Promise.all([import('./i18n/ko.js'),import('./i18n/en.js')]).then(([a,b])=>{const ka=Object.keys(a.default),kb=Object.keys(b.default);const miss=ka.filter(k=>!(k in b.default)).concat(kb.filter(k=>!(k in a.default)));console.log('ko',ka.length,'en',kb.length,'selisih',miss);if(miss.length)process.exit(1)})"`
Expected: `ko 89 en 89 selisih []` (jumlah bisa berbeda sedikit; yang penting `selisih []`)

- [ ] **Step 7: Commit**

```bash
git add js/i18n.js i18n test/i18n.test.mjs
git commit -m "feat: modul i18n murni + kamus ko/en + test"
```

---

## Task 4: Modul search

**Files:**
- Create: `js/search.js`
- Create: `test/search.test.mjs`

**Interfaces:**
- Consumes: —
- Produces:
  - `normalize(value: unknown) -> string`
  - `buildIndex(items: {id}[], textOf: (item) => string) -> Map<id, string>`
  - `search(query: string, index: Map<id,string>) -> Set<id>` — query kosong/`"   "`/`"*"` mengembalikan **semua** id (tanpa filter)
  - `memberText(member, groupById: Map, genLabelFn: (gen) => string) -> string`
  - `groupText(group, genLabelFn) -> string`

**Konteks:** `genLabelFn` disuntikkan sebagai parameter supaya `js/search.js` tetap murni dan tidak mengimpor i18n.

- [ ] **Step 1: Tulis test yang gagal**

`test/search.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, groupText, memberText, normalize, search } from '../js/search.js';

const GROUPS = [
  { id: 'TWICE', name: 'TWICE', gen: 3, debut: '2015-10-20' },
  { id: '이달의 소녀', name: '이달의 소녀', gen: 4, debut: '2018-08-19' },
  { id: 'IZ*ONE', name: 'IZ*ONE', gen: 4, debut: '2018-10-29' },
  { id: 'woo!ah!', name: 'woo!ah!', gen: 4, debut: '2020-05-13' },
];
const groupById = new Map(GROUPS.map((g) => [g.id, g]));
const genLabel = (gen) => `${gen}세대`;
const MEMBERS = [
  { id: 'g_twice_sana', name: '사나', english: 'Sana', groups: ['TWICE'] },
  { id: 'g_twice_mina', name: '미나', english: 'Mina', groups: ['TWICE'] },
  { id: 'g_loona_chuu', name: '츄', english: 'Chuu', groups: ['이달의 소녀'] },
  { id: 'g_izone_wonyoung', name: '원영', english: 'Wonyoung', groups: ['IZ*ONE'] },
];
const index = buildIndex(MEMBERS, (m) => memberText(m, groupById, genLabel));

const hits = (q) => [...search(q, index)].sort();

// --- normalize -------------------------------------------------------------

test('normalize: huruf besar/kecil dan spasi berlebih', () => {
  assert.equal(normalize('  SanA  '), 'sana');
});

test('normalize: Hangul tetap utuh, tidak didekomposisi ke jamo', () => {
  assert.equal(normalize('트와이스'), '트와이스');
  assert.equal(normalize('이달의 소녀'), '이달의 소녀');
});

test('normalize: diakritik Latin dibuang, Hangul tidak rusak', () => {
  assert.equal(normalize('café'), 'cafe');
  assert.equal(normalize('Chuu'), 'chuu');
});

test('normalize: tanda baca dihapus, bukan diganti spasi', () => {
  assert.equal(normalize('IZ*ONE'), 'izone');
  assert.equal(normalize('woo!ah!'), 'wooah');
  assert.equal(normalize('H1-KEY'), 'h1key');
});

test('normalize: nilai kosong/null aman', () => {
  assert.equal(normalize(undefined), '');
  assert.equal(normalize(null), '');
  assert.equal(normalize(0), '0');
});

// --- search ----------------------------------------------------------------

test('search: nama Korea maupun romanisasi sama-sama menemukan', () => {
  assert.deepEqual(hits('사나'), ['g_twice_sana']);
  assert.deepEqual(hits('sana'), ['g_twice_sana']);
  assert.deepEqual(hits('SANA'), ['g_twice_sana']);
});

test('search: nama grup Korea maupun Latin menemukan', () => {
  assert.deepEqual(hits('twice'), ['g_twice_mina', 'g_twice_sana']);
  assert.deepEqual(hits('이달의 소녀'), ['g_loona_chuu']);
});

test('search: token digabung dengan AND dan tidak bergantung urutan', () => {
  assert.deepEqual(hits('sana twice'), ['g_twice_sana']);
  assert.deepEqual(hits('twice sana'), ['g_twice_sana']);
});

test('search: tanda baca di query tidak menghalangi', () => {
  assert.deepEqual(hits('iz*one'), ['g_izone_wonyoung']);
  assert.deepEqual(hits('izone'), ['g_izone_wonyoung']);
  assert.deepEqual(hits('woo!ah!'), []);
});

test('search: query kosong atau hanya tanda baca berarti TANPA filter', () => {
  const all = MEMBERS.map((m) => m.id).sort();
  for (const q of ['', '   ', '*', '()', '·']) {
    assert.deepEqual(hits(q), all, `query ${JSON.stringify(q)}`);
  }
});

test('search: query yang tidak cocok menghasilkan himpunan kosong', () => {
  assert.deepEqual(hits('zzzz'), []);
});

test('search: generasi bisa dicari lewat angka maupun label', () => {
  assert.deepEqual(hits('3'), ['g_twice_mina', 'g_twice_sana']);
  assert.deepEqual(hits('4세대'), ['g_izone_wonyoung', 'g_loona_chuu']);
});

// --- buildIndex / text -----------------------------------------------------

test('buildIndex memakai id sebagai kunci', () => {
  assert.deepEqual([...index.keys()].sort(), MEMBERS.map((m) => m.id).sort());
});

test('memberText memuat displayGroups bila ada', () => {
  const member = {
    id: 'g_gugudan_mina',
    name: '미나',
    english: 'Mina',
    groups: ['구구단', 'I.O.I'],
    displayGroups: ['I.O.I'],
  };
  const byId = new Map([
    ['구구단', { id: '구구단', name: '구구단', gen: 3 }],
    ['I.O.I', { id: 'I.O.I', name: 'I.O.I', gen: 3 }],
  ]);
  const text = memberText(member, byId, genLabel);
  assert.ok(text.includes('I.O.I'));
  assert.ok(text.includes('구구단'), 'groups lengkap tetap masuk index');
});

test('memberText aman bila id grup tidak dikenal', () => {
  const member = { id: 'x', name: '엑스', english: 'X', groups: ['TIDAK-ADA'] };
  assert.doesNotThrow(() => memberText(member, new Map(), genLabel));
});

test('groupText memuat id, name, dan label generasi', () => {
  const text = groupText(GROUPS[0], genLabel);
  assert.ok(text.includes('TWICE'));
  assert.ok(text.includes('3세대'));
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `node --test test/search.test.mjs`
Expected: FAIL — `Cannot find module '../js/search.js'`

- [ ] **Step 3: Tulis `js/search.js`**

```js
// Modul murni: tidak menyentuh document/window.

/**
 * NFD (bukan NFKD: NFKD mendekomposisi suku kata Hangul jadi jamo) -> buang
 * combining mark -> NFC (Hangul kembali utuh) -> hapus tanda baca (dihapus,
 * bukan jadi spasi, supaya "IZ*ONE" cocok dengan query "izone").
 */
export function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildIndex(items, textOf) {
  const index = new Map();
  for (const item of items) index.set(item.id, normalize(textOf(item)));
  return index;
}

/** Query kosong (termasuk yang hanya berisi tanda baca) = tanpa filter. */
export function search(query, index) {
  const tokens = normalize(query).split(' ').filter(Boolean);
  const out = new Set();
  for (const [id, haystack] of index) {
    if (tokens.every((token) => haystack.includes(token))) out.add(id);
  }
  return out;
}

export function memberText(member, groupById, genLabelFn) {
  const groups = member.groups.map((id) => groupById.get(id)).filter(Boolean);
  return [
    member.id,
    member.name,
    member.english,
    ...(member.displayGroups ?? []),
    ...groups.flatMap((g) => [g.id, g.name, String(g.gen), genLabelFn(g.gen)]),
  ]
    .filter(Boolean)
    .join(' ');
}

export function groupText(group, genLabelFn) {
  return [group.id, group.name, String(group.gen), genLabelFn(group.gen)]
    .filter(Boolean)
    .join(' ');
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `node --test test/search.test.mjs`
Expected: PASS, 15 test lulus.

- [ ] **Step 5: Commit**

```bash
git add js/search.js test/search.test.mjs
git commit -m "feat: modul search murni (normalize, index, query AND) + test"
```

---

## Task 5: Modul game (logika murni)

**Files:**
- Create: `js/game.js`
- Create: `test/game.test.mjs`

**Interfaces:**
- Consumes: —
- Produces:
  - `eligibleMembers(members: Member[], selected: Set<groupId>) -> Member[]`
  - `sortGroups(groups: Group[], debutDesc: boolean) -> Group[]` (salinan terurut, tidak memutasi)
  - `roundCount(n: number) -> number`
  - `sortLimit(n: number) -> number`
  - `initialOrder(ids: string[], firstGroupOf: (id) => string) -> string[]`
  - `interleave(rounds: string[][]) -> string[]`
  - `heatSize(poolLength: number, stage: 'main'|'challenge'|'final') -> number`
  - `createHeat() -> HeatState`
  - `beginHeat(hs) -> void`
  - `finishHeat(hs, pickedIds: string[]) -> { ok: false, need } | { ok: true, action: 'continue'|'advance' }`
  - `advanceHeat(hs) -> { next: 'heat' } | { next: 'sort', ids: string[] }`
  - `createSort() -> SortState`
  - `beginSort(st, ids: string[]) -> { ok: false, reason } | { done: boolean, result?: string[] }`
  - `chooseSort(st, id: string) -> { done: boolean, result?: string[] }`

**Konteks:** seluruh perilaku turnamen dan merge-sort diport apa adanya dari `app.js` asli; hanya variabel modul yang diganti menjadi field pada objek state yang dikembalikan.

- [ ] **Step 1: Tulis test yang gagal**

`test/game.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceHeat,
  beginHeat,
  beginSort,
  chooseSort,
  createHeat,
  createSort,
  eligibleMembers,
  finishHeat,
  heatSize,
  initialOrder,
  interleave,
  roundCount,
  sortGroups,
  sortLimit,
} from '../js/game.js';

const ids = (n, prefix = 'm') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

// --- aritmetika turnamen ---------------------------------------------------

test('roundCount: 20 ke bawah tidak butuh ronde', () => {
  assert.equal(roundCount(9), 0);
  assert.equal(roundCount(20), 0);
});

test('roundCount: 21 dan 475', () => {
  assert.equal(roundCount(21), 1);
  assert.equal(roundCount(475), 3);
});

test('sortLimit: batas perbandingan merge-sort', () => {
  assert.equal(sortLimit(0), 0);
  assert.equal(sortLimit(1), 0);
  assert.equal(sortLimit(2), 1);
  assert.equal(sortLimit(9), 21);
});

test('heatSize: 9 per layar, kecuali final yang membagi rata ke 9 slot', () => {
  assert.equal(heatSize(100, 'main'), 9);
  assert.equal(heatSize(100, 'challenge'), 9);
  assert.equal(heatSize(19, 'final'), 7);
});

// --- urutan & interleave ---------------------------------------------------

test('initialOrder menyebar member dari grup yang sama', () => {
  const firstGroup = { a: 'G1', b: 'G1', c: 'G2', d: 'G2', e: 'G3' };
  const out = initialOrder(['a', 'b', 'c', 'd', 'e'], (id) => firstGroup[id]);
  assert.deepEqual(out, ['a', 'c', 'e', 'b', 'd']);
});

test('interleave mengambil kolom lalu baris', () => {
  assert.deepEqual(interleave([['a', 'b', 'c'], ['d', 'e', 'f']]), ['a', 'd', 'b', 'e', 'c', 'f']);
  assert.deepEqual(interleave([['a', 'b', 'c'], ['d']]), ['a', 'd', 'b', 'c']);
});

// --- eligible & sortir grup ------------------------------------------------

test('eligibleMembers hanya memuat member dari grup terpilih', () => {
  const members = [
    { id: 'x', groups: ['A'] },
    { id: 'y', groups: ['B'] },
    { id: 'z', groups: ['A', 'B'] },
  ];
  assert.deepEqual(eligibleMembers(members, new Set(['A'])).map((m) => m.id), ['x', 'z']);
  assert.deepEqual(eligibleMembers(members, new Set()).map((m) => m.id), []);
});

test('eligibleMembers: member yang hanya ada di grup hidden tidak ikut', () => {
  const members = [
    { id: 'onlyHidden', groups: ['ARTMS'] },
    { id: 'both', groups: ['ARTMS', '이달의 소녀'] },
  ];
  const selected = new Set(['이달의 소녀']);
  assert.deepEqual(eligibleMembers(members, selected).map((m) => m.id), ['both']);
});

test('sortGroups: urut naik berdasarkan debut, tie-break id', () => {
  const groups = [
    { id: 'B', debut: '2010-01-01' },
    { id: 'A', debut: '2010-01-01' },
    { id: 'C', debut: '2009-01-01' },
  ];
  assert.deepEqual(sortGroups(groups, false).map((g) => g.id), ['C', 'A', 'B']);
  assert.deepEqual(sortGroups(groups, true).map((g) => g.id), ['B', 'A', 'C']);
});

test('sortGroups: debut hilang tidak melempar dan hasilnya deterministik', () => {
  const groups = [
    { id: 'has', debut: '2010-01-01' },
    { id: 'missing' },
    { id: 'empty', debut: '' },
  ];
  assert.doesNotThrow(() => sortGroups(groups, false));
  assert.deepEqual(sortGroups(groups, false).map((g) => g.id), ['empty', 'missing', 'has']);
  assert.deepEqual(sortGroups(groups, true).map((g) => g.id), ['has', 'empty', 'missing']);
});

test('sortGroups tidak memutasi masukan', () => {
  const groups = [{ id: 'B', debut: '2011-01-01' }, { id: 'A', debut: '2010-01-01' }];
  const before = groups.map((g) => g.id);
  sortGroups(groups, false);
  assert.deepEqual(groups.map((g) => g.id), before);
});

// --- alur heat -------------------------------------------------------------

function playHeat(hs, pick = 3) {
  const picks = hs.current.slice(0, Math.min(pick, hs.current.length)).map((m) => m.id);
  const res = finishHeat(hs, picks);
  assert.equal(res.ok, true);
  return res.action;
}

test('finishHeat menolak jumlah pilihan yang salah', () => {
  const hs = createHeat();
  hs.pool = ids(21);
  beginHeat(hs);
  const res = finishHeat(hs, ['m0']);
  assert.equal(res.ok, false);
  assert.equal(res.need, 3);
});

test('heat 21 member: 3 layar -> 9 pemenang -> 12 kalah -> tantangan', () => {
  const hs = createHeat();
  hs.pool = ids(21);
  hs.roundTotal = roundCount(21);
  beginHeat(hs);

  assert.equal(hs.current.length, 9);
  assert.equal(playHeat(hs), 'continue');
  assert.equal(hs.current.length, 9);
  assert.equal(playHeat(hs), 'continue');
  assert.equal(hs.current.length, 3);
  assert.equal(playHeat(hs), 'advance');

  const next = advanceHeat(hs);
  assert.equal(next.next, 'heat');
  assert.equal(hs.stage, 'challenge');
  assert.equal(hs.pool.length, 12);
  assert.equal(hs.mainSurvivors.length, 9);
});

test('heat berlanjut sampai menghasilkan daftar untuk sort', () => {
  const hs = createHeat();
  hs.pool = ids(21);
  hs.roundTotal = roundCount(21);
  beginHeat(hs);

  let guard = 0;
  let outcome = { next: 'heat' };
  while (outcome.next === 'heat') {
    if (guard++ > 100) throw new Error('heat tidak pernah selesai');
    while (true) {
      const action = playHeat(hs);
      if (action === 'advance') break;
    }
    outcome = advanceHeat(hs);
  }

  assert.equal(outcome.next, 'sort');
  assert.ok(outcome.ids.length >= 9, `kandidat sort = ${outcome.ids.length}`);
  assert.equal(new Set(outcome.ids).size, outcome.ids.length, 'ada id duplikat');
});

// --- merge sort ------------------------------------------------------------

function runSort(input, choose) {
  const st = createSort();
  let res = beginSort(st, input);
  let guard = 0;
  while (!res.done) {
    if (guard++ > 10000) throw new Error('sort tidak pernah selesai');
    const nextId = choose(st);
    res = chooseSort(st, nextId);
  }
  return { st, result: res.result };
}

test('beginSort menolak kandidat kurang dari 9', () => {
  const res = beginSort(createSort(), ids(8));
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'too-few');
});

test('selalu memilih kiri mempertahankan urutan masukan', () => {
  const input = ids(9);
  const { result } = runSort(input, (st) => st.left);
  assert.deepEqual(result, input);
});

test('selalu memilih kanan membalik urutan masukan', () => {
  const input = ids(9);
  const { result } = runSort(input, (st) => st.right);
  assert.deepEqual(result, [...input].reverse());
});

test('merge sort memakai perbandingan tidak lebih dari batasnya', () => {
  const input = ids(15);
  const { st, result } = runSort(input, (st) => st.left);
  assert.equal(result.length, 15);
  assert.ok(st.comparisons <= sortLimit(15), `${st.comparisons} > ${sortLimit(15)}`);
});

test('hasil sort selalu 9 teratas dan tanpa duplikat', () => {
  const { result } = runSort(ids(23), (st) => st.left);
  assert.equal(result.length, 9);
  assert.equal(new Set(result).size, 9);
});

test('chooseSort mengabaikan id yang bukan kandidat', () => {
  const st = createSort();
  beginSort(st, ids(9));
  const res = chooseSort(st, 'bukan-kandidat');
  assert.equal(res.done, false);
  assert.equal(st.comparisons, 0);
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `node --test test/game.test.mjs`
Expected: FAIL — `Cannot find module '../js/game.js'`

- [ ] **Step 3: Tulis `js/game.js`**

```js
// Modul murni: tidak menyentuh document/window. Semua mutasi terjadi pada
// objek state yang diberikan sebagai argumen.

// --- pemilihan dari roster -------------------------------------------------

/** Member yang tergabung di minimal satu grup terpilih. */
export function eligibleMembers(members, selected) {
  return members.filter((m) => m.groups.some((g) => selected.has(g)));
}

/** Salinan terurut. `debut` yang hilang/kosong diperlakukan sebagai string kosong. */
export function sortGroups(groups, debutDesc) {
  const dir = debutDesc ? -1 : 1;
  return [...groups].sort((a, b) => {
    const da = String(a.debut ?? '');
    const db = String(b.debut ?? '');
    return dir * (da.localeCompare(db) || String(a.id).localeCompare(String(b.id)));
  });
}

// --- aritmetika turnamen ---------------------------------------------------

/** Berapa ronde heat yang dibutuhkan sebelum sisa kandidat <= 20. */
export function roundCount(n) {
  let count = 0;
  while (n > 20) {
    count++;
    n = 3 * Math.floor(n / 9) + Math.min(3, n % 9);
  }
  return count;
}

/** Batas atas perbandingan merge-sort untuk n elemen. */
export function sortLimit(n) {
  if (n <= 1) return 0;
  const left = Math.floor(n / 2);
  return sortLimit(left) + sortLimit(n - left) + n - 1;
}

/** Bagi rata ke dalam ember per grup lalu ambil bergiliran, supaya member satu grup tidak beradu di layar yang sama. */
export function initialOrder(ids, firstGroupOf) {
  const buckets = new Map();
  for (const id of ids) {
    const key = firstGroupOf(id);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(id);
  }
  const out = [];
  while (out.length < ids.length) {
    for (const bucket of buckets.values()) if (bucket.length) out.push(bucket.shift());
  }
  return out;
}

/** Ambil kolom 0..2 dari tiap ronde, bergantian. */
export function interleave(rounds) {
  const out = [];
  for (let col = 0; col < 3; col++) {
    for (const round of rounds) if (round[col]) out.push(round[col]);
  }
  return out;
}

/** Layar final dibagi rata ke 9 slot, layar lain menampung 9 orang. */
export function heatSize(poolLength, stage) {
  return stage === 'final'
    ? Math.ceil(poolLength / Math.ceil(poolLength / 9))
    : 9;
}

// --- state machine heat ----------------------------------------------------

export function createHeat() {
  return {
    stage: 'main', // 'main' | 'challenge' | 'final'
    round: 1,
    roundTotal: 1,
    pool: [],
    winners: [],
    losers: [],
    index: 0,
    current: [],
    selected: new Set(),
    mainSurvivors: [],
  };
}

/** Muat layar berikutnya ke `hs.current` dan kosongkan pilihan. */
export function beginHeat(hs) {
  const size = heatSize(hs.pool.length, hs.stage);
  hs.current = hs.pool.slice(hs.index, hs.index + size);
  hs.index += hs.current.length;
  hs.selected = new Set();
}

/**
 * Catat hasil satu layar. Mengembalikan 'continue' bila masih ada layar lain
 * di pool yang sama, 'advance' bila pool ini sudah habis.
 */
export function finishHeat(hs, pickedIds) {
  const need = Math.min(3, hs.current.length);
  if (pickedIds.length !== need) return { ok: false, need };

  const picked = new Set(pickedIds);
  hs.winners.push(hs.current.filter((id) => picked.has(id)));
  if (hs.stage === 'main') {
    hs.losers.push(...hs.current.filter((id) => !picked.has(id)));
  }

  if (hs.index < hs.pool.length) return { ok: true, action: 'continue' };
  return { ok: true, action: 'advance' };
}

/** Tentukan fase berikutnya setelah satu pool selesai. */
export function advanceHeat(hs) {
  if (hs.stage === 'final') {
    return { next: 'sort', ids: interleave(hs.winners) };
  }

  if (hs.stage === 'challenge') {
    const challenged = interleave(hs.winners);
    const candidates = [];
    for (let i = 0; i < Math.max(hs.mainSurvivors.length, challenged.length); i++) {
      if (hs.mainSurvivors[i]) candidates.push(hs.mainSurvivors[i]);
      if (challenged[i]) candidates.push(challenged[i]);
    }
    if (candidates.length >= 19) {
      hs.stage = 'final';
      hs.pool = candidates;
      hs.winners = [];
      hs.index = 0;
      beginHeat(hs);
      return { next: 'heat' };
    }
    return { next: 'sort', ids: candidates };
  }

  const winners = interleave(hs.winners);
  if (winners.length <= 20) {
    hs.mainSurvivors = winners;
    if (hs.losers.length) {
      hs.stage = 'challenge';
      hs.pool = [...hs.losers];
      hs.winners = [];
      hs.index = 0;
      beginHeat(hs);
      return { next: 'heat' };
    }
    return { next: 'sort', ids: winners };
  }

  hs.round++;
  hs.pool = winners;
  hs.winners = [];
  hs.losers = [];
  hs.index = 0;
  beginHeat(hs);
  return { next: 'heat' };
}

// --- state machine merge sort ----------------------------------------------

export function createSort() {
  return {
    stack: [],
    left: null,
    right: null,
    comparisons: 0,
    candidateCount: 0,
    done: false,
    result: [],
  };
}

function finishSort(st, result) {
  st.done = true;
  st.result = result;
  st.left = null;
  st.right = null;
  return { done: true, result };
}

export function beginSort(st, ids) {
  if (ids.length < 9) return { ok: false, reason: 'too-few', count: ids.length };
  st.candidateCount = ids.length;
  st.stack = [{ ids: [...ids], stage: 0 }];
  st.left = null;
  st.right = null;
  st.comparisons = 0;
  st.done = false;
  st.result = [];
  return beginMerge(st);
}

/**
 * Jalankan stack sampai butuh keputusan manusia, lalu berhenti dengan
 * `st.left` dan `st.right` berisi dua kandidat yang harus dibandingkan.
 */
export function beginMerge(st) {
  while (st.stack.length) {
    const frame = st.stack.at(-1);

    if (frame.ids.length === 1) {
      st.stack.pop();
      if (!st.stack.length) return finishSort(st, frame.ids.slice(0, 9));
      const parent = st.stack.at(-1);
      if (parent.stage === 1) parent.left = frame.ids;
      else parent.right = frame.ids;
      continue;
    }

    if (frame.stage === 0) {
      frame.stage = 1;
      st.stack.push({ ids: frame.ids.slice(0, Math.floor(frame.ids.length / 2)), stage: 0 });
      continue;
    }

    if (frame.stage === 1 && frame.left) {
      frame.stage = 2;
      st.stack.push({ ids: frame.ids.slice(Math.floor(frame.ids.length / 2)), stage: 0 });
      continue;
    }

    if (frame.stage === 2 && frame.right) {
      frame.stage = 3;
      frame.out = [];
      frame.l = 0;
      frame.r = 0;
    }

    if (frame.stage === 3) {
      if (frame.l === frame.left.length || frame.r === frame.right.length) {
        frame.out.push(...frame.left.slice(frame.l), ...frame.right.slice(frame.r));
        st.stack.pop();
        if (!st.stack.length) return finishSort(st, frame.out.slice(0, 9));
        const parent = st.stack.at(-1);
        if (parent.stage === 1) parent.left = frame.out;
        else parent.right = frame.out;
        continue;
      }
      st.left = frame.left[frame.l];
      st.right = frame.right[frame.r];
      return { done: false };
    }

    return { done: false };
  }
  return finishSort(st, st.result);
}

/** Catat pilihan pengguna untuk satu perbandingan, lalu lanjutkan merge. */
export function chooseSort(st, id) {
  const frame = st.stack.at(-1);
  if (!frame || frame.stage !== 3) return { done: false, ignored: true };

  if (id === st.left) frame.l++;
  else if (id === st.right) frame.r++;
  else return { done: false, ignored: true };

  st.comparisons++;
  return beginMerge(st);
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `node --test test/game.test.mjs`
Expected: PASS, 20 test lulus.

- [ ] **Step 5: Commit**

```bash
git add js/game.js test/game.test.mjs
git commit -m "feat: logika turnamen dan merge-sort sebagai modul murni + test"
```

---

## Task 6: Helper view murni

**Files:**
- Create: `js/view.js`
- Create: `test/view.test.mjs`

**Interfaces:**
- Consumes: `GROUPS`, `MEMBERS` dari `data/roster.js`
- Produces:
  - `esc(value) -> string`
  - `visibleGroups() -> Group[]`
  - `EN_GROUP_OVERRIDES: Record<groupId, string>`
  - `groupLabel(group, locale) -> string`
  - `memberLabel(member, locale) -> string`
  - `groupLines(member, groupById, locale) -> string[]`
  - `labelsOf(member, groupById, locale) -> string` (= `groupLines(...).join(' / ')`)
  - `initialsOf(member, locale) -> string`
  - `defaultPhoto(member) -> { url, x, y, zoom }`
  - `photoOf(member, custom) -> { url, x, y, zoom }`
  - `portrait(member, custom) -> string` (HTML `<img>`)
  - `memberCard(member, { custom, groupById, locale, picked }) -> string`
  - `bar(left, right) -> string`
  - `stepIndex(state) -> 0..5`
  - `steps(state, t) -> string`

**Konteks — kenapa modul terpisah:** `js/view.js` hanya menghasilkan string, tidak menyentuh DOM, jadi bisa diimpor `node --test`. Fase-fase (`js/phases/*`) mengimpor modul ini, dan `js/render.js` mengimpor fase-fase. Arah impor satu arah, tidak ada siklus.

**Konteks — label grup EN:** 29 grup ber-`name` Hangul, dan 19 di antaranya punya `id` yang juga Hangul (`id === name`), sehingga `id` tidak bisa dipakai sebagai label Inggris. Karena itu ada peta override manual.

- [ ] **Step 1: Tulis test yang gagal**

`test/view.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EN_GROUP_OVERRIDES,
  bar,
  defaultPhoto,
  esc,
  groupLabel,
  groupLines,
  initialsOf,
  labelsOf,
  memberCard,
  memberLabel,
  portrait,
  stepIndex,
  steps,
  visibleGroups,
} from '../js/view.js';
import { GROUPS } from '../data/roster.js';

const groupById = new Map(GROUPS.map((g) => [g.id, g]));
const byId = (id) => groupById.get(id);

// --- esc -------------------------------------------------------------------

test('esc meng-escape lima karakter berbahaya', () => {
  assert.equal(esc(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('esc aman untuk null/undefined', () => {
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
});

// --- visibleGroups ---------------------------------------------------------

test('visibleGroups menyembunyikan grup hidden', () => {
  const visible = visibleGroups();
  assert.ok(visible.length > 0);
  assert.ok(visible.every((g) => !g.hidden));
  assert.ok(!visible.some((g) => g.id === 'ARTMS'));
  assert.ok(visible.length < GROUPS.length, 'ada grup hidden yang ikut tampil');
});

// --- label grup & member ---------------------------------------------------

test('groupLabel memakai name untuk ko', () => {
  assert.equal(groupLabel(byId('이달의 소녀'), 'ko'), '이달의 소녀');
  assert.equal(groupLabel(byId('TWICE'), 'ko'), 'TWICE');
});

test('groupLabel memakai override untuk grup ber-id Hangul', () => {
  assert.equal(groupLabel(byId('이달의 소녀'), 'en'), 'LOONA');
  assert.equal(groupLabel(byId('아이들'), 'en'), '(G)I-DLE');
  assert.equal(groupLabel(byId('프로미스나인'), 'en'), 'fromis_9');
});

test('groupLabel memakai id untuk en bila berbeda dari name', () => {
  assert.equal(groupLabel(byId('SISTAR'), 'en'), 'SISTAR');
  assert.equal(groupLabel(byId('miss A'), 'en'), 'miss A');
});

test('groupLabel memakai override untuk SNSD', () => {
  assert.equal(groupLabel(byId('SNSD'), 'en'), "Girls' Generation");
});

test('groupLabel tidak pernah mencetak undefined', () => {
  for (const g of GROUPS) {
    for (const locale of ['ko', 'en']) {
      const label = groupLabel(g, locale);
      assert.ok(label && label !== 'undefined', `${g.id} / ${locale}`);
    }
  }
});

test('setiap grup ber-name Hangul punya label EN non-Hangul', () => {
  const hangul = /[\uac00-\ud7a3]/;
  const offenders = GROUPS.filter(
    (g) => hangul.test(g.name) && hangul.test(groupLabel(g, 'en')),
  ).map((g) => g.id);
  assert.deepEqual(offenders, [], `grup tanpa label Inggris: ${offenders}`);
});

test('EN_GROUP_OVERRIDES tidak memuat key yang bukan id grup', () => {
  for (const key of Object.keys(EN_GROUP_OVERRIDES)) {
    assert.ok(groupById.has(key), `override untuk grup yang tidak ada: ${key}`);
  }
});

test('memberLabel mengikuti bahasa', () => {
  const member = { name: '사나', english: 'Sana' };
  assert.equal(memberLabel(member, 'ko'), '사나');
  assert.equal(memberLabel(member, 'en'), 'Sana');
});

// --- labelsOf --------------------------------------------------------------

test('labelsOf memakai displayGroups bila ada', () => {
  const member = { id: 'x', groups: ['구구단', 'I.O.I'], displayGroups: ['I.O.I'] };
  assert.equal(labelsOf(member, groupById, 'ko'), 'I.O.I');
});

test('labelsOf memakai groups bila displayGroups kosong', () => {
  const member = { id: 'x', groups: ['TWICE'] };
  assert.equal(labelsOf(member, groupById, 'ko'), 'TWICE');
});

test('labelsOf: displayGroups berisi id asing -> jatuh ke groups', () => {
  const member = { id: 'x', groups: ['TWICE'], displayGroups: ['TIDAK-ADA'] };
  assert.equal(labelsOf(member, groupById, 'ko'), 'TWICE');
});

test('labelsOf tidak pernah mencetak undefined saat semua id asing', () => {
  const member = { id: 'g_asing', groups: ['TIDAK-ADA'], displayGroups: ['JUGA-TIDAK-ADA'] };
  const label = labelsOf(member, groupById, 'ko');
  assert.equal(label, 'g_asing');
  assert.ok(!label.includes('undefined'));
});

test('groupLines mengembalikan satu entri per grup', () => {
  const member = { id: 'x', groups: ['구구단', 'I.O.I'], displayGroups: ['I.O.I'] };
  assert.deepEqual(groupLines(member, groupById, 'ko'), ['I.O.I']);
  const multi = { id: 'y', groups: ['여자친구', 'VIVIZ'], displayGroups: ['여자친구', 'VIVIZ'] };
  assert.deepEqual(groupLines(multi, groupById, 'en'), ['GFRIEND', 'VIVIZ']);
});

// --- foto ------------------------------------------------------------------

test('defaultPhoto memakai crop member bila ada', () => {
  assert.deepEqual(
    defaultPhoto({ id: 'a', image: 'photos/a.jpg', crop: { x: 40, y: 10, zoom: 1.5 } }),
    { url: 'photos/a.jpg', x: 40, y: 10, zoom: 1.5 },
  );
});

test('defaultPhoto memakai nilai bawaan bila crop tidak ada', () => {
  assert.deepEqual(defaultPhoto({ id: 'a', image: 'photos/a.jpg' }), {
    url: 'photos/a.jpg',
    x: 50,
    y: 25,
    zoom: 1,
  });
});

test('portrait memuat object-position dan scale dari crop', () => {
  const html = portrait({ id: 'a', image: 'photos/a.jpg', english: 'A', crop: { x: 10, y: 20, zoom: 2 } }, {});
  assert.ok(html.includes('object-position:10% 20%'));
  assert.ok(html.includes('scale(2)'));
  assert.ok(html.includes('data-member="a"'));
});

test('initialsOf memakai dua huruf pertama label', () => {
  assert.equal(initialsOf({ name: '사나', english: 'Sana' }, 'en'), 'SA');
  assert.equal(initialsOf({ name: '츄', english: 'Chuu' }, 'ko'), '츄');
});

// --- kartu & bar -----------------------------------------------------------

test('memberCard menandai pilihan dan menampilkan grup', () => {
  const html = memberCard(
    { id: 'g_twice_sana', name: '사나', english: 'Sana', groups: ['TWICE'] },
    { custom: {}, groupById, locale: 'en', picked: true },
  );
  assert.ok(html.includes('picked'));
  assert.ok(html.includes('aria-pressed="true"'));
  assert.ok(html.includes('Sana'));
  assert.ok(html.includes('TWICE'));
});

test('bar membungkus dua sisi', () => {
  assert.equal(
    bar('kiri', 'kanan'),
    '<div class="bottom-bar"><div class="bar-inner"><div>kiri</div><div>kanan</div></div></div>',
  );
});

// --- steps -----------------------------------------------------------------

test('stepIndex memetakan fase dan sub-tahap heat', () => {
  assert.equal(stepIndex({ phase: 'setup' }), 0);
  assert.equal(stepIndex({ phase: 'heat', heat: { stage: 'main' } }), 1);
  assert.equal(stepIndex({ phase: 'heat', heat: { stage: 'challenge' } }), 2);
  assert.equal(stepIndex({ phase: 'heat', heat: { stage: 'final' } }), 3);
  assert.equal(stepIndex({ phase: 'sort' }), 4);
  assert.equal(stepIndex({ phase: 'result' }), 5);
});

test('steps menandai langkah aktif dan memakai kunci i18n', () => {
  const t = (key) => `[${key}]`;
  const html = steps({ phase: 'sort' }, t);
  assert.equal((html.match(/class="current"/g) ?? []).length, 1);
  assert.ok(html.includes('[step.sort]'));
  assert.ok(html.includes('05'));
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `node --test test/view.test.mjs`
Expected: FAIL — `Cannot find module '../js/view.js'`

- [ ] **Step 3: Tulis `js/view.js`**

```js
// Modul murni: hanya menghasilkan string, tidak menyentuh DOM.
import { GROUPS } from '../data/roster.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Grup yang tampil di grid: `hidden` disembunyikan, `disabled` tampil tapi mati. */
export const visibleGroups = () => GROUPS.filter((g) => !g.hidden);

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * 19 grup ber-`name` Hangul punya `id` yang juga Hangul, jadi `id` tidak bisa
 * dipakai sebagai label Inggris. Peta ini menambalnya, plus SNSD.
 */
export const EN_GROUP_OVERRIDES = {
  SNSD: "Girls' Generation",
  걸스데이: "Girl's Day",
  에이핑크: 'Apink',
  크레용팝: 'Crayon Pop',
  마마무: 'MAMAMOO',
  레드벨벳: 'Red Velvet',
  라붐: 'LABOUM',
  러블리즈: 'Lovelyz',
  여자친구: 'GFRIEND',
  오마이걸: 'OH MY GIRL',
  우주소녀: 'WJSN',
  구구단: 'gugudan',
  모모랜드: 'MOMOLAND',
  드림캐쳐: 'Dreamcatcher',
  위키미키: 'Weki Meki',
  프로미스나인: 'fromis_9',
  아이들: '(G)I-DLE',
  네이처: 'NATURE',
  '이달의 소녀': 'LOONA',
  퍼플키스: 'PURPLE KISS',
};

export function groupLabel(group, locale) {
  if (!group) return '';
  if (locale !== 'en') return group.name;
  return EN_GROUP_OVERRIDES[group.id] ?? (group.id !== group.name ? group.id : group.name);
}

export function memberLabel(member, locale) {
  if (!member) return '';
  return locale === 'en' ? member.english : member.name;
}

/** Satu baris per grup, dipakai poster (yang menggambar tiap grup di baris sendiri). */
export function groupLines(member, groupById, locale) {
  const primary = member.displayGroups?.length ? member.displayGroups : member.groups;
  const known = primary.filter((id) => groupById.has(id));
  const safe = known.length ? known : member.groups.filter((id) => groupById.has(id));
  if (!safe.length) return [member.id];
  return safe.map((id) => groupLabel(groupById.get(id), locale));
}

/** `displayGroups` bila ada dan dikenal, selain itu `groups`, selain itu id member. */
export const labelsOf = (member, groupById, locale) =>
  groupLines(member, groupById, locale).join(' / ');

export function initialsOf(member, locale) {
  const label = memberLabel(member, locale).trim();
  return label.slice(0, 2).toUpperCase() || '?';
}

export function defaultPhoto(member) {
  return {
    url: member.image,
    x: member.crop?.x ?? 50,
    y: member.crop?.y ?? 25,
    zoom: member.crop?.zoom ?? 1,
  };
}

export function photoOf(member, custom) {
  return custom[member.id] ?? defaultPhoto(member);
}

export function portrait(member, custom) {
  const photo = photoOf(member, custom);
  return (
    `<img src="${esc(photo.url)}" alt="${esc(memberLabel(member, 'ko'))}" loading="lazy" ` +
    `data-member="${esc(member.id)}" ` +
    `style="object-position:${photo.x}% ${photo.y}%;transform:scale(${photo.zoom})">`
  );
}

export function memberCard(member, { custom, groupById, locale, picked = false }) {
  return (
    `<button class="member ${picked ? 'picked' : ''}" type="button" ` +
    `data-member="${esc(member.id)}" aria-pressed="${picked}">` +
    `<div class="portrait">${portrait(member, custom)}<span class="check">${picked ? '✓' : ''}</span></div>` +
    `<div class="member-name">${esc(memberLabel(member, locale))}</div>` +
    `<div class="member-group">${esc(labelsOf(member, groupById, locale))}</div>` +
    `</button>`
  );
}

export function bar(left, right) {
  return `<div class="bottom-bar"><div class="bar-inner"><div>${left}</div><div>${right}</div></div></div>`;
}

const STEP_KEYS = [
  'step.groups',
  'step.heat',
  'step.challenge',
  'step.final',
  'step.sort',
  'step.result',
];

export function stepIndex(state) {
  if (state.phase === 'setup') return 0;
  if (state.phase === 'heat') {
    if (state.heat.stage === 'main') return 1;
    if (state.heat.stage === 'challenge') return 2;
    return 3;
  }
  if (state.phase === 'sort') return 4;
  return 5;
}

export function steps(state, t) {
  const current = stepIndex(state);
  return (
    `<div class="steps">` +
    STEP_KEYS.map(
      (key, i) =>
        `<span class="${i === current ? 'current' : ''}">${String(i + 1).padStart(2, '0')} ${esc(t(key))}</span>`,
    ).join('') +
    `</div>`
  );
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `node --test test/view.test.mjs`
Expected: PASS, 24 test lulus.

- [ ] **Step 5: Commit**

```bash
git add js/view.js test/view.test.mjs
git commit -m "feat: helper view murni + label grup EN + test"
```

---

## Task 7: Shell, state, render, dan fase setup

**Files:**
- Create: `index.html`
- Create: `style.css` (port dari situs asli, lalu ditambah gaya kotak search di Task 8)
- Create: `js/state.js`
- Create: `js/render.js`
- Create: `js/phases/setup.js`
- Create: `js/main.js`
- Create: `js/phases/heat.js`, `js/phases/sort.js`, `js/phases/result.js` (stub sementara yang digantikan Task 9–11)

**Interfaces:**
- Consumes: `js/i18n.js`, `js/search.js`, `js/game.js`, `js/view.js`, `data/roster.js`
- Produces:
  - `createState() -> State` dengan `State = { lang, query, debutDesc, selected: Set, phase, pool: string[], finalists: string[], title, titleTouched: boolean, cropId, custom: {}, heat: HeatState, sort: SortState }`
  - Action state: `toggleGeneration(state, gen)`, `toggleGroup(state, id)`, `selectAllVisible(state)`, `clearAllVisible(state)`, `toggleDebut(state)`, `setLang(state, lang)`, `setQuery(state, q)`, `setPhase(state, phase)`, `startGame(state, { onTooFew }) -> boolean`, `enterSort(state, ids) -> boolean`
  - `render(state, ctx) -> string`
  - `ctx = { t, groupById: Map, memberById: Map, memberIndex: Map, groupIndex: Map }`

**Konteks — `state.gen` dibuang.** Di `app.js` asli, variabel `gen` hanya di-assign sekali saat inisialisasi (`gen=0`) dan tidak pernah diubah; `visibleGroups()` karena itu tidak pernah memfilter, dan tab generasi sebenarnya hanya melakukan pilih/hapus massal per generasi. Port ini mempertahankan perilaku itu secara sengaja: `toggleGeneration` menggantikan `gen`, dan `state.gen` tidak ada.

- [ ] **Step 1: Port `style.css` dari situs asli**

```bash
curl -s "https://mygirlnine.pages.dev/style.css?v=20260928-weeklyfix" -o style.css
wc -c style.css
```

Expected: `9914 style.css` (atau mirip). Berkas ini dipakai apa adanya; gaya tambahan ditulis di Task 8.

- [ ] **Step 2: Tulis `index.html`**

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#161616">
<title>여돌 구절판 — 나의 취향 9선</title>
<meta name="description" content="나의 취향 9선">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23161616'/%3E%3Ctext x='7' y='25' font-size='27' font-family='Arial' font-weight='bold' fill='%23c3ff64'%3E9%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="style.css">
</head>
<body>
<header>
  <a href="./" class="brand">여돌 구절판</a>
  <div class="lang-switch" id="langSwitch" role="group">
    <button type="button" data-lang="ko">한국어</button>
    <button type="button" data-lang="en">English</button>
  </div>
</header>
<main id="app"></main>
<footer><button id="credits" class="text-button" type="button"></button></footer>
<dialog id="dialog"><div id="dialogBody"></div><button id="closeDialog" class="outline" type="button"></button></dialog>
<div id="toast" role="status"></div>
<script type="module" src="js/main.js"></script>
</body>
</html>
```

- [ ] **Step 3: Tulis `js/state.js`**

```js
import { GROUPS, MEMBERS } from '../data/roster.js';
import {
  beginHeat,
  beginSort,
  createHeat,
  createSort,
  eligibleMembers,
  initialOrder,
  roundCount,
} from './game.js';

const memberById = new Map(MEMBERS.map((m) => [m.id, m]));

const selectableGroups = () => GROUPS.filter((g) => !g.disabled && !g.hidden);

export function createState() {
  return {
    lang: 'ko',
    query: '',
    debutDesc: false,
    selected: new Set(selectableGroups().map((g) => g.id)),
    phase: 'setup',
    pool: [],
    finalists: [],
    title: '',
    titleTouched: false,
    cropId: null,
    custom: {},
    heat: createHeat(),
    sort: createSort(),
  };
}

// --- aksi pemilihan --------------------------------------------------------

export function toggleGroup(state, groupId) {
  if (state.selected.has(groupId)) state.selected.delete(groupId);
  else state.selected.add(groupId);
}

/** Tab generasi: pilih semua bila belum semua, hapus semua bila sudah semua. */
export function toggleGeneration(state, gen) {
  const subset = GROUPS.filter((g) => !g.disabled && !g.hidden && (!gen || g.gen === gen));
  const allSelected = subset.length > 0 && subset.every((g) => state.selected.has(g.id));
  for (const g of subset) {
    if (allSelected) state.selected.delete(g.id);
    else state.selected.add(g.id);
  }
}

export function selectAllVisible(state) {
  for (const g of selectableGroups()) state.selected.add(g.id);
}

export function clearAllVisible(state) {
  for (const g of GROUPS) if (!g.hidden) state.selected.delete(g.id);
}

export function toggleDebut(state) {
  state.debutDesc = !state.debutDesc;
}

export function setLang(state, lang) {
  state.lang = lang;
}

/** Satu-satunya penulis `query`. Tidak pernah menyentuh `selected`. */
export function setQuery(state, query) {
  state.query = query;
}

/** Satu-satunya tempat transisi fase. Selalu mengosongkan query. */
export function setPhase(state, phase) {
  state.phase = phase;
  state.query = '';
}

// --- alur permainan --------------------------------------------------------

export function startGame(state, { onTooFew } = {}) {
  const eligible = eligibleMembers(MEMBERS, state.selected);
  if (eligible.length < 9) {
    onTooFew?.();
    return false;
  }

  state.pool = eligible.map((m) => m.id);
  state.custom = {};
  state.finalists = [];
  state.heat = createHeat();
  state.heat.roundTotal = roundCount(state.pool.length);
  state.heat.pool = initialOrder(state.pool, (id) => memberById.get(id)?.groups?.[0] ?? '');

  if (state.pool.length <= 20) return enterSort(state, state.heat.pool);

  setPhase(state, 'heat');
  beginHeat(state.heat);
  return true;
}

export function enterSort(state, ids) {
  const sort = createSort();
  const res = beginSort(sort, ids);
  if (!res.ok) return false;
  state.sort = sort;
  setPhase(state, 'sort');
  return true;
}
```

- [ ] **Step 4: Tulis `js/render.js`**

```js
import { renderHeat } from './phases/heat.js';
import { renderResult } from './phases/result.js';
import { renderSetup } from './phases/setup.js';
import { renderSort } from './phases/sort.js';

/** Murni: mengembalikan HTML, tidak menyentuh DOM. */
export function render(state, ctx) {
  if (state.phase === 'setup') return renderSetup(state, ctx);
  if (state.phase === 'heat') return renderHeat(state, ctx);
  if (state.phase === 'sort') return renderSort(state, ctx);
  return renderResult(state, ctx);
}
```

- [ ] **Step 5: Tulis `js/phases/setup.js`**

```js
import { GROUPS, MEMBERS } from '../../data/roster.js';
import { eligibleMembers, sortGroups } from '../game.js';
import { genLabel } from '../i18n.js';
import { bar, esc, groupLabel, steps, visibleGroups } from '../view.js';

const GENERATION_TABS = [0, 2, 3, 4, 5];

export function renderSetup(state, ctx) {
  const { t } = ctx;
  const locale = state.lang;
  const eligible = eligibleMembers(MEMBERS, state.selected);
  const groups = sortGroups(visibleGroups(), state.debutDesc);

  const tabs = GENERATION_TABS.map((gen) => {
    const subset = GROUPS.filter((g) => !g.disabled && !g.hidden && (!gen || g.gen === gen));
    const on = subset.length > 0 && subset.every((g) => state.selected.has(g.id));
    const label = gen === 0 ? t('setup.tab.all') : genLabel(gen, t);
    return `<button class="tab ${on ? 'on' : ''}" type="button" data-gen="${gen}">${esc(label)}</button>`;
  }).join('');

  const cards = groups
    .map((g) => {
      const selected = state.selected.has(g.id);
      const count = MEMBERS.filter((m) => m.groups.includes(g.id)).length;
      const meta = g.disabled
        ? t('setup.group.disabled')
        : t('setup.group.meta', { gen: genLabel(g.gen, t), n: count });
      return (
        `<button class="group ${selected ? 'selected' : ''}" type="button" ` +
        `data-group="${esc(g.id)}" aria-pressed="${selected}" ${g.disabled ? 'disabled' : ''}>` +
        `<strong>${esc(groupLabel(g, locale))}</strong>` +
        `<span class="tick">${selected ? '✓' : ''}</span>` +
        `<span class="meta">${esc(meta)}</span>` +
        `</button>`
      );
    })
    .join('');

  const count = t('setup.count', { teams: state.selected.size, members: eligible.length });
  const hint = eligible.length < 9 ? `<div class="small">${esc(t('setup.minMembers'))}</div>` : '';
  const start =
    `<button class="primary" type="button" data-action="start" ${eligible.length < 9 ? 'disabled' : ''}>` +
    `${esc(t('setup.start'))}</button>`;

  return (
    `<div class="intro intro-compact"><div><div class="kicker">${esc(t('app.kicker'))}</div>` +
    `<h1>${esc(t('app.brand'))}</h1></div></div>` +
    `<div class="selection-head"><div class="tabs">${tabs}</div>` +
    `<div class="selection-actions">` +
    `<button class="debut-switch" type="button" role="switch" aria-checked="${state.debutDesc}" ` +
    `aria-label="${esc(t('setup.debut.aria', { order: state.debutDesc ? t('setup.debut.desc') : t('setup.debut.asc') }))}" ` +
    `data-action="toggleDebut"><span class="switch-track"><span class="switch-knob"></span></span>` +
    `<span>${esc(t('setup.debut.label'))} ${esc(state.debutDesc ? t('setup.debut.desc') : t('setup.debut.asc'))}</span></button>` +
    `<button class="text-button" type="button" data-action="selectVisible">${esc(t('setup.selectAll'))}</button>` +
    `<button class="text-button" type="button" data-action="clearVisible">${esc(t('setup.clearAll'))}</button>` +
    `</div></div>` +
    `<div class="group-grid">${cards}</div>` +
    bar(`<span class="count">${esc(count)}</span>${hint}`, start)
  );
}
```

- [ ] **Step 6: Tulis stub tiga fase lain**

Setiap berkas hanya agar `js/render.js` bisa diimpor; digantikan di Task 9–11.

`js/phases/heat.js`:

```js
import { steps } from '../view.js';

export function renderHeat(state, ctx) {
  return `${steps(state, ctx.t)}<h1>heat</h1>`;
}
```

`js/phases/sort.js`:

```js
import { steps } from '../view.js';

export function renderSort(state, ctx) {
  return `${steps(state, ctx.t)}<h1>sort</h1>`;
}
```

`js/phases/result.js`:

```js
import { steps } from '../view.js';

export function renderResult(state, ctx) {
  return `${steps(state, ctx.t)}<h1>result</h1>`;
}
```

- [ ] **Step 7: Tulis `js/main.js`**

```js
import { GROUPS, MEMBERS } from '../data/roster.js';
import en from '../i18n/en.js';
import ko from '../i18n/ko.js';
import { createTranslator, detectLocale, genLabel } from './i18n.js';
import { render } from './render.js';
import { buildIndex, groupText, memberText } from './search.js';
import * as act from './state.js';
import { initialsOf } from './view.js';

const dicts = { ko, en };
const app = document.querySelector('#app');
const toastEl = document.querySelector('#toast');
const langSwitch = document.querySelector('#langSwitch');
const brandEl = document.querySelector('.brand');
const titleEl = document.querySelector('title');
const descEl = document.querySelector('meta[name="description"]');

const groupById = new Map(GROUPS.map((g) => [g.id, g]));
const memberById = new Map(MEMBERS.map((m) => [m.id, m]));

const safeGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch { /* mode privat */ } };

const state = act.createState();
state.lang = detectLocale({
  search: location.search,
  stored: safeGet('listidol.lang'),
  navigatorLangs: navigator.languages ?? [navigator.language],
});

const t = createTranslator(dicts, () => state.lang);

let ctx = buildContext();

function buildContext() {
  const genLabelFn = (gen) => genLabel(gen, t);
  return {
    t,
    groupById,
    memberById,
    groupIndex: buildIndex(GROUPS, (g) => groupText(g, genLabelFn)),
    memberIndex: buildIndex(MEMBERS, (m) => memberText(m, groupById, genLabelFn)),
  };
}

let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 3000);
}

function applyDocumentChrome() {
  document.documentElement.lang = state.lang;
  titleEl.textContent = t('app.title');
  descEl.setAttribute('content', t('app.title'));
  brandEl.textContent = t('app.brand');
  document.querySelector('#credits').textContent = t('credits.button');
  document.querySelector('#closeDialog').textContent = t('dialog.close');
  langSwitch.setAttribute('aria-label', t('lang.aria'));
  for (const button of langSwitch.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === state.lang));
  }
}

function draw() {
  app.innerHTML = render(state, ctx);
}

function redrawAll() {
  ctx = buildContext();
  applyDocumentChrome();
  draw();
}

langSwitch.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-lang]');
  if (!button) return;
  act.setLang(state, button.dataset.lang);
  safeSet('listidol.lang', state.lang);
  redrawAll();
});

app.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;

  if (button.dataset.gen !== undefined) {
    act.toggleGeneration(state, Number(button.dataset.gen));
    draw();
    return;
  }
  if (button.dataset.group !== undefined) {
    act.toggleGroup(state, button.dataset.group);
    draw();
    return;
  }

  switch (button.dataset.action) {
    case 'toggleDebut':
      act.toggleDebut(state);
      break;
    case 'selectVisible':
      act.selectAllVisible(state);
      break;
    case 'clearVisible':
      act.clearAllVisible(state);
      break;
    case 'start':
      if (!act.startGame(state, { onTooFew: () => toast(t('setup.tooFew')) })) return;
      break;
    default:
      return;
  }
  draw();
});

// `error` tidak bubble; pakai fase capture lalu ganti dengan avatar inisial.
app.addEventListener(
  'error',
  (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const member = memberById.get(img.dataset.member);
    if (!member) return;
    const fallback = document.createElement('span');
    fallback.className = 'portrait-fallback';
    fallback.textContent = initialsOf(member, state.lang);
    fallback.setAttribute('aria-hidden', 'true');
    img.replaceWith(fallback);
  },
  true,
);

document.querySelector('#closeDialog').addEventListener('click', () => {
  document.querySelector('#dialog').close();
});

redrawAll();
```

- [ ] **Step 8: Jalankan seluruh test**

Run: `node --test`
Expected: PASS — i18n, search, game, view, roster semuanya lulus.

- [ ] **Step 9: Verifikasi di browser**

```bash
python -m http.server 8080 --directory .
```

Buka `http://localhost:8080/` lalu periksa, satu per satu:

1. Grid grup tampil, semua grup non-`hidden` ada, urut naik berdasarkan debut.
2. Klik satu kartu grup: tanda centang dan gaya `selected` muncul/hilang.
3. Klik tab `3세대`: seluruh grup generasi 3 terpilih. Klik lagi: seluruhnya terlepas.
4. Klik `데뷔순서 오름차순 ↑`: urutan berbalik menjadi menurun dan label berubah.
5. `전체 선택` / `선택 해제` mengubah seluruh grid.
6. Kosongkan pilihan sampai tersisa < 9 member eligible: tombol `시작 →` menjadi `disabled` dan muncul `최소 9명 선택`.
7. Klik `English` di header: seluruh teks berganti, `<html lang>` menjadi `en`, nama grup Hangul berubah ke label Latin (mis. `이달의 소녀` → `LOONA`), judul tab berubah.
8. Muat ulang halaman: bahasa tetap `en` (localStorage). Buka `?lang=ko`: kembali ke Korea.
9. Konsol browser bersih — tidak ada error dan tidak ada `[i18n] missing key`.

- [ ] **Step 10: Commit**

```bash
git add index.html style.css js
git commit -m "feat: shell, state, render, fase setup, dan pemilih bahasa"
```

---

## Task 8: Search di layar setup

**Files:**
- Modify: `js/phases/setup.js`
- Modify: `style.css` (gaya kotak search)
- Create: `test/state.test.mjs`

**Interfaces:**
- Consumes: `search()` dari `js/search.js`, `ctx.groupIndex`, `act.setQuery`
- Produces: atribut `data-action="search"` (input), `data-action="clearQuery"` (tombol), dan `data-role="searchCount"` pada markup setup

**Konteks — invariant yang wajib ditutup test:** mengetik di kotak search **hanya** mengubah `state.query`. `state.selected` tidak boleh tersentuh. Ini bug klasik pada implementasi search-over-grid.

- [ ] **Step 1: Tulis test invariant state**

`test/state.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, MEMBERS } from '../data/roster.js';
import { buildIndex, groupText, memberText } from '../js/search.js';
import {
  clearAllVisible,
  createState,
  enterSort,
  selectAllVisible,
  setPhase,
  setQuery,
  startGame,
  toggleDebut,
  toggleGeneration,
  toggleGroup,
} from '../js/state.js';

const groupById = new Map(GROUPS.map((g) => [g.id, g]));
const genLabelFn = (gen) => `${gen}세대`;
const groupIndex = buildIndex(GROUPS, (g) => groupText(g, genLabelFn));
const memberIndex = buildIndex(MEMBERS, (m) => memberText(m, groupById, genLabelFn));

const visibleGroupCount = () => GROUPS.filter((g) => !g.hidden).length;
const selectableCount = () => GROUPS.filter((g) => !g.disabled && !g.hidden).length;

test('createState: semua grup yang bisa dipilih terpilih di awal', () => {
  const state = createState();
  assert.equal(state.selected.size, selectableCount());
  assert.equal(state.phase, 'setup');
  assert.equal(state.query, '');
  assert.equal(state.debutDesc, false);
});

test('toggleGroup menambah dan menghapus', () => {
  const state = createState();
  toggleGroup(state, 'TWICE');
  assert.equal(state.selected.has('TWICE'), false);
  toggleGroup(state, 'TWICE');
  assert.equal(state.selected.has('TWICE'), true);
});

test('toggleGeneration memilih lalu melepas satu generasi penuh', () => {
  const state = createState();
  clearAllVisible(state);
  toggleGeneration(state, 3);
  const gen3 = GROUPS.filter((g) => !g.disabled && !g.hidden && g.gen === 3);
  assert.ok(gen3.every((g) => state.selected.has(g.id)));
  toggleGeneration(state, 3);
  assert.ok(gen3.every((g) => !state.selected.has(g.id)));
});

test('toggleGeneration(0) berlaku untuk semua grup yang bisa dipilih', () => {
  const state = createState();
  clearAllVisible(state);
  toggleGeneration(state, 0);
  assert.equal(state.selected.size, selectableCount());
});

test('selectAllVisible dan clearAllVisible tidak menyentuh grup hidden', () => {
  const state = createState();
  clearAllVisible(state);
  assert.equal(state.selected.size, 0);
  selectAllVisible(state);
  assert.equal(state.selected.size, selectableCount());
  const hidden = GROUPS.filter((g) => g.hidden);
  assert.ok(hidden.every((g) => !state.selected.has(g.id)));
  assert.ok(state.selected.size <= visibleGroupCount());
});

test('toggleDebut membalik urutan', () => {
  const state = createState();
  toggleDebut(state);
  assert.equal(state.debutDesc, true);
  toggleDebut(state);
  assert.equal(state.debutDesc, false);
});

// --- invariant search ------------------------------------------------------

test('setQuery TIDAK PERNAH mengubah selected', () => {
  const state = createState();
  const before = [...state.selected].sort();
  for (const query of ['twice', '사나', 'zzz', '', '*']) {
    setQuery(state, query);
    assert.deepEqual([...state.selected].sort(), before, `query ${JSON.stringify(query)}`);
  }
});

test('setQuery TIDAK PERNAH mengubah fase', () => {
  const state = createState();
  setQuery(state, 'twice');
  assert.equal(state.phase, 'setup');
});

test('setPhase selalu mengosongkan query', () => {
  const state = createState();
  for (const phase of ['heat', 'sort', 'result', 'setup']) {
    setQuery(state, 'twice');
    setPhase(state, phase);
    assert.equal(state.query, '', `transisi ke ${phase}`);
  }
});

test('groupIndex dan memberIndex konsisten dengan jumlah data', () => {
  assert.equal(groupIndex.size, GROUPS.length);
  assert.equal(memberIndex.size, MEMBERS.length);
});

// --- alur permainan --------------------------------------------------------

test('startGame menolak bila member eligible kurang dari 9', () => {
  const state = createState();
  clearAllVisible(state);
  let called = false;
  const ok = startGame(state, { onTooFew: () => { called = true; } });
  assert.equal(ok, false);
  assert.equal(called, true);
  assert.equal(state.phase, 'setup');
});

test('startGame dengan seluruh grup masuk ke fase heat', () => {
  const state = createState();
  const ok = startGame(state, {});
  assert.equal(ok, true);
  assert.equal(state.phase, 'heat');
  assert.equal(state.query, '');
  assert.equal(state.heat.current.length, 9);
  assert.ok(state.heat.pool.length > 20, `pool = ${state.heat.pool.length}`);
});

test('startGame dengan sedikit grup langsung masuk ke fase sort', () => {
  const state = createState();
  clearAllVisible(state);
  for (const id of ['TWICE', 'ITZY', 'IVE', 'aespa']) toggleGroup(state, id);
  const ok = startGame(state, {});
  assert.equal(ok, true);
  assert.equal(state.phase, 'sort');
  assert.ok(state.sort.candidateCount <= 20);
});

test('enterSort menolak kandidat kurang dari 9', () => {
  const state = createState();
  assert.equal(enterSort(state, ['a', 'b']), false);
  assert.equal(state.phase, 'setup');
});

test('startGame mereset custom dan finalists', () => {
  const state = createState();
  state.custom = { g_twice_sana: { url: 'blob:x', x: 1, y: 1, zoom: 1 } };
  state.finalists = ['g_twice_sana'];
  startGame(state, {});
  assert.deepEqual(state.custom, {});
  assert.deepEqual(state.finalists, []);
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `node --test test/state.test.mjs`
Expected: FAIL — `Cannot find module '../js/state.js'` bila Task 7 belum dikerjakan; bila sudah, sebagian test `setPhase`/`setQuery` lulus dan test lain menunjuk perilaku yang belum ada.

- [ ] **Step 3: Tambahkan kotak search ke `js/phases/setup.js`**

Tambahkan import:

```js
import { search } from '../search.js';
```

Ganti baris yang membangun `groups`:

```js
  const matched = search(state.query, ctx.groupIndex);
  const groups = sortGroups(
    visibleGroups().filter((g) => matched.has(g.id)),
    state.debutDesc,
  );
```

Tambahkan blok search di dalam `selection-head`, tepat sebelum `<div class="tabs">`:

```js
  const searching = state.query.trim() !== '';
  const searchBox =
    `<div class="search-row">` +
    `<input type="search" data-action="search" value="${esc(state.query)}" ` +
    `placeholder="${esc(t('search.placeholder'))}" aria-label="${esc(t('search.aria'))}" ` +
    `autocomplete="off" spellcheck="false">` +
    (searching
      ? `<button class="text-button" type="button" data-action="clearQuery">${esc(t('search.clear'))}</button>`
      : '') +
    `</div>`;
```

Tambahkan penghitung hasil dan empty state, tepat setelah `<div class="group-grid">${cards}</div>`:

```js
  const resultCount = esc(
    t('search.count.groups', { n: groups.length, total: visibleGroups().length }),
  );
  const empty = groups.length
    ? ''
    : `<p class="empty" data-role="searchEmpty">${esc(t('search.empty'))}</p>`;
```

Dan sisipkan keduanya ke dalam hasil: `searchBox` di awal `selection-head`, lalu
`<div class="search-count" data-role="searchCount">${resultCount}</div>${empty}`
setelah grid.

- [ ] **Step 4: Wire input search di `js/main.js`**

Tambahkan sebelum `redrawAll()` di akhir berkas:

```js
app.addEventListener('input', (event) => {
  if (event.target.dataset.action !== 'search') return;
  const input = event.target;
  const caret = input.selectionStart;
  act.setQuery(state, input.value);
  draw();
  const next = app.querySelector('input[data-action="search"]');
  if (next) {
    next.focus();
    next.setSelectionRange(caret, caret);
  }
});
```

Dan tambahkan kasus baru di dalam `switch (button.dataset.action)`:

```js
    case 'clearQuery':
      act.setQuery(state, '');
      break;
```

- [ ] **Step 5: Tambahkan gaya kotak search ke `style.css`**

```css
/* --- kotak search (tambahan listidol) --- */
.search-row{display:flex;gap:8px;align-items:center;margin:0 0 12px}
.search-row input[type=search]{flex:1;min-width:0;font:500 15px 'Noto Sans KR',sans-serif;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:12px;padding:11px 14px}
.search-row input[type=search]:focus{outline:2px solid var(--accent);outline-offset:1px}
.search-count{color:var(--muted);font-size:13px;margin:10px 0 0}
.empty{color:var(--muted);font-size:14px;text-align:center;padding:28px 0}
.lang-switch{display:flex;gap:6px}
.lang-switch button{font:600 13px 'Noto Sans KR',sans-serif;color:var(--muted);background:transparent;border:1px solid var(--line);border-radius:999px;padding:5px 12px;cursor:pointer}
.lang-switch button[aria-pressed=true]{color:var(--ink);background:var(--accent);border-color:var(--accent)}
.portrait-fallback{display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:var(--line);color:var(--muted);font:800 28px 'Noto Sans KR',sans-serif}
```

- [ ] **Step 6: Jalankan seluruh test**

Run: `node --test`
Expected: PASS — termasuk 15 test di `test/state.test.mjs`.

- [ ] **Step 7: Verifikasi di browser**

Server masih jalan di `http://localhost:8080/`. Periksa:

1. Ketik `twice` di kotak search: grid grup hanya menyisakan grup yang cocok, penghitung menampilkan `n / total 팀`.
2. Ketik `이달의 소녀`: hanya grup itu tersisa. Ganti ke English lalu ketik `loona`: grup yang sama tetap ditemukan.
3. Ketik `zzz`: muncul empty state `검색 결과가 없습니다`, bukan grid kosong tanpa penjelasan.
4. Kosongkan query lewat tombol `지우기`: grid kembali penuh.
5. **Invariant:** pilih beberapa grup, catat pilihannya, ketik dan hapus query berulang kali — pilihan tidak berubah sama sekali. Centang di kartu tetap sama.
6. Ketik query lalu tekan `시작 →`: di fase heat kotak query kosong kembali.

- [ ] **Step 8: Commit**

```bash
git add js/phases/setup.js js/main.js style.css test/state.test.mjs
git commit -m "feat: search live di layar setup + test invariant state"
```

---

## Task 9: Fase heat (pemilihan member)

**Files:**
- Modify: `js/phases/heat.js` (menggantikan stub)
- Modify: `js/state.js` (tambah `pickMember`, `confirmHeat`)
- Modify: `js/main.js` (wire `data-member` dan `data-action="heatNext"`)
- Modify: `test/state.test.mjs` (tambah test heat)

**Interfaces:**
- Consumes: `finishHeat`, `advanceHeat`, `beginHeat`, `heatSize` dari `js/game.js`; `memberCard`, `bar`, `steps` dari `js/view.js`
- Produces:
  - `pickMember(state, memberId) -> 'ok' | 'full'`
  - `confirmHeat(state, { onNeedMore, onTooFew }) -> boolean`

**Konteks:** `finishHeat`/`advanceHeat` sudah diuji di Task 5. Task ini hanya menyambungkannya ke state dan DOM.

- [ ] **Step 1: Tambahkan test heat ke `test/state.test.mjs`**

Tambahkan import berikut ke daftar import dari `../js/state.js`:

```js
  confirmHeat,
  pickMember,
```

Tambahkan di akhir berkas:

```js
// --- heat ------------------------------------------------------------------

test('pickMember menghormati batas 3 per layar', () => {
  const state = createState();
  startGame(state, {});
  const [a, b, c, d] = state.heat.current;
  assert.equal(pickMember(state, a), 'ok');
  assert.equal(pickMember(state, b), 'ok');
  assert.equal(pickMember(state, c), 'ok');
  assert.equal(pickMember(state, d), 'full');
  assert.equal(state.heat.selected.size, 3);
});

test('pickMember membatalkan pilihan yang sama', () => {
  const state = createState();
  startGame(state, {});
  const id = state.heat.current[0];
  assert.equal(pickMember(state, id), 'ok');
  assert.equal(state.heat.selected.has(id), true);
  assert.equal(pickMember(state, id), 'ok');
  assert.equal(state.heat.selected.has(id), false);
});

test('pickMember tidak mengubah daftar grup terpilih', () => {
  const state = createState();
  startGame(state, {});
  const before = [...state.selected].sort();
  pickMember(state, state.heat.current[0]);
  assert.deepEqual([...state.selected].sort(), before);
});

test('confirmHeat menolak bila pilihan belum lengkap', () => {
  const state = createState();
  startGame(state, {});
  let need = 0;
  assert.equal(confirmHeat(state, { onNeedMore: (n) => { need = n; } }), false);
  assert.equal(need, 3);
  assert.equal(state.phase, 'heat');
});

test('confirmHeat memajukan layar sampai seluruh turnamen selesai', () => {
  const state = createState();
  startGame(state, {});
  assert.equal(state.phase, 'heat');

  let guard = 0;
  while (state.phase === 'heat') {
    if (guard++ > 500) throw new Error('heat tidak pernah selesai');
    for (const id of state.heat.current.slice(0, 3)) pickMember(state, id);
    assert.equal(confirmHeat(state, {}), true);
  }

  assert.equal(state.phase, 'sort');
  assert.equal(state.query, '');
  assert.ok(state.sort.candidateCount >= 9, `kandidat = ${state.sort.candidateCount}`);
});

test('confirmHeat selalu mengosongkan pilihan layar berikutnya', () => {
  const state = createState();
  startGame(state, {});
  for (const id of state.heat.current.slice(0, 3)) pickMember(state, id);
  confirmHeat(state, {});
  assert.equal(state.heat.selected.size, 0);
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `node --test test/state.test.mjs`
Expected: FAIL — `confirmHeat`/`pickMember` belum diekspor dari `../js/state.js`.

- [ ] **Step 3: Tambahkan aksi heat ke `js/state.js`**

Tambahkan `advanceHeat` dan `finishHeat` ke daftar import dari `./game.js`, lalu tambahkan di akhir berkas:

```js
// --- heat ------------------------------------------------------------------

const needOnScreen = (state) => Math.min(3, state.heat.current.length);

/** Mengembalikan 'full' bila layar ini sudah penuh dan member belum terpilih. */
export function pickMember(state, memberId) {
  const picked = state.heat.selected;
  if (picked.has(memberId)) {
    picked.delete(memberId);
    return 'ok';
  }
  if (picked.size >= needOnScreen(state)) return 'full';
  picked.add(memberId);
  return 'ok';
}

export function confirmHeat(state, { onNeedMore, onTooFew } = {}) {
  const need = needOnScreen(state);
  if (state.heat.selected.size !== need) {
    onNeedMore?.(need);
    return false;
  }

  const result = finishHeat(state.heat, [...state.heat.selected]);
  if (!result.ok) {
    onNeedMore?.(result.need);
    return false;
  }

  if (result.action === 'continue') {
    beginHeat(state.heat);
    return true;
  }

  const next = advanceHeat(state.heat);
  if (next.next === 'heat') return true;

  if (!enterSort(state, next.ids)) {
    onTooFew?.();
    setPhase(state, 'setup');
  }
  return true;
}
```

- [ ] **Step 4: Ganti stub `js/phases/heat.js`**

```js
import { heatSize } from '../game.js';
import { bar, esc, memberCard, steps } from '../view.js';

export function renderHeat(state, ctx) {
  const { t } = ctx;
  const { heat } = state;
  const need = Math.min(3, heat.current.length);
  const size = heatSize(heat.pool.length, heat.stage);
  const screen = Math.floor((heat.index - heat.current.length) / size) + 1;
  const total = Math.ceil(heat.pool.length / size);
  const isFinal = heat.stage === 'final';

  const stageLabel =
    heat.stage === 'main'
      ? t('heat.stage.round', { round: heat.round, total: heat.roundTotal })
      : isFinal
        ? t('heat.stage.final')
        : t('heat.stage.challenge');

  const cards = heat.current
    .map((id) =>
      memberCard(ctx.memberById.get(id), {
        custom: state.custom,
        groupById: ctx.groupById,
        locale: state.lang,
        picked: heat.selected.has(id),
      }),
    )
    .join('');

  const nextLabel = screen === total && isFinal ? t('heat.toSort') : t('heat.next');
  const next =
    `<button class="primary" type="button" data-action="heatNext" ` +
    `${heat.selected.size !== need ? 'disabled' : ''}>${esc(nextLabel)}</button>`;

  return (
    steps(state, t) +
    `<div class="progress-head"><strong>${esc(stageLabel)}</strong>` +
    `<span>${esc(t('heat.screen', { screen, total }))}</span></div>` +
    `<div class="progress" role="progressbar" aria-label="${esc(t('heat.progress.aria', { stage: stageLabel }))}" ` +
    `aria-valuenow="${screen - 1}" aria-valuemin="0" aria-valuemax="${total}">` +
    `<div style="width:${(100 * (screen - 1)) / total}%"></div></div>` +
    `<h1>${t('heat.pick', { total: heat.current.length, need })}</h1>` +
    `<div class="member-grid">${cards}</div>` +
    bar(`<span class="count">${esc(t('heat.count', { picked: heat.selected.size, need }))}</span>`, next)
  );
}
```

**Catatan:** `t('heat.pick')` sengaja **tidak** di-escape karena nilainya memuat `<em>`.

- [ ] **Step 5: Wire di `js/main.js`**

Tambahkan dua cabang berikut di handler klik `#app`, tepat sebelum `switch (button.dataset.action)`:

```js
  if (button.dataset.member !== undefined && state.phase === 'heat') {
    const outcome = act.pickMember(state, button.dataset.member);
    if (outcome === 'full') {
      toast(t('heat.maxPick', { need: Math.min(3, state.heat.current.length) }));
    }
    draw();
    return;
  }
```

Tambahkan dua kasus di dalam `switch (button.dataset.action)`:

```js
    case 'heatNext':
      if (
        !act.confirmHeat(state, {
          onNeedMore: (need) => toast(t('heat.needMore', { need })),
          onTooFew: () => toast(t('setup.tooFew')),
        })
      ) {
        return;
      }
      break;
    case 'restart':
      act.setPhase(state, 'setup');
      break;
```

Dan tambahkan `scrollTo(0, 0);` tepat setelah `draw();` di akhir handler klik, di luar `switch`.

- [ ] **Step 6: Jalankan seluruh test**

Run: `node --test`
Expected: PASS — termasuk 21 test di `test/state.test.mjs`.

- [ ] **Step 7: Verifikasi di browser**

Muat ulang `http://localhost:8080/` (semua grup terpilih secara bawaan → 475 member eligible).

1. Klik `시작 →`: masuk ke fase heat, header menampilkan `예선 1/3라운드` dan `1 / 53판`.
2. Grid menampilkan 9 member dengan foto. Klik satu: tanda centang muncul dan penghitung menjadi `1 / 3명`.
3. Klik member keempat: muncul toast `이번 화면에서 3명까지 고를 수 있어요.` dan pilihan tidak bertambah.
4. Klik member yang sudah terpilih: pilihan berkurang.
5. Tombol `다음 →` tetap `disabled` sampai tepat 3 terpilih.
6. Tekan `다음 →`: layar berikutnya termuat, pilihan kosong kembali, penghitung `0 / 3명`, progres bertambah.
7. Ganti bahasa ke English di tengah heat: label tahap, judul, penghitung, dan nama member semuanya berganti tanpa kehilangan pilihan di layar itu.
8. Jalankan sisa turnamen lewat konsol browser, lalu pastikan halaman masuk ke fase `sort`:

```js
// tempel di konsol halaman
const loop = setInterval(() => {
  document.querySelectorAll('[data-member]').forEach((b) => b.click());
  const next = document.querySelector('[data-action="heatNext"]');
  if (next && !next.disabled) next.click();
  if (document.querySelector('[data-sort]')) {
    clearInterval(loop);
    console.log('sampai fase sort');
  }
}, 30);
```

Expected: log `sampai fase sort` tanpa error di konsol.

- [ ] **Step 8: Commit**

```bash
git add js/phases/heat.js js/state.js js/main.js test/state.test.mjs
git commit -m "feat: fase heat dengan pemilihan member per layar"
```

---

## Task 10: Fase sort (perbandingan berpasangan)

**Files:**
- Modify: `js/phases/sort.js` (menggantikan stub)
- Modify: `js/state.js` (tambah `pickSort`)
- Modify: `js/main.js` (wire `data-sort`)
- Modify: `test/state.test.mjs`

**Interfaces:**
- Consumes: `chooseSort`, `sortLimit` dari `js/game.js`
- Produces: `pickSort(state, memberId) -> { done: boolean, result?: string[] }`

- [ ] **Step 1: Tambahkan test sort**

Tambahkan `pickSort` ke daftar import dari `../js/state.js`, lalu tambahkan di akhir `test/state.test.mjs`:

```js
// --- sort ------------------------------------------------------------------

test('pickSort berjalan sampai selesai dan mengisi finalists', () => {
  const state = createState();
  clearAllVisible(state);
  for (const id of ['TWICE', 'BLACKPINK']) toggleGroup(state, id);
  startGame(state, {});
  assert.equal(state.phase, 'sort');
  assert.equal(state.sort.candidateCount, 13);

  let guard = 0;
  while (state.phase === 'sort') {
    if (guard++ > 500) throw new Error('sort tidak pernah selesai');
    assert.notEqual(state.sort.left, null, 'left kosong saat masih butuh perbandingan');
    assert.notEqual(state.sort.right, null, 'right kosong saat masih butuh perbandingan');
    pickSort(state, state.sort.left);
  }

  assert.equal(state.phase, 'result');
  assert.equal(state.query, '');
  assert.equal(state.finalists.length, 9);
  assert.equal(new Set(state.finalists).size, 9);
});

test('pickSort mengabaikan id yang bukan kandidat', () => {
  const state = createState();
  clearAllVisible(state);
  for (const id of ['TWICE', 'BLACKPINK']) toggleGroup(state, id);
  startGame(state, {});
  const before = state.sort.comparisons;
  pickSort(state, 'bukan-kandidat');
  assert.equal(state.sort.comparisons, before);
  assert.equal(state.phase, 'sort');
});

test('finalists selalu berisi 9 id unik milik pool yang dipilih', () => {
  const state = createState();
  clearAllVisible(state);
  for (const id of ['TWICE', 'BLACKPINK']) toggleGroup(state, id);
  startGame(state, {});
  let guard = 0;
  while (state.phase === 'sort' && guard++ < 500) pickSort(state, state.sort.right);
  assert.equal(state.finalists.length, 9);
  for (const id of state.finalists) assert.ok(state.pool.includes(id), `${id} bukan bagian pool`);
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `node --test test/state.test.mjs`
Expected: FAIL — `pickSort` belum diekspor.

- [ ] **Step 3: Tambahkan `pickSort` ke `js/state.js`**

Tambahkan `chooseSort` ke daftar import dari `./game.js`, lalu tambahkan di akhir berkas:

```js
// --- sort ------------------------------------------------------------------

/** Mencatat satu perbandingan; mengisi `finalists` dan pindah ke fase result bila selesai. */
export function pickSort(state, memberId) {
  const result = chooseSort(state.sort, memberId);
  if (result.done) {
    state.finalists = result.result;
    setPhase(state, 'result');
  }
  return result;
}
```

- [ ] **Step 4: Ganti stub `js/phases/sort.js`**

```js
import { sortLimit } from '../game.js';
import { esc, labelsOf, memberLabel, portrait, steps } from '../view.js';

export function renderSort(state, ctx) {
  const { t } = ctx;
  const { sort } = state;
  const limit = sortLimit(sort.candidateCount);
  const locale = state.lang;

  const card = (member) =>
    `<button class="member" type="button" data-sort="${esc(member.id)}">` +
    `<div class="portrait">${portrait(member, state.custom)}</div>` +
    `<div class="member-name">${esc(memberLabel(member, locale))}</div>` +
    `<div class="member-group">${esc(labelsOf(member, ctx.groupById, locale))}</div>` +
    `</button>`;

  const pair = [sort.left, sort.right]
    .map((id) => ctx.memberById.get(id))
    .filter(Boolean)
    .map(card)
    .join('');

  return (
    steps(state, t) +
    `<div class="progress-head"><strong>${esc(t('sort.title'))}</strong>` +
    `<span>${esc(t('sort.count', { n: sort.comparisons, limit }))}</span></div>` +
    `<div class="progress" role="progressbar" aria-label="${esc(t('sort.progress.aria'))}" ` +
    `aria-valuenow="${sort.comparisons}" aria-valuemin="0" aria-valuemax="${limit}">` +
    `<div style="width:${(100 * sort.comparisons) / limit}%"></div></div>` +
    `<h1>${t('sort.pick')}</h1>` +
    `<div class="member-grid" style="grid-template-columns:repeat(2,1fr);max-width:620px">${pair}</div>`
  );
}
```

**Catatan:** `t('sort.pick')` juga memuat `<em>` sehingga tidak di-escape.

- [ ] **Step 5: Wire di `js/main.js`**

Tambahkan cabang berikut di handler klik `#app`, tepat sebelum `switch (button.dataset.action)`:

```js
  if (button.dataset.sort !== undefined) {
    act.pickSort(state, button.dataset.sort);
    draw();
    scrollTo(0, 0);
    return;
  }
```

- [ ] **Step 6: Jalankan seluruh test**

Run: `node --test`
Expected: PASS — termasuk 24 test di `test/state.test.mjs`.

- [ ] **Step 7: Verifikasi di browser**

1. Di layar setup: `선택 해제`, lalu pilih hanya `TWICE` dan `BLACKPINK` (13 member, ≤ 20).
2. Klik `시작 →`: langsung masuk fase `순위 비교` tanpa fase heat.
3. Halaman menampilkan dua kartu berdampingan, penghitung `0 / 최대 33회`, dan progres 0%.
4. Klik salah satu kartu: penghitung bertambah, pasangan berikutnya muncul, progres bertambah.
5. Selesaikan seluruh perbandingan lewat konsol browser:

```js
// tempel di konsol halaman
const loop = setInterval(() => {
  const pair = document.querySelectorAll('[data-sort]');
  if (!pair.length) { clearInterval(loop); console.log('sort selesai'); return; }
  pair[0].click();
}, 20);
```

Expected: berhenti dengan log `sort selesai`, halaman berpindah ke fase result, dan tidak ada error di konsol.

- [ ] **Step 8: Commit**

```bash
git add js/phases/sort.js js/state.js js/main.js test/state.test.mjs
git commit -m "feat: fase sort berpasangan"
```

---

## Task 11: Fase result dan poster PNG

**Files:**
- Modify: `js/phases/result.js` (menggantikan stub)
- Create: `js/poster.js`
- Modify: `js/state.js` (tambah `setTitle`)
- Modify: `js/main.js` (wire `posterTitle`, `download`, `restart`, preview dialog)
- Modify: `style.css` (gaya preview)
- Modify: `test/state.test.mjs`

**Interfaces:**
- Consumes: `photoOf`, `memberLabel`, `groupLines`, `portrait`, `labelsOf` dari `js/view.js`
- Produces:
  - `setTitle(state, value) -> void` (menandai `titleTouched = true`)
  - `POSTER_LAYOUT: number[]` = `[3,4,5,1,0,2,6,7,8]`
  - `loadImage(url) -> Promise<HTMLImageElement>`
  - `buildPoster({ finalists, memberById, custom, title, labels }) -> Promise<Blob>`

**Konteks — dua perbaikan atas situs asli:** (1) `document.fonts.load(...)` untuk setiap bobot yang dipakai dipanggil sebelum menggambar, agar teks Hangul tidak ter-render sebagai tofu; (2) `URL.revokeObjectURL` dipanggil saat dialog ditutup, sedangkan situs asli membiarkan blob-nya bocor.

- [ ] **Step 1: Tambahkan test judul**

Tambahkan `setTitle` ke daftar import dari `../js/state.js`, lalu tambahkan di akhir `test/state.test.mjs`:

```js
// --- judul poster ----------------------------------------------------------

test('setTitle menandai judul sebagai sudah disentuh', () => {
  const state = createState();
  assert.equal(state.titleTouched, false);
  setTitle(state, '나의 구절판');
  assert.equal(state.title, '나의 구절판');
  assert.equal(state.titleTouched, true);
});

test('setTitle tidak mengubah pilihan, pool, atau fase', () => {
  const state = createState();
  const selected = [...state.selected].sort();
  setTitle(state, 'x');
  assert.deepEqual([...state.selected].sort(), selected);
  assert.equal(state.phase, 'setup');
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `node --test test/state.test.mjs`
Expected: FAIL — `setTitle` belum diekspor.

- [ ] **Step 3: Tambahkan `setTitle` ke `js/state.js`**

```js
/** Menandai bahwa pengguna sudah menyunting judul, sehingga i18n berhenti menimpanya. */
export function setTitle(state, value) {
  state.title = value;
  state.titleTouched = true;
}
```

- [ ] **Step 4: Ganti stub `js/phases/result.js`**

```js
import { bar, esc, labelsOf, memberLabel, portrait, steps } from '../view.js';

export const POSTER_LAYOUT = [3, 4, 5, 1, 0, 2, 6, 7, 8];

/** Judul efektif: hasil suntingan pengguna, atau nama aplikasi yang ikut bahasa. */
export function effectiveTitle(state, t) {
  return state.titleTouched ? state.title : t('app.brand');
}

export function renderResult(state, ctx) {
  const { t } = ctx;
  const locale = state.lang;
  const title = effectiveTitle(state, t);

  const cards = POSTER_LAYOUT.map((rankIndex) => {
    const member = ctx.memberById.get(state.finalists[rankIndex]);
    if (!member) return '';
    return (
      `<div class="poster-card">` +
      `<span class="badge ${rankIndex === 0 ? 'first' : ''}">${esc(t('result.rank', { n: rankIndex + 1 }))}</span>` +
      `<div class="portrait">${portrait(member, state.custom)}` +
      `<button class="edit-photo" type="button" data-photo="${esc(member.id)}">${esc(t('result.editPhoto'))}</button></div>` +
      `<div class="member-name">${esc(memberLabel(member, locale))}</div>` +
      `<div class="member-group">${esc(labelsOf(member, ctx.groupById, locale))}</div>` +
      `</div>`
    );
  }).join('');

  return (
    steps(state, t) +
    `<h1>${esc(t('result.title'))}</h1>` +
    `<div class="result-tools">` +
    `<input id="posterTitle" maxlength="35" aria-label="${esc(t('result.titleInput.aria'))}" value="${esc(title)}">` +
    `</div>` +
    `<div class="poster-wrap"><div class="poster" id="poster">` +
    `<div class="eyebrow">${esc(t('app.eyebrow'))}</div>` +
    `<h2 id="liveTitle">${esc(title)}</h2>` +
    `<div class="poster-grid">${cards}</div>` +
    `<div class="poster-foot">${esc(t('result.foot'))}</div>` +
    `</div></div>` +
    `<p class="small" style="text-align:center">${esc(t('result.privacy'))}</p>` +
    bar(
      `<button class="outline" type="button" data-action="restart">${esc(t('result.restart'))}</button>`,
      `<button class="primary lime" type="button" data-action="download">${esc(t('result.download'))}</button>`,
    )
  );
}
```

- [ ] **Step 5: Tulis `js/poster.js`**

```js
import { groupLines, memberLabel, photoOf } from './view.js';

const WIDTH = 1080;
const HEIGHT = 1600;
const LAYOUT = [3, 4, 5, 1, 0, 2, 6, 7, 8];
const FONT = '"Noto Sans KR", sans-serif';

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`gagal memuat ${url}`));
    image.src = url;
  });
}

/**
 * Menggambar poster 1080x1600 dan mengembalikan Blob PNG.
 * `labels` = { eyebrow, foot, locale, rank(n), }
 */
export async function buildPoster({ finalists, memberById, custom, title, labels }) {
  // Tanpa ini, teks Hangul bisa ter-render sebagai kotak di canvas.
  for (const weight of [500, 700, 800, 900]) {
    await document.fonts.load(`${weight} 40px ${FONT}`);
  }
  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const c = canvas.getContext('2d');

  c.fillStyle = '#fff';
  c.fillRect(0, 0, WIDTH, HEIGHT);
  c.textAlign = 'center';
  c.fillStyle = '#181818';
  c.font = `700 28px ${FONT}`;
  c.fillText(labels.eyebrow, WIDTH / 2, 80);

  let size = 58;
  c.font = `900 ${size}px ${FONT}`;
  while (c.measureText(title).width > 980 && size > 20) {
    size -= 2;
    c.font = `900 ${size}px ${FONT}`;
  }
  c.fillText(title, WIDTH / 2, 158);

  for (let slot = 0; slot < LAYOUT.length; slot++) {
    const rankIndex = LAYOUT[slot];
    const member = memberById.get(finalists[rankIndex]);
    if (!member) continue;

    const photo = photoOf(member, custom);
    const image = await loadImage(photo.url);
    const x = 55 + (slot % 3) * 330;
    const y = 218 + Math.floor(slot / 3) * 420;
    const w = 310;
    const h = 310;
    const scale = Math.max(w / image.width, h / image.height);
    const iw = image.width * scale;
    const ih = image.height * scale;
    const dx = x + ((w - iw) * photo.x) / 100;
    const dy = y + ((h - ih) * photo.y) / 100;

    c.save();
    c.beginPath();
    c.roundRect(x, y, w, h, 25);
    c.clip();
    c.translate(x + w / 2, y + h / 2);
    c.scale(photo.zoom, photo.zoom);
    c.translate(-(x + w / 2), -(y + h / 2));
    c.drawImage(image, dx, dy, iw, ih);
    c.restore();

    c.fillStyle = rankIndex === 0 ? '#c1fb61' : '#fff';
    c.beginPath();
    c.roundRect(x + 12, y + 12, 78, 46, 23);
    c.fill();

    c.fillStyle = '#181818';
    c.font = `800 26px ${FONT}`;
    c.fillText(labels.rank(rankIndex + 1), x + 51, y + 44);

    c.font = `800 29px ${FONT}`;
    c.fillText(memberLabel(member, labels.locale), x + w / 2, y + h + 43);

    c.fillStyle = '#777';
    c.font = `500 18px ${FONT}`;
    groupLines(member, labels.groupById, labels.locale).forEach((line, i) => {
      c.fillText(line, x + w / 2, y + h + 72 + i * 22);
    });
  }

  c.fillStyle = '#888';
  c.font = `500 17px ${FONT}`;
  c.fillText(labels.foot, WIDTH / 2, 1560);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob gagal'))), 'image/png');
  });
}
```

- [ ] **Step 6: Wire di `js/main.js`**

Ubah signature handler klik `#app` menjadi `async (event) => {`. Tambahkan `buildPoster` dan `effectiveTitle` ke import:

```js
import { effectiveTitle } from './phases/result.js';
import { buildPoster } from './poster.js';
import { groupLines, initialsOf } from './view.js';
```

Tambahkan di dalam `switch (button.dataset.action)`:

```js
    case 'download':
      await downloadPoster();
      return;
```

Tambahkan dua fungsi berikut beserta variabel `posterUrl`:

```js
let posterUrl = null;

async function downloadPoster() {
  const button = app.querySelector('[data-action="download"]');
  if (!button) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = t('result.downloading');

  try {
    const blob = await buildPoster({
      finalists: state.finalists,
      memberById,
      custom: state.custom,
      title: effectiveTitle(state, t),
      labels: {
        eyebrow: t('app.eyebrow'),
        foot: t('result.foot'),
        locale: state.lang,
        groupById,
        rank: (n) => t('result.rank', { n }),
      },
    });

    if (posterUrl) URL.revokeObjectURL(posterUrl);
    posterUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = posterUrl;
    link.download = t('result.filename');
    link.click();

    showSavedPreview(posterUrl);
  } catch {
    toast(t('result.error'));
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function showSavedPreview(url) {
  const dialog = document.querySelector('#dialog');
  dialogBody.innerHTML =
    `<h2>${esc(t('result.saved.title'))}</h2>` +
    `<p class="small">${esc(t('result.saved.hint'))}</p>`;
  const preview = document.createElement('img');
  preview.src = url;
  preview.className = 'save-preview';
  preview.alt = t('result.saved.alt');
  dialogBody.append(preview);
  dialog.showModal();
}
```

Tambahkan `esc` ke import dari `./view.js`, tambahkan `const dialogBody = document.querySelector('#dialogBody');` di blok konstanta atas, dan tambahkan handler revoke:

```js
document.querySelector('#dialog').addEventListener('close', () => {
  if (posterUrl) {
    URL.revokeObjectURL(posterUrl);
    posterUrl = null;
  }
});
```

Tambahkan cabang judul di handler `input` pada `#app`, sebelum pemeriksaan `data-action="search"`:

```js
  if (event.target.id === 'posterTitle') {
    act.setTitle(state, event.target.value);
    const live = app.querySelector('#liveTitle');
    if (live) live.textContent = effectiveTitle(state, t);
    return;
  }
```

- [ ] **Step 7: Tambahkan gaya preview ke `style.css`**

```css
/* --- preview poster (tambahan listidol) --- */
.save-preview{display:block;width:100%;max-width:320px;margin:12px auto 0;border-radius:14px;border:1px solid var(--line)}
```

- [ ] **Step 8: Jalankan seluruh test**

Run: `node --test`
Expected: PASS — termasuk 26 test di `test/state.test.mjs`.

- [ ] **Step 9: Verifikasi di browser**

1. Pilih hanya `TWICE` + `BLACKPINK`, tekan `시작 →`, selesaikan semua perbandingan lewat loop konsol dari Task 10 Step 7.
2. Fase result menampilkan 9 kartu poster dengan badge peringkat, `1위` memakai badge hijau limau.
3. Ubah judul di kotak input: `#liveTitle` berubah seketika.
4. Klik `이미지 저장 ↓`: tombol berubah menjadi `이미지 만드는 중…`, lalu dialog terbuka berisi preview gambar.
5. **Periksa nama member di dalam PNG** — buka berkas hasil unduhan dan pastikan teks Hangul tergambar sebagai huruf, bukan kotak kosong (tofu).
6. Ganti bahasa ke English lalu unduh lagi: nama berkas menjadi `my-9-picks.png`, teks poster berbahasa Inggris, nama member memakai romanisasi.
7. Tutup dialog, buka lagi, unduh lagi beberapa kali: tidak ada pertumbuhan memori yang mencurigakan (blob lama di-revoke).
8. Klik `새로 만들기`: kembali ke layar setup.
9. Konsol browser bersih — tidak ada error dan tidak ada `[i18n] missing key`.

- [ ] **Step 10: Commit**

```bash
git add js/poster.js js/phases/result.js js/state.js js/main.js style.css test/state.test.mjs
git commit -m "feat: fase result dan poster PNG dengan font siap sebelum draw"
```

---

## Task 12: Dialog crop dan unggah foto sendiri

**Files:**
- Create: `js/photo.js`
- Modify: `js/state.js` (tambah `beginCrop`, `setCrop`, `resetCrop`)
- Modify: `js/main.js` (wire `data-photo`)
- Modify: `test/state.test.mjs`

**Interfaces:**
- Consumes: `loadImage` dari `js/poster.js`; `photoOf`, `esc` dari `js/view.js`
- Produces:
  - `beginCrop(state, memberId) -> { url, x, y, zoom }` (mengisi `state.custom[memberId]` bila belum ada)
  - `setCrop(state, memberId, patch) -> { url, x, y, zoom }`
  - `resetCrop(state, memberId) -> { url, x, y, zoom }` (menghapus `state.custom[memberId]`)
  - `createCropDialog({ state, t, memberById, toast, redraw }) -> { open(memberId) }`

**Konteks:** `loadImage` sengaja tetap tinggal di `js/poster.js` dan dipinjam dari sana, supaya hanya ada satu implementasi pemuat gambar.

- [ ] **Step 1: Tambahkan test aksi crop**

Tambahkan `beginCrop`, `resetCrop`, `setCrop` ke daftar import dari `../js/state.js`, lalu tambahkan di akhir `test/state.test.mjs`:

```js
// --- crop foto -------------------------------------------------------------

const firstMember = MEMBERS[0];

test('beginCrop mengisi custom dengan foto bawaan member', () => {
  const state = createState();
  const photo = beginCrop(state, firstMember.id);
  assert.equal(state.cropId, firstMember.id);
  assert.equal(photo.url, firstMember.image);
  assert.deepEqual(photo, {
    url: firstMember.image,
    x: firstMember.crop?.x ?? 50,
    y: firstMember.crop?.y ?? 25,
    zoom: firstMember.crop?.zoom ?? 1,
  });
});

test('beginCrop dipanggil dua kali tidak menimpa suntingan', () => {
  const state = createState();
  beginCrop(state, firstMember.id);
  setCrop(state, firstMember.id, { zoom: 2.5 });
  const again = beginCrop(state, firstMember.id);
  assert.equal(again.zoom, 2.5);
});

test('setCrop menggabungkan patch tanpa menghapus field lain', () => {
  const state = createState();
  beginCrop(state, firstMember.id);
  setCrop(state, firstMember.id, { x: 12 });
  const photo = setCrop(state, firstMember.id, { y: 34 });
  assert.equal(photo.x, 12);
  assert.equal(photo.y, 34);
  assert.equal(photo.url, firstMember.image);
});

test('resetCrop menghapus custom dan mengembalikan foto bawaan', () => {
  const state = createState();
  beginCrop(state, firstMember.id);
  setCrop(state, firstMember.id, { zoom: 3 });
  const photo = resetCrop(state, firstMember.id);
  assert.equal(state.custom[firstMember.id], undefined);
  assert.equal(photo.zoom, firstMember.crop?.zoom ?? 1);
});

test('aksi crop tidak menyentuh selected, pool, atau fase', () => {
  const state = createState();
  const selected = [...state.selected].sort();
  beginCrop(state, firstMember.id);
  setCrop(state, firstMember.id, { zoom: 2 });
  resetCrop(state, firstMember.id);
  assert.deepEqual([...state.selected].sort(), selected);
  assert.equal(state.phase, 'setup');
  assert.deepEqual(state.pool, []);
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `node --test test/state.test.mjs`
Expected: FAIL — `beginCrop`/`setCrop`/`resetCrop` belum diekspor.

- [ ] **Step 3: Tambahkan aksi crop ke `js/state.js`**

Tambahkan `import { defaultPhoto } from './view.js';` di blok import, lalu tambahkan di akhir berkas:

```js
// --- crop foto -------------------------------------------------------------

const photoDefaults = (memberId) => defaultPhoto(memberById.get(memberId));

/** Mengisi `state.custom[memberId]` dengan foto bawaan bila belum ada. */
export function beginCrop(state, memberId) {
  state.cropId = memberId;
  state.custom[memberId] ??= photoDefaults(memberId);
  return state.custom[memberId];
}

export function setCrop(state, memberId, patch) {
  state.custom[memberId] = { ...(state.custom[memberId] ?? photoDefaults(memberId)), ...patch };
  return state.custom[memberId];
}

export function resetCrop(state, memberId) {
  delete state.custom[memberId];
  state.cropId = memberId;
  return photoDefaults(memberId);
}
```

- [ ] **Step 4: Tulis `js/photo.js`**

```js
// Dialog crop/zoom/posisi dan unggah foto sendiri.
// `loadImage` tinggal di js/poster.js supaya hanya ada satu implementasi.
import { loadImage } from './poster.js';
import * as act from './state.js';
import { esc, photoOf } from './view.js';

const MAX_BYTES = 20 * 1024 * 1024;
const SLIDERS = [
  ['zoom', 'crop.zoom', { min: 1, max: 3, step: 0.05 }],
  ['x', 'crop.x', { min: 0, max: 100, step: 1 }],
  ['y', 'crop.y', { min: 0, max: 100, step: 1 }],
];

export function createCropDialog({ state, t, memberById, toast, redraw }) {
  const dialog = document.querySelector('#dialog');
  const body = document.querySelector('#dialogBody');

  const currentPhoto = () =>
    state.custom[state.cropId] ?? photoOf(memberById.get(state.cropId), state.custom);

  function syncPreview() {
    const img = body.querySelector('#cropImg');
    if (!img) return;
    const photo = currentPhoto();
    img.src = photo.url;
    img.style.objectPosition = `${photo.x}% ${photo.y}%`;
    img.style.transform = `scale(${photo.zoom})`;
    redraw();
  }

  function wire(memberId) {
    for (const [key, labelKey, range] of SLIDERS) {
      const input = body.querySelector(`#${key}`);
      input.addEventListener('input', () => {
        act.setCrop(state, memberId, { [key]: Number(input.value) });
        syncPreview();
      });
    }

    body.querySelector('#resetPhoto').addEventListener('click', () => {
      const photo = currentPhoto();
      if (photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url);
      act.resetCrop(state, memberId);
      open(memberId);
    });

    body.querySelector('#upload').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) return toast(t('crop.errType'));
      if (file.size > MAX_BYTES) return toast(t('crop.errSize'));

      const url = URL.createObjectURL(file);
      try {
        await loadImage(url);
      } catch {
        URL.revokeObjectURL(url);
        return toast(t('crop.errRead'));
      }

      const previous = currentPhoto();
      if (previous.url.startsWith('blob:')) URL.revokeObjectURL(previous.url);
      act.setCrop(state, memberId, { url, zoom: 1, x: 50, y: 50 });
      open(memberId);
    });
  }

  function open(memberId) {
    const member = memberById.get(memberId);
    if (!member) return;
    const photo = act.beginCrop(state, memberId);

    body.innerHTML =
      `<h2>${esc(t('crop.title', { name: member.name }))}</h2>` +
      `<label class="outline" style="display:inline-block;cursor:pointer">${esc(t('crop.choose'))}` +
      `<input type="file" accept="image/*" id="upload" style="display:none"></label> ` +
      `<button class="text-button" type="button" id="resetPhoto">${esc(t('crop.reset'))}</button>` +
      `<div class="crop"><img id="cropImg" src="${esc(photo.url)}" alt="${esc(t('crop.preview.alt'))}"></div>` +
      `<div class="sliders">` +
      SLIDERS.map(
        ([key, labelKey, range]) =>
          `<label>${esc(t(labelKey))}` +
          `<input id="${key}" type="range" min="${range.min}" max="${range.max}" step="${range.step}" value="${photo[key]}">` +
          `</label>`,
      ).join('') +
      `</div><p class="small">${esc(t('crop.privacy'))}</p>`;

    syncPreview();
    wire(memberId);
    if (!dialog.open) dialog.showModal();
  }

  return { open };
}
```

- [ ] **Step 5: Wire di `js/main.js`**

Tambahkan import dan konstruksi dialog setelah `draw` didefinisikan:

```js
import { createCropDialog } from './photo.js';
```

```js
const cropDialog = createCropDialog({ state, t, memberById, toast, redraw: draw });
```

Tambahkan cabang berikut di handler klik `#app`, tepat sebelum `switch (button.dataset.action)`:

```js
  if (button.dataset.photo !== undefined) {
    cropDialog.open(button.dataset.photo);
    return;
  }
```

- [ ] **Step 6: Jalankan seluruh test**

Run: `node --test`
Expected: PASS — termasuk 31 test di `test/state.test.mjs`.

- [ ] **Step 7: Verifikasi di browser**

1. Selesaikan alur sampai fase result (pilih `TWICE` + `BLACKPINK`, loop konsol dari Task 10 Step 7).
2. Klik `사진 편집` pada salah satu kartu: dialog terbuka berisi foto member itu dan tiga slider.
3. Geser `확대`, `좌우`, `위아래`: foto di dalam dialog **dan** kartu di belakangnya ikut berubah seketika.
4. Klik `내 사진 선택` dan pilih berkas JPG dari komputer: foto kartu berganti, slider kembali ke nilai awal.
5. Pilih berkas non-gambar (mis. `.txt`): muncul toast `이미지 파일을 선택해 주세요.` dan foto tidak berubah.
6. Klik `기본 사진으로`: foto kembali ke profil bawaan.
7. Klik `이미지 저장 ↓` setelah mengganti foto: **foto hasil suntingan ikut tergambar di PNG** (ini membuktikan `state.custom` benar-benar dipakai poster).
8. Tutup dialog dan muat ulang halaman: foto suntingan hilang (memang tidak dipersistensi).

- [ ] **Step 8: Commit**

```bash
git add js/photo.js js/state.js js/main.js test/state.test.mjs
git commit -m "feat: dialog crop dan unggah foto sendiri"
```

---

## Task 13: Dialog kredit dan dokumentasi

**Files:**
- Create: `js/credits.js`
- Create: `test/credits.test.mjs`
- Create: `CREDITS.md`
- Create: `README.md`
- Modify: `js/main.js` (wire tombol `#credits`)

**Interfaces:**
- Consumes: `GROUPS`, `MEMBERS`, `CHECKED` dari `data/roster.js`; `esc`, `groupLabel`, `memberLabel` dari `js/view.js`
- Produces: `renderCredits(state, t) -> string`

- [ ] **Step 1: Tulis test yang gagal**

`test/credits.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS } from '../data/roster.js';
import { renderCredits } from '../js/credits.js';
import ko from '../i18n/ko.js';
import en from '../i18n/en.js';
import { createTranslator } from '../js/i18n.js';

const tFor = (locale) => createTranslator({ ko, en }, () => locale, () => {});

const visibleGroups = GROUPS.filter((g) => !g.hidden);

test('renderCredits menampilkan satu baris per grup non-hidden', () => {
  const html = renderCredits({ lang: 'ko' }, tFor('ko'));
  assert.equal((html.match(/class="source-row"/g) ?? []).length, visibleGroups.length);
});

test('renderCredits tidak pernah menampilkan grup hidden', () => {
  const html = renderCredits({ lang: 'ko' }, tFor('ko'));
  for (const group of GROUPS.filter((g) => g.hidden)) {
    assert.ok(!html.includes(`>${group.name}<`), `${group.id} ikut tampil`);
  }
});

test('renderCredits memuat tautan ke data/photo-sources.json', () => {
  const html = renderCredits({ lang: 'ko' }, tFor('ko'));
  assert.ok(html.includes('href="data/photo-sources.json"'));
});

test('renderCredits menerjemahkan tanggal sesuai bahasa', () => {
  const koHtml = renderCredits({ lang: 'ko' }, tFor('ko'));
  const enHtml = renderCredits({ lang: 'en' }, tFor('en'));
  assert.ok(koHtml.includes('2026년'), 'tanggal Korea memakai format 년');
  assert.ok(enHtml.includes('2026'), 'tanggal Inggris memuat tahun');
  assert.ok(!enHtml.includes('년'), 'tanggal Inggris tidak memakai format Korea');
});

test('renderCredits memakai label grup sesuai bahasa', () => {
  const enHtml = renderCredits({ lang: 'en' }, tFor('en'));
  assert.ok(enHtml.includes('LOONA'));
  const koHtml = renderCredits({ lang: 'ko' }, tFor('ko'));
  assert.ok(koHtml.includes('이달의 소녀'));
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `node --test test/credits.test.mjs`
Expected: FAIL — `Cannot find module '../js/credits.js'`

- [ ] **Step 3: Tulis `js/credits.js`**

```js
// Modul murni: hanya menghasilkan string.
import { CHECKED, GROUPS, MEMBERS } from '../data/roster.js';
import { esc, groupLabel, memberLabel } from './view.js';

export function renderCredits(state, t) {
  const locale = state.lang === 'en' ? 'en' : 'ko';
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
    new Date(`${CHECKED}T00:00:00Z`),
  );

  const rows = GROUPS.filter((g) => !g.hidden)
    .map((group) => {
      const names = MEMBERS.filter((m) => m.groups.includes(group.id))
        .map((m) => esc(memberLabel(m, state.lang)))
        .join(', ');

      const source = group.source
        ? `<a href="${esc(group.source)}" target="_blank" rel="noopener noreferrer">${esc(t('credits.rosterSource'))}</a>`
        : esc(t('credits.operatorRoster'));

      const update = group.update
        ? ` · <a href="${esc(group.update)}" target="_blank" rel="noopener noreferrer">${esc(t('credits.update'))}</a>`
        : '';

      return (
        `<div class="source-row"><b>${esc(groupLabel(group, state.lang))}</b>` +
        `<p>${names || esc(t('credits.closed'))}</p>${source}${update}</div>`
      );
    })
    .join('');

  return (
    `<h2>${esc(t('credits.title'))}</h2>` +
    `<p class="small">${esc(t('credits.body', { date }))}</p>` +
    `<p class="small"><a href="data/photo-sources.json" target="_blank" rel="noopener noreferrer">${esc(t('credits.openSources'))}</a></p>` +
    rows
  );
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `node --test test/credits.test.mjs`
Expected: PASS, 5 test lulus.

- [ ] **Step 5: Wire tombol kredit di `js/main.js`**

Tambahkan import:

```js
import { renderCredits } from './credits.js';
```

Tambahkan sebelum `redrawAll()` di akhir berkas:

```js
document.querySelector('#credits').addEventListener('click', () => {
  const dialog = document.querySelector('#dialog');
  document.querySelector('#dialogBody').innerHTML = renderCredits(state, t);
  if (!dialog.open) dialog.showModal();
});
```

- [ ] **Step 6: Tulis `CREDITS.md`**

```markdown
# Kredit dan sumber

## Data roster

Daftar grup dan member berasal dari situs **https://mygirlnine.pages.dev/**
("여돌 구절판"), diambil 2026-09-26. Situs itu adalah sumber data primer proyek ini.

Data profil per grup (nama, generasi, tanggal debut) dirujuk dari **kprofiles.com**
lewat tautan `source` pada tiap grup di `data/roster.json`.

## Foto

Foto profil member disalin dari `https://mygirlnine.pages.dev/photos/` dan
diverifikasi terhadap `sha256` di `data/photo-sources.json`. Berkas asal di situs
itu berukuran 640×800.

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
```

- [ ] **Step 7: Tulis `README.md`**

```markdown
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
```

- [ ] **Step 8: Verifikasi di browser**

1. Klik `멤버 기준 · 사진 출처` di footer: dialog terbuka berisi daftar seluruh grup non-`hidden` dengan nama membernya.
2. Ganti bahasa ke English, buka lagi: judul, tanggal, label grup, dan nama member semuanya berbahasa Inggris; `이달의 소녀` menjadi `LOONA`.
3. Klik `사진별 확인 출처 열기`: `data/photo-sources.json` terbuka di tab baru.

- [ ] **Step 9: Commit**

```bash
git add js/credits.js js/main.js test/credits.test.mjs CREDITS.md README.md
git commit -m "feat: dialog kredit + CREDITS.md dan README.md"
```

---

## Task 14: Penjaga key i18n, smoke akhir, dan pembersihan

**Files:**
- Create: `test/i18n-keys.test.mjs`
- Modify: `docs/superpowers/specs/2026-09-28-listidol-clone-design.md` (tandai status selesai)

**Interfaces:**
- Consumes: seluruh modul
- Produces: —

- [ ] **Step 1: Tulis test penjaga key i18n**

Ini menutup risiko §15.4 spec: kamus bisa bertambah tanpa disadari.

`test/i18n-keys.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import en from '../i18n/en.js';
import ko from '../i18n/ko.js';

const NS = '(app|step|gen|common|setup|heat|sort|result|crop|credits|dialog|search|lang)';
const KEY_LITERAL = new RegExp(`'(?:${NS}\\.[a-z0-9.]+)'`, 'g');

function walk(dir) {
  return readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`],
  );
}

const sources = walk('js').filter((file) => file.endsWith('.js'));

function usedKeys() {
  const used = new Set();
  for (const file of sources) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const match of text.matchAll(KEY_LITERAL)) used.add(match[0].slice(1, -1));
  }
  return used;
}

test('ada berkas sumber untuk dipindai', () => {
  assert.ok(sources.length >= 10, `hanya ${sources.length} berkas`);
});

test('setiap key yang dipakai kode ada di kamus ko', () => {
  const missing = [...usedKeys()].filter((key) => !(key in ko)).sort();
  assert.deepEqual(missing, [], `key hilang dari i18n/ko.js: ${missing}`);
});

test('setiap key yang dipakai kode ada di kamus en', () => {
  const missing = [...usedKeys()].filter((key) => !(key in en)).sort();
  assert.deepEqual(missing, [], `key hilang dari i18n/en.js: ${missing}`);
});

test('ko dan en punya himpunan key yang identik', () => {
  assert.deepEqual(Object.keys(ko).sort(), Object.keys(en).sort());
});

test('tidak ada nilai kamus yang kosong', () => {
  for (const [locale, dict] of Object.entries({ ko, en })) {
    const empty = Object.entries(dict).filter(([, v]) => String(v).trim() === '').map(([k]) => k);
    assert.deepEqual(empty, [], `${locale} punya nilai kosong: ${empty}`);
  }
});

test('placeholder di ko dan en untuk key yang sama sama-sama cocok', () => {
  const names = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(ko)) {
    assert.deepEqual(names(ko[key]), names(en[key]), `placeholder beda pada ${key}`);
  }
});
```

- [ ] **Step 2: Jalankan test**

Run: `node --test`
Expected: PASS seluruh berkas test. Bila ada key yang hilang, tambahkan ke kedua kamus lalu ulangi.

- [ ] **Step 3: Smoke akhir di browser — empat fase, dua bahasa**

Jalankan server dan lakukan alur penuh dua kali.

```bash
python -m http.server 8080 --directory .
```

**Alur A (한국어):**

1. Muat `http://localhost:8080/`. Semua grup terpilih. Klik `시작 →`.
2. Di fase heat, jalankan turnamen lewat konsol:

```js
const loop = setInterval(() => {
  document.querySelectorAll('[data-member]').forEach((b) => b.click());
  const next = document.querySelector('[data-action="heatNext"]');
  if (next && !next.disabled) next.click();
  const pair = document.querySelectorAll('[data-sort]');
  if (pair.length) pair[0].click();
  if (document.querySelector('[data-action="download"]')) {
    clearInterval(loop);
    console.log('sampai fase result');
  }
}, 25);
```

3. Setelah mencapai fase result: ubah judul, klik `사진 편집` pada satu kartu dan geser slider, lalu klik `이미지 저장 ↓`.
4. Buka PNG hasil unduhan: **nama member tergambar sebagai huruf Hangul**, bukan kotak kosong.
5. Klik `새로 만들기`: kembali ke layar setup.

**Alur B (English):**

6. Ganti bahasa ke `English` lebih dulu, lalu ulangi langkah 1–3.
7. Periksa: nama member memakai romanisasi (`Sana`, bukan `사나`), nama grup memakai label Latin (`LOONA`, bukan `이달의 소녀`), dan nama berkas unduhan `my-9-picks.png`.

**Pemeriksaan lintas alur:**

8. Konsol browser bersih di kedua bahasa — tidak ada error, tidak ada `[i18n] missing key`, tidak ada 404 foto.
9. Matikan jaringan (DevTools → Network → Offline) lalu muat ulang: halaman tetap terbuka, dan foto yang gagal dimuat diganti avatar inisial, bukan ikon gambar rusak.
10. Buka `?lang=fr`: halaman jatuh ke bahasa tersimpan atau `ko`, bukan halaman kosong.

- [ ] **Step 4: Bersihkan artefak sekali pakai**

```bash
rm -f .firecrawl/index.html .firecrawl/robots.txt
ls .firecrawl/
git status --short
```

`.firecrawl/` tetap di-`.gitignore` dan tidak pernah masuk repo. Tidak ada berkas sementara lain yang dibuat sepanjang plan ini.

- [ ] **Step 5: Jalankan seluruh test sekali lagi**

Run: `node --test`
Expected: PASS seluruh berkas.

- [ ] **Step 6: Tandai spec sebagai selesai**

Ubah baris status di `docs/superpowers/specs/2026-09-28-listidol-clone-design.md`:

```markdown
Status: diimplementasikan 2026-09-28 (lihat docs/superpowers/plans/2026-09-28-listidol-clone.md)
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "test: penjaga key i18n + smoke akhir dua bahasa"
```

---

## Self-Review

**1. Cakupan spec.**

| Bagian spec | Task |
|---|---|
| §1 kriteria sukses 1–6 | Task 7 (shell), 9 (heat), 10 (sort), 11 (poster), 4+8 (search), 3+7 (i18n), 5+14 (test), 14 (deploy statis) |
| §2 non-goals | Tidak ada task yang menambahkannya; §15.1 plan menyebut penyimpangan `js/game.js` |
| §3 keputusan #1 tanpa build | Seluruh task; tidak ada `package.json` |
| §3 #2 data + mirror | Task 1, 2 |
| §3 #3 ko+en | Task 3, 7, 14 |
| §3 #4 search di layar pilih | Task 8, dan di heat Task 9 (input tetap ada di header fase) |
| §3 #5 semua fase | Task 7, 9, 10, 11 |
| §3 #6 state tunggal + render idempoten | Task 7 |
| §4 struktur file | Sesuai, dengan tambahan `js/view.js` dan `js/game.js` yang didokumentasikan |
| §5 model data + label per bahasa | Task 1, 6 |
| §5 struktur fase | Task 7, 9, 10, 11 |
| §6 state | Task 7 (tanpa `gen`, didokumentasikan) |
| §7 alur data satu arah | Task 7, 8 |
| §8 i18n (resolusi, fallback, switch, angka, tanggal, nama file) | Task 3, 7, 11, 13 |
| §9 search (normalize, index, query, invariant, penempatan, reset query) | Task 4, 8 |
| §10 poster (fonts, revoke, maxlength, layout) | Task 11 |
| §11 error handling (8 baris) | Task 3, 7, 8, 9, 11, 12 |
| §12 testing | Task 1–14; ditambah penjaga key i18n di Task 14 |
| §13 mirror, sha256, kredit, batasan | Task 2, 13 |
| §14 deploy | Task 14 (README) |
| §15 risiko | §15.1 didokumentasikan di File Structure; §15.2 di Task 6; §15.3 di Task 2; §15.4 ditutup Task 14 |

**2. Pemindaian placeholder.** Tidak ada "TBD", "TODO", "implement later", atau
"add appropriate error handling". Setiap langkah kode memuat kode yang bisa
ditempel langsung.

**3. Konsistensi tipe.** Nama dan tanda tangan yang dipakai lintas task:

- `search(query, index) -> Set<id>` — Task 4, dipakai Task 8.
- `buildIndex(items, textOf)` — Task 4, dipakai Task 7.
- `groupLines` / `labelsOf` — Task 6, dipakai Task 9, 10, 11, 13.
- `createHeat()` / `finishHeat()` / `advanceHeat()` / `beginHeat()` — Task 5, dipakai Task 9.
- `createSort()` / `beginSort()` / `chooseSort()` — Task 5, dipakai Task 8, 10.
- `setPhase()` adalah satu-satunya penulis `state.phase` dan satu-satunya tempat
  `state.query` dikosongkan — Task 7, dipakai Task 9, 10.
- `photoOf(member, custom)` — Task 6, dipakai Task 11, 12.
- `loadImage(url)` — Task 11, dipinjam Task 12.
- `effectiveTitle(state, t)` — Task 11, dipakai Task 11 (main.js).
- `ctx = { t, groupById, memberById, groupIndex, memberIndex }` — Task 7, dipakai semua fase.

**4. Review Focus.** Kelima butir punya test di task pemilik kodenya:

1. `debut` hilang/aneh → Task 5, `test/game.test.mjs` ("debut hilang tidak melempar").
2. `gen` di luar {2,3,4,5} → Task 3 (`genLabel` fallback) dan Task 6 ("tidak pernah mencetak undefined").
3. Member hanya di grup hidden → Task 5 ("member yang hanya ada di grup hidden tidak ikut").
4. `displayGroups` memuat id asing → Task 6 ("displayGroups berisi id asing" dan "tidak pernah mencetak undefined").
5. Query hanya spasi/tanda baca → Task 4 ("query kosong atau hanya tanda baca berarti TANPA filter").

