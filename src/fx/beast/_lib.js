// Shared kit for the "山海" boss effects: a strictly 8-colour palette, auspicious-cloud (祥云) motifs,
// gold filigree, rune arrays and the particles all four effects share. Everything is drawn with hard pixels
// and ordered dithering: no translucency, so no colour outside the boss's own ramp ever appears on screen.

import { hex, Rng, clamp, lerp, seg, smooth, ease, TAU, rand } from "../../core/index.js";

// ---- the boss's palette. Nothing else is ever drawn.
export const P8 = {
  bone: hex("#FFF8E7"),
  gold: hex("#FFD700"),
  crimson: hex("#E62E00"),
  flame: hex("#FF6A00"),
  ember: hex("#7A1212"),
  jade: hex("#2E9E8F"),
  teal: hex("#16524B"),
  ink: hex("#18222F"),
};
export const { bone, gold, crimson, flame, ember, jade, teal, ink } = P8;
export const LIST8 = ["#FFF8E7", "#FFD700", "#E62E00", "#FF6A00", "#7A1212", "#2E9E8F", "#16524B", "#18222F"];

// steps, dark -> hot. Pixel art picks a step, it never blends.
export const FIRE = [ink, ember, crimson, flame, gold, bone];
export const JADE = [ink, teal, jade, bone];
export const COOL = [bone, gold, flame, crimson, ember, ink]; // a dying ember: bright to gone
export const GREY = [ink, ember, teal, jade]; // 青灰 smoke
export const rampAt = (r, t) => r[clamp(Math.floor(t * r.length), 0, r.length - 1)];

// ---- ordered dithering: the only fade these effects use
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bay = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
// ---- the live frame: a rectangle the art must stay inside, so particles and shockwaves tear off its edges
// instead of drawing pixel noise outside the canvas.
export const FRAME = { x: -1e9, y: -1e9, w: 1e9, h: 1e9 };
/** Clip a painter to `f` (screen pixels) for the rest of this frame. Idempotent per frame config. */
export function clipTo(p, f = FRAME) {
  const key = `${f.x},${f.y},${f.w},${f.h}`;
  if (p.__clipKey === key) return p;
  p.__clipKey = key;
  const put = p.put.bind(p), add = p.add.bind(p), bl = p.blendPx.bind(p);
  const X0 = f.x, Y0 = f.y, X1 = f.x + f.w, Y1 = f.y + f.h;
  p.put = (sx, sy, c, a) => (sx >= X0 && sy >= Y0 && sx < X1 && sy < Y1 ? put(sx, sy, c, a) : undefined);
  p.add = (sx, sy, c, k) => (sx >= X0 && sy >= Y0 && sx < X1 && sy < Y1 ? add(sx, sy, c, k) : undefined);
  p.blendPx = (sx, sy, c, a) => (sx >= X0 && sy >= Y0 && sx < X1 && sy < Y1 ? bl(sx, sy, c, a) : undefined);
  return p;
}

/** Is a pixel with alpha a shown at (x, y)? */
export const shown = (x, y, a) => a > bay(Math.floor(x), Math.floor(y));
/** Alpha that keeps a share a of a region: 0 or 1. */
export const dith = (x, y, a) => (a > bay(Math.floor(x), Math.floor(y)) ? 1 : 0);

// ---- 祥云: the auspicious cloud scroll, a spiral head with a swelling tail
/**
 * Abbreviated cloud curl: a spiral of 1 px line, colour may be a function of u (0 at the centre).
 * opt: { sy squash, w line width, skip 0..1 head to hide, dir +1/-1 handedness }
 */
