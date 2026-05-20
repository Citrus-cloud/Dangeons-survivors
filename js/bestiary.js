'use strict';
/* ============================================================
   bestiary.js — Бестиарий: список врагов с описаниями, механика открытия.
   Сохранение в localStorage (d20_bestiary).
   Bug fix: корректная фильтрация врагов, подсчёт, описания для всех.
   ============================================================ */

/** Описания врагов (юмористические, 1 предложение). */
const BESTIARY_DESCRIPTIONS = {
  // --- Базовые (constants.js) ---
  skeleton: t('bestiary_desc_skeleton'),
  zombie: t('bestiary_desc_zombie'),
  goblin: t('bestiary_desc_goblin'),
  giant_rat: t('bestiary_desc_giant_rat'),
  acid_slug: t('bestiary_desc_acid_slug'),
  cave_bat: t('bestiary_desc_cave_bat'),
  ratcatcher: t('bestiary_desc_ratcatcher'),
  mold: t('bestiary_desc_mold'),
  archer: t('bestiary_desc_archer'),
  ooze: t('bestiary_desc_ooze'),
  gasspore: t('bestiary_desc_gasspore'),
  gnoll: t('bestiary_desc_gnoll'),
  kobold: t('bestiary_desc_kobold'),
  cave_crab: t('bestiary_desc_cave_crab'),
  ghost: t('bestiary_desc_ghost'),
  alchemist_skel: t('bestiary_desc_alchemist_skel'),
  harpy: t('bestiary_desc_harpy'),
  dung_beetle: t('bestiary_desc_dung_beetle'),
  mage: t('bestiary_desc_mage'),
  spider: t('bestiary_desc_spider'),
  fire_elem: t('bestiary_desc_fire_elem'),
  bat: t('bestiary_desc_bat'),
  minotaur: t('bestiary_desc_minotaur'),
  basilisk: t('bestiary_desc_basilisk'),
  medusa: t('bestiary_desc_medusa'),
  doppelganger: t('bestiary_desc_doppelganger'),
  earth_elem: t('bestiary_desc_earth_elem'),
  water_elem: t('bestiary_desc_water_elem'),
  beholder_spore: t('bestiary_desc_beholder_spore'),
  hell_hound: t('bestiary_desc_hell_hound'),
  captain: t('bestiary_desc_captain'),
  cultist: t('bestiary_desc_cultist'),
  shadow: t('bestiary_desc_shadow'),
  dragonid: t('bestiary_desc_dragonid'),
  drow: t('bestiary_desc_drow'),
  illithid: t('bestiary_desc_illithid'),
  stone_golem: t('bestiary_desc_stone_golem'),
  rust_monster: t('bestiary_desc_rust_monster'),
  lich_minor: t('bestiary_desc_lich_minor'),
  chimera: t('bestiary_desc_chimera'),
  demon_berserker: t('bestiary_desc_demon_berserker'),
  rotgolem: t('bestiary_desc_rotgolem'),
  dragonet: t('bestiary_desc_dragonet'),
  young_dragon: t('bestiary_desc_young_dragon'),
  observer: t('bestiary_desc_observer'),
  death_knight: t('bestiary_desc_death_knight'),
  hydra_small: t('bestiary_desc_hydra_small'),
  archlich: t('bestiary_desc_archlich'),
  eldritch_horror: t('bestiary_desc_eldritch_horror'),
  bone_colossus: t('bestiary_desc_bone_colossus'),
  mimic: t('bestiary_desc_mimic'),
  spiderling: t('bestiary_desc_spiderling'),
  slimeling: t('bestiary_desc_slimeling'),

  // --- Step12 враги (constants_step12.js) ---
  bone_golem: t('bestiary_desc_bone_golem'),
  phase_spider: t('bestiary_desc_phase_spider'),
  ettercap: t('bestiary_desc_ettercap'),
  fungal_man: t('bestiary_desc_fungal_man'),
  troll: t('bestiary_desc_troll'),
  cave_bear: t('bestiary_desc_cave_bear'),
  ogre: t('bestiary_desc_ogre'),
  pterodactyl: t('bestiary_desc_pterodactyl'),
  giant_scorpion: t('bestiary_desc_giant_scorpion'),
  lamia: t('bestiary_desc_lamia'),
  dragon_wyrm: t('bestiary_desc_dragon_wyrm'),
  salamander: t('bestiary_desc_salamander'),
  water_elem_large: t('bestiary_desc_water_elem_large'),
  air_elem: t('bestiary_desc_air_elem'),
  gargoyle: t('bestiary_desc_gargoyle'),
  banshee: t('bestiary_desc_banshee'),
  vampire_spawn: t('bestiary_desc_vampire_spawn'),
  doppelganger_mage: t('bestiary_desc_doppelganger_mage'),
  owlbear: t('bestiary_desc_owlbear'),
  ice_elem: t('bestiary_desc_ice_elem'),
  adult_dragon: t('bestiary_desc_adult_dragon'),
  demon_destroyer: t('bestiary_desc_demon_destroyer'),
  illithid_arcanist: t('bestiary_desc_illithid_arcanist'),
  rakshasa: t('bestiary_desc_rakshasa'),
  golem_colossus: t('bestiary_desc_golem_colossus'),
  shadow_dragon: t('bestiary_desc_shadow_dragon'),
  slime_queen: t('bestiary_desc_slime_queen'),
  iron_golem: t('bestiary_desc_iron_golem'),
  archdemon: t('bestiary_desc_archdemon'),
  star_spawn: t('bestiary_desc_star_spawn'),
  ancient_dragon: t('bestiary_desc_ancient_dragon'),
  kraken_tentacle: t('bestiary_desc_kraken_tentacle'),
  tarrasque_juv: t('bestiary_desc_tarrasque_juv'),
  chaos_god: t('bestiary_desc_chaos_god'),
  vampire_lord: t('bestiary_desc_vampire_lord'),
  demilich: t('bestiary_desc_demilich'),
  empyrean: t('bestiary_desc_empyrean'),
  beast_lord: t('bestiary_desc_beast_lord'),
  titan_elem: t('bestiary_desc_titan_elem'),
  night_walker: t('bestiary_desc_night_walker'),
};

