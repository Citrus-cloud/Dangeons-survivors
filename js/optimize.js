'use strict';
/* ============================================================
   optimize.js — Модуль оптимизации рендеринга, памяти и логики.
   Подключается ПОСЛЕДНИМ, патчит существующие системы.
   НЕ меняет баланс, логику урона/HP/скоростей.
   ============================================================ */

/* ============================================================
   1. ОПТИМИЗАЦИЯ РЕНДЕРИНГА
   - Кэширование спрайтов на оффскрин-канвасах
   - Уменьшение save/restore вызовов
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


/* ============================================================
   2. ОПТИМИЗАЦИЯ ПАМЯТИ
   - Лимит частиц (жёсткий потолок ~200)
   - Удаление снарядов за границей карты
   - Object pooling уже реализован; добавляем переиспользование
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


/* ============================================================
   3. ОПТИМИЗАЦИЯ ЛОГИКИ
   - Spatial Grid для быстрого поиска врагов
   - Кэш расстояний (один раз за кадр)
   - Throttle pathfinding для дальних врагов
   ============================================================ */

/**
 * SpatialGrid — сетка для быстрого поиска объектов по позиции.
 * Делит карту на ячейки cellSize×cellSize px.
 * Каждую кадр пересобирается (вставка O(n), запрос O(1) по ячейке).
 */
class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize || 128;
    this.cells = new Map();
    this._key = (cx, cy) => (cx << 16) | (cy & 0xFFFF);
  }

  /** Очистить все ячейки */
  clear() { this.cells.clear(); }

  /** Вставить объект в сетку по его x, y */
  insert(obj) {
    const cx = (obj.x / this.cellSize) | 0;
    const cy = (obj.y / this.cellSize) | 0;
    const key = this._key(cx, cy);
    let cell = this.cells.get(key);
    if (!cell) { cell = []; this.cells.set(key, cell); }
    cell.push(obj);
  }

  /** Получить все объекты в окрестности (x, y, radius) */
  query(x, y, radius) {
    const results = [];
    const r = radius / this.cellSize;
    const cxMin = ((x - radius) / this.cellSize) | 0;
    const cxMax = ((x + radius) / this.cellSize) | 0;
    const cyMin = ((y - radius) / this.cellSize) | 0;
    const cyMax = ((y + radius) / this.cellSize) | 0;
    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            results.push(cell[i]);
          }
        }
      }
    }
    return results;
  }

  /** Пересобрать сетку из ObjectPool */
  rebuild(pool) {
    this.clear();
    if (!pool || !pool.items) return;
    const items = pool.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].active) this.insert(items[i]);
    }
  }
}

window.SpatialGrid = SpatialGrid;


/**
 * DistanceCache — кэш расстояний до игрока (один раз за кадр).
 * Хранит d² для каждого активного врага.
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
    // Используем индекс объекта как ключ для скорости
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
 * Throttled update для далёких врагов.
 * Враги дальше FULL_UPDATE_DIST обновляются реже (раз в 3 кадра).
 */
const EnemyThrottle = {
  FULL_UPDATE_DIST: 600,   // пиксели — полная детализация
  SKIP_DIST: 1200,         // дальше — только движение к игроку
  _frameCounter: 0,

  /** Вызвать в начале каждого кадра */
  tick() { this._frameCounter++; },

  /** Должен ли враг получать полное обновление AI в этом кадре? */
  shouldFullUpdate(enemy, playerX, playerY) {
    const dx = enemy.x - playerX;
    const dy = enemy.y - playerY;
    const d2 = dx * dx + dy * dy;
    // Близкие враги — всегда полный апдейт
    if (d2 < this.FULL_UPDATE_DIST * this.FULL_UPDATE_DIST) return true;
    // Очень далёкие — только движение, никакой AI
    if (d2 > this.SKIP_DIST * this.SKIP_DIST) return false;
    // Средние — раз в 3 кадра
    return (this._frameCounter + (enemy.x | 0)) % 3 === 0;
  }
};

window.EnemyThrottle = EnemyThrottle;


/* ============================================================
   4. ОПТИМИЗАЦИЯ ЗВУКОВОГО ДВИЖКА
   - Пул AudioContext узлов (не создавать новые)
   ============================================================ */

