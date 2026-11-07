// 赤金裂爪: a three-hit claw combo. A downward crescent of flame with a gold filigree rim, an X of jade
// wind and red fire with a bone impact frame, and a ground smash that sends gold rune waves out along the
// floor and three twisting fire columns up out of it. Nothing but the boss's own eight colours.

import { seg, smooth, ease, clamp, lerp, TAU, Rng, rand } from "../../core/index.js";
import { FIRE, JADE, COOL, GREY, bone, gold, crimson, flame, ember, jade, teal, ink, rampAt, shown, cloud, thunder, cracks, pillar, bagua, ribbon, Field, flashX, flashStar, flight, clipTo } from "./_lib.js";

export const meta = {
  name: "赤金裂爪 · Scarlet Gold Claw",
  desc: "A three-hit claw combo: a flaming crescent with a gold rim, a crossing jade-and-fire X, and a ground smash under three twisting fire columns.",
  tags: ["beast", "melee", "slash", "combo", "boss", "chinese", "fire", "one-shot"],
  size: [320, 180],
  origin: [0, 0],
  duration: 2.72,
  loop: false,
  fps: 24,
  bg: "dark",
  options: { seed: 3, hit: true },
};

const GROUND = 143;
const S1 = { w0: 0.02, hit: 0.28, out: 0.50, end: 0.68 };
const S2 = { w0: 0.68, hit: 0.90, out: 1.10, end: 1.38 };
const S3 = { w0: 1.38, hit: 1.74, out: 2.16, end: 2.60 };
const CX1 = 168, CY1 = 84, R1 = 70;

/** Sparks and shards, evaluated from t alone so any frame can be drawn in any order. */
function makeDebris(seed) {
  const R = new Rng(seed);
  const d = { s1: [], s2: [], s3: [], smoke: [] };
  for (let i = 0; i < 30; i++) {
    const a0 = -2.1 + R.next() * 2.9, r0 = R.range(46, 84);
    d.s1.push({
      t0: S1.hit - 0.04 + R.next() * 0.24, life: R.range(0.42, 0.95),
      x: CX1 + Math.cos(a0) * r0, y: CY1 + Math.sin(a0) * r0,
      vx: Math.cos(a0) * R.range(10, 54) - R.range(14, 40), vy: R.range(-40, 30),
      jade: R.next() < 0.7, sz: R.next() < 0.3 ? 2 : 1,
    });
  }
  for (let i = 0; i < 52; i++) {
    const a = R.range(0, TAU), sp = R.range(36, 250);
    d.s2.push({
      t0: S2.hit - 0.01 + R.next() * 0.06, life: R.range(0.3, 1.0), x: 158, y: 74,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.82 - 40, sz: R.next() < 0.4 ? 2 : 1,
      jade: R.next() < 0.32,
    });
  }
  for (let i = 0; i < 60; i++) {
    const x = 96 + R.next() * 136, t0 = S3.hit + R.next() * 0.22;
    d.s3.push({ x, t0, life: R.range(0.34, 0.66), vx: R.range(-60, 60), vy: -R.range(70, 250), sz: R.next() < 0.35 ? 2 : 1, jade: R.next() < 0.45 });
  }
  for (let i = 0; i < 44; i++) {
    const col = [116, 172, 228][i % 3];
    d.smoke.push({ x: col + R.range(-12, 12), t0: S3.out + 0.02 + R.next() * 0.10, life: R.range(0.20, 0.32), vy: -R.range(14, 46), vx: R.range(-18, 18), r: R.range(3, 6), ph: R.range(0, TAU) });
  }
  return d;
}
const DB = makeDebris(11);
const SHAKE = [
  { t: S1.hit, a: 2.2, d: 0.16 }, { t: S2.hit, a: 3.4, d: 0.2 }, { t: S3.hit, a: 5.5, d: 0.3 },
];
export const shake = (t) => {
  let x = 0, y = 0;
  for (const s of SHAKE) {
    const k = 1 - seg(t, s.t, s.t + s.d);
    if (k <= 0) continue;
    const f = k * k * s.a;
    x += Math.round(Math.sin(t * 96 + s.t * 40) * f);
    y += Math.round(Math.cos(t * 71 + s.t * 30) * f * 0.7);
  }
  return [x, y];
};

