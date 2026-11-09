// An unbroken four-hit silver basic-attack combo, played as one continuous act. The crescent smear, tapered
// blade band, rift scars and pierce flash build on Sprite Fusion's open-source slash / impact / dash VFX
// (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, B, PF, Rng, fit, sparkle, flare, clamp, lerp, smooth, ease, TAU, WHITE, READY } from "../../core/index.js";
import { swing, onSwing, plane, stone, cracks, rock } from "./_lib.js";

export const meta = {
  name: "Quad slash",
  desc: "An unbroken four-hit silver combo: a horizontal cut flows over the head into a diagonal crash, a high-to-low rake, then a stepping lunge thrust. Longer each hit.",
  tags: ["melee", "sword", "slash", "combo", "silver", "white", "combat", "directional", "one-shot"],
  size: [376, 204],
  origin: [118, 150],
  duration: 1.76,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#0c1222", "#1b2847", "#354c78", "#5f7fae", "#9ab8e0", "#d2e5fc", "#eef6ff", "#ffffff"],
    stone: "#564e6e",
    seed: 7,
  },
};

// ---------------------------------------------------------------------------
// choreography: every hit constant lives here and lines up poses, smears, scars, hits and dust
const TX = 92;                                     // the target plane the four hits cut into
const T_S1 = 0.05, T_H1 = 0.145, T_E1 = 0.2;     // 1 横砍        horizontal cut, chest height
const T_S2 = 0.285, T_H2 = 0.425, T_E2 = 0.43;   // 2 绕过头顶斜劈 the blade goes up and over, crashes down diagonal
const T_S3 = 0.545, T_H3 = 0.66, T_E3 = 0.722;    // 3 高贯低斜线  one long diagonal, high side to low
const T_S4 = 0.815, T_HOLD4 = 0.895; // 4 前跨一步直刺 forward step, straight thrust
const T_H4 = T_HOLD4;                              // the thrust arrives
const T_END = 1.76;

// ---------------------------------------------------------------------------
// the acting body: wind-up -> cut 1 -> the blade rides up the right side, over the head, no return cut ->
// overhead crash -> rake from the upper side -> coil, then a full step lunge thrust
const STANCE = { ...READY, weapon: "sword", fx: 12, fy: -21, sa: -0.85 };
const WIND1 = { ...STANCE, x: -9, crouch: 4, lean: -4, fx: -6, fy: -33, sa: -2.62, bx: 9, by: -25, armsFront: true, ffx: 9, fbx: -8 };
const CUT1 = { ...STANCE, x: 2, crouch: 3, lean: 4, fx: 17, fy: -22, sa: 0.02, bx: -8, by: -23, ffx: 11, fbx: -9, toeB: true, ghost: 1 };
const RISE2 = { ...STANCE, x: 5, crouch: 4, lean: -1, fx: 16, fy: -15, sa: -1.18, bx: -7, by: -20, ffx: 9, fbx: -9, ghost: 1 };
const WIND2 = { ...STANCE, x: 5, crouch: 6, lean: -3, fx: -2, fy: -38, sa: -2.32, bx: 8, by: -26, armsFront: true, ffx: 10, fbx: -9 };
const CRASH2 = { ...STANCE, x: 13, crouch: 6, lean: 6, fx: 16, fy: -13, sa: 0.95, bx: -9, by: -22, ffx: 12, fbx: -9, toeB: true, ghost: 1 };
const WIND3 = { ...STANCE, x: 13, crouch: 5, lean: -3, fx: 9, fy: -37, sa: -2.14, bx: 7, by: -27, armsFront: true, ffx: 11, fbx: -9 };
const CUT3 = { ...STANCE, x: 19, crouch: 5, lean: 7, fx: 15, fy: -8, sa: 1.16, bx: -9, by: -20, ffx: 13, fbx: -8, toeB: true, ghost: 1 };
const COIL4 = { ...STANCE, x: 17, crouch: 7, lean: -2, fx: -2, fy: -22, sa: -0.14, bx: 8, by: -26, armsFront: true, ffx: 11, fbx: -10 };
const LUNGE4 = { ...STANCE, x: 51, crouch: 6, lean: 8, fx: 22, fy: -19, sa: 0.02, bx: -4, by: -22, ffx: 19, fbx: -9, toeB: true, ghost: 1 };
const HOLD4 = { ...LUNGE4, ghost: undefined, crouch: 5, lean: 6, fx: 24, fy: -20 };
const STAND4 = { ...STANCE, x: 27, crouch: 3, lean: 2, fx: 13, fy: -20, sa: -0.4, bx: -6, by: -21 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.34, { ...STANCE, x: -9 }],
    [-0.11, WIND1],
    [T_S1, { ...WIND1, x: -5, fy: -35, sa: -2.75 }],
    [T_S1 + 0.015, CUT1, "snap"],        // strike as the smear releases
    [0.245, RISE2],                      // momentum carries the blade up the right side
    [0.29, WIND2],                       // up and over the head — the wrist rolls, no return cut
    [0.375, CRASH2, "snap"],             // and down from the other side
    [0.505, { ...CRASH2, crouch: 5, ghost: undefined, fy: -10 }],
    [T_S3, WIND3, "snap"],               // blade snapped high to the upper side
    [T_H3, CUT3, "snap"],                // one long diagonal rake, crest to floor
    [0.755, { ...CUT3, ghost: undefined, crouch: 4, fy: -11 }],
    [T_S4, COIL4, "snap"],               // gather: blade drawn back to the hip
    [T_H4, LUNGE4, "snap"],              // a full step forward, blade straight out
    [1.075, HOLD4],
    [1.28, STAND4],
    [T_END, { ...STANCE, x: 22 }],
  ],
  hits: [
    { t: T_H1, stop: 0.055, shake: 0.09, amp: 1.3, push: 1.2, straw: 4, y: -24, flash: 0.02 },
    { t: T_H2, stop: 0.075, shake: 0.13, amp: 1.9, push: 2.1, straw: 7, y: -26, flash: 0.024 },
    { t: T_H3, stop: 0.09, shake: 0.17, amp: 2.4, push: 2.7, straw: 9, y: -23, flash: 0.028 },
    { t: T_H4, stop: 0.12, shake: 0.42, amp: 4.3, push: 5.2, straw: 18, shiver: 0.32, y: -22, flash: 0.033 },
  ],
  dust: [
    { t: T_H1, x: 12, n: 4, dir: 1 },
    { t: T_H2, x: 14, n: 5, dir: 1 },
    { t: T_H3, x: 20, n: 6, dir: 1 },
    { t: T_S4, x: -2, n: 6, dir: -1 },
    { t: T_H4, x: 30, n: 10, dir: 1 },
  ],
};

