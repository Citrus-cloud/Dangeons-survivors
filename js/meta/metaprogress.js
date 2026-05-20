'use strict';
/* ============================================================
   metaprogress.js — Мета-прогрессия между забегами.
   Золото, 25 талантов, гильдия, сохранение в localStorage.
   Полностью переработанная система талантов (v2).
   ============================================================ */

const META_KEY = 'd20_metaprogress';

/* ---------- Конфигурация 25 талантов ---------- */
/* Каждый талант: id, name, description, maxLevel, costs[], effects[]
   effects — массив описаний эффекта каждого уровня (для UI).
   Суммарная стоимость всех талантов ~200 000 золота. */
const TALENT_DEFS = [
  // === 1. Возрождение (обязательный) ===
  {
    id: 'resurrect',
    name: t('talent_resurrect'),
    icon: '💀',
    description: t('talent_resurrect') + ' — ' + t('ability_regen_desc'),
    maxLevel: 2,
    costs: [10000, 20000],
    effects: [
      '1 resurrect per run with 30% HP',
      '2 resurrects per run with 100% HP',
    ],
  },
  // === 2. Увеличение снарядов (обязательный) ===
  {
    id: 'bonus_projectiles',
    name: t('talent_bonus_projectiles'),
    icon: '✶',
    description: 'Extra projectiles for all weapons.',
    maxLevel: 2,
    costs: [8000, 16000],
    effects: [
      '+1 projectile to all weapons',
      '+2 projectiles to all weapons',
    ],
  },
  // === 3. Закалка ===
  {
    id: 'max_hp',
    name: t('talent_max_hp'),
    icon: '❤',
    description: 'Increases maximum health.',
    maxLevel: 3,
    costs: [500, 1500, 4000],
    effects: ['+20 max HP', '+40 max HP', '+70 max HP'],
  },
  // === 4. Быстрые ноги ===
  {
    id: 'move_speed',
    name: t('talent_move_speed'),
    icon: '👟',
    description: 'Increases movement speed.',
    maxLevel: 3,
    costs: [600, 1800, 5000],
    effects: ['+8% speed', '+16% speed', '+25% speed'],
  },
  // === 5. Грубая сила ===
  {
    id: 'phys_damage',
    name: t('talent_phys_damage'),
    icon: '⚔',
    description: 'Increases physical damage.',
    maxLevel: 3,
    costs: [800, 2500, 6000],
    effects: ['+10% phys. damage', '+20% phys. damage', '+35% phys. damage'],
  },
  // === 6. Магическая мощь ===
  {
    id: 'magic_damage',
    name: t('talent_magic_damage'),
    icon: '📖',
    description: 'Increases magic damage.',
    maxLevel: 3,
    costs: [800, 2500, 6000],
    effects: ['+10% magic damage', '+20% magic damage', '+35% magic damage'],
  },
  // === 7. Скорострельность ===
  {
    id: 'cooldown_reduce',
    name: t('talent_cooldown_reduce'),
    icon: '⏱',
    description: 'Reduces all weapon cooldowns.',
    maxLevel: 3,
    costs: [1000, 3000, 7000],
    effects: ['-8% cooldowns', '-15% cooldowns', '-22% cooldowns'],
  },
  // === 8. Критический удар ===
  {
    id: 'crit_chance',
    name: t('talent_crit_chance'),
    icon: '💥',
    description: 'Chance to deal double damage.',
    maxLevel: 3,
    costs: [1200, 3500, 8000],
    effects: ['+5% crit chance', '+10% crit chance', '+16% crit chance'],
  },
  // === 9. Вампиризм ===
  {
    id: 'lifesteal',
    name: t('talent_lifesteal'),
    icon: '🩸',
    description: 'Healing from damage dealt.',
    maxLevel: 3,
    costs: [1500, 4000, 9000],
    effects: ['+3% lifesteal', '+6% lifesteal', '+10% lifesteal'],
  },
  // === 10. Уворот ===
  {
    id: 'dodge',
    name: t('talent_dodge'),
    icon: '💨',
    description: 'Chance to completely avoid a hit.',
    maxLevel: 3,
    costs: [1500, 4500, 10000],
    effects: ['+5% dodge', '+10% dodge', '+15% dodge'],
  },
  // === 11. Магнит опыта ===
  {
    id: 'xp_radius',
    name: t('talent_xp_radius'),
    icon: '◎',
    description: 'Increases XP and gold pickup radius.',
    maxLevel: 3,
    costs: [500, 1200, 3000],
    effects: ['+25% pickup radius', '+50% pickup radius', '+80% pickup radius'],
  },
  // === 12. Золотая лихорадка ===
  {
    id: 'gold_bonus',
    name: t('talent_gold_bonus'),
    icon: '🪙',
    description: 'More gold per run.',
    maxLevel: 3,
    costs: [600, 1500, 4000],
    effects: ['+10% gold', '+20% gold', '+35% gold'],
  },
  // === 13. Учёность ===
  {
    id: 'xp_bonus',
    name: t('talent_xp_bonus'),
    icon: '📚',
    description: 'More XP from kills.',
    maxLevel: 3,
    costs: [600, 1500, 4000],
    effects: ['+10% XP', '+20% XP', '+35% XP'],
  },
  // === 14. Регенерация ===
  {
    id: 'hp_regen',
    name: t('talent_hp_regen'),
    icon: '💚',
    description: 'Constant health regeneration.',
    maxLevel: 3,
    costs: [800, 2000, 5000],
    effects: ['+1 HP/s', '+2 HP/s', '+3.5 HP/s'],
  },
  // === 15. Стойкость ===
  {
    id: 'damage_reduction',
    name: t('talent_damage_reduction'),
    icon: '🛡',
    description: 'Reduces damage taken.',
    maxLevel: 3,
    costs: [1000, 3000, 7000],
    effects: ['+5% armor', '+10% armor', '+16% armor'],
  },
  // === 16. Ловкач ===
  {
    id: 'trap_resist',
    name: t('talent_trap_resist'),
    icon: '🪤',
    description: 'Reduces trap damage.',
    maxLevel: 2,
    costs: [1000, 3000],
    effects: ['-30% trap damage', '-55% trap damage'],
  },
  // === 17. Неуязвимость ===
  {
    id: 'iframe_extend',
    name: t('talent_iframe_extend'),
    icon: '✨',
    description: 'Increases invincibility frames after hit.',
    maxLevel: 2,
    costs: [2000, 5000],
    effects: ['+0.2s invincibility', '+0.5s invincibility'],
  },
  // === 18. Жажда крови ===
  {
    id: 'bleed_chance',
    name: t('talent_bleed_chance'),
    icon: '🗡',
    description: 'Chance to apply bleed.',
    maxLevel: 2,
    costs: [1500, 4500],
    effects: ['+8% bleed chance', '+16% bleed chance'],
  },
  // === 19. Арсенал ===
  {
    id: 'extra_weapon_slot',
    name: t('talent_extra_weapon_slot'),
    icon: '🎒',
    description: 'Additional weapon slot.',
    maxLevel: 1,
    costs: [12000],
    effects: [t('guild_reward_weapon_slot')],
  },
  // === 20. Мастерство ===
  {
    id: 'extra_ability_slot',
    name: t('talent_extra_ability_slot'),
    icon: '🔮',
    description: 'Additional ability slot.',
    maxLevel: 1,
    costs: [12000],
    effects: [t('guild_reward_ability_slot')],
  },
  // === 21. Сопротивление дебаффам ===
  {
    id: 'debuff_resist',
    name: t('talent_debuff_resist'),
    icon: '🧪',
    description: 'Reduces debuff duration.',
    maxLevel: 2,
    costs: [1500, 4000],
    effects: ['-20% debuff duration', '-40% debuff duration'],
  },
  // === 22. Удачливый охотник ===
  {
    id: 'chest_luck',
    name: t('talent_chest_luck'),
    icon: '🎰',
    description: 'Better chest loot rolls.',
    maxLevel: 2,
    costs: [2000, 6000],
    effects: ['+1 to min d20 roll', '+2 to min d20 roll'],
  },
  // === 23. Взрывная смерть ===
  {
    id: 'explosive_kill',
    name: t('talent_explosive_kill'),
    icon: '💣',
    description: 'Chance of explosion on regular enemy kill.',
    maxLevel: 2,
    costs: [3000, 8000],
    effects: ['8% explosion chance on kill', '15% explosion chance on kill'],
  },
  // === 24. Мгновенная казнь ===
  {
    id: 'instant_kill',
    name: t('talent_instant_kill'),
    icon: '☠',
    description: 'Chance to instantly kill a regular enemy.',
    maxLevel: 2,
    costs: [5000, 15000],
    effects: ['3% instant kill chance', '6% instant kill chance'],
  },
  // === 25. Двойной опыт ===
  {
    id: 'double_xp',
    name: t('talent_double_xp'),
    icon: '⚡',
    description: 'Chance to get double XP.',
    maxLevel: 2,
    costs: [2000, 6000],
    effects: ['+5% double XP chance', '+12% double XP chance'],
  },
];

