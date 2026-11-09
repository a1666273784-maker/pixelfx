// Abyssal dark-red ground eruption: a jagged volcanic trough of molten fissures and boiling low
// dark-red omen flames tears open the stone floor, six staggered pillars of hellfire erupt skyward—
// grading via interlocking flame-fangs from unlit pitch-black roots up into roaring bright-red
// spear crowns—delivering rapid impale strikes and a multi-point mid-air hit-rupture before
// strangling inward and collapsing into dark-red clots and a cascading rain of dark-red embers.
// Flame-tongue, spark, stone-chunk, floor-crack and impact-star techniques are adapted from Sprite
// Fusion's open-source fire, explosion and impact effects (https://www.spritefusion.com/pixel-art-vfx),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import {
  Particles, Bits, Lights, P, B, Rng, fit, flare,
  clamp, smooth, seg, bump, ease, tileFbm, fract, rand, mix, TAU, WHITE,
} from "../../core/index.js";
import { flameTongue, flameBlade, floorLight } from "./_lib.js";
import { unlight, blackStar, shard } from "../shadow/_lib.js";
import {
  spikes, star, brokenRing, frontCrescent, makeCracks, stone, rock, rockShape, SOOT,
} from "../impacts/_lib.js";

export const meta = {
  name: "Crimson eruption",
  desc: "A jagged ring of dark-red omen fire cracks the stone floor, six staggered pillars erupt from black roots to bright-red crowns with a hit burst, then rain dark-red embers.",
  tags: ["fire", "crimson", "dark", "eruption", "pillar", "omen", "hit", "ground", "one-shot"],
  size: [308, 228],
  origin: [154, 198],
  duration: 3.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#080205", "#19040a", "#380711", "#660b1a", "#9c1223", "#d41b2b", "#ff2d37", "#ff6d6a", "#ffd9d6"],
    stone: "#3b2e47",
    seed: 7,
  },
};

const RX = 88, SY = 0.20, RY = RX * SY;
const T_LOCK = 0.45;
const T_FIRST = 0.54;
const T_HIT = 0.90;
const T_HIT2 = 0.96;
const T_END = 3.8;

// 6 non-monotonic staggered pillars inside the molten omen ring:
// [x, y, height, halfWidth, lean, eruptOrder, collapseOrder]
const PILLAR_SPEC = [
  [-66, 4.4, 114, 7.2, -3.0, 3, 1],
  [-39, -6.8, 148, 8.6, -1.4, 1, 0],
  [-13, 6.2, 126, 8.2, -0.4, 0, 3],
  [16, -5.2, 168, 10.4, 0.8, 5, 5],
  [42, 5.0, 142, 8.6, 1.8, 2, 2],
  [67, -3.2, 108, 7.0, 3.1, 4, 4],
];

// Reversed 9-step ramp H (H[0]=C[8] pale hot core, H[1]=C[7] bright coral-red, H[2]=C[6] blazing bright red,
// H[3]=C[5] vivid scarlet, H[4]=C[4] deep crimson, H[5]=C[3] dark blood, H[6]=C[2], H[7]=C[1], H[8]=C[0])
const CROWN_LAYERS = [[1, 1, 4], [0.82, 0.92, 3], [0.62, 0.80, 2], [0.38, 0.56, 1], [0.16, 0.28, 0]];
const CROWN_BACK = [[1, 1, 5], [0.80, 0.90, 4], [0.58, 0.74, 3], [0.34, 0.50, 2], [0.14, 0.22, 1]];
// Dark-red omen ring flame layers: strictly dark blood -> deep crimson -> scarlet (oppressive dark-red!)
const OMEN_RIM_LAYERS = [[1, 1, 7], [0.78, 0.90, 6], [0.50, 0.68, 5], [0.22, 0.36, 4]];
const OMEN_SURGE_LAYERS = [[1, 1, 6], [0.78, 0.90, 5], [0.48, 0.66, 4], [0.20, 0.34, 3]];
const CLOT_LAYERS = [[1, 1, 6], [0.74, 0.84, 5], [0.44, 0.58, 4], [0.18, 0.28, 3]];
const ROOT_FANG_LAYERS = [[1, 1, 6], [0.78, 0.88, 7], [0.50, 0.68, 8]];

// Floor-clamped dark miasma dome
function drawMiasmaDome(p, rx, ryUp, ryDown, col, alpha) {
  if (alpha <= 0.01) return;
  const x0 = -Math.floor(rx), x1 = Math.floor(rx);
  const y0 = -Math.floor(ryUp), y1 = Math.floor(ryDown);
  for (let dy = y0; dy <= y1; dy++) {
    const ny = dy < 0 ? dy / ryUp : dy / ryDown;
    const ny2 = ny * ny;
    if (ny2 >= 1) continue;
    const span = Math.floor(rx * Math.sqrt(1 - ny2));
    for (let dx = Math.max(x0, -span); dx <= Math.min(x1, span); dx++) {
      const d2 = (dx * dx) / (rx * rx) + ny2;
      if (d2 < 1) {
        const k = 1 - d2;
        p.blend(dx, dy, col, alpha * k * k);
      }
    }
  }
}

// Physical stone crater dent at each pillar site (adapted from impacts/ground-slam.js)
function drawCraterMouth(p, cx, cy, hw, st, hot, C, k) {
  const w = Math.round(hw);
  for (let dx = -w; dx <= w; dx++) {
    const q = Math.abs(dx) / Math.max(1, w);
    const dep = Math.round(2.2 * (1 - q * q));
    if (q < 0.80) {
      for (let dy = 0; dy < dep; dy++) p.dot(cx + dx, cy + dy, C[0], k * 0.95);
      p.dot(cx + dx, cy + dep, hot > 0.6 ? C[5] : hot > 0.25 ? C[4] : C[2], k);
    } else {
      p.dot(cx + dx, cy - 1, q > 0.92 ? st.light : st.lip, k * 0.9);
    }
  }
}

// Fast forked stone floor fissures without per-segment glow washout
function drawStoneFissures(p, cracks, growFn, heatK, C, lip, alpha) {
  if (alpha <= 0.02) return;
  for (const c of cracks) {
    const G = growFn(c);
    if (G <= 0) continue;
    for (const path of [c.pts, ...c.kids]) {
      for (let i = 1; i < path.length; i++) {
        const [x0, y0, d0] = path[i - 1], [x1, y1, d1] = path[i];
        if (d0 >= G) break;
        const f = d1 > G ? (G - d0) / (d1 - d0) : 1;
        const ex = x0 + (x1 - x0) * f, ey = y0 + (y1 - y0) * f;
        const h = heatK * (1 - d0 / 80);
        const col = h > 0.72 ? C[5] : h > 0.45 ? C[4] : h > 0.22 ? C[3] : C[1];
        if ((i & 1) === 0) p.line(x0, y0 + 1, ex, ey + 1, lip, alpha * 0.55);
        p.line(x0, y0, ex, ey, col, alpha * 0.9);
      }
    }
  }
}

