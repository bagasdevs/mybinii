import { heatSize } from '../game.js';
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

  const cards = heat.current
    .map((id) =>
      memberCard(ctx.memberById.get(id), {
        custom: state.custom,
        groupById: ctx.groupById,
        locale: state.lang,
        picked: heat.selected.has(id),
      }),
    )
    .join('');

  const nextLabel = screen === total && isFinal ? t('heat.toSort') : t('heat.next');
  const next =
    `<button class="primary" type="button" data-action="heatNext" ` +
    `${heat.selected.size !== need ? 'disabled' : ''}>${esc(nextLabel)}</button>`;

  return (
    steps(state, t) +
    `<div class="progress-head"><strong>${esc(stageLabel)}</strong>` +
    `<span>${esc(t('heat.screen', { screen, total }))}</span></div>` +
    `<div class="progress" role="progressbar" aria-label="${esc(t('heat.progress.aria', { stage: stageLabel }))}" ` +
    `aria-valuenow="${screen - 1}" aria-valuemin="0" aria-valuemax="${total}">` +
    `<div style="width:${(100 * (screen - 1)) / total}%"></div></div>` +
    // Nilai heat.pick memuat <em>, jadi sengaja tidak di-escape.
    `<h1>${t('heat.pick', { total: heat.current.length, need })}</h1>` +
    `<div class="member-grid">${cards}</div>` +
    bar(`<span class="count">${esc(t('heat.count', { picked: heat.selected.size, need }))}</span>`, next)
  );
}
