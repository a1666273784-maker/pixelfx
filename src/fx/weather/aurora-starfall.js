// Aurora Starfall ("weather/aurora-starfall" — 【极光星落环境变化特效】):
// Built directly on the soft, atmospheric curtain accumulation & box-blurred row shader of `weather/aurora` and
// the delicate tapered meteor & twisting train renderer of `weather/shooting-stars`:
// 1. Soft Interwoven Emerald & Magenta-Violet Aurora Curtains Emerge & Sway (0.00..4.42s): Rippling, translucent
//    curtains of emerald-jade and rose-magenta-violet light unfurl across a starry night sky, folding gently in
//    slow waves with fine 1px vertical ray strands and a soft atmospheric bloom so stars shine through.
// 2. Delicate Glowing Stardust Drifts Down from Inside the Aurora (0.58..4.15s): Softly twinkling emerald-mint,
//    lavender-rose, and warm starlight motes shake loose from the bright aurora folds and float gently downward.
// 3. Long-Tailed Shooting Stars Slice Across the Sky (1.32..3.85s): Graceful meteors with warm white-gold-rose
//    tapered trails and faint twisting trains streak across the firmament, with the largest flaring into starlets.
// 4. Soft Flowing Aurora Ground Reflections & Stardust Landing Dissipation (0.18..4.44s): The stone ground below
//    is bathed in a gentle, flowing emerald-and-violet aurora reflection while landing stardust motes bloom into
//    soft translucent ripples and fade away cleanly by 4.50s.
// Adapted from Sprite Fusion's open-source holy light and sparkle VFX (https://www.spritefusion.com/pixel-art-vfx),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, smooth, lerp, ease, rand, mix, at, TAU, WHITE, sparkle } from "../../core/index.js";
import { clip, rows, box, field, sample } from "./_lib.js";

const T_END = 4.50;
const W = 320, H = 180;
const OX = 160, OY = 152; // Sky spans y in [-152..-1], Ground spans y in [0..27]
const SKY_H = 126; // Aurora curtains live in canvas rows 0..125 (`y in [-152..-27]`)
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export const meta = {
  name: "Aurora starfall",
  desc: "Soft curtains of interwoven emerald and magenta-violet aurora wave over a starry sky, shedding gentle stardust and long-tailed shooting stars across aurora-lit ground.",
  tags: ["weather", "aurora", "star", "meteor", "shooting star", "sky", "night", "ambient", "one-shot"],
  size: [W, H],
  origin: [OX, OY],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    // Soft 7-step Emerald-Mint ramp (matching `weather/aurora` for a gentle, velvety glow)
    emerald: ["#081a1e", "#0d3a36", "#13664e", "#1fa06a", "#3fd88e", "#9af7bf", "#e6fff0"],
    // Soft 7-step Magenta-Violet ramp ("紫红与翠绿交织", warm amethyst-rose to soft lavender)
    magenta: ["#160a26", "#2e144d", "#56207e", "#8a32b2", "#c45ce0", "#ebb0ff", "#faecff"],
    // Soft 6-step Shooting-Star Gold-Rose ramp (matching `weather/shooting-stars`)
    starlight: ["#3a1e5a", "#7a3a8a", "#e0607a", "#ffa86a", "#ffe6a8", "#ffffff"],
    seed: 19,
  },
};

const I = new Float32Array(W * SKY_H);
const HV = new Float32Array(W * SKY_H);
const BL = new Float32Array(W * SKY_H);
const TMP = new Float32Array(W * SKY_H);
const COL_LIGHT = new Float32Array(W);
const COL_HUE = new Float32Array(W);
const GX_HUE = new Float32Array(W);
const GX_RIP = new Float32Array(W);
let cachedSeed = null;
let cachedField = null;

function getField(S) {
  if (cachedSeed !== S || !cachedField) {
    cachedSeed = S;
    cachedField = field(S * 5 + 1, 256, 128, [8, 16, 32]);
  }
  return cachedField;
}

