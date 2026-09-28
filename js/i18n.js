// Modul murni: tidak menyentuh document/window/localStorage.
export const DEFAULT_LOCALE = 'ko';
export const LOCALES = ['ko', 'en', 'id'];

/** Urutan: ?lang= → localStorage → navigator → default. Nilai tak dikenal dilewati. */
export function detectLocale({ search = '', stored = null, navigatorLangs = [] } = {}) {
  let fromQuery = null;
  try {
    fromQuery = new URLSearchParams(String(search).replace(/^\?/, '')).get('lang');
  } catch {
    fromQuery = null;
  }

  for (const candidate of [fromQuery, stored, ...navigatorLangs]) {
    if (!candidate) continue;
    const tag = String(candidate).toLowerCase();
    if (LOCALES.includes(tag)) return tag;
    const prefixed = LOCALES.find((locale) => tag.startsWith(`${locale}-`));
    if (prefixed) return prefixed;
  }
  return DEFAULT_LOCALE;
}

export function interpolate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, name) =>
    vars && Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}

/**
 * @param dicts   { ko: {...}, en: {...}, id: {...} }
 * @param getLocale () => 'ko' | 'en' | 'id'
 * @param onMissing dipanggil sekali per key yang hilang
 */
export function createTranslator(dicts, getLocale, onMissing) {
  const warned = new Set();
  const warn = onMissing ?? ((key) => console.warn(`[i18n] missing key: ${key}`));

  return function t(key, vars) {
    const dict = dicts[getLocale()] ?? dicts[DEFAULT_LOCALE] ?? {};
    const raw = dict[key];
    if (raw === undefined) {
      if (!warned.has(key)) {
        warned.add(key);
        warn(key);
      }
      return key;
    }
    return vars ? interpolate(raw, vars) : raw;
  };
}

/** Label generasi. Gen di luar {2,3,4,5} memakai 'gen.other'. */
export function genLabel(gen, t) {
  const n = Number(gen) || 0;
  const key = `gen.${n}`;
  const specific = t(key);
  return specific === key ? t('gen.other', { n }) : specific;
}
