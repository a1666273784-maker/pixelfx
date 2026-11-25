// Volt Furball ("critters/volt-furball" — 【雷云跳跳毛球小怪物特效】):
// A hyperactive, short-tempered lightning furball sprite showcasing five sustained action states with C1-continuous
// motion curves, anticipation, follow-through, and seamless state-to-state transitions across a 7.5s loop:
// 1. 【待机 Idle (0.00..1.25s)】: A fluffy round ball of golden-yellow static particles with two lightning-bolt
//    ahoge tufts on its crown ("由金黄色静电粒子组成的毛茸茸圆球、头顶两撮闪电状的呆毛") hops restlessly left and right
//    at high frequency in place ("不安分地在原地高频率左右小跳步").
// 2. 【生态小动作 Eco Quirk (1.25..2.86s)】: Its twin lightning tufts bend inward and spark together, snapping a
//    static arc into its forehead — it winces and progressively bristles outward into a 3x fluffy sea-urchin ball
//    while its eyes dilate into spinning mosquito-coil spirals ("不小心被自己的静电电了一下、瞬间炸毛膨胀成三倍大的蓬松海胆状且双眼变成眩晕的蚊香圈"),
//    then frantically shakes its body to fling off waves of static sparks while smoothly deflating back to normal
//    ("随后拼命甩动身体把电火花甩掉恢复原状").
// 3. 【移动 Move (2.86..4.36s)】: Settling from its shake into a deep elastic rubber-ball crouch on the floor, it
//    ricochets in a high-speed Z-shaped zigzag trajectory with smooth corner squash-and-stretch rebounds, leaving
//    a glowing blue-white lightning polyline afterimage ("身体压扁又弹起、像一颗充满弹性的皮球在地面呈Z字形高速弹射跳跃并留下蓝白色的闪电折线残影")
//    and rising along a smooth parabolic rebound arc into mid-air as it curls into a spin.
// 4. 【攻击 Attack & Scorched Grid Hit (4.36..5.65s)】: Accelerating its mid-air spin into a blinding purple-gold
//    thunderstorm vortex ("气鼓鼓地跳到半空极速旋转成一团刺眼的雷暴漩涡"), it sends down a stepped leader and cleaves
//    an organic, fractal-jagged purple-gold sawtooth lightning bolt ("向正前方猛烈劈下一道粗壮的紫金色锯齿状落雷") with
//    air-tearing branching electric arcs ("落雷撕裂空气的电弧") and a scorched black electric grid on the floor
//    ("地面被劈出焦黑电网的命中结果特效"), followed by the channel cooling and crumbling into sparks as the vortex decelerates.
// 5. 【倒地 KO & Charred Smoke Dissipation (5.65..7.50s)】: Falling along a continuous gravity arc to the floor as
//    runaway static rampages across its body ("全身静电失控乱窜"), it swells, chars dark from within, and pops with
//    a crisp short-circuit shockwave into a billowing cloud of charred black smoke and stray electric sparks that
//    rise and dissipate ("在一声清脆的电流短路声中噗地化作一团焦黑的烟雾和零星电火花消散"), before golden static motes
//    stream back to re-condense smoothly into the Idle state.
// Builds on ../lightning/lightning-strike.js, ../lightning/zap-hit.js, ../lightning/electrified.js, and ../lightning/_lib.js
// (adapted from Sprite Fusion's open-source VFX, MIT License, Copyright (c) 2026 Hugo Duprez).
import {
  Rng,
  fit,
  hex,
  sparkle,
  clamp,
  smooth,
  seg,
  ease,
  lerp,
  rand,
  rng,
  cycle,
  TAU,
  WHITE,
} from "../../core/index.js";
import { Grid, shift } from "./_lib.js";
import { zigzag, stroke, crackle, trace, flight, spark, SOOT } from "../lightning/_lib.js";

export const meta = {
  name: "Volt furball",
  desc: "A golden static furball with twin lightning tufts hops, self-zaps into a 3x sea-urchin with swirl eyes, Z-bounces, cleaves a purple-gold bolt, and pops into black smoke.",
  tags: ["critter", "monster", "lightning", "electric", "furball", "cute", "berserk", "loop"],
  size: [248, 136],
  origin: [118, 108],
  duration: 7.5,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // 7-step Golden-Yellow Static Furball & Lightning Core ramp ("金黄色静电粒子组成的毛茸茸圆球")
    palette: ["#281204", "#5c2c06", "#a4540a", "#e88a12", "#ffc824", "#ffee78", "#ffffff"],
    // 6-step Blue-White Z-Bounce Afterimage & Static Spark ramp ("蓝白色的闪电折线残影")
    plasma: ["#081e3c", "#124888", "#2088d8", "#52ccff", "#b8f4ff", "#ffffff"],
    // 6-step Purple-Gold Thunderstorm Vortex & Sawtooth Bolt Halo ramp ("紫金色锯齿状落雷")
    storm: ["#140628", "#2e1058", "#581ea4", "#8e3cf0", "#c878ff", "#f2d4ff"],
    seed: 1,
  },
};

const D = meta.duration;

// Continuous 5-State Timeline with Smooth Anticipation & Follow-Through Bridges:
const T_QUIRK_ANTIC = 1.25; // Twin ahoge tufts bend inward & spark; self-zap wince begins
const T_QUIRK_PUFF = 1.44;  // Progressive elastic bristling into 3x sea-urchin (Frame 45 at 1.50s: mid-inflation; Frame 60 at 2.00s: full 3x sea-urchin!)
const T_SHAKE = 2.24;       // Frantic left-right shake-off & progressive step-down deflation (Frame 75 at 2.50s!)
const T_MOVE_SQUASH = 2.86; // Smooth transition from shake recovery into deep rubber-ball floor crouch (Frame 90 at 3.00s!)
const T_ZIGZAG = 3.12;      // High-speed Z-shaped zigzag elastic ricochet begins (Frames 105 & 119!)
const T_VORTEX = 4.36;      // Parabolic final Z-leap smoothly arrives at mid-air vortex apex (Frame 134 at 4.47s!)
const T_LEAD = 4.54;        // Stepped leader reaches down from vortex toward target floor
const T_STRIKE = 4.78;      // Organic jagged purple-gold sawtooth lightning bolt slams down (Frame 149 at 4.97s!)
const T_CRUMBLE_END = 5.66; // Spent lightning channel cools & crumbles into sparks (Frame 164 at 5.47s!)
const T_FALL = 5.65;        // Vortex spins down and furball falls along a continuous gravity arc to the floor (Frame 179 at 5.97s!)
const T_POP = 6.30;         // Overcharged furball chars from within and pops into billowing black smoke (Frames 194 & 209!)
const T_REVIVE = 7.06;      // Golden static motes stream back to X_IDLE and smoothly re-condense into the furball (Frame 224 at 7.47s!)

const X_IDLE = -54;
const X_ATK = -2;
const Y_VORTEX = -48;
const X_HIT = 54;
const X_KO = -20;
const R_BASE = 12.5;

const GRID = new Grid(-108, -96, 232, 108);

// Charred soot-black smoke palette with crisp ash-violet rim so the black smoke cloud pops against the dark background
const CHAR_SMOKE = ["#07050c", "#130f1c", "#241d34", "#3e3356", "#645584", "#9888b8"].map(hex);

// Z-Shaped Zigzag Ricochet Waypoints (`t = 3.12..4.36s`):
// Traces a continuous Z-ricochet across ground and air, ending with a smooth parabolic upward leap into `(X_ATK, Y_VORTEX)`!
const Z_NODES = [
  { t: 3.12, x: X_IDLE, y: -R_BASE }, // Node 0: Deep floor squash launch at exact X_IDLE
  { t: 3.36, x: -8,     y: -15 },     // Node 1: Fast low horizontal bounce right (bottom bar of Z)
  { t: 3.66, x: -48,    y: -45 },     // Node 2: Sharp diagonal ricochet up-left (center diagonal of Z)
  { t: 3.94, x: +6,     y: -49 },     // Node 3: High-speed upper horizontal slash right (top bar of Z — Frame 119 at 3.97s!)
  { t: 4.14, x: -22,    y: -R_BASE }, // Node 4: Elastic floor rebound
  { t: 4.36, x: X_ATK,  y: Y_VORTEX }, // Node 5: Smooth parabolic leap into the mid-air Attack vortex apex!
];

// Flickering Return Strokes for the State 4 Jagged Purple-Gold Sawtooth Lightning Bolt
const BOLT_STROKES = [
  { t: T_STRIKE, k: 1.0 },
  { t: T_STRIKE + 0.16, k: 0.94 },
  { t: T_STRIKE + 0.34, k: 0.80 },
];
const FLICK = [1.0, 0.84, 0.52, 0.96, 0.66, 0.86, 0.44];
function boltLevel(age) {
  if (age < 0) return 0;
  return FLICK[Math.floor(age * 30 + 1e-4)] ?? 0;
}

