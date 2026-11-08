// Crescent, crossing X, ground slam and spiral flame recipes adapted from Sprite Fusion's open-source slash,
// explosion and fire VFX (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, B, Rng, fit, flare, sparkle, clamp, smooth, seg, ease, loopNoise, TAU, WHITE } from "../../core/index.js";
import { swing, through, onSwing, trace, glowAlong, slashEnd, rock, cracks, star, sliver, along } from "./_lib.js";
import { noiseFor, hotFirst, flameTongue, flameBlade, firePuff, floorLight, simDraw } from "../fire/_lib.js";
import { glyph } from "../arcane/_lib.js";

export const meta = {
  name: "Crimson gold claw",
  desc: "Giant beast claw combo: a sweeping gold-rimmed crimson 3-talon arc, a wide crimson-jade cross rend, and a rune slam raising three towering spiral fire pillars.",
  tags: ["melee", "claw", "beast", "boss", "combo", "fire", "gold", "slash", "directional", "one-shot"],
  size: [340, 224],
  origin: [84, 192],
  duration: 2.5,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#14080a", "#3a0e12", "#6e1418", "#a8261c", "#d94a1c", "#f08a24", "#ffcc55", "#fff0c4"],
    gold: ["#3a2408", "#8a5a12", "#d9a227", "#ffeeb0"],
    jade: ["#06181a", "#0d3a3a", "#1f7a6e", "#5fd4bd", "#d8fbf2"],
    bone: ["#0e0d0b", "#2e2b26", "#5c574e", "#918a7c", "#c9c2b2", "#f5f1e4"],
    seed: 7,
  },
};

// Local beast-brawler stance & aggressive lunging combo poses (READY defined locally; never imported from core)
const READY = { x: 0, weapon: "claw", offWeapon: "claw", sa: -0.45, sb: -0.95, crouch: 6, lean: 4, fx: 14, fy: -21, bx: 8, by: -25, ffx: 10, fbx: -9 };
const WIND1 = { ...READY, x: -6, crouch: 7, lean: -5, fx: -5, fy: -36, sa: -2.35, bx: 6, by: -19, sb: -0.35, ffx: 9, fbx: -10 };
const CUT1 = { ...READY, x: 18, crouch: 7, lean: 7, fx: 19, fy: -16, sa: 0.78, bx: -6, by: -24, ffx: 13, fbx: -9, toeB: true, ghost: 1 };
const WIND2 = { ...READY, x: 18, crouch: 9, lean: 4, fx: -5, fy: -15, sa: 1.48, bx: 13, by: -16, sb: 0.92, armsFront: true };
const CUT2A = { ...READY, x: 28, crouch: 4, lean: 6, fx: 18, fy: -33, sa: -0.85, bx: 12, by: -15, sb: 0.9, ghost: 1 };
const CUT2B = { ...READY, x: 34, crouch: 3, lean: 6, fx: 16, fy: -30, sa: -0.62, bx: -4, by: -34, sb: -2.15, armsFront: true, ghost: 1 };
const RAISE3 = { ...READY, x: 36, y: -4, crouch: 1, lean: -4, fx: 2, fy: -38, sa: -1.98, bx: 8, by: -37, sb: -1.82, ffx: 10, fbx: -6, toeB: true };
const SLAM3 = { ...READY, x: 42, crouch: 10, lean: 8, fx: 17, fy: -11, sa: 1.1, bx: 13, by: -12, sb: 0.98, ffx: 14, fbx: -10 };

export const act = {
  target: { x: 128 },
  poses: [
    [-0.34, { ...READY, x: -6 }],
    [-0.12, WIND1],
    [0.0, { ...WIND1, crouch: 8, lean: -6 }],
    [0.08, { ...READY, x: 10, crouch: 3, lean: 5, fx: 16, fy: -33, sa: -0.95, bx: -6, by: -23, ghost: 1 }, "snap"],
    [0.13, CUT1, "snap"],
    [0.36, { ...CUT1, crouch: 6, fx: 17, fy: -18 }],
    [0.62, WIND2],
    [0.68, CUT2A, "snap"],
    [0.82, CUT2B, "snap"],
    [0.86, { ...CUT2B, x: 36, lean: 6, fx: 16, fy: -29, bx: -4, by: -34 }, "snap"],
    [1.14, { ...READY, x: 30, crouch: 5, fx: 14, fy: -24, bx: 4, by: -26 }],
    [1.34, RAISE3],
    [1.43, { ...RAISE3, y: -6, fx: 3, fy: -38, bx: 9, by: -37 }],
    [1.46, SLAM3, "snap"],
    [1.88, { ...SLAM3, crouch: 9, lean: 7 }],
    [2.28, { ...READY, x: 12, crouch: 5 }],
    [2.5, { ...READY, x: 0 }],
  ],
  hits: [
    { t: 0.13, stop: 0.05, shake: 0.14, amp: 2, push: 2.4, straw: 14, y: -24 },
    { t: 0.86, stop: 0.07, shake: 0.2, amp: 3, push: 3.2, straw: 20, y: -26 },
    { t: 1.46, stop: 0.1, shake: 0.36, amp: 4, push: 5.2, straw: 34, y: -8, skin: "char" },
  ],
  dust: [
    { t: 0.13, x: 24, n: 7, dir: 1 },
    { t: 0.86, x: 38, n: 7, dir: 1 },
    { t: 1.46, x: 58, n: 12, dir: 1 },
    { t: 1.46, x: 16, n: 8, dir: -1 },
  ],
};

const NL = noiseFor(0);
const FAST_TONGUES = [[1, 1, 5], [0.46, 0.62, 1]];

