'use strict';
/* ============================================================
   weapons.js — оружие и снаряды.

   - Класс Weapon — базовый, конкретные подклассы:
       SwordWeapon, BowWeapon, DaggerWeapon, FireballWeapon
   - createProjectile() — фабрика для общего пула снарядов.
   - Projectiles.update / render — обработка и отрисовка пула.

   Уровни 1..5: каждый уровень даёт +15% урона и -5% кулдауна
   (см. WEAPON_LEVEL_DAMAGE / WEAPON_LEVEL_COOLDOWN_MUL ниже).
   ============================================================ */

// Множители на уровень оружия (индекс = level - 1)
const WEAPON_LEVEL_DAMAGE  = [1.00, 1.15, 1.30, 1.45, 1.60];
const WEAPON_LEVEL_CD_MUL  = [1.00, 0.95, 0.90, 0.85, 0.80];
const MAX_WEAPON_LEVEL = 5;


/* ---------- Снаряды (общий пул) ---------- */
function createProjectile() {
  return {
    active: false,
    kind: 'missile',     // 'missile' | 'arrow' | 'dagger' | 'fireball'
    x: 0, y: 0,
    vx: 0, vy: 0,
    life: 0,
    damage: 0,
    radius: 6,
    // Для стрел/кинжалов: направление для отрисовки
    angle: 0,
    // Для огненного шара: радиус взрыва, флаг "уже взорвался"
    explodeRadius: 0,
    // Идентификатор источника (имя оружия) — на будущее (резисты и т.п.)
    source: '',
  };
}