// Same soft vertical curtain profile as `weather/aurora.js`:
// a delicate 1px hem (v < 0.035), a gentle body (v < 0.22), and vertical rays fading smoothly up into the night sky.
const PROF = Float32Array.from({ length: 201 }, (_, i) => {
  const v = i / 200;
  return v < 0.035 ? 2.4 : v < 0.22 ? 1.12 - v : (1 - v) ** 1.5 * 0.88;
});

// Soft box blur over the `W x SKY_H` aurora sky region
function blurSky(src, dst, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < SKY_H; y++) {
    let acc = 0;
    const o = y * W;
    for (let x = -r; x < W + r; x++) {
      if (x + r < W) acc += src[o + Math.min(W - 1, x + r)];
      if (x - r - 1 >= 0) acc -= src[o + x - r - 1];
      if (x >= 0 && x < W) TMP[o + x] = acc / n;
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y < SKY_H + r; y++) {
      if (y + r < SKY_H) acc += TMP[Math.min(SKY_H - 1, y + r) * W + x];
      if (y - r - 1 >= 0) acc -= TMP[(y - r - 1) * W + x];
      if (y >= 0 && y < SKY_H) dst[y * W + x] = acc / n;
    }
  }
}

// 3 Interweaving, Gently Undulating Aurora Curtains (back to front):
// - Curtain 0: high-altitude Magenta-Violet veil (`hue: 0.58`)
// - Curtain 1: sweeping Emerald-Jade main ribbon curtain (`hue: 0.0`, waves across the mid-sky)
// - Curtain 2: counter-waving Magenta-Rose & Emerald ribbon curtain (`hue: 0.44`, interweaves across Curtain 1)
const CURTAINS = [
  { y: -110, slope: -0.07, amp: 8,  lam: 210, fold: 14, flam: 150, height: 38, k: 0.58, s0: -195, s1: 195, rip: 1.5, c: [1, 1, 2], hue: 0.58 },
  { y: -68,  slope: 0.16,  amp: 13, lam: 245, fold: 18, flam: 162, height: 74, k: 1.38, s0: -190, s1: 185, rip: 2.2, c: [1, 2, 3], hue: 0.00 },
  { y: -56,  slope: -0.11, amp: 10, lam: 195, fold: 15, flam: 135, height: 52, k: 0.92, s0: -190, s1: 190, rip: 1.7, c: [2, 1, 3], hue: 0.44 },
];

// 6 Graceful Long-Tailed Shooting Stars (`weather/shooting-stars.js` style)
const METEORS = [
  { t0: 1.32, x: 118, y: -144, a: 2.52, v: 245, life: 0.58, s: 0.85, flare: false },
  { t0: 1.58, x: 24,  y: -146, a: 2.38, v: 225, life: 0.62, s: 0.95, flare: true },
  { t0: 1.88, x: 142, y: -136, a: 2.46, v: 260, life: 0.68, s: 1.25, flare: true },
  { t0: 2.18, x: -18, y: -146, a: 2.26, v: 215, life: 0.56, s: 0.78, flare: false },
  { t0: 2.48, x: 134, y: -142, a: 2.34, v: 240, life: 0.72, s: 1.32, flare: true },
  { t0: 2.82, x: 68,  y: -146, a: 2.48, v: 250, life: 0.64, s: 1.05, flare: true },
];
const TRAIN = 1.05;

const cyc = (t, c, ph = 0) => (TAU * c * t) / 8.0 + ph;

function curtainHemAt(c, n, s, t) {
  const x = s + c.fold * Math.sin((TAU * s) / c.flam + cyc(t, c.c[0], n * 2)) + 5 * Math.sin((TAU * s) / 64 + cyc(t, c.c[2], n));
  const hem = c.y + c.slope * s + c.amp * Math.sin((TAU * s) / c.lam + cyc(t, c.c[1], n * 1.7)) + c.rip * Math.sin((TAU * s) / 23 - cyc(t, 5, n));
  return [x, hem];
}

