// Four consecutive silver-white sword strikes played in one breath: a horizontal cut, a windmill
// up-and-over-the-head down-cut from the other side (no return to guard), a long diagonal severing
// line from high to low, and a lunging thrust that flashes white on contact. Each blade is longer
// and brighter than the last, and every hit leaves its mark on the target.
// The crescent recipe is adapted from Sprite Fusion's open-source slash
// (https://www.spritefusion.com/pixel-art-vfx/slash), MIT License, Copyright (c) 2026 Hugo Duprez.
import {
  Particles, Bits, Lights, P, PF, B, Rng, fit, flare, sparkle, clamp, smooth, ease, TAU, WHITE, READY, poseAt, skeleton,
} from "../../core/index.js";
import { swing, slash, onSwing } from "./_lib.js";

const FRAME = 1 / 30; // one frame at 30 fps
const TX = 108; // target: local x of the struck dummy
const TY = -20; // target height: chest

// The four hits, escalating. Each blade is longer than the one before.
const T1 = 0.06; // 1st: horizontal cut
const T2 = 0.32; // 2nd: over the head, diagonal down-cut from the other side
const T3 = 0.58; // 3rd: long diagonal line, high to low
const T4 = 0.86; // 4th: step-in thrust, one white flash frame on contact
const DUR = 1.62;

export const meta = {
  name: "Silver quartet",
  desc: "Four silver-white strikes in one breath: horizontal cut, windmill down-cut over the head, long diagonal severing line, thrust flashing white on contact.",
  tags: ["melee", "sword", "combo", "silver", "slash", "thrust", "directional", "one-shot"],
  size: [440, 260],
  origin: [140, 196],
  duration: DUR,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#0c1222", "#1b2847", "#354c78", "#5f7fae", "#9ab8e0", "#d2e5fc", "#eef6ff", "#ffffff"],
    sparks: ["#ffffff", "#eef6ff", "#d2e5fc", "#9ab8e0"],
    seed: 1,
  },
};

// ---------------------------------------------------------------- choreography
// He advances through the combo and never returns to guard between strikes: each follow-through
// coils straight into the next wind-up.
const STANCE = { ...READY, weapon: "sword", fx: 12, fy: -21, sa: -0.85, bx: 9, by: -21 };
const W1 = { ...STANCE, x: -6, crouch: 4, lean: -3, fx: -4, fy: -34, sa: -2.4, bx: 8, by: -24 };
const C1 = { ...STANCE, x: 10, crouch: 6, lean: 5, fx: 18, fy: -14, sa: 0.2, bx: -9, by: -22, ffx: 12, fbx: -9, toeB: true, ghost: 1 };
const F1 = { ...STANCE, x: 14, crouch: 4, lean: 1, fx: 16, fy: -24, sa: 0.9, bx: -6, by: -18 };
const W2 = { ...STANCE, x: 18, crouch: 6, lean: -2, fx: 8, fy: -34, sa: -2.1, bx: 11, by: -20, armsFront: true };
const C2 = { ...STANCE, x: 24, crouch: 6, lean: 6, fx: 14, fy: -10, sa: 1.2, bx: -10, by: -24, ffx: 13, fbx: -11, toeB: true, ghost: 1 };
const F2 = { ...STANCE, x: 28, crouch: 3, lean: -3, fx: -2, fy: -26, sa: -1.1 };
const W3 = { ...STANCE, x: 34, crouch: 6, lean: 3, fx: 10, fy: -32, sa: -1.9, bx: 7, by: -22 };
const C3 = { ...STANCE, x: 40, crouch: 7, lean: 7, fx: 18, fy: -20, sa: 1.35, bx: -11, by: -25, ffx: 15, fbx: -12, toeB: true, ghost: 1 };
const F3 = { ...STANCE, x: 42, crouch: 5, lean: 2, fx: 14, fy: -10, sa: 0.4 };
const P1 = { ...STANCE, x: 36, crouch: 5, lean: -2, fx: -2, fy: -16, sa: -0.1 };
const P2 = { ...STANCE, x: 42, crouch: 6, lean: 5, fx: 10, fy: -14, sa: 0.0 };
const LUNGE = { ...STANCE, x: 46, crouch: 6, lean: 7, fx: 20, fy: -24, sa: 0.05, bx: -12, by: -24, ffx: 16, fbx: -12, toeB: true, ghost: 1 };
const REC1 = { ...STANCE, x: 44, crouch: 4, lean: 2, fx: 16, fy: -16, sa: 0.3 };
const REC2 = { ...STANCE, x: 36, crouch: 3, lean: 1, fx: 16, fy: -19, sa: 0.0 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.5, { ...STANCE, x: -10 }],
    [-0.28, W1],
    [-0.06, { ...W1, x: -1 }],
    [T1, C1, "snap"],
    [T1 + 0.08, F1],
    [T2 - 0.06, W2],
    [T2, C2, "snap"],
    [T2 + 0.09, F2],
    [T3 - 0.10, W3],
    [T3, C3, "snap"],
    [T3 + 0.10, F3],
    [T4 - 0.14, P1],
    [T4 - 0.05, P2],
    [T4, LUNGE, "snap"],
    [T4 + 0.12, REC1],
    [T4 + 0.38, REC2],
    [1.42, { ...STANCE, x: 30 }],
    [DUR, { ...STANCE, x: 0 }],
  ],
  hits: [
    { t: T1, stop: 0.04, shake: 0.10, amp: 1.5, push: 1.5, straw: 4 },
    { t: T2, stop: 0.06, shake: 0.14, amp: 2.2, push: 2.2, straw: 7 },
    { t: T3, stop: 0.10, shake: 0.18, amp: 3.2, push: 3.2, straw: 11 },
    { t: T4, stop: 0.16, shake: 0.30, amp: 5.0, push: 5.0, straw: 16, shiver: 0.30, flash: 0.03 },
  ],
  dust: [
    { t: T1, x: 12, n: 5, dir: 1, c: "#cfe0f4" },
    { t: T2, x: 24, n: 7, dir: 1, c: "#eefbff" },
    { t: T3, x: 40, n: 9, dir: 1, c: "#ffffff" },
    { t: T4, x: 52, n: 16, dir: 1, c: "#ffffff" },
  ],
};

