// Dialog crop/zoom/posisi dan unggah foto sendiri.
// `loadImage` tinggal di js/poster.js supaya hanya ada satu implementasi.
import { loadImage } from './poster.js';
import * as act from './state.js';
import { esc, memberLabel, photoOf } from './view.js';

const MAX_BYTES = 20 * 1024 * 1024;
const SLIDERS = [
  ['zoom', 'crop.zoom', { min: 1, max: 3, step: 0.05 }],
  ['x', 'crop.x', { min: 0, max: 100, step: 1 }],
  ['y', 'crop.y', { min: 0, max: 100, step: 1 }],
];

export function createCropDialog({ state, t, memberById, toast, toastError = toast, redraw }) {
  const dialog = document.querySelector('#dialog');
  const body = document.querySelector('#dialogBody');

  const currentPhoto = () =>
    state.custom[state.cropId] ?? photoOf(memberById.get(state.cropId), state.custom);

  function syncPreview() {
    const img = body.querySelector('#cropImg');
    if (!img) return;
    const photo = currentPhoto();
    img.src = photo.url;
    img.style.objectPosition = `${photo.x}% ${photo.y}%`;
    img.style.transform = `scale(${photo.zoom})`;
    redraw();
  }

  function wire(memberId) {
    for (const [key, labelKey, range] of SLIDERS) {
      const input = body.querySelector(`#${key}`);
      input.addEventListener('input', () => {
        act.setCrop(state, memberId, { [key]: Number(input.value) });
        syncPreview();
      });
    }

    body.querySelector('#resetPhoto').addEventListener('click', () => {
      const photo = currentPhoto();
      if (photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url);
      act.resetCrop(state, memberId);
      open(memberId);
    });

    body.querySelector('#upload').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) return toastError(t('crop.errType'));
      if (file.size > MAX_BYTES) return toastError(t('crop.errSize'));

      const url = URL.createObjectURL(file);
      try {
        await loadImage(url);
      } catch {
        URL.revokeObjectURL(url);
        return toastError(t('crop.errRead'));
      }

      const previous = currentPhoto();
      if (previous.url.startsWith('blob:')) URL.revokeObjectURL(previous.url);
      act.setCrop(state, memberId, { url, zoom: 1, x: 50, y: 50 });
      open(memberId);
    });
  }

  function open(memberId) {
    const member = memberById.get(memberId);
    if (!member) return;
    const photo = act.beginCrop(state, memberId);

    body.innerHTML =
      `<h2 id="dialogTitle">${esc(t('crop.title', { name: memberLabel(member, state.lang) }))}</h2>` +
      `<label class="outline" style="display:inline-block;cursor:pointer">${esc(t('crop.choose'))}` +
      `<input type="file" accept="image/*" id="upload" style="display:none"></label> ` +
      `<button class="text-button" type="button" id="resetPhoto">${esc(t('crop.reset'))}</button>` +
      `<div class="crop"><img id="cropImg" src="${esc(photo.url)}" alt="${esc(t('crop.preview.alt'))}"></div>` +
      `<div class="sliders">` +
      SLIDERS.map(
        ([key, labelKey, range]) =>
          `<label>${esc(t(labelKey))}` +
          `<input id="${key}" type="range" min="${range.min}" max="${range.max}" step="${range.step}" value="${photo[key]}">` +
          `</label>`,
      ).join('') +
      `</div><p class="small">${esc(t('crop.privacy'))}</p>`;

    syncPreview();
    wire(memberId);
    if (!dialog.open) dialog.showModal();
  }

  return { open };
}
