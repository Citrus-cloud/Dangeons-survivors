'use strict';
/* ============================================================
   loot.js — кристаллы опыта (XP), золото, магнит, подбор.
   Шаг 15: добавлено золото (монетки) как мета-валюта.
   ============================================================ */

function createXP() {
  return { active: false, x: 0, y: 0, value: 0, pulse: 0, red: false };
}

function createGold() {
  return { active: false, x: 0, y: 0, value: 0, pulse: 0 };
}

/* ---------- Золото: конфигурация ---------- */
const GOLD_CONFIG = {
  DROP_CHANCE: 0.40,         // 40% с обычного врага
  DROP_MIN: 1,
  DROP_MAX: 3,
  ELITE_DROP_MIN: 5,
  ELITE_DROP_MAX: 10,
  BOSS_DROP_MIN: 50,
  BOSS_DROP_MAX: 150,
  RADIUS: 4,                 // визуальный радиус монетки
  POOL_SIZE: 50,
  MAGNET_SPEED: 360,         // скорость притяжения к игроку
};

const Loot = {
  /**
   * Бросить кристалл опыта в точке (x, y).
   * Шаг 6: опыт увеличен в 5 раз. Начиная с 3-й волны —
   * 15% шанс красного кристалла (даёт опыт в 20 раз больше базового).
   */
  dropXP(pool, x, y, value) {
    const xp = pool.spawn();
    if (!xp) return null;
    xp.x = x; xp.y = y;
    xp.pulse = 0;

    // Шаг 6: базовый опыт ×5
    let finalValue = value * 5;

    // Шаг 6: красный кристалл (15% шанс начиная с 3-й волны)
    const waveIndex = (window.Game && Game.waveIndex) || 0;
    if (waveIndex >= 3 && Math.random() < 0.15) {
      xp.red = true;
      finalValue = value * 20;  // 20x от оригинального значения
    } else {
      xp.red = false;
    }

    xp.value = finalValue;
    return xp;
  },

  /**
   * Бросить кристалл опыта без модификаторов (используется боссом
   * для дропа уже посчитанного значения).
   */
  dropXPRaw(pool, x, y, value) {
    const xp = pool.spawn();
    if (!xp) return null;
    xp.x = x; xp.y = y;
    xp.value = value;
    xp.pulse = 0;
    xp.red = false;
    return xp;
  },

  /** Обновление кристаллов: магнит, подбор. */
  update(pool, player, dt) {
    const pickupR = CONFIG.PLAYER.PICKUP_RADIUS * player.pickupMul;
    const pickupR2 = pickupR * pickupR;
    const collectR = (player.size * 0.5 + 6);
    const collectR2 = collectR * collectR;
    const items = pool.items;
    for (let i = 0; i < items.length; i++) {
      const x = items[i];
      if (!x.active) continue;
      x.pulse += dt;
      const dx = player.x - x.x, dy = player.y - x.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= pickupR2) {
        const d = Math.sqrt(d2) || 1;
        const speed = CONFIG.XP.MAGNET_SPEED;
        x.x += (dx / d) * speed * dt;
        x.y += (dy / d) * speed * dt;
      }
      if (d2 <= collectR2) {
        // Шаг 15: бонус XP от харизмы
        const xpMul = player.xpBonusMul || 1;
        player.xp += Math.floor(x.value * xpMul);
        x.active = false;
        // Шаг 18: звук подбора XP
        if (window.GameAudio) GameAudio.playSfx('xp');
      }
    }
  },

  /** Отрисовка кристаллов. ctx уже сдвинут на -cam. */
  render(ctx, pool, cam, viewW, viewH) {
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    const items = pool.items;
    for (let i = 0; i < items.length; i++) {
      const x = items[i];
      if (!x.active) continue;
      if (x.x < minX - 20 || x.x > maxX + 20 || x.y < minY - 20 || x.y > maxY + 20) continue;
      const pulse = 1 + Math.sin(x.pulse * 6) * 0.18;
      if (x.red) {
        // Красный кристалл: крупнее, с красным свечением
        ctx.fillStyle = '#ff3333';
        ctx.shadowColor = 'rgba(255, 50, 50, 0.9)';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(x.x, x.y, 8 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Внутренний блик
        ctx.fillStyle = 'rgba(255, 200, 200, 0.6)';
        ctx.beginPath();
        ctx.arc(x.x - 2, x.y - 2, 3 * pulse, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Обычный зелёный кристалл
        ctx.fillStyle = '#3ddc84';
        ctx.shadowColor = 'rgba(60, 220, 132, 0.7)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x.x, x.y, 6 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  },

  /** Притянуть все активные кристаллы опыта мгновенно к игроку
   *  (используется эволюцией Soul Flame). */
  magnetizeAll(pool, player) {
    const items = pool.items;
    for (let i = 0; i < items.length; i++) {
      const x = items[i];
      if (!x.active) continue;
      // Эквивалент мгновенного подбора: засчитываем опыт и снимаем с поля.
      player.xp += x.value;
      x.active = false;
    }
  },

  /* ============================================================
     Шаг 15: Золото (монетки)
     ============================================================ */

  /** Бросить золото в точке (x, y). */
  dropGold(pool, x, y, value) {
    const g = pool.spawn();
    if (!g) return null;
    // Немного разброс позиции
    g.x = x + Utils.rand(-12, 12);
    g.y = y + Utils.rand(-12, 12);
    g.value = value;
    g.pulse = Math.random() * 3; // рандомная начальная фаза для разнообразия
    return g;
  },

  /** Шанс выронить золото при убийстве врага. */
  tryDropGold(pool, enemy) {
    const cfg = enemy.cfg;
    const isElite = cfg && (cfg.tier >= 4 || cfg.id === 'captain');
    let chance = GOLD_CONFIG.DROP_CHANCE;
    let minG = GOLD_CONFIG.DROP_MIN;
    let maxG = GOLD_CONFIG.DROP_MAX;

    if (isElite) {
      chance = 1.0; // гарантированно
      minG = GOLD_CONFIG.ELITE_DROP_MIN;
      maxG = GOLD_CONFIG.ELITE_DROP_MAX;
    }

    if (Math.random() < chance) {
      const value = Utils.randInt(minG, maxG);
      return this.dropGold(pool, enemy.x, enemy.y, value);
    }
    return null;
  },

  /** Бросить золото от босса. */
  dropBossGold(pool, x, y) {
    const value = Utils.randInt(GOLD_CONFIG.BOSS_DROP_MIN, GOLD_CONFIG.BOSS_DROP_MAX);
    // Выбрасываем несколькими монетками для визуального эффекта
    const count = Math.min(8, Math.ceil(value / 20));
    const perCoin = Math.floor(value / count);
    for (let i = 0; i < count; i++) {
      this.dropGold(pool, x + Utils.rand(-30, 30), y + Utils.rand(-30, 30), perCoin);
    }
  },

  /** Обновление золота: магнит, подбор. */
  updateGold(pool, player, dt) {
    const pickupR = CONFIG.PLAYER.PICKUP_RADIUS * player.pickupMul;
    const pickupR2 = pickupR * pickupR;
    const collectR = (player.size * 0.5 + 6);
    const collectR2 = collectR * collectR;
    const items = pool.items;
    for (let i = 0; i < items.length; i++) {
      const g = items[i];
      if (!g.active) continue;
      g.pulse += dt;
      const dx = player.x - g.x, dy = player.y - g.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= pickupR2) {
        const d = Math.sqrt(d2) || 1;
        g.x += (dx / d) * GOLD_CONFIG.MAGNET_SPEED * dt;
        g.y += (dy / d) * GOLD_CONFIG.MAGNET_SPEED * dt;
      }
      if (d2 <= collectR2) {
        // Подобрано — добавить к счётчику забега
        if (window.Game) {
          Game.runGold = (Game.runGold || 0) + g.value;
        }
        g.active = false;
        // Шаг 18: звук подбора золота
        if (window.GameAudio) GameAudio.playSfx('gold');
      }
    }
  },

  /** Отрисовка золота. ctx уже сдвинут на -cam. */
  renderGold(ctx, pool, cam, viewW, viewH) {
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    const items = pool.items;
    for (let i = 0; i < items.length; i++) {
      const g = items[i];
      if (!g.active) continue;
      if (g.x < minX - 10 || g.x > maxX + 10 || g.y < minY - 10 || g.y > maxY + 10) continue;
      const pulse = 1 + Math.sin(g.pulse * 5) * 0.15;
      const r = GOLD_CONFIG.RADIUS * pulse;
      // Золотая монетка
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = 'rgba(255, 215, 0, 0.8)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(g.x, g.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Блик
      ctx.fillStyle = 'rgba(255, 255, 240, 0.6)';
      ctx.beginPath();
      ctx.arc(g.x - 1, g.y - 1, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};


/* ============================================================
   Сундук с броском d20 (Шаг 3).

   Архитектура: один объект Chest в Game.chest (или null).
   Тут — только данные/спавн/рендер/индикатор. Логика подбора и
   d20-флоу — в main.js.
   ============================================================ */

const Chest = {
  /** Создать новый объект сундука (не размещён). */
  create() {
    return {
      x: 0, y: 0,
      size: CONFIG.CHEST.SIZE,
      pulse: 0,             // для лёгкой анимации/мерцания
      bornAt: 0,            // game.runTime в момент появления (для эффекта появления)
      opened: false,
    };
  },

  /** Заспавнить сундук в случайной точке на расстоянии 300..600 от героя
   *  (в пределах карты). Возвращает объект Chest или null. */
  spawnNear(player) {
    const c = Chest.create();
    const m = c.size;
    let placed = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Utils.rand(CONFIG.CHEST.SPAWN_MIN_DIST, CONFIG.CHEST.SPAWN_MAX_DIST);
      const x = player.x + Math.cos(ang) * dist;
      const y = player.y + Math.sin(ang) * dist;
      // Внутри карты с отступом
      if (x < m || x > CONFIG.MAP.W - m) continue;
      if (y < m || y > CONFIG.MAP.H - m) continue;
      c.x = Utils.clamp(x, m, CONFIG.MAP.W - m);
      c.y = Utils.clamp(y, m, CONFIG.MAP.H - m);
      placed = true;
      break;
    }
    if (!placed) {
      // fallback: просто рядом с героем под углом 0
      c.x = Utils.clamp(player.x + 350, m, CONFIG.MAP.W - m);
      c.y = Utils.clamp(player.y,       m, CONFIG.MAP.H - m);
    }
    if (window.Particles) Particles.chestGlow(c.x, c.y);
    return c;
  },

  /** Обновление: только лёгкая анимация. */
  update(chest, dt) {
    if (!chest) return;
    chest.pulse += dt;
  },

  /** Дистанция до героя (квадрат). */
  pickedUpBy(chest, player) {
    if (!chest) return false;
    const r = CONFIG.CHEST.PICKUP_RADIUS + player.size * 0.5;
    const dx = chest.x - player.x, dy = chest.y - player.y;
    return (dx * dx + dy * dy) <= r * r;
  },

  /** Отрисовка сундука. ctx уже сдвинут на -cam. */
  render(ctx, chest, cam, viewW, viewH) {
    if (!chest) return;
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    if (chest.x + chest.size < minX || chest.x - chest.size > maxX) return;
    if (chest.y + chest.size < minY || chest.y - chest.size > maxY) return;

    const s = chest.size;
    const pulse = 1 + Math.sin(chest.pulse * 4) * 0.06;
    const w = s * pulse, h = s * pulse;
    // Свечение
    ctx.shadowColor = 'rgba(255, 215, 80, 0.8)';
    ctx.shadowBlur = 14;
    // Корпус
    ctx.fillStyle = '#d8a826';
    ctx.fillRect(chest.x - w / 2, chest.y - h / 2, w, h);
    ctx.shadowBlur = 0;
    // Обводка
    ctx.strokeStyle = '#8a6a14';
    ctx.lineWidth = 2;
    ctx.strokeRect(chest.x - w / 2 + 1, chest.y - h / 2 + 1, w - 2, h - 2);
    // Поперечная полоса (крышка)
    ctx.fillStyle = '#8a6a14';
    ctx.fillRect(chest.x - w / 2, chest.y - 2, w, 3);
    // Знак вопроса в центре
    ctx.fillStyle = '#fffce0';
    ctx.font = 'bold 18px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', chest.x, chest.y + 1);
  },

  /** Если сундук за границами видимой области — нарисовать стрелку-индикатор
   *  на краю экрана, указывающую направление к нему. ctx — БЕЗ сдвига камеры
   *  (рисуем в экранных координатах). */
  renderIndicator(ctx, chest, cam, viewW, viewH) {
    if (!chest) return;
    const screenX = chest.x - cam.x;
    const screenY = chest.y - cam.y;
    const margin = 24;
    const onScreen =
      screenX >= margin && screenX <= viewW - margin &&
      screenY >= margin && screenY <= viewH - margin;
    if (onScreen) return;

    const cx = viewW / 2, cy = viewH / 2;
    const dx = screenX - cx, dy = screenY - cy;
    // Точка на прямоугольнике viewport (с отступом margin) в направлении (dx, dy)
    const halfW = viewW / 2 - margin;
    const halfH = viewH / 2 - margin;
    const adx = Math.abs(dx) || 1e-6;
    const ady = Math.abs(dy) || 1e-6;
    const sx = halfW / adx;
    const sy = halfH / ady;
    const k = Math.min(sx, sy);
    const ix = cx + dx * k;
    const iy = cy + dy * k;
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(angle);
    // Полупрозрачный фон под значком
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    // Золотая стрелка-треугольник
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a6a14';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  },
};

window.createXP = createXP;
window.createGold = createGold;
window.GOLD_CONFIG = GOLD_CONFIG;
window.Loot = Loot;
window.Chest = Chest;

/* ============================================================
   Шаг 17: Сундук-мимик (Mimic Chest).
   При броске d20 = 1..5, обычный сундук превращается в мимика.
   ============================================================ */
const MimicChest = {
  /**
   * Проверить, должен ли сундук стать мимиком.
   * @param {number} roll — результат броска d20
   * @param {boolean} isSecret — секретный/загадочный сундук?
   * @returns {boolean}
   */
  shouldBeMimic(roll, isSecret) {
    if (!window.STEP17_CONFIG) return false;
    const cfg = STEP17_CONFIG.MIMIC_CHEST;
    if (isSecret) {
      return Math.random() < cfg.SECRET_CHEST_MIMIC_CHANCE;
    }
    return roll <= cfg.MIMIC_ROLL_MAX;
  },

  /**
   * Спавнить мимиков из сундука (1 основной + 1-2 доп в засаде).
   * @param {object} player
   * @param {number} chestX, chestY — позиция сундука
   */
  spawnMimics(player, chestX, chestY) {
    if (!window.Enemies || !window.Game || !Game.enemies) return;
    const cfg = STEP17_CONFIG.MIMIC_CHEST;

    // Основной мимик (усиленный)
    const mainMimic = Enemies.spawnByType(Game.enemies, 'mimic', chestX, chestY);
    if (mainMimic) {
      mainMimic.hp = Math.round(mainMimic.hp * (1 + cfg.HP_BONUS));
      mainMimic.maxHp = mainMimic.hp;
      if (mainMimic.cfg) {
        mainMimic._originalDamage = mainMimic.cfg.damage;
        // Увеличиваем урон через пометку (используется в Enemies.update)
        mainMimic._mimicDmgMul = 1 + cfg.DAMAGE_BONUS;
      }
      mainMimic._mimicChestRewardMul = cfg.REWARD_MULTIPLIER;
    }

    // Дополнительные мимики (засада: 1-2 шт)
    const extraCount = 1 + Math.floor(Math.random() * cfg.EXTRA_MIMICS);
    for (let i = 0; i < extraCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 40;
      const ex = chestX + Math.cos(ang) * dist;
      const ey = chestY + Math.sin(ang) * dist;
      const extra = Enemies.spawnByType(Game.enemies, 'mimic', ex, ey);
      if (extra) {
        extra.hp = Math.round(extra.hp * (1 + cfg.HP_BONUS * 0.5));
        extra.maxHp = extra.hp;
      }
    }

    // Визуальный эффект трансформации
    if (window.Particles) {
      Particles.burst(chestX, chestY, 8, {
        color: '#ff3333', speedMin: 60, speedMax: 160,
        lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 6,
      });
      Particles.text(chestX, chestY - 30, 'МИМИК!', 1.5, '#ff3333', 16);
    }
  },
};

window.MimicChest = MimicChest;