export function curl(p, cx, cy, r, ph, col, opt = {}) {
  const sy = opt.sy ?? 0.9, w = opt.w ?? 1, skip = opt.skip ?? 0, dir = opt.dir ?? 1;
  const steps = Math.max(8, Math.ceil(r * 9));
  let lx = 1e9, ly = 1e9;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    if (u < skip) continue;
    const a = ph + dir * u * 2.35 * TAU * 0.55, rr = r * (0.15 + 0.85 * u);
    const x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr * sy);
    if (x === lx && y === ly) continue;
    lx = x; ly = y;
    const c = typeof col === "function" ? col(u) : col;
    if (!c) continue;
    for (let k = 0; k < w; k++) p.px(x, y + k, c);
  }
}
/** A full 祥云: spiral head, a hooked tail of two lobes. Drawn in the given colour(s). */
export function cloud(p, x, y, r, ph, col, opt = {}) {
  const a = opt.a ?? 1;
  if (opt.solid) return solidCloud(p, x, y, r, ph, col, a, opt);
  const c = (u) => (typeof col === "function" ? col(u) : col);
  curl(p, x, y, r, ph, col, { sy: 0.82, w: Math.max(1, Math.round(r / 6)), skip: 0, dir: opt.dir ?? 1 });
  if (a < 1 && !shown(x, y, a)) return;
  // the tail: two lobes that scroll away from the head, thinning as they go
  const n = Math.max(4, Math.round(r * 2.2)), sx = (opt.dir ?? 1) >= 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const px = x + sx * (r * 0.55 + u * r * 1.75);
    const py = y + r * 0.30 + Math.sin(u * 3.1 + ph) * r * 0.30 - u * r * 0.10;
    if (a < 1 && !shown(px, py, a * (1 - u * 0.5))) continue;
    const cc = c(0.6 + u * 0.4);
    if (!cc) continue;
    p.px(px, py, cc);
    if (u < 0.5) p.px(px, py - 1, cc);
    if (u < 0.22) p.px(px + sx, py - 2, cc);
  }
}

/** The three lobes of a 祥云: [cx, cy, r, light]. Shared by the fill and its rim. */
function cloudLobes(x, y, r) {
  return [
    [x - r * 0.62, y + r * 0.2, r * 0.58, 0.22],
    [x + r * 0.62, y - r * 0.06, r * 0.52, 0.4],
    [x, y - r * 0.36, r * 0.78, 0.72],
  ];
}

/**
 * A filled 祥云 of hard pixels: three lobes and a spiral head, shaded with `col(v)` where v runs from
 * dark (0, the far lobe and the shadow under everything) to light (1, the sunlit top of the front lobe).
 */
function solidCloud(p, x, y, r, ph, col, a, opt = {}) {
  if (a <= 0.04 || r < 1) return;
  const shade = (v) => (typeof col === "function" ? col(v) : col);
  // a 1 px dark rim first, so a pale cloud still reads when it sits on fire
  if (opt.rim) {
    for (const [cx, cy, rr] of cloudLobes(x, y, r)) {
      for (let i = 0; i < Math.max(16, rr * 5); i++) {
        const an = (i / Math.max(16, rr * 5)) * TAU;
        p.px(cx + Math.cos(an) * (rr + 0.6), cy + Math.sin(an) * (rr + 0.6), opt.rim);
      }
    }
  }
  if (r < 8) {
    // small: one lobe, a notch bitten out of its lower right, a nub on top, and a spiral cut
    const rr = r;
    for (let py = Math.ceil(y - rr - 1); py <= y + rr + 1; py++)
      for (let px = Math.ceil(x - rr - 1); px <= x + rr + 1; px++) {
        const dx = px - x, dy = py - y, d = Math.hypot(dx, dy) / rr;
        if (d > 1) continue;
        // the bite: the scroll's mouth
        if (rr > 5 && dx > rr * 0.4 && dy > rr * 0.05 && Math.hypot(dx - rr * 0.6, dy - rr * 0.1) < rr * 0.42) continue;
        const lit = 0.55 + (-dy / rr) * 0.3 - (dx / rr) * 0.14 - d * 0.15;
        const c = shade(clamp(lit));
        if (!c) continue;
        if (a < 0.99 && !shown(px, py, a * (d > 0.7 ? 0.6 : 1))) continue;
        p.px(px, py, c);
      }
    // the nub and the scroll cut
    p.px(x - rr * 0.6, y - rr * 0.72, shade(0.85));
    p.px(x - rr * 0.6 + 1, y - rr * 0.72, shade(0.5));
    for (let i = 0; i <= 7; i++) {
      const ang = ph + (i / 7) * TAU * 0.8, rr2 = rr * (0.2 + (i / 7) * 0.4);
      if (!shown(x, y, a)) continue;
      p.px(x + Math.cos(ang) * rr2, y + Math.sin(ang) * rr2 * 0.9, shade(0.08));
    }
    return;
  }
  for (const [cx, cy, rr, light] of cloudLobes(x, y, r)) {
    for (let py = Math.ceil(cy - rr - 1); py <= cy + rr + 1; py++)
      for (let px = Math.ceil(cx - rr - 1); px <= cx + rr + 1; px++) {
        const d = Math.hypot(px - cx, py - cy) / rr;
        if (d > 1) continue;
        // lit from the top-left: the underside and the right drop two steps
        const lit = light + (cy - py) / rr * 0.22 - (px - cx) / rr * 0.10 - d * 0.12;
        const c = shade(clamp(lit));
        if (!c) continue;
        if (a < 0.99 && !shown(px, py, a * (d > 0.72 ? 0.55 : 1))) continue;
        p.px(px, py, c);
      }
  }
  // the scroll head: a spiral cut into the front lobe in a darker step, with a lit lip beside it
  if (r > 3.5 && opt.scroll !== false) {
    const steps = Math.max(8, Math.round(r * 4));
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, ang = ph + u * TAU * 0.72, rr = r * (0.1 + u * 0.3);
      const px = x - r * 0.3 + Math.cos(ang) * rr, py = y - r * 0.5 + Math.sin(ang) * rr * 0.9;
      if (!shown(px, py, a)) continue;
      p.px(px, py, shade(0.12));
      if (i % 5 === 0) p.px(px, py - 1, shade(0.95));
    }
  }
}

