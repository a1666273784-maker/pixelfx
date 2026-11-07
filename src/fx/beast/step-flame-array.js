// 踏炎连环阵: a row of 云雷纹 arrays flickers on across the floor, a bone-and-vermilion afterimage streaks
// the whole width of the screen, and four thick jade-and-fire columns erupt out of the arrays one after
// another. The jade wind sheaths crack off into pixels first, then the fire cores break into floating embers.

import { seg, ease, clamp, lerp, TAU, Rng, rand, smooth } from "../../core/index.js";
import { FIRE, JADE, COOL, GREY, bone, gold, crimson, flame, ember, jade, teal, ink, rampAt, shown, curl, cloud, thunder, pillar, ribbon, flashStar, flight, clipTo } from "./_lib.js";

export const meta = {
  name: "踏炎连环阵 · Stampede Flame Array",
  desc: "Gold cloud-thunder arrays flicker on across the floor, a bone and vermilion afterimage streaks the screen, then four jade and fire columns erupt in sequence and break apart.",
  tags: ["beast", "dash", "array", "boss", "chinese", "fire", "pillars", "one-shot"],
  size: [320, 180],
  origin: [0, 0],
  duration: 2.70,
  loop: false,
  fps: 24,
  bg: "dark",
  options: { seed: 7, hit: true },
};

const G = 146;
const COLS = [56, 126, 196, 266];
const A = { cast: 0.56, dash: 0.60, dashEnd: 0.74, first: 0.78, gap: 0.10, out: 1.62, end: 2.66 };

export const shake = (t) => {
  let x = 0, y = 0;
  for (let i = 0; i < 4; i++) {
    const t0 = A.first + i * A.gap;
    const k = Math.pow(1 - seg(t, t0, t0 + 0.24), 2);
    if (k <= 0) continue;
    x += Math.round(Math.sin(t * (88 + i * 7) + i) * 5 * k);
    y += Math.round(Math.cos(t * 63 + i * 2) * 3 * k);
  }
  const d = Math.pow(1 - seg(t, A.dash, A.dash + 0.2), 2);
  if (d > 0) x += Math.round(Math.sin(t * 110) * 4 * d);
  return [x, y];
};

function makeBits(seed) {
  const R = new Rng(seed);
  const b = { motes: [], shards: [], embers: [], smoke: [], dust: [] };
  for (let i = 0; i < 40; i++) b.motes.push({ a: R.range(0, TAU), r0: R.range(30, 62), ph: R.range(0, A.cast), col: R.next() < 0.5 });
  for (let i = 0; i < 70; i++) {
    const c = i % 4;
    b.shards.push({ c, t0: A.first + c * A.gap + 0.1 + R.next() * 0.3, life: R.range(0.35, 0.9), a: R.range(-Math.PI, Math.PI), sp: R.range(20, 90), y: R.range(0, 1), jade: R.next() < 0.75, sz: R.next() < 0.3 ? 2 : 1 });
  }
  for (let i = 0; i < 80; i++) {
    const c = i % 4;
    b.embers.push({ c, t0: A.first + c * A.gap + 0.35 + R.next() * 0.5, life: R.range(0.4, 1.0), x: R.range(-12, 12), y: R.range(0, 1), vy: -R.range(6, 40), ph: R.range(0, TAU) });
  }
  for (let i = 0; i < 34; i++) {
    const c = i % 4;
    b.smoke.push({ c, t0: A.out + R.next() * 0.35, life: R.range(0.3, 0.62), x: R.range(-10, 10), y: R.range(0, 1), vy: -R.range(8, 34), ph: R.range(0, TAU), r: R.range(3, 6) });
  }
  for (let i = 0; i < 30; i++) b.dust.push({ t0: A.first + (i % 4) * A.gap, life: R.range(0.2, 0.45), x: R.range(-22, 22), vy: -R.range(10, 60), vx: R.range(-50, 50), ph: R.range(0, TAU) });
  return b;
}
const B = makeBits(23);