/** Способности врагов (краткое описание особых механик для бестиария). */
const BESTIARY_ABILITIES = {
  // --- Базовые ---
  skeleton: null,
  zombie: t('bestiary_desc_zombie'),
  goblin: t('bestiary_desc_goblin'),
  giant_rat: t('bestiary_desc_giant_rat'),
  acid_slug: t('bestiary_desc_acid_slug'),
  cave_bat: t('bestiary_desc_cave_bat'),
  ratcatcher: t('bestiary_desc_ratcatcher'),
  mold: t('bestiary_desc_mold'),
  archer: t('bestiary_desc_archer'),
  ooze: t('bestiary_desc_ooze'),
  gasspore: t('bestiary_desc_gasspore'),
  gnoll: t('bestiary_desc_gnoll'),
  kobold: t('bestiary_desc_kobold'),
  cave_crab: t('bestiary_desc_cave_crab'),
  ghost: t('bestiary_desc_ghost'),
  alchemist_skel: t('bestiary_desc_alchemist_skel'),
  harpy: t('bestiary_desc_harpy'),
  dung_beetle: t('bestiary_desc_dung_beetle'),
  mage: t('bestiary_desc_mage'),
  spider: t('bestiary_desc_spider'),
  fire_elem: t('bestiary_desc_fire_elem'),
  bat: t('bestiary_desc_bat'),
  minotaur: t('bestiary_desc_minotaur'),
  basilisk: t('bestiary_desc_basilisk'),
  medusa: t('bestiary_desc_medusa'),
  doppelganger: t('bestiary_desc_doppelganger'),
  earth_elem: t('bestiary_desc_earth_elem'),
  water_elem: t('bestiary_desc_water_elem'),
  beholder_spore: t('bestiary_desc_beholder_spore'),
  hell_hound: t('bestiary_desc_hell_hound'),
  captain: t('bestiary_desc_captain'),
  cultist: t('bestiary_desc_cultist'),
  shadow: t('bestiary_desc_shadow'),
  dragonid: t('bestiary_desc_dragonid'),
  drow: t('bestiary_desc_drow'),
  illithid: t('bestiary_desc_illithid'),
  stone_golem: t('bestiary_desc_stone_golem'),
  rust_monster: t('bestiary_desc_rust_monster'),
  lich_minor: t('bestiary_desc_lich_minor'),
  chimera: t('bestiary_desc_chimera'),
  demon_berserker: t('bestiary_desc_demon_berserker'),
  rotgolem: t('bestiary_desc_rotgolem'),
  dragonet: t('bestiary_desc_dragonet'),
  young_dragon: t('bestiary_desc_young_dragon'),
  observer: t('bestiary_desc_observer'),
  death_knight: t('bestiary_desc_death_knight'),
  hydra_small: t('bestiary_desc_hydra_small'),
  archlich: t('bestiary_desc_archlich'),
  eldritch_horror: t('bestiary_desc_eldritch_horror'),
  bone_colossus: t('bestiary_desc_bone_colossus'),
  mimic: t('bestiary_desc_mimic'),
  spiderling: null,
  slimeling: null,

  // --- Step12 враги ---
  bone_golem: t('bestiary_desc_bone_golem'),
  phase_spider: t('bestiary_desc_phase_spider'),
  ettercap: t('bestiary_desc_ettercap'),
  fungal_man: t('bestiary_desc_fungal_man'),
  troll: t('bestiary_desc_troll'),
  cave_bear: t('bestiary_desc_cave_bear'),
  ogre: t('bestiary_desc_ogre'),
  pterodactyl: t('bestiary_desc_pterodactyl'),
  giant_scorpion: t('bestiary_desc_giant_scorpion'),
  lamia: t('bestiary_desc_lamia'),
  dragon_wyrm: t('bestiary_desc_dragon_wyrm'),
  salamander: t('bestiary_desc_salamander'),
  water_elem_large: t('bestiary_desc_water_elem_large'),
  air_elem: t('bestiary_desc_air_elem'),
  gargoyle: t('bestiary_desc_gargoyle'),
  banshee: t('bestiary_desc_banshee'),
  vampire_spawn: t('bestiary_desc_vampire_spawn'),
  doppelganger_mage: t('bestiary_desc_doppelganger_mage'),
  owlbear: t('bestiary_desc_owlbear'),
  ice_elem: t('bestiary_desc_ice_elem'),
  adult_dragon: t('bestiary_desc_adult_dragon'),
  demon_destroyer: t('bestiary_desc_demon_destroyer'),
  illithid_arcanist: t('bestiary_desc_illithid_arcanist'),
  rakshasa: t('bestiary_desc_rakshasa'),
  golem_colossus: t('bestiary_desc_golem_colossus'),
  shadow_dragon: t('bestiary_desc_shadow_dragon'),
  slime_queen: t('bestiary_desc_slime_queen'),
  iron_golem: t('bestiary_desc_iron_golem'),
  archdemon: t('bestiary_desc_archdemon'),
  star_spawn: t('bestiary_desc_star_spawn'),
  ancient_dragon: t('bestiary_desc_ancient_dragon'),
  kraken_tentacle: t('bestiary_desc_kraken_tentacle'),
  tarrasque_juv: t('bestiary_desc_tarrasque_juv'),
  chaos_god: t('bestiary_desc_chaos_god'),
  vampire_lord: t('bestiary_desc_vampire_lord'),
  demilich: t('bestiary_desc_demilich'),
  empyrean: t('bestiary_desc_empyrean'),
  beast_lord: t('bestiary_desc_beast_lord'),
  titan_elem: t('bestiary_desc_titan_elem'),
  night_walker: t('bestiary_desc_night_walker'),
};

