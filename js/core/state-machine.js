'use strict';
/* ============================================================
   state-machine.js — Загрузочный модуль и управление состояниями.
   
   Содержит:
   - IconGenerator: Программная генерация иконки d20 (favicon/touch icon)
   - TitleScreen: Титульный экран при первом запуске
   - LoadingScreen: Экран загрузки при переходе между картами
   - BOOT: Точка входа приложения (window.onload)
   
   Порядок загрузки:
   Этот файл загружается ПОСЛЕДНИМ и запускает инициализацию игры.
   
   Экспорт: window.{IconGenerator, TitleScreen, LoadingScreen}
   ============================================================ */


/* ============================================================
   IconGenerator — Программная генерация favicon и touch-иконки.
   
   Рисует стилизованный d20 (двадцатигранник) на canvas и 
   конвертирует в data:URL для установки как favicon/apple-touch-icon.
   ============================================================ */
const IconGenerator = {
  /**
   * Генерирует иконку d20 заданного размера.
   * 
   * @param {number} size - Размер иконки в пикселях (квадрат)
   * @returns {string} Data URL (PNG) сгенерированной иконки
   */
  generate(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Фон — тёмно-коричневый (стиль подземелья)
    ctx.fillStyle = '#1a1210';
    ctx.fillRect(0, 0, size, size);

    // Основная форма — правильный шестиугольник (аппроксимация d20)
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.38;

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // Заливка и обводка шестиугольника
    ctx.fillStyle = '#2a1f14';
    ctx.fill();
    ctx.strokeStyle = '#c9a84c';    // Золотая обводка
    ctx.lineWidth = size * 0.04;
    ctx.stroke();

    // Внутренний треугольник (декоративные линии)
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.3)';
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius * 0.7);
    ctx.lineTo(cx - radius * 0.6, cy + radius * 0.5);
    ctx.lineTo(cx + radius * 0.6, cy + radius * 0.5);
    ctx.closePath();
    ctx.stroke();

    // Число "20" по центру
    ctx.fillStyle = '#c9a84c';
    ctx.font = `bold ${size * 0.3}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('20', cx, cy + size * 0.02);

    return canvas.toDataURL('image/png');
  },

  /**
   * Генерирует иконки нескольких размеров и устанавливает их 
   * в соответствующие элементы DOM (favicon, apple-touch-icon).
   */
  install() {
    const favicon64 = this.generate(64);
    const icon192 = this.generate(192);

    // Установка favicon (32x32 → 64x64 для retina)
    const faviconEl = document.getElementById('favicon');
    if (faviconEl) faviconEl.href = favicon64;

    // Установка apple-touch-icon (192x192)
    const touchEl = document.getElementById('touchIcon');
    if (touchEl) touchEl.href = icon192;
  }
};

window.IconGenerator = IconGenerator;


/* ============================================================
   TitleScreen — Титульный экран (показывается при первом запуске).
   
   При первом запуске отображает стилизованный экран с рунами
   и автоматически скрывается через 4 секунды (или по тапу/клику).
   При повторных запусках пропускается.
   ============================================================ */
const TitleScreen = {
  /** @type {HTMLElement|null} DOM-элемент титульного экрана */
  el: null,
  /** @type {boolean} Был ли экран уже показан/скрыт */
  shown: false,
  /** @type {number|null} ID таймера автоскрытия */
  autoTimer: null,

  /**
   * Инициализация титульного экрана.
   * Проверяет localStorage на предмет первого запуска.
   */
  init() {
    this.el = document.getElementById('titleScreen');
    if (!this.el) return;

    // Проверяем, запускалась ли игра ранее
    const wasLaunched = SafeStorage.getItem('d20_firstLaunch');
    if (wasLaunched) {
      // Не первый запуск — пропускаем титульный экран
      this.el.classList.add('hidden');
      this.shown = true;
      return;
    }

    // Первый запуск — показываем экран с декоративными рунами
    this._drawRunes();
    this.shown = false;

    // Обработчик закрытия (клик/тап)
    const dismiss = () => {
      if (this.shown) return;
      this.shown = true;

      // Сохраняем флаг "игра запускалась"
      SafeStorage.setItem('d20_firstLaunch', '1');

      // Плавное исчезновение
      this.el.style.transition = 'opacity 0.5s ease';
      this.el.style.opacity = '0';
      setTimeout(() => {
        this.el.classList.add('hidden');
        this.el.style.opacity = '';
        // Запуск игры (показ лагеря)
        Game._afterTitleDismissed();
      }, 500);

      // Отмена автотаймера
      if (this.autoTimer) clearTimeout(this.autoTimer);
    };

    // Регистрация событий закрытия
    this.el.addEventListener('click', dismiss);
    this.el.addEventListener('touchstart', dismiss, { passive: true });

    // Автоматическое закрытие через 4 секунды
    this.autoTimer = setTimeout(dismiss, 4000);
  },

  /**
   * Рисует декоративные руны на canvas-фоне титульного экрана.
   * Создаёт атмосферу подземелья с помощью случайных линий и рунических символов.
   * @private
   */
  _drawRunes() {
    const runesEl = document.getElementById('titleRunes');
    if (!runesEl) return;

    // Создаём canvas для рунических линий
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    const ctx = canvas.getContext('2d');

    // Настройка стиля линий (золотистый полупрозрачный)
    ctx.strokeStyle = 'rgba(201, 168, 76, 0.5)';
    ctx.lineWidth = 1;

    // Рисуем случайные ломаные линии (имитация трещин/рун)
    const numLines = 12;
    for (let i = 0; i < numLines; i++) {
      ctx.beginPath();
      let x = Math.random() * canvas.width;
      let y = Math.random() * canvas.height;
      ctx.moveTo(x, y);

      // Каждая линия состоит из 3-6 сегментов
      const segments = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < segments; j++) {
        x += (Math.random() - 0.5) * 120;
        y += (Math.random() - 0.5) * 120;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Рисуем рунические символы (Старший Футарк) в случайных точках
    const runeSymbols = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᛁ', 'ᛃ', 'ᛈ'];
    ctx.font = '16px serif';
    ctx.fillStyle = 'rgba(201, 168, 76, 0.4)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < 8; i++) {
      const rx = Math.random() * canvas.width;
      const ry = Math.random() * canvas.height;
      const randomRune = runeSymbols[Math.floor(Math.random() * runeSymbols.length)];
      ctx.fillText(randomRune, rx, ry);
    }

    runesEl.appendChild(canvas);
  },

  /**
   * Проверяет, активен ли титульный экран (блокирует ввод).
   * @returns {boolean} true, если экран ещё показан
   */
  isActive() {
    return !this.shown;
  }
};

window.TitleScreen = TitleScreen;


/* ============================================================
   LoadingScreen — Экран загрузки при переходе между картами.
   
   Показывает анимацию вращающегося d20 кубика с меняющимися
   числами во время генерации новой карты.
   ============================================================ */
const LoadingScreen = {
  /** @type {HTMLElement|null} Контейнер экрана загрузки */
  el: null,
  /** @type {HTMLElement|null} Элемент с числом на кубике */
  dieEl: null,
  /** @type {number|null} ID интервала анимации */
  _interval: null,

  /**
   * Инициализация — привязка к DOM-элементам.
   */
  init() {
    this.el = document.getElementById('loadingScreen');
    this.dieEl = document.getElementById('loadingDie');
  },

  /**
   * Показать экран загрузки и запустить анимацию числа.
   * Число на кубике случайно меняется каждые 100мс.
   */
  show() {
    if (!this.el) return;
    this.el.classList.add('active');

    // Анимация случайного числа на d20
    this._interval = setInterval(() => {
      if (this.dieEl) {
        this.dieEl.textContent = String(1 + Math.floor(Math.random() * 20));
      }
    }, 100);
  },

  /**
   * Скрыть экран загрузки и остановить анимацию.
   */
  hide() {
    if (!this.el) return;
    this.el.classList.remove('active');

    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }
};

window.LoadingScreen = LoadingScreen;


/* ============================================================
   BOOT — Точка входа приложения.
   
   Выполняется при событии window.load (все ресурсы загружены).
   Порядок инициализации:
   1. Генерация и установка favicon/иконок
   2. Инициализация экрана загрузки
   3. Инициализация UI
   4. Показ титульного экрана (или немедленный старт)
   5. Блокировка контекстного меню (для мобильных)
   ============================================================ */
window.addEventListener('load', () => {
  // 1. Генерация программных иконок (favicon + apple-touch-icon)
  IconGenerator.install();

  // 2. Подготовка экрана загрузки (привязка к DOM)
  LoadingScreen.init();

  // 3. Инициализация пользовательского интерфейса
  UI.init();

  // 4. Bestiary back button now handled via CSS design system (no fix needed)

  // 4.5. Инициализация системы монетизации (AdMob / заглушка)
  //      Оборачиваем в try-catch, чтобы ошибка монетизации
  //      не блокировала запуск игры.
  if (window.Monetization) {
    try {
      Monetization.initialize().catch(function(err) {
        console.warn('[Boot] Monetization.initialize() rejected:', err);
      });
    } catch (e) {
      console.warn('[Boot] Monetization.initialize() threw:', e);
    }
  }

  // 5. Титульный экран (первый запуск) или немедленный старт
  TitleScreen.init();
  if (TitleScreen.shown) {
    // Не первый запуск — сразу инициализируем игру
    try {
      Game.init();
    } catch (e) {
      console.error('[Boot] Game.init() failed:', e);
    }
  }
  // Иначе Game.init() вызовется после закрытия титульного экрана

  // 6. Блокировка контекстного меню (для мобильного WebView)
  document.addEventListener('contextmenu', (e) => e.preventDefault());
});
