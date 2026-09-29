import { GROUPS, MEMBERS } from '../data/roster.js';
import en from '../i18n/en.js';
import id from '../i18n/id.js';
import ko from '../i18n/ko.js';
import { renderCredits } from './credits.js';
import { createTranslator, detectLocale, genLabel } from './i18n.js';
import { effectiveTitle } from './phases/result.js';
import { createCropDialog } from './photo.js';
import { buildPoster } from './poster.js';
import { render } from './render.js';
import { buildIndex, groupText, memberText } from './search.js';
import { decodeShare, encodeShare } from './share.js';
import * as act from './state.js';
import { esc, groupSearchText, initialsOf } from './view.js';

const dicts = { ko, en, id };
const app = document.querySelector('#app');
const dialogBody = document.querySelector('#dialogBody');
const toastEl = document.querySelector('#toast');
const langSwitch = document.querySelector('#langSwitch');
const viewTabs = document.querySelector('#viewTabs');
const brandEl = document.querySelector('.brand');
const titleEl = document.querySelector('title');
const descEl = document.querySelector('meta[name="description"]');

const groupById = new Map(GROUPS.map((g) => [g.id, g]));
const memberById = new Map(MEMBERS.map((m) => [m.id, m]));

const safeGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch { /* mode privat */ } };
const PROGRESS_KEY = 'listidol.progress';
// localStorage bisa berisi apa saja (privat mode, kuota penuh, disunting
// manual), jadi baca dan tulis selalu dibungkus.
const readProgress = () => {
  try {
    return JSON.parse(safeGet(PROGRESS_KEY) ?? 'null');
  } catch {
    return null;
  }
};

const state = act.createState();
state.lang = detectLocale({
  search: location.search,
  stored: safeGet('listidol.lang'),
  navigatorLangs: navigator.languages ?? [navigator.language],
});

// Tautan hasil bersama menang atas progres tersimpan: yang mengklik tautan
// ingin melihat hasil orang lain, bukan melanjutkan permainannya sendiri.
const shared = decodeShare(location.hash, memberById);
const resumed = shared ? false : act.restore(state, readProgress());
if (shared) act.loadShared(state, shared);

const t = createTranslator(dicts, () => state.lang);

let ctx = buildContext();

function buildContext() {
  const genLabelFn = (gen) => genLabel(gen, t);
  // Kedua label grup diindeks, jadi pencarian bekerja lintas aksara di bahasa
  // mana pun ("loona" maupun "이달의 소녀", "twice" maupun "트와이스").
  return {
    t,
    groupById,
    memberById,
    groupIndex: buildIndex(GROUPS, (g) => groupText(g, genLabelFn, groupSearchText)),
    memberIndex: buildIndex(MEMBERS, (m) => memberText(m, groupById, genLabelFn, groupSearchText)),
  };
}

let toastTimer;
// `duration`: info 3000ms, error 6000ms. Visibilitas pakai class (bukan
// display:none) supaya live region tetap dikenali screen reader.
function toast(message, duration = 3000) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}
const toastError = (message) => toast(message, 6000);

// Blob URL poster aktif; di-revoke saat dialog ditutup supaya tidak bocor.
let posterUrl = null;

async function downloadPoster() {
  const button = app.querySelector('[data-action="download"]');
  if (!button) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = t('result.downloading');

  try {
    const blob = await buildPoster({
      finalists: state.finalists,
      memberById,
      custom: state.custom,
      title: effectiveTitle(state, t),
      labels: {
        eyebrow: t('app.eyebrow'),
        foot: t('result.foot'),
        locale: state.lang,
        groupById,
        rank: (n) => t('result.rank', { n }),
      },
    });

    if (posterUrl) URL.revokeObjectURL(posterUrl);
    posterUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = posterUrl;
    link.download = t('result.filename');
    link.click();

    showSavedPreview(posterUrl);
  } catch {
    toastError(t('result.error'));
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function showSavedPreview(url) {
  const dialog = document.querySelector('#dialog');
  dialogBody.innerHTML =
    `<h2 id="dialogTitle">${esc(t('result.saved.title'))}</h2>` +
    `<p class="small">${esc(t('result.saved.hint'))}</p>`;
  const preview = document.createElement('img');
  preview.src = url;
  preview.className = 'save-preview';
  preview.alt = t('result.saved.alt');
  dialogBody.append(preview);
  dialog.showModal();
}

async function shareResult() {
  const title = effectiveTitle(state, t);
  const url = `${location.origin}${location.pathname}#${encodeShare({ finalists: state.finalists, title })}`;
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast(t('result.share.copied'));
  } catch (error) {
    // Menutup lembar berbagi bawaan sistem bukan kegagalan.
    if (error?.name === 'AbortError') return;
    toastError(t('result.share.error'));
  }
}

function applyDocumentChrome() {
  document.documentElement.lang = state.lang;
  titleEl.textContent = t('app.title');
  descEl.setAttribute('content', t('app.title'));
  brandEl.textContent = t('app.brand');
  document.querySelector('#credits').textContent = t('credits.button');
  document.querySelector('#closeDialog').textContent = t('dialog.close');
  langSwitch.setAttribute('aria-label', t('lang.aria'));
  for (const button of langSwitch.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.lang === state.lang));
  }
  viewTabs.setAttribute('aria-label', t('nav.aria'));
  for (const button of viewTabs.querySelectorAll('button')) {
    const on = button.dataset.view === state.view;
    button.textContent = button.dataset.view === 'groups' ? t('nav.groups') : t('nav.game');
    button.classList.toggle('on', on);
    button.setAttribute('aria-current', String(on));
  }
}

