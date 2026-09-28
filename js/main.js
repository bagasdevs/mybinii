import { GROUPS, MEMBERS } from '../data/roster.js';
import en from '../i18n/en.js';
import ko from '../i18n/ko.js';
import { createTranslator, detectLocale, genLabel } from './i18n.js';
import { render } from './render.js';
import { buildIndex, groupText, memberText } from './search.js';
import * as act from './state.js';
import { groupLabel, initialsOf } from './view.js';

const dicts = { ko, en };
const app = document.querySelector('#app');
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

app.addEventListener('click', (event) => {
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
  if (button.dataset.member !== undefined && state.phase === 'heat') {
    const outcome = act.pickMember(state, button.dataset.member);
    if (outcome === 'full') {
      toast(t('heat.maxPick', { need: Math.min(3, state.heat.current.length) }));
    }
    draw();
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

redrawAll();
