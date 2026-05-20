'use strict';
/* ============================================================
   i18n.js — Система локализации (RU/EN).
   Функция t(key) возвращает строку на текущем языке.
   Язык сохраняется в localStorage ('d20_lang').
   ============================================================ */

const LOCALE = { ru: {}, en: {} };

// --- Определение языка ---
let _currentLang = 'ru';
(function() {
  const saved = localStorage.getItem('d20_lang');
  if (saved && (saved === 'ru' || saved === 'en')) {
    _currentLang = saved;
  } else {
    const nav = (navigator.language || navigator.userLanguage || 'ru').toLowerCase();
    _currentLang = nav.startsWith('en') ? 'en' : 'ru';
    localStorage.setItem('d20_lang', _currentLang);
  }
})();

/** Получить строку на текущем языке */
function t(key, ...args) {
  const str = (LOCALE[_currentLang] && LOCALE[_currentLang][key]) ||
              (LOCALE.ru && LOCALE.ru[key]) || key;
  if (args.length === 0) return str;
  // Поддержка подстановки {0}, {1}...
  return str.replace(/\{(\d+)\}/g, (m, i) => args[i] !== undefined ? args[i] : m);
}

/** Сменить язык */
function setLang(lang) {
  if (lang !== 'ru' && lang !== 'en') return;
  _currentLang = lang;
  localStorage.setItem('d20_lang', lang);
  // Обновить HTML-элементы с data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  // Перестроить динамические оверлеи лагеря при смене языка
  if (window.UI && UI._campOverlay) {
    UI._campOverlay.remove();
    UI._campOverlay = null;
  }
}

/** Получить текущий язык */
function getLang() { return _currentLang; }

window.t = t;
window.setLang = setLang;
window.getLang = getLang;
window.LOCALE = LOCALE;



/* ============================================================
   ГЛАВНОЕ МЕНЮ И TITLE SCREEN
   ============================================================ */
LOCALE.ru.title_main = 'Dungeon Survivors';
LOCALE.ru.title_sub = 'D20';
LOCALE.ru.title_tap = 'Нажмите, чтобы начать';
LOCALE.ru.loading = 'Загрузка...';
LOCALE.ru.menu_start = 'НАЧАТЬ';
LOCALE.ru.menu_controls = 'Касание — динамический джойстик. ПК: WASD/стрелки.';

LOCALE.en.title_main = 'Dungeon Survivors';
LOCALE.en.title_sub = 'D20';
LOCALE.en.title_tap = 'Tap to start';
LOCALE.en.loading = 'Loading...';
LOCALE.en.menu_start = 'START';
LOCALE.en.menu_controls = 'Touch — dynamic joystick. PC: WASD/Arrows.';

/* ============================================================
   HUD
   ============================================================ */
LOCALE.ru.hud_hp = 'HP: {0}/{1}';
LOCALE.ru.hud_level = 'Ур. {0}';
LOCALE.ru.hud_kills = 'Убийств: {0}';
LOCALE.ru.hud_wave = 'Волна {0} через {1}с';
LOCALE.ru.hud_boss = '⚔ БОСС ⚔';
LOCALE.ru.hud_boss_in = 'Босс: {0}с';
LOCALE.ru.hud_portal_open = '⟐ ПОРТАЛ ОТКРЫТ ⟐';
LOCALE.ru.hud_portal_in = 'Портал: {0}с';
LOCALE.ru.hud_pause_btn = '⏸';

LOCALE.en.hud_hp = 'HP: {0}/{1}';
LOCALE.en.hud_level = 'Lv. {0}';
LOCALE.en.hud_kills = 'Kills: {0}';
LOCALE.en.hud_wave = 'Wave {0} in {1}s';
LOCALE.en.hud_boss = '⚔ BOSS ⚔';
LOCALE.en.hud_boss_in = 'Boss: {0}s';
LOCALE.en.hud_portal_open = '⟐ PORTAL OPEN ⟐';
LOCALE.en.hud_portal_in = 'Portal: {0}s';
LOCALE.en.hud_pause_btn = '⏸';



/* ============================================================
   ПАУЗА, СМЕРТЬ, ПОБЕДА
   ============================================================ */
LOCALE.ru.pause_title = 'ПАУЗА';
LOCALE.ru.pause_resume = 'Продолжить';
LOCALE.ru.pause_exit = '🚪 Выйти в лагерь';
LOCALE.ru.death_title = 'ВЫ ПОГИБЛИ';
LOCALE.ru.death_time = 'Время: {0}';
LOCALE.ru.death_kills = 'Убийств: {0}';
LOCALE.ru.death_level = 'Уровень: {0}';
LOCALE.ru.death_restart = 'В лагерь';
LOCALE.ru.victory_title = 'ПОБЕДА!';

LOCALE.en.pause_title = 'PAUSED';
LOCALE.en.pause_resume = 'Resume';
LOCALE.en.pause_exit = '🚪 Exit to camp';
LOCALE.en.death_title = 'YOU DIED';
LOCALE.en.death_time = 'Time: {0}';
LOCALE.en.death_kills = 'Kills: {0}';
LOCALE.en.death_level = 'Level: {0}';
LOCALE.en.death_restart = 'To camp';
LOCALE.en.victory_title = 'VICTORY!';

/* ============================================================
   LEVEL UP
   ============================================================ */
LOCALE.ru.levelup_title = 'УРОВЕНЬ {0}!';
LOCALE.ru.levelup_choose = 'Выберите улучшение';
LOCALE.ru.levelup_continue = 'Продолжить';
LOCALE.ru.levelup_all_max = 'Все улучшения максимальны.';
LOCALE.ru.levelup_new = 'НОВОЕ';
LOCALE.ru.levelup_new_weapon = 'Новое: {0}';
LOCALE.ru.levelup_new_ability = 'Новая: {0}';
LOCALE.ru.levelup_upgrade_desc = 'Урон +12%, кулдаун -5%. (Ур. {0}/{1})';

LOCALE.en.levelup_title = 'LEVEL {0}!';
LOCALE.en.levelup_choose = 'Choose an upgrade';
LOCALE.en.levelup_continue = 'Continue';
LOCALE.en.levelup_all_max = 'All upgrades are maxed.';
LOCALE.en.levelup_new = 'NEW';
LOCALE.en.levelup_new_weapon = 'New: {0}';
LOCALE.en.levelup_new_ability = 'New: {0}';
LOCALE.en.levelup_upgrade_desc = 'Damage +12%, cooldown -5%. (Lv. {0}/{1})';



/* ============================================================
   СУНДУК / D20
   ============================================================ */
LOCALE.ru.chest_title = 'СУНДУК';
LOCALE.ru.chest_rolling = 'Бросок d20…';
LOCALE.ru.chest_reward_title = 'Награда';
LOCALE.ru.chest_roll_label = 'Бросок:';
LOCALE.ru.chest_accept = 'Забрать';
LOCALE.ru.chest_upgrade_title = 'УЛУЧШЕНИЕ';
LOCALE.ru.chest_pick_sub = '— выберите карту';
LOCALE.ru.chest_no_upgrades = 'Нет доступных улучшений.';
LOCALE.ru.chest_evo_title = 'ЭВОЛЮЦИЯ!';
LOCALE.ru.chest_evo_choose = '— выберите эволюцию';
LOCALE.ru.chest_evo_accept = 'Принять';
LOCALE.ru.chest_evo_decline = 'Отказаться';
LOCALE.ru.chest_super_evo_title = '⭐ СУПЕР-ЭВОЛЮЦИЯ! ⭐';
LOCALE.ru.chest_mimic = 'МИМИК!';

LOCALE.en.chest_title = 'CHEST';
LOCALE.en.chest_rolling = 'Rolling d20…';
LOCALE.en.chest_reward_title = 'Reward';
LOCALE.en.chest_roll_label = 'Roll:';
LOCALE.en.chest_accept = 'Claim';
LOCALE.en.chest_upgrade_title = 'UPGRADE';
LOCALE.en.chest_pick_sub = '— choose a card';
LOCALE.en.chest_no_upgrades = 'No upgrades available.';
LOCALE.en.chest_evo_title = 'EVOLUTION!';
LOCALE.en.chest_evo_choose = '— choose an evolution';
LOCALE.en.chest_evo_accept = 'Accept';
LOCALE.en.chest_evo_decline = 'Decline';
LOCALE.en.chest_super_evo_title = '⭐ SUPER EVOLUTION! ⭐';
LOCALE.en.chest_mimic = 'MIMIC!';

/* ============================================================
   ЛАГЕРЬ
   ============================================================ */
LOCALE.ru.camp_title = 'DUNGEON SURVIVORS: D20';
LOCALE.ru.camp_tavern = 'Таверна «Последний бросок»';
LOCALE.ru.camp_start = '⚔ В ПОДЗЕМЕЛЬЕ';
LOCALE.ru.camp_campaign = '📜 СЮЖЕТ';
LOCALE.ru.camp_campaign_plus = '📜 НОВАЯ ИГРА+';
LOCALE.ru.camp_campaign_map = '📜 СЮЖЕТ (карта {0}/5)';
LOCALE.ru.camp_hero = '🛡 Выбор героя';
LOCALE.ru.camp_talents = '🌟 Таланты';
LOCALE.ru.camp_guild = '🛡 Гильдия';
LOCALE.ru.camp_bestiary = '📕 Бестиарий';
LOCALE.ru.camp_codex = '📖 Книга';
LOCALE.ru.camp_settings = '⚙ Настройки';
LOCALE.ru.camp_runs = 'Забегов: {0}';
LOCALE.ru.camp_total_kills = 'Убийств: {0}';
LOCALE.ru.camp_best_time = 'Лучшее: {0}';

LOCALE.en.camp_title = 'DUNGEON SURVIVORS: D20';
LOCALE.en.camp_tavern = 'The Last Roll Tavern';
LOCALE.en.camp_start = '⚔ TO THE DUNGEON';
LOCALE.en.camp_campaign = '📜 STORY';
LOCALE.en.camp_campaign_plus = '📜 NEW GAME+';
LOCALE.en.camp_campaign_map = '📜 STORY (map {0}/5)';
LOCALE.en.camp_hero = '🛡 Choose hero';
LOCALE.en.camp_talents = '🌟 Talents';
LOCALE.en.camp_guild = '🛡 Guild';
LOCALE.en.camp_bestiary = '📕 Bestiary';
LOCALE.en.camp_codex = '📖 Codex';
LOCALE.en.camp_settings = '⚙ Settings';
LOCALE.en.camp_runs = 'Runs: {0}';
LOCALE.en.camp_total_kills = 'Kills: {0}';
LOCALE.en.camp_best_time = 'Best: {0}';



