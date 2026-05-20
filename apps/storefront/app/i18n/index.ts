import az from './locales/az.json';
import en from './locales/en.json';
import ru from './locales/ru.json';

export const SUPPORTED_LOCALES = ['az', 'en', 'ru'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'az';

const catalogs: Record<Locale, unknown> = { az, en, ru };

const isSupported = (v: string): v is Locale =>
  (SUPPORTED_LOCALES as readonly string[]).includes(v);

/**
 * Pick a locale for the request. Precedence:
 *   1. `?lang=` query (explicit override, makes share links localisable).
 *   2. `Accept-Language` header (best match against supported list).
 *   3. Fallback to DEFAULT_LOCALE.
 */
export const detectLocale = (acceptLanguage: string | null | undefined, url: URL): Locale => {
  const q = url.searchParams.get('lang');
  if (q) {
    const norm = q.trim().toLowerCase();
    if (isSupported(norm)) return norm;
  }
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(',')) {
      const code = part.split(/[;-]/)[0]?.trim().toLowerCase();
      if (code && isSupported(code)) return code;
    }
  }
  return DEFAULT_LOCALE;
};

const lookup = (locale: Locale, key: string): string | undefined => {
  const parts = key.split('.');
  let cur: unknown = catalogs[locale];
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
};

const interpolate = (str: string, vars?: Record<string, string | number>): string => {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    k in vars ? String(vars[k]) : `{{${k}}}`,
  );
};

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

/** Build a `t()` bound to a single locale. Falls back to DEFAULT_LOCALE, then key. */
export const makeT = (locale: Locale): TFunction => {
  return (key, vars) => {
    const raw =
      lookup(locale, key) ?? (locale === DEFAULT_LOCALE ? undefined : lookup(DEFAULT_LOCALE, key));
    return interpolate(raw ?? key, vars);
  };
};
