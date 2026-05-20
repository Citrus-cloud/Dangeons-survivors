'use strict';
/* ============================================================
   urns.js — Урны и зелёные яблоки (Шаг 1).
   
   Урны:
   - Спавнятся раз в 60 сек в случайном проходимом месте.
   - Максимум 3 одновременно на карте.
   - 10 HP, не двигаются, не атакуют.
   - При разрушении: 50% — зелёное яблоко, 50% — немного золота (5-10).
   
   Зелёные яблоки:
   - +75 HP при подборе (не превышая максимум).
   - Притягиваются магнитом подбора.
   - Звук «хруст» при подборе.
   ============================================================ */

/* ---------- Конфигурация ---------- */
const URN_CONFIG = {
  SPAWN_INTERVAL: 60,       // секунд между спавнами
  MAX_ON_MAP: 3,            // максимум одновременно
  HP: 10,                   // HP урны
  SIZE: 16,                 // визуальный размер (16x16)
  APPLE_CHANCE: 0.50,       // 50% шанс яблока
  GOLD_MIN: 5,              // золото если не яблоко
  GOLD_MAX: 10,
  APPLE_HEAL: 75,           // HP от яблока
  APPLE_SIZE: 12,           // визуальный размер яблока
  MAGNET_SPEED: 300,        // скорость притяжения яблока
};

/* ---------- Спрайты (генерируются один раз) ---------- */
let URN_SPRITE = null;
let APPLE_SPRITE = null;

function _generateUrnSprite() {
  const size = 16;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  // Коричневая/серая ваза пиксельная
  const body = '#8b6914';
  const dark = '#5a4010';
  const rim = '#a07820';
  const highlight = '#c9a040';
  // Корпус урны (пузатая форма)
  ctx.fillStyle = body;
  ctx.fillRect(5, 4, 6, 9);   // основное тело
  ctx.fillRect(4, 6, 8, 5);   // пузо
  ctx.fillRect(3, 7, 10, 3);  // самое широкое место
  // Горлышко
  ctx.fillStyle = rim;
  ctx.fillRect(6, 2, 4, 2);   // шея
  ctx.fillRect(5, 1, 6, 1);   // ободок
  // Дно
  ctx.fillStyle = dark;
  ctx.fillRect(5, 13, 6, 1);
  ctx.fillRect(4, 12, 8, 1);
  // Тень/объём
  ctx.fillStyle = dark;
  ctx.fillRect(4, 8, 1, 3);
  ctx.fillRect(10, 8, 1, 3);
  // Блик
  ctx.fillStyle = highlight;
  ctx.fillRect(6, 6, 1, 3);
  ctx.fillRect(7, 5, 1, 2);
  return c;
}

function _generateAppleSprite() {
  const size = 12;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  // Зелёное яблоко с красным бочком
  const green = '#4caf50';
  const darkGreen = '#2e7d32';
  const red = '#c62828';
  const highlight = '#a5d6a7';
  const stem = '#5d4037';
  // Тело яблока
  ctx.fillStyle = green;
  ctx.fillRect(3, 3, 6, 6);
  ctx.fillRect(2, 4, 8, 4);
  ctx.fillRect(4, 2, 4, 1);
  ctx.fillRect(3, 9, 6, 1);
  // Красный бочок (правая часть)
  ctx.fillStyle = red;
  ctx.fillRect(7, 4, 2, 3);
  ctx.fillRect(8, 3, 1, 4);
  // Тень
  ctx.fillStyle = darkGreen;
  ctx.fillRect(2, 7, 2, 1);
  ctx.fillRect(3, 8, 1, 1);
  // Блик
  ctx.fillStyle = highlight;
  ctx.fillRect(4, 3, 1, 2);
  ctx.fillRect(3, 4, 1, 1);
  // Стебель
  ctx.fillStyle = stem;
  ctx.fillRect(5, 0, 1, 3);
  ctx.fillRect(6, 1, 1, 1);
  return c;
}

/* ---------- Объекты ---------- */

