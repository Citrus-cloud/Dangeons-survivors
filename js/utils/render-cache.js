'use strict';
/* ============================================================
   render-cache.js — Кэширование спрайтов на оффскрин-канвасах.
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
