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
  // Tie-break ikut dibalik saat debutDesc, persis seperti rumus di app.js asli
  // ((debutDesc?-1:1) mengalikan seluruh ekspresi, termasuk perbandingan id).
  const groups = [
    { id: 'has', debut: '2010-01-01' },
    { id: 'missing' },
    { id: 'empty', debut: '' },
  ];
  assert.doesNotThrow(() => sortGroups(groups, false));
  assert.deepEqual(sortGroups(groups, false).map((g) => g.id), ['empty', 'missing', 'has']);
  assert.deepEqual(sortGroups(groups, true).map((g) => g.id), ['has', 'missing', 'empty']);
});

test('sortGroups tidak memutasi masukan', () => {
  const groups = [{ id: 'B', debut: '2011-01-01' }, { id: 'A', debut: '2010-01-01' }];
  const before = groups.map((g) => g.id);
  sortGroups(groups, false);
  assert.deepEqual(groups.map((g) => g.id), before);
});

// --- alur heat -------------------------------------------------------------

// Protokol yang sama dengan confirmHeat di Task 9: finishHeat mencatat hasil,
// PEMANGGIL yang memuat layar berikutnya saat masih ada.
function playHeat(hs, pick = 3) {
  const picks = hs.current.slice(0, Math.min(pick, hs.current.length));
  const res = finishHeat(hs, picks);
  assert.equal(res.ok, true);
  if (res.action === 'continue') beginHeat(hs);
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

// Tanpa `ok: true` di jalur sukses, pemanggil yang memeriksa `!res.ok`
// (enterSort di js/state.js) salah membaca sort yang berhasil sebagai gagal.
test('beginSort melaporkan ok:true saat berhasil', () => {
  const res = beginSort(createSort(), ids(15));
  assert.equal(res.ok, true);
  assert.equal(res.done, false);
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
  // Hasil akhir selalu dipotong ke 9 teratas (app.js asli: finalists = out.slice(0,9)),
  // tapi seluruh 15 kandidat tetap dibandingkan sampai selesai.
  assert.equal(result.length, 9);
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
