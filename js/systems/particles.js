'use strict';
/* ============================================================
   particles.js — Система визуальных частиц (VFX).
   
   Назначение:
   Управляет созданием и спавном визуальных эффектов:
   искры, кольца, текст, пыль, свечение сундуков и т.д.
   
   Типы частиц (kind):
   • 'spark' — Разлетающийся квадрат (базовый тип)
   • 'ring'  — Расширяющееся кольцо (AoE-индикатор)
   • 'text'  — Плавающий текст (урон, криты, сообщения)
   • 'dust'  — Пылевая частица с гравитацией
   
   Пул создаётся в Game.init() (CONFIG.POOLS.PARTICLES = 100).
   Обновление/рендер — в Game.updateParticles() / Game.renderParticles().
   
   Экспорт: window.{createParticle, Particles}
   ============================================================ */

/**
 * Фабрика объекта-частицы для ObjectPool.
 * Все поля инициализируются нулями/значениями по умолчанию.
 * 
 * @returns {Object} Пустой объект частицы с active: false
 */
function createParticle() {
  return {
    active: false,
    kind: 'spark',          // 'spark' | 'ring' | 'text' | 'dust'
    x: 0, y: 0,
    vx: 0, vy: 0,
    life: 0, maxLife: 0,
    color: '#888',
    size: 3,                // для 'spark' — сторона квадрата; для 'text' — px шрифта; для 'dust' — 2px
    // Для 'ring':
    radius: 0,
    maxRadius: 0,
    lineWidth: 2,
    // Для 'text':
    text: '',
    // Для 'dust':
    gravity: 0,             // px/s² вниз (лёгкое оседание)
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
    p.gravity = 0;
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

  /** Эффект слияния (эволюция): золотая вспышка-кольцо + 6 искр. (упрощено для мобильных) */
  fusionBurst(x, y) {
    // Кольцо: расширяется до 80 px за 0.25 с
    this.ring(x, y, 80, 0.25, 'rgba(255, 220, 90, 0.9)', 3);
    // Золотые искры (уменьшено количество)
    this.burst(x, y, 6, {
      color: '#ffd84a',
      speedMin: 80, speedMax: 180,
      lifeMin: 0.35, lifeMax: 0.65,
      sizeMin: 2, sizeMax: 4,
    });
  },

  /** Лёгкое свечение при появлении сундука — убрано для производительности на мобильных. */
  chestGlow(x, y) {
    // Отключено свечение для мобильных устройств
  },

  /** Эффект открытия сундука: вспышка + жёлтые искры (упрощено). */
  chestOpen(x, y) {
    this.ring(x, y, 70, 0.30, 'rgba(255, 240, 160, 0.9)', 3);
    this.burst(x, y, 8, {
      color: '#ffd84a',
      speedMin: 80, speedMax: 200,
      lifeMin: 0.4, lifeMax: 0.7,
      sizeMin: 2, sizeMax: 3,
    });
  },

  /** Шаг 6: Эффект появления босса — вспышка + искры (упрощено). */
  bossSpawn(x, y, color) {
    this.ring(x, y, 70, 0.4, color || 'rgba(255, 80, 30, 0.8)', 3);
    this.burst(x, y, 8, {
      color: '#ffd700',
      speedMin: 70, speedMax: 180,
      lifeMin: 0.4, lifeMax: 0.7,
      sizeMin: 2, sizeMax: 4,
    });
  },

  /** Шаг 6: Эффект смерти босса — вспышка + частицы (упрощено). */
  bossDeath(x, y, color) {
    this.ring(x, y, 100, 0.4, color || '#ff4444', 4);
    this.burst(x, y, 12, {
      color: color || '#ff4444',
      speedMin: 80, speedMax: 220,
      lifeMin: 0.4, lifeMax: 0.8,
      sizeMin: 2, sizeMax: 5,
    });
    this.text(x, y - 30, 'BOSS DEFEATED!', 2.0, '#ffd700', 20);
  },

  /* ============================================================
     Шаг 3 (анимации): Эффект «dusting» — рассыпание в пыль при смерти врага.
     ============================================================ */

  /** Одна пылевая частица 2×2, с гравитацией и альфа-затуханием. */
  dust(x, y, vx, vy, life, color, gravity) {
    const p = this._spawn();
    if (!p) return null;
    p.kind = 'dust';
    p.x = x; p.y = y;
    p.vx = vx; p.vy = vy;
    p.life = p.maxLife = life;
    p.color = color || '#aaa';
    p.size = 2;
    p.gravity = gravity || 30;
    return p;
  },

  /**
   * «Щелчок Таноса» — рассыпание обычного врага (5–8 частиц, 0.25 сек).
   * @param {number} x - позиция врага
   * @param {number} y - позиция врага
   * @param {string} color - основной цвет врага
   */
  enemyDust(x, y, color) {
    const count = Utils.randInt(5, 8);
    const baseColor = color || '#888';
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Utils.rand(18, 35);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - Utils.rand(4, 12);
      const life = Utils.rand(0.15, 0.30);
      this.dust(
        x + Utils.rand(-5, 5),
        y + Utils.rand(-5, 5),
        vx, vy, life, baseColor, Utils.rand(20, 35)
      );
    }
  },

  /**
   * «Щелчок Таноса» для боссов — 12-18 частиц, 0.4 сек + вспышка (упрощено).
   * @param {number} x - позиция босса
   * @param {number} y - позиция босса
   * @param {string} color - цвет босса
   */
  bossDust(x, y, color) {
    const count = Utils.randInt(12, 18);
    const baseColor = color || '#c00';
    // Вспышка
    this.ring(x, y, 50, 0.25, 'rgba(255, 255, 200, 0.8)', 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Utils.rand(25, 50);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - Utils.rand(6, 16);
      const life = Utils.rand(0.25, 0.45);
      this.dust(
        x + Utils.rand(-8, 8),
        y + Utils.rand(-8, 8),
        vx, vy, life, baseColor, Utils.rand(15, 30)
      );
    }
  },

  /**
   * Вспышка при атаке оружия — лёгкие искры заданного цвета.
   * @param {number} x - позиция появления
   * @param {number} y - позиция появления
   * @param {number} count - количество искр (2-5)
   * @param {string} color - цвет
   */
  attackSparks(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Utils.rand(40, 100);
      this.spark(
        x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        Utils.rand(0.08, 0.15),
        color || '#fff',
        Utils.rand(1.5, 3)
      );
    }
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
      case 'dust':
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.gravity * dt; // гравитация — оседание вниз
        p.vx *= 0.92;
        p.vy *= 0.92;
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
      case 'dust': {
        // Квадратик 2×2 с быстрым альфа-затуханием
        ctx.globalAlpha = a * a; // квадратичное затухание — быстрее исчезает
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 1, p.y - 1, p.size, p.size);
        ctx.globalAlpha = 1;
        break;
      }
    }
  },
};

window.Particles = Particles;
