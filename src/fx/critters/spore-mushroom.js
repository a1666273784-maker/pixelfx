// Spore Mushroom ("critters/spore-mushroom" — 【孢子蘑菇小怪物特效】):
// A fantasy woodland mushroom monster showcasing four distinct action states across a 4.8s loop (`loop: true`):
// 1. 【待机 Idle (0.00..1.05s)】: A plump, rounded royal-purple cap studded with breathing bioluminescent
//    cyan-blue spots ("带有荧光蓝斑点的圆润紫伞盖" + "伞盖荧光呼吸") sits atop a chubby creamy-white stipe
//    ("白胖菌柄"), swaying left and right as it breathes ("左右摇摆呼吸") and sheds glowing forest spores.
// 2. 【移动 Move (1.05..2.28s)】: The white stem compresses deeply downward to wind up ("菌柄极度向下压缩蓄力"),
//    then hops forward in Q-elastic arcs ("随后Q弹地向前一蹦一跳"), kicking up puffs of dirt and pebbles on
//    landing ("并带起落地小尘土").
// 3. 【攻击 Attack & Hit Toxic Miasma (2.28..3.58s)】: The cap rears sharply backward, inhaling energy and
//    swelling ("伞盖猛然向后仰起吸气膨胀"), then snaps forward to blast a dense cone of venomous purple spore
//    smoke and glowing spore orbs from under its gills ("紧接着向前倾倒从伞褶下喷射出一大片剧毒紫色孢子烟雾与光弹"),
//    which detonate on the right into a spreading, curling toxic miasma cloud ("攻击命中时的毒雾扩散结果特效").
// 4. 【倒地 Collapse & Wither (3.58..4.80s)】: The stem softens and loses support, toppling the mushroom onto
//    its side with a thud ("菌柄软化失去支撑、整只蘑菇向侧面啪嗒摔倒") as its body shrivels and desaturates into
//    a dry, ashen grey-white corpse ("并变成灰白色干瘪状态"), before a mycelial pulse revives it back to Idle.
// Adapted from Sprite Fusion's open-source poison cloud & spore burst VFX (https://www.spritefusion.com/pixel-art-vfx/poison),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, hex, mix, clamp, smooth, seg, ease, lerp, rng, cycle, sparkle, TAU, WHITE } from "../../core/index.js";
import { Grid, shift, toss, lnoise } from "./_lib.js";
import { gasPuff } from "../nature/_lib.js";

export const meta = {
  name: "Spore mushroom",
  desc: "A purple mushroom critter with breathing cyan spots sways in idle, squashes to hop with dust, inhales to spray toxic spore smoke and orbs, then topples and withers grey-white.",
  tags: ["critter", "mushroom", "spores", "poison", "nature", "monster", "hop", "attack", "loop"],
  size: [236, 136],
  origin: [100, 110],
  duration: 4.8,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // 7-step Royal Purple Mushroom Cap & Toxic Spore Smoke ramp
    palette: ["#120722", "#281044", "#4a1c78", "#762eb4", "#a852ea", "#df88ff", "#f8dcff"],
    // 6-step Bioluminescent Cyan-Blue Cap Spots & Spore Orb Core ramp ("荧光蓝斑点" / "伞盖荧光呼吸")
    spots: ["#062034", "#0e4c70", "#1898c0", "#42ecff", "#b4ffff", "#ffffff"],
    // 6-step Plump Creamy-White Stipe/Stem ramp ("白胖菌柄")
    stem: ["#221c2a", "#4e445c", "#8a7e9a", "#c8bed6", "#eee8f6", "#ffffff"],
    seed: 1,
  },
};

const D = meta.duration;
// State boundary timestamps across the 4.8s loop:
// 0.00..1.05s (frames 0, 10, 19, 29)  : State 1 — IDLE (breathing bioluminescent spots, left-right sway)
// 1.05..2.28s (frames 38, 48, 57, 67) : State 2 — MOVE (38: deep squash windup; 48: Hop 1 apex; 57: Hop 1 land + dust; 67: Hop 2 land + dust)
// 2.28..3.58s (frames 76, 86, 95, 105): State 3 — ATTACK (76: rear back & inhale swell; 86: forward pitch + spore smoke & orbs; 95 & 105: expanding toxic miasma)
// 3.58..4.80s (frames 114, 124, 133, 143): State 4 — DOWN & WITHER (114: stem softens & tips sideways; 124 & 133: fallen grey-white shriveled state; 143: mycelial revival)
const T_MOVE = 1.05;
const T_HOP1_UP = 1.36;
const T_HOP1_LAND = 1.84;
const T_HOP2_UP = 1.95;
const T_HOP2_LAND = 2.18;

const T_ATK = 2.28;
const T_FIRE = 2.64;
const T_HIT = 2.82;
const T_DOWN = 3.58;
const T_THUD = 3.92;
const T_REVIVE = 4.58;

const X_IDLE = -58;
const X_MID = -34;
const X_ATK = -14;
const X_TARGET = 68;

const STEM_H0 = 18.5;
const STEM_W0 = 13.0;
const CAP_W0 = 25.0;
const CAP_H0 = 17.5;

const GRID = new Grid(-100, -90, 208, 100);

// Withered grey-white dried mushroom ramp ("灰白色干瘪状态")
const WITHER_CAP = ["#1e1c24", "#3a3744", "#5e5a6a", "#888396", "#b4aec2", "#dad5e6", "#f4f0fa"].map(hex);
const WITHER_STEM = ["#222028", "#464250", "#726d80", "#a29cb0", "#cecadc", "#f0ecf8"].map(hex);
const DUST_COL = [hex("#383040"), hex("#685c72"), hex("#9e90a8"), hex("#d8cee2")];

// 7 Bioluminescent cyan-blue spots on the rounded purple cap: [normX (-1..1), normY (0..1 from rim to crown), radius, phase]
const CAP_SPOTS = [
  [-0.50, 0.44, 3.1, 0.0],
  [0.06, 0.68, 3.6, 1.2],
  [0.52, 0.40, 2.9, 2.4],
  [-0.20, 0.24, 2.4, 3.6],
  [0.32, 0.78, 2.3, 4.8],
  [-0.72, 0.20, 2.0, 5.5],
  [0.74, 0.18, 2.0, 0.9],
];

