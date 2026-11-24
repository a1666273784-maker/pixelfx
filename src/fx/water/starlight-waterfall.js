// Starlight Waterfall ("water/starlight-waterfall" — 【星河瀑布可循环环境特效】):
// A seamless cosmic hydrological loop (`loop: true`, `duration: 3.6s`):
// 1. Mid-Air Cosmic Nebula Source (y = -98): A soft, glowing astral nebula cloud & crescent weir suspended in
//    mid-air from which the pale-violet starlight river endlessly wells up and curls over the lip ("从半空中源源不断
//    倾泻下发光的淡紫色星光流体").
// 2. Pouring Pale-Violet Starlight Fluid & Internal Shooting Stars (y in [-97..-2]): Translucent deep-indigo to
//    pale-lavender fluid lanes cascade downward and split into braided strands while radiant gold-white shooting
//    stars with long tapered tails streak diagonally inside the waterfall curtain ("要有瀑布内部流星划过的细节特效").
// 3. Churning Stardust Splash Crowns & Outward Glowing Mist (y in [-14..+14]): The fluid crashes into the pool,
//    throwing concentric arcs of stardust water-beads and billowing into soft, edge-free glowing violet mist that
//    spreads outward to both sides ("到流体砸落地面激起一圈圈星尘水花并化作发光雾气向四周散开").
// 4. Continuous Expanding Pool Ripples & Star-Caustics (y in [-14..+18]): Multi-ring elliptical ripples and
//    secondary droplet rings continuously spread and interfere across the dark star-caustic pool ("底部水面涟漪持续扩散").
// 5. Ethereal Rising Mist & Starlight Wisps Re-Entering the Source: Using an aurora-style box-blurred light & mist
//    accumulation field (`MIST_I` + `blurMist` + `rows`) and ascending starlight wisps, the outward mist wafts
//    gently upward through the air on both sides and funnels back into the mid-air waterfall source ("随后雾气又缓缓
//    升腾回空中重新汇入瀑布源头的无限循环过程").
// Adapted from Sprite Fusion's open-source waterfall, holy light, and sparkle VFX (https://www.spritefusion.com/pixel-art-vfx),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, cycle, tileNoise, rand, clamp, smooth, lerp, ease, TAU, WHITE, sparkle } from "../../core/index.js";
import { bead, ring, billow } from "./_lib.js";
import { clip, rows, field, sample } from "../weather/_lib.js";

const D = 3.6;
const CW = 224, CH = 168;
const OX = 112, OY = 144; // Sky/air spans y in [-144..-1], Ground/pool spans y in [0..23]
const SY = 0.21;
const G_ACC = 720;
const POOL_RX = 84, POOL_RY = 16;

export const meta = {
  name: "Starlight waterfall",
  desc: "Pale-violet starlight fluid pours from a mid-air nebula rift with shooting stars streaking inside, splashing into a rippling star-pool as glowing mist rises back to the source.",
  tags: ["water", "waterfall", "star", "meteor", "arcane", "mist", "ripples", "ambient", "loop"],
  size: [CW, CH],
  origin: [OX, OY],
  duration: D,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // 8-step Pale-Violet Starlight Fluid ramp ("发光的淡紫色星光流体": deep cosmic indigo -> amethyst -> pale lavender -> white)
    palette: ["#100a24", "#1e1442", "#34226e", "#5638a6", "#8462d8", "#b89cf6", "#e4d6ff", "#ffffff"],
    // 6-step Starlight Gold & Rose-Nebula ramp (for internal waterfall meteors, stardust glints & nebula highlights)
    star: ["#26143e", "#5c2878", "#b84ca2", "#ff9e78", "#ffe8a8", "#ffffff"],
    height: 98,
    width: 17,
    seed: 7,
  },
};

// Buffers for aurora-style soft blurred mist & nebula glow (`zero hard edges!`)
const MIST_I = new Float32Array(CW * CH);
const MIST_BL = new Float32Array(CW * CH);
const MIST_TMP = new Float32Array(CW * CH);
let cachedSeed = null;
let cachedF = null;
let cachedG = null;

