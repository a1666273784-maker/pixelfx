// Monster twin-hit target impact VFX ("impacts/monster-twin-hit"):
// Pure target-side being-hit & hit-result VFX (no character, no monster avatar, no drawn fists):
// 1. Beat 1 (0.00s, upper-left locus): First colossal blunt blow caves in the upper target zone with a lumpy white-crimson
//    concussive core, black-inked snapping shock wedges, double tilted supersonic Mach rings, directional punch-through spear,
//    and an immediate floor-buckling pressure ring underneath.
// 2. Beat 2 (0.16s, lower-right locus): While Blow #1's crimson shock-scar still hangs in the air, a heavier second blow
//    slams low into the gut zone — both twin impact rings & scars are simultaneously visible as space-shatter fractures spread.
// 3. Beat 3 (0.28s -> 0.34s): Jagged abyssal black-crimson void-tear implosion sucks both twin impact cores inward under
//    radial inward-crushing pressure spears, then detonates at 0.34s into an 18-spike critical starburst, black-crimson
//    impact lightning arcs, anamorphic cross-flare, supersonic blow-out shock spears, triple broken shockwaves, towering
//    frontCrescent air-wall, scalloped magma-soot blast billows, bouncing faceted rocks, and a glowing magma-cracked crater.
import { Particles, Bits, Lights, P, PF, B, Rng, fit, clamp, smooth, lerp, ease, rand, TAU, WHITE } from "../../core/index.js";
import { spikes, star, brokenRing, makeCracks, drawCracks, frontCrescent, dustRing, stone, rock, rockShape } from "./_lib.js";

const T_HIT_1 = 0.00;
const T_HIT_2 = 0.16;
const T_IMPLODE = 0.28;
const T_BOOM = 0.34;
const T_END = 1.75;

// Distinct diagonal twin-impact loci (Upper-Left chest smash + Lower-Right gut smash -> unmistakable 1-2 twin blow!)
const H1X = -16, H1Y = -46;
const H2X = 14, H2Y = -20;
const BX = 2, BY = -31;

export const meta = {
  name: "Monster twin hit",
  desc: "Two distinct heavy monster blows cave in upper and lower target zones, collapse into a jagged black-crimson void tear, and erupt in a lightning-laced crater blast.",
  tags: ["impact", "hit", "blunt", "monster", "heavy", "twin", "crush", "crit", "shockwave", "one-shot"],
  size: [336, 212],
  origin: [144, 154],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#120408", "#3b0812", "#7a0f1b", "#c91e1a", "#f45316", "#ffa028", "#ffe47c", "#ffffff"],
    stone: "#423246",
    seed: 13,
  },
};

const X_MIN = -138, X_MAX = 186, Y_MIN = -148;
const RSY = 0.22;

const lump = (r, a, ph) => r * (1 + 0.17 * Math.sin(5 * a + ph) + 0.09 * Math.sin(9 * a + ph * 2.3));

// Prebaked scalloped blast-puff LUTs for crisp hand-pixeled explosion/dust billows
const PUFF_LUTS = Array.from({ length: 22 }, (_, r) => {
  if (r < 2) return [];
  const pts = [];
  for (let dy = -r - 2; dy <= r + 2; dy++) {
    for (let dx = -r - 2; dx <= r + 2; dx++) {
      const a = Math.atan2(dy, dx);
      const sc = 0.88 + 0.15 * Math.sin(a * 5 + r * 0.85) + 0.09 * Math.cos(a * 8 - r * 0.55);
      const q = Math.hypot(dx, dy) / (r * sc);
      if (q > 1) continue;
      pts.push(dx, dy, q, (-dx * 0.35 - dy * 0.38) / Math.max(1, r) + (1 - q) * 0.55);
    }
  }
  return pts;
});

function drawPuff(p, cx, cy, r, u, C, alpha) {
  const fade = (1 - smooth(0.54, 1, u)) * alpha;
  if (fade <= 0.03) return;
  const ri = clamp(Math.round(r), 2, 21), pts = PUFF_LUTS[ri];
  if (!pts.length) return;
  const rx = Math.round(cx), ry = Math.round(cy);
  const dither = u > 0.62 ? (u - 0.62) * 2.35 : 0;
  for (let i = 0; i < pts.length; i += 4) {
    const px = rx + pts[i], py = ry + pts[i + 1];
    if (px < X_MIN || px > X_MAX || py < Y_MIN || py > -1) continue;
    if (dither > 0 && rand(px, py, ri) < dither) continue;
    const q = pts[i + 2], sh = pts[i + 3];
    let col;
    if (q > 0.84) col = C[0];
    else if (u < 0.22) col = sh > 0.7 ? WHITE : sh > 0.42 ? C[6] : C[4];
    else if (u < 0.52) col = sh > 0.62 ? C[6] : sh > 0.35 ? C[4] : C[2];
    else if (u < 0.78) col = sh > 0.5 ? C[3] : C[1];
    else col = sh > 0.42 ? C[2] : C[0];
    p.dot(px, py, col, fade);
  }
}

