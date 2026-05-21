'use strict';
/* ============================================================
   i18n/engine.js — Движок локализации (многоязычность RU/EN).
   
   Система:
   • LOCALE{} — Хранилище строк (заполняется в locale-ru.js, locale-en.js)
   • t(key, ...args) — Получить строку на текущем языке
   • setLang(lang) — Сменить язык и обновить UI
   
   Определение языка (приоритет):
   1. Сохранённое в localStorage ('d20_lang')
   2. navigator.language (автоопределение)
   3. Fallback: 'ru'
   
   Подстановка: t('key', arg0, arg1) заменяет {0}, {1} в строке.
   
   Зависимости: SafeStorage (должен быть загружен до этого файла)
   Экспорт: window.{LOCALE, t, setLang, getLang}
   ============================================================ */

const LOCALE = { ru: {}, en: {} };

// --- Определение языка ---
let _currentLang = 'ru';
(function() {
  const saved = SafeStorage.getItem('d20_lang');
  if (saved && (saved === 'ru' || saved === 'en')) {
    _currentLang = saved;
  } else {
    const nav = (navigator.language || navigator.userLanguage || 'ru').toLowerCase();
    _currentLang = nav.startsWith('en') ? 'en' : 'ru';
    SafeStorage.setItem('d20_lang', _currentLang);
  }
})();

/** Получить строку на текущем языке */
function t(key, ...args) {
  const str = (LOCALE[_currentLang] && LOCALE[_currentLang][key]) ||
              (LOCALE.ru && LOCALE.ru[key]) || key;
  if (args.length === 0) return str;
  // Поддержка подстановки {0}, {1}...
  return str.replace(/\{(\d+)\}/g, (m, i) => args[i] !== undefined ? args[i] : m);
}

/** Сменить язык */
function setLang(lang) {
  if (lang !== 'ru' && lang !== 'en') return;
  _currentLang = lang;
  SafeStorage.setItem('d20_lang', lang);
  // Обновить HTML-элементы с data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  // Перестроить динамические оверлеи лагеря при смене языка
  if (window.UI && UI._campOverlay) {
    UI._campOverlay.remove();
    UI._campOverlay = null;
  }
}

/** Получить текущий язык */
function getLang() { return _currentLang; }

window.t = t;
window.setLang = setLang;
window.getLang = getLang;
window.LOCALE = LOCALE;