/** Категория скорости для отображения в бестиарии. */
function _getSpeedCategory(speed) {
  if (speed <= 0) return t('bestiary_speed_immobile');
  if (speed <= 35) return t('bestiary_speed_very_slow');
  if (speed <= 55) return t('bestiary_speed_slow');
  if (speed <= 80) return t('bestiary_speed_medium');
  if (speed <= 110) return t('bestiary_speed_fast');
  return t('bestiary_speed_very_fast');
}

/** Название тира для отображения. */
function _getTierLabel(tier) {
  switch (tier) {
    case 1: return t('bestiary_tier_common');
    case 2: return t('bestiary_tier_uncommon');
    case 3: return t('bestiary_tier_dangerous');
    case 4: return t('bestiary_tier_serious');
    case 5: return t('bestiary_tier_rare');
    case 6: return t('bestiary_tier_legendary');
    case 0: return t('bestiary_tier_special');
    default: return t('bestiary_tier_unknown');
  }
}

/**
 * Фильтр: какие враги показываются в бестиарии.
 * Исключаются:
 * - Элитные варианты (isEliteVariant)
 * - Дочерние сущности (spiderling, slimeling) — показываются, но с пометкой
 * Включаются:
 * - Все обычные враги (tier 1-6)
 * - Мимик (tier 0, но уникальный)
 * - Боссы (если есть в ENEMY_TYPES, обычно нет)
 */
function _isBestiaryEnemy(cfg) {
  if (!cfg || !cfg.id) return false;
  // Исключаем элитные варианты (автогенерированные)
  if (cfg.isEliteVariant) return false;
  // Исключаем боссов (они в BOSS_TYPES, не в ENEMY_TYPES обычно, но если есть)
  if (cfg.id.startsWith('boss_')) return false;
  return true;
}