// Compute the complete pose, deformation, bioluminescence, and wither state of the Spore Mushroom at time t
function mushroomPose(t) {
  let x = X_IDLE;
  let y = 0;
  let stemSquash = 0;   // < 0 compressed flat, > 0 stretched tall
  let stemSway = 0;     // horizontal offset of neck relative to foot
  let stemDroop = 0;    // 0..1 limp S-curve buckle when stem loses support in State 4
  let bodyRot = 0;      // whole-body rotation when toppling sideways
  let capTilt = 0;      // cap pitch relative to stem (< 0 opens gills toward the right)
  let capInflate = 1.0; // cap & gill expansion (> 1 when inhaling, < 1 when shriveled)
  let bioGlow = 1.0;    // bioluminescent cyan spot breathing intensity ("伞盖荧光呼吸")
  let gillGlow = 0.15;  // underside gill luminescence
  let wither = 0;       // 0 = vibrant living purple/cyan/white .. 1 = desiccated grey-white corpse ("灰白色干瘪状态")
  let shrivel = 0;      // 0 = plump & smooth .. 1 = wrinkled & shrunken
  let eyeMode = "normal"; // "normal" | "blink" | "squint" | "glare" | "dead"

  // Base bioluminescent breathing wave
  const breathWave = 0.5 + 0.5 * Math.sin((t / D) * TAU * 5);
  bioGlow = 0.52 + 0.48 * breathWave;

  if (t < T_MOVE) {
    // =========================================================================
    // STATE 1: 【待机 IDLE (0.00..1.05s)】 — Swaying left & right, breathing cap & stem
    // =========================================================================
    const u = t / T_MOVE;
    const sway = Math.sin(u * TAU * 2);
    const breath = Math.sin(u * TAU * 2 * 2);
    x = X_IDLE;
    stemSway = sway * 3.8;
    stemSquash = 0.07 * breath;
    capTilt = sway * 0.15;
    capInflate = 1.0 + 0.045 * breath;
    bioGlow = 0.42 + 0.58 * (0.5 + 0.5 * Math.cos(u * TAU * 2 - 0.4));
    if (t > 0.46 && t < 0.54) eyeMode = "blink";
  } else if (t < T_ATK) {
    // =========================================================================
    // STATE 2: 【移动 MOVE (1.05..2.28s)】 — Extreme stem compression & 2 Q-elastic hops
    // =========================================================================
    if (t < T_HOP1_UP) {
      // Hop 1 Wind-Up (1.05..1.36s, frame 38 at 1.27s): Extreme downward stem compression ("菌柄极度向下压缩蓄力")
      const u = seg(t, T_MOVE, T_HOP1_UP);
      const eu = ease.inOutSine(u);
      x = X_IDLE;
      stemSquash = -0.52 * eu + 0.025 * Math.sin(t * 75) * u;
      stemSway = -2.4 * eu;
      capTilt = -0.14 * eu;
      eyeMode = "squint";
    } else if (t < T_HOP1_LAND) {
      // Hop 1 Airborne Q-elastic arc (1.36..1.84s, frame 48 at 1.60s is right at the high apex!)
      const q = seg(t, T_HOP1_UP, T_HOP1_LAND);
      x = lerp(X_IDLE, X_MID, ease.inOutSine(q));
      y = -28 * 4 * q * (1 - q);
      stemSquash = q < 0.35 ? lerp(0.42, 0.08, q / 0.35) : q > 0.75 ? lerp(0.04, 0.24, (q - 0.75) / 0.25) : 0.04;
      stemSway = lerp(2.8, -1.5, q);
      capTilt = lerp(0.22, -0.14, q);
    } else if (t < T_HOP2_UP) {
      // Hop 1 Landing Squash & Hop 2 Wind-Up (1.84..1.95s, frame 57 at 1.90s catches deep landing squash + fresh dust!)
      const u = seg(t, T_HOP1_LAND, T_HOP2_UP);
      x = X_MID;
      stemSquash = -0.50 * Math.sin(Math.min(1, u * 1.5) * (Math.PI / 2));
      stemSway = -1.8 * u;
      capTilt = -0.12 * u;
      eyeMode = "squint";
    } else if (t < T_HOP2_LAND) {
      // Hop 2 Airborne Q-elastic arc (1.95..2.18s)
      const q = seg(t, T_HOP2_UP, T_HOP2_LAND);
      x = lerp(X_MID, X_ATK, ease.inOutSine(q));
      y = -24 * 4 * q * (1 - q);
      stemSquash = q < 0.35 ? lerp(0.38, 0.06, q / 0.35) : q > 0.75 ? lerp(0.02, 0.22, (q - 0.75) / 0.25) : 0.02;
      stemSway = lerp(2.4, -1.0, q);
      capTilt = lerp(0.20, -0.12, q);
    } else {
      // Hop 2 Landing Squash & Recovery at X_ATK (2.18..2.28s, frame 67 at 2.23s catches landing squash + dust!)
      const u = seg(t, T_HOP2_LAND, T_ATK);
      x = X_ATK;
      stemSquash = -0.44 * Math.sin(u * Math.PI);
      stemSway = 1.6 * Math.sin(u * Math.PI);
      eyeMode = "squint";
    }
  } else if (t < T_DOWN) {
    // =========================================================================
    // STATE 3: 【攻击 ATTACK (2.28..3.58s)】 — Rear back & inhale swell -> Pitch forward & spray spores from gills
    // =========================================================================
    if (t < T_FIRE) {
      // 3A: Cap rears sharply backward, inhaling and swelling (2.28..2.64s, frame 76 at 2.53s)
      //     ("伞盖猛然向后仰起吸气膨胀")
      const u = seg(t, T_ATK, T_FIRE);
      const eu = ease.outCubic(u);
      const tremor = Math.sin(t * 95) * 0.8 * u;
      x = X_ATK - 4.0 * eu;
      stemSquash = 0.24 * eu;
      stemSway = -7.5 * eu + tremor;
      capTilt = -0.56 * eu; // Tilts cap crown back-left so underside gills flare wide open toward the right!
      capInflate = 1.0 + 0.30 * eu + 0.03 * Math.sin(t * 80) * u;
      bioGlow = 0.90 + 0.65 * eu;
      gillGlow = 0.35 + 0.85 * eu;
      eyeMode = "glare";
    } else {
      // 3B: Mushroom pitches sharply forward ("紧接着向前倾倒从伞褶下喷射出一大片剧毒紫色孢子烟雾与光弹"):
      //     The stem & cap whip from reared-back (`capTilt = -0.56`) to pitched-forward (`capTilt = +0.30`, `stemSway = +8.8`)
      //     while flaring the front underside gill skirt open so spore smoke & orbs blast straight from under the gills!
      const age = t - T_FIRE;
      const hold = 1 - smooth(0.52, 0.88, age);
      const snap = ease.outBack(clamp(age / 0.08), 1.8);
      const recoil = Math.exp(-age * 8) * Math.sin(age * 38) * 1.8;

      x = X_ATK + 4.5 * snap * hold;
      stemSquash = (0.04 * snap + 0.06 * recoil) * hold;
      stemSway = (8.8 * snap - 2.0 * recoil) * hold;
      capTilt = (0.30 * snap - 0.08 * recoil) * hold;
      capInflate = lerp(1.0, 1.12 - 0.12 * snap, hold);
      bioGlow = 0.68 + 0.65 * Math.exp(-age * 3);
      gillGlow = 1.0 * Math.exp(-age * 2.2);
      eyeMode = age < 0.62 ? "glare" : "normal";
    }
  } else {
    // =========================================================================
    // STATE 4: 【倒地 DOWN & WITHER (3.58..4.80s)】 — Stem softens -> Topples sideways -> Shrivels grey-white
    // =========================================================================
    if (t < T_REVIVE) {
      const age = t - T_DOWN;
      // 4A: Stem softens & loses support (3.58..3.92s, frame 114 at 3.80s is mid-topple!),
      //     then flops sideways onto the ground ("菌柄软化失去支撑、整只蘑菇向侧面啪嗒摔倒")
      const fallU = clamp((t - (T_DOWN + 0.05)) / (T_THUD - (T_DOWN + 0.05)), 0, 1);
      const fallEase = ease.inQuad(fallU);
      const bounce = t >= T_THUD ? Math.exp(-(t - T_THUD) * 11) * Math.abs(Math.sin((t - T_THUD) * 22)) * 0.14 : 0;

      const softenWobble = t < T_THUD ? Math.sin(age * 28) * (1 - fallU) * 2.5 : 0;
      x = lerp(X_ATK, -16, fallEase);
      // Elevate pivot to y = -15.5 as it rotates sideways so the entire fallen cap dome & limp stem rest on y = 0!
      y = lerp(0, -15.5, fallEase);
      stemSquash = -0.18 * smooth(0, 0.12, age) * (1 - fallEase * 0.6);
      stemSway = -3.8 * smooth(0, 0.15, age) * (1 - fallEase * 0.5) + softenWobble;
      stemDroop = smooth(T_DOWN + 0.04, T_THUD, t);

      // Topple sideways (`bodyRot` reaches -1.24 rad = -71 degrees so both cap rim and stem base rest on the floor!)
      bodyRot = (-1.24 + bounce) * fallEase;
      capTilt = -0.10 * fallEase;

      // 4B: Desaturates & shrivels into a dry grey-white state ("并变成灰白色干瘪状态", frames 124 & 133)
      wither = smooth(T_DOWN + 0.22, T_THUD + 0.14, t);
      shrivel = smooth(T_THUD - 0.04, T_THUD + 0.20, t);
      capInflate = 1.0 - 0.18 * shrivel;
      bioGlow = (0.45 + 0.35 * Math.sin(age * 35)) * (1 - smooth(T_DOWN + 0.10, T_THUD + 0.06, t));
      gillGlow = 0;
      eyeMode = "dead";
    } else {
      // 4C: Seamless mycelial revival (4.58..4.80s) back to X_IDLE so the loop has zero seam!
      const u = seg(t, T_REVIVE, D);
      const eu = ease.inOutCubic(u);
      x = lerp(-16, X_IDLE, eu);
      y = lerp(-15.5, 0, eu) - 6 * Math.sin(u * Math.PI);
      bodyRot = lerp(-1.24, 0, ease.outBack(u, 1.4));
      stemDroop = 1 - eu;
      wither = 1 - eu;
      shrivel = 1 - eu;
      capInflate = lerp(0.82, 1.0, eu);
      bioGlow = 0.50 * eu;
      eyeMode = u < 0.5 ? "blink" : "normal";
    }
  }

  return {
    x,
    y,
    stemH: STEM_H0 * (1 + stemSquash) * (1 - 0.14 * shrivel),
    stemW: (STEM_W0 / Math.sqrt(Math.max(0.42, 1 + stemSquash))) * (1 - 0.22 * shrivel),
    stemSquash,
    stemSway,
    stemDroop,
    bodyRot,
    capTilt,
    capInflate,
    bioGlow,
    gillGlow,
    wither,
    shrivel,
    eyeMode,
  };
}

