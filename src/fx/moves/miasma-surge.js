// Ground-hugging miasma surge ("moves/miasma-surge"):
// 1. Low Seepage & Ground-Slam Release (0.00..0.14s): Caster crouches low drawing murky dark-yellow sulfur and
//    deep ink-green miasma along the stone floor, then snaps a low palm forward cleanly behind the surging mist.
// 2. Rolling Ground-Hugging Miasma Surge (0.14..0.72s): A thick, menacing tidal bank of interwoven murky
//    dark-yellow (ochre-sulfur) and deep ink-green translucent mist billows, swirling gas currents, and curling
//    floor tongues rolls and churns forward tightly along y = 0, accompanied along its dark floor-skimming belly
//    by dozens of tiny vivid green bubbles that swell and pop into radial droplet bursts and flat ripple rings.
// 3. Oppressive Enemy Hit & Ink-Green Smoke Detonation (0.72..2.35s): Crashes into the enemy with heavy hit-stop,
//    violent screen shake, 30px knockback skid, and an arena-dimming shadow pressure drop; bursts open an
//    explosive cloud of deep ink-green smoke that parts into swirling vortex plumes, 3 crisp ON/OFF dark-green
//    hit-flash strobes, and 8 glossy green poison bubbles rising and popping around the enemy's body.
// Translucent gas puffs, smoke billows, and bubble physics build on Sprite Fusion's open-source poison and
// explosion VFX (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.

import { Particles, Lights, P, PF, Rng, fit, clamp, smooth, lerp, ease, mix, TAU, WHITE, READY } from "../../core/index.js";
import { gasPuff } from "../nature/_lib.js";
import { cull, fadeEdges, pool } from "../explosions/_lib.js";
import { brokenRing, frontCrescent } from "../impacts/_lib.js";
import { unlight } from "../shadow/_lib.js";

const TX = 186;
const SLIDE_DIST = 30;

const T_RELEASE = 0.14;
const T_HIT = 0.72;
const T_FLASH2 = 0.87;
const T_FLASH3 = 1.02;
const T_END = 2.35;

export const meta = {
  name: "Miasma surge",
  desc: "Unleashes a ground-hugging surge of churning dark-yellow and ink-green miasma with popping bottom bubbles that bursts into ink-green smoke, poison bubbles, and dark-green flashes.",
  tags: ["move", "poison", "miasma", "gas", "smoke", "toxic", "wave", "ground", "bubbles", "one-shot"],
  size: [416, 200],
  origin: [82, 158],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    // Smoky Deep Ink-Green ramp ("墨绿色": charcoal-ink black -> deep ink-green -> smoky swamp-jade -> misty sea-moss)
    palette: ["#030907", "#081611", "#0f271e", "#173c2e", "#235742", "#35785c", "#58a180", "#98dab8"],
    // Turbid Murky Dark-Yellow / Ochre-Sulfur ramp ("浑浊的暗黄色": peat-umber -> murky dark mustard -> turbid sulfur-ochre)
    ochre: ["#141005", "#2c2209", "#503f11", "#7d631a", "#a98725", "#cfad3b", "#ebd26e"],
    // Vivid Green Bubbles & Dark-Green Hit-Flash ramp ("绿色气泡 / 绿色毒泡 / 暗绿受击闪烁")
    venom: ["#04150a", "#0b361a", "#16612f", "#30ad40", "#70e64e", "#dcff9c"],
    seed: 19,
  },
};

// Caster choreography: low miasma gather -> deep coil -> ground-skimming palm drive -> poise recovery
const GUARD = { ...READY, x: 0, crouch: 3, lean: 2, fx: 11, fy: -21, bx: 9, by: -21, ffx: 8, fbx: -8 };
const GATHER_LOW = { ...READY, x: -5, crouch: 6, lean: -2, turn: 0.78, fx: -5, fy: -19, bx: 9, by: -21, armsFront: true, ffx: 7, fbx: -9 };
const COIL_DEEP = { ...READY, x: -7, crouch: 8, lean: -3, turn: 0.86, fx: -7, fy: -18, bx: 8, by: -20, armsFront: true, ffx: 6, fbx: -10 };
const CAST_SURGE = { ...READY, x: 6, crouch: 7, lean: 6, turn: 0.42, fx: 16, fy: -15, bx: -3, by: -20, ffx: 12, fbx: -9, ghost: 1 };
const CAST_HOLD = { ...CAST_SURGE, x: 7, crouch: 6, lean: 5, fx: 17, fy: -16, bx: -3, by: -20, ghost: 0 };
const HIT_WATCH = { ...READY, x: 4, crouch: 4, lean: 3, fx: 14, fy: -20, bx: 2, by: -20, ffx: 10, fbx: -8 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.32, GUARD],
    [-0.12, GATHER_LOW],
    [T_RELEASE - 0.03, COIL_DEEP],
    [T_RELEASE, CAST_SURGE, "snap"],
    [T_RELEASE + 0.18, CAST_HOLD],
    [T_HIT, HIT_WATCH, "snap"],
    [1.38, { ...GUARD, x: 2, crouch: 3 }],
    [1.88, GUARD],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_RELEASE, stop: 0.04, shake: 0.15, amp: 2.0, target: false },
    // Synchronized ON/OFF dark-green ("poison") <-> dark-char ("char") strobing on the enemy target!
    { t: T_HIT, stop: 0.18, shake: 0.54, amp: 5.5, push: 5.4, slide: 19, straw: 32, y: -24, skin: "poison", shiver: 0.56, flash: 0 },
    { t: T_HIT + 0.09, push: 0, straw: 0, flash: 0, skin: "char" },
    { t: T_FLASH2, stop: 0.04, shake: 0.28, amp: 3.8, push: 3.4, slide: 26, straw: 14, y: -28, skin: "poison", shiver: 0.52, flash: 0 },
    { t: T_FLASH2 + 0.08, push: 0, straw: 0, flash: 0, skin: "char" },
    { t: T_FLASH3, stop: 0.04, shake: 0.26, amp: 3.1, push: 2.5, slide: SLIDE_DIST, daze: 0.94, straw: 16, y: -22, skin: "poison", shiver: 0.62, flash: 0 },
    { t: 1.72, push: 0, straw: 0, flash: 0, skin: null },
    { t: T_END - 0.24, push: 0, straw: 0, flash: 0, skin: null, daze: 0 },
  ],
  dust: [
    { t: T_RELEASE, x: 14, n: 8, dir: 1 },
    { t: T_RELEASE, x: -7, n: 5, dir: -1 },
    { t: T_HIT, x: TX + 4, n: 11, dir: 1 },
    { t: T_FLASH2, x: TX + 20, n: 7, dir: 1 },
  ],
};

