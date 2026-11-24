// Starlight Slime ("critters/starlight-slime" — 【星空史莱姆小怪物特效】):
// A cute, bouncy cosmic-jelly critter in a seamless 2.4s loop (`loop: true`):
// 1. Translucent Water-Drop Jelly Body ("半透明果冻状的水滴形身体"): Plump rounded cheeks tapering through a
//    graceful S-curve into a cute bobbing water-drop crown (`halfW`), rendered with translucent jelly shading,
//    lower rim bounce-light, and flowing contour glass highlights ("果冻表面流动的玻璃高光").
// 2. Rotating Miniature Purple-Blue Nebula & Twinkling Inner Stars ("内部包裹着旋转的微缩紫蓝色星云" & "体内星点闪烁"):
//    A tilted 2-arm + 2-sub-arm spiral galaxy in royal purple, magenta-violet, and astral cyan-blue swirls
//    continuously inside the translucent belly, accompanied by 14 twinkling internal star-points (`+` cross
//    glints and specks) that deform elastically with the squash and stretch.
// 3. Two Glowing Bean Eyes ("两颗发光豆豆眼"): Plump, luminous star-gold & white oval bean eyes with a crisp
//    dark cosmic contrast rim and warm additive glow that blink, squint during wind-up, widen in mid-air, and
//    squeeze into `> <` on landing.
// 4. Q-Elastic Squash Wind-Up, High Jump & Instant Pancake Splat with 360° Colorful Stardust Splash Ring
//    ("到身体Q弹地向下挤压蓄力并高高蹦起、落地时瞬间压扁向四周溅开一圈彩色星尘水花的循环过程"):
//    Deep quivering squash wind-up -> high parabolic leap (`hop = 38`) pulling a goo strand -> instant flattened
//    splat on landing that erupts into a 360° perspective crown and high-arcing fountain-ring of cyan,
//    violet-pink, gold, and mint stardust water-droplets, expanding floor ripples, and damped jello spring wobble.
// Adapted from Sprite Fusion's open-source poison puddle & energy orb VFX (https://www.spritefusion.com/pixel-art-vfx),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, hex, mix, clamp, wrap, smooth, seg, ease, lerp, rng, cycle, sparkle, TAU, WHITE } from "../../core/index.js";
import { Grid, shift, curve, spring, toss, lnoise } from "./_lib.js";

export const meta = {
  name: "Starlight slime",
  desc: "A translucent water-drop slime holding a swirling purple-blue nebula and two glowing bean eyes squashes down, leaps high, and splats in a ring of colorful stardust splash.",
  tags: ["critter", "slime", "starlight", "nebula", "monster", "hop", "cute", "magic", "loop"],
  size: [160, 124],
  origin: [80, 98],
  duration: 2.4,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // 8-step Translucent Cosmic-Blue/Indigo Jelly ramp (night indigo -> deep sapphire -> astral cyan-blue -> ice gloss)
    palette: ["#08061a", "#141038", "#22246a", "#304cb2", "#4488ee", "#72ccff", "#c4f2ff", "#ffffff"],
    // 6-step Inner Rotating Purple-Blue Nebula & Colorful Stardust Splash ramp
    nebula: ["#1a0b3e", "#4e1ca0", "#9238f2", "#df68ff", "#ff8ae2", "#ffe878"],
    hop: 38,
    seed: 1,
  },
};

const D = meta.duration;
// Choreography timestamps across the 2.4s loop:
// 0.00..0.52s : Wobble settle, cute breathing & blink
// 0.52..0.94s : Q-elastic downward squash wind-up with quiver ("身体Q弹地向下挤压蓄力")
// 0.94..1.02s : Explosive upward launch stretch
// 1.02..1.68s : High parabolic jump ("并高高蹦起"), rounding at apex, stretching into falling teardrop
// 1.68..2.40s : Instant pancake splat ("落地时瞬间压扁向四周溅开一圈彩色星尘水花") & damped jello spring wobble
const T_SQ = 0.52;
const T_UP = 0.94;
const T_LIFT = 1.02;
const T_LAND = 1.68;
const SNAP = 1.11;

const W0 = 38;
const H0 = 30;
const VC = 0.34;
const G = 660;
const SY = 0.25;
const NDROP = 20;
const GRID = new Grid(-46, -94, 92, 98);

const EYE_GOLD = hex("#fff59e");
const EYE_WARM = hex("#ffcf48");
const MINT_HI = hex("#98ffe4");
const MINT_MID = hex("#34e2b4");
const GOLD_HI = hex("#fff298");
const GOLD_MID = hex("#ffbe38");

// Precomputed internal stars in normalized body-local coordinates (angle, radius, height, colorIdx, phase, freq)
// Placed in the upper dome, outer cheeks, and lower belly so they frame the two glowing bean eyes cleanly!
const INNER_STARS = [
  { a0: 0.25, r: 0.54, vy: 0.68, c: 0, ph: 0.08, freq: 3, big: true },
  { a0: 1.40, r: 0.68, vy: 0.30, c: 1, ph: 0.42, freq: 4, big: true },
  { a0: 2.50, r: 0.52, vy: 0.72, c: 2, ph: 0.78, freq: 3, big: true },
  { a0: 3.55, r: 0.70, vy: 0.24, c: 3, ph: 0.22, freq: 5, big: false },
  { a0: 4.45, r: 0.42, vy: 0.76, c: 0, ph: 0.58, freq: 4, big: true },
  { a0: 5.50, r: 0.68, vy: 0.36, c: 2, ph: 0.88, freq: 3, big: false },
  { a0: 0.88, r: 0.76, vy: 0.22, c: 1, ph: 0.31, freq: 4, big: true },
  { a0: 2.98, r: 0.72, vy: 0.56, c: 0, ph: 0.70, freq: 5, big: true },
  { a0: 4.92, r: 0.46, vy: 0.80, c: 3, ph: 0.16, freq: 3, big: false },
  { a0: 1.85, r: 0.28, vy: 0.84, c: 2, ph: 0.50, freq: 4, big: true },
  { a0: 3.88, r: 0.56, vy: 0.20, c: 1, ph: 0.64, freq: 3, big: false },
  { a0: 5.85, r: 0.76, vy: 0.28, c: 0, ph: 0.39, freq: 5, big: true },
  { a0: 0.55, r: 0.48, vy: 0.22, c: 2, ph: 0.83, freq: 4, big: false },
  { a0: 2.15, r: 0.64, vy: 0.62, c: 1, ph: 0.12, freq: 3, big: true },
];

