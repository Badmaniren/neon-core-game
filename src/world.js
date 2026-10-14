// src/world.js — Звук, генерация мира, физические цепи, люстры, бочки, лут и Боссы

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
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime((step === 3 ? 160 : (step === 2 ? 310 : 240)) * pitchMod, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.13);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.14);
  }
  hit(isCrit = false) {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = isCrit ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(isCrit ? 150 : 110, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.16);
    gain.gain.setValueAtTime(isCrit ? 0.32 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.17);
  }
  woodBreak() {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(190, now);
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
    osc.frequency.setValueAtTime(1200 + Math.random() * 400, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);
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
    osc.frequency.setValueAtTime(95 + Math.random() * 25, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.04);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(now); osc.stop(now + 0.045);
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

// БАЗА РЕЛИКВИЙ И КЛАССОВ ОРУЖИЯ
window.RELIC_POOL = [
  { id: 'daggers', name: '⚔️ Клинки Ворона', desc: 'ОРУЖИЕ: Сверхбыстрые удары, 0 потери баланса при промахе, +15% крит.', apply: (p) => { p.weaponType = 'daggers'; p.atkSpeedMult *= 0.65; p.critChance += 0.15; p.swordColor = '#a8e6ff'; } },
  { id: 'hammer', name: '🔨 Молот Титана', desc: 'ОРУЖИЕ: Урон +55%, пробивает броню и оглушает, но тяжёлый вес (следи за балансом!).', apply: (p) => { p.weaponType = 'hammer'; p.dmg = Math.round(p.dmg * 1.55); p.rangeBonus += 20; p.atkSpeedMult *= 1.2; p.swordColor = '#ff9d2e'; } },
  { id: 'shock', name: '⚡ Грозовой пепел', desc: 'Финальный удар комбо и Парирование бьют ветвящейся Цепной Молнией.', apply: (p) => { p.chainLightning = true; p.swordColor = '#00f3ff'; } },
  { id: 'vamp', name: '🩸 Окровавленный клык', desc: 'Багровое лезвие: исцеляет +7 HP за каждого убитого врага.', apply: (p) => { p.vampOnKill += 7; p.swordColor = '#ff2a4b'; } },
  { id: 'crit', name: '✨ Обсидиановая грань', desc: '+25% к шансу критического удара (x1.85 урона).', apply: (p) => { p.critChance += 0.25; p.swordColor = '#ffbe42'; } },
  { id: 'poise', name: '🛡️ Корни Скалы', desc: 'Стальная стойка: ты больше НЕ теряешь равновесие при промахе тяжёлым ударом +30 Max HP.', apply: (p) => { p.noOverswing = true; p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); } },
  { id: 'swift', name: '💨 Ртутная поступь', desc: 'Скорость бега +22%, перезарядка рывка быстрее на 30%.', apply: (p) => { p.moveSpeed *= 1.22; p.dashCdMax *= 0.7; } }
];

// ГЛОБАЛЬНОЕ СОСТОЯНИЕ МИРА
window.WORLD = {
  FLOOR_Y: 430,
  roomIndex: 1,
  roomWidth: 2200,
  platforms: [],
  enemies: [],
  particles: [],
  bloodStains: [],
  lightningBolts: [],
  torches: [],
  slashArcs: [],
  floatTexts: [],
  chains: [],       // Физические свисающие цепи (Verlet)
  chandeliers: [],  // Подвесные огненные люстры, которые можно обрушить на врагов
  barrels: [],      // Разрушаемые бочки с лутом
  lootOrbs: [],     // Выпадающие сферы HP и Пепла
  shockwaves: [],   // Наземные волны от ударов Босса
  shrine: null,
  portal: null,
  bgPillars: []
};

window.spawnParticles = function(x, y, color, count = 12, speed = 220, gravity = 520) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = (0.3 + Math.random() * 0.85) * speed;
    WORLD.particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 65,
      size: 3 + Math.floor(Math.random() * 4),
      color, gravity,
      life: 0.32 + Math.random() * 0.35,
      maxLife: 0.67
    });
  }
};

