// src/world.js — Звук, генератор мира (без перекрытия Алтаря!), расчленёнка, выбитое оружие и цепи

class AudioEngine {
  constructor() { this.ctx = null; }
  init() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  slash(step = 1, pitchMod = 1) {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime((step === 3 ? 140 : (step === 2 ? 260 : 210)) * pitchMod, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.15);
  }
  goreHit(isHeavy = false) {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = isHeavy ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(isHeavy ? 95 : 145, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.18);
    gain.gain.setValueAtTime(isHeavy ? 0.36 : 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.19);
  }
  boneSnap() {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.09);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.1);
  }
  woodBreak() {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.13);
  }
  chainClink() {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1350 + Math.random() * 350, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.06);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.07);
  }
  thunder() {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.22);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.23);
  }
  parryClang() {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(1560, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.3);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.32);
  }
  jump() {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.09);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.1);
  }
  step() {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90 + Math.random() * 25, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.045);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.05);
  }
  dash() {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.13);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.14);
  }
}
window.sfx = new AudioEngine();

window.RELIC_POOL = [
  { id: 'daggers', name: '⚔️ Клинки Ворона', desc: 'ПАРНЫЕ КИНЖАЛЫ: Сверхбыстрые порезы двумя руками, вскрывают живот (кишки и кровотечение), 0 потери баланса.', apply: (p) => { p.weaponType = 'daggers'; p.atkSpeedMult *= 0.62; p.critChance += 0.15; p.swordColor = '#a8e6ff'; } },
  { id: 'hammer', name: '🔨 Молот Титана', desc: 'ДВУРУЧНЫЙ МОЛОТ: Дробит кости ног (враги ползают без ног!), выбивает оружие из рук и швыряет тела через зал.', apply: (p) => { p.weaponType = 'hammer'; p.dmg = Math.round(p.dmg * 1.5); p.rangeBonus += 22; p.atkSpeedMult *= 1.18; p.swordColor = '#ff9d2e'; } },
  { id: 'cleaver', name: '🗡️ Палаческий Клеймор', desc: 'МЕЧ ПАЛАЧА: Разрубает врагов ПОПОЛАМ при добивании и отсекает головы. Длина лезвия +18px.', apply: (p) => { p.weaponType = 'greatsword'; p.dmg = Math.round(p.dmg * 1.3); p.rangeBonus += 18; p.swordColor = '#f5efe6'; } },
  { id: 'shock', name: '⚡ Грозовой пепел', desc: 'Каждый 3-й удар и Парирование бьют ветвящейся Цепной Молнией.', apply: (p) => { p.chainLightning = true; p.swordColor = '#00f3ff'; } },
  { id: 'vamp', name: '🩸 Окровавленный клык', desc: 'Вампиризм: +8 HP за каждого расчленённого или убитого врага.', apply: (p) => { p.vampOnKill += 8; p.swordColor = '#ff2a4b'; } },
  { id: 'poise', name: '🛡️ Корни Скалы', desc: 'Железный баланс: ты не спотыкаешься при промахе тяжёлым оружием +35 Max HP.', apply: (p) => { p.noOverswing = true; p.maxHp += 35; p.hp = Math.min(p.maxHp, p.hp + 35); } }
];

window.WORLD = {
  FLOOR_Y: 435,
  roomIndex: 1,
  roomWidth: 2200,
  platforms: [],
  enemies: [],
  corpses: [],        // Отрубленные половины тел, головы и конечности с физикой!
  droppedWeapons: [], // Выбитое из рук врагов оружие, за которым они ползут!
  particles: [],
  bloodStains: [],
  lightningBolts: [],
  torches: [],
  floatTexts: [],
  chains: [],
  chandeliers: [],
  barrels: [],
  lootOrbs: [],
  shockwaves: [],
  shrine: null,
  portal: null,
  bgPillars: []
};

window.spawnParticles = function(x, y, color, count = 12, speed = 220, gravity = 540) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = (0.3 + Math.random() * 0.85) * speed;
    WORLD.particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 65,
      size: 3 + Math.floor(Math.random() * 4),
      color, gravity,
      life: 0.35 + Math.random() * 0.4,
      maxLife: 0.75
    });
  }
};