// Build a deterministic, organic fractal-jagged sawtooth lightning bolt with multi-tiered branching forks:
// Follows 3 asymmetric sawtooth lightning knees between `(sx, sy)` and `(X_HIT, 0)`, with every leg fractal-subdivided
// via `zigzag()` so there are ZERO straight ruler lines ("不是死板折射线") while keeping a bold sawtooth silhouette!
function buildOrganicSawtoothBolt(seed, variantIdx) {
  const R = new Rng(seed * 733 + variantIdx * 97 + 19);
  const sx = X_ATK + 6;
  const sy = Y_VORTEX + 4;
  const shiftX = variantIdx === 1 ? -2.5 : variantIdx === 2 ? 2.5 : 0;

  // Asymmetric sawtooth lightning knees from mid-air vortex `(4, -44)` down to floor target `(54, 0)`
  const knees = [
    [sx, sy],
    [sx + 23 + shiftX, sy + 11], // Jagged lunge forward-right
    [sx + 12 - shiftX, sy + 23], // Sharp sawtooth snap back-left
    [sx + 39 + shiftX, sy + 31], // Jagged lunge forward-right
    [X_HIT, 0],                  // Ground impact at X_HIT
  ];

  const trunkPts = [];
  const forkPaths = [];

  for (let s = 0; s < knees.length - 1; s++) {
    const [ax, ay] = knees[s];
    const [bx, by] = knees[s + 1];
    // Fractal-subdivide each sawtooth leg so the channel has organic micro-jagged lightning kinks & forks!
    const legBolt = zigzag(R, ax, ay, bx, by, 0.23, 0.65);
    const mainLeg = legBolt.paths[0].pts;
    for (let i = 0; i < mainLeg.length; i++) {
      if (s > 0 && i === 0) continue;
      trunkPts.push([mainLeg[i][0], clamp(mainLeg[i][1], -92, 2)]);
    }
    for (let f = 1; f < legBolt.paths.length; f++) {
      forkPaths.push(legBolt.paths[f]);
    }
  }

  // Add long air-tearing sawtooth spurs branching out from the knees ("落雷撕裂空气的电弧")
  for (let k = 1; k < knees.length - 1; k++) {
    const [kx, ky] = knees[k];
    const side = k % 2 === 1 ? 1 : -1;
    const spurEndX = kx + side * R.range(16, 26);
    const spurEndY = clamp(ky + R.range(-6, 12), -88, 0);
    const spur = zigzag(R, kx, ky, spurEndX, spurEndY, 0.30, 0.45);
    for (const q of spur.paths) {
      forkPaths.push({ pts: q.pts, w: q.w * 0.85, kneeIdx: k });
    }
  }

  return { trunkPts, paths: [{ pts: trunkPts, w: 1 }, ...forkPaths] };
}

// Render the organic fractal-jagged Purple-Gold Sawtooth Lightning Bolt with vivid Purple-Gold contrast:
// Outer Royal-Purple Corona (`Storm[2..4]`) -> Blazing Golden Sawtooth Channel (`Gold[4..5]`) -> Crisp 1px White Core (`WHITE`)!
function drawOrganicPurpleGoldBolt(p, bolt, k, Storm, Gold, Plasma) {
  const tr = bolt.trunkPts;

  // 1. Air-tearing branching forks (`w < 1`) alternating between Royal-Purple, Blazing Gold, and Electric Cyan-White
  for (let f = 1; f < bolt.paths.length; f++) {
    const q = bolt.paths[f];
    const pts = q.pts;
    const isGold = f % 2 === 0;
    const outerCol = isGold ? Storm[3] : Storm[2];
    const innerCol = isGold ? Gold[4] : Storm[4];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      p.line(ax - 1, ay, bx - 1, by, outerCol, 0.65 * k);
      p.line(ax + 1, ay, bx + 1, by, outerCol, 0.65 * k);
      p.line(ax, ay, bx, by, i < pts.length * 0.45 ? WHITE : innerCol, 0.92 * k);
    }
  }

  // 2. Main Fractal-Jagged Trunk Pass A: Royal-Purple Storm Corona (`Storm[2]` & `Storm[3]`, radius ~2.1px)
  const rPurple = (1.5 + 0.7 * k);
  for (let i = 0; i < tr.length - 1; i++) {
    const [ax, ay] = tr[i];
    const [bx, by] = tr[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 1.5));
    for (let j = 0; j <= n; j++) {
      const u = j / n;
      const x = ax + (bx - ax) * u;
      const y = ay + (by - ay) * u;
      p.circle(x, y, rPurple + 0.8, Storm[2], 0.72 * k);
      p.circle(x, y, rPurple, Storm[3], 0.90 * k);
    }
    if (i % 4 === 0) {
      p.glow(ax, ay, 16, i % 8 === 0 ? Storm[3] : Gold[4], 0.32 * k);
    }
  }

  // 3. Main Fractal-Jagged Trunk Pass B: Blazing Golden-Yellow Sawtooth Body (`Gold[4]` & `Gold[5]`, radius ~1.15px)
  const rGold = (0.85 + 0.45 * k);
  for (let i = 0; i < tr.length - 1; i++) {
    const [ax, ay] = tr[i];
    const [bx, by] = tr[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 1.5));
    for (let j = 0; j <= n; j++) {
      const u = j / n;
      const x = ax + (bx - ax) * u;
      const y = ay + (by - ay) * u;
      p.circle(x, y, rGold, Gold[4], 0.96 * k);
      p.circle(x, y, rGold * 0.65, Gold[5], k);
    }
  }

  // 4. Main Fractal-Jagged Trunk Pass C: Crisp 1px White-Hot Core (`WHITE`)
  for (let i = 0; i < tr.length - 1; i++) {
    const [ax, ay] = tr[i];
    const [bx, by] = tr[i + 1];
    p.line(ax, ay, bx, by, WHITE, k);
  }
}