// ---------------------------------------------------------------------------
// the four strokes: each plane, in order, each longer and brighter than the last.
// 1) horizontal smear low and level; 2) a tall over-the-head arc crashing to the target;
// 3) a long straight diagonal band, upper side to low; 4) a straight lunge streak with a white rift.
const S1 = swing({ cx: 44, cy: -42, R: 45, sy: 0.44, rot: 0.13, a0: 2.66, dir: -1, span: 1.86 });
const S1_SPAN = 1.9;
const S2 = swing({ cx: 34, cy: -10, R: 60, sy: 0.74, rot: 0.14, a0: -2.72, dir: 1, span: 2.32 });
const S2_SPAN = 2.32;
// 3) the long diagonal: a straight tapered band from the upper side down to the floor past the target
const D3_A = [6, -56], D3_B = [110, 2];
const D3_LEN = Math.hypot(D3_B[0] - D3_A[0], D3_B[1] - D3_A[1]);
const D3_ANG = Math.atan2(D3_B[1] - D3_A[1], D3_B[0] - D3_A[0]);
const D3_MID = [(D3_A[0] + D3_B[0]) / 2, (D3_A[1] + D3_B[1]) / 2];
// 4) the lunge: the hand at the end of the step, the point past the target
const HX = 73, HY = -19, TIP = 118, TY = -19;

// Zero-checkerboard smooth polar crescent shader (`p.px` / `p.blend`), neighbours of the arcs clamped to the canvas
function bandSmear(p, s, u0, u1, wMax, fn, half = 0, pad = 1.2) {
  if (u1 - u0 < 0.008) return;
  const c = Math.cos(s.rot), n = Math.sin(s.rot), A = s.R + pad + 1, Bn = A * s.sy + s.k * 0 + (wMax + 2);
  const hx = Math.ceil(Math.hypot(A * c, Bn * n) + 2), hy = Math.ceil(Math.hypot(A * n, Bn * c) + 2);
  const rIn = s.R - wMax - 1.5;
  const over = Math.ceil(Math.abs(n) * A + (wMax + 2) + 2);
  const y0 = Math.max(-146, Math.floor(half > 0 ? s.cy - over : s.cy - hy));
  const y1 = Math.min(2, Math.ceil(half < 0 ? s.cy + over : s.cy + hy));
  const x0 = Math.max(-116, Math.floor(s.cx - hx));
  const x1 = Math.min(254, Math.ceil(s.cx + hx));
  const out = { c: 0, a: 0 };

  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const [r, a] = plane(s, px, py);
      if (r > s.R + pad || r < rIn) continue;
      if (half && (Math.sin(a) < 0 ? -1 : 1) !== half) continue;
      let u = (s.dir * (a - s.a0)) % TAU;
      if (u < 0) u += TAU;
      while (u < u0) u += TAU;
      if (u > u1) continue;
      out.a = 0;
      fn(u, r, out, a);
      if (out.a > 0.93) p.px(x, y, out.c);
      else if (out.a > 0.03) p.blend(x, y, out.c, out.a);
    }
  }
}

// Smooth additive light ribbon hugging a swing arc (clamped inside the canvas)
function glowAlongArc(p, s, r, u0, u1, rad, col, alphaFn, half = 0) {
  const step = 0.14;
  for (let u = u0; u <= u1; u += step) {
    const g = s.a0 + s.dir * u;
    if (half && (Math.sin(g) < 0 ? -1 : 1) !== half) continue;
    const [gx, gy] = onSwing(s, r, u);
    if (gy > 2 || gx < -116 + rad || gx > 256 - rad || gy < -146 + rad) continue;
    const a = typeof alphaFn === "function" ? alphaFn(u) : alphaFn;
    if (a > 0.008) p.glow(gx, gy, rad, col, a);
  }
}

// Tapered razor-sharp scar for the hit results: a straight tapered lens, white rim cut by q falloff
function silverScar(p, cx, cy, ang, halfLen, halfW, C, alpha, pureWhite = false) {
  if (alpha <= 0.03 || halfLen < 1) return;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const minX = Math.max(-116, Math.floor(cx - Math.abs(ca) * halfLen - halfW - 2));
  const maxX = Math.min(254, Math.ceil(cx + Math.abs(ca) * halfLen + halfW + 2));
  const minY = Math.max(-146, Math.floor(cy - Math.abs(sa) * halfLen - halfW - 2));
  const maxY = Math.min(44, Math.ceil(cy + Math.abs(sa) * halfLen + halfW + 2));

  for (let y = minY; y <= maxY; y++) {
    const dy = y + 0.5 - cy;
    for (let x = minX; x <= maxX; x++) {
      const dx = x + 0.5 - cx;
      const along = dx * ca + dy * sa;
      if (Math.abs(along) > halfLen) continue;
      const s = along / halfLen;
      const taper = 1 - s * s;
      const w = halfW * taper;
      if (w < 0.3) continue;
      const perp = Math.abs(-dx * sa + dy * ca);
      if (perp > w + 0.65) continue;
      const q = perp / Math.max(0.4, w);
      const col = pureWhite || q <= 0.44 ? WHITE : q <= 0.82 ? C[6] : C[4];
      const al = alpha * (q > 0.82 ? (1.2 - q) / 0.38 : 1) * (0.38 + 0.62 * taper);
      if (al > 0.93) p.px(x, y, col);
      else if (al > 0.03) p.blend(x, y, col, clamp(al, 0, 1));
    }
  }
}

