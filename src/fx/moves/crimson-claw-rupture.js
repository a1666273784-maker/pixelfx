// Ground-rupturing dark-crimson claw ambush ("moves/crimson-claw-rupture"):
// 1. Release (0.00s): clawed caster slams abyssal malice into the floor, bursting a dark-crimson shock scar at his
//    claws and driving a burrowing shadow-crimson fissure underground straight beneath the enemy.
// 2. Omen (0.04s..0.46s): bone-chilling black-purple cold mist & frost-shadow crystals rise while churning brown
//    soil clods, pebbles, and a boiling dirt mound heave violently under the enemy's feet.
// 3. Eruption (0.46s): caster yanks his claws skyward as three razor-sharp hooked dark-crimson claw blade arcs
//    violently tear upward from bottom to top out of the ruptured earth, ripping sonic wind-shear through the air.
// 4. Oppressive Hit & Hit-Result (0.49s..2.65s): heavy hit-stop, screen shake, knockback, and abyssal unlight
//    pressure crush the enemy while branding a brief dark-crimson cross claw-scar flash across its chest and
//    detonating volumetric black-purple shadow smoke and luminous red-light particles.

import {
  Particles, Bits, Lights, P, PF, B, Rng,
  fit, clamp, smooth, seg, lerp, ease, rand, mix,
  TAU, WHITE, READY,
} from "../../core/index.js";
import { Puffs, PK, unlight } from "../shadow/_lib.js";
import { brokenRing, frontCrescent } from "../impacts/_lib.js";
import { stoneShape, drawRock } from "../nature/_lib.js";

const PI = Math.PI;
const CRIMSON = ["#090206", "#22040d", "#4a0718", "#7e0b23", "#ba1331", "#ee2c47", "#ff6d7e", "#ffe0e5"];
const SHADOW  = ["#05030a", "#140826", "#2b1150", "#4d1d8a", "#7c36cc", "#b06ef2", "#e4caff"];
const SOIL    = ["#110b0a", "#241815", "#3b2922", "#563c30", "#735340", "#936e53", "#bb9770", "#e6cfa8"];

const TX = 124;
const T_ERUPT = 0.46;
const T_HIT   = 0.49;
const T_CROSS = 0.53;
const T_END   = 2.65;

const X_MIN = -76, X_MAX = 278, Y_MIN = -174, Y_MAX = 36;
const inStage = (x, y, pad = 0) =>
  x >= X_MIN + pad && x <= X_MAX - pad && y >= Y_MIN + pad && y <= Y_MAX - pad;

export const meta = {
  name: "Crimson claw rupture",
  desc: "Black-purple cold mist and churning soil boil under the foe before three dark-crimson claw arcs rip upward, branding a crimson cross scar amid shadow smoke and red light.",
  tags: ["move", "claw", "crimson", "shadow", "earth", "rupture", "slash", "cross", "combat", "one-shot"],
  size: [368, 224],
  origin: [82, 180],
  duration: T_END,
  loop: false,
  fps: 30,
  actor: 2,
  bg: "ground",
  options: { palette: CRIMSON, shadow: SHADOW, soil: SOIL, seed: 1 },
};

const GUARD = {
  ...READY,
  x: 0, crouch: 3, lean: 2, turn: 0.75, hy: 1,
  fx: 10, fy: -23, sa: -0.45, bx: -5, by: -22, sb: -0.6,
  weapon: "claw", offWeapon: "claw",
};
const COIL = {
  ...READY,
  x: -6, crouch: 4, lean: -4, turn: 0.85, hy: -2,
  fx: -8, fy: -36, sa: -2.15, bx: 6, by: -34, sb: -1.85,
  weapon: "claw", offWeapon: "claw",
};
const SLAM = {
  ...READY,
  x: 4, crouch: 9, lean: 7, turn: 0.55, hy: 3,
  fx: 13, fy: -12, sa: 1.15, bx: 7, by: -13, sb: 0.95,
  ffx: 11, fbx: -8, ghost: 1,
  weapon: "claw", offWeapon: "claw",
};
const CHANNEL = {
  ...SLAM,
  x: 5, crouch: 10, lean: 8,
  fx: 14, fy: -11, sa: 1.22, bx: 8, by: -12, sb: 1.02,
  ghost: 0,
};
const RIP_UP = {
  ...READY,
  x: 11, y: -2, crouch: 1, lean: -1, turn: 0.78, hy: -3,
  fx: 6, fy: -36, sa: -1.52, bx: -6, by: -24, sb: 2.15,
  ffx: 9, fbx: -9, toeF: 1, ghost: 1,
  weapon: "claw", offWeapon: "claw",
};
const REND_HOLD = {
  ...READY,
  x: 10, crouch: 2, lean: 1, turn: 0.75, hy: -1,
  fx: 8, fy: -34, sa: -1.22, bx: -6, by: -23, sb: 1.95,
  weapon: "claw", offWeapon: "claw",
};
const SETTLE = {
  ...GUARD,
  x: 5, fx: 10, fy: -24, sa: -0.55,
};

export const act = {
  lead: 0.4,
  target: { x: TX },
  shake: 0.14,
  amp: 2.0,
  poses: [
    [-0.40, GUARD],
    [-0.15, COIL],
    [0.00, SLAM, "snap"],
    [0.36, CHANNEL],
    [T_ERUPT, RIP_UP, "snap"],
    [0.72, REND_HOLD],
    [1.28, SETTLE],
    [1.88, GUARD],
    [2.48, GUARD],
  ],
  hits: [
    { t: 0.18, push: 0, straw: 0, flash: 0, shake: 0.22, amp: 1.2, shiver: 0.26, y: -6 },
    { t: T_HIT, stop: 0.18, shake: 0.56, amp: 5.8, push: 5.6, slide: 18, straw: 42, flash: 0.04, skin: "red", shiver: 0.88, y: -28 },
    { t: T_CROSS + 0.03, stop: 0.05, shake: 0.30, amp: 3.8, push: 3.4, slide: 26, daze: 1.0, straw: 22, flash: 0.03, skin: "shadow", shiver: 0.68, y: -30 },
    { t: 1.28, push: 0, straw: 0, flash: 0, skin: "char", y: -26 },
    { t: 1.55, push: 0, straw: 0, flash: 0, slide: 0, y: -26 },
    { t: 2.18, push: 0, straw: 0, flash: 0, daze: 0, skin: null, y: -26 },
  ],
};

function targetCenterX(t) {
  const k1 = ease.outCubic(seg(t, T_HIT, T_HIT + 0.22));
  const k2 = ease.outCubic(seg(t, T_CROSS + 0.03, T_CROSS + 0.32));
  const ret = ease.inOutQuad(seg(t, 1.55, 2.25));
  return TX + (18 * k1 + 8 * k2) * (1 - ret);
}

