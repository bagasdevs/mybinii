import { POSTER_LAYOUT, groupLines, memberLabel, photoOf } from './view.js';

const WIDTH = 1080;
const HEIGHT = 1600;
const FONT = '"Noto Sans KR", sans-serif';

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`gagal memuat ${url}`));
    image.src = url;
  });
}

/**
 * Menggambar poster 1080x1600 dan mengembalikan Blob PNG.
 * `labels` = { eyebrow, foot, locale, groupById, rank(n) }
 */
export async function buildPoster({ finalists, memberById, custom, title, labels }) {
  // Tanpa ini, teks Hangul bisa ter-render sebagai kotak di canvas.
  for (const weight of [500, 700, 800, 900]) {
    await document.fonts.load(`${weight} 40px ${FONT}`);
  }
  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const c = canvas.getContext('2d');

  c.fillStyle = '#fff';
  c.fillRect(0, 0, WIDTH, HEIGHT);
  c.textAlign = 'center';
  c.fillStyle = '#181818';
  c.font = `700 28px ${FONT}`;
  c.fillText(labels.eyebrow, WIDTH / 2, 80);

  let size = 58;
  c.font = `900 ${size}px ${FONT}`;
  while (c.measureText(title).width > 980 && size > 20) {
    size -= 2;
    c.font = `900 ${size}px ${FONT}`;
  }
  c.fillText(title, WIDTH / 2, 158);

  for (let slot = 0; slot < POSTER_LAYOUT.length; slot++) {
    const rankIndex = POSTER_LAYOUT[slot];
    const member = memberById.get(finalists[rankIndex]);
    if (!member) continue;

    const photo = photoOf(member, custom);
    const image = await loadImage(photo.url);
    const x = 55 + (slot % 3) * 330;
    const y = 218 + Math.floor(slot / 3) * 420;
    const w = 310;
    const h = 310;
    const scale = Math.max(w / image.width, h / image.height);
    const iw = image.width * scale;
    const ih = image.height * scale;
    const dx = x + ((w - iw) * photo.x) / 100;
    const dy = y + ((h - ih) * photo.y) / 100;

    c.save();
    c.beginPath();
    c.roundRect(x, y, w, h, 25);
    c.clip();
    c.translate(x + w / 2, y + h / 2);
    c.scale(photo.zoom, photo.zoom);
    c.translate(-(x + w / 2), -(y + h / 2));
    c.drawImage(image, dx, dy, iw, ih);
    c.restore();

    c.fillStyle = rankIndex === 0 ? '#c1fb61' : '#fff';
    c.beginPath();
    c.roundRect(x + 12, y + 12, 78, 46, 23);
    c.fill();

    c.fillStyle = '#181818';
    c.font = `800 26px ${FONT}`;
    c.fillText(labels.rank(rankIndex + 1), x + 51, y + 44);

    c.font = `800 29px ${FONT}`;
    c.fillText(memberLabel(member, labels.locale), x + w / 2, y + h + 43);

    c.fillStyle = '#777';
    c.font = `500 18px ${FONT}`;
    groupLines(member, labels.groupById, labels.locale).forEach((line, i) => {
      c.fillText(line, x + w / 2, y + h + 72 + i * 22);
    });
  }

  c.fillStyle = '#888';
  c.font = `500 17px ${FONT}`;
  c.fillText(labels.foot, WIDTH / 2, 1560);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob gagal'))), 'image/png');
  });
}
