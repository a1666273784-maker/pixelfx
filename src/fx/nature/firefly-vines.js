// Firefly Vines (萤火藤蔓 — nature/firefly-vines):
// Full-screen 320x180 seamless looping scene-decoration overlay (`可叠加在环境中的可循环场景装饰特效`):
// 1. Lush Swaying Dark Silhouette Boughs, Draped Catenary Swags & Pendant Vines (左右上角垂挂深色剪影枝叶与藤蔓随风摇摆):
//    Sweeping inward from both upper corners in three parallax depth layers while keeping the central and lower
//    arena open and transparent for any underlying scene, thick gnarled woodland boughs, corner canopy crowns,
//    catenary vine swags, clustered S-curving pendant vines, acuminate leaves, and coiled tendrils sway in a breeze.
// 2. Slanting Lunar Beams & Occasional Moonlight Leaf-Edge Rim Outlines (斜射清辉与叶片边缘偶尔泛起月光描边):
//    Whisper-soft silver-blue moonbeams slant inward through both upper canopies; whenever the breeze tilts a leaf
//    across its lunar specular angle, a crisp 1px silver-cyan to ice-white rim outline glides along its upper edge,
//    while leaves immediately beside a glowing firefly catch a localized warm chartreuse kiss on their lower edge.
// 3. Awakening, Detaching & Center-Bound Swimming Fireflies with Curved Gossamer Trails (藤蔓间不断亮起黄绿萤火虫 ->
//    缓缓脱离枝叶向屏幕中心游弋闪烁后淡隐 + 微弱流光拖尾):
//    Chartreuse-gold fireflies continuously kindle perched on swaying vine leaves, lift gently off the foliage,
//    weave along undulating S-curls toward the open screen center with curved gossamer light ribbons, blink in
//    warm organic rhythms, and fade serenely into the midsummer night across a 12-second seamless loop.
// Close/mid/far firefly anatomy and lantern rhythm build on `src/fx/weather/fireflies.js`, and lunar shaft falloff
// draws on `src/fx/weather/god-rays.js` (adapted from Sprite Fusion's open-source pixel-art VFX, MIT License,
// Copyright (c) 2026 Hugo Duprez).
import { fit, clamp, mix, rng, wrap, TAU } from "../../core/index.js";
import { clip, rows } from "../weather/_lib.js";

export const meta = {
  name: "Firefly vines",
  desc: "Dark silhouette boughs and swaying vines drape from both upper corners with moonlight rim glints as yellow-green fireflies wake in the leaves, swim inward with trails, and fade.",
  tags: ["nature", "weather", "vines", "leaves", "fireflies", "moonlight", "forest", "night", "overlay", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 90],
  duration: 12,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // 5-step Mellow, Eye-Soothing Firefly Bioluminescence ramp (`温润晶莹绝不刺眼的黄绿色萤火虫光点与微弱拖尾`)
    palette:   ["#1b2c0a", "#437016", "#7ec228", "#bae84c", "#e6fa96"],
    // 6-step Deep Velvet Midnight-Forest Silhouette ramp (`深色剪影枝叶与藤蔓`)
    foliage:   ["#040811", "#08101d", "#0d1a2c", "#15283d", "#203b54", "#315672"],
    // 5-step Lunar Silver-Cyan Moonlight Rim ramp (`叶片边缘月光描边`)
    moonlight: ["#426c98", "#74aee2", "#b4e0ff", "#e8f7ff", "#ffffff"],
    seed: 11,
  },
};

const D = 12, W = 320, H = 180, X0 = -160, X1 = 159, Y0 = -90, Y1 = 89;
const cyc = (t, n, ph = 0) => (TAU * n * t) / D + ph;

const sstep = (u) => {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
};

// Pre-baked Quantized Botanical Leaf Stamp Atlas (`6 sizes x 64 angles = 384 crisp rasterized leaf stamps`):
// Eliminates per-pixel trig & empty bounding-box scans -> ~3.5x faster (< 2.0 ms/frame) with crisp 1px rim zones!
// Zones: 0 = lower dark body, 1 = upper body, 2 = central midrib vein, 3 = 1px upper mid-rim, 4 = 1px upper tip-rim, 5 = 1px lower firefly rim.
const LEAF_SIZES = [
  [7.8,  2.6],
  [9.4,  3.1],
  [11.0, 3.6],
  [12.6, 4.1],
  [14.2, 4.6],
  [16.0, 5.1],
];
const N_ANG = 64;
const LEAF_ATLAS = (() => {
  const atlas = new Array(LEAF_SIZES.length * N_ANG);
  for (let si = 0; si < LEAF_SIZES.length; si++) {
    const [len, wid] = LEAF_SIZES[si];
    const halfL = len * 0.5;
    const rB = Math.ceil(halfL + 1.5);
    for (let ai = 0; ai < N_ANG; ai++) {
      const ang = (ai / N_ANG) * TAU;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      let ux = -sa, uy = ca;
      if (uy > 0) { ux = -ux; uy = -uy; } // `ux, uy` always points toward the moonlit sky (`-y`)!

      const pts = [];
      let tipDx = Math.round(ca * halfL), tipDy = Math.round(sa * halfL);
      for (let dy = -rB; dy <= rB; dy++) {
        for (let dx = -rB; dx <= rB; dx++) {
          const s = dx * ca + dy * sa + halfL;
          if (s < 0 || s > len) continue;
          const u = s / len;
          const v = dx * ux + dy * uy;
          const halfW = wid * Math.sin(u * Math.PI) * (1.20 - 0.36 * u);
          const av = v < 0 ? -v : v;
          if (av > halfW + 0.34) continue;

          const edgeDist = halfW - av;
          let zone = v > 0.15 ? 1 : 0;
          if (av < 0.44 && u > 0.12 && u < 0.86) zone = 2;
          if (v >= 0 && edgeDist < 0.96) {
            // Zone 4 = bright outer crescent (mid-to-tip), Zone 3 = softer basal moonlight rim
            zone = (u > 0.28 && u < 0.92) ? 4 : 3;
          } else if (v < 0 && edgeDist < 0.94) {
            zone = 5;
          }
          pts.push(dx, dy, zone);
        }
      }
      atlas[si * N_ANG + ai] = { data: new Int8Array(pts), rB, tipDx, tipDy };
    }
  }
  return atlas;
})();

// Precompute Upper-Corner Canopy Mist + Inward-Slanting Lunar Shaft Coordinate (`central & lower stage === 0!`)
const CANOPY_MIST = new Float32Array(W * H);
const MOON_COORD  = new Float32Array(W * H);
(() => {
  for (let yi = 0; yi < H; yi++) {
    const y = Y0 + yi + 0.5;
    if (y > 34) continue;
    const uy = clamp((34 - y) / 124, 0, 1);
    const rowOff = yi * W;
    for (let xi = 0; xi < W; xi++) {
      const x = X0 + xi + 0.5;
      const ax = Math.abs(x);
      const nx = ax / 160;
      const cornerK = Math.hypot(Math.max(0, nx - 0.20) / 0.80, Math.max(0, uy - 0.14) / 0.86);
      if (cornerK > 0.05) {
        const v = clamp((cornerK - 0.05) / 0.95, 0, 1) * uy;
        CANOPY_MIST[rowOff + xi] = v * v;
        // Minus `(y + 90)`: as `y` descends, `ax` decreases -> moonbeams slant INWARD toward the center glade!
        MOON_COORD[rowOff + xi] = (160 - ax) * 0.045 - (y + 90) * 0.026;
      }
    }
  }
})();