// Compute the furball's C1-continuous pose, fur expansion, eye expression, charring, and vortex state at time `t`
function computeFurballState(t) {
  let x = X_IDLE;
  let y = -R_BASE;
  let visible = true;
  let scale = 1.0;        // 1.0 normal .. 1.66 when puffed into the 3x sea-urchin ball
  let spikeLen = 3.2;     // fur spike length (3.2 normal .. 10.6 in 3x sea-urchin state)
  let squash = 0;         // < 0 squashed wide & flat, > 0 stretched along motion
  let tilt = 0;           // body lean / velocity orientation (always 0 at corner boundaries!)
  let vortexSpin = 0;     // spin angle when curling into the mid-air thunderstorm vortex
  let vortexMix = 0;      // 0..1 smooth blend between furball and thunderstorm vortex
  let joltFlash = 0;      // 0..1 white/cyan electric jolt silhouette flash
  let charMix = 0;        // 0..1 smooth charring transition right as the furball pops into black smoke!
  let shakeOffset = 0;    // horizontal shake offset
  let eyeMode = "normal"; // "normal" | "wince" | "coil" | "shake" | "angry" | "overload"

  if (t < T_QUIRK_ANTIC) {
    // =========================================================================
    // STATE 1: 【待机 IDLE (0.00..1.25s)】
    // Pure harmonic high-frequency left-and-right mini-hops (6 hops = 3 full left-right cycles),
    // starting and ending smoothly at exact rest `(X_IDLE, -R_BASE, squash=0, tilt=0)`!
    // =========================================================================
    const u = t / T_QUIRK_ANTIC;
    const env = Math.sin(u * Math.PI); // Smoothly ramps hop amplitude up from 0 and back to 0 at u=1
    const envBoost = Math.min(1, env * 1.45);
    const phase = u * 3 * TAU; // 3 full left-right cycles = 6 energetic mini-hops!

    x = X_IDLE + Math.sin(phase) * 7.2 * envBoost;
    const bounce = Math.abs(Math.sin(phase));
    y = -R_BASE - 8.5 * bounce * envBoost;
    squash = 0.26 * (bounce - 0.42) * envBoost;
    tilt = 0.18 * Math.cos(phase) * envBoost;
  } else if (t < T_MOVE_SQUASH) {
    // =========================================================================
    // STATE 2: 【生态小动作 ECO QUIRK (1.25..2.86s)】
    // Smooth 3-stage progression:
    // 2A (1.25..1.44s): Twin ahoge tufts bend inward & spark; furball winces/squashes inward
    // 2B (1.44..2.24s): Smooth S-curve inflation over 0.38s into 3x spiky sea-urchin + mosquito-coil eyes!
    // 2C (2.24..2.86s): Frantic left-right shake-off flinging waves of sparks while smoothly deflating!
    // =========================================================================
    x = X_IDLE;
    if (t < T_QUIRK_PUFF) {
      const u = seg(t, T_QUIRK_ANTIC, T_QUIRK_PUFF);
      const cringe = Math.sin(u * Math.PI);
      scale = 1.0 - 0.12 * cringe;
      squash = -0.26 * cringe;
      spikeLen = 3.2 + 1.5 * ease.inQuad(u);
      y = -R_BASE * scale * (1 + 0.3 * squash);
      shakeOffset = u > 0.45 ? Math.sin(t * 140) * 2.0 * u : 0;
      joltFlash = u > 0.65 ? 0.75 : 0;
      eyeMode = u > 0.35 ? "wince" : "normal";
    } else if (t < T_SHAKE) {
      const age = t - T_QUIRK_PUFF;
      const infU = clamp(age / 0.38, 0, 1);
      // Smooth S-curve inflation with gentle elastic wobble once inflated
      const infCurve = ease.inOutCubic(infU) + Math.sin(infU * Math.PI) * 0.10 * Math.sin(age * 20);
      const breathe = infU >= 1 ? 0.04 * Math.sin((age - 0.38) * 14) : 0;
      scale = lerp(1.0, 1.66, clamp(infCurve, 0, 1.06)) + breathe;
      spikeLen = lerp(4.7, 10.6, ease.outCubic(infU)) + breathe * 12;
      squash = age < 0.14 ? lerp(-0.18, 0.06, age / 0.14) : 0.04 * Math.cos(age * 14);
      y = -R_BASE * scale - 2.5 * ease.outQuad(infU);
      joltFlash = age < 0.14 ? (Math.floor(age * 45) % 2 === 0 ? 0.80 : 0.25) : 0;
      shakeOffset = age < 0.22 ? Math.sin(age * 130) * 2.0 * (1 - age / 0.22) : Math.sin(age * 12) * 0.9;
      eyeMode = "coil";
    } else {
      const u = seg(t, T_SHAKE, T_MOVE_SQUASH);
      const deflate = ease.inOutCubic(u);
      const waveRipple = 0.05 * Math.sin(u * Math.PI * 4) * (1 - u);
      scale = lerp(1.66, 1.0, deflate) + waveRipple;
      spikeLen = lerp(10.6, 3.2, deflate) + waveRipple * 10;
      y = -R_BASE * scale - 2.5 * (1 - deflate);
      const shakeEnv = Math.sin(u * Math.PI);
      shakeOffset = Math.sin(t * 88) * 6.0 * shakeEnv;
      tilt = Math.cos(t * 88) * 0.30 * shakeEnv;
      squash = -0.14 * shakeEnv * Math.abs(Math.sin(t * 44));
      eyeMode = u < 0.32 ? "coil" : u < 0.78 ? "shake" : "angry";
    }
  } else if (t < T_VORTEX) {
    // =========================================================================
    // STATE 3: 【移动 MOVE (2.86..4.36s)】
    // Smooth deep elastic crouch on the floor -> High-speed Z-shaped zigzag ricochet with C1-continuous corner rebounds!
    // =========================================================================
    if (t < T_ZIGZAG) {
      // 3A: Deep elastic rubber-ball crouch on the floor (`2.86..3.12s`, Frame 90 at `3.00s`!)
      //     Ends at `u = 1` with `squash = -0.32, tilt = 0`, matching `u = 0` of Z_NODES[0] with zero snap!
      const u = seg(t, T_MOVE_SQUASH, T_ZIGZAG);
      const crouch = Math.sin(Math.min(1, u * 1.15) * (Math.PI * 0.65));
      x = X_IDLE;
      squash = -0.44 * crouch;
      scale = 1.0 + 0.05 * crouch;
      y = -R_BASE * (1 + 0.42 * squash);
      tilt = 0;
      eyeMode = "angry";
    } else {
      // 3B: High-speed Z-shaped zigzag ricochet across `Z_NODES` (`3.12..4.36s`, Frames 105 & 119!)
      let segIdx = 0;
      for (let i = 0; i < Z_NODES.length - 1; i++) {
        if (t >= Z_NODES[i].t && t <= Z_NODES[i + 1].t) {
          segIdx = i;
          break;
        }
      }
      const n0 = Z_NODES[segIdx];
      const n1 = Z_NODES[segIdx + 1];
      const u = seg(t, n0.t, n1.t);

      if (segIdx === Z_NODES.length - 2) {
        // Final leg (`4.14..4.36s`): smooth parabolic upward leap into the mid-air Attack vortex apex!
        x = lerp(n0.x, n1.x, ease.inOutSine(u));
        y = lerp(n0.y, n1.y, ease.outQuad(u));
      } else {
        const moveU = lerp(u, ease.inOutSine(u), 0.32);
        x = lerp(n0.x, n1.x, moveU);
        y = lerp(n0.y, n1.y, moveU);
      }

      // Smooth C1 corner squash-and-stretch:
      // At u=0 and u=1 (every Z-corner), flightArch=0 so squash=-0.30 and tilt=0 on BOTH sides of every corner!
      // In mid-segment (u=0.5), flightArch=1 so squash=+0.22 and tilt aligns with the flight vector!
      const flightArch = Math.sin(u * Math.PI);
      const legAngle = Math.atan2(n1.y - n0.y, n1.x - n0.x);
      squash = lerp(-0.30, 0.22, flightArch);
      tilt = legAngle * 0.28 * flightArch;

      // During the final upward leap (`t >= 4.16s`), smoothly spin up into the purple-gold thunderstorm vortex!
      if (t >= 4.16) {
        const spinU = seg(t, 4.16, T_VORTEX + 0.10);
        vortexMix = ease.inOutQuad(spinU);
        vortexSpin = spinU * spinU * 7.5;
        scale = 1.0 + 0.28 * vortexMix;
        spikeLen = 3.2 + 4.4 * vortexMix;
        squash *= 1 - vortexMix;
      }
      eyeMode = "angry";
    }
  } else if (t < T_FALL) {
    // =========================================================================
    // STATE 4: 【攻击 ATTACK & SCORCHED GRID HIT (4.36..5.65s)】
    // Mid-air spinning purple-gold thunderstorm vortex -> Stepped leader -> Jagged purple-gold bolt -> Channel crumble!
    // =========================================================================
    const age = t - T_VORTEX;

    // Physical recoil kickback on each return stroke of the lightning bolt
    let recoil = 0;
    for (const st of BOLT_STROKES) {
      if (t >= st.t && t < st.t + 0.25) {
        recoil = Math.max(recoil, Math.exp(-(t - st.t) * 10) * 4.5 * st.k);
      }
    }

    const spinIn = smooth(4.16, 4.44, t);
    const spinOut = 1 - smooth(5.32, T_FALL + 0.12, t);
    vortexMix = spinIn * spinOut;
    vortexSpin = 2.2 + age * 26 * (0.45 + 0.55 * spinOut);

    x = X_ATK - recoil * 0.7;
    y = Y_VORTEX - recoil + Math.sin(age * 16) * 1.5 * spinOut;
    scale = 1.0 + 0.30 * vortexMix + 0.07 * Math.sin(age * 50) * vortexMix;
    spikeLen = 3.2 + 4.6 * vortexMix;
    eyeMode = t > 5.42 ? "overload" : "angry";
  } else {
    // =========================================================================
    // STATE 5: 【倒地 KO & CHARRED SMOKE DISSIPATION (5.65..7.50s)】
    // Unified continuous gravity fall & bounce (`5.65..6.12s`) with runaway static ->
    // Pre-pop capacitor swell & charring (`6.12..6.36s`) -> Billowing charred black smoke & stray sparks (`6.30..7.18s`)
    // -> Smooth re-condensation at X_IDLE (`7.06..7.50s`)!
    // =========================================================================
    if (t < T_POP + 0.08) {
      // 5A: Continuous gravity drop from `(X_ATK, Y_VORTEX)` to `(X_KO, -R_BASE)` with one elastic bounce,
      //     followed by runaway static twitching, capacitor swell, and smooth charring into the black smoke cloud!
      const u = seg(t, T_FALL, T_POP);
      const moveU = clamp(u / 0.62, 0, 1);
      x = lerp(X_ATK, X_KO, ease.inOutSine(moveU));

      if (u < 0.44) {
        // Gravity fall from Y_VORTEX (-48) to floor (-R_BASE)
        const fu = u / 0.44;
        y = lerp(Y_VORTEX, -R_BASE, fu * fu);
        squash = fu > 0.82 ? lerp(0.18, -0.32, (fu - 0.82) / 0.18) : 0.18 * Math.sin(fu * Math.PI);
      } else if (u < 0.72) {
        // Elastic floor bounce
        const bu = (u - 0.44) / 0.28;
        const arc = 4 * bu * (1 - bu);
        y = -R_BASE - 9.5 * arc;
        squash = bu < 0.25 ? lerp(-0.32, 0.12, bu / 0.25) : lerp(0.12, -0.15, (bu - 0.25) / 0.75);
      } else {
        // Floor overload twitch & pre-pop capacitor swell
        y = -R_BASE;
        squash = -0.14 * Math.cos((u - 0.72) * 35);
      }

      const prePop = smooth(0.74, 1.0, u);
      // Smoothly char & blend into the black smoke cloud across `t = 6.22..6.38s` so there is zero 1-frame vanish!
      charMix = smooth(T_POP - 0.08, T_POP + 0.08, t);
      scale = 1.0 + 0.10 * Math.sin(t * 85) * (1 - prePop) + 0.36 * ease.inQuad(prePop);
      spikeLen = 4.6 + 2.4 * Math.sin(t * 100) + 3.2 * prePop;
      shakeOffset = Math.sin(t * 135) * (2.6 + 2.2 * prePop) * (1 - charMix * 0.7);
      joltFlash = (prePop > 0.45 && charMix < 0.5) || Math.floor(t * 30) % 3 === 0 ? 0.70 * (1 - charMix) : 0.0;
      eyeMode = "overload";
    } else if (t < T_REVIVE) {
      // 5B: Body has fully transformed into billowing charred black smoke & stray electric sparks! (Frames 194 & 209!)
      visible = false;
      x = X_KO;
      y = -R_BASE - 3;
    } else {
      // 5C: Smooth re-condensation at X_IDLE (`7.06..7.50s`, Frame 224 at `7.47s`!)
      //     Reaches exact rest `(X_IDLE, -R_BASE, scale=1, spikeLen=3.2, squash=0, tilt=0)` by `t = 7.45s`!
      const u = seg(t, T_REVIVE, D);
      const growU = ease.inOutCubic(clamp(u / 0.85, 0, 1));
      visible = true;
      x = lerp(X_KO * 0.20 + X_IDLE * 0.80, X_IDLE, ease.outCubic(clamp(u / 0.80, 0, 1)));
      const settleBounce = Math.sin(u * Math.PI) * 3.2 * (1 - growU * 0.6);
      scale = lerp(0.30, 1.0, growU);
      spikeLen = lerp(1.2, 3.2, growU);
      squash = 0.12 * Math.sin(u * TAU) * (1 - growU);
      y = -R_BASE * scale - settleBounce;
      joltFlash = u < 0.25 ? 0.55 * (1 - u / 0.25) : 0;
      eyeMode = "normal";
    }
  }

  return {
    x: x + shakeOffset,
    baseX: x,
    y,
    visible,
    scale,
    spikeLen,
    squash,
    tilt,
    vortexSpin,
    vortexMix,
    joltFlash,
    charMix,
    shakeOffset,
    eyeMode,
  };
}

