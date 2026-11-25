// Aurora Moth ("critters/aurora-moth" — 【极光羽翼虫小怪物特效】):
// A narcissistic, aristocratic fantasy insect with a luminous pure-white streamlined chrysalis core and silky
// 7-color aurora ribbon wings, showcasing five sustained action states with smooth C1-continuous transitions
// across a 10.5s loop:
// 1. 【待机 Idle (0.00..1.90s)】: A pure-white glowing streamlined chrysalis core ("洁白发光的流线型虫蛹核心") with
//    silky, undulating 7-color aurora ribbon wings ("两侧舒展着如丝绸般飘逸的七彩极光光带翅膀") hovers and flaps with
//    slow, aristocratic grace in mid-air ("在空中优雅地缓慢扇动").
// 2. 【生态小动作 Eco Quirk (1.90..4.05s)】: Sweeping its wings, it condenses a luminous faceted crystal mirror
//    in front of itself ("用翅膀在面前凝聚出一面发光的水晶镜子"), performs two proud ballet pirouette leaps before
//    the mirror ("在镜子前像芭蕾舞者一样高傲地旋转跳跃展示优美身姿"), and showers intoxicated pink heart stardust
//    above its head ("并在头顶洒下一片陶醉的粉色爱心星尘").
// 3. 【移动 Move (4.05..6.05s)】: With a light wing-beat, its body transforms into a radiant rainbow streamer
//    gliding along a sweeping S-shaped curve across the sky while showering a canopy of twinkling aurora scale-dust
//    ("双翼轻盈一振、身体化作一道绚丽的彩虹流光在空中划出优美的S型弧线滑翔并洒落漫天极光鳞粉").
// 4. 【攻击 Attack & Prismatic Burst Hit (6.05..8.30s)】: Raising its head high, it claps both wings tightly
//    together and flings them magnificently wide open ("高昂起头颅双翼猛然合十再华丽展开"), fanning out three
//    intersecting crescent-shaped aurora wind-blades with streaming light-cut trails ("瞬间煽动出三道新月形的绚丽极光风刃交叉斩向远方")
//    that detonate at the target in a dazzling prismatic rainbow burst ("爆开绚丽彩光的命中结果特效").
// 5. 【倒地 KO & Ice-Crystal Flower Dissipation (8.30..10.50s)】: Its aurora wings fracture inch by inch like torn
//    silk and dissolve into a shower of rainbow light-rain ("极光翅膀像破碎的丝绸般寸寸断裂化作光雨"), while the white
//    chrysalis core floats gracefully down and blooms upon touching the ground into a crystalline ice-flower that
//    sublimates into rising aurora motes ("白色核心优雅地缓缓坠落并在触地瞬间化作一朵冰晶花消散的完整过程").
// Builds on ./butterfly.js, ../weather/aurora.js, ../melee/_lib.js, and ../ice/_lib.js
// (adapted from Sprite Fusion's open-source VFX, MIT License, Copyright (c) 2026 Hugo Duprez).
import {
  Rng,
  fit,
  hex,
  mix,
  sparkle,
  clamp,
  smooth,
  seg,
  ease,
  lerp,
  rng,
  cycle,
  wrap,
  TAU,
  WHITE,
} from "../../core/index.js";
import { Grid } from "./_lib.js";
import { inPoly, snowflake, flakeDesign } from "../ice/_lib.js";

export const meta = {
  name: "Aurora moth",
  desc: "A white chrysalis moth with 7-color aurora silk wings dances before a crystal mirror, S-glides in rainbow light, fires 3 crescent wind-blades, and blooms into an ice flower.",
  tags: ["critter", "monster", "insect", "moth", "aurora", "rainbow", "ice", "wind", "loop"],
  size: [288, 160],
  origin: [118, 134],
  duration: 10.5,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // 7-step Iridescent Aurora Ribbon Spectrum (deep night-teal -> emerald-mint -> aqua-cyan -> sapphire -> violet -> rose-pink -> starlight-white)
    palette: ["#0c1b2e", "#145258", "#26b888", "#36e2f8", "#7c68ff", "#ff68c8", "#ffffff"],
    // 6-step Warm Prismatic Gold & Pink Heart Stardust ramp
    prism: ["#38102a", "#8e2462", "#e84898", "#ff84c8", "#ffd868", "#fff6d8"],
    // 6-step Luminous Porcelain-White Chrysalis Core & Ice-Crystal Flower ramp
    crystal: ["#162850", "#2c5294", "#5492dc", "#8cd2ff", "#d4f2ff", "#ffffff"],
    seed: 1,
  },
};

const D = meta.duration;

// 5 Sustained Action State Timestamps across 10.5s (315 frames @ 30fps):
// 0.00..1.90s (Frames 0, 21, 42)          : State 1 — IDLE (White streamlined chrysalis core + silky 7-color aurora wings flapping slowly)
// 1.90..4.05s (Frames 63, 84, 105)        : State 2 — ECO QUIRK (Crystal mirror + 2 ballet pirouette leaps + pink heart stardust shower)
// 4.05..6.05s (Frames 125, 146, 167)      : State 3 — MOVE (Wing-beat launch -> Wide S-curve rainbow streamer glide + sky-filling aurora scale-dust)
// 6.05..8.25s (Frames 188, 209, 230)      : State 4 — ATTACK (188: head high & wings clapped together; 209: wings wide open & 3 intersecting crescent aurora wind-blades; 230: prismatic rainbow burst hit)
// 8.25..10.50s (Frames 251, 272, 293, 314): State 5 — KO (251: wings tear inch-by-inch like silk into light-rain; 272: white core floats gracefully down in rainbow rain; 293: ground impact blooms into a 3D Ice-Crystal Flower; 314: revival)
const T_QUIRK = 1.90;
const T_PIROUETTE = 2.12;
const T_MIRROR_FADE = 3.82;
const T_MOVE = 4.05;
const T_GLIDE_START = 4.22;
const T_GLIDE_END = 5.88;
const T_ATK = 6.05;
const T_SLASH_FIRE = 6.52;
const T_HIT = 7.02;
const T_KO = 8.25;
const T_CORE_FALL = 8.62;
const T_FLOWER_BLOOM = 9.38;
const T_REVIVE = 10.18;

const X_IDLE = -62;
const Y_IDLE = -46;
const X_MIRROR = -20;
const Y_MIRROR = -48;
const X_ATK = -24;
const Y_ATK = -52;
const X_HIT = 82;
const Y_HIT = -34;
const X_FLOWER = -38;

const GRID = new Grid(-114, -124, 276, 146);