function bez(p0, p1, p2, u) {
  const m = 1 - u;
  return m * m * p0 + 2 * m * u * p1 + u * u * p2;
}
function dbez(p0, p1, p2, u) {
  return 2 * (1 - u) * (p1 - p0) + 2 * u * (p2 - p1);
}

// Sharp elongated needle glint aligned with a claw tip's tangent
function drawBladeTipGlint(p, x, y, tx, ty, len, C, k) {
  if (!inStage(x, y, 10) || k <= 0.05) return;
  const d = Math.hypot(tx, ty) || 1;
  const ux = tx / d, uy = ty / d;
  const nx = -uy, ny = ux;
  const L = len * k, W = 3.2 * k;
  p.line(x - ux * L * 0.65, y - uy * L * 0.65, x + ux * L, y + uy * L, k > 0.55 ? WHITE : C[7]);
  p.line(x - nx * W, y - ny * W, x + nx * W, y + ny * W, C[6]);
  p.px(x, y, WHITE);
}

// Rasterizes one ferocious hooked bottom-to-top dark-crimson claw blade crescent (plus optional shadow echo).
function drawRisingClawBlade(p, blade, localT, C, Sh, shadowOnly = false) {
  const { x0, y0, cx, cy, x1, y1, width, phase, sweepDur, holdDur, fadeDur } = blade;
  const totalDur = sweepDur + holdDur + fadeDur;
  if (localT <= 0 || localT >= totalDur) return null;

  const uHead = ease.outQuart(clamp(0.32 + localT / sweepDur, 0, 1));
  const tailK = seg(localT, sweepDur + holdDur * 0.30, totalDur);
  const uTail = ease.inQuad(tailK) * 0.80;
  if (uHead - uTail < 0.025) return null;

  const coolK = seg(localT, sweepDur + holdDur * 0.12, totalDur);
  if (shadowOnly && coolK > 0.42) return null;
  const flashK = 1 - seg(localT, 0, sweepDur + 0.035);

  const ox = shadowOnly ? -4.5 : 0;
  const oy = shadowOnly ? 2.5 : 0;
  const ax0 = x0 + ox, ay0 = y0 + oy;
  const acx = cx + ox, acy = cy + oy;
  const ax1 = x1 + ox, ay1 = y1 + oy;
  const wMul = shadowOnly ? 0.65 : 1.0;

  const N = 44;
  let minY = 999, maxY = -999;
  const xs = new Float32Array(N + 1);
  const ys = new Float32Array(N + 1);
  const us = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const u = lerp(uTail, uHead, i / N);
    const bx = bez(ax0, acx, ax1, u);
    const by = bez(ay0, acy, ay1, u);
    xs[i] = bx; ys[i] = by; us[i] = u;
    if (by < minY) minY = by;
    if (by > maxY) maxY = by;
  }

  const pad = Math.ceil(width * wMul + 6);
  const iy0 = Math.max(Y_MIN + 2, Math.floor(minY - pad));
  const iy1 = Math.min(0, Math.ceil(maxY + pad));
  const span = uHead - uTail;

  for (let py = iy0; py <= iy1; py++) {
    let rx0 = 999, rx1 = -999, bestI = 0, bestDy = 999;
    for (let i = 0; i <= N; i++) {
      const dy = Math.abs(ys[i] - py);
      if (dy < bestDy) { bestDy = dy; bestI = i; }
      if (dy <= pad + 7) {
        if (xs[i] < rx0) rx0 = xs[i];
        if (xs[i] > rx1) rx1 = xs[i];
      }
    }
    if (rx0 > rx1) continue;
    const ix0 = Math.max(X_MIN + 2, Math.floor(rx0 - pad));
    const ix1 = Math.min(X_MAX - 2, Math.ceil(rx1 + pad));
    const uSeed = us[bestI];

    for (let px = ix0; px <= ix1; px++) {
      let u = uSeed;
      for (let it = 0; it < 3; it++) {
        const bx = bez(ax0, acx, ax1, u) - px;
        const by = bez(ay0, acy, ay1, u) - py;
        const dx = dbez(ax0, acx, ax1, u);
        const dy = dbez(ay0, acy, ay1, u);
        const dd = dx * dx + dy * dy;
        if (dd < 1e-4) break;
        u = clamp(u - (bx * dx + by * dy) / dd, uTail, uHead);
      }

      const bx = bez(ax0, acx, ax1, u);
      const by = bez(ay0, acy, ay1, u);
      const dx = dbez(ax0, acx, ax1, u);
      const dy = dbez(ay0, acy, ay1, u);
      const dLen = Math.hypot(dx, dy) || 1;
      const nx = -dy / dLen, ny = dx / dLen;
      const dist = Math.hypot(px - bx, py - by);
      const sd = (px - bx) * nx + (py - by) * ny;

      const v = clamp((u - uTail) / span, 0, 1);
      const taper = Math.pow(Math.sin(PI * clamp(v, 0.001, 0.999)), 0.58) * (1 - 0.14 * v);
      const barb = Math.sin(u * 36 + phase) * 0.65 + Math.sin(u * 79 - phase * 1.6) * 0.35;
      const hw = width * wMul * taper * (1 - coolK * 0.56) + (coolK < 0.35 ? Math.max(0, barb) * 1.0 : 0);
      if (hw < 0.45 || dist > hw + 1.4) continue;

      if (shadowOnly) {
        if (dist <= hw) p.blend(px, py, dist > hw * 0.65 ? Sh[2] : Sh[0], 0.52 * (1 - coolK / 0.42));
        continue;
      }

      if (coolK > 0.36) {
        const gap = Math.sin(u * 44 + phase * 2.3) * 0.5 + Math.sin(u * 19 - phase) * 0.5;
        if (gap < -0.62 + (coolK - 0.36) * 1.95) continue;
      }

      if (sd < -hw * 0.90 || sd > hw * 1.05) continue;
      const q = clamp((sd + hw * 0.90) / (hw * 1.95), 0, 1);

      let col;
      if (q > 0.91) {
        col = flashK > 0.55 && v > 0.22 ? WHITE : C[0];
      } else if (q > 0.80) {
        col = flashK > 0.40 && v > 0.15 ? C[7] : coolK < 0.28 ? C[6] : coolK < 0.62 ? C[5] : C[3];
      } else if (q > 0.58) {
        col = coolK < 0.22 ? C[5] : coolK < 0.55 ? C[4] : C[3];
      } else if (q > 0.36 && q < 0.50 && hw > 3.0 && coolK < 0.70) {
        col = q > 0.42 ? C[0] : C[1];
      } else if (q > 0.20) {
        col = coolK < 0.32 ? C[3] : coolK < 0.68 ? C[2] : C[1];
      } else {
        col = coolK < 0.40 ? C[1] : C[0];
      }
      p.px(px, py, col);
    }
  }

  if (shadowOnly) return null;
  const tipX = bez(x0, cx, x1, uHead);
  const tipY = bez(y0, cy, y1, uHead);
  const tipDx = dbez(x0, cx, x1, uHead);
  const tipDy = dbez(y0, cy, y1, uHead);
  const midU = lerp(uTail, uHead, 0.52);
  return {
    tipX, tipY, tipDx, tipDy,
    midX: bez(x0, cx, x1, midU),
    midY: bez(y0, cy, y1, midU),
    uHead, flashK, coolK,
  };
}

