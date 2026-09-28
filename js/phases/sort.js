import { sortLimit } from '../game.js';
import { esc, labelsOf, memberLabel, portrait, steps } from '../view.js';

export function renderSort(state, ctx) {
  const { t } = ctx;
  const { sort } = state;
  const limit = sortLimit(sort.candidateCount);
  const locale = state.lang;

  const card = (member) =>
    `<button class="member" type="button" data-sort="${esc(member.id)}">` +
    `<div class="portrait">${portrait(member, state.custom, locale, { eager: true })}</div>` +
    `<div class="member-name">${esc(memberLabel(member, locale))}</div>` +
    `<div class="member-group">${esc(labelsOf(member, ctx.groupById, locale))}</div>` +
    `</button>`;

  const pair = [sort.left, sort.right]
    .map((id) => ctx.memberById.get(id))
    .filter(Boolean)
    .map(card)
    .join('');

  const undo =
    `<button class="outline" type="button" data-action="undoSort" ` +
    `${state.sortPast.length ? '' : 'disabled'}>${esc(t('sort.undo'))}</button>`;

  return (
    steps(state, t) +
    `<div class="progress-head"><strong>${esc(t('sort.title'))}</strong>` +
    `<span>${esc(t('sort.count', { n: sort.comparisons, limit }))}</span></div>` +
    `<div class="progress" role="progressbar" aria-label="${esc(t('sort.progress.aria'))}" ` +
    `aria-valuenow="${sort.comparisons}" aria-valuemin="0" aria-valuemax="${limit}">` +
    `<div style="width:${(100 * sort.comparisons) / limit}%"></div></div>` +
    // Nilai sort.pick memuat <em>, jadi sengaja tidak di-escape.
    `<h1>${t('sort.pick')}</h1>` +
    `<div class="member-grid" style="grid-template-columns:repeat(2,1fr);max-width:620px">${pair}</div>` +
    `<div class="page-nav">${undo}` +
    `<button class="text-button" type="button" data-action="restart">${esc(t('result.restart'))}</button>` +
    `</div>`
  );
}
