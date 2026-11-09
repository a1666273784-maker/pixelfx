// Standalone ground-quake shockwave attack VFX (震地波攻击特效):
// Subterranean pressure fractures the earth before a colossal release slam caves in the origin—catapulting
// multi-scale shattered boulders and tilted bedrock slabs high into the dark sky while driving a towering,
// triple-layered supersonic seismic shockwave and bulging crust-wave across the ground. In its wake, sheared
// tectonic crags heave up above deep glowing bedrock faults, culminating in a high-contrast void-core target
// hit-burst with a blow-through shock cone and a crushing monolith crown that splits, crumbles, and sinks cleanly.
//
// Built on repo primitives & patterns:
// - nature/_lib.js: stoneShape, drawRock, drawSpike (clip, half, cracks, heat), spikeLook, spikeCrack
// - impacts/_lib.js: spikes, star, brokenRing, frontCrescent
// - nature/earth-spike.js: progressive two-half ridge split, top-down rubble crumble, and sinking stumps
// - nature/rockfall.js & fire/qilin-roar.js: scalloped pixel-art PUFF_LUTS, COBBLE_STAMPS, and sprite caching

import { Particles, Bits, Lights, P, B, Rng, fit, clamp, smooth, lerp, ease, TAU, WHITE, mix } from "../../core/index.js";
import { stoneShape, drawRock, drawSpike, spikeLook, spikeCrack } from "./_lib.js";
import { spikes, star, brokenRing, frontCrescent } from "../impacts/_lib.js";

const T_SLAM = 0.09;       // Earth-shattering release slam caves in origin & launches boulders high skyward!
const T_HIT = 0.49;        // Supersonic shock-wall slams into target -> high-contrast Hit-Result Detonation!
const T_CROWN = 0.56;      // 2 frames after hit-flash, colossal twin-jawed monolith crown erupts under target!
const T_CRACK = 1.06;      // Pressurized amber fault veins crawl up standing crags & monoliths
const T_SPLIT = 1.38;      // Cascading fault rupture splits hero monoliths & crumbles them into boulders
const T_END = 3.2;

const HIT_X = 184;
const HIT_Y = -50;
const SY = 0.20;

export const meta = {
  name: "Seismic wave",
  desc: "A tectonic slam hurls shattered boulders skyward and drives a supersonic ground-quake wave through heaving bedrock crags into a target-shattering hit burst.",
  tags: ["earth", "stone", "seismic", "shockwave", "quake", "rocks", "slam", "hit", "attack", "ground", "one-shot"],
  size: [416, 240],
  origin: [96, 192],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    stone: ["#0d0a13", "#1b1525", "#2d243e", "#46395d", "#665683", "#8d7cab", "#bcb0d5", "#ede7fa"],
    glow: ["#2c0a04", "#681808", "#b5380e", "#f27818", "#ffce4e", "#fff6c4"],
    seed: 19,
  },
};

// Prebaked scalloped, threshold-erodible pixel-art dust puff LUTs (radii 1..15)
const PUFF_LUTS = Array.from({ length: 16 }, (_, r) => {
  if (r < 1) return [];
  const pts = [];
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const ang = Math.atan2(dy, dx);
      const scallop = 1 + 0.14 * Math.sin(ang * 5 + r * 1.3) + 0.09 * Math.cos(ang * 8 - r * 0.7);
      const q = Math.hypot(dx, dy) / (r * scallop);
      if (q > 1) continue;
      const lit = (-dx * 0.45 - dy * 0.89) / Math.max(1, r);
      const zone = lit > 0.32 ? 2 : lit > -0.20 ? 1 : 0;
      pts.push(dx, dy, q, zone);
    }
  }
  return pts;
});

// Prebaked crisp pixel-cluster cobble stamps for small flying stones (4x4..6x5)
const COBBLE_STAMPS = [
  [
    [-1, -2, 0], [0, -2, 0], [1, -2, 0],
    [-2, -1, 0], [-1, -1, 7], [0, -1, 6], [1, -1, 5], [2, -1, 0],
    [-2, 0, 0], [-1, 0, 6], [0, 0, 4], [1, 0, 3], [2, 0, 0],
    [-1, 1, 0], [0, 1, 2], [1, 1, 0],
    [0, 2, 0],
  ],
  [
    [-1, -2, 0], [0, -2, 0], [1, -2, 0],
    [-2, -1, 0], [-1, -1, 7], [0, -1, 6], [1, -1, 5], [2, -1, 0],
    [-3, 0, 0], [-2, 0, 7], [-1, 0, 5], [0, 0, 4], [1, 0, 3], [2, 0, 0],
    [-2, 1, 0], [-1, 1, 3], [0, 1, 2], [1, 1, 2], [2, 1, 0],
    [-1, 2, 0], [0, 2, 0], [1, 2, 0],
  ],
  [
    [0, -2, 0], [1, -2, 0],
    [-1, -1, 0], [0, -1, 7], [1, -1, 5], [2, -1, 0],
    [-1, 0, 0], [0, 0, 4], [1, 0, 2], [2, 0, 0],
    [0, 1, 0], [1, 1, 0],
  ],
];

function drawCobble(p, cx, cy, kind, S, alpha = 1) {
  if (alpha <= 0.03) return;
  const st = COBBLE_STAMPS[kind % COBBLE_STAMPS.length];
  const rx = Math.round(cx), ry = Math.round(cy);
  for (let i = 0; i < st.length; i++) {
    const [dx, dy, si] = st[i];
    if (ry + dy > 2) continue;
    p.dot(rx + dx, ry + dy, S[si], alpha);
  }
}

