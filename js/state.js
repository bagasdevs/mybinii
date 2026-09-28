import { GROUPS, MEMBERS } from '../data/roster.js';
import {
  advanceHeat,
  beginHeat,
  beginSort,
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