// 7x6 Pixel-Art Heart Mask ("粉色爱心星尘")
const HEART_PIXELS = [
  [-2, -2], [-1, -2], [1, -2], [2, -2],
  [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [3, -1],
  [-3, 0],  [-2, 0],  [-1, 0],  [0, 0],  [1, 0],  [2, 0],  [3, 0],
  [-2, 1],  [-1, 1],  [0, 1],   [1, 1],  [2, 1],
  [-1, 2],  [0, 2],   [1, 2],
  [0, 3],
];

// Wide, Non-Overlapping C1-Continuous S-Shaped Glide Trajectory (`u in [0, 1]`) for State 3 Move:
// Uses a smooth 5-segment cubic Catmull-Rom spline through 6 wide sky waypoints (`x: -62 .. +68`) so in
// Frame 147 (`u = 0.41`) and Frame 167 (`u = 0.81`) the rainbow streamer traces an open, sweeping S-curve
// (`在空中划出优美的S型弧线滑翔`) that is never covered by the moth's own wings!
const S_WAYPOINTS = [
  [-62, -46], // u = 0.00: Launch from Idle perch
  [-26, -88], // u = 0.20: Crest 1 — high upper-left arch of the S-curve
  [+16, -22], // u = 0.42: Trough 1 — deep lower-center valley (Frame 147 at 4.90s!)
  [+58, -84], // u = 0.64: Crest 2 — high upper-right arch completing the wide S-wave!
  [+72, -36], // u = 0.81: Far-right S-finish (Frame 167 at 5.57s shows the entire open S-curve behind the moth!)
  [-24, -52], // u = 1.00: Smooth swoop back to Attack perch (X_ATK, Y_ATK)
];

function sCurveAt(u) {
  const cu = clamp(u, 0, 1);
  const n = S_WAYPOINTS.length - 1;
  const scaled = cu * n;
  const idx = Math.min(n - 1, Math.floor(scaled));
  const t = scaled - idx;

  const p0 = S_WAYPOINTS[Math.max(0, idx - 1)];
  const p1 = S_WAYPOINTS[idx];
  const p2 = S_WAYPOINTS[idx + 1];
  const p3 = S_WAYPOINTS[Math.min(n, idx + 2)];

  // Catmull-Rom cubic interpolation for C1-smooth tangents across all waypoints
  const t2 = t * t;
  const t3 = t2 * t;
  const x = 0.5 * (
    (2 * p1[0]) +
    (-p0[0] + p2[0]) * t +
    (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
    (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
  );
  const y = 0.5 * (
    (2 * p1[1]) +
    (-p0[1] + p2[1]) * t +
    (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
    (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
  );
  return { x, y };
}

// Sample the 7-Color Iridescent Aurora Spectrum smoothly by phase `h in [0, 1]`
function sampleAuroraSpectrum(h, Aurora, Prism) {
  const ph = ((h % 1) + 1) % 1;
  const stops = [
    Aurora[2], // Emerald-Mint
    Aurora[3], // Aqua-Cyan
    Prism[4],  // Champagne-Gold
    Prism[3],  // Rose-Pink
    Aurora[5], // Magenta-Rose
    Aurora[4], // Amethyst-Violet
    Aurora[3], // Aqua-Cyan
  ];
  const idx = ph * (stops.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(stops.length - 1, i0 + 1);
  return mix(stops[i0], stops[i1], idx - i0);
}

// Compute the Aurora Moth's continuous pose, wing kinematics, ballet spin, and silk fracture state at time `t`
function computeMothState(t) {
  let x = X_IDLE;
  let y = Y_IDLE;
  let coreVisible = true;
  let coreScale = 1.0;
  let bodyTilt = 0;       // body lean angle in radians
  let headPitch = 0;      // > 0 proud uplifted head ("高昂起头颅")
  let yaw = 0;            // 3D pirouette rotation angle during ballet spin
  let wingSpanL = 1.0;    // left wing horizontal extension
  let wingSpanR = 1.0;    // right wing horizontal extension
  let wingLift = 0;       // vertical wingbeat elevation (-1 downstroke .. +1 upstroke)
  let wingClap = 0;       // 0..1 when wings clap tightly together above chest ("双翼猛然合十")
  let silkRupture = 0;    // 0..1 progressive inch-by-inch wing fracture in State 5 ("像破碎的丝绸般寸寸断裂")
  let rainbowGlow = 0;    // 0..1 intensity of rainbow streamer transformation during S-glide
  let eyeMode = "noble";  // "noble" | "bliss" | "fierce" | "serene"

  if (t < T_QUIRK) {
    // =========================================================================
    // STATE 1: 【待机 IDLE (0.00..1.90s)】
    // 3 slow, graceful, silk-rippling wingbeat cycles in mid-air (Frames 0, 21, 42!)
    // =========================================================================
    const u = t / T_QUIRK;
    const flapPhase = u * 3 * TAU;
    const env = Math.min(1, Math.sin(u * Math.PI) * 1.6);

    x = X_IDLE + Math.sin(u * TAU) * 3.0 * env;
    y = Y_IDLE - Math.sin(flapPhase) * 4.5;
    wingLift = Math.cos(flapPhase) * 0.85;
    const spanBreath = 0.76 + 0.26 * (0.5 + 0.5 * Math.sin(flapPhase - 0.35));
    wingSpanL = spanBreath;
    wingSpanR = spanBreath;
    bodyTilt = Math.sin(u * TAU) * 0.08 * env;
    headPitch = 0.15;
  } else if (t < T_MOVE) {
    // =========================================================================
    // STATE 2: 【生态小动作 ECO QUIRK (1.90..4.05s)】
    // Condenses a glowing crystal mirror (`1.90..2.12s`), performs 2 aristocratic ballet pirouette leaps
    // (`2.12..3.82s`, Frames 63, 84, 105!), and smoothly settles back into glide readiness (`3.82..4.05s`)!
    // =========================================================================
    if (t < T_PIROUETTE) {
      const u = seg(t, T_QUIRK, T_PIROUETTE);
      const sweep = Math.sin(u * Math.PI);
      x = lerp(X_IDLE, X_IDLE + 4, ease.inOutSine(u));
      y = Y_IDLE - 3.5 * sweep;
      wingSpanL = 1.0 - 0.28 * sweep;
      wingSpanR = 1.0 + 0.18 * sweep;
      wingLift = 0.65 * sweep;
      headPitch = lerp(0.15, 0.45, u);
      eyeMode = "bliss";
    } else if (t < T_MIRROR_FADE) {
      const u = seg(t, T_PIROUETTE, T_MIRROR_FADE);
      const danceCycles = 2;
      const dPhase = (u * danceCycles) % 1;
      const leapArc = Math.sin(dPhase * Math.PI);

      yaw = ease.inOutSine(dPhase) * TAU;
      x = X_IDLE + 4 + Math.sin(u * danceCycles * TAU) * 5.5;
      y = Y_IDLE - 12.0 * leapArc;

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      wingSpanL = 0.48 + 0.58 * Math.abs(cosY - 0.25 * sinY);
      wingSpanR = 0.48 + 0.58 * Math.abs(cosY + 0.25 * sinY);
      wingLift = 0.55 * leapArc + 0.35 * Math.sin(yaw);
      bodyTilt = -0.18 * Math.sin(yaw);
      headPitch = 0.48;
      eyeMode = "bliss";
    } else {
      const u = seg(t, T_MIRROR_FADE, T_MOVE);
      x = lerp(X_IDLE + 4, X_IDLE, ease.inOutSine(u));
      y = lerp(Y_IDLE, Y_IDLE + 3, ease.inOutSine(u));
      wingSpanL = lerp(1.05, 0.85, u);
      wingSpanR = lerp(1.05, 0.85, u);
      wingLift = lerp(0.2, 0.75, u);
      headPitch = lerp(0.48, 0.18, u);
      eyeMode = "noble";
    }
  } else if (t < T_ATK) {
    // =========================================================================
    // STATE 3: 【移动 MOVE (4.05..6.05s)】
    // Light wing-beat impulse (`4.05..4.22s`, Frame 125) -> Wide S-curve rainbow streamer glide (`4.22..5.88s`,
    // Frames 146 & 167!) -> Smooth arrival at `(X_ATK, Y_ATK)` (`5.88..6.05s`)!
    // =========================================================================
    if (t < T_GLIDE_START) {
      const u = seg(t, T_MOVE, T_GLIDE_START);
      x = X_IDLE;
      y = Y_IDLE + 3 * (1 - u) - 4 * u;
      wingLift = lerp(0.75, -0.65, ease.outCubic(u));
      wingSpanL = lerp(0.85, 1.15, ease.outCubic(u));
      wingSpanR = lerp(0.85, 1.15, ease.outCubic(u));
      rainbowGlow = ease.inQuad(u);
      eyeMode = "noble";
    } else if (t < T_GLIDE_END) {
      const u = seg(t, T_GLIDE_START, T_GLIDE_END);
      const pos = sCurveAt(u);
      const posNext = sCurveAt(Math.min(1, u + 0.02));
      x = pos.x;
      y = pos.y;

      const vx = posNext.x - pos.x;
      const vy = posNext.y - pos.y;
      const glideAngle = Math.atan2(vy, vx);
      bodyTilt = clamp(glideAngle * 0.35, -0.45, 0.45) * Math.sin(u * Math.PI);
      // Aerodynamic swept-back silk wings during the high-speed S-curve glide so the rainbow streamer shines!
      wingSpanL = 0.82 + 0.14 * Math.sin(u * Math.PI * 3);
      wingSpanR = 0.82 - 0.14 * Math.sin(u * Math.PI * 3);
      wingLift = 0.32 * Math.cos(u * Math.PI * 4);
      rainbowGlow = Math.sin(Math.min(1, u * 1.12) * (Math.PI * 0.88));
      headPitch = 0.25;
      eyeMode = "noble";
    } else {
      const u = seg(t, T_GLIDE_END, T_ATK);
      x = X_ATK;
      y = Y_ATK;
      wingSpanL = lerp(0.82, 0.96, u);
      wingSpanR = lerp(0.82, 0.96, u);
      wingLift = lerp(0.15, 0.45, u);
      rainbowGlow = (1 - u) * 0.4;
      headPitch = lerp(0.25, 0.48, u);
      eyeMode = "fierce";
    }
  } else if (t < T_KO) {
    // =========================================================================
    // STATE 4: 【攻击 ATTACK & PRISMATIC BURST HIT (6.05..8.25s)】
    // Rears head high & claps both wings tightly together (`6.05..6.52s`, Frame 188 at 6.27s!) ->
    // Flings wings magnificently wide open (`6.52..7.80s`, Frame 209 at 6.97s & Frame 230 at 7.67s!) ->
    // Smooth wind-down tremor (`7.80..8.25s`)!
    // =========================================================================
    if (t < T_SLASH_FIRE) {
      // 4A: Head held high & both wings clapped tightly together above chest ("高昂起头颅双翼猛然合十")
      const u = seg(t, T_ATK, T_SLASH_FIRE);
      const clapIn = smooth(0.0, 0.26, u);
      x = X_ATK - 3.5 * clapIn;
      y = Y_ATK - 5.0 * clapIn + Math.sin(u * 35) * 0.8 * clapIn;
      wingClap = clapIn;
      wingSpanL = lerp(0.96, 0.28, clapIn);
      wingSpanR = lerp(0.96, 0.28, clapIn);
      wingLift = lerp(0.45, 0.95, clapIn);
      headPitch = lerp(0.48, 0.80, clapIn);
      bodyTilt = -0.15 * clapIn;
      eyeMode = "fierce";
    } else {
      // 4B: Magnificent wide-open wing unfurl ("再华丽展开") & recoil hold (`6.52..8.25s`, Frames 209 & 230!)
      const age = t - T_SLASH_FIRE;
      const openU = clamp(age / 0.14, 0, 1);
      const openOvershoot = ease.outBack(openU, 1.75);
      const recoil = Math.exp(-age * 4.5) * 6.5;
      const settleU = smooth(7.70, T_KO, t);

      x = X_ATK - 3.5 * (1 - openU) - recoil + Math.sin(age * 6) * 1.5 * (1 - settleU);
      y = Y_ATK - 5.0 * (1 - openU) - recoil * 0.6 + Math.cos(age * 5) * 2.0;

      wingClap = Math.max(0, 1 - openU * 2.5);
      const grandSpan = lerp(0.28, 1.32, openOvershoot);
      wingSpanL = lerp(grandSpan, 1.02, settleU);
      wingSpanR = lerp(grandSpan, 1.02, settleU);
      wingLift = lerp(0.95, -0.28, openU) + 0.18 * Math.sin(age * 7) * (1 - settleU);
      headPitch = lerp(0.80, 0.32, settleU);
      bodyTilt = 0.12 * Math.exp(-age * 3) + (settleU > 0.3 ? Math.sin(t * 55) * 0.08 * settleU : 0);
      eyeMode = settleU > 0.5 ? "serene" : "fierce";
    }
  } else {
    // =========================================================================
    // STATE 5: 【倒地 KO & ICE-CRYSTAL FLOWER DISSIPATION (8.25..10.50s)】
    // 5A (`8.25..8.98s`, Frame 251 at 8.37s): Aurora wings fracture inch-by-inch like torn silk into rainbow light-rain!
    // 5B (`8.62..9.38s`, Frame 272 at 9.07s): Pure-white chrysalis core floats gracefully down like a feather!
    // 5C (`9.38..10.18s`, Frame 293 at 9.77s): Core blooms upon touching the ground into a radiant 3D Ice-Crystal Lotus!
    // 5D (`10.18..10.50s`, Frame 314 at 10.47s): Rising aurora & frost motes smoothly re-condense at `(X_IDLE, Y_IDLE)`!
    // =========================================================================
    silkRupture = clamp((t - T_KO) / 0.68, 0, 1);
    eyeMode = "serene";

    if (t < T_FLOWER_BLOOM) {
      if (t < T_CORE_FALL) {
        const u = seg(t, T_KO, T_CORE_FALL);
        x = lerp(X_ATK, X_ATK - 3, ease.inOutSine(u));
        y = lerp(Y_ATK, Y_ATK + 3, ease.inOutSine(u));
        bodyTilt = Math.sin(t * 42) * 0.10 * (1 - u);
      } else {
        // Feather-like swaying descent from `(X_ATK - 3, Y_ATK + 3)` down to `(X_FLOWER, -4)`
        // At Frame 272 (`t = 9.07s`, `u = 0.59`), the pure-white streamlined core is clearly floating mid-descent!
        const u = seg(t, T_CORE_FALL, T_FLOWER_BLOOM);
        const fallE = ease.inOutSine(u);
        x = lerp(X_ATK - 3, X_FLOWER, fallE) + Math.sin(u * Math.PI * 2.0) * 6.5 * (1 - u * 0.4);
        y = lerp(Y_ATK + 3, -4.0, ease.inOutSine(u));
        bodyTilt = Math.cos(u * Math.PI * 2.0) * 0.26 * (1 - u * 0.3);
        coreScale = lerp(1.0, 0.90, u);
      }
      wingSpanL = 1.02 * (1 - silkRupture * 0.15);
      wingSpanR = 1.02 * (1 - silkRupture * 0.15);
      wingLift = -0.22 * silkRupture;
    } else if (t < T_REVIVE) {
      // 5C: Core has bloomed into the Ground Ice-Crystal Lotus Flower! (Frame 293 at `9.77s`!)
      coreVisible = false;
      x = X_FLOWER;
      y = -2;
    } else {
      // 5D: Smooth re-condensation at `(X_IDLE, Y_IDLE)` (`10.18..10.50s`, Frame 314 at `10.47s`!)
      const u = seg(t, T_REVIVE, D);
      const eu = ease.inOutCubic(u);
      coreVisible = true;
      coreScale = lerp(0.42, 1.0, eu);
      x = lerp(X_FLOWER * 0.20 + X_IDLE * 0.80, X_IDLE, eu);
      y = lerp(Y_IDLE + 10, Y_IDLE, eu);
      silkRupture = 1 - eu;
      wingSpanL = lerp(0.32, 0.76, eu);
      wingSpanR = lerp(0.32, 0.76, eu);
      wingLift = lerp(-0.1, 0.85, eu);
      headPitch = 0.15 * eu;
      eyeMode = "noble";
    }
  }

  return {
    x,
    y,
    coreVisible,
    coreScale,
    bodyTilt,
    headPitch,
    yaw,
    wingSpanL,
    wingSpanR,
    wingLift,
    wingClap,
    silkRupture,
    rainbowGlow,
    eyeMode,
  };
}

// 1. DRAW THE SILKY 7-COLOR AURORA RIBBON WINGS & LUMINOUS PURE-WHITE STREAMLINED CHRYSALIS CORE
//    ("一个洁白发光的流线型虫蛹核心、两侧舒展着如丝绸般飘逸的七彩极光光带翅膀")
function drawAuroraMothBody(g, p, Aurora, Prism, Crystal, MState, t, seed) {
  if (!MState.coreVisible) return;
  g.clear();

  const cx = MState.x;
  const cy = MState.y;
  const cosT = Math.cos(MState.bodyTilt);
  const sinT = Math.sin(MState.bodyTilt);

  // Pass A: Shade the Silky Flowing 7-Color Aurora Ribbon Wings ("两侧舒展着如丝绸般飘逸的七彩极光光带翅膀")
  const intactFrac = 1 - MState.silkRupture;
  if (intactFrac > 0.04) {
    const maxSpan = 35;
    const padX = 42;
    const padY = 36;

    g.shade(cx - padX, cy - padY, cx + padX, Math.min(2, cy + padY), (wx, wy, o) => {
      if (wy > 1.5) return 0;
      const dx = wx - cx;
      const dy = wy - cy;
      const lx = dx * cosT + dy * sinT;
      const ly = -dx * sinT + dy * cosT;

      const side = lx < 0 ? -1 : 1;
      const spanScale = side < 0 ? MState.wingSpanL : MState.wingSpanR;
      const absX = Math.abs(lx);

      // When `wingClap > 0.35`, the wings fold upward & forward into a tall, pointed vertical prism-silk prayer blade!
      if (MState.wingClap > 0.35) {
        const clapU = MState.wingClap;
        const bladeH = 26 * clapU;
        const vUp = (-ly + 6) / bladeH;
        if (vUp >= 0 && vUp <= 1.0) {
          const ribbonW = (2.5 + 6.8 * Math.sin(vUp * Math.PI)) * (1 - 0.35 * clapU);
          const waveX = Math.sin(vUp * 5 - t * 12) * 1.4 * side;
          const dClap = Math.abs(absX - (1.8 + waveX)) / Math.max(0.8, ribbonW);
          if (dClap <= 1.0) {
            o.a = 1;
            o.t = 1;
            if (dClap > 0.82 || vUp > 0.88) return WHITE;
            return sampleAuroraSpectrum(vUp * 0.9 - t * 0.8, Aurora, Prism);
          }
        }
      }

      const uSpan = (absX - 1.5) / (maxSpan * Math.max(0.22, spanScale));
      if (uSpan < 0 || uSpan > intactFrac) return 0;

      // In State 5 silk rupture, create a jagged torn-silk edge along `uSpan ~ intactFrac`!
      if (MState.silkRupture > 0.02 && MState.silkRupture < 0.98) {
        const tearJagged = 0.08 * Math.sin(ly * 1.3 + side * 2.1);
        if (uSpan > intactFrac + tearJagged) return 0;
      }

      // Silk ribbon undulating wave (traveling outward along `uSpan` like a silk scarf in the wind!)
      const wavePhase = uSpan * 4.5 - t * 6.5 + side * 0.4;
      const silkWave = Math.sin(wavePhase) * (1.8 + 3.4 * uSpan);
      const liftY = -MState.wingLift * uSpan * 11.5 - MState.wingClap * uSpan * 12.0;

      // Smoothly tapered tip envelope so the outer wingtips end in graceful, pointed silk tips instead of blunt rectangles!
      const tipTaper = Math.sin(Math.pow(uSpan, 0.65) * Math.PI);

      // Forewing Silk Ribbon ("上极光绸翼") & Hindwing Flowing Streamer ("下极光长尾绶带")
      const foreCenterY = -4.5 - uSpan * 8.0 + liftY + silkWave * 0.80;
      const foreHalfW = (2.2 + 7.6 * tipTaper);

      const hindCenterY = 3.2 + uSpan * 10.5 + liftY * 0.55 - silkWave * 0.95;
      const hindHalfW = (1.8 + 6.2 * Math.sin(Math.pow(clamp(uSpan / 0.92, 0, 1), 0.6) * Math.PI));

      const dFore = Math.abs(ly - foreCenterY) / Math.max(0.6, foreHalfW);
      const dHind = uSpan < 0.92 ? Math.abs(ly - hindCenterY) / Math.max(0.6, hindHalfW) : 99;

      if (dFore > 1.0 && dHind > 1.0) return 0;

      const isFore = dFore <= dHind;
      const vChord = isFore
        ? (ly - (foreCenterY - foreHalfW)) / (2 * foreHalfW)
        : (ly - (hindCenterY - hindHalfW)) / (2 * hindHalfW);

      o.a = 1;
      o.t = 1;

      // Crisp glowing Pearl-White / Starlight-Gold Silk Hem along the upper and lower borders of each ribbon!
      if (vChord < 0.15 || vChord > 0.86) {
        return vChord < 0.15 ? WHITE : Prism[5];
      }

      // Vertical aurora curtain striations (`weather/aurora.js` style) + 7-color iridescent spectrum shift!
      const hue = uSpan * 0.90 + (isFore ? 0.0 : 0.30) - t * 0.45 + 0.08 * Math.sin(ly * 0.7 + t * 5);
      const curtainRay = Math.sin(uSpan * 24 - t * 8 + ly * 0.5);
      const baseAurora = sampleAuroraSpectrum(hue, Aurora, Prism);

      if (curtainRay > 0.56) {
        return mix(baseAurora, WHITE, 0.58);
      }
      if (curtainRay < -0.55) {
        return mix(baseAurora, Aurora[1], 0.38);
      }
      return baseAurora;
    });
  }

  // Pass B: Shade the Luminous Pure-White Streamlined Chrysalis Core ("一个洁白发光的流线型虫蛹核心")
  const cScale = MState.coreScale;
  const bodyLen = 16.0 * cScale;
  const pitchOff = -MState.headPitch * 3.8;

  g.shade(cx - 14, cy - 20, cx + 14, Math.min(2, cy + 20), (wx, wy, o) => {
    if (wy > 1.5) return 0;
    const dx = wx - cx;
    const dy = wy - cy;
    const lx = dx * cosT + dy * sinT;
    const ly = -dx * sinT + dy * cosT;

    const normY = (ly - pitchOff * 0.4) / bodyLen; // -0.78 (head) .. +0.94 (tail tip)
    if (normY < -0.78 || normY > 0.95) return 0;

    let halfW = 0;
    if (normY < -0.35) {
      const hu = (normY + 0.78) / 0.43;
      halfW = 4.2 * cScale * Math.sin(hu * Math.PI * 0.85);
    } else {
      const tu = (normY + 0.35) / 1.30;
      halfW = 5.2 * cScale * Math.sin((1 - Math.pow(tu, 1.35)) * (Math.PI * 0.55));
    }

    const absLx = Math.abs(lx);
    if (absLx > halfW + 0.8) return 0;

    o.a = 1;
    o.t = 2;

    // 1px deep sapphire-indigo rim around the white chrysalis core so its streamlined silhouette is 100% distinct against the glowing wings!
    if (absLx > halfW - 0.35 || normY < -0.72 || normY > 0.88) {
      return Crystal[1];
    }

    const nx = lx / Math.max(0.8, halfW);
    const segRing = normY > 0.08 && Math.sin(normY * 22) > 0.72;
    const lit = -nx * 0.45 - normY * 0.35 + (1 - absLx / Math.max(0.8, halfW)) * 0.55;

    if (segRing) return Crystal[3];
    if (lit > 0.36) return WHITE;
    if (lit > 0.05) return Crystal[4];
    return Crystal[3];
  });

  // Pass C: Graceful Feathered Silk Antennae ("丝绒触角") & Aristocratic Sapphire-Violet Eyes
  const headX = cx + Math.sin(MState.bodyTilt) * 8.2 * cScale;
  const headY = cy - Math.cos(MState.bodyTilt) * 8.2 * cScale - MState.headPitch * 2.2;
  for (const side of [-1, 1]) {
    const ax0 = headX + side * 1.8;
    const ay0 = headY - 2.0;
    const ax1 = ax0 + side * (6.0 + Math.sin(t * 5 + side) * 1.2) * cScale;
    const ay1 = ay0 - (7.0 + MState.headPitch * 2.0) * cScale;
    g.line(Math.round(ax0), Math.round(ay0), Math.round(ax1), Math.round(ay1), Crystal[4], 1, 3);
    g.set(Math.round(ax1), Math.round(ay1), WHITE, 1, 3);
    g.set(Math.round(ax1), Math.round(ay1 - 1), Prism[4], 1, 3);
  }

  // Expressive Eyes on the head crown
  const eyeY = Math.round(headY);
  for (const side of [-1, 1]) {
    const ex = Math.round(headX + side * 2.3 * cScale);
    if (MState.eyeMode === "bliss" || MState.eyeMode === "serene") {
      g.set(ex - side, eyeY, Crystal[0], 1, 3);
      g.set(ex, eyeY - 1, Crystal[0], 1, 3);
    } else if (MState.eyeMode === "fierce") {
      g.set(ex, eyeY, Prism[2], 1, 3);
      g.set(ex, eyeY + 1, Crystal[0], 1, 3);
      g.set(ex - side, eyeY - 1, Crystal[0], 1, 3);
    } else {
      g.set(ex, eyeY, Crystal[0], 1, 3);
      g.set(ex, eyeY + 1, Aurora[4], 1, 3);
    }
  }

  g.outline((x, y, nx, ny, tId) => (tId === 2 ? Crystal[0] : Aurora[0]));
  g.draw(p);

  p.glow(cx, cy, 26 * cScale, Aurora[3], 0.30);
  p.glow(cx, cy - 2, 12 * cScale, WHITE, 0.34);

  // During State 2 Ballet Pirouette (`t = T_PIROUETTE .. T_MIRROR_FADE`), draw a swirling aurora ballet ribbon around the spinning moth!
  if (t >= T_PIROUETTE && t < T_MIRROR_FADE) {
    const danceAlpha = Math.sin(seg(t, T_PIROUETTE, T_MIRROR_FADE) * Math.PI);
    for (let i = 0; i < 24; i++) {
      const u = i / 24;
      const a = MState.yaw + u * TAU * 1.4;
      const r = 10 + u * 14;
      const rx = cx + Math.cos(a) * r;
      const ry = cy - 6 + u * 16 + Math.sin(a) * 4.5;
      const col = sampleAuroraSpectrum(u + t * 0.6, Aurora, Prism);
      p.dot(rx, ry, i < 4 ? WHITE : col, danceAlpha * (1 - u * 0.6));
    }
  }
}

// 2. STATE 2 ECO QUIRK: LUMINOUS FACETED CRYSTAL MIRROR & INTOXICATED PINK HEART STARDUST
//    ("它用翅膀在面前凝聚出一面发光的水晶镜子、在镜子前像芭蕾舞者一样高傲地旋转跳跃展示优美身姿、并在头顶洒下一片陶醉的粉色爱心星尘",
//     Frames 63, 84, 105!)
function drawCrystalMirrorAndHeartStardust(p, Aurora, Prism, Crystal, MState, t, seed) {
  if (t < T_QUIRK - 0.10 || t >= T_MOVE + 0.15) return;

  const mirAlpha = smooth(T_QUIRK - 0.05, T_QUIRK + 0.22, t) * (1 - smooth(T_MIRROR_FADE, T_MOVE, t));
  if (mirAlpha <= 0.02) return;

  const mx = X_MIRROR;
  const my = Y_MIRROR + Math.sin(t * 3.5) * 2.0;
  const rx = 11.5 * ease.outBack(mirAlpha, 1.4);
  const ry = 18.5 * ease.outBack(mirAlpha, 1.4);

  // 2A: Condensing aurora weave rays from the moth's wings into the mirror during `1.90..2.26s` (Frame 63 at `2.10s`!)
  if (t < 2.28) {
    const weaveK = Math.sin(seg(t, T_QUIRK - 0.05, 2.28) * Math.PI);
    for (let i = 0; i < 5; i++) {
      const sy = MState.y - 8 + i * 4;
      const ty = my - 12 + i * 6;
      p.line(MState.x + 12, sy, mx - rx, ty, i % 2 === 0 ? Crystal[4] : Aurora[3], weaveK * 0.80);
    }
  }

  // 2B: Luminous Faceted Crystal Mirror ("一面发光的水晶镜子")
  for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
    for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
      const d = Math.hypot(dx / rx, dy / ry);
      if (d > 1.0) continue;
      const sheen = Math.sin((dx * 0.45 + dy * 0.28) - t * 3.2);
      const glassCol = d > 0.84
        ? (dx + dy < 0 ? WHITE : Crystal[3])
        : sheen > 0.72
          ? Crystal[5]
          : sheen > 0.35
            ? Crystal[3]
            : Crystal[1];
      const alpha = d > 0.84 ? 0.95 * mirAlpha : (0.52 + 0.25 * Math.max(0, sheen)) * mirAlpha;
      p.blend(mx + dx, my + dy, glassCol, alpha);
    }
  }

  // Shimmering reflection of the Aurora Moth spinning inside the Crystal Mirror
  if (mirAlpha > 0.5) {
    const refX = mx - 1 + Math.sin(t * 6) * 1.5;
    const refY = my + (MState.y - Y_IDLE) * 0.45;
    for (const s of [-1, 1]) {
      const wSpan = 5.5 * (s < 0 ? MState.wingSpanR : MState.wingSpanL);
      p.line(refX, refY - 1, refX + s * wSpan, refY - 4, Aurora[3], 0.78 * mirAlpha);
      p.line(refX, refY + 1, refX + s * wSpan * 0.8, refY + 4, Prism[3], 0.72 * mirAlpha);
    }
    p.line(refX, refY - 4, refX, refY + 4, WHITE, 0.90 * mirAlpha);
  }

  for (const [fx, fy, len] of [[0, -ry - 3, 3], [0, ry + 3, 3], [-rx - 2, 0, 2], [rx + 2, 0, 2]]) {
    sparkle(p, mx + fx, my + fy, len * mirAlpha, WHITE, Crystal[3], 0.85 * mirAlpha);
  }
  p.glow(mx, my, 26, Crystal[3], 0.42 * mirAlpha);
  p.glow(mx, my, 14, WHITE, 0.28 * mirAlpha);

  // 2C: Shower of Intoxicated Pink Heart Stardust above the Moth's Head ("并在头顶洒下一片陶醉的粉色爱心星尘", Frames 63, 84, 105!)
  if (t >= 2.02) {
    const heartEnv = smooth(2.02, 2.20, t) * (1 - smooth(3.85, 4.08, t));
    for (let h = 0; h < 6; h++) {
      const hPeriod = 0.75;
      const hPhase = ((t - 2.02 + h * 0.24) % hPeriod) / hPeriod;
      const hAlpha = Math.sin(hPhase * Math.PI) * heartEnv;
      if (hAlpha <= 0.12) continue;

      const hx = Math.round(MState.x - 14 + (h - 2.5) * 7.5 + Math.sin(t * 5 + h * 1.7) * 3.0);
      const hy = Math.round(MState.y - 18 - hPhase * 22);
      const isBig = h % 2 === 0;

      if (isBig) {
        for (const [dx, dy] of HEART_PIXELS) {
          const isHighlight = dx === -1 && dy === -1;
          const isRim = Math.abs(dx) >= 2 || dy >= 2;
          const col = isHighlight ? WHITE : isRim ? Prism[2] : Prism[3];
          p.dot(hx + dx, hy + dy, col, hAlpha * 0.95);
        }
      } else {
        for (const [dx, dy] of [[-1, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) {
          p.dot(hx + dx, hy + dy, dy < 0 ? WHITE : Prism[3], hAlpha * 0.92);
        }
      }
      p.glow(hx, hy, 8, Prism[2], 0.35 * hAlpha);
    }

    for (let s = 0; s < 14; s++) {
      const r = rng(seed, s, 211);
      const sPhase = ((t * 1.4 + r.range(0, 1)) % 1);
      const sa = Math.sin(sPhase * Math.PI) * heartEnv;
      const sx = MState.x + r.range(-22, 22) + Math.cos(t * 4 + s) * 4;
      const sy = MState.y - 12 - sPhase * 28 + Math.sin(t * 3 + s) * 3;
      if (s % 3 === 0) {
        sparkle(p, sx, sy, 2.5 * sa, WHITE, Prism[4], 0.75 * sa);
      } else {
        p.dot(sx, sy, s % 2 === 0 ? Prism[4] : Prism[3], sa * 0.9);
      }
    }
  }
}

// 3. STATE 3 MOVE: WIDE S-CURVE RAINBOW STREAMER GLIDE & SKY-FILLING AURORA SCALE-DUST
//    ("双翼轻盈一振、身体化作一道绚丽的彩虹流光在空中划出优美的S型弧线滑翔并洒落漫天极光鳞粉", Frames 125, 146, 167!)
function drawSCurveRainbowGlideAndScaleDust(p, Aurora, Prism, Crystal, MState, t, seed) {
  if (t < T_MOVE || t > T_ATK + 0.35) return;

  // 3A: Initial wing-beat launch ring at `(X_IDLE, Y_IDLE)` (`4.05..4.42s`, Frame 125 at `4.17s`!)
  if (t < 4.44) {
    const lk = 1 - seg(t, T_MOVE, 4.44);
    const rr = 8 + 24 * ease.outCubic(1 - lk);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      const col = sampleAuroraSpectrum(i / 24 + t, Aurora, Prism);
      p.dot(X_IDLE + Math.cos(a) * rr * 0.55, Y_IDLE + Math.sin(a) * rr, col, lk * 0.88);
    }
    sparkle(p, X_IDLE, Y_IDLE, 11 * lk, WHITE, Aurora[3], 0.80 * lk);
  }

  if (t < T_GLIDE_START) return;

  const glideU = clamp((t - T_GLIDE_START) / (T_GLIDE_END - T_GLIDE_START), 0, 1);
  const trailFade = 1 - smooth(T_GLIDE_END - 0.04, T_ATK + 0.28, t);
  if (trailFade <= 0.02) return;

  // 3B: Water-Tight Multi-Banded 7-Color Rainbow Streamer Ribbon ("身体化作一道绚丽的彩虹流光在空中划出优美的S型弧线滑翔")
  //     Traces the full S-curve from `0` up to `glideU` with solid cross-sectional shading so there are zero dark gaps!
  const uStart = Math.max(0, glideU - 0.94);
  const steps = 110;
  const bandColors = [Prism[3], Aurora[4], WHITE, Aurora[3], Aurora[2], Prism[4]];

  for (let s = 0; s < steps; s++) {
    const f0 = s / steps;
    const f1 = (s + 1) / steps;
    const u0 = lerp(uStart, glideU, f0);
    const u1 = lerp(uStart, glideU, f1);
    const p0 = sCurveAt(u0);
    const p1 = sCurveAt(u1);

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.max(0.01, Math.hypot(dx, dy));
    const nx = -dy / len;
    const ny = dx / len;

    const segAlpha = (0.38 + 0.62 * Math.pow(f1, 0.75)) * trailFade;
    const halfWidth = (1.8 + 4.4 * Math.sin(Math.pow(f1, 0.7) * Math.PI)) * trailFade;

    for (let off = -halfWidth; off <= halfWidth; off += 0.55) {
      const bNorm = (off / Math.max(0.5, halfWidth) + 1) * 0.5; // 0..1 across width
      const bIdx = clamp(Math.floor(bNorm * bandColors.length), 0, bandColors.length - 1);
      const col = Math.abs(off) < 0.75 ? WHITE : bandColors[bIdx];
      p.line(
        p0.x + nx * off,
        p0.y + ny * off,
        p1.x + nx * off,
        p1.y + ny * off,
        col,
        segAlpha * (Math.abs(off) < 0.75 ? 0.98 : 0.88)
      );
    }
    if (s % 9 === 0) {
      p.glow(p0.x, p0.y, 13, sampleAuroraSpectrum(u0 * 2, Aurora, Prism), 0.30 * segAlpha);
    }
  }

  // Radiant rainbow comet sheath around the gliding moth
  if (MState.rainbowGlow > 0.05) {
    const rg = MState.rainbowGlow;
    p.ring(MState.x, MState.y, 15, 1.5, WHITE, 0.78 * rg);
    p.glow(MState.x, MState.y, 30, Aurora[3], 0.45 * rg);
  }

  // 3C: Sky-Filling Cascade of Twinkling Aurora Scale-Dust ("并洒落漫天极光鳞粉", Frames 147 & 167!)
  for (let i = 0; i < 68; i++) {
    const r = rng(seed, i, 307);
    const spawnU = (i / 68) * 0.95;
    const spawnT = lerp(T_GLIDE_START, T_GLIDE_END, spawnU);
    const age = t - spawnT;
    const life = r.range(0.85, 1.50);
    if (age <= 0 || age >= life) continue;

    const originPos = sCurveAt(spawnU);
    const k = age / life;
    const alpha = Math.min(1, k * 6) * (1 - k * k);
    const sx = originPos.x + r.range(-18, 18) + Math.sin(age * 6 + i) * 6.5;
    const sy = Math.min(-2, originPos.y + r.range(-14, 14) + age * r.range(12, 30));
    const col = sampleAuroraSpectrum(i / 14 + age * 0.5, Aurora, Prism);

    if (i % 3 === 0) {
      sparkle(p, sx, sy, 3.5 * alpha, WHITE, col, 0.88 * alpha);
    } else {
      p.dot(sx, sy, col, alpha * 0.96);
      p.dot(sx, sy - 1, WHITE, alpha * 0.80);
    }
    if (i % 3 === 0) {
      p.glow(sx, sy, 6, col, 0.28 * alpha);
    }
  }
}

// Helper to draw a diagonal-chord Crescent-Shaped Iridescent Aurora Wind-Blade with streaming light-cut ribbons
// ("三道新月形的绚丽极光风刃交叉斩向远方" + "极光风刃的流光切割感")
function drawCrescentAuroraBlade(p, tipX, tipY, slashSkew, halfSpan, bellyWidth, colorRamp, alpha, t) {
  const padX = Math.ceil(halfSpan * Math.abs(slashSkew) + bellyWidth + 16);
  const padY = Math.ceil(halfSpan + 6);

  for (let wy = Math.floor(tipY - padY); wy <= Math.min(1, Math.ceil(tipY + padY)); wy++) {
    const dy = wy - tipY;
    const u = dy / halfSpan; // -1 (top horn) .. +1 (bottom horn)
    if (Math.abs(u) > 1.0) continue;

    // Parabolic crescent curve: bows forward at `u = 0` (`tipX`), sweeps back at `u = ±1` (`-11px`),
    // and skews diagonally by `slashSkew * dy` so `\`, `/`, and `|` blades cross in a dramatic X-star!
    const bowBack = 11.5 * u * u;
    const skewX = dy * slashSkew;
    const leadX = tipX - bowBack + skewX;
    // Crescent thickness is widest at the belly (`u = 0`) and tapers to razor-sharp needle points at both horns (`u = ±1`)!
    const localW = bellyWidth * (1 - u * u);
    if (localW < 0.35) continue;

    for (let wx = Math.floor(leadX - localW - 1); wx <= Math.ceil(leadX + 0.5); wx++) {
      const depth = leadX - wx;
      if (depth < -0.4 || depth > localW) continue;
      const q = clamp(depth / Math.max(0.6, localW), 0, 1);
      const col = q < 0.32 ? WHITE : q < 0.68 ? colorRamp[0] : colorRamp[1];
      p.blend(wx, wy, col, alpha * (1 - q * 0.18));
    }
  }

  // Streaming light-cut ribbons ("极光风刃的流光切割感") trailing horizontally & diagonally behind the crescent horns and belly!
  for (const uH of [-0.85, -0.42, 0.0, 0.42, 0.85]) {
    const dy = uH * halfSpan;
    const bowBack = 11.5 * uH * uH;
    const wx0 = tipX - bowBack + dy * slashSkew - bellyWidth * (1 - uH * uH) * 0.6;
    const wy0 = tipY + dy;
    const tailLen = (20 + 12 * (1 - Math.abs(uH))) * alpha;
    const wx1 = wx0 - tailLen;
    const wy1 = wy0 - slashSkew * tailLen * 0.35 + Math.sin(t * 25 + uH * 5) * 1.5;
    if (wy0 <= 1.5 && wy1 <= 1.5) {
      p.line(wx0, wy0, wx1, wy1, Math.abs(uH) < 0.1 ? WHITE : colorRamp[0], alpha * 0.88);
      p.line(wx0, wy0 - 1, wx1, wy1 - 1, colorRamp[1], alpha * 0.65);
    }
  }

  p.glow(tipX - 3, tipY, 18, colorRamp[0], 0.42 * alpha);
}

// 4. STATE 4 ATTACK: WING-CLAP PRISM CHARGE, 3 INTERSECTING CRESCENT AURORA WIND-BLADES & PRISMATIC BURST HIT
//    ("它高昂起头颅双翼猛然合十再华丽展开、瞬间煽动出三道新月形的绚丽极光风刃交叉斩向远方"
//     + "要有极光风刃的流光切割感和命中时爆开绚丽彩光的命中结果特效", Frames 188, 209, 230!)
function drawAuroraWindBladesAndPrismaticHit(p, Aurora, Prism, Crystal, MState, t, seed, layer) {
  if (t < T_ATK || t > T_KO + 0.25) return;

  // 4A: Ground Aurora Refraction Ring beneath `X_HIT` (`layer === "back"`)
  if (layer === "back") {
    if (t < T_HIT) return;
    const hitAge = t - T_HIT;
    const dur = 1.32;
    if (hitAge > dur) return;
    const u = hitAge / dur;
    const fade = 1 - smooth(0.68, 1.0, u);
    const rx = 44 * ease.outCubic(Math.min(1, hitAge / 0.18));
    const ry = 7.5 * ease.outCubic(Math.min(1, hitAge / 0.18));

    for (const frac of [0.45, 0.75, 1.0]) {
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * TAU + hitAge * (frac === 0.75 ? -2 : 2);
        const gx = X_HIT + Math.cos(a) * rx * frac;
        const gy = 3 + Math.sin(a) * ry * frac;
        const col = sampleAuroraSpectrum(i / 32 + frac, Aurora, Prism);
        p.dot(gx, gy, i % 4 === 0 ? WHITE : col, fade * 0.85);
      }
    }
    p.glow(X_HIT, 2, rx * 0.9, Aurora[3], 0.38 * fade);
    return;
  }

  // FOREGROUND LAYER (`layer === "front"`):
  // 4B: Wing-Clap Prism Charge Rings (`6.05..6.52s`, Frame 188 at `6.27s`!)
  //     ("高昂起头颅双翼猛然合十")
  if (t < T_SLASH_FIRE) {
    const u = seg(t, T_ATK, T_SLASH_FIRE);
    const chargeX = MState.x;
    const chargeY = MState.y - 10;
    const rRing = 24 * (1 - ease.inQuad(u)) + 5;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU + t * 8;
      const col = sampleAuroraSpectrum(i / 24 + t, Aurora, Prism);
      p.dot(chargeX + Math.cos(a) * rRing * 0.65, chargeY + Math.sin(a) * rRing, col, u * 0.92);
    }
    sparkle(p, chargeX, chargeY - 12, 10 * u, WHITE, Aurora[3], 0.85 * u);
    p.glow(chargeX, chargeY, 26 * u, Aurora[3], 0.45 * u);
  }

  // 4C: Magnificent Wing-Unfurl Flash & Three Intersecting Crescent Aurora Wind-Blades (`6.52..7.38s`, Frame 209 at `6.97s`!)
  //     ("再华丽展开、瞬间煽动出三道新月形的绚丽极光风刃交叉斩向远方")
  if (t >= T_SLASH_FIRE) {
    const sAge = t - T_SLASH_FIRE;

    if (sAge < 0.24) {
      const uk = 1 - sAge / 0.24;
      p.ring(MState.x, MState.y, 12 + 28 * ease.outCubic(sAge / 0.24), 1.4, Aurora[3], uk * 0.85);
      sparkle(p, MState.x + 8, MState.y, 12 * uk, WHITE, Prism[4], 0.8 * uk);
    }

    // 3 Intersecting Crescent Wind-Blades slicing across the arena (`x = +15 .. +86`):
    // At Frame 209 (`t = 6.97s`, `sAge = 0.45s`), the 3 crescent blades are skewed at `\`, `/`, and `|`
    // so their razor-sharp crescent arcs and streaming light-cut wakes visibly cross each other ("三道新月形的绚丽极光风刃交叉斩向远方")!
    const bladeSpecs = [
      { delay: 0.00, flightDur: 0.66, skew: +0.72, xLead: +14, yStart: Y_ATK - 4, yEnd: Y_HIT + 4, span: 16, w: 5.5, ramp: [Aurora[3], Aurora[2]] }, // Down-Right Diagonal Emerald-Cyan Crescent (\)
      { delay: 0.04, flightDur: 0.66, skew: -0.72, xLead:   0, yStart: Y_ATK + 4, yEnd: Y_HIT - 4, span: 16, w: 5.5, ramp: [Prism[3], Aurora[4]] },  // Up-Right Diagonal Rose-Violet Crescent (/)
      { delay: 0.08, flightDur: 0.66, skew:  0.00, xLead: -16, yStart: Y_ATK,     yEnd: Y_HIT,     span: 17, w: 5.8, ramp: [Prism[4], Aurora[3]] },  // Center Sovereign Gold-Cyan Crescent (|)
    ];

    for (let b = 0; b < bladeSpecs.length; b++) {
      const sp = bladeSpecs[b];
      const bAge = sAge - sp.delay;
      if (bAge < 0 || bAge > sp.flightDur) continue;
      const bu = bAge / sp.flightDur;
      const bAlpha = Math.min(1, bu * 6) * (1 - smooth(0.78, 1.0, bu));

      const tipX = lerp(X_ATK + 18, X_HIT + sp.xLead, ease.outQuad(bu));
      const tipY = lerp(sp.yStart, sp.yEnd, ease.outQuad(bu));

      drawCrescentAuroraBlade(p, tipX, tipY, sp.skew, sp.span, sp.w, sp.ramp, bAlpha, t);
    }
  }

  // 4D: Dazzling Prismatic Rainbow Nova Burst Hit Result (`7.02..8.28s`, Frame 230 at `7.67s`!)
  //     ("和命中时爆开绚丽彩光的命中结果特效")
  if (t >= T_HIT) {
    const hitAge = t - T_HIT;
    const hitDur = 1.24;
    if (hitAge < hitDur) {
      const hu = hitAge / hitDur;
      const hAlpha = 1 - smooth(0.72, 1.0, hu);

      // 1) 3 Intersecting Chromatic Slash-Scars ("交叉极光斩痕") ripped into space at `(X_HIT, Y_HIT)`
      const scarAngles = [-0.46, +0.46, 0.0];
      const scarColors = [Aurora[3], Prism[3], Prism[4]];
      for (let s = 0; s < 3; s++) {
        const sa = scarAngles[s];
        const sLen = 32 * ease.outCubic(Math.min(1, hitAge / 0.14)) * (1 - hu * 0.22);
        const dx = Math.cos(sa) * sLen;
        const dy = Math.sin(sa) * sLen;
        p.line(X_HIT - dx, Y_HIT - dy - 1, X_HIT + dx, Y_HIT + dy - 1, scarColors[s], hAlpha * 0.88);
        p.line(X_HIT - dx, Y_HIT - dy, X_HIT + dx, Y_HIT + dy, WHITE, hAlpha * 0.96);
        p.line(X_HIT - dx, Y_HIT - dy + 1, X_HIT + dx, Y_HIT + dy + 1, Aurora[4], hAlpha * 0.88);
      }

      // 2) Multi-Ringed Iridescent Prismatic Shockwaves expanding outward (`Frame 230 at 7.67s`!)
      for (let ringIdx = 0; ringIdx < 4; ringIdx++) {
        const rAge = hitAge - ringIdx * 0.16;
        if (rAge <= 0 || rAge > 0.88) continue;
        const ru = rAge / 0.88;
        const rk = 1 - smooth(0.58, 1.0, ru);
        const rad = 8 + 38 * ease.outCubic(ru);
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * TAU + ringIdx * 0.5;
          const col = sampleAuroraSpectrum(i / 40 + ringIdx * 0.28, Aurora, Prism);
          const rx = X_HIT + Math.cos(a) * rad;
          const ry = Y_HIT + Math.sin(a) * rad * 0.88;
          if (ry <= 1.5) {
            p.dot(rx, ry, i % 4 === 0 ? WHITE : col, rk * 0.94);
          }
        }
      }

      // 3) 18 Radial Prismatic Light-Rays & Shattering Rainbow Prism Shards
      for (let i = 0; i < 18; i++) {
        const r = rng(seed, i, 521);
        const a = (i / 18) * TAU + r.range(-0.10, 0.10);
        const sp = r.range(32, 68);
        const dist = sp * ease.outCubic(hu);
        const px = X_HIT + Math.cos(a) * dist;
        const py = Y_HIT + Math.sin(a) * dist * 0.85;
        if (py > 0) continue;
        const col = sampleAuroraSpectrum(i / 18, Aurora, Prism);

        const rayIn = Math.max(4, dist * 0.38);
        p.line(
          X_HIT + Math.cos(a) * rayIn,
          Y_HIT + Math.sin(a) * rayIn * 0.85,
          px,
          py,
          i % 3 === 0 ? WHITE : col,
          hAlpha * 0.85
        );
        sparkle(p, px, py, 4.2 * hAlpha, WHITE, col, 0.88 * hAlpha);
      }

      const coreStar = 16 * Math.pow(1 - hu * 0.55, 1.2);
      sparkle(p, X_HIT, Y_HIT, coreStar, WHITE, Prism[4], 0.92 * hAlpha);
      p.glow(X_HIT, Y_HIT, 44 * hAlpha, Aurora[3], 0.52 * hAlpha);
      p.glow(X_HIT, Y_HIT, 26 * hAlpha, Prism[3], 0.45 * hAlpha);
    }
  }
}

// 5. STATE 5 KO: TORN-SILK WING FRACTURE LIGHT-RAIN & BLOOMING GROUND ICE-CRYSTAL LOTUS FLOWER
//    ("极光翅膀像破碎的丝绸般寸寸断裂化作光雨、白色核心优雅地缓缓坠落并在触地瞬间化作一朵冰晶花消散的完整过程",
//     Frames 251, 272, 293, 314!)
function drawKoSilkRuptureAndIceFlower(g, p, Aurora, Prism, Crystal, MState, t, seed) {
  if (t < T_KO) return;

  // 5A: Inch-by-Inch Silk Wing Fracture & Rainbow Light-Rain Shower (`8.25..9.50s`, Frames 251 & 272!)
  //     ("极光翅膀像破碎的丝绸般寸寸断裂化作光雨")
  const koAge = t - T_KO;
  if (koAge < 1.25) {
    for (const side of [-1, 1]) {
      for (let segIdx = 0; segIdx < 9; segIdx++) {
        const uSpan = (segIdx + 0.5) / 9;
        // Wingtips break first (`breakTime = 0.02s`), root breaks last (`breakTime = 0.62s`)!
        // At Frame 251 (`t = 8.37s`, `koAge = 0.12s`), outer wingtips are fracturing off into silk ribbons;
        // at Frame 272 (`t = 9.07s`, `koAge = 0.82s`), the entire wings have dissolved into a shower of rainbow light-rain!
        const breakTime = (1 - uSpan) * 0.62;
        const fragAge = koAge - breakTime;
        if (fragAge < 0 || fragAge > 0.78) continue;

        const fk = fragAge / 0.78;
        const fAlpha = 1 - smooth(0.65, 1.0, fk);
        const startX = X_ATK + side * (5 + uSpan * 30);
        const startY = Y_ATK - 4 - uSpan * 6 + (segIdx % 2 === 0 ? -4 : 5);
        const col = sampleAuroraSpectrum(uSpan + (segIdx % 2) * 0.25, Aurora, Prism);

        const fx = startX + side * fragAge * 9 + Math.sin(fragAge * 14 + segIdx) * 3.0;
        const fy = Math.min(-1, startY + fragAge * 52);

        // Fluttering torn-silk ribbon piece right after detaching
        if (fragAge < 0.28) {
          const rot = fragAge * 10 * side + segIdx;
          const dx = Math.cos(rot) * 4.8;
          const dy = Math.sin(rot) * 2.8;
          p.line(fx - dx, fy - dy, fx + dx, fy + dy, col, fAlpha * 0.95);
          p.line(fx - dx, fy - dy - 1, fx + dx, fy + dy - 1, WHITE, fAlpha * 0.88);
        }

        // Falling rainbow light-rain droplets ("化作光雨")
        for (let rIdx = 0; rIdx < 3; rIdx++) {
          const rx = fx + (rIdx - 1) * 3.5;
          const ry = Math.min(0, fy + rIdx * 6.5 + fragAge * 20);
          const streakLen = (6.5 + rIdx * 2.0) * fAlpha;
          p.line(rx, Math.max(-110, ry - streakLen), rx, ry, rIdx === 1 ? WHITE : col, fAlpha * 0.94);
          p.dot(rx, ry, WHITE, fAlpha);
          if (ry >= -1.5) {
            // Tiny light-rain splash on the floor!
            p.dot(rx - 1, 0, col, fAlpha * 0.75);
            p.dot(rx + 1, 0, col, fAlpha * 0.75);
          }
        }
        p.glow(fx, fy, 10, col, 0.30 * fAlpha);
      }
    }
  }

  // 5B: Ground Impact Frost Wave & Blooming 3D Ice-Crystal Lotus Flower (`9.38..10.28s`, Frame 293 at `9.77s`!)
  //     ("并在触地瞬间化作一朵冰晶花消散的完整过程")
  if (t >= T_FLOWER_BLOOM && t < 10.30) {
    const flAge = t - T_FLOWER_BLOOM;
    const flDur = 0.90;
    const fu = clamp(flAge / flDur, 0, 1);

    // Bloom envelope: unfolds across `0.00..0.22`, holds full majestic crystal lotus bloom across `0.22..0.64`
    // (Frame 293 is at `t = 9.77s`, `flAge = 0.39s`, `fu = 0.43` — 100% full bloom!), then sublimates (`0.64..1.00`)!
    const bloomScale = fu < 0.22
      ? ease.outBack(fu / 0.22, 1.55)
      : fu < 0.64
        ? 1.0
        : 1.0 - ease.inQuad((fu - 0.64) / 0.36);

    const cx = X_FLOWER;
    const cy = 0;

    // Expanding ground frost ring & ice-runes around the blooming flower
    const ringFade = 1 - smooth(0.55, 1.0, fu);
    const rRx = 34 * ease.outCubic(Math.min(1, flAge / 0.24));
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      p.dot(cx + Math.cos(a) * rRx, 1 + Math.sin(a) * rRx * 0.22, i % 2 === 0 ? WHITE : Crystal[3], ringFade * 0.88);
    }

    if (bloomScale > 0.08) {
      g.clear();
      const s = bloomScale;

      // Sculpt a large, unmistakable, multi-petalled 3D Ice-Crystal Lotus Flower ("一朵冰晶花") using polygon petals!
      // 7 pointed crystalline lotus petals fanning upward and outward (`width = 52px`, `height = 28px`)!
      const petalSpecs = [
        // Back/Outer Crown Petals (`tId = 10`)
        { tipX: -24 * s, tipY: -9 * s,  midX: -12 * s, midY: -9 * s,  w: 4.5 * s, tone: 0, tId: 10 },
        { tipX: +24 * s, tipY: -9 * s,  midX: +12 * s, midY: -9 * s,  w: 4.5 * s, tone: 0, tId: 10 },
        { tipX: -17 * s, tipY: -20 * s, midX:  -8 * s, midY: -12 * s, w: 5.0 * s, tone: 1, tId: 10 },
        { tipX: +17 * s, tipY: -20 * s, midX:  +8 * s, midY: -12 * s, w: 5.0 * s, tone: 1, tId: 10 },
        // Inner Tall Crystal Lotus Petals (`tId = 11`)
        { tipX:  -9 * s, tipY: -25 * s, midX:  -4 * s, midY: -13 * s, w: 4.8 * s, tone: 2, tId: 11 },
        { tipX:  +9 * s, tipY: -25 * s, midX:  +4 * s, midY: -13 * s, w: 4.8 * s, tone: 2, tId: 11 },
        // Center Sovereign Spire Petal (`tId = 12`)
        { tipX:   0 * s, tipY: -28 * s, midX:   0 * s, midY: -14 * s, w: 5.4 * s, tone: 3, tId: 12 },
        // Front Lower Calyx Petals resting on the ground (`tId = 13`)
        { tipX: -14 * s, tipY:  +2 * s, midX:  -7 * s, midY:  -1 * s, w: 3.8 * s, tone: 2, tId: 13 },
        { tipX: +14 * s, tipY:  +2 * s, midX:  +7 * s, midY:  -1 * s, w: 3.8 * s, tone: 2, tId: 13 },
      ];

      const petalPolys = petalSpecs.map((ps) => {
        const dx = ps.tipX;
        const dy = ps.tipY;
        const len = Math.max(1, Math.hypot(dx, dy));
        const nx = -dy / len;
        const ny = dx / len;
        const pts = [
          [cx, cy],
          [cx + ps.midX + nx * ps.w, cy + ps.midY + ny * ps.w],
          [cx + ps.tipX, cy + ps.tipY],
          [cx + ps.midX - nx * ps.w, cy + ps.midY - ny * ps.w],
        ];
        return { ...ps, pts, nx, ny, len };
      });

      g.shade(cx - 28, cy - 32, cx + 28, cy + 5, (wx, wy, o) => {
        // Sublimation dither from the top/outer tips inward when `fu > 0.64`
        const distFromRoot = Math.hypot(wx - cx, wy - cy);
        if (fu > 0.64) {
          const subCut = (1 - (fu - 0.64) / 0.36) * 32;
          if (distFromRoot > subCut && ((wx + wy) & 1) === 0) return 0;
        }

        let hitPetal = null;
        for (let i = petalPolys.length - 1; i >= 0; i--) {
          if (inPoly(petalPolys[i].pts, wx + 0.5, wy + 0.5)) {
            hitPetal = petalPolys[i];
            break;
          }
        }
        if (!hitPetal) return 0;

        o.a = 1;
        o.t = hitPetal.tId;

        // Distance to the central mid-rib of this crystal petal (for faceted diamond-ice shading!)
        const rx = wx - cx;
        const ry = wy - cy;
        const ribDist = Math.abs(rx * hitPetal.nx + ry * hitPetal.ny);
        const alongU = clamp((rx * hitPetal.tipX + ry * hitPetal.tipY) / (hitPetal.len * hitPetal.len), 0, 1);
        const sideSign = rx * hitPetal.nx + ry * hitPetal.ny >= 0 ? 1 : -1;

        // Crisp 1px pure-white crystalline mid-rib & gleaming petal tip!
        if (ribDist < 0.75 || alongU > 0.84) return WHITE;
        // Sunlit facet vs shadow facet with subtle aurora refraction in the inner petals
        if (hitPetal.tone === 3) {
          return sideSign > 0 ? Crystal[4] : Aurora[3];
        }
        if (hitPetal.tone === 2) {
          return sideSign > 0 ? Crystal[4] : Crystal[3];
        }
        if (hitPetal.tone === 1) {
          return sideSign > 0 ? Aurora[3] : Crystal[2];
        }
        return sideSign > 0 ? Crystal[3] : Crystal[2];
      });

      g.outline(() => Crystal[0]);
      g.draw(p);

      // Glowing Starlight-Aurora Stamens ("冰晶花蕊") rising from the center of the crystal lotus
      for (const [sxOff, syOff] of [[-5, -15], [0, -18], [5, -15]]) {
        const tx = cx + sxOff * s;
        const ty = cy + syOff * s;
        p.line(cx, cy - 3, tx, ty, WHITE, 0.92);
        sparkle(p, tx, ty, 3.5 * s, WHITE, Prism[4], 0.88);
      }

      p.glow(cx, cy - 10 * s, 32 * s, Crystal[3], 0.48);
      p.glow(cx, cy - 12 * s, 18 * s, Aurora[3], 0.42);
    }

    // Sublimating ice-crystal glints & frost flakes rising from the Ice-Crystal Flower (`fu > 0.25`)
    if (fu > 0.25) {
      const subU = (fu - 0.25) / 0.75;
      const subA = Math.sin(subU * Math.PI);
      for (let i = 0; i < 16; i++) {
        const r = rng(seed, i, 743);
        const a = (i / 16) * TAU;
        const d = lerp(22, 6, subU) * r.range(0.5, 1.1);
        const ix = cx + Math.cos(a + subU * 1.5) * d;
        const iy = cy - 8 + Math.sin(a) * d * 0.45 - subU * r.range(12, 32);
        if (i % 3 === 0) {
          sparkle(p, ix, iy, 3.2 * subA, WHITE, Crystal[4], 0.82 * subA);
        } else {
          p.dot(ix, iy, i % 2 === 0 ? WHITE : Aurora[3], subA * 0.92);
        }
      }
    }
  }

  // 5C: Smooth Revival Stream (`9.95..10.50s`, Frame 314 at `10.47s`!):
  //     Aurora & ice motes spiral upward from `(X_FLOWER, -6)` to `(X_IDLE, Y_IDLE)` to re-form the Aurora Moth!
  if (t >= 9.95) {
    const revU = seg(t, 9.95, D);
    const k = Math.sin(revU * Math.PI);
    for (let i = 0; i < 16; i++) {
      const r = rng(seed, i, 883);
      const stU = clamp((revU - r.range(0, 0.22)) / 0.78, 0, 1);
      if (stU <= 0 || stU >= 1) continue;
      const sx = lerp(X_FLOWER + r.range(-12, 12), X_IDLE, ease.inOutCubic(stU)) + Math.sin(stU * TAU) * 6;
      const sy = lerp(-8, Y_IDLE, ease.inOutCubic(stU));
      const col = sampleAuroraSpectrum(i / 16 + stU, Aurora, Prism);
      p.dot(sx, sy, i % 3 === 0 ? WHITE : col, Math.sin(stU * Math.PI));
    }
    p.glow(MState.x, MState.y, 26 * k, Aurora[3], 0.42 * k);
  }
}

export function drawBack(p, time, o) {
  const t = wrap(time, D);
  const Aurora = fit(o.palette, 7);
  const Prism = fit(o.prism, 6);
  const Crystal = fit(o.crystal, 6);
  const MState = computeMothState(t);

  // 1. Soft aurora ground reflection & levitation shadow beneath the flying moth
  if (MState.coreVisible) {
    const shX = MState.x;
    const shRx = 14 * MState.coreScale;
    for (let y = -1; y <= 2; y++) {
      for (let x = Math.floor(shX - shRx); x <= Math.ceil(shX + shRx); x++) {
        const d = ((x - shX) / shRx) ** 2 + (y / 2.2) ** 2;
        if (d < 1) p.blend(x, y, Aurora[0], 0.45 * (1 - d));
      }
    }
    p.glow(shX, 0, 26, Aurora[3], 0.22);
  }

  // 2. Ground Aurora Refraction Ring during State 4 Prismatic Hit
  drawAuroraWindBladesAndPrismaticHit(p, Aurora, Prism, Crystal, MState, t, o.seed, "back");

  // 3. Ambient floating aurora silk motes across the loop
  cycle(t, D, 18, o.seed * 29 + 11, (r) => r.range(1.1, 1.9), (ag, L, r, i) => {
    const k = ag / L;
    const x = r.range(-88, 42) + Math.sin(ag * 3 + i) * 4.0;
    const y = -r.range(14, 72) + ag * r.range(6, 14);
    const a = Math.min(1, k * 4) * (1 - k) * 0.78;
    if (a <= 0.05 || y > -2) return;
    const col = sampleAuroraSpectrum(i / 18, Aurora, Prism);
    p.dot(x, y, i % 4 === 0 ? WHITE : col, a);
    p.glow(x, y, 4, col, 0.20 * a);
  });
}

export function draw(p, time, o) {
  const t = wrap(time, D);
  const Aurora = fit(o.palette, 7);
  const Prism = fit(o.prism, 6);
  const Crystal = fit(o.crystal, 6);
  const MState = computeMothState(t);

  // 1. Draw State 3 S-Curve Rainbow Streamer & Sky-Filling Aurora Scale-Dust (behind the moth)
  drawSCurveRainbowGlideAndScaleDust(p, Aurora, Prism, Crystal, MState, t, o.seed);

  // 2. Draw the Silky 7-Color Aurora Ribbon Wings & Luminous Pure-White Streamlined Chrysalis Core
  drawAuroraMothBody(GRID, p, Aurora, Prism, Crystal, MState, t, o.seed);

  // 3. Draw State 2 Luminous Faceted Crystal Mirror & Intoxicated Pink Heart Stardust
  drawCrystalMirrorAndHeartStardust(p, Aurora, Prism, Crystal, MState, t, o.seed);

  // 4. Draw State 4 Wing-Clap Prism Charge, 3 Intersecting Crescent Aurora Wind-Blades & Prismatic Burst Hit
  drawAuroraWindBladesAndPrismaticHit(p, Aurora, Prism, Crystal, MState, t, o.seed, "front");

  // 5. Draw State 5 Torn-Silk Wing Fracture Light-Rain & Ground Ice-Crystal Lotus Flower
  drawKoSilkRuptureAndIceFlower(GRID, p, Aurora, Prism, Crystal, MState, t, o.seed);
}
