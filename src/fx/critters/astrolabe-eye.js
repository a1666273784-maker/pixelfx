// Celestial armillary ring projection & sweeping sheen build on ../holy/divine-shield.js and ../arcane/rune-circle.js;
// helical solar laser beam & molten floor fissures build on ../arcane/arcane-beam.js and ../holy/smite.js;
// creeping stone petrification builds on ../status/petrified.js (adapted from Sprite Fusion's open-source VFX, MIT, Hugo Duprez).
import {
  Particles,
  Lights,
  P,
  PF,
  Rng,
  fit,
  band,
  flare,
  sparkle,
  bolt,
  clamp,
  smooth,
  seg,
  ease,
  lerp,
  rand,
  tileFbm,
  TAU,
  WHITE,
  hex,
  mix,
} from "../../core/index.js";
import { Grid, shadow } from "./_lib.js";
import { bayer } from "../arcane/_lib.js";
import { oval } from "../holy/_lib.js";
import { scorch } from "../lightning/_lib.js";
import { spikes, star, frontCrescent } from "../impacts/_lib.js";

export const meta = {
  name: "Astrolabe eye",
  desc: "A sapphire eye in three rotating rune-gold rings snaps into a saucer trailing stardust, locks into a front crosshair firing a solar laser, then petrifies as its rings shatter.",
  tags: ["critter", "monster", "astrolabe", "eye", "holy", "solar", "laser", "one-shot"],
  size: [296, 156],
  origin: [152, 118],
  duration: 7.6,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#28130a", "#5c2d12", "#9e5618", "#df9222", "#ffd046", "#ffee9c", "#fffbe0", "#ffffff"],
    sapphire: ["#050d24", "#0c2257", "#1748a6", "#2986eb", "#5ce2ff", "#c2fbff", "#ffffff"],
    solar: ["#3c0d06", "#85220a", "#d95010", "#ff8c1a", "#ffd036", "#fff3a2", "#ffffff"],
    stone: ["#15131d", "#272433", "#3f3b4e", "#5b566c", "#7e788f", "#a6a0b5", "#d4cfe0"],
    seed: 11,
  },
};

// 4-Stage Choreography Timeline (seconds):
// 0.00..1.90  【待机 Idle】   Glowing sapphire cyclops eye hovers; 3 rune-carved gold rings tumble on 3 axes with sweeping metallic sheen
// 1.90..3.25  【移动 Move】   3 rings snap into a horizontal UFO saucer, rocketing right wrapped round the eye with golden stardust stream
// 3.25..5.32  【攻击 Attack】 Rings surge ahead & lock into an ornate crosshair scope; eye charges & fires a searing solar laser onto floor
// 5.32..7.60  【倒地 KO】     Sapphire eye extinguishes & petrifies to grey stone; gold rings snap inch-by-inch, lose buoyancy & clatter down
const T_MOVE = 1.90;
const T_SAUCER = 2.08;
const T_BRAKE = 3.04;
const T_ATK = 3.25;
const T_LOCK = 3.66;
const T_FIRE = 3.98;
const T_HIT = 4.02;
const T_BEAM_END = 4.94;
const T_KO = 5.32;
const T_SHATTER = 5.64;

const X_IDLE = -82;
const Y_IDLE = -43;
const X_ATK = -16;
const Y_ATK = -46;
const X_HIT = 88;
const Y_HIT = 0;

// Collinear sightline from Eye (X_ATK, Y_ATK) -> Crosshair Scope (X_SCOPE, Y_SCOPE) -> Floor Target (X_HIT, Y_HIT)
const AIM_DX = X_HIT - X_ATK;
const AIM_DY = Y_HIT - Y_ATK;
const AIM_LEN = Math.hypot(AIM_DX, AIM_DY);
const AIM_UX = AIM_DX / AIM_LEN;
const AIM_UY = AIM_DY / AIM_LEN;
const AIM_ANG = Math.atan2(AIM_DY, AIM_DX);
const X_SCOPE = X_ATK + AIM_DX * 0.255;
const Y_SCOPE = Y_ATK + AIM_DY * 0.255;

const R_EYE = 10.5;
const RING_SPECS = [
  { r: 14.8, w: 2.3, runes: 8 },
  { r: 19.4, w: 2.6, runes: 10 },
  { r: 24.2, w: 3.0, runes: 12 },
];

// Directional celestial light & view half-vector for rotating metallic specular highlights
const LX = -0.53, LY = -0.66, LZ = 0.53;
const HX = -0.31, HY = -0.39, HZ = 0.87;

// Crisp rune glyphs along ring tangent [-1, 0, +1] x axial [-1, 0, +1]
const RING_GLYPHS = [
  [[-1, -1], [0, -1], [0, 0], [0, 1], [1, 1]],
  [[-1, 0], [0, -1], [1, 0], [0, 1], [0, 0]],
  [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]],
  [[-1, 1], [0, -1], [0, 0], [1, 1], [0, 1]],
  [[-1, -1], [0, 0], [1, -1], [-1, 1], [1, 1]],
  [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]],
];

function basisFromEuler(rx, ry, rz) {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  const u1x = cy, u1y = sx * sy, u1z = cx * sy;
  const v1x = 0, v1y = cx, v1z = -sx;
  const n1x = -sy, n1y = sx * cy, n1z = cx * cy;
  return {
    U: [cz * u1x - sz * u1y, sz * u1x + cz * u1y, u1z],
    V: [-sz * v1y, cz * v1y, v1z],
    N: [cz * n1x - sz * n1y, sz * n1x + cz * n1y, n1z],
  };
}

function lerpAngle(a, b, u) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * u;
}

