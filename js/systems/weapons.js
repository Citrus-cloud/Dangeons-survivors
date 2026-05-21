'use strict';
/* ============================================================
   weapons.js — Система оружия и снарядов.
   
   Содержит:
   • Множители урона/кулдауна по уровням оружия (1..5)
   • createProjectile() — фабрика для пула снарядов
   • Projectiles — обновление, рендер и поиск целей для снарядов
   • WEAPON_INFO[] — описание всех 20 типов оружия
   • WEAPON_FACTORIES{} — фабрики создания оружий
   
   Система уровней:
   Каждое оружие имеет уровни 1..5.
   За уровень: +12% урона, -5% кулдауна (~+10-15% DPS).
   
   Зависимости:
   CONFIG, Utils, Player, Game, Bosses, GameMap, Particles
   
   Экспорт: window.{createProjectile, Projectiles, WEAPON_INFO, WEAPON_FACTORIES}
   ============================================================ */

// Множители урона по уровню оружия (индекс = level - 1)
const WEAPON_LEVEL_DAMAGE  = [1.00, 1.12, 1.25, 1.40, 1.56];
// Множители кулдауна по уровню (снижение)
const WEAPON_LEVEL_CD_MUL  = [1.00, 0.95, 0.90, 0.85, 0.80];
// Максимальный уровень оружия
const MAX_WEAPON_LEVEL = 5;


/* ============================================================
   Снаряды (Projectile) — общий пул для всех типов снарядов.
   Используется как оружием игрока, так и врагами/боссами.
   ============================================================ */

/**
 * Фабрика объекта-снаряда для ObjectPool.
 * @returns {Object} Пустой снаряд с active: false
 */
function createProjectile() {
  return {
    active: false,
    kind: 'missile',
    owner: 'player',
    x: 0, y: 0,
    vx: 0, vy: 0,
    life: 0,
    damage: 0,
    radius: 6,
    angle: 0,
    explodeRadius: 0,
    source: '',
    homing: false,
    homingStrength: 0,
    slowPct: 0,
    slowDuration: 0,
    // Шаг 7: pierce (пробивание — для арбалета)
    pierce: false,
    // Шаг 7: для вращающихся снарядов (топоры)
    spin: 0,
    // Шаг 7: AoE при приземлении (праща)
    aoeRadius: 0,
    // Шаг 7: замедление от ледяной стрелы
    slowEnemy: 0,
    slowEnemyDuration: 0,
  };
}