window.addFloatText = function(x, y, text, color = '#f5efe6', big = false) {
  WORLD.floatTexts.push({ x, y, text, color, big, vy: -85, life: 0.85 });
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

// Создание физической цепи под потолком
function createHangingChain(anchorX, anchorY, links = 9) {
  const nodes = [];
  for (let i = 0; i < links; i++) {
    nodes.push({ x: anchorX, y: anchorY + i * 11, vx: 0 });
  }
  WORLD.chains.push({ anchorX, anchorY, nodes });
}

// Генератор зала (Обычный зал ИЛИ Арена с Боссом каждые 3 этажа)
window.generateRoom = function(num, player) {
  const W = WORLD;
  W.roomIndex = num;
  W.platforms = [];
  W.enemies = [];
  W.particles = [];
  W.bloodStains = [];
  W.lightningBolts = [];
  W.slashArcs = [];
  W.bgPillars = [];
  W.torches = [];
  W.chains = [];
  W.chandeliers = [];
  W.barrels = [];
  W.lootOrbs = [];
  W.shockwaves = [];

  const isBossRoom = (num % 3 === 0);
  W.roomWidth = isBossRoom ? 1250 : (1900 + num * 170);
  const fy = W.FLOOR_Y;

  // Пол и боковые стены
  W.platforms.push({ x: -160, y: fy, w: W.roomWidth + 320, h: 240, type: 'floor' });
  W.platforms.push({ x: -128, y: -420, w: 128, h: 1050, type: 'wall' });
  W.platforms.push({ x: W.roomWidth, y: -420, w: 128, h: 1050, type: 'wall' });

  for (let x = 140; x < W.roomWidth - 100; x += 220) {
    W.bgPillars.push({ x, w: 56, h: 520 });
    W.torches.push({ x: x + 28, y: fy - 140, flicker: Math.random() * 10 });
    createHangingChain(x + 95, 20, 8 + (x % 5));
  }

  if (isBossRoom) {
    // АРЕНА БОССА (Уступы по бокам для уворота и две подвесные люстры!)
    W.platforms.push({ x: 180, y: fy - 115, w: 192, h: 22, type: 'plat' });
    W.platforms.push({ x: W.roomWidth - 372, y: fy - 115, w: 192, h: 22, type: 'plat' });
    W.chandeliers.push({ x: 460, y: fy - 240, anchorY: 10, vy: 0, state: 'hanging' });
    W.chandeliers.push({ x: W.roomWidth - 460, y: fy - 240, anchorY: 10, vy: 0, state: 'hanging' });
    W.barrels.push({ x: 240, y: fy - 28, w: 24, h: 28, hp: 1 });
    W.barrels.push({ x: W.roomWidth - 260, y: fy - 28, w: 24, h: 28, hp: 1 });

    // Спавн БОССА — ПОВЕЛИТЕЛЬ ПЕПЛА
    const bossHp = 420 + num * 140;
    W.enemies.push({
      type: 'boss',
      name: 'ИНКВИЗИТОР ПЕПЛА',
      x: W.roomWidth - 280, y: fy - 76, w: 52, h: 74,
      vx: 0, vy: 0,
      hp: bossHp, maxHp: bossHp,
      dmg: 28 + num * 4,
      facing: -1,
      state: 'chase',
      timer: 0,
      atkCooldown: 1.0,
      flashTimer: 0,
      animOffset: 0
    });
  } else {
    // ОБЫЧНЫЙ ЗАЛ С ПАРКУРОМ, УСТУПАМИ ДЛЯ LEDGE-GRAB И ЛОВУШКАМИ
    let cursorX = 300;
    while (cursorX < W.roomWidth - 400) {
      const pat = Math.floor(Math.random() * 3);
      if (pat === 0) {
        W.platforms.push({ x: cursorX, y: fy - 112, w: 192, h: 22, type: 'plat' });
        W.platforms.push({ x: cursorX + 96, y: fy - 220, w: 160, h: 22, type: 'plat' });
        // Подвесная люстра над врагами!
        W.chandeliers.push({ x: cursorX + 95, y: fy - 265, anchorY: 10, vy: 0, state: 'hanging' });
        spawnEnemyAt(cursorX + 80, fy - 112, num);
        W.barrels.push({ x: cursorX + 20, y: fy - 28, w: 24, h: 28, hp: 1 });
        cursorX += 340;
      } else if (pat === 1) {
        // Высокая колонна для Wall-Jump и Ledge-Grab (хвата руками за край!)
        W.platforms.push({ x: cursorX + 32, y: fy - 210, w: 48, h: 210, type: 'wall' });
        W.platforms.push({ x: cursorX + 144, y: fy - 185, w: 176, h: 22, type: 'plat' });
        spawnEnemyAt(cursorX + 200, fy - 185, num);
        W.barrels.push({ x: cursorX + 170, y: fy - 185 - 28, w: 24, h: 28, hp: 1 });
        cursorX += 380;
      } else {
        W.platforms.push({ x: cursorX, y: fy - 130, w: 256, h: 22, type: 'plat' });
        W.chandeliers.push({ x: cursorX + 128, y: fy - 255, anchorY: 10, vy: 0, state: 'hanging' });
        spawnEnemyAt(cursorX + 110, fy - 130, num);
        spawnEnemyAt(cursorX + 160, fy, num);
        W.barrels.push({ x: cursorX + 40, y: fy - 130 - 28, w: 24, h: 28, hp: 1 });
        cursorX += 360;
      }
      if (Math.random() < 0.85) spawnEnemyAt(cursorX - 110, fy, num);
    }
  }

  W.shrine = { x: Math.floor(W.roomWidth * 0.48), y: fy, used: false };
  W.portal = { x: W.roomWidth - 120, y: fy };

  if (player) {
    player.x = 110;
    player.y = fy - player.h - 4;
    player.vx = 0; player.vy = 0;
    player.grounded = true;
    player.downSmash = false;
    player.ledgeGrab = null;
    player.offBalanceTimer = 0;
    player.knockdown = false;
    if (window.resetScarf) window.resetScarf();
  }
};

function spawnEnemyAt(x, groundY, level) {
  const types = ['stalker', 'warden', 'wraith'];
  const type = types[Math.floor(Math.random() * types.length)];
  const isWarden = type === 'warden';
  const isWraith = type === 'wraith';

  const w = isWarden ? 36 : 30;
  const h = isWarden ? 52 : (isWraith ? 42 : 44);
  const maxHp = Math.round((isWarden ? 110 : (isWraith ? 60 : 72)) * (1 + (level - 1) * 0.25));

  WORLD.enemies.push({
    type,
    x, y: groundY - h - 2, w, h,
    vx: 0, vy: 0,
    hp: maxHp, maxHp,
    dmg: Math.round((isWarden ? 24 : 15) * (1 + (level - 1) * 0.18)),
    facing: -1,
    state: 'chase',
    timer: 0,
    atkCooldown: 0.4,
    flashTimer: 0,
    animOffset: Math.random() * 10
  });
}
