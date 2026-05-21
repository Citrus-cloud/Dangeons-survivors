'use strict';
/* ============================================================
   spatial-grid.js — Пространственная сетка для быстрого поиска.
   
   Назначение:
   Ускоряет поиск ближайших объектов (враги, снаряды) путём
   деления карты на ячейки фиксированного размера.
   Вместо проверки ВСЕХ объектов — проверяем только объекты
   в соседних ячейках (O(k) вместо O(n)).
   
   Размер ячейки: cellSize×cellSize px (по умолчанию 128px).
   
   API:
   • new SpatialGrid(cellSize)
   • grid.clear() — Очистить все ячейки
   • grid.insert(obj) — Вставить объект (по его x, y)
   • grid.query(x, y, radius) → Object[] — Найти все объекты в радиусе
   • grid.rebuild(pool) — Перестроить из ObjectPool (все active)
   
   Экспорт: window.SpatialGrid
   ============================================================ */

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