// Compute eye & 3-ring state for t < T_SHATTER
function stateAt(t) {
  let ex = X_IDLE;
  let ey = Y_IDLE;
  let lookX = 0.8;
  let lookY = 0;
  let lid = 0;
  let pupilSlit = 0.35;
  let solarMix = 0;
  let stoneLv = 0;
  let saucerK = 0;
  let scopeLock = 0;

  // Genuine 3-axis gyroscopic slow rotation in Idle (`沿着不同轴向缓慢自转` — each ring tumbles around its own axis!)
  const tIdle = Math.min(t, T_MOVE);
  const idleAngles = [
    // Ring 0 (Inner): tumbles steadily on X-tilt + spins runes clockwise
    [0.45 + tIdle * 1.15, 0.52 + 0.25 * Math.sin(tIdle * 1.4), -0.35, tIdle * 1.55],
    // Ring 1 (Middle): tumbles steadily on Y-axis + counter-rotates
    [-0.62 + 0.22 * Math.cos(tIdle * 1.2), -0.35 + tIdle * 1.05, 0.48, -tIdle * 1.25 + 1.1],
    // Ring 2 (Outer): majestic diagonal precession on Z & X axes
    [0.52 + 0.38 * Math.sin(tIdle * 1.35 + 0.4), -0.58 + 0.35 * Math.cos(tIdle * 1.15), 0.25 + tIdle * 0.72, tIdle * 0.95 + 2.2],
  ];

  const rings = [0, 1, 2].map((i) => ({
    cx: ex,
    cy: ey,
    r: RING_SPECS[i].r,
    w: RING_SPECS[i].w,
    runes: RING_SPECS[i].runes,
    rx: idleAngles[i][0],
    ry: idleAngles[i][1],
    rz: idleAngles[i][2],
    spin: idleAngles[i][3],
    runeHot: 0,
    crackK: 0,
    saucerMode: 0,
  }));

  if (t < T_MOVE) {
    // STAGE 1: IDLE — Majestic levitation + sapphire eye gaze shifts + 3-axis slow astrolabe rotation
    const spawnK = ease.outBack(clamp(t / 0.18), 1.35);
    const bob = Math.sin(t * TAU * 0.55);
    ex = X_IDLE + 1.5 * Math.sin(t * TAU * 0.28);
    ey = Y_IDLE - 3.4 * bob;

    if (t < 0.55) {
      lookX = 0.9; lookY = -0.4;
    } else if (t < 1.18) {
      const u = ease.outBack(clamp((t - 0.55) / 0.12), 1.8);
      lookX = lerp(0.9, 2.9, u);
      lookY = lerp(-0.4, 0.7, u);
    } else {
      const u = ease.outBack(clamp((t - 1.18) / 0.12), 1.8);
      lookX = lerp(2.9, 1.5, u);
      lookY = lerp(0.7, -0.8, u);
    }
    // Partial sapphire-filigree blink so the glowing blue iris slit still gleams through!
    if (t > 0.90 && t < 1.08) {
      lid = Math.sin(((t - 0.90) / 0.18) * Math.PI) * 0.56;
    }

    for (let i = 0; i < 3; i++) {
      rings[i].cx = ex;
      rings[i].cy = ey;
      rings[i].r = RING_SPECS[i].r * (0.86 + 0.14 * spawnK);
      rings[i].runeHot = 0.48 + 0.22 * Math.sin(t * 3.8 + i);
    }
  } else if (t < T_ATK) {
    // STAGE 2: MOVE — 3 rings snap flat into concentric horizontal UFO saucer, rocketing 68px right trailing golden stardust!
    const alignU = ease.outBack(clamp((t - T_MOVE) / (T_SAUCER - T_MOVE)), 1.65);
    let pitch = 0;

    if (t < T_SAUCER) {
      ex = lerp(X_IDLE, X_IDLE - 4.5, ease.inOutSine(seg(t, T_MOVE, T_SAUCER)));
      ey = lerp(Y_IDLE, -40, seg(t, T_MOVE, T_SAUCER));
      pitch = lerp(0, 0.08, alignU);
    } else if (t < T_BRAKE) {
      const u = seg(t, T_SAUCER, T_BRAKE);
      const glide = u < 0.12 ? ease.inQuad(u / 0.12) * 0.12 : 0.12 + 0.88 * ease.outQuart((u - 0.12) / 0.88);
      ex = lerp(X_IDLE - 4.5, X_ATK + 5, glide);
      saucerK = Math.sin(Math.pow(u, 0.58) * Math.PI);
      ey = -40 - 1.5 * Math.sin(u * TAU * 2.5);
      pitch = 0.14 * saucerK; // sleek aerodynamic forward tilt!
    } else {
      const u = seg(t, T_BRAKE, T_ATK);
      const k = ease.outBack(u, 1.8);
      ex = lerp(X_ATK + 5, X_ATK, k);
      ey = lerp(-40, Y_ATK, ease.outCubic(u));
      pitch = lerp(0.08, -0.04, ease.outCubic(u));
    }

    lookX = 3.4;
    lookY = 0.3;
    pupilSlit = 0.58;

    // Horizontal UFO saucer: stepped tilts & radii so all 3 concentric golden saucer tiers read cleanly!
    const saucerRxs = [1.36, 1.33, 1.30];
    const saucerRadii = [13.8, 19.2, 24.8];
    for (let i = 0; i < 3; i++) {
      const [irx, iry, irz, ispin] = idleAngles[i];
      const fastSpin = ispin + (t - T_MOVE) * (i % 2 === 0 ? 12.5 : -10.5);
      rings[i].cx = ex;
      rings[i].cy = ey + (i - 1) * 0.9 * clamp(alignU);
      rings[i].r = lerp(RING_SPECS[i].r, saucerRadii[i], clamp(alignU));
      rings[i].w = lerp(RING_SPECS[i].w, 2.0, clamp(alignU));
      rings[i].rx = lerpAngle(irx, saucerRxs[i], clamp(alignU));
      rings[i].ry = lerpAngle(iry, 0, clamp(alignU));
      rings[i].rz = lerpAngle(irz, pitch, clamp(alignU));
      rings[i].spin = fastSpin;
      rings[i].runeHot = 0.65 + 0.35 * saucerK;
      rings[i].saucerMode = clamp(alignU);
    }
  } else if (t < T_KO) {
    // STAGE 3: ATTACK — All 3 rings surge in front of body & lock into an ornate Crosshair Scope; eye charges & fires Solar Laser!
    const lockU = clamp((t - T_ATK) / (T_LOCK - T_ATK));
    scopeLock = ease.outBack(lockU, 1.45);

    const isFiring = t >= T_FIRE && t < T_BEAM_END;
    const postBeam = t >= T_BEAM_END ? seg(t, T_BEAM_END, T_KO) : 0;

    const chargeU = t >= T_LOCK && t < T_FIRE ? seg(t, T_LOCK, T_FIRE) : t >= T_FIRE ? 1 : 0;
    const recoil = t >= T_FIRE
      ? (t < T_FIRE + 0.08
          ? ease.outQuad((t - T_FIRE) / 0.08)
          : 1 - 0.65 * ease.outCubic(clamp((t - T_FIRE - 0.08) / 0.92)))
      : 0;
    const tremor = (t >= T_LOCK && t < T_BEAM_END) ? Math.sin(t * 95) * (0.45 + 0.65 * (isFiring ? 1 : chargeU)) : 0;

    ex = X_ATK - AIM_UX * 5.0 * recoil + tremor * 0.5;
    ey = Y_ATK - AIM_UY * 5.0 * recoil + Math.cos(t * 82) * 0.35 * (isFiring ? 1 : chargeU);

    lookX = AIM_UX * 3.5;
    lookY = AIM_UY * 3.5;
    pupilSlit = clamp(0.58 + 0.42 * chargeU);
    solarMix = t < T_BEAM_END ? clamp(chargeU * 1.15) : clamp(1 - postBeam * 1.35);

    const retBack = postBeam > 0 ? ease.inOutQuad(postBeam) * 0.58 : 0;
    const scx = lerp(X_ATK, X_SCOPE, clamp(scopeLock)) * (1 - retBack) + ex * retBack;
    const scy = lerp(Y_ATK, Y_SCOPE, clamp(scopeLock)) * (1 - retBack) + ey * retBack;

    // Staggered per-ring lock into an unmistakable Celestial Crosshair Reticle (`⊕` / 十字瞄准镜):
    const targetEulers = [
      [1.50, 0.0, AIM_ANG],
      [0.0, 1.50, AIM_ANG],
      [0.0, 0.86, AIM_ANG],
    ];
    const saucerRadii = [13.8, 19.2, 24.8];
    const targetRadii = [21.5, 24.2, 22.2];

    for (let i = 0; i < 3; i++) {
      const uRing = clamp((t - (T_ATK + (2 - i) * 0.055)) / 0.29);
      const kRing = ease.outBack(uRing, 1.65);
      const unlock = postBeam > 0 ? ease.inQuad(postBeam) : 0;

      rings[i].cx = lerp(ex, scx, clamp(kRing));
      rings[i].cy = lerp(ey, scy, clamp(kRing));
      rings[i].r = lerp(saucerRadii[i], targetRadii[i], clamp(kRing));
      rings[i].w = i === 2 ? 2.8 : 2.2;
      rings[i].rx = lerp(lerpAngle(1.36 - i * 0.03, targetEulers[i][0], clamp(kRing)), 0.58 * (i - 1), unlock * 0.55);
      rings[i].ry = lerp(lerpAngle(0.0, targetEulers[i][1], clamp(kRing)), 0.65, unlock * 0.5);
      rings[i].rz = lerpAngle(0.0, targetEulers[i][2], clamp(kRing));
      rings[i].spin = (1 - clamp(uRing * 1.15)) * (t * (i % 2 ? -14 : 14));
      rings[i].runeHot = clamp(0.5 + 0.5 * chargeU) * (1 - postBeam * 0.75);
    }
  } else {
    // STAGE 4 (Pre-shatter `5.32..5.64s`): Eye light extinguishes & petrifies; rings drift back, shudder & crack inch-by-inch!
    const u = seg(t, T_KO, T_SHATTER);
    const judder = Math.sin(t * 115) * 1.4 * u;
    ex = lerp(X_ATK - AIM_UX * 1.5, -18, u) + judder;
    // Pronounced downward sag as levitation fails!
    ey = lerp(Y_ATK - AIM_UY * 1.5, -31, ease.inQuad(u));
    lookX = lerp(AIM_UX * 2.4, 0.5, u);
    lookY = lerp(AIM_UY * 2.4, 0.9, u);
    stoneLv = u * 1.28;
    pupilSlit = 0.5;

    for (let i = 0; i < 3; i++) {
      const scx0 = lerp(X_SCOPE, X_ATK, 0.58);
      const scy0 = lerp(Y_SCOPE, Y_ATK, 0.58);
      rings[i].cx = lerp(scx0, ex, ease.outQuad(u)) + Math.sin(t * 98 + i * 2.1) * 1.3 * u;
      rings[i].cy = lerp(scy0, ey, ease.outQuad(u)) + Math.cos(t * 90 + i) * 1.0 * u;
      rings[i].r = RING_SPECS[i].r * 0.96;
      rings[i].rx = lerp(0.58 * (i - 1), 0.70 * (i === 1 ? -1 : 1), u);
      rings[i].ry = lerp(0.65, 0.52 * (i - 0.5), u);
      rings[i].rz = AIM_ANG * (1 - 0.65 * u) + i * 0.38 * u;
      rings[i].spin = i * 0.8 + u * 0.25 * (i % 2 ? -1 : 1);
      rings[i].runeHot = 0;
      // Staggered fracture cracks: inner ring cracks first (u=0.16), middle (u=0.32), outer (u=0.48) -> "寸寸断裂"!
      rings[i].crackK = smooth(0.16 + i * 0.16, 0.70 + i * 0.12, u);
    }
  }

  return { ex, ey, lookX, lookY, lid, pupilSlit, solarMix, stoneLv, saucerK, scopeLock, rings };
}

