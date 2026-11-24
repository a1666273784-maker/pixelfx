// Battlefield Embers (战场余烬 — weather/battlefield-embers):
// Designed as a TRUE transparent/translucent + additive SCENE OVERLAY (`可叠加在任意游戏环境中的场景装饰特效`):
// 1. Continuous Bottom Searing Orange-Red Glow (从屏幕最底部持续泛起橙红色的灼热红光): Translucent molten crimson-orange
//    heat waves (`R.b = 1` alpha-blended veil fading cleanly to 0% alpha upward) + rich additive orange-red firelight
//    (`R.l` / `R.k`) well up continuously from the very bottom edge, bathing any underlying game environment in
//    oppressive post-battle / purgatory heat without covering or blocking the scene.
// 2. Full-Screen Rising Heat-Wave Air Distortion (全屏伴随轻微上升热浪空气扭曲): Translucent convective heat-mirage
//    ribbons, ±1px rising thermal refraction on the heat veil, and S-weaving ascending air-shimmer filaments ripple
//    gently across all 180 rows of the screen.
// 3. Helical Ascending Bright-Orange Sparks & Smoldering Charred Ash (无数亮橘色火星粒子与焦黑灰烬受热气流带动、沿着螺旋
//    轨迹快速向上升腾穿出屏幕顶部): Three sweeping 3D helical thermal updrafts carry hundreds of radiant bright-orange
//    comet-sparks (with translucent-tapered wakes and warm orange halos) alongside a sparse, sculpted set of
//    soft-blended smoldering charcoal-ash flakes (zero stray 1px black noise specks!) rapidly out the top edge.
// 4. Sudden Mid-Air Spark Pop-Flashes & Bifurcation (火星突然爆闪分叉): Volatile superheated embers abruptly flash
//    white-gold mid-ascent and split cleanly into 2-3 diverging Y/V-forked daughter sparks.
// Fire, spark, vortex and translucent haze techniques draw on `src/fx/weather/fog.js`, `src/fx/fire/_lib.js`, and
// `src/fx/fire/fire-tornado.js` (adapted from Sprite Fusion's open-source pixel-art VFX, MIT License,
// Copyright (c) 2026 Hugo Duprez).
import { fit, clamp, smooth, mix, rng, wrap, TAU, WHITE, sparkle } from "../../core/index.js";
import { box, clip, rows, field } from "./_lib.js";

export const meta = {
  name: "Battlefield embers",
  desc: "Overlayable battlefield heat: scorching orange-red glow wells from below as bright orange sparks and smoldering ash spiral upward through shimmering air, popping and forking.",
  tags: ["weather", "fire", "embers", "ash", "battlefield", "inferno", "heat", "sparks", "overlay", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 8,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // 9-step Searing Orange-Red Bottom Glow -> Vivid Bright-Orange Spark -> White-Hot Core ramp
    palette: ["#2a0406", "#5c090a", "#98140c", "#d4280e", "#f64a10", "#ff7e18", "#ffb62e", "#ffe97c", "#ffffff"],
    // Soft warm-charcoal smoldering ash ramp (blended translucently — never harsh dead-black noise specks)
    ash:     ["#1c1115", "#2a181d", "#3d2228", "#593036"],
    seed: 13,
  },
};

const D = 8, W = 320, H = 180, X0 = -160, Y0 = -170, Y1 = 9; // local y in [-170 .. +9]
const cyc = (t, n, ph = 0) => (TAU * n * t) / D + ph;

// Fast 256-entry sine & 201-entry arcsine LUTs for <3ms/frame full-screen overlay rendering
const SIN_LUT = new Float32Array(256);
const ASIN_LUT = new Float32Array(201);
for (let i = 0; i < 256; i++) SIN_LUT[i] = Math.sin((i / 256) * TAU);
for (let i = 0; i <= 200; i++) ASIN_LUT[i] = Math.asin((i - 100) / 100);
const fastSin = (rad) => SIN_LUT[(rad * 40.743665) & 255];

function fastSample(F, x, y) {
  const d = F.d;
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const x0 = xi & 255, x1 = (xi + 1) & 255;
  const y0 = (yi & 127) << 8, y1 = ((yi + 1) & 127) << 8;
  const a = d[y0 | x0] + (d[y0 | x1] - d[y0 | x0]) * fx;
  const b = d[y1 | x0] + (d[y1 | x1] - d[y1 | x0]) * fx;
  return a + (b - a) * fy;
}

// Three sweeping helical thermal updraft columns across the 320px scene
const VORTEX_BASE_X = [-98, 4, 104];
const VORTEX_RAD    = [35, 46, 37];

