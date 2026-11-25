// Frost Snowball Beast ("critters/frost-snowball" — 【冰霜雪球兽小怪物特效】):
// A goofy, playful polar snowball creature with a snowflake-dusted round white body, two translucent ice-crystal
// stubby hands, and an ice-blue breathing core glow, showcasing five sustained action states with smooth C1-continuous
// transitions across a 10.5s loop (315 frames @ 30fps):
// 1. 【待机 Idle (0.00..1.85s)】: A chubby round white snowball creature covered in sparkling snowflakes
//    ("一颗覆盖着晶莹雪花的圆滚滚白色雪球生物"), with two translucent ice-crystal stubby hands on its sides
//    ("两侧长着两只半透明的冰晶小短手") and an ice-blue breathing glow shining from its core ("中心透出冰蓝色的呼吸光芒").
// 2. 【生态小动作 Eco Quirk (1.85..4.15s)】: Playfully uses its translucent ice hands to pack a small snowball on
//    the ground ("贪玩地用冰晶小手在地上搓出一个小雪球"), clumsily hops on top of the mini snowball to perform a
//    circus ball-balancing act ("笨拙地跳到小雪球上面试图表演杂技踩球平衡"), and slips right off to faceplant into
//    the ground, kicking up a ring of white snow ("结果脚下一滑直接脸朝下摔在地上激起一圈白雪").
// 3. 【移动 Move (4.15..5.95s)】: Tucks in its stubby little hands ("干脆收起小短手") and rolls merrily forward along
//    the ground like a rolling snowball; the farther it rolls, the more ice crystals and snowflakes stick to its
//    growing body while leaving a gleaming frost slide-trail behind ("直接在地上滚雪球般向前欢快翻滚、越滚身体表面粘附的冰晶雪花越多并在身后留下一条冰霜滑道").
// 4. 【攻击 Attack & Freeze-Shatter Hit Result (5.95..8.20s)】: Spins at high speed in place to suck a swirling
//    frost vortex into its body ("原地高速旋转将周围的寒气吸入体内"), slams on the brakes and opens its mouth wide
//    to blast a raging blizzard vortex mixed with razor-sharp icicles ("随后猛然刹住车并张开嘴向前喷射出一阵夹杂着锋利冰锥的暴风雪"),
//    freezing and shattering the distant target in an explosive ice-spike burst ("暴风雪的寒气涡流和冰锥命中目标冻结炸裂的结果特效").
// 5. 【倒地 KO & Transparent Ice-Sphere Shatter (8.20..10.50s)】: Freezes stiff all over into a completely transparent
//    refractive ice sphere ("被冻得浑身僵硬变成一颗完全透明的冰球"), cracks with racing fractures ("随后咔嚓一声裂开"),
//    and shatters into countless crystal-clear ice chunks and snowflakes splashing in all directions ("裂开成无数晶莹剔透的冰块和雪花四散飞溅").
// Builds on ../ice/_lib.js, ../ice/frost-breath.js, ../ice/blizzard-vortex.js, ../ice/ice-shatter.js, and ./_lib.js
// (adapted from Sprite Fusion's open-source VFX, MIT License, Copyright (c) 2026 Hugo Duprez).
import {
  Rng,
  fit,
  mix,
  sparkle,
  clamp,
  smooth,
  seg,
  ease,
  lerp,
  rng,
  wrap,
  TAU,
  WHITE,
} from "../../core/index.js";
import { Grid, shadow } from "./_lib.js";
import {
  inPoly,
  glassPoly,
  blade,
  snowflake,
  flakeDesign,
  fractures,
  drawFractures,
} from "../ice/_lib.js";

export const meta = {
  name: "Frost snowball",
  desc: "A goofy snowball beast rolls a mini ball, wobbles and faceplants, gathers frost as it rolls, inhales a blizzard to blast icicles, then freezes into a glass sphere and shatters.",
  tags: ["critter", "monster", "ice", "snow", "snowball", "blizzard", "icicle", "shatter", "loop"],
  size: [288, 160],
  origin: [136, 132],
  duration: 10.5,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // 8-step Pure Packed-Snow & Fluffy Frost ramp (deep arctic indigo -> powder-shadow blue -> crisp snow white)
    palette: ["#142042", "#233c72", "#3b66ad", "#649be0", "#9ad0f8", "#ccf0ff", "#ebfbff", "#ffffff"],
    // 8-step Translucent Crystal Ice & Breathing Core ramp (abyssal sapphire -> electric ice-blue -> diamond white)
    ice: ["#0b1636", "#16306e", "#2258b6", "#3292eb", "#56cffc", "#98ecff", "#d8faff", "#ffffff"],
    // 6-step Blizzard Vortex & Frost Trail accent ramp
    frost: ["#10243e", "#1e4874", "#347cb2", "#62b8e8", "#aee6ff", "#ffffff"],
    seed: 1,
  },
};

const D = meta.duration;

// 5 Sustained Action State Timestamps across 10.5s (315 frames @ 30fps):
// 0.00..1.85s (Frames 0, 21, 42)          : State 1 — IDLE (Chubby snowball beast + snowflake crust + translucent ice hands + ice-blue breathing core)
// 1.85..4.15s (Frames 63, 84, 105)        : State 2 — ECO QUIRK (2A Pack mini snowball @ 63; 2B Circus ball-balance @ 84; 2C Slip & faceplant snow-ring @ 105)
// 4.15..5.95s (Frames 126, 147, 167)      : State 3 — MOVE (3A Tuck hands @ 126; 3B Roll forward accumulating ice crystals/snowflakes + frost slide-trail @ 147, 167)
// 5.95..8.20s (Frames 188, 209, 230)      : State 4 — ATTACK & HIT (4A Spin & inhale frost vortex @ 188; 4B Brake & blast icicle blizzard @ 209; 4C Target freeze-shatter @ 230)
// 8.20..10.50s (Frames 251, 272, 293, 314): State 5 — KO & ICE-SPHERE SHATTER (5A Transparent ice sphere @ 251; 5B Crack fractures @ 272; 5C Shatter chunks & snowflakes @ 293; 5D Reform @ 314)
const T_IDLE_END = 1.85;
const T_ECO_PACK_END = 2.45;
const T_ECO_BAL_END = 3.22;
const T_ECO_END = 4.15;
const T_MOVE_TUCK_END = 4.35;
const T_MOVE_END = 5.95;
const T_ATK_SPIN_END = 6.62;
const T_ATK_BLAST_END = 7.42;
const T_ATK_END = 8.20;
const T_KO_FREEZE_END = 8.82;
const T_KO_CRACK_END = 9.32;
const T_KO_SHATTER_END = 10.12;

const X_IDLE = -56;
const X_BALL = -30;
const X_FALL = -20;
const X_ROLL_START = -60;
const X_ROLL_END = 18;
const X_ATK = -20;
const X_HIT = 92;
const X_KO = -42;

const GRID = new Grid(-46, -46, 92, 92);

// Precompute deterministic snowflake designs & fracture cracks for State 5 KO
const FLAKE_DESIGNS = Array.from({ length: 16 }, (_, i) => flakeDesign(new Rng(101 + i * 17)));
const SPHERE_CRACKS_1 = fractures(
  new Rng(701),
  (x, y) => Math.hypot(x, y) <= 20.5,
  -3,
  -2,
  5,
  { len: 10, step: [1.8, 2.8], fork: 0.25 }
);
const SPHERE_CRACKS_2 = fractures(
  new Rng(709),
  (x, y) => Math.hypot(x, y) <= 20.5,
  0,
  0,
  8,
  { len: 16, step: [1.6, 2.6], fork: 0.35 }
);

//Precompute 22 polygon ice-chunk shapes for the State 5C Transparent Ice-Sphere Shatter
const SHATTER_CHUNKS = Array.from({ length: 22 }, (_, i) => {
  const r = new Rng(901 + i * 23);
  const sides = r.int(4, 6);
  const rad = r.range(3.2, 6.4);
  const pts = [];
  for (let k = 0; k < sides; k++) {
    const a = (k / sides) * TAU + r.range(-0.22, 0.22);
    const d = rad * r.range(0.72, 1.18);
    pts.push([Math.cos(a) * d, Math.sin(a) * d]);
  }
  const ang = (i / 22) * TAU + r.range(-0.14, 0.14);
  const spd = r.range(48, 128);
  return {
    pts,
    ox: Math.cos(ang) * r.range(2, 12),
    oy: Math.sin(ang) * r.range(2, 12),
    vx: Math.cos(ang) * spd * 1.15,
    vy: Math.sin(ang) * spd * 0.75 - r.range(28, 68),
    a0: r.range(0, TAU),
    va: r.range(-11, 11),
    f0: r.range(0, TAU),
    vf: r.range(7, 15),
    bounce: r.range(0.32, 0.52),
  };
});