// Helper to blend living palette with withered grey-white palette based on `P.wither` (0..1)
function paletteWithWither(livingRamp, witherRamp, w) {
  if (w <= 0.01) return livingRamp;
  if (w >= 0.99) return witherRamp;
  return livingRamp.map((c, i) => mix(c, witherRamp[Math.min(witherRamp.length - 1, i)], w));
}

// 1. DRAW THE SPORE MUSHROOM MONSTER IN `GRID` (Plump White Stem + Glowing Gills + Purple Cap with Cyan Spots)
function drawSporeMushroomBody(g, p, CapLive, BioLive, StemLive, P, t) {
  g.clear();

  const Cap = paletteWithWither(CapLive, WITHER_CAP, P.wither);
  const Stem = paletteWithWither(StemLive, WITHER_STEM, P.wither);
  const Bio = P.wither > 0.85 ? WITHER_STEM : BioLive.map((c, i) => mix(c, WITHER_STEM[Math.min(5, i)], P.wither * 0.9));

  // Pivot at the mushroom's foot `(P.x, P.y - 1)` rotated by `P.bodyRot` when toppling sideways
  const footX = P.x;
  const footY = P.y - 1;
  const cosB = Math.cos(P.bodyRot);
  const sinB = Math.sin(P.bodyRot);

  // Transform world `(wx, wy)` into the mushroom's upright foot-local frame `(lx, ly)` where `ly <= 0` is up
  const toFootLocal = (wx, wy) => {
    const dx = wx - footX;
    const dy = wy - footY;
    return [dx * cosB + dy * sinB, -dx * sinB + dy * cosB];
  };
  // Transform foot-local `(lx, ly)` back to world `(wx, wy)`
  const toWorld = (lx, ly) => [
    footX + lx * cosB - ly * sinB,
    footY + lx * sinB + ly * cosB,
  ];

  const H = P.stemH;
  const W = P.stemW;

  // Neck position at top of the curved stipe in foot-local coordinates
  const neckLx = P.stemSway;
  const neckLy = -H;

  // Cap orientation in foot-local coordinates (`P.capTilt` tilts the cap relative to the stem)
  const capAng = P.capTilt;
  const cosC = Math.cos(capAng);
  const sinC = Math.sin(capAng);

  const cw = CAP_W0 * P.capInflate * (1 - 0.14 * P.stemSquash);
  const ch = CAP_H0 * P.capInflate * (1 + 0.10 * P.stemSquash);

  const pad = 44;
  const [centerWx, centerWy] = toWorld(neckLx * 0.5, -H * 0.6);

  // Pass A: Shade the Plump Creamy-White Stipe/Stem ("白胖菌柄")
  g.shade(centerWx - pad, centerWy - pad, centerWx + pad, Math.min(2, centerWy + pad), (wx, wy, o) => {
    if (wy > 1.5) return 0;
    const [lx, ly] = toFootLocal(wx, wy);
    const v = -ly / H; // 0 at foot .. 1 at neck
    if (v < -0.08 || v > 1.05) return 0;

    // Curved spine of the stem: quadratic bend toward `neckLx`, plus limp S-curve droop when collapsed (`P.stemDroop`)
    const droopCurve = P.stemDroop * (-6.5 * (1 - v) * (1 - v) + 2.2 * Math.sin(v * Math.PI));
    const spine = neckLx * v * v + droopCurve;
    // Plump pear-shaped stipe profile: bulbous belly around v = 0.32, narrowing toward the neck
    const bellyBulge = Math.sin(clamp(v, 0, 1) * Math.PI) * (0.32 - 0.16 * P.shrivel);
    const halfW = (W * 0.5) * (1.06 - 0.28 * v + bellyBulge) * (v < 0.14 ? Math.sqrt(Math.max(0, (v + 0.08) / 0.22)) : 1);

    // Dry shriveled wave along the stem contour when withered ("灰白色干瘪状态")
    const shrivelIndent = P.shrivel * 1.15 * Math.sin(v * 15 + lx * 0.6);
    const hw = Math.max(1.8, halfW + shrivelIndent);
    const dx = lx - spine;
    if (Math.abs(dx) > hw) return 0;

    const q = (dx + hw) / (2 * hw); // 0 left lit edge .. 1 right shaded edge
    o.a = 1;
    o.t = 1;

    // Dry vertical creases when shriveled
    if (P.shrivel > 0.45 && Math.abs(Math.sin(dx * 1.5)) > 0.82 && v > 0.10 && v < 0.88) {
      return Stem[1];
    }
    if (v > 0.86) return Stem[1]; // shadow cast by the cap under the neck
    if (q < 0.22) return Stem[4];
    if (q < 0.56) return Stem[5];
    if (q < 0.80) return Stem[3];
    return Stem[2];
  });

  // Pass B: Draw Expressive Eyes on the Plump White Stem
  const eyeV = 0.50;
  const eyeDroop = P.stemDroop * (-6.5 * (1 - eyeV) * (1 - eyeV) + 2.2 * Math.sin(eyeV * Math.PI));
  const eyeSpineX = neckLx * eyeV * eyeV + eyeDroop;
  const eyeLy = -H * eyeV;
  for (const side of [-1, 1]) {
    const elx = eyeSpineX + side * (W * 0.24);
    const [ewx, ewy] = toWorld(elx, eyeLy);
    const ex = Math.round(ewx);
    const ey = Math.round(ewy);

    if (P.eyeMode === "dead") {
      // Dizzy/fainted `x` eyes when collapsed and withered
      g.set(ex - 1, ey - 1, Stem[0], 1, 2);
      g.set(ex + 1, ey + 1, Stem[0], 1, 2);
      g.set(ex + 1, ey - 1, Stem[0], 1, 2);
      g.set(ex - 1, ey + 1, Stem[0], 1, 2);
      g.set(ex, ey, Stem[0], 1, 2);
    } else if (P.eyeMode === "blink" || P.eyeMode === "squint") {
      g.set(ex - 1, ey, Cap[0], 1, 2);
      g.set(ex, ey, Cap[0], 1, 2);
      g.set(ex + 1, ey, Cap[0], 1, 2);
    } else if (P.eyeMode === "glare") {
      // Glowing cyan-violet attack eyes!
      g.set(ex, ey, Bio[4], 1, 2);
      g.set(ex + 1, ey, WHITE, 1, 2);
      g.set(ex, ey + 1, Bio[3], 1, 2);
      g.set(ex - 1, ey, Cap[0], 1, 2);
      g.set(ex + 2, ey, Cap[0], 1, 2);
    } else {
      // Cute dark berry-violet 2x3 vertical oval eyes with a crisp white catchlight
      for (let ky = -1; ky <= 1; ky++) {
        g.set(ex, ey + ky, Cap[0], 1, 2);
        g.set(ex + 1, ey + ky, ky === 1 ? Cap[1] : Cap[0], 1, 2);
      }
      g.set(ex, ey - 1, WHITE, 1, 2);
    }
  }

  // Pass C: Shade the Underside Gill Lamellae ("伞褶") & Rounded Royal-Purple Cap with Bioluminescent Blue Spots
  //         ("带有荧光蓝斑点的圆润紫伞盖" + "伞盖荧光呼吸")
  const capToWorld = (cu, cv) => {
    const lx = neckLx + cu * cosC + cv * sinC;
    const ly = neckLy + cu * sinC - cv * cosC;
    return toWorld(lx, ly);
  };

  const spotWorldCenters = [];
  for (let i = 0; i < CAP_SPOTS.length; i++) {
    const [sx0, sy0, sr, sph] = CAP_SPOTS[i];
    const [wx, wy] = capToWorld(sx0 * cw, sy0 * ch);
    const spotPulse = P.bioGlow * (0.65 + 0.35 * Math.sin((t / D) * TAU * 4 + sph));
    spotWorldCenters.push({ wx, wy, sr: sr * P.capInflate, spotPulse, sx0, sy0 });
  }

  const [capCenterWx, capCenterWy] = capToWorld(0, ch * 0.45);

  g.shade(capCenterWx - pad, capCenterWy - pad, capCenterWx + pad, Math.min(2, capCenterWy + pad), (wx, wy, o) => {
    if (wy > 1.5) return 0;
    const [lx, ly] = toFootLocal(wx, wy);
    const dnx = lx - neckLx;
    const upY = -(ly - neckLy); // height above neck in foot-local space
    // Exact orthogonal rotation into cap-local coordinates `(cu, cv)`
    const cu = dnx * cosC - upY * sinC;
    const cv = dnx * sinC + upY * cosC;

    const nx = cu / cw;
    const ny = cv / ch;

    // 1. Underside Gill Skirt ("伞褶"): visible in `cv in [-4.8 .. +1.6]` within `|nx| <= 0.96`
    const flare = P.gillGlow * Math.max(0, nx + 0.2);
    const gillLip = -2.2 - (2.2 + 1.4 * flare) * Math.sqrt(Math.max(0, 1 - nx * nx));
    const capBrimLift = 0.08 * flare;
    if (cv >= gillLip && cv < 1.2 + capBrimLift * ch && Math.abs(nx) <= 0.96) {
      if (cv < 0.4 + capBrimLift * ch || Math.abs(nx) > 0.82) {
        o.a = 1;
        o.t = 3;
        const pleat = (Math.floor((nx + 1) * 15) & 1) === 0;
        if (P.gillGlow > 0.25) {
          return pleat ? (P.gillGlow > 0.65 ? Bio[4] : Bio[3]) : Cap[4];
        }
        return pleat ? Stem[3] : Stem[1];
      }
    }

    // 2. Rounded Purple Cap Dome ("圆润紫伞盖"):
    const brimWave = 0.04 * Math.cos(nx * Math.PI * 5) - P.shrivel * 0.09 * Math.sin(nx * 9) + capBrimLift;
    if (ny < brimWave - 0.06) return 0;

    // Plump rounded toadstool dome profile (`nx^2 + ny^2 <= 1`), wrinkling when shriveled
    const shrivelDent = P.shrivel * 0.14 * Math.cos(nx * 8 + ny * 6);
    const d2 = nx * nx + Math.max(0, ny) * Math.max(0, ny) + shrivelDent;
    if (d2 > 1.0) return 0;

    o.a = 1;
    o.t = 4;

    // Check if pixel lies inside one of the 7 Bioluminescent Cyan-Blue Spots ("荧光蓝斑点")
    for (let i = 0; i < CAP_SPOTS.length; i++) {
      const [sx0, sy0, sr, sph] = CAP_SPOTS[i];
      const ex = (nx - sx0) * cw;
      const ey = (ny - sy0) * ch * 1.12;
      const rSpot = sr * (1 - 0.20 * P.shrivel);
      const sd2 = (ex * ex + ey * ey) / (rSpot * rSpot);
      if (sd2 <= 1.0) {
        if (P.wither > 0.65) {
          // Desaturated dry grey-white sunken spot with dark rim when collapsed and withered
          return sd2 < 0.48 ? WITHER_CAP[1] : WITHER_CAP[6];
        }
        const spGlow = P.bioGlow * (0.68 + 0.32 * Math.sin((t / D) * TAU * 4 + sph));
        if (sd2 < 0.36) return spGlow > 0.68 ? WHITE : Bio[4];
        if (sd2 < 0.76) return spGlow > 0.50 ? Bio[3] : Bio[2];
        return Bio[1];
      }
    }

    // Dry shriveled ribs across the cap when withered ("灰白色干瘪状态")
    if (P.shrivel > 0.45 && Math.abs(Math.sin(nx * 9 + ny * 3)) > 0.84) {
      return Cap[2];
    }

    // Shade the rounded royal-purple cap dome (lit from top-left, deep purple at bottom-right rim)
    const lit = -nx * 0.58 + ny * 0.81;
    if (d2 > 0.84 && ny > 0.30 && nx < -0.10) return Cap[5];
    if (lit > 0.48) return Cap[5];
    if (lit > 0.14) return Cap[4];
    if (lit > -0.18) return Cap[3];
    if (lit > -0.48) return Cap[2];
    return Cap[1];
  });

  // 1px dark outline around the entire mushroom
  g.outline((x, y, nx, ny) => {
    if (P.wither > 0.6) return WITHER_CAP[0];
    if (ny < 0 && nx <= 0 && y < footY - H * 0.8) return Cap[1];
    return Cap[0];
  });

  g.draw(p);

  // Additive bioluminescent glow on each cyan-blue cap spot ("伞盖荧光呼吸") & glowing gills
  if (P.bioGlow > 0.05) {
    for (const sp of spotWorldCenters) {
      p.glow(sp.wx, sp.wy, sp.sr * 2.9 + 2, BioLive[3], 0.36 * sp.spotPulse);
      if (sp.spotPulse > 0.70) {
        p.glow(sp.wx, sp.wy, sp.sr * 1.4, WHITE, 0.26 * sp.spotPulse);
      }
    }
    p.glow(capCenterWx, capCenterWy, cw * 1.25, BioLive[2], 0.22 * P.bioGlow);
  }

  // Gill muzzle coordinates on the right-hand underside of the cap (`cu = +10, cv = -2.5`)
  const [gillWx, gillWy] = capToWorld(10, -2.5);
  if (P.gillGlow > 0.2) {
    p.glow(gillWx, gillWy, 26, CapLive[4], 0.48 * P.gillGlow);
    p.glow(gillWx, gillWy, 12, BioLive[3], 0.42 * P.gillGlow);
  }

  return { gillWx, gillWy, capCenterWx, capCenterWy };
}

