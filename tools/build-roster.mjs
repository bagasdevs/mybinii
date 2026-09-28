// Menghasilkan data/roster.js dari data/roster.json.
// Jalankan: node tools/build-roster.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync(new URL('../data/roster.json', import.meta.url), 'utf8'));

for (const key of ['checked', 'groups', 'members']) {
  if (!(key in src)) throw new Error(`data/roster.json kehilangan kunci "${key}"`);
}

const banner = `// DIHASILKAN oleh tools/build-roster.mjs — jangan diedit manual.
// Sumber: data/roster.json (scrape dari https://mygirlnine.pages.dev/)
`;

const out = `${banner}
export const CHECKED = ${JSON.stringify(src.checked)};
export const GROUPS = ${JSON.stringify(src.groups, null, 2)};
export const MEMBERS = ${JSON.stringify(src.members, null, 2)};
`;

writeFileSync(new URL('../data/roster.js', import.meta.url), out);
console.log(`data/roster.js: ${src.groups.length} grup, ${src.members.length} member`);
