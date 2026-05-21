'use strict';
/* ============================================================
   performance.js — Утилиты оптимизации памяти и производительности.
   
   Содержит:
   • MemoryOptimizer — Ограничение частиц и очистка далёких снарядов
   • DistanceCache — Кэш расстояний (один раз за кадр)
   • EnemyThrottle — Throttling обновления ИИ (пропуск кадров)
   • AudioPool — Пул аудио-источников для SFX
   • FPSCounter — Счётчик FPS с мониторингом (DEBUG)
   • PerfMonitor — Профилирование ключевых секций
   • VisibilityManager — Управление rAF при сворачивании
   
   Экспорт: window.{MemoryOptimizer, DistanceCache, EnemyThrottle,
                     FPSCounter, PerfMonitor, VisibilityManager}
   ============================================================ */

/* ============================================================
   DEBUG flag — включает FPS-счётчик и профилирование.
   Установить true для отладки, false для релиза.
   ============================================================ */
const DEBUG_PERF = false;
window.DEBUG_PERF = DEBUG_PERF;


/* ============================================================
   MemoryOptimizer — Управление памятью в рантайме.
   ============================================================ */
const MemoryOptimizer = {
  /** Макс. число активных частиц */
  MAX_PARTICLES: 200,

  /** Ограничить число активных частиц, деактивируя самые старые */
  enforceParticleLimit(particlePool) {
    if (!particlePool || !particlePool.items) return;
    const items = particlePool.items;
    let activeCount = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].active) activeCount++;
    }
    if (activeCount <= this.MAX_PARTICLES) return;
    // Деактивируем самые старые (наименьший life)
    let toRemove = activeCount - this.MAX_PARTICLES;
    for (let i = 0; i < items.length && toRemove > 0; i++) {
      if (items[i].active && items[i].life < 0.3) {
        items[i].active = false;
        toRemove--;
      }
    }
    // Если ещё не хватает — деактивируем любые с малым life
    if (toRemove > 0) {
      for (let i = 0; i < items.length && toRemove > 0; i++) {
        if (items[i].active && items[i].life < 0.6) {
          items[i].active = false;
          toRemove--;
        }
      }
    }
  },

  /**
   * Удаление снарядов, ушедших далеко за карту.
   * Вызывается раз в 0.5 сек чтобы не забивать пул.
   */
  cleanupDistantProjectiles(projectilePool, mapW, mapH) {
    if (!projectilePool || !projectilePool.items) return;
    const margin = 200;
    const items = projectilePool.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      if (p.x < -margin || p.x > mapW + margin ||
          p.y < -margin || p.y > mapH + margin) {
        p.active = false;
      }
    }
  },
};

window.MemoryOptimizer = MemoryOptimizer;


/* ============================================================
   DistanceCache — Кэш расстояний до игрока (один раз за кадр).
   Избегает повторных вычислений Math.hypot для одного объекта.
   ============================================================ */
const DistanceCache = {
  _playerX: 0,
  _playerY: 0,
  _frameId: 0,

  /** Обновить позицию игрока на начало кадра */
  beginFrame(px, py) {
    this._playerX = px;
    this._playerY = py;
    this._frameId++;
  },

  /** Получить квадрат расстояния до игрока (без sqrt) */
  getDistSq(obj) {
    const dx = obj.x - this._playerX;
    const dy = obj.y - this._playerY;
    return dx * dx + dy * dy;
  },

  /** Расстояние до игрока */
  getDist(obj) {
    return Math.sqrt(this.getDistSq(obj));
  },

  /** Быстрая проверка: объект в радиусе? */
  isInRange(obj, radius) {
    const dx = obj.x - this._playerX;
    const dy = obj.y - this._playerY;
    return (dx * dx + dy * dy) <= (radius * radius);
  }
};

window.DistanceCache = DistanceCache;


/* ============================================================
   EnemyThrottle — Throttled update для далёких врагов.
   
   Стратегия:
   - < FULL_UPDATE_DIST: полный AI каждый кадр
   - FULL_UPDATE_DIST..SLEEP_DIST: AI раз в 3 кадра
   - > SLEEP_DIST: AI раз в 10-20 кадров (sleep-режим)
   ============================================================ */
