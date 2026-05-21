'use strict';
/* ============================================================
   registry.js — Единый реестр модулей игры.
   
   Назначение:
   - Гарантирует определённый порядок инициализации модулей
   - Предоставляет безопасный доступ к модулям через Registry.get()
   - Служит точкой входа для инициализации всех подсистем
   
   Порядок загрузки:
   Этот файл загружается ПОСЛЕДНИМ среди модулей (перед state-machine.js),
   когда все зависимости уже определены в window.
   
   Экспорт: window.Registry
   ============================================================ */

const Registry = {
  /** @type {Object<string, any>} Хранилище зарегистрированных модулей */
  _modules: {},

  /**
   * Зарегистрировать модуль в реестре.
   * Вызывается автоматически при загрузке скрипта модуля.
   * 
   * @param {string} name - Уникальное имя модуля
   * @param {any} ref - Ссылка на объект модуля
   */
  register(name, ref) {
    this._modules[name] = ref;
  },

  /**
   * Получить модуль по имени.
   * Сначала проверяет внутренний реестр, затем window.
   * 
   * @param {string} name - Имя модуля
   * @returns {any|null} Модуль или null, если не найден
   */
  get(name) {
    return this._modules[name] || window[name] || null;
  },

  /**
   * Проверить, загружен ли модуль.
   * 
   * @param {string} name - Имя модуля
   * @returns {boolean} true, если модуль доступен
   */
  has(name) {
    return !!(this._modules[name] || window[name]);
  },

  /**
   * Инициализировать все подсистемы игры в правильном порядке.
   * Вызывается из Game.init() один раз при старте.
   * 
   * Порядок инициализации:
   * 1. Утилиты (уже готовы при загрузке)
   * 2. Карта (предвычисления)
   * 3. Система ввода
   * 4. Аудиосистема
   * 5. Графика и спрайты
   * 6. Мета-прогресс (сохранения)
   * 7. Бестиарий и кодекс
   * 8. Расширенный UI
   * 9. Патчи для врагов (из дополнительных конфигов)
   */
  initAll() {
    // Шаг 1: Утилиты — уже инициализированы при определении
    
    // Шаг 2: Карта — предвычисление коллизий и структур
    if (window.GameMap) {
      GameMap.precompute();
    }

    // Шаг 3: Система ввода (клавиатура + тач + джойстик)
    if (window.Input) {
      Input.init();
    }

    // Шаг 4: Аудиосистема (Web Audio API + музыка)
    if (window.GameAudio) {
      GameAudio.init();
    }

    // Шаг 5: Инициализация спрайтов и превью биомов
    if (window.initSprites) {
      initSprites();
    }
    if (window.initBiomePreviews) {
      initBiomePreviews();
    }

    // Шаг 6: Загрузка мета-прогресса из localStorage
    if (window.MetaProgress) {
      MetaProgress.load();
    }

    // Шаг 7: Загрузка данных бестиария и кодекса
    if (window.Bestiary) {
      Bestiary.load();
    }
    if (window.Codex) {
      Codex.load();
    }

    // Шаг 8: Расширенный UI (кнопки паузы, выхода, навигация назад)
    if (window.UIExtended) {
      UIExtended.addPauseExitButton();
      UIExtended.initBackButton();
    }

    // Шаг 9: Применение отложенных патчей для врагов
    // (загружаются из constants_step12.js и constants_expansion.js)
    if (window._initStep12EnemyPatches) {
      _initStep12EnemyPatches();
    }
    if (window._initExpansionEnemyPatches) {
      _initExpansionEnemyPatches();
    }
  }
};

/* --- Экспорт --- */
window.Registry = Registry;
