'use strict';
/* ============================================================
   main.js — точка входа: инициализация, состояния, игровой цикл.
   ============================================================ */

/* Фабрика для частиц (визуальные следы и эффекты смерти). */
function createParticle() {
  return {
    active: false,
    x: 0, y: 0,
    vx: 0, vy: 0,
    life: 0, maxLife: 0,
    color: '#888',
    size: 3,
  };
}
window.createParticle = createParticle;


/* ============================================================
   Базовые улучшения (как в Шаге 1, по ТЗ — пусть стакаются).
   Каждое имеет id, title, desc, apply(player) и available(player)
   (можно ли предложить — например, +1 missile всегда доступен,
   а HP — тоже всегда).
   ============================================================ */
const BASIC_UPGRADES = [
  { id: 'b_maxhp',     icon: '❤', title: 'Здоровье +20',     desc: 'Макс. HP +20 (восполняется на ту же величину).',
    apply(p) { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); }, available() { return true; } },
  { id: 'b_damage',    icon: '⚔', title: 'Урон +15%',         desc: 'Весь урон увеличен на 15%.',
    apply(p) { p.damageMul *= 1.15; }, available() { return true; } },
  { id: 'b_speed',     icon: '➤', title: 'Скорость +10%',     desc: 'Скорость передвижения +10%.',
    apply(p) { p.speedMul *= 1.10; }, available() { return true; } },
  { id: 'b_weapon_cd', icon: '⏱', title: 'Скорострельность',  desc: 'Кулдаун всех оружий -10%.',
    apply(p) { p.weaponCdMul *= 0.90; }, available() { return true; } },
  { id: 'b_missile_cd',icon: '✦', title: 'Магия чаще',        desc: 'Кулдаун магического снаряда -25%.',
    apply(p) { p.missileCdMul *= 0.75; }, available() { return true; } },
  { id: 'b_pickup',    icon: '◎', title: 'Радиус подбора +30%', desc: 'Радиус притяжения опыта +30%.',
    apply(p) { p.pickupMul *= 1.30; }, available() { return true; } },
  { id: 'b_multishot', icon: '✶', title: '+1 снаряд',          desc: 'Magic Missile выпускает +1 снаряд.',
    apply(p) { p.missileCount += 1; }, available() { return true; } },
  { id: 'b_heal',      icon: '✚', title: 'Восстановление 30%', desc: 'Мгновенно восстанавливает 30% макс. HP.',
    apply(p) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.30); }, available() { return true; } },
];


/* ============================================================
   Game — основной объект. Делает всё, что не вошло в подмодули:
   состояние, цикл, спавн волн, левелап-пул.
   ============================================================ */