// Safe local bounds inside [416, 200] with origin [82, 158] -> x in [-82..333], y in [-158..41]
const X_MIN = -76, X_MAX = 327, Y_MIN = -152, Y_MAX = 35;

// 4 Distinctly rotated organic mist/smoke LUT variants (radii 2..20) so puffs NEVER repeat a uniform bough/foliage pattern!
const MIST_LUTS = Array.from({ length: 4 }, (_, vIdx) => {
  const rotOff = vIdx * 1.17;
  return Array.from({ length: 21 }, (__, r) => {
    if (r < 2) return [];
    const pts = [];
    for (let dy = -r - 3; dy <= r + 3; dy++) {
      for (let dx = -r - 3; dx <= r + 3; dx++) {
        const a = Math.atan2(dy, dx) + rotOff;
        const sc = 0.85 + 0.14 * Math.sin(a * 3 + r * 0.67) + 0.10 * Math.cos(a * 5 - r * 0.49);
        const q = Math.hypot(dx, dy) / (r * sc);
        if (q > 1) continue;
        pts.push(dx, dy, q);
      }
    }
    return pts;
  });
});

// Draws a soft, organic, truly translucent gaseous mist/smoke puff (`p.blend`, zero checkerboard!)
function drawMistPuff(p, cx, cy, r, vIdx, belly, body, cap, hi, alpha, rimDirX = -0.45) {
  if (alpha <= 0.02 || r < 1.8) return;
  const ri = clamp(Math.round(r), 2, 20);
  const pts = MIST_LUTS[vIdx & 3][ri];
  if (!pts.length) return;
  const rx = Math.round(cx), ry = Math.round(cy);
  for (let i = 0; i < pts.length; i += 3) {
    const dx = pts[i], dy = pts[i + 1], q = pts[i + 2];
    const px = rx + dx, py = ry + dy;
    if (px < X_MIN + 4 || px > X_MAX - 4 || py < Y_MIN + 4 || py > 1) continue;
    const lightDot = (dx * rimDirX - dy * 0.78) / Math.max(1, ri);
    let col;
    if (dy > ri * 0.26 && q < 0.82) col = belly;
    else if (lightDot > 0.44 && q > 0.42) col = hi || cap;
    else if (lightDot > 0.10) col = cap;
    else col = body;
    const edgeFade = q > 0.64 ? (1 - q) / 0.36 : 1;
    p.blend(px, py, col, alpha * edgeFade * (q < 0.42 ? 0.90 : 0.72));
  }
}

// Glossy pixel-art green poison bubble with crisp 1px dark-ink silhouette border, bright toxic-lime upper-left rim,
// deep emerald lower-right rim, translucent green interior, and specular shine!
function drawPoisonBubble(p, x, y, r, Vn, C, alpha, domeOnly = false) {
  if (alpha <= 0.04 || r < 0.8 || x < X_MIN + 8 || x > X_MAX - 8 || y < Y_MIN + 8) return;
  const X = Math.round(x), Y = Math.round(y), R = Math.ceil(r) + 1;
  const jMax = domeOnly ? 0 : R;

  for (let j = -R - 1; j <= jMax + (domeOnly ? 0 : 1); j++) {
    for (let i = -R - 1; i <= R + 1; i++) {
      const d = Math.hypot(i, j);
      if (d > r + 0.38 && d <= r + 1.38) {
        p.blend(X + i, Math.min(1, Y + j), C[0], alpha * 0.90);
      }
    }
  }

  for (let j = -R; j <= jMax; j++) {
    for (let i = -R; i <= R; i++) {
      const d = Math.hypot(i, j);
      if (d > r + 0.38) continue;
      const py = Math.min(1, Y + j);
      if (d > r - 0.72) {
        const litRim = i <= 0 && j <= -r * 0.10;
        p.dot(X + i, py, litRim ? Vn[4] : Vn[2], alpha);
      } else {
        const innerGlow = d < r * 0.46 && j > 0 ? Vn[4] : Vn[3];
        p.blend(X + i, py, innerGlow, alpha * (r >= 3.0 ? 0.42 : 0.52));
      }
    }
  }

  if (r >= 1.4) {
    const gx = X - Math.max(1, Math.round(r * 0.36));
    const gy = Y - Math.max(1, Math.round(r * 0.40));
    p.dot(gx, gy, WHITE, alpha);
    if (r >= 3.2) {
      p.dot(gx + 1, gy, Vn[5], alpha * 0.95);
      p.dot(gx, gy + 1, Vn[4], alpha * 0.88);
    }
  }
}

// Crisp bubble pop burst: expanding broken green pop-ring + flying radial green droplets ("细小的绿色气泡破裂粒子")
function drawBubblePop(p, x, y, rBase, u, seed, Vn, C, alpha, big = false) {
  if (alpha <= 0.04 || u < 0 || u >= 1 || x < X_MIN + 8 || x > X_MAX - 8) return;
  const fade = (1 - smooth(0.45, 1, u)) * alpha;
  const rr = rBase * 0.65 + (big ? 10.0 : 5.8) * ease.outQuart(u);
  const nSeg = big ? 12 : 8;
  for (let i = 0; i < nSeg; i++) {
    if (((i + seed) & 1) && u > 0.5) continue;
    const a = (i / nSeg) * TAU + seed * 0.7;
    const px = x + Math.cos(a) * rr;
    const py = Math.min(1, y + Math.sin(a) * rr * (big ? 0.72 : 0.48));
    p.dot(px, py, u < 0.35 ? Vn[5] : Vn[4], fade);
  }
  const nDrops = big ? 7 : 5;
  for (let i = 0; i < nDrops; i++) {
    const a = -Math.PI * 0.5 + ((i / (nDrops - 1)) - 0.5) * 2.5 + Math.sin(seed * 3.1 + i) * 0.2;
    const sp = (big ? 30 : 22) * (0.75 + 0.35 * (((i * 7 + seed) % 3) / 2));
    const age = u * (big ? 0.24 : 0.16);
    const dx = x + Math.cos(a) * sp * age * 2.2;
    const dy = Math.min(0, y + Math.sin(a) * sp * age * 2.2 + 110 * age * age);
    p.dot(dx, Math.min(0, dy + 1), C[0], fade * 0.85);
    p.dot(dx, dy, i % 2 === 0 ? Vn[5] : Vn[4], fade);
  }
}

