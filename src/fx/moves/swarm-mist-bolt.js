// Swarm black-mist bolt ("moves/swarm-mist-bolt"):
// 1. Origin Black Smoke Dispersion (0.00..0.90s): Caster coils and snaps a palm forward; a dense cloud of
//    pitch-black soot smoke erupts and disperses outward in rolling charcoal-ash billows.
// 2. Compact Swarm & Dark-Crimson Miasma Straight Flight (0.16..0.68s): Out of the dispersing black smoke shoots
//    a compact, boiling cluster of 64 dense 1-2px pitch-black insect particles wrapped in coiling dark-crimson
//    miasma along a dead-straight horizontal line, shedding scattered stray black bug-dots along the trajectory.
// 3. Oppressive Enemy Hit, Chitin Scatter & Gnawing Blood-Light (0.68..2.65s): Punches into the enemy with heavy
//    forward-driving momentum and an arena-dimming shadow pressure drop; the swarm instantaneously explodes into
//    >220 tiny glossy-rimmed black chitin carapace particles while bursting open an asymmetric, ferocious
//    dark-crimson gnawing blood-light bloom of scissor-clamping mandible fangs, barbed blood spikes, and gore.

import { Particles, Bits, Lights, P, B, Rng, fit, flare, clamp, smooth, lerp, ease, rand, mix, TAU, WHITE, GRAVITY, READY } from "../../core/index.js";
import { Puffs, PK, unlight } from "../shadow/_lib.js";
import { brokenRing, frontCrescent } from "../impacts/_lib.js";

const MX = 25, MY = -27;
const TX = 188;
const SLIDE_DIST = 28;

const T_RELEASE = 0.16;
const T_HIT = 0.68;
const T_BITE2 = 0.79;
const T_BITE3 = 0.90;
const T_END = 2.65;

export const meta = {
  name: "Swarm mist bolt",
  desc: "Black smoke disperses to launch a compact black-dot insect swarm in dark-crimson miasma, dropping stray specks before exploding into black chitin and gnawing blood-light.",
  tags: ["move", "shadow", "swarm", "insect", "smoke", "miasma", "blood", "crimson", "projectile", "bite", "one-shot"],
  size: [424, 208],
  origin: [84, 162],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#050103", "#1e0207", "#4c0611", "#880b1d", "#c71629", "#f02d3d", "#ff6e70", "#ffdcd8", "#ffffff"],
    smoke: ["#020104", "#0a0710", "#171122", "#2b213b", "#493a61", "#9880b8"],
    seed: 23,
  },
};

// Caster choreography: dark-claw gather -> deep coil -> crisp upright palm-thrust release -> hold -> recover
const GUARD = { ...READY, x: 0, crouch: 2, lean: 2, fx: 11, fy: -21, bx: 9, by: -21, ffx: 8, fbx: -8 };
const GATHER = { ...READY, x: -3, crouch: 4, lean: -3, turn: 0.78, fx: -4, fy: -25, bx: 11, by: -24, armsFront: true, ffx: 6, fbx: -9 };
const COIL = { ...READY, x: -5, crouch: 5, lean: -4, turn: 0.85, fx: -6, fy: -27, bx: 9, by: -25, armsFront: true, ffx: 5, fbx: -10 };
const CAST_SNAP = { ...READY, x: 8, crouch: 3, lean: 5, turn: 0.42, fx: 21, fy: -27, bx: -3, by: -22, ffx: 11, fbx: -9, ghost: 1 };
const CAST_HOLD = { ...CAST_SNAP, x: 9, crouch: 4, lean: 5, fx: 21, fy: -26, bx: -4, by: -22, ghost: 0 };
const HIT_WATCH = { ...READY, x: 6, crouch: 3, lean: 3, fx: 15, fy: -23, bx: 2, by: -21, ffx: 9, fbx: -8 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.28, GUARD],
    [-0.08, GATHER],
    [T_RELEASE - 0.04, COIL],
    [T_RELEASE, CAST_SNAP, "snap"],
    [T_RELEASE + 0.16, CAST_HOLD],
    [T_HIT, HIT_WATCH, "snap"],
    [1.45, { ...GUARD, x: 3, crouch: 3 }],
    [2.05, GUARD],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_RELEASE, stop: 0.04, shake: 0.16, amp: 2.0, target: false },
    { t: T_HIT, stop: 0.16, shake: 0.50, amp: 5.2, push: 5.0, slide: 15, straw: 34, y: -27, skin: "red", shiver: 0.46, flash: 0.05 },
    { t: T_BITE2, stop: 0.04, shake: 0.25, amp: 3.4, push: -2.2, slide: 21, straw: 16, y: -32, skin: "char", shiver: 0.46, flash: 0.02 },
    { t: T_BITE3, stop: 0.05, shake: 0.32, amp: 4.0, push: 3.8, slide: SLIDE_DIST, daze: 1.18, straw: 24, y: -22, skin: "red", shiver: 0.56, flash: 0.03 },
    { t: 1.48, push: 0, straw: 0, flash: 0, skin: null },
    { t: T_END - 0.28, push: 0, straw: 0, flash: 0, skin: null, daze: 0 },
  ],
  dust: [
    { t: T_RELEASE, x: 11, n: 7, dir: 1 },
    { t: T_RELEASE, x: -7, n: 5, dir: -1 },
    { t: T_HIT, x: TX + 4, n: 10, dir: 1 },
    { t: T_BITE3, x: TX + 20, n: 8, dir: 1 },
  ],
};

// Safe local bounds inside [424, 208] with origin [84, 162] -> x in [-84..339], y in [-162..45]
const X_MIN = -78, X_MAX = 332, Y_MIN = -156;

// Prebaked scalloped smoke/miasma billow LUTs (radii 2..19)
const BILLOW_LUTS = Array.from({ length: 20 }, (_, r) => {
  if (r < 2) return [];
  const pts = [];
  for (let dy = -r - 2; dy <= r + 2; dy++) {
    for (let dx = -r - 2; dx <= r + 2; dx++) {
      const a = Math.atan2(dy, dx);
      const sc = 0.88 + 0.14 * Math.sin(a * 5 + r * 0.83) + 0.09 * Math.cos(a * 8 - r * 0.57);
      const q = Math.hypot(dx, dy) / (r * sc);
      if (q > 1) continue;
      pts.push(dx, dy, q);
    }
  }
  return pts;
});