function getFields(S) {
  if (cachedSeed !== S || !cachedF) {
    cachedSeed = S;
    cachedF = field(S * 7 + 1, 256, 128, [8, 16, 32]);
    cachedG = field(S * 7 + 11, 256, 128, [4, 8, 16]);
  }
  return [cachedF, cachedG];
}

// Fast 4-pixel box blur restricted to canvas rows `[yi0 .. yi1]`
function blurMistRows(src, dst, r, yi0, yi1) {
  const n = 2 * r + 1;
  for (let y = yi0; y <= yi1; y++) {
    let acc = 0;
    const o = y * CW;
    for (let x = -r; x < CW + r; x++) {
      if (x + r < CW) acc += src[o + Math.min(CW - 1, x + r)];
      if (x - r - 1 >= 0) acc -= src[o + x - r - 1];
      if (x >= 0 && x < CW) MIST_TMP[o + x] = acc / n;
    }
  }
  for (let x = 0; x < CW; x++) {
    let acc = 0;
    for (let y = yi0 - r; y <= yi1 + r; y++) {
      if (y + r <= yi1) acc += MIST_TMP[Math.min(yi1, Math.max(yi0, y + r)) * CW + x];
      if (y - r - 1 >= yi0) acc -= MIST_TMP[(y - r - 1) * CW + x];
      if (y >= yi0 && y <= yi1) dst[y * CW + x] = acc / n;
    }
  }
}

// Half-width of the waterfall sheet at depth `d` below the mid-air lip (`0 <= d <= H`)
const halfW = (W, d, H) => W + 5.2 * Math.pow(clamp(d / H), 1.55);

// Center X (positive side) and plume half-width of the rising mist circulation at normalized height `u = clamp(-y / H, 0, 1)`
function mistPlumeCenterAndWidth(u, W) {
  const arch = Math.sin(u * Math.PI);
  const cx = lerp(W + 30, W + 4, ease.inOutSine(u)) + arch * 22;
  const hw = lerp(28, 18, u) + arch * 9;
  return [cx, hw];
}

// 1. THE STAR-POOL & CONTINUOUS EXPANDING RIPPLES ("底部水面涟漪持续扩散的细节特效")
const COL_SIN1 = new Float32Array(POOL_RX * 2);
const COL_SIN2 = new Float32Array(POOL_RX * 2);

function drawStarPool(p, C, S_COL, ph, W, S) {
  const RX = POOL_RX, RY = POOL_RY, cy = 2;
  const T = ph * TAU;

  for (let X = -RX; X < RX; X++) {
    const x = X + 0.5;
    COL_SIN1[X + RX] = Math.sin(x * 0.11 - T * 2);
    COL_SIN2[X + RX] = Math.sin(T + x * 0.05) * 1.4 + x * 0.13;
  }

  rows(p, meta, Math.floor(cy - RY), cy + RY - 1, (y, R) => {
    const dy = (y - cy) / RY, dy2 = dy * dy;
    if (dy2 >= 1) return;
    const sy = Math.sin(y * 0.5 + T);
    const invW = 1 / (W + 16), wy = (y - 1) / 8, wy2 = wy * wy;
    const xSpan = Math.floor(RX * Math.sqrt(1 - dy2));

    for (let X = -xSpan; X < xSpan; X++) {
      const x = X + 0.5, dx = x / RX, d = dx * dx + dy2;
      if (d > 1) continue;
      const xi = X + OX;

      const coreD2 = (x * invW) * (x * invW) + wy2;
      const baseCol = coreD2 < 0.30 ? C[3] : d < 0.22 ? C[2] : C[1];
      R.c[xi] = baseCol;
      R.a[xi] = 0.68 * Math.min(1, (1 - d) * 3.8);
      R.b[xi] = 1;

      const cx1 = COL_SIN1[X + RX], cx2 = COL_SIN2[X + RX];
      const u = x * 0.19 + 1.7 * sy, w = y * 0.52 + 1.7 * cx1;
      const f = (Math.max(0, 1 - Math.abs(Math.sin(u) + Math.sin(w)) * 2.5)
        + 0.6 * Math.max(0, 1 - Math.abs(Math.sin(cx2 + y * 0.3)) * 2.8)) * (1 - d);
      if (f > 0.46) {
        R.l[xi] = f > 0.85 ? S_COL[4] : C[5];
        R.k[xi] = 0.20 * f;
      }
    }
  });

  // Shimmering pale-violet reflection of the waterfall column on the pool surface
  p.shade(-W - 6, 2, W + 6, 13, (x, y, out) => {
    const k = 1 - (y - 2) / 11;
    const n = tileNoise(x * 0.75, (y - 2) * 0.35 + ph * 6, 0, 6, S + 6);
    if (Math.abs(x) > W + 5 - (y - 2) * 0.35 || n < 0.22 + (1 - k) * 0.38) return;
    out.c = n > 0.58 && k > 0.55 ? C[6] : C[5];
    out.a = 0.75 * k;
    out.b = 1;
  });
}