// 1. DRAW THE GOLDEN STATIC FURBALL, TWIN LIGHTNING AHOGE TUFTS, MOSQUITO-COIL EYES & THUNDERSTORM VORTEX
function drawVoltFurballBody(g, p, Gold, Plasma, Storm, FState, t, seed) {
  if (!FState.visible) return;
  g.clear();

  const cx = FState.x;
  const cy = FState.y;
  const rx = R_BASE * FState.scale * (1 - 0.35 * FState.squash);
  const ry = R_BASE * FState.scale * (1 + 0.42 * FState.squash);
  const cosT = Math.cos(FState.tilt);
  const sinT = Math.sin(FState.tilt);

  const pad = Math.ceil(Math.max(rx, ry) + FState.spikeLen + 16);

  // Pass A: Shade the Fluffy Golden Static Furball / 3x Spiky Sea-Urchin / Spinning Thunderstorm Vortex
  g.shade(cx - pad, cy - pad, cx + pad, Math.min(2, cy + pad), (wx, wy, o) => {
    if (wy > 1.5) return 0;
    const dx = wx - cx;
    const dy = wy - cy;
    const lx = dx * cosT + dy * sinT;
    const ly = -dx * sinT + dy * cosT;

    const nx = lx / rx;
    const ny = ly / ry;
    const rNorm = Math.hypot(nx, ny);
    const ang = Math.atan2(ny, nx);

    const nSpikes = FState.scale > 1.25 ? 28 : 22;
    const spinOff = FState.vortexMix > 0.05 ? FState.vortexSpin : t * 4.0;
    const spikeWave = Math.pow(Math.abs(Math.cos((ang + spinOff * 0.15) * (nSpikes * 0.5))), 1.7);
    const altLen = 0.65 + 0.35 * Math.sin(ang * 7 + seed);
    const maxR = 1.0 + (FState.spikeLen / Math.max(rx, ry)) * spikeWave * altLen;

    if (rNorm > maxR) return 0;

    o.a = 1;
    o.t = 1;

    // 1. Smooth Charring Transition into Black Smoke (`FState.charMix > 0`, `6.22..6.38s`)
    if (FState.charMix > 0.15) {
      if (rNorm < 1 - FState.charMix * 0.85) return WHITE;
      return rNorm > 0.85 ? CHAR_SMOKE[3] : CHAR_SMOKE[1];
    }

    // 2. Mid-Air Spinning Thunderstorm Vortex pattern (`FState.vortexMix > 0.25`, Frame 134 & Frame 149!)
    if (FState.vortexMix > 0.25) {
      const spiral = Math.sin(ang * 3 - FState.vortexSpin + rNorm * 6.5);
      if (rNorm < 0.30) return WHITE;
      if (spiral > 0.42) return rNorm < 0.72 ? WHITE : Gold[5];
      if (spiral > -0.05) return Gold[4];
      if (spiral > -0.48) return Storm[4];
      return rNorm > 0.78 ? Storm[1] : Storm[2];
    }

    // 3. Electric Jolt Silhouette Flash during Self-Zap or Runaway Static Overload
    if (FState.joltFlash > 0.5) {
      if (rNorm < 0.42) return WHITE;
      if (rNorm < 0.80) return Plasma[4];
      return Gold[4];
    }

    // 4. Normal / Sea-Urchin Fluffy Golden-Yellow Static Furball shading
    const staticSpeck = Math.sin(lx * 1.9 + t * 25) * Math.cos(ly * 1.9 - t * 20) > 0.72;
    if (staticSpeck && rNorm < 0.88) {
      return rNorm < 0.55 ? WHITE : Gold[5];
    }

    const lit = -nx * 0.55 - ny * 0.68 + (1 - rNorm) * 0.45;
    if (rNorm > 1.02) {
      return spikeWave > 0.65 ? Gold[5] : Gold[4];
    }
    if (lit > 0.52) return Gold[5];
    if (lit > 0.16) return Gold[4];
    if (lit > -0.22) return Gold[3];
    return Gold[2];
  });

  // Pass B: Shade the Two Lightning-Bolt Ahoge Tufts on the Crown ("头顶两撮闪电状的呆毛"),
  //         smoothly folding in/out as `vortexMix` or `charMix` changes!
  const tuftScale = (1 - smooth(0.20, 0.75, FState.vortexMix)) * (1 - FState.charMix);
  if (tuftScale > 0.15) {
    const anticInward = t >= T_QUIRK_ANTIC && t < T_QUIRK_PUFF + 0.12
      ? Math.sin(seg(t, T_QUIRK_ANTIC, T_QUIRK_PUFF + 0.12) * Math.PI)
      : 0;
    const wag = Math.sin(t * 24) * 2.2 * (1 - anticInward) + FState.shakeOffset * 0.35;
    const sEff = FState.scale * tuftScale;
    for (const side of [-1, 1]) {
      const spread = side * (1 - 0.65 * anticInward);
      const bx = cx + side * (rx * 0.28);
      const by = cy - ry * 0.88;
      const k1x = bx + spread * 4.5 * tuftScale + wag * 0.4;
      const k1y = by - 5.5 * sEff;
      const k2x = bx + spread * 1.2 * tuftScale + wag * 0.6;
      const k2y = by - 7.5 * sEff;
      const tipX = bx + spread * 6.8 * tuftScale + wag;
      const tipY = by - 13.5 * sEff;

      const drawSeg = (x0, y0, x1, y1, w0, w1) => {
        const steps = 10;
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const px = lerp(x0, x1, u);
          const py = lerp(y0, y1, u);
          const hw = lerp(w0, w1, u);
          for (let dy = -Math.ceil(hw); dy <= Math.ceil(hw); dy++) {
            for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
              if (dx * dx + dy * dy <= hw * hw + 0.2) {
                g.set(Math.round(px + dx), Math.round(py + dy), u > 0.65 ? WHITE : Gold[5], 1, 2);
              }
            }
          }
        }
      };
      drawSeg(bx, by, k1x, k1y, 1.5, 1.2);
      drawSeg(k1x, k1y, k2x, k2y, 1.2, 1.2);
      drawSeg(k2x, k2y, tipX, tipY, 1.2, 0.6);
    }
  }

  // Pass C: Draw Expressive Eyes (smoothly scaling mosquito-coil spirals "蚊香圈", wince, angry, or overload!)
  if (FState.vortexMix < 0.75 && FState.charMix < 0.6) {
    const eyeY = Math.round(cy - ry * 0.08);
    const eyeSep = Math.max(4, Math.round(rx * 0.36));

    if (FState.eyeMode === "coil") {
      // Smoothly dilates from 2.2px -> 4.6px as the furball inflates to 1.66x, and contracts as it deflates!
      const puffFrac = clamp((FState.scale - 1.0) / 0.62, 0, 1);
      const coilR = lerp(2.2, 4.6, puffFrac);
      const iR = Math.ceil(coilR);
      for (const side of [-1, 1]) {
        const ex = Math.round(cx + side * eyeSep);
        const ey = eyeY;
        for (let dy = -iR; dy <= iR; dy++) {
          for (let dx = -iR; dx <= iR; dx++) {
            const d = Math.hypot(dx, dy);
            if (d > coilR) continue;
            const a = Math.atan2(dy, dx) * side - t * 14;
            const onLine = d < 0.9 || Math.sin(d * 2.35 + a) > 0.12;
            g.set(ex + dx, ey + dy, onLine ? Gold[0] : WHITE, 1, 3);
          }
        }
      }
    } else if (FState.eyeMode === "shake" || FState.eyeMode === "wince") {
      const lx = Math.round(cx - eyeSep);
      const rxE = Math.round(cx + eyeSep);
      for (let k = -2; k <= 2; k++) {
        g.set(lx + Math.abs(k) - 1, eyeY + k, Gold[0], 1, 3);
        g.set(lx + Math.abs(k), eyeY + k, Gold[0], 1, 3);
        g.set(rxE - Math.abs(k) + 1, eyeY + k, Gold[0], 1, 3);
        g.set(rxE - Math.abs(k), eyeY + k, Gold[0], 1, 3);
      }
    } else if (FState.eyeMode === "overload") {
      for (const side of [-1, 1]) {
        const ex = Math.round(cx + side * eyeSep);
        for (let k = -2; k <= 2; k++) {
          g.set(ex + k, eyeY + k, Gold[0], 1, 3);
          g.set(ex + k, eyeY - k, Gold[0], 1, 3);
        }
        g.set(ex, eyeY, Plasma[4], 1, 3);
      }
    } else if (FState.eyeMode === "angry") {
      for (const side of [-1, 1]) {
        const ex = Math.round(cx + side * (eyeSep * 0.85));
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            g.set(ex + dx, eyeY + dy, dy === -1 && dx === -side ? Gold[0] : WHITE, 1, 3);
          }
        }
        g.set(ex - side * 2, eyeY - 2, Gold[0], 1, 3);
        g.set(ex - side * 1, eyeY - 2, Gold[0], 1, 3);
        g.set(ex, eyeY - 1, Gold[0], 1, 3);
      }
    } else {
      for (const side of [-1, 1]) {
        const ex = Math.round(cx + side * eyeSep);
        for (let ky = -1; ky <= 1; ky++) {
          g.set(ex, eyeY + ky, Gold[0], 1, 3);
          g.set(ex + 1, eyeY + ky, Gold[0], 1, 3);
        }
        g.set(ex, eyeY - 1, WHITE, 1, 3);
        g.set(ex - side, eyeY - 2, Gold[1], 1, 3);
        g.set(ex, eyeY - 2, Gold[1], 1, 3);
      }
    }
  }

  // 1px dark outline around the furball and its lightning ahoge tufts
  g.outline(() => (FState.charMix > 0.3 ? CHAR_SMOKE[0] : FState.vortexMix > 0.4 ? Storm[0] : Gold[0]));
  g.draw(p);

  const glowR = (rx + FState.spikeLen) * 1.60;
  p.glow(cx, cy, glowR, FState.vortexMix > 0.4 ? Storm[3] : Gold[3], 0.32 + 0.16 * FState.vortexMix);
  p.glow(cx, cy, glowR * 0.48, Gold[5], 0.24);

  // Floating golden static particles orbiting & fuzzing around the furball ("由金黄色静电粒子组成的毛茸茸圆球")
  const R = new Rng(seed * 61 + Math.floor(t * 30));
  const nMotes = FState.scale > 1.3 ? 22 : 12;
  for (let i = 0; i < nMotes; i++) {
    const a = (i / nMotes) * TAU + t * 5.5 + R.range(-0.2, 0.2);
    const d = Math.max(rx, ry) + FState.spikeLen * 0.6 + R.range(1.5, 6.5);
    const mx = cx + Math.cos(a) * d;
    const my = cy + Math.sin(a) * d;
    p.dot(mx, my, i % 3 === 0 ? WHITE : Gold[4], 0.9);
  }
}

