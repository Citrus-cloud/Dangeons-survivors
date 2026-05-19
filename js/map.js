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

    // Шаг 17: размещаем новые загадки и ловушки
    const isCampaign = !!(window.Campaign && Campaign.active);
    if (GameMap._placeStep17Objects) {
      GameMap._placeStep17Objects(dungeon, mapNumber, isCampaign);
    }

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
        // Половинная коллизия для колонн: только центральная 50% площадь
        const inset = Math.floor(ps * 0.25);
        this._fillRectWall(dungeon, x + inset, y + inset, ps - inset * 2, ps - inset * 2);
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

    // === Богатый декор по биомам (D&D стиль) ===
    if (!dungeon.decor.biomeDecor) dungeon.decor.biomeDecor = [];
    const biomeId = dungeon.biome ? dungeon.biome.id : 'crypt';
    this._placeBiomeDecor(dungeon, biomeId);
  },

  /** Размещение декоративных объектов в зависимости от биома. */
  _placeBiomeDecor(dungeon, biomeId) {
    const decor = dungeon.decor.biomeDecor;
    const rooms = dungeon.rooms.filter(r => !r.isSecret);

    for (const room of rooms) {
      if (room.isStart && this.rng() > 0.5) continue; // меньше декора в стартовой
      const area = room.w * room.h;
      const decorCount = Math.max(2, Math.floor(area / 8000));

      for (let d = 0; d < decorCount; d++) {
        const decorItem = this._generateBiomeDecorItem(biomeId, room);
        if (decorItem) {
          // Проверяем что не перекрывает рычаги/ловушки
          if (!this._tooCloseToLevers(dungeon, decorItem.x - 8, decorItem.y - 8, 16, 16, 20)) {
            decor.push(decorItem);
          }
        }
      }
    }

    // Декор в коридорах (менее густо)
    for (const corr of dungeon.corridors) {
      if (this.rng() < 0.6) {
        const decorItem = this._generateBiomeDecorItem(biomeId, corr);
        if (decorItem) decor.push(decorItem);
      }
    }
  },

  /** Генерация одного декоративного объекта по биому и области. */
  _generateBiomeDecorItem(biomeId, area) {
    const x = area.x + this._randInt(20, Math.max(20, area.w - 40));
    const y = area.y + this._randInt(20, Math.max(20, area.h - 40));
    const rng = this.rng;

    switch (biomeId) {
      case 'crypt': {
        const types = ['bones', 'skull', 'broken_column', 'cobweb_floor', 'cracked_tile', 'chain_skull'];
        const type = this._randPick(types);
        return { x, y, type, biome: biomeId, size: type === 'broken_column' ? 16 : 8, hasCollision: type === 'broken_column' };
      }
      case 'ice_caves': {
        const types = ['ice_crystal', 'stalactite', 'frozen_corpse', 'snow_pile', 'ice_crack'];
        const type = this._randPick(types);
        return { x, y, type, biome: biomeId, size: type === 'ice_crystal' ? 12 : 8, hasCollision: false };
      }
      case 'fire_mines': {
        const types = ['lava_pool', 'ore_chunk', 'mine_cart', 'chain', 'bellows', 'ember'];
        const type = this._randPick(types);
        return { x, y, type, biome: biomeId, size: type === 'mine_cart' ? 16 : 8, hasCollision: type === 'mine_cart', glow: type === 'lava_pool' || type === 'ember' };
      }
      case 'forest_ruins': {
        const types = ['glowing_mushroom', 'vine', 'broken_statue', 'mossy_rock', 'fallen_tree', 'flower_bush'];
        const type = this._randPick(types);
        return { x, y, type, biome: biomeId, size: type === 'fallen_tree' ? 24 : 8, hasCollision: type === 'fallen_tree' || type === 'mossy_rock' };
      }
      case 'castle': {
        const types = ['tapestry', 'armor_stand', 'candelabra', 'bookshelf', 'throne', 'cage', 'banner'];
        const type = this._randPick(types);
        return { x, y, type, biome: biomeId, size: type === 'throne' ? 16 : (type === 'bookshelf' ? 16 : 8), hasCollision: type === 'throne' || type === 'bookshelf' };
      }
      case 'sky_citadel': {
        const types = ['golden_urn', 'marble_statue', 'floating_crystal', 'cloud_fountain', 'light_pillar', 'angel_wing'];
        const type = this._randPick(types);
        return { x, y, type, biome: biomeId, size: type === 'marble_statue' ? 16 : 8, hasCollision: type === 'golden_urn', glow: type === 'floating_crystal' || type === 'light_pillar', floats: true };
      }
      case 'elven_forest': {
        const types = ['rune_stone', 'elven_lantern', 'bloom_bush', 'magic_mushroom', 'nature_altar', 'fairy_circle'];
        const type = this._randPick(types);
        return { x, y, type, biome: biomeId, size: type === 'nature_altar' ? 16 : 8, hasCollision: type === 'nature_altar', glow: type === 'elven_lantern' || type === 'magic_mushroom' };
      }
      case 'mountain_keep': {
        const types = ['barrel', 'ore_crate', 'pickaxe', 'chain_lantern', 'forge_anvil', 'stone_bridge', 'rock_pile'];
        const type = this._randPick(types);
        return { x, y, type, biome: biomeId, size: type === 'forge_anvil' ? 16 : (type === 'barrel' ? 12 : 8), hasCollision: type === 'barrel' || type === 'ore_crate' || type === 'forge_anvil' };
      }
      default:
        return { x, y, type: 'generic_rock', biome: biomeId, size: 8, hasCollision: false };
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
    const biomeId = biome ? biome.id : 'crypt';

    // 1) Заполняем стены (тёмный фон) с текстурой
    ctx.fillStyle = wallColor;
    ctx.fillRect(0, 0, this.mapW, this.mapH);

    // Текстура стен (кирпичная кладка/обводка по биому)
    this._renderWallTexture(ctx, dungeon, biomeId);

    // 2) Коридоры (тёмный пол)
    ctx.fillStyle = corridorColor;
    for (const c of dungeon.corridors) {
      ctx.fillRect(c.x, c.y, c.w, c.h);
      // Текстура пола коридора
      this._renderCorridorFloorTexture(ctx, c, biomeId);
    }

    // 2b) Площадка под секретной дверью
    if (dungeon.secretDoor) {
      const d = dungeon.secretDoor;
      ctx.fillStyle = secretFloorColor;
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }

    // 3) Комнаты (более светлый пол + сетка плитки + текстуры)
    for (const r of dungeon.rooms) {
      // фон
      ctx.fillStyle = r.isSecret ? secretFloorColor : floorColor;
      ctx.fillRect(r.x, r.y, r.w, r.h);

      // Биом-специфичная текстура пола
      this._renderRoomFloorTexture(ctx, r, biomeId);

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

    // === Дверные проёмы/арки на стыках комнат и коридоров ===
    this._renderDoorways(ctx, dungeon, biomeId);

    // === Узкая плиточная текстура коридоров (отличие от комнат) ===
    this._renderCorridorNarrowTiles(ctx, dungeon, biomeId);

    this._floorCache = off;
  },

  /** Рисует дверные проёмы на стыках коридоров и комнат. */
  _renderDoorways(ctx, dungeon, biomeId) {
    const rooms = dungeon.rooms;
    const corridors = dungeon.corridors;

    for (const room of rooms) {
      if (room.isSecret) continue;
      for (const corr of corridors) {
        // Проверяем пересечение коридора со стеной комнаты
        const doorways = this._findDoorway(room, corr);
        for (const dw of doorways) {
          // Тёмная арка
          ctx.fillStyle = biomeId === 'sky_citadel' ? '#a0b0c0' :
                         biomeId === 'elven_forest' ? '#3a5a2a' :
                         '#1a1a1a';
          ctx.fillRect(dw.x, dw.y, dw.w, dw.h);
          // Арка (полукруг сверху)
          ctx.fillStyle = biomeId === 'sky_citadel' ? '#c9a84c' :
                         biomeId === 'castle' ? '#5a4a3a' :
                         biomeId === 'elven_forest' ? '#2a4a1a' :
                         '#2a2a2a';
          if (dw.w > dw.h) {
            // Горизонтальный проход — арка слева и справа
            ctx.beginPath();
            ctx.arc(dw.x, dw.y + dw.h / 2, 4, 0, Math.PI * 2);
            ctx.arc(dw.x + dw.w, dw.y + dw.h / 2, 4, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Вертикальный проход — арка сверху
            ctx.beginPath();
            ctx.arc(dw.x + dw.w / 2, dw.y, dw.w / 2, 0, Math.PI);
            ctx.fill();
          }
          // Боковые колонны/столбы у проёма
          ctx.fillStyle = biomeId === 'sky_citadel' ? '#f0f0f0' :
                         biomeId === 'elven_forest' ? '#5a3a1a' :
                         '#4a4a4a';
          if (dw.w > dw.h) {
            ctx.fillRect(dw.x - 3, dw.y - 2, 3, dw.h + 4);
            ctx.fillRect(dw.x + dw.w, dw.y - 2, 3, dw.h + 4);
          } else {
            ctx.fillRect(dw.x - 2, dw.y - 3, dw.w + 4, 3);
            ctx.fillRect(dw.x - 2, dw.y + dw.h, dw.w + 4, 3);
          }
        }
      }
    }
  },

  /** Находит точки пересечения коридора со стенами комнаты (для дверных проёмов). */
  _findDoorway(room, corr) {
    const doorways = [];
    const overlap = 6; // ширина дверного проёма визуальная
    // Верхняя стена
    if (corr.y < room.y && corr.y + corr.h >= room.y) {
      const overlapX = Math.max(corr.x, room.x);
      const overlapW = Math.min(corr.x + corr.w, room.x + room.w) - overlapX;
      if (overlapW > 20) {
        doorways.push({ x: overlapX + 4, y: room.y - overlap / 2, w: overlapW - 8, h: overlap });
      }
    }
    // Нижняя стена
    if (corr.y + corr.h > room.y + room.h && corr.y <= room.y + room.h) {
      const overlapX = Math.max(corr.x, room.x);
      const overlapW = Math.min(corr.x + corr.w, room.x + room.w) - overlapX;
      if (overlapW > 20) {
        doorways.push({ x: overlapX + 4, y: room.y + room.h - overlap / 2, w: overlapW - 8, h: overlap });
      }
    }
    // Левая стена
    if (corr.x < room.x && corr.x + corr.w >= room.x) {
      const overlapY = Math.max(corr.y, room.y);
      const overlapH = Math.min(corr.y + corr.h, room.y + room.h) - overlapY;
      if (overlapH > 20) {
        doorways.push({ x: room.x - overlap / 2, y: overlapY + 4, w: overlap, h: overlapH - 8 });
      }
    }
    // Правая стена
    if (corr.x + corr.w > room.x + room.w && corr.x <= room.x + room.w) {
      const overlapY = Math.max(corr.y, room.y);
      const overlapH = Math.min(corr.y + corr.h, room.y + room.h) - overlapY;
      if (overlapH > 20) {
        doorways.push({ x: room.x + room.w - overlap / 2, y: overlapY + 4, w: overlap, h: overlapH - 8 });
      }
    }
    return doorways;
  },

  /** Рисует узкую плиточную разметку в коридорах (отличающуюся от комнат). */
  _renderCorridorNarrowTiles(ctx, dungeon, biomeId) {
    ctx.globalAlpha = 0.10;
    ctx.strokeStyle = biomeId === 'sky_citadel' ? '#a0b8c8' :
                     biomeId === 'elven_forest' ? '#4a6a3a' :
                     biomeId === 'mountain_keep' ? '#5a5040' :
                     '#3a3a3a';
    ctx.lineWidth = 0.5;
    const narrowTile = 20; // узкие плитки 20px (vs 40px в комнатах)
    for (const c of dungeon.corridors) {
      // Узкая сетка
      for (let xx = c.x; xx <= c.x + c.w; xx += narrowTile) {
        ctx.beginPath();
        ctx.moveTo(xx + 0.5, c.y);
        ctx.lineTo(xx + 0.5, c.y + c.h);
        ctx.stroke();
      }
      for (let yy = c.y; yy <= c.y + c.h; yy += narrowTile) {
        ctx.beginPath();
        ctx.moveTo(c.x, yy + 0.5);
        ctx.lineTo(c.x + c.w, yy + 0.5);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1.0;
  },

  /** Текстура стен по биому (рисуется за пределами комнат). */
  _renderWallTexture(ctx, dungeon, biomeId) {
    ctx.globalAlpha = 0.15;
    const cellSize = dungeon.cellSize;
    const gridW = dungeon.gridW, gridH = dungeon.gridH;
    const rng = this.rng || Math.random;

    for (let j = 0; j < gridH; j += 2) {
      for (let i = 0; i < gridW; i += 2) {
        if (dungeon.grid[j * gridW + i] !== 0) continue; // только стены
        const wx = i * cellSize, wy = j * cellSize;

        switch (biomeId) {
          case 'crypt': {
            // Каменная кладка — горизонтальные линии швов
            ctx.strokeStyle = '#2a2a2a';
            ctx.lineWidth = 1;
            if ((j % 4) === 0) {
              ctx.beginPath();
              ctx.moveTo(wx, wy + cellSize);
              ctx.lineTo(wx + cellSize * 2, wy + cellSize);
              ctx.stroke();
            }
            if ((i % 3) === 0) {
              ctx.beginPath();
              ctx.moveTo(wx + cellSize, wy);
              ctx.lineTo(wx + cellSize, wy + cellSize * 2);
              ctx.stroke();
            }
            break;
          }
          case 'ice_caves': {
            // Замёрзший камень — голубые прожилки
            ctx.strokeStyle = '#3a5a7a';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(wx + rng() * cellSize * 2, wy);
            ctx.lineTo(wx + rng() * cellSize * 2, wy + cellSize * 2);
            ctx.stroke();
            break;
          }
          case 'fire_mines': {
            // Обсидиан с рудными жилами
            ctx.strokeStyle = '#5a2a0a';
            ctx.lineWidth = 1;
            if (rng() < 0.3) {
              ctx.beginPath();
              ctx.arc(wx + rng() * cellSize * 2, wy + rng() * cellSize * 2, 3, 0, Math.PI * 2);
              ctx.stroke();
            }
            break;
          }
          case 'forest_ruins': {
            // Лианы и корни
            ctx.strokeStyle = '#2a4a2a';
            ctx.lineWidth = 1.2;
            if (rng() < 0.25) {
              ctx.beginPath();
              ctx.moveTo(wx, wy + rng() * cellSize * 2);
              ctx.quadraticCurveTo(wx + cellSize, wy + rng() * cellSize * 2, wx + cellSize * 2, wy + rng() * cellSize * 2);
              ctx.stroke();
            }
            break;
          }
          case 'castle': {
            // Каменная кладка с гербами
            ctx.strokeStyle = '#3a3a3a';
            ctx.lineWidth = 1;
            if ((j % 4) === 0) {
              ctx.beginPath();
              ctx.moveTo(wx, wy + cellSize);
              ctx.lineTo(wx + cellSize * 2, wy + cellSize);
              ctx.stroke();
            }
            break;
          }
          case 'sky_citadel': {
            // Облачная текстура — мягкие белые волны
            ctx.strokeStyle = '#d0d8e0';
            ctx.lineWidth = 1.5;
            if (rng() < 0.3) {
              ctx.beginPath();
              const cx = wx + rng() * cellSize * 2;
              const cy = wy + rng() * cellSize * 2;
              ctx.arc(cx, cy, 4 + rng() * 6, 0, Math.PI, false);
              ctx.stroke();
            }
            break;
          }
          case 'elven_forest': {
            // Кора деревьев — вертикальные линии с изгибами
            ctx.strokeStyle = '#4a3a1a';
            ctx.lineWidth = 1.2;
            if (rng() < 0.35) {
              ctx.beginPath();
              const sx = wx + rng() * cellSize * 2;
              ctx.moveTo(sx, wy);
              ctx.quadraticCurveTo(sx + rng() * 8 - 4, wy + cellSize, sx + rng() * 6 - 3, wy + cellSize * 2);
              ctx.stroke();
            }
            // Листья
            if (rng() < 0.15) {
              ctx.fillStyle = '#3a6a2a';
              ctx.beginPath();
              ctx.arc(wx + rng() * cellSize * 2, wy + rng() * cellSize * 2, 2, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
          }
          case 'mountain_keep': {
            // Трещины и грубый камень
            ctx.strokeStyle = '#4a4a4a';
            ctx.lineWidth = 1;
            if ((j % 3) === 0) {
              ctx.beginPath();
              ctx.moveTo(wx, wy + cellSize);
              ctx.lineTo(wx + cellSize * 2, wy + cellSize + rng() * 4 - 2);
              ctx.stroke();
            }
            if (rng() < 0.2) {
              ctx.beginPath();
              ctx.moveTo(wx + rng() * cellSize * 2, wy);
              ctx.lineTo(wx + rng() * cellSize * 2, wy + cellSize * 2);
              ctx.stroke();
            }
            break;
          }
        }
      }
    }
    ctx.globalAlpha = 1.0;
  },

  /** Текстура пола коридора по биому. */
  _renderCorridorFloorTexture(ctx, corridor, biomeId) {
    ctx.globalAlpha = 0.08;
    const rng = this.rng || Math.random;
    switch (biomeId) {
      case 'crypt': {
        // Трещины
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) {
          const x1 = corridor.x + rng() * corridor.w;
          const y1 = corridor.y + rng() * corridor.h;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 + rng() * 30 - 15, y1 + rng() * 30 - 15);
          ctx.stroke();
        }
        break;
      }
      case 'ice_caves': {
        // Ледяные прожилки
        ctx.strokeStyle = '#6090b0';
        ctx.lineWidth = 0.6;
        for (let i = 0; i < 2; i++) {
          const x1 = corridor.x + rng() * corridor.w;
          const y1 = corridor.y + rng() * corridor.h;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 + rng() * 40 - 20, y1 + rng() * 40 - 20);
          ctx.stroke();
        }
        break;
      }
      case 'fire_mines': {
        // Потрескавшаяся лава
        ctx.strokeStyle = '#8a3a0a';
        ctx.lineWidth = 1;
        for (let i = 0; i < 2; i++) {
          const x1 = corridor.x + rng() * corridor.w;
          const y1 = corridor.y + rng() * corridor.h;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 + rng() * 20, y1 + rng() * 20);
          ctx.lineTo(x1 + rng() * 20, y1 + rng() * 20);
          ctx.stroke();
        }
        break;
      }
      case 'sky_citadel': {
        // Золотые линии на мраморе
        ctx.strokeStyle = '#c9a84c';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 2; i++) {
          const x1 = corridor.x + rng() * corridor.w;
          const y1 = corridor.y + rng() * corridor.h;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 + rng() * 30, y1 + rng() * 10 - 5);
          ctx.stroke();
        }
        break;
      }
      case 'elven_forest': {
        // Мох и мелкие камушки
        ctx.fillStyle = '#3a6a2a';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(corridor.x + rng() * corridor.w, corridor.y + rng() * corridor.h, 2 + rng() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'mountain_keep': {
        // Грубый камень — мелкие точки
        ctx.fillStyle = '#4a4a3a';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(corridor.x + rng() * corridor.w, corridor.y + rng() * corridor.h, 1 + rng() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }
    ctx.globalAlpha = 1.0;
  },

  /** Текстура пола комнаты по биому. */
  _renderRoomFloorTexture(ctx, room, biomeId) {
    const rng = this.rng || Math.random;
    ctx.globalAlpha = 0.12;

    switch (biomeId) {
      case 'crypt': {
        // Трещины на плитке
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 0.7;
        const crackCount = Math.floor(room.w * room.h / 5000);
        for (let i = 0; i < crackCount; i++) {
          const cx = room.x + rng() * room.w;
          const cy = room.y + rng() * room.h;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          let px = cx, py = cy;
          for (let s = 0; s < 3; s++) {
            px += rng() * 16 - 8;
            py += rng() * 16 - 8;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        break;
      }
      case 'ice_caves': {
        // Голубоватые прожилки льда
        ctx.strokeStyle = '#5080a0';
        ctx.lineWidth = 0.8;
        const iceCount = Math.floor(room.w * room.h / 4000);
        for (let i = 0; i < iceCount; i++) {
          const cx = room.x + rng() * room.w;
          const cy = room.y + rng() * room.h;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + rng() * 30 - 15, cy + rng() * 30 - 15);
          ctx.stroke();
        }
        // Блёстки на полу
        ctx.fillStyle = '#aaddff';
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc(room.x + rng() * room.w, room.y + rng() * room.h, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'fire_mines': {
        // Потрескавшийся камень с оранжевыми жилами
        ctx.strokeStyle = '#6a2a0a';
        ctx.lineWidth = 1;
        const fireCount = Math.floor(room.w * room.h / 6000);
        for (let i = 0; i < fireCount; i++) {
          const cx = room.x + rng() * room.w;
          const cy = room.y + rng() * room.h;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + rng() * 24 - 12, cy + rng() * 24 - 12);
          ctx.lineTo(cx + rng() * 24 - 12, cy + rng() * 24 - 12);
          ctx.stroke();
        }
        // Светящиеся точки (лава)
        ctx.fillStyle = '#ff6633';
        ctx.globalAlpha = 0.08;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(room.x + rng() * room.w, room.y + rng() * room.h, 2 + rng() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'forest_ruins': {
        // Замшелые пятна и корни
        ctx.fillStyle = '#3a5a3a';
        ctx.globalAlpha = 0.10;
        const mossCount = Math.floor(room.w * room.h / 4000);
        for (let i = 0; i < mossCount; i++) {
          ctx.beginPath();
          ctx.arc(room.x + rng() * room.w, room.y + rng() * room.h, 4 + rng() * 8, 0, Math.PI * 2);
          ctx.fill();
        }
        // Корни (тёмные изогнутые линии)
        ctx.strokeStyle = '#2a3a1a';
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.12;
        for (let i = 0; i < 3; i++) {
          const sx = room.x + rng() * room.w;
          const sy = room.y + rng() * room.h;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(sx + rng() * 40, sy + rng() * 40, sx + rng() * 60 - 30, sy + rng() * 60 - 30);
          ctx.stroke();
        }
        break;
      }
      case 'castle': {
        // Паркет/мозаика — ромбовидная сетка
        ctx.strokeStyle = '#4a3a2a';
        ctx.lineWidth = 0.6;
        const tileSize = 30;
        for (let xx = room.x; xx < room.x + room.w; xx += tileSize) {
          for (let yy = room.y; yy < room.y + room.h; yy += tileSize) {
            ctx.beginPath();
            ctx.moveTo(xx + tileSize / 2, yy);
            ctx.lineTo(xx + tileSize, yy + tileSize / 2);
            ctx.lineTo(xx + tileSize / 2, yy + tileSize);
            ctx.lineTo(xx, yy + tileSize / 2);
            ctx.closePath();
            ctx.stroke();
          }
        }
        break;
      }
      case 'sky_citadel': {
        // Мраморные узоры — диагональные прожилки
        ctx.strokeStyle = '#b0c0d0';
        ctx.lineWidth = 0.6;
        const marbleCount = Math.floor(room.w * room.h / 3000);
        for (let i = 0; i < marbleCount; i++) {
          const cx = room.x + rng() * room.w;
          const cy = room.y + rng() * room.h;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + rng() * 20 - 10, cy + rng() * 20 - 10);
          ctx.stroke();
        }
        // Золотые акценты на плитке
        ctx.strokeStyle = '#c9a84c';
        ctx.globalAlpha = 0.08;
        ctx.lineWidth = 0.8;
        const tileS = 40;
        for (let xx = room.x + tileS; xx < room.x + room.w - tileS; xx += tileS * 2) {
          for (let yy = room.y + tileS; yy < room.y + room.h - tileS; yy += tileS * 2) {
            if (rng() < 0.3) {
              ctx.beginPath();
              ctx.arc(xx, yy, 3, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
        break;
      }
      case 'elven_forest': {
        // Мох, цветы и трава
        ctx.fillStyle = '#5a9a4a';
        ctx.globalAlpha = 0.10;
        const grassCount = Math.floor(room.w * room.h / 3000);
        for (let i = 0; i < grassCount; i++) {
          const gx = room.x + rng() * room.w;
          const gy = room.y + rng() * room.h;
          ctx.beginPath();
          ctx.arc(gx, gy, 2 + rng() * 4, 0, Math.PI * 2);
          ctx.fill();
        }
        // Цветочки (маленькие яркие точки)
        ctx.globalAlpha = 0.15;
        const flowers = ['#ff69b4', '#ffa500', '#add8e6', '#dda0dd', '#ffff00'];
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = flowers[Math.floor(rng() * flowers.length)];
          ctx.beginPath();
          ctx.arc(room.x + rng() * room.w, room.y + rng() * room.h, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
        // Тропинки из светлого камня
        ctx.strokeStyle = '#a0a080';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.06;
        ctx.beginPath();
        ctx.moveTo(room.x + room.w * 0.2, room.y + room.h * 0.5);
        ctx.quadraticCurveTo(room.x + room.w * 0.5, room.y + room.h * (0.3 + rng() * 0.4), room.x + room.w * 0.8, room.y + room.h * 0.5);
        ctx.stroke();
        break;
      }
      case 'mountain_keep': {
        // Грубый каменный пол со сколами
        ctx.strokeStyle = '#5a5040';
        ctx.lineWidth = 0.8;
        const chipCount = Math.floor(room.w * room.h / 4000);
        for (let i = 0; i < chipCount; i++) {
          const cx = room.x + rng() * room.w;
          const cy = room.y + rng() * room.h;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + rng() * 12 - 6, cy + rng() * 12 - 6);
          ctx.stroke();
        }
        // Вырубленные ступени (горизонтальные линии через неравные промежутки)
        ctx.strokeStyle = '#4a4030';
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.08;
        for (let yy = room.y + 20; yy < room.y + room.h - 20; yy += 25 + rng() * 15) {
          ctx.beginPath();
          ctx.moveTo(room.x + 10, yy);
          ctx.lineTo(room.x + room.w - 10, yy);
          ctx.stroke();
        }
        break;
      }
    }
    ctx.globalAlpha = 1.0;
  },


  /* ============================================================
     Walkability / collisions — «половинная» проходимость (v2).
     
     Система коллизий с уменьшенными хитбоксами:
     - Визуальный размер блока остаётся прежним (32×32).
     - Хитбокс коллизии уменьшен: стены ~70%, колонны ~50%.
     - Игрок может «заходить» визуально за край блока.
     - Для врагов — чуть более строгая коллизия (60–70%).
     ============================================================ */

  /**
   * Может ли точка (x, y) находиться на проходимом полу?
   * Базовая проверка по сетке.
   */
  isWalkable(x, y) {
    if (!this.dungeon) return true;
    if (x < 0 || y < 0 || x >= this.mapW || y >= this.mapH) return false;
    const cs = this.dungeon.cellSize;
    const i = Math.floor(x / cs), j = Math.floor(y / cs);
    if (i < 0 || j < 0 || i >= this.dungeon.gridW || j >= this.dungeon.gridH) return false;
    return this.dungeon.grid[j * this.dungeon.gridW + i] === 1;
  },

  /**
   * Проверка с учётом «половинного» хитбокса.
   * Стены на сетке имеют уменьшенную зону коллизии: центральные 50–70%
   * ячейки считаются непроходимыми, остаток — «мягкий край».
   * @param {number} x — мировая координата
   * @param {number} y — мировая координата
   * @param {number} shrinkFactor — 0..1, сколько «сжимать» хитбокс стены
   *   (0.5 = 50% хитбокс в центре ячейки; 0.3 = 30% отступ с каждой стороны)
   */
  isWalkableSoft(x, y, shrinkFactor) {
    if (!this.dungeon) return true;
    if (x < 0 || y < 0 || x >= this.mapW || y >= this.mapH) return false;
    const cs = this.dungeon.cellSize;
    const i = Math.floor(x / cs), j = Math.floor(y / cs);
    if (i < 0 || j < 0 || i >= this.dungeon.gridW || j >= this.dungeon.gridH) return false;
    // Если ячейка проходима — ok
    if (this.dungeon.grid[j * this.dungeon.gridW + i] === 1) return true;
    // Ячейка — стена. Проверяем, попадает ли точка в уменьшенный хитбокс.
    // shrinkFactor определяет отступ от краёв ячейки (в долях от размера).
    const sf = shrinkFactor || 0.25; // по умолчанию 25% отступ = 50% хитбокс
    const cellX = i * cs;
    const cellY = j * cs;
    const insetX = cs * sf;
    const insetY = cs * sf;
    // Уменьшенный хитбокс стены — центральная часть ячейки
    if (x >= cellX + insetX && x <= cellX + cs - insetX &&
        y >= cellY + insetY && y <= cellY + cs - insetY) {
      return false; // внутри жёсткого ядра стены
    }
    // На «мягком» краю — проходимо (игрок может заходить за визуальный край)
    return true;
  },

  /** Проверка, что прямоугольник (cx-rad..cx+rad) полностью на полу.
   *  Используется для движения сущностей. rad — половина ширины квадрата.
   *  @param {number} shrinkFactor — отступ стены для «мягкой» коллизии (опц.) */
  rectIsWalkable(cx, cy, rad, shrinkFactor) {
    if (!this.dungeon) return true;
    // Если передан shrinkFactor — используем мягкую проверку
    if (shrinkFactor !== undefined && shrinkFactor > 0) {
      return this.isWalkableSoft(cx - rad, cy - rad, shrinkFactor) &&
             this.isWalkableSoft(cx + rad, cy - rad, shrinkFactor) &&
             this.isWalkableSoft(cx - rad, cy + rad, shrinkFactor) &&
             this.isWalkableSoft(cx + rad, cy + rad, shrinkFactor) &&
             this.isWalkableSoft(cx, cy, shrinkFactor);
    }
    return this.isWalkable(cx - rad, cy - rad) &&
           this.isWalkable(cx + rad, cy - rad) &&
           this.isWalkable(cx - rad, cy + rad) &&
           this.isWalkable(cx + rad, cy + rad) &&
           this.isWalkable(cx, cy);
  },

  /**
   * Двинуть сущность по (dx, dy) с раздельной проверкой осей.
   * Если упёрлись — позволяет скользить вдоль стен.
   * Новая система: использует «мягкие» хитбоксы стен.
   * @param {number} shrinkFactor — 0.25 для игрока (50% хитбокс),
   *   0.15 для врагов (70% хитбокс). По умолчанию 0.25.
   * Возвращает { x, y, blockedX, blockedY }.
   */
  moveWithCollision(x, y, dx, dy, rad, shrinkFactor) {
    if (!this.dungeon) return { x: x + dx, y: y + dy, blockedX: false, blockedY: false };
    const sf = (shrinkFactor !== undefined) ? shrinkFactor : 0.25;
    // Мягкий отступ для проверки (предотвращает застревание в текстурах)
    const checkRad = rad + 1;
    let nx = x, ny = y;
    let blockedX = false, blockedY = false;
    if (dx !== 0) {
      const tryX = x + dx;
      if (this.rectIsWalkable(tryX, y, checkRad, sf)) nx = tryX;
      else {
        // Доехать до стены маленькими шагами
        const sign = Math.sign(dx);
        let stepped = 0;
        const stepSize = 1;
        while (Math.abs(stepped) < Math.abs(dx)) {
          const next = stepped + sign * stepSize;
          if (this.rectIsWalkable(x + next, y, checkRad, sf)) stepped = next;
          else break;
        }
        nx = x + stepped;
        blockedX = true;
      }
    }
    if (dy !== 0) {
      const tryY = ny + dy;
      if (this.rectIsWalkable(nx, tryY, checkRad, sf)) ny = tryY;
      else {
        const sign = Math.sign(dy);
        let stepped = 0;
        const stepSize = 1;
        while (Math.abs(stepped) < Math.abs(dy)) {
          const next = stepped + sign * stepSize;
          if (this.rectIsWalkable(nx, ny + next, checkRad, sf)) stepped = next;
          else break;
        }
        ny = ny + stepped;
        blockedY = true;
      }
    }
    // Финальная проверка — если застрял, вытолкнуть
    if (!this.rectIsWalkable(nx, ny, rad, sf)) {
      const offsets = [
        {dx: 0, dy: -2}, {dx: 0, dy: 2}, {dx: -2, dy: 0}, {dx: 2, dy: 0},
        {dx: -2, dy: -2}, {dx: 2, dy: -2}, {dx: -2, dy: 2}, {dx: 2, dy: 2},
        {dx: 0, dy: -4}, {dx: 0, dy: 4}, {dx: -4, dy: 0}, {dx: 4, dy: 0},
      ];
      for (const off of offsets) {
        if (this.rectIsWalkable(nx + off.dx, ny + off.dy, rad, sf)) {
          nx += off.dx;
          ny += off.dy;
          break;
        }
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
     attractToWalkable — притяжение объектов к проходимой зоне.
     Сундуки, кристаллы опыта, враги не должны застревать в стенах.
     ============================================================ */

  /**
   * Найти ближайшую проходимую точку к (x, y).
   * Проверяет 8 направлений с шагом step, в радиусе до maxDist.
   * Возвращает { x, y } или null если не нашлось.
   */
  findNearestWalkable(x, y, step, maxDist) {
    if (!this.dungeon) return { x, y };
    if (this.isWalkable(x, y)) return { x, y };
    step = step || 10;
    maxDist = maxDist || 200;
    const dirs = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: 1, dy: 1 },
    ];
    let bestDist = Infinity;
    let best = null;
    for (let dist = step; dist <= maxDist; dist += step) {
      for (const d of dirs) {
        const tx = x + d.dx * dist;
        const ty = y + d.dy * dist;
        if (tx < 0 || ty < 0 || tx >= this.mapW || ty >= this.mapH) continue;
        if (this.isWalkable(tx, ty)) {
          const dd = dist;
          if (dd < bestDist) {
            bestDist = dd;
            best = { x: tx, y: ty };
          }
        }
      }
      if (best) return best; // нашли на этом расстоянии — ближе не будет
    }
    return best;
  },

  /**
   * Притянуть объект к ближайшей проходимой точке.
   * Вызывается периодически (раз в ~0.5 сек) для каждого застрявшего объекта.
   * @param {object} obj — объект с полями .x, .y (.active опционально)
   * @param {number} speed — скорость притяжения px/sec (по умолчанию 60)
   * @param {number} dt — дельта времени
   * @returns {boolean} true если объект был в непроходимой зоне и сдвинут
   */
  attractToWalkable(obj, speed, dt) {
    if (!this.dungeon || !obj) return false;
    if (this.isWalkable(obj.x, obj.y)) return false;

    // Объект в стене — ищем ближайшую проходимую точку
    const target = this.findNearestWalkable(obj.x, obj.y, 8, 160);
    if (!target) return false;

    speed = speed || 60;
    const dx = target.x - obj.x;
    const dy = target.y - obj.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) {
      obj.x = target.x;
      obj.y = target.y;
      return true;
    }
    const move = Math.min(speed * dt, dist);
    obj.x += (dx / dist) * move;
    obj.y += (dy / dist) * move;
    return true;
  },

  /**
   * Обработка всех «застрявших» объектов за кадр.
   * Вызывается из Game.update() раз в 0.5 сек.
   * @param {object} game — объект Game с пулами xpDrops, goldDrops, enemies, chest
   * @param {number} dt — дельта времени
   */
  attractAllStuck(game, dt) {
    if (!this.dungeon || !game) return;

    // XP кристаллы
    if (game.xpDrops) {
      game.xpDrops.forEachActive((xp) => {
        this.attractToWalkable(xp, 80, dt);
      });
    }

    // Золото
    if (game.goldDrops) {
      game.goldDrops.forEachActive((g) => {
        this.attractToWalkable(g, 80, dt);
      });
    }

    // Сундук
    if (game.chest && game.chest.active) {
      this.attractToWalkable(game.chest, 40, dt);
    }

    // Враги — если застряли > 2 секунд, телепортировать
    if (game.enemies) {
      game.enemies.forEachActive((e) => {
        if (!this.isWalkable(e.x, e.y)) {
          if (!e._stuckTimer) e._stuckTimer = 0;
          e._stuckTimer += dt;
          if (e._stuckTimer >= 2.0) {
            // Мгновенная телепортация к проходимой точке
            const target = this.findNearestWalkable(e.x, e.y, 10, 200);
            if (target) { e.x = target.x; e.y = target.y; }
            e._stuckTimer = 0;
          } else {
            this.attractToWalkable(e, 60, dt);
          }
        } else {
          e._stuckTimer = 0;
        }
      });
    }
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

    // Шаг 17: обновить загадки и ловушки
    if (GameMap.updateStep17) GameMap.updateStep17(dt, player);
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

    // Богатый биом-декор (D&D стиль)
    this._renderBiomeDecor(ctx, cam, viewW, viewH);

    // Декор: паутина
    this._renderWebs(ctx, cam, viewW, viewH);

    // Рычаги
    this._renderLevers(ctx);

    // Ловушки (под факелами, чтобы факелы перекрывали)
    this._renderTraps(ctx, cam, viewW, viewH);

    // Шаг 17: новые загадки и ловушки
    if (GameMap.renderStep17) GameMap.renderStep17(ctx, cam, viewW, viewH);

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

  /** Отрисовать богатый декор по биомам — только видимая область. */
  _renderBiomeDecor(ctx, cam, vw, vh) {
    if (!this.dungeon || !this.dungeon.decor.biomeDecor) return;
    const decor = this.dungeon.decor.biomeDecor;
    const t = this.time;
    const biome = this.currentBiome;
    const isFloating = biome && biome.floatingAnimation;

    for (let i = 0; i < decor.length; i++) {
      const d = decor[i];
      if (d.x < cam.x - 20 || d.x > cam.x + vw + 20 ||
          d.y < cam.y - 20 || d.y > cam.y + vh + 20) continue;

      // Смещение парения для Небесного города
      let yOff = 0;
      if (isFloating && d.floats) {
        yOff = Math.sin(t * (biome.floatSpeed || 1.5) + d.x * 0.1) * (biome.floatAmplitude || 2);
      }

      const dx = d.x, dy = d.y + yOff;
      const s = d.size || 8;

      // Свечение (для светящихся объектов)
      if (d.glow) {
        ctx.globalAlpha = 0.15 + Math.sin(t * 2 + d.x) * 0.05;
        ctx.fillStyle = d.biome === 'fire_mines' ? '#ff6600' :
                       d.biome === 'sky_citadel' ? '#ffe080' :
                       d.biome === 'elven_forest' ? '#60ffa0' : '#ffffff';
        ctx.beginPath();
        ctx.arc(dx, dy, s + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Спрайт декора — используем DECOR_SPRITES если доступен
      const DS = window.DECOR_SPRITES;
      if (DS && DS[d.type]) {
        ctx.drawImage(DS[d.type], dx - s / 2, dy - s / 2, s, s);
      } else {
        // Фоллбэк: простая геометрия
        this._renderDecorFallback(ctx, d, dx, dy, s);
      }
    }
  },

  /** Фоллбэк-отрисовка декора простыми фигурами. */
  _renderDecorFallback(ctx, d, x, y, s) {
    const hs = s / 2;
    switch (d.type) {
      case 'bones': case 'skull': case 'chain_skull':
        ctx.fillStyle = '#c0b090'; ctx.fillRect(x - hs, y - hs, s, s * 0.6);
        ctx.fillStyle = '#a09070'; ctx.fillRect(x - 2, y - hs, 4, s);
        break;
      case 'broken_column':
        ctx.fillStyle = '#6a6a6a'; ctx.fillRect(x - hs, y - hs, s, s);
        ctx.fillStyle = '#4a4a4a'; ctx.fillRect(x - hs + 2, y - hs + 2, s - 4, 3);
        break;
      case 'ice_crystal':
        ctx.fillStyle = '#80c0e0'; ctx.beginPath();
        ctx.moveTo(x, y - hs); ctx.lineTo(x + hs, y + hs); ctx.lineTo(x - hs, y + hs); ctx.closePath(); ctx.fill();
        break;
      case 'stalactite': case 'snow_pile':
        ctx.fillStyle = d.type === 'stalactite' ? '#7a8a9a' : '#e0e8f0';
        ctx.beginPath(); ctx.arc(x, y, hs, 0, Math.PI * 2); ctx.fill();
        break;
      case 'lava_pool': case 'ember':
        ctx.fillStyle = '#ff4400'; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(x, y, hs, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case 'ore_chunk': case 'rock_pile':
        ctx.fillStyle = '#8a7a5a'; ctx.fillRect(x - hs, y - hs * 0.6, s, s * 0.6);
        break;
      case 'mine_cart':
        ctx.fillStyle = '#5a4a3a'; ctx.fillRect(x - hs, y - hs * 0.5, s, s * 0.7);
        ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(x - 3, y + hs * 0.6, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 3, y + hs * 0.6, 3, 0, Math.PI * 2); ctx.fill();
        break;
      case 'glowing_mushroom': case 'magic_mushroom':
        ctx.fillStyle = '#40e0d0'; ctx.beginPath(); ctx.arc(x, y - 2, hs * 0.8, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#6a5a4a'; ctx.fillRect(x - 1, y - 1, 2, hs);
        break;
      case 'mossy_rock': case 'rune_stone':
        ctx.fillStyle = '#5a6a4a'; ctx.fillRect(x - hs, y - hs * 0.7, s, s * 0.7);
        if (d.type === 'rune_stone') { ctx.fillStyle = '#80c0ff'; ctx.fillRect(x - 2, y - 3, 4, 2); }
        break;
      case 'tapestry': case 'banner':
        ctx.fillStyle = '#8b0000'; ctx.fillRect(x - 3, y - hs, 6, s);
        ctx.fillStyle = '#ffd700'; ctx.fillRect(x - 2, y - hs + 2, 4, 2);
        break;
      case 'armor_stand':
        ctx.fillStyle = '#808080'; ctx.fillRect(x - 3, y - hs, 6, s);
        ctx.fillStyle = '#a0a0a0'; ctx.fillRect(x - 4, y - hs + 2, 8, 3);
        break;
      case 'candelabra': case 'elven_lantern': case 'chain_lantern':
        ctx.fillStyle = '#c9a84c'; ctx.fillRect(x - 1, y - hs, 2, s * 0.8);
        ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(x, y - hs, 3, 0, Math.PI * 2); ctx.fill();
        break;
      case 'golden_urn':
        ctx.fillStyle = '#c9a84c'; ctx.beginPath(); ctx.arc(x, y, hs * 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#a08030'; ctx.fillRect(x - hs * 0.5, y - hs, s * 0.5, 3);
        break;
      case 'marble_statue': case 'angel_wing':
        ctx.fillStyle = '#f0f0f0'; ctx.fillRect(x - hs * 0.5, y - hs, s * 0.5, s);
        ctx.fillStyle = '#d0d0d0'; ctx.beginPath(); ctx.arc(x, y - hs, hs * 0.4, 0, Math.PI * 2); ctx.fill();
        break;
      case 'floating_crystal': case 'light_pillar':
        ctx.fillStyle = '#ffe080'; ctx.beginPath();
        ctx.moveTo(x, y - hs); ctx.lineTo(x + hs * 0.6, y); ctx.lineTo(x, y + hs); ctx.lineTo(x - hs * 0.6, y); ctx.closePath(); ctx.fill();
        break;
      case 'bloom_bush': case 'flower_bush':
        ctx.fillStyle = '#3a8a3a'; ctx.beginPath(); ctx.arc(x, y, hs, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff69b4'; ctx.beginPath(); ctx.arc(x + 2, y - 2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(x - 2, y + 1, 1.5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'nature_altar':
        ctx.fillStyle = '#6a8a5a'; ctx.fillRect(x - hs, y - hs * 0.5, s, s * 0.7);
        ctx.fillStyle = '#80c0ff'; ctx.beginPath(); ctx.arc(x, y - hs * 0.3, 3, 0, Math.PI * 2); ctx.fill();
        break;
      case 'barrel': case 'ore_crate':
        ctx.fillStyle = d.type === 'barrel' ? '#8b6914' : '#6a5a3a';
        ctx.fillRect(x - hs, y - hs, s, s);
        ctx.strokeStyle = '#4a3a1a'; ctx.lineWidth = 1; ctx.strokeRect(x - hs, y - hs, s, s);
        break;
      case 'pickaxe':
        ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x - hs, y + hs); ctx.lineTo(x + hs, y - hs); ctx.stroke();
        ctx.fillStyle = '#5a5a5a'; ctx.fillRect(x + hs - 3, y - hs, 4, 4);
        break;
      case 'forge_anvil':
        ctx.fillStyle = '#4a4a4a'; ctx.fillRect(x - hs, y - hs * 0.3, s, s * 0.5);
        ctx.fillStyle = '#3a3a3a'; ctx.fillRect(x - 2, y + hs * 0.2, 4, hs * 0.5);
        break;
      default:
        ctx.fillStyle = '#6a6a6a'; ctx.fillRect(x - hs * 0.5, y - hs * 0.5, s * 0.5, s * 0.5);
        break;
    }
  },

  _renderTorches(ctx, cam, vw, vh) {
    // Факелы с пульсирующим свечением (вдоль стен комнат и коридоров)
    if (!this.dungeon || !this.dungeon.decor.torches) return;
    const t = this.time;
    for (const torch of this.dungeon.decor.torches) {
      if (torch.x < cam.x - 10 || torch.x > cam.x + vw + 10 ||
          torch.y < cam.y - 10 || torch.y > cam.y + vh + 10) continue;
      // Основание
      ctx.fillStyle = '#5a4a3a';
      ctx.fillRect(torch.x - 2, torch.y - 1, 4, 6);
      // Пламя (пульсирующее)
      const flicker = Math.sin(t * 6 + torch.phase) * 0.3 + 0.7;
      const fSize = 3 + flicker;
      ctx.fillStyle = `rgba(255, ${150 + Math.floor(flicker * 60)}, 30, ${0.7 + flicker * 0.2})`;
      ctx.beginPath();
      ctx.arc(torch.x, torch.y - 3, fSize, 0, Math.PI * 2);
      ctx.fill();
      // Свечение (мягкое)
      ctx.globalAlpha = 0.08 + flicker * 0.04;
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.arc(torch.x, torch.y, 14 + flicker * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
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
     Миникарта полностью удалена.
     ============================================================ */


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

/* ============================================================
   Шаг 16: Campaign special objects — алтари, клетка, ключ, огненное сердце.
   ============================================================ */
GameMap.campaignObjects = [];

/** Разместить специальные объекты кампании на текущей карте. */
GameMap.placeCampaignObjects = function(mapCfg) {
  this.campaignObjects = [];
  if (!this.dungeon || !mapCfg) return;

  const rooms = this.dungeon.rooms.filter(r => !r.isStart && !r.isSecret);

  if (mapCfg.specialObjects.includes('altars')) {
    // Карта 1: 2 рунных алтаря в разных комнатах
    const altarRooms = rooms.slice(0, Math.min(2, rooms.length));
    for (let i = 0; i < 2 && i < altarRooms.length; i++) {
      const room = altarRooms[i];
      this.campaignObjects.push({
        type: 'altar',
        x: room.cx,
        y: room.cy,
        size: 28,
        activated: false,
        pulse: Math.random() * Math.PI * 2,
        levers: [
          { x: room.cx - 40, y: room.cy + 40, state: 0, correct: Math.random() < 0.5 ? 1 : 0 },
          { x: room.cx + 40, y: room.cy + 40, state: 0, correct: 0 },
        ],
        interactRadius: 36,
      });
      // Гарантируем разную комбинацию
      const alt = this.campaignObjects[this.campaignObjects.length - 1];
      if (alt.levers[0].correct === alt.levers[1].correct) {
        alt.levers[1].correct = alt.levers[0].correct === 0 ? 1 : 0;
      }
    }
  }

  if (mapCfg.specialObjects.includes('cage')) {
    // Карта 4: клетка с магом
    const cageRoom = rooms.length > 1 ? rooms[Math.floor(rooms.length / 2)] : rooms[0];
    if (cageRoom) {
      this.campaignObjects.push({
        type: 'cage',
        x: cageRoom.cx,
        y: cageRoom.cy,
        size: 36,
        opened: false,
        interactRadius: 40,
      });
    }
  }

  if (mapCfg.specialObjects.includes('key_enemy')) {
    // Хранитель ключа появляется через 2-3 минуты (обрабатывается в campaign update)
    this.campaignObjects.push({
      type: 'key_marker',
      spawned: false,
      spawnTime: 120 + Math.random() * 60, // 2-3 минуты
    });
  }
};

/** Обновить кампейн-объекты. */
GameMap.updateCampaignObjects = function(dt, player) {
  if (!player || !window.Campaign || !Campaign.active) return;

  for (const obj of this.campaignObjects) {
    if (obj.type === 'altar' && !obj.activated) {
      obj.pulse += dt * 3;
      // Проверка взаимодействия с рычагами алтаря
      for (const lev of obj.levers) {
        if (lev._cooldown > 0) { lev._cooldown -= dt; continue; }
        const dx = player.x - lev.x, dy = player.y - lev.y;
        if (dx * dx + dy * dy < 30 * 30) {
          // Авто-взаимодействие при приближении
          if (!lev._triggered) {
            lev._triggered = true;
            lev.state = lev.state === 0 ? 1 : 0;
            lev._cooldown = 1.5;
            if (window.Particles) {
              Particles.burst(lev.x, lev.y, 4, {
                color: '#ffd700', speedMin: 40, speedMax: 100,
                lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 3,
              });
            }
          }
        } else {
          lev._triggered = false;
        }
      }
      // Проверяем, все ли рычаги в правильном положении
      const allCorrect = obj.levers.every(l => l.state === l.correct);
      if (allCorrect) {
        obj.activated = true;
        Campaign.onAltarActivated();
        if (window.Particles) {
          Particles.burst(obj.x, obj.y, 12, {
            color: '#9b59b6', speedMin: 60, speedMax: 180,
            lifeMin: 0.5, lifeMax: 1.0, sizeMin: 3, sizeMax: 6,
          });
          Particles.text(obj.x, obj.y - 30, 'АЛТАРЬ АКТИВИРОВАН!', 1.5, '#9b59b6', 14);
        }
      }
    }

    if (obj.type === 'cage' && !obj.opened) {
      // Проверка: подошёл с ключом?
      if (Campaign.hasKey) {
        const dx = player.x - obj.x, dy = player.y - obj.y;
        if (dx * dx + dy * dy < obj.interactRadius * obj.interactRadius) {
          obj.opened = true;
          Campaign.onCageOpened();
          if (window.Particles) {
            Particles.burst(obj.x, obj.y, 10, {
              color: '#2ecc71', speedMin: 60, speedMax: 150,
              lifeMin: 0.4, lifeMax: 0.8, sizeMin: 3, sizeMax: 5,
            });
          }
        }
      }
    }

    if (obj.type === 'key_marker' && !obj.spawned) {
      // Ключ появляется через определённое время (враг спавнится)
      obj.spawnTime -= dt;
      if (obj.spawnTime <= 0) {
        obj.spawned = true;
        // Спавним "элитного" врага с ключом
        if (window.Game && window.Enemies && Game.enemies) {
          const pt = this.randomEnemySpawnPoint(player, 300, 500);
          if (pt) {
            Enemies.spawnByType(Game.enemies, 'captain', pt.x, pt.y);
            // Помечаем последнего заспавненного как носителя ключа
            const items = Game.enemies.items;
            for (let i = items.length - 1; i >= 0; i--) {
              if (items[i].active && items[i].type === 'captain') {
                items[i]._hasKey = true;
                items[i]._keyIcon = true;
                break;
              }
            }
          }
          if (window.Particles && player) {
            Particles.text(player.x, player.y - 40, 'ХРАНИТЕЛЬ КЛЮЧА ПОЯВИЛСЯ!', 2.0, '#ffd700', 14);
          }
        }
      }
    }
  }

  // Проверка подбора огненного сердца и ключа (из Campaign.specialObjects)
  if (Campaign.specialObjects) {
    for (const obj of Campaign.specialObjects) {
      if (obj.type === 'fire_heart' && !obj.pickedUp) {
        obj.pulse += dt * 4;
        const dx = player.x - obj.x, dy = player.y - obj.y;
        if (dx * dx + dy * dy < 40 * 40) {
          obj.pickedUp = true;
          Campaign.onFireHeartPickedUp();
        }
      }
    }
  }
};

/** Рендер кампейн-объектов. ctx уже в мировых координатах. */
GameMap.renderCampaignObjects = function(ctx, cam, viewW, viewH) {
  const t = this.time;

  for (const obj of this.campaignObjects) {
    // Проверка видимости
    const sx = obj.x - cam.x, sy = obj.y - cam.y;
    if (obj.x && (sx < -80 || sx > viewW + 80 || sy < -80 || sy > viewH + 80)) continue;

    if (obj.type === 'altar') {
      // Рунный алтарь
      const pulse = 1 + Math.sin(obj.pulse) * 0.1;
      const s = obj.size * pulse;
      if (obj.activated) {
        ctx.fillStyle = '#9b59b6';
        ctx.shadowColor = '#9b59b6';
        ctx.shadowBlur = 15;
      } else {
        ctx.fillStyle = '#4a4a6a';
        ctx.shadowColor = '#6a4aaa';
        ctx.shadowBlur = 8;
      }
      // Алтарь — ромб
      ctx.beginPath();
      ctx.moveTo(obj.x, obj.y - s / 2);
      ctx.lineTo(obj.x + s / 2, obj.y);
      ctx.lineTo(obj.x, obj.y + s / 2);
      ctx.lineTo(obj.x - s / 2, obj.y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // Буква
      ctx.fillStyle = obj.activated ? '#ffd700' : '#aaaacc';
      ctx.font = 'bold 14px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obj.activated ? '✓' : '⬡', obj.x, obj.y);

      // Рычаги
      for (const lev of obj.levers) {
        const lw = 16, lh = 16;
        ctx.fillStyle = lev.state === 1 ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(lev.x - lw / 2, lev.y - lh / 2, lw, lh);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(lev.x - lw / 2, lev.y - lh / 2, lw, lh);
        // Рукоять
        ctx.fillStyle = '#888';
        const handleY = lev.state === 1 ? lev.y - lh / 2 - 6 : lev.y + lh / 2;
        ctx.fillRect(lev.x - 2, handleY, 4, 6);
      }
    }

    if (obj.type === 'cage') {
      const s = obj.size;
      if (obj.opened) {
        // Открытая клетка
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.strokeRect(obj.x - s / 2, obj.y - s / 2, s, s);
        // Маг вышел
        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 18px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('M', obj.x, obj.y);
      } else {
        // Закрытая клетка — решётка
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(obj.x - s / 2, obj.y - s / 2, s, s);
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 2;
        ctx.strokeRect(obj.x - s / 2, obj.y - s / 2, s, s);
        // Решётки
        for (let i = 1; i < 4; i++) {
          const bx = obj.x - s / 2 + (s / 4) * i;
          ctx.beginPath();
          ctx.moveTo(bx, obj.y - s / 2);
          ctx.lineTo(bx, obj.y + s / 2);
          ctx.stroke();
        }
        // NPC внутри
        ctx.fillStyle = '#9b59b6';
        ctx.font = 'bold 16px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('M', obj.x, obj.y);
        // Замок
        if (!Campaign.hasKey) {
          ctx.fillStyle = '#ffd700';
          ctx.font = '10px ui-monospace, monospace';
          ctx.fillText('🔒', obj.x, obj.y + s / 2 + 8);
        } else {
          ctx.fillStyle = '#2ecc71';
          ctx.font = '10px ui-monospace, monospace';
          ctx.fillText('🔑', obj.x, obj.y + s / 2 + 8);
        }
      }
    }
  }

  // Рендер огненного сердца и других campaign special objects
  if (window.Campaign && Campaign.specialObjects) {
    for (const obj of Campaign.specialObjects) {
      if (obj.type === 'fire_heart' && !obj.pickedUp) {
        const sx2 = obj.x - cam.x, sy2 = obj.y - cam.y;
        if (sx2 < -50 || sx2 > viewW + 50 || sy2 < -50 || sy2 > viewH + 50) continue;
        const pulse = 1 + Math.sin((obj.pulse || 0)) * 0.15;
        const s = obj.size * pulse;
        ctx.shadowColor = '#ff6600';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ff8800';
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y - s);
        ctx.lineTo(obj.x + s * 0.7, obj.y);
        ctx.lineTo(obj.x, obj.y + s * 0.5);
        ctx.lineTo(obj.x - s * 0.7, obj.y);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 12px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('♦', obj.x, obj.y);
      }
    }
  }
};

/* ============================================================
   ШАГ 17: Интеграция новых загадок и ловушек в генерацию и цикл.
   ============================================================ */

/**
 * Разместить новые загадки и ловушки (Шаг 17) после генерации подземелья.
 * Вызывается в конце generateDungeon().
 */
GameMap._placeStep17Objects = function(dungeon, mapNumber, isCampaign) {
  if (!window.STEP17_CONFIG) return;

  // Инициализируем массивы
  dungeon.runePuzzles = [];
  dungeon.floorPuzzles = [];
  dungeon.boulders = [];
  dungeon.vanishingPlatforms = [];
  dungeon.magicFloorRunes = [];

  const cfg = STEP17_CONFIG;
  let genCfg;

  if (isCampaign && cfg.GENERATION.CAMPAIGN[mapNumber]) {
    genCfg = cfg.GENERATION.CAMPAIGN[mapNumber];
    if (genCfg.puzzles) {
      for (const pType of genCfg.puzzles) {
        if (pType === 'rune_puzzle') GameMap._placeRunePuzzle(dungeon, mapNumber);
        else if (pType === 'floor_puzzle') GameMap._placeFloorPuzzle(dungeon, mapNumber);
      }
    }
    GameMap._placeBoulders(dungeon, genCfg.boulders || 0);
    GameMap._placeVanishingPlatforms(dungeon, genCfg.platforms || 0);
    GameMap._placeMagicFloorRunes(dungeon, genCfg.magicRunes || 0);
  } else {
    genCfg = cfg.GENERATION.INFINITE;
    const puzzleCount = Utils.randInt(genCfg.PUZZLES_MIN, genCfg.PUZZLES_MAX);
    for (let i = 0; i < puzzleCount; i++) {
      const roll = Math.random();
      if (roll < 0.4) GameMap._placeRunePuzzle(dungeon, mapNumber);
      else if (roll < 0.8) GameMap._placeFloorPuzzle(dungeon, mapNumber);
    }
    GameMap._placeBoulders(dungeon, Utils.randInt(genCfg.BOULDERS_MIN, genCfg.BOULDERS_MAX));
    GameMap._placeVanishingPlatforms(dungeon, Utils.randInt(genCfg.PLATFORMS_MIN, genCfg.PLATFORMS_MAX));
    GameMap._placeMagicFloorRunes(dungeon, Utils.randInt(genCfg.MAGIC_RUNES_MIN, genCfg.MAGIC_RUNES_MAX));
  }
};

GameMap._placeRunePuzzle = function(dungeon, mapNumber) {
  if (!window.RunePuzzle) return;
  const candidates = dungeon.rooms.filter(r => !r.isStart && !r.isSecret && !r.isPuzzle && r.w >= 200 && r.h >= 150);
  if (candidates.length === 0) return;
  const room = candidates[Math.floor(Math.random() * candidates.length)];
  room.isPuzzle = true;
  const runeCount = (STEP17_CONFIG.RUNE_PUZZLE.RUNES_BY_MAP[mapNumber]) || 4;
  const puzzle = RunePuzzle.create(room, runeCount);
  dungeon.runePuzzles.push(puzzle);
};

GameMap._placeFloorPuzzle = function(dungeon, mapNumber) {
  if (!window.FloorPuzzle) return;
  const candidates = dungeon.rooms.filter(r => !r.isStart && !r.isSecret && !r.isPuzzle && r.w >= 200 && r.h >= 150);
  if (candidates.length === 0) return;
  const room = candidates[Math.floor(Math.random() * candidates.length)];
  room.isPuzzle = true;
  const plateCfg = (STEP17_CONFIG.FLOOR_PUZZLE.PLATES_BY_MAP[mapNumber]) || { plates: 5, seq: 3 };
  const puzzle = FloorPuzzle.create(room, plateCfg.plates, plateCfg.seq);
  dungeon.floorPuzzles.push(puzzle);
};

GameMap._placeBoulders = function(dungeon, count) {
  if (!window.Boulder || count <= 0) return;
  const cfg = STEP17_CONFIG.BOULDER;
  const suitableCorridors = dungeon.corridors.filter(c => Math.max(c.w, c.h) >= cfg.MIN_CORRIDOR_LEN);
  if (suitableCorridors.length === 0) return;
  const maxBoulders = Math.min(count, cfg.MAX_PER_MAP, suitableCorridors.length);
  const shuffled = suitableCorridors.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (let i = 0; i < maxBoulders; i++) {
    dungeon.boulders.push(Boulder.create(shuffled[i]));
  }
};

GameMap._placeVanishingPlatforms = function(dungeon, count) {
  if (!window.VanishingPlatform || count <= 0) return;
  const cfg = STEP17_CONFIG.VANISHING_PLATFORM;
  const maxPlat = Math.min(count, cfg.MAX_PER_MAP);
  const candidates = dungeon.rooms.filter(r => !r.isStart && !r.isSecret && r.w >= 200 && r.h >= 150);
  if (candidates.length === 0) return;
  let placed = 0;
  for (let attempt = 0; attempt < 50 && placed < maxPlat; attempt++) {
    const room = candidates[Math.floor(Math.random() * candidates.length)];
    const x = room.x + 60 + Math.random() * (room.w - 120 - cfg.SIZE);
    const y = room.y + 60 + Math.random() * (room.h - 120 - cfg.SIZE);
    let ok = true;
    for (const p of dungeon.pillars) {
      if (GameMap._rectsOverlap(x, y, cfg.SIZE, cfg.SIZE, p.x - 10, p.y - 10, p.w + 20, p.h + 20)) {
        ok = false; break;
      }
    }
    if (!ok) continue;
    dungeon.vanishingPlatforms.push(VanishingPlatform.create(x, y));
    placed++;
  }
};

GameMap._placeMagicFloorRunes = function(dungeon, count) {
  if (!window.MagicFloorRune || count <= 0) return;
  const candidates = dungeon.rooms.filter(r => !r.isStart && !r.isSecret);
  if (candidates.length === 0) return;
  let placed = 0;
  for (let attempt = 0; attempt < 100 && placed < count; attempt++) {
    const room = candidates[Math.floor(Math.random() * candidates.length)];
    const x = room.x + 40 + Math.random() * (room.w - 80);
    const y = room.y + 40 + Math.random() * (room.h - 80);
    let ok = true;
    for (const rune of dungeon.magicFloorRunes) {
      const dx = x - rune.x, dy = y - rune.y;
      if (dx * dx + dy * dy < 60 * 60) { ok = false; break; }
    }
    if (!ok) continue;
    dungeon.magicFloorRunes.push(MagicFloorRune.create(x, y));
    placed++;
  }
};

/** Обновить объекты Шага 17 (вызывается из GameMap.update). */
GameMap.updateStep17 = function(dt, player) {
  if (!this.dungeon || !player) return;

  if (this.dungeon.runePuzzles) {
    for (const puzzle of this.dungeon.runePuzzles) {
      const ev = RunePuzzle.update(puzzle, player, dt);
      if (ev) GameMap._handlePuzzleEvent(ev, player);
    }
  }
  if (this.dungeon.floorPuzzles) {
    for (const puzzle of this.dungeon.floorPuzzles) {
      const ev = FloorPuzzle.update(puzzle, player, dt);
      if (ev) GameMap._handlePuzzleEvent(ev, player);
    }
  }
  if (this.dungeon.boulders) {
    const enemies = (window.Game && Game.enemies) ? Game.enemies : null;
    for (const boulder of this.dungeon.boulders) {
      const ev = Boulder.update(boulder, player, enemies, dt);
      if (ev && ev.type === 'hit_player') {
        player.hp -= ev.damage;
        player.x += ev.knockX;
        player.y += ev.knockY;
        player.x = Utils.clamp(player.x, 20, GameMap.mapW - 20);
        player.y = Utils.clamp(player.y, 20, GameMap.mapH - 20);
        if (window.Particles) {
          Particles.burst(player.x, player.y, 6, {
            color: '#aaaaaa', speedMin: 60, speedMax: 140,
            lifeMin: 0.2, lifeMax: 0.4, sizeMin: 3, sizeMax: 5,
          });
        }
      }
    }
  }
  if (this.dungeon.vanishingPlatforms) {
    const enemies = (window.Game && Game.enemies) ? Game.enemies : null;
    for (const plat of this.dungeon.vanishingPlatforms) {
      const ev = VanishingPlatform.update(plat, player, enemies, dt);
      if (ev && ev.type === 'player_fell') {
        player.hp -= ev.damage;
        const safePos = GameMap._findSafePosition(player.x, player.y, plat);
        if (safePos) { player.x = safePos.x; player.y = safePos.y; }
        player._stunTimer = ev.stunDuration;
        if (window.Particles) {
          Particles.burst(player.x, player.y, 4, {
            color: '#333333', speedMin: 40, speedMax: 100,
            lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
          });
        }
      }
    }
  }
  if (this.dungeon.magicFloorRunes) {
    for (const rune of this.dungeon.magicFloorRunes) {
      const ev = MagicFloorRune.update(rune, player, dt);
      if (ev) GameMap._handleMagicRuneEvent(ev, player);
    }
  }
};

GameMap._handlePuzzleEvent = function(event, player) {
  if (event.type === 'solved') {
    if (window.Game && !event.puzzle.rewardSpawned) {
      event.puzzle.rewardSpawned = true;
      const room = event.puzzle.room;
      const c = Chest.create();
      c.x = room.cx; c.y = room.cy + 30;
      c.guaranteedRare = true;
      if (window.Particles) Particles.chestGlow(c.x, c.y);
      Game.secretChest = c;
      if (window.Particles) {
        Particles.burst(c.x, c.y, 10, { color: '#ffd700', speedMin: 60, speedMax: 160, lifeMin: 0.4, lifeMax: 0.8, sizeMin: 3, sizeMax: 6 });
        Particles.text(player.x, player.y - 40, 'ЗАГАДКА РЕШЕНА!', 1.5, '#ffd700', 14);
      }
    }
  } else if (event.type === 'error') {
    player.hp -= event.damage || 5;
    if (window.Particles) {
      Particles.burst(player.x, player.y, 4, { color: '#ff3333', speedMin: 40, speedMax: 100, lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4 });
      Particles.text(player.x, player.y - 30, 'ОШИБКА!', 1.0, '#ff3333', 12);
    }
    if (window.Enemies && window.Game && Game.enemies) {
      const count = event.damage >= 10 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 40;
        Enemies.spawnByType(Game.enemies, 'skeleton', player.x + Math.cos(ang) * dist, player.y + Math.sin(ang) * dist);
      }
    }
  }
};

GameMap._handleMagicRuneEvent = function(event, player) {
  switch (event.type) {
    case 'fire': {
      const dx = player.x - event.x, dy = player.y - event.y;
      if (dx * dx + dy * dy <= event.radius * event.radius) player.hp -= event.damage;
      if (window.Game && Game.enemies) {
        const items = Game.enemies.items;
        for (let i = 0; i < items.length; i++) {
          const e = items[i];
          if (!e.active) continue;
          const edx = e.x - event.x, edy = e.y - event.y;
          if (edx * edx + edy * edy <= event.radius * event.radius) {
            e.hp -= event.damage;
            if (e.hp <= 0) Game.killEnemy(e);
          }
        }
      }
      if (window.Particles) Particles.burst(event.x, event.y, 12, { color: '#ff4400', speedMin: 80, speedMax: 200, lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 6 });
      break;
    }
    case 'ice': {
      const dx = player.x - event.x, dy = player.y - event.y;
      if (dx * dx + dy * dy <= 60 * 60) {
        player.hp -= event.damage;
        player._iceSlow = event.slowPct;
        player._iceSlowTimer = event.slowDuration;
      }
      if (window.Particles) Particles.burst(event.x, event.y, 8, { color: '#44aaff', speedMin: 60, speedMax: 140, lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 5 });
      break;
    }
    case 'dark': {
      if (window.Enemies && window.Game && Game.enemies) {
        const biome = GameMap.currentBiome;
        const pool = biome && biome.enemyTypes ? biome.enemyTypes : ['skeleton'];
        for (let i = 0; i < event.spawnCount; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 40 + Math.random() * 30;
          const typeId = pool[Math.floor(Math.random() * Math.min(5, pool.length))];
          Enemies.spawnByType(Game.enemies, typeId, event.x + Math.cos(ang) * dist, event.y + Math.sin(ang) * dist);
        }
      }
      if (window.Particles) Particles.burst(event.x, event.y, 8, { color: '#9933ff', speedMin: 50, speedMax: 120, lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 5 });
      break;
    }
    case 'teleport': {
      const safePos = GameMap._findRandomSafePosition();
      if (safePos) { player.x = safePos.x; player.y = safePos.y; }
      if (window.Particles) {
        Particles.burst(event.x, event.y, 10, { color: '#ffdd00', speedMin: 80, speedMax: 200, lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 5 });
        Particles.burst(player.x, player.y, 10, { color: '#ffdd00', speedMin: 80, speedMax: 200, lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 5 });
      }
      break;
    }
    case 'heal': {
      player.hp = Math.min(player.maxHp, player.hp + event.amount);
      if (window.Particles) {
        Particles.burst(event.x, event.y, 8, { color: '#33ff66', speedMin: 40, speedMax: 100, lifeMin: 0.4, lifeMax: 0.7, sizeMin: 2, sizeMax: 4 });
        Particles.text(player.x, player.y - 30, '+' + event.amount + ' HP', 1.0, '#33ff66', 12);
      }
      break;
    }
  }
};

GameMap._findSafePosition = function(x, y, platform) {
  const offsets = [
    { x: -platform.w - 20, y: 0 }, { x: platform.w + 20, y: 0 },
    { x: 0, y: -platform.h - 20 }, { x: 0, y: platform.h + 20 },
  ];
  for (const off of offsets) {
    const nx = x + off.x, ny = y + off.y;
    if (nx > 20 && nx < GameMap.mapW - 20 && ny > 20 && ny < GameMap.mapH - 20) {
      if (GameMap.dungeon && GameMap.dungeon.grid) {
        const cs = GameMap.dungeon.cellSize;
        const gx = Math.floor(nx / cs), gy = Math.floor(ny / cs);
        if (gx >= 0 && gx < GameMap.dungeon.gridW && gy >= 0 && gy < GameMap.dungeon.gridH) {
          if (GameMap.dungeon.grid[gy * GameMap.dungeon.gridW + gx] === 1) return { x: nx, y: ny };
        }
      } else return { x: nx, y: ny };
    }
  }
  return { x, y: y - 40 };
};

GameMap._findRandomSafePosition = function() {
  if (!GameMap.dungeon || !GameMap.dungeon.rooms) return null;
  const rooms = GameMap.dungeon.rooms.filter(r => !r.isSecret);
  if (rooms.length === 0) return null;
  // Bug fix #6.1: Проверяем проходимость точки телепортации (до 10 попыток)
  for (let attempt = 0; attempt < 10; attempt++) {
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const x = room.x + 40 + Math.random() * (room.w - 80);
    const y = room.y + 40 + Math.random() * (room.h - 80);
    // Проверяем, что точка проходима
    if (GameMap.dungeon.grid) {
      const cell = GameMap.dungeon.cellSize;
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      if (gx >= 0 && gx < GameMap.dungeon.gridW && gy >= 0 && gy < GameMap.dungeon.gridH) {
        if (GameMap.dungeon.grid[gy * GameMap.dungeon.gridW + gx] === 1) {
          // Дополнительно проверяем что нет колонн/объектов рядом
          if (!GameMap.rectIsWalkable || GameMap.rectIsWalkable(x, y, 12)) {
            return { x, y };
          }
        }
      }
    } else {
      return { x, y };
    }
  }
  // Фоллбэк: центр случайной комнаты (гарантированно свободен)
  const fallbackRoom = rooms[Math.floor(Math.random() * rooms.length)];
  return { x: fallbackRoom.cx || fallbackRoom.x + fallbackRoom.w / 2, y: fallbackRoom.cy || fallbackRoom.y + fallbackRoom.h / 2 };
};

/** Отрисовать объекты Шага 17 (вызывается из GameMap.render). */
GameMap.renderStep17 = function(ctx, cam, viewW, viewH) {
  if (!this.dungeon) return;
  if (this.dungeon.magicFloorRunes) {
    for (const rune of this.dungeon.magicFloorRunes) MagicFloorRune.render(ctx, rune, cam, viewW, viewH);
  }
  if (this.dungeon.vanishingPlatforms) {
    for (const plat of this.dungeon.vanishingPlatforms) VanishingPlatform.render(ctx, plat, cam, viewW, viewH);
  }
  if (this.dungeon.runePuzzles) {
    for (const puzzle of this.dungeon.runePuzzles) RunePuzzle.render(ctx, puzzle, cam, viewW, viewH);
  }
  if (this.dungeon.floorPuzzles) {
    for (const puzzle of this.dungeon.floorPuzzles) FloorPuzzle.render(ctx, puzzle, cam, viewW, viewH);
  }
  if (this.dungeon.boulders) {
    for (const boulder of this.dungeon.boulders) Boulder.render(ctx, boulder, cam, viewW, viewH);
  }
};

window.GameMap = GameMap;

