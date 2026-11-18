// Side-scrolling colossal magma-cracked rolling boulder ("fire/lava-boulder"):
// 1. Volcanic Fissure & Heave (0.00..0.46s): Ground cracks open at left; a massive basalt boulder riven with
//    white-hot magma veins heaves out of the boiling pit and slams onto the floor.
// 2. Crushing Roll & Lava Wake (0.46..1.92s): Rolls heavily rightward with true angular rotation, lurching on its
//    jagged facets, flinging arcing molten lava globs that splat into satellite magma puddles, and leaving a wide,
//    bubbling river of incandescent lava with viscous magma curtains oozing over the side-scrolling platform ledge.
// 3. Critical Overload & Eruption (1.92..2.30s): Grinds to a halt at the right, fissures surge blinding white-hot,
//    and the boulder fractures along a jagged seam into a volcanic eruption of fireballs, molten rocks, and two
//    toppling boulder halves that sink into the boiling magma crater.
// 4. Cooling Crust & Decay (2.30..4.60s): The magma river cools progressively from left to right into dark crust
//    and recedes cleanly to zero.
// Fire puffs, flame tongues, sparks, rocks and scorch adapted from Sprite Fusion's open-source fire & explosion
// (https://www.spritefusion.com/pixel-art-vfx/fire), MIT License, Copyright (c) 2026 Hugo Duprez.
import {
  Particles,
  Bits,
  Lights,
  P,
  PF,
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
  TAU,
  WHITE,
} from "../../core/index.js";
import { hotFirst, flameTongue, flameBlade, simDraw, floorLight, LAYERS } from "./_lib.js";
import { rock } from "../explosions/_lib.js";

export const meta = {
  name: "Lava boulder",
  desc: "A colossal magma-cracked boulder heaves from a volcanic rift and rolls heavily across the floor, leaving a bubbling river of molten lava and flames before erupting.",
  tags: ["fire", "lava", "magma", "boulder", "rock", "rolling", "trail", "ground", "directional", "one-shot"],
  size: [336, 156],
  origin: [46, 126],
  duration: 4.6,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#1e0806", "#4c120b", "#862010", "#c43b14", "#f06818", "#ffa226", "#ffd45c", "#fff5b8", "#ffffff"],
    stone: ["#0c0910", "#18131e", "#282030", "#3d3147", "#564663", "#756185", "#9c88ad"],
    seed: 15,
  },
};

// Choreography timing constants (seconds)
const T_SLAM = 0.46;     // Boulder heaves out of rift and slams onto the floor at x = 0
const T_STOP = 1.92;     // Boulder finishes rolling across the stage to x = END_X
const T_BURST = 2.14;    // Overloaded magma boulder shatters in a volcanic eruption
const T_SINK = 3.25;     // Fractured boulder halves finish toppling and sinking into the magma crater
const T_END = meta.duration;

const END_X = 204;       // Total horizontal roll distance (px)
const R_BOULDER = 24.5;  // Colossal boulder radius (~49 px diameter)
const SY = 0.18;         // Floor perspective squash