// Translucent crimson-abyss wake veil spanning between adjacent rising talons during the violent upward rip
function drawClawWakeVeil(p, bA, bB, t, C, Sh) {
  const lt = t - bB.t0;
  if (lt <= 0 || lt >= 0.18) return;
  const k = lt / 0.18;
  const alpha = (1 - k) * 0.28;
  const uMax = ease.outQuart(clamp(lt / bB.sweepDur, 0, 1));
  for (let i = 2; i <= 18; i++) {
    const u = (i / 20) * uMax;
    const ax = bez(bA.x0, bA.cx, bA.x1, u), ay = bez(bA.y0, bA.cy, bA.y1, u);
    const bx = bez(bB.x0, bB.cx, bB.x1, u), by = bez(bB.y0, bB.cy, bB.y1, u);
    const mx = (ax + bx) * 0.5, my = (ay + by) * 0.5;
    const r = Math.hypot(bx - ax, by - ay) * 0.46;
    if (inStage(mx, my, r + 3) && my < -2) {
      p.disc(mx, my, r, i % 2 ? C[2] : Sh[1], alpha * Math.sin(PI * (i / 20)));
    }
  }
}

// Volumetric 3D-shaded black-purple shadow smoke puff (NO hollow soap-bubble ring!)
function drawShadowSmokeCloud(p, cx, cy, r, k, lx, ly, Sh, C, baseAlpha) {
  if (!inStage(cx, cy, r + 5) || r < 1.5) return;
  const toLightX = lx - cx, toLightY = ly - cy;
  const lDist = Math.hypot(toLightX, toLightY) || 1;
  const ux = toLightX / lDist, uy = toLightY / lDist;
  const rimHot = Math.max(0, 1 - k * 1.5) * clamp(1 - lDist / 92, 0, 1);

  p.disc(
    cx, cy, r,
    (d, ang) => {
      // Directional 3D sphere shading toward the crimson cross-scar core + top-violet ambient
      const ndl = Math.cos(ang) * ux + Math.sin(ang) * uy;
      const topBias = -Math.sin(ang) * 0.35;
      const lit = ndl * (0.35 + 0.65 * d) + topBias * d;
      if (lit > 0.52 && rimHot > 0.28) return mix(Sh[5], C[5], 0.42);
      if (lit > 0.28) return rimHot > 0.12 ? Sh[4] : Sh[3];
      if (lit > -0.10) return Sh[2];
      if (lit > -0.45) return Sh[1];
      return Sh[0];
    },
    // Soft solid core (alpha peaks at center d=0 and feathers smoothly to 0 at d=1 -> zero ring artifact!)
    (d) => baseAlpha * (1 - d * d * (0.82 + 0.18 * d)),
  );
}

// Draws the brief dark-crimson cross-shaped claw-scar flash branded onto the struck enemy's chest.
function drawCrimsonCrossScar(p, cx, cy, localT, dur, C) {
  if (localT <= 0 || localT >= dur) return;
  const k = localT / dur;
  const grow = ease.outExpo(clamp(k / 0.12, 0, 1));
  const seal = 1 - ease.inQuad(seg(k, 0.64, 1.0));
  const flash = 1 - seg(k, 0, 0.18);
  const pulse = 1 + 0.12 * Math.sin(localT * 40) * (1 - seg(k, 0.55, 1));

  const arms = [
    { ang: 0.12, len: 40 * grow * seal * pulse, w: 3.9 * seal },
    { ang: 0.12 + PI * 0.51, len: 36 * grow * seal * pulse, w: 3.6 * seal },
  ];

  const R = 46;
  const x0 = Math.max(X_MIN + 2, Math.floor(cx - R));
  const x1 = Math.min(X_MAX - 2, Math.ceil(cx + R));
  const y0 = Math.max(Y_MIN + 2, Math.floor(cy - R));
  const y1 = Math.min(0, Math.ceil(cy + R));

  const ca0 = Math.cos(arms[0].ang), sa0 = Math.sin(arms[0].ang);
  const ca1 = Math.cos(arms[1].ang), sa1 = Math.sin(arms[1].ang);

  for (let py = y0; py <= y1; py++) {
    const dy = py - cy;
    for (let px = x0; px <= x1; px++) {
      const dx = px - cx;
      let bestScore = -1, bestCore = 0, isOutline = false;

      for (let a = 0; a < 2; a++) {
        const ca = a === 0 ? ca0 : ca1;
        const sa = a === 0 ? sa0 : sa1;
        const L = arms[a].len, W = arms[a].w;
        if (L < 2) continue;

        const along = dx * ca + dy * sa;
        const perp = -dx * sa + dy * ca;
        const u = Math.abs(along) / L;

        if (u <= 1.04) {
          const jag = 1 + 0.10 * Math.sin(u * 26 + a * 2.1);
          const hw = W * Math.pow(Math.max(0, 1 - u), 0.70) * jag;
          const ap = Math.abs(perp);
          if (ap <= hw + 1.55) {
            if (ap > hw) isOutline = true;
            else {
              const cVal = 1 - ap / Math.max(0.4, hw);
              if (cVal > bestScore) { bestScore = cVal; bestCore = cVal * (1 - u * 0.36); }
            }
          }
        }

        // Twin flanking parallel claw-scratch marks (±5.2 px perpendicular) -> unmistakable 3-claw cross scar!
        const subL = L * 0.78;
        const uSub = Math.abs(along) / Math.max(1, subL);
        if (uSub <= 1.0 && seal > 0.22) {
          const sideDist = Math.abs(Math.abs(perp) - 5.2);
          const subHw = 1.35 * Math.pow(1 - uSub, 0.62) * seal;
          if (sideDist <= subHw + 1.05) {
            if (sideDist > subHw) isOutline = true;
            else {
              const sVal = 0.70 * (1 - sideDist / Math.max(0.35, subHw));
              if (sVal > bestScore) { bestScore = sVal; bestCore = sVal * 0.72; }
            }
          }
        }
      }

      if (bestScore >= 0) {
        let col;
        if (bestCore > 0.80 && flash > 0.45) col = WHITE;
        else if (bestCore > 0.64) col = flash > 0.18 ? C[7] : C[6];
        else if (bestScore > 0.42) col = k < 0.56 ? C[5] : C[4];
        else if (bestScore > 0.20) col = k < 0.68 ? C[3] : C[2];
        else col = C[1];
        p.px(px, py, col);
      } else if (isOutline && k < 0.88) {
        p.px(px, py, C[0]);
      }
    }
  }

  const ga = (1 - k) * 0.50;
  for (const arm of arms) {
    const ex = Math.cos(arm.ang) * arm.len * 0.90;
    const ey = Math.sin(arm.ang) * arm.len * 0.90;
    p.glowLine(cx - ex, cy - ey, cx + ex, cy + ey, 5, C[4], ga);
  }
  p.glow(cx, cy, 24 * seal, C[5], ga * 0.82);
}