const Projectiles = {
  /** Найти ближайшего активного врага в радиусе.
   *  Bug fix: также проверяет боссов (Bosses.current / Bosses.guardian),
   *  чтобы оружия стреляли в боссов когда те ближайшая цель. */
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
    // Bug fix #2: включаем боссов в поиск ближайшего врага
    if (window.Bosses) {
      const bossList = [Bosses.current, Bosses.guardian];
      for (const boss of bossList) {
        if (!boss || boss.hp <= 0) continue;
        const dx = boss.x - x, dy = boss.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) { bestD2 = d2; best = boss; }
      }
    }
    return best;
  },

  /** Найти N ближайших врагов (включая боссов). */
  findNearestEnemies(enemies, x, y, maxRadius, count) {
    const r2 = maxRadius * maxRadius;
    const found = [];
    const items = enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const dx = e.x - x, dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < r2) found.push({ e, d2 });
    }
    // Bug fix #2: включаем боссов в поиск множественных целей
    if (window.Bosses) {
      const bossList = [Bosses.current, Bosses.guardian];
      for (const boss of bossList) {
        if (!boss || boss.hp <= 0) continue;
        const dx = boss.x - x, dy = boss.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2) found.push({ e: boss, d2 });
      }
    }
    found.sort((a, b) => a.d2 - b.d2);
    return found.slice(0, count).map(f => f.e);
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
      if (m.spin) m.angle += m.spin * dt;

      // Огненный шар: при истечении life — взрыв (AoE)
      if (m.kind === 'fireball' && m.life <= 0) {
        Projectiles._fireballExplode(m, enemies, onDamage);
        m.active = false;
        continue;
      }

      // Праща: при истечении — AoE приземление
      if (m.kind === 'sling_stone' && m.life <= 0) {
        Projectiles._slingExplode(m, enemies, onDamage);
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
            // Шаг 8: используем Player.takeDamage
            if (Player.takeDamage) Player.takeDamage(player, m.damage, null);
            else player.hp -= m.damage;
            if (m.kind === 'boss_web' && m.slowPct) {
              // Шаг 8: сопротивление снижает длительность замедления
              let webDur = m.slowDuration || 2.0;
              if (player.debuffReduction > 0) webDur *= (1 - Math.min(player.debuffReduction, 0.75));
              player.webSlow = webDur;
            }
            if (m.kind === 'boss_fireball' && m.explodeRadius > 0) {
              if (window.Particles) {
                Particles.ring(m.x, m.y, m.explodeRadius, 0.3, 'rgba(255, 100, 0, 0.8)', 4);
                Particles.burst(m.x, m.y, 8, {
                  color: '#ff6600', speedMin: 50, speedMax: 140,
                  lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
                });
              }
            }
            m.active = false;
          }
        }
      } else {
        // Игроцкий снаряд → столкновения с врагами
        const eItems = enemies.items;
        for (let j = 0; j < eItems.length; j++) {
          const e = eItems[j];
          if (!e.active) continue;
          if (e.invulnerable) continue;
          // Пробивающий снаряд: пропускаем уже поражённых
          if (m.pierce && m._hitSet && m._hitSet.has(j)) continue;
          if (e.cfg && e.cfg.behavior === 'bat' && (e.cfg.dodgeChance || 0) > 0) {
            if (Math.random() < e.cfg.dodgeChance) continue;
          }
          const eSize = e.cfg ? Math.max(e.cfg.w, e.cfg.h) : CONFIG.ENEMY.SIZE;
          const r = m.radius + eSize * 0.5;
          const dx = e.x - m.x, dy = e.y - m.y;
          if (dx * dx + dy * dy <= r * r) {
            if (m.kind === 'fireball') {
              Projectiles._fireballExplode(m, enemies, onDamage);
              m.active = false;
              break;
            }
            onDamage(e, m.damage);
            // Замедление от ледяной стрелы
            if (m.slowEnemy > 0) {
              e._slowFactor = m.slowEnemy;
              e._slowTimer = m.slowEnemyDuration;
            }
            // Шаг 9: гарантированное кровотечение (Казнь)
            if (m.guaranteedBleed) {
              if (!e.bleed) e.bleed = { dps: 0, remaining: 0 };
              e.bleed.dps = 8; e.bleed.remaining = 3;
            }
            // Pierce: пробивающие снаряды не деактивируются
            if (m.pierce) {
              // Помечаем врага чтобы не бить дважды в одном снаряде
              if (!m._hitSet) m._hitSet = new Set();
              m._hitSet.add(j);
              continue;
            }
            m.active = false;
            break;
          }
        }
      }
    }
  },

  /** AoE-урон от огненного шара. */
  _fireballExplode(m, enemies, onDamage) {
    // Шаг 18: звук взрыва
    if (window.GameAudio) GameAudio.playSfx('explosion');
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
    if (window.Particles && window.Particles.ring) {
      const isSoul = (m.source === 'soul_flame');
      Particles.ring(m.x, m.y, m.explodeRadius, 0.35,
        isSoul ? 'rgba(180, 220, 255, 0.95)' : 'rgba(255, 140, 40, 0.9)', 4);
      Particles.burst(m.x, m.y, 8, {
        color: isSoul ? '#bfe1ff' : '#ff9a3a',
        speedMin: 60, speedMax: 180, lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 4,
      });
    }
    if (m.source === 'soul_flame' && window.Game && Game.magnetizeAllXP) {
      Game.magnetizeAllXP();
    }
  },

  /** AoE-урон от пращи при приземлении. */
  _slingExplode(m, enemies, onDamage) {
    const er2 = m.aoeRadius * m.aoeRadius;
    const eItems = enemies.items;
    for (let j = 0; j < eItems.length; j++) {
      const e = eItems[j];
      if (!e.active || e.invulnerable) continue;
      const dx = e.x - m.x, dy = e.y - m.y;
      if (dx * dx + dy * dy <= er2) {
        onDamage(e, m.damage);
      }
    }
    if (window.Particles) {
      Particles.ring(m.x, m.y, m.aoeRadius, 0.25, 'rgba(160, 140, 100, 0.8)', 3);
      Particles.burst(m.x, m.y, 5, {
        color: '#a09070', speedMin: 40, speedMax: 100,
        lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 3,
      });
    }
  },

  /** Отрисовка снарядов — редизайн: градиенты, свечения, хвосты */
  render(ctx, pool, cam, viewW, viewH) {
    ctx.imageSmoothingEnabled = false;
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    const items = pool.items;
    const PS = window.PROJECTILE_SPRITES;
    const t = Date.now() * 0.001; // для анимаций

    for (let i = 0; i < items.length; i++) {
      const m = items[i];
      if (!m.active) continue;
      if (m.x < minX - 40 || m.x > maxX + 40 || m.y < minY - 40 || m.y > maxY + 40) continue;

      // Пиксельный спрайт (если есть) — с добавлением свечения
      const sprite = PS ? PS[m.kind] : null;
      if (sprite) {
        const drawSize = Math.max(m.radius * 2.5, 16);
        const half = drawSize / 2;
        // Мягкое свечение для снарядов игрока
        if (m.owner === 'player') {
          ctx.shadowColor = 'rgba(200, 220, 255, 0.5)';
          ctx.shadowBlur = 4;
        }
        ctx.save();
        ctx.translate(m.x, m.y);
        if (m.angle) ctx.rotate(m.angle);
        ctx.drawImage(sprite, -half, -half, drawSize, drawSize);
        ctx.restore();
        ctx.shadowBlur = 0;
        continue;
      }

      // --- Улучшенные fallback-рендеры ---
      switch (m.kind) {
        case 'arrow_e': {
          // Стрела врага: деревянное древко + металлический наконечник
          ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.angle);
          // Древко
          ctx.fillStyle = '#8b5a2b'; ctx.fillRect(-8, -1, 14, 2);
          // Наконечник (треугольник)
          ctx.fillStyle = '#c0c8d0';
          ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(5, -2); ctx.lineTo(5, 2); ctx.closePath(); ctx.fill();
          // Оперение
          ctx.fillStyle = '#aaa'; ctx.fillRect(-8, -2, 3, 1); ctx.fillRect(-8, 1, 3, 1);
          ctx.restore(); break;
        }
        case 'magebolt': {
          // Магическая сфера: фиолетовый градиент + пульсация
          const pulse = 1 + Math.sin(t * 8 + i) * 0.12;
          const r = m.radius * pulse;
          const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r * 1.5);
          grad.addColorStop(0, '#e0c8ff');
          grad.addColorStop(0.4, '#9955dd');
          grad.addColorStop(1, 'rgba(100,30,180,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(m.x, m.y, r * 1.5, 0, Math.PI * 2); ctx.fill();
          // Ядро
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(m.x, m.y, r * 0.35, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'breath': {
          // Дыхание дракона: оранжевый конус с частицами
          const pulse = 1 + Math.sin(t * 10 + i * 2) * 0.1;
          const r = m.radius * pulse;
          const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r * 1.3);
          grad.addColorStop(0, '#ffee88');
          grad.addColorStop(0.5, '#ff8800');
          grad.addColorStop(1, 'rgba(200,60,0,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(m.x, m.y, r * 1.3, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'boss_bolt': {
          // Тёмный болт босса: чёрное ядро + фиолетовая аура
          const pulse = 1 + Math.sin(t * 6 + i) * 0.1;
          const r = m.radius * pulse;
          ctx.shadowColor = 'rgba(140, 0, 255, 0.9)'; ctx.shadowBlur = 16;
          ctx.fillStyle = '#4400aa';
          ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          // Тёмное ядро
          ctx.fillStyle = '#0a001a';
          ctx.beginPath(); ctx.arc(m.x, m.y, r * 0.4, 0, Math.PI * 2); ctx.fill();
          // Искры
          ctx.fillStyle = '#cc66ff';
          for (let s = 0; s < 3; s++) {
            const a = t * 4 + s * 2.09;
            ctx.fillRect(m.x + Math.cos(a) * r * 0.7, m.y + Math.sin(a) * r * 0.7, 2, 2);
          }
          break;
        }
        case 'boss_web': {
          // Паутина босса: белый клубок с нитями
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = '#f0f0f8';
          ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          // Нити
          ctx.strokeStyle = 'rgba(200, 200, 220, 0.6)'; ctx.lineWidth = 0.8;
          for (let s = 0; s < 4; s++) {
            const a = s * Math.PI / 2 + t * 2;
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(m.x + Math.cos(a) * m.radius * 1.2, m.y + Math.sin(a) * m.radius * 1.2);
            ctx.stroke();
          }
          break;
        }
        case 'boss_fireball': {
          // Огненный шар босса: большой, с пульсацией и хвостом
          const pulse = 1 + Math.sin(t * 8) * 0.15;
          const r = m.radius * pulse;
          // Хвост (затухающий след)
          ctx.globalAlpha = 0.3;
          const tailX = m.x - Math.cos(m.angle) * r * 2;
          const tailY = m.y - Math.sin(m.angle) * r * 2;
          const tGrad = ctx.createRadialGradient(tailX, tailY, 0, tailX, tailY, r);
          tGrad.addColorStop(0, '#ff6600'); tGrad.addColorStop(1, 'rgba(200,60,0,0)');
          ctx.fillStyle = tGrad;
          ctx.beginPath(); ctx.arc(tailX, tailY, r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          // Основной шар
          const fGrad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
          fGrad.addColorStop(0, '#ffffff');
          fGrad.addColorStop(0.3, '#ffcc00');
          fGrad.addColorStop(0.7, '#ff4400');
          fGrad.addColorStop(1, 'rgba(150,20,0,0)');
          ctx.fillStyle = fGrad;
          ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'fireball': {
          // Огненный шар игрока: яркий, с градиентом
          const pulse = 1 + Math.sin(t * 10 + i) * 0.1;
          const r = m.radius * pulse;
          const fGrad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
          fGrad.addColorStop(0, '#fff8e0');
          fGrad.addColorStop(0.4, '#ffaa00');
          fGrad.addColorStop(1, 'rgba(200,60,0,0)');
          ctx.fillStyle = fGrad;
          ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'sling_stone': {
          // Камень пращи: серый с тенью
          ctx.fillStyle = '#6a6a5a';
          ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#999';
          ctx.beginPath(); ctx.arc(m.x - 1, m.y - 1, m.radius * 0.5, 0, Math.PI * 2); ctx.fill();
          break;
        }
        default: {
          // Универсальный: градиентный кружок с свечением
          const grad = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.radius);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.5, '#a0b0ff');
          grad.addColorStop(1, 'rgba(100,120,255,0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(m.x, m.y, m.radius * 1.2, 0, Math.PI * 2); ctx.fill();
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
  constructor(cfg) {
    this.id           = cfg.id;
    this.name         = cfg.name;
    this.type         = cfg.type;
    this.baseCooldown = cfg.baseCooldown;
    this.baseDamage   = cfg.baseDamage;
    this.icon         = cfg.icon;
    this.desc         = cfg.desc || '';
    this.level        = 1;
    this.cooldown     = 0;
    this.slotIndex    = -1;
  }

  get maxLevel() { return MAX_WEAPON_LEVEL; }

  damageAt() { return this.baseDamage * WEAPON_LEVEL_DAMAGE[this.level - 1]; }
  cooldownAt(player) {
    return this.baseCooldown * WEAPON_LEVEL_CD_MUL[this.level - 1] * player.weaponCdMul;
  }

  upgrade() { if (this.level < MAX_WEAPON_LEVEL) this.level += 1; }

  /** Шаг 8: полный множитель урона с учётом магического усиления. */
  totalDamageMul(player) {
    let mul = player.damageMul;
    if (this.type === 'magic' && player.magicDamageMul) mul *= player.magicDamageMul;
    return mul;
  }

  update(player, enemies, projectiles, dt, helpers) {
    this.cooldown -= dt;
    if (this.cooldown > 0) return false;
    const fired = this.doAttack(player, enemies, projectiles, helpers);
    if (fired) {
      this.cooldown = this.cooldownAt(player);
      // Шаг 3 (анимации): лёгкие вспышки при атаке
      if (window.Particles) {
        if (this.type === 'ranged') {
          // Вспышка на позиции оружия (жёлтая точка)
          Particles.attackSparks(player.x, player.y, 2, '#ffdd44');
        } else if (this.type === 'magic') {
          // Фиолетовые искры при магии
          Particles.attackSparks(player.x, player.y, 2, '#b388ff');
        } else if (this.type === 'aoe' || this.type === 'explosive') {
          // Оранжевая вспышка для AoE
          Particles.attackSparks(player.x, player.y, 3, '#ff9944');
        }
        // melee — не нужно, есть renderOverlay дуги
      }
      // Шаг 18: звук атаки оружия
      if (window.GameAudio) {
        if (this.type === 'melee') GameAudio.playSfx('sword');
        else if (this.type === 'ranged') GameAudio.playSfx('bow');
        else if (this.type === 'magic') GameAudio.playSfx('magic');
        else if (this.type === 'explosive') GameAudio.playSfx('explosion');
      }
    } else {
      this.cooldown = 0.1;
    }
    return fired;
  }

  doAttack() { return false; }

  /** Feature #6: получить бонусное количество снарядов от таланта Ловкости. */
  getBonusProjectiles(player) {
    return player._talentBonusProjectiles || 0;
  }

  readyProgress(player) {
    const total = this.cooldownAt(player);
    if (total <= 0) return 1;
    return Utils.clamp(1 - this.cooldown / total, 0, 1);
  }
}


/* ============================================================
   1) Sword — ближний бой, AoE по дуге.
   ============================================================ */
class SwordWeapon extends Weapon {
  constructor() {
    super({ id: 'sword', name: t('weapon_sword'), type: 'melee', baseCooldown: 0.9, baseDamage: 18, icon: '⚔', desc: t('weapon_sword_desc') });
    this.radius = 60; this.arc = Math.PI * 0.9; this.swingTime = 0.18;
    this.swing = { active: false, t: 0, angle: 0 };
  }
  tick(dt) { if (this.swing.active) { this.swing.t += dt; if (this.swing.t >= this.swingTime) this.swing.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.radius);
    if (!target) return false;
    const damage = this.damageAt() * this.totalDamageMul(player);
    const dirAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const halfArc = this.arc * 0.5;
    const r2 = this.radius * this.radius;
    const items = enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy > r2) continue;
      let diff = Math.atan2(dy, dx) - dirAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) helpers.damageEnemy(e, damage);
    }
    this.swing.active = true; this.swing.t = 0; this.swing.angle = dirAngle;
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.swing.active) return;
    const t = this.swing.t / this.swingTime;
    const alpha = (1 - t) * 0.85;
    const r = this.radius;
    const half = this.arc * 0.5;
    const a0 = this.swing.angle - half + this.arc * t * 0.4;
    const a1 = this.swing.angle + half + this.arc * t * 0.4;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(player.x, player.y, r, a0, a1); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.6})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(player.x, player.y, r - 4, a0, a1); ctx.stroke();
  }
}


/* ============================================================
   2) Bow — выстрел стрелы.
   ============================================================ */
