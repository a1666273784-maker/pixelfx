// Möbius Infinity Lock ("moves/mobius-infinity-lock" — 【莫比乌斯环锁死与沉重光压】):
// 1. Dual Glowing Colorful Ribbons Orbit & Interweave (0.00..0.96s): Two long, vibrant iridescent ribbons — Electric
//    Aurora-Cyan and Neon Rose-Magenta edged in Gold — spiral in a 3D double-helix around the target from head to toe
//    (passing behind in `drawBack` and in front in `draw`), weaving over and under each other ("两条发光的彩色丝带围绕目标旋转交织").
// 2. Head-to-Tail Snap-Lock into a 3D "∞" Möbius Halo (0.96..1.48s): The two ribbons cinch inward and snap head-to-tail
//    at the central chest nexus and outer lobes, locking into a 3D twisted figure-eight "∞" Möbius strip collared around
//    the target ("首尾相连锁死成一个立体的无穷大“∞”字形光环套在目标身上"). Mechanical-arcane lock clasps and taut binding
//    light-chains yank the struggling target back to center ("展现无法挣脱的机制感").
// 3. Infinitely Accelerating Light-Stream Circulation & Heavy Descending Light-Pressure (1.35..3.32s): Prismatic
//    light-streams race around the 3D "∞" Möbius track with non-linearly accelerating velocity ("光环上光流无限加速循环流动").
//    Driven by the accelerating loop, cascading 3D compression rings, downward gravity-seal chevrons, dense vertical
//    light-pressure waterfalls, and four heavy floor-crushing shockwaves continuously slam down onto the target
//    ("不断向目标降下沉重光压的结果特效"), forcing them down to their knees.
// 4. Progressive Starlight Unzip Resolution (3.32..3.90s): The overdrive "∞" Möbius halo unzips from its outer lobes
//    inward into ascending prismatic starlight without dull grey fade artifacts, resolving cleanly to 0 pixels by 3.90s.
// 3D ring occlusion, starburst spikes, and spark physics build on Sprite Fusion's open-source pixel art VFX
// (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import {
  Particles,
  Lights,
  P,
  Rng,
  fit,
  flare,
  sparkle,
  clamp,
  smooth,
  lerp,
  ease,
  rand,
  TAU,
  WHITE,
  READY,
} from "../../core/index.js";
import { spikes, star } from "../impacts/_lib.js";

// Spatial geometry constants (target centered at (0, 0))
const RING_CY = -40;           // Vertical center of the 3D "∞" Möbius halo (crowning target's upper torso/shoulders)
const INF_RX = 60;             // Horizontal half-span of the "∞" figure-eight (120 px total width)
const INF_RY = 23;             // Vertical lobe amplitude of the "∞" figure-eight
const INF_TILT = -0.10;        // Subtle 3D perspective roll of the "∞" halo
const N_SEG = 104;             // High-resolution segments along the 3D Möbius curve
const SY_FLOOR = 0.24;         // Floor perspective squash

// Choreography timing constants (seconds)
const T_WEAVE_START = 0.02;    // Dual colorful ribbons begin spiraling & interweaving around the target
const T_MORPH_INF = 0.64;      // Double-helix ribbons morph and tighten into the 3D "∞" figure-eight path
const T_LOCK = 0.96;           // Head-to-tail snap-lock into the 3D "∞" Möbius halo!
const T_STRUGGLE_1 = 1.16;     // Target wrenches left against the "∞" lock; binding chains yank taut
const T_STRUGGLE_2 = 1.34;     // Target wrenches right against the "∞" lock; binding chains yank taut

// 4 Accelerating Heavy Light-Pressure Waves ("不断向目标降下沉重光压")
const PRESS_TIMES = [1.50, 1.94, 2.28, 2.58];
const T_UNZIP_START = 3.20;    // Overdrive "∞" lock unzips progressively from outer lobes to central nexus
const T_UNZIP_DONE = 3.58;     // Central nexus pops into a crisp starlight release burst
const T_END = 3.90;

export const meta = {
  name: "Mobius infinity lock",
  desc: "Two glowing colorful ribbons weave around the target and snap-lock into a 3D infinity Mobius halo with accelerating light streams and crushing light-pressure waves.",
  tags: ["move", "arcane", "status", "mobius", "infinity", "ribbon", "bind", "lock", "gravity", "one-shot"],
  size: [288, 204],
  origin: [144, 162],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    // Ribbon A: 6-step Electric Aurora-Cyan ramp ("发光彩色丝带 A：极光青蓝")
    cyan: ["#081b36", "#124070", "#1e78b8", "#34c2f8", "#92f6ff", "#ffffff"],
    // Ribbon B: 6-step Neon Rose-Magenta ramp ("发光彩色丝带 B：星霓品红")
    magenta: ["#2e0828", "#681452", "#b82486", "#f84ab4", "#ffa4e2", "#ffffff"],
    // Lock & Edge Gold: 6-step Burnished Astral Gold ramp ("首尾相连锁死金芒与法则卡扣")
    gold: ["#2c1a08", "#684214", "#b47824", "#f2b63d", "#ffe884", "#ffffff"],
    // Heavy Light-Pressure: 6-step Gravity Violet-Indigo ramp ("沉重光压星辉紫")
    pressure: ["#140a2e", "#2e1864", "#5830b0", "#8e5ef6", "#ccb4ff", "#ffffff"],
    seed: 31,
  },
};