function drawPoolRipples(p, C, S_COL, t, ph, W, S, half) {
  const nWaves = 4;
  for (let i = 0; i < nWaves; i++) {
    const f = (ph * 2 + i / nWaves) % 1;
    const r = W + 4 + ease.outQuad(f) * (POOL_RX - W - 6);
    const k = 0.95 * Math.pow(1 - f, 1.35) * Math.min(1, f * 8);
    const pal = i % 2 === 0 ? C : [C[0], C[1], C[2], C[3], S_COL[3], S_COL[4], C[6], WHITE];
    ring(p, 0, 1.5, r, SY, k, pal, {
      n: f < 0.55 ? 2 : 1,
      gap: 3.2,
      half,
      hot: f < 0.22,
      glint: f < 0.45 ? (1 - f / 0.45) * 0.85 : 0,
      seed: S + i * 7 + 1,
      wob: 1.0,
    });
  }

  // Secondary continuous ripples across the left & right pool wings where stardust droplets plink down
  if (half > 0) {
    cycle(t, D, 12, S + 90, 0.85, (age, life, r) => {
      const u = age / life;
      const side = r.sign();
      const cx = side * r.range(W + 8, POOL_RX - 12);
      const cz = r.range(-16, 20);
      const rad = 1.5 + ease.outCubic(u) * r.range(10, 17);
      const k = (1 - u) * (1 - u) * 0.82;
      ring(p, cx, 1.5 + cz * SY, rad, SY, k, C, {
        n: 1,
        half: 0,
        hot: u < 0.18,
        seed: r.int(1, 999),
      });
    });
  }
}

