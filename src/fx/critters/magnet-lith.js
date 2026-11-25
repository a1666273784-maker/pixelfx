// Magnet Lith ("critters/magnet-lith" — 【磁力石灵小怪物特效】):
// An ancient-ruin magnetic stone elemental showcasing four action states across a 4.8s loop (`loop: true`):
// 1. 【待机 Idle (0.00..1.05s)】: A levitating cyan energy core ("中心一颗悬浮的青色发光能量核") hovers in mid-air while
//    four angular rune-carved black obsidian stones slowly orbit around it ("周围环绕着四块受磁力吸引的棱角黑石块做慢速公转"),
//    tethered to the core by flickering weak cyan electric arcs ("核心与石块之间的微弱电流连线").
// 2. 【移动 Move (1.05..2.02s)】: The four black stones snap behind the cyan core and spin at high speed like a turbine
//    thruster ("四块黑石聚拢在能量核后方高速旋转如同推进器"), blasting a cyan plasma jet to propel the core forward in a
//    high-speed dash ("推着核心向前冲刺").
// 3. 【攻击 Attack & Heavy Fist Shatter (2.02..3.38s)】: The black stones instantly lock together in front of the core
//    to assemble a colossal chiseled Obsidian Rock Fist ("周围的黑石块瞬间在身前拼接组合成一只巨大的岩石拳头"), smashing
//    forward wreathed in cyan lightning arcs ("带着青色电弧向前猛烈砸击") to shatter the target ground with glowing cracks,
//    shockwaves, and flying rock debris ("重拳命中的碎石震裂结果特效").
// 4. 【倒地 Collapse & Free-Fall Roll (3.38..4.80s)】: The central cyan energy core snaps and shatters into dissipating
//    crystal shards ("中心能量核啪地碎裂消散"), causing the four black stones to instantly lose magnetic support, drop
//    in free-fall onto the floor, and bounce/roll to a halt ("四块黑石瞬间失去磁力支撑直接自由落体砸在地面滚落的完整过程").
// Builds on ../scifi/energy-core.js, ../lightning/_lib.js, ../impacts/ground-slam.js, and ../impacts/_lib.js
// (adapted from Sprite Fusion's open-source VFX, MIT License, Copyright (c) 2026 Hugo Duprez).
import {
  Rng,
  fit,
  band,
  clamp,
  smooth,
  seg,
  ease,
  lerp,
  rng,
  cycle,
  TAU,
  WHITE,
} from "../../core/index.js";
import { Grid, shift, toss } from "./_lib.js";
import { zigzag, stroke } from "../lightning/_lib.js";
import {
  stone as makeStoneCols,
  spikes,
  star,
  brokenRing,
  makeCracks,
  drawCracks,
  frontCrescent,
  dustRing,
  rockShape,
  rock,
  SOOT,
} from "../impacts/_lib.js";

export const meta = {
  name: "Magnet lith",
  desc: "A cyan core orbited by four tethered black stones dashes on a spinning stone thruster, locks them into a lightning rock fist to shatter the floor, then shatters and drops.",
  tags: ["critter", "monster", "golem", "magnetic", "lightning", "rock", "ancient", "ruins", "loop"],
  size: [240, 124],
  origin: [104, 100],
  duration: 4.8,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // 7-step Ancient Cyan Energy Core & Magnetic Arc ramp ("青色发光能量核" / "青色电弧")
    palette: ["#051824", "#0b3854", "#146e9c", "#22b8e8", "#58f4ff", "#b8ffff", "#ffffff"],
    // 6-step Angular Obsidian Black Stone ramp ("棱角黑石块")
    stone: ["#07080e", "#121520", "#212638", "#373f5a", "#566286", "#8694b6"],
    // 5-step Ancient Ruin Gold/Bronze Rune accent ramp
    rune: ["#1a140c", "#463418", "#886428", "#cfa044", "#ffe08c"],
    seed: 1,
  },
};

const D = meta.duration;

// 4-Stage Choreography Timestamps (aligned so all 16 contact-sheet frames hit key poses!):
// 0.00..1.05s (frames 0, 10, 19, 29)  : State 1 — IDLE (levitating cyan core + 4 slow-orbiting angular black stones + weak electric tethers)
// 1.05..2.02s (frames 38, 48, 57)     : State 2 — MOVE (38: stones gather behind core spinning fast; 48 & 57: high-speed thruster dash)
// 2.02..3.38s (frames 67, 76, 86, 95) : State 3 — ATTACK (67: giant rock fist assembled in front; 76: lightning-wreathed fist smash in flight; 86: fist slams crater with cracks/shockwave/rocks; 95: stones recoil over shattered ground)
// 3.38..4.80s (frames 105, 114, 124, 133, 143): State 4 — DOWN (105: core shatters into flying shards; 114: stones free-fall & bounce on floor; 124: stones roll outward kicking up dust; 133: stones settled dead on floor; 143: ruin revival)
const T_MOVE = 1.05;
const T_THRUST = 1.24;
const T_DASH_END = 1.94;
const T_ATK = 2.02;
const T_FIST_LOCK = 2.14;
const T_PUNCH = 2.38;
const T_IMPACT = 2.58;
const T_FIST_HOLD = 2.90;
const T_KO = 3.38;
const T_SHATTER = 3.40;
const T_REVIVE = 4.58;

const X_IDLE = -54;
const X_ATK = -18;
const X_HIT = 50;
const Y_CORE = -30;

const GRID = new Grid(-96, -84, 224, 92);

// 4 Distinct Angular Black Stone Templates: polygonal vertices [angle, radius] + rune type
const STONE_SHAPES = [
  // Stone 0: Chiseled dorsal obelisk shard (5 sharp vertices)
  {
    r: 8.2,
    verts: [
      [-1.57, 1.18],
      [-0.35, 0.92],
      [0.65, 1.08],
      [2.15, 0.95],
      [-2.55, 0.90],
    ],
    rune: "diamond",
  },
  // Stone 1: Heavy trapezoidal monolith block (6 angular vertices)
  {
    r: 7.8,
    verts: [
      [-1.80, 1.05],
      [-0.55, 1.12],
      [0.40, 0.88],
      [1.25, 1.06],
      [2.35, 0.96],
      [-2.70, 0.86],
    ],
    rune: "chevron",
  },
  // Stone 2: Jagged rhomboid ruin wedge (5 vertices)
  {
    r: 8.0,
    verts: [
      [-1.40, 1.14],
      [-0.20, 0.86],
      [0.85, 1.12],
      [2.05, 0.92],
      [-2.45, 1.02],
    ],
    rune: "cross",
  },
  // Stone 3: Angular hexagonal keystone fragment (6 vertices)
  {
    r: 7.6,
    verts: [
      [-1.65, 1.04],
      [-0.50, 0.96],
      [0.50, 1.10],
      [1.55, 0.94],
      [2.55, 1.06],
      [-2.60, 0.90],
    ],
    rune: "tridot",
  },
];

// Precompute impact cracks (shifted to X_HIT!), starburst spikes, broken ring segments, and flying rock debris per seed
const cache = new Map();
function getImpactScene(seed, stoneHex) {
  const key = `${seed}:${stoneHex}`;
  if (cache.has(key)) return cache.get(key);
  const R = new Rng(seed * 97 + 13);
  const stCols = makeStoneCols(stoneHex);
  const rawCracks = makeCracks(R, 12, { len: [18, 44], dive: 0.58, maxY: 15, forks: 0.70, x0: [2, 8] });
  const cracks = rawCracks.map((c) => ({
    ...c,
    pts: c.pts.map(([x, y, d]) => [x + X_HIT, y, d]),
    kids: c.kids.map((k) => k.map(([x, y, d]) => [x + X_HIT, y, d])),
  }));
  const hitSpikes = spikes(R, 14, -0.32, { len: [11, 24], w: [1.7, 2.6], fwd: 1.5, back: 0.7, jag: 0.55 });
  const ringSegs = Array.from({ length: 8 }, (_, i) => ({
    a: (i / 8) * TAU + R.range(-0.1, 0.1),
    gap: R.range(0.35, 0.72),
    dr: R.range(0.08, 0.32),
    w: R.range(0.8, 1.3),
  }));
  const rocks = Array.from({ length: 20 }, (_, i) => {
    const big = i < 7;
    const ang = -Math.PI / 2 + R.range(-0.92, 0.82);
    const sp = big ? R.range(95, 165) : R.range(120, 200);
    return {
      x0: R.range(-7, 7),
      y0: -2,
      vx: clamp(Math.cos(ang) * sp + R.range(-10, 6), -88, 72),
      vy: Math.sin(ang) * sp,
      g: 520,
      e: R.range(0.36, 0.48),
      s: big ? R.range(2.5, 3.6) : R.range(1.4, 2.3),
      a0: R.range(0, TAU),
      va: R.sign() * R.range(8, 18),
      life: R.range(0.70, 0.96),
      pts: rockShape(R, 6),
    };
  });
  const val = { stCols, cracks, hitSpikes, ringSegs, rocks };
  cache.set(key, val);
  return val;
}

