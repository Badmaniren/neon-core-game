// src/game.js — Активный 6-суставный скелет, инерция, баланс, Ledge-Grab, интерактив и рендер

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

const VIEW_H = 470;
const GRAVITY = 1520;
let hitstopTimer = 0;
const cam = { x: 0, y: 0, shake: 0 };

// =====================================================
// 1. ВВОД (ТАЧСКРИН + КЛАВИАТУРА)
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
// 2. ИГРОК И ФИЗИЧЕСКИЙ СКЕЛЕТ (ACTIVE RAGDOLL / IK RIG)
// =====================================================
const player = {
  x: 120, y: 350, w: 28, h: 46,
  vx: 0, vy: 0,
  facing: 1,
  grounded: false,
  coyoteTimer: 0,
  wallDir: 0,
  ledgeGrab: null,      // Захват руками за край платформы { x, y, dir }
  skidTimer: 0,         // Занос при резком развороте на скорости
  offBalanceTimer: 0,   // Потеря равновесия при промахе тяжёлым мечом (Overswing)
  knockdown: false,     // Сбит с ног тяжёлым ударом (можно выйти Tech-кувырком!)
  knockdownTimer: 0,
  noOverswing: false,
  weaponType: 'greatsword', // 'greatsword' | 'daggers' | 'hammer'
  moveSpeed: 320,
  hp: 100, maxHp: 100,
  dmg: 26,
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
  atkDuration: 0.25,
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
  // Параметры процедурного скелета (IK Rig)
  stepPhase: 0,
  lastStepSign: 1,
  torsoLean: 0,         // Наклон корпуса по инерции (рад)
  squashY: 1.0,         // Пружина приземления / прыжка
  rollAngle: 0,         // Вращение в кувырке 360
  scarf: []
};
for (let i = 0; i < 6; i++) player.scarf.push({ x: player.x, y: player.y });

window.resetScarf = function() {
  for (let i = 0; i < player.scarf.length; i++) {
    player.scarf[i].x = player.x + player.w / 2 - player.facing * i * 4;
    player.scarf[i].y = player.y + 12;
  }
};