/* ============================================================
   НАСТРОЙКИ
   ============================================================ */
LOCALE.ru.settings_title = '⚙ НАСТРОЙКИ';
LOCALE.ru.settings_music = 'Музыка';
LOCALE.ru.settings_sfx = 'Звуки';
LOCALE.ru.settings_lang = 'Язык';
LOCALE.ru.settings_back = '↩ Назад';
LOCALE.ru.settings_reset = 'Сбросить прогресс';
LOCALE.ru.settings_reset_confirm = 'Сбросить ВСЁ? Золото, таланты, бестиарий будут потеряны!';

LOCALE.en.settings_title = '⚙ SETTINGS';
LOCALE.en.settings_music = 'Music';
LOCALE.en.settings_sfx = 'Sounds';
LOCALE.en.settings_lang = 'Language';
LOCALE.en.settings_back = '↩ Back';
LOCALE.en.settings_reset = 'Reset progress';
LOCALE.en.settings_reset_confirm = 'Reset EVERYTHING? Gold, talents, bestiary will be lost!';

/* ============================================================
   ВЫБОР КАРТЫ
   ============================================================ */
LOCALE.ru.map_select_title = 'ВЫБЕРИТЕ КАРТУ';
LOCALE.ru.map_random = '🎲 Случайная карта';
LOCALE.ru.map_back = '↩ Назад';

LOCALE.en.map_select_title = 'SELECT MAP';
LOCALE.en.map_random = '🎲 Random map';
LOCALE.en.map_back = '↩ Back';

/* Биомы */
LOCALE.ru.biome_crypt = 'Проклятый склеп';
LOCALE.ru.biome_ice_caves = 'Ледяные пещеры';
LOCALE.ru.biome_fire_mines = 'Огненные шахты';
LOCALE.ru.biome_forest_ruins = 'Заросшие руины';
LOCALE.ru.biome_castle = 'Мрачный замок';
LOCALE.ru.biome_sky_citadel = 'Небесная цитадель';
LOCALE.ru.biome_elven_forest = 'Эльфийский лес';
LOCALE.ru.biome_mountain_keep = 'Горная крепость';
LOCALE.ru.biome_desc_crypt = 'Тёмные коридоры, полные нежити.';
LOCALE.ru.biome_desc_ice_caves = 'Замёрзшие пещеры, где спят древние твари.';
LOCALE.ru.biome_desc_fire_mines = 'Огненные шахты, пылающие лавой.';
LOCALE.ru.biome_desc_forest_ruins = 'Заросшие руины, пропитанные магией.';
LOCALE.ru.biome_desc_castle = 'Мрачный замок с жуткими обитателями.';
LOCALE.ru.biome_desc_sky_citadel = 'Небесный город за облаками.';
LOCALE.ru.biome_desc_elven_forest = 'Древний лес, хранимый рунами.';
LOCALE.ru.biome_desc_mountain_keep = 'Суровые горные крепости и шахты.';

LOCALE.en.biome_crypt = 'Cursed Crypt';
LOCALE.en.biome_ice_caves = 'Ice Caves';
LOCALE.en.biome_fire_mines = 'Fire Mines';
LOCALE.en.biome_forest_ruins = 'Forest Ruins';
LOCALE.en.biome_castle = 'Dark Castle';
LOCALE.en.biome_sky_citadel = 'Sky Citadel';
LOCALE.en.biome_elven_forest = 'Elven Forest';
LOCALE.en.biome_mountain_keep = 'Mountain Keep';
LOCALE.en.biome_desc_crypt = 'Dark corridors full of undead.';
LOCALE.en.biome_desc_ice_caves = 'Frozen caves where ancient creatures sleep.';
LOCALE.en.biome_desc_fire_mines = 'Fiery mines blazing with lava.';
LOCALE.en.biome_desc_forest_ruins = 'Overgrown ruins infused with magic.';
LOCALE.en.biome_desc_castle = 'A grim castle with dreadful inhabitants.';
LOCALE.en.biome_desc_sky_citadel = 'A sky city above the clouds.';
LOCALE.en.biome_desc_elven_forest = 'Ancient forest guarded by runes.';
LOCALE.en.biome_desc_mountain_keep = 'Harsh mountain fortresses and mines.';



/* ============================================================
   КЛАССЫ
   ============================================================ */
LOCALE.ru.class_select_title = 'ВЫБОР ГЕРОЯ';
LOCALE.ru.class_warrior = 'Воин';
LOCALE.ru.class_warrior_desc = 'Сбалансированный боец ближнего боя.';
LOCALE.ru.class_warrior_passive = '+10% к физическому урону';
LOCALE.ru.class_mage = 'Волшебник';
LOCALE.ru.class_mage_desc = 'Маг дальнего боя.';
LOCALE.ru.class_mage_passive = '+10% к магическому урону, -5% кулдауна заклинаний';
LOCALE.ru.class_rogue = 'Плут';
LOCALE.ru.class_rogue_desc = 'Быстрый и скользкий.';
LOCALE.ru.class_rogue_passive = '+8% к скорости, +5% шанс крита';
LOCALE.ru.class_tank = 'Танк';
LOCALE.ru.class_tank_desc = 'Живучий и мощный.';
LOCALE.ru.class_tank_passive = '+20% к макс. HP, -5% получаемого урона';

LOCALE.en.class_select_title = 'CHOOSE HERO';
LOCALE.en.class_warrior = 'Warrior';
LOCALE.en.class_warrior_desc = 'Balanced melee fighter.';
LOCALE.en.class_warrior_passive = '+10% physical damage';
LOCALE.en.class_mage = 'Mage';
LOCALE.en.class_mage_desc = 'Ranged magic caster.';
LOCALE.en.class_mage_passive = '+10% magic damage, -5% spell cooldown';
LOCALE.en.class_rogue = 'Rogue';
LOCALE.en.class_rogue_desc = 'Fast and slippery.';
LOCALE.en.class_rogue_passive = '+8% speed, +5% crit chance';
LOCALE.en.class_tank = 'Tank';
LOCALE.en.class_tank_desc = 'Tough and powerful.';
LOCALE.en.class_tank_passive = '+20% max HP, -5% damage taken';

/* ============================================================
   ОРУЖИЕ (названия и описания)
   ============================================================ */
LOCALE.ru.weapon_sword = 'Меч';
LOCALE.ru.weapon_sword_desc = 'Удар по ближайшему врагу в радиусе 60 px.';
LOCALE.ru.weapon_bow = 'Лук';
LOCALE.ru.weapon_bow_desc = 'Стреляет в ближайшего врага.';
LOCALE.ru.weapon_daggers = 'Кинжалы';
LOCALE.ru.weapon_daggers_desc = 'Бросок 3 кинжалов веером.';
LOCALE.ru.weapon_fireball = 'Огненный шар';
LOCALE.ru.weapon_fireball_desc = 'Снаряд с AoE-взрывом 80 px.';
LOCALE.ru.weapon_axe = 'Секира';
LOCALE.ru.weapon_axe_desc = 'Широкий взмах перед героем (конус 140°).';
LOCALE.ru.weapon_spear = 'Копьё';
LOCALE.ru.weapon_spear_desc = 'Удар вперёд по прямой (100 px).';
LOCALE.ru.weapon_hammer = 'Молот';
LOCALE.ru.weapon_hammer_desc = 'Удар по земле, AoE вокруг героя.';
LOCALE.ru.weapon_whip = 'Хлыст';
LOCALE.ru.weapon_whip_desc = 'Длинный удар перед героем (120 px).';
LOCALE.ru.weapon_crossbow = 'Арбалет';
LOCALE.ru.weapon_crossbow_desc = 'Пробивающий болт (прошивает врагов).';
LOCALE.ru.weapon_throwing_axes = 'Метательные топоры';
LOCALE.ru.weapon_throwing_axes_desc = 'Два вращающихся топора.';


LOCALE.ru.weapon_darts = 'Дротики';
LOCALE.ru.weapon_darts_desc = 'Очередь из 3 быстрых дротиков.';
LOCALE.ru.weapon_sling = 'Праща';
LOCALE.ru.weapon_sling_desc = 'Камень с AoE при приземлении.';
LOCALE.ru.weapon_ice_arrow = 'Ледяная стрела';
LOCALE.ru.weapon_ice_arrow_desc = 'Замедляющий снаряд.';
LOCALE.ru.weapon_chain_lightning = 'Цепная молния';
LOCALE.ru.weapon_chain_lightning_desc = 'Прыгает между 3 врагами.';
LOCALE.ru.weapon_poison_cloud = 'Ядовитое облако';
LOCALE.ru.weapon_poison_cloud_desc = 'Облако яда (DoT в радиусе).';
LOCALE.ru.weapon_spellbook = 'Книга заклинаний';
LOCALE.ru.weapon_spellbook_desc = '3 самонаводящихся снаряда.';
LOCALE.ru.weapon_firestorm = 'Огненный шторм';
LOCALE.ru.weapon_firestorm_desc = '3 огненных столба вокруг героя.';
LOCALE.ru.weapon_holy_aura = 'Святая аура';
LOCALE.ru.weapon_holy_aura_desc = 'Аура, наносящая урон нежити.';
LOCALE.ru.weapon_spike_ring = 'Шипы';
LOCALE.ru.weapon_spike_ring_desc = '4 вращающихся шипа вокруг героя.';
LOCALE.ru.weapon_earthquake = 'Землетрясение';
LOCALE.ru.weapon_earthquake_desc = 'Волна урона по земле (AoE 120px).';