// Compute the state of the central Cyan Energy Core and the 4 Angular Black Stones at time `t`
function computeState(t) {
  let coreX = X_IDLE;
  let coreY = Y_CORE;
  let coreAlive = true;
  let coreRadius = 8.2;
  let corePulse = 0.5 + 0.5 * Math.sin((t / D) * TAU * 6);
  let coreCrack = 0;         // 0..1 pre-shatter fracture lines
  let tetherStrength = 0.48; // 0..1 intensity of electric tether lines between core and stones
  let runeGlow = 1.0;        // 0..1 cyan rune glow on the 4 black stones
  let fistBlend = 0;         // 0 = 4 individual stones .. 1 = locked into the Giant Obsidian Rock Fist
  let fistX = 0;
  let fistY = 0;
  let fistAngle = 0;
  let thrusterPow = 0;

  // Each of the 4 stones: { x, y, z, rot }
  const stones = [
    { x: 0, y: 0, z: 0, rot: 0 },
    { x: 0, y: 0, z: 0, rot: 0 },
    { x: 0, y: 0, z: 0, rot: 0 },
    { x: 0, y: 0, z: 0, rot: 0 },
  ];

  if (t < T_MOVE) {
    // =========================================================================
    // STATE 1: 【待机 IDLE (0.00..1.05s)】
    // Central levitating cyan energy core + 4 angular black stones slowly orbiting + weak electric tethers
    // =========================================================================
    const u = t / T_MOVE;
    const bob = Math.sin(u * TAU * 2);
    coreX = X_IDLE;
    coreY = Y_CORE + 2.2 * bob;
    corePulse = 0.55 + 0.45 * Math.cos(u * TAU * 2);
    tetherStrength = 0.50;
    runeGlow = 0.85 + 0.15 * corePulse;

    const baseOrb = u * TAU * 0.65 + 0.35;
    for (let i = 0; i < 4; i++) {
      const a = baseOrb + (i / 4) * TAU;
      const tilt = i % 2 === 0 ? 0.38 : -0.32;
      const rx = 23.5;
      const ry = 14.0;
      const ox = Math.cos(a) * rx;
      const oy = Math.sin(a) * ry + Math.cos(a) * tilt * 5 + Math.sin(u * TAU * 2 + i * 1.5) * 1.5;
      const oz = Math.sin(a);
      stones[i].x = coreX + ox;
      stones[i].y = coreY + oy;
      stones[i].z = oz;
      stones[i].rot = Math.sin(u * TAU + i * 1.2) * 0.28 + ox * 0.012;
    }
  } else if (t < T_ATK) {
    // =========================================================================
    // STATE 2: 【移动 MOVE (1.05..2.02s)】
    // 4 black stones gather behind the core & spin at high speed like a thruster, pushing the core forward!
    // =========================================================================
    if (t < T_THRUST) {
      // 2A: Stones swing behind the core (`coreX - 17`) and spin up into a tight 4-blade thruster ring (1.05..1.24s)
      const u = seg(t, T_MOVE, T_THRUST);
      const eu = ease.inOutCubic(u);
      coreX = lerp(X_IDLE, X_IDLE - 3, eu);
      coreY = Y_CORE + 1.5 * u;
      coreRadius = 8.2 + 0.8 * eu;
      corePulse = 0.7 + 0.3 * eu;
      tetherStrength = lerp(0.50, 0.95, eu);
      thrusterPow = smooth(0.25, 1.0, u) * 0.85;

      const spinAng = u * u * TAU * 1.8;
      for (let i = 0; i < 4; i++) {
        const a0 = 0.65 * TAU + 0.35 + (i / 4) * TAU;
        const tilt0 = i % 2 === 0 ? 0.38 : -0.32;
        const x0 = X_IDLE + Math.cos(a0) * 23.5;
        const y0 = Y_CORE + Math.sin(a0) * 14.0 + Math.cos(a0) * tilt0 * 5;

        const ta = spinAng + (i / 4) * TAU;
        const tx = coreX - 17 + Math.sin(ta) * 4.0;
        const ty = coreY + Math.cos(ta) * 12.0;
        const tz = Math.sin(ta);

        stones[i].x = lerp(x0, tx, eu);
        stones[i].y = lerp(y0, ty, eu);
        stones[i].z = tz;
        stones[i].rot = ta + Math.PI * 0.5;
      }
    } else if (t < T_DASH_END) {
      // 2B: High-speed thruster dash pushing the cyan core forward (1.24..1.94s — covers Frames 38, 48, and 57!)
      //     ("四块黑石聚拢在能量核后方高速旋转如同推进器、推着核心向前冲刺")
      const u = seg(t, T_THRUST, T_DASH_END);
      const eu = ease.inOutQuad(u);
      coreX = lerp(X_IDLE - 3, X_ATK, eu);
      coreY = Y_CORE + 2.0 - 2.5 * Math.sin(u * Math.PI);
      coreRadius = 8.8;
      corePulse = 1.0;
      tetherStrength = 1.0;
      thrusterPow = 1.0;

      const spinAng = (0.5 + u * 4.5) * TAU;
      for (let i = 0; i < 4; i++) {
        const ta = spinAng + (i / 4) * TAU;
        stones[i].x = coreX - 17.5 + Math.sin(ta) * 4.0;
        stones[i].y = coreY + Math.cos(ta) * 12.0;
        stones[i].z = Math.sin(ta);
        stones[i].rot = ta * 1.5;
      }
    } else {
      // 2C: Whip stones from behind the core to the front assembly zone (1.94..2.02s)
      const u = seg(t, T_DASH_END, T_ATK);
      const eu = ease.outCubic(u);
      coreX = X_ATK;
      coreY = Y_CORE;
      coreRadius = 8.4;
      tetherStrength = 0.90;
      thrusterPow = (1 - eu) * 0.6;

      const spinAng = (5.0 + u * 0.5) * TAU;
      for (let i = 0; i < 4; i++) {
        const ta = spinAng + (i / 4) * TAU;
        const bx = coreX - 17.5 + Math.sin(ta) * 4.0;
        const by = coreY + Math.cos(ta) * 12.0;
        const frontOffsets = [
          [26, -8],
          [28, 5],
          [16, 10],
          [14, -5],
        ];
        stones[i].x = lerp(bx, coreX + frontOffsets[i][0], eu);
        stones[i].y = lerp(by, coreY + frontOffsets[i][1], eu);
        stones[i].z = 1;
        stones[i].rot = lerp(ta, 0, eu);
      }
    }
  } else if (t < T_KO) {
    // =========================================================================
    // STATE 3: 【攻击 ATTACK & HEAVY FIST SHATTER (2.02..3.38s)】
    // Stones lock in front into a Giant Obsidian Rock Fist & smash forward with cyan lightning arcs!
    // =========================================================================
    if (t < T_PUNCH) {
      // 3A: Assemble & lock into the Giant Rock Fist in front of the core (2.02..2.38s, Frame 67 at 2.23s!)
      //     ("周围的黑石块瞬间在身前拼接组合成一只巨大的岩石拳头")
      const lockU = clamp((t - T_ATK) / (T_FIST_LOCK - T_ATK), 0, 1);
      const chargeU = clamp((t - T_FIST_LOCK) / (T_PUNCH - T_FIST_LOCK), 0, 1);
      const tremor = Math.sin(t * 95) * 0.7 * chargeU;

      coreX = X_ATK - 6.0 * ease.outQuad(chargeU);
      coreY = Y_CORE - 2.0 * ease.outQuad(chargeU);
      coreRadius = 8.4 + 1.2 * chargeU;
      corePulse = 1.0;
      tetherStrength = 1.0;
      fistBlend = ease.outBack(lockU, 1.6);

      fistX = coreX + 32 - 3.0 * chargeU + tremor;
      fistY = coreY - 1.0 - 2.5 * chargeU;
      fistAngle = -0.16 * chargeU;

      const blockOffsets = [
        [7, -6],
        [7, 6],
        [-2, 9],
        [-8, -1],
      ];
      for (let i = 0; i < 4; i++) {
        const spread = 1 + (1 - lockU) * 1.4;
        stones[i].x = fistX + blockOffsets[i][0] * spread;
        stones[i].y = fistY + blockOffsets[i][1] * spread;
        stones[i].z = 1;
        stones[i].rot = fistAngle;
      }
    } else if (t < T_FIST_HOLD) {
      // 3B: Giant Rock Fist rockets forward & downward wreathed in cyan lightning arcs (`2.38..2.58s`, Frame 76 at `2.53s` is mid-flight!),
      //     and slams into `X_HIT = 50` at `T_IMPACT = 2.58s`, holding in the shattered crater through `2.90s` (Frame 86 at `2.87s`!)
      const smashU = clamp((t - T_PUNCH) / (T_IMPACT - T_PUNCH), 0, 1);
      const eu = ease.inQuad(smashU);
      const hitAge = Math.max(0, t - T_IMPACT);
      const shake = hitAge > 0 ? Math.exp(-hitAge * 14) * Math.sin(hitAge * 110) * 2.5 : 0;

      coreX = lerp(X_ATK - 6, X_ATK + 4, smashU);
      coreY = lerp(Y_CORE - 2, Y_CORE + 2, smashU);
      coreRadius = 9.0;
      corePulse = 1.0;
      tetherStrength = 1.0;
      fistBlend = 1.0;

      fistX = lerp(X_ATK + 23, X_HIT - 8, eu) + shake;
      fistY = lerp(Y_CORE - 3.5, -12, eu) + shake * 0.5;
      fistAngle = lerp(-0.16, 0.28, eu);

      const blockOffsets = [
        [7, -6],
        [7, 6],
        [-2, 9],
        [-8, -1],
      ];
      for (let i = 0; i < 4; i++) {
        stones[i].x = fistX + blockOffsets[i][0];
        stones[i].y = fistY + blockOffsets[i][1];
        stones[i].z = 1;
        stones[i].rot = fistAngle;
      }
    } else {
      // 3C: After impact hold, the Giant Fist unlocks and the 4 stones recoil back to orbit the core while
      //     the shattered crater, glowing cracks, shockwaves & flying rocks settle at X_HIT! (2.90..3.38s, Frame 95 at 3.17s)
      const u = seg(t, T_FIST_HOLD, T_KO);
      const eu = ease.outCubic(u);
      coreX = lerp(X_ATK + 4, X_ATK - 2, eu);
      coreY = lerp(Y_CORE + 2, Y_CORE, eu);
      coreRadius = lerp(9.0, 8.2, eu);
      corePulse = 0.78;
      tetherStrength = lerp(0.95, 0.55, eu);
      fistBlend = 1 - smooth(0.0, 0.26, u);

      fistX = lerp(X_HIT - 8, coreX + 22, smooth(0, 0.32, u));
      fistY = lerp(-12, coreY, smooth(0, 0.32, u));
      fistAngle = lerp(0.28, 0, smooth(0, 0.32, u));

      // Orbit target positions around `coreX` so at t = T_KO (3.38s) the 4 stones are suspended high in mid-air
      // ready to drop in free-fall when the core shatters!
      const dropReadyOffsets = [
        [-22, -6, -0.4, -0.25],
        [-8, -15, 0.6, 0.18],
        [9, -12, 0.8, -0.22],
        [23, -4, -0.3, 0.30],
      ];
      for (let i = 0; i < 4; i++) {
        const [ox, oy, oz, orot] = dropReadyOffsets[i];
        const sx0 = X_HIT - 8 + (i < 2 ? 7 : -6);
        const sy0 = -12 + (i % 2 === 0 ? -6 : 6);
        const arcLift = -14 * Math.sin(Math.min(1, u * 1.3) * Math.PI);
        stones[i].x = lerp(sx0, coreX + ox, eu);
        stones[i].y = lerp(sy0, coreY + oy, eu) + arcLift;
        stones[i].z = oz;
        stones[i].rot = lerp(0.28, orot, eu) + (1 - eu) * (i % 2 === 0 ? -1.8 : 1.8);
      }
    }
  } else {
    // =========================================================================
    // STATE 4: 【倒地 COLLAPSE, CORE SHATTER & FREE-FALL ROLL (3.38..4.80s)】
    // Central cyan core shatters & dissipates; 4 black stones lose magnetic support, drop in free-fall,
    // smash onto the floor, and bounce/roll outward to a halt!
    // =========================================================================
    coreX = X_ATK - 2;
    coreY = Y_CORE;

    // Starting mid-air positions of the 4 stones at t = T_KO (`coreX = -20, coreY = -30`):
    // 1) During Free-Fall (`0 .. tHit`): Stones lose magnetic support and drop straight down (`直接自由落体`)!
    // 2) After Floor Impact (`tHit .. 0.98s`): Stones slam into the floor (`砸在地面`), bounce, and roll outward (`滚落`)!
    const startDrop = [
      { x0: coreX - 22, y0: coreY - 6,  vxAir: -4, vxRoll: -36, rot0: -0.25, vrotAir: -2.0, vrotRoll: -11.5, g: 520, e: 0.50 },
      { x0: coreX - 8,  y0: coreY - 15, vxAir: -2, vxRoll: -16, rot0: 0.18,  vrotAir: -1.5, vrotRoll: -8.5,  g: 560, e: 0.46 },
      { x0: coreX + 9,  y0: coreY - 12, vxAir: 2,  vxRoll: 18,  rot0: -0.22, vrotAir: 1.5,  vrotRoll: 9.0,   g: 540, e: 0.48 },
      { x0: coreX + 23, y0: coreY - 4,  vxAir: 4,  vxRoll: 38,  rot0: 0.30,  vrotAir: 2.0,  vrotRoll: 12.0,  g: 500, e: 0.52 },
    ];

    if (t < T_SHATTER) {
      const u = seg(t, T_KO, T_SHATTER);
      coreAlive = true;
      coreRadius = 8.5 + 2.0 * u;
      coreCrack = 1.0;
      corePulse = 1.0;
      tetherStrength = 0.25;
      runeGlow = 0.5;
      for (let i = 0; i < 4; i++) {
        stones[i].x = startDrop[i].x0;
        stones[i].y = startDrop[i].y0;
        stones[i].z = 1;
        stones[i].rot = startDrop[i].rot0;
      }
    } else if (t < T_REVIVE) {
      coreAlive = false;
      tetherStrength = 0;
      const dropAge = t - T_SHATTER;
      runeGlow = Math.max(0, 1 - dropAge * 6.0);

      for (let i = 0; i < 4; i++) {
        const sd = startDrop[i];
        const rStone = STONE_SHAPES[i].r * 0.78;
        const hDrop = -(sd.y0 + rStone);
        const tHit = Math.sqrt((2 * Math.max(1, hDrop)) / sd.g);
        const tr = toss(sd.x0, sd.y0 + rStone, 0, 0, dropAge, sd.g, sd.e);

        const airT = Math.min(dropAge, tHit);
        const rollAge = clamp(dropAge - tHit, 0, 0.68);
        // Smooth eased roll after hitting the floor: rolls strongly between Frame 114 (3.80s) -> Frame 124 (4.13s) -> Frame 133 (4.43s)
        const rollProgress = ease.outQuad(rollAge / 0.68) * 0.42;

        stones[i].x = sd.x0 + sd.vxAir * airT + sd.vxRoll * rollProgress;
        stones[i].y = Math.min(-rStone, tr.y - rStone);
        stones[i].z = 1;
        stones[i].rot = sd.rot0 + sd.vrotAir * airT + sd.vrotRoll * rollProgress;
      }
    } else {
      // 4C: Ancient Ruin Re-Ignition (`4.58..4.80s`, Frame 143 at 4.77s) lifting the 4 stones back to Idle
      const u = seg(t, T_REVIVE, D);
      const eu = ease.inOutCubic(u);
      coreAlive = true;
      coreX = lerp(X_ATK - 2, X_IDLE, eu);
      coreY = lerp(-14, Y_CORE, eu);
      coreRadius = 8.2 * ease.outBack(u, 1.6);
      corePulse = 0.65 * eu;
      tetherStrength = 0.50 * eu;
      runeGlow = 0.85 * eu;

      const baseOrb = 0.35;
      for (let i = 0; i < 4; i++) {
        const sd = startDrop[i];
        const rStone = STONE_SHAPES[i].r * 0.78;
        const hDrop = -(sd.y0 + rStone);
        const tHit = Math.sqrt((2 * Math.max(1, hDrop)) / sd.g);
        const restX = sd.x0 + sd.vxAir * tHit + sd.vxRoll * 0.42;
        const restY = -rStone;
        const restRot = sd.rot0 + sd.vrotAir * tHit + sd.vrotRoll * 0.42;

        const a = baseOrb + (i / 4) * TAU;
        const tilt = i % 2 === 0 ? 0.38 : -0.32;
        const idleX = X_IDLE + Math.cos(a) * 23.5;
        const idleY = Y_CORE + Math.sin(a) * 14.0 + Math.cos(a) * tilt * 5;

        stones[i].x = lerp(restX, idleX, eu);
        stones[i].y = lerp(restY, idleY, eu) - 8 * Math.sin(u * Math.PI);
        stones[i].z = Math.sin(a);
        stones[i].rot = lerp(restRot, 0, eu);
      }
    }
  }

  return {
    coreX,
    coreY,
    coreAlive,
    coreRadius,
    corePulse,
    coreCrack,
    tetherStrength,
    runeGlow,
    fistBlend,
    fistX,
    fistY,
    fistAngle,
    thrusterPow,
    stones,
  };
}

