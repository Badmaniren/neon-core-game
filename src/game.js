// src/game.js — 14-суставная биомеханика, честная коллизия клинка, расчленёнка, кишки, занос и сальто

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = window.innerWidth, H = window.innerHeight;
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W; canvas.height = H;
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

// Приближенная камера (VIEW_H = 390), чтобы все суставы, кисти, раны и стопы были крупными и чёткими!
const VIEW_H = 390;
const GRAVITY = 1520;
let hitstopTimer = 0;
const cam = { x: 0, y: 0, shake: 0 };

// =====================================================
// 1. ВВОД
// =====================================================
const input = {
  x: 0, y: 0,
  jumpHeld: false,
  jumpBuffer: 0,
  atkPressed: false,
  dashPressed: false,
  parryPressed: false,
  usePressed: false
};

const stickZone = document.getElementById('stick-zone');
const stickKnob = document.getElementById('stick-knob');
let stickTouchId = null;

stickZone.addEventListener('pointerdown', (e) => { stickTouchId = e.pointerId; updateStick(e); });
window.addEventListener('pointermove', (e) => { if (e.pointerId === stickTouchId) updateStick(e); });
function releaseStick(e) {
  if (e.pointerId === stickTouchId) {
    stickTouchId = null; input.x = 0; input.y = 0;
    stickKnob.style.transform = `translate(-50%, -50%)`;
  }
}
window.addEventListener('pointerup', releaseStick);
window.addEventListener('pointercancel', releaseStick);

function updateStick(e) {
  const rect = stickZone.getBoundingClientRect();
  const dx = e.clientX - (rect.left + rect.width / 2);
  const dy = e.clientY - (rect.top + rect.height / 2);
  const maxR = 46;
  const clamped = Math.min(Math.hypot(dx, dy), maxR);
  const ang = Math.atan2(dy, dx);
  const kx = Math.cos(ang) * clamped, ky = Math.sin(ang) * clamped;
  stickKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  const nx = kx / maxR, ny = ky / maxR;
  input.x = Math.abs(nx) > 0.16 ? Math.sign(nx) * Math.min(1, (Math.abs(nx) - 0.14) / 0.7) : 0;
  input.y = Math.abs(ny) > 0.42 ? Math.sign(ny) : 0;
}

function bindBtn(id, onDown, onUp) {
  const el = document.getElementById(id);
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.classList.add('pressed'); onDown(); });
  const end = () => { el.classList.remove('pressed'); if (onUp) onUp(); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', end);
}

bindBtn('btn-jmp', () => { input.jumpHeld = true; input.jumpBuffer = 0.16; }, () => { input.jumpHeld = false; });
bindBtn('btn-atk', () => { input.atkPressed = true; });
bindBtn('btn-dash', () => { input.dashPressed = true; });
bindBtn('btn-parry', () => { input.parryPressed = true; });
bindBtn('btn-use', () => { input.usePressed = true; });

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') input.x = -1;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') input.x = 1;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') input.y = 1;
  if (e.code === 'Space' || e.code === 'KeyW') { input.jumpBuffer = 0.16; input.jumpHeld = true; }
  if (e.code === 'KeyJ') input.atkPressed = true;
  if (e.code === 'KeyK') input.parryPressed = true;
  if (e.code === 'ShiftLeft' || e.code === 'KeyL') input.dashPressed = true;
  if (e.code === 'KeyE') input.usePressed = true;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') if (input.x < 0) input.x = 0;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') if (input.x > 0) input.x = 0;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') input.y = 0;
  if (e.code === 'Space' || e.code === 'KeyW') input.jumpHeld = false;
});

// =====================================================
// 2. ИГРОК (КРУПНЫЙ 14-СУСТАВНЫЙ СКЕЛЕТ, САЛЬТО, ЗАНОС)
// =====================================================
const player = {
  x: 120, y: 350, w: 32, h: 64, // Крупный детализированный рост!
  vx: 0, vy: 0,
  facing: 1,
  grounded: false,
  coyoteTimer: 0,
  wallDir: 0,
  ledgeGrab: null,      // { x, y, handX, handY, dir }
  skidTimer: 0,         // Тормозной путь по инерции!
  skidDir: 0,
  offBalanceTimer: 0,   // Перевес тяжёлого оружия при промахе
  knockdown: false,
  knockdownTimer: 0,
  noOverswing: false,
  weaponType: 'greatsword', // 'greatsword' | 'daggers' | 'hammer'
  moveSpeed: 310,
  hp: 100, maxHp: 100,
  dmg: 28,
  critChance: 0.15,
  vampOnKill: 0,
  rangeBonus: 0,
  chainLightning: false,
  swordColor: '#dce6ff',
  atkSpeedMult: 1.0,
  souls: 0,
  relics: [],
  comboStep: 0,
  comboWindow: 0,
  atkTimer: 0,
  atkDuration: 0.28,
  atkHitChecked: false, // Флаг момента удара клинком в середине замаха
  atkCd: 0,
  atkCdMax: 0.3,
  downSmash: false,
  dashTimer: 0,
  dashCd: 0,
  dashCdMax: 0.62,
  parryWindow: 0,
  parryCd: 0,
  parryCdMax: 0.58,
  invuln: 0,
  // Кинематика суставов
  stepPhase: 0,
  lastStepSign: 1,
  torsoLean: 0,
  squashY: 1.0,
  flipAngle: 0,         // Угол сальто при отскоке от стены или кувырке!
  isWallFlipping: false,// Настоящее сальто назад с группировкой при Wall-Jump!
  scarf: []
};
for (let i = 0; i < 7; i++) player.scarf.push({ x: player.x, y: player.y });

window.resetScarf = function() {
  for (let i = 0; i < player.scarf.length; i++) {
    player.scarf[i].x = player.x + player.w / 2 - player.facing * i * 5;
    player.scarf[i].y = player.y + 14;
  }
};

function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// =====================================================
// 3. ЧЕСТНАЯ БИОМЕХАНИЧЕСКАЯ БОЁВКА И РАСЧЛЕНЁНКА (GORE ENGINE)
// =====================================================
function startAttackSwing() {
  if (!player.grounded && input.y > 0.4) {
    player.downSmash = true;
    player.vy = 730;
    player.atkTimer = 0.38;
    player.atkDuration = 0.38;
    player.atkCd = 0.45 * player.atkSpeedMult;
    player.atkCdMax = player.atkCd;
    sfx.slash(3);
    return;
  }

  if (player.comboWindow > 0 && player.comboStep < 3) {
    player.comboStep++;
  } else {
    player.comboStep = 1;
  }

  const isFinisher = player.comboStep === 3;
  const isHammer = player.weaponType === 'hammer';
  const isDaggers = player.weaponType === 'daggers';

  player.atkDuration = (isFinisher ? (isHammer ? 0.42 : 0.34) : (isDaggers ? 0.16 : 0.24)) * player.atkSpeedMult;
  player.atkTimer = player.atkDuration;
  player.atkHitChecked = false; // Сам урон нанесётся в фазе разгибания локтя (когда клинок летит в цель!)
  player.atkCd = (isFinisher ? 0.58 : (player.comboStep === 2 ? 0.30 : 0.26)) * player.atkSpeedMult;
  player.atkCdMax = player.atkCd;
  player.comboWindow = isFinisher ? 0 : 0.78;

  const lunge = isFinisher ? (isHammer ? 350 : 290) : (isDaggers ? 210 : 165);
  player.vx = player.facing * lunge;
  sfx.slash(player.comboStep, isDaggers ? 1.4 : (isHammer ? 0.72 : 1.0));
}

