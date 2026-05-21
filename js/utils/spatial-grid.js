'use strict';
/* ============================================================
   spatial-grid.js — Пространственная сетка для быстрого поиска.
   
   Шаг 5 (оптимизация):
   - Переиспользование массивов ячеек (без GC pressure)
   - Быстрый queryNearest() для поиска ближайшего объекта
   - queryInRect() для viewport culling
   - Двойная буферизация: rebuild не создаёт новые массивы
   
   Размер ячейки: cellSize×cellSize px (по умолчанию 128px).
   
   API:
   • new SpatialGrid(cellSize)
   • grid.clear() — Очистить все ячейки (переиспользование)
   • grid.insert(obj) — Вставить объект (по его x, y)
   • grid.query(x, y, radius) → Object[] — Все объекты в радиусе
   • grid.queryNearest(x, y, radius) → Object|null — Ближайший объект
   • grid.queryInRect(x, y, w, h) → Object[] — Объекты в прямоугольнике
   • grid.rebuild(pool) — Перестроить из ObjectPool (все active)
   • grid.countInRadius(x, y, radius) → number — Количество в радиусе
   
   Экспорт: window.SpatialGrid
   ============================================================ */

class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize || 128;
    this.invCellSize = 1 / this.cellSize;
    this.cells = new Map();
    // Переиспользуемый пул массивов для ячеек
    this._arrayPool = [];
    // Переиспользуемый результат query
    this._queryResult = [];
  }

  /** Ключ ячейки (битовая упаковка) */
  _key(cx, cy) {
    return (cx << 16) | (cy & 0xFFFF);
  }

  /** Очистить все ячейки (возвращаем массивы в пул) */
  clear() {
    for (const arr of this.cells.values()) {
      arr.length = 0;
      this._arrayPool.push(arr);
    }
    this.cells.clear();
  }

  /** Получить массив из пула или создать новый */
  _getArray() {
    return this._arrayPool.length > 0 ? this._arrayPool.pop() : [];
  }

  /** Вставить объект в сетку по его x, y */
  insert(obj) {
    const cx = (obj.x * this.invCellSize) | 0;
    const cy = (obj.y * this.invCellSize) | 0;
    const key = this._key(cx, cy);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = this._getArray();
      this.cells.set(key, cell);
    }
    cell.push(obj);
  }

  /** Получить все объекты в окрестности (x, y, radius) */
  query(x, y, radius) {
    const results = this._queryResult;
    results.length = 0;
    const inv = this.invCellSize;
    const cxMin = ((x - radius) * inv) | 0;
    const cxMax = ((x + radius) * inv) | 0;
    const cyMin = ((y - radius) * inv) | 0;
    const cyMax = ((y + radius) * inv) | 0;
    const r2 = radius * radius;
    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const obj = cell[i];
          const dx = obj.x - x, dy = obj.y - y;
          if (dx * dx + dy * dy <= r2) {
            results.push(obj);
          }
        }
      }
    }
    return results;
  }

  /**
   * Найти ближайший объект в радиусе.
   * @param {number} x — X центра поиска
   * @param {number} y — Y центра поиска
   * @param {number} radius — Радиус поиска
   * @param {Object} [exclude] — Объект для исключения (например, сам враг)
   * @returns {Object|null} Ближайший объект или null
   */
  queryNearest(x, y, radius, exclude) {
    const inv = this.invCellSize;
    const cxMin = ((x - radius) * inv) | 0;
    const cxMax = ((x + radius) * inv) | 0;
    const cyMin = ((y - radius) * inv) | 0;
    const cyMax = ((y + radius) * inv) | 0;
    const r2 = radius * radius;
    let nearest = null;
    let nearestD2 = r2;
    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const obj = cell[i];
          if (obj === exclude) continue;
          const dx = obj.x - x, dy = obj.y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 < nearestD2) {
            nearestD2 = d2;
            nearest = obj;
          }
        }
      }
    }
    return nearest;
  }

  /**
   * Получить все объекты в прямоугольнике (для viewport culling).
   * @param {number} x — Левый верхний X
   * @param {number} y — Левый верхний Y
   * @param {number} w — Ширина
   * @param {number} h — Высота
   * @returns {Array} Массив объектов
   */
  queryInRect(x, y, w, h) {
    const results = [];
    const inv = this.invCellSize;
    const cxMin = (x * inv) | 0;
    const cxMax = ((x + w) * inv) | 0;
    const cyMin = (y * inv) | 0;
    const cyMax = ((y + h) * inv) | 0;
    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const obj = cell[i];
          if (obj.x >= x && obj.x <= x + w && obj.y >= y && obj.y <= y + h) {
            results.push(obj);
          }
        }
      }
    }
    return results;
  }

  /**
   * Подсчитать количество объектов в радиусе (без создания массива).
   * @param {number} x
   * @param {number} y
   * @param {number} radius
   * @returns {number}
   */
  countInRadius(x, y, radius) {
    const inv = this.invCellSize;
    const cxMin = ((x - radius) * inv) | 0;
    const cxMax = ((x + radius) * inv) | 0;
    const cyMin = ((y - radius) * inv) | 0;
    const cyMax = ((y + radius) * inv) | 0;
    const r2 = radius * radius;
    let count = 0;
    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cy = cyMin; cy <= cyMax; cy++) {
        const cell = this.cells.get(this._key(cx, cy));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i++) {
          const obj = cell[i];
          const dx = obj.x - x, dy = obj.y - y;
          if (dx * dx + dy * dy <= r2) count++;
        }
      }
    }
    return count;
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
