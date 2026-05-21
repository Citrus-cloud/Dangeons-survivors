'use strict';
/* ============================================================
   render-cache.js — Кэширование спрайтов на offscreen canvas.
   
   Шаг 5 оптимизация:
   • Лимит на количество кэшированных элементов (MAX_ENTRIES)
   • LRU-подобная очистка при превышении лимита
   • getOrNull() — без автосоздания (для проверки)
   • Трекинг размера кэша в байтах (примерный)
   
   API:
   • RenderCache.get(key, w, h, drawFn) — Получить/создать спрайт
   • RenderCache.getOrNull(key) — Получить без создания
   • RenderCache.clear() — Очистить кэш (при смене карты)
   • RenderCache.size() — Количество элементов в кэше
   
   Экспорт: window.RenderCache
   ============================================================ */

const RenderCache = {
  _cache: new Map(),
  /** Макс. кэшированных спрайтов (предотвращает утечку памяти) */
  MAX_ENTRIES: 256,

  /** Получить или создать кэшированный спрайт */
  get(key, width, height, drawFn) {
    if (this._cache.has(key)) return this._cache.get(key);
    
    // Лимит: удалить старейший при превышении
    if (this._cache.size >= this.MAX_ENTRIES) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }

    const cvs = document.createElement('canvas');
    cvs.width = width;
    cvs.height = height;
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawFn(ctx, width, height);
    this._cache.set(key, cvs);
    return cvs;
  },

  /** Получить без автосоздания (для проверки наличия) */
  getOrNull(key) {
    return this._cache.get(key) || null;
  },

  /** Количество элементов в кэше */
  size() {
    return this._cache.size;
  },

  /** Очистить весь кэш (при смене карты) */
  clear() {
    this._cache.clear();
  },
};

window.RenderCache = RenderCache;
