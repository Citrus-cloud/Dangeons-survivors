'use strict';
/* ============================================================
   weapons_extended.js — Шаг 9-10:
   - 21 новых эволюционных оружий
   - 5 эксклюзивных (легендарных) оружий
   - 5 супер-эволюций
   ============================================================ */

/* ============================================================
   НОВЫЕ ЭВОЛЮЦИОННЫЕ ОРУЖИЯ (21 штук)
   ============================================================ */

/* --- Кровопускатель (Секира + Жажда крови) --- */
class BloodletterWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'bloodletter', name: 'Кровопускатель', type: 'melee', baseCooldown: 0.9, baseDamage: 24, icon: '🪓', evolvedFrom: 'axe' });
    this.radius = 70; this.arc = Math.PI; this.swingTime = 0.20; this.lifesteal = 5;
    this.swing = { active: false, t: 0, angle: 0 };
  }
  tick(dt) { if (this.swing.active) { this.swing.t += dt; if (this.swing.t >= this.swingTime) this.swing.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.radius);
    if (!target) return false;
    const damage = this.damageAt() * this.totalDamageMul(player);
    const dirAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const halfArc = this.arc * 0.5; const r2 = this.radius * this.radius;
    let hits = 0;
    for (let i = 0; i < enemies.items.length; i++) {
      const e = enemies.items[i]; if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy > r2) continue;
      let diff = Math.atan2(dy, dx) - dirAngle;
      while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) { helpers.damageEnemy(e, damage); hits++; }
    }
    if (hits > 0) player.hp = Math.min(player.maxHp, player.hp + this.lifesteal * hits);
    this.swing.active = true; this.swing.t = 0; this.swing.angle = dirAngle;
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.swing.active) return;
    const t = this.swing.t / this.swingTime; const alpha = (1 - t) * 0.9;
    ctx.strokeStyle = `rgba(180,20,20,${alpha})`; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, this.swing.angle - this.arc * 0.5, this.swing.angle + this.arc * 0.5); ctx.stroke();
  }
}

/* --- Пронзатель (Копьё + Критический удар) --- */
class PiercerWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'piercer', name: 'Пронзатель', type: 'melee', baseCooldown: 0.8, baseDamage: 22, icon: '⚜', evolvedFrom: 'spear' });
    this.range = 150; this.width = 24; this.critChance = 0.30; this.thrustTime = 0.15;
    this.thrust = { active: false, t: 0, angle: 0 };
  }
  tick(dt) { if (this.thrust.active) { this.thrust.t += dt; if (this.thrust.t >= this.thrustTime) this.thrust.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range + 30);
    if (!target) return false;
    let damage = this.damageAt() * this.totalDamageMul(player);
    if (Math.random() < this.critChance) damage *= 2;
    const dirAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const cos = Math.cos(dirAngle), sin = Math.sin(dirAngle);
    for (let i = 0; i < enemies.items.length; i++) {
      const e = enemies.items[i]; if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const along = dx * cos + dy * sin; const across = -dx * sin + dy * cos;
      if (along >= 0 && along <= this.range && Math.abs(across) <= this.width / 2) helpers.damageEnemy(e, damage);
    }
    this.thrust.active = true; this.thrust.t = 0; this.thrust.angle = dirAngle;
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.thrust.active) return;
    const t = this.thrust.t / this.thrustTime; const alpha = (1 - t) * 0.9;
    ctx.save(); ctx.translate(player.x, player.y); ctx.rotate(this.thrust.angle);
    ctx.strokeStyle = `rgba(255,215,0,${alpha})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(this.range, 0); ctx.stroke();
    ctx.restore();
  }
}

/* --- Молот титана (Молот + Укрепление) --- */
class TitanHammerWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'titan_hammer', name: 'Молот титана', type: 'melee', baseCooldown: 1.4, baseDamage: 24, icon: '⚒', evolvedFrom: 'hammer' });
    this.radius = 90; this.slamTime = 0.25; this.slam = { active: false, t: 0 };
    this._killCount = 0; this._bonusHp = 0; this._bonusTimer = 0;
  }
  tick(dt) {
    if (this.slam.active) { this.slam.t += dt; if (this.slam.t >= this.slamTime) this.slam.active = false; }
    if (this._bonusTimer > 0) { this._bonusTimer -= dt; if (this._bonusTimer <= 0) this._bonusHp = 0; }
  }
  doAttack(player, enemies, _proj, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.radius);
    if (!target) return false;
    const damage = this.damageAt() * this.totalDamageMul(player); const r2 = this.radius * this.radius;
    for (let i = 0; i < enemies.items.length; i++) {
      const e = enemies.items[i]; if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy <= r2) helpers.damageEnemy(e, damage);
    }
    this.slam.active = true; this.slam.t = 0;
    if (window.Particles) Particles.ring(player.x, player.y, this.radius, 0.25, 'rgba(200,170,50,0.7)', 4);
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.slam.active) return;
    const t = this.slam.t / this.slamTime; const alpha = (1 - t) * 0.6;
    ctx.strokeStyle = `rgba(200,170,50,${alpha})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius * t, 0, Math.PI * 2); ctx.stroke();
  }
}