const AudioPool = {
  _pool: [],
  MAX_CONCURRENT: 8,

  /** Получить или переиспользовать осциллятор (не реализован напрямую,
   *  т.к. audio.js использует Web Audio API — здесь только лимит).
   *  Ограничиваем одновременные звуки. */
  canPlay() {
    // Очищаем завершившиеся
    this._pool = this._pool.filter(s => s.active);
    return this._pool.length < this.MAX_CONCURRENT;
  },

  register(sound) {
    this._pool.push(sound);
  }
};

window.AudioPool = AudioPool;


/* ============================================================
   5. ИНТЕГРАЦИЯ С ИГРОВЫМ ЦИКЛОМ
   Патчим Game.update чтобы использовать оптимизации.
   ============================================================ */

(function applyOptimizations() {
  // Ждём пока Game будет определён
  const _waitForGame = setInterval(() => {
    if (!window.Game || !Game.canvas) return;
    clearInterval(_waitForGame);

    // Создаём SpatialGrid для врагов
    Game._enemyGrid = new SpatialGrid(128);

    // Лимит частиц — патчим конец update
    const _origUpdate = Game.update.bind(Game);
    Game.update = function(dt) {
      // Обновляем кэш расстояний
      if (this.player) {
        DistanceCache.beginFrame(this.player.x, this.player.y);
      }
      EnemyThrottle.tick();

      // Вызываем оригинальный update
      _origUpdate(dt);

      // Пост-оптимизации:
      // 1) Лимит частиц
      MemoryOptimizer.enforceParticleLimit(this.particles);

      // 2) Очистка далёких снарядов (раз в 30 кадров ≈ 0.5 сек при 60fps)
      if (EnemyThrottle._frameCounter % 30 === 0) {
        const mapW = (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) || 2000;
        const mapH = (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) || 2000;
        MemoryOptimizer.cleanupDistantProjectiles(this.projectiles, mapW, mapH);
      }

      // 3) Пересборка spatial grid для врагов (каждый кадр — быстро)
      if (this.enemies) {
        Game._enemyGrid.rebuild(this.enemies);
      }
    };

    // Шаг 19: очистка таймеров при смене экрана — уже реализовано в Game.exitToMenu/triggerGameOver

    console.log('[optimize.js] Optimizations applied');
  }, 50);
})();



/* ============================================================
   6. BUG FIXES
   ============================================================ */

(function applyBugFixes() {
  const _waitForData = setInterval(() => {
    if (!window.BIOMES || !window.ENEMY_TYPES || !window.ENEMY_TIERS) return;
    clearInterval(_waitForData);

    /* --- Bug fix #4: добавить step12/expansion врагов в биомы --- */
    // Автоматически добавляем всех врагов из ENEMY_TYPES в подходящие биомы,
    // если они не уже в списке. Критерий: враг спавнится если он в ENEMY_TIERS
    // и ещё не в enemyTypes биома. Добавляем в все биомы (каждый биом получает
    // всех врагов своего тира+ чтобы разнообразить).
    const allEnemyIds = Object.keys(ENEMY_TYPES).filter(id => {
      const cfg = ENEMY_TYPES[id];
      return cfg && cfg.spawnWeight > 0 && cfg.tier >= 1;
    });

    for (const biome of BIOMES) {
      if (!biome.enemyTypes) biome.enemyTypes = [];
      const existing = new Set(biome.enemyTypes);
      // Добавляем из tier 3+ которые отсутствуют (для step12 врагов)
      for (const id of allEnemyIds) {
        if (existing.has(id)) continue;
        const cfg = ENEMY_TYPES[id];
        // Добавляем врагов тира 3+ во все биомы (чтобы не пропадали)
        if (cfg.tier >= 3) {
          biome.enemyTypes.push(id);
        }
      }
    }

    /* --- Bug fix #5: CSS кнопка "Назад" в бестиарии --- */
    // Применяется через стиль (добавим inline правило)
    const style = document.createElement('style');
    style.textContent = `
      .bestiary-back-btn {
        position: absolute !important;
        top: 12px;
        right: 12px;
        z-index: 10;
        min-width: 80px;
        text-align: center;
      }
    `;
    document.head.appendChild(style);

    console.log('[optimize.js] Bug fixes applied');
  }, 50);
})();