// The slime's water-drop pose at loop time t:
// s > 0 stretched tall into a sleek teardrop, s < 0 squashed flat into a wide mochi-pancake
function pose(t, hop) {
  const age = wrap(t - T_LAND, D);
  let s = 0;
  let by = 0;
  let lean = 0;
  let round = 0.12;
  let q = -1;
  let tipBend = 0;

  if (t >= T_LIFT && t < T_LAND) {
    q = (t - T_LIFT) / (T_LAND - T_LIFT);
    by = -hop * 4 * q * (1 - q);
    // Stretch tall on launch, round out into a buoyant floating water-drop at apex, stretch again as it plunges
    s = curve(q, [
      [0.00, 0.42],
      [0.34, 0.04],
      [0.52, -0.05],
      [0.78, 0.12],
      [1.00, 0.28],
    ]);
    round = 0.14 + 0.82 * smooth(0, 0.18, q) * (1 - smooth(0.84, 1, q));
    tipBend = Math.sin(q * TAU) * 1.8;
  } else if (t >= T_UP && t < T_LIFT) {
    const u = seg(t, T_UP, T_LIFT);
    s = lerp(-0.38, 0.42, ease.outCubic(u));
    tipBend = -1.4 * u;
  } else if (t >= T_SQ && t < T_UP) {
    // Q-elastic downward squash wind-up with excited high-frequency jelly tremor
    const u = seg(t, T_SQ, T_UP);
    s = -0.38 * ease.inOutSine(u) + 0.025 * Math.sin(t * TAU * 15) * smooth(0.45, 1, u);
    lean = 0.024 * Math.sin(t * TAU * 10) * smooth(0.4, 1, u);
    tipBend = 1.6 * Math.sin(t * TAU * 8) * u;
  } else {
    // Instant pancake splat at age 0..0.075 (catches frame 52 cleanly!), then damped jello spring wobble
    s = age < 0.075 ? -0.52 : -0.52 * spring(age - 0.075, 2.5, 4.0);
    lean = 0.085 * Math.exp(-age * 3.5) * Math.sin(age * TAU * 2.2);
    tipBend = 3.4 * Math.exp(-age * 3.3) * Math.sin(age * TAU * 2.2 - 0.55);
    if (t < T_SQ) {
      s += 0.025 * Math.sin((t / T_SQ) * TAU);
    }
  }

  const W = W0 / Math.sqrt(Math.max(0.40, 1 + s));
  const H = H0 * (1 + s);
  return { s, by, lean, round, q, age, tipBend, W, H };
}

// Half-width of the water-drop body at normalized height v (0 = base .. 1 = water-drop tip):
// Plump rounded cheeks below VC, tapering smoothly with a cute water-drop bulb at the very tip (`v > 0.88`)!
function halfW(v, P) {
  if (v < 0 || v > 1) return -1;
  const { W, H, round, s } = P;
  if (v >= VC) {
    const u = (v - VC) / (1 - VC);
    const taper = clamp(0.38 + 0.22 * s, 0.22, 0.58);
    const dome = Math.sqrt(Math.max(0, 1 - u * u));
    const drop = Math.pow(1 - u, taper);
    const tipBead = u > 0.82 ? Math.sin(((u - 0.82) / 0.18) * Math.PI) * 0.9 : 0;
    return (W / 2) * dome * drop + tipBead;
  }
  const u = (VC - v) / VC;
  const hb = v * H;
  const rc = 3.4;
  let hw = (W / 2) * Math.sqrt(Math.max(0, 1 - round * u * u));
  if (hb < rc) hw -= rc - Math.sqrt(Math.max(0, rc * rc - (rc - hb) ** 2));
  return hw;
}

// Center X of the water-drop spine at normalized height v (0..1), including body lean and teardrop tip whip
function spineX(v, P) {
  const tipU = Math.max(0, (v - 0.52) / 0.48);
  return P.lean * v * P.H + P.tipBend * tipU * tipU;
}

function inside(P, x, y) {
  const v = (P.by - 1 - y) / P.H;
  const hw = halfW(v, P);
  return hw >= 0 && Math.abs(x - spineX(v, P)) <= hw;
}

