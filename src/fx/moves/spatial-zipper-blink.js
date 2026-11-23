// Spatial Zipper Blink ("moves/spatial-zipper-blink" — 【空间拉链位移】):
// 1. Giant Metallic Zipper Slider Rips Downward (0.00..0.62s): A colossal gleaming brass-gold & chrome zipper slider
//    with an articulated keyhole pull-tab materializes in mid-air in front of the hero (x = 38) and rips violently
//    downward from top to bottom ("从角色身前空气中浮现一个巨大的金属拉链头由上往下猛然拉开"), firing sequential
//    tooth-by-tooth interlocking metallic glints ("锯齿咬合闪光").
// 2. Deep Starry Black Hole Swallows the Hero & Zips Shut (0.56..1.30s): Inside the unzipped spatial seam, a pitch-black
//    cosmic abyss with a lensed accretion spiral and twinkling deep-space stars ("露出里面深邃的星空黑洞将角色吞入")
//    pulls and spaghettifies the hero into the singularity before the first zipper rapidly zips shut bottom-to-top.
// 3. Destination Zipper Rips Open & Spits Out the Hero (1.26..2.02s): At the destination (x = 152), a second giant
//    metallic zipper rips open top-to-bottom in a cascade of tooth-bite flashes and violently ejects the hero out of
//    the starry black hole ("在终点处另一个拉链拉开将角色吐出") to land at x = 196.
// 4. Rapid Zip-Shut & Spatial Rift Closure Air-Blast (2.02..3.75s): The destination zipper slams shut bottom-to-top
//    ("迅速合拢消失") with intense tooth-bite sparks, detonating a powerful Spatial Rift Closure Air-Blast
//    ("空间裂缝闭合气浪的结果特效") — billowing crescent vacuum shock-walls, radial air-shear gusts, and expanding
//    dimensional floor shock-rings that subside cleanly by 3.75s.
// Black-hole accretion shading, starburst spikes, and spark physics build on Sprite Fusion's open-source pixel art VFX
// (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import {
  Particles,
  Lights,
  P,
  Rng,
  fit,
  flare,
  sparkle,
  clamp,
  smooth,
  lerp,
  ease,
  rand,
  TAU,
  WHITE,
  READY,
  poseAt,
  posed,
} from "../../core/index.js";
import { spikes, star } from "../impacts/_lib.js";
import { unlight } from "../shadow/_lib.js";

// Spatial coordinates
const Z1_X = 38;               // Entry Spatial Zipper X (clearly in front of the hero at x = 0)
const Z2_X = 152;              // Destination Spatial Zipper X
const DEST_X = 196;            // Hero landing X after being spat out of Zipper 2
const Y_TOP = -96;             // Top stop of the vertical spatial zipper
const Y_BOT = -4;              // Bottom stop of the vertical spatial zipper (just above floor y = 0)
const Y_MID = (Y_TOP + Y_BOT) * 0.5; // -50
const RIFT_MAX_HW = 22;        // Maximum half-width of the unzipped starry black-hole cavity (44 px wide)
const N_TEETH = 18;            // Number of heavy interlocking metallic tooth pairs along each zipper track
const SY_FLOOR = 0.22;         // Floor perspective squash

// Choreography timing constants (seconds)
const T_Z1_APPEAR = 0.04;      // Giant Zipper 1 slider materializes at (Z1_X, Y_TOP)
const T_Z1_UNZIP0 = 0.16;      // Zipper 1 begins ripping downward (top -> bottom)
const T_Z1_UNZIP1 = 0.60;      // Zipper 1 reaches full open at Y_BOT, exposing the Starry Black Hole
const T_SWALLOW0 = 0.56;       // Starry Black Hole gravitational streams pull & lift the hero in
const T_SWALLOW1 = 0.90;       // Hero is completely swallowed inside the Starry Black Hole
const T_Z1_ZIP0 = 0.92;        // Zipper 1 rapidly zips shut upward (bottom -> top)
const T_Z1_ZIP1 = 1.26;        // Zipper 1 seals shut & pops in a compact dimensional shockwave

const T_Z2_APPEAR = 1.24;      // Giant Zipper 2 slider materializes at destination (Z2_X, Y_TOP)
const T_Z2_UNZIP0 = 1.34;      // Zipper 2 rips downward (top -> bottom)
const T_Z2_UNZIP1 = 1.70;      // Zipper 2 reaches full open at Y_BOT
const T_SPIT0 = 1.66;          // Starry Black Hole inside Zipper 2 violently spits out the hero
const T_SPIT1 = 1.98;          // Hero coalesces mid-air and lands in a low slide at DEST_X = 196
const T_Z2_ZIP0 = 2.02;        // Zipper 2 rapidly zips shut upward (bottom -> top)
const T_Z2_ZIP1 = 2.38;        // Zipper 2 slams shut at Y_TOP -> triggers Climax Spatial Rift Closure Air-Blast!
const T_BLAST_END = 3.28;      // Closure air-blast waves subside
const T_END = 3.75;

export const meta = {
  name: "Spatial zipper blink",
  desc: "A giant metallic zipper rips open a starry black hole to swallow the hero, then a destination zipper spits them out and slams shut in an air-blast.",
  tags: ["move", "teleport", "blink", "portal", "rift", "void", "space", "zipper", "dash", "one-shot"],
  size: [384, 208],
  origin: [88, 168],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    // 8-step Cosmic Starry Void & Dimensional Rift ramp (pitch-black abyss -> deep nebula -> electric cyan-violet -> white)
    palette: ["#04020a", "#110826", "#261252", "#48208c", "#743ce0", "#a878ff", "#dcf0ff", "#ffffff"],
    // 6-step Heavy Metallic Zipper Slider & Interlocking Teeth ramp (dark bronze -> burnished gold -> specular white)
    metal: ["#28190b", "#5c3b18", "#9c6828", "#dc9e3c", "#ffe074", "#ffffff"],
    // 5-step Tooth-Bite Spark & Closure Air-Blast ramp (white -> lemon spark -> golden-amber -> electric cyan)
    sparks: ["#ffffff", "#fff9c4", "#ffd858", "#ff9428", "#70e8ff"],
    seed: 23,
  },
};

// Actor poses (all hand offsets strictly within natural 14px shoulder reach of pose.x)
const STAND_READY = { ...READY, x: 0, crouch: 2, lean: 1, fx: 9, fy: -22, bx: -6, by: -20, ffx: 6, fbx: -6 };
const REACH_ZIP = { ...STAND_READY, x: 2, crouch: 3, lean: 2, fx: 12, fy: -28, bx: -5, by: -23, armsFront: true, ffx: 8, fbx: -6 };
const LIFT_PULL = { ...STAND_READY, x: 14, y: -12, crouch: 1, lean: 3, fx: 13, fy: -27, bx: 5, by: -22, ffx: 2, ffy: -4, fbx: -5, fby: -3, ghost: 1 };
const IN_VOID_1 = { ...STAND_READY, x: Z1_X, y: -22, crouch: 4, lean: 2, fx: 8, fy: -24, bx: -4, by: -22 };
const IN_VOID_2 = { ...STAND_READY, x: Z2_X + 6, y: -22, crouch: 4, lean: 3, fx: 9, fy: -24, bx: -4, by: -22 };
const EJECT_FLY = { ...STAND_READY, x: Z2_X + 26, y: -14, crouch: 2, lean: 4, fx: 12, fy: -26, bx: -7, by: -22, ffx: 8, ffy: -5, fbx: -6, fby: -4, ghost: 1 };
const LAND_SLIDE = { ...STAND_READY, x: DEST_X, y: 0, crouch: 7, lean: 3, fx: 12, fy: -20, bx: -8, by: -24, ffx: 10, fbx: -8, toeB: true, ghost: 1 };
const BLAST_BRACE = { ...STAND_READY, x: DEST_X + 3, y: 0, crouch: 5, lean: 2, fx: 11, fy: -23, bx: -7, by: -22, ffx: 9, fbx: -7, ghost: 1 };
const END_STAND = { ...STAND_READY, x: DEST_X + 2, y: 0, crouch: 2, lean: 1, fx: 9, fy: -22, bx: -6, by: -20, ffx: 6, fbx: -6 };