// 2. STATE 2 ECO QUIRK: SELF-ZAP AHOGE ARC, PROGRESSIVE SEA-URCHIN INFLATION & FRANTIC SPARK SHAKE-OFF
function drawEcoQuirkSparks(p, Gold, Plasma, FState, t, seed) {
  if (t < T_QUIRK_ANTIC || t >= T_MOVE_SQUASH + 0.10) return;
  const frameSlot = Math.floor(t * 30);
  const boltRamp = [Plasma[0], Plasma[1], Plasma[2], Plasma[3], Plasma[4], Gold[4], Gold[5], WHITE];
  const R = new Rng(seed * 103 + frameSlot * 13);

  // 2A: Crisp self-zap arc snapping between the twin lightning ahoge tufts and branching across the forehead (`1.25..1.66s`, Frame 45!)
  if (t < 1.66) {
    const zapA = smooth(T_QUIRK_ANTIC, T_QUIRK_ANTIC + 0.08, t) * (1 - smooth(1.54, 1.66, t));
    const crownY = FState.y - R_BASE * FState.scale - 7;
    const ahogeArc = zigzag(R, FState.x - 5, crownY - 3, FState.x + 5, crownY - 3, 0.36, 0.35);
    crackle(p, ahogeArc, 0.95 * zapA, boltRamp, 0.35, zapA);
    if (t >= T_QUIRK_PUFF - 0.06) {
      for (const side of [-1, 1]) {
        const selfBolt = zigzag(R, FState.x + side * 2, crownY - 2, FState.x + side * 8, FState.y - 2, 0.38, 0.35);
        crackle(p, selfBolt, 0.92 * zapA, boltRamp, 0.38, zapA);
      }
      sparkle(p, FState.x, crownY - 2, 3.5 * zapA, WHITE, Plasma[4], 0.65 * zapA);
    }
  }

  // 2B: Surface static arcs & dizzy stars during the 3x sea-urchin puff (`1.44..2.24s`, Frames 45 & 60!)
  if (t >= T_QUIRK_PUFF && t < T_SHAKE) {
    const age = t - T_QUIRK_PUFF;
    const rad = R_BASE * FState.scale + 5;
    const nArcs = age < 0.28 ? 5 : 3;
    for (let i = 0; i < nArcs; i++) {
      const a0 = R.range(0, TAU);
      const a1 = a0 + R.range(0.7, 1.5);
      const b = zigzag(
        R,
        FState.x + Math.cos(a0) * rad * 0.68,
        FState.y + Math.sin(a0) * rad * 0.68,
        FState.x + Math.cos(a1) * rad,
        FState.y + Math.sin(a1) * rad,
        0.38,
        0.3
      );
      crackle(p, b, 0.85, boltRamp, 0.4, 0.92);
    }
    for (let s = 0; s < 3; s++) {
      const sa = age * 7 + (s / 3) * TAU;
      const sx = FState.x + Math.cos(sa) * 16 * (FState.scale / 1.6);
      const sy = FState.y - (R_BASE * FState.scale + 8) + Math.sin(sa) * 3.5;
      sparkle(p, sx, sy, 2.5, WHITE, Gold[4], 0.65);
    }
  }

  // 2C: Frantic body shake-off flinging a 360-degree burst of golden & blue-white static sparks (`2.24..2.92s`, Frame 75 at 2.50s!)
  if (t >= T_SHAKE) {
    const shakeAge = t - T_SHAKE;
    const sparkCols = [WHITE, Gold[5], Gold[4], Plasma[4]];
    for (let wave = 0; wave < 6; wave++) {
      const wAge = shakeAge - wave * 0.08;
      if (wAge <= 0 || wAge > 0.36) continue;
      for (let i = 0; i < 12; i++) {
        const r = rng(seed, wave * 31 + i, 211);
        const life = r.range(0.24, 0.36);
        if (wAge >= life) continue;
        const ang = (i / 12) * TAU + wave * 0.55 + r.range(-0.18, 0.18);
        const sp = r.range(60, 122);
        const [sx, sy, vx, vy] = flight(
          X_IDLE + Math.cos(ang) * 15,
          -18 + Math.sin(ang) * 15,
          Math.cos(ang) * sp,
          Math.sin(ang) * sp - 22,
          wAge,
          { floor: 0 }
        );
        if (sx < -104 || sx > 118) continue;
        spark(p, sx, sy, vx, vy, 1 - wAge / life, sparkCols);
        if (i % 3 === 0) {
          p.dot(sx, sy - 1, Plasma[4], 1 - wAge / life);
        }
      }
    }
  }
}

