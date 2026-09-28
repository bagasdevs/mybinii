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