export const act = {
  poses: [
    [-0.30, STAND_READY],
    [0.10, REACH_ZIP, "out"],
    [T_Z1_UNZIP1, { ...REACH_ZIP, x: 4, crouch: 4 }],
    [T_SWALLOW1 - 0.08, LIFT_PULL, "in"],
    [T_SWALLOW1, IN_VOID_1, "snap"],
    [T_SPIT0, IN_VOID_2, "snap"],
    [T_SPIT0 + 0.12, EJECT_FLY, "out"],
    [T_SPIT1, LAND_SLIDE, "out"],
    [T_Z2_ZIP1, BLAST_BRACE, "snap"],
    [2.95, END_STAND],
    [T_END, END_STAND],
  ],
  hits: [
    { t: T_Z1_UNZIP0, stop: 0.03, shake: 0.14, amp: 1.8, target: false },
    { t: T_SWALLOW1, stop: 0.05, shake: 0.22, amp: 2.8, target: false },
    { t: T_Z1_ZIP1, stop: 0.04, shake: 0.20, amp: 2.5, target: false },
    { t: T_SPIT0 + 0.04, stop: 0.05, shake: 0.24, amp: 3.0, target: false },
    { t: T_Z2_ZIP1, stop: 0.14, shake: 0.46, amp: 5.5, target: false },
  ],
  dust: [
    { t: T_SWALLOW0 + 0.04, x: 4, n: 6, dir: 1, c: "#a878ff" },
    { t: T_SPIT1, x: DEST_X, n: 9, dir: 1, c: "#dcf0ff" },
    { t: T_Z2_ZIP1, x: Z2_X, n: 12, c: "#ffe074" },
  ],
};

// Hide the static (0, 0) stand-in actor in `render.mjs` once lifted into Zipper 1
export const actorAlpha = (t) => (t < T_SWALLOW0 + 0.12 ? 1 : 0);

// Safe local bounds inside [384, 208] with origin [88, 168] -> x in [-88..295], y in [-168..39]
const X_MIN = -80, X_MAX = 286, Y_MIN = -156, Y_MAX = 32;

// Bresenham 1-visit-per-pixel luminous line (zero moire or Bayer dots!)
function drawLuminousLine(p, x0, y0, x1, y1, colFn, alpha = 1) {
  if (alpha <= 0.02) return;
  let sx = Math.round(x0), sy = Math.round(y0);
  const ex = Math.round(x1), ey = Math.round(y1);
  const dx = Math.abs(ex - sx), dy = -Math.abs(ey - sy);
  const stepx = sx < ex ? 1 : -1, stepy = sy < ey ? 1 : -1;
  const n = Math.max(dx, -dy) || 1;
  const isFn = typeof colFn === "function";
  let err = dx + dy, i = 0;

  for (;;) {
    if (sx >= X_MIN && sx <= X_MAX && sy >= Y_MIN && sy <= Y_MAX) {
      const u = i / n;
      const c = isFn ? colFn(u) : colFn;
      if (alpha > 0.65) p.px(sx, sy, c);
      p.light(sx, sy, c, alpha * 0.85);
    }
    if (sx === ex && sy === ey) break;
    i++;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; sx += stepx; }
    if (e2 <= dx) { err += dx; sy += stepy; }
  }
}

// 1-visit-per-pixel floor ellipse shock-ring
function drawLuminousFloorRing(p, cx, cy, rx, sy, th, alpha, colOuter, colCore, keepFn) {
  if (rx <= 1 || alpha <= 0.02 || th <= 0.2) return;
  const rOut = rx + th * 0.5;
  const rIn = Math.max(0, rx - th * 0.8);
  const y0 = Math.max(Y_MIN, Math.floor(cy - rOut * sy - 1));
  const y1 = Math.min(Y_MAX, Math.ceil(cy + rOut * sy + 1));

  for (let py = y0; py <= y1; py++) {
    const dy = (py - cy) / sy;
    const dy2 = dy * dy;
    if (dy2 > rOut * rOut) continue;
    const xo = Math.sqrt(rOut * rOut - dy2);
    const xi = dy2 < rIn * rIn ? Math.sqrt(rIn * rIn - dy2) : 0;

    for (let px = Math.max(X_MIN, Math.floor(cx - xo - 1)), pxMax = Math.min(X_MAX, Math.ceil(cx + xo + 1)); px <= pxMax; px++) {
      const dx = px - cx;
      if (xi > 1 && dx > -xi + 1 && dx < xi - 1) {
        px = Math.max(px, Math.floor(cx + xi - 1));
        continue;
      }
      const ang = Math.atan2(dy, dx);
      if (keepFn && !keepFn(ang)) continue;
      const d = Math.sqrt(dx * dx + dy2);
      const persp = Math.hypot(Math.cos(ang), Math.sin(ang) * sy);
      const effTh = Math.max(0.85, th * Math.max(0.45, persp));
      const diff = Math.abs(d - rx);
      if (diff > effTh) continue;

      const u = 1 - diff / effTh;
      const col = u > 0.55 ? colCore : colOuter;
      const k = alpha * (u * u * 0.9 + 0.2);
      if (alpha > 0.72 && u > 0.52) p.px(px, py, col);
      p.light(px, py, col, k);
    }
  }
}

// Compute the unzipped spatial cavity half-width at height `y` in `[Y_TOP .. sliderY]`
function riftHalfWidthAt(y, sliderY, openScale = 1) {
  if (y < Y_TOP || y > sliderY || sliderY <= Y_TOP + 2) return 0;
  const span = sliderY - Y_TOP;
  const fullSpan = Y_BOT - Y_TOP;
  const u = (y - Y_TOP) / span; // 0 at top stop -> 1 at slider throat
  const lens = Math.sin(u * Math.PI) * Math.pow(1 - u * 0.14, 0.42);
  return RIFT_MAX_HW * Math.min(1, (span / fullSpan) * 1.15) * lens * openScale;
}

