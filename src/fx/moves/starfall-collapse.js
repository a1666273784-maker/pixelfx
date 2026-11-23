// Starfall Collapse ("moves/starfall-collapse" — 【星陨坍缩】):
// 1. Starfall Descent & Gravitational Black Hole Accretion (0.00..0.96s): A blazing fallen star plunges from the
//    cosmos to the target and collapses into a relativistic tilted Black Hole ("引力黑洞") with a gravitational-lensed
//    far-side arch, photon ring, and Einstein lensing arcs, ripping up large faceted ground boulders ("吸聚碎石")
//    and bending long surrounding starlight ribbons ("吸聚周围光线") into its event horizon.
// 2. Extreme Singularity Compression into a Single Point (0.96..1.24s): The entire accretion disk, warped space-time
//    rings, and orbiting boulders violently implode inward until everything crushes into a single trembling Planck
//    singularity point ("极度压缩成一点") with a razor-sharp anamorphic lens flare in pitch-black silence.
// 3. Cosmic Supernova Detonation & Spatial Distortion Rifts (1.24..2.05s): The singularity detonates ("轰然炸裂")
//    into a burning antimatter supernova sphere, relativistic bipolar quasar jets, chromatic Einstein spatial-distortion
//    waves ("空间扭曲"), sharp angular dimensional space-fractures, and tumbling obsidian meteorite shards.
// 4. Hit Explosion Aftermath — Abyssal Star-Crater, Zero-G Levitating Boulders & Nebula Smoke (1.80..4.20s):
//    Leaves a scorched Starfall Abyssal Crater with glowing violet-gold astral fissures, anti-gravity levitating
//    boulders, lingering spatial fracture scars, and rising cosmic nebula smoke that clears cleanly by 4.20s.
// Relativistic black hole lensing, void sphere, blackStar, Puffs, attract, and shard build on Sprite Fusion's
// open-source black-hole VFX (https://www.spritefusion.com/pixel-art-vfx/black-hole), MIT License, Copyright (c) 2026 Hugo Duprez.
import {
  Particles,
  Bits,
  Lights,
  P,
  B,
  Rng,
  fit,
  band,
  flare,
  sparkle,
  clamp,
  smooth,
  lerp,
  ease,
  noise,
  rand,
  rng,
  hex,
  mix,
  TAU,
  WHITE,
  READY,
} from "../../core/index.js";
import {
  VOID,
  Puffs,
  PK,
  halo,
  ringLight,
  ringFast,
  unlight,
  blackStar,
  attract,
  shard,
} from "../shadow/_lib.js";
import { zigzag, stroke, crackle, scorch, SOOT, SOOT2 } from "../lightning/_lib.js";
import { floorLight } from "../fire/_lib.js";

const TX = 192;                // Initial enemy X
const BH_Y = -54;              // Singularity / Black Hole height above floor
const RS = 15.0;               // Event horizon shadow radius during full accretion
const E_LENS = 19.5;           // Einstein gravitational lensing radius
const SI = 0.25;               // Accretion disk tilt foreshortening
const SI_ARCH = 0.46;          // Gravitational-lensed upper/lower arch foreshortening
const TILT = -0.16;            // Relativistic accretion disk tilt angle
const CT = Math.cos(TILT);
const ST_SIN = Math.sin(TILT);
const ROUT = 64;               // Outer accretion disk radius
const REACH_CRACK = 68;        // Astral crater fissure reach
const SY = 0.22;

const PULL_IN = -8;            // Gravitational pull-in slide before detonation
const SLIDE_1 = 16;            // Supernova detonation knockback
const SLIDE_2 = 24;            // Secondary quasar collapse knockback

// Choreography timing constants (seconds)
const T_CAST = 0.06;           // Caster hurls gravity seed & summons falling star
const T_BH = 0.34;             // Falling star collapses into the Gravitational Black Hole at (TX, BH_Y)
const T_COMPRESS = 0.94;       // Accretion disk & warped space begin violent inward collapse
const T_POINT = 1.07;          // Crushed down into a single trembling Planck singularity point ("极度压缩成一点", captures Frame 34 at 1.13s)
const T_DETONATE = 1.24;       // Cataclysmic Cosmic Supernova detonation ("轰然炸裂")
const T_POP = 1.82;            // Secondary core collapse & quasar shock-pop
const T_END = 4.20;

const BANDS = [
  { r0: 18.5, r1: 25.5, n: 5, hot: 1.42, k: 0.3, gold: true },
  { r0: 27.5, r1: 36.5, n: 3, hot: 1.00, k: 1.9, gold: false },
  { r0: 38.5, r1: 49.5, n: 2, hot: 0.72, k: 3.7, gold: true },
  { r0: 51.5, r1: 64.0, n: 1, hot: 0.48, k: 5.2, gold: false },
];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const SMOKE_HEX = hex("#483c5c");

export const meta = {
  name: "Starfall collapse",
  desc: "A falling star collapses into a lensed black hole that rips light and boulders inward, crushes to a single point, and detonates in a space-warping supernova.",
  tags: ["move", "boss", "shadow", "space", "black-hole", "gravity", "star", "explosion", "ultimate", "one-shot"],
  size: [436, 264],
  origin: [88, 214],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    // 8-step Cosmic Void & Violet Singularity ramp
    palette: VOID,
    // 7-step Stellar Gold & Quasar Amber ramp ("星陨流金与吸积盘高温环")
    star: ["#241104", "#5c2c08", "#a85610", "#e88e1c", "#ffc842", "#ffee96", "#ffffff"],
    // 6-step Relativistic Doppler Cyan & Spatial Distortion ramp ("空间扭曲蓝移光环")
    cyan: ["#061c2e", "#104268", "#1e7eb8", "#48c4f6", "#a4ecff", "#ffffff"],
    // 4-step Meteorite & Levitating Rubble ramp ("星骸碎石")
    rock: ["#120d1c", "#2e2440", "#544468", "#857399"],
    seed: 19,
  },
};

// Caster choreography: guard -> cosmic gather -> starfall point -> gravity pull -> fist clench compress -> supernova release -> recovery
const GUARD = { ...READY, x: 0, crouch: 2, lean: 1, fx: 11, fy: -21, bx: -6, by: -20, ffx: 8, fbx: -8 };
const GATHER = { ...GUARD, x: -4, crouch: 4, lean: -3, turn: 0.75, fx: -2, fy: -28, bx: 7, by: -26, armsFront: true, ffx: 6, fbx: -9 };
const STAR_CALL = { ...GUARD, x: 4, crouch: 2, lean: 3, turn: 0.50, hy: -2, fx: 16, fy: -34, bx: -6, by: -22, ffx: 10, fbx: -8, ghost: 1 };
const GRAV_WELL = { ...GUARD, x: 6, crouch: 4, lean: 4, turn: 0.65, fx: 17, fy: -24, bx: 9, by: -22, armsFront: true, ffx: 11, fbx: -8 };
const CLENCH_POINT = { ...GUARD, x: 2, crouch: 6, lean: -4, turn: 0.90, hy: 1, fx: 4, fy: -26, bx: 8, by: -25, armsFront: true, ffx: 8, fbx: -9, ghost: 1 };
const NOVA_BLAST = { ...GUARD, x: 11, crouch: 7, lean: 6, turn: 0.35, hy: 2, fx: 19, fy: -15, bx: -9, by: -18, ffx: 13, fbx: -9, toeB: true, ghost: 1 };
const RECOVER = { ...GUARD, x: 4, crouch: 3, lean: 1, fx: 13, fy: -21 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.28, GUARD],
    [-0.08, GATHER],
    [T_CAST, STAR_CALL, "snap"],
    [T_BH, GRAV_WELL, "snap"],
    [T_COMPRESS, CLENCH_POINT, "snap"],
    [T_DETONATE, NOVA_BLAST, "snap"],
    [T_POP, { ...NOVA_BLAST, x: 12, fy: -18, ghost: 1 }, "snap"],
    [2.50, RECOVER],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_BH, stop: 0.06, shake: 0.32, amp: 2.8, push: -3.2, slide: PULL_IN, straw: 18, y: -30, skin: "shadow", shiver: 0.55, flash: 0.05 },
    { t: T_COMPRESS, stop: 0.05, shake: 0.24, amp: 2.4, push: -2.0, slide: PULL_IN - 2, straw: 14, y: -32, skin: "shadow", shiver: 0.70, flash: 0.04 },
    { t: T_DETONATE, stop: 0.19, shake: 0.62, amp: 6.4, push: 5.8, slide: SLIDE_1, straw: 42, y: -28, skin: "shock", shiver: 0.65, flash: 0.09 },
    { t: T_POP, stop: 0.10, shake: 0.48, amp: 5.2, push: 4.8, slide: SLIDE_2, daze: 1.45, straw: 34, y: -26, skin: "char", shiver: 0.60, flash: 0.08 },
    { t: 2.35, push: 0, straw: 0, flash: 0, skin: "shadow", shiver: 0.32 },
    { t: T_END - 0.32, push: 0, straw: 0, flash: 0, skin: null, daze: 0, shiver: 0 },
  ],
  dust: [
    { t: T_CAST, x: 6, n: 5, dir: 1 },
    { t: T_BH, x: TX, n: 10, dir: -1 },
    { t: T_DETONATE, x: TX - 12, n: 14, dir: -1 },
    { t: T_DETONATE, x: TX + 16, n: 16, dir: 1 },
    { t: T_POP, x: TX + 22, n: 12, dir: 1 },
  ],
};

