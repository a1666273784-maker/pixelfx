// Small crimson ripple ("melee/crimson-ripple"): a faint red light kindles at the palm and its core draws in,
// then the palm shoves out two short translucent rings of gas that run forward, the second one reaching the enemy.
// The blow sends a faint spatial tremor through the target: flattened rings that breathe out and fade, and a
// few dark-crimson energy embers that scatter round it and drift off on the wind. The gas arcs are translucent
// (blended, not dithered), in the spirit of the translucent discs in the core toolkit. The act follows melee/thrust.
import { Particles, Lights, P, Rng, fit, sparkle, clamp, smooth, lerp, ease, TAU, WHITE, READY } from "../../core/index.js";

const HX = 10, HY = -22; // the palm: the light kindles here and the rings leave from here
const CX = HX - 6; // the rings are drawn from a point just behind the palm, so their front is the wave
const TX = 72; // where the enemy stands
const T_FIRE = 0.16; // release: the palm shoves out
const W1 = { t0: T_FIRE, dur: 0.22, r0: 5, r1: 30, w: 5.5 }; // first ring: short, quick
const W2 = { t0: T_FIRE + 0.05, dur: 0.26, r0: 5, r1: 62, w: 6.5 }; // second ring: reaches the enemy
const T_HIT = T_FIRE + 0.24; // the second ring arrives at the enemy
const T_END = 1.5;
const HALF = 0.56; // the rings are forward arcs, this far either side of straight ahead (radians)

export const meta = {
  name: "Crimson ripple",
  desc: "A small crimson blast: a red light kindles at the palm, two translucent gas rings roll forward, and the enemy takes a tremor and a scatter of dark-red embers.",
  tags: ["melee", "wave", "ripple", "shockwave", "crimson", "gas", "push", "combat", "directional", "one-shot"],
  size: [140, 88],
  origin: [34, 62],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#14040a", "#3a0a12", "#6e1420", "#a52230", "#d6384a", "#ff7a80", "#ffd0d0"],
    seed: 9,
  },
};

const GUARD = { ...READY, x: 0, crouch: 3, lean: 1, fx: 10, fy: -22, bx: 8, by: -20, ffx: 7, fbx: -7 };
const DRAW = { ...READY, x: -3, crouch: 5, lean: -3, fx: 0, fy: -23, bx: 9, by: -22, ffx: 6, fbx: -8 };
const PUSH = { ...READY, x: 4, crouch: 4, lean: 6, fx: 16, fy: -22, bx: 12, by: -22, ffx: 10, fbx: -6, ghost: 1 };
const HOLD = { ...READY, x: 4, crouch: 4, lean: 4, fx: 14, fy: -23, bx: 12, by: -22, ffx: 9, fbx: -6 };
const RECOVER = { ...READY, x: 1, crouch: 2, lean: 1, fx: 9, fy: -21, bx: 9, by: -20, ffx: 7, fbx: -7 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.28, GUARD],
    [-0.12, DRAW],
    [T_FIRE, PUSH, "snap"],
    [T_HIT, HOLD],
    [0.6, HOLD],
    [1.0, RECOVER],
    [T_END, READY],
  ],
  hits: [{ t: T_HIT, stop: 0.08, shake: 0.14, amp: 1.8, push: 2.6, straw: 10, y: -22, shiver: 0.22 }],
};

// a translucent forward arc of a ring from (cx, cy), radius r, band w: the leading edge is brightest and the
// arc fades at its ends and as the wave thins. blendPx gives true translucency; alpha is a function of the
// pixel's place in the band and the arc.
function gasArc(p, cx, cy, r, w, life, C, wob) {
  if (r <= 1 || life <= 0.01) return;
  p.each(cx - r, cy - r, cx + r, cy + r, (x, y, sx, sy) => {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
    if (d > r || d < r - w) return;
    const ang = Math.atan2(dy, dx);
    if (Math.abs(ang) > HALF) return;
    const v = (d - (r - w)) / w; // 0 inner .. 1 leading edge
    const endFade = 1 - (ang / HALF) ** 2;
    const breakup = 0.75 + 0.25 * Math.sin(ang * 7 + wob);
    const a = life * endFade * breakup * Math.pow(v, 1.1) * 0.8;
    if (a <= 0.01) return;
    const c = v > 0.75 ? C[5] : v > 0.4 ? C[4] : C[3];
    p.blendPx(sx, sy, c, a);
  });
}

