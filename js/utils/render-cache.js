'use strict';
/* ============================================================
   render-cache.js — Кэширование спрайтов на offscreen canvas.
   
   Назначение:
   Создаёт и кэширует спрайты по ключу, чтобы не перерисовывать
   их каждый кадр. Используется для статичных элементов UI,
   декора карты и прочих повторяющихся отрисовок.
   
   API:
   • RenderCache.get(key, w, h, drawFn) — Получить/создать спрайт
   • RenderCache.clear() — Очистить кэш (при смене карты)
   
   Экспорт: window.RenderCache
   ============================================================ */

const RenderCache = {
  _cache: new Map(),

  /** Получить или создать кэшированный спрайт */
  get(key, width, height, drawFn) {
    if (this._cache.has(key)) return this._cache.get(key);
    const cvs = document.createElement('canvas');
    cvs.width = width;
    cvs.height = height;
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawFn(ctx, width, height);
    this._cache.set(key, cvs);
    return cvs;
  },

  /** Очистить весь кэш (при смене карты) */
  clear() { this._cache.clear(); },
};

window.RenderCache = RenderCache;
