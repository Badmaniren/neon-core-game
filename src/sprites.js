// src/sprites.js — Пиксельные сегменты для 14-суставного скелета, органов, оружия и мира

const PALETTE = {
  '.': null,
  'k': '#08090d', // глубокий контур
  's': '#3d4352', // тёмная сталь
  'm': '#6c758c', // средняя сталь
  'l': '#aeb8d1', // светлая сталь
  'w': '#ffffff', // яркий блик
  'c': '#00f3ff', // визор
  'b': '#3b688c', // призрак
  'r': '#8f1928', // багровая ткань / венозная кровь
  'R': '#e03448', // алая кровь / плоть
  'p': '#d46a7e', // кишки / внутренности
  'g': '#c4a46c', // старое золото / кость
  'G': '#ede0c8', // светлая кость / череп
  'd': '#1f222b', // поддоспешник / кожа
  'e': '#382633', // броня палача
  'o': '#ffae38', // огонь
  'u': '#5c3c24', // тёмное дерево
  'U': '#825836'  // светлое дерево
};

function compileSprite(grid) {
  const h = grid.length, w = grid[0].length;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const octx = off.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const col = PALETTE[grid[y][x]];
      if (col) { octx.fillStyle = col; octx.fillRect(x, y, 1, 1); }
    }
  }
  return off;
}

window.SPRITES = {
  // --- СЕГМЕНТЫ РЫЦАРЯ (КРУПНАЯ ДЕТАЛИЗАЦИЯ) ---
  knightHead: compileSprite([
    "..kk......kk..",
    ".ksskkkkkkssk.",
    ".ksmllllllmsk.",
    ".ksmmmmmmmmssk",
    ".ksmmmccccwmsk",
    ".ksmsssssssmsk",
    "..ksmGGGGgmsk.",
    "...kkkkkkkkk.."
  ]),
  knightChest: compileSprite([
    "..krrrrrrrrk..",
    ".krrlmmmmmlrk.",
    "krrsmllllllmsr",
    "kr.ksmmmmmmsk.",
    "...ksmggggmsk.",
    "...ksmddddmsk.",
    "....kkkkkkkk.."
  ]),
  knightPelvis: compileSprite([
    ".kggggggggk.",
    ".kdrkddkrdk.",
    "..kk....kk.."
  ]),
  knightUpperArm: compileSprite([
    ".kssk.",
    "ksmlsk",
    "ksmmsk",
    "kddddk",
    ".kkkk."
  ]),
  knightForearm: compileSprite([
    ".ksmk.",
    "ksmlsk",
    "ksmggk",
    ".kkkk."
  ]),
  knightHand: compileSprite([
    ".kggk.",
    "ksmlsk",
    ".kkkk."
  ]),
  knightThigh: compileSprite([
    ".kddk.",
    "kdssdk",
    "ksmmsk",
    "kddddk",
    ".kkkk."
  ]),
  knightShin: compileSprite([
    ".ksmk.",
    "ksmlsk",
    "ksmlsk",
    "ksmggk",
    ".kkkk."
  ]),
  knightFoot: compileSprite([
    ".ksmkk..",
    "ksmllsk.",
    "kkkkkkk."
  ]),

  // --- СЕГМЕНТЫ ВРАГОВ (ДЛЯ РАСЧЛЕНЁНКИ И СУСТАВОВ) ---
  skullHead: compileSprite([
    "..kkkkkkk..",
    ".kGGGGGGGk.",
    "kGGGGGGGGGk",
    "kGGkkGooGGk",
    "kGGGGGGGGk.",
    ".kkGkkkGkk.",
    "..kkkkkkk.."
  ]),
  boneRibs: compileSprite([
    ".kkkGGGGkkk.",
    "kGGGkGGkGGGk",
    "kG.kGGGGk.Gk",
    "...kGkkGk...",
    "...kGGGGk...",
    "....kkkk...."
  ]),
  wardenHead: compileSprite([
    ".kk........kk.",
    "kggk.kkkk.kggk",
    ".kggkeeeekggk.",
    "..kkeeeeeekk..",
    "..keeekRoRek..",
    "..keeeeeeeek..",
    "...kkkkkkkk..."
  ]),
  wardenChest: compileSprite([
    ".kkrrrrrrrrkk.",
    "krreeeeeeeeerk",
    "kreemmmeeemmer",
    ".keeeeeeeeeek.",
    ".keepggggpeek.",
    "..krrrrrrrrk..",
    "...kkkkkkkk..."
  ]),
  barrel: compileSprite([
    "..kkkkkkkk..",
    ".kuUUUUUUuk.",
    "kssssssssssk",
    "kuUukUukuUuk",
    "kuUukUukuUuk",
    "kuUukUukuUuk",
    "kssssssssssk",
    ".kuUUUUUUuk.",
    "..kkkkkkkk.."
  ])
};

function createStoneTile(isPlat) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = isPlat ? '#2a2e3d' : '#151720';
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#090a0f';
  g.fillRect(0, 15, 32, 2);
  g.fillRect(15, 0, 2, 16);
  g.fillRect(7, 16, 2, 16);
  g.fillStyle = isPlat ? '#464d66' : '#25293a';
  g.fillRect(2, 2, 11, 2);
  g.fillRect(18, 2, 11, 2);
  g.fillRect(10, 18, 18, 2);
  return c;
}
window.STONE_TILE = createStoneTile(false);
window.PLAT_TILE = createStoneTile(true);
