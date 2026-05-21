'use strict';
/* ============================================================
   achievements.js — Система достижений с наградой золотом.
   
   Как добавить новое достижение:
   1. Добавить объект в массив ACHIEVEMENT_DEFS ниже
   2. Добавить перевод ключей в locale-ru.js и locale-en.js:
      - LOCALE.xx.achieve_<id>       — название
      - LOCALE.xx.achieve_<id>_desc  — описание
   3. Вызвать Achievements.check('<id>') или Achievements.increment('<id>')
      в соответствующем месте кода (enemies.js, game-loop.js и т.д.)
   
   Формат определения:
   {
     id: 'unique_id',           // Уникальный идентификатор
     condition: 'kills',        // Тип проверки: 'kills' | 'bosses' | 'runs' | 'survive_time' | 'level'
     target: 100,               // Целевое значение
     goldReward: 500,           // Награда золотом
   }
   
   Экспорт: window.Achievements
   ============================================================ */

/* ============================================================
   ACHIEVEMENT_DEFS — Определения достижений.
   Добавляйте новые достижения в этот массив.
   ============================================================ */
const ACHIEVEMENT_DEFS = [
  // --- Достижение 1: Первая кровь ---
  {
    id: 'first_blood',
    condition: 'kills',
    target: 1,
    goldReward: 50,
  },
  // --- Достижение 2: Истребитель ---
  {
    id: 'slayer_100',
    condition: 'kills',
    target: 100,
    goldReward: 200,
  },
  // --- Достижение 3: Убийца боссов ---
  {
    id: 'boss_killer',
    condition: 'bosses',
    target: 3,
    goldReward: 500,
  },
  // --- Достижение 4: Выживший ---
  {
    id: 'survivor_5min',
    condition: 'survive_time',
    target: 300, // 5 минут в секундах
    goldReward: 300,
  },
  // --- Достижение 5: Ветеран ---
  {
    id: 'veteran_10runs',
    condition: 'runs',
    target: 10,
    goldReward: 1000,
  },
  /* ============================================================
     ДОБАВЛЯЙТЕ НОВЫЕ ДОСТИЖЕНИЯ НИЖЕ
     Пример:
     {
       id: 'my_new_achievement',
       condition: 'kills',   // 'kills' | 'bosses' | 'runs' | 'survive_time' | 'level'
       target: 500,
       goldReward: 750,
     },
     ============================================================ */
];

const ACHIEVEMENTS_KEY = 'd20_achievements';

const Achievements = {
  /** Данные о прогрессе достижений: { [id]: { unlocked: bool, progress: number } } */
  data: null,

  /** Инициализировать систему (вызывать при старте игры) */
  init() {
    this.data = this._load();
  },

  /** Загрузить данные из localStorage */
  _load() {
    try {
      const raw = SafeStorage.getItem(ACHIEVEMENTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    // Создать чистую структуру
    const data = {};
    for (const def of ACHIEVEMENT_DEFS) {
      data[def.id] = { unlocked: false, progress: 0 };
    }
    return data;
  },

  /** Сохранить данные */
  _save() {
    SafeStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(this.data));
  },

  /**
   * Проверить/обновить достижение с новым абсолютным значением.
   * @param {string} condition — тип проверки ('kills', 'bosses', 'runs', 'survive_time', 'level')
   * @param {number} value — текущее значение
   * @returns {Array} Массив только что разблокированных достижений (для показа уведомлений)
   */
  check(condition, value) {
    if (!this.data) this.init();
    const unlocked = [];
    for (const def of ACHIEVEMENT_DEFS) {
      if (def.condition !== condition) continue;
      const entry = this.data[def.id];
      if (!entry) {
        this.data[def.id] = { unlocked: false, progress: 0 };
      }
      const d = this.data[def.id];
      if (d.unlocked) continue;
      d.progress = Math.max(d.progress, value);
      if (d.progress >= def.target) {
        d.unlocked = true;
        // Начислить золото
        if (window.MetaProgress) {
          MetaProgress.addGold(def.goldReward);
        }
        unlocked.push(def);
      }
    }
    if (unlocked.length > 0) {
      this._save();
      // Показать уведомление
      for (const def of unlocked) {
        this._showNotification(def);
      }
    }
    return unlocked;
  },

  /**
   * Инкрементное увеличение прогресса (для счётчиков убийств и т.д.)
   * @param {string} condition — тип проверки
   * @param {number} [amount=1] — на сколько увеличить
   */
  increment(condition, amount) {
    if (!this.data) this.init();
    amount = amount || 1;
    for (const def of ACHIEVEMENT_DEFS) {
      if (def.condition !== condition) continue;
      const d = this.data[def.id] || { unlocked: false, progress: 0 };
      this.data[def.id] = d;
      if (d.unlocked) continue;
      d.progress += amount;
      if (d.progress >= def.target) {
        d.unlocked = true;
        if (window.MetaProgress) {
          MetaProgress.addGold(def.goldReward);
        }
        this._save();
        this._showNotification(def);
      }
    }
    this._save();
  },

  /** Показать всплывающее уведомление о разблокировке достижения */
  _showNotification(def) {
    const name = t('achieve_' + def.id);
    const gold = def.goldReward;
    // Создать всплывающий элемент
    const el = document.createElement('div');
    el.className = 'achievement-popup';
    el.innerHTML = `
      <div class="achievement-popup-icon">🏆</div>
      <div class="achievement-popup-text">
        <div class="achievement-popup-title">${t('achieve_unlocked')}</div>
        <div class="achievement-popup-name">${name}</div>
        <div class="achievement-popup-reward">+${gold} 🪙</div>
      </div>
    `;
    document.body.appendChild(el);
    // Анимация появления/исчезновения
    setTimeout(() => el.classList.add('show'), 50);
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, 3000);
  },

  /** Получить список всех достижений с их статусом (для UI) */
  getAll() {
    if (!this.data) this.init();
    return ACHIEVEMENT_DEFS.map(def => ({
      ...def,
      name: t('achieve_' + def.id),
      desc: t('achieve_' + def.id + '_desc'),
      unlocked: this.data[def.id] ? this.data[def.id].unlocked : false,
      progress: this.data[def.id] ? this.data[def.id].progress : 0,
    }));
  },
};

window.Achievements = Achievements;
window.ACHIEVEMENT_DEFS = ACHIEVEMENT_DEFS;
