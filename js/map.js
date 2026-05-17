'use strict';
/* ============================================================
   map.js — карта, тайлы, камера, наземные эффекты + Шаг 5/13:
   процедурная генерация подземелья (комнаты, коридоры, ловушки,
   декор, миникарта). Шаг 13: биомы, портал, новые ловушки.
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

  /** Шаг 13: текущий биом (объект из BIOMES). */
  currentBiome: null,

  /** Шаг 13: номер текущей карты (1-based). */
  currentMapNumber: 1,

  /** Шаг 13: портал (объект или null). */
  portal: null,

  /** Шаг 13: ширина/высота текущей карты (могут отличаться от CONFIG.MAP). */
  mapW: 2000,
  mapH: 2000,

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
    cx = Utils.clamp(cx, 0, Math.max(0, this.mapW - viewW));
    cy = Utils.clamp(cy, 0, Math.max(0, this.mapH - viewH));
    return { x: cx, y: cy };
  },


  /* ============================================================
     ГЕНЕРАЦИЯ ПОДЗЕМЕЛЬЯ
     ============================================================ */

  /**
   * Сгенерировать новое подземелье. Вызывать при старте забега.
   * Шаг 13: принимает biomeId и mapNumber для бесконечного режима.
   * @param {string|number} [seedOrBiomeId] — сид (число) или biomeId (строка).
   * @param {number} [mapNumber] — номер карты (1-based), определяет сложность/размер.
   */
  generateDungeon(seedOrBiomeId, mapNumber) {
    const cfg = CONFIG.DUNGEON;
    let useSeed = cfg.SEED;
    let biome = null;

    // Шаг 13: определяем биом и номер карты
    if (typeof seedOrBiomeId === 'string') {
      // biomeId passed
      biome = BIOMES.find(b => b.id === seedOrBiomeId) || BIOMES[0];
    } else if (typeof seedOrBiomeId === 'number') {
      useSeed = seedOrBiomeId;
    }
    if (!biome) biome = BIOMES[0]; // по умолчанию — склеп
    if (!mapNumber) mapNumber = 1;

    this.currentBiome = biome;
    this.currentMapNumber = mapNumber;
    this.portal = null;

    // Шаг 13: определяем размер карты
    const mapSize = INFINITE_MODE.getMapSize(mapNumber);
    this.mapW = mapSize.w;
    this.mapH = mapSize.h;
    CONFIG.MAP.W = this.mapW;
    CONFIG.MAP.H = this.mapH;

    this.rng = (useSeed > 0) ? _mulberry32(useSeed) : Math.random;
    this.time = 0;

    // Шаг 13: кол-во комнат и ловушек по номеру карты
    const roomCounts = INFINITE_MODE.getRoomCount(mapNumber);
    const trapMul = INFINITE_MODE.getTrapMultiplier(mapNumber);

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
      // Шаг 13: ссылка на биом
      biome: biome,
      mapNumber: mapNumber,
    };

    // 1) Комнаты (Шаг 13: количество из roomCounts)
    this._generateRooms(dungeon, cfg, roomCounts);

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

    // 7) Ловушки (Шаг 13: биом-зависимые)
    this._placeTraps(dungeon, cfg, biome, trapMul);

    // 8) Декор
    this._placeDecor(dungeon, cfg);

    // 9) Соберём прямоугольники стен для отрисовки (не для коллизий —
    //    коллизии живут в grid).
    this._buildWallRects(dungeon);

    // 10) Кеш пола (Шаг 13: биом-зависимые цвета)
    this._buildFloorCache(dungeon, biome);

    this.dungeon = dungeon;
    return dungeon;
  },

  _rand(min, max) { return min + this.rng() * (max - min); },
  _randInt(min, max) { return Math.floor(this._rand(min, max + 1)); },
  _randPick(arr) { return arr[Math.floor(this.rng() * arr.length)]; },

  _generateRooms(dungeon, cfg, roomCounts) {
    const count = this._randInt(roomCounts ? roomCounts.min : cfg.ROOMS_MIN,
                                roomCounts ? roomCounts.max : cfg.ROOMS_MAX);
    const margin = 80;
    const W = this.mapW, H = this.mapH;
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
    if (x + w > this.mapW - 40) w = this.mapW - 40 - x;
    if (y + h > this.mapH - 40) h = this.mapH - 40 - y;
    if (w <= 0 || h <= 0) return;
    dungeon.corridors.push({ x, y, w, h });
  },

  _buildGrid(dungeon) {
    const cs = dungeon.cellSize;
    const gw = Math.ceil(this.mapW / cs);
    const gh = Math.ceil(this.mapH / cs);
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
        if (sy + sh > this.mapH - 60) continue;
        doorRect = { x: Math.floor(room.cx - 30), y: room.y + room.h - 4, w: 60, h: gap + 8 };
      } else if (side === 'left') {
        sx = room.x - gap - sw;
        sy = Math.floor(room.cy - sh / 2);
        if (sx < 60) continue;
        doorRect = { x: room.x - gap - 4, y: Math.floor(room.cy - 30), w: gap + 8, h: 60 };
      } else { // right
        sx = room.x + room.w + gap;
        sy = Math.floor(room.cy - sh / 2);
        if (sx + sw > this.mapW - 60) continue;
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

  _placeTraps(dungeon, cfg, biome, trapMul) {
    const traps = dungeon.traps;
    const trapTypes = biome ? biome.trapTypes : ['spike', 'fire'];
    const mul = trapMul || 1.0;

    // Шаг 13: размещаем ловушки по типам биома
    for (const trapType of trapTypes) {
      let count = 0;
      switch (trapType) {
        case 'spike':
          count = Math.round(cfg.SPIKE_TRAPS * mul);
          this._placeSpikeTrapsBatch(dungeon, count);
          break;
        case 'fire':
          count = Math.round(cfg.FIRE_TRAPS * mul);
          this._placeFireTrapsBatch(dungeon, count);
          break;
        case 'ice_spike':
          count = Math.round(4 * mul);
          this._placeIceSpikeTrapsBatch(dungeon, count);
          break;
        case 'slippery_floor':
          count = Math.round(3 * mul);
          this._placeSlipperyFloorBatch(dungeon, count);
          break;
        case 'fire_geyser':
          count = Math.round(4 * mul);
          this._placeFireGeyserBatch(dungeon, count);
          break;
        case 'rockfall':
          count = Math.round(3 * mul);
          this._placeRockfallBatch(dungeon, count);
          break;
        case 'poison_plant':
          count = Math.round(4 * mul);
          this._placePoisonPlantBatch(dungeon, count);
          break;
        case 'root_grab':
          count = Math.round(3 * mul);
          this._placeRootGrabBatch(dungeon, count);
          break;
        case 'magic_rune':
          count = Math.round(4 * mul);
          this._placeMagicRuneBatch(dungeon, count);
          break;
        case 'portrait_trap':
          count = Math.round(3 * mul);
          this._placePortraitTrapBatch(dungeon, count);
          break;
      }
    }
  },

  // Оригинальные ловушки — вынесены в batch-методы
  _placeSpikeTrapsBatch(dungeon, count) {
    let placed = 0, attempts = 0;
    while (placed < count && attempts < 200) {
      attempts++;
      const corridorOrRoom = this.rng() < 0.7
        ? this._randPick(dungeon.corridors)
        : this._randPick(dungeon.rooms.filter(r => !r.isStart && !r.isSecret));
      if (!corridorOrRoom) continue;
      const tw = CONFIG.TRAP.SPIKE.W, th = CONFIG.TRAP.SPIKE.H;
      const x = corridorOrRoom.x + this._randInt(20, Math.max(20, corridorOrRoom.w - 20 - tw));
      const y = corridorOrRoom.y + this._randInt(20, Math.max(20, corridorOrRoom.h - 20 - th));
      if (this._tooCloseToSolids(dungeon, x, y, tw, th, 16)) continue;
      if (this._tooCloseToLevers(dungeon, x, y, tw, th, 30)) continue;
      dungeon.traps.push(this._makeSpikeTrap(x, y));
      placed++;
    }
  },

  _placeFireTrapsBatch(dungeon, count) {
    let placed = 0, attempts = 0;
    while (placed < count && attempts < 200) {
      attempts++;
      const room = this._randPick(dungeon.rooms.filter(r => !r.isStart && !r.isSecret && !r.isPuzzle));
      if (!room) continue;
      const tw = CONFIG.TRAP.FIRE.W, th = CONFIG.TRAP.FIRE.H;
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
      dungeon.traps.push(this._makeFireTrap(x, y, dx, dy));
      placed++;
    }
  },

  // === Шаг 13: Новые ловушки по биомам ===

  _placeIceSpikeTrapsBatch(dungeon, count) {
    let placed = 0, attempts = 0;
    const tc = BIOME_TRAP_CONFIG.ice_spike;
    while (placed < count && attempts < 200) {
      attempts++;
      const corridorOrRoom = this.rng() < 0.7
        ? this._randPick(dungeon.corridors)
        : this._randPick(dungeon.rooms.filter(r => !r.isStart && !r.isSecret));
      if (!corridorOrRoom) continue;
      const x = corridorOrRoom.x + this._randInt(20, Math.max(20, corridorOrRoom.w - 20 - tc.W));
      const y = corridorOrRoom.y + this._randInt(20, Math.max(20, corridorOrRoom.h - 20 - tc.H));
      if (this._tooCloseToSolids(dungeon, x, y, tc.W, tc.H, 16)) continue;
      if (this._tooCloseToLevers(dungeon, x, y, tc.W, tc.H, 30)) continue;
      dungeon.traps.push({
        kind: 'ice_spike', x, y, w: tc.W, h: tc.H,
        cx: x + tc.W / 2, cy: y + tc.H / 2,
        phase: 'hidden', timer: this.rng() * tc.HIDDEN_TIME,
        damage: tc.DAMAGE, slowPct: tc.SLOW_PCT, slowDuration: tc.SLOW_DURATION,
        _struck: false,
      });
      placed++;
    }
  },

  _placeSlipperyFloorBatch(dungeon, count) {
    let placed = 0, attempts = 0;
    const tc = BIOME_TRAP_CONFIG.slippery_floor;
    while (placed < count && attempts < 150) {
      attempts++;
      const room = this._randPick(dungeon.rooms.filter(r => !r.isStart && !r.isSecret));
      if (!room || room.w < tc.W + 60 || room.h < tc.H + 60) continue;
      const x = room.x + this._randInt(30, room.w - 30 - tc.W);
      const y = room.y + this._randInt(30, room.h - 30 - tc.H);
      if (this._tooCloseToSolids(dungeon, x, y, tc.W, tc.H, 20)) continue;
      dungeon.traps.push({
        kind: 'slippery_floor', x, y, w: tc.W, h: tc.H,
        cx: x + tc.W / 2, cy: y + tc.H / 2,
        slideDuration: tc.SLIDE_DURATION, wallDamage: tc.WALL_DAMAGE,
      });
      placed++;
    }
  },

  _placeFireGeyserBatch(dungeon, count) {
    let placed = 0, attempts = 0;
    const tc = BIOME_TRAP_CONFIG.fire_geyser;
    while (placed < count && attempts < 200) {
      attempts++;
      const room = this._randPick(dungeon.rooms.filter(r => !r.isStart && !r.isSecret));
      if (!room) continue;
      const x = room.x + this._randInt(40, Math.max(40, room.w - 40 - tc.W));
      const y = room.y + this._randInt(40, Math.max(40, room.h - 40 - tc.H));
      if (this._tooCloseToSolids(dungeon, x, y, tc.W, tc.H, 20)) continue;
      dungeon.traps.push({
        kind: 'fire_geyser', x, y, w: tc.W, h: tc.H,
        cx: x + tc.W / 2, cy: y + tc.H / 2,
        phase: 'idle', timer: this.rng() * tc.COOLDOWN,
        damage: tc.DAMAGE, radius: tc.RADIUS,
        cooldown: tc.COOLDOWN, warnTime: tc.WARN_TIME, activeTime: tc.ACTIVE_TIME,
        _struck: false,
      });
      placed++;
    }
  },

  _placeRockfallBatch(dungeon, count) {
    let placed = 0, attempts = 0;
    const tc = BIOME_TRAP_CONFIG.rockfall;
    while (placed < count && attempts < 200) {
      attempts++;
      const room = this._randPick(dungeon.rooms.filter(r => !r.isStart && !r.isSecret));
      if (!room) continue;
      const x = room.x + this._randInt(40, Math.max(40, room.w - 40 - tc.W));
      const y = room.y + this._randInt(40, Math.max(40, room.h - 40 - tc.H));
      dungeon.traps.push({
        kind: 'rockfall', x, y, w: tc.W, h: tc.H,
        cx: x + tc.W / 2, cy: y + tc.H / 2,
        phase: 'idle', timer: this.rng() * tc.COOLDOWN,
        damage: tc.DAMAGE, aoeRadius: tc.AOE_RADIUS,
        cooldown: tc.COOLDOWN, warnTime: tc.WARN_TIME,
        _struck: false, _targetX: 0, _targetY: 0,
      });
      placed++;
    }
  },

  _placePoisonPlantBatch(dungeon, count) {
    let placed = 0, attempts = 0;
    const tc = BIOME_TRAP_CONFIG.poison_plant;
    while (placed < count && attempts < 200) {
      attempts++;
      const room = this._randPick(dungeon.rooms.filter(r => !r.isStart && !r.isSecret));
      if (!room) continue;
      const x = room.x + this._randInt(30, Math.max(30, room.w - 30 - tc.W));
      const y = room.y + this._randInt(30, Math.max(30, room.h - 30 - tc.H));
      if (this._tooCloseToSolids(dungeon, x, y, tc.W, tc.H, 20)) continue;
      dungeon.traps.push({
        kind: 'poison_plant', x, y, w: tc.W, h: tc.H,
        cx: x + tc.W / 2, cy: y + tc.H / 2,
        triggerRadius: tc.TRIGGER_RADIUS, cooldown: tc.COOLDOWN,
        projSpeed: tc.PROJECTILE_SPEED, projDamage: tc.PROJECTILE_DAMAGE,
        poisonDps: tc.POISON_DPS, poisonDuration: tc.POISON_DURATION,
        timer: 0,
      });
      placed++;
    }
  },

  _placeRootGrabBatch(dungeon, count) {
    let placed = 0, attempts = 0;
    const tc = BIOME_TRAP_CONFIG.root_grab;
    while (placed < count && attempts < 150) {
      attempts++;
      const room = this._randPick(dungeon.rooms.filter(r => !r.isStart && !r.isSecret));
      if (!room || room.w < tc.W + 60 || room.h < tc.H + 60) continue;
      const x = room.x + this._randInt(30, room.w - 30 - tc.W);
      const y = room.y + this._randInt(30, room.h - 30 - tc.H);
      if (this._tooCloseToSolids(dungeon, x, y, tc.W, tc.H, 20)) continue;
      dungeon.traps.push({
        kind: 'root_grab', x, y, w: tc.W, h: tc.H,
        cx: x + tc.W / 2, cy: y + tc.H / 2,
        slowPct: tc.SLOW_PCT, dps: tc.DPS,
      });
      placed++;
    }
  },

  _placeMagicRuneBatch(dungeon, count) {
    let placed = 0, attempts = 0;
    const tc = BIOME_TRAP_CONFIG.magic_rune;
    while (placed < count && attempts < 200) {
      attempts++;
      const corridorOrRoom = this.rng() < 0.5
        ? this._randPick(dungeon.corridors)
        : this._randPick(dungeon.rooms.filter(r => !r.isStart && !r.isSecret));
      if (!corridorOrRoom) continue;
      const x = corridorOrRoom.x + this._randInt(20, Math.max(20, corridorOrRoom.w - 20 - tc.W));
      const y = corridorOrRoom.y + this._randInt(20, Math.max(20, corridorOrRoom.h - 20 - tc.H));
      if (this._tooCloseToSolids(dungeon, x, y, tc.W, tc.H, 16)) continue;
      dungeon.traps.push({
        kind: 'magic_rune', x, y, w: tc.W, h: tc.H,
        cx: x + tc.W / 2, cy: y + tc.H / 2,
        damage: tc.DAMAGE, cooldown: tc.COOLDOWN,
        timer: 0, _triggered: false,
      });
      placed++;
    }
  },

  _placePortraitTrapBatch(dungeon, count) {
    let placed = 0, attempts = 0;
    const tc = BIOME_TRAP_CONFIG.portrait_trap;
    while (placed < count && attempts < 200) {
      attempts++;
      const room = this._randPick(dungeon.rooms.filter(r => !r.isStart && !r.isSecret && !r.isPuzzle));
      if (!room) continue;
      // Размещаем у стены
      const side = this._randInt(0, 3);
      let x, y;
      if (side === 0) { x = room.x + this._randInt(30, room.w - 30 - tc.W); y = room.y + 4; }
      else if (side === 1) { x = room.x + this._randInt(30, room.w - 30 - tc.W); y = room.y + room.h - tc.H - 4; }
      else if (side === 2) { x = room.x + 4; y = room.y + this._randInt(30, room.h - 30 - tc.H); }
      else { x = room.x + room.w - tc.W - 4; y = room.y + this._randInt(30, room.h - 30 - tc.H); }
      dungeon.traps.push({
        kind: 'portrait_trap', x, y, w: tc.W, h: tc.H,
        cx: x + tc.W / 2, cy: y + tc.H / 2,
        triggerRadius: tc.TRIGGER_RADIUS, cooldown: tc.COOLDOWN,
        projSpeed: tc.PROJECTILE_SPEED, projDamage: tc.PROJECTILE_DAMAGE,
        timer: 0,
      });
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

  _buildFloorCache(dungeon, biome) {
    // Кешируем целое подземелье в один offscreen canvas размером с карту.
    const off = document.createElement('canvas');
    off.width = this.mapW;
    off.height = this.mapH;
    const ctx = off.getContext('2d');

    // Шаг 13: цвета из биома
    const wallColor = biome ? biome.wallColor : '#1a1a1a';
    const corridorColor = biome ? biome.corridorColor : '#2a2a2a';
    const floorColor = biome ? biome.floorColor : '#3a3a3a';
    const floorGridColor = biome ? biome.floorGridColor : '#444444';
    const secretFloorColor = biome ? biome.secretFloorColor : '#3a3245';
    const secretGridColor = biome ? biome.secretGridColor : '#4a3f60';
    const mosaicColor = biome ? biome.mosaicColor : 'rgba(120, 90, 60, 0.35)';

    // 1) Заполняем стены (тёмный фон)
    ctx.fillStyle = wallColor;
    ctx.fillRect(0, 0, this.mapW, this.mapH);

    // 2) Коридоры (тёмный пол, без сетки)
    ctx.fillStyle = corridorColor;
    for (const c of dungeon.corridors) {
      ctx.fillRect(c.x, c.y, c.w, c.h);
    }

    // 2b) Площадка под секретной дверью
    if (dungeon.secretDoor) {
      const d = dungeon.secretDoor;
      ctx.fillStyle = secretFloorColor;
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }

    // 3) Комнаты (более светлый пол + сетка плитки)
    for (const r of dungeon.rooms) {
      // фон
      ctx.fillStyle = r.isSecret ? secretFloorColor : floorColor;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      // сетка плитки 40x40
      ctx.strokeStyle = r.isSecret ? secretGridColor : floorGridColor;
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
        ctx.strokeStyle = mosaicColor;
        ctx.lineWidth = 2;
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath();
          ctx.arc(r.x + r.w / 2, r.y + r.h / 2, 22 * k, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Диагонали
        ctx.strokeStyle = mosaicColor.replace('0.35', '0.25').replace('0.3', '0.2');
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
    if (x < 0 || y < 0 || x >= this.mapW || y >= this.mapH) return false;
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
      else if (t.kind === 'ice_spike') this._updateIceSpikeTrap(t, dt, player);
      else if (t.kind === 'slippery_floor') this._updateSlipperyFloor(t, dt, player);
      else if (t.kind === 'fire_geyser') this._updateFireGeyser(t, dt, player);
      else if (t.kind === 'rockfall') this._updateRockfall(t, dt, player);
      else if (t.kind === 'poison_plant') this._updatePoisonPlant(t, dt, player);
      else if (t.kind === 'root_grab') this._updateRootGrab(t, dt, player);
      else if (t.kind === 'magic_rune') this._updateMagicRune(t, dt, player);
      else if (t.kind === 'portrait_trap') this._updatePortraitTrap(t, dt, player);
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
          if (window.Player && Player.takeDamage) Player.takeDamage(player, c.DAMAGE, null);
          else player.hp -= c.DAMAGE;
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
          if (window.Player && Player.takeDamage) Player.takeDamage(player, c.DAMAGE, null);
          else player.hp -= c.DAMAGE;
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
    ctx.fillRect(0, 0, this.mapW, this.mapH);

    // Кешированный пол
    if (this._floorCache) {
      const sx = cam.x, sy = cam.y;
      const sw = Math.min(viewW, this.mapW - sx);
      const sh = Math.min(viewH, this.mapH - sy);
      if (sw > 0 && sh > 0) {
        ctx.drawImage(this._floorCache, sx, sy, sw, sh, sx, sy, sw, sh);
      }
    }

    if (!this.dungeon) {
      // Совместимость: если подземелье не сгенерено
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(0, 0, this.mapW, this.mapH);
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

    // Шаг 13: портал
    this.renderPortal(ctx, cam, viewW, viewH);
  },

  _isOnScreen(x, y, w, h, cam, vw, vh) {
    return !(x + w < cam.x || x > cam.x + vw || y + h < cam.y || y > cam.y + vh);
  },

  _renderPillars(ctx, cam, vw, vh) {
    const biome = this.currentBiome;
    ctx.fillStyle = biome ? biome.pillarColor : '#4a4a4a';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    const capColor = biome ? biome.pillarCapColor : '#5a5a5a';
    for (const p of this.dungeon.pillars) {
      if (!this._isOnScreen(p.x, p.y, p.w, p.h, cam, vw, vh)) continue;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeRect(p.x + 0.5, p.y + 0.5, p.w - 1, p.h - 1);
      // Светлая верхушка (имитация капители)
      ctx.fillStyle = capColor;
      ctx.fillRect(p.x - 2, p.y, p.w + 4, 4);
      ctx.fillStyle = biome ? biome.pillarColor : '#4a4a4a';
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

  _renderTorches(/* ctx, cam, vw, vh */) {
    // Декоративные факелы/огоньки отключены — визуальный мусор.
  },

  _renderTraps(ctx, cam, vw, vh) {
    const t = this.time;
    for (const tr of this.dungeon.traps) {
      if (!this._isOnScreen(tr.x - 10, tr.y - 10, tr.w + 20, tr.h + 20, cam, vw, vh)) continue;

      // Шаг 13: новые ловушки отрисовываются через _renderBiomeTrap
      if (tr.kind !== 'spike' && tr.kind !== 'fire') {
        this._renderBiomeTrap(ctx, tr);
        continue;
      }

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
    const sx = size / this.mapW;
    const sy = size / this.mapH;
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

    // Шаг 13: портал на миникарте
    if (this.portal) {
      const px = x0 + this.portal.x * sx;
      const py = y0 + this.portal.y * sy;
      ctx.fillStyle = PORTAL_CONFIG.COLOR_OUTER;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PORTAL_CONFIG.COLOR_INNER;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  },


  /* ============================================================
     Шаг 13: ПОРТАЛ
     ============================================================ */

  /** Заспавнить портал в случайной не-стартовой комнате. */
  spawnPortal() {
    if (!this.dungeon) return;
    const rooms = this.dungeon.rooms.filter(r => !r.isStart && !r.isSecret && !r.isPuzzle);
    if (rooms.length === 0) return;
    // Выбираем комнату случайно
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const pt = this.randomPointInRoom(room, PORTAL_CONFIG.RADIUS);
    if (!pt) return;
    this.portal = {
      x: pt.x,
      y: pt.y,
      radius: PORTAL_CONFIG.RADIUS,
      visualRadius: PORTAL_CONFIG.VISUAL_RADIUS,
      pulse: 0,
      active: true,
    };
    // Визуальный эффект появления
    if (window.Particles) {
      Particles.ring(pt.x, pt.y, 60, 0.5, 'rgba(155, 89, 182, 0.9)', 4);
      Particles.burst(pt.x, pt.y, 12, {
        color: '#f1c40f', speedMin: 50, speedMax: 150,
        lifeMin: 0.5, lifeMax: 1.0, sizeMin: 3, sizeMax: 5,
      });
    }
  },

  /** Проверить, входит ли игрок в портал. */
  isPlayerInPortal(player) {
    if (!this.portal || !this.portal.active || !player) return false;
    const dx = player.x - this.portal.x;
    const dy = player.y - this.portal.y;
    return (dx * dx + dy * dy) <= this.portal.radius * this.portal.radius;
  },

  /** Отрисовать портал (вызывается из render). */
  renderPortal(ctx, cam, viewW, viewH) {
    if (!this.portal || !this.portal.active) return;
    const p = this.portal;
    if (p.x + 60 < cam.x || p.x - 60 > cam.x + viewW ||
        p.y + 60 < cam.y || p.y - 60 > cam.y + viewH) return;

    const t = this.time;
    const pulseScale = 1 + Math.sin(t * PORTAL_CONFIG.PULSE_SPEED) * 0.1;
    const r = p.visualRadius * pulseScale;

    // Внешнее свечение
    ctx.save();
    ctx.shadowColor = PORTAL_CONFIG.COLOR_OUTER;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(155, 89, 182, 0.3)';
    ctx.fill();
    ctx.shadowBlur = 0;

    // Вихрь (несколько вращающихся дуг)
    ctx.strokeStyle = PORTAL_CONFIG.COLOR_OUTER;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const startAngle = t * 2 + (Math.PI / 2) * i;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.7, startAngle, startAngle + Math.PI * 0.4);
      ctx.stroke();
    }

    // Внутренний золотой круг
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(241, 196, 15, 0.6)';
    ctx.fill();
    ctx.strokeStyle = PORTAL_CONFIG.COLOR_INNER;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Символ портала
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⟐', p.x, p.y);
    ctx.restore();
  },


  /* ============================================================
     Шаг 13: Обновление новых ловушек
     ============================================================ */

  _updateIceSpikeTrap(t, dt, player) {
    const c = BIOME_TRAP_CONFIG.ice_spike;
    t.timer += dt;
    if (t.phase === 'hidden') {
      if (t.timer >= c.HIDDEN_TIME) { t.phase = 'warning'; t.timer = 0; }
    } else if (t.phase === 'warning') {
      if (t.timer >= c.WARN_TIME) { t.phase = 'active'; t.timer = 0; t._struck = false; }
    } else if (t.phase === 'active') {
      if (player && !t._struck) {
        const dx = player.x - t.cx, dy = player.y - t.cy;
        if (Math.abs(dx) <= t.w / 2 + player.size / 2 &&
            Math.abs(dy) <= t.h / 2 + player.size / 2) {
          if (window.Player && Player.takeDamage) Player.takeDamage(player, t.damage, null);
          else player.hp -= t.damage;
          // Замедление
          player._iceSlow = t.slowPct;
          player._iceSlowTimer = t.slowDuration;
          t._struck = true;
          if (window.Particles) {
            Particles.burst(player.x, player.y, 5, {
              color: '#88ccff', speedMin: 60, speedMax: 140,
              lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 3,
            });
          }
        }
      }
      if (t.timer >= c.ACTIVE_TIME) { t.phase = 'hidden'; t.timer = 0; t._struck = false; }
    }
  },

  _updateSlipperyFloor(t, dt, player) {
    if (!player) return;
    const dx = player.x - t.cx, dy = player.y - t.cy;
    if (Math.abs(dx) <= t.w / 2 + player.size / 2 &&
        Math.abs(dy) <= t.h / 2 + player.size / 2) {
      // Игрок на скользком полу: помечаем состояние скольжения
      if (!player._sliding) {
        player._sliding = true;
        player._slideTimer = t.slideDuration;
        // Направление скольжения — текущее направление движения
        const move = (window.Input && Input.getMove) ? Input.getMove() : { x: 0, y: 0 };
        player._slideDirX = move.x;
        player._slideDirY = move.y;
      }
    }
  },

  _updateFireGeyser(t, dt, player) {
    t.timer += dt;
    if (t.phase === 'idle') {
      if (t.timer >= t.cooldown - t.warnTime) { t.phase = 'warning'; t.timer = 0; }
    } else if (t.phase === 'warning') {
      if (t.timer >= t.warnTime) { t.phase = 'active'; t.timer = 0; t._struck = false; }
    } else if (t.phase === 'active') {
      if (player && !t._struck) {
        const dx = player.x - t.cx, dy = player.y - t.cy;
        if (dx * dx + dy * dy <= t.radius * t.radius) {
          if (window.Player && Player.takeDamage) Player.takeDamage(player, t.damage, null);
          else player.hp -= t.damage;
          t._struck = true;
          if (window.Particles) {
            Particles.burst(t.cx, t.cy, 8, {
              color: '#ff6600', speedMin: 80, speedMax: 200,
              lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 5,
            });
          }
        }
      }
      if (t.timer >= t.activeTime) { t.phase = 'idle'; t.timer = 0; }
    }
  },

  _updateRockfall(t, dt, player) {
    t.timer += dt;
    if (t.phase === 'idle') {
      if (t.timer >= t.cooldown) {
        t.phase = 'warning'; t.timer = 0;
        // Целевая позиция — рядом с игроком (если есть)
        if (player) {
          t._targetX = player.x + Utils.rand(-30, 30);
          t._targetY = player.y + Utils.rand(-30, 30);
        } else {
          t._targetX = t.cx; t._targetY = t.cy;
        }
      }
    } else if (t.phase === 'warning') {
      if (t.timer >= t.warnTime) {
        t.phase = 'active'; t.timer = 0; t._struck = false;
        // Урон при приземлении
        if (player) {
          const dx = player.x - t._targetX, dy = player.y - t._targetY;
          if (dx * dx + dy * dy <= t.aoeRadius * t.aoeRadius) {
            if (window.Player && Player.takeDamage) Player.takeDamage(player, t.damage, null);
            else player.hp -= t.damage;
          }
        }
        if (window.Particles) {
          Particles.burst(t._targetX, t._targetY, 6, {
            color: '#8b6914', speedMin: 40, speedMax: 100,
            lifeMin: 0.2, lifeMax: 0.4, sizeMin: 3, sizeMax: 5,
          });
        }
      }
    } else if (t.phase === 'active') {
      if (t.timer >= 0.5) { t.phase = 'idle'; t.timer = 0; }
    }
  },

  _updatePoisonPlant(t, dt, player) {
    if (t.timer > 0) { t.timer -= dt; return; }
    if (!player) return;
    const dx = player.x - t.cx, dy = player.y - t.cy;
    const dist2 = dx * dx + dy * dy;
    if (dist2 <= t.triggerRadius * t.triggerRadius) {
      // Стреляем ядовитым снарядом
      t.timer = t.cooldown;
      if (window.Game && Game.projectiles) {
        const p = Game.projectiles.spawn();
        if (p) {
          const dist = Math.sqrt(dist2) || 1;
          p.kind = 'poison_plant_bolt';
          p.owner = 'enemy';
          p.x = t.cx; p.y = t.cy;
          p.vx = (dx / dist) * t.projSpeed;
          p.vy = (dy / dist) * t.projSpeed;
          p.life = 2.0;
          p.damage = t.projDamage;
          p.radius = 5;
          p.angle = Math.atan2(dy, dx);
          p.explodeRadius = 0;
          p.source = 'poison_plant';
          p.poisonDps = t.poisonDps;
          p.poisonDuration = t.poisonDuration;
        }
      }
    }
  },

  _updateRootGrab(t, dt, player) {
    if (!player) return;
    const dx = player.x - t.cx, dy = player.y - t.cy;
    if (Math.abs(dx) <= t.w / 2 + player.size / 2 &&
        Math.abs(dy) <= t.h / 2 + player.size / 2) {
      // Замедление + урон по времени
      player._rootSlow = t.slowPct;
      player._rootSlowTimer = 0.2; // обновляется каждый кадр пока внутри
      player.hp -= t.dps * dt;
    }
  },

  _updateMagicRune(t, dt, player) {
    if (t.timer > 0) { t.timer -= dt; return; }
    if (!player) return;
    const dx = player.x - t.cx, dy = player.y - t.cy;
    if (Math.abs(dx) <= t.w / 2 + player.size / 2 &&
        Math.abs(dy) <= t.h / 2 + player.size / 2) {
      // Мгновенный урон
      const tc = BIOME_TRAP_CONFIG.magic_rune;
      if (window.Player && Player.takeDamage) Player.takeDamage(player, t.damage, null);
      else player.hp -= t.damage;
      t.timer = t.cooldown;
      // Случайный эффект
      const effect = Math.floor(Math.random() * 3);
      if (effect === 0) {
        // Отбрасывание
        const dist = Math.hypot(dx, dy) || 1;
        player.x += (dx / dist) * tc.KNOCKBACK_FORCE;
        player.y += (dy / dist) * tc.KNOCKBACK_FORCE;
      } else if (effect === 1) {
        // Замедление
        player._runeSlow = tc.SLOW_PCT;
        player._runeSlowTimer = tc.SLOW_DURATION;
      } else {
        // Молния — AoE урон
        player.hp -= tc.LIGHTNING_DAMAGE;
        if (window.Particles) {
          Particles.ring(t.cx, t.cy, tc.LIGHTNING_RADIUS, 0.3, 'rgba(100, 200, 255, 0.8)', 3);
        }
      }
      if (window.Particles) {
        Particles.burst(t.cx, t.cy, 6, {
          color: '#a259ff', speedMin: 60, speedMax: 140,
          lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
        });
      }
    }
  },

  _updatePortraitTrap(t, dt, player) {
    if (t.timer > 0) { t.timer -= dt; return; }
    if (!player) return;
    const dx = player.x - t.cx, dy = player.y - t.cy;
    const dist2 = dx * dx + dy * dy;
    if (dist2 <= t.triggerRadius * t.triggerRadius) {
      t.timer = t.cooldown;
      // Выстрел магической стрелой
      if (window.Game && Game.projectiles) {
        const p = Game.projectiles.spawn();
        if (p) {
          const dist = Math.sqrt(dist2) || 1;
          p.kind = 'portrait_bolt';
          p.owner = 'enemy';
          p.x = t.cx; p.y = t.cy;
          p.vx = (dx / dist) * t.projSpeed;
          p.vy = (dy / dist) * t.projSpeed;
          p.life = 2.0;
          p.damage = t.projDamage;
          p.radius = 5;
          p.angle = Math.atan2(dy, dx);
          p.explodeRadius = 0;
          p.source = 'portrait_trap';
        }
      }
    }
  },


  /* ============================================================
     Шаг 13: Рендер новых ловушек (вызывается из _renderTraps)
     ============================================================ */

  _renderBiomeTrap(ctx, tr) {
    const t = this.time;
    switch (tr.kind) {
      case 'ice_spike': {
        ctx.fillStyle = '#1a3a5a';
        ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
        ctx.strokeStyle = '#0a2040';
        ctx.lineWidth = 1;
        ctx.strokeRect(tr.x + 0.5, tr.y + 0.5, tr.w - 1, tr.h - 1);
        if (tr.phase === 'warning') {
          const pulse = (Math.sin(t * 30) + 1) / 2;
          ctx.fillStyle = `rgba(100, 200, 255, ${0.4 + 0.4 * pulse})`;
          ctx.fillRect(tr.x + 4, tr.y + 4, tr.w - 8, tr.h - 8);
        } else if (tr.phase === 'active') {
          ctx.fillStyle = '#88ccff';
          for (let s = 0; s < 3; s++) {
            const sx = tr.x + 6 + s * (tr.w - 12) / 2;
            ctx.beginPath();
            ctx.moveTo(sx, tr.y + tr.h - 4);
            ctx.lineTo(sx + 7, tr.y + 4);
            ctx.lineTo(sx + 14, tr.y + tr.h - 4);
            ctx.closePath();
            ctx.fill();
          }
        }
        break;
      }
      case 'slippery_floor': {
        ctx.fillStyle = 'rgba(100, 180, 240, 0.2)';
        ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
        ctx.strokeStyle = 'rgba(100, 180, 240, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(tr.x, tr.y, tr.w, tr.h);
        // Мелкие линии скольжения
        ctx.strokeStyle = 'rgba(200, 230, 255, 0.3)';
        for (let i = 0; i < 4; i++) {
          const ly = tr.y + 10 + i * 14;
          ctx.beginPath();
          ctx.moveTo(tr.x + 5, ly);
          ctx.lineTo(tr.x + tr.w - 5, ly);
          ctx.stroke();
        }
        break;
      }
      case 'fire_geyser': {
        ctx.fillStyle = '#3a1a0a';
        ctx.beginPath();
        ctx.arc(tr.cx, tr.cy, tr.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1a0a0a';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (tr.phase === 'warning') {
          const pulse = (Math.sin(t * 25) + 1) / 2;
          ctx.fillStyle = `rgba(255, 100, 30, ${0.3 + 0.4 * pulse})`;
          ctx.beginPath();
          ctx.arc(tr.cx, tr.cy, tr.w / 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (tr.phase === 'active') {
          ctx.fillStyle = 'rgba(255, 140, 30, 0.8)';
          ctx.beginPath();
          ctx.arc(tr.cx, tr.cy, tr.radius * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 220, 80, 0.6)';
          ctx.beginPath();
          ctx.arc(tr.cx, tr.cy, tr.radius * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'rockfall': {
        if (tr.phase === 'warning') {
          // Тень предупреждения
          const pulse = (Math.sin(t * 20) + 1) / 2;
          ctx.fillStyle = `rgba(60, 40, 20, ${0.3 + 0.3 * pulse})`;
          ctx.beginPath();
          ctx.arc(tr._targetX, tr._targetY, tr.aoeRadius, 0, Math.PI * 2);
          ctx.fill();
        } else if (tr.phase === 'active') {
          ctx.fillStyle = '#6b4a2a';
          ctx.beginPath();
          ctx.arc(tr._targetX, tr._targetY, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#3a2a1a';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        break;
      }
      case 'poison_plant': {
        ctx.fillStyle = '#2a6a2a';
        ctx.beginPath();
        ctx.arc(tr.cx, tr.cy, tr.w / 2, 0, Math.PI * 2);
        ctx.fill();
        // Лепестки
        ctx.fillStyle = '#4aaa4a';
        for (let i = 0; i < 5; i++) {
          const ang = (Math.PI * 2 / 5) * i + t * 0.5;
          const lx = tr.cx + Math.cos(ang) * (tr.w / 3);
          const ly = tr.cy + Math.sin(ang) * (tr.h / 3);
          ctx.beginPath();
          ctx.arc(lx, ly, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'root_grab': {
        ctx.fillStyle = 'rgba(80, 60, 30, 0.3)';
        ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
        // Корни
        ctx.strokeStyle = '#5a4020';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
          const sx = tr.x + this.rng() * tr.w;
          const sy = tr.y + this.rng() * tr.h;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + 10, sy + 5, sx + 15, sy - 3);
          ctx.stroke();
        }
        break;
      }
      case 'magic_rune': {
        const alpha = tr.timer > 0 ? 0.2 : (0.4 + Math.sin(t * 3) * 0.2);
        ctx.fillStyle = `rgba(162, 89, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(tr.cx, tr.cy, tr.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(200, 130, 255, ${alpha + 0.2})`;
        ctx.lineWidth = 1.5;
        // Pentagram-like lines
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const ang = (Math.PI * 2 / 5) * i - Math.PI / 2;
          const px = tr.cx + Math.cos(ang) * (tr.w / 2 - 4);
          const py = tr.cy + Math.sin(ang) * (tr.h / 2 - 4);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'portrait_trap': {
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
        ctx.strokeStyle = '#8a6a4a';
        ctx.lineWidth = 2;
        ctx.strokeRect(tr.x + 1, tr.y + 1, tr.w - 2, tr.h - 2);
        // Глаза
        ctx.fillStyle = tr.timer > 0 ? '#333' : '#ff3333';
        ctx.beginPath();
        ctx.arc(tr.cx - 4, tr.cy - 4, 2, 0, Math.PI * 2);
        ctx.arc(tr.cx + 4, tr.cy - 4, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
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
