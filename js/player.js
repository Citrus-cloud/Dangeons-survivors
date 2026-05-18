'use strict';
/* ============================================================
   player.js — герой: создание, движение, слоты, урон и т.п.
   Всегда стартует с мечом в первом слоте оружия.
   ============================================================ */

const Player = {
  /** Создать нового героя. */
  create(startX, startY) {
    // Шаг 15: динамические слоты из мета-прогресса
    const weaponSlotCount = (window.MetaProgress && MetaProgress.data)
      ? MetaProgress.getWeaponSlots()
      : CONFIG.PLAYER.SLOTS_WEAPONS;
    const abilitySlotCount = (window.MetaProgress && MetaProgress.data)
      ? MetaProgress.getAbilitySlots()
      : CONFIG.PLAYER.SLOTS_ABILITIES;

    const p = {
      x: (startX != null) ? startX : CONFIG.MAP.W / 2,
      y: (startY != null) ? startY : CONFIG.MAP.H / 2,
      size: CONFIG.PLAYER.SIZE,
      hp: CONFIG.PLAYER.MAX_HP,
      maxHp: CONFIG.PLAYER.MAX_HP,

      // Множители
      speedMul: 1,
      damageMul: 1,
      swordCdMul: 1,        // оставлено для совместимости (базовые улучшения)
      missileCdMul: 1,
      pickupMul: 1,
      weaponCdMul: 1,       // глобальный для всех Weapon (базовое улучшение)

      // Bug fix #1: отдельно хранить бонус HP от талантов для корректного пересчёта
      talentBonusHp: 0,

      // Регенерация (HP/сек). Регенеративная пассивка пишет сюда.
      hpRegen: 0,
      _regenAcc: 0,

      // Шаг 8: новые статы от пассивок
      damageReduction: 0,    // 0..1 — снижение входящего урона
      manaShield: null,      // ссылка на ManaShieldAbility (или null)
      maxHpMul: 1,           // множитель макс. HP (от Укрепления)
      bonusMaxHp: 0,         // бонус макс. HP от базовых улучшений
      debuffReduction: 0,    // 0..1 — снижение длительности дебаффов
      lifesteal: 0,          // 0..1 — % лечения от нанесённого урона
      critChance: 0,         // 0..1 — шанс крита
      bleedChance: 0,        // 0..1 — шанс кровотечения при атаке
      explosiveDeathChance: 0, // 0..1 — шанс взрыва при убийстве
      frostAura: null,       // { slow, radius } или null
      magicDamageMul: 1,     // множитель магического урона
      magicEchoChance: 0,    // 0..1 — шанс ответного снаряда
      d20MinBonus: 0,        // +N к минимальному d20
      doubleXpChance: 0,     // 0..1 — шанс удвоения XP
      dotDamageMul: 1,       // множитель DoT-урона

      // Шаг 15: бонус XP от харизмы (умножает подбираемый XP)
      xpBonusMul: 1,

      // Встроенный Magic Missile (не занимает слот)
      missileCd: 0,
      missileCount: CONFIG.MISSILE.COUNT,

      // Направление
      moveDir: { x: 0, y: 0 },        // нормализованное направление в этом кадре
      facing: { x: 1, y: 0 },         // последнее ненулевое направление

      // XP / уровень
      level: 1,
      xp: 0,
      xpNext: CONFIG.XP.BASE,

      // Слоты (Шаг 15: динамический размер)
      weaponSlots:  new Array(weaponSlotCount).fill(null),
      abilitySlots: new Array(abilitySlotCount).fill(null),

      // Визуал
      trailTimer: 0,

      // Шаг 6: дебаффы от боссов
      poison: null,        // { dps, remaining }
      webSlow: 0,          // оставшееся время замедления паутиной
    };

    // Шаг 15: применить бонусы талантов из мета-прогресса
    if (window.MetaProgress && MetaProgress.data) {
      MetaProgress.applyTalents(p);
    }

    // Шаг 15: бонус гильдии — легендарный титул (+10% ко всем статам)
    if (window.MetaProgress && MetaProgress.hasGuildBonus('legendBonus')) {
      p.damageMul *= 1.10;
      p.speedMul *= 1.10;
      p.maxHp = Math.floor(p.maxHp * 1.10);
      p.hp = p.maxHp;
      p.magicDamageMul *= 1.10;
    }

    // Шаг 15: бонус гильдии — +20% XP на 2 мин при старте
    if (window.MetaProgress && MetaProgress.hasGuildBonus('startXpBoost')) {
      p._startXpBoostTimer = 120; // 2 минуты
      p.xpBonusMul = (p.xpBonusMul || 1) * 1.20;
    }

    // Старт: меч в первом слоте оружия
    Player.addWeapon(p, WEAPON_FACTORIES.sword());

    // Шаг 15: бонус гильдии — меч начинает с +1 ур.
    if (window.MetaProgress && MetaProgress.hasGuildBonus('startBonus')) {
      const sword = p.weaponSlots[0];
      if (sword && sword.upgrade) sword.upgrade();
    }

    return p;
  },

  /** Найти первый свободный слот оружия и положить туда. Возвращает true/false. */
  addWeapon(player, weapon) {
    for (let i = 0; i < player.weaponSlots.length; i++) {
      if (!player.weaponSlots[i]) {
        weapon.slotIndex = i;
        player.weaponSlots[i] = weapon;
        return true;
      }
    }
    return false;
  },

  addAbility(player, ability) {
    for (let i = 0; i < player.abilitySlots.length; i++) {
      if (!player.abilitySlots[i]) {
        ability.slotIndex = i;
        player.abilitySlots[i] = ability;
        ability.apply(player);
        return true;
      }
    }
    return false;
  },

  /** Найти оружие по id (или null). */
  findWeapon(player, id) {
    for (const w of player.weaponSlots) if (w && w.id === id) return w;
    return null;
  },
  findAbility(player, id) {
    for (const a of player.abilitySlots) if (a && a.id === id) return a;
    return null;
  },

  hasFreeWeaponSlot(player)  { return player.weaponSlots.some(s => !s); },
  hasFreeAbilitySlot(player) { return player.abilitySlots.some(s => !s); },

  /** Удалить пассивку из её слота (со снятием эффектов). Возвращает true/false. */
  removeAbility(player, slotIndex) {
    if (slotIndex < 0 || slotIndex >= player.abilitySlots.length) return false;
    const a = player.abilitySlots[slotIndex];
    if (!a) return false;
    if (typeof a.remove === 'function') a.remove(player);
    a.slotIndex = -1;
    player.abilitySlots[slotIndex] = null;
    return true;
  },

  /**
   * Шаг 8: нанести урон герою с учётом пассивных эффектов.
   * Вызывать вместо прямого player.hp -= dmg.
   * Шаг 19: добавлены i-frames (0.3 сек неуязвимости после удара).
   * @param {object} player
   * @param {number} rawDmg — базовый урон до защиты
   * @param {object} [source] — источник урона (враг) для магического отклика
   * @returns {number} финальный нанесённый урон
   */
  takeDamage(player, rawDmg, source) {
    // I-frames: если герой в состоянии неуязвимости — игнорируем урон
    if (player._iFrameTimer && player._iFrameTimer > 0) return 0;

    // Щит маны — полная блокировка
    if (player.manaShield && player.manaShield.tryBlock()) {
      // Визуал блока
      if (window.Particles && Particles.burst) {
        Particles.burst(player.x, player.y, 5, {
          color: '#66ccff', speedMin: 40, speedMax: 100,
          lifeMin: 0.15, lifeMax: 0.3, sizeMin: 3, sizeMax: 5,
        });
      }
      return 0;
    }

    // Броня (снижение урона)
    let finalDmg = rawDmg;
    if (player.damageReduction > 0) {
      finalDmg *= (1 - Math.min(player.damageReduction, 0.75));
    }

    player.hp -= finalDmg;

    // Активируем i-frames (0.3 сек неуязвимости)
    player._iFrameTimer = 0.3;

    // Магический отклик — ответный снаряд
    if (player.magicEchoChance > 0 && Math.random() < player.magicEchoChance && source) {
      Player._fireEchoProjectile(player, source);
    }

    return finalDmg;
  },

  /** Шаг 8: выпустить ответный снаряд (магический отклик). */
  _fireEchoProjectile(player, target) {
    if (!window.Game || !Game.projectiles) return;
    const pr = Game.projectiles.spawn();
    if (!pr) return;
    const dx = target.x - player.x, dy = target.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    pr.kind = 'echo';
    pr.owner = 'player';
    pr.x = player.x;
    pr.y = player.y;
    pr.vx = (dx / dist) * 350;
    pr.vy = (dy / dist) * 350;
    pr.life = 2.0;
    pr.damage = 15 * (player.magicDamageMul || 1) * player.damageMul;
    pr.radius = 5;
    pr.angle = Math.atan2(dy, dx);
    pr.source = 'echo';
    pr.homing = true;
    pr.homingStrength = 3.0;
  },

  /** Заменить оружие в указанном слоте. Если слот пустой — просто положить.
   *  Используется для эволюций: новое оружие занимает слот старого. */
  replaceWeapon(player, slotIndex, newWeapon) {
    if (slotIndex < 0 || slotIndex >= player.weaponSlots.length) return false;
    const old = player.weaponSlots[slotIndex];
    if (old) old.slotIndex = -1;
    newWeapon.slotIndex = slotIndex;
    player.weaponSlots[slotIndex] = newWeapon;
    return true;
  },

  /** Обновление героя: движение, регенерация, встроенные кулдауны. */
  update(player, dt) {
    const move = Input.getMove();
    const ml = Math.hypot(move.x, move.y);
    player.moveDir.x = move.x;
    player.moveDir.y = move.y;

    if (ml > 0.001) {
      const speed = CONFIG.PLAYER.SPEED * player.speedMul;
      const dx = move.x * speed * dt;
      const dy = move.y * speed * dt;
      // Движение с коллизиями (стены/колонны/закрытые двери)
      const rad = player.size * 0.4;
      if (window.GameMap && GameMap.dungeon) {
        const r = GameMap.moveWithCollision(player.x, player.y, dx, dy, rad);
        player.x = r.x;
        player.y = r.y;
      } else {
        player.x += dx;
        player.y += dy;
      }
      player.facing.x = move.x / ml;
      player.facing.y = move.y / ml;

      // Трейл-частицы героя отключены (визуальный мусор).
      player.trailTimer = 0;
    }

    // Взаимодействие с рычагами по касанию
    if (window.GameMap && GameMap.tryToggleLever) {
      GameMap.tryToggleLever(player);
    }

    // Границы карты (динамические, учитывают размер сгенерированной карты)
    const half = player.size / 2;
    const mapW = (window.GameMap && GameMap.mapW) ? GameMap.mapW : CONFIG.MAP.W;
    const mapH = (window.GameMap && GameMap.mapH) ? GameMap.mapH : CONFIG.MAP.H;
    player.x = Utils.clamp(player.x, half, mapW - half);
    player.y = Utils.clamp(player.y, half, mapH - half);

    // Регенерация
    if (player.hpRegen > 0 && player.hp > 0) {
      player.hp = Math.min(player.maxHp, player.hp + player.hpRegen * dt);
    }

    // Шаг 19: тик i-frames (неуязвимость после получения урона)
    if (player._iFrameTimer && player._iFrameTimer > 0) {
      player._iFrameTimer -= dt;
    }

    // Шаг 15: снятие стартового XP-буста после 2 минут
    if (player._startXpBoostTimer && player._startXpBoostTimer > 0) {
      player._startXpBoostTimer -= dt;
      if (player._startXpBoostTimer <= 0) {
        player.xpBonusMul = (player.xpBonusMul || 1) / 1.20;
        player._startXpBoostTimer = 0;
      }
    }

    // Шаг 8: тик щита маны (кулдаун)
    if (player.manaShield && typeof player.manaShield.tick === 'function') {
      player.manaShield.tick(dt);
    }

    // Шаг 8: аура холода — замедление ближайших врагов
    if (player.frostAura && window.Game && Game.enemies) {
      const fa = player.frostAura;
      const r2 = fa.radius * fa.radius;
      const items = Game.enemies.items;
      for (let i = 0; i < items.length; i++) {
        const e = items[i];
        if (!e.active) continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        if (dx * dx + dy * dy <= r2) {
          e.frostSlow = fa.slow; // будет использоваться в enemies.js при движении
          e.frostSlowTimer = 0.15; // перезаписывается каждый кадр, пока в ауре
        }
      }
    }

    // Встроенный Magic Missile
    player.missileCd = Math.max(0, player.missileCd - dt);
  },

  /** Отрисовка героя. ctx сдвинут на -cam. */
  render(ctx, player) {
    const ps = player.size;

    // Шаг 8: аура холода — голубое свечение
    if (player.frostAura) {
      const fa = player.frostAura;
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#80d4ff';
      ctx.beginPath();
      ctx.arc(player.x, player.y, fa.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#80d4ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Шаг 8: щит маны — полупрозрачный пузырь когда готов
    if (player.manaShield && player.manaShield.shieldReady) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#66ccff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, ps * 0.75, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#66ccff';
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = '#2980d9';
    // Шаг 19: мерцание при i-frames (неуязвимость после удара)
    if (player._iFrameTimer && player._iFrameTimer > 0) {
      ctx.globalAlpha = 0.4 + Math.sin(player._iFrameTimer * 30) * 0.3;
    }
    ctx.fillRect(player.x - ps / 2, player.y - ps / 2, ps, ps);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(player.x - ps / 2 + 1, player.y - ps / 2 + 1, ps - 2, ps - 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('K', player.x, player.y + 1);

    // Радиус подбора (тонкий ободок)
    const pickupR = CONFIG.PLAYER.PICKUP_RADIUS * player.pickupMul;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x, player.y, pickupR, 0, Math.PI * 2);
    ctx.stroke();
  },
};

window.Player = Player;