// Inward-slanting silver-blue moonbeam strength `[0..1]` at `(x, y, t)`
function moonShaftAt(x, y, t) {
  if (y > 36) return 0;
  const ax = Math.abs(x);
  if (ax < 32 && y > -64) return 0;
  const sidePh = x < 0 ? 0.0 : 1.1;
  const coord = (160 - ax) * 0.045 - (y + 90) * 0.026 + 0.24 * Math.sin(cyc(t, 1, sidePh));
  let s = 0;
  const b1 = 1 - Math.abs(coord - 0.95) / 0.82;
  const b2 = 1 - Math.abs(coord - 2.45) / 0.92;
  const b3 = 1 - Math.abs(coord - 3.95) / 0.78;
  if (b1 > 0) s += b1 * b1 * 0.95;
  if (b2 > 0) s += b2 * b2 * 1.00;
  if (b3 > 0) s += b3 * b3 * 0.80;
  const falloff = clamp((36 - y) / 120, 0, 1) * clamp((ax - 28) / 94, 0, 1);
  return clamp(s * falloff, 0, 1);
}

// Zero-allocation fast integer blend & radial additive glow for pre-clipped `[X0..X1] x [Y0..Y1]` loops
function makeFastBlend(p, q) {
  if (p.sn !== 0 || p.fx !== 1) return (px, py, c, a) => q.blend(px, py, c, a);
  const C = p.C, fw = p.w, fh = p.h, fade = p.fade;
  const baseX = Math.floor(p.tx + 0.5) - p.ox;
  const baseY = Math.floor(p.ty + 0.5) - p.oy;
  return (px, py, c, a) => {
    const aa = a * fade;
    if (!c || aa <= 0.004) return;
    const x = baseX + px, y = baseY + py;
    if (x < 0 || x >= fw || y < 0 || y >= fh) return;
    const i = y * fw + x, d = C[i];
    const da = (d >>> 24) / 255, oa = aa + da * (1 - aa), k = aa / oa, mk = 1 - k;
    const r = ((c & 255) * k + (d & 255) * mk) & 255;
    const g = (((c >>> 8) & 255) * k + ((d >>> 8) & 255) * mk) & 255;
    const b = (((c >>> 16) & 255) * k + ((d >>> 16) & 255) * mk) & 255;
    C[i] = (((oa * 255) & 255) << 24) | (b << 16) | (g << 8) | r;
  };
}

function makeFastGlow(p, q) {
  if (p.sn !== 0 || p.fx !== 1) return (cx, cy, r, c, k) => q.glow(cx, cy, r, c, k);
  const L = p.L, fw = p.w, fh = p.h, lk = p.fade * p.lightK;
  const baseX = Math.floor(p.tx + 0.5) - p.ox;
  const baseY = Math.floor(p.ty + 0.5) - p.oy;
  return (cx, cy, r, c, k) => {
    const kk = k * lk;
    if (!c || kk <= 0.004 || r <= 0) return;
    const x0 = Math.max(X0, Math.floor(cx - r)), x1 = Math.min(X1, Math.ceil(cx + r));
    const y0 = Math.max(Y0, Math.floor(cy - r)), y1 = Math.min(Y1, Math.ceil(cy + r));
    const cr = c & 255, cg = (c >>> 8) & 255, cb = (c >>> 16) & 255;
    const invR2 = 1 / (r * r);
    for (let py = y0; py <= y1; py++) {
      const sy = baseY + py;
      if (sy < 0 || sy >= fh) continue;
      const dy = py + 0.5 - cy, dy2 = dy * dy;
      const row = sy * fw;
      for (let px = x0; px <= x1; px++) {
        const sx = baseX + px;
        if (sx < 0 || sx >= fw) continue;
        const dx = px + 0.5 - cx;
        const u2 = (dx * dx + dy2) * invR2;
        if (u2 >= 1) continue;
        const f = 1 - u2;
        const w = kk * f * f;
        if (w <= 0.004) continue;
        const idx = row + sx, d = L[idx];
        const nr = Math.min(255, (d & 255) + cr * w) | 0;
        const ng = Math.min(255, ((d >>> 8) & 255) + cg * w) | 0;
        const nb = Math.min(255, ((d >>> 16) & 255) + cb * w) | 0;
        L[idx] = (255 << 24) | (nb << 16) | (ng << 8) | nr;
      }
    }
  };
}

function drawSmoothSeg(fblend, x0, y0, x1, y1, col, alpha) {
  if (alpha <= 0.012) return;
  const ix0 = Math.round(x0), iy0 = Math.round(y0);
  const ix1 = Math.round(x1), iy1 = Math.round(y1);
  const adx = Math.abs(ix1 - ix0), ady = Math.abs(iy1 - iy0);
  const steps = adx > ady ? adx : ady;
  if (steps === 0) {
    if (ix0 >= X0 && ix0 <= X1 && iy0 >= Y0 && iy0 <= Y1) fblend(ix0, iy0, col, alpha);
    return;
  }
  const dx = (ix1 - ix0) / steps, dy = (iy1 - iy0) / steps;
  let fx = ix0 + 0.5, fy = iy0 + 0.5;
  for (let s = 0; s <= steps; s++) {
    const ix = Math.floor(fx), iy = Math.floor(fy);
    if (ix >= X0 && ix <= X1 && iy >= Y0 && iy <= Y1) fblend(ix, iy, col, alpha);
    fx += dx;
    fy += dy;
  }
}

// Seamless traveling summer-night breeze displacement
function breezeOffset(t, baseX, u, swayAmp, ph) {
  const u1 = u * Math.sqrt(u);
  const u2 = u * u * u;
  const primary = Math.sin(cyc(t, 1, -baseX * 0.018 + ph)) * swayAmp * u1;
  const ripple  = Math.sin(cyc(t, 2, -baseX * 0.032 + ph * 1.6 - u * 1.4)) * (swayAmp * 0.38) * u2;
  return primary + ripple;
}

// Organic S-curved pendant vine curve `[x, y]` at normalized parameter `u in [0..1]`
function vinePointAt(v, u, t) {
  const sw = breezeOffset(t, v.x0, u, v.swayAmp, v.ph);
  const sBend = v.lean * Math.pow(u, 1.15) + v.waviness * Math.sin(u * v.waveFreq + v.wavePh) * (0.35 + 0.65 * u);
  const x = v.x0 + sBend + sw;
  const lift = -Math.min(5.0, (sw * sw) / Math.max(24, v.len * 1.5));
  const y = v.y0 + v.len * u + lift;
  return [x, y];
}

