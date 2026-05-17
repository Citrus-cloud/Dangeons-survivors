'use strict';
/* ============================================================
   map.js — карта, тайлы, камера, наземные эффекты + Шаг 5:
   процедурная генерация подземелья (комнаты, коридоры, ловушки,
   декор, миникарта).
   ============================================================ */

/* ============================================================
   Простой детерминированный PRNG (Mulberry32). Используется при
   ненулевом seed; иначе берём Math.random().
   ============================================================ */
function _mulberry32(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GameMap = {
  /** Совместимость со Шагом 4: пул наземных эффектов. */
  groundEffects: null,

  /** Глобальный rand-генератор для текущего забега. */
  rng: Math.random,

  /** Структура подземелья (заполняется generateDungeon). */
  dungeon: null,

  /** Тики времени (для анимаций ловушек/факелов). */
  time: 0,

  /** Кэш фоновых тайлов комнат — offscreen canvas (для производительности). */
  _floorCache: null,

  /* ============================================================
     Прекомпьют: создаёт пул эффектов. Подземелье генерируется
     отдельно (generateDungeon), уже после старта забега.
     ============================================================ */
  precompute() {
    if (!this.groundEffects) {
      this.groundEffects = new ObjectPool(createGroundEffect, CONFIG.POOLS.GROUND_EFFECTS);
    }
  },

  /** Очистить все наземные эффекты (новый забег). */
  clearGroundEffects() {
    if (this.groundEffects) this.groundEffects.clearAll();
  },

  /**
   * Заспавнить наземный эффект.
   *   kind ∈ 'slime' | 'rot' | 'fire'
   *   opts: { radius, life, slow=0..1, dps=0, color }
   */
  spawnGroundEffect(kind, x, y, opts) {
    if (!this.groundEffects) return null;
    const ge = this.groundEffects.spawn();
    if (!ge) return null;
    opts = opts || {};
    ge.kind = kind || 'slime';
    ge.x = x; ge.y = y;
    ge.radius = opts.radius || 22;
    ge.life = ge.maxLife = opts.life || 2;
    ge.slow = opts.slow || 0;
    ge.dps = opts.dps || 0;
    ge.color = opts.color || GROUND_DEFAULT_COLOR[ge.kind] || 'rgba(255,255,255,0.4)';
    return ge;
  },

  /** Найти суммарный slow-фактор (0..1) и dps по позиции игрока. */
  queryGroundAt(x, y) {
    if (!this.groundEffects) return { slow: 0, dps: 0 };
    let maxSlow = 0;
    let totalDps = 0;
    const items = this.groundEffects.items;
    for (let i = 0; i < items.length; i++) {
      const g = items[i];
      if (!g.active) continue;
      const dx = x - g.x, dy = y - g.y;
      if (dx * dx + dy * dy <= g.radius * g.radius) {
        if (g.slow > maxSlow) maxSlow = g.slow;
        totalDps += g.dps;
      }
    }
    return { slow: maxSlow, dps: totalDps };
  },

  /** Обновить наземные эффекты — таймеры жизни. */
  updateGroundEffects(dt) {
    if (!this.groundEffects) return;
    const items = this.groundEffects.items;
    for (let i = 0; i < items.length; i++) {
      const g = items[i];
      if (!g.active) continue;
      g.life -= dt;
      if (g.life <= 0) g.active = false;
    }
  },

  /** Отрисовать наземные эффекты. ctx уже сдвинут на -cam. */
  renderGroundEffects(ctx, cam, viewW, viewH) {
    if (!this.groundEffects) return;
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    const items = this.groundEffects.items;
    for (let i = 0; i < items.length; i++) {
      const g = items[i];
      if (!g.active) continue;
      if (g.x + g.radius < minX || g.x - g.radius > maxX ||
          g.y + g.radius < minY || g.y - g.radius > maxY) continue;
      const t = Math.max(0, g.life / g.maxLife);
      const pulse = (g.kind === 'fire') ? (1 + Math.sin(g.life * 8) * 0.05) : 1;
      const alpha = 0.25 + 0.55 * t;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = GROUND_OUTLINE_COLOR[g.kind] || 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },

  /** Камера, центрированная по игроку, с учётом границ карты. */
  getCamera(player, viewW, viewH) {
    let cx = player.x - viewW / 2;
    let cy = player.y - viewH / 2;
    cx = Utils.clamp(cx, 0, Math.max(0, CONFIG.MAP.W - viewW));
    cy = Utils.clamp(cy, 0, Math.max(0, CONFIG.MAP.H - viewH));
    return { x: cx, y: cy };
  },


  /* ============================================================
     ГЕНЕРАЦИЯ ПОДЗЕМЕЛЬЯ
     ============================================================ */

  /**
   * Сгенерировать новое подземелье. Вызывать при старте забега.
   * @param {number} [seed] — необязательный сид. Если не задан — берётся
   *   CONFIG.DUNGEON.SEED (если 0 — Math.random).
   */
  generateDungeon(seed) {
    const cfg = CONFIG.DUNGEON;
    const useSeed = (seed != null) ? seed : cfg.SEED;
    this.rng = (useSeed > 0) ? _mulberry32(useSeed) : Math.random;
    this.time = 0;

    const dungeon = {
      rooms: [],         // { x, y, w, h, isStart, isPuzzle, isSecret, hasMosaic }
      corridors: [],     // { x, y, w, h }
      pillars: [],       // { x, y, w, h }
      sarcophagi: [],    // { x, y, w, h }
      walls: [],         // { x, y, w, h } — собранные стены (для рендера)
      traps: [],         // Trap
      levers: [],        // { x, y, state (0/1), correct (0/1) }
      secretDoor: null,  // { x, y, w, h, open, openProgress }
      decor: {
        torches: [],     // { x, y, phase }
        runes: [],       // { x, y, color, phase }
        webs: [],        // { x, y, kind } — kind: 'tl'|'tr'|'bl'|'br'
      },
      // Сетка проходимости: 0 — стена, 1 — пол.
      grid: null,
      gridW: 0, gridH: 0,
      cellSize: cfg.GRID_CELL,
      // Стартовая комната — для размещения игрока
      startRoom: null,
      // Координата сундука внутри секретной комнаты
      secretChestPos: null,
    };

    // 1) Комнаты
    this._generateRooms(dungeon, cfg);

    // 2) Коридоры
    this._generateCorridors(dungeon, cfg);

    // 3) Сетка проходимости (пол / стена) на основе комнат и коридоров
    this._buildGrid(dungeon);

    // 4) Колонны
    this._placePillars(dungeon, cfg);

    // 5) Саркофаги
    this._placeSarcophagi(dungeon, cfg);

    // 6) Загадка (рычаги + секретная комната)
    this._placePuzzle(dungeon, cfg);

    // 7) Ловушки
    this._placeTraps(dungeon, cfg);

    // 8) Декор
    this._placeDecor(dungeon, cfg);

    // 9) Соберём прямоугольники стен для отрисовки (не для коллизий —
    //    коллизии живут в grid).
    this._buildWallRects(dungeon);

    // 10) Кеш пола
    this._buildFloorCache(dungeon);

    this.dungeon = dungeon;
    return dungeon;
  },

  _rand(min, max) { return min + this.rng() * (max - min); },
  _randInt(min, max) { return Math.floor(this._rand(min, max + 1)); },
  _randPick(arr) { return arr[Math.floor(this.rng() * arr.length)]; },

  _generateRooms(dungeon, cfg) {
    const count = this._randInt(cfg.ROOMS_MIN, cfg.ROOMS_MAX);
    const margin = 80;
    const W = CONFIG.MAP.W, H = CONFIG.MAP.H;
    let attempts = 0, maxAttempts = 600;
    while (dungeon.rooms.length < count && attempts < maxAttempts) {
      attempts += 1;
      const w = this._randInt(cfg.ROOM_W_MIN, cfg.ROOM_W_MAX);
      const h = this._randInt(cfg.ROOM_H_MIN, cfg.ROOM_H_MAX);
      const x = this._randInt(margin, W - w - margin);
      const y = this._randInt(margin, H - h - margin);
      // Проверка пересечения с другими (с padding)
      let ok = true;
      for (const r of dungeon.rooms) {
        if (this._rectsOverlap(
          x - cfg.ROOM_PADDING, y - cfg.ROOM_PADDING,
          w + cfg.ROOM_PADDING * 2, h + cfg.ROOM_PADDING * 2,
          r.x, r.y, r.w, r.h
        )) { ok = false; break; }
      }
      if (ok) {
        dungeon.rooms.push({
          x, y, w, h,
          cx: x + w / 2, cy: y + h / 2,
          isStart: false, isPuzzle: false, isSecret: false,
          hasMosaic: (w * h) >= 75000, // большие комнаты с мозаикой
        });
      }
    }
    // Гарантированный минимум — хотя бы 3 комнаты, иначе делаем "запасную".
    while (dungeon.rooms.length < 3) {
      const w = cfg.ROOM_W_MIN, h = cfg.ROOM_H_MIN;
      const x = margin + dungeon.rooms.length * (w + cfg.ROOM_PADDING + 20);
      const y = margin + 50;
      dungeon.rooms.push({
        x, y, w, h, cx: x + w / 2, cy: y + h / 2,
        isStart: false, isPuzzle: false, isSecret: false, hasMosaic: false,
      });
    }
    // Сортировка по координате (для предсказуемости коридоров)
    dungeon.rooms.sort((a, b) => (a.cx + a.cy) - (b.cx + b.cy));
    // Стартовая комната — первая
    dungeon.rooms[0].isStart = true;
    dungeon.startRoom = dungeon.rooms[0];
  },

  _rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return !(ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay);
  },

  _generateCorridors(dungeon, cfg) {
    // Соединяем по очереди: каждую комнату с предыдущей. + кольцевая связь
    // между концами цепочки для большей связности.
    const rooms = dungeon.rooms;
    for (let i = 1; i < rooms.length; i++) {
      this._connectRooms(dungeon, rooms[i - 1], rooms[i], cfg);
    }
    // Дополнительная связь: чтобы "вернуться" из дальних комнат
    if (rooms.length > 3) {
      this._connectRooms(dungeon, rooms[0], rooms[Math.floor(rooms.length / 2)], cfg);
    }
  },

  _connectRooms(dungeon, a, b, cfg) {
    const w = this._randInt(cfg.CORRIDOR_W_MIN, cfg.CORRIDOR_W_MAX);
    const halfW = Math.floor(w / 2);
    const ax = Math.floor(a.cx), ay = Math.floor(a.cy);
    const bx = Math.floor(b.cx), by = Math.floor(b.cy);

    // L-образная: горизонталь, потом вертикаль (или наоборот, выбор случайно)
    const horizontalFirst = this.rng() < 0.5;
    if (horizontalFirst) {
      this._addCorridorRect(dungeon, Math.min(ax, bx) - halfW, ay - halfW,
                            Math.abs(bx - ax) + w, w);
      this._addCorridorRect(dungeon, bx - halfW, Math.min(ay, by) - halfW,
                            w, Math.abs(by - ay) + w);
    } else {
      this._addCorridorRect(dungeon, ax - halfW, Math.min(ay, by) - halfW,
                            w, Math.abs(by - ay) + w);
      this._addCorridorRect(dungeon, Math.min(ax, bx) - halfW, by - halfW,
                            Math.abs(bx - ax) + w, w);
    }
  },

  _addCorridorRect(dungeon, x, y, w, h) {
    // Зажимаем в карту
    x = Math.max(40, x); y = Math.max(40, y);
    if (x + w > CONFIG.MAP.W - 40) w = CONFIG.MAP.W - 40 - x;
    if (y + h > CONFIG.MAP.H - 40) h = CONFIG.MAP.H - 40 - y;
    if (w <= 0 || h <= 0) return;
    dungeon.corridors.push({ x, y, w, h });
  },

  _buildGrid(dungeon) {
    const cs = dungeon.cellSize;
    const gw = Math.ceil(CONFIG.MAP.W / cs);
    const gh = Math.ceil(CONFIG.MAP.H / cs);
    const grid = new Uint8Array(gw * gh); // 0 — стена
    dungeon.grid = grid;
    dungeon.gridW = gw;
    dungeon.gridH = gh;

    // Заливаем комнаты как пол
    for (const r of dungeon.rooms) this._fillRectFloor(dungeon, r.x, r.y, r.w, r.h);
    // Коридоры — пол
    for (const c of dungeon.corridors) this._fillRectFloor(dungeon, c.x, c.y, c.w, c.h);
  },

  _fillRectFloor(dungeon, x, y, w, h) {
    const cs = dungeon.cellSize;
    const i0 = Math.max(0, Math.floor(x / cs));
    const j0 = Math.max(0, Math.floor(y / cs));
    const i1 = Math.min(dungeon.gridW - 1, Math.ceil((x + w) / cs) - 1);
    const j1 = Math.min(dungeon.gridH - 1, Math.ceil((y + h) / cs) - 1);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        dungeon.grid[j * dungeon.gridW + i] = 1;
      }
    }
  },

  /** Поставить стену (или препятствие) в одной ячейке. */
  _setCellWall(dungeon, gx, gy) {
    if (gx < 0 || gy < 0 || gx >= dungeon.gridW || gy >= dungeon.gridH) return;
    dungeon.grid[gy * dungeon.gridW + gx] = 0;
  },

  /** Закрасить прямоугольник стенами на сетке. */
  _fillRectWall(dungeon, x, y, w, h) {
    const cs = dungeon.cellSize;
    const i0 = Math.max(0, Math.floor(x / cs));
    const j0 = Math.max(0, Math.floor(y / cs));
    const i1 = Math.min(dungeon.gridW - 1, Math.ceil((x + w) / cs) - 1);
    const j1 = Math.min(dungeon.gridH - 1, Math.ceil((y + h) / cs) - 1);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        dungeon.grid[j * dungeon.gridW + i] = 0;
      }
    }
  },

  _placePillars(dungeon, cfg) {
    for (const r of dungeon.rooms) {
      if (r.isSecret) continue;
      const count = this._randInt(cfg.PILLARS_PER_ROOM_MIN, cfg.PILLARS_PER_ROOM_MAX);
      const ps = cfg.PILLAR_SIZE;
      let attempts = 0;
      let placed = 0;
      while (placed < count && attempts < 60) {
        attempts++;
        const x = r.x + this._randInt(40, r.w - 40 - ps);
        const y = r.y + this._randInt(40, r.h - 40 - ps);
        // Не вплотную к другим колоннам/саркофагам
        if (this._tooCloseToSolids(dungeon, x, y, ps, ps, 28)) continue;
        // Не на проходе коридора (центр клетки внутри коридора)
        const cx = x + ps / 2, cy = y + ps / 2;
        if (this._pointInCorridor(dungeon, cx, cy)) continue;
        const pillar = { x, y, w: ps, h: ps };
        dungeon.pillars.push(pillar);
        this._fillRectWall(dungeon, x, y, ps, ps);
        placed++;
      }
    }
  },

  _placeSarcophagi(dungeon, cfg) {
    const candidates = dungeon.rooms.filter(r => !r.isStart && !r.isSecret);
    const want = Math.min(cfg.SARCOPHAGI, candidates.length);
    for (let k = 0; k < want; k++) {
      const r = candidates[Math.floor(this.rng() * candidates.length)];
      let placed = false, attempts = 0;
      const w = 48, h = 32;
      while (!placed && attempts < 30) {
        attempts++;
        const x = r.x + this._randInt(40, r.w - 40 - w);
        const y = r.y + this._randInt(40, r.h - 40 - h);
        if (this._tooCloseToSolids(dungeon, x, y, w, h, 30)) continue;
        dungeon.sarcophagi.push({ x, y, w, h });
        this._fillRectWall(dungeon, x, y, w, h);
        placed = true;
      }
    }
  },

  _tooCloseToSolids(dungeon, x, y, w, h, gap) {
    const ax = x - gap, ay = y - gap, aw = w + gap * 2, ah = h + gap * 2;
    for (const p of dungeon.pillars) {
      if (this._rectsOverlap(ax, ay, aw, ah, p.x, p.y, p.w, p.h)) return true;
    }
    for (const s of dungeon.sarcophagi) {
      if (this._rectsOverlap(ax, ay, aw, ah, s.x, s.y, s.w, s.h)) return true;
    }
    return false;
  },

  _pointInRoom(dungeon, x, y) {
    for (const r of dungeon.rooms) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  },

  _pointInCorridor(dungeon, x, y) {
    for (const c of dungeon.corridors) {
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
    }
    return null;
  },

  /** Загадка: выбрать комнату средней по размеру (не стартовую), поставить
   *  3 рычага вдоль одной из стен и секретную комнату-нишу за решёткой. */
  _placePuzzle(dungeon, cfg) {
    const candidates = dungeon.rooms
      .filter(r => !r.isStart)
      .sort((a, b) => (a.w * a.h) - (b.w * b.h));
    if (candidates.length === 0) return;
    // Возьмём комнату из средней трети
    const idx = Math.floor(candidates.length / 2);
    const room = candidates[idx];
    room.isPuzzle = true;

    // Размещаем 3 рычага вдоль нижней стены комнаты
    const lev = CONFIG.LEVER;
    const count = lev.COUNT;
    const padX = 50;
    const slotW = (room.w - padX * 2) / count;
    const correct = [];
    for (let i = 0; i < count; i++) {
      const cx = room.x + padX + slotW * i + slotW / 2 - lev.W / 2;
      const cy = room.y + room.h - 36;
      const corr = this.rng() < 0.5 ? 1 : 0;
      correct.push(corr);
      dungeon.levers.push({
        x: cx, y: cy, w: lev.W, h: lev.H,
        state: 0, correct: corr, index: i + 1,
      });
    }
    // Гарантируем, что не все одинаковые (хоть один отличается)
    if (correct.every(v => v === correct[0])) {
      correct[0] = correct[0] === 0 ? 1 : 0;
      dungeon.levers[0].correct = correct[0];
    }
    room.puzzleCorrect = correct.slice();

    // Секретная комната — небольшая ниша, прилегающая к одной из стен
    // комнаты-загадки. Соединяется коротким коридором (за дверью).
    this._placeSecretRoom(dungeon, room, cfg);
  },

  _placeSecretRoom(dungeon, room, cfg) {
    const sw = 180, sh = 140;
    // Пробуем разные стороны
    const sides = ['top', 'right', 'bottom', 'left'];
    // Случайный порядок
    for (let i = sides.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [sides[i], sides[j]] = [sides[j], sides[i]];
    }
    for (const side of sides) {
      let sx, sy, doorRect;
      const gap = 20;
      if (side === 'top') {
        sx = Math.floor(room.cx - sw / 2);
        sy = room.y - gap - sh;
        if (sy < 60) continue;
        doorRect = { x: Math.floor(room.cx - 30), y: room.y - gap - 4, w: 60, h: gap + 8 };
      } else if (side === 'bottom') {
        sx = Math.floor(room.cx - sw / 2);
        sy = room.y + room.h + gap;
        if (sy + sh > CONFIG.MAP.H - 60) continue;
        doorRect = { x: Math.floor(room.cx - 30), y: room.y + room.h - 4, w: 60, h: gap + 8 };
      } else if (side === 'left') {
        sx = room.x - gap - sw;
        sy = Math.floor(room.cy - sh / 2);
        if (sx < 60) continue;
        doorRect = { x: room.x - gap - 4, y: Math.floor(room.cy - 30), w: gap + 8, h: 60 };
      } else { // right
        sx = room.x + room.w + gap;
        sy = Math.floor(room.cy - sh / 2);
        if (sx + sw > CONFIG.MAP.W - 60) continue;
        doorRect = { x: room.x + room.w - 4, y: Math.floor(room.cy - 30), w: gap + 8, h: 60 };
      }
      // Проверка пересечений с уже существующими комнатами
      let ok = true;
      for (const r of dungeon.rooms) {
        if (this._rectsOverlap(sx - 20, sy - 20, sw + 40, sh + 40, r.x, r.y, r.w, r.h)) {
          ok = false; break;
        }
      }
      if (!ok) continue;

      // Регистрируем секретную комнату
      const secret = {
        x: sx, y: sy, w: sw, h: sh,
        cx: sx + sw / 2, cy: sy + sh / 2,
        isStart: false, isPuzzle: false, isSecret: true, hasMosaic: false,
      };
      dungeon.rooms.push(secret);
      this._fillRectFloor(dungeon, sx, sy, sw, sh);

      // Дверь — пол с флагом "стена пока закрыта"
      this._fillRectFloor(dungeon, doorRect.x, doorRect.y, doorRect.w, doorRect.h);
      dungeon.secretDoor = {
        x: doorRect.x, y: doorRect.y, w: doorRect.w, h: doorRect.h,
        open: false, openProgress: 0,
      };
      // Пока дверь закрыта — на сетке это стена.
      this._fillRectWall(dungeon, doorRect.x, doorRect.y, doorRect.w, doorRect.h);

      // Точка для сундука — центр секретной комнаты
      dungeon.secretChestPos = { x: secret.cx, y: secret.cy };
      return;
    }
    // Если не получилось — нет секретной комнаты (сундук не появится).
  },

  _placeTraps(dungeon, cfg) {
    const traps = dungeon.traps;
    // Шипы — преимущественно в коридорах и узких местах
    let placed = 0, attempts = 0;
    while (placed < cfg.SPIKE_TRAPS && attempts < 200) {
      attempts++;
      const corridorOrRoom = this.rng() < 0.7
        ? this._randPick(dungeon.corridors)
        : this._randPick(dungeon.rooms.filter(r => !r.isStart && !r.isSecret));
      if (!corridorOrRoom) continue;
      const tw = CONFIG.TRAP.SPIKE.W, th = CONFIG.TRAP.SPIKE.H;
      const x = corridorOrRoom.x + this._randInt(20, Math.max(20, corridorOrRoom.w - 20 - tw));
      const y = corridorOrRoom.y + this._randInt(20, Math.max(20, corridorOrRoom.h - 20 - th));
      if (this._tooCloseToSolids(dungeon, x, y, tw, th, 16)) continue;
      // Не на рычагах
      if (this._tooCloseToLevers(dungeon, x, y, tw, th, 30)) continue;
      traps.push(this._makeSpikeTrap(x, y));
      placed++;
    }
    // Огненные ловушки — вдоль стен комнат
    placed = 0; attempts = 0;
    while (placed < cfg.FIRE_TRAPS && attempts < 200) {
      attempts++;
      const room = this._randPick(dungeon.rooms.filter(r => !r.isStart && !r.isSecret && !r.isPuzzle));
      if (!room) continue;
      const tw = CONFIG.TRAP.FIRE.W, th = CONFIG.TRAP.FIRE.H;
      // Возле одной из стен, направление огня — внутрь комнаты
      const side = ['top', 'bottom', 'left', 'right'][this._randInt(0, 3)];
      let x, y, dx, dy;
      const inset = 14;
      if (side === 'top') {
        x = room.x + this._randInt(40, room.w - 40 - tw);
        y = room.y + inset;
        dx = 0; dy = 1;
      } else if (side === 'bottom') {
        x = room.x + this._randInt(40, room.w - 40 - tw);
        y = room.y + room.h - inset - th;
        dx = 0; dy = -1;
      } else if (side === 'left') {
        x = room.x + inset;
        y = room.y + this._randInt(40, room.h - 40 - th);
        dx = 1; dy = 0;
      } else {
        x = room.x + room.w - inset - tw;
        y = room.y + this._randInt(40, room.h - 40 - th);
        dx = -1; dy = 0;
      }
      if (this._tooCloseToSolids(dungeon, x, y, tw, th, 24)) continue;
      traps.push(this._makeFireTrap(x, y, dx, dy));
      placed++;
    }
  },

  _tooCloseToLevers(dungeon, x, y, w, h, gap) {
    const ax = x - gap, ay = y - gap, aw = w + gap * 2, ah = h + gap * 2;
    for (const lv of dungeon.levers) {
      if (this._rectsOverlap(ax, ay, aw, ah, lv.x, lv.y, lv.w, lv.h)) return true;
    }
    return false;
  },

  _makeSpikeTrap(x, y) {
    const c = CONFIG.TRAP.SPIKE;
    return {
      kind: 'spike',
      x, y, w: c.W, h: c.H,
      cx: x + c.W / 2, cy: y + c.H / 2,
      // Цикл: hidden -> warning -> active -> hidden ...
      phase: 'hidden',
      timer: this.rng() * c.HIDDEN_TIME, // случайный сдвиг — не синхронны
      damage: c.DAMAGE,
    };
  },

  _makeFireTrap(x, y, dx, dy) {
    const c = CONFIG.TRAP.FIRE;
    return {
      kind: 'fire',
      x, y, w: c.W, h: c.H,
      cx: x + c.W / 2, cy: y + c.H / 2,
      dx, dy,                 // направление струи (один из 4)
      phase: 'idle',
      timer: this.rng() * c.INTERVAL,
      activeTime: 0.4,        // длительность струи (видимая)
      damage: c.DAMAGE,
      dotDps: c.DOT_DPS,
      dotTime: c.DOT_TIME,
      range: c.RANGE,
      width: c.WIDTH,
    };
  },

  _placeDecor(dungeon, cfg) {
    // Факелы — вдоль стен комнат и коридоров (визуально на полу у стены)
    for (const r of dungeon.rooms) {
      const spacing = cfg.TORCH_SPACING;
      // Вдоль верхней и нижней стен
      for (let xx = r.x + 30; xx < r.x + r.w - 30; xx += spacing) {
        dungeon.decor.torches.push({ x: xx, y: r.y + 14, phase: this.rng() * 6 });
        dungeon.decor.torches.push({ x: xx, y: r.y + r.h - 14, phase: this.rng() * 6 });
      }
      // Вдоль левой/правой
      for (let yy = r.y + 60; yy < r.y + r.h - 30; yy += spacing) {
        dungeon.decor.torches.push({ x: r.x + 14, y: yy, phase: this.rng() * 6 });
        dungeon.decor.torches.push({ x: r.x + r.w - 14, y: yy, phase: this.rng() * 6 });
      }
      // Руны (только в обычных комнатах)
      if (!r.isSecret) {
        const runesCount = this._randInt(3, cfg.RUNES_PER_ROOM + 1);
        for (let k = 0; k < runesCount; k++) {
          const rx = r.x + this._randInt(30, r.w - 30);
          const ry = r.y + this._randInt(30, r.h - 30);
          dungeon.decor.runes.push({
            x: rx, y: ry,
            color: this._randPick(['#a259ff', '#7e57c2', '#c47bff']),
            phase: this.rng() * 6,
          });
        }
      }
      // Паутина в углах
      if (!r.isSecret) {
        const corners = [
          { x: r.x + 4, y: r.y + 4, kind: 'tl' },
          { x: r.x + r.w - 4, y: r.y + 4, kind: 'tr' },
          { x: r.x + 4, y: r.y + r.h - 4, kind: 'bl' },
          { x: r.x + r.w - 4, y: r.y + r.h - 4, kind: 'br' },
        ];
        for (const c of corners) {
          if (this.rng() < 0.6) dungeon.decor.webs.push(c);
        }
      }
    }
    // Подсказки-руны рядом с рычагами для комнаты-загадки
    const puzzle = dungeon.rooms.find(r => r.isPuzzle);
    if (puzzle && dungeon.levers.length > 0) {
      // Рисуем над рычагами римские цифры — это будет отдельный декор
      dungeon.puzzleHints = dungeon.levers.map((lv, i) => ({
        x: lv.x + lv.w / 2,
        y: lv.y - 14,
        text: ['I', 'II', 'III'][i] || String(i + 1),
        color: '#c47bff',
      }));
    }
    // Корридорные факелы (по середине)
    for (const c of dungeon.corridors) {
      if (c.w > c.h) {
        for (let xx = c.x + 30; xx < c.x + c.w - 30; xx += cfg.TORCH_SPACING) {
          dungeon.decor.torches.push({ x: xx, y: c.y + c.h / 2, phase: this.rng() * 6 });
        }
      } else {
        for (let yy = c.y + 30; yy < c.y + c.h - 30; yy += cfg.TORCH_SPACING) {
          dungeon.decor.torches.push({ x: c.x + c.w / 2, y: yy, phase: this.rng() * 6 });
        }
      }
    }
  },

  /** Сборка прямоугольников стен — для рендера. */
  _buildWallRects(dungeon) {
    // Рамки вокруг комнат и коридоров. Для скорости — просто чёрные
    // прямоугольники, накладываемые на пол. На самом деле проще
    // отрисовать "тёмный фон" + сверху "светлый пол" комнат/коридоров.
    // Так и сделаем в render(). А walls/walls — оставим пустым, пользуемся
    // grid.
  },

  _buildFloorCache(dungeon) {
    // Кешируем целое подземелье в один offscreen canvas размером с карту.
    // Для 2000x2000 это 4 МБ — приемлемо. Это позволяет не перерисовывать
    // тайлы каждый кадр.
    const off = document.createElement('canvas');
    off.width = CONFIG.MAP.W;
    off.height = CONFIG.MAP.H;
    const ctx = off.getContext('2d');

    // 1) Заполняем стены (тёмный фон)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CONFIG.MAP.W, CONFIG.MAP.H);

    // 2) Коридоры (тёмный пол, без сетки)
    ctx.fillStyle = '#2a2a2a';
    for (const c of dungeon.corridors) {
      ctx.fillRect(c.x, c.y, c.w, c.h);
    }

    // 2b) Площадка под секретной дверью (пол тёмного цвета — будет виден,
    //     когда решётка поднимется).
    if (dungeon.secretDoor) {
      const d = dungeon.secretDoor;
      ctx.fillStyle = '#2a2230';
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }

    // 3) Комнаты (более светлый пол + сетка плитки)
    for (const r of dungeon.rooms) {
      // фон
      ctx.fillStyle = r.isSecret ? '#3a3245' : '#3a3a3a';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // сетка плитки 40x40
      ctx.strokeStyle = r.isSecret ? '#4a3f60' : '#444444';
      ctx.lineWidth = 1;
      for (let xx = r.x; xx <= r.x + r.w; xx += 40) {
        ctx.beginPath();
        ctx.moveTo(xx + 0.5, r.y);
        ctx.lineTo(xx + 0.5, r.y + r.h);
        ctx.stroke();
      }
      for (let yy = r.y; yy <= r.y + r.h; yy += 40) {
        ctx.beginPath();
        ctx.moveTo(r.x, yy + 0.5);
        ctx.lineTo(r.x + r.w, yy + 0.5);
        ctx.stroke();
      }
      // Мозаика в больших комнатах — концентрические круги по центру
      if (r.hasMosaic && !r.isSecret) {
        ctx.strokeStyle = 'rgba(120, 90, 60, 0.35)';
        ctx.lineWidth = 2;
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath();
          ctx.arc(r.x + r.w / 2, r.y + r.h / 2, 22 * k, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Диагонали
        ctx.strokeStyle = 'rgba(140, 100, 60, 0.25)';
        ctx.beginPath();
        ctx.moveTo(r.x + r.w / 2 - 60, r.y + r.h / 2 - 60);
        ctx.lineTo(r.x + r.w / 2 + 60, r.y + r.h / 2 + 60);
        ctx.moveTo(r.x + r.w / 2 - 60, r.y + r.h / 2 + 60);
        ctx.lineTo(r.x + r.w / 2 + 60, r.y + r.h / 2 - 60);
        ctx.stroke();
      }
      // Тёмная окантовка комнаты
      ctx.strokeStyle = '#0e0e0e';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }

    this._floorCache = off;
  },


  /* ============================================================
     Walkability / collisions
     ============================================================ */

  /**
   * Может ли точка (x, y) находиться на проходимом полу?
   * Учитывает стены, колонны, закрытые двери. Объект-сущность
   * проверяется как точка центра — у вызывающих стороны должны
   * проверять "свой" контур через вспомогательный _rectIsWalkable.
   */
  isWalkable(x, y) {
    if (!this.dungeon) return true;
    if (x < 0 || y < 0 || x >= CONFIG.MAP.W || y >= CONFIG.MAP.H) return false;
    const cs = this.dungeon.cellSize;
    const i = Math.floor(x / cs), j = Math.floor(y / cs);
    if (i < 0 || j < 0 || i >= this.dungeon.gridW || j >= this.dungeon.gridH) return false;
    return this.dungeon.grid[j * this.dungeon.gridW + i] === 1;
  },

  /** Проверка, что прямоугольник (cx-rad..cx+rad) полностью на полу.
   *  Используется для движения сущностей. rad — половина ширины квадрата. */
  rectIsWalkable(cx, cy, rad) {
    if (!this.dungeon) return true;
    return this.isWalkable(cx - rad, cy - rad) &&
           this.isWalkable(cx + rad, cy - rad) &&
           this.isWalkable(cx - rad, cy + rad) &&
           this.isWalkable(cx + rad, cy + rad) &&
           this.isWalkable(cx, cy);
  },

  /**
   * Двинуть сущность по (dx, dy) с раздельной проверкой осей.
   * Если упёрлись — позволяет скользить вдоль стен.
   * Возвращает { x, y, blockedX, blockedY }.
   */
  moveWithCollision(x, y, dx, dy, rad) {
    if (!this.dungeon) return { x: x + dx, y: y + dy, blockedX: false, blockedY: false };
    let nx = x, ny = y;
    let blockedX = false, blockedY = false;
    if (dx !== 0) {
      const tryX = x + dx;
      if (this.rectIsWalkable(tryX, y, rad)) nx = tryX;
      else {
        // Попробуем доехать до стены маленькими шагами
        const sign = Math.sign(dx);
        let stepped = 0;
        const stepSize = 1;
        while (Math.abs(stepped) < Math.abs(dx)) {
          const next = stepped + sign * stepSize;
          if (this.rectIsWalkable(x + next, y, rad)) stepped = next;
          else break;
        }
        nx = x + stepped;
        blockedX = true;
      }
    }
    if (dy !== 0) {
      const tryY = ny + dy;
      if (this.rectIsWalkable(nx, tryY, rad)) ny = tryY;
      else {
        const sign = Math.sign(dy);
        let stepped = 0;
        const stepSize = 1;
        while (Math.abs(stepped) < Math.abs(dy)) {
          const next = stepped + sign * stepSize;
          if (this.rectIsWalkable(nx, ny + next, rad)) stepped = next;
          else break;
        }
        ny = ny + stepped;
        blockedY = true;
      }
    }
    return { x: nx, y: ny, blockedX, blockedY };
  },

  /** Случайная проходимая точка внутри комнаты (или null). */
  randomPointInRoom(room, rad) {
    rad = rad || 16;
    if (!room) return null;
    for (let i = 0; i < 30; i++) {
      const x = room.x + 20 + this.rng() * (room.w - 40);
      const y = room.y + 20 + this.rng() * (room.h - 40);
      if (this.rectIsWalkable(x, y, rad)) return { x, y };
    }
    return { x: room.x + room.w / 2, y: room.y + room.h / 2 };
  },

  /** Случайная точка в любой не-секретной комнате — для волн врагов. */
  randomEnemySpawnPoint(player, minDist, maxDist) {
    if (!this.dungeon) return null;
    const rooms = this.dungeon.rooms.filter(r => !r.isSecret);
    if (rooms.length === 0) return null;
    for (let i = 0; i < 40; i++) {
      const r = rooms[Math.floor(this.rng() * rooms.length)];
      const x = r.x + 20 + this.rng() * (r.w - 40);
      const y = r.y + 20 + this.rng() * (r.h - 40);
      const d = Math.hypot(x - player.x, y - player.y);
      if (d >= minDist && d <= maxDist && this.rectIsWalkable(x, y, 16)) {
        return { x, y };
      }
    }
    // fallback — любая проходимая точка в случайной комнате
    const r = rooms[Math.floor(this.rng() * rooms.length)];
    return this.randomPointInRoom(r, 16);
  },


  /* ============================================================
     Loop tick — обновление ловушек и анимаций
     ============================================================ */

  update(dt) {
    this.time += dt;
    if (!this.dungeon) return;
    const player = (window.Game && Game.player) ? Game.player : null;

    // Ловушки
    const traps = this.dungeon.traps;
    for (let i = 0; i < traps.length; i++) {
      const t = traps[i];
      if (t.kind === 'spike') this._updateSpikeTrap(t, dt, player);
      else if (t.kind === 'fire') this._updateFireTrap(t, dt, player);
    }

    // Кулдауны рычагов
    if (this.dungeon.levers) {
      for (const lv of this.dungeon.levers) {
        if (lv._cooldown > 0) lv._cooldown = Math.max(0, lv._cooldown - dt);
      }
    }

    // Дверь (анимация открытия)
    const door = this.dungeon.secretDoor;
    if (door && door.open && door.openProgress < 1) {
      door.openProgress = Math.min(1, door.openProgress + dt * 1.5);
      if (!door._gridCleared) {
        this._fillRectFloor(this.dungeon, door.x, door.y, door.w, door.h);
        door._gridCleared = true;
      }
    }
  },

  _updateSpikeTrap(t, dt, player) {
    const c = CONFIG.TRAP.SPIKE;
    t.timer += dt;
    // Жизненный цикл: hidden -> warning -> active -> hidden
    if (t.phase === 'hidden') {
      if (t.timer >= c.HIDDEN_TIME) {
        t.phase = 'warning'; t.timer = 0;
      }
    } else if (t.phase === 'warning') {
      if (t.timer >= c.WARN_TIME) {
        t.phase = 'active'; t.timer = 0;
      }
    } else if (t.phase === 'active') {
      // Урон если игрок в зоне (только в момент перехода и непрерывно с
      // hitInterval-подобной задержкой — для простоты, один раз за фазу)
      if (player && !t._struck) {
        const dx = player.x - t.cx, dy = player.y - t.cy;
        if (Math.abs(dx) <= t.w / 2 + player.size / 2 &&
            Math.abs(dy) <= t.h / 2 + player.size / 2) {
          player.hp -= c.DAMAGE;
          t._struck = true;
          if (window.Particles) {
            Particles.burst(player.x, player.y, 5, {
              color: '#c0392b', speedMin: 60, speedMax: 140,
              lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 3,
            });
          }
        }
      }
      if (t.timer >= c.ACTIVE_TIME) {
        t.phase = 'hidden'; t.timer = 0; t._struck = false;
      }
    }
  },

  _updateFireTrap(t, dt, player) {
    const c = CONFIG.TRAP.FIRE;
    t.timer += dt;
    if (t.phase === 'idle') {
      if (t.timer >= c.INTERVAL - c.WARN_TIME) {
        t.phase = 'warning'; t.timer = 0;
      }
    } else if (t.phase === 'warning') {
      if (t.timer >= c.WARN_TIME) {
        t.phase = 'active'; t.timer = 0;
        t._struck = false;
        // Создаём горящий ground effect в зоне струи (поджигание)
        if (window.GameMap) {
          // Несколько кружков вдоль направления
          const steps = Math.floor(t.range / 30);
          for (let s = 1; s <= steps; s++) {
            const px = t.cx + t.dx * 30 * s;
            const py = t.cy + t.dy * 30 * s;
            this.spawnGroundEffect('fire', px, py, {
              radius: 22, life: c.DOT_TIME, dps: c.DOT_DPS,
              color: 'rgba(255, 120, 30, 0.55)',
            });
          }
        }
      }
    } else if (t.phase === 'active') {
      // Прямой контакт со струёй — мгновенный урон один раз
      if (player && !t._struck) {
        if (this._pointInFireBeam(player.x, player.y, t)) {
          player.hp -= c.DAMAGE;
          t._struck = true;
        }
      }
      if (t.timer >= t.activeTime) {
        t.phase = 'idle'; t.timer = 0;
      }
    }
  },

  _pointInFireBeam(px, py, t) {
    // Снимаем координату вдоль направления и поперёк
    const lx = px - t.cx;
    const ly = py - t.cy;
    const along = lx * t.dx + ly * t.dy;
    const across = lx * (-t.dy) + ly * t.dx;
    return along >= 0 && along <= t.range &&
           Math.abs(across) <= t.width / 2;
  },

  /* ============================================================
     Levers / puzzle
     ============================================================ */

  /**
   * Проверить, не активирует ли игрок рычаг (по касанию).
   * Если да — переключаем состояние и проверяем комбинацию.
   * Возвращает событие: 'toggle' | 'solved' | 'reset' | null.
   */
  tryToggleLever(player) {
    if (!this.dungeon || !player) return null;
    const lev = CONFIG.LEVER;
    let event = null;
    for (const lv of this.dungeon.levers) {
      const cx = lv.x + lv.w / 2, cy = lv.y + lv.h / 2;
      const dx = cx - player.x, dy = cy - player.y;
      const r = lev.INTERACT_RADIUS + player.size / 2;
      if (dx * dx + dy * dy <= r * r) {
        if (!lv._cooldown) lv._cooldown = 0;
        if (lv._cooldown > 0) continue;
        lv.state = lv.state === 0 ? 1 : 0;
        lv._cooldown = 1.0;
        event = 'toggle';
        if (window.Particles) {
          Particles.spark(cx, cy - 4, 0, -40, 0.4, '#ffd84a', 3);
        }
      }
    }
    if (event === 'toggle') {
      const ok = this._checkPuzzleSolved();
      if (ok) {
        this._openSecretDoor();
        event = 'solved';
      } else if (this._allLeversFlipped()) {
        this._scheduleResetIfWrong();
      }
    }
    return event;
  },

  _checkPuzzleSolved() {
    if (!this.dungeon || !this.dungeon.levers) return false;
    for (const lv of this.dungeon.levers) {
      if (lv.state !== lv.correct) return false;
    }
    return true;
  },

  _allLeversFlipped() {
    if (!this.dungeon || !this.dungeon.levers) return false;
    for (const lv of this.dungeon.levers) {
      if (lv.state === 0) return false;
    }
    return true;
  },

  _scheduleResetIfWrong() {
    if (!this.dungeon || this.dungeon._resetTimer) return;
    const targetDungeon = this.dungeon;  // фиксируем ссылку для замыкания
    this.dungeon._resetTimer = setTimeout(() => {
      // Если за это время подземелье было перегенерировано — игнорируем
      if (this.dungeon !== targetDungeon) return;
      this.dungeon._resetTimer = null;
      if (!this._checkPuzzleSolved()) {
        for (const lv of this.dungeon.levers) lv.state = 0;
        if (window.Particles) {
          for (const lv of this.dungeon.levers) {
            Particles.burst(lv.x + lv.w / 2, lv.y + lv.h / 2, 4, {
              color: '#c0392b', speedMin: 30, speedMax: 90,
              lifeMin: 0.3, lifeMax: 0.5,
            });
          }
        }
      }
    }, CONFIG.LEVER.RESET_DELAY * 1000);
  },

  _openSecretDoor() {
    const door = this.dungeon.secretDoor;
    if (!door || door.open) return;
    door.open = true;
    door.openProgress = 0;
    if (window.Particles) {
      Particles.ring(door.x + door.w / 2, door.y + door.h / 2, 80, 0.5,
        'rgba(255, 215, 80, 0.85)', 4);
      Particles.text(door.x + door.w / 2, door.y - 16,
        'СЕКРЕТНАЯ КОМНАТА ОТКРЫТА', 1.6, '#ffd84a', 14);
    }
    // Спавним сундук в секретной комнате (через main.js)
    if (window.Game && Game.spawnSecretChest) Game.spawnSecretChest();
  },


  /* ============================================================
     RENDER
     ============================================================ */

  /** Отрисовать пол + декор. ctx уже сдвинут на -cam. */
  render(ctx, cam, viewW, viewH) {
    // Фон карты — почти чёрный (стены)
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(0, 0, CONFIG.MAP.W, CONFIG.MAP.H);

    // Кешированный пол
    if (this._floorCache) {
      const sx = cam.x, sy = cam.y;
      const sw = Math.min(viewW, CONFIG.MAP.W - sx);
      const sh = Math.min(viewH, CONFIG.MAP.H - sy);
      if (sw > 0 && sh > 0) {
        ctx.drawImage(this._floorCache, sx, sy, sw, sh, sx, sy, sw, sh);
      }
    }

    if (!this.dungeon) {
      // Совместимость: если подземелье не сгенерено
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, CONFIG.MAP.W, CONFIG.MAP.H);
      return;
    }

    // Декор: руны на полу
    this._renderRunes(ctx, cam, viewW, viewH);

    // Декор: мозаичные элементы рисуются в _floorCache, тут пропускаем

    // Двери секретной комнаты (если есть)
    this._renderSecretDoor(ctx);

    // Колонны и саркофаги
    this._renderPillars(ctx, cam, viewW, viewH);
    this._renderSarcophagi(ctx, cam, viewW, viewH);

    // Декор: паутина
    this._renderWebs(ctx, cam, viewW, viewH);

    // Рычаги
    this._renderLevers(ctx);

    // Ловушки (под факелами, чтобы факелы перекрывали)
    this._renderTraps(ctx, cam, viewW, viewH);

    // Декор: факелы (с пульсирующим свечением)
    this._renderTorches(ctx, cam, viewW, viewH);

    // Подсказки рунами над рычагами
    if (this.dungeon.puzzleHints) {
      ctx.font = 'bold 14px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const h of this.dungeon.puzzleHints) {
        ctx.fillStyle = h.color;
        ctx.fillText(h.text, h.x, h.y);
      }
    }
  },

  _isOnScreen(x, y, w, h, cam, vw, vh) {
    return !(x + w < cam.x || x > cam.x + vw || y + h < cam.y || y > cam.y + vh);
  },

  _renderPillars(ctx, cam, vw, vh) {
    ctx.fillStyle = '#4a4a4a';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    for (const p of this.dungeon.pillars) {
      if (!this._isOnScreen(p.x, p.y, p.w, p.h, cam, vw, vh)) continue;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      // Светлая верхушка (имитация капители)
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(p.x - 2, p.y, p.w + 4, 4);
      ctx.fillStyle = '#4a4a4a';
    }
  },

  _renderSarcophagi(ctx, cam, vw, vh) {
    for (const s of this.dungeon.sarcophagi) {
      if (!this._isOnScreen(s.x, s.y, s.w, s.h, cam, vw, vh)) continue;
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
      // Крест
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(s.x + s.w / 2 - 2, s.y + 4, 4, s.h - 8);
      ctx.fillRect(s.x + s.w / 2 - 8, s.y + s.h / 2 - 2, 16, 4);
    }
  },

  _renderRunes(/* ctx, cam, vw, vh */) {
    // Декоративные мерцающие руны отключены — визуальный мусор (Шаг 7).
  },

  _renderWebs(ctx, cam, vw, vh) {
    ctx.strokeStyle = 'rgba(220, 220, 220, 0.25)';
    ctx.lineWidth = 1;
    for (const w of this.dungeon.decor.webs) {
      if (w.x < cam.x - 20 || w.x > cam.x + vw + 20 ||
          w.y < cam.y - 20 || w.y > cam.y + vh + 20) continue;
      const k = w.kind;
      const sx = (k === 'tr' || k === 'br') ? -1 : 1;
      const sy = (k === 'bl' || k === 'br') ? -1 : 1;
      ctx.beginPath();
      // Несколько коротких линий из угла
      for (let i = 0; i < 4; i++) {
        const len = 14 + i * 3;
        const ang = (Math.PI / 2) * (i / 3);
        ctx.moveTo(w.x, w.y);
        ctx.lineTo(w.x + sx * Math.cos(ang) * len, w.y + sy * Math.sin(ang) * len);
      }
      ctx.stroke();
    }
  },

  _renderTorches(ctx, cam, vw, vh) {
    const t = this.time;
    for (const f of this.dungeon.decor.torches) {
      if (f.x < cam.x - 20 || f.x > cam.x + vw + 20 ||
          f.y < cam.y - 20 || f.y > cam.y + vh + 20) continue;
      const flicker = 0.85 + 0.15 * Math.sin(t * 7 + f.phase) +
                      0.05 * Math.sin(t * 13 + f.phase * 1.7);
      const r = 4 + 1.5 * Math.sin(t * 5 + f.phase);
      // Свечение
      ctx.shadowColor = 'rgba(255, 160, 60, 0.7)';
      ctx.shadowBlur = 14 * flicker;
      ctx.fillStyle = 'rgba(255, 180, 80, ' + (0.85 * flicker) + ')';
      ctx.beginPath();
      ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Сердцевина
      ctx.fillStyle = '#fff5b8';
      ctx.beginPath();
      ctx.arc(f.x, f.y, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  _renderTraps(ctx, cam, vw, vh) {
    const t = this.time;
    for (const tr of this.dungeon.traps) {
      if (!this._isOnScreen(tr.x - 10, tr.y - 10, tr.w + 20, tr.h + 20, cam, vw, vh)) continue;
      if (tr.kind === 'spike') {
        // База: тёмная плита
        ctx.fillStyle = '#222';
        ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
        ctx.strokeStyle = '#0a0a0a';
        ctx.lineWidth = 1;
        ctx.strokeRect(tr.x + 0.5, tr.y + 0.5, tr.w - 1, tr.h - 1);

        let height = 0;
        let color = '#8a8a8a';
        if (tr.phase === 'hidden') {
          height = 0;
        } else if (tr.phase === 'warning') {
          height = 4;
          // Мерцание
          const pulse = (Math.sin(t * 30) + 1) / 2;
          color = 'rgba(255, 200, 60, ' + (0.5 + 0.4 * pulse) + ')';
        } else if (tr.phase === 'active') {
          height = 14;
          color = '#c8c8c8';
        }
        if (height > 0) {
          ctx.fillStyle = color;
          // 3 треугольника
          for (let s = 0; s < 3; s++) {
            const sx = tr.x + 6 + s * (tr.w - 12) / 2;
            ctx.beginPath();
            ctx.moveTo(sx, tr.y + tr.h - 4);
            ctx.lineTo(sx + 7, tr.y + tr.h - 4 - height);
            ctx.lineTo(sx + 14, tr.y + tr.h - 4);
            ctx.closePath();
            ctx.fill();
          }
        }
      } else if (tr.kind === 'fire') {
        // Решётка-источник (на стене)
        ctx.fillStyle = '#3a2a18';
        ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
        ctx.strokeStyle = '#0a0a0a';
        ctx.lineWidth = 1;
        ctx.strokeRect(tr.x + 0.5, tr.y + 0.5, tr.w - 1, tr.h - 1);
        // Прутья
        ctx.fillStyle = '#1a1a1a';
        for (let s = 0; s < 4; s++) {
          ctx.fillRect(tr.x + 4 + s * 7, tr.y + 4, 2, tr.h - 8);
        }
        // Эффекты по фазе
        if (tr.phase === 'warning') {
          const pulse = (Math.sin(t * 25) + 1) / 2;
          // Искры на источнике
          ctx.fillStyle = 'rgba(255, 200, 60, ' + (0.4 + 0.4 * pulse) + ')';
          for (let s = 0; s < 4; s++) {
            const sx = tr.cx + Math.cos(s) * 4;
            const sy = tr.cy + Math.sin(s) * 4;
            ctx.beginPath();
            ctx.arc(sx, sy, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (tr.phase === 'active') {
          // Струя огня
          const beamLen = tr.range;
          const beamW = tr.width;
          ctx.save();
          ctx.translate(tr.cx, tr.cy);
          const ang = Math.atan2(tr.dy, tr.dx);
          ctx.rotate(ang);
          // Внешний слой (оранжевый)
          ctx.fillStyle = 'rgba(255, 100, 30, 0.7)';
          ctx.fillRect(0, -beamW / 2, beamLen, beamW);
          // Внутренний (жёлтый)
          ctx.fillStyle = 'rgba(255, 220, 100, 0.65)';
          ctx.fillRect(0, -beamW / 4, beamLen, beamW / 2);
          // Сердцевина
          ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
          ctx.fillRect(0, -beamW / 8, beamLen, beamW / 4);
          ctx.restore();
        }
      }
    }
  },

  _renderLevers(ctx) {
    if (!this.dungeon || !this.dungeon.levers) return;
    for (const lv of this.dungeon.levers) {
      // Постамент
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(lv.x - 2, lv.y + lv.h - 6, lv.w + 4, 6);
      // Корпус
      ctx.fillStyle = lv.state === 1 ? '#ffd84a' : '#888';
      ctx.fillRect(lv.x, lv.y, lv.w, lv.h);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      ctx.strokeRect(lv.x + 0.5, lv.y + 0.5, lv.w - 1, lv.h - 1);
      // Рычажок
      ctx.strokeStyle = lv.state === 1 ? '#fff5b8' : '#cccccc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const cx = lv.x + lv.w / 2;
      const cy = lv.y + lv.h / 2;
      if (lv.state === 1) {
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + 6, cy - 8);
      } else {
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - 6, cy - 8);
      }
      ctx.stroke();
    }
  },

  _renderSecretDoor(ctx) {
    const door = this.dungeon.secretDoor;
    if (!door) return;
    if (door.open && door.openProgress >= 1) return; // полностью открыта — не рисуем
    const openH = door.h * (1 - door.openProgress);
    const openW = door.w * (1 - door.openProgress);
    let dx = door.x, dy = door.y, dw = door.w, dh = door.h;
    // Решётка "поднимается" — уменьшаем по соответствующей оси
    if (door.w >= door.h) {
      dh = openH;
    } else {
      dw = openW;
    }
    // Корпус
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(dx, dy, dw, dh);
    // Прутья
    ctx.strokeStyle = '#5a4a3a';
    ctx.lineWidth = 2;
    if (door.w >= door.h) {
      for (let i = 4; i < dw; i += 8) {
        ctx.beginPath();
        ctx.moveTo(dx + i, dy);
        ctx.lineTo(dx + i, dy + dh);
        ctx.stroke();
      }
    } else {
      for (let i = 4; i < dh; i += 8) {
        ctx.beginPath();
        ctx.moveTo(dx, dy + i);
        ctx.lineTo(dx + dw, dy + i);
        ctx.stroke();
      }
    }
  },


  /* ============================================================
     Minimap
     ============================================================ */

  /** Отрисовать миникарту в правом нижнем углу. ctx БЕЗ сдвига. */
  renderMinimap(ctx, player, viewW, viewH) {
    if (!this.dungeon) return;
    const size = 120;
    const margin = 12;
    const x0 = viewW - size - margin;
    const y0 = viewH - size - margin;
    const sx = size / CONFIG.MAP.W;
    const sy = size / CONFIG.MAP.H;
    // Фон
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(x0, y0, size, size);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, size - 1, size - 1);
    // Коридоры
    ctx.fillStyle = 'rgba(80, 80, 80, 0.9)';
    for (const c of this.dungeon.corridors) {
      ctx.fillRect(x0 + c.x * sx, y0 + c.y * sy, c.w * sx, c.h * sy);
    }
    // Комнаты
    for (const r of this.dungeon.rooms) {
      if (r.isSecret) {
        // Видна только если открыта
        const door = this.dungeon.secretDoor;
        if (!door || !door.open) continue;
        ctx.fillStyle = 'rgba(255, 215, 80, 0.7)';
      } else if (r.isPuzzle) {
        ctx.fillStyle = 'rgba(160, 80, 220, 0.7)';
      } else if (r.isStart) {
        ctx.fillStyle = 'rgba(60, 200, 100, 0.65)';
      } else {
        ctx.fillStyle = 'rgba(160, 160, 160, 0.7)';
      }
      ctx.fillRect(x0 + r.x * sx, y0 + r.y * sy, r.w * sx, r.h * sy);
    }
    // Сундук (обычный)
    if (window.Game && Game.chest) {
      ctx.fillStyle = '#ffd84a';
      ctx.fillRect(
        x0 + Game.chest.x * sx - 2, y0 + Game.chest.y * sy - 2, 4, 4
      );
    }
    if (window.Game && Game.secretChest) {
      ctx.fillStyle = '#ffe48a';
      ctx.fillRect(
        x0 + Game.secretChest.x * sx - 2, y0 + Game.secretChest.y * sy - 2, 4, 4
      );
    }
    // Игрок
    if (player) {
      ctx.fillStyle = '#2980d9';
      ctx.fillRect(
        x0 + player.x * sx - 2.5, y0 + player.y * sy - 2.5, 5, 5
      );
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        x0 + player.x * sx - 2.5, y0 + player.y * sy - 2.5, 5, 5
      );
    }
  },
};


/* ============================================================
   GroundEffect — пул-объект для луж/следов (Шаг 4).
   ============================================================ */
function createGroundEffect() {
  return {
    active: false,
    kind: 'slime',
    x: 0, y: 0,
    radius: 22,
    life: 0, maxLife: 0,
    slow: 0,
    dps: 0,
    color: 'rgba(255,160,60,0.45)',
  };
}

const GROUND_DEFAULT_COLOR = {
  slime: 'rgba(255, 160, 60, 0.45)',
  rot:   'rgba(120, 200, 100, 0.45)',
  fire:  'rgba(255, 120, 30, 0.55)',
};
const GROUND_OUTLINE_COLOR = {
  slime: 'rgba(255, 200, 130, 0.7)',
  rot:   'rgba(180, 240, 160, 0.7)',
  fire:  'rgba(255, 220, 130, 0.9)',
};

window.createGroundEffect = createGroundEffect;
window.GameMap = GameMap;