// Быстрый доступ по id
const TALENT_MAP = {};
for (const t of TALENT_DEFS) TALENT_MAP[t.id] = t;


/* ---------- Конфигурация гильдии (Шаг 4: переработка) ---------- */
const GUILD_CONFIG = {
  levels: [
    { rep: 100,  name: t('guild_rank_copper'),      reward: t('guild_reward_weapon_slot', 7), type: 'weaponSlot' },
    { rep: 300,  name: t('guild_rank_iron'),    reward: t('guild_reward_lich_blade'), type: 'unlockExclusive', exclusiveId: 'lich_blade' },
    { rep: 600,  name: t('guild_rank_bronze'),   reward: t('guild_reward_ability_slot', 7), type: 'abilitySlot' },
    { rep: 1000, name: t('guild_rank_silver'),  reward: t('guild_reward_start_bonus'), type: 'startBonus' },
    { rep: 1500, name: t('guild_rank_gold'),     reward: t('guild_reward_exclusive_chance'), type: 'exclusiveChance' },
    { rep: 2200, name: t('guild_rank_platinum'),  reward: t('guild_reward_weapon_slot', 8), type: 'weaponSlot' },
    { rep: 3000, name: t('guild_rank_adamant'), reward: t('guild_reward_archmage_staff'), type: 'unlockExclusive', exclusiveId: 'archmage_staff' },
    { rep: 4000, name: t('guild_rank_mithril'),  reward: t('guild_reward_ability_slot', 8), type: 'abilitySlot' },
    { rep: 5500, name: t('guild_rank_legendary'), reward: t('guild_reward_start_xp'), type: 'startXpBoost' },
    { rep: 7500, name: t('guild_rank_mythic'),  reward: t('guild_reward_legend'), type: 'legendBonus' },
  ],
};

