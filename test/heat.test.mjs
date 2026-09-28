import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, MEMBERS } from '../data/roster.js';
import en from '../i18n/en.js';
import ko from '../i18n/ko.js';
import { beginHeat, createHeat } from '../js/game.js';
import { createTranslator, genLabel } from '../js/i18n.js';
import { renderHeat } from '../js/phases/heat.js';
import { buildIndex, groupText, memberText } from '../js/search.js';

const t = createTranslator({ ko, en }, () => 'ko', () => {});
const genLabelFn = (gen) => genLabel(gen, t);

const groupById = new Map(GROUPS.map((g) => [g.id, g]));
const memberById = new Map(MEMBERS.map((m) => [m.id, m]));
const enLabel = (g) => g.id;
const memberIndex = buildIndex(MEMBERS, (m) => memberText(m, groupById, genLabelFn, enLabel));

const ctx = {
  t,
  groupById,
  memberById,
  groupIndex: buildIndex(GROUPS, (g) => groupText(g, genLabelFn, enLabel)),
  memberIndex,
};

const idsOf = (groupId) => MEMBERS.filter((m) => m.groups.includes(groupId)).map((m) => m.id);

/** Layar pertama heat dengan pool yang diberikan, plus pilihan yang sudah ada. */
function screen(pool, selected = []) {
  const heat = createHeat();
  heat.pool = pool;
  beginHeat(heat);
  for (const id of selected) heat.selected.add(id);
  return { phase: 'heat', lang: 'ko', query: '', custom: {}, selected: new Set(), heat };
}

// portrait() juga menaruh data-member pada <img>, jadi hasilnya di-dedupe.
const cards = (html) => [...new Set([...html.matchAll(/data-member="([^"]+)"/g)].map((m) => m[1]))];
const searchCount = (html) => html.match(/data-role="searchCount"[^>]*>([^<]*)</)?.[1];

test('tanpa query: seluruh layar tampil dan kotak search tetap dirender', () => {
  const pool = [...idsOf('TWICE'), ...idsOf('ITZY')];
  const html = renderHeat(screen(pool), ctx);
  assert.equal(pool.length, 14);
  assert.equal(cards(html).length, 9, 'layar pertama berisi 9 kandidat');
  assert.equal(searchCount(html), '9명 / 9명 · 이 화면만 검색');
  assert.ok(html.includes('data-action="search"'));
  assert.ok(!html.includes('data-action="clearQuery"'), 'tombol hapus hanya muncul saat mencari');
  assert.ok(!html.includes('data-role="searchEmpty"'));
});

test('query nama Korea menyaring layar ke member yang cocok', () => {
  const pool = [...idsOf('TWICE'), ...idsOf('ITZY')];
  const st = screen(pool);
  st.query = memberById.get(pool[3]).name;
  const html = renderHeat(st, ctx);
  assert.deepEqual(cards(html), [pool[3]]);
  assert.equal(searchCount(html), '1명 / 9명 · 이 화면만 검색');
  assert.ok(html.includes('data-action="clearQuery"'));
});

test('query romanisasi menemukan member yang sama', () => {
  const pool = [...idsOf('TWICE'), ...idsOf('ITZY')];
  const byName = screen(pool);
  byName.query = memberById.get(pool[3]).name;
  const byRoman = screen(pool);
  byRoman.query = memberById.get(pool[3]).english;
  assert.deepEqual(cards(renderHeat(byRoman, ctx)), cards(renderHeat(byName, ctx)));
});

test('query tanpa hasil: grid kosong dan empty state muncul', () => {
  const pool = [...idsOf('TWICE'), ...idsOf('ITZY')];
  const st = screen(pool);
  st.query = 'zzzz';
  const html = renderHeat(st, ctx);
  assert.deepEqual(cards(html), []);
  assert.equal(searchCount(html), '0명 / 9명 · 이 화면만 검색');
  assert.ok(html.includes('data-role="searchEmpty"'));
});

test('query hanya menyaring layar ini, bukan seluruh pool', () => {
  const pool = [...idsOf('TWICE'), ...idsOf('ITZY')];
  const st = screen(pool);
  const offScreen = pool[10];
  assert.ok(!st.heat.current.includes(offScreen), 'member ini memang di layar berikutnya');
  st.query = memberById.get(offScreen).english;
  const html = renderHeat(st, ctx);
  assert.deepEqual(cards(html), []);
  assert.ok(html.includes('data-role="searchEmpty"'));
});

test('invariant: menyaring tidak mengubah pilihan yang sudah dibuat', () => {
  const pool = [...idsOf('TWICE'), ...idsOf('ITZY')];
  const picked = [pool[1], pool[2]];
  const st = screen(pool, picked);
  const before = [...st.heat.selected].sort();

  for (const query of ['사나', 'zzzz', '', memberById.get(pool[5]).english]) {
    st.query = query;
    renderHeat(st, ctx);
  }

  assert.deepEqual([...st.heat.selected].sort(), before);
  assert.deepEqual([...st.heat.selected].sort(), [...picked].sort());
  assert.equal(st.heat.current.length, 9, 'layar tidak ikut berubah');
});

test('penghitung pilihan memakai jumlah layar, bukan jumlah hasil filter', () => {
  const pool = [...idsOf('TWICE'), ...idsOf('ITZY')];
  const st = screen(pool, [pool[1], pool[2]]);
  st.query = memberById.get(pool[1]).english;
  const html = renderHeat(st, ctx);
  assert.equal(cards(html).length, 1);
  assert.ok(html.includes('2 / 3명'), 'sisa pilihan dihitung dari layar penuh');
  // heat.pick memuat <em>, jadi yang diperiksa hanya angkanya: 9 = layar penuh,
  // bukan 1 = jumlah hasil filter.
  assert.ok(html.includes('9명 중'), 'syarat pilih memakai jumlah layar penuh');
});