// Scalloped pitch-black smoke billow with charcoal-ash outer rim & subtle crimson inner glint
function drawBlackSmokeBillow(p, cx, cy, r, u, Sm, C, alpha, rimDirX = 1, crimsonRim = 0) {
  const fade = (1 - smooth(0.50, 1, u)) * alpha;
  if (fade <= 0.03) return;
  const ri = clamp(Math.round(r), 2, 19), pts = BILLOW_LUTS[ri];
  if (!pts.length) return;
  const rx = Math.round(cx), ry = Math.round(cy);
  for (let i = 0; i < pts.length; i += 3) {
    const dx = pts[i], dy = pts[i + 1], q = pts[i + 2];
    const px = rx + dx, py = ry + dy;
    if (px < X_MIN || px > X_MAX || py < Y_MIN || py > 1) continue;
    const sideLit = (dx * rimDirX * 0.65 - dy * 0.65) / Math.max(1, ri);
    let col, a;
    if (q < 0.56) {
      col = Sm[0]; // true abyssal pitch-black core
      a = fade * 0.96;
    } else if (q < 0.80) {
      col = sideLit > 0.30 ? Sm[2] : Sm[1];
      a = fade * 0.88;
    } else {
      col = crimsonRim > 0.22 && sideLit > 0.24 ? mix(Sm[3], C[4], crimsonRim) : sideLit > 0.08 ? Sm[4] : Sm[2];
      a = fade * 0.76;
    }
    p.blend(px, py, col, a);
  }
}

// Scalloped dark-crimson blood-miasma billow for the devouring blood-light bloom
function drawBloodMistBillow(p, cx, cy, r, u, C, alpha) {
  const fade = (1 - smooth(0.46, 1, u)) * alpha;
  if (fade <= 0.03) return;
  const ri = clamp(Math.round(r), 2, 19), pts = BILLOW_LUTS[ri];
  if (!pts.length) return;
  const rx = Math.round(cx), ry = Math.round(cy);
  for (let i = 0; i < pts.length; i += 3) {
    const dx = pts[i], dy = pts[i + 1], q = pts[i + 2];
    const px = rx + dx, py = ry + dy;
    if (px < X_MIN || px > X_MAX || py < Y_MIN || py > 1) continue;
    const innerLit = (1 - q) * 0.72 - (dy / Math.max(1, ri)) * 0.28;
    let col;
    if (q > 0.85) col = C[0];
    else if (u < 0.26) col = innerLit > 0.44 ? C[5] : innerLit > 0.22 ? C[4] : C[2];
    else if (u < 0.58) col = innerLit > 0.40 ? C[4] : innerLit > 0.18 ? C[3] : C[1];
    else col = innerLit > 0.34 ? C[3] : C[1];
    p.blend(px, py, col, fade * (q > 0.82 ? 0.64 : 0.84));
  }
}

// Mid-air curved miasma bow-crest (centered at cx, cy — pure horizontal flight!)
function drawAirCrescent(p, cx, cy, halfH, thick, sweepBack, cols, alpha) {
  if (alpha <= 0.03 || halfH < 2) return;
  const x0 = Math.max(X_MIN, Math.floor(cx - sweepBack - thick - 1));
  const x1 = Math.min(X_MAX, Math.ceil(cx + 2));
  const y0 = Math.max(Y_MIN, Math.floor(cy - halfH - 1));
  const y1 = Math.min(-1, Math.ceil(cy + halfH + 1));
  p.shade(x0, y0, x1, y1, (px, py, out) => {
    const ny = (py - cy) / halfH;
    if (Math.abs(ny) >= 1) return;
    const leadX = cx - ny * ny * sweepBack;
    const wt = thick * Math.pow(1 - ny * ny, 0.58);
    const q = (leadX - px) / Math.max(0.5, wt);
    if (q < 0 || q > 1) return;
    out.c = q < 0.30 ? cols[0] : q < 0.66 ? cols[1] : cols[2];
    out.a = alpha * (1 - Math.pow(Math.abs(ny), 2.1)) * (1 - q * 0.5);
  });
}

// Barbed dark-crimson blood-light spike with pitch-black inner spine & scarlet cutting edge
function drawBloodSpike(p, cx, cy, a, r0, r1, w0, curve, C, hot, alpha) {
  if (alpha <= 0.03 || r1 <= r0 + 3) return;
  const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
  const len = r1 - r0;
  const pt = (u, offN) => {
    const r = r0 + u * len;
    const bend = Math.sin(u * Math.PI) * curve;
    return [
      clamp(cx + ca * r + nx * (bend + offN), X_MIN + 2, X_MAX - 2),
      Math.min(1, Math.max(Y_MIN + 2, cy + sa * r + ny * (bend + offN))),
    ];
  };
  const barbU = 0.42;
  const wB = w0 * 0.84;
  const tip = pt(1, 0);
  const outer = [
    pt(0, w0),
    pt(barbU, wB * 1.40),
    pt(barbU + 0.09, w0 * 0.50),
    tip,
    pt(barbU + 0.09, -w0 * 0.50),
    pt(barbU, -wB * 1.36),
    pt(0, -w0),
  ];
  p.poly(outer, C[0], alpha);
  const inner = outer.map(([px, py], idx) => (idx === 3 ? tip : [lerp(px, cx + ca * (r0 + len * 0.35), 0.18), lerp(py, cy + sa * (r0 + len * 0.35), 0.18)]));
  p.poly(inner, hot > 0.52 ? C[5] : C[4], alpha);
  p.poly([pt(0.04, w0 * 0.40), pt(0.70, 0), pt(0.04, -w0 * 0.40)], C[0], alpha * 0.96);
  p.line(inner[1][0], inner[1][1], tip[0], tip[1], hot > 0.48 ? C[6] : C[5], alpha);
  p.line(inner[5][0], inner[5][1], tip[0], tip[1], hot > 0.72 ? C[7] : C[5], alpha * 0.92);
}

// Quadratic-Bezier Scissor-Mandible / Devouring Fang Blade ("噬咬血光"):
// Starts wide outside the victim, hooks fiercely, and snaps RIGHT THROUGH the victim's chest!
function drawBezierJawFang(p, x0, y0, xCtrl, yCtrl, xTipEnd, yTipEnd, thick, u, C, alpha) {
  const fade = (1 - smooth(0.44, 1, u)) * alpha;
  if (fade <= 0.03) return;
  const snap = ease.outExpo(clamp(u / 0.28));
  const tailU = smooth(0.24, 0.92, u) * 0.52;
  const x2 = lerp(xCtrl, xTipEnd, snap);
  const y2 = lerp(yCtrl, yTipEnd, snap);

  const evalPt = (s) => {
    const m = 1 - s;
    return [
      m * m * x0 + 2 * m * s * xCtrl + s * s * x2,
      m * m * y0 + 2 * m * s * yCtrl + s * s * y2,
    ];
  };

  const steps = 16;
  let prev = evalPt(tailU);
  for (let i = 1; i <= steps; i++) {
    const s = lerp(tailU, 1, i / steps);
    const cur = evalPt(s);
    const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
    const segL = Math.hypot(dx, dy) || 1;
    const nx = -dy / segL, ny = dx / segL;
    const normS = (s - tailU) / Math.max(0.05, 1 - tailU);
    const hw = thick * Math.sin(Math.min(1, normS * 2.2) * Math.PI * 0.5) * Math.pow(1 - normS, 0.68);
    if (hw >= 0.2 && prev[1] <= 1 && cur[1] <= 1) {
      for (let o = -hw - 0.5; o <= hw + 0.5; o += 0.55) {
        const q = o / Math.max(0.45, hw);
        let col;
        if (normS > 0.84) col = u < 0.18 ? WHITE : C[6];
        else if (q > 0.45) col = u < 0.18 ? C[6] : C[5];
        else if (q > -0.18) col = C[4];
        else col = C[0];
        p.line(prev[0] + nx * o, Math.min(1, prev[1] + ny * o), cur[0] + nx * o, Math.min(1, cur[1] + ny * o), col, fade);
      }
    }
    prev = cur;
  }
}