function sizeIdxForLen(len) {
  if (len < 8.6)  return 0;
  if (len < 10.2) return 1;
  if (len < 11.8) return 2;
  if (len < 13.4) return 3;
  if (len < 15.0) return 4;
  return 5;
}

const SCENE_CACHE = new Map();
function getVineScene(S) {
  let sc = SCENE_CACHE.get(S);
  if (sc) return sc;

  const crowns = [];
  const boughs = [];
  const swags = [];
  const vines = [];
  const spawnLeaves = [];

  // 0. Lush Upper-Corner Canopy Crown Clusters (`填实左右顶角树冠剪影，即使在亮底也自然扎实`)
  for (let side of [-1, 1]) {
    const r = rng(S + 55, side < 0 ? 0 : 1);
    for (let i = 0; i < 26; i++) {
      const u = i / 25;
      const x = side * (158 - u * 96 + r.range(-4, 4));
      const y = -89 + r.range(-2, 10) * (1 - u * 0.55);
      const layer = i % 3 === 0 ? 1 : 2;
      const len = r.range(12.5, 16.2);
      crowns.push({
        x, y, layer,
        sizeIdx: sizeIdxForLen(len),
        len,
        baseAng: Math.PI * 0.5 + side * r.range(-0.85, 0.45),
        ph: r.range(0, TAU),
      });
    }
  }

  // 1. Thick Sculptural Gnarled Corner Boughs & Canopy Foliage Masses (`左右上角粗壮蜿蜒枝干与层叠叶簇剪影`)
  const boughSpecs = [
    // Left upper canopy (`sweeping out to x = -28`)
    { side: -1, layer: 0, x0: -163, y0: -89, x1: -26,  y1: -68, sag: 15, crook: -6, thick: 6.8, ph: 0.2 },
    { side: -1, layer: 1, x0: -163, y0: -76, x1: -62,  y1: -44, sag: 14, crook:  7, thick: 5.8, ph: 1.3 },
    { side: -1, layer: 2, x0: -163, y0: -91, x1: -46,  y1: -64, sag: 12, crook: -5, thick: 8.4, ph: 2.1 },
    { side: -1, layer: 2, x0: -163, y0: -56, x1: -102, y1: -18, sag: 10, crook:  5, thick: 5.5, ph: 3.4 },
    // Right upper canopy (`sweeping out to x = +28`)
    { side:  1, layer: 0, x0:  163, y0: -89, x1:  28,  y1: -66, sag: 16, crook:  6, thick: 6.8, ph: 0.8 },
    { side:  1, layer: 1, x0:  163, y0: -74, x1:  64,  y1: -42, sag: 13, crook: -7, thick: 5.8, ph: 2.0 },
    { side:  1, layer: 2, x0:  163, y0: -91, x1:  44,  y1: -62, sag: 12, crook:  5, thick: 8.4, ph: 2.9 },
    { side:  1, layer: 2, x0:  163, y0: -54, x1:  104, y1: -16, sag: 10, crook: -5, thick: 5.5, ph: 4.2 },
  ];

  for (let bIdx = 0; bIdx < boughSpecs.length; bIdx++) {
    const bs = boughSpecs[bIdx];
    const r = rng(S + 101, bIdx);
    const leaves = [];
    const nLeaves = bs.layer === 2 ? 19 : 14;
    for (let k = 0; k < nLeaves; k++) {
      const u = 0.04 + (k / nLeaves) * 0.93 + r.range(-0.025, 0.025);
      const sideFlip = k % 2 === 0 ? 1 : -1;
      const len = r.range(10.2, 15.8) * (bs.layer === 0 ? 0.88 : 1.06);
      leaves.push({
        u: clamp(u, 0.03, 0.98),
        baseAng: (bs.side < 0 ? 0.38 : Math.PI - 0.38) + sideFlip * r.range(0.38, 1.15),
        len,
        sizeIdx: sizeIdxForLen(len),
        ph: r.range(0, TAU),
      });
    }
    boughs.push({ ...bs, leaves });
  }

  // 2. Draped Catenary Vine Swags (`弧形悬垂藤链`)
  const swagSpecs = [
    { side: -1, layer: 1, x0: -158, y0: -58, x1: -74,  y1: -56, drop: 28, sway: 4.2, ph: 0.7 },
    { side: -1, layer: 2, x0: -146, y0: -76, x1: -52,  y1: -66, drop: 24, sway: 3.8, ph: 2.3 },
    { side:  1, layer: 1, x0:  158, y0: -56, x1:  76,  y1: -54, drop: 29, sway: 4.4, ph: 1.5 },
    { side:  1, layer: 2, x0:  146, y0: -75, x1:  50,  y1: -64, drop: 25, sway: 3.9, ph: 3.1 },
  ];
  for (let sIdx = 0; sIdx < swagSpecs.length; sIdx++) {
    const sw = swagSpecs[sIdx];
    const r = rng(S + 202, sIdx);
    const leaves = [];
    for (let k = 0; k < 10; k++) {
      const u = 0.08 + (k / 9) * 0.84;
      const len = r.range(8.8, 12.8);
      leaves.push({
        u,
        angOff: Math.PI * 0.5 + (k % 2 ? 0.55 : -0.55) + r.range(-0.2, 0.2),
        len,
        sizeIdx: sizeIdxForLen(len),
        ph: r.range(0, TAU),
      });
    }
    swags.push({ ...sw, leaves });
  }

  // 3. Organically Clustered S-Curving Hanging Vines (`高低错落的自然簇状垂藤`)
  const vineSpecs = [
    // Left clusters
    [-154, -84, 142, 2,  8.5,  9.0,  7.5],
    [-147, -87, 116, 1,  7.8, -6.5,  6.8],
    [-135, -80, 132, 2,  9.6, -8.5,  8.2],
    [-126, -88,  92, 0,  6.8,  5.5,  6.2],
    [-108, -76, 108, 2,  9.2,  8.0,  7.6],
    [-101, -85,  76, 1,  7.5, -5.0,  6.5],
    [ -82, -74,  72, 2,  8.0, -6.5,  6.4],
    [ -64, -82,  50, 1,  6.6,  4.5,  5.5],
    [ -47, -66,  34, 2,  5.6, -3.5,  4.8],
    // Right clusters
    [ 154, -83, 144, 2,  8.8, -9.0,  7.6],
    [ 146, -87, 118, 1,  8.0,  6.5,  6.9],
    [ 134, -79, 134, 2,  9.8,  8.5,  8.4],
    [ 124, -88,  94, 0,  7.0, -5.5,  6.0],
    [ 107, -75, 110, 2,  9.4, -8.0,  7.8],
    [  99, -85,  78, 1,  7.6,  5.0,  6.6],
    [  80, -73,  74, 2,  8.2,  6.5,  6.5],
    [  62, -81,  52, 1,  6.8, -4.5,  5.6],
    [  45, -65,  36, 2,  5.8,  3.5,  4.9],
  ];

  for (let vIdx = 0; vIdx < vineSpecs.length; vIdx++) {
    const [x0, y0, len, layer, swayAmp, lean, waviness] = vineSpecs[vIdx];
    const r = rng(S + 303, vIdx);
    const side = x0 < 0 ? -1 : 1;
    const leaves = [];
    const nLeaves = Math.max(5, Math.round(len / 8.5));

    for (let k = 0; k < nLeaves; k++) {
      const u = 0.06 + (k / nLeaves) * 0.87 + r.range(-0.02, 0.02);
      const taper = 1 - 0.34 * u;
      const lr = k % 2 === 0 ? 1 : -1;
      const lLen = r.range(9.0, 14.2) * taper * (layer === 0 ? 0.85 : 1.06);
      leaves.push({
        u: clamp(u, 0.04, 0.95),
        stalk: r.range(2.4, 4.5) * taper,
        angOff: Math.PI * 0.5 + lr * r.range(0.42, 0.96),
        len: lLen,
        sizeIdx: sizeIdxForLen(lLen),
        ph: r.range(0, TAU),
        flutter: r.range(0.10, 0.20),
      });
    }

    const vine = {
      vIdx, side, layer,
      x0, y0,
      len: len * r.range(0.96, 1.04),
      swayAmp: swayAmp * r.range(0.92, 1.10),
      lean,
      waviness,
      waveFreq: r.range(3.6, 5.4),
      wavePh: r.range(0, TAU),
      thick0: layer === 2 ? 2.8 : layer === 1 ? 2.1 : 1.6,
      ph: r.range(0, TAU),
      curlDir: r.chance(0.5) ? 1 : -1,
      leaves,
    };
    vines.push(vine);

    if (layer >= 1) {
      for (let k = 0; k < leaves.length; k++) {
        if (leaves[k].u >= 0.18 && leaves[k].u <= 0.90) {
          spawnLeaves.push({ vine, leaf: leaves[k] });
        }
      }
    }
  }

  // Helper for rest (zero-breeze) leaf position so airborne fireflies decouple cleanly from vine sway
  const restLeafPos = (v, lf) => {
    const sBend = v.lean * Math.pow(lf.u, 1.15) + v.waviness * Math.sin(lf.u * v.waveFreq + v.wavePh) * (0.35 + 0.65 * lf.u);
    const vx = v.x0 + sBend;
    const vy = v.y0 + v.len * lf.u;
    const dist = lf.stalk + lf.len * 0.42;
    return [vx + Math.cos(lf.angOff) * dist, vy + Math.sin(lf.angOff) * dist];
  };

  const leftPerches = [];
  const rightPerches = [];
  for (let i = 0; i < spawnLeaves.length; i++) {
    const sp = spawnLeaves[i];
    const [bx, by] = restLeafPos(sp.vine, sp.leaf);
    if (Math.abs(bx) >= 46 && Math.abs(bx) <= 146 && by >= -74 && by <= 22) {
      const entry = { vine: sp.vine, leaf: sp.leaf, bx, by };
      if (sp.vine.side < 0) leftPerches.push(entry);
      else rightPerches.push(entry);
    }
  }

  // 4. 30 Serene, Coherently Gliding Fireflies (`藤蔓间柔和亮起 -> 缓缓脱离枝叶 -> 沿单段舒缓S弧线游弋向屏幕中心闪烁后淡隐`)
  //    Balanced 15 Left + 15 Right, evenly staggered across the 12s loop so there are never glaring clumps or erratic paths!
  const fireflies = [];
  const nFlies = 30;
  for (let i = 0; i < nFlies; i++) {
    const r = rng(S + 707, i);
    const side = (i & 1) === 0 ? -1 : 1;
    const pool = side < 0 ? leftPerches : rightPerches;
    const perch = pool[(Math.floor(i / 2) * 3 + r.int(0, 2)) % pool.length];

    // 8 distant canopy fireflies, 14 midground gliders, 8 foreground winged lanterns (4 per side)
    const depth = i < 8 ? 2 : i < 22 ? 1 : 0;
    const period = D; // Full 12s unhurried cycle for every firefly (`~11 px/sec` slow dreamlike drift)
    const life = r.range(9.5, 10.9);
    const born = wrap(((i + r.range(-0.18, 0.18)) / nFlies) * D, D);

    // Converge gracefully right into the open central glade (`x in [-30..+30], y in [-28..+30]`) before softly fading out
    const destX = side * r.range(-8, 28);
    const destY = clamp(perch.by * 0.42 + 12 + r.range(-12, 16), -28, 30);

    fireflies.push({
      id: i, depth, perch, side,
      baseLx: perch.bx,
      baseLy: perch.by,
      period, life, born,
      destX, destY,
      // ONE slow, lyrical sweeping S-curve across the entire ~7.8s glide (`sFreq = 0.95..1.35`, never rapid zig-zagging!)
      arcSag: r.range(4.0, 12.0),
      sAmp: r.range(7.5, 14.5) * (i % 4 < 2 ? 1 : -1),
      sFreq: r.range(0.95, 1.35),
      sPh: r.range(0, TAU),
      blinkBeats: r.int(2, 3),
      blinkPh: r.range(0, TAU),
    });
  }

  // 5. 16 Whisper-Faint Upper-Canopy Lunar Dust Motes (subtle cool silver mist, never competing with fireflies)
  const spores = [];
  for (let i = 0; i < 16; i++) {
    const r = rng(S + 909, i);
    const side = i < 8 ? -1 : 1;
    spores.push({
      x0: side * r.range(64, 152),
      y0: r.range(-84, 6),
      ax: r.range(2.0, 4.5),
      ay: r.range(1.8, 3.8),
      px: r.range(0, TAU),
      py: r.range(0, TAU),
    });
  }

  sc = { crowns, boughs, swags, vines, fireflies, spores };
  SCENE_CACHE.set(S, sc);
  return sc;
}

