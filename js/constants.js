'use strict';
/* ============================================================
   constants.js
   Глобальный конфиг, утилиты и пул объектов.
   Экспортируется в window.{CONFIG, Utils, ObjectPool}.
   ============================================================ */

const CONFIG = {
  MAP: { W: 2000, H: 2000, TILE_SIZE: 80 },

  PLAYER: {
    SIZE: 32,
    SPEED: 180,             // px/sec
    MAX_HP: 100,
    PICKUP_RADIUS: 40,
    TRAIL_INTERVAL: 0.05,
    SLOTS_WEAPONS: 6,
    SLOTS_ABILITIES: 6,
  },

  // Встроенная способность героя (не занимает слот) — Magic Missile
  MISSILE: {
    COOLDOWN: 3.0,
    SPEED: 380,
    DAMAGE: 25,
    RADIUS: 6,
    LIFETIME: 3.0,
    COUNT: 1,
    SPREAD: 0.25,
  },

  ENEMY: {
    SIZE: 28,
    SPEED: 55,              // Шаг 3: уменьшено в 2 раза (было 110)
    HP: 20,
    DAMAGE: 10,
    HIT_INTERVAL: 0.6,
    XP_MIN: 5,
    XP_MAX: 10,
  },

  // Шаг 3: сундук с броском d20
  CHEST: {
    INTERVAL: 180,          // секунды между появлениями (3 минуты)
    FIRST_DELAY: 180,       // первый сундук через столько секунд после старта
    SPAWN_MIN_DIST: 300,    // мин. расстояние от героя при спавне
    SPAWN_MAX_DIST: 600,    // макс. расстояние
    SIZE: 30,               // визуальный размер
    PICKUP_RADIUS: 28,      // радиус подбора (центр героя ↔ центр сундука)
  },

  WAVE: {
    INTERVAL: 20,
    BASE: 3,
    PER_WAVE: 2,
    SPAWN_DIST_MIN: 400,
    SPAWN_DIST_MAX: 600,
    INITIAL_DELAY: 1.5,
  },

  XP: {
    BASE: 100,
    GROWTH: 1.5,
    MAGNET_SPEED: 360,
  },

  POOLS: {
    ENEMIES: 80,
    PROJECTILES: 80,        // по ТЗ: один общий пул, max 80
    PARTICLES: 100,
    XP: 200,
  },

  // Параметры джойстика (экранные пиксели)
  JOYSTICK: {
    BASE_RADIUS: 35,
    STICK_RADIUS: 18,
    MAX_OFFSET: 50,
    DEAD_ZONE: 0.12,        // нормализованный, чтобы не шевелилось от микро-движений
  },
};


/* ============================================================
   Utils
   ============================================================ */
const Utils = {
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t)  { return a + (b - a) * t; },
  rand(a, b)     { return a + Math.random() * (b - a); },
  randInt(a, b)  { return Math.floor(Utils.rand(a, b + 1)); },
  dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
  len(x, y)      { return Math.hypot(x, y); },
  norm(x, y) {
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  },
  formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  },
  // Римские цифры I..V (для отображения уровня предмета)
  roman(n) {
    return ['', 'I', 'II', 'III', 'IV', 'V'][Utils.clamp(n | 0, 0, 5)] || String(n);
  },
};


/* ============================================================
   ObjectPool — переиспользуемый пул сущностей с .active флагом.
   ============================================================ */
class ObjectPool {
  constructor(factory, size) {
    this.items = new Array(size);
    for (let i = 0; i < size; i++) this.items[i] = factory();
  }
  spawn() {
    for (let i = 0, n = this.items.length; i < n; i++) {
      const it = this.items[i];
      if (!it.active) { it.active = true; return it; }
    }
    return null;
  }
  forEachActive(fn) {
    for (let i = 0, n = this.items.length; i < n; i++) {
      const it = this.items[i];
      if (it.active) fn(it, i);
    }
  }
  countActive() {
    let c = 0;
    for (let i = 0; i < this.items.length; i++) if (this.items[i].active) c++;
    return c;
  }
  clearAll() { for (const it of this.items) it.active = false; }
}

// Экспорт в глобальную область (без бандлера)
window.CONFIG = CONFIG;
window.Utils = Utils;
window.ObjectPool = ObjectPool;