// Evaluate signed distance / inside test for a chiseled angular polygon defined by polar `[ang, radScale]` vertices
function pointInAngularStone(lx, ly, r, verts) {
  const n = verts.length;
  let inside = true;
  let minEdgeDist = 999;
  let facetIdx = 0;
  let bestEdgeDot = -999;

  for (let i = 0; i < n; i++) {
    const [a0, s0] = verts[i];
    const [a1, s1] = verts[(i + 1) % n];
    const x0 = Math.cos(a0) * r * s0;
    const y0 = Math.sin(a0) * r * s0;
    const x1 = Math.cos(a1) * r * s1;
    const y1 = Math.sin(a1) * r * s1;
    const ex = x1 - x0;
    const ey = y1 - y0;
    const elen = Math.hypot(ex, ey) || 1;
    const nx = ey / elen;
    const ny = -ex / elen;
    const dist = (lx - x0) * nx + (ly - y0) * ny;
    if (dist > 0) {
      inside = false;
      return { inside: false, minEdgeDist: 0, facetIdx: 0 };
    }
    if (-dist < minEdgeDist) {
      minEdgeDist = -dist;
    }
    const midX = (x0 + x1) * 0.5;
    const midY = (y0 + y1) * 0.5;
    const dot = lx * midX + ly * midY;
    if (dot > bestEdgeDot) {
      bestEdgeDot = dot;
      facetIdx = i;
    }
  }
  return { inside, minEdgeDist, facetIdx };
}

