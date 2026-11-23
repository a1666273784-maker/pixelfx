// Celestial Thunder Talisman ("moves/celestial-thunder-talisman" — 【天雷咒】):
// 1. Daoist Talisman Cast & Octagonal Seal Wheel (0.00..0.68s): The caster pinches and hurls a large yellow-paper
//    cinnabar-rune Thunder Talisman ("使用符咒释放") surrounded by an 8-talisman octagonal wheel; at (48, -66) the
//    talisman ignites in cinnabar-gold flames, shooting seal beams to the sky and floor while 4 binding talismans
//    lock around the enemy in a golden lightning cage.
// 2. Oppressive Thunderhead & Golden Eight-Trigram Sigil (0.36..0.86s): Boiling dark thunderclouds ("劫云") lit by
//    internal sheet-lightning gather at the top of the sky above the target while a rotating golden-cinnabar
//    Eight-Trigram sigil locks onto the floor below the enemy; the arena darkens as a stepped golden leader descends.
// 3. Colossal Golden Thunderbolt Cataclysm (0.86..1.72s): A colossal jagged golden lightning pillar ("巨型金色雷电"),
//    wide branching sky-forks, and twin coiling dragon-bolts slam down from the thunderhead in three devastating
//    strokes (0.86s, 1.12s, 1.38s), detonating blinding white-gold starbursts and radial ground-stabbing arcs.
// 4. Hit Result Aftermath — Lichtenberg Golden Thunder-Cracks, Residual Arcs & Ozone Smoke (1.55..4.15s):
//    After the thunder-pillar subsides, a scorched crater and branching Lichtenberg golden lightning fissures pulse
//    across the floor, spitting crawling golden electric arcs ("残余游走电弧"), charred talisman ash, and rising smoke.
// Stepped leader, multi-stroke flicker, zigzag bolt inking, Lichtenberg cracks and scorch build on Sprite Fusion's
// open-source lightning VFX (https://www.spritefusion.com/pixel-art-vfx/lightning), MIT License, Copyright (c) 2026 Hugo Duprez.
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
  fract,
  rand,
  rng,
  hex,
  TAU,
  WHITE,
  READY,
} from "../../core/index.js";
import { SOOT, SOOT2, zigzag, bend, stroke, crackle, scorch } from "../lightning/_lib.js";
import { star, stone, rock } from "../melee/_lib.js";
import { floorLight } from "../fire/_lib.js";
import { unlight } from "../shadow/_lib.js";

const TALISMAN_X = 48;         // Mid-air activation X of the main Daoist Thunder Talisman
const TALISMAN_Y = -66;        // Mid-air activation Y of the main Daoist Thunder Talisman
const TX = 192;                // Enemy target X
const TOP_Y = -212;            // Sky thunderhead origin Y
const SIGIL_RX = 42;           // Target ground thunder-sigil radius
const REACH = 66;              // Lichtenberg floor crack reach
const SLIDE_1 = 10;
const SLIDE_2 = 18;
const SLIDE_3 = 24;

// Choreography timing constants (seconds)
const T_CAST = 0.08;           // Caster hurls the main Thunder Talisman forward
const T_IGNITE = 0.34;         // Main Talisman locks in mid-air, flares with cinnabar runes, and shoots skyward beam
const T_SIGIL = 0.38;          // Sky thunderhead & ground Eight-Trigram sigil unfold at TX
const T_LEADER = 0.60;         // Stepped golden lightning leader zigzags down from TOP_Y toward the target
const T_STRIKE1 = 0.86;        // 1st Colossal Golden Thunderbolt strike
const T_STRIKE2 = 1.12;        // 2nd Colossal Golden Thunderbolt strike
const T_STRIKE3 = 1.38;        // 3rd Colossal Golden Thunderbolt strike (maximum diameter & radial arcs)
const T_PILLAR_END = 1.72;     // Main thunderbolt pillar finishes dissipating into fragments
const T_END = 4.15;

const STROKES = [
  { t: T_STRIKE1, k: 1.00, wCore: 8.5 },
  { t: T_STRIKE2, k: 0.90, wCore: 7.5 },
  { t: T_STRIKE3, k: 1.12, wCore: 10.0 },
];
const FLICK = [1.0, 0.78, 0.45, 0.96, 0.60, 0.86, 0.34, 0.16];
const strokeLevel = (dtS) => (dtS < 0 ? 0 : FLICK[Math.floor(dtS * 30 + 1e-4)] ?? 0);

const SY = 0.22;
const CHAR_BLACK = hex("#08060c");

export const meta = {
  name: "Celestial thunder talisman",
  desc: "A Daoist cinnabar talisman ignites to summon dark thunderclouds and a colossal golden lightning pillar that shatters the earth with branching electric cracks and arcs.",
  tags: ["move", "boss", "lightning", "thunder", "talisman", "gold", "daoist", "spell", "ultimate", "one-shot"],
  size: [436, 268],
  origin: [88, 224],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    // 8-step Celestial Golden-Lightning ramp: deep bronze -> imperial gold -> solar yellow -> blinding white
    palette: ["#1c0d02", "#482206", "#84420a", "#c87212", "#f6aa1c", "#ffdc48", "#fff5a8", "#ffffff"],
    // 6-step Daoist Cinnabar-Vermilion & Yellow Talisman Paper ramp ("黄纸朱砂符箓")
    cinnabar: ["#2c0608", "#6e0c14", "#b81820", "#f03c28", "#ff8e48", "#ffe298"],
    // 5-step Dark Thunderhead Storm-Cloud ramp ("黑紫劫云")
    cloud: ["#07060e", "#121022", "#221e38", "#3a3458", "#625884"],
    stone: "#4a4258",
    seed: 23,
  },
};