// Curved double-tapered rend scar across the strike zone
function drawRendScar(p, x0, y0, cx, cy, x1, y1, maxW, alpha, C, hot) {
  if (alpha <= 0.02 || maxW < 0.25) return;
  const approxLen = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
  const steps = clamp(Math.ceil(approxLen * 0.48), 24, 72);
  let px0 = x0, py0 = y0;
  for (let i = 1; i <= steps; i++) {
    const u = i / steps, mu = 1 - u;
    const x = mu * mu * x0 + 2 * mu * u * cx + u * u * x1;
    const y = mu * mu * y0 + 2 * mu * u * cy + u * u * y1;
    const dx = x - px0, dy = y - py0, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    const hw = maxW * Math.sin(Math.PI * Math.pow(u, 0.88));
    const span = Math.ceil(hw + 0.3);
    for (let w = -span; w <= span; w += 0.8) {
      const aw = Math.abs(w);
      if (aw > hw) continue;
      const q = aw / Math.max(0.35, hw);
      const col = hot
        ? (q < 0.45 ? WHITE : q < 0.80 ? C[8] : C[6])
        : q < 0.28 ? C[8] : q < 0.64 ? C[6] : q < 0.86 ? C[4] : C[2];
      p.dot(x + nx * w, y + ny * w, col, alpha * (q > 0.78 ? (1.08 - q) / 0.3 : 1));
    }
    px0 = x;
    py0 = y;
  }
}