// 1. DEEP STARRY BLACK-HOLE ABYSS INSIDE THE UNZIPPED RIFT ("露出里面深邃的星空黑洞")
// Called AFTER `lights.draw(p)` so `unlight` strips any external glow from the cosmic cavity, keeping the
// black-hole event horizon & deep space 100% pitch-black (`C[0]`) with crisp stars and accretion spirals!
function drawStarryBlackHoleRift(p, cx, sliderY, openScale, t, C, M, SP, seed) {
  if (sliderY <= Y_TOP + 4 || openScale <= 0.04) return;
  const y0 = Math.max(Y_MIN, Math.floor(Y_TOP));
  const y1 = Math.min(-2, Math.ceil(sliderY));
  const cyHole = lerp(Y_TOP + 14, Y_MID + 2, clamp((sliderY - Y_TOP) / (Y_BOT - Y_TOP)));
  const rHorizon = 9.0 * openScale * clamp((sliderY - Y_TOP) / 46);

  // Strip additive point-light wash inside the open zipper cavity so the abyss stays pitch-black (`C[0]`)!
  unlight(
    p,
    cx - RIFT_MAX_HW - 3,
    y0,
    cx + RIFT_MAX_HW + 3,
    y1,
    (x, y) => Math.abs(x - cx) <= riftHalfWidthAt(y, sliderY, openScale) - 0.8,
    0,
  );

  // Render the pitch-black cosmic void, swirling logarithmic accretion spiral, event horizon & photon ring
  for (let py = y0; py <= y1; py++) {
    const hw = riftHalfWidthAt(py, sliderY, openScale);
    if (hw < 0.8) continue;
    const xLeft = Math.floor(cx - hw);
    const xRight = Math.ceil(cx + hw);

    for (let px = xLeft; px <= xRight; px++) {
      const dx = px - cx;
      const adx = Math.abs(dx);
      if (adx > hw - 0.4) continue;

      const edgeDist = hw - adx;
      // Dimensional tear inner plasma lip just inside the zipper teeth
      if (edgeDist < 1.9) {
        const col = edgeDist < 0.9 ? C[6] : C[4];
        p.px(px, py, col);
        p.light(px, py, C[5], 0.30);
        continue;
      }

      // Coordinates relative to the Black Hole singularity inside the rift
      const hx = dx * 1.22;
      const hy = (py - cyHole) * 0.78;
      const r = Math.hypot(hx, hy);
      const ang = Math.atan2(hy, hx);

      // Pitch-black Black Hole Event Horizon ("深邃黑洞视界")
      if (r < rHorizon - 0.5) {
        p.px(px, py, C[0]);
        continue;
      }

      // Blazing Gravitational-Lensed Photon Ring hugging the Event Horizon
      if (r >= rHorizon - 0.5 && r <= rHorizon + 1.55 && rHorizon > 2.5) {
        const doppler = 0.5 + 0.5 * Math.cos(ang * 2 - t * 9.5);
        const col = doppler > 0.52 ? WHITE : doppler > 0.22 ? SP[4] : C[6];
        p.px(px, py, col);
        p.light(px, py, col, 0.45);
        continue;
      }

      // Swirling Logarithmic Accretion Arms & Deep Nebula inside the Starry Void
      const normR = Math.max(0.05, r / 26);
      const logZ = -Math.log(normR);
      const spiralPhi = 2 * ang + 4.8 * logZ - t * 6.8;
      const arm1 = Math.pow(0.5 + 0.5 * Math.cos(spiralPhi), 8);
      const arm2 = Math.pow(0.5 + 0.5 * Math.cos(spiralPhi + Math.PI + 0.5 * logZ), 10);
      const radialFalloff = Math.exp(-normR * 0.82);
      const swirlVal = (arm1 * 1.18 + arm2 * 0.78) * radialFalloff;

      let col = C[0];
      if (swirlVal > 0.70) {
        col = C[6];
      } else if (swirlVal > 0.44) {
        col = C[4];
      } else if (swirlVal > 0.22) {
        col = C[2];
      } else if (swirlVal > 0.10 || edgeDist < 3.6) {
        col = C[1];
      }
      p.px(px, py, col);
    }
  }

  // Deep-Space Twinkling Starfield & Infalling Starlight Clusters inside the Unzipped Cavity
  const nStars = 26;
  for (let i = 0; i < nStars; i++) {
    const ph = ((t * (0.75 + (i % 4) * 0.22) + rand(i, seed + 11)) % 1);
    const a0 = rand(i, seed + 23) * TAU + ph * 2.3;
    const rad = lerp(29, rHorizon + 1.8, ease.inQuad(ph));
    const sx = Math.round(cx + Math.cos(a0) * rad * 0.78);
    const sy = Math.round(cyHole + Math.sin(a0) * rad * 1.35);
    if (sy <= Y_TOP + 2 || sy >= sliderY - 2) continue;
    const hw = riftHalfWidthAt(sy, sliderY, openScale);
    if (Math.abs(sx - cx) >= hw - 2.0) continue;
    if (Math.hypot((sx - cx) * 1.22, (sy - cyHole) * 0.78) < rHorizon + 1.1) continue;

    const twinkle = Math.sin(t * 17 + i * 2.7);
    const starCol = i % 3 === 0 ? WHITE : i % 3 === 1 ? SP[4] : M[4];
    p.px(sx, sy, starCol);
    if (twinkle > 0.45 && i % 2 === 0) {
      if (Math.abs(sx - 1 - cx) < hw - 2) p.px(sx - 1, sy, C[5]);
      if (Math.abs(sx + 1 - cx) < hw - 2) p.px(sx + 1, sy, C[5]);
      if (sy - 1 > Y_TOP + 2) p.px(sx, sy - 1, C[5]);
      if (sy + 1 < sliderY - 2) p.px(sx, sy + 1, C[5]);
    }
  }
}

// 2. INTERLOCKING METALLIC ZIPPER TEETH & SEQUENTIAL BITE-FLASHES ("锯齿咬合闪光")
function drawZipperTracksAndTeeth(p, cx, sliderY, openScale, isMoving, moveDir, t, C, M, SP) {
  const stepY = (Y_BOT - Y_TOP) / (N_TEETH + 1);

  // Top Metallic End-Stop Box ("拉链顶止金属卡扣" at Y_TOP)
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const isEdge = Math.abs(dx) === 3 || Math.abs(dy) === 2;
      p.px(cx + dx, Y_TOP + dy, isEdge ? M[1] : dx < 0 ? M[4] : M[3]);
    }
  }

  // Draw the left and right heavy metallic zipper tape rails
  for (let py = Y_TOP + 2; py <= Y_BOT; py++) {
    const hw = riftHalfWidthAt(py, sliderY, openScale);
    if (py <= sliderY && hw > 0.5) {
      // Open section above slider: beveled metallic tape rails hugging the starry rift
      const lx = Math.round(cx - hw), rx = Math.round(cx + hw);
      p.px(lx - 2, py, M[0]);
      p.px(lx - 1, py, M[2]);
      p.px(lx, py, M[4]);
      p.px(rx, py, M[3]);
      p.px(rx + 1, py, M[2]);
      p.px(rx + 2, py, M[0]);
    } else if (isMoving) {
      // Closed seam below slider: tightly interlocked vertical metallic spine
      p.px(cx - 2, py, M[0]);
      p.px(cx - 1, py, M[2]);
      p.px(cx, py, (py & 1) ? M[4] : C[5]);
      p.px(cx + 1, py, M[2]);
      p.px(cx + 2, py, M[0]);
    }
  }

  // Draw the N_TEETH pairs of heavy interlocking metallic zipper teeth ("金属拉链锯齿")
  for (let i = 1; i <= N_TEETH; i++) {
    const ty = Math.round(Y_TOP + i * stepY);
    const distToSlider = Math.abs(ty - sliderY);
    // Sequential tooth-bite flash as the slider rips open or zips shut across each tooth! ("拉链开合时的锯齿咬合闪光")
    const biteIntensity = isMoving ? clamp(1 - distToSlider / 13.5) : 0;
    const isFlash = biteIntensity > 0.38;

    if (ty < sliderY - 2) {
      // UNZIPPED TEETH (chunky 3x2 px beveled metallic lugs protruding inward along both rims)
      const hw = riftHalfWidthAt(ty, sliderY, openScale);
      const lx = Math.round(cx - hw);
      const rx = Math.round(cx + hw);
      const tipCol = isFlash ? WHITE : M[5];
      const midCol = isFlash ? WHITE : M[4];
      const baseCol = isFlash ? M[4] : M[2];

      // Left tooth (protruding inward to the right)
      p.px(lx, ty - 1, M[1]);
      p.px(lx + 1, ty - 1, baseCol);
      p.px(lx + 2, ty - 1, midCol);
      p.px(lx, ty, baseCol);
      p.px(lx + 1, ty, midCol);
      p.px(lx + 2, ty, tipCol);
      p.px(lx + 3, ty, tipCol);
      p.px(lx, ty + 1, M[0]);
      p.px(lx + 1, ty + 1, M[1]);

      // Right tooth (staggered 1px vertically so left & right teeth interlock like real zipper teeth!)
      const rty = ty + 1;
      p.px(rx, rty - 1, M[1]);
      p.px(rx - 1, rty - 1, baseCol);
      p.px(rx - 2, rty - 1, midCol);
      p.px(rx, rty, baseCol);
      p.px(rx - 1, rty, midCol);
      p.px(rx - 2, rty, tipCol);
      p.px(rx - 3, rty, tipCol);
      p.px(rx, rty + 1, M[0]);
      p.px(rx - 1, rty + 1, M[1]);

      if (biteIntensity > 0.22) {
        const arm = Math.round(6.5 * biteIntensity);
        sparkle(p, lx + 3, ty, arm, WHITE, SP[2], 0.55 * biteIntensity);
        sparkle(p, rx - 3, rty, arm, WHITE, SP[2], 0.55 * biteIntensity);
        if (biteIntensity > 0.55) {
          // Cross-seam metallic bite arc connecting the newly separated/locked teeth!
          drawLuminousLine(p, lx + 2, ty, rx - 2, rty, WHITE, biteIntensity * 0.85);
        }
      }
    } else if (isMoving) {
      // INTERLOCKED TEETH below the slider ("锯齿紧密咬合")
      const lCol = isFlash ? WHITE : (i & 1) ? M[4] : M[2];
      const rCol = isFlash ? WHITE : (i & 1) ? M[2] : M[4];
      p.px(cx - 3, ty, M[0]);
      p.px(cx - 2, ty, M[2]);
      p.px(cx - 1, ty, lCol);
      p.px(cx, ty, isFlash ? WHITE : M[5]);
      p.px(cx + 1, ty, rCol);
      p.px(cx + 2, ty, M[2]);
      p.px(cx + 3, ty, M[0]);

      if (biteIntensity > 0.18) {
        // Crisp 4-point + diagonal X-shear tooth-bite flash!
        const arm = Math.round(8.5 * biteIntensity);
        const gx = cx + ((i & 1) ? -2 : 2);
        sparkle(p, gx, ty, arm, WHITE, SP[2], 0.72 * biteIntensity);
        const sLen = 9 * biteIntensity;
        drawLuminousLine(p, gx - sLen, ty - sLen * 0.45, gx + sLen, ty + sLen * 0.45, WHITE, biteIntensity * 0.92);
        drawLuminousLine(p, gx - sLen, ty + sLen * 0.45, gx + sLen, ty - sLen * 0.45, SP[4], biteIntensity * 0.85);
      }
    }
  }
}