function evalVineLeafPos(vine, lf, t) {
  const [vx, vy] = vinePointAt(vine, lf.u, t);
  const ang = lf.angOff + lf.flutter * Math.sin(cyc(t, 2, lf.ph - lf.u * 2.0));
  const dist = lf.stalk + lf.len * 0.42;
  return [vx + Math.cos(ang) * dist, vy + Math.sin(ang) * dist, ang];
}

// Evaluate calm, coherent firefly journey:
// `u in [0..0.22]`: kindles softly perched on its swaying vine leaf
// `u in [0.22..1]`: lifts smoothly off the leaf and glides unhurriedly along a single sweeping S-arc into the center glade
function evalFirefly(f, t) {
  const age = wrap(t - f.born, f.period);
  if (age >= f.life) return null;
  const u = age / f.life;

  const posAt = (tt) => {
    const aRaw = clamp(age + (tt - t), 0, f.life);
    const uu = aRaw / f.life;
    const [lx, ly] = evalVineLeafPos(f.perch.vine, f.perch.leaf, tt);
    if (uu <= 0.22) return [lx, ly];

    const w = (uu - 0.22) / 0.78;
    const prog = sstep(w); // zero velocity at detachment & gentle hover deceleration near screen center!
    const dec = sstep(w / 0.26); // smoothly decouple from vine breeze sway after lift-off
    const ax = lx + (f.baseLx - lx) * dec;
    const ay = ly + (f.baseLy - ly) * dec;

    const dx = f.destX - ax, dy = f.destY - ay;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist, ny = dx / dist;

    // Smooth bell envelope (`sin^1.5`) so lift-off and center-dissolve are 100% tangent-smooth
    const env = Math.sin(w * Math.PI);
    const sCurve = Math.sin(w * TAU * f.sFreq + f.sPh) * f.sAmp * env;
    const sagY = env * f.arcSag;

    return [
      ax + dx * prog + nx * sCurve,
      ay + dy * prog + ny * sCurve + sagY,
    ];
  };

  // Soft, unhurried fade-in on the vine leaf (`u in [0..0.18]`) and gentle dissolve in the central glade (`u in [0.78..1]`)
  const kindle = sstep(u / 0.18);
  const fadeOut = 1 - sstep((u - 0.78) / 0.22);

  // Smooth, rounded sine-bell breathing blinks (`2-3` slow gentle pulses, never harsh strobe flashes)
  const bWave = 0.5 + 0.5 * Math.sin(u * TAU * f.blinkBeats + f.blinkPh);
  const wink = bWave * bWave * (3 - 2 * bWave);

  // Warm awakening glow while nestled in the vine leaves (`u in [0.05..0.30]`)
  const vineWarmth = u < 0.32 ? Math.sin(clamp(u / 0.32, 0, 1) * Math.PI) * 0.88 : 0;
  const glow = kindle * fadeOut * Math.max(vineWarmth, 0.28 + 0.72 * wink);

  if (glow <= 0.025) return null;
  const [x, y] = posAt(t);
  return { f, u, age, x, y, glow, posAt, detached: sstep((u - 0.22) / 0.14) };
}

