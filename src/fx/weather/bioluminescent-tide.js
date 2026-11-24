// Bioluminescent Tide (荧光潮汐 — weather/bioluminescent-tide):
// 1. Shimmering Nocturnal Ocean (海面持续波光粼粼): Across a deep abyssal midnight sea beneath a starry sky, crescent
//    moon, and coastal headland, crisp 1px horizontal moonlight wavelets and breathing bioluminescent sea-glints dance
//    continuously across the water surface.
// 2. Dark Swell -> Piercing Neon-Blue Peeling Barrel (幽暗海浪向岸边推进并在翻滚时亮起刺眼的霓虹蓝光): A heavy, shadowy
//    ocean swell rolls shoreward; as it shoals across the curved cove, it steepens and unzips from left to right into
//    an overturning hollow barrel whose tumbling foam avalanche blazes with piercing electric sapphire, cyan, and
//    white-hot dinoflagellate light ("Blue Tears / 蓝眼泪").
// 3. Shore Crash & Skyward Glowing Droplet Spray (海浪拍岸碎成漫天发光水珠 + 水沫星子闪烁): The curling wave slams into
//    coastal reef boulders and sandbars, shattering into churning surf billows, misty plumes, twinkling sea-foam
//    starlets, and 280 ballistic glowing water pearls arcing skyward.
// 4. Slow Retreat & Dimming Blue Sand-Veins (缓缓退去、在沙滩上留下逐渐变暗的蓝色流光纹路): Connected lacy neon swash
//    surges up the mirror-wet black beach, pauses at the high-water mark, and slowly recedes — unveiling branching
//    dendritic blue rivulets and cellular plankton filigree that gradually dim while the next dark swell rises at sea.
// Droplet beads and curling surf mechanics draw on `src/fx/water/_lib.js` & `src/fx/water/wave-crash.js`
// (adapted from Sprite Fusion's open-source pixel-art VFX, MIT License, Copyright (c) 2026 Hugo Duprez).
import { fit, clamp, smooth, ease, mix, rand, noise, noise2, TAU, WHITE, sparkle } from "../../core/index.js";
import { bead } from "../water/_lib.js";
import { clip, rows, field } from "./_lib.js";

export const meta = {
  name: "Bioluminescent tide",
  desc: "Dark ocean swells roll in and ignite into piercing neon-blue curls, crashing into glowing spray before receding to leave dimming blue rivulet veins across wet night sand.",
  tags: ["weather", "water", "ocean", "tide", "wave", "bioluminescent", "beach", "sea", "night", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 118],
  duration: 12,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    // 8-step Piercing Electric Neon-Blue ("Blue Tears / 蓝眼泪") bioluminescence ramp:
    // Abyssal ultramarine -> royal cobalt -> electric sapphire -> blazing cyan -> ice-blue -> blinding white core
    palette: ["#04102e", "#082870", "#0d52c4", "#148aff", "#2ed0ff", "#84f3ff", "#dcfeff", "#ffffff"],
    // 6-step Abyssal Midnight Sky, Deep Sea & Wet Black-Sand Beach ambient ramp
    night:   ["#02040b", "#040a18", "#08132a", "#0f2142", "#1c3863", "#5882b8"],
    seed: 11,
  },
};

const D = 12, W = 320, H = 180, X0 = -160, Y0 = -118;
const HORIZON_Y = -68; // Sky: [-118..-69], Deep Sea & Surf: [-68..+8], Wet Beach: [-4..+61]
const cyc = (t, n, ph = 0) => (TAU * n * t) / D + ph;

// Fast bilinear lookup into a 256x128 periodic `field()` Float32Array
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

// Graceful sweeping cove shoreline
function shoreBaseY(x, S) {
  const u = x / 160;
  return -2.0 + 7.5 * (u * u) - 2.4 * u + 1.4 * Math.sin(x * 0.022 + S * 0.5);
}

// Scalloped high-tide swash reach across the foreground black-sand beach (y ≈ +44..+56)
function maxSwashY(x, S) {
  return shoreBaseY(x, S) + 45 + 4.8 * Math.sin(x * 0.038 + S * 1.1) + 2.2 * Math.cos(x * 0.082 - S * 0.6);
}

// Progressive peeling curl delay across the bay (1.22s sweep):
// Left reef steepens, curls & crashes first (~2.55s), unzipping a true peeling barrel across the cove (~3.77s)!
function peelDelay(x) {
  const u = (x + 160) / 320;
  return 1.22 * u + 0.08 * Math.sin(u * Math.PI);
}

// Wave lifecycle constants (seconds in local wave age `a`):
const T_CRASH = 2.55; // Local crash age (left crashes at t≈2.55s, center at t≈3.20s, right at t≈3.77s)
const T_PEAK  = 4.65; // Luminous lacy swash surges up the beach to high-water mark
const T_GONE  = 8.75; // Swash pauses & slowly recedes over 4.1s, unveiling dimming blue rivulet veins