// ---- one: the crescent
/**
 * A crescent of hard pixels: outer radius r, tapering from a point at a0 (the tail) to a hot head at a1.
 * fn(u, v) gives the colour (u along the arc, v 0 at the outer rim to 1 at the inner edge).
 */
function crescent(p, cx, cy, r, a0, a1, wmax, fn, alpha) {
  if (wmax < 0.8) return;
  const span = a1 - a0;
  const steps = Math.max(6, Math.ceil(r * Math.abs(span) * 1.4));
  for (let pass = 0; pass < 2; pass++) {
    const off = pass * 0.5;
    for (let i = 0; i <= steps; i++) {
      const u = clamp((i + off) / steps);
      const a = a0 + span * u;
      const shape = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.62);
      const w = wmax * shape;
      if (w < 0.8) continue;
      const ca = Math.cos(a), sa = Math.sin(a);
      const rad = Math.ceil(w);
      for (let q = 0; q <= rad; q++) {
        const v = q / w;
        const c = fn(u, v);
        if (!c) continue;
        const A = alpha ? alpha(u, v) : 1;
        if (A < 1 && !shown(cx + ca * (r - q) + pass * 0.5, cy + sa * (r - q), A)) continue;
        p.px(cx + ca * (r - q), cy + sa * (r - q), c);
      }
    }
  }
}