const Projectiles = {
  /** Найти ближайшего активного врага в радиусе. */
  findNearestEnemy(enemies, x, y, maxRadius) {
    let best = null;
    let bestD2 = (maxRadius === Infinity ? Infinity : maxRadius * maxRadius);
    const items = enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const dx = e.x - x, dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    return best;
  },

  /** Обновление пула снарядов: движение, столкновения, отключение за экраном. */
  update(pool, enemies, cam, viewW, viewH, onDamage, dt) {
    const items = pool.items;
    const margin = 60;
    const minX = cam.x - margin, minY = cam.y - margin;
    const maxX = cam.x + viewW + margin, maxY = cam.y + viewH + margin;

    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      if (!m.active) continue;

      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt;

      // Огненный шар: при истечении life — взрыв (AoE). Иначе двигается дальше.
      if (m.kind === 'fireball' && m.life <= 0) {
        Projectiles._fireballExplode(m, enemies, onDamage);
        m.active = false;
        continue;
      }

      // Прочие снаряды: вышел за границы / истёк срок жизни
      if (m.life <= 0 || m.x < minX || m.x > maxX || m.y < minY || m.y > maxY) {
        m.active = false;
        continue;
      }

      // Столкновения с врагами
      const eItems = enemies.items;
      for (let j = 0; j < eItems.length; j++) {
        const e = eItems[j];
        if (!e.active) continue;
        const r = m.radius + CONFIG.ENEMY.SIZE * 0.5;
        const dx = e.x - m.x, dy = e.y - m.y;
        if (dx * dx + dy * dy <= r * r) {
          if (m.kind === 'fireball') {
            // Огненный шар: при попадании — AoE-взрыв вместо одиночного урона
            Projectiles._fireballExplode(m, enemies, onDamage);
          } else {
            onDamage(e, m.damage);
          }
          // Кинжалы и стрелы — пробивающие? Для MVP-2: исчезают при попадании.
          m.active = false;
          break;
        }
      }
    }
  },

  /** AoE-урон от огненного шара по всем активным врагам в радиусе. */
  _fireballExplode(m, enemies, onDamage) {
    const er2 = m.explodeRadius * m.explodeRadius;
    const eItems = enemies.items;
    for (let j = 0; j < eItems.length; j++) {
      const e = eItems[j];
      if (!e.active) continue;
      const dx = e.x - m.x, dy = e.y - m.y;
      if (dx * dx + dy * dy <= er2) {
        onDamage(e, m.damage);
      }
    }
  },

  /** Отрисовка снарядов с учётом видимой области. */
  render(ctx, pool, cam, viewW, viewH) {
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    const items = pool.items;
    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      if (!m.active) continue;
      if (m.x < minX - 30 || m.x > maxX + 30 || m.y < minY - 30 || m.y > maxY + 30) continue;

      switch (m.kind) {
        case 'missile': {
          // Magic Missile (фиолетовый, glow)
          ctx.shadowColor = 'rgba(220, 180, 255, 0.9)';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#a259ff';
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius * 0.45, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'arrow': {
          // Жёлтая стрела 20x4 px, ориентирована по углу
          ctx.save();
          ctx.translate(m.x, m.y);
          ctx.rotate(m.angle);
          ctx.fillStyle = '#f4d03f';
          ctx.fillRect(-10, -2, 20, 4);
          ctx.fillStyle = '#fff8c4';
          ctx.fillRect(-10, -1, 20, 1);
          ctx.restore();
          break;
        }
        case 'dagger': {
          // Серебристый кинжал (узкий ромб)
          ctx.save();
          ctx.translate(m.x, m.y);
          ctx.rotate(m.angle);
          ctx.fillStyle = '#cfd8dc';
          ctx.beginPath();
          ctx.moveTo(8, 0);
          ctx.lineTo(0, 3);
          ctx.lineTo(-6, 0);
          ctx.lineTo(0, -3);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#7a5230';
          ctx.fillRect(-7, -1.5, 3, 3);
          ctx.restore();
          break;
        }
        case 'fireball': {
          ctx.shadowColor = 'rgba(255, 140, 40, 0.95)';
          ctx.shadowBlur = 18;
          ctx.fillStyle = '#ff7a1a';
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#fff1a8';
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius * 0.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
    }
  },
};


/* ============================================================
   Weapon — базовый класс
   ============================================================ */
class Weapon {
  /**
   * @param {object} cfg { id, name, type, baseCooldown, baseDamage, icon }
   */
  constructor(cfg) {
    this.id           = cfg.id;
    this.name         = cfg.name;
    this.type         = cfg.type;          // 'melee' | 'ranged' | 'multi' | 'aoe'
    this.baseCooldown = cfg.baseCooldown;
    this.baseDamage   = cfg.baseDamage;
    this.icon         = cfg.icon;
    this.level        = 1;
    this.cooldown     = 0;                 // текущий таймер
    this.slotIndex    = -1;
    // Визуальные эффекты, если оружие хочет показать что-то поверх героя
    // (см. Sword.swing). Опционально.
  }

  get maxLevel() { return MAX_WEAPON_LEVEL; }

  /** Текущий урон с учётом уровня. Глобальный damageMul применит вызывающий. */
  damageAt() { return this.baseDamage * WEAPON_LEVEL_DAMAGE[this.level - 1]; }
  cooldownAt(player) {
    return this.baseCooldown * WEAPON_LEVEL_CD_MUL[this.level - 1] * player.weaponCdMul;
  }

  upgrade() {
    if (this.level < MAX_WEAPON_LEVEL) this.level += 1;
  }

  /**
   * Базовая реализация — таймер и вызов doAttack(), который переопределяют
   * наследники. Возвращает true, если выстрел произошёл (для UI).
   */
  update(player, enemies, projectiles, dt, helpers) {
    this.cooldown -= dt;
    if (this.cooldown > 0) return false;

    const fired = this.doAttack(player, enemies, projectiles, helpers);
    if (fired) {
      this.cooldown = this.cooldownAt(player);
    } else {
      // если не нашли цель — попробуем снова чуть позже (короткий ретрай)
      this.cooldown = 0.1;
    }
    return fired;
  }

  /** @abstract */
  doAttack(/* player, enemies, projectiles, helpers */) { return false; }

  /** Прогресс готовности 0..1 (для CD-индикатора в HUD). */
  readyProgress(player) {
    const total = this.cooldownAt(player);
    if (total <= 0) return 1;
    return Utils.clamp(1 - this.cooldown / total, 0, 1);
  }
}


/* ============================================================
   1) Sword — ближний бой, AoE по дуге к ближайшему врагу.
   ============================================================ */
class SwordWeapon extends Weapon {
  constructor() {
    super({
      id: 'sword', name: 'Меч', type: 'melee',
      baseCooldown: 0.8, baseDamage: 15, icon: '⚔',
    });
    this.radius      = 60;
    this.arc         = Math.PI * 0.9;
    this.swingTime   = 0.18;
    this.swing       = { active: false, t: 0, angle: 0 };
  }
  tick(dt) {
    if (this.swing.active) {
      this.swing.t += dt;
      if (this.swing.t >= this.swingTime) this.swing.active = false;
    }
  }
  doAttack(player, enemies, _projectiles, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.radius);
    if (!target) return false;
    const damage = this.damageAt() * player.damageMul;
    const dirAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const halfArc = this.arc * 0.5;
    const r2 = this.radius * this.radius;
    const items = enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy > r2) continue;
      const a = Math.atan2(dy, dx);
      let diff = a - dirAngle;
      while (diff > Math.PI)  diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) {
        helpers.damageEnemy(e, damage);
      }
    }
    this.swing.active = true;
    this.swing.t = 0;
    this.swing.angle = dirAngle;
    return true;
  }
  /** Отрисовка взмаха меча. ctx сдвинут на -cam. */
  renderOverlay(ctx, player) {
    if (!this.swing.active) return;
    const t = this.swing.t / this.swingTime;
    const alpha = (1 - t) * 0.85;
    const r = this.radius;
    const half = this.arc * 0.5;
    const a0 = this.swing.angle - half + this.arc * t * 0.4;
    const a1 = this.swing.angle + half + this.arc * t * 0.4;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, a0, a1);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r - 4, a0, a1);
    ctx.stroke();
  }
}


