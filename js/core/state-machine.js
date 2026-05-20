'use strict';


/* ============================================================
   FAVICON & ICON GENERATOR — programmatic d20 icon
   ============================================================ */
const IconGenerator = {
  generate(size) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');

    // Background
    ctx.fillStyle = '#1a1210';
    ctx.fillRect(0, 0, size, size);

    // Draw d20 shape (hexagon approximation)
    const cx = size / 2, cy = size / 2;
    const r = size * 0.38;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#2a1f14';
    ctx.fill();
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = size * 0.04;
    ctx.stroke();

    // Inner triangle lines
    ctx.strokeStyle = 'rgba(201,168,76,0.3)';
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.7);
    ctx.lineTo(cx - r * 0.6, cy + r * 0.5);
    ctx.lineTo(cx + r * 0.6, cy + r * 0.5);
    ctx.closePath();
    ctx.stroke();

    // Number "20"
    ctx.fillStyle = '#c9a84c';
    ctx.font = `bold ${size * 0.3}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('20', cx, cy + size * 0.02);

    return c.toDataURL('image/png');
  },

  install() {
    const favicon32 = this.generate(32);
    const favicon64 = this.generate(64);
    const icon192 = this.generate(192);

    const faviconEl = document.getElementById('favicon');
    if (faviconEl) faviconEl.href = favicon64;

    const touchEl = document.getElementById('touchIcon');
    if (touchEl) touchEl.href = icon192;
  }
};

window.IconGenerator = IconGenerator;


/* ============================================================
   TITLE SCREEN
   ============================================================ */
const TitleScreen = {
  el: null,
  shown: false,
  autoTimer: null,

  init() {
    this.el = document.getElementById('titleScreen');
    if (!this.el) return;

    // Check if first launch
    const launched = SafeStorage.getItem('d20_firstLaunch');
    if (launched) {
      // Not first launch — skip title screen
      this.el.classList.add('hidden');
      this.shown = true;
      return;
    }

    // First launch — show title, draw runes
    this._drawRunes();
    this.shown = false;

    // Event listeners for dismissal
    const dismiss = () => {
      if (this.shown) return;
      this.shown = true;
      SafeStorage.setItem('d20_firstLaunch', '1');
      this.el.style.transition = 'opacity 0.5s ease';
      this.el.style.opacity = '0';
      setTimeout(() => {
        this.el.classList.add('hidden');
        this.el.style.opacity = '';
        // Start the game (show camp)
        Game._afterTitleDismissed();
      }, 500);
      if (this.autoTimer) clearTimeout(this.autoTimer);
    };

    this.el.addEventListener('click', dismiss);
    this.el.addEventListener('touchstart', dismiss, { passive: true });

    // Auto-dismiss after 4 seconds
    this.autoTimer = setTimeout(dismiss, 4000);
  },

  _drawRunes() {
    const runesEl = document.getElementById('titleRunes');
    if (!runesEl) return;
    // Draw decorative rune SVG lines on canvas
    const c = document.createElement('canvas');
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    const ctx = c.getContext('2d');
    ctx.strokeStyle = 'rgba(201,168,76,0.5)';
    ctx.lineWidth = 1;

    // Draw cracks / rune lines
    const numLines = 12;
    for (let i = 0; i < numLines; i++) {
      ctx.beginPath();
      let x = Math.random() * c.width;
      let y = Math.random() * c.height;
      ctx.moveTo(x, y);
      const segs = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < segs; j++) {
        x += (Math.random() - 0.5) * 120;
        y += (Math.random() - 0.5) * 120;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Draw rune symbols at intersections
    const runes = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᛁ', 'ᛃ', 'ᛈ'];
    ctx.font = '16px serif';
    ctx.fillStyle = 'rgba(201,168,76,0.4)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 8; i++) {
      const rx = Math.random() * c.width;
      const ry = Math.random() * c.height;
      ctx.fillText(runes[Math.floor(Math.random() * runes.length)], rx, ry);
    }

    runesEl.appendChild(c);
  },

  isActive() {
    return !this.shown;
  }
};

window.TitleScreen = TitleScreen;


/* ============================================================
   LOADING SCREEN
   ============================================================ */
const LoadingScreen = {
  el: null,
  dieEl: null,
  _interval: null,

  init() {
    this.el = document.getElementById('loadingScreen');
    this.dieEl = document.getElementById('loadingDie');
  },

  show() {
    if (!this.el) return;
    this.el.classList.add('active');
    // Animate number
    this._interval = setInterval(() => {
      if (this.dieEl) this.dieEl.textContent = String(1 + Math.floor(Math.random() * 20));
    }, 100);
  },

  hide() {
    if (!this.el) return;
    this.el.classList.remove('active');
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
  }
};

window.LoadingScreen = LoadingScreen;


/* ============================================================
   BOOT
   ============================================================ */
window.addEventListener('load', () => {
  // Generate and install favicon/icons
  IconGenerator.install();

  // Initialize loading screen
  LoadingScreen.init();

  // Initialize UI
  UI.init();

  // Bestiary back-button fix
  const _bfix = document.createElement('style');
  _bfix.textContent = '.bestiary-back-btn{position:absolute!important;top:12px;right:12px;z-index:10;min-width:80px;text-align:center}';
  document.head.appendChild(_bfix);

  // Initialize title screen
  TitleScreen.init();

  // If title was skipped (not first launch), boot game immediately
  if (TitleScreen.shown) {
    Game.init();
  }
  // Otherwise, Game.init() will be called after title dismissal via _afterTitleDismissed

  // Prevent context menu on long press (for mobile WebView)
  document.addEventListener('contextmenu', (e) => e.preventDefault());
});