const Bestiary = {
  _data: null, // Set of unlocked enemy IDs
  selectedEnemyId: null, // Текущий выбранный враг для правой панели

  /** Загрузить из localStorage. */
  load() {
    try {
      const raw = localStorage.getItem('d20_bestiary');
      if (raw) {
        this._data = new Set(JSON.parse(raw));
      } else {
        this._data = new Set();
      }
    } catch (e) {
      this._data = new Set();
    }
  },

  /** Сохранить в localStorage. */
  save() {
    if (!this._data) this._data = new Set();
    localStorage.setItem('d20_bestiary', JSON.stringify([...this._data]));
  },

  /** Разблокировать врага (вызывается при убийстве). */
  unlock(enemyId) {
    if (!this._data) this.load();
    if (!this._data.has(enemyId)) {
      this._data.add(enemyId);
      this.save();
    }
  },

  /** Проверить, разблокирован ли. */
  isUnlocked(enemyId) {
    if (!this._data) this.load();
    return this._data.has(enemyId);
  },

  /** Получить описание врага. */
  getDescription(enemyId) {
    // Проверяем локализованный ключ, затем русский hardcoded
    const locKey = 'bestiary_desc_' + enemyId;
    const localized = LOCALE[getLang()] && LOCALE[getLang()][locKey];
    if (localized) return localized;
    return BESTIARY_DESCRIPTIONS[enemyId] || t('bestiary_unknown_creature');
  },

  /** Получить способности врага. */
  getAbilities(enemyId) {
    // Проверяем локализованный ключ
    const locKey = 'bestiary_ability_' + enemyId;
    const localized = LOCALE[getLang()] && LOCALE[getLang()][locKey];
    if (localized) return localized;
    return BESTIARY_ABILITIES[enemyId] || null;
  },

  /** Получить категорию скорости. */
  getSpeedLabel(enemyId) {
    const cfg = (window.ENEMY_TYPES && ENEMY_TYPES[enemyId]) || {};
    return _getSpeedCategory(cfg.speed || 0);
  },

  /** Получить название тира. */
  getTierLabel(enemyId) {
    const cfg = (window.ENEMY_TYPES && ENEMY_TYPES[enemyId]) || {};
    return _getTierLabel(cfg.tier != null ? cfg.tier : -1);
  },

  /**
   * Получить все типы врагов для отображения в бестиарии.
   * Bug fix: исключает элитные варианты и корректно фильтрует.
   * Сортирует по тиру (1→6, затем 0).
   */
  getAllEnemies() {
    if (!window.ENEMY_TYPES) return [];
    const all = Object.values(ENEMY_TYPES).filter(_isBestiaryEnemy);
    // Сортировка: тир 1..6, затем тир 0 (особые) в конце
    all.sort((a, b) => {
      const ta = a.tier === 0 ? 99 : a.tier;
      const tb = b.tier === 0 ? 99 : b.tier;
      if (ta !== tb) return ta - tb;
      return (a.name || '').localeCompare(b.name || '');
    });
    return all;
  },

  /**
   * Получить статистику: открыто/всего.
   * Bug fix: считает только врагов, отображаемых в бестиарии
   * (исключает элитные варианты).
   */
  getStats() {
    if (!this._data) this.load();
    const bestiaryEnemies = this.getAllEnemies();
    const total = bestiaryEnemies.length;
    // Считаем только те unlocked, которые реально есть в бестиарии
    let unlocked = 0;
    for (const cfg of bestiaryEnemies) {
      if (this._data.has(cfg.id)) unlocked++;
    }
    return { unlocked, total };
  },

  /**
   * Получить врагов, сгруппированных по тиру.
   * Возвращает массив { tier, label, enemies: [...] }
   */
  getGroupedByTier() {
    const all = this.getAllEnemies();
    const groups = {};
    for (const cfg of all) {
      const t = cfg.tier || 0;
      if (!groups[t]) groups[t] = [];
      groups[t].push(cfg);
    }
    const result = [];
    // Порядок: 1, 2, 3, 4, 5, 6, 0
    const order = [1, 2, 3, 4, 5, 6, 0];
    for (const t of order) {
      if (groups[t] && groups[t].length > 0) {
        result.push({
          tier: t,
          label: _getTierLabel(t),
          enemies: groups[t],
        });
      }
    }
    return result;
  },

  /** Получить количество убийств данного типа за текущий забег. */
  getKillCount(enemyId) {
    if (!window.Game || !Game.killsByType) return 0;
    return Game.killsByType[enemyId] || 0;
  },

  /** Получить общее количество убийств данного типа (из мета-статистики). */
  getTotalKills(enemyId) {
    // Если доступна мета-статистика, возвращаем оттуда
    if (window.MetaProgress && MetaProgress.data && MetaProgress.data.killsByType) {
      return MetaProgress.data.killsByType[enemyId] || 0;
    }
    return 0;
  },
};

window.Bestiary = Bestiary;
window.BESTIARY_DESCRIPTIONS = BESTIARY_DESCRIPTIONS;
window.BESTIARY_ABILITIES = BESTIARY_ABILITIES;
