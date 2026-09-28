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