// 2. ETHEREAL AURORA-STYLE MIST CIRCULATION & NEBULA SOURCE (`MIST_I` + `blurMistRows` + `rows`)
function drawSoftMistCirculation(p, C, S_COL, ph, W, H, S) {
  const [F, G] = getFields(S);
  // Exact integer multiples of tile dimensions (`256` and `128`) -> ZERO loop seam!
  const scrollXOut = 256 * ph;
  const scrollYUp = 256 * ph;
  const boilY = 128 * ph;

  const yTop = -H - 18, yBot = 10;
  const yi0 = Math.max(0, yTop + OY), yi1 = Math.min(CH - 1, yBot + OY);

  // Fill `MIST_I` in 2x2 cells before the 9x9 box blur (`blurMistRows`) -> 4x fewer noise lookups with identical blurred halo!
  for (let yi = yi0; yi <= yi1; yi += 2) {
    const y = yi - OY;
    const rowOff0 = yi * CW;
    const rowOff1 = Math.min(yi1, yi + 1) * CW;

    const u = clamp(-y / H, 0, 1.15);
    const [plumeCx, plumeHw] = mistPlumeCenterAndWidth(clamp(u, 0, 1), W);

    const botVert = smooth(-24, -4, y) * (1 - smooth(2, 10, y));
    const topVert = smooth(-H - 16, -H - 3, y) * (1 - smooth(-H + 4, -H + 14, y));
    const riseVert = smooth(-H - 6, -H + 2, y) * (1 - smooth(2, 10, y));

    for (let xi = 0; xi < CW; xi += 2) {
      const x = xi - OX + 1.0;
      const ax = Math.abs(x);

      const botHoriz = smooth(W - 4, W + 10, ax) * (1 - smooth(54, 88, ax));
      const envBot = botVert * botHoriz * 1.05;

      const distPlume = Math.abs(ax - plumeCx) / plumeHw;
      const envRise = riseVert * Math.max(0, 1 - distPlume * distPlume) * (0.68 + 0.28 * Math.sin(clamp(u, 0, 1) * Math.PI));

      const topHoriz = 1 - smooth(W + 6, W + 34, ax);
      const envTop = topVert * topHoriz * 1.18;

      const env = Math.max(envBot, envRise, envTop);
      let val = 0;
      if (env > 0.02) {
        const n1 = sample(F, ax * 1.6 - scrollXOut, y * 1.8 + scrollYUp);
        const n2 = sample(G, x * 1.2 + 50, y * 2.2 + boilY);
        const wisps = clamp((n1 * 0.65 + n2 * 0.35 - 0.33) * 2.2);
        val = env * (0.30 + 0.95 * wisps);
      }
      MIST_I[rowOff0 + xi] = val;
      MIST_I[rowOff1 + xi] = val;
      if (xi + 1 < CW) {
        MIST_I[rowOff0 + xi + 1] = val;
        MIST_I[rowOff1 + xi + 1] = val;
      }
    }
  }

  blurMistRows(MIST_I, MIST_BL, 4, yi0, yi1);

  rows(p, meta, yTop, yBot, (y, R) => {
    const yi = Math.floor(y) + OY;
    if (yi < yi0 || yi > yi1) return;
    const base = yi * CW;
    const isSource = y < -H + 8;

    for (let xi = 0; xi < CW; xi++) {
      const raw = MIST_I[base + xi];
      const bl = MIST_BL[base + xi];
      if (bl <= 0.02 && raw <= 0.02) continue;

      const m = bl * 0.65 + raw * 0.45;
      const k = Math.min(0.32, m * (isSource ? 0.52 : 0.38));
      R.l[xi] = m > 0.52 ? C[5] : C[4];
      R.k[xi] = k;

      if (m > 0.15) {
        const a = clamp((m - 0.15) * 0.72, 0, isSource ? 0.58 : 0.38);
        R.c[xi] = m > 0.68 ? C[6] : m > 0.42 ? C[5] : C[4];
        R.a[xi] = a;
        R.b[xi] = 1;
      }
    }
  });
}

// Rising starlight motes & vapor wisps drifting upward through the side mist plumes back into the mid-air source
function drawAscendingStarlightWisps(p, C, S_COL, t, ph, W, H, S) {
  cycle(t, D, 44, S + 48, (g) => g.range(1.4, 2.2), (age, life, r) => {
    const k = age / life;
    const side = r.sign();
    const u0 = r.range(0.04, 0.56);
    const u = clamp(u0 + k * 0.46, 0.02, 0.99);
    const [plumeCx, plumeHw] = mistPlumeCenterAndWidth(u, W);
    const laneFrac = r.range(-0.62, 0.62);
    const sway = Math.sin(u * TAU * 1.5 + r.range(0, TAU)) * 3.5;

    const x = side * (plumeCx + laneFrac * plumeHw * 0.72) + sway;
    const y = -u * H;

    const fade = Math.sin(k * Math.PI);
    const tw = 0.5 + 0.5 * Math.sin(ph * TAU * 5 + r.range(0, TAU));
    const col = r.next() < 0.42 ? S_COL[4] : C[6];
    const colGlow = r.next() < 0.42 ? S_COL[3] : C[4];

    p.dot(x - side * 0.5, y + 1.5, colGlow, fade * 0.48);
    p.dot(x - side * 1.0, y + 3.0, colGlow, fade * 0.26);
    p.dot(x, y, fade * tw > 0.64 ? WHITE : col, fade * 0.88);
    if (fade * tw > 0.76 && r.next() < 0.35) {
      sparkle(p, x, y, 2, WHITE, col, 0.28 * fade);
    }
  });
}