// Вызывается в пиковой фазе удара (когда рука с оружием реально рассекает воздух перед собой)
function executeWeaponImpact() {
  player.atkHitChecked = true;
  const isFinisher = player.comboStep === 3;
  const isHammer = player.weaponType === 'hammer';
  const isDaggers = player.weaponType === 'daggers';

  const reach = (isHammer ? 76 : (isDaggers ? 48 : 70)) + (isFinisher ? 16 : 0) + player.rangeBonus;
  const pxCenter = player.x + player.w / 2;
  const pyCenter = player.y + player.h / 2;
  const hitX = player.facing === 1 ? pxCenter : pxCenter - reach;
  // Высота удара зависит от шага комбо: 1 — в живот/грудь, 2 — снизу вверх в голову, 3 — сверху вниз!
  const hitY = player.y + (player.comboStep === 1 ? 18 : (player.comboStep === 2 ? -4 : 6));
  const hitW = reach;
  const hitH = player.h - 6;

  let hitAnything = false;

  // 1. Звон цепей от удара клинком
  WORLD.chains.forEach(ch => {
    ch.nodes.forEach(n => {
      if (Math.hypot(n.x - pxCenter, n.y - pyCenter) < reach + 15) {
        n.vx += player.facing * 260;
        sfx.chainClink();
      }
    });
  });

  // 2. Перерубание цепей люстр
  WORLD.chandeliers.forEach(c => {
    if (c.state === 'hanging' && Math.abs(c.x - (pxCenter + player.facing * 32)) < 58 && pyCenter < c.y + 52) {
      c.state = 'falling'; c.vy = 60;
      hitAnything = true;
      sfx.parryClang();
      spawnParticles(c.x, c.y - 20, '#ffbe42', 14, 220);
      addFloatText(c.x, c.y - 25, 'ЦЕПЬ ПЕРЕРУБЛЕНА!', '#ffbe42', true);
    }
  });

  // 3. Разрушение бочек
  for (let i = WORLD.barrels.length - 1; i >= 0; i--) {
    const b = WORLD.barrels[i];
    if (rectOverlap(hitX, hitY, hitW, hitH, b.x, b.y, b.w, b.h)) {
      hitAnything = true;
      breakBarrel(i);
    }
  }

  // 4. АНАТОМИЧЕСКОЕ ПОПАДАНИЕ ПО ВРАГАМ (РАНЫ, КИШКИ, ПЕРЕЛОМЫ НОГ, ОТРУБАНИЕ)
  WORLD.enemies.forEach(e => {
    const exCenter = e.x + e.w / 2, eyCenter = e.y + e.h / 2;
    if (rectOverlap(hitX, hitY, hitW, hitH, e.x, e.y, e.w, e.h) &&
        hasLineOfSight(pxCenter, pyCenter, exCenter, eyCenter)) {
      hitAnything = true;
      const stunnedBonus = (e.state === 'stunned' || e.legBroken) ? 1.6 : 1.0;
      const isCrit = isFinisher || e.state === 'stunned' || Math.random() < player.critChance;
      const dmg = Math.round(player.dmg * (isFinisher ? 1.5 : 1.0) * (isCrit ? 1.65 : 1.0) * stunnedBonus);

      // Локальная точка раны на теле врага
      const relX = (Math.random() - 0.5) * (e.w * 0.45);
      const relY = player.comboStep === 1 ? 6 : (player.comboStep === 2 ? -10 : 12);
      if (e.wounds.length < 6) {
        e.wounds.push({ rx: relX, ry: relY, type: isHammer ? 'crush' : 'cut' });
      }

      // ЭФФЕКТЫ ПО ТИПУ ОРУЖИЯ:
      if (isHammer) {
        // МОЛОТ: Дробит ноги, выбивает оружие и швыряет врагов через зал!
        const knockForce = isFinisher ? 560 : 340;
        applyAnatomyDamage(e, dmg, player.facing * knockForce, isCrit, 'hammer');

        // Перелом ноги (враг падает и ползёт!)
        if (!e.legBroken && e.type !== 'wraith' && e.type !== 'boss' && (isFinisher || e.hp < e.maxHp * 0.6)) {
          e.legBroken = true;
          sfx.boneSnap();
          addFloatText(exCenter, e.y - 22, 'ПЕРЕЛОМ НОГИ!', '#ff9d2e', true);
          // Оторванная голень отлетает в сторону
          WORLD.corpses.push({
            x: exCenter, y: e.y + e.h - 10,
            vx: player.facing * 260, vy: -190,
            rot: 0, vrot: 12,
            kind: 'leg', color: '#ede0c8'
          });
        }
        // Выбивание оружия из рук врага!
        if (!e.disarmed && e.type !== 'wraith' && e.type !== 'boss' && Math.random() < 0.55) {
          e.disarmed = true;
          sfx.parryClang();
          addFloatText(exCenter, e.y - 36, 'ОРУЖИЕ ВЫБИТО!', '#ffd269', false);
          WORLD.droppedWeapons.push({
            x: exCenter, y: eyCenter,
            vx: player.facing * (180 + Math.random() * 140),
            vy: -260,
            rot: 0,
            ownerType: e.type
          });
        }
      } else if (isDaggers) {
        // КИНЖАЛЫ: Вспарывают живот, выпускают кишки и вешают кровотечение!
        applyAnatomyDamage(e, dmg, player.facing * 140, isCrit, 'daggers');
        e.bleedTimer = 3.5;
        if (!e.gutsSpilled && e.type !== 'wraith' && (isCrit || e.hp < e.maxHp * 0.55)) {
          spillEnemyGuts(e);
        }
      } else {
        // МЕЧ (КЛЕЙМОР): Рассекает плоть, вспарывает живот и РАЗРУБАЕТ ПОПОЛАМ при добивании!
        applyAnatomyDamage(e, dmg, player.facing * (isFinisher ? 340 : 210), isCrit, 'greatsword');
        if (!e.gutsSpilled && e.type !== 'wraith' && player.comboStep === 1 && e.hp < e.maxHp * 0.5) {
          spillEnemyGuts(e);
        }
      }

      if ((isFinisher || e.state === 'stunned') && player.chainLightning) {
        triggerChainLightning(e, Math.round(dmg * 0.65));
      }
    }
  });

  if (hitAnything) {
    hitstopTimer = isFinisher ? 0.07 : 0.035;
    cam.shake = isFinisher ? 10 : 4.5;
    if (navigator.vibrate) navigator.vibrate(isFinisher ? 40 : 16);
  } else if (isFinisher && !isDaggers && !player.noOverswing && player.grounded) {
    // ПРОМАХ ТЯЖЁЛЫМ УДАРОМ -> МЕЧ ИЛИ МОЛОТ ТЯНЕТ ЗА СОБОЙ И ВАЛИТ НА КОЛЕНО!
    player.offBalanceTimer = isHammer ? 0.60 : 0.42;
    player.vx = player.facing * (isHammer ? 420 : 340);
    player.atkCd = 0.72;
    player.atkCdMax = 0.72;
    cam.shake = 5;
    spawnParticles(pxCenter, player.y + player.h, '#9296a0', 9, 150, 300);
    addFloatText(pxCenter, player.y - 18, 'ПЕРЕВЕС ОРУЖИЯ!', '#ffae38', false);
  }
}

function spillEnemyGuts(e) {
  e.gutsSpilled = true;
  e.gutNodes = [];
  for (let i = 0; i < 5; i++) {
    e.gutNodes.push({ x: e.x + e.w / 2, y: e.y + e.h * 0.55 + i * 5, vx: (Math.random() - 0.5) * 90 });
  }
  spawnParticles(e.x + e.w / 2, e.y + e.h * 0.55, '#d46a7e', 14, 210);
  addFloatText(e.x + e.w / 2, e.y - 20, 'ВСПОРОТ ЖИВОТ!', '#e03448', true);
}

function applyAnatomyDamage(e, dmg, knockVx, isCrit, weaponKind) {
  e.hp -= dmg;
  e.vx = e.type === 'boss' ? knockVx * 0.35 : knockVx;
  e.vy = weaponKind === 'hammer' ? -220 : (e.type === 'boss' ? -50 : -125);
  e.flashTimer = 0.11;
  if (e.state !== 'stunned' && e.type !== 'boss') {
    e.state = 'stagger';
    e.timer = weaponKind === 'hammer' ? 0.42 : 0.25;
  }

  sfx.goreHit(weaponKind === 'hammer' || isCrit);
  spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#e03448', isCrit ? 18 : 10, 270);
  addFloatText(e.x + e.w / 2, e.y - 8, isCrit ? `${dmg}!` : `${dmg}`, isCrit ? '#ffbe42' : '#f5efe6', isCrit);

  if (WORLD.bloodStains.length < 75) {
    WORLD.bloodStains.push({ x: e.x + Math.random() * e.w, y: WORLD.FLOOR_Y, w: 8 + Math.random() * 14 });
  }

  // СМЕРТЬ ВРАГА -> ФАТАЛЬНАЯ РАСЧЛЕНЁНКА ПО ТИПУ ОРУЖИЯ!
  if (e.hp <= 0) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const dir = Math.sign(knockVx) || player.facing;
    spawnParticles(cx, cy, '#9e1b28', 28, 340);

    if (weaponKind === 'greatsword' || weaponKind === 'daggers') {
      // МЕЧ / КИНЖАЛЫ -> РАЗРУБАНИЕ ТЕЛА ПОПОЛАМ (Верхняя половина и таз с ногами разлетаются!)
      addFloatText(cx, e.y - 24, 'РАЗРУБЛЕН ПОПОЛАМ!', '#ff2a4b', true);
      WORLD.corpses.push({
        x: cx, y: e.y + 16,
        vx: dir * (240 + Math.random() * 120), vy: -290,
        rot: 0, vrot: dir * 11,
        kind: 'upperBody', enemyType: e.type
      });
      WORLD.corpses.push({
        x: cx, y: e.y + e.h - 16,
        vx: -dir * 90, vy: -110,
        rot: 0, vrot: -dir * 5,
        kind: 'lowerLegs', enemyType: e.type
      });
    } else if (weaponKind === 'hammer') {
      // МОЛОТ -> РАЗМОЗЖЕНИЕ В КАШУ ИЗ КОСТЕЙ И ОСКОЛКОВ БРОНИ!
      sfx.boneSnap();
      addFloatText(cx, e.y - 24, 'РАЗМОЗЖЁН!', '#ff9d2e', true);
      spawnParticles(cx, cy, '#ede0c8', 20, 380);
      spawnParticles(cx, cy, '#d46a7e', 18, 320);
      WORLD.corpses.push({
        x: cx, y: e.y + 10,
        vx: dir * 420, vy: -340,
        rot: 0, vrot: dir * 18,
        kind: 'skull', enemyType: e.type
      });
    }

    player.souls += e.type === 'boss' ? 120 : (e.type === 'warden' ? 25 : 12);
    if (player.vampOnKill > 0) {
      player.hp = Math.min(player.maxHp, player.hp + player.vampOnKill);
      addFloatText(player.x, player.y - 12, `+${player.vampOnKill} HP`, '#68e09c');
    }
  }
}

function breakBarrel(idx) {
  const b = WORLD.barrels[idx];
  sfx.woodBreak();
  spawnParticles(b.x + 12, b.y + 14, '#825836', 16, 260);
  const isHeal = Math.random() < 0.45;
  WORLD.lootOrbs.push({
    x: b.x + 12, y: b.y + 10,
    vx: (Math.random() - 0.5) * 140, vy: -220,
    type: isHeal ? 'hp' : 'soul',
    val: isHeal ? 20 : 15
  });
  WORLD.barrels.splice(idx, 1);
}

function triggerChainLightning(sourceEnemy, boltDmg) {
  const sx = sourceEnemy.x + sourceEnemy.w / 2, sy = sourceEnemy.y + sourceEnemy.h / 2;
  spawnLightningBolt(player.x + player.w / 2, player.y + 24, sx, sy);
  WORLD.enemies.forEach(other => {
    if (other !== sourceEnemy && other.hp > 0) {
      const ox = other.x + other.w / 2, oy = other.y + other.h / 2;
      if (Math.hypot(ox - sx, oy - sy) < 260) {
        spawnLightningBolt(sx, sy, ox, oy);
        applyAnatomyDamage(other, boltDmg, Math.sign(ox - sx) * 180, false, 'greatsword');
      }
    }
  });
}

