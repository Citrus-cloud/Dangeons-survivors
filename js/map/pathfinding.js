/* ============================================================
   A* PATHFINDING для умного ИИ врагов.
   Использует существующую сетку dungeon.grid.
   Кэширует пути и пересчитывает не чаще чем раз в 0.3 сек.
   ============================================================ */

const Pathfinding = {
  // Кэш открытого списка (переиспользуемый binary heap)
  _openHeap: [],
  _closedSet: null,
  _gScores: null,
  _parents: null,

  /**
   * Найти путь от (sx,sy) до (tx,ty) на сетке dungeon.grid.
   * Возвращает массив точек [{x,y}, ...] в мировых координатах или null.
   * maxNodes — ограничение итераций для производительности.
   */
  findPath(sx, sy, tx, ty, maxNodes) {
    if (!GameMap.dungeon || !GameMap.dungeon.grid) return null;
    const grid = GameMap.dungeon.grid;
    const gw = GameMap.dungeon.gridW;
    const gh = GameMap.dungeon.gridH;
    const cs = GameMap.dungeon.cellSize;

    const startI = Math.floor(sx / cs), startJ = Math.floor(sy / cs);
    const endI = Math.floor(tx / cs), endJ = Math.floor(ty / cs);

    // Граничные проверки
    if (startI < 0 || startJ < 0 || startI >= gw || startJ >= gh) return null;
    if (endI < 0 || endJ < 0 || endI >= gw || endJ >= gh) return null;
    // Если цель в стене — ищем ближайшую проходимую ячейку рядом с целью
    let goalI = endI, goalJ = endJ;
    if (grid[goalJ * gw + goalI] !== 1) {
      let found = false;
      for (let r = 1; r <= 3 && !found; r++) {
        for (let dj = -r; dj <= r && !found; dj++) {
          for (let di = -r; di <= r && !found; di++) {
            const ni = endI + di, nj = endJ + dj;
            if (ni >= 0 && nj >= 0 && ni < gw && nj < gh && grid[nj * gw + ni] === 1) {
              goalI = ni; goalJ = nj; found = true;
            }
          }
        }
      }
      if (!found) return null;
    }
    // Если старт в стене — не ищем путь
    if (grid[startJ * gw + startI] !== 1) return null;
    // Старт == цель
    if (startI === goalI && startJ === goalJ) return [];

    // A* с binary heap
    const limit = maxNodes || 200;
    const SQRT2 = 1.414;

    // Используем плоские массивы для скорости
    const size = gw * gh;
    if (!this._closedSet || this._closedSet.length < size) {
      this._closedSet = new Uint8Array(size);
      this._gScores = new Float32Array(size);
      this._parents = new Int32Array(size);
    }
    const closed = this._closedSet;
    const gScore = this._gScores;
    const parent = this._parents;
    closed.fill(0);
    gScore.fill(1e9);
    parent.fill(-1);

    // Binary heap (min-heap по fScore)
    const heap = this._openHeap;
    heap.length = 0;
    const fScores = new Float32Array(size);
    fScores.fill(1e9);

    const startIdx = startJ * gw + startI;
    const goalIdx = goalJ * gw + goalI;
    gScore[startIdx] = 0;
    fScores[startIdx] = Math.abs(goalI - startI) + Math.abs(goalJ - startJ);
    heap.push(startIdx);

    // Направления: 8 сторон
    const dirs = [
      { di: 0, dj: -1, cost: 1 }, { di: 0, dj: 1, cost: 1 },
      { di: -1, dj: 0, cost: 1 }, { di: 1, dj: 0, cost: 1 },
      { di: -1, dj: -1, cost: SQRT2 }, { di: 1, dj: -1, cost: SQRT2 },
      { di: -1, dj: 1, cost: SQRT2 }, { di: 1, dj: 1, cost: SQRT2 },
    ];

    let iterations = 0;
    while (heap.length > 0 && iterations < limit) {
      iterations++;
      // Извлекаем минимум
      let minIdx = 0;
      for (let k = 1; k < heap.length; k++) {
        if (fScores[heap[k]] < fScores[heap[minIdx]]) minIdx = k;
      }
      const current = heap[minIdx];
      heap[minIdx] = heap[heap.length - 1];
      heap.pop();

      if (current === goalIdx) {
        // Восстанавливаем путь
        return this._reconstructPath(parent, current, gw, cs);
      }

      closed[current] = 1;
      const ci = current % gw, cj = Math.floor(current / gw);

      for (const dir of dirs) {
        const ni = ci + dir.di, nj = cj + dir.dj;
        if (ni < 0 || nj < 0 || ni >= gw || nj >= gh) continue;
        const nIdx = nj * gw + ni;
        if (closed[nIdx]) continue;
        if (grid[nIdx] !== 1) continue;
        // Для диагоналей проверяем что обе смежные клетки проходимы (нет среза углов)
        if (dir.di !== 0 && dir.dj !== 0) {
          if (grid[cj * gw + ni] !== 1 || grid[nj * gw + ci] !== 1) continue;
        }

        const tentG = gScore[current] + dir.cost;
        if (tentG < gScore[nIdx]) {
          parent[nIdx] = current;
          gScore[nIdx] = tentG;
          fScores[nIdx] = tentG + Math.abs(goalI - ni) + Math.abs(goalJ - nj);
          // Добавляем в heap если ещё не там
          if (heap.indexOf(nIdx) === -1) heap.push(nIdx);
        }
      }
    }
    return null; // Путь не найден
  },

  _reconstructPath(parent, goalIdx, gw, cs) {
    const path = [];
    let cur = goalIdx;
    let count = 0;
    while (cur !== -1 && count < 500) {
      const i = cur % gw, j = Math.floor(cur / gw);
      path.push({ x: i * cs + cs * 0.5, y: j * cs + cs * 0.5 });
      cur = parent[cur];
      count++;
    }
    path.reverse();
    // Убираем первую точку (текущая позиция) если путь длинный
    if (path.length > 1) path.shift();
    return path;
  },

  /**
   * Проверить прямую видимость между двумя точками (raycast по сетке).
   * Используется чтобы определить нужен ли pathfinding.
   */
  hasLineOfSight(x1, y1, x2, y2) {
    if (!GameMap.dungeon || !GameMap.dungeon.grid) return true;
    const grid = GameMap.dungeon.grid;
    const gw = GameMap.dungeon.gridW;
    const cs = GameMap.dungeon.cellSize;

    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < cs) return true; // слишком близко — считаем видимым

    // Проверяем точки вдоль линии с шагом в половину ячейки
    const steps = Math.ceil(dist / (cs * 0.5));
    const stepX = dx / steps, stepY = dy / steps;
    for (let s = 1; s < steps; s++) {
      const px = x1 + stepX * s;
      const py = y1 + stepY * s;
      const gi = Math.floor(px / cs), gj = Math.floor(py / cs);
      if (gi < 0 || gj < 0 || gi >= gw || gj >= GameMap.dungeon.gridH) return false;
      if (grid[gj * gw + gi] !== 1) return false;
    }
    return true;
  },
};

window.Pathfinding = Pathfinding;

window.GameMap = GameMap;

'use strict';