// Compute unified continuous state of the Frost Snowball Beast at time `t`
function snowballState(t) {
  let x = X_IDLE;
  let y = -18; // center of snowball (radius ~18 so bottom touches y = 0)
  let baseR = 18.0;
  let sx = 1.0;
  let sy = 1.0;
  let tilt = 0.0;
  let rollRot = 0.0;
  let handExtend = 1.0;     // 1 = translucent ice hands visible on sides, 0 = tucked inside body
  let handWaveL = 0.0;      // left hand vertical/angle offset
  let handWaveR = 0.0;      // right hand vertical/angle offset
  let handReachFront = 0.0; // > 0 when reaching forward to pack the mini snowball
  let coreBreath = 0.5 + 0.5 * Math.sin(t * TAU * 1.15);
  let mouthOpen = 0.0;      // 0..1 for State 4B blizzard roar
  let faceplant = 0.0;      // 0..1 when faceplanted in State 2C
  let dizzy = 0.0;
  let accruedSnow = 0.0;    // 0..1 how many extra ice crystals/snowflakes stick to the rolling body in State 3
  let spinBlur = 0.0;       // 0..1 during State 4A high-speed vortex inhale spin
  let vitrified = 0.0;      // 0..1 during State 5A/5B when turned into a completely transparent ice sphere
  let crackReach = 0.0;     // > 0 during State 5B when cracks race across the transparent ice sphere
  let visible = 1.0;

  if (t < T_IDLE_END) {
    // =========================================================================
    // STATE 1: IDLE (0.00..1.85s — Frames 0, 21, 42)
    // Round white snowball beast covered in snowflakes, translucent ice-crystal
    // stubby hands waving, and ice-blue breathing glow shining from its core!
    // =========================================================================
    const bounce = Math.sin(t * TAU * 1.15);
    x = X_IDLE + Math.sin(t * TAU * 0.55) * 1.5;
    y = -18.0 - Math.max(0, bounce) * 2.5;
    sx = 1.0 - bounce * 0.045;
    sy = 1.0 + bounce * 0.045;
    tilt = Math.sin(t * TAU * 0.55) * 0.07;
    coreBreath = 0.55 + 0.45 * Math.sin(t * TAU * 1.15);
    handWaveL = Math.sin(t * TAU * 1.15 + 0.4) * 3.2;
    handWaveR = -Math.sin(t * TAU * 1.15 - 0.4) * 3.2;
  } else if (t < T_ECO_END) {
    // =========================================================================
    // STATE 2: ECO QUIRK (1.85..4.15s — Frames 63, 84, 105)
    // 2A (1.85..2.45s, Frame 63 @ 2.10s): Packs a mini snowball on the ground with its ice hands
    // 2B (2.45..3.22s, Frame 84 @ 2.80s): Clumsily hops onto the mini snowball to balance
    // 2C (3.22..4.15s, Frame 105 @ 3.50s): Slips and faceplants flat on the ground, kicking up snow
    // =========================================================================
    if (t < T_ECO_PACK_END) {
      // 2A: Lean forward and pat/roll a mini snowball at X_BALL (-30)
      const u = (t - T_IDLE_END) / (T_ECO_PACK_END - T_IDLE_END);
      const reach = smooth(0.0, 0.25, u);
      x = lerp(X_IDLE, X_BALL - 19, reach);
      const pat = Math.sin(u * TAU * 4.5);
      y = -17.2 + pat * 1.2;
      sx = 1.04 - pat * 0.03;
      sy = 0.96 + pat * 0.03;
      tilt = 0.22 * reach + pat * 0.05;
      handReachFront = reach;
      handWaveL = pat * 3.5;
      handWaveR = -pat * 3.5;
      coreBreath = 0.72 + 0.28 * Math.sin(t * 14);
    } else if (t < T_ECO_BAL_END) {
      // 2B: Hop onto top of the mini snowball (mini snowball radius = 8.5, top at y = -17)
      const u = (t - T_ECO_PACK_END) / (T_ECO_BAL_END - T_ECO_PACK_END);
      const hopU = clamp(u / 0.22, 0, 1);
      const balU = clamp((u - 0.22) / 0.78, 0, 1);
      const miniX = X_BALL + Math.sin(balU * TAU * 2.2) * 3.2;

      if (u < 0.22) {
        // Clumsy hop arc up onto the mini snowball
        x = lerp(X_BALL - 19, X_BALL, ease.outQuad(hopU));
        y = lerp(-17.2, -34.5, ease.outQuad(hopU)) - Math.sin(hopU * Math.PI) * 9.0;
        sx = 0.92;
        sy = 1.10;
        tilt = lerp(0.22, 0.0, hopU);
      } else {
        // Wobbling circus balance on top of the mini snowball (Frame 84 @ 2.80s -> u = 0.45!)
        const wobble = Math.sin(balU * TAU * 2.6);
        // Right before slipping (balU > 0.82), feet kick out and body pitches forward!
        const slipAnticipation = smooth(0.80, 1.0, balU);
        x = miniX + wobble * 3.8 + slipAnticipation * 6.0;
        y = -34.2 + Math.abs(wobble) * 1.2 + slipAnticipation * 4.0;
        tilt = wobble * 0.30 + slipAnticipation * 0.65;
        sx = 1.0 + wobble * 0.04;
        sy = 1.0 - wobble * 0.04;
        // Frantically flailing both translucent ice hands to keep balance!
        handWaveL = Math.sin(balU * TAU * 5.5) * 7.5 - 4.0;
        handWaveR = -Math.sin(balU * TAU * 5.5) * 7.5 - 4.0;
      }
      coreBreath = 0.85;
    } else {
      // 2C: Slip off the mini snowball and faceplant flat into the snow (Frame 105 @ 3.50s!)
      const u = (t - T_ECO_BAL_END) / (T_ECO_END - T_ECO_BAL_END);
      if (u < 0.14) {
        // Plunge face-first toward the ground (3.22..3.35s)
        const fu = u / 0.14;
        x = lerp(X_BALL + 5, X_FALL, fu);
        y = lerp(-30.0, -11.5, ease.inQuad(fu));
        tilt = lerp(0.65, 1.48, fu);
        sx = 0.90;
        sy = 1.15;
      } else if (u < 0.68) {
        // Faceplanted flat in the snow at X_FALL (-20)! (Frame 105 @ 3.50s is u = 0.30!)
        const su = (u - 0.14) / 0.54;
        const bounceDecay = Math.exp(-su * 6) * Math.cos(su * TAU * 2.5);
        x = X_FALL;
        y = -11.5 + bounceDecay * 1.5;
        sx = 1.38 + bounceDecay * 0.10;
        sy = 0.64 - bounceDecay * 0.08;
        tilt = 0.0;
        faceplant = 1.0;
        dizzy = 1.0;
        handWaveL = 5.0; // splayed flat on the snow!
        handWaveR = 5.0;
        coreBreath = 0.35;
      } else {
        // Pop back up and scoot smoothly to X_ROLL_START (-60) to start State 3!
        const ru = smooth(0.68, 1.0, u);
        x = lerp(X_FALL, X_ROLL_START, ease.inOutQuad(ru));
        y = lerp(-11.5, -18.0, ru) - Math.sin(ru * Math.PI) * 6.0;
        sx = lerp(1.34, 1.0, ru);
        sy = lerp(0.68, 1.0, ru);
        faceplant = 1 - smooth(0.68, 0.82, u);
        dizzy = 1 - ru;
      }
    }
  } else if (t < T_MOVE_END) {
    // =========================================================================
    // STATE 3: MOVE (4.15..5.95s — Frames 126, 147, 167)
    // 3A (4.15..4.35s, Frame 126 @ 4.20s): Tucks in its stubby ice hands
    // 3B (4.35..5.95s, Frames 147 @ 4.90s & 167 @ 5.57s): Rolls forward like a
    //     snowball, growing larger and accumulating sparkling ice crystals &
    //     snowflakes on its body while leaving a frost slide-trail behind!
    // =========================================================================
    if (t < T_MOVE_TUCK_END) {
      // 3A: Tuck stubby ice hands snugly into its round snow body (Frame 126 @ 4.20s)
      const u = (t - T_ECO_END) / (T_MOVE_TUCK_END - T_ECO_END);
      x = X_ROLL_START;
      y = -17.5;
      sx = 1.06;
      sy = 0.95;
      handExtend = Math.max(0.18, 1.0 - ease.inOutQuad(u) * 0.82); // show hands tucking in!
      coreBreath = 0.80;
    } else {
      // 3B: Joyful forward snowball roll from X_ROLL_START (-60) to X_ROLL_END (+18)
      const u = (t - T_MOVE_TUCK_END) / (T_MOVE_END - T_MOVE_TUCK_END);
      const rollProgress = smooth(0.0, 0.86, u);
      const settleBack = smooth(0.86, 1.0, u);

      // Accumulates snow & ice crystals as it rolls forward!
      accruedSnow = rollProgress * (1 - settleBack * 0.55);
      baseR = 18.0 + 5.2 * accruedSnow; // swells from r=18 to r=23.2!
      x = lerp(X_ROLL_START, X_ROLL_END, rollProgress);
      if (settleBack > 0) {
        x = lerp(X_ROLL_END, X_ATK, settleBack);
      }
      const bounce = Math.abs(Math.sin(rollProgress * Math.PI * 5)) * 2.2 * (1 - settleBack);
      y = -baseR - bounce;
      rollRot = rollProgress * TAU * 3.2;
      handExtend = settleBack; // hands stay tucked while rolling, pop back out at the end
      coreBreath = 0.78 + 0.22 * Math.sin(t * 16);
    }
  } else if (t < T_ATK_END) {
    // =========================================================================
    // STATE 4: ATTACK & HIT RESULT (5.95..8.20s — Frames 188, 209, 230)
    // 4A (5.95..6.62s, Frame 188 @ 6.27s): High-speed spin inhaling surrounding frost vortex
    // 4B (6.62..7.42s, Frame 209 @ 6.97s): Slams brakes & opens mouth to blast icicle blizzard
    // 4C (7.42..8.20s, Frame 230 @ 7.67s): Target freezes & shatters in explosive ice-spike burst
    // =========================================================================
    if (t < T_ATK_SPIN_END) {
      // 4A: High-speed spin in place at X_ATK (-20), inhaling surrounding cold air vortex!
      const u = (t - T_MOVE_END) / (T_ATK_SPIN_END - T_MOVE_END);
      x = X_ATK;
      baseR = lerp(20.0, 18.8, u);
      y = -baseR - Math.sin(u * Math.PI) * 3.5;
      spinBlur = Math.sin(u * Math.PI);
      rollRot = u * TAU * 5.0;
      sx = 0.94 + 0.10 * Math.sin(u * 45);
      sy = 1.06 - 0.08 * Math.sin(u * 45);
      handExtend = 0.85;
      handWaveL = -3.0;
      handWaveR = -3.0;
      coreBreath = 1.0; // core supercharged by inhaled frost!
    } else if (t < T_ATK_BLAST_END) {
      // 4B: Slams on the brakes, opens mouth wide, and blasts raging icicle blizzard! (Frame 209 @ 6.97s)
      const u = (t - T_ATK_SPIN_END) / (T_ATK_BLAST_END - T_ATK_SPIN_END);
      const brakeJolt = u < 0.15 ? Math.sin((u / 0.15) * Math.PI) : 0;
      x = X_ATK + 4 - brakeJolt * 3.0 + Math.sin(t * 55) * 0.6;
      baseR = 18.5;
      y = -baseR;
      sx = 1.12 - brakeJolt * 0.08;
      sy = 0.92 + brakeJolt * 0.08;
      tilt = -0.14; // bracing backward as it roars forward!
      mouthOpen = smooth(0.0, 0.12, u) * (1 - smooth(0.88, 1.0, u));
      handExtend = 1.0;
      handWaveL = -4.5;
      handWaveR = -4.5;
      coreBreath = 1.0;
    } else {
      // 4C: Hold victorious pose at X_ATK while target freezes & shatters at X_HIT (+92) (Frame 230 @ 7.67s),
      //     then smoothly slide to X_KO (-42)
      const u = (t - T_ATK_BLAST_END) / (T_ATK_END - T_ATK_BLAST_END);
      const moveKO = smooth(0.55, 1.0, u);
      x = lerp(X_ATK + 4, X_KO, moveKO);
      baseR = 18.0;
      y = -baseR;
      mouthOpen = Math.max(0, 1 - u * 4.0) * 0.4;
      coreBreath = lerp(0.95, 0.55, u);
    }
  } else {
    // =========================================================================
    // STATE 5: KO & TRANSPARENT ICE-SPHERE SHATTER (8.20..10.50s — Frames 251, 272, 293, 314)
    // 5A (8.20..8.82s, Frame 251 @ 8.37s): Freezes stiff into a completely transparent ice sphere
    // 5B (8.82..9.32s, Frame 272 @ 9.07s): CRACK! Jagged fractures race across the transparent ice sphere
    // 5C (9.32..10.12s, Frame 293 @ 9.77s): Shatters into countless crystal-clear ice chunks & snowflakes
    // 5D (10.12..10.50s, Frame 314 @ 10.47s): Smoothly reforms back into the Idle snowball beast
    // =========================================================================
    if (t < T_KO_FREEZE_END) {
      // 5A: Freezes stiff into a completely transparent refractive ice sphere! (Frame 251 @ 8.37s)
      const u = (t - T_ATK_END) / (T_KO_FREEZE_END - T_ATK_END);
      vitrified = smooth(0.0, 0.18, u);
      const shiver = u < 0.25 ? Math.sin(t * 70) * 1.2 : 0;
      x = X_KO + shiver;
      baseR = 20.0;
      y = -baseR;
      handExtend = 1.0;
      coreBreath = 0.85;
    } else if (t < T_KO_CRACK_END) {
      // 5B: CRACK! Jagged engraved fractures race across the transparent ice sphere! (Frame 272 @ 9.07s)
      const u = (t - T_KO_FREEZE_END) / (T_KO_CRACK_END - T_KO_FREEZE_END);
      vitrified = 1.0;
      crackReach = ease.outQuad(u) * 32.0;
      const tremor = Math.sin(t * 85) * (0.8 + u * 1.4);
      x = X_KO + tremor;
      baseR = 20.0;
      y = -baseR;
      coreBreath = 1.0;
    } else if (t < T_KO_SHATTER_END) {
      // 5C: Shattered into flying crystal-clear ice chunks & snowflakes! (Frame 293 @ 9.77s)
      visible = 0.0;
      x = X_KO;
      y = -20.0;
    } else {
      // 5D: Snowflakes & frost swirl back together into the Idle snowball beast (Frame 314 @ 10.47s)
      const u = (t - T_KO_SHATTER_END) / (D - T_KO_SHATTER_END);
      const eu = ease.outBack(u);
      visible = smooth(0.0, 0.25, u);
      x = lerp(X_KO, X_IDLE, smooth(0.0, 0.7, u));
      baseR = 18.0;
      y = -18.0;
      sx = lerp(0.45, 1.0, eu);
      sy = lerp(0.45, 1.0, eu);
      coreBreath = 0.65;
    }
  }

  return {
    x,
    y,
    baseR,
    sx,
    sy,
    tilt,
    rollRot,
    handExtend,
    handWaveL,
    handWaveR,
    handReachFront,
    coreBreath,
    mouthOpen,
    faceplant,
    dizzy,
    accruedSnow,
    spinBlur,
    vitrified,
    crackReach,
    visible,
  };
}

