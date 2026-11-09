// Pale rising slash ("melee/pale-rising-slash"):
// 1. Release-to-Impact Sweep (0.00..0.56s): Warrior coils low scraping the blade across the stone, then lunges
//    and carves upward from bottom to top a razor-sharp crescent air-rending blade arc in stepped ashen
//    grey-white laced with streaming dark-crimson light currents, accompanied by 10 organically scattering
//    faceted white crystal-shard particles flung off at varied speeds and angles.
// 2. Oppressive Hit & Impact Detonation (0.15..2.15s): Tears upward through the enemy under an arena-dimming
//    shadow pressure drop with heavy hit-stop, violent screen shake, and 34px knockback skid; the impact point
//    explodes into a high-contrast blazing ashen-white 4-arm cross glare, vivid splashing scarlet-crimson
//    sparks, and 34 tiny faceted white fragments that drop from the wound, bounce on the stone, and fade away.
// Crescent and impact starburst techniques build on Sprite Fusion's open-source slash and impact VFX
// (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.

import { Particles, Bits, Lights, P, B, Rng, fit, sparkle, clamp, smooth, lerp, ease, mix, TAU, WHITE, READY } from "../../core/index.js";
import { swing, onSwing, plane, cracks, along, sliver } from "./_lib.js";
import { brokenRing, frontCrescent } from "../impacts/_lib.js";
import { unlight } from "../shadow/_lib.js";

const TX = 84;
const T_SWING = 0.06;
const T_HIT = 0.15;
const T_RIP2 = 0.24;
const T_END = 1.85;

export const meta = {
  name: "Pale rising slash",
  desc: "An upward ashen-white crescent slash laced with dark-crimson streams and white crystal shards erupts into a pale cross glare, scarlet sparks, and falling white chips.",
  tags: ["melee", "slash", "uppercut", "rising", "crescent", "pale", "crimson", "sword", "combat", "directional", "one-shot"],
  size: [336, 224],
  origin: [96, 178],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#13111a", "#252130", "#413c50", "#68627a", "#9690a8", "#c4bfd2", "#eceaf4", "#ffffff"],
    crimson: ["#1c0308", "#4a0612", "#850b1e", "#c4152a", "#f02838", "#ff595e", "#ffb5ad"],
    seed: 17,
  },
};

// Deep coiled low-guard -> floor-scraping step-in -> explosive bottom-to-top sky-rending uppercut -> poise recovery
const GUARD = { ...READY, weapon: "greatsword", two: true, x: -8, crouch: 3, lean: 2, fx: 11, fy: -21, sa: -0.88, ffx: 8, fbx: -8 };
const COIL_LOW = { ...GUARD, x: -12, crouch: 8, lean: 5, turn: 0.65, fx: -6, fy: -13, sa: 2.38, ffx: 10, fbx: -10 };
const DRAG_STEP = { ...GUARD, x: 6, crouch: 7, lean: 6, turn: 0.42, fx: 12, fy: -13, sa: 1.25, ffx: 12, fbx: -10, ghost: 1 };
const MID_RISE = { ...GUARD, x: 20, y: -1, crouch: 2, lean: 3, fx: 14, fy: -26, sa: -0.36, ffx: 12, fbx: -9, ghost: 1 };
const APEX_CUT = { ...GUARD, x: 26, y: -4, crouch: 0, lean: -1, fx: 8, fy: -36, sa: -1.52, ffx: 10, ffy: -3, fbx: -8, fby: -1, toeF: true, toeB: true, ghost: 1 };
const APEX_HOLD = { ...APEX_CUT, y: -2, crouch: 1, fx: 8, fy: -35, sa: -1.62, ffy: 0, fby: 0, ghost: 0 };
const LAND_SETTLE = { ...GUARD, x: 20, crouch: 5, lean: 3, fx: 13, fy: -23, sa: -0.52, ffx: 11, fbx: -9 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.38, GUARD],
    [-0.14, COIL_LOW],
    [T_SWING - 0.02, { ...COIL_LOW, x: -5, crouch: 9, fx: -3, fy: -12, sa: 2.12 }],
    [T_SWING, DRAG_STEP, "snap"],
    [T_SWING + 0.045, MID_RISE, "snap"],
    [T_HIT, APEX_CUT, "snap"],
    [0.38, APEX_HOLD],
    [0.64, LAND_SETTLE, "in"],
    [1.12, { ...GUARD, x: 6, crouch: 4 }],
    [1.54, GUARD],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_SWING, stop: 0.03, shake: 0.12, amp: 1.8, target: false },
    { t: T_HIT, stop: 0.18, shake: 0.50, amp: 5.4, push: 5.4, slide: 21, straw: 34, y: -31, skin: "red", shiver: 0.46, flash: 0.06 },
    { t: T_RIP2, stop: 0.04, shake: 0.26, amp: 3.4, push: 3.6, slide: 34, daze: 0.92, straw: 18, y: -38, skin: "char", shiver: 0.48, flash: 0.03 },
    { t: 1.10, push: 0, straw: 0, flash: 0, skin: null },
    { t: T_END - 0.25, push: 0, straw: 0, flash: 0, skin: null, daze: 0 },
  ],
  dust: [
    { t: T_SWING, x: 10, n: 8, dir: 1 },
    { t: T_SWING, x: -8, n: 5, dir: -1 },
    { t: T_HIT, x: TX + 6, n: 11, dir: 1 },
    { t: T_RIP2, x: TX + 22, n: 8, dir: 1 },
    { t: 0.66, x: 20, n: 6, dir: 1 },
  ],
};

// Safe local canvas bounds inside [336, 224] with origin [96, 178] -> x in [-96..239], y in [-178..45]
const X_MIN = -90, X_MAX = 233, Y_MIN = -172;