// Actor poses: target at (0, 0) gets wrapped, struggles left & right against the inescapable "∞" lock,
// and is progressively crushed down under the 4 accelerating waves of Heavy Light-Pressure!
// (All hand offsets strictly obey |fx - lean| <= 12 and |bx - lean| <= 12 for 0px arm shortfall.)
const POSE_READY = { ...READY, x: 0, crouch: 2, lean: 0, fx: 8, fy: -22, bx: -7, by: -20, ffx: 6, fbx: -6 };
const POSE_SURPRISED = { ...POSE_READY, crouch: 1, lean: -1, fx: 9, fy: -27, bx: -9, by: -26, ffx: 5, fbx: -5 };
const POSE_LOCKED = { ...POSE_READY, crouch: 3, lean: 0, turn: 0.6, fx: -10, fy: -26, bx: 10, by: -26, armsFront: true, ffx: 6, fbx: -6 };
const POSE_WRENCH_L = { ...POSE_READY, x: -3, crouch: 4, lean: -2, turn: -0.7, fx: -12, fy: -28, bx: 8, by: -24, armsFront: true, ffx: 4, fbx: -7 };
const POSE_WRENCH_R = { ...POSE_READY, x: 3, crouch: 4, lean: 2, turn: 0.8, fx: 12, fy: -28, bx: -8, by: -24, armsFront: true, ffx: 7, fbx: -4 };
const POSE_PRESS_1 = { ...POSE_READY, x: 0, crouch: 5, lean: 1, turn: 0.5, fx: 10, fy: -23, bx: -8, by: -22, ffx: 7, fbx: -6 };
const POSE_PRESS_2 = { ...POSE_READY, x: 0, crouch: 7, lean: 2, turn: 0.4, fx: 11, fy: -20, bx: -7, by: -20, ffx: 8, fbx: -7 };
const POSE_PRESS_3 = { ...POSE_READY, x: 0, crouch: 9, lean: 3, turn: 0.3, fx: 12, fy: -17, bx: -6, by: -18, ffx: 9, fbx: -8, toeB: true };
const POSE_PRESS_4 = { ...POSE_READY, x: 0, crouch: 11, lean: 4, turn: 0.2, fx: 12, fy: -14, bx: -5, by: -16, ffx: 10, fbx: -8, toeB: true };

export const act = {
  poses: [
    [-0.28, POSE_READY],
    [0.24, POSE_SURPRISED, "out"],
    [T_LOCK - 0.04, { ...POSE_SURPRISED, crouch: 2, fx: 10, fy: -28, bx: -10, by: -28 }],
    [T_LOCK, POSE_LOCKED, "snap"],
    [T_STRUGGLE_1, POSE_WRENCH_L, "out"],
    [T_STRUGGLE_2, POSE_WRENCH_R, "out"],
    [PRESS_TIMES[0] - 0.04, POSE_LOCKED],
    [PRESS_TIMES[0], POSE_PRESS_1, "snap"],
    [PRESS_TIMES[1] - 0.04, { ...POSE_PRESS_1, crouch: 4 }],
    [PRESS_TIMES[1], POSE_PRESS_2, "snap"],
    [PRESS_TIMES[2] - 0.04, { ...POSE_PRESS_2, crouch: 6 }],
    [PRESS_TIMES[2], POSE_PRESS_3, "snap"],
    [PRESS_TIMES[3] - 0.04, { ...POSE_PRESS_3, crouch: 8 }],
    [PRESS_TIMES[3], POSE_PRESS_4, "snap"],
    [T_UNZIP_START, POSE_PRESS_4],
    [3.70, { ...POSE_READY, crouch: 4 }],
    [T_END, POSE_READY],
  ],
  hits: [
    { t: T_LOCK, stop: 0.08, shake: 0.28, amp: 3.5, target: false },
    { t: T_STRUGGLE_1, stop: 0.02, shake: 0.12, amp: 1.5, target: false },
    { t: T_STRUGGLE_2, stop: 0.02, shake: 0.12, amp: 1.5, target: false },
    { t: PRESS_TIMES[0], stop: 0.05, shake: 0.24, amp: 2.6, target: false },
    { t: PRESS_TIMES[1], stop: 0.06, shake: 0.28, amp: 3.4, target: false },
    { t: PRESS_TIMES[2], stop: 0.08, shake: 0.34, amp: 4.4, target: false },
    { t: PRESS_TIMES[3], stop: 0.14, shake: 0.48, amp: 5.8, target: false },
  ],
  dust: [
    { t: T_LOCK, x: 0, n: 6, c: "#ffe884" },
    { t: PRESS_TIMES[0], x: 0, n: 7, c: "#92f6ff" },
    { t: PRESS_TIMES[1], x: 0, n: 9, c: "#ffa4e2" },
    { t: PRESS_TIMES[2], x: 0, n: 11, c: "#ccb4ff" },
    { t: PRESS_TIMES[3], x: 0, n: 14, c: "#ffe884" },
  ],
};

// Safe bounds inside [288, 204] with origin [144, 162] -> x in [-144..143], y in [-162..41]
const X_MIN = -136, X_MAX = 136, Y_MIN = -152, Y_MAX = 34;
const GRID_W = 288, GRID_H = 204, OX = 144, OY = 162;
const visitedBuf = new Int32Array(GRID_W * GRID_H);
let visitStamp = 1;

// Bresenham 1-visit-per-pixel luminous line (zero moire or Bayer speckles)
function drawLuminousLine(p, x0, y0, x1, y1, colFn, alpha = 1) {
  if (alpha <= 0.02) return;
  let sx = Math.round(x0), sy = Math.round(y0);
  const ex = Math.round(x1), ey = Math.round(y1);
  const dx = Math.abs(ex - sx), dy = -Math.abs(ey - sy);
  const stepx = sx < ex ? 1 : -1, stepy = sy < ey ? 1 : -1;
  const n = Math.max(dx, -dy) || 1;
  const isFn = typeof colFn === "function";
  let err = dx + dy, i = 0;

  for (;;) {
    if (sx >= X_MIN && sx <= X_MAX && sy >= Y_MIN && sy <= Y_MAX) {
      const u = i / n;
      const c = isFn ? colFn(u) : colFn;
      if (alpha > 0.65) p.px(sx, sy, c);
      p.light(sx, sy, c, alpha * 0.85);
    }
    if (sx === ex && sy === ey) break;
    i++;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; sx += stepx; }
    if (e2 <= dx) { err += dx; sy += stepy; }
  }
}

// 1-visit-per-pixel perspective ellipse ring (used for descending light-pressure rings & floor shockwaves)
function drawLuminousEllipseRing(p, cx, cy, rx, sy, th, alpha, colOuter, colCore, keepFn) {
  if (rx <= 1 || alpha <= 0.02 || th <= 0.2) return;
  const rOut = rx + th * 0.5;
  const rIn = Math.max(0, rx - th * 0.8);
  const y0 = Math.max(Y_MIN, Math.floor(cy - rOut * sy - 1));
  const y1 = Math.min(Y_MAX, Math.ceil(cy + rOut * sy + 1));

  for (let py = y0; py <= y1; py++) {
    const dy = (py - cy) / sy;
    const dy2 = dy * dy;
    if (dy2 > rOut * rOut) continue;
    const xo = Math.sqrt(rOut * rOut - dy2);
    const xi = dy2 < rIn * rIn ? Math.sqrt(rIn * rIn - dy2) : 0;

    for (let px = Math.max(X_MIN, Math.floor(cx - xo - 1)), pxMax = Math.min(X_MAX, Math.ceil(cx + xo + 1)); px <= pxMax; px++) {
      const dx = px - cx;
      if (xi > 1 && dx > -xi + 1 && dx < xi - 1) {
        px = Math.max(px, Math.floor(cx + xi - 1));
        continue;
      }
      const ang = Math.atan2(dy, dx);
      if (keepFn && !keepFn(ang)) continue;
      const d = Math.sqrt(dx * dx + dy2);
      const persp = Math.hypot(Math.cos(ang), Math.sin(ang) * sy);
      const effTh = Math.max(0.85, th * Math.max(0.45, persp));
      const diff = Math.abs(d - rx);
      if (diff > effTh) continue;

      const u = 1 - diff / effTh;
      const col = u > 0.55 ? colCore : colOuter;
      const k = alpha * (u * u * 0.95 + 0.18);
      if (alpha > 0.70 && u > 0.50) p.px(px, py, col);
      p.light(px, py, col, k);
    }
  }
}