// Helper to draw a translucent faceted Ice-Crystal Stubby Hand ("两侧长着两只半透明的冰晶小短手")
function drawIceCrystalHand(p, hx, hy, angle, scale, Ice, alpha) {
  if (alpha <= 0.02 || scale <= 0.1) return;
  const ca = Math.cos(angle) * scale;
  const sa = Math.sin(angle) * scale;
  const rot = (lx, ly) => [hx + lx * ca - ly * sa, hy + lx * sa + ly * ca];

  // Hexagonal-mitt crystal prism silhouette
  const outerPts = [
    rot(-4.5, -2.2),
    rot(0.5, -4.6),
    rot(5.8, -2.4),
    rot(6.4, 1.2),
    rot(2.0, 4.4),
    rot(-4.2, 2.6),
  ];
  const upperFacet = [rot(-4.5, -2.2), rot(0.5, -4.6), rot(5.8, -2.4), rot(1.2, 0.2)];

  // Translucent crystal fill (`glassPoly` from `../ice/_lib.js`)
  glassPoly(p, outerPts, Ice[4], 0.52 * alpha);
  glassPoly(p, upperFacet, Ice[6], 0.58 * alpha);

  // Crisp facet edges & specular diamond glints
  for (let i = 0; i < outerPts.length; i++) {
    const [x0, y0] = outerPts[i];
    const [x1, y1] = outerPts[(i + 1) % outerPts.length];
    p.line(x0, y0, x1, y1, i < 3 ? WHITE : Ice[3], (i < 3 ? 0.92 : 0.78) * alpha);
  }
  const [rx0, ry0] = rot(-3.5, -0.5);
  const [rx1, ry1] = rot(4.8, -0.6);
  p.line(rx0, ry0, rx1, ry1, WHITE, 0.85 * alpha);
  p.glow(hx, hy, 7 * scale, Ice[4], 0.28 * alpha);
}