// 2. LANDING DUST PUFFS & PEBBLES ON HOPS & SIDEWAYS COLLAPSE ("带起落地小尘土" / "向侧面啪嗒摔倒")
function drawHopAndCollapseDust(p, t, seed) {
  const dustEvents = [
    { t0: T_HOP1_LAND, x: X_MID, pow: 1.05, count: 14 },
    { t0: T_HOP2_LAND, x: X_ATK, pow: 1.12, count: 14 },
    { t0: T_THUD, x: -30, pow: 1.30, count: 16 }, // Sideways collapse thud dust!
  ];

  for (let e = 0; e < dustEvents.length; e++) {
    const ev = dustEvents[e];
    const age = t - ev.t0;
    if (age < 0 || age > 0.62) continue;
    const u = age / 0.62;

    // Billowing earthy dust puffs hugging the floor
    for (let i = 0; i < ev.count; i++) {
      const r = rng(seed, e * 31 + i, 91);
      const life = r.range(0.36, 0.58);
      if (age > life) continue;
      const ku = age / life;
      const side = i % 2 === 0 ? -1 : 1;
      const dist = (7 + r.range(12, 26) * ease.outCubic(ku)) * ev.pow;
      const dx = ev.x + side * dist;
      const dy = -1.8 - r.range(2.5, 8.5) * Math.sin(Math.min(1, ku * 1.4) * Math.PI);
      const popEnv = Math.sin(Math.min(1, Math.pow(ku, 0.55) * 1.15) * Math.PI);
      const rad = r.range(2.6, 4.6) * ev.pow * popEnv;
      const a = Math.pow(1 - ku, 0.75) * 0.92;
      p.disc(dx, dy, rad, DUST_COL[1], a * 0.78);
      p.disc(dx - side * 0.6, dy - 0.6, rad * 0.68, DUST_COL[3], a * 0.95);
    }

    // Kicked-up soil pebbles arcing and bouncing on the floor
    for (let i = 0; i < 8; i++) {
      const r = rng(seed, e * 19 + i, 99);
      const side = i % 2 === 0 ? -1 : 1;
      const f = toss(ev.x + side * 6, -1, side * r.range(24, 58) * ev.pow, -r.range(36, 78) * ev.pow, age, 560, 0);
      if (age < 0.48) {
        p.dot(f.x, f.y, i % 2 === 0 ? DUST_COL[3] : DUST_COL[2], 1 - u);
      }
    }
  }
}