// Accumulate one soft folding aurora curtain into `I` and `HV` (adapted from `src/fx/weather/aurora.js`)
function accumulateCurtain(c, n, t, F, breath, emergeMask, unfurlHeadX, rays) {
  const X0 = -OX, Y0 = -OY;
  const fast = (256 * 1.6 * t) / 8.0, slow = (256 * 0.8 * t) / 8.0;
  let p1 = 0, p2 = 0, lastX = -999;

  for (let s = c.s0; s < c.s1; s += 0.75) {
    const [x, hem] = curtainHemAt(c, n, s, t);
    if (x < X0 - 2 || x >= X0 + W + 1) continue;

    const xUnfurl = 1 - smooth(unfurlHeadX - 55, unfurlHeadX + 12, x);
    const env = smooth(c.s0, c.s0 + 55, s) * (1 - smooth(c.s1 - 65, c.s1, s)) * xUnfurl * emergeMask;
    if (env <= 0.01) continue;

    const r1 = clamp((sample(F, s * 5 - fast + n * 40, 10 + n * 30) - 0.38) * 3.2);
    const r2 = clamp((sample(F, s * 4.3 + fast * 0.7 + n * 90, 50 + n * 13) - 0.35) * 3.0);
    const patch = sample(F, s * 0.7 + slow + n * 17, 80 + n * 9);
    const k = c.k * 1.5 * env * breath * (0.22 + 0.78 * r1) * (0.32 + 1.35 * Math.max(0, patch - 0.3));
    if (k < 0.01) continue;

    const h = c.height * (0.45 + 0.75 * r2) * (0.75 + 0.5 * patch);
    const xi = Math.floor(x - X0), fr = x - X0 - xi;
    const waveHue = c.hue + 0.24 * Math.sin((TAU * s) / 170 - cyc(t, 1.5, n * 1.3));

    if (p1 > 0.76 && p1 >= p2 && p1 >= r1 && Math.abs(x - lastX) > 2.5 && k > 0.26) {
      rays.push({ x, hem: hem - 1, h: h * 0.88, k: Math.min(0.72, k * 0.78), hue: clamp(waveHue, 0, 1) });
      lastX = x;
    }
    p2 = p1;
    p1 = r1;
    if (xi < -1 || xi >= W) continue;

    const top = Math.max(0, Math.floor(hem - h - Y0));
    const bot = Math.min(SKY_H - 1, Math.floor(hem - Y0) + 3);
    const inv = 1 / h, k0 = k * 0.5 * (1 - fr), k1 = k * 0.5 * fr;
    let v = (hem - Y0 - 0.5 - top) * inv;

    for (let yi = top; yi <= bot; yi++, v -= inv) {
      const pr = v >= 0 ? PROF[Math.min(200, (v * 200) | 0)] : Math.max(0, 0.42 + v * h * 0.16);
      if (pr <= 0) continue;
      const o = yi * W + xi;
      const hv = clamp(v * 0.85 + waveHue, 0, 1);
      if (xi >= 0) {
        I[o] += k0 * pr;
        HV[o] += k0 * pr * hv;
      }
      if (xi + 1 < W) {
        I[o + 1] += k1 * pr;
        HV[o + 1] += k1 * pr * hv;
      }
    }
  }
}

// 1. STARFIELD BACKGROUND (`weather/aurora.js` style: dim specks, steady stars, soft twinkling glints)
function drawStarfield(q, t, S, G, U) {
  const skyEnv = smooth(0.0, 0.35, t) * (1 - smooth(4.02, 4.46, t));
  if (skyEnv <= 0.02) return;

  for (let i = 0; i < 110; i++) {
    const x = -OX + rand(S, i, 1) * W;
    const y = -OY + rand(S, i, 2) * (OY - 8);
    const r = rand(S, i, 3), c = 1 + Math.floor(rand(S, i, 4) * 4);
    const tw = (0.5 + 0.5 * Math.sin(cyc(t, c, rand(S, i, 5) * TAU))) * skyEnv;
    const col = r < 0.6 ? mix(U[3], WHITE, 0.2) : r < 0.9 ? mix(U[5], WHITE, 0.5) : WHITE;

    if (r < 0.65) {
      q.dot(x, y, col, (0.32 + 0.48 * tw) * skyEnv);
    } else if (r < 0.94) {
      q.dot(x, y, col, skyEnv);
      q.glow(x + 0.5, y + 0.5, 2.5, U[5], 0.22 * tw);
    } else {
      sparkle(q, x, y, 1 + Math.round(tw * 2), mix(U[5], WHITE, 0.6), U[4], 0.30 * tw);
    }
  }
}