// ---------------------------------------------------------------- blade geometry
// Four forward-facing silver-white swings, each longer than the last (46 < 68 < 96 px).
// Every arc crosses the front-most point (screen x = cx + R, toward target TX = 108) so all
// blades read as forward strikes — none wraps behind the swordsman. Each swing ends where the
// next begins, so the four strikes form one continuous combo with no return to guard.
const S1 = swing({ cx: 50, cy: -18, R: 46, sy: 0.30, rot: 0.03, a0: -1.20, dir: 1 });
const B1 = { ...S1, span: 2.00, W: 11, t0: 0.00, sweep: 0.05, hold: 0.05, trail: 0.14, hot: 0.30 };
// 1st: horizontal cut across the front, left-front → front → right-front

const S2 = swing({ cx: 42, cy: -30, R: 68, sy: 0.90, rot: -0.04, a0: 1.10, dir: -1 });
const B2 = { ...S2, span: 2.30, W: 17, t0: 0.18, sweep: 0.07, hold: 0.06, trail: 0.17, hot: 0.50 };
// 2nd: from #1's end (right-front), the blade rises over the head and down-cuts from the other side

const S3 = swing({ cx: 30, cy: -20, R: 96, sy: 0.50, rot: 0.08, a0: -1.30, dir: 1 });
const B3 = { ...S3, span: 2.20, W: 25, t0: 0.42, sweep: 0.08, hold: 0.06, trail: 0.20, hot: 0.70 };
// 3rd: from #2's end (head-top/left-front), a long diagonal severing line high → low

// Thrust: from the lunge hand through the target and past it — the longest blade of all.
const THRUST = { x1: 176, y1: -20 };
const THRUST_START = 0.72, THRUST_REACH = T4, THRUST_HOLD = 0.94, THRUST_END = 1.08;

// A tapered silver cut left on the target by a hit: white hot core, silver edges, fades out.
function cutScar(p, cx, cy, ang, len, halfW, alpha, C, fullWhite) {
  if (alpha <= 0.02 || len < 1) return;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const pad = halfW + 2;
  p.shade(cx - Math.abs(ca) * len - pad, cy - Math.abs(sa) * len - pad,
          cx + Math.abs(ca) * len + pad, cy + Math.abs(sa) * len + pad,
          (x, y, out) => {
            const dx = x - cx, dy = y - cy;
            const along = dx * ca + dy * sa;
            if (Math.abs(along) > len + 1) return;
            const s = along / len;
            const taper = 1 - s * s;
            const w = halfW * taper;
            if (w < 0.3) return;
            const perp = Math.abs(-dx * sa + dy * ca);
            if (perp > w + 0.6) return;
            const q = perp / Math.max(0.4, w);
            const col = fullWhite || q < 0.32 ? WHITE : q < 0.72 ? C[5] : C[3];
            const al = alpha * taper * (q > 0.82 ? (1.15 - q) / 0.33 : 1);
            if (al > 0.93) p.px(x, y, col);
            else if (al > 0.03) p.blend(x, y, col, clamp(al, 0, 1));
          });
}

