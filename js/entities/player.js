'use strict';
/* ============================================================
   player.js — Модуль игрового персонажа (Hero).
   
   Отвечает за:
   - Создание героя (Player.create) с начальными характеристиками
   - Управление слотами оружия и пассивных способностей
   - Движение с коллизиями (стены, двери)
   - Система получения урона (Player.takeDamage) с учётом:
     * i-frames (неуязвимость после удара)
     * Уворот (талант)
     * Щит маны (полная блокировка)
     * Снижение урона (броня)
     * Магический отклик (ответный снаряд)
   - Регенерация HP
   - Рендер героя (спрайт/фоллбэк + ауры + эффекты)
   
   Зависимости:
   - CONFIG (параметры)
   - Input (система ввода)
   - GameMap (коллизии, границы)
   - MetaProgress (таланты, гильдия)
   - Classes (классовая система)
   - Particles (визуальные эффекты)
   
   Экспорт: window.Player
   ============================================================ */

const Player = {
  /**
   * Создать нового героя с полным набором начальных характеристик.
   * Применяет бонусы из мета-прогресса, классов и гильдии.
   * 
   * @param {number} startX - Начальная X-координата (центр карты по умолчанию)
   * @param {number} startY - Начальная Y-координата (центр карты по умолчанию)
   * @returns {Object} Объект героя со всеми полями
   */
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

    // Выбор класса: стартовое оружие зависит от класса
    const selectedClass = (window.Classes) ? Classes.getSelected() : 'warrior';
    const startWeaponId = (window.Classes) ? Classes.getStartWeapon(selectedClass) : 'sword';

    // Магический снаряд (встроенный) — только у Волшебника
    if (selectedClass !== 'mage') {
      p._noBuiltInMissile = true; // Флаг: отключить встроенный Magic Missile
    }

    // Добавить стартовое оружие в первый слот
    if (startWeaponId === 'magic_missile_weapon') {
      // Волшебник получает Magic Missile как обычное оружие (в слоте)
      if (window.WEAPON_FACTORIES && WEAPON_FACTORIES.magic_missile_weapon) {
        Player.addWeapon(p, WEAPON_FACTORIES.magic_missile_weapon());
      } else if (window.WEAPON_FACTORIES && WEAPON_FACTORIES.spellbook) {
        Player.addWeapon(p, WEAPON_FACTORIES.spellbook());
      }
    } else if (window.WEAPON_FACTORIES && WEAPON_FACTORIES[startWeaponId]) {
      Player.addWeapon(p, WEAPON_FACTORIES[startWeaponId]());
    } else {
      Player.addWeapon(p, WEAPON_FACTORIES.sword());
    }

    // Разблокировать стартовое оружие в кодексе
    if (window.Codex) Codex.unlockWeapon(startWeaponId);

    // Применить пассивный бонус класса
    if (window.Classes) {
      Classes.applyClassPassive(p, selectedClass);
    }

    // Шаг 15: бонус гильдии — стартовое оружие начинает с +1 ур.
    if (window.MetaProgress && MetaProgress.hasGuildBonus('startBonus')) {
      const startW = p.weaponSlots[0];
      if (startW && startW.upgrade) startW.upgrade();
    }

    return p;
  },

  /**
   * Добавить оружие в первый свободный слот.
   * 
   * @param {Object} player - Объект героя
   * @param {Object} weapon - Объект оружия (из WEAPON_FACTORIES)
   * @returns {boolean} true если оружие добавлено, false если нет свободных слотов
   */
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

  /**
   * Добавить пассивную способность в первый свободный слот.
   * Сразу вызывает ability.apply(player) для применения эффектов.
   * 
   * @param {Object} player - Объект героя
   * @param {Object} ability - Объект пассивки (из ABILITY_FACTORIES)
   * @returns {boolean} true если способность добавлена
   */
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

  /**
   * Найти оружие по ID в слотах героя.
   * @param {Object} player - Объект героя
   * @param {string} id - ID оружия
   * @returns {Object|null} Объект оружия или null
   */
  findWeapon(player, id) {
    for (const w of player.weaponSlots) if (w && w.id === id) return w;
    return null;
  },
  /**
   * Найти пассивную способность по ID.
   * @param {Object} player - Объект героя
   * @param {string} id - ID пассивки
   * @returns {Object|null} Объект пассивки или null
   */
  findAbility(player, id) {
    for (const a of player.abilitySlots) if (a && a.id === id) return a;
    return null;
  },

  /** Проверить наличие свободного слота оружия */
  hasFreeWeaponSlot(player)  { return player.weaponSlots.some(s => !s); },
  /** Проверить наличие свободного слота пассивки */
  hasFreeAbilitySlot(player) { return player.abilitySlots.some(s => !s); },

  /**
   * Удалить пассивку из указанного слота (со снятием всех эффектов).
   * Вызывает ability.remove(player) если определён.
   * 
   * @param {Object} player - Объект героя
   * @param {number} slotIndex - Индекс слота (0..N-1)
   * @returns {boolean} true если способность удалена
   */
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

    // Уворот (талант): шанс полностью избежать удара
    if (player._dodgeChance && player._dodgeChance > 0 && Math.random() < player._dodgeChance) {
      if (window.Particles && Particles.text) {
        Particles.text(player.x, player.y - 30, 'DODGE!', 0.8, '#2ecc71', 14);
      }
      return 0;
    }

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
    // Талант «Ловкач»: снижение урона от ловушек (source === null для ловушек)
    if (!source && player._trapDamageReduce && player._trapDamageReduce > 0) {
      finalDmg *= (1 - player._trapDamageReduce);
    }
    if (player.damageReduction > 0) {
      finalDmg *= (1 - Math.min(player.damageReduction, 0.75));
    }

    player.hp -= finalDmg;

    // Активируем i-frames (0.3 сек + бонус от таланта «Неуязвимость»)
    const iframeBase = 0.3;
    const iframeBonus = player._iFrameBonus || 0;
    player._iFrameTimer = iframeBase + iframeBonus;

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

  /**
   * Заменить оружие в указанном слоте (используется для эволюций).
   * Новое оружие занимает слот старого.
   * 
   * @param {Object} player - Объект героя
   * @param {number} slotIndex - Индекс слота для замены
   * @param {Object} newWeapon - Новое оружие
   * @returns {boolean} true если замена произведена
   */
  replaceWeapon(player, slotIndex, newWeapon) {
    if (slotIndex < 0 || slotIndex >= player.weaponSlots.length) return false;
    const old = player.weaponSlots[slotIndex];
    if (old) old.slotIndex = -1;
    newWeapon.slotIndex = slotIndex;
    player.weaponSlots[slotIndex] = newWeapon;
    return true;
  },

  /**
   * Обновление героя каждый кадр.
   * Обрабатывает: движение, коллизии, регенерацию, ауры, таймеры.
   * 
   * @param {Object} player - Объект героя
   * @param {number} dt - Дельта времени (sec)
   */
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
      // Новая система: половинный хитбокс (shrinkFactor 0.25 = 50% ядро стены)
      const rad = player.size * 0.35;
      if (window.GameMap && GameMap.dungeon) {
        const r = GameMap.moveWithCollision(player.x, player.y, dx, dy, rad, 0.25);
        player.x = r.x;
        player.y = r.y;
      } else {
        player.x += dx;
        player.y += dy;
      }
      player.facing.x = move.x / ml;
      player.facing.y = move.y / ml;

      // Анимация ходьбы
      if (!player._walkAnimTimer) player._walkAnimTimer = 0;
      if (!player._walkFrame) player._walkFrame = 0;
      player._walkAnimTimer += dt;
      if (player._walkAnimTimer >= 0.25) {
        player._walkAnimTimer = 0;
        player._walkFrame = player._walkFrame === 0 ? 1 : 0;
      }

      // Трейл-частицы героя отключены (визуальный мусор).
      player.trailTimer = 0;
    } else {
      // Стоит — сброс анимации
      player._walkFrame = 0;
      player._walkAnimTimer = 0;
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

  /**
   * Отрисовка героя на canvas.
   * Рисует: ауру холода, щит маны, тень, спрайт/фоллбэк, радиус подбора.
   * 
   * @param {CanvasRenderingContext2D} ctx - Контекст рендера (сдвинут на -camera)
   * @param {Object} player - Объект героя
   */
  render(ctx, player) {
    const ps = player.size;
    const t = Date.now() * 0.001; // время для анимаций

    // --- Аура холода: пульсирующее голубое кольцо с частицами ---
    if (player.frostAura) {
      const fa = player.frostAura;
      const pulse = 1 + Math.sin(t * 3) * 0.05;
      const r = fa.radius * pulse;
      // Градиентное заполнение
      ctx.save();
      const grad = ctx.createRadialGradient(player.x, player.y, r * 0.6, player.x, player.y, r);
      grad.addColorStop(0, 'rgba(100, 200, 255, 0)');
      grad.addColorStop(0.7, 'rgba(100, 200, 255, 0.06)');
      grad.addColorStop(1, 'rgba(80, 180, 255, 0.15)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
      ctx.fill();
      // Внешнее кольцо (пульсирующее)
      ctx.globalAlpha = 0.35 + Math.sin(t * 4) * 0.1;
      ctx.strokeStyle = '#80d4ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Ледяные искры на краю ауры
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#aaeeff';
      for (let s = 0; s < 4; s++) {
        const a = t * 1.5 + s * Math.PI / 2;
        const sx = player.x + Math.cos(a) * r * 0.9;
        const sy = player.y + Math.sin(a) * r * 0.9;
        ctx.fillRect(sx - 1, sy - 1, 2, 2);
      }
      ctx.restore();
    }

    // --- Щит маны: энергетический пузырь с бликами ---
    if (player.manaShield && player.manaShield.shieldReady) {
      ctx.save();
      const shieldR = ps * 0.75;
      const pulse = 1 + Math.sin(t * 5) * 0.05;
      // Градиентный пузырь
      const sGrad = ctx.createRadialGradient(player.x, player.y, shieldR * 0.5, player.x, player.y, shieldR * pulse);
      sGrad.addColorStop(0, 'rgba(100, 200, 255, 0)');
      sGrad.addColorStop(0.8, 'rgba(100, 200, 255, 0.08)');
      sGrad.addColorStop(1, 'rgba(100, 200, 255, 0.2)');
      ctx.fillStyle = sGrad;
      ctx.beginPath();
      ctx.arc(player.x, player.y, shieldR * pulse, 0, Math.PI * 2);
      ctx.fill();
      // Кольцо
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#66ccff';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Блик (перемещающийся огонёк)
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ffffff';
      const bx = player.x + Math.cos(t * 3) * shieldR * 0.6;
      const by = player.y + Math.sin(t * 3) * shieldR * 0.6;
      ctx.beginPath();
      ctx.arc(bx, by, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Тень под игроком
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    if (ctx.ellipse) {
      ctx.ellipse(player.x, player.y + ps * 0.4, ps * 0.35, ps * 0.1, 0, 0, Math.PI * 2);
    } else {
      ctx.arc(player.x, player.y + ps * 0.4, ps * 0.2, 0, Math.PI * 2);
    }
    ctx.fill();

    // Анимация ходьбы (2 кадра, управляется из update)
    const classId = player._classId || 'warrior';
    const walkSprites = window.PLAYER_WALK_SPRITES ? PLAYER_WALK_SPRITES[classId] : null;

    // Направление поворота: facing.x < 0 → смотрит влево (flipX)
    const flipX = player.facing.x < 0;

    if (walkSprites && walkSprites.length === 2) {
      const sprite = walkSprites[player._walkFrame];
      const drawSize = ps; // совпадает с размером игрока

      ctx.save();
      // Шаг 19: мерцание при i-frames (неуязвимость после удара)
      if (player._iFrameTimer && player._iFrameTimer > 0) {
        ctx.globalAlpha = 0.4 + Math.sin(player._iFrameTimer * 30) * 0.3;
      }
      ctx.imageSmoothingEnabled = false;

      if (flipX) {
        ctx.translate(player.x, player.y);
        ctx.scale(-1, 1);
        ctx.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      } else {
        ctx.drawImage(sprite, player.x - drawSize / 2, player.y - drawSize / 2, drawSize, drawSize);
      }
      ctx.restore();
    } else {
      // Fallback: старый рендер (цветной квадрат с буквой)
      const classColor = player._classColor || '#2980d9';
      const classLetter = player._classLetter || 'K';
      ctx.fillStyle = classColor;
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
      ctx.fillText(classLetter, player.x, player.y + 1);
    }

    // Радиус подбора (мягкое пульсирующее свечение)
    const pickupR = CONFIG.PLAYER.PICKUP_RADIUS * player.pickupMul;
    const pickupAlpha = 0.04 + Math.sin(t * 2) * 0.02;
    ctx.strokeStyle = `rgba(255,255,200,${pickupAlpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x, player.y, pickupR, 0, Math.PI * 2);
    ctx.stroke();
  },
};

window.Player = Player;