window.addFloatText = function(x, y, text, color = '#f5efe6', big = false) {
  WORLD.floatTexts.push({ x, y, text, color, big, vy: -80, life: 0.9 });
};

window.spawnLightningBolt = function(x1, y1, x2, y2) {
  const segments = 7;
  const points = [{ x: x1, y: y1 }];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    points.push({
      x: x1 + (x2 - x1) * t + (Math.random() - 0.5) * 30,
      y: y1 + (y2 - y1) * t + (Math.random() - 0.5) * 30
    });
  }
  points.push({ x: x2, y: y2 });
  WORLD.lightningBolts.push({ points, life: 0.24, maxLife: 0.24 });
  sfx.thunder();
};

window.hasLineOfSight = function(x1, y1, x2, y2) {
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  for (const p of WORLD.platforms) {
    if (p.type === 'wall') {
      if (maxX > p.x && minX < p.x + p.w && maxY > p.y + 4 && minY < p.y + p.h - 4) return false;
    }
  }
  return true;
};

function createHangingChain(anchorX, anchorY, links = 9) {
  const nodes = [];
  for (let i = 0; i < links; i++) {
    nodes.push({ x: anchorX, y: anchorY + i * 12, vx: 0 });
  }
  WORLD.chains.push({ anchorX, anchorY, nodes });
}

window.generateRoom = function(num, player) {
  const W = WORLD;
  W.roomIndex = num;
  W.platforms = [];
  W.enemies = [];
  W.corpses = [];
  W.droppedWeapons = [];
  W.particles = [];
  W.bloodStains = [];
  W.lightningBolts = [];
  W.bgPillars = [];
  W.torches = [];
  W.chains = [];
  W.chandeliers = [];
  W.barrels = [];
  W.lootOrbs = [];
  W.shockwaves = [];

  const isBossRoom = (num % 3 === 0);
  W.roomWidth = isBossRoom ? 1300 : (1950 + num * 180);
  const fy = W.FLOOR_Y;

  // Заранее резервируем чистую зону под Алтарь Предков в центре зала!
  const shrineX = Math.floor(W.roomWidth * 0.5);
  W.shrine = { x: shrineX, y: fy, used: false };
  W.portal = { x: W.roomWidth - 130, y: fy };

  // Пол и боковые стены
  W.platforms.push({ x: -160, y: fy, w: W.roomWidth + 320, h: 240, type: 'floor' });
  W.platforms.push({ x: -128, y: -420, w: 128, h: 1050, type: 'wall' });
  W.platforms.push({ x: W.roomWidth, y: -420, w: 128, h: 1050, type: 'wall' });

  for (let x = 140; x < W.roomWidth - 120; x += 230) {
    W.bgPillars.push({ x, w: 58, h: 520 });
    W.torches.push({ x: x + 29, y: fy - 145, flicker: Math.random() * 10 });
    createHangingChain(x + 105, 10, 8 + (x % 4));
  }

  if (isBossRoom) {
    W.platforms.push({ x: 180, y: fy - 120, w: 192, h: 22, type: 'plat' });
    W.platforms.push({ x: W.roomWidth - 372, y: fy - 120, w: 192, h: 22, type: 'plat' });
    W.chandeliers.push({ x: 450, y: fy - 245, anchorY: 10, vy: 0, state: 'hanging' });
    W.chandeliers.push({ x: W.roomWidth - 450, y: fy - 245, anchorY: 10, vy: 0, state: 'hanging' });
    W.barrels.push({ x: 240, y: fy - 32, w: 26, h: 32, hp: 1 });
    W.barrels.push({ x: W.roomWidth - 260, y: fy - 32, w: 26, h: 32, hp: 1 });

    const bossHp = 450 + num * 140;
    W.enemies.push(createEnemyObj('boss', W.roomWidth - 280, fy, num, bossHp));
  } else {
    let cursorX = 300;
    while (cursorX < W.roomWidth - 380) {
      // ГАРАНТИЯ ЧИСТОГО АЛТАРЯ: если секция попадает на зону Алтаря (shrineX ± 130), пропускаем стены!
      if (Math.abs(cursorX + 100 - shrineX) < 150) {
        W.platforms.push({ x: shrineX - 96, y: fy - 145, w: 192, h: 22, type: 'plat' });
        cursorX = shrineX + 150;
        continue;
      }

      const pat = Math.floor(Math.random() * 3);
      if (pat === 0) {
        W.platforms.push({ x: cursorX, y: fy - 115, w: 192, h: 22, type: 'plat' });
        W.platforms.push({ x: cursorX + 96, y: fy - 225, w: 160, h: 22, type: 'plat' });
        W.chandeliers.push({ x: cursorX + 95, y: fy - 270, anchorY: 10, vy: 0, state: 'hanging' });
        W.enemies.push(createEnemyObj( randomType(), cursorX + 80, fy - 115, num ));
        W.barrels.push({ x: cursorX + 20, y: fy - 32, w: 26, h: 32, hp: 1 });
        cursorX += 350;
      } else if (pat === 1) {
        // Колонна для Wall-Jump, Сальто от стены и Ledge-Grab!
        W.platforms.push({ x: cursorX + 32, y: fy - 200, w: 48, h: 200, type: 'wall' });
        W.platforms.push({ x: cursorX + 144, y: fy - 180, w: 176, h: 22, type: 'plat' });
        W.enemies.push(createEnemyObj( randomType(), cursorX + 205, fy - 180, num ));
        W.barrels.push({ x: cursorX + 165, y: fy - 180 - 32, w: 26, h: 32, hp: 1 });
        cursorX += 380;
      } else {
        W.platforms.push({ x: cursorX, y: fy - 130, w: 256, h: 22, type: 'plat' });
        W.chandeliers.push({ x: cursorX + 128, y: fy - 265, anchorY: 10, vy: 0, state: 'hanging' });
        W.enemies.push(createEnemyObj( randomType(), cursorX + 110, fy - 130, num ));
        W.enemies.push(createEnemyObj( randomType(), cursorX + 160, fy, num ));
        cursorX += 360;
      }
      if (Math.random() < 0.85) W.enemies.push(createEnemyObj( randomType(), cursorX - 110, fy, num ));
    }
  }

  if (player) {
    player.x = 110;
    player.y = fy - player.h - 4;
    player.vx = 0; player.vy = 0;
    player.grounded = true;
    player.downSmash = false;
    player.ledgeGrab = null;
    player.offBalanceTimer = 0;
    player.knockdown = false;
    player.flipAngle = 0;
    if (window.resetScarf) window.resetScarf();
  }
};