// 3. STATE 3 MOVE: Z-SHAPED ZIGZAG RICOCHET & BLUE-WHITE LIGHTNING POLYLINE AFTERIMAGE
//    ("像一颗充满弹性的皮球在地面呈Z字形高速弹射跳跃并留下蓝白色的闪电折线残影", Frames 90, 105, 119!)
function drawZigzagBounceAfterimage(p, Gold, Plasma, FState, t, seed) {
  if (t < T_MOVE_SQUASH || t > T_VORTEX + 0.22) return;

  const pRamp = [Plasma[0], Plasma[1], Plasma[2], Plasma[3], Plasma[4], Plasma[5], WHITE, WHITE];
  const R = new Rng(seed * 229 + Math.floor(t * 15));

  // 3A: Floor charge sparks during initial rubber-ball crouch (`2.86..3.12s`, Frame 90 at `3.00s`)
  if (t < T_ZIGZAG) {
    const u = seg(t, T_MOVE_SQUASH, T_ZIGZAG);
    for (let i = 0; i < 4; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const b = zigzag(R, FState.x + side * 6, -2, FState.x + side * (14 + 12 * u), -1 - R.range(0, 10), 0.35, 0.3);
      crackle(p, b, 0.85, pRamp, 0.4, 0.9);
    }
    return;
  }

  // 3B: Persistent Blue-White Lightning Polyline Afterimage connecting the Z-ricochet vertices,
  //     smoothly dissolving as the furball arrives at the mid-air Attack vortex (`4.20..4.54s`)!
  const fadeOut = 1 - smooth(T_VORTEX - 0.12, T_VORTEX + 0.18, t);
  if (fadeOut <= 0.02) return;

  for (let i = 0; i < Z_NODES.length - 1; i++) {
    const n0 = Z_NODES[i];
    const n1 = Z_NODES[i + 1];
    if (t < n0.t) break;

    const segProgress = clamp((t - n0.t) / (n1.t - n0.t), 0, 1);
    const segAge = Math.max(0, t - n1.t);
    const segAlpha = Math.max(0.42, 1 - segAge * 0.58) * fadeOut;

    const ex = lerp(n0.x, n1.x, segProgress);
    const ey = lerp(n0.y, n1.y, segProgress);

    // Organic crackling blue-white lightning polyline afterimage along each Z-leg (no straight ruler lines!)
    const zbMain = zigzag(R, n0.x, n0.y, ex, ey, 0.11, 0.28);
    const zbSub = zigzag(R, n0.x, n0.y - 1, ex, ey - 1, 0.13, 0.15);
    crackle(p, zbSub, 0.72 * segAlpha, pRamp, 0.25, segAlpha * 0.75);
    crackle(p, zbMain, 0.96 * segAlpha, pRamp, 0.38, segAlpha);

    const nodeFade = Math.max(0.42, 1 - (t - n0.t) * 0.58) * fadeOut;
    p.ring(n0.x, n0.y, 4.8, 1, Plasma[4], nodeFade * 0.85);
    sparkle(p, n0.x, n0.y, 4.8 * nodeFade, WHITE, Plasma[3], 0.72 * nodeFade);
    p.glow(n0.x, n0.y, 13, Plasma[3], 0.35 * nodeFade);
  }
}