// ---- 云雷纹: the square-spiral thunder pattern used on the ground arrays and rune waves
/** One square-spiral glyph, s px wide. */
export function thunder(p, x, y, s, col, opt = {}) {
  const k = Math.max(1, Math.round(s / 6)), a = opt.a ?? 1;
  if (a < 1 && !shown(x, y, a)) return;
  const put = (gx, gy, c) => p.px(x + gx * k, y + gy * k, c);
  const c0 = typeof col === "function" ? col(0) : col;
  if (!c0) return;
  // outer hook
  put(0, 0, c0); put(1, 0, c0); put(2, 0, c0); put(3, 0, c0);
  put(0, 1, c0); put(3, 1, c0);
  put(0, 2, c0); put(1, 2, c0); put(2, 2, c0); put(3, 2, c0);
  // inner square spiral
  const c1 = typeof col === "function" ? col(1) : col;
  put(1, 1, c1); put(2, 1, c1); put(2, 2, c1);
}

// ---- ground helpers
/** A ground rune band: a 1 px gold line with thunder glyphs and a dithered echo under it. */
export function runeBand(p, x0, x1, y, t, col = gold, seed = 1) {
  const step = 7;
  for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) {
    const u = (x - x0) / Math.max(1, x1 - x0);
    const on = (Math.sin(u * 12 - t * 9 + seed) > -0.35);
    if (!on) continue;
    if (x < x0 || x > x1) continue;
    p.px(x, y, col);
    p.px(x + 1, y, col);
    if (Math.sin(u * 30 + seed * 2) > 0.1) thunder(p, x - 1, y - 5, 5, col, { a: 0.75 });
  }
  for (let x = Math.floor(x0); x <= x1; x++) if ((x & 1) === 0 && shown(x, y + 1, 0.5)) p.px(x, y + 1, col === gold ? ember : teal);
}