const CACHE = new Map();
function getCoast(S) {
  let c = CACHE.get(S);
  if (c) return c;

  const ripF  = field(S * 7 + 3, 256, 128, [16, 32, 64]);
  const foamF = field(S * 11 + 5, 256, 128, [8, 16, 32]);

  const shoreY   = new Float32Array(W);
  const reachY   = new Float32Array(W);
  const peel     = new Float32Array(W);
  const peakAmp  = new Float32Array(W);
  const cliffTop = new Int16Array(W).fill(999);

  for (let xi = 0; xi < W; xi++) {
    const x = X0 + xi + 0.5;
    shoreY[xi] = shoreBaseY(x, S);
    reachY[xi] = maxSwashY(x, S);
    peel[xi]   = peelDelay(x);
    const u = x / 160;
    peakAmp[xi] = 1.06 - 0.22 * (u * u) + 0.08 * Math.sin(x * 0.026 + 0.6);

    if (x < -96) {
      const cu = (-96 - x) / 64;
      const hMain = 15 * Math.pow(cu, 0.75) + 3.2 * Math.sin(x * 0.14 + S) + 1.5 * Math.cos(x * 0.31);
      cliffTop[xi] = Math.round(HORIZON_Y - Math.max(0, hMain));
    } else if (x > -90 && x < -77) {
      const d = 1 - Math.abs(x + 83.5) / 6.5;
      if (d > 0) cliffTop[xi] = Math.round(HORIZON_Y - 7.0 * Math.pow(d, 0.6));
    }
  }

  // Sculpted 3D coastal reef boulder cluster on the left surf line (x = -154..-103, y = -12..+11)
  const RW = 52, RH = 24, RX0 = -154, RY0 = -12;
  const reefMask = new Int8Array(RW * RH).fill(-1);
  const reefLit  = new Float32Array(RW * RH);
  const boulders = [[-142, 3, 13, 9.5], [-128, 4, 11, 8.0], [-116, 6, 7.5, 5.2], [-135, 6, 9, 5.5]];
  for (let j = 0; j < RH; j++) {
    for (let i = 0; i < RW; i++) {
      const x = RX0 + i + 0.5, y = RY0 + j + 0.5;
      let best = -1, bestZ = -1e9, lit = 0;
      for (let k = 0; k < boulders.length; k++) {
        const [bx, by, rx, ry] = boulders[k];
        if (y > by + 2.5) continue;
        const nx = (x - bx) / rx, ny = (y - by) / ry, r2 = nx * nx + ny * ny;
        if (r2 >= 1) continue;
        const nz = Math.sqrt(1 - r2), z = nz * ry - k * 0.4;
        if (z > bestZ) {
          bestZ = z;
          best = k;
          lit = nx * 0.38 - ny * 0.72 + nz * 0.58 + 0.16 * noise2(x * 0.4, y * 0.4, S + 70);
        }
      }
      reefMask[j * RW + i] = best;
      reefLit[j * RW + i]  = lit;
    }
  }

  // Pre-bake Beach Maps over rows y = -12..61 (74 rows x 320 cols)
  const BY0 = -12, BH = H - (BY0 - Y0);
  const rivulet  = new Float32Array(W * BH);
  const laceMap  = new Float32Array(W * BH);
  const uncoverT = new Float32Array(W * BH);
  const vBeachM  = new Float32Array(W * BH);
  const grainIdx = new Uint8Array(W * BH);

  for (let by = 0; by < BH; by++) {
    const y = BY0 + by + 0.5;
    for (let xi = 0; xi < W; xi++) {
      const x = X0 + xi + 0.5;
      const sy = shoreY[xi], ry = reachY[xi];
      const v = clamp((y - sy) / Math.max(1, ry - sy), 0, 1.25);

      const warpX = x * (0.94 - 0.16 * v) + 9.0 * noise2(x * 0.045, y * 0.058, S + 21) + 3.0 * noise2(x * 0.12, y * 0.14, S + 22);
      const warpY = y * 0.62 + 4.5 * noise2(x * 0.06, y * 0.052, S + 23);

      const n1 = Math.abs(noise2(warpX * 0.080, warpY * 0.052, S + 31));
      const n2 = Math.abs(noise2(warpX * 0.162 + 11.3, warpY * 0.105 - 4.7, S + 32));
      const ch1 = Math.max(0, 1 - n1 * 13.0);
      const ch2 = Math.max(0, 1 - n2 * 15.0) * 0.72;
      const riv = clamp(Math.max(ch1, ch2) + ch1 * ch2 * 0.7, 0, 1);

      const ln1 = Math.abs(noise2(x * 0.095 + S * 1.7, y * 0.135, S + 41));
      const ln2 = Math.abs(noise2(x * 0.165 - 4.3, y * 0.225 + 6.1, S + 42));
      const lc = clamp(Math.max(1 - ln1 * 9.0, (1 - ln2 * 10.5) * 0.65), 0, 1);

      const vc = clamp(v, 0, 1);
      const uUnc = Math.acos(clamp(2 * vc - 1, -1, 1)) / Math.PI;

      const idx = by * W + xi;
      rivulet[idx]  = riv;
      laceMap[idx]  = lc;
      uncoverT[idx] = T_PEAK + uUnc * (T_GONE - T_PEAK);
      vBeachM[idx]  = v;
      grainIdx[idx] = clamp(Math.round((noise2(x * 0.35, y * 0.55, S + 51) + 1) * 3.5), 0, 7);
    }
  }

  // Pre-bake 84 sky stars (eliminating per-frame rand() calls)
  const stars = [];
  for (let i = 0; i < 84; i++) {
    const sx = X0 + rand(S, i, 1) * W;
    const sy = Y0 + rand(S, i, 2) * (HORIZON_Y - Y0 - 3);
    const xi = clamp(Math.floor(sx - X0), 0, W - 1);
    if (sy >= cliffTop[xi] - 1) continue;
    stars.push({ sx, sy, r: rand(S, i, 3), freq: 1 + (i % 3), ph: rand(S, i, 4) * TAU });
  }

  // Pre-bake 32 open-sea shimmering plankton/moon-wavelet micro-sparks (for rich continuous 海面波光粼粼!)
  const seaSparks = [];
  for (let i = 0; i < 32; i++) {
    const sx = -152 + rand(S + 33, i, 1) * 304;
    const z = 0.08 + rand(S + 33, i, 2) * 0.78;
    const sy = HORIZON_Y + 3 + z * 58;
    const xi = clamp(Math.floor(sx - X0), 0, W - 1);
    seaSparks.push({ sx, sy, xi, w: 1 + (rand(S + 33, i, 3) > 0.55 ? 1 : 0), freq: 3 + (i % 4), ph: rand(S + 33, i, 4) * TAU });
  }

  // Pre-bake 92 twinkling sea-foam starlets & stranded beach plankton sparks (水沫星子闪烁!)
  const foamSparks = [];
  for (let i = 0; i < 92; i++) {
    const sx = -155 + rand(S + 77, i, 1) * 310;
    const xi = clamp(Math.floor(sx - X0), 0, W - 1);
    const sy = shoreY[xi], ry = reachY[xi];
    const vPos = rand(S + 77, i, 2);
    const py = sy + vPos * (ry - sy);
    const uUnc = Math.acos(clamp(2 * vPos - 1, -1, 1)) / Math.PI;
    const tUnc = T_PEAK + uUnc * (T_GONE - T_PEAK);
    foamSparks.push({ sx, py, xi, sy, ry, pd: peel[xi], tUnc, freq: 5 + (i % 4), ph: rand(S + 77, i, 3) * TAU, star: i % 3 === 0 });
  }

  // Pre-bake 280 snappy, high-impact ballistic crash droplets
  const droplets = [];
  for (let i = 0; i < 280; i++) {
    const onReef = i < 70;
    const x0 = onReef
      ? -144 + rand(S, i, 61) * 32
      : -154 + rand(S, i, 61) * 308;
    const xi = clamp(Math.floor(x0 - X0), 0, W - 1);
    const baseCrashT = T_CRASH + peel[xi] + (rand(S, i, 62) - 0.35) * (onReef ? 0.18 : 0.28);
    const hero = rand(S, i, 63);
    const s = hero > 0.87 ? 3 : hero > 0.54 ? 2 : 1;

    const ang = onReef
      ? -Math.PI * (0.28 + rand(S, i, 64) * 0.46)
      : -Math.PI * (0.22 + rand(S, i, 64) * 0.56);
    const speed = (onReef ? 92 : 68) + rand(S, i, 65) * (s === 3 ? 88 : 118);
    const vx = Math.cos(ang) * speed * 0.62 + (onReef ? 14 : 6);
    const vy0 = -Math.sin(ang) * speed * peakAmp[xi];
    const g = 295 + rand(S, i, 66) * 85;
    const yStart = shoreY[xi] - (onReef ? 6 + rand(S, i, 67) * 5 : 2 + rand(S, i, 67) * 6);
    const yLandOff = 3 + rand(S, i, 68) * 14;
    const life = (vy0 + Math.sqrt(vy0 * vy0 + 2 * g * yLandOff)) / g;
    droplets.push({ x0, yStart, vx, vy0, g, s, baseCrashT, life });
  }

  c = {
    ripF, foamF, shoreY, reachY, peel, peakAmp, cliffTop,
    RW, RH, RX0, RY0, reefMask, reefLit,
    BY0, BH, rivulet, laceMap, uncoverT, vBeachM, grainIdx,
    stars, seaSparks, foamSparks, droplets,
  };
  CACHE.set(S, c);
  return c;
}

