import { GROUPS, MEMBERS } from '../data/roster.js';
import { sortGroups } from './game.js';
import { genLabel } from './i18n.js';
import { buildIndex, groupText, search } from './search.js';
import { bar, esc, groupLabel, groupSearchText, memberLabel, navTabs, portrait } from './view.js';

/** Direktori grup: daftar semua grup + foto tiap anggotanya. Read-only. */
export function renderGroups(state, ctx) {
  const { t } = ctx;
  const locale = state.lang;
  const genLabelFn = (gen) => genLabel(gen, t);
  const matched = search(
    state.query,
    buildIndex(GROUPS, (g) => groupText(g, genLabelFn, groupSearchText)),
  );
  const groups = sortGroups(
    GROUPS.filter((g) => !g.hidden && matched.has(g.id)),
    false,
  );
  const count = (g) => MEMBERS.filter((m) => m.groups.includes(g.id)).length;
  const totalMembers = groups.reduce((n, g) => n + count(g), 0);

  const searchBox =
    `<div class="search-row">` +
    `<input type="search" data-action="search" value="${esc(state.query)}" ` +
    `placeholder="${esc(t('search.placeholder'))}" aria-label="${esc(t('search.aria'))}" ` +
    `autocomplete="off" spellcheck="false">` +
    (state.query.trim() !== ''
      ? `<button class="text-button" type="button" data-action="clearQuery">${esc(t('search.clear'))}</button>`
      : '') +
    `</div>`;

  const sections = groups
    .map((g) => {
      const members = MEMBERS.filter((m) => m.groups.includes(g.id));
      const cards = members
        .map(
          (m) =>
            `<div class="member"><div class="portrait">${portrait(m, state.custom, locale)}</div>` +
            `<div class="member-name">${esc(memberLabel(m, locale))}</div></div>`,
        )
        .join('');
      const meta = `${esc(genLabelFn(g.gen))} · ${esc(t('groups.members', { n: members.length }))}`;
      return (
        `<section class="group-section" aria-label="${esc(groupLabel(g, locale))}">` +
        `<h2>${esc(groupLabel(g, locale))}</h2><p class="meta">${meta}</p>` +
        `<div class="member-grid">${cards}</div></section>`
      );
    })
    .join('');

  return (
    `<div class="intro intro-compact"><div><div class="kicker">${esc(t('app.kicker'))}</div>` +
    `<h1>${esc(t('groups.title'))}</h1></div>${navTabs()}</div>` +
    `<div class="selection-head">${searchBox}</div>` +
    (groups.length
      ? `<p class="search-count">${esc(t('groups.count', { n: groups.length, members: totalMembers }))}</p>${sections}`
      : `<p class="empty" data-role="searchEmpty">${esc(t('groups.empty'))}</p>`) +
    bar(
      `<span class="count">${esc(t('groups.count', { n: groups.length, members: totalMembers }))}</span>`,
      `<button class="text-button" type="button" data-view="game">${esc(t('groups.back'))}</button>`,
    )
  );
}