const relicModal = document.getElementById('relic-modal');
const cardsContainer = document.getElementById('cards-container');
let pausedForModal = false;

function openRelicModal() {
  pausedForModal = true;
  cardsContainer.innerHTML = '';
  const shuffled = [...RELIC_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  shuffled.forEach(rel => {
    const card = document.createElement('div');
    card.className = 'relic-card';
    card.innerHTML = `<h4>${rel.name}</h4><p>${rel.desc}</p>`;
    card.onclick = () => {
      rel.apply(player);
      player.relics.push(rel.name);
      WORLD.shrine.used = true;
      pausedForModal = false;
      relicModal.style.display = 'none';
      spawnParticles(WORLD.shrine.x, WORLD.shrine.y - 30, '#c4a46c', 25, 260);
      updateHUD();
    };
    cardsContainer.appendChild(card);
  });
  relicModal.style.display = 'flex';
}

// =====================================================
// 4. ФИЗИКА ДВИЖЕНИЯ: НАСТОЯЩИЙ ТОРМОЗНОЙ ПУТЬ, САЛЬТО И LEDGE-GRAB
// =====================================================
function update(dt) {
  if (pausedForModal) return;
  if (hitstopTimer > 0) { hitstopTimer -= dt; return; }

  if (input.jumpBuffer > 0) input.jumpBuffer -= dt;
  if (player.coyoteTimer > 0) player.coyoteTimer -= dt;
  if (player.atkCd > 0) player.atkCd -= dt;
  if (player.comboWindow > 0) {
    player.comboWindow -= dt;
    if (player.comboWindow <= 0) player.comboStep = 0;
  }
  if (player.dashTimer > 0) player.dashTimer -= dt;
  if (player.dashCd > 0) player.dashCd -= dt;
  if (player.parryWindow > 0) player.parryWindow -= dt;
  if (player.parryCd > 0) player.parryCd -= dt;
  if (player.invuln > 0) player.invuln -= dt;
  if (player.skidTimer > 0) player.skidTimer -= dt;
  if (player.offBalanceTimer > 0) player.offBalanceTimer -= dt;

  // Таймер удара и проверка момента столкновения клинка с врагом (в середине взмаха!)
  if (player.atkTimer > 0) {
    player.atkTimer -= dt;
    const progress = 1 - (player.atkTimer / player.atkDuration);
    if (!player.atkHitChecked && !player.downSmash && progress >= 0.42) {
      executeWeaponImpact();
    }
  }

  player.squashY += (1.0 - player.squashY) * Math.min(1, dt * 16);

  // А) ВИС НА УСТУПЕ (LEDGE GRAB) — РУКИ ЧЁТКО ЛЕЖАТ НА УГЛУ КАМНЯ!
  if (player.ledgeGrab) {
    player.vx = 0; player.vy = 0;
    player.x = player.ledgeGrab.x;
    player.y = player.ledgeGrab.y;
    player.isWallFlipping = false;
    if (input.jumpBuffer > 0 || input.y < -0.4) {
      // Мощный подъём с сальто на платформу!
      player.vy = -540;
      player.vx = player.ledgeGrab.dir * 210;
      player.isWallFlipping = true;
      player.flipAngle = 0;
      player.ledgeGrab = null;
      input.jumpBuffer = 0;
      sfx.jump();
    } else if (input.y > 0.45 || input.dashPressed) {
      player.ledgeGrab = null;
      input.dashPressed = false;
    }
    updateWorldEntities(dt);
    return;
  }

  // Б) СБИТ С НОГ + СКИЛЛОВЫЙ ТЕХ-КУВЫРОК
  if (player.knockdown) {
    player.knockdownTimer -= dt;
    if (input.dashPressed && player.dashCd <= 0) {
      input.dashPressed = false;
      player.knockdown = false;
      player.dashTimer = 0.24;
      player.dashCd = player.dashCdMax * 0.5;
      player.invuln = 0.35;
      player.vy = -190;
      player.vx = player.facing * 520;
      player.flipAngle = 0;
      sfx.dash();
      addFloatText(player.x + player.w / 2, player.y - 18, 'ТЕХ-КУВЫРОК!', '#00f3ff', true);
    } else if (player.knockdownTimer <= 0 && player.grounded) {
      player.knockdown = false;
      player.squashY = 0.72;
    }
  }

  // 1. Парирование
  if (input.parryPressed && player.parryCd <= 0 && player.dashTimer <= 0 && !player.knockdown && player.offBalanceTimer <= 0) {
    player.parryWindow = 0.28;
    player.parryCd = player.parryCdMax;
    player.vx *= 0.2;
    sfx.slash(1);
  }
  input.parryPressed = false;

  // 2. Рывок / Акробатический кувырок
  if (input.dashPressed && player.dashCd <= 0 && player.dashTimer <= 0 && !player.knockdown) {
    player.dashTimer = 0.22;
    player.dashCd = player.dashCdMax;
    player.invuln = 0.28;
    player.offBalanceTimer = 0;
    player.skidTimer = 0;
    player.downSmash = false;
    player.flipAngle = 0;
    if (input.x !== 0) player.facing = Math.sign(input.x);
    player.vx = player.facing * 680;
    player.vy = 0;
    sfx.dash();
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#c4a46c', 10, 160, 0);
  }
  input.dashPressed = false;

  if (player.dashTimer > 0) {
    player.flipAngle += dt * 29;
    for (let i = WORLD.barrels.length - 1; i >= 0; i--) {
      const b = WORLD.barrels[i];
      if (rectOverlap(player.x, player.y, player.w, player.h, b.x, b.y, b.w, b.h)) breakBarrel(i);
    }
  }

  // Вращение в воздухе при сальто от стены!
  if (player.isWallFlipping) {
    player.flipAngle += dt * 19;
    if (player.flipAngle >= Math.PI * 2 || player.grounded) {
      player.isWallFlipping = false;
      player.flipAngle = 0;
    }
  }

  // 3. Атака
  if (input.atkPressed && player.atkCd <= 0 && player.dashTimer <= 0 && !player.knockdown && player.offBalanceTimer <= 0) {
    startAttackSwing();
  }
  input.atkPressed = false;

  // 4. ФИЗИКА РАЗГОНА И НАСТОЯЩЕГО ТОРМОЗНОГО ПУТИ (SKID SLIDE)!
  if (player.dashTimer <= 0 && player.atkTimer <= 0 && player.parryWindow <= 0 && !player.knockdown && player.offBalanceTimer <= 0) {
    if (player.skidTimer > 0) {
      // ВО ВРЕМЯ ЗАНОСА РЫЦАРЬ СКОЛЬЗИТ ПО ИНЕРЦИИ В СТАРУЮ СТОРОНУ, ТОРМОЗЯ ПОДОШВАМИ О КАМЕНЬ!
      player.vx *= Math.pow(0.015, dt); // плавное гашение инерции на 30-40px пути
      if (Math.random() < 0.65) {
        spawnParticles(player.x + player.w / 2 + player.skidDir * 10, player.y + player.h, '#ffbe42', 2, 95, 260);
        spawnParticles(player.x + player.w / 2, player.y + player.h, '#9296a0', 2, 70, 180);
      }
      if (Math.abs(player.vx) < 45 || player.skidTimer <= 0.02) {
        player.skidTimer = 0;
        player.facing = -player.skidDir;
        player.vx = player.facing * 90; // взрывной старт в новую сторону после остановки!
      }
    } else if (input.x !== 0) {
      const desiredDir = Math.sign(input.x);
      // Если разогнались > 215 и резко тянем стик назад -> НАЧИНАЕМ ТОРМОЗНОЙ ЗАНОС!
      if (player.grounded && Math.abs(player.vx) > 215 && desiredDir !== Math.sign(player.vx)) {
        player.skidTimer = 0.24;
        player.skidDir = Math.sign(player.vx); // продолжаем ехать туда, куда несла инерция!
        sfx.step();
      } else {
        player.facing = desiredDir;
        const accel = player.grounded ? 820 : 620;
        const targetVx = input.x * player.moveSpeed;
        if (player.vx < targetVx) player.vx = Math.min(targetVx, player.vx + accel * dt);
        else if (player.vx > targetVx) player.vx = Math.max(targetVx, player.vx - accel * dt);
      }
    } else {
      // Естественное трение при остановке
      const decel = player.grounded ? 1150 : 300;
      if (Math.abs(player.vx) <= decel * dt) player.vx = 0;
      else player.vx -= Math.sign(player.vx) * decel * dt;
    }
  } else if ((player.atkTimer > 0 && !player.downSmash) || player.offBalanceTimer > 0 || player.knockdown) {
    player.vx *= Math.pow(0.03, dt);
  }

  // Наклон корпуса от ускорения и заноса
  if (player.offBalanceTimer > 0) {
    player.torsoLean += (0.58 - player.torsoLean) * dt * 18;
  } else if (player.skidTimer > 0) {
    player.torsoLean += (-0.42 - player.torsoLean) * dt * 22;
  } else {
    const targetLean = (Math.abs(player.vx) / player.moveSpeed) * 0.22;
    player.torsoLean += (targetLean - player.torsoLean) * Math.min(1, dt * 14);
  }

  // Фаза шага бедер и коленей
  if (player.grounded && Math.abs(player.vx) > 20 && player.skidTimer <= 0) {
    player.stepPhase += Math.abs(player.vx) * dt * 0.052;
    const curSign = Math.sin(player.stepPhase) >= 0 ? 1 : -1;
    if (curSign !== player.lastStepSign) {
      player.lastStepSign = curSign;
      sfx.step();
      spawnParticles(player.x + player.w / 2, player.y + player.h, '#5c6478', 2, 55, 180);
    }
  }

  // 5. Гравитация и Wall-Slide
  if (player.dashTimer <= 0) {
    let g = GRAVITY;
    if (player.vy < 0 && !input.jumpHeld) g *= 2.3;
    if (player.vy > 0) g *= 1.22;
    player.vy = Math.min(920, player.vy + g * dt);

    if (player.wallDir !== 0 && !player.grounded && player.vy > 95 && Math.sign(input.x) === player.wallDir) {
      player.vy = 95;
      player.isWallFlipping = false;
      if (Math.random() < 0.4) spawnParticles(player.x + (player.wallDir > 0 ? player.w : 0), player.y + 24, '#7b849b', 1, 40, 120);
    }
  }

  // 6. Прыжок + САЛЬТО С ГРУППИРОВКОЙ ПРИ ОТСКОКЕ ОТ СТЕНЫ!
  if (input.jumpBuffer > 0 && !player.knockdown && player.offBalanceTimer <= 0) {
    if (player.coyoteTimer > 0) {
      player.vy = -575;
      player.grounded = false;
      player.coyoteTimer = 0;
      player.skidTimer = 0;
      input.jumpBuffer = 0;
      player.squashY = 1.24;
      sfx.jump();
      spawnParticles(player.x + player.w / 2, player.y + player.h, '#9296a0', 8, 130, 200);
    } else if (player.wallDir !== 0 && !player.grounded) {
      // ОТСКОК ОТ СТЕНЫ С ЗАКРУТКОЙ В САЛЬТО НАЗАД!
      player.vy = -555;
      player.vx = -player.wallDir * 410;
      player.facing = -player.wallDir;
      player.wallDir = 0;
      player.isWallFlipping = true;
      player.flipAngle = 0;
      input.jumpBuffer = 0;
      sfx.jump();
      spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#c4a46c', 12, 180, 200);
    }
  }

  // 7. Горизонтальная коллизия + ЧЁТКИЙ ЗАХВАТ РУКАМИ ЗА УСТУП (LEDGE GRAB)
  player.x += player.vx * dt;
  player.wallDir = 0;
  for (const p of WORLD.platforms) {
    if (p.type === 'wall') {
      if (rectOverlap(player.x, player.y + 4, player.w, player.h - 8, p.x, p.y, p.w, p.h)) {
        if (player.vx > 0 || (player.x + player.w / 2 < p.x + p.w / 2)) {
          player.x = p.x - player.w;
          player.wallDir = 1;
        } else {
          player.x = p.x + p.w;
          player.wallDir = -1;
        }
        player.vx = 0;
        player.skidTimer = 0;
      }
    }
    // Авто-захват за край любой платформы или колонны, когда голова/плечи поравнялись с углом!
    if (!player.grounded && player.vy > -100 && !player.knockdown && p.type !== 'floor') {
      const shoulderY = player.y + 14;
      if (Math.abs(shoulderY - p.y) < 22) {
        if (player.facing === 1 && Math.abs((player.x + player.w) - p.x) < 18) {
          player.ledgeGrab = { x: p.x - player.w + 2, y: p.y - 6, cornerX: p.x, cornerY: p.y, dir: 1 };
          sfx.step();
        } else if (player.facing === -1 && Math.abs(player.x - (p.x + p.w)) < 18) {
          player.ledgeGrab = { x: p.x + p.w - 2, y: p.y - 6, cornerX: p.x + p.w, cornerY: p.y, dir: -1 };
          sfx.step();
        }
      }
    }
  }

  // 8. Вертикальная коллизия
  const prevBottom = player.y + player.h;
  const impactVy = player.vy;
  player.y += player.vy * dt;
  player.grounded = false;

  for (const p of WORLD.platforms) {
    if (p.type === 'plat') {
      if (player.vy >= 0 && prevBottom <= p.y + 15 && !(input.y > 0.55) &&
          player.x + player.w > p.x + 2 && player.x < p.x + p.w - 2 &&
          player.y + player.h >= p.y && player.y + player.h <= p.y + 28) {
        landOn(p.y, impactVy);
      }
    } else if (p.type === 'floor' || p.type === 'wall') {
      if (rectOverlap(player.x + 2, player.y, player.w - 4, player.h, p.x, p.y, p.w, p.h)) {
        if (player.vy >= 0 && prevBottom <= p.y + 24) {
          landOn(p.y, impactVy);
        } else if (player.vy < 0 && player.y >= p.y + p.h - 24) {
          player.y = p.y + p.h;
          player.vy = 0;
        } else if (p.type === 'floor') {
          landOn(p.y, impactVy);
        }
      }
    }
  }

  if (player.y > WORLD.FLOOR_Y + 80) {
    player.y = WORLD.FLOOR_Y - player.h - 2;
    player.vy = 0; player.grounded = true;
    resetScarf();
  }

  function landOn(surfaceY, vyBefore) {
    player.y = surfaceY - player.h;
    player.isWallFlipping = false;
    player.flipAngle = 0;
    if (vyBefore > 220) {
      player.squashY = Math.max(0.7, 1.0 - (vyBefore / 1600));
      sfx.step();
      spawnParticles(player.x + player.w / 2, surfaceY, '#7b849b', 6, 110, 220);
    }
    if (player.downSmash) {
      player.downSmash = false;
      player.squashY = 0.62;
      cam.shake = 12;
      sfx.goreHit(true);
      spawnParticles(player.x + player.w / 2, surfaceY, '#e05364', 26, 350);
      WORLD.enemies.forEach(e => {
        if (Math.abs((e.x + e.w / 2) - (player.x + player.w / 2)) < 155 && Math.abs((e.y + e.h) - surfaceY) < 65 &&
            hasLineOfSight(player.x + player.w / 2, player.y + 20, e.x + e.w / 2, e.y + 20)) {
          applyAnatomyDamage(e, Math.round(player.dmg * 1.65), Math.sign(e.x - player.x) * 340, true, player.weaponType);
        }
      });
    }
    player.vy = 0;
    player.grounded = true;
    player.coyoteTimer = 0.13;
  }

  updateWorldEntities(dt);
}

// =====================================================
// 5. ОБНОВЛЕНИЕ МИРА, ОТРУБЛЕННЫХ ЧАСТЕЙ ТЕЛ И ВЫБИТОГО ОРУЖИЯ
// =====================================================
function updateWorldEntities(dt) {
  const pxCenter = player.x + player.w / 2;
  const pyCenter = player.y + player.h / 2;

  // Плащ
  let leadX = pxCenter - player.facing * 6;
  let leadY = player.y + 16;
  player.scarf.forEach((node, idx) => {
    node.x += (leadX - node.x - player.facing * 5) * Math.min(1, dt * (24 - idx * 2));
    node.y += (leadY - node.y + Math.sin(performance.now() * 0.015 + idx) * 1.8) * Math.min(1, dt * 20);
    const dist = Math.hypot(node.x - leadX, node.y - leadY);
    if (dist > 15) {
      const ang = Math.atan2(node.y - leadY, node.x - leadX);
      node.x = leadX + Math.cos(ang) * 10;
      node.y = leadY + Math.sin(ang) * 10;
    }
    leadX = node.x; leadY = node.y;
  });

  // 1. Цепи
  WORLD.chains.forEach(ch => {
    ch.nodes.forEach((n, idx) => {
      if (idx === 0) { n.x = ch.anchorX; n.y = ch.anchorY; return; }
      if (Math.abs(n.x - pxCenter) < 24 && Math.abs(n.y - pyCenter) < 34 && Math.abs(player.vx) > 60) {
        n.vx += player.vx * 0.35;
      }
      const prev = ch.nodes[idx - 1];
      const force = (prev.x - n.x) * 38;
      n.vx = (n.vx + force * dt) * Math.pow(0.08, dt);
      n.x += n.vx * dt;
      n.y = ch.anchorY + idx * 12;
    });
  });

  // 2. Люстры
  WORLD.chandeliers.forEach(c => {
    if (c.state === 'falling') {
      c.vy += GRAVITY * 1.15 * dt;
      c.y += c.vy * dt;
      if (c.y >= WORLD.FLOOR_Y - 12) {
        c.y = WORLD.FLOOR_Y - 12;
        c.state = 'crashed';
        cam.shake = 15;
        sfx.goreHit(true); sfx.thunder();
        spawnParticles(c.x, c.y, '#ffae38', 36, 380);
        WORLD.enemies.forEach(e => {
          if (Math.abs((e.x + e.w / 2) - c.x) < 135) {
            applyAnatomyDamage(e, 190, Math.sign((e.x + e.w / 2) - c.x) * 420, true, 'hammer');
          }
        });
      }
    }
  });

  // 3. Физика отрубленных половин тел, черепов и ног (Corpse Ragdoll)
  WORLD.corpses.forEach(c => {
    c.vy += GRAVITY * 0.9 * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot += c.vrot * dt;
    if (c.y >= WORLD.FLOOR_Y - 8) {
      c.y = WORLD.FLOOR_Y - 8;
      c.vy *= -0.35;
      c.vx *= 0.78;
      c.vrot *= 0.7;
    }
  });

  // 4. Физика выбитого оружия врагов
  WORLD.droppedWeapons.forEach(dw => {
    dw.vy += GRAVITY * 0.9 * dt;
    dw.x += dw.vx * dt;
    dw.y += dw.vy * dt;
    if (dw.y >= WORLD.FLOOR_Y - 5) {
      dw.y = WORLD.FLOOR_Y - 5;
      dw.vy = 0; dw.vx *= 0.7;
    } else {
      dw.rot += dt * 14;
    }
  });

  // 5. Лут
  for (let i = WORLD.lootOrbs.length - 1; i >= 0; i--) {
    const orb = WORLD.lootOrbs[i];
    orb.vy += GRAVITY * 0.8 * dt;
    orb.x += orb.vx * dt; orb.y += orb.vy * dt;
    if (orb.y > WORLD.FLOOR_Y - 8) { orb.y = WORLD.FLOOR_Y - 8; orb.vy *= -0.45; orb.vx *= 0.8; }
    const dist = Math.hypot(pxCenter - orb.x, pyCenter - orb.y);
    if (dist < 110) { orb.x += (pxCenter - orb.x) * dt * 9; orb.y += (pyCenter - orb.y) * dt * 9; }
    if (dist < 26) {
      if (orb.type === 'hp') {
        player.hp = Math.min(player.maxHp, player.hp + orb.val);
        addFloatText(player.x, player.y - 14, `+${orb.val} HP`, '#68e09c', true);
      } else {
        player.souls += orb.val;
        addFloatText(player.x, player.y - 14, `+${orb.val} ПЕПЕЛ`, '#f2d899');
      }
      sfx.jump();
      WORLD.lootOrbs.splice(i, 1);
    }
  }

  // 6. Ударные волны Босса
  for (let i = WORLD.shockwaves.length - 1; i >= 0; i--) {
    const sw = WORLD.shockwaves[i];
    sw.x += sw.vx * dt; sw.life -= dt;
    spawnParticles(sw.x, WORLD.FLOOR_Y - 4, '#ffae38', 1, 60, 200);
    if (Math.abs(sw.x - pxCenter) < 22 && player.y + player.h >= WORLD.FLOOR_Y - 14) {
      hurtPlayer(20, Math.sign(sw.vx) * 320, true);
      sw.life = 0;
    }
    if (sw.life <= 0) WORLD.shockwaves.splice(i, 1);
  }

  // 7. ИИ Врагов (с учётом сломанных ног, кровотечения и поиска выбитого оружия!)
  for (let i = WORLD.enemies.length - 1; i >= 0; i--) {
    const e = WORLD.enemies[i];
    if (e.hp <= 0) { WORLD.enemies.splice(i, 1); continue; }
    if (e.flashTimer > 0) e.flashTimer -= dt;
    if (e.atkCooldown > 0) e.atkCooldown -= dt;

    // Кровотечение от кинжалов и вспоротого живота
    if (e.bleedTimer > 0 || e.gutsSpilled) {
      e.bleedTimer -= dt;
      if (Math.random() < 0.15) {
        spawnParticles(e.x + e.w / 2, e.y + e.h * 0.6, '#e03448', 1, 40, 300);
        if (e.gutsSpilled) e.hp -= dt * 3.5;
      }
    }

    // Физика выпавших петель кишок врага
    if (e.gutsSpilled) {
      let gx = e.x + e.w / 2, gy = e.y + e.h * 0.52;
      e.gutNodes.forEach((gn, idx) => {
        gn.x += (gx - gn.x) * Math.min(1, dt * (18 - idx * 2));
        gn.y = Math.min(WORLD.FLOOR_Y - 3, gy + (idx + 1) * 6);
        gx = gn.x; gy = gn.y;
      });
    }

    const exCenter = e.x + e.w / 2, eyCenter = e.y + e.h / 2;
    const dx = pxCenter - exCenter, dy = pyCenter - eyCenter;
    const dist = Math.hypot(dx, dy);
    const canSee = hasLineOfSight(exCenter, eyCenter, pxCenter, pyCenter);

    if (e.state === 'stunned' || e.state === 'stagger') {
      e.timer -= dt;
      e.vx *= Math.pow(0.01, dt);
      if (e.timer <= 0) e.state = 'chase';
    } else if (e.disarmed && WORLD.droppedWeapons.length > 0) {
      // ЕСЛИ ОРУЖИЕ ВЫБИТО -> ВРАГ ПЫТАЕТСЯ ДОПОЛЗТИ/ДОБЕЖАТЬ ДО СВОЕГО КЛИНКА НА ПОЛУ!
      const dw = WORLD.droppedWeapons[0];
      const toWep = dw.x - exCenter;
      e.facing = toWep >= 0 ? 1 : -1;
      const spd = e.legBroken ? 48 : 130;
      e.vx += (e.facing * spd - e.vx) * dt * 6;
      e.stepPhase += Math.abs(e.vx) * dt * 0.06;
      if (Math.abs(toWep) < 26 && Math.abs(e.y + e.h - dw.y) < 35) {
        e.disarmed = false;
        WORLD.droppedWeapons.splice(0, 1);
        addFloatText(exCenter, e.y - 16, 'ПОДНЯЛ ОРУЖИЕ!', '#ffbe42');
      }
    } else if (e.legBroken && e.disarmed) {
      // Без ноги и без оружия — в ужасе отползает на руках от рыцаря!
      e.facing = dx >= 0 ? -1 : 1;
      e.vx += (e.facing * 45 - e.vx) * dt * 5;
      e.stepPhase += Math.abs(e.vx) * dt * 0.08;
    } else if (e.state === 'windup') {
      e.vx *= 0.82;
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = 'strike';
        e.timer = 0.20;
        e.vx = e.facing * (e.legBroken ? 120 : (e.type === 'boss' ? 460 : (e.type === 'warden' ? 330 : 390)));

        if (e.type === 'boss') {
          cam.shake = 14; sfx.thunder();
          WORLD.shockwaves.push({ x: exCenter, vx: -360, life: 1.1 });
          WORLD.shockwaves.push({ x: exCenter, vx: 360, life: 1.1 });
        }

        const hitRange = e.type === 'boss' ? 92 : (e.type === 'warden' ? 76 : 62);
        if (Math.abs(dx) < hitRange && Math.abs(dy) < 62 && canSee) {
          if (player.parryWindow > 0) {
            sfx.parryClang();
            hitstopTimer = 0.095; cam.shake = 13;
            e.state = 'stunned';
            e.timer = e.type === 'boss' ? 1.5 : 2.3;
            e.vx = -e.facing * 260;
            spawnParticles(pxCenter + player.facing * 14, pyCenter, '#6ab0e8', 24, 340);
            addFloatText(exCenter, e.y - 16, 'ПАРИРОВАНИЕ!', '#6ab0e8', true);
            if (player.chainLightning) triggerChainLightning(e, Math.round(player.dmg * 0.85));
          } else {
            const causesKnockdown = (e.type === 'warden' || e.type === 'boss' || player.offBalanceTimer > 0);
            hurtPlayer(e.dmg, e.facing * (causesKnockdown ? 380 : 250), causesKnockdown);
          }
        }
      }
    } else if (e.state === 'strike') {
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = 'chase';
        e.atkCooldown = e.type === 'boss' ? 1.1 : (e.type === 'warden' ? 1.25 : 0.85);
      }
    } else {
      if (dist < 480 && (canSee || e.type === 'wraith')) {
        e.facing = dx >= 0 ? 1 : -1;
        let spd = e.type === 'boss' ? 145 : (e.type === 'warden' ? 105 : (e.type === 'wraith' ? 190 : 155));
        if (e.legBroken) spd = 46; // Со сломанной ногой медленно ползёт!
        if (Math.abs(dx) > (e.type === 'boss' ? 66 : 46)) {
          e.vx += (e.facing * spd - e.vx) * dt * 8;
          e.stepPhase += Math.abs(e.vx) * dt * 0.055;
        } else if (!e.disarmed && e.atkCooldown <= 0 && Math.abs(dy) < 65 && canSee) {
          e.state = 'windup';
          e.atkDuration = e.type === 'boss' ? 0.58 : (e.type === 'warden' ? 0.52 : 0.40);
          e.timer = e.atkDuration;
        }
      } else {
        e.vx *= 0.88;
      }
    }

    e.x += e.vx * dt;
    for (const p of WORLD.platforms) {
      if (p.type === 'wall' && rectOverlap(e.x, e.y + 4, e.w, e.h - 8, p.x, p.y, p.w, p.h)) {
        e.x = (e.vx > 0 || (e.x + e.w / 2 < p.x + p.w / 2)) ? p.x - e.w : p.x + p.w;
        e.vx = 0;
      }
    }

    if (e.type !== 'wraith') {
      const prevEBottom = e.y + e.h;
      e.vy = Math.min(800, e.vy + GRAVITY * dt);
      e.y += e.vy * dt;
      for (const p of WORLD.platforms) {
        if (e.vy >= 0 && prevEBottom <= p.y + 18 &&
            e.x + e.w > p.x + 2 && e.x < p.x + p.w - 2 &&
            e.y + e.h >= p.y && e.y + e.h <= p.y + 30) {
          e.y = p.y - e.h; e.vy = 0;
        }
      }
      if (e.y > WORLD.FLOOR_Y - e.h) { e.y = WORLD.FLOOR_Y - e.h; e.vy = 0; }
    } else {
      const targetY = Math.min(WORLD.FLOOR_Y - e.h - 10, player.y - 6);
      e.y += (targetY - e.y) * dt * 2.5;
    }
  }

  // 8. Алтарь и Врата
  const useBtn = document.getElementById('btn-use');
  const nearShrine = WORLD.shrine && !WORLD.shrine.used && Math.hypot(player.x - WORLD.shrine.x, (player.y + player.h) - WORLD.shrine.y) < 75;
  const nearPortal = WORLD.portal && WORLD.enemies.length === 0 && Math.hypot(player.x - WORLD.portal.x, (player.y + player.h) - WORLD.portal.y) < 85;

  if (nearShrine || nearPortal) {
    useBtn.style.display = 'flex';
    useBtn.textContent = nearShrine ? 'ДАР' : 'ВРАТА';
    if (input.usePressed) {
      input.usePressed = false;
      if (nearShrine) openRelicModal();
      else if (nearPortal) generateRoom(WORLD.roomIndex + 1, player);
    }
  } else {
    useBtn.style.display = 'none';
    input.usePressed = false;
  }

  // 9. Частицы и молнии
  for (let i = WORLD.particles.length - 1; i >= 0; i--) {
    const pt = WORLD.particles[i];
    pt.vy += pt.gravity * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
    if (pt.life <= 0) WORLD.particles.splice(i, 1);
  }
  for (let i = WORLD.lightningBolts.length - 1; i >= 0; i--) {
    WORLD.lightningBolts[i].life -= dt;
    if (WORLD.lightningBolts[i].life <= 0) WORLD.lightningBolts.splice(i, 1);
  }
  for (let i = WORLD.floatTexts.length - 1; i >= 0; i--) {
    const ft = WORLD.floatTexts[i];
    ft.y += ft.vy * dt; ft.life -= dt;
    if (ft.life <= 0) WORLD.floatTexts.splice(i, 1);
  }

  // 10. Камера
  const scale = H / VIEW_H;
  const viewW = W / scale;
  const targetCamX = Math.max(-60, Math.min(WORLD.roomWidth - viewW + 60, pxCenter + player.facing * 48 - viewW / 2));
  const targetCamY = Math.min(WORLD.FLOOR_Y - VIEW_H + 55, player.y - VIEW_H * 0.54);
  cam.x += (targetCamX - cam.x) * Math.min(1, dt * 8);
  cam.y += (targetCamY - cam.y) * Math.min(1, dt * 7);
  if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt * 28);

  updateHUD();
}

