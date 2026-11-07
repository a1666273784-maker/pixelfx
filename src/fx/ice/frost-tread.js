import { Particles, Lights, P, Rng, fit, band, sparkle, clamp, smooth, seg, ease, rand, TAU } from "../../core/index.js";
import { hotFirst, flameBlade, floorLight, LAYERS } from "../fire/_lib.js";

export const meta = {
  name: "Frost tread",
  desc: "Bounding white-tiger steps burst cyan-white frost rings and low upward-curling razor-edged cold wakes that cool into thin cyan mist and lingering frost granules.",
  tags: ["ice", "frost", "tread", "trail", "wind", "ground", "one-shot"],
  size: [236, 84],
  origin: [34, 64],
  duration: 1.8,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#08181c", "#0d2e34", "#12474f", "#196a74", "#21909c", "#37b8c4", "#79dde6", "#c4f4f8"],
    frost: ["#1a2228", "#2e3d46", "#4d616e", "#728c9a", "#9fb4c0", "#c8d8e2", "#eaf4f8", "#ffffff"],
    mist: ["#0b2228", "#143c44", "#22606a", "#3d8f9a", "#6bbec8"],
    shadow: ["#061116"],
    seed: 7,
  },
};

// Six asymmetric quadruped/fast-stride bounding footfalls (dx = 18, 48, 22, 34, 48; s = 0.78..1.34).
// First landing spot is anchored at (0, 0) on the ground plane y = 0.
const STEP_SPECS = [
  { x: 0,   y: 0.0,  t0: 0.00,  s: 0.86, curl: 0.94 }, // Step 0: nimble lead touch at origin (0, 0)
  { x: 18,  y: -2.0, t0: 0.045, s: 1.12, curl: 1.14 }, // Step 1: close heavy fore-push (dx=18)
  { x: 66,  y: 1.6,  t0: 0.16,  s: 0.78, curl: 0.84 }, // Step 2: light hind catch after leap (dx=48)
  { x: 88,  y: -1.8, t0: 0.21,  s: 1.04, curl: 1.06 }, // Step 3: mid-stride drive (dx=22)
  { x: 122, y: 1.5,  t0: 0.295, s: 0.92, curl: 0.96 }, // Step 4: fast gather plant (dx=34)
  { x: 170, y: -1.2, t0: 0.39,  s: 1.34, curl: 1.28 }, // Step 5: explosive apex lunge (dx=48)
];

const SY = 0.25;         // flat ground perspective squash
const WAKE_LIFE = 1.20;  // 1.2s point-by-point cooling window per step
const T_END = 1.80;      // one-shot completion time