function hit1(p, t) {
  const cast = seg(t, S1.w0, S1.hit);
  if (t < S1.hit) {
    // wind-up: a narrow gold crescent coils in the dark, jade motes pulled along its sweep
    const a0 = -2.6 + cast * 1.3, span = 0.4 + cast * 1.9;
    const heat = 0.1 + cast * 0.5;
    crescent(p, CX1 + 14, CY1 - 8, 62 + cast * 12, a0, a0 + span, 3 + cast * 3, (u, v) => (heat > 0.45 ? (v < 0.3 ? gold : flame) : v < 0.3 ? gold : ember), (u) => heat * (0.4 + 0.6 * u));
    for (let i = 0; i < 24; i++) {
      const u = rand(i, 5), ph = rand(i, 6);
      const life = seg(t, ph * (S1.hit - 0.06), ph * (S1.hit - 0.06) + 0.14);
      if (life <= 0 || life >= 1) continue;
      const a = a0 + span * u + (1 - life) * 0.45;
      const r = 62 + cast * 12 + (1 - life) * 30;
      const c = life > 0.7 ? bone : life > 0.4 ? (u > 0.5 ? gold : jade) : ember;
      for (let q = 0; q < 4; q++) {
        if (!shown(CX1, CY1, (1 - life) * 0.9 * (1 - q / 4))) continue;
        p.px(CX1 + 14 + Math.cos(a) * (r + q), CY1 - 8 + Math.sin(a) * (r + q), c);
      }
    }
    if (t > S1.hit - 0.07) {
      const a = a0 + span;
      flashStar(p, CX1 + 14 + Math.cos(a) * (74 + cast * 12), CY1 - 8 + Math.sin(a) * (74 + cast * 12), 3, bone, 4, 0.4);
    }
    return;
  }
  // release: the crescent whips down and across, then hangs in the air, narrowing and cooling
  const aStart = -2.1, aEnd = 0.95, full = aEnd - aStart;
  const head = lerp(aStart, aEnd, ease.outExpo(seg(t, S1.hit, S1.hit + 0.11)));
  const decay = seg(t, S1.out, S1.end);
  const span = full * (1 - decay * 0.62) * lerp(0.25, 1, ease.outExpo(seg(t, S1.hit, S1.hit + 0.05)));
  const lo = head - span;
  const fade = 1 - decay;
  if (fade > 0.02 && span > 0.05) {
    const w = lerp(34, 4, decay);
    const heat = lerp(1, 0.3, decay);
    crescent(p, CX1, CY1, R1, lo, head, w, (u, v) => {
      const h = clamp(heat - (1 - u) * 0.55);
      if (v < 0.1) return h > 0.55 ? bone : gold;
      if (v < 0.26) return h > 0.5 ? gold : h > 0.2 ? flame : ember;
      if (v < 0.52) return h > 0.62 ? flame : rampAt(FIRE, 1.2 + h * 2.6);
      if (v < 0.78) return h > 0.5 ? crimson : ember;
      return ink;
    }, (u, v) => (v > 0.62 ? clamp(fade * (0.35 + 0.9 * u)) : 1));
    // 金纹: filigree hairlines riding just outside the rim
    for (let q = 0; q < 2; q++) {
      const rr = R1 + 2.5 + q * 2.7;
      for (let i = 0; i < 52; i++) {
        const u = i / 51, a = lerp(lo, head, u) - q * 0.05;
        if (a < lo) continue;
        const h = clamp(heat - (1 - u) * 0.7);
        if (h <= 0.12 || (i + q) % 4 === 0) continue;
        p.px(CX1 + Math.cos(a) * rr, CY1 + Math.sin(a) * rr, h > 0.5 ? gold : ember);
      }
    }
    // flame licking off the outer rim
    for (let i = 0; i < 30; i++) {
      const u = i / 29, a = lerp(lo, head, u);
      const h = clamp(heat - (1 - u) * 0.6);
      if (h < 0.35) continue;
      const fl = 2 + Math.abs(Math.sin(a * 7 + t * 40)) * 5 * h;
      for (let q = 1; q < fl; q++) {
        if (!shown(CX1, CY1, (1 - q / fl) * h)) break;
        p.px(CX1 + Math.cos(a) * (R1 + 2 + q), CY1 + Math.sin(a) * (R1 + 2 + q), q < fl * 0.4 ? gold : flame);
      }
    }
    // the tines: hot notches that lead the stroke and the two that trail it
    const k2 = 1 - seg(t, S1.hit, S1.out + 0.1);
    if (k2 > 0) {
      for (let q = -1; q <= 1; q++) {
        const a = head + q * 0.10, rr = R1 - 6 + q * 8;
        flashStar(p, CX1 + Math.cos(a) * rr, CY1 + Math.sin(a) * rr, 2 + 4 * k2, q ? gold : bone, 4, a);
      }
      // the first frame of the cut: a hard bone glint across the head of the arc
      if (t < S1.hit + 0.05) {
        const a = head;
        for (let i = 0; i < 18; i++) {
          const aa = a - i * 0.04, rr = R1 - 1 - i * 0.45;
          p.px(CX1 + Math.cos(aa) * rr, CY1 + Math.sin(aa) * rr, i < 5 ? bone : i < 12 ? gold : flame);
        }
      }
    }
    // rake: three notches torn out of the inner edge, so the crescent reads as claw marks
    for (let q = 0; q < 3; q++) {
      const uc = 0.34 + q * 0.22;
      const a0 = lerp(lo, head, uc);
      for (let i = 0; i < 7; i++) {
        const aa = a0 + i * 0.012;
        for (let k3 = 0; k3 < 3; k3++) {
          if (!shown(CX1, CY1, fade)) break;
          p.px(CX1 + Math.cos(aa) * (R1 - k3), CY1 + Math.sin(aa) * (R1 - k3), ink);
        }
      }
    }
  }
  // jade debris shaken off the arc, falling and bouncing
  for (const s of DB.s1) {
    const age = t - s.t0;
    if (age < 0 || age > s.life) continue;
    const u = age / s.life;
    const [x, y] = flight(s.x, s.y, s.vx, s.vy, 420, age, GROUND, 0.35);
    if (u > 0.6 && !shown(x, y, (1 - u) / 0.4)) continue;
    const c = s.jade ? (u > 0.5 ? teal : jade) : rampAt(COOL, u * 0.8);
    for (let q = 0; q < s.sz; q++) p.px(x + q, y, q && u > 0.4 ? ember : c);
  }
}

