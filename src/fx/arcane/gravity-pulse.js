// Supernatural anti-gravity field pulse: a periodic pale-blue anti-gravity ripple expands across the floor,
// lifting faceted stones (wreathed in weak crawling electric arcs) and luminous water droplets into a slow
// upward-floating spiral; they pause suspended at their apex for 1 full second, then fall back under gravity
// as the ripple dissipates, bouncing realistically on impact and kicking up soft puffs of luminous light-dust.
// Faceted stone rendering follows src/fx/nature/_lib.js and arc inking follows src/fx/lightning/_lib.js,
// adapted from Sprite Fusion's open-source pixel art VFX (https://www.spritefusion.com/pixel-art-vfx),
// MIT License, Copyright (c) 2026 Hugo Duprez.

import {
  Rng, fit, sparkle, clamp, smooth, lerp, ease, rng, mix, TAU, WHITE,
} from "../../core/index.js";
import { stoneShape, drawRock } from "../nature/_lib.js";
import { mote } from "./_lib.js";
import { rows } from "../weather/_lib.js";

export const meta = {
  name: "Gravity pulse",
  desc: "A pale-blue anti-gravity ripple sweeps the floor, lifting rotating arc-laced stones and water droplets to hover for a second at apex before dropping in puffs of light-dust.",
  tags: ["arcane", "gravity", "pulse", "levitate", "float", "electric", "water", "earth", "ambient", "ground", "loop"],
  size: [224, 164],
  origin: [112, 128],
  duration: 3.6,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#051024", "#0b2248", "#14427c", "#1e6ec4", "#38a4f8", "#74d4ff", "#c4f2ff", "#ffffff"],
    stone: ["#0d0e18", "#1a1d2e", "#282d44", "#3a4262", "#525d84", "#7180ab", "#98aad4", "#cce0ff"],
    water: ["#041c32", "#0a3e66", "#1476b8", "#2ec4f8", "#9cf6ff", "#ffffff"],
    seed: 17,
  },
};

const D = meta.duration; // 4.0s
const FPS = meta.fps;
const SY = 0.27;
const R_MAX = 94;
const [OX] = meta.origin;

// Smooth C1 Hermite step 0..1
const sstep = (u) => {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
};

// Fast perspective ellipse ring drawer
function drawFastEllipseRing(p, cx, cy, rx, ry, col, alpha = 1, half = 0, dashFreq = 0, dashPhase = 0, dashCut = -1) {
  if (rx < 0.8 || alpha <= 0.02) return;
  const n = Math.max(16, Math.ceil((rx + ry) * 3.2));
  for (let i = 0; i < n; i++) {
    const g = (i / n) * TAU;
    const s = Math.sin(g);
    if ((half < 0 && s >= 0) || (half > 0 && s < 0)) continue;
    if (dashFreq > 0 && Math.sin(g * dashFreq + dashPhase) < dashCut) continue;
    const c = typeof col === "function" ? col(g) : col;
    p.blend(cx + Math.cos(g) * rx, cy + s * ry, c, alpha);
  }
}

// Precomputed deterministic layout of stones, water droplets, and landing dust specs per seed
const sceneCache = new Map();