// 3. ATTACK INHALE STREAKS, VENOMOUS PURPLE SPORE SMOKE JET, GLOWING SPORE ORBS & HIT TOXIC CLOUD DIFFUSION
//    ("伞盖猛然向后仰起吸气膨胀、紧接着向前倾倒从伞褶下喷射出一大片剧毒紫色孢子烟雾与光弹" + "攻击命中时的毒雾扩散结果特效")
function drawAttackSporeBarrageAndToxicHit(p, Cap, Bio, gillPos, t, seed) {
  // 3A: Inhale energy streaks & glowing spore motes converging into the open underside gills (`2.28..2.64s`, frame 76)
  if (t >= T_ATK && t < T_FIRE) {
    const u = (t - T_ATK) / (T_FIRE - T_ATK);
    const eu = ease.outQuad(u);
    // Glowing suction ring in front of the open gills
    p.ring(gillPos.gillWx + 2, gillPos.gillWy, 6 + 6 * (1 - u), 1, Bio[3], 0.55 * eu);
    for (let i = 0; i < 20; i++) {
      const r = rng(seed, i, 303);
      const subU = (u * 2.2 + i / 20) % 1;
      const ang = r.range(-0.95, 0.75);
      const dist = lerp(38, 3, ease.inQuad(subU));
      const x0 = gillPos.gillWx + Math.cos(ang) * dist;
      const y0 = gillPos.gillWy + Math.sin(ang) * dist * 0.78;
      const x1 = gillPos.gillWx + Math.cos(ang) * (dist + 6.5);
      const y1 = gillPos.gillWy + Math.sin(ang) * (dist + 6.5) * 0.78;
      const col = i % 2 === 0 ? Bio[4] : Cap[5];
      p.line(x0, y0, x1, y1, col, Math.sin(subU * Math.PI));
      if (i % 3 === 0) {
        p.dot(x0, y0, WHITE, Math.sin(subU * Math.PI));
      }
    }
  }

  if (t < T_FIRE || t > T_DOWN + 0.52) return;
  const age = t - T_FIRE;

  // Muzzle flash star at the moment the gills erupt (`t = 2.64..2.80s`)
  if (age < 0.16) {
    const k = 1 - age / 0.16;
    sparkle(p, gillPos.gillWx + 3, gillPos.gillWy, 11 * k, WHITE, Bio[4], 0.82 * k);
    p.glow(gillPos.gillWx + 3, gillPos.gillWy, 32, Cap[5], 0.70 * k);
  }

  // 3B: Dense cone of venomous purple spore smoke billowing out from under the gills (`age = 0..0.95s`)
  //     ("从伞褶下喷射出一大片剧毒紫色孢子烟雾")
  for (let i = 0; i < 36; i++) {
    const r = rng(seed, i, 401);
    const delay = (i / 36) * 0.28;
    const pa = age - delay;
    const life = r.range(0.56, 0.90);
    if (pa <= 0 || pa >= life) continue;

    const u = pa / life;
    const drag = 1 - Math.exp(-pa * 3.3);
    const coneAng = r.range(-0.38, 0.34);
    const speed = r.range(84, 178);
    const px = gillPos.gillWx + 2 + ((Math.cos(coneAng) * speed) / 3.3) * drag;
    const py = gillPos.gillWy + ((Math.sin(coneAng) * speed) / 3.3) * drag - r.range(3, 14) * pa + Math.sin(pa * 8 + i) * 2.0;

    const rad = lerp(r.range(3.0, 4.8), r.range(8.0, 13.0), ease.outCubic(u));
    const al = Math.min(1, u * 7) * Math.pow(1 - u, 1.12) * 0.86;

    const hiCol = i % 3 === 0 ? Bio[4] : Cap[6];
    gasPuff(p, px, py, rad, al, Cap[1], Cap[3], Cap[5], u < 0.58 ? hiCol : 0);
    if (i % 4 === 0) {
      p.glow(px, py, rad * 1.8, i % 8 === 0 ? Bio[3] : Cap[4], 0.25 * al);
    }
  }

  // 3C: 6 Glowing Toxic Spore Light-Orbs ("与光弹") streaking from under the gills to the target zone!
  // Staggered so Frame 86 (`t = 2.87s`, `age = 0.23s`) shows orbs in mid-flight AND orb 0/1 impacting at X_TARGET,
  // and Frame 95 (`t = 3.17s`, `age = 0.53s`) shows the final orb detonating inside the boiling toxic cloud!
  const orbs = [
    { delay: 0.00, flight: 0.19, tx: X_TARGET - 8,  ty: -12, arc: -6,  col: Bio[4], halo: Cap[5] },
    { delay: 0.06, flight: 0.21, tx: X_TARGET + 6,  ty: -22, arc: -11, col: Cap[6], halo: Bio[3] },
    { delay: 0.12, flight: 0.22, tx: X_TARGET - 2,  ty: -8,  arc: 5,   col: Bio[4], halo: Cap[4] },
    { delay: 0.18, flight: 0.22, tx: X_TARGET + 14, ty: -18, arc: -9,  col: Bio[4], halo: Cap[5] },
    { delay: 0.25, flight: 0.22, tx: X_TARGET - 14, ty: -16, arc: -7,  col: Cap[6], halo: Bio[3] },
    { delay: 0.32, flight: 0.21, tx: X_TARGET + 4,  ty: -14, arc: 4,   col: Bio[4], halo: Cap[5] },
  ];

  for (let b = 0; b < orbs.length; b++) {
    const ob = orbs[b];
    const oa = age - ob.delay;
    if (oa < 0) continue;

    const startX = gillPos.gillWx + 2;
    const startY = gillPos.gillWy;

    if (oa <= ob.flight) {
      // Airborne glowing spore light-orb streaking toward target
      const u = oa / ob.flight;
      const ox = lerp(startX, ob.tx, ease.outQuad(u));
      const oy = lerp(startY, ob.ty, u) + ob.arc * Math.sin(u * Math.PI);

      // Spiral spore-light comet trail behind the orb
      for (let k = 1; k <= 9; k++) {
        const tu = Math.max(0, u - k * 0.032);
        const tx = lerp(startX, ob.tx, ease.outQuad(tu));
        const ty = lerp(startY, ob.ty, tu) + ob.arc * Math.sin(tu * Math.PI) + Math.sin(tu * 28 + b * 2) * 1.6;
        p.dot(tx, ty, k < 3 ? ob.col : ob.halo, 1 - k / 10);
      }

      // Bright multi-layered glowing orb head
      p.circle(ox, oy, 3.6, ob.halo);
      p.circle(ox, oy, 2.4, ob.col);
      p.circle(ox, oy, 1.3, WHITE);
      p.glow(ox, oy, 16, ob.halo, 0.65);
      p.glow(ox, oy, 7, WHITE, 0.52);
    } else if (oa < ob.flight + 0.24) {
      // Impact star-burst & shock-ring when each spore light-orb hits!
      const hu = (oa - ob.flight) / 0.24;
      const hk = 1 - hu;
      const rr = 3 + 18 * ease.outCubic(hu);
      p.ring(ob.tx, ob.ty, rr, 1, hu < 0.35 ? WHITE : ob.col, hk);
      sparkle(p, ob.tx, ob.ty, 9.0 * hk, WHITE, ob.col, 0.78 * hk);
      p.glow(ob.tx, ob.ty, 30, ob.halo, 0.60 * hk);
    }
  }

  // 3D: TARGET HIT & EXPANDING TOXIC MIASMA CLOUD RESULT ("和攻击命中时的毒雾扩散结果特效")
  // Inspired by `nature/poison-cloud.js` & `nature/spore-burst.js`:
  // Floor-hugging lnoise miasma sheet + curling leading-edge tongues + rolling gasPuffs + rising poison ribbons!
  const hitAge = t - T_HIT;
  if (hitAge > 0 && hitAge < 1.22) {
    const hu = hitAge / 1.22;
    const spread = ease.outCubic(Math.min(1, hitAge / 0.58));
    const fade = Math.min(1, hitAge * 10) * (1 - smooth(0.62, 1.0, hu));

    const poolRx = Math.round(14 + 42 * spread);
    const poolTopH = Math.round(6 + 14 * spread * (1 - 0.25 * hu));

    p.glow(X_TARGET, -6, Math.min(54, poolRx * 1.15), Cap[4], 0.42 * fade);
    p.glow(X_TARGET, -2, Math.min(42, poolRx * 0.85), Bio[3], 0.32 * fade);

    // 1. Ragged lnoise-sculpted floor-hugging toxic miasma cloud sheet (with curling leading-edge tongues!)
    const flow = hitAge * 4.5;
    for (let dx = -poolRx - 6; dx <= poolRx + 6; dx++) {
      const u = Math.abs(dx) / Math.max(1, poolRx);
      if (u > 1.12) continue;
      const n1 = lnoise(dx * 0.14 - Math.sign(dx) * flow, hitAge * 2.5 + seed * 3);
      const n2 = lnoise(dx * 0.28 + flow * 0.7, hitAge * 4.0 + seed * 11);
      // Curling bulge at the outer leading edges (`u in 0.65..1.0`)
      const edgeCurl = Math.exp(-((u - 0.82) ** 2) / 0.035) * 0.45 * spread;
      const env = Math.max(0, Math.sqrt(Math.max(0, 1 - u * u * 0.88)) * 0.75 + edgeCurl);
      const colH = Math.round(poolTopH * env * (0.65 + 0.55 * n1));
      if (colH <= 0) continue;

      for (let dy = -colH; dy <= 1; dy++) {
        const v = -dy / Math.max(1, colH); // 0 at floor .. 1 at top crest
        const dVal = (1 - v * 0.72) * env + (n2 - 0.5) * 0.32;
        if (dVal < 0.18) continue;
        let col = Cap[2];
        if (v > 0.78) col = n2 > 0.58 ? Bio[4] : Cap[5];
        else if (v > 0.48) col = n1 > 0.55 ? Bio[3] : Cap[4];
        else if (v > 0.22) col = Cap[3];
        else col = Cap[1];
        p.blend(X_TARGET + dx, dy, col, fade * clamp(dVal * 1.15, 0.25, 0.88));
      }
    }

    // 2. Rolling venomous gasPuffs boiling above the miasma sheet
    for (let i = 0; i < 20; i++) {
      const r = rng(seed, i, 509);
      const side = i % 2 === 0 ? -1 : 1;
      const radialFrac = Math.pow(i / 20, 0.78);
      const dist = side * radialFrac * (poolRx - 2) + r.range(-3, 3);
      const gx = X_TARGET + dist + Math.sin(hitAge * 6 + i) * 2.2;
      const gy = -3 - (1 - radialFrac * 0.5) * r.range(5, 22) * spread - hitAge * r.range(4, 12);
      const grad = r.range(4.2, 8.5) * Math.sin(Math.min(1, hu * 1.35) * Math.PI);
      gasPuff(
        p,
        gx,
        gy,
        grad,
        fade * 0.76,
        Cap[1],
        i % 4 === 0 ? Bio[2] : Cap[3],
        i % 3 === 0 ? Bio[3] : Cap[5],
        i % 2 === 0 ? Bio[4] : Cap[6]
      );
    }

    // 3. Twisting vertical toxic miasma ribbons rising from the poison cloud (like `nature/poison-cloud.js`)
    for (let w = 0; w < 5; w++) {
      const r = rng(seed, w, 577);
      const baseX = X_TARGET + (w - 2) * 14 * spread + r.range(-3, 3);
      const wispH = r.range(16, 30) * spread * (1 - 0.2 * hu);
      const phase = r.range(0, TAU) + hitAge * 7;
      for (let s = 0; s < wispH; s++) {
        const wu = s / wispH;
        const wx = baseX + Math.sin(phase + wu * 4.8) * (2.5 + 3.5 * wu);
        const wy = -4 - s;
        const wa = fade * (1 - wu) * 0.78;
        p.dot(wx, wy, wu > 0.65 ? Bio[4] : Cap[5], wa);
      }
    }

    // 4. Twinkling toxic spore motes & sparkles floating out of the hit miasma
    for (let i = 0; i < 22; i++) {
      const r = rng(seed, i, 613);
      const a = r.range(-Math.PI, 0);
      const d = r.range(6, 48) * spread;
      const sx = X_TARGET + Math.cos(a) * d;
      const sy = -3 + Math.sin(a) * d * 0.62 - hitAge * r.range(8, 24);
      const tw = 0.5 + 0.5 * Math.sin(hitAge * 20 + i * 1.7);
      if (tw > 0.60 && i % 3 === 0) {
        sparkle(p, sx, sy, 2.2 * fade, WHITE, i % 2 === 0 ? Bio[4] : Cap[5], 0.52 * fade);
      } else {
        p.dot(sx, sy, i % 2 === 0 ? Bio[4] : Cap[6], fade * tw * 1.2);
        p.glow(sx, sy, 4.5, Bio[3], 0.30 * fade * tw);
      }
    }
  }
}

