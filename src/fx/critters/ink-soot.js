// Ink Soot ("critters/ink-soot" — 【水墨煤球小怪物特效】):
// A quirky, spooky-cute sumi-ink soot sprite in a seamless 2.8s loop (`loop: true`):
// 1. Fluffy Black Soot Ball Continuously Steaming Black Smoke ("一团不断向外蒸腾黑色烟雾的毛茸茸黑球身体"):
//    A velvety pitch-black ball ringed by 28 animated furry tufts/spikes (`furRadius`) with sumi-ink wash rim
//    lighting, continuously steaming curling black ink-smoke tongues & billowing plumes (`drawSteamingBlackSmoke`).
// 2. Opening Two Goofy Bright-Yellow Big Eyes ("睁开两只呆萌的亮黄色大眼睛"):
//    Two large, expressive golden-yellow eyes (`drawGoofyYellowEyes`) crack open from the black fluff, blink
//    cutely, bulge huge with vibrating pinprick pupils when startled, and dart left and right while huddled.
// 3. Violent Startle Judder & Flinging Black Ink Splatter ("到它受惊般原地剧烈抖动身体、向四周甩出数滴黑色水墨斑点"):
//    At `t = 0.68s`, the soot sprite jolts in a frantic high-frequency body shake with bristling fur spikes,
//    spiky after-image ghosts, and startle rays, flinging 22 sumi-ink splatter drops (`inkDroplet`) outward in
//    wide radial fans that splat into multi-lobed ink blotches on the floor before sinking into the shadow.
// 4. Huddling Small & Peeking Left and Right ("后又缩成一团左右张望"):
//    At `t = 1.32s`, it shrinks into a low, round, huddled puffball and snaps its big yellow eyes left, right,
//    and left again to check if the coast is clear.
// 5. Wriggling Ground Ink Shadow & Overhead Question-Mark Light Motes
//    ("要有脚下紧贴地面的墨水影子蠕动和头顶冒出问号光点的细节特效"):
//    Underfoot, a living multi-tendril ink shadow (`drawWrigglingInkShadow`) writhes and creeps tightly along
//    the floor; overhead, glowing golden-yellow pixel Question Marks (`?`) and sparkling light motes pop and bob.
// Adapted from Sprite Fusion's open-source fire/smoke, poison puddle, and heal icon VFX
// (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { fit, clamp, wrap, smooth, seg, ease, lerp, rng, cycle, sparkle, TAU, WHITE } from "../../core/index.js";
import { Grid, shift, toss, lnoise } from "./_lib.js";
import { bitmap, icon } from "../status/_lib.js";

export const meta = {
  name: "Ink soot",
  desc: "A fuzzy black soot ball steaming ink smoke opens two big yellow eyes, shudders in fright flinging ink blotches, then huddles down peeking left and right under glowing ? motes.",
  tags: ["critter", "soot", "ink", "shadow", "monster", "cute", "spooky", "loop"],
  size: [176, 128],
  origin: [88, 102],
  duration: 2.8,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // 7-step Sumi-Ink & Moonlit Rim Wash ramp:
    // C[0..1] pitch-black ink heart, C[2..3] charcoal fur & smoke body, C[4..6] moonlit silver-indigo ink-wash rim
    palette: ["#040308", "#0c0a16", "#1a172c", "#302c4e", "#544e7e", "#8c86b8", "#ccc6f0"],
    // 6-step Goofy Bright-Yellow Eyes & Question-Mark Light Motes ramp
    eyes: ["#281404", "#7a3e08", "#e08e10", "#ffd428", "#fff388", "#ffffff"],
    seed: 1,
  },
};

const D = meta.duration;
// Choreography timestamps across the 2.8s loop:
// 0.00..0.22s : Fluffy black soot ball steaming smoke; two goofy bright-yellow eyes crack open wide
// 0.22..0.68s : Wide-eyed goofy idle, cute blink (0.44..0.51s)
// 0.68..1.30s : Startled! Violent in-place body judder ("受惊般原地剧烈抖动身体"), bristling fur, flinging black ink drops ("向四周甩出数滴黑色水墨斑点")
// 1.30..2.52s : Shrinks/huddles into a tight ball ("缩成一团"), peeking left & right ("左右张望") while question-mark light motes ("头顶冒出问号光点") pop overhead
// 2.52..2.80s : Relaxes back to normal round puffball and closes eyes briefly to loop seamlessly into 0.00s
const T_OPEN = 0.05;
const T_STARTLE = 0.68;
const T_HUDDLE = 1.30;
const T_RELAX = 2.52;

const R0 = 17.0;
const Y_BASE = -1;
const G = 640;
const SY = 0.25;
const NINK = 22;
const GRID = new Grid(-46, -80, 92, 86);

