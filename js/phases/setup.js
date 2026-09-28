import { GROUPS, MEMBERS } from '../../data/roster.js';
import { eligibleMembers, sortGroups } from '../game.js';
import { genLabel } from '../i18n.js';
import { search } from '../search.js';
import { bar, esc, groupLabel, steps, visibleGroups } from '../view.js';

const GENERATION_TABS = [0, 2, 3, 4, 5];

export function renderSetup(state, ctx) {
  const { t } = ctx;
  const locale = state.lang;
  const eligible = eligibleMembers(MEMBERS, state.selected);
  const matched = search(state.query, ctx.groupIndex);
  const groups = sortGroups(
    visibleGroups().filter((g) => matched.has(g.id)),
    state.debutDesc,
  );

  const searching = state.query.trim() !== '';
  const searchBox =
    `<div class="search-row">` +
    `<input type="search" data-action="search" value="${esc(state.query)}" ` +
    `placeholder="${esc(t('search.placeholder'))}" aria-label="${esc(t('search.aria'))}" ` +
    `autocomplete="off" spellcheck="false">` +
    (searching
      ? `<button class="text-button" type="button" data-action="clearQuery">${esc(t('search.clear'))}</button>`
      : '') +
    `</div>`;

  const tabs = GENERATION_TABS.map((gen) => {
    const subset = GROUPS.filter((g) => !g.disabled && !g.hidden && (!gen || g.gen === gen));
    const on = subset.length > 0 && subset.every((g) => state.selected.has(g.id));
    const label = gen === 0 ? t('setup.tab.all') : genLabel(gen, t);
    return `<button class="tab ${on ? 'on' : ''}" type="button" data-gen="${gen}">${esc(label)}</button>`;
  }).join('');

  const cards = groups
    .map((g) => {
      const selected = state.selected.has(g.id);
      const count = MEMBERS.filter((m) => m.groups.includes(g.id)).length;
      const meta = g.disabled
        ? t('setup.group.disabled')
        : t('setup.group.meta', { gen: genLabel(g.gen, t), n: count });
      return (
        `<button class="group ${selected ? 'selected' : ''}" type="button" ` +
        `data-group="${esc(g.id)}" aria-pressed="${selected}" ${g.disabled ? 'disabled' : ''}>` +
        `<strong>${esc(groupLabel(g, locale))}</strong>` +
        `<span class="tick">${selected ? '✓' : ''}</span>` +
        `<span class="meta">${esc(meta)}</span>` +
        `</button>`
      );
    })
    .join('');

  const resultCount = esc(
    t('search.count.groups', { n: groups.length, total: visibleGroups().length }),
  );
  const empty = groups.length
    ? ''
    : `<p class="empty" data-role="searchEmpty">${esc(t('search.empty'))}</p>`;

  const count = t('setup.count', { teams: state.selected.size, members: eligible.length });
  const hint = eligible.length < 9 ? `<div class="small">${esc(t('setup.minMembers'))}</div>` : '';
  const start =
    `<button class="primary" type="button" data-action="start" ${eligible.length < 9 ? 'disabled' : ''}>` +
    `${esc(t('setup.start'))}</button>`;

  return (
    `<div class="intro intro-compact"><div><div class="kicker">${esc(t('app.kicker'))}</div>` +
    `<h1>${esc(t('app.brand'))}</h1></div></div>` +
    `<div class="selection-head">${searchBox}<div class="tabs">${tabs}</div>` +
    `<div class="selection-actions">` +
    `<button class="debut-switch" type="button" role="switch" aria-checked="${state.debutDesc}" ` +
    `aria-label="${esc(t('setup.debut.aria', { order: state.debutDesc ? t('setup.debut.desc') : t('setup.debut.asc') }))}" ` +
    `data-action="toggleDebut"><span class="switch-track"><span class="switch-knob"></span></span>` +
    `<span>${esc(t('setup.debut.label'))} ${esc(state.debutDesc ? t('setup.debut.desc') : t('setup.debut.asc'))}</span></button>` +
    `<button class="text-button" type="button" data-action="selectVisible">${esc(t('setup.selectAll'))}</button>` +
    `<button class="text-button" type="button" data-action="clearVisible">${esc(t('setup.clearAll'))}</button>` +
    `</div></div>` +
    `<div class="group-grid">${cards}</div>` +
    `<div class="search-count" data-role="searchCount">${resultCount}</div>${empty}` +
    bar(`<span class="count">${esc(count)}</span>${hint}`, start)
  );
}