// 4. WITHERING ASH SPORES & MYCELIAL REVIVAL RING ("变成灰白色干瘪状态")
function drawWitherAndRevivalEffects(p, Cap, Bio, P, t, seed) {
  // Dry grey-white ash-spores & puff clouds wafting off the shriveled grey-white mushroom body (`3.92..4.58s`)
  if (t >= T_THUD && t < T_REVIVE) {
    const age = t - T_THUD;
    const u = age / (T_REVIVE - T_THUD);
    for (let i = 0; i < 18; i++) {
      const r = rng(seed, i, 701);
      const life = r.range(0.45, 0.72);
      const pa = age - (i / 18) * 0.24;
      if (pa <= 0 || pa >= life) continue;
      const ku = pa / life;
      const sx = P.x - r.range(-4, 34) + Math.sin(pa * 7 + i) * 2.5;
      const sy = -4 - r.range(2, 18) - pa * r.range(10, 22);
      const col = i % 2 === 0 ? WITHER_CAP[6] : WITHER_CAP[4];
      p.dot(sx, sy, col, (1 - ku) * 0.95);
    }
    // Escaping pale grey soul-spore wisp rising above the fallen mushroom
    if (u < 0.85) {
      const wx = P.x - 16 + Math.sin(age * 10) * 3;
      const wy = -18 - age * 24;
      const wa = (1 - u / 0.85) * 0.85;
      p.disc(wx, wy, 2.6, WITHER_STEM[4], wa * 0.65);
      p.px(Math.round(wx), Math.round(wy), WHITE);
    }
  }

  // Mycelial cyan-violet revival ring at `4.58..4.80s`
  if (t >= T_REVIVE) {
    const u = seg(t, T_REVIVE, D);
    const k = Math.sin(u * Math.PI);
    const rx = lerp(24, 9, u);
    for (let a = 0; a < TAU; a += 0.32) {
      p.dot(P.x + Math.cos(a) * rx, Math.sin(a) * rx * 0.24, a % 0.64 < 0.32 ? Bio[4] : Cap[5], k);
    }
    p.glow(P.x, -10, 30, Bio[3], 0.48 * k);
  }
}