// Glossy-rimmed micro black chitin carapace shard (angular pitch-black insect shell + bright 1px chitin specular rim!)
function drawChitinShard(p, x, y, a, s, Sm, C, glintHeat, alpha, blackKeep) {
  if (alpha <= 0.05 || y > 1 || x < X_MIN + 4 || x > X_MAX - 4) return;
  const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
  const rx = Math.round(x), ry = Math.min(0, Math.round(y));
  const len = Math.max(1.8, s);
  const xTip = Math.round(x + ca * len * 0.72), yTip = Math.min(0, Math.round(y + sa * len * 0.72));
  const xBase = Math.round(x - ca * len * 0.62), yBase = Math.min(0, Math.round(y - sa * len * 0.62));
  const xWing = Math.round(x + nx * len * 0.55), yWing = Math.min(0, Math.round(y + ny * len * 0.55));

  const rimCol = glintHeat > 0.50 ? C[6] : Sm[5];
  p.dot(xWing, yWing, rimCol, alpha * 0.95);
  if (s >= 2.5) p.dot(rx, Math.max(Y_MIN + 2, ry - 1), Sm[5], alpha * 0.82);

  p.dot(rx, ry, Sm[0], alpha);
  p.dot(xTip, yTip, Sm[0], alpha);
  p.dot(xBase, yBase, Sm[0], alpha);
  if (s >= 2.7) {
    p.dot(rx + 1, ry, Sm[0], alpha);
    blackKeep.push(rx + 1, ry);
  }
  blackKeep.push(rx, ry, xTip, yTip, xBase, yBase);
}

