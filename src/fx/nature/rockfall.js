// Ground shockwaves, floor-hugging impact stars, tumbling rock chunks, grit fountains and rolling dust clouds
// build on techniques from Sprite Fusion's open-source explosion and impact VFX
// (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, B, Rng, fit, flare, clamp, smooth, seg, lerp, ease, tileFbm, mix, TAU, WHITE } from "../../core/index.js";
import { star, frontCrescent } from "../impacts/_lib.js";

export const meta = {
  name: "Rockfall",
  desc: "An oppressive storm-dust pall gathers overhead before a relentless avalanche of gravel, stones, boulders and colossal monoliths pounds the earth and slowly subsides.",
  tags: ["nature", "earth", "rock", "boulder", "rockfall", "avalanche", "cataclysm", "aoe", "ground", "one-shot"],
  size: [384, 260],
  origin: [192, 224],
  duration: 6.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#0d0b12", "#1a1622", "#2b2434", "#413748", "#5c4e60", "#7e6c7c", "#ab969e", "#dfd0cc"],
    glow: ["#3b140a", "#7a2810", "#c84e18", "#f28a24", "#ffd166", "#fff6d6"],
    seed: 17,
  },
};

const T_OMEN = 0.42;
const T_PEAK_END = 3.55;
const T_END = 6.8;
const SY = 0.17;
const SLANT = 0.19; // ~10.8° unified cliff-collapse slant (upper-left -> lower-right)

// Reusable scratch buffers for zero-GC-allocation rock rasterization
const MAX_BOX = 96;
const SCRATCH_MASK = new Uint8Array(MAX_BOX * MAX_BOX);
const SCRATCH_TI = new Int32Array(MAX_BOX * MAX_BOX);

// Prebake diverse angular rock archetypes (tall jagged cliff-spires, wide crushing anvils, fractured crag blocks)
function bakeRockTemplates(R, count = 9) {
  const G = 30, SPAN = G * 2 + 1;
  const templates = [];
  for (let t = 0; t < count; t++) {
    const nVerts = R.int(6, 8);
    const a0 = R.range(0, TAU);
    const kind = t % 3; // 0 = tall jagged spire, 1 = broad crushing anvil, 2 = angular crag block
    const sx = kind === 0 ? R.range(0.76, 0.86) : kind === 1 ? R.range(1.04, 1.15) : R.range(0.88, 1.0);
    const sy = kind === 0 ? R.range(1.12, 1.25) : kind === 1 ? R.range(0.78, 0.88) : R.range(0.86, 0.98);

    const verts = [];
    for (let i = 0; i < nVerts; i++) {
      const a = a0 + ((i + R.range(-0.22, 0.22)) * TAU) / nVerts;
      const rad = R.range(0.78, 1.12);
      verts.push([Math.cos(a) * rad * sx, Math.sin(a) * rad * sy]);
    }
    const rx0 = R.range(-0.24, 0.05), ry0 = R.range(-0.24, 0.05);
    const faceN = verts.map(([ax, ay], i) => {
      const [bx, by] = verts[(i + 1) % nVerts];
      const mx = (ax + bx) * 0.5 - rx0, my = (ay + by) * 0.5 - ry0;
      const l = Math.hypot(mx, my) || 1;
      return [mx / l, my / l];
    });
    const strataA = R.range(-0.5, 0.5), strataStep = R.range(5.5, 8.5);
    const seedT = R.int(1, 9999);

    const qBuf = new Float32Array(SPAN * SPAN);
    const fBuf = new Uint8Array(SPAN * SPAN);
    const vBuf = new Float32Array(SPAN * SPAN);

    for (let gy = -G; gy <= G; gy++) {
      for (let gx = -G; gx <= G; gx++) {
        const idx = (gy + G) * SPAN + (gx + G);
        const nx = gx / 23, ny = gy / 23;
        let maxQ = 0, bestFace = 0, bestDot = -1e9;
        for (let i = 0; i < nVerts; i++) {
          const [ax, ay] = verts[i], [bx, by] = verts[(i + 1) % nVerts];
          let onx = by - ay, ony = -(bx - ax);
          const ol = Math.hypot(onx, ony) || 1;
          onx /= ol; ony /= ol;
          if (onx * ax + ony * ay < 0) { onx = -onx; ony = -ony; }
          const planeD = ax * onx + ay * ony;
          const qEdge = (nx * onx + ny * ony) / Math.max(0.25, planeD);
          if (qEdge > maxQ) maxQ = qEdge;
          const dFace = (nx - rx0) * faceN[i][0] + (ny - ry0) * faceN[i][1];
          if (dFace > bestDot) { bestDot = dFace; bestFace = i; }
        }
        const ang = Math.atan2(ny, nx);
        const crag = 1 + 0.052 * Math.sin(ang * 5 + seedT) + 0.032 * Math.cos(ang * 9 - seedT * 0.5);
        qBuf[idx] = maxQ * crag;

        const stProj = gx * Math.cos(strataA) + gy * Math.sin(strataA);
        const stLine = Math.abs(((stProj % strataStep) + strataStep) % strataStep - strataStep * 0.5) < 0.55 ? 1 : 0;
        const centerCap = Math.hypot(nx - rx0, ny - ry0) < 0.3 ? 1 : 0;
        const pit = Math.hypot(nx + 0.26, ny - 0.18) < 0.13 || Math.hypot(nx - 0.2, ny + 0.25) < 0.11 ? 1 : 0;
        fBuf[idx] = (bestFace & 15) | (stLine << 4) | (centerCap << 5) | (pit << 6);

        const vMain = Math.abs(nx * 0.88 + Math.sin(ny * 3.4 + seedT * 0.01) * 0.16);
        const vBranch = ny > -0.12 ? Math.abs((nx - 0.12) * 0.7 - (ny + 0.12) * 0.55) : 1;
        vBuf[idx] = Math.min(vMain, vBranch * 1.25);
      }
    }
    templates.push({ G, SPAN, qBuf, fBuf, vBuf, faceN });
  }
  return templates;
}

// Prebake scalloped, threshold-erodible pixel-art dust puff LUTs (radii 1..15)
// Uses crisp stepped zones + scalloped edge metric so dust clouds read chunky & volumetric, NOT faint circles!
const PUFF_LUTS = Array.from({ length: 16 }, (_, r) => {
  if (r < 1) return [];
  const pts = [];
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const ang = Math.atan2(dy, dx);
      const scallop = 1 + 0.14 * Math.sin(ang * 5 + r * 1.3) + 0.09 * Math.cos(ang * 8 - r * 0.7);
      const q = Math.hypot(dx, dy) / (r * scallop);
      if (q > 1) continue;
      // Directional lighting metric (-0.55, -0.83 = top-left sky + top crest)
      const lit = (-dx * 0.45 - dy * 0.89) / Math.max(1, r);
      const zone = lit > 0.34 ? 2 : lit > -0.18 ? 1 : 0;
      pts.push(dx, dy, q, zone);
    }
  }
  return pts;
});

// Prebaked crisp pixel-cluster cobble stamps for small stones/chunks (rad 1.5..3.3) — 15x faster than full polygon scan!
const COBBLE_STAMPS = [
  // 5x4 angular cobble A
  [
    [-1, -2, 0], [0, -2, 0], [1, -2, 0],
    [-2, -1, 0], [-1, -1, 7], [0, -1, 6], [1, -1, 5], [2, -1, 0],
    [-2, 0, 0], [-1, 0, 6], [0, 0, 4], [1, 0, 3], [2, 0, 0],
    [-1, 1, 0], [0, 1, 2], [1, 1, 0],
    [0, 2, 0],
  ],
  // 6x5 jagged cobble B
  [
    [-1, -2, 0], [0, -2, 0], [1, -2, 0],
    [-2, -1, 0], [-1, -1, 7], [0, -1, 6], [1, -1, 5], [2, -1, 0],
    [-3, 0, 0], [-2, 0, 7], [-1, 0, 5], [0, 0, 4], [1, 0, 3], [2, 0, 0],
    [-2, 1, 0], [-1, 1, 3], [0, 1, 2], [1, 1, 2], [2, 1, 0],
    [-1, 2, 0], [0, 2, 0], [1, 2, 0],
  ],
  // 4x4 shard C
  [
    [0, -2, 0], [1, -2, 0],
    [-1, -1, 0], [0, -1, 7], [1, -1, 5], [2, -1, 0],
    [-1, 0, 0], [0, 0, 4], [1, 0, 2], [2, 0, 0],
    [0, 1, 0], [1, 1, 0],
  ],
];