// 1. TRANSLUCENT WATER-DROP JELLY BODY, ROTATING MINIATURE PURPLE-BLUE NEBULA,
//    TWINKLING INNER STARS & FLOWING GLASS SURFACE HIGHLIGHTS
function drawJellyBodyAndNebula(g, C, N, P, t) {
  const ph = (t / D) % 1;
  const T = ph * TAU;
  const yb = P.by - 1;
  const half = P.W / 2 + 6;
  const cy = yb - P.H * 0.44;
  const cx = spineX(0.44, P);

  // Nebula center inside the belly (squashes & stretches elastically with the jelly!)
  const ncx = spineX(0.46, P);
  const ncy = yb - P.H * 0.46;
  const nrx = P.W * 0.40;
  const nry = P.H * 0.37;
  const nebSpin = T * 2; // 2 seamless rotations per loop

  g.clear();

  // Pass 1: Fill the water-drop silhouette so we can compute pixel depths (`g.depths(6)`) from the contour
  g.shade(-half, yb - P.H - 2, half, yb + 1, (x, y, o) => {
    if (!inside(P, x, y)) return 0;
    o.t = 1;
    o.a = 0.82;
    return C[2];
  });

  g.depths(6);

  // Flowing glass sheen phase along the curved surface ("果冻表面流动的玻璃高光")
  const glassFlow = T * 2;

  // Pass 2: Shade translucent jelly skin, rotating miniature purple-blue nebula, and flowing contour glass highlights
  g.recolor((x, y, col, al, tag) => {
    if (tag !== 1) return col;
    const idx = g.idx(x, y);
    const px = x + 0.5;
    const py = y + 0.5;
    const d = g.depth(x, y);
    const v = clamp((yb - py) / P.H, 0, 1);
    const sx = spineX(v, P);
    const hw = Math.max(1, halfW(v, P));
    const nx = (px - sx) / hw; // -1 left contour .. +1 right contour
    const ang = Math.atan2(py - cy, (px - cx) * (P.H / P.W));

    // Base translucent cosmic-blue jelly shell
    let c = C[2];
    let a = 0.72 + 0.08 * (1 - v);

    // Light pooled low along the bottom of the jelly (bounced up from the starlight puddle)
    if (v < 0.22 && d >= 2 && d <= 3) {
      c = d === 2 ? C[5] : C[4];
      a = 0.88;
    } else if (d === 1) {
      // Rim step just inside the 1px outline: bright cyan-blue on top-left, deep sapphire on bottom-right
      if (nx < 0.18 && v > 0.20) {
        c = v > 0.56 && nx < -0.18 ? C[5] : C[4];
        a = 0.90;
      } else {
        c = C[1];
        a = 0.94;
      }
    } else if (d === 2) {
      c = nx < 0 && v > 0.28 ? C[4] : nx > 0.35 && v < 0.5 ? C[3] : C[2];
      a = 0.84;
    } else {
      // Deep translucent interior cavity (`d >= 3`) where the miniature purple-blue nebula swirls!
      const dx = (px - ncx) / Math.max(3, nrx);
      const dy = (py - ncy) / Math.max(3, nry);
      const tilt = 0.18 * Math.sin(T);
      const tx = dx * Math.cos(tilt) - dy * Math.sin(tilt);
      const ty = (dx * Math.sin(tilt) + dy * Math.cos(tilt)) * 1.12;
      const nr = Math.hypot(tx, ty);
      const na = Math.atan2(ty, tx);

      if (nr < 1.05) {
        // Crisp 2-arm + 2-sub-arm logarithmic spiral galaxy swirling inside the belly:
        // Arm A is vivid royal-purple / magenta (`N[2]..N[4]`), Arm B is electric astral-blue / cyan (`C[4]..C[6]`)!
        // Notice the center uses rich violet-magenta (`N[3]`) instead of white-gold so the TWO GLOWING BEAN EYES
        // have exclusive golden-white contrast and never look like three eyes!
        const spiralAngle = na - nebSpin - nr * 4.2;
        const armWave = Math.cos(spiralAngle * 2);
        const subWave = Math.sin(spiralAngle * 2 - nr * 2.4);
        const wisp = lnoise(t, D, 4, nr * 2.2 + na * 0.5, 11) * 0.20;
        const armStrength = (0.5 + 0.5 * armWave + 0.25 * subWave + wisp) * (1 - nr * 0.55);

        if (nr < 0.18) {
          c = armWave > 0 ? N[3] : C[5];
          a = 0.88;
        } else if (armStrength > 0.52) {
          const isPurpleArm = Math.cos(spiralAngle) > 0;
          if (isPurpleArm) {
            c = armStrength > 0.72 ? N[4] : armStrength > 0.60 ? N[3] : N[2];
          } else {
            c = armStrength > 0.72 ? C[6] : armStrength > 0.60 ? C[5] : C[4];
          }
          a = 0.85;
        } else if (armStrength > 0.34) {
          c = subWave > 0 ? N[1] : C[3];
          a = 0.78;
        } else {
          // Deep cosmic night-indigo void between spiral arms so the nebula arms and stars pop with high contrast!
          c = nr < 0.75 ? N[0] : C[1];
          a = 0.76;
        }
      } else {
        c = v > 0.68 ? C[3] : C[2];
        a = 0.78;
      }
    }

    // FLOWING GLASS HIGHLIGHTS ON THE JELLY SURFACE ("果冻表面流动的玻璃高光"):
    // 1) Primary curved glass highlight ribbon hugging the upper-left water-drop contour (`d == 2 || d == 3`)
    if ((d === 2 || d === 3) && ang > -2.80 && ang < -1.38 && nx < -0.14) {
      const wave = 0.5 + 0.5 * Math.sin(ang * 3.6 - glassFlow + v * 3.0);
      if (d === 2 && ang > -2.58 && ang < -1.58) {
        c = wave > 0.32 ? WHITE : C[6];
        a = 0.98;
      } else if (wave > 0.45) {
        c = C[6];
        a = 0.92;
      }
    }

    // 2) Flowing curved meniscus sheen arc gliding down the outer left & upper dome (`d == 3 || d == 4`, never over the eyes)
    if ((d === 3 || d === 4) && (nx < -0.45 || v > 0.66)) {
      const arcWave = Math.sin(v * 6.5 - glassFlow * 1.5 + nx * 2.0);
      if (arcWave > 0.78) {
        c = arcWave > 0.92 ? WHITE : C[6];
        a = 0.92;
      }
    }

    // 3) Secondary bottom-right rim catch-light (refracted starlight sliding along the lower right cheek)
    if ((d === 2 || d === 3) && ang > 0.20 && ang < 1.42 && nx > 0.28) {
      const rimWave = 0.5 + 0.5 * Math.cos(ang * 3.0 + glassFlow);
      if (rimWave > 0.32) {
        c = d === 2 && rimWave > 0.68 ? WHITE : rimWave > 0.52 ? C[6] : C[5];
        a = 0.92;
      }
    }

    // 4) Cute glowing droplet crown tip at the very top of the water-drop (`v > 0.87`)
    if (v > 0.87 && d <= 2) {
      c = v > 0.93 ? WHITE : C[6];
      a = 0.96;
    }

    g.a[idx] = a;
    return c;
  });

  // Secondary glossy window-reflection bead tucked below the upper-left glass ribbon
  const hx = Math.round(spineX(0.62, P) - halfW(0.62, P) * 0.58);
  const hy = Math.round(yb - P.H * 0.62 + Math.sin(glassFlow) * 0.8);
  if (inside(P, hx, hy) && inside(P, hx + 1, hy + 1)) {
    g.set(hx, hy, WHITE, 0.98);
    g.set(hx + 1, hy, C[6], 0.95);
    g.set(hx, hy + 1, C[6], 0.92);
  }

  // TWINKLING INTERNAL STAR POINTS ("体内星点闪烁的细节特效")
  for (let i = 0; i < INNER_STARS.length; i++) {
    const st = INNER_STARS[i];
    const a = st.a0 + nebSpin * (i % 2 === 0 ? 0.5 : -0.5);
    const v = clamp(st.vy + Math.sin(a) * 0.14, 0.16, 0.85);
    const hw = halfW(v, P);
    if (hw < 3) continue;
    const sx = Math.round(spineX(v, P) + Math.cos(a) * hw * st.r * 0.82);
    const sy = Math.round(yb - v * P.H);
    if (g.depth(sx, sy) < 3) continue;

    const tw = 0.5 + 0.5 * Math.sin(T * st.freq + st.ph * TAU);
    const starCol = st.c === 0 ? N[5] : st.c === 1 ? C[6] : st.c === 2 ? N[4] : MINT_HI;

    if (tw > 0.66 && st.big) {
      // Crisp 5-pixel '+' internal star twinkle!
      g.set(sx, sy, WHITE, 1);
      if (g.depth(sx - 1, sy) >= 2) g.set(sx - 1, sy, starCol, 0.96);
      if (g.depth(sx + 1, sy) >= 2) g.set(sx + 1, sy, starCol, 0.96);
      if (g.depth(sx, sy - 1) >= 2) g.set(sx, sy - 1, starCol, 0.96);
      if (g.depth(sx, sy + 1) >= 2) g.set(sx, sy + 1, starCol, 0.96);
    } else if (tw > 0.25) {
      g.set(sx, sy, tw > 0.52 ? WHITE : starCol, 0.96);
    }
  }
}

