import { GROUPS, MEMBERS } from '../data/roster.js';
import en from '../i18n/en.js';
import ko from '../i18n/ko.js';
import { renderCredits } from './credits.js';
import { createTranslator, detectLocale, genLabel } from './i18n.js';
import { effectiveTitle } from './phases/result.js';
import { createCropDialog } from './photo.js';
import { buildPoster } from './poster.js';
import { render } from './render.js';
import { buildIndex, groupText, memberText } from './search.js';
import * as act from './state.js';
import { esc, groupLabel, initialsOf } from './view.js';

const dicts = { ko, en };
const app = document.querySelector('#app');
const dialogBody = document.querySelector('#dialogBody');
const toastEl = document.querySelector('#toast');
const langSwitch = document.querySelector('#langSwitch');
const brandEl = document.querySelector('.brand');
const titleEl = document.querySelector('title');
const descEl = document.querySelector('meta[name="description"]');

const groupById = new Map(GROUPS.map((g) => [g.id, g]));
const memberById = new Map(MEMBERS.map((m) => [m.id, m]));

const safeGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const safeSet = (key, value) => { try { localStorage.setItem(key, value); } catch { /* mode privat */ } };

const state = act.createState();
state.lang = detectLocale({
  search: location.search,
  stored: safeGet('listidol.lang'),
  navigatorLangs: navigator.languages ?? [navigator.language],
});

const t = createTranslator(dicts, () => state.lang);

let ctx = buildContext();

function buildContext() {
  const genLabelFn = (gen) => genLabel(gen, t);
  // Label Inggris ikut diindeks di samping nama Korea, jadi pencarian bekerja
  // lintas aksara di bahasa mana pun ("loona" maupun "이달의 소녀").
  const enLabel = (g) => groupLabel(g, 'en');
  return {
    t,
    groupById,
    memberById,
    groupIndex: buildIndex(GROUPS, (g) => groupText(g, genLabelFn, enLabel)),
    memberIndex: buildIndex(MEMBERS, (m) => memberText(m, groupById, genLabelFn, enLabel)),
  };
}

let toastTimer;
function toast(message) {
  toastEl.textContent = message;
  toastEl.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 3000);
}

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
    toast(t('result.error'));
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function showSavedPreview(url) {
  const dialog = document.querySelector('#dialog');
  dialogBody.innerHTML =
    `<h2>${esc(t('result.saved.title'))}</h2>` +
    `<p class="small">${esc(t('result.saved.hint'))}</p>`;
  const preview = document.createElement('img');
  preview.src = url;
  preview.className = 'save-preview';
  preview.alt = t('result.saved.alt');
  dialogBody.append(preview);
  dialog.showModal();
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
}

function draw() {
  app.innerHTML = render(state, ctx);
}

const cropDialog = createCropDialog({ state, t, memberById, toast, redraw: draw });

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

app.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;

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
      if (!act.startGame(state, { onTooFew: () => toast(t('setup.tooFew')) })) return;
      break;
    case 'clearQuery':
      act.setQuery(state, '');
      break;
    case 'heatNext':
      if (
        !act.confirmHeat(state, {
          onNeedMore: (need) => toast(t('heat.needMore', { need })),
          onTooFew: () => toast(t('setup.tooFew')),
        })
      ) {
        return;
      }
      break;
    case 'restart':
      act.setPhase(state, 'setup');
      break;
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

document.querySelector('#closeDialog').addEventListener('click', () => {
  document.querySelector('#dialog').close();
});

document.querySelector('#dialog').addEventListener('close', () => {
  if (posterUrl) {
    URL.revokeObjectURL(posterUrl);
    posterUrl = null;
  }
  // <img> yang sudah didekode menahan bitmap-nya selama node-nya masih di DOM
  // (poster 1080x1600 ~ 6,6 MB), jadi isi dialog dibuang setelah ditutup.
  dialogBody.innerHTML = '';
});

document.querySelector('#credits').addEventListener('click', () => {
  const dialog = document.querySelector('#dialog');
  document.querySelector('#dialogBody').innerHTML = renderCredits(state, t);
  if (!dialog.open) dialog.showModal();
});

redrawAll();
