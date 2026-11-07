// 山海焚天·万象瑞火: the boss's ultimate. The screen darkens, a giant gold 八卦祥云阵 unfolds in the
// middle and the world's energy is torn into it, then meteors of scarlet fire and jade wind pour down the
// diagonals, the floor tears open in gold, and a sea of cloud-fire rolls across the bottom. It all recedes
// into a sky full of rising sparks.

import { seg, ease, clamp, lerp, TAU, Rng, rand, smooth, noise } from "../../core/index.js";
import { FIRE, JADE, COOL, GREY, bone, gold, crimson, flame, ember, jade, teal, ink, rampAt, shown, curl, cloud, thunder, cracks, bagua, ribbon, flashStar, flight, clipTo } from "./_lib.js";

export const meta = {
  name: "山海焚天 · Sky Burning",
  desc: "The screen darkens, a giant gold bagua drinks the world in, then fire meteors pour down the diagonals and a sea of cloud fire rolls across the floor.",
  tags: ["beast", "ultimate", "fullscreen", "boss", "chinese", "fire", "meteor", "one-shot"],
  size: [320, 180],
  origin: [0, 0],
  duration: 4.40,
  loop: false,
  fps: 24,
  bg: "dark",
  options: { seed: 13, hit: true },
};

const G = 148;
const CX = 160, CY = 78;
const P = { cast: 1.10, flash: 1.12, rain: 1.20, rainEnd: 2.55, sea: 1.55, ebb: 2.72, embers: 2.55, end: 4.36 };

export const shake = (t) => {
  let x = 0, y = 0;
  // the cast builds a tremble
  const build = seg(t, 0.5, P.flash) * 1.6;
  if (t < P.flash) return [Math.round(Math.sin(t * 80) * build), Math.round(Math.cos(t * 61) * build * 0.6)];
  // the release is one big shove, then every meteor landing kicks again
  const big = Math.pow(1 - seg(t, P.flash, P.flash + 0.34), 2) * 9;
  x += Math.round(Math.sin(t * 96) * big);
  y += Math.round(Math.cos(t * 74) * big * 0.7);
  for (const m of METEORS) {
    const k = Math.pow(1 - seg(t, m.land, m.land + 0.22), 2);
    if (k <= 0) continue;
    x += Math.round(Math.sin(t * (110 + m.i * 9) + m.i) * 5 * k);
    y += Math.round(Math.cos(t * (83 + m.i * 7)) * 4 * k);
  }
  return [x, y];
};

// ---- the meteors: big, slow-headed, crossing on the diagonal and bursting where they land
const METEORS = (() => {
  const R = new Rng(29), out = [];
  for (let i = 0; i < 13; i++) {
    const dir = i % 2 ? -1 : 1; // comes in from the right or the left
    const land = P.rain + 0.05 + i * 0.105 + R.next() * 0.03;
    const lx = 24 + ((i * 71) % 272) + R.next() * 16;
    const sx = dir > 0 ? lx + 150 : lx - 150, sy = -14 - R.next() * 26;
    out.push({ i, dir, land, lx, sx, sy, r: 13 + R.next() * 6, jade: i % 3 === 1, flight: 0.5 + R.next() * 0.14 });
  }
  return out;
})();

// ---- the sea: rolling crests of 祥云 fire
const CRESTS = (() => {
  const R = new Rng(31), out = [];
  for (let i = 0; i < 26; i++) out.push({ x: R.range(-40, 360), y: R.range(-4, 16), r: R.range(9, 22), ph: R.range(0, TAU), sp: R.range(42, 96) * (i % 2 ? 1 : -1), h: R.range(0.5, 1) });
  return out;
})();

// ---- rising sparks for the outro
const SPARKS = (() => {
  const R = new Rng(37), out = [];
  for (let i = 0; i < 220; i++)
    out.push({ x: R.range(0, 320), y: R.range(110, 210), t0: P.embers + R.next() * 0.95, life: R.range(0.75, 1.35), vy: R.range(14, 54), vx: R.range(-10, 10), ph: R.range(0, TAU), jade: R.next() < 0.18, sz: R.next() < 0.3 ? 2 : 1 });
  return out;
})();