// Evaluate a point & 3D Möbius surface normal along the figure-eight "∞" curve for parameter `theta in [0, TAU)`:
// - `x(theta) = INF_RX * cos(theta)`
// - `y(theta) = RING_CY + INF_RY * sin(2 * theta)` (tilted by `INF_TILT`)
// - `z(theta) = -0.68 * cos(2 * theta) + 0.42 * sin(theta)`:
//   * At outer lobes (`theta = 0, PI`), `z < 0` -> passes BEHIND the target's shoulders (`drawBack`)!
//   * Around central crossing (`theta = PI/2, 3*PI/2`), `z > 0` -> passes IN FRONT OF the target's chest (`draw`),
//     with the `theta = PI/2` diagonal crossing OVER (`z = +1.10`) the `theta = 3*PI/2` diagonal (`z = +0.26`)!
// - Möbius half-twist angle: `phi(theta) = 0.5 * theta + twistPhase` (flips face polarity `cos(phi)` by 180 deg every loop!).
function evalMobiusInfinityPoint(theta, twistPhase = 0, scaleX = 1, scaleY = 1) {
  const ct = Math.cos(theta), st = Math.sin(theta);
  const c2 = Math.cos(2 * theta), s2 = Math.sin(2 * theta);
  const lx = INF_RX * scaleX * ct;
  const ly = INF_RY * scaleY * s2;
  const cr = Math.cos(INF_TILT), sr = Math.sin(INF_TILT);
  const x = lx * cr - ly * sr;
  const y = RING_CY + lx * sr + ly * cr;
  const z = -0.68 * c2 + 0.42 * st;

  // Möbius half-twist orientation (`theta * 0.5`)
  const phi = theta * 0.5 + twistPhase;
  const faceSign = Math.cos(phi); // > 0 shows Cyan face, < 0 shows Magenta-Rose face!
  // Apparent ribbon half-width in screen space: wide on flat faces (`|cos(phi)| ~ 1`), narrow pinch at half-twist inflection (`|cos(phi)| ~ 0`)
  const halfW = 1.55 + 3.25 * Math.abs(faceSign);

  return { x, y, z, theta, faceSign, halfW };
}

// Evaluate Phase-1 3D Double-Helix Interweaving Ribbon (`id = 0` Cyan, `id = 1` Magenta) around the target:
// - Spins 1.65 full turns around the target (`z < 0` behind the character, `z >= 0` in front of the character!),
//   weaving over and under each other before morphing smoothly into the 3D "∞" Möbius curve by `T_LOCK`!
function evalWeavingRibbonPoint(id, u, t, twistPhase) {
  const thetaTarget = (id * Math.PI + u * Math.PI) % TAU;
  const infPt = evalMobiusInfinityPoint(thetaTarget, twistPhase);

  if (t >= T_LOCK) return infPt;

  const morphU = ease.inOutCubic(clamp((t - T_MORPH_INF) / (T_LOCK - T_MORPH_INF)));
  // Double-helix parameters: 1.65 turns around the target's vertical axis (`x = 0, y in [-68 .. -6]`)
  const spin = t * 6.8 + id * Math.PI;
  const spiralAng = spin + (u - 0.5) * 8.2; // 1.3+ full turns along the ribbon body so it wraps front & back!
  const spiralR = (42 + 12 * Math.sin(u * Math.PI)) * (1 - 0.12 * Math.sin(t * 8));
  const sx = Math.cos(spiralAng) * spiralR;
  // Ribbon 0 climbs from bottom-left to top-right while Ribbon 1 descends from top-left to bottom-right, crossing each other twice!
  const yStart = id === 0 ? -10 : -68;
  const yEnd = id === 0 ? -68 : -10;
  const sy = lerp(yStart, yEnd, u) + Math.sin(spiralAng * 2) * 7;
  const sz = Math.sin(spiralAng);
  const sFace = Math.cos(u * Math.PI * 2.0 - t * 7 + id * 1.6);
  const sHalfW = 1.45 + 2.85 * Math.abs(sFace);

  return {
    x: lerp(sx, infPt.x, morphU),
    y: lerp(sy, infPt.y, morphU),
    z: lerp(sz, infPt.z, morphU),
    theta: thetaTarget,
    faceSign: lerp(sFace, infPt.faceSign, morphU),
    halfW: lerp(sHalfW, infPt.halfW, morphU),
  };
}

// Compute the non-linearly accelerating circulation phase ("光环上光流无限加速循环流动")
function getCirculationPhase(t) {
  if (t <= T_LOCK) return t * 2.4;
  const dt = Math.min(t - T_LOCK, T_UNZIP_START - T_LOCK + 0.4);
  // Angular velocity omega(dt) accelerates non-linearly from 2.4 rad/s to > 38 rad/s!
  return T_LOCK * 2.4 + 2.4 * dt + 3.2 * dt * dt + 1.85 * dt * dt * dt;
}