function getScene(seed) {
  if (sceneCache.has(seed)) return sceneCache.get(seed);
  const R = new Rng(seed);

  // 15 faceted stones distributed across 3 vertical tiers (high, mid, low) for a rich 3D volume
  const stonePresets = [
    // [x0, z0, size, peakY, turns, dir]
    [0, 2.0, 7.2, 56, 1, 1],       // Central hero monolith
    [-25, -3.5, 5.5, 76, 1, -1],   // High inner-left rock
    [26, 2.8, 5.3, 72, 1, 1],      // High inner-right rock
    [-13, -7.2, 4.1, 88, 2, -1],   // Crown apex left shard
    [14, -6.5, 4.0, 84, 2, 1],     // Crown apex right shard
    [-46, 4.2, 4.7, 52, 1, 1],     // Mid outer-left rock
    [48, -2.5, 4.8, 55, 1, -1],    // Mid outer-right rock
    [-35, -5.0, 3.6, 64, 1, -1],   // Mid-high left
    [37, 5.2, 3.7, 62, 1, 1],      // Mid-high right
    [-18, 6.8, 3.4, 34, 1, 1],     // Low foreground left rock
    [20, 7.2, 3.3, 32, 1, -1],     // Low foreground right rock
    [-64, 1.5, 3.3, 38, 1, 1],     // Outer wing left rock
    [66, 2.0, 3.2, 40, 1, -1],     // Outer wing right rock
    [-54, -4.5, 2.6, 26, 2, -1],   // Low outer pebble left
    [56, 4.8, 2.5, 24, 2, 1],      // Low outer pebble right
  ];

  const stones = stonePresets.map(([bx, bz, bs, bPeak, turns, dir], idx) => {
    const x0 = bx + R.range(-1.8, 1.8);
    const z0 = bz + R.range(-0.9, 0.9);
    const y0 = z0;
    const s = bs * R.range(0.95, 1.05);
    const peakY = bPeak + R.range(-3.0, 3.0);
    const rDist = Math.hypot(x0, z0 / SY);
    const delay = clamp((rDist / R_MAX) * 0.20, 0.01, 0.22);
    // Physical free-fall duration scales with sqrt(peakY) (~0.29s for low rocks, ~0.38s for high rocks)
    const fallDur = 0.20 + 0.18 * Math.sqrt(peakY / 90);
    const bounce1Dur = 0.15 + 0.05 * (s / 7.2);
    const bounce2Dur = 0.09 + 0.03 * (s / 7.2);
    const pts = stoneShape(R, s > 4.2 ? 7 : 6);
    const a0 = R.range(0, TAU);
    const orbitRx = R.range(2.4, 5.2) * dir;
    const bobPhase = R.range(0, TAU);

    // Precompute 5 landing light-dust puff specs, 7 glowing mote specs, and 3 hopping grit chips per stone
    const puffs = Array.from({ length: 5 }, (_, k) => ({
      side: k % 2 === 0 ? -1 : 1,
      dist: s * 0.78 + R.range(4.0, 12.5),
      lift: R.range(3.0, 8.2),
      r0: R.range(1.5, 2.3) * (0.7 + s * 0.08),
      r1: R.range(3.5, 5.4) * (0.7 + s * 0.08),
      life: R.range(0.46, 0.68),
      delay: R.range(0, 0.04),
    }));
    const dustMotes = Array.from({ length: 7 }, () => ({
      vx: R.range(-26, 26),
      vy: -R.range(16, 38),
      ox: R.range(-s * 0.8, s * 0.8),
      life: R.range(0.44, 0.68),
      twinkle: R.chance(0.55),
      phase: R.range(0, TAU),
    }));
    const gritChips = Array.from({ length: 3 }, () => ({
      vx: R.sign() * R.range(14, 38),
      vy: -R.range(24, 52),
      life: R.range(0.22, 0.36),
    }));

    return {
      idx,
      isStone: true,
      x0,
      y0,
      z0,
      s,
      peakY,
      rDist,
      delay,
      fallDur,
      bounce1Dur,
      bounce2Dur,
      pts,
      a0,
      turns,
      dir,
      orbitRx,
      bobPhase,
      puffs,
      dustMotes,
      gritChips,
    };
  });

  stones.sort((a, b) => a.z0 - b.z0);

  // 20 luminous water droplets distributed across low, mid, and high tiers
  const droplets = Array.from({ length: 20 }, (_, i) => {
    const band = (i + 0.5) / 20;
    const x0 = (band * 2 - 1) * 78 + R.range(-4.0, 4.0);
    const z0 = R.range(-13, 14) * SY * 3.1;
    const y0 = z0;
    const r = i % 3 === 0 ? R.range(2.8, 3.7) : i % 3 === 1 ? R.range(2.0, 2.7) : R.range(1.4, 1.9);
    const rDist = Math.hypot(x0, z0 / SY);
    const delay = clamp((rDist / R_MAX) * 0.20, 0.02, 0.23);
    const tierHeights = [28, 46, 68, 86];
    const basePeak = tierHeights[i % 4] + R.range(-6, 6);
    const peakY = basePeak * (1 - 0.22 * (rDist / R_MAX));
    const fallDur = 0.22 + 0.18 * Math.sqrt(peakY / 90);
    const orbitR = R.range(3.0, 6.8);
    const dir = R.sign();
    const phase = R.range(0, TAU);
    const hasSat = r >= 2.2;
    return {
      i,
      isStone: false,
      x0,
      y0,
      z0,
      r,
      rDist,
      delay,
      peakY,
      fallDur,
      bounce1Dur: 0.12,
      bounce2Dur: 0,
      orbitR,
      dir,
      phase,
      hasSat,
    };
  });
  droplets.sort((a, b) => a.z0 - b.z0);

  const scene = { stones, droplets };
  sceneCache.set(seed, scene);
  return scene;
}

/**
 * Evaluate the kinematic state of a stone or water droplet at time `t` in `[0, D)`.
 * Timeline (with radial wave arrival offset `d ∈ [0.01, 0.22]`):
 * - `[0, tLift0]`: resting on the ground (`h = 0`, `a = a0`)
 * - `[tLift0, tApex0]` (~1.22s): detaches as ripple passes, floats slowly upward & rotates
 * - `[tApex0, tApex1]` (**1.04s — full 1-second pause at the highest point!**): hovers at apex with gentle spin
 * - `[tApex1, tImpact1]` (`fallDur ≈ 0.32s..0.46s`, scaled by `sqrt(peakY)`):
 *     As the anti-gravity ripple dissipates, real gravity returns! The stone accelerates downward (`1 - u^2.15`)
 *     hitting the ground at `tImpact1` (`~2.76s..2.94s`) with peak downward velocity!
 * - `[tImpact1, tSettle]`:
 *     Stones perform a crisp physical ground bounce (`bounce1` + tiny `bounce2`) while kicking up luminous light-dust
 *     puffs and hopping grit chips; water droplets splash into rebound micro-beads and expanding rings!
 */