// 2. TWO GLOWING BEAN EYES ("两颗发光豆豆眼")
// Returns the world coordinates of the two eyes so `draw()` can place tight additive star-glow on them!
function drawGlowingBeanEyes(g, C, N, P, t) {
  const yb = P.by - 1;
  const ev = 0.40;
  const ey = Math.round(yb - P.H * ev);
  const exOff = Math.max(5, Math.round(P.W * 0.18));
  const xc = Math.round(spineX(ev, P));

  const air = P.q >= 0;
  const shut = P.age < 0.16 && !air;
  const blink = t > 0.22 && t < 0.30;
  const wind = t >= T_SQ && t < T_LIFT ? seg(t, T_SQ, T_UP) : 0;
  const lookY = air ? (P.q < 0.48 ? -1 : P.q > 0.72 ? 1 : 0) : wind > 0.5 ? -1 : 0;
  const eh = clamp(Math.round(4 * (1 + P.s * 0.65) - wind * 1.5 + (air && P.q < 0.65 ? 1 : 0)), 2, 5);

  const eyeCenters = [];

  for (const side of [-1, 1]) {
    // 3px wide plump oval bean eye centered at x + 1
    const x = xc + side * exOff - (side > 0 ? 1 : 1);
    const cyEye = ey + lookY;
    eyeCenters.push([x + 1, cyEye]);

    if (shut) {
      // Cute `> <` glowing star-wink eyes on impact splat!
      const a = side < 0 ? 0 : 2;
      const b = 1;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -1; dx <= 3; dx++) {
          if (inside(P, x + dx, ey + dy)) g.set(x + dx, ey + dy, C[0], 0.98);
        }
      }
      g.set(x + a, ey - 1, EYE_GOLD, 1);
      g.set(x + b, ey - 1, EYE_WARM, 1);
      g.set(x + b, ey, WHITE, 1);
      g.set(x + (2 - a), ey, WHITE, 1);
      g.set(x + a, ey + 1, EYE_GOLD, 1);
      g.set(x + b, ey + 1, EYE_WARM, 1);
      continue;
    }

    if (blink) {
      // Glowing happy curved blink arc
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 3; dx++) {
          if (inside(P, x + dx, ey + dy)) g.set(x + dx, ey + dy, C[0], 0.98);
        }
      }
      g.set(x, ey, EYE_GOLD, 1);
      g.set(x + 1, ey - 1, WHITE, 1);
      g.set(x + 2, ey, EYE_GOLD, 1);
      continue;
    }

    const top = ey + 2 - eh + lookY;
    // Crisp dark cosmic-indigo contrast rim (`C[0]`) around each 3x(eh) rounded bean eye so it pops unmistakably!
    for (let k = -1; k <= eh; k++) {
      for (let dx = -1; dx <= 3; dx++) {
        if ((k === -1 || k === eh) && (dx === -1 || dx === 3)) continue;
        if (inside(P, x + dx, top + k)) g.set(x + dx, top + k, C[0], 0.98);
      }
    }

    // Plump 3px-wide rounded bean interior: warm golden-white starlight core (`WHITE` + `EYE_GOLD` + `EYE_WARM`)
    for (let k = 0; k < eh; k++) {
      for (let dx = 0; dx <= 2; dx++) {
        // Round off the 4 corners of the 3x(eh) bean when eh >= 4
        if (eh >= 4 && (k === 0 || k === eh - 1) && (dx === 0 || dx === 2)) {
          g.set(x + dx, top + k, EYE_WARM, 0.95);
          continue;
        }
        const isSpec = (k === 0 || k === 1) && dx <= 1;
        const cBean = isSpec ? WHITE : k === eh - 1 ? EYE_WARM : EYE_GOLD;
        g.set(x + dx, top + k, cBean, 1);
      }
    }
  }

  return eyeCenters;
}