// `app.innerHTML` membuang elemen yang sedang fokus, jadi pengguna keyboard
// dilempar ke awal dokumen setiap kali memilih. Identitas elemen disimpan
// sebelum render dan dipulihkan sesudahnya.
const FOCUS_ATTRS = ['data-action', 'data-member', 'data-sort', 'data-group', 'data-gen', 'data-photo', 'data-view'];
const focusSelector = (el) => {
  if (!el || !app.contains(el)) return null;
  const attr = FOCUS_ATTRS.find((name) => el.hasAttribute(name));
  return attr ? `[${attr}="${CSS.escape(el.getAttribute(attr))}"]` : null;
};

/**
 * Sasaran pengganti saat elemen lama hilang: papan berikutnya sudah tampil.
 * Sengaja `button[data-member]` — `data-member` juga ada di `<img>` di dalam
 * kartu, dan `<img>` tidak bisa menerima fokus.
 */
const firstCard = () =>
  [...app.querySelectorAll('button[data-member], [data-sort], button[data-group], button[data-view]')].find(
    (el) => !el.disabled,
  );

/**
 * Pulihkan fokus: elemen yang sama bila masih ada (memilih di papan yang sama),
 * kalau tidak kartu pertama papan baru (heatNext, pilih di sort, ulangi).
 * `disabled` penting: tombol `heatNext` ada di papan baru tapi mati sampai tiga
 * nama dipilih, dan elemen mati tidak bisa menerima fokus — tanpa cek ini fokus
 * tetap jatuh ke `body`.
 * `preventScroll` supaya tidak berkelahi dengan `scrollTo(0, 0)` pemanggilnya.
 */
function restoreFocus(previous) {
  if (!previous) return;
  const target = app.querySelector(previous);
  const usable = target && !target.disabled ? target : firstCard();
  usable?.focus({ preventScroll: true });
}

// Simpan progres setiap render. Di-debounce karena mengetik di kotak search
// merender ulang untuk setiap tombol.
let saveTimer;
function draw() {
  const previous = focusSelector(document.activeElement);
  app.innerHTML = render(state, ctx);
  // Footer sengaja disembunyikan sampai render pertama selesai: kalau tidak,
  // ia ikut tergeser saat #app terisi dan menyumbang CLS 0.17.
  document.documentElement.classList.remove('booting');
  restoreFocus(previous);
  clearTimeout(saveTimer);
  // Tampilan hasil bersama tidak ditulis ke localStorage: membuka tautan orang
  // lain tidak boleh menghapus permainan yang sedang berjalan di perangkat ini.
  if (!state.shared) {
    saveTimer = setTimeout(() => safeSet(PROGRESS_KEY, JSON.stringify(act.snapshot(state))), 300);
  }
}

const cropDialog = createCropDialog({ state, t, memberById, toast, toastError, redraw: draw });

function redrawAll() {
  ctx = buildContext();
  applyDocumentChrome();
  draw();
}

langSwitch.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-lang]');
  if (!button) return;
  act.setLang(state, button.dataset.lang);
  safeSet('listidol.lang', state.lang);
  redrawAll();
});

viewTabs.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-view]');
  if (!button) return;
  act.setView(state, button.dataset.view);
  applyDocumentChrome();
  draw();
  scrollTo(0, 0);
});