// Quantized rotation sprite cache around drawRock, plus glowing hot fracture rim on freshly blasted boulders
function makeRockCache(pts, s, S, GL) {
  const angles = new Map();
  const cap = {
    cur: null,
    dot(x, y, c) {
      this.cur.push(Math.round(x), Math.round(y), c);
    },
  };
  return (p, rx, ry, rot, alpha = 1, flashWhite = false, hot = 0) => {
    if (alpha <= 0.02) return;
    const qi = ((Math.round((rot / TAU) * 36) % 36) + 36) % 36;
    let buf = angles.get(qi);
    if (!buf) {
      buf = [];
      cap.cur = buf;
      drawRock(cap, 0, 0, s, (qi / 36) * TAU, pts, S, 1, false);
      angles.set(qi, buf);
    }
    const ox = Math.round(rx), oy = Math.round(ry);
    if (flashWhite) {
      for (let i = 0; i < buf.length; i += 3) {
        const dy = buf[i + 1];
        if (oy + dy <= 2) p.dot(ox + buf[i], oy + dy, buf[i + 2] === S[0] ? S[0] : WHITE, alpha);
      }
      return;
    }
    const hotCol = hot > 0.55 ? GL[5] : GL[4];
    for (let i = 0; i < buf.length; i += 3) {
      const dx = buf[i], dy = buf[i + 1];
      if (oy + dy > 2) continue;
      const c = hot > 0.18 && dy >= s * 0.52 && buf[i + 2] !== S[0] ? hotCol : buf[i + 2];
      if (alpha >= 0.99) p.px(ox + dx, oy + dy, c);
      else p.dot(ox + dx, oy + dy, c, alpha);
    }
  };
}

// Bake static full-grown spike pixels once so standing & trembling hold frames blit in < 0.12 ms!
function bakeStandingSpike(x, h, w, lean, look, pal, clip) {
  const buf = [];
  const cap = {
    dot(px, py, c) {
      buf.push(Math.round(px), Math.round(py), c);
    },
    line() {},
    glow() {},
  };
  drawSpike(cap, x, 0, h, w, lean, look, pal, { a: 1, clip, floor: 0 });
  return buf;
}

// Fast overlay of glowing fault seams on baked standing crags
function drawCragCracks(p, c, shk, progress, heat, GL, S0) {
  if (progress <= 0.02) return;
  const hwAt = (u) => (c.w * 0.5) * Math.pow(Math.max(0, 1 - u), 0.85);
  const seamCol = heat > 0.72 ? GL[5] : heat > 0.45 ? GL[4] : heat > 0.22 ? GL[3] : GL[1];
  for (const path of c.cracks) {
    const m = Math.max(1, Math.floor(path.length * progress));
    for (let k = 1; k < m; k++) {
      const [u0, v0] = path[k - 1], [u1, v1] = path[k];
      if (u1 > c.maxClip - 0.03) break;
      const ax = c.x + shk + c.lean * u0 + v0 * hwAt(u0) * 0.82, ay = -u0 * c.H;
      const bx = c.x + shk + c.lean * u1 + v1 * hwAt(u1) * 0.82, by = -u1 * c.H;
      p.line(ax + 1, ay, bx + 1, by, S0, 0.9);
      p.line(ax, ay, bx, by, seamCol, 1);
    }
  }
  if (heat > 0.3 && c.w >= 28) {
    p.glow(c.x + shk + c.lean * 0.35, -c.H * c.maxClip * 0.38, 12, GL[3], 0.26 * heat);
  }
}

// Perspective ground shockwave lip (jagged physical compression crest, never a geometric sigil)
function drawShockBand(p, cx, cy, r, sy, th, alpha, ramp, back, xMin, xMax, hot = false) {
  if (alpha <= 0.03 || r <= 1 || th <= 0.2) return;
  const rx = r + th, ry = (r + th) * sy + th * 0.5;
  const x0 = Math.max(xMin, Math.floor(cx - rx - 1)), x1 = Math.min(xMax, Math.ceil(cx + rx + 1));
  const y0 = back ? Math.floor(cy - ry - 1) : Math.floor(cy);
  const y1 = back ? Math.floor(cy) : Math.min(34, Math.ceil(cy + ry + 1));
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
      const jag = 1 + 0.045 * Math.sin(nx * 9 + ny * 7);
      const grad = Math.hypot(nx * invR, ny * invRsy);
      const dist = (jag - e) / Math.max(1e-4, grad);
      if (dist < -0.5 || dist > th) continue;
      const u = clamp(dist / th);
      const col = u < 0.24 ? (hot ? WHITE : ramp[3]) : u < 0.54 ? ramp[2] : u < 0.82 ? ramp[1] : ramp[0];
      p.dot(x, y, col, alpha * (u < 0.45 ? 1.1 : 1.08 - u * 0.82));
    }
  }
}

// Subterranean jagged tectonic fault roots diving into the ground cross-section (y = 1..+34)
function buildSubFaults(R, xStart, xEnd) {
  const roots = [];
  const xs = [-22, 0, 34, 72, 110, 148, HIT_X, HIT_X + 24];
  for (let i = 0; i < xs.length; i++) {
    const rx = xs[i];
    const isMajor = rx === 0 || rx === HIT_X;
    const nBranches = isMajor ? 4 : 2;
    for (let b = 0; b < nBranches; b++) {
      const pts = [[rx + R.range(-4, 4), 1]];
      let cx = pts[0][0], cy = 1;
      const dirX = isMajor ? (b % 2 === 0 ? -1 : 1) * R.range(0.35, 1.15) : R.range(0.2, 0.95);
      const steps = isMajor ? R.int(6, 8) : R.int(4, 6);
      for (let s = 0; s < steps; s++) {
        cx = clamp(cx + dirX * R.range(3.5, 7.2) + R.range(-2.0, 2.0), xStart, xEnd);
        cy = clamp(cy + R.range(2.4, 4.5), 1, 34);
        pts.push([Math.round(cx), Math.round(cy)]);
      }
      roots.push({ x0: rx, isMajor, pts });
    }
  }
  return roots;
}

