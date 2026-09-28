import { steps } from '../view.js';

export function renderSort(state, ctx) {
  return `${steps(state, ctx.t)}<h1>sort</h1>`;
}