/* --- Бич боли (Кнут + Усиление урона) --- */
class PainLashWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'pain_lash', name: 'Бич боли', type: 'melee', baseCooldown: 0.6, baseDamage: 18, icon: '〰', evolvedFrom: 'whip' });
    this.range = 150; this.whipTime = 0.2; this.whipAnim = { active: false, t: 0, tx: 0, ty: 0 };
  }
  tick(dt) { if (this.whipAnim.active) { this.whipAnim.t += dt; if (this.whipAnim.t >= this.whipTime) this.whipAnim.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    let farthest = null, farthestD2 = 0; const r2 = this.range * this.range;
    for (let i = 0; i < enemies.items.length; i++) {
      const e = enemies.items[i]; if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y; const d2 = dx * dx + dy * dy;
      if (d2 <= r2 && d2 > farthestD2) { farthestD2 = d2; farthest = e; }
    }
    if (!farthest) return false;
    let dmg = this.damageAt() * this.totalDamageMul(player);
    // +25% если враг с полным HP
    if (farthest.hp >= (farthest.cfg ? farthest.cfg.hp : 20)) dmg *= 1.25;
    helpers.damageEnemy(farthest, dmg);
    this.whipAnim.active = true; this.whipAnim.t = 0; this.whipAnim.tx = farthest.x; this.whipAnim.ty = farthest.y;
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.whipAnim.active) return;
    const t = this.whipAnim.t / this.whipTime; const alpha = (1 - t) * 0.9;
    ctx.strokeStyle = `rgba(255,80,80,${alpha})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(this.whipAnim.tx, this.whipAnim.ty); ctx.stroke();
  }
}

/* --- Казнь (Арбалет + Кровотечение) --- */
class ExecutionerWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'executioner', name: 'Казнь', type: 'ranged', baseCooldown: 1.6, baseDamage: 30, icon: '☠', evolvedFrom: 'crossbow' });
    this.speed = 480; this.life = 2.2; this.range = 650;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) return false;
    const dir = Utils.norm(target.x - player.x, target.y - player.y);
    const p = projectiles.spawn(); if (!p) return true;
    p.kind = 'crossbow_bolt'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    p.vx = dir.x * this.speed; p.vy = dir.y * this.speed;
    p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 6; p.angle = Math.atan2(dir.y, dir.x); p.source = this.id;
    p.pierce = true; p._hitSet = new Set(); p.slowEnemy = 0;
    p.guaranteedBleed = true; // Special flag for guaranteed bleed
    return true;
  }
}

/* --- Топоры мясника (Мет. топоры + Крит) --- */
class ButcherAxesWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'butcher_axes', name: 'Топоры мясника', type: 'ranged', baseCooldown: 0.9, baseDamage: 14, icon: '⚒', evolvedFrom: 'throwing_axes' });
    this.speed = 420; this.life = 1.5; this.range = 520; this.count = 3;
    this.critChance = 0.25; this.critMul = 3;
    this.spreadAngle = (12 * Math.PI) / 180;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    let dx, dy;
    if (target) { const n = Utils.norm(target.x - player.x, target.y - player.y); dx = n.x; dy = n.y; }
    else { dx = player.facing.x; dy = player.facing.y; }
    const baseAngle = Math.atan2(dy, dx); let any = false;
    for (let i = 0; i < this.count; i++) {
      const off = (i - 1) * this.spreadAngle;
      const a = baseAngle + off;
      const p = projectiles.spawn(); if (!p) break;
      p.kind = 'throwing_axe'; p.owner = 'player'; p.x = player.x; p.y = player.y;
      p.vx = Math.cos(a) * this.speed; p.vy = Math.sin(a) * this.speed;
      p.life = this.life;
      let dmg = this.damageAt() * this.totalDamageMul(player);
      if (Math.random() < this.critChance) dmg *= this.critMul;
      p.damage = dmg; p.radius = 8; p.angle = a; p.spin = 14; p.source = this.id;
      p.pierce = false; p.slowEnemy = 0; any = true;
    }
    return any;
  }
}

/* --- Игольчатый шторм (Дротики + Быстрые пальцы) --- */
class NeedleStormWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'needle_storm', name: 'Игольчатый шторм', type: 'ranged', baseCooldown: 0.4, baseDamage: 7, icon: '↗', evolvedFrom: 'darts' });
    this.speed = 580; this.life = 1.2; this.range = 520;
    this.burstCount = 5; this.burstInterval = 0.08;
    this._burstLeft = 0; this._burstTimer = 0; this._lastDir = { x: 1, y: 0 };
  }
  update(player, enemies, projectiles, dt) {
    if (this._burstLeft > 0) {
      this._burstTimer -= dt;
      while (this._burstLeft > 0 && this._burstTimer <= 0) {
        this._fireOne(player, projectiles); this._burstLeft--; this._burstTimer += this.burstInterval;
      }
      if (this._burstLeft <= 0) this.cooldown = this.cooldownAt(player);
      return;
    }
    this.cooldown -= dt; if (this.cooldown > 0) return;
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) { this.cooldown = 0.1; return; }
    this._lastDir = Utils.norm(target.x - player.x, target.y - player.y);
    this._burstLeft = this.burstCount; this._burstTimer = 0;
  }
  _fireOne(player, projectiles) {
    const dir = this._lastDir; const p = projectiles.spawn(); if (!p) return;
    p.kind = 'dart'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    const jitter = (Math.random() - 0.5) * 0.08;
    const a = Math.atan2(dir.y, dir.x) + jitter;
    p.vx = Math.cos(a) * this.speed; p.vy = Math.sin(a) * this.speed;
    p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 3; p.angle = a; p.source = this.id; p.pierce = false; p.slowEnemy = 0;
  }
}

/* --- Метеоритный удар (Праща + Взрывная смерть) --- */
class MeteorStrikeWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'meteor_strike', name: 'Метеоритный удар', type: 'ranged', baseCooldown: 0.8, baseDamage: 22, icon: '☄', evolvedFrom: 'sling' });
    this.range = 550; this.aoeRadius = 60;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) return false;
    const p = projectiles.spawn(); if (!p) return true;
    p.kind = 'sling_stone'; p.owner = 'player'; p.x = target.x; p.y = target.y - 200;
    p.vx = 0; p.vy = 400;
    p.life = 0.5; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 10; p.angle = Math.PI / 2; p.source = this.id;
    p.aoeRadius = this.aoeRadius; p.pierce = false; p.slowEnemy = 0;
    return true;
  }
}

/* --- Ледяной шторм (Ледяная стрела + Аура холода) --- */
class IceStormWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'ice_storm', name: 'Ледяной шторм', type: 'magic', baseCooldown: 1.1, baseDamage: 16, icon: '❄', evolvedFrom: 'ice_arrow' });
    this.speed = 380; this.life = 1.8; this.range = 520;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) return false;
    const dir = Utils.norm(target.x - player.x, target.y - player.y);
    const p = projectiles.spawn(); if (!p) return true;
    p.kind = 'ice_arrow'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    p.vx = dir.x * this.speed; p.vy = dir.y * this.speed;
    p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 7; p.angle = Math.atan2(dir.y, dir.x); p.source = this.id;
    p.pierce = true; p._hitSet = new Set(); p.slowEnemy = 0.60; p.slowEnemyDuration = 3.0;
    return true;
  }
}

/* --- Грозовая цепь (Цеп. молния + Усиление магии) --- */
class ThunderChainWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'thunder_chain', name: 'Грозовая цепь', type: 'magic', baseCooldown: 1.4, baseDamage: 18, icon: '⚡', evolvedFrom: 'chain_lightning' });
    this.range = 320; this.chainRadius = 80; this.chains = 5;
    this.lightningAnim = { active: false, t: 0, points: [] };
  }
  tick(dt) { if (this.lightningAnim.active) { this.lightningAnim.t += dt; if (this.lightningAnim.t >= 0.3) this.lightningAnim.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const first = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!first) return false;
    const baseDmg = this.damageAt() * this.totalDamageMul(player);
    const points = [{ x: player.x, y: player.y }]; const hit = new Set();
    helpers.damageEnemy(first, baseDmg); hit.add(first); points.push({ x: first.x, y: first.y });
    let current = first;
    for (let c = 0; c < this.chains; c++) {
      let next = null, bestD2 = this.chainRadius * this.chainRadius;
      for (let i = 0; i < enemies.items.length; i++) {
        const e = enemies.items[i]; if (!e.active || hit.has(e) || e.invulnerable) continue;
        const dx = e.x - current.x, dy = e.y - current.y; const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) { bestD2 = d2; next = e; }
      }
      if (!next) break;
      helpers.damageEnemy(next, baseDmg); // No falloff!
      hit.add(next); points.push({ x: next.x, y: next.y }); current = next;
    }
    this.lightningAnim.active = true; this.lightningAnim.t = 0; this.lightningAnim.points = points;
    return true;
  }
  renderOverlay(ctx) {
    if (!this.lightningAnim.active) return;
    const t = this.lightningAnim.t / 0.3; const alpha = (1 - t) * 0.9;
    const pts = this.lightningAnim.points; if (pts.length < 2) return;
    ctx.strokeStyle = `rgba(100, 200, 255, ${alpha})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const mx = (pts[i - 1].x + pts[i].x) / 2 + (Math.random() - 0.5) * 20;
      const my = (pts[i - 1].y + pts[i].y) / 2 + (Math.random() - 0.5) * 20;
      ctx.lineTo(mx, my); ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  }
}