// Daoist caster choreography: guard -> pinch talisman -> hurl talisman -> skyward seal -> thunder command slam -> recovery
const GUARD = { ...READY, x: 0, crouch: 2, lean: 1, fx: 11, fy: -21, bx: -6, by: -20, ffx: 8, fbx: -8 };
const PINCH = { ...GUARD, x: -4, crouch: 4, lean: -3, turn: 0.80, fx: -3, fy: -25, bx: 8, by: -24, armsFront: true, ffx: 6, fbx: -9 };
const CAST_TAL = { ...GUARD, x: 5, crouch: 3, lean: 4, turn: 0.45, fx: 17, fy: -27, bx: -7, by: -21, ffx: 11, fbx: -8, ghost: 1 };
const SKY_SEAL = { ...GUARD, x: 3, crouch: 2, lean: -3, turn: 0.85, hy: -2, fx: 6, fy: -38, bx: 11, by: -32, armsFront: true, ffx: 9, fbx: -9, ghost: 1 };
const THUNDER_SLAM = { ...GUARD, x: 10, crouch: 7, lean: 6, turn: 0.40, hy: 2, fx: 18, fy: -15, bx: 10, by: -17, ffx: 13, fbx: -9, toeB: true, ghost: 1 };
const CHANNEL = { ...THUNDER_SLAM, x: 11, crouch: 6, lean: 5, fx: 18, fy: -18, ghost: 0 };
const RECOVER = { ...GUARD, x: 3, crouch: 3, lean: 1, fx: 13, fy: -21 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.28, GUARD],
    [-0.08, PINCH],
    [T_CAST, CAST_TAL, "snap"],
    [T_IGNITE, SKY_SEAL, "snap"],
    [T_STRIKE1 - 0.04, { ...SKY_SEAL, fy: -40, crouch: 1 }],
    [T_STRIKE1, THUNDER_SLAM, "snap"],
    [T_STRIKE2, CHANNEL],
    [T_STRIKE3, { ...THUNDER_SLAM, x: 12, fx: 19, fy: -13, ghost: 1 }, "snap"],
    [2.35, RECOVER],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_IGNITE, stop: 0.04, shake: 0.18, amp: 2.0, target: false },
    { t: T_STRIKE1, stop: 0.17, shake: 0.54, amp: 5.6, push: 5.0, slide: SLIDE_1, straw: 38, y: -28, skin: "shock", shiver: 0.58, flash: 0.08 },
    { t: T_STRIKE2, stop: 0.07, shake: 0.40, amp: 4.6, push: 4.2, slide: SLIDE_2, straw: 26, y: -28, skin: "shock", shiver: 0.60, flash: 0.07 },
    { t: T_STRIKE3, stop: 0.10, shake: 0.52, amp: 6.0, push: 5.4, slide: SLIDE_3, daze: 1.45, straw: 38, y: -26, skin: "char", shiver: 0.65, flash: 0.08 },
    { t: 2.15, push: 0, straw: 0, flash: 0, skin: "shock", shiver: 0.35 },
    { t: T_END - 0.32, push: 0, straw: 0, flash: 0, skin: null, daze: 0, shiver: 0 },
  ],
  dust: [
    { t: T_CAST, x: 8, n: 5, dir: 1 },
    { t: T_STRIKE1, x: TX - 10, n: 12, dir: -1 },
    { t: T_STRIKE1, x: TX + 14, n: 14, dir: 1 },
    { t: T_STRIKE3, x: TX + 24, n: 14, dir: 1 },
  ],
};

// Safe local bounds inside [436, 268] with origin [88, 224] -> x in [-88..347], y in [-224..43]
const X_MIN = -82, X_MAX = 340, Y_MIN = -216, Y_MAX = 36;

// Hand-crafted Daoist Yellow-Paper & Cinnabar-Rune Talisman renderer ("黄纸朱砂天雷符", with swallowtail bottom & rune seal)
function drawDaoistTalisman(p, cx, cy, ang, len, wid, C, CN, burnU = 0, flashWhite = false) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const nx = -sa, ny = ca;
  const halfL = len * 0.5, halfW = wid * 0.5;
  const maxD = lerp(halfL, -halfL, burnU);
  if (maxD <= -halfL + 1) return;

  const bound = Math.ceil(halfL + halfW + 3);
  for (let dy = -bound; dy <= bound; dy++) {
    const py = Math.round(cy + dy);
    if (py < Y_MIN || py > Y_MAX) continue;
    for (let dx = -bound; dx <= bound; dx++) {
      const px = Math.round(cx + dx);
      if (px < X_MIN || px > X_MAX) continue;

      const d = dx * ca + dy * sa;
      const flutter = Math.sin(d * 0.42 + cy * 0.18) * 0.7;
      const w = (dx * nx + dy * ny) - flutter;
      if (d < -halfL || d > maxD || Math.abs(w) > halfW) continue;

      // Swallowtail V-notch at the bottom of the talisman (d > halfL * 0.74)
      if (d > halfL * 0.74 && Math.abs(w) < (d - halfL * 0.74) * 0.85) continue;

      if (flashWhite) {
        p.px(px, py, WHITE);
        continue;
      }

      if (burnU > 0.02 && d > maxD - 2.4) {
        p.px(px, py, d > maxD - 1.2 ? WHITE : CN[4]);
        continue;
      }

      const isBorder = Math.abs(w) > halfW - 1.1 || d < -halfL + 1.1;
      const inSpine = Math.abs(w) <= halfW * 0.54;
      const rowIdx = Math.floor(d + halfL);
      const runeStroke =
        inSpine &&
        ((rowIdx % 3 !== 0 && Math.abs(w) < 1.2) ||
          (rowIdx % 4 === 1 && Math.abs(w) < halfW * 0.50) ||
          (Math.abs(d) < 2.2 && Math.abs(w) < halfW * 0.45));

      let col;
      if (isBorder) {
        col = CN[1];
      } else if (runeStroke) {
        col = burnU > 0.01 ? CN[4] : CN[2]; // Deep vermilion-cinnabar Daoist thunder-script
      } else {
        col = Math.abs(w) < halfW * 0.25 ? C[6] : C[5]; // Rich golden-yellow talisman paper
      }
      p.px(px, py, col);
    }
  }
}

// Sinuous, translucent Ozone & Charred Thunder-Smoke Wisp ("升腾雷劫焦烟") rising from the crater in Phase 4
function drawOzoneSmokeWisp(p, x0, yBase, h, w0, swayPhase, t, uLife, C, CL, isGold) {
  const fade = Math.sin(Math.min(1, uLife * 3.2) * (Math.PI / 2)) * (1 - smooth(0.46, 1.0, uLife));
  if (fade <= 0.02 || h < 4) return;
  const rows = Math.ceil(h);
  for (let r = 0; r <= rows; r++) {
    const v = r / Math.max(1, h);
    const py = Math.round(yBase - r);
    if (py < Y_MIN + 4 || py > 2) continue;

    const sway = Math.sin(v * Math.PI * 2.1 - t * 4.8 + swayPhase) * (3.2 + 6.2 * v);
    const cx = x0 + sway + v * 4.2;
    const env = Math.sin(v * Math.PI) * (0.55 + 0.60 * v);
    const hw = w0 * env;
    if (hw < 0.6) continue;

    const ix0 = Math.max(X_MIN + 4, Math.floor(cx - hw));
    const ix1 = Math.min(X_MAX - 4, Math.ceil(cx + hw));
    for (let px = ix0; px <= ix1; px++) {
      const q = Math.abs(px - cx) / hw;
      if (q > 1) continue;
      const a = fade * (1 - q * q) * 0.44;
      if (a <= 0.02) continue;
      const col = isGold
        ? (q < 0.35 && v < 0.55 ? C[5] : q < 0.72 ? C[3] : CL[3])
        : (q < 0.38 && v > 0.35 ? CL[4] : q < 0.74 ? CL[3] : CL[2]);
      p.blend(px, py, col, a);
    }
  }
}