function drawCobbleStamp(p, cx, cy, kind, S, alpha = 1, muted = false) {
  if (alpha <= 0.03 || cy > 2 || cy < -213) return;
  const st = COBBLE_STAMPS[kind % COBBLE_STAMPS.length];
  const rx = Math.round(cx), ry = Math.round(cy);
  const emergeA = ry < -186 ? clamp((ry + 214) / 26) : 1;
  const a = alpha * emergeA;
  if (a <= 0.03) return;
  for (let i = 0; i < st.length; i++) {
    const [dx, dy, si] = st[i];
    const py = ry + dy;
    if (py > 2 || py < -215) continue;
    const col = muted ? S[si === 0 ? 1 : si >= 6 ? 3 : 2] : S[si];
    p.dot(rx + dx, py, col, a);
  }
}

// Tight-bbox perspective shockwave ring renderer
function drawFloorBand(p, cx, cy, r, sy, th, alpha, ramp, back, hot = false) {
  if (alpha <= 0.03 || r <= 1 || th <= 0.2) return;
  const rx = r + th, ry = (r + th) * sy + th * 0.5;
  const x0 = Math.max(-188, Math.floor(cx - rx - 1)), x1 = Math.min(187, Math.ceil(cx + rx + 1));
  const y0 = back ? Math.max(-216, Math.floor(cy - ry - 1)) : Math.floor(cy);
  const y1 = back ? Math.floor(cy) : Math.min(32, Math.ceil(cy + ry + 1));
  const invR = 1 / r, invRsy = 1 / Math.max(0.8, r * sy);

  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    if (back ? dy >= 0 : dy < 0) continue;
    const ny = dy * invRsy;
    if (ny * ny > 1.7) continue;
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) * invR;
      const e = Math.hypot(nx, ny);
      if (e < 0.25) continue;
      const grad = Math.hypot(nx * invR, ny * invRsy);
      const dist = (1 - e) / Math.max(1e-4, grad);
      if (dist < -0.55 || dist > th) continue;
      const u = clamp(dist / th);
      const col = u < 0.22 ? (hot ? WHITE : ramp[3]) : u < 0.52 ? ramp[2] : u < 0.8 ? ramp[1] : ramp[0];
      p.dot(x, y, col, alpha * (u < 0.45 ? 1.15 : 1.1 - u * 0.85));
    }
  }
}