// ---- the ground array under one pillar: a ring of cloud-thunder glyphs, flickering on
function array(p, x, t, k, seed) {
  if (k <= 0.02) return;
  const ry = 7;
  // the ring, drawn as a broken ellipse with runes on it
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * TAU;
    const on = Math.sin(a * 6 - t * 7 + seed) > -0.4 - k * 0.4;
    if (!on) continue;
    if (!shown(x, G, k * (0.6 + 0.4 * Math.sin(a * 3 + t * 5)))) continue;
    const px = x + Math.cos(a) * 27, py = G - 1 + Math.sin(a) * ry;
    p.px(px, py, i % 3 ? gold : (i % 6 === 0 ? bone : crimson));
    if (i % 4 === 0) p.px(px, py - 1, k > 0.6 ? gold : ember);
  }
  // the glyphs sat on the ring
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + t * 0.9 + seed;
    const px = x + Math.cos(a) * 17, py = G - 1 + Math.sin(a) * ry * 0.7;
    if (!shown(px, py, k)) continue;
    thunder(p, px - 4, py - 8, 8, i % 2 ? gold : flame, { a: k });
  }
  // a smouldering patch of floor inside
  for (let yy = -ry; yy <= 2; yy++)
    for (let xx = -26; xx <= 26; xx++) {
      const d = Math.hypot(xx / 26, yy / ry);
      if (d > 1) continue;
      if (!shown(x + xx, G + yy, (1 - d) * 0.85 * k)) continue;
      p.px(x + xx, G + yy, d > 0.72 ? ember : d > 0.4 ? crimson : flame);
    }
}

// ---- the dash: a rushing wedge of bone and wind, four jade curls streaming off it
function dash(p, t) {
  const k = seg(t, A.dash, A.dashEnd);
  if (k >= 1) return;
  const x = lerp(-40, 355, ease.inOutCubic(k)), y = 102;
  const head = 1 - seg(t, A.dashEnd - 0.08, A.dashEnd + 0.10);
  if (head <= 0) return;
  // the wedge: a tapering blade of air behind the head, bone at the front, fire in the wake
  for (let i = 0; i < 96; i++) {
    const u = i / 96;
    const bx = x - i * 1.5, by = y + Math.sin(u * 2.2 + t * 10) * 9 * Math.pow(u, 1.4) + u * 6;
    const w = Math.pow(1 - u, 1.5) * 8 * head + 1;
    for (let q = -w; q <= w; q++) {
      const v = Math.abs(q) / w;
      if (v > 1) continue;
      const heat = (1 - Math.pow(v, 0.6)) * (1 - u * 0.9);
      if (u > 0.3 && !shown(bx, by + q, (1 - u) * 1.7 * head)) continue;
      const c = heat > 0.82 ? bone : heat > 0.6 ? gold : heat > 0.4 ? flame : heat > 0.2 ? crimson : ember;
      p.px(bx, by + q, c);
    }
  }
  // four jade curls streaming off the back of the wedge
  for (let c = 0; c < 4; c++) {
    const u = 0.18 + c * 0.2;
    const bx = x - u * 190, by = y + Math.sin(u * 2.6 + t * 10) * 6 * u + (c % 2 ? -1 : 1) * (6 + c * 2);
    curl(p, bx, by, 4 + c * 1.2, t * 4 + c, (vv) => (vv > 0.55 ? jade : teal), { w: 2, sy: 0.9 });
    for (let q = 0; q < 3; q++) p.px(bx - 4 - q * 2, by + q, teal);
  }
  // filigree on the top edge and sparks flying forward
  for (let i = 0; i < 24; i++) {
    const u = i / 24;
    const bx = x - u * 120, by = y - 10 - Math.sin(u * 3 + t * 12) * 3;
    if (!shown(bx, by, head)) continue;
    p.px(bx, by, u > 0.65 ? gold : bone);
  }
  for (let i = 0; i < 22; i++) {
    const age = t - A.dash - rand(i, 4) * 0.10;
    if (age < 0 || age > 0.3) continue;
    const sx = x + 4 + rand(i, 5) * 40, sy = y + (rand(i, 7) - 0.5) * 26;
    if (!shown(sx, sy, 1 - age / 0.3)) continue;
    p.px(sx, sy, age < 0.1 ? bone : age < 0.2 ? gold : flame);
    if (age < 0.14) p.px(sx + 1, sy, gold);
  }
  // the head: a hard bone arrowhead with a star
  for (let i = -7; i <= 7; i++) {
    const w = Math.round(9 - Math.abs(i) * 1.1);
    for (let q = 0; q < w; q++) p.px(x + q * 0.5 - 2, y + i, q < 4 ? bone : gold);
  }
  flashStar(p, x + 4, y, 10 * head + 2, bone, 6, t * 4);
}

