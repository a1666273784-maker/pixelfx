// Sword Array Ward ("moves/sword-array-ward" — 【剑阵护体】):
// 1. Spirit Swords Materialize Around the Body (0.00..0.68s): The martial artist forms a sword-finger seal as an
//    Eight-Trigram sigil unfolds underfoot; 8 luminous jade-cyan & gold Spirit Swords ("浮现数把发光飞剑") materialize
//    in symmetric pairs around the character's body, linked by glowing sword-qi threads.
// 2. High-Speed Rotation & Circular Sword-Light Barrier (0.68..1.30s): All 8 Spirit Swords pivot tangent to the circle
//    and accelerate into a blinding high-speed whirl ("围绕角色高速旋转形成一道圆形剑光屏障"), weaving a razor-sharp
//    360-degree Circular Sword-Light Barrier and a tilted equatorial blade-ring around the defender.
// 3. Fierce Sword-Clash Parries & Crisp Spark Deflection (1.30..2.76s): Three fierce enemy strikes (crimson-gold spear
//    lance, blood twin-slash, and colossal greatsword wave) slam into the barrier at 1.34s, 1.78s, and 2.22s;
//    intercepting Spirit Swords snap into crossed X-parries ("凌厉格挡感") at the impact point, erupting in crisp
//    white-gold & amber metallic clash sparks ("受击时飞剑碰撞发出清脆火花的反馈特效"), ricochet needles, and shock arcs.
// 4. Sword-Array Counter-Pulse & Skyward Sword-Light Sublimation (2.76..3.75s): The barrier unleashes a 360-degree
//    repelling sword-qi wave, and all 8 Spirit Swords decelerate, salute skyward around the hero, and ascend as sleek
//    streams of starlight by 3.75s with zero dither or dark-pixel artifacts.
// Impact starburst and glancing sparks build on Sprite Fusion's open-source slash and shield VFX
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
import { ringLight } from "../shadow/_lib.js";

const CY = -36;                // Center Y of the Circular Sword-Light Barrier (sits cleanly above floor y=0)
const R_BARRIER = 36;          // Radius of the Circular Sword-Light Barrier (spans y in [-72..0])
const N_SWORDS = 8;            // 8 Luminous Spirit Swords ("八柄护体灵剑")
const SY_FLOOR = 0.22;         // Floor perspective squash

// Choreography timing constants (seconds)
const T_SUMMON_END = 0.64;     // All 8 Spirit Swords materialized in circular halo around the body
const T_SPIN = 0.68;           // Spirit Swords pivot tangent & accelerate into high-speed rotation
const T_FORMED = 1.02;         // High-speed rotation fuses into the full Circular Sword-Light Barrier
const T_HIT1 = 1.34;           // 1st incoming strike (Crimson-Gold Spear Lance) parried with crisp sparks
const T_HIT2 = 1.78;           // 2nd incoming strike (Fast Lower Twin-Slash) parried with crisp sparks
const T_HIT3 = 2.22;           // 3rd incoming strike (Colossal Crimson-Gold Greatsword Wave) parried with heavy clash
const T_PULSE = 2.78;          // 360-degree Sword-Array Counter-Pulse shockwave
const T_DISSOLVE = 3.22;       // Spirit Swords ascend and sublimate into sleek beams of starlight
const T_END = 3.75;

const STRIKES = [
  { t: T_HIT1, ang: -0.16, sx: 146, sy: -46, aim: -0.22, kind: "spear", scale: 1.0 },
  { t: T_HIT2, ang: 0.30, sx: 144, sy: -12, aim: 0.26, kind: "slash", scale: 1.05 },
  { t: T_HIT3, ang: -0.04, sx: 148, sy: -38, aim: -0.10, kind: "greatsword", scale: 1.42 },
].map((s) => ({
  ...s,
  hx: Math.round(Math.cos(s.ang) * R_BARRIER),
  hy: Math.round(CY + Math.sin(s.ang) * R_BARRIER),
}));

export const meta = {
  name: "Sword array ward",
  desc: "Eight glowing spirit swords emerge around the hero and whirl into a circular blade-light barrier, parrying fierce strikes in showers of crisp metallic sparks.",
  tags: ["move", "shield", "ward", "barrier", "defense", "sword", "parry", "block", "wuxia", "one-shot"],
  size: [316, 196],
  origin: [124, 160],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    // 8-step Celestial Jade-Cyan & Silver Sword-Light ramp ("青霜剑气与银白剑光")
    palette: ["#10283b", "#183e59", "#246082", "#3594bd", "#5ad0f0", "#9cf0ff", "#dffbff", "#ffffff"],
    // 6-step Imperial Gold Hilt & Bagua Seal ramp ("鎏金剑格与八卦阵纹")
    gold: ["#4a2a0a", "#7d4912", "#b87018", "#eba228", "#ffda58", "#fff7c4"],
    // 5-step Crisp Metallic Forge-Spark ramp ("清脆金铁交鸣火花")
    sparks: ["#ffffff", "#fff8bd", "#ffd858", "#ff9830", "#ff6020"],
    // 5-step Incoming Enemy Blood-Crimson Strike ramp ("来袭血煞兵刃")
    strike: ["#4a0b12", "#881420", "#d42430", "#ff6242", "#ffdcbf"],
    seed: 17,
  },
};

