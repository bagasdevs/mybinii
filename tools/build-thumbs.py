# Membuat thumbnail WebP untuk grid (heat/sort/result) dari foto asli di photos/.
# Foto asli TIDAK pernah ditimpa: poster dan pratinjau crop tetap memakai berkas
# beresolusi penuh, dan sha256 di data/photo-sources.json tetap bisa diverifikasi.
# Jalankan: python tools/build-thumbs.py [--force]
# Butuh Pillow. Keluaran: photos/thumb/<nama tanpa ekstensi>.webp
import os
import sys

from PIL import Image, ImageOps

SRC = 'photos'
OUT = os.path.join(SRC, 'thumb')
MAX_EDGE = 480  # sel grid terbesar ~202 CSS px, jadi 480 menutup layar 2x
QUALITY = 80
EXTS = {'.jpg', '.jpeg', '.png', '.webp'}


def main(force=False):
    os.makedirs(OUT, exist_ok=True)
    names = sorted(
        n for n in os.listdir(SRC)
        if os.path.splitext(n)[1].lower() in EXTS and os.path.isfile(os.path.join(SRC, n))
    )
    made = skipped = 0
    total = 0
    for name in names:
        src = os.path.join(SRC, name)
        dst = os.path.join(OUT, os.path.splitext(name)[0] + '.webp')
        if not force and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            skipped += 1
            total += os.path.getsize(dst)
            continue
        with Image.open(src) as im:
            # Rotasi EXIF dipanggang ke piksel; WebP tidak menyimpan tag itu.
            im = ImageOps.exif_transpose(im)
            if im.mode not in ('RGB', 'RGBA'):
                im = im.convert('RGBA' if 'A' in im.mode else 'RGB')
            if max(im.size) > MAX_EDGE:
                scale = MAX_EDGE / max(im.size)
                im = im.resize(
                    (max(1, round(im.width * scale)), max(1, round(im.height * scale))),
                    Image.LANCZOS,
                )
            im.save(dst, 'WEBP', quality=QUALITY, method=6)
        made += 1
        total += os.path.getsize(dst)
    print(f'{len(names)} foto: {made} dibuat, {skipped} dilewati, thumb {total / 1048576:.1f} MB')


if __name__ == '__main__':
    main('--force' in sys.argv)