const EnemyThrottle = {
  /** Расстояние полного AI-обновления (px) */
  FULL_UPDATE_DIST: 600,
  /** Расстояние пропуска AI (далёкие враги) */
  SKIP_DIST: 1200,
  /** Расстояние sleep-режима (очень далёкие враги) */
  SLEEP_DIST: 1800,
  /** Максимум врагов с полным AI за кадр */
  MAX_FULL_AI_PER_FRAME: 50,
  /** Счётчик кадров */
  _frameCounter: 0,
  /** Счётчик врагов с полным AI в этом кадре */
  _fullAiThisFrame: 0,

  /** Вызвать в начале каждого кадра */
  tick() {
    this._frameCounter++;
    this._fullAiThisFrame = 0;
  },

  /**
   * Должен ли враг получать полное обновление AI в этом кадре?
   * @param {Object} enemy — Объект врага
   * @param {number} playerX — X игрока
   * @param {number} playerY — Y игрока
   * @returns {boolean|'sleep'} true=полный AI, false=пропуск, 'sleep'=sleep-режим
   */
  shouldFullUpdate(enemy, playerX, playerY) {
    const dx = enemy.x - playerX;
    const dy = enemy.y - playerY;
    const d2 = dx * dx + dy * dy;

    // Близкие враги — полный AI (с лимитом)
    if (d2 < this.FULL_UPDATE_DIST * this.FULL_UPDATE_DIST) {
      if (this._fullAiThisFrame < this.MAX_FULL_AI_PER_FRAME) {
        this._fullAiThisFrame++;
        return true;
      }
      // Лимит превышен — обновляем через кадр
      return (this._frameCounter + (enemy.x | 0)) % 2 === 0;
    }

    // Средняя дистанция — раз в 3 кадра
    if (d2 < this.SKIP_DIST * this.SKIP_DIST) {
      return (this._frameCounter + (enemy.x | 0)) % 3 === 0;
    }

    // Далёкие — раз в 10 кадров (sleep)
    if (d2 < this.SLEEP_DIST * this.SLEEP_DIST) {
      return (this._frameCounter + (enemy.x | 0)) % 10 === 0;
    }

    // Очень далёкие — раз в 20 кадров
    return (this._frameCounter + (enemy.x | 0)) % 20 === 0;
  },

  /**
   * Проверка: враг на экране? (для рендеринга)
   * @param {Object} enemy — Объект с x, y, cfg.w, cfg.h
   * @param {Object} cam — Камера { x, y }
   * @param {number} viewW — Ширина вьюпорта
   * @param {number} viewH — Высота вьюпорта
   * @returns {boolean}
   */
  isOnScreen(enemy, cam, viewW, viewH) {
    const pad = 40;
    const ex = enemy.x - cam.x;
    const ey = enemy.y - cam.y;
    return (ex >= -pad && ex <= viewW + pad && ey >= -pad && ey <= viewH + pad);
  }
};

window.EnemyThrottle = EnemyThrottle;


/* ============================================================
   FPSCounter — Мониторинг FPS (включается через DEBUG_PERF).
   
   Показывает текущий FPS, средний FPS, и время кадра.
   Отображает DOM-элемент в верхнем левом углу.
   ============================================================ */
const FPSCounter = {
  /** @type {boolean} Активен ли счётчик */
  _active: false,
  /** @type {HTMLElement|null} DOM-элемент */
  _el: null,
  /** @type {number[]} Массив последних frameTime для среднего */
  _frameTimes: [],
  /** @type {number} Последний timestamp */
  _lastTime: 0,
  /** @type {number} Счётчик кадров для обновления DOM (раз в 30 кадров) */
  _updateCounter: 0,
  /** @type {number} Текущий FPS */
  fps: 60,
  /** @type {number} Среднее время кадра (ms) */
  frameTime: 16.67,

  /** Инициализировать счётчик (создать DOM-элемент) */
  init() {
    if (!DEBUG_PERF) return;
    this._active = true;
    this._lastTime = performance.now();
    this._frameTimes = new Array(60).fill(16.67);

    // Создаём DOM-элемент
    const el = document.createElement('div');
    el.id = 'fps-counter';
    el.style.cssText = 'position:fixed;top:4px;left:50%;transform:translateX(-50%);' +
      'z-index:99999;background:rgba(0,0,0,0.7);color:#0f0;' +
      'font:bold 11px monospace;padding:2px 6px;border-radius:3px;' +
      'pointer-events:none;white-space:nowrap;';
    el.textContent = 'FPS: 60';
    document.body.appendChild(el);
    this._el = el;
  },

  /** Вызвать каждый кадр (из game loop) */
  tick(ts) {
    if (!this._active) return;
    const dt = ts - this._lastTime;
    this._lastTime = ts;

    // Скользящее окно
    this._frameTimes.push(dt);
    if (this._frameTimes.length > 60) this._frameTimes.shift();

    // Обновляем DOM раз в 30 кадров
    this._updateCounter++;
    if (this._updateCounter >= 30) {
      this._updateCounter = 0;
      let sum = 0;
      for (let i = 0; i < this._frameTimes.length; i++) sum += this._frameTimes[i];
      this.frameTime = sum / this._frameTimes.length;
      this.fps = Math.round(1000 / this.frameTime);
      if (this._el) {
        const color = this.fps >= 55 ? '#0f0' : (this.fps >= 30 ? '#ff0' : '#f00');
        this._el.style.color = color;
        this._el.textContent = `FPS: ${this.fps} | ${this.frameTime.toFixed(1)}ms`;
      }
    }
  },

  /** Уничтожить счётчик */
  destroy() {
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._el = null;
    this._active = false;
  }
};