/** Cracks in the floor: jagged 1 px veins growing from x0 to either side, cooling gold -> ember. */
export function cracks(p, cx, cy, half, t, seed = 1, col = gold, a = 1) {
  const grow = smooth(0, 1, t);
  if (a <= 0.02) return;
  for (let s = -1; s <= 1; s += 2) {
    let x = cx, y = cy;
    for (let i = 0; i < 26 * grow; i++) {
      const r1 = rand(i, seed, s), r2 = rand(i, seed + 7, s);
      x += s * (2 + r1 * 3);
      y += (r2 - 0.5) * 2.4;
      if (y > cy + 2) y = cy + 2;
      if (Math.abs(x - cx) > half) break;
      if (!shown(x, y, a)) continue;
      p.px(x, y, i < 8 ? bone : i < 16 ? gold : col);
      p.px(x, y - 1, i < 4 ? gold : ember);
      if (i % 4 === 0 && r1 > 0.4) p.px(x, y + 1, ember);
    }
  }
}

export function pillar(p, x, y0, h, w, t, seed, opt = {}) {
  if (h < 2 || w < 1) return;
  const heat = opt.heat ?? 1, twist = opt.twist ?? 6, taper = opt.taper ?? 0.55;
  const outer = opt.outer ?? null, sway = opt.sway ?? 1;
  p.shade(x - w * 2 - 4, y0 - h - 4, x + w * 2 + 4, y0 + 2, (px, py, o) => {
    const up = (y0 - py) / h; // 0 base, 1 tip
    if (up < 0 || up > 1) return;
    const wob = Math.sin(t * 6.5 + up * twist + seed) * w * 0.38 * up * sway;
    const cx = x + wob;
    const flare = 1 + (1 - up) * 0.4;
    const wave = 1 + Math.sin(up * 11 - t * 7 + seed) * 0.13 + Math.sin(up * 4.3 + t * 3) * 0.09;
    const half = Math.max(0.8, w * flare * Math.pow(1 - up, taper) * wave);
    const dx = px - cx;
    const ax = Math.abs(dx) / half;
    if (ax > 1) return;
    // ragged silhouette, cut by coherent tongues rather than per-pixel noise
    const tongue = Math.sin(up * 12 + t * 8 + seed) * 0.5 + 0.5;
    const edge = 0.9 - tongue * 0.1;
    if (ax > edge) return;
    if (up > 0.62 && tongue < (up - 0.62) * 1.7) return;
    // a wind sheath over the outer third, torn into tongues so the fire shows through
    if (outer && ax > 0.72) {
      const band = (ax - 0.72) / 0.28;
      const gap = Math.sin(up * 17 - t * 11 + seed) * 0.5 + 0.5;
      if (band > 0.1 + gap * 0.5) {
        o.c = ax > 0.95 ? teal : rampAt(outer, 0.45 + (1 - band) * 0.5 + up * 0.2);
        o.a = 1;
        return;
      }
    }
    const heatAt = clamp(1.12 - Math.pow(ax, 0.6) * 1.05 - up * 0.9 - (1 - heat) * 0.62);
    o.c = ax > 0.94 && dx > 0 ? ember : rampAt(FIRE, heatAt);
    o.a = 1;
  });
  // spiral of light running up the core
  if (opt.spiral !== false) {
    for (let i = 0; i < 30; i++) {
      const u = ((i / 30) + t * 0.5) % 1;
      const yy = y0 - u * h * 0.95;
      const ww = Math.max(1, w * Math.pow(1 - u, taper) * 0.85);
      const xx = x + Math.cos(u * 8 + t * 6 + seed) * ww;
      const c = u > 0.6 ? rampAt(FIRE, 0.9) : bone;
      p.px(xx, yy, c);
      if (u < 0.45) p.px(xx, yy + 1, gold);
    }
  }
}

// ---- a tapered slash band: a lens-shaped stroke between two points, optionally bowed
/**
 * opt: { bow, lens (0..1 of the stroke's length lit), ramp (function u -> colour), rim, w }
 * Returns nothing. Draws a hard-edged lens: no soft ends, the tips dissolve through the dither.
 */
