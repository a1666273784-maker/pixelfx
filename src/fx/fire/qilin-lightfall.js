// Lightning paths use the shared midpoint-displacement recipe adapted from Sprite Fusion's lightning
// (https://www.spritefusion.com/pixel-art-vfx/lightning), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, seg, lerp, ease, rng, READY, posed, poseAt } from "../../core/index.js";
import { zigzag, trace } from "../lightning/_lib.js";
import { noiseFor } from "./_lib.js";
import { pool } from "../explosions/_lib.js";

export const meta = {
  name: "麒麟·赤金光坠",
  desc: "A crimson-gold pillar crashes from the sky, wrapped in lightning, with a ground shockwave and three sprays of sparks.",
  tags: ["fire", "qilin", "pillar", "lightning", "shockwave", "boss", "one-shot"],
  size: [320, 200], origin: [160, 176], duration: 2.8, fps: 30, loop: false,
  bg: "dark", actor: 2,
  options: { palette: ["#5b0910", "#8d1615", "#c33216", "#ec6419", "#f99c20", "#ffc943", "#fff078", "#fffdf2"], seed: 7 },
};

// Gameplay contract: the x intervals are local to the impact, not to the caster.
export const danger = {
  column: { from: 0.20, to: 2.45, minX: -48, maxX: 48 },
  shock: { from: 0.22, to: 0.90, halfWidth: 8 },
};
export function shockRadius(t) {
  if (t < 0.20 || t > 0.90) return null;
  if (t < 0.22) return 20;
  return 90 + 110 * seg(t, 0.22, 0.90);
}

// The stock act is a humanoid stand-in; the game supplies the giant qilin sprite.
const CAST = { ...READY, x: -70, crouch: 5, lean: -4, fx: 9, fy: -20, bx: -7, by: -20 };
export const act = {
  poses: [[-0.12, { ...READY, x: -70 }], [0, CAST], [0.20, { ...CAST, crouch: 7 }, "snap"],
    [1.60, CAST], [2.45, { ...READY, x: -70 }], [2.8, { ...READY, x: -70 }]],
  hits: [{ t: 0.20, target: false, stop: 0.04, shake: 0.12, amp: 2 }],
};

const TOP = -176, END = 2.8, N = noiseFor(0);
const sparksAt = [0.62, 1.02, 1.42];
const boltCache = new Map(), outlineCache = new Map();

// Flattened ground ring, clipped explicitly because it expands beyond the 320 px canvas.
// No ellipse primitive here: only the impact flash uses a filled ellipse.
function ring(p, r, width, color) {
  const sy = 0.12, steps = Math.ceil(r * 7);
  for (let i = 0; i < steps; i++) {
    const a = i * Math.PI * 2 / steps, x = Math.round(r * Math.cos(a)), y = Math.round(r * sy * Math.sin(a));
    if (x < -160 || x > 159 || y < TOP || y > 22) continue;
    p.px(x, y, color);
    if (width > 1 && y < 22) p.px(x, y + 1, color);
    if (width > 2 && y > TOP) p.px(x, y - 1, color);
  }
}

// Solid stepped spans, sampled at 2x2. Sampling is coarse; output pixels remain contiguous.
function column(p, t, C, seed) {
  if (t < 0.10 || t >= 2.65) return;
  const down = ease.inCubic(seg(t, 0.10, 0.20));
  let bottom = t < 0.20 ? TOP + 176 * down : 0;
  const top = TOP;
  if (t >= 2.45) bottom = TOP + 176 * (1 - seg(t, 2.45, 2.65));
  if (bottom <= top) return;
  const b = t < 1.6 ? 0 : seg(t, 1.6, 2.1), c = seg(t, 2.1, 2.45);
  const breath = t < 1.6 ? 6 * N(t, 2.86, seed + 15) : 0;
  const topW = t < 1.6 ? 124 + breath : lerp(118, 80, b);
  const baseW = t < 1.6 ? 96 : lerp(96, 72, b);
  const coreShare = lerp(1 / 3, 1 / 5, b);
  const drift = 3 * N(t, 1.5, seed + 8);
  for (let y = TOP; y < Math.ceil(bottom); y += 2) {
    if (y + 2 <= top) continue;
    const start = Math.max(y, Math.ceil(top)), height = Math.min(y + 2, Math.ceil(bottom)) - start;
    if (height <= 0) continue;
    const u = (y - TOP) / 176;
    let w = lerp(topW, baseW, u);
    // Broad slow-moving irregularities keep the silhouette alive, not a noisy pattern.
    w += 2 * Math.sin(u * Math.PI) * N(t + u * 0.4, 1.8, seed + 22);
    if (t >= 2.1) w = lerp(w, 22, c);
    if (t >= 2.45) w = 10;
    const half = Math.round(w / 4) * 2;
    // Disjoint 2px sampled spans avoid repainting the entire cone for every color.
    const bounds = [half, Math.max(0, half - 4), Math.max(0, half - 8), Math.max(0, half - 13), Math.max(0, half - 19), 0];
    for (let band = 0; band < 5; band++) {
      const outer = bounds[band], inner = bounds[band + 1];
      if (outer <= inner) continue;
      p.rect(-outer, start, outer - inner, height, C[band + 1]);
      p.rect(inner, start, outer - inner, height, C[band + 1]);
    }
    // True alpha (never dither) softens the dark-crimson outer edge into transparency.
    for (let yy = start; yy < start + height; yy++) {
      p.blend(-half - 1, yy, C[0], 0.45);
      p.blend(half, yy, C[0], 0.45);
    }
    const cw = t >= 2.45 ? 8 : Math.max(6, w * (t >= 2.1 ? lerp(coreShare, 0.55, c) : coreShare));
    p.rect(Math.round(drift - cw / 2), start, Math.round(cw), height, t < 1.6 ? C[7] : C[6]);
  }
}

