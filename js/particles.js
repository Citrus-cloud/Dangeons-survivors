'use strict';
/* ============================================================
   particles.js — пул частиц и помощники для визуальных эффектов.

   Шаг 3:
   - Унифицированный объект Particle: kind = 'spark' | 'ring' | 'text'
     поверх имеющихся полей (x, y, vx, vy, life, color, size).
   - Helpers: Particles.spark, Particles.ring, Particles.burst,
     Particles.text, Particles.chestGlow, Particles.fusionBurst.
   - Пул создаётся и обновляется в main.js (CONFIG.POOLS.PARTICLES = 100).
   - Этот модуль ТОЛЬКО предоставляет фабрику и хелперы спавна;
     апдейт/рендер живут в Game.updateParticles / Game.renderParticles
     (там же используем kind для разной отрисовки).
   ============================================================ */

/** Фабрика частицы. Расширенная под Шаг 3. */
function createParticle() {
  return {
    active: false,
    kind: 'spark',          // 'spark' | 'ring' | 'text'
    x: 0, y: 0,
    vx: 0, vy: 0,
    life: 0, maxLife: 0,
    color: '#888',
    size: 3,                // для 'spark' — сторона квадрата; для 'text' — px шрифта
    // Для 'ring':
    radius: 0,
    maxRadius: 0,
    lineWidth: 2,
    // Для 'text':
    text: '',
  };
}
window.createParticle = createParticle;


const Particles = {
  /** Внутренний помощник: получить свободную частицу из пула Game.particles. */
  _spawn() {
    if (!window.Game || !Game.particles) return null;
    const p = Game.particles.spawn();
    if (!p) return null;
    // Сбросить опциональные поля к "нулю" (на случай переиспользования)
    p.kind = 'spark';
    p.radius = 0;
    p.maxRadius = 0;
    p.lineWidth = 2;
    p.text = '';
    return p;
  },

  /** Простая искра: квадрат size px, разлетающийся со скоростью v. */
  spark(x, y, vx, vy, life, color, size) {
    const p = this._spawn();
    if (!p) return null;
    p.kind = 'spark';
    p.x = x; p.y = y;
    p.vx = vx; p.vy = vy;
    p.life = p.maxLife = life;
    p.color = color || '#fff';
    p.size = size || 3;
    return p;
  },

  /** Расширяющееся кольцо: от 0 до maxRadius за life секунд. */
  ring(x, y, maxRadius, life, color, lineWidth) {
    const p = this._spawn();
    if (!p) return null;
    p.kind = 'ring';
    p.x = x; p.y = y;
    p.vx = 0; p.vy = 0;
    p.life = p.maxLife = life;
    p.color = color || 'rgba(255, 215, 80, 0.9)';
    p.size = 0;
    p.radius = 0;
    p.maxRadius = maxRadius;
    p.lineWidth = lineWidth || 3;
    return p;
  },

  /** Всплывающий текст (например, "+20 XP"). vy отрицательная — взлёт вверх. */
  text(x, y, str, life, color, size) {
    const p = this._spawn();
    if (!p) return null;
    p.kind = 'text';
    p.x = x; p.y = y;
    p.vx = 0; p.vy = -40;
    p.life = p.maxLife = life || 1.0;
    p.color = color || '#ffe084';
    p.size = size || 16;
    p.text = String(str);
    return p;
  },

  /** "Взрыв" из count искр заданного цвета. */
  burst(x, y, count, opts) {
    opts = opts || {};
    const speedMin = opts.speedMin != null ? opts.speedMin : 60;
    const speedMax = opts.speedMax != null ? opts.speedMax : 160;
    const lifeMin  = opts.lifeMin  != null ? opts.lifeMin  : 0.4;
    const lifeMax  = opts.lifeMax  != null ? opts.lifeMax  : 0.8;
    const sizeMin  = opts.sizeMin  != null ? opts.sizeMin  : 2;
    const sizeMax  = opts.sizeMax  != null ? opts.sizeMax  : 4;
    const color    = opts.color    || '#fff';
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Utils.rand(speedMin, speedMax);
      this.spark(
        x, y,
        Math.cos(a) * sp, Math.sin(a) * sp,
        Utils.rand(lifeMin, lifeMax),
        color,
        Utils.rand(sizeMin, sizeMax),
      );
    }
  },

  /** Эффект слияния (эволюция): золотая вспышка-кольцо + 12 искр. */
  fusionBurst(x, y) {
    // Кольцо: расширяется до 100 px за 0.3 с
    this.ring(x, y, 100, 0.30, 'rgba(255, 220, 90, 0.95)', 4);
    // Внутреннее кольцо чуть меньше и ярче
    this.ring(x, y, 60,  0.25, 'rgba(255, 255, 200, 0.8)', 2);
    // Золотые искры
    this.burst(x, y, 12, {
      color: '#ffd84a',
      speedMin: 80, speedMax: 220,
      lifeMin: 0.45, lifeMax: 0.85,
      sizeMin: 2.5, sizeMax: 4.5,
    });
  },

  /** Лёгкое свечение при появлении сундука — мягкое расширяющееся кольцо. */
  chestGlow(x, y) {
    this.ring(x, y, 50, 0.50, 'rgba(255, 215, 80, 0.55)', 3);
  },

  /** Эффект открытия сундука: яркая вспышка + жёлтые искры. */
  chestOpen(x, y) {
    this.ring(x, y, 80, 0.35, 'rgba(255, 240, 160, 0.95)', 4);
    this.burst(x, y, 14, {
      color: '#ffd84a',
      speedMin: 90, speedMax: 240,
      lifeMin: 0.5, lifeMax: 0.9,
      sizeMin: 2, sizeMax: 4,
    });
  },

  /** Обновление одной частицы, специфичное для kind.
   *  Возвращает true, если частицу нужно деактивировать. */
  step(p, dt) {
    p.life -= dt;
    if (p.life <= 0) return true;
    switch (p.kind) {
      case 'spark':
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
        break;
      case 'ring': {
        const t = 1 - Math.max(0, p.life / p.maxLife); // 0..1
        p.radius = p.maxRadius * t;
        break;
      }
      case 'text':
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy *= 0.98;
        break;
    }
    return false;
  },

  /** Отрисовка одной частицы. ctx уже сдвинут на -cam. */
  draw(ctx, p) {
    const a = Math.max(0, p.life / p.maxLife);
    switch (p.kind) {
      case 'spark': {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
        ctx.globalAlpha = 1;
        break;
      }
      case 'ring': {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.lineWidth;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'text': {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x, p.y);
        ctx.globalAlpha = 1;
        break;
      }
    }
  },
};

window.Particles = Particles;
