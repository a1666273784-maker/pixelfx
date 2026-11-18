// Boss Crimson-Gold Shockwave & Flame Torrent ("moves/crimson-gold-torrent"):
// 1. Heat-Wave Distortion & Spiraling Collapse (0.00..0.45s): Severe refractive heat-shimmer arcs and rising mirage
//    columns warp the air in front of the Boss as 112 dark-crimson and flowing-gold light particles spiral inward at
//    high speed, collapsing into a blinding pure-white singularity core with long diffraction spikes.
// 2. Multi-Layer Flowing-Gold Sonic-Boom Rings & Crimson-Gold Flame Torrent (0.45..1.52s): The white core erupts
//    forward, first blasting out 7 staggered coaxial translucent flowing-gold sonic-boom gas rings (0.45..0.58s),
//    immediately followed by a colossal horizontal torrent of deep crimson-red flame interlaced with braided
//    flowing-gold energy rays (0.58..1.52s).
// 3. Oppressive Enemy Hit, High-Frequency White Strobe & Spatial Ripples (0.65..1.68s): The enemy is swallowed by
//    multi-layer annular shockwaves and towering crimson-gold flames, suffering high-frequency incandescent white
//    hit-strobes, heavy knockback, and 360-degree concentric annular spatial ripples.
// 4. Scorched Path Aftermath — Singed-Grey Smoke & Rising Gold Sparks / Dark-Red Light Dust (1.28..3.85s): Dense
//    singed-grey smoke billows up along the entire scorched energy path while abundant flowing-gold sparks and
//    glowing dark-red light dust ascend on thermal currents and dissipate cleanly.
// Fire tongues, puffs, sparks and shockwave recipes build on Sprite Fusion's open-source fire & energy VFX
// (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import {
  Particles,
  Lights,
  P,
  PF,
  Rng,
  fit,
  band,
  flare,
  sparkle,
  bolt,
  clamp,
  smooth,
  lerp,
  ease,
  noise,
  fract,
  mix,
  TAU,
  WHITE,
  READY,
} from "../../core/index.js";
import { hotFirst, flameTongue, flameBlade, simDraw, floorLight, LAYERS } from "../fire/_lib.js";
import { unlight } from "../shadow/_lib.js";

const MX = 24, MY = -26;       // Singularity & torrent muzzle position in front of the Boss
const TX = 196;                // Enemy standing x
const SLIDE_1 = 12;
const SLIDE_2 = 22;
const SLIDE_3 = 32;            // Total knockback slide distance
const END_X = TX + 90;         // Torrent pierces well past the enemy

// Choreography timing constants (seconds)
const T_COLLAPSE = 0.38;       // Spiral collapses tightly into blinding white singularity
const T_ERUPT = 0.45;          // Core erupts: multi-layer flowing-gold sonic-boom rings blast out FIRST
const T_TORRENT = 0.57;        // Colossal crimson-red + flowing-gold flame torrent fires horizontally right after
const T_HIT = 0.65;            // Torrent & lead sonic rings slam into the enemy
const T_SURGE2 = 0.85;         // Second internal gold-ray surge hits enemy
const T_SURGE3 = 1.05;         // Terminal torrent detonation & maximum engulfment
const T_TORRENT_END = 1.52;    // Main torrent beam pinches off into billowing smoke & thermal embers
const T_END = 3.85;

const SY = 0.18;

export const meta = {
  name: "Crimson gold torrent",
  desc: "Heat distortion and spiraling crimson-gold motes collapse to a white core, firing gold sonic rings and a crimson-gold flame torrent with white hit strobes and smoke.",
  tags: ["move", "boss", "fire", "beam", "torrent", "crimson", "gold", "shockwave", "sonic", "smoke", "one-shot"],
  size: [448, 216],
  origin: [82, 168],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    // 9-step dark-crimson -> blood-scarlet -> incandescent flame ramp
    palette: ["#160205", "#3c050c", "#740b16", "#b41720", "#e62e28", "#ff5e2e", "#ff9e44", "#ffd97d", "#ffffff"],
    // 7-step flowing-gold ("流金色") ramp
    gold: ["#2a1404", "#5e2e08", "#9e540e", "#d88418", "#f8b828", "#ffe468", "#fff9d2"],
    // 6-step singed-grey ("焦灰色") smoke ramp
    smoke: ["#121016", "#221e28", "#383242", "#524a5e", "#746a82", "#9e94ac"],
    seed: 19,
  },
};

