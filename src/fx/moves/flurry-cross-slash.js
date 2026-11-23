// Flurry Cross-Slash (乱舞十字斩): 11 ultra-fast omnidirectional curved blade slashes cage the target in bursting sparks, then twin colossal curved blades intersect dead-center into a monumental cross to cleave open a glowing cross-shaped fissure.
import {
  Particles, Bits, Lights, P, PF, B, Rng,
  fit, clamp, smooth, seg, lerp, ease,
  flare, sparkle, band, TAU, WHITE, READY,
} from "../../core/index.js";
import { unlight, ringLight } from "../shadow/_lib.js";
import { brokenRing } from "../impacts/_lib.js";

const PI = Math.PI;
const TX = 136;
const TY = -36;

// Frame-exact timeline (30 fps -> 0.0333s per frame)
const T_DASH    = 0.00;
const T_FLURRY  = 0.045;  // 11 overlapping 360-deg curved slashes (0.045..0.52s)
const T_GATHER  = 0.56;   // twin-blade X-charge flash & vacuum convergence
const T_CROSS1  = 0.67;   // colossal sweeping horizontal crescent blade
const T_CROSS2  = 0.75;   // colossal sky-to-earth vertical crescent blade
const T_LOCK    = 0.80;   // exact cross intersection + bisecting flash + 4-way spark jets
const T_RUPTURE = 1.16;   // cross-scar rips wide open into a dark-cored glowing cross-fissure
const T_SEAL    = 2.46;   // cross-fissure zips shut cleanly
const T_END     = 2.60;   // tight clean ending with zero dead tail

// Strict interior stage bounds (canvas 416x248, origin [84, 196] => x in [-84..331], y in [-196..51])
const X_MIN = -78, X_MAX = 325, Y_MIN = -190, Y_MAX = 42;
const inStage = (x, y, pad = 0) =>
  x >= X_MIN + pad && x <= X_MAX - pad && y >= Y_MIN + pad && y <= Y_MAX - pad;

export const meta = {
  name: "Flurry cross slash",
  desc: "Omnidirectional curved blade slashes cage the target in bursting sparks before two colossal blades intersect to cleave open a glowing cross-shaped fissure.",
  tags: ["move", "sword", "slash", "flurry", "cross", "fissure", "combo", "combat", "one-shot"],
  size: [416, 248],
  origin: [84, 196],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#050914", "#102040", "#1e3f78", "#2f6ec4", "#55b4f5", "#9be2ff", "#dff8ff", "#ffffff"],
    sparks: ["#2a060b", "#681018", "#b8241c", "#f25c1e", "#ffa828", "#ffe875", "#fffdf0"],
    seed: 11,
  },
};

// Dual-sword blademaster choreography: blitzes in, shuttles all around TX, coils, cleaves through to far side, then snaps home
const BASE = {
  ...READY,
  weapon: "sword",
  offWeapon: "sword",
  fx: 11, fy: -21, sa: -0.68,
  bx: 8,  by: -22, sb: -1.02,
  ffx: 8, fbx: -8,
};
const COIL = {
  ...BASE,
  x: -8, crouch: 7, lean: -4, twist: -0.35,
  fx: -6, fy: -19, sa: 2.85,
  bx: 7,  by: -24, sb: -2.20,
  ffx: 9, fbx: -10, toeB: true,
};
const BLITZ = {
  ...BASE,
  x: 52, crouch: 8, lean: 8, twist: 0.35,
  fx: 15, fy: -17, sa: 0.08,
  bx: -6, by: -20, sb: 2.92,
  ffx: 11, fbx: -11, toeB: true, ghost: 1,
};
const FL_1 = {
  ...BASE,
  x: TX - 36, crouch: 5, lean: 5, twist: 0.45,
  fx: 14, fy: -25, sa: -0.45,
  bx: -5, by: -22, sb: 2.55,
  ffx: 10, fbx: -9, ghost: 1,
};
const FL_2 = {
  ...BASE,
  x: TX + 38, yaw: PI, crouch: 5, lean: 5, twist: -0.45,
  fx: 14, fy: -28, sa: -0.68,
  bx: 9,  by: -18, sb: 0.58,
  ffx: 10, fbx: -9, ghost: 1,
};
const FL_3 = {
  ...BASE,
  x: TX - 30, y: -12, crouch: 3, lean: 4, twist: 0.40,
  fx: 13, fy: -16, sa: 0.78,
  bx: 12, by: -28, sb: -0.58,
  ffx: 7, ffy: -3, fbx: -7, fby: -2, ghost: 1,
};
const FL_4 = {
  ...BASE,
  x: TX + 36, yaw: PI, crouch: 6, lean: 5, twist: 0.42,
  fx: 13, fy: -31, sa: -0.92,
  bx: -4, by: -21, sb: 2.42,
  ffx: 10, fbx: -9, ghost: 1,
};
const FL_5 = {
  ...BASE,
  x: TX - 34, y: -6, crouch: 4, lean: 6, twist: -0.40,
  fx: 14, fy: -20, sa: 0.32,
  bx: 11, by: -29, sb: -0.82,
  ffx: 10, fbx: -9, ghost: 1,
};
const GATHER_POSE = {
  ...BASE,
  x: TX - 50, y: -5, crouch: 4, lean: -3, twist: -0.30,
  fx: -3, fy: -31, sa: -2.28,
  bx: 9,  by: -30, sb: -1.92,
  armsFront: true, ffx: 8, fbx: -9, toeF: true, ghost: 1,
};
const CLEAVE_H = {
  ...BASE,
  x: TX - 22, crouch: 6, lean: 7, twist: 0.55,
  fx: 15, fy: -20, sa: 0.16,
  bx: -5, by: -30, sb: -2.18,
  ffx: 11, fbx: -10, toeB: true, ghost: 1,
};
// Passes cleanly through the target to TX + 90 in a low twin-blade follow-through stance
const CLEAVE_PASS = {
  ...BASE,
  x: TX + 90, crouch: 8, lean: 7, twist: 0.48,
  fx: 15, fy: -13, sa: 0.88,
  bx: -6, by: -19, sb: 2.68,
  armsFront: true, ffx: 11, fbx: -11, toeB: true, ghost: 1,
};

export const act = {
  target: { x: TX },
  poses: [
    [-0.34, BASE],
    [-0.12, COIL],
    [T_DASH, BLITZ, "snap"],
    [0.06, FL_1, "snap"],
    [0.16, FL_2, "snap"],
    [0.26, FL_3, "snap"],
    [0.36, FL_4, "snap"],
    [0.46, FL_5, "snap"],
    [T_GATHER, GATHER_POSE, "snap"],
    [T_CROSS1, CLEAVE_H, "snap"],
    [T_CROSS2 + 0.02, CLEAVE_PASS, "snap"],
    [1.48, { ...CLEAVE_PASS, crouch: 7, ghost: 0 }],
    [1.88, { ...BASE, x: TX + 84, yaw: PI }],
    [2.24, { ...BASE, x: 0, ghost: 1 }, "snap"],
    [T_END, BASE],
  ],
  hits: [
    // Rapid flurry cuts — crisp micro-jolts, alternating left/right push, zero freeze-lock drag
    { t: 0.07, stop: 0.012, push:  0.8, straw: 4, flash: 0.02, y: -26 },
    { t: 0.12, stop: 0.012, push: -0.7, straw: 4, flash: 0.02, y: -38 },
    { t: 0.17, stop: 0.012, push:  0.8, straw: 4, flash: 0.02, y: -22 },
    { t: 0.22, stop: 0.012, push: -0.8, straw: 5, flash: 0.02, y: -40 },
    { t: 0.27, stop: 0.012, push:  0.9, straw: 5, flash: 0.02, y: -30 },
    { t: 0.32, stop: 0.012, push: -0.8, straw: 5, flash: 0.02, y: -36 },
    { t: 0.37, stop: 0.014, push:  0.9, straw: 5, flash: 0.02, y: -24 },
    { t: 0.43, stop: 0.014, push: -0.9, straw: 6, flash: 0.03, y: -34 },
    { t: 0.49, stop: 0.016, push:  1.0, straw: 6, flash: 0.03, y: -30 },
    // Colossal horizontal slash bite
    { t: T_CROSS1 + 0.03, stop: 0.03, shake: 0.16, amp: 2.6, push: 2.2, straw: 14, flash: 0.04, y: -32 },
    // Colossal vertical cross-lock cleave — heavy hit-stop & shock shiver
    {
      t: T_LOCK,
      stop: 0.17,
      shake: 0.50,
      amp: 5.6,
      push: 5.2,
      slide: 12,
      straw: 38,
      flash: 0.07,
      skin: "shock",
      shiver: 0.65,
      y: -32,
    },
    // Delayed cross-fissure rupture — violent secondary burst & char scorch
    {
      t: T_RUPTURE,
      stop: 0.07,
      shake: 0.34,
      amp: 4.2,
      push: 3.4,
      slide: 16,
      straw: 28,
      flash: 0.05,
      skin: "char",
      daze: 0.95,
      y: -32,
    },
    { t: 2.24, push: 0, straw: 0, flash: 0, slide: 0, skin: null, daze: 0 },
  ],
};

