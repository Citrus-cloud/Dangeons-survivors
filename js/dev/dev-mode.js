'use strict';
/* ============================================================
   dev-mode.js — Скрытый режим разработчика.
   
   Активация: удержание кнопки «Гильдия» в лагере 10 секунд →
   поле ввода пароля → "magomed2002" → панель DEV MODE.
   
   Функционал:
   • +10 000 золота (мета-прогресс)
   • Бесконечное HP (God Mode) — window.__DEV_GODMODE
   • Множитель опыта ×1000 — window.__DEV_XP_MULTIPLIER
   
   Чит-эффекты НЕ сохраняются в safeStorage (только в памяти).
   При перезагрузке страницы всё сбрасывается.
   
   Экспорт: window.DevMode
   ============================================================ */

const DevMode = {
  // Состояние
  _holdTimer: null,
  _holdDuration: 10000, // 10 секунд удержания
  _isUnlocked: false,
  _passwordOverlay: null,
  _devPanel: null,
  _previousGameState: null, // для паузы при открытии панели

  /* ============================================================
     ИНИЦИАЛИЗАЦИЯ — привязка к кнопке Гильдии
     ============================================================ */
  init() {
    // Ждём создания camp overlay (кнопка создаётся динамически)
    this._waitForGuildButton();
  },

  /**
   * Ожидание появления кнопки гильдии в DOM.
   * Camp overlay строится лениво, поэтому нужен MutationObserver.
   */
  _waitForGuildButton() {
    const tryAttach = () => {
      const btn = document.getElementById('campGuildBtn');
      if (btn) {
        this._attachLongPress(btn);
        return true;
      }
      return false;
    };

    // Попробуем сразу
    if (tryAttach()) return;

    // Если не нашли — наблюдаем за DOM
    const observer = new MutationObserver(() => {
      if (tryAttach()) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  },

  /**
   * Привязка обработчиков длительного нажатия к кнопке.
   * Работает для мыши и сенсорных устройств.
   */
  _attachLongPress(btn) {
    // Предотвращаем повторную привязку
    if (btn._devModeAttached) return;
    btn._devModeAttached = true;

    const startHold = (e) => {
      // Предотвращаем выделение текста на мобильных
      if (e.type === 'touchstart') {
        e.preventDefault();
      }
      this._clearHoldTimer();
      this._holdTimer = setTimeout(() => {
        this._onLongPressComplete();
      }, this._holdDuration);
    };

    const cancelHold = () => {
      this._clearHoldTimer();
    };

    // Mouse events
    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('mouseup', cancelHold);
    btn.addEventListener('mouseleave', cancelHold);

    // Touch events
    btn.addEventListener('touchstart', startHold, { passive: false });
    btn.addEventListener('touchend', cancelHold);
    btn.addEventListener('touchcancel', cancelHold);
    btn.addEventListener('touchmove', cancelHold);
  },

  _clearHoldTimer() {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  },

  /**
   * Вызывается после 10 секунд удержания.
   * Если уже разблокировано — сразу открывает панель.
   * Иначе — показывает поле ввода пароля.
   */
  _onLongPressComplete() {
    if (this._isUnlocked) {
      this._showDevPanel();
    } else {
      this._showPasswordOverlay();
    }
  },

  /* ============================================================
     ПОЛЕ ВВОДА ПАРОЛЯ
     ============================================================ */
  _showPasswordOverlay() {
    if (this._passwordOverlay) {
      this._passwordOverlay.classList.add('active');
      const input = this._passwordOverlay.querySelector('.dev-password-input');
      if (input) { input.value = ''; input.focus(); }
      return;
    }

    const ov = document.createElement('div');
    ov.className = 'dev-password-overlay';
    ov.innerHTML = `
      <div class="dev-password-backdrop"></div>
      <div class="dev-password-box">
        <div class="dev-password-title">Enter developer code</div>
        <input type="password" class="dev-password-input" autocomplete="off" autocorrect="off" spellcheck="false" />
        <div class="dev-password-error"></div>
        <div class="dev-password-buttons">
          <button class="dev-password-ok btn">OK</button>
          <button class="dev-password-cancel btn btn-secondary">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    this._passwordOverlay = ov;

    // Блокируем взаимодействие с фоном
    ov.querySelector('.dev-password-backdrop').addEventListener('click', () => {
      this._hidePasswordOverlay();
    });

    const input = ov.querySelector('.dev-password-input');
    const okBtn = ov.querySelector('.dev-password-ok');
    const cancelBtn = ov.querySelector('.dev-password-cancel');
    const errorEl = ov.querySelector('.dev-password-error');

    const submitCode = () => {
      const code = input.value;
      if (code === 'magomed2002') {
        this._isUnlocked = true;
        this._hidePasswordOverlay();
        this._showDevPanel();
      } else {
        // Неверный код
        input.value = '';
        errorEl.textContent = 'Invalid code';
        errorEl.style.opacity = '1';
        setTimeout(() => {
          errorEl.style.opacity = '0';
        }, 2000);
      }
    };

    okBtn.addEventListener('click', submitCode);
    cancelBtn.addEventListener('click', () => this._hidePasswordOverlay());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitCode();
      if (e.key === 'Escape') this._hidePasswordOverlay();
    });

    // Показать с фокусом
    ov.classList.add('active');
    setTimeout(() => input.focus(), 50);

    // Пауза если в забеге
    this._pauseIfPlaying();
  },

  _hidePasswordOverlay() {
    if (this._passwordOverlay) {
      this._passwordOverlay.classList.remove('active');
    }
    this._resumeIfWasPaused();
  },

  /* ============================================================
     ПАНЕЛЬ РАЗРАБОТЧИКА (DEV PANEL)
     ============================================================ */
  _showDevPanel() {
    if (this._devPanel) {
      this._updateDevPanelState();
      this._devPanel.classList.add('active');
      this._pauseIfPlaying();
      return;
    }

    const panel = document.createElement('div');
    panel.className = 'dev-panel-overlay';
    panel.innerHTML = `
      <div class="dev-panel-backdrop"></div>
      <div class="dev-panel-box">
        <h1 class="dev-panel-title">DEV MODE</h1>
        <div class="dev-panel-content">
          
          <!-- Золото -->
          <div class="dev-panel-section">
            <button class="dev-btn dev-btn-gold" id="devAddGold">+10 000 золота</button>
          </div>

          <!-- Бесконечное HP -->
          <div class="dev-panel-section">
            <label class="dev-toggle">
              <input type="checkbox" id="devGodMode" />
              <span class="dev-toggle-slider"></span>
              <span class="dev-toggle-label">Бесконечное HP</span>
            </label>
            <div class="dev-status" id="devGodStatus">OFF</div>
          </div>

          <!-- Множитель опыта -->
          <div class="dev-panel-section">
            <div class="dev-xp-row">
              <button class="dev-btn dev-btn-xp" id="devXP1000">Множитель опыта ×1000</button>
              <button class="dev-btn dev-btn-reset" id="devXPReset">Сброс (×1)</button>
            </div>
            <div class="dev-status" id="devXPStatus">×1</div>
          </div>

        </div>
        <button class="dev-btn dev-btn-close" id="devClose">Закрыть</button>
      </div>
    `;
    document.body.appendChild(panel);
    this._devPanel = panel;

    // Событие закрытия по бэкдропу
    panel.querySelector('.dev-panel-backdrop').addEventListener('click', () => {
      this._hideDevPanel();
    });

    // --- Обработчики кнопок ---

    // +10 000 золота
    panel.querySelector('#devAddGold').addEventListener('click', () => {
      this._addGold(10000);
    });

    // God Mode toggle
    const godCheckbox = panel.querySelector('#devGodMode');
    godCheckbox.addEventListener('change', () => {
      window.__DEV_GODMODE = godCheckbox.checked;
      this._updateDevPanelState();
    });

    // XP ×1000
    panel.querySelector('#devXP1000').addEventListener('click', () => {
      window.__DEV_XP_MULTIPLIER = 1000;
      this._updateDevPanelState();
    });

    // XP Сброс
    panel.querySelector('#devXPReset').addEventListener('click', () => {
      window.__DEV_XP_MULTIPLIER = 1;
      this._updateDevPanelState();
    });

    // Закрыть
    panel.querySelector('#devClose').addEventListener('click', () => {
      this._hideDevPanel();
    });

    // Инициализация состояния UI
    this._updateDevPanelState();
    panel.classList.add('active');
    this._pauseIfPlaying();
  },

  _hideDevPanel() {
    if (this._devPanel) {
      this._devPanel.classList.remove('active');
    }
    this._resumeIfWasPaused();
  },

  /**
   * Обновить отображение текущего состояния чит-флагов в панели.
   */
  _updateDevPanelState() {
    if (!this._devPanel) return;

    const godCheckbox = this._devPanel.querySelector('#devGodMode');
    const godStatus = this._devPanel.querySelector('#devGodStatus');
    const xpStatus = this._devPanel.querySelector('#devXPStatus');

    if (godCheckbox) {
      godCheckbox.checked = !!window.__DEV_GODMODE;
    }
    if (godStatus) {
      godStatus.textContent = window.__DEV_GODMODE ? 'ON' : 'OFF';
      godStatus.className = 'dev-status ' + (window.__DEV_GODMODE ? 'dev-status-on' : '');
    }
    if (xpStatus) {
      const mul = window.__DEV_XP_MULTIPLIER || 1;
      xpStatus.textContent = '×' + mul;
      xpStatus.className = 'dev-status ' + (mul > 1 ? 'dev-status-on' : '');
    }
  },

  /* ============================================================
     ДЕЙСТВИЯ
     ============================================================ */

  /**
   * Добавить золото в мета-прогресс.
   * Обновляет отображение в лагере.
   */
  _addGold(amount) {
    if (window.MetaProgress && MetaProgress.data) {
      MetaProgress.data.gold = (MetaProgress.data.gold || 0) + amount;
      MetaProgress.save();
      // Обновить UI лагеря если открыт
      const goldEl = document.getElementById('campGoldVal');
      if (goldEl) goldEl.textContent = MetaProgress.data.gold;
      // Обновить UI талантов если открыт
      const talentGold = document.getElementById('talentGoldVal');
      if (talentGold) talentGold.textContent = MetaProgress.data.gold;
    }
    // Также добавить к runGold если в забеге
    if (window.Game && (Game.state === 'playing' || Game.state === 'paused')) {
      Game.runGold = (Game.runGold || 0) + amount;
    }
  },

  /* ============================================================
     ПАУЗА / ВОЗОБНОВЛЕНИЕ
     ============================================================ */

  /**
   * Приостановить игру если сейчас в забеге.
   */
  _pauseIfPlaying() {
    if (window.Game && Game.state === 'playing') {
      this._previousGameState = 'playing';
      Game.state = 'paused';
      if (window.Input) Input.releaseJoystick();
      if (window.GameAudio) GameAudio.pauseMusic();
    } else {
      this._previousGameState = null;
    }
  },

  /**
   * Возобновить игру если она была приостановлена этим модулем.
   */
  _resumeIfWasPaused() {
    if (this._previousGameState === 'playing' && window.Game && Game.state === 'paused') {
      Game.state = 'playing';
      if (window.GameAudio) GameAudio.resumeMusic();
    }
    this._previousGameState = null;
  },
};

// Глобальные флаги (начальные значения)
if (window.__DEV_GODMODE === undefined) window.__DEV_GODMODE = false;
if (window.__DEV_XP_MULTIPLIER === undefined) window.__DEV_XP_MULTIPLIER = 1;

window.DevMode = DevMode;

// Инициализация после загрузки страницы
// (файл загружается после hud.js, но camp overlay может быть ещё не создан)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => DevMode.init());
} else {
  DevMode.init();
}