// 1. DRAW AN INDIVIDUAL ANGULAR BLACK STONE WITH ANCIENT RUNE ENGRAVINGS INTO `GRID`
function shadeSingleStone(g, p, stInfo, shapeDef, S, Core, Rune, SState, idx) {
  const cx = stInfo.x;
  const cy = stInfo.y;
  const rot = stInfo.rot;
  const r = shapeDef.r * (1 - 0.85 * SState.fistBlend);
  if (r < 2.0) return;

  const cosA = Math.cos(rot);
  const sinA = Math.sin(rot);
  const pad = Math.ceil(r + 4);

  const toCoreAng = Math.atan2(SState.coreY - cy, SState.coreX - cx);

  g.shade(cx - pad, cy - pad, cx + pad, Math.min(2, cy + pad), (wx, wy, o) => {
    if (wy > 1.5) return 0;
    const dx = wx - cx;
    const dy = wy - cy;
    const lx = dx * cosA + dy * sinA;
    const ly = -dx * sinA + dy * cosA;

    const hit = pointInAngularStone(lx, ly, r, shapeDef.verts);
    if (!hit.inside) return 0;

    o.a = 1;
    o.t = 10 + idx;

    // 1. Ancient Cyan Rune Engraving in the center of the angular black stone ("古老遗迹的魔法机关感")
    const ax = Math.abs(lx);
    const ay = Math.abs(ly);
    let isRune = false;
    if (shapeDef.rune === "diamond") {
      isRune = ax + ay <= 2.4 && ax + ay >= 0.9;
    } else if (shapeDef.rune === "chevron") {
      isRune = Math.abs(ly - (ax * 0.85 - 1.5)) <= 0.78 && ax <= 2.5;
    } else if (shapeDef.rune === "cross") {
      isRune = (ax <= 0.68 && ay <= 2.3) || (ay <= 0.68 && ax <= 2.3);
    } else {
      isRune = (ax <= 0.8 && Math.abs(ly + 1.5) <= 0.8) || (Math.abs(ax - 1.5) <= 0.78 && Math.abs(ly - 1.1) <= 0.78);
    }
    if (isRune) {
      if (SState.runeGlow > 0.25) {
        return SState.runeGlow > 0.75 ? Core[5] : Core[3];
      }
      return S[1];
    }

    // 2. Cyan magnetic rim-light on the inner bevel facing the levitating cyan core
    const pixAng = Math.atan2(dy, dx);
    const coreFacing = Math.cos(pixAng - toCoreAng);
    if (SState.coreAlive && SState.runeGlow > 0.3 && hit.minEdgeDist < 1.35 && coreFacing > 0.50) {
      return coreFacing > 0.80 ? Core[4] : Core[2];
    }

    // 3. Sharp chiseled internal facet ridge & top-left sunlight bevel shading
    const [va0] = shapeDef.verts[hit.facetIdx];
    const worldFacetAng = va0 + rot + 0.5;
    const sunDot = Math.cos(worldFacetAng - Math.atan2(-1, -1));

    if (hit.minEdgeDist > 1.2 && (Math.abs(lx * 0.7 - ly * 0.7) < 0.65 || Math.abs(lx * 0.6 + ly * 0.8) < 0.6)) {
      return sunDot > 0 ? S[4] : S[1];
    }

    if (hit.minEdgeDist < 1.3 && dx + dy < -r * 0.25) return S[5];
    if (sunDot > 0.42) return S[4];
    if (sunDot > -0.15) return S[3];
    if (sunDot > -0.58) return S[2];
    return S[1];
  });

  if (SState.runeGlow > 0.2) {
    p.glow(cx, cy, r * 1.35, Core[3], 0.20 * SState.runeGlow);
  }
}