/* --- Чумное облако (Яд. облако + Алхимик) --- */
class PlagueCloudWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'plague_cloud', name: 'Чумное облако', type: 'magic', baseCooldown: 1.8, baseDamage: 12, icon: '☣', evolvedFrom: 'poison_cloud' });
    this.range = 320; this.cloudRadius = 80; this.cloudLife = 5.0;
    this._clouds = [];
  }
  doAttack(player, enemies) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) return false;
    this._clouds.push({ x: target.x, y: target.y, life: this.cloudLife, maxLife: this.cloudLife,
      dps: this.damageAt() * this.totalDamageMul(player), radius: this.cloudRadius });
    return true;
  }
  update(player, enemies, projectiles, dt, helpers) {
    for (let i = this._clouds.length - 1; i >= 0; i--) {
      const c = this._clouds[i]; c.life -= dt;
      if (c.life <= 0) { this._clouds.splice(i, 1); continue; }
      const r2 = c.radius * c.radius;
      for (let j = 0; j < enemies.items.length; j++) {
        const e = enemies.items[j]; if (!e.active || e.invulnerable) continue;
        const dx = e.x - c.x, dy = e.y - c.y;
        if (dx * dx + dy * dy <= r2) helpers.damageEnemy(e, c.dps * dt);
      }
    }
    this.cooldown -= dt; if (this.cooldown > 0) return;
    if (this.doAttack(player, enemies)) this.cooldown = this.cooldownAt(player);
    else this.cooldown = 0.1;
  }
  renderOverlay(ctx) {
    for (const c of this._clouds) {
      const t = c.life / c.maxLife; const alpha = 0.2 + 0.2 * t;
      ctx.fillStyle = `rgba(120, 40, 180, ${alpha})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/* --- Безумный гримуар (Книга закл. + Магический отклик) --- */
class MadGrimoireWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'mad_grimoire', name: 'Безумный гримуар', type: 'magic', baseCooldown: 0.7, baseDamage: 12, icon: '📖', evolvedFrom: 'spellbook' });
    this.speed = 400; this.life = 1.3; this.count = 4;
  }
  doAttack(player, _enemies, projectiles) {
    let any = false;
    for (let i = 0; i < this.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = projectiles.spawn(); if (!p) break;
      p.kind = 'spellbook_proj'; p.owner = 'player'; p.x = player.x; p.y = player.y;
      p.vx = Math.cos(a) * this.speed; p.vy = Math.sin(a) * this.speed;
      p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
      p.radius = 7; p.angle = a; p.source = this.id; p.pierce = false; p.slowEnemy = 0;
      any = true;
    }
    return any;
  }
}


/* --- Инферно (Огн. шторм + Усиление урона) --- */
class InfernoWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'inferno', name: 'Инферно', type: 'aoe', baseCooldown: 2.2, baseDamage: 25, icon: '🌋', evolvedFrom: 'firestorm' });
    this.spawnRadius = 130; this.aoeRadius = 45; this.pillarLife = 0.8; this.pillarCount = 5;
    this._pillars = [];
  }
  doAttack(player) {
    const damage = this.damageAt() * this.totalDamageMul(player);
    for (let i = 0; i < this.pillarCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * (this.spawnRadius - 40);
      this._pillars.push({ x: player.x + Math.cos(a) * r, y: player.y + Math.sin(a) * r,
        life: this.pillarLife, maxLife: this.pillarLife, damage, radius: this.aoeRadius, hit: false });
    }
    return true;
  }
  update(player, enemies, projectiles, dt, helpers) {
    for (let i = this._pillars.length - 1; i >= 0; i--) {
      const p = this._pillars[i]; p.life -= dt;
      if (p.life <= 0) { this._pillars.splice(i, 1); continue; }
      if (!p.hit) { p.hit = true; const r2 = p.radius * p.radius;
        for (let j = 0; j < enemies.items.length; j++) {
          const e = enemies.items[j]; if (!e.active || e.invulnerable) continue;
          const dx = e.x - p.x, dy = e.y - p.y;
          if (dx * dx + dy * dy <= r2) helpers.damageEnemy(e, p.damage);
        }
      }
    }
    this.cooldown -= dt; if (this.cooldown > 0) return;
    if (this.doAttack(player)) this.cooldown = this.cooldownAt(player); else this.cooldown = 0.1;
  }
  renderOverlay(ctx) {
    for (const p of this._pillars) {
      const t = p.life / p.maxLife; const alpha = 0.4 + 0.4 * t;
      ctx.fillStyle = `rgba(255,80,0,${alpha})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * (1.3 - t * 0.3), 0, Math.PI * 2); ctx.fill();
    }
  }
}