// Wuxia Sword-Master defensive stances (all hands strictly within natural 14px shoulder reach of pose.x)
const GUARD = { ...READY, x: 0, crouch: 2, lean: 1, fx: 10, fy: -22, bx: -6, by: -20, ffx: 7, fbx: -7 };
const SUMMON_SEAL = { ...GUARD, x: 0, turn: 0.92, crouch: 3, lean: 0, hy: -1, fx: 3, fy: -27, bx: -4, by: -25, armsFront: true, ffx: 5, fbx: -6 };
const SPIN_WARD = { ...GUARD, x: 0, turn: 0.85, crouch: 4, lean: 1, fx: 8, fy: -26, bx: -6, by: -24, armsFront: true, ffx: 7, fbx: -7 };
const PARRY_1 = { ...SPIN_WARD, x: -3, crouch: 6, lean: -2, fx: 7, fy: -27, bx: -4, by: -23, ffx: -3, fbx: 7, ghost: 1 };
const PARRY_2 = { ...SPIN_WARD, x: -4, crouch: 7, lean: -2, fx: 7, fy: -22, bx: -5, by: -24, ffx: -2, fbx: 8, ghost: 1 };
const PARRY_3 = { ...SPIN_WARD, x: -5, crouch: 8, lean: -3, hy: 1, fx: 7, fy: -27, bx: -4, by: -25, ffx: -2, fbx: 8, toeB: true, ghost: 1 };
const PULSE_OUT = { ...GUARD, x: -1, turn: 0.75, crouch: 3, lean: 2, hy: -1, fx: 11, fy: -28, bx: -8, by: -23, ffx: 8, fbx: -8, ghost: 1 };

export const act = {
  poses: [
    [-0.26, GUARD],
    [0.04, SUMMON_SEAL, "out"],
    [T_SPIN, SPIN_WARD, "out"],
    [T_HIT1, PARRY_1, "snap"],
    [T_HIT1 + 0.26, { ...SPIN_WARD, x: -2 }],
    [T_HIT2, PARRY_2, "snap"],
    [T_HIT2 + 0.26, { ...SPIN_WARD, x: -2 }],
    [T_HIT3, PARRY_3, "snap"],
    [T_PULSE, PULSE_OUT, "snap"],
    [3.30, GUARD],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_FORMED, stop: 0.04, shake: 0.16, amp: 1.8, target: false },
    { t: T_HIT1, stop: 0.08, shake: 0.28, amp: 3.4, target: false },
    { t: T_HIT2, stop: 0.08, shake: 0.30, amp: 3.8, target: false },
    { t: T_HIT3, stop: 0.15, shake: 0.48, amp: 5.8, target: false },
    { t: T_PULSE, stop: 0.06, shake: 0.26, amp: 3.0, target: false },
  ],
  dust: [
    { t: T_SPIN, x: 0, n: 5, c: "#9cf0ff" },
    { t: T_HIT1, x: -8, n: 5, dir: -1, c: "#ffd858" },
    { t: T_HIT2, x: -10, n: 6, dir: -1, c: "#ffd858" },
    { t: T_HIT3, x: -12, n: 9, dir: -1, c: "#fff8bd" },
    { t: T_PULSE, x: 6, n: 6, dir: 1, c: "#9cf0ff" },
  ],
};

// Safe local bounds inside [316, 196] with origin [124, 160]
const X_MIN = -114, X_MAX = 180, Y_MIN = -148, Y_MAX = 28;

// Symmetric pair order so left & right Spirit Swords emerge together around the character
const SUMMON_ORDER = [0, 0, 1, 1, 2, 2, 3, 3];

// Exact 1-visit-per-pixel-cell floor ellipse ring using pure additive light (+ crisp core when alpha > 0.78):
// Visits each integer pixel `(px, py)` at most once so there is ZERO moire speckle and ZERO dark/grey fade!
function drawLuminousFloorRing(p, cx, cy, rx, sy, th, alpha, colOuter, colCore, keepFn) {
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
      const k = alpha * (u * u * 0.9 + 0.2);
      if (alpha > 0.75 && u > 0.52) p.px(px, py, col);
      p.light(px, py, col, k);
    }
  }
}

// Exact 1-visit-per-pixel-cell circular wave/arc in the vertical plane:
// Uses row-skipping annulus scan so every pixel `(px, py)` is visited ONCE (zero polar moire speckles!)
// and uses pure additive `p.light` so fading waves never turn dark grey or leave isolated bright/dark dots.
function drawLuminousCircleWave(p, cx, cy, r, th, alpha, colOuter, colCore, angCenter = 0, angHalfSpan = Math.PI) {
  if (r <= 1 || alpha <= 0.02 || th <= 0.2) return;
  const rOut = r + th * 0.5;
  const rIn = Math.max(0, r - th * 0.8);
  const y0 = Math.max(Y_MIN, Math.floor(cy - rOut - 1));
  const y1 = Math.min(2, Math.ceil(cy + rOut + 1));
  const isArc = angHalfSpan < Math.PI - 0.01;

  for (let py = y0; py <= y1; py++) {
    const dy = py - cy;
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
      const d = Math.sqrt(dx * dx + dy2);
      const diff = Math.abs(d - r);
      if (diff > th) continue;

      let endFade = 1;
      if (isArc) {
        const ang = Math.atan2(dy, dx);
        const da = Math.abs(Math.atan2(Math.sin(ang - angCenter), Math.cos(ang - angCenter)));
        if (da > angHalfSpan) continue;
        endFade = 1 - smooth(angHalfSpan * 0.55, angHalfSpan, da);
      }
      const u = 1 - diff / th;
      const col = u > 0.52 ? colCore : colOuter;
      const k = alpha * endFade * (u * u * 1.1 + 0.15);
      if (alpha * endFade > 0.72 && u > 0.58) p.px(px, py, col);
      p.light(px, py, col, k);
    }
  }
}

// Bresenham 1-visit-per-pixel luminous line (never hits the same pixel twice, zero moire or Bayer dots!)
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
      if (alpha > 0.68) p.px(sx, sy, c);
      p.light(sx, sy, c, alpha * 0.85);
    }
    if (sx === ex && sy === ey) break;
    i++;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; sx += stepx; }
    if (e2 <= dx) { err += dx; sy += stepy; }
  }
}