// Gapped organic ground shockwave arcs hugging y = 0
function drawRuptureGroundShock(p, cx, cy, rx, ry, k, C, Sh, backHalf) {
  const segCount = 6;
  for (let s = 0; s < segCount; s++) {
    const a0 = (backHalf ? PI : 0) + (s + 0.14) * (PI / segCount);
    const a1 = (backHalf ? PI : 0) + (s + 0.82) * (PI / segCount);
    let px0 = cx + Math.cos(a0) * rx;
    let py0 = cy + Math.sin(a0) * ry;
    const col = s % 2 === 0 ? (k < 0.45 ? C[5] : C[3]) : (k < 0.45 ? Sh[5] : Sh[3]);
    for (let j = 1; j <= 4; j++) {
      const a = lerp(a0, a1, j / 4);
      const px1 = cx + Math.cos(a) * rx;
      const py1 = cy + Math.sin(a) * ry;
      if (inStage(px0, py0, 3) && inStage(px1, py1, 3)) {
        p.line(px0, py0, px1, py1, col);
      }
      px0 = px1; py0 = py1;
    }
  }
}

export function create(o) {
  const C  = fit(o.palette ?? CRIMSON, 8);
  const Sh = fit(o.shadow ?? SHADOW, 7);
  const S  = fit(o.soil ?? SOIL, 8);
  const R  = new Rng(o.seed);
  const seed = (o.seed | 0) * 31 + 7;
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, C[7], C[6], C[5], C[4]],
    haze: Sh[3],
  });
  const clods = new Bits({ ground: floor });
  const lights = new Lights();

  // Phase 1: Bone-chilling black-purple cold mist (黑紫色冷气)
  const coldPuffs = new Puffs({
    rng: R,
    flame: [Sh[6], Sh[5], Sh[4], Sh[3], Sh[2], Sh[1], Sh[0]],
    soot: [Sh[2], Sh[1]],
    cap: Sh[4],
    rim: [Sh[6], Sh[5], Sh[4]],
    floor,
  });

  // Phase 3: Bursting black-purple shadow smoke (爆散出黑紫色的暗影烟雾)
  const hitSmoke = new Puffs({
    rng: R,
    flame: [C[6], C[5], Sh[5], Sh[4], Sh[3], Sh[2], Sh[1]],
    soot: [Sh[2], Sh[1]],
    cap: Sh[3],
    rim: [Sh[5], mix(Sh[5], C[5], 0.45), Sh[3]],
    floor,
  });

  const coldChills = Array.from({ length: 20 }, () => ({
    x0: TX + R.range(-28, 28),
    y0: -R.range(1, 7),
    vx: R.range(-18, 18),
    vy: -R.range(30, 64),
    t0: R.range(0.04, 0.36),
    life: R.range(0.28, 0.48),
    big: R.chance(0.48),
  }));

  const slabs = [-1, 1, -0.48, 0.52].map((sd) => ({
    sd: Math.sign(sd),
    x: TX + sd * R.range(16, 22),
    pts: stoneShape(R),
    s: Math.abs(sd) < 0.8 ? R.range(4.0, 5.2) : R.range(5.8, 7.4),
    a: Math.sign(sd) * R.range(0.45, 0.72),
  }));

  const ringSegs = Array.from({ length: 8 }, (_, i) => ({
    a: (i / 8) * TAU + R.range(-0.1, 0.1),
    gap: R.range(0.42, 0.72),
    dr: R.range(0.2, 0.45),
  }));

  // Three ferocious hooked dark-crimson claw blade crescents tearing bottom-to-top!
  const claws = [
    {
      t0: T_ERUPT,
      x0: TX - 18, y0: 1, cx: TX + 26, cy: -56, x1: TX - 28, y1: -124,
      width: 8.6, phase: 0.4, sweepDur: 0.082, holdDur: 0.075, fadeDur: 0.64,
    },
    {
      t0: T_ERUPT + 0.022,
      x0: TX, y0: 1, cx: TX + 54, cy: -68, x1: TX - 12, y1: -148,
      width: 11.4, phase: 2.1, sweepDur: 0.086, holdDur: 0.085, fadeDur: 0.70,
    },
    {
      t0: T_ERUPT + 0.044,
      x0: TX + 18, y0: 1, cx: TX + 80, cy: -78, x1: TX + 8, y1: -163,
      width: 9.2, phase: 4.0, sweepDur: 0.084, holdDur: 0.075, fadeDur: 0.64,
    },
  ];

  // Caster upward-rip aura slash at T_ERUPT (snug to caster's raised claw in both act & static preview)
  const casterRipArc = {
    t0: T_ERUPT,
    x0: 12, y0: -8, cx: 22, cy: -22, x1: 11, y1: -39,
    width: 2.8, phase: 1.2, sweepDur: 0.045, holdDur: 0.02, fadeDur: 0.08,
  };

  // Curved upward sonic wind-shear ribbons ("自下而上猛然撕裂空气")
  const windShear = Array.from({ length: 14 }, (_, i) => {
    const lane = i % 3;
    const base = claws[lane];
    const off = R.range(-9, 10);
    return {
      t0: base.t0 + R.range(0.008, 0.038),
      dur: R.range(0.16, 0.27),
      x0: base.x0 + off, y0: 0,
      cx: base.cx + off * 1.12, cy: base.cy * R.range(0.86, 1.04),
      x1: base.x1 + off * 1.12, y1: base.y1 * R.range(0.85, 1.02),
      bright: i % 2 === 0,
    };
  });

  const hitBolts = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * TAU + R.range(-0.24, 0.24);
    const len = R.range(26, 54);
    const pts = [[0, 0]];
    for (let s = 1; s <= 5; s++) {
      const u = s / 5;
      const jit = s === 5 ? 0 : R.range(-7.5, 7.5);
      const pa = a + PI * 0.5;
      pts.push([
        Math.cos(a) * len * u + Math.cos(pa) * jit,
        Math.sin(a) * len * u + Math.sin(pa) * jit,
      ]);
    }
    return { t0: T_HIT + R.range(0, 0.07), dur: R.range(0.12, 0.22), pts };
  });

  // Multi-lobed volumetric black-purple shadow smoke clouds (NO hollow rings!)
  const shadowClouds = Array.from({ length: 22 }, (_, i) => {
    const a = R.range(0, TAU);
    const sp = R.range(34, 134);
    return {
      x0: R.range(-8, 8), y0: R.range(-10, 10),
      vx: Math.cos(a) * sp + 15, vy: Math.sin(a) * sp - 18,
      drag: R.range(2.1, 3.2), gy: -R.range(8, 22),
      r0: R.range(5.0, 8.5), r1: R.range(10.0, 15.5),
      lobeAng: R.range(0, TAU),
      t0: T_HIT + R.range(0.0, 0.12), life: R.range(0.65, 1.28),
      back: i % 3 === 0,
    };
  });

  // Luminous RED-LIGHT PARTICLES (红光粒子: glowing red diamond motes + cross-scar tip droplets)
  const redLightOrbs = Array.from({ length: 36 }, () => {
    const a = R.range(0, TAU);
    const sp = R.range(44, 172);
    return {
      x0: R.range(-7, 7), y0: R.range(-9, 9),
      vx: Math.cos(a) * sp + 16, vy: Math.sin(a) * sp - 20,
      drag: R.range(1.7, 2.9), gy: R.range(-26, 34),
      t0: T_HIT + R.range(0.0, 0.15), life: R.range(0.62, 1.35),
      sz: R.pick([1.5, 2.0, 2.5]), phase: R.range(0, TAU),
    };
  });

  let t = 0, slamDone = false, eruptDone = false, hitDone = false, mistAcc = 0, burrowStep = 0;

  return {
    update(dt) {
      t += dt;
      const f = Math.min(1, dt * 120);

      // 0.00s: Caster claw-slam shock burst at (15, 0)
      if (!slamDone && t >= 0) {
        slamDone = true;
        lights.add(15, -6, 38, C[4], 0.50, 0.22);
        for (let i = 0; i < 14; i++) {
          ps.spawn(P.DUST, 15 + R.range(-7, 9), -1, R.range(-34, 58), -R.range(8, 28), R.range(0.34, 0.58), S[5], R.range(2.4, 4.4));
        }
        for (let i = 0; i < 14; i++) {
          ps.spawn(P.SPARK, 15 + R.range(-4, 8), -2, R.range(-20, 88), -R.range(28, 78), R.range(0.18, 0.38));
        }
      }

      // 0.02..0.14s: Sequential underground burrow spurts racing from caster to TX!
      while (burrowStep < 4 && t >= 0.025 + burrowStep * 0.028) {
        const bx = lerp(34, TX - 18, (burrowStep + 0.5) / 4);
        burrowStep++;
        for (let i = 0; i < 4; i++) {
          ps.spawn(P.GRIT, bx + R.range(-4, 4), -1, R.range(-18, 32), -R.range(36, 78), R.range(0.24, 0.44), R.pick([S[6], S[5]]), 1);
        }
        ps.spawn(P.VAPOUR, bx, -2, R.range(-8, 16), -R.range(16, 36), R.range(0.26, 0.42), Sh[4], R.range(2.8, 4.5));
      }

      // 0.03..0.46s: Target-foot Black-Purple Cold Mist (黑紫色冷气) & Churning Soil Particles (翻滚的泥土粒子)
      if (t >= 0.03 && t < T_ERUPT) {
        const rampK = smooth(0.03, T_ERUPT, t);
        for (mistAcc += dt * (44 + 58 * rampK); mistAcc > 1; mistAcc--) {
          const lowCreep = R.chance(0.35);
          coldPuffs.spawn(
            PK.SOOT,
            TX + R.range(-28, 28),
            -R.range(1, 8),
            lowCreep ? R.sign() * R.range(32, 74) : R.range(-28, 28),
            lowCreep ? -R.range(8, 24) : -R.range(36, 86),
            R.range(0.44, 0.78),
            R.range(5.5, 9.8),
          );
        }
        if (R.chance(0.68 * f)) {
          ps.spawn(P.VAPOUR, TX + R.range(-26, 26), -R.range(1, 10), R.range(-22, 22), -R.range(28, 68), R.range(0.36, 0.66), R.pick([Sh[4], Sh[5], Sh[3]]), R.range(3.6, 6.8));
        }
        if (R.chance(0.92 * f)) {
          const sd = R.sign();
          ps.spawn(P.GRIT, TX + R.range(-24, 24), -1, sd * R.range(20, 86), -R.range(65, 168), R.range(0.38, 0.76), R.pick([S[7], S[6], S[5], S[4]]), R.chance(0.55) ? 2 : 1);
        }
        if (R.chance(0.56 * f)) {
          const sd = R.sign();
          ps.spawn(P.DUST, TX + sd * R.range(3, 22), -1, sd * R.range(26, 86), -R.range(8, 30), R.range(0.38, 0.68), S[5], R.range(2.8, 5.4));
        }
        if (R.chance(0.46 * f)) {
          clods.add({
            kind: B.CHUNK,
            x: TX + R.range(-20, 20), y: -1,
            vx: R.range(-72, 72), vy: -R.range(85, 172),
            g: 1, drag: 0.36, bounce: 0.32,
            life: R.range(0.52, 0.92),
            a: R.range(0, TAU), va: R.range(-14, 14),
            s: R.range(2.0, 3.6), pts: stoneShape(R),
          });
        }
      }

      // 0.46s: Ground Rupture — Soil fountain + caster skyward rip glare + crimson ground light
      if (!eruptDone && t >= T_ERUPT) {
        eruptDone = true;
        lights.add(24, -28, 34, C[5], 0.44, 0.18);
        lights.add(TX + 16, -58, 92, C[5], 0.68, 0.44);
        lights.add(TX, -12, 52, Sh[4], 0.50, 0.36);
        for (let i = 0; i < 24; i++) {
          const a = -PI / 2 + R.range(-1.02, 1.02), sp = R.range(130, 315);
          clods.add({
            kind: B.CHUNK,
            x: TX + R.range(-16, 16), y: -2,
            vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            g: 1, drag: 0.36, bounce: 0.32,
            life: R.range(0.95, 1.65),
            a: R.range(0, TAU), va: R.range(-14, 14),
            s: R.range(2.1, 4.1), pts: stoneShape(R),
          });
        }
        for (let i = 0; i < 54; i++) {
          const a = -PI / 2 + R.range(-1.08, 1.08), sp = R.range(95, 290);
          ps.spawn(P.GRIT, TX + R.range(-16, 16), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.75, 1.45), R.pick([S[7], S[6], S[5], S[4]]), R.chance(0.45) ? 2 : 1);
        }
        for (let i = 0; i < 14; i++) {
          const sd = R.sign();
          ps.spawn(P.SMOKE, TX + sd * R.range(2, 14), -2, sd * R.range(54, 162), -R.range(6, 28), R.range(0.70, 1.25), S[5], R.range(3.6, 6.2), 0, PF.BIG);
        }
      }

      // 0.49s: Hit & Hit-Result — Exploding Black-Purple Shadow Smoke & Red-Light Particles!
      if (!hitDone && t >= T_HIT) {
        hitDone = true;
        const hx = targetCenterX(T_CROSS);
        lights.add(hx, -28, 82, C[5], 0.82, 0.56);
        lights.add(hx, -28, 32, WHITE, 0.50, 0.08);

        for (let i = 0; i < 28; i++) {
          const a = R.range(0, TAU), sp = R.range(40, 148);
          hitSmoke.spawn(
            PK.SOOT,
            hx + R.range(-8, 8), -28 + R.range(-10, 10),
            Math.cos(a) * sp + 16, Math.sin(a) * sp - 18,
            R.range(0.62, 1.22), R.range(5.8, 10.4),
          );
        }
        for (let i = 0; i < 20; i++) {
          const a = R.range(0, TAU), sp = R.range(38, 134);
          ps.spawn(P.VAPOUR, hx + R.range(-6, 6), -28 + R.range(-8, 8), Math.cos(a) * sp + 14, Math.sin(a) * sp - 14, R.range(0.45, 0.92), R.pick([Sh[4], Sh[5], Sh[3]]), R.range(4.2, 7.6));
        }

        // Fast crimson-red light streaks & rising red embers
        for (let i = 0; i < 46; i++) {
          const a = R.range(0, TAU), sp = R.range(98, 300);
          ps.spawn(P.SPARK, hx + R.range(-6, 6), -28 + R.range(-8, 8), Math.cos(a) * sp + 20, Math.sin(a) * sp - 24, R.range(0.30, 0.76), R.pick([C[6], C[5], C[7]]), R.chance(0.40) ? 2 : 1);
        }
        for (let i = 0; i < 26; i++) {
          const a = R.range(0, TAU), sp = R.range(32, 118);
          ps.spawn(P.EMBER, hx + R.range(-10, 12), -28 + R.range(-12, 10), Math.cos(a) * sp + 12, Math.sin(a) * sp - 38, R.range(0.62, 1.28), R.pick([C[5], C[6], C[4]]), R.chance(0.55) ? 2 : 1);
        }
      }

      coldPuffs.update(dt);
      hitSmoke.update(dt);
      clods.update(dt);
      ps.update(dt);
      for (const arr of [clods.list, ps.list]) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const q = arr[i];
          if (!inStage(q.x, q.y, 3) || t >= T_END - 0.04) arr.splice(i, 1);
        }
      }
      if (t >= T_END - 0.04) {
        coldPuffs.list.length = 0;
        hitSmoke.list.length = 0;
        lights.list.length = 0;
      } else {
        lights.update(dt);
      }
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;
      const hx = targetCenterX(t);
      const hy = -28;

      // Subterranean black-purple & crimson pulse racing from caster (15, 0) to TX
      if (t < 0.36) {
        const head = 15 + ease.outCubic(clamp(t / 0.14)) * (TX - 15);
        const tail = 15 + ease.outCubic(clamp((t - 0.08) / 0.18)) * (TX - 15);
        const fade = 1 - smooth(0.18, 0.36, t);
        if (head > tail + 2 && fade > 0.02) {
          for (let px = Math.floor(tail); px <= Math.floor(head); px += 2) {
            const jy = rand(px, 13, seed) > 0.55 ? 1 : 0;
            const u = (px - tail) / Math.max(1, head - tail);
            p.dot(px, jy, u > 0.65 ? C[5] : Sh[4], fade * (0.45 + 0.55 * u));
          }
          p.glow(head, 0, 15, C[4], 0.44 * fade);
        }
      }

      // Target-foot cold shadow pool & crimson fissure aura
      const teleA = t < T_ERUPT ? smooth(0.02, 0.14, t) : 1 - smooth(1.55, T_END - 0.14, t);
      if (teleA > 0.02) {
        const w = 29 * smooth(0.02, 0.28, t);
        p.line(TX - w, 0, TX + w, 0, Sh[0], teleA);
        p.line(TX - w * 0.88, 1, TX + w * 0.88, 1, t < T_ERUPT ? Sh[4] : C[3], teleA * 0.92);
        p.glow(TX, -10, 48, t < T_ERUPT ? Sh[4] : C[4], (t < T_ERUPT ? 0.56 : 0.24) * teleA);
      }

      // Far half of gapped ground shockwave on eruption
      if (t >= T_ERUPT && t < T_ERUPT + 0.34) {
        const rk = ease.outQuart(seg(t, T_ERUPT, T_ERUPT + 0.34));
        drawRuptureGroundShock(p, TX + 6, 0, 16 + rk * 66, 3 + rk * 10, rk, C, Sh, true);
      }

      // Pre-eruption cold black-purple mist behind target
      coldPuffs.draw(p, PK.SOOT, { x: TX, y: -16, k: t < T_ERUPT + 0.35 ? 0.92 : 0.28, reach: 74 });

      // Back volumetric clouds of exploding black-purple shadow smoke on hit
      for (const sc of shadowClouds) {
        if (!sc.back) continue;
        const lt = t - sc.t0;
        if (lt <= 0 || lt >= sc.life) continue;
        const k = lt / sc.life;
        const e = (1 - Math.exp(-sc.drag * lt)) / sc.drag;
        const bx = hx + sc.x0 + sc.vx * e;
        const by = hy + sc.y0 + sc.vy * e + 0.5 * sc.gy * lt * lt;
        const r = lerp(sc.r0, sc.r1, ease.outQuad(k));
        const a = (1 - ease.inQuad(seg(k, 0.32, 1.0))) * 0.66;
        drawShadowSmokeCloud(p, bx, by, r, k, hx, hy, Sh, C, a);
      }

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;
      const hx = targetCenterX(t);
      const hy = -28;

      // 0. Caster slam claw-shock at (15, 0) (0.00..0.14s) + skyward claw-pull arc at T_ERUPT!
      if (t >= 0 && t < 0.14) {
        const sk = t / 0.14;
        const sw = 12 * ease.outQuad(1 - sk * 0.45);
        p.line(15 - sw * 0.5, 0, 15 + sw, 0, sk < 0.4 ? C[6] : C[4]);
        p.line(13, -9 * (1 - sk), 17, 0, sk < 0.35 ? WHITE : C[5]);
        p.line(17, -7 * (1 - sk), 21, 0, C[5]);
      }
      drawRisingClawBlade(p, casterRipArc, t - casterRipArc.t0, C, Sh, false);

      // 1. Pre-eruption boiling soil mound & glowing subterranean cracks (0.03..0.48s)
      if (t >= 0.03 && t < T_ERUPT + 0.04) {
        const k = smooth(0.03, T_ERUPT, t);
        const hm = 10.5 * k;
        const jx = Math.sin(t * 98) * 1.5 * k;
        if (hm > 0.6) {
          p.shade(TX - 28, -hm - 2, TX + 28, 1, (x, y, out) => {
            const lobe = 1 + 0.18 * Math.sin((x - TX) * 0.35 + t * 18);
            const dx = (x - (TX + jx)) / 26, dy = y / (hm * lobe), d = dx * dx + dy * dy;
            if (y > 0.5 || d > 1.14) return;
            out.c = d > 1 ? Sh[0] : dy < -0.68 ? S[6] : dx < -0.20 ? S[5] : S[3];
          });
          if (k > 0.28) {
            const hot = seg(t, 0.26, T_ERUPT);
            const cc = hot > 0.45 ? C[5] : Sh[5];
            p.line(TX - 16 + jx, 0, TX - 3, -hm * 0.85, cc);
            p.line(TX - 3, -hm * 0.85, TX + 9 + jx, -1, hot > 0.6 ? C[6] : Sh[4]);
            p.line(TX + 5, -hm * 0.6, TX + 17 + jx, 0, cc);
          }
        }
      }

      // Translucent curling cold black-purple mist & frost-shadow micro-crystals around ankles (Phase 1)
      if (t >= 0.05 && t < 0.58) {
        const ma = seg(t, 0.05, 0.20) * (1 - seg(t, 0.42, 0.58));
        for (let i = 0; i < 7; i++) {
          const u = (i - 3) * 8.5 + Math.sin(t * 9.5 + i * 1.6) * 4.0;
          const lift = ((t - 0.05) * 38 + i * 5.2) % 30;
          p.disc(TX + u, -3 - lift, 7.2 - lift * 0.14, i % 2 ? Sh[2] : Sh[1], 0.38 * ma);
          p.disc(TX + u * 0.82, -6 - lift * 0.85, 4.0, Sh[4], 0.24 * ma);
        }
        for (const ch of coldChills) {
          const lt = t - ch.t0;
          if (lt <= 0 || lt >= ch.life) continue;
          const ck = lt / ch.life;
          const cx = ch.x0 + ch.vx * lt + Math.sin(lt * 18 + ch.x0) * 2.2;
          const cy = ch.y0 + ch.vy * lt;
          if (!inStage(cx, cy, 4)) continue;
          const col = ck < 0.45 ? Sh[6] : Sh[5];
          p.px(cx, cy, col);
          if (ch.big && ck < 0.72) {
            p.px(cx - 1, cy, Sh[4]); p.px(cx + 1, cy, Sh[4]);
            p.px(cx, cy - 1, Sh[5]); p.px(cx, cy + 1, Sh[4]);
          }
        }
      }

      // 2. Uplifted ground slabs that physically sink back into the ground (no Bayer dither checkerboard!)
      if (t >= T_ERUPT && t < 2.22) {
        const sinkK = ease.inQuad(seg(t, 1.55, 2.22));
        const g = ease.outBack(clamp((t - T_ERUPT) / 0.10), 2);
        const sc = Math.min(1, g) * (1 - sinkK * 0.88);
        if (sc > 0.18) {
          for (const sl of slabs) {
            drawRock(p, sl.x, -1 + sinkK * 4.5, sl.s * sc, sl.a * g * (1 - sinkK * 0.5), sl.pts, S, 1, t - T_ERUPT < 0.05);
          }
        }
      }

      if (t >= T_ERUPT && t < T_ERUPT + 0.34) {
        const rk = ease.outQuart(seg(t, T_ERUPT, T_ERUPT + 0.34));
        drawRuptureGroundShock(p, TX + 6, 1, 16 + rk * 66, 3 + rk * 10, rk, C, Sh, false);
      }

      // 3. Bursting volumetric black-purple shadow smoke on hit (multi-lobed solid clouds + PK.SOOT!)
      if (t >= T_HIT) {
        for (const sc of shadowClouds) {
          if (sc.back) continue;
          const lt = t - sc.t0;
          if (lt <= 0 || lt >= sc.life) continue;
          const k = lt / sc.life;
          const e = (1 - Math.exp(-sc.drag * lt)) / sc.drag;
          const bx = hx + sc.x0 + sc.vx * e;
          const by = hy + sc.y0 + sc.vy * e + 0.5 * sc.gy * lt * lt;
          const r = lerp(sc.r0, sc.r1, ease.outQuad(k));
          const a = (1 - ease.inQuad(seg(k, 0.32, 1.0))) * 0.64;
          drawShadowSmokeCloud(p, bx, by, r, k, hx, hy, Sh, C, a);
          // Secondary cloud lobe so smoke silhouettes are organic billowing clusters, never single circles
          const lx2 = bx + Math.cos(sc.lobeAng + lt * 1.4) * r * 0.48;
          const ly2 = by + Math.sin(sc.lobeAng + lt * 1.4) * r * 0.42;
          drawShadowSmokeCloud(p, lx2, ly2, r * 0.68, k, hx, hy, Sh, C, a * 0.82);
        }

        hitSmoke.draw(p, PK.SOOT, {
          x: hx, y: hy,
          k: t < T_CROSS + 0.52 ? 0.94 : 0.32,
          reach: 84,
        });
      }

      // 4. THREE FEROCIOUS DARK-CRIMSON CLAW BLADES TEARING AIR BOTTOM-TO-TOP!
      //    First draw abyssal shadow double-echoes behind the blades for oppressive depth:
      for (let i = 0; i < claws.length; i++) {
        drawRisingClawBlade(p, claws[i], t - claws[i].t0, C, Sh, true);
      }
      drawClawWakeVeil(p, claws[0], claws[1], t, C, Sh);
      drawClawWakeVeil(p, claws[1], claws[2], t, C, Sh);

      for (let i = 0; i < claws.length; i++) {
        const cl = claws[i];
        const info = drawRisingClawBlade(p, cl, t - cl.t0, C, Sh, false);
        if (info) {
          const gAlpha = (1 - info.coolK) * 0.42;
          p.glow(info.midX, info.midY, 26, C[4], gAlpha);
          if (info.flashK > 0.12) {
            drawBladeTipGlint(p, info.tipX, info.tipY, info.tipDx, info.tipDy, 14, C, info.flashK);
          }
        }
      }

      // Upward sonic wind-shear ribbons ("猛然撕裂空气")
      for (const ws of windShear) {
        const lt = t - ws.t0;
        if (lt <= 0 || lt >= ws.dur) continue;
        const k = lt / ws.dur;
        const u0 = ease.inQuad(seg(k, 0.14, 1.0)) * 0.80;
        const u1 = ease.outCubic(clamp(k / 0.52, 0, 1));
        if (u1 - u0 < 0.05) continue;
        let px0 = bez(ws.x0, ws.cx, ws.x1, u0);
        let py0 = bez(ws.y0, ws.cy, ws.y1, u0);
        const col = ws.bright ? (k < 0.36 ? C[7] : C[5]) : (k < 0.42 ? Sh[5] : C[3]);
        for (let s = 1; s <= 10; s++) {
          const u = lerp(u0, u1, s / 10);
          const px1 = bez(ws.x0, ws.cx, ws.x1, u);
          const py1 = bez(ws.y0, ws.cy, ws.y1, u);
          if (inStage(px0, py0, 3) && inStage(px1, py1, 3)) {
            p.line(px0, py0, px1, py1, col);
          }
          px0 = px1; py0 = py1;
        }
      }

      // 5. Oppressive impact shockwaves & black-rimmed crimson lightning ("压迫感")
      const qHit = t - T_HIT;
      if (qHit >= 0 && qHit < 0.36) {
        const u = qHit / 0.36;
        brokenRing(p, hx, hy, 14 + 50 * ease.outCubic(u), 2.6 * (1 - u), ringSegs, u * 0.85, C[5], Sh[4], 1 - u, 0.86, 0);
        frontCrescent(p, hx + 16 + 28 * u, 1, 26 * (1 - u * 0.55), 7 * (1 - u), [C[6], C[4], Sh[2]], 1 - u);
        frontCrescent(p, TX - 16 - 20 * u, -1, 18 * (1 - u * 0.55), 5 * (1 - u), [Sh[5], Sh[3], Sh[1]], 1 - u);
      }

      for (const b of hitBolts) {
        const lt = t - b.t0;
        if (lt <= 0 || lt >= b.dur) continue;
        const k = lt / b.dur;
        const nSeg = Math.ceil(ease.outQuad(clamp(k / 0.35, 0, 1)) * (b.pts.length - 1));
        for (let i = 0; i < nSeg; i++) {
          const [ax, ay] = b.pts[i], [bx, by] = b.pts[i + 1];
          if (!inStage(hx + bx, hy + by, 4)) continue;
          p.line(hx + ax - 1, hy + ay, hx + bx - 1, hy + by, C[0]);
          p.line(hx + ax + 1, hy + ay, hx + bx + 1, hy + by, C[0]);
          p.line(hx + ax, hy + ay - 1, hx + bx, hy + by - 1, C[0]);
          p.line(hx + ax, hy + ay + 1, hx + bx, hy + by + 1, C[0]);
        }
        const coreCol = k < 0.3 ? WHITE : k < 0.65 ? C[6] : C[4];
        for (let i = 0; i < nSeg; i++) {
          const [ax, ay] = b.pts[i], [bx, by] = b.pts[i + 1];
          if (!inStage(hx + bx, hy + by, 4)) continue;
          p.line(hx + ax, hy + ay, hx + bx, hy + by, coreCol);
        }
      }

      // Soil clods & particles (fade cleanly without dither lingering)
      for (const b of clods.list) {
        if (inStage(b.x, b.y, 6) && b.life > 0.08) {
          const sc = Math.min(1, b.life / 0.28);
          drawRock(p, b.x, b.y, b.s * sc, b.a, b.pts, S, 1);
        }
      }
      ps.draw(p, "front");

      // 6. Luminous RED-LIGHT PARTICLES (红光粒子)
      for (const m of redLightOrbs) {
        const lt = t - m.t0;
        if (lt <= 0 || lt >= m.life) continue;
        const k = lt / m.life;
        const e = (1 - Math.exp(-m.drag * lt)) / m.drag;
        const mx = hx + m.x0 + m.vx * e;
        const my = hy + m.y0 + m.vy * e + 0.5 * m.gy * lt * lt;
        if (!inStage(mx, my, 9)) continue;
        const fade = 1 - ease.inQuad(seg(k, 0.45, 1.0));
        const flick = 0.78 + 0.22 * Math.sin(t * 30 + m.phase);
        p.glow(mx, my, 9 * fade, C[5], 0.46 * fade * flick);
        if (m.sz * fade >= 1.35) {
          const armCol = k < 0.55 ? C[5] : C[4];
          p.px(mx - 1, my, armCol); p.px(mx + 1, my, armCol);
          p.px(mx, my - 1, armCol); p.px(mx, my + 1, armCol);
          p.px(mx, my, k < 0.35 ? WHITE : C[7]);
        } else {
          p.px(mx, my, k < 0.55 ? C[6] : C[4]);
        }
      }

      lights.draw(p);

      // Oppressive jagged abyssal pressure teeth biting into ambient glow around the struck enemy (unlight)
      if (t >= T_HIT && t < T_HIT + 0.44) {
        const uk = 1 - seg(t, T_HIT + 0.12, T_HIT + 0.44);
        unlight(p, hx - 74, hy - 74, hx + 74, 2, (x, y) => {
          const dx = x - hx, dy = y - hy;
          const d = Math.hypot(dx, dy);
          const ang = Math.atan2(dy, dx);
          const jagIn = 42 + 10 * Math.sin(ang * 9 + t * 22) + 6 * Math.cos(ang * 5 - 1.3);
          const jagOut = 70 + 8 * Math.cos(ang * 7 - t * 14);
          if (d < jagIn || d > jagOut) return false;
          const edge = Math.min((d - jagIn) / 10, (jagOut - d) / 12, 1);
          return rand(x | 0, y | 0, seed) < edge * 0.85;
        }, 1 - 0.55 * uk);
      }

      // 7. Brief DARK-CRIMSON CROSS CLAW-SCAR FLASH branded onto the enemy's chest!
      drawCrimsonCrossScar(p, hx, hy, t - T_CROSS, 0.52, C);
    },
  };
}