// 2. DRAW THE LEVITATING CYAN ENERGY CORE ("中心一颗悬浮的青色发光能量核")
function drawCyanEnergyCore(g, p, Core, Rune, SState, t) {
  if (!SState.coreAlive || SState.coreRadius < 1.0) return;
  const cx = SState.coreX;
  const cy = SState.coreY;
  const R = SState.coreRadius;
  const spin = (t / D) * TAU * 3;

  // Outer ancient-ruin rotating runic ring & 4 cardinal bronze/cyan nodes
  const ringR = R + 4.0;
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU + spin;
    const rx = cx + Math.cos(a) * ringR;
    const ry = cy + Math.sin(a) * ringR * 0.82;
    if (i % 7 === 0) {
      p.px(Math.round(rx), Math.round(ry), WHITE);
      p.dot(rx + 1, ry, Rune[3], 0.9);
      p.dot(rx - 1, ry, Core[4], 0.9);
    } else if (i % 2 === 0) {
      p.dot(rx, ry, Core[3], 0.75);
    }
  }

  // Faceted octagonal cyan energy core shaded into `GRID`
  const pad = Math.ceil(R + 3);
  g.shade(cx - pad, cy - pad, cx + pad, cy + pad, (wx, wy, o) => {
    const dx = wx - cx;
    const dy = wy - cy;
    const octD = Math.max(Math.abs(dx), Math.abs(dy), (Math.abs(dx) + Math.abs(dy)) * 0.72);
    if (octD > R) return 0;

    o.a = 1;
    o.t = 20;

    if (SState.coreCrack > 0.1) {
      if (Math.abs(dx - dy * 0.6) < 0.8 || Math.abs(dx * 0.7 + dy) < 0.8) {
        return WHITE;
      }
    }

    const q = octD / R;
    const swirl = Math.sin(Math.atan2(dy, dx) * 4 - spin * 2 + q * 5);
    if (q < 0.36) return WHITE;
    if (q < 0.62) return swirl > 0 ? Core[5] : Core[4];
    if (q < 0.84) return swirl > 0.2 ? Core[4] : Core[3];
    return Core[1];
  });

  p.glow(cx, cy, R * 3.0, Core[3], 0.44 + 0.18 * SState.corePulse);
  p.glow(cx, cy, R * 1.5, Core[5], 0.40 + 0.16 * SState.corePulse);
}

// 3. DRAW THE GIANT ASSEMBLED OBSIDIAN ROCK FIST ("瞬间在身前拼接组合成一只巨大的岩石拳头")
function shadeGiantRockFist(g, p, S, Core, Rune, SState, t) {
  if (SState.fistBlend <= 0.15) return;
  const fx = SState.fistX;
  const fy = SState.fistY;
  const ang = SState.fistAngle;
  const cosA = Math.cos(ang);
  const sinA = Math.sin(ang);
  const sc = SState.fistBlend;
  const pad = 26;

  // Sculpt a massive, high-contrast 4-knuckle chiseled Obsidian Rock Gauntlet/Fist (`32x24` px)
  // composed of the 4 interlocked angular black stones with glowing cyan rune-weld seams between them!
  g.shade(fx - pad, fy - pad, fx + pad, Math.min(2, fy + pad), (wx, wy, o) => {
    if (wy > 1.5) return 0;
    const dx = (wx - fx) / sc;
    const dy = (wy - fy) / sc;
    const u = dx * cosA + dy * sinA;
    const v = -dx * sinA + dy * cosA;

    const knuckleRidges = 2.6 * Math.cos(((v + 8.2) / 5.5) * TAU * 0.5) ** 2;
    const uFront = 14.0 + knuckleRidges - 0.04 * v * v;
    const uBack = -14.5 + 0.03 * v * v;
    const vTop = -11.5 + (u < -3 ? (-3 - u) * 0.28 : 0);
    const thumbBulge = u > -4.5 && u < 9.5 ? 2.8 : 0;
    const vBot = 10.5 + thumbBulge - (u < -4.5 ? (-4.5 - u) * 0.24 : 0);

    if (u < uBack || u > uFront || v < vTop || v > vBot) return 0;

    if (u - v < -20.5 || u + v < -20.5 || u - v > 22.5 || u + v > 22.5) return 0;

    o.a = 1;
    o.t = 30;

    // 1. Crisp 1px Glowing Cyan Magnetic Rune-Weld Seams where the 4 black stones interlock!
    const seamH = Math.abs(v - (-0.4 + 0.08 * u)) < 0.62 && u > -3.0 && u < uFront - 2.0;
    const seamV = Math.abs(u - (-3.0 + 0.10 * v)) < 0.62 && v > vTop + 2.0 && v < vBot - 2.0;
    const seamThumb = Math.abs(v - 7.4) < 0.62 && u > -3.5 && u < 9.0;
    if (seamH || seamV || seamThumb) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 45 + u * 0.4);
      return pulse > 0.65 ? Core[5] : Core[3];
    }

    // 2. Ancient Bronze/Gold Rune Crest on the back-hand gauntlet plate
    if (Math.abs(u + 8.0) + Math.abs(v) < 3.4 && Math.abs(u + 8.0) + Math.abs(v) > 1.5) {
      return Rune[4];
    }

    // 3. Deep Obsidian Finger Groove Creases between the 4 front knuckles
    if (u > 5.5 && (Math.abs(v + 5.5) < 0.75 || Math.abs(v) < 0.70 || Math.abs(v - 5.5) < 0.75)) {
      return S[0];
    }
    if (Math.abs(u - 6.5) < 0.65 && Math.abs(v) < 8.5) {
      return S[1];
    }

    // 4. Chiseled highlight along the smashing front knuckle tips
    if (u > uFront - 2.0) {
      return v < 2 ? S[5] : S[4];
    }

    // 5. High-contrast dark obsidian facet shading across the 4 interlocked blocks
    if (v < vTop + 2.2) return S[5];
    if (v > 7.4) return u > 2 ? S[3] : S[1];
    if (v < -0.4 && u > -3.0) return S[3];
    if (v >= -0.4 && u > -3.0) return S[2];
    return v < 0 ? S[2] : S[1];
  });

  p.glow(fx + 4, fy, 24 * sc, Core[3], 0.30 * sc);
}