// Quadratic Bezier evaluation & derivative
const bez = (p0, p1, p2, u) => {
  const m = 1 - u;
  return m * m * p0 + 2 * m * u * p1 + u * u * p2;
};
const dbez = (p0, p1, p2, u) => 2 * (1 - u) * (p1 - p0) + 2 * u * (p2 - p1);

// Build a curved blade from endpoints + explicit outward convex normal sign (up/outward from target)
function makeBlade({ x0, y0, x1, y1, bow, width, t0, sweepDur, holdDur, fadeDur, colossal = false, phase = 0 }) {
  const mx = (x0 + x1) * 0.5, my = (y0 + y1) * 0.5;
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const cx = mx + nx * bow * 2;
  const cy = my + ny * bow * 2;
  const bowSign = Math.sign(bow) || 1;
  const hitX = bez(x0, cx, x1, 0.58);
  const hitY = bez(y0, cy, y1, 0.58);
  const tdx = dbez(x0, cx, x1, 0.58), tdy = dbez(y0, cy, y1, 0.58);
  const tanAng = Math.atan2(tdy, tdx);
  return {
    x0, y0, cx, cy, x1, y1,
    bowSign, width, t0, sweepDur, holdDur, fadeDur,
    colossal, phase, hitX, hitY, tanAng,
    fired: false,
  };
}

// Analytically place a curved blade so B(uHit) passes EXACTLY through (ix, iy) with 0px offset!
function makeBladeThrough({ ix, iy, uHit, dx0, dy0, dx1, dy1, bow, width, t0, sweepDur, holdDur, fadeDur, phase = 0 }) {
  const raw = makeBlade({
    x0: ix + dx0, y0: iy + dy0,
    x1: ix + dx1, y1: iy + dy1,
    bow, width, t0, sweepDur, holdDur, fadeDur, colossal: true, phase,
  });
  const ox = ix - bez(raw.x0, raw.cx, raw.x1, uHit);
  const oy = iy - bez(raw.y0, raw.cy, raw.y1, uHit);
  return makeBlade({
    x0: raw.x0 + ox, y0: raw.y0 + oy,
    x1: raw.x1 + ox, y1: raw.y1 + oy,
    bow, width, t0, sweepDur, holdDur, fadeDur, colossal: true, phase,
  });
}

// Build a spherical-cage flurry blade around (cx, cy): orbits from ang0 -> ang1 bowing OUTWARD from center!
function makeCageBlade({ cx, cy, ang0, ang1, rx, ry, bowMag, width, t0, sweepDur, holdDur, fadeDur, phase }) {
  const x0 = cx + Math.cos(ang0) * rx;
  const y0 = clamp(cy + Math.sin(ang0) * ry, Y_MIN + 20, -3);
  const x1 = cx + Math.cos(ang1) * rx;
  const y1 = clamp(cy + Math.sin(ang1) * ry, Y_MIN + 20, -3);
  const mx = (x0 + x1) * 0.5, my = (y0 + y1) * 0.5;
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  // Choose sign of bow so the curve bends AWAY from (cx, cy), forming a true spherical cage around the target!
  const outDot = (mx - cx) * nx + (my - cy) * ny;
  const sign = outDot >= 0 ? 1 : -1;
  return makeBlade({ x0, y0, x1, y1, bow: sign * bowMag, width, t0, sweepDur, holdDur, fadeDur, phase });
}

// Track slid target X from act.hits slide values
function targetXAt(t) {
  const s1 = ease.outCubic(seg(t, T_LOCK, T_LOCK + 0.18));
  const s2 = ease.outCubic(seg(t, T_RUPTURE, T_RUPTURE + 0.20));
  const ret = ease.inOutQuad(seg(t, 2.08, 2.46));
  return TX + (12 * s1 + 4 * s2) * (1 - ret);
}

// Fast, sub-pixel smooth curved crescent blade renderer using closed-form polyline segment projection
const SEG_N = 28;
const _bx = new Float32Array(SEG_N + 1);
const _by = new Float32Array(SEG_N + 1);
const _vnx = new Float32Array(SEG_N + 1);
const _vny = new Float32Array(SEG_N + 1);
const _uv = new Float32Array(SEG_N + 1);
const _sdx = new Float32Array(SEG_N);
const _sdy = new Float32Array(SEG_N);
const _invL2 = new Float32Array(SEG_N);
const _sMinX = new Float32Array(SEG_N);
const _sMaxX = new Float32Array(SEG_N);
const _sMinY = new Float32Array(SEG_N);
const _sMaxY = new Float32Array(SEG_N);
const _actSeg = new Int32Array(SEG_N);