export function band(p, x0, y0, x1, y1, maxW, t, opt = {}) {
  const bow = opt.bow ?? 0, lens = opt.lens ?? 1, rim = opt.rim ?? null;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const qx = mx + nx * bow, qy = my + ny * bow;
  // sample the quadratic into points
  const pts = [];
  for (let i = 0; i <= 26; i++) {
    const u = i / 26, iu = 1 - u;
    pts.push([iu * iu * x0 + 2 * iu * u * qx + u * u * x1, iu * iu * y0 + 2 * iu * u * qy + u * u * y1]);
  }
  const dist = (u) => {
    const f = clamp(u) * 26, i = Math.min(25, Math.floor(f)), k = f - i;
    return [lerp(pts[i][0], pts[i + 1][0], k), lerp(pts[i][1], pts[i + 1][1], k)];
  };
  const bb = maxW + Math.abs(bow) * 0.3 + 2;
  p.shade(Math.min(x0, x1) - bb, Math.min(y0, y1) - bb, Math.max(x0, x1) + bb, Math.max(y0, y1) + bb, (x, y, o) => {
    let best = 1e9, bu = 0;
    for (let i = 0; i < 26; i++) {
      const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
      const ex = bx - ax, ey = by - ay, L2 = ex * ex + ey * ey || 1e-6;
      let u = ((x - ax) * ex + (y - ay) * ey) / L2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const px = ax + ex * u - x, py = ay + ey * u - y, d = Math.hypot(px, py);
      if (d < best) { best = d; bu = (i + u) / 26; }
    }
    if (bu > lens && opt.cut !== false) return;
    const u = clamp(bu / Math.max(0.001, lens));
    // width of the lens: pointed at both ends, fat in the middle
    const taper = opt.flat ? 1 : Math.pow(Math.sin(Math.PI * Math.pow(u, opt.skew ?? 1)), 0.55);
    const w = maxW * taper;
    if (w < 0.4 || best > w) return;
    const v = best / w;
    o.c = opt.ramp ? opt.ramp(u, v) : (v > 0.82 && rim ? rim : bone);
    o.a = opt.alpha ? opt.alpha(u, v) : 1;
  });
}

// ---- the bagua array: gold rings, eight trigrams, a 祥云 heart
export function bagua(p, cx, cy, r, rot, t, opt = {}) {
  const a = opt.a ?? 1;
  if (a <= 0.03) return;
  const col = opt.col ?? gold;
  const col2 = opt.col2 ?? crimson;
  const ringR = r;
  // outer double ring
  for (let i = 0; i < 220; i++) {
    const g = (i / 220) * TAU;
    const on = i % 2 === 0 || r > 40;
    if (!on) continue;
    p.px(cx + Math.cos(g) * ringR, cy + Math.sin(g) * ringR, col);
    if (r > 30 && i % 2 === 0) p.px(cx + Math.cos(g) * (ringR - 3), cy + Math.sin(g) * (ringR - 3), rampAt(FIRE, 0.7));
  }
  // eight trigrams: three bars, some broken, marching round
  for (let k = 0; k < 8; k++) {
    const base = rot + (k * TAU) / 8;
    for (let row = 0; row < 3; row++) {
      const rw = ringR - 7 - row * 3.4;
      const broken = (k * 7 + row * 3 + Math.floor(t * 3)) % 5 < 2;
      const half = 0.16 + (row === 1 ? 0.02 : 0);
      for (let s = -1; s <= 1; s += 2) {
        const g = base + s * half * 0.5;
        for (let q = 0; q < 5; q++) {
          if (broken && Math.abs(q - 2) < 1 && s < 0) continue;
          const g2 = g + (q - 2) * 0.022;
          p.px(cx + Math.cos(g2) * rw, cy + Math.sin(g2) * rw, row === 1 ? col2 : col);
        }
      }
    }
  }
  if (r > 26) {
    // inner cloud heart, turning the other way
    for (let k = 0; k < 4; k++) {
      const g = rot * -1.4 + (k * TAU) / 4 + t * 1.4;
      const rr = ringR * 0.42;
      cloud(p, cx + Math.cos(g) * rr, cy + Math.sin(g) * rr, Math.max(2, r * 0.16), g, k % 2 ? col : jade, { a });
    }
  }
}