// ---- two: the crossing X
const CX = 158, CY = 80, XLEN = 112, XW = 26;
function hit2(p, t) {
  if (t < S2.hit) {
    // wind-up: two cold blades pull apart along their diagonals, then snap back together
    const k = seg(t, S2.w0, S2.hit);
    const pull = ease.outCubic(k);
    for (let s = 0; s < 2; s++) {
      const dir = s ? 1 : -1, sgn = 1;
      const len = 16 + pull * 52;
      const ux = dir * 0.82, uy = dir * 0.57 * (s ? 1 : 1) * (s ? 1 : 1);
      const ay = s ? CY + len * 0.57 : CY - len * 0.57, by = s ? CY - len * 0.57 : CY + len * 0.57;
      const ax = CX - dir * len * 0.82, bx = CX + dir * len * 0.82;
      const a = Math.min(1, k * 2.4);
      ribbon(p, ax, ay, bx, by, 7 + pull * 5, (u, v) => {
        if (v < 0.28) return s ? jade : flame;
        if (v < 0.62) return s ? teal : crimson;
        return ember;
      }, { bow: dir * 3, a: a * 0.85 });
      for (let i = 0; i < 14; i++) {
        const u = 0.08 + i * 0.06;
        if (!shown(CX, CY, a)) break;
        p.px(lerp(ax, bx, u) - uy * 3, lerp(ay, by, u) + ux * 3, i % 2 ? gold : ember);
      }
    }
    // motes pulled into the crossing point
    for (let i = 0; i < 40; i++) {
      const u = rand(i, 21);
      const life = seg(t, S2.w0 + u * 0.13, S2.w0 + u * 0.13 + 0.16);
      if (life <= 0 || life >= 1) continue;
      const a = rand(i, 22) * TAU + life * 5, r = 78 * (1 - ease.inQuad(life));
      for (let q = 0; q < 3; q++) {
        const rr = r + q * 3.2;
        const c = q ? (u > 0.5 ? teal : ember) : life > 0.6 ? (u > 0.5 ? jade : flame) : gold;
        p.px(CX + Math.cos(a) * rr * 0.95, CY + Math.sin(a) * rr * 0.78, c);
      }
    }
    if (t > S2.hit - 0.06) flashStar(p, CX, CY, 3 + 5 * seg(t, S2.hit - 0.06, S2.hit), bone, 8, t * 3);
    return;
  }
  // contact: one hard bone-white X with a cross of light, held for a single frame
  const k = seg(t, S2.hit, S2.hit + 0.08);
  const fade = 1 - seg(t, S2.out, S2.end);
  const bloom = smooth(0, 0.045, t - S2.hit);
  if (fade > 0) {
    const reach = lerp(38, XLEN, ease.outQuart(seg(t, S2.hit, S2.out))) * (0.6 + 0.4 * fade);
    const w = XW * lerp(1.15, 1, seg(t, S2.hit, S2.out)) * (0.25 + 0.75 * fade);
    for (let s = 0; s < 2; s++) {
      const ux = 0.82, uy = s ? 0.57 : -0.57;
      const ax = CX - ux * reach, ay = CY - uy * reach;
      const bx = CX + ux * reach, by = CY + uy * reach;
      // one cut is jade wind, the other is red fire: bone edge on top, deep ink in the wake
      ribbon(p, ax, ay, bx, by, w, (u, v) => {
        const h = fade * (0.5 + 0.5 * Math.sin(Math.PI * u)) * bloom;
        if (v < 0.2) return h > 0.42 ? bone : s ? jade : gold;
        if (v < 0.48) return s ? (h > 0.3 ? jade : teal) : h > 0.3 ? flame : crimson;
        if (v < 0.74) return s ? teal : h > 0.24 ? crimson : ember;
        return ink;
      }, { bow: (s ? 1 : -1) * 7, a: 1, skew: 1.15 });
      // filigree ticks along the lit edge
      for (let i = 1; i < 22; i++) {
        const u = i / 22, nx = -uy, ny = ux;
        if (!shown(CX, CY, fade)) break;
        const ww = w * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(u, 1.15)), 0.55);
        p.px(lerp(ax, bx, u) + nx * (ww + 1), lerp(ay, by, u) + ny * (ww + 1), i % 2 ? gold : ember);
      }
      // shards skidding off the stroke
      for (let q = 0; q < 9; q++) {
        const u = 0.12 + rand(q, s, 3) * 0.86;
        const age = t - (S2.hit + 0.02 + rand(q, s, 4) * 0.12);
        if (age < 0 || age > 0.55) continue;
        const f = age / 0.55;
        const px = lerp(ax, bx, u) + ux * age * 155 * (0.35 + rand(q, s, 5));
        const py = lerp(ay, by, u) + uy * age * 155 * (0.35 + rand(q, s, 5)) - age * 40;
        for (let b = 0; b < 5; b++) p.px(px - b * 3.4 * ux, py - b * 3.4 * uy, b > 2 ? teal : f > 0.4 ? jade : bone);
      }
    }
    if (t < S2.out + 0.1) flashStar(p, CX, CY, 14 * (1 - seg(t, S2.hit, S2.out + 0.1)) + 2, bone, 4, 0.785);
  }
  // the impact frame sits on top of everything: a bone X, a cross of light, then it tears open
  if (t < S2.hit + 0.06) {
    const q = seg(t, S2.hit, S2.hit + 0.06);
    const rr = 34 + 26 * (1 - q);
    for (let s = 0; s < 2; s++) {
      const uy = s ? 0.57 : -0.57;
      for (let i = -rr; i <= rr; i++) {
        const w = Math.max(1, Math.round(4 * (1 - Math.abs(i) / rr)));
        for (let k2 = 0; k2 < w; k2++) p.px(CX + i * 0.82, CY + i * uy - k2, bone);
      }
    }
    const hl = 46 * (1 - q) + 10;
    p.rect(CX - hl, CY - 1, hl * 2, 3, bone);
    p.rect(CX - 1, CY - hl * 0.8, 3, hl * 1.6, gold);
    p.rect(CX - hl * 0.7, CY - 1, hl * 1.4, 1, gold);
  }
  // sparks: radial, gravity, bounces off the floor
  for (const q of DB.s2) {
    const age = t - q.t0;
    if (age < 0 || age > q.life) continue;
    const u = age / q.life;
    const [x, y] = flight(q.x, q.y, q.vx, q.vy, 460, age, GROUND, 0.45);
    if (u > 0.7 && !shown(x, y, (1 - u) / 0.3)) continue;
    const c = u > 0.55 ? ember : q.jade ? (u > 0.25 ? teal : jade) : rampAt(COOL, u * 0.8);
    for (let i = 1; i <= q.sz + 1; i++) {
      const bx = Math.round(x - q.vx * 0.004 * i), by = Math.round(y - q.vy * 0.004 * i);
      if (i > q.sz) { if (u < 0.5) p.px(bx, by, ember); } else p.px(bx, by, c);
    }
  }
}