// Lichtenberg branching lightning-cracks across the floor around (cx, 0)
function buildLichtenbergCracks(R, cx) {
  const out = [];
  const grow = (x, y, a, len, w, d, depth) => {
    const pts = [[x, y, d]];
    for (let s = 0; s < len; s += 1.6) {
      a += R.range(-0.32, 0.32);
      x += Math.cos(a) * 1.6;
      y = clamp(y + Math.sin(a) * 0.48, -2, 8);
      d += 1.6;
      pts.push([x, y, d]);
      if (depth < 2 && s > 4 && R.chance(0.11)) {
        grow(x, y, a + R.sign() * R.range(0.5, 1.15), (len - s) * R.range(0.35, 0.65), w * 0.6, d, depth + 1);
      }
    }
    out.push({ pts, w });
  };
  for (let i = 0; i < 8; i++) {
    const a0 = i % 2 === 0 ? R.range(-0.45, 0.65) : Math.PI + R.range(-0.65, 0.45);
    grow(cx + R.range(-2, 2), R.range(0, 1), a0, REACH * R.range(0.62, 1.05), 1, 0, 0);
  }
  return out;
}

// Perspective ground shockwave ring that modulates and breaks into hand-pixelled golden thunder arcs
function drawFloorBand(p, cx, cy, r, sy, th, progress, alpha, ramp, back, hot = false) {
  if (alpha <= 0.03 || r <= 1 || th <= 0.2) return;
  const rx = r + th + 2, ry = (r + th) * sy + th * 0.6 + 1;
  const x0 = Math.max(X_MIN, Math.floor(cx - rx - 1)), x1 = Math.min(X_MAX, Math.ceil(cx + rx + 1));
  const y0 = back ? Math.max(Y_MIN, Math.floor(cy - ry - 1)) : Math.floor(cy);
  const y1 = back ? Math.floor(cy) : Math.min(Y_MAX - 2, Math.ceil(cy + ry + 1));
  const invR = 1 / r, invRsy = 1 / Math.max(0.8, r * sy);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    if (back ? dy >= 0 : dy < 0) continue;
    const ny = dy * invRsy;
    if (ny * ny > 1.75) continue;
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) * invR;
      const e = Math.hypot(nx, ny);
      if (e < 0.25) continue;
      const ang = Math.atan2(ny, nx);
      const wave = 0.72 + 0.34 * Math.sin(ang * 6 + 0.7) + 0.22 * Math.cos(ang * 10 - 1.2);
      if (progress > 0.35 && wave < (progress - 0.35) * 1.45 + 0.32) continue;
      const locTh = Math.max(0.75, th * wave);
      const grad = Math.hypot(nx * invR, ny * invRsy);
      const dist = (1 - e) / Math.max(1e-4, grad);
      if (dist < -0.5 || dist > locTh) continue;
      const u = clamp(dist / locTh);
      const col = u < 0.26 ? (hot ? WHITE : ramp[3]) : u < 0.56 ? ramp[2] : u < 0.82 ? ramp[1] : ramp[0];
      p.dot(x, y, col, alpha * (u < 0.45 ? 1.15 : 1.05 - u * 0.8));
    }
  }
}

// Helper to interpolate the X coordinate of a zigzag trunk at height y
function trunkXAtY(pts, y) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if ((y >= y0 && y <= y1) || (y >= y1 && y <= y0)) {
      const dy = y1 - y0;
      if (Math.abs(dy) < 1e-4) return x0;
      return x0 + ((y - y0) / dy) * (x1 - x0);
    }
  }
  return pts[pts.length - 1][0];
}