// Draw the Frost Snowball Beast (or its Vitrified Transparent Ice-Sphere form in State 5A/5B!)
function drawFrostSnowballBeast(p, S, Snow, Ice, Frost, t) {
  if (S.visible <= 0.01) return;

  const cx = S.x;
  const cy = S.y;
  const R = S.baseR;

  // ===========================================================================
  // CASE A: VITRIFIED TRANSPARENT ICE SPHERE (State 5A & 5B — Frames 251 & 272)
  // "它被冻得浑身僵硬变成一颗完全透明的冰球、随后咔嚓一声裂开"
  // ===========================================================================
  if (S.vitrified > 0.5) {
    const vAlpha = S.visible;

    // 1. Frozen translucent ice-crystal hands locked stiffly on the sides of the ice sphere
    drawIceCrystalHand(p, cx - R - 3.5, cy + 1, -0.35, 1.05, Ice, vAlpha * 0.9);
    drawIceCrystalHand(p, cx + R + 3.5, cy + 1, 0.35, 1.05, Ice, vAlpha * 0.9);

    // 2. Pixel-by-pixel Refractive Transparent Glass/Ice Sphere shading:
    //    Dark sapphire refractive rim, translucent cyan-glass interior (`p.blend`),
    //    frozen blue core + stiffened eyes trapped inside, diagonal internal refraction planes,
    //    and curved specular window highlight on the upper-left!
    const pad = Math.ceil(R + 3);
    for (let dy = -pad; dy <= pad; dy++) {
      for (let dx = -pad; dx <= pad; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > R + 0.8) continue;
        const wx = Math.round(cx + dx);
        const wy = Math.round(cy + dy);
        const u = d / R; // 0 at center .. 1 at rim

        // Outer dark-sapphire & diamond-white refractive rim
        if (u > 0.88) {
          const isLitRim = dx * -0.65 + dy * -0.75 > 0.15;
          p.blend(wx, wy, isLitRim ? WHITE : Ice[1], 0.92 * vAlpha);
          continue;
        }
        if (u > 0.78) {
          const isBottomCaustic = dx * 0.55 + dy * 0.82 > 0.45;
          p.blend(wx, wy, isBottomCaustic ? Ice[6] : Ice[3], 0.72 * vAlpha);
          continue;
        }

        // Translucent crystal-clear interior (allows background & internal veins to show through!)
        const diagPlane = Math.abs(dx * 0.72 + dy * 0.68 + 4) < 2.2 || Math.abs(dx * 0.72 - dy * 0.68 - 5) < 1.6;
        p.blend(wx, wy, diagPlane ? Ice[5] : Ice[2], (diagPlane ? 0.48 : 0.28) * vAlpha);

        // Curved upper-left specular window highlight
        const specDist = Math.hypot(dx + R * 0.42, dy + R * 0.42);
        if (specDist < R * 0.28) {
          p.blend(wx, wy, specDist < R * 0.15 ? WHITE : Ice[6], 0.88 * vAlpha);
        }
      }
    }

    // 3. Frozen core & stiffened `><` frozen expression visible trapped INSIDE the transparent ice sphere!
    p.disc(cx, cy + 1, 6.5, Ice[4], (d) => (1 - d * d) * 0.65 * vAlpha);
    p.disc(cx, cy + 1, 3.2, WHITE, (d) => (1 - d) * 0.85 * vAlpha);
    // Frozen stiff `><` eyes trapped inside the ice ball
    p.line(cx - 7, cy - 4, cx - 4, cy - 2, Ice[0], 0.9 * vAlpha);
    p.line(cx - 4, cy - 2, cx - 7, cy, Ice[0], 0.9 * vAlpha);
    p.line(cx + 7, cy - 4, cx + 4, cy - 2, Ice[0], 0.9 * vAlpha);
    p.line(cx + 4, cy - 2, cx + 7, cy, Ice[0], 0.9 * vAlpha);
    // Shivering wavy frozen mouth
    p.line(cx - 3, cy + 3, cx, cy + 2, Ice[1], 0.85 * vAlpha);
    p.line(cx, cy + 2, cx + 3, cy + 3, Ice[1], 0.85 * vAlpha);

    // 4. Small frost rime spikes around the base of the frozen ice sphere
    blade(p, cx - 15, 0, cx - 22, -10, 4.5, Ice, { a: 0.85 * vAlpha });
    blade(p, cx + 15, 0, cx + 22, -10, 4.5, Ice, { a: 0.85 * vAlpha });

    // 5. Engraved branching fractures racing across the transparent ice sphere in State 5B (Frame 272 @ 9.07s)!
    if (S.crackReach > 0.2) {
      drawFractures(p, SPHERE_CRACKS_1, S.crackReach, Ice, { ox: cx, oy: cy, a: vAlpha });
      if (S.crackReach > 6.0) {
        drawFractures(p, SPHERE_CRACKS_2, S.crackReach - 4.0, Ice, { ox: cx, oy: cy, a: vAlpha });
      }
      sparkle(p, cx - 3, cy - 2, 6.5, WHITE, Ice[5], 0.9 * vAlpha);
      p.glow(cx, cy, 34, Ice[5], 0.55 * vAlpha);
    } else {
      p.glow(cx, cy, 24, Ice[4], 0.35 * vAlpha);
    }
    return;
  }

  // ===========================================================================
  // CASE B: FLUFFY WHITE SNOWBALL BEAST WITH SNOWFLAKE CRUST, ICE-BLUE
  //         BREATHING CORE, AND TRANSLUCENT ICE-CRYSTAL STUBBY HANDS
  // ===========================================================================
  const cosT = Math.cos(S.tilt);
  const sinT = Math.sin(S.tilt);

  // 1. Back/Left Translucent Ice-Crystal Stubby Hand (drawn before or alongside body)
  if (S.handExtend > 0.05) {
    const reachX = S.handReachFront * 12.0;
    const reachY = S.handReachFront * 7.5;
    const lx = (-R * S.sx - 3.5) * S.handExtend + reachX;
    const ly = 1.5 + S.handWaveL + reachY;
    const wxL = cx + lx * cosT - ly * sinT;
    const wyL = Math.min(-2, cy + lx * sinT + ly * cosT);
    drawIceCrystalHand(p, wxL, wyL, S.tilt - 0.35 + S.handReachFront * 0.6, S.handExtend, Ice, S.visible);
  }

  // 2. Round Fluffy White Snowball Body shaded on `GRID` with bumpy snow-lumps + glowing Ice-Blue Breathing Core!
  GRID.clear();
  const gHalf = 44;
  const rx = R * S.sx;
  const ry = R * S.sy;

  for (let gy = -gHalf; gy <= gHalf; gy++) {
    for (let gx = -gHalf; gx <= gHalf; gx++) {
      // Un-rotate into snowball local space
      const lx = gx * cosT + gy * sinT;
      const ly = -gx * sinT + gy * cosT;

      const nx = lx / rx;
      const ny = ly / ry;
      const ang = Math.atan2(ny, nx) - S.rollRot;

      // Fluffy packed-snow perimeter bumps (grow chunkier as `accruedSnow` increases in State 3!)
      const lumpAmp = 0.045 + S.accruedSnow * 0.055;
      const lump =
        Math.sin(ang * 7) * lumpAmp +
        Math.cos(ang * 11 + 1.3) * (lumpAmp * 0.65);
      const distNorm = Math.hypot(nx, ny) / (1 + lump);
      if (distNorm > 1.0) continue;

      // Dark-blue arctic outline rim
      if (distNorm > 0.91) {
        const topRim = nx * -0.45 + ny * -0.88 > 0.25;
        GRID.set(gx, gy, topRim ? Snow[6] : Snow[1]);
        continue;
      }

      // Spherical snow shading (lit from top-left `(-0.48, -0.78)`)
      const z = Math.sqrt(Math.max(0, 1 - distNorm * distNorm));
      const lambert = clamp(nx * -0.45 + ny * -0.68 + z * 0.62, 0, 1);

      // Internal snow grain & snowflake-embossed texture rotating with `S.rollRot`
      const ca = Math.cos(S.rollRot);
      const sa = Math.sin(S.rollRot);
      const rxTex = lx * ca - ly * sa;
      const ryTex = lx * sa + ly * ca;
      const grain = Math.sin(rxTex * 0.65) * Math.cos(ryTex * 0.65);

      let snowIdx = clamp(Math.round(2 + lambert * 5.2 + grain * 0.55), 2, 7);
      let col = Snow[snowIdx];

      // =======================================================================
      // CENTER ICE-BLUE BREATHING CORE GLOW ("中心透出冰蓝色的呼吸光芒")
      // =======================================================================
      const coreDist = Math.hypot(lx, ly - 1.0) / (R * (0.48 + 0.14 * S.coreBreath));
      if (coreDist < 1.0) {
        const coreStrength = Math.pow(1 - coreDist, 1.35) * (0.65 + 0.35 * S.coreBreath);
        const coreCol =
          coreDist < 0.32
            ? WHITE
            : coreDist < 0.62
            ? Ice[6]
            : coreDist < 0.85
            ? Ice[4]
            : Ice[3];
        col = mix(col, coreCol, clamp(coreStrength * 0.92, 0, 1));
      }

      // Sub-surface ice-blue energy veins radiating from the breathing core
      const veinWave = Math.abs(Math.sin(ang * 6 + distNorm * 4.5));
      if (distNorm > 0.30 && distNorm < 0.78 && veinWave < 0.14) {
        col = mix(col, Ice[4], (1 - distNorm) * 0.55 * S.coreBreath);
      }

      // Horizontal spin-blur streaks during State 4A High-Speed Spin (`spinBlur > 0`)
      if (S.spinBlur > 0.15 && Math.abs( Math.sin(ly * 0.85 + t * 40) ) > 0.72) {
        col = mix(col, Ice[6], S.spinBlur * 0.75);
      }

      GRID.set(gx, gy, col);
    }
  }

  // Flush `GRID` onto the painter at `(cx, cy)`
  GRID.draw(p, S.visible, cx, cy);

  // 3. Sparkling Snowflakes & Ice Crystals embossed on the Snowball Surface
  //    ("一颗覆盖着晶莹雪花的圆滚滚白色雪球生物" + "越滚身体表面粘附的冰晶雪花越多")
  const surfaceFlakeRamp = Ice.slice(0, 5); // cobalt/azure inlay contrasts with the packed-white snow
  const baseFlakeOffsets = [
    [-0.55, -0.52, 4.1],
    [0.52, -0.52, 4.0],
    [-0.70, -0.08, 3.8],
    [0.70, -0.10, 3.9],
    [-0.44, 0.48, 3.7],
    [0.44, 0.48, 3.8],
    [0.0, -0.74, 3.8],
  ];
  for (let i = 0; i < baseFlakeOffsets.length; i++) {
    const [ox, oy, fr] = baseFlakeOffsets[i];
    const ca = Math.cos(S.rollRot + S.tilt);
    const sa = Math.sin(S.rollRot + S.tilt);
    const fx = cx + (ox * ca - oy * sa) * rx;
    const fy = cy + (ox * sa + oy * ca) * ry;
    if (fy < -2) {
      snowflake(p, fx, fy, fr, S.rollRot + i * 0.6, FLAKE_DESIGNS[i], surfaceFlakeRamp, {
        a: 0.96 * S.visible,
        hot: 0.18 + 0.72 * (0.5 + 0.5 * Math.sin(t * 7 + i * 1.7)),
      });
    }
  }

  // Extra accrued Ice Crystals & Snowflakes sticking to the perimeter during State 3 Move!
  // ("越滚身体表面粘附的冰晶雪花越多" — Frames 147 & 167!)
  if (S.accruedSnow > 0.05) {
    const totalAccrued = Math.round(S.accruedSnow * 14);
    for (let k = 0; k < totalAccrued; k++) {
      const ang = (k / 14) * TAU + S.rollRot;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const px = cx + ca * (rx * 0.94);
      const py = cy + sa * (ry * 0.94);
      if (py > -1.5) continue;

      if (k % 2 === 0) {
        // Protruding faceted ice-crystal shard sticking to the rolling snowball!
        blade(
          p,
          px - ca * 2.0,
          py - sa * 2.0,
          px + ca * (5.5 + 2.5 * S.accruedSnow),
          py + sa * (5.5 + 2.5 * S.accruedSnow),
          3.8,
          Ice,
          { a: 0.95 * S.visible, glint: 0.5 }
        );
      } else {
        // Sparkling 6-pointed snowflake stuck to the outer snow crust!
        snowflake(
          p,
          px + ca * 1.5,
          py + sa * 1.5,
          3.6 + 1.2 * S.accruedSnow,
          ang,
          FLAKE_DESIGNS[(k + 5) % FLAKE_DESIGNS.length],
          Ice,
          { a: 0.96 * S.visible, hot: 0.85 }
        );
      }
    }
  }

  // 4. Expressive Arctic Creature Face (Eyes, Rosy-Icy Cheeks, and Roaring Blizzard Mouth!)
  if (S.spinBlur < 0.65 && S.accruedSnow < 0.35) {
    // Face rotates slightly forward on `x` during action states
    const faceX = cx + (S.handReachFront > 0.1 || S.mouthOpen > 0.05 ? 4.5 : 2.5) * cosT;
    const faceY = cy + (S.faceplant > 0.5 ? 4.5 : -2.5) * cosT;

    if (S.faceplant > 0.5 || S.dizzy > 0.4) {
      // Comedic `><` dizzy faceplant expression in State 2C (Frame 105 @ 3.50s)!
      p.line(faceX - 7, faceY - 2, faceX - 4, faceY, Snow[0], 0.95);
      p.line(faceX - 4, faceY, faceX - 7, faceY + 2, Snow[0], 0.95);
      p.line(faceX + 5, faceY - 2, faceX + 2, faceY, Snow[0], 0.95);
      p.line(faceX + 2, faceY, faceX + 5, faceY + 2, Snow[0], 0.95);
    } else {
      // Cute dark-sapphire eyes with bright starlight catchlights
      const eyeLX = Math.round(faceX - 5.5);
      const eyeRX = Math.round(faceX + 4.5);
      const eyeY = Math.round(faceY - 1.5);
      for (const ex of [eyeLX, eyeRX]) {
        p.disc(ex, eyeY, 2.2, Snow[0], 1.0);
        p.dot(ex - 0.6, eyeY - 0.8, WHITE, 1.0);
        p.dot(ex + 0.8, eyeY + 0.8, Ice[5], 0.85);
      }
      // Cute icy-blue blush cheeks
      p.disc(eyeLX - 2.5, eyeY + 2.8, 2.0, Ice[4], 0.55);
      p.disc(eyeRX + 2.5, eyeY + 2.8, 2.0, Ice[4], 0.55);

      if (S.mouthOpen > 0.1) {
        // Wide-open roaring blizzard mouth in State 4B (Frame 209 @ 6.97s)!
        const mw = 4.5 * S.mouthOpen;
        const mh = 5.2 * S.mouthOpen;
        p.ellipse(faceX + 2.5, eyeY + 4.5, mw + 1, mh + 1, Ice[1]);
        p.ellipse(faceX + 2.8, eyeY + 4.5, mw, mh, Ice[5]);
        p.ellipse(faceX + 3.2, eyeY + 4.5, mw * 0.6, mh * 0.6, WHITE);
        p.glow(faceX + 4, eyeY + 4.5, 16, Ice[5], 0.75 * S.mouthOpen);
      } else {
        // Playful happy smile (`w` arctic creature mouth)
        p.line(faceX - 2.5, eyeY + 3.2, faceX - 0.5, eyeY + 4.2, Snow[1], 0.9);
        p.line(faceX - 0.5, eyeY + 4.2, faceX + 1.5, eyeY + 3.2, Snow[1], 0.9);
      }
    }
  }

  // 5. Front/Right Translucent Ice-Crystal Stubby Hand
  if (S.handExtend > 0.05) {
    const reachX = S.handReachFront * 7.5;
    const reachY = S.handReachFront * 6.5;
    const rxOff = (R * S.sx + 3.5) * S.handExtend + reachX;
    const ryOff = 1.5 + S.handWaveR + reachY;
    const wxR = cx + rxOff * cosT - ryOff * sinT;
    const wyR = Math.min(-2, cy + rxOff * sinT + ryOff * cosT);
    drawIceCrystalHand(p, wxR, wyR, S.tilt + 0.35 + S.handReachFront * 0.4, S.handExtend, Ice, S.visible);
  }

  // 6. Ice-Blue Breathing Core Aura Halo ("中心透出冰蓝色的呼吸光芒")
  p.glow(cx, cy, (22 + 10 * S.coreBreath) * S.sx, Ice[4], (0.32 + 0.22 * S.coreBreath) * S.visible);
  p.glow(cx, cy + 1, 10 * S.sx, Ice[6], (0.28 + 0.25 * S.coreBreath) * S.visible);
}