/* --- Аура мученика (Св. аура + Регенерация) --- */
class MartyrAuraWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'martyr_aura', name: 'Аура мученика', type: 'aoe', baseCooldown: 0, baseDamage: 6, icon: '✡', evolvedFrom: 'holy_aura' });
    this.radius = 70; this.undeadDps = 18; this._tickAcc = 0;
  }
  update(player, enemies, _proj, dt, helpers) {
    this._tickAcc += dt; if (this._tickAcc < 0.25) return;
    const ticks = this._tickAcc; this._tickAcc = 0;
    const baseDps = this.damageAt() * this.totalDamageMul(player);
    const undeadDps = this.undeadDps * WEAPON_LEVEL_DAMAGE[this.level - 1] * this.totalDamageMul(player);
    const r2 = this.radius * this.radius; let totalDmgDealt = 0;
    for (let i = 0; i < enemies.items.length; i++) {
      const e = enemies.items[i]; if (!e.active || e.invulnerable) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy > r2) continue;
      const isUndead = e.cfg && (e.cfg.id === 'skeleton' || e.cfg.id === 'zombie' || e.cfg.id === 'mage' || e.cfg.id === 'captain' || e.cfg.id === 'archer');
      const dmg = (isUndead ? undeadDps : baseDps) * ticks;
      helpers.damageEnemy(e, dmg);
      if (isUndead) totalDmgDealt += dmg;
    }
    // Heal 50% of undead damage
    if (totalDmgDealt > 0) player.hp = Math.min(player.maxHp, player.hp + totalDmgDealt * 0.5);
  }
  renderOverlay(ctx, player) {
    const pulse = 0.7 + 0.2 * Math.sin(Date.now() * 0.003);
    ctx.fillStyle = `rgba(255,240,180,${0.1 * pulse})`;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,220,100,${0.3 * pulse})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, 0, Math.PI * 2); ctx.stroke();
  }
  readyProgress() { return 1; }
}

/* --- Шипастый бастион (Кольцо шипов + Броня) --- */
class SpikeBastionWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'spike_bastion', name: 'Шипастый бастион', type: 'aoe', baseCooldown: 0, baseDamage: 16, icon: '✸', evolvedFrom: 'spike_ring' });
    this.radius = 65; this.spikeCount = 6; this.rotSpeed = Math.PI * 1.2;
    this._angle = 0; this._hitCooldowns = new Map(); this.bonusDR = 0.05;
  }
  update(player, enemies, _proj, dt, helpers) {
    this._angle += this.rotSpeed * dt;
    for (const [key, val] of this._hitCooldowns) {
      const nv = val - dt; if (nv <= 0) this._hitCooldowns.delete(key); else this._hitCooldowns.set(key, nv);
    }
    const damage = this.damageAt() * this.totalDamageMul(player);
    for (let s = 0; s < this.spikeCount; s++) {
      const a = this._angle + (Math.PI * 2 / this.spikeCount) * s;
      const sx = player.x + Math.cos(a) * this.radius, sy = player.y + Math.sin(a) * this.radius;
      for (let i = 0; i < enemies.items.length; i++) {
        const e = enemies.items[i]; if (!e.active || e.invulnerable) continue;
        if (this._hitCooldowns.has(i)) continue;
        const eSize = e.cfg ? Math.max(e.cfg.w, e.cfg.h) * 0.5 : 14;
        const dx = e.x - sx, dy = e.y - sy;
        if (dx * dx + dy * dy <= (10 + eSize) * (10 + eSize)) {
          helpers.damageEnemy(e, damage); this._hitCooldowns.set(i, 0.4);
        }
      }
    }
  }
  renderOverlay(ctx, player) {
    for (let s = 0; s < this.spikeCount; s++) {
      const a = this._angle + (Math.PI * 2 / this.spikeCount) * s;
      const sx = player.x + Math.cos(a) * this.radius, sy = player.y + Math.sin(a) * this.radius;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(a);
      ctx.fillStyle = '#aaa';
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(8, 5); ctx.lineTo(-8, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  readyProgress() { return 1; }
}

/* --- Тектонический разлом (Землетрясение + Укрепление) --- */
class TectonicRiftWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'tectonic_rift', name: 'Тектонический разлом', type: 'aoe', baseCooldown: 2.8, baseDamage: 18, icon: '◉', evolvedFrom: 'earthquake' });
    this.maxRadius = 180; this.expandTime = 0.6; this._waves = []; this._cracks = [];
  }
  doAttack(player) {
    const damage = this.damageAt() * this.totalDamageMul(player);
    this._waves.push({ x: player.x, y: player.y, life: this.expandTime, maxLife: this.expandTime,
      radius: 0, maxRadius: this.maxRadius, damage, hitSet: new Set() });
    // Трещины (DOT zones)
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2; const d = 40 + Math.random() * 100;
      this._cracks.push({ x: player.x + Math.cos(a) * d, y: player.y + Math.sin(a) * d,
        life: 3.0, dps: 20, radius: 30 });
    }
    return true;
  }
  update(player, enemies, projectiles, dt, helpers) {
    for (let i = this._waves.length - 1; i >= 0; i--) {
      const w = this._waves[i]; w.life -= dt;
      if (w.life <= 0) { this._waves.splice(i, 1); continue; }
      const t = 1 - w.life / w.maxLife; w.radius = w.maxRadius * t;
      const innerR = w.radius - 20;
      for (let j = 0; j < enemies.items.length; j++) {
        const e = enemies.items[j]; if (!e.active || e.invulnerable || w.hitSet.has(j)) continue;
        const dx = e.x - w.x, dy = e.y - w.y; const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= w.radius && d >= innerR) { helpers.damageEnemy(e, w.damage); w.hitSet.add(j); }
      }
    }
    // Cracks DOT
    for (let i = this._cracks.length - 1; i >= 0; i--) {
      const c = this._cracks[i]; c.life -= dt;
      if (c.life <= 0) { this._cracks.splice(i, 1); continue; }
      const r2 = c.radius * c.radius;
      for (let j = 0; j < enemies.items.length; j++) {
        const e = enemies.items[j]; if (!e.active || e.invulnerable) continue;
        const dx = e.x - c.x, dy = e.y - c.y;
        if (dx * dx + dy * dy <= r2) helpers.damageEnemy(e, c.dps * dt);
      }
    }
    this.cooldown -= dt; if (this.cooldown > 0) return;
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.maxRadius + 50);
    if (!target) { this.cooldown = 0.1; return; }
    this.doAttack(player); this.cooldown = this.cooldownAt(player);
  }
  renderOverlay(ctx) {
    for (const w of this._waves) {
      const t = 1 - w.life / w.maxLife; const alpha = (1 - t) * 0.5;
      ctx.strokeStyle = `rgba(140,80,30,${alpha})`; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2); ctx.stroke();
    }
    for (const c of this._cracks) {
      const alpha = Math.min(1, c.life / 3) * 0.3;
      ctx.fillStyle = `rgba(100,50,0,${alpha})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/* --- Клинок героя (Меч + Усиление урона) --- */
class HeroBladeWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'hero_blade', name: 'Клинок героя', type: 'melee', baseCooldown: 0.7, baseDamage: 30, icon: '⚔', evolvedFrom: 'sword' });
    this.radius = 65; this.arc = Math.PI * 0.9; this.swingTime = 0.16;
    this.swing = { active: false, t: 0, angle: 0 }; this.dmgBonus = 0.15;
  }
  tick(dt) { if (this.swing.active) { this.swing.t += dt; if (this.swing.t >= this.swingTime) this.swing.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.radius);
    if (!target) return false;
    const damage = this.damageAt() * this.totalDamageMul(player) * (1 + this.dmgBonus);
    const dirAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const halfArc = this.arc * 0.5; const r2 = this.radius * this.radius;
    for (let i = 0; i < enemies.items.length; i++) {
      const e = enemies.items[i]; if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy > r2) continue;
      let diff = Math.atan2(dy, dx) - dirAngle;
      while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) helpers.damageEnemy(e, damage);
    }
    this.swing.active = true; this.swing.t = 0; this.swing.angle = dirAngle;
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.swing.active) return;
    const t = this.swing.t / this.swingTime; const alpha = (1 - t) * 0.9;
    ctx.strokeStyle = `rgba(255,215,0,${alpha})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, this.swing.angle - this.arc * 0.5, this.swing.angle + this.arc * 0.5); ctx.stroke();
  }
}

