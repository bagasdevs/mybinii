// Modul murni: hanya menghasilkan string.
import { CHECKED, GROUPS, MEMBERS } from '../data/roster.js';
import { esc, groupLabel, memberLabel } from './view.js';

export function renderCredits(state, t) {
  const locale = state.lang === 'ko' ? 'ko' : state.lang === 'id' ? 'id' : 'en';
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(
    new Date(`${CHECKED}T00:00:00Z`),
  );

  const rows = GROUPS.filter((g) => !g.hidden)
    .map((group) => {
      const names = MEMBERS.filter((m) => m.groups.includes(group.id))
        .map((m) => esc(memberLabel(m, state.lang)))
        .join(', ');

      const source = group.source
        ? `<a href="${esc(group.source)}" target="_blank" rel="noopener noreferrer">${esc(t('credits.rosterSource'))}</a>`
        : esc(t('credits.operatorRoster'));

      const update = group.update
        ? ` · <a href="${esc(group.update)}" target="_blank" rel="noopener noreferrer">${esc(t('credits.update'))}</a>`
        : '';

      return (
        `<div class="source-row"><b>${esc(groupLabel(group, state.lang))}</b>` +
        `<p>${names || esc(t('credits.closed'))}</p>${source}${update}</div>`
      );
    })
    .join('');

  return (
    `<h2 id="dialogTitle">${esc(t('credits.title'))}</h2>` +
    `<p class="small">${esc(t('credits.body', { date }))}</p>` +
    `<p class="small"><a href="data/photo-sources.json" target="_blank" rel="noopener noreferrer">${esc(t('credits.openSources'))}</a></p>` +
    rows
  );
}
