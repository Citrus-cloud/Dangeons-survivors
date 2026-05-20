'use strict';
/* ============================================================
   safe-storage.js — Безопасная обёртка над localStorage.
   В Private Browsing (Safari, некоторые WebView) localStorage
   может бросать исключения. Fallback: in-memory хранилище.
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