const Urns = {
  /** Список активных урн на карте. */
  list: [],
  /** Список активных яблок на земле. */
  apples: [],
  /** Таймер спавна. */
  spawnTimer: 30, // первая урна через 30 сек (не 60)

  /** Инициализация при старте забега. */
  init() {
    this.list = [];
    this.apples = [];
    this.spawnTimer = 30;
    // Генерация спрайтов при первом вызове
    if (!URN_SPRITE) URN_SPRITE = _generateUrnSprite();
    if (!APPLE_SPRITE) APPLE_SPRITE = _generateAppleSprite();
  },

  /** Обновление: спавн, проверка урона, подбор яблок. */
  update(dt, player) {
    if (!player) return;

    // Спавн урн по таймеру
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.list.length < URN_CONFIG.MAX_ON_MAP) {
      this._spawnUrn(player);
      this.spawnTimer = URN_CONFIG.SPAWN_INTERVAL;
    }

    // Обновление яблок: магнит + подбор
    const pickupR = CONFIG.PLAYER.PICKUP_RADIUS * player.pickupMul;
    const pickupR2 = pickupR * pickupR;
    const collectR = (player.size * 0.5 + 8);
    const collectR2 = collectR * collectR;

    for (let i = this.apples.length - 1; i >= 0; i--) {
      const apple = this.apples[i];
      apple.pulse += dt;
      const dx = player.x - apple.x;
      const dy = player.y - apple.y;
      const d2 = dx * dx + dy * dy;

      // Притяжение магнитом
      if (d2 <= pickupR2) {
        const d = Math.sqrt(d2) || 1;
        apple.x += (dx / d) * URN_CONFIG.MAGNET_SPEED * dt;
        apple.y += (dy / d) * URN_CONFIG.MAGNET_SPEED * dt;
      }

      // Подбор
      if (d2 <= collectR2) {
        // Восстановление HP (не выше максимума)
        const heal = Math.min(URN_CONFIG.APPLE_HEAL, player.maxHp - player.hp);
        player.hp += heal;
        // Звук хруста
        if (window.GameAudio) GameAudio.playSfx('apple_crunch');
        // Частицы исцеления
        if (window.Particles) {
          Particles.burst(player.x, player.y, 6, {
            color: '#4caf50', speedMin: 40, speedMax: 100,
            lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
          });
          if (heal > 0) {
            Particles.text(player.x, player.y - 20, `+${Math.round(heal)}`, 0.8, '#4caf50', 12);
          }
        }
        this.apples.splice(i, 1);
      }
    }
  },

  /** Нанести урон урне (вызывается из Game при попадании снаряда/мели). */
  damageUrn(urn, dmg) {
    if (!urn || urn.hp <= 0) return;
    urn.hp -= dmg;
    urn.flash = 0.1;
    if (urn.hp <= 0) {
      this._destroyUrn(urn);
    }
  },

  /** Проверить попадание снарядов игрока в урны. */
  checkProjectileHits(projectiles) {
    if (!projectiles || this.list.length === 0) return;
    const items = projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active || p.owner !== 'player') continue;
      for (let j = this.list.length - 1; j >= 0; j--) {
        const urn = this.list[j];
        if (urn.hp <= 0) continue;
        const dx = p.x - urn.x;
        const dy = p.y - urn.y;
        const hitR = URN_CONFIG.SIZE * 0.5 + (p.radius || 5);
        if (dx * dx + dy * dy <= hitR * hitR) {
          this.damageUrn(urn, p.damage || 10);
          // Не удаляем снаряд — проходит сквозь урну
          break;
        }
      }
    }
  },

  /** Проверить мели-атаки оружий (проходим по урнам в радиусе). */
  checkMeleeHits(player) {
    if (this.list.length === 0) return;
    // Мели-оружия наносят урон через Game.damageEnemy, но урны не враги.
    // Вместо этого проверяем расстояние от игрока — если в пределах 50px, 
    // наносим базовый урон при каждой атаке мечом.
    // Это интегрируется через отдельный вызов из main.js.
    for (let j = this.list.length - 1; j >= 0; j--) {
      const urn = this.list[j];
      if (urn.hp <= 0) continue;
      const dx = player.x - urn.x;
      const dy = player.y - urn.y;
      if (dx * dx + dy * dy <= 50 * 50) {
        this.damageUrn(urn, 5);
      }
    }
  },

  /** Спавн урны в случайной проходимой точке. */
  _spawnUrn(player) {
    if (!window.GameMap || !GameMap.dungeon) return;
    // Ищем проходимую точку не слишком близко к игроку
    let ux, uy;
    let found = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const rooms = GameMap.dungeon.rooms.filter(r => !r.isSecret);
      if (rooms.length === 0) return;
      const room = rooms[Math.floor(Math.random() * rooms.length)];
      const tx = room.x + 30 + Math.random() * (room.w - 60);
      const ty = room.y + 30 + Math.random() * (room.h - 60);
      // Проверка проходимости
      if (!GameMap.rectIsWalkable(tx, ty, 10)) continue;
      // Не слишком близко к игроку (мин 150px)
      const dx = tx - player.x, dy = ty - player.y;
      if (dx * dx + dy * dy < 150 * 150) continue;
      ux = tx; uy = ty;
      found = true;
      break;
    }
    if (!found) return;

    this.list.push({
      x: ux, y: uy,
      hp: URN_CONFIG.HP,
      maxHp: URN_CONFIG.HP,
      flash: 0,
      pulse: Math.random() * Math.PI * 2,
    });
  },

  /** Уничтожение урны — дроп яблока или золота. */
  _destroyUrn(urn) {
    // Удаляем из списка
    const idx = this.list.indexOf(urn);
    if (idx !== -1) this.list.splice(idx, 1);

    // Эффект разрушения
    if (window.Particles) {
      Particles.burst(urn.x, urn.y, 8, {
        color: '#8b6914', speedMin: 40, speedMax: 120,
        lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
      });
    }

    // Дроп
    if (Math.random() < URN_CONFIG.APPLE_CHANCE) {
      // Зелёное яблоко
      this.apples.push({
        x: urn.x + (Math.random() - 0.5) * 10,
        y: urn.y + (Math.random() - 0.5) * 10,
        pulse: 0,
      });
    } else {
      // Немного золота
      if (window.Game && Game.goldDrops && window.Loot) {
        const goldValue = URN_CONFIG.GOLD_MIN +
          Math.floor(Math.random() * (URN_CONFIG.GOLD_MAX - URN_CONFIG.GOLD_MIN + 1));
        Loot.dropGold(Game.goldDrops, urn.x, urn.y, goldValue);
      }
    }

    // Звук разрушения
    if (window.GameAudio) GameAudio.playSfx('urn_break');
  },

  /** Отрисовка урн и яблок. ctx уже сдвинут на -cam. */
  render(ctx, cam, viewW, viewH) {
    const minX = cam.x - 20, minY = cam.y - 20;
    const maxX = cam.x + viewW + 20, maxY = cam.y + viewH + 20;

    // Урны
    for (const urn of this.list) {
      if (urn.x < minX || urn.x > maxX || urn.y < minY || urn.y > maxY) continue;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // Мерцание при попадании
      if (urn.flash > 0) {
        ctx.globalAlpha = 0.5 + Math.sin(urn.flash * 40) * 0.3;
        urn.flash -= 0.016; // примерно 1/60
      }
      const s = URN_CONFIG.SIZE;
      if (URN_SPRITE) {
        ctx.drawImage(URN_SPRITE, urn.x - s / 2, urn.y - s / 2, s, s);
      } else {
        ctx.fillStyle = '#8b6914';
        ctx.fillRect(urn.x - s / 2, urn.y - s / 2, s, s);
      }
      ctx.restore();
    }

    // Яблоки
    for (const apple of this.apples) {
      if (apple.x < minX || apple.x > maxX || apple.y < minY || apple.y > maxY) continue;
      const pulse = 1 + Math.sin(apple.pulse * 5) * 0.12;
      const s = URN_CONFIG.APPLE_SIZE * pulse;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // Зелёное свечение
      ctx.shadowColor = 'rgba(76, 175, 80, 0.7)';
      ctx.shadowBlur = 8;
      if (APPLE_SPRITE) {
        ctx.drawImage(APPLE_SPRITE, apple.x - s / 2, apple.y - s / 2, s, s);
      } else {
        ctx.fillStyle = '#4caf50';
        ctx.beginPath();
        ctx.arc(apple.x, apple.y, s / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  },

  /** Отрисовать индикатор HP над урнами (только для повреждённых). */
  renderHP(ctx) {
    for (const urn of this.list) {
      if (urn.hp >= urn.maxHp) continue;
      const w = 20, h = 3;
      const pct = Math.max(0, urn.hp / urn.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(urn.x - w / 2, urn.y - URN_CONFIG.SIZE / 2 - 6, w, h);
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(urn.x - w / 2, urn.y - URN_CONFIG.SIZE / 2 - 6, w * pct, h);
    }
  },
};

window.Urns = Urns;
window.URN_CONFIG = URN_CONFIG;
