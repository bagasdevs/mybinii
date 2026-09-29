import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import en from '../i18n/en.js';
import id from '../i18n/id.js';
import ko from '../i18n/ko.js';
import { LOCALES } from '../js/i18n.js';

// Kunci memuat huruf besar (setup.selectAll, crop.errSize, ...), jadi kelas
// karakternya tidak boleh [a-z] saja.
const NS = '(app|step|gen|common|setup|heat|sort|result|crop|dialog|search|lang|nav|groups)';
const KEY_LITERAL = new RegExp(`'(?:${NS}\\.[A-Za-z0-9.]+)'`, 'g');

// Kunci yang dibentuk runtime, bukan literal — lihat genLabel di js/i18n.js.
const DYNAMIC_KEYS = ['gen.2', 'gen.3', 'gen.4', 'gen.5'];

function walk(dir) {
  return readdirSync(new URL(`../${dir}/`, import.meta.url), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`],
  );
}

const sources = walk('js').filter((file) => file.endsWith('.js'));

function usedKeys() {
  const used = new Set();
  for (const file of sources) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const match of text.matchAll(KEY_LITERAL)) used.add(match[0].slice(1, -1));
  }
  return used;
}

test('ada berkas sumber untuk dipindai', () => {
  assert.ok(sources.length >= 10, `hanya ${sources.length} berkas`);
});

test('pemindaian menemukan key dalam jumlah wajar', () => {
  // Penjaga anti-tautologi: regex yang salah kelas karakter akan menemukan
  // jauh lebih sedikit key, atau nol.
  assert.ok(usedKeys().size >= 60, `hanya ${usedKeys().size} key terpindai`);
});

test('setiap key yang dipakai kode ada di semua kamus', () => {
  for (const [locale, dict] of Object.entries({ ko, en, id })) {
    const missing = [...usedKeys()].filter((key) => !(key in dict)).sort();
    assert.deepEqual(missing, [], `key hilang dari i18n/${locale}.js: ${missing}`);
  }
});

test('key yang dibentuk runtime ada di semua kamus', () => {
  for (const key of DYNAMIC_KEYS) {
    for (const [locale, dict] of Object.entries({ ko, en, id })) {
      assert.ok(key in dict, `key hilang dari i18n/${locale}.js: ${key}`);
    }
  }
});

test('ko, en, dan id punya himpunan key yang identik', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(ko).sort());
  assert.deepEqual(Object.keys(id).sort(), Object.keys(ko).sort());
});

test('tidak ada nilai kamus yang kosong', () => {
  for (const [locale, dict] of Object.entries({ ko, en, id })) {
    const empty = Object.entries(dict).filter(([, v]) => String(v).trim() === '').map(([k]) => k);
    assert.deepEqual(empty, [], `${locale} punya nilai kosong: ${empty}`);
  }
});

test('placeholder di semua kamus untuk key yang sama sama-sama cocok', () => {
  const names = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(ko)) {
    assert.deepEqual(names(en[key]), names(ko[key]), `placeholder beda pada ${key} (en)`);
    assert.deepEqual(names(id[key]), names(ko[key]), `placeholder beda pada ${key} (id)`);
  }
});

test('setiap locale punya tombol di pemilih bahasa', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const langs = [...html.matchAll(/data-lang="([^"]+)"/g)].map((m) => m[1]);
  // Penjaga anti-tautologi: kalau markup berubah bentuk, daftar kosong tidak lolos.
  assert.ok(langs.length >= 3, `hanya ${langs.length} tombol terpindai`);
  assert.deepEqual(langs.sort(), [...LOCALES].sort());
});

test('tab navbar game dan groups ada di helper view.js', () => {
  const src = readFileSync(new URL('../js/view.js', import.meta.url), 'utf8');
  const views = [...src.matchAll(/data-view="(game|groups)"/g)].map((m) => m[1]);
  assert.deepEqual(views.sort(), ['game', 'groups']);
});