// Shaded pixel Question-Mark bitmaps (small, medium, large) for overhead question-mark light motes ("头顶冒出问号光点")
const QS = [
  [
    ".###.",
    "#...#",
    "....#",
    "..##.",
    "..#..",
    ".....",
    "..#..",
  ],
  [
    ".####.",
    "##..##",
    "....##",
    "...##.",
    "..##..",
    "..##..",
    "......",
    "..##..",
    "..##..",
  ],
  [
    ".#####.",
    "##...##",
    "##...##",
    ".....##",
    "....##.",
    "...##..",
    "...##..",
    ".......",
    "...##..",
    "...##..",
  ],
].map((rows) => bitmap(rows));

// Overhead question mark pop schedule: [t0, duration, dx, dy, maxSize]
const Q_MARKS = [
  { t0: 0.28, life: 0.38, x: 11, y: -44, big: 0 },  // Little curious '?' right after opening eyes
  { t0: 1.34, life: 0.94, x: -14, y: -36, big: 2 }, // Big '?' popping on the left as it huddles and looks left
  { t0: 1.70, life: 0.90, x: 14, y: -38, big: 2 },  // Big '?' popping on the right as it glances right
  { t0: 2.02, life: 0.68, x: 0, y: -45, big: 1 },   // Medium '?' centered overhead before settling
];

// Pose & expression state of the Ink Soot sprite at loop time t
function pose(t) {
  const ph = (t / D) % 1;
  const T = ph * TAU;

  let cx = 0;
  let by = Y_BASE;
  let rx = R0;
  let ry = R0 * 0.94;
  let bristle = 0;     // 0: soft round fur tufts .. 1: sharp bristling startle spikes
  let eyeOpen = 1;     // 0: shut in soot .. 1: wide open goofy yellow eyes, >1: giant startled eyes
  let lookX = 0;       // horizontal gaze offset (-4 left .. +4 right)
  let lookY = 0;       // vertical gaze offset
  let huddle = 0;      // 0: normal .. 1: curled/shrunk into a tight ball ("缩成一团")
  let shakeAmp = 0;    // violent startle judder amplitude

  // 1. Eye opening & closing at loop wrap so t=0..0.22 shows the eyes opening from the black soot ball!
  if (t < 0.22) {
    eyeOpen = ease.outBack(smooth(T_OPEN, 0.20, t), 1.8);
  } else if (t > T_RELAX + 0.08) {
    eyeOpen = 1 - ease.inOutSine(seg(t, T_RELAX + 0.08, D - 0.02));
  }
  // Cute blink during idle
  if (t > 0.43 && t < 0.50) {
    eyeOpen *= 1 - Math.sin(Math.PI * seg(t, 0.43, 0.50));
  }

  // 2. Body motion phases
  if (t < T_STARTLE) {
    // Phase A: Soft breathing fluffy soot ball
    const breath = Math.sin(T * 2);
    rx = R0 * (1 + 0.03 * breath);
    ry = R0 * 0.94 * (1 - 0.03 * breath);
    lookY = t > 0.28 ? -0.4 : 0;
  } else if (t >= T_STARTLE && t < T_HUDDLE) {
    // Phase B: Startled! Violent in-place body judder ("受惊般原地剧烈抖动身体")
    const u = (t - T_STARTLE) / (T_HUDDLE - T_STARTLE);
    const env = Math.sin(Math.min(1, u * 5.0) * (Math.PI / 2)) * (1 - smooth(0.78, 1.0, u));
    shakeAmp = env;

    // High-frequency multi-axis violent shiver in place
    cx = Math.sin(t * TAU * 19) * 4.6 * env + Math.cos(t * TAU * 31) * 1.8 * env;
    const hopEnv = Math.sin(clamp(u / 0.44, 0, 1) * Math.PI);
    by = Y_BASE - 7.0 * hopEnv + Math.sin(t * TAU * 25) * 2.2 * env;

    // Rapidly alternating squash/stretch during violent shake
    const stretch = Math.sin(t * TAU * 15) * 0.17 * env + 0.12 * hopEnv;
    rx = R0 * (1 - stretch * 0.55 + 0.10 * env);
    ry = R0 * 0.94 * (1 + stretch + 0.10 * env);
    bristle = env;
    eyeOpen = 1 + 0.30 * env;
    lookX = Math.sin(t * TAU * 23) * 1.3 * env;
    lookY = Math.cos(t * TAU * 27) * 1.1 * env - 0.5;
  } else if (t >= T_HUDDLE && t < T_RELAX) {
    // Phase C: Shrinks/curls into a tight little ball & peeks left and right ("后又缩成一团左右张望")
    const u = (t - T_HUDDLE) / (T_RELAX - T_HUDDLE);
    huddle = smooth(0, 0.12, u) * (1 - smooth(0.88, 1.0, u));

    // Compact, squashed-down little ball hugging the floor
    rx = R0 * (1 - 0.08 * huddle);
    ry = R0 * 0.94 * (1 - 0.25 * huddle);
    by = Y_BASE + 0.5 * huddle;
    bristle = -0.36 * huddle; // fur tucked in tight

    // Snappy left-right peeking choreography ("左右张望"):
    // 1.36..1.74s: Peek far LEFT (-4.0)
    // 1.74..2.12s: Peek far RIGHT (+4.0)
    // 2.12..2.38s: Quick peek LEFT (-2.4) then back to center (0)
    if (t < 1.36) {
      lookX = 0;
    } else if (t < 1.74) {
      lookX = -4.0 * ease.outBack(clamp((t - 1.36) / 0.09), 2.0);
    } else if (t < 2.12) {
      lookX = lerp(-4.0, 4.0, ease.outBack(clamp((t - 1.74) / 0.10), 2.0));
    } else if (t < 2.36) {
      lookX = lerp(4.0, -2.4, ease.outBack(clamp((t - 2.12) / 0.09), 1.8));
    } else {
      lookX = lerp(-2.4, 0, ease.inOutSine(clamp((t - 2.36) / 0.14)));
    }
    lookY = -0.6 * huddle;
    cx = lookX * 0.45;
    if (t > 1.71 && t < 1.76) eyeOpen *= 0.25;
  } else {
    // Phase D: Relax back to round puffball (2.52..2.80s)
    const u = (t - T_RELAX) / (D - T_RELAX);
    rx = R0 * (1 + 0.02 * Math.sin(u * Math.PI));
    ry = R0 * 0.94;
  }

  return { cx, by, cy: by - ry + 1, rx, ry, bristle, eyeOpen, lookX, lookY, huddle, shakeAmp };
}