// 2. SOFT AURORA CURTAINS & FLOWING GROUND REFLECTIONS
function drawAuroraAndGroundReflections(p, q, t, S, G, U) {
  const emergeMask = smooth(0.02, 0.68, t) * (1 - smooth(3.85, 4.45, t));
  if (emergeMask <= 0.01) return;

  const B = box(meta);
  const unfurlProgress = ease.outCubic(clamp((t - 0.02) / 0.88));
  const unfurlHeadX = lerp(-165, 210, unfurlProgress);

  I.fill(0);
  HV.fill(0);
  COL_LIGHT.fill(0);
  COL_HUE.fill(0);

  const F = getField(S);
  const breath = 0.78 + 0.22 * Math.sin(cyc(t, 1.2, -0.8));
  const rays = [];

  for (let n = 0; n < CURTAINS.length; n++) {
    accumulateCurtain(CURTAINS[n], n, t, F, breath, emergeMask, unfurlHeadX, rays);
  }
  blurSky(I, BL, 4);

  const GM = G.map((g, i) => mix(g, U[i], 0.5));

  // Sky pass (`y in [-152 .. -27]`): identical soft shading to `weather/aurora.js`
  rows(p, meta, B.y0, B.y0 + SKY_H - 1, (y, R) => {
    const yi = Math.floor(y) - B.y0;
    const base = yi * W, by = (Math.floor(y) & 3) << 2;
    for (let xi = 0; xi < W; xi++) {
      const i = base + xi, raw = I[i], bl = BL[i];
      if (bl > 0.01) {
        COL_LIGHT[xi] += bl * 0.022;
        if (raw > 0.02) COL_HUE[xi] += HV[i] * 0.022;
      }
      let k = bl > 0.015 ? Math.min(0.36, bl * 0.55) : 0;
      if (raw >= 0.03) {
        const e = (raw * 1.45) / (1 + raw * 1.45);
        const v = HV[i] / raw;
        const th = e > 0.45 ? BAY[by | (xi & 3)] * 0.06 : 0;
        let lv = e > 0.86 + th ? 6 : e > 0.72 + th ? 5 : e > 0.56 + th ? 4 : e > 0.40 + th ? 3 : e > 0.24 ? 2 : 1;
        if (v > 0.35) lv = Math.min(lv, 5);
        const c = v < 0.32 ? G[lv] : v < 0.54 ? GM[lv] : U[lv];
        if (lv >= 3) {
          R.c[xi] = c;
          R.a[xi] = clamp((e - 0.30) * 2.0) * emergeMask;
          R.b[xi] = lv < 5 ? 1 : 0;
        }
        R.l[xi] = lv >= 3 ? (v < 0.42 ? G[4] : U[4]) : c === G[lv] ? G[4] : c === U[lv] ? U[4] : GM[4];
        k += e * (lv >= 3 ? 0.24 : 0.62);
      } else {
        R.l[xi] = G[4];
      }
      R.k[xi] = k * emergeMask;
    }
  });

  // Fine 1-pixel vertical ray strands & soft hem points (`weather/aurora.js` lines 88-94)
  for (const r of rays) {
    const n = Math.round(r.h);
    const cLow = r.hue < 0.38 ? G[5] : r.hue < 0.62 ? GM[5] : U[5];
    const cMid = mix(G[5], U[5], 0.55);
    const cTop = U[5];
    for (let j = 1; j < n; j++) {
      const u = j / n;
      q.blend(r.x, r.hem - j, u < 0.35 ? cLow : u < 0.62 ? cMid : cTop, r.k * (1 - u) ** 1.35);
    }
    q.blend(r.x, r.hem, r.hue < 0.45 ? G[6] : U[6], Math.min(0.85, r.k * 1.1));
  }

  // Ground reflection pass (`y in [0 .. 27]` — "地面被极光映照出流动彩色光影"):
  // Smooth, broad, velvety pools of emerald and magenta-violet light gliding across the stone floor
  const gEnv = smooth(0.18, 0.85, t) * (1 - smooth(3.85, 4.44, t));
  if (gEnv > 0.01) {
    for (let xi = 0; xi < W; xi++) {
      const sxi = clamp(xi, 2, W - 3);
      const colL = (COL_LIGHT[sxi - 2] + COL_LIGHT[sxi] * 2 + COL_LIGHT[sxi + 2]) * 0.25;
      const colH = (COL_HUE[sxi - 2] + COL_HUE[sxi] * 2 + COL_HUE[sxi + 2]) * 0.25;
      GX_HUE[xi] = colH / Math.max(0.02, colL) + 0.22 * Math.sin(xi * 0.036 - t * 1.7);
      GX_RIP[xi] = colL * 0.44 * (0.68 + 0.32 * Math.sin(xi * 0.042 + t * 1.9));
    }

    rows(p, meta, 0, B.y1 - 1, (y, R) => {
      const py = Math.floor(y);
      const depthU = py / Math.max(1, B.y1 - 1);
      const depthEnv = (0.48 + 0.52 * Math.sin(depthU * Math.PI * 0.85)) * gEnv;
      const rowDrift = Math.round(Math.sin(py * 0.14 - t * 1.6) * 7);
      const isTileRow = py === 0 || py % 5 === 0;

      for (let xi = 0; xi < W; xi++) {
        const sxi = clamp(xi + rowDrift, 0, W - 1);
        const k = Math.min(0.28, GX_RIP[sxi] * depthEnv);
        if (k <= 0.01) continue;

        const avgHue = GX_HUE[sxi];
        const lCol = avgHue < 0.38 ? G[4] : avgHue < 0.62 ? GM[4] : U[4];
        R.l[xi] = lCol;
        R.k[xi] = k;

        if (isTileRow && (py === 0 || k > 0.09)) {
          R.c[xi] = py === 0 ? lCol : avgHue < 0.38 ? G[3] : avgHue < 0.62 ? GM[3] : U[3];
          R.a[xi] = Math.min(0.36, k * 1.3);
          R.b[xi] = 1;
        }
      }
    });
  }
}