export function create(o) {
  // Four strictly separated color groups (never mixed)
  const C = fit(o.palette, 8), HC = hotFirst(C);
  const F = fit(o.frost, 8);
  const M = fit(o.mist, 5);
  const SH = fit(o.shadow, 1)[0];

  const R = new Rng(o.seed), seed = o.seed * 17, floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [F[7], C[7], C[6], C[4]],
    haze: M[2],
  });
  const lights = new Lights();

  // Precompute deterministic geometry per landing spot
  const steps = STEP_SPECS.map((sp, idx) => {
    const gCount = 2 + (idx % 2); // 2 or 3 white frost granules per step
    const granules = [];
    for (let k = 0; k < gCount; k++) {
      const a = -Math.PI * 0.92 + (k / Math.max(1, gCount - 1)) * Math.PI * 1.48 + R.range(-0.18, 0.18);
      const dist = R.range(3.8, 10.2) * sp.s;
      granules.push({
        x: Math.round(sp.x + Math.cos(a) * dist),
        y: Math.round(sp.y + Math.sin(a) * dist * SY + R.range(-0.4, 0.6)),
        // Granules survive past the 1.2s wake and extinguish last one-by-one before 1.8s
        tOut: Math.min(T_END - 0.04, sp.t0 + WAKE_LIFE + 0.12 + k * 0.09 + R.range(0.02, 0.07)),
        sz: k === 0 ? 2 : 1,
        ph: R.range(0, TAU),
      });
    }

    // 7 knife-cut serration teeth along the outer windward edge of the J-curl wake
    const shards = [];
    for (let k = 0; k < 7; k++) {
      const uPos = 0.10 + (k / 6) * 0.80;
      shards.push({
        uPos,
        len: R.range(5.0, 8.4) * sp.s * (1 - uPos * 0.18),
        w: R.range(2.1, 3.2) * sp.s,
        angOff: R.range(-0.14, 0.14),
        driftVx: R.range(-8.0, -3.2),
        driftVy: R.range(-1.8, -0.2),
      });
    }

    // 10 point-by-point cooling mist wisps along the wake spine
    const mistSegs = [];
    for (let k = 0; k < 10; k++) {
      const uPos = 0.05 + (k / 9) * 0.88;
      mistSegs.push({
        uPos,
        vx: R.range(-10.5, -4.5),
        vy: R.range(-1.4, 0.3),
        len: R.range(6.8, 11.2) * sp.s * (1 - uPos * 0.18),
        h: R.range(1.7, 2.8) * sp.s,
        // Point-by-point cooling: each point along uPos cools sequentially over the 1.2s window
        tStart: 0.14 + uPos * 0.36,
        tEnd: Math.min(1.0, 0.64 + uPos * 0.36),
      });
    }

    // Frost ring radial ice-splinter spikes
    const ringSpikes = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + R.range(-0.18, 0.18);
      ringSpikes.push({
        ca: Math.cos(a),
        sa: Math.sin(a),
        r0: R.range(0.58, 0.80),
        r1: R.range(1.08, 1.32),
      });
    }

    return {
      ...sp,
      idx,
      rx: 13.0 * sp.s,
      granules,
      shards,
      mistSegs,
      ringSpikes,
      hit: false,
    };
  });

  let t = 0;
  // Quantized wind-step noise so wake edges stay razor-sharp & crystalline rather than fluid like fire
  const NZ = (rate, s0, off = 0) => {
    const q = Math.floor(off * 1.6 - t * rate * 0.32);
    return (rand(q, s0) * 2 - 1) * 1.05;
  };

  // Sample the low-slung upward-curling J-hook wake spine at normalized arclength u in [0, 1]
  // Sweeps low and horizontal near the ground for u in [0, 0.5], then rolls smoothly upward and hooks inward!
  function sampleWake(s, u, grow, age) {
    const reach = 21.5 * s.s * grow;
    const rollU = clamp((u - 0.24) / 0.76, 0, 1);
    const hookBack = 5.8 * s.s * s.curl * Math.pow(rollU, 2.4) * grow;
    const lift = (1.6 * u + 11.2 * s.curl * Math.pow(rollU, 1.85)) * s.s * grow;
    // Wind shears the upper curl further backward as it ages so it blows like snow in the wind
    const windSlide = age * (3.5 + 4.5 * u * u);

    const x = s.x + 3.2 * s.s - reach * Math.sin(u * Math.PI * 0.52) + hookBack - windSlide;
    const y = s.y - 0.8 - lift;

    const du = 0.025;
    const u2 = Math.min(1, u + du);
    const rollU2 = clamp((u2 - 0.24) / 0.76, 0, 1);
    const x2 = s.x + 3.2 * s.s - reach * Math.sin(u2 * Math.PI * 0.52) + 5.8 * s.s * s.curl * Math.pow(rollU2, 2.4) * grow - age * (3.5 + 4.5 * u2 * u2);
    const y2 = s.y - 0.8 - (1.6 * u2 + 11.2 * s.curl * Math.pow(rollU2, 1.85)) * s.s * grow;
    const tx = x2 - x, ty = y2 - y;
    const tl = Math.hypot(tx, ty) || 1;
    // dx, dy points along the curve from base toward tip; normal (-dy, dx) points leeward
    return { x, y, dx: tx / tl, dy: ty / tl };
  }

  // Draw the unified low-slung upward-curling ribbon along sampleWake(s, u) using LAYERS
  // Erodes point-by-point from base (uMin) and tip (uMax) as the wake cools over 1.2s
  const N_PTS = 9;
  const bx = new Float32Array(N_PTS), by = new Float32Array(N_PTS);
  const nxArr = new Float32Array(N_PTS), nyArr = new Float32Array(N_PTS);
  const hw = new Float32Array(N_PTS);
  const _pool = Array.from({ length: N_PTS * 2 }, () => [0, 0]);
  const pts = [];

  function drawCurledWake(p, s, grow, age, uMin, uMax, w0, ramp) {
    if (uMax - uMin < 0.14) return;
    for (let i = 0; i < N_PTS; i++) {
      const f = i / (N_PTS - 1);
      const u = uMin + f * (uMax - uMin);
      const pt = sampleWake(s, u, grow, age * 0.48);
      // Quantized crystalline step jitter along the normal
      const stepJit = NZ(12, seed + s.idx * 53 + i * 7, i) * 0.52 * s.s * f;
      const nx = -pt.dy, ny = pt.dx;
      bx[i] = pt.x + nx * stepJit;
      by[i] = pt.y + ny * stepJit;
      nxArr[i] = nx;
      nyArr[i] = ny;
      // Full mid-body through the curl (f = 0.2..0.7), tapering to a sharp chisel point at the tip
      const env = Math.sin(Math.min(1, f * 1.45) * Math.PI * 0.5) * Math.pow(1 - f * 0.90, 0.62);
      hw[i] = w0 * env;
    }

    for (let li = 0; li < LAYERS.length; li++) {
      const [wf, lf, ci] = LAYERS[li];
      const n = Math.max(3, Math.round(N_PTS * lf));
      pts.length = 2 * n;
      for (let j = 0; j < 2 * n; j++) pts[j] = _pool[j];
      for (let i = 0; i < n; i++) {
        const w = hw[i] * wf;
        // Asymmetric profile: sharper outer knife edge, fuller inner scroll
        pts[i][0] = bx[i] + nxArr[i] * w * 1.18;
        pts[i][1] = by[i] + nyArr[i] * w * 1.18;
        pts[2 * n - 1 - i][0] = bx[i] - nxArr[i] * w * 0.78;
        pts[2 * n - 1 - i][1] = by[i] - nyArr[i] * w * 0.78;
      }
      p.poly(pts, ramp[ci]);
    }
  }

  return {
    update(dt) {
      t += dt;
      for (const s of steps) {
        if (!s.hit && t >= s.t0) {
          s.hit = true;
          lights.add(s.x, s.y - 3, 25 * s.s, C[6], 0.50, 0.19);
          // Low backward-swept frost shards on hoof/paw strike
          const nSparks = Math.round(4 + 3 * s.s);
          for (let i = 0; i < nSparks; i++) {
            const a = -Math.PI + R.range(-0.04, 0.52);
            const sp = R.range(40, 96) * Math.sqrt(s.s);
            ps.spawn(
              P.SPARK,
              s.x + R.range(-2, 2),
              s.y - 1,
              Math.cos(a) * sp,
              Math.sin(a) * sp - R.range(3, 13),
              R.range(0.15, 0.30),
              R.chance(0.4) ? 2 : 1
            );
          }
        }
      }
      ps.update(dt);
      lights.update(dt);
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;

      // 1. GROUND LAYER: Shadow footprints, floorLight, and expanding cyan-white frost rings
      for (const s of steps) {
        const age = t - s.t0;
        if (age < 0) continue;
        const ringLife = WAKE_LIFE + 0.10;
        if (age >= ringLife) continue;

        const u = age / ringLife;
        const expand = ease.outQuart(clamp(age / 0.14));
        const rx = s.rx * (0.32 + 0.68 * expand);
        const ry = Math.max(1.6, rx * SY);

        // Dark ground shadow imprint (strictly from shadow group)
        const shAlpha = (1 - smooth(0.38, 1.0, u)) * 0.62;
        if (shAlpha > 0.04) {
          p.ellipse(s.x, s.y + 0.5, rx * 0.72, Math.max(1.2, ry * 0.68), SH, shAlpha);
        }

        // Brief cold floor glow on strike
        if (age < 0.62) {
          const glowK = (1 - age / 0.62) * 0.30 * s.s;
          floorLight(p, s.x - 3 * s.s, s.y, rx * 1.35, 3.8 * s.s, C[5], glowK);
        }

        // Crisp perspective frost ring (cyan-white palette + frost rim) that fractures as it cools
        const ringFade = 1 - smooth(0.26, 1.0, u);
        const thick = (2.3 * (1 - u * 0.58) + 0.55) * s.s;
        const ringRamp = u < 0.22
          ? [C[2], C[5], C[7], F[7]]
          : u < 0.55
            ? [C[1], C[3], C[5], F[5]]
            : [C[0], C[1], C[3], F[3]];

        band(
          p,
          s.x,
          s.y,
          rx,
          SY,
          thick,
          ringFade,
          ringRamp,
          (a, k) => {
            const n = rand(Math.floor(((a + Math.PI) / TAU) * 14) + k * 7, seed + s.idx * 31);
            return n > u * 0.88 - 0.06;
          },
          age < 0.055
        );

        // Sharp radial frost teeth jutting outward from the ground ring while fresh
        if (u < 0.48) {
          const spCol = u < 0.18 ? C[7] : u < 0.34 ? C[5] : C[3];
          const shrink = 1 - smooth(0.16, 0.48, u);
          for (const spk of s.ringSpikes) {
            const x0 = s.x + spk.ca * rx * spk.r0;
            const y0 = s.y + spk.sa * ry * spk.r0;
            const x1 = s.x + spk.ca * rx * (spk.r0 + (spk.r1 - spk.r0) * shrink);
            const y1 = s.y + spk.sa * ry * (spk.r0 + (spk.r1 - spk.r0) * shrink);
            p.line(x0, y0, x1, y1, spCol);
          }
        }
      }

      ps.draw(p, "back");

      // 2. WAKE LAYER: Low-slung upward-curling cold wake with razor-sharp broken edges,
      // cooling point-by-point over 1.2s into crisp pale-cyan mist wisps
      for (const s of steps) {
        const age = t - s.t0;
        if (age < 0 || age >= WAKE_LIFE) continue;

        const u = age / WAKE_LIFE; // 0..1 over 1.2s
        const grow = ease.outQuart(clamp(age / 0.12));

        // 2a. Point-by-point cooling mist wisps (strictly using `mist` color group M[0..4])
        // As each segment of the wake cools, it shears backward into crisp stepped cyan mist strips
        for (let k = 0; k < s.mistSegs.length; k++) {
          const ms = s.mistSegs[k];
          if (u < ms.tStart || u > ms.tEnd) continue;
          const mu = seg(u, ms.tStart, ms.tEnd);
          const basePt = sampleWake(s, ms.uPos, grow, age * 0.52);
          const dtMist = (u - ms.tStart) * WAKE_LIFE;
          const mx = basePt.x + ms.vx * dtMist;
          const my = basePt.y + ms.vy * dtMist;

          // Step down the 5-tone mist ramp point-by-point as mu advances (held up by clear mid-tones)
          const mTop = clamp(Math.floor((1 - mu * 0.82) * 4.99), 1, 4);
          const mBody = clamp(mTop - 1, 0, 3);
          const slLen = ms.len * (1 - mu * 0.45);
          const slH = ms.h * (1 - mu * 0.35);
          if (slLen < 1.3) continue;

          // Wind-sheared horizontal-curling mist wisp (more horizontal as it drifts in the wind)
          const tx = clamp(basePt.dx * (1 - mu * 0.45) - 0.55 * mu, -1, 1);
          const ty = basePt.dy * (1 - mu * 0.55);
          const tl = Math.hypot(tx, ty) || 1;
          const ux = tx / tl, uy = ty / tl;
          const nx = -uy, ny = ux;
          p.poly(
            [
              [mx - ux * slLen * 0.45, my - uy * slLen * 0.45],
              [mx + ux * slLen * 0.25 + nx * slH, my + uy * slLen * 0.25 + ny * slH],
              [mx + ux * slLen * 0.65, my + uy * slLen * 0.65],
              [mx + ux * slLen * 0.10 - nx * slH * 0.6, my + uy * slLen * 0.10 - ny * slH * 0.6],
            ],
            M[mBody]
          );
          if (mu < 0.84) {
            p.poly(
              [
                [mx - ux * slLen * 0.28, my - uy * slLen * 0.28],
                [mx + ux * slLen * 0.20 + nx * slH * 0.65, my + uy * slLen * 0.20 + ny * slH * 0.65],
                [mx + ux * slLen * 0.48, my + uy * slLen * 0.48],
              ],
              M[mTop]
            );
          }
        }

        // 2b. Unified low-slung upward-curling cold wake (`flameBlade` base + J-curl ribbon + knife shards)
        if (u < 0.78) {
          const bladeU = u / 0.78;
          const coolShift = Math.floor(bladeU * 4.5);
          const c0 = HC[clamp(coolShift, 0, 5)];
          const c1 = HC[clamp(1 + coolShift, 1, 6)];
          const c2 = HC[clamp(2 + coolShift, 2, 6)];
          const c3 = HC[clamp(3 + coolShift, 3, 7)];
          const c4 = HC[clamp(4 + coolShift, 4, 7)];
          const coldRamp = [c0, c1, c2, c3, c4, C[1], C[0], C[0]];

          // Point-by-point erosion along the wake spine: both base and upper curl erode into mist
          const uMin = smooth(0.18, 0.76, u) * 0.48;
          const uMax = 1.0 - smooth(0.36, 0.78, u) * 0.34;
          const w0 = 4.3 * s.s * (1 - smooth(0.24, 0.78, u) * 0.54);

          // Main unified J-curl wake ribbon
          drawCurledWake(p, s, grow, age, uMin, uMax, w0, coldRamp);

          // Low ground-skimming `flameBlade` undertow at the foot strike
          if (u < 0.58) {
            const lowErode = smooth(0.16, 0.58, u);
            flameBlade(
              p,
              s.x + 3.0 * s.s - lowErode * 5.0 * s.s,
              s.y - 0.6,
              -0.996,
              -0.08,
              16.5 * s.s * grow * (1 - lowErode * 0.45),
              3.2 * s.s * (1 - lowErode * 0.55),
              5.2 * s.s * grow,
              NZ,
              seed + s.idx * 41,
              coldRamp,
              LAYERS,
              0.88,
              0.50
            );
          }

          // 2c. Knife-cut jagged edge shards (尾流边缘呈刀削般的锐利碎边, 靠可辨的中阶撑住)
          // Embedded directly on the outer edge of sampleWake so they form a single cohesive serrated silhouette
          for (let k = 0; k < s.shards.length; k++) {
            const sh = s.shards[k];
            const shFadeStart = 0.10 + sh.uPos * 0.40;
            const shFadeEnd = shFadeStart + 0.32;
            if (u >= shFadeEnd || sh.uPos < uMin - 0.04 || sh.uPos > uMax + 0.02) continue;

            const su = clamp((u - shFadeStart) / 0.32, 0, 1);
            const pt = sampleWake(s, sh.uPos, grow, age * 0.48);
            // Outward normal on the convex outer/bottom-left side of the J-curl
            const nx = pt.dy, ny = -pt.dx;

            const detach = su * su * 3.0;
            const bx0 = pt.x + nx * (0.7 * s.s + detach) + sh.driftVx * su * 0.14;
            const by0 = pt.y + ny * (0.7 * s.s + detach) + sh.driftVy * su * 0.14;

            const shScale = (1 - su * 0.54) * grow;
            const sLen = sh.len * shScale;
            const sW = sh.w * shScale;
            if (sLen < 1.3) continue;

            // Angle follows the wake tangent + slight outward chisel splay
            const ca = Math.cos(sh.angOff), sa = Math.sin(sh.angOff);
            const dirX = clamp(pt.dx * ca - pt.dy * sa + nx * 0.30, -1, 1);
            const dirY = clamp(pt.dx * sa + pt.dy * ca + ny * 0.30, -1, 1);
            const dl = Math.hypot(dirX, dirY) || 1;
            const ux = dirX / dl, uy = dirY / dl;
            const pnx = -uy, pny = ux;

            const tipX = bx0 + ux * sLen;
            const tipY = by0 + uy * sLen;

            // Stepped mid-tone colors (dark sheath -> recognizable cyan mid-tone -> crisp highlight)
            const stepShift = Math.min(5, coolShift + (su > 0.55 ? 2 : su > 0.22 ? 1 : 0));
            const colOuter = C[clamp(2 - Math.floor(stepShift * 0.4), 0, 2)];
            const colMid = C[clamp(5 - stepShift, 2, 5)];
            const colEdge = C[clamp(7 - stepShift, 3, 7)];

            // Outer dark-sheathed chisel tooth anchored inside the ribbon
            p.poly(
              [
                [bx0 - ux * 1.8, by0 - uy * 1.8],
                [bx0 + pnx * sW, by0 + pny * sW],
                [tipX, tipY],
              ],
              colOuter
            );
            // Recognizable mid-tone core facet
            p.poly(
              [
                [bx0 - ux * 0.5, by0 - uy * 0.5],
                [bx0 + pnx * sW * 0.65, by0 + pny * sW * 0.65],
                [tipX, tipY],
              ],
              colMid
            );
            // Razor-sharp highlight ridge along the knife edge
            if (su < 0.65) {
              p.line(bx0 + pnx * sW * 0.35, by0 + pny * sW * 0.35, tipX, tipY, colEdge);
            }
          }
        }
      }

      // 3. FROST GRANULES LAYER: 2-3 white frost granules per step that extinguish last on the ground
      for (const s of steps) {
        const age = t - s.t0;
        if (age < 0) continue;
        for (const g of s.granules) {
          if (t >= g.tOut) continue;
          const rem = g.tOut - t;
          // Keep white frost granules crisp and readable after the wake cools, then step down F[7..2]
          if (rem > 0.22) {
            const tw = 0.5 + 0.5 * Math.sin(t * 15 + g.ph);
            sparkle(p, g.x, g.y, g.sz, F[7], tw > 0.4 ? F[6] : F[4], 0.24);
          } else if (rem > 0.11) {
            p.px(g.x, g.y, F[7]);
            p.px(g.x - 1, g.y, F[5]);
          } else if (rem > 0.05) {
            p.px(g.x, g.y, F[5]);
          } else {
            p.px(g.x, g.y, F[3]);
          }
        }
      }

      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