/* ============================================================
   2) Bow — выстрел стрелы в ближайшего врага.
   ============================================================ */
class BowWeapon extends Weapon {
  constructor() {
    super({
      id: 'bow', name: 'Лук', type: 'ranged',
      baseCooldown: 1.2, baseDamage: 12, icon: '🏹',
    });
    this.arrowSpeed = 520;
    this.arrowLife  = 1.6;
    this.range      = 520;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) return false;
    const dir = Utils.norm(target.x - player.x, target.y - player.y);
    const p = projectiles.spawn();
    if (!p) return true; // считаем, что атака произошла, но снарядов не хватило
    p.kind = 'arrow';
    p.x = player.x; p.y = player.y;
    p.vx = dir.x * this.arrowSpeed;
    p.vy = dir.y * this.arrowSpeed;
    p.life = this.arrowLife;
    p.damage = this.damageAt() * player.damageMul;
    p.radius = 4;
    p.angle = Math.atan2(dir.y, dir.x);
    p.source = this.id;
    return true;
  }
}


/* ============================================================
   3) Daggers — три кинжала веером (±20°).
   ============================================================ */
class DaggerWeapon extends Weapon {
  constructor() {
    super({
      id: 'daggers', name: 'Кинжалы', type: 'multi',
      baseCooldown: 1.5, baseDamage: 6, icon: '🗡',
    });
    this.speed = 480;
    this.life  = 1.2;
    this.spread = (20 * Math.PI) / 180; // 20°
    this.range = 600;
  }
  doAttack(player, enemies, projectiles) {
    // Направление — по движению либо к ближайшему врагу
    let dx, dy;
    const moveLen = Math.hypot(player.moveDir.x, player.moveDir.y);
    if (moveLen > 0.1) {
      dx = player.moveDir.x; dy = player.moveDir.y;
    } else {
      const t = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
      if (!t) {
        // Используем последний facing — атака всегда производится.
        dx = player.facing.x; dy = player.facing.y;
      } else {
        const n = Utils.norm(t.x - player.x, t.y - player.y);
        dx = n.x; dy = n.y;
      }
    }
    const baseAngle = Math.atan2(dy, dx);
    const offsets = [-this.spread, 0, this.spread];
    let spawnedAny = false;
    for (let i = 0; i < offsets.length; i++) {
      const a = baseAngle + offsets[i];
      const p = projectiles.spawn();
      if (!p) break;
      p.kind = 'dagger';
      p.x = player.x; p.y = player.y;
      p.vx = Math.cos(a) * this.speed;
      p.vy = Math.sin(a) * this.speed;
      p.life = this.life;
      p.damage = this.damageAt() * player.damageMul;
      p.radius = 5;
      p.angle = a;
      p.source = this.id;
      spawnedAny = true;
    }
    return spawnedAny;
  }
}