export function create(o) {
  const S = fit(o.palette, 8), GL = fit(o.glow, 6);
  const R = new Rng(o.seed), seed = o.seed * 29, floor = () => 0;
  const [W_CV] = meta.size, [OX, OY] = meta.origin;
  const X_MIN = -OX + 10, X_MAX = W_CV - OX - 10, Y_MIN = -OY + 8;

  const DUST_CREST = mix(S[7], GL[4], 0.14);
  const DUST_BODY = mix(S[5], S[6], 0.42);
  const DUST_SHADOW = S[3];
  const CLOUD_UPPER = mix(S[2], S[1], 0.35);
  const CLOUD_MID = S[3];
  const CLOUD_BELLY = mix(S[4], S[3], 0.5);
  const BELLY_RAMP = Array.from({ length: 16 }, (_, i) => mix(CLOUD_BELLY, GL[3], (i / 15) * 0.54));
  const SOOT = S[0];

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, GL[5], GL[4], GL[3]],
    haze: GL[3],
  });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();
  const templates = bakeRockTemplates(R, 9);

  // ============================================================================
  // MULTI-LAYERED VOLUMETRIC DUST-STORM SKY FRONT (y in [-216..-148])
  // Three independent billowing cloud masses (NO uniform ribbon / snake border!)
  // ============================================================================
  const VEIL_X0 = -176, VEIL_X1 = 176, VEIL_W = VEIL_X1 - VEIL_X0 + 1;
  const waveBack = new Float32Array(VEIL_W);
  const waveMid = new Float32Array(VEIL_W);
  const waveFront = new Float32Array(VEIL_W);
  const bankEdge = new Float32Array(VEIL_W);
  for (let i = 0; i < VEIL_W; i++) {
    const x = VEIL_X0 + i;
    bankEdge[i] = 1 - smooth(122, 176, Math.abs(x));
    waveBack[i] = 52 + Math.sin(x * 0.028 + 0.4) * 11 + tileFbm((x + 210) * 0.036, 1.4, 16, 16, seed + 11, 3) * 18;
    waveMid[i] = 36 + Math.cos(x * 0.047 - 1.1) * 9 + tileFbm((x + 390) * 0.052, 2.7, 16, 16, seed + 29, 3) * 15;
    waveFront[i] = 21 + Math.sin(x * 0.071 + 2.3) * 6 + tileFbm((x + 530) * 0.068, 4.1, 16, 16, seed + 53, 2) * 11;
  }

  let t = 0;
  let gritAcc = 0;

  // Threshold-eroded volumetric pixel-art dust clouds (chunky, solid, lit by blasts!)
  const puffs = [];
  const addPuff = (x, y, vx, vy, r0, r1, life, delay = 0, bright = 0) => {
    const capped = Math.min(life, T_END - 0.1 - t - delay);
    if (capped <= 0.08) return;
    puffs.push({ x, y, vx, vy, r0, r1, age: -delay, life: capped, bright, ph: R.range(0, TAU) });
  };

  const flashes = [];

  // ============================================================================
  // DENSE MULTI-SCALE ROCKFALL SCHEDULE ("大量岩石从天上坠落，有大有小")
  // 65 Background Rocks + 6 Colossal Monoliths + 22 Heavy Boulders + 56 Medium Stones + 64 Cobbles
  // ============================================================================
  const bgRocks = [];
  for (let i = 0; i < 64; i++) {
    const tHit = i < 52 ? lerp(0.32, 3.54, i / 51) + R.range(-0.025, 0.025) : 3.58 + Math.pow((i - 51) / 12, 1.45) * 1.32;
    const lane = ((i * 11 + 5) % 23) / 22;
    const xHit = lerp(-152, 152, lane) + R.range(-6, 6);
    const rad = i % 6 === 0 ? R.range(6.0, 9.0) : i % 2 === 0 ? R.range(3.6, 5.5) : R.range(2.2, 3.2);
    const fallDur = R.range(0.46, 0.64);
    bgRocks.push({
      xHit: clamp(xHit, -156, 156),
      rad,
      slant: SLANT + R.range(-0.03, 0.03),
      t0: tHit - fallDur,
      tHit,
      fallDur,
      rot0: R.range(0, TAU),
      vRot: R.sign() * R.range(2.2, 7.2),
      tpl: templates[R.int(0, templates.length - 1)],
      stamp: i % 3,
    });
  }

  const boulders = [];
  const addFaller = (tHit, x, rad, tier, slantJit = 0, tplIdx = -1, hasSats = false) => {
    const sl = SLANT + slantJit;
    const fallDur =
      tier === 3 ? R.range(0.50, 0.58) :
      tier === 2 ? R.range(0.40, 0.48) :
      tier === 1 ? R.range(0.34, 0.43) :
      R.range(0.29, 0.38);
    const tpl = tplIdx >= 0 ? templates[tplIdx % templates.length] : templates[R.int(0, templates.length - 1)];
    const sats = hasSats
      ? Array.from({ length: 4 }, (_, k) => ({
          along: -rad * (0.85 + k * 0.42) + R.range(-2, 2),
          perp: (k % 2 === 0 ? -1 : 1) * (rad * 0.88 + 4 + (k >> 1) * 4),
          s: R.range(2.8, 4.6),
          a0: R.range(0, TAU),
          va: R.sign() * R.range(6, 11),
          tpl: templates[(k * 2 + 1) % templates.length],
        }))
      : null;
    const shears = [
      [-0.76, R.range(0.82, 1.14)],
      [R.range(-0.18, 0.16), R.range(1.08, 1.38)],
      [0.80, R.range(0.62, 0.94)],
    ];
    boulders.push({
      tier, // 3 = Colossal Monolith, 2 = Heavy Crag Boulder, 1 = Medium Jagged Stone, 0 = Small Cobble
      xHit: clamp(x, -144, 144),
      yHit: R.range(-1.0, 1.5),
      rad,
      slant: sl,
      t0: tHit - fallDur,
      tHit,
      fallDur,
      rot0: tier === 3 && tplIdx % 3 === 0 ? R.range(-0.16, 0.16) : R.range(0, TAU),
      vRot: R.sign() * (tier === 3 ? R.range(0.42, 0.90) : tier === 2 ? R.range(1.8, 3.5) : R.range(4.8, 9.8)),
      tpl,
      sats,
      shears,
      stamp: R.int(0, 2),
      landed: false,
    });
  };

  // TIER 3 — Six Colossal Titan Monoliths (40px to 58px!) for unrelenting sky-filling dread
  addFaller(0.82, -72 + R.range(-4, 4), 20.5, 3, R.range(-0.015, 0.015), 0, true);   // Jagged Spire #1
  addFaller(1.38, 66 + R.range(-4, 4), 21.5, 3, R.range(-0.015, 0.015), 1, true);    // Broad Anvil #2
  addFaller(1.92, -106 + R.range(-4, 4), 19.5, 3, R.range(-0.015, 0.015), 5, false); // Left Bastion #3
  addFaller(2.32, 98 + R.range(-4, 4), 18.8, 3, R.range(-0.015, 0.015), 2, false);   // Twin-Barrage Right #4 (overlaps King's descent!)
  addFaller(2.62, 2 + R.range(-3, 3), 27.0, 3, R.range(-0.01, 0.01), 3, true);       // THE KING MONOLITH (~58px!)
  addFaller(3.26, -34 + R.range(-4, 4), 20.8, 3, R.range(-0.015, 0.015), 4, true);   // Final Peak Anvil #6

  // TIER 2 — Twenty-two Heavy Crag Boulders (20px to 29px wide) — dense barrage + widening tail
  const heavySchedule = [
    [0.50, 16, 10.6], [0.66, 112, 11.2], [0.96, -12, 12.0], [1.12, -118, 10.8],
    [1.26, 26, 12.5], [1.54, -44, 11.8], [1.68, 118, 10.8], [1.82, 12, 11.4],
    [2.06, -54, 12.6], [2.18, 44, 13.0], [2.46, -84, 11.6], [2.78, 64, 12.2],
    [2.92, -122, 10.6], [3.06, -8, 12.8], [3.18, 108, 11.4], [3.40, 42, 11.8],
    [3.52, -92, 11.0],
    // Gradual deceleration ("慢慢停止"): intervals stretch progressively wider!
    [3.76, 28, 11.2],
    [4.08, -48, 10.4],
    [4.48, 12, 10.2], // Final heavy straggler boulder crashing into the dust!
  ];
  for (const [th, x0, r0] of heavySchedule) {
    addFaller(th + R.range(-0.018, 0.018), x0 + R.range(-7, 7), r0 * R.range(0.94, 1.07), 2, R.range(-0.025, 0.025));
  }

  // TIER 1 — Fifty-six Medium Jagged Stones (10px to 16px wide, full faceted rocks!)
  for (let i = 0; i < 46; i++) {
    const th = lerp(0.34, 3.52, i / 45) + R.range(-0.02, 0.02);
    const lane = ((i * 9 + 4) % 17) / 16;
    const x = lerp(-144, 144, lane) + R.range(-8, 8);
    addFaller(th, x, R.range(4.8, 7.6), 1, R.range(-0.032, 0.032));
  }
  const tailMedium = [
    [3.64, -98, 6.2], [3.72, 82, 5.6], [3.86, -16, 6.4], [3.98, 56, 5.4],
    [4.16, -72, 5.8], [4.32, 92, 5.0], [4.58, -32, 5.2], [4.82, 44, 4.7],
    [5.06, -18, 4.5], // Late medium stone
  ];
  for (const [th, x0, r0] of tailMedium) {
    addFaller(th + R.range(-0.015, 0.015), x0 + R.range(-6, 6), r0, 1, R.range(-0.03, 0.03));
  }

  // TIER 0 — Sixty-four Crisp Tumbling Cobbles (5px to 7px pixel-cluster stones filling the gaps!)
  for (let i = 0; i < 52; i++) {
    const th = lerp(0.28, 3.54, i / 51) + R.range(-0.02, 0.02);
    const lane = ((i * 13 + 7) % 21) / 20;
    const x = lerp(-146, 146, lane) + R.range(-7, 7);
    addFaller(th, x, R.range(2.2, 3.2), 0, R.range(-0.04, 0.04));
  }
  for (let i = 0; i < 12; i++) {
    const u = i / 11;
    const th = 3.60 + Math.pow(u, 1.38) * 1.68; // Stretches smoothly out to 5.28s!
    const x = lerp(-124, 124, ((i * 7 + 3) % 12) / 11) + R.range(-8, 8);
    addFaller(th, x, R.range(2.0, 3.0), 0, R.range(-0.035, 0.035));
  }

  boulders.sort((a, b) => a.tHit - b.tHit);

  const makeImpactSpikes = (scaleK) => [
    { a: -0.05, len: R.range(34, 46) * scaleK, w: 2.1 * scaleK },
    { a: Math.PI + 0.05, len: R.range(34, 46) * scaleK, w: 2.1 * scaleK },
    { a: -0.40 + R.range(-0.07, 0.07), len: R.range(16, 24) * scaleK, w: 1.5 * scaleK },
    { a: -Math.PI + 0.40 + R.range(-0.07, 0.07), len: R.range(16, 24) * scaleK, w: 1.5 * scaleK },
    { a: -Math.PI / 2 + R.range(-0.14, 0.14), len: R.range(22, 30) * scaleK, w: 1.75 * scaleK },
    { a: -1.02 + R.range(-0.08, 0.08), len: R.range(12, 18) * scaleK, w: 1.25 * scaleK },
    { a: -Math.PI + 1.02 + R.range(-0.08, 0.08), len: R.range(12, 18) * scaleK, w: 1.25 * scaleK },
  ];

  const craters = [];
  const rings = [];
  const lodged = [];
  const floorCracks = [];

  function drawTemplatedRock(p, tpl, cx, cy, rad, rot, opts = {}) {
    const {
      heat = 0,
      splitGap = 0,
      alpha = 1,
      clipY = Infinity,
      topClip = -215,
      whiteFlash = false,
      muted = false,
      stamp = 0,
    } = opts;
    if (alpha <= 0.02) return;

    // Fast path for small cobbles & chunks (rad <= 3.3)
    if (rad <= 3.3 && splitGap === 0) {
      drawCobbleStamp(p, cx, cy, stamp, S, alpha, muted);
      return;
    }

    const { G, SPAN, qBuf, fBuf, vBuf, faceN } = tpl;
    const invScale = 23 / Math.max(1.8, rad);
    const bound = Math.ceil(rad * 1.26 + splitGap * 0.58) + 2;
    const X0 = Math.max(-188, Math.floor(cx - bound)), X1 = Math.min(187, Math.ceil(cx + bound));
    const Y0 = Math.max(topClip, Math.floor(cy - bound)), Y1 = Math.min(Math.ceil(clipY), Math.ceil(cy + bound));
    const W = X1 - X0 + 3, H = Y1 - Y0 + 3;
    if (W <= 2 || H <= 2 || W > MAX_BOX || H > MAX_BOX) return;

    const totalCells = W * H;
    SCRATCH_MASK.fill(0, 0, totalCells);

    const rotD = splitGap > 0 ? 0.24 * clamp(splitGap / 11) : 0;
    const caP = Math.cos(rot + rotD), saP = Math.sin(rot + rotD);
    const caN = splitGap > 0 ? Math.cos(rot - rotD) : caP;
    const saN = splitGap > 0 ? Math.sin(rot - rotD) : saP;
    const halfGap = splitGap * 0.5;

    for (let j = 0; j < H; j++) {
      const py = Y0 - 1 + j + 0.5;
      if (py > clipY || py < topClip) continue;
      const dy = py - cy;
      const seamW = splitGap > 0 ? splitGap * 0.43 + 1.15 * Math.sin(dy * 0.34) : 0;
      const rowOff = j * W;
      for (let i = 0; i < W; i++) {
        const px = X0 - 1 + i + 0.5;
        let dx = px - cx;
        if (splitGap > 0) {
          if (Math.abs(dx) < seamW) continue;
          if (dx >= 0) dx -= halfGap;
          else dx += halfGap;
        }
        const ca = splitGap > 0 && px - cx < 0 ? caN : caP;
        const sa = splitGap > 0 && px - cx < 0 ? saN : saP;
        const gx = clamp(Math.round((dx * ca + dy * sa) * invScale), -G, G);
        const gy = clamp(Math.round((-dx * sa + dy * ca) * invScale), -G, G);
        const ti = (gy + G) * SPAN + (gx + G);
        if (qBuf[ti] <= 1) {
          SCRATCH_MASK[rowOff + i] = 1;
          SCRATCH_TI[rowOff + i] = ti;
        }
      }
    }

    const lxP = -0.62 * caP - 0.78 * saP, lyP = 0.62 * saP - 0.78 * caP;
    const sxBase = p.cellX(X0 - 1, 0);

    for (let j = 1; j < H - 1; j++) {
      const py = Y0 - 1 + j;
      if (py + 0.5 > clipY || py < topClip) continue;
      const emergeA = py < -184 ? clamp((py - topClip) / 28) : 1;
      const rowA = alpha * emergeA;
      if (rowA <= 0.03) continue;
      const sy = p.cellY(0, py);
      const rowOff = j * W;

      for (let i = 1; i < W - 1; i++) {
        const sx = sxBase + i * p.fx;
        const cell = rowOff + i;
        if (!SCRATCH_MASK[cell]) {
          if (SCRATCH_MASK[cell - 1] || SCRATCH_MASK[cell + 1] || SCRATCH_MASK[cell - W] || SCRATCH_MASK[cell + W]) {
            p.put(sx, sy, muted ? S[1] : S[0], rowA);
          }
          continue;
        }
        if (whiteFlash) {
          p.put(sx, sy, WHITE, rowA);
          continue;
        }
        const ti = SCRATCH_TI[cell];
        const fb = fBuf[ti];
        const fn = faceN[fb & 15];
        const lit = fn[0] * lxP + fn[1] * lyP;

        if (muted) {
          p.put(sx, sy, S[lit > 0.32 ? 3 : lit > -0.22 ? 2 : 1], rowA);
          continue;
        }

        if (heat > 0.08) {
          const fv = vBuf[ti];
          if (fv < 0.095 * heat) {
            const hk = 1 - fv / (0.095 * heat);
            p.put(sx, sy, hk > 0.65 ? GL[5] : hk > 0.35 ? GL[4] : GL[2], rowA);
            continue;
          }
          if (splitGap > 0) {
            const px = X0 - 1 + i;
            const cleftD = Math.abs(px + 0.5 - cx) - splitGap * 0.43;
            if (cleftD < 3.4) {
              p.put(sx, sy, cleftD < 1.3 ? GL[5] : cleftD < 2.3 ? GL[4] : GL[2], rowA);
              continue;
            }
          }
        }

        const isStrata = (fb >> 4) & 1;
        const isCap = (fb >> 5) & 1;
        const isPit = (fb >> 6) & 1;
        const leftOut = !SCRATCH_MASK[cell - 1], topOut = !SCRATCH_MASK[cell - W];
        const edge = leftOut || topOut || !SCRATCH_MASK[cell + 1] || !SCRATCH_MASK[cell + W];

        let si;
        if (isCap && lit > 0.12) si = 6;
        else if (lit > 0.50) si = 6;
        else if (lit > 0.14) si = 5;
        else if (lit > -0.26) si = 4;
        else if (lit > -0.58) si = 3;
        else si = 2;

        if (isStrata && si > 2) si -= 1;
        if (isPit && rad > 9 && si > 2) si -= 1;

        if (edge) {
          const topLeftEdge = leftOut || topOut;
          si = topLeftEdge && lit > 0.05 ? 7 : !topLeftEdge && lit < -0.05 ? 1 : si;
        } else if (qBuf[ti] > 0.88 && lit < -0.25) {
          si = Math.max(1, si - 1);
        }
        p.put(sx, sy, S[si], rowA);
      }
    }
  }

  function rockFlightPos(b, tt) {
    const u = clamp((tt - b.t0) / b.fallDur);
    const k = 0.38 * u + 0.62 * u * u;
    const yEnd = b.yHit - b.rad * 0.45;
    const y = lerp(-198, yEnd, k);
    const dy = yEnd - y;
    const x = b.xHit - dy * b.slant;
    return [x, y, u];
  }

  function spawnFloorCracks(x0, y0, count, minL, maxL) {
    for (let i = 0; i < count; i++) {
      let a = (i / count) * TAU + R.range(-0.22, 0.22);
      const len = R.range(minL, maxL);
      const pts = [[x0 + Math.cos(a) * 6, y0 + Math.sin(a) * 6 * SY]];
      let cx = pts[0][0], cy = pts[0][1];
      for (let d = 0; d < len; d += 3.0) {
        a += R.range(-0.38, 0.38);
        cx = clamp(cx + Math.cos(a) * 3.0, -178, 178);
        cy = clamp(cy + Math.sin(a) * 3.0 * SY, -3.5, 9.5);
        pts.push([cx, cy]);
      }
      floorCracks.push({ pts, t0: t, grow: R.range(0.06, 0.13), life: R.range(2.2, 3.3) });
    }
  }

  function spawnDustPlume(x, tier, isKing = false) {
    if (tier === 3) {
      // Fanning, mushrooming dust blast cloud above each Colossal Monolith crater (NO narrow vertical sticks!)
      const nCol = isKing ? 10 : 7;
      for (let i = 0; i < nCol; i++) {
        const u = i / (nCol - 1);
        const fan = (i % 2 === 0 ? -1 : 1) * (6 + u * 22) + R.range(-8, 8);
        addPuff(
          x + fan * 0.45,
          -3 - u * (isKing ? 22 : 16),
          fan * 1.35,
          -lerp(18, isKing ? 72 : 56, u),
          lerp(8.5, 6.5, u),
          lerp(13.5, 13.0, u),
          R.range(1.15, 1.8),
          u * 0.05,
          u > 0.35 ? 1 : 0
        );
      }
      // Dense rolling ground dust blanket skimming outward behind the shockwave crescents!
      for (const sd of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          addPuff(
            x + sd * (9 + i * 7),
            -3 - R.range(0, 3),
            sd * lerp(46, 130, i / 4),
            -R.range(3, 13),
            R.range(6, 8.5),
            R.range(10, 13.5),
            R.range(1.05, 1.65),
            i * 0.025,
            i < 2 ? 1 : 0
          );
        }
      }
    } else if (tier === 2) {
      for (let i = 0; i < 4; i++) {
        const u = i / 3;
        const fan = (i % 2 === 0 ? -1 : 1) * (4 + u * 12) + R.range(-4, 4);
        addPuff(x + fan * 0.4, -2 - u * 9, fan * 1.2, -lerp(14, 42, u), 5.5, 9.5, R.range(0.85, 1.28), u * 0.035, u > 0.4 ? 1 : 0);
      }
      for (const sd of [-1, 1]) {
        addPuff(x + sd * 6, -2.5, sd * R.range(42, 85), -R.range(2, 9), 4.5, 8.5, R.range(0.8, 1.25), 0, 0);
      }
    } else if (tier === 1) {
      for (const sd of [-1, 1]) {
        addPuff(x + sd * 3, -1.5, sd * R.range(20, 48), -R.range(3, 12), 3, 5.2, R.range(0.45, 0.78), 0, 0);
      }
    } else {
      addPuff(x, -1, R.range(-16, 16), -R.range(4, 10), 2, 3.4, R.range(0.28, 0.48), 0, 0);
    }
  }

  function triggerImpact(b) {
    b.landed = true;
    const x = b.xHit, y = b.yHit;

    if (b.tier === 3) {
      const isKing = b.rad > 23;
      lights.add(x, -28, isKing ? 98 : 80, GL[4], 0.88, 0.58);
      lights.add(x, -10, isKing ? 58 : 44, WHITE, 0.95, 0.14);
      flashes.push({ x, power: isKing ? 1.35 : 1.0, life: 0.44, max: 0.44 });

      const maxR = Math.min(isKing ? 152 : 126, 180 - Math.abs(x));
      rings.push({
        x, y: y + 0.5, rMax: maxR, dur: isKing ? 0.56 : 0.48, t0: t, tier: 3,
        spikes: makeImpactSpikes(isKing ? 1.34 : 1.05),
      });
      craters.push({ x, y, rx: b.rad * 1.65, t0: t, tier: 3, heat: 1 });
      spawnFloorCracks(x, y + 0.5, isKing ? 10 : 7, 28, isKing ? 72 : 52);
      spawnDustPlume(x, 3, isKing);

      const slabs = [-1, 1].map((sd) => ({
        x: x + sd * (b.rad * 0.92 + R.range(2, 6)),
        s: R.range(5.2, 7.4),
        a: sd * R.range(0.45, 0.72),
        tpl: templates[R.int(0, templates.length - 1)],
      }));
      lodged.push({
        x, y: y - b.rad * 0.28, rad: b.rad * 0.92, rot: b.rot0 + b.fallDur * b.vRot,
        tpl: b.tpl, t0: t, tShatter: t + R.range(0.58, 0.88), shattered: false, slabs,
      });

      const nChunks = isKing ? 15 : 11;
      for (let i = 0; i < nChunks; i++) {
        const sd = R.sign(), a = -Math.PI / 2 + sd * R.range(0.2, 1.15), sp = R.range(125, 290);
        bits.add({
          kind: B.CHUNK, x: x + R.range(-b.rad * 0.5, b.rad * 0.5), y: -3,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          g: 1, drag: 0.45, bounce: 0.34, life: Math.min(R.range(1.05, 1.7), T_END - 0.14 - t),
          a: R.range(0, TAU), va: R.range(-14, 14), s: R.range(2.4, 5.0),
          tpl: templates[R.int(0, templates.length - 1)], stamp: R.int(0, 2),
        });
      }
      for (let i = 0; i < (isKing ? 64 : 44); i++) {
        const u = R.range(-1, 1), a = -Math.PI / 2 + u * 0.92, sp = R.range(95, 295);
        ps.spawn(P.GRIT, x + u * b.rad * 0.6, -1, Math.cos(a) * sp, Math.sin(a) * sp, Math.min(R.range(0.9, 1.6), T_END - 0.12 - t), R.pick([S[7], S[6], S[5], S[4]]), R.chance(0.45) ? 2 : 1);
      }
      for (let i = 0; i < (isKing ? 40 : 28); i++) {
        const a = -Math.PI / 2 + R.range(-1.38, 1.38), sp = R.range(140, 340);
        ps.spawn(P.SPARK, x + R.range(-10, 10), -3, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.52));
      }
    } else if (b.tier === 2) {
      lights.add(x, -14, 48, GL[4], 0.56, 0.30);
      lights.add(x, -4, 26, WHITE, 0.72, 0.08);
      flashes.push({ x, power: 0.55, life: 0.24, max: 0.24 });

      rings.push({
        x, y: y + 0.5, rMax: Math.min(68, 180 - Math.abs(x)), dur: 0.36, t0: t, tier: 2,
        spikes: makeImpactSpikes(0.64),
      });
      craters.push({ x, y, rx: b.rad * 1.55, t0: t, tier: 2, heat: 0.72 });
      spawnFloorCracks(x, y + 0.5, 4, 16, 30);
      spawnDustPlume(x, 2, false);

      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + R.range(-1.15, 1.15), sp = R.range(95, 225);
        bits.add({
          kind: B.CHUNK, x: x + R.range(-4, 4), y: -2,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          g: 1, drag: 0.5, bounce: 0.32, life: Math.min(R.range(0.8, 1.3), T_END - 0.14 - t),
          a: R.range(0, TAU), va: R.range(-16, 16), s: R.range(1.9, 3.5),
          tpl: templates[R.int(0, templates.length - 1)], stamp: R.int(0, 2),
        });
      }
      for (let i = 0; i < 18; i++) {
        const a = -Math.PI / 2 + R.range(-1.0, 1.0), sp = R.range(75, 215);
        ps.spawn(P.GRIT, x + R.range(-5, 5), -1, Math.cos(a) * sp, Math.sin(a) * sp, Math.min(R.range(0.65, 1.2), T_END - 0.12 - t), R.pick([S[6], S[5], S[4]]), R.chance(0.35) ? 2 : 1);
      }
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + R.range(-1.25, 1.25), sp = R.range(110, 255);
        ps.spawn(P.SPARK, x, -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.15, 0.34));
      }
    } else if (b.tier === 1) {
      lights.add(x, -5, 22, GL[4], 0.32, 0.14);
      rings.push({ x, y: y + 0.5, rMax: Math.min(28, 180 - Math.abs(x)), dur: 0.22, t0: t, tier: 1, spikes: null });
      craters.push({ x, y, rx: b.rad * 1.4, t0: t, tier: 1, heat: 0.32 });
      spawnDustPlume(x, 1, false);

      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + R.range(-1.0, 1.0), sp = R.range(60, 150);
        ps.spawn(P.GRIT, x, -1, Math.cos(a) * sp, Math.sin(a) * sp, Math.min(R.range(0.45, 0.9), T_END - 0.12 - t), R.pick([S[6], S[5], S[4]]), 1);
      }
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(85, 185);
        ps.spawn(P.SPARK, x, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.11, 0.22));
      }
    } else {
      spawnDustPlume(x, 0, false);
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + R.range(-0.9, 0.9), sp = R.range(45, 115);
        ps.spawn(P.GRIT, x, -1, Math.cos(a) * sp, Math.sin(a) * sp, Math.min(R.range(0.35, 0.7), T_END - 0.12 - t), R.pick([S[6], S[5], S[4]]), 1);
      }
    }
  }

  function drawSkyPall(p) {
    // Deep, multi-layered choking dust-storm ceiling (smooth volumetric billows + fast p.blendPx!)
    const pallA = smooth(0, 0.38, t) * (1 - smooth(3.68, 5.55, t));
    if (pallA <= 0.01) return;

    const dBack = Math.round(t * 9);
    const dMid = Math.round(t * 15);
    const dFront = Math.round(t * 23);
    const sx0 = p.cellX(VEIL_X0, 0);
    const syTop = p.cellY(0, -216);

    for (let i = 0; i < VEIL_W; i++) {
      const ef = bankEdge[i];
      if (ef <= 0.02) continue;
      const x = VEIL_X0 + i;
      const sx = sx0 + i * p.fx;
      const iB = ((i - dBack) % VEIL_W + VEIL_W) % VEIL_W;
      const iM = ((i - dMid) % VEIL_W + VEIL_W) % VEIL_W;
      const iF = ((i - dFront) % VEIL_W + VEIL_W) % VEIL_W;

      const yBack = -215 + waveBack[iB] * ef;
      const yMid = -215 + waveMid[iM] * ef;
      const yFront = -215 + waveFront[iF] * ef;
      const yMax = Math.ceil(Math.max(yBack, yMid, yFront));

      // Smooth warm bounce-light modulated by cloud billow thickness (ZERO vertical color banding!)
      let bounce = 0;
      for (let f = 0; f < flashes.length; f++) {
        const fl = flashes[f];
        const dx = Math.abs(x - fl.x);
        if (dx < 145) {
          const u = 1 - dx / 145;
          bounce += fl.power * (fl.life / fl.max) * u * u;
        }
      }
      const billowMod = 0.7 + 0.3 * clamp((waveBack[iB] - 32) / 36);
      const bIdx = clamp(Math.round(Math.min(1, bounce * billowMod) * 15), 0, 15);
      const bellyCol = BELLY_RAMP[bIdx];
      const colScale = pallA * ef;

      for (let y = -216; y <= yMax; y++) {
        const topFade = y < -209 ? (y + 217) * 0.125 : 1;
        let col = CLOUD_UPPER, a = 0;
        if (y < yBack) {
          const d = yBack - y;
          a = (d < 22 ? d / 22 : 1) * 0.46;
          col = bellyCol;
        }
        if (y < yMid) {
          const d = yMid - y;
          const aM = (d < 15 ? d / 15 : 1) * 0.62;
          if (aM > a) { a = aM; col = CLOUD_MID; }
        }
        if (y < yFront) {
          const d = yFront - y;
          const aF = (d < 11 ? d / 11 : 1) * 0.78;
          if (aF > a) { a = aF; col = CLOUD_UPPER; }
        }
        const finalA = a * colScale * topFade;
        if (finalA > 0.03) p.blendPx(sx, syTop + (y + 216), col, finalA);
      }
    }

    // Diagonal sifting dust-and-silt curtains pouring down out of the storm clouds
    const curtainA = smooth(0.06, 0.44, t) * (1 - smooth(3.55, 4.88, t));
    if (curtainA > 0.03) {
      for (let i = 0; i < 32; i++) {
        const u = (t * (1.55 + (i % 5) * 0.28) + i * 0.21) % 1;
        const x0 = lerp(-150, 150, ((i * 7 + 3) % 32) / 31);
        const y0 = -194 + u * 160;
        const x = x0 + (y0 + 194) * SLANT;
        const a = curtainA * Math.sin(Math.PI * u) * 0.38;
        if (a > 0.05) p.line(x, y0, x + 17 * SLANT, y0 + 17, i % 2 ? S[4] : S[3], a);
      }
    }
  }

  function drawDustPuffs(p) {
    // Threshold-eroded scalloped pixel-art dust clouds: solid chunky body that erodes inward as it ages!
    for (let idx = 0; idx < puffs.length; idx++) {
      const q = puffs[idx];
      if (q.age < 0) continue;
      const u = q.age / q.life;
      const r = clamp(Math.round(lerp(q.r0, q.r1, 1 - Math.pow(1 - u, 2.3))), 1, 15);
      const lut = PUFF_LUTS[r];
      if (!lut.length) continue;

      // Threshold cut shrinks from 1.0 -> 0.12 so edges break apart organically instead of faint alpha ghosting!
      const cut = 1.0 - Math.pow(u, 1.35) * 0.88;
      const op = Math.min(1, u * 11) * (1 - smooth(0.68, 1, u)) * 0.84;
      if (op <= 0.03) continue;

      let warm = 0;
      for (let f = 0; f < flashes.length; f++) {
        const fl = flashes[f];
        const dx = Math.abs(q.x - fl.x);
        if (dx < 92) warm += fl.power * (fl.life / fl.max) * (1 - dx / 92);
      }
      const c2 = warm > 0.45 ? GL[4] : warm > 0.18 ? DUST_CREST : q.bright ? DUST_CREST : S[6];
      const c1 = warm > 0.55 ? mix(DUST_BODY, GL[3], 0.45) : DUST_BODY;
      const cx = Math.round(q.x), cy = Math.round(q.y);

      for (let k = 0; k < lut.length; k += 4) {
        const edgeQ = lut[k + 2];
        if (edgeQ > cut) continue;
        const sx = p.cellX(cx + lut[k], cy + lut[k + 1]);
        const sy = p.cellY(cx + lut[k], cy + lut[k + 1]);
        const zone = lut[k + 3];
        const col = zone === 2 ? c2 : zone === 1 ? c1 : DUST_SHADOW;
        const rimSoft = edgeQ > cut * 0.84 ? 0.62 : 1;
        p.blendPx(sx, sy, col, op * rimSoft);
      }
    }
  }

  return {
    update(dt) {
      t += dt;

      for (let i = flashes.length - 1; i >= 0; i--) {
        if ((flashes[i].life -= dt) <= 0) flashes.splice(i, 1);
      }

      for (let i = puffs.length - 1; i >= 0; i--) {
        const q = puffs[i];
        q.age += dt;
        if (q.age < 0) continue;
        if (q.age >= q.life) {
          puffs.splice(i, 1);
          continue;
        }
        q.vx -= q.vx * 2.4 * dt;
        q.vy -= q.vy * 1.45 * dt + 8 * dt;
        q.x += (q.vx + Math.sin(t * 1.8 + q.ph) * 4.5) * dt;
        q.y += q.vy * dt;
        if (q.x < -OX + 18 || q.x > W_CV - OX - 18 || q.y < -OY + 18) puffs.splice(i, 1);
      }

      // Continuous Gravel & Pebble Hail: builds 0.06..0.42s, roars 0.42..3.55s, tapers 3.55..5.35s
      const rainRate =
        t < 0.06 ? 0 :
        t < T_OMEN ? lerp(26, 92, seg(t, 0.06, T_OMEN)) :
        t < T_PEAK_END ? 96 :
        t < 5.38 ? 96 * Math.pow(1 - seg(t, T_PEAK_END, 5.38), 2.15) : 0;

      for (gritAcc += rainRate * dt; gritAcc >= 1; gritAcc--) {
        const gx = R.range(-150, 150);
        const gy = R.range(-196, -174);
        const vy = R.range(260, 435);
        const vx = vy * (SLANT + R.range(-0.04, 0.04));
        ps.spawn(P.GRIT, gx, gy, vx, vy, Math.min(R.range(0.85, 1.45), T_END - 0.12 - t), R.pick([S[6], S[5], S[4], S[3]]), R.chance(0.4) ? 2 : 1);
      }

      for (const b of boulders) {
        if (t < b.t0 || b.landed) continue;
        const [x, y] = rockFlightPos(b, t);
        if (b.tier >= 2 && y > -186 && R.chance((b.tier === 3 ? 0.65 : 0.25) * dt * 60)) {
          ps.spawn(
            P.GRIT,
            x + R.range(-b.rad * 0.75, b.rad * 0.75),
            y - b.rad * 0.4,
            b.slant * 85 + R.range(-24, 24),
            R.range(85, 175),
            Math.min(R.range(0.45, 0.85), T_END - 0.12 - t),
            R.pick([S[6], S[5], S[4]]),
            R.chance(0.35) ? 2 : 1
          );
        }
        if (t >= b.tHit) triggerImpact(b);
      }

      for (const lg of lodged) {
        if (!lg.shattered && t >= lg.tShatter) {
          lg.shattered = true;
          lights.add(lg.x, -12, 44, GL[3], 0.48, 0.28);
          flashes.push({ x: lg.x, power: 0.45, life: 0.2, max: 0.2 });
          for (let i = 0; i < 7; i++) {
            const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(80, 185);
            bits.add({
              kind: B.CHUNK, x: lg.x + R.range(-12, 12), y: -4,
              vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
              g: 1, drag: 0.5, bounce: 0.28, life: Math.min(R.range(0.85, 1.3), T_END - 0.14 - t),
              a: R.range(0, TAU), va: R.range(-13, 13), s: R.range(2.2, 3.8),
              tpl: templates[R.int(0, templates.length - 1)], stamp: R.int(0, 2),
            });
          }
          for (const sd of [-1, 1]) {
            addPuff(lg.x + sd * 6, -3, sd * R.range(22, 55), -R.range(8, 28), 4.5, 8.5, R.range(0.8, 1.25), 0, 1);
          }
        }
      }

      for (const c of bits.list) c.pvy = c.vy;
      bits.update(dt);
      for (let i = bits.list.length - 1; i >= 0; i--) {
        const c = bits.list[i];
        if (c.x < X_MIN || c.x > X_MAX || c.y < Y_MIN) {
          bits.list.splice(i, 1);
          continue;
        }
        if (c.pvy > 95 && (c.vy <= 0 || c.rest) && !c.dusted && t < T_END - 0.45) {
          c.dusted = true;
          addPuff(c.x, -1, R.sign() * R.range(8, 24), -R.range(2, 8), 1.8, 3.2, R.range(0.26, 0.45), 0, 0);
        }
      }

      ps.update(dt);
      for (let i = ps.list.length - 1; i >= 0; i--) {
        const q = ps.list[i];
        if (q.x < X_MIN || q.x > X_MAX || q.y < Y_MIN) ps.list.splice(i, 1);
      }
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-6) return;

      // 1) Distant Background Rock Barrage (atmospheric perspective silhouettes!)
      const spNorm = Math.hypot(SLANT, 1), uxBg = SLANT / spNorm, uyBg = 1 / spNorm;
      for (const bg of bgRocks) {
        if (t < bg.t0 || t >= bg.tHit) continue;
        const u = clamp((t - bg.t0) / bg.fallDur);
        const k = 0.38 * u + 0.62 * u * u;
        const y = lerp(-196, -1, k);
        const x = bg.xHit + y * bg.slant;
        if (x < -168 || x > 168) continue;
        const streakL = (bg.rad > 5 ? 20 : 10) * u;
        if (y - uyBg * (bg.rad + streakL) > -212) {
          p.line(x - uxBg * bg.rad, y - uyBg * bg.rad, x - uxBg * (bg.rad + streakL), y - uyBg * (bg.rad + streakL), S[2], 0.52);
        }
        drawTemplatedRock(p, bg.tpl, x, y, bg.rad, bg.rot0 + (t - bg.t0) * bg.vRot, {
          muted: true,
          clipY: 0,
          stamp: bg.stamp,
        });
      }

      // 2) Multi-layered Choking Dust-Storm Sky Ceiling
      drawSkyPall(p);

      const endFade = 1 - smooth(T_END - 0.95, T_END - 0.12, t);

      // 3) Looming Ground Shadows & Tightening Pressure Rings under incoming boulders
      for (const b of boulders) {
        if (b.tier === 0) continue;
        const warnLead = b.tier === 3 ? 0.25 : b.tier === 2 ? 0.12 : 0.03;
        if (t < b.t0 - warnLead || b.landed) continue;
        const k = clamp((t - (b.t0 - warnLead)) / (b.fallDur + warnLead));
        const rx = b.rad * (0.45 + 1.05 * k), ry = Math.max(1.5, rx * SY * 1.28);
        const shA = (b.tier === 3 ? 0.86 : b.tier === 2 ? 0.68 : 0.42) * k * endFade;
        p.ellipse(b.xHit, b.yHit + 0.5, rx, ry, SOOT, shA);
        if (b.tier === 3 && k > 0.28) {
          const pr = lerp(b.rad * 2.0, b.rad * 0.85, k);
          drawFloorBand(p, b.xHit, b.yHit + 0.5, pr, SY, 1.5, 0.55 * k, [S[2], GL[2], GL[3], GL[4]], true, false);
          drawFloorBand(p, b.xHit, b.yHit + 0.5, pr, SY, 1.5, 0.55 * k, [S[2], GL[2], GL[3], GL[4]], false, false);
        }
      }

      // 4) Craters & Radiating Floor Cracks
      if (endFade > 0.01) {
        for (const c of craters) {
          const age = t - c.t0;
          const life = c.tier === 3 ? 3.5 : c.tier === 2 ? 2.2 : 1.1;
          if (age < 0 || age >= life) continue;
          const cf = (1 - smooth(life * 0.55, life, age)) * endFade;
          const rx = c.rx * ease.outCubic(clamp(age / 0.07));
          const ry = Math.max(1.3, rx * SY);
          p.ellipse(c.x, c.y + 0.5, rx, ry, S[1], cf * 0.85);
          p.ellipse(c.x, c.y + 0.3, rx * 0.72, Math.max(1, ry * 0.68), SOOT, cf);
          const hot = c.heat * Math.max(0, 1 - age / (c.tier === 3 ? 1.15 : 0.55));
          if (hot > 0.08) {
            p.line(c.x - rx * 0.56, c.y + 0.5, c.x + rx * 0.56, c.y + 0.5, hot > 0.55 ? GL[4] : GL[2], cf);
          }
          if (c.tier >= 2) {
            for (const sd of [-1, 1]) {
              const lx = c.x + sd * rx * 0.88;
              p.dot(lx, c.y - 1, S[5], cf);
              p.dot(lx + sd, c.y, S[3], cf);
            }
          }
        }

        for (const fc of floorCracks) {
          const age = t - fc.t0;
          if (age < 0 || age >= fc.life) continue;
          const fade = (1 - smooth(fc.life * 0.6, fc.life, age)) * endFade;
          const nPts = Math.floor(fc.pts.length * clamp(age / fc.grow));
          const heat = Math.max(0, 1 - age / 0.85);
          for (let i = 1; i < nPts; i++) {
            const u = i / fc.pts.length;
            const lh = heat * (1 - 0.45 * u);
            const [x0, y0] = fc.pts[i - 1], [x1, y1] = fc.pts[i];
            const col = lh > 0.62 ? GL[5] : lh > 0.36 ? GL[4] : lh > 0.16 ? GL[2] : SOOT;
            p.line(x0, y0, x1, y1, col, fade);
          }
        }
      }

      // 5) Far half of ground shockwave rings
      for (const rg of rings) {
        const u = (t - rg.t0) / rg.dur;
        if (u < 0 || u >= 1) continue;
        const r = 6 + (rg.rMax - 6) * ease.outQuart(u);
        const th = Math.max(1, (rg.tier === 3 ? 5.0 : rg.tier === 2 ? 3.2 : 1.7) * (1 - u));
        const al = (1 - smooth(0.5, 1, u)) * 1.1;
        const rCols = u < 0.28 ? [GL[2], GL[3], GL[4], GL[5]] : [S[3], S[5], S[6], GL[4]];
        drawFloorBand(p, rg.x, rg.y, r, SY, th, al, rCols, true, u < 0.15 && rg.tier >= 2);
      }

      // 6) Chunky Threshold-Eroded Dust Columns & Rolling Ground Dust Walls
      drawDustPuffs(p);
      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;

      // 1) Lodged & Splitting Titan Monoliths + Heaved Floor Slabs
      const globalEndFade = 1 - smooth(T_END - 0.85, T_END - 0.15, t);
      for (const lg of lodged) {
        const age = t - lg.t0;
        const sinkStart = lg.tShatter - lg.t0;
        const sink = smooth(sinkStart, sinkStart + 0.95, age) * (lg.rad * 1.05);
        const fade = (1 - smooth(sinkStart + 0.55, sinkStart + 1.15, age)) * globalEndFade;
        if (fade <= 0.02 || sink >= lg.rad * 1.02) continue;

        for (const sl of lg.slabs) {
          const g = ease.outBack(clamp(age / 0.09), 2);
          drawTemplatedRock(p, sl.tpl, sl.x, -1.2 + sink * 0.35, sl.s * Math.min(1, g), sl.a * g, {
            alpha: fade,
            clipY: 2,
            whiteFlash: age < 0.035,
          });
        }

        const gap = 3.5 + smooth(0, 0.36, age) * 9.5 + smooth(sinkStart, sinkStart + 0.4, age) * 6;
        const heat = Math.max(0, 1 - age / 1.15);
        drawTemplatedRock(p, lg.tpl, lg.x, lg.y + sink, lg.rad, lg.rot, {
          heat,
          splitGap: gap,
          alpha: fade,
          clipY: 2,
          whiteFlash: age < 0.035,
        });
      }

      // 2) Active Falling Foreground Cobbles, Medium Stones, Heavy Boulders & Colossal Monoliths
      const spNorm = Math.hypot(SLANT, 1), ux = SLANT / spNorm, uy = 1 / spNorm;
      for (let tierPass = 0; tierPass <= 3; tierPass++) {
        for (let bi = 0; bi < boulders.length; bi++) {
          const b = boulders[bi];
          if (b.tier !== tierPass || t < b.t0 || b.landed) continue;
          const [x, y, u] = rockFlightPos(b, t);
          if (y + b.rad < -214) continue;

          if (b.tier === 0) {
            const sy1 = Math.max(-212, y - uy * (8 * u));
            if (y > -210 && y > sy1) p.line(x, y, x - ux * ((y - sy1) / uy), sy1, S[5], 0.65);
            drawCobbleStamp(p, x, y, b.stamp, S, 1, false);
            continue;
          }

          const rot = b.rot0 + (t - b.t0) * b.vRot;

          // Tapered translucent air-displacement wake behind Heavy & Titan boulders
          if (b.tier >= 2 && y > -196) {
            const wakeL = (b.tier === 3 ? 42 : 22) * (0.35 + 0.65 * u);
            const steps = Math.ceil(wakeL / 2.5);
            for (let s = 1; s <= steps; s++) {
              const v = s / steps;
              const wy = y - uy * (b.rad * 0.6 + v * wakeL);
              if (wy < -210) break;
              const wx = x - ux * (b.rad * 0.6 + v * wakeL);
              const hw = b.rad * 0.68 * (1 - v * 0.72);
              const wa = (1 - v) * (b.tier === 3 ? 0.22 : 0.14);
              for (let o = -hw; o <= hw; o += 2) {
                p.blend(wx - uy * o, wy + ux * o, S[5], wa * (1 - (o / (hw + 0.5)) ** 2));
              }
            }
          }

          // Asymmetric shear streaks
          const baseL = (b.tier === 3 ? 38 : b.tier === 2 ? 22 : 13) * (0.4 + 0.6 * u);
          const nSh = b.tier === 1 ? 2 : 3;
          for (let i = 0; i < nSh; i++) {
            const [offFrac, lenMul] = b.shears[i];
            const off = offFrac * b.rad;
            const sx0 = x - ux * (b.rad * 0.82) - uy * off;
            const sy0 = y - uy * (b.rad * 0.82) + ux * off;
            const len = baseL * lenMul;
            const sy1 = Math.max(-212, sy0 - uy * len);
            if (sy0 <= -211 || sy0 <= sy1) continue;
            const actualL = (sy0 - sy1) / uy;
            const sx1 = sx0 - ux * actualL;
            if (Math.abs(sx0) > 184 || Math.abs(sx1) > 184) continue;
            p.line(sx0, sy0, sx1, sy1, (q) => (q < 0.38 ? S[7] : q < 0.72 ? S[5] : S[3]), 0.82);
          }

          if (b.sats) {
            for (const st of b.sats) {
              const sx = x + ux * st.along - uy * st.perp;
              const sy = y + uy * st.along + ux * st.perp;
              if (sy > -206 && sy < -1 && Math.abs(sx) < 176) {
                p.line(sx, sy, sx - ux * 9, Math.max(-212, sy - uy * 9), S[6], 0.65);
                drawTemplatedRock(p, st.tpl, sx, sy, st.s, st.a0 + (t - b.t0) * st.va, {
                  alpha: clamp((sy + 206) / 18),
                  clipY: 1,
                });
              }
            }
          }

          const heat = b.tier === 3 ? 0.35 + 0.65 * smooth(0.48, 1, u) : 0;
          drawTemplatedRock(p, b.tpl, x, y, b.rad, rot, { heat, clipY: 2, stamp: b.stamp });

          if (b.tier === 3 && u > 0.18) {
            const baseA = Math.atan2(uy, ux);
            const bk = smooth(0.18, 0.72, u);
            for (let k = -20; k <= 20; k++) {
              const q = k / 20;
              const a = baseA + q * 1.22;
              const rr = b.rad + 3.8 + 3.2 * q * q;
              const bx = x + Math.cos(a) * rr, by = y + Math.sin(a) * rr;
              if (by > 1 || by < -212 || Math.abs(bx) > 184) continue;
              p.blend(bx, by, Math.abs(q) < 0.36 ? WHITE : S[7], (1 - q * q) * 0.84 * bk);
            }
            p.glow(x, Math.max(-188, y), b.rad * 1.35, GL[3], 0.24 * bk);
          }
        }
      }

      // 3) Tumbling debris chunks
      for (const c of bits.list) {
        drawTemplatedRock(p, c.tpl, c.x, c.y, c.s, c.a, {
          alpha: Math.min(1, c.life / 0.35),
          clipY: 2,
          stamp: c.stamp,
        });
      }

      // 4) Near half of ground shock rings, crescent shockwaves & 1-2 frame hero impact stars!
      for (const rg of rings) {
        const age = t - rg.t0, u = age / rg.dur;
        if (u < 0 || u >= 1) continue;
        const r = 6 + (rg.rMax - 6) * ease.outQuart(u);
        const th = Math.max(1, (rg.tier === 3 ? 5.0 : rg.tier === 2 ? 3.2 : 1.7) * (1 - u));
        const al = (1 - smooth(0.5, 1, u)) * 1.1;
        const rCols = u < 0.28 ? [GL[2], GL[3], GL[4], GL[5]] : [S[3], S[5], S[6], GL[4]];
        drawFloorBand(p, rg.x, rg.y, r, SY, th, al, rCols, false, u < 0.15 && rg.tier >= 2);

        if (rg.tier === 3 && u < 0.75) {
          const cu = u / 0.75;
          const ch = 5 + 20 * Math.pow(1 - cu, 0.8), cw = 1.4 + 3.8 * (1 - cu);
          const cCols = cu < 0.25 ? [WHITE, GL[5], GL[4]] : [S[7], S[5], S[4]];
          for (const sd of [-1, 1]) {
            if (Math.abs(rg.x + sd * r) < 176) {
              frontCrescent(p, rg.x + sd * r, sd, ch, cw, cCols, 1 - smooth(0.6, 1, cu));
            }
          }
        }

        if (age < 0.068 && rg.tier >= 2 && rg.spikes) {
          const hot = age < 0.034;
          const hk = 1 - age / 0.068;
          if (hot) p.ellipse(rg.x, rg.y - 0.5, rg.tier === 3 ? 25 : 13, rg.tier === 3 ? 4.4 : 2.5, WHITE);
          star(
            p,
            rg.x,
            rg.y - 1,
            rg.spikes,
            hot ? 1 : 1.22,
            hot ? 1 : 0.55,
            [GL[3], GL[4], GL[5], WHITE],
            1,
            rg.tier === 3 ? 2.8 : 1.8
          );
          flare(p, rg.x, rg.y - 3, (rg.tier === 3 ? 48 : 25) * hk, hk, [GL[2], GL[4], GL[5], WHITE]);
        }
      }

      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