export function drawBack(p, time, o) {
  const t = shift(time, D, o.seed);
  const Cap = fit(o.palette, 7);
  const Bio = fit(o.spots, 6);
  const P = mushroomPose(t);

  // Soft forest floor shadow & bioluminescent ground reflection under the mushroom
  const shX = P.x + (P.bodyRot < -0.1 ? -14 * Math.sin(-P.bodyRot) : P.stemSway * 0.4);
  const shRx = 16 + (P.bodyRot < -0.1 ? 9 * Math.sin(-P.bodyRot) : -4 * clamp(-P.y / 28, 0, 1));
  for (let y = -1; y <= 2; y++) {
    for (let x = Math.floor(shX - shRx); x <= Math.ceil(shX + shRx); x++) {
      const d = ((x - shX) / shRx) ** 2 + (y / 2.2) ** 2;
      if (d < 1) p.blend(x, y, Cap[0], 0.58 * (1 - d));
    }
  }
  if (P.bioGlow > 0.05) {
    p.glow(shX, 0, 36, Bio[2], 0.24 * P.bioGlow);
    p.glow(shX, -16, 52, Cap[3], 0.22 * P.bioGlow);
  } else if (P.wither > 0.5) {
    // Subtle pale moonlight on the fallen grey-white mushroom so its shriveled details read crisply
    p.glow(shX, -12, 36, WITHER_CAP[4], 0.18 * P.wither);
  }

  // Ambient floating forest spores drifting around the mushroom
  cycle(t, D, 18, o.seed * 13 + 7, (r) => r.range(1.2, 2.0), (ag, L, r, i) => {
    const k = ag / L;
    const x = r.range(-78, 24) + Math.sin(ag * 2.5 + i) * 3.5;
    const y = -r.range(4, 38) - ag * r.range(6, 14);
    const a = Math.min(1, k * 4) * (1 - k) * (1 - P.wither * 0.7);
    if (a <= 0.05) return;
    const tw = 0.5 + 0.5 * Math.sin(ag * 9 + i * 2.1);
    const col = i % 2 === 0 ? Bio[4] : Cap[5];
    p.dot(x, y, tw > 0.75 ? WHITE : col, a);
    p.glow(x, y, 5, col, 0.28 * a * tw);
  });
}

export function draw(p, time, o) {
  const t = shift(time, D, o.seed);
  const Cap = fit(o.palette, 7);
  const Bio = fit(o.spots, 6);
  const Stem = fit(o.stem, 6);
  const P = mushroomPose(t);

  // 1. Draw the Spore Mushroom body (plump white stem, gills, rounded purple cap with breathing cyan spots)
  const gillPos = drawSporeMushroomBody(GRID, p, Cap, Bio, Stem, P, t);

  // 2. Draw hop & collapse landing dust puffs and pebbles
  drawHopAndCollapseDust(p, t, o.seed);

  // 3. Draw Attack inhale streaks, purple spore smoke cone, glowing spore light-orbs & hit toxic cloud diffusion
  drawAttackSporeBarrageAndToxicHit(p, Cap, Bio, gillPos, t, o.seed);

  // 4. Draw Wither ash-spores & Mycelial revival ring
  drawWitherAndRevivalEffects(p, Cap, Bio, P, t, o.seed);
}
