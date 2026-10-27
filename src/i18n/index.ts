import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { vi } from './vi';

/** Cổng khách song ngữ vi/en (SRS 11.1). Cổng nhân viên dùng tiếng Việt. */
const saved = (() => {
  try {
    return localStorage.getItem('lang');
  } catch {
    return null;
  }
})();

i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi }, en: { translation: en } },
  lng: saved === 'en' ? 'en' : 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
});

export function setLanguage(lang: 'vi' | 'en') {
  i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  try {
    localStorage.setItem('lang', lang);
  } catch {
    /* trình duyệt chặn lưu trữ: vẫn đổi ngôn ngữ trong phiên */
  }
}

export default i18n;