function swellCrestY(a, sy) {
  if (a < -3.3 || a > T_CRASH + 0.45) return -999;
  const u = clamp((a + 3.3) / (T_CRASH + 3.3), 0, 1);
  return -53 + (sy + 51) * (u * Math.sqrt(u));
}

function swellHeight(a, amp) {
  if (a < -3.3 || a > T_CRASH + 0.45) return 0;
  if (a <= T_CRASH) {
    return (smooth(-3.3, 0.3, a) * 6.5 + smooth(0.15, T_CRASH - 0.08, a) * 19.5) * amp;
  }
  return 26 * amp * (1 - smooth(T_CRASH, T_CRASH + 0.45, a));
}

function curlNeonK(a) {
  if (a < 0.20 || a > T_CRASH + 0.48) return 0;
  if (a <= T_CRASH) {
    const s = smooth(0.20, T_CRASH - 0.06, a);
    return s * Math.sqrt(s);
  }
  return 1 - smooth(T_CRASH, T_CRASH + 0.48, a);
}

function tumbleAvalancheK(a) {
  if (a < T_CRASH - 0.36 || a > T_CRASH + 0.50) return 0;
  return clamp((a - (T_CRASH - 0.36)) / 0.46, 0, 1);
}

function swashEdgeY(a, sy, ry) {
  if (a < T_CRASH || a > T_GONE) return -999;
  if (a <= T_PEAK) {
    const u = (a - T_CRASH) / (T_PEAK - T_CRASH);
    return sy + (ry - sy) * ease.outCubic(u);
  }
  const u = (a - T_PEAK) / (T_GONE - T_PEAK);
  return ry - (ry - sy) * ease.inOutSine(u);
}

// Per-column & LUT scratch arrays (zero GC allocations per frame)
const COL_CY0 = new Float32Array(W), COL_H0 = new Float32Array(W), COL_NK0 = new Float32Array(W), COL_PK0 = new Float32Array(W);
const COL_CY1 = new Float32Array(W), COL_H1 = new Float32Array(W), COL_NK1 = new Float32Array(W);
const COL_SA0 = new Float32Array(W), COL_SY0 = new Float32Array(W);
const COL_SA1 = new Float32Array(W), COL_SY1 = new Float32Array(W);
const COL_JAG = new Float32Array(W);
const DRY_LUT = new Uint32Array(8), WET_LUT = new Uint32Array(8), VEIN_LUT = new Uint32Array(32), SWASH_LUT = new Uint32Array(16);

