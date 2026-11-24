// Tri-color Chinese lacquer flame standby effect (三色漆焰待机特效):
// Three separated, stationary Chinese lacquer flames burning in place —
//   1. Left:   鎏金 (Gilded Gold lacquer)
//   2. Center: 霜白 (Frost White / Mother-of-Pearl lacquer)
//   3. Right:  青绿 (Mineral Malachite & Celadon Green lacquer)
// Each flame burns steadily at its own position with 5 layered Tixi/Xipi lacquer tongues,
// a natural rounded flame root, a mirror-gloss jet-black urushi heart, self-coiling ascending lacquer fire-wisps,
// and rising flame-licks & embers, embodying the heavy mineral body and flowing mirror-gloss luster of traditional Chinese lacquer (大漆).
// Tongue-by-tongue layered grid rasterization builds on src/fx/shadow/shadow-flames.js and src/fx/fire/spirit-flame.js,
// adapted from Sprite Fusion's open-source fire (https://www.spritefusion.com/pixel-art-vfx/fire),
// MIT License, Copyright (c) 2026 Hugo Duprez.

import {
  cycle, fit, noise2, sparkle, mix, TAU, WHITE,
} from "../../core/index.js";

const D = 3.0;

export const meta = {
  name: "Tricolor lacquer flame",
  desc: "Three stationary Chinese lacquer flames — gilded gold, frost white, and mineral celadon green — burn in place with coiling ascending wisps, heavy urushi hearts, and flowing sheen.",
  tags: ["fire", "lacquer", "chinese", "gold", "frost", "celadon", "idle", "loop"],
  size: [204, 132],
  origin: [102, 112],
  duration: D,
  loop: true,
  fps: 30,
  bg: "black",
  options: {
    // 1. 鎏金 (Gilded Gold lacquer: jet-black urushi heart -> deep bronze -> burnished imperial gold -> flowing gold-leaf rim)
    palette: ["#080502", "#261504", "#5c3508", "#9e5e0c", "#d88e14", "#f8c434", "#ffec8a", "#ffffff"],
    // 2. 霜白 (Frost White / Mother-of-Pearl lacquer: 松烟黑漆心 -> 沉稳银灰胎 -> 醇厚霜银 -> 螺钿流光雪白)
    frost: ["#070809", "#1b2024", "#3e4850", "#687682", "#98a8b4", "#cad6df", "#eef4f8", "#ffffff"],
    // 3. 青绿 (Mineral Malachite & Celadon Green lacquer: 玄绿黑漆心 -> 深石绿胎 -> 醇厚孔雀青绿 -> 翠玉流光)
    celadon: ["#040907", "#0a2219", "#134b35", "#1c7e58", "#2bb880", "#5ce8ac", "#b8ffe0", "#f2fff9"],
    seed: 19,
  },
};

// Fixed standby positions for the 3 separated flames: Left (鎏金), Center (霜白), Right (青绿)
export const FLAME_SPOTS = [
  [-62, 0], // 0: 鎏金 (Gilded Gold)
  [  0, 0], // 1: 霜白 (Frost White)
  [ 62, 0], // 2: 青绿 (Mineral Celadon Green)
];

// Local 2D grid for tongue-by-tongue lacquer flame rasterization
const GX = 28;
const GW = GX * 2;
const GY = 92;
const FLAME_GRID = new Int8Array(GW * GY);

// 5 sculpted tongues per flame cluster (outer left, outer right, inner left, inner right, tall soaring center):
// Outer tongues start higher (-6 px) and inner tongues at (-3 px) so the bottom of each flame forms a natural,
// rounded teardrop flame root with NO flat ring or pedestal at the bottom!
// [dx, baseY, baseH, baseW, seedOff]
const TONGUES = [
  [-11.0, -6, 28, 4.6, 1],
  [ 11.0, -6, 30, 4.8, 2],
  [ -6.2, -3, 44, 6.0, 3],
  [  6.2, -3, 42, 5.8, 4],
  [  0.0,  0, 62, 7.8, 5],
];
const TONGUE_ORDER = [0, 1, 2, 3, 4];

// Inside-out Chinese lacquer layers (inspired by shadow-flames.js & spirit-flame.js):
// Tone 0: Flowing-light gold-leaf / mother-of-pearl / jade-glaze outer rim (流光亮边, R[5]/R[6]/WHITE)
// Tone 1: Luminous mineral lacquer layer (亮色矿漆层, R[4]/R[5])
// Tone 2: Heavy, deep mineral lacquer body (厚重深色大漆胎, R[2]/R[3])
// Tone 3: Mirror-gloss jet-black raw urushi heart (推光黑大漆火心, R[0] with wet specular arc)
const LAYERS = [
  [1.00, 1.00, 0],
  [0.82, 0.89, 1],
  [0.58, 0.72, 2],
  [0.34, 0.50, 3],
];

