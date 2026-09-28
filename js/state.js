import { GROUPS, MEMBERS } from '../data/roster.js';
import {
  beginHeat,
  beginSort,
  createHeat,
  createSort,
  eligibleMembers,
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
