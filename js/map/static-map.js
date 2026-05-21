'use strict';
/* ============================================================
   static-map.js — Загрузчик предопределённых (статических) карт
   для сюжетной кампании. Интегрируется с GameMap.

   Формат карты (StoryMapData):
   {
     id: string,
     width: number (в тайлах),
     height: number (в тайлах),
     tileSize: number (px, обычно 20),
     tiles: number[][] (2D массив: 0=стена, 1=пол, 2=дверь, 3=лава,
                        4=вода, 5=болото, 6=алтарь, 7=портал),
     entities: Array<{type, x, y, ...props}>,
     triggers: Array<{kind, x, y, w, h, ...props}>,
     rooms: Array<{x,y,w,h}> (для спавна),
     startPos: {x, y},
     bossArena: {x, y, w, h}
   }

   Экспорт: window.StaticMap
   ============================================================ */


const TILE_TYPES = {
  WALL: 0,
  FLOOR: 1,
  DOOR: 2,
  LAVA: 3,
  WATER: 4,
  SWAMP: 5,
  ALTAR: 6,
  PORTAL: 7,
  MUSHROOM: 8,
  GRASS: 9,
  OBSIDIAN: 10,
  CARPET: 11,
  BRIDGE: 12,
};

const TILE_COLORS = {
  0: '#1a1a2e',    // wall
  1: '#3d3d5c',    // floor
  2: '#8b6914',    // door
  3: '#ff4400',    // lava
  4: '#2266aa',    // water
  5: '#3d5c3d',    // swamp
  6: '#9b59b6',    // altar
  7: '#00ccff',    // portal
  8: '#4a7a4a',    // mushroom
  9: '#2d5a27',    // grass
  10: '#0d0d0d',   // obsidian
  11: '#8b0000',   // carpet
  12: '#6b4a2b',   // bridge
};


/* Какие тайлы проходимы */
const WALKABLE_TILES = new Set([
  TILE_TYPES.FLOOR, TILE_TYPES.DOOR, TILE_TYPES.LAVA,
  TILE_TYPES.WATER, TILE_TYPES.SWAMP, TILE_TYPES.ALTAR,
  TILE_TYPES.PORTAL, TILE_TYPES.MUSHROOM, TILE_TYPES.GRASS,
  TILE_TYPES.OBSIDIAN, TILE_TYPES.CARPET, TILE_TYPES.BRIDGE,
]);

/* Тайлы с эффектами урона/замедления */
const TILE_EFFECTS = {
  [TILE_TYPES.LAVA]:  { dps: 10, slow: 0 },
  [TILE_TYPES.WATER]: { dps: 0,  slow: 0.25 },
  [TILE_TYPES.SWAMP]: { dps: 0,  slow: 0.35 },
};