/* --- Пироклазм (Огненный шар + Усиление магии) --- */
class PyroclasmWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'pyroclasm', name: 'Пироклазм', type: 'aoe', baseCooldown: 2.2, baseDamage: 35, icon: '🔥', evolvedFrom: 'fireball' });
    this.flightTime = 0.6; this.explodeRadius = 100; this.range = 700; this.speed = 300;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    let dx, dy;
    if (target) { const n = Utils.norm(target.x - player.x, target.y - player.y); dx = n.x; dy = n.y; }
    else { dx = player.facing.x; dy = player.facing.y; }
    const p = projectiles.spawn(); if (!p) return false;
    p.kind = 'fireball'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    p.vx = dx * this.speed; p.vy = dy * this.speed;
    p.life = this.flightTime; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 14; p.explodeRadius = this.explodeRadius;
    p.angle = Math.atan2(dy, dx); p.source = this.id; p.pierce = false; p.slowEnemy = 0;
    return true;
  }
}

/* --- Ледяной шип (Ледяная стрела + Магический отклик) --- */
class IceSpikeWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'ice_spike', name: 'Ледяной шип', type: 'magic', baseCooldown: 1.2, baseDamage: 15, icon: '🧊', evolvedFrom: 'ice_arrow' });
    this.speed = 420; this.life = 1.6; this.range = 520;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) return false;
    const dir = Utils.norm(target.x - player.x, target.y - player.y);
    const p = projectiles.spawn(); if (!p) return true;
    p.kind = 'ice_arrow'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    p.vx = dir.x * this.speed; p.vy = dir.y * this.speed;
    p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 6; p.angle = Math.atan2(dir.y, dir.x); p.source = this.id;
    p.pierce = false; p.slowEnemy = 0.40; p.slowEnemyDuration = 2.0;
    p.iceSpikeOnKill = true; // Flag: spawn 3 shards on kill
    return true;
  }
}

/* --- Электрический каскад (Цеп. молния + Быстрые пальцы) --- */
class ElectricCascadeWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'electric_cascade', name: 'Электр. каскад', type: 'magic', baseCooldown: 0.8, baseDamage: 14, icon: '⚡', evolvedFrom: 'chain_lightning' });
    this.range = 300; this.chainRadius = 70; this.chains = 3;
    this.lightningAnim = { active: false, t: 0, points: [] };
  }
  tick(dt) { if (this.lightningAnim.active) { this.lightningAnim.t += dt; if (this.lightningAnim.t >= 0.2) this.lightningAnim.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const first = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!first) return false;
    const baseDmg = this.damageAt() * this.totalDamageMul(player);
    const points = [{ x: player.x, y: player.y }]; const hit = new Set();
    helpers.damageEnemy(first, baseDmg); hit.add(first); points.push({ x: first.x, y: first.y });
    let current = first;
    for (let c = 0; c < this.chains; c++) {
      let next = null, bestD2 = this.chainRadius * this.chainRadius;
      for (let i = 0; i < enemies.items.length; i++) {
        const e = enemies.items[i]; if (!e.active || hit.has(e) || e.invulnerable) continue;
        const dx = e.x - current.x, dy = e.y - current.y; const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) { bestD2 = d2; next = e; }
      }
      if (!next) break;
      helpers.damageEnemy(next, baseDmg * 0.8); hit.add(next); points.push({ x: next.x, y: next.y }); current = next;
    }
    this.lightningAnim.active = true; this.lightningAnim.t = 0; this.lightningAnim.points = points;
    return true;
  }
  renderOverlay(ctx) {
    if (!this.lightningAnim.active) return;
    const t = this.lightningAnim.t / 0.2; const alpha = (1 - t) * 0.8;
    const pts = this.lightningAnim.points; if (pts.length < 2) return;
    ctx.strokeStyle = `rgba(180, 255, 100, ${alpha})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
}

/* --- Миазмы (Яд. облако + Аура холода) --- */
class MiasmaWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'miasma', name: 'Миазмы', type: 'magic', baseCooldown: 1.8, baseDamage: 9, icon: '☁', evolvedFrom: 'poison_cloud' });
    this.range = 300; this.cloudRadius = 70; this.cloudLife = 4.0;
    this._clouds = [];
  }
  doAttack(player, enemies) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) return false;
    this._clouds.push({ x: target.x, y: target.y, life: this.cloudLife, maxLife: this.cloudLife,
      dps: this.damageAt() * this.totalDamageMul(player), radius: this.cloudRadius });
    return true;
  }
  update(player, enemies, projectiles, dt, helpers) {
    for (let i = this._clouds.length - 1; i >= 0; i--) {
      const c = this._clouds[i]; c.life -= dt;
      if (c.life <= 0) { this._clouds.splice(i, 1); continue; }
      const r2 = c.radius * c.radius;
      for (let j = 0; j < enemies.items.length; j++) {
        const e = enemies.items[j]; if (!e.active || e.invulnerable) continue;
        const dx = e.x - c.x, dy = e.y - c.y;
        if (dx * dx + dy * dy <= r2) {
          helpers.damageEnemy(e, c.dps * dt);
          // Slow 30%
          e._slowFactor = Math.max(e._slowFactor || 0, 0.30);
          e._slowTimer = 0.5;
        }
      }
    }
    this.cooldown -= dt; if (this.cooldown > 0) return;
    if (this.doAttack(player, enemies)) this.cooldown = this.cooldownAt(player);
    else this.cooldown = 0.1;
  }
  renderOverlay(ctx) {
    for (const c of this._clouds) {
      const t = c.life / c.maxLife; const alpha = 0.15 + 0.15 * t;
      ctx.fillStyle = `rgba(80,100,180,${alpha})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2); ctx.fill();
    }
  }
}



