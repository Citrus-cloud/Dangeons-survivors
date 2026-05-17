'use strict';
/* ============================================================
   input.js — клавиатура + динамический джойстик.

   Динамический джойстик:
   - При pointerdown в любой точке экрана (вне HUD-кнопок)
     появляется база джойстика в этой точке.
   - При движении — стик смещается до MAX_OFFSET, направление
     движения = нормализованный вектор смещения.
   - При отпускании — джойстик скрывается, движение от него = 0.
   - На десктопе работают WASD/стрелки как альтернатива.
   ============================================================ */

const Input = {
  keys: Object.create(null),

  // Состояние джойстика
  joy: {
    active: false,
    pointerId: null,
    baseX: 0, baseY: 0,
    dx: 0, dy: 0,        // нормализованные -1..1
  },

  // DOM
  joyEl: null,
  stickEl: null,

  init() {
    // Клавиатура
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (window.Game && Game.togglePause) Game.togglePause();
      }
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    // Джойстик
    this.joyEl   = document.getElementById('joystick');
    this.stickEl = this.joyEl.querySelector('.stick');

    // Слушаем события на всём документе (canvas сам не получает touch — у него
    // нет pointer-events когда поверх HUD; но у html/body — получают).
    // Используем capture, чтобы перехватить раньше canvas.
    document.addEventListener('pointerdown', this._onDown.bind(this), { passive: false });
    document.addEventListener('pointermove', this._onMove.bind(this), { passive: false });
    document.addEventListener('pointerup',     this._onUp.bind(this));
    document.addEventListener('pointercancel', this._onUp.bind(this));
  },

  /** Не создавать джойстик, если касание на интерактивном HUD-элементе. */
  _hitsHud(target) {
    if (!target) return false;
    // Любой button или элемент с pointer-events: auto в HUD-области
    let el = target;
    while (el && el !== document.body) {
      if (el.tagName === 'BUTTON') return true;
      if (el.classList && el.classList.contains('overlay')) return true;
      if (el.classList && el.classList.contains('card')) return true;
      el = el.parentElement;
    }
    return false;
  },

  _onDown(e) {
    if (this.joy.active) return;
    if (this._hitsHud(e.target)) return;
    // Игнорируем правую кнопку мыши
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    this.joy.active = true;
    this.joy.pointerId = e.pointerId;
    this.joy.baseX = e.clientX;
    this.joy.baseY = e.clientY;
    this.joy.dx = 0;
    this.joy.dy = 0;

    // Позиционируем DOM-элемент базы
    this.joyEl.style.left = e.clientX + 'px';
    this.joyEl.style.top  = e.clientY + 'px';
    this.joyEl.classList.add('active');
    this.stickEl.style.transform = 'translate(0px, 0px)';

    e.preventDefault();
  },

  _onMove(e) {
    if (!this.joy.active || e.pointerId !== this.joy.pointerId) return;

    const dx = e.clientX - this.joy.baseX;
    const dy = e.clientY - this.joy.baseY;
    const max = CONFIG.JOYSTICK.MAX_OFFSET;
    const len = Math.hypot(dx, dy);

    let ix = dx, iy = dy;
    if (len > max) {
      ix = dx / len * max;
      iy = dy / len * max;
    }
    this.stickEl.style.transform = `translate(${ix}px, ${iy}px)`;

    // Нормализация: длина смещения / max -> 0..1; направление
    const nlen = Math.min(len, max) / max;
    if (nlen < CONFIG.JOYSTICK.DEAD_ZONE) {
      this.joy.dx = 0;
      this.joy.dy = 0;
    } else {
      const nx = len > 0 ? dx / len : 0;
      const ny = len > 0 ? dy / len : 0;
      this.joy.dx = nx * nlen;
      this.joy.dy = ny * nlen;
    }
    e.preventDefault();
  },

  _onUp(e) {
    if (!this.joy.active || (e.pointerId !== undefined && e.pointerId !== this.joy.pointerId)) return;
    this.joy.active = false;
    this.joy.pointerId = null;
    this.joy.dx = 0;
    this.joy.dy = 0;
    this.joyEl.classList.remove('active');
    this.stickEl.style.transform = 'translate(0px, 0px)';
  },

  /** Желаемый вектор движения (нормализованный, |v| 0..1). */
  getMove() {
    let dx = 0, dy = 0;
    // Джойстик имеет приоритет
    if (this.joy.active && (this.joy.dx !== 0 || this.joy.dy !== 0)) {
      dx = this.joy.dx;
      dy = this.joy.dy;
    } else {
      if (this.keys['KeyW'] || this.keys['ArrowUp'])    dy -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown'])  dy += 1;
      if (this.keys['KeyA'] || this.keys['ArrowLeft'])  dx -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
    }
    return { x: dx, y: dy };
  },

  /** Принудительно отпустить джойстик (например, при переходе в pause/levelup). */
  releaseJoystick() {
    this._onUp({ pointerId: this.joy.pointerId });
  },
};

window.Input = Input;