// ---- the darkening: ink, dithered so the art stays in eight colours
function darken(p, k) {
  if (k <= 0.02) return;
  // a vignette that closes in: the corners go first, the middle last, so the array lights a shrinking stage
  for (let y = 0; y < 180; y++)
    for (let x = 0; x < 320; x++) {
      const d = Math.hypot((x - CX) / 200, (y - CY) / 130);
      if (!shown(x, y, clamp(k * (1.5 - d * 0.9)))) continue;
      p.px(x, y, ink);
    }
}

export function draw(p, t, o) {
  if (t < 0) return;
  clipTo(p, { x: 0, y: 0, w: 320, h: 180 });
  const hit = o.hit !== false;

  // ---- cast: the world dims, the array unfolds, everything is pulled in
  if (t < P.flash + 0.03) {
    darken(p, smooth(0, P.cast * 0.9, t) * 0.58);
    const k = seg(t, 0.06, P.cast * 0.92);
    const spin = ease.outCubic(k);
    const R = 24 + spin * 66;
    // the array: a gold ring of trigrams with a cloud heart, spinning up
    bagua(p, CX, CY, R, t * (0.6 + spin * 1.6), t, { a: Math.min(1, k * 2) });
    // a second, inner ring turning the other way
    bagua(p, CX, CY, R * 0.55, -t * 2.2, t, { a: Math.min(1, k * 2.4) * 0.9, col: flame, col2: jade });
    // the heart: a growing ball of white fire with 祥云 curls round it
    const cr = 3 + spin * 13;
    for (let py = -cr; py <= cr; py++)
      for (let px = -cr; px <= cr; px++) {
        const d = Math.hypot(px, py) / cr;
        if (d > 1 + Math.sin(Math.atan2(py, px) * 5 + t * 12) * 0.06) continue;
        const n = rand(Math.round(px + 40), Math.round(py + 40), 5);
        p.px(CX + px, CY + py, d < 0.3 ? bone : d < 0.55 ? gold : n > 0.4 ? flame : crimson);
      }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + t * 2.4;
      curl(p, CX + Math.cos(a) * (cr + 10), CY + Math.sin(a) * (cr + 10), 5 + spin * 4, a * 2 + t * 3, (v) => (v > 0.55 ? (i % 2 ? jade : gold) : i % 2 ? teal : flame), { w: 2 });
    }
    // energy lines torn in from every edge: jade from above, crimson from below
    for (let i = 0; i < 46; i++) {
      const ph = rand(i, 3), life = seg(t, 0.12 + ph * 0.7, P.cast - 0.02);
      if (life <= 0 || life >= 1) continue;
      const a = rand(i, 4) * TAU;
      const r0 = lerp(230, 10, ease.inQuad(life));
      const x0 = CX + Math.cos(a) * r0, y0 = CY + Math.sin(a) * r0 * 0.72;
      const len = 10 + life * 26;
      for (let q = 0; q < len; q++) {
        const u = q / len;
        const x = x0 + Math.cos(a) * q, y = y0 + Math.sin(a) * q * 0.72;
        if (!shown(x, y, life * (1 - u * 0.8))) break;
        const c = u < 0.25 ? bone : u < 0.5 ? (Math.sin(a) > 0 ? jade : gold) : u < 0.8 ? (Math.sin(a) > 0 ? teal : flame) : ink;
        p.px(x, y, c);
      }
    }
    // the last frame: the array locks, a hard ring of bone
    if (t > P.flash - 0.07) {
      const q = seg(t, P.flash - 0.07, P.flash);
      for (let i = 0; i < 200; i++) {
        const a = (i / 200) * TAU;
        p.px(CX + Math.cos(a) * (R + 2 + q * 6), CY + Math.sin(a) * (R + 2 + q * 6), q > 0.5 ? bone : gold);
      }
      flashStar(p, CX, CY, 22 * q + 6, bone, 8, t * 4);
    }
    return;
  }

  // ---- the release: one frame of white, then the rain
  if (t < P.flash + 0.055) {
    for (let y = 0; y < 180; y++)
      for (let x = 0; x < 320; x++) {
        const a = Math.atan2(y - CY, x - CX), d = Math.hypot(x - CX, (y - CY) * 1.3);
        if (d < 40 + Math.sin(a * 8) * 12) p.px(x, y, hit ? bone : gold);
        else if (d < 110 + Math.sin(a * 12 + 1) * 20) p.px(x, y, hit ? (Math.sin(a * 6) > 0.3 ? gold : flame) : Math.sin(a * 6) > 0.3 ? flame : crimson);
        else p.px(x, y, Math.sin(a * 9 + 2) > 0.6 ? crimson : ink);
      }
    return;
  }

  // ---- the rain of meteors
  if (t > P.flash + 0.05 && t < P.rainEnd + 0.3) {
    // the sky itself is alight: a dithered wash of ember rising from the horizon, and ash falling
    for (let y = 0; y < G; y++) {
      const v = y / G;
      if (!shown(0, y, 0.031)) continue;
      for (let x = 0; x < 320; x++) {
        const n = noise(x * 0.03, y * 0.03 + t * 0.7, 11);
        if (!shown(x, y, (v * v) * 0.9 * (0.6 + 0.6 * n))) continue;
        p.px(x, y, v > 0.72 ? ember : v > 0.55 ? ink : ink);
      }
    }
    for (let i = 0; i < 46; i++) {
      const x = ((i * 37 + t * 20) % 340) - 10 + Math.sin(t * 1.4 + i) * 8;
      const y = ((i * 53 + t * 26) % 190) - 6;
      if (!shown(x, y, 0.8 * (1 - seg(t, P.rainEnd - 0.2, P.rainEnd + 0.28)))) continue;
      p.px(x, y, i % 5 === 0 ? jade : i % 3 === 0 ? ember : ink);
      if (i % 7 === 0) p.px(x + 1, y, ink);
    }

    for (const m of METEORS) {
      const start = m.land - m.flight;
      // in flight
      if (t >= start && t < m.land) {
        const u = ease.inQuad(seg(t, start, m.land));
        const x = lerp(m.sx, m.lx, u), y = lerp(m.sy, G - 8, u);
        const vx = (m.lx - m.sx) / m.flight, vy = (G - 8 - m.sy) / m.flight;
        const L = Math.hypot(vx, vy);
        // the trail: fire, then a jade wind behind it
        for (let q = 0; q < 62; q++) {
          const uu = q / 62;
          const tx = x - (vx / L) * q * 1.6, ty = y - (vy / L) * q * 1.6;
          const w = (1 - uu) * (m.r * 1.05) + 1;
          for (let s = -w; s <= w; s++) {
            const v = Math.abs(s) / w;
            if (v > 1) continue;
            const heat = (1 - Math.pow(v, 0.7)) * (1 - uu * 0.75);
            if (uu > 0.4 && !shown(tx + s * 0.6, ty, (1 - uu) * 1.5)) continue;
            const c = heat > 0.8 ? bone : heat > 0.58 ? gold : heat > 0.36 ? flame : heat > 0.18 ? crimson : m.jade ? jade : ember;
            p.px(tx + s * 0.6, ty, c);
          }
          if (q % 20 === 10) curl(p, tx, ty + (m.jade ? -w * 0.6 : w * 0.6), Math.max(2, 7 * (1 - uu)), t * 3 + q, (vv) => (vv > 0.5 ? (m.jade ? jade : flame) : m.jade ? teal : ember), { w: 1 });
        }
        // the head: a fat rolling ball of fire
        for (let py = -m.r; py <= m.r; py++)
          for (let px = -m.r; px <= m.r; px++) {
            const d = Math.hypot(px, py) / m.r;
            if (d > 1 + Math.sin(Math.atan2(py, px) * 6 + t * 14) * 0.07) continue;
            const n = rand(Math.round(px + 30), Math.round(py + 30), 9);
            const c = d < 0.26 ? bone : d < 0.48 ? gold : d < 0.7 ? flame : d < 0.88 ? crimson : ember;
            p.px(x + px, y + py, c);
          }
        for (let i = 0; i < 10; i++) {
          const a = rand(i, m.i) * TAU + t * 5;
          p.px(x + Math.cos(a) * (m.r + 2), y + Math.sin(a) * (m.r + 2), i % 2 ? gold : bone);
        }
      }
      // the landing
      const age = t - m.land;
      if (age < 0 || age > 0.92) continue;
      const u = age / 0.92;
      const x = m.lx, y = G - 2;
      // the burst: a plume of fire climbs out of the pit, boiling into 祥云, then collapsing
      for (let i = 0; i < 4; i++) {
        const q = seg(t, m.land + i * 0.04, m.land + 0.42 + i * 0.05);
        if (q <= 0 || q >= 1) continue;
        const rr = (4 + q * 20) * (1 - q * 0.2);
        const px = x - 8 + i * 6 + Math.sin(q * 3 + i) * 4;
        const py = y - 3 - q * 26 * (0.7 + i * 0.12);
        // a hit boils into flame; a miss just coughs up grey smoke and never catches
        const col = hit
          ? (v) => (q < 0.3 ? rampAt([ember, crimson, flame, gold, bone], clamp(v + 0.1)) : q < 0.62 ? rampAt([ember, crimson, flame], v) : v > 0.56 ? jade : v > 0.25 ? teal : ink)
          : (v) => (q < 0.2 ? rampAt([ember, crimson, flame], v) : v > 0.62 ? jade : v > 0.3 ? teal : ink);
        cloud(p, px, py, rr, i * 2 + q * 3.4, col, { solid: true, a: 1 - Math.pow(q, 1.6) });
        if (q < 0.25 && hit) {
          for (let j = 0; j < 5; j++) {
            const a2 = -1.2 - j * 0.18 + Math.sin(t * 9 + j + i) * 0.16;
            const fl = 6 + Math.abs(Math.sin(t * 13 + j)) * 7;
            for (let k2 = 1; k2 < fl; k2++) p.px(px + Math.cos(a2) * (rr + k2 * 0.7), py + Math.sin(a2) * (rr + k2 * 0.6), k2 > fl * 0.6 ? flame : gold);
          }
        }
      }
      // the ground ring it kicks out
      if (u < 0.62) {
        const rr = ease.outQuart(u / 0.62) * 58;
        const f = 1 - u / 0.62;
        for (let q = 0; q < 90; q++) {
          const a = (q / 90) * TAU;
          if (!shown(x, y, f)) continue;
          p.px(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.22, q % 3 ? (f > 0.6 ? gold : flame) : bone);
        }
      }
      // the pit it left: gold lava cracks in the floor
      cracks(p, x, y, 70, seg(t, m.land + 0.02, m.land + 0.3), 11 + m.i, u < 0.6 ? gold : ember, (1 - Math.max(0, (u - 0.62) / 0.38)) * (hit ? 1 : 0.55));
      // and a fountain of fire that cools where it stood
      const col = (v) => (u < 0.32 ? rampAt([ember, crimson, flame, gold, bone], clamp(v + 0.1)) : u < 0.66 ? rampAt([ember, crimson, flame], v) : v > 0.55 ? jade : v > 0.25 ? teal : ink);
      for (let i = 0; i < 3; i++) {
        const q = seg(t, m.land + i * 0.05, m.land + 0.5 + i * 0.05);
        if (q <= 0 || q >= 1) continue;
        const rr = (4 + q * 17) * (1 - q * 0.25);
        cloud(p, x - 10 + i * 11, y - 6 - q * 22 - i * 3, rr, i * 2 + q * 3, col, { solid: true, a: 1 - q * q });
      }
      // sparks out of the pit
      for (let i = 0; i < 16; i++) {
        const sp = 60 + rand(i, m.i, 7) * 150;
        const a = -0.3 - rand(i, m.i, 8) * 2.5;
        const [sx, sy] = flight(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 460, age, G + 1, 0.4);
        if (u > 0.6 && !shown(sx, sy, (1 - u) / 0.4)) continue;
        const c = hit ? (u > 0.5 ? ember : rand(i, m.i, 9) > 0.7 ? (u < 0.2 ? jade : teal) : rampAt(COOL, u * 0.8)) : u > 0.35 ? ember : u > 0.15 ? crimson : teal;
        p.px(sx, sy, c);
        if (u < 0.5) p.px(sx, sy + 1, ember);
      }
    }
  }

  // ---- the sea of cloud fire rolling across the floor (a miss never gets one going)
  const seaPeak = hit ? 1 : 0.22;
  const sea = seg(t, P.sea, P.sea + 0.45) * (1 - seg(t, P.ebb, P.end - 0.72)) * seaPeak;
  if (sea > 0.01) {
    // a hot haze up from the sea, so the air between the wave and the sky is lit
    for (let y = G - 58; y < G; y++) {
      const v = (y - (G - 58)) / 58;
      for (let x = 0; x < 320; x++) {
        const n = noise(x * 0.05, y * 0.06 + t * 1.1, 13);
        if (!shown(x, y, Math.pow(v, 2.1) * 0.6 * sea * (0.5 + 0.6 * n))) continue;
        p.px(x, y, v > 0.82 ? crimson : ember);
      }
    }
    // the wave: a rolling height field, one crest every ~40 px, two layers deep
    const height = (x, layer) => {
      const n = noise(x * 0.028 + t * 0.8 + layer * 10, layer * 3.1, 5);
      const n2 = noise(x * 0.075 - t * 1.5 + layer * 4, layer * 5.3, 6);
      const n3 = noise(x * 0.16 + t * 2.2, layer * 7.7, 9);
      const v = (n * 0.5 + n2 * 0.3 + n3 * 0.2 + 0.5);
      return Math.pow(v, 1.4) * (38 - layer * 13) * sea;
    };
    for (let layer = 0; layer < 2; layer++) {
      const top = layer * 5;
      for (let x = 0; x < 320; x++) {
        const h = height(x, layer);
        for (let y = G - h - top; y < 180; y++) {
          if (y < 0) continue;
          const v = (y - (G - h - top)) / Math.max(6, h * 0.5 + 20); // 0 crest, 1 deep
          if (!shown(x, y, 0.55 + 0.45 * sea)) continue;
          const c = v < 0.08 ? flame : v < 0.2 ? crimson : v < 0.42 ? ember : ink;
          p.px(x, y, v < 0.05 && layer === 1 ? flame : c);
        }
        // the crest itself: a bone-hot line where the wave breaks
        if (!shown(x, G - h - top, sea)) continue;
        p.px(x, G - h - top, layer ? gold : flame);
        p.px(x, G - h - top + 1, layer ? flame : crimson);
      }
    }
    // 祥云 crests riding the peaks of the front wave, each curling over and shedding embers
    for (let i = 0; i < 14; i++) {
      if (sea < 0.14) break;
      const bx = ((i * 26 + t * 30) % 360) - 20;
      const h = height(bx, 1);
      if (h < 5) continue;
      const rr = 4 + h * 0.32;
      const cx = bx, cy = G - h - 3 - rr * 0.2;
      const col = (v) => (v > 0.96 ? bone : v > 0.78 ? gold : v > 0.5 ? flame : v > 0.22 ? crimson : ember);
      cloud(p, cx, cy, rr, i * 1.7 + t * 1.8, col, { solid: true, rim: ink, scroll: false, a: Math.min(1, sea * 1.5) });
      // the crest breaks into tongues of flame, tallest on the highest waves
      for (let q = 0; q < 4; q++) {
        const a2 = -1.9 + q * 0.55 + Math.sin(t * 7 + q + i) * 0.14;
        const fl = rr * (0.7 + Math.abs(Math.sin(t * 9 + q * 2 + i)) * 0.9);
        for (let j = 1; j < fl; j++) {
          const px = cx + Math.cos(a2) * (rr * 0.8 + j * 0.5), py = cy + Math.sin(a2) * (rr * 0.7 + j * 0.7);
          p.px(px, py, j > fl * 0.7 ? crimson : j > fl * 0.4 ? flame : gold);
        }
      }
      // an off-centre scroll cut, so the crest never reads as a face
      curl(p, cx + rr * 0.55, cy - rr * 0.35, rr * 0.34, i * 2.3 + t * 2.2, (v) => (v > 0.5 ? gold : flame), { w: 1, skip: 0.18 });
      for (let q = 0; q < 4; q++) {
        const ph = (t * 1.1 + i * 0.37 + q * 0.25) % 1;
        const ex = cx + Math.sin(ph * 6 + q) * 8, ey = cy - rr * 0.7 - ph * 30 * sea;
        if (!shown(ex, ey, (1 - ph) * sea)) continue;
        p.px(ex, ey, ph < 0.3 ? gold : ph < 0.6 ? flame : crimson);
      }
    }
    // a jade wind skating over the surface: thin cold streaks in the hot air
    for (let i = 0; i < 14; i++) {
      if (sea < 0.3) break;
      const bx = ((i * 24 + t * 96) % 360) - 20;
      const h = height(bx, 0);
      const cy = G - h - 10 - rand(i, 3) * 10;
      for (let q = 0; q < 6; q++) {
        if (!shown(bx - q * 2, cy, sea * (1 - q / 7))) continue;
        p.px(bx - q * 2, cy, q > 3 ? teal : jade);
      }
    }
  }

  // ---- outro: the fire dies, and the sky fills with rising sparks
  if (t > P.embers) {
    // the last of the floor: dark, cooling embers
    const cool = seg(t, P.ebb + 0.2, P.end - 0.25);
    if (cool > 0 && cool < 1) {
      for (let x = 0; x < 320; x++) {
        const n = noise(x * 0.07, t * 0.6, 7);
        const h = (n * 0.5 + 0.5) * 10 * (1 - cool);
        for (let y = 0; y < h; y++) if (shown(x, G + y, (1 - cool) * 0.8)) p.px(x, G + y, y < h * 0.5 ? ember : ink);
      }
    }
    for (const s of SPARKS) {
      const age = seg(t, s.t0, Math.min(s.t0 + s.life, P.end - 0.06));
      if (age <= 0 || age >= 1) continue;
      const x = s.x + Math.sin(age * 3 + s.ph) * 7 + s.vx * age;
      const y = s.y - s.vy * age - s.vy * age * age * 0.3;
      if (y < -2 || y > 182) continue;
      const fade = age < 0.15 ? age / 0.15 : 1 - Math.pow((age - 0.15) / 0.85, 1.6);
      if (!shown(x, y, fade)) continue;
      // bright when young, then gold, crimson, ember: each spark dies on its own beat
      const c = age < 0.2 ? bone : age < 0.45 ? gold : age < 0.68 ? flame : age < 0.85 ? crimson : ember;
      p.px(x, y, s.jade ? (age < 0.4 ? jade : teal) : c);
      if (s.sz > 1) {
        p.px(x + 1, y, s.jade ? teal : c === bone ? gold : c);
        p.px(x, y - 1, s.jade ? teal : ember);
      }
      // a one-pixel glint on the freshest ones
      if (age < 0.12) p.px(x, y, bone);
    }
  }
}