// a flattened ring on the ground plane (sy squashes it), for the tremor through the target
function tremorRing(p, cx, cy, r, sy, w, life, c) {
  if (r <= 1 || life <= 0.01) return;
  p.each(cx - r, cy - r, cx + r, cy + r, (x, y, sx, sy2) => {
    const dx = x - cx, dy = (y - cy) / sy, d = Math.hypot(dx, dy);
    if (Math.abs(d - r) > w / 2) return;
    const a = life * (1 - Math.abs(d - r) / (w / 2)) * 0.95;
    p.blendPx(sx, sy2, c, a);
  });
}

export function create(o) {
  const C = fit(o.palette, 7), R = new Rng(o.seed), S = o.seed * 17;
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [C[4], C[3], C[2]] });
  const lights = new Lights();
  let motes = [], t = 0, lit = false, hit = false;

  return {
    update(dt) {
      t += dt;
      // the light kindles: motes drawn in from around the palm while the core shrinks
      if (t < T_FIRE && R.chance(30 * dt)) {
        const a = R.range(0, TAU), r = R.range(10, 16);
        motes.push({ x0: HX + Math.cos(a) * r, y0: HY + Math.sin(a) * r * 0.8, age: 0, life: R.range(0.08, T_FIRE) });
      }
      for (const m of motes) m.age += dt;
      motes = motes.filter((m) => m.age < m.life);

      if (!lit) {
        lit = true;
        lights.add(HX, HY, 14, C[3], 0.25, 0.14);
      }
      // the target is struck: a dim light, a scatter of dark-crimson embers that drift off with the wind
      if (!hit && t >= T_HIT) {
        hit = true;
        lights.add(TX, HY, 22, C[3], 0.3, 0.2);
        for (let i = 0; i < 9; i++) {
          const a = R.range(-Math.PI, Math.PI), v = R.range(22, 62);
          ps.spawn(P.EMBER, TX - 4, HY + 2, Math.cos(a) * v + 14, Math.sin(a) * v * 0.6 - 8, R.range(0.6, 1.0), C[3], 1, R.range(0, 0.06));
        }
      }
      ps.update(dt);
      lights.update(dt);
    },

    draw(p) {
      // release: the core dims in, a faint red glow builds, and the ring of light draws inward
      if (t < T_FIRE) {
        const k = clamp(t / T_FIRE);
        p.glow(HX, HY, 5 + 4 * k, C[3], 0.35 * k);
        p.ring(HX, HY, lerp(8, 3, smooth(0, 1, k)), 1, C[4], 0.35 + 0.4 * k);
        p.circle(HX, HY, 1.2, C[5], 0.25 + 0.6 * k);
        for (const m of motes) {
          const e = (m.age / m.life) ** 2, x = m.x0 + (HX - m.x0) * e, y = m.y0 + (HY - m.y0) * e;
          p.dot(x, y, C[4], 0.8 - e * 0.4);
        }
      }

      // the palm's flash as the rings leave it
      if (t >= T_FIRE && t < T_FIRE + 0.05) {
        const k = 1 - (t - T_FIRE) / 0.05;
        p.glow(HX, HY, 8 * k, C[4], 0.5 * k);
      }

      // the two rings of gas: each grows, thins and fades as it goes
      const ring = (W, wob) => {
        const u = clamp((t - W.t0) / W.dur);
        if (u <= 0 || u >= 1) return;
        const r = lerp(W.r0, W.r1, ease.outCubic(u));
        const w = W.w * (1 - 0.5 * u);
        const life = 1 - smooth(0.4, 1, u);
        gasArc(p, CX, HY, r, w, life, C, wob + t * 22);
        // a glint riding the leading edge
        if (u < 0.85) {
          const ang = (Math.sin(wob) * HALF) * 0.6;
          p.glow(CX + Math.cos(ang) * r, HY + Math.sin(ang) * r, 3, C[5], 0.35 * life);
        }
      };
      ring(W1, S);
      ring(W2, S + 2);

      // the tremor: two flattened rings breathe out from the enemy's chest and fade
      for (const [delay, rMax, w] of [[0, 15, 1.6], [0.05, 10, 1.3]]) {
        const q = (t - T_HIT - delay) / 0.36;
        if (q > 0 && q < 1) tremorRing(p, TX, HY + 4, lerp(3, rMax, ease.outCubic(q)), 0.35, w, 1 - q, C[4]);
      }
      // a small soft glint at the point of impact
      if (t >= T_HIT && t < T_HIT + 0.1) {
        const k = 1 - (t - T_HIT) / 0.1;
        sparkle(p, TX - 2, HY + 2, 1 + 3 * k, C[5], C[3], 0.6 * k);
      }

      ps.draw(p);
      lights.draw(p);
    },
  };
}