// A silver spark burst at the struck point.
function hitSparks(ps, R, cx, cy, aim, fan, n, speed, life, colors) {
  for (let i = 0; i < n; i++) {
    const a = aim + R.range(-fan, fan), sp = R.range(speed * 0.6, speed);
    ps.spawn(P.SPARK, cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, R.range(life * 0.7, life),
      colors[R.int(0, colors.length - 1)], 1);
  }
}

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: o.sparks, haze: C[3] });
  const bits = new Bits({ ground: floor }), lights = new Lights();

  // silver shavings peeling off the blade edges while each swing is live
  const shavings = [
    { b: B1, n: 10, from: 0.35, speed: [40, 100], life: [0.22, 0.42], t0: 0.0, t1: B1.sweep + B1.hold },
    { b: B2, n: 16, from: 0.30, speed: [50, 120], life: [0.24, 0.46], t0: B2.t0, t1: B2.t0 + B2.sweep + B2.hold },
    { b: B3, n: 24, from: 0.25, speed: [60, 140], life: [0.26, 0.50], t0: B3.t0, t1: B3.t0 + B3.sweep + B3.hold },
  ];

  let t = 0, h1 = false, h2 = false, h3 = false, h4 = false;

  // thrust progress: shoots out, pins at the target, holds the flash, withdraws
  function thrustU() {
    if (t < THRUST_START) return 0;
    if (t >= THRUST_REACH && t < THRUST_HOLD) return 1;
    if (t >= THRUST_HOLD) return 1 - smooth(THRUST_HOLD, THRUST_END, t);
    return ease.outExpo(clamp((t - THRUST_START) / (THRUST_REACH - THRUST_START)));
  }

  return {
    update(dt) {
      t += dt;

      // silver shavings peeling off the blade edges mid-swing
      for (const s of shavings) {
        if (t < s.t0 || t > s.t1 || !R.chance(2.2 * dt * 60)) continue;
        const u = s.b.span * R.range(s.from, 1);
        const [x, y] = onSwing(s.b, s.b.R, u);
        const ox = x - s.b.cx, oy = y - s.b.cy, l = Math.hypot(ox, oy) || 1;
        const sp = R.range(s.speed[0], s.speed[1]);
        ps.spawn(P.MOTE, x, y, (ox / l) * sp, (oy / l) * sp - 8, R.range(s.life[0], s.life[1]),
          R.chance(0.5) ? WHITE : C[5], 0.7);
      }

      // HIT 1: steel-silver horizontal cut connects
      if (!h1 && t >= T1) {
        h1 = true;
        lights.add(TX, TY, 30, C[4], 0.4, 0.14);
        hitSparks(ps, R, TX - 2, TY, 0.10, 1.05, 14, 160, 0.22, [C[5], C[4], WHITE]);
      }
      // HIT 2: brighter moon-silver down-cut from the other side
      if (!h2 && t >= T2) {
        h2 = true;
        lights.add(TX, TY - 2, 48, C[5], 0.62, 0.18);
        hitSparks(ps, R, TX, TY - 2, -0.62, 1.30, 26, 220, 0.32, [C[5], C[4], WHITE]);
        for (let i = 0; i < 6; i++) {
          ps.spawn(P.STAR, TX + R.range(-10, 14), TY - 2 + R.range(-12, 10), R.range(10, 45), -R.range(16, 50), R.range(0.22, 0.38), R.chance(0.5) ? WHITE : C[5], R.range(1.2, 1.8));
        }
      }
      // HIT 3: the long diagonal severing cut — silver spray and gouged dust
      if (!h3 && t >= T3) {
        h3 = true;
        lights.add(TX - 1, TY - 4, 64, C[6], 0.9, 0.26);
        hitSparks(ps, R, TX - 1, TY - 4, 0.0, 1.05, 42, 280, 0.44, [WHITE, C[6], C[5]]);
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + R.range(-0.8, 1.05);
          ps.spawn(P.GRIT, TX + R.range(-14, 14), -1, Math.cos(a) * R.range(50, 190), Math.sin(a) * R.range(40, 130), R.range(0.5, 0.85), C[4], R.chance(0.3) ? 2 : 1);
        }
        for (let i = 0; i < 8; i++) {
          ps.spawn(P.SMOKE, TX + R.range(-16, 16), -1, R.range(-40, 40), -R.range(2, 16), R.range(0.5, 0.8), C[3], R.range(5, 8), 0, PF.BIG);
        }
      }
      // HIT 4: the thrust lands — white flash frame, oppressive crush
      if (!h4 && t >= T4) {
        h4 = true;
        lights.add(TX + 2, TY, 56, WHITE, 1.0, 0.42);
        lights.add(TX + 2, TY, 96, C[6], 0.6, 0.28);
        for (let i = 0; i < 52; i++) {
          const forward = i % 4 !== 0;
          const a = forward ? R.range(-0.85, 0.85) : R.range(2.35, 3.95);
          const sp = forward ? R.range(190, 440) : R.range(90, 210);
          ps.spawn(P.SPARK, TX + 2 + R.range(-4, 4), TY + R.range(-5, 5), Math.cos(a) * sp, Math.sin(a) * sp - 14, R.range(0.24, 0.58), WHITE, 1);
        }
        // the shockwave gouges the floor as the thrust pins the target
        for (let i = 0; i < 14; i++) {
          const sd = i % 2 ? 1 : -1;
          ps.spawn(P.SMOKE, TX + sd * R.range(6, 30), 0, sd * R.range(40, 110), -R.range(0, 10), R.range(0.55, 0.9), C[4], R.range(6, 10), 0, PF.BIG);
        }
        for (let i = 0; i < 6; i++) {
          bits.add({ kind: B.CHUNK, x: TX + R.range(-12, 12), y: -1, vx: R.range(-60, 140), vy: -R.range(90, 200), g: 1.1, drag: 0.4, bounce: 0.3, life: R.range(0.6, 0.9), a: R.range(0, TAU), va: R.range(-14, 14), s: R.int(1, 2) });
        }
      }

      ps.update(dt);
      bits.update(dt);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= DUR - 1e-6) return;
      // far halves of the swings pass behind the swordsman
      slash(p, { ...B1, ramp: C }, t, -1);
      slash(p, { ...B2, ramp: C }, t, -1);
      slash(p, { ...B3, ramp: C }, t, -1);
      ps.draw(p, { layer: "back" });
    },

    draw(p) {
      if (t >= DUR - 1e-6) return;
      const isFlash = t >= T4 && t < T4 + FRAME;
      const u = thrustU();

      // 1st: horizontal silver cut
      if (t >= B1.t0 && t < B1.t0 + B1.sweep + B1.hold + B1.trail + 0.05) slash(p, { ...B1, ramp: C }, t, 1);
      // 2nd: over the head, down-cut from the other side
      if (t >= B2.t0 && t < B2.t0 + B2.sweep + B2.hold + B2.trail + 0.05) slash(p, { ...B2, ramp: C }, t, 1);
      // 3rd: long diagonal severing line, high to low
      if (t >= B3.t0 && t < B3.t0 + B3.sweep + B3.hold + B3.trail + 0.05) slash(p, { ...B3, ramp: C }, t, 1);

      // 4th: the lunging thrust — shoots out, pins, flashes white, withdraws
      if (u > 0) {
        const q = poseAt(act.poses, t);
        const J = skeleton(q);
        const hx = q.x + J.joints.handN[0], hy = J.joints.handN[1];
        const ca = THRUST.x1 - hx, sa = THRUST.y1 - hy;
        const L = Math.hypot(ca, sa) || 1;
        const tipX = hx + ca * u, tipY = hy + sa * u;
        const hot = isFlash || u > 0.85;
        const wCore = isFlash ? 2.6 : 1.2;
        const halfW = wCore + 1.6;
        p.shade(hx - halfW - 2, Math.min(hy, tipY) - halfW - 2,
                hx + Math.abs(tipX - hx) + halfW + 2, Math.max(hy, tipY) + halfW + 2,
                (x, y, out) => {
                  const dx = x - hx, dy = y - hy;
                  const along = (dx * ca + dy * sa) / L;
                  if (along < -1 || along > L * u + 1) return;
                  const perp = Math.abs(-dx * sa + dy * ca) / L;
                  const w = halfW * (0.5 + 0.5 * Math.sin(Math.PI * (along / Math.max(L * u, 1))));
                  if (perp > w + 0.5) return;
                  const q = perp / Math.max(0.4, w);
                  const fade = u < 0.5 ? along / (L * u * 0.5 + 0.01) : 1;
                  const col = hot || q < 0.3 ? WHITE : q < 0.7 ? C[5] : C[3];
                  const al = (hot ? 1 : 0.92) * fade * (q > 0.85 ? (1.1 - q) / 0.3 : 1);
                  if (al > 0.93) p.px(x, y, col);
                  else if (al > 0.03) p.blend(x, y, col, clamp(al, 0, 1));
                });
        // light riding the blade, brightest at the tip
        if (u > 0.15) {
          const k = isFlash ? 0.55 : 0.22 * Math.min(1, u * 1.6);
          p.glow(tipX, tipY, isFlash ? 26 : 14 + 10 * u, hot ? WHITE : C[5], k);
          p.glow(hx, hy, 8, C[4], 0.18 * (1 - u * 0.5));
        }
        // speed lines racing beside the thrust
        const nLines = u < 0.92 ? 4 + Math.floor(u * 5) : 0;
        for (let i = 0; i < nLines; i++) {
          const phase = ((t * 24) + i * 0.37) % 1;
          const d = L * u * phase;
          if (d < 4 || d > L * u - 2) continue;
          const side = (i % 2 ? 1 : -1) * (1.6 + 0.9 * i);
          const nx = -sa / L * side, ny = ca / L * side;
          const k = 1 - phase;
          const col = phase > 0.75 ? WHITE : phase > 0.45 ? C[6] : C[5];
          p.line(hx + ca / L * d + nx, hy + sa / L * d + ny,
                 hx + ca / L * (d - 7 * k) + nx, hy + sa / L * (d - 7 * k) + ny,
                 col, 0.85 * k * (isFlash ? 1.4 : 1));
        }
        // pierce ring at the target once the point arrives
        if (u > 0.62) {
          const f = (u - 0.62) / 0.38, r = 3 + 6 * ease.outCubic(f), aRing = 1 - smooth(0.62, 1.0, u);
          for (let a = 0; a < TAU; a += 0.12) {
            const aa = a + f * 1.2;
            const hot = aRing > 0.5 ? WHITE : (a < Math.PI / 2 || a > Math.PI * 1.5) ? C[6] : C[5];
            p.dot(TX + 2 + Math.cos(aa) * r, TY + Math.sin(aa) * r * 0.5, hot, aRing * 0.9);
          }
        }
      }

      // hit result scars on the target, escalating with the blade
      if (t >= T1 && t < T1 + 0.55) {
        const a4 = 1 - smooth(T1 + 0.1, T1 + 0.55, t);
        cutScar(p, TX - 2, TY, 0.05, 34 * a4, 1.6, a4, C, false);
      }
      if (t >= T2 && t < T2 + 0.6) {
        const a4 = 1 - smooth(T2 + 0.12, T2 + 0.6, t);
        cutScar(p, TX, TY - 2, -0.55, 48 * a4, 2.2, a4, C, false);
      }
      if (t >= T3 && t < T3 + 0.7) {
        const a4 = 1 - smooth(T3 + 0.14, T3 + 0.7, t);
        cutScar(p, TX - 1, TY - 4, 0.8, 66 * a4, 3.0, a4, C, false);
      }
      if (t >= T4 && t < T4 + 0.62) {
        const a4 = 1 - smooth(T4 + 0.12, T4 + 0.62, t);
        cutScar(p, TX + 2, TY, 0.02, 108 * a4, isFlash ? 4.5 : 3.4, isFlash ? 1 : a4, C, isFlash);
      }

      // the 1-frame blinding white contact: white pierce scar, flare, star
      if (isFlash) {
        cutScar(p, TX + 2, TY, 0.02, 112, 5.0, 1.0, C, true);
        const g = 1 - (t - T4) / FRAME;
        sparkle(p, TX + 2, TY, 16 * g, WHITE, C[5], 0.9);
        flare(p, TX + 2, TY, 34, 1.0, [WHITE, WHITE, C[6], C[5]]);
        p.glow(TX + 2, TY, 44, WHITE, 0.5);
      } else if (t > T4 && t < T4 + 0.5) {
        const age = t - T4, f = age / 0.5;
        sparkle(p, TX + 2, TY, 10 * (1 - f), WHITE, C[5], 0.8 * (1 - f));
        p.glow(TX + 2, TY, 26 + 14 * f, C[5], 0.35 * (1 - f));
      }

      ps.draw(p, { layer: "front" });
      lights.draw(p);
    },
  };
}