// ---- the shared particle field: sparks, shards, embers, cloud puffs, energy streaks
export class Field {
  constructor(seed = 1, ground = 0) {
    this.R = new Rng(seed);
    this.g = ground;
    this.list = [];
  }
  add(p) {
    this.list.push(p);
    return p;
  }
  get busy() {
    return this.list.length > 0;
  }
  spark(x, y, vx, vy, life, opt = {}) {
    return this.add({ k: "sp", x, y, vx, vy, t: 0, life, sz: opt.sz ?? 2, hot: opt.hot ?? 0, g: opt.g ?? 430, drag: opt.drag ?? 1.6, bounce: opt.bounce ?? 0.42, back: !!opt.back });
  }
  shard(x, y, vx, vy, life, col, opt = {}) {
    return this.add({ k: "sh", x, y, vx, vy, t: 0, life, col, sz: opt.sz ?? 1, rot: 0, vr: (this.R.next() - 0.5) * 22, g: opt.g ?? 520, bounce: opt.bounce ?? 0.3 });
  }
  ember(x, y, vy, life, opt = {}) {
    return this.add({ k: "em", x, y, vx: opt.vx ?? 0, vy, t: 0, life, sz: opt.sz ?? 1, ph: this.R.range(0, TAU), hot: opt.hot ?? 0, wander: opt.wander ?? 26, rise: opt.rise ?? 1 });
  }
  puff(x, y, vx, vy, r, life, opt = {}) {
    return this.add({ k: "cf", x, y, vx, vy, r, t: 0, life, ph: this.R.range(0, TAU), grow: opt.grow ?? 8, rise: opt.rise ?? 12, col: opt.col ?? 0, dir: opt.dir ?? 1, piece: !!opt.piece });
  }
  streak(x, y, vx, vy, life, col, len = 5) {
    return this.add({ k: "st", x, y, vx, vy, t: 0, life, col, len });
  }
  burst(x, y, n, speed, life, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = this.R.range(0, TAU), s = this.R.range(speed[0], speed[1]);
      this.spark(x, y, Math.cos(a) * s, Math.sin(a) * s * (opt.sy ?? 1) - (opt.up ?? 0), this.R.range(life[0], life[1]), opt);
    }
  }
  update(dt) {
    const g = this.g;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.t += dt;
      if (p.t >= p.life) { this.list.splice(i, 1); continue; }
      switch (p.k) {
        case "sp": {
          p.vy += p.g * dt;
          p.vx -= p.vx * p.drag * dt;
          p.vy -= p.vy * p.drag * 0.35 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.vy > 0 && p.y > g) {
            p.y = g;
            if (Math.abs(p.vy) > 44) { p.vy = -p.vy * p.bounce; p.vx *= 0.62; }
            else { p.vy = 0; p.vx *= 0.4; p.t = Math.max(p.t, p.life * 0.65); }
          }
          break;
        }
        case "sh": {
          p.vy += p.g * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
          if (p.y > g) {
            p.y = g;
            if (Math.abs(p.vy) > 60) { p.vy = -p.vy * p.bounce; p.vx *= 0.7; p.vr *= 0.6; }
            else { p.vy = 0; p.vx *= 0.5; p.vr *= 0.5; }
          }
          break;
        }
        case "em": {
          p.vy -= (24 + Math.sin(p.t * 3 + p.ph) * 12) * p.rise * dt;
          p.vx += Math.cos(p.t * 2.2 + p.ph) * p.wander * dt;
          p.vx -= p.vx * 1.1 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        }
        case "cf": {
          p.vy -= (p.rise + 8 * Math.sin(p.t * 2 + p.ph)) * dt;
          p.vx += Math.cos(p.t * 1.7 + p.ph) * 9 * dt;
          p.vx -= p.vx * 0.7 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        }
        case "st": {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          break;
        }
        default:
          break;
      }
    }
  }
  /** layer: "back" draws the soft cloud pieces, "front" everything else. */
  draw(p, layer = "front") {
    for (const q of this.list) {
      const u = q.t / q.life; // 0 fresh, 1 gone
      if (q.k === "cf") {
        if (layer !== "back") continue;
        this.drawPuff(p, q, u);
        continue;
      }
      if (layer === "back") continue;
      switch (q.k) {
        case "sp": {
          if (u > 0.72 && !shown(q.x, q.y, (1 - u) / 0.28)) continue;
          const c = rampAt(COOL, Math.min(0.99, u * 0.9 + q.hot * 0.3));
          const sx = Math.round(q.x), sy = Math.round(q.y);
          const n = q.sz;
          for (let i = 1; i <= n + 1; i++) {
            const x = Math.round(q.x - q.vx * 0.006 * i), y = Math.round(q.y - q.vy * 0.006 * i);
            p.px(x, y, i > n ? ember : c);
          }
          p.px(sx, sy, c);
          break;
        }
        case "sh": {
          if (u > 0.7 && !shown(q.x, q.y, (1 - u) / 0.3)) continue;
          const col = u > 0.55 ? ember : q.col;
          const s = q.sz;
          for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) p.px(q.x + xx, q.y + yy, col);
          if (s > 1 && Math.sin(q.rot) > 0.4) p.px(q.x + s, q.y, rampAt(FIRE, 0.9));
          break;
        }
        case "em": {
          if (u > 0.6 && !shown(q.x, q.y, (1 - u) / 0.4)) continue;
          const c = rampAt(COOL, Math.min(0.99, u + q.hot * 0.4));
          p.px(q.x, q.y, c);
          if (q.sz > 1) p.px(q.x + 1, q.y, c), p.px(q.x, q.y - 1, c);
          break;
        }
        case "st": {
          const c = q.col;
          for (let i = 0; i < q.len; i++) {
            const k = i / q.len;
            if (u > 0.4 + k && !shown(q.x, q.y, 0.5)) break;
            p.px(q.x - q.vx * 0.006 * i, q.y - q.vy * 0.006 * i, k > 0.66 ? ember : c);
          }
          break;
        }
        default:
          break;
      }
    }
  }
  drawPuff(p, q, u) {
    if (u > 0.82 && !shown(q.x, q.y, (1 - u) / 0.18)) return;
    const r = q.r * (1 + u * q.grow * 0.12);
    // a 祥云-shaped smoke ball: three lobes and a curl, cooling from its own colour to 青灰 and ink
    const col = q.col || rampAt(u < 0.3 ? [bone, gold, flame, crimson, ember, ink] : GREY, Math.min(0.99, u * 1.15));
    const a = u > 0.45 ? (1 - u) / 0.55 : 1;
    for (let k = 0; k < 3; k++) {
      const an = q.ph + k * 2.1 + q.t * 0.7 * q.dir;
      const rr = r * (0.6 + 0.4 * Math.sin(q.t * 2 + k));
      const cxp = q.x + Math.cos(an) * r * 0.5, cyp = q.y + Math.sin(an) * r * 0.5 * 0.7;
      const step = Math.max(1, Math.round(rr * 0.5));
      for (let yy = -rr; yy <= rr; yy += step)
        for (let xx = -rr; xx <= rr; xx += step) {
          const d = Math.hypot(xx, yy) / rr;
          if (d > 1) continue;
          if (d > 0.6 && !shown(cxp + xx, cyp + yy, a * 0.6)) continue;
          if (a < 1 && !shown(cxp + xx, cyp + yy, a)) continue;
          p.px(cxp + xx, cyp + yy, d > 0.75 ? (col === bone ? gold : col) : col);
        }
    }
    if (r > 4) curl(p, q.x, q.y, r * 0.75, q.ph + q.t * 2.2, shadeCol(col, -1), { w: 1 });
  }
}