// Radial fur tuft profile around the soot ball at angle `ang` (-PI..PI):
// 28 fuzzy tufts that wave gently in idle, bristle into long sharp spikes when startled, and tuck in when huddled!
function furRadius(ang, P, t) {
  const nTufts = 28;
  const ph = (t / D) * TAU;
  const sway = 0.22 * Math.sin(ph * 2 + ang * 3) * (1 - Math.max(0, P.bristle));
  const wave28 = 0.5 + 0.5 * Math.cos((ang + sway) * nTufts);
  const wave14 = 0.5 + 0.5 * Math.sin((ang - sway * 0.7) * 14 + ph * 3);
  const noiseWobble = lnoise(t, D, 6, ang * 2.5 + 4, 7) * 0.5 + 0.5;

  const sharpness = P.bristle > 0 ? 1.8 : 1.15;
  const spike = Math.pow(wave28, sharpness) * (0.68 + 0.32 * wave14);
  const baseAmp = 2.8 + 4.8 * Math.max(0, P.bristle) - 1.2 * Math.max(0, -P.bristle);
  return 1 + (baseAmp * spike + 0.9 * noiseWobble) / R0;
}

function insideSoot(P, x, y, t) {
  const dx = (x - P.cx) / P.rx;
  const dy = (y - P.cy) / P.ry;
  if (y > P.by + 1.2) return false;
  const d = Math.hypot(dx, dy);
  if (d > 1.52) return false;
  const ang = Math.atan2(dy, dx);
  const maxR = furRadius(ang, P, t);
  return d <= maxR;
}

// 1. WRIGGLING INK SHADOW CLINGING TO THE GROUND ("脚下紧贴地面的墨水影子蠕动")
function drawWrigglingInkShadow(p, C, E, P, t, frontPass) {
  const ph = (t / D) % 1;
  const T = ph * TAU;
  const baseRx = 24 + 5.5 * P.shakeAmp - 2.5 * P.huddle;

  if (!frontPass) {
    // Soft moonlit-indigo & warm eye-amber floor glow so the pitch-black wriggling ink shadow pops with high contrast!
    p.glow(P.cx, 1, 58, C[4], 0.30);
    if (P.eyeOpen > 0.1) {
      p.glow(P.cx + P.lookX * 1.2, 2, 28, E[2], 0.18 * Math.min(1, P.eyeOpen));
    }
  }

  const y0 = frontPass ? 0 : -4;
  const y1 = frontPass ? 7 : 1;

  for (let y = y0; y <= y1; y++) {
    for (let x = -52; x <= 52; x++) {
      const dx = x + 0.5 - P.cx * 0.65;
      const dy = (y + 0.5 - 1.2) / SY;
      const r = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);

      // 8 wriggling ink pseudopods / tendrils that slither outward and contract around the perimeter
      const tendrilWave =
        Math.sin(ang * 5 - T * 2) * 4.2 +
        Math.cos(ang * 8 + T * 3) * 2.6 +
        lnoise(t, D, 5, ang * 2.2, 19) * 3.4;
      const sideReach = Math.abs(Math.cos(ang)) > 0.72 ? 5.0 * Math.sin(T * 2 + ang * 3) : 0;
      const reach = baseRx + tendrilWave + sideReach;

      if (r <= reach) {
        const edgeDist = reach - r;
        let col = C[0];
        let a = 0.96;
        if (edgeDist < 1.35) {
          col = dy > 0 ? C[4] : C[3];
          a = 0.85;
        } else if (edgeDist < 2.6) {
          col = C[1];
          a = 0.94;
        }
        p.blend(x, y, col, a);
      }
    }
  }

  // Wriggling satellite ink-beads creeping in and out of the shadow tips along the floor
  if (frontPass) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI + 0.25 * Math.sin(T * 2 + i);
      const pulse = 0.5 + 0.5 * Math.sin(T * 2 + i * 1.7);
      const rad = (baseRx + 2.5 + 6.5 * pulse) * (i % 2 === 0 ? 1 : -1);
      const bx = Math.round(P.cx * 0.6 + Math.cos(a * 0.3) * rad);
      const by = Math.round(1 + Math.sin(i * 1.3 + T) * 1.5);
      p.px(bx, by, C[0]);
      p.px(bx + (rad > 0 ? 1 : -1), by, C[4]);
    }
  }
}

