// Modul murni: tidak menyentuh document/window.

/**
 * NFD (bukan NFKD: NFKD juga menerapkan dekomposisi kompatibilitas) -> buang
 * combining mark -> NFC. Langkah NFC wajib: NFD memecah suku kata Hangul jadi
 * jamo (트와이스 -> 트와이스) dan tanpa NFC bentuk itu yang tersimpan.
 * Tanda baca DIHAPUS, bukan jadi spasi, supaya "IZ*ONE" cocok dengan "izone".
 */
export function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildIndex(items, textOf) {
  const index = new Map();
  for (const item of items) index.set(item.id, normalize(textOf(item)));
  return index;
}

/** Query kosong (termasuk yang hanya berisi tanda baca) = tanpa filter. */
export function search(query, index) {
  const tokens = normalize(query).split(' ').filter(Boolean);
  const out = new Set();
  for (const [id, haystack] of index) {
    if (tokens.every((token) => haystack.includes(token))) out.add(id);
  }
  return out;
}

export function memberText(member, groupById, genLabelFn) {
  const groups = member.groups.map((id) => groupById.get(id)).filter(Boolean);
  return [
    member.id,
    member.name,
    member.english,
    ...(member.displayGroups ?? []),
    ...groups.flatMap((g) => [g.id, g.name, String(g.gen), genLabelFn(g.gen)]),
  ]
    .filter(Boolean)
    .join(' ');
}

export function groupText(group, genLabelFn) {
  return [group.id, group.name, String(group.gen), genLabelFn(group.gen)]
    .filter(Boolean)
    .join(' ');
}