/** One step darker along the 8-colour wheel, for shading a shape without leaving the palette. */
export function shadeCol(c, dir = -1) {
  const order = [ink, ember, teal, crimson, flame, jade, gold, bone];
  const i = order.indexOf(c);
  if (i < 0) return c;
  return order[clamp(i + (dir > 0 ? -1 : 1), 0, order.length - 1)];
}

// ---- impact frames: a hard white flash shaped like the blow
export function flashX(p, cx, cy, r, thick, col = bone) {
  if (r < 1) return;
  for (let i = -r; i <= r; i++) {
    const w = Math.max(1, Math.round(thick * (1 - Math.abs(i) / r) ** 1.4));
    for (let k = 0; k < w; k++) {
      p.px(cx + i, cy + i - k, col);
      p.px(cx + i, cy - i - k, col);
    }
  }
}
/** A hard star flash, arms at n angles. */
export function flashStar(p, cx, cy, r, col = bone, n = 4, rot = 0) {
  for (let k = 0; k < n; k++) {
    const a = rot + (k * TAU) / n;
    for (let i = 0; i <= r; i++) {
      const w = i > r * 0.7 ? 1 : 2;
      for (let q = 0; q < w; q++) p.px(cx + Math.cos(a) * i - Math.sin(a) * q, cy + Math.sin(a) * i + Math.cos(a) * q, i > r * 0.6 ? gold : col);
    }
  }
}