export function create(o) {
  const C = fit(o.palette, 9);
  const Sm = fit(o.smoke, 6);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[7], C[5], C[3]], haze: C[3] });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  const puffs = new Puffs({
    rng: R,
    flame: [C[7], C[6], C[5], C[4], C[3], C[2], C[1]],
    soot: [Sm[2], Sm[1]],
    cap: Sm[4],
    rim: [C[5], C[4], Sm[4]],
    floor,
  });

  // 20 Scalloped black-smoke dispersion billows at the cast origin ("起点散开一团黑烟")
  const originSmokeBillows = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * TAU + R.range(-0.10, 0.10);
    const forward = Math.cos(a) > -0.15;
    const dist = forward ? R.range(12, 34) : R.range(14, 32);
    return {
      dx: Math.cos(a) * dist + (forward ? 4 : -4),
      dy: Math.sin(a) * dist * 0.85,
      r0: R.range(4.2, 7.0),
      r1: R.range(9.0, 15.0),
      t0: T_RELEASE + R.range(-0.02, 0.05),
      life: R.range(0.50, 0.84),
      back: !forward,
    };
  });

  // 64 Stratified golden-angle swarming black-dot insects ("一小团由密集黑点粒子组成的虫群")
  const swarmBugs = Array.from({ length: 64 }, (_, i) => {
    const isCore = i < 46;
    const frac = isCore ? (i + 0.5) / 46 : (i - 45.5) / 18;
    const baseR = isCore ? 0.8 + Math.pow(frac, 0.62) * 8.2 : 8.5 + frac * 5.2;
    const baseA = i * 2.399963;
    return {
      ox: Math.cos(baseA) * baseR * 1.15,
      oy: Math.sin(baseA) * baseR * 0.80,
      ampX: isCore ? R.range(1.4, 3.0) : R.range(2.2, 4.4),
      ampY: isCore ? R.range(1.2, 2.5) : R.range(1.8, 3.6),
      w1: R.range(22, 40) * R.sign(),
      w2: R.range(26, 46) * R.sign(),
      ph1: R.range(0, TAU),
      ph2: R.range(0, TAU),
      big: i % 3 === 0,
      wingMod: i % 4,
    };
  });

  // Discrete stray black bug-dots shed along the straight flight path ("沿途掉落零星黑点")
  const strayDots = [];

  // Exploded storm of fine black chitin carapace flecks ("瞬间炸散成无数细小的黑色甲壳粒子")
  const chitinDots = [];

  // Arterial blood droplets & floor blood splats
  const bloodDrops = [];
  const bloodSplats = [];

  // 19 Asymmetric forward-driving barbed dark-crimson blood-light spikes (longer forward-right punch!)
  const bloodSpikes = Array.from({ length: 19 }, (_, i) => {
    const a = (i / 19) * TAU + R.range(-0.09, 0.09);
    const ca = Math.cos(a), sa = Math.sin(a);
    const fwdBoost = ca > 0 ? 1 + ca * 0.30 : 1 + ca * 0.14;
    let rMax = (i % 2 === 0 ? R.range(48, 72) : R.range(28, 46)) * fwdBoost;
    if (sa > 0.06) rMax = Math.min(rMax, 26 / sa);
    return {
      a,
      delay: i % 3 === 0 ? 0 : R.range(0.008, 0.032),
      rBase0: 4,
      rBaseEnd: Math.min(rMax * 0.55, R.range(15, 29)),
      rMax,
      w0: i % 2 === 0 ? R.range(3.8, 5.5) : R.range(2.2, 3.5),
      curve: R.range(-3.4, 3.4),
      life: R.range(0.30, 0.46),
    };
  });

  // 10 Wide, jagged Scissor-Clamping Bezier Mandible Fangs ripping RIGHT THROUGH the victim in 3 waves ("噬咬血光")!
  const jawFangs = [
    // Wave 1 (T_HIT = 0.68s): Massive wide X-pincer mandibles snapping across (-42..+22)!
    { t0: T_HIT, p0: [-42, -26], pc: [-10, -34], p1: [18, -2], th: 4.4, dur: 0.23 },
    { t0: T_HIT, p0: [42, 20], pc: [12, 24], p1: [-16, -8], th: 4.4, dur: 0.23 },
    { t0: T_HIT + 0.015, p0: [38, -28], pc: [8, -32], p1: [-18, 4], th: 3.7, dur: 0.22 },
    { t0: T_HIT + 0.015, p0: [-38, 18], pc: [-8, 22], p1: [18, -10], th: 3.7, dur: 0.22 },
    // Wave 2 (T_BITE2 = 0.79s): Throat-ripping horizontal pincer clamp!
    { t0: T_BITE2, p0: [-34, -15], pc: [-8, -25], p1: [18, -4], th: 3.7, dur: 0.21 },
    { t0: T_BITE2, p0: [34, -2], pc: [8, 8], p1: [-18, -12], th: 3.7, dur: 0.21 },
    { t0: T_BITE2 + 0.01, p0: [28, -24], pc: [4, -14], p1: [-20, 3], th: 3.1, dur: 0.20 },
    // Wave 3 (T_BITE3 = 0.90s): Ferocious final X-fang rend!
    { t0: T_BITE3, p0: [-38, -20], pc: [-6, -12], p1: [24, 15], th: 4.2, dur: 0.25 },
    { t0: T_BITE3, p0: [38, -20], pc: [6, -12], p1: [-22, 15], th: 4.2, dur: 0.25 },
    { t0: T_BITE3 + 0.015, p0: [-28, 18], pc: [0, 6], p1: [24, -16], th: 3.5, dur: 0.24 },
  ];

  // 20 Billowing dark-crimson blood-mist clouds bursting around the bitten enemy (biased slightly forward!)
  const bloodMistClouds = Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * TAU + R.range(-0.10, 0.10);
    const dist = R.range(16, 54) * (Math.cos(a) > 0 ? 1.16 : 0.92);
    return {
      dx: Math.cos(a) * dist + 4,
      dy: Math.min(22, Math.sin(a) * dist * 0.85),
      r0: R.range(5.5, 8.5),
      r1: R.range(10.0, 15.5),
      t0: T_HIT + (i % 6) * 0.032,
      life: R.range(0.48, 0.86),
    };
  });

  const ringSegs = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * TAU + R.range(-0.08, 0.08);
    return { a, gap: Math.sin(a) > 0.30 ? 0 : R.range(0.36, 0.62), dr: R.range(0.18, 0.48), w: R.range(0.9, 1.4) };
  });

  // Dead-straight horizontal flight position from (MX+2, MY) to (TX-4, MY)
  const swarmPos = (tt) => {
    const rawU = clamp((tt - T_RELEASE) / (T_HIT - T_RELEASE));
    const prog = 0.24 * rawU + 0.76 * Math.pow(rawU, 1.16);
    return [lerp(MX + 2, TX - 4, prog), MY];
  };

  // Analytical enemy x position matching Target.step(dt) slide stages
  const enemyX = (tt) => {
    if (tt <= T_HIT) return TX;
    const s1 = 15 * (1 - Math.exp(-8.5 * (tt - T_HIT)));
    const s2 = tt > T_BITE2 ? 6 * (1 - Math.exp(-8.5 * (tt - T_BITE2))) : 0;
    const s3 = tt > T_BITE3 ? 7 * (1 - Math.exp(-8.5 * (tt - T_BITE3))) : 0;
    return TX + s1 + s2 + s3;
  };

  let t = 0;
  let released = false, hitDone = false, bite2Done = false, bite3Done = false;
  let gatherAcc = 0, nextStrayT = T_RELEASE + 0.020, miasmaAcc = 0;

  return {
    update(dt) {
      t += dt;

      // Pre-release (0.00..0.16s): dark soot motes & crimson wisps drawn into caster's palm
      if (t < T_RELEASE) {
        for (gatherAcc += dt * 75; gatherAcc >= 1; gatherAcc -= 1) {
          const a = R.range(0, TAU), d = R.range(14, 28);
          ps.spawn(P.STREAK, MX - 4 + Math.cos(a) * d, MY + Math.sin(a) * d, -Math.cos(a) * 140, -Math.sin(a) * 140, 0.12, R.chance(0.55) ? Sm[4] : C[4], 1);
        }
      }

      // Phase 1 (T_RELEASE = 0.16s): Origin bursts open a dispersing cloud of pitch-black smoke ("起点散开一团黑烟")
      if (!released && t >= T_RELEASE) {
        released = true;
        lights.add(MX + 4, MY, 34, C[4], 0.50, 0.22);
        for (let i = 0; i < 16; i++) {
          const a = R.range(-1.35, 1.35), sp = R.range(24, 82);
          puffs.spawn(PK.SOOT, MX + R.range(-2, 5), MY + R.range(-5, 5), Math.cos(a) * sp, Math.sin(a) * sp * 0.85 - 6, R.range(0.60, 1.12), R.range(5.5, 9.5), R.range(0, 0.05));
        }
        for (let i = 0; i < 6; i++) {
          const sd = i % 2 ? 1 : -1;
          puffs.spawn(PK.SOOT, MX + sd * R.range(2, 10), -R.range(2, 5), sd * R.range(28, 72), -R.range(2, 12), R.range(0.56, 0.96), R.range(4.5, 7.5), R.range(0, 0.06));
        }
      }

      // Phase 2 (0.16..0.68s): Straight horizontal flight wrapped in dark-crimson miasma + discrete stray black dots!
      if (t >= T_RELEASE && t < T_HIT) {
        const [sx, sy] = swarmPos(t);

        // Discrete, well-spaced stray black bug-dots dropping along the flight path ("沿途掉落零星黑点")
        while (t >= nextStrayT && nextStrayT < T_HIT - 0.02) {
          const [dropX, dropY] = swarmPos(nextStrayT);
          const count = R.chance(0.38) ? 2 : 1;
          for (let k = 0; k < count; k++) {
            strayDots.push({
              x: dropX - R.range(5, 17) + k * R.range(-7, 5),
              y: dropY + R.range(1, 8),
              vx: R.range(-8, 16),
              vy: R.range(24, 56),
              g: R.range(62, 118),
              drag: R.range(3.0, 4.8),
              ph: R.range(0, TAU),
              flutter: R.range(18, 30),
              big: true,
              tall: R.chance(0.45),
              age: 0,
              life: R.range(0.65, 1.05),
              landed: false,
            });
          }
          nextStrayT += R.range(0.026, 0.044);
        }

        // Trailing dark-crimson miasma vapour & dark soot along the straight line
        for (miasmaAcc += dt * 95; miasmaAcc >= 1; miasmaAcc -= 1) {
          ps.spawn(P.VAPOUR, sx - R.range(4, 16), sy + R.range(-5.5, 5.5), -R.range(30, 82), R.range(-10, 10), R.range(0.22, 0.44), R.chance(0.58) ? C[3] : C[2], R.range(3.8, 6.6));
          if (R.chance(0.32)) {
            puffs.spawn(PK.SOOT, sx - R.range(6, 14), sy + R.range(-3.5, 3.5), -R.range(20, 52), R.range(-7, 9), R.range(0.26, 0.48), R.range(3.0, 4.8));
          }
        }
      }

      // Phase 3 (T_HIT = 0.68s): Forward-driving shatter into >225 tiny black chitin particles + gnawing blood-light!
      if (!hitDone && t >= T_HIT) {
        hitDone = true;
        lights.add(TX + 4, -27, 64, C[4], 1.05, 0.62);
        lights.add(TX + 4, -27, 36, C[5], 0.85, 0.26);
        lights.add(TX + 2, -27, 20, WHITE, 0.78, 0.05);
        lights.add(TX + 14, -14, 50, C[3], 0.72, 0.68);

        // 1) 82 Tumbling glossy-rimmed pitch-black chitin carapace shards across 3 velocity tiers + forward punch cone!
        for (let i = 0; i < 82; i++) {
          const forwardCone = i >= 66;
          const a = forwardCone
            ? R.range(-0.62, 0.52)
            : (i / 66) * TAU + R.range(-0.05, 0.05);
          const tier = forwardCone ? 2 : i % 3;
          const sp = tier === 0 ? R.range(38, 105) : tier === 1 ? R.range(115, 225) : R.range(220, 350);
          bits.add({
            kind: B.SHARD,
            x: TX + R.range(-5, 6),
            y: -27 + R.range(-7, 7),
            vx: clamp(Math.cos(a) * sp + 26, -225, 275),
            vy: Math.sin(a) * sp - R.range(16, 68),
            g: tier === 0 ? 0.42 : 0.60,
            drag: tier === 0 ? R.range(2.4, 3.8) : R.range(1.6, 2.8),
            bounce: R.range(0.34, 0.50),
            life: R.range(0.95, 1.72),
            a: R.range(0, TAU),
            va: R.sign() * R.range(15, 30),
            s: tier === 0 ? R.range(2.4, 3.8) : R.range(2.0, 3.6),
          });
        }

        // 2) 148 Fine 1-2px jet-black chitin carapace flecks across inner/mid/outer rings + forward momentum!
        for (let i = 0; i < 148; i++) {
          const a = i >= 124 ? R.range(-0.68, 0.58) : R.range(0, TAU);
          const tier = i % 3;
          const sp = tier === 0 ? R.range(32, 95) : tier === 1 ? R.range(105, 225) : R.range(225, 360);
          chitinDots.push({
            x: TX + R.range(-4, 5),
            y: -27 + R.range(-6, 6),
            vx: Math.cos(a) * sp + 24,
            vy: Math.sin(a) * sp - R.range(12, 50),
            g: tier === 0 ? R.range(120, 210) : R.range(180, 320),
            drag: tier === 2 ? R.range(2.5, 4.0) : R.range(1.6, 2.8),
            big: i % 2 === 0,
            bloodWet: i % 3 === 0,
            age: 0,
            life: R.range(0.75, 1.58),
          });
        }

        // 3) Dark-crimson blood sparks & dark soot puffs
        for (let i = 0; i < 48; i++) {
          const a = R.range(0, TAU), sp = R.range(115, 315);
          ps.spawn(P.SPARK, TX, -27, Math.cos(a) * sp + 22, Math.sin(a) * sp - 24, R.range(0.16, 0.46), R.pick([C[6], C[5], C[7]]));
        }
        for (let i = 0; i < 14; i++) {
          const a = R.range(0, TAU), sp = R.range(25, 92);
          puffs.spawn(PK.SOOT, TX + R.range(-5, 5), -27 + R.range(-6, 6), Math.cos(a) * sp + 14, Math.sin(a) * sp * 0.8 - 10, R.range(0.68, 1.25), R.range(5.5, 9.5), R.range(0, 0.08));
        }

        // 4) Arterial blood droplets spurting out and splattering onto the ground
        for (let i = 0; i < 20; i++) {
          const a = -Math.PI / 2 + R.range(-1.25, 1.25), sp = R.range(55, 200);
          bloodDrops.push({
            x: TX + R.range(-5, 6),
            y: -27 + R.range(-8, 6),
            vx: Math.cos(a) * sp + 24,
            vy: Math.sin(a) * sp - 15,
            big: R.chance(0.58),
          });
        }
      }

      // Secondary ferocious gnaw bursts (T_BITE2 = 0.79s & T_BITE3 = 0.90s)
      if (!bite2Done && t >= T_BITE2) {
        bite2Done = true;
        const ex = enemyX(t);
        lights.add(ex, -32, 48, C[5], 0.85, 0.24);
        for (let i = 0; i < 18; i++) {
          const a = R.range(0, TAU), sp = R.range(85, 225);
          ps.spawn(P.SPARK, ex, -32, Math.cos(a) * sp, Math.sin(a) * sp - 15, R.range(0.12, 0.28), C[6]);
        }
        for (let i = 0; i < 6; i++) {
          bloodDrops.push({ x: ex + R.range(-4, 4), y: -32, vx: R.range(-45, 75), vy: -R.range(35, 110), big: i % 2 === 0 });
        }
      }

      if (!bite3Done && t >= T_BITE3) {
        bite3Done = true;
        const ex = enemyX(t);
        lights.add(ex, -23, 56, C[4], 0.95, 0.36);
        lights.add(ex, -23, 24, C[6], 0.75, 0.08);
        for (let i = 0; i < 24; i++) {
          const a = R.range(0, TAU), sp = R.range(95, 250);
          ps.spawn(P.SPARK, ex, -23, Math.cos(a) * sp + 16, Math.sin(a) * sp - 18, R.range(0.14, 0.34), R.pick([C[7], C[5]]));
        }
        for (let i = 0; i < 44; i++) {
          const a = R.range(0, TAU), sp = R.range(45, 215);
          chitinDots.push({
            x: ex + R.range(-5, 5),
            y: -24 + R.range(-6, 6),
            vx: Math.cos(a) * sp + 14,
            vy: Math.sin(a) * sp - 20,
            g: R.range(165, 295),
            drag: R.range(1.8, 3.2),
            big: i % 2 === 0,
            bloodWet: i % 3 === 0,
            age: 0,
            life: R.range(0.62, 1.28),
          });
        }
        for (let i = 0; i < 8; i++) {
          bloodDrops.push({ x: ex + R.range(-4, 6), y: -22, vx: R.range(-35, 95), vy: -R.range(25, 95), big: true });
        }
      }

      // Step discrete stray black dots dropped along flight path
      for (let i = strayDots.length - 1; i >= 0; i--) {
        const d = strayDots[i];
        d.age += dt;
        if (d.age >= d.life || t >= T_END - 0.06) {
          strayDots.splice(i, 1);
          continue;
        }
        if (!d.landed) {
          d.vx -= d.vx * Math.min(0.9, d.drag * dt);
          d.vx += Math.sin(t * d.flutter + d.ph) * 26 * dt;
          d.vy += d.g * dt;
          d.x = clamp(d.x + d.vx * dt, X_MIN + 4, X_MAX - 4);
          d.y += d.vy * dt;
          if (d.y >= 0) {
            d.y = 0;
            d.landed = true;
          }
        }
      }

      // Step exploded black chitin flecks
      for (let i = chitinDots.length - 1; i >= 0; i--) {
        const cd = chitinDots[i];
        cd.age += dt;
        if (cd.age >= cd.life || t >= T_END - 0.06) {
          chitinDots.splice(i, 1);
          continue;
        }
        const decay = Math.exp(-cd.drag * dt);
        cd.vx *= decay;
        cd.vy = cd.vy * decay + cd.g * dt;
        cd.x = clamp(cd.x + cd.vx * dt, X_MIN + 4, X_MAX - 4);
        cd.y += cd.vy * dt;
        if (cd.y >= 0) {
          cd.y = 0;
          cd.vy = -Math.abs(cd.vy) * 0.30;
          cd.vx *= 0.58;
        }
      }

      // Step arterial blood droplets & spawn glossy ground splats
      for (let i = bloodDrops.length - 1; i >= 0; i--) {
        const bd = bloodDrops[i];
        bd.vy += GRAVITY * 0.72 * dt;
        bd.vx *= 1 - 0.8 * dt;
        bd.x = clamp(bd.x + bd.vx * dt, X_MIN + 6, X_MAX - 6);
        bd.y += bd.vy * dt;
        if (bd.y >= 0 || t >= T_END - 0.15) {
          if (bd.y >= 0 && t < T_END - 0.35) {
            bloodSplats.push({
              x: bd.x,
              t0: t,
              life: Math.min(R.range(0.85, 1.35), T_END - 0.08 - t),
              big: bd.big,
              seed: R.int(1, 999),
            });
          }
          bloodDrops.splice(i, 1);
        }
      }

      bits.update(dt);
      for (const b of bits.list) {
        b.x = clamp(b.x, X_MIN + 6, X_MAX - 6);
        b.y = clamp(b.y, Y_MIN + 6, 0);
      }
      puffs.update(dt);
      for (const q of puffs.list) {
        q.x = clamp(q.x, X_MIN + 14, X_MAX - 14);
        q.y = clamp(q.y, Y_MIN + 14, 0);
      }
      ps.update(dt);
      for (const q of ps.list) {
        q.x = clamp(q.x, X_MIN + 4, X_MAX - 4);
        q.y = clamp(q.y, Y_MIN + 4, -0.5);
      }
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-4) return;
      const endFade = 1 - smooth(T_END - 0.42, T_END - 0.04, t);

      // 1. Rear half of dispersing black smoke at cast origin (drawn BEHIND caster so caster silhouette stays sharp!)
      if (t >= T_RELEASE && t < 1.05) {
        const [sx] = swarmPos(Math.min(t, T_HIT));
        for (const sb of originSmokeBillows) {
          if (!sb.back) continue;
          const age = t - sb.t0;
          if (age < 0 || age >= sb.life) continue;
          const u = age / sb.life;
          const prog = ease.outQuart(u);
          const bx = MX + sb.dx * prog;
          const by = Math.min(-2, MY + sb.dy * prog - age * 8);
          const crimsonRim = clamp(1 - (sx - bx) / 72) * (1 - u);
          drawBlackSmokeBillow(p, bx, by, lerp(sb.r0, sb.r1, ease.outCubic(u)), u, Sm, C, endFade * 0.94, 1, crimsonRim);
        }
      }

      const castDark = smooth(0, 0.12, t) * (1 - smooth(0.42, 0.72, t));
      if (castDark > 0.03) {
        p.ellipse(MX - 6, 0, 24 * castDark, 3.2, Sm[0], 0.76 * castDark * endFade);
      }

      // 2. Impact dark-crimson floor miasma ring (far half) & glossy arterial blood splats under the enemy
      if (t >= T_HIT) {
        const ageH = t - T_HIT;
        const ex = enemyX(t);
        const poolFade = (1 - smooth(1.35, 1.92, ageH)) * endFade;

        if (poolFade > 0.03) {
          const rx = 30 * ease.outCubic(clamp(ageH / 0.18));
          p.ellipse(ex - 4, 0, rx, 3.8, (d) => (d > 0.78 ? C[2] : d > 0.45 ? C[1] : Sm[0]), 0.88 * poolFade);
        }

        const uRing = ageH / 0.46;
        if (uRing < 1) {
          const rr = 12 + 66 * ease.outQuart(uRing);
          const rA = (1 - uRing) * endFade;
          for (let i = 0; i < 42; i++) {
            const th = Math.PI + (i / 41) * Math.PI;
            const px = ex - 4 + Math.cos(th) * rr;
            const py = Math.sin(th) * rr * 0.18;
            if (px >= X_MIN + 4 && px <= X_MAX - 4) {
              p.dot(px, py, uRing < 0.25 ? C[6] : C[4], rA * 0.88);
              p.dot(px, py + 1, Sm[0], rA * 0.75);
            }
          }
        }

        for (const sp of bloodSplats) {
          const age = t - sp.t0;
          if (age < 0 || age >= sp.life) continue;
          const u = age / sp.life;
          const hw = (sp.big ? 3.2 : 2.0) * (0.5 + 0.5 * smooth(0, 0.08, age));
          const fade = (1 - smooth(0.58, 1, u)) * endFade;
          const ci = u < 0.28 ? 5 : u < 0.62 ? 4 : 2;
          for (let xx = Math.floor(sp.x - hw); xx <= Math.ceil(sp.x + hw); xx++) {
            if (xx < X_MIN + 2 || xx > X_MAX - 2) continue;
            p.dot(xx, 0, Math.abs(xx - sp.x) > hw * 0.7 ? C[ci - 1] : C[ci], fade);
          }
          if (age < 0.22) {
            for (let j = 0; j < 2; j++) {
              const vx = (j ? 1 : -1) * (16 + 20 * rand(sp.seed, j, 1));
              const vy = -(36 + 34 * rand(sp.seed, j, 2));
              const dx = vx * age, dy = vy * age + 420 * age * age;
              if (dy <= 0) p.dot(sp.x + dx, dy, C[5], fade);
            }
          }
        }
      }

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-4) return;
      const endFade = 1 - smooth(T_END - 0.42, T_END - 0.04, t);
      const blackKeep = [];

      // ==== 1. ORIGIN DISPERSING BLACK SMOKE CLOUD ("起点散开一团黑烟") ====
      const lightSrc = t < T_HIT
        ? { x: swarmPos(Math.max(T_RELEASE, t))[0], y: MY, k: t >= T_RELEASE ? 0.68 : 0.25, reach: 64 }
        : { x: enemyX(t), y: -27, k: Math.max(0, 1 - (t - T_HIT) / 0.75), reach: 84 };
      puffs.draw(p, PK.SOOT, lightSrc);

      if (t < T_RELEASE) {
        const gk = ease.inQuad(clamp(t / T_RELEASE));
        drawBlackSmokeBillow(p, MX - 3, MY, 3 + 6 * gk, 0.1, Sm, C, 0.88, 1, 0.45);
        p.glow(MX - 3, MY, 13 * gk, C[4], 0.28 * gk);
      }

      if (t >= T_RELEASE && t < 1.05) {
        const [sx] = swarmPos(Math.min(t, T_HIT));
        for (const sb of originSmokeBillows) {
          if (sb.back) continue;
          const age = t - sb.t0;
          if (age < 0 || age >= sb.life) continue;
          const u = age / sb.life;
          const prog = ease.outQuart(u);
          const bx = MX + sb.dx * prog;
          const by = Math.min(-2, MY + sb.dy * prog - age * 8);
          const crimsonRim = clamp(1 - (sx - bx) / 72) * (1 - u);
          drawBlackSmokeBillow(p, bx, by, lerp(sb.r0, sb.r1, ease.outCubic(u)), u, Sm, C, endFade * 0.94, 1, crimsonRim);
        }
        const mAge = t - T_RELEASE;
        if (mAge < 0.20) {
          const uM = mAge / 0.20;
          drawAirCrescent(p, MX + 8 + 18 * ease.outCubic(uM), MY, 14 + 8 * uM, 5.5 * (1 - uM * 0.5), 11, [C[5], Sm[4], Sm[1]], (1 - uM) * 0.88);
        }
      }

      // ==== 2. STRAIGHT-LINE FLIGHT: DARK-CRIMSON MIASMA + COMPACT BLACK-DOT SWARM ("裹挟着暗红瘴气向前直线飞行") ====
      if (t >= T_RELEASE && t < T_HIT + 0.32) {
        const headX = t < T_HIT ? swarmPos(t)[0] : TX - 4;
        const tailFade = t < T_HIT ? 1 : 1 - (t - T_HIT) / 0.32;
        const tailStart = Math.max(MX + 2, headX - 86);
        const steps = Math.max(6, Math.ceil((headX - tailStart) / 2));
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const x = lerp(tailStart, headX, u);
          const hw = 7.8 * Math.pow(u, 0.70) * (0.76 + 0.24 * Math.sin(x * 0.16 - t * 32));
          for (let dy = -hw; dy <= hw; dy += 0.9) {
            const v = Math.abs(dy) / Math.max(0.5, hw);
            const col = v < 0.38 ? (u > 0.58 ? C[4] : C[3]) : v < 0.76 ? C[2] : Sm[1];
            p.blend(x, MY + dy, col, u * 0.70 * tailFade);
          }
        }
        // 3 Coiling dark-crimson miasma ribbons spiralling tightly along the straight flight line
        for (let r = 0; r < 3; r++) {
          const ph0 = t * 26 + (r * TAU) / 3;
          for (let s = 0; s <= steps; s++) {
            const u = s / steps;
            const x = lerp(tailStart + 6, headX + 3, u);
            const env = (2.6 + 5.8 * u) * Math.sin(Math.PI * Math.min(1, u * 1.15));
            const y = MY + Math.sin(u * 8.5 - ph0) * env;
            const col = u > 0.72 ? C[6] : u > 0.40 ? C[5] : C[3];
            p.dot(x, y, col, u * 0.90 * tailFade);
            if (u > 0.42) p.dot(x, y + 1, C[2], u * 0.65 * tailFade);
          }
        }
      }

      if (t >= T_RELEASE && t < T_HIT) {
        const [sx, sy] = swarmPos(t);
        p.disc(sx - 1, sy, 16.5, (d) => (d < 0.45 ? C[4] : d < 0.75 ? C[3] : C[1]), (d) => (1 - d) * 0.78);
        p.disc(sx, sy, 10.5, C[5], (d) => (1 - d) * 0.68);
        drawAirCrescent(p, sx + 12.5, sy, 11.5, 4.2, 10.5, [C[6], C[4], C[2]], 0.88);
        p.glow(sx, sy, 30, C[4], 0.50);
      }

      // ==== 3. DISCRETE STRAY BLACK DOTS DROPPED ALONG THE FLIGHT PATH ("沿途掉落零星黑点") ====
      // Each falling stray bug has a 3px dark-crimson miasma wisp tail + 1px chitin glint + solid 2px jet-black body!
      for (const sd of strayDots) {
        const u = sd.age / sd.life;
        const fade = (1 - smooth(0.62, 1, u)) * endFade;
        if (fade <= 0.05) continue;
        const rx = Math.round(sd.x), ry = Math.min(0, Math.round(sd.y));
        if (rx < X_MIN + 3 || rx > X_MAX - 3 || ry < Y_MIN + 3) continue;
        if (!sd.landed && ry < -2) {
          p.line(rx, ry - 1, rx - 1, Math.max(Y_MIN + 3, ry - 4), u < 0.55 ? C[4] : Sm[4], fade * 0.76);
          p.dot(rx + 1, ry - 1, Sm[5], fade * 0.88);
        } else {
          p.dot(rx - 1, 0, Sm[5], fade * 0.75);
        }
        p.dot(rx, ry, Sm[0], fade);
        p.dot(rx + 1, ry, Sm[0], fade);
        blackKeep.push(rx, ry, rx + 1, ry);
        if (sd.tall && ry < 0) {
          p.dot(rx, ry + 1, Sm[0], fade);
          blackKeep.push(rx, ry + 1);
        }
      }

      // ==== 4. OPPRESSIVE ENEMY HIT & GNAWING BLOOD-LIGHT BURST ("爆开一团暗红色的噬咬血光") ====
      if (t >= T_HIT) {
        const ageH = t - T_HIT;
        const ex = enemyX(t);

        // A. Oppressive arena-darkening shadow pressure drop around the outer perimeter
        const pressK = smooth(0, 0.04, ageH) * (1 - smooth(0.48, 0.90, ageH));
        if (pressK > 0.03) {
          unlight(p, ex - 70, -96, ex + 70, 8, (x, y) => {
            const d = Math.hypot((x - ex) / 70, (y + 30) / 62);
            return d > 0.55 && d < 1;
          }, 1 - 0.74 * pressK);
        }

        // Rich dark-crimson blood-glow backdrop so inner black chitin particles stay starkly silhouetted!
        if (ageH < 1.05) {
          const hazeK = (1 - smooth(0.48, 1.05, ageH)) * endFade;
          p.disc(ex + 2, -27, 46 * ease.outCubic(clamp(ageH / 0.14)), (d) => (d < 0.44 ? C[4] : d < 0.74 ? C[3] : C[1]), (d) => (1 - d) * 0.62 * hazeK);
        }

        // B. Billowing dark-crimson blood-mist clouds surging around the victim
        for (const bm of bloodMistClouds) {
          const bAge = t - bm.t0;
          if (bAge < 0 || bAge >= bm.life) continue;
          const u = bAge / bm.life;
          const prog = ease.outQuart(u);
          const bx = ex - 4 + bm.dx * prog;
          const by = Math.min(-2, -27 + bm.dy * prog - bAge * 6);
          drawBloodMistBillow(p, bx, by, lerp(bm.r0, bm.r1, ease.outCubic(u)), u, C, endFade * 0.90);
        }

        // C. Near half of ground blood-miasma shockwave ring + left/right floor blood-pressure crescents
        const uRing = ageH / 0.46;
        if (uRing < 1) {
          const rr = 12 + 66 * ease.outQuart(uRing);
          const rA = (1 - uRing) * endFade;
          for (let i = 0; i < 42; i++) {
            const th = (i / 41) * Math.PI;
            const px = ex - 4 + Math.cos(th) * rr;
            const py = Math.sin(th) * rr * 0.18;
            if (px >= X_MIN + 4 && px <= X_MAX - 4) {
              p.dot(px, py, uRing < 0.28 ? C[6] : C[5], rA * 0.94);
              p.dot(px, py + 1, C[2], rA * 0.82);
            }
          }
          const hC = 28 * (1 - uRing * 0.55), wC = 7.5 * (1 - uRing * 0.55);
          frontCrescent(p, clamp(ex - 4 + rr, X_MIN + 10, X_MAX - 10), 1, hC, wC, [C[6], C[5], C[2]], rA * 0.88);
          frontCrescent(p, clamp(ex - 4 - rr, X_MIN + 10, X_MAX - 10), -1, hC, wC, [C[6], C[5], C[2]], rA * 0.88);
        }

        // D. Asymmetric forward-driving barbed dark-crimson blood-light spikes + gapped blood-shock arcs
        for (const sp of bloodSpikes) {
          const sAge = ageH - sp.delay;
          if (sAge < 0 || sAge >= sp.life) continue;
          const u = sAge / sp.life;
          const r1 = sp.rMax * ease.outExpo(Math.min(1, u * 3.0));
          const r0 = lerp(sp.rBase0, sp.rBaseEnd, Math.pow(u, 1.35));
          const w = sp.w0 * (1 - smooth(0.45, 1, u) * 0.72);
          drawBloodSpike(p, TX + 2, -27, sp.a, r0, r1, w, sp.curve, C, 1 - u, (1 - smooth(0.58, 1, u)) * endFade);
        }

        // Gapped outer blood-shock arcs (delayed 0.04s so frame 1 is pure jagged fangs & spikes, never a circle!)
        if (ageH >= 0.04 && ageH < 0.34) {
          const uBR = (ageH - 0.04) / 0.30;
          brokenRing(p, TX + 4, -27, 22 + 52 * ease.outQuart(uBR), Math.max(1, 3.0 * (1 - uBR)), ringSegs, 0.35 + uBR * 0.8, uBR < 0.24 ? C[6] : C[5], C[3], (1 - uBR) * endFade, 0.88, 0);
        }

        // Snappy 2-frame impact blood-flare & void-black core punch
        if (ageH < 0.07) {
          const kF = 1 - ageH / 0.07;
          flare(p, TX + 2, -27, 26 * kF, kF, [C[3], C[5], C[7], WHITE]);
          p.circle(TX + 2, -27, 6.5 * kF, Sm[0]);
          blackKeep.push(TX + 2, -27, TX + 1, -27, TX + 3, -27, TX + 2, -28, TX + 2, -26);
        }

        // E. 10 Scissor-Clamping Bezier Mandible Fangs ripping RIGHT THROUGH the victim ("噬咬血光")!
        for (const jf of jawFangs) {
          const jAge = t - jf.t0;
          if (jAge < 0 || jAge >= jf.dur) continue;
          const u = jAge / jf.dur;
          const cx = ex, cy = -27;
          drawBezierJawFang(
            p,
            cx + jf.p0[0], cy + jf.p0[1],
            cx + jf.pc[0], cy + jf.pc[1],
            cx + jf.p1[0], cy + jf.p1[1],
            jf.th, u, C, endFade
          );
          if (u < 0.38) p.glow(cx, cy, 24 * (1 - u), C[4], 0.32 * (1 - u));
        }

        // F. Arterial blood droplets spurting downward
        for (const bd of bloodDrops) {
          if (bd.y > 0) continue;
          const spd = Math.hypot(bd.vx, bd.vy) || 1;
          const tail = Math.min(5.5, spd * 0.022);
          const tx = bd.x - (bd.vx / spd) * tail, ty = Math.min(0, bd.y - (bd.vy / spd) * tail);
          p.line(bd.x, bd.y, tx, ty, C[4], endFade);
          p.px(bd.x, bd.y, C[6]);
          if (bd.big) {
            p.px(bd.x + 1, bd.y, C[5]);
            p.px(bd.x, Math.min(0, bd.y + 1), C[3]);
          }
        }
      }

      ps.draw(p, "front");

      // Composite additive lights BEFORE drawing the dense pitch-black insect swarm & shattered black chitin particles!
      lights.draw(p);

      // ==== 5. POST-LIGHT CRISP PITCH-BLACK INSECT SWARM & EXPLODED CHITIN CARAPACE PARTICLES ====
      if (t >= T_RELEASE && t < T_HIT) {
        const [sx, sy] = swarmPos(t);
        const tick = Math.floor(t * 60);
        for (let i = 0; i < swarmBugs.length; i++) {
          const b = swarmBugs[i];
          const bx = Math.round(sx + b.ox + Math.cos(t * b.w1 + b.ph1) * b.ampX);
          const by = Math.round(sy + b.oy + Math.sin(t * b.w2 + b.ph2) * b.ampY);
          if (bx < X_MIN + 2 || bx > X_MAX - 2 || by < Y_MIN + 2 || by > -1) continue;
          if (((tick + i) % 4 === 0) && b.wingMod === 0) {
            p.px(bx - 1, by - 1, i % 8 === 0 ? C[6] : Sm[5]);
          }
          p.px(bx, by, Sm[0]);
          blackKeep.push(bx, by);
          if (b.big) {
            p.px(bx + 1, by, Sm[0]);
            blackKeep.push(bx + 1, by);
          }
        }
      }

      if (t >= T_HIT) {
        const glintHeat = Math.max(0, 1 - (t - T_HIT) / 0.78);
        const ex = enemyX(t);
        // 82 Tumbling angular pitch-black chitin carapace shards across all 3 velocity tiers + forward punch cone
        for (const b of bits.list) {
          const bFade = Math.min(1, b.life / 0.36) * endFade;
          const distK = clamp(1.3 - Math.hypot(b.x - ex, b.y + 27) / 80);
          drawChitinShard(p, b.x, b.y, b.a, b.s, Sm, C, glintHeat * distK, bFade, blackKeep);
        }

        // 190+ Fine 1-2px jet-black chitin carapace flecks with 1px glossy chitin rim!
        for (const cd of chitinDots) {
          const u = cd.age / cd.life;
          const cFade = (1 - smooth(0.60, 1, u)) * endFade;
          if (cFade <= 0.05) continue;
          const rx = Math.round(cd.x), ry = Math.min(0, Math.round(cd.y));
          if (rx < X_MIN + 2 || rx > X_MAX - 2 || ry < Y_MIN + 2) continue;
          if (ry < 0) {
            const rimC = cd.bloodWet && u < 0.55 ? C[6] : Sm[5];
            p.dot(rx, Math.max(Y_MIN + 2, ry - 1), rimC, cFade * 0.92);
          } else {
            p.dot(rx + 1, 0, Sm[5], cFade * 0.78);
          }
          p.dot(rx, ry, Sm[0], cFade);
          blackKeep.push(rx, ry);
          if (cd.big) {
            p.dot(rx + 1, ry, Sm[0], cFade);
            blackKeep.push(rx + 1, ry);
          }
        }
      }

      // Strip additive glow off every jet-black insect & chitin core pixel so black stays TRUE PITCH-BLACK!
      const L = p.L, w = p.w, h = p.h, ox = p.ox, oy = p.oy;
      for (let i = 0; i < blackKeep.length; i += 2) {
        const sx = p.cellX(blackKeep[i], blackKeep[i + 1]) - ox;
        const sy = p.cellY(blackKeep[i], blackKeep[i + 1]) - oy;
        if (sx >= 0 && sy >= 0 && sx < w && sy < h) L[sy * w + sx] = 0;
      }
    },
  };
}
