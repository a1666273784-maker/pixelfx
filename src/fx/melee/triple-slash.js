// Tilted-plane crescent slash geometry, spin-ring cone perspective, stone cracks and impact sparks build on
// Sprite Fusion's open-source slash, impact and explosion VFX (https://www.spritefusion.com/pixel-art-vfx),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, PF, B, Rng, fit, flare, sparkle, clamp, smooth, seg, lerp, ease, TAU, WHITE, READY } from "../../core/index.js";
import { swing, onSwing, plane, stone, rock, cracks } from "./_lib.js";

const TX = 92;
const T_S1 = 0.04, T_H1 = 0.11, T_E1 = 0.16;     // Stage 1: Overhead -> Downward diagonal slash
const T_S2 = 0.22, T_H2 = 0.29, T_E2 = 0.35;     // Stage 2: Backhand low -> High rising upward slash
const T_S3 = 0.45, T_H3 = 0.56, T_E3 = 0.65;     // Stage 3: Advancing 360° horizontal whirlwind sweep
const T_END = 1.54;
const FRAME = 1 / 30;

export const meta = {
  name: "Triple slash",
  desc: "An unbroken three-hit silver sword combo: a down-cut flows into a brighter rising backhand slash and a colossal 360-degree spin cleave that flashes white on impact.",
  tags: ["melee", "sword", "slash", "combo", "spin", "silver", "white", "combat", "directional", "one-shot"],
  size: [376, 204],
  origin: [118, 150],
  duration: T_END,
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

// Advancing 3-step swordsmanship choreography — every hand coordinate verified strictly inside IK reach
const STANCE = { ...READY, weapon: "sword", fx: 12, fy: -21, sa: -0.85 };
const WIND1 = { ...STANCE, x: -6, crouch: 4, lean: -3, fx: -3, fy: -34, sa: -2.42, bx: 7, by: -24, ffx: 8, fbx: -8 };
const CUT1 = { ...STANCE, x: 10, crouch: 6, lean: 5, fx: 16, fy: -15, sa: 0.78, bx: -8, by: -22, ffx: 12, fbx: -9, toeB: true, ghost: 1 };
const COIL2 = { ...STANCE, x: 16, crouch: 7, lean: 4, fx: 11, fy: -13, sa: 1.38, bx: -6, by: -20, ffx: 10, fbx: -8, ghost: 1 };
const CUT2 = { ...STANCE, x: 26, crouch: 2, lean: -2, fx: 11, fy: -33, sa: -1.44, bx: -8, by: -23, ffx: 12, fbx: -9, ghost: 1 };
const SPIN_A = { ...STANCE, x: 34, crouch: 5, yaw: -1.65, fx: 12, fy: -24, sa: -0.22, bx: -6, by: -22, ghost: 1 };
const SPIN_B = { ...STANCE, x: 40, crouch: 6, yaw: -3.20, fx: 15, fy: -21, sa: 0.05, bx: -9, by: -22, ghost: 1 };
const SPIN_HIT = { ...STANCE, x: 44, crouch: 6, lean: 5, yaw: -4.85, fx: 17, fy: -20, sa: 0.08, bx: -10, by: -22, ffx: 12, fbx: -10, ghost: 1 };
const SPIN_END = { ...STANCE, x: 44, crouch: 5, lean: 4, fx: 16, fy: -20, sa: 0.12, bx: -9, by: -22, ffx: 11, fbx: -9 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.32, { ...STANCE, x: -6 }],
    [-0.10, WIND1],
    [T_S1, { ...WIND1, x: 0, fy: -35 }],
    [T_H1, CUT1, "snap"],
    [T_S2, COIL2, "snap"],
    [T_H2, CUT2, "snap"],
    [0.39, SPIN_A, "snap"],
    [0.47, SPIN_B, "snap"],
    [T_H3, SPIN_HIT, "snap"],
    [T_E3, SPIN_END, "snap"],
    [0.98, { ...SPIN_END, crouch: 4 }],
    [1.30, { ...STANCE, x: 14 }],
    [T_END, { ...STANCE, x: -6 }],
  ],
  hits: [
    { t: T_H1, stop: 0.04, shake: 0.10, amp: 1.5, push: 1.5, straw: 5, y: -26, flash: 0.03 },
    { t: T_H2, stop: 0.05, shake: 0.16, amp: 2.3, push: 2.4, straw: 8, y: -30, flash: 0.04 },
    { t: T_H3, stop: 0.17, shake: 0.46, amp: 5.0, push: 5.0, straw: 16, shiver: 0.34, y: -22, flash: 0.036 },
  ],
  dust: [
    { t: T_H1, x: 14, n: 4, dir: 1 },
    { t: T_H2, x: 26, n: 6, dir: 1 },
    { t: T_S3, x: 38, n: 8, dir: 1 },
    { t: T_H3, x: 52, n: 12, dir: 1 },
  ],
};