// Rasterize one 3D Möbius ribbon quad segment `(A -> B)` with per-layer pixel deduplication (`visitedBuf`)
// so adjacent segments NEVER double-accumulate `p.light` or create seam stripes!
function drawMobiusSegment(p, A, B, streamBoost, CA, CB, CG, isOverBridge = false, curStamp = 0) {
  const dx = B.x - A.x, dy = B.y - A.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.2) return;
  const nx = -dy / len, ny = dx / len;
  const maxW = Math.max(A.halfW, B.halfW) + (isOverBridge ? 1.2 : 0.4);

  const x0 = Math.max(X_MIN, Math.floor(Math.min(A.x, B.x) - maxW - 1));
  const x1 = Math.min(X_MAX, Math.ceil(Math.max(A.x, B.x) + maxW + 1));
  const y0 = Math.max(Y_MIN, Math.floor(Math.min(A.y, B.y) - maxW - 1));
  const y1 = Math.min(Y_MAX, Math.ceil(Math.max(A.y, B.y) + maxW + 1));

  for (let py = y0; py <= y1; py++) {
    const gy = py + OY;
    if (gy < 0 || gy >= GRID_H) continue;
    for (let px = x0; px <= x1; px++) {
      const gx = px + OX;
      if (gx < 0 || gx >= GRID_W) continue;

      const vx = px - A.x, vy = py - A.y;
      const u = (vx * dx + vy * dy) / (len * len);
      if (u < -0.12 || u > 1.12) continue;
      const d = vx * nx + vy * ny;
      const ad = Math.abs(d);
      const curHW = lerp(A.halfW, B.halfW, clamp(u));
      if (ad > curHW + (isOverBridge ? 0.9 : 0)) continue;

      const cellIdx = gy * GRID_W + gx;
      if (!isOverBridge && visitedBuf[cellIdx] === curStamp) continue;
      visitedBuf[cellIdx] = curStamp;

      // Dark occlusion border under the over-crossing bridge at the central "∞" nexus so the 3D figure-8 weave pops!
      if (isOverBridge && ad > curHW) {
        p.px(px, py, CG[0]);
        continue;
      }

      const face = lerp(A.faceSign, B.faceSign, clamp(u));
      const ramp = face >= 0 ? CA : CB;
      const q = ad / Math.max(0.6, curHW); // 0 at ribbon spine -> 1 at golden-white beveled edge

      let col;
      if (streamBoost > 0.68 && q < 0.68) {
        col = WHITE;
      } else if (q > 0.74) {
        // Gleaming Golden-White Möbius Edge Rail
        col = streamBoost > 0.35 ? WHITE : CG[4];
      } else if (q < 0.28) {
        // Luminous Center Core Spine
        col = streamBoost > 0.24 ? WHITE : ramp[4];
      } else {
        // Rich Iridescent Ribbon Body (shaded by 3D twist angle `|face|`)
        const idx = Math.abs(face) > 0.52 ? 3 : 2;
        col = streamBoost > 0.36 ? ramp[4] : ramp[idx];
      }

      p.px(px, py, col);
      p.light(px, py, col, 0.42 + 0.55 * streamBoost);
    }
  }
}

// Draw the mechanical-arcane Lock Clasps ("首尾相连锁死卡扣") at the central "∞" nexus and outer lobe anchors
function drawInfinityLockClasps(p, t, unzipProgress, CA, CB, CG) {
  if (t < T_LOCK || unzipProgress >= 0.95) return;
  const age = t - T_LOCK;
  const snapScale = age < 0.16 ? ease.outBack(age / 0.16, 1.8) : 1.0 - 0.5 * clamp((unzipProgress - 0.65) / 0.30);
  const pulse = 0.85 + 0.15 * Math.sin(t * 15);

  // 1. Central "∞" Nexus Octagonal Lock-Core at `(0, RING_CY)` (right over the target's upper chest)
  const cx = 0, cy = RING_CY;
  const rCore = Math.round(5.5 * snapScale);
  for (let dy = -rCore - 1; dy <= rCore + 1; dy++) {
    for (let dx = -rCore - 1; dx <= rCore + 1; dx++) {
      const ax = Math.abs(dx), ay = Math.abs(dy);
      const oct = Math.max(ax, ay) + 0.42 * Math.min(ax, ay);
      if (oct > rCore + 0.6) continue;
      let col;
      if (oct > rCore - 0.5) {
        col = CG[0];
      } else if (oct > rCore - 1.6) {
        col = (dx + dy < 0) ? WHITE : CG[4];
      } else if (ax + ay <= 2) {
        col = WHITE;
      } else {
        col = (dx * dy >= 0) ? CA[4] : CB[4];
      }
      p.px(cx + dx, cy + dy, col);
      p.light(cx + dx, cy + dy, col, 0.62);
    }
  }

  // 4 Clamping Caliper Brackets around the central "∞" nexus
  for (let k = 0; k < 4; k++) {
    const a = k * (Math.PI * 0.5) + Math.PI * 0.25 + Math.sin(t * 5) * 0.08;
    const r0 = (rCore + 1.5) * pulse, r1 = (rCore + 6.0) * pulse;
    drawLuminousLine(
      p,
      cx + Math.cos(a) * r0,
      cy + Math.sin(a) * r0,
      cx + Math.cos(a) * r1,
      cy + Math.sin(a) * r1,
      CG[4],
      0.92,
    );
  }

  // 2. Left & Right Outer Lobe Shackle Nodes ("首尾相连双翼锁扣", visible until unzipped)
  if (unzipProgress < 0.12) {
    for (const side of [-1, 1]) {
      const pt = evalMobiusInfinityPoint(side < 0 ? Math.PI : 0, 0);
      const lx = Math.round(pt.x), ly = Math.round(pt.y);
      const ramp = side < 0 ? CA : CB;
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dx) === 2 && Math.abs(dy) === 4) continue;
          const isRim = Math.abs(dx) === 2 || Math.abs(dy) >= 3;
          const col = isRim ? CG[4] : dy === 0 ? WHITE : ramp[4];
          p.px(lx + dx, ly + dy, col);
          p.light(lx + dx, ly + dy, col, 0.55);
        }
      }
    }
  }
}

// Draw Taut Binding Light-Chains ("展现无法挣脱的机制感") snapping between the "∞" ring and the struggling target!
function drawInescapableBindingChains(p, t, CA, CB, CG) {
  if (t < T_LOCK || t >= T_UNZIP_START) return;
  const struggleX = t < 1.46 ? Math.sin((t - T_LOCK) * 13) * 3.5 : 0;
  const crouchDrop = Math.max(0, (t - 1.46) * 4.2);
  const wristY = -24 + Math.min(8, crouchDrop);

  const leftLobe = evalMobiusInfinityPoint(Math.PI * 0.78, 0);
  const rightLobe = evalMobiusInfinityPoint(Math.PI * 0.22, 0);

  // Left and right taut geometric energy chains pinning the target's wrists/torso to the "∞" lobes
  drawLuminousLine(
    p,
    leftLobe.x,
    leftLobe.y,
    struggleX - 9,
    wristY,
    (u) => (((Math.floor(u * 12 - t * 18) & 1) === 0) ? WHITE : CA[4]),
    0.88,
  );
  drawLuminousLine(
    p,
    rightLobe.x,
    rightLobe.y,
    struggleX + 9,
    wristY,
    (u) => (((Math.floor(u * 12 - t * 18) & 1) === 0) ? WHITE : CB[4]),
    0.88,
  );
}

