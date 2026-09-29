import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, MEMBERS } from '../data/roster.js';
import { renderResult } from '../js/phases/result.js';
import { createState, loadShared, setFinalist } from '../js/state.js';

const t = (key, vars) => (vars ? `${key}(${JSON.stringify(vars)})` : `[${key}]`);
const ctx = {
  t,
  groupById: new Map(GROUPS.map((g) => [g.id, g])),
  memberById: new Map(MEMBERS.map((m) => [m.id, m])),
};
const nine = MEMBERS.slice(0, 9).map((m) => m.id);
const changeButtons = (html) => html.match(/data-rank="(\d+)"/g) ?? [];

test('renderResult dari tautan hasil tidak menawarkan tombol ganti', () => {
  const state = createState();
  loadShared(state, { finalists: nine, title: 'x' });
  const html = renderResult(state, ctx);
  assert.equal(changeButtons(html).length, 0);
  assert.equal((html.match(/class="poster-card/g) ?? []).length, 9);
  assert.ok(!html.includes('empty-slot'));
});

test('renderResult di mode edit menyediakan sembilan tombol ganti', () => {
  const state = createState();
  loadShared(state, { finalists: nine, title: '', editing: true });
  const html = renderResult(state, ctx);
  assert.equal(changeButtons(html).length, 9);
  assert.equal((html.match(/data-photo="/g) ?? []).length, 9, 'tombol edit foto tetap ada');
});

// Tanpa kartu kosong, halaman `#edit` tidak punya satu pun tombol untuk diklik.
test('renderResult di mode edit menggambar slot kosong sebagai kartu', () => {
  const state = createState();
  loadShared(state, { finalists: [], title: '', editing: true });
  const html = renderResult(state, ctx);
  assert.equal((html.match(/class="poster-card empty-slot"/g) ?? []).length, 9);
  assert.equal(changeButtons(html).length, 9);
  assert.ok(!html.includes('data-photo='), 'slot kosong tidak punya foto untuk diedit');
});

test('renderResult menggambar slot kosong hanya di mode edit', () => {
  const state = createState();
  loadShared(state, { finalists: nine, title: '' });
  setFinalist(state, 0, MEMBERS[10].id);
  const html = renderResult(state, ctx);
  assert.equal((html.match(/class="poster-card/g) ?? []).length, 9);
  assert.ok(!html.includes('empty-slot'));
});