// Render one 3D metallic rune-ring (half = -1 for z < 0 back pass, +1 for z >= 0 front pass)
function drawAstrolabeRing(p, ring, G, E, S, t, half, zBuf, ringIdx) {
  const { U, V, N } = basisFromEuler(ring.rx, ring.ry, ring.rz);
  const R = ring.r;
  const halfH = ring.w * 0.5;
  const steps = Math.max(80, Math.ceil(R * TAU * 1.8));
  const nRunes = ring.runes;

  // Chasing metallic specular sheen sweeping smoothly round each rotating ring (`圆环旋转的金属高光细节`)!
  const sheenAng = t * (ringIdx === 1 ? -2.6 : 2.3) + ringIdx * 2.1;

  for (let j = 0; j < steps; j++) {
    const th = (j / steps) * TAU;
    const ct = Math.cos(th), st = Math.sin(th);

    const nrx = ct * U[0] + st * V[0];
    const nry = ct * U[1] + st * V[1];
    const nrz = ct * U[2] + st * V[2];

    const zCenter = R * nrz;
    if (half < 0 && zCenter >= 0) continue;
    if (half > 0 && zCenter < 0) continue;

    const cx = ring.cx + R * nrx;
    const cy = ring.cy + R * nry;

    const diff = nrx * LX + nry * LY + nrz * LZ;
    const specDot = Math.max(0, nrx * HX + nry * HY + nrz * HZ);
    const specPow = ring.saucerMode > 0.5 ? 28 : 13;
    const spec = Math.pow(specDot, specPow);
    const chaseGap = Math.abs(Math.atan2(Math.sin(th - sheenAng), Math.cos(th - sheenAng)));
    const chaseSheen = Math.max(0, 1 - chaseGap / (ring.saucerMode > 0.5 ? 0.22 : 0.36));
    const depthFade = zCenter < 0 ? 0.80 : 1.0;

    // Widening fracture gaps at 5 break-joints as the ring cracks inch-by-inch (`寸寸断裂`)!
    const relAng = ((th - ring.spin) % TAU + TAU) % TAU;
    if (ring.crackK > 0.40) {
      let inGap = false;
      for (let b = 0; b < 5; b++) {
        const bAng = (b * TAU) / 5 + 0.25 + ringIdx * 0.2;
        const dAng = Math.abs(Math.atan2(Math.sin(relAng - bAng), Math.cos(relAng - bAng)));
        if (dAng < 0.095 * ring.crackK) {
          inGap = true;
          break;
        }
      }
      if (inGap) continue;
    }

    for (let h = -halfH; h <= halfH + 0.01; h += 0.62) {
      const px = Math.round(cx + h * N[0]);
      const py = Math.round(cy + h * N[1]);
      const pz = zCenter + h * N[2];
      const zKey = (py + 256) * 1024 + (px + 256);
      const prevZ = zBuf.get(zKey);
      if (prevZ !== undefined && prevZ > pz + 0.35) continue;
      zBuf.set(zKey, pz);

      const isEdge = Math.abs(h) > halfH - 0.55;
      let I = (0.44 + 0.36 * diff + 0.52 * spec + 0.34 * chaseSheen) * depthFade;
      if (isEdge) I -= 0.24;

      let col;
      if ((spec > 0.82 || chaseSheen > 0.82) && !isEdge && pz >= -1) col = WHITE;
      else if (I > 0.86) col = G[6];
      else if (I > 0.68) col = G[5];
      else if (I > 0.48) col = G[4];
      else if (I > 0.32) col = G[3];
      else if (I > 0.18) col = G[2];
      else col = G[1];

      p.px(px, py, col);
    }

    // Crisp 1px dark-bronze groove/shadow separating concentric rings & shading underside
    if (nrz > -0.35 && (diff < 0.18 || ring.saucerMode > 0.4)) {
      const ox = Math.round(cx + (halfH + 0.72) * N[0] + (ring.saucerMode > 0.4 ? 0 : 0.35));
      const oy = Math.round(cy + (halfH + 0.72) * N[1] + 0.55);
      const oKey = (oy + 256) * 1024 + (ox + 256);
      if (!zBuf.has(oKey)) {
        zBuf.set(oKey, zCenter - 4);
        p.px(ox, oy, G[0]);
      }
    }
  }

  // Carved Celestial Runes (`刻满符文`) + Cardinal Clasps + Rotating Metallic Specular Sparkles!
  for (let k = 0; k < nRunes; k++) {
    const th = ring.spin + (k * TAU) / nRunes;
    const ct = Math.cos(th), st = Math.sin(th);
    const nrx = ct * U[0] + st * V[0];
    const nry = ct * U[1] + st * V[1];
    const nrz = ct * U[2] + st * V[2];
    const zCenter = R * nrz;
    if (half < 0 && zCenter >= 0) continue;
    if (half > 0 && zCenter < 0) continue;

    const cx = ring.cx + R * nrx;
    const cy = ring.cy + R * nry;
    const tx = -st * U[0] + ct * V[0];
    const ty = -st * U[1] + ct * V[1];

    const specDot = Math.max(0, nrx * HX + nry * HY + nrz * HZ);
    const chaseGap = Math.abs(Math.atan2(Math.sin(th - sheenAng), Math.cos(th - sheenAng)));
    const sheenHit = chaseGap < 0.35;
    const isCardinal = k % Math.max(2, Math.floor(nRunes / 4)) === 0;

    if (isCardinal && nrz > -0.2) {
      const studCol = sheenHit || specDot > 0.75 ? WHITE : ring.runeHot > 0.65 ? S[5] : G[6];
      p.px(Math.round(cx + N[0] * 1.6), Math.round(cy + N[1] * 1.6), studCol);
      p.px(Math.round(cx - N[0] * 1.6), Math.round(cy - N[1] * 1.6), G[3]);
    }

    // Crisp luminous celestial runes carved into the front-facing golden band!
    if (nrz > 0.06 && ring.saucerMode < 0.75) {
      const glyphPts = RING_GLYPHS[(k + ringIdx) % RING_GLYPHS.length];
      const hotWave = 0.5 + 0.5 * Math.sin(t * 5.0 - k * 1.2 + ringIdx);
      const litRune = ring.crackK === 0 && (sheenHit || hotWave > 0.38);
      const runeCol =
        ring.crackK > 0
          ? G[0]
          : sheenHit
          ? WHITE
          : ring.runeHot > 0.74
          ? (hotWave > 0.5 ? WHITE : S[5])
          : litRune
          ? E[4]
          : G[1];

      for (let gp = 0; gp < glyphPts.length; gp++) {
        if (!litRune && gp > 2) continue;
        const [du, dv] = glyphPts[gp];
        const rxp = Math.round(cx + tx * du * 0.9 + N[0] * dv * 0.8);
        const ryp = Math.round(cy + ty * du * 0.9 + N[1] * dv * 0.8);
        p.px(rxp, ryp, runeCol);
      }
      if (litRune && ring.runeHot > 0.3 && k % 2 === 0) {
        p.glow(cx, cy, 4.5, ring.runeHot > 0.74 ? S[4] : E[4], 0.20 * ring.runeHot);
      }
    }

    // Rotating Metallic Specular Glint (`圆环旋转的金属高光细节特效`)!
    if (half >= 0 && nrz > 0.22 && ring.crackK === 0 && ring.saucerMode < 0.65) {
      if (chaseGap < 0.16 || specDot > 0.955) {
        const glintK = chaseGap < 0.16 ? 1 - chaseGap / 0.16 : (specDot - 0.955) / 0.045;
        sparkle(p, cx, cy, 1.5 + 2.0 * glintK, WHITE, G[5], 0.52 * glintK);
        p.glow(cx, cy, 6, G[5], 0.24 * glintK);
      }
    }
  }

  // Sequential fracture sparks & dark cracks at the 5 break-joints right before KO shatter!
  if (half >= 0 && ring.crackK > 0.12) {
    for (let b = 0; b < 5; b++) {
      const th = ring.spin + (b * TAU) / 5 + 0.25 + ringIdx * 0.2;
      const ct = Math.cos(th), st = Math.sin(th);
      const nrx = ct * U[0] + st * V[0];
      const nry = ct * U[1] + st * V[1];
      const nrz = ct * U[2] + st * V[2];
      if (nrz < -0.2 && half > 0) continue;
      const jx = ring.cx + R * nrx;
      const jy = ring.cy + R * nry;
      p.px(Math.round(jx), Math.round(jy), ring.crackK > 0.65 ? WHITE : G[0]);
      if (ring.crackK > 0.55 && ring.crackK < 0.95) {
        sparkle(p, jx, jy, 2.4 * ring.crackK, WHITE, G[4], 0.55 * ring.crackK);
      }
    }
  }
}