export function create(o) {
  const C = fit(o.palette, 8);
  const CN = fit(o.cinnabar, 6);
  const CL = fit(o.cloud, 5);
  const st = stone(o.stone);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, C[6], C[5], CN[3]],
    haze: C[4],
  });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  // Enemy current X position accounting for multi-stage knockback slide
  const enemyX = (time) => {
    if (time < T_STRIKE1) return TX;
    if (time < T_STRIKE2) return lerp(TX, TX + SLIDE_1, ease.outCubic(clamp((time - T_STRIKE1) / 0.16)));
    if (time < T_STRIKE3) return lerp(TX + SLIDE_1, TX + SLIDE_2, ease.outCubic(clamp((time - T_STRIKE2) / 0.16)));
    return lerp(TX + SLIDE_2, TX + SLIDE_3, ease.outCubic(clamp((time - T_STRIKE3) / 0.22)));
  };

  // Prebake 3 sky-to-ground Colossal Golden Lightning Bolts + twin coiling dragon-bolts + wide sky-forks
  const skyBolts = STROKES.map((_, idx) => {
    const rB = new Rng(o.seed + 101 + idx * 37);
    const xTop = TX + rB.range(-12, 12);
    const xHit = TX + (idx === 0 ? 0 : idx === 1 ? SLIDE_1 : SLIDE_2);
    const main = zigzag(rB, xTop, TOP_Y + 8, xHit, -2, 0.20, 0.85, 1.45);
    const trunk = main.paths[0].pts;
    const spiralL = bend({ paths: [{ pts: trunk, w: 1.15 }] }, (x, y) => [
      x + Math.sin((y / TOP_Y) * TAU * 2.4 + idx) * 18,
      y,
    ]);
    const spiralR = bend({ paths: [{ pts: trunk, w: 1.15 }] }, (x, y) => [
      x - Math.sin((y / TOP_Y) * TAU * 2.4 + idx) * 18,
      y,
    ]);
    // 4 wide dramatic sky-forks branching out of the main bolt
    const skyForks = Array.from({ length: 4 }, (__, fIdx) => {
      const uF = 0.22 + fIdx * 0.18;
      const ptIdx = Math.min(trunk.length - 1, Math.floor(trunk.length * uF));
      const [fx0, fy0] = trunk[ptIdx];
      const side = fIdx % 2 === 0 ? -1 : 1;
      const fx1 = fx0 + side * rB.range(34, 58);
      const fy1 = Math.min(-12, fy0 + rB.range(28, 52));
      return zigzag(rB, fx0, fy0, fx1, fy1, 0.28, 0.45, 1.0);
    });
    return { main, trunk, spiralL, spiralR, skyForks, xTop, xHit };
  });

  // Prebake 10 radial ground-stabbing golden lightning bolts erupting out from the enemy on impact
  const radialBolts = Array.from({ length: 10 }, (_, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const dist = R.range(26, 66) * side;
    const strokeIdx = i % 3;
    const t0 = STROKES[strokeIdx].t + R.range(0.0, 0.06);
    return { dist, t0, seedOff: i * 19 };
  });

  // Prebake Lichtenberg branching floor cracks
  const crackTree = buildLichtenbergCracks(R, TX + 12);

  // Prebake 16 Impact Starburst spikes (clamped downward so no spike ever exceeds y = 34)
  const hitSpikes = Array.from({ length: 16 }, (_, i) => {
    const base = (i / 16) * TAU + R.range(-0.05, 0.05);
    const vert = Math.abs(Math.sin(base));
    let mul = vert > 0.90 ? 1.75 : i % 2 === 0 ? 1.25 : 0.72;
    if (Math.sin(base) > 0.12) mul *= 0.45;
    return { a: base, len: R.range(26, 38) * mul, w: R.range(2.0, 3.2) };
  });

  // Prebake 16 Boiling Dark Thunderhead Cloud billows at the top of the sky above TX ("劫云压顶")
  const cloudBillows = Array.from({ length: 16 }, (_, i) => {
    const u = i / 15;
    const ox = lerp(-72, 76, u) + R.range(-4, 4);
    const oy = TOP_Y + 14 + Math.abs(u - 0.5) * 10 + R.range(-3, 4);
    const rad = lerp(22, 13, Math.abs(u - 0.5) * 1.6);
    return { ox, oy, rad };
  });

  // Prebake 22 Sinuous Ozone Smoke Wisps ("升腾雷劫焦烟") for Phase 4 Aftermath
  const smokeWisps = Array.from({ length: 22 }, (_, i) => {
    const uX = i / 21;
    const x0 = lerp(TX - 46, TX + 64, uX) + R.range(-4, 4);
    const t0 = R.range(1.48, 2.40);
    const life = Math.min(R.range(1.40, 2.05), T_END - 0.08 - t0);
    const hMax = R.range(42, 76);
    const w0 = R.range(4.2, 6.8);
    const phase = R.range(0, TAU);
    const isGold = i % 3 === 0;
    return { x0, t0, life, hMax, w0, phase, isGold };
  });

  // Prebake 75 Charred Talisman & Crater Ash Particles ("符灰与焦黑雷烬") rising in Phase 4
  const charredAsh = Array.from({ length: 75 }, (_, i) => {
    const x0 = TX + 12 + R.range(-56, 56);
    const y0 = R.range(-4, 1);
    const t0 = R.range(1.40, 2.65);
    const life = Math.min(R.range(1.15, 1.85), T_END - 0.08 - t0);
    const vy = -R.range(26, 66);
    const vx = R.range(-10, 12);
    const swayAmp = R.range(4.0, 9.5);
    const swayFreq = R.range(4.5, 8.0);
    const phase = R.range(0, TAU);
    const isCinnabar = i % 3 === 0;
    return { x0, y0, t0, life, vx, vy, swayAmp, swayFreq, phase, isCinnabar };
  });

  let t = 0;
  let ignited = false;
  let struckIdx = -1;

  const capLife = (l) => Math.max(0.08, Math.min(l, T_END - 0.10 - t));

  const activeStroke = () => {
    for (let i = STROKES.length - 1; i >= 0; i--) {
      if (t >= STROKES[i].t) {
        const dtS = t - STROKES[i].t;
        return { idx: i, s: STROKES[i], dtS, k: strokeLevel(dtS) * STROKES[i].k };
      }
    }
    return null;
  };

  // PHASE 1: Daoist Yellow-Paper Cinnabar Talisman Cast, 8-Talisman Wheel, Skyward Seal Beam & 4 Target-Binding Talismans
  function drawTalismanCast(p, isBack) {
    if (t >= 0.92) return;
    const f = Math.floor(t * 30 + 1e-4);

    // 1. Eight Orbiting Auxiliary Paper Talismans ("八门雷符阵") expanding around the caster & main talisman
    const orbitFade = smooth(0.02, 0.14, t) * (1 - smooth(0.58, 0.80, t));
    if (orbitFade > 0.04) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + t * 8.0;
        if ((Math.sin(a) < 0) !== isBack) continue;
        const uMove = clamp((t - T_CAST) / (T_IGNITE - T_CAST));
        const cxO = lerp(6, TALISMAN_X, ease.outCubic(uMove)) + Math.cos(a) * lerp(24, 34, uMove);
        const cyO = lerp(-26, TALISMAN_Y, ease.outCubic(uMove)) + Math.sin(a) * lerp(10, 15, uMove);
        const burnAux = clamp((t - (T_IGNITE + 0.08)) / 0.28);
        drawDaoistTalisman(p, cxO, cyO, -Math.PI * 0.5 + Math.cos(a) * 0.32, 16, 7, C, CN, burnAux, false);
        p.glow(cxO, cyO, 10, CN[3], 0.30 * orbitFade);
      }
    }

    if (isBack) return;

    // 2. Main Celestial Thunder Talisman ("主天雷符祭出 -> 悬空燃符 -> 化作金红冲天符光")
    if (t >= 0.02 && t < 0.70) {
      const uFly = clamp((t - T_CAST) / (T_IGNITE - T_CAST));
      const eFly = ease.outBack(uFly, 1.35);
      const tx = t < T_CAST ? 0 : lerp(12, TALISMAN_X, eFly);
      const ty = t < T_CAST ? -25 : lerp(-26, TALISMAN_Y, eFly);
      const tang = t < T_CAST ? -0.4 : lerp(-0.15, -Math.PI * 0.5, clamp(uFly * 1.2));
      const burnMain = t < T_IGNITE ? 0 : clamp((t - T_IGNITE) / 0.30);
      const flashMain = Math.abs(t - T_IGNITE) < 0.04;

      if (t >= T_CAST && t < T_IGNITE + 0.10) {
        for (let s = 1; s <= 5; s++) {
          const uP = clamp(uFly - s * 0.08);
          const px = lerp(12, TALISMAN_X, ease.outBack(uP, 1.35));
          const py = lerp(-26, TALISMAN_Y, ease.outBack(uP, 1.35));
          p.line(tx, ty, px, py, s === 1 ? WHITE : s % 2 === 0 ? C[5] : CN[3], (1 - s / 6) * 0.85);
        }
      }

      if (t >= T_IGNITE - 0.04) {
        const kSeal = 1 - smooth(0.54, 0.70, t);
        p.ring(tx, ty, 20 + 6 * burnMain, 1.6, CN[3]);
        p.ring(tx, ty, 13, 1.3, C[5]);
        flare(p, tx, ty, 32 * kSeal, 0.85 * kSeal, [CN[2], CN[4], C[5], WHITE]);
        const rArc = rng(o.seed, 41, f);
        for (let aIdx = 0; aIdx < 3; aIdx++) {
          const angA = rArc.range(0, TAU), lenA = rArc.range(14, 26);
          crackle(
            p,
            zigzag(rArc, tx, ty, tx + Math.cos(angA) * lenA, ty + Math.sin(angA) * lenA, 0.4, 0.3),
            0.85 * kSeal,
            C,
            0.4,
          );
        }
      }

      drawDaoistTalisman(p, tx, ty, tang, 28, 13, C, CN, burnMain, flashMain);
      p.glow(tx, ty, 28, C[5], 0.55 * (1 - burnMain * 0.7));
      p.glow(tx, ty, 18, CN[3], 0.50 * (1 - burnMain * 0.7));
    }

    // 3. Sky-Piercing & Ground-Locking Talisman Seal Beams + 4 Target-Binding Talismans ("四象锁雷符")
    if (t >= T_IGNITE && t < 0.88) {
      const uB = (t - T_IGNITE) / 0.32;
      if (uB < 1.0) {
        const fadeB = 1 - smooth(0.35, 1.0, uB);
        const reachU = ease.outQuart(clamp(uB * 2.2));
        const sx1 = lerp(TALISMAN_X, TX, reachU);
        const sy1 = lerp(TALISMAN_Y, TOP_Y + 14, reachU);
        p.beam(TALISMAN_X, TALISMAN_Y, sx1, sy1, Math.max(1.5, 5.5 * fadeB), (u, v) =>
          v < 0.38 ? WHITE : v < 0.72 ? C[5] : CN[3],
        );
        p.glowLine(TALISMAN_X, TALISMAN_Y, sx1, sy1, 14 * fadeB, C[5], 0.55 * fadeB);

        const gx1 = lerp(TALISMAN_X, TX, reachU);
        const gy1 = lerp(TALISMAN_Y, 0, reachU);
        p.beam(TALISMAN_X, TALISMAN_Y, gx1, gy1, Math.max(1.2, 4.0 * fadeB), (u, v) =>
          v < 0.40 ? WHITE : v < 0.75 ? CN[4] : C[4],
        );
      }

      // 4 Binding Talismans hovering around the Enemy at (TX ± 34, -44) and Sky Gate (TX ± 38, TOP_Y + 26)
      if (t >= T_SIGIL + 0.04) {
        const uLock = clamp((t - (T_SIGIL + 0.04)) / 0.16);
        const burnLock = clamp((t - (T_STRIKE1 - 0.12)) / 0.14);
        const lockPts = [
          [TX - 34, -42, -Math.PI * 0.44],
          [TX + 34, -42, -Math.PI * 0.56],
          [TX - 38, TOP_Y + 28, Math.PI * 0.42],
          [TX + 38, TOP_Y + 28, Math.PI * 0.58],
        ];
        for (const [lx, ly, lang] of lockPts) {
          drawDaoistTalisman(p, lx, ly, lang, 18 * ease.outBack(uLock, 1.4), 8, C, CN, burnLock, uLock < 0.25);
          p.glow(lx, ly, 12, C[5], 0.38 * (1 - burnLock));
        }
        // Electric binding threads connecting the 2 lower talismans across the enemy!
        if (burnLock < 0.85) {
          const rBind = rng(o.seed, 53, f);
          crackle(p, zigzag(rBind, TX - 32, -42, TX + 32, -42, 0.22, 0.3), 0.75 * (1 - burnLock), C, 0.3);
        }
      }
    }
  }

  // PHASE 2: Boiling Sky Thunderhead ("劫云"), Ground Eight-Trigram Thunder Sigil & Stepped Golden Leader
  function drawThunderheadAndSigil(p, isBack) {
    if (t < T_SIGIL) return;
    const f = Math.floor(t * 30 + 1e-4);
    const fadeEnd = 1 - smooth(2.20, 2.85, t);

    // 1. Ground Eight-Trigram Golden & Cinnabar Thunder Sigil at (TX, 0)
    if (fadeEnd > 0.03 && t < 2.20) {
      const reveal = clamp((t - T_SIGIL) / 0.22);
      const spin = t * 1.4;
      const chargeK = clamp((t - T_SIGIL) / (T_STRIKE1 - T_SIGIL));
      const fadeSig = (t < T_STRIKE1 ? 1 : 1 - smooth(T_STRIKE3, 2.15, t)) * reveal;
      const hotSig = Math.abs(t - T_STRIKE1) < 0.08 || Math.abs(t - T_STRIKE2) < 0.06 || Math.abs(t - T_STRIKE3) < 0.08;
      const keepFn = isBack ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0;

      band(
        p,
        TX,
        0.5,
        SIGIL_RX * ease.outBack(reveal, 1.25),
        SY,
        2.4,
        fadeSig * 0.92,
        hotSig ? [C[5], C[6], WHITE, WHITE] : [C[2], C[4], C[6], WHITE],
        keepFn,
      );
      band(
        p,
        TX,
        0.5,
        SIGIL_RX * 0.62 * reveal,
        SY,
        1.8,
        fadeSig * 0.88,
        hotSig ? [CN[3], C[5], WHITE, WHITE] : [CN[1], CN[3], CN[4], C[5]],
        keepFn,
      );

      for (let j = 0; j < 8; j++) {
        const a = spin + (j / 8) * TAU;
        if ((Math.sin(a) < 0) !== isBack) continue;
        const xIn = TX + Math.cos(a) * (SIGIL_RX * 0.66);
        const yIn = 0.5 + Math.sin(a) * (SIGIL_RX * 0.66) * SY;
        const xOut = TX + Math.cos(a) * (SIGIL_RX * 0.96);
        const yOut = 0.5 + Math.sin(a) * (SIGIL_RX * 0.96) * SY;
        p.line(xIn, yIn, xOut, yOut, hotSig ? WHITE : j % 2 === 0 ? C[6] : CN[4], fadeSig);
      }

      if (!isBack && t < T_STRIKE1) {
        const rStat = rng(o.seed, 61, f);
        for (let i = 0; i < Math.round(2 + 4 * chargeK); i++) {
          const a = rStat.range(0, TAU);
          const sx = TX + Math.cos(a) * SIGIL_RX * rStat.range(0.4, 1.0);
          const sy = Math.sin(a) * SIGIL_RX * SY;
          crackle(
            p,
            zigzag(rStat, sx, sy, sx + rStat.range(-4, 4), sy - rStat.range(8, 22) * (0.5 + chargeK), 0.42, 0.3),
            0.55 + 0.45 * chargeK,
            C,
            0.35,
          );
        }
        for (let k = -2; k <= 2; k++) {
          if (k === 0) continue;
          const lx = TX + k * 14;
          const ph = fract(t * 7 + k * 0.25);
          const ly0 = lerp(-4, -95, ph);
          p.line(lx, ly0, lx, ly0 - 18 * chargeK, k % 2 === 0 ? C[5] : CN[4], 0.68 * chargeK);
        }
      }
    }

    if (isBack) return;

    // 2. Boiling Dark Thunderhead Cloud Deck & Sky Thunder-Gate Array at (TX, TOP_Y + 14) ("劫云压顶")
    if (t < 2.35) {
      const cloudIn = smooth(T_SIGIL, T_SIGIL + 0.24, t);
      const cloudOut = 1 - smooth(1.75, 2.35, t);
      const cAlpha = cloudIn * cloudOut;
      if (cAlpha > 0.03) {
        const curS = activeStroke();
        const sheetFlash = curS ? curS.k : t > T_LEADER && t < T_STRIKE1 ? 0.4 * Math.abs(Math.sin(t * 35)) : 0;

        for (let i = 0; i < cloudBillows.length; i++) {
          const cb = cloudBillows[i];
          const cx = TX + cb.ox + Math.sin(t * 2.5 + i) * 2.5;
          const cy = Math.max(Y_MIN + cb.rad + 2, cb.oy);
          const r = cb.rad * cloudIn;
          p.disc(cx, cy, r, CL[1], (d) => 0.85 * (1 - d * d) * cAlpha);
          p.disc(cx, cy + 2, r * 0.78, CL[2], (d) => 0.78 * (1 - d * d) * cAlpha);
          if (sheetFlash > 0.15 && Math.abs(cb.ox) < 42) {
            p.disc(cx, cy + 3, r * 0.62, C[4], (d) => 0.42 * sheetFlash * (1 - d * d) * cAlpha);
          }
        }

        // Sheet lightning crackling inside the dark thunderclouds!
        if (sheetFlash > 0.1) {
          const rCloud = rng(o.seed, 71, f);
          for (let cIdx = 0; cIdx < 2; cIdx++) {
            const x0 = TX + rCloud.range(-48, 10), x1 = x0 + rCloud.range(24, 48) * (cIdx === 0 ? 1 : -1);
            const y0 = TOP_Y + rCloud.range(10, 22), y1 = TOP_Y + rCloud.range(12, 24);
            crackle(p, zigzag(rCloud, x0, y0, x1, y1, 0.32, 0.4), sheetFlash * cAlpha, C, 0.35);
          }
        }

        band(
          p,
          TX,
          TOP_Y + 18,
          46 * cloudIn,
          0.22,
          2.6,
          cAlpha * 0.92,
          [CN[2], C[4], C[6], WHITE],
        );
        p.glow(TX, TOP_Y + 18, 48, C[4], (0.30 + 0.38 * sheetFlash) * cAlpha);
      }
    }

    // 3. Stepped Golden Lightning Leader feeling down from the Thunderhead (T_LEADER = 0.60 .. T_STRIKE1 = 0.86s)
    if (t >= T_LEADER && t < T_STRIKE1) {
      const uLead = clamp((t - T_LEADER) / (T_STRIKE1 - T_LEADER));
      stroke(p, skyBolts[0].main, 0.82, C, 0.9, { upTo: ease.inQuad(uLead), light: 0.4 });
      if (uLead > 0.45) {
        const rUp = rng(o.seed, 77, f);
        crackle(p, zigzag(rUp, TX, -2, TX + rUp.range(-6, 6), -lerp(12, 48, (uLead - 0.45) / 0.55), 0.35, 0.4), 0.85, C, 0.45);
      }
    }
  }

  // PHASE 3: Colossal Jagged Golden Thunderbolt Pillar, Coiling Dragon-Bolts, Sky-Forks & Radial Ground Arcs
  // ("巨型金色雷电命中，展现压迫感")
  function drawColossalGoldenThunderbolt(p) {
    const cur = activeStroke();
    if (!cur || t >= T_PILLAR_END + 0.35) return;
    const ex = enemyX(t);

    // 1. Towering Jagged Golden Lightning Pillar following the actual Zigzag Bolt Trunk + Coiling Dragon-Bolts + Sky-Forks
    if (t < T_PILLAR_END) {
      const boltData = skyBolts[cur.idx];
      const k = cur.k;
      const isHero = cur.dtS < 0.045;
      const collapseU = t < T_STRIKE3 + 0.14 ? 0 : clamp((t - (T_STRIKE3 + 0.14)) / (T_PILLAR_END - (T_STRIKE3 + 0.14)));
      const wCore = cur.s.wCore * (0.55 + 0.50 * k) * (1 - ease.inQuad(collapseU));

      if (wCore > 1.0) {
        for (let y = TOP_Y + 14; y <= 0; y++) {
          const v = (y - (TOP_Y + 14)) / Math.max(1, -(TOP_Y + 14));
          // Follow the actual jagged zigzag trunk path so the entire giant golden lightning bolt kinks and zigzags!
          const cx = trunkXAtY(boltData.trunk, y);
          const footFlare = 1 + 0.65 * Math.pow(Math.max(0, v - 0.84) / 0.16, 2);
          const jagW = 0.82 + 0.36 * Math.sin(y * 0.42 - t * 75 + cur.idx);
          const hw = wCore * footFlare * jagW;

          const x0 = Math.max(X_MIN, Math.floor(cx - hw));
          const x1 = Math.min(X_MAX, Math.ceil(cx + hw));
          for (let x = x0; x <= x1; x++) {
            const q = Math.abs(x - cx) / hw;
            if (q > 1.05) continue;
            if (q > 0.78 && Math.sin(x * 2.1 + y * 0.75 - t * 85) < 0.1) continue;

            let col;
            if (q < 0.36 || (isHero && q < 0.62)) {
              col = WHITE;
            } else if (q < 0.64) {
              col = C[6];
            } else if (q < 0.86) {
              col = C[5];
            } else {
              col = C[4];
            }
            p.px(x, y, col);
          }

          if ((y & 15) === 0) {
            p.glow(cx, y, hw * 2.0 + 6, C[5], 0.24 * k * (1 - collapseU));
          }
        }
      }

      // Overlay the heavy forked main bolt, 4 wide sky-forks, and twin coiling Dragon-Bolts!
      if (k > 0.12) {
        stroke(p, boltData.main, k, C, isHero ? 2.2 : 1.75, { hero: isHero, core: 1.5, light: 0.30, minY: TOP_Y + 12 });
        stroke(p, boltData.spiralL, k * 0.92, C, 1.35, { hero: isHero, light: 0.22, minY: TOP_Y + 12 });
        stroke(p, boltData.spiralR, k * 0.92, C, 1.35, { hero: isHero, light: 0.22, minY: TOP_Y + 12 });
        for (const sf of boltData.skyForks) {
          stroke(p, sf, k * 0.88, C, 1.15, { hero: isHero, light: 0.20, minY: TOP_Y + 12 });
        }
      }
    }

    // 2. Radial Ground-Stabbing Secondary Golden Bolts at the Enemy
    for (const rb of radialBolts) {
      const ba = Math.floor((t - rb.t0) * 30 + 1e-4);
      if (t < rb.t0 || ba < 0 || ba >= 6) continue;
      const kR = FLICK[ba];
      const rRad = rng(o.seed, 88, rb.seedOff, ba >> 1);
      const bx1 = clamp(ex + rb.dist, X_MIN + 12, X_MAX - 12);
      stroke(p, zigzag(rRad, ex, -22, bx1, -1, 0.28, 0.55), kR, C, ba === 0 ? 1.15 : 0.85, { hero: ba === 0, light: 0.28 });
      p.circle(bx1, -1, 2.5 * kR + 1, C[5]);
      p.px(bx1, -1, WHITE);
    }

    // 3. Blinding Golden-White Hit-Flash Starbursts on each of the 3 Thunder-Strokes
    for (const [idx, s] of STROKES.entries()) {
      const dtF = t - s.t;
      if (dtF >= 0 && dtF < 0.12) {
        const kF = 1 - dtF / 0.12;
        const radMul = idx === 2 ? 1.05 : idx === 0 ? 0.95 : 0.82;
        const sc = ease.outQuad(1 - kF * 0.45) * radMul;
        star(p, ex, -24, hitSpikes, sc, kF, WHITE, C[5], CN[3], C[2]);
        if (dtF < 0.06) {
          p.disc(ex, -24, 18 * kF * radMul, WHITE, (d) => 0.78 * (1 - d * d) * kF);
        }
        flare(p, ex, -24, 40 * kF * radMul, kF, [CN[3], C[4], C[6], WHITE]);
        sparkle(p, ex, -24, 20 * kF * radMul, WHITE, C[5], kF);
        p.glow(ex, -24, 38 * kF * radMul, WHITE, 0.55 * kF);
      }
    }
  }

  // PHASE 4: Hit Result Aftermath — Scorched Crater, Glowing Golden Lichtenberg Cracks, Crawling Residual Arcs & Ozone Smoke
  function drawAftermathCraterAndArcs(p, isBack) {
    if (t < T_STRIKE1) return;
    const ex = enemyX(t);
    const fadeEnd = 1 - smooth(T_END - 0.65, T_END - 0.06, t);
    if (fadeEnd <= 0.02) return;
    const f = Math.floor(t * 30 + 1e-4);

    // 1. Multi-layer Ground Shockwave Rings on each of the 3 Thunder-Strokes
    for (const [tRing, rMax, rampCols] of [
      [T_STRIKE1, 94, [C[2], C[4], C[6], WHITE]],
      [T_STRIKE1 + 0.04, 72, [CN[1], CN[3], C[5], WHITE]],
      [T_STRIKE2, 86, [C[2], C[5], C[6], WHITE]],
      [T_STRIKE3, 106, [CN[2], C[4], C[6], WHITE]],
    ]) {
      const dtR = t - tRing;
      if (dtR >= 0 && dtR < 0.48) {
        const uR = dtR / 0.48;
        drawFloorBand(
          p,
          TX + 12,
          1,
          rMax * ease.outQuart(uR),
          SY,
          Math.max(1.2, 6.4 * (1 - uR)),
          uR,
          (1 - uR) * 0.95,
          rampCols,
          isBack,
          uR < 0.20,
        );
      }
    }

    if (isBack) {
      // 2. Scorched Crater & Lichtenberg Golden Lightning-Tree Floor Fissures ("焦黑雷坑与树枝状金色雷纹地裂")
      const front = REACH * ease.outCubic(clamp((t - T_STRIKE1) / 0.36));
      const pulse = 0.76 + 0.24 * Math.sin(t * 11);
      const curS = activeStroke();
      const elec = curS && curS.dtS < 0.16 ? curS.s.k * (1 - curS.dtS / 0.16) : 0;
      const heatBase = clamp(1 - (t - T_STRIKE3) / 2.45) * fadeEnd;

      scorch(p, TX + 12, 0, 26 * fadeEnd, heatBase * 0.85, fadeEnd);

      for (const br of crackTree) {
        for (const [x, y, d] of br.pts) {
          if (d > front) break;
          const q = d / REACH;
          const n = rand(Math.round(x * 2), Math.round(y * 2), 9);
          const fresh = d > front - 7 && front < REACH;
          const T = heatBase * (1.15 - q * 0.75) * (br.w < 1 ? 0.85 : 1) * pulse - n * 0.18;
          let col;
          if (fresh || (elec > 0.3 && n < 0.85)) {
            col = q < 0.48 ? WHITE : C[6];
          } else if (T > 0.62) {
            col = C[6];
          } else if (T > 0.40) {
            col = C[5];
          } else if (T > 0.22) {
            col = C[4];
          } else if (T > 0.10) {
            col = CN[2];
          } else {
            col = SOOT2;
          }
          p.dot(x, y + 1, SOOT, fadeEnd);
          p.dot(x, y, col, fadeEnd);
          if ((fresh || T > 0.25) && (Math.round(d) & 7) === 0) {
            p.glow(x, y, 8, C[5], 0.32 * Math.max(elec, T) * fadeEnd);
          }
        }
      }

      floorLight(p, TX + 12, 2, 74 * fadeEnd, 10, C[5], 0.48 * pulse * fadeEnd);
      floorLight(p, TX + 12, 2, 42 * fadeEnd, 6, CN[3], 0.38 * pulse * fadeEnd);
    }

    // 3. Sinuous Rising Ozone & Charred Thunder-Smoke Wisps ("升腾雷劫焦烟")
    for (let i = 0; i < smokeWisps.length; i++) {
      if ((i % 2 === 0) !== isBack) continue;
      const sw = smokeWisps[i];
      if (t < sw.t0 || t >= sw.t0 + sw.life) continue;
      const age = t - sw.t0;
      const u = age / sw.life;
      const curH = sw.hMax * ease.outQuad(Math.min(1, u * 1.4));
      const yBase = -1 - age * 15;
      drawOzoneSmokeWisp(p, sw.x0, yBase, curH, sw.w0, sw.phase, t, u, C, CL, sw.isGold);
    }

    if (isBack) return;

    // 4. Crawling Residual Golden Electric Arcs across the Crater & Enemy ("残余游走金色电弧")
    if (t >= T_STRIKE1 + 0.18 && t < T_END - 0.35) {
      const kArc = (1 - smooth(T_STRIKE3 + 0.3, T_END - 0.35, t)) * fadeEnd;
      if (kArc > 0.08) {
        const rRes = rng(o.seed, 93, f);
        const nArcs = t < 2.4 ? 4 : 2;
        for (let a = 0; a < nArcs; a++) {
          const onEnemy = a === 0 && t < 2.8;
          const ax0 = onEnemy ? ex + rRes.range(-10, 10) : TX + 12 + rRes.range(-48, 48);
          const ay0 = onEnemy ? -rRes.range(6, 34) : -rRes.range(0, 6);
          const ang = rRes.range(-Math.PI * 0.9, -Math.PI * 0.1);
          const len = rRes.range(10, 24);
          crackle(
            p,
            zigzag(rRes, ax0, ay0, ax0 + Math.cos(ang) * len, ay0 + Math.sin(ang) * len, 0.42, 0.35),
            0.85 * kArc,
            C,
            0.40 * kArc,
          );
        }
      }
    }

    // 5. Rising Charred Talisman & Crater Ash Particles ("飘起焦黑符灰与金色雷烬")
    for (const ca of charredAsh) {
      if (t < ca.t0 || t >= ca.t0 + ca.life) continue;
      const age = t - ca.t0;
      const u = age / ca.life;
      const fadeA = Math.sin(Math.min(1, u * 4) * (Math.PI / 2)) * (1 - smooth(0.60, 1.0, u)) * fadeEnd;
      if (fadeA <= 0.06) continue;

      const sway = Math.sin(age * ca.swayFreq + ca.phase) * ca.swayAmp * u;
      const x = Math.round(ca.x0 + ca.vx * age + sway);
      const y = Math.round(ca.y0 + ca.vy * age);
      if (x < X_MIN + 4 || x > X_MAX - 4 || y < Y_MIN + 6 || y > 1) continue;

      const rimCol = ca.isCinnabar ? CN[3] : C[5];
      p.px(x - 1, y, rimCol);
      p.px(x, y + 1, C[3]);
      p.px(x, y, CHAR_BLACK);
      p.px(x + 1, y, CHAR_BLACK);
    }
  }

  return {
    update(dt) {
      t += dt;
      const ex = enemyX(t);

      // Talisman ignition burst at T_IGNITE (0.34s)
      if (!ignited && t >= T_IGNITE) {
        ignited = true;
        lights.add(TALISMAN_X, TALISMAN_Y, 64, C[5], 0.85, 0.36);
        lights.add(TALISMAN_X, TALISMAN_Y, 32, CN[3], 0.80, 0.25);
        for (let i = 0; i < 28; i++) {
          const a = R.range(0, TAU), sp = R.range(60, 180);
          ps.spawn(P.SPARK, TALISMAN_X, TALISMAN_Y, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.20, 0.46)));
        }
      }

      // Three Colossal Golden Thunderbolt Strikes (0.86s, 1.12s, 1.38s)
      for (const [i, s] of STROKES.entries()) {
        if (struckIdx >= i || t < s.t) continue;
        struckIdx = i;
        const k = s.k;
        lights.add(ex, -45, 92, C[5], 0.52 * k, 0.34);
        lights.add(ex, -12, 42, WHITE, 0.65 * k, 0.12);

        const nSparks = Math.round(54 * k);
        for (let j = 0; j < nSparks; j++) {
          const a = -Math.PI / 2 + R.range(-1.3, 1.3), sp = R.range(110, 310);
          ps.spawn(P.SPARK, ex + R.range(-8, 8), -4, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.24, 0.64)));
        }
        for (let j = 0; j < Math.round(14 * k); j++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(70, 185);
          ps.spawn(P.STAR, ex + R.range(-10, 10), -8, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.35, 0.82)), j % 2 === 0 ? WHITE : C[5], R.range(1.1, 2.3));
        }
        if (i !== 1) {
          for (let j = 0; j < 12; j++) {
            const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(85, 220);
            bits.add({
              kind: B.CHUNK,
              x: ex + R.range(-10, 10),
              y: -2,
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp,
              g: 1,
              drag: 0.4,
              bounce: 0.35,
              life: capLife(R.range(1.2, 2.0)),
              a: R.range(0, TAU),
              va: R.range(-14, 14),
              s: R.int(1, 3),
            });
          }
        }
        for (let j = 0; j < 8; j++) {
          const side = R.sign();
          ps.spawn(P.SMOKE, ex + side * R.range(4, 16), -R.range(2, 6), side * R.range(40, 110), -R.range(8, 28), capLife(R.range(0.75, 1.40)), CL[3], R.range(3.8, 6.2), R.range(0, 0.06), PF.BIG);
        }
      }

      // Continuous rising golden embers & sparks from the Lichtenberg cracks in Phase 4 Aftermath
      if (t > T_STRIKE3 && t < T_END - 0.65 && R.chance(0.60)) {
        const mx = TX + 12 + R.range(-52, 52);
        if (R.chance(0.6)) {
          ps.spawn(P.EMBER, mx, -2, R.range(-10, 10), -R.range(22, 52), capLife(R.range(0.55, 1.05)), R.chance(0.6) ? C[5] : CN[3]);
        } else {
          ps.spawn(P.STAR, mx, -R.range(2, 16), R.range(-6, 6), -R.range(12, 30), capLife(R.range(0.35, 0.70)), R.chance(0.5) ? WHITE : C[6], R.range(0.9, 1.7));
        }
      }

      bits.update(dt);
      ps.update(dt);
      cullParticles(ps, X_MIN + 4, Y_MIN + 4, X_MAX - 4, Y_MAX - 4);
      cullBits(bits, X_MIN + 4, Y_MIN + 4, X_MAX - 4, Y_MAX - 4);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;

      // Oppressive arena darkening during Thunderhead charge & Colossal Golden Thunderbolt strikes ("展现压迫感")
      if (t >= T_SIGIL + 0.08 && t < T_PILLAR_END + 0.25) {
        const kDark = 0.76 * smooth(T_SIGIL + 0.08, T_STRIKE1, t) * (1 - smooth(T_STRIKE3 + 0.15, T_PILLAR_END + 0.25, t));
        if (kDark > 0.03) {
          unlight(
            p,
            -70,
            -210,
            TX + 95,
            10,
            (x, y) => {
              const dCol = Math.abs(x - TX) / 56;
              return dCol > 0.45 && y > -185;
            },
            1 - kDark,
          );
        }
      }

      drawTalismanCast(p, true);
      drawThunderheadAndSigil(p, true);
      drawAftermathCraterAndArcs(p, true);

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;

      drawTalismanCast(p, false);
      drawThunderheadAndSigil(p, false);
      drawColossalGoldenThunderbolt(p);

      for (const b of bits.list) rock(p, b, st);

      ps.draw(p, "front");
      lights.draw(p);

      drawAftermathCraterAndArcs(p, false);
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

function cullBits(bits, x0, y0, x1, y1) {
  const L = bits.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const b = L[i];
    if (b.x < x0 || b.x > x1 || b.y < y0 || b.y > y1) {
      L.splice(i, 1);
    }
  }
}