function randomType() {
  const r = Math.random();
  return r < 0.45 ? 'stalker' : (r < 0.8 ? 'warden' : 'wraith');
}

function createEnemyObj(type, x, groundY, level, customHp = null) {
  const isBoss = type === 'boss';
  const isWarden = type === 'warden' || isBoss;
  const isWraith = type === 'wraith';

  const w = isBoss ? 56 : (isWarden ? 40 : 32);
  const h = isBoss ? 82 : (isWarden ? 62 : 54);
  const maxHp = customHp || Math.round((isWarden ? 115 : (isWraith ? 65 : 75)) * (1 + (level - 1) * 0.25));

  return {
    type,
    x, y: groundY - h - 2, w, h,
    vx: 0, vy: 0,
    hp: maxHp, maxHp,
    dmg: Math.round((isBoss ? 32 : (isWarden ? 24 : 15)) * (1 + (level - 1) * 0.18)),
    facing: -1,
    state: 'chase',
    timer: 0,
    atkCooldown: 0.4,
    atkDuration: 0.35,
    flashTimer: 0,
    stepPhase: Math.random() * 6,
    // АНАТОМИЧЕСКИЕ СОСТОЯНИЯ И РАНЫ ВРАГА:
    wounds: [],        // Массив ран на теле [{ rx, ry, type: 'cut'|'gut'|'crush' }]
    gutsSpilled: false,// Вспорот живот — свисают физические петли кишок!
    gutNodes: [],      // Точки верёвки кишок
    legBroken: false,  // Перебита нога молотом -> ползёт по полу!
    disarmed: false,   // Оружие выбито из рук -> пытается добежать/доползти до меча!
    bleedTimer: 0
  };
}