/* ---------- Пул заданий гильдии ---------- */
const GUILD_QUEST_POOL = {
  daily: [
    { id: 'kill_500',       desc: t('quest_kill_500'),         target: 500,  stat: 'kills',     repReward: 50 },
    { id: 'kill_skeletons', desc: t('quest_kill_skeletons'),       target: 200,  stat: 'killType',  typeFilter: 'skeleton', repReward: 40 },
    { id: 'kill_200',       desc: t('quest_kill_200'),         target: 200,  stat: 'kills',     repReward: 30 },
    { id: 'survive_5min',   desc: t('quest_survive_5min'),      target: 300,  stat: 'surviveTime', repReward: 35 },
    { id: 'collect_xp',     desc: t('quest_collect_xp'),       target: 2000, stat: 'xpCollected', repReward: 40 },
    { id: 'open_chests',    desc: t('quest_open_chests'),        target: 3,    stat: 'chestsOpened', repReward: 45 },
    { id: 'reach_wave5',    desc: t('quest_reach_wave5'),        target: 5,    stat: 'waveReached', repReward: 30 },
    { id: 'kill_elites',    desc: t('quest_kill_elites'),  target: 50,   stat: 'eliteKills', repReward: 50 },
  ],
  weekly: [
    { id: 'kill_3_bosses',  desc: t('quest_kill_3_bosses'),           target: 3,    stat: 'bossKills', repReward: 200 },
    { id: 'kill_5000',      desc: t('quest_kill_5000'),        target: 5000, stat: 'kills',     repReward: 250 },
    { id: 'survive_15min',  desc: t('quest_survive_15min'),     target: 900,  stat: 'surviveTime', repReward: 180 },
    { id: 'complete_3_runs',desc: t('quest_complete_3_runs'),        target: 3,    stat: 'runsCompleted', repReward: 150 },
    { id: 'reach_wave10',   desc: t('quest_reach_wave10'),       target: 10,   stat: 'waveReached', repReward: 200 },
  ],
};