/**
 * Single-pass tight-sector 3-talon beast crescent renderer:
 * - Computes exact screen bounding box of the active arc sector [T, U] instead of full [-R..R] circle (4x faster!).
 * - Draws main colossal crescent + optional outer & inner beast-talon ridges in ONE pixel pass with 100% solid pixels (out.a = 1, zero Bayer dither noise).
 * - Width W monotonically narrows from s.W down to 0; goldRim applies strictly to the outer 1~2 px rim.
 */
function drawBeastClaw(p, s, t, ramp, goldRim, hot, talons = true) {
  const u = t - s.t0;
  if (u < 0) return;
  const life = s.sweep + s.hold + s.trail;
  if (u >= life + 0.18) return;
  const age = clamp(u / life);
  const W = s.W * Math.max(0, 1 - Math.pow(age, 1.08));
  const head = ease.outExpo(clamp(u / s.sweep));
  const tail = smooth(s.sweep + s.hold, life, u) * (s.tailEat ?? 0.46);
  const U = s.span * head, T = s.span * tail;
  const n = ramp.length;

  if (W > 0.45 && U - T > 0.02 && u < life) {
    const outerPad = talons ? 11 : 1;
    const innerPad = talons ? W + 14 : W + 1;
    const rMin = Math.max(1, s.R - innerPad), rMax = s.R + outerPad;
    // Tight sector bounding box from 9 sample points along [T, U]
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (let k = 0; k <= 8; k++) {
      const uu = T + ((U - T) * k) / 8;
      const [px0, py0] = onSwing(s, rMin, uu);
      const [px1, py1] = onSwing(s, rMax, uu);
      bx0 = Math.min(bx0, px0, px1);
      bx1 = Math.max(bx1, px0, px1);
      by0 = Math.min(by0, py0, py1);
      by1 = Math.max(by1, py0, py1);
    }
    const cs = Math.cos(s.rot), sn = Math.sin(s.rot), invSy = 1 / s.sy;
    const invSpan = 1 / (U - T);
    const minIdx = n >= 8 ? 2 : 0, maxDrop = n - 1 - minIdx;
    const talonFade = talons && age < 0.78 ? 1 - age / 0.78 : 0;

    p.shade(Math.floor(bx0 - 2), Math.floor(by0 - 2), Math.ceil(bx1 + 2), Math.ceil(by1 + 2), (x, y, out) => {
      const dx = x - s.cx, dy = y - s.cy;
      const rx = dx * cs + dy * sn;
      const ry = (-dx * sn + dy * cs) * invSy;
      const r = Math.hypot(rx, ry);
      if (r < rMin || r > rMax) return;
      let uu = (Math.atan2(ry, rx) - s.a0) * s.dir;
      uu -= Math.floor(uu / TAU) * TAU;
      if (uu > Math.PI * 1.5) uu -= TAU;
      if (uu < T || uu > U) return;

      const v = (uu - T) * invSpan;
      const shape = Math.pow(Math.sin(Math.PI * Math.pow(clamp(v, 0.001, 0.999), s.lens ? 1.0 : 1.35)), 0.62);
      const w = W * shape;
      const dr = s.R - r;

      // 1. Main colossal crescent body (dr in [0, w])
      if (w >= 0.45 && dr >= 0 && dr <= w) {
        const q = dr / w;
        out.a = 1;
        if (hot) {
          out.c = goldRim && dr < 2.0 ? goldRim[3] : q < 0.65 ? ramp[n - 1] : ramp[n - 2];
          return;
        }
        if (goldRim && dr < 2.0 && q < 0.18 && age < 0.68 && v > 0.1) {
          out.c = dr < 1.0 && age < 0.44 && v > 0.28 ? goldRim[3] : goldRim[2];
          return;
        }
        const drop = Math.round(Math.pow(q, 1.15) * maxDrop * 0.72 + (1 - v) * 1.45 + age * 1.65);
        out.c = ramp[n - 1 - clamp(drop, 0, maxDrop)];
        return;
      }

      // 2. Flanking outer & inner razor beast-talon ridges in the same pass
      if (talonFade > 0.05 && v > 0.08 && v < 0.94) {
        const vSub = (v - 0.08) / 0.86;
        const wSub = 5.6 * talonFade * Math.sin(Math.PI * vSub);
        if (wSub < 0.5) return;
        // Outer talon at R + 8.5
        const drOut = s.R + 8.5 - r;
        if (drOut >= 0 && drOut <= wSub) {
          const q = drOut / wSub;
          out.a = 1;
          if (hot) {
            out.c = goldRim ? goldRim[3] : ramp[n - 1];
            return;
          }
          if (goldRim && drOut < 1.4 && q < 0.28) {
            out.c = goldRim[3];
            return;
          }
          const drop = Math.round(q * maxDrop * 0.7 + (1 - vSub) * 1.2 + age * 1.6);
          out.c = ramp[n - 1 - clamp(drop, 0, maxDrop)];
          return;
        }
        // Inner talon at R - W*0.85 - 6
        const rIn = s.R - W * 0.85 - 5.5;
        const drIn = rIn - r;
        if (drIn >= 0 && drIn <= wSub * 0.88) {
          const q = drIn / (wSub * 0.88);
          out.a = 1;
          if (hot) {
            out.c = ramp[n - 1];
            return;
          }
          const drop = Math.round(q * maxDrop * 0.75 + 1 + age * 1.5);
          out.c = ramp[n - 1 - clamp(drop, 0, maxDrop)];
        }
      }
    });

    if (!s.noGlow) {
      const glowCol = ramp[Math.max(0, n - 3)];
      glowAlong(p, s, s.R - W * 0.32, T, U, 10 + W * 0.55, glowCol, (uu) => (0.28 + hot * 0.3) * (1 - age * 0.85) * ((uu - T) * invSpan), 0, 0.48);
    }
  }

  const trEnd = s.traceExtra ?? 0.14;
  const trK = 1 - smooth(s.sweep + s.hold * 0.4, life + trEnd, u);
  if (u > s.sweep * 0.75 && trK > 0.04) {
    const cHi = goldRim ? goldRim[3] : ramp[n - 1];
    const cMid = ramp[Math.max(0, n - 3)];
    const cLo = ramp[Math.max(n >= 8 ? 2 : 0, n - 5)];
    const trCol = trK > 0.64 ? cHi : trK > 0.32 ? cMid : cLo;
    trace(p, s, s.R - 0.5, 0, U, trCol, (uu) => (trK > 0.25 ? 0.95 : trK * 3) * (0.4 + 0.6 * (uu / s.span)), 0, 0.7);
  }
}