function itemKinematics(item, t) {
  const d = item.delay;
  const tTremor = 0.03 + d * 0.85;
  const tLift0 = 0.10 + d;
  const tApex0 = 1.32 + d * 0.40;
  const tApex1 = 2.36 + d * 0.35; // >1.0s apex suspension!
  const tImpact1 = tApex1 + item.fallDur; // ~2.72s .. 2.92s
  const tBounce1End = tImpact1 + item.bounce1Dur;
  const tSettle = tBounce1End + item.bounce2Dur;

  let h = 0; // normalized height 0..1
  let vyNorm = 0; // downward speed indicator (0..1) for gravity motion streaks
  let rotU = 0; // normalized rotation 0..1 (so at tSettle rotU = 1 -> exact integer turns!)
  let arcEnv = 0; // electric arc / anti-gravity aura intensity 0..1
  let detachPulse = 0; // ring flare when detaching from ground

  if (t >= tTremor && t < tLift0) {
    detachPulse = Math.sin(((t - tTremor) / (tLift0 - tTremor)) * Math.PI);
  } else if (t >= tLift0 && t < tApex0) {
    const u = (t - tLift0) / (tApex0 - tLift0);
    h = sstep(u);
    rotU = 0.48 * ease.inOutQuad(u);
    arcEnv = smooth(0.05, 0.35, u);
    if (u < 0.22) detachPulse = 1 - u / 0.22;
  } else if (t >= tApex0 && t < tApex1) {
    const u = (t - tApex0) / (tApex1 - tApex0);
    // 1-second apex suspension: stays at highest point with subtle weightless zero-G micro-breathing
    h = 1.0 + 0.028 * Math.sin(u * Math.PI * 2 + (item.bobPhase ?? item.phase ?? 0)) * Math.sin(u * Math.PI);
    rotU = 0.48 + 0.32 * u;
    arcEnv = 1.0 - 0.15 * smooth(0.82, 1.0, u);
  } else if (t >= tApex1 && t < tImpact1) {
    // GRAVITY DROP: accelerates downward under gravity (u^2.15 free-fall curve!)
    const u = (t - tApex1) / item.fallDur;
    const accel = Math.pow(u, 2.15);
    h = 1.0 - accel;
    vyNorm = u; // speed builds linearly with time under gravity: v = g * t
    rotU = 0.80 + 0.17 * (u * u);
    arcEnv = (1 - smooth(0.0, 0.55, u)) * 0.85;
  } else if (t >= tImpact1 && t < tBounce1End) {
    // First ballistic rebound hop off the ground: 4 * b * (1 - b)
    const b = (t - tImpact1) / item.bounce1Dur;
    const bouncePx = item.isStone ? Math.min(7.5, 2.0 + item.peakY * 0.09) : 0;
    h = (bouncePx / item.peakY) * 4 * b * (1 - b);
    rotU = 0.97 + 0.025 * ease.outQuad(b);
    arcEnv = 0;
  } else if (t >= tBounce1End && t < tSettle) {
    // Tiny second settle hop before coming to complete rest
    const b2 = (t - tBounce1End) / item.bounce2Dur;
    const bouncePx2 = item.isStone ? Math.min(2.0, 0.6 + item.peakY * 0.025) : 0;
    h = (bouncePx2 / item.peakY) * 4 * b2 * (1 - b2);
    rotU = 0.995 + 0.005 * b2;
    arcEnv = 0;
  } else {
    h = 0;
    rotU = t >= tSettle ? 1 : 0;
    arcEnv = 0;
  }

  // Smooth horizontal spiral sway that vanishes by first ground impact
  const swayEnv = t < tImpact1 ? Math.sin(clamp(h, 0, 1) * Math.PI) : 0;
  const dx = Math.sin(rotU * TAU + (item.bobPhase ?? item.phase ?? 0)) * (item.orbitRx ?? item.orbitR ?? 3) * swayEnv * 0.68;
  const tremorX = detachPulse > 0 && h === 0 ? Math.sin(t * 95 + item.x0) * 0.65 * detachPulse : 0;

  const x = item.x0 + dx + tremorX;
  const y = item.y0 - h * item.peakY;
  const a = (item.a0 ?? 0) + item.dir * TAU * (item.turns ?? 1) * rotU;
  // Landing dust & plinks trigger right at first ground impact `tImpact1`!
  const landAge = t >= tImpact1 ? t - tImpact1 : -1;

  return { x, y, h, vyNorm, rotU, a, arcEnv, detachPulse, landAge, tImpact1, tLift0 };
}