// Precompute the boulder's unrotated local material map [-29..28] x [-29..28] for a given seed
const boulderCache = new Map();
function getBoulderLut(seed) {
  if (boulderCache.has(seed)) return boulderCache.get(seed);
  const R = new Rng(seed * 29 + 7);
  const G = 58;
  const HALF = 29;

  // 10 angular facet vertices around the perimeter for a heavy, lumpy polygonal silhouette
  const nVerts = 10;
  const vertR = Array.from({ length: nVerts }, (_, i) =>
    R_BOULDER * (0.86 + 0.20 * ((i % 2 === 0 ? 0.72 : 0.18) + R.range(-0.12, 0.14))),
  );

  // Voronoi cell centers for volcanic basalt rock plates & magma fissures along plate seams
  const cells = [
    { x: 0, y: 0, z: 0.48 },
    ...Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * TAU + R.range(-0.22, 0.22);
      const d = R.range(9.5, 16.0);
      return { x: Math.cos(a) * d, y: Math.sin(a) * d, z: R.range(-0.35, 0.45) };
    }),
    ...Array.from({ length: 9 }, (_, i) => {
      const a = ((i + 0.5) / 9) * TAU + R.range(-0.18, 0.18);
      const d = R.range(18.5, 24.5);
      return { x: Math.cos(a) * d, y: Math.sin(a) * d, z: R.range(-0.45, 0.35) };
    }),
  ];

  // 3 deep glowing magma craters on the surface
  const craters = [
    { x: -8.5, y: -6.0, r: 4.4 },
    { x: 9.0, y: -4.5, r: 3.9 },
    { x: -1.5, y: 9.5, r: 4.3 },
  ];

  const inside = new Uint8Array(G * G);
  const qNorm = new Float32Array(G * G);
  const vein = new Float32Array(G * G);
  const crater = new Float32Array(G * G);
  const facet = new Float32Array(G * G);

  for (let j = 0; j < G; j++) {
    const uy = j - HALF + 0.5;
    for (let i = 0; i < G; i++) {
      const ux = i - HALF + 0.5;
      const idx = j * G + i;
      const r = Math.hypot(ux, uy);
      const ang = ((Math.atan2(uy, ux) % TAU) + TAU) % TAU;
      const vf = (ang / TAU) * nVerts;
      const i0 = Math.floor(vf) % nVerts;
      const i1 = (i0 + 1) % nVerts;
      const frac = vf - Math.floor(vf);
      const polyR = lerp(vertR[i0], vertR[i1], frac) + 1.0 * Math.sin(ang * 13 + seed) + 0.65 * Math.cos(ang * 21 - seed * 2);
      const q = r / polyR;
      qNorm[idx] = q;
      if (q > 1) continue;
      inside[idx] = 1;

      let d1 = 1e9, d2 = 1e9, c1 = cells[0];
      for (const c of cells) {
        const d = Math.hypot(ux - c.x, uy - c.y);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          c1 = c;
        } else if (d < d2) {
          d2 = d;
        }
      }
      const warp = 0.65 * Math.sin(ux * 0.52 + uy * 0.39 + seed) + 0.38 * Math.cos(ux * 0.92 - uy * 0.72);
      const edgeDist = (d2 - d1) + warp;
      vein[idx] = clamp(1 - edgeDist / 2.25);

      let cr = 0;
      for (const ct of craters) {
        const cd = Math.hypot(ux - ct.x, uy - ct.y) / ct.r;
        if (cd < 1) cr = Math.max(cr, 1 - cd * cd);
      }
      crater[idx] = cr;
      facet[idx] = c1.z + ((ux - c1.x) * -0.045 + (uy - c1.y) * -0.045);
    }
  }

  const lut = { G, HALF, inside, qNorm, vein, crater, facet };
  boulderCache.set(seed, lut);
  return lut;
}

