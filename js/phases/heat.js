import { steps } from '../view.js';

export function renderHeat(state, ctx) {
  return `${steps(state, ctx.t)}<h1>heat</h1>`;
}
