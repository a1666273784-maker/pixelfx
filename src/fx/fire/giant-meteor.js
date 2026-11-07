import { Particles, Bits, Lights, Blazes, P, PF, B, Rng, fit, band, flare, sparkle, clamp, smooth, seg, lerp, ease, tileFbm, loopNoise, rand, mix, TAU, WHITE } from "../../core/index.js";
import { hotFirst, flameTongue, flameBlade, simDraw, floorLight, LAYERS } from "./_lib.js";
import { Plume, Column, dome } from "../explosions/_lib.js";
import { stoneShape, drawRock } from "../nature/_lib.js";

export const meta = {
  name: "Giant meteor",
  desc: "A colossal magma-cracked asteroid screams down with trailing fragments, crushes into the floor, and erupts into a mushrooming fireball and breathing crater.",
  tags: ["fire", "meteor", "giant", "asteroid", "explosion", "impact", "crater", "one-shot"],
  size: [320, 260],
  origin: [174, 224],
  duration: 5.1,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#1a0f0a", "#4a1a10", "#7d2a12", "#b84416", "#e0701c", "#f5a429", "#ffd166", "#fff4c9"],
    stone: ["#110d14", "#1d1622", "#2e2334", "#433349", "#5c4761", "#7a607d", "#9f82a0", "#c9b0c8"],
    shadow: ["#0d0a12"],
    seed: 9,
  },
};

const T_TOUCH = 0.62;
const T_HIT = 0.7;
const T_CORE_SHATTER = 1.25;
const T_AFTER = 2.65;
const T_END = 5.1;
const FROM = [-82, -124];
const R_METEOR = 35;
const R_WAVE = 136;
const SY = 0.17;

// Surface craters on the giant asteroid (in local rotated asteroid coords, normalized by R0)
const ASTEROID_CRATERS = [
  [-0.32, -0.22, 0.25],
  [0.24, -0.34, 0.2],
  [-0.14, 0.32, 0.22],
  [0.32, 0.14, 0.18],
];