const Game = {
  // canvas
  canvas: null, ctx: null,
  viewW: 0, viewH: 0, dpr: 1,

  // state: 'menu' | 'playing' | 'paused' | 'levelup' | 'gameover'
  state: 'menu',

  // мир
  player: null,
  enemies: null,
  projectiles: null,
  xpDrops: null,
  particles: null,

  // тайминги
  lastTs: 0,
  runTime: 0,
  waveIndex: 0,
  waveTimer: 0,
  kills: 0,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Пулы
    this.enemies     = new ObjectPool(createEnemy,      CONFIG.POOLS.ENEMIES);
    this.projectiles = new ObjectPool(createProjectile, CONFIG.POOLS.PROJECTILES);
    this.xpDrops     = new ObjectPool(createXP,         CONFIG.POOLS.XP);
    this.particles   = new ObjectPool(createParticle,   CONFIG.POOLS.PARTICLES);

    GameMap.precompute();
    Input.init();
    GameAudio.init();

    // UI bindings
    document.getElementById('startBtn').addEventListener('click',   () => this.startNewGame());
    document.getElementById('restartBtn').addEventListener('click', () => this.startNewGame());
    document.getElementById('resumeBtn').addEventListener('click',  () => this.togglePause());
    document.getElementById('pauseBtn').addEventListener('click',   () => this.togglePause());

    this.lastTs = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.viewW = w;
    this.viewH = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  /* ----- состояния ----- */
  startNewGame() {
    this.enemies.clearAll();
    this.projectiles.clearAll();
    this.xpDrops.clearAll();
    this.particles.clearAll();

    this.kills = 0;
    this.runTime = 0;
    this.waveIndex = 0;
    this.waveTimer = CONFIG.WAVE.INITIAL_DELAY;

    this.player = Player.create();

    UI.hideAll();
    this.state = 'playing';
  },

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      Input.releaseJoystick();
      UI.showPause();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      UI.hideAll();
    }
  },

  triggerLevelUp() {
    const choices = this.buildLevelUpChoices(3);
    if (choices.length === 0) {
      // Всё прокачано — просто +10% HP без паузы
      const p = this.player;
      const add = p.maxHp * 0.10;
      p.maxHp += add;
      p.hp = Math.min(p.maxHp, p.hp + add);
      return;
    }
    this.state = 'levelup';
    Input.releaseJoystick();
    UI.showLevelUp(this.player.level, choices, (chosen) => {
      if (chosen) chosen.apply(this.player);
      UI.hideAll();
      this.state = 'playing';
    });
  },

  /**
   * Собираем все доступные варианты для левелапа и отдаём n случайных.
   * Виды карт:
   *  - 'basic'   — базовые улучшения (всегда доступны)
   *  - 'weapon'  — новое оружие (если есть свободный слот) или
   *                апгрейд существующего (level < max)
   *  - 'ability' — новая пассивка или апгрейд
   */
  buildLevelUpChoices(n) {
    const p = this.player;
    const all = [];

    // 1) Новое оружие (если слот свободен)
    if (Player.hasFreeWeaponSlot(p)) {
      for (const info of WEAPON_INFO) {
        if (Player.findWeapon(p, info.id)) continue; // уже есть — не предлагать "новое"
        all.push({
          kind: 'weapon',
          icon: info.icon,
          title: `Новое: ${info.name}`,
          desc: info.desc,
          apply(player) {
            const w = WEAPON_FACTORIES[info.id]();
            Player.addWeapon(player, w);
          },
        });
      }
    }

    // 2) Апгрейд существующего оружия
    for (const w of p.weaponSlots) {
      if (!w) continue;
      if (w.level >= w.maxLevel) continue;
      const next = w.level + 1;
      all.push({
        kind: 'weapon',
        icon: w.icon,
        title: `${w.name} ${Utils.roman(w.level)} → ${Utils.roman(next)}`,
        desc: '+15% урона, -5% кулдауна.',
        apply(player) {
          const tgt = Player.findWeapon(player, w.id);
          if (tgt) tgt.upgrade();
        },
      });
    }

    // 3) Новая пассивка
    if (Player.hasFreeAbilitySlot(p)) {
      for (const info of ABILITY_INFO) {
        if (Player.findAbility(p, info.id)) continue;
        all.push({
          kind: 'ability',
          icon: info.icon,
          title: `Новая: ${info.name}`,
          desc: info.desc,
          apply(player) {
            const a = ABILITY_FACTORIES[info.id]();
            Player.addAbility(player, a);
          },
        });
      }
    }

    // 4) Апгрейд пассивки
    for (const a of p.abilitySlots) {
      if (!a) continue;
      if (a.level >= a.maxLevel) continue;
      const next = a.level + 1;
      all.push({
        kind: 'ability',
        icon: a.icon,
        title: `${a.name} ${Utils.roman(a.level)} → ${Utils.roman(next)}`,
        desc: a.desc,
        apply(player) {
          const tgt = Player.findAbility(player, a.id);
          if (tgt) tgt.upgrade(player);
        },
      });
    }

    // 5) Базовые улучшения (всегда доступны и стакаются)
    for (const u of BASIC_UPGRADES) {
      if (!u.available(p)) continue;
      all.push({
        kind: 'basic',
        icon: u.icon,
        title: u.title,
        desc: u.desc,
        apply(player) { u.apply(player); },
      });
    }

    // Случайные n без повторений
    const out = [];
    const pool = all.slice();
    for (let i = 0; i < n && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  },

  triggerGameOver() {
    this.state = 'gameover';
    Input.releaseJoystick();
    UI.showGameOver({
      time: Utils.formatTime(this.runTime),
      kills: this.kills,
      level: this.player.level,
    });
  },

  /* ----- игровой цикл ----- */
  loop(ts) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    if (this.state === 'playing') this.update(dt);
    this.render();
    UI.tick(this);
    requestAnimationFrame((t) => this.loop(t));
  },

  update(dt) {
    this.runTime += dt;

    Player.update(this.player, dt);
    this.updateWaves(dt);
    Enemies.update(this.enemies, this.player, dt);

    // Оружия в слотах
    const weaponHelpers = {
      damageEnemy: (e, dmg) => this.damageEnemy(e, dmg),
    };
    for (const w of this.player.weaponSlots) {
      if (!w) continue;
      // Меч имеет визуальный таймер — отдельный tick
      if (typeof w.tick === 'function') w.tick(dt);
      w.update(this.player, this.enemies, this.projectiles, dt, weaponHelpers);
    }

    // Встроенный Magic Missile (не в слотах)
    this.updateBuiltInMissile(dt);

    // Снаряды
    const cam = GameMap.getCamera(this.player, this.viewW, this.viewH);
    Projectiles.update(
      this.projectiles, this.enemies, cam, this.viewW, this.viewH,
      (e, dmg) => this.damageEnemy(e, dmg),
      dt
    );

    // Лут и частицы
    Loot.update(this.xpDrops, this.player, dt);
    this.updateParticles(dt);

    // Левелап
    if (this.player.xp >= this.player.xpNext) {
      this.player.xp -= this.player.xpNext;
      this.player.level += 1;
      this.player.xpNext = Math.floor(CONFIG.XP.BASE * Math.pow(CONFIG.XP.GROWTH, this.player.level - 1));
      this.triggerLevelUp();
    }

    // Смерть
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.triggerGameOver();
    }
  },

  updateBuiltInMissile(/* dt */) {
    const p = this.player;
    if (p.missileCd > 0) return;

    // Направление: по движению / по ближайшему врагу / по facing
    let dir;
    const move = Input.getMove();
    if (Math.hypot(move.x, move.y) > 0.05) {
      dir = Utils.norm(move.x, move.y);
    } else {
      const t = Projectiles.findNearestEnemy(this.enemies, p.x, p.y, Infinity);
      dir = t ? Utils.norm(t.x - p.x, t.y - p.y) : { x: p.facing.x, y: p.facing.y };
    }

    const count = p.missileCount;
    const spread = CONFIG.MISSILE.SPREAD;
    const baseAngle = Math.atan2(dir.y, dir.x);
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * spread;
      const a = baseAngle + off;
      const pr = this.projectiles.spawn();
      if (!pr) break;
      pr.kind = 'missile';
      pr.x = p.x; pr.y = p.y;
      pr.vx = Math.cos(a) * CONFIG.MISSILE.SPEED;
      pr.vy = Math.sin(a) * CONFIG.MISSILE.SPEED;
      pr.life = CONFIG.MISSILE.LIFETIME;
      pr.damage = CONFIG.MISSILE.DAMAGE * p.damageMul;
      pr.radius = CONFIG.MISSILE.RADIUS;
      pr.angle = a;
      pr.source = 'missile';
    }
    p.missileCd = CONFIG.MISSILE.COOLDOWN * p.missileCdMul;
  },

  updateWaves(dt) {
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveIndex += 1;
      const count = CONFIG.WAVE.BASE + this.waveIndex * CONFIG.WAVE.PER_WAVE;
      Enemies.spawnWave(this.enemies, this.player, count);
      this.waveTimer = CONFIG.WAVE.INTERVAL;
    }
  },

  damageEnemy(e, dmg) {
    e.hp -= dmg;
    e.flash = 0.08;
    if (e.hp <= 0) this.killEnemy(e);
  },

  killEnemy(e) {
    e.active = false;
    this.kills += 1;
    Loot.dropXP(this.xpDrops, e.x, e.y, Utils.randInt(CONFIG.ENEMY.XP_MIN, CONFIG.ENEMY.XP_MAX));
    // Частицы смерти
    const count = Utils.randInt(3, 5);
    for (let i = 0; i < count; i++) {
      const pa = this.particles.spawn();
      if (!pa) break;
      pa.x = e.x; pa.y = e.y;
      const a = Math.random() * Math.PI * 2;
      const sp = Utils.rand(40, 110);
      pa.vx = Math.cos(a) * sp;
      pa.vy = Math.sin(a) * sp;
      pa.life = pa.maxLife = Utils.rand(0.4, 0.7);
      pa.color = '#888';
      pa.size = Utils.rand(2, 4);
    }
  },

  spawnTrailParticle(player, move) {
    const tp = this.particles.spawn();
    if (!tp) return;
    tp.x = player.x; tp.y = player.y;
    tp.vx = -move.x * 20 + Utils.rand(-10, 10);
    tp.vy = -move.y * 20 + Utils.rand(-10, 10);
    tp.life = tp.maxLife = 0.35;
    tp.color = 'rgba(120,170,255,0.5)';
    tp.size = 4;
  },

  updateParticles(dt) {
    const items = this.particles.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  },

  /* ----- рендер ----- */
  render() {
    const ctx = this.ctx;
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    if (!this.player) return;

    const cam = GameMap.getCamera(this.player, this.viewW, this.viewH);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    GameMap.render(ctx, cam, this.viewW, this.viewH);
    Loot.render(ctx, this.xpDrops, cam, this.viewW, this.viewH);
    this.renderParticles(ctx, cam);
    Enemies.render(ctx, this.enemies, cam, this.viewW, this.viewH);
    Player.render(ctx, this.player);

    // Оверлей оружий поверх героя (например, взмах меча)
    for (const w of this.player.weaponSlots) {
      if (w && typeof w.renderOverlay === 'function') w.renderOverlay(ctx, this.player);
    }

    Projectiles.render(ctx, this.projectiles, cam, this.viewW, this.viewH);

    ctx.restore();
  },

  renderParticles(ctx, cam) {
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + this.viewW, maxY = cam.y + this.viewH;
    const items = this.particles.items;
    for (let i = 0; i < items.length; i++) {
      const pa = items[i];
      if (!pa.active) continue;
      if (pa.x < minX - 10 || pa.x > maxX + 10 || pa.y < minY - 10 || pa.y > maxY + 10) continue;
      const a = Math.max(0, pa.life / pa.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = pa.color;
      ctx.fillRect(pa.x - pa.size * 0.5, pa.y - pa.size * 0.5, pa.size, pa.size);
      ctx.globalAlpha = 1;
    }
  },
};

window.Game = Game;


/* ============================================================
   BOOT
   ============================================================ */
window.addEventListener('load', () => {
  UI.init();
  Game.init();
});
