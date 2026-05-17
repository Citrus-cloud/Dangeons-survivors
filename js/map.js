'use strict';
/* ============================================================
   map.js — карта, тайлы, камера, наземные эффекты (Шаг 4).
   ============================================================ */

const GameMap = {
  tilePositions: [],

  /** Пул наземных эффектов (лужи слизи / гнили / огня). */
  groundEffects: null,

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
    // Создать пул при первом вызове
    if (!this.groundEffects) {
      this.groundEffects = new ObjectPool(createGroundEffect, CONFIG.POOLS.GROUND_EFFECTS);
    }
  },

  /** Очистить все наземные эффекты (новый забег). */
  clearGroundEffects() {
    if (this.groundEffects) this.groundEffects.clearAll();
  },

  /**
   * Заспавнить наземный эффект.
   *   kind ∈ 'slime' | 'rot' | 'fire'
   *   opts: { radius, life, slow=0..1, dps=0, color }
   */
  spawnGroundEffect(kind, x, y, opts) {
    if (!this.groundEffects) return null;
    const ge = this.groundEffects.spawn();
    if (!ge) return null;     // пул переполнен — старое не вытесняем
    opts = opts || {};
    ge.kind = kind || 'slime';
    ge.x = x; ge.y = y;
    ge.radius = opts.radius || 22;
    ge.life = ge.maxLife = opts.life || 2;
    ge.slow = opts.slow || 0;
    ge.dps = opts.dps || 0;
    ge.color = opts.color || GROUND_DEFAULT_COLOR[ge.kind] || 'rgba(255,255,255,0.4)';
    return ge;
  },

  /** Найти суммарный slow-фактор (0..1) и dps по позиции игрока. */
  queryGroundAt(x, y) {
    if (!this.groundEffects) return { slow: 0, dps: 0 };
    let maxSlow = 0;
    let totalDps = 0;
    const items = this.groundEffects.items;
    for (let i = 0; i < items.length; i++) {
      const g = items[i];
      if (!g.active) continue;
      const dx = x - g.x, dy = y - g.y;
      if (dx * dx + dy * dy <= g.radius * g.radius) {
        if (g.slow > maxSlow) maxSlow = g.slow;
        totalDps += g.dps;
      }
    }
    return { slow: maxSlow, dps: totalDps };
  },

  /** Обновить наземные эффекты — таймеры жизни. */
  updateGroundEffects(dt) {
    if (!this.groundEffects) return;
    const items = this.groundEffects.items;
    for (let i = 0; i < items.length; i++) {
      const g = items[i];
      if (!g.active) continue;
      g.life -= dt;
      if (g.life <= 0) g.active = false;
    }
  },

  /** Отрисовать наземные эффекты. ctx уже сдвинут на -cam. */
  renderGroundEffects(ctx, cam, viewW, viewH) {
    if (!this.groundEffects) return;
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    const items = this.groundEffects.items;
    for (let i = 0; i < items.length; i++) {
      const g = items[i];
      if (!g.active) continue;
      if (g.x + g.radius < minX || g.x - g.radius > maxX ||
          g.y + g.radius < minY || g.y - g.radius > maxY) continue;
      const t = Math.max(0, g.life / g.maxLife);
      // Лёгкая пульсация для огня
      const pulse = (g.kind === 'fire') ? (1 + Math.sin(g.life * 8) * 0.05) : 1;
      const alpha = 0.25 + 0.55 * t;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      // Тонкий контур по цвету
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = GROUND_OUTLINE_COLOR[g.kind] || 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
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


/* ============================================================
   GroundEffect — пул-объект для луж/следов.
   ============================================================ */
function createGroundEffect() {
  return {
    active: false,
    kind: 'slime',          // 'slime' | 'rot' | 'fire'
    x: 0, y: 0,
    radius: 22,
    life: 0, maxLife: 0,
    slow: 0,                // 0..1 — доля замедления игрока
    dps: 0,                 // урон в секунду игроку
    color: 'rgba(255,160,60,0.45)',
  };
}

const GROUND_DEFAULT_COLOR = {
  slime: 'rgba(255, 160, 60, 0.45)',
  rot:   'rgba(120, 200, 100, 0.45)',
  fire:  'rgba(255, 120, 30, 0.55)',
};
const GROUND_OUTLINE_COLOR = {
  slime: 'rgba(255, 200, 130, 0.7)',
  rot:   'rgba(180, 240, 160, 0.7)',
  fire:  'rgba(255, 220, 130, 0.9)',
};

window.createGroundEffect = createGroundEffect;
window.GameMap = GameMap;
