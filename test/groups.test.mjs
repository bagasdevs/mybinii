import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, MEMBERS } from '../data/roster.js';
import { renderGroups } from '../js/groups.js';
import { render } from '../js/render.js';
import { createState, setQuery, setView } from '../js/state.js';

const t = (key, vars) => (vars ? `${key}(${JSON.stringify(vars)})` : `[${key}]`);
const ctx = { t, groupById: new Map(), memberById: new Map() };
const visibleGroups = () => GROUPS.filter((g) => !g.hidden);
const sectionsOf = (html) => html.match(/<section class="group-section"/g) ?? [];

test('renderGroups menampilkan semua grup non-hidden + judul direktori', () => {
  const html = renderGroups(createState(), ctx);
  assert.ok(html.includes('[groups.title]'), 'judul direktori hilang');
  assert.equal(sectionsOf(html).length, visibleGroups().length);
});

test('renderGroups memakai thumbnail dan lazy untuk semua foto', () => {
  const html = renderGroups(createState(), ctx);
  const expected = visibleGroups().reduce(
    (n, g) => n + MEMBERS.filter((m) => m.groups.includes(g.id)).length,
    0,
  );
  assert.ok(expected > 0, 'fixture kosong: tidak ada member di grup tampil');
  assert.equal((html.match(/photos\/thumb\//g) ?? []).length, expected);
  assert.ok(!html.includes('loading="eager"'), 'direktori tidak boleh eager');
});

test('renderGroups disaring oleh search dan menampilkan empty state', () => {
  const state = createState();
  setQuery(state, 'twice');
  const filtered = renderGroups(state, ctx);
  assert.ok(sectionsOf(filtered).length >= 1, 'TWICE harus ketemu');
  assert.ok(
    sectionsOf(filtered).length < visibleGroups().length,
    'filter harus menyempitkan daftar',
  );
  setQuery(state, 'zzz-tidak-ada-grup-ini');
  const empty = renderGroups(state, ctx);
  assert.equal(sectionsOf(empty).length, 0);
  assert.ok(empty.includes('[groups.empty]'));
});

test('renderGroups punya tombol kembali ke game', () => {
  const html = renderGroups(createState(), ctx);
  assert.ok(html.includes('data-view="game"'), 'tombol kembali hilang');
});

test('render memakai direktori saat view groups', () => {
  const state = createState();
  setView(state, 'groups');
  assert.ok(render(state, ctx).includes('[groups.title]'));
});