// 2. CONTINUOUSLY STEAMING BLACK INK-SMOKE ("不断向外蒸腾黑色烟雾")
const SMOKE_STREAMS = [
  [-9.5, 19, 4.2, 1],
  [9.5, 18, 4.0, 2],
  [-4.5, 25, 4.8, 3],
  [4.8, 24, 4.6, 4],
  [0.0, 29, 5.4, 5],
];

function drawSteamingBlackSmoke(p, C, P, t, backLayer) {
  // Part A: Continuous curling sumi-ink smoke streams rising directly out of the furry crown (in `backLayer`),
  // built like inside-out shadow-flame tongues (`C[4]`/`C[3]` outer ink-wash skin, `C[0]`/`C[1]` pitch-black core)
  if (backLayer) {
    const layers = [
      [1.00, 1.00, C[4], 0.55],
      [0.82, 0.90, C[3], 0.72],
      [0.62, 0.76, C[1], 0.90],
      [0.40, 0.58, C[0], 0.98],
    ];
    for (const [lw, lh, col, al] of layers) {
      for (const [dx, h0, w0, n] of SMOKE_STREAMS) {
        const h = (h0 + 6 * P.shakeAmp) * (0.82 + 0.18 * lnoise(t, D, 5, n * 2, n)) * lh;
        const sway = lnoise(t, D, 4, n * 5, n + 9) * 3.5;
        const rootX = P.cx + dx * (P.rx / R0);
        const rootY = P.cy - P.ry * 0.55;
        for (let r = 0; r <= h; r++) {
          const u = r / Math.max(1, h);
          const half = w0 * lw * Math.pow(1 - u, 0.80) + lnoise(t, D, 7, r * 0.4 + n, n + 20) * 0.8;
          if (half < 0.35) continue;
          const cx = rootX + sway * u * u + lnoise(t, D, 5, r * 0.25 + n, n + 30) * u * 1.6;
          const py = Math.round(rootY - r);
          for (let px = Math.round(cx - half); px <= Math.round(cx + half); px++) {
            p.blend(px, py, col, al * (1 - u * 0.35));
          }
        }
      }
    }
  }

  // Part B: Billowing sumi-ink smoke puffs detaching and steaming outward & upward from the fur perimeter
  cycle(t, D, 34, 107, (r) => r.range(0.75, 1.25), (age, life, r, i) => {
    if ((i % 2 === 0) !== backLayer) return;
    const u = age / life;
    const born = wrap(t - age, D);
    const P0 = pose(born);

    const ang0 = r.range(-Math.PI * 0.96, -Math.PI * 0.04);
    const spawnR = P0.rx * r.range(0.52, 0.86);
    const x0 = P0.cx + Math.cos(ang0) * spawnR;
    const y0 = P0.cy + Math.sin(ang0) * P0.ry * 0.82;

    const driftX = Math.cos(ang0) * (7 + 11 * P0.shakeAmp) * u + Math.sin(age * 5.0 + i * 1.9) * 3.2 * u;
    const riseY = -(14 + r.range(8, 18)) * u - 5 * u * u;
    const x = x0 + driftX;
    const y = y0 + riseY;

    const rad = r.range(2.4, 4.4) * (0.58 + 0.72 * Math.sin(Math.min(1, u * 1.4) * Math.PI));
    const a = Math.min(1, u * 7) * Math.pow(1 - u, 1.2) * 0.88;
    if (a <= 0.04 || rad < 0.8) return;

    p.disc(x - 0.5, y - 0.5, rad + 0.6, u < 0.4 ? C[4] : C[3], a * 0.58);
    p.disc(x + 0.2, y + 0.2, rad * 0.82, C[1], a * 0.88);
    p.disc(x + 0.4, y + 0.4, rad * 0.58, C[0], a * 0.96);
  });

  // Floating soot-motes evaporating upward off the fur tips
  if (!backLayer) {
    cycle(t, D, 24, 211, (r) => r.range(0.65, 1.15), (age, life, r, i) => {
      const u = age / life;
      const born = wrap(t - age, D);
      const P0 = pose(born);
      const ang = r.range(-Math.PI, 0);
      const x = P0.cx + Math.cos(ang) * (P0.rx + 2 + 10 * u) + Math.sin(age * 6.5 + i) * 2.5;
      const y = P0.cy + Math.sin(ang) * P0.ry - (12 + r.range(8, 18)) * u;
      const a = Math.min(1, u * 6) * (1 - u);
      p.dot(x, y, C[0], a);
      p.dot(x - 1, y - 1, u < 0.5 ? C[5] : C[4], a * 0.85);
    });
  }
}