const StaticMap = {
  /** @type {Object|null} Текущие данные статической карты */
  currentData: null,
  /** @type {boolean} Активна ли статическая карта */
  active: false,
  /** @type {Array} Активные триггеры на карте */
  activeTriggers: [],
  /** @type {Array} Собранные предметы */
  collectedItems: [],
  /** @type {Object} Состояние дверей {key: boolean} */
  doorStates: {},
  /** @type {Array} Активные руны (ещё не подобранные) */
  activeRunes: [],
  /** @type {Array} Спавнённые враги (трекинг) */
  spawnedEnemies: [],


  /**
   * Загрузить статическую карту в движок GameMap.
   * Заменяет процедурную генерацию для сюжетных глав.
   * @param {Object} mapData — данные карты (StoryMapData)
   * @param {Object} biome — биом для визуальной темы
   */
  load(mapData, biome) {
    if (!mapData || !window.GameMap) return;
    this.currentData = mapData;
    this.active = true;
    this.activeTriggers = [];
    this.collectedItems = [];
    this.doorStates = {};
    this.activeRunes = [];
    this.spawnedEnemies = [];

    const cs = mapData.tileSize || 20;
    const pixW = mapData.width * cs;
    const pixH = mapData.height * cs;

    // Обновляем размеры GameMap
    GameMap.mapW = pixW;
    GameMap.mapH = pixH;
    CONFIG.MAP.W = pixW;
    CONFIG.MAP.H = pixH;
    GameMap.currentBiome = biome || { id: 'crypt' };
    GameMap.currentMapNumber = mapData.id || 1;
    GameMap.portal = null;
    GameMap.time = 0;


    // Строим grid из тайлов
    const gw = mapData.width;
    const gh = mapData.height;
    const grid = new Uint8Array(gw * gh);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const tile = mapData.tiles[y][x];
        grid[y * gw + x] = WALKABLE_TILES.has(tile) ? 1 : 0;
      }
    }

    // Строим dungeon-объект совместимый с GameMap
    const rooms = (mapData.rooms || []).map(r => ({
      x: r.x * cs, y: r.y * cs,
      w: r.w * cs, h: r.h * cs,
      cx: (r.x + r.w / 2) * cs,
      cy: (r.y + r.h / 2) * cs,
      isStart: !!r.isStart,
      isPuzzle: false, isSecret: false, hasMosaic: false,
    }));

    const startRoom = rooms.find(r => r.isStart) || rooms[0] || {
      x: 100, y: 100, w: 200, h: 200, cx: 200, cy: 200, isStart: true
    };


    GameMap.dungeon = {
      rooms: rooms,
      corridors: [],
      pillars: [],
      sarcophagi: [],
      walls: [],
      traps: [],
      levers: [],
      secretDoor: null,
      decor: { torches: [], runes: [], webs: [] },
      grid: grid,
      gridW: gw,
      gridH: gh,
      cellSize: cs,
      startRoom: startRoom,
      secretChestPos: null,
      biome: biome || { id: 'crypt' },
      mapNumber: mapData.id || 1,
    };

    // Инициализируем триггеры (ловушки, руны, двери, ключи)
    if (mapData.triggers) {
      for (const tr of mapData.triggers) {
        this.activeTriggers.push({ ...tr, _active: true, _cooldown: 0 });
      }
    }


    // Инициализируем руны
    if (mapData.triggers) {
      for (const tr of mapData.triggers) {
        if (tr.kind.startsWith('rune_')) {
          this.activeRunes.push({
            id: tr.kind, x: tr.x * cs + cs / 2,
            y: tr.y * cs + cs / 2, collected: false,
            effect: tr.effect || {}, pulse: 0,
          });
        }
      }
    }

    // Спавним врагов из entities
    this._spawnEntities(mapData, cs);

    // Строим кэш пола для рендеринга
    this._buildFloorCache(mapData, cs, biome);

    // Размещаем факелы в коридорах
    this._placeTorches(mapData, cs);
  },


  /** Спавн врагов из mapData.entities */
  _spawnEntities(mapData, cs) {
    if (!mapData.entities || !window.Game || !window.Enemies) return;
    // Отложенный спавн (после инициализации Game.enemies)
    setTimeout(() => {
      if (!Game.enemies) return;
      for (const ent of mapData.entities) {
        const px = ent.x * cs + cs / 2;
        const py = ent.y * cs + cs / 2;
        if (ent.type === 'boss') {
          // Боссы спавнятся через Campaign
          continue;
        }
        const e = Enemies.spawnByType(Game.enemies, ent.type, px, py);
        if (e) {
          if (ent.elite) e._elite = true;
          if (ent.hpMul) { e.hp *= ent.hpMul; e.maxHp = e.hp; }
          if (ent.damageMul) e.damage *= ent.damageMul;
          if (ent.guardKey) e._guardKey = ent.guardKey;
          this.spawnedEnemies.push(e);
        }
      }
    }, 200);
  },


  /** Строим offscreen canvas для фона */
  _buildFloorCache(mapData, cs, biome) {
    const w = mapData.width * cs;
    const h = mapData.height * cs;
    // Ограничиваем размер кэша для производительности
    const maxDim = 2048;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    const cw = Math.floor(w * scale);
    const ch = Math.floor(h * scale);

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // ВАЖНО: присваиваем кэш СРАЗУ, до рисования тайлов
    // Если рисование бросит ошибку, будет хотя бы пустой canvas вместо null (чёрного экрана)
    GameMap._floorCache = canvas;
    GameMap._floorCacheScale = scale;

    const biomeColors = this._getBiomeColors(biome);

    for (let y = 0; y < mapData.height; y++) {
      for (let x = 0; x < mapData.width; x++) {
        const tile = mapData.tiles[y][x];
        const px = x * cs;
        const py = y * cs;
        ctx.fillStyle = biomeColors[tile] || TILE_COLORS[tile] || '#222';
        ctx.fillRect(px, py, cs, cs);

        // Добавляем текстуру/вариацию
        if (tile === TILE_TYPES.FLOOR || tile === TILE_TYPES.GRASS) {
          ctx.fillStyle = 'rgba(0,0,0,0.05)';
          if ((x + y) % 3 === 0) ctx.fillRect(px, py, cs, cs);
        }
        if (tile === TILE_TYPES.LAVA) {
          ctx.fillStyle = 'rgba(255,200,0,0.2)';
          if ((x + y) % 2 === 0) ctx.fillRect(px, py, cs, cs);
        }
      }
    }
    // (кэш уже присвоен в начале метода)
  },


  /** Цвета тайлов по биому */
  _getBiomeColors(biome) {
    if (!biome) return TILE_COLORS;
    const id = biome.id || '';
    const colors = { ...TILE_COLORS };
    switch (id) {
      case 'catacombs':
        colors[1] = '#2e2e3e'; colors[0] = '#0f0f1a';
        colors[8] = '#3a6b3a'; break;
      case 'cursed_forest':
        colors[1] = '#2d4a1e'; colors[0] = '#1a2e0f';
        colors[9] = '#3d7a2d'; break;
      case 'fire_crucible':
        colors[1] = '#3d2020'; colors[0] = '#1a0a0a';
        colors[10] = '#1a1a1a'; break;
      case 'dark_throne':
        colors[1] = '#2a2a3a'; colors[0] = '#0a0a14';
        colors[11] = '#6b0000'; break;
    }
    return colors;
  },


  /** Размещение факелов вдоль стен */
  _placeTorches(mapData, cs) {
    if (!GameMap.dungeon) return;
    const torches = [];
    for (let y = 1; y < mapData.height - 1; y++) {
      for (let x = 1; x < mapData.width - 1; x++) {
        const tile = mapData.tiles[y][x];
        if (tile !== TILE_TYPES.FLOOR && tile !== TILE_TYPES.CARPET) continue;
        // Проверяем стену сверху
        if (mapData.tiles[y - 1][x] === TILE_TYPES.WALL) {
          if ((x + y * 7) % 11 === 0) {
            torches.push({ x: x * cs + cs / 2, y: y * cs + 4, phase: Math.random() * 6.28 });
          }
        }
      }
    }
    GameMap.dungeon.decor.torches = torches;
  },


  /**
   * Обновление триггеров каждый кадр.
   * Проверяет: ловушки, руны, ключи, двери.
   */
  update(dt, player) {
    if (!this.active || !player) return;

    // Эффекты тайлов под игроком (лава, вода, болото)
    this._applyTileEffects(player, dt);

    // Шаг 5: Обновляем триггеры с distance-based culling
    const cs = this.currentData ? (this.currentData.tileSize || 20) : 20;
    const triggerCheckRadius = 300; // Проверять только ближайшие триггеры
    const px = player.x, py = player.y;

    for (let i = 0; i < this.activeTriggers.length; i++) {
      const tr = this.activeTriggers[i];
      if (!tr._active) continue;
      tr._cooldown = Math.max(0, (tr._cooldown || 0) - dt);

      // Шаг 5: Пропуск далёких триггеров (кроме глобальных)
      const trX = tr.x * cs, trY = tr.y * cs;
      const dx = px - trX, dy = py - trY;
      if (dx * dx + dy * dy > triggerCheckRadius * triggerCheckRadius) continue;

      switch (tr.kind) {
        case 'spike_pit': this._updateSpikePit(tr, player, dt); break;
        case 'spore_cloud': this._updateSporeCloud(tr, player, dt); break;
        case 'poison_vine': this._updatePoisonVine(tr, player, dt); break;
        case 'wolf_trap': this._updateWolfTrap(tr, player, dt); break;
        case 'fire_geyser': this._updateFireGeyser(tr, player, dt); break;
        case 'burning_floor': this._updateBurningFloor(tr, player, dt); break;
        case 'magic_mine': this._updateMagicMine(tr, player, dt); break;
        case 'dart_trap': this._updateDartTrap(tr, player, dt); break;
        case 'cursed_book': this._updateCursedBook(tr, player, dt); break;
        case 'locked_door': this._updateLockedDoor(tr, player, dt); break;
        case 'chest': this._updateChest(tr, player, dt); break;
      }
    }


    // Обновляем руны (только не подобранные, с distance check)
    for (let i = 0; i < this.activeRunes.length; i++) {
      const rune = this.activeRunes[i];
      if (rune.collected) continue;
      rune.pulse += dt * 4;
      const dx = player.x - rune.x, dy = player.y - rune.y;
      if (dx * dx + dy * dy < 30 * 30) {
        rune.collected = true;
        this._applyRuneEffect(rune, player);
      }
    }

    // Проверяем ключи от убитых врагов
    this._checkKeyDrops();
  },


  /** Эффекты тайлов (лава/вода/болото) */
  _applyTileEffects(player, dt) {
    if (!this.currentData) return;
    const cs = this.currentData.tileSize || 20;
    const tx = Math.floor(player.x / cs);
    const ty = Math.floor(player.y / cs);
    if (tx < 0 || ty < 0 || tx >= this.currentData.width || ty >= this.currentData.height) return;
    const tile = this.currentData.tiles[ty][tx];
    const effect = TILE_EFFECTS[tile];
    if (effect) {
      if (effect.dps > 0) {
        const dmg = effect.dps * dt * (player.maxHp / 100);
        if (Player.takeDamage) Player.takeDamage(player, dmg, null);
        else player.hp -= dmg;
      }
      if (effect.slow > 0) {
        player._tileSlow = effect.slow;
        player._tileSlowTimer = 0.2;
      }
    }
  },


  /** Ловушка: яма с шипами */
  _updateSpikePit(tr, player, dt) {
    const cs = this.currentData.tileSize || 20;
    const cx = tr.x * cs + (tr.w || 1) * cs / 2;
    const cy = tr.y * cs + (tr.h || 1) * cs / 2;
    const r = (tr.w || 1) * cs / 2;
    const dx = player.x - cx, dy = player.y - cy;
    if (dx * dx + dy * dy < r * r && tr._cooldown <= 0) {
      const dmg = player.maxHp * (tr.damagePct || 0.20);
      if (Player.takeDamage) Player.takeDamage(player, dmg, null);
      else player.hp -= dmg;
      tr._cooldown = 2.0;
      if (window.Particles) {
        Particles.burst(cx, cy, 6, { color: '#888', speedMin: 40, speedMax: 100,
          lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4 });
      }
    }
  },

  /** Ловушка: облако спор */
  _updateSporeCloud(tr, player, dt) {
    const cs = this.currentData.tileSize || 20;
    const cx = tr.x * cs + (tr.w || 3) * cs / 2;
    const cy = tr.y * cs + (tr.h || 3) * cs / 2;
    const r = (tr.w || 3) * cs / 2;
    const dx = player.x - cx, dy = player.y - cy;
    if (dx * dx + dy * dy < r * r) {
      if (!player._poisoned || player._poisonTimer <= 0) {
        player._poisoned = true;
        player._poisonTimer = tr.duration || 3;
        player._poisonDps = player.maxHp * (tr.dpsPct || 0.05);
      }
    }
  },


  /** Ловушка: ядовитые лианы */
  _updatePoisonVine(tr, player, dt) {
    const cs = this.currentData.tileSize || 20;
    const cx = tr.x * cs + cs / 2;
    const cy = tr.y * cs + cs / 2;
    const dx = player.x - cx, dy = player.y - cy;
    if (dx * dx + dy * dy < cs * cs && tr._cooldown <= 0) {
      const dmg = player.maxHp * (tr.damagePct || 0.15);
      if (Player.takeDamage) Player.takeDamage(player, dmg, null);
      else player.hp -= dmg;
      player._tileSlow = 0.4;
      player._tileSlowTimer = tr.slowDuration || 3;
      tr._cooldown = 3.0;
    }
  },

  /** Ловушка: капкан */
  _updateWolfTrap(tr, player, dt) {
    if (tr._triggered) return;
    const cs = this.currentData.tileSize || 20;
    const cx = tr.x * cs + cs / 2;
    const cy = tr.y * cs + cs / 2;
    const dx = player.x - cx, dy = player.y - cy;
    if (dx * dx + dy * dy < cs * cs) {
      tr._triggered = true;
      const dmg = player.maxHp * (tr.damagePct || 0.25);
      if (Player.takeDamage) Player.takeDamage(player, dmg, null);
      else player.hp -= dmg;
      player._tileSlow = 1.0; // полная остановка
      player._tileSlowTimer = tr.stunDuration || 2;
      if (window.Particles) {
        Particles.burst(cx, cy, 8, { color: '#aaa', speedMin: 50, speedMax: 120,
          lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 4 });
      }
    }
  },


  /** Ловушка: огненный гейзер */
  _updateFireGeyser(tr, player, dt) {
    const cs = this.currentData.tileSize || 20;
    const cx = tr.x * cs + cs / 2;
    const cy = tr.y * cs + cs / 2;
    tr._timer = (tr._timer || 0) + dt;
    const interval = tr.interval || 5;
    if (tr._timer >= interval) {
      tr._timer = 0;
      tr._erupting = true;
      setTimeout(() => { tr._erupting = false; }, 800);
      // Проверка попадания
      const r = (tr.radius || 1) * cs;
      const dx = player.x - cx, dy = player.y - cy;
      if (dx * dx + dy * dy < r * r) {
        const dmg = player.maxHp * (tr.damagePct || 0.30);
        if (Player.takeDamage) Player.takeDamage(player, dmg, null);
        else player.hp -= dmg;
      }
      if (window.Particles) {
        Particles.burst(cx, cy, 10, { color: '#ff4400', speedMin: 80, speedMax: 200,
          lifeMin: 0.4, lifeMax: 0.8, sizeMin: 3, sizeMax: 6 });
      }
    }
  },

  /** Ловушка: обжигающий пол */
  _updateBurningFloor(tr, player, dt) {
    const cs = this.currentData.tileSize || 20;
    const cx = tr.x * cs + cs / 2;
    const cy = tr.y * cs + cs / 2;
    const dx = player.x - cx, dy = player.y - cy;
    if (dx * dx + dy * dy < cs * cs) {
      const dmg = player.maxHp * (tr.dpsPct || 0.05) * dt;
      if (Player.takeDamage) Player.takeDamage(player, dmg, null);
      else player.hp -= dmg;
    }
  },


  /** Ловушка: магическая мина */
  _updateMagicMine(tr, player, dt) {
    if (tr._triggered) return;
    const cs = this.currentData.tileSize || 20;
    const cx = tr.x * cs + cs / 2;
    const cy = tr.y * cs + cs / 2;
    const dx = player.x - cx, dy = player.y - cy;
    if (dx * dx + dy * dy < cs * cs) {
      tr._triggered = true;
      const dmg = player.maxHp * (tr.damagePct || 0.25);
      if (Player.takeDamage) Player.takeDamage(player, dmg, null);
      else player.hp -= dmg;
      // Отбрасывание
      const dist = Math.hypot(dx, dy) || 1;
      player.x += (dx / dist) * 40;
      player.y += (dy / dist) * 40;
      if (window.Particles) {
        Particles.burst(cx, cy, 12, { color: '#9b59b6', speedMin: 80, speedMax: 200,
          lifeMin: 0.3, lifeMax: 0.7, sizeMin: 3, sizeMax: 6 });
      }
    }
  },

  /** Ловушка: дротики */
  _updateDartTrap(tr, player, dt) {
    const cs = this.currentData.tileSize || 20;
    const startX = tr.x * cs;
    const y = tr.y * cs + cs / 2;
    const endX = (tr.x + (tr.w || 5)) * cs;
    if (player.y > y - cs / 2 && player.y < y + cs / 2 &&
        player.x > startX && player.x < endX && tr._cooldown <= 0) {
      const dmg = player.maxHp * (tr.damagePct || 0.10);
      if (Player.takeDamage) Player.takeDamage(player, dmg, null);
      else player.hp -= dmg;
      player._poisoned = true;
      player._poisonTimer = 3;
      player._poisonDps = player.maxHp * 0.03;
      tr._cooldown = 3.0;
    }
  },


  /** Ловушка: проклятая книга */
  _updateCursedBook(tr, player, dt) {
    if (tr._triggered) return;
    const cs = this.currentData.tileSize || 20;
    const cx = tr.x * cs + cs / 2;
    const cy = tr.y * cs + cs / 2;
    const dx = player.x - cx, dy = player.y - cy;
    if (dx * dx + dy * dy < cs * 1.5 * cs * 1.5) {
      tr._triggered = true;
      // Случайный дебафф
      const debuffs = ['slow', 'armor_down', 'silence'];
      const chosen = debuffs[Math.floor(Math.random() * debuffs.length)];
      player['_debuff_' + chosen] = true;
      player['_debuff_' + chosen + '_timer'] = 30;
      if (chosen === 'slow') player._tileSlow = 0.3;
      if (window.Particles) {
        Particles.burst(cx, cy, 8, { color: '#4a0080', speedMin: 40, speedMax: 100,
          lifeMin: 0.5, lifeMax: 1.0, sizeMin: 2, sizeMax: 5 });
        Particles.text(cx, cy - 20, t('story_cursed'), 1.5, '#a040ff', 12);
      }
    }
  },

  /** Триггер: закрытая дверь */
  _updateLockedDoor(tr, player, dt) {
    if (tr._opened) return;
    const cs = this.currentData.tileSize || 20;
    const cx = tr.x * cs + cs / 2;
    const cy = tr.y * cs + cs / 2;
    // Проверяем есть ли ключ
    const requiredKey = tr.requiredKey;
    if (this.collectedItems.includes(requiredKey)) {
      // Авто-открытие при подходе
      const dx = player.x - cx, dy = player.y - cy;
      if (dx * dx + dy * dy < (cs * 3) * (cs * 3)) {
        tr._opened = true;
        // Делаем дверные тайлы проходимыми
        this._openDoor(tr);
        if (window.Particles) {
          Particles.burst(cx, cy, 10, { color: '#ffd700', speedMin: 60, speedMax: 150,
            lifeMin: 0.4, lifeMax: 0.8, sizeMin: 3, sizeMax: 5 });
          Particles.text(cx, cy - 20, t('story_door_opened'), 1.5, '#ffd700', 14);
        }
      }
    }
  },


  /** Триггер: сундук с предметом */
  _updateChest(tr, player, dt) {
    if (tr._opened) return;
    const cs = this.currentData.tileSize || 20;
    const cx = tr.x * cs + cs / 2;
    const cy = tr.y * cs + cs / 2;
    const dx = player.x - cx, dy = player.y - cy;
    if (dx * dx + dy * dy < (cs * 2) * (cs * 2)) {
      tr._opened = true;
      if (tr.containsKey) {
        this.collectedItems.push(tr.containsKey);
        if (window.Particles) {
          Particles.text(cx, cy - 20, t('story_key_found'), 1.5, '#ffd700', 14);
        }
      }
      if (tr.containsItem) {
        this.collectedItems.push(tr.containsItem);
        if (window.Particles) {
          Particles.text(cx, cy - 20, t('story_item_found'), 1.5, '#00ccff', 14);
        }
      }
      if (window.Particles) {
        Particles.burst(cx, cy, 8, { color: '#ffd700', speedMin: 50, speedMax: 120,
          lifeMin: 0.4, lifeMax: 0.7, sizeMin: 2, sizeMax: 5 });
      }
    }
  },


  /** Открыть дверь на сетке */
  _openDoor(tr) {
    if (!GameMap.dungeon || !this.currentData) return;
    const cs = this.currentData.tileSize || 20;
    const grid = GameMap.dungeon.grid;
    const gw = GameMap.dungeon.gridW;
    const doorW = tr.doorW || 2;
    const doorH = tr.doorH || 2;
    for (let dy = 0; dy < doorH; dy++) {
      for (let dx = 0; dx < doorW; dx++) {
        const gx = tr.x + dx;
        const gy = tr.y + dy;
        if (gx >= 0 && gy >= 0 && gx < gw && gy < GameMap.dungeon.gridH) {
          grid[gy * gw + gx] = 1;
        }
      }
    }
    // Также обновить tiles
    for (let dy = 0; dy < doorH; dy++) {
      for (let dx = 0; dx < doorW; dx++) {
        const tx = tr.x + dx;
        const ty = tr.y + dy;
        if (this.currentData.tiles[ty] && this.currentData.tiles[ty][tx] !== undefined) {
          this.currentData.tiles[ty][tx] = TILE_TYPES.FLOOR;
        }
      }
    }
  },


  /** Применить эффект руны */
  _applyRuneEffect(rune, player) {
    const eff = rune.effect || {};
    if (window.Particles) {
      Particles.burst(rune.x, rune.y, 10, { color: '#00ccff', speedMin: 60, speedMax: 150,
        lifeMin: 0.5, lifeMax: 1.0, sizeMin: 3, sizeMax: 6 });
      Particles.text(rune.x, rune.y - 20, t('story_rune_' + rune.id) || rune.id, 2.0, '#00ccff', 14);
    }
    switch (rune.id) {
      case 'rune_power':
        player._runeAttackBuff = (eff.attackMul || 0.30);
        player._runeAttackTimer = eff.duration || 60;
        break;
      case 'rune_speed':
        player._runeSpeedBuff = (eff.speedMul || 0.20);
        player._runeSpeedTimer = eff.duration || 60;
        break;
      case 'rune_life':
        player.hp = Math.min(player.maxHp, player.hp + player.maxHp * (eff.healPct || 0.50));
        break;
      case 'rune_regen':
        player._runeRegen = player.maxHp * (eff.regenPct || 0.03);
        player._runeRegenTimer = eff.duration || 30;
        break;
      case 'rune_nature':
        // Призыв союзника-волка (через спавн нейтрального врага)
        player._allyTimer = eff.duration || 60;
        player._allyActive = true;
        break;
      case 'rune_firepower':
        player._runeFireDmg = (eff.fireDmg || 0.25);
        player._runeFireTimer = eff.duration || 45;
        break;
      case 'rune_fireresist':
        player._runeFireResist = (eff.resistPct || 0.50);
        player._runeFireResistTimer = eff.duration || 60;
        break;
      case 'rune_explosion':
        // AoE урон всем врагам на экране
        this._runeExplosion(player, eff);
        break;
      case 'rune_shield':
        player._runeShield = player.maxHp * (eff.shieldPct || 0.50);
        player._runeShieldTimer = eff.duration || 30;
        break;
      case 'rune_summon':
        player._allyTimer = eff.duration || 60;
        player._allyActive = true;
        break;
    }
  },


  /** Руна Взрыва — AoE */
  _runeExplosion(player, eff) {
    if (!window.Game || !Game.enemies) return;
    const items = Game.enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy < 500 * 500) {
        e.hp -= e.maxHp * (eff.dmgPct || 0.50);
        if (e.hp <= 0) e.hp = 1; // Оставляем 1HP чтобы система смерти обработала
      }
    }
    if (window.Particles) {
      Particles.ring(player.x, player.y, 400, 0.5, 'rgba(255, 100, 0, 0.8)', 5);
    }
  },

  /** Проверяем дропы ключей с убитых врагов */
  _checkKeyDrops() {
    for (let i = this.spawnedEnemies.length - 1; i >= 0; i--) {
      const e = this.spawnedEnemies[i];
      if (!e.active && e._guardKey && !this.collectedItems.includes(e._guardKey)) {
        this.collectedItems.push(e._guardKey);
        if (window.Particles) {
          Particles.text(e.x, e.y - 20, t('story_key_found'), 2.0, '#ffd700', 14);
          Particles.burst(e.x, e.y, 8, { color: '#ffd700', speedMin: 50, speedMax: 120,
            lifeMin: 0.4, lifeMax: 0.7, sizeMin: 2, sizeMax: 4 });
        }
        this.spawnedEnemies.splice(i, 1);
      }
    }
  },


  /** Получить стартовую позицию игрока */
  getStartPosition() {
    if (!this.currentData) return { x: 100, y: 100 };
    const cs = this.currentData.tileSize || 20;
    const sp = this.currentData.startPos || { x: 5, y: 5 };
    return { x: sp.x * cs + cs / 2, y: sp.y * cs + cs / 2 };
  },

  /** Позиция арены босса */
  getBossArenaCenter() {
    if (!this.currentData || !this.currentData.bossArena) return null;
    const cs = this.currentData.tileSize || 20;
    const ba = this.currentData.bossArena;
    return {
      x: (ba.x + ba.w / 2) * cs,
      y: (ba.y + ba.h / 2) * cs,
    };
  },

  /** Спавн мини-босса (вызывается из кампании) */
  spawnMiniBoss(bossId) {
    if (!window.Bosses || !window.Game || !Game.player) return;
    const arena = this.getBossArenaCenter();
    const bx = arena ? arena.x : Game.player.x + 300;
    const by = arena ? arena.y : Game.player.y;
    const boss = Bosses._createBoss(bossId, Game.player, 'campaign', 0);
    if (boss) {
      boss.x = bx;
      boss.y = by;
      boss.isCampaignBoss = true;
      Bosses.current = boss;
      Bosses._announcesBoss(boss.cfg.name);
    }
  },

  /** Деактивировать статическую карту */
  deactivate() {
    this.active = false;
    this.currentData = null;
    this.activeTriggers = [];
    this.collectedItems = [];
    this.activeRunes = [];
    this.spawnedEnemies = [];
    this.doorStates = {};
  },

  /** Проверка: можно ли спавнить финального босса (3 кристалла) */
  hasAllCrystals() {
    return this.collectedItems.includes('crystal_shard_1') &&
           this.collectedItems.includes('crystal_shard_2') &&
           this.collectedItems.includes('crystal_shard_3');
  },
};


// Экспорт
window.StaticMap = StaticMap;
window.TILE_TYPES = TILE_TYPES;
window.TILE_COLORS = TILE_COLORS;
