import { POSTER_LAYOUT, bar, esc, labelsOf, memberLabel, portrait, steps } from '../view.js';

/** Judul efektif: hasil suntingan pengguna, atau nama aplikasi yang ikut bahasa. */
export function effectiveTitle(state, t) {
  return state.titleTouched ? state.title : t('app.brand');
}

export function renderResult(state, ctx) {
  const { t } = ctx;
  const locale = state.lang;
  const title = effectiveTitle(state, t);

  const cards = POSTER_LAYOUT.map((rankIndex) => {
    const member = ctx.memberById.get(state.finalists[rankIndex]);
    if (!member) return '';
    return (
      `<div class="poster-card">` +
      `<span class="badge ${rankIndex === 0 ? 'first' : ''}">${esc(t('result.rank', { n: rankIndex + 1 }))}</span>` +
      `<div class="portrait">${portrait(member, state.custom, locale)}` +
      `<button class="edit-photo" type="button" data-photo="${esc(member.id)}">${esc(t('result.editPhoto'))}</button></div>` +
      `<div class="member-name">${esc(memberLabel(member, locale))}</div>` +
      `<div class="member-group">${esc(labelsOf(member, ctx.groupById, locale))}</div>` +
      `</div>`
    );
  }).join('');

  return (
    steps(state, t) +
    `<h1>${esc(t('result.title'))}</h1>` +
    `<div class="result-tools">` +
    `<input id="posterTitle" maxlength="35" aria-label="${esc(t('result.titleInput.aria'))}" value="${esc(title)}">` +
    `</div>` +
    `<div class="poster-wrap"><div class="poster" id="poster">` +
    `<div class="eyebrow">${esc(t('app.eyebrow'))}</div>` +
    `<h2 id="liveTitle">${esc(title)}</h2>` +
    `<div class="poster-grid">${cards}</div>` +
    `<div class="poster-foot">${esc(t('result.foot'))}</div>` +
    `</div></div>` +
    `<p class="small" style="text-align:center">${esc(t('result.privacy'))}</p>` +
    bar(
      `<button class="outline" type="button" data-action="restart">${esc(t('result.restart'))}</button>`,
      `<button class="outline" type="button" data-action="share">${esc(t('result.share'))}</button>` +
        `<button class="primary lime" type="button" data-action="download">${esc(t('result.download'))}</button>`,
    )
  );
}