class BowWeapon extends Weapon {
  constructor() {
    super({ id: 'bow', name: t('weapon_bow'), type: 'ranged', baseCooldown: 1.2, baseDamage: 14, icon: '🏹', desc: t('weapon_bow_desc') });
    this.arrowSpeed = 520; this.arrowLife = 1.6; this.range = 520;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) return false;
    const dir = Utils.norm(target.x - player.x, target.y - player.y);
    const p = projectiles.spawn(); if (!p) return true;
    p.kind = 'arrow'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    p.vx = dir.x * this.arrowSpeed; p.vy = dir.y * this.arrowSpeed;
    p.life = this.arrowLife; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 4; p.angle = Math.atan2(dir.y, dir.x); p.source = this.id;
    p.pierce = false; p.slowEnemy = 0;
    return true;
  }
}


/* ============================================================
   3) Daggers — три кинжала веером.
   ============================================================ */
class DaggerWeapon extends Weapon {
  constructor() {
    super({ id: 'daggers', name: t('weapon_daggers'), type: 'multi', baseCooldown: 1.5, baseDamage: 7, icon: '🗡', desc: t('weapon_daggers_desc') });
    this.speed = 480; this.life = 1.2; this.spread = (20 * Math.PI) / 180; this.range = 600;
  }
  doAttack(player, enemies, projectiles) {
    let dx, dy;
    const moveLen = Math.hypot(player.moveDir.x, player.moveDir.y);
    if (moveLen > 0.1) { dx = player.moveDir.x; dy = player.moveDir.y; }
    else {
      const t = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
      if (!t) { dx = player.facing.x; dy = player.facing.y; }
      else { const n = Utils.norm(t.x - player.x, t.y - player.y); dx = n.x; dy = n.y; }
    }
    const baseAngle = Math.atan2(dy, dx);
    // Feature #6: бонусные снаряды от таланта Ловкости
    const bonusProj = this.getBonusProjectiles(player);
    const totalCount = 3 + bonusProj;
    const offsets = [];
    for (let i = 0; i < totalCount; i++) {
      offsets.push((i - (totalCount - 1) / 2) * this.spread);
    }
    let any = false;
    for (let i = 0; i < offsets.length; i++) {
      const a = baseAngle + offsets[i];
      const p = projectiles.spawn(); if (!p) break;
      p.kind = 'dagger'; p.owner = 'player'; p.x = player.x; p.y = player.y;
      p.vx = Math.cos(a) * this.speed; p.vy = Math.sin(a) * this.speed;
      p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
      p.radius = 5; p.angle = a; p.source = this.id; p.pierce = false; p.slowEnemy = 0;
      any = true;
    }
    return any;
  }
}


/* ============================================================
   4) Fireball — снаряд с AoE-взрывом.
   ============================================================ */
class FireballWeapon extends Weapon {
  constructor() {
    super({ id: 'fireball', name: t('weapon_fireball'), type: 'aoe', baseCooldown: 2.5, baseDamage: 22, icon: '🔥', desc: t('weapon_fireball_desc') });
    this.flightTime = 0.6; this.explodeRadius = 80; this.range = 700;
  }
  doAttack(player, enemies, projectiles) {
    let dx, dy;
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (target) { const n = Utils.norm(target.x - player.x, target.y - player.y); dx = n.x; dy = n.y; }
    else {
      const moveLen = Math.hypot(player.moveDir.x, player.moveDir.y);
      if (moveLen > 0.1) { dx = player.moveDir.x; dy = player.moveDir.y; }
      else { dx = player.facing.x; dy = player.facing.y; }
    }
    const speed = 280;
    const p = projectiles.spawn(); if (!p) return false;
    p.kind = 'fireball'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    p.vx = dx * speed; p.vy = dy * speed;
    p.life = this.flightTime; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 12; p.explodeRadius = this.explodeRadius;
    p.angle = Math.atan2(dy, dx); p.source = this.id; p.pierce = false; p.slowEnemy = 0;
    return true;
  }
}



/* ============================================================
   5) Axe — Секира: широкий конус 140°.
   ============================================================ */
class AxeWeapon extends Weapon {
  constructor() {
    super({ id: 'axe', name: t('weapon_axe'), type: 'melee', baseCooldown: 1.0, baseDamage: 20, icon: '🪓', desc: t('weapon_axe_desc') });
    this.radius = 65; this.arc = (140 * Math.PI) / 180; this.swingTime = 0.20;
    this.swing = { active: false, t: 0, angle: 0 };
  }
  tick(dt) { if (this.swing.active) { this.swing.t += dt; if (this.swing.t >= this.swingTime) this.swing.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.radius);
    if (!target) return false;
    const damage = this.damageAt() * this.totalDamageMul(player);
    const dirAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const halfArc = this.arc * 0.5;
    const r2 = this.radius * this.radius;
    const items = enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy > r2) continue;
      let diff = Math.atan2(dy, dx) - dirAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) helpers.damageEnemy(e, damage);
    }
    this.swing.active = true; this.swing.t = 0; this.swing.angle = dirAngle;
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
    ctx.strokeStyle = `rgba(200,200,200,${alpha})`; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(player.x, player.y, r, a0, a1); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.5})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(player.x, player.y, r - 5, a0, a1); ctx.stroke();
  }
}


/* ============================================================
   6) Spear — Копьё: удар по прямой.
   ============================================================ */
class SpearWeapon extends Weapon {
  constructor() {
    super({ id: 'spear', name: t('weapon_spear'), type: 'melee', baseCooldown: 0.9, baseDamage: 18, icon: '🔱', desc: t('weapon_spear_desc') });
    this.range = 100; this.width = 20; this.thrustTime = 0.15;
    this.thrust = { active: false, t: 0, angle: 0 };
  }
  tick(dt) { if (this.thrust.active) { this.thrust.t += dt; if (this.thrust.t >= this.thrustTime) this.thrust.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range + 30);
    if (!target) return false;
    const damage = this.damageAt() * this.totalDamageMul(player);
    const dirAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const cos = Math.cos(dirAngle), sin = Math.sin(dirAngle);
    const items = enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const along = dx * cos + dy * sin;
      const across = -dx * sin + dy * cos;
      if (along >= 0 && along <= this.range && Math.abs(across) <= this.width / 2) {
        helpers.damageEnemy(e, damage);
      }
    }
    this.thrust.active = true; this.thrust.t = 0; this.thrust.angle = dirAngle;
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.thrust.active) return;
    const t = this.thrust.t / this.thrustTime;
    const alpha = (1 - t) * 0.9;
    const len = this.range * (0.5 + 0.5 * (1 - t));
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(this.thrust.angle);
    ctx.strokeStyle = `rgba(180,180,180,${alpha})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
    // Наконечник
    ctx.fillStyle = `rgba(220,220,220,${alpha})`;
    ctx.beginPath(); ctx.moveTo(len, 0); ctx.lineTo(len - 8, -5); ctx.lineTo(len - 8, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}


/* ============================================================
   7) Hammer — Молот: AoE вокруг героя.
   ============================================================ */
class HammerWeapon extends Weapon {
  constructor() {
    super({ id: 'hammer', name: t('weapon_hammer'), type: 'melee', baseCooldown: 1.5, baseDamage: 30, icon: '🔨', desc: t('weapon_hammer_desc') });
    this.radius = 70; this.slamTime = 0.25;
    this.slam = { active: false, t: 0 };
  }
  tick(dt) { if (this.slam.active) { this.slam.t += dt; if (this.slam.t >= this.slamTime) this.slam.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.radius);
    if (!target) return false;
    const damage = this.damageAt() * this.totalDamageMul(player);
    const r2 = this.radius * this.radius;
    const items = enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy <= r2) helpers.damageEnemy(e, damage);
    }
    this.slam.active = true; this.slam.t = 0;
    if (window.Particles) {
      Particles.ring(player.x, player.y, this.radius, 0.2, 'rgba(180,180,180,0.7)', 3);
      Particles.burst(player.x, player.y, 6, { color: '#999', speedMin: 40, speedMax: 100, lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 3 });
    }
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.slam.active) return;
    const t = this.slam.t / this.slamTime;
    const alpha = (1 - t) * 0.6;
    ctx.strokeStyle = `rgba(180,180,180,${alpha})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius * t, 0, Math.PI * 2); ctx.stroke();
  }
}


/* ============================================================
   8) Whip — Кнут: атака по дальнему врагу в радиусе.
   ============================================================ */
class WhipWeapon extends Weapon {
  constructor() {
    super({ id: 'whip', name: t('weapon_whip'), type: 'melee', baseCooldown: 0.7, baseDamage: 14, icon: '〰', desc: t('weapon_whip_desc') });
    this.range = 120; this.whipTime = 0.2;
    this.whipAnim = { active: false, t: 0, tx: 0, ty: 0 };
  }
  tick(dt) { if (this.whipAnim.active) { this.whipAnim.t += dt; if (this.whipAnim.t >= this.whipTime) this.whipAnim.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    // Бьём самого дальнего врага в радиусе (а не ближайшего)
    let farthest = null, farthestD2 = 0;
    const r2 = this.range * this.range;
    const items = enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2 && d2 > farthestD2) { farthestD2 = d2; farthest = e; }
    }
    if (!farthest) return false;
    helpers.damageEnemy(farthest, this.damageAt() * this.totalDamageMul(player));
    this.whipAnim.active = true; this.whipAnim.t = 0;
    this.whipAnim.tx = farthest.x; this.whipAnim.ty = farthest.y;
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.whipAnim.active) return;
    const t = this.whipAnim.t / this.whipTime;
    const alpha = (1 - t) * 0.9;
    ctx.strokeStyle = `rgba(200,160,100,${alpha})`; ctx.lineWidth = 2;
    ctx.beginPath();
    const mx = (player.x + this.whipAnim.tx) / 2 + Math.sin(t * Math.PI * 3) * 15;
    const my = (player.y + this.whipAnim.ty) / 2 + Math.cos(t * Math.PI * 3) * 15;
    ctx.moveTo(player.x, player.y);
    ctx.quadraticCurveTo(mx, my, this.whipAnim.tx, this.whipAnim.ty);
    ctx.stroke();
  }
}