// 3. GIANT GLEAMING METALLIC ZIPPER SLIDER & ARTICULATED PULL-TAB ("巨大的金属拉链头")
// High-contrast pixel-art metallic beveling (`M[0]` dark bronze border, `M[3..4]` burnished gold, `WHITE` specular
// spine) so the Y-channel shoulders, diamond splitter nose, hinge lug, and rectangular keyhole pull-tab are razor-sharp!
function drawGiantZipperSlider(p, cx, cy, pullSwingAng, scale, flashWhite, M, SP) {
  if (scale <= 0.05) return;
  const hwTop = Math.round(8.5 * scale);
  const hwBot = Math.round(5.0 * scale);
  const hHalf = Math.round(8.5 * scale);

  // Subtle back-aura so the slider stands out without washing out its dark metallic bevels
  p.glow(cx, cy, 12 * scale, SP[2], 0.22 * scale);

  // 1. Main Slider Body (trapezoidal Y-channel shield from cy - hHalf to cy + hHalf)
  for (let dy = -hHalf; dy <= hHalf; dy++) {
    const py = Math.round(cy + dy);
    if (py < Y_MIN || py > Y_MAX) continue;
    const v = (dy + hHalf) / Math.max(1, 2 * hHalf); // 0 at top shoulders -> 1 at bottom nose
    // Y-channel waist pinches slightly in the middle and tapers to the bottom nose
    const rowHW = v < 0.36
      ? lerp(hwTop * 0.84, hwTop, v / 0.36)
      : lerp(hwTop, hwBot, (v - 0.36) / 0.64);

    for (let dx = -Math.ceil(rowHW); dx <= Math.ceil(rowHW); dx++) {
      if (Math.abs(dx) > rowHW) continue;
      // Top Y-throat notch where the left & right zipper tooth tracks feed into the slider
      if (v < 0.28 && Math.abs(dx) < 2.4 * scale) continue;

      const px = Math.round(cx + dx);
      if (px < X_MIN || px > X_MAX) continue;

      const isOuterBorder = Math.abs(dx) > rowHW - 1.15 || dy === -hHalf || dy === hHalf;
      const isInnerBevel = Math.abs(dx) > rowHW - 2.2 || dy === -hHalf + 1 || dy === hHalf - 1;
      const isYThroatEdge = v < 0.32 && Math.abs(dx) < 3.4 * scale;
      const isCenterRidge = Math.abs(dx) <= 1.3 * scale && v >= 0.28 && v <= 0.84;

      let col;
      if (flashWhite) {
        col = isOuterBorder ? M[4] : WHITE;
      } else if (isOuterBorder || isYThroatEdge) {
        col = M[0]; // Crisp dark bronze-steel outline
      } else if (isCenterRidge) {
        col = dy < 0 ? WHITE : M[4]; // Raised central diamond splitter spine
      } else if (isInnerBevel) {
        col = (dx < 0 || dy < -2) ? M[4] : M[1]; // Top-left light bevel vs bottom-right shadow bevel
      } else {
        col = (dx < 0 && dy < 2) ? M[4] : (dx > 1 && dy > 1) ? M[2] : M[3];
      }
      p.px(px, py, col);
    }
  }

  // 2. Central Hinge Bridge Lug at (cx, cy + 1)
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const isRim = Math.abs(dx) === 2 || Math.abs(dy) === 2;
      p.px(cx + dx, cy + 1 + dy, isRim ? M[0] : (dx <= 0 && dy <= 0) ? WHITE : M[4]);
    }
  }

  // 3. Swinging Articulated Pull-Tab ("巨型金属拉片" with dark-outlined rectangular keyhole cutout)
  const tabLen = 15.5 * scale;
  const tabHW = 5.2 * scale;
  const ca = Math.cos(pullSwingAng), sa = Math.sin(pullSwingAng);
  const nx = -sa, ny = ca;
  const hingeX = cx, hingeY = cy + 2;
  const bound = Math.ceil(tabLen + tabHW + 2);

  for (let dy = -bound; dy <= bound; dy++) {
    const py = Math.round(hingeY + dy);
    if (py < Y_MIN || py > Y_MAX) continue;
    for (let dx = -bound; dx <= bound; dx++) {
      const px = Math.round(hingeX + dx);
      if (px < X_MIN || px > X_MAX) continue;

      const d = dx * ca + dy * sa;   // distance along pull-tab from hinge (0 .. tabLen)
      const w = dx * nx + dy * ny;   // distance across pull-tab
      const aw = Math.abs(w);
      if (d < 1.0 || d > tabLen) continue;

      const u = d / tabLen;
      const curHW = u < 0.24
        ? lerp(2.4 * scale, tabHW, u / 0.24)
        : u > 0.86
          ? lerp(tabHW, 3.2 * scale, (u - 0.86) / 0.14)
          : tabHW;
      if (aw > curHW) continue;

      // Iconic Rectangular Keyhole Cutout inside the Pull-Tab (`u in [0.44..0.78], aw < 2.1 * scale`)
      const inHoleU = u > 0.44 && u < 0.78;
      const inHoleW = aw < 2.0 * scale;
      if (inHoleU && inHoleW) continue;

      const isHoleRim = (u > 0.38 && u < 0.84) && (aw < 2.9 * scale) && (inHoleU || inHoleW);
      const isOuterRim = aw > curHW - 1.15 || u > 0.91 || u < 0.08;

      let col;
      if (flashWhite) {
        col = isOuterRim ? M[4] : WHITE;
      } else if (isOuterRim || isHoleRim) {
        col = M[0]; // Crisp dark bronze outline around both outer tab and inner keyhole slot!
      } else if (w < -0.4) {
        col = u < 0.42 ? WHITE : M[4]; // Specular top-left edge of the pull-tab
      } else {
        col = w > 1.2 ? M[2] : M[3];
      }
      p.px(px, py, col);
    }
  }
}