// A rising star-bubble floats up through the jelly while resting and pops at the water-drop crown
const POP = 0.42;
function drawRisingStarBubble(g, C, N, P, t) {
  if (t > POP) return;
  const u = ease.inQuad(t / POP);
  const v = lerp(0.22, 0.88, u);
  const hw = halfW(v, P);
  const x = Math.round(spineX(v, P) + hw * lerp(0.32, 0.04, u));
  const y = Math.round(P.by - 1 - v * P.H);
  if (g.depth(x, y) >= 2) {
    g.set(x, y, WHITE, 1);
    g.set(x + 1, y, N[5], 0.95);
    g.set(x, y + 1, C[6], 0.95);
    g.set(x + 1, y + 1, N[3], 0.85);
  }
}

// 3. 360° COLORFUL STARDUST SPLASH DROPLETS ("落地时瞬间压扁向四周溅开一圈彩色星尘水花")
// Droplets arc high and wide in a full perspective ellipse around the slime in 4 vivid cosmic colors
// (cyan, violet-pink, gold, mint), land on the floor with stardust rings, and creep back into the puddle!
function stardustDroplet(i, o, age) {
  const r = rng(o.seed, i, 19);
  const theta = (i / NDROP) * TAU + r.range(-0.08, 0.08);
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);

  // Higher vy0 (`-95..-168`) so at frame 57 (`age = 0.22s`) a full ring of colorful droplets is soaring in mid-air!
  const spRadial = r.range(48, 92);
  const vy0 = -r.range(95, 168);
  const size = i % 2 === 0 ? 2 : 3;
  const colorKind = i % 4; // 0: Astral Cyan, 1: Nebula Violet-Pink, 2: Starlight Gold, 3: Aurora Mint

  const x0 = cosT * 20;
  const z0 = sinT * 20;
  const yFloor = z0 * SY + sinT * spRadial * 0.38 * SY;
  const yStart = -2.0 + z0 * SY;

  const vx = cosT * spRadial;
  const vz = sinT * spRadial * 0.55;

  const f = toss(x0, yStart, vx, vy0, age, G, yFloor);
  const z = z0 + vz * Math.min(age, f.at);
  f.z = z;
  f.size = size;
  f.colorKind = colorKind;
  f.theta = theta;
  f.yFloor = yFloor;

  if (f.landed) {
    const homeX = cosT * (W0 * 0.44);
    const homeY = z0 * SY;
    const dist = Math.hypot(f.lx - homeX, yFloor - homeY);
    const dur = Math.min(0.42, 0.16 + dist / 85);
    const u = seg(age - f.at - 0.10, 0, dur);
    const eu = ease.inOutSine(u);
    f.x = lerp(f.lx, homeX, eu);
    f.y = lerp(yFloor, homeY, eu);
    f.k = 1 - u;
    f.gone = u >= 1;
    f.splat = clamp(1 - (age - f.at) / 0.14);
    f.ringU = clamp((age - f.at) / 0.26);
  }
  return f;
}

function dropletColors(kind, C, N) {
  if (kind === 0) return [WHITE, C[6], C[5], C[4]];             // Astral Cyan
  if (kind === 1) return [WHITE, N[4], N[3], N[2]];             // Nebula Violet-Pink
  if (kind === 2) return [WHITE, GOLD_HI, GOLD_MID, N[3]];      // Starlight Gold
  return [WHITE, MINT_HI, MINT_MID, C[4]];                      // Aurora Mint
}

// Radius of the glowing star-puddle under the slime
function puddleR(t, P) {
  if (P.q >= 0) return (W0 / Math.sqrt(1.42) / 2 + 4) * (1 - 0.24 * P.q);
  const splashBoost = 13 * Math.exp(-P.age * 4.2) * (1 - Math.exp(-P.age * 38)) * (t >= T_LAND || t < T_SQ ? 1 : 0);
  return P.W / 2 + 4 + splashBoost;
}

// Draw half of the perspective colorful stardust splash wave rings on the floor (`near = true` front, `false` back)
function drawSplashWaveRing(p, C, N, age, near) {
  const waves = [
    { delay: 0.00, dur: 0.58, r0: 18, r1: 66, thick: 2.0 },
    { delay: 0.06, dur: 0.62, r0: 15, r1: 52, thick: 1.5 },
    { delay: 0.13, dur: 0.56, r0: 12, r1: 38, thick: 1.2 },
  ];
  for (let w = 0; w < waves.length; w++) {
    const wv = waves[w];
    const wa = age - wv.delay;
    if (wa < 0 || wa >= wv.dur) continue;
    const u = wa / wv.dur;
    const eu = ease.outCubic(u);
    const rx = lerp(wv.r0, wv.r1, eu);
    const ry = rx * SY;
    const fade = (1 - u) * Math.min(1, u * 12);
    const steps = Math.ceil(rx * 3.6);

    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU;
      const sinA = Math.sin(a);
      if ((sinA >= 0) !== near) continue;
      const cosA = Math.cos(a);
      const x = cosA * rx;
      const y = 1 + sinA * ry;
      const sector = Math.floor((((a + w * 0.8 + u * 2) / TAU) * 8) % 4 + 4) % 4;
      const cols = dropletColors(sector, C, N);
      const tw = 0.5 + 0.5 * Math.sin(a * 8 + u * 16 + w * 2);
      const col = u < 0.22 && tw > 0.55 ? WHITE : tw > 0.45 ? cols[1] : cols[2];
      p.dot(x, y, col, fade * (near ? 0.98 : 0.78));
      if (wv.thick > 1.4 && u < 0.55) {
        p.dot(x - cosA * 1.1, y - sinA * 0.6, cols[2], fade * 0.68);
      }
    }
  }
}