// Heavy concussive blunt-impact core + snapping black-inked shock wedges + lingering molten impact scar
function drawBluntCore(p, cx, cy, age, R0, ph, wedges, C) {
  if (age < 0 || age > 0.28) return;
  if (age < 0.095) {
    const f = age < 0.035 ? 0 : age < 0.068 ? 1 : 2;
    const rad = R0 * (f === 0 ? 1.0 : f === 1 ? 1.28 : 0.94);
    const b = Math.ceil(rad * 1.38);
    p.shade(cx - b, cy - b, cx + b, cy + b, (x, y, out) => {
      const dx = x - cx, dy = (y - cy) * 1.12, d = Math.hypot(dx, dy);
      const ro = lump(rad, Math.atan2(dy, dx), ph + f * 0.5);
      if (d > ro) return;
      const q = d / ro;
      out.a = f === 2 ? 0.9 : 1;
      if (q > 0.86) out.c = C[0];
      else if (f === 0) out.c = q < 0.64 ? WHITE : C[6];
      else if (f === 1) out.c = q < 0.24 ? C[0] : q < 0.56 ? WHITE : q < 0.8 ? C[5] : C[3];
      else out.c = q < 0.35 ? C[6] : q < 0.7 ? C[4] : C[2];
    });
  } else {
    const u = (age - 0.095) / 0.185;
    p.ring(cx, cy, R0 * (0.78 + 0.45 * u), u < 0.4 ? C[5] : C[3], (1 - u) * 0.92, { sy: 1.2 });
    p.disc(cx, cy, R0 * 0.45 * (1 - u), C[6], (d) => (1 - u) * (1 - d));
  }

  for (const w of wedges) {
    const u = age - w.t0;
    if (u < 0 || u > w.out + w.back) continue;
    const s = u < w.out ? ease.outCubic(u / w.out) : 1 - ease.inQuad((u - w.out) / w.back);
    const L = w.len * s;
    if (L < 1.5) continue;
    const ca = Math.cos(w.a), sa = Math.sin(w.a), r0 = w.r0 + 2 * s, hw = (w.w * (0.6 + 0.4 * s)) / 2;
    const tipX = cx + ca * r0, tipY = cy + sa * r0;
    const endX = cx + ca * (r0 + L), endY = cy + sa * (r0 + L);
    const nx = -sa * hw, ny = ca * hw;
    p.poly([[tipX - ca, tipY - sa], [endX + nx * 1.45 + ca, endY + ny * 1.45 + sa], [endX - nx * 1.45 + ca, endY - ny * 1.45 + sa]], C[0]);
    p.poly([[tipX, tipY], [endX + nx, endY + ny], [endX - nx, endY - ny]], u < w.out + 0.02 ? WHITE : C[5]);
  }
}

// Tilted elliptical Mach shock-ring with uneven hand-felt thickness & breaks
function drawTiltedShockRing(p, cx, cy, rx, ry, tilt, colOuter, colInner, alpha, brk = 0) {
  if (alpha <= 0.03 || rx < 2) return;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const steps = Math.max(28, Math.ceil(Math.max(rx, ry) * 2.8));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    if (brk > 0 && Math.sin(a * 5 + tilt * 3) > 1 - brk * 1.6) continue;
    const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
    const px = cx + ex * ct - ey * st, py = cy + ex * st + ey * ct;
    if (px < X_MIN + 2 || px > X_MAX - 2 || py < Y_MIN + 2 || py > -1) continue;
    p.dot(px, py, colOuter, alpha);
    p.dot(px - ct * 0.9, py - st * 0.9, colInner, alpha * 0.88);
  }
}

// Tapered supersonic shock-spear ray for directional blow-out cone & vertical crush spears
function drawShockSpear(p, x0, y0, ang, len, w, colRim, colOuter, colCore, alpha) {
  if (len < 2 || alpha <= 0.03) return;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let d = 0; d <= len; d += 0.75) {
    const u = d / len;
    const hw = w * (1 - u) * Math.min(1, d / 3.5);
    const bx = x0 + ca * d, by = y0 + sa * d;
    if (bx < X_MIN + 2 || bx > X_MAX - 2 || by < Y_MIN + 2 || by > -1) continue;
    for (let o = -hw - 0.7; o <= hw + 0.7; o += 0.65) {
      const ao = Math.abs(o);
      const col = ao > hw ? colRim : ao < hw * 0.45 && u < 0.68 ? colCore : colOuter;
      p.dot(bx - sa * o, by + ca * o, col, alpha * (1 - u * 0.3));
    }
  }
}