// 3. FLUFFY BLACK SOOT BALL BODY & STARTLE AFTER-IMAGES ("毛茸茸黑球身体" & "受惊般原地剧烈抖动身体")
function drawFluffySootBody(g, p, C, P, t) {
  // During the violent startle judder (`P.shakeAmp > 0.12`), draw spiky vibrating ink after-images to left & right!
  if (P.shakeAmp > 0.12) {
    for (const side of [-1, 1]) {
      const gx = P.cx + side * (5.5 + 3.0 * P.shakeAmp);
      const gy = P.cy + side * 1.4 * Math.sin(t * 55);
      p.disc(gx, gy, P.rx * 0.96, C[4], 0.38 * P.shakeAmp);
      p.disc(gx, gy, P.rx * 0.82, C[0], 0.68 * P.shakeAmp);
    }
  }

  g.clear();
  const halfX = P.rx + 10;
  const halfY = P.ry + 10;

  // Pass 1: Rasterize the furry/spiky soot silhouette
  g.shade(P.cx - halfX, P.cy - halfY, P.cx + halfX, P.by + 2, (x, y, o) => {
    if (!insideSoot(P, x, y, t)) return 0;
    o.t = 1;
    o.a = 0.99;
    return C[0];
  });

  g.depths(5);

  // Pass 2: Shade the furry black soot ball with charcoal fur tufts and a moonlit sumi-ink rim wash
  g.recolor((x, y, col, al, tag) => {
    if (tag !== 1) return col;
    const d = g.depth(x, y);
    const dx = (x + 0.5 - P.cx) / P.rx;
    const dy = (y + 0.5 - P.cy) / P.ry;
    const ang = Math.atan2(dy, dx);

    // Outer fur tuft tips (`d === 1`): crisp moonlit ink-wash highlight on upper-left tufts, charcoal on sides
    if (d === 1) {
      if (dy < 0.28 && dx < 0.38) {
        return dy < -0.42 && dx < -0.12 ? C[6] : C[5];
      }
      if (P.bristle > 0.2 && (Math.round(ang * 14) & 1) === 0) {
        return C[5];
      }
      return dy < 0.55 ? C[4] : C[3];
    }

    // Fur sub-rim (`d === 2`): layered charcoal fur tufts
    if (d === 2) {
      const tuftTex = Math.sin(ang * 28) > 0.15;
      if (dy < -0.18 && dx < 0.25 && tuftTex) return C[3];
      return C[2];
    }

    // Internal fur texture clumps (`d === 3`) around the velvety pitch-black core
    if (d === 3) {
      const clump = Math.sin(ang * 18 + dy * 4) > 0.45;
      return clump && dy < 0.05 ? C[2] : C[1];
    }

    // Deep pitch-black soot heart (`d >= 4`): pure `#040308` & `#0c0a16` so the bright yellow eyes blaze out!
    return (x + y) % 7 === 0 && dy < -0.35 ? C[1] : C[0];
  });
}

// Attenuate background additive light (`p.L`) inside the deep pitch-black soot core (`d >= 3`) BEFORE drawing eye glow,
// just like `shadow/shadow-flames.js`, so the furry soot body stays velvety pitch-black while its rim and smoke glow!
function darkenPitchBlackCoreLight(g, p) {
  const { w, h, x0, y0 } = g;
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const i = gy * w + gx;
      if (!g.c[i] || !g.d || g.d[i] < 3) continue;
      const sx = p.cellX(x0 + gx + 0.5, y0 + gy + 0.5) - p.ox;
      const sy = p.cellY(x0 + gx + 0.5, y0 + gy + 0.5) - p.oy;
      if (sx >= 0 && sy >= 0 && sx < p.w && sy < p.h) {
        p.L[sy * p.w + sx] = 0;
      }
    }
  }
}

