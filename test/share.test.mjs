import test from 'node:test';
import assert from 'node:assert/strict';
import { MEMBERS } from '../data/roster.js';
import { decodeShare, encodeShare, isEditLink } from '../js/share.js';

const memberById = new Map(MEMBERS.map((m) => [m.id, m]));
const nine = MEMBERS.slice(0, 9).map((m) => m.id);

test('encode lalu decode mengembalikan ids dan judul yang sama', () => {
  const out = decodeShare(`#${encodeShare({ finalists: nine, title: '나의 구절판' })}`, memberById);
  assert.deepEqual(out.finalists, nine);
  assert.equal(out.title, '나의 구절판');
});

test('hash tanpa # tetap terbaca', () => {
  const out = decodeShare(encodeShare({ finalists: nine, title: '' }), memberById);
  assert.deepEqual(out.finalists, nine);
});

test('urutan ids dipertahankan karena ranking berarti', () => {
  const reversed = [...nine].reverse();
  const out = decodeShare(`#${encodeShare({ finalists: reversed, title: '' })}`, memberById);
  assert.deepEqual(out.finalists, reversed);
});

test('judul kosong tidak ikut dikodekan', () => {
  const hash = encodeShare({ finalists: nine, title: '' });
  assert.ok(!hash.includes('t='), `hash masih memuat judul: ${hash}`);
  assert.equal(decodeShare(`#${hash}`, memberById).title, '');
});

test('judul dengan spasi, tanda baca, dan unicode tetap utuh', () => {
  const title = 'My 9 Picks & Best +100% 나의 구절판';
  const out = decodeShare(`#${encodeShare({ finalists: nine, title })}`, memberById);
  assert.equal(out.title, title);
});

test('menolak paket yang tidak layak dipakai', () => {
  const eight = nine.slice(0, 8);
  const duplicate = [...nine.slice(0, 8), nine[0]];
  const unknown = [...nine.slice(0, 8), 'g_bukan_member'];

  assert.equal(decodeShare('', memberById), null, 'hash kosong');
  assert.equal(decodeShare('#', memberById), null, 'hash hanya tanda pagar');
  assert.equal(decodeShare('#r=9&m=' + nine.join('.'), memberById), null, 'versi asing');
  assert.equal(decodeShare('#m=' + nine.join('.'), memberById), null, 'tanpa versi');
  assert.equal(decodeShare('#r=1&m=' + eight.join('.'), memberById), null, 'bukan 9 id');
  assert.equal(decodeShare('#r=1&m=' + duplicate.join('.'), memberById), null, 'id ganda');
  assert.equal(decodeShare('#r=1&m=' + unknown.join('.'), memberById), null, 'id tidak dikenal');
  assert.equal(decodeShare('#r=1&m=' + [...nine, nine[0]].join('.'), memberById), null, '10 id');
});

test('isEditLink hanya menyalak untuk hash yang membawa kunci edit', () => {
  assert.equal(isEditLink('#edit'), true);
  assert.equal(isEditLink('edit'), true, 'tanpa tanda pagar tetap terbaca');
  assert.equal(isEditLink('#r=1&m=a.b&edit'), true, 'bisa digabung dengan paket hasil');
  assert.equal(isEditLink('#edit=1'), true, 'nilai kunci tidak penting');
  assert.equal(isEditLink('#r=1&m=' + nine.join('.')), false, 'tautan hasil biasa bukan mode edit');
  assert.equal(isEditLink(''), false);
  assert.equal(isEditLink('#'), false);
  assert.equal(isEditLink('#edited'), false, 'kunci lain yang berawalan edit tidak ikut lolos');
});

test('setiap id member aman dipakai sebagai bagian hash', () => {
  // Pemisah paket adalah titik, jadi satu titik pun di id akan memecah paket.
  const offenders = MEMBERS.filter((m) => !/^[a-z0-9_]+$/.test(m.id)).map((m) => m.id);
  assert.deepEqual(offenders, [], 'id member memuat karakter di luar [a-z0-9_]');
});