LOCALE.en.weapon_sword = 'Sword';
LOCALE.en.weapon_sword_desc = 'Strikes nearest enemy within 60 px.';
LOCALE.en.weapon_bow = 'Bow';
LOCALE.en.weapon_bow_desc = 'Shoots the nearest enemy.';
LOCALE.en.weapon_daggers = 'Daggers';
LOCALE.en.weapon_daggers_desc = 'Throws 3 daggers in a fan.';
LOCALE.en.weapon_fireball = 'Fireball';
LOCALE.en.weapon_fireball_desc = 'Projectile with AoE explosion 80 px.';
LOCALE.en.weapon_axe = 'Axe';
LOCALE.en.weapon_axe_desc = 'Wide swing in front (140° cone).';
LOCALE.en.weapon_spear = 'Spear';
LOCALE.en.weapon_spear_desc = 'Thrust forward in a line (100 px).';
LOCALE.en.weapon_hammer = 'Hammer';
LOCALE.en.weapon_hammer_desc = 'Ground slam, AoE around hero.';
LOCALE.en.weapon_whip = 'Whip';
LOCALE.en.weapon_whip_desc = 'Long strike in front (120 px).';
LOCALE.en.weapon_crossbow = 'Crossbow';
LOCALE.en.weapon_crossbow_desc = 'Piercing bolt (passes through enemies).';
LOCALE.en.weapon_throwing_axes = 'Throwing Axes';
LOCALE.en.weapon_throwing_axes_desc = 'Two spinning axes.';
LOCALE.en.weapon_darts = 'Darts';
LOCALE.en.weapon_darts_desc = 'Burst of 3 fast darts.';
LOCALE.en.weapon_sling = 'Sling';
LOCALE.en.weapon_sling_desc = 'Stone with AoE on landing.';
LOCALE.en.weapon_ice_arrow = 'Ice Arrow';
LOCALE.en.weapon_ice_arrow_desc = 'Slowing projectile.';
LOCALE.en.weapon_chain_lightning = 'Chain Lightning';
LOCALE.en.weapon_chain_lightning_desc = 'Jumps between 3 enemies.';
LOCALE.en.weapon_poison_cloud = 'Poison Cloud';
LOCALE.en.weapon_poison_cloud_desc = 'Poison cloud (DoT in area).';
LOCALE.en.weapon_spellbook = 'Spellbook';
LOCALE.en.weapon_spellbook_desc = '3 homing projectiles.';
LOCALE.en.weapon_firestorm = 'Firestorm';
LOCALE.en.weapon_firestorm_desc = '3 fire pillars around hero.';
LOCALE.en.weapon_holy_aura = 'Holy Aura';
LOCALE.en.weapon_holy_aura_desc = 'Aura dealing damage to undead.';
LOCALE.en.weapon_spike_ring = 'Spike Ring';
LOCALE.en.weapon_spike_ring_desc = '4 spinning spikes around hero.';
LOCALE.en.weapon_earthquake = 'Earthquake';
LOCALE.en.weapon_earthquake_desc = 'Ground damage wave (AoE 120px).';



/* ============================================================
   СПОСОБНОСТИ (пассивки)
   ============================================================ */
LOCALE.ru.ability_haste = 'Ускорение';
LOCALE.ru.ability_haste_desc = '+8% к скорости передвижения за уровень.';
LOCALE.ru.ability_regen = 'Регенерация';
LOCALE.ru.ability_regen_desc = '+1 HP каждые 3 сек за уровень.';
LOCALE.ru.ability_power = 'Усиление урона';
LOCALE.ru.ability_power_desc = '+10% ко всему урону за уровень.';
LOCALE.ru.ability_magnet = 'Магнит опыта';
LOCALE.ru.ability_magnet_desc = '+30% к радиусу подбора кристаллов за уровень.';
LOCALE.ru.ability_armor = 'Броня';
LOCALE.ru.ability_armor_desc = 'Снижение получаемого урона на 5% за уровень.';
LOCALE.ru.ability_mana_shield = 'Щит маны';
LOCALE.ru.ability_mana_shield_desc = 'Блокирует следующий удар (кулдаун уменьшается с уровнем).';
LOCALE.ru.ability_fortify = 'Укрепление';
LOCALE.ru.ability_fortify_desc = '+8% к максимальному HP за уровень.';
LOCALE.ru.ability_resistance = 'Сопротивление';
LOCALE.ru.ability_resistance_desc = '-15% длительности дебаффов за уровень.';
LOCALE.ru.ability_bloodlust = 'Жажда крови';
LOCALE.ru.ability_bloodlust_desc = '+2% вампиризма (лечение от урона) за уровень.';
LOCALE.ru.ability_crit_strike = 'Критический удар';
LOCALE.ru.ability_crit_strike_desc = '+4% шанс крита (×2 урон) за уровень.';
LOCALE.ru.ability_bleed = 'Кровотечение';
LOCALE.ru.ability_bleed_desc = '10% шанс за уровень наложить кровотечение.';
LOCALE.ru.ability_explosive_death = 'Взрывная смерть';
LOCALE.ru.ability_explosive_death_desc = '10% шанс за уровень: взрыв при убийстве.';
LOCALE.ru.ability_quick_fingers = 'Быстрые пальцы';
LOCALE.ru.ability_quick_fingers_desc = '-4% кулдауна всех оружий за уровень.';
LOCALE.ru.ability_frost_aura = 'Аура холода';
LOCALE.ru.ability_frost_aura_desc = 'Замедляет ближайших врагов на 8% за уровень.';
LOCALE.ru.ability_magic_boost = 'Усиление магии';
LOCALE.ru.ability_magic_boost_desc = '+10% к магическому урону за уровень.';
LOCALE.ru.ability_magic_echo = 'Магический отклик';
LOCALE.ru.ability_magic_echo_desc = '15% шанс: ответный снаряд при получении урона.';
LOCALE.ru.ability_lucky = 'Счастливчик';
LOCALE.ru.ability_lucky_desc = '+1 к мин. результату d20 за уровень.';
LOCALE.ru.ability_double_xp = 'Удвоение опыта';
LOCALE.ru.ability_double_xp_desc = '6% шанс за уровень получить ×2 опыт.';
LOCALE.ru.ability_alchemist = 'Алхимик';
LOCALE.ru.ability_alchemist_desc = '+12% к урону ядов и огня (DoT) за уровень.';
LOCALE.ru.ability_magnet_plus = 'Магнит предметов';
LOCALE.ru.ability_magnet_plus_desc = '+20% к радиусу подбора за уровень.';



LOCALE.en.ability_haste = 'Haste';
LOCALE.en.ability_haste_desc = '+8% movement speed per level.';
LOCALE.en.ability_regen = 'Regeneration';
LOCALE.en.ability_regen_desc = '+1 HP every 3 sec per level.';
LOCALE.en.ability_power = 'Power Surge';
LOCALE.en.ability_power_desc = '+10% all damage per level.';
LOCALE.en.ability_magnet = 'XP Magnet';
LOCALE.en.ability_magnet_desc = '+30% pickup radius per level.';
LOCALE.en.ability_armor = 'Armor';
LOCALE.en.ability_armor_desc = '-5% damage taken per level.';
LOCALE.en.ability_mana_shield = 'Mana Shield';
LOCALE.en.ability_mana_shield_desc = 'Blocks next hit (cooldown decreases with level).';
LOCALE.en.ability_fortify = 'Fortify';
LOCALE.en.ability_fortify_desc = '+8% max HP per level.';
LOCALE.en.ability_resistance = 'Resistance';
LOCALE.en.ability_resistance_desc = '-15% debuff duration per level.';
LOCALE.en.ability_bloodlust = 'Bloodlust';
LOCALE.en.ability_bloodlust_desc = '+2% lifesteal per level.';
LOCALE.en.ability_crit_strike = 'Critical Strike';
LOCALE.en.ability_crit_strike_desc = '+4% crit chance (×2 damage) per level.';
LOCALE.en.ability_bleed = 'Bleed';
LOCALE.en.ability_bleed_desc = '10% chance per level to apply bleed.';
LOCALE.en.ability_explosive_death = 'Explosive Death';
LOCALE.en.ability_explosive_death_desc = '10% chance per level: explosion on kill.';
LOCALE.en.ability_quick_fingers = 'Quick Fingers';
LOCALE.en.ability_quick_fingers_desc = '-4% all weapon cooldowns per level.';
LOCALE.en.ability_frost_aura = 'Frost Aura';
LOCALE.en.ability_frost_aura_desc = 'Slows nearby enemies by 8% per level.';
LOCALE.en.ability_magic_boost = 'Magic Boost';
LOCALE.en.ability_magic_boost_desc = '+10% magic damage per level.';
LOCALE.en.ability_magic_echo = 'Magic Echo';
LOCALE.en.ability_magic_echo_desc = '15% chance: retaliatory bolt on damage taken.';
LOCALE.en.ability_lucky = 'Lucky';
LOCALE.en.ability_lucky_desc = '+1 to min d20 roll per level.';
LOCALE.en.ability_double_xp = 'Double XP';
LOCALE.en.ability_double_xp_desc = '6% chance per level to get ×2 XP.';
LOCALE.en.ability_alchemist = 'Alchemist';
LOCALE.en.ability_alchemist_desc = '+12% poison & fire DoT damage per level.';
LOCALE.en.ability_magnet_plus = 'Item Magnet';
LOCALE.en.ability_magnet_plus_desc = '+20% pickup radius per level.';



/* ============================================================
   ЭВОЛЮЦИИ
   ============================================================ */