export function create(o) {
  const S = fit(o.stone, 8), GL = fit(o.glow, 6);
  const S_BACK = [S[0], S[1], S[1], S[2], S[3], S[4], S[5], S[6]];

  const R = new Rng(o.seed), floor = () => 0;
  const [W, H] = meta.size, [OX, OY] = meta.origin;
  const X_MIN = -OX + 10, X_MAX = W - OX - 10;     // -86 .. +310
  const Y_MIN = -OY + 10, Y_MAX = H - OY - 6;      // -182 .. +42

  const addSafeLight = (lx, ly, rad, col, inten, life) => {
    const maxR = Math.min(rad, lx + OX - 4, W - (lx + OX) - 4, ly + OY - 4, H - (ly + OY) - 4);
    if (maxR > 6) lights.add(lx, ly, maxR, col, inten, life);
  };

  const DUST_HI = mix(S[7], GL[4], 0.18);
  const DUST_MID = mix(S[5], S[6], 0.45);
  const DUST_LO = S[2];

  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, GL[5], GL[4], GL[3]] });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  // Prebake 8 faceted boulder archetypes up to s = 8.4 (19px chunky bedrock boulders!)
  const rockArchetypes = [2.7, 3.4, 4.2, 5.0, 5.9, 6.7, 7.5, 8.4].map((s) => ({
    s,
    pts: stoneShape(R, 7),
    draw: null,
  }));
  for (const ra of rockArchetypes) ra.draw = makeRockCache(ra.pts, ra.s, S, GL);

  const waveU = (tt) => clamp((tt - T_SLAM) / (T_HIT - T_SLAM));
  const waveX = (tt) => HIT_X * Math.pow(waveU(tt), 0.86);
  const timeAtX = (x) => (x <= 0 ? T_SLAM : T_SLAM + (T_HIT - T_SLAM) * Math.pow(clamp(x / HIT_X), 1 / 0.86));

  const subFaults = buildSubFaults(R, X_MIN + 8, X_MAX - 12);

  // Heaved tilted bedrock floor plates along the fault trench
  const plates = [];
  for (let x = -34; x <= HIT_X + 42; x += R.int(9, 13)) {
    const u = clamp(x / HIT_X);
    plates.push({
      x,
      w: R.int(9, 16),
      thick: R.int(3, 5) + (u > 0.65 ? 1 : 0),
      tilt: (x < -2 ? -1 : 1) * R.range(0.24, 0.68) * (0.85 + u * 0.4),
      lift: R.range(6, 14) * (Math.abs(x) < 22 ? 1.35 : 0.75 + u * 0.6),
      t0: x <= 4 ? T_SLAM + Math.abs(x) * 0.0012 : timeAtX(x),
    });
  }

  // Sculpted Tectonic Crag Formations + Colossal Target Monolith Crown
  const crags = [];
  const addCrag = (x, hVirt, w, lean, maxClip, tStart, stationIdx, backLayer = false, isTarget = false) => {
    const pal = backLayer ? S_BACK : S;
    const look = spikeLook(R);
    const tSplit = T_SPLIT + stationIdx * 0.052 + R.range(-0.01, 0.014);
    const cut = R.range(0.16, 0.24);
    crags.push({
      x,
      H: hVirt,
      w,
      lean,
      maxClip,
      cut,
      top: maxClip,
      t0: tStart,
      tSplit,
      fallDur: R.range(0.20, 0.30),
      sinkDur: R.range(0.28, 0.40),
      backLayer,
      isTarget,
      twoHalf: w >= 28,
      pal,
      look,
      baked: bakeStandingSpike(x, hVirt, w, lean, look, pal, maxClip),
      stumpBaked: bakeStandingSpike(x, hVirt, w, lean, look, pal, cut),
      cracks: [
        spikeCrack(R, 0.06, R.range(-0.14, 0.14), 1),
        spikeCrack(R, 0.20, R.range(-0.18, 0.18), -1),
      ],
      erupted: false,
      splitFired: false,
    });
  };

  // Low fractured recoil lips framing the blasted-open release crater at x = 0
  addCrag(-24, 48, 24, -15, 0.58, T_SLAM + 0.015, 0, false);
  addCrag(22, 52, 24, 15, 0.56, T_SLAM + 0.02, 0, true);

  // 3 Distinct Escalating Wake Formations
  addCrag(54, 82, 28, 17, 0.62, timeAtX(54), 1, false);
  addCrag(68, 58, 16, 21, 0.95, timeAtX(68) + 0.015, 1, true);

  addCrag(96, 108, 34, 21, 0.64, timeAtX(96), 2, false);
  addCrag(112, 78, 19, 25, 0.96, timeAtX(112) + 0.015, 2, true);

  addCrag(138, 128, 38, 24, 0.66, timeAtX(138), 3, false);

  // TARGET CATACLYSM MONOLITH CROWN at HIT_X = 184
  addCrag(HIT_X - 24, 120, 28, -18, 0.78, T_CROWN + 0.012, 4, true, true);
  addCrag(HIT_X + 22, 124, 30, 22, 0.74, T_CROWN + 0.016, 4, true, true);
  addCrag(HIT_X, 158, 42, 8, 0.93, T_CROWN, 4, false, true);

  const puffs = [];
  const flashes = [];
  const addPuff = (x, y, vx, vy, r0, r1, life, bright = 0) => {
    const capped = Math.min(life, T_END - 0.10 - t);
    if (capped <= 0.08) return;
    puffs.push({ x, y, vx, vy, r0, r1, age: 0, life: capped, bright, ph: R.range(0, TAU) });
  };

  // Chunky, directional, high-contrast impact stars
  const slamStar = spikes(R, 12, -0.36, { len: [18, 34], w: [2.4, 3.8], fwd: 0.72, back: 0.45, jag: 0.55 });
  const hitStar = spikes(R, 16, -0.10, { len: [24, 48], w: [3.6, 5.8], fwd: 0.85, back: 0.50, jag: 0.50 });
  const ringSegsA = Array.from({ length: 14 }, (_, i) => ({
    a: (i / 14) * TAU + R.range(-0.08, 0.08),
    gap: R.range(0.30, 0.72),
    dr: R.range(0.14, 0.40),
    w: R.range(0.85, 1.5),
  }));
  const ringSegsB = Array.from({ length: 10 }, (_, i) => ({
    a: (i / 10) * TAU + 0.24 + R.range(-0.09, 0.09),
    gap: R.range(0.38, 0.78),
    dr: R.range(0.18, 0.46),
    w: R.range(0.75, 1.35),
  }));

  const spawnBoulder = (x, y, vx, vy, tier = 1, streak = false, hotTime = 0, grav = 1) => {
    const life = Math.min(R.range(1.10, 1.95), T_END - 0.12 - t);
    if (life <= 0.1) return;
    const archIdx = tier === 2 ? R.int(4, 7) : tier === 1 ? R.int(0, 3) : -1;
    bits.add({
      kind: B.CHUNK,
      x,
      y,
      vx,
      vy,
      g: grav,
      drag: tier === 2 ? 0.08 : 0.26,
      bounce: tier === 2 ? 0.30 : 0.35,
      life,
      maxLife: life,
      hot: hotTime,
      a: R.range(0, TAU),
      va: R.sign() * (tier === 2 ? R.range(3.0, 7.2) : R.range(6.5, 14.5)),
      s: archIdx >= 0 ? rockArchetypes[archIdx].s : 2.0,
      arch: archIdx,
      cobble: R.int(0, 2),
      streak,
      pvy: 0,
      bounced: false,
    });
  };

  let t = 0, slammed = false, hitFired = false;
  let tremorAcc = 0, wakeAcc = 0;

  return {
    update(dt) {
      t += dt;

      for (let i = flashes.length - 1; i >= 0; i--) {
        if ((flashes[i].life -= dt) <= 0) flashes.splice(i, 1);
      }

      // 0) Pre-slam subterranean compression tremor (0.00..0.09s)
      if (t < T_SLAM) {
        for (tremorAcc += dt * 180; tremorAcc >= 1; tremorAcc--) {
          ps.spawn(P.GRIT, R.range(-34, 36), -1, R.range(-22, 28), -R.range(42, 115), R.range(0.35, 0.72), R.pick([S[7], S[6], S[5]]), R.chance(0.45) ? 2 : 1);
        }
      }

      // 1) COLOSSAL RELEASE SLAM AT ORIGIN (t = T_SLAM):
      // Violently catapults multi-scale shattered rocks high into open dark sky ("震地波释放时会震起碎石")!
      if (!slammed && t >= T_SLAM) {
        slammed = true;
        addSafeLight(0, -24, 74, WHITE, 1.0, 0.13);
        addSafeLight(0, -18, 74, GL[4], 0.88, 0.40);
        flashes.push({ x: 0, power: 1.05, life: 0.36, max: 0.36 });

        for (let i = 0; i < 9; i++) {
          const u = i / 8;
          const vx = lerp(-68, 175, u) + R.range(-12, 12);
          const vy = -R.range(250, 350) * (1 - 0.18 * Math.abs(u - 0.45));
          spawnBoulder(R.range(-12, 12), -8, vx, vy, 2, true, 0.95, 0.74);
        }
        for (let i = 0; i < 16; i++) {
          const a = -Math.PI / 2 + R.range(-0.72, 0.92);
          const sp = R.range(185, 335);
          spawnBoulder(R.range(-14, 14), -5, Math.cos(a) * sp, Math.sin(a) * sp, 1, i < 8, 0.60, 0.86);
        }
        for (let i = 0; i < 18; i++) {
          const a = -Math.PI / 2 + R.range(-0.92, 1.08);
          const sp = R.range(135, 340);
          spawnBoulder(R.range(-16, 16), -3, Math.cos(a) * sp, Math.sin(a) * sp, 0, false, 0, 1);
        }
        for (let i = 0; i < 80; i++) {
          const a = -Math.PI / 2 + R.range(-1.0, 1.12), sp = R.range(115, 335);
          ps.spawn(P.GRIT, R.range(-16, 16), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.7, 1.5), R.pick([S[7], S[6], S[5], S[4]]), R.chance(0.45) ? 2 : 1);
        }
        for (let i = 0; i < 34; i++) {
          const a = -Math.PI / 2 + R.range(-1.15, 1.22), sp = R.range(165, 390);
          ps.spawn(P.SPARK, R.range(-6, 6), -3, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.18, 0.46), i % 3 === 0 ? WHITE : GL[5], i % 4 === 0 ? 2 : 1);
        }
        for (let i = 0; i < 10; i++) {
          const sd = i % 2 === 0 ? -1 : 1;
          addPuff(sd * R.range(4, 20), -R.range(3, 12), sd * R.range(24, 80), -R.range(14, 52), R.range(5, 8), R.range(10, 14), R.range(1.0, 1.65), i < 5 ? 1 : 0);
        }
      }

      // 2) TRAVELING SUPERSONIC SHOCKWAVE WAKE (T_SLAM .. T_HIT)
      if (t >= T_SLAM && t < T_HIT) {
        const wx = waveX(t), u = waveU(t);
        for (wakeAcc += dt * 135; wakeAcc >= 1; wakeAcc--) {
          if (R.chance(0.22)) {
            const vx = R.range(25, 140), vy = -R.range(215, 325);
            spawnBoulder(wx - R.range(0, 10), -6, vx, vy, R.chance(0.45) ? 2 : 1, true, 0.70, 0.78);
          } else if (R.chance(0.36)) {
            const a = -Math.PI / 2 + R.range(-0.45, 0.78), sp = R.range(140, 285);
            spawnBoulder(wx - R.range(0, 8), -3, Math.cos(a) * sp, Math.sin(a) * sp, 0, false, 0, 1);
          }
          ps.spawn(P.GRIT, wx + R.range(-8, 4), -1, R.range(25, 155), -R.range(95, 255) * (0.75 + 0.45 * u), R.range(0.55, 1.25), R.pick([S[7], S[6], S[5]]), R.chance(0.4) ? 2 : 1);
          if (R.chance(0.44)) {
            addPuff(wx - R.range(4, 16), -R.range(3, 14), R.range(16, 68), -R.range(10, 44), R.range(4, 7), R.range(8, 13), R.range(0.85, 1.45), R.chance(0.42) ? 1 : 0);
          }
          if (R.chance(0.40)) {
            ps.spawn(P.SPARK, wx, -R.range(2, 26), R.range(55, 220), -R.range(35, 180), R.range(0.14, 0.32));
          }
        }
      }

      // 3) TARGET HIT-RESULT CATACLYSM AT (HIT_X, HIT_Y)!
      if (!hitFired && t >= T_HIT) {
        hitFired = true;
        addSafeLight(HIT_X, HIT_Y, 82, WHITE, 1.0, 0.14);
        addSafeLight(HIT_X, -36, 82, GL[4], 0.92, 0.48);
        flashes.push({ x: HIT_X, power: 1.45, life: 0.48, max: 0.48 });

        // 6 High-altitude hero target-shatter plates framing the upper sky around the monolith!
        const heroAngles = [-2.25, -1.85, -1.25, -0.95, -0.58, -0.32];
        for (const ha of heroAngles) {
          const sp = R.range(215, 285);
          spawnBoulder(HIT_X + Math.cos(ha) * 7, HIT_Y + Math.sin(ha) * 7, Math.cos(ha) * sp * 0.78 + 18, Math.sin(ha) * sp - 35, 2, true, 1.0, 0.76);
        }
        // 18 Radial + Blow-Through medium/small shrapnel chunks
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * TAU + R.range(-0.08, 0.08);
          const sp = Math.sin(a) < 0 ? R.range(175, 295) : R.range(125, 215);
          spawnBoulder(HIT_X + Math.cos(a) * 6, HIT_Y + Math.sin(a) * 6, Math.cos(a) * sp * 0.72 + 28, Math.sin(a) * sp - 42, i % 2 === 0 ? 1 : 0, true, 0.85, 0.85);
        }
        for (let i = 0; i < 78; i++) {
          const a = R.range(0, TAU), sp = R.range(140, 385);
          ps.spawn(P.SPARK, HIT_X, HIT_Y, Math.cos(a) * sp * 0.85 + 22, Math.sin(a) * sp, R.range(0.18, 0.46), i % 3 === 0 ? WHITE : GL[5], i % 3 === 0 ? 2 : 1);
        }
        for (let i = 0; i < 50; i++) {
          const a = -Math.PI / 2 + R.range(-1.15, 1.15), sp = R.range(115, 315);
          ps.spawn(P.GRIT, HIT_X + R.range(-12, 12), -3, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.75, 1.5), R.pick([S[7], S[6], S[5], S[4]]), R.chance(0.45) ? 2 : 1);
        }
        for (let i = 0; i < 14; i++) {
          const sd = i % 2 === 0 ? -1 : 1;
          const high = i < 6;
          addPuff(
            HIT_X + sd * R.range(4, 20),
            high ? -R.range(22, 72) : -R.range(3, 14),
            sd * (high ? R.range(18, 56) : R.range(38, 96)),
            high ? -R.range(35, 92) : -R.range(8, 28),
            R.range(6, 9),
            R.range(11, 15),
            R.range(1.15, 1.85),
            i < 8 ? 1 : 0
          );
        }
      }

      // 4) CRAG ERUPTIONS & PROGRESSIVE SPLIT-CRUMBLE-SINK
      for (const c of crags) {
        if (!c.erupted && t >= c.t0) {
          c.erupted = true;
          addSafeLight(c.x, -18, 38, GL[4], 0.48, 0.20);
          flashes.push({ x: c.x, power: 0.42, life: 0.20, max: 0.20 });
          const nBurst = c.isTarget ? 4 : 2;
          for (let i = 0; i < nBurst; i++) {
            const a = -Math.PI / 2 + R.range(-0.60, 0.60), sp = R.range(145, 275);
            spawnBoulder(c.x + R.range(-8, 8), -8, Math.cos(a) * sp, Math.sin(a) * sp, i === 0 && c.w >= 32 ? 2 : 1, false, 0.45, 0.9);
          }
        }

        if (c.erupted && t >= T_CRACK && t < c.tSplit && R.chance(dt * 14)) {
          const u = R.range(0.15, c.maxClip * 0.85);
          ps.spawn(P.GRIT, c.x + c.lean * u + R.range(-4, 4), -u * c.H, R.range(-24, 24), -R.range(5, 35), R.range(0.5, 0.95), R.pick([S[6], S[5], S[4]]), 1);
        }

        if (!c.splitFired && t >= c.tSplit) {
          c.splitFired = true;
          addSafeLight(c.x, -c.H * c.maxClip * 0.5, 42, GL[4], 0.54, 0.20);
          flashes.push({ x: c.x, power: 0.50, life: 0.20, max: 0.20 });
          addPuff(c.x + c.lean * 0.4, -c.H * c.maxClip * 0.45, R.range(-26, 26), -R.range(10, 34), 5, 10, R.range(0.8, 1.25), 1);

          // Smaller fangs (< 28px wide) burst directly into tumbling boulders above their sinking stump!
          if (!c.twoHalf) {
            for (let k = 0; k < 4; k++) {
              const um = lerp(c.cut, c.maxClip, (k + 0.5) / 4);
              spawnBoulder(c.x + c.lean * um, -um * c.H, R.range(-65, 75), -R.range(25, 95), k === 0 ? 1 : 0, false, 0.35, 1);
            }
            c.top = c.cut;
          }
        }

        if (c.twoHalf && t >= c.tSplit) {
          const targetTop = lerp(c.maxClip, c.cut, ease.inQuad(clamp((t - c.tSplit) / c.fallDur)));
          while (c.top - targetTop > 0.09 || (targetTop <= c.cut + 1e-5 && c.top > c.cut + 1e-5)) {
            const u1 = c.top, u0 = Math.max(targetTop, c.top - 0.15);
            const um = (u0 + u1) * 0.5;
            for (const half of [-1, 1]) {
              const rx = c.x + c.lean * um + half * (c.w * 0.22);
              const ry = -um * c.H;
              spawnBoulder(rx, ry, half * R.range(18, 76) + c.lean * 0.6, -R.range(20, 98), c.w >= 32 && R.chance(0.42) ? 2 : R.chance(0.6) ? 1 : 0, false, 0.35, 1);
              ps.spawn(P.GRIT, rx, ry, half * R.range(12, 60), -R.range(15, 85), Math.min(R.range(0.55, 1.0), T_END - 0.12 - t), R.pick([S[6], S[5], S[4]]), 1);
            }
            c.top = u0;
            if (u0 <= c.cut + 1e-5) break;
          }
        }
      }

      // Update scalloped dust puffs
      for (let i = puffs.length - 1; i >= 0; i--) {
        const q = puffs[i];
        q.age += dt;
        if (q.age >= q.life) {
          puffs.splice(i, 1);
          continue;
        }
        q.vx -= q.vx * 2.5 * dt;
        q.vy -= q.vy * 1.6 * dt + 6 * dt;
        q.x += (q.vx + Math.sin(t * 2.1 + q.ph) * 4) * dt;
        q.y += q.vy * dt;
        if (q.x < X_MIN + 18 || q.x > X_MAX - 18 || q.y < Y_MIN + 18) puffs.splice(i, 1);
      }

      // Update airborne boulders & spawn secondary bounce dust puffs
      for (const b of bits.list) {
        b.pvy = b.vy;
        if (b.hot > 0) b.hot = Math.max(0, b.hot - dt * 1.15);
      }
      bits.update(dt);
      for (let i = bits.list.length - 1; i >= 0; i--) {
        const b = bits.list[i];
        if (b.x < X_MIN + 14 || b.x > X_MAX - 14 || b.y < Y_MIN + 14) {
          bits.list.splice(i, 1);
          continue;
        }
        if (b.pvy > 95 && b.vy <= 0 && !b.bounced && t < T_END - 0.40) {
          b.bounced = true;
          addPuff(b.x, -2, R.sign() * R.range(10, 32), -R.range(4, 16), 2.5, 5.5, R.range(0.35, 0.62), 0);
        }
      }

      ps.update(dt);
      for (let i = ps.list.length - 1; i >= 0; i--) {
        const q = ps.list[i];
        if (q.x < X_MIN + 4 || q.x > X_MAX - 4 || q.y < Y_MIN + 4 || q.y > Y_MAX - 4) ps.list.splice(i, 1);
      }
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-6) return;
      const endFade = 1 - smooth(T_END - 0.68, T_END - 0.06, t);

      // 1) Deep subterranean tectonic fault fissures splitting into the brick ground cross-section (y = 1..+34)!
      const faultReach = t < T_SLAM ? lerp(-24, 28, t / T_SLAM) : t < T_HIT ? waveX(t) + 22 : HIT_X + 44;
      const faultHeat = t < T_HIT ? 1.0 : Math.max(0, 1 - (t - T_HIT) / 1.65);

      if (endFade > 0.02) {
        const xLeft = -34, xRight = Math.min(X_MAX - 16, Math.round(faultReach));
        if (xRight > xLeft) {
          p.rect(xLeft, 0, xRight - xLeft, 3, S[0], endFade * 0.92);
          if (faultHeat > 0.06) {
            p.line(xLeft + 4, 1, xRight - 2, 1, faultHeat > 0.6 ? GL[5] : faultHeat > 0.3 ? GL[3] : GL[1], endFade * faultHeat);
          }
        }

        for (const sf of subFaults) {
          if (sf.x0 > faultReach) continue;
          const localAge = t - (sf.x0 <= 0 ? 0 : timeAtX(sf.x0));
          if (localAge <= 0) continue;
          const grow = clamp(localAge / 0.14);
          const nPts = Math.max(1, Math.floor(sf.pts.length * grow));
          const h = faultHeat * (sf.isMajor ? 1.0 : 0.78);
          for (let k = 1; k < nPts; k++) {
            const [x0, y0] = sf.pts[k - 1], [x1, y1] = sf.pts[k];
            const depthQ = k / sf.pts.length;
            const hotQ = h * (1 - depthQ * 0.55);
            p.line(x0 + 1, y0, x1 + 1, y1, S[0], endFade * 0.85);
            const col = hotQ > 0.65 ? GL[5] : hotQ > 0.38 ? GL[4] : hotQ > 0.16 ? GL[2] : S[1];
            p.line(x0, y0, x1, y1, col, endFade * (0.65 + 0.35 * hotQ));
          }
        }

        if (t >= T_SLAM) {
          p.ellipse(0, 1, 26, 4.5, S[0], endFade * 0.92);
          if (faultHeat > 0.12) p.glow(0, 4, 22, GL[3], 0.28 * faultHeat * endFade);
        }
        if (t >= T_HIT) {
          p.ellipse(HIT_X, 1, 38, 6.0, S[0], endFade * 0.95);
          if (faultHeat > 0.12) p.glow(HIT_X, 5, 28, GL[3], 0.34 * faultHeat * endFade);
        }
      }

      // 2) Far half of release & target perspective ground shockwave bands
      if (t >= T_SLAM && t < T_SLAM + 0.34) {
        const u = (t - T_SLAM) / 0.34;
        drawShockBand(p, 0, 0.5, 10 + 62 * ease.outCubic(u), SY, 3.4 * (1 - u * 0.65), (1 - u) * 0.88, [S[3], GL[3], GL[4], GL[5]], true, X_MIN + 8, X_MAX - 8, u < 0.25);
      }
      if (t >= T_HIT && t < T_HIT + 0.46) {
        const u = (t - T_HIT) / 0.46;
        drawShockBand(p, HIT_X, 0.5, 14 + 92 * ease.outQuart(u), SY, 4.8 * (1 - u * 0.68), 1 - u, [S[3], GL[3], GL[4], GL[5]], true, X_MIN + 8, X_MAX - 8, u < 0.3);
      }

      // 3) Back-layer scalloped dust billows
      for (let idx = 0; idx < puffs.length; idx += 2) {
        drawOnePuff(p, puffs[idx], endFade);
      }

      // 4) Darker back-layer flanking crags
      for (const c of crags) {
        if (c.backLayer) drawOneCrag(p, c, endFade);
      }

      // 5) Heaved tilted bedrock floor slabs
      for (const pl of plates) {
        if (t < pl.t0) continue;
        const age = t - pl.t0;
        const pop = age < 0.12 ? ease.outBack(age / 0.12) : Math.max(0.28, 1 - (age - 0.12) * 0.34);
        const sink = smooth(T_SPLIT + 0.30, T_END - 0.18, t);
        const lift = pl.lift * pop * (1 - sink);
        if (lift <= 0.4) continue;
        const ang = pl.tilt * pop * (1 - sink * 0.65);
        const ca = Math.cos(ang), sa = Math.sin(ang), hw = pl.w * 0.5;
        const x0 = pl.x - hw * ca, y0 = -lift - hw * sa;
        const x1 = pl.x + hw * ca, y1 = -lift + hw * sa;
        for (let th = pl.thick; th >= 1; th--) {
          p.line(x0, y0 + th, x1, y1 + th, th === pl.thick ? S[0] : S[2], endFade);
        }
        p.line(x0, y0, x1, y1, S[7], endFade);
      }

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;
      const endFade = 1 - smooth(T_END - 0.68, T_END - 0.06, t);

      // 1) Near half of perspective ground shockwave bands
      if (t >= T_SLAM && t < T_SLAM + 0.34) {
        const u = (t - T_SLAM) / 0.34;
        drawShockBand(p, 0, 0.5, 10 + 62 * ease.outCubic(u), SY, 3.4 * (1 - u * 0.65), (1 - u) * 0.88, [S[3], GL[3], GL[4], GL[5]], false, X_MIN + 8, X_MAX - 8, u < 0.25);
      }
      if (t >= T_HIT && t < T_HIT + 0.46) {
        const u = (t - T_HIT) / 0.46;
        drawShockBand(p, HIT_X, 0.5, 14 + 92 * ease.outQuart(u), SY, 4.8 * (1 - u * 0.68), 1 - u, [S[3], GL[3], GL[4], GL[5]], false, X_MIN + 8, X_MAX - 8, u < 0.3);
      }

      // 2) FOREGROUND HERO BEDROCK CRAGS & COLOSSAL TARGET MONOLITH
      for (const c of crags) {
        if (!c.backLayer) drawOneCrag(p, c, endFade);
      }

      // 3) TRIPLE-LAYERED SUPERSONIC SEISMIC SHOCKWAVE PLOW + BULGING CRUST MOUND!
      if (t >= T_SLAM && t < T_HIT + 0.12) {
        const u = waveU(t);
        const over = Math.max(0, (t - T_HIT) / 0.12);
        const wx = t < T_HIT ? waveX(t) : HIT_X + over * 28;
        const h = lerp(58, 128, Math.pow(u, 0.80)) * (1 - over * 0.42);
        const w = lerp(10, 22, u) * (1 - over * 0.65);
        const k = 1 - over;

        const mw = Math.round(lerp(18, 28, u)), mh = Math.round(lerp(8, 15, u) * k);
        if (mh >= 2) {
          for (let dx = -mw; dx <= 8; dx++) {
            const qx = dx < 0 ? dx / mw : dx / 8;
            const ch = Math.round(mh * (1 - qx * qx));
            if (ch <= 0) continue;
            p.line(wx + dx, 0, wx + dx, -ch, dx > 2 ? GL[4] : dx > -6 ? S[6] : S[2], k);
            p.dot(wx + dx, -ch - 1, S[0], k);
            if ((dx & 3) === 0 && ch > 4) p.dot(wx + dx, -Math.floor(ch * 0.45), GL[5], k);
          }
        }

        frontCrescent(p, wx - 14, 1, h * 0.94, w * 1.45, [S[6], S[4], S[2]], k * 0.74);
        frontCrescent(p, wx - 6, 1, h * 0.90, w * 1.25, [GL[4], GL[3], GL[1]], k * 0.92);
        frontCrescent(p, wx, 1, h, w, [WHITE, GL[5], GL[4]], k);

        if (over < 0.6) {
          for (let s = 0; s < 7; s++) {
            const sy = -h * (0.12 + s * 0.13);
            const len = (24 + (s % 3) * 18) * (0.65 + 0.45 * u) * k;
            const xTip = wx - 3 - s * 2;
            p.line(xTip - len, sy, xTip, sy, s % 2 === 0 ? WHITE : GL[5], k * 0.82);
          }
        }

        if (t < T_SLAM + 0.28) {
          const bu = (t - T_SLAM) / 0.28;
          frontCrescent(p, -10 - bu * 36, -1, 42 * (1 - bu * 0.45), 8 * (1 - bu * 0.75), [WHITE, GL[5], GL[3]], 1 - bu);
        }
      }

      // 4) Front-layer scalloped dust billows
      for (let idx = 1; idx < puffs.length; idx += 2) {
        drawOnePuff(p, puffs[idx], endFade);
      }

      // 5) MULTI-SCALE AIRBORNE SHATTERED ROCKS
      for (const b of bits.list) {
        const a = clamp(b.life / 0.32) * endFade;
        if (a <= 0.02) continue;
        const sp = Math.hypot(b.vx, b.vy);
        if (b.streak && sp > 145 && b.life > b.maxLife - 0.34) {
          const ux = b.vx / sp, uy = b.vy / sp, sl = Math.min(22, sp * 0.055);
          p.line(b.x - ux * sl, b.y - uy * sl, b.x - ux * 3, b.y - uy * 3, b.arch >= 4 ? GL[5] : S[6], a * 0.78);
        }
        const flashW = b.life > b.maxLife - 0.036;
        if (b.arch >= 0) {
          rockArchetypes[b.arch].draw(p, b.x, b.y, b.a, a, flashW, b.hot);
        } else {
          drawCobble(p, b.x, b.y, b.cobble, S, a);
        }
      }

      ps.draw(p, "front");

      // 6) ORIGIN RELEASE IMPACT STAR (t = T_SLAM .. T_SLAM + 0.11s)
      if (t >= T_SLAM && t < T_SLAM + 0.11) {
        const u = (t - T_SLAM) / 0.11;
        p.disc(0, -6, 16 * (1 - u * 0.45), S[0], (1 - u) * 0.78);
        star(p, 0, -6, slamStar, 0.82 + 0.42 * ease.outCubic(u), 1.15 - u * 0.78, [S[0], GL[4], GL[5], WHITE], 1 - u * 0.4, 3.8);
      }

      // 7) HIGH-CONTRAST TARGET HIT-RESULT CATACLYSM + BLOW-THROUGH SHOCK CONE AT (HIT_X, HIT_Y)!
      if (t >= T_HIT && t < T_HIT + 0.48) {
        const ha = t - T_HIT;

        // Obsidian pressure-collapse shock halo behind the bright hit-star for 100% silhouette contrast!
        if (ha < 0.16) {
          const vu = ha / 0.16;
          p.disc(HIT_X, HIT_Y, (28 + 24 * ease.outCubic(vu)) * (1 - vu * 0.35), S[0], (1 - vu) * 0.88);
        }

        // Blow-through exit shockwave cone blasting out behind the target (HIT_X + 18 .. HIT_X + 86)!
        if (ha < 0.28) {
          const eu = ha / 0.28;
          const ex = HIT_X + 16 + 68 * ease.outQuart(eu);
          frontCrescent(p, ex, 1, 78 - 28 * eu, 12 * (1 - eu * 0.75), [WHITE, GL[5], GL[3]], 1 - eu);
        }

        // Dual shattering shockwave domes around the hit body point!
        const ru1 = clamp(ha / 0.40);
        brokenRing(p, HIT_X, HIT_Y, 18 + 72 * ease.outQuart(ru1), 6.6 * (1 - ru1 * 0.72), ringSegsA, ru1 * 0.92, WHITE, GL[4], 1 - ru1, 0.88, 0);

        if (ha > 0.035) {
          const ru2 = clamp((ha - 0.035) / 0.42);
          brokenRing(p, HIT_X, HIT_Y, 14 + 50 * ease.outCubic(ru2), 4.4 * (1 - ru2 * 0.7), ringSegsB, ru2 * 0.88, GL[5], S[7], (1 - ru2) * 0.9, 0.88, 0);
        }

        // Thick obsidian-rimmed tectonic hit-star + cross-fracture cleaves + persistent 3-frame void pupil!
        if (ha < 0.18) {
          const su = ha / 0.18;
          const clLen = (36 + 26 * ease.outExpo(su)) * (1 - su * 0.25);
          for (const ang of [-0.40, 0.34]) {
            const ca = Math.cos(ang), sa = Math.sin(ang);
            p.line(HIT_X - ca * clLen, HIT_Y - sa * clLen - 1, HIT_X + ca * clLen, HIT_Y + sa * clLen - 1, S[0], 1 - su * 0.5);
            p.line(HIT_X - ca * clLen, HIT_Y - sa * clLen, HIT_X + ca * clLen, HIT_Y + sa * clLen, su < 0.4 ? WHITE : GL[5], 1 - su * 0.35);
          }

          star(p, HIT_X, HIT_Y, hitStar, 0.76 + 0.50 * ease.outCubic(su), 1.25 - su * 0.82, [S[0], GL[4], GL[5], WHITE], 1 - su * 0.35, 5.4);

          if (ha < 0.11) {
            const pu = 1 - ha / 0.11;
            p.circle(HIT_X, HIT_Y, 8.5 * pu, S[0], 1);
            p.circle(HIT_X, HIT_Y, 3.6 * pu, WHITE, 1);
          }
        }
      }

      lights.draw(p);
    },
  };

  function drawOneCrag(p, c, endFade) {
    if (t < c.t0) return;
    const age = t - c.t0;
    const grow = age < 0.13 ? ease.outBack(age / 0.13) : 1;

    if (t < c.tSplit) {
      const crackProgress = smooth(T_CRACK, c.tSplit - 0.03, t);
      const heat = smooth(T_CRACK + 0.05, c.tSplit, t);
      const white = age < 0.036 || t > c.tSplit - 0.036;

      if (grow === 1 && !white && endFade > 0.99) {
        const shk = heat > 0 ? Math.round(Math.sin(t * 72 + c.x) * 1.5 * heat) : 0;
        const b = c.baked;
        for (let i = 0; i < b.length; i += 3) p.px(b[i] + shk, b[i + 1], b[i + 2]);
        if (crackProgress > 0.02) drawCragCracks(p, c, shk, crackProgress, heat, GL, S[0]);
        return;
      }

      drawSpike(p, c.x, 0, c.H * grow, c.w, c.lean * Math.min(1, grow), c.look, c.pal, {
        a: endFade,
        clip: c.maxClip,
        floor: 0,
        white,
        cracks: c.cracks,
        crack: crackProgress,
        heat,
        glowRamp: GL,
      });
    } else if (!c.twoHalf) {
      // Fast sinking stump for smaller flanking fangs!
      const sink = Math.round(smooth(c.tSplit + 0.08, c.tSplit + 0.42, t) * c.H * (c.cut + 0.08));
      if (sink < c.H * (c.cut + 0.06)) {
        const b = c.stumpBaked;
        for (let i = 0; i < b.length; i += 3) {
          const py = b[i + 1] + sink;
          if (py <= 0) p.dot(b[i], py, b[i + 2], endFade);
        }
      }
    } else {
      const splitAge = t - c.tSplit;
      const gp = 8 * ease.outCubic(clamp(splitAge / 0.28));
      const tp = 12 * ease.inQuad(clamp(splitAge / 0.35));
      const sink = smooth(c.tSplit + c.fallDur, c.tSplit + c.fallDur + c.sinkDur, t) * c.H * (c.cut + 0.08);
      if (sink < c.H * (c.cut + 0.06)) {
        const coolHeat = 1 - smooth(c.tSplit, c.tSplit + 0.36, t);
        for (const half of [-1, 1]) {
          drawSpike(p, c.x + half * gp * 0.5, sink, c.H, c.w, c.lean + half * tp, c.look, c.pal, {
            a: endFade,
            half,
            clip: c.top,
            floor: 0,
            cracks: c.cracks,
            crack: 1,
            heat: coolHeat,
            glowRamp: GL,
          });
        }
      }
    }
  }

  function drawOnePuff(p, q, endFade) {
    const u = q.age / q.life;
    const r = clamp(Math.round(lerp(q.r0, q.r1, 1 - Math.pow(1 - u, 2.3))), 1, 15);
    const lut = PUFF_LUTS[r];
    if (!lut.length) return;
    const cut = 1.0 - Math.pow(u, 1.35) * 0.86;
    const op = Math.min(1, u * 10) * (1 - smooth(0.66, 1, u)) * 0.86 * endFade;
    if (op <= 0.03) return;

    let warm = 0;
    for (let f = 0; f < flashes.length; f++) {
      const fl = flashes[f];
      const dx = Math.abs(q.x - fl.x);
      if (dx < 88) warm += fl.power * (fl.life / fl.max) * (1 - dx / 88);
    }
    const c2 = warm > 0.5 ? GL[4] : warm > 0.2 ? DUST_HI : q.bright ? DUST_HI : S[6];
    const c1 = warm > 0.55 ? mix(DUST_MID, GL[3], 0.42) : DUST_MID;
    const cx = Math.round(q.x), cy = Math.round(q.y);
    const sx0 = p.cellX(cx, 0), sy0 = p.cellY(0, cy), fx = p.fx;

    for (let k = 0; k < lut.length; k += 4) {
      const edgeQ = lut[k + 2];
      if (edgeQ > cut) continue;
      const dy = lut[k + 1];
      if (cy + dy > 1) continue;
      const zone = lut[k + 3];
      const col = zone === 2 ? c2 : zone === 1 ? c1 : DUST_LO;
      p.blendPx(sx0 + lut[k] * fx, sy0 + dy, col, op * (edgeQ > cut * 0.84 ? 0.62 : 1));
    }
  }
}