// Lush 360° liquid stardust splash crown ("向四周溅开一圈彩色星尘水花") erupting around the flattened body on landing!
function drawImpactSplashCrown(p, C, N, age, near) {
  if (age < 0 || age > 0.28) return;
  const u = age / 0.28;
  const eu = ease.outQuad(u);
  const fade = 1 - u;
  const nPetals = 16;

  for (let i = 0; i < nPetals; i++) {
    const a = (i / nPetals) * TAU + 0.15;
    const sinA = Math.sin(a);
    if ((sinA >= 0) !== near) continue;
    const cosA = Math.cos(a);
    const rInner = 19 + 8 * eu;
    const rOuter = 24 + 24 * eu;
    const x0 = cosA * rInner;
    const y0 = 1 + sinA * rInner * SY;
    const x1 = cosA * rOuter;
    const archH = (10 + (i % 3) * 5.0) * Math.sin(u * Math.PI);
    const y1 = 1 + sinA * rOuter * SY - archH;

    const cols = dropletColors(i % 4, C, N);
    p.line(x0, y0, x1, y1, (s) => (s > 0.65 ? cols[0] : s > 0.30 ? cols[1] : cols[2]), fade * 0.98);
    p.line(x0, y0 + 1, x1, y1 + 1, cols[2], fade * 0.78);
    if (u < 0.82) {
      p.px(Math.round(x1), Math.round(y1), cols[0]);
      p.px(Math.round(x1 - cosA), Math.round(y1), cols[1]);
      p.px(Math.round(x1), Math.round(y1 + 1), cols[1]);
      p.glow(x1, y1, 5.5, cols[1], 0.42 * fade);
    }
  }
}

// Helper to draw an airborne stardust water-droplet with a glossy head and sparkling comet tail
function drawAirborneStardustDroplet(p, f, cols) {
  const sv = Math.hypot(f.vx, f.vy) || 1;
  const ux = f.vx / sv;
  const uy = f.vy / sv;
  const L = Math.min(5.5, sv / 25);

  // Sparkling stardust wake behind the droplet
  p.line(f.x - ux * L, f.y - uy * L, f.x, f.y, (u) => (u > 0.5 ? cols[1] : cols[2]));
  p.dot(f.x - ux * (L + 1.8), f.y - uy * (L + 1.8), cols[1], 0.80);

  const rx = Math.round(f.x);
  const ry = Math.round(f.y);
  // Plump 2x2 or 3x2 glossy stardust droplet head
  p.px(rx, ry, cols[0]);
  p.px(rx - 1, ry, cols[1]);
  p.px(rx, ry + 1, cols[1]);
  p.px(rx - 1, ry + 1, cols[2]);
  if (f.size >= 3) {
    p.px(rx + 1, ry, cols[1]);
    p.px(rx, ry - 1, cols[0]);
  }
  p.glow(f.x, f.y, 6 + f.size, cols[1], 0.42);
}

export function drawBack(p, time, o) {
  const t = shift(time, D, o.seed);
  const C = fit(o.palette, 8);
  const N = fit(o.nebula, 6);
  const P = pose(t, o.hop);
  const age = P.age;

  // 1. The cosmic star-puddle: a low dome of shimmering astral jelly on the ground with nebula caustics
  const R = puddleR(t, P);
  const hp = Math.min(2.6, 1.0 + R * 0.055);
  for (let x = Math.floor(-R); x <= Math.ceil(R); x++) {
    const d = Math.abs(x + 0.5) / R;
    if (d > 1) continue;
    const top = -1 - Math.round(Math.sqrt(1 - d * d) * hp);
    for (let y = top; y <= 2; y++) {
      if (y > 0 && d > Math.sqrt(Math.max(0, 1 - (y / 2.5) ** 2))) continue;
      let c = y === top ? C[5] : y >= 1 ? C[1] : C[3];
      if (d > 0.86) c = y === top ? C[4] : C[2];
      // Swirling purple-gold nebula reflections & sliding glass glints on the puddle surface
      const n1 = lnoise(t, D, 6, x * 0.16, 3) + lnoise(t, D, 3, x * 0.08, 7) * 0.6;
      if (y === top && d < 0.86) {
        if (n1 > 0.56) c = C[6];
        else if (n1 < -0.35) c = N[3];
      } else if (y === top + 1 && d < 0.78) {
        const n2 = lnoise(t, D, 4, x * 0.14, 9);
        if (n2 > 0.35) c = N[4];
        else if (n2 < -0.35) c = C[4];
      }
      p.blend(x, y, c, y >= 1 ? 0.78 : 0.92);
    }
    if (d > 0.94) p.px(x, top - 1, C[0]);
  }

  // 2. Far half of the expanding stardust splash wave rings & splash crown
  if (t >= T_LAND || t < T_SQ) {
    drawSplashWaveRing(p, C, N, age, false);
    drawImpactSplashCrown(p, C, N, age, false);
  }

  // 3. Stardust bubbles swelling out of the puddle and popping into tiny colorful star flecks
  cycle(t, D, 5, o.seed * 17 + 3, (r) => r.range(0.5, 0.8), (ag, L, r, idx) => {
    const x = r.range(-0.82, 0.82) * R;
    const k = ag / L;
    const rb = r.range(1.4, 2.5) * (0.3 + 0.7 * ease.outCubic(Math.min(1, k * 1.25)));
    if (Math.abs(x) < P.W / 2 + 1 && P.q < 0) return;
    const sy = -1 - Math.round(Math.sqrt(Math.max(0, 1 - (x / R) ** 2)) * hp);
    const bCol = idx % 2 === 0 ? C[5] : N[4];
    if (k < 0.84) {
      for (let y = Math.floor(sy - rb); y <= sy; y++) {
        for (let xx = Math.floor(x - rb - 1); xx <= Math.ceil(x + rb + 1); xx++) {
          const dx = xx + 0.5 - x, dy = y + 0.5 - sy, dd = Math.hypot(dx, dy);
          if (dd > rb + 0.5) continue;
          if (dd > rb - 0.7) p.px(xx, y, dx < 0 && dy < -rb * 0.3 ? WHITE : bCol);
          else p.blend(xx, y, bCol, 0.32);
        }
      }
      p.glow(x, sy - rb * 0.5, rb * 2 + 3, bCol, 0.22);
    } else {
      const q = (k - 0.84) / 0.16;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0.6, -0.7], [-0.6, -0.7], [0, -1]]) {
        p.dot(x + dx * (2 + 3 * q), sy + dy * (2 + 3 * q), WHITE, 1.2 - q);
      }
    }
  });

  // 4. Back-half landed stardust droplets (`z < 0`) creeping back into the puddle
  for (let i = 0; i < NDROP; i++) {
    const f = stardustDroplet(i, o, age);
    if (f.z >= 0 || !f.landed || f.gone) continue;
    const cols = dropletColors(f.colorKind, C, N);
    const x = Math.round(f.x), y = Math.round(f.y);
    const w = f.size + (f.splat > 0 ? 1 : 0);
    for (let j = 0; j < w; j++) p.px(x - (w >> 1) + j, y - 1, j === 0 ? cols[0] : cols[1]);
    p.px(x, y, cols[2]);
    p.glow(x, y - 1, 5, cols[1], 0.26 * f.k);
  }

  // 5. Translucent starlight jelly strand pulled off the floor on launch; snaps into a falling bead at `SNAP`
  if (t >= T_LIFT && t < SNAP) {
    const bot = P.by - 1;
    const u = (t - T_LIFT) / (SNAP - T_LIFT);
    for (let y = Math.floor(bot); y < 0; y++) {
      const m = Math.sin(((y - bot) / Math.max(1, -bot)) * Math.PI);
      p.px(-1, y, y % 2 === 0 ? C[5] : N[4]);
      if (m * u < 0.48) p.px(0, y, C[3]);
    }
  } else if (t >= SNAP && t < SNAP + 0.32) {
    const a2 = t - SNAP;
    const ys = pose(SNAP, o.hop).by - 1;
    const f = toss(-1, ys * 0.45, 0, 0, a2, G * 1.25, -2);
    if (!f.landed) {
      p.px(-1, f.y, WHITE);
      p.px(-1, f.y - 1, C[5]);
    }
    const nub = 3 * (1 - a2 / 0.14);
    for (let j = 0; j < nub; j++) p.px(-1, P.by + j, j === 0 ? C[4] : C[5]);
  }
}

