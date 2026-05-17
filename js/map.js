'use strict';
/* ============================================================
   map.js — карта, тайлы, камера.
   ============================================================ */

const GameMap = {
  tilePositions: [],

  /** Прекомпьют позиций "светлых" тайлов для дёшевой отрисовки фона. */
  precompute() {
    const ts = CONFIG.MAP.TILE_SIZE;
    const cols = Math.ceil(CONFIG.MAP.W / ts);
    const rows = Math.ceil(CONFIG.MAP.H / ts);
    this.tilePositions.length = 0;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const h = ((i * 73856093) ^ (j * 19349663)) >>> 0;
        if ((h % 7) === 0) {
          this.tilePositions.push({ x: i * ts, y: j * ts, w: ts, h: ts });
        }
      }
    }
  },

  /** Камера, центрированная по игроку, с учётом границ карты. */
  getCamera(player, viewW, viewH) {
    let cx = player.x - viewW / 2;
    let cy = player.y - viewH / 2;
    cx = Utils.clamp(cx, 0, Math.max(0, CONFIG.MAP.W - viewW));
    cy = Utils.clamp(cy, 0, Math.max(0, CONFIG.MAP.H - viewH));
    return { x: cx, y: cy };
  },

  /** Отрисовать пол + тайлы в пределах камеры. ctx уже сдвинут на -cam. */
  render(ctx, cam, viewW, viewH) {
    // Пол
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0, 0, CONFIG.MAP.W, CONFIG.MAP.H);

    // Граница карты
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, CONFIG.MAP.W, CONFIG.MAP.H);

    // Видимые "светлые" тайлы
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    ctx.fillStyle = '#3a3a3a';
    for (let i = 0, n = this.tilePositions.length; i < n; i++) {
      const t = this.tilePositions[i];
      if (t.x + t.w < minX || t.x > maxX || t.y + t.h < minY || t.y > maxY) continue;
      ctx.fillRect(t.x, t.y, t.w, t.h);
    }
  },
};

window.GameMap = GameMap;
