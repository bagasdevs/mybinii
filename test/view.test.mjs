import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EN_GROUP_OVERRIDES,
  KO_GROUP_OVERRIDES,
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
  thumbUrl,
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
  // Grup yang nama Korea bakunya belum ada tetap memakai `name` apa adanya.
  assert.equal(groupLabel(byId('TUIDE'), 'ko'), 'TUIDE');
  // Yang punya override memakai nama Korea, bukan `name` latinnya.
  assert.equal(groupLabel(byId('TWICE'), 'ko'), '트와이스');
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
    for (const locale of ['ko', 'en', 'id']) {
      const label = groupLabel(g, locale);
      assert.ok(label && label !== 'undefined', `${g.id} / ${locale}`);
    }
  }
});

test('id memakai label latin yang sama dengan en', () => {
  assert.equal(groupLabel(byId('이달의 소녀'), 'id'), 'LOONA');
  assert.equal(memberLabel({ name: '사나', english: 'Sana' }, 'id'), 'Sana');
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
  assert.equal(memberLabel(member, 'id'), 'Sana');
});

// --- labelsOf --------------------------------------------------------------

test('labelsOf memakai displayGroups bila ada', () => {
  const member = { id: 'x', groups: ['구구단', 'I.O.I'], displayGroups: ['I.O.I'] };
  assert.equal(labelsOf(member, groupById, 'ko'), '아이오아이');
});

test('labelsOf memakai groups bila displayGroups kosong', () => {
  const member = { id: 'x', groups: ['TWICE'] };
  assert.equal(labelsOf(member, groupById, 'ko'), '트와이스');
});

test('labelsOf: displayGroups berisi id asing -> jatuh ke groups', () => {
  const member = { id: 'x', groups: ['TWICE'], displayGroups: ['TIDAK-ADA'] };
  assert.equal(labelsOf(member, groupById, 'ko'), '트와이스');
});

test('labelsOf tidak pernah mencetak undefined saat semua id asing', () => {
  const member = { id: 'g_asing', groups: ['TIDAK-ADA'], displayGroups: ['JUGA-TIDAK-ADA'] };
  const label = labelsOf(member, groupById, 'ko');
  assert.equal(label, 'g_asing');
  assert.ok(!label.includes('undefined'));
});

test('groupLines mengembalikan satu entri per grup', () => {
  const member = { id: 'x', groups: ['구구단', 'I.O.I'], displayGroups: ['I.O.I'] };
  assert.deepEqual(groupLines(member, groupById, 'ko'), ['아이오아이']);
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
  const html = portrait(
    { id: 'a', image: 'photos/a.jpg', name: '에이', english: 'A', crop: { x: 10, y: 20, zoom: 2 } },
    {},
    'en',
  );
  assert.ok(html.includes('object-position:10% 20%'));
  assert.ok(html.includes('scale(2)'));
  assert.ok(html.includes('data-member="a"'));
});

test('alt portrait mengikuti bahasa yang aktif', () => {
  const member = { id: 'a', image: 'photos/a.jpg', name: '사나', english: 'Sana' };
  assert.ok(portrait(member, {}, 'en').includes('alt="Sana"'));
  assert.ok(portrait(member, {}, 'ko').includes('alt="사나"'));
});

// Grid memuat thumbnail WebP; berkas aslinya tetap dipakai poster dan
// pratinjau crop (test/poster.test.mjs memakai member.image langsung).
test('thumbUrl menurunkan jalur thumbnail dari ekstensi apa pun', () => {
  assert.equal(thumbUrl('photos/profile-a.jpg'), 'photos/thumb/profile-a.webp');
  assert.equal(thumbUrl('photos/upload-20260927-g_a_b.jpeg'), 'photos/thumb/upload-20260927-g_a_b.webp');
  assert.equal(thumbUrl('photos/profile-a.png'), 'photos/thumb/profile-a.webp');
  assert.equal(thumbUrl('blob:upload-1'), null, 'foto unggahan tidak punya thumbnail');
  // Member tanpa image tetap boleh dirender (avatar inisial), bukan crash.
  assert.equal(thumbUrl(undefined), null);
});

test('portrait memakai thumbnail untuk foto bawaan', () => {
  const member = { id: 'a', image: 'photos/profile-a.jpeg', name: '에이', english: 'A' };
  assert.ok(portrait(member, {}, 'en').includes('src="photos/thumb/profile-a.webp"'));
});

test('KO_GROUP_OVERRIDES hanya berisi grup yang ada, dan hanya yang perlu', () => {
  for (const [id, ko] of Object.entries(KO_GROUP_OVERRIDES)) {
    const group = groupById.get(id);
    assert.ok(group, `id grup tidak dikenal: ${id}`);
    assert.match(ko, /[\uAC00-\uD7AF]/, `${id} bukan Hangul: ${ko}`);
    assert.notEqual(ko, group.name, `${id} namanya sudah Korea, override tidak perlu`);
    assert.equal(groupLabel(group, 'ko'), ko);
  }
});

// Nama Korea yang belum baku sengaja dibiarkan latin daripada ditebak. Test ini
// mengunci daftarnya supaya penambahan/pengurangan terlihat, bukan diam-diam.
test('tepat delapan grup masih memakai nama latin di label Korea', () => {
  const latin = GROUPS.filter((g) => !/[\uAC00-\uD7AF]/.test(groupLabel(g, 'ko')))
    .map((g) => g.id)
    .sort();
  assert.deepEqual(latin, [
    'Baby DONT Cry',
    'H//PE Princess',
    'LIMELIGHT',
    'ODD YOUTH',
    'OURBIRTHDAY',
    'TUIDE',
    'UNCHILD',
    'USPEER',
  ]);
});

test('portrait tidak menulis ulang foto unggahan pengguna', () => {
  const member = { id: 'a', image: 'photos/profile-a.jpg', name: '에이', english: 'A' };
  const custom = { a: { url: 'blob:upload-1', x: 50, y: 25, zoom: 1 } };
  const html = portrait(member, custom, 'en');
  assert.ok(html.includes('src="blob:upload-1"'));
  assert.ok(!html.includes('thumb'), 'blob tidak boleh dipetakan ke thumbnail');
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
  assert.ok(html.startsWith('<ol class="steps">'));
  assert.ok(html.includes('aria-current="step"'));
});