// 3. DELICATE GLOWING STARDUST DRIFTING FROM THE AURORA & DISSIPATING ON THE GROUND
//    ("到极光内部抖落无数发光星尘" + "星尘落地消散的持续特效")
function drawSoftStardustAndLanding(q, t, S, G, U, C) {
  if (t < 0.58 || t >= 4.45) return;
  const nMotes = 48;

  for (let i = 0; i < nMotes; i++) {
    const cycleIdx = Math.floor((t - 0.58) / 1.32);
    for (let c = Math.max(0, cycleIdx - 1); c <= cycleIdx; c++) {
      const tBirth = 0.58 + c * 1.22 + rand(S, i, c + 10) * 1.15;
      if (tBirth > 3.45) continue;
      const fallDur = 0.92 + rand(S, i, c + 20) * 0.48;
      const lingerDur = 0.60;
      const age = t - tBirth;
      if (age < 0 || age >= fallDur + lingerDur) continue;

      const cIdx = (i + c) % 2 === 0 ? 1 : 2;
      const curt = CURTAINS[cIdx];
      const sParam = lerp(curt.s0 + 32, curt.s1 - 32, rand(S, i, c + 30));
      const [xStart, yStart] = curtainHemAt(curt, cIdx, sParam, tBirth);
      if (xStart < -OX + 12 || xStart > OX - 12) continue;

      const yLand = 2 + rand(S, i, c + 40) * 21; // Ground plane `y in [2..23]`
      const colMain = i % 3 === 0 ? G[5] : i % 3 === 1 ? U[5] : C[4];
      const colGlow = i % 3 === 0 ? G[4] : i % 3 === 1 ? U[4] : C[3];

      if (age < fallDur) {
        const u = age / fallDur;
        const fade = smooth(0, 0.14, u) * (1 - smooth(0.88, 1.0, u) * 0.2);
        const sway = Math.sin(u * TAU * 1.4 + i * 2.3) * (5 + (i % 3) * 2);
        const x = xStart + sway;
        const y = lerp(yStart + 2, yLand, ease.inOutSine(u));
        const tw = (0.48 + 0.52 * Math.sin(t * 16 + i * 4.1)) * fade;

        for (let k = 1; k <= 2; k++) {
          const pu = Math.max(0, u - k * 0.042);
          const px = xStart + Math.sin(pu * TAU * 1.4 + i * 2.3) * (5 + (i % 3) * 2);
          const py = lerp(yStart + 2, yLand, ease.inOutSine(pu));
          q.dot(px, py, colGlow, (0.42 / k) * tw);
        }

        q.dot(x, y, mix(colMain, WHITE, 0.45), 0.62 + 0.38 * tw);
        q.glow(x + 0.5, y + 0.5, 2.5, colGlow, 0.26 * tw);
        if (tw > 0.74 && (i + c) % 3 === 0) {
          sparkle(q, x, y, 2, colMain, colGlow, 0.28 * tw);
        }
      } else {
        // Soft, dreamy landing ripple & dissipating glimmer on the ground ("星尘落地消散的持续特效")
        const lu = (age - fallDur) / lingerDur;
        const fade = (1 - lu) * (1 - lu);
        const lx = xStart + Math.sin(TAU * 1.4 + i * 2.3) * (5 + (i % 3) * 2);
        const ly = yLand;

        const rx = 1.5 + (7.0 + (i % 3) * 2.5) * ease.outCubic(lu);
        const ry = rx * 0.26;
        const nDots = 10;
        for (let k = 0; k < nDots; k++) {
          const a = (k / nDots) * TAU + i * 0.7;
          const dx = lx + Math.cos(a) * rx;
          const dy = ly + Math.sin(a) * ry;
          q.blend(dx, dy, colMain, fade * 0.38);
        }
        q.glow(lx, ly, 4, colGlow, 0.22 * fade);

        if (lu < 0.75) {
          const mf = 1 - lu / 0.75;
          q.dot(lx, ly - lu * 4, colMain, mf * 0.80);
        }
      }
    }
  }
}

