'use strict';
/* ============================================================
   safe-storage.js — Безопасная обёртка над localStorage.
   
   Проблема:
   В режиме Private Browsing (Safari, некоторые WebView)
   localStorage может бросать исключения при записи.
   
   Решение:
   При недоступности localStorage используется in-memory fallback.
   Данные сохраняются только на время сессии (не персистентно).
   
   API:
   • SafeStorage.getItem(key) → string|null
   • SafeStorage.setItem(key, value)
   • SafeStorage.removeItem(key)
   
   Важно: Загружается ПЕРВЫМ среди утилит (до i18n и всех модулей).
   
   Экспорт: window.SafeStorage
   ============================================================ */

const SafeStorage = (function() {
  let _available = true;
  const _fallback = {};

  // Проверяем доступность при загрузке
  try {
    const testKey = '__d20_storage_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
  } catch (e) {
    _available = false;
    console.warn('[SafeStorage] localStorage unavailable, using in-memory fallback.');
  }

  return {
    getItem(key) {
      try {
        if (_available) return localStorage.getItem(key);
      } catch (e) { /* fallback */ }
      return _fallback[key] !== undefined ? _fallback[key] : null;
    },

    setItem(key, value) {
      try {
        if (_available) { localStorage.setItem(key, value); return; }
      } catch (e) { /* fallback */ }
      _fallback[key] = String(value);
    },

    removeItem(key) {
      try {
        if (_available) { localStorage.removeItem(key); return; }
      } catch (e) { /* fallback */ }
      delete _fallback[key];
    },

    /** Является ли хранилище реальным localStorage (не fallback) */
    get isReal() { return _available; }
  };
})();

window.SafeStorage = SafeStorage;