// Hand-crafted Convex Gap-Free Luminous Spirit Sword renderer ("发光飞剑"):
// - The hilt tapers monotonically from the winged crossguard (`guardW`) to the pommel tip (`0.8 px`),
//   so there is NEVER a concave pocket between the crossguard and pommel that could trap a 1px dark background dot!
// - During Phase 4 sublimation (`erode > 0`), the sword erodes from hilt to tip AND thins into a pure
//   white-cyan beam of light, so it never leaves a stubby crossguard or dark grey stump.
function drawSpiritSword(p, tipX, tipY, ang, len, wid, C, G, erode = 0, flashWhite = false) {
  if (erode >= 0.96 || len < 3) return;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const nx = -sa, ny = ca;
  const bladeLen = len * 0.78;
  const guardD = bladeLen;
  const hiltEnd = len;
  // As `erode` increases in Phase 4, the crossguard wings fold into a sleek light needle
  const guardScale = Math.max(0.35, 1 - erode * 1.4);
  const guardW = wid * 2.15 * guardScale;
  const maxVisibleD = hiltEnd * (1 - erode * 0.88);

  const cx = tipX - ca * (len * 0.5);
  const cy = tipY - sa * (len * 0.5);
  const bound = Math.ceil(len * 0.55 + guardW + 2);

  for (let dy = -bound; dy <= bound; dy++) {
    const py = Math.round(cy + dy);
    if (py < Y_MIN || py > Y_MAX) continue;
    for (let dx = -bound; dx <= bound; dx++) {
      const px = Math.round(cx + dx);
      if (px < X_MIN || px > X_MAX) continue;

      const rx = px - tipX, ry = py - tipY;
      const d = -(rx * ca + ry * sa);
      const w = rx * nx + ry * ny;
      const aw = Math.abs(w);

      if (d < -0.5 || d > maxVisibleD) continue;

      // 1. Winged Golden Crossguard + Monotonically Tapered Hilt (100% convex — zero concave dark pockets!)
      if (d >= guardD - 0.9 && d <= hiltEnd) {
        const uHilt = clamp((d - (guardD - 0.9)) / Math.max(1, hiltEnd - (guardD - 0.9)));
        // Smoothly tapers from `guardW` at `uHilt = 0..0.28` down to `1.0 px` along the grip/pommel!
        const maxHiltW = uHilt < 0.32
          ? lerp(guardW * 0.85, guardW, uHilt / 0.32)
          : lerp(guardW * 0.55, 0.95, (uHilt - 0.32) / 0.68);
        if (aw <= maxHiltW) {
          const col = flashWhite || erode > 0.25
            ? (aw < 0.9 ? WHITE : C[6])
            : uHilt > 0.78 || aw < 1.25
              ? WHITE
              : aw < maxHiltW * 0.65
                ? G[5]
                : G[4];
          p.px(px, py, col);
          if (erode > 0.05) p.light(px, py, C[6], 0.45);
          continue;
        }
      }

      // 2. Double-Edged Luminous Blade (extends to guardD + 0.6 so it overlaps the guard seamlessly)
      if (d >= -0.5 && d <= guardD + 0.6) {
        const u = clamp(d / bladeLen);
        const effWid = wid * (1 - erode * 0.45);
        const halfW = u < 0.28 ? effWid * (u / 0.28) : effWid * (1 - 0.08 * ((u - 0.28) / 0.72));
        if (aw <= halfW + 0.42) {
          let col;
          if (flashWhite || erode > 0.22) {
            col = aw < 0.95 ? WHITE : C[6];
          } else if (aw < 0.78 || u < 0.20) {
            col = WHITE;
          } else if (u > 0.24 && u < 0.76 && aw < 1.4) {
            col = G[5];
          } else if (aw > halfW - 0.7) {
            col = C[6];
          } else {
            col = w < 0 ? C[6] : C[5];
          }
          p.px(px, py, col);
          if (erode > 0.05) p.light(px, py, C[6], 0.45);
        }
      }
    }
  }
}

// Crisp Hand-Pixelled Branching Metallic Clash Sparks ("清脆金铁交鸣火花")
function drawCrispClashSparks(p, hx, hy, age, scale, seedOff, SP) {
  const dur = 0.26 * Math.sqrt(scale);
  if (age < 0 || age >= dur) return;
  const u = age / dur;
  const fade = 1 - smooth(0.42, 1.0, u);
  const nStreaks = Math.round(14 * scale);

  for (let i = 0; i < nStreaks; i++) {
    const spread = (i / (nStreaks - 1) - 0.5) * 2.55;
    const ang = spread + (rand(i, seedOff) - 0.5) * 0.22;
    const sp = (110 + rand(i, seedOff + 7) * 155) * scale;
    const drag = (1 - Math.exp(-5.5 * age)) / 5.5;
    const headD = sp * drag;
    const tailD = Math.max(0, headD - lerp(18, 4, u) * scale);

    const x1 = hx + Math.cos(ang) * headD;
    const y1 = hy + Math.sin(ang) * headD + 120 * age * age;
    const x0 = hx + Math.cos(ang) * tailD;
    const y0 = hy + Math.sin(ang) * tailD + 120 * Math.max(0, age - 0.03) ** 2;

    if (x1 > X_MAX - 8 || x1 < X_MIN + 8 || y1 < Y_MIN + 8 || y1 > 2) continue;

    drawLuminousLine(p, x0, y0, x1, y1, (v) => (v > 0.62 ? WHITE : v > 0.30 ? SP[1] : SP[2]), fade);
    if (fade > 0.45) p.px(x1, y1, WHITE);

    if (i % 2 === 0 && u > 0.10 && u < 0.76) {
      const fLen = (4.5 + 3.0 * (1 - u)) * scale;
      for (const sgn of [-1, 1]) {
        const fAng = ang + sgn * 0.52;
        const fx = x1 + Math.cos(fAng) * fLen, fy = y1 + Math.sin(fAng) * fLen;
        if (fx <= X_MAX - 6 && fy >= Y_MIN + 6 && fy <= 2) {
          drawLuminousLine(p, x1, y1, fx, fy, u < 0.45 ? WHITE : SP[1], fade * 0.9);
        }
      }
    }
  }
}