export function create(o) {
  const C = fit(o.palette, 9);
  const H = hotFirst(C);
  const S = fit(o.stone, 7);
  const R = new Rng(o.seed);
  const seed = o.seed * 19;
  const floor = () => 0;

  const [W, H_CANVAS] = meta.size;
  const [OX, OY] = meta.origin;
  const X0 = -OX + 6, X1 = W - OX - 6, Y0 = -OY + 8, Y1 = H_CANVAS - OY - 4;

  const lut = getBoulderLut(o.seed);
  const st = { light: S[5], body: S[3], shade: S[1], dust: S[4] };
  const FR = [C[8], C[7], C[6], C[5], C[4], C[3], C[2], C[1], C[0]];

  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[7], C[5], C[3]], haze: C[3] });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  // Prebake 32 scalloped molten lava pool lobes along the trail [x = -10 .. END_X + 14]
  const lavaLobes = Array.from({ length: 32 }, (_, i) => {
    const u = i / 31;
    const x = lerp(-8, END_X + 12, u) + R.range(-3.5, 3.5);
    const rx = R.range(10.5, 17.5);
    const ry = R.range(3.5, 5.6);
    const yOff = R.range(-0.5, 2.5);
    return { x, y: yOff, rx, ry };
  });

  // Prebake 10 organic, wide-based tapering magma curtains/drips oozing over the front platform ledge (y = 3..13)
  const lavaDrips = Array.from({ length: 10 }, (_, i) => ({
    x: lerp(4, END_X + 4, (i + 0.35) / 10) + R.range(-6, 6),
    w: R.range(3.2, 5.2),
    len: R.range(4.5, 9.5),
    speed: R.range(0.32, 0.58),
  }));

  // Prebake 14 centrifugally flung molten magma globs that arc off the rolling boulder and splat into extra lava puddles
  const lavaGlobs = Array.from({ length: 14 }, (_, i) => {
    const u = (i + 0.4) / 14;
    const tLaunch = lerp(T_SLAM + 0.06, T_STOP - 0.14, u);
    const x0 = lerp(8, END_X - 18, u);
    const y0 = -26 - R.range(4, 14);
    const flightT = R.range(0.26, 0.40);
    const xLand = clamp(x0 + R.range(-26, 34), -4, END_X + 12);
    const yLand = R.range(-2.0, 5.2);
    const rPuddle = R.range(5.8, 9.0);
    return { tLaunch, flightT, tLand: tLaunch + flightT, x0, y0, xLand, yLand, rPuddle };
  });

  // Prebake 26 popping magma blisters/bubbles along the lava river
  const blisters = Array.from({ length: 26 }, () => ({
    x: R.range(-4, END_X + 6),
    y: R.range(-1.5, 4.0),
    rMax: R.range(2.0, 3.7),
    period: R.range(0.42, 0.72),
    phase: R.range(0, 1),
  }));

  // Prebake 16 persistent ground flame stations along the magma trail
  const trailFlames = Array.from({ length: 16 }, (_, i) => ({
    x: lerp(2, END_X - 2, i / 15) + R.range(-3.5, 3.5),
    y: R.range(-1, 2),
    h: R.range(14, 25),
    w: R.range(3.4, 5.2),
    seed: seed + i * 17,
  }));

  let t = 0;
  let slammed = false;
  let burstDone = false;
  let lastLurchIdx = -1;
  let rollAcc = 0;
  let trailAcc = 0;

  const capLife = (l) => Math.max(0.08, Math.min(l, T_END - 0.12 - t));

  function boulderState(time) {
    if (time < T_SLAM) {
      const u = clamp(time / T_SLAM);
      const arch = Math.sin(u * Math.PI);
      const by = lerp(12, -22, ease.outCubic(u)) - arch * 9;
      const rot = u * 0.55;
      return { x: 0, y: by, rot, vx: 0 };
    }
    if (time < T_STOP) {
      const u = (time - T_SLAM) / (T_STOP - T_SLAM);
      const easeU = u < 0.75 ? (u / 0.75) * 0.78 * (0.4 + 0.6 * (u / 0.75)) : 0.78 + 0.22 * ease.outCubic((u - 0.75) / 0.25);
      const bx = clamp(END_X * easeU, 0, END_X);
      const rot = 0.55 + bx / (R_BOULDER * 0.92);
      const lurch = Math.abs(Math.sin(rot * 3)) * 2.4;
      const by = -22.5 - lurch;
      const vx = END_X / (T_STOP - T_SLAM);
      return { x: bx, y: by, rot, vx };
    }
    const uOver = clamp((time - T_STOP) / (T_BURST - T_STOP));
    const shk = Math.sin(time * 125) * (1.2 + 2.2 * uOver);
    const rot = 0.55 + END_X / (R_BOULDER * 0.92) + uOver * 0.35;
    return { x: END_X + shk, y: -22.5 + Math.cos(time * 110) * 1.2, rot, vx: 0 };
  }

  // Draw the Colossal Magma-Cracked Boulder (100% solid p.px pixels, supports jagged fracture & outward toppling after T_BURST)
  function drawMagmaBoulder(p, bx, by, rot, overload = 0, splitU = 0, cool = 0) {
    const { G, HALF, inside, qNorm, vein, crater, facet } = lut;
    const rx0 = Math.round(bx), ry0 = Math.round(by);
    const pulse = (0.84 + 0.16 * Math.sin(t * 14)) * (1 - cool * 0.78);
    const veinBoost = overload * 0.52 - cool * 0.42;

    const splitGap = splitU > 0 ? 15 * ease.outCubic(clamp(splitU * 1.3)) : 0;
    const tiltL = rot - splitU * 0.52;
    const tiltR = rot + splitU * 0.56;
    const csL = Math.cos(tiltL), snL = Math.sin(tiltL);
    const csR = Math.cos(tiltR), snR = Math.sin(tiltR);

    const cleftCenter = (dy) => 2.6 * Math.sin(dy * 0.26 + 0.5) + 1.4 * Math.cos(dy * 0.62 - 0.3) - dy * 0.12;

    const sampleCell = (dx, dy) => {
      let effDx = dx;
      let effDy = dy;
      let cs = csL, sn = snL;
      if (splitGap > 0) {
        const cx = cleftCenter(dy);
        const distFromCleft = dx - cx;
        if (Math.abs(distFromCleft) < splitGap * 0.46) return -1;
        const side = distFromCleft >= 0 ? 1 : -1;
        effDx = dx - side * splitGap * 0.48;
        effDy = dy - Math.abs(distFromCleft) * splitU * 0.12;
        if (side > 0) {
          cs = csR;
          sn = snR;
        }
      } else {
        const cs0 = Math.cos(rot), sn0 = Math.sin(rot);
        cs = cs0;
        sn = sn0;
      }
      const ux = effDx * cs + effDy * sn;
      const uy = -effDx * sn + effDy * cs;
      const i = Math.floor(ux + HALF);
      const j = Math.floor(uy + HALF);
      if (i < 0 || j < 0 || i >= G || j >= G) return -1;
      const idx = j * G + i;
      return inside[idx] ? idx : -1;
    };

    const R_BOX = Math.ceil(28 + splitGap * 0.65);
    for (let dy = -28; dy <= 28; dy++) {
      const py = ry0 + dy;
      if (py < Y0 || py > 2) continue;
      const cx = splitGap > 0 ? cleftCenter(dy) : 0;
      for (let dx = -R_BOX; dx <= R_BOX; dx++) {
        const px = rx0 + dx;
        if (px < X0 || px > X1) continue;
        const idx = sampleCell(dx, dy);
        if (idx < 0) {
          if (
            sampleCell(dx - 1, dy) >= 0 ||
            sampleCell(dx + 1, dy) >= 0 ||
            sampleCell(dx, dy - 1) >= 0 ||
            sampleCell(dx, dy + 1) >= 0
          ) {
            const inCleft = splitGap > 0 && Math.abs(dx - cx) <= splitGap * 0.48 + 1.6;
            const rimGlow = inCleft || overload > 0.3 || (dy > 14 && ((dx + dy) & 1) === 0 && cool < 0.5);
            p.px(px, py, rimGlow ? (inCleft && cool < 0.45 ? C[6] : C[3]) : S[0]);
          }
          continue;
        }

        const q = qNorm[idx];
        const v = vein[idx] + veinBoost;
        const cr = crater[idx];
        const fac = facet[idx];

        // Exposed molten interior wall along the jagged fracture seam
        const cleftHeat =
          splitGap > 0 ? (1 - cool * 0.72) * clamp(1 - (Math.abs(dx - cx) - splitGap * 0.46) / 4.2) : 0;

        let col;
        if (cleftHeat > 0.24) {
          col = cleftHeat > 0.72 ? WHITE : cleftHeat > 0.48 ? C[6] : C[4];
        } else if (cr > 0.15) {
          const ch = cr * pulse + overload * 0.4;
          col = ch > 0.78 ? WHITE : ch > 0.56 ? C[7] : ch > 0.36 ? C[5] : C[3];
        } else if (v > 0.20) {
          const vh = v * pulse + (1 - q * 0.32) * 0.20 + overload * 0.35;
          col = vh > 0.90 ? WHITE : vh > 0.72 ? C[7] : vh > 0.54 ? C[6] : vh > 0.38 ? C[5] : vh > 0.25 ? C[4] : C[2];
        } else if (dy > 13 && q > 0.68 && cool < 0.6) {
          const underH = (dy - 13) / 14 + (q - 0.68) * 1.4;
          col = underH > 0.85 ? C[6] : underH > 0.5 ? C[4] : C[2];
        } else {
          const worldLit = (-0.55 * dx - 0.72 * dy) / R_BOULDER + fac * 0.68;
          const rimShade = q > 0.84 ? -1 : 0;
          const sIdx = clamp(Math.round(2.7 + worldLit * 2.1) + rimShade, 1, 5);
          col = S[sIdx];
        }
        p.px(px, py, col);
      }
    }

    const glowK = 1 - cool * 0.88;
    if (glowK > 0.05 && ry0 < 12) {
      p.glow(bx, Math.min(-4, by), (38 + overload * 18) * glowK, C[4], (0.52 + overload * 0.35) * glowK);
      p.glow(bx, Math.min(-4, by), (18 + overload * 10) * glowK, C[7], (0.42 + overload * 0.4) * glowK);
    }
  }

  // Draw the Persistent Molten Lava River, Overhanging Platform Curtains, Bubbles & Ground Flames (100% solid p.px)
  function drawMoltenLavaTrail(p, leadX) {
    const fadeEnd = 1 - smooth(T_END - 0.75, T_END - 0.08, t);
    if (fadeEnd <= 0.02) return;

    const minX = -12;
    const maxX = Math.min(X1 - 6, Math.ceil(leadX + 12));
    if (maxX <= minX) return;

    // 1. Continuous crushed magma channel + scalloped lava lobes + splatted lava glob puddles across y = -3 .. +8
    for (let y = -3; y <= 8; y++) {
      for (let x = minX; x <= maxX; x++) {
        const inMainTrack = x >= -8 && x <= leadX + 4;
        const trackHalfY = 4.5 + 1.4 * Math.sin(x * 0.14 + 1.2) + 0.9 * Math.cos(x * 0.27);
        const trackCenterY = 1.7 + 0.7 * Math.sin(x * 0.09);
        let dMin = inMainTrack ? Math.abs(y - trackCenterY) / trackHalfY : 9;

        for (let i = 0; i < lavaLobes.length; i++) {
          const lb = lavaLobes[i];
          if (lb.x > leadX + 6 || Math.abs(x - lb.x) > lb.rx) continue;
          const dx = (x - lb.x) / lb.rx;
          const dy = (y - lb.y) / lb.ry;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < dMin) dMin = d;
        }

        for (let i = 0; i < lavaGlobs.length; i++) {
          const g = lavaGlobs[i];
          if (t < g.tLand || Math.abs(x - g.xLand) > g.rPuddle) continue;
          const spread = ease.outCubic(clamp((t - g.tLand) / 0.16));
          const rx = g.rPuddle * spread;
          const ry = Math.max(1.6, rx * 0.36);
          const dx = (x - g.xLand) / Math.max(1, rx);
          const dy = (y - g.yLand) / ry;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < dMin) dMin = d;
        }

        // Progressive left-to-right cooling & organic edge recession (no Bayer dithering!)
        const xProg = clamp((x + 10) / (END_X + 20));
        const coolStart = T_BURST + 0.15 + xProg * 0.92;
        const cool = smooth(coolStart, coolStart + 1.38, t);
        const maxD = 1.12 * (1 - 0.52 * cool) * fadeEnd;
        if (dMin > maxD) continue;

        if (dMin >= maxD * 0.80) {
          const rimCol = cool > 0.65 ? S[0] : y < trackCenterY ? S[2] : S[0];
          p.px(x, y, rimCol);
          continue;
        }

        const wave =
          0.5 +
          0.3 * Math.sin(x * 0.26 - t * 6.5 + y * 0.7) +
          0.2 * Math.cos(x * 0.45 + t * 4.2 - y * 1.1);
        const coreHeat = (1 - (dMin / maxD) * 0.76) * (0.64 + 0.36 * wave) * (1 - cool * 0.92);

        let col;
        if (coreHeat > 0.78) col = WHITE;
        else if (coreHeat > 0.64) col = C[7];
        else if (coreHeat > 0.50) col = C[6];
        else if (coreHeat > 0.38) col = C[5];
        else if (coreHeat > 0.26) col = C[4];
        else if (coreHeat > 0.17) col = C[3];
        else if (coreHeat > 0.10) col = C[2];
        else if (coreHeat > 0.05) col = C[1];
        else col = S[1];

        p.px(x, y, col);
      }
    }

    // 2. Organic Tapering Molten Magma Curtains oozing over the front side-scrolling platform ledge (y = 3 .. 12)
    for (const dr of lavaDrips) {
      if (dr.x > leadX - 2) continue;
      const reachAge = Math.max(0, (leadX - dr.x) / 140 + Math.max(0, t - T_STOP) * dr.speed);
      const uGrow = ease.outQuad(clamp(reachAge * 1.4));
      const xProg = clamp((dr.x + 10) / (END_X + 20));
      const cool = smooth(T_BURST + 0.2 + xProg * 0.9, T_BURST + 1.4 + xProg * 0.9, t);
      const curLen = Math.round(dr.len * uGrow * (1 - 0.55 * cool) * fadeEnd);
      if (curLen < 2) continue;

      for (let dy = 0; dy <= curLen; dy++) {
        const y = 3 + dy;
        const v = dy / Math.max(1, curLen);
        const hw = dr.w * (1 - 0.62 * v + 0.22 * Math.exp(-Math.pow((v - 0.85) * 4.5, 2))) * fadeEnd;
        const rx = Math.round(dr.x);
        for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
          const q = Math.abs(dx) / Math.max(0.8, hw);
          if (q > 1.05) continue;
          if (q > 0.78) {
            p.px(rx + dx, y, S[0]);
          } else {
            const h = (1 - q * 0.65) * (1 - v * 0.35) * (1 - cool * 0.92);
            const col = h > 0.66 ? C[7] : h > 0.45 ? C[5] : h > 0.26 ? C[4] : h > 0.12 ? C[2] : S[1];
            p.px(rx + dx, y, col);
          }
        }
      }
    }

    // 3. Popping Magma Blisters / Bubbles along the trail
    for (let i = 0; i < blisters.length; i++) {
      const bl = blisters[i];
      if (bl.x > leadX - 4) continue;
      const xProg = clamp((bl.x + 10) / (END_X + 20));
      const cool = smooth(T_BURST + 0.2 + xProg * 0.95, T_BURST + 1.4 + xProg * 0.95, t);
      if (cool > 0.72) continue;

      const cyc = (t / bl.period + bl.phase) % 1;
      if (cyc < 0.72) {
        const u = cyc / 0.72;
        const r = bl.rMax * ease.outQuad(u) * (1 - cool * 0.5);
        if (r >= 1.1) {
          p.circle(bl.x, bl.y, r, C[3]);
          p.circle(bl.x - 0.3, bl.y - 0.4, r * 0.68, u > 0.8 ? WHITE : C[6]);
          p.px(bl.x - 0.5, bl.y - 0.8, WHITE);
        }
      } else if (cyc < 0.88) {
        const u = (cyc - 0.72) / 0.16;
        const r = bl.rMax * (1 + u * 0.65);
        p.ring(bl.x, bl.y, r, 1, u < 0.4 ? WHITE : C[6]);
      }
    }

    // 4. Flickering Flame Tongues rising off the hot magma trail
    const NZ = (rate, s2 = 0, off = 0) => noise(t * rate + off, s2);
    for (const tf of trailFlames) {
      if (tf.x > leadX - 6) continue;
      const xProg = clamp((tf.x + 10) / (END_X + 20));
      const appearK = ease.outCubic(clamp((leadX - tf.x) / 28));
      const coolK = 1 - smooth(T_BURST + 0.05 + xProg * 0.9, T_BURST + 1.15 + xProg * 0.9, t);
      const k = appearK * coolK * fadeEnd;
      if (k <= 0.08) continue;
      const fh = tf.h * k * (0.78 + 0.22 * Math.sin(t * 15 + tf.seed));
      const fw = tf.w * (0.5 + 0.5 * k);
      flameTongue(p, tf.x, tf.y, fh, fw, Math.sin(t * 7 + tf.seed) * 2.2, NZ, tf.seed, H, LAYERS, 0.45, 0.9);
    }

    // 5. Warm additive floor light bathing the entire length of the active lava river
    for (let lx = 0; lx <= leadX; lx += 36) {
      const xProg = clamp(lx / END_X);
      const kL = (1 - smooth(T_BURST + 0.2 + xProg * 0.9, T_BURST + 1.5 + xProg * 0.9, t)) * fadeEnd;
      if (kL > 0.04) {
        floorLight(p, lx, 2, 34, 8, C[5], 0.36 * kL);
      }
    }
  }

  function drawFlyingLavaGlobs(p) {
    for (const g of lavaGlobs) {
      if (t < g.tLaunch || t >= g.tLand) continue;
      const u = (t - g.tLaunch) / g.flightT;
      const gx = lerp(g.x0, g.xLand, u);
      const gy = lerp(g.y0, g.yLand, u) - Math.sin(u * Math.PI) * 26;
      const prevU = Math.max(0, u - 0.18);
      const px = lerp(g.x0, g.xLand, prevU);
      const py = lerp(g.y0, g.yLand, prevU) - Math.sin(prevU * Math.PI) * 26;
      p.line(px, py, gx, gy, C[4], 1);
      p.circle(gx, gy, 2.5, C[3]);
      p.circle(gx - 0.3, gy - 0.3, 1.6, C[6]);
      p.px(gx, gy, WHITE);
      p.glow(gx, gy, 9, C[5], 0.5);
    }
  }

  return {
    update(dt) {
      t += dt;
      const stB = boulderState(t);

      // PHASE 1: Initial volcanic rift eruption at x = 0 (t < T_SLAM)
      if (!slammed && t >= T_SLAM) {
        slammed = true;
        lights.add(0, -14, 72, C[5], 0.9, 0.45);
        lights.add(0, -8, 36, WHITE, 0.85, 0.12);
        for (let i = 0; i < 34; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.25);
          const sp = R.range(70, 200);
          ps.spawn(P.SPARK, R.range(-6, 8), -2, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.2, 0.48)));
        }
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI / 2 + R.range(-0.95, 1.1);
          const sp = R.range(55, 160);
          ps.spawn(P.FIRE, R.range(-6, 8), -4, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.35, 0.68)), 0, R.range(4, 7), 0, PF.SMOKES);
        }
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + R.range(-0.85, 1.0);
          const sp = R.range(85, 195);
          bits.add({
            kind: B.CHUNK,
            x: R.range(-6, 8),
            y: -3,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            g: 1,
            drag: 0.4,
            bounce: 0.3,
            life: capLife(R.range(1.2, 2.0)),
            a: R.range(0, TAU),
            va: R.range(-14, 14),
            s: R.range(1.2, 2.2),
            heat: 0.85,
          });
        }
      }

      // PHASE 2: Crushing Roll across the stage (T_SLAM .. T_STOP)
      if (t >= T_SLAM && t < T_STOP) {
        const lurchIdx = Math.floor((stB.rot * 3) / Math.PI);
        if (lurchIdx > lastLurchIdx) {
          lastLurchIdx = lurchIdx;
          lights.add(stB.x + 8, -4, 42, C[5], 0.65, 0.18);
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + R.range(-0.85, 0.9);
            const sp = R.range(65, 170);
            ps.spawn(P.SPARK, stB.x + R.range(-4, 12), -2, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.18, 0.42)));
          }
          for (let i = 0; i < 4; i++) {
            bits.add({
              kind: B.CHUNK,
              x: stB.x + R.range(-4, 10),
              y: -2,
              vx: R.range(-50, 95),
              vy: -R.range(85, 180),
              g: 1,
              drag: 0.45,
              bounce: 0.28,
              life: capLife(R.range(0.9, 1.6)),
              a: R.range(0, TAU),
              va: R.range(-15, 15),
              s: R.range(1.0, 1.9),
              heat: 0.9,
            });
          }
        }

        for (rollAcc += dt * 92; rollAcc >= 1; rollAcc--) {
          const a = R.range(0, TAU);
          const rx = clamp(stB.x + Math.cos(a) * (R_BOULDER * 0.88), X0 + 12, X1 - 12);
          const ry = stB.y + Math.sin(a) * (R_BOULDER * 0.88);
          const tx = -Math.sin(a) * 85 - R.range(15, 65);
          const ty = Math.cos(a) * 85 - R.range(15, 55);
          if (R.chance(0.45)) {
            ps.spawn(
              P.FIRE,
              rx,
              clamp(ry, Y0 + 14, -3),
              tx * 0.42,
              ty * 0.42,
              capLife(R.range(0.26, 0.54)),
              0,
              R.range(3.5, 6.2),
              0,
              R.chance(0.4) ? PF.SMOKES : 0,
            );
          } else {
            ps.spawn(P.SPARK, rx, clamp(ry, Y0 + 12, -2), tx, ty, capLife(R.range(0.16, 0.38)));
          }
        }
      }

      // Continuous sizzling embers & smoke rising from the hot lava trail behind the boulder
      const activeLeadX = t < T_SLAM ? 6 : t < T_STOP ? stB.x : END_X + 8;
      if (t >= 0.25 && t < T_END - 0.9) {
        for (trailAcc += dt * 32; trailAcc >= 1; trailAcc--) {
          const lx = R.range(-6, activeLeadX);
          const xProg = clamp((lx + 10) / (END_X + 20));
          if (t > T_BURST + 1.0 + xProg * 0.9) continue;
          if (R.chance(0.55)) {
            ps.spawn(
              P.EMBER,
              lx,
              -R.range(1, 5),
              R.range(-16, 16),
              -R.range(22, 60),
              capLife(R.range(0.75, 1.45)),
              C[5],
              R.chance(0.3) ? 2 : 1,
            );
          } else {
            ps.spawn(
              P.SMOKE,
              lx,
              -R.range(2, 6),
              R.range(-10, 10),
              -R.range(18, 40),
              capLife(R.range(0.9, 1.6)),
              S[2],
              R.range(3.2, 5.6),
            );
          }
        }
      }

      // PHASE 4: Cataclysmic Volcanic Shatter at x = END_X (t >= T_BURST)
      if (!burstDone && t >= T_BURST) {
        burstDone = true;
        lights.add(END_X, -24, 92, C[5], 1.05, 0.75);
        lights.add(END_X, -22, 48, WHITE, 0.95, 0.14);

        for (let i = 0; i < 42; i++) {
          const a = R.range(-Math.PI - 0.15, 0.15);
          const d = R.range(0, 18);
          const sp = R.range(45, 185);
          ps.spawn(
            P.FIRE,
            END_X + Math.cos(a) * d,
            -22 + Math.sin(a) * d,
            Math.cos(a) * sp,
            Math.sin(a) * sp * 0.8 - 35,
            capLife(R.range(0.45, 0.95)),
            0,
            R.range(5.0, 9.0),
            0,
            R.chance(0.5) ? PF.SMOKES | PF.BIG : 0,
          );
        }
        for (let i = 0; i < 80; i++) {
          const a = R.range(0, TAU);
          const sp = R.range(90, 270);
          ps.spawn(
            P.SPARK,
            END_X + R.range(-8, 8),
            -20,
            Math.cos(a) * sp,
            Math.sin(a) * sp - 45,
            capLife(R.range(0.22, 0.62)),
          );
        }
        for (let i = 0; i < 24; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 0.95);
          const sp = R.range(90, 240);
          bits.add({
            kind: B.CHUNK,
            x: END_X + R.range(-10, 10),
            y: -14,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            g: 1,
            drag: 0.38,
            bounce: 0.32,
            life: capLife(R.range(1.4, 2.2)),
            a: R.range(0, TAU),
            va: R.range(-16, 16),
            s: R.range(1.4, 2.8),
            heat: R.range(0.65, 1.0),
          });
        }
      }

      bits.update(dt);
      for (let i = bits.list.length - 1; i >= 0; i--) {
        const b = bits.list[i];
        if (b.x < X0 + 6 || b.x > X1 - 6 || b.y < Y0 + 6 || t > T_END - 0.12) {
          bits.list.splice(i, 1);
          continue;
        }
        if (b.heat > 0) b.heat = Math.max(0, b.heat - dt * 0.4);
      }

      ps.update(dt);
      cullParticles(ps, X0, Y0, X1, Y1);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;
      const stB = boulderState(t);
      const leadX = t < T_SLAM ? 6 : t < T_STOP ? stB.x : END_X + 8;

      if (t >= T_SLAM && t < T_SLAM + 0.42) {
        const k = (t - T_SLAM) / 0.42;
        band(p, 0, 0.5, 36 * ease.outCubic(k), SY, Math.max(1, 4 * (1 - k)), 1 - k, [S[2], C[4], C[6], WHITE], (g) => Math.sin(g) < 0);
      }
      if (t >= T_BURST && t < T_BURST + 0.52) {
        const k = (t - T_BURST) / 0.52;
        band(p, END_X, 0.5, 72 * ease.outCubic(k), SY, Math.max(1, 5 * (1 - k)), 1.1 - k, [S[2], C[4], C[6], WHITE], (g) => Math.sin(g) < 0);
      }

      drawMoltenLavaTrail(p, leadX);
      simDraw(p, ps, H, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;
      const stB = boulderState(t);
      const NZ = (rate, s2 = 0, off = 0) => noise(t * rate + off, s2);

      // 1. Roaring Trailing Fire Wake & Tangential Rim Flames (drawn BEHIND the boulder so its rotating magma cracks stay razor-sharp!)
      if (t < T_BURST) {
        if (t >= T_SLAM && t < T_STOP) {
          const maxLeftLen = Math.max(0, stB.x - 10 - (X0 + 8));
          if (maxLeftLen > 4) {
            for (const [dy, len, w] of [[-12, 44, 8.5], [0, 52, 10.5], [10, 38, 7.5], [-20, 32, 6.5]]) {
              const clampedLen = Math.min(len, maxLeftLen);
              flameBlade(
                p,
                stB.x - 10,
                stB.y + dy,
                -1,
                -0.08,
                clampedLen,
                w * Math.min(1, clampedLen / 18),
                Math.sin(t * 20 + dy) * 2.5,
                NZ,
                seed + dy,
                H,
                LAYERS,
                0.5,
                1.1,
              );
            }
          }
        }

        const overload = t >= T_STOP ? ease.inQuad(clamp((t - T_STOP) / (T_BURST - T_STOP))) : 0;
        for (let i = 0; i < 5; i++) {
          const a = stB.rot + (i * TAU) / 5;
          const ox = Math.cos(a) * (R_BOULDER - 1.5);
          const oy = Math.sin(a) * (R_BOULDER - 1.5);
          const rootX = stB.x + ox;
          const rootY = stB.y + oy;
          if (rootY > 0 || rootX < X0 + 18) continue;
          const tx = -Math.sin(a);
          const ty = Math.cos(a);
          flameBlade(
            p,
            rootX,
            rootY,
            tx,
            ty,
            13 + overload * 9,
            4.0,
            2.2,
            NZ,
            seed + i * 23,
            H,
            LAYERS,
            0.4,
            0.9,
          );
        }

        // 2. The Colossal Magma-Cracked Rolling Boulder in front of the fire wake
        drawMagmaBoulder(p, stB.x, stB.y, stB.rot, overload, 0, 0);

        if (t >= T_STOP) {
          const uO = (t - T_STOP) / (T_BURST - T_STOP);
          flare(p, stB.x, stB.y, 28 + 34 * uO, 0.55 + 0.45 * uO, [C[4], C[6], C[7], WHITE]);
        }
      } else if (t < T_SINK) {
        // 3. Post-Burst Shattered Boulder Halves: fracture along a jagged seam, topple outward, and sink cleanly into the boiling lava crater!
        const uSink = clamp((t - T_BURST) / (T_SINK - T_BURST));
        const sinkY = -20 + 52 * ease.inQuad(uSink);
        const cool = clamp(uSink * 1.1);
        drawMagmaBoulder(p, END_X, sinkY, stB.rot, 0, uSink, cool);
      }

      // 4. Flying Molten Lava Globs arcing to the floor
      drawFlyingLavaGlobs(p);

      // 5. Cataclysmic Eruption Hero Flash & Flare at T_BURST
      const aBurst = t - T_BURST;
      if (aBurst >= 0 && aBurst < 0.10) {
        const r = 28 * (1 - aBurst * 3.5);
        p.circle(END_X, -22, r + 2, C[4]);
        p.circle(END_X, -22, r, aBurst < 0.05 ? C[7] : C[6]);
        p.circle(END_X, -22, r * 0.62, WHITE);
      }
      if (aBurst >= 0 && aBurst < 0.26) {
        const u = aBurst / 0.26;
        flare(p, END_X, -22, 64 * Math.pow(1 - u, 1.3), 1 - u, [C[4], C[6], C[7], WHITE]);
        sparkle(p, END_X, -22, 22 * (1 - u), WHITE, C[6], 1 - u);
      }

      // 6. Near half of slam & burst shockwave rings
      if (t >= T_SLAM && t < T_SLAM + 0.42) {
        const k = (t - T_SLAM) / 0.42;
        band(p, 0, 0.5, 36 * ease.outCubic(k), SY, Math.max(1, 4 * (1 - k)), 1 - k, [S[2], C[4], C[6], WHITE], (g) => Math.sin(g) >= 0);
      }
      if (t >= T_BURST && t < T_BURST + 0.52) {
        const k = (t - T_BURST) / 0.52;
        band(p, END_X, 0.5, 72 * ease.outCubic(k), SY, Math.max(1, 5 * (1 - k)), 1.1 - k, [S[2], C[4], C[6], WHITE], (g) => Math.sin(g) >= 0);
      }

      // 7. Molten rock chunks & front particles
      for (const b of bits.list) rock(p, b, st, FR);
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