function halfFloorRing(p, cx, cy, r, sy, th, alpha, ramp, back) {
  if (alpha <= 0.02 || r <= 0.5 || th <= 0.15) return;
  const rx = r + th, ry = (r + th) * sy + th;
  const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1);
  const y0 = back ? Math.floor(cy - ry - 1) : Math.floor(cy);
  const y1 = back ? Math.floor(cy) : Math.ceil(cy + ry + 1);
  const invR = 1 / r, invRsy = 1 / (r * sy);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    if (back ? dy >= 0 : dy < 0) continue;
    const ny = dy * invRsy;
    if (ny * ny > 1.6) continue;
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) * invR;
      const e = Math.hypot(nx, ny);
      if (e < 0.3) continue;
      const grad = Math.hypot(nx * invR, ny * invRsy);
      const dist = Math.abs(e - 1) / Math.max(1e-4, grad);
      if (dist > th) continue;
      const q = dist / th;
      if (alpha < 0.75 && ((x + y) & 1) && q > 0.45) continue;
      p.px(x, y, ramp[q < 0.28 ? 3 : q < 0.58 ? 2 : q < 0.84 ? 1 : 0]);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8), G = fit(o.gold, 4), J = fit(o.jade, 5), BN = fit(o.bone, 6);
  const H = hotFirst(C);
  const R = new Rng(o.seed), seed = o.seed * 17, floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], G[3], C[6], C[4]] });
  const psJade = new Particles({ rng: R, ground: floor, sparks: [J[4], J[4], J[3], J[2]] });
  const bits = new Bits({ ground: floor }), lights = new Lights();

  const st = { light: BN[5], body: BN[4], shade: BN[3], dust: BN[4], dark: BN[2] };

  // ============================================================================
  // STAGE 1 (0 -> 0.62s): Colossal Beast 3-Talon Crescent (R=122, W=30)
  // Starts right above the beast (~+24, -175), bulges out to x=+156, rakes down to (~+124, -12)
  // ============================================================================
  for (let i = 0; i < 16; i++) {
    const a = R.range(0, TAU), d = R.range(20, 42);
    ps.spawn(P.STREAK, 14 + Math.cos(a) * d, -94 + Math.sin(a) * d, -Math.cos(a) * 260, -Math.sin(a) * 260, R.range(0.05, 0.08), i % 2 === 0 ? G[3] : C[6], 1, (i % 3) * 0.012);
  }
  const s1 = swing({ cx: 28, cy: -64, R: 120, sy: 0.94, rot: 0.14, a0: -1.48, dir: 1, span: 1.88, W: 30, t0: 0.08, sweep: 0.06, hold: 0.05, trail: 0.31, tailEat: 0.44, traceExtra: 0.12 });
  const end1 = slashEnd(s1);

  const jadeShards1 = Array.from({ length: 18 }, (_, i) => {
    const u = s1.span * (0.08 + 0.86 * (i / 17));
    const [x0, y0] = onSwing(s1, s1.R + 13 + (i % 3) * 4, u);
    return {
      x0, y0,
      vx: R.range(48, 112),
      vy: R.range(8, 46),
      t0: 0.12 + (i / 18) * 0.065,
      life: R.range(0.28, 0.4),
      size: i % 3 === 0 ? 2 : 1,
    };
  });
  const slashSlivers1 = Array.from({ length: 5 }, (_, i) => ({
    a: -0.55 + i * 0.28 + R.range(-0.05, 0.05),
    r: 14 + R.range(0, 6),
    v: R.range(145, 220),
    arc: R.range(0.24, 0.38),
  }));

  // ============================================================================
  // STAGE 2 (0.62 -> 1.34s): Giant 3-Talon Cross-Claw Rend at (X2=126, Y2=-76)
  // ============================================================================
  const X2 = 126, Y2 = -76, CLOSE = 0.86;
  const s2a = through(X2, Y2, -0.74, -1, 140, 1.16, 0.5, { W: 22, t0: 0.68, sweep: 0.06, hold: 0.16, trail: 0.23, lens: true, tailEat: 0.4 });
  const s2b = through(X2, Y2, -2.4, 1, 140, 1.16, 0.5, { W: 22, t0: 0.82, sweep: 0.06, hold: 0.08, trail: 0.23, lens: true, tailEat: 0.4 });
  const JADE_BLADE = [J[2], J[3], J[3], J[4], J[4]];
  const rays2 = Array.from({ length: 10 }, (_, i) => ({
    a: (i / 10) * TAU + 0.2 + R.range(-0.06, 0.06),
    L: R.range(20, 34),
  }));

  // ============================================================================
  // STAGE 3 (1.34 -> 2.50s): Cataclysmic Beast Ground Slam & 3 Towering Fire Pillars
  // ============================================================================
  const X3 = 98, SLAM_T = 1.46;
  const slamChargeL = swing({ cx: 38, cy: -74, R: 56, sy: 1, rot: 0, a0: 2.35, dir: 1, span: 1.55, W: 9, t0: 1.34, sweep: 0.07, hold: 0.01, trail: 0.04, tailEat: 0.7, noGlow: true, traceExtra: 0.01 });
  const slamChargeR = swing({ cx: 46, cy: -74, R: 62, sy: 1, rot: 0, a0: 0.85, dir: -1, span: 1.55, W: 9, t0: 1.34, sweep: 0.07, hold: 0.01, trail: 0.04, tailEat: 0.7, noGlow: true, traceExtra: 0.01 });
  const slamArc = swing({ cx: 30, cy: -66, R: 94, sy: 1, rot: 0, a0: -1.68, dir: 1, span: 2.48, W: 26, t0: 1.415, sweep: 0.045, hold: 0.02, trail: 0.08, tailEat: 0.68, traceExtra: 0.05 });
  const lines = cracks(R, X3, 10, 78, 8, 0.28);
  const slamSpikes = [-Math.PI, -2.72, -2.22, -1.6, -0.98, -0.42, 0].map((a, i) => ({
    a: a + R.range(-0.06, 0.06),
    len: (i === 0 || i === 6 ? 44 : i === 3 ? 32 : 20) + R.range(0, 6),
    w: 2.6 + R.range(0, 0.8),
  }));
  const runes = Array.from({ length: 12 }, (_, k) => ({ g: (k + 0.5) * (TAU / 12), gi: (k * 3 + 1) % 8 }));
  const groundEmbers = Array.from({ length: 44 }, (_, i) => {
    const a = R.range(0, TAU), rr = R.range(10, 144);
    const die = i < 4 ? R.range(2.43, 2.475) : R.range(1.94, 2.38);
    return { x: X3 + Math.cos(a) * rr, y: Math.sin(a) * rr * 0.17, r: i < 4 ? R.range(10, 60) : rr, die, ph: R.range(0, TAU), big: i < 4 || R.chance(0.28) };
  });

  const pillars = [
    { x: 56, h: 126, w: 12.0, t0: 1.5, tBreak: 1.84, ph: 0.4, seed: 13, lit: false, broke: false },
    { x: 128, h: 154, w: 14.5, t0: 1.545, tBreak: 1.88, ph: 2.5, seed: 31, lit: false, broke: false },
    { x: 202, h: 178, w: 17.0, t0: 1.59, tBreak: 1.92, ph: 4.6, seed: 53, lit: false, broke: false },
  ];
  // Irregular, multi-scale flame-ember clusters (random heights, random scatter, staggered wink-out — NO S-bead chains!)
  const pillarPuffs = pillars.flatMap((pl) =>
    Array.from({ length: 11 }, () => {
      const yFrac = R.range(0.06, 0.92);
      const side = R.sign();
      return {
        x0: pl.x + side * R.range(0, pl.w * 0.85),
        y0: -10 - yFrac * (pl.h - 18),
        vx: side * R.range(14, 58) + R.range(-12, 12),
        vy: -R.range(12, 46),
        size: R.pick([3.4, 4.6, 5.8, 7.2]) * (1.1 - 0.3 * yFrac),
        t0: pl.tBreak - 0.02 + R.range(0, 0.11),
        life: R.range(0.2, 0.42),
        frac: R.next(),
      };
    })
  );

  let t = 0, st1Hit = false, st2Charge = false, st2Cross = false, st3Charge = false, st3Hit = false;

  const clampParticles = (list, maxT) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const q = list[i];
      if (q.life === q.max && t + q.life > maxT) q.life = q.max = Math.max(0.02, maxT - t);
      if (q.k === P.MOTE && q.y > 0) {
        q.y = -0.5;
        q.vy = -Math.abs(q.vy) * 0.25;
      }
    }
  };

  function drawPillarHelix(p, pl, h, w0, breakK, back) {
    const NZ = (rate, s0, off = 0) => loopNoise(t * rate * 0.14 + off * 0.1, 1.3, s0);
    const GOLD_HELIX = [G[3], C[7], G[2], C[5], C[4], C[3]];
    const invH = 1 / h;
    for (let s = 0; s < 2; s++) {
      const baseA = s * Math.PI + pl.ph;
      for (let y = -3; y >= -h * 0.94; y--) {
        const v = -y * invH;
        const ang = baseA - v * TAU * 1.85 + t * 11.5;
        const sn = Math.sin(ang);
        if ((sn < 0) !== back) continue;
        const cs = Math.cos(ang);

        const wave = 0.5 + 0.5 * Math.sin(v * 15 + s * 2.4 - t * 9 + pl.ph);
        const pinch = breakK > 0 ? clamp((wave - breakK * 1.15) * 2.4, 0, 1) : 1;
        if (pinch <= 0.08) continue;

        const foot = y > -18 ? 1 + 0.36 * (1 + y / 18) ** 2 : 1;
        const topTaper = v > 0.76 ? 1 - smooth(0.76, 0.95, v) * 0.72 : 1;
        const rHelix = w0 * foot * topTaper * 1.05 + 2.0 + Math.sin(v * 11 - t * 8 + s) * 1.2;
        const hx = pl.x + cs * rHelix;
        const absCs = Math.abs(cs);
        const bw = (2.8 + 2.2 * absCs * absCs) * topTaper * pinch;
        const invBw = 1 / Math.max(0.65, bw);

        for (let dx = -Math.ceil(bw); dx <= Math.ceil(bw); dx++) {
          const q = Math.abs(dx) * invBw;
          if (q > 1) continue;
          const col = q < 0.34 ? (s === 0 ? G[3] : C[7]) : q < 0.68 ? (s === 0 ? G[2] : C[6]) : C[5];
          p.px(hx + dx, y, col);
        }

        if (absCs > 0.94 && ((-y) | 0) % 36 === 0 && breakK < 0.32) {
          const dirX = cs > 0 ? 0.38 : -0.38;
          flameBlade(p, hx, y, dirX, -0.92, (13 + 5 * (1 - v)) * pinch, 2.2 * pinch, -cs * 2.5, NZ, seed + pl.seed + ((-y) | 0), GOLD_HELIX);
        }
      }
    }
  }

  return {
    update(dt) {
      t += dt;
      if (!st1Hit && t >= 0.13) {
        st1Hit = true;
        lights.add(136, -76, 118, C[5], 0.64, 0.34);
        lights.add(end1.x, end1.y, 58, G[3], 0.55, 0.22);
        for (let i = 0; i < 22; i++) {
          const u = s1.span * R.range(0.18, 1.0), [sx, sy] = onSwing(s1, s1.R + 4, u);
          const a = R.range(-0.6, 0.55), sp = R.range(160, 330);
          ps.spawn(P.SPARK, sx, sy, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.18, 0.34));
        }
        for (let i = 0; i < 14; i++) {
          const u = s1.span * R.range(0.16, 0.92), [jx, jy] = onSwing(s1, s1.R + 12, u);
          psJade.spawn(P.SPARK, jx, jy, R.range(95, 225), R.range(-40, 65), R.range(0.2, 0.34));
        }
      }
      if (!st2Charge && t >= 0.62) {
        st2Charge = true;
        for (let i = 0; i < 12; i++) {
          const a = R.range(0, TAU), d = R.range(16, 30);
          ps.spawn(P.STREAK, 46 + Math.cos(a) * d, -32 + Math.sin(a) * d, -Math.cos(a) * 220, -Math.sin(a) * 220, 0.055, i % 2 ? G[3] : J[4]);
        }
      }
      if (!st2Cross && t >= CLOSE) {
        st2Cross = true;
        lights.add(X2, Y2, 110, G[2], 0.65, 0.34);
        lights.add(X2, Y2, 34, WHITE, 0.85, 0.09);
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * TAU + R.range(-0.14, 0.14), sp = R.range(180, 365);
          ps.spawn(P.SPARK, X2, Y2, Math.cos(a) * sp, Math.sin(a) * sp - 18, R.range(0.18, 0.32), WHITE, 1, R.range(0.015, 0.04));
        }
        for (let i = 0; i < 18; i++) {
          const a = ((i + 0.5) / 18) * TAU + R.range(-0.14, 0.14), sp = R.range(180, 365);
          psJade.spawn(P.SPARK, X2, Y2, Math.cos(a) * sp, Math.sin(a) * sp - 18, R.range(0.18, 0.32), WHITE, 1, R.range(0.015, 0.04));
        }
      }
      if (!st3Charge && t >= 1.34) {
        st3Charge = true;
        for (let i = 0; i < 14; i++) {
          const a = R.range(0, TAU), d = R.range(18, 36);
          ps.spawn(P.STREAK, 42 + Math.cos(a) * d, -124 + Math.sin(a) * d, -Math.cos(a) * 250, -Math.sin(a) * 250, R.range(0.06, 0.095), G[3]);
        }
      }
      if (!st3Hit && t >= SLAM_T) {
        st3Hit = true;
        lights.add(X3, -24, 92, C[5], 0.62, 0.42);
        lights.add(X3, -8, 36, WHITE, 0.8, 0.09);
        for (let i = 0; i < 14; i++) {
          const s = R.sign();
          bits.add({ kind: B.CHUNK, x: X3 + s * R.range(0, 14), y: -2, vx: s * R.range(38, 138), vy: -R.range(135, 295), g: 1, drag: 0.4, bounce: 0.36, life: R.range(0.64, 0.88), a: R.range(0, TAU), va: R.range(-14, 14), s: R.pick([1, 2, 2, 3]) });
        }
        for (let i = 0; i < 32; i++) {
          const a = -Math.PI / 2 + R.range(-1.25, 1.25), sp = R.range(135, 340);
          ps.spawn(P.SPARK, X3 + R.range(-10, 10), -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.22, 0.46));
        }
      }
      for (const pl of pillars) {
        if (!pl.lit && t >= pl.t0) {
          pl.lit = true;
          lights.add(pl.x, -pl.h * 0.42, 56, C[5], 0.52, 0.44);
          for (let j = 0; j < 14; j++) {
            const a = -Math.PI / 2 + R.range(-0.82, 0.82), sp = R.range(125, 290);
            ps.spawn(P.SPARK, pl.x + R.range(-6, 6), -4, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.24, 0.48), WHITE, 1);
          }
          for (let j = 0; j < 10; j++) {
            ps.spawn(P.EMBER, pl.x + R.range(-pl.w, pl.w), -R.range(12, pl.h * 0.8), R.range(-36, 36), -R.range(38, 92), R.range(0.42, 0.68), j % 2 ? G[3] : C[6], R.chance(0.4) ? 2 : 1, 0.08);
          }
        }
        // Scatter golden-crimson sparks & rising embers organically when each pillar shatters at pl.tBreak
        if (!pl.broke && t >= pl.tBreak) {
          pl.broke = true;
          for (let j = 0; j < 16; j++) {
            const sy = -R.range(14, pl.h * 0.92);
            ps.spawn(P.SPARK, pl.x + R.range(-pl.w * 0.7, pl.w * 0.7), sy, R.range(-95, 95), R.range(-70, 35), R.range(0.22, 0.42));
          }
          for (let j = 0; j < 10; j++) {
            const sy = -R.range(16, pl.h * 0.88);
            ps.spawn(P.EMBER, pl.x + R.range(-pl.w, pl.w), sy, R.range(-38, 42), -R.range(24, 68), R.range(0.32, 0.5), j % 2 ? G[3] : C[5], R.chance(0.45) ? 2 : 1);
          }
        }
      }
      bits.update(dt);
      ps.update(dt);
      psJade.update(dt);
      clampParticles(ps.list, 2.38);
      clampParticles(psJade.list, 2.38);
      lights.update(dt);
    },
    drawBack(p) {
      if (t >= meta.duration - 1e-6) return;
      const RING_RAMP = [G[1], G[2], G[3], C[7]];
      if (t >= 1.34 && t < SLAM_T) {
        const ck = (t - 1.34) / (SLAM_T - 1.34), cr = 24 + 16 * ease.outQuad(ck);
        floorLight(p, X3, 0.5, cr + 14, 7, G[2], 0.36 * ck);
        halfFloorRing(p, X3, 0.5, cr, 0.17, 2.5, 0.78 + 0.22 * ck, RING_RAMP, true);
      }
      const q = t - SLAM_T;
      if (q >= 0) {
        const scorchFade = 1 - smooth(2.3, 2.48, t);
        const heat = Math.pow(clamp(1 - q / 0.88), 1.25);
        if (scorchFade > 0.02) {
          floorLight(p, X3 + 30, 0.5, 84, 10, C[5], 0.36 * (0.25 + 0.75 * heat) * scorchFade);
          for (let dx = -24; dx <= 24; dx++) {
            const u = dx / 24, d = Math.round(3.5 * (1 - u * u));
            for (let dy = 0; dy < d; dy++) {
              const col = heat > 0.55 ? C[5] : heat > 0.25 ? C[3] : C[2];
              p.px(X3 + dx, dy, col);
            }
            if (d > 0) p.px(X3 + dx, d, heat > 0.4 ? G[2] : BN[3]);
          }
        }
        const rk = q / 0.46;
        if (rk < 1) {
          const rr = 12 + 140 * ease.outCubic(rk), th = 3.8 - 2.6 * rk, al = 1 - smooth(0.68, 1, rk);
          halfFloorRing(p, X3, 0.5, rr, 0.17, th, al, RING_RAMP, true);
          for (const rn of runes) {
            if (Math.sin(rn.g) >= 0) continue;
            const rx = X3 + Math.cos(rn.g) * rr, ry = 0.5 + Math.sin(rn.g) * rr * 0.17;
            glyph(p, rn.gi, rx, ry - 1, rk < 0.45 ? G[3] : G[2], al, G[1]);
          }
        }
        for (const pl of pillars) {
          const pq = t - pl.t0;
          if (pq < 0) continue;
          const breakK = t < pl.tBreak - 0.02 ? 0 : seg(t, pl.tBreak - 0.02, pl.tBreak + 0.18);
          if (breakK >= 1) continue;
          const h = pl.h * ease.outQuart(clamp(pq / 0.09));
          const w0 = pl.w * (1 - breakK * 0.55);
          drawPillarHelix(p, pl, h, w0, breakK, true);
        }
      }
      simDraw(p, ps, H, "back");
    },
    draw(p) {
      if (t >= meta.duration - 1e-6) return;
      const N = (rate, s0 = 0, off = 0) => NL(t, rate, s0, off);
      const RING_RAMP = [G[1], G[2], G[3], C[7]];

      // ---- STAGE 1: Colossal 3-Talon Beast Crescent
      if (t < 0.085) {
        const ck = Math.sin((t / 0.085) * Math.PI);
        sparkle(p, 14, -94, 13 * ck, G[3], C[6], 0.8);
        p.glow(14, -94, 32, C[5], 0.48 * ck);
      }
      if (t < 0.62) {
        const hot1 = t >= 0.125 && t < 0.155 ? 1 : 0;
        drawBeastClaw(p, s1, t, C, G, hot1, true);

        if (t >= 0.11 && t < 0.34) {
          const gk = 1 - (t - 0.11) / 0.23;
          floorLight(p, end1.x, 0.5, 64, 10, C[5], 0.45 * gk);
          if (t < 0.23) {
            const sk = (t - 0.11) / 0.12;
            sparkle(p, end1.x, end1.y, 13 * (1 - sk), WHITE, G[3], 0.78);
            for (const sl of slashSlivers1) {
              sliver(p, end1.x, end1.y, sl.a, sl.r + sl.v * (t - 0.11), sl.arc * (1 - 0.4 * sk), sk < 0.5 ? G[3] : C[6], 1);
            }
          }
        }
        for (const js of jadeShards1) {
          const age = t - js.t0;
          if (age < 0 || age >= js.life) continue;
          const k = 1 - age / js.life;
          const jx = Math.round(js.x0 + js.vx * age * (1 - 0.22 * (age / js.life)));
          const jy = Math.min(-2, Math.round(js.y0 + js.vy * age + 42 * age * age));
          if (k < 0.2 && ((jx + jy) & 1)) continue;
          const cCore = k > 0.35 ? J[4] : J[3];
          const cRim = k > 0.35 ? J[3] : J[2];
          p.px(jx, jy, cCore);
          p.px(jx + 1, jy, cRim);
          p.px(jx, jy - 1, cRim);
          if (js.size > 1 && k > 0.3) {
            p.px(jx - 1, jy, cRim);
            p.px(jx, jy + 1, cRim);
            p.px(jx + 2, jy - 1, J[3]);
          }
          p.glow(jx, jy, 6, J[3], 0.32 * k);
        }
      }

      // ---- STAGE 2: Giant 3-Talon Cross-Claw Rend
      if (t >= 0.62 && t < 1.34) {
        const hot2 = t >= CLOSE && t < CLOSE + 0.066 ? 1 : 0;
        if (t < 1.15) {
          drawBeastClaw(p, s2a, t, C, G, hot2, true);
          drawBeastClaw(p, s2b, t, JADE_BLADE, null, hot2, true);
        }
        if (t >= 1.06 && t < 1.34) {
          const xk = 1 - smooth(1.1, 1.33, t);
          trace(p, s2a, s2a.R - 0.5, s2a.span * 0.16, s2a.span * 0.84, C[5], xk * 0.85, 0, 0.72);
          trace(p, s2b, s2b.R - 0.5, s2b.span * 0.16, s2b.span * 0.84, J[3], xk * 0.85, 0, 0.72);
        }
        const bq = t - CLOSE;
        if (bq >= 0 && bq < 0.066) {
          p.circle(X2, Y2, 6.2, BN[4]);
          p.circle(X2, Y2, 4.4, BN[5]);
          p.line(X2 - 17, Y2, X2 + 17, Y2, BN[5]);
          p.line(X2, Y2 - 17, X2, Y2 + 17, BN[5]);
        }
        if (bq >= 0 && bq < 0.11) {
          const pull = smooth(0.055, 0.11, bq);
          for (const ry of rays2) {
            const d0 = 9 + ry.L * 0.55 * pull, d1 = 10 + ry.L;
            if (d1 > d0) {
              const ca = Math.cos(ry.a), sa = Math.sin(ry.a), nx = -sa, ny = ca;
              const x0 = X2 + ca * d0, y0 = Y2 + sa * d0;
              const x1 = X2 + ca * d1, y1 = Y2 + sa * d1;
              const xm = (x0 + x1) * 0.5, ym = (y0 + y1) * 0.5;
              if (pull < 0.5) p.line(x0 + nx, y0 + ny, xm, ym, BN[4]);
              p.line(x0, y0, x1, y1, pull < 0.5 ? BN[5] : BN[4]);
            }
          }
        }
      }

      // ---- STAGE 3: Cataclysmic Beast Slam, Golden Rune Shockwave & 3 Towering Fire Pillars
      if (t >= 1.34 && t < SLAM_T) {
        const ck = (t - 1.34) / (SLAM_T - 1.34), cr = 24 + 16 * ease.outQuad(ck);
        halfFloorRing(p, X3, 0.5, cr, 0.17, 2.5, 0.78 + 0.22 * ck, RING_RAMP, false);
        if (t < 1.425) {
          drawBeastClaw(p, slamChargeL, t, C, G, 0, false);
          drawBeastClaw(p, slamChargeR, t, C, G, 0, false);
          sparkle(p, 42, -132, 10 * ck, G[3], C[6], 0.75);
        }
      }
      if (t >= 1.415 && t < 1.56) {
        const hot3 = t >= SLAM_T && t < SLAM_T + 0.045 ? 1 : 0;
        drawBeastClaw(p, slamArc, t, C, G, hot3, true);
      }

      const q = t - SLAM_T;
      if (q >= 0) {
        const scorchFade = 1 - smooth(2.3, 2.48, t);
        const crackHeat = Math.pow(clamp(1 - q / 0.96), 1.15);
        if (scorchFade > 0.04) {
          for (const c of lines) {
            const reach = 78 * ease.outCubic(clamp((q - c.at * 0.05) / 0.09)) * (c.fork ? 0.42 : 1);
            if (reach > 0)
              along(c.pts, reach, (x0, y0, x1, y1, d) => {
                const lh = crackHeat * (1 - d / 90);
                const col = lh > 0.72 ? WHITE : lh > 0.5 ? G[3] : lh > 0.3 ? C[6] : lh > 0.14 ? C[5] : C[3];
                p.line(x0, y0 + 1, x1, y1 + 1, col, scorchFade > 0.35 ? 1 : scorchFade * 2.5);
                if (lh > 0.24 && (d | 0) % 12 < 2) p.glow(x1, y1 + 1, 6, C[5], 0.25 * lh * scorchFade);
              });
          }
        }

        const dk = (q - 0.01) / 0.24;
        if (dk >= 0 && dk < 1) {
          const dr = 18 + 54 * ease.outCubic(dk), dth = Math.max(1.2, 4.2 * (1 - dk));
          p.shade(X3 - dr - 2, -dr - 2, X3 + dr + 2, 0, (x, y, out) => {
            const e = dr - Math.hypot(x - X3, y);
            if (e < 0 || e > dth || y > -0.5) return;
            if (dk > 0.68 && ((x + y) & 1)) return;
            out.c = e < dth * 0.36 ? G[3] : e < dth * 0.72 ? C[6] : C[5];
            out.a = 1;
          });
        }

        const rk = q / 0.46;
        if (rk < 1) {
          const rr = 12 + 140 * ease.outCubic(rk), th = 3.8 - 2.6 * rk, al = 1 - smooth(0.68, 1, rk);
          halfFloorRing(p, X3, 0.5, rr, 0.17, th, al, RING_RAMP, false);
          for (const rn of runes) {
            if (Math.sin(rn.g) < 0) continue;
            const rx = X3 + Math.cos(rn.g) * rr, ry = 0.5 + Math.sin(rn.g) * rr * 0.17;
            glyph(p, rn.gi, rx, ry - 1, rk < 0.5 ? G[3] : G[2], al, G[1]);
            p.glow(rx, ry - 2, 7, G[3], 0.28 * (1 - rk));
          }
        }

        const curR = rk < 1 ? 12 + 140 * ease.outCubic(rk) : 152;
        for (const ge of groundEmbers) {
          if (ge.r > curR || t >= ge.die) continue;
          const ek = clamp((ge.die - t) / 0.45);
          if (ek < 0.32 && Math.sin(t * 40 + ge.ph) < 0) continue;
          p.px(ge.x, ge.y, ek > 0.55 ? G[3] : G[2]);
          if (ge.big) p.glow(ge.x, ge.y, 4, G[2], 0.24 * ek);
        }

        if (q < 0.066) {
          const hot = q < 0.033, rx = hot ? 38 : 28, ry = hot ? 5 : 3.5;
          p.ellipse(X3, 0, rx + 4, ry + 1.5, hot ? G[3] : C[6]);
          p.ellipse(X3, 0, rx, ry, hot ? WHITE : C[7]);
          star(p, X3, -1, slamSpikes, hot ? 1 : 1.25, hot ? 1 : 0.65, WHITE, G[3], C[7], C[5]);
          flare(p, X3, -4, hot ? 38 : 24, 0.9, [C[4], C[6], G[3], WHITE]);
        }

        for (const pf of pillarPuffs) {
          const age = t - pf.t0;
          if (age <= 0 || age >= pf.life) continue;
          const k = 1 - age / pf.life;
          const drag = (1 - Math.exp(-3.2 * age)) / 3.2;
          const bx = pf.x0 + pf.vx * drag;
          const by = Math.max(-182, pf.y0 + pf.vy * age);
          firePuff(p, bx, by, k, pf.size, pf.frac, H, 0.14);
        }

        for (const pl of pillars) {
          const pq = t - pl.t0;
          if (pq < 0) continue;
          const breakK = t < pl.tBreak ? 0 : seg(t, pl.tBreak, pl.tBreak + 0.22);
          if (breakK >= 1) continue;
          const grow = ease.outQuart(clamp(pq / 0.09));
          const pop = t < pl.tBreak ? 1 + 0.28 * Math.exp(-pq * 10) : 1 - breakK * 0.5;
          const fullH = pl.h * grow;
          const w0 = pl.w * pop;
          if (fullH < 3 || w0 < 0.8) continue;

          if (pq < 0.07) {
            const ek = 1 - pq / 0.07;
            p.ellipse(pl.x, -1, (w0 + 8) * ek, 4 * ek, G[3]);
            p.ellipse(pl.x, -1.5, (w0 + 3) * ek, 2.5 * ek, WHITE);
          }

          if (breakK < 0.5) {
            const ck = 1 - breakK / 0.5;
            const th = Math.min(187 - fullH, (17 + 9 * (0.5 + 0.5 * N(3.2, pl.seed))) * ck);
            if (th > 3) {
              flameTongue(p, pl.x - w0 * 0.24, -fullH + 8, th * 0.88, 3.6 * ck, 0.8, N, pl.seed + 7, H, FAST_TONGUES);
              flameTongue(p, pl.x + w0 * 0.24, -fullH + 8, th, 3.8 * ck, -0.8, N, pl.seed + 19, H, FAST_TONGUES);
            }
          }

          const invFullH = 1 / Math.max(1, fullH);
          for (let y = 0; y >= -fullH; y--) {
            const v = -y * invFullH;
            const knot = 0.5 + 0.5 * Math.sin(v * 17.5 - t * 12 + pl.ph) * Math.cos(v * 7.3 + pl.seed);
            const pinch = breakK > 0 ? clamp((knot - breakK * 1.05 + 0.32 * (1 - breakK)) * 2.1, 0, 1) : 1;
            if (pinch <= 0.06) continue;

            const foot = (y > -16 ? 1 + 0.35 * (1 + y / 16) ** 2 : 1) * (1 - breakK * 0.4);
            const rCore = Math.max(0.6, w0 * foot * (1 - v * 0.68) * pinch);
            const cx = pl.x + Math.sin(v * 7.2 - t * 20 + pl.ph) * (1.6 + 3.2 * v * (1 - 0.25 * v));
            const spin = -t * 21 + v * 9.2 + pl.ph;
            const sSpin = Math.sin(spin);
            const bulgeL = 0.74 + 0.4 * (0.5 - 0.5 * sSpin);
            const bulgeR = 0.74 + 0.4 * (0.5 + 0.5 * sSpin);
            const rMax = rCore * Math.max(bulgeL, bulgeR);
            const invL = 1 / Math.max(0.5, rCore * bulgeL);
            const invR = 1 / Math.max(0.5, rCore * bulgeR);

            for (let x = Math.floor(cx - rMax - 1); x <= Math.ceil(cx + rMax + 1); x++) {
              const rawDx = x + 0.5 - cx;
              const dx = rawDx * (rawDx < 0 ? invL : invR);
              const qEdge = Math.abs(dx);
              if (qEdge > 1) continue;
              const th = dx * (2.5 + 0.6 * dx * dx);
              const sBand = 0.5 + 0.5 * Math.sin(th + spin);
              if (v > 0.76 && sBand < 0.28 + (v - 0.76) * 2.0) continue;

              let ci;
              if (qEdge < 0.32 && v < 0.7) ci = sBand > 0.45 ? 7 : 6;
              else if (sBand > 0.68) ci = v < 0.45 ? 7 : v < 0.78 ? 6 : 5;
              else if (sBand > 0.36) ci = qEdge < 0.65 ? (v < 0.55 ? 6 : 5) : 4;
              else ci = qEdge < 0.6 ? 4 : v > 0.72 ? 2 : 3;

              if (breakK > 0) ci = Math.max(2, ci - Math.floor(breakK * 1.8));
              p.px(x, y, C[ci]);
            }

            if ((-y) % 34 === 0 && -y > 16) {
              p.glow(cx, y, 26, C[5], 0.26 * (1 - breakK));
            }
          }

          const helixBreak = t < pl.tBreak - 0.02 ? 0 : seg(t, pl.tBreak - 0.02, pl.tBreak + 0.18);
          if (helixBreak < 1) drawPillarHelix(p, pl, fullH, w0 * (1 - helixBreak * 0.25), helixBreak, false);

          if (breakK < 0.6) {
            const bk = 1 - breakK / 0.6;
            for (let i = -1; i <= 1; i++) {
              flameTongue(p, pl.x + i * (w0 * 0.48), 1, (14 - Math.abs(i) * 2) * bk, 3.0 * bk, i * 1.1, N, pl.seed + 90 + i * 7, H, FAST_TONGUES);
            }
          }
          floorLight(p, pl.x, 0.5, w0 * 2.2, 6, C[5], 0.34 * (1 - breakK));
        }
      }

      for (const b of bits.list) rock(p, b, st);
      simDraw(p, ps, H, "front");
      psJade.draw(p, "front");
      lights.draw(p);
    },
  };
}
