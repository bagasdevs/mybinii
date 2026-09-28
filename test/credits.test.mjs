import test from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS } from '../data/roster.js';
import { renderCredits } from '../js/credits.js';
import ko from '../i18n/ko.js';
import en from '../i18n/en.js';
import id from '../i18n/id.js';
import { createTranslator } from '../js/i18n.js';

const tFor = (locale) => createTranslator({ ko, en, id }, () => locale, () => {});

const visibleGroups = GROUPS.filter((g) => !g.hidden);

test('renderCredits menampilkan satu baris per grup non-hidden', () => {
  const html = renderCredits({ lang: 'ko' }, tFor('ko'));
  assert.equal((html.match(/class="source-row"/g) ?? []).length, visibleGroups.length);
});

test('renderCredits tidak pernah menampilkan grup hidden', () => {
  const html = renderCredits({ lang: 'ko' }, tFor('ko'));
  for (const group of GROUPS.filter((g) => g.hidden)) {
    assert.ok(!html.includes(`>${group.name}<`), `${group.id} ikut tampil`);
  }
});

test('renderCredits memuat tautan ke data/photo-sources.json', () => {
  const html = renderCredits({ lang: 'ko' }, tFor('ko'));
  assert.ok(html.includes('href="data/photo-sources.json"'));
});

test('renderCredits menerjemahkan tanggal sesuai bahasa', () => {
  const koHtml = renderCredits({ lang: 'ko' }, tFor('ko'));
  const enHtml = renderCredits({ lang: 'en' }, tFor('en'));
  assert.ok(koHtml.includes('2026년'), 'tanggal Korea memakai format 년');
  assert.ok(enHtml.includes('2026'), 'tanggal Inggris memuat tahun');
  assert.ok(!enHtml.includes('년'), 'tanggal Inggris tidak memakai format Korea');
});

test('renderCredits memakai label grup sesuai bahasa', () => {
  const enHtml = renderCredits({ lang: 'en' }, tFor('en'));
  assert.ok(enHtml.includes('LOONA'));
  const koHtml = renderCredits({ lang: 'ko' }, tFor('ko'));
  assert.ok(koHtml.includes('이달의 소녀'));
  const idHtml = renderCredits({ lang: 'id' }, tFor('id'));
  assert.ok(idHtml.includes('LOONA'), 'id memakai label latin');
  assert.ok(idHtml.includes('Dasar roster'), 'id memakai kamus Indonesia');
});