LOCALE.ru.evo_vampire_blade = 'Вампирский клинок';
LOCALE.ru.evo_vampire_blade_desc = 'Ближний бой, урон 25, +3 HP за каждое попадание.';
LOCALE.ru.evo_rapid_bow = 'Скорострельный лук';
LOCALE.ru.evo_rapid_bow_desc = 'Очередь из 3 стрел, урон 15 каждая.';
LOCALE.ru.evo_blade_storm = 'Шквал клинков';
LOCALE.ru.evo_blade_storm_desc = '5 кинжалов веером, урон 12, шанс крита 20% (×2).';
LOCALE.ru.evo_soul_flame = 'Пламя души';
LOCALE.ru.evo_soul_flame_desc = 'Взрыв (урон 30) притягивает весь опыт на карте.';
LOCALE.ru.evo_bloodletter = 'Кровопускатель';
LOCALE.ru.evo_bloodletter_desc = 'Конус 180°, вампиризм 5 HP/удар.';
LOCALE.ru.evo_piercer = 'Пронзатель';
LOCALE.ru.evo_piercer_desc = 'Линия 150px, 30% крит, пробивает врагов.';
LOCALE.ru.evo_titan_hammer = 'Молот титана';
LOCALE.ru.evo_titan_hammer_desc = 'AoE 90px, +10% макс HP за каждые 5 убийств (10 сек).';
LOCALE.ru.evo_pain_lash = 'Бич боли';
LOCALE.ru.evo_pain_lash_desc = 'Дальность 150px, +25% урона по врагам с полным HP.';
LOCALE.ru.evo_executioner = 'Казнь';
LOCALE.ru.evo_executioner_desc = 'Пробивающий, гарантированное кровотечение 8 dmg/s.';
LOCALE.ru.evo_butcher_axes = 'Топоры мясника';
LOCALE.ru.evo_butcher_axes_desc = '3 топора, 25% крит, крит урон ×3.';
LOCALE.ru.evo_needle_storm = 'Игольчатый шторм';
LOCALE.ru.evo_needle_storm_desc = '5 дротиков в очереди, кулдаун 0.4 сек.';
LOCALE.ru.evo_meteor_strike = 'Метеоритный удар';
LOCALE.ru.evo_meteor_strike_desc = 'Камень падает с неба, AoE 60px, урон 22.';
LOCALE.ru.evo_ice_storm = 'Ледяной шторм';
LOCALE.ru.evo_ice_storm_desc = 'Снаряд оставляет полосу холода 100px, замедление 60%.';
LOCALE.ru.evo_thunder_chain = 'Грозовая цепь';
LOCALE.ru.evo_thunder_chain_desc = '5 прыжков, урон не спадает.';
LOCALE.ru.evo_plague_cloud = 'Чумное облако';
LOCALE.ru.evo_plague_cloud_desc = 'Радиус 80px, 5 сек, 12 урон/сек, заражает соседних.';
LOCALE.ru.evo_mad_grimoire = 'Безумный гримуар';
LOCALE.ru.evo_mad_grimoire_desc = '4 снаряда, +20% шанс при получении урона создать ещё 2.';
LOCALE.ru.evo_inferno = 'Инферно';
LOCALE.ru.evo_inferno_desc = '5 столбов, урон 25, поджигают землю.';
LOCALE.ru.evo_martyr_aura = 'Аура мученика';
LOCALE.ru.evo_martyr_aura_desc = 'Радиус 70px, урон нежити 18/сек, лечит 50% от урона.';
LOCALE.ru.evo_spike_bastion = 'Шипастый бастион';
LOCALE.ru.evo_spike_bastion_desc = '6 шипов, +5% DR, отражают 20% урона атакующему.';
LOCALE.ru.evo_tectonic_rift = 'Тектонический разлом';
LOCALE.ru.evo_tectonic_rift_desc = 'Радиус 180px, трещины на земле (20 урон/сек, 3 сек).';
LOCALE.ru.evo_hero_blade = 'Клинок героя';
LOCALE.ru.evo_hero_blade_desc = 'Ближний бой, урон 30, +15% ко всему урону.';
LOCALE.ru.evo_pyroclasm = 'Пироклазм';
LOCALE.ru.evo_pyroclasm_desc = 'Взрыв 100px, урон 35, оставляет горящую землю 4 сек.';
LOCALE.ru.evo_ice_spike = 'Ледяной шип';
LOCALE.ru.evo_ice_spike_desc = 'При убийстве врага выпускает 3 ледяных осколка.';
LOCALE.ru.evo_electric_cascade = 'Электр. каскад';
LOCALE.ru.evo_electric_cascade_desc = 'Прыгает мгновенно, кулдаун 0.8 сек.';
LOCALE.ru.evo_miasma = 'Миазмы';
LOCALE.ru.evo_miasma_desc = 'Облако замедляет 30% и снижает броню врагов на 20%.';



/* Супер-эволюции */
LOCALE.ru.evo_eternal_night_blade = 'Клинок Вечной Ночи';
LOCALE.ru.evo_eternal_night_blade_desc = 'Урон 45, вампиризм 8 HP/удар, призывает 2 скелетов-рыцарей.';
LOCALE.ru.evo_apocalypse_bow = 'Лук Апокалипсиса';
LOCALE.ru.evo_apocalypse_bow_desc = 'Очередь 5 огненных стрел, взрыв 60px, горящая земля.';
LOCALE.ru.evo_eternity_staff = 'Посох Вечности';
LOCALE.ru.evo_eternity_staff_desc = '5 снарядов, +25% маг. урона, 3 снаряда при получении урона.';
LOCALE.ru.evo_devourer_claws = 'Когти Пожирателя';
LOCALE.ru.evo_devourer_claws_desc = 'Удары 0.3с, урон 18, 25% крит, вампиризм 10 HP, кровотечение 15 dps.';
LOCALE.ru.evo_bastion_of_light = 'Бастион Света';
LOCALE.ru.evo_bastion_of_light_desc = 'Радиус 90px, урон нежити 30/сек, DR 20%, лечение 5 HP/сек.';

LOCALE.en.evo_vampire_blade = 'Vampire Blade';
LOCALE.en.evo_vampire_blade_desc = 'Melee, 25 dmg, +3 HP per hit.';
LOCALE.en.evo_rapid_bow = 'Rapid Bow';
LOCALE.en.evo_rapid_bow_desc = 'Burst of 3 arrows, 15 dmg each.';
LOCALE.en.evo_blade_storm = 'Blade Storm';
LOCALE.en.evo_blade_storm_desc = '5 daggers in fan, 12 dmg, 20% crit (×2).';
LOCALE.en.evo_soul_flame = 'Soul Flame';
LOCALE.en.evo_soul_flame_desc = 'Explosion (30 dmg) attracts all XP on map.';
LOCALE.en.evo_bloodletter = 'Bloodletter';
LOCALE.en.evo_bloodletter_desc = '180° cone, 5 HP lifesteal per hit.';
LOCALE.en.evo_piercer = 'Piercer';
LOCALE.en.evo_piercer_desc = '150px line, 30% crit, pierces enemies.';
LOCALE.en.evo_titan_hammer = 'Titan Hammer';
LOCALE.en.evo_titan_hammer_desc = 'AoE 90px, +10% max HP per 5 kills (10s).';
LOCALE.en.evo_pain_lash = 'Pain Lash';
LOCALE.en.evo_pain_lash_desc = '150px range, +25% dmg vs full HP enemies.';
LOCALE.en.evo_executioner = 'Executioner';
LOCALE.en.evo_executioner_desc = 'Piercing, guaranteed bleed 8 dps.';
LOCALE.en.evo_butcher_axes = 'Butcher Axes';
LOCALE.en.evo_butcher_axes_desc = '3 axes, 25% crit, crit dmg ×3.';
LOCALE.en.evo_needle_storm = 'Needle Storm';
LOCALE.en.evo_needle_storm_desc = '5 darts in burst, 0.4s cooldown.';
LOCALE.en.evo_meteor_strike = 'Meteor Strike';
LOCALE.en.evo_meteor_strike_desc = 'Stone from sky, AoE 60px, 22 dmg.';
LOCALE.en.evo_ice_storm = 'Ice Storm';
LOCALE.en.evo_ice_storm_desc = 'Leaves 100px cold trail, 60% slow.';
LOCALE.en.evo_thunder_chain = 'Thunder Chain';
LOCALE.en.evo_thunder_chain_desc = '5 jumps, no damage decay.';
LOCALE.en.evo_plague_cloud = 'Plague Cloud';
LOCALE.en.evo_plague_cloud_desc = '80px radius, 5s, 12 dps, spreads.';
LOCALE.en.evo_mad_grimoire = 'Mad Grimoire';
LOCALE.en.evo_mad_grimoire_desc = '4 bolts, 20% chance to spawn 2 more on hit.';
LOCALE.en.evo_inferno = 'Inferno';
LOCALE.en.evo_inferno_desc = '5 pillars, 25 dmg, ignites ground.';
LOCALE.en.evo_martyr_aura = 'Martyr Aura';
LOCALE.en.evo_martyr_aura_desc = '70px radius, 18 dps to undead, heals 50%.';
LOCALE.en.evo_spike_bastion = 'Spike Bastion';
LOCALE.en.evo_spike_bastion_desc = '6 spikes, +5% DR, reflects 20% damage.';
LOCALE.en.evo_tectonic_rift = 'Tectonic Rift';
LOCALE.en.evo_tectonic_rift_desc = '180px radius, ground cracks (20 dps, 3s).';
LOCALE.en.evo_hero_blade = 'Hero Blade';
LOCALE.en.evo_hero_blade_desc = 'Melee, 30 dmg, +15% all damage.';
LOCALE.en.evo_pyroclasm = 'Pyroclasm';
LOCALE.en.evo_pyroclasm_desc = '100px explosion, 35 dmg, burning ground 4s.';
LOCALE.en.evo_ice_spike = 'Ice Spike';
LOCALE.en.evo_ice_spike_desc = 'On kill: shoots 3 ice shards.';
LOCALE.en.evo_electric_cascade = 'Electric Cascade';
LOCALE.en.evo_electric_cascade_desc = 'Instant jump, 0.8s cooldown.';
LOCALE.en.evo_miasma = 'Miasma';
LOCALE.en.evo_miasma_desc = 'Cloud slows 30% and reduces enemy armor 20%.';
LOCALE.en.evo_eternal_night_blade = 'Eternal Night Blade';
LOCALE.en.evo_eternal_night_blade_desc = '45 dmg, 8 HP lifesteal, summons 2 skeleton knights.';
LOCALE.en.evo_apocalypse_bow = 'Apocalypse Bow';
LOCALE.en.evo_apocalypse_bow_desc = '5 fire arrows, 60px explosion, burning ground.';
LOCALE.en.evo_eternity_staff = 'Eternity Staff';
LOCALE.en.evo_eternity_staff_desc = '5 bolts, +25% magic dmg, 3 bolts on damage taken.';
LOCALE.en.evo_devourer_claws = 'Devourer Claws';
LOCALE.en.evo_devourer_claws_desc = '0.3s attacks, 18 dmg, 25% crit, 10 HP lifesteal, 15 bleed dps.';
LOCALE.en.evo_bastion_of_light = 'Bastion of Light';
LOCALE.en.evo_bastion_of_light_desc = '90px radius, 30 dps to undead, 20% DR, 5 HP/s heal.';



/* ============================================================
   БАЗОВЫЕ УЛУЧШЕНИЯ (Level Up)
   ============================================================ */
LOCALE.ru.upgrade_maxhp = 'Здоровье +20';
LOCALE.ru.upgrade_maxhp_desc = 'Макс. HP +20 (восполняется на ту же величину).';
LOCALE.ru.upgrade_damage = 'Урон +15%';
LOCALE.ru.upgrade_damage_desc = 'Весь урон увеличен на 15%.';
LOCALE.ru.upgrade_speed = 'Скорость +10%';
LOCALE.ru.upgrade_speed_desc = 'Скорость передвижения +10%.';
LOCALE.ru.upgrade_weapon_cd = 'Скорострельность';
LOCALE.ru.upgrade_weapon_cd_desc = 'Кулдаун всех оружий -10%.';
LOCALE.ru.upgrade_missile_cd = 'Магия чаще';
LOCALE.ru.upgrade_missile_cd_desc = 'Кулдаун магического снаряда -25%.';
LOCALE.ru.upgrade_pickup = 'Радиус подбора +30%';
LOCALE.ru.upgrade_pickup_desc = 'Радиус притяжения опыта +30%.';
LOCALE.ru.upgrade_multishot = '+1 снаряд';
LOCALE.ru.upgrade_multishot_desc = 'Magic Missile выпускает +1 снаряд.';
LOCALE.ru.upgrade_heal = 'Восстановление 30%';
LOCALE.ru.upgrade_heal_desc = 'Мгновенно восстанавливает 30% макс. HP.';