// 4. TWO GOOFY BRIGHT-YELLOW BIG EYES ("睁开两只呆萌的亮黄色大眼睛")
function drawGoofyYellowEyes(g, p, C, E, P) {
  if (P.eyeOpen <= 0.03) return [];

  const exSpace = 6.4 - 0.4 * P.huddle;
  const baseEy = P.cy - 0.8 + (P.huddle > 0 ? 1.5 * P.huddle : 0) + P.lookY * 0.6;
  const baseEx = P.cx + P.lookX * 1.15;

  const rxEye = 4.3 + 0.55 * Math.max(0, P.eyeOpen - 1);
  const ryEye = clamp(4.7 * P.eyeOpen, 0.7, 5.8);

  const eyeList = [];

  for (const side of [-1, 1]) {
    // Goofy slight size difference (amplified during startle shock!)
    const asym = side < 0 ? 1.04 + 0.05 * P.shakeAmp : 0.96 - 0.04 * P.shakeAmp;
    const ex = baseEx + side * exSpace;
    const ey = baseEy + (side > 0 && P.huddle > 0.3 ? -0.3 : 0);
    const rx = rxEye * asym;
    const ry = ryEye * asym;

    eyeList.push({ ex, ey, rx, ry, side });

    // 1px pitch-black fur socket halo around each big yellow eye
    g.shade(ex - rx - 1.5, ey - ry - 1.5, ex + rx + 1.5, ey + ry + 1.5, (x, y, o) => {
      const nx = (x - ex) / rx;
      const ny = (y - ey) / ry;
      const d = Math.hypot(nx, ny);
      if (d > 1.24) return 0;
      o.a = 1;
      if (d > 1.0) return C[0];

      // Inside the big bright-yellow eye:
      // Warm amber outer ring (`E[2]`), blazing bright-yellow fill (`E[3]`), pale lemon-gold upper dome (`E[4]`)
      if (d > 0.82) return ny < -0.2 ? E[3] : E[2];
      return ny < -0.25 && nx < 0.35 ? E[4] : E[3];
    });

    // Goofy dark pupil + crisp white catchlight
    if (ry >= 1.8) {
      const pxOff = P.lookX * 0.50 - side * (Math.abs(P.lookX) < 0.5 ? 0.5 : 0);
      const pyOff = P.lookY * 0.45;
      const px = Math.round(ex + pxOff);
      const py = Math.round(ey + pyOff);

      // When startled (`P.shakeAmp > 0.2`), pupils shrink to tiny shocked pinpricks; otherwise cute 2x2 pupils
      if (P.shakeAmp > 0.22) {
        g.set(px, py, C[0], 1);
        g.set(px - 1, py - 1, WHITE, 1);
      } else {
        g.set(px, py, C[0], 1);
        g.set(px + (side < 0 ? 1 : -1), py, C[0], 1);
        if (ry >= 3.0) {
          g.set(px, py + 1, E[0], 1);
          g.set(px + (side < 0 ? 1 : -1), py + 1, E[0], 1);
        }
        g.set(Math.round(ex - rx * 0.32), Math.round(ey - ry * 0.32), WHITE, 1);
        if (ry >= 3.5) {
          g.set(Math.round(ex - rx * 0.32) + 1, Math.round(ey - ry * 0.32), E[4], 1);
        }
      }
    }
  }

  return eyeList;
}

// 5. BLACK SUMI-INK SPLATTER DROPLETS FLUNG OUT ON STARTLE ("向四周甩出数滴黑色水墨斑点")
// Aimed into wide left & right radial fans so every single droplet flies clear outside the soot body!
function inkDroplet(i, o, t) {
  const r = rng(o.seed, i, 37);
  // Two crisp startle volleys (`t0 ~ 0.69s` and `t0 ~ 0.88s`) so ink drops are flying in frames 22, 28, 33, 39!
  const volley = i < 11 ? 0 : 1;
  const idx = i % 11;
  const t0 = T_STARTLE + 0.01 + volley * 0.18 + (idx / 11) * 0.14 + r.range(-0.01, 0.01);
  const age = wrap(t - t0, D);

  const side = i % 2 === 0 ? -1 : 1;
  // Strong horizontal velocity (`vx = side * 44..108`) + high vertical arc (`vy0 = -75..-155`)
  const vx = side * r.range(44, 108);
  const vy0 = -r.range(75, 155);
  const z = Math.sin(idx * 1.7 + volley * 2.1);
  const size = i % 3 === 0 ? 3 : 2;

  const x0 = side * r.range(11, 17);
  const yStart = -R0 - r.range(-4, 8);
  const yFloor = 1 + z * 4.2;

  const f = toss(x0, yStart, vx, vy0, age, G, yFloor);
  f.age = age;
  f.size = size;
  f.z = z;
  f.yFloor = yFloor;
  f.active = age >= 0 && age < f.at + 0.90;
  f.blotchFade = f.landed ? clamp(1 - (age - f.at) / 0.90) : 0;
  f.splatPop = f.landed ? clamp(1 - (age - f.at) / 0.18) : 0;
  return f;
}

// Draw an airborne sumi-ink droplet (`黑色水墨斑点`) as an organic, speed-stretched teardrop with ink-wash shading
function drawAirborneInkDroplet(p, C, f) {
  const sv = Math.hypot(f.vx, f.vy) || 1;
  const ux = f.vx / sv;
  const uy = f.vy / sv;
  const nx = -uy;
  const ny = ux;
  const tailL = Math.min(8.0, sv / 19);

  // Subtle moonlit halo behind each airborne black ink drop so its pitch-black silhouette pops anywhere in the air!
  p.glow(f.x, f.y, 5.5, C[4], 0.34);

  // 1. Tapering sumi-ink brush-stroke tail + trailing satellite ink beads
  p.line(f.x - ux * tailL, f.y - uy * tailL, f.x, f.y, (u) => (u > 0.4 ? C[0] : C[4]));
  p.line(
    f.x - ux * (tailL * 0.72) + nx * 0.9,
    f.y - uy * (tailL * 0.72) + ny * 0.9,
    f.x + nx * 0.9,
    f.y + ny * 0.9,
    C[5],
    0.90
  );
  p.dot(f.x - ux * (tailL + 2.2), f.y - uy * (tailL + 2.2), C[0], 0.98);
  p.dot(f.x - ux * (tailL + 3.4), f.y - uy * (tailL + 3.4), C[5], 0.85);

  // 2. Plump teardrop ink head: pitch-black core (`C[0]`) with a curved moonlit ink-wash crescent on top-left
  const rx = Math.round(f.x);
  const ry = Math.round(f.y);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > (f.size >= 3 ? 2.4 : 1.9)) continue;
      const isLitRim = dx + dy <= -1 && d >= 0.9;
      p.px(rx + dx, ry + dy, isLitRim ? C[5] : d > 1.45 ? C[3] : C[0]);
    }
  }
  p.px(rx - 1, ry - 1, C[6]);
}