export function drawBack(p, t, o) {
  const q = clip(p, meta), S = o.seed;
  const C = fit(o.palette, 8), N = fit(o.night, 6);
  const cs = getCoast(S);
  const {
    ripF, foamF, shoreY, reachY, peel, peakAmp, cliffTop,
    RW, RH, RX0, RY0, reefMask, reefLit,
    BY0, rivulet, laceMap, uncoverT, vBeachM, grainIdx, stars,
  } = cs;

  // Pre-build color LUTs once per frame (eliminates ~110,000 per-pixel `mix()` unpack/repack calls on the beach!)
  for (let i = 0; i < 8; i++) {
    const g = (i - 3.5) / 3.5;
    DRY_LUT[i] = mix(N[0], N[1], 0.58 + g * 0.16);
    WET_LUT[i] = mix(N[0], N[1], 0.20 + g * 0.08);
  }
  const baseWet = WET_LUT[3];
  for (let i = 0; i < 32; i++) {
    const tot = i / 31;
    const vCol = tot > 0.70 ? C[6] : tot > 0.45 ? C[4] : tot > 0.24 ? C[3] : tot > 0.13 ? C[2] : C[1];
    VEIN_LUT[i] = mix(baseWet, vCol, clamp(tot * 1.32, 0, 0.96));
  }
  const swashBase = mix(baseWet, C[1], 0.34);
  for (let i = 0; i < 16; i++) {
    const wk = i / 15;
    const wc = wk > 0.62 ? C[6] : wk > 0.32 ? C[4] : C[2];
    SWASH_LUT[i] = mix(swashBase, wc, clamp(wk * 0.88, 0, 0.92));
  }

  const scroll1 = (256 * t) / D;
  const scroll2 = (256 * 2 * t) / D;

  let waveMinY = 999, waveMaxY = -999;
  for (let xi = 0; xi < W; xi++) {
    const sy = shoreY[xi], ry = reachY[xi], pd = peel[xi], amp = peakAmp[xi];
    const aPrev = t + D - pd, aCurr = t - pd, aNext = t - D - pd;

    const jag = (fastSample(foamF, xi * 0.75 + scroll1 * 0.2, 14) - 0.5) * 3.4;
    const swashScallop = 2.6 * Math.sin(xi * 0.085 + 0.9) + 1.4 * Math.cos(xi * 0.19 - 0.4);
    COL_JAG[xi] = jag;

    const cy0 = swellCrestY(aCurr, sy), h0 = swellHeight(aCurr, amp);
    COL_CY0[xi] = cy0;
    COL_H0[xi]  = h0;
    COL_NK0[xi] = curlNeonK(aCurr);
    COL_PK0[xi] = tumbleAvalancheK(aCurr);
    if (h0 > 0.8) {
      if (cy0 - h0 * 1.7 < waveMinY) waveMinY = cy0 - h0 * 1.7;
      if (cy0 + h0 * 0.5 + 7 > waveMaxY) waveMaxY = cy0 + h0 * 0.5 + 7;
    }

    const cy1 = swellCrestY(aNext, sy), h1 = swellHeight(aNext, amp);
    COL_CY1[xi] = cy1;
    COL_H1[xi]  = h1;
    COL_NK1[xi] = curlNeonK(aNext);
    if (h1 > 0.8) {
      if (cy1 - h1 * 1.7 < waveMinY) waveMinY = cy1 - h1 * 1.7;
      if (cy1 + h1 * 0.5 + 7 > waveMaxY) waveMaxY = cy1 + h1 * 0.5 + 7;
    }

    COL_SA0[xi] = aCurr;
    const e0 = swashEdgeY(aCurr, sy, ry);
    COL_SY0[xi] = e0 > -900 ? e0 + swashScallop : -999;

    COL_SA1[xi] = aPrev;
    const e1 = swashEdgeY(aPrev, sy, ry);
    COL_SY1[xi] = e1 > -900 ? e1 + swashScallop : -999;
  }

  const moonX = 34, moonY = -95;
  const skyTop = N[0], skyMid = N[1], skyHorizon = mix(N[2], C[0], 0.30);
  const cliffCol = mix(N[0], N[1], 0.35), cliffRim = mix(N[1], N[3], 0.45);
  const seaGlintBright = mix(N[5], C[5], 0.65);

  rows(p, meta, Y0, Y0 + H - 1, (y, R) => {
    // =========================================================================
    // 1. STARRY MIDNIGHT SKY & COASTAL HEADLAND SILHOUETTE (y < HORIZON_Y)
    // =========================================================================
    if (y < HORIZON_Y) {
      const vSky = clamp((y - Y0) / (HORIZON_Y - Y0), 0, 1);
      const baseSky = vSky < 0.58
        ? mix(skyTop, skyMid, vSky / 0.58)
        : mix(skyMid, skyHorizon, (vSky - 0.58) / 0.42);
      const skyGlowRow = Math.max(0, 1 - (HORIZON_Y - y) * 0.06) * 0.14;

      for (let xi = 0; xi < W; xi++) {
        if (y >= cliffTop[xi]) {
          R.c[xi] = y <= cliffTop[xi] + 1 ? cliffRim : cliffCol;
          continue;
        }
        const x = X0 + xi + 0.5;
        const dxM = (x - moonX) * 0.65, dyM = y - moonY;
        const d2 = dxM * dxM + dyM * dyM;
        let col = baseSky;
        if (d2 < 4200) {
          const mh = 1 - Math.sqrt(d2) * 0.0154;
          col = mix(col, N[3], mh * mh * 0.34);
        }
        const wg = COL_NK0[xi] * skyGlowRow;
        if (wg > 0.015) col = mix(col, C[2], wg);
        R.c[xi] = col;
      }
      return;
    }

    // =========================================================================
    // 2. SHIMMERING ABYSSAL OCEAN, PEELING NEON BARREL & WET SAND VEINS
    // =========================================================================
    const zSea = clamp((y - HORIZON_Y) / 72, 0, 1.35);
    const waveFreqY = (y - HORIZON_Y) * (2.25 - 1.10 * Math.min(1, zSea));
    const waveletPhase = waveFreqY - (TAU * 3 * t) / D;
    const seaBase = mix(N[0], N[2], clamp(zSea * 0.58, 0, 0.82));
    const seaCrest = mix(seaBase, N[2], 0.22);
    const seaTrough = mix(seaBase, N[0], 0.30);
    const by = Math.floor(y) - BY0;
    const rj = Math.floor(y) - RY0;
    const inWaveBand = y >= waveMinY && y <= waveMaxY;
    const moonHalfW = 5.5 + zSea * 22;
    const invMoonW2 = 1 / (moonHalfW * moonHalfW);

    let cachedSeaX = -999, cachedSeaCol = seaBase, cachedSeaLC = 0, cachedSeaLK = 0;

    for (let xi = 0; xi < W; xi++) {
      const x = X0 + xi + 0.5;
      const sy = shoreY[xi];
      const onBeach = y > sy;

      let col = seaBase;
      let lightCol = 0, lightK = 0;

      // -----------------------------------------------------------------------
      // A) CONTINUOUS CRISP 1PX HORIZONTAL OCEAN SHIMMER (海面持续波光粼粼!)
      // -----------------------------------------------------------------------
      if (y <= sy + 3) {
        const dxM = x - moonX;
        const nearMoon = Math.abs(dxM) < moonHalfW * 1.75;
        if (!nearMoon && (xi & 1) === 1 && cachedSeaX === xi - 1) {
          col = cachedSeaCol;
          lightCol = cachedSeaLC;
          lightK = cachedSeaLK;
        } else {
          const nA = fastSample(ripF, xi * 0.72 + scroll1 * 0.45, waveFreqY * 0.85);
          const nB = fastSample(ripF, xi * 1.65 - scroll2 * 0.35 + 47, waveFreqY * 1.35 + 19);
          const ridge = Math.sin(waveletPhase + x * 0.05 + (nA - 0.5) * 4.2);

          if (ridge > 0.62) col = seaCrest;
          else if (ridge < -0.50) col = seaTrough;

          if (ridge > 0.76) {
            const moonPath = nearMoon ? Math.max(0, 1 - dxM * dxM * invMoonW2) : 0;
            const hBreak = nB * 0.65 + nA * 0.35;
            const need = 0.65 - moonPath * 0.23;
            if (hBreak > need) {
              const gk = clamp((hBreak - need) * 5.2 * ((ridge - 0.76) * 4.1), 0, 1);
              if (moonPath > 0.16) {
                col = gk > 0.62 ? WHITE : seaGlintBright;
                lightCol = C[4];
                lightK = gk * (0.14 + 0.20 * moonPath);
              } else if (gk > 0.26) {
                col = gk > 0.70 ? C[6] : C[4];
                lightCol = C[3];
                lightK = gk * 0.18;
              }
            }
          }
          cachedSeaX = xi;
          cachedSeaCol = col;
          cachedSeaLC = lightCol;
          cachedSeaLK = lightK;
        }
      }

      // -----------------------------------------------------------------------
      // B) MIRROR-WET BLACK SAND, CONNECTED LACY SWASH & DIMMING BLUE VEINS
      // -----------------------------------------------------------------------
      if (onBeach && by >= 0 && by < cs.BH) {
        const bIdx = by * W + xi;
        const vBeach = vBeachM[bIdx];
        const gIdx = grainIdx[bIdx];
        const riv  = rivulet[bIdx];
        const lc   = laceMap[bIdx];
        const tUnc = uncoverT[bIdx];

        let bestVeinGlow = 0, bestLaceGlow = 0, bestStrandGlow = 0;
        let underSwash = false, swashLipK = 0, swashWebK = 0, wetness = 0;

        for (let wIdx = 0; wIdx < 2; wIdx++) {
          const aW = wIdx === 0 ? COL_SA0[xi] : COL_SA1[xi];
          if (aW < T_CRASH || aW > T_GONE + 6.6) continue;
          const edgeY = wIdx === 0 ? COL_SY0[xi] : COL_SY1[xi];

          if (edgeY > -900 && y <= edgeY) {
            underSwash = true;
            wetness = 1;
            const dist = edgeY - y;
            const surgeU = clamp((aW - T_CRASH) / (T_GONE - T_CRASH), 0, 1);
            const energy = 1 - 0.50 * surgeU;

            if (dist < 2.8) {
              swashLipK = Math.max(swashLipK, (1 - dist / 2.8) * (0.76 + 0.24 * energy));
            }
            const frontBoost = Math.max(0, 1 - dist * 0.032) * 0.22 * energy;
            const need = 0.56 - frontBoost;
            if (lc > need) {
              swashWebK = Math.max(swashWebK, (lc - need) * 2.1 * energy);
            }
          } else if (vBeach <= 1.04 && aW > T_PEAK) {
            const dtUnc = aW - tUnc;
            if (dtUnc >= 0 && dtUnc < 6.6) {
              const wetLin = 1 - dtUnc * 0.15;
              if (wetLin > wetness) wetness = wetLin;
              const vLin = Math.max(0, 1 - dtUnc * 0.18);
              const veinFade = vLin * Math.sqrt(vLin);
              const trickle = 0.72 + 0.28 * Math.sin(y * 0.32 - aW * 3.8 + x * 0.04);
              const vg = veinFade * trickle;
              if (vg > bestVeinGlow) bestVeinGlow = vg;
              const lLin = Math.max(0, 1 - dtUnc * 0.28);
              const lg = lLin * lLin;
              if (lg > bestLaceGlow) bestLaceGlow = lg;
              if (vBeach > 0.90) {
                const sg = veinFade * smooth(0.90, 0.99, vBeach);
                if (sg > bestStrandGlow) bestStrandGlow = sg;
              }
            }
          }
        }

        col = wetness > 0.45 ? WET_LUT[gIdx] : DRY_LUT[gIdx];

        if (underSwash) {
          col = swashWebK > 0.04 ? SWASH_LUT[clamp((swashWebK * 15) | 0, 0, 15)] : swashBase;
          if (swashWebK > 0.08) {
            lightCol = C[4];
            lightK = Math.max(lightK, swashWebK * 0.24);
          }
          if (swashLipK > 0.05) {
            col = swashLipK > 0.58 ? WHITE : swashLipK > 0.28 ? C[6] : C[4];
            lightCol = C[5];
            lightK = Math.max(lightK, swashLipK * 0.54);
          }
        } else {
          if (bestVeinGlow > 0.015) {
            const tot = Math.max(riv * bestVeinGlow, lc * bestLaceGlow * 0.45, bestStrandGlow * (0.45 + 0.55 * lc));
            if (tot > 0.08) {
              col = VEIN_LUT[clamp((tot * 31) | 0, 0, 31)];
              lightCol = tot > 0.44 ? C[4] : C[3];
              lightK = Math.max(lightK, tot * 0.44);
            }
          }
          // Slick wet-sand mirror reflection of the blazing curling wave
          const nk0 = COL_NK0[xi];
          if (nk0 > 0.12 && y - sy < 30) {
            const reflK = (0.18 + 0.62 * wetness) * (1 - (y - sy) * 0.033);
            const nr = nk0 * reflK;
            if (nr > 0.08) {
              col = mix(col, C[2], nr * 0.56);
              lightCol = C[3];
              lightK = Math.max(lightK, nr * 0.30);
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // C) 3D DARK OCEAN SWELL -> PEELING, TUMBLING NEON-BLUE BARREL!
      // -----------------------------------------------------------------------
      if (inWaveBand) {
        for (let sIdx = 1; sIdx >= 0; sIdx--) {
          const cy = sIdx === 0 ? COL_CY0[xi] : COL_CY1[xi];
          const wh = sIdx === 0 ? COL_H0[xi] : COL_H1[xi];
          if (wh < 0.8 || cy < -900) continue;
          const nk = sIdx === 0 ? COL_NK0[xi] : COL_NK1[xi];
          const pk = sIdx === 0 ? COL_PK0[xi] : 0;
          const jag = COL_JAG[xi] * (0.35 + 0.65 * nk);

          const yBackStart = cy - wh * 1.60;
          const yCrest     = cy - wh * 0.82 + jag * 0.45;
          const yToe       = cy + wh * 0.36;

          if (y > yToe && y < yToe + 6.0) {
            const shK = (1 - (y - yToe) / 6.0) * 0.65;
            col = mix(col, nk > 0.18 ? C[1] : N[0], shK);
            if (nk > 0.18) {
              lightCol = C[4];
              lightK = Math.max(lightK, nk * shK * 0.46);
            }
          } else if (y >= yBackStart && y <= yToe) {
            if (y < yCrest) {
              const uBack = (y - yBackStart) / Math.max(1, yCrest - yBackStart);
              const darkSlope = mix(N[1], N[0], 0.68 * (1 - uBack));
              const subGlow = uBack * uBack * uBack * nk;
              col = mix(col, mix(darkSlope, C[3], subGlow * 0.82), smooth(0, 0.42, uBack));
              if (subGlow > 0.14) {
                lightCol = C[4];
                lightK = Math.max(lightK, subGlow * 0.46);
              }
            } else {
              const uFace = (y - yCrest) / Math.max(1, yToe - yCrest);
              const fTex  = fastSample(foamF, xi * 0.92 - uFace * 6.5 + scroll1 * 0.3, uFace * 15 - t * 9.5);
              const fTex2 = fastSample(ripF,  xi * 1.35 + uFace * 5.0 - scroll2 * 0.2, uFace * 19 + 33);

              const baseLip = 0.14 + 0.16 * nk * fTex;
              const tumbleTongue = pk * (0.42 + 0.58 * (fTex * 0.65 + fTex2 * 0.35));
              const foamReach = Math.max(baseLip, tumbleTongue);

              if (uFace <= foamReach) {
                const depthInFoam = uFace / Math.max(0.06, foamReach);
                const froth = (1 - depthInFoam * 0.62) * (0.68 + 0.42 * fTex2) * nk;
                col = froth > 0.66 ? WHITE : froth > 0.44 ? C[6] : froth > 0.24 ? C[4] : mix(N[2], C[3], nk);
                lightCol = froth > 0.54 ? C[5] : C[4];
                lightK = Math.max(lightK, 0.24 + 0.88 * froth);
              } else {
                const distBelowLip = uFace - foamReach;
                const hollowShadow = distBelowLip < 0.28 ? (1 - distBelowLip / 0.28) : 0;
                const wisp = fTex * 0.58 + fTex2 * 0.42;
                const wispGlow = wisp > 0.57 ? (wisp - 0.57) * 2.5 * nk * (1 - hollowShadow * 0.45) : 0;

                let bodyC = mix(N[0], C[2], (0.18 + 0.52 * (1 - hollowShadow)) * nk);
                if (wispGlow > 0.04) {
                  bodyC = mix(bodyC, wispGlow > 0.56 ? C[5] : C[3], clamp(wispGlow, 0, 0.92));
                }
                col = bodyC;
                lightCol = C[3];
                lightK = Math.max(lightK, nk * (0.16 + 0.40 * wispGlow));
              }
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // D) SCULPTED 3D WET COASTAL REEF BOULDERS (left shore x = -154..-103)
      // -----------------------------------------------------------------------
      const ri = xi - (RX0 - X0);
      if (ri >= 0 && ri < RW && rj >= 0 && rj < RH) {
        const rIdx = rj * RW + ri;
        const bid = reefMask[rIdx];
        if (bid >= 0) {
          const lit = reefLit[rIdx];
          const topEdge = rj === 0 || reefMask[(rj - 1) * RW + ri] < 0;
          const crease  = (ri + 1 < RW && reefMask[rIdx + 1] >= 0 && reefMask[rIdx + 1] < bid);
          let rockCol = crease ? N[0] : lit > 0.58 ? N[3] : lit > 0.22 ? N[2] : N[1];
          if (topEdge && lit > 0.15) rockCol = mix(N[3], N[4], 0.5);
          const surfBounce = COL_NK0[xi] * (topEdge ? 0.82 : lit > 0.25 ? 0.42 : 0.15);
          if (surfBounce > 0.03) col = mix(rockCol, topEdge ? C[5] : C[3], surfBounce);
          else col = rockCol;
          if (surfBounce > 0.18) {
            lightCol = C[4];
            lightK = Math.max(lightK, surfBounce * 0.36);
          }
        }
      }

      R.c[xi] = col;
      if (lightK > 0.005) {
        R.l[xi] = lightCol;
        R.k[xi] = lightK;
      }
    }
  });

  // ===========================================================================
  // 3. STARFIELD & CRESCENT MOON ABOVE THE SEA HORIZON
  // ===========================================================================
  for (let i = 0; i < stars.length; i++) {
    const st = stars[i];
    const tw = 0.45 + 0.55 * Math.sin(cyc(t, st.freq, st.ph));
    if (st.r < 0.68) {
      q.dot(st.sx, st.sy, N[4], 0.35 + 0.48 * tw);
    } else if (st.r < 0.95) {
      q.px(st.sx, st.sy, st.r < 0.84 ? N[5] : WHITE);
      q.glow(st.sx + 0.5, st.sy + 0.5, 2.8, C[4], 0.18 * tw);
    } else {
      sparkle(q, st.sx, st.sy, 1 + (tw > 0.72 ? 1 : 0), WHITE, C[4], 0.24 * tw);
    }
  }

  const mr = 5.6;
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      const d1 = dx * dx + dy * dy, d2 = (dx - 2.4) * (dx - 2.4) + (dy + 1.3) * (dy + 1.3);
      if (d1 <= mr * mr && d2 > (mr - 1.0) * (mr - 1.0)) {
        q.blend(moonX + dx, moonY + dy, d1 > (mr - 1.3) * (mr - 1.3) ? WHITE : C[6], 0.92);
      }
    }
  }
  q.glow(moonX - 1, moonY, 17, C[4], 0.22);
}

export function draw(p, t, o) {
  const q = clip(p, meta), S = o.seed;
  const C = fit(o.palette, 8);
  const cs = getCoast(S);
  const { shoreY, peel, peakAmp, seaSparks, foamSparks, droplets } = cs;

  // ===========================================================================
  // 1. BREATHING OPEN-SEA BIOLUMINESCENT SHIMMER GLINTS (海面持续波光粼粼!)
  // ===========================================================================
  for (let i = 0; i < seaSparks.length; i++) {
    const sp = seaSparks[i];
    // Hide under active wave wall if covered
    const aCurr = t - peel[sp.xi];
    const cy = swellCrestY(aCurr, shoreY[sp.xi]), wh = swellHeight(aCurr, peakAmp[sp.xi]);
    if (wh > 1 && sp.sy >= cy - wh * 1.5 && sp.sy <= cy + wh * 0.4) continue;

    const s = 0.5 + 0.5 * Math.sin(cyc(t, sp.freq, sp.ph));
    const g = s * s * s;
    if (g < 0.22) continue;
    q.blend(sp.sx, sp.sy, g > 0.68 ? C[6] : C[4], (g - 0.22) * 1.15);
    if (sp.w > 1) q.blend(sp.sx + 1, sp.sy, C[4], (g - 0.22) * 0.85);
    q.light(sp.sx, sp.sy, C[3], g * 0.28);
  }

  // ===========================================================================
  // 2. ORGANIC TUMBLING SURF BILLOWS, SPINDRIFT & CRASH MIST PLUMES!
  //    (Jittered overlapping foam clouds — ZERO evenly-spaced polka-dot rows!)
  // ===========================================================================
  for (let xi = 2; xi < W - 2; xi += 5) {
    const x = X0 + xi + 0.5;
    const pd = peel[xi], aCurr = t - pd, amp = peakAmp[xi];
    const nk = curlNeonK(aCurr);
    const cy = swellCrestY(aCurr, shoreY[xi]), wh = swellHeight(aCurr, amp);

    // Wind-torn glowing spindrift spray peeling backward off the curling crest
    if (nk > 0.34 && aCurr < T_CRASH) {
      const yCrest = cy - wh * 0.82;
      const spPhase = (t * 2.1 + xi * 0.17) % 1;
      const sx = x - spPhase * 8.5 * nk;
      const sy = yCrest - 1 - spPhase * 6.5 * nk + spPhase * spPhase * 3.0;
      q.blend(sx, sy, spPhase < 0.35 ? WHITE : C[5], (1 - spPhase) * nk * 0.82);
    }

    // Organic jittered boiling whitewater clouds & rising spray mist at the crashing break!
    const dtCrash = aCurr - T_CRASH;
    if (dtCrash >= -0.08 && dtCrash < 0.90) {
      const boom = dtCrash < 0 ? (dtCrash + 0.08) / 0.08 : 1 - dtCrash / 0.90;
      const onReef = x < -108;
      const sy = shoreY[xi] - (onReef ? 4.5 : 0);

      if (dtCrash > -0.04 && dtCrash < 0.54) {
        const uPuff = clamp((dtCrash + 0.04) / 0.58, 0, 1);
        const jx = noise(xi * 3, S + 17) * 3.4;
        const jy = noise(xi * 5, S + 19) * 2.2;
        const rPuff = (1.6 + (0.6 + 0.6 * Math.abs(noise(xi, S + 21))) * amp * 2.1) * Math.sin(Math.PI * Math.sqrt(uPuff));
        if (rPuff > 0.7) {
          const py = sy - 1.2 + jy - uPuff * (onReef ? 8.5 : 3.2);
          q.disc(x + jx, py, rPuff, uPuff < 0.32 ? WHITE : uPuff < 0.65 ? C[5] : C[3], 0.46 * (1 - uPuff * 0.75));
        }
      }

      if (xi % 15 === 2) {
        q.glow(x, sy - 4, (onReef ? 24 : 18) * (0.6 + 0.45 * boom), C[4], 0.32 * boom * boom);
        if (dtCrash >= 0 && dtCrash < 0.20) {
          q.glow(x, sy - 2, 9, WHITE, 0.35 * (1 - dtCrash / 0.20));
        }
      }

      if (xi % 15 === 7 && dtCrash > 0) {
        const uMist = dtCrash / 0.90;
        const mx = x + noise(xi, S + 9) * 8 * uMist;
        const my = sy - 3 - uMist * (onReef ? 20 : 13);
        q.disc(mx, my, 4.2 + uMist * 5.5, C[5], 0.16 * (1 - uMist) * (1 - uMist));
      }
    }
  }

  // ===========================================================================
  // 3. SKYWARD EXPLOSION OF 280 LIQUID NEON DROPLETS (拍岸碎成漫天发光水珠!)
  // ===========================================================================
  for (let i = 0; i < droplets.length; i++) {
    const d = droplets[i];
    for (let k = -1; k <= 1; k++) {
      const tau = (t - k * D) - d.baseCrashT;
      if (tau < 0 || tau > d.life) continue;

      const x = d.x0 + d.vx * tau;
      const y = d.yStart - (d.vy0 * tau - 0.5 * d.g * tau * tau);
      const vyScreen = -(d.vy0 - d.g * tau);
      const fade = tau > d.life - 0.14 ? (d.life - tau) / 0.14 : 1;

      bead(q, x, y, d.vx, vyScreen, d.s, C, fade);
      if (d.s >= 2) {
        q.glow(x, y, 2.0 + d.s * 1.2, C[5], (0.18 + 0.08 * d.s) * fade);
      } else {
        q.light(x, y, C[4], 0.42 * fade);
      }

      if (tau > d.life - 0.09 && d.s >= 2) {
        const uRing = (tau - (d.life - 0.09)) / 0.09;
        const rx = 1.4 + uRing * 3.8;
        q.blend(x - rx, y, C[6], (1 - uRing) * 0.72);
        q.blend(x + rx, y, C[6], (1 - uRing) * 0.72);
      }
    }
  }

  // ===========================================================================
  // 4. TWINKLING SEA-FOAM STARLETS & STRANDED PLANKTON SPARKS (水沫星子闪烁!)
  // ===========================================================================
  for (let i = 0; i < foamSparks.length; i++) {
    const fp = foamSparks[i];
    let agitate = 0;
    for (let wIdx = 0; wIdx < 2; wIdx++) {
      const aW = (wIdx === 0 ? t : t + D) - fp.pd;
      const edgeY = swashEdgeY(aW, fp.sy, fp.ry);
      if (edgeY > -900 && Math.abs(fp.py - edgeY) < 7.0) {
        agitate = Math.max(agitate, 1 - Math.abs(fp.py - edgeY) / 7.0);
      } else if (aW > T_PEAK) {
        const dtUnc = aW - fp.tUnc;
        if (dtUnc > 0 && dtUnc < 5.2) {
          agitate = Math.max(agitate, (1 - dtUnc / 5.2) * 0.82);
        }
      }
    }
    if (agitate <= 0.08) continue;

    const s = 0.5 + 0.5 * Math.sin(cyc(t, fp.freq, fp.ph));
    const g = agitate * s * s * s;
    if (g < 0.14) continue;

    if (g > 0.52 && fp.star) {
      sparkle(q, fp.sx, fp.py, g > 0.78 ? 2 : 1, WHITE, C[5], 0.42 * g);
    } else {
      q.blend(fp.sx, fp.py, g > 0.45 ? WHITE : C[6], clamp(g * 1.35, 0, 1));
      q.glow(fp.sx, fp.py, 3.2, C[4], 0.25 * g);
    }
  }
}