/* ============================================================
   9) Crossbow — Арбалет: пробивающий выстрел.
   ============================================================ */
class CrossbowWeapon extends Weapon {
  constructor() {
    super({ id: 'crossbow', name: t('weapon_crossbow'), type: 'ranged', baseCooldown: 1.8, baseDamage: 28, icon: '⊕', desc: t('weapon_crossbow_desc') });
    this.speed = 450; this.life = 2.0; this.range = 600;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) return false;
    const dir = Utils.norm(target.x - player.x, target.y - player.y);
    const p = projectiles.spawn(); if (!p) return true;
    p.kind = 'crossbow_bolt'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    p.vx = dir.x * this.speed; p.vy = dir.y * this.speed;
    p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 5; p.angle = Math.atan2(dir.y, dir.x); p.source = this.id;
    p.pierce = true; p._hitSet = new Set(); p.slowEnemy = 0;
    return true;
  }
}


/* ============================================================
   10) Throwing Axes — Метательные топоры: 2 веером.
   ============================================================ */
class ThrowingAxesWeapon extends Weapon {
  constructor() {
    super({ id: 'throwing_axes', name: t('weapon_throwing_axes'), type: 'ranged', baseCooldown: 1.0, baseDamage: 10, icon: '⚒', desc: t('weapon_throwing_axes_desc') });
    this.speed = 400; this.life = 1.4; this.range = 500;
    this.spreadAngle = (10 * Math.PI) / 180;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    let dx, dy;
    if (target) { const n = Utils.norm(target.x - player.x, target.y - player.y); dx = n.x; dy = n.y; }
    else { dx = player.facing.x; dy = player.facing.y; }
    const baseAngle = Math.atan2(dy, dx);
    const offsets = [-this.spreadAngle, this.spreadAngle];
    let any = false;
    for (const off of offsets) {
      const a = baseAngle + off;
      const p = projectiles.spawn(); if (!p) break;
      p.kind = 'throwing_axe'; p.owner = 'player'; p.x = player.x; p.y = player.y;
      p.vx = Math.cos(a) * this.speed; p.vy = Math.sin(a) * this.speed;
      p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
      p.radius = 8; p.angle = a; p.spin = 12; p.source = this.id;
      p.pierce = false; p.slowEnemy = 0;
      any = true;
    }
    return any;
  }
}


/* ============================================================
   11) Darts — Дротики: 3 подряд (очередь).
   ============================================================ */
class DartsWeapon extends Weapon {
  constructor() {
    super({ id: 'darts', name: t('weapon_darts'), type: 'ranged', baseCooldown: 0.6, baseDamage: 6, icon: '↗', desc: t('weapon_darts_desc') });
    this.speed = 550; this.life = 1.2; this.range = 500;
    this.burstCount = 3; this.burstInterval = 0.15;
    this._burstLeft = 0; this._burstTimer = 0; this._lastDir = { x: 1, y: 0 };
  }
  update(player, enemies, projectiles, dt) {
    if (this._burstLeft > 0) {
      this._burstTimer -= dt;
      while (this._burstLeft > 0 && this._burstTimer <= 0) {
        this._fireOne(player, projectiles);
        this._burstLeft -= 1;
        this._burstTimer += this.burstInterval;
      }
      if (this._burstLeft <= 0) this.cooldown = this.cooldownAt(player);
      return;
    }
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) { this.cooldown = 0.1; return; }
    this._lastDir = Utils.norm(target.x - player.x, target.y - player.y);
    // Feature #6: бонусные снаряды от таланта Ловкости
    this._burstLeft = this.burstCount + this.getBonusProjectiles(player);
    this._burstTimer = 0;
  }
  _fireOne(player, projectiles) {
    const dir = this._lastDir;
    const p = projectiles.spawn(); if (!p) return;
    p.kind = 'dart'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    const jitter = (Math.random() - 0.5) * 0.06;
    const a = Math.atan2(dir.y, dir.x) + jitter;
    p.vx = Math.cos(a) * this.speed; p.vy = Math.sin(a) * this.speed;
    p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 3; p.angle = a; p.source = this.id;
    p.pierce = false; p.slowEnemy = 0; p.spin = 0;
  }
}


/* ============================================================
   12) Sling — Праща: камень по дуге с AoE.
   ============================================================ */
class SlingWeapon extends Weapon {
  constructor() {
    super({ id: 'sling', name: t('weapon_sling'), type: 'ranged', baseCooldown: 0.9, baseDamage: 14, icon: '●', desc: t('weapon_sling_desc') });
    this.speed = 350; this.range = 500; this.aoeRadius = 30;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) return false;
    const dir = Utils.norm(target.x - player.x, target.y - player.y);
    const dist = Math.hypot(target.x - player.x, target.y - player.y);
    const flightTime = Math.max(0.3, dist / this.speed);
    const p = projectiles.spawn(); if (!p) return true;
    p.kind = 'sling_stone'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    p.vx = dir.x * this.speed; p.vy = dir.y * this.speed;
    p.life = flightTime; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 6; p.angle = Math.atan2(dir.y, dir.x); p.source = this.id;
    p.aoeRadius = this.aoeRadius; p.pierce = false; p.slowEnemy = 0; p.spin = 0;
    return true;
  }
}



/* ============================================================
   13) Ice Arrow — Ледяная стрела: замедляет.
   ============================================================ */
class IceArrowWeapon extends Weapon {
  constructor() {
    super({ id: 'ice_arrow', name: t('weapon_ice_arrow'), type: 'magic', baseCooldown: 1.3, baseDamage: 13, icon: '❄', desc: t('weapon_ice_arrow_desc') });
    this.speed = 420; this.life = 1.6; this.range = 500;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) return false;
    const dir = Utils.norm(target.x - player.x, target.y - player.y);
    const p = projectiles.spawn(); if (!p) return true;
    p.kind = 'ice_arrow'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    p.vx = dir.x * this.speed; p.vy = dir.y * this.speed;
    p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 5; p.angle = Math.atan2(dir.y, dir.x); p.source = this.id;
    p.pierce = false; p.slowEnemy = 0.40; p.slowEnemyDuration = 2.0; p.spin = 0;
    return true;
  }
}


/* ============================================================
   14) Chain Lightning — Цепная молния: прыгает на 2 соседей.
   ============================================================ */
class ChainLightningWeapon extends Weapon {
  constructor() {
    super({ id: 'chain_lightning', name: t('weapon_chain_lightning'), type: 'magic', baseCooldown: 1.6, baseDamage: 16, icon: '⚡', desc: t('weapon_chain_lightning_desc') });
    this.range = 300; this.chainRadius = 70; this.chains = 2;
    this.lightningAnim = { active: false, t: 0, points: [] };
  }
  tick(dt) { if (this.lightningAnim.active) { this.lightningAnim.t += dt; if (this.lightningAnim.t >= 0.25) this.lightningAnim.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const first = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!first) return false;
    const baseDmg = this.damageAt() * this.totalDamageMul(player);
    const points = [{ x: player.x, y: player.y }];
    const hit = new Set();
    // Первый удар
    helpers.damageEnemy(first, baseDmg);
    hit.add(first);
    points.push({ x: first.x, y: first.y });
    // Цепь
    let current = first;
    const dmgFalloff = [0.75, 0.50];
    for (let c = 0; c < this.chains; c++) {
      let nextTarget = null, bestD2 = this.chainRadius * this.chainRadius;
      const items = enemies.items;
      for (let i = 0; i < items.length; i++) {
        const e = items[i];
        if (!e.active || hit.has(e) || e.invulnerable) continue;
        const dx = e.x - current.x, dy = e.y - current.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) { bestD2 = d2; nextTarget = e; }
      }
      if (!nextTarget) break;
      helpers.damageEnemy(nextTarget, baseDmg * dmgFalloff[c]);
      hit.add(nextTarget);
      points.push({ x: nextTarget.x, y: nextTarget.y });
      current = nextTarget;
    }
    this.lightningAnim.active = true; this.lightningAnim.t = 0;
    this.lightningAnim.points = points;
    return true;
  }
  renderOverlay(ctx) {
    if (!this.lightningAnim.active) return;
    const t = this.lightningAnim.t / 0.25;
    const alpha = (1 - t) * 0.9;
    const pts = this.lightningAnim.points;
    if (pts.length < 2) return;
    ctx.strokeStyle = `rgba(255, 255, 80, ${alpha})`; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      // Зигзаг между точками
      const px = pts[i - 1], nx = pts[i];
      const mx = (px.x + nx.x) / 2 + (Math.random() - 0.5) * 20;
      const my = (px.y + nx.y) / 2 + (Math.random() - 0.5) * 20;
      ctx.lineTo(mx, my); ctx.lineTo(nx.x, nx.y);
    }
    ctx.stroke();
  }
}


/* ============================================================
   15) Poison Cloud — Ядовитое облако (зона урона).
   ============================================================ */