LOCALE.en.upgrade_maxhp = 'Health +20';
LOCALE.en.upgrade_maxhp_desc = 'Max HP +20 (heals for the same amount).';
LOCALE.en.upgrade_damage = 'Damage +15%';
LOCALE.en.upgrade_damage_desc = 'All damage increased by 15%.';
LOCALE.en.upgrade_speed = 'Speed +10%';
LOCALE.en.upgrade_speed_desc = 'Movement speed +10%.';
LOCALE.en.upgrade_weapon_cd = 'Fire Rate';
LOCALE.en.upgrade_weapon_cd_desc = 'All weapon cooldowns -10%.';
LOCALE.en.upgrade_missile_cd = 'Faster Magic';
LOCALE.en.upgrade_missile_cd_desc = 'Magic missile cooldown -25%.';
LOCALE.en.upgrade_pickup = 'Pickup Radius +30%';
LOCALE.en.upgrade_pickup_desc = 'XP attraction radius +30%.';
LOCALE.en.upgrade_multishot = '+1 Projectile';
LOCALE.en.upgrade_multishot_desc = 'Magic Missile fires +1 projectile.';
LOCALE.en.upgrade_heal = 'Heal 30%';
LOCALE.en.upgrade_heal_desc = 'Instantly restores 30% max HP.';

/* ============================================================
   КАМПАНИЯ
   ============================================================ */
LOCALE.ru.campaign_map1 = 'Проклятый склеп';
LOCALE.ru.campaign_map2 = 'Ледяной перевал';
LOCALE.ru.campaign_map3 = 'Огненные недра';
LOCALE.ru.campaign_map4 = 'Заросший храм';
LOCALE.ru.campaign_map5 = 'Цитадель тьмы';
LOCALE.ru.campaign_obj_activate = 'Активировать рунные алтари';
LOCALE.ru.campaign_obj_survive = 'Продержаться';
LOCALE.ru.campaign_obj_kill_boss = 'Убить Магма-гиганта';
LOCALE.ru.campaign_obj_rescue = 'Спасти пленённого мага';
LOCALE.ru.campaign_obj_kill_dragon = 'Победить Древнего дракона';
LOCALE.ru.campaign_objective_done = 'ЦЕЛЬ ВЫПОЛНЕНА!';
LOCALE.ru.campaign_key_obtained = 'КЛЮЧ ПОЛУЧЕН!';
LOCALE.ru.campaign_fire_heart = 'ОГНЕННОЕ СЕРДЦЕ!';
LOCALE.ru.campaign_portal_open = 'ПОРТАЛ ОТКРЫТ!';
LOCALE.ru.campaign_resurrect = 'ВОЗРОЖДЕНИЕ!';



LOCALE.en.campaign_map1 = 'Cursed Crypt';
LOCALE.en.campaign_map2 = 'Ice Pass';
LOCALE.en.campaign_map3 = 'Fire Depths';
LOCALE.en.campaign_map4 = 'Overgrown Temple';
LOCALE.en.campaign_map5 = 'Citadel of Darkness';
LOCALE.en.campaign_obj_activate = 'Activate rune altars';
LOCALE.en.campaign_obj_survive = 'Survive';
LOCALE.en.campaign_obj_kill_boss = 'Kill the Magma Giant';
LOCALE.en.campaign_obj_rescue = 'Rescue the imprisoned mage';
LOCALE.en.campaign_obj_kill_dragon = 'Defeat the Ancient Dragon';
LOCALE.en.campaign_objective_done = 'OBJECTIVE COMPLETE!';
LOCALE.en.campaign_key_obtained = 'KEY OBTAINED!';
LOCALE.en.campaign_fire_heart = 'FIRE HEART!';
LOCALE.en.campaign_portal_open = 'PORTAL OPEN!';
LOCALE.en.campaign_resurrect = 'RESURRECTED!';

/* Диалоги кампании */
LOCALE.ru.campaign_dialogue_before1 = 'Древнее зло пробудилось в глубинах под королевством. Дракон, спавший тысячелетия, сеет хаос. Ты — рыцарь ордена, последняя надежда. Спустись в склеп, найди рунные алтари и открой путь в недра.';
LOCALE.ru.campaign_dialogue_after1 = 'Алтари активированы. Тьма расступается, открывая проход в ледяные пещеры. Будь осторожен — эти земли не видели солнца веками.';
LOCALE.ru.campaign_dialogue_after2 = 'Ледяной перевал пройден. Впереди — огненные недра, где кузнецы хаоса выковали сердце тьмы. Уничтожь стража и забери Огненное сердце — оно пригодится.';
LOCALE.ru.campaign_dialogue_after3 = 'Огненное сердце пульсирует в твоей руке. Ты чувствуешь, как сила стихий наполняет тебя. Но впереди — заросший храм, где томятся пленники дракона.';
LOCALE.ru.campaign_dialogue_mage = 'Спасибо, рыцарь! Я — маг ордена, дракон держал меня здесь, чтобы вытягивать мою силу. Возьми моё благословение — оно поможет в битве с чудовищем.';
LOCALE.ru.campaign_dialogue_after4 = 'Маг спасён. Его благословение усиливает твои заклинания. Теперь — в Цитадель тьмы. Дракон ждёт.';
LOCALE.ru.campaign_dialogue_boss = 'Древний дракон восседает на троне из костей героев. Он чувствует твоё приближение. Время последней битвы!';
LOCALE.ru.campaign_dialogue_victory = 'Дракон повержен! Королевство свободно. Твоё имя войдёт в легенды. Но тьма всегда находит путь... (награда: +1000 золота, +200 репутации)';

LOCALE.en.campaign_dialogue_before1 = 'Ancient evil has awakened in the depths beneath the kingdom. A dragon, asleep for millennia, sows chaos. You are a knight of the Order, the last hope. Descend into the crypt, find the rune altars and open the path to the depths.';
LOCALE.en.campaign_dialogue_after1 = 'Altars activated. The darkness parts, revealing a passage to the ice caves. Be careful — these lands have not seen sunlight for ages.';
LOCALE.en.campaign_dialogue_after2 = 'The ice pass is cleared. Ahead — the fire depths, where the smiths of chaos forged the heart of darkness. Destroy the guardian and take the Fire Heart — it will be useful.';
LOCALE.en.campaign_dialogue_after3 = 'The Fire Heart pulses in your hand. You feel the power of the elements filling you. But ahead — the overgrown temple, where the dragon\'s prisoners languish.';
LOCALE.en.campaign_dialogue_mage = 'Thank you, knight! I am a mage of the Order, the dragon kept me here to drain my power. Take my blessing — it will help in the battle against the beast.';
LOCALE.en.campaign_dialogue_after4 = 'The mage is saved. His blessing empowers your spells. Now — to the Citadel of Darkness. The dragon awaits.';
LOCALE.en.campaign_dialogue_boss = 'The Ancient Dragon sits upon a throne of heroes\' bones. It senses your approach. Time for the final battle!';
LOCALE.en.campaign_dialogue_victory = 'The dragon is slain! The kingdom is free. Your name shall enter legend. But darkness always finds a way... (reward: +1000 gold, +200 reputation)';



/* ============================================================
   БЕСТИАРИЙ
   ============================================================ */
LOCALE.ru.bestiary_title = '📕 БЕСТИАРИЙ';
LOCALE.ru.bestiary_unlocked = 'Открыто: {0} / {1}';
LOCALE.ru.bestiary_back = '↩ Назад';
LOCALE.ru.bestiary_select_enemy = 'Выберите врага для просмотра';
LOCALE.ru.bestiary_hp = '❤ HP:';
LOCALE.ru.bestiary_damage = '⚔ Урон:';
LOCALE.ru.bestiary_speed = '🏃 Скорость:';
LOCALE.ru.bestiary_xp = '✨ Опыт:';
LOCALE.ru.bestiary_abilities_title = '⚡ Особые способности';
LOCALE.ru.bestiary_unknown = '???';
LOCALE.ru.bestiary_unknown_creature = 'Таинственное существо из глубин подземелья.';
LOCALE.ru.bestiary_speed_immobile = 'Неподвижный';
LOCALE.ru.bestiary_speed_very_slow = 'Очень медленная';
LOCALE.ru.bestiary_speed_slow = 'Медленная';
LOCALE.ru.bestiary_speed_medium = 'Средняя';
LOCALE.ru.bestiary_speed_fast = 'Быстрая';
LOCALE.ru.bestiary_speed_very_fast = 'Очень быстрая';
LOCALE.ru.bestiary_tier_common = 'Обычный';
LOCALE.ru.bestiary_tier_uncommon = 'Необычный';
LOCALE.ru.bestiary_tier_dangerous = 'Опасный';
LOCALE.ru.bestiary_tier_serious = 'Серьёзный';
LOCALE.ru.bestiary_tier_rare = 'Редкий';
LOCALE.ru.bestiary_tier_legendary = 'Легендарный';
LOCALE.ru.bestiary_tier_special = 'Особый';
LOCALE.ru.bestiary_tier_unknown = 'Неизвестный';

LOCALE.en.bestiary_title = '📕 BESTIARY';
LOCALE.en.bestiary_unlocked = 'Discovered: {0} / {1}';
LOCALE.en.bestiary_back = '↩ Back';
LOCALE.en.bestiary_select_enemy = 'Select an enemy to view';
LOCALE.en.bestiary_hp = '❤ HP:';
LOCALE.en.bestiary_damage = '⚔ Damage:';
LOCALE.en.bestiary_speed = '🏃 Speed:';
LOCALE.en.bestiary_xp = '✨ XP:';
LOCALE.en.bestiary_abilities_title = '⚡ Special abilities';
LOCALE.en.bestiary_unknown = '???';
LOCALE.en.bestiary_unknown_creature = 'A mysterious creature from the dungeon depths.';
LOCALE.en.bestiary_speed_immobile = 'Immobile';
LOCALE.en.bestiary_speed_very_slow = 'Very slow';
LOCALE.en.bestiary_speed_slow = 'Slow';
LOCALE.en.bestiary_speed_medium = 'Medium';
LOCALE.en.bestiary_speed_fast = 'Fast';
LOCALE.en.bestiary_speed_very_fast = 'Very fast';
LOCALE.en.bestiary_tier_common = 'Common';
LOCALE.en.bestiary_tier_uncommon = 'Uncommon';
LOCALE.en.bestiary_tier_dangerous = 'Dangerous';
LOCALE.en.bestiary_tier_serious = 'Serious';
LOCALE.en.bestiary_tier_rare = 'Rare';
LOCALE.en.bestiary_tier_legendary = 'Legendary';
LOCALE.en.bestiary_tier_special = 'Special';
LOCALE.en.bestiary_tier_unknown = 'Unknown';



