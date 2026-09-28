import { heatSize } from '../game.js';
import { search } from '../search.js';
import { bar, esc, memberCard, steps } from '../view.js';

export function renderHeat(state, ctx) {
  const { t } = ctx;
  const { heat } = state;
  const need = Math.min(3, heat.current.length);
  const size = heatSize(heat.pool.length, heat.stage);
  const screen = Math.floor((heat.index - heat.current.length) / size) + 1;
  const total = Math.ceil(heat.pool.length / size);
  const isFinal = heat.stage === 'final';

  const stageLabel =
    heat.stage === 'main'
      ? t('heat.stage.round', { round: heat.round, total: heat.roundTotal })
      : isFinal
        ? t('heat.stage.final')
        : t('heat.stage.challenge');

  // Query hanya menyaring layar ini (bukan seluruh pool) dan tidak pernah
  // menyentuh heat.selected — sama seperti invariant search di layar setup.
  const searching = state.query.trim() !== '';
  const matched = search(state.query, ctx.memberIndex);
  const visible = heat.current.filter((id) => matched.has(id));

  const searchBox =
    `<div class="search-row">` +
    `<input type="search" data-action="search" value="${esc(state.query)}" ` +
    `placeholder="${esc(t('search.placeholder'))}" aria-label="${esc(t('search.aria'))}" ` +
    `autocomplete="off" spellcheck="false">` +
    (searching
      ? `<button class="text-button" type="button" data-action="clearQuery">${esc(t('search.clear'))}</button>`
      : '') +
    `</div>`;

  const resultCount = esc(
    t('search.count.members.heat', { n: visible.length, total: heat.current.length }),
  );
  const empty = visible.length
    ? ''
    : `<p class="empty" data-role="searchEmpty">${esc(t('search.empty'))}</p>`;

  const cards = visible
    .map((id, i) =>
      memberCard(ctx.memberById.get(id), {
        custom: state.custom,
        groupById: ctx.groupById,
        locale: state.lang,
        picked: heat.selected.has(id),
        // Baris pertama tampil di layar tanpa scroll; membiarkannya lazy
        // menunda LCP sampai setelah render.
        eager: i < 3,
      }),
    )
    .join('');

  const nextLabel = screen === total && isFinal ? t('heat.toSort') : t('heat.next');
  const next =
    `<button class="primary" type="button" data-action="heatNext" ` +
    `${heat.selected.size !== need ? 'disabled' : ''}>${esc(nextLabel)}</button>`;

  // Jalan keluar dari sesi yang dipulihkan: tanpa ini heat yang dilanjutkan
  // tidak bisa dibatalkan.
  const restart =
    `<button class="text-button" type="button" data-action="restart">${esc(t('result.restart'))}</button>`;

  return (
    steps(state, t) +
    `<div class="progress-head"><strong>${esc(stageLabel)}</strong>` +
    `<span>${esc(t('heat.screen', { screen, total }))}</span></div>` +
    `<div class="progress" role="progressbar" aria-label="${esc(t('heat.progress.aria', { stage: stageLabel }))}" ` +
    `aria-valuenow="${screen - 1}" aria-valuemin="0" aria-valuemax="${total}">` +
    `<div style="width:${(100 * (screen - 1)) / total}%"></div></div>` +
    // Nilai heat.pick memuat <em>, jadi sengaja tidak di-escape.
    `<h1>${t('heat.pick', { total: heat.current.length, need })}</h1>` +
    searchBox +
    `<div class="member-grid">${cards}</div>` +
    `<div class="search-count" data-role="searchCount">${resultCount}</div>${empty}` +
    bar(
      `<span class="count">${esc(t('heat.count', { picked: heat.selected.size, need }))}</span>` +
        restart,
      next,
    )
  );
}
