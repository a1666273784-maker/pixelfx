// The horizontal open-fan cut: crescent, echo and trace discipline from sword slash and the melee _lib swing helper.
import { Particles, Lights, P, Rng, fit, sparkle, clamp, smooth, ease, WHITE, READY } from "../../core/index.js";
import { swing, onSwing, smear, trace, glowAlong } from "./_lib.js";

const D = 0.62;
const SWEEP_T = 0.055; // the edge arrives at the far side of the cut

export const meta = {
  name: "Fan sweep",
  desc: "The open fan scythes horizontally through the air: a gold-rimmed black lacquer crescent with a red bite along its inner edge, white-hot at the moment of the cut.",
  tags: ["melee", "fan", "lacquer", "sweep", "combo", "chinese", "one-shot"],
  size: [190, 124],
  origin: [70, 102],
  duration: D,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#150507", "#2a090e", "#4a0f16", "#6f1620", "#9c1f26", "#cb3324", "#f0582c", "#ffb15e"],
    gold: ["#33200a", "#63410f", "#9c6f24", "#d1a03a", "#ffd84a", "#fff3b0"],
    seed: 4,
  },
};

const GUARD = { ...READY, weapon: "handle", sa: -0.5, fx: 9, fy: -20, bx: 8, by: -19 };
// the fan is wound back past his left hip, then whipped across the front into the line ahead
const COIL = { ...GUARD, x: -6, crouch: 5, lean: -3, turn: 0.5, fx: -6, fy: -26, sa: -2.3, bx: 5, by: -22, armsFront: true, ffx: 9, fbx: -9 };
const SWEEP = { ...GUARD, x: 4, crouch: 4, lean: 5, turn: 0.55, fx: 16, fy: -22, sa: 0.28, bx: -6, by: -22, ffx: 12, fbx: -8, armsFront: true, toeB: true, ghost: 1 };
const HOLD = { ...SWEEP, ghost: 0, lean: 7, crouch: 5, fx: 14, fy: -19 };
export const act = {
  target: { x: 62 },
  poses: [
    [-0.3, GUARD],
    [-0.17, COIL],
    [0, SWEEP, "snap"],
    [0.28, HOLD],
    [0.52, { ...GUARD, crouch: 4 }],
  ],
  hits: [{ t: SWEEP_T, stop: 0.1, shake: 0.18, amp: 2.4, push: 2.6, straw: 16, y: -22 }],
  dust: [{ t: SWEEP_T, x: 14, n: 6, dir: 1 }, { t: SWEEP_T, x: -10, n: 4, dir: -1 }],
};