function vortexSpineX(colIdx, y, t) {
  const bx = VORTEX_BASE_X[colIdx];
  const v = clamp((Y1 - y) / H, 0, 1.2);
  const ph = colIdx * 2.09;
  return (
    bx +
    (11 + 15 * v) * Math.sin(v * 3.5 - cyc(t, 2, ph)) +
    5 * v * Math.cos(v * 2.0 - cyc(t, 1, ph * 1.5))
  );
}

// Sculpted, cohesive smoldering charred-flake templates (NO 1-2px speck dust! Clean 6-9px curled ember-ash strips
// where `role = 2` is a glowing orange-red smoldering rim and `role = 0/1` is soft translucent charcoal!)
const ASH_FLAKES = [
  // 0: diagonal curled charred strip with glowing lower-right ember edge
  [[-2, -1, 1], [-1, -1, 0], [-1, 0, 0], [0, 0, 0], [1, 0, 2], [0, 1, 2], [1, 1, 2]],
  // 1: upright tumbling cinder leaf with smoldering base
  [[0, -2, 1], [-1, -1, 0], [0, -1, 0], [-1, 0, 0], [0, 0, 0], [1, 0, 2], [0, 1, 2]],
  // 2: wide fluttering charred flake catching bottom-up orange heat
  [[-2, 0, 1], [-1, 0, 0], [0, 0, 0], [1, 0, 0], [-1, 1, 2], [0, 1, 2], [1, 1, 2]],
  // 3: tilted S-flake mid-flip
  [[-1, -1, 1], [0, -1, 0], [0, 0, 0], [1, 0, 0], [1, 1, 2], [2, 1, 2]],
];