// Boss caster choreography: guard -> deep vortex gather coil -> explosive dual-palm thrust -> sustained channel -> recovery
const GUARD = { ...READY, x: 0, crouch: 2, lean: 1, fx: 11, fy: -21, bx: 9, by: -21, ffx: 8, fbx: -8 };
const COIL_1 = { ...READY, x: -4, crouch: 5, lean: -3, turn: 0.84, fx: -4, fy: -25, bx: 10, by: -23, armsFront: true, ffx: 6, fbx: -9 };
const COIL_2 = { ...READY, x: -6, crouch: 7, lean: -4, turn: 0.92, fx: -6, fy: -26, bx: 8, by: -25, armsFront: true, ffx: 5, fbx: -10 };
const THRUST = { ...READY, x: 9, crouch: 4, lean: 5, turn: 0.38, fx: 21, fy: -26, bx: 12, by: -23, ffx: 12, fbx: -9, toeB: true, ghost: 1 };
const CHANNEL = { ...READY, x: 10, crouch: 4, lean: 5, turn: 0.36, fx: 21, fy: -25, bx: 12, by: -23, ffx: 12, fbx: -9, toeB: true, ghost: 0 };
const RECOIL = { ...READY, x: 5, crouch: 3, lean: 2, turn: 0.22, fx: 15, fy: -22, bx: 10, by: -21, ffx: 9, fbx: -8 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.28, GUARD],
    [-0.06, COIL_1],
    [T_COLLAPSE, COIL_2],
    [T_ERUPT, THRUST, "snap"],
    [T_HIT, CHANNEL],
    [T_SURGE3 + 0.22, CHANNEL],
    [T_TORRENT_END + 0.15, RECOIL],
    [2.45, { ...GUARD, x: 2, crouch: 3 }],
    [T_END, GUARD],
  ],
  hits: [
    { t: 0.10, stop: 0.03, shake: 0.22, amp: 1.8, target: false },
    { t: T_ERUPT, stop: 0.05, shake: 0.26, amp: 3.2, target: false },
    { t: T_HIT, stop: 0.16, shake: 0.54, amp: 5.5, push: 5.4, slide: SLIDE_1, straw: 38, y: -26, skin: "red", shiver: 0.48, flash: 0.06 },
    { t: T_SURGE2, stop: 0.05, shake: 0.36, amp: 4.4, push: 4.6, slide: SLIDE_2, straw: 26, y: -28, skin: "char", shiver: 0.52, flash: 0.06 },
    { t: T_SURGE3, stop: 0.08, shake: 0.46, amp: 5.0, push: 5.2, slide: SLIDE_3, daze: 1.38, straw: 34, y: -24, skin: "red", shiver: 0.60, flash: 0.07 },
    { t: 1.75, push: 0, straw: 0, flash: 0, skin: "char" },
    { t: T_END - 0.32, push: 0, straw: 0, flash: 0, skin: null, daze: 0 },
  ],
  dust: [
    { t: 0.10, x: -8, n: 5, dir: -1 },
    { t: T_ERUPT, x: 14, n: 9, dir: 1 },
    { t: T_ERUPT, x: -10, n: 6, dir: -1 },
    { t: T_HIT, x: TX + 6, n: 12, dir: 1 },
    { t: T_SURGE3, x: TX + SLIDE_2 + 6, n: 10, dir: 1 },
  ],
};

// Safe local coordinate bounds inside [448, 216] with origin [82, 168] -> x in [-82..365], y in [-168..47]
const X_MIN = -76, X_MAX = 358, Y_MIN = -160, Y_MAX = 40;

// Prebaked scalloped smoke/flame billow LUTs (radii 2..20)
const BILLOW_LUTS = Array.from({ length: 21 }, (_, r) => {
  if (r < 2) return [];
  const pts = [];
  for (let dy = -r - 2; dy <= r + 2; dy++) {
    for (let dx = -r - 2; dx <= r + 2; dx++) {
      const a = Math.atan2(dy, dx);
      const sc = 0.88 + 0.13 * Math.sin(a * 5 + r * 0.81) + 0.08 * Math.cos(a * 8 - r * 0.59);
      const q = Math.hypot(dx, dy) / (r * sc);
      if (q > 1) continue;
      pts.push(dx, dy, q);
    }
  }
  return pts;
});

// True-translucent scalloped singed-grey smoke billow ("浓密的焦灰色烟雾") with warm under-lit ember rim
function drawSingedSmokeBillow(p, cx, cy, r, u, Sm, C, G, alpha) {
  const fade = (1 - smooth(0.45, 1, u)) * alpha;
  if (fade <= 0.02) return;
  const ri = clamp(Math.round(r), 2, 20), pts = BILLOW_LUTS[ri];
  if (!pts.length) return;
  const rx = Math.round(cx), ry = Math.round(cy);
  const emberWarmth = Math.max(0, 1 - u * 1.35);
  for (let i = 0; i < pts.length; i += 3) {
    const dx = pts[i], dy = pts[i + 1], q = pts[i + 2];
    const px = rx + dx, py = ry + dy;
    if (px < X_MIN || px > X_MAX || py < Y_MIN || py > 2) continue;
    const topLit = (-dy * 0.72 - dx * 0.25) / Math.max(1, ri);
    const botLit = (dy * 0.8) / Math.max(1, ri);
    let col, a;
    if (q < 0.52) {
      col = topLit > 0.20 ? Sm[3] : Sm[1];
      a = fade * 0.88;
    } else if (q < 0.80) {
      col = emberWarmth > 0.22 && botLit > 0.24 ? mix(Sm[2], C[3], emberWarmth * 0.68) : topLit > 0.10 ? Sm[4] : Sm[2];
      a = fade * 0.76;
    } else {
      col = emberWarmth > 0.30 && botLit > 0.30 ? mix(Sm[3], G[4], emberWarmth * 0.58) : topLit > 0.04 ? Sm[5] : Sm[0];
      a = fade * 0.58;
    }
    p.blend(px, py, col, a);
  }
}

// Coaxial 3D-tilted translucent flowing-gold sonic-boom gas ring ("多层环状的流金色半透明音爆气圈")
function drawSonicBoomRing(p, cx, cy, r, thick, tiltX, G, C, alpha, isBack) {
  if (r < 2 || alpha <= 0.02) return;
  const rx = Math.max(2.5, r * tiltX);
  const ry = r;
  const x0 = Math.max(X_MIN, Math.floor(cx - rx - thick - 2));
  const x1 = Math.min(X_MAX, Math.ceil(cx + rx + thick + 2));
  const y0 = Math.max(Y_MIN, Math.floor(cy - ry - thick - 2));
  const y1 = Math.min(2, Math.ceil(cy + ry + thick + 2));

  for (let py = y0; py <= y1; py++) {
    const dy = py - cy;
    for (let px = x0; px <= x1; px++) {
      const dx = px - cx;
      // Back half of the vertical ring is dx < 0; front half is dx >= 0
      if (isBack ? dx > 1 : dx < -1) continue;
      const nx = dx / rx;
      const ny = dy / ry;
      const d = Math.hypot(nx, ny);
      const bandW = thick / Math.max(4, r);
      const q = Math.abs(d - 1) / bandW;
      if (q > 1) continue;

      const ang = Math.atan2(ny, nx);
      const shimmer = 0.82 + 0.18 * Math.sin(ang * 6 + r * 0.35);
      const rim = 1 - q;
      const a = alpha * shimmer * Math.pow(rim, 0.82) * (isBack ? 0.65 : 0.92);
      if (a <= 0.03) continue;

      const col = rim > 0.74 ? WHITE : rim > 0.45 ? G[5] : rim > 0.22 ? G[4] : C[4];
      p.blend(px, py, col, a);
    }
  }
}

