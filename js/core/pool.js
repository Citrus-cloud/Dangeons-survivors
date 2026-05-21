'use strict';
/* ============================================================
   pool.js — Расширенный менеджер объектных пулов (Шаг 5).
   
   Дополняет базовый ObjectPool из constants.js:
   • PoolManager — Централизованное управление всеми пулами
   • Динамическое расширение пулов при необходимости
   • Безопасная очистка с возвратом в пул (без GC pressure)
   • Статистика использования пулов (DEBUG)
   
   Экспорт: window.PoolManager
   ============================================================ */

const PoolManager = {
  /** @type {Map<string, ObjectPool>} Реестр всех пулов */
  _pools: new Map(),

  /** @type {Object} Временные объекты для переиспользования (zero-alloc) */
  _tempVec2: { x: 0, y: 0 },
  _tempRect: { x: 0, y: 0, w: 0, h: 0 },
  _tempResult: { hit: false, x: 0, y: 0, dist: 0 },

  /**
   * Зарегистрировать пул в менеджере.
   * @param {string} name — Уникальное имя пула
   * @param {ObjectPool} pool — Экземпляр ObjectPool
   */
  register(name, pool) {
    this._pools.set(name, pool);
  },

  /**
   * Получить пул по имени.
   * @param {string} name
   * @returns {ObjectPool|null}
   */
  get(name) {
    return this._pools.get(name) || null;
  },

  /**
   * Вернуть все объекты во все пулы (мягкая очистка).
   * Не удаляет массивы — просто помечает active=false.
   */
  releaseAll() {
    for (const pool of this._pools.values()) {
      pool.clearAll();
    }
  },

  /**
   * Получить статистику использования всех пулов.
   * @returns {Object} { name: { active, total, usage% } }
   */
  getStats() {
    const stats = {};
    for (const [name, pool] of this._pools) {
      const active = pool.countActive();
      const total = pool.items.length;
      stats[name] = {
        active,
        total,
        usage: total > 0 ? ((active / total * 100) | 0) : 0,
      };
    }
    return stats;
  },

  /**
   * Получить временный вектор (zero-alloc).
   * ВНИМАНИЕ: возвращает ОДИН и тот же объект! Не хранить ссылку.
   * @param {number} x
   * @param {number} y
   * @returns {{x: number, y: number}}
   */
  tempVec(x, y) {
    this._tempVec2.x = x;
    this._tempVec2.y = y;
    return this._tempVec2;
  },

  /**
   * Безопасная очистка при переходе между главами.
   * Возвращает все объекты в пулы, очищает ссылки.
   */
  onChapterTransition() {
    // Возвращаем всё в пулы (не создаём мусор)
    this.releaseAll();
    
    // Сбрасываем кеш расстояний (сбрасываем позицию и frameId)
    if (window.DistanceCache) {
      DistanceCache._playerX = 0;
      DistanceCache._playerY = 0;
      DistanceCache._frameId = 0;
    }
    
    // Очищаем пространственную сетку
    if (window.Game && Game._enemyGrid && Game._enemyGrid.clear) {
      Game._enemyGrid.clear();
    }

    // Очищаем кэш рендера карты
    if (window.RenderCache) {
      RenderCache.clear();
    }

    // НЕ обнуляем GameMap._floorCache здесь!
    // Кэш пола пересоздаётся внутри generateDungeon() / StaticMap.load().
    // Обнуление до вызова генерации приводило к чёрному экрану,
    // если генерация бросала ошибку или вызывалась асинхронно.
  },
};

window.PoolManager = PoolManager;