/* ============================================================
   КОДЕКС
   ============================================================ */
LOCALE.ru.codex_title = '📖 КНИГА';
LOCALE.ru.codex_tab_weapons = 'Оружие';
LOCALE.ru.codex_tab_abilities = 'Способности';
LOCALE.ru.codex_tab_evolutions = 'Эволюции';
LOCALE.ru.codex_back = '↩ Назад';

LOCALE.en.codex_title = '📖 CODEX';
LOCALE.en.codex_tab_weapons = 'Weapons';
LOCALE.en.codex_tab_abilities = 'Abilities';
LOCALE.en.codex_tab_evolutions = 'Evolutions';
LOCALE.en.codex_back = '↩ Back';

/* ============================================================
   ТАЛАНТЫ
   ============================================================ */
LOCALE.ru.talents_title = '⚜ ТАЛАНТЫ ⚜';
LOCALE.ru.talents_reset = 'Сбросить (80%)';
LOCALE.ru.talents_reset_confirm = 'Сбросить все таланты? 80% золота будет возвращено.';
LOCALE.ru.talents_back = '↩ Назад';
LOCALE.ru.talents_max = 'МАКС';

LOCALE.en.talents_title = '⚜ TALENTS ⚜';
LOCALE.en.talents_reset = 'Reset (80%)';
LOCALE.en.talents_reset_confirm = 'Reset all talents? 80% gold will be refunded.';
LOCALE.en.talents_back = '↩ Back';
LOCALE.en.talents_max = 'MAX';

/* ============================================================
   ГИЛЬДИЯ
   ============================================================ */
LOCALE.ru.guild_title = 'Гильдия искателей приключений';
LOCALE.ru.guild_tab_ranks = 'Ранги';
LOCALE.ru.guild_tab_stats = 'Статистика';
LOCALE.ru.guild_tab_quests = 'Задания';
LOCALE.ru.guild_back = '↩ Назад';
LOCALE.ru.guild_rank_novice = 'Новобранец';
LOCALE.ru.guild_rep = 'реп.';
LOCALE.ru.guild_max = '— МАКС';
LOCALE.ru.guild_daily_title = '📋 Ежедневные задания';
LOCALE.ru.guild_weekly_title = '📜 Еженедельные задания';
LOCALE.ru.guild_no_quests = 'Нет активных заданий';
LOCALE.ru.guild_quest_done = '✓ Выполнено';
LOCALE.ru.guild_quest_claim = 'Забрать (+{0} реп.)';
LOCALE.ru.guild_stat_total_kills = 'Всего убито врагов';
LOCALE.ru.guild_stat_total_bosses = 'Всего убито боссов';
LOCALE.ru.guild_stat_bestiary = 'Открыто врагов в бестиарии';
LOCALE.ru.guild_stat_runs = 'Всего забегов';
LOCALE.ru.guild_stat_best_time = 'Лучшее время';
LOCALE.ru.guild_stat_best_kills = 'Лучший результат (убийств)';
LOCALE.ru.guild_stat_reputation = 'Текущая репутация';

LOCALE.en.guild_title = 'Adventurers Guild';
LOCALE.en.guild_tab_ranks = 'Ranks';
LOCALE.en.guild_tab_stats = 'Statistics';
LOCALE.en.guild_tab_quests = 'Quests';
LOCALE.en.guild_back = '↩ Back';
LOCALE.en.guild_rank_novice = 'Recruit';
LOCALE.en.guild_rep = 'rep.';
LOCALE.en.guild_max = '— MAX';
LOCALE.en.guild_daily_title = '📋 Daily Quests';
LOCALE.en.guild_weekly_title = '📜 Weekly Quests';
LOCALE.en.guild_no_quests = 'No active quests';
LOCALE.en.guild_quest_done = '✓ Completed';
LOCALE.en.guild_quest_claim = 'Claim (+{0} rep.)';
LOCALE.en.guild_stat_total_kills = 'Total enemies killed';
LOCALE.en.guild_stat_total_bosses = 'Total bosses killed';
LOCALE.en.guild_stat_bestiary = 'Enemies discovered';
LOCALE.en.guild_stat_runs = 'Total runs';
LOCALE.en.guild_stat_best_time = 'Best time';
LOCALE.en.guild_stat_best_kills = 'Best kills';
LOCALE.en.guild_stat_reputation = 'Current reputation';



/* ============================================================
   СТАТИСТИКА ЗАБЕГА (Run Stats)
   ============================================================ */
LOCALE.ru.stats_title = '📊 СТАТИСТИКА ЗАБЕГА';
LOCALE.ru.stats_continue = 'Продолжить';
LOCALE.ru.stats_time = 'Время';
LOCALE.ru.stats_kills = 'Убийств';
LOCALE.ru.stats_level = 'Уровень';
LOCALE.ru.stats_wave = 'Волна';
LOCALE.ru.stats_maps = 'Карт пройдено';
LOCALE.ru.stats_gold_collected = 'Золото собрано';
LOCALE.ru.stats_gold_bonus = 'Золото (бонус)';
LOCALE.ru.stats_gold_total = 'Золото (итого)';
LOCALE.ru.stats_damage_dealt = 'Урон нанесён';
LOCALE.ru.stats_damage_taken = 'Урон получен';
LOCALE.ru.stats_bosses = 'Боссов убито';
LOCALE.ru.stats_chests = 'Сундуков открыто';
LOCALE.ru.stats_best_roll = 'Лучший бросок d20';

LOCALE.en.stats_title = '📊 RUN STATISTICS';
LOCALE.en.stats_continue = 'Continue';
LOCALE.en.stats_time = 'Time';
LOCALE.en.stats_kills = 'Kills';
LOCALE.en.stats_level = 'Level';
LOCALE.en.stats_wave = 'Wave';
LOCALE.en.stats_maps = 'Maps cleared';
LOCALE.en.stats_gold_collected = 'Gold collected';
LOCALE.en.stats_gold_bonus = 'Gold (bonus)';
LOCALE.en.stats_gold_total = 'Gold (total)';
LOCALE.en.stats_damage_dealt = 'Damage dealt';
LOCALE.en.stats_damage_taken = 'Damage taken';
LOCALE.en.stats_bosses = 'Bosses killed';
LOCALE.en.stats_chests = 'Chests opened';
LOCALE.en.stats_best_roll = 'Best d20 roll';

/* ============================================================
   ВРАГИ (имена для бестиария — EN)
   ============================================================ */
LOCALE.en.enemy_skeleton = 'Skeleton Warrior';
LOCALE.en.enemy_zombie = 'Zombie';
LOCALE.en.enemy_goblin = 'Goblin Raider';
LOCALE.en.enemy_giant_rat = 'Giant Rat';
LOCALE.en.enemy_acid_slug = 'Acid Slug';
LOCALE.en.enemy_cave_bat = 'Cave Bat';
LOCALE.en.enemy_ratcatcher = 'Ratcatcher Skeleton';
LOCALE.en.enemy_mold = 'Mold';
LOCALE.en.enemy_archer = 'Skeleton Archer';
LOCALE.en.enemy_ooze = 'Ooze (Ochre)';
LOCALE.en.enemy_gasspore = 'Gas Spore';
LOCALE.en.enemy_gnoll = 'Gnoll Raider';
LOCALE.en.enemy_kobold = 'Kobold Trapper';
LOCALE.en.enemy_cave_crab = 'Cave Crab';
LOCALE.en.enemy_ghost = 'Ghost';
LOCALE.en.enemy_alchemist_skel = 'Alchemist Skeleton';
LOCALE.en.enemy_harpy = 'Harpy';
LOCALE.en.enemy_dung_beetle = 'Dung Beetle';
LOCALE.en.enemy_mage = 'Skeleton Mage';
LOCALE.en.enemy_spider = 'Giant Spider';
LOCALE.en.enemy_fire_elem = 'Fire Elemental';
LOCALE.en.enemy_bat = 'Vampire Bat';
LOCALE.en.enemy_minotaur = 'Minotaur';
LOCALE.en.enemy_basilisk = 'Basilisk';
LOCALE.en.enemy_medusa = 'Medusa';
LOCALE.en.enemy_doppelganger = 'Doppelganger';
LOCALE.en.enemy_earth_elem = 'Earth Elemental';
LOCALE.en.enemy_water_elem = 'Water Elemental';
LOCALE.en.enemy_beholder_spore = 'Beholder Spore';
LOCALE.en.enemy_hell_hound = 'Hell Hound';
LOCALE.en.enemy_captain = 'Skeleton Captain';
LOCALE.en.enemy_cultist = 'Cultist';
LOCALE.en.enemy_shadow = 'Shadow Assassin';
LOCALE.en.enemy_dragonid = 'Dragonborn Warrior';
LOCALE.en.enemy_drow = 'Drow Scout';
LOCALE.en.enemy_illithid = 'Illithid';
LOCALE.en.enemy_stone_golem = 'Stone Golem';
LOCALE.en.enemy_rust_monster = 'Rust Monster';
LOCALE.en.enemy_lich_minor = 'Lich Necromancer';
LOCALE.en.enemy_chimera = 'Chimera';
LOCALE.en.enemy_demon_berserker = 'Demon Berserker';
LOCALE.en.enemy_rotgolem = 'Rot Golem';
LOCALE.en.enemy_dragonet = 'Bone Dragonet';
LOCALE.en.enemy_young_dragon = 'Young Dragon';
LOCALE.en.enemy_observer = 'Observer';
LOCALE.en.enemy_death_knight = 'Death Knight';
LOCALE.en.enemy_hydra_small = 'Hydra (Small)';
LOCALE.en.enemy_archlich = 'Archlich';
LOCALE.en.enemy_eldritch_horror = 'Eldritch Horror';
LOCALE.en.enemy_bone_colossus = 'Bone Colossus';
LOCALE.en.enemy_mimic = 'Mimic';
LOCALE.en.enemy_spiderling = 'Spiderling';
LOCALE.en.enemy_slimeling = 'Slimeling';



/* ============================================================
   ТАЛАНТЫ (названия и эффекты)
   ============================================================ */
