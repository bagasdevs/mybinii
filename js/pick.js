// Dialog ganti satu slot di halaman hasil (mode `#edit`).
// Hanya daftar pilih + pencarian; tidak ada crop/unggah di sini.
import { esc, labelsOf, memberLabel, portrait } from './view.js';
import { search } from './search.js';
import { setQuery } from './state.js';

/**
 * Grid seluruh member untuk mengisi slot `rank`. Member yang sudah ada di
 * platter ditandai dan dimatikan: id ganda membuat tautan hasil dianggap rusak
 * (js/share.js), jadi pilihan itu tidak ditawarkan sama sekali.
 */
export function createPickDialog({ state, t, groupById, memberById, memberIndex, onPick }) {
  // `memberIndex` adalah thunk: indeksnya dibangun ulang setiap ganti bahasa
  // (js/main.js buildContext), jadi menyalin nilainya di sini akan basi.
  const dialog = document.querySelector('#dialog');
  const body = document.querySelector('#dialogBody');
  let rank = 0;

  const card = (member) => {
    const taken = state.finalists.includes(member.id) && state.finalists[rank] !== member.id;
    return (
      `<button class="member${taken ? ' in-platter' : ''}" type="button" data-pick="${esc(member.id)}" ` +
      `${taken ? 'disabled' : ''}>` +
      `<div class="portrait">${portrait(member, state.custom, state.lang)}</div>` +
      `<div class="member-name">${esc(memberLabel(member, state.lang))}</div>` +
      `<div class="member-group">${esc(labelsOf(member, groupById, state.lang))}</div>` +
      `</button>`
    );
  };

  /** Daftar hanya diisi ulang di dalam dialog, jadi fokus kotak search utuh. */
  function renderList() {
    const matched = search(state.query, memberIndex());
    const members = [...memberById.values()].filter((m) => matched.has(m.id));
    body.querySelector('#pickList').innerHTML = members.length
      ? members.map(card).join('')
      : `<p class="empty">${esc(t('search.empty'))}</p>`;
    body.querySelector('#pickCount').textContent = t('search.count.members', {
      n: members.length,
      total: memberById.size,
    });
  }

  function open(rankIndex) {
    rank = rankIndex;
    const member = memberById.get(state.finalists[rankIndex]);
    // Slot kosong tidak punya "sekarang": barisnya dibuang daripada mencetak
    // "Sekarang: " tanpa nama.
    const hint = member
      ? `<p class="small">${esc(t('pick.hint', { name: memberLabel(member, state.lang) }))}</p>`
      : '';
    body.innerHTML =
      `<h2 id="dialogTitle">${esc(t('pick.title', { n: rankIndex + 1 }))}</h2>` +
      hint +
      `<div class="search-row">` +
      `<input type="search" data-action="pickSearch" value="${esc(state.query)}" ` +
      `placeholder="${esc(t('search.placeholder'))}" aria-label="${esc(t('search.aria'))}" ` +
      `autocomplete="off" spellcheck="false">` +
      `</div>` +
      `<p class="search-count" id="pickCount"></p>` +
      `<div class="member-grid" id="pickList"></div>`;
    renderList();
    if (!dialog.open) dialog.showModal();
  }

  body.addEventListener('input', (event) => {
    if (event.target.dataset.action !== 'pickSearch' || event.isComposing) return;
    setQuery(state, event.target.value);
    renderList();
  });

  body.addEventListener('compositionend', (event) => {
    if (event.target.dataset.action !== 'pickSearch') return;
    setQuery(state, event.target.value);
    renderList();
  });

  body.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-pick]');
    if (!button || !dialog.open) return;
    onPick(rank, button.dataset.pick);
  });

  return { open };
}