// Draw Downward Gravity-Seal Chevron (`︾` 法则重压符印) pressing down over the target
function drawGravityChevron(p, cx, cy, halfW, dropH, colCore, colOuter, alpha) {
  if (alpha <= 0.05 || cy >= -2 || cy <= Y_MIN + 6) return;
  drawLuminousLine(p, cx - halfW, cy - dropH, cx, cy, (u) => (u > 0.55 ? colCore : colOuter), alpha);
  drawLuminousLine(p, cx + halfW, cy - dropH, cx, cy, (u) => (u > 0.55 ? colCore : colOuter), alpha);
}

// Draw Continuous & Pulsing Heavy Descending Light-Pressure ("不断向目标降下沉重光压的结果特效")
function drawHeavyLightPressure(p, t, CA, CB, CG, CP, isBack) {
  if (t < T_LOCK + 0.18 || t >= T_UNZIP_START + 0.28) return;

  const overallFade = smooth(T_LOCK + 0.18, T_LOCK + 0.42, t) * (1 - smooth(T_UNZIP_START - 0.05, T_UNZIP_START + 0.28, t));
  if (overallFade <= 0.02) return;

  const accelRatio = clamp((t - T_LOCK) / (PRESS_TIMES[3] - T_LOCK));
  const speedMult = 1 + accelRatio * 2.6;

  // 1. Continuous Cascading 3D Compression Halo Rings ("由∞光环不断向下沉降压落的立体光压环阵")
  // 3 staggered horizontal compression rings continuously peel off `y = RING_CY` and press down to `y = 0`!
  for (let rIdx = 0; rIdx < 3; rIdx++) {
    const rPh = ((t * (0.95 + accelRatio * 0.85) + rIdx / 3) % 1);
    const ry = lerp(RING_CY + 4, 0.5, ease.inQuad(rPh));
    const rx = lerp(INF_RX * 0.86, INF_RX * 0.68, rPh);
    const rAlpha = overallFade * Math.sin(rPh * Math.PI) * (0.65 + 0.30 * accelRatio);
    const cOuter = rIdx === 0 ? CA[4] : rIdx === 1 ? CB[4] : CP[4];
    const cCore = rPh > 0.65 ? WHITE : CG[4];
    drawLuminousEllipseRing(
      p,
      0,
      ry,
      rx,
      SY_FLOOR,
      1.6 + 0.8 * accelRatio,
      rAlpha,
      cOuter,
      cCore,
      (g) => (Math.sin(g) < 0) === isBack,
    );
  }

  // 2. Continuous Vertical Gravity-Light Waterfall Curtain ("持续从∞光环倾泻而下的沉重光压光幕")
  const nStreams = 26;
  for (let i = 0; i < nStreams; i++) {
    const theta = (i / nStreams) * TAU;
    const pt = evalMobiusInfinityPoint(theta, 0);
    const streamBack = pt.z < 0;
    if (streamBack !== isBack) continue;

    const ph = ((t * (1.7 + (i % 3) * 0.38) * speedMult + rand(i, 71)) % 1);
    const topY = pt.y + 2;
    if (topY >= -4) continue;
    const yHead = lerp(topY, 0, ease.inQuad(ph));
    const yTail = lerp(topY, 0, ease.inQuad(Math.max(0, ph - 0.42)));
    const sx = pt.x * (0.94 - 0.10 * ph);

    const col = i % 3 === 0 ? CA[4] : i % 3 === 1 ? CB[4] : CP[4];
    const k = overallFade * Math.sin(ph * Math.PI) * (isBack ? 0.62 : 0.92);
    drawLuminousLine(p, sx, yTail, sx, yHead, (u) => (u > 0.62 ? WHITE : col), k);
  }

  // 3. Downward Gravity-Seal Chevrons (`︾` 沉重法则压印) descending along the left, center, and right columns
  if (!isBack) {
    for (const colX of [-34, 0, 34]) {
      const chPh = ((t * (1.4 + accelRatio * 1.1) + (colX === 0 ? 0.0 : 0.45)) % 1);
      const chY = lerp(RING_CY + 6, -4, ease.inQuad(chPh));
      const chAlpha = overallFade * Math.sin(chPh * Math.PI) * (0.72 + 0.25 * accelRatio);
      const chW = colX === 0 ? 11 : 8;
      drawGravityChevron(p, colX, chY, chW, 5, WHITE, colX < 0 ? CA[4] : colX > 0 ? CB[4] : CG[4], chAlpha);
      drawGravityChevron(p, colX, chY - 5, chW * 0.78, 4, CG[4], CP[4], chAlpha * 0.82);
    }
  }

  // 4. Four Accelerating Heavy Light-Pressure Impact Waves ("四重递增沉重光压轰击地面")
  for (let w = 0; w < PRESS_TIMES.length; w++) {
    const t0 = PRESS_TIMES[w];
    const age = t - t0;
    const isClimax = w === PRESS_TIMES.length - 1;
    const dur = isClimax ? 0.82 : 0.54;
    if (age < 0 || age >= dur) continue;

    const u = age / dur;
    const intensity = 0.76 + w * 0.10;
    const dropU = clamp(age / 0.18);
    const ringY = lerp(RING_CY + 2, 0.5, ease.inCubic(dropU));
    const ringRx = lerp(INF_RX * 0.92, (58 + w * 13) * (1 + 0.35 * ease.outQuart(u)), smooth(0.10, 1.0, u));
    const ringFade = (1 - smooth(0.30, 1.0, u)) * intensity;

    const colOuter = w % 2 === 0 ? CA[4] : CB[4];
    const colCore = isClimax ? CG[4] : WHITE;

    // Primary Crushing Hydraulic Ring slamming from `RING_CY` into the floor and blasting outward
    drawLuminousEllipseRing(
      p,
      0,
      ringY,
      ringRx,
      SY_FLOOR,
      Math.max(1.2, (3.4 + w * 0.5) * (1 - u * 0.65)),
      ringFade,
      colOuter,
      colCore,
      (g) => (Math.sin(g) < 0) === isBack,
    );

    // Secondary Ground Crushing Shockwave Ring once the pressure wave hits the floor (`age >= 0.14`)
    if (age >= 0.14) {
      const fu = (age - 0.14) / (dur - 0.14);
      const floorRx = 16 + (64 + w * 13) * ease.outQuart(fu);
      drawLuminousEllipseRing(
        p,
        0,
        0.5,
        floorRx,
        SY_FLOOR,
        Math.max(1.0, (2.8 + w * 0.4) * (1 - fu)),
        (1 - fu) * 0.92 * intensity,
        CP[4],
        WHITE,
        (g) => (Math.sin(g) < 0) === isBack,
      );
    }

    // Front-layer Vertical Crushing Gravity Pillar & Radial Floor Fissure Lines on impact
    if (!isBack && age < 0.26) {
      const pk = (1 - age / 0.26) * intensity;
      const nBars = 11 + w * 2;
      for (let b = 0; b < nBars; b++) {
        const bx = ((b / (nBars - 1)) - 0.5) * 2 * (38 + w * 6);
        const byTop = RING_CY + Math.abs(bx) * 0.12;
        drawLuminousLine(
          p,
          bx,
          byTop,
          bx * 1.06,
          0,
          (v) => (v > 0.55 ? WHITE : b % 2 === 0 ? CP[4] : CG[4]),
          pk * (1 - Math.abs(bx) / 76) * 0.82,
        );
      }
    }
  }
}