// 3. MID-AIR COSMIC RIFT WEIR & LIP CURL ("半空中源源不断倾泻下的瀑布源头")
function drawCosmicRiftSource(p, C, S_COL, ph, H, W, S) {
  const cy = -H - 2;
  const T = ph * TAU;

  p.glow(0, cy, (W + 10) * 1.35, C[4], 0.22 + 0.04 * Math.sin(T * 2));

  const top = -H - 6;
  p.shade(-W - 3, top, W + 3, -H, (x, y, out) => {
    const back = top + 1.5 + tileNoise(x * 0.28, 4, 0, 0, S + 62) * 1.8;
    const v = (y - back) / Math.max(1, -H - back);
    const hw = W + 2 - (1 - v) * 3.5;
    if (y < back || Math.abs(x) > hw) return;
    const n = tileNoise(x * 0.32, (y - top) * 0.7 - ph * 8, 0, 8, S + 3);
    out.c = n > 0.66 ? C[6] : n > 0.38 ? C[5] : v < 0.5 ? C[3] : C[4];
    out.a = 0.85 * smooth(0, 0.25, v);
    out.b = 1;
  });

  for (let x = -W - 1; x <= W + 1; x++) {
    const edgeFade = 1 - Math.pow(Math.abs(x) / (W + 2.5), 2.2);
    const g = tileNoise(x * 0.42, ph * 6, 0, 6, S + 4);
    p.blend(x, -H - 1, C[5], 0.82 * edgeFade);
    p.blend(x, -H, g > 0.22 ? WHITE : C[6], 0.92 * edgeFade);
    p.blend(x, -H + 1, g > 0.28 ? C[6] : C[5], 0.88 * edgeFade);
  }
  p.glowLine(-W, -H, W, -H, 6, C[6], 0.20);
}

// 4. POURING PALE-VIOLET STARLIGHT FLUID SHEET ("倾泻下发光的淡紫色星光流体")
function drawStarlightSheet(p, C, S_COL, t, ph, H, W, S) {
  for (let y = -H + 2; y <= -1; y++) {
    const d = y + 0.5 + H, v = d / H, s = Math.sqrt(d + 3);
    const hw0 = halfW(W, d, H);
    const split = smooth(0.52, 0.95, v);
    const glass = 1 - smooth(4, 24, d);

    const wl = tileNoise(2, s * 1.4 - ph * 12, 0, 12, S + 2) * (0.4 + 1.8 * v);
    const wr = tileNoise(11, s * 1.4 - ph * 12, 0, 12, S + 2) * (0.4 + 1.8 * v);
    const fan = split > 0 ? tileNoise(3, s * 0.8 - ph * 4, 0, 4, S + 61) * 1.6 : 0;
    const sd = s * 1.5 - ph * 20;
    const sb = s * 0.45 - ph * 6;

    const xBound = Math.ceil(hw0 + 5);
    let lastBucket = -999, broad = 0;
    for (let X = -xBound; X <= xBound; X++) {
      const x = X + 0.5, hw = hw0 + (x < 0 ? wl : wr), ax = Math.abs(x);
      if (ax > hw) continue;
      const e = ax / hw;
      let edge = false;
      if (split > 0) {
        const f = ((((x / (1 + 0.22 * split) + fan + 64) / 5.4) % 1) + 1) % 1;
        if (f > 1 - 0.44 * split) continue;
        edge = f < 0.2;
      }

      const dash = tileNoise(X * 1.618 + 0.31, sd, 0, 20, S);
      if (rand(X, S + 60) < 0.48 && e < 0.86 && !edge) {
        p.blend(x, y + 0.5, dash > 0.45 ? C[4] : glass > 0.5 ? C[3] : C[2], dash > 0.45 ? 0.70 : 0.44 + 0.16 * v);
        continue;
      }

      const bucket = Math.floor((x + 40) / 3);
      if (bucket !== lastBucket) {
        lastBucket = bucket;
        broad = tileNoise(bucket * 2.7, sb, 0, 6, S + 1);
      }
      let b = -0.34 + 0.45 * v + 0.28 * broad - glass * 0.48 + 0.34 * smooth(0.7, 1, e) * (x < 0 ? 1 : 0.35) - (x > 0 ? 0.10 * e : 0) + (edge ? 0.28 : 0);
      if (dash > 0.22 - 0.20 * v) b += 0.34 + 0.65 * (dash - 0.22);

      if (b > -0.18) {
        const col = b > 0.72 ? WHITE : b > 0.38 ? C[6] : b > 0.10 ? C[5] : C[4];
        p.px(X, y, col);
      } else {
        p.blend(x, y + 0.5, C[3], 0.76);
      }
    }
  }

  cycle(t, D, 18, S + 30, 0.45, (age, life, r) => {
    const side = r.sign(), d0 = r.range(12, H * 0.68), d = d0 + 52 * age + 260 * age * age, k = age / life;
    if (d > H - 5) return;
    const x = side * (halfW(W, d, H) + 1.5 + age * r.range(6, 15)), y = -H + d, len = 2 + 6 * k;
    p.line(x, y - len, x, y, (u) => (u > 0.7 ? C[6] : C[4]), 1 - k * 0.5);
  });

  p.glowLine(0, -H + 6, 0, -6, 28, C[4], 0.13);
}