export function create(o) {
  const C = fit(o.palette, 8), H = hotFirst(C);
  const S = fit(o.stone, 8);
  const SH = fit(o.shadow, 1)[0];
  const SOOT = mix(SH, S[1], 0.45);
  const R = new Rng(o.seed), seed = o.seed * 17, floor = () => 0;

  // Fire ramp (bright to dark) and Smoke ramp (light to dark) for Plume & Column
  const FR = [C[7], C[6], C[5], C[4], C[3], C[2], C[1], mix(C[1], C[0], 0.5), C[0]];
  const SM = [S[6], S[5], S[4], S[3], S[2], S[1], S[0]];

  let blazes;
  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [C[7], C[6], C[5], C[3]],
    haze: C[4],
    onLand: (x, y) => {
      if (Math.abs(x) < 124) blazes.add(x, y - 0.25, R.range(0.8, 1.45), R.range(0.5, 0.85));
    },
  });
  blazes = new Blazes(ps);
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  const plume = new Plume(R, {
    x: 0,
    y: -28,
    rise: 106,
    tau: 1.0,
    drift: 5,
    tube: [20, 32],
    ring: [12, 31],
    grow: 0.65,
    n: 32,
    size: [8.5, 14.5],
    swell: 0.45,
    spin: 2.6,
    spinTau: 1.4,
    heat: 1.25,
    cool: 0.52,
    under: 0.58,
    tilt: 0.18,
    squash: 0.72,
    fade: [2.45, 3.9],
    glow: 0.85,
    spread: 15,
  });
  const col = new Column(R, { w: 14, foot: 28, speed: 84, size: [7.2, 11.4], n: 14, sway: 2.5 });

  const flightLen = Math.hypot(FROM[0], FROM[1]);
  const ux = -FROM[0] / flightLen, uy = -FROM[1] / flightLen;

  // At t = T_TOUCH..T_HIT, the giant meteor's bottom hemisphere plows into the floor (center reaches [0, -14])
  const IMPACT_Y = -14;
  const pos = (tt) => {
    const u = clamp(tt / T_HIT);
    const k = 0.55 * u + 0.45 * u * u;
    return [FROM[0] * (1 - k), lerp(FROM[1], IMPACT_Y, k)];
  };

  // Detached satellite fragments accompanying the colossal asteroid for dramatic scale contrast
  const satellites = Array.from({ length: 4 }, (_, i) => ({
    offAlong: -26 - i * 14 + R.range(-3, 3),
    offPerp: (i % 2 === 0 ? -1 : 1) * (34 + (i >> 1) * 8 + R.range(-2, 2)),
    s: R.range(3.2, 4.8),
    a0: R.range(0, TAU),
    va: R.sign() * R.range(5, 9),
    pts: stoneShape(R),
  }));

  // Floor cracks radiating from the impact crater (strictly constrained to perspective floor plane SY)
  const cracks = [];
  const addCrack = (x, y, a, len, t0, main) => {
    const pts = [[x, y]];
    for (let d = 0; d < len; d += 2.6) {
      a += R.range(-0.36, 0.36);
      x += Math.cos(a) * 2.6;
      y = clamp(y + Math.sin(a) * 2.6 * SY, -3.2, 6.2);
      pts.push([x, y]);
    }
    cracks.push({ pts, t0, grow: R.range(0.08, 0.16), main, ph: R.range(0, TAU) });
    return pts;
  };
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + R.range(-0.16, 0.16);
    const pts = addCrack(Math.cos(a) * 10, Math.sin(a) * 10 * SY, a, R.range(44, 86), T_TOUCH + R.range(0, 0.05), true);
    if (pts.length > 7) {
      const bi = 3 + R.int(0, pts.length - 5);
      addCrack(pts[bi][0], pts[bi][1], a + R.sign() * R.range(0.45, 0.85), R.range(14, 28), T_TOUCH + R.range(0.04, 0.09), false);
    }
  }

  // Breathing ember coals in the crater during afterglow
  const coalSpots = Array.from({ length: 44 }, (_, i) => {
    const a = (i / 44) * TAU + R.range(-0.15, 0.15);
    const d = R.range(6, 64);
    return {
      x: Math.cos(a) * d,
      y: Math.sin(a) * d * SY,
      d: d / 66,
      ph: R.range(0, TAU),
      tEnd: R.range(4.3, 4.95),
    };
  });

  // Prebake local asteroid surface texture (radius, craters, magma fault veins, basalt facets) on a local grid [-46..46]
  const G_HALF = 46, G_SPAN = G_HALF * 2 + 1;
  const texQ = new Float32Array(G_SPAN * G_SPAN);
  const texVein = new Float32Array(G_SPAN * G_SPAN);
  const texV1 = new Float32Array(G_SPAN * G_SPAN);
  const texFacet = new Float32Array(G_SPAN * G_SPAN);
  const texCrater = new Float32Array(G_SPAN * G_SPAN);
  const texWall = new Int8Array(G_SPAN * G_SPAN);
  for (let gy = -G_HALF; gy <= G_HALF; gy++) {
    for (let gx = -G_HALF; gx <= G_HALF; gx++) {
      const idx = (gy + G_HALF) * G_SPAN + (gx + G_HALF);
      const d = Math.hypot(gx, gy), ang = Math.atan2(gy, gx);
      const rNorm =
        R_METEOR *
        (1 +
          0.13 * Math.sin(ang * 3 + 1.1) +
          0.09 * Math.cos(ang * 5 - 0.6) +
          0.06 * Math.sin(ang * 7 + 2.2) +
          0.04 * Math.cos(ang * 11 + 0.4));
      texQ[idx] = d / Math.max(1, rNorm);
      const nx = gx / R_METEOR, ny = gy / R_METEOR;
      let inC = 0, cW = 0;
      for (const [cx0, cy0, cr] of ASTEROID_CRATERS) {
        const cd = Math.hypot(nx - cx0, ny - cy0) / cr;
        if (cd < 0.52) inC = Math.max(inC, 1 - cd / 0.52);
        else if (cd < 1.05) cW = (nx - cx0) * 0.6 + (ny - cy0) * 0.8 > 0 ? 1 : -1;
      }
      texCrater[idx] = inC;
      texWall[idx] = cW;
      const v1 = Math.abs(tileFbm((gx + 40) * 0.08, (gy + 40) * 0.08, 16, 16, seed + 31, 2));
      const v2 = Math.abs(tileFbm((gx - 25) * 0.13, (gy + 15) * 0.13, 16, 16, seed + 57, 2));
      texV1[idx] = v1;
      texVein[idx] = v1 < 0.052 ? v1 / 0.052 : v2 < 0.038 && v1 < 0.18 ? v2 / 0.038 : 1;
      texFacet[idx] = tileFbm((gx + 80) * 0.075, (gy + 80) * 0.075, 16, 16, seed + 83, 2);
    }
  }

  // Prebake crater ellipse pixels so per-frame crater rendering does zero sqrt/rand calls
  const CRATER_RX = 68, CRATER_RY = CRATER_RX * SY;
  const craterPixels = [];
  for (let py = Math.floor(-CRATER_RY); py <= Math.ceil(CRATER_RY + 1); py++) {
    const dy = (py - 0.5) / CRATER_RY;
    if (Math.abs(dy) >= 1) continue;
    const dy2 = dy * dy;
    const spanX = CRATER_RX * Math.sqrt(1 - dy2);
    for (let px = Math.floor(-spanX); px <= Math.ceil(spanX); px++) {
      const dx = px / CRATER_RX;
      const d2 = dx * dx + dy2;
      if (d2 >= 1) continue;
      const d = Math.sqrt(d2);
      craterPixels.push({
        px,
        py,
        d,
        sootA: (1 - d2 * 0.65) * 0.82,
        sootCol: d < 0.65 ? SH : SOOT,
        baseM: 1.18 - d * 0.95,
        n: rand(px * 31 + py, seed + 5) * 0.28,
      });
    }
  }

  const addBoulder = (b) => bits.add({ ...b, pts: stoneShape(R) });
  let t = 0, touched = false, hit = false, coreShattered = false, last = pos(0);

  // Draw the colossal craggy magma-veined asteroid (R0 = 35 -> ~74px across!)
  function drawGiantMeteor(p, cx, cy, R0, rot, cool = 0, splitGap = 0, alpha = 1, clipBottom = Infinity) {
    const scale = R_METEOR / Math.max(1, R0);
    const bound = Math.ceil(R0 * 1.25 + splitGap * 0.65) + 3;
    const X0 = Math.floor(cx - bound), X1 = Math.ceil(cx + bound);
    const Y0 = Math.floor(cy - bound), Y1 = Math.min(Math.ceil(clipBottom), Math.ceil(cy + bound));

    const W = X1 - X0 + 3, H_G = Y1 - Y0 + 3;
    const mask = new Uint8Array(W * H_G);
    const idxBuf = new Int32Array(W * H_G);

    const rotDelta = splitGap > 0 ? 0.28 * clamp(splitGap / 12) : 0;
    const caPos = Math.cos(rot + rotDelta), saPos = Math.sin(rot + rotDelta);
    const caNeg = Math.cos(rot - rotDelta), saNeg = Math.sin(rot - rotDelta);
    const halfGap = splitGap * 0.5;

    for (let j = 0; j < H_G; j++) {
      const py = Y0 - 1 + j + 0.5;
      if (py > clipBottom) continue;
      const dy = py - cy;
      const minGap = splitGap > 0 ? splitGap * 0.44 + 1.4 * Math.sin(dy * 0.28) : 0;
      for (let i = 0; i < W; i++) {
        const px = X0 - 1 + i + 0.5;
        let dx = px - cx;
        if (splitGap > 0 && Math.abs(dx) < minGap) continue;
        let ca = caPos, sa = saPos;
        if (splitGap > 0) {
          if (dx >= 0) dx -= halfGap;
          else {
            dx += halfGap;
            ca = caNeg;
            sa = saNeg;
          }
        }
        const gx = clamp(Math.round((dx * ca - dy * sa) * scale), -G_HALF, G_HALF);
        const gy = clamp(Math.round((dx * sa + dy * ca) * scale), -G_HALF, G_HALF);
        const tIdx = (gy + G_HALF) * G_SPAN + (gx + G_HALF);
        if (texQ[tIdx] <= 1) {
          const cell = j * W + i;
          mask[cell] = 1;
          idxBuf[cell] = tIdx;
        }
      }
    }

    const inside = (i, j) => i >= 0 && j >= 0 && i < W && j < H_G && mask[j * W + i] === 1;
    const veinScale = 1 - cool * 0.65;

    for (let j = 1; j < H_G - 1; j++) {
      const py = Y0 - 1 + j;
      if (py + 0.5 > clipBottom) continue;
      for (let i = 1; i < W - 1; i++) {
        const px = X0 - 1 + i;
        const cell = j * W + i;
        if (mask[cell] !== 1) {
          if (inside(i - 1, j) || inside(i + 1, j) || inside(i, j - 1) || inside(i, j + 1)) {
            p.dot(px, py, S[0], alpha);
          }
          continue;
        }
        const tIdx = idxBuf[cell];
        const q = texQ[tIdx];
        let dx = px + 0.5 - cx, dy = py + 0.5 - cy;
        if (splitGap > 0) dx -= (dx >= 0 ? 1 : -1) * splitGap * 0.5;

        // Leading-edge atmospheric compression heating (tight on the bottom-right leading cap)
        const leadDot = (dx * ux + dy * uy) / Math.max(1, R0);
        const noseRim = (1 - cool) * clamp((leadDot - 0.52) * 1.45 + (q - 0.68) * 0.65);

        // Glowing molten interior wall exposed along the central split cleft after impact
        const cleftHeat = splitGap > 0 ? veinScale * clamp(1 - (Math.abs(px + 0.5 - cx) - splitGap * 0.44) / 5.5) : 0;

        const inCrater = texCrater[tIdx];
        const craterWall = texWall[tIdx];
        const vein = texVein[tIdx];

        let col;
        if (cleftHeat > 0.25) {
          col = cleftHeat > 0.72 ? C[7] : cleftHeat > 0.48 ? C[6] : C[5];
        } else if (noseRim > 0.72 && q > 0.72) {
          col = noseRim > 0.88 ? C[7] : C[6];
        } else if (inCrater > 0) {
          const ch = inCrater * (1 - cool * 0.7);
          col = ch > 0.58 ? C[7] : ch > 0.3 ? C[5] : C[3];
        } else if (vein < veinScale) {
          const vk = 1 - vein / Math.max(0.1, veinScale);
          col = vk > 0.68 ? C[7] : vk > 0.4 ? C[6] : vk > 0.18 ? C[5] : C[3];
        } else if (noseRim > 0.46 && q > 0.78) {
          col = C[5];
        } else if (craterWall !== 0) {
          col = craterWall > 0 ? S[4] : S[1];
        } else {
          // Heavy, high-contrast dark volcanic basalt plates (S[1]..S[5])
          const sunLit = (-0.58 * dx - 0.72 * dy) / Math.max(1, R0) + texFacet[tIdx] * 0.55;
          const rimDark = q > 0.86 ? -1 : 0;
          const si = clamp(Math.round(2.6 + sunLit * 2.2) + rimDark, 1, 5);
          col = texV1[tIdx] < 0.085 ? C[2] : S[si];
        }
        p.dot(px, py, col, alpha);
      }
    }
  }

  // Crescent bow-shock wave compressing the air ahead of the falling giant meteor
  function drawBowShock(p, cx, cy, R0) {
    const baseA = Math.atan2(uy, ux);
    for (let k = -28; k <= 28; k++) {
      const u = k / 28;
      const a = baseA + u * 1.32;
      const r = (R0 + 5.0 + 4.2 * u * u) * (0.96 + 0.04 * Math.sin(t * 45 + k));
      const sx = cx + Math.cos(a) * r, sy = cy + Math.sin(a) * r;
      if (sy > 2) continue;
      const fade = (1 - u * u) * 0.94;
      p.blend(sx, sy, Math.abs(u) < 0.38 ? WHITE : C[6], fade);
      p.blend(sx + ux * 1.4, sy + uy * 1.4, C[5], fade * 0.7);
    }
  }

  function drawCraterAndCracks(p) {
    // Omen target glow on the floor before touch-down (0.0 - 0.62s)
    if (t < T_TOUCH) {
      const ok = 0.25 + 0.75 * smooth(0, T_TOUCH, t);
      floorLight(p, 0, 0.5, 34 + 58 * ok, 9, C[5], 0.48 * ok * ok);
      band(p, 0, 0.5, lerp(70, 28, ok), SY, 2.0, 0.72 * ok, [C[2], C[4], C[5], C[6]], () => true, false);
      return;
    }

    const afterFade = 1 - smooth(4.45, 5.04, t);
    if (afterFade <= 0) return;

    const breathWave = 0.5 + 0.5 * Math.cos((t - T_AFTER) * 8.5);
    const breath = breathWave * (0.82 + 0.18 * loopNoise(t * 0.9, 1.2, seed + 99));
    const baseHeat =
      t < T_AFTER
        ? lerp(1, 0.62, seg(t, T_TOUCH, T_AFTER))
        : (0.2 + 0.55 * breath) * afterFade;

    // Flat perspective impact crater ellipse (rx = 68, ry = 68 * SY ≈ 11.6)
    const cGrow = ease.outCubic(seg(t, T_TOUCH, T_HIT + 0.08));
    const rx = CRATER_RX * cGrow;
    const magmaA = 0.9 * afterFade;
    for (let k = 0; k < craterPixels.length; k++) {
      const cp = craterPixels[k];
      if (cp.d >= cGrow) continue;
      const magma = baseHeat * cp.baseM - cp.n;
      if (magma > 0.34) {
        const ci = magma > 0.82 ? 7 : magma > 0.66 ? 6 : magma > 0.5 ? 5 : magma > 0.38 ? 4 : 3;
        p.blend(cp.px, cp.py, C[ci], magmaA);
      } else {
        p.blend(cp.px, cp.py, cp.sootCol, cp.sootA * afterFade);
      }
    }

    // Jagged upheaved volcanic crater rim lips on left and right
    for (const sd of [-1, 1]) {
      for (let i = 0; i < 16; i++) {
        const u = i / 15;
        const hx = sd * (rx * 0.74 + u * 22 * cGrow);
        const hh = Math.round(Math.sin(Math.PI * u) * 4.6 * cGrow);
        for (let j = 0; j <= hh; j++) {
          const col = j === hh ? mix(S[6], C[5], 0.45 * baseHeat) : j === hh - 1 ? S[4] : S[2];
          p.dot(hx, -j, col, afterFade);
        }
      }
    }

    // Radiating magma floor cracks
    for (const c of cracks) {
      if (t < c.t0) continue;
      const nPts = Math.floor(c.pts.length * clamp((t - c.t0) / c.grow));
      const cBreath = t >= T_AFTER ? 0.45 + 0.55 * Math.cos((t - T_AFTER) * 8.5 + c.ph * 0.25) : 1;
      for (let i = 1; i < nPts; i++) {
        const u = i / c.pts.length;
        const localH = baseHeat * (1 - 0.38 * u) * (0.7 + 0.3 * cBreath);
        const [x0, y0] = c.pts[i - 1], [x1, y1] = c.pts[i];
        const col =
          localH > 0.82 ? C[7] : localH > 0.62 ? C[6] : localH > 0.44 ? C[5] : localH > 0.28 ? C[4] : localH > 0.16 ? C[2] : S[1];
        p.line(x0, y0, x1, y1, col, afterFade);
      }
    }

    // Breathing ember coals in afterglow
    if (t >= T_CORE_SHATTER) {
      for (const cs of coalSpots) {
        if (t >= cs.tEnd) continue;
        const k = (1 - smooth(cs.tEnd - 0.55, cs.tEnd, t)) * afterFade;
        const pulse = 0.45 + 0.55 * Math.cos((t - T_AFTER) * 8.5 + cs.ph);
        const h = k * (0.35 + 0.65 * pulse) * (1 - cs.d * 0.3);
        if (h < 0.12) continue;
        const col = h > 0.68 ? C[6] : h > 0.45 ? C[5] : h > 0.26 ? C[3] : C[2];
        p.dot(cs.x, cs.y, col, Math.min(1, h * 1.45));
        if (h > 0.45) p.light(cs.x, cs.y, C[4], 0.32 * h);
      }
    }

    if (baseHeat > 0.02) {
      floorLight(p, 0, 0.5, 76, 10, C[4], 0.34 * baseHeat * afterFade);
    }
  }

  function drawShockRings(p, back) {
    if (t < T_TOUCH || t >= T_HIT + 0.56) return;
    const keep = back ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0;
    const u1 = seg(t, T_TOUCH, T_HIT + 0.46);
    if (u1 < 1) {
      const r1 = 24 + (R_WAVE - 24) * ease.outQuart(u1);
      const th1 = Math.max(1.4, 6.8 * (1 - u1));
      const a1 = (1 - smooth(0.55, 1, u1)) * 1.15;
      band(p, 0, 0.5, r1, SY, th1, a1, [C[3], C[5], C[6], C[7]], keep, u1 < 0.16);
    }
    const u2 = seg(t, T_HIT, T_HIT + 0.54);
    if (u2 > 0 && u2 < 1) {
      const r2 = 18 + (R_WAVE - 28) * ease.outCubic(u2);
      const th2 = Math.max(1.2, 4.2 * (1 - u2));
      const a2 = (1 - smooth(0.5, 1, u2)) * 0.95;
      band(p, 0, 0.5, r2, SY, th2, a2, [S[3], C[4], C[5], C[6]], keep, false);
    }
  }

  return {
    update(dt) {
      t += dt;

      if (t < T_HIT) {
        // Stage 1 & 2 (0.0 - 0.70s): Colossal meteor descent shedding huge fire plumes, sparks, and molten crust chunks
        const [x, y] = pos(t);
        const vx = (x - last[0]) / Math.max(1e-4, dt), vy = (y - last[1]) / Math.max(1e-4, dt);
        last = [x, y];
        for (let i = 0; i < 4; i++) {
          if (!R.chance(0.88 * dt * 60)) continue;
          const off = R.range(-R_METEOR * 0.78, R_METEOR * 0.78);
          const sx = x - ux * R_METEOR * 0.65 - uy * off;
          const sy = y - uy * R_METEOR * 0.65 + ux * off;
          ps.spawn(
            P.FIRE,
            sx,
            sy,
            vx * 0.1 + R.range(-24, 24),
            vy * 0.1 + R.range(-34, 12),
            R.range(0.34, 0.66),
            0,
            R.range(5.2, 9.2),
            0,
            R.chance(0.65) ? PF.SMOKES | PF.BIG : PF.BIG
          );
        }
        if (R.chance(0.9 * dt * 60)) {
          const off = R.range(-R_METEOR * 0.85, R_METEOR * 0.85);
          ps.spawn(P.SPARK, x - uy * off, y + ux * off, vx * 0.28 + R.range(-80, 80), vy * 0.28 + R.range(-80, 35), R.range(0.22, 0.5));
        }
        if (R.chance(0.45 * dt * 60)) {
          ps.spawn(P.EMBER, x + R.range(-22, 22), y + R.range(-22, 22), vx * 0.08 + R.range(-30, 30), vy * 0.08 + R.range(-40, 0), R.range(0.65, 1.25), C[5], R.chance(0.35) ? 2 : 1);
        }

        // Initial ground-contact spray as the giant meteor nose touches the floor at T_TOUCH (0.62s)
        if (!touched && t >= T_TOUCH) {
          touched = true;
          lights.add(0, -18, 64, C[6], 0.75, 0.22);
          for (let i = 0; i < 36; i++) {
            const sd = R.sign(), a = -Math.PI / 2 + sd * R.range(0.55, 1.38), sp = R.range(90, 230);
            ps.spawn(P.SPARK, sd * R.range(6, 24), -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.24, 0.55));
          }
          for (let i = 0; i < 6; i++) {
            const sd = R.sign(), a = -Math.PI / 2 + sd * R.range(0.5, 1.1), sp = R.range(95, 195);
            addBoulder({
              kind: B.CHUNK,
              x: sd * R.range(10, 24),
              y: -3,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              g: 1,
              drag: 0.45,
              bounce: 0.3,
              life: R.range(0.9, 1.6),
              a: R.range(0, TAU),
              va: R.range(-14, 14),
              s: R.range(2.6, 4.4),
            });
          }
        }
      } else if (!hit) {
        // Stage 3 (0.70s): Full cataclysmic detonation of the colossal meteor!
        hit = true;
        lights.add(0, -48, 86, C[5], 0.9, 0.85);
        lights.add(0, -20, 42, WHITE, 0.85, 0.14);

        // Wide outward burst of fireball puffs so the blast at t = 0.70..1.25s is wider than the 74px asteroid
        for (let i = 0; i < 34; i++) {
          const a = -Math.PI / 2 + R.range(-1.38, 1.38), sp = R.range(65, 225);
          ps.spawn(
            P.FIRE,
            R.range(-20, 20),
            -R.range(4, 18),
            Math.cos(a) * sp,
            Math.sin(a) * sp * 0.72 - 25,
            R.range(0.42, 0.92),
            0,
            R.range(6.2, 10.8),
            0,
            R.chance(0.55) ? PF.SMOKES | PF.BIG : PF.BIG
          );
        }
        for (let i = 0; i < 82; i++) {
          const a = -Math.PI / 2 + R.range(-1.38, 1.38), sp = R.range(95, 280);
          ps.spawn(P.SPARK, R.range(-22, 22), -4, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.25, 0.75));
        }
        for (let i = 0; i < 28; i++) {
          const sd = R.sign();
          ps.spawn(P.SMOKE, sd * R.range(12, 34), -R.range(2, 6), sd * R.range(60, 140), -R.range(4, 18), R.range(1.1, 1.85), SOOT, R.range(6.2, 10.5), R.range(0, 0.08), PF.BIG);
        }
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + R.range(-1.05, 1.05), sp = R.range(115, 210);
          ps.spawn(P.BRAND, R.range(-12, 12), -6, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.65, 1.15));
        }
        for (let i = 0; i < 12; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(105, 240);
          addBoulder({
            kind: B.CHUNK,
            x: R.range(-22, 22),
            y: -4,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            g: 1,
            drag: 0.45,
            bounce: 0.3,
            life: R.range(1.1, 1.95),
            a: R.range(0, TAU),
            va: R.range(-14, 14),
            s: R.range(2.6, 4.8),
          });
        }
        for (let i = 0; i < 58; i++) {
          const u = R.range(-1, 1), a = -Math.PI / 2 + u * 0.88, sp = R.range(80, 235);
          ps.spawn(P.GRIT, u * 22, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.9, 1.7), R.pick([S[6], S[5], S[4], C[5]]), R.chance(0.45) ? 2 : 1);
        }
      }

      // Stage 4 (1.25s): The half-buried giant meteor core splits wide open and detonates a second wave of boulders & fire
      if (!coreShattered && t >= T_CORE_SHATTER) {
        coreShattered = true;
        lights.add(0, -34, 68, C[6], 0.72, 0.45);
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + R.range(-1.0, 1.0), sp = R.range(85, 210);
          addBoulder({
            kind: B.CHUNK,
            x: R.range(-18, 18),
            y: -R.range(4, 18),
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            g: 1,
            drag: 0.45,
            bounce: 0.3,
            life: R.range(1.0, 1.75),
            a: R.range(0, TAU),
            va: R.range(-14, 14),
            s: R.range(2.6, 4.8),
          });
        }
        for (let i = 0; i < 42; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(80, 220);
          ps.spawn(P.SPARK, R.range(-16, 16), -R.range(4, 16), Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.35, 0.8));
        }
      }

      if (t >= T_HIT) {
        const pt = t - T_HIT;
        plume.update(dt);
        const SShape = plume.shape();
        col.update(dt, SShape.y + SShape.tube * 0.25, clamp(1 - pt / 1.9));
      }

      // Stage 5 (2.65 - 5.1s): Breathing crater releases lazy embers and thin smoke wisps
      if (t >= T_AFTER && t < 4.35) {
        if (R.chance(0.32 * dt * 60)) {
          const cs = R.pick(coalSpots);
          ps.spawn(P.EMBER, cs.x, cs.y - 1, R.range(-10, 10), -R.range(14, 34), R.range(0.45, 0.8), C[5], 1);
        }
        if (R.chance(0.18 * dt * 60)) {
          const cs = R.pick(coalSpots);
          ps.spawn(P.SMOKE, cs.x, cs.y - 1, R.range(-6, 6), -R.range(10, 22), R.range(0.5, 0.85), SH, R.range(2.2, 3.6));
        }
      }

      bits.update(dt);
      blazes.update(dt);
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      if (t >= T_END - 1e-6) return;
      drawCraterAndCracks(p);
      drawShockRings(p, true);
      simDraw(p, ps, H, "back");
      blazes.drawBack(p);
    },
    draw(p) {
      if (t >= T_END - 1e-6) return;
      const NZ = (rate, s0, off = 0) => loopNoise(t * rate * 0.15 + off * 0.1, 1.4, s0);

      if (t < T_HIT) {
        // Draw trailing particles FIRST during descent so the colossal 74px asteroid body is 100% unobstructed!
        simDraw(p, ps, H, "front");

        const [x, y] = pos(t);
        const rot = t * 1.15;

        // Multi-layered roaring comet wake behind the 74px asteroid
        const wake = [
          [72, 18, 0],
          [62, 15.5, -14],
          [62, 15.5, 14],
          [48, 13, -25],
          [48, 13, 25],
        ];
        for (let i = 0; i < wake.length; i++) {
          const [L, w, off] = wake[i];
          const s0 = seed + i * 29;
          flameBlade(
            p,
            x - ux * (R_METEOR * 0.35) - uy * off,
            y - uy * (R_METEOR * 0.35) + ux * off,
            -ux,
            -uy,
            L * (0.88 + 0.22 * NZ(4.5, s0)),
            w,
            NZ(3.2, s0 + 7) * 3.5,
            NZ,
            s0,
            H,
            LAYERS,
            0.5,
            1.6
          );
        }

        // Detached satellite rock fragments trailing alongside the giant meteor for scale contrast
        for (let i = 0; i < satellites.length; i++) {
          const st = satellites[i];
          const sx = x + ux * st.offAlong - uy * st.offPerp;
          const sy = y + uy * st.offAlong + ux * st.offPerp;
          if (sy < 0) {
            flameBlade(p, sx, sy, -ux, -uy, 14, 3.2, 0, NZ, seed + 210 + i * 13, H, LAYERS, 0.5, 1.3);
            drawRock(p, sx, sy, st.s, st.a0 + t * st.va, st.pts, S, 1);
            p.glow(sx, sy, 6, C[5], 0.35);
          }
        }

        // As the giant meteor touches the ground (0.62 - 0.70s), its nose begins splitting and crushing into the floor (clipBottom = 2)
        const touchSplit = t >= T_TOUCH ? smooth(T_TOUCH, T_HIT, t) * 5.5 : 0;
        drawGiantMeteor(p, x, y, R_METEOR, rot, 0, touchSplit, 1, 2);
        drawBowShock(p, x, y, R_METEOR);
        p.glow(x, y, 54, C[5], 0.44);
        p.glow(x + ux * 14, y + uy * 14, 24, C[7], 0.38);

        // Ground-touch impact flare at the base of the colossal meteor (visible in Frame 20!)
        if (t >= T_TOUCH) {
          const tf = seg(t, T_TOUCH, T_HIT);
          flare(p, 4, -2, 54 * (0.6 + 0.4 * tf), 0.9, [C[3], C[5], C[6], C[7]]);
          sparkle(p, 4, -2, 22, WHITE, C[6], 0.85);
        }

        for (const b of bits.list) {
          drawRock(p, b.x, b.y, b.s, b.a, b.pts, S, Math.min(1, b.life / 0.35));
        }
        drawShockRings(p, false);
        lights.draw(p);
      } else {
        // Post-impact (t >= 0.70s): towering mushroom fireball plume + colossal split asteroid slabs in the crater!
        const a = t - T_HIT;

        const f = a / 0.13;
        if (f >= 0 && f < 1) {
          dome(p, C, 0, 36 + 38 * ease.outCubic(f), 1 - f);
        }

        const SShape = plume.shape();
        const fire = clamp(1.2 - a * 0.62);
        const glow = plume.ember();

        // Draw the colossal split asteroid halves around the base of the mushroom column so its 70px bulk is clearly seen in the crater!
        const bury = smooth(0, 0.25, a) * 10 + smooth(T_CORE_SHATTER, T_AFTER + 0.25, t) * 20;
        const splitGap = 6 + smooth(0, 0.48, a) * 14;
        const cool = clamp(a / 3.2);
        const coreFade = 1 - smooth(4.2, 4.85, t);

        plume.draw(p, FR, SM, {
          mid: () => {
            if (coreFade > 0 && bury < 28.5) {
              const coreR = lerp(R_METEOR * 0.94, R_METEOR * 0.82, clamp(a / 0.3));
              drawGiantMeteor(p, 0, -6 + bury, coreR, 0.78, cool * 0.82, splitGap, coreFade, 2);
              if (t < T_AFTER) {
                const fk = 1 - seg(t, T_HIT, T_AFTER);
                flameTongue(p, 0, 1, 44 * fk, 7.0 * fk, 0, NZ, seed + 141, H, LAYERS);
                flameTongue(p, -12, 1, 28 * fk, 4.6 * fk, -4, NZ, seed + 163, H, LAYERS);
                flameTongue(p, 12, 1, 28 * fk, 4.6 * fk, 4, NZ, seed + 181, H, LAYERS);
              }
            }
            col.draw(p, SShape.y + SShape.tube * 0.25, FR, SM, fire, glow);
          },
        });

        for (const b of bits.list) {
          drawRock(p, b.x, b.y, b.s, b.a, b.pts, S, Math.min(1, b.life / 0.35));
        }

        simDraw(p, ps, H, "front");
        drawShockRings(p, false);

        if (f >= 0 && f < 1) {
          sparkle(p, 0, -16, 28 * (1 - f), WHITE, C[6], 0.88);
        }
        const fr = a / 0.24;
        if (fr > 0 && fr < 1) {
          flare(p, 0, -14, 72 * Math.pow(1 - fr, 1.35), 1 - fr, [C[3], C[5], C[6], C[7]]);
        }

        lights.draw(p);
      }
    },
  };
}