class PoisonCloudWeapon extends Weapon {
  constructor() {
    super({ id: 'poison_cloud', name: t('weapon_poison_cloud'), type: 'magic', baseCooldown: 2.0, baseDamage: 8, icon: '☠', desc: t('weapon_poison_cloud_desc') });
    this.range = 300; this.cloudRadius = 60; this.cloudLife = 3.0;
    this._clouds = []; // Активные облака { x, y, life, dps }
  }
  doAttack(player, enemies) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) return false;
    this._clouds.push({
      x: target.x, y: target.y,
      life: this.cloudLife,
      maxLife: this.cloudLife,
      dps: this.damageAt() * this.totalDamageMul(player),
      radius: this.cloudRadius,
    });
    return true;
  }
  update(player, enemies, projectiles, dt, helpers) {
    // Обновляем существующие облака
    for (let i = this._clouds.length - 1; i >= 0; i--) {
      const c = this._clouds[i];
      c.life -= dt;
      if (c.life <= 0) { this._clouds.splice(i, 1); continue; }
      // Наносим урон врагам в радиусе
      const r2 = c.radius * c.radius;
      const items = enemies.items;
      for (let j = 0; j < items.length; j++) {
        const e = items[j];
        if (!e.active || e.invulnerable) continue;
        const dx = e.x - c.x, dy = e.y - c.y;
        if (dx * dx + dy * dy <= r2) {
          helpers.damageEnemy(e, c.dps * dt);
        }
      }
    }
    // Стандартный CD для нового облака
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    const fired = this.doAttack(player, enemies);
    if (fired) this.cooldown = this.cooldownAt(player);
    else this.cooldown = 0.1;
  }
  renderOverlay(ctx) {
    for (const c of this._clouds) {
      const t = c.life / c.maxLife;
      const alpha = 0.15 + 0.2 * t;
      const pulse = 1 + Math.sin(c.life * 4) * 0.05;
      ctx.fillStyle = `rgba(80, 200, 80, ${alpha})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.radius * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(50, 180, 50, ${alpha * 1.5})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.radius * pulse, 0, Math.PI * 2); ctx.stroke();
    }
  }
}


/* ============================================================
   16) Spellbook — Книга заклинаний: 2 случайных снаряда.
   ============================================================ */
class SpellbookWeapon extends Weapon {
  constructor() {
    super({ id: 'spellbook', name: t('weapon_spellbook'), type: 'magic', baseCooldown: 0.8, baseDamage: 10, icon: '📖', desc: t('weapon_spellbook_desc') });
    this.speed = 380; this.life = 1.2;
  }
  doAttack(player, _enemies, projectiles) {
    let any = false;
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = projectiles.spawn(); if (!p) break;
      p.kind = 'spellbook_proj'; p.owner = 'player'; p.x = player.x; p.y = player.y;
      p.vx = Math.cos(a) * this.speed; p.vy = Math.sin(a) * this.speed;
      p.life = this.life; p.damage = this.damageAt() * this.totalDamageMul(player);
      p.radius = 6; p.angle = a; p.source = this.id;
      p.pierce = false; p.slowEnemy = 0; p.spin = 0;
      any = true;
    }
    return any;
  }
}



/* ============================================================
   17) Firestorm — Огненный шторм: 4 столба вокруг героя.
   ============================================================ */
class FirestormWeapon extends Weapon {
  constructor() {
    super({ id: 'firestorm', name: t('weapon_firestorm'), type: 'aoe', baseCooldown: 2.5, baseDamage: 18, icon: '🌋', desc: t('weapon_firestorm_desc') });
    this.spawnRadius = 120; this.aoeRadius = 40; this.pillarLife = 0.6;
    this._pillars = []; // { x, y, life, maxLife, damage, radius }
  }
  doAttack(player) {
    const damage = this.damageAt() * this.totalDamageMul(player);
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * (this.spawnRadius - 40);
      this._pillars.push({
        x: player.x + Math.cos(a) * r,
        y: player.y + Math.sin(a) * r,
        life: this.pillarLife,
        maxLife: this.pillarLife,
        damage: damage,
        radius: this.aoeRadius,
        hit: false,
      });
    }
    return true;
  }
  update(player, enemies, projectiles, dt, helpers) {
    // Обновляем столбы
    for (let i = this._pillars.length - 1; i >= 0; i--) {
      const p = this._pillars[i];
      p.life -= dt;
      if (p.life <= 0) { this._pillars.splice(i, 1); continue; }
      // Урон только 1 раз при появлении
      if (!p.hit) {
        p.hit = true;
        const r2 = p.radius * p.radius;
        const items = enemies.items;
        for (let j = 0; j < items.length; j++) {
          const e = items[j];
          if (!e.active || e.invulnerable) continue;
          const dx = e.x - p.x, dy = e.y - p.y;
          if (dx * dx + dy * dy <= r2) helpers.damageEnemy(e, p.damage);
        }
      }
    }
    // Стандартный CD
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    const fired = this.doAttack(player);
    if (fired) this.cooldown = this.cooldownAt(player);
    else this.cooldown = 0.1;
  }
  renderOverlay(ctx) {
    for (const p of this._pillars) {
      const t = p.life / p.maxLife;
      const alpha = 0.3 + 0.5 * t;
      ctx.fillStyle = `rgba(255, 140, 40, ${alpha})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * (1.2 - t * 0.2), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255, 220, 80, ${alpha * 0.7})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 0.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}


/* ============================================================
   18) Holy Aura — Святая аура: постоянный урон вокруг героя.
   Не создаёт снарядов. Только визуал + проверка коллизий.
   ============================================================ */
class HolyAuraWeapon extends Weapon {
  constructor() {
    super({ id: 'holy_aura', name: t('weapon_holy_aura'), type: 'aoe', baseCooldown: 0, baseDamage: 4, icon: '✡', desc: t('weapon_holy_aura_desc') });
    this.radius = 50;
    this.undeadDps = 10;
    this._tickAcc = 0;
  }
  update(player, enemies, _proj, dt, helpers) {
    // Постоянный урон каждые 0.25 сек
    this._tickAcc += dt;
    if (this._tickAcc < 0.25) return;
    const ticks = this._tickAcc;
    this._tickAcc = 0;
    const baseDps = this.damageAt() * this.totalDamageMul(player);
    const undeadDps = this.undeadDps * WEAPON_LEVEL_DAMAGE[this.level - 1] * this.totalDamageMul(player);
    const r2 = this.radius * this.radius;
    const items = enemies.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active || e.invulnerable) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy > r2) continue;
      // Нежить: скелеты, зомби, скелет-маг, скелет-капитан, лич
      const isUndead = e.cfg && (e.cfg.id === 'skeleton' || e.cfg.id === 'zombie' ||
        e.cfg.id === 'mage' || e.cfg.id === 'captain' || e.cfg.id === 'archer');
      const dmg = (isUndead ? undeadDps : baseDps) * ticks;
      helpers.damageEnemy(e, dmg);
    }
  }
  renderOverlay(ctx, player) {
    const pulse = 0.6 + 0.2 * Math.sin(Date.now() * 0.004);
    ctx.fillStyle = `rgba(255, 240, 150, ${0.08 * pulse})`;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(255, 230, 100, ${0.25 * pulse})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, 0, Math.PI * 2); ctx.stroke();
  }
  readyProgress() { return 1; } // Всегда готово
}


/* ============================================================
   19) Spike Ring — Кольцо шипов: 4 вращающихся шипа.
   Не создаёт снарядов. Только визуал + проверка коллизий.
   ============================================================ */