app.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;

  if (button.dataset.view !== undefined) {
    act.setView(state, button.dataset.view);
    applyDocumentChrome();
    draw();
    scrollTo(0, 0);
    return;
  }

  if (button.dataset.gen !== undefined) {
    act.toggleGeneration(state, Number(button.dataset.gen));
    draw();
    return;
  }
  if (button.dataset.group !== undefined) {
    act.toggleGroup(state, button.dataset.group);
    draw();
    return;
  }
  if (button.dataset.sort !== undefined) {
    act.pickSort(state, button.dataset.sort);
    draw();
    scrollTo(0, 0);
    return;
  }
  if (button.dataset.member !== undefined && state.phase === 'heat') {
    const outcome = act.pickMember(state, button.dataset.member);
    if (outcome === 'full') {
      toast(t('heat.maxPick', { need: Math.min(3, state.heat.current.length) }));
    }
    draw();
    return;
  }

  if (button.dataset.photo !== undefined) {
    cropDialog.open(button.dataset.photo);
    return;
  }

  switch (button.dataset.action) {
    case 'toggleDebut':
      act.toggleDebut(state);
      break;
    case 'selectVisible':
      act.selectAllVisible(state);
      break;
    case 'clearVisible':
      act.clearAllVisible(state);
      break;
    case 'start':
      if (!act.startGame(state, { onTooFew: () => toastError(t('setup.tooFew')) })) return;
      break;
    case 'clearQuery':
      act.setQuery(state, '');
      break;
    case 'heatNext':
      if (
        !act.confirmHeat(state, {
          onNeedMore: (need) => toast(t('heat.needMore', { need })),
          onTooFew: () => toastError(t('setup.tooFew')),
        })
      ) {
        return;
      }
      break;
    case 'undoSort':
      act.undoSort(state);
      break;
    case 'restart':
      act.leaveShared(state);
      act.setPhase(state, 'setup');
      break;
    case 'share':
      await shareResult();
      return;
    case 'download':
      await downloadPoster();
      return;
    default:
      return;
  }
  draw();
  scrollTo(0, 0);
});

// `error` tidak bubble; pakai fase capture lalu ganti dengan avatar inisial.
app.addEventListener(
  'error',
  (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const member = memberById.get(img.dataset.member);
    if (!member) return;
    const fallback = document.createElement('span');
    fallback.className = 'portrait-fallback';
    fallback.textContent = initialsOf(member, state.lang);
    fallback.setAttribute('aria-hidden', 'true');
    img.replaceWith(fallback);
  },
  true,
);

// Kotak search diganti seluruhnya setiap kali query berubah, jadi fokus dan
// posisi kursor harus dipulihkan sendiri.
function redrawSearch(previous) {
  const caret = previous.selectionStart;
  draw();
  const next = app.querySelector('input[data-action="search"]');
  if (!next) return;
  next.focus();
  if (caret !== null) next.setSelectionRange(caret, caret);
}

app.addEventListener('input', (event) => {
  if (event.target.id === 'posterTitle') {
    act.setTitle(state, event.target.value);
    const live = app.querySelector('#liveTitle');
    if (live) live.textContent = effectiveTitle(state, t);
    return;
  }
  if (event.target.dataset.action !== 'search') return;
  act.setQuery(state, event.target.value);
  // Saat IME Hangul masih menyusun suku kata, mengganti node input akan
  // membatalkan komposisinya. Tunggu compositionend.
  if (event.isComposing) return;
  redrawSearch(event.target);
});

app.addEventListener('compositionend', (event) => {
  if (event.target.dataset.action !== 'search') return;
  act.setQuery(state, event.target.value);
  redrawSearch(event.target);
});

const dialog = document.querySelector('#dialog');
document.querySelector('#closeDialog').addEventListener('click', () => dialog.close());
// Klik backdrop (abu-abu di luar kotak) menutup dialog — tanpa ini pengguna
// harus scroll 79 baris kredit dulu baru ketemu tombol Tutup.
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

dialog.addEventListener('close', () => {
  if (posterUrl) {
    URL.revokeObjectURL(posterUrl);
    posterUrl = null;
  }
  // <img> yang sudah didekode menahan bitmap-nya selama node-nya masih di DOM
  // (poster 1080x1600 ~ 6,6 MB), jadi isi dialog dibuang setelah ditutup.
  dialogBody.innerHTML = '';
});

document.querySelector('#credits').addEventListener('click', () => {
  dialogBody.innerHTML = renderCredits(state, t);
  if (!dialog.open) dialog.showModal();
});

redrawAll();
if (shared) toast(t('app.shared'));
else if (resumed && state.phase !== 'setup') toast(t('app.resume'));
