import { steps } from '../view.js';

export function renderResult(state, ctx) {
  return `${steps(state, ctx.t)}<h1>result</h1>`;
}
