import * as THREE from 'three';
import { ZONES, roadPaths, LOOP_RADIUS, ISLAND_RADIUS } from './layout.js';
import { PALETTE } from './content.js';

export const FONTS = {
  fa: { head: '"Vazirmatn", sans-serif', body: '"Vazirmatn", sans-serif' },
  en: { head: '"Bricolage Grotesque", sans-serif', body: '"Inter", sans-serif' },
};

let maxAniso = 4;
export function setAnisotropy(n) {
  maxAniso = n;
}

export function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function setDir(ctx, lang) {
  ctx.direction = lang === 'fa' ? 'rtl' : 'ltr';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ---------- ground ----------
export function drawGround(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const S = W / 200; // px per metre, world spans -100..100
  const P = (x, z) => [(x + 100) * S, (z + 100) * S];
  ctx.fillStyle = PALETTE.snow;
  ctx.fillRect(0, 0, W, W);

  // soft drifts
  const r = mulberry(7);
  for (let i = 0; i < 260; i++) {
    const [x, y] = [r() * W, r() * W];
    const rad = (4 + r() * 18) * S;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const c = r() > 0.5 ? '201,213,234' : '255,255,255';
    g.addColorStop(0, `rgba(${c},${0.18 + r() * 0.2})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // sparkle specks
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(160,180,215,0.35)' : 'rgba(255,255,255,0.9)';
    ctx.fillRect(r() * W, r() * W, 1.2, 1.2);
  }

  const stroke = (draw, width, color, blur = 0) => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = width * S;
    if (blur) {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur * S;
    }
    ctx.beginPath();
    draw();
    ctx.stroke();
    ctx.restore();
  };
  const drawRoads = () => {
    for (const path of roadPaths()) {
      const [a, b, c] = path.map((p) => P(p[0], p[1]));
      ctx.moveTo(...a);
      ctx.quadraticCurveTo(...b, ...c);
    }
    const [cx, cy] = P(0, 0);
    ctx.moveTo(cx + LOOP_RADIUS * S, cy);
    ctx.arc(cx, cy, LOOP_RADIUS * S, 0, Math.PI * 2);
  };
  stroke(drawRoads, 8.5, 'rgba(183,195,220,0.55)', 3);
  stroke(drawRoads, 6.5, PALETTE.road);
  stroke(drawRoads, 4.6, '#c3cee4');
  // packed-snow ruts
  ctx.save();
  ctx.setLineDash([1.2 * S, 1.6 * S]);
  stroke(drawRoads, 0.25, 'rgba(255,255,255,0.7)');
  ctx.restore();

  // plazas
  for (const k in ZONES) {
    const z = ZONES[k];
    const [x, y] = P(z.x, z.z);
    const rad = (z.r - 3) * S;
    ctx.fillStyle = PALETTE.road;
    ctx.beginPath();
    ctx.arc(x, y, rad + 0.8 * S, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c7d1e6';
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.setLineDash([2 * S, 1.4 * S]);
    ctx.strokeStyle = z.color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 0.45 * S;
    ctx.beginPath();
    ctx.arc(x, y, rad - 1 * S, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // beach of packed ice around the coast
  const [cx, cy] = P(0, 0);
  const g = ctx.createRadialGradient(cx, cy, (ISLAND_RADIUS - 8) * S, cx, cy, (ISLAND_RADIUS + 8) * S);
  g.addColorStop(0, 'rgba(173,204,232,0)');
  g.addColorStop(1, 'rgba(173,204,232,0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, W);
}

// ---------- flat text decals on the ground ----------
// lines: [{ text, size (m), weight, color, font: 'head'|'body' }]
export function textDecalCanvas(lines, lang, widthM, opts = {}) {
  const ppm = opts.ppm || 64;
  const pad = 0.4 * ppm;
  const heightM = lines.reduce((a, l) => a + l.size * 1.35, 0) + 0.8;
  const [c, ctx] = makeCanvas(Math.ceil(widthM * ppm), Math.ceil(heightM * ppm));
  setDir(ctx, lang);
  ctx.textAlign = opts.align || 'center';
  ctx.textBaseline = 'middle';
  let y = pad;
  for (const l of lines) {
    const fam = FONTS[lang][l.font || 'head'];
    let px = l.size * ppm;
    ctx.font = `${l.weight || 800} ${px}px ${fam}`;
    while (ctx.measureText(l.text).width > c.width - pad * 2 && px > 8) {
      px *= 0.94;
      ctx.font = `${l.weight || 800} ${px}px ${fam}`;
    }
    const lh = l.size * 1.35 * ppm;
    ctx.fillStyle = l.color || PALETTE.ink;
    ctx.globalAlpha = l.alpha ?? 1;
    const x = ctx.textAlign === 'center' ? c.width / 2 : ctx.textAlign === 'right' ? c.width - pad : pad;
    ctx.fillText(l.text, x, y + lh / 2);
    y += lh;
  }
  return { canvas: c, widthM, heightM };
}

// ---------- skill crate ----------
export function crateCanvas(label, color) {
  const [c, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 5; i++) ctx.fillRect(0, 22 + i * 50, 256, 3);
  ctx.strokeStyle = 'rgba(22,33,59,0.55)';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 242, 242);
  roundRect(ctx, 26, 82, 204, 92, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let px = 40;
  ctx.font = `700 ${px}px ${FONTS.en.body}`;
  const lines = () => wrap(ctx, label, 186);
  while ((lines().length > 2 || lines().some((l) => ctx.measureText(l).width > 190)) && px > 14) {
    px -= 2;
    ctx.font = `700 ${px}px ${FONTS.en.body}`;
  }
  const ls = lines();
  ls.forEach((l, i) => ctx.fillText(l, 128, 128 + (i - (ls.length - 1) / 2) * px * 1.05));
  return c;
}

// ---------- project billboard ----------
export function billboardCanvas(p, lang, color, image, idx) {
  const W = 1024, H = 640;
  const [c, ctx] = makeCanvas(W, H);
  const rtl = lang === 'fa';
  setDir(ctx, lang);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#1a2446');
  g.addColorStop(1, '#2a2f63');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // stripe
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, 14);

  const pad = 56;
  let textX = pad, textW = W - pad * 2;
  if (image) {
    const iw = 440, ih = 275;
    const ix = rtl ? pad : W - pad - iw;
    ctx.save();
    roundRect(ctx, ix, 120, iw, ih, 18);
    ctx.clip();
    ctx.drawImage(image, ix, 120, iw, ih);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    roundRect(ctx, ix, 120, iw, ih, 18);
    ctx.stroke();
    textW = W - pad * 3 - iw;
    textX = rtl ? pad * 2 + iw : pad;
  } else {
    // generative cover
    const cx = rtl ? 150 : W - 150;
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.12 + i * 0.07;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, H - 90, 40 + i * 34, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const ax = rtl ? textX + textW : textX;
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.font = `700 30px ${FONTS[lang].body}`;
  ctx.fillText(String(idx + 1).padStart(2, '0'), ax, 96);
  ctx.fillStyle = '#ffffff';
  let px = 64;
  ctx.font = `800 ${px}px ${FONTS[lang].head}`;
  while (ctx.measureText(p.name).width > textW && px > 30) {
    px -= 2;
    ctx.font = `800 ${px}px ${FONTS[lang].head}`;
  }
  ctx.fillText(p.name, ax, 96 + px + 14);
  ctx.font = `400 30px ${FONTS[lang].body}`;
  ctx.fillStyle = 'rgba(234,240,255,0.82)';
  const lines = wrap(ctx, p.description, textW).slice(0, image ? 6 : 4);
  let y = 96 + px + 70;
  for (const l of lines) {
    ctx.fillText(l, ax, y);
    y += 44;
  }
  // tags
  ctx.font = `600 24px ${FONTS.en.body}`;
  ctx.direction = 'ltr';
  let tx = pad;
  const ty = H - 70;
  ctx.textAlign = 'left';
  const tags = rtl ? [...p.tags] : p.tags;
  for (const t of tags) {
    const w = ctx.measureText(t).width + 32;
    if (tx + w > W - pad) break;
    roundRect(ctx, tx, ty - 34, w, 46, 23);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.fillStyle = '#eaf0ff';
    ctx.fillText(t, tx + 16, ty - 2);
    tx += w + 12;
  }
  return c;
}

// ---------- contact monolith face ----------
export function monolithCanvas(kind, label, lang, color) {
  const W = 512, H = 768;
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = '#1a2446';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color;
  ctx.fillRect(0, H - 18, W, 18);
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(W / 2, 290, 150, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const glyph = { email: '@', github: '</>', linkedin: 'in', cv: 'CV' }[kind];
  ctx.font = `800 ${glyph.length > 2 ? 110 : 150}px ${FONTS.en.head}`;
  ctx.fillText(glyph, W / 2, 300);
  setDir(ctx, lang);
  let px = 72;
  ctx.font = `800 ${px}px ${FONTS[lang].head}`;
  while (ctx.measureText(label).width > W - 60) {
    px -= 4;
    ctx.font = `800 ${px}px ${FONTS[lang].head}`;
  }
  ctx.fillText(label, W / 2, 580);
  return c;
}

// ---------- wooden sign ----------
export function signCanvas(text, lang, color = PALETTE.amber) {
  const [c, ctx] = makeCanvas(768, 256);
  ctx.fillStyle = '#6e4636';
  ctx.fillRect(0, 0, 768, 256);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < 4; i++) ctx.fillRect(0, 60 + i * 64, 768, 4);
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 740, 228);
  ctx.fillStyle = '#fff4e2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setDir(ctx, lang);
  let px = 110;
  ctx.font = `800 ${px}px ${FONTS[lang].head}`;
  while (ctx.measureText(text).width > 680) {
    px -= 4;
    ctx.font = `800 ${px}px ${FONTS[lang].head}`;
  }
  ctx.fillText(text, 384, 134);
  return c;
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