// 4. DRAW ELECTRIC TETHER LINES BETWEEN CORE & STONES ("核心与石块之间的微弱电流连线" & "带着青色电弧")
function drawElectricTethersAndThruster(p, Core, SState, t, seed) {
  // 4A: Thruster Plasma Jet & Runic Shock Rings during Move (`1.05..2.02s`, Frames 38, 48, 57)
  //     ("四块黑石聚拢在能量核后方高速旋转如同推进器、推着核心向前冲刺")
  if (SState.thrusterPow > 0.05) {
    const pw = SState.thrusterPow;
    const nozX = SState.coreX - 19;
    const nozY = SState.coreY;

    const jetLen = Math.min(34 * pw, SState.coreX + 80);
    for (let i = 0; i < Math.ceil(jetLen); i++) {
      const u = i / Math.max(1, jetLen);
      const halfH = (1 - u * 0.75) * 6.8 * pw * (0.75 + 0.25 * Math.sin(u * Math.PI * 6 - t * 65));
      for (let dy = -Math.ceil(halfH); dy <= Math.ceil(halfH); dy++) {
        const q = Math.abs(dy) / Math.max(0.5, halfH);
        if (q > 1) continue;
        const col = q < 0.32 && u < 0.55 ? WHITE : q < 0.65 ? Core[4] : Core[2];
        p.dot(nozX - i, nozY + dy, col, (1 - u) * (1 - q * 0.5) * pw);
      }
    }
    p.glow(nozX - 8, nozY, 24 * pw, Core[3], 0.44 * pw);
    p.glow(nozX - 3, nozY, 12 * pw, WHITE, 0.38 * pw);

    for (let rIdx = 0; rIdx < 3; rIdx++) {
      const ru = (t * 4.5 + rIdx / 3) % 1;
      const rx = nozX - 5 - ru * 26;
      if (rx < -92) continue;
      const ry = nozY;
      const radY = 5 + ru * 7.5;
      const radX = 2.0 + ru * 1.4;
      const ra = (1 - ru) * pw * 0.85;
      for (let a = 0; a < TAU; a += 0.28) {
        p.dot(rx + Math.cos(a) * radX, ry + Math.sin(a) * radY, Math.cos(a) > 0 ? Core[5] : Core[3], ra);
      }
    }

    const R = new Rng(seed * 41 + Math.floor(t * 30));
    for (let i = 0; i < 12; i++) {
      const sx = SState.coreX - R.range(0, 36);
      const sy = -R.range(0.5, 6.5);
      p.dot(sx, sy, i % 2 === 0 ? Core[4] : WHITE, pw * 0.88);
    }
  }

  // 4B: Weak/Strong Cyan Electric Tether Lines between Core and the 4 Black Stones ("核心与石块之间的微弱电流连线")
  if (!SState.coreAlive || SState.tetherStrength <= 0.02) return;

  const frameSlot = Math.floor(t * 30);

  if (SState.fistBlend > 0.3) {
    // During Attack (Frames 67, 76, 86):
    // 1. Two crisp cyan magnetic-electric tether cables linking the cyan core's front to the back wrist of the Giant Rock Fist!
    const wristX = SState.fistX - 13 * Math.cos(SState.fistAngle);
    const wristY = SState.fistY - 13 * Math.sin(SState.fistAngle);
    for (const side of [-1, 1]) {
      const R = new Rng(seed * 151 + frameSlot * 19 + (side > 0 ? 1 : 2));
      const x0 = SState.coreX + SState.coreRadius - 1;
      const y0 = SState.coreY + side * 4;
      const x1 = wristX;
      const y1 = wristY + side * 6;
      const steps = 8;
      let px = x0;
      let py = y0;
      for (let s = 1; s <= steps; s++) {
        const u = s / steps;
        const env = Math.sin(u * Math.PI);
        const qx = lerp(x0, x1, u) + R.range(-1.5, 1.5) * env;
        const qy = lerp(y0, y1, u) + side * 3.5 * env + R.range(-2.2, 2.2) * env;
        p.line(px, py, qx, qy, Core[3], 0.9);
        p.line(px, py - side * 0.5, qx, qy - side * 0.5, s % 2 === 0 ? WHITE : Core[5], 0.95);
        px = qx;
        py = qy;
      }
    }

    // 2. Crisp cyan electric arcs crackling around the PERIMETER & KNUCKLES of the Giant Rock Fist ("带着青色电弧")
    const R = new Rng(seed * 193 + frameSlot * 23);
    const isPunching = t >= T_PUNCH && t < T_FIST_HOLD;
    const arcCount = isPunching ? 5 : 3;
    for (let aIdx = 0; aIdx < arcCount; aIdx++) {
      const a0 = -1.4 + aIdx * (2.8 / arcCount) + R.range(-0.2, 0.2);
      const a1 = a0 + R.range(0.55, 0.95);
      const rx = 16.5;
      const ry = 13.0;
      const sx0 = SState.fistX + Math.cos(a0) * rx;
      const sy0 = SState.fistY + Math.sin(a0) * ry;
      const sx1 = SState.fistX + Math.cos(a1) * rx;
      const sy1 = SState.fistY + Math.sin(a1) * ry;
      const mx = SState.fistX + Math.cos((a0 + a1) * 0.5) * (rx + R.range(2.5, 5.5));
      const my = SState.fistY + Math.sin((a0 + a1) * 0.5) * (ry + R.range(2.5, 5.5));
      p.line(sx0, sy0, mx, my, Core[4], 0.95);
      p.line(mx, my, sx1, sy1, WHITE, 0.95);
      p.dot(mx, my, WHITE, 1);
      p.glow(mx, my, 8, Core[4], 0.38);
    }

    // 3. Blazing forked cyan lightning bolts streaming off the top & bottom of the speeding Rock Fist during the smash!
    if (isPunching) {
      const boltRamp = [Core[0], Core[1], Core[2], Core[3], Core[4], Core[5], Core[6], WHITE];
      for (const side of [-1, 1]) {
        const kx = SState.fistX + 10;
        const ky = SState.fistY + side * 11;
        const tx = SState.fistX - R.range(16, 26);
        const ty = SState.fistY + side * R.range(12, 18);
        const fb = zigzag(R, kx, ky, tx, ty, 0.28, 0.45);
        stroke(p, fb, 0.85, boltRamp, 0.72, { light: 0.32, a: 0.95 });
      }
      p.glow(SState.fistX + 14, SState.fistY, 20, Core[4], 0.48);
    }
    return;
  }

  // In Idle & Move: Delicate, flickering weak cyan electric tether lines from Core to each of the 4 Black Stones!
  for (let i = 0; i < 4; i++) {
    const st = SState.stones[i];
    const R = new Rng(seed * 131 + frameSlot * 17 + i * 7);
    const dx = st.x - SState.coreX;
    const dy = st.y - SState.coreY;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;

    const x0 = SState.coreX + ux * (SState.coreRadius - 1);
    const y0 = SState.coreY + uy * (SState.coreRadius - 1);
    const x1 = st.x - ux * 4.0;
    const y1 = st.y - uy * 4.0;

    const steps = 6;
    const nx = -uy;
    const ny = ux;
    const bowDir = i % 2 === 0 ? 1 : -1;
    let px = x0;
    let py = y0;
    for (let s = 1; s <= steps; s++) {
      const u = s / steps;
      const env = Math.sin(u * Math.PI);
      const jag = (bowDir * 2.2 * env + R.range(-1.8, 1.8) * env) * (0.6 + 0.6 * SState.tetherStrength);
      const qx = lerp(x0, x1, u) + nx * jag;
      const qy = lerp(y0, y1, u) + ny * jag;
      p.line(px, py, qx, qy, Core[3], 0.50 + 0.38 * SState.tetherStrength);
      if (s % 2 === 1 || SState.tetherStrength > 0.75) {
        p.dot((px + qx) * 0.5, (py + qy) * 0.5, SState.tetherStrength > 0.75 ? WHITE : Core[5], 0.88);
      }
      px = qx;
      py = qy;
    }
    p.dot(x1, y1, Core[5], 0.92);
    p.glow((x0 + x1) * 0.5, (y0 + y1) * 0.5, 7, Core[3], 0.18 * SState.tetherStrength);
  }
}