// Seamless loop noise: traces a circle in 2D noise space once per duration D
const lnoise = (t, v, seed, speed = 5) =>
  noise2(Math.cos((TAU * t) / D) * speed + v, Math.sin((TAU * t) / D) * speed, seed);

// ---------------------------------------------------------------------------
// 1. Self-Coiling Ascending Lacquer Fire-Wisp around One Stationary Flame
//    Two thin, luminous lacquer fire strands gently spiral upward around THIS flame's
//    mid-to-upper body (starting well above the root so there is NO ring at the bottom).
// ---------------------------------------------------------------------------
function drawSelfCoilingWisps(p, cx0, cy0, ph, kColor, R, frontHalf) {
  const totalH = 54;
  for (let strand = 0; strand < 2; strand++) {
    const strandOff = strand * Math.PI + kColor * 2.09;
    for (let r = 10; r <= totalH; r++) {
      const u = (r - 10) / (totalH - 10); // 0 above root, 1 near crown
      const theta = strandOff + u * TAU * 1.05 - ph * TAU * 2;
      const z = Math.sin(theta);
      if ((z >= 0) !== frontHalf) continue;

      // Smoothly swells in the middle of the flame and tapers to 0 at both ends
      const radX = Math.sin(Math.pow(u, 0.7) * Math.PI) * 11.5;
      const wx = cx0 + Math.cos(theta) * radX;
      const wy = cy0 - r + z * 1.8;

      const halfW = Math.sin(u * Math.PI) * (frontHalf ? 1.5 : 1.1);
      if (halfW < 0.42) continue;

      const span = Math.ceil(halfW + 0.5);
      const flow = Math.sin(u * 10 - ph * TAU * 3 + strand);
      for (let dx = -span; dx <= span; dx++) {
        const q = Math.abs(dx) / Math.max(0.45, halfW);
        if (q > 1.15) continue;
        let col;
        if (q > 0.68) {
          col = R[4];
        } else if (frontHalf && q < 0.35 && flow > 0.1) {
          col = WHITE;
        } else {
          col = R[6];
        }
        p.px(wx + dx, wy, col);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Single Stationary Roaring & Ascending Chinese Lacquer Flame
//    Renders ONE complete, stationary 5-tongue lacquer flame (鎏金, 霜白, or 青绿)
//    at its fixed position (cx0, cy0) with a natural rounded teardrop root.
// ---------------------------------------------------------------------------
function drawStationaryLacquerFlame(p, t, ph, cx0, cy0, kColor, R, seedBase) {
  // A. Ascending mineral-lit lacquer mist puffs above the crown (大漆瑞霭流云, behind the flame tips)
  cycle(
    t,
    D,
    9,
    seedBase + 10 + kColor * 31,
    (r) => r.range(1.1, 1.7),
    (age, L, r) => {
      const u = age / L;
      const mx = cx0 + r.range(-5.0, 5.0) + Math.sin(u * 4 + r.range(0, 6)) * 3.8 * u;
      const my = cy0 - (46 + u * r.range(26, 42));
      const rad = 2.6 + u * 4.0;
      const a = Math.min(1, u * 5) * (1 - u) * 0.55;
      p.disc(mx, my, rad, mix(R[2], R[1], u), a);
      p.disc(mx, my + rad * 0.42, rad * 0.52, R[5], a * 0.5 * (1 - u));
    }
  );

  // B. Back half of the self-coiling ascending lacquer fire-wisps
  drawSelfCoilingWisps(p, cx0, cy0, ph, kColor, R, false);

  // C. Rasterize the 5 roaring flame tongues back-to-front into FLAME_GRID
  FLAME_GRID.fill(-1);
  const setGrid = (lx, ly, tone) => {
    const i = Math.round(lx) + GX;
    const j = Math.round(ly) + (GY - 6);
    if (i >= 0 && i < GW && j >= 0 && j < GY) {
      FLAME_GRID[j * GW + i] = tone;
    }
  };

  for (const idx of TONGUE_ORDER) {
    const [dx, baseY, H0, W0, nOff] = TONGUES[idx];
    const n = seedBase + kColor * 53 + nOff * 11;
    // Keep the central tongue consistently tall & soaring (0.94..1.10x) so every flame has a majestic rising peak!
    const hAmp = idx === 4 ? 0.96 + 0.12 * lnoise(t, n * 3, n, 4) : 0.85 + 0.17 * lnoise(t, n * 3, n, 4);
    const h = H0 * hAmp;
    const sway = lnoise(t, n * 7, n + 9, 3) * 3.0;

    for (const [lw, lh, tone] of LAYERS) {
      const Hl = h * lh;
      const Wl = W0 * lw;
      // Offset inner layers slightly upward at the root so the outer lacquer rim wraps cleanly around the bottom of each tongue
      const rootLift = (1 - lh) * 2.2;
      for (let r = 0; r <= Hl; r += 0.6) {
        const u = r / Math.max(1, Hl);
        // Smooth, rounded teardrop root curve (no flat bottom edge!)
        const rootCurve = Math.sin(Math.min(1, (r + 0.8) / 7.2) * (Math.PI / 2));
        // Ascending S-wave + organic peristalsis along the lacquer tongue
        const climbPulse = 1 + 0.14 * Math.sin(u * 6.5 - ph * TAU * 3 + nOff);
        const half = Wl * Math.pow(1 - u, 0.78) * rootCurve * climbPulse
          + ( lnoise(t, r * 0.42 + n, n + 20, 6) * 0.95
            + lnoise(t, r * 1.25 + n * 5, n + 50, 8) * 0.45 ) * Math.min(1, r / 5);
        if (half < 0.3) continue;

        // Upward-climbing S-curve (持续升腾)
        const climbWave = Math.sin(r * 0.19 - ph * TAU * 3 + nOff * 1.2 + kColor) * 2.2 * Math.pow(u, 1.15);
        const lx = dx * (0.78 + 0.22 * rootCurve) + sway * u * u * lh + climbWave
          + lnoise(t, r * 0.2 + n * 2, n + 30, 5) * u * 1.3;
        const ly = baseY - rootLift - r;

        for (let x = Math.round(lx - half); x <= Math.round(lx + half); x++) {
          // Outer flowing-light skin flickers into rising flame-tips near the crown
          if (tone === 0 && u > 0.52 && lnoise(t, x * 0.85 + r * 0.65 + n, n + 60, 8) > 0.38) continue;
          setGrid(x, ly, tone);
        }
      }
    }
  }

  // D. Paint the rasterized flame with heavy Chinese lacquer shading & flowing mirror-gloss waves (大漆厚重与流光质感)!
  const sheenSweep = ph * TAU * 3 + kColor * 2.09;
  for (let j = 0; j < GY; j++) {
    for (let i = 0; i < GW; i++) {
      const v = FLAME_GRID[j * GW + i];
      if (v < 0) continue;

      const lx = i - GX;
      const ly = j - (GY - 6);
      const px = Math.round(cx0 + lx);
      const py = Math.round(cy0 + ly);

      // Flowing-light specular wave (流光高光波) sweeping continuously upward through the lacquer layers
      const flowWave = Math.sin(-ly * 0.22 - sheenSweep + lx * 0.16);
      // Xipi lacquer cloud-scroll marbling (犀皮流云纹)
      const xipi = 0.5 + 0.5 * Math.sin(-ly * 0.32 - ph * TAU * 2 + Math.abs(lx) * 0.35 + kColor);

      let col;
      if (v === 0) {
        // Tone 0: Flowing-light outer lacquer rim, blazing white-gold / snow-white / jade-white at the tips & wave crests
        const isTopTip = ly < -30 && (j === 0 || FLAME_GRID[(j - 1) * GW + i] < 0);
        if (isTopTip) {
          col = ly < -40 ? WHITE : R[7];
        } else {
          col = flowWave > 0.42 ? WHITE : flowWave > -0.18 ? R[6] : R[5];
        }
      } else if (v === 1) {
        // Tone 1: Rich luminous mineral lacquer body (鎏金 / 霜白 / 青绿) with sweeping flowing sheen
        col = flowWave > 0.60 ? R[6] : xipi > 0.35 ? R[4] : R[5];
      } else if (v === 2) {
        // Tone 2: Heavy, deep mineral lacquer undercoat (厚重深色矿漆胎)
        col = flowWave > 0.66 ? R[4] : xipi > 0.42 ? R[3] : R[2];
      } else {
        // Tone 3: Mirror-gloss jet-black raw urushi heart (推光黑大漆火心) with a crisp wet-gloss arc inside
        const isHeartSpec = lx < 0 && ly < -5 && flowWave > 0.52
          && (i > 0 && FLAME_GRID[j * GW + (i - 1)] === 2);
        col = isHeartSpec ? R[5] : xipi > 0.72 ? R[1] : R[0];
      }

      p.px(px, py, col);
    }
  }

  // E. Front half of the self-coiling ascending lacquer fire-wisps
  drawSelfCoilingWisps(p, cx0, cy0, ph, kColor, R, true);

  // F. Ascending licks & curls of lacquer flame breaking off the 5 tongue tips (持续向上升腾剥离的漆火苗)
  cycle(
    t,
    D,
    30,
    seedBase + 200 + kColor * 41,
    (r) => r.range(0.28, 0.56),
    (age, L, r) => {
      const u = age / L;
      const tIdx = r.int(0, 4);
      const [dx0, baseY, H0] = TONGUES[tIdx];
      const lx = cx0 + dx0 * 0.85 + r.range(-3.2, 3.2) + Math.sin(u * 5 + tIdx) * 3.2 * u;
      const ly = cy0 + baseY - (H0 * r.range(0.55, 0.92) + u * r.range(14, 26));
      const rad = r.range(1.2, 2.5) * (1 - u) + 0.35;
      // Outer bright lacquer skin
      p.circle(lx, ly, rad + 0.65, u < 0.45 ? R[6] : R[4]);
      // Inner heavy mineral & dark-lacquer core
      if (rad > 0.95) {
        p.circle(lx, ly + 0.35, rad * 0.55, u < 0.3 ? R[2] : R[3]);
      }
    }
  );

  // G. Ascending gold-leaf (鎏金), mother-of-pearl (霜白), and malachite (青绿) embers & sparkles
  cycle(
    t,
    D,
    24,
    seedBase + 400 + kColor * 59,
    (r) => r.range(0.9, 1.6),
    (age, L, r) => {
      const u = age / L;
      const lx = cx0 + r.range(-11, 11) + Math.sin(u * 6 + r.range(0, 6)) * 4.2 * u;
      const ly = cy0 - (14 + u * r.range(42, 66));
      if (u > 0.72 && Math.sin(age * 36 + lx) < 0) return;
      if (u < 0.36 && r.chance(0.38)) {
        sparkle(p, lx, ly, 1.5 + (1 - u) * 1.2, WHITE, R[5], 0.48 * (1 - u));
      } else {
        p.px(lx, ly, u < 0.28 ? WHITE : u < 0.62 ? R[6] : R[4]);
        p.glow(lx, ly, 3, R[5], 0.32 * (1 - u));
      }
    }
  );

  // H. Ambient lacquer bloom round this flame, while protecting the jet-black urushi hearts (v === 3)
  //    and deep mineral lacquer layer (v === 2) from additive light washout!
  const fl = 0.86 + 0.14 * lnoise(t, kColor * 2, 77 + kColor, 6);
  p.glow(cx0, cy0 - 24, 38, R[4], 0.36 * fl);
  p.glow(cx0, cy0 - 14, 19, R[5], 0.25 * fl);

  for (let j = 0; j < GY; j++) {
    for (let i = 0; i < GW; i++) {
      const v = FLAME_GRID[j * GW + i];
      if (v !== 3 && v !== 2) continue;
      const px = Math.round(cx0 + (i - GX));
      const py = Math.round(cy0 + (j - (GY - 6)));
      const sx = p.cellX(px, py) - p.ox;
      const sy = p.cellY(px, py) - p.oy;
      if (sx >= 0 && sy >= 0 && sx < p.w && sy < p.h) {
        const idx = sy * p.w + sx;
        if (v === 3) {
          // Pure mirror-gloss black urushi heart: zero additive washout!
          p.L[idx] = 0;
        } else {
          // Deep mineral lacquer undercoat: dampen glow by 65% so pigment stays rich and heavy
          const l = p.L[idx];
          const lr = ((l & 255) * 0.35) | 0;
          const lg = (((l >>> 8) & 255) * 0.35) | 0;
          const lb = (((l >>> 16) & 255) * 0.35) | 0;
          p.L[idx] = (255 << 24) | (lb << 16) | (lg << 8) | lr;
        }
      }
    }
  }
}

export function draw(p, t, o) {
  // Three distinct traditional Chinese lacquer color ramps:
  // 0 (Left):   鎏金 (Gilded Gold)
  // 1 (Center): 霜白 (Frost White)
  // 2 (Right):  青绿 (Mineral Celadon Green)
  const G = fit(o.palette, 8);
  const F = fit(o.frost, 8);
  const C = fit(o.celadon, 8);
  const ramps = [G, F, C];

  const time = ((t % D) + D) % D;
  const ph = time / D;

  for (let k = 0; k < 3; k++) {
    const [cx, cy] = FLAME_SPOTS[k];
    drawStationaryLacquerFlame(p, time, ph, cx, cy, k, ramps[k], o.seed);
  }
}