export function create(o) {
  const C = fit(o.palette, 8), G = fit(o.gold, 6);
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  const lights = new Lights();
  const SWING = swing({ cx: 5, cy: -27, R: 46, sy: 0.42, rot: -0.06, a0: Math.PI * 0.96, dir: -1, k: 0.06 });
  const ECHO = { ...SWING, R: 38, a0: Math.PI * 0.9, span: Math.PI * 0.68, rot: -0.06 };
  SWING.span = Math.PI * 0.86;
  let t = 0, burst = false;
  const tip = onSwing(SWING, SWING.R, SWING.span);

  const drawSmear = (p, s, t0, lag, W0, ramp, whiteRim) => {
    const u = t - t0 - lag;
    if (u < 0) return;
    const span = s.span, sweep = SWEEP_T, hold = 0.06, trail = 0.3, life = sweep + hold + trail;
    if (u >= life) return;
    const head = ease.outExpo(clamp(u / sweep));
    const tail = smooth(sweep + hold, life, u) * 0.6;
    const age = clamp(u / life);
    const U = span * head, T = span * tail;
    if (U - T < 0.02) return;
    const W = W0 * (1 - age * 0.6);
    const n = ramp.length;
    smear(p, s, T, U, W, (uu, r, out) => {
      const v = clamp((uu - T) / Math.max(0.01, U - T), 0, 1);
      const w = W * Math.pow(Math.sin(Math.PI * Math.pow(clamp(v, 0.001, 0.999), 1.15)), 0.62);
      if (w < 0.4) return;
      const dr = s.R - r;
      if (dr < 0 || dr > w) return;
      const q = dr / w;
      if (whiteRim && dr < 1.7 && age < 0.55 && v > 0.14) {
        out.c = age < 0.24 ? WHITE : ramp[n - 2];
        out.a = 1;
        return;
      }
      // red bite along the inner edge, cooling to the dark steps with age and towards the tail
      if (q > 0.66) {
        out.c = q > 0.85 ? C[2] : v < 0.35 ? C[3] : C[4];
        out.a = v < 0.3 ? 0.92 : 1;
        return;
      }
      const ci = clamp(Math.round(q * (n - 1) * 0.74 + age * 2.7 + (1 - v) * 1.15 + 0.35), 0, n - 1);
      out.c = ramp[n - 1 - ci];
      out.a = age > 0.58 && v < 0.82 && ((Math.floor(uu * 26) + Math.floor(r * 1.7)) & 1) ? 0.55 : 1;
    }, 1);
    if (t - t0 > sweep * 0.6)
      trace(p, s, s.R - 0.5, 0, U, ramp[3], (uu) => 0.85 * (1 - clamp((u - sweep - hold) / (trail + 0.2))) * (0.4 + 0.6 * (uu / span)), 1);
    if (t - t0 < 0.17) glowAlong(p, s, s.R - 5, 0, U, 12, ramp[4], (uu) => 0.34 * (1 - (t - t0) / 0.17) * (0.35 + (uu / span)), 1);
  };

  return {
    update(dt) {
      t += dt;
      if (!burst && t >= SWEEP_T) {
        burst = true;
        // the edge completes the cut at the right tip: sparks, shavings and a gold flash
        for (let i = 0; i < 11; i++) {
          const a = R.range(-0.55, 0.55), sp = R.range(140, 330);
          ps.spawn(P.SPARK, tip[0], tip[1], Math.cos(a) * sp, Math.sin(a) * sp * 0.7 - 30, R.range(0.14, 0.34), G[4]);
        }
        for (let i = 0; i < 13; i++) {
          const a = R.range(-1.1, 0.9), sp = R.range(45, 150);
          ps.spawn(P.MOTE, tip[0] - R.range(0, 34), tip[1] + R.range(-4, 4), Math.cos(a) * sp, Math.sin(a) * sp - 12, R.range(0.28, 0.55), i % 4 === 0 ? C[4] : G[2 + (i % 2)], 0.6);
        }
        for (let i = 0; i < 3; i++) ps.spawn(P.GRIT, tip[0] - 6, tip[1], R.range(60, 160), R.range(-90, -20), R.range(0.4, 0.7), i ? G[2] : C[2], 1);
        lights.add(tip[0], tip[1], 34, G[4], 0.85, 0.32);
        lights.add(5, -21, 44, C[4], 0.4, 0.4);
      }
      ps.update(dt);
      lights.update(dt);
    },
    draw(p) {
      drawSmear(p, ECHO, 0.018, 0, 7.5, G, false);
      drawSmear(p, SWING, 0.0, 0, 15, G, true);
      if (t > 0.012 && t < SWEEP_T + 0.05) {
        const hk = clamp(1 - t / (SWEEP_T + 0.05), 0, 1);
        p.glow(tip[0], tip[1], 9 + 8 * (1 - hk), G[4], 0.5 * hk);
      }
      if (t < 0.14) {
        // a white glint rides the leading edge as the cut completes
        sparkle(p, tip[0], tip[1], 6 * clamp(1.6 - t / 0.14, 0.25, 1) * clamp((t - 0.012) / 0.02, 0, 1), G[5], WHITE, 0.8);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}