// ============================================================================
// STATE 2 ECO QUIRK: MINI SNOWBALL PACKING, CIRCUS BALL-BALANCE & FACEPLANT SNOW RING
// ("贪玩地用冰晶小手在地上搓出一个小雪球、笨拙地跳到小雪球上面试图表演杂技踩球平衡、结果脚下一滑直接脸朝下摔在地上激起一圈白雪")
// ============================================================================
function drawEcoMiniSnowballAndSnowSplash(p, t, S, Snow, Ice, seed) {
  if (t < T_IDLE_END || t > T_ECO_END + 0.15) return;

  // 2A & 2B: The Mini Snowball on the ground (1.85..3.55s — Frames 63 & 84!)
  if (t < T_ECO_BAL_END + 0.38) {
    let miniR = 8.5;
    let miniX = X_BALL;
    let miniY = -8.5;
    let miniRot = 0.0;
    let miniAlpha = 1.0;

    if (t < T_ECO_PACK_END) {
      // 2A (Frame 63 @ 2.10s): Growing as the ice hands pack and roll it on the ground!
      const u = (t - T_IDLE_END) / (T_ECO_PACK_END - T_IDLE_END);
      miniR = lerp(3.5, 8.8, ease.outQuad(u));
      miniX = X_BALL - 3 + Math.sin(u * TAU * 4.5) * 2.0;
      miniY = -miniR;
      miniRot = u * TAU * 2.0;

      // Flying snow-packing puffs as the translucent ice hands shape the mini snowball!
      for (let i = 0; i < 8; i++) {
        const ph = (t * 4.5 + i / 8) % 1;
        const ang = -Math.PI * 0.15 - (i / 7) * Math.PI * 0.7;
        const px = miniX + Math.cos(ang) * (miniR + ph * 11);
        const py = miniY + Math.sin(ang) * (miniR + ph * 9);
        p.disc(px, py, 2.2 * (1 - ph), Snow[6], (1 - ph) * 0.85);
      }
    } else if (t < T_ECO_BAL_END) {
      // 2B (Frame 84 @ 2.80s): Rolling back and forth under the balancing Frost Snowball!
      const balU = clamp((t - T_ECO_PACK_END - 0.15) / (T_ECO_BAL_END - T_ECO_PACK_END - 0.15), 0, 1);
      miniR = 8.8;
      miniX = X_BALL + Math.sin(balU * TAU * 2.2) * 3.2;
      miniY = -miniR;
      miniRot = Math.sin(balU * TAU * 2.2) * 1.4;
    } else {
      // 2C start: Mini snowball shoots out to the left as the creature's foot slips!
      const slipU = (t - T_ECO_BAL_END) / 0.38;
      miniR = 8.5;
      miniX = lerp(X_BALL, X_BALL - 34, ease.outQuad(slipU));
      miniY = -miniR - Math.sin(slipU * Math.PI) * 6.0;
      miniRot = -slipU * TAU * 2.0;
      miniAlpha = 1 - smooth(0.55, 1.0, slipU);
    }

    // Draw the Mini Snowball with crisp spherical shading + snowflake speck
    shadow(p, miniX, 0, miniR * 1.15, 2.5, 0.35 * miniAlpha);
    p.disc(miniX, miniY, miniR + 0.8, Snow[1], miniAlpha);
    p.disc(miniX, miniY, miniR, Snow[5], miniAlpha);
    p.disc(miniX - miniR * 0.18, miniY - miniR * 0.22, miniR * 0.75, Snow[6], miniAlpha);
    p.disc(miniX - miniR * 0.32, miniY - miniR * 0.35, miniR * 0.42, WHITE, miniAlpha);
    snowflake(p, miniX + Math.cos(miniRot) * 2.5, miniY + Math.sin(miniRot) * 2.5, 2.5, miniRot, FLAKE_DESIGNS[2], Ice, {
      a: 0.85 * miniAlpha,
      hot: 0.7,
    });
  }

  // 2B Wobble & Balance Lines around the teetering creature (Frame 84 @ 2.80s)
  if (t >= T_ECO_PACK_END + 0.15 && t < T_ECO_BAL_END) {
    const balU = (t - (T_ECO_PACK_END + 0.15)) / (T_ECO_BAL_END - (T_ECO_PACK_END + 0.15));
    // Comedic balance motion arcs & flying ice-sweat drops overhead!
    for (const side of [-1, 1]) {
      const ax = S.x + side * 26;
      const ay = S.y - 8 + Math.sin(t * 22 + side) * 3;
      p.line(ax, ay - 5, ax + side * 3, ay, Ice[5], 0.85);
      p.line(ax + side * 3, ay, ax, ay + 5, Ice[5], 0.85);
    }
    for (let i = 0; i < 4; i++) {
      const ph = (balU * 3 + i * 0.25) % 1;
      const side = i % 2 === 0 ? -1 : 1;
      const sx = S.x + side * (16 + ph * 14);
      const sy = S.y - 14 - Math.sin(ph * Math.PI) * 8 + ph * 10;
      p.disc(sx, sy, 1.6 * (1 - ph * 0.4), Ice[6], (1 - ph) * 0.9);
    }
  }

  // 2C Faceplant Ground Impact: 360° Ring of White Snow Puffs & Splash Crown!
  // ("结果脚下一滑直接脸朝下摔在地上激起一圈白雪" — Frame 105 @ 3.50s!)
  const tImpact = T_ECO_BAL_END + 0.12; // 3.34s (so at Frame 105 @ 3.50s, age = 0.16s — right at peak bloom!)
  if (t >= tImpact && t <= T_ECO_END) {
    const age = t - tImpact;
    const dur = 0.62;
    if (age <= dur) {
      const u = age / dur;
      const alpha = (1 - smooth(0.55, 1.0, u)) * Math.min(1, u * 10);

      // Concentric perspective snow-wave ring on the ground around (X_FALL, 0)
      const ringRx = lerp(14, 48, ease.outCubic(u));
      const ringRy = ringRx * 0.26;
      for (let k = 0; k < 40; k++) {
        const a0 = (k / 40) * TAU;
        const a1 = ((k + 1) / 40) * TAU;
        p.line(
          X_FALL + Math.cos(a0) * ringRx,
          -1 + Math.sin(a0) * ringRy,
          X_FALL + Math.cos(a1) * ringRx,
          -1 + Math.sin(a1) * ringRy,
          k % 2 === 0 ? WHITE : Snow[5],
          alpha * 0.92
        );
      }

      // 16 Billowing White Snow Puffs & Snow-Crown Chunks erupting in a full circle around the faceplant!
      for (let i = 0; i < 16; i++) {
        const r = rng(seed, i, 209);
        const a = (i / 16) * TAU + r.range(-0.1, 0.1);
        const dist = lerp(12, r.range(34, 52), ease.outCubic(u));
        const px = X_FALL + Math.cos(a) * dist;
        const py = -2 + Math.sin(a) * dist * 0.25 - Math.sin(u * Math.PI) * r.range(8, 22);
        const rad = r.range(3.5, 6.2) * (1 - u * 0.45);

        p.disc(px, py, rad + 0.8, Snow[3], alpha * 0.75);
        p.disc(px, py, rad, Snow[6], alpha * 0.92);
        p.disc(px - rad * 0.25, py - rad * 0.28, rad * 0.58, WHITE, alpha * 0.95);
        if (i % 3 === 0) {
          snowflake(p, px, py - 4, 2.8, a + age * 4, FLAKE_DESIGNS[i % FLAKE_DESIGNS.length], Ice, {
            a: alpha * 0.88,
            hot: 0.8,
          });
        }
      }
    }
  }
}