// ---------------------------------------------------------------------------
// 1. Ground Anti-Gravity Force Field & Periodic Expanding Pale-Blue Ripples
// ---------------------------------------------------------------------------
function drawAntiGravityGroundField(p, q, C, t) {
  // Dissipates right as the 1-second apex ends (t = 2.28s .. 2.78s) so gravity visibly takes over!
  const fieldEnv = smooth(0.0, 0.26, t) * (1 - smooth(2.25, 2.78, t));
  const idlePulse = 0.16 + 0.06 * Math.sin((t / D) * TAU * 2);
  const totalEnv = Math.max(idlePulse, fieldEnv);

  const rWave1 = ease.outCubic(clamp(t / 1.25, 0, 1)) * R_MAX;
  const rWave2 = t > 0.42 ? ease.outCubic(clamp((t - 0.42) / 1.35, 0, 1)) * (R_MAX - 4) : -1;
  const rWave3 = t > 0.88 ? ease.outCubic(clamp((t - 0.88) / 1.45, 0, 1)) * (R_MAX - 8) : -1;

  const cy = 0;
  const RY = Math.ceil(R_MAX * SY) + 1;

  rows(p, meta, cy - RY, cy + RY, (y, R) => {
    const dy = (y - cy) / (R_MAX * SY);
    const dy2 = dy * dy;
    if (dy2 >= 1) return;
    const xSpan = Math.floor(R_MAX * Math.sqrt(1 - dy2));

    for (let X = -xSpan; X <= xSpan; X++) {
      const x = X + 0.5;
      const dx = x / R_MAX;
      const d = Math.sqrt(dx * dx + dy2);
      if (d > 1) continue;
      const xi = X + OX;
      const rPx = d * R_MAX;

      const inWake = fieldEnv > 0.02 && rPx <= rWave1 + 3 ? (1 - smooth(rWave1 - 4, rWave1 + 3, rPx)) * fieldEnv : 0;
      let wakeTerm = 0;
      if (inWake > 0.01) {
        const harm = 0.5 + 0.5 * Math.cos(rPx * 0.34 - t * 5.5);
        const c6 = Math.max(0, Math.cos(Math.atan2(dy, dx) * 6));
        const c6_2 = c6 * c6;
        const spoke = c6_2 * c6_2 * c6_2 * c6_2;
        wakeTerm = inWake * (0.22 + 0.18 * harm + 0.20 * spoke);
      }

      const md = Math.max(0, 1 - d * 1.2);
      const coreGlow = md * md;
      const intensity = (coreGlow * 0.38 * totalEnv + wakeTerm) * (1 - d * 0.62);

      if (intensity > 0.04) {
        const col = intensity > 0.52 ? C[6] : intensity > 0.32 ? C[5] : intensity > 0.16 ? C[4] : C[2];
        R.c[xi] = col;
        R.a[xi] = clamp(intensity * 0.85, 0, 0.72);
        R.b[xi] = 1;
        if (intensity > 0.24) {
          R.l[xi] = intensity > 0.5 ? C[6] : C[4];
          R.k[xi] = intensity * 0.25 * totalEnv;
        }
      }
    }
  });

  q.glow(0, -2, 32, C[4], 0.24 * totalEnv);
  q.glow(0, -1, 18, C[6], 0.22 * totalEnv);
  if (fieldEnv > 0.05) {
    q.glow(0, -34, 34, C[4], 0.17 * fieldEnv);
    q.glow(0, -66, 28, C[5], 0.13 * fieldEnv);
  }

  const drawGraviticWave = (r, fade, hot, seedOff) => {
    if (r < 2 || fade <= 0.02) return;
    const diss = t > 2.25 ? (t - 2.25) / 0.52 : 0;
    const dashCut = diss > 0 ? -0.6 + diss * 1.55 : -2;
    const ry = r * SY;

    drawFastEllipseRing(q, 0, cy, r + 1.2, (r + 1.2) * SY, C[3], fade * 0.52, 0, 10, t * 6 + seedOff, dashCut);
    drawFastEllipseRing(
      q,
      0,
      cy,
      r,
      ry,
      (g) => {
        const front = Math.sin(g) > 0;
        const glint = Math.sin(g * 4 - t * 8 + seedOff) > 0.55;
        return hot || (front && glint) ? WHITE : front ? C[6] : C[5];
      },
      fade * 0.94,
      0,
      10,
      t * 6 + seedOff,
      dashCut
    );
    if (r > 7) {
      drawFastEllipseRing(q, 0, cy, r - 3.2, (r - 3.2) * SY, C[4], fade * 0.58, 0, 8, -t * 5 + seedOff, dashCut);
    }
    for (let k = 0; k < 4; k++) {
      const ang = (k * TAU) / 4 + t * 1.4 + seedOff;
      const nx = Math.cos(ang) * r;
      const ny = cy + Math.sin(ang) * ry;
      q.glow(nx, ny, 8, C[5], 0.25 * fade);
    }
  };

  const w1Fade = smooth(0.01, 0.10, t) * (1 - smooth(2.25, 2.75, t));
  drawGraviticWave(rWave1, w1Fade, t < 0.32, 0);

  if (rWave2 > 0) {
    const w2Fade = smooth(0.42, 0.54, t) * (1 - smooth(2.22, 2.70, t));
    drawGraviticWave(rWave2, w2Fade * 0.84, t < 0.65, 2.1);
  }
  if (rWave3 > 0) {
    const w3Fade = smooth(0.88, 1.02, t) * (1 - smooth(2.28, 2.78, t));
    drawGraviticWave(rWave3, w3Fade * 0.78, t < 1.10, 4.2);
  }

  if (totalEnv > 0.12) {
    const spin = (t / D) * (TAU / 4);
    drawFastEllipseRing(q, 0, cy, 22, 22 * SY, C[5], 0.52 * totalEnv);
    drawFastEllipseRing(q, 0, cy, 52, 52 * SY, C[4], 0.44 * fieldEnv);

    for (let i = 0; i < 16; i++) {
      const g = spin + (i * TAU) / 16;
      const rTick = 54;
      if (rWave1 < rTick) continue;
      const x0 = Math.cos(g) * (rTick - 2.5), y0 = cy + Math.sin(g) * (rTick - 2.5) * SY;
      const x1 = Math.cos(g) * (rTick + 2.5), y1 = cy + Math.sin(g) * (rTick + 2.5) * SY;
      q.line(x0, y0, x1, y1, i % 2 === 0 ? C[6] : C[4], 0.62 * fieldEnv);
    }
  }

  if (t > 0.01 && t < 0.38) {
    const k = smooth(0.01, 0.08, t) * (1 - smooth(0.08, 0.38, t));
    sparkle(q, 0, 0, 3 + 6 * k, WHITE, C[5], 0.65 * k);
    q.glow(0, -1, 28 * k + 8, C[6], 0.52 * k);
  }
}