// Draw the Incoming Enemy Attack (Spear Lance, Twin Blood-Slash, or Colossal Greatsword Wave)
function drawIncomingEnemyAttack(p, s, tk, ST) {
  const k = ease.inQuad(tk);
  const hx = lerp(s.sx, s.hx, k);
  const hy = lerp(s.sy, s.hy, k);
  const dirA = Math.atan2(s.hy - s.sy, s.hx - s.sx);
  const backX = -Math.cos(dirA), backY = -Math.sin(dirA);
  const perpX = -backY, perpY = backX;
  const distEntered = Math.hypot(hx - s.sx, hy - s.sy);

  if (s.kind === "spear") {
    const tailLen = Math.min(54, distEntered);
    if (tailLen > 2) {
      const tx = hx + backX * tailLen, ty = hy + backY * tailLen;
      p.beam(tx, ty, hx, hy, 4.6, (u, v) => (v < 0.36 ? WHITE : v < 0.68 ? ST[4] : ST[2]));
    }
    const wx = hx + backX * Math.min(12, distEntered), wy = hy + backY * Math.min(12, distEntered);
    drawLuminousLine(p, wx - perpX * 7, wy - perpY * 7, hx, hy, ST[3], 0.95);
    drawLuminousLine(p, wx + perpX * 7, wy + perpY * 7, hx, hy, ST[3], 0.95);
    p.glow(hx, hy, 18, ST[3], 0.78);
  } else if (s.kind === "slash") {
    for (const [lag, span, wMax, isMain] of [[0, 16, 4.4, true], [11, 12, 2.8, false]]) {
      if (lag > distEntered) continue;
      const cx = hx + backX * lag, cy = hy + backY * lag;
      for (let v = -span; v <= span; v += 0.65) {
        const nv = v / span;
        const curve = nv * nv * 9;
        const thick = (1 - nv * nv) * wMax + 0.5;
        const bx = cx + perpX * v + backX * curve;
        const by = cy + perpY * v + backY * curve;
        for (let d = 0; d <= thick; d += 0.85) {
          const px = Math.round(bx + backX * d), py = Math.round(by + backY * d);
          if (px > X_MAX - 6 || py > 2) continue;
          const col = isMain && d < 1.3 ? WHITE : d < thick * 0.55 ? ST[3] : ST[2];
          if (isMain) p.px(px, py, col);
          else p.light(px, py, col, 0.75);
        }
      }
    }
    p.glow(hx, hy, 18, ST[2], 0.78);
  } else {
    for (const [lag, span, wMax, isMain] of [[18, 15, 3.0, false], [9, 18, 4.0, false], [0, 21, 5.8, true]]) {
      if (lag > distEntered) continue;
      const cx = hx + backX * lag, cy = hy + backY * lag;
      for (let v = -span; v <= span; v += 0.65) {
        const nv = v / span;
        const curve = nv * nv * 12;
        const thick = (1 - nv * nv) * wMax + 0.6;
        const bx = cx + perpX * v + backX * curve;
        const by = cy + perpY * v + backY * curve;
        for (let d = 0; d <= thick; d += 0.85) {
          const px = Math.round(bx + backX * d), py = Math.round(by + backY * d);
          if (px > X_MAX - 6 || py > 2) continue;
          const col = isMain ? (d < 1.6 ? WHITE : d < thick * 0.5 ? ST[4] : ST[3]) : ST[3];
          if (isMain) p.px(px, py, col);
          else p.light(px, py, col, 0.7);
        }
      }
    }
    const tailLen = Math.min(52, distEntered);
    if (tailLen > 2) {
      p.beam(hx + backX * tailLen, hy + backY * tailLen, hx, hy, 5.8, (u, v) =>
        v < 0.35 ? WHITE : v < 0.70 ? ST[3] : ST[2],
      );
    }
    p.glow(hx, hy, 24, ST[3], 0.82);
  }
}