// ============================================================================
// STATE 3 MOVE: GLEAMING FROST SLIDE-TRAIL & FLYING SNOW-ROLL FLAKES
// ("直接在地上滚雪球般向前欢快翻滚、越滚身体表面粘附的冰晶雪花越多并在身后留下一条冰霜滑道")
// ============================================================================
function drawFrostSlideTrail(p, t, S, Snow, Ice, Frost, seed) {
  if (t < T_MOVE_TUCK_END || t > T_ATK_SPIN_END + 0.25) return;

  const rollU = clamp((t - T_MOVE_TUCK_END) / (T_MOVE_END - T_MOVE_TUCK_END), 0, 1);
  const fadeOut = 1 - smooth(T_MOVE_END - 0.1, T_ATK_SPIN_END + 0.2, t);
  if (fadeOut <= 0.01) return;

  const trailStartX = X_ROLL_START - 6;
  const trailEndX = Math.max(trailStartX + 4, S.x + 2);

  // 1. Gleaming Perspective Ice-Frost Slide Track on the ground (`y = -5 .. +3`)
  for (let wx = Math.floor(trailStartX); wx <= Math.ceil(trailEndX); wx++) {
    const uX = (wx - trailStartX) / Math.max(1, trailEndX - trailStartX);
    const localHalfH = 3.2 + 2.2 * uX; // widens slightly as the snowball grows larger!
    const segAlpha = (0.45 + 0.55 * uX) * fadeOut;

    for (let dy = -Math.ceil(localHalfH); dy <= Math.ceil(localHalfH); dy++) {
      const wy = -1 + dy;
      const v = dy / localHalfH; // -1 (top curb) .. +1 (bottom curb)
      if (Math.abs(v) > 1.0) continue;

      // Raised snowy curbs on top & bottom edges of the frost slide-trail
      if (Math.abs(v) > 0.72) {
        p.blend(wx, wy, v < 0 ? WHITE : Snow[5], segAlpha * 0.92);
      } else {
        // Mirror-like frozen ice slide track with diagonal specular streaks!
        const streak = Math.sin(wx * 0.28 + dy * 0.9 - t * 6) > 0.45;
        const col = streak ? WHITE : Math.abs(v) < 0.28 ? Ice[6] : Frost[3];
        p.blend(wx, wy, col, segAlpha * 0.85);
      }
    }

    // Crystalline frost spikes & sparkles sprouting along the edges of the frost slide-trail
    if ((wx - Math.floor(trailStartX)) % 9 === 0) {
      const hSpike = (4.5 + 3.0 * uX) * fadeOut;
      blade(p, wx, -3, wx - 3, -3 - hSpike, 3.2, Ice, { a: 0.82 * segAlpha });
      p.glow(wx, -1, 8, Ice[4], 0.24 * segAlpha);
    }
  }

  // 2. Joyful Spray of Snowflakes & Frost Granules kicked up behind the rolling snowball (Frames 147 & 167!)
  if (t < T_MOVE_END) {
    for (let i = 0; i < 24; i++) {
      const r = rng(seed, i, 311);
      const spawnU = (i / 24) * 0.88;
      const spawnT = lerp(T_MOVE_TUCK_END, T_MOVE_END, spawnU);
      const age = t - spawnT;
      const life = r.range(0.45, 0.85);
      if (age <= 0 || age >= life) continue;

      const k = age / life;
      const originX = lerp(X_ROLL_START, X_ROLL_END, smooth(0, 0.86, spawnU));
      const px = originX - age * r.range(18, 42);
      const py = -4 - Math.sin(k * Math.PI) * r.range(10, 28);
      const alpha = (1 - k) * fadeOut;

      if (i % 2 === 0) {
        snowflake(p, px, py, r.range(2.6, 4.2), age * 8 + i, FLAKE_DESIGNS[i % FLAKE_DESIGNS.length], Ice, {
          a: alpha * 0.92,
          hot: 0.75,
        });
      } else {
        p.disc(px, py, 2.0 * (1 - k * 0.4), WHITE, alpha * 0.9);
      }
    }
  }
}