/* ============================================================
   5 ЭКСКЛЮЗИВНЫХ (ЛЕГЕНДАРНЫХ) ОРУЖИЙ
   ============================================================ */

class ExclusiveWeapon extends Weapon {
  constructor(cfg) {
    super(cfg);
    this.isExclusive = true;
    this.exclusiveColor = cfg.exclusiveColor || '#ffd700';
  }
}

/* --- E1: Клинок короля-лича --- */
class LichBladeWeapon extends ExclusiveWeapon {
  constructor() {
    super({ id: 'lich_blade', name: 'Клинок короля-лича', type: 'melee', baseCooldown: 0.8, baseDamage: 30, icon: '💀', desc: 'Ближний бой, урон 30, при убийстве призывает скелета-миньона.', exclusiveColor: '#8b00ff' });
    this.radius = 65; this.arc = Math.PI * 0.9; this.swingTime = 0.18;
    this.swing = { active: false, t: 0, angle: 0 };
  }
  tick(dt) { if (this.swing.active) { this.swing.t += dt; if (this.swing.t >= this.swingTime) this.swing.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.radius);
    if (!target) return false;
    const damage = this.damageAt() * this.totalDamageMul(player);
    const dirAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const halfArc = this.arc * 0.5; const r2 = this.radius * this.radius;
    for (let i = 0; i < enemies.items.length; i++) {
      const e = enemies.items[i]; if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy > r2) continue;
      let diff = Math.atan2(dy, dx) - dirAngle;
      while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) helpers.damageEnemy(e, damage);
    }
    this.swing.active = true; this.swing.t = 0; this.swing.angle = dirAngle;
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.swing.active) return;
    const t = this.swing.t / this.swingTime; const alpha = (1 - t) * 0.9;
    ctx.strokeStyle = `rgba(139,0,255,${alpha})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, this.swing.angle - this.arc * 0.5, this.swing.angle + this.arc * 0.5); ctx.stroke();
  }
}

/* --- E2: Лук феникса --- */
class PhoenixBowWeapon extends ExclusiveWeapon {
  constructor() {
    super({ id: 'phoenix_bow', name: 'Лук феникса', type: 'ranged', baseCooldown: 1.3, baseDamage: 25, icon: '🔥', desc: 'Огненная стрела, взрыв 40px при попадании.', exclusiveColor: '#ff4500' });
    this.speed = 500; this.life = 1.8; this.range = 560; this.explodeRadius = 40;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) return false;
    const dir = Utils.norm(target.x - player.x, target.y - player.y);
    const p = projectiles.spawn(); if (!p) return true;
    p.kind = 'fireball'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    p.vx = dir.x * this.speed; p.vy = dir.y * this.speed;
    p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 8; p.explodeRadius = this.explodeRadius;
    p.angle = Math.atan2(dir.y, dir.x); p.source = this.id; p.pierce = false; p.slowEnemy = 0;
    return true;
  }
}

/* --- E3: Посох архимага --- */
class ArchmageStaffWeapon extends ExclusiveWeapon {
  constructor() {
    super({ id: 'archmage_staff', name: 'Посох архимага', type: 'magic', baseCooldown: 1.5, baseDamage: 18, icon: '🪄', desc: '3 разноцветных шара (огонь+лёд+молния) каждые 1.5 сек.', exclusiveColor: '#9c27b0' });
    this.speed = 380; this.life = 1.5; this.range = 500;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    let baseAngle;
    if (target) baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
    else baseAngle = Math.atan2(player.facing.y, player.facing.x);
    const spread = 0.3; let any = false;
    for (let i = 0; i < 3; i++) {
      const a = baseAngle + (i - 1) * spread;
      const p = projectiles.spawn(); if (!p) break;
      p.kind = 'spellbook_proj'; p.owner = 'player'; p.x = player.x; p.y = player.y;
      p.vx = Math.cos(a) * this.speed; p.vy = Math.sin(a) * this.speed;
      p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
      p.radius = 7; p.angle = a + i * 2; p.source = this.id; p.pierce = false;
      // Each orb has different slow effect
      if (i === 1) { p.slowEnemy = 0.30; p.slowEnemyDuration = 1.5; } else { p.slowEnemy = 0; }
      any = true;
    }
    return any;
  }
}

/* --- E4: Коготь зверя --- */
class BeastClawWeapon extends ExclusiveWeapon {
  constructor() {
    super({ id: 'beast_claw', name: 'Коготь зверя', type: 'melee', baseCooldown: 0.4, baseDamage: 12, icon: '🐾', desc: 'Быстрые удары (0.4 сек), урон 12, 15% крит, кровотечение.', exclusiveColor: '#4caf50' });
    this.radius = 50; this.arc = Math.PI * 0.7; this.swingTime = 0.12;
    this.critChance = 0.15; this.swing = { active: false, t: 0, angle: 0 };
  }
  tick(dt) { if (this.swing.active) { this.swing.t += dt; if (this.swing.t >= this.swingTime) this.swing.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.radius);
    if (!target) return false;
    let damage = this.damageAt() * this.totalDamageMul(player);
    if (Math.random() < this.critChance) damage *= 2;
    const dirAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const halfArc = this.arc * 0.5; const r2 = this.radius * this.radius;
    for (let i = 0; i < enemies.items.length; i++) {
      const e = enemies.items[i]; if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy > r2) continue;
      let diff = Math.atan2(dy, dx) - dirAngle;
      while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) {
        helpers.damageEnemy(e, damage);
        // Guaranteed bleed
        if (!e.bleed) e.bleed = { dps: 0, remaining: 0 };
        e.bleed.dps = 6; e.bleed.remaining = 3;
      }
    }
    this.swing.active = true; this.swing.t = 0; this.swing.angle = dirAngle;
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.swing.active) return;
    const t = this.swing.t / this.swingTime; const alpha = (1 - t) * 0.8;
    ctx.strokeStyle = `rgba(76,175,80,${alpha})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, this.swing.angle - this.arc * 0.5, this.swing.angle + this.arc * 0.5); ctx.stroke();
  }
}