// Complete 360-degree Elliptical Annular Spatial Ripple around the struck enemy ("环状空间涟漪")
function drawSpatialRipple(p, cx, cy, r, sy, u, G, C, seed) {
  const fade = 1 - smooth(0.22, 1, u);
  if (r < 3 || fade <= 0.03) return;
  const steps = Math.max(64, Math.round(r * 3.8));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    const gap = Math.sin(a * 4 + seed + u * 9) + 0.55 * Math.cos(a * 7 - u * 13);
    if (gap < -0.25) continue;
    const wob = 1.6 * Math.sin(a * 8 - u * 20 + seed);
    // Horizontal major axis rx = r, vertical minor axis ry = r * sy so the entire 360° ring floats around the enemy chest!
    const rx = r + wob;
    const ry = (r + wob) * sy;
    const px = Math.round(cx + Math.cos(a) * rx);
    const py = Math.round(cy + Math.sin(a) * ry);
    if (px < X_MIN || px > X_MAX || py < Y_MIN || py > 2) continue;
    const isHot = gap > 0.42;
    p.blend(px, py, isHot ? WHITE : i % 2 === 0 ? G[5] : C[5], fade * (isHot ? 0.95 : 0.78));
    p.blend(px, py - 1, isHot ? G[5] : G[4], fade * 0.58);
  }
}

