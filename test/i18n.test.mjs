import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LOCALE,
  detectLocale,
  interpolate,
  createTranslator,
  genLabel,
} from '../js/i18n.js';

test('detectLocale: ?lang menang atas sumber lain', () => {
  assert.equal(
    detectLocale({ search: '?lang=en', stored: 'ko', navigatorLangs: ['ko-KR'] }),
    'en',
  );
});

test('detectLocale: ?lang tak dikenal dilewati, lanjut ke stored', () => {
  assert.equal(
    detectLocale({ search: '?lang=fr', stored: 'en', navigatorLangs: ['ko-KR'] }),
    'en',
  );
});

test('detectLocale: tag regional dicocokkan lewat prefix', () => {
  assert.equal(detectLocale({ navigatorLangs: ['en-US', 'ko-KR'] }), 'en');
  assert.equal(detectLocale({ navigatorLangs: ['ko-KR'] }), 'ko');
});

test('detectLocale: tanpa petunjuk apa pun kembali ke default', () => {
  assert.equal(detectLocale({}), DEFAULT_LOCALE);
  assert.equal(detectLocale(), DEFAULT_LOCALE);
  assert.equal(detectLocale({ search: '?lang=', stored: '', navigatorLangs: [] }), 'ko');
});

test('detectLocale: search tanpa tanda tanya pun tetap terbaca', () => {
  assert.equal(detectLocale({ search: 'lang=en' }), 'en');
});

test('interpolate mengganti placeholder dan membiarkan yang asing', () => {
  assert.equal(interpolate('{n}명 / {total}명', { n: 3, total: 9 }), '3명 / 9명');
  assert.equal(interpolate('{n}명', {}), '{n}명');
  assert.equal(interpolate('tanpa placeholder', { n: 1 }), 'tanpa placeholder');
});

test('createTranslator mengembalikan key dan memanggil onMissing sekali saja', () => {
  const missing = [];
  const t = createTranslator({ ko: { a: 'A' } }, () => 'ko', (k) => missing.push(k));
  assert.equal(t('a'), 'A');
  assert.equal(t('tidak.ada'), 'tidak.ada');
  assert.equal(t('tidak.ada'), 'tidak.ada');
  assert.deepEqual(missing, ['tidak.ada']);
});

test('createTranslator jatuh ke default bila locale tidak punya kamus', () => {
  const t = createTranslator({ ko: { a: 'A' }, en: {} }, () => 'en', () => {});
  assert.equal(t('a'), 'a', 'key hilang dikembalikan apa adanya, tidak menebak dari ko');
});

test('genLabel memakai label khusus untuk 2 dan fallback untuk gen tak dikenal', () => {
  const t = createTranslator(
    { ko: { 'gen.2': '2·2.5세대', 'gen.3': '3세대', 'gen.other': '{n}세대' } },
    () => 'ko',
    () => {},
  );
  assert.equal(genLabel(2, t), '2·2.5세대');
  assert.equal(genLabel(3, t), '3세대');
  assert.equal(genLabel(6, t), '6세대');
  assert.equal(genLabel(undefined, t), '0세대');
});