/* --- E5: Рунный щит --- */
class RuneShieldWeapon extends ExclusiveWeapon {
  constructor() {
    super({ id: 'rune_shield', name: 'Рунный щит', type: 'aura', baseCooldown: 0, baseDamage: 15, icon: '🛡', desc: 'Постоянный урон 15/сек в радиусе 50px, +10% DR.', exclusiveColor: '#2196f3' });
    this.radius = 50; this._tickAcc = 0; this.bonusDR = 0.10;
  }
  update(player, enemies, _proj, dt, helpers) {
    this._tickAcc += dt; if (this._tickAcc < 0.25) return;
    const ticks = this._tickAcc; this._tickAcc = 0;
    const dps = this.damageAt() * this.totalDamageMul(player); const r2 = this.radius * this.radius;
    for (let i = 0; i < enemies.items.length; i++) {
      const e = enemies.items[i]; if (!e.active || e.invulnerable) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy <= r2) helpers.damageEnemy(e, dps * ticks);
    }
  }
  renderOverlay(ctx, player) {
    const pulse = 0.6 + 0.2 * Math.sin(Date.now() * 0.005);
    ctx.strokeStyle = `rgba(33,150,243,${0.3 * pulse})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(33,150,243,${0.06 * pulse})`;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, 0, Math.PI * 2); ctx.fill();
  }
  readyProgress() { return 1; }
}


/* ============================================================
   5 СУПЕР-ЭВОЛЮЦИОННЫХ ОРУЖИЙ
   ============================================================ */

class SuperEvolutionWeapon extends Weapon {
  constructor(cfg) {
    super(cfg);
    this.isEvolved = true;
    this.isSuperEvolved = true;
    this.superColor = cfg.superColor || '#ffd700';
  }
}