const CACHE = new Map();
function getBattlefield(S) {
  let c = CACHE.get(S);
  if (c) return c;

  const turbF = field(S * 7 + 3, 256, 128, [4, 8, 16, 32]);
  const fineF = field(S * 11 + 9, 256, 128, [8, 16, 32, 64]);

  // ---------------------------------------------------------------------------
  // 1. Pre-bake 420 Helical Ascending Bright-Orange Ember Particles (`无数亮橘色火星粒子`)!
  //    Pure luminous fire colors + translucent-blended comet wakes + additive glow
  //    so they overlay cleanly over ANY dark, mid-tone, sky, ground, or light scene!
  // ---------------------------------------------------------------------------
  const sparks = [];
  for (let i = 0; i < 420; i++) {
    const r = rng(S + 101, i);
    const tier = i < 125 ? 0 : i < 305 ? 1 : 2;
    const colIdx = i % 3;
    const born = r.next() * D;
    const life = tier === 2 ? r.range(1.45, 2.05) : tier === 1 ? r.range(1.80, 2.50) : r.range(2.25, 3.05);

    const inStream = r.chance(0.85);
    const arm = (i >> 1) & 1; // dual 180°-opposed spiral streams per column for uninterrupted S-ribbons
    const rad0 = VORTEX_RAD[colIdx] * (inStream ? r.range(0.70, 1.08) : r.range(0.30, 1.40));
    const radGrow = r.range(4, 15);
    const xOff = inStream ? r.range(-8, 8) : r.range(-25, 25);

    const omega = 3.90 + r.range(-0.30, 0.34);
    const streamSpin = (TAU * 3 * born) / D;
    const theta0 = inStream
      ? streamSpin + arm * Math.PI + colIdx * 1.05 + r.range(-0.40, 0.40)
      : r.range(0, TAU);

    const accel = r.range(0.24, 0.45);
    const size = tier === 2 ? r.range(1.65, 2.65) : tier === 1 ? r.range(1.15, 1.85) : 1.0;
    const flickerPh = r.range(0, TAU);
    sparks.push({ tier, colIdx, born, life, rad0, radGrow, xOff, omega, theta0, accel, size, flickerPh });
  }

  // ---------------------------------------------------------------------------
  // 2. Pre-bake ONLY 26 Sculpted Smoldering Charred-Ash Flakes (`焦黑灰烬`)!
  //    (~6-7 cohesive, ember-rimmed translucent charcoal flakes on screen at once —
  //     ZERO tiny 1-2px black specks, ZERO visual dirt/noise over any environment!)
  // ---------------------------------------------------------------------------
  const ashes = [];
  for (let i = 0; i < 26; i++) {
    const r = rng(S + 303, i);
    const colIdx = i % 3;
    const born = wrap((i / 26) * D + r.range(-0.08, 0.08), D);
    const life = r.range(2.05, 2.85);
    const arm = i & 1;
    const rad0 = VORTEX_RAD[colIdx] * r.range(0.68, 1.15);
    const radGrow = r.range(5, 14);
    const xOff = r.range(-12, 12);
    const omega = 3.65 + r.range(-0.30, 0.30);
    const theta0 = (TAU * 3 * born) / D + arm * Math.PI + colIdx * 1.05 + 0.55 + r.range(-0.35, 0.35);
    const accel = r.range(0.22, 0.36);
    const tumbleRate = r.range(6.5, 11.5);
    const tumblePh = r.range(0, TAU);
    ashes.push({ colIdx, born, life, rad0, radGrow, xOff, omega, theta0, accel, tumbleRate, tumblePh });
  }

  // ---------------------------------------------------------------------------
  // 3. Pre-bake 36 Hero Pop-Flash & Bifurcating Sparks (`火星突然爆闪分叉`)!
  // ---------------------------------------------------------------------------
  const popForks = [];
  for (let i = 0; i < 36; i++) {
    const r = rng(S + 707, i);
    const colIdx = i % 3;
    const born = wrap((i / 36) * D + r.range(-0.05, 0.05), D);
    const riseDur = r.range(0.50, 1.10);
    const forkDur = r.range(0.40, 0.60);
    const xOff = r.range(-24, 24);
    const rad0 = VORTEX_RAD[colIdx] * r.range(0.55, 1.05);
    const omega = 3.85 + r.range(-0.3, 0.3);
    const popV = r.range(0.26, 0.84);
    const thetaAtPop = r.range(0.22, Math.PI - 0.22);
    const theta0 = thetaAtPop - omega * riseDur;
    const nBranches = r.chance(0.38) ? 3 : 2;
    const branches = [];
    for (let b = 0; b < nBranches; b++) {
      const spread = nBranches === 2
        ? (b === 0 ? -1 : 1) * r.range(0.46, 0.74)
        : (b - 1) * r.range(0.50, 0.68) + r.range(-0.05, 0.05);
      const sp = r.range(84, 134);
      const kinkT = r.range(0.11, 0.21);
      const kinkAng = (r.chance(0.5) ? 1 : -1) * r.range(0.24, 0.46);
      const bLife = forkDur * r.range(0.84, 1.0);
      branches.push({ spread, sp, kinkT, kinkAng, bLife });
    }
    popForks.push({
      colIdx, born, riseDur, forkDur, life: riseDur + forkDur,
      xOff, rad0, omega, theta0, popV, branches,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Pre-bake 52 Translucent Rising Heat-Wave Mirage Filaments (`全屏轻微上升热浪空气扭曲`)
  // ---------------------------------------------------------------------------
  const heatWisps = [];
  for (let i = 0; i < 52; i++) {
    const r = rng(S + 909, i);
    heatWisps.push({
      born: r.next() * D,
      life: r.range(1.45, 2.35),
      x0: r.range(-154, 154),
      y0: r.range(-16, 10),
      vy: r.range(76, 122),
      len: r.range(18, 30),
      amp: r.range(2.2, 4.4),
      ph: r.range(0, TAU),
    });
  }

  c = { turbF, fineF, sparks, ashes, popForks, heatWisps };
  CACHE.set(S, c);
  return c;
}

function spiralPos(p, age, tBirth) {
  const u = age / p.life;
  const v = u * (0.76 + p.accel * u);
  const y = 16 - v * 204; // climbs rapidly from y = +16 (below bottom) past y = -188 (piercing out top!)
  const spine = vortexSpineX(p.colIdx, y, tBirth + age) + p.xOff;
  const R = p.rad0 + p.radGrow * Math.min(1.2, v);
  const th = p.theta0 + p.omega * age;
  const x = spine + Math.cos(th) * R;
  const yTilt = y + Math.sin(th) * R * 0.14;
  const z = Math.sin(th);
  return [x, yTilt, z, v];
}

// Translucent-capable Bresenham line so comet wakes blend smoothly over ANY environment backdrop
function blendLine(q, x0, y0, x1, y1, col, alpha) {
  let ix0 = Math.round(x0), iy0 = Math.round(y0);
  const ix1 = Math.round(x1), iy1 = Math.round(y1);
  const dx = Math.abs(ix1 - ix0), sx = ix0 < ix1 ? 1 : -1;
  const dy = -Math.abs(iy1 - iy0), sy = iy0 < iy1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 24; n++) {
    if (alpha >= 0.98) q.px(ix0, iy0, col);
    else q.blend(ix0, iy0, col, alpha);
    if (ix0 === ix1 && iy0 === iy1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; ix0 += sx; }
    if (e2 <= dx) { err += dx; iy0 += sy; }
  }
}

function sparkLight(q, x, y, col, k) {
  const ix = Math.round(x), iy = Math.round(y);
  q.light(ix, iy, col, k);
  const k2 = k * 0.52;
  if (k2 > 0.02) {
    q.light(ix - 1, iy, col, k2);
    q.light(ix + 1, iy, col, k2);
    q.light(ix, iy - 1, col, k2);
    q.light(ix, iy + 1, col, k2);
  }
}

const HEAT_LUT    = new Uint32Array(64);
const COL_SURGE   = new Float32Array(W);
const ROW_HEAT    = new Float32Array(W + 1);
const ROW_SHIMMER = new Float32Array(W + 1);
const REFRACT_ROW = new Uint32Array(W);
const REFRACT_L   = new Uint32Array(W);

export function drawBack(p, t, o) {
  const q = clip(p, meta), S = o.seed;
  const C = fit(o.palette, 9), A = fit(o.ash, 4);
  const bf = getBattlefield(S);
  const { turbF, fineF, sparks, heatWisps } = bf;

  // Build 64-entry Searing Orange-Red Bottom Glow color LUT (`从屏幕最底部持续泛起橙红色的灼热红光`)
  const hotOrangeRed = mix(C[4], C[5], 0.55);
  for (let hi = 0; hi < 64; hi++) {
    const h = hi / 63;
    HEAT_LUT[hi] =
      h > 0.86 ? hotOrangeRed :
      h > 0.64 ? mix(C[3], C[4], (h - 0.64) / 0.22) :
      h > 0.36 ? mix(C[2], C[3], (h - 0.36) / 0.28) :
      mix(C[1], C[2], h / 0.36);
  }

  // Exact whole-tile scrolls over `D = 8s` (zero loop seam!)
  const upScroll1 = (128 * 1 * t) / D;
  const upScroll2 = (128 * 2 * t) / D;
  const upScroll3 = (128 * 3 * t) / D;
  const xScroll1  = (256 * 1 * t) / D;

  const globalBreath = 0.86 + 0.14 * Math.sin(cyc(t, 2)) + 0.08 * Math.sin(cyc(t, 5, 1.1));
  for (let xi = 0; xi < W; xi++) {
    const x = X0 + xi + 0.5;
    const nCol = fastSample(turbF, xi * 0.55 + xScroll1, upScroll1);
    let vBoost = 0;
    for (let k = 0; k < 3; k++) {
      const dx = (x - vortexSpineX(k, Y1, t)) / 48;
      if (Math.abs(dx) < 1) vBoost += (1 - dx * dx) * 0.30;
    }
    COL_SURGE[xi] = (0.68 + 0.46 * nCol + vBoost) * globalBreath;
  }

  const spinPhase = cyc(t, 3);
  const shimmerWavePh = cyc(t, 6);
  const lightC2 = C[2], lightC3 = C[3], lightC4 = C[4], shimmerTint = mix(C[3], C[5], 0.45);

  // ===========================================================================
  // 1. TRANSLUCENT + ADDITIVE ENVIRONMENT OVERLAY (`rows()`):
  //    - Upper & mid sky stay TRANSPARENT so any game backdrop shows cleanly!
  //    - Bottom 65px surges with continuous translucent + additive SEARING
  //      ORANGE-RED firelight (`R.b = 1` soft alpha + `R.l`/`R.k` additive glow).
  //    - Subtle translucent helical heat-ribbons & full-screen convective
  //      air-shimmer ripples (`ROW_SHIMMER`) weave across all 180 rows!
  // ===========================================================================
  rows(p, meta, Y0, Y1, (y, R) => {
    const vBot = clamp((y - Y0) / (Y1 - Y0), 0, 1); // 0 at top (-170) .. 1 at very bottom (+9)
    const vUp  = 1 - vBot;
    const baseFurnace = vBot * vBot * vBot * vBot;          // concentrated in bottom ~55px, fades smoothly to 0!
    const tonguePow   = baseFurnace * baseFurnace;          // roaring bottom 28px orange-red tongues
    const lowerWarmth = smooth(0.46, 1.0, vBot);            // zero above y = -73 so upper sky is 100% unobstructed!

    const sp0 = vortexSpineX(0, y, t), vr0 = VORTEX_RAD[0] * (0.85 + 0.35 * vUp), invVr0 = 1 / vr0;
    const sp1 = vortexSpineX(1, y, t), vr1 = VORTEX_RAD[1] * (0.85 + 0.35 * vUp), invVr1 = 1 / vr1;
    const sp2 = vortexSpineX(2, y, t), vr2 = VORTEX_RAD[2] * (0.85 + 0.35 * vUp), invVr2 = 1 / vr2;
    const twistY = vUp * 8.4 - spinPhase;

    for (let xi = 0; xi <= W; xi += 2) {
      const cxi = xi < W ? xi : W - 1;
      const x = X0 + cxi + 0.5;
      const n1 = fastSample(turbF, cxi * 0.55 + xScroll1, y * 0.80 + upScroll2);
      const n2 = fastSample(fineF, cxi * 1.10 - xScroll1 + 37, y * 1.25 + upScroll3);
      const plume = n1 * 0.64 + n2 * 0.36;

      // Subtle 3D helical updraft ribbons (faint warm air-streams guiding the eye along the spirals)
      let ribbonHeat = 0;
      const d0 = (x - sp0) * invVr0;
      if (d0 > -1 && d0 < 1) {
        const th = ASIN_LUT[((d0 + 1) * 100) | 0];
        const fBand = fastSin((th + twistY + (n1 - 0.5) * 1.3) * 2);
        if (fBand > 0.42) ribbonHeat += (fBand - 0.42) * 0.24 * (1 - d0 * d0);
      }
      const d1 = (x - sp1) * invVr1;
      if (d1 > -1 && d1 < 1) {
        const th = ASIN_LUT[((d1 + 1) * 100) | 0];
        const fBand = fastSin((th + twistY + 1.05 + (n1 - 0.5) * 1.3) * 2);
        if (fBand > 0.40) ribbonHeat += (fBand - 0.40) * 0.28 * (1 - d1 * d1);
      }
      const d2 = (x - sp2) * invVr2;
      if (d2 > -1 && d2 < 1) {
        const th = ASIN_LUT[((d2 + 1) * 100) | 0];
        const fBand = fastSin((th + twistY + 2.1 + (n1 - 0.5) * 1.3) * 2);
        if (fBand > 0.42) ribbonHeat += (fBand - 0.42) * 0.24 * (1 - d2 * d2);
      }

      const surge = COL_SURGE[cxi];
      const tongue = tonguePow * (0.48 + 0.92 * plume) * surge;
      ROW_HEAT[xi] = clamp(
        baseFurnace * (0.46 + 0.68 * plume) * surge +
        tongue * 0.58 +
        lowerWarmth * 0.14 * plume +
        ribbonHeat * (0.18 + 0.62 * vBot),
        0,
        1
      );

      // Full-screen subtle convective heat-wave air shimmer (`全屏伴随轻微上升热浪空气扭曲`):
      // Localized turbulent S-ripples (broken up by `n1`/`n2` so they NEVER form straight ruler lines!)
      const ripple = fastSin(y * 0.22 + (n1 - 0.5) * 5.2 + shimmerWavePh) * fastSin(x * 0.045 + (n2 - 0.5) * 4.0 - spinPhase);
      ROW_SHIMMER[xi] = ripple > 0.58 && plume > 0.46 ? (ripple - 0.58) * (plume - 0.46) * (1.8 + 1.6 * vBot) : 0;
    }

    for (let xi = 0; xi < W; xi++) {
      const even = xi & ~1;
      const heat = (xi & 1) ? 0.5 * (ROW_HEAT[even] + ROW_HEAT[even + 2]) : ROW_HEAT[even];
      const shim = (xi & 1) ? 0.5 * (ROW_SHIMMER[even] + ROW_SHIMMER[even + 2]) : ROW_SHIMMER[even];

      if (heat <= 0.025 && shim <= 0.01) continue; // 100% transparent pixel — underlying environment untouched!

      if (heat > 0.025) {
        // Soft translucent orange-red heat veil (<= 0.36 alpha so underlying floor/ruins/scene show right through!)
        // paired with rich additive orange-red firelight (`R.l`/`R.k`) welling continuously from the bottom edge!
        const veilAlpha = clamp((heat - 0.07) * (0.18 + 0.22 * vBot), 0, 0.36);
        if (veilAlpha > 0.01) {
          R.c[xi] = HEAT_LUT[(heat * 63) | 0];
          R.a[xi] = veilAlpha;
          R.b[xi] = 1;
        }
        R.l[xi] = heat > 0.72 ? lightC4 : heat > 0.36 ? lightC3 : lightC2;
        R.k[xi] = clamp(heat * (0.44 + 0.32 * vBot) + shim * 0.12, 0, 0.70);
      } else {
        // Upper-screen translucent convective heat-shimmer ripple over the environment!
        R.c[xi] = shimmerTint;
        R.a[xi] = clamp(shim * 0.22, 0, 0.11);
        R.b[xi] = 1;
        R.l[xi] = lightC3;
        R.k[xi] = clamp(shim * 0.14, 0, 0.07);
      }
    }
  });

  // Back-half of the 3D helical spark streams (`tier === 0 || z < -0.22`): warm glowing background embers!
  drawSparkPass(q, t, sparks, true, C);

  // ===========================================================================
  // 2. RISING HEAT-WAVE AIR REFRACTION (`±1..2px` horizontal convective ripple
  //    across both the translucent heat veil and distant embers, overlay-safe!)
  // ===========================================================================
  if (p.sn === 0) {
    const B = box(meta);
    const sx0 = Math.round(Math.min(p.toX(B.x0, 0), p.toX(B.x1, 0))) - p.ox;
    const sy0 = Math.round(p.toY(0, B.y0)) - p.oy;
    if (sx0 >= 0 && sy0 >= 0 && sx0 + W <= p.w && sy0 + H <= p.h) {
      const iFast = Math.round((256 * 8 * t) / D);
      const iSlow = Math.round((256 * 3 * t) / D);
      for (let ry = 0; ry < H; ry++) {
        const vBot = ry / (H - 1);
        const rowOff = (sy0 + ry) * p.w + sx0;
        for (let rx = 0; rx < W; rx++) {
          REFRACT_ROW[rx] = p.C[rowOff + rx];
          REFRACT_L[rx]   = p.L[rowOff + rx];
        }
        const nRow = fastSample(turbF, (ry * 3) & 255, (Y0 + ry) * 0.7 + upScroll2);
        const rowGain = (0.45 + 0.95 * vBot) * (0.55 + 0.75 * nRow);
        const ryFast = ry * 14 + iFast;
        const rySlow = ry * 5 + iSlow;
        for (let rx = 2; rx < W - 2; rx++) {
          const wv = SIN_LUT[(ryFast + rx * 3) & 255] * SIN_LUT[(rySlow - rx * 2 + 64) & 255] * rowGain;
          const shift = wv > 0.80 ? 2 : wv > 0.38 ? 1 : wv < -0.80 ? -2 : wv < -0.38 ? -1 : 0;
          if (shift !== 0) {
            p.C[rowOff + rx] = REFRACT_ROW[rx + shift];
            p.L[rowOff + rx] = REFRACT_L[rx + shift];
          }
        }
      }
    }
  }

  // Ascending S-weaving translucent heat-mirage wisps across all 180 rows (`全屏轻微上升热浪空气扭曲`)
  for (let i = 0; i < heatWisps.length; i++) {
    const hw = heatWisps[i];
    for (let age = wrap(t - hw.born, D); age < hw.life; age += D) {
      const u = age / hw.life;
      const env = Math.sin(u * Math.PI);
      if (env < 0.12) continue;
      const baseY = hw.y0 - hw.vy * age;
      if (baseY < Y0 - 10 || baseY > Y1 + 18) continue;
      const steps = Math.round(hw.len * 0.6);
      const wCol = baseY > -45 ? C[5] : baseY > -110 ? C[4] : mix(C[3], A[3], 0.4);
      for (let s = 0; s < steps; s++) {
        const su = s / steps;
        const py = baseY - s * 1.6;
        if (py < Y0 || py > Y1) continue;
        const px = hw.x0 + fastSin(su * TAU + hw.ph - cyc(t, 6)) * hw.amp;
        const aW = env * SIN_LUT[(su * 128) | 0] * (py > -48 ? 0.20 : 0.11);
        q.blend(px, py, wCol, aW);
        if (py > -75) q.light(px, py, C[4], aW * 0.35);
      }
    }
  }
}

export function draw(p, t, o) {
  const q = clip(p, meta), S = o.seed;
  const C = fit(o.palette, 9), A = fit(o.ash, 4);
  const bf = getBattlefield(S);
  const { sparks, ashes, popForks } = bf;

  // 1. SPARSE, SCULPTED SMOLDERING CHARRED-ASH FLAKES (`焦黑灰烬`, soft-blended, ZERO black noise specks!)
  drawSmolderingAsh(q, t, ashes, C, A);

  // 2. FRONT-SWEEPING 3D HELICAL BRIGHT-ORANGE SPARK PARTICLES (`无数亮橘色火星粒子`)!
  drawSparkPass(q, t, sparks, false, C);

  // 3. SUDDEN POP-FLASH & BIFURCATING / FORKING SPARKS (`火星突然爆闪分叉`)!
  drawPopForkSparks(q, t, popForks, C);
}

function drawSparkPass(q, t, sparks, backPass, C) {
  for (let i = 0; i < sparks.length; i++) {
    const sp = sparks[i];
    for (let age = wrap(t - sp.born, D); age < sp.life; age += D) {
      const tBirth = t - age;
      const [x, y, z, v] = spiralPos(sp, age, tBirth);
      if (y < Y0 - 12 || y > Y1 + 10) continue;

      const isBack = sp.tier === 0 || z < -0.22;
      if (isBack !== backPass) continue;

      const flick = 0.82 + 0.18 * fastSin(age * 36 + sp.flickerPh);
      if (backPass) {
        // Distant/behind-spiral glowing orange-red embers (translucent wake -> zero harsh dark pixels!)
        const [px0, py0] = spiralPos(sp, Math.max(0, age - 0.024), tBirth);
        q.blend(px0, py0, C[4], 0.55);
        q.blend(x, y, flick > 0.82 ? C[6] : C[5], 0.85);
        q.light(x, y, C[4], 0.28 * flick);
        continue;
      }

      // FRONT-SWEEPING BRIGHT-ORANGE EMBER PARTICLES (`亮橘色火星粒子`)!
      const zBoost = 0.78 + 0.22 * z;
      const heat = clamp((1.14 - v * 0.16) * zBoost * flick, 0.44, 1);
      const dt1 = sp.tier === 2 ? 0.020 : 0.016;
      const [tx1, ty1] = spiralPos(sp, Math.max(0, age - dt1), tBirth);
      const [tx2, ty2] = spiralPos(sp, Math.max(0, age - dt1 * 2.1), tBirth);
      const [tx3, ty3] = spiralPos(sp, Math.max(0, age - dt1 * 3.4), tBirth);

      // Smoothly alpha-tapered orange-red comet wake so tails blend naturally over ANY backdrop!
      q.blend(tx3, ty3, C[4], 0.48);
      blendLine(q, tx2, ty2, tx1, ty1, C[5], 0.76);
      blendLine(q, tx1, ty1, x, y, C[6], 0.94);

      const ix = Math.round(x), iy = Math.round(y);
      const headCol = heat > 0.84 ? C[8] : heat > 0.56 ? C[7] : C[6];
      if (sp.tier === 2) {
        q.blend(ix - 1, iy, C[5], 0.88);
        q.blend(ix + 1, iy, C[5], 0.88);
        q.blend(ix, iy - 1, C[6], 0.90);
        q.blend(ix, iy + 1, C[6], 0.92);
        q.px(ix, iy, headCol);
        q.glow(x, y, 6.4, C[5], 0.44 * heat);
      } else if (sp.size > 1.4) {
        q.blend(ix + 1, iy, C[5], 0.85);
        q.blend(ix, iy + 1, C[6], 0.90);
        q.px(ix, iy, headCol);
        sparkLight(q, ix, iy, C[5], 0.48 * heat);
      } else {
        q.px(ix, iy, headCol);
        sparkLight(q, ix, iy, C[5], 0.38 * heat);
      }
    }
  }
}

// Sparse, sculpted smoldering charred-ash flakes (`焦黑灰烬`):
// Rendered with warm translucent charcoal (`alpha = 0.56..0.72`) + glowing orange-red coal edge so they read
// as authentic charred battlefield cinders over both dark AND light scenes without creating black speck noise!
function drawSmolderingAsh(q, t, ashes, C, A) {
  for (let i = 0; i < ashes.length; i++) {
    const a = ashes[i];
    for (let age = wrap(t - a.born, D); age < a.life; age += D) {
      const tBirth = t - age;
      const [x, y, , v] = spiralPos(a, age, tBirth);
      if (y < Y0 - 5 || y > Y1 + 5) continue;

      const cx = Math.round(x), cy = Math.round(y);
      const pts = ASH_FLAKES[Math.floor(age * a.tumbleRate + a.tumblePh) & 3];
      const emberGlow = clamp((1.12 - v * 0.28) * (0.60 + 0.40 * fastSin(age * 13 + a.tumblePh)), 0.25, 1);

      for (let k = 0; k < pts.length; k++) {
        const [dx, dy, role] = pts[k];
        if (role === 2) {
          // Glowing smoldering orange-red coal rim along the bottom/side of each charred flake!
          q.blend(cx + dx, cy + dy, emberGlow > 0.68 ? C[5] : C[4], 0.88);
          if (k === pts.length - 1) q.light(cx + dx, cy + dy, C[4], 0.28 * emberGlow);
        } else {
          q.blend(cx + dx, cy + dy, role === 1 ? A[2] : A[1], role === 1 ? 0.40 : 0.54);
        }
      }
    }
  }
}

function drawPopForkSparks(q, t, popForks, C) {
  for (let i = 0; i < popForks.length; i++) {
    const pf = popForks[i];
    for (let age = wrap(t - pf.born, D); age < pf.life; age += D) {
      const tBirth = t - age;

      const posAt = (aa) => {
        const u = aa / pf.riseDur;
        const v = u * pf.popV;
        const y = 14 - v * 178;
        const spine = vortexSpineX(pf.colIdx, y, tBirth + aa) + pf.xOff;
        const th = pf.theta0 + pf.omega * aa;
        const R = pf.rad0 * (0.85 + 0.30 * v);
        return [spine + Math.cos(th) * R, y + Math.sin(th) * R * 0.14];
      };

      if (age < pf.riseDur) {
        const [x, y] = posAt(age);
        if (y < Y0 - 4 || y > Y1 + 4) continue;
        const [px0, py0] = posAt(Math.max(0, age - 0.026));
        const preHeat = smooth(pf.riseDur - 0.18, pf.riseDur, age);
        blendLine(q, px0, py0, x, y, preHeat > 0.5 ? C[7] : C[6], 0.92);
        q.blend(x - 1, y, C[5], 0.88);
        q.blend(x + 1, y, C[5], 0.88);
        q.blend(x, y - 1, C[6], 0.90);
        q.blend(x, y + 1, C[6], 0.92);
        q.px(x, y, preHeat > 0.32 ? WHITE : C[7]);
        sparkLight(q, x, y, C[6], 0.50 + 0.42 * preHeat);
        continue;
      }

      const dtPop = age - pf.riseDur;
      const [ox, oy] = posAt(pf.riseDur);
      const [oxPrev, oyPrev] = posAt(pf.riseDur - 0.025);
      const baseAng = Math.atan2(oy - oyPrev, ox - oxPrev);

      if (dtPop < 0.14) {
        const fk = 1 - dtPop / 0.14;
        const arm = Math.max(2, Math.round(2 + 5.5 * fk));
        sparkle(q, ox, oy, arm, WHITE, C[6], 0.72 * fk);
        q.glow(ox, oy, 9.5 * fk + 2.5, C[5], 0.58 * fk);
        if (dtPop > 0.015 && dtPop < 0.10) {
          const rr = 2.2 + (dtPop / 0.10) * 5.0;
          for (let k = 0; k < 6; k++) {
            const ra = (k / 6) * TAU + i;
            q.blend(ox + Math.cos(ra) * rr, oy + Math.sin(ra) * rr, fk > 0.5 ? C[7] : C[5], 0.90 * fk);
          }
        }
      }

      for (let b = 0; b < pf.branches.length; b++) {
        const br = pf.branches[b];
        if (dtPop >= br.bLife) continue;
        const kLife = 1 - dtPop / br.bLife;

        const forkPos = (tau) => {
          const ang1 = baseAng + br.spread;
          const dragS1 = (1 - Math.exp(-2.6 * Math.min(tau, br.kinkT))) / 2.6;
          let bx = ox + Math.cos(ang1) * br.sp * dragS1;
          let by = oy + Math.sin(ang1) * br.sp * dragS1 - 15 * tau * tau;
          if (tau > br.kinkT) {
            const tau2 = tau - br.kinkT;
            const vRem = br.sp * Math.exp(-2.6 * br.kinkT);
            const ang2 = ang1 + br.kinkAng;
            const dragS2 = (1 - Math.exp(-3.0 * tau2)) / 3.0;
            bx += Math.cos(ang2) * vRem * dragS2;
            by += Math.sin(ang2) * vRem * dragS2 - 34 * tau2;
          }
          return [bx, by];
        };

        const [bx, by] = forkPos(dtPop);
        if (by < Y0 - 6 || by > Y1 + 6) continue;

        if (dtPop < 0.21) {
          const [mx, my] = forkPos(dtPop * 0.48);
          blendLine(q, ox, oy, mx, my, dtPop < 0.10 ? C[6] : C[4], 0.72 * kLife);
          blendLine(q, mx, my, bx, by, dtPop < 0.12 ? C[7] : C[6], 0.92 * kLife);
        } else {
          const [tx1, ty1] = forkPos(dtPop - 0.028);
          const [tx2, ty2] = forkPos(dtPop - 0.056);
          blendLine(q, tx2, ty2, tx1, ty1, C[4], 0.62 * kLife);
          blendLine(q, tx1, ty1, bx, by, C[6], 0.88 * kLife);
        }

        const ix = Math.round(bx), iy = Math.round(by);
        const headC = kLife > 0.55 ? WHITE : kLife > 0.25 ? C[7] : C[6];
        if (kLife > 0.40) {
          q.blend(ix - 1, iy, C[5], 0.85 * kLife);
          q.blend(ix + 1, iy, C[5], 0.85 * kLife);
          q.blend(ix, iy + 1, C[6], 0.88 * kLife);
        }
        q.px(ix, iy, headC);
        sparkLight(q, ix, iy, C[5], 0.56 * kLife);
      }
    }
  }
}