function drawCurvedBlade(p, b, localT, C, Sp, heroHot = 0) {
  const total = b.sweepDur + b.holdDur + b.fadeDur;
  if (localT <= 0 || localT >= total) return null;

  const uHead = ease.outQuart(clamp(0.18 + (localT / b.sweepDur) * 0.82, 0, 1));
  const tailK = seg(localT, b.sweepDur + b.holdDur * 0.25, total);
  const uTail = ease.inQuad(tailK) * 0.86;
  const span = uHead - uTail;
  if (span < 0.03) return null;

  const coolK = seg(localT, b.sweepDur + b.holdDur * 0.20, total);
  const flashK = Math.max(heroHot, 1 - seg(localT, 0, b.sweepDur + 0.028));
  const alpha = 1 - smooth(0.76, 1.0, coolK);
  if (alpha <= 0.02) return null;

  let minY = 1e9, maxY = -1e9;
  for (let i = 0; i <= SEG_N; i++) {
    const u = uTail + span * (i / SEG_N);
    const x = bez(b.x0, b.cx, b.x1, u);
    const y = bez(b.y0, b.cy, b.y1, u);
    const dx = dbez(b.x0, b.cx, b.x1, u);
    const dy = dbez(b.y0, b.cy, b.y1, u);
    const dL = Math.hypot(dx, dy) || 1;
    _bx[i] = x;
    _by[i] = y;
    _vnx[i] = (-dy / dL) * b.bowSign;
    _vny[i] = (dx / dL) * b.bowSign;
    _uv[i] = u;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const maxHw = b.width * (1 - coolK * 0.56);
  const pad = Math.ceil(maxHw + (b.colossal ? 5 : 3));
  for (let i = 0; i < SEG_N; i++) {
    const dx = _bx[i + 1] - _bx[i], dy = _by[i + 1] - _by[i];
    _sdx[i] = dx;
    _sdy[i] = dy;
    const l2 = dx * dx + dy * dy;
    _invL2[i] = l2 > 1e-5 ? 1 / l2 : 0;
    _sMinX[i] = (_bx[i] < _bx[i + 1] ? _bx[i] : _bx[i + 1]) - pad;
    _sMaxX[i] = (_bx[i] > _bx[i + 1] ? _bx[i] : _bx[i + 1]) + pad;
    _sMinY[i] = (_by[i] < _by[i + 1] ? _by[i] : _by[i + 1]) - pad;
    _sMaxY[i] = (_by[i] > _by[i + 1] ? _by[i] : _by[i + 1]) + pad;
  }

  const iy0 = Math.max(Y_MIN + 2, Math.floor(minY - pad));
  const iy1 = Math.min(b.colossal ? 4 : 2, Math.ceil(maxY + pad));

  for (let py = iy0; py <= iy1; py++) {
    let nAct = 0, rowMinX = 1e9, rowMaxX = -1e9;
    for (let i = 0; i < SEG_N; i++) {
      if (py >= _sMinY[i] && py <= _sMaxY[i]) {
        _actSeg[nAct++] = i;
        if (_sMinX[i] < rowMinX) rowMinX = _sMinX[i];
        if (_sMaxX[i] > rowMaxX) rowMaxX = _sMaxX[i];
      }
    }
    if (nAct === 0) continue;

    const ix0 = Math.max(X_MIN + 2, Math.floor(rowMinX));
    const ix1 = Math.min(X_MAX - 2, Math.ceil(rowMaxX));

    for (let px = ix0; px <= ix1; px++) {
      let bestD2 = 1e9, bestI = -1, bestT = 0, bestQx = 0, bestQy = 0;
      for (let k = 0; k < nAct; k++) {
        const i = _actSeg[k];
        if (px < _sMinX[i] || px > _sMaxX[i]) continue;
        const apx = px - _bx[i], apy = py - _by[i];
        let ts = (apx * _sdx[i] + apy * _sdy[i]) * _invL2[i];
        if (ts < 0) ts = 0;
        else if (ts > 1) ts = 1;
        const qx = _bx[i] + _sdx[i] * ts;
        const qy = _by[i] + _sdy[i] * ts;
        const dx = px - qx, dy = py - qy;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestI = i;
          bestT = ts;
          bestQx = qx;
          bestQy = qy;
        }
      }
      if (bestI < 0 || bestD2 > pad * pad) continue;

      const u = _uv[bestI] + (_uv[bestI + 1] - _uv[bestI]) * bestT;
      const v = clamp((u - uTail) / span, 0, 1);
      const env = Math.pow(Math.sin(PI * clamp(v, 0.001, 0.999)), b.colossal ? 0.48 : 0.54);
      const hw = maxHw * env;
      if (hw < 0.42) continue;

      let nx = _vnx[bestI] + (_vnx[bestI + 1] - _vnx[bestI]) * bestT;
      let ny = _vny[bestI] + (_vny[bestI + 1] - _vny[bestI]) * bestT;
      const nL = Math.hypot(nx, ny) || 1;
      nx /= nL; ny /= nL;

      const sd = (px - bestQx) * nx + (py - bestQy) * ny;
      const dist = Math.sqrt(bestD2);

      // Sleek outer sonic wind-filament on colossal blades & selected flurry whips
      if ((b.colossal || (b.phase > 3 && coolK < 0.35)) && coolK < 0.62 && v > 0.12 && v < 0.94) {
        const off = b.colossal ? 2.6 : 1.9;
        if (Math.abs(sd - (hw + off)) < 0.68) {
          p.px(px, py, heroHot > 0.4 ? WHITE : C[6], alpha * 0.9);
          continue;
        }
        if (b.colossal && coolK < 0.36 && Math.abs(sd + (hw * 0.85 + 2.3)) < 0.68 && v > 0.22 && v < 0.86) {
          p.px(px, py, heroHot > 0.4 ? Sp[5] : C[4], alpha * 0.75);
          continue;
        }
      }

      const innerLim = -hw * 0.88 * (1 - coolK * 0.62);
      const outerLim = hw * 0.86;
      if (dist > hw + 0.5 || sd < innerLim || sd > outerLim) continue;

      const q = clamp((sd - innerLim) / Math.max(0.35, outerLim - innerLim), 0, 1);
      const streak = Math.sin(v * 28 + b.phase) * 0.07;

      let col;
      if (heroHot > 0.65) {
        col = q > 0.30 ? WHITE : q > 0.12 ? Sp[6] : Sp[5];
      } else if (q > 0.77) {
        col = flashK > 0.22 ? WHITE : C[7];
      } else if (q + streak > 0.52) {
        col = flashK > 0.50 ? C[7] : C[6];
      } else if (q + streak > 0.28) {
        col = coolK < 0.42 ? C[5] : C[4];
      } else if (q > 0.12) {
        col = coolK < 0.48 ? C[3] : C[2];
      } else {
        col = C[1];
      }
      p.px(px, py, col, alpha);
    }
  }

  return {
    tipX: _bx[SEG_N],
    tipY: _by[SEG_N],
    tailX: _bx[0],
    tailY: _by[0],
    flashK,
  };
}

// Build a subtly bowed, jagged fracture arm matching the colossal blade curvature
function buildFissureArm(R, angle, length, bow, steps = 9) {
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const nx = -sin, ny = cos;
  const pts = [{ x: 0, y: 0, u: 0 }];
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    const curve = Math.sin(PI * u) * bow;
    const jag = i < steps ? R.range(-2.6, 2.6) * (1 - u * 0.35) : 0;
    pts.push({
      x: cos * length * u + nx * (curve + jag),
      y: sin * length * u + ny * (curve + jag),
      u,
    });
  }
  const branches = [];
  for (const frac of [0.22, 0.46, 0.70]) {
    const idx = Math.max(1, Math.min(steps - 1, Math.round(frac * steps)));
    const root = pts[idx];
    const side = R.chance(0.5) ? 1 : -1;
    const bAng = angle + side * R.range(0.45, 0.84);
    const bLen = length * R.range(0.19, 0.32);
    const midX = root.x + Math.cos(bAng) * bLen * 0.52 + R.range(-1.6, 1.6);
    const midY = root.y + Math.sin(bAng) * bLen * 0.52 + R.range(-1.6, 1.6);
    const endX = root.x + Math.cos(bAng + side * 0.15) * bLen;
    const endY = root.y + Math.sin(bAng + side * 0.15) * bLen;
    branches.push({ rootU: frac, x0: root.x, y0: root.y, x1: midX, y1: midY, x2: endX, y2: endY });
  }
  return { pts, branches, angle, length };
}

// Crisp rotated 4-point blade-glint star aligned with any slash angle
function bladeStar(p, x, y, L, ang, core, mid, rim, k = 1) {
  if (L < 1.5 || k <= 0.04) return;
  for (let arm = 0; arm < 4; arm++) {
    const a = ang + arm * (PI * 0.5);
    const len = arm % 2 === 0 ? L : L * 0.68;
    const ex = clamp(x + Math.cos(a) * len, X_MIN + 4, X_MAX - 4);
    const ey = clamp(y + Math.sin(a) * len, Y_MIN + 4, 3);
    p.line(x, y, ex, ey, rim, k * 0.85);
    p.line(x, y, lerp(x, ex, 0.65), lerp(y, ey, 0.65), mid, k);
    p.line(x, y, lerp(x, ex, 0.34), lerp(y, ey, 0.34), core, k);
  }
  p.glow(x, y, Math.min(20, 4 + L * 0.62), mid, 0.38 * k);
}