// 4. STATE 4 ATTACK: MID-AIR THUNDERSTORM VORTEX, STEPPED LEADER, ORGANIC FRACTAL-JAGGED PURPLE-GOLD SAWTOOTH BOLT,
//    COOLING/CRUMBLING CHANNEL & SCORCHED FLOOR ELECTRIC GRID (Frames 134, 149, 164!)
function drawThunderstormAttackAndScorchedGrid(p, Gold, Plasma, Storm, FState, t, seed, layer) {
  if (t < T_VORTEX - 0.12 || t > T_FALL + 0.45) return;

  const pgRamp = [Storm[1], Storm[2], Storm[3], Gold[3], Gold[4], Gold[5], WHITE, WHITE];

  // 4A: Floor Target Sigil & Scorched Black Electric Grid on the Ground (`layer === "back"`)
  //     ("地面被劈出焦黑电网的命中结果特效", Frames 149 & 164!)
  if (layer === "back") {
    const cyGrid = 4;

    if (t >= T_LEAD && t < T_STRIKE) {
      const chargeK = seg(t, T_LEAD, T_STRIKE);
      const rx = 26 * ease.outQuad(chargeK);
      const ry = 6.0 * ease.outQuad(chargeK);
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * TAU + t * 4;
        if (i % 2 === 0) {
          p.dot(X_HIT + Math.cos(a) * rx, cyGrid + Math.sin(a) * ry, i % 4 === 0 ? Gold[5] : Storm[4], chargeK * 0.85);
        }
      }
      p.glow(X_HIT, cyGrid, 22 * chargeK, Storm[3], 0.35 * chargeK);
      return;
    }

    if (t < T_STRIKE) return;
    const hitAge = t - T_STRIKE;
    const gridDur = 1.32;
    if (hitAge > gridDur) return;
    const gu = hitAge / gridDur;
    const fade = 1 - smooth(0.72, 1.0, gu);
    const heat = Math.pow(clamp(1 - hitAge / 0.98), 1.15);

    const gridRx = 42 * ease.outCubic(Math.min(1, hitAge / 0.14));
    const gridRy = 9.5 * ease.outCubic(Math.min(1, hitAge / 0.14));

    // 1. Charred black scorch crater ellipse burned into the floor (`#07050c` / `#130f1c`)
    for (let dy = -Math.ceil(gridRy + 2); dy <= Math.ceil(gridRy + 2); dy++) {
      for (let dx = -Math.ceil(gridRx + 2); dx <= Math.ceil(gridRx + 2); dx++) {
        const d = Math.hypot(dx / (gridRx + 1), dy / (gridRy + 1));
        if (d > 1) continue;
        p.blend(X_HIT + dx, cyGrid + dy, d < 0.65 ? CHAR_SMOKE[0] : CHAR_SMOKE[1], (1 - d * 0.5) * 0.88 * fade);
      }
    }

    // 2. Scorched Black Electric Grid ("焦黑电网"):
    //    3 concentric elliptical grid rings + 12 radial spokes!
    for (let s = 0; s < 12; s++) {
      const a = (s / 12) * TAU + 0.15;
      const x1 = X_HIT + Math.cos(a) * gridRx;
      const y1 = cyGrid + Math.sin(a) * gridRy;
      p.line(X_HIT, cyGrid + 1, x1, y1 + 1, SOOT, fade * 0.95);
      const pulse = 0.5 + 0.5 * Math.sin(hitAge * 32 - s * 1.1);
      const veinCol = heat > 0.35 && pulse > 0.50 ? Gold[4] : heat > 0.15 ? Storm[4] : Storm[2];
      p.line(X_HIT, cyGrid, x1, y1, veinCol, fade * (0.55 + 0.45 * heat));
    }

    for (const frac of [0.36, 0.68, 1.0]) {
      const rx = gridRx * frac;
      const ry = gridRy * frac;
      for (let i = 0; i < 36; i++) {
        const a0 = (i / 36) * TAU;
        const a1 = ((i + 1) / 36) * TAU;
        const x0 = X_HIT + Math.cos(a0) * rx;
        const y0 = cyGrid + Math.sin(a0) * ry;
        const x1 = X_HIT + Math.cos(a1) * rx;
        const y1 = cyGrid + Math.sin(a1) * ry;
        p.line(x0, y0 + 1, x1, y1 + 1, SOOT, fade * 0.92);
        const nodeHot = (i % 3 === 0) && Math.sin(i * 1.7 + hitAge * 38) > 0.2;
        const col = nodeHot ? WHITE : frac < 0.7 ? Gold[4] : Storm[4];
        p.line(x0, y0, x1, y1, col, fade * (0.55 + 0.45 * heat));
      }
    }

    p.glow(X_HIT, cyGrid, gridRx * 0.95, Storm[3], 0.45 * heat * fade);
    p.glow(X_HIT, cyGrid, gridRx * 0.55, Gold[4], 0.38 * heat * fade);
    return;
  }

  // FOREGROUND LAYER (`layer === "front"`):
  const frameSlot = Math.floor(t * 30);
  const R = new Rng(seed * 317 + frameSlot * 19);

  // 4B: Spinning Purple-Gold Thunderstorm Vortex Rings & Air-Tearing Charge Arcs (Frames 134, 149, 164!)
  if (FState.vortexMix > 0.15) {
    const vm = FState.vortexMix;
    for (let ring = 0; ring < 2; ring++) {
      const rr = (18 + ring * 6) * vm;
      const tilt = ring === 0 ? 0.55 : -0.55;
      const cosA = Math.cos(tilt);
      const sinA = Math.sin(tilt);
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU + FState.vortexSpin * (ring === 0 ? 1 : -1.2);
        const ox = Math.cos(a) * rr;
        const oy = Math.sin(a) * rr * 0.45;
        const wx = FState.x + ox * cosA - oy * sinA;
        const wy = FState.y + ox * sinA + oy * cosA;
        const col = i % 3 === 0 ? WHITE : i % 2 === 0 ? Gold[4] : Storm[4];
        p.dot(wx, wy, col, vm * 0.92);
      }
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + FState.vortexSpin * 0.4 + R.range(-0.3, 0.3);
      const d0 = 12;
      const d1 = R.range(24, 34);
      const zb = zigzag(
        R,
        FState.x + Math.cos(a) * d0,
        FState.y + Math.sin(a) * d0,
        FState.x + Math.cos(a + 0.4) * d1,
        FState.y + Math.sin(a + 0.4) * d1,
        0.36,
        0.4
      );
      stroke(p, zb, 0.80 * vm, pgRamp, 0.70, { light: 0.35, a: vm });
    }
  }

  const bolts = [
    buildOrganicSawtoothBolt(seed, 0),
    buildOrganicSawtoothBolt(seed, 1),
    buildOrganicSawtoothBolt(seed, 2),
  ];

  // 4C: Stepped Leader feeling down from the mid-air vortex to the floor (`T_LEAD .. T_STRIKE`)
  if (t >= T_LEAD && t < T_STRIKE) {
    const u = seg(t, T_LEAD, T_STRIKE);
    const steps = 6;
    const st = Math.min(steps, Math.floor(u * steps) + 1);
    const sy = Y_VORTEX + 4;
    const reachY = lerp(sy, 0, Math.pow(st / steps, 1.15));
    for (const q of bolts[0].paths) {
      const tk = q.w >= 1;
      for (let i = 0; i < q.pts.length - 1; i++) {
        const [ax, ay] = q.pts[i];
        const [bx, by] = q.pts[i + 1];
        if (by > reachY) {
          if (ay <= reachY && i > 0) {
            p.px(ax, ay, WHITE);
            p.glow(ax, ay, 8, Gold[4], 0.55);
          }
          break;
        }
        p.line(ax, ay, bx, by, tk ? Gold[4] : Storm[4], 0.85);
      }
    }
    if (u > 0.45) {
      const streamer = zigzag(R, X_HIT, 0, X_HIT - 6, -16 * ((u - 0.45) / 0.55), 0.35, 0.3);
      crackle(p, streamer, 0.85, pgRamp, 0.4);
    }
  }

  // 4D: Main Organic Fractal-Jagged Purple-Gold Sawtooth Bolt, Air-Tearing Arcs & Cooling/Crumbling Channel (`T_STRIKE .. T_CRUMBLE_END`)
  if (t >= T_STRIKE && t < T_CRUMBLE_END) {
    let activeStroke = null;
    for (let i = BOLT_STROKES.length - 1; i >= 0; i--) {
      if (t >= BOLT_STROKES[i].t) {
        const a = t - BOLT_STROKES[i].t;
        activeStroke = { i, s: BOLT_STROKES[i], a, k: boltLevel(a) * BOLT_STROKES[i].k };
        break;
      }
    }

    const nextStroke = BOLT_STROKES.find((q) => q.t > t);
    if (nextStroke && nextStroke !== BOLT_STROKES[0] && t > nextStroke.t - 0.05) {
      const tr = bolts[BOLT_STROKES.indexOf(nextStroke)].trunkPts;
      const u = (t - (nextStroke.t - 0.05)) / 0.05;
      const i1 = Math.floor(u * tr.length);
      trace(p, tr, Storm[3], 1);
      trace(p, tr, Gold[5], 1, i1 - 14, i1);
    } else if (activeStroke && activeStroke.k > 0) {
      const curBolt = bolts[activeStroke.i];
      const k = activeStroke.k;
      drawOrganicPurpleGoldBolt(p, curBolt, k, Storm, Gold, Plasma);

      // Additional dynamic air-tearing electric arcs ("落雷撕裂空气的电弧") crackling along the sawtooth path!
      const tr = curBolt.trunkPts;
      for (let b = 0; b < 4; b++) {
        const idx = Math.floor(((b + 0.5) / 4) * (tr.length - 2)) + 1;
        const [kx, ky] = tr[idx];
        const side = b % 2 === 0 ? 1 : -1;
        const airArc = zigzag(R, kx, ky, kx + side * R.range(14, 24), ky + R.range(-10, 10), 0.38, 0.45);
        crackle(p, airArc, 0.90 * k, pgRamp, 0.38, k);
      }

      // Impact flash & plasma rings at `(X_HIT, 0)`
      const rImp = 4.2 * k;
      p.circle(X_HIT, 0, rImp + 1.8, Storm[3]);
      p.circle(X_HIT, 0, rImp + 0.6, Gold[4]);
      p.circle(X_HIT, 0, rImp * 0.65, WHITE);
      sparkle(p, X_HIT, -1, Math.round(12 * k), WHITE, Gold[4], 0.75 * k);
      p.glow(X_HIT, -2, 34, Gold[4], 0.45 * k);
    } else if (activeStroke) {
      // Spent lightning channel cooling from white-gold to purple-gold and crumbling from top to bottom into sparks!
      // (Visible in Frame 164 at `t = 5.47s`!)
      const last = BOLT_STROKES[BOLT_STROKES.length - 1];
      const tr = bolts[activeStroke.i].trunkPts;
      const crumbleAge = t - (last.t + 0.22);
      for (let i = 0; i < tr.length - 1; i++) {
        const uY = i / tr.length;
        const goneAt = 0.08 + 0.38 * (0.45 * rand(seed, i, 51) + 0.55 * uY);
        if (crumbleAge >= goneAt) {
          if (crumbleAge < goneAt + 0.16) {
            const mAge = crumbleAge - goneAt;
            const mx = tr[i][0] + (rand(seed, i, 52) - 0.5) * 18 * mAge;
            const my = tr[i][1] + mAge * 14;
            p.dot(mx, my, i % 2 === 0 ? Gold[4] : Storm[4], 1 - mAge / 0.16);
          }
          continue;
        }
        const h = clamp(1 - crumbleAge / goneAt, 0, 1);
        const col = h > 0.72 ? WHITE : h > 0.45 ? Gold[4] : h > 0.22 ? Storm[4] : Storm[2];
        p.line(tr[i][0], tr[i][1], tr[i + 1][0], tr[i + 1][1], col, 0.92 * h);
        if (i % 5 === 0 && h > 0.25) {
          p.glow(tr[i][0], tr[i][1], 7, h > 0.5 ? Gold[4] : Storm[3], 0.28 * h);
        }
      }
    }
  }

  // 4E: Crackling electric grid arcs & sparks dancing on the scorched floor (`4.78..5.82s`, Frames 149 & 164!)
  if (t >= T_STRIKE) {
    const hitAge = t - T_STRIKE;
    if (hitAge < 1.12) {
      const hk = 1 - hitAge / 1.12;
      for (let i = 0; i < 5; i++) {
        const x0 = X_HIT + R.range(-34, 34);
        const y0 = R.range(-2, 8);
        const x1 = x0 + R.range(-14, 14);
        const y1 = y0 - R.range(6, 18) * hk;
        const gb = zigzag(R, x0, y0, x1, y1, 0.38, 0.3);
        crackle(p, gb, 0.90 * hk, pgRamp, 0.40, hk);
      }
      for (let n = 0; n < 4; n++) {
        const nx = X_HIT + (n - 1.5) * 18 + Math.sin(hitAge * 20 + n) * 4;
        const ny = 2 + (n % 2 === 0 ? -3 : 4);
        sparkle(p, nx, ny, 3.2 * hk, WHITE, n % 2 === 0 ? Gold[4] : Storm[4], 0.75 * hk);
      }
    }
  }
}

