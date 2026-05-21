'use strict';
/* ============================================================
   i18n/engine.js — Localization engine (multilingual RU/EN).
   
   System:
   • LOCALE{} — String storage (populated in locale-ru.js, locale-en.js)
   • t(key, ...args) — Get string in current language
   • setLang(lang) — Switch language and update UI
   
   Language detection (priority):
   1. Saved in localStorage ('d20_lang')
   2. navigator.language (auto-detect)
   3. Fallback: 'en'
   
   Substitution: t('key', arg0, arg1) replaces {0}, {1} in strings.
   
   Dependencies: SafeStorage (must be loaded before this file)
   Export: window.{LOCALE, t, setLang, getLang}
   ============================================================ */

const LOCALE = { ru: {}, en: {} };

// --- Language detection ---
let _currentLang = 'en';
(function() {
  const saved = SafeStorage.getItem('d20_lang');
  if (saved && (saved === 'ru' || saved === 'en')) {
    _currentLang = saved;
  } else {
    const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    _currentLang = nav.startsWith('ru') ? 'ru' : 'en';
    SafeStorage.setItem('d20_lang', _currentLang);
  }
})();

/** Get string in current language */
function t(key, ...args) {
  const str = (LOCALE[_currentLang] && LOCALE[_currentLang][key]) ||
              (LOCALE.en && LOCALE.en[key]) || key;
  if (args.length === 0) return str;
  // Substitution support {0}, {1}...
  return str.replace(/\{(\d+)\}/g, (m, i) => args[i] !== undefined ? args[i] : m);
}

/** Switch language */
function setLang(lang) {
  if (lang !== 'ru' && lang !== 'en') return;
  _currentLang = lang;
  SafeStorage.setItem('d20_lang', lang);
  // Update HTML elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  // Rebuild dynamic camp overlays on language change
  if (window.UI && UI._campOverlay) {
    UI._campOverlay.remove();
    UI._campOverlay = null;
  }
}

/** Get current language */
function getLang() { return _currentLang; }

window.t = t;
window.setLang = setLang;
window.getLang = getLang;
window.LOCALE = LOCALE;

