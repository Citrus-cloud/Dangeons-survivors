'use strict';
/* ============================================================
   metaprogress.js — Шаг 15: мета-прогрессия между забегами.
   Золото, дерево талантов, гильдия, сохранение в localStorage.
   ============================================================ */

const META_KEY = 'd20_metaprogress';

/* ---------- Конфигурация дерева талантов ---------- */
/* Feature #6: расширено до 10 уровней на каждую характеристику.
   Добавлены спецталанты: Возрождение (Телосложение), Увеличение снарядов (Ловкость). */
const TALENT_CONFIG = {
  strength: {
    id: 'strength', name: 'Сила', subtitle: 'Могущество',
    icon: '⚔', color: '#e74c3c',
    desc: '+8% к физическому урону за уровень',
    costs: [50, 150, 350, 700, 1200, 2000, 3200, 5000, 7500, 11000],
    maxLevel: 10,
    // Уровни 6-10: продолжение +8% урона + на 8 и 10 бонусные эффекты
    levelDescriptions: {
      6: '+8% физ. урона',
      7: '+8% физ. урона',
      8: '+8% физ. урона, +5% крит. удар',
      9: '+8% физ. урона',
      10: '+8% физ. урона, +10% крит. урон',
    },
  },
  dexterity: {
    id: 'dexterity', name: 'Ловкость', subtitle: 'Проворство',
    icon: '➤', color: '#2ecc71',
    desc: '+5% скорости, -3% кулдаунов за уровень. Ур.8-9: +1/+2 снаряда ко всему оружию',
    costs: [50, 150, 350, 700, 1200, 2000, 3200, 5000, 7500, 11000],
    maxLevel: 10,
    // Уровни 8, 9: увеличение снарядов (+1, +2)
    levelDescriptions: {
      6: '+5% скорости, -3% кулдаунов',
      7: '+5% скорости, -3% кулдаунов',
      8: '★ +1 СНАРЯД ко всему оружию',
      9: '★ +2 СНАРЯДА ко всему оружию',
      10: '+5% скорости, -3% кулдаунов, +10% уклонения',
    },
  },
  intelligence: {
    id: 'intelligence', name: 'Интеллект', subtitle: 'Магия',
    icon: '📖', color: '#9b59b6',
    desc: '+8% маг. урона, +1% крита заклинаний за уровень',
    costs: [50, 150, 350, 700, 1200, 2000, 3200, 5000, 7500, 11000],
    maxLevel: 10,
    levelDescriptions: {
      6: '+8% маг. урона, +1% крита',
      7: '+8% маг. урона, +1% крита',
      8: '+8% маг. урона, +2% крита',
      9: '+8% маг. урона, +2% крита, +10% длительность DoT',
      10: '+8% маг. урона, +3% крита, магический отклик +5%',
    },
  },
  constitution: {
    id: 'constitution', name: 'Телосложение', subtitle: 'Выносливость',
    icon: '🛡', color: '#3498db',
    desc: '+15 макс. HP, +1 HP/5с регенерации. Ур.8-9: ★ Возрождение',
    costs: [50, 150, 350, 700, 1200, 2000, 3200, 10000, 50000, 11000],
    maxLevel: 10,
    // Уровни 8, 9: Возрождение (1 раз с 30% HP, 2 раза с 100% HP)
    levelDescriptions: {
      6: '+15 HP, +регенерация',
      7: '+15 HP, +регенерация, +3% снижение урона',
      8: '★ ВОЗРОЖДЕНИЕ (1 раз, 30% HP)',
      9: '★ ВОЗРОЖДЕНИЕ (2 раза, 100% HP)',
      10: '+15 HP, +регенерация, +5% снижение урона',
    },
  },
  charisma: {
    id: 'charisma', name: 'Харизма', subtitle: 'Удача',
    icon: '🪙', color: '#f1c40f',
    desc: '+5% опыта и золота за уровень',
    costs: [60, 180, 420, 840, 1440, 2400, 3800, 6000, 9000, 13000],
    maxLevel: 10,
    levelDescriptions: {
      6: '+5% опыта и золота',
      7: '+5% опыта и золота, +2% шанс двойного XP',
      8: '+5% опыта и золота, +1 к мин. d20',
      9: '+5% опыта и золота, +5% шанс двойного XP',
      10: '+5% опыта и золота, +2 к мин. d20',
    },
  },
};

