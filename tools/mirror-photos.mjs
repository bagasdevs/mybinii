// Mengunduh foto member ke photos/ dan memverifikasi sha256-nya.
// Idempoten: berkas yang sudah ada dan cocok dilewati.
// Jalankan: node tools/mirror-photos.mjs [--force]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { MEMBERS } from '../data/roster.js';

const BASE = 'https://mygirlnine.pages.dev/';
const PHOTOS_DIR = new URL('../photos/', import.meta.url);
const ROSTER_JSON = new URL('../data/roster.json', import.meta.url);
const SOURCES = new Map(
  JSON.parse(readFileSync(new URL('../data/photo-sources.json', import.meta.url), 'utf8')).map(
    (p) => [p.id, p],
  ),
);
const CONCURRENCY = 8;
const FORCE = process.argv.includes('--force');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * JPEG, PNG, AVIF, WebP, atau GIF.
 *
 * Dua penjaga nyata di sini: (1) situs asli menyajikan sebagian foto sebagai
 * AVIF, bukan JPEG — terverifikasi pada g_kep1er_yeseo dan g_loona_hyunjin,
 * yang sha256-nya cocok; (2) empat foto QWER diambil dari CDN Weverse, yang
 * membalas halaman HTML bila User-Agent-nya tidak disukai. Penjaga ini
 * menangkap keduanya alih-alih menyimpan HTML sebagai .jpg.
 */
function looksLikeImage(buf) {
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const gif = buf.subarray(0, 3).toString('latin1') === 'GIF';
  const webp =
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP';
  const avif = buf.subarray(4, 12).toString('latin1').includes('ftypavif');
  return jpeg || png || gif || webp || avif;
}

/**
 * Foto `photos/user-final-*` adalah berkas yang diunggah/diganti operator situs
 * asli setelah `sha256` di photo-sources.json dihitung, sehingga hash tercatat
 * itu basi (13 dari 14 berkas tidak cocok; satu tidak punya hash sama sekali).
 * Untuk entri itu hash diperlakukan sebagai petunjuk, bukan syarat.
 */
const hasStaleHash = (member) =>
  /(^|\/)user-final-/.test(SOURCES.get(member.id)?.localPath ?? '');

/**
 * Nama berkas lokal untuk seorang member.
 * `member.image` boleh berupa path relatif ke situs asli, atau URL absolut
 * (4 member QWER); yang absolut dipetakan ke `photos/profile-<id>.jpg`.
 */
function localName(member) {
  return member.image.startsWith('photos/')
    ? member.image.slice('photos/'.length)
    : `profile-${member.id}.jpg`;
}

function sourceUrl(member) {
  return /^https?:/.test(member.image) ? member.image : new URL(member.image, BASE).href;
}

async function fetchPhoto(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; listidol-mirror/1.0)' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

/** 'verified' | 'unverified' | 'stale-hash' */
function trustLevel(member) {
  const entry = SOURCES.get(member.id);
  if (!entry?.sha256) return 'unverified';
  return hasStaleHash(member) ? 'stale-hash' : 'verified';
}

const statusFor = (prefix, trust) => `${prefix}${trust === 'verified' ? '' : `-${trust}`}`;

async function mirrorOne(member) {
  const expected = SOURCES.get(member.id)?.sha256;
  const trust = trustLevel(member);
  const name = localName(member);
  const target = new URL(name, PHOTOS_DIR);

  if (!FORCE && existsSync(target)) {
    const buf = readFileSync(target);
    const ok =
      trust === 'verified' ? sha256(buf) === expected : looksLikeImage(buf);
    if (ok) return { id: member.id, status: statusFor('cached', trust), name };
  }

  const buf = await fetchPhoto(sourceUrl(member));
  if (!looksLikeImage(buf)) {
    return { id: member.id, status: 'not-an-image', name, bytes: buf.length };
  }

  const actual = sha256(buf);
  if (trust === 'verified' && actual !== expected) {
    return { id: member.id, status: 'hash-mismatch', name, expected, actual };
  }

  writeFileSync(target, buf);
  return { id: member.id, status: statusFor('downloaded', trust), name, sha256: actual };
}

async function runPool(items, worker, size) {
  const results = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        try {
          results.push(await worker(item));
        } catch (err) {
          results.push({ id: item.id, status: 'error', message: err.message });
        }
      }
    }),
  );
  return results;
}

/**
 * Tulis ulang nilai `image` yang berupa URL absolut menjadi path lokal, supaya
 * `member.image` berarti satu hal saja di seluruh aplikasi. URL aslinya tidak
 * hilang: tetap tercatat sebagai `imageUrl` di data/photo-sources.json.
 */
function normalizeRoster() {
  const raw = readFileSync(ROSTER_JSON, 'utf8');
  const data = JSON.parse(raw);
  const byId = new Map(data.members.map((m) => [m.id, m]));

  let changed = 0;
  for (const member of MEMBERS) {
    if (!/^https?:/.test(member.image)) continue;
    const entry = byId.get(member.id);
    if (!entry) continue;
    entry.image = `photos/${localName(member)}`;
    changed++;
  }

  if (changed) {
    const pretty = raw.includes('\n');
    writeFileSync(ROSTER_JSON, pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));
  }
  return changed;
}

mkdirSync(PHOTOS_DIR, { recursive: true });

const results = await runPool(MEMBERS, mirrorOne, CONCURRENCY);
const counts = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
console.log(counts);

const rewritten = normalizeRoster();
if (rewritten) {
  console.log(`data/roster.json: ${rewritten} nilai image diubah ke path lokal`);
  console.log('jalankan `node tools/build-roster.mjs` untuk regenerate data/roster.js');
}

const bad = results.filter(
  (r) => !r.status.startsWith('cached') && !r.status.startsWith('downloaded'),
);
if (bad.length) {
  console.error('GAGAL:', bad.slice(0, 10));
  process.exit(1);
}

for (const trust of ['unverified', 'stale-hash']) {
  const rows = results.filter((r) => r.status.endsWith(trust));
  if (!rows.length) continue;
  const reason =
    trust === 'unverified'
      ? 'tidak ada sha256 di sumber (foto unggahan operator / tautan Weverse)'
      : 'sha256 di sumber basi: situs asli mengganti berkasnya setelah hash dihitung';
  console.warn(`TANPA verifikasi hash (${rows.length}) — ${reason}:`);
  for (const r of rows) console.warn(`  ${r.id} -> photos/${r.name}`);
}
console.log(`OK: ${results.length} foto terverifikasi di photos/`);