// 4. GRAVITATIONAL TRACTOR STREAMS & SPAGHETTIFIED HERO SILHOUETTE ("将角色吞入 / 吐出")
function drawSpaghettifiedHero(p, fromX, fromY, holeX, holeY, uProgress, isEntering, C, SP) {
  if (uProgress <= 0.02 || uProgress >= 0.98) return;
  const nStrands = 20;
  for (let i = 0; i < nStrands; i++) {
    const yOff = (i / (nStrands - 1) - 0.5) * 34;
    const bodyX = fromX + Math.sin(i * 1.7) * 5;
    const bodyY = fromY - 20 + yOff;
    const delay = (i % 5) * 0.04;
    const u = clamp((uProgress - delay) / (1 - 0.16));
    if (u <= 0 || u >= 1) continue;

    // Ensure `kHead` leads `kTail` by a wide margin so long luminous spaghettification ribbons
    // stretch across the full gap between the hero's body and the black-hole singularity!
    const kHead = ease.outCubic(u);
    const kTail = ease.inCubic(Math.max(0, u - 0.18) / 0.82);

    const sx0 = isEntering ? bodyX : holeX;
    const sy0 = isEntering ? bodyY : holeY + yOff * 0.15;
    const ex0 = isEntering ? holeX : bodyX;
    const ey0 = isEntering ? holeY + yOff * 0.15 : bodyY;

    const arch = (i % 2 === 0 ? -1 : 1) * (5 + (i % 4) * 2.5);
    const xHead = lerp(sx0, ex0, kHead);
    const yHead = lerp(sy0, ey0, kHead) + Math.sin(kHead * Math.PI) * arch;
    const xTail = lerp(sx0, ex0, kTail);
    const yTail = lerp(sy0, ey0, kTail) + Math.sin(kTail * Math.PI) * arch;

    const col = i % 3 === 0 ? WHITE : i % 3 === 1 ? SP[4] : C[6];
    const alpha = Math.pow(Math.sin(u * Math.PI), 0.65);
    drawLuminousLine(p, xTail, yTail, xHead, yHead, (v) => (v > 0.52 ? WHITE : col), alpha);
  }
}