class SpikeRingWeapon extends Weapon {
  constructor() {
    super({ id: 'spike_ring', name: t('weapon_spike_ring'), type: 'aoe', baseCooldown: 0, baseDamage: 14, icon: '✸', desc: t('weapon_spike_ring_desc') });
    this.radius = 60; this.spikeCount = 4; this.rotSpeed = Math.PI; // полный оборот за 2 сек
    this._angle = 0; this._hitCooldowns = new Map(); // enemy -> cooldown
  }
  update(player, enemies, _proj, dt, helpers) {
    this._angle += this.rotSpeed * dt;
    // Обновляем кулдауны
    for (const [key, val] of this._hitCooldowns) {
      const newVal = val - dt;
      if (newVal <= 0) this._hitCooldowns.delete(key);
      else this._hitCooldowns.set(key, newVal);
    }
    // Проверяем коллизии шипов с врагами
    const damage = this.damageAt() * this.totalDamageMul(player);
    const spikeR = 10;
    for (let s = 0; s < this.spikeCount; s++) {
      const a = this._angle + (Math.PI * 2 / this.spikeCount) * s;
      const sx = player.x + Math.cos(a) * this.radius;
      const sy = player.y + Math.sin(a) * this.radius;
      const items = enemies.items;
      for (let i = 0; i < items.length; i++) {
        const e = items[i];
        if (!e.active || e.invulnerable) continue;
        if (this._hitCooldowns.has(i)) continue;
        const eSize = e.cfg ? Math.max(e.cfg.w, e.cfg.h) * 0.5 : 14;
        const dx = e.x - sx, dy = e.y - sy;
        if (dx * dx + dy * dy <= (spikeR + eSize) * (spikeR + eSize)) {
          helpers.damageEnemy(e, damage);
          this._hitCooldowns.set(i, 0.5); // 0.5 сек между ударами по одному врагу
        }
      }
    }
  }
  renderOverlay(ctx, player) {
    for (let s = 0; s < this.spikeCount; s++) {
      const a = this._angle + (Math.PI * 2 / this.spikeCount) * s;
      const sx = player.x + Math.cos(a) * this.radius;
      const sy = player.y + Math.sin(a) * this.radius;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(a);
      ctx.fillStyle = '#888888';
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(7, 5); ctx.lineTo(-7, 5); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
  }
  readyProgress() { return 1; }
}


/* ============================================================
   20) Earthquake — Землетрясение: расширяющаяся волна.
   ============================================================ */
class EarthquakeWeapon extends Weapon {
  constructor() {
    super({ id: 'earthquake', name: t('weapon_earthquake'), type: 'aoe', baseCooldown: 3.0, baseDamage: 15, icon: '◉', desc: t('weapon_earthquake_desc') });
    this.maxRadius = 150; this.expandTime = 0.5;
    this._waves = []; // { x, y, life, maxLife, radius, maxRadius, damage, hit }
  }
  doAttack(player, enemies, _proj, helpers) {
    const damage = this.damageAt() * this.totalDamageMul(player);
    this._waves.push({
      x: player.x, y: player.y,
      life: this.expandTime, maxLife: this.expandTime,
      radius: 0, maxRadius: this.maxRadius,
      damage: damage, hitSet: new Set(),
    });
    return true;
  }
  update(player, enemies, projectiles, dt, helpers) {
    // Обновляем волны
    for (let i = this._waves.length - 1; i >= 0; i--) {
      const w = this._waves[i];
      w.life -= dt;
      if (w.life <= 0) { this._waves.splice(i, 1); continue; }
      const t = 1 - w.life / w.maxLife;
      w.radius = w.maxRadius * t;
      // Урон врагам на фронте волны
      const items = enemies.items;
      const innerR = w.radius - 20;
      for (let j = 0; j < items.length; j++) {
        const e = items[j];
        if (!e.active || e.invulnerable) continue;
        if (w.hitSet.has(j)) continue;
        const dx = e.x - w.x, dy = e.y - w.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= w.radius && d >= innerR) {
          helpers.damageEnemy(e, w.damage);
          w.hitSet.add(j);
        }
      }
    }
    // Стандартный CD
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    // Автоатака если есть враги в расстоянии
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.maxRadius + 50);
    if (!target) { this.cooldown = 0.1; return; }
    this.doAttack(player, enemies, projectiles, helpers);
    this.cooldown = this.cooldownAt(player);
  }
  renderOverlay(ctx) {
    for (const w of this._waves) {
      const t = 1 - w.life / w.maxLife;
      const alpha = (1 - t) * 0.6;
      ctx.strokeStyle = `rgba(160, 120, 60, ${alpha})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(200, 160, 80, ${alpha * 0.5})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.radius * 0.8, 0, Math.PI * 2); ctx.stroke();
    }
  }
}



/* ============================================================
   EVOLUTIONS — эволюционные оружия (Шаг 3).
   ============================================================ */
class EvolutionWeapon extends Weapon {
  constructor(cfg) {
    super(cfg);
    this.isEvolved = true;
    this.evolvedFrom = cfg.evolvedFrom || '';
  }
}

/* ---------- 1) Вампирский клинок ---------- */
class VampireBladeWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'vampire_blade', name: t('evo_vampire_blade'), type: 'melee', baseCooldown: 0.7, baseDamage: 25, icon: '🩸', evolvedFrom: 'sword' });
    this.radius = 70; this.arc = Math.PI; this.swingTime = 0.18;
    this.swing = { active: false, t: 0, angle: 0 }; this.lifesteal = 3;
  }
  tick(dt) { if (this.swing.active) { this.swing.t += dt; if (this.swing.t >= this.swingTime) this.swing.active = false; } }
  doAttack(player, enemies, _proj, helpers) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.radius);
    if (!target) return false;
    const damage = this.damageAt() * this.totalDamageMul(player);
    const dirAngle = Math.atan2(target.y - player.y, target.x - player.x);
    const halfArc = this.arc * 0.5;
    const r2 = this.radius * this.radius;
    const items = enemies.items; let hits = 0;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy > r2) continue;
      let diff = Math.atan2(dy, dx) - dirAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) <= halfArc) { helpers.damageEnemy(e, damage); hits++; }
    }
    if (hits > 0) {
      player.hp = Math.min(player.maxHp, player.hp + this.lifesteal * hits);
      if (window.Particles) Particles.burst(player.x, player.y, 4, { color: '#c0392b', speedMin: 30, speedMax: 80, lifeMin: 0.25, lifeMax: 0.45, sizeMin: 2, sizeMax: 3 });
    }
    this.swing.active = true; this.swing.t = 0; this.swing.angle = dirAngle;
    return true;
  }
  renderOverlay(ctx, player) {
    if (!this.swing.active) return;
    const t = this.swing.t / this.swingTime;
    const alpha = (1 - t) * 0.9;
    const r = this.radius; const half = this.arc * 0.5;
    const a0 = this.swing.angle - half + this.arc * t * 0.4;
    const a1 = this.swing.angle + half + this.arc * t * 0.4;
    ctx.strokeStyle = `rgba(220, 60, 50, ${alpha})`; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(player.x, player.y, r, a0, a1); ctx.stroke();
    ctx.strokeStyle = `rgba(255, 200, 200, ${alpha * 0.6})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(player.x, player.y, r - 5, a0, a1); ctx.stroke();
  }
}

/* ---------- 2) Скорострельный лук ---------- */
class RapidBowWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'rapid_bow', name: t('evo_rapid_bow'), type: 'ranged', baseCooldown: 1.4, baseDamage: 15, icon: '🌪', evolvedFrom: 'bow' });
    this.arrowSpeed = 580; this.arrowLife = 1.6; this.range = 560;
    this.burstCount = 3; this.burstInterval = 0.10;
    this._burstLeft = 0; this._burstTimer = 0; this._lastDir = { x: 1, y: 0 };
  }
  update(player, enemies, projectiles, dt) {
    if (this._burstLeft > 0) {
      this._burstTimer -= dt;
      while (this._burstLeft > 0 && this._burstTimer <= 0) {
        this._fireOne(player, projectiles, this._lastDir);
        this._burstLeft -= 1; this._burstTimer += this.burstInterval;
      }
      if (this._burstLeft <= 0) this.cooldown = this.cooldownAt(player);
      return;
    }
    this.cooldown -= dt;
    if (this.cooldown > 0) return;
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (!target) { this.cooldown = 0.1; return; }
    this._lastDir = Utils.norm(target.x - player.x, target.y - player.y);
    this._burstLeft = this.burstCount; this._burstTimer = 0;
  }
  _fireOne(player, projectiles, dir) {
    const p = projectiles.spawn(); if (!p) return;
    p.kind = 'arrow'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    const jitter = (Math.random() - 0.5) * 0.05;
    const a = Math.atan2(dir.y, dir.x) + jitter;
    p.vx = Math.cos(a) * this.arrowSpeed; p.vy = Math.sin(a) * this.arrowSpeed;
    p.life = this.arrowLife; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 4; p.angle = a; p.source = this.id; p.pierce = false; p.slowEnemy = 0;
  }
}

/* ---------- 3) Шквал клинков ---------- */
class BladeStormWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'blade_storm', name: t('evo_blade_storm'), type: 'multi', baseCooldown: 1.4, baseDamage: 12, icon: '💥', evolvedFrom: 'daggers' });
    this.speed = 520; this.life = 1.2; this.spread = (18 * Math.PI) / 180;
    this.range = 600; this.count = 5; this.critChance = 0.20; this.critMul = 2.0;
  }
  doAttack(player, enemies, projectiles) {
    let dx, dy;
    const moveLen = Math.hypot(player.moveDir.x, player.moveDir.y);
    if (moveLen > 0.1) { dx = player.moveDir.x; dy = player.moveDir.y; }
    else {
      const t = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
      if (!t) { dx = player.facing.x; dy = player.facing.y; }
      else { const n = Utils.norm(t.x - player.x, t.y - player.y); dx = n.x; dy = n.y; }
    }
    const baseAngle = Math.atan2(dy, dx);
    const halfSpan = this.spread * 2;
    let any = false;
    for (let i = 0; i < this.count; i++) {
      const tt = this.count === 1 ? 0 : (i / (this.count - 1)) * 2 - 1;
      const a = baseAngle + tt * halfSpan;
      const p = projectiles.spawn(); if (!p) break;
      p.kind = 'dagger'; p.owner = 'player'; p.x = player.x; p.y = player.y;
      p.vx = Math.cos(a) * this.speed; p.vy = Math.sin(a) * this.speed;
      p.life = this.life;
      let dmg = this.damageAt() * this.totalDamageMul(player);
      if (Math.random() < this.critChance) dmg *= this.critMul;
      p.damage = dmg; p.radius = 5; p.angle = a; p.source = this.id;
      p.pierce = false; p.slowEnemy = 0;
      any = true;
    }
    return any;
  }
}

/* ---------- 4) Пламя души ---------- */
class SoulFlameWeapon extends EvolutionWeapon {
  constructor() {
    super({ id: 'soul_flame', name: t('evo_soul_flame'), type: 'aoe', baseCooldown: 2.4, baseDamage: 30, icon: '👻', evolvedFrom: 'fireball' });
    this.flightTime = 0.6; this.explodeRadius = 110; this.range = 720; this.speed = 300;
  }
  doAttack(player, enemies, projectiles) {
    let dx, dy;
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    if (target) { const n = Utils.norm(target.x - player.x, target.y - player.y); dx = n.x; dy = n.y; }
    else {
      const moveLen = Math.hypot(player.moveDir.x, player.moveDir.y);
      if (moveLen > 0.1) { dx = player.moveDir.x; dy = player.moveDir.y; }
      else { dx = player.facing.x; dy = player.facing.y; }
    }
    const p = projectiles.spawn(); if (!p) return false;
    p.kind = 'fireball'; p.owner = 'player'; p.x = player.x; p.y = player.y;
    p.vx = dx * this.speed; p.vy = dy * this.speed;
    p.life = this.flightTime; p.damage = this.damageAt() * this.totalDamageMul(player);
    p.radius = 14; p.explodeRadius = this.explodeRadius;
    p.angle = Math.atan2(dy, dx); p.source = this.id;
    p.pierce = false; p.slowEnemy = 0;
    return true;
  }
}


/* ============================================================
   Реестр эволюционных фабрик
   ============================================================ */
const EVOLVED_WEAPON_FACTORIES = {
  vampire_blade: () => new VampireBladeWeapon(),
  rapid_bow:     () => new RapidBowWeapon(),
  blade_storm:   () => new BladeStormWeapon(),
  soul_flame:    () => new SoulFlameWeapon(),
};


