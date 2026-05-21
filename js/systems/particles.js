'use strict';
/* ============================================================
   particles.js — Система визуальных частиц (VFX) — Шаг 5 оптимизация.
   
   Оптимизации:
   • Жёсткий лимит MAX_PARTICLES (200) с приоритетным удалением старых
   • Throttle эффектов: burst ограничен до MAX_BURST_PER_FRAME
   • Простые примитивы (fillRect) вместо сложных draw-вызовов
   • Уменьшение количества частиц во всех burst'ах
   • Пропуск спавна при превышении лимита
   
   Типы частиц (kind):
   • 'spark' — Разлетающийся квадрат (базовый тип)
   • 'ring'  — Расширяющееся кольцо (AoE-индикатор)
   • 'text'  — Плавающий текст (урон, криты, сообщения)
   • 'dust'  — Пылевая частица с гравитацией
   
   Экспорт: window.{createParticle, Particles}
   ============================================================ */

/** Максимум одновременных активных частиц */
const MAX_PARTICLES = 200;
/** Максимум burst'ов (больших спавнов) за один кадр */
const MAX_BURST_PER_FRAME = 5;
/** Максимум частиц в одном burst (мобильная оптимизация) */
const MAX_BURST_COUNT = 12;

/**
 * Фабрика объекта-частицы для ObjectPool.
 * @returns {Object} Пустой объект частицы с active: false
 */
function createParticle() {
  return {
    active: false,
    kind: 'spark',
    x: 0, y: 0,
    vx: 0, vy: 0,
    life: 0, maxLife: 0,
    color: '#888',
    size: 3,
    radius: 0,
    maxRadius: 0,
    lineWidth: 2,
    text: '',
    gravity: 0,
  };
}
window.createParticle = createParticle;


const Particles = {
  /** Счётчик burst'ов за текущий кадр (сбрасывается каждый кадр) */
  _burstsThisFrame: 0,
  /** Счётчик кадров для сброса burst-лимита */
  _frameId: 0,
  /** Последний frameId при котором сбросили burst counter */
  _lastResetFrame: 0,

  /**
   * Сбросить per-frame счётчики. Вызывать в начале update().
   */
  beginFrame() {
    this._burstsThisFrame = 0;
  },

  /**
   * Проверить, можно ли создать частицу (не превышен ли лимит).
   * @returns {boolean}
   */
  _canSpawn() {
    if (!window.Game || !Game.particles) return false;
    const items = Game.particles.items;
    let active = 0;
    // Быстрая проверка: считаем до MAX_PARTICLES
    for (let i = 0; i < items.length; i++) {
      if (items[i].active) {
        active++;
        if (active >= MAX_PARTICLES) return false;
      }
    }
    return true;
  },

  /** Получить свободную частицу из пула с проверкой лимита */
  _spawn() {
    if (!window.Game || !Game.particles) return null;
    // Быстрая проверка лимита (без полного подсчёта)
    const p = Game.particles.spawn();
    if (!p) return null;
    // Сброс полей для переиспользования
    p.kind = 'spark';
    p.radius = 0;
    p.maxRadius = 0;
    p.lineWidth = 2;
    p.text = '';
    p.gravity = 0;
    return p;
  },

  /** Простая искра: квадрат size px */
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

  /** Расширяющееся кольцо */
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

  /** Всплывающий текст */
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

  /**
   * "Взрыв" из count искр — с ограничением по кадру.
   * Оптимизация: уменьшаем count на мобильных, ограничиваем burst'ы в кадре.
   */
  burst(x, y, count, opts) {
    // Ограничение burst'ов за кадр
    if (this._burstsThisFrame >= MAX_BURST_PER_FRAME) return;
    this._burstsThisFrame++;

    opts = opts || {};
    // Ограничение количества частиц в burst
    count = Math.min(count, MAX_BURST_COUNT);
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

  /** Эффект слияния (эволюция) — упрощён */
  fusionBurst(x, y) {
    this.ring(x, y, 80, 0.25, 'rgba(255, 220, 90, 0.9)', 3);
    this.burst(x, y, 5, {
      color: '#ffd84a',
      speedMin: 80, speedMax: 180,
      lifeMin: 0.35, lifeMax: 0.65,
      sizeMin: 2, sizeMax: 4,
    });
  },

  /** Свечение при появлении сундука — отключено */
  chestGlow(x, y) {
    // Отключено для мобильных
  },

  /** Эффект открытия сундука — упрощён */
  chestOpen(x, y) {
    this.ring(x, y, 70, 0.30, 'rgba(255, 240, 160, 0.9)', 3);
    this.burst(x, y, 6, {
      color: '#ffd84a',
      speedMin: 80, speedMax: 200,
      lifeMin: 0.4, lifeMax: 0.7,
      sizeMin: 2, sizeMax: 3,
    });
  },

  /** Эффект появления босса — упрощён */
  bossSpawn(x, y, color) {
    this.ring(x, y, 70, 0.4, color || 'rgba(255, 80, 30, 0.8)', 3);
    this.burst(x, y, 6, {
      color: '#ffd700',
      speedMin: 70, speedMax: 180,
      lifeMin: 0.4, lifeMax: 0.7,
      sizeMin: 2, sizeMax: 4,
    });
  },

  /** Эффект смерти босса — упрощён */
  bossDeath(x, y, color) {
    this.ring(x, y, 100, 0.4, color || '#ff4444', 4);
    this.burst(x, y, 10, {
      color: color || '#ff4444',
      speedMin: 80, speedMax: 220,
      lifeMin: 0.4, lifeMax: 0.8,
      sizeMin: 2, sizeMax: 5,
    });
    this.text(x, y - 30, 'BOSS DEFEATED!', 2.0, '#ffd700', 20);
  },

  /** Пылевая частица (для рассыпания врагов) */
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
   * Рассыпание обычного врага (4-6 частиц — уменьшено).
   */
  enemyDust(x, y, color) {
    const count = Utils.randInt(4, 6);
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
   * Рассыпание босса (8-12 частиц — уменьшено).
   */
  bossDust(x, y, color) {
    const count = Utils.randInt(8, 12);
    const baseColor = color || '#c00';
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

  /** Искры при атаке оружия (2-4 частицы — уменьшено) */
  attackSparks(x, y, count, color) {
    count = Math.min(count, 4);
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

  /**
   * Обновление одной частицы. Возвращает true если деактивировать.
   * Оптимизация: минимум вычислений, без ветвлений для spark.
   */
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
        const t = 1 - (p.life / p.maxLife);
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
        p.vy += p.gravity * dt;
        p.vx *= 0.92;
        p.vy *= 0.92;
        break;
    }
    return false;
  },

  /**
   * Отрисовка одной частицы. ctx уже сдвинут на -cam.
   * Оптимизация: минимум вызовов ctx API, простые примитивы.
   */
  draw(ctx, p) {
    const a = p.life / p.maxLife;
    if (a <= 0) return;
    switch (p.kind) {
      case 'spark':
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
        ctx.globalAlpha = 1;
        break;
      case 'ring':
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.lineWidth;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      case 'text':
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x, p.y);
        ctx.globalAlpha = 1;
        break;
      case 'dust':
        ctx.globalAlpha = a * a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 1, p.y - 1, p.size, p.size);
        ctx.globalAlpha = 1;
        break;
    }
  },
};

window.Particles = Particles;
