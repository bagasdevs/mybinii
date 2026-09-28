// Modul murni: hanya menghasilkan string, tidak menyentuh DOM.
import { GROUPS } from '../data/roster.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Grup yang tampil di grid: `hidden` disembunyikan, `disabled` tampil tapi mati. */
export const visibleGroups = () => GROUPS.filter((g) => !g.hidden);

/** Urutan slot poster. Satu sumber kebenaran: dipakai renderer HTML dan canvas. */
export const POSTER_LAYOUT = [3, 4, 5, 1, 0, 2, 6, 7, 8];

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * 19 grup ber-`name` Hangul punya `id` yang juga Hangul, jadi `id` tidak bisa
 * dipakai sebagai label Inggris. Peta ini menambalnya, plus SNSD.
 */
export const EN_GROUP_OVERRIDES = {
  SNSD: "Girls' Generation",
  걸스데이: "Girl's Day",
  에이핑크: 'Apink',
  크레용팝: 'Crayon Pop',
  마마무: 'MAMAMOO',
  레드벨벳: 'Red Velvet',
  라붐: 'LABOUM',
  러블리즈: 'Lovelyz',
  여자친구: 'GFRIEND',
  오마이걸: 'OH MY GIRL',
  우주소녀: 'WJSN',
  구구단: 'gugudan',
  모모랜드: 'MOMOLAND',
  드림캐쳐: 'Dreamcatcher',
  위키미키: 'Weki Meki',
  프로미스나인: 'fromis_9',
  아이들: '(G)I-DLE',
  네이처: 'NATURE',
  '이달의 소녀': 'LOONA',
  퍼플키스: 'PURPLE KISS',
};

// Label non-EN = name Korea; id memakai label Inggris (latin) supaya terbaca
// pengguna Indonesia. Satu-satunya pengecualian nyata, bukan pola umum.
export function groupLabel(group, locale) {
  if (!group) return '';
  if (locale === 'ko') return group.name;
  return EN_GROUP_OVERRIDES[group.id] ?? (group.id !== group.name ? group.id : group.name);
}

export function memberLabel(member, locale) {
  if (!member) return '';
  return locale === 'ko' ? member.name : member.english;
}

/** Satu baris per grup, dipakai poster (yang menggambar tiap grup di baris sendiri). */
export function groupLines(member, groupById, locale) {
  const primary = member.displayGroups?.length ? member.displayGroups : member.groups;
  const known = primary.filter((id) => groupById.has(id));
  const safe = known.length ? known : member.groups.filter((id) => groupById.has(id));
  if (!safe.length) return [member.id];
  return safe.map((id) => groupLabel(groupById.get(id), locale));
}

/** `displayGroups` bila ada dan dikenal, selain itu `groups`, selain itu id member. */
export const labelsOf = (member, groupById, locale) =>
  groupLines(member, groupById, locale).join(' / ');

export function initialsOf(member, locale) {
  const label = memberLabel(member, locale).trim();
  return label.slice(0, 2).toUpperCase() || '?';
}

export function defaultPhoto(member) {
  return {
    url: member.image,
    x: member.crop?.x ?? 50,
    y: member.crop?.y ?? 25,
    zoom: member.crop?.zoom ?? 1,
  };
}

export function photoOf(member, custom) {
  return custom[member.id] ?? defaultPhoto(member);
}

/**
 * Alt mengikuti bahasa aktif; label member memang ditampilkan di sebelah foto.
 * `eager` dipakai foto di layar pertama: `loading="lazy"` menunda LCP sampai
 * setelah render (terukur 2,2s di heat) padahal grid selalu tampil di atas.
 */
export function portrait(member, custom, locale, { eager = false } = {}) {
  const photo = photoOf(member, custom);
  const load = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  return (
    `<img src="${esc(photo.url)}" alt="${esc(memberLabel(member, locale))}" ${load} ` +
    `data-member="${esc(member.id)}" ` +
    `style="object-position:${photo.x}% ${photo.y}%;transform:scale(${photo.zoom})">`
  );
}

export function memberCard(member, { custom, groupById, locale, picked = false, eager = false }) {
  return (
    `<button class="member ${picked ? 'picked' : ''}" type="button" ` +
    `data-member="${esc(member.id)}" aria-pressed="${picked}">` +
    `<div class="portrait">${portrait(member, custom, locale, { eager })}<span class="check">${picked ? '✓' : ''}</span></div>` +
    `<div class="member-name">${esc(memberLabel(member, locale))}</div>` +
    `<div class="member-group">${esc(labelsOf(member, groupById, locale))}</div>` +
    `</button>`
  );
}

export function bar(left, right) {
  return `<div class="bottom-bar"><div class="bar-inner"><div>${left}</div><div>${right}</div></div></div>`;
}

const STEP_KEYS = [
  'step.groups',
  'step.heat',
  'step.challenge',
  'step.final',
  'step.sort',
  'step.result',
];

export function stepIndex(state) {
  if (state.phase === 'setup') return 0;
  if (state.phase === 'heat') {
    if (state.heat.stage === 'main') return 1;
    if (state.heat.stage === 'challenge') return 2;
    return 3;
  }
  if (state.phase === 'sort') return 4;
  return 5;
}

export function steps(state, t) {
  const current = stepIndex(state);
  return (
    `<ol class="steps">` +
    STEP_KEYS.map(
      (key, i) =>
        i === current
          ? `<li class="current" aria-current="step">${String(i + 1).padStart(2, '0')} ${esc(t(key))}</li>`
          : `<li>${String(i + 1).padStart(2, '0')} ${esc(t(key))}</li>`,
    ).join('') +
    `</ol>`
  );
}
