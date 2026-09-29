import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { CHECKED, GROUPS, MEMBERS } from '../data/roster.js';
import { thumbUrl } from '../js/view.js';

const PHOTOS = JSON.parse(
  readFileSync(new URL('../data/photo-sources.json', import.meta.url), 'utf8'),
);
const photoById = new Map(PHOTOS.map((p) => [p.id, p]));

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

// 193 foto diunggah operator, jadi tidak semua punya URL sumber web. Yang
// benar-benar selalu ada di setiap entri adalah matchMethod.
test('setiap member punya entri photo-sources dengan matchMethod', () => {
  for (const m of MEMBERS) {
    const entry = photoById.get(m.id);
    assert.ok(entry, `photo-sources tidak punya ${m.id}`);
    assert.ok(String(entry.matchMethod ?? '').trim(), `${m.id} tanpa matchMethod`);
  }
});

test('sha256, bila ada, selalu 64 heksadesimal', () => {
  for (const m of MEMBERS) {
    const { sha256 } = photoById.get(m.id);
    if (sha256 === undefined) continue;
    assert.match(sha256, /^[0-9a-f]{64}$/, `${m.id} sha256 tidak valid`);
  }
});

// Mirror memindahkan foto ke photos/ dan menulis ulang nilai `image`; situs
// tidak boleh menyentuh jaringan saat runtime.
test('setiap image menunjuk berkas lokal di photos/', () => {
  for (const m of MEMBERS) {
    assert.match(m.image, /^photos\//, `${m.id} masih menunjuk URL luar: ${m.image}`);
  }
});

test('setiap member punya berkas foto di photos/', () => {
  for (const m of MEMBERS) {
    const file = new URL(`../${m.image}`, import.meta.url);
    assert.ok(existsSync(file), `berkas hilang: ${m.image}`);
  }
});

// Grid memuat thumbnail (49,3 MB -> 8,7 MB); berkas asli hanya untuk poster dan
// pratinjau crop. Jalur thumbnail diturunkan di js/view.js, jadi berkas yang
// hilang tidak error — hanya tampil sebagai avatar inisial. Test ini yang
// menjaga setiap foto baru ikut dibuatkan thumbnail.
test('setiap image punya thumbnail WebP yang lebih kecil', () => {
  for (const m of MEMBERS) {
    const thumb = new URL(`../${thumbUrl(m.image)}`, import.meta.url);
    assert.ok(existsSync(thumb), `thumbnail hilang: ${thumbUrl(m.image)}`);
    const original = statSync(new URL(`../${m.image}`, import.meta.url)).size;
    assert.ok(
      statSync(thumb).size < original,
      `thumbnail tidak lebih kecil dari aslinya: ${m.image}`,
    );
  }
});

test('tepat lima member tanpa sha256, dan itu memang tercatat di sumber', () => {
  // Sumbernya: satu foto yang disediakan pengguna (Weeekly) dan empat tautan
  // resmi Weverse (QWER). Test ini sengaja mengunci pengecualiannya, supaya
  // perubahan data di masa depan terlihat, bukan diam-diam lolos.
  const missing = MEMBERS.filter((m) => !photoById.get(m.id).sha256)
    .map((m) => m.id)
    .sort();
  assert.deepEqual(missing, [
    'g_qwer_chodan',
    'g_qwer_hina',
    'g_qwer_magenta',
    'g_qwer_siyeon',
    'g_weeekly_soojin',
  ]);
});