export function draw(p, t, o) {
  if (t < 0) return;
  clipTo(p, { x: 2, y: 2, w: 316, h: 176 });
  const hit = o.hit !== false;

  // ---- cast: the arrays flicker on one by one, embers sucked up out of the stone
  if (t < A.dash + 0.05) {
    COLS.forEach((x, i) => {
      const k = seg(t, 0.04 + i * 0.07, 0.30 + i * 0.07);
      array(p, x, t, k, i * 2.1);
    });
    // the row links up: a gold line runs along the floor between the arrays
    const link = seg(t, 0.34, A.cast);
    if (link > 0) {
      const span = (COLS[3] - COLS[0]) * link;
      for (let x = COLS[0]; x <= COLS[0] + span; x++) {
        if (!shown(x, G + 1, 0.9)) continue;
        p.px(x, G + 1, (x >> 2) % 2 ? gold : flame);
        if ((x & 1) === 0) p.px(x, G + 2, ember);
      }
      for (let i = 0; i < 26; i++) {
        const a = rand(i, 11) * TAU;
        const rr = 40 * (1 - link) + 4;
        const x = lerp(COLS[0], COLS[3], rand(i, 12)) + Math.cos(a) * rr;
        const y = G - 4 + Math.sin(a) * rr * 0.3;
        if (!shown(x, y, link)) continue;
        p.px(x, y, i % 3 ? gold : jade);
      }
    }
    // the motes pulled up out of the arrays while they charge
    for (const q of B.motes) {
      const life = seg(t, q.ph, q.ph + 0.3);
      if (life <= 0 || life >= 1) continue;
      const x = COLS[Math.floor(q.a) % 4] + Math.cos(q.a * 3) * (q.r0 * (1 - life) + 4);
      const y = G - 2 - life * 26 * (0.4 + q.r0 / 90);
      if (!shown(x, y, 1 - life * 0.7)) continue;
      p.px(x, y, life > 0.6 ? (q.col ? gold : bone) : life > 0.3 ? flame : (q.col ? jade : crimson));
    }
    // the array flares just before the dash
    if (t > A.cast - 0.06) {
      for (const x of COLS) {
        const q = seg(t, A.cast - 0.06, A.cast + 0.04);
        flashStar(p, x, G - 4, 8 * (1 - q) + 2, bone, 4, 0.3);
      }
    }
  }
  dash(p, t);

  // ---- the four columns, one after another out of each array
  COLS.forEach((x, i) => {
    const t0 = A.first + i * A.gap;
    if (t < t0) return;
    const rise = ease.outBack(seg(t, t0, t0 + 0.16));
    const down = seg(t, A.out + i * 0.04, A.end - 0.06);
    const hUp = (hit ? 128 + (i % 2) * 14 : 74 + (i % 2) * 10) * rise;
    const heat = 1 - down * (hit ? 0.85 : 1.05);
    const h = hUp * (hit ? Math.pow(1 - down, 1.6) : Math.pow(1 - down, 3.2));
    // the ground ring it broke out of
    const ring = seg(t, t0, t0 + 0.32);
    if (ring < 1) {
      const rr = 12 + ease.outQuart(ring) * 46;
      const f = 1 - ring;
      for (let q = 0; q < 90; q++) {
        const a = (q / 90) * TAU;
        if (!shown(x, G, f)) continue;
        p.px(x + Math.cos(a) * rr, G - 1 + Math.sin(a) * rr * 0.26, q % 3 ? gold : f > 0.4 ? bone : crimson);
      }
    }
    if (h < 3) return;
    const wid = (21 + (i % 2) * 3) * Math.min(1, rise);
    // the jade wind sheath, outside the fire, breaking into pixels first
    const sheathFade = 1 - seg(t, A.out - 0.16 + i * 0.05, A.out + 0.14 + i * 0.05) * (hit ? 1 : 1.6);
    if (sheathFade > 0) {
      for (let q = 0; q < 70; q++) {
        const u = (q / 70 + t * 0.4 + i * 0.13) % 1;
        const yy = G - u * h;
        const ww = wid * 1.45 * Math.pow(1 - u, 0.6);
        const a2 = u * 13 + q * 2.2;
        const sx = x + Math.cos(a2) * ww, sy = yy + Math.sin(a2) * ww * 0.12;
        if (!shown(sx, sy, sheathFade * (1 - u * 0.3))) continue;
        p.px(sx, sy, u > 0.6 ? teal : jade);
        if (q % 5 === 0) p.px(sx + 1, sy, teal);
      }
    }
    // each column breathes and leans its own way, so four of them never read as a fence
    const lean = (i - 1.5) * 0.16;
    const hh = h * (1 + Math.sin(t * 5.5 + i * 1.7) * 0.035);
    pillar(p, x + Math.sin(t * 3.1 + i) * 3, G, hh, wid * (1 + Math.sin(t * 4 + i) * 0.06), t, i * 2.3, { heat, taper: 0.56, outer: JADE, twist: 8 + i, sway: 1 + i * 0.2 });
    // the inner spiral of light: gold beads running up the core
    for (let q = 0; q < 22; q++) {
      const u = ((q / 22) + t * 0.9) % 1;
      const ww = wid * 0.4 * Math.pow(1 - u, 0.7);
      const sx = x + Math.sin(u * 10 + q) * ww;
      const sy = G - u * h;
      if (!shown(sx, sy, Math.min(1, sheathFade + 0.5))) continue;
      p.px(sx, sy, u > 0.72 ? gold : bone);
      p.px(sx, sy + 1, gold);
    }
    // the torn mouth of the ground
    for (let q = 0; q < 20; q++) {
      const xx = x + rand(q, i, 4) * wid * 2.2 - wid * 1.1;
      const yy = G - rand(q, i, 5) * 9 - 1;
      p.px(xx, yy, rand(q, i, 6) > 0.45 ? gold : flame);
    }
    // dust kicked out along the floor as it rises
    for (const d of B.dust) {
      if (d.t0 !== t0) continue;
      const age = t - d.t0;
      if (age < 0 || age > d.life) continue;
      const u = age / d.life;
      const dx = x + d.x + d.vx * age, dy = G - 2 + d.vy * age + 180 * age * age;
      if (!shown(dx, dy, (1 - u) * 0.9)) continue;
      p.px(dx, dy, u < 0.4 ? gold : u < 0.7 ? flame : ember);
    }
  });

  // ---- the breakup: jade shards crack off first, the fire cores break into floating embers
  for (const s of B.shards) {
    const age = t - s.t0;
    if (age < 0 || age > s.life) continue;
    const u = age / s.life;
    const x0 = COLS[s.c], y0 = G - s.y * 110;
    const sp = s.sp * (0.5 + u);
    const px = x0 + Math.cos(s.a) * sp * age, py = y0 + Math.sin(s.a) * sp * age * 0.8 + 90 * age * age;
    if (u > 0.65 && !shown(px, py, (1 - u) / 0.35)) continue;
    const c = s.jade ? (u > 0.5 ? teal : jade) : u > 0.5 ? ember : flame;
    for (let q = 0; q < s.sz; q++) p.px(px + q, py, q ? ember : c);
    if (u < 0.4) p.px(px, py - 1, s.jade ? bone : gold);
  }
  for (const e of B.embers) {
    const age = t - e.t0;
    if (age < 0 || age > e.life) continue;
    const u = age / e.life;
    const x0 = COLS[e.c] + e.x;
    const y0 = G - e.y * 110 - age * 8;
    const px = x0 + Math.sin(age * 3 + e.ph) * 9;
    const py = y0 + e.vy * age * 0.6;
    if (u > 0.55 && !shown(px, py, (1 - u) / 0.45)) continue;
    const c = u < 0.3 ? gold : u < 0.55 ? flame : u < 0.78 ? crimson : ember;
    p.px(px, py, c);
    if (u < 0.35) p.px(px, py - 1, bone);
  }
  // and what is left of the columns
  for (const s of B.smoke) {
    const age = t - s.t0;
    if (age < 0 || age > s.life) continue;
    const u = age / s.life;
    const rr = s.r * (1 + u * 1.2);
    const col = (v) => (u < 0.2 ? rampAt([ember, crimson, flame], v) : v > 0.62 ? jade : v > 0.34 ? teal : ink);
    if (t > A.end - 0.16) continue;
    cloud(p, COLS[s.c] + s.x * 0.6 + Math.sin(age * 2 + s.ph) * 4, G - s.y * 92 + s.vy * age, rr * 0.8, s.ph + age * 3, col, { solid: u > 0.15, a: (1 - Math.max(0, (u - 0.42) / 0.58)) * 0.95 });
  }
}
