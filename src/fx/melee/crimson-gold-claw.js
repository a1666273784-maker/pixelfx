// Crescent, crossing X, ground slam and spiral flame recipes adapted from Sprite Fusion's open-source slash,
// explosion and fire VFX (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, PF, B, Rng, fit, band, sparkle, clamp, smooth, ease, rand, TAU, WHITE } from "../../core/index.js";
import { swing, through, onSwing, smear, trace, glowAlong, slashEnd, shavings, rock, cracks, along } from "./_lib.js";
import { noiseFor, pnoise, hotFirst, flameTongue, smokePuff, simDraw } from "../fire/_lib.js";
import { glyph } from "../arcane/_lib.js";

export const meta = {
  name: "Crimson gold claw",
  desc: "Three-beat claw combo: a gold-rimmed crimson crescent with jade flecks, a crimson-jade X cross with bone-white burst, and a rune slam raising three spiral fire pillars.",
  tags: ["melee", "claw", "combo", "fire", "gold", "slash", "combat", "directional", "one-shot"],
  size: [224, 128],
  origin: [80, 104],
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

// Local stance & combo poses (READY defined locally; never imported from core)
const READY = { x: 0, weapon: "claw", offWeapon: "claw", sa: -0.4, sb: -0.9, crouch: 5, lean: 3, fx: 14, fy: -21, bx: 8, by: -25, ffx: 9, fbx: -8 };
const WIND1 = { ...READY, x: -4, crouch: 5, lean: -4, fx: -4, fy: -35, sa: -2.3, bx: 7, by: -19, sb: -0.35, ffx: 8, fbx: -9 };
const CUT1 = { ...READY, x: 2, crouch: 6, lean: 6, fx: 18, fy: -16, sa: 0.72, bx: -6, by: -24, ffx: 12, fbx: -9, toeB: true, ghost: 1 };
const WIND2 = { ...READY, x: 2, crouch: 8, lean: 3, fx: -5, fy: -15, sa: 1.45, bx: 13, by: -16, sb: 0.9, armsFront: true };
const CUT2A = { ...READY, x: 4, crouch: 4, lean: 5, fx: 17, fy: -32, sa: -0.8, bx: 12, by: -15, sb: 0.9, ghost: 1 };
const CUT2B = { ...READY, x: 5, crouch: 3, lean: 5, fx: 15, fy: -29, sa: -0.6, bx: -4, by: -33, sb: -2.1, armsFront: true, ghost: 1 };
const RAISE3 = { ...READY, x: 6, y: -2, crouch: 1, lean: -3, fx: 2, fy: -38, sa: -1.95, bx: 8, by: -37, sb: -1.8, ffx: 10, fbx: -6, toeB: true };
const SLAM3 = { ...READY, x: 8, crouch: 9, lean: 8, fx: 16, fy: -12, sa: 1.05, bx: 12, by: -13, sb: 0.95, ffx: 13, fbx: -9 };

export const act = {
  target: { x: 62 },
  poses: [
    [-0.34, { ...READY, x: -4 }],
    [-0.12, WIND1],
    [0.0, { ...WIND1, crouch: 6, lean: -5 }],
    [0.08, { ...READY, x: 1, crouch: 3, lean: 4, fx: 15, fy: -32, sa: -0.9, bx: -6, by: -23, ghost: 1 }, "snap"],
    [0.13, CUT1, "snap"],
    [0.36, { ...CUT1, crouch: 5, fx: 16, fy: -18 }],
    [0.62, WIND2],
    [0.68, CUT2A, "snap"],
    [0.82, CUT2B, "snap"],
    [0.86, { ...CUT2B, x: 6, lean: 5, fx: 15, fy: -28, bx: -4, by: -33 }, "snap"],
    [1.14, { ...READY, x: 5, crouch: 4, fx: 13, fy: -24, bx: 4, by: -26 }],
    [1.34, RAISE3],
    [1.43, { ...RAISE3, y: -3, fx: 3, fy: -38, bx: 9, by: -37 }],
    [1.46, SLAM3, "snap"],
    [1.86, { ...SLAM3, crouch: 8, lean: 6 }],
    [2.28, { ...READY, x: 3, crouch: 5 }],
    [2.5, { ...READY, x: 0 }],
  ],
  hits: [
    { t: 0.13, stop: 0.04, shake: 0.09, amp: 1, push: 1.3, straw: 8, y: -22 },
    { t: 0.86, stop: 0.06, shake: 0.14, amp: 2, push: 1.9, straw: 13, y: -24 },
    { t: 1.46, stop: 0.08, shake: 0.3, amp: 3, push: 3.3, straw: 24, y: -8, skin: "char" },
  ],
  dust: [
    { t: 0.13, x: 12, n: 5, dir: 1 },
    { t: 0.86, x: 16, n: 5, dir: 1 },
    { t: 1.46, x: 24, n: 10, dir: 1 },
    { t: 1.46, x: -4, n: 6, dir: -1 },
  ],
};

const NL = noiseFor(0);
// 3-layer flameTongue specification (outer crimson -> orange -> white-hot heart)
const TONGUE_LAYERS = [[1, 1, 6], [0.68, 0.8, 4], [0.34, 0.48, 1]];

/**
 * Crescent claw arc:
 * - Width W monotonically decreases from s.W down to 0 over [0, life].
 * - Color cools radially inward (white-hot -> orange -> crimson -> dark red) and along the trailing wake.
 * - Optional goldRim applies ONLY to the outer 1~2 px rim (dr < 1.65 && q < 0.22), never filling the blade face.
 */
function drawCrescent(p, s, t, ramp, goldRim, hot) {
  const u = t - s.t0;
  if (u < 0) return;
  const life = s.sweep + s.hold + s.trail;
  if (u >= life + 0.18) return;
  const age = clamp(u / life);
  // Strictly monotonic narrowing from s.W to 0
  const W = s.W * Math.max(0, 1 - Math.pow(age, 1.05));
  const head = ease.outExpo(clamp(u / s.sweep));
  const tail = smooth(s.sweep + s.hold, life, u) * (s.tailEat ?? 0.52);
  const U = s.span * head, T = s.span * tail;
  const n = ramp.length;

  if (W > 0.35 && U - T > 0.02 && u < life) {
    smear(p, s, T, U, W + 1, (uu, r, out) => {
      const v = (uu - T) / (U - T);
      const w = W * Math.pow(Math.sin(Math.PI * Math.pow(clamp(v, 0.001, 0.999), s.lens ? 1.0 : 1.4)), 0.68);
      if (w < 0.35) return;
      const dr = s.R - r;
      if (dr < 0 || dr > w) return;
      const q = dr / w;
      if (hot) {
        out.c = goldRim && dr < 1.5 ? goldRim[3] : q < 0.55 ? ramp[n - 1] : ramp[n - 2];
        out.a = Math.min(1, v / 0.12);
        return;
      }
      // Strictly outer 1~2 px rim in bright gold (corresponds to _lib.js q < 0.22 brightest rim)
      if (goldRim && dr < 1.65 && q < 0.22 && age < 0.62 && v > 0.14) {
        out.c = dr < 0.85 && age < 0.38 && v > 0.32 ? goldRim[3] : goldRim[2];
        out.a = 1;
        return;
      }
      // Monotonic inward & trailing cooling: white-hot -> orange -> crimson -> dark red
      const ci = Math.round(q * (n - 1) * 0.78 + (1 - v) * 2.15 + age * 2.35);
      out.c = ramp[n - 1 - clamp(ci, 0, n - 1)];
      out.a = Math.min(1, v / 0.16);
    });
    if (!s.noGlow) {
      glowAlong(p, s, s.R - W * 0.35, T, U, 4 + W * 0.6, ramp[Math.max(0, n - 3)], (uu) => (0.15 + hot * 0.24) * (1 - age) * ((uu - T) / (U - T)), 0, 0.38);
    }
  }

  // Residual dotted trace narrowing and stepping down in ramp
  const trEnd = s.traceExtra ?? 0.14;
  const trK = 1 - smooth(s.sweep + s.hold * 0.4, life + trEnd, u);
  if (u > s.sweep * 0.75 && trK > 0.02) {
    const cHi = goldRim ? goldRim[2] : ramp[Math.max(0, n - 2)];
    const trCol = trK > 0.66 ? cHi : trK > 0.34 ? ramp[Math.min(n - 1, Math.max(1, n - 4))] : ramp[Math.min(n - 1, 1)];
    trace(p, s, s.R - 0.5, 0, U, trCol, (uu) => trK * 0.82 * (0.32 + 0.68 * (uu / s.span)), 0, 0.65);
  }
}

export function create(o) {
  const C = fit(o.palette, 8), G = fit(o.gold, 4), J = fit(o.jade, 5), BN = fit(o.bone, 6);
  const H = hotFirst(C);
  const R = new Rng(o.seed), floor = () => 0;
  // Share the single Rng across particle systems so crimson & jade SPARKs use strictly separate ramps
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], C[3]] });
  const psJade = new Particles({ rng: R, ground: floor, sparks: [J[4], J[3], J[2], J[1]] });
  const bits = new Bits({ ground: floor }), lights = new Lights();

  const st = { light: BN[4], body: BN[3], shade: BN[2], dust: BN[3], dark: BN[1] };

  // ---- Stage 1 (0 -> 0.62s): Deep crescent slash from outside right shoulder (~+12, -64) to waist height (~+42, -11)
  for (let i = 0; i < 10; i++) {
    const a = R.range(0, TAU), d = R.range(10, 19);
    ps.spawn(P.STREAK, -3 + Math.cos(a) * d, -34 + Math.sin(a) * d, -Math.cos(a) * 165, -Math.sin(a) * 165, R.range(0.045, 0.075), i % 3 === 0 ? G[3] : C[6], 1, (i % 3) * 0.014);
  }
  const s1 = through(38, -41, 1.12, 1, 46, 1.46, 0.54, { W: 12, t0: 0.08, sweep: 0.06, hold: 0.04, trail: 0.3, tailEat: 0.45, traceExtra: 0.14 });
  const end1 = slashEnd(s1);
  // 1-2px jade flecks torn off Stage 1's wake, drifting outward & downward (dots/flecks only, zero fog)
  const jadeChips1 = Array.from({ length: 14 }, (_, i) => {
    const u = s1.span * (0.14 + 0.82 * (i / 13) + R.range(-0.025, 0.025));
    const [x0, y0] = onSwing(s1, s1.R + R.range(-2, 0.5), clamp(u, 0.08, s1.span));
    return {
      x0, y0,
      vx: R.range(22, 62),
      vy: R.range(8, 38),
      t0: 0.13 + (i / 14) * 0.065,
      life: R.range(0.22, 0.35),
      ci: R.pick([4, 3, 3, 2]),
      two: R.chance(0.45),
    };
  });

  // ---- Stage 2 (0.62 -> 1.34s): Crossing X at (34, -24) (chest/abdomen height, 34px in front)
  const X2 = 34, Y2 = -24, CLOSE = 0.86;
  const s2a = through(X2, Y2, -0.76, -1, 58, 0.9, 0.5, { W: 9.5, t0: 0.68, sweep: 0.06, hold: 0.16, trail: 0.22, lens: true, tailEat: 0.42 });
  const s2b = through(X2, Y2, -2.36, 1, 58, 0.9, 0.5, { W: 9.5, t0: 0.82, sweep: 0.06, hold: 0.08, trail: 0.22, lens: true, tailEat: 0.42, noGlow: true });
  const rays2 = Array.from({ length: 9 }, (_, i) => ({
    a: (i / 9) * TAU + 0.22 + R.range(-0.12, 0.12),
    L: R.range(10, 22),
  }));

  // ---- Stage 3 (1.34 -> 2.50s): Double-claw ground slam into (X3=30, y=0), rune shockwave & 3 spiral fire pillars
  const X3 = 30, SLAM_T = 1.46;
  const slamArc = swing({ cx: 5, cy: -22, R: 33, sy: 1, rot: 0, a0: -1.85, dir: 1, span: 2.58, W: 11, t0: 1.42, sweep: 0.042, hold: 0.015, trail: 0.065, tailEat: 0.72, traceExtra: 0.04 });
  const lines = cracks(R, X3, 7, 34, 7, 0.3);
  const slamRays = [-0.88, -0.5, -0.16, 0.16, 0.5, 0.86].map((d, i) => ({
    a: -Math.PI / 2 + d + R.range(-0.05, 0.05),
    L: (i === 2 || i === 3 ? 26 : 17) * R.range(0.9, 1.1),
  }));
  const runes = Array.from({ length: 10 }, (_, k) => ({ g: (k + 0.5) * (TAU / 10), gi: (k * 3 + 1) % 8 }));
  const groundEmbers = Array.from({ length: 32 }, (_, i) => {
    const a = R.range(0, TAU), rr = R.range(5, 72);
    const die = i < 3 ? R.range(2.43, 2.475) : R.range(1.9, 2.34);
    return { x: X3 + Math.cos(a) * rr, y: Math.sin(a) * rr * 0.16, r: i < 3 ? R.range(6, 28) : rr, die, ph: R.range(0, TAU), big: i < 3 || R.chance(0.22) };
  });
  // Three staggered helical fire pillars on character's right (offsets -18 / +6 / +32 around X=36 -> 18, 42, 68), heights 60 / 72 / 96
  const pillars = [
    { x: 18, h: 60, w: 6.4, t0: 1.5, ph: 0.5, seed: 13 },
    { x: 42, h: 72, w: 7.6, t0: 1.545, ph: 2.6, seed: 31 },
    { x: 68, h: 96, w: 8.8, t0: 1.59, ph: 4.7, seed: 53 },
  ];
  // Helical orbiting embers wrapping up each pillar (fire-tornado inspired)
  const helixSparks = pillars.flatMap((pl) =>
    Array.from({ length: 6 }, (_, k) => ({
      pl,
      v0: 0.06 + k * 0.12,
      a0: R.range(0, TAU),
      w: R.range(9, 13),
      rise: R.range(1.6, 2.3),
      t0: pl.t0 + 0.02 + k * 0.018,
      life: R.range(0.22, 0.34),
    }))
  );
  // Top-down smoke conversion puffs so each pillar turns seamlessly into rising dark smoke across 1.71 -> 2.30
  const plumes = pillars.flatMap((pl) =>
    Array.from({ length: 9 }, (_, k) => {
      const frac = 0.85 - 0.09 * k;
      return {
        x: pl.x + R.range(-3.0, 3.0),
        y0: -pl.h * frac,
        vx: R.range(-5, 6),
        vy: -R.range(9, 16),
        t0: 1.71 + k * 0.02 + (pl.t0 - 1.5) * 0.7,
        life: R.range(0.38, 0.54),
        s: R.range(3.2, 5.2) * (0.85 + 0.25 * (1 - frac)),
      };
    })
  );

  let t = 0, st1Hit = false, st1Jade = false, st2Charge = false, st2Cross = false, st3Charge = false, st3Hit = false, st3Fire = false;

  const clampParticles = (list, maxT) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const q = list[i];
      if (q.life === q.max && t + q.life > maxT) q.life = q.max = Math.max(0.02, maxT - t);
      if (q.k === P.MOTE && q.y > 0) {
        q.y = -0.25;
        q.vy = -Math.abs(q.vy) * 0.25;
      }
    }
  };

  return {
    update(dt) {
      t += dt;
      if (!st1Hit && t >= 0.13) {
        st1Hit = true;
        lights.add(end1.x, end1.y - 4, 64, C[5], 0.42, 0.28);
        shavings(ps, R, s1, 10, [C[6], C[5], G[3]]);
        for (let i = 0; i < 6; i++) {
          const a = Math.atan2(end1.dy, end1.dx) + R.range(-0.45, 0.45), sp = R.range(115, 225);
          ps.spawn(P.SPARK, end1.x, end1.y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.14, 0.26));
        }
      }
      if (!st1Jade && t >= 0.14) {
        st1Jade = true;
        for (let i = 0; i < 12; i++) {
          const u = s1.span * R.range(0.16, 0.94), [jx, jy] = onSwing(s1, s1.R - R.range(0, 2.5), u);
          ps.spawn(P.MOTE, jx, jy, R.range(26, 72), R.range(8, 38), R.range(0.18, 0.32), R.pick([J[4], J[3], J[3], J[2]]), 0.62, R.range(0, 0.05));
        }
        for (let i = 0; i < 12; i++) {
          const u = s1.span * R.range(0.2, 0.95), [jx, jy] = onSwing(s1, s1.R, u);
          ps.spawn(P.GRIT, jx, jy, R.range(20, 64), R.range(-14, 36), R.range(0.22, 0.36), R.pick([J[4], J[3], J[2]]), R.chance(0.35) ? 2 : 1, R.range(0, 0.04));
        }
      }
      if (!st2Charge && t >= 0.62) {
        st2Charge = true;
        for (let i = 0; i < 7; i++) {
          const a = R.range(0, TAU), d = R.range(9, 16);
          ps.spawn(P.STREAK, 6 + Math.cos(a) * d, -16 + Math.sin(a) * d, -Math.cos(a) * 150, -Math.sin(a) * 150, 0.05, i % 2 ? C[6] : J[3]);
        }
      }
      if (!st2Cross && t >= CLOSE) {
        st2Cross = true;
        lights.add(X2, Y2, 56, G[2], 0.44, 0.32);
        lights.add(X2, Y2, 18, WHITE, 0.65, 0.08);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU + R.range(-0.2, 0.2), sp = R.range(120, 250);
          ps.spawn(P.SPARK, X2, Y2, Math.cos(a) * sp, Math.sin(a) * sp - 22, R.range(0.15, 0.24), WHITE, 1, R.range(0.02, 0.045));
        }
        for (let i = 0; i < 12; i++) {
          const a = ((i + 0.5) / 12) * TAU + R.range(-0.2, 0.2), sp = R.range(120, 250);
          psJade.spawn(P.SPARK, X2, Y2, Math.cos(a) * sp, Math.sin(a) * sp - 22, R.range(0.15, 0.24), WHITE, 1, R.range(0.02, 0.045));
        }
      }
      if (!st3Charge && t >= 1.34) {
        st3Charge = true;
        for (let i = 0; i < 10; i++) {
          const a = R.range(0, TAU), d = R.range(12, 22);
          ps.spawn(P.STREAK, 8 + Math.cos(a) * d, -37 + Math.sin(a) * d, -Math.cos(a) * 165, -Math.sin(a) * 165, R.range(0.06, 0.095), G[3]);
        }
      }
      if (!st3Hit && t >= SLAM_T) {
        st3Hit = true;
        lights.add(X3, -18, 60, C[5], 0.4, 0.46);
        lights.add(X3, -5, 18, WHITE, 0.45, 0.08);
        for (let i = 0; i < 14; i++) {
          const s = R.sign();
          bits.add({ kind: B.CHUNK, x: X3 + s * R.range(0, 6), y: -2, vx: s * R.range(18, 86), vy: -R.range(105, 235), g: 1, drag: 0.42, bounce: 0.36, life: R.range(0.62, 0.9), a: R.range(0, TAU), va: R.range(-15, 15), s: R.pick([1, 1, 2, 2, 3]) });
        }
        for (let i = 0; i < 34; i++) {
          const a = -Math.PI / 2 + R.range(-1.15, 1.15), sp = R.range(50, 195);
          ps.spawn(P.GRIT, X3 + R.range(-5, 5), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.5, 0.86), R.pick([st.light, st.body, st.body, st.shade]), R.chance(0.4) ? 2 : 1);
        }
        for (let i = 0; i < 14; i++) {
          const s = i % 2 ? -1 : 1;
          ps.spawn(P.DUST, X3 + s * R.range(2, 8), -R.range(1, 4), s * R.range(35, 92), -R.range(6, 22), R.range(0.38, 0.66), st.dust, R.range(2.2, 3.6));
        }
      }
      if (!st3Fire && t >= 1.5) {
        st3Fire = true;
        for (const pl of pillars) {
          for (let j = 0; j < 5; j++) {
            ps.spawn(P.FIRE, pl.x + R.range(-2.2, 2.2), -R.range(12, pl.h * 0.56), R.range(-9, 9), -R.range(18, 36), R.range(0.2, 0.26), 0, R.range(2.5, 3.8), pl.t0 - 1.5 + j * 0.02, PF.SMOKES);
          }
          for (let j = 0; j < 4; j++) {
            ps.spawn(P.SPARK, pl.x + R.range(-3, 3), -4, R.range(-32, 32), -R.range(90, 180), R.range(0.18, 0.34), WHITE, 1, pl.t0 - 1.5 + 0.02);
          }
        }
      }
      bits.update(dt);
      for (const b of bits.list) {
        if (b.rest && !b.dusted && t < 2.15) {
          b.dusted = true;
          for (let i = 0; i < 2; i++) ps.spawn(P.DUST, b.x + R.range(-1, 1), -0.5, R.sign() * R.range(6, 24), -R.range(2, 11), 0.26, st.dust, R.range(1.4, 2.2));
        }
      }
      ps.update(dt);
      psJade.update(dt);
      clampParticles(ps.list, 2.34);
      clampParticles(psJade.list, 2.34);
      lights.update(dt);
    },
    drawBack(p) {
      if (t >= meta.duration - 1e-6) return;
      if (t >= 1.34 && t < SLAM_T) {
        const ck = (t - 1.34) / (SLAM_T - 1.34), cr = 12 + 6 * ease.outQuad(ck);
        band(p, X3, 0.5, cr, 0.16, 1.8, 0.55 + 0.45 * ck, G, (g) => Math.sin(g) < 0);
      }
      const q = t - SLAM_T;
      if (q >= 0) {
        const scorchFade = 1 - smooth(2.32, 2.48, t);
        if (scorchFade > 0.01) {
          for (let dx = -12; dx <= 12; dx++) {
            const u = dx / 11, d = Math.abs(dx) > 11 ? 0 : Math.round(3.0 * (1 - u * u) + (rand(dx, 4) - 0.5) * 0.7);
            for (let dy = 0; dy < d; dy++) p.dot(X3 + dx, dy, dy === 0 ? BN[0] : BN[1], scorchFade);
            if (d > 0) p.dot(X3 + dx, d, Math.abs(dx) < 7 ? BN[3] : BN[2], scorchFade);
          }
          for (const pl of pillars) {
            if (t >= pl.t0) {
              for (let dx = -5; dx <= 5; dx++) p.dot(pl.x + dx, 0, Math.abs(dx) < 3 ? BN[0] : BN[1], scorchFade * 0.88);
            }
          }
        }
        // Far half of golden rune shockwave (band r: 6 -> 76, sy=0.16, thick 2 -> 1 px)
        const rk = q / 0.44;
        if (rk < 1) {
          const rr = 6 + 70 * ease.outCubic(rk), th = 2 - rk, al = 1 - smooth(0.62, 1, rk);
          band(p, X3, 0.5, rr, 0.16, th, al, G, (g) => Math.sin(g) < 0);
          const farRunes = runes.filter((rn) => Math.sin(rn.g) < 0).sort((a, b) => Math.sin(a.g) - Math.sin(b.g));
          for (const rn of farRunes) {
            const rx = X3 + Math.cos(rn.g) * rr, ry = 0.5 + Math.sin(rn.g) * rr * 0.16;
            const gc = rk < 0.35 ? G[2] : rk < 0.7 ? G[1] : G[0];
            glyph(p, rn.gi, rx, ry - 1, gc, al, G[0]);
          }
        }
      }
      simDraw(p, ps, H, "back");
    },
    draw(p) {
      if (t >= meta.duration - 1e-6) return;
      const N = (rate, seed = 0, off = 0) => NL(t, rate, seed, off);

      // ---- Stage 1
      if (t < 0.08) {
        const ck = Math.sin((t / 0.08) * Math.PI);
        sparkle(p, -3, -34, 4 * ck, G[3], C[5], 0.4 * ck);
      }
      if (t < 0.62) {
        const hot1 = t >= 0.125 && t < 0.155 ? 1 : 0;
        drawCrescent(p, s1, t, C, G, hot1);
        if (t >= 0.11 && t < 0.22) {
          const gk = (t - 0.11) / 0.11;
          sparkle(p, end1.x, end1.y, 5 * (1 - gk), G[3], G[2], 0.42 * (1 - gk));
        }
        for (const jc of jadeChips1) {
          const age = t - jc.t0;
          if (age < 0 || age >= jc.life) continue;
          const k = 1 - age / jc.life;
          const jx = jc.x0 + jc.vx * age * (1 - 0.3 * (age / jc.life));
          const jy = Math.min(-0.5, jc.y0 + jc.vy * age + 48 * age * age);
          const col = k > 0.6 ? J[jc.ci] : k > 0.3 ? J[Math.max(1, jc.ci - 1)] : J[1];
          p.dot(jx, jy, col, Math.min(1, k * 2.5));
          if (jc.two && k > 0.4) p.dot(jx - 1, jy - 1, J[Math.max(1, jc.ci - 1)], k);
        }
      }

      // ---- Stage 2
      if (t >= 0.62 && t < 1.34) {
        const hot2 = t >= CLOSE && t < CLOSE + 0.066 ? 1 : 0;
        if (t < 1.13) {
          drawCrescent(p, s2a, t, C, G, hot2);
          drawCrescent(p, s2b, t, [J[1], J[2], J[3], J[3], J[4]], null, hot2);
        }
        if (t >= 1.06 && t < 1.34) {
          const xk = 1 - smooth(1.1, 1.33, t);
          trace(p, s2a, s2a.R - 0.5, s2a.span * 0.2, s2a.span * 0.8, C[3], xk * 0.72, 0, 0.78);
          trace(p, s2b, s2b.R - 0.5, s2b.span * 0.2, s2b.span * 0.8, J[2], xk * 0.72, 0, 0.78);
        }
        // Local bone-white burst: 6-8px hard-edged bone-white star (p.circle strictly here & strictly 2 frames)
        // + 9 radial bone-white short lines (length 10~22 px)
        const bq = t - CLOSE;
        if (bq >= 0 && bq < 0.066) {
          p.circle(X2, Y2, 3.8, BN[4]);
          p.circle(X2, Y2, 2.8, BN[5]);
          p.line(X2 - 6, Y2, X2 + 6, Y2, BN[5]);
          p.line(X2, Y2 - 6, X2, Y2 + 6, BN[5]);
        }
        if (bq >= 0 && bq < 0.1) {
          const pull = smooth(0.05, 0.1, bq);
          for (const ry of rays2) {
            const d0 = 4.5 + ry.L * 0.55 * pull, d1 = 5.5 + ry.L * (0.85 + 0.15 * Math.min(1, bq / 0.03));
            if (d1 > d0) {
              const ca = Math.cos(ry.a), sa = Math.sin(ry.a);
              p.line(X2 + ca * d0, Y2 + sa * d0, X2 + ca * d1, Y2 + sa * d1, (u) => (u < 0.6 && pull < 0.5 ? BN[5] : BN[4]));
            }
          }
        }
      }

      // ---- Stage 3
      if (t >= 1.34 && t < SLAM_T) {
        const ck = (t - 1.34) / (SLAM_T - 1.34), cr = 12 + 6 * ease.outQuad(ck);
        band(p, X3, 0.5, cr, 0.16, 1.8, 0.55 + 0.45 * ck, G, (g) => Math.sin(g) >= 0);
        for (const sgn of [-1, 1]) {
          const pts = [];
          for (let j = 0; j <= 6; j++) {
            const u = j / 6;
            const px = 8 + sgn * (20 * (1 - ck) * (1 - u * 0.8) + 2) + Math.sin(u * Math.PI) * sgn * 4;
            const py = -10 - (14 + 23 * ck) * u;
            pts.push([px, py]);
          }
          p.polyline(pts, ck > 0.5 ? G[3] : C[6], 0.9);
        }
      }
      if (t >= 1.42 && t < 1.53) drawCrescent(p, slamArc, t, C, G, t >= SLAM_T && t < SLAM_T + 0.04 ? 1 : 0);

      const q = t - SLAM_T;
      if (q >= 0) {
        const scorchFade = 1 - smooth(2.32, 2.48, t);
        if (scorchFade > 0.01) {
          for (const c of lines) {
            const reach = 34 * ease.outCubic(clamp((q - c.at * 0.05) / 0.08)) * (c.fork ? 0.35 : 1);
            if (reach > 0)
              along(c.pts, reach, (x0, y0, x1, y1) => {
                if (q >= 0.12) p.line(x0, y0 + 2, x1, y1 + 2, BN[2], scorchFade);
                p.line(x0, y0 + 1, x1, y1 + 1, q < 0.05 ? WHITE : q < 0.12 ? G[3] : BN[0], scorchFade);
              });
          }
        }
        const dk = (q - 0.015) / 0.22;
        if (dk >= 0 && dk < 1) {
          const dr = 10 + 24 * ease.outCubic(dk), dth = Math.max(1, 2.6 * (1 - dk)), da = dk < 0.55 ? 1 : (1 - dk) / 0.45;
          p.shade(X3 - dr - 1, -dr - 1, X3 + dr + 1, 0, (x, y, out) => {
            const e = dr - Math.hypot(x - X3, y);
            if (e < 0 || e > dth || y > -0.5) return;
            out.c = e < dth * 0.35 ? G[3] : e < dth * 0.7 ? C[6] : C[4];
            out.a = da;
          });
        }
        if (q < 0.15) {
          for (const ry of slamRays) {
            const d1 = ry.L * ease.outCubic(Math.min(1, q / 0.04)), d0 = ry.L * smooth(0.03, 0.15, q);
            if (d1 - d0 > 1) p.line(X3 + Math.cos(ry.a) * (2 + d0), -1 + Math.sin(ry.a) * (2 + d0), X3 + Math.cos(ry.a) * d1, -1 + Math.sin(ry.a) * d1, q < 0.05 ? WHITE : G[3]);
          }
        }
        const rk = q / 0.44;
        if (rk < 1) {
          const rr = 6 + 70 * ease.outCubic(rk), th = 2 - rk, al = 1 - smooth(0.62, 1, rk);
          band(p, X3, 0.5, rr, 0.16, th, al, G, (g) => Math.sin(g) >= 0);
          const nearRunes = runes.filter((rn) => Math.sin(rn.g) >= 0).sort((a, b) => Math.sin(a.g) - Math.sin(b.g));
          for (const rn of nearRunes) {
            const rx = X3 + Math.cos(rn.g) * rr, ry = 0.5 + Math.sin(rn.g) * rr * 0.16;
            const gc = rk < 0.35 ? G[3] : rk < 0.7 ? G[2] : G[1];
            glyph(p, rn.gi, rx, ry - 1, gc, al, G[0]);
            if (rk < 0.65) p.glow(rx, ry - 2, 6, G[2], 0.18 * (1 - rk));
          }
        }
        const curR = rk < 1 ? 6 + 70 * ease.outCubic(rk) : 76;
        for (const ge of groundEmbers) {
          if (ge.r > curR || t >= ge.die) continue;
          const ek = clamp((ge.die - t) / 0.48);
          if (ek < 0.32 && Math.sin(t * 38 + ge.ph) < 0) continue;
          const ec = ek > 0.65 ? G[3] : ek > 0.35 ? G[2] : G[1];
          p.dot(ge.x, ge.y, ec, Math.min(1, ek * 2.2));
          if (ge.big && ek > 0.35) p.glow(ge.x, ge.y, 4, G[2], 0.2 * ek);
        }
        if (q < 0.066) {
          const hot = q < 0.033, rx = hot ? 18 : 13, ry = hot ? 3 : 2;
          p.ellipse(X3, 0, rx + 2, ry + 1, hot ? G[3] : C[6]);
          p.ellipse(X3, 0, rx, ry, hot ? WHITE : C[7]);
        }

        // Collapsing dark smoke plumes drawn around/over the top-down cooling pillars (1.71 -> 2.30)
        for (const sm of plumes) {
          const age = t - sm.t0;
          if (age < 0 || age >= sm.life) continue;
          const k = 1 - age / sm.life;
          const sx = sm.x + sm.vx * age + Math.sin(t * 4.2 + sm.y0) * 1.8;
          const sy = Math.max(-95, sm.y0 + sm.vy * age);
          smokePuff(p, sx, sy, k, sm.s, BN[1]);
        }

        // Back-side helical embers orbiting behind the pillars
        for (const hs of helixSparks) {
          const age = t - hs.t0;
          if (age < 0 || age >= hs.life) continue;
          const v = hs.v0 + hs.rise * age;
          if (v >= 0.92) continue;
          const a = hs.a0 + hs.w * age;
          if (Math.sin(a) >= 0) continue;
          const rr = hs.pl.w * (1 - v * 0.65) + 2;
          p.px(hs.pl.x + Math.cos(a) * rr, -v * hs.pl.h * 0.88, C[3]);
        }

        // Three helical corkscrewing fire pillars (erupting 1.50 -> 1.75, burning down into smoke 1.75 -> 1.92)
        for (const pl of pillars) {
          const pq = t - pl.t0;
          if (pq < 0 || t >= 1.92) continue;
          const grow = ease.outQuart(clamp(pq / 0.085));
          const colK = smooth(1.73, 1.91, t);
          const fullH = pl.h * grow;
          const flameTop = Math.min(fullH * 0.9 * (1 - colK * 0.68), 90);
          const baseW = pl.w * (1 - colK * 0.65);
          if (flameTop < 2 || baseW < 0.5) continue;

          // Base 3-layer flameTongue licks
          const th0 = Math.min(flameTop * 0.36, 19);
          if (th0 > 2) flameTongue(p, pl.x, 0, th0, baseW * 0.86, Math.sin(t * 20 + pl.ph) * 2.4, N, pl.seed, H, TONGUE_LAYERS, 0.45, 0.85);

          // Helical spiral column: high-contrast diagonal bright crests & dark crimson spiral grooves
          for (let y = 0; y >= -flameTop; y--) {
            const v = -y / Math.max(1, fullH * 0.9);
            const vLocal = -y / Math.max(1, flameTop);
            const rCore = Math.max(0.55, baseW * Math.pow(1 - vLocal * 0.78, 0.84));
            const cx = pl.x + Math.sin(v * 8.2 - t * 23 + pl.ph) * (1.1 + 2.2 * v * (1 - 0.3 * v));
            const spin = -t * 22 + v * 9.8 + pl.ph;
            const tear = 0.15 * pnoise(y * 0.36 - t * 24, 24, pl.seed);
            const bulgeL = 0.68 + 0.46 * (0.5 + 0.5 * Math.sin(-Math.PI + spin));
            const bulgeR = 0.68 + 0.46 * (0.5 + 0.5 * Math.sin(spin));
            const rMax = rCore * Math.max(bulgeL, bulgeR);

            for (let x = Math.floor(cx - rMax - 1); x <= Math.ceil(cx + rMax + 1); x++) {
              const rawDx = x + 0.5 - cx;
              const rSide = rCore * (rawDx < 0 ? bulgeL : bulgeR);
              const dx = rawDx / Math.max(0.4, rSide);
              if (Math.abs(dx) > 1) continue;
              const th = Math.asin(clamp(dx, -1, 1));
              const sBand = 0.5 + 0.5 * Math.sin(th * 2 + spin + tear);
              if (vLocal > 0.66 && sBand < 0.32 + (vLocal - 0.66) * 1.65) continue;
              const baseIdx = Math.round((1 - vLocal * 0.84 - colK * 0.35) * 5.2);
              const delta = sBand > 0.76 ? 2 : sBand > 0.44 ? 1 : -1;
              const ci = clamp(baseIdx + delta, 1, 7);
              p.px(x, y, C[ci]);
            }
          }
          // Top smokePuff cap riding right at the top of the flame column (strictly inside y >= -101)
          const sy = Math.max(-95, -flameTop - 3);
          smokePuff(p, pl.x + Math.sin(t * 7.5 + pl.ph) * 2.2, sy, 1 - colK * 0.45, 3.3 + pl.w * 0.26, BN[1]);
          p.glow(pl.x, -Math.min(30, flameTop * 0.4), 22, C[5], 0.23 * (1 - colK));
        }

        // Front-side helical embers orbiting across the front of the pillars
        for (const hs of helixSparks) {
          const age = t - hs.t0;
          if (age < 0 || age >= hs.life) continue;
          const k = 1 - age / hs.life;
          const v = hs.v0 + hs.rise * age;
          if (v >= 0.92) continue;
          const a = hs.a0 + hs.w * age;
          if (Math.sin(a) < 0) continue;
          const rr = hs.pl.w * (1 - v * 0.65) + 2.2;
          const hx = hs.pl.x + Math.cos(a) * rr, hy = -v * hs.pl.h * 0.88;
          p.line(hx + Math.sin(a) * 2, hy + 2, hx, hy, k > 0.5 ? C[7] : C[5]);
        }
      }

      for (const b of bits.list) rock(p, b, st);
      simDraw(p, ps, H, "front");
      psJade.draw(p, "front");
      lights.draw(p);
    },
  };
}