// Safe local bounds inside [436, 264] with origin [88, 214] -> x in [-88..347], y in [-214..49]
const X_MIN = -82, X_MAX = 340, Y_MIN = -208, Y_MAX = 42;

// Brightness of the relativistic accretion disk at a point of its plane (X across, Z away from us)
function sampleAccretionDisk(X, Z, t, scale = 1) {
  const rho = Math.sqrt(X * X + Z * Z) / Math.max(0.08, scale);
  for (const b of BANDS) {
    if (rho < b.r0 || rho > b.r1) continue;
    const w = (rho - b.r0) / (b.r1 - b.r0);
    const ph = Math.atan2(Z, X) - TAU * b.n * t * 0.65;
    const streak = 0.62 + 0.22 * Math.cos(7 * ph + rho * 0.8 + b.k) + 0.16 * Math.cos(13 * ph - rho * 1.6 + b.k * 2);
    const lane = 0.72 + 0.28 * Math.cos(rho * 2.3 + b.k);
    const edge = smooth(0, 0.18, w) * (1 - smooth(0.78, 1, w));
    return { I: b.hot * streak * lane * (0.35 + 0.65 * edge), dop: -X / (rho * scale || 1), gold: b.gold };
  }
  return null;
}

// Render the Gravitational-Lensed Black Hole & Accretion Disk around (cx, cy) with scale factor `sc`
function drawLensedBlackHole(p, cx, cy, sc, C, ST, CY, t, pulse) {
  if (sc <= 0.04) return;
  const rs = RS * sc;
  const eLens = E_LENS * sc;
  const RAMP_V = [C[1], C[2], C[3], C[4], C[5], C[6], C[7], WHITE];
  const RAMP_G = [C[1], ST[1], ST[2], ST[3], ST[4], ST[5], ST[6], WHITE];
  const n = RAMP_V.length;
  const W = Math.ceil((ROUT + 4) * sc);
  const H = Math.ceil(46 * sc);

  p.shade(cx - W, cy - H, cx + W, cy + H, (x, y, out) => {
    const dx = x - cx, dy = y - cy;
    const u = dx * CT + dy * ST_SIN;
    const v = -dx * ST_SIN + dy * CT;
    const r = Math.sqrt(u * u + v * v);
    let s = null;
    if (v > 0) s = sampleAccretionDisk(u, -v / SI, t, sc);
    if (!s && r > rs) {
      const k = 1 - (eLens * eLens) / (r * r);
      const bu = u * k, bv = v * k;
      const si = k > 0 ? SI_ARCH : SI;
      if (-bv / si > 0) s = sampleAccretionDisk(bu, -bv / si, t, sc);
    }
    if (!s || s.I < 0.06) {
      if (r < rs - 0.4) return C[0];
      if (r < rs + 0.85) {
        const a = Math.atan2(v, u);
        const f = 0.5 + 0.5 * Math.cos(3 * a + TAU * 1.4 * t) + pulse * 0.4;
        out.k = 0.35;
        return f > 0.52 ? WHITE : ST[5];
      }
      return;
    }
    const I = s.I * 1.32 * (1 + 0.55 * s.dop) * (1 + 0.25 * pulse);
    const f = clamp(I) * (n - 1);
    let i = Math.floor(f);
    if (f - i > BAYER[((Math.floor(y) & 3) << 2) | (Math.floor(x) & 3)]) i = Math.min(n - 1, i + 1);
    if (i === 0 && I < 0.12) return;
    const RAMP = s.gold ? RAMP_G : RAMP_V;
    let c = RAMP[i];
    if (s.dop > 0.32 && i >= n - 3) c = mix(c, CY[4], Math.min(1, (s.dop - 0.32) * 2.1));
    if (s.dop < -0.38 && i >= 2 && i < n - 2) c = mix(c, C[3], 0.35);
    if (i >= n - 4 && ((Math.floor(x) + Math.floor(y)) & 1) === 0) out.k = 0.32 * Math.min(1, I - 0.35);
    return c;
  });
}

// Render a 3D Faceted Meteorite / Ground Boulder Chunk ("被引力撕裂吸聚的星骸巨石") lit on the face toward (lx, ly)
function drawFacetedBoulder(p, cx, cy, rad, rot, lx, ly, K, ST, C, glowK = 0.25) {
  if (rad < 1.2) return;
  const E = Math.ceil(rad + 1.5);
  const ca = Math.cos(rot), sa = Math.sin(rot);
  const toLx = lx - cx, toLy = ly - cy;
  const dL = Math.hypot(toLx, toLy) || 1;
  const ux = toLx / dL, uy = toLy / dL;

  p.shade(cx - E, cy - E, cx + E, cy + E, (x, y) => {
    const dx = x - cx, dy = y - cy;
    const u = dx * ca + dy * sa;
    const v = -dx * sa + dy * ca;
    // Octagonal / craggy asteroid silhouette
    const dOct = Math.max(
      Math.abs(u) * 0.92 + Math.abs(v) * 0.45,
      Math.abs(v) * 0.95 + Math.abs(u) * 0.42,
      Math.hypot(u, v) * 0.88,
    );
    if (dOct > rad) return;
    const facing = (dx * ux + dy * uy) / rad;
    if (dOct > rad - 1.0 && facing > 0.25) return facing > 0.65 ? ST[5] : C[6];
    if (facing > 0.35) return K[3];
    if (facing > -0.15) return K[2];
    if (facing > -0.55) return K[1];
    return K[0];
  });
  if (glowK > 0.04) p.glow(cx, cy, rad * 2.2, C[5], glowK);
}

// Render the burning Antimatter Supernova Sphere at (cx, cy) during Phase 3 Detonation
function drawSupernovaSphere(p, cx, cy, r, t, heat, C, ST, CY) {
  if (r < 0.6) return;
  const E = r + 14 * heat + 2;
  p.shade(cx - E, cy - E, cx + E, cy + E, (x, y, out) => {
    const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
    if (d > E) return;
    if (d < r - 0.5) {
      const e = r - d, ang = Math.atan2(dy, dx);
      if (e < 1.5 && Math.cos(ang - 0.8) > 0.52) return C[3];
      if (r > 8 && (dx + r * 0.42) ** 2 + (dy + r * 0.42) ** 2 < 2.0) return ST[4];
      return C[0];
    }
    const e = d - (r - 0.5);
    if (e < 1.1) {
      out.c = Math.sin(Math.atan2(dy, dx) * 8 + t * 12) > -0.5 ? WHITE : ST[5];
      out.k = 0.45;
      return;
    }
    const ang = Math.atan2(dy + e * 0.55, dx), top = Math.max(0, -Math.sin(ang));
    const a1 = ang - t * 1.1, a2 = ang + t * 1.9;
    const i1 = Math.round((a1 * 9) / TAU), i2 = Math.round((a2 * 15) / TAU);
    const T1 = Math.pow(0.5 + 0.5 * Math.cos(a1 * 9), 3) * (0.55 + 0.45 * noise(t * 7 + i1 * 3.7, 1));
    const T2 = Math.pow(0.5 + 0.5 * Math.cos(a2 * 15), 4) * (0.5 + 0.5 * noise(t * 11 + i2 * 5.1, 2));
    const h = heat * (0.35 + 0.95 * top) * (1.6 + 13 * Math.max(0, T1) + 6.5 * Math.max(0, T2));
    if (e > h + 1) return;
    const u = (e - 1) / h;
    const isGold = ((i1 + i2) & 1) === 0;
    out.c = u < 0.18 ? WHITE : u < 0.42 ? (isGold ? ST[5] : CY[4]) : u < 0.64 ? C[6] : u < 0.84 ? C[5] : C[3];
    out.a = u < 0.8 ? 1 : (1 - u) * 5;
    if (u < 0.6 && ((Math.floor(x) + Math.floor(y)) & 1) === 0) out.k = 0.28 * (1 - u);
  });
}