// Render the central faceted Sapphire Cyclops Eye (or Petrified Stone Eye in Stage 4!)
function drawSapphireEye(g, p, ex, ey, st, E, G, S, ST, eyeCracks, seed, t, dissolve = 0) {
  g.clear();
  const R = R_EYE;
  const { lookX, lookY, lid, pupilSlit, solarMix, stoneLv } = st;

  const fx = clamp(1 - 0.22 * (Math.abs(lookX) / R) * 2.2, 0.58, 1);
  const fy = clamp(1 - 0.22 * (Math.abs(lookY) / R) * 2.2, 0.58, 1);
  const ir = 6.3;

  const upEdge = lerp(-R + 2.2, -1.3, lid);
  const dnEdge = lerp(R - 2.2, 1.5, lid);

  g.shade(-R - 2, -R - 2, R + 2, R + 2, (x, y) => {
    const d = Math.hypot(x, y);
    if (d > R) return 0;

    const mottle = 0.09 * tileFbm(x * 0.35, y * 0.35, 0, 0, seed + 5, 2);

    // Top-down stone crumble dissolution at the very end (`7.00..7.46s`) — no flat 50% grid!
    if (dissolve > 0) {
      const topFirst = (y + R) / (2 * R);
      const thresh = dissolve * 1.35 - topFirst * 0.35 + mottle * 1.4;
      if (thresh > bayer(x + ex, y + ey)) return 0;
    }

    const upNorm = (R - y) / (2 * R);
    const radialNorm = 1 - d / R;
    const petrifyEdge = stoneLv - (0.55 * upNorm + 0.45 * radialNorm) + mottle;

    if (petrifyEdge > 0) {
      if (petrifyEdge < 0.09 && stoneLv < 1.15) {
        return rand(Math.round(x), Math.round(y), (t * 24) | 0) < 0.55 ? ST[6] : ST[5];
      }
      const sLit = (-x * 0.58 - y * 0.68 + Math.sqrt(Math.max(0, R * R - d * d)) * 0.45) / R;
      const quant = Math.round(sLit * 3.2 + mottle * 3);
      if (d > R - 1.05) return ST[0];
      return ST[clamp(2 + quant, 1, 5)];
    }

    // Subtle golden celestial pole-caps & sapphire-filigree eyelids
    const lidCurveU = upEdge + 1.35 * (x / R) ** 2;
    const lidCurveD = dnEdge - 1.2 * (x / R) ** 2;
    if (y < lidCurveU || y > lidCurveD) {
      if (d > R - 0.85) return G[1];
      const goldTrim = Math.abs(y - lidCurveU) < 0.95 || Math.abs(y - lidCurveD) < 0.95;
      if (goldTrim) return x < 0 ? G[5] : G[3];
      return lid > 0.12 ? ((-x * 0.5 - y * 0.6) / R > 0.15 ? E[2] : E[1]) : (x < 0 ? G[4] : G[2]);
    }

    const nz = Math.sqrt(Math.max(0, 1 - (d * d) / (R * R)));
    const qnx = Math.round((x / R) * 3) / 3;
    const qny = Math.round((y / R) * 3) / 3;
    const gemLit = -qnx * 0.55 - qny * 0.65 + nz * 0.52;

    const ix = (x - lookX) / (ir * fx);
    const iy = (y - lookY) / (ir * fy);
    const id = Math.hypot(ix, iy);

    if (id <= 1.0 && d <= R - 0.7) {
      const pWidth = lerp(2.2, 0.95, pupilSlit) * fx;
      const pHeight = lerp(3.5, 4.9, pupilSlit) * fy;
      const pd = Math.abs(x - lookX) / pWidth + Math.abs(y - lookY) / pHeight;

      if (pd < 0.88) {
        if (solarMix > 0.42) return pd < 0.54 ? WHITE : S[5];
        return pd < 0.24 ? E[5] : E[0];
      }
      if (pd < 1.20) {
        return solarMix > 0.35 ? WHITE : E[5];
      }
      if (id > 0.86) {
        return solarMix > 0.5 ? S[2] : E[1];
      }
      const ang = Math.atan2(iy, ix);
      const rayFacet = Math.sin(ang * 8 + t * 2.2) > 0.25;
      if (solarMix > 0.25) {
        const cSap = id < 0.52 ? E[5] : rayFacet ? E[4] : E[3];
        const cSol = id < 0.52 ? S[5] : rayFacet ? S[4] : S[3];
        return solarMix > 0.65 ? cSol : mix(cSap, cSol, solarMix);
      }
      return id < 0.50 ? (rayFacet ? E[5] : E[4]) : id < 0.72 ? (rayFacet ? E[4] : E[3]) : E[2];
    }

    if (d > R - 0.95) return E[0];
    if (gemLit > 0.68) return E[4];
    if (gemLit > 0.42) return E[3];
    if (gemLit > 0.16) return E[2];
    return E[1];
  });

  if (lid < 0.50 && stoneLv < 0.72 && dissolve === 0) {
    g.set(-4, -5, WHITE);
    g.set(-3, -5, WHITE);
    g.set(-4, -4, E[5]);
    g.set(2, -3, WHITE);
  }

  if (stoneLv > 0.62 && dissolve < 0.65) {
    const cGrow = clamp((stoneLv - 0.62) / 0.42);
    for (const cPts of eyeCracks) {
      const n = Math.max(1, Math.round((cPts.length - 1) * cGrow));
      for (let i = 0; i < n; i++) {
        g.line(cPts[i][0], cPts[i][1], cPts[i + 1][0], cPts[i + 1][1], ST[0]);
      }
    }
  }

  if (dissolve < 0.45) {
    g.outline(stoneLv > 0.85 ? ST[0] : E[0]);
  }
  g.draw(p, 1, Math.round(ex), Math.round(ey));

  const glowAlive = clamp(1 - stoneLv * 1.18) * (1 - lid * 0.45) * clamp(1 - dissolve * 2);
  if (glowAlive > 0.02) {
    const coreCol = solarMix > 0.4 ? S[4] : E[4];
    const auraCol = solarMix > 0.4 ? S[3] : E[2];
    const saucerDamp = 1 - 0.35 * (st.saucerK || 0);
    p.glow(ex + lookX, ey + lookY, (12 + 7 * solarMix) * saucerDamp, coreCol, (0.44 + 0.34 * solarMix) * glowAlive);
    p.glow(ex + lookX, ey + lookY, 4.5, WHITE, (0.28 + 0.34 * solarMix) * glowAlive * saucerDamp);
    p.glow(ex, ey, 30, auraCol, 0.20 * glowAlive);
  }
}

// Draw a 1px ring perpendicular to the tilted beam axis `(ux, uy)` in 3D perspective!
function beamHoop(p, cx, cy, ux, uy, r, sy, c, a = 1) {
  if (r < 0.5 || a <= 0.02) return;
  const nx = -uy, ny = ux;
  const steps = Math.max(24, Math.ceil(r * TAU * 1.4));
  for (let i = 0; i < steps; i++) {
    const g = (i / steps) * TAU;
    const cg = Math.cos(g), sg = Math.sin(g);
    const x = cx + nx * (cg * r) + ux * (sg * r * sy);
    const y = cy + ny * (cg * r) + uy * (sg * r * sy);
    p.dot(x, y, c, a);
  }
}