window.FPSCounter = FPSCounter;


/* ============================================================
   PerfMonitor — Профилирование ключевых секций игрового цикла.
   Замеряет время на: AI, рендеринг, частицы, коллизии.
   ============================================================ */
const PerfMonitor = {
  _active: DEBUG_PERF,
  _sections: {},
  _logInterval: 120, // Раз в 120 кадров (2 сек при 60fps)
  _frameCount: 0,

  /** Начать замер секции */
  begin(name) {
    if (!this._active) return;
    if (!this._sections[name]) {
      this._sections[name] = { total: 0, count: 0, max: 0, _start: 0 };
    }
    this._sections[name]._start = performance.now();
  },

  /** Завершить замер секции */
  end(name) {
    if (!this._active) return;
    const s = this._sections[name];
    if (!s) return;
    const elapsed = performance.now() - s._start;
    s.total += elapsed;
    s.count++;
    if (elapsed > s.max) s.max = elapsed;
  },

  /** Вызывать каждый кадр. Выводит статистику в консоль раз в N кадров. */
  endFrame() {
    if (!this._active) return;
    this._frameCount++;
    if (this._frameCount >= this._logInterval) {
      this._frameCount = 0;
      const lines = ['[PerfMonitor] ---'];
      for (const [name, s] of Object.entries(this._sections)) {
        if (s.count === 0) continue;
        const avg = (s.total / s.count).toFixed(2);
        const max = s.max.toFixed(2);
        lines.push(`  ${name}: avg=${avg}ms, max=${max}ms (${s.count} calls)`);
        // Сброс
        s.total = 0;
        s.count = 0;
        s.max = 0;
      }
      console.log(lines.join('\n'));
    }
  }
};

window.PerfMonitor = PerfMonitor;


/* ============================================================
   VisibilityManager — Управление игровым циклом при фокусе/фоне.
   
   Когда игра сворачивается (вкладка скрыта, приложение в фоне):
   - requestAnimationFrame автоматически замедляется браузером
   - Мы дополнительно ставим игру на паузу (dt=0)
   - При возврате — не допускаем огромного deltaTime
   ============================================================ */
const VisibilityManager = {
  /** @type {boolean} Документ видим? */
  isVisible: true,
  /** @type {boolean} Была ли игра в фоне? */
  _wasHidden: false,

  /** Инициализация слушателей */
  init() {
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      if (document.hidden) {
        this._wasHidden = true;
        // Ставим на паузу музыку
        if (window.GameAudio && GameAudio.pauseMusic) {
          GameAudio.pauseMusic();
        }
      } else {
        // Возвращаемся из фона
        if (this._wasHidden) {
          this._wasHidden = false;
          // Возобновляем музыку, если играли
          if (window.GameAudio && GameAudio.resumeMusic && 
              window.Game && Game.state === 'playing') {
            GameAudio.resumeMusic();
          }
        }
      }
    });

    // iOS: pagehide/pageshow
    window.addEventListener('pagehide', () => { this.isVisible = false; });
    window.addEventListener('pageshow', () => { this.isVisible = true; });
  },

  /**
   * Скорректировать deltaTime с учётом видимости.
   * Если документ был скрыт — dt=0 (пропустить кадр).
   * @param {number} dt — Исходный deltaTime
   * @returns {number} — Скорректированный dt
   */
  adjustDt(dt) {
    if (!this.isVisible) return 0;
    // Если dt слишком большой (возврат из фона) — обрезаем
    if (dt > 0.1) return 0;
    return dt;
  }
};

window.VisibilityManager = VisibilityManager;


/* ============================================================
   AudioPool — Лимит одновременных звуков.
   ============================================================ */
const AudioPool = {
  _pool: [],
  MAX_CONCURRENT: 8,

  canPlay() {
    this._pool = this._pool.filter(s => s.active);
    return this._pool.length < this.MAX_CONCURRENT;
  },

  register(sound) {
    this._pool.push(sound);
  }
};

window.AudioPool = AudioPool;