// Relativistic Einstein Lensing Crescent Arcs ("空间扭曲·爱因斯坦引力透镜弧"):
// Paired crescent arcs of warped space-time around (cx, cy) with chromatic cyan/gold/violet dispersion
function drawEinsteinLensingArcs(p, cx, cy, r, rot, span, alpha, C, CY, ST) {
  if (r <= 3 || alpha <= 0.04) return;
  for (const side of [0, Math.PI]) {
    const aMid = rot + side;
    const steps = Math.max(20, Math.ceil(r * span * 1.2));
    for (let i = 0; i < steps; i++) {
      const u0 = (i / steps) * 2 - 1;
      const u1 = ((i + 1) / steps) * 2 - 1;
      const a0 = aMid + u0 * span;
      const a1 = aMid + u1 * span;
      const env = (1 - u0 * u0) * alpha;
      if (env <= 0.04) continue;

      const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r * 0.86;
      const x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r * 0.86;
      if (y0 > 2 || y1 > 2 || y0 < Y_MIN + 4 || y1 < Y_MIN + 4) continue;

      const nx = Math.cos(a0), ny = Math.sin(a0);
      p.line(x0 + nx * 1.3, y0 + ny * 1.3, x1 + nx * 1.3, y1 + ny * 1.3, CY[3], env * 0.72);
      p.line(x0 - nx * 1.3, y0 - ny * 1.3, x1 - nx * 1.3, y1 - ny * 1.3, ST[4], env * 0.72);
      p.line(x0, y0, x1, y1, Math.abs(u0) < 0.38 ? WHITE : C[6], env);
    }
  }
}

// Sharp Angular Dimensional Space-Fracture ("空间碎裂裂隙"): pre-baked sharp polygonal void tear with branching sub-cracks
function drawAngularSpaceFracture(p, pts, branchPts, maxW, openU, C, CY, ST) {
  if (openU <= 0.04) return;
  const drawPoly = (poly, wScale) => {
    const nSeg = poly.length - 1;
    for (let i = 0; i < nSeg; i++) {
      const [x0, y0] = poly[i], [x1, y1] = poly[i + 1];
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const steps = Math.ceil(len * 1.5);
      for (let s = 0; s <= steps; s++) {
        const uSeg = s / steps;
        const uTotal = (i + uSeg) / nSeg;
        const env = Math.sin(uTotal * Math.PI) * openU;
        const hw = maxW * wScale * env;
        if (hw < 0.35) continue;
        const cx = x0 + dx * uSeg, cy = y0 + dy * uSeg;
        const bound = Math.ceil(hw + 1.4);
        for (let w = -bound; w <= bound; w++) {
          const px = Math.round(cx + nx * w), py = Math.round(cy + ny * w);
          if (px < X_MIN + 4 || px > X_MAX - 4 || py < Y_MIN + 4 || py > 2) continue;
          const aw = Math.abs(w);
          if (aw <= hw * 0.52) {
            p.px(px, py, ((px * 11 + py * 17) & 31) === 0 ? CY[4] : C[0]);
          } else if (aw <= hw + 0.55) {
            p.px(px, py, uTotal > 0.2 && uTotal < 0.8 ? WHITE : CY[4]);
          } else if (aw <= hw + 1.3) {
            p.blend(px, py, (px + py) & 1 ? C[5] : ST[4], 0.72 * openU);
          }
        }
      }
    }
  };
  drawPoly(pts, 1.0);
  if (branchPts) drawPoly(branchPts, 0.58);
}

// Branching Astral Crater Fissures on the floor around (cx, 0)
function buildAstralCracks(R, cx) {
  const out = [];
  const grow = (x, y, a, len, w, d, depth) => {
    const pts = [[x, y, d]];
    for (let s = 0; s < len; s += 1.6) {
      a += R.range(-0.30, 0.30);
      x += Math.cos(a) * 1.6;
      y = clamp(y + Math.sin(a) * 0.46, -2, 8);
      d += 1.6;
      pts.push([x, y, d]);
      if (depth < 2 && s > 4 && R.chance(0.11)) {
        grow(x, y, a + R.sign() * R.range(0.5, 1.15), (len - s) * R.range(0.35, 0.65), w * 0.6, d, depth + 1);
      }
    }
    out.push({ pts, w });
  };
  for (let i = 0; i < 8; i++) {
    const a0 = i % 2 === 0 ? R.range(-0.45, 0.65) : Math.PI + R.range(-0.65, 0.45);
    grow(cx + R.range(-2, 2), R.range(0, 1), a0, REACH_CRACK * R.range(0.62, 1.05), 1, 0, 0);
  }
  return out;
}