// 5. STATE 5 KO: RUNAWAY STATIC OVERLOAD, SHORT-CIRCUIT POP, CHARRED BLACK SMOKE & STREAMING REVIVAL MOTES
//    ("全身静电失控乱窜、在一声清脆的电流短路声中噗地化作一团焦黑的烟雾和零星电火花消散的完整过程", Frames 179, 194, 209, 224!)
function drawKoOverloadAndCharredSmoke(g, p, Gold, Plasma, Storm, FState, t, seed) {
  if (t < T_FALL) return;
  const frameSlot = Math.floor(t * 30);
  const R = new Rng(seed * 509 + frameSlot * 23);
  const boltRamp = [Storm[1], Storm[3], Plasma[3], Plasma[4], Gold[4], Gold[5], WHITE, WHITE];

  // 5A: Runaway Static Overload Arcs whipping chaotically across the falling/twitching furball (`5.65..6.32s`, Frame 179 at `5.97s`!)
  if (t < T_POP + 0.02) {
    const ovAlpha = smooth(T_FALL, T_FALL + 0.14, t) * (1 - FState.charMix * 0.8);
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * TAU + R.range(-0.3, 0.3);
      const a1 = a0 + R.range(0.8, 1.8);
      const r0 = R.range(6, 12) * FState.scale;
      const r1 = R.range(18, 28) * FState.scale;
      const zb = zigzag(
        R,
        FState.x + Math.cos(a0) * r0,
        FState.y + Math.sin(a0) * r0,
        FState.x + Math.cos(a1) * r1,
        FState.y + Math.sin(a1) * r1,
        0.42,
        0.45
      );
      crackle(p, zb, 0.92 * ovAlpha, boltRamp, 0.38, 0.95 * ovAlpha);
    }
    if (t < T_POP) return;
  }

  // 5B: Short-Circuit Pop & Billowing Charred Black Smoke + Stray Electric Sparks (`6.30..7.22s`, Frames 194 & 209!)
  const popAge = t - T_POP;
  const smokeDur = 0.90;
  if (popAge >= 0 && popAge < smokeDur) {
    const u = popAge / smokeDur;
    const cx = X_KO;
    const cy = -16;

    p.glow(cx, cy - popAge * 14, 34 * (1 - u * 0.35), Storm[2], 0.32 * (1 - u * 0.5));

    g.clear();
    const smokeLobes = [];
    const sizeEnv = u < 0.22 ? lerp(0.55, 1.0, ease.outCubic(u / 0.22)) : lerp(1.0, 0.45, (u - 0.22) / 0.78);
    for (let i = 0; i < 14; i++) {
      const r = rng(seed, i, 619);
      const a = (i / 14) * TAU + r.range(-0.15, 0.15);
      const sp = r.range(12, 34);
      const spread = ease.outCubic(u);
      const lx = cx + Math.cos(a) * sp * spread + Math.sin(popAge * 6 + i) * 2.0;
      const ly = cy + Math.sin(a) * sp * 0.65 * spread - popAge * r.range(10, 24);
      const lr = r.range(5.0, 8.2) * sizeEnv;
      if (lr > 1.2) {
        smokeLobes.push({ lx, ly, lr, i });
      }
    }

    const pad = 42;
    g.shade(cx - pad, cy - pad - 18, cx + pad, Math.min(2, cy + pad), (wx, wy, o) => {
      if (wy > 1.5) return 0;
      let maxField = 0;
      let bestLobe = null;
      for (let i = 0; i < smokeLobes.length; i++) {
        const lb = smokeLobes[i];
        const d = Math.hypot(wx - lb.lx, wy - lb.ly) / lb.lr;
        if (d < 1.0) {
          const f = 1 - d;
          if (f > maxField) {
            maxField = f;
            bestLobe = lb;
          }
        }
      }
      if (maxField <= 0 || !bestLobe) return 0;
      if (u > 0.80 && ((wx + wy) & 1) === 0 && maxField < 0.50) return 0;

      o.a = 1;
      o.t = 40;

      const lit = (bestLobe.lx - wx) * 0.08 + (bestLobe.ly - wy) * 0.12;
      if (maxField < 0.24) return lit > 0 ? CHAR_SMOKE[5] : CHAR_SMOKE[3];
      if (maxField < 0.48) return lit > 0.1 ? CHAR_SMOKE[4] : CHAR_SMOKE[2];
      if (maxField < 0.74) return CHAR_SMOKE[1];
      return CHAR_SMOKE[0];
    });

    g.outline(() => CHAR_SMOKE[0]);
    g.draw(p);

    if (popAge < 0.30) {
      const pk = 1 - popAge / 0.30;
      sparkle(p, cx, cy - 4, 14 * pk, WHITE, Gold[4], 0.85 * pk);
      p.ring(cx, cy - 2, 10 + 22 * ease.outCubic(popAge / 0.30), 1.2, pk > 0.4 ? Gold[4] : Plasma[4], pk * 0.9);
    }

    const sparkCols = [WHITE, Gold[5], Gold[4], Plasma[4]];
    for (let w = 0; w < 5; w++) {
      const wa = popAge - w * 0.14;
      if (wa <= 0 || wa > 0.52) continue;
      for (let i = 0; i < 8; i++) {
        const r = rng(seed, w * 19 + i, 677);
        const life = r.range(0.30, 0.50);
        if (wa >= life) continue;
        const a = (i / 8) * TAU + w * 0.7 + r.range(-0.25, 0.25);
        const sp = r.range(42, 108);
        const [sx, sy, vx, vy] = flight(cx, cy - w * 4, Math.cos(a) * sp, Math.sin(a) * sp - 22, wa, { floor: 0 });
        spark(p, sx, sy, vx, vy, 1 - wa / life, sparkCols);
      }
    }

    if (u < 0.88) {
      const zk = 1 - u / 0.88;
      for (let z = 0; z < 4; z++) {
        const zx = cx + R.range(-20, 20);
        const zy = cy - popAge * 14 + R.range(-12, 8);
        const zb = zigzag(R, zx, zy, zx + R.range(-9, 9), zy + R.range(-9, 9), 0.45, 0);
        crackle(p, zb, 0.88 * zk, boltRamp, 0.35, zk);
      }
    }
  }

  // 5C: Smooth Re-Condensation Bridge (`6.92..7.50s`, overlapping the dissipating smoke and flowing into Frame 0!):
  //     Golden static sparks stream in curved arcs from the smoke zone (`X_KO = -20`) back to `X_IDLE = -54`!
  if (t >= 6.92) {
    const revU = seg(t, 6.92, D);
    const k = Math.sin(revU * Math.PI);
    for (let i = 0; i < 16; i++) {
      const r = rng(seed, i, 811);
      const stU = clamp((revU - r.range(0, 0.22)) / 0.78, 0, 1);
      if (stU <= 0 || stU >= 1) continue;
      const sx = lerp(X_KO + r.range(-14, 14), X_IDLE, ease.inOutCubic(stU));
      const sy = lerp(-28 + r.range(-12, 10), -R_BASE, ease.inOutCubic(stU)) - Math.sin(stU * Math.PI) * r.range(4, 14);
      p.dot(sx, sy, i % 2 === 0 ? WHITE : Gold[4], Math.sin(stU * Math.PI));
    }
    p.glow(FState.x, FState.y, 26 * k, Gold[4], 0.42 * k);
  }
}

export function drawBack(p, time, o) {
  const t = shift(time, D, o.seed);
  const Gold = fit(o.palette, 7);
  const Plasma = fit(o.plasma, 6);
  const Storm = fit(o.storm, 6);
  const FState = computeFurballState(t);

  // 1. Floor contact shadow & golden static ground reflection under the furball
  if (FState.visible) {
    const shX = FState.x;
    const heightFactor = clamp(1 - (-FState.y - R_BASE) / 48, 0.35, 1.0);
    const shRx = 14 * FState.scale * heightFactor;
    for (let y = -1; y <= 2; y++) {
      for (let x = Math.floor(shX - shRx); x <= Math.ceil(shX + shRx); x++) {
        const d = ((x - shX) / shRx) ** 2 + (y / 2.2) ** 2;
        if (d < 1) p.blend(x, y, Gold[0], 0.55 * (1 - d) * heightFactor);
      }
    }
    p.glow(shX, 0, 28 * FState.scale, FState.vortexMix > 0.4 ? Storm[3] : Gold[3], 0.25 * heightFactor);
  }

  // 2. Scorched Black Electric Grid on the target floor during State 4 Attack
  drawThunderstormAttackAndScorchedGrid(p, Gold, Plasma, Storm, FState, t, o.seed, "back");

  // 3. Ambient floating golden static sparks
  cycle(t, D, 16, o.seed * 23 + 9, (r) => r.range(0.9, 1.6), (ag, L, r, i) => {
    const k = ag / L;
    const x = r.range(-80, 28) + Math.sin(ag * 4 + i) * 3.0;
    const y = -r.range(3, 44) - ag * r.range(10, 18);
    const a = Math.min(1, k * 4) * (1 - k) * (FState.visible ? 0.85 : 0.3);
    if (a <= 0.05) return;
    p.dot(x, y, i % 3 === 0 ? WHITE : Gold[4], a);
    p.glow(x, y, 4, Gold[3], 0.22 * a);
  });
}

export function draw(p, time, o) {
  const t = shift(time, D, o.seed);
  const Gold = fit(o.palette, 7);
  const Plasma = fit(o.plasma, 6);
  const Storm = fit(o.storm, 6);
  const FState = computeFurballState(t);

  // 1. Draw Z-shaped Zigzag Ricochet Blue-White Lightning Polyline Afterimage (behind the furball)
  drawZigzagBounceAfterimage(p, Gold, Plasma, FState, t, o.seed);

  // 2. Draw the Golden Static Furball body, Twin Lightning Ahoge Tufts, Mosquito-Coil Eyes & Thunderstorm Vortex
  drawVoltFurballBody(GRID, p, Gold, Plasma, Storm, FState, t, o.seed);

  // 3. Draw State 2 Eco Quirk Self-Zap & Frantic Spark Shake-Off
  drawEcoQuirkSparks(p, Gold, Plasma, FState, t, o.seed);

  // 4. Draw State 4 Thunderstorm Vortex Rings, Stepped Leader, Organic Fractal-Jagged Purple-Gold Bolt & Crumbling Channel
  drawThunderstormAttackAndScorchedGrid(p, Gold, Plasma, Storm, FState, t, o.seed, "front");

  // 5. Draw State 5 Runaway Static Overload, Short-Circuit Pop, Billowing Charred Black Smoke & Streaming Revival Motes
  drawKoOverloadAndCharredSmoke(GRID, p, Gold, Plasma, Storm, FState, t, o.seed);
}