// Re-strike at 3-frame intervals, staggering each path. Shared zigzag supplies forks;
// trace draws two opaque pixels without the shared stroke's dithered halo.
function lightning(p, t, C, seed) {
  if (t < 0.10 || t >= 2.45) return;
  const frame = Math.floor((t - 0.10) * 30 + 1e-6);
  const count = t < 0.20 ? 1 : t < 1.60 ? 4 : 2;
  for (let i = 0; i < count; i++) {
    const generation = Math.floor((frame + i) / 3), R = rng(seed, 91, i, generation);
    const side = i % 2 ? 1 : -1, x0 = side * R.range(85, 145);
    const x1 = side * R.range(25, 45), y1 = -R.range(45, 100);
    const key = `${seed}:${i}:${generation}`;
    let paths = boltCache.get(key);
    if (!paths) {
      const b = zigzag(R, x0, TOP + 2, x1, y1, 0.08, 0.08);
      paths = b.paths.map(q => ({ w: q.w, pts: q.pts.map(([x, y]) => [clamp(x, -158, 157), clamp(y, TOP + 1, -40)]) }));
      if (boltCache.size > 300) boltCache.clear();
      boltCache.set(key, paths);
    }
    for (const q of paths) {
      const pts = q.pts;
      trace(p, pts, C[5]);
      if (q.w >= 1) trace(p, pts.map(([x, y]) => [x + 1, y]), C[6]);
    }
  }
}

function sparks(p, t, C, seed) {
  for (let wave = 0; wave < sparksAt.length; wave++) {
    const age = t - sparksAt[wave];
    if (age < 0 || age > 0.55) continue;
    const R = rng(seed, 121, wave);
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1, x0 = side * R.range(20, 44), vx = side * R.range(65, 150), vy = -R.range(75, 150);
      const x = x0 + vx * age, y = -2 + vy * age + 240 * age * age;
      if (y >= 0 || x < -158 || x > 157) continue;
      p.rect(x, y, i % 3 ? 2 : 3, i % 3 ? 2 : 1, age < 0.2 ? C[6] : C[5]);
    }
  }
}

export function drawBack(p, t, o) {
  if (t >= END) return;
  const C = fit(o.palette, 8), seed = o.seed ?? 7;
  if (t < 0.10) p.rect(-30, TOP, 60, 2, C[6]);
  if (t >= 0.20 && t < 2.45) {
    const pr = t < 1.6 ? lerp(40, 110, seg(t, 0.20, 1.6)) : t < 2.1 ? 110 : lerp(110, 30, seg(t, 2.1, 2.45));
    pool(p, 0, 0, pr, 5, C[6], t < 2.1 ? 0.55 : 0.3);
  }
  const r = shockRadius(t);
  if (r !== null && t < 0.90) ring(p, r, 3, C[6]);
  if (t >= 0.90 && t < 2.10) ring(p, 150, t < 1.85 ? 2 : 1, t < 1.6 ? C[5 + (Math.sin(t * 8) > 0 ? 1 : 0)] : C[t < 1.85 ? 5 : 4]);
  column(p, t, C, seed);
  lightning(p, t, C, seed);
  if (t >= 2.10 && t < 2.45) {
    const R = rng(seed, 150), age = t - 2.10;
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1, x = side * R.range(18, 43), y = TOP + R.range(0, 150) + age * R.range(35, 80);
      if (y > TOP && y < -4) p.rect(x, y, 2, Math.min(8, -y), C[3 + (i % 3)]);
    }
  }
  sparks(p, t, C, seed);
  if (t >= 0.20 && t < 0.20 + 2 / 30) p.ellipse(0, 0, 34, 3, C[7]);
  if (t >= 2.65) {
    const age = t - 2.65, R = rng(seed, 177);
    for (let i = 0; i < 15; i++) {
      const x = R.range(-24, 24), y = -R.range(2, 28) - age * R.range(25, 55);
      p.px(x, y, C[6]);
    }
  }
}

export function draw(p, t, o) {
  if (t >= END || !o.actor) return;
  const C = fit(o.palette, 8), frame = Math.floor(t * 30 + 1e-6);
  // Outline the posed stock stand-in. Games should outline their own qilin sprite
  // in the character renderer after drawing the back layer.
  let outline = outlineCache.get(frame);
  if (!outline) {
    const body = posed(poseAt(act.poses, frame / 30)), cells = new Set(), edge = new Set();
    for (let i = 0; i < body.n; i++) cells.add(`${body.xs[i]},${body.ys[i]}`);
    for (let i = 0; i < body.n; i++) {
      const x = body.xs[i], y = body.ys[i];
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
        if (!cells.has(`${x + dx},${y + dy}`)) edge.add(`${x + dx},${y + dy}`);
    }
    outline = [...edge].map(s => s.split(",").map(Number));
    outlineCache.set(frame, outline);
  }
  for (const [x, y] of outline) p.px(x - 70, y, C[6]);
}