// 5. SPATIAL RIFT CLOSURE AIR-BLAST SHOCKWAVE ("空间裂缝闭合气浪的结果特效")
// Renders a volumetric, billowing anime/fighting-game dimensional slam air-blast:
// - Fast vertical seam zip-collapse into the top lock
// - Broad, soft-shaded crescent vacuum-shear walls ("宽幅月牙形空间气浪墙")
// - Radial high-velocity air-shear gusts ("放射状气浪激波束") shooting outward at angled trajectories
function drawClosureAirBlast(p, cx, age, dur, scale, C, M, SP, isBack) {
  if (age < 0 || age >= dur) return;
  const u = age / dur;
  const fade = 1 - smooth(0.30, 1.0, u);
  const easeOut = ease.outQuart(u);

  // Ground perspective shockwave rings (split back/front)
  const rFloor1 = 12 + 72 * scale * easeOut;
  drawLuminousFloorRing(
    p,
    cx,
    0.5,
    rFloor1,
    SY_FLOOR,
    Math.max(1.2, 3.8 * scale * (1 - u)),
    fade * 0.92,
    C[5],
    WHITE,
    (g) => (Math.sin(g) < 0) === isBack,
  );
  if (u > 0.06) {
    const u2 = (u - 0.06) / 0.94;
    const rFloor2 = 8 + 46 * scale * ease.outCubic(u2);
    drawLuminousFloorRing(
      p,
      cx,
      0.5,
      rFloor2,
      SY_FLOOR,
      Math.max(1.0, 2.5 * scale * (1 - u2)),
      (1 - u2) * 0.82,
      SP[2],
      SP[4],
      (g) => (Math.sin(g) < 0) === isBack,
    );
  }

  if (isBack) return;

  // 1. Broad, Volumetric Serrated Crescent Air-Wall Shockwaves ("多层锯齿月牙形空间闭合气浪")
  const waves = [
    { delay: 0.00, span: 0.94, dist: 64 * scale, h: 44 * scale, yMid: Y_MID, th: 8.2 * scale, c1: WHITE, c2: SP[4], c3: C[5], freq: 11 },
    { delay: 0.07, span: 0.82, dist: 42 * scale, h: 32 * scale, yMid: Y_MID + 3, th: 5.8 * scale, c1: SP[1], c2: C[6], c3: C[4], freq: 8 },
  ];

  for (const wv of waves) {
    const wu = (u - wv.delay) / wv.span;
    if (wu <= 0 || wu >= 1) continue;
    const wEase = ease.outQuart(wu);
    const wFade = (1 - smooth(0.26, 1.0, wu)) * fade;
    const waveXDist = 5 + wv.dist * wEase;
    const waveH = wv.h * (0.76 + 0.24 * ease.outQuad(wu));
    const waveTh = Math.max(1.2, wv.th * (1 - wu * 0.68));

    for (const dir of [-1, 1]) {
      const y0 = Math.max(Y_MIN, Math.floor(wv.yMid - waveH));
      const y1 = Math.min(-2, Math.ceil(wv.yMid + waveH));
      for (let py = y0; py <= y1; py++) {
        const nv = (py - wv.yMid) / waveH;
        if (Math.abs(nv) > 1) continue;
        // Sharp crescent taper at top and bottom tips + wind-shear serration teeth along the pressure front
        const env = Math.pow(Math.cos(nv * Math.PI * 0.5), 1.55);
        const tooth = 0.78 + 0.36 * Math.pow(0.5 + 0.5 * Math.cos(nv * wv.freq + dir * 0.8), 3);
        const arcX = cx + dir * (waveXDist * (0.58 + 0.42 * env) + tooth * 2.5 * (1 - wu * 0.5));
        const curTh = waveTh * env * tooth;
        if (curTh < 0.6) continue;

        const xStart = Math.max(X_MIN, Math.floor(arcX - curTh - 1));
        const xEnd = Math.min(X_MAX, Math.ceil(arcX + curTh + 1));
        for (let px = xStart; px <= xEnd; px++) {
          const signedD = (px - arcX) * dir; // > 0 on leading shock front, < 0 on trailing pressure wake
          const d = Math.abs(signedD);
          if (d > curTh) continue;
          const q = 1 - d / curTh;
          const isLeading = signedD >= -curTh * 0.18;
          const k = wFade * env * (isLeading ? Math.pow(q, 1.25) * 1.30 : Math.pow(q, 2.1) * 0.85);
          const col = q > 0.60 && isLeading ? wv.c1 : q > 0.30 ? wv.c2 : wv.c3;
          if (k > 0.66 && q > 0.54 && isLeading) p.px(px, py, col);
          p.light(px, py, col, k);
        }
      }
    }
  }

  // 2. Ground-Hugging J-Curl Air-Surge Wake ("贴地翻卷气浪激波", rolling outward along the floor & curling upward at the tip)
  const surgeU = clamp(u / 0.88);
  if (surgeU > 0 && surgeU < 1) {
    const sFade = (1 - smooth(0.30, 1.0, surgeU)) * fade;
    const maxSurgeX = 68 * scale * ease.outQuart(surgeU);
    const minSurgeX = 12 * scale * ease.inQuad(surgeU);
    for (const dir of [-1, 1]) {
      const nSteps = Math.max(8, Math.ceil(maxSurgeX - minSurgeX));
      for (let i = 0; i <= nSteps; i++) {
        const s = i / nSteps; // 0 near center -> 1 at curling outer tip
        const dx = lerp(minSurgeX, maxSurgeX, s);
        const px = Math.round(cx + dir * dx);
        if (px < X_MIN || px > X_MAX) continue;
        // J-curl profile: hugs the floor (`y = -2..-5`) and curls sharply upward (`y -> -22`) at the outer wave crest `s -> 1`!
        const curlY = -2 - Math.pow(s, 3.2) * 20 * scale * (0.7 + 0.3 * surgeU);
        const hWake = (1.5 + 4.5 * Math.sin(s * Math.PI) * (1 - surgeU * 0.6)) * scale;
        const env = Math.sin(s * Math.PI);
        for (let dy = -Math.ceil(hWake); dy <= 1; dy++) {
          const py = Math.min(-1, Math.round(curlY + dy));
          if (py < Y_MIN) continue;
          const q = 1 - Math.abs(dy) / (hWake + 1);
          const k = sFade * env * q * 1.15;
          const col = dy <= -hWake * 0.45 ? WHITE : s > 0.6 ? SP[4] : C[5];
          if (k > 0.68 && q > 0.55) p.px(px, py, col);
          p.light(px, py, col, k);
        }
      }
    }
  }

  // 3. Rapid Vertical Seam Zip-Collapse ("空间裂缝合拢消散" in the first 35% of the blast)
  const seamU = clamp(u / 0.36);
  if (seamU < 1) {
    const seamFade = 1 - seamU;
    // Bottom of the stitched seam rapidly zips upward into Y_TOP!
    const curBot = lerp(Y_BOT, Y_TOP, ease.inOutCubic(seamU));
    drawLuminousLine(p, cx, Y_TOP, cx, curBot, (v) => (v < 0.25 ? WHITE : SP[4]), seamFade);
    for (let i = 1; i <= 6; i++) {
      const sy = lerp(Y_TOP + 6, Y_BOT - 6, i / 7);
      if (sy > curBot + 2) continue;
      const stitchW = (5 + (i % 2) * 3) * seamFade;
      const tilt = (i & 1) ? 2.0 : -2.0;
      drawLuminousLine(p, cx - stitchW, sy - tilt, cx + stitchW, sy + tilt, WHITE, seamFade * 0.9);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8);
  const M = fit(o.metal, 6);
  const SP = fit(o.sparks, 5);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, SP[1], SP[2], SP[4], C[6]],
  });
  const lights = new Lights();

  // Top-lock starburst kept compact so spikes stay strictly inside top of canvas; huge climax starburst centered at Y_MID!
  const lockStarTop = spikes(R, 12, -Math.PI * 0.5, { len: [10, 16], w: [1.6, 2.4], fwd: 1.15, back: 1.0, jag: 0.45 });
  const lockStarMid = spikes(R, 16, 0, { len: [18, 28], w: [2.2, 3.2], fwd: 1.35, back: 1.35, jag: 0.55 });

  let t = 0;
  let z1StartFired = false;
  let swallowFired = false;
  let z1CloseFired = false;
  let z2StartFired = false;
  let spitFired = false;
  let z2CloseFired = false;

  // Snapshot buffers to cleanly hide the character while inside 4th-dimensional zipper space (`t in [T_SWALLOW1, T_SPIT0+0.06]`)
  let savedC = null;
  let savedL = null;
  let chestBefore = 0;

  const capLife = (l) => Math.max(0.08, Math.min(l, T_END - 0.14 - t));

  function getZipper1State(tt) {
    if (tt < T_Z1_APPEAR || tt >= T_Z1_ZIP1 + 0.04) return { active: false };
    let sliderY = Y_TOP;
    let pullAng = Math.PI * 0.5;
    let isMoving = false;
    let moveDir = 0;
    let openScale = 1;

    if (tt < T_Z1_UNZIP0) {
      sliderY = Y_TOP;
      openScale = 0;
    } else if (tt < T_Z1_UNZIP1) {
      const u = (tt - T_Z1_UNZIP0) / (T_Z1_UNZIP1 - T_Z1_UNZIP0);
      sliderY = lerp(Y_TOP, Y_BOT, ease.inOutCubic(u));
      pullAng = Math.PI * 0.5 - 0.58 * Math.sin(u * Math.PI);
      isMoving = true;
      moveDir = 1;
    } else if (tt < T_Z1_ZIP0) {
      sliderY = Y_BOT;
      const gulp = Math.sin(clamp((tt - T_SWALLOW0) / (T_SWALLOW1 - T_SWALLOW0)) * Math.PI);
      openScale = 1 + 0.18 * gulp;
    } else {
      const u = clamp((tt - T_Z1_ZIP0) / (T_Z1_ZIP1 - T_Z1_ZIP0));
      sliderY = lerp(Y_BOT, Y_TOP, ease.inOutCubic(u));
      pullAng = Math.PI * 0.5 + 0.48 * Math.sin(u * Math.PI);
      isMoving = true;
      moveDir = -1;
      openScale = 1 - 0.25 * u;
    }

    const sliderScale = tt < T_Z1_UNZIP0
      ? ease.outBack(clamp((tt - T_Z1_APPEAR) / (T_Z1_UNZIP0 - T_Z1_APPEAR)), 1.5)
      : tt > T_Z1_ZIP1 - 0.08
        ? clamp((T_Z1_ZIP1 + 0.04 - tt) / 0.12)
        : 1;

    return { active: true, sliderY, pullAng, isMoving, moveDir, openScale, sliderScale };
  }

  function getZipper2State(tt) {
    if (tt < T_Z2_APPEAR || tt >= T_Z2_ZIP1 + 0.04) return { active: false };
    let sliderY = Y_TOP;
    let pullAng = Math.PI * 0.5;
    let isMoving = false;
    let moveDir = 0;
    let openScale = 1;

    if (tt < T_Z2_UNZIP0) {
      sliderY = Y_TOP;
      openScale = 0;
    } else if (tt < T_Z2_UNZIP1) {
      const u = (tt - T_Z2_UNZIP0) / (T_Z2_UNZIP1 - T_Z2_UNZIP0);
      sliderY = lerp(Y_TOP, Y_BOT, ease.outCubic(u));
      pullAng = Math.PI * 0.5 - 0.62 * Math.sin(u * Math.PI);
      isMoving = true;
      moveDir = 1;
    } else if (tt < T_Z2_ZIP0) {
      sliderY = Y_BOT;
      const spitPulse = Math.sin(clamp((tt - T_SPIT0) / (T_SPIT1 - T_SPIT0)) * Math.PI);
      openScale = 1 + 0.22 * spitPulse;
    } else {
      const u = clamp((tt - T_Z2_ZIP0) / (T_Z2_ZIP1 - T_Z2_ZIP0));
      sliderY = lerp(Y_BOT, Y_TOP, ease.inCubic(u));
      pullAng = Math.PI * 0.5 + 0.58 * Math.sin(u * Math.PI);
      isMoving = true;
      moveDir = -1;
      openScale = 1 - 0.2 * u;
    }

    const sliderScale = tt < T_Z2_UNZIP0
      ? ease.outBack(clamp((tt - T_Z2_APPEAR) / (T_Z2_UNZIP0 - T_Z2_APPEAR)), 1.6)
      : tt > T_Z2_ZIP1 - 0.06
        ? clamp((T_Z2_ZIP1 + 0.04 - tt) / 0.10)
        : 1.06;

    return { active: true, sliderY, pullAng, isMoving, moveDir, openScale, sliderScale };
  }

  return {
    update(dt) {
      t += dt;

      const z1 = getZipper1State(t);
      const z2 = getZipper2State(t);

      // 1. Zipper 1 materializes & rips downward: spawn tooth-bite sparks from the slider throat!
      if (!z1StartFired && t >= T_Z1_APPEAR) {
        z1StartFired = true;
        lights.add(Z1_X, Y_TOP + 12, 38, M[4], 0.78, 0.22);
      }
      if (z1.active && z1.isMoving && R.chance(0.88)) {
        const sp = R.range(75, 185);
        const a = R.range(-0.80, 0.80) + (R.chance(0.5) ? 0 : Math.PI);
        ps.spawn(
          R.chance(0.35) ? P.STAR : P.SPARK,
          Z1_X + R.range(-4, 4),
          z1.sliderY,
          Math.cos(a) * sp,
          Math.sin(a) * sp - z1.moveDir * R.range(20, 55),
          capLife(R.range(0.18, 0.38)),
          R.pick([WHITE, SP[1], SP[2], SP[4]]),
          R.range(1.0, 1.7),
        );
      }

      // 2. Hero swallowed into Zipper 1's Starry Black Hole (`t = T_SWALLOW1`)
      if (!swallowFired && t >= T_SWALLOW1) {
        swallowFired = true;
        lights.add(Z1_X, Y_MID, 56, C[5], 0.82, 0.24);
        lights.add(Z1_X, Y_MID, 26, WHITE, 0.88, 0.10);
        for (let i = 0; i < 24; i++) {
          const a = R.range(0, TAU), sp = R.range(50, 140);
          ps.spawn(
            i % 2 === 0 ? P.STAR : P.SPARK,
            Z1_X + R.range(-6, 6),
            Y_MID + R.range(-16, 16),
            Math.cos(a) * sp,
            Math.sin(a) * sp - 10,
            capLife(R.range(0.20, 0.40)),
            R.pick([WHITE, SP[4], C[6]]),
            R.range(1.0, 1.8),
          );
        }
      }

      // 3. Zipper 1 seals shut at `T_Z1_ZIP1` (1.26s)
      if (!z1CloseFired && t >= T_Z1_ZIP1) {
        z1CloseFired = true;
        lights.add(Z1_X, Y_TOP + 14, 42, SP[2], 0.82, 0.22);
        lights.add(Z1_X, Y_MID, 52, C[5], 0.72, 0.24);
        for (let i = 0; i < 24; i++) {
          const sy = R.range(Y_TOP + 8, Y_BOT - 4);
          const dir = R.sign();
          ps.spawn(
            i % 3 === 0 ? P.STAR : P.SPARK,
            Z1_X,
            sy,
            dir * R.range(70, 170),
            R.range(-30, 20),
            capLife(R.range(0.18, 0.36)),
            R.pick([WHITE, SP[1], SP[4], C[6]]),
            R.range(1.0, 1.7),
          );
        }
      }

      // 4. Zipper 2 materializes at destination (`Z2_X = 152`) & rips downward
      if (!z2StartFired && t >= T_Z2_APPEAR) {
        z2StartFired = true;
        lights.add(Z2_X, Y_TOP + 12, 40, M[4], 0.82, 0.22);
      }
      if (z2.active && z2.isMoving && R.chance(0.90)) {
        const sp = R.range(80, 195);
        const a = R.range(-0.80, 0.80) + (R.chance(0.5) ? 0 : Math.PI);
        ps.spawn(
          R.chance(0.35) ? P.STAR : P.SPARK,
          Z2_X + R.range(-4, 4),
          z2.sliderY,
          Math.cos(a) * sp,
          Math.sin(a) * sp - z2.moveDir * R.range(20, 55),
          capLife(R.range(0.18, 0.40)),
          R.pick([WHITE, SP[1], SP[2], SP[4]]),
          R.range(1.0, 1.8),
        );
      }

      // 5. Zipper 2 spits out the hero (`T_SPIT0 = 1.66s`)
      if (!spitFired && t >= T_SPIT0 + 0.04) {
        spitFired = true;
        lights.add(Z2_X + 16, Y_MID + 8, 58, SP[4], 0.82, 0.26);
        for (let i = 0; i < 34; i++) {
          const a = R.range(-0.58, 0.48);
          const sp = R.range(105, 240);
          ps.spawn(
            i % 3 === 0 ? P.STAR : P.SPARK,
            Z2_X + 6,
            Y_MID + R.range(-16, 16),
            Math.cos(a) * sp,
            Math.sin(a) * sp - R.range(8, 30),
            capLife(R.range(0.22, 0.46)),
            R.pick([WHITE, SP[4], C[6], SP[1]]),
            R.range(1.1, 1.9),
          );
        }
      }

      // 6. Climax: Zipper 2 slams shut at `T_Z2_ZIP1` (2.38s) -> SPATIAL RIFT CLOSURE AIR-BLAST!
      if (!z2CloseFired && t >= T_Z2_ZIP1) {
        z2CloseFired = true;
        lights.add(Z2_X, Y_TOP + 16, 44, SP[2], 0.88, 0.30);
        lights.add(Z2_X, Y_MID, 66, C[5], 0.86, 0.38);
        lights.add(Z2_X, Y_MID, 36, WHITE, 0.92, 0.14);

        for (let i = 0; i < 54; i++) {
          const sy = R.range(Y_TOP + 10, Y_BOT - 4);
          const dir = R.sign();
          const sp = R.range(90, 245);
          const a = (dir > 0 ? 0 : Math.PI) + R.range(-0.38, 0.38);
          ps.spawn(
            i % 3 === 0 ? P.STAR : P.SPARK,
            Z2_X + dir * 2,
            sy,
            Math.cos(a) * sp,
            Math.sin(a) * sp - R.range(5, 25),
            capLife(R.range(0.22, 0.52)),
            R.pick([WHITE, SP[1], SP[2], SP[4], C[6]]),
            R.range(1.1, 1.9),
          );
        }
      }

      ps.update(dt);
      cullList(ps.list, X_MIN + 10, Y_MIN + 14, X_MAX - 10, Y_MAX - 8);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;

      // Back half of the Closure Air-Blast floor rings for Zipper 1 (compact 0.24s pop) & Zipper 2 (full climax blast)
      drawClosureAirBlast(p, Z1_X, t - T_Z1_ZIP1, 0.24, 0.62, C, M, SP, true);
      drawClosureAirBlast(p, Z2_X, t - T_Z2_ZIP1, T_BLAST_END - T_Z2_ZIP1, 1.12, C, M, SP, true);

      // Subtle floor glow under active zippers
      const z1 = getZipper1State(t);
      if (z1.active) {
        drawLuminousFloorRing(p, Z1_X, 0.5, 21 * z1.openScale, SY_FLOOR, 1.8, 0.72 * z1.openScale, C[4], C[6], (g) => Math.sin(g) < 0);
      }
      const z2 = getZipper2State(t);
      if (z2.active) {
        drawLuminousFloorRing(p, Z2_X, 0.5, 23 * z2.openScale, SY_FLOOR, 2.0, 0.78 * z2.openScale, C[4], SP[4], (g) => Math.sin(g) < 0);
      }

      ps.draw(p, "back");

      // Record chest pixel & snapshot buffers when the hero is inside 4th-dimensional zipper space (`[T_SWALLOW1, T_SPIT0+0.06]`)
      const q = poseAt(act.poses, t);
      chestBefore = p.get(Math.round(q.x ?? 0), Math.round(q.y ?? 0) - 20);
      if (t >= T_SWALLOW1 - 0.02 && t < T_SPIT0 + 0.06) {
        if (!savedC || savedC.length !== p.C.length) {
          savedC = new Uint32Array(p.C.length);
          savedL = new Uint32Array(p.L.length);
        }
        savedC.set(p.C);
        savedL.set(p.L);
      }
    },

    draw(p) {
      if (t >= T_END - 0.04) return;

      // 1. If the hero is currently inside hyperspace between Zipper 1 and Zipper 2, erase the stage character!
      const q = poseAt(act.poses, t);
      const rx = Math.round(q.x ?? 0), ry = Math.round(q.y ?? 0);
      const actPaintedHero = p.get(rx, ry - 20) !== chestBefore;

      if (t >= T_SWALLOW1 - 0.02 && t < T_SPIT0 + 0.06 && savedC && savedC.length === p.C.length) {
        p.C.set(savedC);
        p.L.set(savedL);
      } else if (!actPaintedHero && t >= T_SPIT0 + 0.06) {
        // In `render.mjs` (where `createAct` is not running and `actorAlpha(t) === 0`), draw the ejected hero at destination!
        const r = posed(q);
        for (let i = 0; i < r.n; i++) {
          p.px(rx + r.xs[i], ry + r.ys[i], r.color[i]);
        }
      }

      const z1 = getZipper1State(t);
      const z2 = getZipper2State(t);

      // 2. Flush Particles & Point Lights BEFORE drawing the Starry Black Hole (`unlight`) and Metallic Zippers
      //    so the black-hole interior stays 100% pitch-black (`C[0]`) and the metallic slider bevels stay crisp!
      ps.draw(p, "front");
      lights.draw(p);

      // 3. ENTRY ZIPPER 1 (at `Z1_X = 38`)
      if (z1.active) {
        drawStarryBlackHoleRift(p, Z1_X, z1.sliderY, z1.openScale, t, C, M, SP, o.seed);
        drawLuminousFloorRing(p, Z1_X, 0.5, 21 * z1.openScale, SY_FLOOR, 1.8, 0.75 * z1.openScale, C[4], C[6], (g) => Math.sin(g) >= 0);
        drawZipperTracksAndTeeth(p, Z1_X, z1.sliderY, z1.openScale, z1.isMoving, z1.moveDir, t, C, M, SP);
        drawGiantZipperSlider(
          p,
          Z1_X,
          z1.sliderY,
          z1.pullAng,
          z1.sliderScale,
          t < T_Z1_APPEAR + 0.04 || Math.abs(t - T_Z1_ZIP1) < 0.04,
          M,
          SP,
        );
      }

      // Spaghettified hero strands being sucked into Zipper 1 (`T_SWALLOW0 .. T_SWALLOW1`)
      if (t >= T_SWALLOW0 && t <= T_SWALLOW1 + 0.04) {
        const uSwallow = clamp((t - T_SWALLOW0) / (T_SWALLOW1 - T_SWALLOW0));
        drawSpaghettifiedHero(p, 6, -4, Z1_X, Y_MID, uSwallow, true, C, SP);
      }

      // Zipper 1 Compact Closure Pop (`t >= T_Z1_ZIP1`)
      const ageClose1 = t - T_Z1_ZIP1;
      if (ageClose1 >= 0 && ageClose1 < 0.24) {
        drawClosureAirBlast(p, Z1_X, ageClose1, 0.24, 0.62, C, M, SP, false);
        if (ageClose1 < 0.10) {
          const hk = 1 - ageClose1 / 0.10;
          star(p, Z1_X, Y_TOP + 6, lockStarTop, 1.0, hk, [SP[3], SP[2], SP[1], WHITE], 1, 2.0);
          flare(p, Z1_X, Y_TOP + 6, 22 * hk, hk, [C[5], SP[4], SP[1], WHITE]);
        }
      }

      // 4. DESTINATION ZIPPER 2 (at `Z2_X = 152`)
      if (z2.active) {
        drawStarryBlackHoleRift(p, Z2_X, z2.sliderY, z2.openScale, t, C, M, SP, o.seed + 53);
        drawLuminousFloorRing(p, Z2_X, 0.5, 23 * z2.openScale, SY_FLOOR, 2.0, 0.82 * z2.openScale, C[4], SP[4], (g) => Math.sin(g) >= 0);
        drawZipperTracksAndTeeth(p, Z2_X, z2.sliderY, z2.openScale, z2.isMoving, z2.moveDir, t, C, M, SP);
        drawGiantZipperSlider(
          p,
          Z2_X,
          z2.sliderY,
          z2.pullAng,
          z2.sliderScale,
          t < T_Z2_APPEAR + 0.04 || Math.abs(t - T_Z2_ZIP1) < 0.04,
          M,
          SP,
        );
      }

      // Spaghettified hero strands bursting out of Zipper 2 (`T_SPIT0 .. T_SPIT1`)
      if (t >= T_SPIT0 && t <= T_SPIT1) {
        const uSpit = clamp((t - T_SPIT0) / (T_SPIT1 - T_SPIT0));
        drawSpaghettifiedHero(p, DEST_X - 6, 0, Z2_X, Y_MID, uSpit, false, C, SP);
        if (uSpit < 0.28) {
          const hk = 1 - uSpit / 0.28;
          flare(p, Z2_X + 12, Y_MID, 26 * hk, hk, [C[5], SP[4], SP[1], WHITE]);
        }
      }

      // 5. CLIMAX: DESTINATION ZIPPER 2 CLOSURE AIR-BLAST & STITCHED REALITY-SEAM (`t >= T_Z2_ZIP1`)
      const ageClose2 = t - T_Z2_ZIP1;
      if (ageClose2 >= 0 && ageClose2 < T_BLAST_END - T_Z2_ZIP1) {
        drawClosureAirBlast(p, Z2_X, ageClose2, T_BLAST_END - T_Z2_ZIP1, 1.12, C, M, SP, false);
        if (ageClose2 < 0.14) {
          const hk = 1 - ageClose2 / 0.14;
          const hot = ageClose2 < 0.05;
          star(p, Z2_X, Y_TOP + 6, lockStarTop, 1.1, hk, [SP[3], SP[2], SP[1], WHITE], 1, 2.2);
          star(p, Z2_X, Y_MID, lockStarMid, hot ? 1.05 : 1.25, hot ? 1.0 : 0.65, [C[5], SP[4], SP[1], WHITE], 1, 2.8);
          flare(p, Z2_X, Y_TOP + 6, 30 * hk, hk, [SP[3], SP[2], SP[1], WHITE]);
          flare(p, Z2_X, Y_MID, 44 * hk, hk, [C[5], SP[4], SP[1], WHITE]);
          sparkle(p, Z2_X, Y_TOP + 6, Math.round(14 * hk), WHITE, SP[2], hk);
        }
      }
    },
  };
}

function cullList(L, x0, y0, x1, y1) {
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i];
    const r = (q.size || 2) * 1.8 + 4;
    if (q.x - r < x0 || q.x + r > x1 || q.y - r < y0 || q.y + r > y1) {
      L.splice(i, 1);
    }
  }
}
