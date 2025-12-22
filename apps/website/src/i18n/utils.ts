import en from './locales/en.json';
import nl from './locales/nl.json';

export const languages = {
  en: 'English',
  nl: 'Nederlands'
} as const;

export const defaultLang = 'en' as const;

export const translations = { en, nl } as const;

export type Lang = keyof typeof translations;

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/');
  if (lang in translations) return lang as Lang;
  return defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: string): string {
    const keys = key.split('.');
    let result: any = translations[lang];

    for (const k of keys) {
      result = result?.[k];
    }

    // Fallback to English if translation not found
    if (result === undefined) {
      result = translations[defaultLang];
      for (const k of keys) {
        result = result?.[k];
      }
    }

    return result ?? key;
  };
}

export function getLocalizedPath(path: string, lang: Lang): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  // Remove existing language prefix if present
  const pathWithoutLang = cleanPath.replace(/^(en|nl)\//, '');
  return `/${lang}/${pathWithoutLang}`;
}

export function getAlternateLocales(currentPath: string, currentLang: Lang) {
  const pathWithoutLang = currentPath.replace(/^\/(en|nl)/, '');
  return Object.keys(languages).map((lang) => ({
    lang,
    url: `https://snow-flow.dev/${lang}${pathWithoutLang || '/'}`
  }));
}