// High-Contrast DARK-GREEN Hit Flash ("暗绿受击闪烁"):
// Commanding enemy-framing dark-emerald shock-corona + 10 sharp asymmetric dark-green slash-fangs!
function drawDarkGreenHitFlash(p, ex, u, beatIdx, Vn, C, alpha) {
  if (alpha <= 0.03 || u < 0 || u >= 1) return;
  const pop = ease.outExpo(clamp(u / 0.18));
  const fade = (1 - smooth(0.44, 1, u)) * alpha;
  if (fade <= 0.04) return;

  const cy = -26;
  const rx = (18 + 6 * pop) * (1 - u * 0.12);
  const ry = (27 + 7 * pop) * (1 - u * 0.12);

  p.each(ex - rx - 3, cy - ry - 3, ex + rx + 3, Math.min(0, cy + ry + 3), (lx, ly, sx, sy) => {
    const nx = (lx - ex) / rx, ny = (ly - cy) / ry;
    const d = Math.hypot(nx, ny);
    const ang = Math.atan2(ny, nx);
    const jag = 0.84 + 0.16 * Math.sin(ang * 6 + beatIdx * 2.3);
    if (d > jag + 0.12 || d < jag - 0.36) return;
    let col, a;
    if (d > jag + 0.02) {
      col = Vn[0];
      a = fade * 0.94;
    } else if (d > jag - 0.07) {
      col = Vn[4];
      a = fade * 0.92;
    } else {
      col = d > jag - 0.20 ? Vn[2] : Vn[1];
      a = fade * 0.76;
    }
    p.blendPx(sx, sy, col, a);
  });

  const nSpikes = beatIdx === 0 ? 10 : 8;
  for (let i = 0; i < nSpikes; i++) {
    const baseA = (i / nSpikes) * TAU + beatIdx * 0.58 + 0.24;
    const rStart = 11 + (i % 2) * 3;
    const len = ((i % 2 === 0 ? 35 : 21) * (beatIdx === 0 ? 1.18 : 0.90)) * pop * (1 - u * 0.30);
    const ca = Math.cos(baseA), sa = Math.sin(baseA), nx = -sa, ny = ca;
    const sx0 = ex + ca * rStart, sy0 = Math.min(-1, cy + sa * rStart);
    const tx = clamp(ex + ca * (rStart + len), X_MIN + 4, X_MAX - 4);
    const ty = Math.min(0, Math.max(Y_MIN + 4, cy + sa * (rStart + len)));
    const mx = ex + ca * (rStart + len * 0.28), my = Math.min(0, cy + sa * (rStart + len * 0.28));
    const w = (i % 2 === 0 ? 4.8 : 3.0) * (1 - u * 0.40);

    p.poly([
      [sx0, sy0],
      [mx + nx * (w + 1.1), Math.min(0, my + ny * (w + 1.1))],
      [tx, ty],
      [mx - nx * (w + 1.1), Math.min(0, my - ny * (w + 1.1))],
    ], Vn[0], fade * 0.95);

    p.poly([
      [sx0, sy0],
      [mx + nx * w * 0.70, Math.min(0, my + ny * w * 0.70)],
      [tx, ty],
      [mx - nx * w * 0.70, Math.min(0, my - ny * w * 0.70)],
    ], Vn[1], fade * 0.96);

    p.poly([
      [sx0, sy0],
      [mx + nx * w * 0.36, Math.min(0, my + ny * w * 0.36)],
      [tx, ty],
      [mx - nx * w * 0.36, Math.min(0, my - ny * w * 0.36)],
    ], Vn[2], fade * 0.96);

    p.line(sx0, sy0, tx, ty, u < 0.38 ? Vn[4] : Vn[3], fade * 0.96);
  }

  p.glow(ex, cy, 30 * pop, Vn[2], 0.24 * fade);
}

