import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { translations, type Language } from '@duhahe/shared';

function toResources() {
  const resources: Record<string, { translation: Record<string, Record<string, string>> }> = {};
  (Object.keys(translations) as Language[]).forEach((lang) => {
    resources[lang] = { translation: translations[lang] };
  });
  return resources;
}

i18n.use(initReactI18next).init({
  resources: toResources(),
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setLanguage(lang: Language) {
  i18n.changeLanguage(lang);
}

export default i18n;