// ============================================================================
// STATE 4 ATTACK & HIT RESULT:
// 4A (5.95..6.62s, Frame 188 @ 6.27s): High-speed spin inhaling surrounding frost vortex
// 4B (6.62..7.42s, Frame 209 @ 6.97s): Brake & blast raging blizzard vortex with sharp icicles
// 4C (7.15..8.20s, Frame 230 @ 7.67s): Icicles & blizzard freeze and shatter the distant target!
// ============================================================================
function drawBlizzardAttackAndFreezeShatterHit(p, t, S, Snow, Ice, Frost, seed) {
  if (t < T_MOVE_END || t > T_ATK_END + 0.15) return;

  // ---------------------------------------------------------------------------
  // 4A: FROST VORTEX INHALE ("它原地高速旋转将周围的寒气吸入体内" — Frame 188 @ 6.27s!)
  // ---------------------------------------------------------------------------
  if (t >= T_MOVE_END && t < T_ATK_SPIN_END + 0.08) {
    const u = clamp((t - T_MOVE_END) / (T_ATK_SPIN_END - T_MOVE_END), 0, 1);
    const vAlpha = Math.sin(u * Math.PI);
    const cx = S.x;
    const cy = S.y;

    // 8 Logarithmic Spiral Wind Bands sucking cold air inward from r = 64px into (cx, cy)!
    const numArms = 8;
    for (let arm = 0; arm < numArms; arm++) {
      const baseAng = (arm / numArms) * TAU - t * 11.5;
      const steps = 24;
      for (let s = 0; s < steps; s++) {
        const f0 = s / steps;
        const f1 = (s + 1) / steps;
        const r0 = lerp(6.0, 62.0, f0);
        const r1 = lerp(6.0, 62.0, f1);
        const a0 = baseAng + f0 * 2.4;
        const a1 = baseAng + f1 * 2.4;

        const x0 = cx + Math.cos(a0) * r0;
        const y0 = Math.min(-1, cy + Math.sin(a0) * r0 * 0.72);
        const x1 = cx + Math.cos(a1) * r1;
        const y1 = Math.min(-1, cy + Math.sin(a1) * r1 * 0.72);
        const col = f0 < 0.35 ? WHITE : f0 < 0.7 ? Ice[5] : Frost[3];
        p.line(x0, y0, x1, y1, col, (1 - f0 * 0.65) * 0.88 * vAlpha);
      }
    }

    // 28 Snowflakes & Frost Orbs spiraling inward into the spinning Snowball Beast!
    for (let i = 0; i < 28; i++) {
      const r = rng(seed, i, 401);
      const ph = ((t * 2.4 + i / 28) % 1);
      const invPh = 1 - ph; // 1 at outer edge -> 0 at center!
      const ang = r.range(0, TAU) - t * 12.0 + invPh * 2.2;
      const rad = lerp(4.0, r.range(42, 68), invPh);
      const px = cx + Math.cos(ang) * rad;
      const py = Math.min(-2, cy + Math.sin(ang) * rad * 0.72);

      if (i % 2 === 0) {
        snowflake(p, px, py, 2.8 + invPh * 2.0, ang, FLAKE_DESIGNS[i % FLAKE_DESIGNS.length], Ice, {
          a: vAlpha * 0.92,
          hot: 1 - invPh,
        });
      } else {
        p.disc(px, py, 1.8, WHITE, vAlpha * 0.9);
        p.glow(px, py, 5, Ice[5], 0.35 * vAlpha);
      }
    }

    // Ground tornado snow-ring boiling at the foot of the spinning snowball beast
    p.ring(cx, -1, 22, 2.0, Ice[6], 0.75 * vAlpha);
    p.glow(cx, cy, 42, Ice[4], 0.48 * vAlpha);
  }

  // ---------------------------------------------------------------------------
  // 4B: RAGING BLIZZARD VORTEX & SHARP ICICLE BARRAGE
  // ("随后猛然刹住车并张开嘴向前喷射出一阵夹杂着锋利冰锥的暴风雪" + "暴风雪的寒气涡流" — Frame 209 @ 6.97s!)
  // ---------------------------------------------------------------------------
  if (t >= T_ATK_SPIN_END && t < T_ATK_BLAST_END + 0.12) {
    const u = clamp((t - T_ATK_SPIN_END) / (T_ATK_BLAST_END - T_ATK_SPIN_END), 0, 1);
    const bAlpha = Math.min(1, u * 8) * (1 - smooth(0.84, 1.0, u));
    const mouthX = S.x + 14;
    const mouthY = S.y + 1;
    const reachX = lerp(mouthX + 18, X_HIT + 12, Math.min(1, u * 2.2));

    // Ice brake-wedge under its front foot ("猛然刹住车")
    blade(p, S.x + 14, 0, S.x + 25, -11, 5.5, Ice, { a: bAlpha * 0.92 });
    blade(p, S.x + 10, 0, S.x + 18, -8, 4.2, Snow, { a: bAlpha * 0.85 });

    // 1. Swirling Blizzard Cold-Air Vortex Cone ("暴风雪的寒气涡流")
    //    Elliptical vortex coils + turbulent frost-breath puffs streaming from `mouthX` to `reachX`!
    const beamLen = Math.max(10, reachX - mouthX);
    for (let s = 0; s < 38; s++) {
      const f = s / 38;
      const bx = mouthX + f * beamLen;
      const coneR = lerp(5.0, 26.0, Math.pow(f, 0.78));
      const cyCone = mouthY - f * 4.0 + Math.sin(f * 8 - t * 22) * 2.5;

      // Soft frost-puff body along the blizzard cone
      if (s % 3 === 0) {
        p.disc(bx, cyCone, coneR * 0.78, Frost[3], (d) => (1 - d * d) * 0.34 * bAlpha);
        p.disc(bx, cyCone - coneR * 0.18, coneR * 0.48, Ice[6], (d) => (1 - d * d) * 0.42 * bAlpha);
      }

      // Helical Cold-Air Vortex Rings ("寒气涡流") wrapping around the blizzard stream!
      const vAng = f * TAU * 4.2 - t * 28.0;
      const vx0 = bx + Math.cos(vAng) * (coneR * 0.32);
      const vy0 = Math.min(-1, cyCone + Math.sin(vAng) * coneR);
      const vx1 = bx + Math.cos(vAng + 0.55) * (coneR * 0.32);
      const vy1 = Math.min(-1, cyCone + Math.sin(vAng + 0.55) * coneR);
      const isFront = Math.sin(vAng) >= 0;
      p.line(vx0, vy0, vx1, vy1, isFront ? WHITE : Ice[4], (isFront ? 0.92 : 0.62) * bAlpha);
      p.line(vx0, vy0 - 1, vx1, vy1 - 1, isFront ? Ice[5] : Frost[2], 0.65 * bAlpha);
    }

    // 2. High-Speed Blizzard Snowflakes & Wind Streaks inside the vortex cone
    for (let i = 0; i < 24; i++) {
      const r = rng(seed, i, 419);
      const f = ((t * 3.2 + i / 24) % 1);
      const bx = mouthX + f * beamLen;
      const coneR = lerp(4.0, 24.0, f);
      const by = Math.min(-2, mouthY - f * 4.0 + r.range(-0.85, 0.85) * coneR);

      if (i % 3 === 0) {
        snowflake(p, bx, by, r.range(2.6, 4.2), t * 12 + i, FLAKE_DESIGNS[i % FLAKE_DESIGNS.length], Ice, {
          a: bAlpha * 0.92,
          hot: 0.8,
        });
      } else {
        p.line(bx - 12, by, bx, by, WHITE, bAlpha * 0.85);
        p.line(bx - 16, by - 1, bx - 4, by - 1, Ice[5], bAlpha * 0.65);
      }
    }

    // 3. 9 Razor-Sharp Faceted 3D Icicles / Ice-Lances ("夹杂着锋利冰锥的暴风雪", rendered with `blade()`!)
    const icicleSpecs = [
      { fOff: 0.18, yOff:   0, tilt: -0.03, len: 22, w: 6.2 },
      { fOff: 0.32, yOff: -10, tilt: -0.12, len: 19, w: 5.4 },
      { fOff: 0.36, yOff: +10, tilt: +0.08, len: 19, w: 5.4 },
      { fOff: 0.52, yOff:  -4, tilt: -0.04, len: 24, w: 6.5 },
      { fOff: 0.58, yOff: +14, tilt: +0.12, len: 18, w: 5.0 },
      { fOff: 0.68, yOff: -15, tilt: -0.15, len: 20, w: 5.5 },
      { fOff: 0.78, yOff:  +3, tilt:  0.00, len: 25, w: 6.8 },
      { fOff: 0.88, yOff:  -9, tilt: -0.08, len: 21, w: 5.6 },
      { fOff: 0.94, yOff: +11, tilt: +0.09, len: 20, w: 5.4 },
    ];
    for (let k = 0; k < icicleSpecs.length; k++) {
      const sp = icicleSpecs[k];
      const fPos = ((u * 1.45 + sp.fOff) % 1.0);
      const tipX = mouthX + 14 + fPos * (X_HIT - mouthX);
      if (tipX > reachX + 8) continue;
      const tipY = Math.min(-3, mouthY - 3 + sp.yOff * (0.35 + 0.65 * fPos));
      const baseX = tipX - Math.cos(sp.tilt) * sp.len;
      const baseY = tipY - Math.sin(sp.tilt) * sp.len;

      // Streaming cold wake behind each sharp icicle
      p.line(baseX - 14, baseY, baseX, baseY, Ice[6], bAlpha * 0.82);
      blade(p, baseX, baseY, tipX, tipY, sp.w, Ice, {
        a: bAlpha * 0.98,
        jag: 0.45,
        glint: (t * 4 + k * 0.2) % 1,
      });
    }

    p.glow(mouthX + 4, mouthY, 22, WHITE, 0.65 * bAlpha);
    p.glow(mouthX + beamLen * 0.5, mouthY - 2, 38, Ice[4], 0.42 * bAlpha);
  }

  // ---------------------------------------------------------------------------
  // 4C: TARGET FREEZE & SHATTER HIT RESULT EFFECT
  // ("和冰锥命中目标冻结炸裂的结果特效" — Frame 230 @ 7.67s!)
  // ---------------------------------------------------------------------------
  const tHitStart = 7.05;
  if (t >= tHitStart && t <= T_ATK_END + 0.12) {
    const hAge = t - tHitStart;
    const hDur = 1.15;
    const hu = clamp(hAge / hDur, 0, 1);
    const hAlpha = (1 - smooth(0.68, 1.0, hu)) * Math.min(1, hu * 10);
    const hx = X_HIT;
    const hy = -24;

    // 1. Radial Crown of 10 Giant Jagged Ice-Crystal Spikes (`blade()`) erupting from the frozen target!
    const spikeReach = ease.outBack(Math.min(1, hu * 2.4));
    for (let k = 0; k < 10; k++) {
      const r = rng(seed, k, 443);
      const a = -Math.PI * 1.05 + (k / 9) * Math.PI * 1.10 + r.range(-0.06, 0.06);
      const len = r.range(24, 38) * spikeReach * (1 - smooth(0.75, 1.0, hu) * 0.3);
      const bx = hx + Math.cos(a) * 4;
      const by = Math.min(0, hy + 12 + Math.sin(a) * 4);
      const tx = bx + Math.cos(a) * len;
      const ty = Math.min(0, by + Math.sin(a) * len);

      blade(p, bx, by, tx, ty, r.range(6.0, 8.8), Ice, {
        a: hAlpha * 0.96,
        jag: 0.5,
        glint: 0.65,
        white: hu < 0.14,
      });
    }

    // 2. Central Flash-Frozen Glacier Target Core cracking & exploding outward!
    const coreR = lerp(16, 26, ease.outCubic(hu));
    p.disc(hx, hy, coreR, Ice[5], (d) => (1 - d * d) * 0.72 * hAlpha);
    p.disc(hx, hy, coreR * 0.58, WHITE, (d) => (1 - d) * 0.92 * hAlpha);
    p.ring(hx, hy, lerp(8, 42, ease.outCubic(hu)), 2.2, WHITE, hAlpha * 0.9);
    p.ring(hx, hy, lerp(5, 34, ease.outQuad(hu)), 1.8, Ice[5], hAlpha * 0.85);

    // Ground frost-nova shockwave ring beneath the target
    const gRx = lerp(12, 46, ease.outCubic(hu));
    for (let s = 0; s < 32; s++) {
      const a0 = (s / 32) * TAU;
      const a1 = ((s + 1) / 32) * TAU;
      p.line(
        hx + Math.cos(a0) * gRx,
        -1 + Math.sin(a0) * gRx * 0.24,
        hx + Math.cos(a1) * gRx,
        -1 + Math.sin(a1) * gRx * 0.24,
        s % 2 === 0 ? WHITE : Ice[5],
        hAlpha * 0.88
      );
    }

    // 3. 16 Shattered 3D Ice Shards (`glassPoly`) & Ornate Snowflakes (`snowflake`) blasting outward from the target!
    for (let i = 0; i < 16; i++) {
      const r = rng(seed, i, 461);
      const a = (i / 16) * TAU + r.range(-0.12, 0.12);
      const dist = lerp(6, r.range(28, 48), ease.outCubic(hu));
      const sx = hx + Math.cos(a) * dist;
      const sy = Math.min(-2, hy + Math.sin(a) * dist * 0.85);

      if (i % 2 === 0) {
        snowflake(p, sx, sy, r.range(3.5, 5.8), a + hAge * 6, FLAKE_DESIGNS[i % FLAKE_DESIGNS.length], Ice, {
          a: hAlpha * 0.95,
          hot: 0.9,
        });
      } else {
        const rot = a + hAge * 9;
        const ca = Math.cos(rot);
        const sa = Math.sin(rot);
        const sz = r.range(3.2, 5.2);
        const shardPts = [
          [sx - ca * sz, sy - sa * sz],
          [sx + sa * sz * 0.6, sy - ca * sz * 0.6],
          [sx + ca * sz * 1.3, sy + sa * sz * 1.3],
          [sx - sa * sz * 0.6, sy + ca * sz * 0.6],
        ];
        glassPoly(p, shardPts, Ice[6], 0.68 * hAlpha);
        p.line(shardPts[0][0], shardPts[0][1], shardPts[2][0], shardPts[2][1], WHITE, hAlpha * 0.92);
      }
    }

    sparkle(p, hx, hy, 12 * hAlpha, WHITE, Ice[5], hAlpha);
    p.glow(hx, hy, 48, Ice[4], 0.62 * hAlpha);
    p.glow(hx, hy, 22, WHITE, 0.55 * hAlpha);
  }
}

