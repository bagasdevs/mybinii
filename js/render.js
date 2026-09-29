import { renderHeat } from './phases/heat.js';
import { renderResult } from './phases/result.js';
import { renderSetup } from './phases/setup.js';
import { renderSort } from './phases/sort.js';
import { renderGroups } from './groups.js';

/** Murni: mengembalikan HTML, tidak menyentuh DOM. */
export function render(state, ctx) {
  if (state.view === 'groups') return renderGroups(state, ctx);
  if (state.phase === 'setup') return renderSetup(state, ctx);
  if (state.phase === 'heat') return renderHeat(state, ctx);
  if (state.phase === 'sort') return renderSort(state, ctx);
  return renderResult(state, ctx);
}
