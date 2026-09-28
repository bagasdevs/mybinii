import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import en from '../i18n/en.js';
import ko from '../i18n/ko.js';

// Kunci memuat huruf besar (setup.selectAll, crop.errSize, ...), jadi kelas
// karakternya tidak boleh [a-z] saja.
const NS = '(app|step|gen|common|setup|heat|sort|result|crop|credits|dialog|search|lang)';
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

test('setiap key yang dipakai kode ada di kamus ko', () => {
  const missing = [...usedKeys()].filter((key) => !(key in ko)).sort();
  assert.deepEqual(missing, [], `key hilang dari i18n/ko.js: ${missing}`);
});

test('setiap key yang dipakai kode ada di kamus en', () => {
  const missing = [...usedKeys()].filter((key) => !(key in en)).sort();
  assert.deepEqual(missing, [], `key hilang dari i18n/en.js: ${missing}`);
});

test('key yang dibentuk runtime ada di kedua kamus', () => {
  for (const key of DYNAMIC_KEYS) {
    assert.ok(key in ko, `key hilang dari i18n/ko.js: ${key}`);
    assert.ok(key in en, `key hilang dari i18n/en.js: ${key}`);
  }
});

test('ko dan en punya himpunan key yang identik', () => {
  assert.deepEqual(Object.keys(ko).sort(), Object.keys(en).sort());
});

test('tidak ada nilai kamus yang kosong', () => {
  for (const [locale, dict] of Object.entries({ ko, en })) {
    const empty = Object.entries(dict).filter(([, v]) => String(v).trim() === '').map(([k]) => k);
    assert.deepEqual(empty, [], `${locale} punya nilai kosong: ${empty}`);
  }
});

test('placeholder di ko dan en untuk key yang sama sama-sama cocok', () => {
  const names = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of Object.keys(ko)) {
    assert.deepEqual(names(ko[key]), names(en[key]), `placeholder beda pada ${key}`);
  }
});