function hurtPlayer(dmg, knockVx, knockdown = false) {
  if (player.invuln > 0) return;
  player.hp -= dmg;
  player.invuln = 0.7;
  player.vx = knockVx;
  player.vy = knockdown ? -310 : -200;
  player.ledgeGrab = null;
  if (knockdown) {
    player.knockdown = true;
    player.knockdownTimer = 0.65;
    addFloatText(player.x + player.w / 2, player.y - 24, 'СБИТ С НОГ! [ЖМИ РЫВОК]', '#ffbe42', true);
  }
  cam.shake = 13;
  sfx.goreHit(true);
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#d93848', 18, 260);
  addFloatText(player.x + player.w / 2, player.y - 10, `-${dmg}`, '#ff4d5e', true);
  if (navigator.vibrate) navigator.vibrate(110);

  if (player.hp <= 0) {
    player.hp = 100; player.maxHp = 100;
    player.dmg = 28; player.critChance = 0.15;
    player.vampOnKill = 0; player.rangeBonus = 0;
    player.chainLightning = false; player.noOverswing = false;
    player.weaponType = 'greatsword';
    player.swordColor = '#dce6ff';
    player.atkSpeedMult = 1.0;
    player.relics = []; player.souls = 0;
    generateRoom(1, player);
  }
}