// Zero-checkerboard smooth crescent shader (`p.px` / `p.blend`, clamped cleanly above y = 0)
function smoothCrescent(p, s, u0, u1, wMax, fn) {
  if (u1 - u0 < 0.01 || wMax < 0.4) return;
  const c = Math.cos(s.rot), n = Math.sin(s.rot), A = s.R + 5, Bn = A * s.sy + 5;
  const hx = Math.ceil(Math.hypot(A * c, Bn * n) + 3), hy = Math.ceil(Math.hypot(A * n, Bn * c) + 3);
  const rIn = s.R - wMax - 2;
  const x0 = Math.max(X_MIN, Math.floor(s.cx - hx));
  const x1 = Math.min(X_MAX, Math.ceil(s.cx + hx));
  const y0 = Math.max(Y_MIN, Math.floor(s.cy - hy));
  const y1 = Math.min(0, Math.ceil(s.cy + hy));
  const out = { c: 0, a: 0 };

  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const [r, a] = plane(s, px, py);
      if (r > s.R + 3.5 || r < rIn) continue;
      let u = (s.dir * (a - s.a0)) % TAU;
      if (u < 0) u += TAU;
      while (u < u0) u += TAU;
      if (u > u1) continue;
      out.a = 0;
      fn(u, r, out, a);
      if (out.a > 0.94) p.px(x, y, out.c);
      else if (out.a > 0.03) p.blend(x, y, out.c, out.a);
    }
  }
}

// Jewel-crisp faceted white crystal-shard particle ("伴随几颗飞散的白色碎晶粒子"):
// Distinct 4-8px diamond/kite prism with pure-WHITE upper facet, pale-ash lower facet, dark-slate rim, and motion tail!
function drawCrystalShard(p, x, y, vx, vy, a, len, wid, C, Cr, alpha, twinkle = false) {
  if (alpha <= 0.04 || y > 0 || x < X_MIN + 7 || x > X_MAX - 7 || y < Y_MIN + 7) return;
  const spd = Math.hypot(vx, vy) || 1;
  const tLen = Math.min(7.0, spd * 0.048);
  p.line(x, y, x - (vx / spd) * tLen, Math.min(0, y - (vy / spd) * tLen), C[4], alpha * 0.65);

  const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
  const tipF = [x + ca * len, Math.min(0, y + sa * len)];
  const tipB = [x - ca * len * 0.78, Math.min(0, y - sa * len * 0.78)];
  const sideL = [x + nx * wid, Math.min(0, y + ny * wid)];
  const sideR = [x - nx * wid, Math.min(0, y - ny * wid)];

  p.poly([
    [tipF[0] + ca * 0.85, Math.min(0, tipF[1] + sa * 0.85)],
    [sideL[0] + nx * 0.85, Math.min(0, sideL[1] + ny * 0.85)],
    [tipB[0] - ca * 0.85, Math.min(0, tipB[1] - sa * 0.85)],
    [sideR[0] - nx * 0.85, Math.min(0, sideR[1] - ny * 0.85)],
  ], C[1], alpha * 0.94);

  p.tri(tipF[0], tipF[1], sideL[0], sideL[1], tipB[0], tipB[1], WHITE, alpha);
  p.tri(tipF[0], tipF[1], tipB[0], tipB[1], sideR[0], sideR[1], C[5], alpha);
  p.line(tipB[0], tipB[1], tipF[0], tipF[1], WHITE, alpha);

  if (twinkle) {
    sparkle(p, tipF[0], tipF[1], Math.max(3.0, len * 0.72), WHITE, Cr[5], 0.42 * alpha);
  }
}