// The third stroke: a long straight tapered blade band from the upper side down to the low line, revealed A -> B
function diagonalBand(p, u0, u1, wMax, C, fade, pureWhite = false) {
  if (u1 - u0 < 0.01 || fade <= 0.03) return;
  const dx = D3_B[0] - D3_A[0], dy = D3_B[1] - D3_A[1];
  const nlen = Math.hypot(dx, dy), ux = dx / nlen, uy = dy / nlen;
  const minX = Math.max(-116, Math.floor(Math.min(D3_A[0], D3_B[0]) - wMax - 2));
  const maxX = Math.min(254, Math.ceil(Math.max(D3_A[0], D3_B[0]) + wMax + 2));
  const minY = Math.max(-146, Math.floor(Math.min(D3_A[1], D3_B[1]) - wMax - 2));
  const maxY = Math.min(44, Math.ceil(Math.max(D3_A[1], D3_B[1]) + wMax + 2));
  const out = { c: 0, a: 0 };

  for (let y = minY; y <= maxY; y++) {
    const py = y + 0.5 - D3_A[1];
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5 - D3_A[0];
      const along = px * ux + py * uy;
      if (along < -wMax || along > nlen + wMax) continue;
      const v = clamp(along / nlen);                 // 0 at the upper side, 1 at the low end
      if (v > u1 || v < u0) continue;
      const w = wMax * Math.sin(Math.PI * Math.pow(v, 1.55)) * (0.45 + 0.55 * fade);
      if (w < 0.45) continue;
      const perp = Math.abs(-px * uy + py * ux);
      if (perp > w + 0.65) continue;
      const q = perp / Math.max(0.4, w);
      if (q > 1.1) continue;
      const col = pureWhite ? WHITE : q < 0.30 ? WHITE : q < 0.58 ? C[6] : q < 0.82 ? C[5] : C[3];
      const al = fade * (q > 0.85 ? (1.1 - q) / 0.25 : 1) * (0.42 + 0.58 * Math.min(1, v * 3 + 0.25));
      if (al > 0.93) p.px(x, y, col);
      else if (al > 0.03) p.blend(x, y, col, clamp(al, 0, 1));
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8), st = stone(o.stone);
  const R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[6], C[5], C[4]], haze: C[3] });
  const bits = new Bits({ ground: floor }), lights = new Lights();

  // jagged shockwave rings on the floor: dashes of varying width, gaps, and shard ticks standing on the rim
  const makeRing = () => {
    const out = [];
    let a = R.range(0, 0.35);
    while (a < TAU) {
      const len = R.range(0.26, 0.7);
      out.push({ a, len, w: R.range(1.4, 2.6), tick: R.chance(0.3), h: R.range(1.4, 3.6) });
      a += len + R.range(0.07, 0.26);
    }
    return out;
  };
  const RING3 = makeRing(), RING4 = makeRing();
  const drawRing = (p, segs, cx, cy, u, maxR, sy, hot, half, thick = 2) => {
    if (u <= 0 || u >= 1) return;
    const r = maxR * ease.outCubic(u);
    if (r < 2.5) return;
    const fade = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    const step = Math.max(0.02, 1.15 / r);
    const cCore = hot ? WHITE : C[6];
    for (const s of segs) {
      const mid = s.a + s.len * 0.5;
      if (half && (Math.sin(mid) < 0 ? -1 : 1) !== half) continue;
      for (let a = s.a; a < s.a + s.len; a += step) {
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * sy;
        p.dot(px, py, u < 0.3 ? WHITE : cCore, fade);
        if (thick > 1 && s.w > 1.9) p.dot(px, py + 1, C[4], fade * 0.85);
        if (thick > 2 && s.w > 2.25) p.dot(px, py - 1, C[6], fade * 0.7);
      }
      if (s.tick && u < 0.55) {
        const px = cx + Math.cos(mid) * r, py = cy + Math.sin(mid) * r * sy;
        const h = s.h * (1 - u / 0.55);
        for (let j = 0; j <= h; j++) p.dot(px, py - j, j > h - 1.2 ? WHITE : C[6], fade * 0.9);
      }
    }
    if (!half) p.glow(cx, cy - 1, r * 0.5, C[5], 0.16 * fade);
  };

  // the finishing lunge: streak bundle from the hand to a long four-point star, pierce ring, speed lines
  const streaks = [-7, -4, -2, 0, 2, 4, 7].map((off) => ({ off, x0: HX + 1 + R.range(0, 5) + Math.abs(off) * 0.6, t0: R.range(0, 0.02) + Math.abs(off) * 0.003, w: off === 0 ? 2 : 1, hot: off === 0, len: R.range(0.75, 1) }));
  const lines = [];
  // delayed cross-gashes snapping open on the struck target after the thrust
  const gashes = [
    { dt: 0.06, dx: 3, dy: -27, a: -0.52, len: 30 },
    { dt: 0.13, dx: 7, dy: -18, a: 0.46, len: 34 },
    { dt: 0.2, dx: 6, dy: -24, a: -0.04, len: 42 },
  ].map((g) => ({ ...g, fired: false }));
  // razor wind-slivers flung forward past the target by the thrust
  const windSlivers = Array.from({ length: 5 }, (_, i) => ({
    x0: TX + 4 + (i % 2) * 9, y0: -13 - i * 7, vx: 155 + i * 30, vy: (i - 2) * 26, ang: (i - 2) * 0.16, len: 12 + (i % 3) * 4, life: 0.34 + (i % 2) * 0.08,
  }));
  // ground gouge cracks scoured by the third cut and the fourth thrust
  const cracks3 = cracks(R, 62, 5, 40, 6, 0.42);
  const cracks4 = cracks(R, 76, 9, 66, 9, 0.46);

  let t = 0, h1 = false, h2 = false, h3 = false, h4 = false, postFlash = 0;

  const OUT = T_HOLD4 - T_S4; // the thrust's reach, in seconds
  return {
    update(dt) {
      t += dt;

      // shavings peeled off the travelling edge of strokes 2 and 3
      if (t >= T_S2 && t < T_E2 + 0.05 && R.chance(1.7 * dt * 60)) {
        const u = S2_SPAN * clamp((t - T_S2) / (T_E2 - T_S2));
        const [sx, sy] = onSwing(S2, S2.R, u);
        ps.spawn(P.MOTE, sx, sy, R.range(15, 80), -R.range(30, 105), R.range(0.2, 0.36), R.chance(0.5) ? WHITE : C[6], 1);
      }
      if (t >= T_S3 && t < T_E3 + 0.05 && R.chance(1.7 * dt * 60)) {
        const u = clamp((t - T_S3) / (T_E3 - T_S3));
        ps.spawn(P.MOTE, lerp(D3_A[0], D3_B[0], u) + R.range(-3, 3), lerp(D3_A[1], D3_B[1], u) + R.range(-2, 2), R.range(-40, 90), -R.range(25, 85), R.range(0.2, 0.36), WHITE, 1);
      }
      // speed lines racing beside the thrust bundle
      if (t >= T_S4 && t < T_HOLD4 + 0.1 && R.chance(0.5)) {
        const s = R.sign();
        lines.push({ x: HX + R.range(0, (TIP - HX) * 0.55), y: HY + s * R.range(7, 17), l: R.range(18, 40), v: R.range(200, 340), t });
      }
      for (let i = lines.length - 1; i >= 0; i--) if (t - lines[i].t > 0.24) lines.splice(i, 1);
      for (const l of lines) l.x += l.v * dt;

      // HIT 1 — compact steel-silver cut: a small burst off the crossing plane
      if (!h1 && t >= T_H1) {
        h1 = true;
        lights.add(TX - 4, -24, 28, C[6], 0.32, 0.14);
        for (let i = 0; i < 10; i++) {
          const a = R.range(-0.7, 0.9), sp = R.range(90, 210);
          ps.spawn(P.SPARK, TX - 4, -23, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.12, 0.28));
        }
        for (let i = 0; i < 5; i++) ps.spawn(P.MOTE, TX - 2, -24, R.range(-30, 40), -R.range(15, 55), R.range(0.22, 0.4), C[5], 0.6);
      }
      // HIT 2 — the moon-silver crash: a bright fountain off the struck crown
      if (!h2 && t >= T_H2) {
        h2 = true;
        lights.add(TX - 2, -27, 48, C[6], 0.58, 0.2);
        lights.add(TX - 2, -27, 16, WHITE, 0.5, 0.08);
        for (let i = 0; i < 16; i++) {
          const a = R.range(-1.5, 0.7), sp = R.range(110, 260);
          ps.spawn(P.SPARK, TX - 2, -26, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.15, 0.34));
        }
        for (let i = 0; i < 4; i++) ps.spawn(P.STAR, TX + R.range(-8, 12), -26 + R.range(-13, 9), R.range(5, 35), -R.range(10, 45), R.range(0.2, 0.36), WHITE, R.range(1, 1.7));
      }
      // HIT 3 — the long diagonal: sparks sheared off along the whole line
      if (!h3 && t >= T_H3) {
        h3 = true;
        lights.add(TX + 2, -24, 56, WHITE, 0.66, 0.24);
        lights.add(34, -44, 26, C[5], 0.4, 0.16);
        for (let i = 0; i < 22; i++) {
          const a = D3_ANG + R.range(-0.55, 0.55) - Math.PI * (i % 3 === 0 ? 1 : 0), sp = R.range(120, 300);
          ps.spawn(P.SPARK, lerp(D3_A[0], D3_B[0], R.range(0.35, 0.9)), lerp(D3_A[1], D3_B[1], R.range(0.35, 0.9)), Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.16, 0.36));
        }
        for (let i = 0; i < 6; i++) ps.spawn(P.STAR, TX + R.range(-14, 14), -24 + R.range(-15, 12), R.range(8, 45), -R.range(14, 50), R.range(0.2, 0.38), WHITE, R.range(1, 1.9));
      }
      // HIT 4 — the thrust: colossal oppressive burst, forward bias, the target blown open
      if (!h4 && t >= T_H4) {
        h4 = true;
        lights.add(TX + 2, -22, 76, WHITE, 1.0, 0.42);
        lights.add(58, -20, 46, C[6], 0.6, 0.24);
        lights.add(TX + 62, -22, 44, WHITE, 0.55, 0.16);
        for (let i = 0; i < 56; i++) {
          const fwd = i % 5 !== 0;
          const a = fwd ? R.range(-0.55, 0.42) : R.range(2.62, 3.55);
          const sp = fwd ? R.range(160, 400) : R.range(100, 230);
          ps.spawn(P.SPARK, TX + R.range(-4, 12), -22 + R.range(-9, 9), Math.cos(a) * sp, Math.sin(a) * sp - 14, R.range(0.22, 0.55), WHITE, 1, 0, i % 3 === 0 ? PF.BOUNCE : 0);
        }
        for (let i = 0; i < 12; i++) ps.spawn(P.STAR, TX + R.range(-14, 54), -22 + R.range(-22, 12), R.range(18, 85), R.range(-28, 16), R.range(0.24, 0.5), i % 2 === 0 ? WHITE : C[6], R.range(1.2, 2.2));
        for (let i = 0; i < 12; i++) {
          const sd = i % 2 ? 1 : -1;
          ps.spawn(P.SMOKE, sd > 0 ? TX + R.range(-2, 16) : 16 + R.range(-10, 10), -2, sd * R.range(55, 150), -R.range(4, 18), R.range(0.5, 0.78), i % 3 === 0 ? C[4] : st.dust, R.range(4.2, 7.6), 0, PF.BIG);
        }
        for (let i = 0; i < 22; i++) {
          const a = -Math.PI / 2 + R.range(-0.85, 0.95), sp = R.range(60, 210);
          ps.spawn(P.GRIT, 78 + R.range(-24, 24), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.48, 0.82), R.pick([C[6], st.light, st.body]), R.chance(0.35) ? 2 : 1);
        }
        for (let i = 0; i < 6; i++) bits.add({ kind: B.CHUNK, x: 78 + R.range(-20, 22), y: -2, vx: R.range(-45, 135), vy: -R.range(90, 205), g: 1.12, drag: 0.4, bounce: 0.3, life: R.range(0.55, 0.82), a: R.range(0, TAU), va: R.range(-14, 14), s: R.int(1, 2) });
      }
      // delayed cross-gashes snapping open on the struck target
      if (t >= T_H4) {
        for (const g of gashes) {
          if (!g.fired && t >= T_H4 + g.dt) {
            g.fired = true;
            lights.add(TX + g.dx, g.dy, 34, WHITE, 0.72, 0.15);
            for (let k = 0; k < 12; k++) {
              const dir = g.a + (k % 2 ? 0 : Math.PI) + R.range(-0.22, 0.22);
              ps.spawn(P.SPARK, TX + g.dx, g.dy, Math.cos(dir) * R.range(90, 220), Math.sin(dir) * R.range(90, 220), R.range(0.14, 0.27));
            }
          }
        }
      }
      bits.update(dt);
      ps.update(dt);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-6) return;
      const isFlashFrame = t >= T_H4 && postFlash === 0;

      // ground gouge cracks: the third cut and the fourth thrust tear the stone open
      for (const [cracks_, t0, reach] of [[cracks3, T_H3, 40], [cracks4, T_H4, 66]]) {
        if (t < t0) continue;
        const age = t - t0, grow = clamp(age / 0.12), fade = 1 - smooth(T_END - 0.75, T_END - 0.1, t);
        if (fade <= 0.03) continue;
        for (const cr of cracks_) {
          const n = Math.floor(cr.pts.length * grow);
          for (let i = 1; i < n; i++) {
            const u = i / cr.pts.length, hot = (1 - smooth(0, 0.4, age)) * (1 - u * 0.5);
            const col = isFlashFrame || hot > 0.55 ? WHITE : hot > 0.22 ? C[5] : st.dark;
            p.line(cr.pts[i - 1][0], cr.pts[i - 1][1], cr.pts[i][0], cr.pts[i][1], col, fade);
          }
        }
      }

      // the far halves of the floor shockwaves run behind him
      drawRing(p, RING3, TX - 6, 0, (t - T_H3) / 0.46, 40, 0.16, false, -1, 1);
      drawRing(p, RING4, TX - 4, 0, (t - T_H4) / 0.66, 110, 0.16, true, -1);

      ps.draw(p, { layer: "back" });
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;
      const isFlashFrame = t >= T_H4 && postFlash === 0; // exactly one rendered frame, however the act clock pins
      if (isFlashFrame) postFlash = 1;
      const f1 = clamp((t - T_S1) / (T_E1 - T_S1));

      // ============================================================
      // STROKE 1 — 横砍 horizontal cut (shortest arc, cold steel-silver)
      // ============================================================
      const end1 = T_S2 + 0.02;
      if (t >= T_S1 && t < end1) {
        const uHead = S1_SPAN * ease.outQuart(f1);
        const uTail = S1_SPAN * smooth(T_E1 + 0.025, end1, t);
        const fade1 = 1 - smooth(T_H1 + 0.05, T_S2 - 0.04, t); // gone before stroke 2 starts — never a lingering beam
        if (uHead > uTail + 0.02 && fade1 > 0.03) {
          bandSmear(p, S1, uTail, uHead, 12, (u, r, out) => {
            const v = (u - uTail) / (uHead - uTail);
            const w = 12 * Math.pow(Math.sin(Math.PI * Math.pow(v, 1.22)), 0.62) * (0.5 + 0.5 * fade1);
            if (w < 0.4) return;
            const q = (S1.R - r) / w;
            if (q < 0 || q > 1) return;
            out.c = q < 0.2 && v > 0.7 ? C[6] : q < 0.42 ? C[6] : q < 0.68 ? C[4] : q < 0.88 ? C[2] : C[1];
            out.a = fade1 * Math.min(1, v * 2.5) * (1 - q * 0.32);
          });
          const S1_IN = { ...S1, R: S1.R - 11 };
          bandSmear(p, S1_IN, uTail, uHead, 4.5, (u, r, out) => {
            const v = (u - uTail) / (uHead - uTail);
            const w = 4.5 * Math.sin(Math.PI * v) * fade1;
            if (w < 0.35) return;
            const q = (S1_IN.R - r) / w;
            if (q < 0 || q > 1) return;
            out.c = q < 0.42 ? C[5] : C[3];
            out.a = fade1 * 0.6 * (1 - q * 0.5);
          });
          glowAlongArc(p, S1, S1.R - 3.5, uTail, uHead, 8, C[5], (u) => 0.3 * fade1 * ((u - uTail) / Math.max(0.08, uHead - uTail)));
          for (let u = uTail; u <= uHead; u += 0.05) {
            const [rx, ry] = onSwing(S1, S1.R - 0.5, u);
            const k = fade1 * (0.25 + 0.75 * Math.pow((u - uTail) / Math.max(0.01, uHead - uTail), 1.55));
            p.dot(rx, ry, C[6], clamp(k, 0, 1) * 0.85);
          }
        }
      }

      // ============================================================
      // STROKE 2 — 绕过头顶斜劈: the blade whips up, over the head, crashes down the other side
      // ============================================================
      const end2 = T_S3 + 0.02;
      const f2 = clamp((t - T_S2) / (T_E2 - T_S2));
      if (t >= T_S2 && t < end2) {
        const uHead = S2_SPAN * ease.outQuart(f2);
        const uTail = S2_SPAN * smooth(T_E2 + 0.025, end2, t);
        const fade2 = 1 - smooth(T_S3 - 0.01, end2, t);
        if (uHead > uTail + 0.02 && fade2 > 0.03) {
          bandSmear(p, S2, uTail, uHead, 15, (u, r, out) => {
            const v = (u - uTail) / (uHead - uTail);
            const w = 15 * Math.pow(Math.sin(Math.PI * Math.pow(v, 1.3)), 0.66) * (0.5 + 0.5 * fade2);
            if (w < 0.45) return;
            const q = (S2.R - r) / w;
            if (q < 0 || q > 1) return;
            out.c = isFlashFrame ? WHITE : q < 0.3 || (q < 0.5 && v > 0.76) ? WHITE : q < 0.62 ? C[6] : q < 0.82 ? C[4] : C[2];
            out.a = fade2 * Math.min(1, v * 2.6) * (1 - q * 0.32);
          });
          const S2_IN = { ...S2, R: S2.R - 15 };
          bandSmear(p, S2_IN, uTail, uHead, 5.6, (u, r, out) => {
            const v = (u - uTail) / (uHead - uTail);
            const w = 5.6 * Math.sin(Math.PI * v) * fade2;
            if (w < 0.35) return;
            const q = (S2_IN.R - r) / w;
            if (q < 0 || q > 1) return;
            out.c = q < 0.4 ? C[6] : C[4];
            out.a = fade2 * 0.62 * (1 - q * 0.5);
          });
          glowAlongArc(p, S2, S2.R - 5, uTail, uHead, 9, C[6], (u) => 0.3 * fade2 * ((u - uTail) / Math.max(0.08, uHead - uTail)));
          for (let u = uTail; u <= uHead; u += 0.04) {
            const [rx, ry] = onSwing(S2, S2.R - 0.5, u);
            const k = fade2 * (0.3 + 0.7 * Math.pow((u - uTail) / Math.max(0.01, uHead - uTail), 1.5));
            p.dot(rx, ry, WHITE, clamp(k, 0, 1) * 0.9);
          }
        }
      }

      // ============================================================
      // STROKE 3 — 高贯低斜线: entering from the upper side, one long diagonal high -> low
      // ============================================================
      const f3 = clamp((t - T_S3) / (T_E3 - T_S3));
      const end3 = T_E3 + 0.13;
      if (t >= T_S3 && t < end3 + 0.1) {
        // the long diagonal itself: reveal A (high, rear) -> B (low, through the target)
        const head = ease.outQuart(f3);
        const tail = smooth(T_E3 + 0.02, end3, t);
        const fade3 = 1 - smooth(end3, end3 + 0.1, t);
        const uHead = head, uTail = tail * 0.92;
        if (uHead > uTail + 0.01 && fade3 > 0.03) {
          diagonalBand(p, uTail, uHead, 8.5, C, fade3, isFlashFrame);
          diagonalBand(p, uTail, uHead, 3.2, C, fade3, true);
          // razor glint riding the leading corner
          const gx = lerp(D3_A[0], D3_B[0], uHead), gy = lerp(D3_A[1], D3_B[1], uHead);
          if (f3 < 1) p.glow(gx, gy, 17, C[6], 0.34 * (1 - f3));
        }
      }

      // ============================================================
      // STROKE 4 — 前跨一步直刺: a full step forward, a straight lunge thrust
      // ============================================================
      const t4 = t - T_S4;
      if (t >= T_S4) {
        const pull = smooth(OUT + 0.05, OUT + 0.05 + 0.21, t4);
        // dotted speed lines whipping past beside the bundle
        for (const l of lines) {
          const k = (t - l.t) / 0.24;
          for (let d = 0; d < l.l * (1 - k * 0.6); d++) p.dot(l.x - d, l.y, d < 3 ? WHITE : d < l.l * 0.4 ? C[6] : C[4], (1 - d / l.l) * (1 - k));
        }
        // the streak bundle: fanned at the hand, meeting at the point; the middle one hottest
        for (const s of streaks) {
          const u = clamp((t4 - s.t0) / OUT), head = ease.outExpo(u);
          if (u <= 0 || pull >= 1) continue;
          const end = s.x0 + (TIP - s.x0) * s.len, x1 = s.x0 + (end - s.x0) * head, xa = s.x0 + (end - s.x0) * Math.max(pull, head * 0.35 * (1 - s.len) * 3);
          const y0 = HY + s.off, yAt = (x) => y0 + (TY - y0) * clamp((x - s.x0) / (TIP - s.x0)) * 0.85;
          for (let x = xa; x <= x1; x += 0.5) {
            const v = (x - xa) / Math.max(1, x1 - xa);
            const c = isFlashFrame ? WHITE : v > 0.82 ? WHITE : s.hot ? (v > 0.2 ? C[6] : C[5]) : v > 0.5 ? C[6] : v > 0.22 ? C[4] : C[2];
            p.dot(x, yAt(x), c, v < 0.12 ? v / 0.12 : 1);
            if (s.w > 1 && v > 0.1) p.dot(x, yAt(x) + 1, v > 0.6 ? C[6] : C[3], v < 0.2 ? v / 0.2 : 1);
          }
        }
        if (t4 < OUT + 0.05 + 0.21) p.glowLine(HX + (TIP - HX) * pull, HY, HX + (TIP - HX) * ease.outExpo(clamp(t4 / OUT)), TY, 6, C[5], 0.2 * (1 - pull));
        // the long four-point star at the piercing point
        const q = t4 - OUT;
        if (q >= 0 && q < 0.42) {
          const g = ease.outBack(clamp(q / 0.04), 2.4) * (1 - smooth(0.08, 0.42, q)) * (1 + 0.12 * Math.sin(q * 70));
          longStar(p, TIP, TY, (isFlashFrame ? 27 : 20) * g, 1 - q / 0.42, C, isFlashFrame);
        }
        if (q >= 0 && q < 0.2) {
          const k = q / 0.2, rx = 2 + 7 * ease.outCubic(k), ry = 4 + 12 * ease.outCubic(k);
          for (let a = 0; a < TAU; a += 0.05) p.dot(TIP + 4 + 10 * k + Math.cos(a) * rx, TY + Math.sin(a) * ry, k < 0.3 ? WHITE : C[6], 1.15 - k);
        }
      }

      // rocks land in front (never on the white flash frame)
      if (!isFlashFrame) for (const b of bits.list) rock(p, b, st);
      ps.draw(p, { layer: "front" });

      // ============================================================
      // ON-HIT RESULTS — scars that brand the target, brighter each hit
      // ============================================================
      // Hit 1: a compact horizontal steel-silver cut across the body
      if (t >= T_H1 && t < T_H2 + 0.06) {
        const a1 = 1 - smooth(T_H1 + 0.1, T_H2 + 0.06, t);
        silverScar(p, TX - 2, -24, 0.17, 17, 1.35, C, a1);
      }
      // Hit 2: a crashing diagonal — with hit 1 it brands a shallow X
      if (t >= T_H2 && t < T_H3 + 0.06) {
        const a2 = 1 - smooth(T_H2 + 0.12, T_H3 + 0.06, t);
        silverScar(p, TX, -25, 0.76, 27, 1.9, C, a2);
        if (t < T_H2 + 0.08) {
          const fk = 1 - (t - T_H2) / 0.08;
          flare(p, TX, -28, 24 * fk, fk, [C[4], C[6], WHITE]);
        }
        // vertical light shaft at the strike, like the reference slam
        if (t < T_H2 + 0.16) {
          const vk = 1 - (t - T_H2) / 0.16;
          p.glowLine(TX, 1, TX, -44, 1.6, WHITE, 0.24 * vk);
          p.glow(TX, 0, 26, C[5], 0.3 * vk);
        }
      }
      // Hit 3: the long diagonal rake lingers as a glowing high-to-low brand
      if (t >= T_H3 && t < T_H4 + 0.1) {
        const grow = ease.outQuart(clamp((t - T_H3) / 0.06));
        const a3 = 1 - smooth(T_H3 + 0.08, T_H4 - 0.05, t); // full through the hit freeze, gone before the lunge
        silverScar(p, D3_MID[0], D3_MID[1], D3_ANG, 62 * grow, 2.3 * (1 - 0.5 * clamp((t - T_H3) / 0.6)), C, a3);
        if (t < T_H3 + 0.12) {
          const vk = 1 - (t - T_H3) / 0.12;
          p.glowLine(TX, 1, TX, -42, 1.4, C[6], 0.22 * vk);
        }
        // the floor ring shockwave from the cut's weight
        drawRing(p, RING3, TX - 6, 0, (t - T_H3) / 0.46, 40, 0.16, false, 1, 1);
      }

      // Hit 4 — one blinding local white frame, then the aftermath rips forward
      if (isFlashFrame) {
        silverScar(p, 82, -21, -0.02, 124, 4.8, C, 1.0, true);
        silverScar(p, TX + 2, -22, 0.45, 52, 3.4, C, 1.0, true);
        silverScar(p, TX + 2, -22, -0.48, 52, 3.4, C, 1.0, true);
        flare(p, TX + 2, -22, 40, 1.0, [WHITE, WHITE, WHITE, WHITE]);
        p.glowLine(TX, 1, TX, -52, 2.2, WHITE, 0.4);
        // manga rays from the point of the pierce
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU + 0.13, len = i % 4 === 0 ? 46 : i % 2 === 0 ? 29 : 17;
          for (let d = 8; d <= len; d += 0.75) p.dot(TX + 2 + Math.cos(a) * d, -22 + Math.sin(a) * d, WHITE, 1 - d / (len + 2));
        }
      } else if (t > T_H4 && t < T_H4 + 0.56) {
        const age = t - T_H4, u = age / 0.56;
        const fade4 = 1 - smooth(0.22, 1.0, u);
        // the full-width severing rift peels open through the target
        silverScar(p, 70, -21, -0.02, (24 + 118 * ease.outQuart(Math.min(1, u * 2.2))), 3.2 * (1 - u * 0.8), C, fade4);
        // twin sword-qi shock crescents rip forward past the target
        if (u < 0.74) {
          const uw = u / 0.74;
          const waveCx = TX - 6 + 118 * ease.outQuart(uw);
          const wFade = 1 - smooth(0.3, 1.0, uw);
          const SW1 = swing({ cx: waveCx, cy: -22, R: 30 + 13 * uw, sy: 0.74, rot: 0.05, a0: -0.95, dir: 1, k: 0.1 });
          bandSmear(p, SW1, 0, 1.9, 8.5 * (1 - uw * 0.5), (uu, r, out) => {
            const vv = uu / 1.9, w = 8.5 * (1 - uw * 0.5) * Math.sin(Math.PI * vv);
            if (w < 0.42) return;
            const q = (SW1.R - r) / w;
            if (q < 0 || q > 1) return;
            out.c = q < 0.38 ? WHITE : q < 0.72 ? C[6] : C[4];
            out.a = wFade * (1 - q * 0.38);
          });
          const SW2 = swing({ cx: waveCx + 13 * ease.outCubic(uw), cy: -22, R: 36 + 14 * uw, sy: 0.78, rot: 0.05, a0: -0.82, dir: 1, k: 0.1 });
          bandSmear(p, SW2, 0, 1.62, 3.2 * (1 - uw * 0.6), (uu, r, out) => {
            const vv = uu / 1.62, w = 3.2 * (1 - uw * 0.6) * Math.sin(Math.PI * vv);
            if (w < 0.32) return;
            const q = (SW2.R - r) / w;
            if (q < 0 || q > 1) return;
            out.c = q < 0.5 ? WHITE : C[5];
            out.a = wFade * 0.8;
          });
        }
        // razor wind-slivers sheared through the air behind the target
        for (const ws of windSlivers) {
          if (age < ws.life) {
            const uw = age / ws.life, drag = ease.outQuart(uw);
            silverScar(p, ws.x0 + ws.vx * ws.life * drag, ws.y0 + ws.vy * ws.life * drag, ws.ang, ws.len * (1 - uw * 0.45), 1.3 * (1 - uw * 0.6), C, 1 - uw);
          }
        }
        // ground wind-pressure shear streaks blasting outward along y = -1
        if (u < 0.55) {
          const us = u / 0.55, span = 30 + 105 * ease.outQuart(us);
          silverScar(p, 76, -1, 0, span, 1.6 * (1 - us * 0.5), C, (1 - us) * 0.8);
        }
        // the white pillar and floor pool at the strike point
        if (u < 0.3) {
          const vk = 1 - u / 0.3;
          p.glowLine(TX, 1, TX, -52, 2.4, WHITE, 0.3 * vk);
          p.glow(TX, 0, 34, C[5], 0.32 * vk);
        }
        // the near half of the finishing shockwave rolls over his feet
        drawRing(p, RING4, TX - 4, 0, age / 0.66, 110, 0.16, true, 1);
      }

      // delayed cross-gashes snap open on the knocked-back target
      for (const g of gashes) {
        if (g.fired) {
          const ageG = t - (T_H4 + g.dt);
          if (ageG >= 0 && ageG < 0.32) {
            const ug = ageG / 0.32;
            silverScar(p, TX + g.dx, g.dy, g.a, g.len * ease.outCubic(Math.min(1, ug * 3)), 2.4 * (1 - ug * 0.75), C, 1 - ug, ageG < 0.04);
            if (ageG < 0.14) sparkle(p, TX + g.dx, g.dy, 9 * (1 - ageG / 0.14), WHITE, C[5], 0.9);
          }
        }
      }

      // tip glints as each stroke's edge comes around
      const glint = (t0, dur, x, y, size) => {
        const g = t - t0;
        if (g > 0 && g < dur) sparkle(p, x, y, size * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / dur), C[6], C[4], 0.6);
      };
      const [e1x, e1y] = onSwing(S1, S1.R - 3, S1_SPAN);
      glint(T_H1 - 0.02, 0.22, e1x, e1y, 8);
      const [e2x, e2y] = onSwing(S2, S2.R - 5, S2_SPAN);
      glint(T_H2 - 0.02, 0.24, e2x, e2y, 10);
      glint(T_H3 - 0.02, 0.24, D3_B[0] - 14, D3_B[1] - 10, 11);
      if (t >= T_HOLD4 && t < T_HOLD4 + 0.2) sparkle(p, TIP, TY, 10 * ease.outBack(Math.min(1, (t - T_HOLD4) / 0.05)) * (1 - (t - T_HOLD4) / 0.2), WHITE, C[5], 0.9);

      lights.draw(p);
    },
  };
}

// a long four-point star: the forward and back arms long, up and down shorter, thick at the heart
function longStar(p, x, y, L, k, C, pureWhite = false) {
  if (L < 1) return;
  const arms = [[1, 0, L], [-1, 0, L * 0.7], [0, -1, L * 0.42], [0, 1, L * 0.42]];
  for (const [dx, dy, len] of arms)
    for (let d = 1; d <= len; d += 0.5) {
      const u = d / len;
      const c = pureWhite || u < 0.3 ? WHITE : u < 0.65 ? C[6] : C[5];
      p.dot(x + dx * d, y + dy * d, c, u < 0.7 ? 1 : 1 - (u - 0.7) / 0.35);
      if (u < 0.25 && len > 6) (p.dot(x + dx * d - dy, y + dy * d + dx, C[6]), p.dot(x + dx * d + dy, y + dy * d - dx, C[6]));
    }
  for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) for (let d = 1; d <= Math.min(3, L * 0.14); d++) p.px(x + dx * d, y + dy * d, d < 2 ? C[6] : C[5]);
  p.px(x, y, WHITE);
  p.glow(x, y, 6 + L * 1.3, C[5], 0.35 * k);
  p.glow(x, y, 3 + L * 0.4, WHITE, 0.3 * k);
}