// Jagged black-rimmed crimson-white impact lightning ("Black Flash" oppressive boss energy!)
function drawBlackFlashArc(p, pts, reach0, reach1, colCore, colMid, colRim, alpha) {
  if (alpha <= 0.03) return;
  const n = pts.length - 1;
  const i0 = clamp(Math.floor(reach0 * n), 0, n - 1);
  const i1 = clamp(Math.ceil(reach1 * n), i0 + 1, n);
  for (let i = i0; i < i1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    p.line(x0 - 1, y0, x1 - 1, y1, colRim, alpha * 0.92);
    p.line(x0 + 1, y0, x1 + 1, y1, colRim, alpha * 0.92);
    p.line(x0, y0 + 1, x1, y1 + 1, colRim, alpha * 0.92);
    p.line(x0, y0 - 1, x1, y1 - 1, colMid, alpha * 0.85);
    p.line(x0, y0, x1, y1, colCore, alpha);
  }
}

// Cross & horizontal anamorphic impact lens flare
function drawImpactFlare(p, cx, cy, L, k, C) {
  if (k <= 0.03 || L < 2) return;
  for (const [dx, dy, len] of [[1, 0, L], [0, 1, L * 0.48], [0.7, 0.7, L * 0.26], [0.7, -0.7, L * 0.26]]) {
    for (const s of [-1, 1]) {
      const lim = s < 0 && dx === 1 ? len * 0.72 : len;
      for (let d = 1; d <= lim; d++) {
        const px = cx + s * dx * d, py = cy + s * dy * d;
        if (px < X_MIN + 2 || px > X_MAX - 2 || py < Y_MIN + 2 || py > -1) continue;
        const u = d / lim, a = u < 0.65 ? k : k * (1 - (u - 0.65) / 0.35);
        p.dot(px, py, u < 0.38 ? WHITE : u < 0.72 ? C[6] : C[5], a);
        if (dy === 0 && u < 0.42) {
          p.dot(px, py - 1, C[6], a * 0.85);
          p.dot(px, py + 1, C[6], a * 0.85);
        }
      }
    }
  }
  p.glowLine(Math.max(X_MIN + 8, cx - L * 0.7), cy, Math.min(X_MAX - 8, cx + L), cy, 6, C[5], 0.54 * k);
}