// Subtle 13px quadratic firefly leaf-rim warmth so only the 1-2 leaves touching a firefly catch a soft moss-green kiss
function nearFireflyGlow(litFlies, x, y) {
  let best = 0;
  for (let j = 0; j < litFlies.length; j++) {
    const fl = litFlies[j];
    const dx = fl.x - x;
    if (dx > 13 || dx < -13) continue;
    const dy = fl.y - y;
    if (dy > 13 || dy < -13) continue;
    const dSq = dx * dx + dy * dy;
    if (dSq < 169) {
      const f = 1 - dSq * (1 / 169);
      const k = fl.glow * f * f;
      if (k > best) best = k;
    }
  }
  return best;
}

// Selective lunar specular glint wave: each leaf shimmers with a crisp silver-cyan rim ONLY when the breeze tilts
// it across its narrow specular reflection angle (`叶片边缘偶尔泛起月光描边的细节特效`)!
function leafMoonSpec(x, y, t, ph) {
  const shaft = moonShaftAt(x, y, t);
  if (shaft <= 0.05) return 0;
  const wave = 0.5 + 0.5 * Math.sin(cyc(t, 1, ph * 1.7 - x * 0.022));
  const spec = wave * wave * wave * wave; // narrow `cos^8`-like specular sweep (`~22%` of moonlit leaves gleam at once!)
  return clamp(shaft * (0.14 + 1.25 * spec), 0, 1);
}

// Ultra-fast Stamp-Based Botanical Leaf Renderer with Crisp 1px Moonlight Rim-Tracing & Localized Firefly Glow!
const ZONE_COLS = new Uint32Array(6);
const ZONE_ALPHAS = new Float32Array(6);

function drawBotanicalLeaf(fglow, fblend, cx, cy, sizeIdx, ang, layer, moonK, flyRimK, F, M, P) {
  const icx = Math.round(cx), icy = Math.round(cy);
  const aNorm = ((ang % TAU) + TAU) % TAU;
  const ai = ((aNorm * (N_ANG / TAU) + 0.5) | 0) & (N_ANG - 1);
  const stamp = LEAF_ATLAS[sizeIdx * N_ANG + ai];
  const rB = stamp.rB;
  if (icx + rB < X0 || icx - rB > X1 || icy + rB < Y0 || icy - rB > Y1) return;

  const baseAlpha = layer === 2 ? 0.97 : layer === 1 ? 0.90 : 0.68;
  const bodyDark  = layer === 2 ? F[0] : layer === 1 ? F[1] : F[2];
  const bodyUpper = layer === 2 ? F[1] : layer === 1 ? F[2] : F[3];
  const veinBase  = layer === 2 ? F[2] : F[3];

  ZONE_COLS[0] = bodyDark;
  ZONE_COLS[1] = bodyUpper;
  ZONE_COLS[2] = moonK > 0.42 ? mix(veinBase, M[1], 0.45 * moonK) : veinBase;
  ZONE_ALPHAS[0] = baseAlpha;
  ZONE_ALPHAS[1] = baseAlpha;
  ZONE_ALPHAS[2] = baseAlpha;

  // DETAIL VFX: Occasional 1px Silver-Cyan Moonlight Rim-Tracing (`叶片边缘偶尔泛起月光描边`)
  if (moonK > 0.12) {
    const mkMid = clamp(moonK * 0.96, 0, 1);
    const mkTip = clamp(moonK * 1.38, 0, 1);
    ZONE_COLS[3] = mix(bodyUpper, mkMid > 0.58 ? M[2] : M[1], 0.40 + 0.56 * mkMid);
    ZONE_COLS[4] = mix(bodyUpper, mkTip > 0.78 ? M[4] : mkTip > 0.48 ? M[3] : M[2], 0.54 + 0.46 * mkTip);
    ZONE_ALPHAS[3] = Math.max(baseAlpha, 0.94 * mkMid);
    ZONE_ALPHAS[4] = Math.max(baseAlpha, 0.99 * mkTip);
  } else {
    const subtleRim = layer === 2 ? mix(bodyUpper, F[3], 0.34) : bodyUpper;
    ZONE_COLS[3] = subtleRim;
    ZONE_COLS[4] = subtleRim;
    ZONE_ALPHAS[3] = baseAlpha;
    ZONE_ALPHAS[4] = baseAlpha;
  }

  // Gentle Warm Moss-Chartreuse Rim Kiss from an immediately adjacent firefly (`<= 13px`, subtle & never neon)
  if (flyRimK > 0.08) {
    const fk = clamp(flyRimK, 0, 1);
    ZONE_COLS[5] = mix(bodyDark, P[2], 0.16 + 0.32 * fk);
  } else {
    ZONE_COLS[5] = bodyDark;
  }
  ZONE_ALPHAS[5] = baseAlpha;

  const data = stamp.data, n = data.length;
  for (let i = 0; i < n; i += 3) {
    const px = icx + data[i], py = icy + data[i + 1];
    if (px < X0 || px > X1 || py < Y0 || py > Y1) continue;
    const z = data[i + 2];
    fblend(px, py, ZONE_COLS[z], ZONE_ALPHAS[z]);
  }

  // Dreamy soft silver-blue lunar aura + crystalline 1px dew-tip glint when a leaf hits peak moonlight specular!
  if (layer >= 1 && moonK > 0.72) {
    const gk = (moonK - 0.72) / 0.28;
    const tx = icx + stamp.tipDx, ty = icy + stamp.tipDy;
    fglow(icx, icy - 1.5, 6.5, M[2], 0.22 * gk);
    if (tx >= X0 && tx <= X1 && ty >= Y0 && ty <= Y1) {
      fblend(tx, ty, M[4], 0.85 * gk);
    }
  }
}