// 5. HEAVY ROCK FIST IMPACT, GROUND CRACKS, SHOCKWAVES & FLYING ROCK DEBRIS ("重拳命中的碎石震裂结果特效")
function drawFistImpactShatter(p, S, Core, scene, t, seed, layer) {
  if (t < T_IMPACT || t > T_KO + 0.35) return;
  const age = t - T_IMPACT;
  const dur = 1.00;
  if (age > dur) return;
  const u = age / dur;
  const fade = 1 - smooth(0.65, 1.0, u);
  const heatVal = Math.pow(clamp(1 - age / 0.65), 1.25);
  const hotRamp = [WHITE, Core[5], Core[4], Core[2]];

  if (layer === "back") {
    // 5A: Deep dented impact crater at X_HIT = 50
    for (let dx = -15; dx <= 15; dx++) {
      const q = Math.abs(dx) / 15;
      const dep = Math.round(2.8 * (1 - q * q));
      if (q < 0.84) {
        for (let dy = 0; dy < dep; dy++) p.dot(X_HIT + dx, dy, SOOT, fade);
        p.dot(X_HIT + dx, dep, heatVal > 0.40 ? Core[4] : S[2], fade);
      } else {
        p.dot(X_HIT + dx, -1, S[5], fade * 0.9);
      }
    }

    // 5B: Jagged glowing cyan-fissured floor cracks spider-webbing across the ground (`makeCracks` / `drawCracks`)
    drawCracks(
      p,
      scene.cracks,
      (c) => c.len * ease.outCubic(clamp((age - c.t0) / 0.12)),
      (d) => heatVal * clamp(1.3 - d / 40),
      hotRamp,
      SOOT,
      S[4],
      fade
    );

    // Far half of ground shockwave ring & lumpy dust ring
    const ringU = clamp(age / 0.52);
    if (ringU < 1) {
      const rr = 8 + 42 * ease.outCubic(ringU);
      band(
        p,
        X_HIT,
        0.5,
        rr,
        0.18,
        Math.max(1, 3.4 * (1 - ringU)),
        1 - ringU,
        [Core[2], Core[4], Core[5], WHITE],
        (g) => Math.sin(g) < 0,
        age < 0.08
      );
    }
    if (age < 0.82) {
      const du = age / 0.82;
      dustRing(p, X_HIT, 0, 10 + 38 * ease.outCubic(du), 4.8 * (1 - 0.30 * du), (1 - du) * 0.80, S[4], {
        sy: 0.22,
        ph: seed * 2.1,
        brk: du * 0.65,
        maxY: 2,
        half: -1,
      });
    }
    return;
  }

  // FOREGROUND LAYER (`layer === "front"`):
  // 5C: Blinding cyan-white impact starburst (`star` + `spikes`) & breaking shock ring (`brokenRing`) on contact
  if (age < 0.18) {
    const ku = age / 0.18;
    const sc = ku < 0.35 ? lerp(0.5, 1.25, ku / 0.35) : lerp(1.25, 0.75, (ku - 0.35) / 0.65);
    star(p, X_HIT + 4, -5, scene.hitSpikes, sc, 1 - ku * 0.55, [Core[2], Core[4], Core[5], WHITE], 1 - ku * 0.3, 3.0);
    p.glow(X_HIT, -6, 44, Core[4], 0.72 * (1 - ku));
    p.glow(X_HIT, -4, 22, WHITE, 0.78 * (1 - ku));
  }
  if (age < 0.42) {
    const ru = age / 0.42;
    brokenRing(p, X_HIT, -5, 6 + 34 * ease.outCubic(ru), 2.4 * (1 - ru * 0.5), scene.ringSegs, ru * 0.82, WHITE, Core[4], 1 - ru, 0.78, 1);
  }

  // 5D: Twin standing crescent shock fronts (`frontCrescent`) racing outward along the floor (Frame 86!)
  if (age < 0.56) {
    const wu = age / 0.56;
    const fr = 8 + 42 * ease.outCubic(wu);
    const h = 6 + 20 * Math.pow(1 - wu, 0.70);
    const w = 1.6 + 4.0 * Math.pow(1 - wu, 0.80);
    const cols = wu < 0.40 ? [WHITE, Core[5], Core[3]] : [Core[4], S[5], S[3]];
    for (const dir of [-1, 1]) {
      frontCrescent(p, X_HIT + dir * fr, dir, h, w, cols, (1 - wu) * 0.94);
      p.glow(X_HIT + dir * fr, -h * 0.3, 10, Core[3], 0.32 * (1 - wu));
    }
  }

  // Near half of shockwave ring & lumpy dust ring
  const ringU = clamp(age / 0.52);
  if (ringU < 1) {
    const rr = 8 + 42 * ease.outCubic(ringU);
    band(
      p,
      X_HIT,
      0.5,
      rr,
      0.18,
      Math.max(1, 3.4 * (1 - ringU)),
      1 - ringU,
      [Core[2], Core[4], Core[5], WHITE],
      (g) => Math.sin(g) >= 0,
      age < 0.08
    );
  }
  if (age < 0.82) {
    const du = age / 0.82;
    dustRing(p, X_HIT, 0, 10 + 38 * ease.outCubic(du), 4.8 * (1 - 0.30 * du), (1 - du) * 0.85, S[4], {
      sy: 0.22,
      ph: seed * 2.1,
      brk: du * 0.65,
      maxY: 2,
      half: 1,
    });
  }

  // 5E: Faceted Angular Rock Shards (`rock`) erupting from the shattered crater, tumbling and bouncing across the floor!
  for (let i = 0; i < scene.rocks.length; i++) {
    const rk = scene.rocks[i];
    if (age > rk.life) continue;
    const tr = toss(X_HIT + rk.x0, rk.y0, rk.vx, rk.vy, age, rk.g, rk.e);
    rock(
      p,
      {
        x: tr.x,
        y: Math.min(-1, tr.y),
        a: rk.a0 + rk.va * age,
        s: rk.s,
        life: rk.life - age,
        pts: rk.pts,
      },
      scene.stCols
    );
  }

  // 5F: Crackling cyan electric overload bolts whipping out of the shattered crater (`age < 0.54s`, Frame 86!)
  if (age < 0.54) {
    const boltRamp = [Core[0], Core[1], Core[2], Core[3], Core[4], Core[5], Core[6], WHITE];
    const R = new Rng(seed * 73 + Math.floor(t * 30));
    const ek = 1 - age / 0.54;
    for (let b = 0; b < 3; b++) {
      const ang = -Math.PI / 2 + (b - 1) * 0.62 + R.range(-0.18, 0.18);
      const len = R.range(18, 32) * (0.5 + 0.5 * ek);
      const zb = zigzag(R, X_HIT + (b - 1) * 6, -2, X_HIT + Math.cos(ang) * len, -2 + Math.sin(ang) * len, 0.32, 0.4);
      stroke(p, zb, 0.8 * ek, boltRamp, 0.72, { light: 0.32, a: ek });
    }
  }
}