// Floor-clipped thin shock ring (never leaks below the stone floor y = 2!)
function stageShockRing(p, cx, cy, r, w, col, alpha) {
  if (r <= 1 || alpha <= 0.02) return;
  const steps = Math.max(36, Math.ceil(r * 2.4));
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * TAU, a1 = ((i + 1) / steps) * TAU;
    const y0 = cy + Math.sin(a0) * r, y1 = cy + Math.sin(a1) * r;
    if (y0 > 2 || y1 > 2) continue;
    const x0 = cx + Math.cos(a0) * r, x1 = cx + Math.cos(a1) * r;
    if (!inStage(x0, y0, 4) || !inStage(x1, y1, 4)) continue;
    p.line(x0, y0, x1, y1, col, alpha);
    if (w > 1.3) {
      const rIn = r - 1;
      p.line(cx + Math.cos(a0) * rIn, cy + Math.sin(a0) * rIn, cx + Math.cos(a1) * rIn, cy + Math.sin(a1) * rIn, col, alpha * 0.6);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8);
  const Sp = fit(o.sparks, 7);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, "#fffdf0", "#ffe96e", "#ffad28", "#ff6218"],
    haze: C[3],
  });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  // --- 11 Ultra-Fast 360-Degree Curved Blade Slashes (mixing outer cage arcs & deep cross-target razor cuts!) ---
  const cageSpecs = [
    // 1. Upper-left shoulder over-the-crown crescent
    { mode: "cage", ang0: -2.75, ang1: -0.30, rx: 58, ry: 45, bow: 18, w: 7.8 },
    // 2. Deep low-left -> high-right cross-body upward razor slash!
    { mode: "cut",  x0: TX - 64, y0: -6,  x1: TX + 64, y1: -66, bow: -15, w: 8.0 },
    // 3. Steep right-side vertical crescent (top-right -> bottom-right)
    { mode: "cage", ang0: -1.12, ang1:  0.96, rx: 54, ry: 46, bow: 19, w: 8.2 },
    // 4. Deep high-right -> low-left diagonal cleave through torso!
    { mode: "cut",  x0: TX + 62, y0: -78, x1: TX - 58, y1: -5,  bow: -16, w: 8.2 },
    // 5. High overhead halo-dome sweep (right -> left across sky above target)
    { mode: "cage", ang0: -0.20, ang1: -2.94, rx: 62, ry: 48, bow: 21, w: 8.4 },
    // 6. Steep left-side rising crescent (bottom-left -> top-left)
    { mode: "cage", ang0:  2.25, ang1:  4.38, rx: 56, ry: 46, bow: 19, w: 8.0 },
    // 7. Wide horizontal waist-level reverse whip (right -> left through target!)
    { mode: "cut",  x0: TX + 68, y0: -28, x1: TX - 66, y1: -40, bow:  14, w: 8.4 },
    // 8. Lower-right under-the-ribcage rising hook
    { mode: "cage", ang0:  0.38, ang1:  2.72, rx: 56, ry: 34, bow: 16, w: 8.2 },
    // 9. Deep upper-left -> bottom-right steep diagonal slice!
    { mode: "cut",  x0: TX - 52, y0: -86, x1: TX + 54, y1: -4,  bow:  17, w: 8.8 },
    // 10. Right-shoulder to upper-left crown reverse slice
    { mode: "cage", ang0:  0.15, ang1: -2.32, rx: 56, ry: 48, bow: 20, w: 8.8 },
    // 11. Climactic wide low-left -> upper-right setup whip!
    { mode: "cut",  x0: TX - 66, y0: -14, x1: TX + 68, y1: -56, bow:  18, w: 9.4 },
  ];
  const flurry = cageSpecs.map((s, idx) => {
    const timing = {
      t0: T_FLURRY + idx * 0.043,
      sweepDur: 0.038,
      holdDur: 0.020,
      fadeDur: 0.112,
      phase: idx * 1.3,
    };
    return s.mode === "cage"
      ? makeCageBlade({ cx: TX, cy: -38, ang0: s.ang0, ang1: s.ang1, rx: s.rx, ry: s.ry, bowMag: s.bow, width: s.w, ...timing })
      : makeBlade({ x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1, bow: s.bow, width: s.w, ...timing });
  });

  // Instantaneous long golden-white razor spark-streaks jetting outward past the blade cage
  const cutStreaks = [];

  // Perimeter shuttle streaks connecting consecutive flurry cuts
  const shuttles = flurry.slice(0, -1).map((b, idx) => {
    const next = flurry[idx + 1];
    return {
      x0: lerp(b.x1, TX, 0.14),
      y0: clamp(lerp(b.y1, -38, 0.14), Y_MIN + 18, -4),
      x1: lerp(next.x0, TX, 0.14),
      y1: clamp(lerp(next.y0, -38, 0.14), Y_MIN + 18, -4),
      t0: b.t0 + 0.024,
      dur: 0.062,
    };
  });

  // --- Two Colossal Curved Blades Analytically Locked to Intersect DEAD-CENTER at (IX, IY)! ---
  const IX = TX + 8;
  const IY = -36;
  // Colossal Blade 1: sweeping 236px slightly-tilted (-9 deg) horizontal crescent intersecting (IX, IY) at u = 0.50
  const crossH = makeBladeThrough({
    ix: IX, iy: IY, uHit: 0.50,
    dx0: -116, dy0: 20,
    dx1:  120, dy1: -18,
    bow: -20,
    width: 14.5,
    t0: T_CROSS1,
    sweepDur: 0.055,
    holdDur: 0.090,
    fadeDur: 0.300,
    phase: 0.5,
  });
  // Colossal Blade 2: towering 156px sky-to-earth (+81 deg) vertical crescent intersecting (IX, IY) at u = 0.72 and slamming into y = +4
  const crossV = makeBladeThrough({
    ix: IX, iy: IY, uHit: 0.72,
    dx0: -18, dy0: -112,
    dx1:  10, dy1: 40,
    bow: -18,
    width: 15.5,
    t0: T_CROSS2,
    sweepDur: 0.054,
    holdDur: 0.095,
    fadeDur: 0.315,
    phase: 2.1,
  });

  // --- Cross-Shaped Crack / Fissure Hit-Result Geometry (exact 180-deg colinear match to crossH & crossV!) ---
  const A_LEFT  = PI - 0.16;        // ~+171 deg (matches crossH left arm)
  const A_RIGHT = -0.16;            // ~-9 deg   (matches crossH right arm)
  const A_UP    = -PI * 0.5 - 0.16; // ~-99 deg  (matches crossV upper-left skyward arm!)
  const A_DOWN  =  PI * 0.5 - 0.16; // ~+81 deg  (matches crossV lower-right floor arm!)
  const crossArms = [
    buildFissureArm(R, A_LEFT,  66,  5.2, 9),
    buildFissureArm(R, A_RIGHT, 66, -5.2, 9),
    buildFissureArm(R, A_UP,    76, -5.0, 9),
    buildFissureArm(R, A_DOWN,  39,  2.8, 6),
  ];

  // Central spiderweb shatter cracks around the cross intersection
  const centerWeb = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * TAU + R.range(-0.18, 0.18);
    const r0 = R.range(4, 7), r1 = R.range(15, 25);
    const am = a + R.range(-0.25, 0.25);
    return {
      x0: Math.cos(a) * r0, y0: Math.sin(a) * r0,
      x1: Math.cos(am) * ((r0 + r1) * 0.5), y1: Math.sin(am) * ((r0 + r1) * 0.5),
      x2: Math.cos(a) * r1, y2: Math.sin(a) * r1,
    };
  });

  // Ground perspective cross-scar at floor impact point
  const groundScar = [
    buildFissureArm(R,  0.03, 54, 1.2, 6),
    buildFissureArm(R, PI - 0.03, 50, -1.2, 6),
    buildFissureArm(R, -0.52, 15, 0.6, 3),
    buildFissureArm(R,  2.62, 13, -0.6, 3),
  ];

  // Broken shockwave ring segments (all clipped cleanly above the floor!)
  const ringSegs1 = Array.from({ length: 8 }, (_, i) => ({
    a: (i / 8) * TAU + R.range(-0.12, 0.12),
    gap: R.range(0.45, 0.72),
    dr: R.range(0.18, 0.38),
  }));
  const ringSegs2 = Array.from({ length: 6 }, (_, i) => ({
    a: (i / 6) * TAU + R.range(-0.18, 0.18),
    gap: R.range(0.42, 0.68),
    dr: R.range(0.20, 0.42),
  }));

  // Opening blitz razor wind-lines from origin to target
  const blitzLines = Array.from({ length: 6 }, (_, i) => ({
    y: -38 + i * 5.2 + R.range(-1.2, 1.2),
    x0: R.range(-6, 18),
    x1: TX - R.range(4, 28),
    t0: i * 0.008,
    dur: R.range(0.085, 0.125),
    hot: i === 2 || i === 3,
  }));

  // Vacuum convergence motes during T_GATHER
  const gatherMotes = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * TAU + R.range(-0.14, 0.14);
    return { a, dist: R.range(38, 76), warm: i % 3 === 0 };
  });

  const keepStageAboveFloor = (cx, cy) =>
    cx >= X_MIN + 6 && cx <= X_MAX - 6 && cy >= Y_MIN + 6 && cy <= 2;

  let t = 0;
  let dashBurst = false;
  let h1Fired = false;
  let lockFired = false;
  let ruptureFired = false;
  let hissAcc = 0;

  return {
    update(dt) {
      t += dt;

      // 1. Opening blitz foot-dust & initial spark kick
      if (!dashBurst && t >= T_DASH + 0.01) {
        dashBurst = true;
        lights.add(18, -22, 42, C[5], 0.55, 0.16);
        for (let i = 0; i < 6; i++) {
          ps.spawn(P.SMOKE, R.range(-4, 16), -2, -R.range(24, 65), -R.range(6, 20), R.range(0.24, 0.42), C[2], R.range(3, 5));
        }
        for (let i = 0; i < 10; i++) {
          ps.spawn(P.SPARK, R.range(8, 34), -3, R.range(70, 175), -R.range(18, 65), R.range(0.12, 0.24));
        }
      }

      // 2. Eleven rapid flurry impacts: outward tangential spark rooster-tails + golden-white razor streaks!
      for (const b of flurry) {
        if (!b.fired && t >= b.t0 + b.sweepDur * 0.45) {
          b.fired = true;
          const ix = lerp(b.hitX, TX, 0.38);
          const iy = clamp(lerp(b.hitY, TY, 0.35), Y_MIN + 24, -6);
          lights.add(ix, iy, 46, Sp[5], 0.62, 0.10);

          // High-speed sparks shooting OUTWARD past the curved blade cage so golden sparks contrast cleanly against cyan arcs!
          for (let k = 0; k < 18; k++) {
            const side = (k & 1) ? 1 : -1;
            const spread = k < 12 ? R.range(-0.32, 0.32) : side * R.range(0.65, 1.35);
            const a = b.tanAng + spread;
            const sp = k < 12 ? R.range(190, 380) : R.range(120, 250);
            ps.spawn(P.SPARK, ix + R.range(-4, 4), iy + R.range(-4, 4), Math.cos(a) * sp, Math.sin(a) * sp - 14, R.range(0.16, 0.34));
          }
          for (let k = 0; k < 2; k++) {
            const a = b.tanAng + R.range(-0.5, 0.5), sp = R.range(95, 185);
            bits.add({
              kind: B.SHARD,
              x: ix, y: iy,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 25,
              a, va: R.range(-18, 18),
              s: R.range(2.4, 4.0), c: k === 0 ? Sp[5] : C[5],
              bounce: 0.35, life: R.range(0.18, 0.30),
            });
          }
          // Long golden-white razor spark-streaks jetting cleanly beyond the crescent rim
          for (let k = 0; k < 5; k++) {
            const a = b.tanAng + R.range(-0.42, 0.42);
            cutStreaks.push({
              x: ix + R.range(-4, 4),
              y: iy + R.range(-4, 4),
              vx: Math.cos(a) * R.range(230, 410),
              vy: Math.sin(a) * R.range(230, 410),
              len: R.range(12, 22),
              t0: t,
              dur: R.range(0.075, 0.125),
              warm: k < 4,
            });
          }
        }
      }

      // 3. Colossal horizontal blade bite
      if (!h1Fired && t >= T_CROSS1 + 0.025) {
        h1Fired = true;
        lights.add(IX, IY, 72, C[5], 0.80, 0.22);
        for (let k = 0; k < 28; k++) {
          const a = A_RIGHT + (R.chance(0.35) ? PI : 0) + R.range(-0.32, 0.32);
          const sp = R.range(160, 350);
          ps.spawn(P.SPARK, IX + R.range(-18, 18), IY + R.range(-6, 6), Math.cos(a) * sp, Math.sin(a) * sp - 15, R.range(0.18, 0.42));
        }
      }

      // 4. Colossal Cross-Lock Detonation (T_LOCK)
      if (!lockFired && t >= T_LOCK) {
        lockFired = true;
        const hx = targetXAt(T_LOCK);
        lights.add(hx, IY, 92, Sp[5], 1.0, 0.42);
        lights.add(hx, IY, 64, C[5], 0.85, 0.60);

        // 4 high-velocity spark jets blasting straight along the 4 cross arms
        const armAngles = [A_LEFT, A_RIGHT, A_UP, A_DOWN];
        for (let arm = 0; arm < 4; arm++) {
          const baseA = armAngles[arm];
          for (let k = 0; k < 18; k++) {
            const a = baseA + R.range(-0.18, 0.18);
            const sp = R.range(165, 395);
            let vx = Math.cos(a) * sp;
            let vy = Math.sin(a) * sp;
            if (arm === 3) vy = -Math.abs(vy) * 0.55 - R.range(30, 105);
            ps.spawn(P.SPARK, hx + R.range(-4, 4), IY + R.range(-4, 4), vx, vy, R.range(0.24, 0.60));
          }
        }
        // 4 quadrant radial spark spray + cleaved armor/crystal shards
        for (let k = 0; k < 30; k++) {
          const a = R.range(0, TAU), sp = R.range(105, 265);
          ps.spawn(P.SPARK, hx, IY, Math.cos(a) * sp, Math.sin(a) * sp - 24, R.range(0.22, 0.52));
        }
        for (let k = 0; k < 14; k++) {
          const a = (Math.floor(k % 4) + 0.5) * (PI * 0.5) + R.range(-0.35, 0.35);
          const sp = R.range(80, 195);
          bits.add({
            kind: k % 3 === 0 ? B.CHUNK : B.SHARD,
            x: hx + R.range(-6, 6), y: IY + R.range(-8, 8),
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 35,
            a: R.range(0, TAU), va: R.range(-16, 16),
            s: k % 3 === 0 ? R.range(1.6, 2.5) : R.range(2.8, 4.6),
            c: k % 2 === 0 ? C[5] : Sp[5],
            ramp: [C[0], C[2], C[4], C[6], WHITE],
            bounce: 0.42,
            life: R.range(0.34, 0.72),
          });
        }
        // Floor impact spark fountain & stone chips where vertical blade cleaves the ground
        for (let k = 0; k < 28; k++) {
          const side = (k & 1) ? 1 : -1;
          ps.spawn(P.SPARK, hx + 6 + R.range(-8, 8), -2, side * R.range(75, 260), -R.range(55, 195), R.range(0.26, 0.62));
        }
        for (let k = 0; k < 10; k++) {
          const side = (k & 1) ? 1 : -1;
          bits.add({
            kind: B.CHUNK,
            x: hx + 6 + R.range(-10, 10), y: -2,
            vx: side * R.range(38, 125), vy: -R.range(55, 135),
            a: R.range(0, TAU), va: R.range(-14, 14),
            s: R.range(1.5, 2.6),
            ramp: [C[0], C[1], C[3], C[5], C[7]],
            bounce: 0.45,
            life: R.range(0.45, 0.88),
          });
        }
      }

      // 5. Tension spark hiss while cross-scar is locked before rupture
      if (t > T_LOCK + 0.08 && t < T_RUPTURE) {
        hissAcc += dt * 45;
        const hx = targetXAt(t);
        while (hissAcc >= 1) {
          hissAcc -= 1;
          const arm = crossArms[R.int(0, 3)];
          const pt = arm.pts[R.int(1, arm.pts.length - 2)];
          ps.spawn(P.SPARK, hx + pt.x, clamp(IY + pt.y, Y_MIN + 14, -2), R.range(-65, 65), -R.range(20, 85), R.range(0.12, 0.25));
        }
      }

      // 6. Delayed Cross-Fissure Rupture Eruption (T_RUPTURE)
      if (!ruptureFired && t >= T_RUPTURE) {
        ruptureFired = true;
        const hx = targetXAt(T_RUPTURE);
        lights.add(hx, IY, 88, Sp[4], 0.95, 0.52);
        lights.add(hx, IY, 62, C[5], 0.75, 0.88);

        for (const arm of crossArms) {
          for (let k = 0; k < 13; k++) {
            const pt = arm.pts[R.int(1, arm.pts.length - 1)];
            const perp = arm.angle + (R.chance(0.5) ? 1 : -1) * R.range(0.35, 1.25);
            const sp = R.range(95, 250);
            ps.spawn(
              P.SPARK,
              hx + pt.x,
              clamp(IY + pt.y, Y_MIN + 14, -2),
              Math.cos(perp) * sp,
              Math.sin(perp) * sp - 26,
              R.range(0.22, 0.56)
            );
          }
        }
        for (let k = 0; k < 16; k++) {
          ps.spawn(P.EMBER, hx + R.range(-26, 26), IY + R.range(-26, 18), R.range(-32, 32), -R.range(24, 68), R.range(0.55, 1.05), k % 2 ? Sp[5] : C[5], 2);
        }
        for (let k = 0; k < 12; k++) {
          const a = (Math.floor(k % 4) + 0.5) * (PI * 0.5) + R.range(-0.32, 0.32);
          const sp = R.range(65, 165);
          bits.add({
            kind: k % 3 === 0 ? B.CHUNK : B.SHARD,
            x: hx + R.range(-8, 8), y: IY + R.range(-10, 8),
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
            a: R.range(0, TAU), va: R.range(-18, 18),
            s: k % 3 === 0 ? R.range(1.5, 2.3) : R.range(2.6, 4.4),
            c: k % 2 ? Sp[5] : C[5],
            ramp: [Sp[0], Sp[2], Sp[4], Sp[6], WHITE],
            bounce: 0.4, life: R.range(0.35, 0.72),
          });
        }
        for (let i = 0; i < 10; i++) {
          const side = (i & 1) ? 1 : -1;
          ps.spawn(P.SMOKE, hx + side * R.range(4, 24), -3, side * R.range(18, 56), -R.range(8, 24), R.range(0.60, 1.08), C[2], R.range(4, 7), 0, PF.BIG);
        }
      }

      ps.update(dt);
      bits.update(dt);
      lights.update(dt);

      // Clip active particles strictly inside stage bounds & clear cleanly before T_END
      const endFade = t >= T_END - 0.04;
      for (const list of [ps.list, bits.list]) {
        for (let i = list.length - 1; i >= 0; i--) {
          const q = list[i];
          if (endFade || !inStage(q.x, q.y, 8)) list.splice(i, 1);
        }
      }
      if (endFade) lights.list.length = 0;
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;
      const hx = targetXAt(t) + 8;

      // Opening supersonic blitz wind-streaks from origin to target
      if (t >= T_DASH && t < 0.15) {
        for (const sl of blitzLines) {
          const u = (t - sl.t0) / sl.dur;
          if (u <= 0 || u >= 1) continue;
          const head = lerp(sl.x0, sl.x1, ease.outQuart(clamp(u * 1.35, 0, 1)));
          const tail = lerp(sl.x0, sl.x1, ease.inQuad(clamp((u - 0.18) / 0.82, 0, 1)));
          if (head - tail > 2) {
            const al = (1 - u) * (sl.hot ? 0.95 : 0.65);
            if (sl.hot) p.line(tail, sl.y - 1, head, sl.y - 1, C[3], al * 0.6);
            p.line(tail, sl.y, head, sl.y, sl.hot ? WHITE : C[5], al);
          }
        }
      }

      // Ground perspective shock-ring & cleaved floor cross-scar at floor impact point
      if (t >= T_LOCK && t < T_LOCK + 0.28) {
        const u = (t - T_LOCK) / 0.28;
        band(p, hx + 4, 0, 14 + 54 * ease.outQuart(u), 0.16, 3.2 * (1 - u * 0.65), (1 - u) * 0.85, [C[2], C[4], Sp[5], WHITE], (g) => Math.sin(g) < 0, u < 0.35);
      }

      if (t >= T_LOCK && t < T_SEAL) {
        const lt = t - T_LOCK;
        const k = lt / (T_SEAL - T_LOCK);
        const seal = 1 - smooth(0.76, 1.0, k);
        const hot = lt < 0.16 || (t >= T_RUPTURE && t < T_RUPTURE + 0.18);
        const rimCol = hot ? Sp[6] : k < 0.50 ? Sp[4] : C[4];
        const coreCol = hot ? WHITE : k < 0.45 ? Sp[5] : C[0];
        const gx = hx + 4;

        p.ellipse(gx, 1, 42 * seal, 2.5 * seal, C[0], 0.65 * seal);
        for (const gArm of groundScar) {
          const maxIdx = Math.max(1, Math.ceil((gArm.pts.length - 1) * seal));
          for (let i = 1; i <= maxIdx; i++) {
            const p0 = gArm.pts[i - 1], p1 = gArm.pts[i];
            const ax = gx + p0.x, ay = clamp(1 + p0.y * 0.25, -3, 5);
            const bx = gx + p1.x, by = clamp(1 + p1.y * 0.25, -3, 5);
            p.line(ax, ay - 1, bx, by - 1, rimCol, 0.75 * seal);
            p.line(ax, ay + 1, bx, by + 1, C[1], 0.80 * seal);
            p.line(ax, ay, bx, by, coreCol, 0.95 * seal);
          }
        }
      }

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;
      // Exact cross center tracks the slid target (at T_LOCK slide=0 => hx = TX + 8 === IX!)
      const hx = targetXAt(t) + 8;

      // 1. Perimeter high-speed shuttle streaks connecting consecutive flurry cuts
      for (const sh of shuttles) {
        const u = (t - sh.t0) / sh.dur;
        if (u <= 0 || u >= 1) continue;
        const head = ease.outCubic(clamp(u * 1.4, 0, 1));
        const tail = ease.inQuad(clamp((u - 0.22) / 0.78, 0, 1));
        const ax = lerp(sh.x0, sh.x1, tail), ay = lerp(sh.y0, sh.y1, tail);
        const bx = lerp(sh.x0, sh.x1, head), by = lerp(sh.y0, sh.y1, head);
        p.line(ax, ay - 1, bx, by - 1, C[3], (1 - u) * 0.55);
        p.line(ax, ay, bx, by, u < 0.45 ? WHITE : C[5], (1 - u) * 0.90);
      }

      // 2. Eleven Rapid 360-Deg Curved Blade Slashes + Lingering 1px Razor Cut-Threads + Outward Golden Spark-Streaks
      for (const b of flurry) {
        const lt = t - b.t0;
        // Hair-thin glowing curved cut-thread lingering briefly after each slash for Mach-speed cutting feel!
        if (lt > 0.045 && lt < 0.215) {
          const threadU = (lt - 0.045) / 0.170;
          const al = (1 - threadU) * 0.72;
          const col = threadU < 0.35 ? C[7] : C[5];
          let px0 = bez(b.x0, b.cx, b.x1, 0.12), py0 = clamp(bez(b.y0, b.cy, b.y1, 0.12), Y_MIN + 8, 1);
          for (let s = 1; s <= 10; s++) {
            const uu = 0.12 + (s / 10) * 0.78;
            const px1 = bez(b.x0, b.cx, b.x1, uu), py1 = clamp(bez(b.y0, b.cy, b.y1, uu), Y_MIN + 8, 1);
            p.line(px0, py0, px1, py1, col, al);
            px0 = px1; py0 = py1;
          }
        }
        const info = drawCurvedBlade(p, b, lt, C, Sp, 0);
        if (info && info.flashK > 0.15) {
          if (inStage(info.tipX, info.tipY, 10)) {
            sparkle(p, info.tipX, info.tipY, 5 + 4 * info.flashK, WHITE, C[5], 0.55);
          }
          if (lt > 0.010 && lt < 0.056) {
            const ix = lerp(b.hitX, TX, 0.38);
            const iy = clamp(lerp(b.hitY, TY, 0.35), Y_MIN + 24, -6);
            bladeStar(p, ix, iy, 11 * info.flashK, b.tanAng, WHITE, Sp[6], Sp[4], info.flashK);
          }
        }
      }

      for (const cs of cutStreaks) {
        const u = (t - cs.t0) / cs.dur;
        if (u <= 0 || u >= 1) continue;
        const dtS = t - cs.t0;
        const x1 = cs.x + cs.vx * dtS;
        let y1 = cs.y + cs.vy * dtS + 140 * dtS * dtS;
        if (y1 > -1) y1 = -1 - (y1 + 1) * 0.45; // crisp floor ricochet!
        const spd = Math.hypot(cs.vx, cs.vy) || 1;
        const len = cs.len * (1 - u * 0.55);
        const x0 = x1 - (cs.vx / spd) * len;
        const y0 = clamp(y1 - (cs.vy / spd) * len, Y_MIN + 8, 1);
        if (inStage(x1, y1, 8) && inStage(x0, y0, 8)) {
          const cSpark = u < 0.40 ? WHITE : cs.warm ? Sp[5] : C[5];
          p.line(x0, y0, x1, y1, cSpark, 1 - u * 0.72);
          if (u < 0.65) {
            p.px(Math.round(x1), Math.round(y1), WHITE);
            p.glow(x1, y1, 4, cs.warm ? Sp[5] : C[5], 0.35 * (1 - u));
          }
        }
      }

      // 3. Gather Beat (T_GATHER..T_CROSS1): Twin-Blade X-Charge Glint + Vacuum Inward Motes
      if (t >= T_GATHER && t < T_CROSS1 + 0.04) {
        const u = seg(t, T_GATHER, T_CROSS1 + 0.02);
        const gx = TX - 44, gy = -34;
        const r = Math.sin(PI * u);
        flare(p, gx, gy, 17 * r, r, [C[2], C[4], C[6], WHITE]);
        bladeStar(p, gx, gy, 14 * r, 0.68, WHITE, Sp[6], Sp[4], r);
        ringLight(p, IX, IY, 52 * (1 - u * 0.78), 7, C[5], 0.38 * r, keepStageAboveFloor);

        for (const m of gatherMotes) {
          const d = m.dist * (1 - ease.inQuad(u) * 0.86);
          const d2 = d + 9 * (1 - u);
          const x0 = IX + Math.cos(m.a) * d2, y0 = clamp(IY + Math.sin(m.a) * d2 * 0.72, Y_MIN + 14, -3);
          const x1 = IX + Math.cos(m.a) * d,  y1 = clamp(IY + Math.sin(m.a) * d * 0.72,  Y_MIN + 14, -3);
          p.line(x0, y0, x1, y1, m.warm ? Sp[5] : C[6], 0.82 * r);
        }
      }

      // 4. Cross-Shaped Crack / Fissure Hit-Result VFX ("受击后的十字形裂痕特效")
      if (t >= T_LOCK && t < T_SEAL) {
        const isRuptured = t >= T_RUPTURE;
        const rupU = isRuptured ? seg(t, T_RUPTURE, T_SEAL) : 0;
        const seal = isRuptured ? 1 - smooth(0.68, 1.0, rupU) : 1;

        const jitX = !isRuptured ? Math.sin(t * 95) * 1.1 * seg(t, T_LOCK + 0.10, T_RUPTURE) : 0;
        const jitY = !isRuptured ? Math.cos(t * 113) * 0.9 * seg(t, T_LOCK + 0.10, T_RUPTURE) : 0;
        const cx = hx + jitX, cy = IY + jitY;

        const ruptureFlash = isRuptured ? 1 - seg(t, T_RUPTURE, T_RUPTURE + 0.15) : 1 - seg(t, T_LOCK, T_LOCK + 0.13);
        const coolPhase = isRuptured ? smooth(0.32, 0.62, rupU) : 0;
        const glowCol = ruptureFlash > 0.45 ? Sp[6] : coolPhase < 0.5 ? Sp[4] : C[4];
        const lipCol  = ruptureFlash > 0.35 ? WHITE : coolPhase < 0.5 ? Sp[5] : C[6];

        const chasmW = isRuptured
          ? 2.7 * ease.outBack(clamp((t - T_RUPTURE) / 0.09, 0, 1)) * seal
          : 1.0;

        // Central spiderweb fracture cracks around intersection
        if (seal > 0.25) {
          const webAl = seal * (isRuptured ? 0.88 : 0.55);
          for (const w of centerWeb) {
            p.line(cx + w.x0, clamp(cy + w.y0, Y_MIN + 8, 3), cx + w.x1, clamp(cy + w.y1, Y_MIN + 8, 3), glowCol, webAl);
            if (isRuptured) {
              p.line(cx + w.x1, clamp(cy + w.y1, Y_MIN + 8, 3), cx + w.x2 * seal, clamp(cy + w.y2 * seal, Y_MIN + 8, 3), lipCol, webAl * 0.8);
            }
          }
        }

        // Layer A: Outer scorched aura + glowing jagged fracture lips + secondary fracture branches
        for (const arm of crossArms) {
          const pts = arm.pts;
          const maxI = Math.max(1, Math.ceil((pts.length - 1) * seal));
          const pnx = -Math.sin(arm.angle), pny = Math.cos(arm.angle);

          for (let i = 1; i <= maxI; i++) {
            const p0 = pts[i - 1], p1 = pts[i];
            const taper = 1 - p0.u * 0.72;
            const w = Math.max(0.7, chasmW * taper);
            const ax = cx + p0.x, ay = clamp(cy + p0.y, Y_MIN + 6, 4);
            const bx = cx + p1.x, by = clamp(cy + p1.y, Y_MIN + 6, 4);

            p.line(ax + pnx * (w + 1.3), ay + pny * (w + 1.3), bx + pnx * (w + 1.3), by + pny * (w + 1.3), glowCol, 0.74 * seal);
            p.line(ax - pnx * (w + 1.3), ay - pny * (w + 1.3), bx - pnx * (w + 1.3), by - pny * (w + 1.3), glowCol, 0.74 * seal);
            p.line(ax + pnx * w, ay + pny * w, bx + pnx * w, by + pny * w, lipCol, 0.96 * seal);
            p.line(ax - pnx * w, ay - pny * w, bx - pnx * w, by - pny * w, lipCol, 0.96 * seal);
          }

          for (const br of arm.branches) {
            if (br.rootU > seal * 0.92) continue;
            const bAl = (isRuptured ? 0.92 : 0.62) * seal;
            p.line(cx + br.x0, clamp(cy + br.y0, Y_MIN + 6, 4), cx + br.x1, clamp(cy + br.y1, Y_MIN + 6, 4), lipCol, bAl);
            p.line(cx + br.x1, clamp(cy + br.y1, Y_MIN + 6, 4), cx + br.x2, clamp(cy + br.y2, Y_MIN + 6, 4), glowCol, bAl * 0.8);
          }
        }

        // Layer B: Deep void-black cleaved chasm interior (narrows into a bright crystalline seam as it zips shut!)
        const closingZip = isRuptured && rupU > 0.72;
        for (const arm of crossArms) {
          const pts = arm.pts;
          const maxI = Math.max(1, Math.ceil((pts.length - 1) * seal));
          const pnx = -Math.sin(arm.angle), pny = Math.cos(arm.angle);
          for (let i = 1; i <= maxI; i++) {
            const p0 = pts[i - 1], p1 = pts[i];
            const ax = cx + p0.x, ay = clamp(cy + p0.y, Y_MIN + 6, 4);
            const bx = cx + p1.x, by = clamp(cy + p1.y, Y_MIN + 6, 4);
            const coreCol = ruptureFlash > 0.62 || closingZip ? WHITE : C[0];
            p.line(ax, ay, bx, by, coreCol, closingZip ? seal : 0.98 * seal);
            if (!closingZip && isRuptured && p0.u < 0.56 && chasmW > 1.3 && ruptureFlash <= 0.62) {
              p.line(ax + pnx * 0.85, ay + pny * 0.85, bx + pnx * 0.85, by + pny * 0.85, C[0], 0.95 * seal);
              p.line(ax - pnx * 0.85, ay - pny * 0.85, bx - pnx * 0.85, by - pny * 0.85, C[0], 0.95 * seal);
            }
          }
        }
        // Sharp dark cleaved cross-heart diamond at the intersection, snapping into a bright star as it seals!
        if (closingZip) {
          sparkle(p, cx, cy, 8 * seal, WHITE, C[5], 0.65 * seal);
        } else if (isRuptured && ruptureFlash <= 0.62 && seal > 0.28) {
          p.circle(cx, cy, 2.6 * seal, C[0], 1);
        }

        if (ruptureFlash > 0.12) {
          bladeStar(p, cx, cy, 26 * ruptureFlash, A_RIGHT, WHITE, Sp[6], Sp[4], ruptureFlash);
          flare(p, cx, cy, 15 * ruptureFlash, ruptureFlash, [C[2], C[4], C[6], WHITE]);
        }
      }

      // 5. Two Colossal Intersecting Curved Cross Blades + Curved Bisecting Cleave Flash
      const heroHot = t >= T_LOCK && t < T_LOCK + 0.068 ? 1 : 0;
      const hInfo = drawCurvedBlade(p, crossH, t - crossH.t0, C, Sp, heroHot);
      const vInfo = drawCurvedBlade(p, crossV, t - crossV.t0, C, Sp, heroHot);

      // Curved bisecting razor-flash right along crossH & crossV spines on T_LOCK (zero straight-line divergence!)
      if (t >= T_LOCK && t < T_LOCK + 0.10) {
        const k = 1 - (t - T_LOCK) / 0.10;
        for (const cb of [crossH, crossV]) {
          let px0 = bez(cb.x0, cb.cx, cb.x1, 0), py0 = clamp(bez(cb.y0, cb.cy, cb.y1, 0), Y_MIN + 6, 3);
          for (let s = 1; s <= 12; s++) {
            const uu = s / 12;
            const px1 = bez(cb.x0, cb.cx, cb.x1, uu), py1 = clamp(bez(cb.y0, cb.cy, cb.y1, uu), Y_MIN + 6, 3);
            p.line(px0, py0, px1, py1, WHITE, k);
            px0 = px1; py0 = py1;
          }
        }
        // Floor-cleave V-ricochet spark streaks shooting up off (hx + 5, 0)!
        const vLen = 34 * (1 - k * 0.4);
        p.line(hx + 5, 0, hx + 5 - vLen, -vLen * 0.62, WHITE, k);
        p.line(hx + 5, 0, hx + 5 + vLen, -vLen * 0.58, Sp[6], k);
      }

      if (hInfo && hInfo.flashK > 0.2 && inStage(hInfo.tipX, hInfo.tipY, 10)) {
        flare(p, hInfo.tipX, hInfo.tipY, 11 * hInfo.flashK, hInfo.flashK, [C[2], C[4], C[6], WHITE]);
      }
      if (vInfo && vInfo.flashK > 0.2 && inStage(vInfo.tipX, vInfo.tipY, 10)) {
        flare(p, vInfo.tipX, clamp(vInfo.tipY, Y_MIN + 12, 2), 12 * vInfo.flashK, vInfo.flashK, [Sp[2], Sp[4], Sp[6], WHITE]);
      }

      // Monumental cross-intersection flash & floor-clipped expanding shockwave rings at T_LOCK
      if (t >= T_LOCK && t < T_LOCK + 0.30) {
        const u = (t - T_LOCK) / 0.30;
        const r = 14 + 62 * ease.outQuart(u);
        stageShockRing(p, hx, IY, r * 0.84, 2.0 * (1 - u * 0.6), C[6], (1 - u) * 0.76);
        brokenRing(p, hx, IY, r, 3.4 * (1 - u * 0.75), ringSegs1, u * 0.85, Sp[5], C[5], 1 - u, 0.92, 2);
        ringLight(p, hx, IY, r, 9, Sp[5], (1 - u) * 0.62, keepStageAboveFloor);

        // Near-half of ground dust shock-ring in front of target
        if (u < 0.92) {
          band(p, hx + 4, 0, 14 + 54 * ease.outQuart(u), 0.16, 3.2 * (1 - u * 0.65), (1 - u) * 0.90, [C[2], C[4], Sp[5], WHITE], (g) => Math.sin(g) >= 0, u < 0.35);
        }

        if (u < 0.36) {
          const fk = 1 - u / 0.36;
          bladeStar(p, hx, IY, 34 * fk, A_RIGHT, WHITE, Sp[6], Sp[4], fk);
          flare(p, hx, IY, 20 * fk, fk, [C[2], C[4], C[6], WHITE]);
        }
      }

      // Secondary shockwave ring + 4-quadrant cleave arcs when the cross-fissure violently ruptures at T_RUPTURE!
      if (t >= T_RUPTURE && t < T_RUPTURE + 0.26) {
        const u = (t - T_RUPTURE) / 0.26;
        const r = 12 + 52 * ease.outCubic(u);
        brokenRing(p, hx, IY, r, 2.8 * (1 - u * 0.7), ringSegs2, -u * 1.1, Sp[5], Sp[3], 1 - u, 0.88, 2);
        ringLight(p, hx, IY, r, 8, Sp[4], (1 - u) * 0.52, keepStageAboveFloor);

        // 4 quadrant outward-flying cleave shock-crescents ("劈开" into 4 quarters!)
        if (u < 0.75) {
          const qu = u / 0.75;
          const qr = 16 + 44 * ease.outQuart(qu);
          for (let q = 0; q < 4; q++) {
            const midA = A_RIGHT + (q + 0.5) * (PI * 0.5);
            if (IY + Math.sin(midA) * qr > 1) continue;
            p.arc(hx, IY, qr, 3.2 * (1 - qu), midA - 0.36, midA + 0.36, qu < 0.35 ? WHITE : Sp[5], (1 - qu) * 0.88);
          }
        }
      }

      bits.draw(p);
      ps.draw(p, "front");
      lights.draw(p);

      // Carve the pitch-black abyssal cleaved interior of the cross-fissure through additive light!
      if (t >= T_RUPTURE + 0.08 && t < T_SEAL - 0.12) {
        const rupU = seg(t, T_RUPTURE, T_SEAL);
        const seal = 1 - smooth(0.68, 1.0, rupU);
        if (seal > 0.22) {
          const c0 = C[0];
          unlight(
            p,
            Math.max(X_MIN + 4, Math.floor(hx - 70 * seal)),
            Math.max(Y_MIN + 4, Math.floor(IY - 76 * seal)),
            Math.min(X_MAX - 4, Math.ceil(hx + 70 * seal)),
            Math.min(6, Math.ceil(IY + 42 * seal)),
            (x, y) => {
              const sx = p.cellX(x, y) - p.ox, sy = p.cellY(x, y) - p.oy;
              return sx >= 0 && sy >= 0 && sx < p.w && sy < p.h && p.C[sy * p.w + sx] === c0;
            },
            0.08
          );
        }
      }
    },
  };
}