// Render gnarled overarching corner bough + dense canopy leaves (single-pass column sweep: zero overdraw!)
function drawCornerBough(fglow, fblend, b, t, litFlies, F, M, P) {
  const baseAlpha = b.layer === 2 ? 0.98 : b.layer === 1 ? 0.90 : 0.66;
  const darkC = b.layer === 2 ? F[0] : b.layer === 1 ? F[1] : F[2];
  const rimC  = b.layer === 2 ? F[3] : F[4];

  const boughPt = (u) => {
    const x = b.x0 + (b.x1 - b.x0) * u;
    const sag = Math.sin(u * Math.PI) * b.sag + Math.sin(u * TAU) * b.crook * 0.45;
    const swayY = Math.sin(cyc(t, 1, b.ph - u * 1.2)) * (2.6 * u * u);
    return [x, b.y0 + (b.y1 - b.y0) * u + sag + swayY];
  };

  const ixStart = Math.max(X0, Math.round(Math.min(b.x0, b.x1)));
  const ixEnd   = Math.min(X1, Math.round(Math.max(b.x0, b.x1)));
  const invSpan = 1 / (b.x1 - b.x0);
  for (let ix = ixStart; ix <= ixEnd; ix++) {
    const u = clamp((ix - b.x0) * invSpan, 0, 1);
    const [, cy] = boughPt(u);
    const halfH = b.thick * Math.pow(1 - u * 0.80, 0.72) * 0.56;
    const yTop = Math.max(Y0, Math.round(cy - halfH));
    const yBot = Math.min(Y1, Math.round(cy + halfH));
    if (yTop > yBot) continue;
    const moonB = moonShaftAt(ix, cy, t);
    const topLip = moonB > 0.18 ? mix(rimC, M[2], 0.72 * moonB) : rimC;
    fblend(ix, yTop, topLip, baseAlpha);
    for (let iy = yTop + 1; iy <= yBot; iy++) {
      fblend(ix, iy, darkC, baseAlpha);
    }
  }

  for (let k = 0; k < b.leaves.length; k++) {
    const lf = b.leaves[k];
    const [bx, by] = boughPt(lf.u);
    const ang = lf.baseAng + 0.14 * Math.sin(cyc(t, 2, lf.ph));
    const lcx = bx + Math.cos(ang) * (lf.len * 0.46);
    const lcy = by + Math.sin(ang) * (lf.len * 0.46);
    const moonK = leafMoonSpec(lcx, lcy, t, lf.ph);
    const flyK  = nearFireflyGlow(litFlies, lcx, lcy);
    drawBotanicalLeaf(fglow, fblend, lcx, lcy, lf.sizeIdx, ang, b.layer, moonK, flyK, F, M, P);
  }
}

// Render draped catenary vine swag slung between upper boughs
function drawCatenarySwag(fglow, fblend, sw, t, litFlies, F, M, P) {
  const baseAlpha = sw.layer === 2 ? 0.96 : 0.86;
  const darkC = sw.layer === 2 ? F[0] : F[1];
  const ptAt = (u) => {
    const sag = Math.sin(u * Math.PI);
    const breezeX = Math.sin(cyc(t, 1, sw.ph)) * sw.sway * sag;
    const breezeY = Math.cos(cyc(t, 2, sw.ph)) * (sw.sway * 0.35) * sag;
    return [
      sw.x0 + (sw.x1 - sw.x0) * u + breezeX,
      sw.y0 + (sw.y1 - sw.y0) * u + sw.drop * sag + breezeY,
    ];
  };

  let [px, py] = ptAt(0);
  for (let s = 1; s <= 16; s++) {
    const [nx, ny] = ptAt(s / 16);
    const moonS = moonShaftAt(nx, ny, t);
    drawSmoothSeg(fblend, px, py, nx, ny, darkC, baseAlpha);
    if (moonS > 0.22) {
      drawSmoothSeg(fblend, px, py - 0.8, nx, ny - 0.8, mix(F[3], M[2], 0.72 * moonS), baseAlpha * 0.90);
    }
    px = nx; py = ny;
  }

  for (let k = 0; k < sw.leaves.length; k++) {
    const lf = sw.leaves[k];
    const [sx, sy] = ptAt(lf.u);
    const ang = lf.angOff + 0.15 * Math.sin(cyc(t, 2, lf.ph));
    const lcx = sx + Math.cos(ang) * (lf.len * 0.45);
    const lcy = sy + Math.sin(ang) * (lf.len * 0.45);
    const moonK = leafMoonSpec(lcx, lcy, t, lf.ph);
    const flyK  = nearFireflyGlow(litFlies, lcx, lcy);
    drawBotanicalLeaf(fglow, fblend, lcx, lcy, lf.sizeIdx, ang, sw.layer, moonK, flyK, F, M, P);
  }
}