// 5. SHOOTING STARS STREAKING DIAGONALLY INSIDE THE WATERFALL ("要有瀑布内部流星划过的细节特效")
const INNER_METEORS = [
  { p0: 0.02, x0: -15, dx: 30,  y0: -90, y1: -14, dur: 0.25, s: 1.25 },
  { p0: 0.13, x0: 15,  dx: -30, y0: -92, y1: -18, dur: 0.23, s: 1.10 },
  { p0: 0.24, x0: -14, dx: 29,  y0: -86, y1: -10, dur: 0.25, s: 1.28 },
  { p0: 0.35, x0: 15,  dx: -30, y0: -93, y1: -16, dur: 0.24, s: 1.15 },
  { p0: 0.46, x0: -15, dx: 31,  y0: -90, y1: -12, dur: 0.25, s: 1.25 },
  { p0: 0.57, x0: 14,  dx: -29, y0: -88, y1: -14, dur: 0.23, s: 1.12 },
  { p0: 0.68, x0: -15, dx: 30,  y0: -92, y1: -12, dur: 0.25, s: 1.28 },
  { p0: 0.79, x0: 15,  dx: -30, y0: -90, y1: -16, dur: 0.24, s: 1.18 },
  { p0: 0.90, x0: -14, dx: 29,  y0: -93, y1: -12, dur: 0.25, s: 1.22 },
];