function updateHUD() {
  const pct = Math.max(0, (player.hp / player.maxHp) * 100);
  document.getElementById('hp-Fill').style.width = `${pct}%`;
  document.getElementById('hp-Lag').style.width = `${pct}%`;
  document.getElementById('hp-txt').textContent = `${Math.max(0, Math.ceil(player.hp))} / ${player.maxHp}`;
  document.getElementById('atk-txt').textContent = `УРОН: ${player.dmg}`;
  document.getElementById('souls-txt').textContent = `ПЕПЕЛ: ${player.souls}`;
  const isBoss = (WORLD.roomIndex % 3 === 0);
  document.getElementById('room-name').textContent = isBoss
    ? `ЗАЛ ${WORLD.roomIndex} — ТРОН ПОВЕЛИТЕЛЯ (БОСС)`
    : `ЗАЛ ${WORLD.roomIndex} — ЦИТАДЕЛЬ ПЕПЛА`;
  document.getElementById('room-status').textContent = WORLD.enemies.length > 0
    ? `Врагов в зале: ${WORLD.enemies.length}`
    : `Зал очищен — Врата открыты!`;
  document.getElementById('relics-list').innerHTML = player.relics.map(r => `<span class="relic-tag">${r}</span>`).join('');

  for (let i = 1; i <= 3; i++) {
    const dot = document.getElementById(`cd-${i}`);
    if (player.comboWindow > 0 && player.comboStep >= i) dot.classList.add('active');
    else dot.classList.remove('active');
  }
  document.getElementById('cd-atk').style.height = player.atkCd > 0 ? `${(player.atkCd / player.atkCdMax) * 100}%` : '0%';
  document.getElementById('cd-dash').style.height = player.dashCd > 0 ? `${(player.dashCd / player.dashCdMax) * 100}%` : '0%';
  document.getElementById('cd-parry').style.height = player.parryCd > 0 ? `${(player.parryCd / player.parryCdMax) * 100}%` : '0%';
}