// ============================================================================
// STATE 5C & 5D: TRANSPARENT ICE-SPHERE SHATTER INTO CRYSTAL CHUNKS & SNOWFLAKES
// ("随后咔嚓一声裂开成无数晶莹剔透的冰块和雪花四散飞溅的完整过程" — Frame 293 @ 9.77s!)
// ============================================================================
function drawIceSphereShatterAndReformation(p, t, Snow, Ice, seed) {
  if (t < T_KO_CRACK_END) return;

  const cx = X_KO;
  const cy = -20;

  if (t < T_KO_SHATTER_END) {
    // 5C: Shatter into 22 crystal-clear 3D polygon ice chunks & 16 ornate snowflakes!
    //     At Frame 293 (`t = 9.77s`), `sAge = 9.77 - 9.32 = 0.45s` (`u = 0.56`) — chunks & snowflakes fill the arena!
    const sAge = t - T_KO_CRACK_END;
    const sDur = T_KO_SHATTER_END - T_KO_CRACK_END; // 0.80s
    const u = clamp(sAge / sDur, 0, 1);
    const alpha = 1 - smooth(0.76, 1.0, u);

    // Initial shatter shockwave ring & flash
    if (u < 0.45) {
      const ru = u / 0.45;
      p.ring(cx, cy, lerp(14, 48, ease.outCubic(ru)), 2.2 * (1 - ru), WHITE, (1 - ru) * 0.92);
      p.glow(cx, cy, 42 * (1 - ru), Ice[5], (1 - ru) * 0.65);
    }

    // 1. 22 Polygon-Cut Translucent Crystal Ice Chunks (`SHATTER_CHUNKS`) tumbling, bouncing on the ground, and glinting!
    for (let i = 0; i < SHATTER_CHUNKS.length; i++) {
      const ch = SHATTER_CHUNKS[i];
      let px = cx + ch.ox + ch.vx * sAge * 0.72;
      let py = cy + ch.oy + ch.vy * sAge + 0.5 * 240 * sAge * sAge;

      // Bounce off the ground (`y = -2`)!
      if (py > -2.5) {
        const over = py - (-2.5);
        py = -2.5 - Math.abs(Math.sin(over * 0.18)) * 12.0 * ch.bounce * (1 - u * 0.5);
      }

      const a = ch.a0 + ch.va * sAge;
      const f = ch.f0 + ch.vf * sAge;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const tumble = 0.45 + 0.55 * Math.abs(Math.cos(f));
      const flash = Math.abs(Math.cos(f)) > 0.92;

      const worldPts = ch.pts.map(([lx, ly]) => {
        const yy = ly * tumble;
        return [px + lx * ca - yy * sa, Math.min(0, py + lx * sa + yy * ca)];
      });

      // Translucent crystal face (`glassPoly`) + crisp diamond-white lit edges!
      glassPoly(p, worldPts, flash ? WHITE : Ice[5], (flash ? 0.82 : 0.58) * alpha);
      for (let k = 0; k < worldPts.length; k++) {
        const [x0, y0] = worldPts[k];
        const [x1, y1] = worldPts[(k + 1) % worldPts.length];
        p.line(x0, y0, x1, y1, k < 2 || flash ? WHITE : Ice[3], 0.92 * alpha);
      }
      p.dot(px, py, WHITE, 0.95 * alpha);
      p.glow(px, py, 6, Ice[5], (flash ? 0.42 : 0.20) * alpha);
    }

    // 2. 16 Ornate 6-Pointed Snowflakes (`snowflake`) splashing outward in all directions!
    for (let i = 0; i < 16; i++) {
      const r = rng(seed, i, 521);
      const ang = (i / 16) * TAU + r.range(-0.1, 0.1);
      const dist = lerp(8, r.range(32, 64), ease.outCubic(u));
      const fx = cx + Math.cos(ang) * dist;
      const fy = Math.min(-3, cy + Math.sin(ang) * dist * 0.78 - Math.sin(u * Math.PI) * 8);

      snowflake(
        p,
        fx,
        fy,
        r.range(3.4, 5.6) * (1 - u * 0.25),
        ang + sAge * 5,
        FLAKE_DESIGNS[i % FLAKE_DESIGNS.length],
        Ice,
        { a: alpha * 0.95, hot: 0.75 + 0.25 * Math.sin(t * 14 + i) }
      );
    }
  } else {
    // 5D (10.12..10.50s, Frame 314 @ 10.47s): Swirling snow-mote reformation into Idle at X_IDLE!
    const u = (t - T_KO_SHATTER_END) / (D - T_KO_SHATTER_END);
    const alpha = 1 - ease.inQuad(u);
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * TAU + u * TAU;
      const rad = lerp(34, 4, ease.inOutQuad(u));
      const fx = lerp(X_KO, X_IDLE, u) + Math.cos(ang) * rad;
      const fy = -18 + Math.sin(ang) * rad * 0.7;
      snowflake(p, fx, fy, 3.2, ang, FLAKE_DESIGNS[i % FLAKE_DESIGNS.length], Ice, {
        a: alpha * 0.88,
        hot: 0.8,
      });
    }
  }
}

export function drawBack(p, t, o) {
  t = wrap(t, D);
  const Snow = fit(o.palette, 8);
  const Ice = fit(o.ice, 8);
  const Frost = fit(o.frost, 6);
  const S = snowballState(t);

  // Soft ground shadow & icy ground reflection beneath the Frost Snowball Beast
  if (S.visible > 0.02) {
    shadow(p, S.x, 0, S.baseR * S.sx * 1.18, 3.2, 0.38 * S.visible);
    p.glow(S.x, 0, 18 * S.sx, Ice[4], (0.20 + 0.12 * S.coreBreath) * S.visible);
  }

  // State 3 Move: Gleaming Frost Slide-Trail on the ground behind the rolling snowball
  drawFrostSlideTrail(p, t, S, Snow, Ice, Frost, o.seed);
}

export function draw(p, t, o) {
  t = wrap(t, D);
  const Snow = fit(o.palette, 8);
  const Ice = fit(o.ice, 8);
  const Frost = fit(o.frost, 6);
  const S = snowballState(t);

  // 1. Draw the Frost Snowball Beast (or its Vitrified Transparent Ice Sphere in State 5A/5B)
  drawFrostSnowballBeast(p, S, Snow, Ice, Frost, t);

  // 2. State 2 Eco Quirk: Mini Snowball Packing, Circus Ball-Balance & Faceplant Snow Ring
  drawEcoMiniSnowballAndSnowSplash(p, t, S, Snow, Ice, o.seed);

  // 3. State 4 Attack & Hit Result: Vortex Inhale, Icicle Blizzard Blast & Target Freeze-Shatter
  drawBlizzardAttackAndFreezeShatterHit(p, t, S, Snow, Ice, Frost, o.seed);

  // 4. State 5C/5D: Transparent Ice-Sphere Shatter into Crystal Chunks & Snowflakes
  drawIceSphereShatterAndReformation(p, t, Snow, Ice, o.seed);
}