// 4. LONG-TAILED SHOOTING STARS (`weather/shooting-stars.js` `meteor()` renderer)
function drawMeteor(q, age, m, i, S, C, G, U) {
  if (age < 0) return;
  const ca = Math.cos(m.a), sa = Math.sin(m.a);
  const end = m.life + (m.flare ? 0.45 : 0) + TRAIN;
  if (age > end) return;

  const pos = (tt) => [m.x + ca * m.v * tt, m.y + sa * m.v * tt];
  const burn = Math.min(age, m.life);
  const [hx, hy] = pos(burn);

  const trainK = age < m.life ? 1 : 1 - (age - m.life) / (TRAIN + (m.flare ? 0.45 : 0));
  if (trainK > 0) {
    const len = m.v * burn, nx = -sa, ny = ca;
    const trainColA = i % 2 === 0 ? C[2] : U[4];
    const trainColB = i % 2 === 0 ? C[1] : G[3];
    for (let d = 0; d < len; d += 1) {
      const passed = age - d / m.v;
      if (passed < 0.08) continue;
      const g = trainK * Math.min(1, (passed - 0.08) * 4) * (0.35 + 0.65 * Math.sin((Math.PI * d) / len)) * m.s;
      const tw = Math.sin(d * 0.09 + passed * 1.7) * Math.min(3.5, passed * 2.8);
      const x = m.x + ca * d + nx * tw + passed * 3.5;
      const y = m.y + sa * d + ny * tw;
      if (y > -2) continue;
      q.dot(x, y, passed < 0.55 ? trainColA : trainColB, g * 0.68);
      if (d % 8 === 0) q.glow(x, y, 4.5 + passed * 3, trainColB, 0.10 * g);
    }
  }

  if (age > m.life + (m.flare ? 0.45 : 0)) return;

  const u = age / m.life;
  const k = age < m.life ? Math.min(1, u * 5.5) * (u > 0.72 ? 1 - (u - 0.72) / 0.28 : 1) : 0;
  if (k > 0 && hy < -2) {
    const L = (28 + 38 * m.s) * Math.min(1, u * 2.8);
    const ramp = i % 3 === 0 ? [G[2], G[4], C[3], C[4], WHITE] : [C[1], C[2], C[3], C[4], WHITE];
    const revRamp = ramp.slice().reverse();
    for (let d = 0; d <= L; d += 0.5) {
      const v = d / L;
      const x = hx - ca * d, y = hy - sa * d;
      if (y > -2) continue;
      q.dot(x, y, v < 0.08 ? WHITE : at(revRamp, v * 0.95), k * (v < 0.58 ? 0.92 : ((1 - v) / 0.42) * 0.92));
      if (m.s > 0.9 && v < 0.38) {
        q.dot(x - sa * 0.9, y + ca * 0.9, v < 0.15 ? C[4] : C[3], k * (1 - v / 0.38) * 0.75);
      }
    }
    q.px(hx, hy, WHITE);
    if (m.s > 0.95) {
      q.dot(hx + 1, hy, C[4], 0.85);
      q.dot(hx, hy + 1, C[4], 0.85);
    }
    q.glow(hx, hy, 7 + 8 * m.s, C[4], 0.36 * k);
    q.glow(hx - ca * L * 0.3, hy - sa * L * 0.3, 8 + 7 * m.s, C[3], 0.16 * k);
  }

  if (!m.flare || age < m.life * 0.82) return;
  const f = (age - m.life * 0.82) / (m.life * 0.18 + 0.45);
  const [fx, fy] = pos(m.life * 0.86);
  if (fy > -6) return;

  if (f < 0.35) {
    sparkle(q, fx, fy, 7 * Math.sin((Math.PI * f) / 0.35) + 2, C[4], C[3], 0.45);
    q.glow(fx, fy, 22, C[3], 0.32 * (1 - f / 0.35));
  }
  for (let j = 0; j < 6; j++) {
    const ang = rand(S, i, j, 5) * TAU, r = 5 + rand(S, i, j, 6) * 14, d0 = rand(S, i, j, 7) * 0.28;
    const g = (f - d0) / 0.45;
    if (g <= 0 || g >= 1) continue;
    const sx = fx + Math.cos(ang) * r * (0.6 + g * 0.5);
    const sy = fy + Math.sin(ang) * r * (0.6 + g * 0.5) - g * 3;
    const arm = Math.round(2.2 * Math.sin(Math.PI * g));
    if (arm >= 1) sparkle(q, sx, sy, arm, j % 2 ? C[4] : G[5], C[3], 0.25 * (1 - g));
    else q.dot(sx, sy, C[4], 1 - g);
  }
  for (let j = 0; j < 3; j++) {
    const da = (rand(S, i, j, 1) - 0.5) * 0.45, sp = m.v * (0.48 + rand(S, i, j, 2) * 0.35);
    const tt = f * (m.life * 0.18 + 0.45), g = 1 - f;
    if (g <= 0) continue;
    const x = fx + Math.cos(m.a + da) * sp * tt, y = fy + Math.sin(m.a + da) * sp * tt;
    if (y > -4) continue;
    q.line(x - Math.cos(m.a + da) * 4 * g, y - Math.sin(m.a + da) * 4 * g, x, y, C[3], g * 0.8);
    q.dot(x, y, g > 0.5 ? WHITE : C[4], g);
    q.glow(x, y, 4, C[3], 0.24 * g);
  }
}

export function draw(p, t, o) {
  if (t >= T_END - 0.03) return;
  const q = clip(p, meta);
  const S = o.seed;
  const G = fit(o.emerald, 7);
  const U = fit(o.magenta, 7);
  const C = fit(o.starlight, 6);

  // 1. Starry night sky
  drawStarfield(q, t, S, G, U);
  // 2. Soft, folding Emerald & Magenta-Violet aurora curtains (`weather/aurora` architecture) + flowing ground reflections
  drawAuroraAndGroundReflections(p, q, t, S, G, U);
  // 3. Delicate glowing stardust drifting down from inside the aurora & dissipating on the ground
  drawSoftStardustAndLanding(q, t, S, G, U, C);
  // 4. Long-tailed shooting stars slicing across the sky (`weather/shooting-stars` architecture)
  for (let i = 0; i < METEORS.length; i++) {
    drawMeteor(q, t - METEORS[i].t0, METEORS[i], i, S, C, G, U);
  }
}