function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// =====================================================
// 3. БОЁВКА, ПЕРЕВЕС МЕЧА (OVERSWING) И ИНТЕРАКТИВНЫЕ ОБЪЕКТЫ
// =====================================================
function performAttack() {
  if (!player.grounded && input.y > 0.4) {
    player.downSmash = true;
    player.vy = 720;
    player.atkTimer = 0.36;
    player.atkDuration = 0.36;
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
  const isHeavyWeapon = player.weaponType === 'hammer';
  const isLightWeapon = player.weaponType === 'daggers';

  player.atkDuration = (isFinisher ? 0.32 : 0.20) * player.atkSpeedMult;
  player.atkTimer = player.atkDuration;
  player.atkCd = (isFinisher ? 0.56 : (player.comboStep === 2 ? 0.30 : 0.26)) * player.atkSpeedMult;
  player.atkCdMax = player.atkCd;
  player.comboWindow = isFinisher ? 0 : 0.75;

  // Импульс выпада вперёд
  const lunge = isFinisher ? (isHeavyWeapon ? 370 : 310) : 175;
  player.vx = player.facing * lunge;
  sfx.slash(player.comboStep, isLightWeapon ? 1.35 : (isHeavyWeapon ? 0.75 : 1.0));

  const reach = (isFinisher ? 84 : 66) + player.rangeBonus;
  const hitX = player.facing === 1 ? player.x + player.w * 0.35 : player.x + player.w * 0.65 - reach;
  const hitY = player.y - 14;
  const hitW = reach;
  const hitH = player.h + 24;

  WORLD.slashArcs.push({
    x: player.x + player.w / 2,
    y: player.y + player.h / 2,
    dir: player.facing,
    step: player.comboStep,
    color: isFinisher ? '#ffbe42' : player.swordColor,
    radius: reach,
    life: 0.18,
    maxLife: 0.18
  });

  const pxCenter = player.x + player.w / 2;
  const pyCenter = player.y + player.h / 2;
  let hitAnything = false;

  // 1. Толчок висячих цепей взмахом меча
  WORLD.chains.forEach(ch => {
    ch.nodes.forEach(n => {
      if (Math.hypot(n.x - pxCenter, n.y - pyCenter) < reach + 15) {
        n.vx += player.facing * 240;
        sfx.chainClink();
      }
    });
  });

  // 2. Разрубание цепей подвесных люстр!
  WORLD.chandeliers.forEach(c => {
    if (c.state === 'hanging') {
      if (Math.abs(c.x - (pxCenter + player.facing * 30)) < 55 && pyCenter < c.y + 45) {
        c.state = 'falling';
        c.vy = 60;
        hitAnything = true;
        sfx.parryClang();
        spawnParticles(c.x, c.y - 20, '#ffbe42', 14, 220);
        addFloatText(c.x, c.y - 25, 'ЦЕПЬ ПЕРЕРУБЛЕНА!', '#ffbe42', true);
      }
    }
  });

  // 3. Разрушение деревянных бочек
  for (let i = WORLD.barrels.length - 1; i >= 0; i--) {
    const b = WORLD.barrels[i];
    if (rectOverlap(hitX, hitY, hitW, hitH, b.x, b.y, b.w, b.h)) {
      hitAnything = true;
      breakBarrel(i);
    }
  }

  // 4. Попадание по врагам
  WORLD.enemies.forEach(e => {
    const exCenter = e.x + e.w / 2, eyCenter = e.y + e.h / 2;
    if (rectOverlap(hitX, hitY, hitW, hitH, e.x, e.y, e.w, e.h) &&
        hasLineOfSight(pxCenter, pyCenter, exCenter, eyCenter)) {
      hitAnything = true;
      const stunnedBonus = e.state === 'stunned' ? 1.8 : 1.0;
      const isCrit = isFinisher || e.state === 'stunned' || Math.random() < player.critChance;
      const dmg = Math.round(player.dmg * (isFinisher ? 1.5 : 1.0) * (isCrit ? 1.7 : 1.0) * stunnedBonus);
      damageEnemy(e, dmg, player.facing * (isFinisher ? 340 : 195), isCrit);

      if (isHeavyWeapon && isFinisher) {
        e.state = 'stunned';
        e.timer = 1.4;
      }
      if ((isFinisher || e.state === 'stunned') && player.chainLightning) {
        triggerChainLightning(e, Math.round(dmg * 0.65));
      }
    }
  });

  if (hitAnything) {
    // Импульс меча погашен о врага — идеальный баланс!
    hitstopTimer = isFinisher ? 0.068 : 0.035;
    cam.shake = isFinisher ? 9.5 : 4.5;
    if (navigator.vibrate) navigator.vibrate(isFinisher ? 35 : 15);
  } else if (isFinisher && !isLightWeapon && !player.noOverswing && player.grounded) {
    // ПРОМАХ ТЯЖЁЛЫМ ФИНАЛЬНЫМ УДАРОМ В ПУСТОТУ -> МЕЧ ПЕРЕВЕШИВАЕТ И ТЯНЕТ ЗА СОБОЙ!
    player.offBalanceTimer = isHeavyWeapon ? 0.55 : 0.40;
    player.vx = player.facing * (isHeavyWeapon ? 430 : 350);
    player.atkCd = 0.72;
    player.atkCdMax = 0.72;
    cam.shake = 5;
    spawnParticles(player.x + player.w / 2, player.y + player.h, '#9296a0', 9, 150, 300);
    addFloatText(player.x + player.w / 2, player.y - 16, 'ПЕРЕВЕС МЕЧА!', '#ffae38', false);
  }
}

function breakBarrel(idx) {
  const b = WORLD.barrels[idx];
  sfx.woodBreak();
  spawnParticles(b.x + 12, b.y + 14, '#825836', 16, 260);
  spawnParticles(b.x + 12, b.y + 14, '#4a5162', 6, 180);
  // Выпадение сфер HP или Пепла
  const isHeal = Math.random() < 0.45;
  WORLD.lootOrbs.push({
    x: b.x + 12, y: b.y + 10,
    vx: (Math.random() - 0.5) * 140,
    vy: -220,
    type: isHeal ? 'hp' : 'soul',
    val: isHeal ? 18 : 15
  });
  WORLD.barrels.splice(idx, 1);
}

function triggerChainLightning(sourceEnemy, boltDmg) {
  const sx = sourceEnemy.x + sourceEnemy.w / 2;
  const sy = sourceEnemy.y + sourceEnemy.h / 2;
  spawnLightningBolt(player.x + player.w / 2, player.y + 20, sx, sy);
  WORLD.enemies.forEach(other => {
    if (other !== sourceEnemy && other.hp > 0) {
      const ox = other.x + other.w / 2, oy = other.y + other.h / 2;
      if (Math.hypot(ox - sx, oy - sy) < 260) {
        spawnLightningBolt(sx, sy, ox, oy);
        damageEnemy(other, boltDmg, Math.sign(ox - sx) * 180, false, '#00f3ff');
      }
    }
  });
}

function damageEnemy(e, dmg, knockVx, isCrit, customColor = null) {
  e.hp -= dmg;
  e.vx = e.type === 'boss' ? knockVx * 0.35 : knockVx;
  e.vy = e.type === 'boss' ? -60 : -130;
  e.flashTimer = 0.12;
  if (e.state !== 'stunned' && e.type !== 'boss' && (e.type !== 'warden' || isCrit)) {
    e.state = 'stagger';
    e.timer = 0.25;
  }
  sfx.hit(isCrit);
  spawnParticles(e.x + e.w / 2, e.y + e.h / 2, customColor || (isCrit ? '#ffbe42' : '#d93848'), isCrit ? 16 : 9, 260);
  addFloatText(e.x + e.w / 2, e.y - 8, isCrit ? `${dmg}!` : `${dmg}`, customColor || (isCrit ? '#ffbe42' : '#f5efe6'), isCrit);

  if (WORLD.bloodStains.length < 65) {
    WORLD.bloodStains.push({ x: e.x + Math.random() * e.w, y: WORLD.FLOOR_Y, w: 6 + Math.random() * 12 });
  }
  if (e.hp <= 0) {
    spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#9e1b28', e.type === 'boss' ? 45 : 24, 340);
    player.souls += e.type === 'boss' ? 120 : (e.type === 'warden' ? 25 : 12);
    if (player.vampOnKill > 0) {
      player.hp = Math.min(player.maxHp, player.hp + player.vampOnKill);
      addFloatText(player.x, player.y - 12, `+${player.vampOnKill} HP`, '#68e09c');
    }
  }
}

// Модалка Алтаря
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
// 4. ГЛАВНЫЙ ФИЗИЧЕСКИЙ ЦИКЛ (СКЕЛЕТ, ЗАНОС, LEDGE-GRAB, РЭГДОЛЛ)
// =====================================================
function update(dt) {
  if (pausedForModal) return;
  if (hitstopTimer > 0) { hitstopTimer -= dt; return; }

  if (input.jumpBuffer > 0) input.jumpBuffer -= dt;
  if (player.coyoteTimer > 0) player.coyoteTimer -= dt;
  if (player.atkTimer > 0) player.atkTimer -= dt;
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

  // Возврат упругой пружины корпуса (Squash & Stretch) к 1.0
  player.squashY += (1.0 - player.squashY) * Math.min(1, dt * 16);

  // А) ЕСЛИ ГЕРОЙ ВИСИТ НА КРАЮ УСТУПА (LEDGE GRAB)
  if (player.ledgeGrab) {
    player.vx = 0; player.vy = 0;
    player.x = player.ledgeGrab.x;
    player.y = player.ledgeGrab.y;
    if (input.jumpBuffer > 0 || input.y < -0.4) {
      // Взрывной подъём с кувырком наверх плиты!
      player.vy = -520;
      player.vx = player.ledgeGrab.dir * 220;
      player.dashTimer = 0.14;
      player.ledgeGrab = null;
      input.jumpBuffer = 0;
      sfx.jump();
    } else if (input.y > 0.5 || input.dashPressed) {
      player.ledgeGrab = null;
      input.dashPressed = false;
    }
    updateWorldEntities(dt);
    return;
  }

  // Б) ЕСЛИ ГЕРОЙ СБИТ С НОГ ТЯЖЁЛЫМ УДАРОМ (KNOCKDOWN + TECH ROLL)
  if (player.knockdown) {
    player.knockdownTimer -= dt;
    // Скилловый выход из падения (Tech Roll) по кнопке РЫВКА!
    if (input.dashPressed && player.dashCd <= 0) {
      input.dashPressed = false;
      player.knockdown = false;
      player.dashTimer = 0.22;
      player.dashCd = player.dashCdMax * 0.5;
      player.invuln = 0.35;
      player.vy = -180;
      player.vx = player.facing * 520;
      sfx.dash();
      addFloatText(player.x + player.w / 2, player.y - 18, 'ТЕХ-КУВЫРОК!', '#00f3ff', true);
    } else if (player.knockdownTimer <= 0 && player.grounded) {
      player.knockdown = false;
      player.squashY = 0.75;
    }
  }

  // 1. Парирование щитом
  if (input.parryPressed && player.parryCd <= 0 && player.dashTimer <= 0 && !player.knockdown && player.offBalanceTimer <= 0) {
    player.parryWindow = 0.28;
    player.parryCd = player.parryCdMax;
    player.vx *= 0.2;
    sfx.slash(1);
  }
  input.parryPressed = false;

  // 2. Рывок / Боевое сальто (может отменить потерю равновесия!)
  if (input.dashPressed && player.dashCd <= 0 && player.dashTimer <= 0 && !player.knockdown) {
    player.dashTimer = 0.20;
    player.dashCd = player.dashCdMax;
    player.invuln = 0.26;
    player.offBalanceTimer = 0;
    player.downSmash = false;
    player.rollAngle = 0;
    if (input.x !== 0) player.facing = Math.sign(input.x);
    player.vx = player.facing * 690;
    player.vy = 0;
    sfx.dash();
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#c4a46c', 10, 160, 0);
  }
  input.dashPressed = false;

  // Разбивание бочек кувырком на скорости!
  if (player.dashTimer > 0) {
    player.rollAngle += dt * 32;
    for (let i = WORLD.barrels.length - 1; i >= 0; i--) {
      const b = WORLD.barrels[i];
      if (rectOverlap(player.x, player.y, player.w, player.h, b.x, b.y, b.w, b.h)) {
        breakBarrel(i);
      }
    }
  }

  // 3. Атака мечом
  if (input.atkPressed && player.atkCd <= 0 && player.dashTimer <= 0 && !player.knockdown && player.offBalanceTimer <= 0) {
    performAttack();
  }
  input.atkPressed = false;

  // 4. Движение с ИНЕРЦИЕЙ, НАКЛОНОМ КОРПУСА и ТОРМОЗНЫМ ЗАНОСОМ (TURN-SKID)
  if (player.dashTimer <= 0 && player.atkTimer <= 0 && player.parryWindow <= 0 && !player.knockdown && player.offBalanceTimer <= 0) {
    if (input.x !== 0) {
      const desiredDir = Math.sign(input.x);
      // Если бежали на полной скорости и резко дёрнули стик в обратную сторону -> ЗАНОС (Skid)!
      if (player.grounded && Math.abs(player.vx) > 210 && desiredDir !== Math.sign(player.vx) && player.skidTimer <= 0) {
        player.skidTimer = 0.14;
        sfx.step();
        spawnParticles(player.x + player.w / 2, player.y + player.h, '#c4a46c', 8, 130, 250);
      }
      player.facing = desiredDir;
      const accel = player.grounded ? (player.skidTimer > 0 ? 11 : 16) : 12;
      const targetVx = input.x * player.moveSpeed;
      player.vx += (targetVx - player.vx) * Math.min(1, dt * accel);
    } else {
      player.vx *= Math.pow(player.grounded ? 0.0008 : 0.02, dt);
    }
  } else if ((player.atkTimer > 0 && !player.downSmash) || player.offBalanceTimer > 0 || player.knockdown) {
    player.vx *= Math.pow(0.03, dt);
  }

  // Вычисление процедурного наклона торса и фазы шага ног
  if (player.offBalanceTimer > 0) {
    // Меч перевесил — корпус сильно завален вперёд!
    player.torsoLean += (player.facing * 0.58 - player.torsoLean) * dt * 18;
  } else if (player.skidTimer > 0) {
    // Занос при торможении — корпус откинут назад!
    player.torsoLean += (-player.facing * 0.38 - player.torsoLean) * dt * 20;
  } else {
    const targetLean = (player.vx / player.moveSpeed) * 0.24;
    player.torsoLean += (targetLean - player.torsoLean) * Math.min(1, dt * 14);
  }

  if (player.grounded && Math.abs(player.vx) > 25) {
    player.stepPhase += Math.abs(player.vx) * dt * 0.055;
    const curSign = Math.sin(player.stepPhase) >= 0 ? 1 : -1;
    if (curSign !== player.lastStepSign) {
      player.lastStepSign = curSign;
      sfx.step();
      spawnParticles(player.x + player.w / 2, player.y + player.h, '#5c6478', 2, 55, 180);
    }
  } else {
    player.stepPhase = 0;
  }

  // 5. Гравитация и скольжение по стенам
  if (player.dashTimer <= 0) {
    let g = GRAVITY;
    if (player.vy < 0 && !input.jumpHeld) g *= 2.3;
    if (player.vy > 0) g *= 1.22;
    player.vy = Math.min(920, player.vy + g * dt);

    if (player.wallDir !== 0 && !player.grounded && player.vy > 100 && Math.sign(input.x) === player.wallDir) {
      player.vy = 100;
      if (Math.random() < 0.35) spawnParticles(player.x + (player.wallDir > 0 ? player.w : 0), player.y + 18, '#7b849b', 1, 40, 120);
    }
  }

  // 6. Прыжок и Wall-Jump с деформацией Squash & Stretch
  if (input.jumpBuffer > 0 && !player.knockdown && player.offBalanceTimer <= 0) {
    if (player.coyoteTimer > 0) {
      player.vy = -565;
      player.grounded = false;
      player.coyoteTimer = 0;
      input.jumpBuffer = 0;
      player.squashY = 1.28; // Вытягивание вверх на взлёте!
      sfx.jump();
      spawnParticles(player.x + player.w / 2, player.y + player.h, '#9296a0', 8, 130, 200);
    } else if (player.wallDir !== 0 && !player.grounded) {
      player.vy = -535;
      player.vx = -player.wallDir * 420;
      player.facing = -player.wallDir;
      player.wallDir = 0;
      input.jumpBuffer = 0;
      player.squashY = 1.25;
      sfx.jump();
      spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#c4a46c', 10, 160, 200);
    }
  }

  // 7. Горизонтальная коллизия + АВТО-ЗАХВАТ РУКАМИ ЗА КРАЯ ПЛАТФОРМ (LEDGE GRAB)
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
      }
    }
    // Проверка захвата руками за верхний угол стены или высокой платформы!
    if (!player.grounded && player.vy > -80 && !player.knockdown && p.type !== 'floor') {
      const headY = player.y + 8;
      if (Math.abs(headY - p.y) < 16) {
        // Левый край плиты (смотрим вправо)
        if (player.facing === 1 && input.x > 0 && Math.abs((player.x + player.w) - p.x) < 14) {
          player.ledgeGrab = { x: p.x - player.w + 2, y: p.y - 4, dir: 1 };
          sfx.step();
        }
        // Правый край плиты (смотрим влево)
        else if (player.facing === -1 && input.x < 0 && Math.abs(player.x - (p.x + p.w)) < 14) {
          player.ledgeGrab = { x: p.x + p.w - 2, y: p.y - 4, dir: -1 };
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
      if (player.vy >= 0 && prevBottom <= p.y + 14 && !(input.y > 0.55) &&
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
    if (vyBefore > 220) {
      // Упругий присед в коленях при приземлении!
      player.squashY = Math.max(0.68, 1.0 - (vyBefore / 1600));
      sfx.step();
      spawnParticles(player.x + player.w / 2, surfaceY, '#7b849b', 6, 110, 220);
    }
    if (player.downSmash) {
      player.downSmash = false;
      player.squashY = 0.62;
      cam.shake = 12;
      sfx.hit(true);
      spawnParticles(player.x + player.w / 2, surfaceY, '#e05364', 26, 350);
      WORLD.enemies.forEach(e => {
        if (Math.abs((e.x + e.w / 2) - (player.x + player.w / 2)) < 150 && Math.abs((e.y + e.h) - surfaceY) < 65 &&
            hasLineOfSight(player.x + player.w / 2, player.y + 20, e.x + e.w / 2, e.y + 20)) {
          damageEnemy(e, Math.round(player.dmg * 1.65), Math.sign(e.x - player.x) * 340, true);
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
// 5. ОБНОВЛЕНИЕ МИРА: ЦЕПИ, ЛЮСТРЫ, ЛУТ, ВРАГИ И БОСС
// =====================================================
function updateWorldEntities(dt) {
  const pxCenter = player.x + player.w / 2;
  const pyCenter = player.y + player.h / 2;

  // Физика плаща
  let leadX = pxCenter - player.facing * 5;
  let leadY = player.y + 12;
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

  // 1. Интерактивные висячие цепи (качаются при пробежке игрока!)
  WORLD.chains.forEach(ch => {
    ch.nodes.forEach((n, idx) => {
      if (idx === 0) { n.x = ch.anchorX; n.y = ch.anchorY; return; }
      // Реакция на пробегающего мимо героя
      if (Math.abs(n.x - pxCenter) < 22 && Math.abs(n.y - pyCenter) < 30 && Math.abs(player.vx) > 60) {
        n.vx += player.vx * 0.35;
      }
      const prev = ch.nodes[idx - 1];
      const force = (prev.x - n.x) * 38;
      n.vx = (n.vx + force * dt) * Math.pow(0.08, dt);
      n.x += n.vx * dt;
      n.y = ch.anchorY + idx * 11;
    });
  });

  // 2. Падение перерубленных чугунных люстр на головы врагов!
  WORLD.chandeliers.forEach(c => {
    if (c.state === 'falling') {
      c.vy += GRAVITY * 1.15 * dt;
      c.y += c.vy * dt;
      if (c.y >= WORLD.FLOOR_Y - 12) {
        c.y = WORLD.FLOOR_Y - 12;
        c.state = 'crashed';
        cam.shake = 15;
        sfx.hit(true);
        sfx.thunder();
        spawnParticles(c.x, c.y, '#ffae38', 36, 380);
        spawnParticles(c.x, c.y, '#e63246', 20, 280);
        WORLD.enemies.forEach(e => {
          if (Math.abs((e.x + e.w / 2) - c.x) < 135) {
            damageEnemy(e, 180, Math.sign((e.x + e.w / 2) - c.x) * 420, true, '#ffae38');
            e.state = 'stunned'; e.timer = 2.5;
          }
        });
      }
    }
  });

  // 3. Выпадающие из бочек сферы здоровья и пепла (притягиваются магнитом к рыцарю)
  for (let i = WORLD.lootOrbs.length - 1; i >= 0; i--) {
    const orb = WORLD.lootOrbs[i];
    orb.vy += GRAVITY * 0.8 * dt;
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;
    if (orb.y > WORLD.FLOOR_Y - 8) {
      orb.y = WORLD.FLOOR_Y - 8;
      orb.vy *= -0.45;
      orb.vx *= 0.8;
    }
    const dist = Math.hypot(pxCenter - orb.x, pyCenter - orb.y);
    if (dist < 110) {
      orb.x += (pxCenter - orb.x) * dt * 9;
      orb.y += (pyCenter - orb.y) * dt * 9;
    }
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

  // 4. Наземные ударные волны Босса
  for (let i = WORLD.shockwaves.length - 1; i >= 0; i--) {
    const sw = WORLD.shockwaves[i];
    sw.x += sw.vx * dt;
    sw.life -= dt;
    spawnParticles(sw.x, WORLD.FLOOR_Y - 4, '#ffae38', 1, 60, 200);
    if (Math.abs(sw.x - pxCenter) < 20 && player.y + player.h >= WORLD.FLOOR_Y - 14) {
      hurtPlayer(20, Math.sign(sw.vx) * 320, true);
      sw.life = 0;
    }
    if (sw.life <= 0) WORLD.shockwaves.splice(i, 1);
  }

  // 5. ИИ Врагов и БОССА
  for (let i = WORLD.enemies.length - 1; i >= 0; i--) {
    const e = WORLD.enemies[i];
    if (e.hp <= 0) { WORLD.enemies.splice(i, 1); continue; }
    if (e.flashTimer > 0) e.flashTimer -= dt;
    if (e.atkCooldown > 0) e.atkCooldown -= dt;

    const exCenter = e.x + e.w / 2, eyCenter = e.y + e.h / 2;
    const dx = pxCenter - exCenter, dy = pyCenter - eyCenter;
    const dist = Math.hypot(dx, dy);
    const canSee = hasLineOfSight(exCenter, eyCenter, pxCenter, pyCenter);

    if (e.state === 'stunned' || e.state === 'stagger') {
      e.timer -= dt;
      e.vx *= Math.pow(0.01, dt);
      if (e.timer <= 0) e.state = 'chase';
    } else if (e.state === 'windup') {
      e.vx *= 0.82;
      e.timer -= dt;
      if (e.timer <= 0) {
        e.state = 'strike';
        e.timer = 0.18;
        e.vx = e.facing * (e.type === 'boss' ? 460 : (e.type === 'warden' ? 330 : 390));

        // Босс при ударе пускает огненные волны по полу в обе стороны!
        if (e.type === 'boss') {
          cam.shake = 14;
          sfx.thunder();
          WORLD.shockwaves.push({ x: exCenter, vx: -360, life: 1.1 });
          WORLD.shockwaves.push({ x: exCenter, vx: 360, life: 1.1 });
        }

        const hitRange = e.type === 'boss' ? 92 : (e.type === 'warden' ? 74 : 58);
        if (Math.abs(dx) < hitRange && Math.abs(dy) < 58 && canSee) {
          if (player.parryWindow > 0) {
            sfx.parryClang();
            hitstopTimer = 0.095;
            cam.shake = 13;
            e.state = 'stunned';
            e.timer = e.type === 'boss' ? 1.5 : 2.3;
            e.vx = -e.facing * 260;
            spawnParticles(pxCenter + player.facing * 14, pyCenter, '#6ab0e8', 24, 340);
            addFloatText(exCenter, e.y - 16, 'ПАРИРОВАНИЕ!', '#6ab0e8', true);
            if (player.chainLightning) triggerChainLightning(e, Math.round(player.dmg * 0.85));
            if (navigator.vibrate) navigator.vibrate([30, 20, 50]);
          } else {
            // Если это тяжёлый удар Палача/Босса ИЛИ герой потерял баланс -> сбивает с ног!
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
        const spd = e.type === 'boss' ? 145 : (e.type === 'warden' ? 105 : (e.type === 'wraith' ? 190 : 155));
        if (Math.abs(dx) > (e.type === 'boss' ? 62 : 42)) {
          e.vx += (e.facing * spd - e.vx) * dt * 8;
        } else if (e.atkCooldown <= 0 && Math.abs(dy) < 65 && canSee) {
          e.state = 'windup';
          e.timer = e.type === 'boss' ? 0.58 : (e.type === 'warden' ? 0.52 : 0.40);
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

  // 6. Алтарь и Врата
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

  // 7. Частицы и молнии
  for (let i = WORLD.particles.length - 1; i >= 0; i--) {
    const pt = WORLD.particles[i];
    pt.vy += pt.gravity * dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
    if (pt.life <= 0) WORLD.particles.splice(i, 1);
  }
  for (let i = WORLD.slashArcs.length - 1; i >= 0; i--) {
    WORLD.slashArcs[i].life -= dt;
    if (WORLD.slashArcs[i].life <= 0) WORLD.slashArcs.splice(i, 1);
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

  // 8. Камера
  const scale = H / VIEW_H;
  const viewW = W / scale;
  const targetCamX = Math.max(-60, Math.min(WORLD.roomWidth - viewW + 60, pxCenter + player.facing * 55 - viewW / 2));
  const targetCamY = Math.min(WORLD.FLOOR_Y - VIEW_H + 65, player.y - VIEW_H * 0.56);
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
  sfx.hit(true);
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#d93848', 18, 260);
  addFloatText(player.x + player.w / 2, player.y - 10, `-${dmg}`, '#ff4d5e', true);
  if (navigator.vibrate) navigator.vibrate(110);

  if (player.hp <= 0) {
    player.hp = 100; player.maxHp = 100;
    player.dmg = 26; player.critChance = 0.15;
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
// 6. РЕНДЕР МИРА И 6-СУСТАВНОГО СКЕЛЕТА РЫЦАРЯ
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

  // 2. Физические висячие цепи
  ctx.strokeStyle = '#4a5162';
  ctx.lineWidth = 3;
  WORLD.chains.forEach(ch => {
    ctx.beginPath();
    ch.nodes.forEach((n, idx) => {
      if (idx === 0) ctx.moveTo(n.x, n.y);
      else ctx.lineTo(n.x, n.y);
    });
    ctx.stroke();
  });

  // 3. Подвесные чугунные люстры (ловушки!)
  WORLD.chandeliers.forEach(c => {
    if (c.state === 'hanging') {
      ctx.strokeStyle = '#7b849b';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(c.x, c.anchorY); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
    if (c.state !== 'crashed') {
      ctx.fillStyle = '#25293a';
      ctx.fillRect(c.x - 18, c.y, 36, 10);
      ctx.fillStyle = '#ffae38';
      ctx.fillRect(c.x - 12, c.y - 8, 24, 8);
    }
  });

  // 4. Алтарь и Врата
  if (WORLD.shrine) {
    const sh = WORLD.shrine;
    ctx.fillStyle = '#252836'; ctx.fillRect(sh.x - 22, sh.y - 16, 44, 16);
    ctx.fillStyle = '#383d52'; ctx.fillRect(sh.x - 14, sh.y - 38, 28, 22);
    if (!sh.used) {
      const hoverY = sh.y - 54 + Math.sin(now * 0.005) * 5;
      ctx.fillStyle = 'rgba(196, 164, 108, 0.25)';
      ctx.beginPath(); ctx.arc(sh.x, hoverY, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2d899'; ctx.fillRect(sh.x - 6, hoverY - 6, 12, 12);
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

  // 5. Платформы, бочки и лут
  WORLD.platforms.forEach(p => {
    ctx.fillStyle = p.type === 'plat' ? platPat : stonePat;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = p.type === 'plat' ? '#5c6684' : '#32384d';
    ctx.fillRect(p.x, p.y, p.w, 5);
    ctx.strokeStyle = '#0a0b10'; ctx.lineWidth = 2; ctx.strokeRect(p.x, p.y, p.w, p.h);
  });

  ctx.fillStyle = '#751522';
  WORLD.bloodStains.forEach(b => ctx.fillRect(b.x, b.y - 2, b.w, 4));

  WORLD.barrels.forEach(b => {
    ctx.drawImage(SPRITES.barrel, b.x, b.y, b.w, b.h);
  });

  WORLD.lootOrbs.forEach(orb => {
    ctx.fillStyle = orb.type === 'hp' ? '#68e09c' : '#f2d899';
    ctx.beginPath(); ctx.arc(orb.x, orb.y, 6, 0, Math.PI * 2); ctx.fill();
  });

  // 6. Враги и БОСС
  WORLD.enemies.forEach(e => {
    ctx.save();
    const bob = Math.sin(now * 0.012 + e.animOffset) * 2;
    if (e.state === 'windup') {
      ctx.fillStyle = '#ffbe42'; ctx.font = '900 15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', e.x + e.w / 2, e.y - 12);
    }
    if (e.state === 'stunned') {
      ctx.fillStyle = '#6ab0e8'; ctx.font = '900 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('ОГЛУШЁН', e.x + e.w / 2, e.y - 14);
    }
    const spr = (e.type === 'warden' || e.type === 'boss') ? SPRITES.warden : (e.type === 'wraith' ? SPRITES.wraith : SPRITES.stalker);
    ctx.translate(e.x + e.w / 2, e.y + e.h / 2 + bob);
    ctx.scale(e.facing, 1);
    if (e.flashTimer > 0) ctx.filter = 'brightness(4)';
    ctx.drawImage(spr, -e.w / 2 - 4, -e.h / 2 - 2, e.w + 8, e.h + 4);
    ctx.filter = 'none';

    ctx.fillStyle = e.state === 'windup' ? '#ffbe42' : '#8d96ad';
    if (e.type === 'warden' || e.type === 'boss') {
      const s = e.type === 'boss' ? 1.45 : 1.0;
      ctx.fillRect(10 * s, -18 * s, 4 * s, 36 * s);
      ctx.fillStyle = '#e63246';
      ctx.fillRect(12 * s, -16 * s, 11 * s, 15 * s);
    } else if (e.type === 'stalker') {
      ctx.fillRect(10, -6, 14, 4);
    }
    ctx.restore();

    if (e.hp < e.maxHp || e.type === 'boss') {
      const barW = e.type === 'boss' ? 90 : e.w + 6;
      const bx = e.x + e.w / 2 - barW / 2;
      ctx.fillStyle = '#120d0f'; ctx.fillRect(bx, e.y - 10, barW, 5);
      ctx.fillStyle = e.type === 'boss' ? '#ffae38' : '#e63246';
      ctx.fillRect(bx + 1, e.y - 9, (barW - 2) * (e.hp / e.maxHp), 3);
    }
  });

  // 7. ОТРИСОВКА ПРОЦЕДУРНОГО 6-СУСТАВНОГО СКЕЛЕТА ПЕПЕЛЬНОГО РЫЦАРЯ!
  ctx.strokeStyle = '#9e1e2e';
  ctx.lineWidth = 6;
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
  // Пружина Squash & Stretch от стоп
  ctx.scale(player.facing * (2 - player.squashY), player.squashY);

  // Боевой кувырок 360 градусов ИЛИ падение на спину при Knockdown
  if (player.dashTimer > 0) {
    ctx.translate(0, -22);
    ctx.rotate(player.rollAngle);
    ctx.translate(0, 22);
  } else if (player.knockdown) {
    ctx.rotate(-1.35);
  }

  // А) ПРОЦЕДУРНЫЕ ШАГАЮЩИЕ НОГИ (IK Foot Placement)
  let leftFootX = -5, leftFootY = -8;
  let rightFootX = 3, rightFootY = -8;

  if (player.ledgeGrab) {
    leftFootX = -6; leftFootY = -6;
    rightFootX = -2; rightFootY = -2;
  } else if (!player.grounded) {
    // В прыжке колени поджаты
    leftFootX = -7; leftFootY = -12;
    rightFootX = 4; rightFootY = -10;
  } else if (player.skidTimer > 0) {
    // В тормозном заносе одна нога жёстко выставлена вперёд!
    leftFootX = -8; leftFootY = -8;
    rightFootX = 11; rightFootY = -8;
  } else if (player.offBalanceTimer > 0) {
    // Потеря баланса — рыцарь падает на переднее колено!
    leftFootX = -10; leftFootY = -8;
    rightFootX = 9; rightFootY = -5;
  } else if (Math.abs(player.vx) > 25) {
    const s1 = Math.sin(player.stepPhase);
    const s2 = Math.sin(player.stepPhase + Math.PI);
    leftFootX = -2 + s1 * 9;
    leftFootY = -8 - Math.max(0, Math.cos(player.stepPhase)) * 6;
    rightFootX = -2 + s2 * 9;
    rightFootY = -8 - Math.max(0, Math.cos(player.stepPhase + Math.PI)) * 6;
  }

  ctx.drawImage(SPRITES.foot, leftFootX - 5, leftFootY - 2, 12, 10);
  ctx.drawImage(SPRITES.foot, rightFootX - 5, rightFootY - 2, 12, 10);

  // Б) ТОРС И ГОЛОВА С ФИЗИЧЕСКИМ НАКЛОНОМ (TORSO LEAN)
  ctx.save();
  const hipY = player.offBalanceTimer > 0 ? -15 : -20;
  const runBob = (player.grounded && Math.abs(player.vx) > 25) ? Math.abs(Math.cos(player.stepPhase)) * 2.5 : 0;
  ctx.translate(0, hipY - runBob);
  ctx.rotate(player.torsoLean * player.facing);

  // Задняя рука (при захвате за уступ тянется вверх к камню!)
  if (player.ledgeGrab) {
    ctx.drawImage(SPRITES.hand, 6, -24, 9, 9);
  } else {
    ctx.drawImage(SPRITES.hand, -9, -6, 9, 9);
  }

  // Латная кираса
  ctx.drawImage(SPRITES.torso, -10, -14, 20, 22);

  // Шлем с горящим визором
  ctx.save();
  ctx.translate(0, -15);
  ctx.rotate(player.torsoLean * player.facing * 0.35);
  ctx.drawImage(SPRITES.head, -10, -14, 20, 18);
  ctx.restore();

  // В) ПЕРЕДНЯЯ РУКА И ТЯЖЁЛОЕ ОРУЖИЕ С ФИЗИКОЙ ЗАМАХА И ПЕРЕВЕСА
  ctx.save();
  let weaponAngle = -0.45;
  if (player.ledgeGrab) {
    weaponAngle = -1.3;
  } else if (player.offBalanceTimer > 0) {
    // Клинок воткнут/упёрт в землю от перевеса!
    weaponAngle = 1.25;
  } else if (player.atkTimer > 0) {
    const p = 1 - (player.atkTimer / player.atkDuration);
    weaponAngle = player.comboStep === 2 ? (1.1 - p * 2.2) : (-1.2 + p * 2.4);
  }
  ctx.translate(6, -4);
  ctx.rotate(weaponAngle);

  // Рукоять и лезвие в зависимости от класса оружия
  ctx.fillStyle = '#c4a46c';
  ctx.fillRect(-4, -2, 8, 4);
  if (player.weaponType === 'hammer') {
    // Молот Титана
    ctx.fillStyle = '#5c3c24';
    ctx.fillRect(2, -2, 26, 4);
    ctx.fillStyle = player.swordColor;
    ctx.fillRect(22, -11, 12, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(24, -9, 4, 18);
  } else if (player.weaponType === 'daggers') {
    // Парные клинки Ворона
    ctx.fillStyle = player.swordColor;
    ctx.fillRect(4, -2, 18, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, -1, 16, 2);
  } else {
    // Двуручный Клеймор
    ctx.fillRect(2, -7, 3, 14);
    const bladeLen = 27 + player.rangeBonus * 0.35;
    ctx.fillStyle = player.swordColor;
    ctx.fillRect(5, -3, bladeLen, 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(5, -2, bladeLen - 2, 2);
  }
  // Латная перчатка поверх рукояти
  ctx.drawImage(SPRITES.hand, -4, -4, 9, 9);
  ctx.restore();

  ctx.restore(); // конец торса
  ctx.restore(); // конец рыцаря

  // 8. Щит, дуги рассечения и молнии
  if (player.parryWindow > 0) {
    ctx.strokeStyle = '#6ab0e8'; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, player.y + player.h / 2, 32, -Math.PI * 0.45, Math.PI * 0.45, player.facing < 0);
    ctx.stroke();
  }

  WORLD.slashArcs.forEach(s => {
    ctx.save();
    ctx.translate(s.x, s.y); ctx.scale(s.dir, 1);
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = s.life / s.maxLife;
    ctx.lineWidth = s.step === 3 ? 16 : 9;
    ctx.beginPath();
    if (s.step === 2) ctx.arc(0, 0, s.radius * 0.78, Math.PI * 0.65, -Math.PI * 0.55, true);
    else ctx.arc(0, 0, s.radius * 0.78, -Math.PI * 0.55, Math.PI * 0.55, false);
    ctx.stroke();
    ctx.restore();
  });

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
    ctx.font = ft.big ? '900 16px sans-serif' : '800 12px sans-serif';
    ctx.fillStyle = '#0a0b10'; ctx.textAlign = 'center';
    ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  });

  ctx.restore();
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