// Draw a landed multi-lobed sumi-ink blotch (`水墨斑点`) on the floor
function drawLandedInkBlotch(p, C, f, i) {
  const fade = f.blotchFade;
  if (fade <= 0.02) return;
  const x = Math.round(f.lx);
  const y = Math.round(f.yFloor);
  const rx = (f.size + 2.0 + 1.4 * f.splatPop) * (0.45 + 0.55 * fade);
  const ry = Math.max(1.1, rx * 0.42);

  for (let dy = -Math.ceil(ry) - 1; dy <= Math.ceil(ry) + 1; dy++) {
    for (let dx = -Math.ceil(rx) - 2; dx <= Math.ceil(rx) + 2; dx++) {
      const ang = Math.atan2(dy, dx);
      const lobe = 1 + 0.28 * Math.sin(ang * 3 + i * 2.1);
      const d = Math.hypot(dx / (rx * lobe), dy / (ry * lobe));
      if (d > 1.25) continue;
      const col = d > 0.84 ? C[4] : d > 0.58 ? C[2] : C[0];
      p.blend(x + dx, y + dy, col, fade * (d > 0.84 ? 0.82 : 0.96));
    }
  }

  // Upward ink crown splash on the first 0.18s of landing
  if (f.splatPop > 0.05) {
    const h = 4.0 * Math.sin(f.splatPop * Math.PI);
    p.line(x - 2, y, x - 3.5, y - h, C[4], f.splatPop);
    p.line(x + 2, y, x + 3.5, y - h, C[4], f.splatPop);
    p.px(x - 2, Math.round(y - h * 0.7), C[0]);
    p.px(x + 2, Math.round(y - h * 0.7), C[0]);
    p.px(x, Math.round(y - h - 1), C[5]);
  }
}

// 6. STARTLE SHOCK RAYS & OVERHEAD QUESTION-MARK LIGHT MOTES ("头顶冒出问号光点的细节特效")
function drawStartleShockTicks(p, C, E, P, t) {
  if (t < T_STARTLE || t > T_STARTLE + 0.52) return;
  for (const [t0, len] of [[T_STARTLE + 0.02, 8.0], [T_STARTLE + 0.22, 6.5]]) {
    const u = (t - t0) / 0.24;
    if (u <= 0 || u >= 1) continue;
    const nRays = 11;
    for (let i = 0; i < nRays; i++) {
      const an = -Math.PI + (i / (nRays - 1)) * Math.PI + Math.sin(i * 2.3) * 0.08;
      const r0 = P.rx + 4 + 9 * ease.outCubic(u);
      const L = len * Math.sin(u * Math.PI) * (i % 2 === 0 ? 1.15 : 0.8);
      if (L < 0.8) continue;
      const ca = Math.cos(an), sa = Math.sin(an);
      const x0 = P.cx + ca * r0, y0 = P.cy + sa * r0;
      const x1 = P.cx + ca * (r0 + L), y1 = P.cy + sa * (r0 + L);
      p.line(x0, y0, x1, y1, (q) => (q > 0.45 ? WHITE : i % 2 === 0 ? E[3] : C[5]));
    }
  }
}