LOCALE.ru.talent_resurrect = 'Возрождение';
LOCALE.ru.talent_bonus_projectiles = 'Увеличение снарядов';
LOCALE.ru.talent_max_hp = 'Закалка';
LOCALE.ru.talent_move_speed = 'Быстрые ноги';
LOCALE.ru.talent_phys_damage = 'Грубая сила';
LOCALE.ru.talent_magic_damage = 'Магическая мощь';
LOCALE.ru.talent_cooldown_reduce = 'Скорострельность';
LOCALE.ru.talent_crit_chance = 'Критический удар';
LOCALE.ru.talent_lifesteal = 'Вампиризм';
LOCALE.ru.talent_dodge = 'Уворот';
LOCALE.ru.talent_xp_radius = 'Магнит опыта';
LOCALE.ru.talent_gold_bonus = 'Золотая лихорадка';
LOCALE.ru.talent_xp_bonus = 'Учёность';
LOCALE.ru.talent_hp_regen = 'Регенерация';
LOCALE.ru.talent_damage_reduction = 'Стойкость';
LOCALE.ru.talent_trap_resist = 'Ловкач';
LOCALE.ru.talent_iframe_extend = 'Неуязвимость';
LOCALE.ru.talent_bleed_chance = 'Жажда крови';
LOCALE.ru.talent_extra_weapon_slot = 'Арсенал';
LOCALE.ru.talent_extra_ability_slot = 'Мастерство';
LOCALE.ru.talent_debuff_resist = 'Сопротивление';
LOCALE.ru.talent_chest_luck = 'Удачливый охотник';
LOCALE.ru.talent_explosive_kill = 'Взрывная смерть';
LOCALE.ru.talent_instant_kill = 'Мгновенная казнь';
LOCALE.ru.talent_double_xp = 'Двойной опыт';

LOCALE.en.talent_resurrect = 'Resurrection';
LOCALE.en.talent_bonus_projectiles = 'Extra Projectiles';
LOCALE.en.talent_max_hp = 'Toughness';
LOCALE.en.talent_move_speed = 'Quick Feet';
LOCALE.en.talent_phys_damage = 'Brute Force';
LOCALE.en.talent_magic_damage = 'Magic Power';
LOCALE.en.talent_cooldown_reduce = 'Fire Rate';
LOCALE.en.talent_crit_chance = 'Critical Strike';
LOCALE.en.talent_lifesteal = 'Vampirism';
LOCALE.en.talent_dodge = 'Dodge';
LOCALE.en.talent_xp_radius = 'XP Magnet';
LOCALE.en.talent_gold_bonus = 'Gold Rush';
LOCALE.en.talent_xp_bonus = 'Scholarship';
LOCALE.en.talent_hp_regen = 'Regeneration';
LOCALE.en.talent_damage_reduction = 'Resilience';
LOCALE.en.talent_trap_resist = 'Nimble';
LOCALE.en.talent_iframe_extend = 'Invincibility';
LOCALE.en.talent_bleed_chance = 'Bloodthirst';
LOCALE.en.talent_extra_weapon_slot = 'Arsenal';
LOCALE.en.talent_extra_ability_slot = 'Mastery';
LOCALE.en.talent_debuff_resist = 'Resistance';
LOCALE.en.talent_chest_luck = 'Lucky Hunter';
LOCALE.en.talent_explosive_kill = 'Explosive Kill';
LOCALE.en.talent_instant_kill = 'Instant Kill';
LOCALE.en.talent_double_xp = 'Double XP';

/* ============================================================
   ГИЛЬДЕЙСКИЕ РАНГИ
   ============================================================ */
LOCALE.ru.guild_rank_copper = 'Медный';
LOCALE.ru.guild_rank_iron = 'Железный';
LOCALE.ru.guild_rank_bronze = 'Бронзовый';
LOCALE.ru.guild_rank_silver = 'Серебряный';
LOCALE.ru.guild_rank_gold = 'Золотой';
LOCALE.ru.guild_rank_platinum = 'Платиновый';
LOCALE.ru.guild_rank_adamant = 'Адамантовый';
LOCALE.ru.guild_rank_mithril = 'Мифриловый';
LOCALE.ru.guild_rank_legendary = 'Легендарный';
LOCALE.ru.guild_rank_mythic = 'Мифический';

LOCALE.en.guild_rank_copper = 'Copper';
LOCALE.en.guild_rank_iron = 'Iron';
LOCALE.en.guild_rank_bronze = 'Bronze';
LOCALE.en.guild_rank_silver = 'Silver';
LOCALE.en.guild_rank_gold = 'Gold';
LOCALE.en.guild_rank_platinum = 'Platinum';
LOCALE.en.guild_rank_adamant = 'Adamant';
LOCALE.en.guild_rank_mithril = 'Mithril';
LOCALE.en.guild_rank_legendary = 'Legendary';
LOCALE.en.guild_rank_mythic = 'Mythic';



/* ============================================================
   ГИЛЬДЕЙСКИЕ ЗАДАНИЯ (Guild Quests)
   ============================================================ */
LOCALE.ru.quest_kill_500 = 'Убей 500 врагов';
LOCALE.ru.quest_kill_skeletons = 'Убей 200 скелетов';
LOCALE.ru.quest_kill_200 = 'Убей 200 врагов';
LOCALE.ru.quest_survive_5min = 'Продержись 5 минут';
LOCALE.ru.quest_collect_xp = 'Собери 2000 опыта';
LOCALE.ru.quest_open_chests = 'Открой 3 сундука';
LOCALE.ru.quest_reach_wave5 = 'Дойди до 5 волны';
LOCALE.ru.quest_kill_elites = 'Убей 50 элитных врагов';
LOCALE.ru.quest_kill_3_bosses = 'Убей 3 боссов';
LOCALE.ru.quest_kill_5000 = 'Убей 5000 врагов';
LOCALE.ru.quest_survive_15min = 'Продержись 15 минут';
LOCALE.ru.quest_complete_3_runs = 'Заверши 3 забега';
LOCALE.ru.quest_reach_wave10 = 'Дойди до 10 волны';

LOCALE.en.quest_kill_500 = 'Kill 500 enemies';
LOCALE.en.quest_kill_skeletons = 'Kill 200 skeletons';
LOCALE.en.quest_kill_200 = 'Kill 200 enemies';
LOCALE.en.quest_survive_5min = 'Survive for 5 minutes';
LOCALE.en.quest_collect_xp = 'Collect 2000 XP';
LOCALE.en.quest_open_chests = 'Open 3 chests';
LOCALE.en.quest_reach_wave5 = 'Reach wave 5';
LOCALE.en.quest_kill_elites = 'Kill 50 elite enemies';
LOCALE.en.quest_kill_3_bosses = 'Kill 3 bosses';
LOCALE.en.quest_kill_5000 = 'Kill 5000 enemies';
LOCALE.en.quest_survive_15min = 'Survive for 15 minutes';
LOCALE.en.quest_complete_3_runs = 'Complete 3 runs';
LOCALE.en.quest_reach_wave10 = 'Reach wave 10';

/* ============================================================
   ГИЛЬДЕЙСКИЕ НАГРАДЫ
   ============================================================ */
LOCALE.ru.guild_reward_weapon_slot = '+1 слот оружия (всего {0})';
LOCALE.ru.guild_reward_ability_slot = '+1 слот пассивки (всего {0})';
LOCALE.ru.guild_reward_lich_blade = 'Клинок короля-лича';
LOCALE.ru.guild_reward_start_bonus = 'Старт с мечом +1 ур.';
LOCALE.ru.guild_reward_exclusive_chance = '+5% шанс эксклюзива';
LOCALE.ru.guild_reward_archmage_staff = 'Посох архимага';
LOCALE.ru.guild_reward_start_xp = '+20% XP на 2 мин при старте';
LOCALE.ru.guild_reward_legend = '+10% ко всем статам, золотая рамка';

LOCALE.en.guild_reward_weapon_slot = '+1 weapon slot (total {0})';
LOCALE.en.guild_reward_ability_slot = '+1 ability slot (total {0})';
LOCALE.en.guild_reward_lich_blade = 'Lich King Blade';
LOCALE.en.guild_reward_start_bonus = 'Start with sword +1 lv.';
LOCALE.en.guild_reward_exclusive_chance = '+5% exclusive chance';
LOCALE.en.guild_reward_archmage_staff = 'Archmage Staff';
LOCALE.en.guild_reward_start_xp = '+20% XP for 2 min at start';
LOCALE.en.guild_reward_legend = '+10% all stats, golden frame';

/* ============================================================
   ОБЩИЕ / РАЗНОЕ
   ============================================================ */
LOCALE.ru.btn_back = '↩ Назад';
LOCALE.ru.btn_continue = 'Продолжить';
LOCALE.ru.btn_accept = 'Принять';
LOCALE.ru.btn_decline = 'Отказаться';
LOCALE.ru.btn_claim = 'Забрать';
LOCALE.ru.lv = 'ур.';
LOCALE.ru.level_short = 'Ур.';
LOCALE.ru.gold_icon = '🪙';
LOCALE.ru.rep_icon = '⚜';



LOCALE.en.btn_back = '↩ Back';
LOCALE.en.btn_continue = 'Continue';
LOCALE.en.btn_accept = 'Accept';
LOCALE.en.btn_decline = 'Decline';
LOCALE.en.btn_claim = 'Claim';
LOCALE.en.lv = 'lv.';
LOCALE.en.level_short = 'Lv.';
LOCALE.en.gold_icon = '🪙';
LOCALE.en.rep_icon = '⚜';

/* ============================================================
   ВРАГИ — Описания (EN) для бестиария
   ============================================================ */