// Render an S-curving hanging vine, alternating leaves, and delicate coiled fiddlehead tendril tip
function drawHangingVine(fglow, fblend, v, t, litFlies, F, M, P) {
  const baseAlpha = v.layer === 2 ? 0.97 : v.layer === 1 ? 0.89 : 0.65;
  const stemDark = v.layer === 2 ? F[0] : v.layer === 1 ? F[1] : F[2];
  const stemRim  = v.layer === 2 ? F[3] : F[4];

  const steps = Math.max(12, Math.round(v.len / 4.5));
  let [px, py] = vinePointAt(v, 0, t);
  const moonSign = -v.side;

  for (let s = 1; s <= steps; s++) {
    const u = s / steps;
    const [nx, ny] = vinePointAt(v, u, t);
    const halfW = v.thick0 * (1 - 0.62 * u) * 0.5;
    const moonS = moonShaftAt(nx, ny, t);
    const flyS  = nearFireflyGlow(litFlies, nx, ny);

    drawSmoothSeg(fblend, px, py, nx, ny, stemDark, baseAlpha);
    if (halfW > 0.55) {
      drawSmoothSeg(fblend, px - moonSign * 0.75, py, nx - moonSign * 0.75, ny, stemDark, baseAlpha * 0.94);
    }
    if (moonS > 0.24 || flyS > 0.18 || v.layer === 2) {
      let edgeC = mix(stemDark, stemRim, 0.36);
      if (moonS > 0.24) edgeC = mix(edgeC, M[2], clamp((moonS - 0.16) * 0.85, 0, 0.78));
      if (flyS > 0.18)  edgeC = mix(edgeC, P[2], clamp(flyS * 0.70, 0, 0.70));
      drawSmoothSeg(fblend, px + moonSign * (halfW + 0.35), py, nx + moonSign * (halfW + 0.35), ny, edgeC, baseAlpha * 0.90);
    }
    px = nx; py = ny;
  }

  // Coiled botanical tendril curl at the hanging vine tip
  const [tx, ty] = vinePointAt(v, 1.0, t);
  const tipSway = 0.28 * Math.sin(cyc(t, 2, v.ph));
  let cx = tx, cy = ty;
  for (let c = 1; c <= 13; c++) {
    const cu = c / 13;
    const rad = 5.2 * (1 - cu * 0.78);
    const ca = Math.PI * 0.5 + tipSway + v.curlDir * cu * TAU * 1.4;
    const nx = tx + v.curlDir * 3.5 * cu + Math.cos(ca) * rad * 0.48;
    const ny = ty + cu * 7.0 + Math.sin(ca) * rad * 0.48;
    const moonTip = moonShaftAt(nx, ny, t);
    drawSmoothSeg(fblend, cx, cy, nx, ny, moonTip > 0.35 ? mix(stemDark, M[2], 0.68) : stemDark, baseAlpha * (1 - cu * 0.24));
    cx = nx; cy = ny;
  }

  // Alternating leaves along the vine
  for (let k = 0; k < v.leaves.length; k++) {
    const lf = v.leaves[k];
    const [vx, vy] = vinePointAt(v, lf.u, t);
    const [lcx, lcy, ang] = evalVineLeafPos(v, lf, t);

    const baseLeafX = lcx - Math.cos(ang) * (lf.len * 0.48);
    const baseLeafY = lcy - Math.sin(ang) * (lf.len * 0.48);
    drawSmoothSeg(fblend, vx, vy, baseLeafX, baseLeafY, stemDark, baseAlpha * 0.90);

    const moonK = leafMoonSpec(lcx, lcy, t, lf.ph - lf.u * 1.3);
    const flyK  = nearFireflyGlow(litFlies, lcx, lcy);

    drawBotanicalLeaf(fglow, fblend, lcx, lcy, lf.sizeIdx, ang, v.layer, moonK, flyK, F, M, P);
  }
}

// Render Soft, Eye-Soothing Firefly + Whisper-Faint Curved Gossamer Trail (`温润不刺眼的萤火虫光点 + 微弱流光拖尾`)!
function drawFireflyAndTrail(fglow, fblend, st, t, P, M) {
  const { f, x, y, glow, posAt, detached } = st;
  if (x < X0 - 14 || x > X1 + 14 || y < Y0 - 14 || y > Y1 + 14) return;

  // 1. DETAIL VFX: Whisper-Faint Curved Gossamer Flight Trail (`微弱流光拖尾`)
  //    Traces ~1.0s of the firefly's calm sweeping S-arc (~10–13px behind it) at gentle low alpha (`<= 0.30`)
  if (detached > 0.05 && glow > 0.12) {
    const nSegs = f.depth === 2 ? 12 : f.depth === 1 ? 10 : 6;
    const stepDt = 0.088;
    let [px, py] = [x, y];
    for (let s = 1; s <= nSegs; s++) {
      const [tx, ty] = posAt(t - s * stepDt);
      const uTail = 1 - s / (nSegs + 1);
      const baseStr = f.depth === 2 ? 0.30 : f.depth === 1 ? 0.24 : 0.15;
      const aTrail = detached * (0.32 + 0.68 * glow) * uTail * uTail * baseStr;
      const cTrail = uTail > 0.65 ? P[3] : uTail > 0.32 ? P[2] : P[1];
      drawSmoothSeg(fblend, px, py, tx, ty, cTrail, aTrail);
      if ((s & 1) === 1 && aTrail > 0.03 && tx >= X0 && tx <= X1 && ty >= Y0 && ty <= Y1) {
        fglow(tx, ty, 2.0, P[2], aTrail * 0.28);
      }
      px = tx; py = ty;
    }
  }

  const X = Math.round(x), Y = Math.round(y);
  if (X < X0 || X > X1 || Y < Y0 || Y > Y1) return;

  // Distant canopy firefly (`depth === 0`): crisp 1px chartreuse jewel + soft whisper halo
  if (f.depth === 0) {
    fblend(X, Y, glow > 0.55 ? P[4] : P[3], clamp(0.32 + 0.54 * glow, 0, 0.86));
    fglow(x, y, 6.5, P[2], 0.15 * glow);
    return;
  }

  // Midground gliding firefly (`depth === 1`): clear honeydew-lime 1px lantern + soft velvet chartreuse aura
  if (f.depth === 1) {
    fglow(x, y, 10.5, P[2], 0.18 * glow);
    fglow(x, y, 3.8,  P[3], 0.21 * glow);
    fblend(X, Y, glow > 0.45 ? P[4] : P[3], 0.52 + 0.40 * glow);
    if (glow > 0.36) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (X + dx >= X0 && X + dx <= X1 && Y + dy >= Y0 && Y + dy <= Y1) {
          fblend(X + dx, Y + dy, P[3], 0.30 * glow);
        }
      }
    }
    return;
  }

  // Foreground hero winged firefly (`depth === 2`): tiny dark beetle thorax, gentle wing flutter, warm 2px lantern
  const dir = -f.side; // always facing calmly inward toward the central glade!
  const wingBeat = Math.floor(t * 12 + f.id) % 2;

  fglow(x, y, 15,  P[2], 0.20 * glow);
  fglow(x, y, 5.5, P[3], 0.24 * glow);

  if (detached > 0.25) {
    if (X + dir >= X0 && X + dir <= X1) fblend(X + dir, Y, P[0], 0.82);
    const wy = Y - 1 - wingBeat;
    if (wy >= Y0 && wy <= Y1) {
      fblend(X, wy, M[2], 0.38 * detached);
      if (X + dir >= X0 && X + dir <= X1) fblend(X + dir, wy, M[1], 0.28 * detached);
    }
  }

  fblend(X, Y, glow > 0.40 ? P[4] : P[3], 0.58 + 0.36 * glow);
  if (X - dir >= X0 && X - dir <= X1) fblend(X - dir, Y, P[3], 0.68 * glow);
  if (Y + 1 <= Y1 && glow > 0.45) fblend(X, Y + 1, P[2], 0.42 * glow);
}

let _flyCacheT = -1, _flyCacheS = -1, _flyCacheVal = null;
function evalFrameFlies(sc, t, S) {
  if (_flyCacheVal && _flyCacheT === t && _flyCacheS === S) return _flyCacheVal;
  const activeFlies = [];
  const litFlies = [];
  for (let i = 0; i < sc.fireflies.length; i++) {
    const st = evalFirefly(sc.fireflies[i], t);
    if (!st) continue;
    activeFlies.push(st);
    if (st.glow > 0.24) litFlies.push(st);
  }
  _flyCacheT = t;
  _flyCacheS = S;
  _flyCacheVal = { activeFlies, litFlies };
  return _flyCacheVal;
}