function drawQuestionMarkLightMotes(p, E, P, t) {
  for (let i = 0; i < Q_MARKS.length; i++) {
    const m = Q_MARKS[i];
    const age = wrap(t - m.t0, D);
    if (age > m.life) continue;
    const u = age / m.life;
    const pop = ease.outBack(clamp(age / 0.14), 2.8);
    const out = clamp((u - 0.78) / 0.22);
    const sizeIdx = clamp(Math.round(m.big * Math.min(1.1, pop) * (1 - out * 0.7)), 0, 2);
    if (pop < 0.25 || out > 0.92) continue;

    const bob = Math.sin(age * 6.5 + i * 2.1) * 1.8;
    const sway = Math.sin(age * 4.0 + i) * 1.0;
    const x = P.cx * 0.45 + m.x + sway;
    const y = m.y + (P.huddle * 4) + bob - age * 3.5;
    const fade = 1 - out;

    // Pop-in radial burst of golden light-rays & question-mark light motes ("问号光点")
    if (age < 0.22) {
      const k = age / 0.22;
      for (let j = 0; j < 8; j++) {
        const an = (j / 8) * TAU + 0.3;
        const d0 = 4 + 7 * k;
        const d1 = d0 + 3.2 * (1 - k);
        p.line(x + Math.cos(an) * d0, y + Math.sin(an) * d0, x + Math.cos(an) * d1, y + Math.sin(an) * d1, j % 2 ? E[4] : E[3], 1 - k);
      }
      p.glow(x, y, 16, E[3], 0.52 * (1 - k));
    }

    // Draw the shaded pixel Question Mark icon (`[outline, shadow, body, highlight]`)
    icon(p, x, y, 7, QS[sizeIdx], [E[0], E[2], E[3], WHITE], fade);
    p.glow(x, y, 11 + sizeIdx * 2.5, E[3], 0.42 * fade);
    p.glow(x, y, 5, WHITE, 0.25 * fade);

    // Orbiting question-mark light motes ("光点") twinkling around each active '?'
    for (let k = 0; k < 4; k++) {
      const ma = age * 5.5 + (k / 4) * TAU + i;
      const mr = 6.5 + sizeIdx * 1.5 + Math.sin(age * 8 + k) * 1.5;
      const mx = x + Math.cos(ma) * mr;
      const my = y + Math.sin(ma) * mr * 0.75;
      const tw = 0.5 + 0.5 * Math.sin(age * 16 + k * 2.3);
      if (tw > 0.65 && k % 2 === 0) {
        sparkle(p, mx, my, 1.4 * fade, WHITE, E[3], 0.38 * fade);
      } else {
        p.dot(mx, my, tw > 0.5 ? WHITE : E[4], fade * 0.95);
        p.glow(mx, my, 4, E[3], 0.28 * fade * tw);
      }
    }
  }
}

export function drawBack(p, time, o) {
  const t = shift(time, D, o.seed);
  const C = fit(o.palette, 7);
  const E = fit(o.eyes, 6);
  const P = pose(t);

  // 1. Soft moonlit backdrop aura behind the soot ball & rising smoke column so black ink silhouettes pop clearly
  const br = 0.9 + 0.1 * Math.sin((t / D) * TAU * 2);
  p.glow(P.cx * 0.5, P.cy - 14, 64, C[4], (0.30 + 0.12 * P.shakeAmp) * br);
  p.glow(P.cx, P.cy - 4, 36, C[5], 0.18 * br);

  // 2. Back half of the wriggling ink shadow clinging to the floor
  drawWrigglingInkShadow(p, C, E, P, t, false);

  // 3. Back-layer landed sumi-ink blotches & airborne ink droplets (`z < 0`)
  for (let i = 0; i < NINK; i++) {
    const f = inkDroplet(i, o, t);
    if (!f.active || f.z >= 0) continue;
    if (f.landed) drawLandedInkBlotch(p, C, f, i);
    else drawAirborneInkDroplet(p, C, f);
  }

  // 4. Back layer of steaming black ink-smoke puffs & curling smoke tongues
  drawSteamingBlackSmoke(p, C, P, t, true);
}

export function draw(p, time, o) {
  const t = shift(time, D, o.seed);
  const C = fit(o.palette, 7);
  const E = fit(o.eyes, 6);
  const P = pose(t);

  // 1. Front half of the wriggling ink shadow & front landed ink blotches (`z >= 0`)
  drawWrigglingInkShadow(p, C, E, P, t, true);
  for (let i = 0; i < NINK; i++) {
    const f = inkDroplet(i, o, t);
    if (!f.active || f.z < 0 || !f.landed) continue;
    drawLandedInkBlotch(p, C, f, i);
  }

  // 2. Build & draw the fluffy black soot ball body and two goofy bright-yellow big eyes
  const g = GRID;
  drawFluffySootBody(g, p, C, P, t);
  darkenPitchBlackCoreLight(g, p);
  const eyeList = drawGoofyYellowEyes(g, p, C, E, P);
  g.draw(p);

  // 3. Warm golden-yellow additive glow on the two goofy big eyes!
  const eyeGlowK = clamp(P.eyeOpen, 0, 1.25);
  for (const e of eyeList) {
    p.glow(e.ex, e.ey, 8.5 * eyeGlowK, E[3], 0.48 * eyeGlowK);
    p.glow(e.ex, e.ey, 4.0 * eyeGlowK, E[4], 0.34 * eyeGlowK);
  }

  // 4. Front layer of steaming black ink-smoke puffs & floating soot flecks
  drawSteamingBlackSmoke(p, C, P, t, false);

  // 5. Front airborne black sumi-ink droplets (`z >= 0`) flung out during the startle judder
  for (let i = 0; i < NINK; i++) {
    const f = inkDroplet(i, o, t);
    if (!f.active || f.z < 0 || f.landed) continue;
    drawAirborneInkDroplet(p, C, f);
  }

  // 6. Startle shock rays & overhead glowing question-mark light motes ("头顶冒出问号光点的细节特效")
  drawStartleShockTicks(p, C, E, P, t);
  drawQuestionMarkLightMotes(p, E, P, t);
}