/* ============================================================
   21) MagicMissileWeapon — Магический снаряд (стартовое оружие Волшебника).
   ============================================================ */
class MagicMissileWeapon extends Weapon {
  constructor() {
    super({ id: 'magic_missile_weapon', name: t('weapon_spellbook'), type: 'magic',
      baseCooldown: 2.5, baseDamage: 25, icon: '✦',
      desc: t('weapon_spellbook_desc') });
    this.speed = 380;
    this.life = 3.0;
    this.range = 600;
  }
  doAttack(player, enemies, projectiles) {
    const target = Projectiles.findNearestEnemy(enemies, player.x, player.y, this.range);
    let dir;
    if (target) {
      dir = Utils.norm(target.x - player.x, target.y - player.y);
    } else {
      const move = Input.getMove();
      if (Math.hypot(move.x, move.y) > 0.05) dir = Utils.norm(move.x, move.y);
      else dir = { x: player.facing.x, y: player.facing.y };
    }
    const count = 1 + this.getBonusProjectiles(player) + Math.floor((this.level - 1) / 2);
    const spread = 0.25;
    const baseAngle = Math.atan2(dir.y, dir.x);
    let any = false;
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * spread;
      const a = baseAngle + off;
      const pr = projectiles.spawn();
      if (!pr) break;
      pr.kind = 'missile';
      pr.owner = 'player';
      pr.x = player.x; pr.y = player.y;
      pr.vx = Math.cos(a) * this.speed;
      pr.vy = Math.sin(a) * this.speed;
      pr.life = this.life;
      pr.damage = this.damageAt() * this.totalDamageMul(player);
      pr.radius = 6;
      pr.angle = a;
      pr.source = this.id;
      pr.pierce = false;
      pr.slowEnemy = 0;
      any = true;
    }
    return any;
  }
}

/* ============================================================
   Реестр доступных оружий (для левелапа)
   ============================================================ */
const WEAPON_FACTORIES = {
  sword:            () => new SwordWeapon(),
  bow:              () => new BowWeapon(),
  daggers:          () => new DaggerWeapon(),
  fireball:         () => new FireballWeapon(),
  axe:              () => new AxeWeapon(),
  spear:            () => new SpearWeapon(),
  hammer:           () => new HammerWeapon(),
  whip:             () => new WhipWeapon(),
  crossbow:         () => new CrossbowWeapon(),
  throwing_axes:    () => new ThrowingAxesWeapon(),
  darts:            () => new DartsWeapon(),
  sling:            () => new SlingWeapon(),
  ice_arrow:        () => new IceArrowWeapon(),
  chain_lightning:  () => new ChainLightningWeapon(),
  poison_cloud:     () => new PoisonCloudWeapon(),
  spellbook:        () => new SpellbookWeapon(),
  firestorm:        () => new FirestormWeapon(),
  holy_aura:        () => new HolyAuraWeapon(),
  spike_ring:       () => new SpikeRingWeapon(),
  earthquake:       () => new EarthquakeWeapon(),
  magic_missile_weapon: () => new MagicMissileWeapon(),
};

const WEAPON_INFO = [
  { id: 'sword',           name: t('weapon_sword'),             icon: '⚔',  desc: t('weapon_sword_desc') },
  { id: 'bow',             name: t('weapon_bow'),             icon: '🏹', desc: t('weapon_bow_desc') },
  { id: 'daggers',         name: t('weapon_daggers'),         icon: '🗡',  desc: t('weapon_daggers_desc') },
  { id: 'fireball',        name: t('weapon_fireball'),    icon: '🔥', desc: t('weapon_fireball_desc') },
  { id: 'axe',             name: t('weapon_axe'),          icon: '🪓', desc: t('weapon_axe_desc') },
  { id: 'spear',           name: t('weapon_spear'),           icon: '🔱', desc: t('weapon_spear_desc') },
  { id: 'hammer',          name: t('weapon_hammer'),           icon: '🔨', desc: t('weapon_hammer_desc') },
  { id: 'whip',            name: t('weapon_whip'),            icon: '〰', desc: t('weapon_whip_desc') },
  { id: 'crossbow',        name: t('weapon_crossbow'),         icon: '⊕',  desc: t('weapon_crossbow_desc') },
  { id: 'throwing_axes',   name: t('weapon_throwing_axes'),     icon: '⚒',  desc: t('weapon_throwing_axes_desc') },
  { id: 'darts',           name: t('weapon_darts'),         icon: '↗',  desc: t('weapon_darts_desc') },
  { id: 'sling',           name: t('weapon_sling'),           icon: '●',  desc: t('weapon_sling_desc') },
  { id: 'ice_arrow',       name: t('weapon_ice_arrow'),  icon: '❄',  desc: t('weapon_ice_arrow_desc') },
  { id: 'chain_lightning', name: t('weapon_chain_lightning'),     icon: '⚡', desc: t('weapon_chain_lightning_desc') },
  { id: 'poison_cloud',    name: t('weapon_poison_cloud'),      icon: '☠',  desc: t('weapon_poison_cloud_desc') },
  { id: 'spellbook',       name: t('weapon_spellbook'),     icon: '📖', desc: t('weapon_spellbook_desc') },
  { id: 'firestorm',       name: t('weapon_firestorm'),      icon: '🌋', desc: t('weapon_firestorm_desc') },
  { id: 'holy_aura',       name: t('weapon_holy_aura'),        icon: '✡',  desc: t('weapon_holy_aura_desc') },
  { id: 'spike_ring',      name: t('weapon_spike_ring'),    icon: '✸',  desc: t('weapon_spike_ring_desc') },
  { id: 'earthquake',      name: t('weapon_earthquake'),   icon: '◉',  desc: t('weapon_earthquake_desc') },
];


/* ============================================================
   Экспорт
   ============================================================ */
window.Weapon = Weapon;
window.SwordWeapon = SwordWeapon;
window.BowWeapon = BowWeapon;
window.DaggerWeapon = DaggerWeapon;
window.FireballWeapon = FireballWeapon;
window.AxeWeapon = AxeWeapon;
window.SpearWeapon = SpearWeapon;
window.HammerWeapon = HammerWeapon;
window.WhipWeapon = WhipWeapon;
window.CrossbowWeapon = CrossbowWeapon;
window.ThrowingAxesWeapon = ThrowingAxesWeapon;
window.DartsWeapon = DartsWeapon;
window.SlingWeapon = SlingWeapon;
window.IceArrowWeapon = IceArrowWeapon;
window.ChainLightningWeapon = ChainLightningWeapon;
window.PoisonCloudWeapon = PoisonCloudWeapon;
window.SpellbookWeapon = SpellbookWeapon;
window.FirestormWeapon = FirestormWeapon;
window.HolyAuraWeapon = HolyAuraWeapon;
window.SpikeRingWeapon = SpikeRingWeapon;
window.EarthquakeWeapon = EarthquakeWeapon;

window.WEAPON_FACTORIES = WEAPON_FACTORIES;
window.WEAPON_INFO = WEAPON_INFO;
window.MAX_WEAPON_LEVEL = MAX_WEAPON_LEVEL;
window.createProjectile = createProjectile;
window.Projectiles = Projectiles;