export function create(o) {
  const C = fit(o.palette, 9);
  const H = hotFirst(C);
  const G = fit(o.gold, 7);
  const Sm = fit(o.smoke, 6);
  const R = new Rng(o.seed);
  const seed = o.seed * 23;
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, G[5], G[4], C[4]],
    haze: C[4],
  });
  const lights = new Lights();

  // Enemy current X position accounting for 3-stage knockback slide
  const enemyX = (time) => {
    if (time < T_HIT) return TX;
    if (time < T_SURGE2) return lerp(TX, TX + SLIDE_1, ease.outCubic(clamp((time - T_HIT) / 0.16)));
    if (time < T_SURGE3) return lerp(TX + SLIDE_1, TX + SLIDE_2, ease.outCubic(clamp((time - T_SURGE2) / 0.16)));
    return lerp(TX + SLIDE_2, TX + SLIDE_3, ease.outCubic(clamp((time - T_SURGE3) / 0.22)));
  };

  // 1. Prebake 112 spiraling dark-crimson & flowing-gold particles collapsing into (MX, MY)
  const spiralMotes = Array.from({ length: 112 }, (_, i) => {
    const isGold = i % 2 === 0;
    const arm = i % 4;
    const a0 = (arm / 4) * TAU + (i / 112) * TAU + R.range(-0.18, 0.18);
    const r0 = R.range(28, 72);
    const t0 = R.range(0.0, 0.18);
    const dur = R.range(0.24, T_ERUPT - t0);
    const spin = R.range(4.8, 8.8);
    const size = R.range(1.3, 2.5);
    return { isGold, a0, r0, t0, dur, spin, size };
  });

  // 1b. Prebake 28 broken refractive heat-shimmer distortion arcs warping local space around (MX, MY)
  const heatArcs = Array.from({ length: 28 }, (_, i) => ({
    a0: (i / 28) * TAU + R.range(-0.2, 0.2),
    span: R.range(0.45, 0.95),
    r0: R.range(18, 62),
    speed: R.range(1.8, 3.2),
    phase: R.range(0, 1),
    isGold: i % 2 === 0,
  }));

  // 2. Prebake 7 staggered multi-layer flowing-gold sonic-boom gas rings ("多层环状的流金色半透明音爆气圈")
  const sonicRings = [
    { t0: T_ERUPT + 0.00, dur: 0.42, x0: MX + 4, x1: MX + 52, r0: 9, r1: 36, thick: 5.2, tilt: 0.38 },
    { t0: T_ERUPT + 0.015, dur: 0.46, x0: MX + 14, x1: MX + 92, r0: 11, r1: 44, thick: 5.6, tilt: 0.36 },
    { t0: T_ERUPT + 0.03, dur: 0.50, x0: MX + 26, x1: MX + 134, r0: 12, r1: 50, thick: 5.8, tilt: 0.35 },
    { t0: T_ERUPT + 0.05, dur: 0.52, x0: MX + 40, x1: TX - 8, r0: 13, r1: 54, thick: 6.0, tilt: 0.34 },
    { t0: T_ERUPT + 0.08, dur: 0.54, x0: MX + 52, x1: TX + 16, r0: 12, r1: 56, thick: 6.0, tilt: 0.34 },
    { t0: T_ERUPT + 0.12, dur: 0.54, x0: MX + 64, x1: TX + 44, r0: 11, r1: 52, thick: 5.5, tilt: 0.34 },
    { t0: T_ERUPT + 0.17, dur: 0.48, x0: MX + 22, x1: TX + 22, r0: 9, r1: 46, thick: 4.8, tilt: 0.35 },
  ];

  // 3. Prebake 8 full-360° annular spatial ripples around the struck enemy ("被多层环形气浪与火焰吞噬，产生高频的炽白受击闪烁与环状空间涟漪")
  const spatialRipples = [
    { t0: T_HIT + 0.00, dur: 0.46, r0: 10, r1: 54, sy: 0.38, seed: 11 },
    { t0: T_HIT + 0.06, dur: 0.48, r0: 12, r1: 64, sy: 0.34, seed: 29 },
    { t0: T_HIT + 0.13, dur: 0.50, r0: 10, r1: 50, sy: 0.44, seed: 47 },
    { t0: T_SURGE2 + 0.00, dur: 0.50, r0: 12, r1: 68, sy: 0.36, seed: 73 },
    { t0: T_SURGE2 + 0.08, dur: 0.48, r0: 12, r1: 58, sy: 0.42, seed: 97 },
    { t0: T_SURGE3 + 0.00, dur: 0.56, r0: 14, r1: 72, sy: 0.35, seed: 131 },
    { t0: T_SURGE3 + 0.09, dur: 0.52, r0: 12, r1: 62, sy: 0.42, seed: 163 },
    { t0: T_SURGE3 + 0.18, dur: 0.48, r0: 10, r1: 52, sy: 0.38, seed: 199 },
  ];

  // 4. Prebake 54 dense singed-grey smoke billows anchored along the ground & beam corridor ("能量路径上翻涌起浓密的焦灰色烟雾")
  const pathSmoke = Array.from({ length: 54 }, (_, i) => {
    const uPath = i / 53;
    const x0 = lerp(MX + 4, END_X - 8, uPath) + R.range(-8, 8);
    const y0 = i % 2 === 0 ? R.range(-14, -3) : MY + R.range(-6, 10);
    const t0 = lerp(T_TORRENT + 0.36, T_TORRENT_END + 0.22, uPath * 0.60 + R.range(0, 0.40));
    const life = R.range(1.40, 2.18);
    const r0 = R.range(7.0, 11.5);
    const r1 = R.range(14.0, 20.0);
    const vx = R.range(-7, 16);
    const vy = -R.range(16, 35);
    const swayPh = R.range(0, TAU);
    return { x0, y0, t0, life, r0, r1, vx, vy, swayPh };
  });

  // 5. Prebake 120 ascending flowing-gold sparks & dark-red light dust on thermal currents ("大量流金色火星与暗红光尘随热流向上升腾消散")
  const thermalMotes = Array.from({ length: 120 }, (_, i) => {
    const isGoldSpark = i % 2 === 0;
    const x0 = R.range(MX + 2, END_X - 4);
    const y0 = R.range(-34, -1);
    const t0 = R.range(T_HIT + 0.16, T_TORRENT_END + 0.85);
    const life = Math.min(R.range(1.20, 1.98), T_END - 0.10 - t0);
    const vy = -R.range(36, 82);
    const vx = R.range(-12, 16);
    const swayAmp = R.range(4.5, 12.0);
    const swayFreq = R.range(4.5, 8.8);
    const phase = R.range(0, TAU);
    const sz = R.range(1.3, 2.6);
    return { isGoldSpark, x0, y0, t0, life, vx, vy, swayAmp, swayFreq, phase, sz };
  });

  let t = 0;
  let erupted = false;
  let hit1 = false, hit2 = false, hit3 = false;
  let streamAcc = 0;

  const capLife = (l) => Math.max(0.08, Math.min(l, T_END - 0.10 - t));

  // Local Space Heat-Wave Distortion & Blinding White Singularity Core (0.00..0.54s)
  function drawGatherAndHeatWave(p) {
    if (t >= T_TORRENT + 0.04) return;
    const u = clamp(t / T_ERUPT);
    const fadeOut = 1 - smooth(T_ERUPT + 0.02, T_TORRENT + 0.03, t);

    // 1. Severe Local Space Heat-Wave Distortion Arcs & Shimmering Air Ripples ("局部空间产生剧烈的热浪扭曲")
    for (const ha of heatArcs) {
      const cyc = fract(t * ha.speed + ha.phase);
      const r = lerp(ha.r0, 6, ease.inQuad(cyc));
      const aWave = Math.sin(cyc * Math.PI) * fadeOut * 0.78;
      if (aWave <= 0.03) continue;
      const rotA = ha.a0 + cyc * 2.4;
      const steps = Math.max(12, Math.round(r * ha.span * 2.2));
      for (let i = 0; i <= steps; i++) {
        const v = i / steps;
        const ang = rotA + (v - 0.5) * ha.span;
        const shimmer = 2.6 * Math.sin(v * Math.PI * 3 - t * 34);
        const rad = r + shimmer;
        const px = Math.round(MX + Math.cos(ang) * rad);
        const py = Math.round(MY + Math.sin(ang) * rad * 0.86);
        if (px < X_MIN || px > X_MAX || py < Y_MIN || py > 1) continue;
        const tipFade = Math.sin(v * Math.PI);
        const col = ha.isGold ? (tipFade > 0.6 ? G[5] : G[4]) : tipFade > 0.6 ? C[5] : C[3];
        p.blend(px, py, col, aWave * tipFade);
        if (tipFade > 0.5) p.blend(px + 1, py, ha.isGold ? G[3] : C[2], aWave * tipFade * 0.55);
      }
    }

    // Rising vertical heat-mirage waves warping air from the floor around (MX, 0)
    for (let m = 0; m < 7; m++) {
      const hx0 = MX + (m - 3) * 10;
      for (let dy = 0; dy < 44; dy += 2) {
        const py = -dy;
        const wx = hx0 + Math.sin(dy * 0.25 - t * 30 + m * 1.9) * 3.0;
        const kH = (1 - dy / 44) * fadeOut * 0.48;
        p.blend(wx, py, m % 2 === 0 ? G[4] : C[3], kH);
      }
    }

    // 2. High-Speed Spiraling Dark-Crimson & Flowing-Gold Light Particles ("大量暗红色与流金色光粒向中心高速旋转坍缩")
    for (const m of spiralMotes) {
      if (t < m.t0 || t >= m.t0 + m.dur) continue;
      const mu = clamp((t - m.t0) / m.dur);
      const r = m.r0 * Math.pow(1 - mu, 1.32);
      const ang = m.a0 + m.spin * (mu + 2.1 * mu * mu);
      const x = MX + Math.cos(ang) * r;
      const y = MY + Math.sin(ang) * r * 0.86;

      // Long curved logarithmic-spiral tail behind each particle
      for (let s = 6; s >= 1; s--) {
        const prevU = Math.max(0, mu - s * 0.024);
        const pr = m.r0 * Math.pow(1 - prevU, 1.32);
        const pang = m.a0 + m.spin * (prevU + 2.1 * prevU * prevU);
        const tx = MX + Math.cos(pang) * pr;
        const ty = MY + Math.sin(pang) * pr * 0.86;
        const tailCol = m.isGold ? (s <= 2 ? G[5] : G[3]) : s <= 2 ? C[5] : C[3];
        p.blend(tx, ty, tailCol, (1 - s / 7) * 0.9);
      }

      const headCol = mu > 0.72 ? WHITE : m.isGold ? G[6] : C[6];
      const bodyCol = m.isGold ? G[4] : C[4];
      p.circle(x, y, m.size * (1 - mu * 0.30), bodyCol);
      p.px(x, y, headCol);
      p.glow(x, y, 5, m.isGold ? G[4] : C[4], 0.40);
    }

    // 3. Collapsing Blinding White Singularity Core ("坍缩成一颗刺眼的白光核心")
    const pinch = smooth(0.45, 0.95, u);
    const coreR = lerp(3.0 + 6.0 * u, 10.5, pinch) * fadeOut;
    p.ring(MX, MY, coreR + 3.5, 1.8, C[4]);
    p.ring(MX, MY, coreR + 1.8, 1.5, G[5]);
    p.circle(MX, MY, coreR, WHITE);

    if (u > 0.30) {
      const kStar = ((u - 0.30) / 0.70) * fadeOut;
      const spikeX = 20 + 36 * kStar;
      const spikeY = 15 + 26 * kStar;
      p.line(MX - spikeX, MY, MX + spikeX, MY, WHITE, kStar);
      p.line(MX, MY - spikeY, MX, MY + spikeY, WHITE, kStar);
      flare(p, MX, MY, 20 + 32 * kStar, 0.68 + 0.32 * kStar, [C[4], G[4], G[6], WHITE]);
      sparkle(p, MX, MY, 10 + 15 * kStar, WHITE, G[5], kStar);
    }
    p.glow(MX, MY, (32 + 46 * u) * fadeOut, G[4], 0.68 * u * fadeOut);
    p.glow(MX, MY, (18 + 24 * pinch) * fadeOut, WHITE, 0.95 * pinch * fadeOut);
    floorLight(p, MX - 2, 2, 38 * u * fadeOut, 8, G[4], 0.42 * u * fadeOut);
  }

  // Colossal Horizontal Crimson-Red & Flowing-Gold Flame Torrent ("一道粗大的赤红色夹杂金芒的烈焰能量洪流横向贯穿而出")
  function drawCrimsonGoldTorrent(p) {
    if (t < T_TORRENT || t >= T_TORRENT_END) return;
    const uTotal = (t - T_TORRENT) / (T_TORRENT_END - T_TORRENT);
    const extU = clamp((t - T_TORRENT) / 0.08); // Slams across the stage in 80ms!
    const pinchOut = 1 - smooth(0.76, 1.0, uTotal);
    const curEndX = lerp(MX + 16, END_X, ease.outQuart(extU));
    const baseW = 15.5 * pinchOut;
    if (baseW < 0.8) return;

    const NZ = (rate, s2 = 0, off = 0) => noise(t * rate + off, s2);

    // 1. Roaring crimson flame blades peeling backward along the upper & lower boundaries of the torrent
    for (let i = 0; i < 18; i++) {
      const ph = ((i * 0.618 + t * 2.9) % 1);
      const bx = lerp(MX + 10, curEndX - 16, ph);
      if (bx >= curEndX - 8) continue;
      const side = i % 2 === 0 ? -1 : 1;
      const localW = baseW * (0.85 + 0.38 * Math.pow((bx - MX) / (END_X - MX), 0.55));
      const rootY = MY + side * localW * 0.78;
      if (rootY > -2) continue;
      const bladeLen = (18 + 15 * ph) * pinchOut;
      flameBlade(
        p,
        bx,
        rootY,
        0.92,
        side * 0.36,
        bladeLen,
        4.2 * pinchOut,
        side * 2.4,
        NZ,
        seed + i * 19,
        H,
        LAYERS,
        0.45,
        0.95,
      );
    }

    // 2. Main Colossal Crimson-Red Energy Torrent Body + Interwoven Flowing-Gold Ribbons
    for (let x = MX; x <= curEndX; x++) {
      const uX = (x - MX) / Math.max(1, curEndX - MX);
      const headTaper = uX > 0.88 ? Math.sqrt(Math.max(0, (1 - uX) / 0.12)) : Math.min(1, (x - MX + 4) / 11);
      const waveW =
        1 +
        0.16 * Math.sin(x * 0.09 - t * 38) +
        0.10 * Math.cos(x * 0.19 - t * 52 + 1.4);
      const w = baseW * (0.86 + 0.44 * Math.pow(uX, 0.52)) * waveW * headTaper;
      if (w < 0.6) continue;

      const cy = MY + 1.8 * Math.sin(x * 0.045 - t * 26) * Math.pow(uX, 0.7);
      const surgePulse = fract(x * 0.018 - t * 6.5) < 0.14 ? 1 : 0;

      const y0 = Math.max(Y_MIN, Math.floor(cy - w - 2));
      const y1 = Math.min(1, Math.ceil(cy + w + 2));
      for (let y = y0; y <= y1; y++) {
        const q = Math.abs(y - cy) / w;
        if (q > 1.12) continue;
        if (q > 0.90 && Math.sin(x * 0.45 + y * 1.9 - t * 48) < 0.05) continue;

        let col;
        if (q < 0.14 + surgePulse * 0.08) {
          col = WHITE; // Tight incandescent white core spine
        } else if (q < 0.27 + surgePulse * 0.06) {
          col = G[5];  // Inner flowing-gold core edge
        } else if (q < 0.52) {
          col = C[4];  // Vivid crimson-red roaring flame body (#e62e28)
        } else if (q < 0.76) {
          col = C[3];  // Deep blood-crimson flame body (#b41720)
        } else if (q < 0.94) {
          col = C[2];  // Dark crimson outer sheath (#740b16)
        } else {
          col = C[1];  // Charred dark-crimson edge (#3c050c)
        }
        p.px(x, y, col);
      }

      // 3. Four Braided Flowing-Gold Energy Ribbons ("夹杂金芒") weaving boldly through the crimson torrent
      for (let s = 0; s < 4; s++) {
        const a = x * 0.068 - t * 34 + (s * TAU) / 4;
        const sy = cy + Math.sin(a) * w * 0.78;
        const depth = Math.cos(a);
        if (depth > -0.20 && sy <= 1) {
          const isHot = depth > 0.48;
          p.px(x, sy, isHot ? WHITE : G[5]);
          p.px(x, sy - 1, isHot ? G[5] : G[4]);
          p.px(x, sy + 1, isHot ? G[5] : G[3]);
        }
      }

      if ((x & 15) === 0) {
        p.glow(x, cy, w * 2.5 + 10, C[4], 0.40 * pinchOut);
        p.glow(x, cy, w * 1.3 + 4, G[4], 0.34 * pinchOut);
      }
    }

    // 4. Jagged Flowing-Gold Lightning Bolts crackling along the crimson torrent
    for (let b = 0; b < 3; b++) {
      const bRng = new Rng(Math.floor(t * 28) * 13 + b * 31 + o.seed);
      const yOff = (b - 1) * 6;
      const pts = bolt(bRng, MX + 6, MY + yOff, curEndX - 8, MY - yOff, { jag: 0.14, depth: 4 });
      p.polyline(pts, b === 1 ? WHITE : G[5], 0.92 * pinchOut);
    }

    // 5. Roaring Muzzle Singularity Dome at (MX, MY)
    const mr = (12 + 2.5 * Math.sin(t * 42)) * pinchOut;
    p.circle(MX, MY, mr + 3, C[3]);
    p.circle(MX, MY, mr + 1, G[4]);
    p.circle(MX, MY, mr * 0.72, G[6]);
    p.circle(MX, MY, mr * 0.45, WHITE);
    flare(p, MX, MY, 30 * pinchOut, 0.88 * pinchOut, [C[4], G[4], G[6], WHITE]);
    p.glow(MX, MY, 54 * pinchOut, C[4], 0.78 * pinchOut);

    // 6. Warm crimson-gold floor reflection along the entire beam corridor
    for (let lx = MX + 16; lx <= curEndX - 12; lx += 42) {
      floorLight(p, lx, 2, 40, 9, C[4], 0.42 * pinchOut);
    }
  }

  // Enemy Engulfment: Multi-Layer Annular Air-Waves, Roaring Flames & High-Frequency White Hit-Strobe
  function drawEnemyEngulfment(p, isBack) {
    if (t < T_HIT) return;
    const ex = enemyX(t);
    const ey = -27;
    const hitAge = t - T_HIT;

    // 1. Ground-hugging elliptical shockwave bands around the enemy
    for (const tWave of [T_HIT, T_SURGE2, T_SURGE3]) {
      const dtW = t - tWave;
      if (dtW >= 0 && dtW < 0.48) {
        const k = dtW / 0.48;
        band(
          p,
          ex,
          0.5,
          68 * ease.outCubic(k),
          SY,
          Math.max(1, 5.0 * (1 - k)),
          1 - k,
          [C[2], C[4], G[4], WHITE],
          isBack ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0,
        );
      }
    }

    if (isBack) return;

    // 2. Multi-Layer Annular Air-Waves & Roaring Flames Swallowing the Enemy ("被多层环形气浪与火焰吞噬")
    if (t < T_TORRENT_END + 0.30) {
      const kEngulf = 1 - smooth(T_TORRENT_END - 0.12, T_TORRENT_END + 0.30, t);
      const NZ = (rate, s2 = 0, off = 0) => noise(t * rate + off, s2);

      // Towering engulfing crimson-gold flames wrapping around the enemy
      for (let i = 0; i < 11; i++) {
        const ox = (i - 5) * 4.8;
        const fh = (28 + 20 * Math.sin(i * 1.3 + t * 14)) * kEngulf;
        const fw = (5.0 + 2.0 * (1 - Math.abs(i - 5) / 5.5)) * kEngulf;
        flameTongue(
          p,
          ex + ox,
          2,
          fh,
          fw,
          Math.sin(t * 16 + i) * 3.5 + 3.2,
          NZ,
          seed + 300 + i * 17,
          H,
          LAYERS,
          0.45,
          0.95,
        );
      }

      // 4 Concentric Translucent Annular Blast Waves ("多层环形气浪") wrapping the enemy
      for (let w = 0; w < 4; w++) {
        const q = fract((t - T_HIT) * 3.4 + w / 4);
        const rad = lerp(10, 48, ease.outCubic(q));
        const thick = 6.0 * (1 - q * 0.60);
        drawSonicBoomRing(p, ex, ey, rad, thick, 0.58, G, C, (1 - q) * kEngulf * 0.92, false);
      }
    }

    // 3. High-Frequency Incandescent White Hit-Strobe ("产生高频的炽白受击闪烁")
    if (hitAge >= 0 && t < T_TORRENT_END) {
      const strobePhase = Math.sin(hitAge * 185); // ~30 Hz high-frequency strobe
      if (strobePhase > 0.05) {
        const kStrobe = ((strobePhase - 0.05) / 0.95) * (1 - smooth(T_SURGE3 + 0.18, T_TORRENT_END, t));
        p.disc(ex, ey, 24 * kStrobe, WHITE, (d) => 0.82 * (1 - d * d) * kStrobe);
        p.ring(ex, ey, 16 + 10 * (1 - kStrobe), 1.8, WHITE);
        flare(p, ex, ey, 52 * kStrobe, kStrobe, [C[4], G[4], G[6], WHITE]);
        sparkle(p, ex + Math.sin(t * 95) * 6, ey + Math.cos(t * 85) * 7, 20 * kStrobe, WHITE, G[5], kStrobe);
        p.glow(ex, ey, 62 * kStrobe, WHITE, 0.90 * kStrobe);
      }
    }

    // 4. Complete 360-degree Annular Spatial Ripples ("环状空间涟漪") expanding around the enemy
    for (const sr of spatialRipples) {
      if (t < sr.t0 || t >= sr.t0 + sr.dur) continue;
      const u = (t - sr.t0) / sr.dur;
      const r = lerp(sr.r0, sr.r1, ease.outQuart(u));
      drawSpatialRipple(p, ex, ey, r, sr.sy, u, G, C, sr.seed);
    }
  }

  // Hit Result & Aftermath: Dense Singed-Grey Smoke & Rising Flowing-Gold Sparks + Dark-Red Light Dust
  function drawAftermathSmokeAndEmbers(p, isBack) {
    // 1. Dense Singed-Grey Smoke Billowing Along the Energy Path ("能量路径上翻涌起浓密的焦灰色烟雾")
    for (let i = 0; i < pathSmoke.length; i++) {
      if ((i % 2 === 0) !== isBack) continue;
      const sm = pathSmoke[i];
      if (t < sm.t0 || t >= sm.t0 + sm.life) continue;
      const age = t - sm.t0;
      const u = age / sm.life;
      const x = sm.x0 + sm.vx * age + Math.sin(age * 3.5 + sm.swayPh) * 4.5;
      const y = sm.y0 + sm.vy * Math.pow(age, 0.88);
      const r = lerp(sm.r0, sm.r1, ease.outQuad(u));
      drawSingedSmokeBillow(p, x, y, r, u, Sm, C, G, 0.94);
    }

    if (isBack) return;

    // 2. Abundant Flowing-Gold Sparks & Dark-Red Light Dust Ascending on Thermal Currents ("大量流金色火星与暗红光尘随热流向上升腾消散")
    for (const tm of thermalMotes) {
      if (t < tm.t0 || t >= tm.t0 + tm.life) continue;
      const age = t - tm.t0;
      const u = age / tm.life;
      const fade = Math.sin(Math.min(1, u * 4) * (Math.PI / 2)) * (1 - smooth(0.55, 1.0, u));
      if (fade <= 0.03) continue;

      const sway = Math.sin(age * tm.swayFreq + tm.phase) * tm.swayAmp * u;
      const x = tm.x0 + tm.vx * age + sway;
      const y = tm.y0 + tm.vy * age;
      if (x < X_MIN + 4 || x > X_MAX - 4 || y < Y_MIN + 6 || y > 1) continue;

      if (tm.isGoldSpark) {
        // Flowing-Gold Spark ("流金色火星"): rising curved golden streak + twinkling white-gold head
        const dx = Math.cos(age * tm.swayFreq + tm.phase) * 2.4;
        const len = (3.2 + tm.sz * 1.5) * fade;
        p.line(x - dx, y + len, x, y, G[4], fade);
        p.px(x, y, u < 0.48 ? WHITE : G[5]);
        if (tm.sz > 1.8 && Math.sin(t * 22 + tm.phase) > 0.30) {
          sparkle(p, x, y, 2.8 * fade, WHITE, G[5], 0.70 * fade);
        }
        p.glow(x, y, 6 * fade, G[4], 0.48 * fade);
      } else {
        // Dark-Red Light Dust ("暗红光尘"): soft glowing crimson orb with translucent dark-red aura
        const rDust = tm.sz * (0.85 + 0.40 * Math.sin(age * 9 + tm.phase)) * fade;
        p.disc(x, y, rDust * 2.3, C[2], (d) => 0.56 * (1 - d * d) * fade);
        p.disc(x, y, rDust * 1.3, C[4], (d) => 0.82 * (1 - d * d) * fade);
        p.px(x, y, C[5]);
        p.glow(x, y, 7 * fade, C[3], 0.45 * fade);
      }
    }
  }

  return {
    update(dt) {
      t += dt;
      const ex = enemyX(t);

      // Eruption at T_ERUPT (0.45s)
      if (!erupted && t >= T_ERUPT) {
        erupted = true;
        lights.add(MX, MY, 88, G[4], 1.0, 0.48);
        lights.add(MX, MY, 44, WHITE, 0.95, 0.15);
        for (let i = 0; i < 38; i++) {
          const a = R.range(-0.65, 0.65);
          const sp = R.range(115, 285);
          ps.spawn(P.SPARK, MX + 4, MY + R.range(-6, 6), Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.22, 0.54)));
        }
      }

      // Continuous sparks, flames, and smoke shed along the roaring torrent (T_TORRENT .. T_TORRENT_END)
      if (t >= T_TORRENT && t < T_TORRENT_END) {
        for (streamAcc += dt * 120; streamAcc >= 1; streamAcc--) {
          const sx = R.range(MX + 8, END_X - 12);
          const sy = MY + R.range(-13, 13);
          if (R.chance(0.45)) {
            ps.spawn(
              P.FIRE,
              sx,
              sy,
              R.range(45, 165),
              R.range(-48, 25),
              capLife(R.range(0.28, 0.62)),
              0,
              R.range(4.0, 7.0),
              0,
              R.chance(0.5) ? PF.SMOKES : 0,
            );
          } else {
            ps.spawn(
              P.SPARK,
              sx,
              sy,
              R.range(80, 240),
              R.range(-85, 65),
              capLife(R.range(0.18, 0.45)),
            );
          }
        }
      }

      // 3-Stage Heavy Impact Detonations on the Enemy (T_HIT, T_SURGE2, T_SURGE3)
      const triggerHitBurst = (power) => {
        lights.add(ex, -25, 96 * power, C[4], 1.05, 0.56);
        lights.add(ex, -25, 50 * power, WHITE, 0.95, 0.15);
        for (let i = 0; i < Math.round(34 * power); i++) {
          const a = R.range(-Math.PI, Math.PI);
          const sp = R.range(75, 255);
          ps.spawn(
            P.SPARK,
            ex + R.range(-8, 8),
            -25 + R.range(-10, 10),
            Math.cos(a) * sp + 35,
            Math.sin(a) * sp - 25,
            capLife(R.range(0.24, 0.58)),
          );
        }
        for (let i = 0; i < Math.round(18 * power); i++) {
          const a = R.range(-Math.PI - 0.1, 0.1);
          const sp = R.range(45, 165);
          ps.spawn(
            P.FIRE,
            ex + R.range(-10, 10),
            -22 + R.range(-8, 8),
            Math.cos(a) * sp + 20,
            Math.sin(a) * sp * 0.75 - 35,
            capLife(R.range(0.45, 0.92)),
            0,
            R.range(5.0, 8.8),
            0,
            PF.SMOKES | PF.BIG,
          );
        }
      };

      if (!hit1 && t >= T_HIT) {
        hit1 = true;
        triggerHitBurst(1.0);
      }
      if (!hit2 && t >= T_SURGE2) {
        hit2 = true;
        triggerHitBurst(0.85);
      }
      if (!hit3 && t >= T_SURGE3) {
        hit3 = true;
        triggerHitBurst(1.1);
      }

      ps.update(dt);
      cullParticles(ps, X_MIN + 4, Y_MIN + 4, X_MAX - 4, Y_MAX - 4);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;

      // Oppressive arena darkening during singularity collapse & peak torrent impact ("展现压迫感")
      if (t >= 0.28 && t < 1.42) {
        const kDark =
          0.74 * smooth(0.28, T_ERUPT, t) * (1 - smooth(1.10, 1.42, t));
        if (kDark > 0.03) {
          unlight(
            p,
            TX - 80,
            -104,
            TX + 90,
            8,
            (x, y) => {
              const d = Math.hypot((x - (TX + 12)) / 82, (y + 28) / 64);
              return d > 0.48 && d < 1;
            },
            1 - kDark,
          );
        }
      }

      // Back layer of aftermath smoke billows
      drawAftermathSmokeAndEmbers(p, true);

      // Back half of enemy engulfment shockwave bands
      drawEnemyEngulfment(p, true);

      // Back half of the 7 staggered translucent flowing-gold sonic-boom gas rings
      for (const sr of sonicRings) {
        if (t < sr.t0 || t >= sr.t0 + sr.dur) continue;
        const u = (t - sr.t0) / sr.dur;
        const cx = lerp(sr.x0, sr.x1, ease.outCubic(u));
        const r = lerp(sr.r0, sr.r1, ease.outQuart(u));
        const thick = sr.thick * (1 - 0.45 * u);
        const life = 1 - smooth(0.35, 1.0, u);
        drawSonicBoomRing(p, cx, MY, r, thick, sr.tilt, G, C, life, true);
      }

      simDraw(p, ps, H, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;

      // 1. Heat-Wave Distortion & Spiraling Collapse into Blinding White Core (0.00..0.54s)
      drawGatherAndHeatWave(p);

      // 2. Colossal Horizontal Crimson-Red & Flowing-Gold Flame Torrent (0.57..1.52s)
      drawCrimsonGoldTorrent(p);

      // 3. Front half of the 7 staggered translucent flowing-gold sonic-boom gas rings ("先是扩散出多层环状的流金色半透明音爆气圈")
      for (const sr of sonicRings) {
        if (t < sr.t0 || t >= sr.t0 + sr.dur) continue;
        const u = (t - sr.t0) / sr.dur;
        const cx = lerp(sr.x0, sr.x1, ease.outCubic(u));
        const r = lerp(sr.r0, sr.r1, ease.outQuart(u));
        const thick = sr.thick * (1 - 0.45 * u);
        const life = 1 - smooth(0.35, 1.0, u);
        drawSonicBoomRing(p, cx, MY, r, thick, sr.tilt, G, C, life, false);
      }

      // 4. Enemy Hit: Engulfed by Multi-Layer Rings & Flames, High-Frequency White Strobe & Spatial Ripples
      drawEnemyEngulfment(p, false);

      // 5. Aftermath: Dense Singed-Grey Smoke Billowing Along the Path & Rising Flowing-Gold Sparks + Dark-Red Light Dust
      drawAftermathSmokeAndEmbers(p, false);

      // 6. Hero Eruption Flash at T_ERUPT (0.45s)
      const aErupt = t - T_ERUPT;
      if (aErupt >= 0 && aErupt < 0.12) {
        const uE = 1 - aErupt / 0.12;
        p.circle(MX, MY, 24 * uE, G[5]);
        p.circle(MX, MY, 15 * uE, WHITE);
        flare(p, MX, MY, 58 * uE, uE, [C[4], G[4], G[6], WHITE]);
      }

      simDraw(p, ps, H, "front");
      lights.draw(p);
    },
  };
}

function cullParticles(ps, x0, y0, x1, y1) {
  const L = ps.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i];
    const r = (q.size || 2) * 1.8 + 4;
    if (q.x - r < x0 || q.x + r > x1 || q.y - r < y0 || q.y + r > y1) {
      L.splice(i, 1);
    }
  }
}