// Blazing Ashen-White Cross-Shaped Intense Glare ("受击点爆开一团灰白十字强光"):
// Tilted slightly forward (+0.11 rad) opposite to the upper-left crescent curve, with a crisp dark-slate/crimson
// contrast border around all 4 cross blades so EVERY arm (up, down, left, right) pops starkly off the crescent!
function drawPaleCrossGlare(p, cx, cy, armH, armVUp, w0, tilt, u, C, Cr, alpha) {
  if (alpha <= 0.03) return;
  const pop = ease.outExpo(clamp(u / 0.11));
  const shrink = 1 - smooth(0.28, 1, u);
  const fade = (1 - smooth(0.58, 1, u)) * alpha;
  if (fade <= 0.03 || shrink <= 0.02) return;

  const downRoom = Math.max(4, Math.abs(cy) - 1);
  const arms = [
    { a: tilt, L: armH * pop * (0.58 + 0.42 * shrink), w: w0 * shrink, main: true },
    { a: tilt + Math.PI, L: armH * 0.92 * pop * (0.58 + 0.42 * shrink), w: w0 * shrink, main: true },
    { a: tilt - Math.PI / 2, L: armVUp * pop * (0.58 + 0.42 * shrink), w: w0 * 0.94 * shrink, main: true },
    { a: tilt + Math.PI / 2, L: Math.min(downRoom / Math.max(0.2, Math.cos(tilt)), armVUp * 0.85 * pop * (0.58 + 0.42 * shrink)), w: w0 * 0.90 * shrink, main: true },
    // Short diagonal glints at the core intersection (<24% length so the 4-arm CROSS silhouette dominates!)
    { a: tilt - 0.78, L: armH * 0.23 * pop * shrink, w: w0 * 0.38 * shrink, main: false },
    { a: tilt + 0.78, L: Math.min(downRoom / 0.72, armH * 0.22 * pop * shrink), w: w0 * 0.36 * shrink, main: false },
    { a: tilt - 2.36, L: armH * 0.23 * pop * shrink, w: w0 * 0.38 * shrink, main: false },
    { a: tilt + 2.36, L: Math.min(downRoom / 0.72, armH * 0.22 * pop * shrink), w: w0 * 0.36 * shrink, main: false },
  ];

  // Pass 0: Dark-slate/crimson silhouette sheath (`C[1]`/`Cr[1]`) so the upper cross arm separates cleanly from the pale crescent!
  for (const arm of arms) {
    if (!arm.main || arm.L < 3) continue;
    const ca = Math.cos(arm.a), sa = Math.sin(arm.a), nx = -sa, ny = ca;
    const tipX = clamp(cx + ca * (arm.L + 1.5), X_MIN + 2, X_MAX - 2);
    const tipY = Math.min(0, Math.max(Y_MIN + 2, cy + sa * (arm.L + 1.5)));
    const midX = cx + ca * arm.L * 0.18, midY = Math.min(0, cy + sa * arm.L * 0.18);
    const wDark = Math.max(1.4, arm.w + 1.6);
    p.poly([
      [cx - ca * 2, Math.min(0, cy - sa * 2)],
      [midX + nx * wDark, Math.min(0, midY + ny * wDark)],
      [tipX, tipY],
      [midX - nx * wDark, Math.min(0, midY - ny * wDark)],
    ], u < 0.26 ? mix(C[1], Cr[2], 0.55) : C[1], fade * 0.88);
  }

  for (const arm of arms) {
    if (arm.L < 2) continue;
    const ca = Math.cos(arm.a), sa = Math.sin(arm.a), nx = -sa, ny = ca;
    const tipX = clamp(cx + ca * arm.L, X_MIN + 2, X_MAX - 2);
    const tipY = Math.min(0, Math.max(Y_MIN + 2, cy + sa * arm.L));
    const midX = cx + ca * arm.L * 0.18, midY = Math.min(0, cy + sa * arm.L * 0.18);
    const wOuter = Math.max(0.9, arm.w);
    const wMid = Math.max(0.55, arm.w * 0.58);

    // Pass 1: Stepped ashen grey-white outer wing (`C[4]`/`C[3]`)
    p.poly([
      [cx - ca * 2, Math.min(0, cy - sa * 2)],
      [midX + nx * wOuter, Math.min(0, midY + ny * wOuter)],
      [tipX, tipY],
      [midX - nx * wOuter, Math.min(0, midY - ny * wOuter)],
    ], u < 0.26 ? C[4] : C[3], fade * 0.94);

    // Pass 2: Bright pale bone-white inner blade (`C[6]`)
    p.poly([
      [cx, cy],
      [midX + nx * wMid, Math.min(0, midY + ny * wMid)],
      [tipX, tipY],
      [midX - nx * wMid, Math.min(0, midY - ny * wMid)],
    ], C[6], fade);

    // Pass 3: Blinding pure WHITE razor cross-spine!
    p.line(cx, cy, tipX, tipY, WHITE, fade);
    if (arm.main && wMid > 1.0) {
      p.line(cx + nx * 0.75, Math.min(0, cy + ny * 0.75), cx + ca * arm.L * 0.74, Math.min(0, cy + sa * arm.L * 0.74), WHITE, fade);
      p.line(cx - nx * 0.75, Math.min(0, cy - ny * 0.75), cx + ca * arm.L * 0.74, Math.min(0, cy + sa * arm.L * 0.74), WHITE, fade);
    }

    if (arm.main) {
      p.glowLine(cx, cy, tipX, tipY, 6, C[5], 0.48 * fade);
    }
  }

  // Stepped ashen-to-white diamond core at the cross center
  const hr = (9.0 * shrink + 2.0) * pop;
  p.circle(cx, cy, hr + 2.8, C[3], fade * 0.86);
  p.circle(cx, cy, hr + 1.1, C[5], fade * 0.95);
  p.circle(cx, cy, hr * 0.72, WHITE, fade);
}

// Faceted tumbling tiny white fragment ("同时掉落细小白色碎块"):
// Crisp 2-4px angular pale-white chunk with 1px dark rim, pure WHITE top facet, and pale-ash side so it pops in mid-air AND on stone!
function drawWhiteFragment(p, b, C, alpha) {
  const fade = Math.min(1, b.life / 0.34) * alpha;
  if (fade <= 0.04 || b.x < X_MIN + 4 || b.x > X_MAX - 4 || b.y < Y_MIN + 4) return;
  const rx = Math.round(b.x), ry = Math.min(0, Math.round(b.y));
  const ca = Math.cos(b.a), sa = Math.sin(b.a);

  if (b.s >= 2.25) {
    const ox = Math.round(ca * 1.4), oy = Math.min(0, Math.round(sa * 1.1));
    // 1px dark outline base & right edge
    p.dot(rx - 1, Math.min(0, ry + 1), C[1], fade * 0.94);
    p.dot(rx, Math.min(0, ry + 1), C[1], fade * 0.94);
    p.dot(rx + 1, Math.min(0, ry + 1), C[2], fade * 0.92);
    p.dot(rx + 2, ry, C[1], fade * 0.90);
    // Faceted pale-ash & pure-WHITE body
    p.dot(rx - 1, ry, C[4], fade);
    p.dot(rx + 1, ry, C[5], fade);
    p.dot(rx + ox, Math.min(0, ry + oy - 1), C[6], fade);
    p.dot(rx, ry, WHITE, fade);
    p.dot(rx, Math.max(Y_MIN + 2, ry - 1), WHITE, fade);
    p.dot(rx + 1, Math.max(Y_MIN + 2, ry - 1), C[6], fade);
  } else {
    p.dot(rx + 1, ry, C[1], fade * 0.92);
    p.dot(rx, ry, C[5], fade);
    p.dot(rx + 1, Math.max(Y_MIN + 2, ry - 1), C[6], fade);
    p.dot(rx, Math.max(Y_MIN + 2, ry - 1), WHITE, fade);
  }
}