window.EvolutionWeapon = EvolutionWeapon;
window.VampireBladeWeapon = VampireBladeWeapon;
window.RapidBowWeapon = RapidBowWeapon;
window.BladeStormWeapon = BladeStormWeapon;
window.SoulFlameWeapon = SoulFlameWeapon;
window.EVOLVED_WEAPON_FACTORIES = EVOLVED_WEAPON_FACTORIES;
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
    super({ id: 'bloodletter', name: t('evo_bloodletter'), type: 'melee', baseCooldown: 0.9, baseDamage: 24, icon: '🪓', evolvedFrom: 'axe' });
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
    super({ id: 'piercer', name: t('evo_piercer'), type: 'melee', baseCooldown: 0.8, baseDamage: 22, icon: '⚜', evolvedFrom: 'spear' });
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
    super({ id: 'titan_hammer', name: t('evo_titan_hammer'), type: 'melee', baseCooldown: 1.4, baseDamage: 24, icon: '⚒', evolvedFrom: 'hammer' });
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
    super({ id: 'pain_lash', name: t('evo_pain_lash'), type: 'melee', baseCooldown: 0.6, baseDamage: 18, icon: '〰', evolvedFrom: 'whip' });
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
    super({ id: 'executioner', name: t('evo_executioner'), type: 'ranged', baseCooldown: 1.6, baseDamage: 30, icon: '☠', evolvedFrom: 'crossbow' });
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
    super({ id: 'butcher_axes', name: t('evo_butcher_axes'), type: 'ranged', baseCooldown: 0.9, baseDamage: 14, icon: '⚒', evolvedFrom: 'throwing_axes' });
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
    super({ id: 'needle_storm', name: t('evo_needle_storm'), type: 'ranged', baseCooldown: 0.4, baseDamage: 7, icon: '↗', evolvedFrom: 'darts' });
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
    super({ id: 'meteor_strike', name: t('evo_meteor_strike'), type: 'ranged', baseCooldown: 0.8, baseDamage: 22, icon: '☄', evolvedFrom: 'sling' });
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
    super({ id: 'ice_storm', name: t('evo_ice_storm'), type: 'magic', baseCooldown: 1.1, baseDamage: 16, icon: '❄', evolvedFrom: 'ice_arrow' });
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
    super({ id: 'thunder_chain', name: t('evo_thunder_chain'), type: 'magic', baseCooldown: 1.4, baseDamage: 18, icon: '⚡', evolvedFrom: 'chain_lightning' });
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
    super({ id: 'plague_cloud', name: t('evo_plague_cloud'), type: 'magic', baseCooldown: 1.8, baseDamage: 12, icon: '☣', evolvedFrom: 'poison_cloud' });
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
    super({ id: 'mad_grimoire', name: t('evo_mad_grimoire'), type: 'magic', baseCooldown: 0.7, baseDamage: 12, icon: '📖', evolvedFrom: 'spellbook' });
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
    super({ id: 'inferno', name: t('evo_inferno'), type: 'aoe', baseCooldown: 2.2, baseDamage: 25, icon: '🌋', evolvedFrom: 'firestorm' });
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
    super({ id: 'martyr_aura', name: t('evo_martyr_aura'), type: 'aoe', baseCooldown: 0, baseDamage: 6, icon: '✡', evolvedFrom: 'holy_aura' });
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
    super({ id: 'spike_bastion', name: t('evo_spike_bastion'), type: 'aoe', baseCooldown: 0, baseDamage: 16, icon: '✸', evolvedFrom: 'spike_ring' });
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
    super({ id: 'tectonic_rift', name: t('evo_tectonic_rift'), type: 'aoe', baseCooldown: 2.8, baseDamage: 18, icon: '◉', evolvedFrom: 'earthquake' });
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
    super({ id: 'hero_blade', name: t('evo_hero_blade'), type: 'melee', baseCooldown: 0.7, baseDamage: 30, icon: '⚔', evolvedFrom: 'sword' });
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
    super({ id: 'pyroclasm', name: t('evo_pyroclasm'), type: 'aoe', baseCooldown: 2.2, baseDamage: 35, icon: '🔥', evolvedFrom: 'fireball' });
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
    super({ id: 'ice_spike', name: t('evo_ice_spike'), type: 'magic', baseCooldown: 1.2, baseDamage: 15, icon: '🧊', evolvedFrom: 'ice_arrow' });
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
    super({ id: 'electric_cascade', name: t('evo_electric_cascade'), type: 'magic', baseCooldown: 0.8, baseDamage: 14, icon: '⚡', evolvedFrom: 'chain_lightning' });
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
    super({ id: 'miasma', name: t('evo_miasma'), type: 'magic', baseCooldown: 1.8, baseDamage: 9, icon: '☁', evolvedFrom: 'poison_cloud' });
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
    super({ id: 'lich_blade', name: t('guild_reward_lich_blade'), type: 'melee', baseCooldown: 0.8, baseDamage: 30, icon: '💀', desc: 'Melee, 30 dmg. Guild 2+: kills summon a skeleton minion.', exclusiveColor: '#8b00ff' });
    this.radius = 65; this.arc = Math.PI * 0.9; this.swingTime = 0.18;
    this.swing = { active: false, t: 0, angle: 0 };
    // Skeleton minion system
    this._minions = [];
    this._maxMinions = 3;
    this._minionDuration = 8.0; // seconds
    this._minionDamage = 10;
    this._minionSpeed = 90;
    this._minionRadius = 12;
  }
  tick(dt) {
    if (this.swing.active) { this.swing.t += dt; if (this.swing.t >= this.swingTime) this.swing.active = false; }
    // Update minions
    this._updateMinions(dt);
  }

  /** Check if guild level is >= 2 (skeleton summon enabled). */
  _canSummon() {
    return window.MetaProgress && MetaProgress.getGuildLevel && MetaProgress.getGuildLevel() >= 2;
  }

  /** Called from main.js killEnemy hook — summon skeleton on kill. */
  onKill(enemy, player) {
    if (!this._canSummon()) return;
    if (this._minions.length >= this._maxMinions) return;
    // Summon skeleton at enemy position
    this._minions.push({
      x: enemy.x,
      y: enemy.y,
      hp: 30,
      life: this._minionDuration,
      damage: this._minionDamage * WEAPON_LEVEL_DAMAGE[this.level - 1],
      speed: this._minionSpeed,
      radius: this._minionRadius,
      attackCd: 0,
      attackCdMax: 0.8,
      targetIdx: -1,
    });
    // Visual feedback
    if (window.Particles) {
      Particles.burst(enemy.x, enemy.y, 5, {
        color: '#8b00ff', speedMin: 30, speedMax: 80,
        lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
      });
      if (Particles.text) Particles.text(enemy.x, enemy.y - 20, '☠ Skeleton!', 0.8, '#bf7fff', 10);
    }
  }

  /** Update all active minions: movement, attacking, lifetime. */
  _updateMinions(dt) {
    if (!window.Game || !Game.enemies) return;
    const enemies = Game.enemies;
    const player = (Game.player) ? Game.player : null;

    for (let i = this._minions.length - 1; i >= 0; i--) {
      const m = this._minions[i];
      m.life -= dt;
      if (m.life <= 0) { this._minions.splice(i, 1); continue; }

      // Find nearest enemy
      let target = null, bestD2 = 200 * 200; // attack range 200px
      for (let j = 0; j < enemies.items.length; j++) {
        const e = enemies.items[j];
        if (!e.active) continue;
        const dx = e.x - m.x, dy = e.y - m.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) { bestD2 = d2; target = e; }
      }

      if (target) {
        // Move towards target
        const dx = target.x - m.x, dy = target.y - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 30) {
          m.x += (dx / dist) * m.speed * dt;
          m.y += (dy / dist) * m.speed * dt;
        }
        // Attack
        m.attackCd -= dt;
        if (m.attackCd <= 0 && dist <= 40) {
          if (window.Game && Game.damageEnemy) Game.damageEnemy(target, m.damage);
          m.attackCd = m.attackCdMax;
        }
      } else if (player) {
        // No enemies — follow player
        const dx = player.x - m.x, dy = player.y - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 60) {
          m.x += (dx / dist) * m.speed * 0.7 * dt;
          m.y += (dy / dist) * m.speed * 0.7 * dt;
        }
      }
    }
  }

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
    if (!this.swing.active && this._minions.length === 0) return;
    // Swing arc
    if (this.swing.active) {
      const t = this.swing.t / this.swingTime; const alpha = (1 - t) * 0.9;
      ctx.strokeStyle = `rgba(139,0,255,${alpha})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(player.x, player.y, this.radius, this.swing.angle - this.arc * 0.5, this.swing.angle + this.arc * 0.5); ctx.stroke();
    }
    // Render minions
    for (const m of this._minions) {
      const fadeAlpha = Math.min(1, m.life / 1.0); // Fade out in last second
      // Body
      ctx.fillStyle = `rgba(180,140,255,${0.8 * fadeAlpha})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fill();
      // Skull face
      ctx.fillStyle = `rgba(40,0,60,${0.9 * fadeAlpha})`;
      ctx.beginPath(); ctx.arc(m.x - 3, m.y - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(m.x + 3, m.y - 2, 2, 0, Math.PI * 2); ctx.fill();
      // Glow
      ctx.strokeStyle = `rgba(139,0,255,${0.4 * fadeAlpha})`; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.radius + 3, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

/* --- E2: Лук феникса --- */
class PhoenixBowWeapon extends ExclusiveWeapon {
  constructor() {
    super({ id: 'phoenix_bow', name: t('weapon_phoenix_bow'), type: 'ranged', baseCooldown: 1.3, baseDamage: 25, icon: '🔥', desc: 'Fire arrow, 40px explosion on hit.', exclusiveColor: '#ff4500' });
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
    super({ id: 'archmage_staff', name: t('guild_reward_archmage_staff'), type: 'magic', baseCooldown: 1.5, baseDamage: 18, icon: '🪄', desc: '3 colored orbs (fire+ice+lightning) every 1.5s.', exclusiveColor: '#9c27b0' });
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
    super({ id: 'beast_claw', name: t('weapon_beast_claw'), type: 'melee', baseCooldown: 0.4, baseDamage: 12, icon: '🐾', desc: 'Fast strikes (0.4s), 12 dmg, 15% crit, bleed.', exclusiveColor: '#4caf50' });
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
    super({ id: 'rune_shield', name: t('weapon_rune_shield'), type: 'aura', baseCooldown: 0, baseDamage: 15, icon: '🛡', desc: 'Constant 15 dps in 50px radius, +10% DR.', exclusiveColor: '#2196f3' });
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
    super({ id: 'eternal_night_blade', name: t('evo_eternal_night_blade'), type: 'melee', baseCooldown: 0.6, baseDamage: 45, icon: '🌑', superColor: '#4a0080' });
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
    super({ id: 'apocalypse_bow', name: t('evo_apocalypse_bow'), type: 'ranged', baseCooldown: 1.2, baseDamage: 20, icon: '🏹', superColor: '#ff2200' });
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
    super({ id: 'eternity_staff', name: t('evo_eternity_staff'), type: 'magic', baseCooldown: 0.6, baseDamage: 14, icon: '🔮', superColor: '#9c27b0' });
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
    super({ id: 'devourer_claws', name: t('evo_devourer_claws'), type: 'melee', baseCooldown: 0.3, baseDamage: 18, icon: '🐾', superColor: '#b71c1c' });
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
    super({ id: 'bastion_of_light', name: t('evo_bastion_of_light'), type: 'aura', baseCooldown: 0, baseDamage: 10, icon: '🛡', superColor: '#ffd700' });
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
  { id: 'lich_blade',     name: t('guild_reward_lich_blade'), icon: '💀', desc: t('weapon_desc_lich_blade') },
  { id: 'phoenix_bow',    name: t('weapon_phoenix_bow'),        icon: '🔥', desc: t('weapon_desc_phoenix_bow') },
  { id: 'archmage_staff', name: t('guild_reward_archmage_staff'),     icon: '🪄', desc: t('weapon_desc_archmage_staff') },
  { id: 'beast_claw',     name: t('weapon_beast_claw'),       icon: '🐾', desc: t('weapon_desc_beast_claw') },
  { id: 'rune_shield',    name: t('weapon_rune_shield'),         icon: '🛡', desc: t('weapon_desc_rune_shield') },
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