function drawWaterfallInnerMeteors(p, C, S_COL, ph) {
  for (let i = 0; i < INNER_METEORS.length; i++) {
    const m = INNER_METEORS[i];
    const dph = ((ph - m.p0) % 1 + 1) % 1;
    const totalSpan = m.dur + 0.10;
    if (dph >= totalSpan) continue;

    const u = clamp(dph / m.dur);
    const eu = ease.inOutSine(u);
    const hx = m.x0 + m.dx * eu;
    const hy = lerp(m.y0, m.y1, eu);
    const vx = m.dx, vy = m.y1 - m.y0, dist = Math.hypot(vx, vy) || 1;
    const ux = vx / dist, uy = vy / dist;
    const nx = -uy, ny = ux;

    const cHead = S_COL[4]; // Warm Starlight Gold `#ffe8a8`
    const cMid = S_COL[3];  // Sunset Rose-Gold `#ff9e78`
    const cTail = S_COL[2]; // Magenta-Rose `#b84ca2`

    const wakeFade = dph < m.dur ? 1 : 1 - (dph - m.dur) / 0.10;
    const tailLen = (28 + 10 * m.s) * Math.min(1, u * 3.0);

    // Subtle deep-indigo contrast sheath behind the diagonal golden meteor tail so it pops cleanly inside the waterfall!
    for (let d = 1; d <= tailLen; d += 0.8) {
      const tx = hx - ux * d, ty = hy - uy * d;
      if (ty < m.y0 || ty > -3) continue;
      p.blend(tx + nx * 1.5, ty + ny * 1.5, C[1], 0.36 * wakeFade * (1 - d / tailLen));
      p.blend(tx - nx * 1.5, ty - ny * 1.5, C[1], 0.36 * wakeFade * (1 - d / tailLen));
    }

    for (let d = 0; d <= tailLen; d += 0.65) {
      const v = d / Math.max(1, tailLen);
      const tx = hx - ux * d;
      const ty = hy - uy * d;
      if (ty < m.y0 || ty > -3) continue;
      const col = v < 0.24 ? WHITE : v < 0.60 ? cHead : v < 0.84 ? cMid : cTail;
      const a = wakeFade * (1 - v);
      p.dot(tx, ty, col, a);
      if (d < tailLen * 0.60) {
        p.dot(tx + nx * 0.9, ty + ny * 0.9, v < 0.38 ? cHead : cMid, a * 0.90);
        p.dot(tx - nx * 0.9, ty - ny * 0.9, cMid, a * 0.72);
      }
    }

    if (dph < m.dur) {
      const headK = Math.sin(u * Math.PI);
      p.px(hx, hy, WHITE);
      sparkle(p, hx, hy, Math.round(3.5 + 2 * m.s * headK), WHITE, cHead, 0.78 * headK);
      p.glow(hx, hy, 6 * m.s, cHead, 0.45 * headK);
      p.glow(hx - ux * tailLen * 0.35, hy - uy * tailLen * 0.35, 5, cMid, 0.24 * headK);
    }
  }
}