export function create(o) {
  const CA = fit(o.cyan, 6);
  const CB = fit(o.magenta, 6);
  const CG = fit(o.gold, 6);
  const CP = fit(o.pressure, 6);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, CA[4], CB[4], CG[4], CP[4]],
  });
  const lights = new Lights();

  const lockSpikes = spikes(R, 14, 0, { len: [14, 24], w: [2.0, 2.8], fwd: 1.25, back: 1.25, jag: 0.5 });
  const lobeSpikes = spikes(R, 10, 0, { len: [9, 15], w: [1.5, 2.2], fwd: 1.15, back: 1.15, jag: 0.45 });

  let t = 0;
  let lockFired = false;
  let unzipPopFired = false;
  const pressFired = [false, false, false, false];

  const capLife = (l) => Math.max(0.08, Math.min(l, T_END - 0.14 - t));

  // Render either the back (`z < 0`) or front (`z >= 0`) half of the 3D Möbius ribbons & accelerating light-streams
  function renderMobiusRibbonsAndStreams(p, isBack) {
    if (t < T_WEAVE_START || t >= T_UNZIP_DONE) return;
    const unzipProgress = clamp((t - T_UNZIP_START) / (T_UNZIP_DONE - T_UNZIP_START));
    if (unzipProgress >= 1) return;

    visitStamp = (visitStamp + 1) & 0x3fffffff;
    const curStamp = visitStamp;

    const circPhase = getCirculationPhase(t);
    const twistPhase = t < T_LOCK ? -t * 3.8 : -T_LOCK * 3.8 - (circPhase - T_LOCK * 2.4) * 0.45;

    if (t < T_LOCK) {
      // PHASE 1: Two long, flowing colorful ribbons spiraling & interweaving in a 3D double-helix around the target!
      const headProgress = ease.outQuad(clamp((t - T_WEAVE_START) / (T_LOCK - T_WEAVE_START)));
      const tailProgress = Math.max(0, (headProgress - 0.78) / 0.22) * 0.0; // keep full ribbon length as it wraps into "∞"
      const iStart = Math.floor((N_SEG / 2) * tailProgress);
      const iEnd = Math.max(iStart + 4, Math.floor((N_SEG / 2) * headProgress));

      for (const id of [0, 1]) {
        const pts = [];
        for (let i = iStart; i <= iEnd; i++) {
          pts.push(evalWeavingRibbonPoint(id, i / (N_SEG / 2), t, twistPhase));
        }
        for (let i = 0; i < pts.length - 1; i++) {
          const A = pts[i], B = pts[i + 1];
          const segBack = (A.z + B.z) * 0.5 < 0;
          if (segBack !== isBack) continue;
          const uTip = i / Math.max(1, pts.length - 1);
          const tipGlow = Math.pow(uTip, 2.5);
          const rA = id === 0 ? CA : CB;
          const rB = id === 0 ? CB : CA;
          drawMobiusSegment(p, A, B, tipGlow, rA, rB, CG, false, curStamp + id * 1000);
        }

        // Blazing leading comet head on each weaving ribbon!
        const tip = pts[pts.length - 1];
        if ((tip.z < 0) === isBack) {
          sparkle(p, Math.round(tip.x), Math.round(tip.y), 8, WHITE, id === 0 ? CA[4] : CB[4], 0.9);
        }
      }
      return;
    }

    // PHASE 2, 3 & 4: Locked 3D "∞" Möbius Halo with Infinitely Accelerating Light-Stream Circulation!
    // During Phase 4 (`unzipProgress > 0`), the "∞" loop unzips cleanly from its outer lobes (`theta = 0, PI`)
    // inward toward the central nexus (`theta = PI/2, 3*PI/2`) at full 100% brightness (zero dull grey fadeout!).
    const widthTaper = 1 - 0.68 * smooth(0.32, 0.96, unzipProgress);
    const pts = [];
    for (let i = 0; i <= N_SEG; i++) {
      const pt = evalMobiusInfinityPoint((i / N_SEG) * TAU, twistPhase, 1, 1);
      pt.halfW *= widthTaper;
      pts.push(pt);
    }

    // Distance of angle `theta` from the central nexus (`PI/2` or `3*PI/2`), normalized to `0` at nexus .. `1` at outer lobe apex (`0` or `PI`)
    const lobeDist = (theta) => Math.abs(Math.cos(theta));
    const keepThreshold = 1 - ease.inOutQuad(unzipProgress);

    const order = [];
    for (let i = 0; i < N_SEG; i++) {
      const A = pts[i], B = pts[i + 1];
      const zMid = (A.z + B.z) * 0.5;
      if ((zMid < 0) !== isBack) continue;
      const thetaMid = (A.theta + B.theta) * 0.5;
      const dLobe = lobeDist(thetaMid);
      if (dLobe > keepThreshold) continue;
      order.push({ i, A, B, zMid, thetaMid, dLobe });
    }
    order.sort((a, b) => a.zMid - b.zMid);

    const accelRatio = clamp((t - T_LOCK) / (PRESS_TIMES[3] - T_LOCK));

    for (const seg of order) {
      const { A, B, zMid, thetaMid, dLobe } = seg;
      // High-speed travelling light-stream pulses racing along the "∞" track!
      const wave = 0.5 + 0.5 * Math.cos(3 * thetaMid - circPhase);
      // Bright white-hot erosion tip during Phase-4 unzip!
      const unzipTipBoost = unzipProgress > 0 ? clamp(1 - (keepThreshold - dLobe) / 0.16) : 0;
      const streamBoost = clamp(Math.pow(wave, lerp(4.5, 2.0, accelRatio)) + accelRatio * 0.34 + unzipTipBoost * 0.55);
      const isOverBridge = !isBack && zMid > 0.82 && unzipProgress < 0.45;
      drawMobiusSegment(p, A, B, streamBoost, CA, CB, CG, isOverBridge, curStamp);

      if (unzipTipBoost > 0.78 && (seg.i % 3) === 0) {
        sparkle(p, Math.round(A.x), Math.round(A.y), 6, WHITE, seg.i & 1 ? CA[4] : CB[4], 0.85);
        // Ascending starlight sublimation filament rising from the receding tip
        const riseH = 12 + 16 * unzipProgress;
        drawLuminousLine(p, A.x, A.y, A.x, A.y - riseH, (v) => (v < 0.35 ? WHITE : CG[4]), 0.78 * (1 - unzipProgress * 0.5));
      }
    }

    // Render 6 Blazing Light-Stream Comet Heads ("光环上无限加速循环流动的光流核心") racing around the "∞" track!
    if (unzipProgress < 0.25) {
      const nComets = 6;
      for (let c = 0; c < nComets; c++) {
        const cTheta = ((circPhase * 0.38 + (c / nComets) * TAU) % TAU + TAU) % TAU;
        if (lobeDist(cTheta) > keepThreshold) continue;
        const head = evalMobiusInfinityPoint(cTheta, twistPhase, 1, 1);
        if ((head.z < 0) !== isBack) continue;
        const col = c % 2 === 0 ? CA[4] : CB[4];
        const arm = Math.round(5.0 + 3.5 * accelRatio);
        sparkle(p, Math.round(head.x), Math.round(head.y), arm, WHITE, col, 0.72 + 0.28 * accelRatio);
      }
    }
  }

  return {
    update(dt) {
      t += dt;

      // 1. Phase 1 Weaving ribbon trail sparks
      if (t >= T_WEAVE_START && t < T_LOCK && R.chance(0.82)) {
        const id = R.chance(0.5) ? 0 : 1;
        const u = clamp((t - T_WEAVE_START) / (T_LOCK - T_WEAVE_START));
        const tip = evalWeavingRibbonPoint(id, u, t, -t * 3.8);
        ps.spawn(
          R.chance(0.4) ? P.STAR : P.SPARK,
          tip.x + R.range(-3, 3),
          tip.y + R.range(-3, 3),
          R.range(-55, 55),
          R.range(-45, 35),
          capLife(R.range(0.18, 0.38)),
          id === 0 ? R.pick([WHITE, CA[4], CG[4]]) : R.pick([WHITE, CB[4], CG[4]]),
          R.range(1.0, 1.7),
        );
      }

      // 2. Phase 2 Head-to-Tail Snap-Lock Detonation (`t = T_LOCK = 0.96s`)
      if (!lockFired && t >= T_LOCK) {
        lockFired = true;
        lights.add(0, RING_CY, 64, CG[4], 0.92, 0.32);
        lights.add(-INF_RX, RING_CY, 44, CA[4], 0.85, 0.26);
        lights.add(INF_RX, RING_CY, 44, CB[4], 0.85, 0.26);
        for (let i = 0; i < 36; i++) {
          const a = R.range(0, TAU), sp = R.range(65, 195);
          ps.spawn(
            i % 3 === 0 ? P.STAR : P.SPARK,
            R.range(-8, 8),
            RING_CY + R.range(-6, 6),
            Math.cos(a) * sp,
            Math.sin(a) * sp * 0.65,
            capLife(R.range(0.22, 0.46)),
            R.pick([WHITE, CG[4], CA[4], CB[4]]),
            R.range(1.1, 1.9),
          );
        }
      }

      // 3. Centrifugal & downward light-pressure sparks slung off the accelerating "∞" Möbius ring (`t in [T_LOCK, T_UNZIP_START]`)
      if (t >= T_LOCK && t < T_UNZIP_START) {
        const accel = clamp((t - T_LOCK) / (PRESS_TIMES[3] - T_LOCK));
        if (R.chance(0.50 + 0.48 * accel)) {
          const th = R.range(0, TAU);
          const pt = evalMobiusInfinityPoint(th, 0);
          ps.spawn(
            R.chance(0.38) ? P.STAR : P.SPARK,
            pt.x,
            pt.y,
            R.range(-35, 35) + pt.x * 0.55,
            R.range(35, 115), // driven downward with the heavy light-pressure!
            capLife(R.range(0.18, 0.38)),
            R.pick([WHITE, CA[4], CB[4], CG[4], CP[4]]),
            R.range(1.0, 1.7),
          );
        }
      }

      // 4. Four Heavy Light-Pressure Waves slamming into the target & floor (`PRESS_TIMES`)
      for (let w = 0; w < PRESS_TIMES.length; w++) {
        if (!pressFired[w] && t >= PRESS_TIMES[w]) {
          pressFired[w] = true;
          const isClimax = w === PRESS_TIMES.length - 1;
          lights.add(0, RING_CY, isClimax ? 68 : 52, isClimax ? CG[4] : CP[4], 0.88, 0.28);
          lights.add(0, -6, isClimax ? 76 : 58, w % 2 === 0 ? CA[4] : CB[4], 0.86, 0.32);

          const nSparks = isClimax ? 48 : 26 + w * 6;
          for (let i = 0; i < nSparks; i++) {
            const dir = R.sign();
            const sx = R.range(-42, 42);
            ps.spawn(
              i % 3 === 0 ? P.STAR : P.SPARK,
              sx,
              -2,
              dir * R.range(55, 195 + w * 20),
              -R.range(18, 75),
              capLife(R.range(0.22, 0.48)),
              R.pick([WHITE, CA[4], CB[4], CG[4], CP[4]]),
              R.range(1.0, 1.9),
            );
          }
        }
      }

      // 5. Final starlight release pop when the unzipping "∞" ring finishes collapsing into `(0, RING_CY)` at `T_UNZIP_DONE`
      if (!unzipPopFired && t >= T_UNZIP_DONE) {
        unzipPopFired = true;
        lights.add(0, RING_CY, 54, CG[4], 0.85, 0.22);
        lights.add(0, RING_CY, 28, WHITE, 0.90, 0.10);
        for (let i = 0; i < 28; i++) {
          const a = R.range(0, TAU), sp = R.range(55, 165);
          ps.spawn(
            i % 2 === 0 ? P.STAR : P.SPARK,
            R.range(-4, 4),
            RING_CY + R.range(-4, 4),
            Math.cos(a) * sp,
            Math.sin(a) * sp * 0.7 - 15,
            capLife(R.range(0.14, 0.24)),
            R.pick([WHITE, CA[4], CB[4], CG[4]]),
            R.range(1.1, 1.8),
          );
        }
      }

      ps.update(dt);
      cullList(ps.list, X_MIN + 8, Y_MIN + 10, X_MAX - 8, Y_MAX - 6);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;

      // Ambient astral floor seal under the bound target (back half)
      if (t >= T_MORPH_INF && t < T_UNZIP_START + 0.25) {
        const sealFade = smooth(T_MORPH_INF, T_LOCK, t) * (1 - smooth(T_UNZIP_START - 0.05, T_UNZIP_START + 0.25, t));
        const pulseR = 48 + 4 * Math.sin(t * 10);
        drawLuminousEllipseRing(p, 0, 0.5, pulseR, SY_FLOOR, 2.0, sealFade * 0.80, CP[3], CA[4], (g) => Math.sin(g) < 0);
        drawLuminousEllipseRing(p, 0, 0.5, pulseR * 0.62, SY_FLOOR, 1.5, sealFade * 0.74, CG[3], CB[4], (g) => Math.sin(g) < 0);
      }

      // Back half of Heavy Descending Light-Pressure curtains & compression rings
      drawHeavyLightPressure(p, t, CA, CB, CG, CP, true);

      // Far side (`z < 0`) of the 3D Möbius Infinity Ribbons passing BEHIND the target's shoulders!
      renderMobiusRibbonsAndStreams(p, true);

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;

      const unzipProgress = clamp((t - T_UNZIP_START) / (T_UNZIP_DONE - T_UNZIP_START));

      // Front half of the astral floor seal under the bound target
      if (t >= T_MORPH_INF && t < T_UNZIP_START + 0.25) {
        const sealFade = smooth(T_MORPH_INF, T_LOCK, t) * (1 - smooth(T_UNZIP_START - 0.05, T_UNZIP_START + 0.25, t));
        const pulseR = 48 + 4 * Math.sin(t * 10);
        drawLuminousEllipseRing(p, 0, 0.5, pulseR, SY_FLOOR, 2.0, sealFade * 0.84, CP[3], CA[4], (g) => Math.sin(g) >= 0);
        drawLuminousEllipseRing(p, 0, 0.5, pulseR * 0.62, SY_FLOOR, 1.5, sealFade * 0.78, CG[3], CB[4], (g) => Math.sin(g) >= 0);
      }

      // Front half of Heavy Descending Light-Pressure curtains & compression rings
      drawHeavyLightPressure(p, t, CA, CB, CG, CP, false);

      // Taut binding chains connecting the struggling target to the "∞" lobes
      drawInescapableBindingChains(p, t, CA, CB, CG);

      // Near side (`z >= 0`) of the 3D Möbius Infinity Halo passing IN FRONT OF the target's chest!
      renderMobiusRibbonsAndStreams(p, false);

      // Mechanical-arcane lock clasps at the central "∞" nexus and left/right lobes
      drawInfinityLockClasps(p, t, unzipProgress, CA, CB, CG);

      // Final Nexus Release Starburst when the "∞" lock finishes unzipping at `T_UNZIP_DONE` (`3.58s`)
      const ageRelease = t - T_UNZIP_DONE;
      if (ageRelease >= 0 && ageRelease < 0.14) {
        const hk = 1 - ageRelease / 0.14;
        star(p, 0, RING_CY, lockSpikes, 0.92, hk, [CP[3], CG[4], CA[4], WHITE], 1, 2.2);
        flare(p, 0, RING_CY, 32 * hk, hk, [CP[4], CG[4], CA[4], WHITE]);
        sparkle(p, 0, RING_CY, Math.round(14 * hk), WHITE, CG[4], hk);
      }

      // Snap-Lock Starburst Flash at `t = T_LOCK` (`0.96s`)
      const ageLock = t - T_LOCK;
      if (ageLock >= 0 && ageLock < 0.14) {
        const hk = 1 - ageLock / 0.14;
        const hot = ageLock < 0.05;
        star(p, 0, RING_CY, lockSpikes, hot ? 1.05 : 1.28, hot ? 1.0 : 0.68, [CG[3], CG[4], CA[4], WHITE], 1, 2.6);
        star(p, -INF_RX, RING_CY, lobeSpikes, 1.0, hk * 0.85, [CA[3], CA[4], CG[4], WHITE], 1, 2.0);
        star(p, INF_RX, RING_CY, lobeSpikes, 1.0, hk * 0.85, [CB[3], CB[4], CG[4], WHITE], 1, 2.0);
        flare(p, 0, RING_CY, 38 * hk, hk, [CP[4], CG[4], CA[4], WHITE]);
      }

      // Nexus Overdrive Flash on each of the 4 Heavy Light-Pressure Slams (`PRESS_TIMES`)
      for (let w = 0; w < PRESS_TIMES.length; w++) {
        const ageP = t - PRESS_TIMES[w];
        if (ageP >= 0 && ageP < 0.12) {
          const hk = 1 - ageP / 0.12;
          const isClimax = w === PRESS_TIMES.length - 1;
          if (isClimax) {
            star(p, 0, RING_CY, lockSpikes, 1.22, hk, [CP[3], CG[4], CA[4], WHITE], 1, 2.8);
          }
          flare(p, 0, RING_CY, (26 + w * 5) * hk, hk, [CP[4], w % 2 === 0 ? CA[4] : CB[4], CG[4], WHITE]);
          flare(p, 0, -2, (30 + w * 6) * hk, hk * 0.85, [CP[4], CG[4], CA[4], WHITE]);
        }
      }

      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

function cullList(L, x0, y0, x1, y1) {
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i];
    const r = (q.size || 2) * 1.8 + 4;
    if (q.x - r < x0 || q.x + r > x1 || q.y - r < y0 || q.y + r > y1) {
      L.splice(i, 1);
    }
  }
}