// Perspective ground shockwave ellipse split cleanly into back/front halves
function drawFloorShockRing(p, cx, cy, r, sy, th, u, C, Cr, alpha, back) {
  if (alpha <= 0.03 || r <= 2) return;
  const x0 = Math.max(X_MIN, Math.floor(cx - r - th - 2));
  const x1 = Math.min(X_MAX, Math.ceil(cx + r + th + 2));
  const ry = (r + th) * sy + 2;
  const y0 = back ? Math.max(Y_MIN, Math.floor(cy - ry)) : Math.floor(cy);
  const y1 = back ? Math.floor(cy) : Math.min(18, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / sy;
    if (back ? dy >= 0 : dy < 0) continue;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const d = Math.hypot(dx, dy);
      const off = Math.abs(d - r);
      if (off > th) continue;
      const ang = Math.atan2(dy, dx);
      if (u > 0.32 && Math.sin(ang * 6 + 0.7) < (u - 0.32) * 1.45 - 0.22) continue;
      const q = off / Math.max(0.5, th);
      const col = q < 0.35 ? (u < 0.22 ? WHITE : C[5]) : q < 0.72 ? C[3] : Cr[2];
      p.dot(x, y, col, alpha * (1 - q * 0.65));
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8);
  const Cr = fit(o.crimson, 7);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, Cr[6], Cr[5], Cr[4], Cr[2]],
    haze: Cr[3],
  });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  // ============================================================================
  // COLOSSAL BOTTOM-TO-TOP RISING CRESCENT GEOMETRY:
  // Center (26, -54), Radius 75, dir = -1 (counter-clockwise on screen = BOTTOM -> FRONT-RIGHT -> TOP!).
  // ============================================================================
  const SPAN = 2.80;
  const mainArc = swing({
    cx: 26,
    cy: -54,
    R: 75,
    sy: 0.96,
    rot: -0.10,
    a0: 1.35,
    dir: -1,
    span: SPAN,
  });
  const crimsonEchoArc = swing({
    cx: 24,
    cy: -53,
    R: 54,
    sy: 0.96,
    rot: -0.10,
    a0: 1.25,
    dir: -1,
    span: 2.44,
  });

  const HX = TX + 3, HY = -32;

  // 9 Swept-back air-rending serration wisps along the outer rim ("破空刀光")
  const windNotches = Array.from({ length: 9 }, (_, i) => ({
    u0: 0.12 + i * 0.092,
    u1: 0.20 + i * 0.092,
    h: i >= 2 && i <= 6 ? R.range(3.5, 6.2) : R.range(2.0, 3.4),
  }));

  // 10 Organically Scattering Faceted White Crystal-Shard Particles ("伴随几颗飞散的白色碎晶粒子"):
  // Early shards peel visibly off the lower-outer rising arc by t = 0.09..0.12s, while mid/upper shards
  // disperse at varied radial depths, 3x varied launch speeds, and wide angular spread!
  const crystalShards = Array.from({ length: 10 }, (_, i) => {
    const uFrac = clamp(0.14 + (i / 9) * 0.78 + R.range(-0.05, 0.05), 0.10, 0.94);
    const uRad = uFrac * SPAN;
    const radOff = i < 3
      ? R.range(6, 13)
      : (i % 3 === 0 ? R.range(4, 11) : i % 3 === 1 ? R.range(-18, -6) : R.range(-5, 4));
    const [sx, sy] = onSwing(mainArc, mainArc.R + radOff, uRad);
    const [sx2, sy2] = onSwing(mainArc, mainArc.R, uRad + 0.05);
    const baseAng = Math.atan2(sy2 - sy, sx2 - sx);
    const outAng = Math.atan2(sy - mainArc.cy, sx - mainArc.cx);
    const launchAng = lerp(baseAng, outAng, R.range(0.32, 0.82)) + R.range(-0.36, 0.36);
    const sp = i < 3 ? R.range(92, 142) : (i % 3 === 0 ? R.range(95, 148) : i % 3 === 1 ? R.range(38, 68) : R.range(64, 104));
    return {
      t0: i < 3 ? T_SWING + 0.006 + i * 0.009 : T_SWING + uFrac * 0.095 + R.range(0, 0.022),
      x0: sx,
      y0: Math.min(-3, sy),
      vx: Math.cos(launchAng) * sp,
      vy: Math.sin(launchAng) * sp - R.range(8, 26),
      drag: R.range(1.7, 3.1),
      a0: launchAng + R.range(-0.4, 0.4),
      va: R.sign() * R.range(6, 15),
      len: i % 3 === 0 ? R.range(6.4, 8.2) : i % 3 === 1 ? R.range(4.0, 5.2) : R.range(5.2, 6.6),
      wid: i % 3 === 0 ? R.range(2.8, 3.5) : i % 3 === 1 ? R.range(1.9, 2.4) : R.range(2.3, 2.9),
      life: R.range(0.44, 0.72),
      twinkle: i % 2 === 0,
    };
  });

  // 36 Heavy two-tone scarlet-crimson spark streaks ("飞溅的赤红火花")
  const scarletSparks = [];

  const floorCracks = cracks(R, TX + 6, 8, 54, 6, 0.42);

  const ringSegs = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * TAU + 0.38 + R.range(-0.06, 0.06);
    return { a, gap: Math.sin(a) > 0.34 ? 0 : R.range(0.64, 0.86), dr: R.range(0.18, 0.46), w: R.range(0.8, 1.2) };
  });

  const airSlivers = Array.from({ length: 7 }, (_, i) => ({
    a: -1.35 + (i / 6) * 2.15 + R.range(-0.06, 0.06),
    r0: R.range(18, 26),
    v: R.range(150, 240),
    arc: R.range(0.26, 0.42),
    crimson: i % 2 === 1,
  }));

  const enemyX = (tt) => {
    if (tt <= T_HIT) return TX;
    const s1 = 21 * (1 - Math.exp(-8.5 * (tt - T_HIT)));
    const s2 = tt > T_RIP2 ? 13 * (1 - Math.exp(-8.5 * (tt - T_RIP2))) : 0;
    return TX + s1 + s2;
  };

  let t = 0;
  let swung = false, hitDone = false, rip2Done = false;
  let scrapeAcc = 0;

  return {
    update(dt) {
      t += dt;

      // Pre-swing (0.00..0.06s): blade tip scrapes along the stone floor kicking up pale & crimson sparks
      if (t < T_SWING) {
        const u = clamp(t / T_SWING);
        const gx = lerp(-4, 38, u);
        for (scrapeAcc += dt * 95; scrapeAcc >= 1; scrapeAcc -= 1) {
          ps.spawn(P.SPARK, gx, -1, -R.range(25, 85), -R.range(18, 65), R.range(0.10, 0.22), R.chance(0.58) ? Cr[5] : C[6], 1);
        }
      }

      // Phase 1 (T_SWING = 0.06s): Floor-ripping upward launch off the stone!
      if (!swung && t >= T_SWING) {
        swung = true;
        lights.add(42, -10, 42, C[5], 0.48, 0.22);
        lights.add(58, -26, 38, Cr[4], 0.46, 0.28);
        for (let i = 0; i < 8; i++) {
          ps.spawn(P.DUST, 36 + R.range(-8, 12), -1, R.range(-35, 65), -R.range(12, 42), R.range(0.28, 0.52), C[4], R.range(2.2, 3.8));
        }
        for (let i = 0; i < 14; i++) {
          const uRad = R.range(0.10, 0.90) * SPAN;
          const [mx, my] = onSwing(mainArc, mainArc.R - R.range(6, 18), uRad);
          if (my < -2) {
            ps.spawn(P.VAPOUR, mx, my, R.range(-12, 28), -R.range(18, 52), R.range(0.20, 0.38), R.chance(0.68) ? Cr[3] : C[2], R.range(3.0, 5.2), uRad * 0.03);
          }
        }
      }

      // Phase 2 (T_HIT = 0.15s): Blazing Pale Cross Glare + Splashing Scarlet Sparks + Dropping Tiny White Fragments!
      if (!hitDone && t >= T_HIT) {
        hitDone = true;
        lights.add(HX, HY, 68, C[5], 0.82, 0.40);
        lights.add(HX, HY, 48, Cr[4], 0.72, 0.48);
        lights.add(HX, HY, 24, WHITE, 0.95, 0.09);
        lights.add(HX + 16, -8, 48, Cr[3], 0.52, 0.54);

        // Skid dust at the enemy's feet as it gets violently shoved backward
        for (let i = 0; i < 9; i++) {
          ps.spawn(P.DUST, TX + R.range(2, 24), -1, R.range(25, 95), -R.range(8, 32), R.range(0.32, 0.62), C[4], R.range(2.4, 4.2), R.range(0, 0.08));
        }

        // 1) 48 Fast scarlet-crimson sparks via Particles + 36 thick two-tone scarlet spark-streaks ("飞溅的赤红火花")!
        for (let i = 0; i < 48; i++) {
          const back = R.chance(0.24);
          const a = back ? Math.PI + R.range(-0.75, 0.55) : -0.58 + R.range(-1.08, 0.98);
          const sp = R.range(140, 365) * (back ? 0.68 : 1);
          ps.spawn(
            P.SPARK,
            HX + R.range(-4, 4),
            HY + R.range(-6, 6),
            Math.cos(a) * sp + 18,
            Math.sin(a) * sp - 24,
            R.range(0.24, 0.70),
            R.pick([Cr[5], Cr[4], Cr[6]]),
            R.chance(0.55) ? 2 : 1,
            R.chance(0.25) ? R.range(0, 0.04) : 0
          );
        }

        for (let i = 0; i < 36; i++) {
          const a = -0.62 + R.range(-1.38, 1.28);
          const sp = R.range(135, 345);
          scarletSparks.push({
            x: HX + R.range(-4, 5),
            y: HY + R.range(-6, 6),
            vx: Math.cos(a) * sp + 22,
            vy: Math.sin(a) * sp - 28,
            g: R.range(360, 560),
            drag: R.range(1.4, 2.6),
            bounce: R.range(0.38, 0.58),
            age: 0,
            life: R.range(0.46, 0.98),
            hot: i % 3 === 0,
            thick: i % 2 === 0,
          });
        }

        // 2) 34 Tumbling Tiny White Fragments ("同时掉落细小白色碎块") dropping & bouncing onto the floor!
        for (let i = 0; i < 34; i++) {
          const downwardDrop = i < 14;
          const a = downwardDrop
            ? Math.PI * 0.5 + R.range(-0.88, 0.88)
            : -Math.PI * 0.5 + R.range(-1.15, 1.25);
          const sp = downwardDrop ? R.range(32, 110) : R.range(60, 195);
          bits.add({
            kind: i % 2 === 0 ? B.CHUNK : B.SHARD,
            x: HX + R.range(-8, 10),
            y: HY + R.range(-10, 8),
            vx: clamp(Math.cos(a) * sp + 22, -130, 190),
            vy: Math.sin(a) * sp - (downwardDrop ? 8 : R.range(20, 68)),
            g: 0.72,
            drag: R.range(0.9, 1.8),
            bounce: R.range(0.32, 0.48),
            life: R.range(0.92, 1.52),
            a: R.range(0, TAU),
            va: R.sign() * R.range(10, 24),
            s: i % 2 === 0 ? R.range(2.3, 3.2) : R.range(1.7, 2.2),
          });
        }

        // Crisp star twinkles framing the cross glare
        for (let i = 0; i < 8; i++) {
          const a = R.range(0, TAU), d = R.range(18, 40);
          ps.spawn(
            P.STAR,
            HX + Math.cos(a) * d,
            Math.min(-4, HY + Math.sin(a) * d * 0.85),
            Math.cos(a) * 14,
            Math.sin(a) * 14 - 8,
            R.range(0.22, 0.44),
            i % 3 === 0 ? Cr[5] : WHITE,
            R.range(1.8, 3.0),
            R.range(0.05, 0.22)
          );
        }
      }

      // Secondary rising apex burst (T_RIP2 = 0.24s)
      if (!rip2Done && t >= T_RIP2) {
        rip2Done = true;
        const ex = enemyX(t);
        lights.add(ex, -42, 42, Cr[4], 0.65, 0.24);
        for (let i = 0; i < 16; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(95, 240);
          ps.spawn(P.SPARK, ex, -40, Math.cos(a) * sp + 16, Math.sin(a) * sp - 18, R.range(0.18, 0.44), Cr[5], 2);
        }
        for (let i = 0; i < 8; i++) {
          bits.add({
            kind: B.CHUNK,
            x: ex + R.range(-5, 6),
            y: -40 + R.range(-6, 4),
            vx: R.range(-40, 120),
            vy: -R.range(30, 115),
            g: 0.74,
            drag: R.range(1.0, 1.8),
            bounce: 0.36,
            life: R.range(0.80, 1.32),
            a: R.range(0, TAU),
            va: R.sign() * R.range(12, 24),
            s: R.range(2.0, 2.9),
          });
        }
      }

      // Step custom scarlet-crimson heavy spark streaks
      for (let i = scarletSparks.length - 1; i >= 0; i--) {
        const sp = scarletSparks[i];
        sp.age += dt;
        if (sp.age >= sp.life || t >= T_END - 0.05) {
          scarletSparks.splice(i, 1);
          continue;
        }
        const dec = Math.exp(-sp.drag * dt);
        sp.vx *= dec;
        sp.vy = sp.vy * dec + sp.g * dt;
        sp.x = clamp(sp.x + sp.vx * dt, X_MIN + 5, X_MAX - 5);
        sp.y += sp.vy * dt;
        if (sp.y >= 0) {
          sp.y = 0;
          sp.vy = -Math.abs(sp.vy) * sp.bounce;
          sp.vx *= 0.72;
        }
      }

      bits.update(dt);
      for (const b of bits.list) {
        b.x = clamp(b.x, X_MIN + 6, X_MAX - 6);
        b.y = clamp(b.y, Y_MIN + 6, 0);
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
      const endFade = 1 - smooth(T_END - 0.38, T_END - 0.04, t);

      // 1. Floor blade-scrape gouge from caster to enemy
      if (t >= 0.01 && t < 1.15) {
        const gFade = (1 - smooth(0.65, 1.15, t)) * endFade;
        const gEnd = lerp(0, 64, clamp(t / 0.11));
        p.line(-4, 0, gEnd, 0, t < 0.24 ? C[6] : C[3], gFade * 0.88);
        p.line(2, 1, gEnd - 4, 1, t < 0.28 ? Cr[3] : C[1], gFade * 0.78);
      }

      // 2. Impact ground cracks & far half of pale/crimson floor shockwave ring
      if (t >= T_HIT) {
        const ageH = t - T_HIT;
        const cFade = (1 - smooth(0.85, 1.48, ageH)) * endFade;
        if (cFade > 0.03) {
          const grow = 56 * ease.outQuart(clamp(ageH / 0.16));
          const heat = Math.max(0, 1 - ageH / 0.48);
          for (const c of floorCracks) {
            along(c.pts, grow, (x0, y0, x1, y1, d) => {
              const h = heat * (1 - d / 56);
              p.line(x0, y0, x1, y1, h > 0.45 ? C[6] : h > 0.2 ? Cr[3] : C[1], cFade);
            });
          }
        }
        const uRing = ageH / 0.42;
        if (uRing < 1) {
          drawFloorShockRing(p, HX + 4, 0, 10 + 60 * ease.outQuart(uRing), 0.19, Math.max(1, 3.0 * (1 - uRing)), uRing, C, Cr, (1 - uRing) * endFade * 0.88, true);
        }
      }

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-4) return;
      const endFade = 1 - smooth(T_END - 0.38, T_END - 0.04, t);

      // ==== 0. PRE-RELEASE LOW BLADE GLINT (0.00..0.08s) ====
      if (t < T_SWING + 0.025) {
        const uG = clamp(t / T_SWING);
        const gx = lerp(-4, 38, uG);
        sparkle(p, gx, -3, 4 + 5 * uG, WHITE, Cr[4], 0.58);
        p.glow(gx, -3, 18, Cr[4], 0.38 * uG);
      }

      // ==== 1. RISING ASHEN-WHITE CRESCENT LACED WITH DARK-CRIMSON FLOWING LIGHT (0.06..0.54s) ====
      const sAge = t - T_SWING;
      const sweepDur = 0.125, holdDur = 0.075, trailDur = 0.28;
      const totalSlashLife = sweepDur + holdDur + trailDur;

      if (sAge >= 0 && sAge < totalSlashLife) {
        const lifeU = clamp(sAge / totalSlashLife);
        const head = ease.outQuart(clamp(sAge / sweepDur));
        const tail = smooth(sweepDur + holdDur, totalSlashLife, sAge);
        const u0 = SPAN * tail;
        const u1 = SPAN * head;
        const spanShrink = clamp((u1 - u0) / 1.15, 0, 1);
        const wMax = 30 * (1 - tail * 0.62) * (0.28 + 0.72 * spanShrink);

        // A. Secondary inner dark-crimson phantom echo crescent
        if (sAge > 0.02 && tail < 0.90) {
          const eHead = ease.outQuart(clamp((sAge - 0.02) / 0.13));
          const eTail = smooth(0.16, 0.42, sAge);
          if (eHead > eTail + 0.03) {
            smoothCrescent(p, crimsonEchoArc, crimsonEchoArc.span * eTail, crimsonEchoArc.span * eHead, 6.5 * (1 - eTail * 0.65), (uu, r, out) => {
              const v = (uu - crimsonEchoArc.span * eTail) / Math.max(0.02, crimsonEchoArc.span * (eHead - eTail));
              const w = 6.5 * (1 - eTail * 0.65) * Math.sin(Math.PI * Math.pow(v, 1.35));
              if (w < 0.4) return;
              const q = (crimsonEchoArc.R - r) / w;
              if (q < 0 || q > 1) return;
              out.c = q < 0.35 ? Cr[4] : q < 0.72 ? Cr[2] : Cr[0];
              out.a = (1 - eTail) * (1 - q * 0.4) * Math.min(1, v * 2.5) * 0.84;
            });
          }
        }

        // B. Main Fierce Bottom-to-Top Ashen Grey-White Crescent Laced with Streaming Dark-Crimson Light!
        if (tail < 1 && u1 - u0 > 0.03) {
          smoothCrescent(p, mainArc, u0, u1, wMax, (uu, r, out) => {
            const v = (uu - u0) / (u1 - u0);
            const ug = uu / SPAN;

            let rimBoost = 0;
            for (let i = 0; i < windNotches.length; i++) {
              const wn = windNotches[i];
              if (ug >= wn.u0 && ug < wn.u1) {
                const f = (ug - wn.u0) / (wn.u1 - wn.u0);
                rimBoost = (f < 0.22 ? (f / 0.22) : 1 - (f - 0.22) / 0.78) * wn.h * (1 - lifeU * 0.45) * spanShrink;
                break;
              }
            }

            const outerR = mainArc.R + rimBoost * 0.55;
            const crescentEnv = Math.pow(Math.sin(Math.PI * Math.pow(v, 1.28)), 0.66);
            const w = (wMax + rimBoost) * crescentEnv;
            if (w < 0.45) return;

            const q = (outerR - r) / w;
            if (q < 0 || q > 1) return;

            // Organic, tapered Dark-Crimson Flowing Light currents ("夹杂暗红流光")
            const flowPhase = uu * 5.8 - t * 38;
            const veinCenter1 = 0.38 + 0.13 * Math.sin(uu * 4.2 - t * 26) + 0.05 * Math.cos(uu * 9.1 + 0.8);
            const veinHalfW1 = 0.125 * Math.sin(Math.PI * clamp(v * 1.08)) * (0.65 + 0.35 * Math.sin(flowPhase));
            const d1 = Math.abs(q - veinCenter1);

            const veinCenter2 = 0.72 + 0.09 * Math.cos(uu * 6.8 - t * 34 + 1.9);
            const veinHalfW2 = 0.080 * Math.sin(Math.PI * clamp((v - 0.08) * 1.12)) * (0.60 + 0.40 * Math.cos(flowPhase * 1.3));
            const d2 = Math.abs(q - veinCenter2);

            const hotPulse = Math.sin(uu * 11.0 - t * 52);

            let col;
            if (q < 0.095 && lifeU < 0.68) {
              col = WHITE;
            } else if (d1 < veinHalfW1 && veinHalfW1 > 0.025) {
              col = d1 < veinHalfW1 * 0.35
                ? (hotPulse > 0.30 ? Cr[5] : Cr[4])
                : d1 < veinHalfW1 * 0.70
                  ? Cr[3]
                  : Cr[1];
            } else if (d2 < veinHalfW2 && veinHalfW2 > 0.02) {
              col = d2 < veinHalfW2 * 0.44 ? Cr[4] : Cr[2];
            } else if (q < 0.24) {
              col = lifeU < 0.45 ? C[6] : C[5];
            } else if (q < 0.48) {
              col = lifeU < 0.35 ? C[5] : C[4];
            } else if (q < 0.74) {
              col = lifeU < 0.35 ? C[4] : C[3];
            } else if (q < 0.90) {
              col = C[2];
            } else {
              col = mix(C[1], Cr[1], 0.50);
            }

            out.c = col;
            out.a = Math.min(1, v / 0.10) * (1 - smooth(0.74, 1, lifeU) * 0.88) * (q > 0.88 ? (1 - q) / 0.12 : 1);
          });

          // Curved concentric air-rending wind-streams strictly behind the leading blade tip (u <= u1 — NEVER vertical ruler lines!)
          if (sAge < 0.26) {
            const kWind = (1 - sAge / 0.26) * 0.85;
            for (const [rOff, lag0, lag1, col] of [
              [5.5, 0.15, 0.62, C[5]],
              [8.5, 0.28, 0.78, Cr[4]],
              [-wMax * 0.85 - 4, 0.18, 0.72, C[4]],
            ]) {
              const wa0 = lerp(u0, u1, lag0);
              const wa1 = lerp(u0, u1, lag1);
              for (let uu = wa0; uu < wa1; uu += 0.022) {
                const [wx, wy] = onSwing(mainArc, mainArc.R + rOff, uu);
                if (wy <= -1 && wx > X_MIN + 4 && wx < X_MAX - 4) {
                  const env = Math.sin(Math.PI * ((uu - wa0) / Math.max(0.02, wa1 - wa0)));
                  p.dot(wx, wy, col, kWind * env);
                }
              }
            }
          }

          // Restrained pale & crimson glow riding the crescent
          for (let uu = u0; uu <= u1; uu += 0.24) {
            const [gx, gy] = onSwing(mainArc, mainArc.R - wMax * 0.36, uu);
            if (gy <= -2 && gx > X_MIN + 24 && gx < X_MAX - 24 && gy > Y_MIN + 24) {
              const v = (uu - u0) / Math.max(0.05, u1 - u0);
              p.glow(gx, gy, 16, v > 0.62 ? C[5] : Cr[4], 0.18 * (1 - lifeU) * v);
            }
          }

          // Lingering pale/crimson wake trace along the path already carved
          if (tail > 0.04) {
            const trFade = (1 - smooth(0.55, 1, lifeU)) * 0.78;
            for (let uu = u0 * 0.35; uu < u0; uu += 0.025) {
              const [wx, wy] = onSwing(mainArc, mainArc.R - 1, uu);
              if (wy <= -1) p.dot(wx, wy, ((Math.round(uu * 40)) & 1) ? C[5] : Cr[3], trFade * (uu / Math.max(0.05, u0)));
            }
          }

          // Leading upward crescent horn star-glint!
          if (sAge < sweepDur + 0.08) {
            const [tx, ty] = onSwing(mainArc, mainArc.R - 2, u1);
            if (ty <= -2) {
              sparkle(p, tx, ty, 8.5 * (1 - sAge / (sweepDur + 0.08)), WHITE, Cr[5], 0.58);
            }
          }
        }
      }

      // ==== 2. SCATTERING WHITE CRYSTAL-SHARD PARTICLES ALONG THE RISING ARC ("伴随几颗飞散的白色碎晶粒子") ====
      for (let i = 0; i < crystalShards.length; i++) {
        const cs = crystalShards[i];
        const cAge = t - cs.t0;
        if (cAge < 0 || cAge >= cs.life) continue;
        const u = cAge / cs.life;
        const damp = (1 - Math.exp(-cs.drag * cAge)) / cs.drag;
        const cx = cs.x0 + cs.vx * damp;
        const cy = cs.y0 + cs.vy * damp + 52 * cAge * cAge;
        const curVx = cs.vx * Math.exp(-cs.drag * cAge);
        const curVy = cs.vy * Math.exp(-cs.drag * cAge) + 104 * cAge;
        const shrink = 1 - smooth(0.58, 1, u) * 0.65;
        const cFade = (1 - smooth(0.66, 1, u)) * endFade;
        drawCrystalShard(
          p,
          cx,
          cy,
          curVx,
          curVy,
          cs.a0 + cs.va * cAge,
          cs.len * shrink,
          cs.wid * shrink,
          C,
          Cr,
          cFade,
          cs.twinkle && ((Math.floor(t * 30) + i) % 3 === 0)
        );
      }

      // ==== 3. OPPRESSIVE HIT & IMPACT RESULT VFX ("受击点爆开一团灰白十字强光与飞溅的赤红火花，同时掉落细小白色碎块") ====
      if (t >= T_HIT) {
        const ageH = t - T_HIT;
        const ex = enemyX(t);

        // A. Near half of floor shockwave ring + standing pale/crimson air-pressure crescents
        const uRing = ageH / 0.42;
        if (uRing < 1) {
          const rr = 10 + 60 * ease.outQuart(uRing);
          const rA = (1 - uRing) * endFade;
          drawFloorShockRing(p, HX + 4, 0, rr, 0.19, Math.max(1, 3.0 * (1 - uRing)), uRing, C, Cr, rA, false);
          const hC = 27 * (1 - uRing * 0.55), wC = 7.2 * (1 - uRing * 0.55);
          frontCrescent(p, clamp(HX + 4 + rr, X_MIN + 10, X_MAX - 10), 1, hC, wC, [WHITE, C[5], Cr[2]], rA * 0.90);
          frontCrescent(p, clamp(HX + 4 - rr, X_MIN + 10, X_MAX - 10), -1, hC * 0.8, wC * 0.8, [C[6], C[4], C[2]], rA * 0.78);
        }

        // C. Subtle Gapped Ashen Shock-Arcs & Flying Slivers
        if (ageH >= 0.03 && ageH < 0.33) {
          const uBR = (ageH - 0.03) / 0.30;
          brokenRing(
            p,
            HX,
            HY,
            18 + 46 * ease.outQuart(uBR),
            Math.max(1, 2.2 * (1 - uBR)),
            ringSegs,
            0.38 + uBR * 0.62,
            uBR < 0.22 ? C[5] : C[4],
            Cr[3],
            (1 - uBR) * endFade * 0.76,
            1,
            0
          );
        }
        if (ageH < 0.28) {
          const uSl = ageH / 0.28;
          for (const sl of airSlivers) {
            const rr = sl.r0 + sl.v * ease.outQuart(uSl) * 0.22;
            if (HY + Math.sin(sl.a) * rr < 0) {
              sliver(p, HX, HY, sl.a, rr, sl.arc * (1 - uSl * 0.4), sl.crimson ? Cr[5] : C[5], (1 - uSl) * endFade * 0.85);
            }
          }
        }

        // D. Blazing Ashen-White Cross-Shaped Intense Glare ("受击点爆开一团灰白十字强光")!
        if (ageH < 0.40) {
          drawPaleCrossGlare(p, HX, HY, 76, 76, 8.4, 0.11, ageH / 0.40, C, Cr, endFade);
        }
        if (t >= T_RIP2 && t < T_RIP2 + 0.18) {
          drawPaleCrossGlare(p, ex + 4, -42, 24, 24, 3.6, 0.76, (t - T_RIP2) / 0.18, C, Cr, endFade * 0.82);
        }

        // E. Tumbling & Bouncing Tiny White Fragments ("同时掉落细小白色碎块")
        for (const b of bits.list) {
          drawWhiteFragment(p, b, C, endFade);
        }

        // F. Vivid Two-Tone Scarlet-Crimson Spark Streaks ("飞溅的赤红火花")
        for (const sp of scarletSparks) {
          const u = sp.age / sp.life;
          const sFade = (1 - smooth(0.65, 1, u)) * endFade;
          if (sFade <= 0.04) continue;
          const spd = Math.hypot(sp.vx, sp.vy) || 1;
          const tailLen = Math.min(12.5, Math.max(2.5, spd * 0.038));
          const ux = sp.vx / spd, uy = sp.vy / spd;
          const tx = clamp(sp.x - ux * tailLen, X_MIN + 4, X_MAX - 4);
          const ty = Math.min(0, Math.max(Y_MIN + 4, sp.y - uy * tailLen));
          const mx = clamp(sp.x - ux * tailLen * 0.48, X_MIN + 4, X_MAX - 4);
          const my = Math.min(0, Math.max(Y_MIN + 4, sp.y - uy * tailLen * 0.48));

          p.line(tx, ty, mx, my, Cr[3], sFade * 0.9);
          p.line(mx, my, sp.x, Math.min(0, sp.y), Cr[5], sFade);
          if (sp.thick && u < 0.55) {
            p.line(mx, Math.min(0, my - 1), sp.x, Math.min(0, sp.y - 1), Cr[4], sFade * 0.85);
          }
          p.dot(sp.x, Math.min(0, sp.y), sp.hot && u < 0.32 ? WHITE : Cr[6], sFade);
          if (sp.thick) p.dot(sp.x - 1, Math.min(0, sp.y), Cr[5], sFade);
          if (u < 0.48 && sp.y < -2 && sp.x > X_MIN + 14 && sp.x < X_MAX - 14) {
            p.glow(sp.x, sp.y, 8, Cr[4], 0.28 * sFade);
          }
        }
      }

      ps.draw(p, "front");
      lights.draw(p);

      // Carve outer ambient light halo on impact so the blazing cross-glare core pops with oppressive contrast!
      if (t >= T_HIT) {
        const ageH = t - T_HIT;
        const pressK = smooth(0, 0.03, ageH) * (1 - smooth(0.26, 0.62, ageH));
        if (pressK > 0.03) {
          const ex = enemyX(t);
          unlight(p, ex - 82, -116, ex + 82, 8, (x, y) => {
            const d = Math.hypot((x - HX) / 82, (y - HY) / 74);
            return d > 0.56 && d < 1;
          }, 1 - 0.68 * pressK);
        }
      }
    },
  };
}