// Zero-checkerboard smooth polar crescent shader (`p.px` / `p.blend`)
function smoothSmear(p, s, u0, u1, wMax, fn, half = 0, pad = 1.2) {
  if (u1 - u0 < 0.008) return;
  const c = Math.cos(s.rot), n = Math.sin(s.rot), A = s.R + pad + 1, Bn = A * s.sy + s.k * (wMax + 2);
  const hx = Math.ceil(Math.hypot(A * c, Bn * n) + 2), hy = Math.ceil(Math.hypot(A * n, Bn * c) + 2);
  const rIn = s.R - wMax - 1.5;
  const over = Math.ceil(Math.abs(n) * A + s.k * (wMax + 2) + 2);
  const y0 = Math.max(-146, Math.floor(half > 0 ? s.cy - over : s.cy - hy));
  const y1 = Math.min(2, Math.ceil(half < 0 ? s.cy + over : s.cy + hy));
  const x0 = Math.max(-114, Math.floor(s.cx - hx));
  const x1 = Math.min(252, Math.ceil(s.cx + hx));
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

// Smooth even additive light ribbon along a swing (clamped safely inside canvas bounds -> 0 edge spill!)
function smoothGlowArc(p, s, r, u0, u1, rad, col, alphaFn, half = 0) {
  const step = 0.14;
  for (let u = u0; u <= u1; u += step) {
    const g = s.a0 + s.dir * u;
    if (half && (Math.sin(g) < 0 ? -1 : 1) !== half) continue;
    const [gx, gy] = onSwing(s, r, u);
    if (gy > 2 || gx < -114 + rad || gx > 254 - rad || gy < -146 + rad) continue;
    const a = typeof alphaFn === "function" ? alphaFn(u) : alphaFn;
    if (a > 0.008) p.glow(gx, gy, rad, col, a);
  }
}

// Pinhole-free distance-field Bezier ribbon shader (iterates integer `(x, y)` -> ZERO Moiré gaps!)
function drawSeamlessBridge(p, A, B, ctrl1, ctrl2, uTail, uHead, wA, wB, cols, fade, isFlash, backMode) {
  if (uHead <= uTail + 0.015 || fade <= 0.03) return;
  const N = 36;
  const sx = new Float32Array(N + 1);
  const sy = new Float32Array(N + 1);
  const ss = new Float32Array(N + 1);
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;

  for (let i = 0; i <= N; i++) {
    const s = lerp(uTail, uHead, i / N);
    const m = 1 - s;
    const x = m * m * m * A[0] + 3 * m * m * s * ctrl1[0] + 3 * m * s * s * ctrl2[0] + s * s * s * B[0];
    const y = Math.min(-1.5, m * m * m * A[1] + 3 * m * m * s * ctrl1[1] + 3 * m * s * s * ctrl2[1] + s * s * s * B[1]);
    sx[i] = x;
    sy[i] = y;
    ss[i] = s;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const pad = Math.max(wA, wB) + 2;
  const x0 = Math.max(-114, Math.floor(minX - pad));
  const x1 = Math.min(252, Math.ceil(maxX + pad));
  const y0 = Math.max(-146, Math.floor(minY - pad));
  const y1 = Math.min(2, Math.ceil(maxY + pad));

  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      let bestD2 = 1e9, bestS = 0, bestV = 0;
      for (let i = 0; i < N; i++) {
        const ax = sx[i], ay = sy[i], dx = sx[i + 1] - ax, dy = sy[i + 1] - ay;
        const len2 = dx * dx + dy * dy + 1e-6;
        const f = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
        const qx = ax + dx * f - px, qy = ay + dy * f - py;
        const d2 = qx * qx + qy * qy;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestS = lerp(ss[i], ss[i + 1], f);
          bestV = (i + f) / N;
        }
      }
      if (backMode !== null && (bestS > 0.34) !== backMode) continue;
      const hw = lerp(wA, wB, bestS) * (0.45 + 0.55 * Math.sin(Math.PI * Math.pow(bestV, 0.82))) * (0.5 + 0.5 * fade);
      if (hw < 0.45 || bestD2 > (hw + 0.75) * (hw + 0.75)) continue;
      const d = Math.sqrt(bestD2);
      const q = d / hw;
      if (q > 1.1) continue;
      const col = isFlash ? WHITE : q < 0.36 ? cols[3] : q < 0.66 ? cols[2] : q < 0.88 ? cols[1] : cols[0];
      const al = fade * (q > 0.85 ? (1.1 - q) / 0.25 : 1) * (0.38 + 0.62 * Math.min(1, bestV * 3.0));
      if (al > 0.93) p.px(x, y, col);
      else if (al > 0.03) p.blend(x, y, col, al);
    }
  }
}

