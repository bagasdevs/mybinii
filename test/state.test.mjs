import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, MEMBERS } from '../data/roster.js';
import {
  beginCrop,
  clearAllVisible,
  confirmHeat,
  createState,
  enterSort,
  leaveShared,
  loadShared,
  pickMember,
  pickSort,
  restore,
  undoSort,
  resetCrop,
  selectAllVisible,
  setCrop,
  setPhase,
  setQuery,
  setTitle,
  setView,
  startGame,
  snapshot,
  toggleDebut,
  toggleGeneration,
  toggleGroup,
} from '../js/state.js';

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

test('startGame mereset custom dan finalists, dan melepas blob unggahan', () => {
  const state = createState();
  state.custom = {
    g_twice_sana: { url: 'blob:upload-1', x: 1, y: 1, zoom: 1 },
    g_twice_mina: { url: 'photos/profile-g_twice_mina.jpg', x: 50, y: 25, zoom: 1 },
  };
  state.finalists = ['g_twice_sana'];

  const revoked = [];
  const original = URL.revokeObjectURL;
  URL.revokeObjectURL = (url) => revoked.push(url);
  try {
    startGame(state, {});
  } finally {
    URL.revokeObjectURL = original;
  }

  assert.deepEqual(state.custom, {});
  assert.deepEqual(state.finalists, []);
  assert.deepEqual(revoked, ['blob:upload-1'], 'hanya blob yang dilepas; path berkas tidak');
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

// Layar heat baru berisi kandidat yang berbeda; query sisa dari layar sebelumnya
// akan menyembunyikan seluruh kandidat baru (spec §9).
test('confirmHeat mengosongkan query di setiap layar heat baru', () => {
  const state = createState();
  startGame(state, {});
  assert.equal(state.phase, 'heat');

  let boards = 0;
  while (state.phase === 'heat') {
    if (boards++ > 500) throw new Error('heat tidak pernah selesai');
    for (const id of state.heat.current.slice(0, 3)) pickMember(state, id);
    setQuery(state, 'sana');
    assert.equal(confirmHeat(state, {}), true);
    assert.equal(state.query, '', `query tersisa setelah layar ${boards}`);
  }

  assert.ok(boards > 1, `hanya ${boards} layar`);
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

test('undoSort membatalkan satu perbandingan terakhir', () => {
  const state = smallGame();
  assert.equal(undoSort(state), false, 'tanpa riwayat tidak bisa undo');
  const before = { left: state.sort.left, right: state.sort.right, comparisons: state.sort.comparisons };
  pickSort(state, state.sort.left);
  assert.equal(state.sort.comparisons, before.comparisons + 1);
  assert.equal(undoSort(state), true);
  assert.equal(state.sort.comparisons, before.comparisons);
  assert.equal(state.sort.left, before.left);
  assert.equal(state.sort.right, before.right);
  assert.equal(undoSort(state), false, 'riwayat habis setelah satu undo');
});

test('pickSort yang diabaikan tidak menambah riwayat undo', () => {
  const state = smallGame();
  pickSort(state, 'bukan-kandidat');
  assert.equal(state.sortPast.length, 0);
  assert.equal(undoSort(state), false);
});

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
  assert.deepEqual(state.pool, []);
});

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

// --- simpan/muat progres ---------------------------------------------------

test('snapshot → restore mengembalikan fase dan perbandingan yang sama', () => {
  const state = smallGame();
  pickSort(state, state.sort.left);
  pickSort(state, state.sort.left);
  const before = {
    left: state.sort.left,
    right: state.sort.right,
    comparisons: state.sort.comparisons,
  };

  const loaded = createState();
  assert.equal(restore(loaded, JSON.parse(JSON.stringify(snapshot(state)))), true);
  assert.equal(loaded.phase, 'sort');
  assert.equal(loaded.sort.comparisons, before.comparisons);
  assert.equal(loaded.sort.left, before.left);
  assert.equal(loaded.sort.right, before.right);
  assert.deepEqual([...loaded.selected], [...state.selected]);

  // Perbandingan setelah dipulihkan harus tetap jalan, bukan macet.
  pickSort(loaded, loaded.sort.left);
  assert.equal(loaded.sort.comparisons, before.comparisons + 1);
});

test('snapshot → restore mengembalikan Set (bukan array) di heat', () => {
  const state = createState();
  startGame(state, {});
  pickMember(state, state.heat.current[0]);

  const loaded = createState();
  assert.equal(restore(loaded, JSON.parse(JSON.stringify(snapshot(state)))), true);
  assert.equal(loaded.phase, 'heat');
  assert.ok(loaded.heat.selected instanceof Set);
  assert.equal(loaded.heat.selected.size, 1);
  assert.ok(loaded.selected instanceof Set);
});

// `heat.winners` menyimpan satu daftar pemenang per layar, jadi bersarang.
// Validasi flat pernah menolak setiap simpanan yang sudah lewat layar pertama.
test('snapshot → restore menerima heat.winners yang bersarang', () => {
  const state = createState();
  startGame(state, {});
  for (const id of state.heat.current.slice(0, 3)) pickMember(state, id);
  assert.equal(confirmHeat(state, {}), true);
  assert.ok(Array.isArray(state.heat.winners[0]), 'satu daftar per layar');

  const loaded = createState();
  assert.equal(restore(loaded, JSON.parse(JSON.stringify(snapshot(state)))), true);
  assert.equal(loaded.phase, 'heat');
  assert.deepEqual(loaded.heat.winners, state.heat.winners);
});

test('restore menolak heat.winners yang tidak bersarang', () => {
  const state = createState();
  const base = { v: 1, phase: 'heat', selected: [], sort: { stack: [] } };
  assert.equal(restore(state, { ...base, heat: { winners: [MEMBERS[0].id] } }), false);
});

test('restore menolak paket yang tidak dikenal', () => {
  const state = createState();
  const base = { v: 1, phase: 'result', selected: [], sort: { stack: [] } };
  assert.equal(restore(state, null), false);
  assert.equal(restore(state, { ...base, v: 99 }), false, 'versi lain ditolak');
  assert.equal(restore(state, { ...base, phase: 'misteri' }), false, 'fase lain ditolak');
  assert.equal(restore(state, { ...base, selected: ['GRUP-HANTU'] }), false, 'grup hilang ditolak');
  assert.equal(
    restore(state, { ...base, sort: { stack: [{ ids: ['bukan-member'] }] } }),
    false,
    'member hilang ditolak',
  );
  assert.equal(state.phase, 'setup', 'state tidak tersentuh bila paket ditolak');
});

// --- tautan hasil bersama --------------------------------------------------

test('loadShared membuka fase result dengan sembilan finalis', () => {
  const state = createState();
  const ids = MEMBERS.slice(0, 9).map((m) => m.id);
  loadShared(state, { finalists: ids, title: '구절판' });

  assert.equal(state.phase, 'result');
  assert.deepEqual(state.finalists, ids);
  assert.equal(state.title, '구절판');
  assert.equal(state.titleTouched, true, 'judul bersama dipakai apa adanya');
  assert.equal(state.shared, true, 'penulisan progres harus ditahan');
  assert.equal(state.sortPast.length, 0);
});

test('loadShared tanpa judul membiarkan judul bawaan bahasa aktif', () => {
  const state = createState();
  loadShared(state, { finalists: MEMBERS.slice(0, 9).map((m) => m.id), title: '' });
  assert.equal(state.titleTouched, false);
});

test('leaveShared melepas penahan progres', () => {
  const state = createState();
  loadShared(state, { finalists: MEMBERS.slice(0, 9).map((m) => m.id), title: '' });
  leaveShared(state);
  assert.equal(state.shared, false);
});

test('restore tidak pernah menyalakan flag shared', () => {
  // Kalau paket simpanan bisa menyalakan `shared`, progres pengguna berhenti
  // tersimpan setelah reload.
  const state = createState();
  assert.equal(restore(state, { v: 1, phase: 'setup', selected: [], sort: { stack: [] } }), true);
  assert.equal(state.shared, false);
});

test('setView hanya menerima game dan groups', () => {
  const state = createState();
  assert.equal(state.view, 'game');
  setView(state, 'groups');
  assert.equal(state.view, 'groups');
  setView(state, 'setup');
  assert.equal(state.view, 'game');
});

test('setView tidak mengubah fase, pilihan, atau query', () => {
  const state = createState();
  setQuery(state, 'twice');
  setView(state, 'groups');
  assert.equal(state.view, 'groups');
  assert.equal(state.phase, 'setup');
  assert.equal(state.query, 'twice');
  assert.ok(state.selected.size > 0);
});

test('snapshot → restore tidak membawa view', () => {
  const state = createState();
  setView(state, 'groups');
  const loaded = createState();
  assert.equal(restore(loaded, JSON.parse(JSON.stringify(snapshot(state)))), true);
  assert.equal(loaded.view, 'game');
});
