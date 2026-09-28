// Modul murni: hanya string, tidak menyentuh DOM/location/navigator.
//
// Format hash: `#r=1&m=<id>.<id>...&t=<judul>`
// - `r` versi skema. Hash lama yang tidak dikenal ditolak, bukan ditebak.
// - `m` sembilan id member dipisah titik. Id member hanya berisi [a-z0-9_]
//   (dijaga test/roster.test.mjs), jadi titik aman sebagai pemisah dan URL
//   tetap enak dibaca tanpa base64.
// - `t` judul opsional.

export const SHARE_VERSION = '1';
const COUNT = 9;
const SEP = '.';

export function encodeShare({ finalists, title = '' }) {
  const params = new URLSearchParams();
  params.set('r', SHARE_VERSION);
  params.set('m', finalists.join(SEP));
  if (title) params.set('t', title);
  return params.toString();
}

/**
 * `hash` (dengan atau tanpa `#`) → `{ finalists, title }`, atau `null` bila
 * paketnya tidak layak dipakai. `memberById` disuntikkan supaya modul tetap
 * murni dan bisa diuji tanpa DOM.
 */
export function decodeShare(hash, memberById) {
  const raw = String(hash ?? '').replace(/^#/, '');
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  if (params.get('r') !== SHARE_VERSION) return null;

  const finalists = (params.get('m') ?? '').split(SEP).filter(Boolean);
  if (finalists.length !== COUNT) return null;
  // Ranking berarti, jadi id ganda menandakan paket rusak, bukan sekadar
  // kurang menarik: poster akan menampilkan member yang sama dua kali.
  if (new Set(finalists).size !== COUNT) return null;
  if (!finalists.every((id) => memberById.has(id))) return null;

  return { finalists, title: params.get('t') ?? '' };
}