// ---------------------------------------------------------------------------
// 2. Rising Anti-Gravity Force-Field Hoops & Vertical Flux Filaments
// ---------------------------------------------------------------------------
function drawFieldHoopsAndFlux(q, C, t, half) {
  const env = smooth(0.12, 0.45, t) * (1 - smooth(2.25, 2.72, t));
  if (env <= 0.02) return;

  const diss = t > 2.22 ? (t - 2.22) / 0.50 : 0;
  const dashCut = -0.22 + diss * 1.18;

  const hoops = [
    { yBase: -22, rx: 74, phase: 0.0 },
    { yBase: -48, rx: 58, phase: 0.33 },
    { yBase: -74, rx: 42, phase: 0.66 },
  ];

  for (const h of hoops) {
    const floatY = h.yBase - 3.2 * Math.sin(t * 2.2 + h.phase * TAU);
    const ry = h.rx * 0.17;
    drawFastEllipseRing(
      q,
      0,
      floatY,
      h.rx,
      ry,
      (g) => (Math.sin(g * 8 + t * 5) > 0.65 ? C[6] : half > 0 ? C[5] : C[3]),
      (half > 0 ? 0.50 : 0.30) * env,
      half,
      8,
      t * 5,
      dashCut
    );
  }

  if (t > 0.08 && t < 1.55) {
    const uClimb = (t - 0.08) / 1.47;
    const climbY = -ease.outQuad(uClimb) * 86;
    const climbRx = lerp(84, 38, uClimb);
    const climbAlpha = Math.sin(uClimb * Math.PI) * (half > 0 ? 0.68 : 0.38);
    drawFastEllipseRing(q, 0, climbY, climbRx, climbRx * 0.18, half > 0 ? C[6] : C[4], climbAlpha, half);
  }

  if (half < 0) {
    for (let i = 0; i < 16; i++) {
      const r = rng(meta.options.seed + 301, i);
      const xBase = r.range(-76, 76);
      const speed = r.range(28, 48);
      const yCycle = (t * speed + r.range(0, 88)) % 88;
      const y = -4 - yCycle;
      const len = r.range(6, 13);
      const swayX = Math.sin(yCycle * 0.08 + i) * 2.5;
      const x = xBase + swayX;
      const fade = Math.sin(clamp(yCycle / 88, 0, 1) * Math.PI) * env * (1 - Math.abs(x) / 90);
      if (fade > 0.08) {
        q.line(x, y, x + Math.cos(yCycle * 0.08 + i) * 1.2, y - len, (u) => (u > 0.65 ? C[6] : C[4]), fade * 0.52);
        q.glow(x, y - len * 0.7, 4, C[5], fade * 0.20);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Weak Electric Arcs Crawling Around Floating Stones ("浮石表面环绕微弱电弧")
// ---------------------------------------------------------------------------
function drawStoneSurfaceArcs(q, stone, kin, C, seed) {
  if (kin.arcEnv <= 0.04) return;

  const frameStep = Math.floor((kin.rotU * 48 + kin.h * 12 + (seed + stone.idx * 17) * 0.13) * 1.5);
  const R = rng(seed + 500, stone.idx, frameStep);

  const ca = Math.cos(kin.a), sa = Math.sin(kin.a);
  const V = stone.pts.map(([u, v]) => [
    kin.x + (u * ca - v * sa) * (stone.s + 0.85),
    kin.y + (u * sa + v * ca) * (stone.s + 0.85),
  ]);
  const nV = V.length;

  const nArcs = stone.s >= 3.6 ? 2 : 1;
  for (let aIdx = 0; aIdx < nArcs; aIdx++) {
    const startIdx = (frameStep + aIdx * 3 + stone.idx) % nV;
    const span = stone.s >= 4.2 ? 3 : 2;
    const pts = [];

    for (let s = 0; s <= span; s++) {
      const [vx, vy] = V[(startIdx + s) % nV];
      const [nx, ny] = V[(startIdx + s + 1) % nV];
      pts.push([vx + R.range(-0.5, 0.5), vy + R.range(-0.5, 0.5)]);
      if (s < span) {
        const mx = (vx + nx) * 0.5, my = (vy + ny) * 0.5;
        const dx = mx - kin.x, dy = my - kin.y, l = Math.hypot(dx, dy) || 1;
        const bow = R.range(0.6, 2.0);
        pts.push([mx + (dx / l) * bow + R.range(-0.5, 0.5), my + (dy / l) * bow + R.range(-0.5, 0.5)]);
      }
    }

    if (aIdx === 1 && stone.s >= 4.0) {
      pts.push([
        kin.x + R.range(-stone.s * 0.4, stone.s * 0.4),
        kin.y + R.range(-stone.s * 0.4, stone.s * 0.4),
      ]);
      const opp = V[(startIdx + 3) % nV];
      pts.push([opp[0] * 0.85 + kin.x * 0.15, opp[1] * 0.85 + kin.y * 0.15]);
    }

    const k = kin.arcEnv * R.range(0.76, 1.0);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      q.line(x0, y0, x1, y1, C[3], 0.55 * k);
      q.line(x0, y0, x1, y1, (u) => (u > 0.2 && u < 0.8 && k > 0.48 ? WHITE : C[6]), 0.94 * k);
    }

    if (stone.s >= 4.2 && pts.length >= 3 && R.chance(0.65)) {
      const [fx0, fy0] = pts[1];
      const fAng = Math.atan2(fy0 - kin.y, fx0 - kin.x) + R.range(-0.6, 0.6);
      const fLen = R.range(2.2, 4.0);
      q.line(fx0, fy0, fx0 + Math.cos(fAng) * fLen, fy0 + Math.sin(fAng) * fLen, C[5], 0.72 * k);
    }

    const [gx, gy] = pts[Math.floor(pts.length / 2)];
    q.glow(gx, gy, 5 + stone.s * 0.75, C[5], 0.35 * k);

    const [rx0, ry0] = pts[0], [rx1, ry1] = pts[pts.length - 1];
    q.px(rx0, ry0, WHITE);
    q.px(rx1, ry1, C[6]);
  }
}

// Sympathetic micro-arcs bridging between nearby floating stones during the 1-second apex pause
function drawInterStoneBridgeArcs(q, stonesWithKin, C, t, seed) {
  const f = Math.floor(t * FPS) >> 1;
  const R = rng(seed + 880, f);

  for (let i = 0; i < stonesWithKin.length; i++) {
    const A = stonesWithKin[i];
    if (A.kin.arcEnv < 0.65) continue;
    for (let j = i + 1; j < stonesWithKin.length; j++) {
      const B = stonesWithKin[j];
      if (B.kin.arcEnv < 0.65) continue;
      const dist = Math.hypot(B.kin.x - A.kin.x, B.kin.y - A.kin.y);
      if (dist > 12 && dist < 34 && R.chance(0.45)) {
        const mx = (A.kin.x + B.kin.x) * 0.5 + R.range(-2.5, 2.5);
        const my = (A.kin.y + B.kin.y) * 0.5 + R.range(-3.0, 3.0);
        const k = Math.min(A.kin.arcEnv, B.kin.arcEnv) * 0.85;
        q.line(A.kin.x, A.kin.y, mx, my, C[5], 0.75 * k);
        q.line(mx, my, B.kin.x, B.kin.y, C[5], 0.75 * k);
        q.px(mx, my, WHITE);
        q.glow(mx, my, 7, C[5], 0.28 * k);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Faceted Floating Stones & Ground Shadows / Gravity Drop Streaks
// ---------------------------------------------------------------------------
function drawStonesLayer(q, stones, C, S_PAL, t, seed, backLayer) {
  const activeList = [];

  for (const st of stones) {
    const isBack = st.z0 < 0;
    if (isBack !== backLayer) continue;

    const kin = itemKinematics(st, t);
    activeList.push({ st, kin });

    // Ground shadow / anti-gravity projection ring directly beneath the stone at (kin.x, st.y0)
    if (kin.h > 0.02 || kin.detachPulse > 0.05) {
      const projR = st.s * (0.85 + 0.35 * (1 - kin.h)) + kin.detachPulse * 2.5;
      if (kin.arcEnv > 0.1 || kin.detachPulse > 0.05) {
        const projA = clamp(0.24 + 0.32 * kin.arcEnv + 0.45 * kin.detachPulse, 0, 0.72);
        q.ellipse(kin.x, st.y0 + 0.5, projR, Math.max(1.1, projR * SY), C[4], projA * 0.28);
        drawFastEllipseRing(q, kin.x, st.y0 + 0.5, projR, Math.max(1.1, projR * SY), kin.detachPulse > 0.3 ? C[6] : C[5], projA * 0.62);
      } else {
        // Darkening contact shadow as the stone plummets toward the ground under gravity!
        q.ellipse(kin.x, st.y0 + 0.8, projR * 0.9, Math.max(1.1, projR * 0.34), S_PAL[0], 0.45 * (1 - kin.h));
      }

      // Subtle short anti-gravity wake tail under the stone during upward float & apex
      if (kin.arcEnv > 0.15) {
        const tailLen = Math.min(11, st.s * 1.7) * kin.arcEnv;
        const sway = Math.sin(t * 6 + st.idx) * 1.4;
        q.line(
          kin.x + sway,
          kin.y + st.s + tailLen,
          kin.x,
          kin.y + st.s * 0.85,
          (u) => (u > 0.6 ? C[6] : C[4]),
          (u) => 0.48 * u * kin.arcEnv
        );
      }

      // Downward air-wake streaks above the stone as it accelerates downward under gravity!
      if (kin.vyNorm > 0.18) {
        const streakLen = (6 + st.peakY * 0.18) * kin.vyNorm;
        for (const ox of [-st.s * 0.55, 0, st.s * 0.55]) {
          q.line(
            kin.x + ox,
            kin.y - st.s * 0.7 - streakLen,
            kin.x + ox,
            kin.y - st.s * 0.6,
            (u) => (u > 0.5 ? S_PAL[6] : C[5]),
            (u) => 0.55 * u * kin.vyNorm
          );
        }
      }
    } else {
      // Resting contact shadow on the floor
      q.ellipse(st.x0, st.y0 + 1.0, st.s * 1.05, Math.max(1.2, st.s * 0.36), S_PAL[0], 0.55);
    }

    // Soft pale-blue anti-gravity aura behind/under the levitating stone
    if (kin.arcEnv > 0.04) {
      q.glow(kin.x, kin.y + st.s * 0.25, st.s * 2.2 + 4, C[4], 0.30 * kin.arcEnv);
    }

    // Faceted rock body
    drawRock(q, kin.x, kin.y, st.s, kin.a, st.pts, S_PAL, 1, false);

    // Anti-gravity pale-blue rim highlight along the bottom underside of the floating rock
    if (kin.arcEnv > 0.08) {
      const rU = st.s * 0.82;
      q.arc(kin.x, kin.y, rU, 1.1, Math.PI * 0.18, Math.PI * 0.82, C[6], 0.72 * kin.arcEnv);
    }

    // Weak electric arcs crawling across the floating stone's surface ("浮石表面环绕微弱电弧")
    drawStoneSurfaceArcs(q, st, kin, C, seed);
  }

  // Sympathetic bridge arcs between floating stones in the same layer
  drawInterStoneBridgeArcs(q, activeList, C, t, seed + (backLayer ? 0 : 100));
}

// ---------------------------------------------------------------------------
// 5. Levitating & Falling Luminous Water Droplets ("水珠纷纷脱离地面缓缓向上漂浮旋转")
// ---------------------------------------------------------------------------
function drawWaterDropletsLayer(q, droplets, W_PAL, C, t, backLayer) {
  for (const d of droplets) {
    const isBack = d.z0 < 0;
    if (isBack !== backLayer) continue;

    const kin = itemKinematics(d, t);

    if (kin.h <= 0.01) {
      // Resting on the ground as a glistening dew-drop / mini-puddle
      const rx = d.r * 1.35, ry = Math.max(0.9, d.r * 0.58);
      q.ellipse(d.x0, d.y0 + 0.5, rx, ry, W_PAL[2], 0.64);
      q.ellipse(d.x0, d.y0 + 0.3, rx * 0.72, ry * 0.72, W_PAL[4], 0.78);
      q.px(d.x0 - rx * 0.3, d.y0, WHITE);
      if (kin.detachPulse > 0.1) {
        drawFastEllipseRing(q, d.x0, d.y0 + 0.5, rx + 2.2 * kin.detachPulse, (rx + 2.2 * kin.detachPulse) * SY, W_PAL[4], 0.62 * kin.detachPulse);
      }
      continue;
    }

    // Ground caustic speck beneath the floating water droplet
    if (kin.arcEnv > 0.05) {
      q.glow(kin.x, d.y0 + 0.5, 4 + d.r, W_PAL[3], 0.16 * kin.arcEnv);
    }

    // Floating spherical water droplet (stretches vertically into a falling teardrop when accelerating downward!)
    const R = d.r;
    const stretch = 1 + 0.38 * kin.vyNorm;
    const wobX = (R / Math.sqrt(stretch)) * (1 + 0.08 * Math.sin(t * 9 + d.phase) * (1 - kin.vyNorm));
    const wobY = R * stretch * (1 - 0.08 * Math.sin(t * 9 + d.phase) * (1 - kin.vyNorm));

    if (kin.vyNorm > 0.2) {
      q.line(kin.x, kin.y - wobY - 5 * kin.vyNorm, kin.x, kin.y - wobY, W_PAL[4], 0.65 * kin.vyNorm);
    }

    // Translucent deep-aqua water sphere with lit rim
    q.ellipse(kin.x, kin.y, wobX, wobY, (u) => (u > 0.80 ? W_PAL[4] : u > 0.48 ? W_PAL[3] : W_PAL[1]), 0.84);
    if (R >= 1.8) {
      q.disc(kin.x + wobX * 0.22, kin.y + wobY * 0.24, R * 0.48, W_PAL[4], 0.68);
    }

    const spinA = kin.rotU * TAU * 2 + d.phase;
    const cx1 = kin.x + Math.cos(spinA) * wobX * 0.45;
    const cy1 = kin.y + Math.sin(spinA) * wobY * 0.45;
    q.px(cx1, cy1, W_PAL[4]);

    q.px(kin.x - wobX * 0.38, kin.y - wobY * 0.42, WHITE);
    if (R >= 2.0) {
      q.px(kin.x + wobX * 0.35, kin.y + wobY * 0.38, W_PAL[5]);
    }
    q.glow(kin.x, kin.y, R * 2.4 + 2, W_PAL[3], 0.38);

    // Tiny orbiting satellite micro-bead around larger floating droplets
    if (d.hasSat && kin.arcEnv > 0.2) {
      const satA = t * 4.5 * d.dir + d.phase;
      const sx = kin.x + Math.cos(satA) * (R + 2.6);
      const sy = kin.y + Math.sin(satA) * (R + 1.4) * 0.65;
      q.px(sx, sy, W_PAL[5]);
      q.glow(sx, sy, 3, W_PAL[4], 0.26 * kin.arcEnv);
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Luminous Dust Puffs, Hopping Grit & Water Splash Upon Landing ("落地时扬起轻微光尘")
// ---------------------------------------------------------------------------
function drawLandingLightDust(q, scene, C, S_PAL, W_PAL, t) {
  const bellyCol = mix(S_PAL[4], C[3], 0.48);
  const bodyCol = mix(S_PAL[6], C[5], 0.58);
  const capCol = mix(S_PAL[7], C[6], 0.72);

  for (const st of scene.stones) {
    const kin = itemKinematics(st, t);
    if (kin.landAge < 0 || kin.landAge > 0.72) continue;

    const age = kin.landAge;
    // Crisp expanding ground impact ring around the stone base when it slams down
    if (age < 0.34) {
      const uRing = age / 0.34;
      const rRing = st.s * 0.85 + ease.outQuad(uRing) * (st.s * 2.1 + 5.5);
      drawFastEllipseRing(q, st.x0, st.y0 + 0.5, rRing, rRing * SY, uRing < 0.2 ? WHITE : C[5], (1 - uRing) * 0.72);
    }

    // Tiny physical grit chips that hop out and bounce on the floor at stone impact!
    for (const ch of st.gritChips) {
      if (age >= ch.life) continue;
      const gx = st.x0 + ch.vx * age;
      let gy = st.y0 + ch.vy * age + 0.5 * 320 * age * age;
      if (gy > st.y0) gy = st.y0 - Math.abs(gy - st.y0) * 0.35;
      q.px(gx, gy, S_PAL[6]);
    }

    // Soft translucent glowing dust puffs billowing outward left & right from under the stone
    for (const pf of st.puffs) {
      const pa = age - pf.delay;
      if (pa <= 0 || pa >= pf.life) continue;
      const u = pa / pf.life;
      const easeOut = ease.outCubic(u);
      const px = st.x0 + pf.side * pf.dist * (0.22 + 0.78 * easeOut);
      const py = st.y0 - pf.lift * ease.outQuad(u);
      const rad = lerp(pf.r0, pf.r1, easeOut);
      const alpha = Math.min(1, u * 7) * Math.pow(1 - u, 1.45) * 0.58;

      if (alpha > 0.02) {
        q.disc(px, py + rad * 0.20, rad * 0.86, bellyCol, alpha * 0.48);
        q.disc(px, py, rad, bodyCol, alpha * 0.44);
        q.disc(px - pf.side * rad * 0.18, py - rad * 0.28, rad * 0.56, capCol, alpha * 0.52);
        q.glow(px, py, rad * 1.6 + 1.5, C[5], alpha * 0.26);
      }
    }

    // Fine glimmering light-dust specks ("轻微光尘") wafting up and twinkling as they settle
    for (const dm of st.dustMotes) {
      if (age >= dm.life) continue;
      const u = age / dm.life;
      const drag = 1 - Math.exp(-age * 4.2);
      const mx = st.x0 + dm.ox + (dm.vx / 4.2) * drag + Math.sin(age * 9 + dm.phase) * 1.1;
      const my = st.y0 + (dm.vy / 3.6) * drag + 14 * age * age;
      const k = Math.sin(u * Math.PI);
      if (dm.twinkle && k > 0.45) {
        sparkle(q, mx, my, 1.1 + k * 1.2, WHITE, C[5], 0.32 * k);
      } else {
        q.dot(mx, my, k > 0.6 ? WHITE : C[6], k);
        q.glow(mx, my, 3.0, C[5], 0.24 * k);
      }
    }
  }

  // Water droplet touchdown splash beads & expanding micro-rings
  for (const d of scene.droplets) {
    const kin = itemKinematics(d, t);
    if (kin.landAge < 0 || kin.landAge > 0.38) continue;
    const age = kin.landAge;
    const u = age / 0.38;
    const r = d.r + ease.outQuad(u) * (d.r * 2.8 + 4.0);
    drawFastEllipseRing(q, d.x0, d.y0 + 0.5, r, r * SY, u < 0.25 ? WHITE : W_PAL[4], (1 - u) * 0.72);
    if (age < 0.22) {
      const b = age / 0.22;
      const splashH = (2.5 + d.r * 1.2) * 4 * b * (1 - b);
      q.px(d.x0 - d.r * 0.8 * b, d.y0 - splashH, WHITE);
      q.px(d.x0 + d.r * 0.8 * b, d.y0 - splashH * 0.85, W_PAL[4]);
      q.glow(d.x0, d.y0, 5, W_PAL[4], 0.35 * (1 - b));
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Ambient Zero-G Floating Motes & Dissipation Mist
// ---------------------------------------------------------------------------
function drawAmbientGravityMotes(q, C, t, seed) {
  const liftEnv = smooth(0.05, 0.35, t) * (1 - smooth(2.30, 2.85, t));
  if (liftEnv <= 0.02) return;

  for (let i = 0; i < 26; i++) {
    const r = rng(seed + 701, i);
    const x0 = r.range(-84, 84);
    const z0 = r.range(-12, 12);
    const dist = Math.abs(x0) / 88;
    const maxH = r.range(28, 92) * (1 - 0.35 * dist);
    const ph = ((t / D) + r.range(0, 1)) % 1;
    const x = x0 + Math.sin(ph * TAU * 2 + i) * 3.2;
    const y = z0 * SY - ph * maxH;
    const vy = (-maxH / D) * (t < 2.3 ? 1.2 : 0.35);
    const k = Math.sin(ph * Math.PI) * liftEnv;
    if (k > 0.08) {
      mote(q, x, y, Math.cos(ph * TAU * 2 + i) * 6, vy, i % 3 === 0 ? WHITE : C[5], 0.85, k, 0.30);
    }
  }
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8);
  const S_PAL = fit(o.stone, 8);
  const W_PAL = fit(o.water, 6);
  const time = ((t % D) + D) % D;
  const scene = getScene(o.seed);

  // 1. Ground anti-gravity force field & expanding pale-blue ripples
  drawAntiGravityGroundField(p, p, C, time);

  // 2. Far half of the rising mid-air anti-gravity hoops & vertical flux filaments
  drawFieldHoopsAndFlux(p, C, time, -1);

  // 3. Back-layer levitating stones (with crawling weak electric arcs) & water droplets
  drawStonesLayer(p, scene.stones, C, S_PAL, time, o.seed, true);
  drawWaterDropletsLayer(p, scene.droplets, W_PAL, C, time, true);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8);
  const S_PAL = fit(o.stone, 8);
  const W_PAL = fit(o.water, 6);
  const time = ((t % D) + D) % D;
  const scene = getScene(o.seed);

  // 1. Ambient anti-gravity motes rising through the field
  drawAmbientGravityMotes(p, C, time, o.seed);

  // 2. Front-layer levitating stones (with crawling weak electric arcs) & water droplets
  drawStonesLayer(p, scene.stones, C, S_PAL, time, o.seed, false);
  drawWaterDropletsLayer(p, scene.droplets, W_PAL, C, time, false);

  // 3. Near half of the rising mid-air anti-gravity hoops
  drawFieldHoopsAndFlux(p, C, time, 1);

  // 4. Luminous dust puffs & water plinks kicked up as stones and droplets land and bounce
  drawLandingLightDust(p, scene, C, S_PAL, W_PAL, time);
}