/* ---------- Конфигурация гильдии ---------- */
const GUILD_CONFIG = {
  levels: [
    { rep: 100,  reward: '+1 слот оружия (всего 7)', type: 'weaponSlot' },
    { rep: 300,  reward: 'Клинок короля-лича', type: 'unlockExclusive', exclusiveId: 'lich_blade' },
    { rep: 600,  reward: '+1 слот пассивки (всего 7)', type: 'abilitySlot' },
    { rep: 1000, reward: 'Старт с мечом +1 ур.', type: 'startBonus' },
    { rep: 1500, reward: '+5% шанс эксклюзива', type: 'exclusiveChance' },
    { rep: 2200, reward: '+1 слот оружия (всего 8)', type: 'weaponSlot' },
    { rep: 3000, reward: 'Посох архимага', type: 'unlockExclusive', exclusiveId: 'archmage_staff' },
    { rep: 4000, reward: '+1 слот пассивки (всего 8)', type: 'abilitySlot' },
    { rep: 5500, reward: '+20% XP на 2 мин при старте', type: 'startXpBoost' },
    { rep: 7500, reward: 'Легенда: +10% ко всем статам', type: 'legendBonus' },
  ],
};

/* ---------- MetaProgress — основной объект ---------- */
const MetaProgress = {
  data: null,

  /** Создать пустой объект мета-прогресса. */
  _createDefault() {
    return {
      gold: 0,
      talents: {
        strength: 0,
        dexterity: 0,
        intelligence: 0,
        constitution: 0,
        charisma: 0,
      },
      reputation: 0,
      totalKills: 0,
      totalRuns: 0,
      bestTime: 0,
      bestKills: 0,
      unlockedExclusives: [],
      extraWeaponSlots: 0,
      extraAbilitySlots: 0,
      achievements: [],
      campaignCompleted: false,
    };
  },

  /** Загрузить из localStorage (или создать новый). */
  load() {
    try {
      const raw = localStorage.getItem(META_KEY);
      if (raw) {
        this.data = JSON.parse(raw);
        // Обеспечить совместимость при обновлениях
        const def = this._createDefault();
        for (const k of Object.keys(def)) {
          if (this.data[k] === undefined) this.data[k] = def[k];
        }
        if (!this.data.talents) this.data.talents = def.talents;
        for (const k of Object.keys(def.talents)) {
          if (this.data.talents[k] === undefined) this.data.talents[k] = 0;
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
      localStorage.setItem(META_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('[MetaProgress] save error:', e);
    }
  },

  /* ---------- Золото ---------- */

  addGold(amount) {
    // Бонус от харизмы
    const charLvl = this.data.talents.charisma || 0;
    const bonus = 1 + charLvl * 0.05;
    this.data.gold += Math.floor(amount * bonus);
    this.save();
  },

  spendGold(amount) {
    if (this.data.gold < amount) return false;
    this.data.gold -= amount;
    this.save();
    return true;
  },

  /* ---------- Дерево талантов ---------- */

  /** Получить текущую стоимость следующего уровня таланта. */
  getTalentCost(talentId) {
    const cfg = TALENT_CONFIG[talentId];
    if (!cfg) return Infinity;
    const lvl = this.data.talents[talentId] || 0;
    if (lvl >= cfg.maxLevel) return Infinity;
    return cfg.costs[lvl];
  },

  /** Купить уровень таланта. Возвращает true если успешно. */
  upgradeTalent(talentId) {
    const cfg = TALENT_CONFIG[talentId];
    if (!cfg) return false;
    const lvl = this.data.talents[talentId] || 0;
    if (lvl >= cfg.maxLevel) return false;
    const cost = cfg.costs[lvl];
    if (this.data.gold < cost) return false;
    this.data.gold -= cost;
    this.data.talents[talentId] = lvl + 1;
    this.save();
    return true;
  },

  /** Сбросить все таланты, вернуть 80% вложенного золота. */
  resetTalents() {
    let totalSpent = 0;
    for (const id of Object.keys(TALENT_CONFIG)) {
      const cfg = TALENT_CONFIG[id];
      const lvl = this.data.talents[id] || 0;
      for (let i = 0; i < lvl; i++) {
        totalSpent += cfg.costs[i];
      }
      this.data.talents[id] = 0;
    }
    const refund = Math.floor(totalSpent * 0.8);
    this.data.gold += refund;
    this.save();
    return refund;
  },

  /** Применить бонусы талантов к объекту игрока (при старте забега). */
  applyTalents(player) {
    const t = this.data.talents;

    // Сила: +8% физ. урон за уровень; ур.8: +5% крит; ур.10: +10% крит. урон
    if (t.strength > 0) {
      player.damageMul *= (1 + t.strength * 0.08);
      if (t.strength >= 8) player.critChance += 0.05;
      if (t.strength >= 10) player._critDamageMul = (player._critDamageMul || 2) + 0.10;
    }

    // Ловкость: +5% скорость, -3% кулдаунов за уровень
    // Ур.8: +1 снаряд, Ур.9: +2 снаряда (всего), Ур.10: +10% уклонения
    if (t.dexterity > 0) {
      player.speedMul *= (1 + t.dexterity * 0.05);
      player.weaponCdMul *= (1 - t.dexterity * 0.03);
      player.missileCdMul *= (1 - t.dexterity * 0.03);
      // Feature #6: бонусные снаряды для всего оружия
      if (t.dexterity >= 9) {
        player._talentBonusProjectiles = 2;
      } else if (t.dexterity >= 8) {
        player._talentBonusProjectiles = 1;
      }
      if (t.dexterity >= 10) {
        player._dodgeChance = (player._dodgeChance || 0) + 0.10;
      }
    }

    // Интеллект: +8% маг. урон, +1% крит заклинаний за уровень
    // Ур.8-9: +2% крит; Ур.9: +10% DoT; Ур.10: +3% крит, +5% магический отклик
    if (t.intelligence > 0) {
      player.magicDamageMul *= (1 + t.intelligence * 0.08);
      let critBonus = t.intelligence * 0.01;
      if (t.intelligence >= 8) critBonus += 0.01;
      if (t.intelligence >= 9) critBonus += 0.01;
      if (t.intelligence >= 10) critBonus += 0.02;
      player.critChance += critBonus;
      if (t.intelligence >= 9) player.dotDamageMul *= 1.10;
      if (t.intelligence >= 10) player.magicEchoChance += 0.05;
    }

    // Телосложение: +15 макс HP, +1 HP/5с регенерации за уровень
    // Ур.7: +3% снижение урона; Ур.8: Возрождение 1; Ур.9: Возрождение 2; Ур.10: +5% DR
    if (t.constitution > 0) {
      const bonusHp = t.constitution * 15;
      player.talentBonusHp = bonusHp; // Bug fix #1: сохраняем отдельно для пересчёта
      player.maxHp += bonusHp;
      player.hp += bonusHp;
      player.hpRegen += t.constitution * (1 / 5); // 1 HP per 5 seconds = 0.2 HP/s
      if (t.constitution >= 7) player.damageReduction += 0.03;
      if (t.constitution >= 10) player.damageReduction += 0.05;
      // Feature #6: Возрождение
      if (t.constitution >= 9) {
        player._resurrectCount = 2;
        player._resurrectHpPct = 1.0; // 100% HP
      } else if (t.constitution >= 8) {
        player._resurrectCount = 1;
        player._resurrectHpPct = 0.30; // 30% HP
      }
    }

    // Харизма: +5% XP и золота
    // Ур.7: +2% двойной XP; Ур.8: +1 мин d20; Ур.9: +5% двойной XP; Ур.10: +2 мин d20
    if (t.charisma > 0) {
      player.xpBonusMul = 1 + t.charisma * 0.05;
      if (t.charisma >= 7) player.doubleXpChance += 0.02;
      if (t.charisma >= 8) player.d20MinBonus += 1;
      if (t.charisma >= 9) player.doubleXpChance += 0.05;
      if (t.charisma >= 10) player.d20MinBonus += 2;
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
    // Пересчитать бонусы гильдии
    this._recalcGuildBonuses();
    this.save();
    return newLvl > oldLvl; // вернуть, повысился ли уровень
  },

  /** Начислить репутацию за забег. */
  addRunReputation(bossKills, totalKills) {
    let rep = 10; // базовая за забег
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

  /** Получить количество слотов оружия (6 + бонус гильдии). */
  getWeaponSlots() {
    return CONFIG.PLAYER.SLOTS_WEAPONS + (this.data.extraWeaponSlots || 0);
  },

  /** Получить количество слотов пассивок (6 + бонус гильдии). */
  getAbilitySlots() {
    return CONFIG.PLAYER.SLOTS_ABILITIES + (this.data.extraAbilitySlots || 0);
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
  updateStats(kills, runTime) {
    this.data.totalKills += kills;
    this.data.totalRuns += 1;
    if (runTime > this.data.bestTime) this.data.bestTime = runTime;
    if (kills > (this.data.bestKills || 0)) this.data.bestKills = kills;
    this.save();
  },

  /** Рассчитать золото за завершение забега (подобранное + бонус за уровень). */
  calcEndOfRunGold(collectedGold, playerLevel) {
    const levelBonus = playerLevel * 10;
    return collectedGold + levelBonus;
  },

  /* ---------- Кампания (Шаг 16) ---------- */

  /** Проверить, завершена ли кампания. */
  isCampaignCompleted() {
    return this.data && this.data.campaignCompleted;
  },

  /** Отметить кампанию как завершённую. */
  setCampaignCompleted() {
    if (!this.data) return;
    this.data.campaignCompleted = true;
    this.save();
  },

  /** Добавить достижение (если ещё не получено). */
  addAchievement(achievementId) {
    if (!this.data) return false;
    if (!this.data.achievements) this.data.achievements = [];
    if (this.data.achievements.includes(achievementId)) return false;
    this.data.achievements.push(achievementId);
    this.save();
    return true;
  },

  /** Проверить наличие достижения. */
  hasAchievement(achievementId) {
    if (!this.data || !this.data.achievements) return false;
    return this.data.achievements.includes(achievementId);
  },
};

// Экспорт
window.MetaProgress = MetaProgress;
window.TALENT_CONFIG = TALENT_CONFIG;
window.GUILD_CONFIG = GUILD_CONFIG;
