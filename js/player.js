'use strict';
/* ============================================================
   player.js — герой: создание, движение, слоты, урон и т.п.
   Всегда стартует с мечом в первом слоте оружия.
   ============================================================ */

const Player = {
  /** Создать нового героя. */
  create(startX, startY) {
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

      // Регенерация (HP/сек). Регенеративная пассивка пишет сюда.
      hpRegen: 0,
      _regenAcc: 0,

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

      // Слоты
      weaponSlots:  new Array(CONFIG.PLAYER.SLOTS_WEAPONS).fill(null),
      abilitySlots: new Array(CONFIG.PLAYER.SLOTS_ABILITIES).fill(null),

      // Визуал
      trailTimer: 0,
    };
    // Старт: меч в первом слоте оружия
    Player.addWeapon(p, WEAPON_FACTORIES.sword());
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

      player.trailTimer -= dt;
      if (player.trailTimer <= 0) {
        player.trailTimer = CONFIG.PLAYER.TRAIL_INTERVAL;
        Game.spawnTrailParticle(player, move);
      }
    }

    // Взаимодействие с рычагами по касанию
    if (window.GameMap && GameMap.tryToggleLever) {
      GameMap.tryToggleLever(player);
    }

    // Границы карты
    const half = player.size / 2;
    player.x = Utils.clamp(player.x, half, CONFIG.MAP.W - half);
    player.y = Utils.clamp(player.y, half, CONFIG.MAP.H - half);

    // Регенерация
    if (player.hpRegen > 0 && player.hp > 0) {
      player.hp = Math.min(player.maxHp, player.hp + player.hpRegen * dt);
    }

    // Встроенный Magic Missile
    player.missileCd = Math.max(0, player.missileCd - dt);
  },

  /** Отрисовка героя. ctx сдвинут на -cam. */
  render(ctx, player) {
    const ps = player.size;
    ctx.fillStyle = '#2980d9';
    ctx.fillRect(player.x - ps / 2, player.y - ps / 2, ps, ps);
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