/** Ground shadow/glow ring drawn in dithered palette pixels (no light buffer: this art is indexed). */
export function groundRing(p, cx, cy, rx, ry, t, ramp = [bone, gold, flame, crimson, ember], w = 1.2) {
  const n = Math.max(24, Math.round((rx + ry) * 2.2));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const d = 1 + Math.sin(a * 5 + t * 4) * 0.02;
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    for (let k = 0; k < w; k++) p.px(x, y + k, rampAt(ramp, 0.35 + 0.3 * Math.sin(a * 3 + t * 3)));
  }
}

export { Rng, clamp, lerp, seg, smooth, ease, TAU, rand };

/** Ballistic position with one bounce off the floor at y = ground. */
export function flight(x0, y0, vx, vy, g, age, ground = Infinity, bounce = 0.4) {
  let t = age, x = x0 + vx * t, y = y0 + vy * t + 0.5 * g * t * t;
  if (y > ground && vy + g * t > 0) {
    // time it crossed the floor: solve y0 + vy t + g t²/2 = ground
    const disc = vy * vy + 2 * g * (ground - y0);
    if (disc > 0) {
      const th = (-vy + Math.sqrt(disc)) / g;
      if (th > 0 && th <= t) {
        const vyh = -(vy + g * th) * bounce, vxh = vx * 0.72, rest = t - th;
        x = x0 + vx * th + vxh * rest;
        y = ground + vyh * rest + 0.5 * g * rest * rest;
        if (y > ground) y = ground;
      }
    }
  }
  return [x, y];
}

/**
 * A slash ribbon: a lens of hard pixels from A to B, bowed, pointed at both ends, coloured by
 * fn(u: along 0..1, v: 0 core..1 rim). opts: { bow, a, skew, rim, n }
 * Drawn by stepping along the stroke, so it costs length x width, not the area of its box.
 */
export function ribbon(p, x0, y0, x1, y1, wmax, fn, opt = {}) {
  const bow = opt.bow ?? 0, skew = opt.skew ?? 1, a = opt.a ?? 1;
  if (a <= 0.02 || wmax < 0.8) return;
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const steps = Math.max(8, Math.ceil(L * 1.6));
  const at = (u) => {
    const o = bow * 4 * u * (1 - u);
    return [x0 + dx * u + nx * o, y0 + dy * u + ny * o];
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i <= steps; i++) {
      const u = clamp((i + pass * 0.5) / steps);
      const w = wmax * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(u, skew)), 0.55);
      if (w < 0.6) continue;
      const [cx, cy] = at(u);
      const rad = Math.ceil(w);
      for (let q = -rad; q <= rad; q++) {
        const v = Math.abs(q) / w;
        if (v > 1) continue;
        const c = fn(u, v);
        if (!c) continue;
        if (a < 1 && !shown(cx + nx * q, cy + ny * q, a)) continue;
        p.px(cx + nx * q, cy + ny * q, c);
      }
    }
  }
  if (opt.rim) {
    for (let i = 1; i < steps; i += 2) {
      const u = i / steps, w = wmax * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(u, skew)), 0.55) + 1;
      if (w < 1.2) continue;
      const [cx, cy] = at(u);
      p.px(cx + nx * w, cy + ny * w, opt.rim);
      if (i % 3) p.px(cx - nx * w, cy - ny * w, opt.rim);
    }
  }
}