export function create(o) {
  const C = fit(o.palette, 9), H = [...C].reverse();
  const st = stone(o.stone);
  const R = new Rng(o.seed), seed = o.seed * 23 + 5, floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [C[8], C[7], C[6], C[4]],
    haze: C[3],
  });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  const pillars = PILLAR_SPEC.map(([x, y, h, w, lean, eOrd, cOrd], idx) => {
    const tE = T_FIRST + eOrd * 0.058; // 0.54 .. 0.83s
    const tC = 1.62 + cOrd * 0.066;     // 1.62 .. 1.95s
    const impaleY = y - (38 + (idx % 3) * 13);
    return {
      idx,
      x: x + R.range(-1.0, 1.0),
      y: y + R.range(-0.35, 0.35),
      back: y < 0,
      h: h * R.range(0.98, 1.02),
      w: w * R.range(0.97, 1.03),
      lean,
      tE,
      tHit: tE + 0.042,
      impaleY,
      impaleSpikes: spikes(R, 8, -Math.PI / 2 + R.range(-0.32, 0.32), { len: [7, 13], w: [1.3, 2.0], fwd: 1.55, back: 0.75, jag: 0.52 }),
      tC,
      tGone: tC + 0.35,
      ph: R.range(0, TAU),
      s: seed + idx * 37,
      erupted: false,
      impaled: false,
      collapsed: false,
    };
  });
  const order = [...pillars].sort((a, b) => a.y - b.y);

  // Irregular jagged volcanic trough perimeter (organic fractured stone outline, ZERO geometric magic circle!)
  const N_RIM = 52;
  const rimPh1 = R.range(0, TAU), rimPh2 = R.range(0, TAU), rimPh3 = R.range(0, TAU);
  const rimRadiusAt = (ang) =>
    RX * (1 + 0.062 * Math.sin(ang * 3 + rimPh1) + 0.042 * Math.cos(ang * 5 + rimPh2) + 0.028 * Math.sin(ang * 9 + rimPh3));

  const rimVerts = Array.from({ length: N_RIM }, (_, i) => {
    const ang = (i / N_RIM) * TAU + R.range(-0.02, 0.02);
    const rr = rimRadiusAt(ang) * R.range(0.97, 1.03);
    // Cracks open rapidly from t = 0.00s so Frame 0 already shows the initial dark-red volcanic fissure!
    const sweep = 0.5 - 0.5 * Math.cos(ang * 2 + 0.4);
    return {
      ang,
      cs: Math.cos(ang),
      sn: Math.sin(ang),
      rr,
      x: Math.cos(ang) * rr,
      y: 0.5 + Math.sin(ang) * rr * SY,
      back: Math.sin(ang) < 0,
      t0: sweep * 0.13,
      cool: 2.30 + R.range(0, 0.95),
      hasLip: R.chance(0.72),
    };
  });

  // Precompute the irregular charred soot basin pixels ONCE in create() for ~0.1ms per-frame rendering!
  const basinPx = [];
  for (let py = Math.floor(-RY - 2); py <= Math.ceil(RY + 3); py++) {
    const dy = (py - 0.5) / RY;
    if (Math.abs(dy) >= 1.12) continue;
    for (let px = Math.floor(-RX - 5); px <= Math.ceil(RX + 5); px++) {
      const ang = Math.atan2(dy, px / RX);
      const lim = rimRadiusAt(ang) / RX;
      const h = rand(px, py, seed);
      const d = Math.hypot(px / RX, dy) / lim + (h - 0.5) * 0.13;
      if (d < 1) {
        basinPx.push([px, py, d, h]);
      }
    }
  }

  // 34 overlapping low, wide boiling dark-red flames licking along the molten trough perimeter!
  const rimFlames = Array.from({ length: 34 }, (_, i) => {
    const ang = ((i + R.range(0.15, 0.85)) / 34) * TAU;
    const rr = rimRadiusAt(ang) + R.range(-2.0, 1.8);
    const sweep = 0.5 - 0.5 * Math.cos(ang * 2 + 0.4);
    return {
      x: Math.cos(ang) * rr,
      y: 0.5 + Math.sin(ang) * rr * SY,
      back: Math.sin(ang) < 0,
      t0: sweep * 0.15 + R.range(0, 0.03),
      tOut: 2.00 + R.range(0, 0.85),
      h: R.range(6.0, 10.5),
      w: R.range(2.6, 4.0),
      lean: -Math.cos(ang) * R.range(1.2, 2.8), // sweeps inward & along the molten trough!
      s: seed + 500 + i * 19,
    };
  }).sort((a, b) => a.y - b.y);

  // Organic forked stone floor cracks in the brick floor face
  const floorCracks = makeCracks(R, 10, { len: [20, 56], dive: 0.52, maxY: 18, forks: 0.7, x0: [6, 32] });

  // Irregular zig-zagging magma fault lines linking neighboring craters across the basin
  const faultLines = [];
  for (let i = 0; i < pillars.length - 1; i++) {
    const a = pillars[i], b = pillars[i + 1];
    const pts = [[a.x, a.y]];
    const segs = 6;
    for (let k = 1; k < segs; k++) {
      const u = k / segs;
      pts.push([
        a.x + (b.x - a.x) * u + R.range(-3.5, 3.5),
        a.y + (b.y - a.y) * u + R.range(-2.2, 2.2),
      ]);
    }
    pts.push([b.x, b.y]);
    faultLines.push({ pts, t0: 0.06 + i * 0.04 });
  }

  const hitX = 5, hitY = -66;
  const hit2X = 18, hit2Y = -108;
  const hitSpikesMain = spikes(R, 16, -0.05, { len: [18, 28], w: [2.1, 3.3], fwd: 1.5, back: 1.35, jag: 0.42 });
  hitSpikesMain[0].len *= 1.22;
  hitSpikesMain[8].len *= 1.22;
  const hitSpikesSub = spikes(R, 10, 0.42, { len: [11, 18], w: [1.5, 2.2], fwd: 1.35, back: 0.9, jag: 0.52 });
  const hitSpikesCrown = spikes(R, 12, -0.22, { len: [12, 21], w: [1.7, 2.4], fwd: 1.5, back: 1.2, jag: 0.48 });
  const hitSegs = Array.from({ length: 8 }, (_, i) => ({
    a: (i / 8) * TAU + R.range(-0.12, 0.12),
    gap: R.range(0.60, 0.86),
    dr: R.range(0.14, 0.40),
    w: R.range(0.9, 1.45),
  }));

  const flameClots = [];
  for (const pl of pillars) {
    for (let i = 0; i < 6; i++) {
      const u = (i + 0.5) / 6;
      flameClots.push({
        t0: pl.tC + (1 - u) * 0.12 + R.range(-0.01, 0.10),
        life: R.range(0.30, 0.50),
        x: pl.x + pl.lean * u + R.range(-pl.w * 0.55, pl.w * 0.55),
        y: pl.y - (12 + u * (pl.h * 0.84)),
        vx: R.range(-15, 15),
        vy: R.range(18, 50),
        g: R.range(130, 200),
        h0: R.range(8, 13),
        w0: R.range(1.8, 2.9),
        lean: R.range(-1.3, 1.3),
        s: pl.s + 200 + i * 13,
        groundY: clamp(pl.y + R.range(-4, 5), -RY * 0.9, RY * 0.92),
        age: 0,
        active: false,
        done: false,
      });
    }
  }

  const fallingEmbers = [];
  for (const pl of pillars) {
    const nEmb = 40;
    for (let i = 0; i < nEmb; i++) {
      const u = (i + R.next()) / nEmb;
      const cTop = pl.h * (1 - 0.26 * (1 - u));
      const yStart = pl.y - Math.max(6, u * cTop * 0.94);
      const xStart = pl.x + pl.lean * u + R.range(-pl.w * 0.9, pl.w * 0.9);
      const groundY = clamp(pl.y + R.range(-5, 6), -RY * 0.92, RY * 0.96);
      const size = R.chance(0.08) ? 4 : R.chance(0.24) ? 3 : R.chance(0.50) ? 2 : 1;
      fallingEmbers.push({
        t0: pl.tC + (1 - u) * 0.13 + R.range(-0.02, 0.16),
        x: xStart,
        y: yStart,
        vx: R.range(-18, 18) + pl.x * 0.04,
        vy: R.range(12, 44),
        g: R.range(125, 205),
        drag: R.range(1.10, 2.0),
        swayAmp: size >= 4 ? R.range(4, 8) : R.range(6, 15),
        swayFreq: R.range(2.8, 5.4),
        ph: R.range(0, TAU),
        groundY,
        size,
        restAge: -1,
        restLife: R.range(0.38, 0.88),
        bounced: false,
        dead: false,
      });
    }
  }

  let t = 0, locked = false, bigHit = false, crownHit = false;
  const blackBoxes = [];

  const NZ = (rate, s0, off = 0) =>
    Math.sin(t * rate * 1.15 + off * 0.7 + (s0 & 63)) * 0.65 +
    Math.sin(t * rate * 2.35 - off * 1.1 + s0 * 0.37) * 0.35;

  function pillarHeight(pl) {
    if (t < pl.tE) return 0;
    const u = t - pl.tE;
    if (u < 0.075) return pl.h * ease.outExpo(u / 0.075);
    if (t < pl.tC) {
      const hitPop = 1 + 0.06 * bump(t, T_HIT - 0.02, T_HIT + 0.16);
      return pl.h * hitPop * (0.97 + 0.03 * Math.sin(t * 11 + pl.ph));
    }
    if (t < pl.tGone) {
      const c = seg(t, pl.tC, pl.tGone);
      return pl.h * (1 - 0.74 * ease.inQuad(c));
    }
    return 0;
  }

  function drawPillarHelix(p, pl, h, w0, brk, backPass) {
    if (brk >= 0.44 || h < 20) return;
    const hk = 1 - brk / 0.44;
    for (let s = 0; s < 2; s++) {
      const baseA = s * Math.PI + pl.ph;
      for (let step = 4; step <= h * 0.88; step += 2) {
        const y = Math.round(pl.y - step);
        const v = step / h;
        const ang = baseA - v * TAU * 1.55 + t * 11.2;
        const sn = Math.sin(ang), cs = Math.cos(ang);
        if ((sn < 0) !== backPass) continue;

        const foot = 1 + 0.40 * Math.pow(Math.max(0, 1 - v / 0.16), 2);
        const taper = 1 - smooth(0.62, 0.90, v) * 0.72;
        const rHelix = (w0 * foot * taper * 0.92 + 0.8) * hk;
        const cx = pl.x + pl.lean * v + cs * rHelix;
        const rw = (1.3 + 1.3 * Math.abs(cs)) * taper * hk;

        const cCore = v < 0.24 ? C[1] : v < 0.44 ? C[3] : v < 0.64 ? C[5] : v < 0.82 ? C[6] : C[7];
        const cRim = v < 0.26 ? C[2] : v < 0.52 ? C[3] : C[4];

        for (let dx = -Math.ceil(rw); dx <= Math.ceil(rw); dx++) {
          const q = Math.abs(dx) / Math.max(0.6, rw);
          if (q > 1) continue;
          const col = q < 0.52 ? cCore : cRim;
          p.px(cx + dx, y, col);
          p.px(cx + dx, y + 1, col);
        }

        if (!backPass && Math.abs(cs) > 0.92 && (step % 22) === 0 && v > 0.28 && brk < 0.28) {
          const dirX = cs > 0 ? 0.32 : -0.32;
          const bLayers = v > 0.58 ? CROWN_LAYERS : CROWN_BACK;
          flameBlade(p, cx, y, dirX, -0.95, (8 + 6 * v) * hk, 1.8 * hk, -cs * 1.6, NZ, pl.s + step, H, bLayers);
        }
      }
    }
  }

  // Stage 1: Volcanic / Molten-Fissure Dark-Red Omen Ring ("地面先亮起一圈暗红预兆环" — ZERO magic circle!)
  function drawMoltenOmenRing(p, back) {
    const afterFade = 1 - smooth(3.15, 3.74, t);
    if (afterFade <= 0) return;
    const lockSurge = bump(t, T_LOCK - 0.05, T_FIRST + 0.04);
    const expand = 0.55 + 0.45 * ease.outExpo(clamp(t / 0.14));

    if (back) {
      // 1. Irregular charred soot & obsidian-ash basin inside the molten trough (precomputed, super fast!)
      const sootA = (t < 1.95 ? (0.48 + 0.36 * smooth(0, 0.20, t)) : 0.84 * afterFade * (1 - 0.35 * seg(t, 1.95, 3.50)));
      for (let i = 0; i < basinPx.length; i++) {
        const bp = basinPx[i];
        const d = bp[2] / expand;
        if (d >= 1) continue;
        const px = bp[0], py = bp[1], h = bp[3];
        if (t > 0.22 && t < 3.45 && h < 0.022 && d < 0.88) {
          const coal = 0.5 + 0.5 * Math.sin(t * 18 + px * 0.7 + py);
          p.px(px, py, coal > 0.65 ? C[4] : C[3]);
          continue;
        }
        const a = sootA * (1 - d * d * d);
        if (a > 0.04) p.blend(px, py, d < 0.65 ? C[0] : h < 0.5 ? SOOT : C[1], a);
      }

      // 2. Subtle forked stone floor cracks in the brick floor face (crisp rock cracks, no bright pink center blob!)
      const crackGrow = (c) => c.len * ease.outCubic(clamp((t - c.t0) / 0.26));
      const crackHeatK = (t < 1.80 ? (0.38 + 0.32 * smooth(0, 0.40, t)) : (1 - seg(t, 1.80, 3.20)) * 0.45) + lockSurge * 0.30;
      drawStoneFissures(p, floorCracks, crackGrow, crackHeatK, C, st.lip, afterFade * 0.92);

      // 3. Zig-zagging molten fault lines linking the 6 crater vents across the charred basin
      for (const fl of faultLines) {
        if (t < fl.t0) continue;
        const nPts = Math.floor(fl.pts.length * clamp((t - fl.t0) / 0.18));
        const col = lockSurge > 0.4 ? C[5] : t < 1.85 ? C[4] : t < 2.8 ? C[3] : C[2];
        for (let i = 1; i < nPts; i++) {
          p.line(fl.pts[i - 1][0], fl.pts[i - 1][1], fl.pts[i][0], fl.pts[i][1], col, afterFade * 0.82);
          p.line(fl.pts[i - 1][0], fl.pts[i - 1][1] + 1, fl.pts[i][0], fl.pts[i][1] + 1, C[1], afterFade * 0.65);
        }
      }

      // 4. 6 rocky crater vents + pre-eruption bubbling dark-red magma tongues!
      for (const pl of pillars) {
        const nodeAppear = 0.04 + pl.idx * 0.04;
        if (t < nodeAppear) continue;
        const ng = clamp((t - nodeAppear) / 0.14);
        const ventHot = t < pl.tE ? 0.55 + 0.45 * Math.sin(t * 28 + pl.idx * 1.6) + lockSurge * 0.4 : (1 - seg(t, 1.8, 3.3)) * 0.5;
        drawCraterMouth(p, Math.round(pl.x), Math.round(pl.y), (pl.w * 1.15 + 1.5) * ng, st, ventHot, C, afterFade);

        if (t >= nodeAppear + 0.08 && t < pl.tE) {
          const sk = smooth(nodeAppear + 0.08, pl.tE, t);
          const surgeH = (5 + 13 * sk + 8 * lockSurge) * (0.85 + 0.2 * Math.sin(t * 26 + pl.idx * 2));
          flameTongue(p, pl.x, pl.y, surgeH, (2.2 + 1.5 * sk), pl.lean * 0.12, NZ, pl.s + 99, H, lockSurge > 0.35 ? OMEN_SURGE_LAYERS : OMEN_RIM_LAYERS);
        }
      }

      if (t < 3.40) {
        const gk = (t < T_FIRST ? 0.36 * expand : t < 1.95 ? 0.46 : 0.20 * afterFade) + lockSurge * 0.28;
        floorLight(p, 0, 0.5, RX * expand * 1.08, RY * expand + 6, C[4], gk);
      }
    }

    // 5. Thick, Jagged Molten-Magma Perimeter Trough (layered dark crust -> blood red -> glowing crimson!)
    for (let i = 0; i < N_RIM; i++) {
      const v0 = rimVerts[i], v1 = rimVerts[(i + 1) % N_RIM];
      if (v0.back !== back && v1.back !== back) continue;
      if (t < v0.t0) continue;
      const openK = clamp((t - v0.t0 + 0.03) / 0.10);
      const coolK = 1 - smooth(v0.cool - 0.35, v0.cool + 0.65, t);
      const ka = openK * afterFade;
      if (ka <= 0.02) continue;

      const x0 = v0.x * expand, y0 = 0.5 + (v0.y - 0.5) * expand;
      const xEnd = v1.x * expand, yEnd = 0.5 + (v1.y - 0.5) * expand;
      const x1 = x0 + (xEnd - x0) * openK;
      const y1 = y0 + (yEnd - y0) * openK;

      // Upturned broken stone lip outside the molten fissure
      if (v0.hasLip) {
        const outY = back ? -1.2 : 1.2;
        p.line(x0 * 1.02, y0 + outY, x1 * 1.02, y1 + outY, back ? st.shade : st.lip, ka * 0.85);
      }
      // Wide dark charred magma trench (outer & inner rim)
      p.line(x0 * 1.01, y0, x1 * 1.01, y1, C[1], ka * 0.95);
      p.line(x0 * 0.93, y0 * 0.94, x1 * 0.93, y1 * 0.94, C[2], ka * 0.90);

      // Thick glowing dark-red molten magma channel inside the jagged perimeter!
      if (coolK > 0.04) {
        const pulse = 0.55 + 0.45 * Math.sin(t * 22 + i * 0.8);
        const cOuter = lockSurge > 0.38 ? C[5] : coolK > 0.55 ? C[4] : C[3];
        const cCore = lockSurge > 0.38 ? (pulse > 0.45 ? C[7] : C[6])
          : coolK > 0.65 ? (pulse > 0.50 ? C[6] : C[5])
          : coolK > 0.30 ? C[4] : C[2];
        p.line(x0 * 0.985, y0 * 0.98, x1 * 0.985, y1 * 0.98, cOuter, ka * coolK);
        p.line(x0 * 0.96, y0 * 0.96, x1 * 0.96, y1 * 0.96, cCore, ka * coolK);
        // Perimeter ring magma glow every 4th segment so the RING ITSELF radiates oppressive dark-red light!
        if ((i & 3) === 0 && t < 2.3) {
          p.glow((x0 + x1) * 0.48, (y0 + y1) * 0.48, 9, C[4], (0.28 + 0.20 * lockSurge) * ka * coolK);
        }
      }
    }

    // 6. Continuous boiling wreath of 34 low, wide dark-red omen flames licking out of the molten trough!
    for (const rf of rimFlames) {
      if (rf.back !== back) continue;
      if (t < rf.t0 || t >= rf.tOut) continue;
      const rise = ease.outBack(clamp((t - rf.t0 + 0.02) / 0.09), 1.6);
      const die = 1 - smooth(rf.tOut - 0.55, rf.tOut, t);
      const phaseScale = t < T_FIRST + 0.08 ? (0.95 + 0.55 * lockSurge) : 0.62;
      const fh = rf.h * rise * die * phaseScale * (0.82 + 0.24 * Math.sin(t * 17 + rf.s));
      if (fh < 1.5) continue;
      const fw = rf.w * (0.75 + 0.25 * die) * (1 + 0.22 * lockSurge);
      const layers = lockSurge > 0.38 ? OMEN_SURGE_LAYERS : OMEN_RIM_LAYERS;
      flameTongue(p, rf.x * expand, 0.5 + (rf.y - 0.5) * expand, fh, fw, rf.lean, NZ, rf.s, H, layers, 0.42, 1.1);
    }
  }

  // Stage 2: Staggered Fire Pillars grading via interlocking flame-fangs from ABYSSAL BLACK ROOT -> BRIGHT-RED CROWN!
  function drawPillar(p, pl) {
    const h = pillarHeight(pl);
    if (h < 2) return;
    const uE = t - pl.tE;
    const brk = t < pl.tC ? 0 : seg(t, pl.tC, pl.tGone);
    if (brk >= 1) return;

    const hitSurge = bump(t, T_HIT - 0.02, T_HIT + 0.14);
    const surge = (uE < 0.09 ? 1 + 0.34 * (1 - uE / 0.09) : 1) + 0.20 * hitSurge;
    const w0 = pl.w * surge * (1 - brk * 0.68);

    drawPillarHelix(p, pl, h, w0, brk, true);

    if (brk < 0.62) {
      const ck = (1 - brk / 0.62) * clamp(h / 32);
      const topX = pl.x + pl.lean;
      const layers = pl.back ? CROWN_BACK : CROWN_LAYERS;
      const mainTh = (25 + 13 * (0.5 + 0.5 * NZ(3.8, pl.s + 5))) * ck;
      flameTongue(p, topX, pl.y - h + 16, mainTh, w0 * 0.56 * ck, pl.lean * 0.18, NZ, pl.s + 7, H, layers, 0.68, 1.5);
      const sd = pl.idx % 2 === 0 ? 1 : -1;
      const sideTh = (17 + 9 * (0.5 + 0.5 * NZ(4.2, pl.s + sd * 17))) * ck;
      flameTongue(p, topX + sd * w0 * 0.36, pl.y - h + 19, sideTh, w0 * 0.38 * ck, sd * 1.8 + pl.lean * 0.12, NZ, pl.s + sd * 23, H, layers, 0.56, 1.3);

      p.glow(topX, pl.y - h - mainTh * 0.2, (w0 * 2.4 + 8) * ck, C[6], 0.36 * ck * (pl.back ? 0.75 : 1));

      const wu = fract(t * 2.9 + pl.idx * 0.31);
      const wy = pl.y - h - mainTh * 0.55 - wu * 14;
      const wx = topX + Math.sin(t * 10 + pl.idx) * 3.0;
      const ws = (1 - wu) * 3.2 * ck;
      if (ws > 0.8 && wy > -192) {
        flameBlade(p, wx, wy, 0, -1, ws * 2.1, ws * 0.55, 0, NZ, pl.s + 130, H, [[1, 1, 3], [0.65, 0.78, 2], [0.30, 0.45, 0]]);
      }
    }

    const yBase = Math.round(pl.y);
    const yTop = Math.round(pl.y - h);
    for (let y = yBase; y >= yTop; y--) {
      const v = clamp((pl.y - y) / h, 0, 1);
      const sway = tileFbm(v * 3.5, -t * 4.6, 8, 8, pl.s + 3, 1) * 2.3 * v;
      const cx = pl.x + pl.lean * v + sway;

      let pinch = 1;
      if (brk > 0) {
        const knot = 0.5 + 0.5 * tileFbm(v * 7.4 + pl.idx, -t * 2.8, 8, 8, pl.s + 71, 2);
        if (knot < brk * 1.12 - 0.12) continue;
        pinch = clamp((knot - (brk * 1.12 - 0.12)) * 2.6, 0.16, 1);
      }

      const turbL = Math.max(0, tileFbm(v * 7.2, -t * 6.2, 8, 8, pl.s + 11, 1));
      const turbR = Math.max(0, tileFbm(v * 7.2 + 3.3, -t * 6.2, 8, 8, pl.s + 19, 1));
      const rowNoise = tileFbm(v * 9.5, -t * 7.2, 16, 16, pl.s + 53, 1);
      const foot = 1 + 0.65 * Math.pow(Math.max(0, 1 - v / 0.17), 2);
      const spireTaper = 1 - smooth(0.64, 1.0, v) * 0.82;
      const wl = Math.max(0.6, w0 * foot * spireTaper * (1 + 0.48 * turbL) * pinch);
      const wr = Math.max(0.6, w0 * foot * spireTaper * (1 + 0.48 * turbR) * pinch);

      if (v < 0.29 && brk < 0.5) {
        blackBoxes.push([cx - wl * 0.72, y, cx + wr * 0.72, y]);
      }

      const upPulse = fract(v * 2.4 - t * 4.6 + pl.idx * 0.17) < 0.10 ? 0.11 : 0;
      const fangPh1 = y * 0.18 - t * 15.0 + pl.ph + rowNoise * 2.4;
      const fangPh2 = y * 0.32 - t * 21.0 - pl.ph * 1.3;
      const helixBase = v * 11.0 - t * 13.5 + pl.ph;

      for (let x = Math.floor(cx - wl - 1); x <= Math.ceil(cx + wr + 1); x++) {
        const dx = x + 0.5 - cx;
        const q = Math.abs(dx) / (dx < 0 ? wl : wr);
        if (q > 1) continue;

        const fang = rowNoise * 0.14 + Math.sin(dx * 0.74 + fangPh1) * 0.12 + Math.cos(dx * 1.45 + fangPh2) * 0.08;
        if (v > 0.54 && q > 0.88 && fang < -0.04) continue;

        const helix = Math.sin(helixBase + dx * 0.28);
        const vh = clamp(v * 1.12 + fang + upPulse + helix * 0.06 + hitSurge * 0.10 - 0.14 * q * q - brk * 0.36, 0, 1.10);

        let ci;
        if (q > 0.84) {
          ci = v < 0.28 ? 2 : v < 0.52 ? 3 : v < 0.76 ? 4 : 5;
        } else if (vh < 0.24) {
          ci = 0; // Pitch abyssal black root!
        } else if (vh < 0.35) {
          ci = 1; // Charred obsidian-blood root
        } else if (vh < 0.47) {
          ci = 2; // Clotted dark blood
        } else if (vh < 0.59) {
          ci = 3; // Oppressive dark crimson
        } else if (vh < 0.71) {
          ci = 4; // Deep arterial crimson
        } else if (vh < 0.83) {
          ci = 5; // Vivid scarlet
        } else if (vh < 0.95) {
          ci = pl.back ? 5 : 6; // Blazing BRIGHT RED top (#ff2d37)!
        } else {
          ci = pl.back ? 6 : (q < 0.34 && (v > 0.80 || hitSurge > 0.5) ? 8 : 7);
        }

        if (brk > 0) ci = Math.min(ci, brk > 0.5 ? 4 : 5);
        p.px(x, y, C[ci]);
      }

      if (((yBase - y) % 30) === 0 && v > 0.36) {
        const gk = (0.24 + 0.40 * v + 0.16 * hitSurge) * (1 - brk) * (pl.back ? 0.72 : 1);
        p.glow(cx, y, w0 * 1.8 + 5, v > 0.68 ? C[6] : C[4], gk);
      }
    }

    drawPillarHelix(p, pl, h, w0, brk, false);

    if (brk < 0.55) {
      const rk = (1 - brk / 0.55) * clamp(h / 24);
      for (const sd of [-1, 1]) {
        flameBlade(p, pl.x + sd * w0 * 0.75, pl.y + 0.5, sd * 0.18, -0.98, 14 * rk, 2.3 * rk, -sd * 1.3, NZ, pl.s + 170 + sd * 9, H, ROOT_FANG_LAYERS);
      }
      drawCraterMouth(p, Math.round(pl.x), Math.round(pl.y + 1), w0 * 1.25, st, 0.8 * rk, C, rk);
      if (uE >= 0 && uE < 0.066) {
        const ek = 1 - uE / 0.066;
        p.ellipse(pl.x, pl.y - 1, (w0 + 4) * ek, 2.8 * ek, C[6]);
        p.ellipse(pl.x, pl.y - 1.5, (w0 * 0.6 + 2) * ek, 1.6 * ek, C[8]);
      }
    }

    const iq = (t - pl.tHit) / 0.16;
    if (iq >= 0 && iq < 1) {
      const ix = pl.x + pl.lean * 0.35, iy = pl.impaleY;
      const ik = 1 - iq;
      const iCols = iq < 0.35 ? [C[5], C[7], C[8], WHITE] : [C[3], C[5], C[6], C[7]];
      star(p, ix, iy, pl.impaleSpikes, iq < 0.35 ? 1.05 : 1.24, ik, iCols, ik, 2.0);
      const dir = pl.idx % 2 === 0 ? 1 : -1;
      drawRendScar(p, ix - 17 * dir, iy + 9, ix, iy - 2, ix + 19 * dir, iy - 10, 2.2 * ik, ik, C, iq < 0.3);
    }
  }

  // Stage 3: Devastating Multi-Point Hit Result VFX ("要有命中结果特效")
  function drawHitResult(p) {
    for (const [t0, dur, r0, rSpan, amp] of [[T_FIRST, 0.32, 24, 68, 0.72], [T_HIT, 0.40, 28, 82, 1.0]]) {
      const q0 = t - t0;
      if (q0 < 0 || q0 >= dur) continue;
      const u = q0 / dur;
      const fr = r0 + rSpan * ease.outQuart(u);
      const ch = (8 + 20 * Math.pow(1 - u, 0.8)) * amp, cw = (1.4 + 3.6 * Math.pow(1 - u, 0.9)) * amp;
      const cols = u < 0.18 && amp > 0.9 ? [C[8], C[6], C[4]] : u < 0.5 ? [C[6], C[5], C[3]] : [C[4], C[3], C[1]];
      const ka = u < 0.7 ? 1 : (1 - u) / 0.3;
      for (const s of [-1, 1]) {
        frontCrescent(p, s * fr, s, ch, cw, cols, ka);
        p.glow(s * fr, -ch * 0.35, 7 + ch * 0.45, C[5], 0.36 * (1 - u) * ka);
      }
    }

    if (t < T_HIT) return;
    const q = t - T_HIT;

    if (q < 0.40) {
      const u = q / 0.40;
      const ch = 9 + 21 * Math.pow(1 - u, 0.8), cw = 1.5 + 3.8 * Math.pow(1 - u, 0.9);
      const cols = u < 0.18 ? [C[8], C[6], C[4]] : u < 0.5 ? [C[6], C[5], C[3]] : [C[4], C[3], C[1]];
      const ka = u < 0.7 ? 1 : (1 - u) / 0.3;
      for (const s of [-1, 1]) {
        const mFr = 22 + 72 * ease.outQuart(u);
        frontCrescent(p, hitX + s * mFr, s, ch * 1.12, cw * 0.92, cols, ka * 0.92);
      }

      const r = 22 + 74 * ease.outQuart(u);
      const brk = 0.52 + 0.42 * ease.outQuad(u);
      const th = Math.max(1.0, 3.8 * Math.pow(1 - u, 1.1));
      brokenRing(p, hitX, hitY, r, th, hitSegs, brk, u < 0.2 ? C[8] : C[6], C[3], ka, 0.38, -2);
    }

    if (q < 0.42) {
      const sk = 1 - smooth(0.10, 0.42, q);
      const isHero = q < 0.068;
      drawRendScar(p, -76, hitY + 30, hitX - 4, hitY - 5, 82, hitY - 34, (isHero ? 5.0 : 3.5) * sk, sk, C, isHero);
      drawRendScar(p, -64, hitY - 28, hitX + 5, hitY + 4, 70, hitY + 28, (isHero ? 4.0 : 2.8) * sk, sk * 0.92, C, isHero);
    }

    if (q < 0.22) {
      const sc = q < 0.034 ? 1.06 : q < 0.072 ? 1.44 : 1.24 * (1 - (q - 0.072) / 0.148);
      const th = q < 0.072 ? 1.0 : Math.max(0.3, 1 - (q - 0.072) / 0.15);
      const cols = q < 0.034 ? [C[6], C[8], WHITE, WHITE] : q < 0.072 ? [C[4], C[6], C[8], WHITE] : [C[2], C[4], C[6], C[7]];
      star(p, hitX, hitY, hitSpikesMain, sc, th, cols, 1, 3.6);
      if (q >= 0.02 && q < 0.17) {
        const subK = 1 - (q - 0.02) / 0.15;
        star(p, -30, hitY + 16, hitSpikesSub, 1.15, subK, [C[3], C[5], C[7], C[8]], subK, 2.2);
      }
      if (q < 0.14) {
        const fk = 1 - q / 0.14;
        flare(p, hitX, hitY, 80 * fk, fk, [C[4], C[6], C[7], WHITE]);
      }
      if (q >= 0.034 && q < 0.19) {
        const bu = (q - 0.034) / 0.156;
        const bs = blackStar(hitY, 34 * (1 - ease.inQuad(bu)), 0.36 + bu * 0.32, 0.50, 0.19, 6);
        p.tx += hitX * p.fx;
        bs.draw(p, C[0], bu < 0.45 ? C[8] : C[6], () => false);
        p.tx -= hitX * p.fx;
        blackBoxes.push(["star", bs, hitX]);
      }
    }

    const q2 = t - T_HIT2;
    if (q2 >= 0 && q2 < 0.24) {
      const k2 = 1 - q2 / 0.24;
      const hot2 = q2 < 0.05;
      drawRendScar(p, hit2X - 50, hit2Y + 12, hit2X, hit2Y - 4, hit2X + 48, hit2Y - 14, (hot2 ? 3.8 : 2.6) * k2, k2, C, hot2);
      if (q2 < 0.16) {
        const sk2 = 1 - q2 / 0.16;
        star(p, hit2X, hit2Y, hitSpikesCrown, q2 < 0.04 ? 1.05 : 1.25, sk2, hot2 ? [C[6], C[8], WHITE, WHITE] : [C[4], C[6], C[7], C[8]], sk2, 2.6);
      }
    }
  }

  // Stage 4: Shattering Dark-Red Clots & Falling Dark-Red Embers ("喷完火柱塌缩成暗红余烬落下")
  function drawFallingEmbers(p) {
    for (const c of flameClots) {
      if (!c.active || c.done) continue;
      const k = 1 - c.age / c.life;
      if (k <= 0.05) continue;
      flameTongue(p, c.x, c.y, c.h0 * k, c.w0 * k, c.lean, NZ, c.s, H, CLOT_LAYERS, 0.4, 1.1);
      p.glow(c.x, c.y - c.h0 * 0.3 * k, 5 * k, C[4], 0.28 * k);
    }

    const endFade = 1 - smooth(3.32, 3.75, t);
    if (endFade <= 0) return;
    for (let i = 0; i < fallingEmbers.length; i++) {
      const e = fallingEmbers[i];
      if (t < e.t0 || e.dead) continue;
      const k = e.restAge < 0 ? 1 : clamp(1 - e.restAge / e.restLife) * endFade;
      if (k <= 0.02) continue;
      if (k < 0.26 && Math.sin(t * 44 + e.ph) < 0) continue;

      const ex = Math.round(e.x), ey = Math.round(e.y);
      const age = t - e.t0;
      const fallHeat = e.restAge < 0 ? clamp(1 - age * 0.46, 0.28, 1) * endFade : k * 0.58;
      const core = fallHeat > 0.76 ? C[6] : fallHeat > 0.48 ? C[5] : fallHeat > 0.26 ? C[4] : C[3];
      const mid = fallHeat > 0.52 ? C[4] : fallHeat > 0.28 ? C[3] : C[2];
      const tail = fallHeat > 0.42 ? C[2] : C[1];

      if (e.restAge < 0) {
        const wx = Math.round(-clamp(e.vx * 0.025, -1, 1));
        if (e.size >= 4) {
          p.px(ex + wx * 2, ey - 4, C[0]);
          p.px(ex + wx * 2, ey - 3, C[1]);
          p.px(ex + wx, ey - 2, tail);
          p.px(ex - 1, ey - 1, tail);
          p.px(ex, ey - 1, mid);
          p.px(ex + 1, ey - 1, tail);
          p.px(ex - 1, ey, mid);
          p.px(ex + 1, ey, mid);
          p.px(ex, ey + 1, core);
          p.px(ex, ey, fallHeat > 0.6 ? C[6] : core);
        } else if (e.size >= 3) {
          p.px(ex + wx * 2, ey - 3, C[1]);
          p.px(ex + wx, ey - 2, tail);
          p.px(ex, ey - 1, mid);
          p.px(ex - 1, ey, mid);
          p.px(ex + 1, ey, tail);
          p.px(ex, ey + 1, mid);
          p.px(ex, ey, core);
        } else if (e.size >= 2) {
          p.px(ex + wx, ey - 2, C[1]);
          p.px(ex, ey - 1, tail);
          p.px(ex - 1, ey, tail);
          p.px(ex, ey, core);
        } else {
          p.px(ex, ey - 1, tail);
          p.px(ex, ey, core);
        }
      } else {
        if (e.size >= 3) p.px(ex - 1, ey, mid), p.px(ex + 1, ey, tail), p.px(ex, ey - 1, C[1]);
        else if (e.size >= 2) p.px(ex - 1, ey, tail), p.px(ex + 1, ey, C[1]);
        p.px(ex, ey, core);
      }

      if ((i % 3) === 0 && fallHeat > 0.30) {
        p.glow(ex, ey, 3 + e.size * 1.5, C[4], 0.36 * fallHeat);
      }
    }
  }

  return {
    update(dt) {
      t += dt;

      if (t < T_FIRST) {
        if (R.chance(0.85 * dt * 60)) {
          const a = R.range(0, TAU), d = R.range(52, RX * 1.05);
          const x = Math.cos(a) * d, y = Math.sin(a) * d * SY - R.range(0, 3);
          const life = R.range(0.14, 0.24), sp = (d * 2.3) / (Math.exp(3 * life) - 1);
          ps.spawn(P.STREAK, x, y, (-x / d) * sp, (-y / d) * sp, life, R.chance(0.5) ? C[5] : C[4]);
        }
        if (R.chance(0.55 * dt * 60)) {
          const a = R.range(0, TAU), rr = rimRadiusAt(a);
          ps.spawn(P.GRIT, Math.cos(a) * rr, Math.sin(a) * rr * SY, R.range(-18, 18), -R.range(25, 65), R.range(0.35, 0.65), R.pick([st.light, st.body, C[3]]), 1);
        }
      }

      if (!locked && t >= T_LOCK) {
        locked = true;
        lights.add(0, -6, 78, C[4], 0.78, 0.24);
      }

      for (const pl of pillars) {
        if (!pl.erupted && t >= pl.tE) {
          pl.erupted = true;
          lights.add(pl.x, -pl.h * 0.58, 46, C[5], 0.62, 0.55);
          lights.add(pl.x, pl.y - 4, 22, C[6], 0.66, 0.14);
          for (let i = 0; i < 14; i++) {
            const a = -Math.PI / 2 + R.range(-0.82, 0.82), sp = R.range(90, 215);
            ps.spawn(P.SPARK, pl.x + R.range(-4, 4), pl.y - 1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.22, 0.48));
          }
          for (let i = 0; i < 4; i++) {
            bits.add({
              kind: B.CHUNK, x: pl.x + R.range(-4, 4), y: pl.y - 1,
              vx: R.range(-75, 75), vy: -R.range(105, 220),
              g: 1, drag: 0.45, bounce: 0.32, life: R.range(1.0, 1.6),
              a: R.range(0, TAU), va: R.range(-14, 14), s: R.int(1, 2), pts: rockShape(R),
            });
          }
          for (let i = 0; i < 12; i++) {
            const a = -Math.PI / 2 + R.range(-0.9, 0.9), sp = R.range(65, 175);
            ps.spawn(P.GRIT, pl.x + R.range(-4, 4), pl.y, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.8, 1.35), R.pick([st.light, st.body, C[3]]), R.chance(0.35) ? 2 : 1);
          }
        }

        if (!pl.impaled && t >= pl.tHit) {
          pl.impaled = true;
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + R.range(-1.25, 1.25), sp = R.range(105, 235);
            ps.spawn(P.SPARK, pl.x, pl.impaleY, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.18, 0.36));
          }
        }

        if (pl.erupted && t < pl.tC && R.chance(0.42 * dt * 60)) {
          const topX = pl.x + pl.lean;
          ps.spawn(P.EMBER, topX + R.range(-pl.w, pl.w), pl.y - pl.h + R.range(-6, 10), R.range(-32, 32), -R.range(22, 58), R.range(0.35, 0.62), C[6], R.chance(0.3) ? 2 : 1);
        }

        if (!pl.collapsed && t >= pl.tC) {
          pl.collapsed = true;
          lights.add(pl.x, -pl.h * 0.42, 38, C[4], 0.42, 0.34);
          for (let i = 0; i < 3; i++) {
            const sd = R.sign();
            ps.spawn(P.VAPOUR, pl.x + sd * R.range(2, 7), pl.y - R.range(4, 20), sd * R.range(12, 30), R.range(-5, 7), R.range(0.6, 0.95), mix(C[0], C[2], 0.5), R.range(3.2, 5.2));
          }
        }
      }

      if (!bigHit && t >= T_HIT) {
        bigHit = true;
        lights.add(hitX, hitY, 96, C[5], 0.92, 0.50);
        lights.add(hitX, hitY, 44, WHITE, 0.96, 0.14);
        for (let i = 0; i < 56; i++) {
          const a = R.range(0, TAU), sp = R.range(140, 360);
          ps.spawn(P.SPARK, hitX + R.range(-6, 6), hitY + R.range(-5, 5), Math.cos(a) * sp * 0.85, Math.sin(a) * sp - 20, R.range(0.22, 0.54), WHITE, 1);
        }
        for (let i = 0; i < 18; i++) {
          const a = R.range(0, TAU), sp = R.range(80, 200);
          bits.add({
            kind: B.SHARD, x: hitX + R.range(-5, 5), y: hitY,
            vx: Math.cos(a) * sp * 0.82, vy: Math.sin(a) * sp - 30,
            g: 0.85, drag: 0.85, bounce: 0.34, life: R.range(0.95, 1.55),
            a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(3.8, 6.8),
            isObsidian: true,
          });
        }
      }

      if (!crownHit && t >= T_HIT2) {
        crownHit = true;
        lights.add(hit2X, hit2Y, 62, C[6], 0.68, 0.24);
        for (let i = 0; i < 18; i++) {
          const a = R.range(0, TAU), sp = R.range(115, 265);
          ps.spawn(P.SPARK, hit2X, hit2Y, Math.cos(a) * sp * 0.9, Math.sin(a) * sp, R.range(0.18, 0.40), WHITE, 1);
        }
      }

      for (const c of flameClots) {
        if (c.done || t < c.t0) continue;
        c.active = true;
        c.age += dt;
        if (c.age >= c.life) { c.done = true; continue; }
        c.vy += c.g * dt;
        c.vx *= Math.max(0, 1 - 1.4 * dt);
        c.x += c.vx * dt;
        c.y = Math.min(c.groundY, c.y + c.vy * dt);
      }

      for (const e of fallingEmbers) {
        if (t < e.t0 || e.dead) continue;
        if (e.restAge >= 0) {
          e.restAge += dt;
          if (e.restAge >= e.restLife) e.dead = true;
          continue;
        }
        e.vy += e.g * dt;
        e.vx -= e.vx * e.drag * dt;
        e.vy -= e.vy * (e.drag * 0.52) * dt;
        e.x += (e.vx + Math.sin(t * e.swayFreq + e.ph) * e.swayAmp) * dt;
        e.y += e.vy * dt;
        if (e.vy > 0 && e.y >= e.groundY) {
          if (!e.bounced && e.vy > 45 && R.chance(0.5)) {
            e.bounced = true;
            e.y = e.groundY - 0.3;
            e.vy = -e.vy * 0.26;
            e.vx *= 0.5;
          } else {
            e.y = e.groundY;
            e.restAge = 0;
          }
        }
      }

      bits.update(dt);
      ps.update(dt);
      for (let i = ps.list.length - 1; i >= 0; i--) {
        const q = ps.list[i];
        if (q.x < -134 || q.x > 130 || q.y < -192 || q.y > 24 || t > 3.72) ps.list.splice(i, 1);
      }
      for (let i = bits.list.length - 1; i >= 0; i--) {
        const q = bits.list[i];
        if (q.x < -134 || q.x > 130 || q.y < -190 || q.y > 22 || t > 3.72) bits.list.splice(i, 1);
      }
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-6) return;
      blackBoxes.length = 0;
      drawMoltenOmenRing(p, true);
      ps.draw(p, "back");
      if (t < 2.2) {
        const hk = (0.38 + 0.62 * smooth(0, 0.5, t)) * (1 - smooth(1.6, 2.2, t));
        drawMiasmaDome(p, 46, 32, RY + 2, C[1], 0.30 * hk);
      }
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;

      for (const pl of order) drawPillar(p, pl);

      drawMoltenOmenRing(p, false);
      drawFallingEmbers(p);

      const shardLight = clamp(1 - Math.max(0, t - T_HIT) / 1.1);
      const shardRamp = [C[0], C[1], C[2], C[3], C[4], C[6], C[7], C[8]];
      for (const b of bits.list) {
        if (b.pts) rock(p, b, st);
        else if (b.isObsidian) shard(p, b, shardRamp, hitX, hitY, shardLight);
      }

      ps.draw(p, "front");
      drawHitResult(p);
      lights.draw(p);

      for (const item of blackBoxes) {
        if (item[0] === "star") {
          p.tx += item[2] * p.fx;
          item[1].unlight(p);
          p.tx -= item[2] * p.fx;
        } else {
          unlight(p, item[0], item[1], item[2], item[3], () => true, 0.04);
        }
      }
    },
  };
}
