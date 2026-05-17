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
    /** Тип отрисовки/логики:
     *  - игроцкие: 'missile' | 'arrow' | 'dagger' | 'fireball'
     *  - вражеские: 'arrow_e' | 'magebolt' | 'breath' */
    kind: 'missile',
    /** 'player' (по умолчанию) — бьёт врагов; 'enemy' — бьёт игрока. */
    owner: 'player',
    x: 0, y: 0,
    vx: 0, vy: 0,
    life: 0,
    damage: 0,
    radius: 6,
    // Для стрел/кинжалов/дыхания: направление для отрисовки
    angle: 0,
    // Для огненного шара: радиус взрыва
    explodeRadius: 0,
    // Идентификатор источника (имя оружия / тип врага)
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
    const player = (window.Game && Game.player) ? Game.player : null;

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

      if (m.owner === 'enemy') {
        // Вражеский снаряд → проверяем столкновение с игроком
        if (player && player.hp > 0) {
          const r = m.radius + player.size * 0.5;
          const dx = player.x - m.x, dy = player.y - m.y;
          if (dx * dx + dy * dy <= r * r) {
            player.hp -= m.damage;
            m.active = false;
          }
        }
      } else {
        // Игроцкий снаряд → столкновения с врагами
        const eItems = enemies.items;
        for (let j = 0; j < eItems.length; j++) {
          const e = eItems[j];
          if (!e.active) continue;
          if (e.invulnerable) continue;             // мимик в idle / shadow в invisible
          // Bat: 20% шанс уйти от снаряда
          if (e.cfg && e.cfg.behavior === 'bat' && (e.cfg.dodgeChance || 0) > 0) {
            if (Math.random() < e.cfg.dodgeChance) continue;
          }
          const eSize = e.cfg ? Math.max(e.cfg.w, e.cfg.h) : CONFIG.ENEMY.SIZE;
          const r = m.radius + eSize * 0.5;
          const dx = e.x - m.x, dy = e.y - m.y;
          if (dx * dx + dy * dy <= r * r) {
            if (m.kind === 'fireball') {
              Projectiles._fireballExplode(m, enemies, onDamage);
            } else {
              onDamage(e, m.damage);
            }
            m.active = false;
            break;
          }
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
      if (e.invulnerable) continue;
      const dx = e.x - m.x, dy = e.y - m.y;
      if (dx * dx + dy * dy <= er2) {
        onDamage(e, m.damage);
      }
    }
    // Визуальный эффект взрыва (расширяющееся кольцо)
    if (window.Particles && window.Particles.ring) {
      const isSoul = (m.source === 'soul_flame');
      Particles.ring(
        m.x, m.y, m.explodeRadius,
        0.35,
        isSoul ? 'rgba(180, 220, 255, 0.95)' : 'rgba(255, 140, 40, 0.9)',
        4
      );
      Particles.burst(m.x, m.y, 8, {
        color: isSoul ? '#bfe1ff' : '#ff9a3a',
        speedMin: 60, speedMax: 180,
        lifeMin: 0.3, lifeMax: 0.6,
        sizeMin: 2, sizeMax: 4,
      });
    }
    // Эволюция Soul Flame: притягиваем ВСЕ кристаллы опыта на карте
    if (m.source === 'soul_flame' && window.Game && Game.magnetizeAllXP) {
      Game.magnetizeAllXP();
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
        case 'arrow_e': {
          // Вражеская стрела (костяная, тёмно-серая)
          ctx.save();
          ctx.translate(m.x, m.y);
          ctx.rotate(m.angle);
          ctx.fillStyle = '#cfcfcf';
          ctx.fillRect(-9, -2, 18, 4);
          ctx.fillStyle = '#7d3a1f';
          ctx.fillRect(-9, -1, 18, 1);
          ctx.restore();
          break;
        }
        case 'magebolt': {
          // Фиолетовый снаряд мага
          ctx.shadowColor = 'rgba(180, 90, 255, 0.95)';
          ctx.shadowBlur = 14;
          ctx.fillStyle = '#7e57c2';
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#e0c8ff';
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius * 0.45, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'breath': {
          // Дыхание дракончика — оранжевый импульс
          ctx.shadowColor = 'rgba(255, 160, 60, 0.7)';
          ctx.shadowBlur = 10;
          ctx.fillStyle = '#ff8a3a';
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffe28a';
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius * 0.55, 0, Math.PI * 2);
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
    p.owner = 'player';
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
      p.owner = 'player';
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
    p.owner = 'player';
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


/* ============================================================
   EVOLUTIONS — эволюционные оружия (Шаг 3).

   Базовый класс EvolutionWeapon помечает оружие как эволюционное
   (isEvolved = true), хранит ссылку evolvedFrom (id базового
   оружия) и блокирует возможность дальнейших эволюций.
   ============================================================ */
class EvolutionWeapon extends Weapon {
  constructor(cfg) {
    super(cfg);
    this.isEvolved   = true;
    this.evolvedFrom = cfg.evolvedFrom || '';
  }
}


/* ---------- 1) Вампирский клинок: меч + регенерация ----------
   Ближний бой, урон 25 (база), +3 HP за каждое попадание. */
class VampireBladeWeapon extends EvolutionWeapon {
  constructor() {
    super({
      id: 'vampire_blade', name: 'Вампирский клинок', type: 'melee',
      baseCooldown: 0.7, baseDamage: 25, icon: '🩸',
      evolvedFrom: 'sword',
    });
    this.radius    = 70;
    this.arc       = Math.PI; // 180°
    this.swingTime = 0.18;
    this.swing     = { active: false, t: 0, angle: 0 };
    this.lifesteal = 3;       // HP за попадание
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
    let hits = 0;
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
        hits++;
      }
    }
    if (hits > 0) {
      // Вампиризм: +3 HP за каждое попадание
      const heal = this.lifesteal * hits;
      player.hp = Math.min(player.maxHp, player.hp + heal);
      // Маленькие красные искры — индикация вампиризма
      if (window.Particles) {
        Particles.burst(player.x, player.y, 4, {
          color: '#c0392b',
          speedMin: 30, speedMax: 80,
          lifeMin: 0.25, lifeMax: 0.45,
          sizeMin: 2, sizeMax: 3,
        });
      }
    }
    this.swing.active = true;
    this.swing.t = 0;
    this.swing.angle = dirAngle;
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.swing.active) return;
    const t = this.swing.t / this.swingTime;
    const alpha = (1 - t) * 0.9;
    const r = this.radius;
    const half = this.arc * 0.5;
    const a0 = this.swing.angle - half + this.arc * t * 0.4;
    const a1 = this.swing.angle + half + this.arc * t * 0.4;
    // Кроваво-красный взмах
    ctx.strokeStyle = `rgba(220, 60, 50, ${alpha})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, a0, a1);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 200, 200, ${alpha * 0.6})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r - 5, a0, a1);
    ctx.stroke();
  }
}


/* ---------- 2) Скорострельный лук: лук + ускорение ----------
   Стрельба очередями по 3 стрелы (с малым интервалом), урон 15. */
class RapidBowWeapon extends EvolutionWeapon {
  constructor() {
    super({
      id: 'rapid_bow', name: 'Скорострельный лук', type: 'ranged',
      baseCooldown: 1.4, baseDamage: 15, icon: '🌪',
      evolvedFrom: 'bow',
    });
    this.arrowSpeed   = 580;
    this.arrowLife    = 1.6;
    this.range        = 560;
    this.burstCount   = 3;
    this.burstInterval= 0.10; // секунда между стрелами в очереди
    this._burstLeft   = 0;    // оставшиеся выстрелы текущей очереди
    this._burstTimer  = 0;    // таймер до следующей стрелы в очереди
    this._lastDir     = { x: 1, y: 0 };
  }

  // Переопределяем update, чтобы реализовать "очередь"
  update(player, enemies, projectiles, dt /*, helpers */) {
    // Пока идёт очередь — шлём стрелы по таймеру, не трогая основной CD
    if (this._burstLeft > 0) {
      this._burstTimer -= dt;
      while (this._burstLeft > 0 && this._burstTimer <= 0) {
        this._fireOne(player, projectiles, this._lastDir);
        this._burstLeft -= 1;
        this._burstTimer += this.burstInterval;
      }
      if (this._burstLeft <= 0) {
        // Очередь завершена — стандартный кулдаун
        this.cooldown = this.cooldownAt(player);
      }
      return;
    }
    // Обычный путь: ждём CD, выбираем цель, начинаем очередь
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) { this.cooldown = 0.1; return; }
    const dir = Utils.norm(target.x - player.x, target.y - player.y);
    this._lastDir = dir;
    this._burstLeft = this.burstCount;
    this._burstTimer = 0; // выстрелим первую стрелу немедленно
  }

  _fireOne(player, projectiles, dir) {
    const p = projectiles.spawn();
    if (!p) return;
    p.kind = 'arrow';
    p.owner = 'player';
    p.x = player.x; p.y = player.y;
    // Маленький вертикальный разлёт между стрелами очереди
    const jitter = (Math.random() - 0.5) * 0.05;
    const a = Math.atan2(dir.y, dir.x) + jitter;
    p.vx = Math.cos(a) * this.arrowSpeed;
    p.vy = Math.sin(a) * this.arrowSpeed;
    p.life = this.arrowLife;
    p.damage = this.damageAt() * player.damageMul;
    p.radius = 4;
    p.angle = a;
    p.source = this.id;
  }
}


/* ---------- 3) Шквал клинков: кинжалы + усиление урона ----------
   5 кинжалов веером, урон 12, крит. шанс 20% (×2). */
class BladeStormWeapon extends EvolutionWeapon {
  constructor() {
    super({
      id: 'blade_storm', name: 'Шквал клинков', type: 'multi',
      baseCooldown: 1.4, baseDamage: 12, icon: '💥',
      evolvedFrom: 'daggers',
    });
    this.speed     = 520;
    this.life      = 1.2;
    this.spread    = (18 * Math.PI) / 180;  // ±18° от центра
    this.range     = 600;
    this.count     = 5;
    this.critChance= 0.20;
    this.critMul   = 2.0;
  }
  doAttack(player, enemies, projectiles) {
    let dx, dy;
    const moveLen = Math.hypot(player.moveDir.x, player.moveDir.y);
    if (moveLen > 0.1) {
      dx = player.moveDir.x; dy = player.moveDir.y;
    } else {
      const t = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
      if (!t) { dx = player.facing.x; dy = player.facing.y; }
      else {
        const n = Utils.norm(t.x - player.x, t.y - player.y);
        dx = n.x; dy = n.y;
      }
    }
    const baseAngle = Math.atan2(dy, dx);
    // Веером: count кинжалов от -spread*2 до +spread*2
    const total = this.count;
    const halfSpan = this.spread * 2;
    let any = false;
    for (let i = 0; i < total; i++) {
      // i = 0..total-1 -> offset = -halfSpan..+halfSpan
      const t = total === 1 ? 0 : (i / (total - 1)) * 2 - 1; // -1..1
      const a = baseAngle + t * halfSpan;
      const p = projectiles.spawn();
      if (!p) break;
      p.kind = 'dagger';
      p.owner = 'player';
      p.x = player.x; p.y = player.y;
      p.vx = Math.cos(a) * this.speed;
      p.vy = Math.sin(a) * this.speed;
      p.life = this.life;
      let dmg = this.damageAt() * player.damageMul;
      if (Math.random() < this.critChance) dmg *= this.critMul;
      p.damage = dmg;
      p.radius = 5;
      p.angle = a;
      p.source = this.id;
      any = true;
    }
    return any;
  }
}


/* ---------- 4) Пламя души: огненный шар + магнит опыта ----------
   Взрыв (урон 30) дополнительно притягивает весь опыт на карте. */
class SoulFlameWeapon extends EvolutionWeapon {
  constructor() {
    super({
      id: 'soul_flame', name: 'Пламя души', type: 'aoe',
      baseCooldown: 2.4, baseDamage: 30, icon: '👻',
      evolvedFrom: 'fireball',
    });
    this.flightTime    = 0.6;
    this.explodeRadius = 110;   // увеличенный AoE
    this.range         = 720;
    this.speed         = 300;
  }
  doAttack(player, enemies, projectiles) {
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
    const p = projectiles.spawn();
    if (!p) return false;
    p.kind = 'fireball';
    p.owner = 'player';
    p.x = player.x; p.y = player.y;
    p.vx = dx * this.speed;
    p.vy = dy * this.speed;
    p.life = this.flightTime;
    p.damage = this.damageAt() * player.damageMul;
    p.radius = 14;
    p.explodeRadius = this.explodeRadius;
    p.angle = Math.atan2(dy, dx);
    p.source = this.id;        // помечаем "soul_flame" — обработчик взрыва видит
    return true;
  }
}


/* Реестр эволюционных оружий */
const EVOLVED_WEAPON_FACTORIES = {
  vampire_blade: () => new VampireBladeWeapon(),
  rapid_bow:     () => new RapidBowWeapon(),
  blade_storm:   () => new BladeStormWeapon(),
  soul_flame:    () => new SoulFlameWeapon(),
};


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

// Эволюции (Шаг 3)
window.EvolutionWeapon = EvolutionWeapon;
window.VampireBladeWeapon = VampireBladeWeapon;
window.RapidBowWeapon = RapidBowWeapon;
window.BladeStormWeapon = BladeStormWeapon;
window.SoulFlameWeapon = SoulFlameWeapon;
window.EVOLVED_WEAPON_FACTORIES = EVOLVED_WEAPON_FACTORIES;