/* ---------- MetaProgress — основной объект ---------- */
const MetaProgress = {
  data: null,

  /** Создать пустой объект мета-прогресса (новая структура талантов). */
  _createDefault() {
    const talents = {};
    for (const t of TALENT_DEFS) talents[t.id] = 0;
    return {
      gold: 0,
      talents: talents,
      reputation: 0,
      totalKills: 0,
      totalBossKills: 0,
      totalRuns: 0,
      bestTime: 0,
      bestKills: 0,
      unlockedExclusives: [],
      extraWeaponSlots: 0,
      extraAbilitySlots: 0,
      achievements: [],
      campaignCompleted: false,
      // Статистика гильдии
      guildStats: {
        totalKills: 0,
        totalBossKills: 0,
        totalRuns: 0,
        bestTime: 0,
        totalEnemiesDiscovered: 0,
        totalWeaponsDiscovered: 0,
        bestInfiniteTime: 0,
      },
      // Задания гильдии
      guildQuests: null, // { daily: [...], weekly: [...], lastDailyReset, lastWeeklyReset }
    };
  },

  /** Загрузить из localStorage (или создать новый). */
  load() {
    try {
      const raw = SafeStorage.getItem(META_KEY);
      if (raw) {
        this.data = JSON.parse(raw);
        // Миграция со старой структуры (5 веток) на новую (25 талантов)
        if (this.data.talents && (this.data.talents.strength !== undefined ||
            this.data.talents.dexterity !== undefined)) {
          // Старая структура — сбрасываем таланты, возвращаем 100% золота
          let refund = 0;
          const oldKeys = ['strength', 'dexterity', 'intelligence', 'constitution', 'charisma'];
          const oldCosts = [50, 150, 350, 700, 1200, 2000, 3200, 5000, 7500, 11000];
          for (const k of oldKeys) {
            const lvl = this.data.talents[k] || 0;
            for (let i = 0; i < lvl; i++) refund += oldCosts[i] || 0;
          }
          this.data.gold += refund;
          // Создаём новую структуру талантов
          const newTalents = {};
          for (const t of TALENT_DEFS) newTalents[t.id] = 0;
          this.data.talents = newTalents;
        }
        // Обеспечить совместимость — добавить недостающие поля
        const def = this._createDefault();
        for (const k of Object.keys(def)) {
          if (this.data[k] === undefined) this.data[k] = def[k];
        }
        // Убедиться что все таланты присутствуют
        for (const t of TALENT_DEFS) {
          if (this.data.talents[t.id] === undefined) this.data.talents[t.id] = 0;
        }
      } else {
        this.data = this._createDefault();
      }
    } catch (e) {
      console.warn('[MetaProgress] load error, resetting:', e);
      this.data = this._createDefault();
    }
  },

  /** Сохранить в localStorage. */
  save() {
    try {
      SafeStorage.setItem(META_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[MetaProgress] save error:', e);
    }
  },

  /* ---------- Золото ---------- */

  addGold(amount) {
    // Бонус от таланта «Золотая лихорадка»
    const goldLvl = this.data.talents.gold_bonus || 0;
    const bonusPct = [0, 0.10, 0.20, 0.35][goldLvl] || 0;
    this.data.gold += Math.floor(amount * (1 + bonusPct));
    this.save();
  },

  spendGold(amount) {
    if (this.data.gold < amount) return false;
    this.data.gold -= amount;
    this.save();
    return true;
  },

  /* ---------- Система талантов (25 талантов) ---------- */

  /** Получить текущую стоимость следующего уровня таланта. */
  getTalentCost(talentId) {
    const def = TALENT_MAP[talentId];
    if (!def) return Infinity;
    const lvl = this.data.talents[talentId] || 0;
    if (lvl >= def.maxLevel) return Infinity;
    return def.costs[lvl];
  },

  /** Купить уровень таланта. Возвращает true если успешно. */
  upgradeTalent(talentId) {
    const def = TALENT_MAP[talentId];
    if (!def) return false;
    const lvl = this.data.talents[talentId] || 0;
    if (lvl >= def.maxLevel) return false;
    const cost = def.costs[lvl];
    if (this.data.gold < cost) return false;
    this.data.gold -= cost;
    this.data.talents[talentId] = lvl + 1;
    this.save();
    return true;
  },

  /** Сбросить все таланты, вернуть 80% вложенного золота. */
  resetTalents() {
    let totalSpent = 0;
    for (const def of TALENT_DEFS) {
      const lvl = this.data.talents[def.id] || 0;
      for (let i = 0; i < lvl; i++) {
        totalSpent += def.costs[i];
      }
      this.data.talents[def.id] = 0;
    }
    const refund = Math.floor(totalSpent * 0.8);
    this.data.gold += refund;
    this.save();
    return refund;
  },


  /** Применить бонусы всех талантов к объекту игрока (при старте забега). */
  applyTalents(player) {
    const t = this.data.talents;

    // 1. Возрождение
    const resLvl = t.resurrect || 0;
    if (resLvl >= 2) {
      player._resurrectCount = 2;
      player._resurrectHpPct = 1.0;
    } else if (resLvl >= 1) {
      player._resurrectCount = 1;
      player._resurrectHpPct = 0.30;
    }

    // 2. Бонусные снаряды
    const projLvl = t.bonus_projectiles || 0;
    if (projLvl > 0) {
      player._talentBonusProjectiles = projLvl; // 1 или 2
    }

    // 3. Закалка (макс HP)
    const hpLvl = t.max_hp || 0;
    if (hpLvl > 0) {
      const bonusHp = [0, 20, 40, 70][hpLvl];
      player.talentBonusHp = bonusHp;
      player.maxHp += bonusHp;
      player.hp += bonusHp;
    }

    // 4. Быстрые ноги
    const spdLvl = t.move_speed || 0;
    if (spdLvl > 0) {
      const spdBonus = [0, 0.08, 0.16, 0.25][spdLvl];
      player.speedMul *= (1 + spdBonus);
    }

    // 5. Грубая сила (физ. урон)
    const physLvl = t.phys_damage || 0;
    if (physLvl > 0) {
      const physBonus = [0, 0.10, 0.20, 0.35][physLvl];
      player.damageMul *= (1 + physBonus);
    }

    // 6. Магическая мощь
    const magLvl = t.magic_damage || 0;
    if (magLvl > 0) {
      const magBonus = [0, 0.10, 0.20, 0.35][magLvl];
      player.magicDamageMul *= (1 + magBonus);
    }

    // 7. Скорострельность (кулдауны)
    const cdLvl = t.cooldown_reduce || 0;
    if (cdLvl > 0) {
      const cdReduce = [0, 0.08, 0.15, 0.22][cdLvl];
      player.weaponCdMul *= (1 - cdReduce);
      player.missileCdMul *= (1 - cdReduce);
    }

    // 8. Критический удар
    const critLvl = t.crit_chance || 0;
    if (critLvl > 0) {
      const critBonus = [0, 0.05, 0.10, 0.16][critLvl];
      player.critChance += critBonus;
    }

    // 9. Вампиризм
    const lsLvl = t.lifesteal || 0;
    if (lsLvl > 0) {
      const lsBonus = [0, 0.03, 0.06, 0.10][lsLvl];
      player.lifesteal += lsBonus;
    }

    // 10. Уворот
    const dodgeLvl = t.dodge || 0;
    if (dodgeLvl > 0) {
      const dodgeBonus = [0, 0.05, 0.10, 0.15][dodgeLvl];
      player._dodgeChance = (player._dodgeChance || 0) + dodgeBonus;
    }

    // 11. Магнит опыта
    const pickLvl = t.xp_radius || 0;
    if (pickLvl > 0) {
      const pickBonus = [0, 0.25, 0.50, 0.80][pickLvl];
      player.pickupMul *= (1 + pickBonus);
    }

    // 12. Золотая лихорадка — применяется в addGold(), не в player

    // 13. Учёность (бонус опыта)
    const xpLvl = t.xp_bonus || 0;
    if (xpLvl > 0) {
      const xpBonus = [0, 0.10, 0.20, 0.35][xpLvl];
      player.xpBonusMul = (player.xpBonusMul || 1) * (1 + xpBonus);
    }

    // 14. Регенерация
    const regenLvl = t.hp_regen || 0;
    if (regenLvl > 0) {
      const regenVal = [0, 1, 2, 3.5][regenLvl];
      player.hpRegen += regenVal;
    }

    // 15. Стойкость (снижение урона)
    const drLvl = t.damage_reduction || 0;
    if (drLvl > 0) {
      const drBonus = [0, 0.05, 0.10, 0.16][drLvl];
      player.damageReduction += drBonus;
    }

    // 16. Ловкач (снижение урона от ловушек)
    const trapLvl = t.trap_resist || 0;
    if (trapLvl > 0) {
      player._trapDamageReduce = [0, 0.30, 0.55][trapLvl];
    }

    // 17. Неуязвимость (доп. i-frames)
    const iframeLvl = t.iframe_extend || 0;
    if (iframeLvl > 0) {
      player._iFrameBonus = [0, 0.2, 0.5][iframeLvl];
    }

    // 18. Жажда крови (кровотечение)
    const bleedLvl = t.bleed_chance || 0;
    if (bleedLvl > 0) {
      player.bleedChance += [0, 0.08, 0.16][bleedLvl];
    }

    // 19. Арсенал — обрабатывается в getWeaponSlots()

    // 20. Мастерство — обрабатывается в getAbilitySlots()

    // 21. Сопротивление дебаффам
    const debuffLvl = t.debuff_resist || 0;
    if (debuffLvl > 0) {
      player.debuffReduction += [0, 0.20, 0.40][debuffLvl];
    }

    // 22. Удачливый охотник (d20 бонус)
    const luckLvl = t.chest_luck || 0;
    if (luckLvl > 0) {
      player.d20MinBonus += [0, 1, 2][luckLvl];
    }

    // 23. Взрывная смерть
    const exploLvl = t.explosive_kill || 0;
    if (exploLvl > 0) {
      player.explosiveDeathChance += [0, 0.08, 0.15][exploLvl];
    }

    // 24. Мгновенная казнь
    const instLvl = t.instant_kill || 0;
    if (instLvl > 0) {
      player._instantKillChance = [0, 0.03, 0.06][instLvl];
    }

    // 25. Двойной опыт
    const dxpLvl = t.double_xp || 0;
    if (dxpLvl > 0) {
      player.doubleXpChance += [0, 0.05, 0.12][dxpLvl];
    }
  },

  /* ---------- Гильдия / Репутация ---------- */

  /** Текущий уровень гильдии (0-10). */
  getGuildLevel() {
    const rep = this.data.reputation;
    for (let i = GUILD_CONFIG.levels.length - 1; i >= 0; i--) {
      if (rep >= GUILD_CONFIG.levels[i].rep) return i + 1;
    }
    return 0;
  },

  /** Репутация до следующего уровня. */
  getNextLevelRep() {
    const lvl = this.getGuildLevel();
    if (lvl >= GUILD_CONFIG.levels.length) return null;
    return GUILD_CONFIG.levels[lvl].rep;
  },

  /** Добавить репутацию. */
  addReputation(amount) {
    const oldLvl = this.getGuildLevel();
    this.data.reputation += amount;
    const newLvl = this.getGuildLevel();
    this._recalcGuildBonuses();
    this.save();
    return newLvl > oldLvl;
  },

  /** Начислить репутацию за забег. */
  addRunReputation(bossKills, totalKills) {
    let rep = 10;
    rep += bossKills * 5;
    rep += Math.floor(totalKills / 100);
    return this.addReputation(rep);
  },

  /** Пересчитать бонусы слотов из уровня гильдии. */
  _recalcGuildBonuses() {
    let extraWeapons = 0;
    let extraAbilities = 0;
    const lvl = this.getGuildLevel();
    for (let i = 0; i < lvl; i++) {
      const reward = GUILD_CONFIG.levels[i];
      if (reward.type === 'weaponSlot') extraWeapons++;
      if (reward.type === 'abilitySlot') extraAbilities++;
    }
    this.data.extraWeaponSlots = extraWeapons;
    this.data.extraAbilitySlots = extraAbilities;
  },

  /** Получить количество слотов оружия (6 + бонус гильдии + талант). */
  getWeaponSlots() {
    const talentBonus = (this.data.talents.extra_weapon_slot || 0) >= 1 ? 1 : 0;
    return CONFIG.PLAYER.SLOTS_WEAPONS + (this.data.extraWeaponSlots || 0) + talentBonus;
  },

  /** Получить количество слотов пассивок (6 + бонус гильдии + талант). */
  getAbilitySlots() {
    const talentBonus = (this.data.talents.extra_ability_slot || 0) >= 1 ? 1 : 0;
    return CONFIG.PLAYER.SLOTS_ABILITIES + (this.data.extraAbilitySlots || 0) + talentBonus;
  },

  /** Проверить, открыт ли бонус гильдии определённого типа. */
  hasGuildBonus(type) {
    const lvl = this.getGuildLevel();
    for (let i = 0; i < lvl; i++) {
      if (GUILD_CONFIG.levels[i].type === type) return true;
    }
    return false;
  },

  /** Обновить статистику после забега. */
  updateStats(kills, runTime, bossKills) {
    this.data.totalKills += kills;
    this.data.totalBossKills = (this.data.totalBossKills || 0) + (bossKills || 0);
    this.data.totalRuns += 1;
    if (runTime > this.data.bestTime) this.data.bestTime = runTime;
    if (kills > (this.data.bestKills || 0)) this.data.bestKills = kills;
    // Bug fix: сохраняем killsByType для бестиария
    if (!this.data.killsByType) this.data.killsByType = {};
    if (window.Game && Game.killsByType) {
      for (const [typeId, count] of Object.entries(Game.killsByType)) {
        this.data.killsByType[typeId] = (this.data.killsByType[typeId] || 0) + count;
      }
    }
    // Обновляем guildStats
    if (!this.data.guildStats) this.data.guildStats = {};
    const gs = this.data.guildStats;
    gs.totalKills = this.data.totalKills;
    gs.totalBossKills = this.data.totalBossKills || 0;
    gs.totalRuns = this.data.totalRuns;
    gs.bestTime = this.data.bestTime;
    // Обновляем статистику открытых врагов/оружий
    if (window.Bestiary) {
      const bStats = Bestiary.getStats();
      gs.totalEnemiesDiscovered = bStats.unlocked;
    }
    if (window.Codex && Codex.getWeaponStats) {
      gs.totalWeaponsDiscovered = Codex.getWeaponStats().unlocked;
    }
    this.save();
  },

  /** Рассчитать золото за завершение забега. */
  calcEndOfRunGold(collectedGold, playerLevel) {
    const levelBonus = playerLevel * 10;
    return collectedGold + levelBonus;
  },

  /* ---------- Кампания ---------- */

  isCampaignCompleted() {
    return this.data && this.data.campaignCompleted;
  },

  setCampaignCompleted() {
    if (!this.data) return;
    this.data.campaignCompleted = true;
    this.save();
  },

  addAchievement(achievementId) {
    if (!this.data) return false;
    if (!this.data.achievements) this.data.achievements = [];
    if (this.data.achievements.includes(achievementId)) return false;
    this.data.achievements.push(achievementId);
    this.save();
    return true;
  },

  hasAchievement(achievementId) {
    if (!this.data || !this.data.achievements) return false;
    return this.data.achievements.includes(achievementId);
  },

  /* ---------- Задания гильдии ---------- */

  /** Получить текущее название ранга. */
  getGuildRankName() {
    const lvl = this.getGuildLevel();
    if (lvl === 0) return t('guild_rank_novice');
    return GUILD_CONFIG.levels[lvl - 1].name || t('level_short') + ' ' + lvl;
  },

  /** Инициализировать или обновить задания гильдии. */
  initGuildQuests() {
    if (!this.data) return;
    const now = Date.now();
    if (!this.data.guildQuests) {
      this.data.guildQuests = {
        daily: [],
        weekly: [],
        lastDailyReset: 0,
        lastWeeklyReset: 0,
      };
    }
    const q = this.data.guildQuests;
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;

    // Сброс дневных заданий (раз в 24 часа)
    if (now - (q.lastDailyReset || 0) >= dayMs) {
      q.daily = this._pickRandomQuests(GUILD_QUEST_POOL.daily, 2);
      q.lastDailyReset = now;
    }
    // Сброс недельных заданий (раз в 7 дней)
    if (now - (q.lastWeeklyReset || 0) >= weekMs) {
      q.weekly = this._pickRandomQuests(GUILD_QUEST_POOL.weekly, 1);
      q.lastWeeklyReset = now;
    }
    this.save();
  },

  /** Выбрать случайные задания из пула. */
  _pickRandomQuests(pool, count) {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const result = [];
    for (let i = 0; i < Math.min(count, shuffled.length); i++) {
      result.push({
        ...shuffled[i],
        progress: 0,
        completed: false,
        claimed: false,
      });
    }
    return result;
  },

  /** Обновить прогресс заданий (вызывается после забега). */
  updateQuestProgress(runStats) {
    if (!this.data || !this.data.guildQuests) return;
    const allQuests = [...(this.data.guildQuests.daily || []), ...(this.data.guildQuests.weekly || [])];
    for (const quest of allQuests) {
      if (quest.completed) continue;
      let add = 0;
      switch (quest.stat) {
        case 'kills':         add = runStats.kills || 0; break;
        case 'bossKills':     add = runStats.bossKills || 0; break;
        case 'surviveTime':   add = runStats.runTime || 0; break;
        case 'chestsOpened':  add = runStats.chestsOpened || 0; break;
        case 'waveReached':   add = Math.max(0, (runStats.wave || 0) - (quest.progress || 0)); quest.progress = Math.max(quest.progress, runStats.wave || 0); continue;
        case 'xpCollected':   add = runStats.xpCollected || 0; break;
        case 'runsCompleted': add = 1; break;
        case 'eliteKills':    add = runStats.eliteKills || 0; break;
        case 'killType':      add = runStats.killsByType && runStats.killsByType[quest.typeFilter] || 0; break;
        default: break;
      }
      if (quest.stat !== 'waveReached') {
        quest.progress = (quest.progress || 0) + add;
      }
      if (quest.progress >= quest.target) {
        quest.completed = true;
        quest.progress = quest.target;
      }
    }
    this.save();
  },

  /** Забрать награду за задание. Возвращает true если успешно. */
  claimQuestReward(questId) {
    if (!this.data || !this.data.guildQuests) return false;
    const allQuests = [...(this.data.guildQuests.daily || []), ...(this.data.guildQuests.weekly || [])];
    for (const quest of allQuests) {
      if (quest.id === questId && quest.completed && !quest.claimed) {
        quest.claimed = true;
        this.addReputation(quest.repReward || 0);
        this.save();
        return true;
      }
    }
    return false;
  },

  /** Получить все активные задания для UI. */
  getActiveQuests() {
    if (!this.data || !this.data.guildQuests) return { daily: [], weekly: [] };
    this.initGuildQuests(); // проверить сброс
    return {
      daily: this.data.guildQuests.daily || [],
      weekly: this.data.guildQuests.weekly || [],
    };
  },
};

// Экспорт
window.MetaProgress = MetaProgress;
window.TALENT_DEFS = TALENT_DEFS;
window.TALENT_MAP = TALENT_MAP;
window.GUILD_CONFIG = GUILD_CONFIG;
window.GUILD_QUEST_POOL = GUILD_QUEST_POOL;