LOCALE.en.bestiary_desc_skeleton = 'Once dreamed of being a hero, now just dreams of flesh.';
LOCALE.en.bestiary_desc_zombie = 'Slow, dumb, but very persistent. Like your internet provider.';
LOCALE.en.bestiary_desc_goblin = 'Small, angry, and it has your wallet.';
LOCALE.en.bestiary_desc_giant_rat = 'When you saw a regular rat, think what could be worse.';
LOCALE.en.bestiary_desc_acid_slug = 'Leaves slime and existential questions behind.';
LOCALE.en.bestiary_desc_cave_bat = 'Flies chaotically. Just like your plans tonight.';
LOCALE.en.bestiary_desc_ratcatcher = 'Was catching rats until he became one. Literally.';
LOCALE.en.bestiary_desc_mold = 'Immobile but very resentful. Like your ex.';
LOCALE.en.bestiary_desc_archer = 'Shoots arrows. Surprising, right?';
LOCALE.en.bestiary_desc_ooze = 'Hugs? No thanks. Definitely not.';
LOCALE.en.bestiary_desc_gasspore = 'Looks harmless. Smells... not great.';
LOCALE.en.bestiary_desc_gnoll = 'Runs at you and growls. Original tactics.';
LOCALE.en.bestiary_desc_kobold = 'Little self-taught engineer. His traps are his pride.';
LOCALE.en.bestiary_desc_cave_crab = 'Shell harder than your willpower to pass a chest.';
LOCALE.en.bestiary_desc_ghost = 'Walls? What walls? They don\'t exist for him.';
LOCALE.en.bestiary_desc_alchemist_skel = 'A dead scientist is still a scientist. Just angrier.';
LOCALE.en.bestiary_desc_harpy = 'Dives from the sky. Because "fair fight" isn\'t her style.';
LOCALE.en.bestiary_desc_dung_beetle = 'Rolls its ball with incredible pride.';
LOCALE.en.bestiary_desc_mage = 'Teleports and shoots. Sneaky, like a pop quiz.';
LOCALE.en.bestiary_desc_spider = 'Eight legs. Zero conscience. Many babies.';
LOCALE.en.bestiary_desc_fire_elem = 'Hot, but not in a romantic way.';
LOCALE.en.bestiary_desc_bat = 'Vampire intern. Hasn\'t mastered the full bite yet.';
LOCALE.en.bestiary_desc_minotaur = 'Charges and hits. Strategy? Never heard of it.';
LOCALE.en.bestiary_desc_basilisk = 'Its gaze slows you down. Like Mondays.';
LOCALE.en.bestiary_desc_medusa = 'Shoots poison arrows. Hairstyle is a separate issue.';
LOCALE.en.bestiary_desc_doppelganger = 'Copies your attacks. But worse. Much worse.';
LOCALE.en.bestiary_desc_earth_elem = 'Slow as bureaucracy, and just as impenetrable.';
LOCALE.en.bestiary_desc_water_elem = 'Wet. Cold. Unpleasant.';
LOCALE.en.bestiary_desc_beholder_spore = 'Many eyes, little brain. But shoots everywhere.';
LOCALE.en.bestiary_desc_hell_hound = 'Good boy? No. Definitely not.';
LOCALE.en.bestiary_desc_captain = 'Commands skeletons. Got promoted posthumously.';
LOCALE.en.bestiary_desc_cultist = 'Summons friends. Because alone he can do nothing.';
LOCALE.en.bestiary_desc_shadow = 'You can\'t see him, but he sees you. Always.';
LOCALE.en.bestiary_desc_dragonid = 'Half-dragon, half-warrior. Fully dangerous.';
LOCALE.en.bestiary_desc_drow = 'Dark elf assassin. Invisible until it\'s too late.';
LOCALE.en.bestiary_desc_illithid = 'Tentacles, telepathy, arrogance. Full package.';
LOCALE.en.bestiary_desc_stone_golem = 'Stone, slow, but if it hits — you\'ll remember.';
LOCALE.en.bestiary_desc_rust_monster = 'Eats metal. Your metal. Your armor.';
LOCALE.en.bestiary_desc_lich_minor = 'Necromancer with an entourage. Leader of the year.';
LOCALE.en.bestiary_desc_chimera = 'Three heads. Three problems. One creature.';
LOCALE.en.bestiary_desc_demon_berserker = 'The closer to death, the more dangerous. Logic?';
LOCALE.en.bestiary_desc_rotgolem = 'Rotten, huge, and spreads spores.';
LOCALE.en.bestiary_desc_dragonet = 'A little dragon. For now.';
LOCALE.en.bestiary_desc_young_dragon = 'Young but already with fire breath and a wrecking-ball tail.';
LOCALE.en.bestiary_desc_observer = 'Flies, shoots beams from eyes. Classic.';
LOCALE.en.bestiary_desc_death_knight = 'A knight who went to the dark side. And likes it there.';
LOCALE.en.bestiary_desc_hydra_small = 'Cut a head — two grow back. Math is not in your favor.';
LOCALE.en.bestiary_desc_archlich = 'Immortal mage. Teleportation, dark waves, undead army.';
LOCALE.en.bestiary_desc_eldritch_horror = 'Look at it — lose your sanity. And speed.';
LOCALE.en.bestiary_desc_bone_colossus = 'A mountain of bones that decided to get up and walk.';
LOCALE.en.bestiary_desc_mimic = 'Free cheese only in a mousetrap. And in this chest.';
LOCALE.en.bestiary_desc_spiderling = 'Small. Fast. There are always more than you think.';
LOCALE.en.bestiary_desc_slimeling = 'A piece of mama slime. Just as nasty.';



/* ============================================================
   ВРАГИ — Способности (EN) для бестиария
   ============================================================ */
LOCALE.en.bestiary_ability_zombie = 'Leaves rot puddle on death';
LOCALE.en.bestiary_ability_goblin = 'Hit and run';
LOCALE.en.bestiary_ability_giant_rat = '30% chance to flee from hero';
LOCALE.en.bestiary_ability_acid_slug = 'Acid puddle on death';
LOCALE.en.bestiary_ability_cave_bat = 'Flies in sine wave';
LOCALE.en.bestiary_ability_ratcatcher = 'Spawns 2 rats on death';
LOCALE.en.bestiary_ability_mold = 'Immobile, lunges when close';
LOCALE.en.bestiary_ability_archer = 'Shoots at range, retreats';
LOCALE.en.bestiary_ability_ooze = 'Leaves slime trail; splits into 2 on death';
LOCALE.en.bestiary_ability_gasspore = 'Explodes in poison cloud on death';
LOCALE.en.bestiary_ability_gnoll = 'Enrages at <50% HP (+30% speed)';
LOCALE.en.bestiary_ability_kobold = 'Places traps on the ground';
LOCALE.en.bestiary_ability_cave_crab = 'Hides in shell periodically (-50% damage)';
LOCALE.en.bestiary_ability_ghost = 'Passes through walls';
LOCALE.en.bestiary_ability_alchemist_skel = 'Throws potions (AoE damage)';
LOCALE.en.bestiary_ability_harpy = 'Dives from above, then retreats';
LOCALE.en.bestiary_ability_dung_beetle = 'Rolls ball; flees when ball is destroyed';
LOCALE.en.bestiary_ability_mage = 'Teleports, shoots magic bolts';
LOCALE.en.bestiary_ability_spider = 'Dashes to target; spawns 3 spiderlings on death';
LOCALE.en.bestiary_ability_fire_elem = 'Fire trail; explosion on death';
LOCALE.en.bestiary_ability_bat = 'Sine wave flight, 20% dodge chance';
LOCALE.en.bestiary_ability_minotaur = 'Charges (stun, knockback)';
LOCALE.en.bestiary_ability_basilisk = 'Gaze slows 60% (2 sec)';
LOCALE.en.bestiary_ability_medusa = 'Poison arrows (DoT)';
LOCALE.en.bestiary_ability_doppelganger = 'Copies player weapon (50% damage)';
LOCALE.en.bestiary_ability_earth_elem = 'Creates earth walls';
LOCALE.en.bestiary_ability_water_elem = 'Water trail; knockback wave';
LOCALE.en.bestiary_ability_beholder_spore = 'Fan shots (3 bolts); explodes on death';
LOCALE.en.bestiary_ability_hell_hound = 'Fire trail; explodes on death';
LOCALE.en.bestiary_ability_captain = 'Aura: +20% damage/speed to nearby allies';
LOCALE.en.bestiary_ability_cultist = 'Summons up to 3 skeletons';
LOCALE.en.bestiary_ability_shadow = 'Periodically invisible; backstab ×1.5';
LOCALE.en.bestiary_ability_dragonid = 'Fire breath (cone)';
LOCALE.en.bestiary_ability_drow = 'Invisibility at range; backstab; traps';
LOCALE.en.bestiary_ability_illithid = 'Psychic wave (AoE); buffs allies on death';
LOCALE.en.bestiary_ability_stone_golem = '30% stun chance; immune to poison/bleed';
LOCALE.en.bestiary_ability_rust_monster = 'Reduces player damage on hit; rust explosion';
LOCALE.en.bestiary_ability_lich_minor = 'Summons up to 6 skeletons; dark arrows';
LOCALE.en.bestiary_ability_chimera = '3 heads: lion (melee), goat (bolt), snake (poison)';
LOCALE.en.bestiary_ability_demon_berserker = 'At <30% HP: ×1.4 speed, ×1.5 dmg, ×2 taken';
LOCALE.en.bestiary_ability_rotgolem = 'Releases gas spores on damage';
LOCALE.en.bestiary_ability_dragonet = 'Fire breath (cone, 3 bolts)';
LOCALE.en.bestiary_ability_young_dragon = 'Fire breath (wide cone); tail sweep (AoE)';
LOCALE.en.bestiary_ability_observer = '4 eye beams; anti-magic (blocks abilities)';
LOCALE.en.bestiary_ability_death_knight = 'AoE dark wave; reduces healing; death curse';
LOCALE.en.bestiary_ability_hydra_small = '3 heads; severed heads regrow (5 sec)';
LOCALE.en.bestiary_ability_archlich = 'Teleport; dark wave; summons; homing bolt';
LOCALE.en.bestiary_ability_eldritch_horror = 'Abyss cry: AoE slow 50% (3 sec)';
LOCALE.en.bestiary_ability_bone_colossus = 'Releases skeletons when damaged';
LOCALE.en.bestiary_ability_mimic = 'Disguised as chest; bites when close';

/* ============================================================
   ТИРЫ ВРАГОВ (для UI бестиария)
   ============================================================ */
LOCALE.ru.tier_1 = 'Тир I';
LOCALE.ru.tier_2 = 'Тир II';
LOCALE.ru.tier_3 = 'Тир III';
LOCALE.ru.tier_4 = 'Тир IV';
LOCALE.ru.tier_5 = 'Тир V';
LOCALE.ru.tier_0 = 'Особый';

LOCALE.en.tier_1 = 'Tier I';
LOCALE.en.tier_2 = 'Tier II';
LOCALE.en.tier_3 = 'Tier III';
LOCALE.en.tier_4 = 'Tier IV';
LOCALE.en.tier_5 = 'Tier V';
LOCALE.en.tier_0 = 'Special';



/* ============================================================
   Автоматическая инициализация data-i18n при загрузке DOM
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = t(key);
    if (translated !== key) el.textContent = translated;
  });
});



/* Дополнительные ключи */
LOCALE.ru.transition_text = 'Переход в следующее подземелье...';
LOCALE.en.transition_text = 'Moving to the next dungeon...';