// =====================================================
// 6. РЕНДЕР: НАСТОЯЩИЕ ЗВЕНЬЯ ЦЕПЕЙ, 14-СУСТАВНЫЙ РЫЦАРЬ И АНАТОМИЯ ВРАГОВ
// =====================================================
let stonePat = null, platPat = null;

function render() {
  if (!stonePat) {
    stonePat = ctx.createPattern(window.STONE_TILE, 'repeat');
    platPat = ctx.createPattern(window.PLAT_TILE, 'repeat');
  }

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#07080d');
  grad.addColorStop(1, '#121521');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const scale = H / VIEW_H;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;

  const sx = (Math.random() - 0.5) * cam.shake;
  const sy = (Math.random() - 0.5) * cam.shake;
  ctx.translate(-cam.x + sx, -cam.y + sy);
  const now = performance.now();

  // 1. Фоновые колонны и факелы
  WORLD.bgPillars.forEach(b => {
    const px = b.x - cam.x * 0.15;
    ctx.fillStyle = '#0f111a'; ctx.fillRect(px, -40, b.w, b.h);
    ctx.fillStyle = '#171a26'; ctx.fillRect(px + 8, -40, 12, b.h);
  });

  WORLD.torches.forEach(t => {
    const rad = 64 + Math.sin(now * 0.012 + t.flicker) * 7;
    const tGrad = ctx.createRadialGradient(t.x, t.y, 4, t.x, t.y, rad);
    tGrad.addColorStop(0, 'rgba(255, 165, 55, 0.36)');
    tGrad.addColorStop(1, 'rgba(255, 110, 20, 0)');
    ctx.fillStyle = tGrad;
    ctx.beginPath(); ctx.arc(t.x, t.y, rad, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3b281e'; ctx.fillRect(t.x - 3, t.y, 6, 18);
    ctx.fillStyle = '#ffbe42'; ctx.fillRect(t.x - 4, t.y - 8, 8, 8);
  });

  // 2. НАСТОЯЩИЕ КОВАНЫЕ МЕТАЛЛИЧЕСКИЕ ЦЕПИ (ЧЕРЕДУЮЩИЕСЯ КОЛЬЦА ВМЕСТО ВЕРЁВОЧЕК!)
  WORLD.chains.forEach(ch => {
    for (let i = 0; i < ch.nodes.length - 1; i++) {
      const a = ch.nodes[i], b = ch.nodes[i + 1];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      if (i % 2 === 0) {
        // Широкое кольцо звена с отверстием внутри и бликом металла
        ctx.fillStyle = '#090a0f';
        ctx.fillRect(-7, -4, 14, 8);
        ctx.strokeStyle = '#6c758c';
        ctx.lineWidth = 2;
        ctx.strokeRect(-6, -3, 12, 6);
        ctx.fillStyle = '#aeb8d1';
        ctx.fillRect(-5, -3, 8, 1);
      } else {
        // Повёрнутое ребром звено цепи
        ctx.fillStyle = '#3d4352';
        ctx.fillRect(-7, -2, 14, 4);
        ctx.fillStyle = '#aeb8d1';
        ctx.fillRect(-5, -1, 10, 1);
      }
      ctx.restore();
    }
  });

  // 3. Люстры с кованой цепью
  WORLD.chandeliers.forEach(c => {
    if (c.state === 'hanging') {
      for (let y = c.anchorY; y < c.y; y += 10) {
        ctx.strokeStyle = '#6c758c'; ctx.lineWidth = 2;
        ctx.strokeRect(c.x - 3, y, 6, 8);
      }
    }
    if (c.state !== 'crashed') {
      ctx.fillStyle = '#25293a'; ctx.fillRect(c.x - 18, c.y, 36, 10);
      ctx.fillStyle = '#ffae38'; ctx.fillRect(c.x - 12, c.y - 8, 24, 8);
    }
  });

  // 4. Алтарь на каменном пьедестале и Врата
  if (WORLD.shrine) {
    const sh = WORLD.shrine;
    ctx.fillStyle = '#1e212e'; ctx.fillRect(sh.x - 36, sh.y - 8, 72, 8);
    ctx.fillStyle = '#2a2e40'; ctx.fillRect(sh.x - 24, sh.y - 20, 48, 12);
    ctx.fillStyle = '#383d52'; ctx.fillRect(sh.x - 14, sh.y - 44, 28, 24);
    if (!sh.used) {
      const hoverY = sh.y - 62 + Math.sin(now * 0.005) * 5;
      ctx.fillStyle = 'rgba(196, 164, 108, 0.28)';
      ctx.beginPath(); ctx.arc(sh.x, hoverY, 28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2d899';
      ctx.fillRect(sh.x - 7, hoverY - 7, 14, 14);
    }
  }
  if (WORLD.portal) {
    const pt = WORLD.portal, active = WORLD.enemies.length === 0;
    ctx.fillStyle = '#1f2330'; ctx.fillRect(pt.x - 28, pt.y - 82, 56, 82);
    ctx.strokeStyle = active ? '#68e09c' : '#3a3d4a';
    ctx.lineWidth = 4; ctx.strokeRect(pt.x - 24, pt.y - 78, 48, 78);
    if (active) {
      ctx.fillStyle = 'rgba(104, 224, 156, 0.3)';
      ctx.fillRect(pt.x - 20, pt.y - 74, 40, 74);
    }
  }

  // 5. Платформы, кровь, отрубленные части тел, выбитое оружие
  WORLD.platforms.forEach(p => {
    ctx.fillStyle = p.type === 'plat' ? platPat : stonePat;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = p.type === 'plat' ? '#5c6684' : '#32384d';
    ctx.fillRect(p.x, p.y, p.w, 5);
    ctx.strokeStyle = '#08090d'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.w, p.h);
  });

  ctx.fillStyle = '#8a1625';
  WORLD.bloodStains.forEach(b => ctx.fillRect(b.x, b.y - 2, b.w, 4));

  // Отрубленные половины тел и конечности на полу
  WORLD.corpses.forEach(c => {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rot);
    if (c.kind === 'upperBody') {
      const headSpr = c.enemyType === 'stalker' ? SPRITES.skullHead : SPRITES.wardenHead;
      const chestSpr = c.enemyType === 'stalker' ? SPRITES.boneRibs : SPRITES.wardenChest;
      ctx.drawImage(chestSpr, -12, -8, 24, 16);
      ctx.drawImage(headSpr, -10, -22, 20, 15);
      // Кровавый срез на поясе
      ctx.fillStyle = '#e03448'; ctx.fillRect(-8, 6, 16, 4);
    } else if (c.kind === 'lowerLegs') {
      ctx.fillStyle = '#e03448'; ctx.fillRect(-7, -8, 14, 4);
      ctx.drawImage(SPRITES.knightThigh, -8, -4, 8, 12);
      ctx.drawImage(SPRITES.knightThigh, 2, -4, 8, 12);
    } else if (c.kind === 'skull') {
      ctx.drawImage(SPRITES.skullHead, -9, -9, 18, 16);
    } else {
      ctx.drawImage(SPRITES.knightShin, -4, -6, 8, 12);
    }
    ctx.restore();
  });

  // Выбитое оружие на полу
  WORLD.droppedWeapons.forEach(dw => {
    ctx.save();
    ctx.translate(dw.x, dw.y);
    ctx.rotate(dw.rot);
    ctx.fillStyle = '#c4a46c'; ctx.fillRect(-10, -2, 6, 4);
    ctx.fillStyle = '#aeb8d1'; ctx.fillRect(-4, -3, 20, 5);
    ctx.restore();
  });

  WORLD.barrels.forEach(b => ctx.drawImage(SPRITES.barrel, b.x, b.y, b.w, b.h));
  WORLD.lootOrbs.forEach(orb => {
    ctx.fillStyle = orb.type === 'hp' ? '#68e09c' : '#f2d899';
    ctx.beginPath(); ctx.arc(orb.x, orb.y, 6, 0, Math.PI * 2); ctx.fill();
  });

  // 6. МНОГОСУСТАВНЫЙ РЕНДЕР ВРАГОВ С РАНАМИ, КИШКАМИ И ПЕРЕЛОМАМИ!
  WORLD.enemies.forEach(e => {
    drawArticulatedEnemy(e, now);
  });

  // 7. 14-СУСТАВНЫЙ РЕНДЕР ПЕПЕЛЬНОГО РЫЦАРЯ (БЕДРО -> КОЛЕНО -> ГОЛЕНЬ -> СТОПА, ПЛЕЧО -> ЛОКОТЬ -> КИСТЬ -> ОРУЖИЕ)!
  drawArticulatedKnight(now);

  // 8. Молнии, частицы и текст
  WORLD.lightningBolts.forEach(bolt => {
    ctx.save();
    ctx.globalAlpha = bolt.life / bolt.maxLife;
    ctx.strokeStyle = '#00f3ff'; ctx.lineWidth = 6;
    ctx.beginPath();
    bolt.points.forEach((pt, idx) => { if (idx === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
    ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
  });

  WORLD.particles.forEach(pt => {
    ctx.fillStyle = pt.color;
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillRect(Math.floor(pt.x - pt.size / 2), Math.floor(pt.y - pt.size / 2), pt.size, pt.size);
  });
  ctx.globalAlpha = 1;

  WORLD.floatTexts.forEach(ft => {
    ctx.font = ft.big ? '900 15px sans-serif' : '800 11px sans-serif';
    ctx.fillStyle = '#08090d'; ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  });

  ctx.restore();
}

// Отрисовка 2-сегментной конечности (Бедро + Голень + Стопа ИЛИ Плечо + Предплечье + Кисть)
function drawTwoBoneLimb(hipX, hipY, thighAng, thighLen, shinAng, shinLen, sprUpper, sprLower, sprEnd) {
  ctx.save();
  ctx.translate(hipX, hipY);
  ctx.rotate(thighAng);
  ctx.drawImage(sprUpper, -5, 0, 10, thighLen + 2);
  ctx.translate(0, thighLen);
  ctx.rotate(shinAng);
  ctx.drawImage(sprLower, -5, 0, 10, shinLen + 2);
  ctx.translate(0, shinLen);
  if (sprEnd) ctx.drawImage(sprEnd, -4, -2, 12, 7);
  ctx.restore();
}

function drawArticulatedKnight(now) {
  // Плащ
  ctx.strokeStyle = '#8f1928';
  ctx.lineWidth = 7;
  ctx.beginPath();
  player.scarf.forEach((n, idx) => {
    if (idx === 0) ctx.moveTo(n.x, n.y);
    else ctx.lineTo(n.x, n.y);
  });
  ctx.stroke();

  ctx.save();
  if (player.invuln > 0 && Math.floor(now / 45) % 2 === 0) ctx.globalAlpha = 0.45;

  const cx = player.x + player.w / 2;
  const bottomY = player.y + player.h;
  ctx.translate(cx, bottomY);
  ctx.scale(player.facing * (2 - player.squashY), player.squashY);

  // Сальто с группировкой при отскоке от стены ИЛИ боевой кувырок!
  const isTucked = (player.dashTimer > 0 || player.isWallFlipping);
  if (isTucked) {
    ctx.translate(0, -30);
    ctx.rotate(player.isWallFlipping ? -player.flipAngle : player.flipAngle);
    ctx.translate(0, 30);
  } else if (player.knockdown) {
    ctx.rotate(-1.4);
  }

  // ВЫЧИСЛЕНИЕ УГЛОВ БЕДРА И КОЛЕНА (2-СУСТАВНЫЕ НОГИ!)
  let lThigh = 0, lShin = 0, rThigh = 0, rShin = 0;
  let pelvisY = -28;

  if (isTucked) {
    // В сальто колени плотно поджаты к груди (группировка)!
    lThigh = -1.25; lShin = 1.95;
    rThigh = -1.05; rShin = 1.85;
    pelvisY = -26;
  } else if (player.ledgeGrab) {
    // Висим на руках на краю плиты, ноги свободно упираются в стену
    lThigh = -0.35; lShin = 0.55;
    rThigh = 0.15; rShin = 0.35;
  } else if (!player.grounded) {
    lThigh = -0.65; lShin = 1.15;
    rThigh = 0.35; rShin = 0.65;
  } else if (player.skidTimer > 0) {
    // В ТОРМОЗНОМ ЗАНОСЕ передняя нога жёстко выставлена вперёд, задняя согнута!
    lThigh = 0.55; lShin = 0.65;
    rThigh = -0.85; rShin = 0.15;
    pelvisY = -23;
  } else if (player.offBalanceTimer > 0) {
    // Потеря равновесия — упал на одно колено!
    lThigh = 0.85; lShin = 1.25;
    rThigh = -0.95; rShin = 1.15;
    pelvisY = -19;
  } else if (Math.abs(player.vx) > 20) {
    // Живой цикл бега с подъёмом бедра и сгибом колена!
    const s1 = Math.sin(player.stepPhase);
    const c1 = Math.cos(player.stepPhase);
    const s2 = Math.sin(player.stepPhase + Math.PI);
    const c2 = Math.cos(player.stepPhase + Math.PI);
    lThigh = -s1 * 0.75;
    lShin = Math.max(0.08, c1 * 0.95 + 0.35);
    rThigh = -s2 * 0.75;
    rShin = Math.max(0.08, c2 * 0.95 + 0.35);
    pelvisY = -28 - Math.abs(c1) * 3;
  }

  // 1. Задняя нога
  drawTwoBoneLimb(-3, pelvisY, lThigh, 13, lShin, 13, SPRITES.knightThigh, SPRITES.knightShin, SPRITES.knightFoot);

  // 2. Таз и Грудная клетка с наклоном
  ctx.save();
  ctx.translate(0, pelvisY);
  ctx.drawImage(SPRITES.knightPelvis, -9, -5, 18, 8);
  ctx.rotate(player.torsoLean);

  // ВЫЧИСЛЕНИЕ УГЛОВ ПЛЕЧА, ЛОКТЯ И ЗАПЯСТЬЯ (БИОМЕХАНИКА РАЗНЫХ УДАРОВ!)
  let fShoulder = 0.35, fElbow = -0.85, fWrist = -0.2;
  let bShoulder = -0.25, bElbow = -0.55;

  if (player.ledgeGrab) {
    // ОБЕ РУКИ ВЫТЯНУТЫ ВВЕРХ И ДЕРЖАТСЯ КИСТЯМИ ЗА УГОЛ ПЛАТФОРМЫ!
    fShoulder = -1.95; fElbow = -0.35; fWrist = 0.4;
    bShoulder = -1.75; bElbow = -0.45;
  } else if (isTucked) {
    fShoulder = 0.8; fElbow = -1.6;
    bShoulder = 0.6; bElbow = -1.5;
  } else if (player.offBalanceTimer > 0) {
    // Опирается тяжёлым оружием в пол!
    fShoulder = 0.95; fElbow = 0.15; fWrist = 0.6;
  } else if (player.atkTimer > 0) {
    const t = 1 - (player.atkTimer / player.atkDuration);
    if (player.comboStep === 1) {
      // Удар 1: Замах из-за плеча и хлесткий рубящий разгиб локтя и кисти
      fShoulder = -1.5 + t * 2.5;
      fElbow = -1.1 + t * 0.95;
      fWrist = -0.6 + t * 1.1;
    } else if (player.comboStep === 2) {
      // Удар 2: Восходящий апперкот снизу вверх с разворотом кисти
      fShoulder = 1.2 - t * 2.6;
      fElbow = -0.3 - t * 0.5;
      fWrist = 0.5 - t * 1.2;
    } else {
      // Удар 3 (Финишер): Мощнейший двуручный обвал сверху вниз всем весом корпуса!
      fShoulder = -2.2 + t * 3.4;
      fElbow = -0.8 + t * 0.75;
      fWrist = -0.5 + t * 1.35;
      bShoulder = fShoulder + 0.25;
      bElbow = fElbow;
    }
  } else if (Math.abs(player.vx) > 20) {
    const armSwing = Math.sin(player.stepPhase) * 0.45;
    fShoulder = 0.25 + armSwing * 0.5;
    bShoulder = -armSwing;
  }

  // Задняя рука (Плечо -> Локоть -> Предплечье -> Кисть; у Кинжалов держит второй клинок!)
  drawArmWithWeapon(-4, -18, bShoulder, bElbow, 0, player.weaponType === 'daggers' ? 'offhandDagger' : 'none');

  // Кираса и Голова
  ctx.drawImage(SPRITES.knightChest, -12, -23, 24, 22);
  ctx.save();
  ctx.translate(1, -24);
  ctx.rotate(player.torsoLean * 0.35);
  ctx.drawImage(SPRITES.knightHead, -11, -15, 22, 17);
  ctx.restore();

  ctx.restore(); // Возврат к тазу для передней ноги

  // 3. Передняя нога (рисуется поверх таза для глубины шага!)
  drawTwoBoneLimb(3, pelvisY, rThigh, 13, rShin, 13, SPRITES.knightThigh, SPRITES.knightShin, SPRITES.knightFoot);

  // 4. Передняя рука с основным оружием (рисуется на переднем плане!)
  ctx.save();
  ctx.translate(0, pelvisY);
  ctx.rotate(player.torsoLean);
  drawArmWithWeapon(4, -18, fShoulder, fElbow, fWrist, player.weaponType);
  ctx.restore();

  ctx.restore(); // Конец рыцаря

  if (player.parryWindow > 0) {
    ctx.strokeStyle = '#6ab0e8'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, player.y + player.h / 2, 36, -Math.PI * 0.45, Math.PI * 0.45, player.facing < 0);
    ctx.stroke();
  }
}

function drawArmWithWeapon(shX, shY, shoulderAng, elbowAng, wristAng, weaponKind) {
  ctx.save();
  ctx.translate(shX, shY);
  ctx.rotate(shoulderAng);
  // Плечо
  ctx.drawImage(SPRITES.knightUpperArm, -5, 0, 10, 13);
  // Локоть и предплечье
  ctx.translate(0, 11);
  ctx.rotate(elbowAng);
  ctx.drawImage(SPRITES.knightForearm, -5, 0, 10, 12);
  // Запястье и кисть
  ctx.translate(0, 10);
  ctx.rotate(wristAng - Math.PI * 0.45);

  if (weaponKind !== 'none') {
    ctx.fillStyle = '#c4a46c';
    ctx.fillRect(-5, -2, 9, 4);
    if (weaponKind === 'hammer') {
      // Двуручный Молот Титана
      ctx.fillStyle = '#5c3c24'; ctx.fillRect(2, -2, 34, 4);
      ctx.fillStyle = player.swordColor; ctx.fillRect(28, -13, 15, 26);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(30, -10, 5, 20);
    } else if (weaponKind === 'daggers' || weaponKind === 'offhandDagger') {
      // Клинок Ворона
      ctx.fillStyle = player.swordColor; ctx.fillRect(4, -2, 20, 4);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(4, -1, 18, 2);
    } else {
      // Палаческий Клеймор
      ctx.fillRect(2, -8, 4, 16);
      const bladeLen = 34 + player.rangeBonus * 0.35;
      ctx.fillStyle = player.swordColor; ctx.fillRect(6, -3, bladeLen, 6);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(6, -2, bladeLen - 2, 2);
      // Кровь на кончике лезвия
      if (WORLD.bloodStains.length > 0) {
        ctx.fillStyle = '#e03448'; ctx.fillRect(bladeLen - 6, -3, 10, 3);
      }
    }
  }
  // Кисть в латной перчатке сжимает рукоять!
  ctx.drawImage(SPRITES.knightHand, -4, -4, 9, 8);
  ctx.restore();
}

// =====================================================
// 7. ОТРИСОВКА СУСТАВНЫХ ВРАГОВ, ИХ РАН, КИШОК И ПОЛЗАНИЯ БЕЗ НОГ
// =====================================================
function drawArticulatedEnemy(e, now) {
  // Физические петли кишок, если живот вспорот!
  if (e.gutsSpilled && e.gutNodes.length > 0) {
    ctx.strokeStyle = '#d46a7e';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.x + e.w / 2, e.y + e.h * 0.55);
    e.gutNodes.forEach(gn => ctx.lineTo(gn.x, gn.y));
    ctx.stroke();
  }

  ctx.save();
  const cx = e.x + e.w / 2;
  const bottomY = e.y + e.h;

  if (e.state === 'windup') {
    ctx.fillStyle = '#ffbe42'; ctx.font = '900 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('!', cx, e.y - 12);
  }
  if (e.state === 'stunned') {
    ctx.fillStyle = '#6ab0e8'; ctx.font = '900 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('ОГЛУШЁН', cx, e.y - 14);
  }

  ctx.translate(cx, bottomY);
  ctx.scale(e.facing, 1);
  if (e.flashTimer > 0) ctx.filter = 'brightness(4)';

  const isBoss = e.type === 'boss';
  const sc = isBoss ? 1.35 : 1.0;
  ctx.scale(sc, sc);

  // Если нога перебита молотом -> враг лежит горизонтально и подтягивается руками по полу!
  if (e.legBroken) {
    ctx.translate(0, -8);
    ctx.rotate(1.18);
  }

  const s1 = Math.sin(e.stepPhase);
  const s2 = Math.sin(e.stepPhase + Math.PI);
  const lThigh = e.legBroken ? 0.4 : -s1 * 0.65;
  const lShin = e.legBroken ? 0.2 : Math.max(0.1, Math.cos(e.stepPhase) * 0.8 + 0.3);
  const rThigh = -s2 * 0.65;
  const rShin = Math.max(0.1, Math.cos(e.stepPhase + Math.PI) * 0.8 + 0.3);

  // Суставные ноги врага (если нога перебита — рисуем только одну и кровавую культю!)
  if (e.type !== 'wraith') {
    drawTwoBoneLimb(-3, -24, lThigh, 11, lShin, 11, SPRITES.knightThigh, SPRITES.knightShin, SPRITES.knightFoot);
    if (!e.legBroken) {
      drawTwoBoneLimb(3, -24, rThigh, 11, rShin, 11, SPRITES.knightThigh, SPRITES.knightShin, SPRITES.knightFoot);
    } else {
      ctx.fillStyle = '#e03448'; ctx.fillRect(1, -18, 7, 7);
    }
  }

  // Торс и Голова врага
  const chestSpr = e.type === 'stalker' ? SPRITES.boneRibs : SPRITES.wardenChest;
  const headSpr = e.type === 'stalker' ? SPRITES.skullHead : SPRITES.wardenHead;
  ctx.drawImage(chestSpr, -12, -44, 24, 22);
  ctx.drawImage(headSpr, -11, -58, 22, 16);

  // Отрисовка полученных ран прямо на теле врага!
  e.wounds.forEach(w => {
    ctx.fillStyle = w.type === 'crush' ? '#5e111b' : '#ff2a48';
    ctx.fillRect(w.rx - 4, -34 + w.ry * 0.5, 9, 4);
  });

  // Суставная рука врага и его оружие (если оружие не выбито!)
  let eShoulder = 0.25, eElbow = -0.6;
  if (e.legBroken) {
    // Гребёт рукой по полу при ползании!
    eShoulder = -0.9 + Math.sin(e.stepPhase * 1.5) * 0.7;
    eElbow = -0.4;
  } else if (e.state === 'windup') {
    eShoulder = -1.65; eElbow = -0.9;
  } else if (e.state === 'strike') {
    eShoulder = 0.95; eElbow = 0.1;
  }

  ctx.save();
  ctx.translate(4, -40);
  ctx.rotate(eShoulder);
  ctx.drawImage(SPRITES.knightUpperArm, -4, 0, 8, 11);
  ctx.translate(0, 10);
  ctx.rotate(eElbow);
  ctx.drawImage(SPRITES.knightForearm, -4, 0, 8, 11);
  ctx.translate(0, 9);

  if (!e.disarmed && e.type !== 'wraith') {
    ctx.rotate(-1.2);
    ctx.fillStyle = '#8d96ad';
    if (e.type === 'warden' || isBoss) {
      ctx.fillRect(0, -3, 28, 4);
      ctx.fillStyle = '#e03448'; ctx.fillRect(18, -11, 10, 16);
    } else {
      ctx.fillRect(0, -2, 22, 4);
    }
  }
  ctx.drawImage(SPRITES.knightHand, -3, -3, 7, 7);
  ctx.restore();

  ctx.filter = 'none';
  ctx.restore();

  if (e.hp < e.maxHp || e.type === 'boss') {
    const barW = e.type === 'boss' ? 95 : e.w + 8;
    const bx = cx - barW / 2;
    ctx.fillStyle = '#120d0f'; ctx.fillRect(bx, e.y - 10, barW, 5);
    ctx.fillStyle = e.type === 'boss' ? '#ffae38' : '#e63246';
    ctx.fillRect(bx + 1, e.y - 9, (barW - 2) * (e.hp / e.maxHp), 3);
  }
}

generateRoom(1, player);
let prev = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.033, (now - prev) / 1000);
  prev = now;
  update(dt);
  render();
}
requestAnimationFrame(loop);
