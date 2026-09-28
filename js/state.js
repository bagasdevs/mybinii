import { GROUPS, MEMBERS } from '../data/roster.js';
import { defaultPhoto } from './view.js';
import {
  advanceHeat,
  beginHeat,
  beginSort,
  chooseSort,
  createHeat,
  createSort,
  eligibleMembers,
  finishHeat,
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
    sortPast: [],
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

/** Menandai bahwa pengguna sudah menyunting judul, sehingga i18n berhenti menimpanya. */
export function setTitle(state, value) {
  state.title = value;
  state.titleTouched = true;
}

/** Satu-satunya tempat `state.query` dikosongkan. */
function resetQuery(state) {
  state.query = '';
}

/** Satu-satunya tempat transisi fase. Selalu mengosongkan query. */
export function setPhase(state, phase) {
  state.phase = phase;
  resetQuery(state);
}

/**
 * Buang foto unggahan sekaligus lepaskan object URL-nya. Foto bawaan memakai
 * path berkas, jadi hanya blob yang di-revoke.
 */
function releaseCustom(state) {
  for (const photo of Object.values(state.custom)) {
    if (photo?.url?.startsWith('blob:')) URL.revokeObjectURL(photo.url);
  }
  state.custom = {};
}

// --- alur permainan --------------------------------------------------------

export function startGame(state, { onTooFew } = {}) {
  const eligible = eligibleMembers(MEMBERS, state.selected);
  if (eligible.length < 9) {
    onTooFew?.();
    return false;
  }

  state.pool = eligible.map((m) => m.id);
  releaseCustom(state);
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
  state.sortPast = [];
  setPhase(state, 'sort');
  return true;
}

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

  // Layar heat baru berisi kandidat yang berbeda, jadi query dari layar
  // sebelumnya akan menyembunyikan kandidat secara tak terduga (spec §9).
  if (result.action === 'continue') {
    resetQuery(state);
    beginHeat(state.heat);
    return true;
  }

  const next = advanceHeat(state.heat);
  if (next.next === 'heat') {
    resetQuery(state);
    return true;
  }

  if (!enterSort(state, next.ids)) {
    onTooFew?.();
    setPhase(state, 'setup');
  }
  return true;
}

// --- sort ------------------------------------------------------------------

/** Mencatat satu perbandingan; mengisi `finalists` dan pindah ke fase result bila selesai. */
export function pickSort(state, memberId) {
  state.sortPast.push(structuredClone(state.sort));
  const result = chooseSort(state.sort, memberId);
  if (result.done) {
    state.finalists = result.result;
    setPhase(state, 'result');
  } else if (result.ignored) {
    state.sortPast.pop();
  }
  return result;
}

/** Batalkan satu perbandingan terakhir; false bila tidak ada riwayat. */
export function undoSort(state) {
  const previous = state.sortPast.pop();
  if (!previous) return false;
  state.sort = previous;
  return true;
}

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

// --- simpan/muat progres ---------------------------------------------------

const SAVE_VERSION = 1;
const PHASES = new Set(['setup', 'heat', 'sort', 'result']);
const groupIds = new Set(GROUPS.map((g) => g.id));

/**
 * Ringkasan yang aman disimpan: Set jadi array, riwayat undo dibuang.
 * Foto unggahan (`custom`) sengaja tidak ikut — isinya blob URL yang mati
 * begitu halaman ditutup.
 */
export function snapshot(state) {
  return {
    v: SAVE_VERSION,
    debutDesc: state.debutDesc,
    selected: [...state.selected],
    phase: state.phase,
    pool: state.pool,
    finalists: state.finalists,
    title: state.title,
    titleTouched: state.titleTouched,
    heat: { ...state.heat, selected: [...state.heat.selected] },
    sort: state.sort,
  };
}

const isIdList = (list) => Array.isArray(list) && list.every((id) => memberById.has(id));

/**
 * Pulihkan hasil `snapshot` ke `state`. `false` bila paket tidak dikenal atau
 * berisi id yang sudah tidak ada di roster — mulai dari awal lebih aman
 * daripada merender member yang hilang.
 */
export function restore(state, data) {
  if (data?.v !== SAVE_VERSION || !PHASES.has(data.phase)) return false;

  const frames = data.sort?.stack;
  const selected = data.selected;
  if (!Array.isArray(frames) || !Array.isArray(selected)) return false;
  if (!selected.every((id) => groupIds.has(id))) return false;

  const heat = data.heat ?? {};
  const lists = [
    data.pool,
    data.finalists,
    heat.pool,
    heat.winners,
    heat.losers,
    heat.current,
    heat.selected,
    heat.mainSurvivors,
    ...frames.flatMap((f) => [f.ids, f.left, f.right, f.out]),
  ];
  if (!lists.every((list) => list === undefined || isIdList(list))) return false;

  state.debutDesc = Boolean(data.debutDesc);
  state.selected = new Set(selected);
  state.pool = data.pool ?? [];
  state.finalists = data.finalists ?? [];
  state.title = data.title ?? '';
  state.titleTouched = Boolean(data.titleTouched);
  state.heat = { ...createHeat(), ...heat, selected: new Set(heat.selected ?? []) };
  state.sort = { ...createSort(), ...data.sort, stack: frames };
  state.sortPast = [];
  state.cropId = null;
  setPhase(state, data.phase);
  return true;
}
