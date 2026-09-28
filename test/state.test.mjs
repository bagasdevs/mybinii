import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, MEMBERS } from '../data/roster.js';
import { buildIndex, groupText, memberText } from '../js/search.js';
import {
  clearAllVisible,
  confirmHeat,
  createState,
  enterSort,
  pickMember,
  pickSort,
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

// ITZY(5) + IVE(6) + aespa(4) = 15 member: di bawah ambang 20, jadi langsung sort.
test('startGame dengan sedikit grup langsung masuk ke fase sort', () => {
  const state = createState();
  clearAllVisible(state);
  for (const id of ['ITZY', 'IVE', 'aespa']) toggleGroup(state, id);
  const eligible = MEMBERS.filter((m) => m.groups.some((g) => state.selected.has(g))).length;
  assert.ok(eligible > 8 && eligible <= 20, `eligible = ${eligible}`);
  const ok = startGame(state, {});
  assert.equal(ok, true);
  assert.equal(state.phase, 'sort');
  assert.equal(state.sort.candidateCount, eligible);
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

// --- sort ------------------------------------------------------------------

const smallGame = () => {
  const state = createState();
  clearAllVisible(state);
  for (const id of ['TWICE', 'BLACKPINK']) toggleGroup(state, id);
  startGame(state, {});
  return state;
};

test('pickSort berjalan sampai selesai dan mengisi finalists', () => {
  const state = smallGame();
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
  const state = smallGame();
  const before = state.sort.comparisons;
  pickSort(state, 'bukan-kandidat');
  assert.equal(state.sort.comparisons, before);
  assert.equal(state.phase, 'sort');
});

test('finalists selalu berisi 9 id unik milik pool yang dipilih', () => {
  const state = smallGame();
  let guard = 0;
  while (state.phase === 'sort' && guard++ < 500) pickSort(state, state.sort.right);
  assert.equal(state.finalists.length, 9);
  for (const id of state.finalists) assert.ok(state.pool.includes(id), `${id} bukan bagian pool`);
});
