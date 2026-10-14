// src/sprites.js — Пиксельные части скелета, оружие, враги и объекты

const PALETTE = {
  '.': null,
  'k': '#0a0b10', // контур
  's': '#4a5162', // тёмная сталь
  'm': '#7b849b', // средняя сталь
  'l': '#bcc6de', // светлая сталь
  'w': '#ffffff', // блик
  'c': '#00f3ff', // визор / молния
  'b': '#3b688c', // призрак
  'r': '#9e1e2e', // багровая ткань
  'R': '#e6394e', // алый
  'g': '#c4a46c', // золото / кость
  'G': '#f2d899', // светлая кость
  'd': '#232630', // поддоспешник
  'p': '#392836', // тёмная броня
  'o': '#ffae38', // огонь
  'u': '#5c3c24', // дерево бочки
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

// 1. ЧАСТИ ТЕЛА РЫЦАРЯ ДЛЯ АКТИВНОГО СКЕЛЕТА (RIG)
window.SPRITES = {
  // Рогатый рыцарский шлем (10x9)
  head: compileSprite([
    ".kk....kk.",
    ".kskkkksk.",
    ".ksmlllmsk",
    ".ksmmmccwk",
    ".ksmssssmk",
    "..kkkkkkk."
  ]),
  // Латный торс с наплечником и поясом (10x11)
  torso: compileSprite([
    ".krrrrrrk.",
    "krrlmmmlrk",
    "krsmlllmsr",
    ".ksmgggmsk",
    ".ksmdddmsk",
    ".kgggggggk",
    "..kdddddk."
  ]),
  // Латный сапог / стопа (6x5)
  foot: compileSprite([
    ".ksmk.",
    "kkllkk",
    "kkkkkk"
  ]),
  // Латная рука / перчатка (5x5)
  hand: compileSprite([
    ".ksk.",
    "ksmlk",
    ".kkk."
  ]),
  // Деревянная разрушаемая бочка (12x14)
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
  ]),
  // Враги
  stalker: compileSprite([
    "....kkkkkkk....",
    "...kGGGGGGGk...",
    "..kGGGGGGGGGk..",
    "..kGGkkGooGGk..",
    "..kGGGGGGGGk...",
    "...kkGkkkGkk...",
    "..kkkGGGGkkk...",
    ".kGGGkGGkGGGk..",
    ".kG.kGGGGk.Gk..",
    "....kGGGGk.....",
    "...kGGkkGGk....",
    "...kGk..kGk....",
    "..kGGk..kGGk...",
    "..kkkk..kkkk..."
  ]),
  warden: compileSprite([
    "..kk..........kk..",
    ".kggk..kkkk..kggk.",
    "..kggkkppppkkggk..",
    "...kkppppppppkk...",
    "...kpppkRRooRpk...",
    "..kkrrrrrrrrrrkk..",
    ".krrppppppppppprk.",
    "krrpmmmppppmmmprrk",
    "...kppggggggppk...",
    "...kpppddddpppk...",
    "...krrrrrrrrrrk...",
    "...kpprk..krppk...",
    "..kppppk..kppppk..",
    "..kkkkkk..kkkkkk.."
  ]),
  wraith: compileSprite([
    "....kkkkkkk....",
    "...kbbbbbbbk...",
    "..kbbbbbbbbbk..",
    "..kbbkkbccbbk..",
    "..kbbbccccbbk..",
    ".kbbbbbbbbbbbk.",
    ".kbbkbbbbbkbbk.",
    "kck..kbbbk..kck",
    "....kbbbbbk....",
    "...kbbk.kbbk...",
    "...k.k...k.k..."
  ])
};

// Бесшовные каменные текстуры стен и платформ
function createStoneTile(isPlat) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = isPlat ? '#2a2e3d' : '#151720';
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#0a0b10';
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