// Tapered razor-sharp silver slash scar / spatial rift for hit results
function drawSilverSlashScar(p, cx, cy, ang, halfLen, halfW, C, alpha, pureWhite = false) {
  if (alpha <= 0.03 || halfLen < 1) return;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const minX = Math.max(-114, Math.floor(cx - Math.abs(ca) * halfLen - halfW - 2));
  const maxX = Math.min(252, Math.ceil(cx + Math.abs(ca) * halfLen + halfW + 2));
  const minY = Math.max(-146, Math.floor(cy - Math.abs(sa) * halfLen - halfW - 2));
  const maxY = Math.min(2, Math.ceil(cy + Math.abs(sa) * halfLen + halfW + 2));

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

export function create(o) {
  const C = fit(o.palette, 8), st = stone(o.stone);
  const R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[6], C[5], C[4]], haze: C[3] });
  const bits = new Bits({ ground: floor }), lights = new Lights();

  // =========================================================================
  // THREE PROGRESSIVELY LONGER & BRIGHTER SILVER SLASHES ("一段比一段长、一段比一段亮"):
  //   Stage 1 (斜劈): R = 36px, W = 8.5px   — Compact cold steel-silver
  //   Stage 2 (反手撩): R = 62px, W = 17.5px  — 1.72x larger luminous moon-silver
  //   Stage 3 (横扫一圈): R = 104px, W = 34.0px — 2.89x colossal blinding platinum-white 360° ring!
  // =========================================================================
  const S1 = swing({ cx: 48, cy: -26, R: 36, sy: 0.90, rot: 0.34, a0: -2.28, dir: 1 });
  const SPAN1 = 2.40;

  const S2 = swing({ cx: 36, cy: -34, R: 62, sy: 0.92, rot: -0.24, a0: 1.42, dir: -1 });
  const SPAN2 = 2.66;

  const S3 = swing({ cx: 46, cy: -20, R: 104, sy: 0.27, rot: -0.04, a0: -2.52, dir: 1, k: 0.13 });
  const S3_INNER = { ...S3, R: 70, k: 0.09 };
  const S3_CORE = { ...S3, R: 44, k: 0.06 };
  const SPAN3 = TAU * 1.15;

  // Exact C^1 tangent-matched endpoints welding Stage 1 -> Bridge 1 -> Stage 2 -> Bridge 2 -> Stage 3!
  const p1End = onSwing(S1, S1.R - 1.5, SPAN1);
  const p1Prev = onSwing(S1, S1.R - 1.5, SPAN1 - 0.16);
  const tan1 = [p1End[0] - p1Prev[0], p1End[1] - p1Prev[1]];

  const p2Start = onSwing(S2, S2.R - 2.0, 0);
  const p2Next = onSwing(S2, S2.R - 2.0, 0.16);
  const tan2In = [p2Next[0] - p2Start[0], p2Next[1] - p2Start[1]];

  const p2End = onSwing(S2, S2.R - 2.5, SPAN2);
  const p2Prev = onSwing(S2, S2.R - 2.5, SPAN2 - 0.16);
  const tan2Out = [p2End[0] - p2Prev[0], p2End[1] - p2Prev[1]];

  const p3Start = onSwing(S3, S3.R - 4.0, 0);
  const p3Next = onSwing(S3, S3.R - 4.0, 0.18);
  const tan3In = [p3Next[0] - p3Start[0], p3Next[1] - p3Start[1]];

  // Floor cracks scoured around the colossal 3rd spin cleave!
  const spinCracks = cracks(R, 80, 12, 74, 13, 0.46);
  // Secondary sword-qi cross-gashes erupting on the struck target after Hit 3!
  const afterGashes = [
    { dt: 0.07, dx: 5, dy: -28, a: -0.54, len: 31 },
    { dt: 0.14, dx: 8, dy: -19, a: 0.48, len: 35 },
    { dt: 0.21, dx: 7, dy: -24, a: -0.05, len: 44 },
  ].map((g) => ({ ...g, fired: false }));

  // Flying silver wind-sliver blades (`飞散银白剑气刃`) sheared off Hit 3!
  const windSlivers = Array.from({ length: 5 }, (_, i) => ({
    x0: TX + 6 + (i % 2) * 8,
    y0: -14 - i * 7,
    vx: 165 + i * 28,
    vy: (i - 2) * 24,
    ang: (i - 2) * 0.16,
    len: 12 + (i % 3) * 4,
    life: 0.34 + (i % 2) * 0.08,
  }));

  let t = 0, h1 = false, h2 = false, h3 = false;

  // Renders far (`half = -1`) or near (`half = 1`) half of Colossal Spin 3!
  function renderSpin3(p, half, isFlashFrame) {
    const fadeEnd = T_E3 + 0.40;
    if (t < T_S3 || t >= fadeEnd) return;
    const rawU = clamp((t - T_S3) / (T_E3 - T_S3), 0, 1);
    const uHead = SPAN3 * (1 - Math.pow(1 - rawU, 1.8));
    const uTail = SPAN3 * smooth(T_E3 - 0.03, fadeEnd, t);
    const fadeAfter = t <= T_E3 ? 1 : 1 - smooth(T_E3 + 0.06, fadeEnd, t);
    if (uHead <= uTail + 0.02 || fadeAfter <= 0.02) return;

    const uStart = Math.max(uTail, uHead - TAU + 0.01);

    // 1) Tight inner wind-vortex ring (`R = 44px`) around the spinning swordsman
    smoothSmear(p, S3_CORE, uStart, uHead, 6, (u, r, out) => {
      const v = (u - uStart) / Math.max(0.08, uHead - uStart);
      const w = 6 * Math.pow(v, 0.8) * fadeAfter;
      if (w < 0.4) return;
      const q = (S3_CORE.R - r) / w;
      if (q < 0 || q > 1) return;
      out.c = isFlashFrame ? WHITE : q < 0.4 ? C[6] : C[4];
      out.a = fadeAfter * 0.65 * v * (1 - q * 0.6);
    }, half);

    // 2) Mid silver harmonic blade (`R = 70px`)
    smoothSmear(p, S3_INNER, uStart, uHead, 12, (u, r, out) => {
      const v = (u - uStart) / Math.max(0.08, uHead - uStart);
      const w = 12 * Math.pow(v, 0.7) * fadeAfter;
      if (w < 0.5) return;
      const q = (S3_INNER.R - r) / w;
      if (q < 0 || q > 1) return;
      out.c = isFlashFrame ? WHITE : q < 0.36 ? WHITE : q < 0.72 ? C[5] : C[3];
      out.a = fadeAfter * Math.min(1, v * 2.2) * (1 - q * 0.52) * (half < 0 ? 0.78 : 0.94);
    }, half);

    // 3) Main Colossal 104px Sovereign Platinum-White Blade Ring (`W = 34px`)!
    const swell = t > T_E3 ? 5 * ease.outCubic(seg(t, T_E3, fadeEnd)) : 0;
    const S3_CUR = swell > 0 ? { ...S3, R: S3.R + swell } : S3;
    smoothSmear(p, S3_CUR, uStart, uHead, 34, (u, r, out) => {
      const v = (u - uStart) / Math.max(0.08, uHead - uStart);
      const w = 34 * (0.26 + 0.74 * Math.sin(Math.PI * Math.pow(v, 1.22))) * (0.45 + 0.55 * fadeAfter);
      if (w < 0.6) return;
      const q = (S3_CUR.R - r) / w;
      if (q < 0 || q > 1) return;

      const streak = Math.sin(r * 0.85 - u * 5);
      if (isFlashFrame) {
        out.c = WHITE;
      } else if (half < 0) {
        out.c = q < 0.40 ? WHITE : q < 0.68 ? C[6] : q < 0.86 ? C[4] : C[2];
      } else {
        out.c = q < 0.54 || (q < 0.74 && streak > 0.30) || v > 0.88
          ? WHITE
          : q < 0.78
          ? C[6]
          : q < 0.92
          ? C[5]
          : C[3];
      }
      out.a = fadeAfter * Math.min(1, v * 2.7 + 0.15) * (q > 0.82 ? (1 - q) / 0.18 : 1);
    }, half);

    // 4) Outer supersonic razor shock-lip (`R + 10px`) peeling off the spinning edge!
    if (t >= T_H3 - 0.03 && t < T_E3 + 0.24) {
      const uShock = seg(t, T_H3 - 0.03, T_E3 + 0.24);
      const S3_OUT = { ...S3, R: S3.R + 3 + 11 * ease.outQuart(uShock) };
      smoothSmear(p, S3_OUT, uStart, uHead, 2.5, (u, r, out) => {
        const q = (S3_OUT.R - r) / 2.5;
        if (q < 0 || q > 1) return;
        out.c = isFlashFrame || uShock < 0.30 ? WHITE : C[6];
        out.a = (1 - uShock) * 0.90;
      }, half);
    }

    // 5) Smooth continuous platinum-white glow hugging the colossal ring!
    smoothGlowArc(
      p,
      S3_CUR,
      S3_CUR.R - 7,
      uStart,
      uHead,
      half < 0 ? 10 : 12,
      WHITE,
      (u) => (half < 0 ? 0.18 : 0.34) * fadeAfter * ((u - uStart) / Math.max(0.1, uHead - uStart)),
      half
    );
  }

  return {
    update(dt) {
      t += dt;

      // Ground sparks kicked up when Bridge 1->2 skims the stone floor!
      if (t >= T_E1 && t < T_S2 && R.chance(1.5 * dt * 60)) {
        ps.spawn(P.SPARK, R.range(42, 68), -2, R.range(-55, -15), -R.range(25, 85), R.range(0.12, 0.24));
      }
      // Rising silver shavings off Stage 2
      if (t >= T_S2 && t <= T_E2 && R.chance(1.8 * dt * 60)) {
        const u = SPAN2 * clamp((t - T_S2) / (T_E2 - T_S2));
        const [sx, sy] = onSwing(S2, S2.R, u);
        ps.spawn(P.MOTE, sx, sy, R.range(20, 85), -R.range(35, 110), R.range(0.20, 0.38), R.chance(0.5) ? WHITE : C[6], 1);
      }
      // Whirlwind silver shavings & wind motes peeled all around Spin 3!
      if (t >= T_S3 && t <= T_E3 && R.chance(2.6 * dt * 60)) {
        const u = SPAN3 * (1 - Math.pow(1 - clamp((t - T_S3) / (T_E3 - T_S3)), 1.8));
        const [sx, sy] = onSwing(S3, S3.R, u);
        const dirSide = sx > 46 ? 1 : -1;
        ps.spawn(P.MOTE, clamp(sx, -98, 228), Math.min(-2, sy), dirSide * R.range(45, 130), -R.range(10, 48), R.range(0.24, 0.48), WHITE, R.chance(0.4) ? 2 : 1);
      }

      // HIT 1: Steel-silver downward cleave sparks
      if (!h1 && t >= T_H1) {
        h1 = true;
        lights.add(TX - 4, -26, 32, C[5], 0.34, 0.15);
        for (let i = 0; i < 14; i++) {
          const a = R.range(0.15, 1.35), sp = R.range(95, 215);
          ps.spawn(P.SPARK, TX - 3, -25, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.14, 0.26));
        }
      }

      // HIT 2: Brighter upward moon-silver fountain sparks & star glints
      if (!h2 && t >= T_H2) {
        h2 = true;
        lights.add(TX - 2, -30, 52, C[6], 0.62, 0.22);
        for (let i = 0; i < 28; i++) {
          const a = R.range(-1.55, -0.25), sp = R.range(125, 290);
          ps.spawn(P.SPARK, TX - 2, -28, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.18, 0.36));
        }
        for (let i = 0; i < 5; i++) {
          ps.spawn(P.STAR, TX + R.range(-10, 14), -28 + R.range(-16, 10), R.range(10, 45), -R.range(18, 55), R.range(0.22, 0.38), WHITE, R.range(1.1, 1.8));
        }
      }

      // HIT 3: COLOSSAL OPPRESSIVE FINISHER DETONATION!
      if (!h3 && t >= T_H3) {
        h3 = true;
        lights.add(TX + 4, -24, 72, WHITE, 1.0, 0.44);
        lights.add(46, -24, 68, C[6], 0.72, 0.34);
        lights.add(TX + 58, -24, 58, WHITE, 0.78, 0.30);

        for (let i = 0; i < 72; i++) {
          const forward = i % 5 !== 0;
          const a = forward ? R.range(-0.55, 0.42) : R.range(2.65, 3.55);
          const sp = forward ? R.range(160, 405) : R.range(105, 240);
          ps.spawn(P.SPARK, TX + R.range(-6, 10), -22 + R.range(-9, 9), Math.cos(a) * sp, Math.sin(a) * sp - 16, R.range(0.24, 0.58), WHITE, 1, 0, i % 3 === 0 ? PF.BOUNCE : 0);
        }
        for (let i = 0; i < 14; i++) {
          ps.spawn(P.STAR, TX + R.range(-16, 56), -22 + R.range(-24, 14), R.range(22, 92), R.range(-30, 18), R.range(0.26, 0.56), i % 2 === 0 ? WHITE : C[6], R.range(1.3, 2.4));
        }
        // Illuminated shockwave dust clouds scoured outward across the stone floor!
        for (let i = 0; i < 22; i++) {
          const sd = i % 2 ? 1 : -1;
          const bx = sd > 0 ? TX + R.range(-4, 18) : 14 + R.range(-12, 10);
          const col = i % 3 === 0 ? C[4] : st.dust;
          ps.spawn(P.SMOKE, bx, -2, sd * R.range(65, 160), -R.range(5, 20), R.range(0.56, 0.88), col, R.range(4.8, 8.4), 0, PF.BIG);
        }
        // Stone chunks & silver-lit grit torn out of the floor by the 360° blade-wind!
        for (let i = 0; i < 36; i++) {
          const a = -Math.PI / 2 + R.range(-0.9, 1.05), sp = R.range(65, 215);
          ps.spawn(P.GRIT, 78 + R.range(-28, 28), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.52, 0.88), R.pick([C[6], st.light, st.body]), R.chance(0.35) ? 2 : 1);
        }
        for (let i = 0; i < 7; i++) {
          bits.add({ kind: B.CHUNK, x: 78 + R.range(-24, 26), y: -2, vx: R.range(-50, 135), vy: -R.range(95, 215), g: 1.12, drag: 0.40, bounce: 0.30, life: R.range(0.62, 0.88), a: R.range(0, TAU), va: R.range(-15, 15), s: R.int(1, 2) });
        }
      }

      // Secondary delayed sword-qi cross-bursts on the struck target ("命中结果特效")!
      if (t >= T_H3) {
        for (const ag of afterGashes) {
          if (!ag.fired && t >= T_H3 + ag.dt) {
            ag.fired = true;
            lights.add(TX + ag.dx, ag.dy, 36, WHITE, 0.74, 0.15);
            for (let k = 0; k < 13; k++) {
              const dir = ag.a + (k % 2 ? 0 : Math.PI) + R.range(-0.22, 0.22);
              const sp = R.range(95, 225);
              ps.spawn(P.SPARK, TX + ag.dx, ag.dy, Math.cos(dir) * sp, Math.sin(dir) * sp, R.range(0.14, 0.28));
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
      const isFlashFrame = t >= T_H3 && t < T_H3 + FRAME * 1.08;

      // Floor cracks & silver blade-wind gouge left by Hit 3!
      if (t >= T_H3) {
        const age3 = t - T_H3;
        const fadeCr = 1 - smooth(0.84, T_END - 0.08, t);
        if (fadeCr > 0.03) {
          const grow = clamp(age3 / 0.13, 0, 1);
          for (const cr of spinCracks) {
            const n = Math.floor(cr.pts.length * grow);
            for (let i = 1; i < n; i++) {
              const u = i / cr.pts.length;
              const hot = (1 - smooth(0.0, 0.46, age3)) * (1 - u * 0.5);
              const col = isFlashFrame || hot > 0.55 ? WHITE : hot > 0.25 ? C[5] : st.dark;
              p.line(cr.pts[i - 1][0], cr.pts[i - 1][1], cr.pts[i][0], cr.pts[i][1], col, fadeCr);
            }
          }
        }
      }

      // Bridge 2 -> 3 far half (collinear C^1 tangent -> liquid-smooth entry into Spin 3!)
      const b2Start = T_E2 - 0.03, b2End = T_S3 + 0.02, b2Linger = 0.11;
      if (t >= b2Start && t < b2End + b2Linger) {
        const uH = ease.inOutSine(clamp((t - b2Start) / (b2End - b2Start), 0, 1));
        const uT = t <= b2End ? 0 : smooth(b2End, b2End + b2Linger, t);
        const fd = t <= b2End ? 1 : 1 - smooth(b2End, b2End + b2Linger, t);
        drawSeamlessBridge(
          p,
          p2End,
          p3Start,
          [p2End[0] + tan2Out[0] * 1.6, p2End[1] + tan2Out[1] * 1.3],
          [p3Start[0] - tan3In[0] * 2.1, p3Start[1] - tan3In[1] * 2.1],
          uT,
          uH,
          4.4,
          6.0,
          [C[2], C[4], C[6], WHITE],
          fd,
          isFlashFrame,
          true
        );
      }

      // Spin 3 far half behind character
      renderSpin3(p, -1, isFlashFrame);

      ps.draw(p, { layer: "back" });
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;
      // Exact 1-frame local pure-white overexposure at T_H3 ("最后一下命中时闪一帧白" — dark background preserved!)
      const isFlashFrame = t >= T_H3 && t < T_H3 + FRAME * 1.08;

      // =======================================================================
      // STAGE 1: OVERHEAD -> DOWNWARD DIAGONAL SLASH (`R = 36px`, Cold Steel-Silver)
      // =======================================================================
      const end1 = T_S2 + 0.12;
      if (t >= T_S1 && t < end1) {
        const uHead = SPAN1 * ease.outQuart(clamp((t - T_S1) / (T_E1 - T_S1)));
        const uTail = SPAN1 * smooth(T_E1 + 0.03, end1, t);
        const fade1 = 1 - smooth(T_S2, end1, t);
        if (uHead > uTail + 0.02 && fade1 > 0.03) {
          smoothSmear(p, S1, uTail, uHead, 8.5, (u, r, out) => {
            const v = (u - uTail) / (uHead - uTail);
            const w = 8.5 * Math.sin(Math.PI * Math.pow(v, 1.45)) * (0.5 + 0.5 * fade1);
            if (w < 0.45) return;
            const q = (S1.R - r) / w;
            if (q < 0 || q > 1) return;
            out.c = q < 0.16 && v > 0.76 ? C[6] : q < 0.45 ? C[5] : q < 0.76 ? C[3] : C[1];
            out.a = fade1 * Math.min(1, v * 2.4) * (1 - q * 0.35);
          });
          smoothGlowArc(p, S1, S1.R - 3, uTail, uHead, 7, C[4], 0.14 * fade1);
        }
      }

      // UNBROKEN BRIDGE 1 -> 2: Pinhole-free low wrist-flip silver ribbon skimming the floor!
      const b1Start = T_E1 - 0.03, b1End = T_S2 + 0.02, b1Linger = 0.12;
      if (t >= b1Start && t < b1End + b1Linger) {
        const uH = ease.inOutSine(clamp((t - b1Start) / (b1End - b1Start), 0, 1));
        const uT = t <= b1End ? 0 : smooth(b1End, b1End + b1Linger, t);
        const fd = t <= b1End ? 1 : 1 - smooth(b1End, b1End + b1Linger, t);
        drawSeamlessBridge(
          p,
          p1End,
          p2Start,
          [p1End[0] + tan1[0] * 1.4, Math.min(-2, p1End[1] + tan1[1] * 1.2)],
          [p2Start[0] - tan2In[0] * 1.4, Math.min(-2, p2Start[1] - tan2In[1] * 1.2)],
          uT,
          uH,
          3.4,
          4.8,
          [C[1], C[3], C[5], C[6]],
          fd,
          false,
          null
        );
      }

      // =======================================================================
      // STAGE 2: BACKHAND LOW -> HIGH RISING SLASH (`R = 62px`, Luminous Moon-Silver!)
      // =======================================================================
      const end2 = T_S3 + 0.10;
      if (t >= T_S2 && t < end2) {
        const uHead = SPAN2 * ease.outQuart(clamp((t - T_S2) / (T_E2 - T_S2)));
        const uTail = SPAN2 * smooth(T_E2 + 0.03, end2, t);
        const fade2 = 1 - smooth(T_S3 - 0.01, end2, t);
        if (uHead > uTail + 0.02 && fade2 > 0.03) {
          const S2_IN = { ...S2, R: S2.R - 15 };
          smoothSmear(p, S2_IN, uTail, uHead, 5.2, (u, r, out) => {
            const v = (u - uTail) / (uHead - uTail);
            const w = 5.2 * Math.sin(Math.PI * v) * fade2;
            if (w < 0.4) return;
            const q = (S2_IN.R - r) / w;
            if (q < 0 || q > 1) return;
            out.c = q < 0.42 ? C[5] : C[3];
            out.a = fade2 * 0.68 * (1 - q * 0.5);
          });

          smoothSmear(p, S2, uTail, uHead, 17.5, (u, r, out) => {
            const v = (u - uTail) / (uHead - uTail);
            const w = 17.5 * Math.sin(Math.PI * Math.pow(v, 1.36)) * (0.5 + 0.5 * fade2);
            if (w < 0.5) return;
            const q = (S2.R - r) / w;
            if (q < 0 || q > 1) return;
            out.c = isFlashFrame ? WHITE : q < 0.28 || (q < 0.46 && v > 0.80) ? WHITE : q < 0.62 ? C[6] : q < 0.84 ? C[4] : C[2];
            out.a = fade2 * Math.min(1, v * 2.5) * (1 - q * 0.3);
          });
          smoothGlowArc(p, S2, S2.R - 5, uTail, uHead, 10, C[6], 0.30 * fade2);
        }
      }

      // UNBROKEN BRIDGE 2 -> 3 (near portion wrapping over shoulder into Spin 3!)
      const b2Start = T_E2 - 0.03, b2End = T_S3 + 0.02, b2Linger = 0.11;
      if (t >= b2Start && t < b2End + b2Linger) {
        const uH = ease.inOutSine(clamp((t - b2Start) / (b2End - b2Start), 0, 1));
        const uT = t <= b2End ? 0 : smooth(b2End, b2End + b2Linger, t);
        const fd = t <= b2End ? 1 : 1 - smooth(b2End, b2End + b2Linger, t);
        drawSeamlessBridge(
          p,
          p2End,
          p3Start,
          [p2End[0] + tan2Out[0] * 1.6, p2End[1] + tan2Out[1] * 1.3],
          [p3Start[0] - tan3In[0] * 2.1, p3Start[1] - tan3In[1] * 2.1],
          uT,
          uH,
          4.4,
          6.0,
          [C[2], C[4], C[6], WHITE],
          fd,
          isFlashFrame,
          false
        );
      }

      // =======================================================================
      // STAGE 3: COLOSSAL 360° HORIZONTAL SPIN CLEAVE (`R = 104px`, Blinding Platinum-White!)
      // =======================================================================
      renderSpin3(p, 1, isFlashFrame);

      // Draw rocks & particles BEFORE the 1-frame white overexposure flare so zero dark silhouettes pollute the flash!
      if (!isFlashFrame) {
        for (const b of bits.list) rock(p, b, st);
      }
      ps.draw(p, { layer: "front" });

      // =======================================================================
      // ESCALATING ON-HIT & OPPRESSIVE AFTERMATH VFX ("要有命中结果特效 + 闪一帧白 + 压迫感")
      // =======================================================================
      // Hit 1 scar: Compact diagonal steel-silver cut across target
      if (t >= T_H1 && t < T_H2 + 0.06) {
        const a1 = 1 - smooth(T_H1 + 0.12, T_H2 + 0.06, t);
        drawSilverSlashScar(p, TX - 2, -25, 0.72, 19, 1.5, C, a1);
      }
      // Hit 2 scar: Larger, brighter rising moon-silver cut forming a glowing X-brand on target!
      if (t >= T_H2 && t < T_H3 + 0.05) {
        const a2 = 1 - smooth(T_H2 + 0.15, T_H3 + 0.05, t);
        drawSilverSlashScar(p, TX, -27, -0.68, 31, 2.3, C, a2);
        if (t < T_H2 + 0.08) {
          const fk = 1 - (t - T_H2) / 0.08;
          flare(p, TX, -28, 26 * fk, fk, [C[4], C[6], WHITE]);
        }
      }

      // Hit 3: 1-FRAME BLINDING LOCAL WHITE FLASH + TWIN SWORD-WAVES, WIND-SLIVERS & SPATIAL RIFT!
      if (isFlashFrame) {
        drawSilverSlashScar(p, 68, -21, -0.02, 158, 6.6, C, 1.0, true);
        drawSilverSlashScar(p, TX + 2, -22, 0.44, 50, 3.6, C, 1.0, true);
        drawSilverSlashScar(p, TX + 2, -22, -0.48, 50, 3.6, C, 1.0, true);
        flare(p, TX + 2, -22, 50, 1.0, [WHITE, WHITE, WHITE, WHITE]);
      } else if (t > T_H3 && t < T_H3 + 0.56) {
        const age3 = t - T_H3;
        const u3 = age3 / 0.56;
        const fade3 = 1 - smooth(0.22, 1.0, u3);

        // 1) Lingering 216px horizontal severing spatial rift slicing clean through the target!
        drawSilverSlashScar(p, 80, -21, -0.02, 128 * ease.outQuart(Math.min(1, u3 * 3.5)), 4.5 * (1 - u3 * 0.80), C, fade3);

        // 2) Twin forward-ripping silver sword-qi shockwave crescents (`双层破空残月剑波`) tearing past target!
        if (u3 < 0.74) {
          const uw = u3 / 0.74;
          const waveCx = TX - 10 + 102 * ease.outQuart(uw);
          const S_WAVE = swing({ cx: waveCx, cy: -22, R: 34 + 15 * uw, sy: 0.74, rot: 0.05, a0: -0.96, dir: 1 });
          const wFade = 1 - smooth(0.30, 1.0, uw);
          smoothSmear(p, S_WAVE, 0, 1.92, 10.0 * (1 - uw * 0.52), (u, r, out) => {
            const v = u / 1.92;
            const w = 10.0 * (1 - uw * 0.52) * Math.sin(Math.PI * v);
            if (w < 0.45) return;
            const q = (S_WAVE.R - r) / w;
            if (q < 0 || q > 1) return;
            out.c = q < 0.40 ? WHITE : q < 0.74 ? C[6] : C[4];
            out.a = wFade * (1 - q * 0.38);
          });

          // Faster outer razor wind-lip leading the crescent!
          const S_WAVE2 = swing({ cx: waveCx + 14 * ease.outCubic(uw), cy: -22, R: 40 + 16 * uw, sy: 0.78, rot: 0.05, a0: -0.82, dir: 1 });
          smoothSmear(p, S_WAVE2, 0, 1.64, 3.6 * (1 - uw * 0.6), (u, r, out) => {
            const v = u / 1.64;
            const w = 3.6 * (1 - uw * 0.6) * Math.sin(Math.PI * v);
            if (w < 0.35) return;
            const q = (S_WAVE2.R - r) / w;
            if (q < 0 || q > 1) return;
            out.c = q < 0.5 ? WHITE : C[5];
            out.a = wFade * 0.85;
          });
        }

        // 3) Flying razor wind-slivers (`飞散剑气刃`) sheared through the air behind the target!
        for (const ws of windSlivers) {
          if (age3 < ws.life) {
            const uw = age3 / ws.life;
            const drag = ease.outQuart(uw);
            const sx = ws.x0 + ws.vx * ws.life * drag;
            const sy = ws.y0 + ws.vy * ws.life * drag;
            drawSilverSlashScar(p, sx, sy, ws.ang, ws.len * (1 - uw * 0.45), 1.4 * (1 - uw * 0.6), C, 1 - uw);
          }
        }

        // 4) Ground wind-pressure shear streaks blasting outward along `y = -1..+2`!
        if (u3 < 0.55) {
          const us = u3 / 0.55;
          const span = 34 + 104 * ease.outQuart(us);
          drawSilverSlashScar(p, 78, -1, 0, span, 1.7 * (1 - us * 0.5), C, (1 - us) * 0.85);
        }
      }

      // Delayed secondary sword-qi cross-gashes snapping open across the knocked-back target!
      for (const ag of afterGashes) {
        if (ag.fired) {
          const ageG = t - (T_H3 + ag.dt);
          if (ageG >= 0 && ageG < 0.32) {
            const ug = ageG / 0.32;
            drawSilverSlashScar(p, TX + ag.dx, ag.dy, ag.a, ag.len * ease.outCubic(Math.min(1, ug * 3)), 2.5 * (1 - ug * 0.75), C, 1 - ug, ageG < 0.04);
            if (ageG < 0.14) sparkle(p, TX + ag.dx, ag.dy, 9 * (1 - ageG / 0.14), WHITE, C[5], 0.9);
          }
        }
      }

      lights.draw(p);
    },
  };
}