// 6. CORE SHATTER EXPLOSION & FREE-FALLING STONE FLOOR BOUNCE DUST ("中心能量核啪地碎裂消散、四块黑石瞬间失去磁力支撑直接自由落体砸在地面滚落")
function drawCoreShatterAndStoneDropEffects(p, S, Core, Rune, SState, scene, t, seed) {
  if (t < T_SHATTER) return;
  const age = t - T_SHATTER;

  // 6A: Central Cyan Energy Core Shatter & Dissipating Crystal Shards (`3.40..4.10s`, Frame 105 at `t = 3.50s` is `age = 0.10s`!)
  //     ("【倒地时】中心能量核啪地碎裂消散")
  const cx = X_ATK - 2;
  const cy = Y_CORE;

  if (age < 0.70) {
    const u = age / 0.70;
    const k = 1 - u;

    // Broken cyan shock ring (`brokenRing`) expanding around the hollow shattered center
    if (age < 0.28) {
      const ru = age / 0.28;
      brokenRing(p, cx, cy, 6 + 24 * ease.outCubic(ru), 2.0 * (1 - ru * 0.5), scene.ringSegs, 0.35 + ru * 0.55, WHITE, Core[4], 1 - ru, 0.88);
    }

    // Snapping radial fracture lines & electric tether sparks
    if (age < 0.22) {
      const sk = 1 - age / 0.22;
      for (let i = 0; i < 12; i++) {
        const r = rng(seed, i, 811);
        const a = (i / 12) * TAU + r.range(-0.15, 0.15);
        const d0 = 4 + age * 65;
        const d1 = d0 + r.range(4, 8) * sk;
        p.line(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0 * 0.85, cx + Math.cos(a) * d1, cy + Math.sin(a) * d1 * 0.85, i % 2 === 0 ? WHITE : Core[4], sk);
      }
    }

    // 16 Angular Cyan Crystal Core Shards flying outward from the hollow center and dissolving into thin air!
    for (let i = 0; i < 16; i++) {
      const r = rng(seed, i, 829);
      const life = r.range(0.42, 0.68);
      if (age > life) continue;
      const su = age / life;
      const a = (i / 16) * TAU + r.range(-0.12, 0.12);
      const sp = r.range(58, 125);
      const drag = 1 - Math.exp(-age * 4.0);
      const sx = cx + ((Math.cos(a) * sp) / 4.0) * drag;
      const sy = cy + ((Math.sin(a) * sp) / 4.0) * drag + 32 * age * age - 4 * age;
      const sa = (1 - su) * 0.98;

      const col = su < 0.45 ? Core[5] : Core[4];
      p.px(Math.round(sx), Math.round(sy), WHITE);
      p.dot(sx + 1, sy, col, sa);
      p.dot(sx - 1, sy, Core[3], sa);
      p.dot(sx, sy - 1, col, sa);
      p.dot(sx, sy + 1, Core[2], sa);
      if (i % 2 === 0) {
        p.glow(sx, sy, 6, Core[4], 0.34 * sa);
      }
    }

    // Dissipating cyan mana vapor wisps rising from where the core shattered
    for (let i = 0; i < 10; i++) {
      const r = rng(seed, i, 853);
      const wx = cx + r.range(-16, 16) + Math.sin(age * 8 + i) * 2.5;
      const wy = cy + r.range(-8, 8) - age * r.range(18, 36);
      p.dot(wx, wy, i % 2 === 0 ? Core[4] : Core[3], k * 0.80);
    }
  }

  // 6B: Free-Fall Ground Impact Dust Puffs, Grit & Rolling Skid Dust for the 4 Black Stones!
  //     ("四块黑石瞬间失去磁力支撑直接自由落体砸在地面滚落的完整过程", Frames 114, 124, 133)
  const stoneImpactTimes = [0.28, 0.31, 0.29, 0.27];
  const stoneImpactX = [cx - 23, cx - 9, cx + 10, cx + 24];

  for (let s = 0; s < 4; s++) {
    const ia = age - stoneImpactTimes[s];
    if (ia < 0 || ia > 0.88) continue;
    const iu = ia / 0.88;
    const ix = stoneImpactX[s];

    // Heavy thud dust puffs when each falling black stone smashes into the floor (`ia < 0.44s`, Frame 114 at `t = 3.80s`!)
    if (ia < 0.44) {
      const du = ia / 0.44;
      for (let k = 0; k < 4; k++) {
        const side = k % 2 === 0 ? -1 : 1;
        const dist = (2 + (k >> 1) * 3 + 8 * ease.outCubic(du)) * side;
        const dy = -1.8 - (2.5 + (k & 1) * 2.2) * Math.sin(du * Math.PI);
        const rad = 2.6 * Math.sin(Math.min(1, Math.pow(du, 0.5) * 1.2) * Math.PI);
        p.disc(ix + dist, dy, rad, S[3], (1 - du) * 0.85);
        p.disc(ix + dist - side * 0.5, dy - 0.5, rad * 0.65, S[5], (1 - du) * 0.95);
      }
    }

    // Rolling dust trail & bouncing stone grit as each stone rolls outward across the floor (`ia = 0..0.82s`, Frame 124 at `t = 4.13s`!)
    const stNow = SState.stones[s];
    if (ia < 0.82 && t < T_REVIVE) {
      const ru = ia / 0.82;
      const dir = s < 2 ? -1 : 1;
      for (let m = 0; m < 4; m++) {
        const trailX = stNow.x - dir * (4 + m * 3.8);
        const trailY = -1.4 - (m & 1) * 1.4;
        p.disc(trailX, trailY, 2.2 * (1 - ru * 0.40), S[4], (1 - ru) * 0.88);
      }
      const r = rng(seed, s * 11 + 3, 887);
      const f = toss(ix, -1, dir * r.range(18, 44), -r.range(28, 58), ia, 520, 0.38);
      p.dot(f.x, f.y, S[5], 1 - iu);
    }
  }

  // 6C: Ancient Ruin Re-Ignition Sigil on the floor (`4.58..4.80s`, Frame 143 at 4.77s)
  if (t >= T_REVIVE) {
    const u = seg(t, T_REVIVE, D);
    const k = Math.sin(u * Math.PI);
    const rx = lerp(32, 14, u);
    for (let a = 0; a < TAU; a += 0.25) {
      p.dot(SState.coreX + Math.cos(a) * rx, Math.sin(a) * rx * 0.22, a % 0.5 < 0.25 ? Core[4] : Rune[4], k);
    }
    p.glow(SState.coreX, -14, 30, Core[3], 0.45 * k);
  }
}

export function drawBack(p, time, o) {
  const t = shift(time, D, o.seed);
  const Core = fit(o.palette, 7);
  const S = fit(o.stone, 6);
  const SState = computeState(t);
  const impactScene = getImpactScene(o.seed, o.stone[3]);

  // 1. Floor shadow & magnetic ground glow under the levitating core and stones
  if (SState.coreAlive) {
    const shX = SState.coreX;
    for (let y = -1; y <= 2; y++) {
      for (let x = Math.floor(shX - 20); x <= Math.ceil(shX + 20); x++) {
        const d = ((x - shX) / 20) ** 2 + (y / 2.2) ** 2;
        if (d < 1) p.blend(x, y, S[0], 0.52 * (1 - d));
      }
    }
    p.glow(shX, 0, 32, Core[2], 0.25 * (0.6 + 0.4 * SState.corePulse));
    p.glow(shX, SState.coreY, 42, Core[2], 0.22 * (0.6 + 0.4 * SState.corePulse));
  } else {
    // Individual floor contact shadows under each of the 4 fallen black stones in State 4
    for (let i = 0; i < 4; i++) {
      const st = SState.stones[i];
      const shRx = 8.0;
      for (let x = Math.floor(st.x - shRx); x <= Math.ceil(st.x + shRx); x++) {
        const d = Math.abs(x - st.x) / shRx;
        if (d < 1) p.blend(x, 0, S[0], 0.65 * (1 - d));
      }
    }
  }

  // 2. Heavy Rock Fist impact crater, glowing floor cracks & far shockwave rings
  drawFistImpactShatter(p, S, Core, impactScene, t, o.seed, "back");

  // 3. Ambient ancient-ruin cyan magnetic motes floating upward
  cycle(t, D, 16, o.seed * 19 + 5, (r) => r.range(1.1, 1.9), (ag, L, r, i) => {
    const k = ag / L;
    const x = r.range(-80, 26) + Math.sin(ag * 2.5 + i) * 3.0;
    const y = -r.range(3, 42) - ag * r.range(8, 16);
    const a = Math.min(1, k * 4) * (1 - k) * (SState.coreAlive ? 0.85 : 0.25);
    if (a <= 0.05) return;
    const col = i % 3 === 0 ? WHITE : Core[4];
    p.dot(x, y, col, a);
    p.glow(x, y, 4.5, Core[3], 0.25 * a);
  });
}

export function draw(p, time, o) {
  const t = shift(time, D, o.seed);
  const Core = fit(o.palette, 7);
  const S = fit(o.stone, 6);
  const Rune = fit(o.rune, 5);
  const SState = computeState(t);
  const impactScene = getImpactScene(o.seed, o.stone[3]);

  GRID.clear();

  // 1. Shade Back-Layer Stones (`z < 0`) behind the central Cyan Energy Core
  for (let i = 0; i < 4; i++) {
    if (SState.stones[i].z < 0) {
      shadeSingleStone(GRID, p, SState.stones[i], STONE_SHAPES[i], S, Core, Rune, SState, i);
    }
  }

  // 2. Shade the Levitating Cyan Energy Core
  drawCyanEnergyCore(GRID, p, Core, Rune, SState, t);

  // 3. Shade Front-Layer Stones (`z >= 0`) in front of the Core
  for (let i = 0; i < 4; i++) {
    if (SState.stones[i].z >= 0) {
      shadeSingleStone(GRID, p, SState.stones[i], STONE_SHAPES[i], S, Core, Rune, SState, i);
    }
  }

  // 4. Shade the Giant Assembled Obsidian Rock Fist during Attack (`2.02..2.98s`)
  shadeGiantRockFist(GRID, p, S, Core, Rune, SState, t);

  // 5. Crisp 1px outline around the core, stones, and giant rock fist
  GRID.outline((x, y, nx, ny, tId) => {
    if (tId === 20) return Core[0]; // Deep cyan-black outline around the energy core
    return S[0];                    // Deep obsidian outline around the stones & giant fist
  });
  GRID.draw(p);

  // 6. Draw Cyan Electric Tether Lines between Core & Stones, Thruster Plasma Jet, and Fist Lightning Arcs
  drawElectricTethersAndThruster(p, Core, SState, t, o.seed);

  // 7. Draw Heavy Rock Fist Impact Starburst, Shockwaves, Flying Faceted Rocks & Electric Overload
  drawFistImpactShatter(p, S, Core, impactScene, t, o.seed, "front");

  // 8. Draw Core Shatter Crystal Burst & Free-Falling Stone Impact/Roll Dust
  drawCoreShatterAndStoneDropEffects(p, S, Core, Rune, SState, impactScene, t, o.seed);
}