/* ============================================================
   4) Fireball — медленный снаряд с AoE-взрывом по таймеру.
   ============================================================ */
class FireballWeapon extends Weapon {
  constructor() {
    super({
      id: 'fireball', name: 'Огненный шар', type: 'aoe',
      baseCooldown: 2.5, baseDamage: 20, icon: '🔥',
    });
    this.flightTime    = 0.6;   // секунды полёта до взрыва
    this.explodeRadius = 80;
    this.range         = 700;
  }
  doAttack(player, enemies, projectiles) {
    // Цель: ближайший враг или направление движения
    let dx, dy;
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (target) {
      const n = Utils.norm(target.x - player.x, target.y - player.y);
      dx = n.x; dy = n.y;
    } else {
      const moveLen = Math.hypot(player.moveDir.x, player.moveDir.y);
      if (moveLen > 0.1) { dx = player.moveDir.x; dy = player.moveDir.y; }
      else { dx = player.facing.x; dy = player.facing.y; }
    }
    const speed = 280;          // медленный, чтобы видеть полёт
    const p = projectiles.spawn();
    if (!p) return false;
    p.kind = 'fireball';
    p.x = player.x; p.y = player.y;
    p.vx = dx * speed;
    p.vy = dy * speed;
    p.life = this.flightTime;
    p.damage = this.damageAt() * player.damageMul;
    p.radius = 12;
    p.explodeRadius = this.explodeRadius;
    p.angle = Math.atan2(dy, dx);
    p.source = this.id;
    return true;
  }
}


/* ---------- Реестр доступных оружий ---------- */
const WEAPON_FACTORIES = {
  sword:    () => new SwordWeapon(),
  bow:      () => new BowWeapon(),
  daggers:  () => new DaggerWeapon(),
  fireball: () => new FireballWeapon(),
};

const WEAPON_INFO = [
  { id: 'sword',    name: 'Меч',           icon: '⚔', desc: 'Удар по ближайшему врагу в радиусе 60 px.' },
  { id: 'bow',      name: 'Лук',           icon: '🏹', desc: 'Стреляет в ближайшего врага.' },
  { id: 'daggers',  name: 'Кинжалы',       icon: '🗡', desc: 'Бросок 3 кинжалов веером.' },
  { id: 'fireball', name: 'Огненный шар',  icon: '🔥', desc: 'Снаряд с AoE-взрывом 80 px.' },
];


// Экспорт
window.Weapon = Weapon;
window.SwordWeapon = SwordWeapon;
window.BowWeapon = BowWeapon;
window.DaggerWeapon = DaggerWeapon;
window.FireballWeapon = FireballWeapon;
window.WEAPON_FACTORIES = WEAPON_FACTORIES;
window.WEAPON_INFO = WEAPON_INFO;
window.MAX_WEAPON_LEVEL = MAX_WEAPON_LEVEL;
window.createProjectile = createProjectile;
window.Projectiles = Projectiles;