export function create(o) {
  const G = fit(o.palette, 8);
  const E = fit(o.sapphire, 7);
  const S = fit(o.solar, 7);
  const ST = fit(o.stone, 7);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, G[6], G[4], S[2]],
    haze: G[4],
  });
  const lights = new Lights();
  const eyeGrid = new Grid(-15, -15, 30, 30);
  const zBuf = new Map();

  const eyeCracks = Array.from({ length: 5 }, (_, i) => {
    let a = (i / 5) * TAU + R.range(-0.28, 0.28);
    let x = R.range(-1.2, 1.2), y = R.range(-1.2, 1.2);
    const pts = [[x, y]];
    for (let s = 0; s < 5; s++) {
      a += R.range(-0.52, 0.52);
      x += Math.cos(a) * R.range(1.6, 2.3);
      y += Math.sin(a) * R.range(1.6, 2.3);
      if (Math.hypot(x, y) > R_EYE - 1.1) break;
      pts.push([x, y]);
    }
    return pts;
  });

  // Branching molten floor fissures around laser hit spot (X_HIT, 0) — kept strictly inside right canvas edge (`<= 136`)!
  const hitCracks = Array.from({ length: 8 }, (_, i) => {
    const a = 0.06 + (i / 7) * (Math.PI - 0.12) + R.range(-0.12, 0.12);
    const maxR = Math.cos(a) > 0.3 ? 32 : 38;
    const L = R.range(20, maxR) * (Math.abs(Math.sin(a)) > 0.72 ? 0.68 : 1);
    const pts = bolt(R, 0, 0, Math.cos(a) * L, Math.sin(a) * L, { jag: 0.26, depth: 4 }).map(([x, z]) => [
      X_HIT + x,
      z * 0.34,
    ]);
    return { pts, L };
  });
  const hitSpikes = spikes(R, 14, 15, 30);

  const trailPts = [];
  const dashRings = [];
  const brokenArcs = [];
  const clinkRings = [];
  const stoneOrb = {
    active: false,
    x: -18,
    y: -31,
    vx: 10,
    vy: 18,
    rot: 0,
    bounces: 0,
    settled: false,
  };

  let t = 0;
  let snappedSaucer = false;
  let launchedDash = false;
  let lockedScope = false;
  let firedLaser = false;
  let hitGround = false;
  let shattered = false;
  let mistAcc = 0;
  let chargeAcc = 0;
  let beamSparkAcc = 0;

  return {
    update(dt) {
      t += dt;
      const st = t < T_SHATTER ? stateAt(t) : null;

      // 1. IDLE: Celestial starlight motes & rune twinkles
      if (t < T_MOVE && st) {
        if (R.chance(6.5 * dt)) {
          const a = R.range(0, TAU), rr = R.range(14, 26);
          ps.spawn(
            P.STAR,
            st.ex + Math.cos(a) * rr,
            st.ey + Math.sin(a) * rr * 0.85,
            R.range(-4, 4),
            -R.range(5, 14),
            R.range(0.32, 0.62),
            R.chance(0.45) ? WHITE : G[5],
            R.range(0.8, 1.7)
          );
        }
      }

      // 2. MOVE: Crisp saucer-snap flash + sonic launch rings + golden stardust stream trailing strictly behind the saucer rim!
      if (!snappedSaucer && t >= T_MOVE + 0.05) {
        snappedSaucer = true;
        lights.add(X_IDLE, -40, 42, G[5], 0.62, 0.22);
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU;
          ps.spawn(
            P.SPARK,
            X_IDLE + Math.cos(a) * 18,
            -40 + Math.sin(a) * 5,
            Math.cos(a) * R.range(35, 82),
            Math.sin(a) * R.range(10, 24),
            R.range(0.16, 0.30)
          );
        }
      }
      if (!launchedDash && t >= T_SAUCER + 0.02) {
        launchedDash = true;
        dashRings.push({ x: X_IDLE - 2, y: -40, age: 0, max: 0.36 });
      }
      if (t >= T_SAUCER + 0.14 && t < T_SAUCER + 0.17 && dashRings.length === 1) {
        dashRings.push({ x: st.ex - 10, y: st.ey, age: 0, max: 0.32 });
      }

      if (t >= T_SAUCER && t < T_BRAKE + 0.06 && st) {
        if (st.saucerK > 0.18) {
          trailPts.push({ x: st.ex - 20, y: st.ey + 0.5, r: st.rings[2].r, age: 0, max: 0.52 });
        }
        mistAcc += dt * (46 + 90 * st.saucerK);
        while (mistAcc >= 1) {
          mistAcc -= 1;
          const offY = R.range(-5.8, 5.8);
          const offX = R.range(-27, -19);
          if (R.chance(0.58)) {
            ps.spawn(
              P.STAR,
              st.ex + offX,
              st.ey + offY,
              -R.range(34, 96),
              R.range(-9, 9),
              R.range(0.32, 0.60),
              R.chance(0.38) ? WHITE : R.chance(0.68) ? G[5] : E[4],
              R.range(1.0, 2.2)
            );
          } else {
            ps.spawn(
              P.MOTE,
              st.ex + offX,
              st.ey + offY,
              -R.range(54, 126),
              R.range(-10, 10),
              R.range(0.26, 0.46),
              R.chance(0.55) ? G[5] : G[4],
              R.range(0.8, 1.5)
            );
          }
        }
      }
      for (let i = trailPts.length - 1; i >= 0; i--) {
        trailPts[i].age += dt;
        if (trailPts[i].age >= trailPts[i].max) trailPts.splice(i, 1);
      }
      for (let i = dashRings.length - 1; i >= 0; i--) {
        dashRings[i].age += dt;
        if (dashRings[i].age >= dashRings[i].max) dashRings.splice(i, 1);
      }

      // 3. ATTACK: Crosshair lock flash + eye solar charge + searing laser impact!
      if (!lockedScope && t >= T_LOCK - 0.02) {
        lockedScope = true;
        lights.add(X_SCOPE, Y_SCOPE, 46, G[5], 0.80, 0.26);
        for (let i = 0; i < 16; i++) {
          const a = (i / 4) * (Math.PI / 2) + AIM_ANG + R.range(-0.14, 0.14);
          const sp = R.range(48, 115);
          ps.spawn(P.SPARK, X_SCOPE, Y_SCOPE, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.18, 0.34));
        }
      }

      if (t >= T_LOCK && t < T_FIRE && st) {
        chargeAcc += dt * 78;
        while (chargeAcc >= 1) {
          chargeAcc -= 1;
          const a = R.range(0, TAU), dist = R.range(18, 34);
          const sx = st.ex + Math.cos(a) * dist;
          const sy = st.ey + Math.sin(a) * dist;
          ps.spawn(
            P.STREAK,
            sx,
            sy,
            (st.ex - sx) * 5.0,
            (st.ey - sy) * 5.0,
            R.range(0.14, 0.24),
            R.chance(0.55) ? S[5] : E[4],
            1
          );
        }
      }

      if (!firedLaser && t >= T_FIRE) {
        firedLaser = true;
        lights.add(X_ATK, Y_ATK, 54, S[4], 0.90, 0.36);
        lights.add(X_SCOPE, Y_SCOPE, 58, WHITE, 0.88, 0.22);
      }

      if (!hitGround && t >= T_HIT) {
        hitGround = true;
        lights.add(X_HIT - 4, -6, 48, S[4], 0.95, 0.65);
        lights.add(X_HIT, -2, 30, WHITE, 0.90, 0.18);

        for (let i = 0; i < 46; i++) {
          const a = -Math.PI / 2 + R.range(-1.32, 0.92);
          const sp = R.range(75, 215);
          ps.spawn(
            P.SPARK,
            X_HIT + R.range(-3, 3),
            -2,
            clamp(Math.cos(a) * sp, -185, 110),
            Math.sin(a) * sp,
            R.range(0.24, 0.66)
          );
        }
        // Arcing molten solar slag chunks (`P.BRAND`) splashing out of the burn spot!
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + R.range(-1.15, 0.72);
          const sp = R.range(58, 125);
          ps.spawn(
            P.BRAND,
            X_HIT + R.range(-2, 2),
            -2,
            clamp(Math.cos(a) * sp, -120, 80),
            Math.sin(a) * sp,
            R.range(0.35, 0.62)
          );
        }
        for (let i = 0; i < 8; i++) {
          const side = i % 2 ? 1 : -1;
          ps.spawn(
            P.SMOKE,
            X_HIT + side * R.range(2, 7),
            -R.range(1, 4),
            clamp(side * R.range(24, 62), -75, 52),
            -R.range(8, 24),
            R.range(0.75, 1.25),
            mix(hex("#3a2824"), S[3], 0.25),
            R.range(3.2, 5.0),
            R.range(0, 0.08),
            PF.BIG
          );
        }
      }

      if (t >= T_HIT && t < T_BEAM_END) {
        beamSparkAcc += dt * 98;
        while (beamSparkAcc >= 1) {
          beamSparkAcc -= 1;
          const a = -Math.PI / 2 + R.range(-1.35, 0.78);
          const sp = R.range(55, 170);
          ps.spawn(
            P.SPARK,
            X_HIT + R.range(-3.5, 3.5),
            -1.5,
            clamp(Math.cos(a) * sp, -165, 95),
            Math.sin(a) * sp,
            R.range(0.18, 0.46)
          );
          if (R.chance(0.24)) {
            ps.spawn(
              P.SMOKE,
              X_HIT + R.range(-5, 4),
              -3,
              R.range(-14, 10),
              -R.range(18, 42),
              R.range(0.7, 1.15),
              mix(hex("#342420"), S[3], 0.2),
              R.range(2.8, 4.5)
            );
          }
        }
      }
      if (t >= T_HIT && t < T_KO + 0.55 && R.chance(15 * dt)) {
        const cr = R.pick(hitCracks);
        const q = R.pick(cr.pts);
        ps.spawn(P.EMBER, q[0], q[1] - 1, R.range(-10, 8), -R.range(14, 34), R.range(0.45, 0.85), S[4]);
      }

      // 4. KO: Petrification grit -> 3 Golden Rings snap into 15 heavy curved segments, lose buoyancy & drop down!
      if (t >= T_KO && t < T_SHATTER && st && R.chance(26 * dt)) {
        const a = R.range(0, TAU);
        ps.spawn(
          P.GRIT,
          st.ex + Math.cos(a) * R.range(4, 10),
          st.ey + Math.sin(a) * R.range(4, 10),
          Math.cos(a) * R.range(18, 48),
          -R.range(15, 45),
          R.range(0.45, 0.85),
          R.pick([ST[3], ST[4], ST[5]]),
          1
        );
      }

      if (!shattered && t >= T_SHATTER) {
        shattered = true;
        const snapSt = stateAt(T_SHATTER - 0.001);
        stoneOrb.active = true;
        stoneOrb.x = snapSt.ex;
        stoneOrb.y = snapSt.ey;
        stoneOrb.vx = 10;
        stoneOrb.vy = 20;

        lights.add(snapSt.ex, snapSt.ey, 38, G[5], 0.55, 0.20);

        // Fracture each of the 3 rings into 5 heavy curved arc-segments (`寸寸断裂，失去浮力` — purely downward drop, zero upward burst!)
        for (let m = 0; m < 3; m++) {
          const rg = snapSt.rings[m];
          const { U, V } = basisFromEuler(rg.rx, rg.ry, rg.rz);
          const nSegs = 5;
          for (let segIdx = 0; segIdx < nSegs; segIdx++) {
            const a0 = rg.spin + (segIdx * TAU) / nSegs + 0.25 + m * 0.2;
            const span = TAU / nSegs - 0.14;
            const midA = a0 + span * 0.5;
            const cm = Math.cos(midA), sm = Math.sin(midA);
            const dx = rg.r * (cm * U[0] + sm * V[0]);
            const dy = rg.r * (cm * U[1] + sm * V[1]);

            brokenArcs.push({
              x: rg.cx + dx,
              y: rg.cy + dy * 0.72,
              vx: clamp(dx * 1.85 + R.range(-20, 20), -70, 70),
              vy: R.range(18, 48),
              delay: m * 0.045 + segIdx * 0.012,
              rot: Math.atan2(dy, dx),
              vrot: R.sign() * R.range(3.2, 7.2),
              tilt: R.range(0.50, 0.88),
              vtilt: R.range(-4, 4),
              r: rg.r * 0.66,
              w: rg.w,
              span: 1.08,
              floorY: R.range(-2.5, 5.4),
              bounce: R.range(0.46, 0.58),
              bounces: 0,
              settled: false,
              seed: m * 10 + segIdx,
            });

            for (let spk = 0; spk < 2; spk++) {
              ps.spawn(
                P.SPARK,
                rg.cx + dx,
                rg.cy + dy * 0.72,
                R.range(-42, 42),
                R.range(-18, 36),
                R.range(0.16, 0.30)
              );
            }
          }
        }
      }

      if (stoneOrb.active && !stoneOrb.settled) {
        stoneOrb.vy += 640 * dt;
        stoneOrb.x += stoneOrb.vx * dt;
        stoneOrb.y += stoneOrb.vy * dt;
        stoneOrb.rot += stoneOrb.vx * 0.06 * dt;
        const groundY = -R_EYE + 1.5;
        if (stoneOrb.y >= groundY) {
          stoneOrb.y = groundY;
          if (Math.abs(stoneOrb.vy) > 32 && stoneOrb.bounces < 3) {
            stoneOrb.bounces++;
            const imp = Math.min(1, Math.abs(stoneOrb.vy) / 180);
            stoneOrb.vy = -stoneOrb.vy * 0.26;
            stoneOrb.vx *= 0.60;
            for (let i = 0; i < Math.round(7 * imp) + 2; i++) {
              const side = i % 2 ? 1 : -1;
              ps.spawn(
                P.DUST,
                stoneOrb.x + side * R.range(2, 7),
                -1,
                side * R.range(18, 48) * imp,
                -R.range(3, 12),
                R.range(0.4, 0.72),
                ST[3],
                R.range(1.8, 3.2)
              );
            }
            for (let i = 0; i < Math.round(6 * imp); i++) {
              ps.spawn(
                P.GRIT,
                stoneOrb.x + R.range(-5, 5),
                -1,
                R.range(-45, 45),
                -R.range(30, 85) * imp,
                R.range(0.45, 0.85),
                R.pick([ST[3], ST[4]]),
                1
              );
            }
          } else {
            stoneOrb.vy = 0;
            stoneOrb.vx *= Math.max(0, 1 - 8 * dt);
            if (Math.abs(stoneOrb.vx) < 1) stoneOrb.settled = true;
          }
        }
      }

      for (const segArc of brokenArcs) {
        if (segArc.delay > 0) {
          segArc.delay -= dt;
          continue;
        }
        if (!segArc.settled) {
          segArc.vy += 600 * dt;
          segArc.x = clamp(segArc.x + segArc.vx * dt, -104, 88);
          segArc.y += segArc.vy * dt;
          segArc.rot += segArc.vrot * dt;
          segArc.tilt = clamp(segArc.tilt + segArc.vtilt * dt * 0.25, 0.30, 1.05);

          if (segArc.y >= segArc.floorY) {
            segArc.y = segArc.floorY;
            if (Math.abs(segArc.vy) > 22 && segArc.bounces < 3) {
              segArc.bounces++;
              const imp = clamp(Math.abs(segArc.vy) / 170, 0.25, 1);
              segArc.vy = -segArc.vy * segArc.bounce;
              segArc.vx *= 0.68;
              segArc.vrot *= 0.60;
              segArc.tilt = lerp(segArc.tilt, 0.34, 0.58);

              // "叮当!" Metallic clink acoustic ripple + bright golden bounce sparks!
              clinkRings.push({ x: segArc.x, y: segArc.y, age: 0, max: 0.20, amp: imp });
              lights.add(segArc.x, segArc.y - 1, 15 * imp, G[5], 0.45 * imp, 0.12);
              for (let s = 0; s < (segArc.bounces === 1 ? 3 : 2); s++) {
                ps.spawn(
                  P.SPARK,
                  segArc.x,
                  segArc.y - 1,
                  R.range(-52, 52) * imp,
                  -R.range(26, 74) * imp,
                  R.range(0.14, 0.28)
                );
              }
            } else {
              segArc.vy = 0;
              segArc.vx = 0;
              segArc.vrot = 0;
              segArc.tilt = 0.32;
              segArc.settled = true;
            }
          }
        }
      }

      if (t > 7.02 && t < 7.34 && R.chance(14 * dt)) {
        ps.spawn(
          P.DUST,
          stoneOrb.x + R.range(-8, 8),
          stoneOrb.y + R.range(-4, 6),
          R.range(-12, 12),
          -R.range(4, 14),
          R.range(0.22, 0.38),
          ST[3],
          R.range(1.4, 2.4)
        );
      }

      for (let i = clinkRings.length - 1; i >= 0; i--) {
        clinkRings[i].age += dt;
        if (clinkRings[i].age >= clinkRings[i].max) clinkRings.splice(i, 1);
      }

      ps.update(dt);
      lights.update(dt);
    },

    drawBack(p) {
      const dissolve = t > 7.00 ? clamp((t - 7.00) / 0.46) : 0;
      if (dissolve >= 1 && t > 7.46) return;

      // 1. Ground shadow & celestial astrolabe floor seal with cardinal rune ticks
      if (t < T_SHATTER) {
        const st = stateAt(t);
        const hRatio = clamp(1 + st.ey / 75, 0.35, 1);
        shadow(p, st.ex, 0, Math.round(14 * hRatio), 2, hex("#090814"), 0.52);

        const sealAlive = clamp(1 - st.stoneLv * 1.45);
        if (sealAlive > 0.04) {
          oval(p, st.ex, 0, 17, 4.2, G[3], 0.36 * sealAlive, (g) => Math.sin(g) < 0);
          p.px(Math.round(st.ex - 17), 0, G[5], 0.45 * sealAlive);
          p.px(Math.round(st.ex + 17), 0, G[5], 0.45 * sealAlive);
          p.glow(st.ex, 0, 20, st.solarMix > 0.4 ? S[3] : E[2], 0.15 * sealAlive);
        }
      } else if (stoneOrb.active && dissolve < 0.98) {
        shadow(p, stoneOrb.x, 1, Math.round(10 * (1 - dissolve * 0.7)), 2, hex("#090814"), 0.55 * (1 - dissolve));
      }

      // 2. Searing Laser Burn Spot (`激光命中的灼烧光斑`) — dark charred crater, molten magma pool, fissures & shockwaves!
      if (t >= T_HIT) {
        const dtH = t - T_HIT;
        const activeHeat = t < T_BEAM_END ? 1 : clamp(1 - (t - T_BEAM_END) / 2.20);
        const sootFade = t < 6.40 ? 1 : clamp(1 - (t - 6.40) / 0.96);

        if (sootFade > 0.01) {
          scorch(p, X_HIT, 0, 24, activeHeat, sootFade, 7.2);
        }

        if (activeHeat > 0.01) {
          const grow = ease.outCubic(clamp(dtH / 0.14));
          for (const cr of hitCracks) {
            const n = Math.max(1, Math.round((cr.pts.length - 1) * grow));
            for (let i = 0; i < n; i++) {
              const [x0, y0] = cr.pts[i];
              const [x1, y1] = cr.pts[i + 1];
              const distRatio = i / Math.max(1, cr.pts.length - 1);
              const h = clamp(activeHeat * (1.12 - distRatio * 0.48));
              if (h <= 0.02) continue;
              const col = h > 0.82 ? WHITE : h > 0.62 ? S[5] : h > 0.42 ? S[4] : h > 0.22 ? S[3] : S[1];
              p.line(x0, y0, x1, y1, col, Math.min(1, h * 3));
              if (i % 2 === 0 && h > 0.25) p.glow(x0, y0, 7, S[3], 0.28 * h);
            }
          }
          const rMolten = 9.2 * (0.65 + 0.35 * activeHeat);
          p.ellipse(X_HIT, 0, rMolten * 1.4, rMolten * 0.42, activeHeat > 0.4 ? S[2] : S[0], Math.min(1, activeHeat * 2.5));
          p.ellipse(X_HIT, 0, rMolten * 1.0, rMolten * 0.30, activeHeat > 0.5 ? S[4] : S[2], Math.min(1, activeHeat * 2.3));
          p.ellipse(X_HIT, 0, rMolten * 0.65, rMolten * 0.20, activeHeat > 0.55 ? S[5] : S[3], Math.min(1, activeHeat * 2.1));
          if (activeHeat > 0.32) {
            p.ellipse(X_HIT, 0, rMolten * 0.38, rMolten * 0.13, WHITE, clamp((activeHeat - 0.32) * 2.2));
          }
          p.glow(X_HIT, 0, 24, S[3], 0.46 * activeHeat);
        }

        for (let k = 0; k < 3; k++) {
          const rk = (dtH - k * 0.22) / 0.44;
          if (rk > 0 && rk < 1) {
            band(
              p,
              X_HIT,
              0,
              6 + 36 * ease.outCubic(rk),
              0.30,
              3.2 * (1 - rk * 0.65),
              (1 - rk) * 0.9,
              [S[1], S[3], S[5], WHITE],
              (ang) => Math.sin(ang) < 0,
              rk < 0.18
            );
          }
        }
      }

      // 3. Luminous Golden Stardust Stream & Saucer Wake (`拉出金色星尘流光`) strictly behind the flying saucer!
      for (const dr of dashRings) {
        const u = dr.age / dr.max;
        const ry = 8 + 16 * ease.outCubic(u);
        oval(p, dr.x, dr.y, ry * 0.38, ry, u < 0.3 ? WHITE : G[5], (1 - u) * 0.85);
      }
      if (t >= T_SAUCER && t < T_BRAKE) {
        const stM = stateAt(t);
        if (stM.saucerK > 0.35) {
          for (let gIdx = 1; gIdx <= 2; gIdx++) {
            const gx = stM.ex - gIdx * 12 * stM.saucerK;
            const gy = stM.ey + gIdx * 0.4;
            oval(p, gx, gy, 22 - gIdx * 3, 4.8 - gIdx * 0.7, gIdx === 1 ? G[5] : G[3], (0.42 - gIdx * 0.14) * stM.saucerK);
          }
        }
      }
      if (trailPts.length > 1) {
        for (let i = 1; i < trailPts.length; i++) {
          const a = trailPts[i - 1], b = trailPts[i];
          if (Math.hypot(b.x - a.x, b.y - a.y) < 0.35) continue;
          const k = 1 - b.age / b.max;
          if (k <= 0.04) continue;
          const w = 4.5 * Math.pow(k, 0.7);
          p.beam(a.x, a.y, b.x, b.y, w * 0.8, k > 0.65 ? G[4] : G[2], k * 0.34);
          const col = k > 0.72 ? WHITE : k > 0.45 ? G[5] : G[4];
          p.line(a.x, a.y - w, b.x, b.y - w, col, k * 0.90);
          p.line(a.x, a.y + w, b.x, b.y + w, col, k * 0.90);
          p.line(a.x - 2, a.y, b.x - 2, b.y, k > 0.55 ? E[5] : E[4], k * 0.84);
          if (i % 2 === 0) p.glow(b.x, b.y, 8 * k + 2, G[4], 0.20 * k);
        }
      }

      // 4. Far halves (`z < 0`) of the 3 rotating golden rune-rings
      if (t < T_SHATTER) {
        const st = stateAt(t);
        zBuf.clear();
        for (let i = 2; i >= 0; i--) {
          drawAstrolabeRing(p, st.rings[i], G, E, S, t, -1, zBuf, i);
        }
      }

      ps.draw(p, "back");
    },

    draw(p) {
      const dissolve = t > 7.00 ? clamp((t - 7.00) / 0.46) : 0;

      if (t < T_SHATTER) {
        const st = stateAt(t);

        const sealAlive = clamp(1 - st.stoneLv * 1.45);
        if (sealAlive > 0.04) {
          oval(p, st.ex, 0, 17, 4.2, G[4], 0.42 * sealAlive, (g) => Math.sin(g) >= 0);
          p.px(Math.round(st.ex), 4, G[5], 0.45 * sealAlive);
        }

        // 1. Central Faceted Sapphire Cyclops Eye (`发光的蓝宝石独眼`)
        drawSapphireEye(eyeGrid, p, st.ex, st.ey, st, E, G, S, ST, eyeCracks, o.seed, t, 0);

        // 2. Contracting Solar Charge Ring & Laser-Sight Guide Line (`独眼充能` `3.56s..3.98s`)
        if (t >= T_LOCK - 0.10 && t < T_FIRE) {
          const u = seg(t, T_LOCK - 0.10, T_FIRE);
          const pulse = 0.6 + 0.4 * Math.sin(t * 60);
          p.line(st.ex + st.lookX, st.ey + st.lookY, X_HIT, 0, u > 0.65 ? S[5] : S[3], 0.60 * u * pulse);
          const cr = lerp(16, 3.5, ease.inCubic(u));
          oval(p, st.ex + st.lookX, st.ey + st.lookY, cr * 0.72, cr, u > 0.7 ? WHITE : S[5], 0.85 * u);
          oval(p, X_HIT, 0, lerp(18, 6, ease.inOutCubic(u)), lerp(5.5, 2.0, ease.inOutCubic(u)), S[4], 0.78 * u);
          sparkle(p, X_HIT, -1, 3 + 4.5 * u, WHITE, S[4], 0.75 * u);
        }

        // 3. Front crossbars (`Ring 0 & Ring 1`) before beam + outer scope Ring 2 after beam so the laser truly threads THROUGH the front scope!
        zBuf.clear();
        for (let i = 0; i < 2; i++) {
          drawAstrolabeRing(p, st.rings[i], G, E, S, t, 1, zBuf, i);
        }
        if (!(t >= T_FIRE && t < T_BEAM_END)) {
          drawAstrolabeRing(p, st.rings[2], G, E, S, t, 1, zBuf, 2);
        }

        // 4. Ornate Crosshair Astrolabe Scope (`重叠锁死成十字瞄准镜`) inner concentric rings & cardinal sight notches!
        if (t >= T_LOCK - 0.08 && t < T_KO) {
          const post = t >= T_BEAM_END ? seg(t, T_BEAM_END, T_KO) : 0;
          const kLock = clamp((t - (T_LOCK - 0.08)) / 0.12) * (1 - post);
          if (kLock > 0.05) {
            const scx = st.rings[2].cx, scy = st.rings[2].cy;
            beamHoop(p, scx, scy, AIM_UX, AIM_UY, 9.5, 0.64, G[5], 0.85 * kLock);
            beamHoop(p, scx, scy, AIM_UX, AIM_UY, 4.2, 0.64, kLock > 0.7 ? WHITE : G[6], 0.92 * kLock);
            for (const sgn of [-1, 1]) {
              const pxV = scx - AIM_UY * sgn * 13, pyV = scy + AIM_UX * sgn * 13;
              p.line(pxV - AIM_UX * 2.2, pyV - AIM_UY * 2.2, pxV + AIM_UX * 2.2, pyV + AIM_UY * 2.2, G[6], 0.88 * kLock);
              const pxH = scx + AIM_UX * sgn * 8.5, pyH = scy + AIM_UY * sgn * 8.5;
              p.line(pxH + AIM_UY * 2.2, pyH - AIM_UX * 2.2, pxH - AIM_UY * 2.2, pyH + AIM_UX * 2.2, G[6], 0.88 * kLock);
            }
            if (t < T_LOCK + 0.14) {
              const fk = 1 - clamp((t - (T_LOCK - 0.02)) / 0.16);
              if (fk > 0) flare(p, scx, scy, 19 * fk, fk, [G[3], G[4], G[5], G[6], WHITE]);
            }
          }
        }

        // 5. Full Solar Laser Shaft (`穿过圆环发射一道炙热的太阳激光束`) + True 3D Foreground Scope Rim Overlap!
        if (t >= T_FIRE && t < T_BEAM_END + 0.14) {
          drawSolarBeamSegment(p, st.ex + st.lookX * 0.7, st.ey + st.lookY * 0.7, X_SCOPE, Y_SCOPE, t, S, G, true);
          drawSolarBeamSegment(p, X_SCOPE, Y_SCOPE, X_HIT, Y_HIT, t, S, G, false);
          if (t < T_BEAM_END) {
            // Re-draw Ring 2's near half (`z >= 0`) OVER the laser shaft so the beam visibly punches THROUGH the golden reticle!
            zBuf.clear();
            drawAstrolabeRing(p, st.rings[2], G, E, S, t, 1, zBuf, 2);
          }
        }
      } else if (dissolve < 0.99) {
        // STAGE 4 POST-SHATTER: Fallen Petrified Stone Eye + Clattering Heavy Broken Golden Ring Arcs (`叮当散落一地`)!
        for (const segArc of brokenArcs) {
          if (segArc.y < -1) drawBrokenGoldenArc(p, segArc, G, t, dissolve);
        }

        if (stoneOrb.active) {
          const deadSt = {
            lookX: 0.6 + stoneOrb.rot * 0.4,
            lookY: 1.2,
            lid: 0.15,
            pupilSlit: 0.5,
            solarMix: 0,
            stoneLv: 1.35,
          };
          drawSapphireEye(eyeGrid, p, stoneOrb.x, stoneOrb.y, deadSt, E, G, S, ST, eyeCracks, o.seed, t, dissolve);
        }

        for (const segArc of brokenArcs) {
          if (segArc.y >= -1) drawBrokenGoldenArc(p, segArc, G, t, dissolve);
        }

        const fadeClink = clamp(1 - dissolve * 1.4);
        for (const cr of clinkRings) {
          const u = cr.age / cr.max;
          const rr = 2 + 9.5 * ease.outCubic(u);
          oval(p, cr.x, cr.y, rr, rr * 0.32, u < 0.38 ? WHITE : G[5], (1 - u) * cr.amp * fadeClink);
          if (u < 0.58) {
            sparkle(p, cr.x, cr.y - 1.5, 3.4 * (1 - u) * cr.amp, WHITE, G[5], (1 - u) * fadeClink);
          }
        }
      }

      // Near-side solar laser impact shockwaves, molten splashes & corona flares!
      if (t >= T_HIT && t < T_BEAM_END + 0.45) {
        const dtH = t - T_HIT;
        if (t < T_BEAM_END) {
          const pulse = 0.82 + 0.18 * Math.sin(t * 65);
          for (let i = 0; i < 8; i++) {
            const a = -Math.PI + 0.16 + (i / 7) * (Math.PI - 0.32);
            const len = (10 + 10 * Math.abs(Math.sin(t * 20 + i * 2.1))) * pulse;
            p.line(
              X_HIT,
              -1,
              X_HIT + Math.cos(a) * len,
              -1 + Math.sin(a) * len * 0.85,
              (u) => (u < 0.45 ? WHITE : i % 2 ? S[5] : S[4]),
              (u) => (u < 0.6 ? 1 : 1.55 - u)
            );
          }
          p.circle(X_HIT, -1.5, 5.5 * pulse, S[4]);
          p.circle(X_HIT, -1.5, 3.4 * pulse, WHITE);
        }
        if (dtH < 0.22) {
          const fk = 1 - dtH / 0.22;
          star(p, X_HIT, -2, hitSpikes, 0.95 + 0.45 * (1 - fk), fk, [S[2], S[4], S[5], WHITE], fk, 2.8);
          const spread = 6 + 24 * ease.outQuart(1 - fk);
          frontCrescent(p, X_HIT + spread, 1, 14 * fk, 4 * fk, [WHITE, S[5], S[3]], fk);
          frontCrescent(p, X_HIT - spread, -1, 14 * fk, 4 * fk, [WHITE, S[5], S[3]], fk);
        }
        for (let k = 0; k < 3; k++) {
          const rk = (dtH - k * 0.22) / 0.44;
          if (rk > 0 && rk < 1) {
            band(
              p,
              X_HIT,
              0,
              6 + 36 * ease.outCubic(rk),
              0.30,
              3.2 * (1 - rk * 0.65),
              (1 - rk) * 0.95,
              [S[1], S[3], S[5], WHITE],
              (ang) => Math.sin(ang) >= 0,
              rk < 0.18
            );
          }
        }
      }

      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

// Draw the searing Solar Laser Beam (`炙热的太阳激光束`) with white-hot core, helical solar strands & tilted 3D shock-hoops!
function drawSolarBeamSegment(p, x0, y0, x1, y1, t, S, G, isInner) {
  const dtF = t - T_FIRE;
  const dx = x1 - x0, dy = y1 - y0;
  const fullLen = Math.hypot(dx, dy) || 1;
  const ux = dx / fullLen, uy = dy / fullLen;
  const nx = -uy, ny = ux;

  const reach = isInner
    ? clamp(dtF / 0.015)
    : clamp((dtF - 0.012) / (T_HIT - T_FIRE - 0.012));
  if (reach <= 0) return;

  const pinch = t >= T_BEAM_END ? clamp(1 - (t - T_BEAM_END) / 0.14) : 1;
  const hero = dtF < 0.055 ? 1 : 0;
  const L = fullLen * reach;
  const baseW = (isInner ? 3.8 : 5.6) * pinch * (1 + 0.30 * hero);
  const LV = [WHITE, S[5], S[4], S[3], S[2], S[1]];

  if (t < T_BEAM_END) {
    for (let d = 0; d <= L; d += 0.6) {
      const bx = x0 + ux * d;
      const by = y0 + uy * d;
      const wave = 1 + 0.12 * Math.sin(d * 0.32 - t * 48);
      const taper = isInner ? Math.min(1, (d + 2) / 5) : 1;
      const w = baseW * wave * taper;
      const pulse = (((d * 0.045 - t * 6.8) % 1) + 1) % 1 < 0.13 ? 1 : 0;

      for (let q0 = -w * 1.25; q0 <= w * 1.25; q0 += 0.55) {
        const q = Math.abs(q0) / Math.max(0.5, w);
        let lv = q < 0.25 ? 0 : q < 0.46 ? 1 : q < 0.67 ? 2 : q < 0.86 ? 3 : q < 1.02 ? 4 : 5;
        lv = Math.max(0, lv - pulse - hero);
        const px = bx + nx * q0, py = by + ny * q0;
        if (lv === 5 && bayer(px, py) > (1.25 - q) / 0.25) continue;
        p.px(px, py, LV[lv]);
      }

      if (!isInner) {
        for (let s = 0; s < 3; s++) {
          const a = d * 0.19 - t * 28 + (s * TAU) / 3;
          if (Math.cos(a) > -0.1) {
            const off = Math.sin(a) * w * 1.08;
            p.dot(bx + nx * off, by + ny * off, Math.cos(a) > 0.55 ? WHITE : G[5]);
          }
        }
      }
      if (((d * 2) | 0) % 14 === 0) {
        p.glow(bx, by, w * 2.2 + 5, S[4], 0.24 * pinch);
      }
    }

    // Blazing solar sunburst corona where the laser punches through the Crosshair Scope!
    if (!isInner) {
      const sr = 4.6 + 0.8 * Math.sin(t * 52);
      for (let i = 0; i < 8; i++) {
        const a = t * 4.8 + (i * TAU) / 8;
        const rl = (i % 2 === 0 ? 11 : 6.5) + 2.5 * Math.sin(t * 26 + i);
        p.line(x0, y0, x0 + Math.cos(a) * rl, y0 + Math.sin(a) * rl, (u) => (u < 0.5 ? WHITE : S[5]), (u) => 1.25 - u);
      }
      p.circle(x0, y0, sr, S[5]);
      p.circle(x0, y0, sr * 0.58, WHITE);
      p.glow(x0, y0, 22, S[4], 0.60);

      // Properly 3D-oriented golden sonic shock-hoops perpendicular to `(ux, uy)` racing down the laser shaft!
      for (let k = 0; k < 2; k++) {
        const u = (dtF * 2.6 + k * 0.5) % 1;
        const hd = 6 + u * (L - 14);
        const hx = x0 + ux * hd, hy = y0 + uy * hd;
        const hr = (1 - u * 0.42) * 9.8;
        beamHoop(p, hx, hy, ux, uy, hr, 0.48, u < 0.28 ? WHITE : G[5], (1 - u) * 0.9);
      }
    }
  } else {
    for (let d = 0; d <= fullLen; d += 3.5) {
      if (rand(d | 0, (t * 60) | 0, 7) < 0.62 * pinch) {
        const bx = x0 + ux * d, by = y0 + uy * d;
        p.circle(bx, by, 1.6 * pinch, pinch > 0.5 ? WHITE : S[4], pinch);
        p.glow(bx, by, 6, S[3], 0.35 * pinch);
      }
    }
  }
}

// Draw one heavy, curved golden rune-ring segment tumbling and resting on the stone floor (`外围金环寸寸断裂...叮当散落一地`)
function drawBrokenGoldenArc(p, segArc, G, t, dissolve) {
  const n = 22;
  const r = segArc.r;
  const sy = segArc.tilt;

  // Crisp dark bronze shadow 1px beneath each curved golden chunk!
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = segArc.rot - segArc.span * 0.5 + u * segArc.span;
    const x = segArc.x + Math.cos(a) * r;
    const y = segArc.y + Math.sin(a) * r * sy;
    if (dissolve > 0 && dissolve * 1.3 > bayer(x, y + 1)) continue;
    p.px(Math.round(x), Math.round(y + 1.3), G[0]);
  }
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = segArc.rot - segArc.span * 0.5 + u * segArc.span;
    const ca = Math.cos(a), sa = Math.sin(a);
    const x = segArc.x + ca * r;
    const y = segArc.y + sa * r * sy;
    if (dissolve > 0 && dissolve * 1.25 > bayer(x, y)) continue;

    const endJag = i <= 1 || i >= n - 1;
    const lit = -ca * 0.55 - sa * 0.65;
    const glintWave = Math.sin(t * 7.5 + segArc.seed * 1.9 + u * 4) > 0.91 && dissolve < 0.4;
    const col = endJag ? G[2] : glintWave ? WHITE : lit > 0.35 ? G[5] : lit > -0.15 ? G[4] : G[3];

    p.px(Math.round(x), Math.round(y), col);
    p.px(Math.round(x), Math.round(y - 1), lit > 0.05 ? G[5] : G[3]);
    if (i % 5 === 2 && !endJag) {
      p.px(Math.round(x), Math.round(y), G[1]);
    }
  }
  if (segArc.settled && dissolve < 0.35 && Math.sin(t * 9 + segArc.seed * 2.7) > 0.94) {
    sparkle(p, segArc.x, segArc.y - 1, 2.2, WHITE, G[5], 0.5 * (1 - dissolve * 2));
  }
}
