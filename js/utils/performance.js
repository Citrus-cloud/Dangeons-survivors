'use strict';
/* ============================================================
   performance.js — Утилиты оптимизации памяти и производительности.
   MemoryOptimizer, DistanceCache, EnemyThrottle, AudioPool.
   ============================================================ */

const MemoryOptimizer = {
  /** Макс. число активных частиц */
  MAX_PARTICLES: 200,

  /** Ограничить число активных частиц, деактивируя самые старые */
  enforceParticleLimit(particlePool) {
    if (!particlePool || !particlePool.items) return;
    const items = particlePool.items;
    let activeCount = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].active) activeCount++;
    }
    if (activeCount <= this.MAX_PARTICLES) return;
    // Деактивируем самые старые (наименьший life)
    let toRemove = activeCount - this.MAX_PARTICLES;
    for (let i = 0; i < items.length && toRemove > 0; i++) {
      if (items[i].active && items[i].life < 0.3) {
        items[i].active = false;
        toRemove--;
      }
    }
  },

  /**
   * Удаление снарядов, ушедших далеко за карту.
   * Вызывается раз в 0.5 сек чтобы не забивать пул.
   */
  cleanupDistantProjectiles(projectilePool, mapW, mapH) {
    if (!projectilePool || !projectilePool.items) return;
    const margin = 200;
    const items = projectilePool.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      if (p.x < -margin || p.x > mapW + margin ||
          p.y < -margin || p.y > mapH + margin) {
        p.active = false;
      }
    }
  },
};

window.MemoryOptimizer = MemoryOptimizer;


/**
 * DistanceCache — кэш расстояний до игрока (один раз за кадр).
 */
const DistanceCache = {
  _playerX: 0,
  _playerY: 0,
  _cache: new Map(),
  _frameId: 0,

  /** Обновить позицию игрока на начало кадра */
  beginFrame(px, py) {
    this._playerX = px;
    this._playerY = py;
    this._cache.clear();
    this._frameId++;
  },

  /** Получить квадрат расстояния до игрока */
  getDistSq(obj) {
    let d2 = this._cache.get(obj);
    if (d2 !== undefined) return d2;
    const dx = obj.x - this._playerX;
    const dy = obj.y - this._playerY;
    d2 = dx * dx + dy * dy;
    this._cache.set(obj, d2);
    return d2;
  },

  /** Расстояние до игрока */
  getDist(obj) {
    return Math.sqrt(this.getDistSq(obj));
  }
};

window.DistanceCache = DistanceCache;


/**
 * EnemyThrottle — Throttled update для далёких врагов.
 */
const EnemyThrottle = {
  FULL_UPDATE_DIST: 600,
  SKIP_DIST: 1200,
  _frameCounter: 0,

  /** Вызвать в начале каждого кадра */
  tick() { this._frameCounter++; },

  /** Должен ли враг получать полное обновление AI в этом кадре? */
  shouldFullUpdate(enemy, playerX, playerY) {
    const dx = enemy.x - playerX;
    const dy = enemy.y - playerY;
    const d2 = dx * dx + dy * dy;
    if (d2 < this.FULL_UPDATE_DIST * this.FULL_UPDATE_DIST) return true;
    if (d2 > this.SKIP_DIST * this.SKIP_DIST) return false;
    return (this._frameCounter + (enemy.x | 0)) % 3 === 0;
  }
};

window.EnemyThrottle = EnemyThrottle;


/**
 * AudioPool — Лимит одновременных звуков.
 */
const AudioPool = {
  _pool: [],
  MAX_CONCURRENT: 8,

  canPlay() {
    this._pool = this._pool.filter(s => s.active);
    return this._pool.length < this.MAX_CONCURRENT;
  },

  register(sound) {
    this._pool.push(sound);
  }
};

window.AudioPool = AudioPool;