export function draw(p, time, o) {
  const t = shift(time, D, o.seed);
  const ph = (t / D) % 1;
  const T = ph * TAU;
  const C = fit(o.palette, 8);
  const N = fit(o.nebula, 6);
  const P = pose(t, o.hop);
  const yb = P.by - 1;
  const age = P.age;

  // 1. Back-half airborne stardust droplets (`z < 0`) so they fly behind the slime body
  for (let i = 0; i < NDROP; i++) {
    const f = stardustDroplet(i, o, age);
    if (f.z >= 0 || f.landed || inside(P, f.x, f.y)) continue;
    drawAirborneStardustDroplet(p, f, dropletColors(f.colorKind, C, N));
  }

  // 2. Build & draw the translucent water-drop jelly body, rotating nebula, twinkling stars, and glowing bean eyes
  const g = GRID;
  drawJellyBodyAndNebula(g, C, N, P, t);
  const eyeCenters = drawGlowingBeanEyes(g, C, N, P, t);
  drawRisingStarBubble(g, C, N, P, t);

  // 1px cosmic outline: bright ice-cyan (`C[5]`) along the top-left lit edge, deep night-indigo (`C[0]`) elsewhere
  g.outline((x, y, nx, ny) => {
    if (ny < 0 && nx <= 0 && y < yb - P.H * 0.45) return C[5];
    if (ny < 0 && y < yb - P.H * 0.78) return C[4];
    return C[0];
  }, 0.96);
  g.draw(p);

  // 3. Additive glow on the two glowing bean eyes ("两颗发光豆豆眼") and the rotating purple-blue nebula core!
  for (const [ex, ey] of eyeCenters) {
    p.glow(ex, ey, 6.5, EYE_GOLD, 0.52);
    p.glow(ex, ey, 3.2, WHITE, 0.30);
  }
  const ncx = spineX(0.46, P);
  const ncy = yb - P.H * 0.46;
  const nebPulse = 0.85 + 0.15 * Math.sin(T * 3);
  p.glow(ncx, ncy, 14, N[3], 0.26 * nebPulse);
  p.glow(ncx, ncy, 7, C[5], 0.18 * nebPulse);

  // 4. Flowing surface sparkle glints riding the glass highlight ribbon
  const glintV = 0.62 + 0.14 * Math.sin(T * 2);
  const gx = spineX(glintV, P) - halfW(glintV, P) * 0.66;
  const gy = yb - P.H * glintV;
  const glintPulse = 0.5 + 0.5 * Math.sin(T * 4 + 0.8);
  if (glintPulse > 0.35) {
    sparkle(p, gx, gy, 1.4 + 1.5 * glintPulse, WHITE, C[6], 0.45 * glintPulse);
  }
  // Extra apex star-glint on the water-drop tip at the top of the jump!
  if (P.q > 0.30 && P.q < 0.70) {
    const k = Math.sin(Math.PI * seg(P.q, 0.30, 0.70));
    sparkle(p, spineX(0.95, P), yb - P.H * 0.96, 1.8 + 2.8 * k, WHITE, GOLD_HI, 0.62 * k);
  }

  // 5. Rising star-bubble pop at the water-drop crown
  if (t >= POP && t < POP + 0.18) {
    const k = (t - POP) / 0.18;
    const bx = spineX(0.90, P);
    const by = yb - P.H - 0.5;
    for (let a = 0; a < TAU; a += 0.55) {
      p.dot(bx + Math.cos(a) * (1 + k * 3.5), by + Math.sin(a) * (1 + k * 3.5) * 0.7, k < 0.4 ? WHITE : N[5], 1.2 - k);
    }
    sparkle(p, bx, by - k * 3, 2.2 * (1 - k), WHITE, C[6], 0.45 * (1 - k));
  }

  // 6. Near-half of the expanding stardust splash wave rings, splash crown, and front droplets (`z >= 0`)
  if (t >= T_LAND || t < T_SQ) {
    drawSplashWaveRing(p, C, N, age, true);
    drawImpactSplashCrown(p, C, N, age, true);
  }

  for (let i = 0; i < NDROP; i++) {
    const f = stardustDroplet(i, o, age);
    const cols = dropletColors(f.colorKind, C, N);

    // Secondary mini-ripples where each stardust droplet plinks onto the floor
    if (f.landed && f.ringU > 0 && f.ringU < 1) {
      const rr = 1.5 + f.ringU * 7.5;
      const rf = (1 - f.ringU) * 0.90;
      for (let a = 0; a < TAU; a += 0.50) {
        p.dot(f.lx + Math.cos(a) * rr, f.yFloor + Math.sin(a) * rr * SY, cols[1], rf);
      }
      if (f.ringU < 0.38) {
        sparkle(p, f.lx, f.yFloor - 1, 2.0 * (1 - f.ringU / 0.38), WHITE, cols[1], 0.42);
      }
    }

    if (f.z < 0) continue;

    if (!f.landed) {
      if (inside(P, f.x, f.y)) continue;
      drawAirborneStardustDroplet(p, f, cols);
    } else if (!f.gone) {
      // Front-half landed stardust bead creeping back along the floor into the slime body
      const x = Math.round(f.x), y = Math.round(f.y);
      const w = f.size + (f.splat > 0 ? 1 : 0);
      for (let j = 0; j < w; j++) p.px(x - (w >> 1) + j, y - 1, j === 0 ? cols[0] : cols[1]);
      if (f.size >= 2 && f.splat <= 0) p.px(x, y - 2, cols[0]), p.px(x - 1, y - 2, cols[1]);
      p.px(x, y, cols[2]);
      const dir = Math.sign(f.lx - f.x);
      for (let j = 1; j < Math.min(8, Math.abs(f.lx - f.x)); j++) {
        p.dot(x + dir * j, y, cols[2], 0.72 - j * 0.08);
      }
      p.glow(x, y - 1, 5, cols[1], 0.30 * f.k + 0.12);
    }
  }

  // 7. Burst of twinkling 4-point stardust sparkles flung out in a ring on landing!
  if (age >= 0 && age < 0.52) {
    const u = age / 0.52;
    const eu = ease.outCubic(u);
    for (let i = 0; i < 14; i++) {
      const r = rng(o.seed, i, 77);
      const a = (i / 14) * TAU + r.range(-0.14, 0.14);
      const rad = lerp(16, r.range(38, 62), eu);
      const sx = Math.cos(a) * rad;
      const sy = 1 + Math.sin(a) * rad * SY - Math.sin(u * Math.PI) * r.range(5, 16) - u * 6;
      const tw = 0.5 + 0.5 * Math.sin(age * 24 + i * 1.9);
      const fade = (1 - u) * tw;
      const cols = dropletColors(i % 4, C, N);
      if (fade > 0.22) {
        if (i % 2 === 0 && tw > 0.55) {
          sparkle(p, sx, sy, 1.8 + 2.0 * (1 - u), WHITE, cols[1], 0.48 * fade);
        } else {
          p.dot(sx, sy, cols[0], fade * 1.15);
          p.glow(sx, sy, 4.5, cols[1], 0.32 * fade);
        }
      }
    }
  }

  // 8. Ambient twinkling stardust motes drifting upward around the slime & trailing its mid-air jump
  cycle(t, D, 14, o.seed * 13 + 5, (r) => r.range(1.1, 1.7), (ag, L, r, i) => {
    const k = ag / L;
    const born = wrap(t - ag, D);
    const P0 = pose(born, o.hop);
    const x = r.range(-32, 32) + Math.sin(ag * 2.4 + i * 1.7) * 3.5;
    const y = P0.by - r.range(2, 18) - r.range(10, 20) * ag;
    const a = Math.min(1, k * 4) * Math.min(1, (1 - k) * 2.4);
    const tw = 0.55 + 0.45 * Math.sin(ag * 9 + i * 2.3);
    const cols = dropletColors(i % 4, C, N);
    p.dot(x, y, tw > 0.78 ? WHITE : cols[1], a);
    if (tw > 0.82 && i % 3 === 0) {
      sparkle(p, x, y, 1.6 * a, WHITE, cols[1], 0.35 * a);
    } else {
      p.glow(x, y, 6, cols[1], 0.32 * a * tw);
    }
  });

  // 9. Overall cosmic lighting: soft nebula aura, floor star-pool glow, and landing impact flash
  const cx = spineX(0.42, P);
  const cy = yb - P.H * 0.45;
  const near = clamp(1 + P.by / (o.hop * 1.1));
  const R = puddleR(t, P);
  const br = 0.9 + 0.1 * Math.sin(T * 2);

  p.glow(cx * 0.5, -18, 66, N[2], 0.25 * br);
  p.glow(cx, cy, 32 + P.W * 0.3, C[4], 0.22);
  p.glow(0, -1, R * 1.25 + 6, C[4], 0.14 + 0.08 * near);
  if (t >= T_LAND || t < T_SQ) {
    p.glow(0, -2, 52, N[4], 0.46 * Math.exp(-age * 8.5));
    p.glow(0, -2, 26, C[6], 0.36 * Math.exp(-age * 12));
  }
}