// Perspective ground shockwave ring split into back/front halves
function drawMiasmaFloorRing(p, cx, cy, r, sy, th, u, C, Vn, alpha, back) {
  if (alpha <= 0.03 || r <= 2) return;
  const x0 = Math.max(X_MIN, Math.floor(cx - r - th - 2));
  const x1 = Math.min(X_MAX, Math.ceil(cx + r + th + 2));
  const ry = (r + th) * sy + 2;
  const y0 = back ? Math.max(Y_MIN, Math.floor(cy - ry)) : Math.floor(cy);
  const y1 = back ? Math.floor(cy) : Math.min(Y_MAX - 4, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / sy;
    if (back ? dy >= 0 : dy < 0) continue;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const d = Math.hypot(dx, dy);
      const off = Math.abs(d - r);
      if (off > th) continue;
      const q = off / Math.max(0.5, th);
      const col = q < 0.35 ? Vn[4] : q < 0.72 ? C[4] : C[1];
      p.blend(x, y, col, alpha * (1 - q * 0.7) * 0.85);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8);
  const Oc = fit(o.ochre, 7);
  const Vn = fit(o.venom, 6);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [Vn[5], Vn[4], Vn[3], C[4], C[2]],
    haze: Vn[1],
  });
  const lights = new Lights();

  // ============================================================================
  // 1. ROLLING GROUND-HUGGING MIASMA MIST PUFFS (0.14..0.82s):
  // 46 translucent organic mist billows + `gasPuff` clouds revolving in a beefy
  // forward-tumbling ground vortex (`34px` surging brow!), interleaving Turbid
  // Murky Dark-Yellow (`Oc`) and Deep Ink-Green (`C`)!
  // ============================================================================
  const rollingMistPuffs = Array.from({ length: 46 }, (_, i) => {
    const uSlot = i / 45;
    const isOchre = i % 2 === 0;
    return {
      uSlot,
      vIdx: i & 3,
      phase0: (i * 1.618) * TAU,
      rollSpd: R.range(7.8, 11.8),
      rBase: lerp(17.5, 6.5, Math.pow(uSlot, 0.76)) * R.range(0.86, 1.15),
      isOchre,
      z: R.range(-1, 1),
      yJitter: R.range(-4.0, 2.5),
    };
  });

  // Tiny green bubbles spawning & popping continuously along the bottom of the rolling mist ("雾气底部伴随细小的绿色气泡破裂粒子")
  const bottomBubbles = [];

  // ============================================================================
  // 2. EXPLODING RING-PARTING DEEP INK-GREEN SMOKE CLOUD (0.72..2.30s):
  // Bursts densely at T_HIT (0.72..0.98s) to engulf the collision point, then
  // expands & parts outward into diagonal left-and-right billowing smoke plumes
  // and ground-skimming eddies (hollowing the center behind the enemy so it reads
  // 100% as an exploding smoke blast — NEVER a tree crown over the dummy's head!)
  // ============================================================================
  const smokeBillows = Array.from({ length: 44 }, (_, i) => {
    // Radial/parting angles: avoid dead-center stationary crown (`-PI/2`); shoot into
    // dynamic diagonal plumes (`-2.45..-1.85` up-left & `-1.25..-0.35` up-right) + low floor rollers (`±0.15`)!
    const group = i % 4;
    let ang, sp;
    if (group === 0) {
      // Forward-right rising blast plume
      ang = R.range(-1.18, -0.38);
      sp = R.range(115, 225);
    } else if (group === 1) {
      // Back-left diagonal splash plume
      ang = R.range(-2.58, -1.92);
      sp = R.range(85, 175);
    } else if (group === 2) {
      // Forward-right floor-skimming smoke surge
      ang = R.range(-0.26, -0.04);
      sp = R.range(110, 215);
    } else {
      // Back-left floor-skimming smoke roller
      ang = Math.PI + R.range(0.04, 0.28);
      sp = R.range(75, 155);
    }
    const isBack = i % 3 !== 0;
    return {
      t0: T_HIT + (i / 44) * 0.08 + R.range(0, 0.02),
      vIdx: i & 3,
      isBack,
      x: 0,
      h: R.range(3, 18),
      vx: Math.cos(ang) * sp + 16,
      vh: -Math.sin(ang) * sp,
      r0: R.range(6, 10),
      r1: R.range(12, 18),
      ochreHint: i % 6 === 0,
      decayStart: R.range(0.95, 1.38),
      decayEnd: R.range(1.62, T_END - 0.10),
      wob: R.range(0, TAU),
      on: false,
      age: 0,
    };
  });

  const impactRingSegs = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * TAU + R.range(-0.08, 0.08);
    return { a, gap: Math.sin(a) > 0.35 ? 0 : R.range(0.32, 0.56), dr: R.range(0.15, 0.45), w: R.range(0.85, 1.25) };
  });

  // 8 Glossy Green Poison Bubbles rising & popping around the enemy's body ("敌人周身冒出几个绿色毒泡")
  const enemyPoisonBubbles = [
    { dt: 0.05, dx: -16, y0: -20, rMax: 4.8, rise: 24, swell: 0.20, hold: 0.50, wobP: 0.4 },
    { dt: 0.11, dx: 17, y0: -28, rMax: 5.5, rise: 25, swell: 0.22, hold: 0.54, wobP: 2.2 },
    { dt: 0.17, dx: -4, y0: -45, rMax: 4.4, rise: 20, swell: 0.20, hold: 0.48, wobP: 3.9 },
    { dt: 0.25, dx: 13, y0: -13, rMax: 5.0, rise: 26, swell: 0.22, hold: 0.56, wobP: 1.3 },
    { dt: 0.34, dx: -18, y0: -34, rMax: 5.6, rise: 22, swell: 0.24, hold: 0.56, wobP: 5.0 },
    { dt: 0.44, dx: 19, y0: -21, rMax: 4.6, rise: 25, swell: 0.21, hold: 0.52, wobP: 2.9 },
    { dt: 0.54, dx: -10, y0: -15, rMax: 5.1, rise: 24, swell: 0.22, hold: 0.52, wobP: 0.8 },
    { dt: 0.62, dx: 7, y0: -38, rMax: 4.5, rise: 21, swell: 0.20, hold: 0.46, wobP: 4.1 },
  ];

  const waveFrontX = (tt) => {
    if (tt < T_RELEASE) return lerp(18, 42, ease.inQuad(clamp(tt / T_RELEASE)));
    const u = clamp((tt - T_RELEASE) / (T_HIT - T_RELEASE));
    const eased = 0.34 * u + 0.66 * ease.inOutQuad(u);
    return lerp(42, TX + 4, eased);
  };

  const waveTailX = (tt) => {
    const fx = waveFrontX(tt);
    if (tt < T_RELEASE) return Math.max(12, fx - 18);
    const u = clamp((tt - T_RELEASE) / (T_HIT - T_RELEASE));
    const len = lerp(30, 102, smooth(0, 0.48, u));
    return Math.max(20, fx - len);
  };

  const enemyX = (tt) => {
    if (tt <= T_HIT) return TX;
    const s1 = 19 * (1 - Math.exp(-8.5 * (tt - T_HIT)));
    const s2 = tt > T_FLASH2 ? 7 * (1 - Math.exp(-8.5 * (tt - T_FLASH2))) : 0;
    const s3 = tt > T_FLASH3 ? 4 * (1 - Math.exp(-8.5 * (tt - T_FLASH3))) : 0;
    return TX + s1 + s2 + s3;
  };

  let t = 0;
  let released = false, hit1 = false, hit2 = false, hit3 = false;
  let btmBubbleAcc = 0, trailMistAcc = 0;

  return {
    update(dt) {
      t += dt;

      // Phase 0 (0.00..0.14s): Low miasma seepage & tiny green floor bubbles in front of caster's feet
      if (t < T_RELEASE) {
        for (btmBubbleAcc += dt * 30; btmBubbleAcc >= 1; btmBubbleAcc -= 1) {
          bottomBubbles.push({
            x: R.range(12, 36),
            y: -R.range(0.5, 3.5),
            vx: R.range(12, 36),
            vy: -R.range(8, 18),
            rMax: R.range(1.6, 2.5),
            swellDur: R.range(0.07, 0.13),
            popDur: R.range(0.11, 0.16),
            age: 0,
            seed: R.int(1, 999),
          });
        }
      }

      // Phase 1 Release (T_RELEASE = 0.14s)
      if (!released && t >= T_RELEASE) {
        released = true;
        lights.add(30, -12, 44, Oc[4], 0.42, 0.26);
        lights.add(34, -8, 36, Vn[3], 0.38, 0.30);
        for (let i = 0; i < 12; i++) {
          ps.spawn(P.VAPOUR, 22 + R.range(0, 14), -R.range(3, 15), R.range(35, 105), -R.range(4, 24), R.range(0.28, 0.54), i % 2 === 0 ? Oc[3] : C[3], R.range(3.4, 5.8));
        }
      }

      // Phase 1 Rolling Ground-Hugging Surge (0.14..0.74s): Continuous bottom popping green bubbles + wake mist!
      if (t >= T_RELEASE && t < T_HIT + 0.05) {
        const fx = waveFrontX(t);
        const tx0 = waveTailX(t);

        for (btmBubbleAcc += dt * 92; btmBubbleAcc >= 1; btmBubbleAcc -= 1) {
          const bx = lerp(tx0 + 2, fx + 5, R.next());
          bottomBubbles.push({
            x: bx,
            y: -R.range(0.5, 4.8),
            vx: R.range(16, 54),
            vy: -R.range(10, 24),
            rMax: R.range(1.6, 2.9),
            swellDur: R.range(0.06, 0.12),
            popDur: R.range(0.12, 0.18),
            age: 0,
            seed: R.int(1, 999),
          });
        }

        for (trailMistAcc += dt * 44; trailMistAcc >= 1; trailMistAcc -= 1) {
          const mx = lerp(tx0 - 4, fx - 6, R.next());
          ps.spawn(
            P.VAPOUR,
            mx,
            -R.range(3, 22),
            R.range(8, 44),
            -R.range(4, 18),
            R.range(0.32, 0.64),
            R.chance(0.48) ? Oc[4] : C[3],
            R.range(3.4, 6.2),
            0,
            R.chance(0.45) ? PF.BACK : 0
          );
        }
      }

      // Phase 2 Primary Impact (T_HIT = 0.72s): Explosive Ink-Green Smoke Cloud + Dark-Green Hit Flash #1!
      if (!hit1 && t >= T_HIT) {
        hit1 = true;
        lights.add(TX, -24, 66, Vn[2], 0.42, 0.34);
        lights.add(TX + 14, -34, 62, C[4], 0.36, 0.68);

        for (let i = 0; i < 34; i++) {
          const a = -Math.PI * 0.45 + R.range(-1.35, 1.35);
          const sp = R.range(85, 245);
          ps.spawn(
            P.SPARK,
            TX + R.range(-6, 6),
            -22 + R.range(-10, 12),
            Math.cos(a) * sp + 22,
            Math.sin(a) * sp - 16,
            R.range(0.20, 0.54),
            R.pick([Vn[4], Vn[3], C[5]]),
            R.chance(0.5) ? 2 : 1
          );
        }

        // Rich `P.SMOKE` & `P.VAPOUR` ink-green puffs expanding outward from the blast core!
        for (let i = 0; i < 28; i++) {
          const a = -Math.PI * 0.46 + R.range(-1.35, 1.25);
          const sp = R.range(55, 175);
          ps.spawn(
            i % 3 === 0 ? P.SMOKE : P.VAPOUR,
            TX + R.range(-10, 12),
            -R.range(6, 36),
            Math.cos(a) * sp + 18,
            Math.sin(a) * sp - 16,
            R.range(0.55, 1.22),
            i % 5 === 0 ? Oc[3] : C[3],
            R.range(4.8, 9.0),
            R.range(0, 0.08),
            i % 2 === 0 ? PF.BACK : 0
          );
        }

        for (let i = 0; i < 14; i++) {
          bottomBubbles.push({
            x: TX + R.range(-32, 52),
            y: -R.range(0.5, 4.5),
            vx: R.range(-35, 70),
            vy: -R.range(8, 22),
            rMax: R.range(1.7, 2.9),
            swellDur: R.range(0.07, 0.18),
            popDur: R.range(0.12, 0.18),
            age: -R.range(0, 0.22),
            seed: R.int(1, 999),
          });
        }
      }

      // Strobe Beat #2 (0.87s) & Strobe Beat #3 (1.02s)
      if (!hit2 && t >= T_FLASH2) {
        hit2 = true;
        const ex = enemyX(t);
        lights.add(ex, -26, 48, Vn[2], 0.36, 0.18);
        for (let i = 0; i < 12; i++) {
          const a = R.range(0, TAU), sp = R.range(60, 155);
          ps.spawn(P.SPARK, ex, -26, Math.cos(a) * sp + 12, Math.sin(a) * sp - 10, R.range(0.16, 0.36), Vn[4], 1);
        }
      }

      if (!hit3 && t >= T_FLASH3) {
        hit3 = true;
        const ex = enemyX(t);
        lights.add(ex, -26, 46, Vn[2], 0.34, 0.20);
      }

      // Step exploding Ring-Parting Ink-Green Smoke Billows: continuous outward & upward expansion so it NEVER parks in a tree crown!
      for (const b of smokeBillows) {
        if (!b.on) {
          if (t < b.t0) continue;
          b.on = true;
          b.x = TX + R.range(-8, 10);
        }
        b.age += dt;
        b.vx -= b.vx * 1.45 * dt;
        b.vh -= b.vh * 1.55 * dt;
        const swirlX = Math.sin(t * 4.2 + b.wob) * 12;
        const lift = 18 + 10 * smooth(0.2, 0.9, b.age);
        b.x = clamp(b.x + (b.vx + 12 + swirlX * 0.4) * dt, X_MIN + 26, X_MAX - 26);
        b.h = Math.min(124, Math.max(0, b.h + (b.vh * 0.52 + lift) * dt));

        const thinU = smooth(b.decayStart, b.decayEnd, t);
        if (thinU > 0.08 && thinU < 0.85 && R.chance(2.8 * dt)) {
          const rem = T_END - 0.10 - t;
          if (rem > 0.24) {
            ps.spawn(
              P.VAPOUR,
              b.x + R.range(-10, 12),
              -(b.h + 6),
              R.range(4, 26),
              -R.range(12, 30),
              Math.min(R.range(0.40, 0.78), rem),
              C[3],
              R.range(3.2, 6.2),
              0,
              b.isBack ? PF.BACK : 0
            );
          }
        }
      }

      // Step bottom tiny green bubbles & burst particles
      for (let i = bottomBubbles.length - 1; i >= 0; i--) {
        const bb = bottomBubbles[i];
        bb.age += dt;
        if (bb.age < 0) continue;
        if (bb.age >= bb.swellDur + bb.popDur || t >= T_END - 0.05) {
          bottomBubbles.splice(i, 1);
          continue;
        }
        if (bb.age < bb.swellDur) {
          bb.x = clamp(bb.x + bb.vx * dt, X_MIN + 8, X_MAX - 8);
          bb.y = clamp(bb.y + bb.vy * dt, -12, -0.5);
          bb.vx *= Math.exp(-2.5 * dt);
        }
      }

      ps.update(dt);
      cull(ps, X_MIN + 4, Y_MIN + 4, X_MAX - 4, Y_MAX - 4);
      fadeEdges(ps, X_MIN + 4, X_MAX - 4, 20, Y_MAX - 4);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-4) return;
      const endFade = 1 - smooth(T_END - 0.32, T_END - 0.04, t);

      // 1. Floor miasma slick under the rolling wave & around the enemy
      if (t >= 0.04 && t < 1.90) {
        const sFade = (1 - smooth(1.18, 1.90, t)) * endFade;
        const xStart = t < T_HIT ? waveTailX(t) - 6 : lerp(24, TX - 34, smooth(T_HIT, 1.25, t));
        const xEnd = t < T_HIT ? waveFrontX(t) + 5 : lerp(TX + 12, TX + 64, ease.outCubic(clamp((t - T_HIT) / 0.48)));
        if (xEnd > xStart + 2 && sFade > 0.03) {
          for (let x = Math.max(X_MIN + 6, Math.floor(xStart)); x <= Math.min(X_MAX - 6, Math.ceil(xEnd)); x++) {
            const u = (x - xStart) / Math.max(1, xEnd - xStart);
            const env = Math.sin(Math.PI * clamp(u));
            const swirl = Math.sin(x * 0.16 - t * 16);
            p.blend(x, 0, swirl > 0.22 ? Oc[3] : C[2], sFade * env * 0.78);
            p.blend(x, 1, swirl > 0.08 ? Oc[2] : C[1], sFade * env * 0.62);
          }
          pool(p, (xStart + xEnd) * 0.5, 1, (xEnd - xStart) * 0.50, 6, Vn[2], 0.20 * sFade);
        }
      }

      // 2. Far layer of the rolling ground-hugging miasma mist
      drawRollingMiasmaMist(p, true, endFade);

      // 3. Far half of floor shockwave + Exploding Deep Ink-Green Smoke Cloud BEHIND the enemy!
      if (t >= T_HIT) {
        const ageH = t - T_HIT;
        if (ageH < 0.46) {
          const uR = ageH / 0.46;
          drawMiasmaFloorRing(p, TX + 6, 0, 12 + 68 * ease.outQuart(uR), 0.20, Math.max(1, 3.2 * (1 - uR)), uR, C, Vn, (1 - uR) * endFade, true);
        }
        drawImpactSmokeCloud(p, true, endFade);
      }

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-4) return;
      const endFade = 1 - smooth(T_END - 0.32, T_END - 0.04, t);

      // 0. Pre-release low miasma gather coils in front of caster's hands/feet (0.00..0.16s)
      if (t < T_RELEASE + 0.04) {
        const uG = clamp(t / T_RELEASE);
        for (let i = 0; i < 4; i++) {
          const a = t * 12 + (i * TAU) / 4;
          const rx = 20 + (1 - uG) * 14 * Math.cos(a);
          const ry = -9 + 5 * Math.sin(a);
          gasPuff(p, rx, Math.min(-2, ry), 5.4 - 1.2 * uG, 0.65 * (1 - smooth(T_RELEASE, T_RELEASE + 0.04, t)), C[1], i % 2 === 0 ? Oc[3] : C[3], i % 2 === 0 ? Oc[5] : C[5]);
        }
        p.glow(20, -8, 22, Oc[4], 0.28 * uG);
      }

      // 1. Near layer of the Rolling Ground-Hugging Dark-Yellow + Ink-Green Miasma Mist (0.12..0.82s)
      drawRollingMiasmaMist(p, false, endFade);

      // 2. Bottom Tiny Green Bubble-Popping Particles ("雾气底部伴随细小的绿色气泡破裂粒子")
      for (const bb of bottomBubbles) {
        if (bb.age < 0) continue;
        if (bb.age < bb.swellDur) {
          const uS = bb.age / bb.swellDur;
          const r = bb.rMax * ease.outCubic(Math.min(1, uS * 1.25));
          drawPoisonBubble(p, bb.x, bb.y, r, Vn, C, endFade, bb.y > -1.6);
          if (r >= 2.0) p.glow(bb.x, bb.y, 5, Vn[3], 0.20 * endFade);
        } else {
          const uP = (bb.age - bb.swellDur) / bb.popDur;
          drawBubblePop(p, bb.x, bb.y, bb.rMax, uP, bb.seed, Vn, C, endFade, false);
        }
      }

      // 3. Oppressive Impact Result VFX ("迷雾触碰敌人后爆开一团墨绿色的烟云，敌人周身冒出几个绿色毒泡与暗绿受击闪烁")
      if (t >= T_HIT) {
        const ageH = t - T_HIT;
        const ex = enemyX(t);

        // A. Near half of floor shockwave ring + standing ink-green/ochre shock crescents + gapped blast ring
        if (ageH < 0.46) {
          const uR = ageH / 0.46;
          const rr = 12 + 68 * ease.outQuart(uR);
          const rA = (1 - uR) * endFade;
          drawMiasmaFloorRing(p, TX + 6, 0, rr, 0.20, Math.max(1, 3.2 * (1 - uR)), uR, C, Vn, rA, false);
          frontCrescent(p, clamp(TX + 6 + rr, X_MIN + 10, X_MAX - 10), 1, 32 * (1 - uR * 0.5), 8.0 * (1 - uR * 0.5), [Vn[4], C[4], C[1]], rA * 0.90);
          frontCrescent(p, clamp(TX + 6 - rr, X_MIN + 10, X_MAX - 10), -1, 24 * (1 - uR * 0.5), 6.5 * (1 - uR * 0.5), [Oc[5], C[3], C[1]], rA * 0.78);
        }
        if (ageH < 0.30) {
          const uBR = ageH / 0.30;
          brokenRing(
            p,
            ex,
            -26,
            14 + 46 * ease.outQuart(uBR),
            Math.max(1, 2.4 * (1 - uBR)),
            impactRingSegs,
            0.35 + uBR * 0.65,
            uBR < 0.25 ? Vn[4] : C[5],
            C[2],
            (1 - uBR) * endFade * 0.86,
            1,
            0
          );
        }

        // B. Front Ink-Green Smoke Surges & Curling Ribbons
        drawImpactSmokeCloud(p, false, endFade);

        // C. Three Crisp ON/OFF Dark-Green Hit-Flash Strobes ("暗绿受击闪烁": 0.09s ON, 0.06s OFF!)
        if (ageH >= 0 && ageH < 0.09) {
          drawDarkGreenHitFlash(p, ex, ageH / 0.09, 0, Vn, C, endFade);
        } else if (t >= T_FLASH2 && t < T_FLASH2 + 0.085) {
          drawDarkGreenHitFlash(p, ex, (t - T_FLASH2) / 0.085, 1, Vn, C, endFade * 0.94);
        } else if (t >= T_FLASH3 && t < T_FLASH3 + 0.09) {
          drawDarkGreenHitFlash(p, ex, (t - T_FLASH3) / 0.09, 2, Vn, C, endFade * 0.90);
        }

        // D. 8 Distinct Glossy Green Poison Bubbles Rising & Popping Around the Enemy ("敌人周身冒出几个绿色毒泡")
        for (let i = 0; i < enemyPoisonBubbles.length; i++) {
          const pb = enemyPoisonBubbles[i];
          const bAge = ageH - pb.dt;
          if (bAge < 0) continue;
          const totalActive = pb.swell + pb.hold;
          const popDur = 0.22;
          if (bAge >= totalActive + popDur) continue;

          const bx = ex + pb.dx + Math.sin(bAge * 6.0 + pb.wobP) * 2.5;
          const by = pb.y0 - pb.rise * Math.min(bAge, totalActive);

          if (bAge < totalActive) {
            const grow = ease.outBack(clamp(bAge / pb.swell));
            const stretch = 1 + 0.09 * Math.sin(bAge * 11 + pb.wobP);
            const r = Math.max(0.9, pb.rMax * grow * stretch);
            drawPoisonBubble(p, bx, by, r, Vn, C, endFade, false);
            p.glow(bx, by, r * 1.8 + 2, Vn[3], 0.22 * endFade * clamp(bAge / pb.swell));
          } else {
            const uPop = (bAge - totalActive) / popDur;
            drawBubblePop(p, bx, by, pb.rMax, uPop, i * 13 + 5, Vn, C, endFade, true);
            p.glow(bx, by, 11 * (1 - uPop), Vn[4], 0.30 * (1 - uPop) * endFade);
          }
        }
      }

      ps.draw(p, "front");
      lights.draw(p);

      // Oppressive arena-darkening miasma shadow-pressure dome around the struck target ("展现压迫感")
      if (t >= T_HIT) {
        const ageH = t - T_HIT;
        const pressK = smooth(0, 0.04, ageH) * (1 - smooth(0.42, 0.98, ageH));
        if (pressK > 0.03) {
          const ex = enemyX(t);
          unlight(p, ex - 88, -120, ex + 88, 10, (x, y) => {
            const d = Math.hypot((x - ex) / 88, (y + 28) / 78);
            return d > 0.44 && d < 1;
          }, 1 - 0.68 * pressK);
        }
      }
    },
  };

  // Renders the beefy, boiling, ground-hugging Dark-Yellow + Ink-Green Miasma Mist Surge!
  function drawRollingMiasmaMist(p, back, endFade) {
    if (t < T_RELEASE - 0.03 || t >= T_HIT + 0.15) return;
    const wFade = smooth(T_RELEASE - 0.03, T_RELEASE + 0.03, t) * (1 - smooth(T_HIT - 0.02, T_HIT + 0.13, t)) * endFade;
    if (wFade <= 0.02) return;

    const fx = waveFrontX(t);
    const tx0 = waveTailX(t);

    if (!back) {
      for (let x = Math.max(X_MIN + 6, Math.floor(tx0)); x <= Math.min(X_MAX - 6, Math.ceil(fx + 5)); x += 4) {
        const u = (x - tx0) / Math.max(1, fx + 5 - tx0);
        const env = Math.sin(Math.PI * clamp(u));
        p.disc(x, -3.0, 5.2 * env + 1.5, C[0], wFade * 0.62 * env);
      }
    }

    // 46 Revolving Organic Mist Billows (`Oc` murky dark-yellow interwoven with `C` deep ink-green!)
    for (const mp of rollingMistPuffs) {
      if ((mp.z < 0) !== back) continue;
      const uCycle = (mp.uSlot - (t * 1.18) % 1 + 1) % 1;
      const rollA = mp.phase0 + t * mp.rollSpd;
      const env = uCycle < 0.26
        ? Math.sin((uCycle / 0.26) * Math.PI * 0.5)
        : Math.pow(1 - (uCycle - 0.26) / 0.74, 0.72);

      const cx = lerp(fx + 3, tx0, uCycle) + Math.sin(rollA) * (6.2 * env + 1.5);
      const cy = -(6 + 24 * env) + Math.cos(rollA) * (6.0 * env + 1.0) + mp.yJitter * env;
      const r = mp.rBase * (0.48 + 0.66 * env);
      if (cx < X_MIN + 18 || cx > X_MAX - 18 || r < 2.0) continue;

      if (mp.isOchre) {
        drawMistPuff(p, cx, Math.min(-2, cy), r, mp.vIdx, Oc[1], Oc[3], Oc[4], Oc[5], wFade * 0.66, 0.35);
      } else {
        drawMistPuff(p, cx, Math.min(-2, cy), r, mp.vIdx, C[0], C[2], C[3], C[5], wFade * 0.72, 0.35);
      }
    }

    if (back) return;

    // Swirling `gasPuff` veils tying the rolling miasma bank together
    for (let k = 0; k < 8; k++) {
      const u = k / 7;
      const env = Math.sin(Math.PI * clamp(0.14 + u * 0.82));
      const gx = lerp(fx - 1, tx0 + 8, u) + 3.5 * Math.sin(t * 15 + k * 1.7);
      const gy = -8 - 15 * env + 2.8 * Math.cos(t * 13 + k * 2.3);
      const isOc = k % 2 === 0;
      gasPuff(
        p,
        gx,
        Math.min(-3, gy),
        (12.5 - 4.5 * u) * (0.82 + 0.25 * env),
        wFade * 0.56,
        isOc ? Oc[2] : C[1],
        isOc ? Oc[3] : C[2],
        isOc ? Oc[5] : C[4],
        isOc ? Oc[6] : C[5]
      );
    }

    // Four Curling Leading-Edge & Crest Mist Tongues rolling forward!
    for (let k = 0; k < 4; k++) {
      const isOchre = k % 2 === 0;
      const curlX = fx + (k === 0 ? 5 : k === 1 ? -4 : k === 2 ? -18 : -34) + 2.8 * Math.sin(t * 19 + k * 1.8);
      const curlY = k === 0 ? -10 : k === 1 ? -24 : k === 2 ? -31 : -20;
      const spin = -t * 17 - k * 1.7;
      const rCurl = k < 2 ? 7.8 : 6.2;
      for (let a = 0; a < 4.7; a += 0.12) {
        const rr = rCurl * (1 - a * 0.13);
        const px = curlX + Math.cos(spin + a) * rr;
        const py = Math.min(-1, curlY + Math.sin(spin + a) * rr * 0.86);
        const w = 2.0 * (1 - a / 5.3);
        const colHi = isOchre ? Oc[5] : C[5];
        const colMid = isOchre ? Oc[3] : C[3];
        for (let o2 = -w; o2 <= w; o2 += 0.85) {
          p.blend(
            px + Math.cos(spin + a) * o2,
            Math.min(0, py + Math.sin(spin + a) * o2),
            o2 > w * 0.22 ? colHi : colMid,
            wFade * 0.76 * (1 - a / 5.3)
          );
        }
      }
    }

    p.glow(fx - 14, -12, 34, Oc[4], 0.20 * wFade);
    p.glow(fx - 2, -6, 24, Vn[3], 0.22 * wFade);
  }

  // Renders the Explosive Parting Deep Ink-Green Smoke Cloud ("迷雾触碰敌人后爆开一团墨绿色的烟云"):
  // Combines rotated organic `drawMistPuff` + `gasPuff` expanding into diagonal plumes & low eddies (ZERO tree shape!)
  function drawImpactSmokeCloud(p, back, endFade) {
    const active = smokeBillows.filter((b) => b.on && b.isBack === back);
    if (!active.length) return;

    const ex = enemyX(t);
    // Initial 0.26s central engulfing ink-green blast puff right at collision (`TX, -24`)!
    const ageH = t - T_HIT;
    if (back && ageH >= 0 && ageH < 0.36) {
      const uBurst = ageH / 0.36;
      const rCore = 14 + 24 * ease.outQuart(uBurst);
      gasPuff(p, ex + 4, -26 - 10 * uBurst, rCore, (1 - uBurst) * endFade * 0.85, C[0], C[2], C[4], Vn[3]);
    }

    for (const b of active) {
      const thinU = smooth(b.decayStart, b.decayEnd, t);
      if (thinU >= 0.995) continue;
      const swell = 1 - Math.exp(-b.age / 0.12);
      const r = (b.r0 + (b.r1 - b.r0) * swell) * (1 + 0.08 * Math.sin(t * 5.4 + b.wob)) * (1 + 0.32 * thinU);
      const y = Math.max(Y_MIN + r + 4, -(b.h + r * 0.70));
      const popIn = clamp(b.age / 0.035);

      const nearTorso = !back && b.age > 0.09 && Math.abs(b.x - ex) < 19 && y < -14;
      const baseAlpha = nearTorso ? 0.18 : back ? 0.70 : 0.62;
      const a = popIn * Math.pow(1 - thinU, 1.45) * baseAlpha * endFade;
      if (a <= 0.02) continue;

      if (b.ochreHint && b.age < 0.40) {
        drawMistPuff(p, b.x, Math.min(-1, y), r, b.vIdx, C[0], mix(C[2], Oc[2], 0.55), mix(C[4], Oc[4], 0.5), Oc[5], a, -0.45);
      } else {
        drawMistPuff(p, b.x, Math.min(-1, y), r, b.vIdx, C[0], C[1], C[3], b.age < 0.32 ? C[5] : C[4], a, -0.45);
      }
      if (r > 10 && thinU < 0.7) {
        gasPuff(p, b.x, Math.min(-2, y), r * 0.78, a * 0.42, C[0], C[2], C[4], 0);
      }
    }

    // Curling wispy ink-green smoke ribbons rising off the blast
    if (!back && ageH > 0.03 && ageH < 1.45) {
      const rFade = smooth(0.03, 0.14, ageH) * (1 - smooth(0.88, 1.45, ageH)) * endFade;
      for (let k = 0; k < 4; k++) {
        const xBase = ex + (k - 1.3) * 18 + ageH * 14;
        const h0 = Math.max(2, ageH * 34 - 22 + k * 6);
        const h1 = Math.min(90, h0 + 32);
        for (let h = h0; h <= h1; h += 0.8) {
          const s = (h - h0) / Math.max(1, h1 - h0);
          const wx = xBase + 6.5 * Math.sin(h * 0.14 - t * 6.8 + k * 1.9) + (h - h0) * 0.22;
          const w = 2.6 * Math.sin(Math.PI * s);
          for (let o2 = -w; o2 <= w; o2 += 1) {
            p.blend(wx + o2, -h, Math.abs(o2) < w * 0.45 ? C[4] : C[2], rFade * 0.36 * Math.sin(Math.PI * s));
          }
        }
      }
    }
  }
}