export function create(o) {
  const C = fit(o.palette, 8);
  const R = new Rng(o.seed), st = stone(o.stone), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[6], C[5], C[3]], haze: C[2] });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  const ph1 = R.range(0, TAU), ph2 = R.range(0, TAU);
  const makeWedges = (n, r0, lenMax) =>
    Array.from({ length: n }, (_, i) => ({
      a: (i / n) * TAU + R.range(-0.18, 0.18),
      len: R.range(8, lenMax) * (Math.cos((i / n) * TAU) > 0 ? 1.35 : 0.88),
      w: R.range(3.4, 5.4),
      r0: R.range(r0, r0 + 3),
      t0: R.range(0.01, 0.03),
      out: R.range(0.035, 0.055),
      back: R.range(0.08, 0.12),
    }));
  const wedges1 = makeWedges(9, 13, 18);
  const wedges2 = makeWedges(11, 15, 22);

  const hit1Star = spikes(R, 12, 0.08, { len: [14, 22], w: [2.0, 2.8], fwd: 1.65, back: 0.45, jag: 0.5 });
  const hit2Star = spikes(R, 14, -0.06, { len: [16, 26], w: [2.2, 3.2], fwd: 1.7, back: 0.45, jag: 0.5 });
  const voidOuterStar = spikes(R, 11, 0.12, { len: [22, 38], w: [3.2, 5.0], fwd: 1.35, back: 0.85, jag: 0.58 });
  const voidInnerStar = spikes(R, 11, 0.12, { len: [16, 28], w: [2.6, 4.0], fwd: 1.35, back: 0.85, jag: 0.58 });
  const boomStar = spikes(R, 18, -0.03, { len: [20, 34], w: [2.6, 3.8], fwd: 1.62, back: 0.52, jag: 0.48 });

  // Radial inward-collapsing suction spears during implosion (varied angles all around BX, BY — zero parallel comb lines!)
  const implodeRays = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * TAU + R.range(-0.16, 0.16);
    return {
      a,
      rOuter: R.range(44, 68) * (Math.sin(a) < 0 ? 1.1 : 0.82),
      len: R.range(26, 44),
      w: R.range(1.4, 2.5),
    };
  });

  // Jagged space/armor-shatter fracture cracks spanning the crushed target zone
  const airCracks = Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * TAU + R.range(-0.2, 0.2);
    const pts = [[BX + R.range(-4, 4), BY + R.range(-5, 5)]];
    let curA = a, x = pts[0][0], y = pts[0][1];
    const segs = 5 + R.int(0, 2);
    for (let s = 0; s < segs; s++) {
      curA += R.range(-0.55, 0.55);
      const step = R.range(5.5, 9.5) * (Math.cos(a) > 0 ? 1.25 : 0.85);
      x = clamp(x + Math.cos(curA) * step, X_MIN + 18, X_MAX - 18);
      y = clamp(y + Math.sin(curA) * step, Y_MIN + 18, -4);
      pts.push([x, y]);
    }
    return pts;
  });

  // Crackling black-rimmed crimson lightning arcs ("Black Flash") erupting from the detonation core
  const blackFlashArcs = Array.from({ length: 8 }, (_, i) => {
    const a0 = -Math.PI * 0.95 + (i / 7) * Math.PI * 0.98 + R.range(-0.1, 0.1);
    const pts = [[BX + Math.cos(a0) * 6, BY + Math.sin(a0) * 5]];
    let curA = a0, x = pts[0][0], y = pts[0][1];
    const segs = 6 + R.int(0, 2);
    for (let s = 0; s < segs; s++) {
      curA += (s % 2 === 0 ? 1 : -1) * R.range(0.32, 0.68);
      const step = R.range(8, 14) * (Math.cos(a0) > 0 ? 1.2 : 0.95);
      x = clamp(x + Math.cos(curA) * step, X_MIN + 16, X_MAX - 16);
      y = clamp(y + Math.sin(curA) * step, Y_MIN + 16, -2);
      pts.push([x, y]);
    }
    return { pts, delay: R.range(0, 0.08), dur: R.range(0.18, 0.28) };
  });

  // Directional blow-out shock spears blasting rightward (+x) out the back of the struck target
  const blowoutSpears = Array.from({ length: 11 }, (_, i) => ({
    dy: -24 + i * 4.8 + R.range(-1.4, 1.4),
    ang: (i - 5) * 0.065 + R.range(-0.03, 0.03),
    len: R.range(50, 108) * (1 - Math.abs(i - 5) * 0.08),
    w: R.range(1.8, 3.3),
  }));

  const ringSegs1 = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * TAU, gap: R.range(0.36, 0.68), dr: R.range(0.08, 0.28), w: R.range(0.9, 1.4) }));
  const ringSegs2 = Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * TAU + 0.3, gap: R.range(0.4, 0.72), dr: R.range(0.1, 0.32), w: R.range(0.85, 1.3) }));
  const ringSegsFloor = Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * TAU + 0.15, gap: R.range(0.38, 0.72), dr: R.range(0.08, 0.28), w: R.range(0.85, 1.3) }));
  const floorCracks = makeCracks(R, 14, { len: [20, 60], dive: 0.8, maxY: 25, forks: 0.68, x0: [2, 10] });

  const craterCoals = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * TAU + R.range(-0.16, 0.16);
    const d = R.range(6, 38);
    return { x: BX + Math.cos(a) * d, y: Math.sin(a) * d * RSY, ph: R.range(0, TAU), tEnd: R.range(1.35, 1.68) };
  });

  const blastPuffs = Array.from({ length: 20 }, (_, i) => {
    const a = -Math.PI * 0.04 - (i / 19) * Math.PI * 0.92 + R.range(-0.1, 0.1);
    const sp = R.range(40, 128);
    return {
      x0: BX + R.range(-10, 12),
      y0: BY + 4 + R.range(-12, 10),
      vx: Math.cos(a) * sp + 24,
      vy: Math.sin(a) * sp * 0.85 - R.range(8, 26),
      r0: R.range(6, 10),
      r1: R.range(13, 21),
      delay: R.range(0, 0.08),
      life: R.range(0.48, 0.88),
    };
  });

  const bounceKicks = [];
  let t = 0, didH1 = false, didH2 = false, didBoom = false;

  return {
    update(dt) {
      t += dt;

      // Beat 1: Upper-Left Heavy Monster Blow Impact (t = 0.00s)
      if (!didH1 && t >= T_HIT_1) {
        didH1 = true;
        lights.add(H1X, H1Y, 76, C[5], 0.84, 0.24);
        lights.add(H1X, H1Y, 28, WHITE, 0.9, 0.08);
        for (let i = 0; i < 26; i++) {
          const back = R.chance(0.22), a = (back ? Math.PI : 0.1) + R.range(-0.85, 0.85), v = R.range(130, 300) * (back ? 0.5 : 1);
          ps.spawn(P.SPARK, H1X, H1Y, Math.cos(a) * v, Math.sin(a) * v - 20, R.range(0.16, 0.36), i % 2 ? WHITE : C[6], 1);
        }
        for (let i = 0; i < 6; i++) {
          const a = R.range(-0.8, 0.5), v = R.range(115, 220);
          bits.add({ kind: B.SHARD, x: H1X + 4, y: H1Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 22, g: 0.88, drag: 0.65, bounce: 0.32, life: R.range(0.48, 0.82), a: R.range(0, TAU), va: R.range(-22, 22), s: R.range(2.2, 3.8), c: R.pick([WHITE, C[6], C[5]]) });
        }
      }

      // Beat 2: Lower-Right Gut-Crushing Monster Blow Impact (t = 0.16s)
      if (!didH2 && t >= T_HIT_2) {
        didH2 = true;
        lights.add(H2X, H2Y, 86, C[5], 0.9, 0.24);
        lights.add(H2X, H2Y, 34, WHITE, 0.95, 0.09);
        for (let i = 0; i < 32; i++) {
          const back = R.chance(0.2), a = (back ? Math.PI : -0.06) + R.range(-0.8, 0.8), v = R.range(140, 325) * (back ? 0.5 : 1);
          ps.spawn(P.SPARK, H2X, H2Y, Math.cos(a) * v, Math.sin(a) * v - 28, R.range(0.18, 0.4), i % 2 ? WHITE : C[6], 1);
        }
        for (let i = 0; i < 8; i++) {
          const a = R.range(-0.8, 0.5), v = R.range(125, 235);
          bits.add({ kind: B.SHARD, x: H2X + 5, y: H2Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 25, g: 0.88, drag: 0.65, bounce: 0.32, life: R.range(0.5, 0.86), a: R.range(0, TAU), va: R.range(-24, 24), s: R.range(2.4, 4.2), c: R.pick([WHITE, C[6], C[5]]) });
        }
      }

      // Beat 3: Catastrophic Twin-Locus Resonance Detonation (t = 0.34s)
      if (!didBoom && t >= T_BOOM) {
        didBoom = true;
        lights.add(BX, BY, 98, C[5], 0.95, 0.56);
        lights.add(BX, BY, 44, WHITE, 0.98, 0.14);
        lights.add(BX, -4, 60, C[4], 0.54, 0.48);

        for (let i = 0; i < 56; i++) {
          const back = R.chance(0.22), a = (back ? Math.PI : 0) + R.range(-1.1, 0.82) * (back ? 0.65 : 1), v = R.range(135, 330) * (back ? 0.55 : 1);
          ps.spawn(P.SPARK, BX + R.range(-6, 8), BY + R.range(-12, 10), Math.cos(a) * v, Math.sin(a) * v - 38, R.range(0.24, 0.64), i % 3 === 0 ? WHITE : C[6], 1, 0, PF.BOUNCE);
        }
        for (let i = 0; i < 28; i++) {
          ps.spawn(P.EMBER, BX + R.range(-24, 28), -12 + R.range(-14, 8), R.range(-44, 82), -R.range(36, 108), R.range(0.55, 1.15), R.pick([C[6], C[5], C[4]]), R.range(1, 2));
        }
        for (let i = 0; i < 8; i++) {
          const a = R.range(0, TAU), d = R.range(18, 48);
          ps.spawn(P.STAR, BX + Math.cos(a) * d, BY + Math.sin(a) * d * 0.75, 0, -5, R.range(0.22, 0.4), i % 2 ? WHITE : C[6], R.range(1.8, 3.2), R.range(0.08, 0.34));
        }
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI * 0.46 + R.range(-0.98, 1.05), v = R.range(85, 200);
          bits.add({ kind: B.CHUNK, x: BX + R.range(-12, 12), y: -8, vx: Math.cos(a) * v + 18, vy: Math.sin(a) * v - 32, g: 1.08, drag: 0.52, bounce: 0.28, life: R.range(0.65, 1.15), a: R.range(0, TAU), va: R.range(-15, 15), s: R.chance(0.48) ? 2 : 1, pts: rockShape(R), pvy: 0 });
        }
        for (let i = 0; i < 12; i++) {
          const a = R.range(-0.9, 0.52), v = R.range(130, 260);
          bits.add({ kind: B.SHARD, x: BX + 6, y: BY + R.range(-14, 12), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 28, g: 0.88, drag: 0.65, bounce: 0.32, life: R.range(0.5, 0.9), a: R.range(0, TAU), va: R.range(-24, 24), s: R.range(2.4, 4.4), c: R.pick([WHITE, C[6], C[5]]) });
        }
      }

      for (const b of bits.list) if (b.kind === B.CHUNK) b.pvy = b.vy;
      ps.update(dt);
      bits.update(dt);
      for (const b of bits.list) {
        if (b.kind === B.CHUNK && b.pvy > 58 && b.vy <= 0 && b.x > X_MIN + 14 && b.x < X_MAX - 14) {
          bounceKicks.push({ x: b.x, y: -1, vx: R.sign() * R.range(8, 20), vy: -R.range(4, 11), r: R.range(1.6, 2.8), age: 0, life: 0.34 });
          b.pvy = 0;
        }
      }
      for (let i = bounceKicks.length - 1; i >= 0; i--) {
        const k = bounceKicks[i];
        k.age += dt;
        k.x += k.vx * dt;
        k.y += k.vy * dt;
        k.vx *= 1 - 4 * dt;
        k.vy *= 1 - 4 * dt;
        if (k.age >= k.life) bounceKicks.splice(i, 1);
      }
      lights.update(dt);
    },

    draw(p) {
      // ---- 0. FLOOR PRESSURE DENT, SCORCH CRATER, GLOWING CRACKS & BREATHING MAGMA COALS ----
      if (t >= T_HIT_1 && t < T_HIT_2 + 0.14) {
        // Immediate downward air-pressure ring on the floor even from Blow #1 (communicates colossal blow weight!)
        const u1 = clamp(t / 0.22);
        p.ring(H1X + 4, -1, 8 + 30 * ease.outQuart(u1), u1 < 0.3 ? C[6] : C[3], (1 - u1) * 0.72, { sy: RSY });
      }
      if (t >= T_HIT_2) {
        const age = t - T_HIT_2;
        const k = 1 - smooth(T_END - 0.38, T_END - 0.03, t);
        if (k > 0.01) {
          const scorchR = (t >= T_BOOM ? 52 : 30) * ease.outQuart(clamp(age / 0.16));
          p.disc(BX, 0, scorchR, C[0], (d) => 0.84 * k * (1 - d * d), { sy: RSY });
          if (t >= T_BOOM) {
            const bAge = t - T_BOOM;
            const heat = clamp(1 - bAge / 0.88);
            if (heat > 0.02) {
              p.disc(BX, 0, 26, C[5], (d) => 0.68 * heat * k * (1 - d), { sy: RSY });
              p.glow(BX, -3, 46, C[4], 0.42 * heat * k);
            }
            drawCracks(p, floorCracks, (c) => c.len * ease.outQuart(clamp((bAge - c.t0) / 0.13)), (d) => clamp(1 - bAge / 0.88 - d / 68), [WHITE, C[6], C[5], C[3]], C[0], st.lip, k);
            for (const cl of craterCoals) {
              if (t >= cl.tEnd) continue;
              const ck = (1 - smooth(cl.tEnd - 0.25, cl.tEnd, t)) * (0.55 + 0.45 * Math.sin(t * 18 + cl.ph));
              p.dot(cl.x, cl.y, ck > 0.7 ? C[6] : C[4], ck);
            }
          }
        }
      }

      // ---- 1. BEAT 1: UPPER-LEFT HEAVY MONSTER BLOW (-16, -46) ----
      if (t >= T_HIT_1 && t < T_BOOM) {
        const age1 = t - T_HIT_1;
        // Pull scar #1 inward toward BX, BY during implosion!
        const pull = t >= T_IMPLODE ? ease.inQuad((t - T_IMPLODE) / (T_BOOM - T_IMPLODE)) : 0;
        const c1x = lerp(H1X, BX, pull * 0.75), c1y = lerp(H1Y, BY, pull * 0.75);
        drawBluntCore(p, c1x, c1y, age1, 15.5, ph1, wedges1, C);
        if (age1 < 0.25) {
          const u1 = age1 / 0.25;
          // Double supersonic Mach shock-rings (inner bright + outer dark-crimson heavy halo)
          drawTiltedShockRing(p, H1X + u1 * 5, H1Y, 9 + 30 * ease.outQuart(u1), 15 + 42 * ease.outQuart(u1), 0.24, u1 < 0.25 ? WHITE : C[6], C[4], 1 - u1, smooth(0.35, 0.95, u1));
          drawTiltedShockRing(p, H1X + u1 * 2, H1Y, 13 + 36 * ease.outQuart(u1), 19 + 48 * ease.outQuart(u1), 0.24, C[3], C[0], (1 - u1) * 0.75, smooth(0.25, 0.9, u1));
          drawShockSpear(p, H1X + 4, H1Y, 0.08, 58 * ease.outQuart(Math.min(1, u1 * 2.2)), 3.3 * (1 - u1), C[0], C[5], WHITE, 1 - u1);
        }
        if (age1 < 0.13) {
          const su = age1 / 0.13;
          star(p, H1X, H1Y, hit1Star, su < 0.3 ? lerp(0.85, 1.34, su / 0.3) : lerp(1.34, 1.0, (su - 0.3) / 0.7), Math.max(0.3, 1 - su * 0.75), su < 0.25 ? [C[4], C[6], WHITE, WHITE] : [C[2], C[4], C[6], WHITE], 1 - smooth(0.65, 1, su), 3.0);
        }
      }

      // ---- 2. BEAT 2: LOWER-RIGHT GUT-CRUSHING BLOW (+14, -20) ----
      if (t >= T_HIT_2 && t < T_BOOM + 0.03) {
        const age2 = t - T_HIT_2;
        const pull = t >= T_IMPLODE ? ease.inQuad(clamp((t - T_IMPLODE) / (T_BOOM - T_IMPLODE))) : 0;
        const c2x = lerp(H2X, BX, pull * 0.75), c2y = lerp(H2Y, BY, pull * 0.75);
        drawBluntCore(p, c2x, c2y, age2, 18.0, ph2, wedges2, C);
        if (age2 < 0.22) {
          const u2 = age2 / 0.22;
          drawTiltedShockRing(p, H2X + u2 * 6, H2Y, 11 + 35 * ease.outQuart(u2), 16 + 46 * ease.outQuart(u2), -0.22, u2 < 0.25 ? WHITE : C[6], C[4], 1 - u2, smooth(0.35, 0.95, u2));
          drawTiltedShockRing(p, H2X + u2 * 3, H2Y, 15 + 42 * ease.outQuart(u2), 20 + 52 * ease.outQuart(u2), -0.22, C[3], C[0], (1 - u2) * 0.8, smooth(0.25, 0.9, u2));
          drawShockSpear(p, H2X + 4, H2Y, -0.06, 68 * ease.outQuart(Math.min(1, u2 * 2.2)), 3.8 * (1 - u2), C[0], C[5], WHITE, 1 - u2);
          p.ring(H2X, -1, 10 + 40 * ease.outQuart(u2), u2 < 0.3 ? WHITE : C[5], (1 - u2) * 0.92, { sy: RSY });
        }
        if (age2 < 0.13) {
          const su = age2 / 0.13;
          star(p, H2X, H2Y, hit2Star, su < 0.3 ? lerp(0.9, 1.4, su / 0.3) : lerp(1.4, 1.05, (su - 0.3) / 0.7), Math.max(0.3, 1 - su * 0.75), su < 0.25 ? [C[4], C[6], WHITE, WHITE] : [C[2], C[4], C[6], WHITE], 1 - smooth(0.65, 1, su), 3.5);
        }
      }

      // Twin-locus resonance lightning bridge + space-shatter cracks across the crushed victim zone (0.16s -> 0.42s)
      if (t >= T_HIT_2 && t < 0.42) {
        const cu = (t - T_HIT_2) / 0.26;
        const ck = cu < 0.65 ? 1 : 1 - (cu - 0.65) / 0.35;
        if (t < T_BOOM + 0.02) {
          let px0 = H1X, py0 = H1Y;
          for (let s = 1; s <= 6; s++) {
            const u = s / 6;
            const jit = s < 6 ? Math.sin(s * 2.7 + t * 80) * 5.5 : 0;
            const px1 = lerp(H1X, H2X, u) + jit, py1 = lerp(H1Y, H2Y, u) - jit * 0.6;
            p.line(px0, py0 + 1, px1, py1 + 1, C[0], 0.95);
            p.line(px0, py0 - 1, px1, py1 - 1, C[3], 0.88);
            p.line(px0, py0, px1, py1, WHITE, 1);
            px0 = px1; py0 = py1;
          }
        }
        const reach = ease.outQuart(Math.min(1, cu * 2.0));
        for (let i = 0; i < airCracks.length; i++) {
          const path = airCracks[i];
          const lim = Math.max(1, Math.floor((path.length - 1) * reach));
          for (let j = 0; j < lim; j++) {
            const [x0, y0] = path[j], [x1, y1] = path[j + 1];
            p.line(x0, y0 + 1, x1, y1 + 1, C[0], ck * 0.9);
            p.line(x0, y0, x1, y1, cu < 0.45 || j < 2 ? WHITE : C[5], ck);
          }
        }
      }

      // ---- 3. ORGANIC JAGGED ABYSSAL VOID-TEAR IMPLOSION (0.28s -> 0.34s, NO smooth circle or comb lines!) ----
      if (t >= T_IMPLODE && t < T_BOOM) {
        const iu = (t - T_IMPLODE) / (T_BOOM - T_IMPLODE);
        // Irregular radial streaks rush inward, keeping the compression focused on the target.
        for (const ray of implodeRays) {
          const r = ray.rOuter - 10 * iu;
          drawShockSpear(p, BX + Math.cos(ray.a) * r, BY + Math.sin(ray.a) * r,
            ray.a + Math.PI, ray.len, ray.w, C[0], C[3], C[6], 0.9);
        }
        // Layered jagged silhouettes create a black void with a broken crimson rim.
        const scale = lerp(1.05, 0.7, iu);
        star(p, BX, BY, voidOuterStar, scale, 1, [C[3], C[4], C[3], C[3]], 0.98, 12);
        star(p, BX, BY, voidInnerStar, scale * 0.75, 1, [C[6], C[0], C[0], C[0]], 1, 12);
      }

      // ---- 4. CATASTROPHIC HIT-RESULT DETONATION & AFTERMATH (0.34s -> 1.75s) ----
      if (t >= T_BOOM) {
        const dtB = t - T_BOOM;

        // Ground rolling dust ring
        const du = clamp(dtB / 0.68);
        if (du < 1) {
          dustRing(p, BX, -1, 16 + 72 * ease.outQuart(du), 6.5 * (1 - 0.45 * du), (1 - du) * 0.75, st.dust, { sy: RSY, brk: smooth(0.25, 0.9, du), maxY: 4 });
        }

        // Scalloped magma-and-soot blast billows
        for (const bp of blastPuffs) {
          const u = (dtB - bp.delay) / bp.life;
          if (u <= 0 || u >= 1) continue;
          const bx = bp.x0 + bp.vx * (dtB - bp.delay) * (1 - 0.42 * u);
          const by = Math.min(-3, bp.y0 + bp.vy * (dtB - bp.delay) * (1 - 0.35 * u) - 14 * u * u);
          drawPuff(p, bx, by, lerp(bp.r0, bp.r1, ease.outCubic(u)), u, C, 0.96);
        }

        // Crackling black-rimmed crimson lightning arcs ("Black Flash") tearing outward across the blast dome!
        for (const arc of blackFlashArcs) {
          const u = (dtB - arc.delay) / arc.dur;
          if (u <= 0 || u >= 1) continue;
          const r0 = smooth(0.35, 1.0, u) * 0.55;
          const r1 = ease.outQuart(Math.min(1, u * 2.2));
          drawBlackFlashArc(p, arc.pts, r0, r1, u < 0.45 ? WHITE : C[5], C[3], C[0], 1 - smooth(0.65, 1, u));
        }

        // Through-target supersonic blow-out shock spears shooting rightward (+x)
        if (dtB < 0.30) {
          const su = dtB / 0.30;
          const sk = 1 - ease.inQuad(su);
          const grow = ease.outQuart(Math.min(1, su * 2.4));
          for (const sp of blowoutSpears) {
            drawShockSpear(p, BX + 6 + su * 14, BY + sp.dy, sp.ang, sp.len * grow, sp.w * (1 - su * 0.5), C[0], C[5], WHITE, sk * 0.96);
          }
        }

        // Triple expanding broken shockwave rings (outer dome with black-crimson contrast + inner tilted ring + wide floor ring)
        const ru = clamp(dtB / 0.44);
        if (ru < 1) {
          brokenRing(p, BX, BY, 15 + 78 * ease.outQuart(ru), 4.8 * (1 - ru), ringSegs1, smooth(0.12, 0.76, ru), ru < 0.24 ? WHITE : C[6], ru < 0.35 ? C[3] : C[0], 1 - ru, 0.92, 0);
          brokenRing(p, BX + 6, BY, 10 + 54 * ease.outCubic(ru), 3.4 * (1 - ru), ringSegs2, smooth(0.16, 0.8, ru), C[6], C[3], (1 - ru) * 0.9, 1.25, 0);
          brokenRing(p, BX, -2, 18 + 92 * ease.outQuart(ru), 3.8 * (1 - ru), ringSegsFloor, smooth(0.18, 0.85, ru), C[6], C[3], 1 - ru, RSY, 6);
        }

        // Towering forward & recoil floor-ripping shockwave crescents
        const cu = clamp(dtB / 0.36);
        if (cu < 1) {
          const ck = 1 - ease.inQuad(cu);
          frontCrescent(p, BX + 16 + 118 * ease.outQuart(cu), 1, 82 * (1 - 0.28 * cu), 13.5 * ck, [WHITE, C[6], C[3]], ck);
          frontCrescent(p, BX - 14 - 68 * ease.outQuart(cu), -1, 50 * (1 - 0.35 * cu), 8.5 * ck, [C[6], C[4], C[1]], ck * 0.85);
        }

        // Catastrophic 18-spike directional Hit-Result starburst + black-rimmed core + anamorphic impact flare
        if (dtB < 0.22) {
          const su = dtB / 0.22;
          const sc = su < 0.22 ? lerp(0.88, 1.48, su / 0.22) : lerp(1.48, 1.06, (su - 0.22) / 0.78);
          const cols = su < 0.18 ? [C[0], C[6], WHITE, WHITE] : su < 0.52 ? [C[0], C[4], C[6], WHITE] : [C[0], C[2], C[5], C[6]];
          star(p, BX, BY, boomStar, sc, Math.max(0.25, 1 - su * 0.8), cols, 1 - smooth(0.65, 1, su), 4.2);
        }
        if (dtB < 0.28) {
          const fu = dtB / 0.28;
          drawImpactFlare(p, BX, BY, 94 * Math.pow(1 - fu, 1.25), 1 - fu, C);
        }
      }

      // Bouncing 3D-faceted rocks, bounce dust puffs, shards & sparks
      for (const k of bounceKicks) {
        const u = k.age / k.life;
        p.disc(k.x, k.y, k.r * (0.8 + 0.7 * u), st.dust, (d) => 0.55 * (1 - u) * (1 - d * d));
      }
      for (const b of bits.list) if (b.kind === B.CHUNK) rock(p, b, st);
      bits.draw(p);
      ps.draw(p);
      lights.draw(p);
    },
  };
}