// 6. CHURNING FOAM, STARDUST SPLASH CROWNS & SPRAY AT THE FOOT
//    ("流体砸落地面激起一圈圈星尘水花并化作发光雾气向四周散开")
function drawFootFoamAndSplash(p, C, S_COL, t, ph, W, S) {
  const R = W + 11;
  p.shade(-R, -13, R, 3, (x, y, out) => {
    const ax = Math.abs(x);
    const lump = tileNoise(x * 0.22, ph * 6, 0, 6, S + 7) * 3 + tileNoise(x * 0.55 + 9, ph * 12, 0, 12, S + 8) * 1.5;
    const top = -8 + lump + Math.pow(ax / R, 2) * 7;
    if (ax > R - Math.max(0, -y - 1) * 0.6 || y < top) return;

    const n = tileNoise(x * 0.5, (y - top) * 0.5 - ph * 10, 0, 10, S + 9);
    const boil = tileNoise(x * 0.42 + 3, y * 0.42 - ph * 8, 0, 8, S + 12);
    const u = y - top;
    if (y > 1) out.c = n > 0 ? C[5] : C[4];
    else if (u < 1.3) out.c = WHITE;
    else if (boil < -0.3) out.c = u > 4 ? C[4] : C[5];
    else if (boil < -0.05) out.c = C[6];
    else out.c = n > -0.2 ? WHITE : C[6];
  });

  cycle(t, D, 30, S + 10, 0.75, (age, life, r) => {
    const k = age / life, side = r.sign(), x0 = r.range(-W, W) * 0.92, sp = r.range(3, 11), up = r.range(2, 8);
    const x = x0 + side * ease.outCubic(k) * sp, y = -r.range(2, 5) - ease.outCubic(k) * up;
    const rad = r.range(1.5, 3.2) * Math.pow(Math.sin(Math.PI * k), 0.7);
    if (rad > 0.6) billow(p, x, y, rad, C);
  });

  // Concentric arcs of stardust water-beads ("激起一圈圈星尘水花") thrown clear and landing with rings
  cycle(t, D, 28, S + 11, 1.05, (age, life, r) => {
    const side = r.sign();
    const x0 = side * r.range(2, W + 5);
    const vx = side * r.range(16, 68), vy = -r.range(72, 155);
    const z = r.range(-4, 11), s = r.next() < 0.32 ? 2 : 1;
    const land = z * SY;
    const tl = (-vy + Math.sqrt(vy * vy + 2 * G_ACC * (land + 5))) / G_ACC;
    const pal = r.next() < 0.30 ? [C[0], C[1], C[2], S_COL[2], S_COL[3], S_COL[4], S_COL[4], WHITE] : C;
    if (age < tl) {
      const bx = x0 + vx * age, by = -5 + vy * age + 0.5 * G_ACC * age * age;
      bead(p, bx, by, vx, vy + G_ACC * age, s, pal);
      if (s === 2 && age < tl * 0.65) p.light(bx, by, pal[5], 0.30);
    } else if (age < tl + 0.38) {
      const ru = (age - tl) / 0.38;
      ring(p, x0 + vx * tl, land, 1 + (age - tl) * 14, SY, 1 - ru, pal, { n: 1 });
    }
  });

  // Twinkling starlight glints on the falling water and in the splash spray
  cycle(t, D, 14, S + 50, (g) => g.range(0.25, 0.45), (age, life, r) => {
    const k = Math.sin((Math.PI * age) / life);
    const low = r.next() < 0.45;
    const H = meta.options.height;
    const d = low ? H - r.range(3, 15) : r.range(10, H - 16);
    const x = low ? r.range(-W - 14, W + 14) : r.range(-0.85, 0.85) * halfW(W, d, H);
    const y = -H + d - (age / life) * (low ? 6 : -10);
    const col = r.next() < 0.40 ? S_COL[4] : C[6];
    sparkle(p, x, y, k > 0.7 ? 2 : 1, WHITE, col, 0.42 * k);
  });

  // Fine stardust spray hanging and drifting upward off the foot
  cycle(t, D, 36, S + 51, (g) => g.range(0.9, 1.6), (age, life, r) => {
    const k = age / life, side = r.sign();
    const x = side * (r.range(0, W + 8) + k * r.range(8, 28)) + Math.sin(age * 5 + r.range(0, TAU)) * 1.4;
    const y = -r.range(3, 10) - k * r.range(10, 36);
    if (k > 0.7 && r.next() < (k - 0.7) * 3.3) return;
    p.dot(x, y, k < 0.4 && r.next() < 0.5 ? WHITE : r.next() < 0.35 ? S_COL[4] : C[6], 1 - k * 0.4);
  });

  const T = ph * TAU;
  p.glow(0, -5, 40, C[5], 0.28 + 0.04 * Math.sin(T * 2));
  p.glow(0, 4, 50, C[3], 0.14);
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8);
  const S_COL = fit(o.star, 6);
  const ph = (t / D) % 1;
  const W = o.width, H = o.height, S = o.seed;

  // 1. Star-caustic pool & far half of the continuous expanding ripples
  drawStarPool(p, C, S_COL, ph, W, S);
  drawPoolRipples(p, C, S_COL, t, ph, W, S, -1);

  // 2. Soft aurora-style blurred mist circulation spreading outward, rising through the air, and forming the mid-air nebula source
  drawSoftMistCirculation(p, C, S_COL, ph, W, H, S);
}

export function draw(p, t, o) {
  const q = clip(p, meta);
  const C = fit(o.palette, 8);
  const S_COL = fit(o.star, 6);
  const ph = (t / D) % 1;
  const W = o.width, H = o.height, S = o.seed;

  // 1. Near half of the continuous expanding pool ripples (with catch-light glints)
  drawPoolRipples(p, C, S_COL, t, ph, W, S, 1);

  // 2. Pouring pale-violet starlight fluid sheet & mid-air cosmic rift weir
  drawStarlightSheet(p, C, S_COL, t, ph, H, W, S);
  drawCosmicRiftSource(p, C, S_COL, ph, H, W, S);

  // 3. Shooting stars streaking diagonally inside the waterfall curtain ("瀑布内部流星划过")
  drawWaterfallInnerMeteors(p, C, S_COL, ph);

  // 4. Churning stardust foam, splash crowns & spray at the waterfall foot
  drawFootFoamAndSplash(q, C, S_COL, t, ph, W, S);

  // 5. Ascending starlight wisps & motes rising inside the mist plumes back into the source
  drawAscendingStarlightWisps(p, C, S_COL, t, ph, W, H, S);
}