export function create(o) {
  const C = fit(o.palette, 8);
  const ST = fit(o.star, 7);
  const CY = fit(o.cyan, 6);
  const K = fit(o.rock, 4);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, ST[5], CY[4], C[6], C[5]],
  });
  const embers = new Particles({
    rng: R,
    ground: floor,
    sparks: [ST[5], C[6], CY[3], C[4]],
  });
  const puffs = new Puffs({
    rng: R,
    flame: [WHITE, ST[5], CY[4], C[6], C[5], ST[3], C[4], C[3], C[2]],
    soot: [mix(mix(C[3], C[1], 0.3), SMOKE_HEX, 0.45), mix(C[1], SMOKE_HEX, 0.3)],
    cap: mix(mix(C[4], C[2], 0.5), SMOKE_HEX, 0.4),
    rim: [ST[5], C[6], C[4]],
    floor,
  });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();
  const shockRings = [];

  // Prebake 18 Long Inward-Bending Starlight Ribbons ("吸聚周围光线") pulled into the Black Hole from across the sky
  const lightRibbons = Array.from({ length: 18 }, (_, i) => {
    const a0 = (i / 18) * TAU + R.range(-0.08, 0.08);
    const d0 = R.range(78, 128);
    const t0 = R.range(T_BH - 0.02, T_COMPRESS - 0.24);
    const dur = Math.min(R.range(0.32, 0.48), T_POINT - t0);
    const swirl = (i % 2 === 0 ? 1 : -1) * R.range(1.2, 2.1);
    const kind = i % 3; // 0: violet-white, 1: stellar gold, 2: Doppler cyan
    return { a0, d0, t0, dur, swirl, kind };
  });

  // Prebake 16 Large Faceted Ground Boulders ("吸聚碎石") ripped out of the floor and spiraled into the Black Hole
  const accretedBoulders = Array.from({ length: 16 }, (_, i) => {
    const uX = i / 15;
    const x0 = lerp(TX - 92, TX + 92, uX) + R.range(-5, 5);
    const ph0 = (i / 16) * TAU + R.range(-0.15, 0.15);
    const rho0 = R.range(52, 86);
    const hgt = R.range(-18, 18);
    const rad = R.range(2.6, 4.4); // Chunky 5x5 to 9x9 pixel faceted boulders!
    const rot0 = R.range(0, TAU);
    const spin = R.sign() * R.range(4, 9);
    const t0 = R.range(T_BH - 0.02, T_COMPRESS - 0.32);
    const L = Math.min(R.range(0.44, 0.66), T_POINT - t0);
    return { x0, ph0, rho0, hgt, rad, rot0, spin, t0, L };
  });

  // Prebake 42 Background Cosmic Stars in the darkened void around the target that warp toward the singularity
  const bgStars = Array.from({ length: 42 }, () => ({
    x: TX + R.range(-135, 120),
    y: R.range(-196, -18),
    ph: R.range(0, TAU),
    big: R.chance(0.28),
    colIdx: R.int(0, 2),
  }));

  // Prebake 6 Sharp Angular Dimensional Space-Fractures ("空间碎裂裂隙") around (TX, BH_Y)
  const spaceFractures = [
    {
      pts: [[TX - 82, BH_Y - 58], [TX - 62, BH_Y - 46], [TX - 50, BH_Y - 28], [TX - 30, BH_Y - 18]],
      branch: [[TX - 62, BH_Y - 46], [TX - 44, BH_Y - 54], [TX - 32, BH_Y - 48]],
      w: 3.2,
      t0: T_DETONATE + 0.02,
      life: 1.05,
    },
    {
      pts: [[TX + 30, BH_Y - 22], [TX + 48, BH_Y - 38], [TX + 64, BH_Y - 46], [TX + 86, BH_Y - 66]],
      branch: [[TX + 48, BH_Y - 38], [TX + 68, BH_Y - 26], [TX + 80, BH_Y - 30]],
      w: 3.4,
      t0: T_DETONATE + 0.03,
      life: 1.12,
    },
    {
      pts: [[TX - 86, BH_Y + 28], [TX - 64, BH_Y + 14], [TX - 48, BH_Y + 22], [TX - 30, BH_Y + 8]],
      branch: [[TX - 64, BH_Y + 14], [TX - 54, BH_Y - 2]],
      w: 2.8,
      t0: T_DETONATE + 0.04,
      life: 0.98,
    },
    {
      pts: [[TX + 32, BH_Y + 10], [TX + 52, BH_Y + 24], [TX + 68, BH_Y + 18], [TX + 90, BH_Y + 34]],
      branch: [[TX + 52, BH_Y + 24], [TX + 44, BH_Y + 38]],
      w: 3.0,
      t0: T_DETONATE + 0.04,
      life: 1.08,
    },
    {
      pts: [[TX - 32, BH_Y - 96], [TX - 10, BH_Y - 82], [TX + 8, BH_Y - 88], [TX + 30, BH_Y - 72]],
      branch: [[TX - 10, BH_Y - 82], [TX - 18, BH_Y - 66]],
      w: 2.8,
      t0: T_DETONATE + 0.06,
      life: 0.92,
    },
    {
      pts: [[TX + 44, BH_Y - 12], [TX + 66, BH_Y - 4], [TX + 78, BH_Y - 16], [TX + 96, BH_Y - 6]],
      branch: null,
      w: 2.6,
      t0: T_POP + 0.02,
      life: 0.88,
    },
  ];

  // Prebake 20 Anti-Gravity Levitating Crater Boulders & Stardust Orbs ("反重力悬浮碎石与星尘") in Phase 4 Aftermath
  const zeroGRocks = Array.from({ length: 20 }, (_, i) => {
    const x0 = TX + 14 + R.range(-64, 64);
    const t0 = R.range(T_DETONATE + 0.22, 2.20);
    const life = Math.min(R.range(1.35, 2.00), T_END - 0.08 - t0);
    const maxH = R.range(20, 68);
    const driftX = R.range(-10, 12);
    const rad = R.range(1.8, 3.2);
    const rot0 = R.range(0, TAU);
    const spin = R.sign() * R.range(2, 5);
    const phase = R.range(0, TAU);
    const isGold = i % 2 === 0;
    return { x0, t0, life, maxH, driftX, rad, rot0, spin, phase, isGold };
  });

  // Prebake Branching Astral Crater Fissures on the floor
  const crackTree = buildAstralCracks(R, TX + 14);

  let t = 0;
  let bhFormed = false;
  let detonated = false;
  let popped = false;
  let acc = 0;
  let dustAcc = 0;
  let flick = 1;

  const capLife = (l) => Math.max(0.08, Math.min(l, T_END - 0.10 - t));

  // Scale of the Black Hole & Accretion Disk from birth (0.34s) -> full size -> extreme compression to a single point (1.07..1.24s)
  const bhScale = (tt) => {
    if (tt < T_BH || tt >= T_DETONATE) return 0;
    if (tt < T_BH + 0.14) return ease.outBack(clamp((tt - T_BH) / 0.14), 1.8);
    if (tt < T_COMPRESS) return 1.0 + 0.04 * Math.sin((tt - T_BH) * 14);
    if (tt < T_POINT) return Math.max(0.0, 1 - ease.inCubic(clamp((tt - T_COMPRESS) / (T_POINT - T_COMPRESS))));
    return 0; // Completely crushed into a single Planck point during [T_POINT = 1.07s, T_DETONATE = 1.24s)!
  };

  // Radius of the Supernova Void-Fire Sphere during Phase 3 (1.24..1.82s)
  const novaSphereR = (tt) => {
    if (tt < T_DETONATE || tt >= T_POP) return 0;
    const RS_NOVA = 24;
    if (tt < T_DETONATE + 0.16) return RS_NOVA * ease.outBack(clamp((tt - T_DETONATE) / 0.16), 2.2);
    if (tt < T_POP - 0.16) return RS_NOVA * (1 + 0.06 * Math.sin(tt * 18));
    return RS_NOVA * 1.06 * (1 - ease.inQuad(clamp((tt - (T_POP - 0.16)) / 0.16)));
  };

  function triggerSupernova() {
    lights.add(TX, BH_Y, 128, C[5], 1.20, 0.72);
    lights.add(TX, BH_Y, 96, ST[5], 1.10, 0.34);
    lights.add(TX, BH_Y, 64, WHITE, 1.25, 0.16);

    shockRings.push({ cx: TX, cy: BH_Y, r0: 6, r1: 118, life: 0.48, max: 0.48, th: 4.2, hot: true, gold: true, delay: 0 });
    shockRings.push({ cx: TX, cy: BH_Y, r0: 4, r1: 78, life: 0.32, max: 0.32, th: 2.2, hot: true, gold: false, delay: 0.03 });
    shockRings.push({ cx: TX, cy: BH_Y, r0: 8, r1: 136, life: 0.64, max: 0.64, th: 1.6, hot: false, gold: false, delay: 0.07 });

    // 36 Obsidian & Meteorite Shards blasted out from the supernova rim
    for (let i = 0; i < 36; i++) {
      const big = i < 20;
      const a = R.range(0, TAU);
      const x = TX + Math.cos(a) * 14, y = BH_Y + Math.sin(a) * 14;
      const sp = big ? R.range(85, 185) : R.range(135, 240);
      bits.add({
        kind: B.SHARD,
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - R.range(35, 105),
        g: 0.75,
        drag: big ? 1.3 : 1.7,
        bounce: 0.35,
        life: capLife(R.range(1.5, 2.4)),
        a: R.range(0, TAU),
        va: R.range(-16, 16),
        s: big ? R.range(6, 11) : R.range(3, 5),
      });
    }

    // 88 High-velocity Supernova Sparks & Stars
    for (let i = 0; i < 88; i++) {
      const a = R.range(0, TAU), sp = R.range(120, 260);
      ps.spawn(P.SPARK, TX + Math.cos(a) * 12, BH_Y + Math.sin(a) * 12, Math.cos(a) * sp, Math.sin(a) * sp - 45, capLife(R.range(0.22, 0.68)));
    }
    for (let i = 0; i < 30; i++) {
      const a = R.range(0, TAU), sp = R.range(35, 140);
      embers.spawn(P.EMBER, TX + Math.cos(a) * 14, BH_Y + Math.sin(a) * 14, Math.cos(a) * sp, Math.sin(a) * sp - 38, capLife(R.range(1.2, 2.3)));
    }
    for (let i = 0; i < 22; i++) {
      const a = R.range(0, TAU), sp = R.range(18, 72);
      puffs.spawn(PK.SOOT, TX + Math.cos(a) * 14, BH_Y + Math.sin(a) * 14, Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 14, capLife(R.range(1.8, 2.5)), R.range(7, 12), R.range(0.02, 0.26));
    }
    for (let i = 0; i < 12; i++) {
      const s = i % 2 ? 1 : -1;
      puffs.spawn(PK.SOOT, TX + s * R.range(10, 42), -R.range(2, 5), s * R.range(50, 120), -R.range(2, 12), capLife(R.range(1.5, 2.2)), R.range(5, 9), R.range(0.06, 0.18));
    }
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + R.range(-1.5, 1.5), sp = R.range(32, 84);
      puffs.spawn(PK.FLAME, TX + Math.cos(a) * 16, BH_Y + Math.sin(a) * 16, Math.cos(a) * sp, Math.sin(a) * sp - 28, capLife(R.range(0.30, 0.58)), R.range(2.2, 3.8), 0, R.chance(0.5));
    }
  }

  function triggerCollapsePop() {
    lights.add(TX, BH_Y, 64, WHITE, 0.95, 0.18);
    lights.add(TX, BH_Y, 124, ST[4], 0.85, 0.48);
    shockRings.push({ cx: TX, cy: BH_Y, r0: 3, r1: 68, life: 0.34, max: 0.34, th: 2.6, hot: true, gold: true, delay: 0 });

    for (let i = 0; i < 32; i++) {
      const a = R.range(0, TAU), sp = R.range(120, 250);
      ps.spawn(P.SPARK, TX, BH_Y, Math.cos(a) * sp, Math.sin(a) * sp - 38, capLife(R.range(0.22, 0.58)));
    }
    for (let i = 0; i < 16; i++) {
      const a = R.range(0, TAU), sp = R.range(24, 95);
      embers.spawn(P.EMBER, TX, BH_Y, Math.cos(a) * sp, Math.sin(a) * sp - 30, capLife(R.range(0.9, 1.6)));
    }
    for (let i = 0; i < 14; i++) {
      puffs.spawn(PK.SOOT, TX + R.range(-8, 8), BH_Y + R.range(-4, 6), R.range(-12, 12), -R.range(20, 52), capLife(R.range(1.2, 1.7)), R.range(6, 11), R.range(0.02, 0.16));
    }
  }

  // PHASE 1 & 2: Falling Star Descent, Relativistic Black Hole Accretion of Light & Boulders, and Extreme Singularity Point Compression
  function drawBlackHoleAndCompression(p, isBack) {
    if (t >= T_DETONATE + 0.06) return;

    // 1. Caster Hand Gravity Orb & Falling Star Plunge (0.00..0.38s)
    if (!isBack && t < T_BH + 0.06) {
      const uCast = clamp(t / T_BH);
      const rSeed = 5 * Math.sin(uCast * Math.PI);
      if (rSeed > 0.5) {
        p.disc(16, -32, rSeed + 2, C[0], 0.9);
        p.ring(16, -32, rSeed + 2.5, 1.2, ST[5]);
        flare(p, 16, -32, 14 * Math.sin(uCast * Math.PI), 0.8, [C[4], ST[4], WHITE]);
      }

      if (t >= T_CAST) {
        const uStar = clamp((t - T_CAST) / (T_BH - T_CAST));
        const eStar = ease.inQuad(uStar);
        const sx0 = 68, sy0 = -200;
        const sx = lerp(sx0, TX, eStar);
        const sy = lerp(sy0, BH_Y, eStar);

        const nWake = 18;
        for (let k = nWake; k >= 1; k--) {
          const uPrev = clamp(uStar - k * 0.032);
          const uPrev2 = clamp(uStar - (k - 1) * 0.032);
          const ax = lerp(sx0, TX, ease.inQuad(uPrev));
          const ay = lerp(sy0, BH_Y, ease.inQuad(uPrev));
          const bx = lerp(sx0, TX, ease.inQuad(uPrev2));
          const by = lerp(sy0, BH_Y, ease.inQuad(uPrev2));
          const wU = k / nWake;
          const col = wU < 0.22 ? WHITE : wU < 0.48 ? ST[5] : wU < 0.75 ? C[6] : C[4];
          p.beam(ax, ay, bx, by, Math.max(1.2, (1 - wU) * 7.5), () => col);
          if ((k & 3) === 0) p.glow(ax, ay, 14 * (1 - wU), ST[4], 0.38 * (1 - wU));
        }

        p.disc(sx, sy, 8, ST[4], 0.75);
        p.disc(sx, sy, 5, WHITE, 0.95);
        flare(p, sx, sy, 26, 0.92, [C[5], ST[4], ST[5], WHITE]);
        p.glow(sx, sy, 36, ST[4], 0.65);
      }
    }

    if (t < T_BH) return;
    const sc = bhScale(t);
    const pulse = Math.max(0, Math.cos(TAU * 3.2 * (t - T_BH))) ** 8;

    // 2. Back-pass: Background Cosmic Starfield warping inward + Floor Gravitational Suction Rings
    if (isBack) {
      const voidK = smooth(T_BH, T_BH + 0.18, t) * (1 - smooth(T_DETONATE, T_DETONATE + 0.12, t));
      if (voidK > 0.04) {
        const pullU = clamp((t - T_BH) / (T_POINT - T_BH));
        for (const st of bgStars) {
          const dx = TX - st.x, dy = BH_Y - st.y;
          const d = Math.hypot(dx, dy) || 1;
          const warp = ease.inQuad(pullU) * Math.min(42, 2000 / (d + 16));
          const sx = st.x + (dx / d) * warp;
          const sy = st.y + (dy / d) * warp;
          if (Math.hypot(sx - TX, sy - BH_Y) < RS * sc + 3) continue;
          const tw = (0.55 + 0.45 * Math.sin(t * 24 + st.ph)) * voidK;
          const col = st.colIdx === 0 ? WHITE : st.colIdx === 1 ? ST[5] : CY[4];
          if (st.big || pullU > 0.45) {
            p.line(sx - (dx / d) * (4 + 8 * pullU), sy - (dy / d) * (4 + 8 * pullU), sx, sy, col, tw);
          } else {
            p.dot(sx, sy, col, tw);
          }
        }
      }

      // Ground gravitational suction rings contracting under (TX, 0)
      if (t < T_POINT && sc > 0.08) {
        for (let rIdx = 0; rIdx < 3; rIdx++) {
          const ph = ((t - T_BH) * 2.2 + rIdx * 0.33) % 1;
          const rx = lerp(82, 8, ease.inQuad(ph)) * Math.max(0.25, sc);
          band(
            p,
            TX,
            0.5,
            rx,
            SY,
            1.8,
            Math.sin(ph * Math.PI) * 0.85,
            rIdx % 2 === 0 ? [C[2], C[4], C[6], WHITE] : [ST[1], ST[3], ST[5], WHITE],
          );
        }
      }
      return;
    }

    // 3. Front-pass: Relativistic Einstein Lensing Crescent Arcs ("空间扭曲·爱因斯坦引力透镜弧")
    if (t < T_POINT && sc > 0.08) {
      for (let wIdx = 0; wIdx < 3; wIdx++) {
        const uW = ((t - T_BH) * 1.9 + wIdx * 0.33) % 1;
        const radW = lerp(90, RS * sc + 6, ease.inQuad(uW)) * Math.max(0.35, sc);
        const alphaW = Math.sin(uW * Math.PI) * 0.85;
        drawEinsteinLensingArcs(p, TX, BH_Y, radW, TILT + t * 1.6 + wIdx * 1.05, 0.82, alphaW, C, CY, ST);
      }
    }

    // 4. Long Inward-Bending Starlight Ribbons ("吸聚周围光线") pulled into the Black Hole
    for (const lr of lightRibbons) {
      if (t < lr.t0 || t >= lr.t0 + lr.dur || t >= T_POINT) continue;
      const u = clamp((t - lr.t0) / lr.dur);
      const headCol = lr.kind === 0 ? WHITE : lr.kind === 1 ? ST[5] : CY[4];
      const midCol = lr.kind === 0 ? C[6] : lr.kind === 1 ? ST[4] : CY[3];
      const tailCol = lr.kind === 0 ? C[4] : lr.kind === 1 ? ST[2] : CY[2];

      // Draw a multi-segment curved geodesic light ribbon spiraling into the event horizon
      const segs = 8;
      for (let s = 0; s < segs; s++) {
        const u0 = clamp(u - (s / segs) * 0.24);
        const u1 = clamp(u - ((s + 1) / segs) * 0.24);
        const r0 = RS * sc + 1 + (lr.d0 - RS * sc - 1) * (1 - ease.inQuad(u0));
        const r1 = RS * sc + 1 + (lr.d0 - RS * sc - 1) * (1 - ease.inQuad(u1));
        const a0 = lr.a0 + lr.swirl * ease.inQuad(u0);
        const a1 = lr.a0 + lr.swirl * ease.inQuad(u1);
        const x0 = TX + Math.cos(a0) * r0 * 1.15, y0 = BH_Y + Math.sin(a0) * r0 * 0.80;
        const x1 = TX + Math.cos(a1) * r1 * 1.15, y1 = BH_Y + Math.sin(a1) * r1 * 0.80;
        if (y0 > 1 || y1 > 1 || y0 < Y_MIN + 4 || y1 < Y_MIN + 4) continue;
        const segU = s / segs;
        const col = segU < 0.25 ? headCol : segU < 0.65 ? midCol : tailCol;
        p.line(x0, y0, x1, y1, col, (1 - segU * 0.75) * Math.sin(u * Math.PI));
        if (s === 0) {
          p.px(x0, y0, WHITE);
          p.glow(x0, y0, 5, headCol, 0.42);
        }
      }
    }

    // 5. Large Faceted Ground Boulders ("吸聚碎石") ripped out of the floor and spiraled into the Black Hole
    for (const rk of accretedBoulders) {
      if (t < rk.t0 || t >= rk.t0 + rk.L || t >= T_POINT) continue;
      const age = t - rk.t0;
      const q = clamp(age / rk.L);

      // Floor eruption ring & vertical anti-gravity tether when the boulder rips loose from the ground
      if (age < 0.22) {
        const uLift = age / 0.22;
        p.disc(rk.x0, -1.5, 3 + age * 14, K[2], 0.50 * (1 - uLift));
        p.line(rk.x0, -1, rk.x0, -1 - 18 * uLift, C[5], 0.55 * (1 - uLift));
      }

      const posAt = (qq) => {
        const cQ = clamp(qq);
        const liftU = smooth(0, 0.36, cQ);
        const rho = RS * sc + 1 + (rk.rho0 - RS * sc - 1) * (1 - Math.pow(cQ, 1.55));
        const ph = rk.ph0 + 2.4 * Math.pow(cQ, 1.6) * (1 + 1.3 * cQ);
        const X = Math.cos(ph) * rho, Z = Math.sin(ph) * rho;
        const sx = X, sy = -Z * SI + rk.hgt * (1 - cQ);
        const orbX = TX + sx * CT - sy * ST_SIN;
        const orbY = BH_Y + sx * ST_SIN + sy * CT;
        return {
          x: lerp(rk.x0, orbX, liftU),
          y: lerp(-3, orbY, liftU),
          Z,
          rho,
        };
      };

      const a = posAt(q);
      const b = posAt(q - 0.07);
      if (a.y > 1 || a.y < Y_MIN + 4) continue;
      const hidden = a.Z > 0 && Math.hypot(a.x - TX, a.y - BH_Y) < RS * sc + 1;
      if (hidden) continue;

      if (a.rho < RS * sc + 4.0) {
        p.circle(a.x, a.y, 1.5, WHITE);
        p.glow(a.x, a.y, 7, ST[5], 0.70);
        continue;
      }

      // Spaghettification near the photon ring vs Chunky 3D Faceted Boulder further out
      const heat = 1 - smooth(18 * sc, 38 * sc, a.rho);
      if (heat > 0.35) {
        const dx = a.x - b.x, dy = a.y - b.y, l = Math.hypot(dx, dy) || 1;
        const len = 3 + heat * 11;
        p.beam(a.x - (dx / l) * len, a.y - (dy / l) * len, a.x, a.y, 2.2, (u) => (u > 0.65 ? WHITE : u > 0.32 ? ST[5] : C[5]));
        p.glow(a.x, a.y, 6, ST[4], 0.50 * heat);
      } else {
        // Orbit wake trail + Chunky 3D Faceted Boulder
        p.line(b.x, b.y, a.x, a.y, C[4], 0.65);
        drawFacetedBoulder(p, a.x, a.y, rk.rad * Math.max(0.55, sc), rk.rot0 + age * rk.spin, TX, BH_Y, K, ST, C, 0.24);
      }
    }

    // 6. Render the Relativistic Gravitational-Lensed Black Hole & Accretion Disk!
    if (sc > 0.05) {
      p.glow(TX, BH_Y, 84 * sc, C[4], 0.36);
      p.glow(TX, BH_Y, 48 * sc, ST[4], 0.42);
      drawLensedBlackHole(p, TX, BH_Y, sc, C, ST, CY, t - T_BH, pulse);
      halo(p, TX, BH_Y, RS * sc - 0.4, RS * sc + 4.5 * sc, ST[5], 0.42 + 0.30 * pulse);
    }

    // 7. PHASE 2 CLIMAX: Extreme Singularity Compression into a Single Point ("极度压缩成一点", 0.94..1.24s)
    if (t >= T_COMPRESS && t < T_DETONATE) {
      // Rapidly collapsing concentric implosion rings during [T_COMPRESS = 0.94s, T_POINT = 1.07s)
      for (let i = 0; i < 3; i++) {
        const uRing = (t - (T_COMPRESS + i * 0.03)) / 0.10;
        if (uRing > 0 && uRing < 1) {
          const rImplode = (64 - i * 14) * (1 - ease.inCubic(uRing)) + 1.5;
          ringFast(p, TX, BH_Y, rImplode, uRing > 0.65 ? 2 : 1, i % 2 === 0 ? ST[5] : CY[4], 0.50 + 0.50 * uRing);
        }
      }

      // THE SINGLE COMPRESSED SINGULARITY POINT (t in [T_POINT = 1.07s, T_DETONATE = 1.24s) — captures Frame 34 at 1.13s!):
      // No bulky rings! Only a single trembling Planck Point in pitch-black space with razor-thin inward light needles & anamorphic lens flare!
      if (t >= T_POINT - 0.02) {
        const uStill = clamp((t - (T_POINT - 0.02)) / (T_DETONATE - (T_POINT - 0.02)));
        const jit = Math.floor(t * 45) % 2 ? 0.5 : -0.5;
        const cr = 1.8;

        // 8 Razor-thin light needles being sucked into the exact Planck Point (TX, BH_Y)
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU + 0.25 + uStill * 0.4;
          const dOuter = lerp(54, 6, ease.inQuad(uStill));
          const dInner = lerp(16, 1.5, ease.inQuad(uStill));
          const x0 = TX + Math.cos(a) * dOuter, y0 = BH_Y + Math.sin(a) * dOuter * 0.85;
          const x1 = TX + Math.cos(a) * dInner, y1 = BH_Y + Math.sin(a) * dInner * 0.85;
          p.line(x0, y0, x1, y1, k % 2 === 0 ? ST[5] : CY[4], 0.78 * (1 - uStill * 0.4));
        }

        // Razor-sharp horizontal & vertical Gravitational Singularity Anamorphic Lens Flare ("一点寒芒/奇点十字透镜")
        const hLen = lerp(34, 88, Math.sin(uStill * Math.PI));
        const vLen = lerp(18, 46, Math.sin(uStill * Math.PI));
        p.line(TX - hLen, BH_Y, TX + hLen, BH_Y, (u) => (Math.abs(u - 0.5) < 0.22 ? WHITE : CY[4]), 0.94);
        p.line(TX, BH_Y - vLen, TX, BH_Y + vLen, (u) => (Math.abs(u - 0.5) < 0.22 ? WHITE : ST[5]), 0.90);
        flare(p, TX + jit, BH_Y, 28 * Math.sin(uStill * Math.PI) + 8, 0.95, [C[5], CY[4], ST[5], WHITE]);

        // Pitch-black microscopic event horizon wrapping a single blinding white-gold Planck pixel cluster
        p.disc(TX + jit, BH_Y, cr + 4.5, C[0], 0.95);
        p.circle(TX + jit, BH_Y, cr + 1.3, ST[5]);
        p.circle(TX + jit, BH_Y, cr, WHITE);
        p.glow(TX, BH_Y, 16, WHITE, 0.70);
        p.glow(TX, BH_Y, 34, C[5], 0.45);
      }
    }
  }

  // PHASE 3: Cataclysmic Cosmic Supernova Detonation, Bipolar Quasar Jets, Spatial Distortion Shockwaves & Space-Fractures
  function drawSupernovaAndSpatialRifts(p, isBack) {
    if (t < T_DETONATE) return;
    const sr = novaSphereR(t);
    const kBurn = t < T_POP ? 1.0 : Math.max(0, 1 - (t - T_POP) / 0.45);

    // 1. Perspective Floor Shockwave Rings (split back/front)
    for (const r of shockRings) {
      if (r.delay > 0 || !r.hot || r.th < 2.2) continue;
      const q = r.life / r.max;
      const rr = r.r0 + (r.r1 - r.r0) * (1 - q * q * q);
      if (rr <= -BH_Y) continue;
      const rf = Math.sqrt(rr * rr - BH_Y * BH_Y);
      band(
        p,
        TX,
        0.5,
        rf,
        0.18,
        Math.max(1.2, 3.6 * q),
        Math.min(1, q * 1.5),
        r.gold ? [ST[2], ST[4], ST[5], WHITE] : [C[3], C[5], CY[4], WHITE],
        (g) => (Math.sin(g) < 0) === isBack,
      );
      if (!isBack) {
        for (const s of [-1, 1]) {
          if (TX + s * rf > X_MIN + 16 && TX + s * rf < X_MAX - 16) {
            p.glow(TX + s * rf, -2, 16, r.gold ? ST[5] : C[5], 0.38 * q);
          }
        }
      }
    }

    if (isBack) return;

    // 2. Relativistic Bipolar Quasar Jets ("双极相对论星体喷流", 1.24..1.72s) shooting from the singularity poles
    if (t >= T_DETONATE && t < 1.74) {
      const uJet = (t - T_DETONATE) / 0.50;
      const fadeJet = Math.sin(Math.min(1, uJet * 4) * (Math.PI / 2)) * (1 - smooth(0.38, 1.0, uJet));
      if (fadeJet > 0.04) {
        const reachUp = ease.outQuart(Math.min(1, uJet * 3.2));
        const jxTop = TX + Math.sin(TILT) * (-148 * reachUp);
        const jyTop = Math.max(Y_MIN + 6, BH_Y - Math.cos(TILT) * (148 * reachUp));
        const jxBot = TX - Math.sin(TILT) * (54 * reachUp);
        const jyBot = Math.min(2, BH_Y + Math.cos(TILT) * (54 * reachUp));

        const jetW = Math.max(1.5, 11.5 * fadeJet);
        p.beam(jxBot, jyBot, jxTop, jyTop, jetW, (u, v) =>
          v < 0.34 ? WHITE : v < 0.64 ? ST[5] : v < 0.85 ? CY[4] : C[5],
        );
        p.glowLine(jxBot, jyBot, jxTop, jyTop, 22 * fadeJet, ST[4], 0.48 * fadeJet);

        const f = Math.floor(t * 30 + 1e-4);
        const rJet = rng(o.seed, 111, f);
        stroke(p, zigzag(rJet, jxBot, jyBot, jxTop, jyTop, 0.22, 0.45), fadeJet * 0.9, ST, 1.25, { hero: uJet < 0.18, light: 0.25, minY: Y_MIN + 6 });
      }
    }

    // 3. Initial Detonation Flash Dome (1.24..1.36s)
    const fu = (t - T_DETONATE) / 0.12;
    if (fu >= 0 && fu < 1) {
      const rFlash = 44 * (1 - 0.28 * fu);
      p.circle(TX, BH_Y, rFlash + 2, ST[5], 1.2 - fu);
      p.circle(TX, BH_Y, rFlash, fu < 0.38 ? WHITE : C[6], 1.1 - fu);
      if (fu < 0.55) p.circle(TX, BH_Y, rFlash * 0.65, WHITE);
    }

    // 4. Expanding Spherical Shockwaves & Einstein Spatial Distortion Arcs in the air
    for (const r of shockRings) {
      if (r.delay > 0) continue;
      const q = r.life / r.max;
      const rr = r.r0 + (r.r1 - r.r0) * (1 - q * q * q);
      const th = Math.max(1, r.th * q + 0.4);
      ringFast(
        p,
        r.cx,
        r.cy,
        rr,
        th,
        (v) => (r.hot ? (v > 0.6 ? WHITE : v > 0.3 ? (r.gold ? ST[5] : CY[4]) : C[5]) : v > 0.5 ? C[5] : C[4]),
        (v, g) => (r.cy + Math.sin(g) * rr > 0.5 || r.cx + Math.cos(g) * rr > X_MAX - 6 ? 0 : Math.min(1, q * 1.6)),
      );
      if (r.hot) {
        ringLight(p, r.cx, r.cy, rr, 4, r.gold ? ST[4] : C[5], 0.38 * q, (x, y) => y < 0.5 && x < X_MAX - 6);
        drawEinsteinLensingArcs(p, r.cx, r.cy, rr * 0.90, TILT + (1 - q) * 1.8, 0.78, q * 0.90, C, CY, ST);
      }
    }

    // 5. Burning Antimatter Supernova Sphere & Black-Star Void Cut
    drawSupernovaSphere(p, TX, BH_Y, sr, t, t < T_POP - 0.16 ? 1.0 : 1.35, C, ST, CY);

    const starLen = t < T_DETONATE || t > T_DETONATE + 0.30 ? 0 : 72 * (1 - ease.inQuad(clamp((t - T_DETONATE - 0.04) / 0.26)));
    if (starLen > 0) {
      const bStar = blackStar(BH_Y, starLen, 0.30 + (t - T_DETONATE) * 2.4, 0.52, 0.38);
      const age = t - T_DETONATE;
      const fr = age < 0.12 ? 44 * (1 - 0.28 * (age / 0.12)) + 2 : 0;
      const cut = Math.max(fr, sr);
      p.ox += TX;
      bStar.draw(p, C[0], age < 0.12 ? ST[5] : C[5], (x, y) => x * x + (y - BH_Y) ** 2 < cut * cut);
      p.ox -= TX;
    }

    // 6. Sharp Angular Dimensional Space-Fractures ("空间碎裂裂隙") torn open in mid-air around the blast!
    const f = Math.floor(t * 30 + 1e-4);
    for (let i = 0; i < spaceFractures.length; i++) {
      const rf = spaceFractures[i];
      if (t < rf.t0 || t >= rf.t0 + rf.life) continue;
      const uRift = (t - rf.t0) / rf.life;
      const openU = ease.outBack(clamp(uRift * 5.0), 1.4) * (1 - smooth(0.42, 1.0, uRift));
      drawAngularSpaceFracture(p, rf.pts, rf.branch, rf.w, openU, C, CY, ST);
      if (openU > 0.25 && ((f + i) & 1) === 0) {
        const rArc = rng(o.seed, 131 + i, f);
        const [mx, my] = rf.pts[1];
        crackle(p, zigzag(rArc, mx, my, mx + rArc.range(-16, 16), my + rArc.range(-14, 14), 0.38, 0.35), openU * 0.85, i % 2 === 0 ? C : ST, 0.35);
      }
    }

    // 7. Secondary Core Collapse Pop Glint at T_POP (1.82s)
    const pu = (t - T_POP) / 0.22;
    if (pu >= 0 && pu < 1) {
      flare(p, TX, BH_Y, 36 * (1 - pu), 1 - pu, [C[5], CY[4], ST[5], WHITE]);
      sparkle(p, TX, BH_Y, 16 * (1 - pu), WHITE, ST[5], 0.85 * (1 - pu));
    }

    if (sr > 1) {
      halo(p, TX, BH_Y, sr - 0.5, sr + 18, ST[5], 0.52 * flick * Math.min(1, kBurn));
      p.glow(TX, BH_Y, sr + 56, C[4], 0.48 * flick * Math.min(1, kBurn));
    }
  }

  // PHASE 4: Hit Explosion Result Aftermath — Scorched Abyssal Crater, Astral Magma Cracks & Zero-G Levitating Boulders
  function drawAftermathCraterAndZeroG(p, isBack) {
    if (t < T_DETONATE) return;
    const fadeEnd = 1 - smooth(T_END - 0.65, T_END - 0.06, t);
    if (fadeEnd <= 0.02) return;

    if (isBack) {
      // 1. Scorched Starfall Abyssal Crater & Glowing Astral-Gold / Violet Floor Fissures ("星陨湮灭焦坑与星骸地裂")
      const front = REACH_CRACK * ease.outCubic(clamp((t - T_DETONATE) / 0.38));
      const pulse = 0.76 + 0.24 * Math.sin(t * 10);
      const heatBase = clamp(1 - (t - T_POP) / 2.35) * fadeEnd;

      scorch(p, TX + 14, 0, 28 * fadeEnd, heatBase * 0.88, fadeEnd);

      for (const br of crackTree) {
        for (const [x, y, d] of br.pts) {
          if (d > front) break;
          const q = d / REACH_CRACK;
          const n = rand(Math.round(x * 2), Math.round(y * 2), 11);
          const fresh = d > front - 7 && front < REACH_CRACK;
          const T = heatBase * (1.15 - q * 0.75) * (br.w < 1 ? 0.85 : 1) * pulse - n * 0.18;
          let col;
          if (fresh) {
            col = q < 0.48 ? WHITE : ST[5];
          } else if (T > 0.62) {
            col = ST[5];
          } else if (T > 0.42) {
            col = C[6];
          } else if (T > 0.24) {
            col = CY[3];
          } else if (T > 0.10) {
            col = C[3];
          } else {
            col = SOOT2;
          }
          p.dot(x, y + 1, SOOT, fadeEnd);
          p.dot(x, y, col, fadeEnd);
          if ((fresh || T > 0.26) && (Math.round(d) & 7) === 0) {
            p.glow(x, y, 8, T > 0.45 ? ST[4] : C[5], 0.32 * T * fadeEnd);
          }
        }
      }

      floorLight(p, TX + 14, 2, 76 * fadeEnd, 10, C[5], 0.48 * pulse * fadeEnd);
      floorLight(p, TX + 14, 2, 44 * fadeEnd, 6, ST[4], 0.38 * pulse * fadeEnd);
      return;
    }

    // 2. Anti-Gravity Levitating Meteorite Boulders & Stardust Motes ("反重力悬浮碎石与星尘")
    for (const zg of zeroGRocks) {
      if (t < zg.t0 || t >= zg.t0 + zg.life) continue;
      const age = t - zg.t0;
      const u = age / zg.life;
      const fadeZ = Math.sin(Math.min(1, u * 3.5) * (Math.PI / 2)) * (1 - smooth(0.58, 1.0, u)) * fadeEnd;
      if (fadeZ <= 0.05) continue;

      const hCurve = Math.sin(u * Math.PI * 0.88);
      const x = Math.round(zg.x0 + zg.driftX * u + Math.sin(age * 4.5 + zg.phase) * 3.5);
      const y = Math.round(-2 - zg.maxH * hCurve);
      if (x < X_MIN + 6 || x > X_MAX - 6 || y < Y_MIN + 6 || y > 1) continue;

      drawFacetedBoulder(p, x, y, zg.rad * fadeZ, zg.rot0 + age * zg.spin, TX + 14, 0, K, ST, C, 0.22 * fadeZ);
    }
  }

  return {
    update(dt) {
      t += dt;
      flick = 0.88 + 0.12 * Math.sin(t * 37) * Math.sin(t * 23);

      // Spawn starfall trail sparkles during initial descent (0.06..0.34s)
      if (t >= T_CAST && t < T_BH && R.chance(0.75)) {
        const uStar = clamp((t - T_CAST) / (T_BH - T_CAST));
        const sx = lerp(68, TX, ease.inQuad(uStar));
        const sy = lerp(-200, BH_Y, ease.inQuad(uStar));
        ps.spawn(
          P.STAR,
          sx + R.range(-4, 4),
          sy + R.range(-4, 4),
          R.range(-25, 25),
          R.range(-20, 10),
          capLife(R.range(0.28, 0.55)),
          R.pick([WHITE, ST[5], CY[4]]),
          R.range(1.0, 1.9),
        );
      }

      // Black Hole formation flash at T_BH (0.34s)
      if (!bhFormed && t >= T_BH) {
        bhFormed = true;
        lights.add(TX, BH_Y, 88, C[5], 0.90, 0.28);
        lights.add(TX, BH_Y, 44, ST[5], 0.85, 0.16);
      }

      // Gravitational suction of motes, streaks & dark soot into the Black Hole (0.34..1.05s)
      if (t >= T_BH && t < T_POINT - 0.02) {
        const kPull = clamp((t - T_BH) / (T_POINT - T_BH));
        for (acc += dt * (85 + 140 * kPull); acc > 1; acc--) {
          const a = R.range(0, TAU), D = R.range(38, 92);
          const x = TX + Math.cos(a) * D, y = Math.min(-3, BH_Y + Math.sin(a) * D);
          const vt = R.range(55, 115), vi = R.range(15, 45);
          ps.spawn(
            P.MOTE,
            x,
            y,
            -Math.sin(a) * vt - Math.cos(a) * vi,
            Math.cos(a) * vt - Math.sin(a) * vi,
            Math.min(0.65, Math.max(0.06, T_POINT - t)),
            R.pick([WHITE, ST[5], CY[4], C[6]]),
            R.range(0.7, 1.3),
          );
        }
        if (R.chance(0.78)) {
          const a = R.range(0, TAU), D = R.range(32, 78), T = Math.min(R.range(0.14, 0.24), Math.max(0.06, T_POINT - t));
          const v = (D * 3) / (Math.exp(3 * T) - 1);
          ps.spawn(
            P.STREAK,
            TX + Math.cos(a) * D,
            Math.min(-3, BH_Y + Math.sin(a) * D),
            -Math.cos(a) * v,
            -Math.sin(a) * v,
            T,
            R.pick([WHITE, ST[5], CY[4], C[6]]),
          );
        }
        attract(ps.list, TX, BH_Y, 2.4e6 * (0.35 + kPull), 118, 0.58, 3.0, dt, (q) => (q.k === P.MOTE ? 1 : 0), 440);
      }

      // Cataclysmic Supernova Detonation at T_DETONATE (1.24s)
      if (!detonated && t >= T_DETONATE) {
        detonated = true;
        ps.list.length = 0;
        triggerSupernova();
      }

      // Supernova burning phase (1.24..1.82s)
      if (detonated && t < T_POP) {
        const sr = novaSphereR(t);
        for (acc += dt * 32; acc > 1; acc--) {
          const a = -Math.PI / 2 + R.gauss() * 1.1;
          const x = TX + Math.cos(a) * (sr + 1), y = BH_Y + Math.sin(a) * (sr + 1);
          const sp = R.range(12, 38);
          puffs.spawn(PK.FLAME, x, y, Math.cos(a) * sp, Math.sin(a) * sp - R.range(10, 30), capLife(R.range(0.25, 0.45)), R.range(1.3, 2.4), 0, R.chance(0.25));
        }
      }

      // Secondary Core Collapse Pop at T_POP (1.82s)
      if (!popped && t >= T_POP) {
        popped = true;
        triggerCollapsePop();
      }

      // Continuous rising astral embers & twinkling stardust from the crater in Phase 4 Aftermath
      if (t > T_POP && t < T_END - 0.65 && R.chance(0.58)) {
        const mx = TX + 14 + R.range(-54, 54);
        if (R.chance(0.55)) {
          embers.spawn(P.EMBER, mx, -2, R.range(-10, 10), -R.range(20, 48), capLife(R.range(0.55, 1.05)));
        } else {
          ps.spawn(P.STAR, mx, -R.range(2, 18), R.range(-8, 8), -R.range(12, 32), capLife(R.range(0.35, 0.72)), R.pick([WHITE, ST[5], CY[4], C[6]]), R.range(0.9, 1.7));
        }
      }

      // Floor dust kicked out by expanding shock rings
      for (const r of shockRings) {
        if (r.delay > 0 || !r.hot || r.th < 3) continue;
        const rr = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(r.life / r.max, 3));
        const rf = rr > -BH_Y ? Math.sqrt(rr * rr - BH_Y * BH_Y) : 0;
        if (rf > 0) {
          for (dustAcc += dt * 50; dustAcc > 1; dustAcc--) {
            const s = R.sign();
            const dx = TX + s * rf + R.range(-2, 2);
            if (dx > X_MIN + 14 && dx < X_MAX - 14) {
              ps.spawn(P.DUST, dx, -R.range(1, 3), s * R.range(20, 48), -R.range(4, 14), capLife(R.range(0.4, 0.75)), mix(C[2], C[3], R.next()), R.range(1.5, 2.8));
            }
          }
        }
      }

      for (let i = shockRings.length - 1; i >= 0; i--) {
        const q = shockRings[i];
        if (q.delay > 0) q.delay -= dt;
        else if ((q.life -= dt) <= 0) shockRings.splice(i, 1);
      }

      bits.update(dt);
      for (const b of bits.list) {
        if (b.rest && !b.flat) {
          b.flat = true;
          b.a = Math.round(b.a / Math.PI) * Math.PI + R.range(-0.2, 0.2);
          b.y = -1;
        }
        if (b.life < 0.45 && !b.wisp && t < T_END - 0.85) {
          b.wisp = true;
          puffs.spawn(PK.SOOT, b.x, b.y - 1, R.range(-4, 4), -R.range(8, 16), capLife(R.range(0.5, 0.8)), R.range(1.4, 2.4));
        }
      }

      puffs.update(dt);
      ps.update(dt);
      embers.update(dt);
      cullList(ps.list, X_MIN + 4, Y_MIN + 4, X_MAX - 4, Y_MAX - 4);
      cullList(embers.list, X_MIN + 4, Y_MIN + 4, X_MAX - 4, Y_MAX - 4);
      cullList(puffs.list, X_MIN + 8, Y_MIN + 8, X_MAX - 8, Y_MAX - 6);
      cullBits(bits, X_MIN + 6, Y_MIN + 6, X_MAX - 6, Y_MAX - 4);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;

      // Cosmic Void Arena Darkening during Black Hole accretion, Singularity Point compression & Supernova eruption
      if (t >= T_BH - 0.04 && t < 2.25) {
        const kDark = 0.82 * smooth(T_BH - 0.04, T_BH + 0.22, t) * (1 - smooth(T_POP, 2.25, t));
        if (kDark > 0.03) {
          unlight(
            p,
            -70,
            -204,
            TX + 115,
            10,
            (x, y) => Math.hypot(x - TX, y - BH_Y) > 18 && y > -196,
            1 - kDark,
          );
        }
      }

      drawBlackHoleAndCompression(p, true);
      drawSupernovaAndSpatialRifts(p, true);
      drawAftermathCraterAndZeroG(p, true);

      const kLit = t < T_DETONATE ? clamp((t - T_BH) / 0.5) * 0.7 : t < T_POP ? 1.15 : Math.max(0, 1 - (t - T_POP) / 1.4);
      puffs.draw(p, PK.SOOT, { x: TX, y: BH_Y, k: kLit * flick, reach: 96 });
      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;

      drawBlackHoleAndCompression(p, false);
      drawSupernovaAndSpatialRifts(p, false);

      puffs.draw(p, PK.FLAME);
      const kShardLit = t < T_POP ? 1.0 : Math.max(0.15, 1 - (t - T_POP) / 1.2);
      for (const b of bits.list) shard(p, b, C, TX, BH_Y, kShardLit);

      ps.draw(p, "front");
      embers.draw(p, "front");
      lights.draw(p);

      // Call unlight AFTER lights.draw(p) so the Black Hole Event Horizon & Antimatter Supernova Core stay pitch-black!
      const sc = bhScale(t);
      if (sc > 0.05) {
        unlight(p, TX - RS * sc, BH_Y - RS * sc, TX + RS * sc, BH_Y + RS * sc, (x, y) => {
          const dx = x - TX, dy = y - BH_Y;
          const v = -dx * ST_SIN + dy * CT, u = dx * CT + dy * ST_SIN;
          return u * u + v * v < (RS * sc - 0.6) ** 2 && !(v > 0 && sampleAccretionDisk(u, -v / SI, t - T_BH, sc));
        });
      }
      const sr = novaSphereR(t);
      if (sr > 1) {
        const B0 = sr + 1;
        unlight(p, TX - B0, BH_Y - B0, TX + B0, BH_Y + B0, (x, y) => (x - TX) ** 2 + (y - BH_Y) ** 2 < (sr - 0.6) ** 2);
      }

      drawAftermathCraterAndZeroG(p, false);
    },
  };
}

function cullList(L, x0, y0, x1, y1) {
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i];
    const r = (q.size || 2) * 1.8 + 4;
    if (q.x - r < x0 || q.x + r > x1 || q.y - r < y0 || q.y + r > y1) {
      L.splice(i, 1);
    }
  }
}

function cullBits(bits, x0, y0, x1, y1) {
  const L = bits.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const b = L[i];
    if (b.x < x0 || b.x > x1 || b.y < y0 || b.y > y1) {
      L.splice(i, 1);
    }
  }
}