// ---- three: the ground smash
const COLS = [114, 172, 230];
function hit3(p, t) {
  const g = GROUND;
  if (t < S3.hit) {
    // the floor gathers: a gold cloud-thunder array, embers pulled up out of the stone
    const k = seg(t, S3.w0, S3.hit);
    const r = 22 + 34 * ease.outCubic(k);
    for (let y = g - 12; y <= g + 4; y++)
      for (let x = 160 - r * 1.5; x <= 160 + r * 1.5; x++) {
        const d = Math.hypot((x - 160) / (r * 1.5), (y - g) / (r * 0.3));
        if (d > 1) continue;
        if (!shown(x, y, (1 - d) * 0.6 * k)) continue;
        p.px(x, y, d > 0.72 ? ember : d > 0.4 ? crimson : flame);
      }
    bagua(p, 160, g - 1, r * 0.72, t * 1.5, t, { a: Math.min(1, k * 1.6) });
    for (let i = 0; i < 22; i++) {
      const a = rand(i, 31) * Math.PI * 2, ph = rand(i, 32);
      const life = seg(t, S3.w0 + ph * 0.14, S3.hit - 0.02);
      if (life <= 0 || life >= 1) continue;
      const rr = lerp(84, 5, ease.inQuad(life));
      const c = life > 0.8 ? bone : life > 0.5 ? gold : i % 3 ? crimson : jade;
      for (let q = 0; q < 4; q++) p.px(160 + Math.cos(a) * (rr + q * 3) * 1.45, g - 3 + Math.sin(a) * (rr + q * 3) * 0.3, q > 1 ? ember : c);
    }
    return;
  }
  const k = seg(t, S3.hit, S3.hit + 0.06);
  const out = seg(t, S3.hit, S3.out);
  // contact: one frame of bone-white light along the floor
  if (t < S3.hit + 0.06) {
    const w = 66 * (1 - k) + 14;
    p.rect(160 - w, g - 2, w * 2, 3, bone);
    p.rect(160 - w - 10, g - 4, w * 2 + 20, 1, gold);
    flashStar(p, 160, g - 3, 18 * (1 - k) + 5, bone, 6, 0);
  }
  // gold rune shockwaves running out along the floor: a rising crest, then a skidding skirt
  for (let s = -1; s <= 1; s += 2) {
    for (let row = 0; row < 2; row++) {
      const delay = row * 0.06;
      const p2 = seg(t, S3.hit + delay, S3.hit + 0.46 + delay);
      if (p2 <= 0 || p2 >= 1) continue;
      const reach = ease.outQuart(p2) * 162;
      const fade = Math.pow(1 - p2, 0.65);
      const scale = 1 - row * 0.35;
      for (let x = 0; x <= reach; x += 1) {
        const X = 160 + s * x;
        const front = clamp((reach - x) / 20); // 0 at the crest, 1 far behind it
        const jag = (Math.sin(x * 0.36 + s * 2.1) * 0.5 + 0.5) * 0.55 + (Math.sin(x * 0.11) * 0.5 + 0.5) * 0.45;
        const h = Math.max(1, (2 + 14 * Math.pow(1 - front, 1.5) * (0.55 + jag * 0.7)) * scale * fade);
        const a = fade * (0.6 + 0.4 * (1 - front));
        if (!shown(X, g - h, a)) continue;
        const hot = 1 - front;
        for (let y = 1; y <= h; y++) {
          const v = y / h;
          if (v < 0.35 && !shown(X, g - y, a)) continue;
          const c = v > 0.86 ? (hot > 0.35 ? bone : gold) : v > 0.62 ? (hot > 0.2 ? gold : flame) : v > 0.32 ? flame : crimson;
          p.px(X, g - y, c);
        }
        p.px(X, g - h - 1, hot > 0.3 ? gold : ember);
        if (x % 3 !== 0) p.px(X, g + 1, ember);
        if (x % 5 !== 0) p.px(X, g + 2, crimson);
      }
      // 云雷纹 glyphs marching on the crest of the wave
      for (let i = 0; i < 7; i++) {
        const gx = reach - 8 - i * 22;
        if (gx < 0) continue;
        const X = 160 + s * gx;
        const jag = (Math.sin(gx * 0.36 + s * 2.1) * 0.5 + 0.5) * 0.55 + (Math.sin(gx * 0.11) * 0.5 + 0.5) * 0.45;
        const h = (2 + 14 * Math.pow(clamp(1 - (reach - gx) / 20), 1.5) * (0.55 + jag * 0.7)) * scale * fade;
        thunder(p, X - 3, g - h - 10, 6 + (i % 2), i % 3 ? gold : flame, { a: fade * (1 - i / 9) });
        if (i % 2 === 0) thunder(p, X + 5 * s, g - h - 2, 4, jade, { a: fade * 0.75 });
      }
    }
  }
  const sc = 1 - seg(t, S3.hit + 0.3, S3.end) ** 1.4;
  cracks(p, 160, g - 1, 172, seg(t, S3.hit, S3.hit + 0.24), 7, sc > 0.5 ? gold : ember, sc);
  cracks(p, 160, g - 1, 124, seg(t, S3.hit + 0.08, S3.hit + 0.4), 9, sc > 0.5 ? gold : ember, sc * 0.95);
  // three fire columns, each a beat after the last
  COLS.forEach((x, i) => {
    const t0 = S3.hit + 0.02 + i * 0.07;
    const rise = ease.outBack(seg(t, t0, t0 + 0.18));
    const down = seg(t, S3.out - 0.06 + i * 0.05, S3.end - 0.12);
    const h = (112 + i * 8) * rise * Math.pow(1 - down, 1.5);
    if (h < 2) return;
    const heat = 1 - down * 0.85;
    const wid = (22 + i * 4) * Math.min(1, rise);
    pillar(p, x, g, h, wid, t, i * 3.7, { heat, taper: 0.6, outer: i === 1 ? JADE : null, twist: 7 });
    // a jade wind sheath spiralling round the column
    for (let q = 0; q < 22; q++) {
      const u = ((q / 22) + t * 0.65 + i * 0.2) % 1;
      const yy = g - u * h;
      const ww = wid * 1.05 * Math.pow(1 - u, 0.55);
      const aa = u * 9 + q;
      if (!shown(x, yy, (1 - down) * (1 - u * 0.4))) continue;
      p.px(x + Math.cos(aa) * ww, yy, u > 0.7 ? teal : jade);
      p.px(x + Math.cos(aa) * ww, yy - 1, u > 0.4 ? teal : jade);
    }
    for (let q = 0; q < 16; q++) {
      const xx = x + rand(q, i, 9) * wid * 2.2 - wid * 1.1;
      const y = g - rand(q, i, 8) * 8;
      p.px(xx, y, rand(q, i, 7) > 0.5 ? gold : flame);
    }
  });
  // the floor left hot, cooling from the middle out
  if (out > 0 && out < 0.86) {
    for (let y = g - 5; y <= g + 4; y++)
      for (let x = 160 - 190; x <= 160 + 190; x++) {
        const d = Math.hypot((x - 160) / 190, (y - g) / 9);
        if (d > 1) continue;
        if (!shown(x, y, (1 - d) * (1 - out / 0.86) * 0.85)) continue;
        p.px(x, y, d < 0.4 ? (out < 0.5 ? gold : ember) : ember);
      }
  }
  // debris and cinders thrown up, then falling back through the columns
  for (const q of DB.s3) {
    const age = t - q.t0;
    if (age < 0 || age > q.life) continue;
    const u = age / q.life;
    const [x, y] = flight(q.x, g - 4, q.vx, q.vy, 460, age, GROUND + 1, 0.4);
    if (u > 0.6 && !shown(x, y, (1 - u) / 0.4)) continue;
    const c = u > 0.6 ? ember : q.jade ? (u < 0.25 ? bone : jade) : rampAt(COOL, u * 0.9);
    for (let i = 0; i < q.sz; i++) p.px(x + i, y, i ? ember : c);
  }
  // what the columns become
  for (const q of DB.smoke) {
    const age = t - q.t0;
    if (age < 0 || age > q.life) continue;
    const u = age / q.life, r = q.r * (1 + u * 1.6);
    cloud(p, q.x + q.vx * age, q.y + q.vy * age, r, q.ph + age * 2, (uu) => (u < 0.3 ? rampAt([bone, gold, flame, crimson, ember, ink], u * 3 + uu) : GREY[clamp(Math.floor(u * 4 + uu * 2), 0, 3)]), { a: (1 - u) * 0.9 });
  }
}

export function draw(p, t, o) {
  if (t < 0) return;
  clipTo(p, { x: 10, y: 4, w: 300, h: 172 });
  hit1(p, t);
  hit2(p, t);
  hit3(p, t);
}