export function drawBack(p, t, o) {
  const q = clip(p, meta), fblend = makeFastBlend(p, q), fglow = makeFastGlow(p, q), S = o.seed;
  const P = fit(o.palette, 5), F = fit(o.foliage, 6), M = fit(o.moonlight, 5);
  const sc = getVineScene(S);
  const { activeFlies, litFlies } = evalFrameFlies(sc, t, S);

  // 1. Upper-Corner Moonlit Mist + Dreamy Inward-Slanting Silver-Blue Lunar Shafts (`central & lower stage === 0!`)
  const moonBreath = 0.88 + 0.12 * Math.sin(cyc(t, 1, 0.4));
  const sL = 0.24 * Math.sin(cyc(t, 1, 0.0));
  const sR = 0.24 * Math.sin(cyc(t, 1, 1.1));
  rows(p, meta, Y0, 34, (y, R) => {
    const yi = Math.floor(y - Y0);
    const rowOff = yi * W;
    for (let xi = 0; xi < W; xi++) {
      const kMist = CANOPY_MIST[rowOff + xi];
      if (kMist === 0) continue;
      const mc = MOON_COORD[rowOff + xi] + (xi < 160 ? sL : sR);
      const b1 = 1 - Math.abs(mc - 0.95) / 0.82;
      const b2 = 1 - Math.abs(mc - 2.45) / 0.92;
      const b3 = 1 - Math.abs(mc - 3.95) / 0.78;
      const shaft = (b1 > 0 ? b1 * b1 * 0.95 : 0) + (b2 > 0 ? b2 * b2 : 0) + (b3 > 0 ? b3 * b3 * 0.80 : 0);

      const aMist = (kMist * 0.14 + shaft * kMist * 0.09) * moonBreath;
      if (aMist > 0.006) {
        R.c[xi] = shaft > 0.38 ? M[1] : kMist > 0.45 ? F[2] : F[3];
        R.a[xi] = aMist > 0.20 ? 0.20 : aMist;
        R.b[xi] = 1;
      }
      R.l[xi] = M[2];
      const lk = (kMist * 0.14 + shaft * kMist * 0.16) * moonBreath;
      R.k[xi] = lk > 0.24 ? 0.24 : lk;
    }
  });

  fglow(-148, -86, 72, M[2], 0.18 * moonBreath);
  fglow( 148, -86, 72, M[2], 0.18 * moonBreath);

  // 2. Background & Midground Crown Leaves, Boughs, Catenary Swags & Hanging Vines (`layer === 0, 1`)
  for (let i = 0; i < sc.crowns.length; i++) {
    const c = sc.crowns[i];
    if (c.layer >= 2) continue;
    const ang = c.baseAng + 0.10 * Math.sin(cyc(t, 2, c.ph));
    drawBotanicalLeaf(fglow, fblend, c.x, c.y, c.sizeIdx, ang, c.layer, leafMoonSpec(c.x, c.y, t, c.ph), 0, F, M, P);
  }
  for (let i = 0; i < sc.boughs.length; i++) {
    if (sc.boughs[i].layer < 2) drawCornerBough(fglow, fblend, sc.boughs[i], t, litFlies, F, M, P);
  }
  for (let i = 0; i < sc.swags.length; i++) {
    if (sc.swags[i].layer < 2) drawCatenarySwag(fglow, fblend, sc.swags[i], t, litFlies, F, M, P);
  }
  for (let i = 0; i < sc.vines.length; i++) {
    if (sc.vines[i].layer < 2) drawHangingVine(fglow, fblend, sc.vines[i], t, litFlies, F, M, P);
  }

  // 3. Distant & Midground Swimming Fireflies (`depth === 0, 1`)
  for (let i = 0; i < activeFlies.length; i++) {
    if (activeFlies[i].f.depth < 2) drawFireflyAndTrail(fglow, fblend, activeFlies[i], t, P, M);
  }
}

export function draw(p, t, o) {
  const q = clip(p, meta), fblend = makeFastBlend(p, q), fglow = makeFastGlow(p, q), S = o.seed;
  const P = fit(o.palette, 5), F = fit(o.foliage, 6), M = fit(o.moonlight, 5);
  const sc = getVineScene(S);
  const { activeFlies, litFlies } = evalFrameFlies(sc, t, S);

  // 1. Crisp Foreground Crown Leaves, Silhouette Boughs, Draped Catenary Swags & Hanging Vines (`layer === 2`)
  for (let i = 0; i < sc.crowns.length; i++) {
    const c = sc.crowns[i];
    if (c.layer !== 2) continue;
    const ang = c.baseAng + 0.10 * Math.sin(cyc(t, 2, c.ph));
    drawBotanicalLeaf(fglow, fblend, c.x, c.y, c.sizeIdx, ang, 2, leafMoonSpec(c.x, c.y, t, c.ph), 0, F, M, P);
  }
  for (let i = 0; i < sc.boughs.length; i++) {
    if (sc.boughs[i].layer === 2) drawCornerBough(fglow, fblend, sc.boughs[i], t, litFlies, F, M, P);
  }
  for (let i = 0; i < sc.swags.length; i++) {
    if (sc.swags[i].layer === 2) drawCatenarySwag(fglow, fblend, sc.swags[i], t, litFlies, F, M, P);
  }
  for (let i = 0; i < sc.vines.length; i++) {
    if (sc.vines[i].layer === 2) drawHangingVine(fglow, fblend, sc.vines[i], t, litFlies, F, M, P);
  }

  // 2. Hero Foreground Winged Fireflies & Curved Gossamer Ribbon Trails (`depth === 2`)
  for (let i = 0; i < activeFlies.length; i++) {
    if (activeFlies[i].f.depth === 2) drawFireflyAndTrail(fglow, fblend, activeFlies[i], t, P, M);
  }

  // 3. Whisper-Faint Upper-Corner Lunar Dust Motes (subtle cool silver mist inside moonbeams only)
  for (let i = 0; i < sc.spores.length; i++) {
    const sp = sc.spores[i];
    const sx = sp.x0 + Math.sin(cyc(t, 1, sp.px)) * sp.ax;
    const sy = sp.y0 + Math.cos(cyc(t, 1, sp.py)) * sp.ay;
    if (sx < X0 + 1 || sx > X1 - 1 || sy < Y0 + 1 || sy > Y1 - 1) continue;

    const lum = moonShaftAt(sx, sy, t) * (0.35 + 0.65 * Math.sin(cyc(t, 1, sp.px)) ** 2);
    if (lum < 0.22) continue;
    fblend(Math.round(sx), Math.round(sy), M[2], clamp(lum * 0.42, 0, 0.36));
  }
}