export function create(o) {
  const C = fit(o.palette, 8);
  const G = fit(o.gold, 6);
  const SP = fit(o.sparks, 5);
  const ST = fit(o.strike, 5);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, SP[1], SP[2], SP[2], C[6]],
  });
  const lights = new Lights();

  const hitStars = STRIKES.map((s) =>
    spikes(R, s.scale > 1.2 ? 16 : 12, s.aim, {
      len: s.scale > 1.2 ? [17, 26] : [13, 20],
      w: s.scale > 1.2 ? [2.1, 3.1] : [1.7, 2.5],
      fwd: 2.1,
      back: 0.65,
      jag: 0.54,
    }),
  );

  let t = 0;
  let spinTheta = 0;
  let formedFired = false;
  let pulseFired = false;
  let hitFired = -1;

  const capLife = (l) => Math.max(0.08, Math.min(l, T_END - 0.14 - t));

  const barrierStrength = (tt) => {
    if (tt < T_SPIN) return 0;
    if (tt < T_FORMED) return ease.inOutQuad((tt - T_SPIN) / (T_FORMED - T_SPIN));
    if (tt < T_PULSE) return 1;
    return 1 - smooth(T_PULSE, T_PULSE + 0.38, tt);
  };

  // Exact 1-visit-per-pixel-cell Tilted 3D Equatorial Sword-Light Stream
  function drawEquatorialSwordStream(p, bStr, isBack) {
    if (bStr <= 0.04) return;
    const rx = R_BARRIER * 1.02;
    const sy = 0.26;
    const rot = -0.14;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const cyEq = -27;
    const th = 2.6 * bStr;

    const x0 = Math.floor(-rx - 4), x1 = Math.ceil(rx + 4);
    const y0 = Math.floor(cyEq - rx * 0.42 - 4), y1 = Math.ceil(cyEq + rx * 0.42 + 4);

    for (let py = y0; py <= y1; py++) {
      const dy = py - cyEq;
      for (let px = x0; px <= x1; px++) {
        const dx = px;
        const lx = dx * cr + dy * sr;
        const ly = (-dx * sr + dy * cr) / sy;
        const r = Math.hypot(lx, ly);
        const diff = Math.abs(r - rx);
        if (diff > th) continue;
        const a = Math.atan2(ly, lx);
        if ((Math.sin(a) < 0) !== isBack) continue;

        const u = 1 - diff / th;
        const streak = 0.5 + 0.5 * Math.sin(a * 4 - spinTheta * 2.5);
        const k = (isBack ? 0.35 : 0.78) * bStr * u * (0.45 + 0.55 * streak);
        const col = streak > 0.65 && u > 0.6 ? WHITE : streak > 0.38 ? G[5] : C[6];
        if (!isBack && k > 0.68) p.px(px, py, col);
        p.light(px, py, col, k);
      }
    }
  }

  // PHASE 1, 2, 4: Underfoot Bagua Sword-Array Sigil, Circular Sword-Light Barrier & 8 Whirling Spirit Swords
  function drawSwordArrayAndBarrier(p, isBack) {
    const fadeEnd = 1 - smooth(T_DISSOLVE, T_END - 0.05, t);
    if (fadeEnd <= 0.02) return;
    const bStr = barrierStrength(t);

    // 1. Underfoot Eight-Trigram Sword-Array Sigil at (0, 0)
    if (t >= 0.02 && t < T_END - 0.06) {
      const reveal = ease.outCubic(clamp((t - 0.02) / 0.34));
      const rx = (R_BARRIER + 10) * reveal;
      const keepFn = (g) => (Math.sin(g) < 0) === isBack;
      const hitBoost = STRIKES.reduce((acc, s) => {
        const dtH = t - s.t;
        return dtH >= 0 && dtH < 0.24 ? Math.max(acc, (1 - dtH / 0.24) * s.scale) : acc;
      }, 0);

      drawLuminousFloorRing(
        p,
        0,
        0.5,
        rx,
        SY_FLOOR,
        1.8 + hitBoost * 0.8,
        fadeEnd * 0.92,
        hitBoost > 0.4 ? G[4] : C[5],
        WHITE,
        keepFn,
      );
      drawLuminousFloorRing(
        p,
        0,
        0.5,
        rx * 0.64,
        SY_FLOOR,
        1.4,
        fadeEnd * 0.84,
        G[4],
        G[5],
        keepFn,
      );

      for (let i = 0; i < 8; i++) {
        const a = spinTheta * 0.35 + (i / 8) * TAU;
        if ((Math.sin(a) < 0) !== isBack) continue;
        const xIn = Math.cos(a) * rx * 0.66, yIn = 0.5 + Math.sin(a) * rx * 0.66 * SY_FLOOR;
        const xOut = Math.cos(a) * rx * 0.96, yOut = 0.5 + Math.sin(a) * rx * 0.96 * SY_FLOOR;
        drawLuminousLine(p, xIn, yIn, xOut, yOut, i % 2 === 0 ? C[6] : G[5], fadeEnd * 0.85);
      }
    }

    // 2. Tilted 3D Equatorial Sword-Light Stream around the Character
    drawEquatorialSwordStream(p, bStr, isBack);

    // 3. THE CIRCULAR SWORD-LIGHT BARRIER ("围绕角色高速旋转形成一道圆形剑光屏障")
    if (bStr > 0.03) {
      const hitState = STRIKES.map((s) => ({ s, age: t - s.t })).filter((h) => h.age >= 0 && h.age < 0.52);

      if (isBack) {
        p.glow(0, CY, R_BARRIER * 1.15, C[4], 0.24 * bStr);

        for (const rScale of [0.74, 0.46]) {
          const rOct = R_BARRIER * rScale;
          for (let i = 0; i < 8; i++) {
            const a0 = spinTheta * 0.42 + (i / 8) * TAU;
            const a1 = spinTheta * 0.42 + ((i + 1) / 8) * TAU;
            const x0 = Math.cos(a0) * rOct, y0 = CY + Math.sin(a0) * rOct;
            const x1 = Math.cos(a1) * rOct, y1 = CY + Math.sin(a1) * rOct;
            drawLuminousLine(p, x0, y0, x1, y1, rScale > 0.6 ? G[4] : C[5], 0.42 * bStr);
          }
        }
        for (let i = 0; i < 8; i++) {
          const a = spinTheta * 0.42 + (i / 8) * TAU;
          const x0 = Math.cos(a) * (R_BARRIER * 0.46), y0 = CY + Math.sin(a) * (R_BARRIER * 0.46);
          const x1 = Math.cos(a) * (R_BARRIER * 0.90), y1 = CY + Math.sin(a) * (R_BARRIER * 0.90);
          drawLuminousLine(p, x0, y0, x1, y1, C[5], 0.36 * bStr);
        }
        return;
      }

      // FRONT LAYER of the Circular Sword-Light Barrier
      const rOuter = R_BARRIER + 2.0;
      const bandW = 6.8 * bStr;
      const rInner = rOuter - bandW;
      const x0 = Math.floor(-rOuter - 2), x1 = Math.ceil(rOuter + 2);
      const y0 = Math.floor(CY - rOuter - 2), y1 = Math.min(0, Math.ceil(CY + rOuter + 2));

      for (let py = y0; py <= y1; py++) {
        const dy = py - CY;
        for (let px = x0; px <= x1; px++) {
          const dx = px;
          const d = Math.hypot(dx, dy);
          if (d < rInner || d > rOuter) continue;

          const uRad = (d - rInner) / Math.max(1, rOuter - rInner);
          const ang = Math.atan2(dy, dx);

          const wakePhase = ang * N_SWORDS - spinTheta * N_SWORDS;
          const wake = 0.5 + 0.5 * Math.cos(wakePhase);
          const fineStreak = 0.5 + 0.5 * Math.sin(ang * 8 - spinTheta * 16 + d * 0.7);
          const goldThread = Math.abs(uRad - (0.50 + 0.16 * Math.sin(ang * 8 + spinTheta * 6))) < 0.14;

          let rimHit = 0;
          for (const { s, age } of hitState) {
            const dAng = Math.abs(Math.atan2(Math.sin(ang - s.ang), Math.cos(ang - s.ang)));
            const front = age * 5.2;
            rimHit = Math.max(
              rimHit,
              Math.exp(-(((dAng - front) / 0.22) ** 2)) * (1 - age / 0.52) * s.scale,
              age < 0.14 && dAng < 0.42 ? (1 - age / 0.14) * (1 - dAng / 0.42) * 1.4 : 0,
            );
          }

          const edgeEnv = Math.sin(uRad * Math.PI);
          const intensity = (0.45 + 0.55 * Math.pow(wake, 1.3)) * (0.72 + 0.28 * fineStreak) * edgeEnv + rimHit * 0.85;
          if (intensity < 0.18) continue;

          const k = clamp(intensity * bStr);
          let col;
          if (rimHit > 0.55 || (uRad > 0.65 && wake > 0.70)) {
            col = WHITE;
          } else if (goldThread) {
            col = wake > 0.5 ? G[5] : G[4];
          } else if (intensity > 0.65) {
            col = C[6];
          } else {
            col = C[5];
          }

          if (k > 0.62) {
            p.px(px, py, col);
            p.light(px, py, col, 0.35 * k);
          } else {
            p.light(px, py, col, 0.90 * k);
          }
        }
      }

      ringLight(p, 0, CY, R_BARRIER, 4.5, C[5], 0.38 * bStr, (x, y) => y <= 0);
    }

    if (isBack) return;

    // 4. THE 8 LUMINOUS SPIRIT SWORDS ("从身体周围浮现数把发光飞剑 -> 高速旋转 -> 化光升空消散")
    const pairAngles = [
      -Math.PI * 0.82, -Math.PI * 0.18, // Pair 0: Upper-left & Upper-right shoulders
      -Math.PI * 0.58, -Math.PI * 0.42, // Pair 1: Top-left & Top-right crown
      Math.PI * 0.94,  Math.PI * 0.06,  // Pair 2: Mid-left & Mid-right flanks
      Math.PI * 0.72,  Math.PI * 0.28,  // Pair 3: Lower-left & Lower-right guard
    ];

    // Skyward light-stream sublimation during Phase 4 dissipation (3.22s .. 3.70s)
    const uErode = smooth(T_DISSOLVE, T_END - 0.06, t);

    for (let i = 0; i < N_SWORDS; i++) {
      const pairIdx = SUMMON_ORDER[i];
      const tAppear = 0.03 + pairIdx * 0.12;
      if (t < tAppear) continue;

      const uMat = clamp((t - tAppear) / 0.22);
      const evenAngle = (i / N_SWORDS) * TAU - Math.PI * 0.5;
      const formBlend = smooth(T_SPIN - 0.10, T_SPIN + 0.18, t);
      const baseAngle = lerp(pairAngles[i], evenAngle, formBlend);
      const curAngle = baseAngle + spinTheta;

      const rOrb = t < T_SPIN
        ? lerp(16, R_BARRIER, ease.outBack(uMat, 1.35))
        : t < T_PULSE
          ? R_BARRIER
          : lerp(R_BARRIER, R_BARRIER + 10, smooth(T_PULSE, T_END - 0.15, t));

      const cx = Math.cos(curAngle) * rOrb;
      const cy = Math.min(-2, CY + Math.sin(curAngle) * rOrb) - ease.inQuad(uErode) * 32;

      const pivotToTangent = smooth(T_SPIN - 0.12, T_SPIN + 0.12, t);
      const pivotToSalute = smooth(T_PULSE, T_PULSE + 0.28, t);
      const radialAng = curAngle;
      const tangentAng = curAngle + Math.PI * 0.5;
      const swordAng = lerp(lerp(radialAng, tangentAng, pivotToTangent), -Math.PI * 0.5, pivotToSalute);

      const swordLen = 24 * ease.outBack(uMat, 1.3);
      const tipX = cx + Math.cos(swordAng) * (swordLen * 0.5);
      const tipY = cy + Math.sin(swordAng) * (swordLen * 0.5);
      const flashMat = uMat < 0.28 || Math.abs(t - T_SPIN) < 0.04 || Math.abs(t - T_PULSE) < 0.05;

      if (t < T_SPIN + 0.06 && (i & 1) === 1) {
        const aLeft = pairAngles[i - 1] + spinTheta;
        const px0 = Math.cos(aLeft) * rOrb, py0 = Math.min(-2, CY + Math.sin(aLeft) * rOrb);
        drawLuminousLine(p, px0, py0, cx, cy, uMat < 0.4 ? WHITE : C[5], 0.48 * (1 - bStr));
      }

      if (bStr > 0.15) {
        for (let k = 1; k <= 4; k++) {
          const lagA = curAngle - k * 0.11 * bStr;
          const prevA = curAngle - (k - 1) * 0.11 * bStr;
          const xA = Math.cos(lagA) * rOrb, yA = Math.min(-2, CY + Math.sin(lagA) * rOrb);
          const xB = Math.cos(prevA) * rOrb, yB = Math.min(-2, CY + Math.sin(prevA) * rOrb);
          drawLuminousLine(p, xA, yA, xB, yB, k === 1 ? WHITE : k === 2 ? C[6] : G[5], (1 - k / 5) * 0.85 * bStr);
        }
      }

      // During Phase 4 sublimation (`uErode > 0.35`), transition cleanly into an ascending vertical sword-light beam + star tip!
      if (uErode < 0.45) {
        drawSpiritSword(p, tipX, tipY, swordAng, swordLen, 2.2, C, G, uErode * 1.2, flashMat);
      } else if (uErode < 0.96) {
        const beamAlpha = 1 - (uErode - 0.45) / 0.51;
        const tailLen = 18 * beamAlpha;
        drawLuminousLine(p, tipX, tipY + tailLen, tipX, tipY, (v) => (v > 0.5 ? WHITE : C[6]), beamAlpha);
        const glintArm = Math.round(4 * beamAlpha);
        if (glintArm >= 1) {
          sparkle(p, tipX, tipY, glintArm, WHITE, i % 2 === 0 ? C[6] : G[5], 0.5 * beamAlpha);
        }
      }
      p.glow(cx, cy, 11, C[5], 0.28 * fadeEnd);
    }

    // 5. Phase 4 Repelling Sword-Qi Shockwave Ring at T_PULSE (2.78s)
    if (t >= T_PULSE && t < T_PULSE + 0.44) {
      const uP = (t - T_PULSE) / 0.44;
      const rPulse = R_BARRIER + 52 * ease.outQuart(uP);
      drawLuminousCircleWave(
        p,
        0,
        CY,
        rPulse,
        Math.max(1.2, 3.6 * (1 - uP)),
        (1 - uP) * 0.92,
        C[5],
        WHITE,
      );
      drawLuminousFloorRing(
        p,
        0,
        0.5,
        rPulse,
        SY_FLOOR,
        Math.max(1.1, 3.2 * (1 - uP)),
        (1 - uP) * 0.88,
        G[4],
        WHITE,
        (g) => (Math.sin(g) < 0) === isBack,
      );
    }
  }

  // PHASE 3: Incoming Enemy Strikes, Crossed Spirit-Sword X-Parry Lock & Crisp Metallic Clash Sparks
  function drawParryClashesAndSparks(p, isBack) {
    for (let idx = 0; idx < STRIKES.length; idx++) {
      const s = STRIKES[idx];
      const age = t - s.t;

      // Ground shockwave ring on parry impact (split back/front)
      const fDur = 0.40 * Math.sqrt(s.scale);
      if (age >= 0 && age < fDur) {
        const q = age / fDur;
        const rFloor = 14 + (50 * s.scale) * ease.outQuart(q);
        drawLuminousFloorRing(
          p,
          s.hx * 0.45,
          0.5,
          rFloor,
          SY_FLOOR,
          Math.max(1.1, 3.2 * s.scale * (1 - q)),
          (1 - q) * 0.92,
          SP[2],
          WHITE,
          (g) => (Math.sin(g) < 0) === isBack,
        );
      }

      if (isBack) continue;

      // 1. Incoming Enemy Attack flying in from the right before contact
      const leadDur = idx === 2 ? 0.14 : 0.11;
      const tk = (t - (s.t - leadDur)) / leadDur;
      if (tk >= 0 && tk < 1) {
        drawIncomingEnemyAttack(p, s, tk, ST);
      }

      if (age < 0 || age >= 0.52) continue;

      // 2. CROSSED SPIRIT-SWORD X-PARRY LOCK ("飞剑交叉迎击架挡")
      if (age < 0.28) {
        const uHold = age / 0.28;
        const erodeLock = smooth(0.55, 1.0, uHold);
        const recoil = Math.sin(Math.min(1, uHold * 4) * Math.PI) * 2.5;
        const px = s.hx - recoil, py = s.hy;
        const lockAngles = idx === 2 ? [-0.92, 0.92, -1.57] : [-0.88, 0.88];
        for (const la of lockAngles) {
          const tipX = px + Math.cos(la) * 15;
          const tipY = py + Math.sin(la) * 15;
          drawSpiritSword(p, tipX, tipY, la, 27, 2.3, C, G, erodeLock, age < 0.07);
        }
      }

      // 3. Luminous Crescent Sword-Qi Deflection Arc bursting from the parry point (1-visit-per-pixel, zero moire speckles!)
      const rDur = 0.30 * Math.sqrt(s.scale);
      if (age < rDur) {
        const rq = age / rDur;
        drawLuminousCircleWave(
          p,
          s.hx,
          s.hy,
          8 + (34 * s.scale) * ease.outQuart(rq),
          (2.8 * s.scale) * (1 - 0.65 * rq),
          (1 - smooth(0.45, 1.0, rq)) * 0.95,
          SP[2],
          WHITE,
          s.aim,
          1.35,
        );
      }

      // 4. Crisp Metallic Clash Sparks & Branching Ricochet Needles ("受击时飞剑碰撞发出清脆火花的反馈特效")
      drawCrispClashSparks(p, s.hx, s.hy, age, s.scale, idx * 43 + 19, SP);

      // 5. Razor-Sharp Metallic Cross-Clash Glint & Starburst at (s.hx, s.hy)
      if (age < 0.11 * s.scale) {
        const hk = 1 - age / (0.11 * s.scale);
        const hot = age < 0.045;
        star(
          p,
          s.hx,
          s.hy,
          hitStars[idx],
          hot ? 1.05 : 1.32,
          hot ? 1.0 : 0.62,
          [SP[3], SP[2], SP[1], WHITE],
          1,
          2.6 * s.scale,
        );
        flare(p, s.hx, s.hy, 40 * s.scale * hk, hk, [SP[3], G[4], SP[1], WHITE]);
        sparkle(p, s.hx, s.hy, 16 * s.scale * hk, WHITE, SP[1], hk);
      }
    }
  }

  return {
    update(dt) {
      t += dt;

      const omega = t < T_SPIN
        ? 0.25
        : t < T_PULSE
          ? lerp(2.0, 14.5, clamp((t - T_SPIN) / 0.34))
          : lerp(14.5, 0.8, ease.outCubic(clamp((t - T_PULSE) / 0.75)));
      spinTheta += omega * dt;

      if (t < T_SUMMON_END && R.chance(0.70)) {
        const idx = Math.min(N_SWORDS - 1, Math.floor((t / T_SUMMON_END) * N_SWORDS));
        const a = (idx / N_SWORDS) * TAU - Math.PI * 0.5 + spinTheta;
        const sx = Math.cos(a) * R_BARRIER, sy = CY + Math.sin(a) * R_BARRIER;
        ps.spawn(
          P.STAR,
          sx + R.range(-5, 5),
          sy + R.range(-5, 5),
          R.range(-16, 16),
          -R.range(10, 28),
          capLife(R.range(0.24, 0.44)),
          R.pick([WHITE, C[6], G[5]]),
          R.range(1.0, 1.7),
        );
      }

      if (!formedFired && t >= T_FORMED) {
        formedFired = true;
        lights.add(0, CY, 82, C[5], 0.65, 0.28);
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * TAU;
          const sx = Math.cos(a) * R_BARRIER, sy = CY + Math.sin(a) * R_BARRIER;
          const tx = -Math.sin(a) * 115, ty = Math.cos(a) * 115;
          ps.spawn(P.SPARK, sx, sy, tx, ty, capLife(R.range(0.18, 0.34)));
        }
      }

      const bStr = barrierStrength(t);
      if (bStr > 0.45 && R.chance(0.48)) {
        const a = R.range(0, TAU);
        const sx = Math.cos(a) * R_BARRIER, sy = CY + Math.sin(a) * R_BARRIER;
        if (sy < -4) {
          const sp = R.range(60, 125);
          ps.spawn(
            R.chance(0.45) ? P.STAR : P.SPARK,
            sx,
            sy,
            -Math.sin(a) * sp,
            Math.cos(a) * sp - R.range(8, 22),
            capLife(R.range(0.18, 0.36)),
            R.pick([WHITE, C[6], G[5]]),
            R.range(0.9, 1.5),
          );
        }
      }

      // Three Fierce Parry Clashes (1.34s, 1.78s, 2.22s)
      for (let i = 0; i < STRIKES.length; i++) {
        const s = STRIKES[i];
        if (hitFired >= i || t < s.t) continue;
        hitFired = i;

        lights.add(s.hx, s.hy, 64 * s.scale, SP[2], 0.82, 0.28);
        lights.add(s.hx, s.hy, 28 * s.scale, WHITE, 0.90, 0.10);

        const nSparks = Math.round(54 * s.scale);
        for (let j = 0; j < nSparks; j++) {
          const a = s.aim + R.range(-1.28, 1.18);
          const sp = R.range(125, 305) * (0.85 + 0.20 * s.scale);
          ps.spawn(
            P.SPARK,
            s.hx + 1,
            s.hy,
            Math.cos(a) * sp,
            Math.sin(a) * sp - R.range(18, 50),
            capLife(R.range(0.22, 0.56)),
          );
        }

        for (let j = 0; j < Math.round(14 * s.scale); j++) {
          const a = s.aim + R.range(-1.3, 1.3);
          const sp = R.range(45, 135);
          ps.spawn(
            P.STAR,
            s.hx + R.range(-4, 6),
            s.hy + R.range(-6, 6),
            Math.cos(a) * sp,
            Math.sin(a) * sp - 18,
            capLife(R.range(0.24, 0.48)),
            j % 2 === 0 ? WHITE : SP[1],
            R.range(1.1, 2.0),
          );
        }
      }

      if (!pulseFired && t >= T_PULSE) {
        pulseFired = true;
        lights.add(0, CY, 96, C[5], 0.82, 0.36);
        lights.add(0, CY, 44, WHITE, 0.88, 0.12);
        for (let i = 0; i < 30; i++) {
          const a = R.range(0, TAU), sp = R.range(85, 195);
          ps.spawn(
            i % 2 === 0 ? P.STAR : P.SPARK,
            Math.cos(a) * R_BARRIER,
            Math.min(-4, CY + Math.sin(a) * R_BARRIER),
            Math.cos(a) * sp,
            Math.sin(a) * sp - 24,
            capLife(R.range(0.22, 0.44)),
            R.pick([WHITE, C[6], G[5]]),
            R.range(1.0, 1.7),
          );
        }
      }

      ps.update(dt);
      cullList(ps.list, X_MIN + 4, Y_MIN + 4, X_MAX - 4, Y_MAX - 4);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;
      drawSwordArrayAndBarrier(p, true);
      drawParryClashesAndSparks(p, true);
      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;
      drawSwordArrayAndBarrier(p, false);
      drawParryClashesAndSparks(p, false);
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