/* --- Клинок Вечной Ночи --- */
class EternalNightBladeWeapon extends SuperEvolutionWeapon {
  constructor() {
    super({ id: 'eternal_night_blade', name: 'Клинок Вечной Ночи', type: 'melee', baseCooldown: 0.6, baseDamage: 45, icon: '🌑', superColor: '#4a0080' });
    this.radius = 75; this.arc = Math.PI; this.swingTime = 0.15; this.lifesteal = 8;
    this.swing = { active: false, t: 0, angle: 0 };
  }
  tick(dt) { if (this.swing.active) { this.swing.t += dt; if (this.swing.t >= this.swingTime) this.swing.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.radius);
    if (!target) return false;
    const damage = this.damageAt() * this.totalDamageMul(player);
    const dirAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const halfArc = this.arc * 0.5; const r2 = this.radius * this.radius; let hits = 0;
    for (let i = 0; i < enemies.items.length; i++) {
      const e = enemies.items[i]; if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy > r2) continue;
      let diff = Math.atan2(dy, dx) - dirAngle;
      while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) { helpers.damageEnemy(e, damage); hits++; }
    }
    if (hits > 0) player.hp = Math.min(player.maxHp, player.hp + this.lifesteal * hits);
    this.swing.active = true; this.swing.t = 0; this.swing.angle = dirAngle;
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.swing.active) return;
    const t = this.swing.t / this.swingTime; const alpha = (1 - t) * 0.9;
    ctx.strokeStyle = `rgba(74,0,128,${alpha})`; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, this.swing.angle - this.arc * 0.5, this.swing.angle + this.arc * 0.5); ctx.stroke();
    ctx.strokeStyle = `rgba(200,100,255,${alpha * 0.5})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius - 5, this.swing.angle - this.arc * 0.5, this.swing.angle + this.arc * 0.5); ctx.stroke();
  }
}

/* --- Лук Апокалипсиса --- */
class ApocalypseBowWeapon extends SuperEvolutionWeapon {
  constructor() {
    super({ id: 'apocalypse_bow', name: 'Лук Апокалипсиса', type: 'ranged', baseCooldown: 1.2, baseDamage: 20, icon: '🏹', superColor: '#ff2200' });
    this.speed = 560; this.life = 1.8; this.range = 580; this.explodeRadius = 60;
    this.burstCount = 5; this.burstInterval = 0.08;
    this._burstLeft = 0; this._burstTimer = 0; this._lastDir = { x: 1, y: 0 };
  }
  update(player, enemies, projectiles, dt) {
    if (this._burstLeft > 0) {
      this._burstTimer -= dt;
      while (this._burstLeft > 0 && this._burstTimer <= 0) {
        this._fireOne(player, projectiles); this._burstLeft--; this._burstTimer += this.burstInterval;
      }
      if (this._burstLeft <= 0) this.cooldown = this.cooldownAt(player);
      return;
    }
    this.cooldown -= dt; if (this.cooldown > 0) return;
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) { this.cooldown = 0.1; return; }
    this._lastDir = Utils.norm(target.x - player.x, target.y - player.y);
    this._burstLeft = this.burstCount; this._burstTimer = 0;
  }
  _fireOne(player, projectiles) {
    const dir = this._lastDir; const p = projectiles.spawn(); if (!p) return;
    p.kind = 'fireball'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    const jitter = (Math.random() - 0.5) * 0.08;
    const a = Math.atan2(dir.y, dir.x) + jitter;
    p.vx = Math.cos(a) * this.speed; p.vy = Math.sin(a) * this.speed;
    p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 8; p.explodeRadius = this.explodeRadius;
    p.angle = a; p.source = this.id; p.pierce = false; p.slowEnemy = 0;
  }
}

/* --- Посох Вечности --- */
class EternityStaffWeapon extends SuperEvolutionWeapon {
  constructor() {
    super({ id: 'eternity_staff', name: 'Посох Вечности', type: 'magic', baseCooldown: 0.6, baseDamage: 14, icon: '🔮', superColor: '#9c27b0' });
    this.speed = 420; this.life = 1.4; this.count = 5;
  }
  doAttack(player, _enemies, projectiles) {
    let any = false;
    for (let i = 0; i < this.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = projectiles.spawn(); if (!p) break;
      p.kind = 'spellbook_proj'; p.owner = 'player'; p.x = player.x; p.y = player.y;
      p.vx = Math.cos(a) * this.speed; p.vy = Math.sin(a) * this.speed;
      p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player) * 1.25;
      p.radius = 8; p.angle = a + i; p.source = this.id; p.pierce = false; p.slowEnemy = 0;
      any = true;
    }
    return any;
  }
}

/* --- Когти Пожирателя --- */
class DevourerClawsWeapon extends SuperEvolutionWeapon {
  constructor() {
    super({ id: 'devourer_claws', name: 'Когти Пожирателя', type: 'melee', baseCooldown: 0.3, baseDamage: 18, icon: '🐾', superColor: '#b71c1c' });
    this.radius = 55; this.arc = Math.PI * 0.8; this.swingTime = 0.10;
    this.critChance = 0.25; this.lifesteal = 10; this.bleedDps = 15;
    this.swing = { active: false, t: 0, angle: 0 };
  }
  tick(dt) { if (this.swing.active) { this.swing.t += dt; if (this.swing.t >= this.swingTime) this.swing.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.radius);
    if (!target) return false;
    let damage = this.damageAt() * this.totalDamageMul(player);
    if (Math.random() < this.critChance) damage *= 2;
    const dirAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const halfArc = this.arc * 0.5; const r2 = this.radius * this.radius; let hits = 0;
    for (let i = 0; i < enemies.items.length; i++) {
      const e = enemies.items[i]; if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy > r2) continue;
      let diff = Math.atan2(dy, dx) - dirAngle;
      while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) {
        helpers.damageEnemy(e, damage); hits++;
        if (!e.bleed) e.bleed = { dps: 0, remaining: 0 };
        e.bleed.dps = this.bleedDps; e.bleed.remaining = 3;
      }
    }
    if (hits > 0) player.hp = Math.min(player.maxHp, player.hp + this.lifesteal * hits);
    this.swing.active = true; this.swing.t = 0; this.swing.angle = dirAngle;
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.swing.active) return;
    const t = this.swing.t / this.swingTime; const alpha = (1 - t) * 0.9;
    ctx.strokeStyle = `rgba(183,28,28,${alpha})`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, this.swing.angle - this.arc * 0.5, this.swing.angle + this.arc * 0.5); ctx.stroke();
  }
}

/* --- Бастион Света --- */
class BastionOfLightWeapon extends SuperEvolutionWeapon {
  constructor() {
    super({ id: 'bastion_of_light', name: 'Бастион Света', type: 'aura', baseCooldown: 0, baseDamage: 10, icon: '🛡', superColor: '#ffd700' });
    this.radius = 90; this.undeadDps = 30; this.bonusDR = 0.20; this.healPerSec = 5;
    this._tickAcc = 0;
  }
  update(player, enemies, _proj, dt, helpers) {
    // Passive heal
    player.hp = Math.min(player.maxHp, player.hp + this.healPerSec * dt);
    this._tickAcc += dt; if (this._tickAcc < 0.25) return;
    const ticks = this._tickAcc; this._tickAcc = 0;
    const baseDps = this.damageAt() * this.totalDamageMul(player);
    const undeadDps = this.undeadDps * WEAPON_LEVEL_DAMAGE[this.level - 1] * this.totalDamageMul(player);
    const r2 = this.radius * this.radius;
    for (let i = 0; i < enemies.items.length; i++) {
      const e = enemies.items[i]; if (!e.active || e.invulnerable) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy > r2) continue;
      const isUndead = e.cfg && (e.cfg.id === 'skeleton' || e.cfg.id === 'zombie' || e.cfg.id === 'mage' || e.cfg.id === 'captain' || e.cfg.id === 'archer');
      helpers.damageEnemy(e, (isUndead ? undeadDps : baseDps) * ticks);
    }
  }
  renderOverlay(ctx, player) {
    const pulse = 0.7 + 0.2 * Math.sin(Date.now() * 0.004);
    ctx.fillStyle = `rgba(255,215,0,${0.08 * pulse})`;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255,215,0,${0.35 * pulse})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, 0, Math.PI * 2); ctx.stroke();
  }
  readyProgress() { return 1; }
}


/* ============================================================
   ФАБРИКИ И РЕЕСТРЫ
   ============================================================ */

// Расширяем EVOLVED_WEAPON_FACTORIES
Object.assign(EVOLVED_WEAPON_FACTORIES, {
  bloodletter:       () => new BloodletterWeapon(),
  piercer:           () => new PiercerWeapon(),
  titan_hammer:      () => new TitanHammerWeapon(),
  pain_lash:         () => new PainLashWeapon(),
  executioner:       () => new ExecutionerWeapon(),
  butcher_axes:      () => new ButcherAxesWeapon(),
  needle_storm:      () => new NeedleStormWeapon(),
  meteor_strike:     () => new MeteorStrikeWeapon(),
  ice_storm:         () => new IceStormWeapon(),
  thunder_chain:     () => new ThunderChainWeapon(),
  plague_cloud:      () => new PlagueCloudWeapon(),
  mad_grimoire:      () => new MadGrimoireWeapon(),
  inferno:           () => new InfernoWeapon(),
  martyr_aura:       () => new MartyrAuraWeapon(),
  spike_bastion:     () => new SpikeBastionWeapon(),
  tectonic_rift:     () => new TectonicRiftWeapon(),
  hero_blade:        () => new HeroBladeWeapon(),
  pyroclasm:         () => new PyroclasmWeapon(),
  ice_spike:         () => new IceSpikeWeapon(),
  electric_cascade:  () => new ElectricCascadeWeapon(),
  miasma:            () => new MiasmaWeapon(),
});

// Эксклюзивные оружия
const EXCLUSIVE_WEAPON_FACTORIES = {
  lich_blade:      () => new LichBladeWeapon(),
  phoenix_bow:     () => new PhoenixBowWeapon(),
  archmage_staff:  () => new ArchmageStaffWeapon(),
  beast_claw:      () => new BeastClawWeapon(),
  rune_shield:     () => new RuneShieldWeapon(),
};

const EXCLUSIVE_WEAPON_INFO = [
  { id: 'lich_blade',     name: 'Клинок короля-лича', icon: '💀', desc: 'Ближний бой, урон 30, призыв скелетов.' },
  { id: 'phoenix_bow',    name: 'Лук феникса',        icon: '🔥', desc: 'Огненная стрела, взрыв 40px.' },
  { id: 'archmage_staff', name: 'Посох архимага',     icon: '🪄', desc: '3 шара (огонь+лёд+молния).' },
  { id: 'beast_claw',     name: 'Коготь зверя',       icon: '🐾', desc: 'Быстрые удары, крит, кровотечение.' },
  { id: 'rune_shield',    name: 'Рунный щит',         icon: '🛡', desc: 'Урон 15/сек в радиусе 50px, +10% DR.' },
];

// Супер-эволюции
const SUPER_EVOLVED_WEAPON_FACTORIES = {
  eternal_night_blade: () => new EternalNightBladeWeapon(),
  apocalypse_bow:      () => new ApocalypseBowWeapon(),
  eternity_staff:      () => new EternityStaffWeapon(),
  devourer_claws:      () => new DevourerClawsWeapon(),
  bastion_of_light:    () => new BastionOfLightWeapon(),
};


/* ============================================================
   ЭКСПОРТ
   ============================================================ */
window.ExclusiveWeapon = ExclusiveWeapon;
window.EXCLUSIVE_WEAPON_FACTORIES = EXCLUSIVE_WEAPON_FACTORIES;
window.EXCLUSIVE_WEAPON_INFO = EXCLUSIVE_WEAPON_INFO;
window.SUPER_EVOLVED_WEAPON_FACTORIES = SUPER_EVOLVED_WEAPON_FACTORIES;
window.SuperEvolutionWeapon = SuperEvolutionWeapon;
