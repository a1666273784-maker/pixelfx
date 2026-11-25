// Translucent water-drop ghostfire silhouette, time-lagged fluid drift tail, and glowing soul-heart
// draw on ./starlight-slime.js, ./lava-slug.js, ./ghost.js, ./wisp.js, and ../fire/spirit-flame.js;
// dark-violet rage transition, warped sonic shockwave rings, soul-flame bursts, and floor burn holes
// draw on ../shadow/_lib.js, ../shadow/ghostfire-strike.js, and ../arcane/gravity-pulse.js
// (adapted from Sprite Fusion's open-source pixel-art VFX, MIT License, Copyright (c) 2026 Hugo Duprez).
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
  seg,
  ease,
  lerp,
  mix,
  tileFbm,
  TAU,
  WHITE,
} from "../../core/index.js";
import { Grid, shadow, lnoise } from "./_lib.js";
import { VOID } from "../shadow/_lib.js";

export const meta = {
  name: "Weeping wisp",
  desc: "A weeping green ghostfire cries spark-tears burning holes, sneaks a sly giggle, glides in a flowing liquid flame tail, turns purple firing sonic rings, and blows out to smoke.",
  tags: ["critter", "monster", "ghost", "wisp", "fire", "shadow", "sonic", "one-shot"],
  size: [336, 184],
  origin: [128, 146],
  duration: 12.0,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    // 8-step Translucent Pale Ghost-Green Will-o'-the-Wisp ramp (`惨绿色半透明幽冥鬼火`)
    palette: ["#05180e", "#0c3820", "#186b3a", "#2ab05e", "#5ce884", "#a4ffb2", "#e0ffe6", "#ffffff"],
    // 8-step Ferocious Dark-Purple Ghostfire Fury ramp (`凶狠暗紫色暴怒鬼火`)
    rage: VOID,
    // 5-step Candle-Extinguish Wisp of Cyan-Green Smoke (`一缕青烟`)
    smoke: ["#182928", "#2d4c49", "#4e7a74", "#82b8b0", "#c4efe6"],
    seed: 23,
  },
};

// 5-Stage Sustained Choreography + Post-Attack Buffer (12.00s, 360 frames):
// 0.00..2.00  【待机 Idle】               Translucent plump water-drop ghostfire floating; slender willow-leaf hands cover face softly sobbing
// 2.00..4.80  【生态小动作 Quirk】        Bursts into theatrical bawling shooting green spark-tears burning ground holes (2.00..3.48) -> slides right hand aside to slyly peek with 1 eye & giggle behind left hand (3.48..4.80)
// 4.80..6.95  【移动 Move】               Glides erratically mid-air as a cohesive fluid water-drop ectoplasm streaming a sinuous watery tail
// 6.95..9.00  【攻击 Attack】             Instantly shifts into fierce dark-purple ghostfire, roars open jagged mouth, fires 4 warped sonic shockwave rings detonating in soul flames!
// 9.00..10.00 【攻击后待机缓冲 IdleBuf】  Cools back smoothly into pale-green fake-sobbing idle before KO
// 10.00..12.00【倒地 KO】                 Unwilling wail as gale whips & stretches ghostfire like a candle flame -> POOF (`噗`) into a rising S-curved pale smoke thread!
const T_QUIRK = 2.00;
const T_PEEK = 3.48;
const T_MOVE = 4.80;
const T_ATK = 6.95;
const T_SONIC0 = 7.36;
const T_SONIC_GAP = 0.18;
const T_POST_IDLE = 9.00;
const T_KO = 10.00;
const T_POOF = 11.08;
const T_END = meta.duration;

const X_IDLE = -62;
const X_ATK = -14;
const X_HIT = 100;
const Y_IDLE = -25;

// Single continuous center-of-mass trajectory (used both at `t` and at `t - lag` so fluid trails follow true motion!)
function centerAt(t) {
  let x = X_IDLE;
  let y = Y_IDLE;

  if (t <= 0) {
    return { x: X_IDLE, y: Y_IDLE };
  } else if (t < T_QUIRK) {
    const u = t / T_QUIRK;
    x = X_IDLE + Math.sin(u * TAU * 1.5) * 1.6;
    y = Y_IDLE + Math.sin(u * TAU * 2.0) * 3.0;
  } else if (t < T_PEEK) {
    const heave = Math.sin((t - T_QUIRK) * 10.5);
    x = X_IDLE + Math.sin((t - T_QUIRK) * 13) * 1.8;
    y = Y_IDLE - 2.0 + Math.abs(heave) * 3.2;
  } else if (t < T_MOVE) {
    const u = seg(t, T_PEEK, T_MOVE);
    const open = smooth(0, 0.20, u) * (1 - smooth(0.84, 1.0, u));
    x = X_IDLE + Math.sin(t * 14) * 0.7 * open;
    y = Y_IDLE + Math.sin(t * 20) * 1.4 * open + Math.sin(u * TAU) * 2.0;
  } else if (t < T_ATK) {
    // Flowing smooth aquatic-drift trajectory (`X_IDLE -> X_ATK`) — steady forward glide + buoyant S-wave in Y (never backtracks into an accordion blob!)
    const u = seg(t, T_MOVE, T_ATK);
    const eu = ease.inOutSine(u);
    x = lerp(X_IDLE, X_ATK, eu);
    y = Y_IDLE - 5.5 * Math.sin(u * Math.PI) + Math.sin(u * TAU * 2.0) * 5.8;
  } else if (t < T_POST_IDLE) {
    const u = seg(t, T_ATK, T_POST_IDLE);
    const burst = smooth(0.04, 0.22, u);
    const roarCycle = t >= T_SONIC0 && t < T_SONIC0 + 3 * T_SONIC_GAP + 0.28
      ? Math.max(0, Math.sin(((t - T_SONIC0) / T_SONIC_GAP) * Math.PI))
      : 0;
    x = X_ATK - 1.5 * roarCycle;
    y = Y_IDLE - 4.0 * burst + Math.sin(u * TAU * 3) * 1.5;
  } else if (t < T_KO) {
    const u = seg(t, T_POST_IDLE, T_KO);
    x = X_ATK;
    y = lerp(Y_IDLE - 4.0, Y_IDLE, smooth(0, 0.45, u)) + Math.sin(u * TAU * 2.0) * 2.4;
  } else {
    const ku = seg(clamp(t, T_KO, T_POOF), T_KO, T_POOF);
    x = X_ATK + smooth(0.1, 0.9, ku) * 6.0;
    y = Y_IDLE + Math.sin(ku * TAU * 5.5) * 2.2;
  }
  return { x, y };
}

function stateAt(t) {
  const cNow = centerAt(t);
  const cPrev = centerAt(Math.max(0, t - 0.05));
  const vx = (cNow.x - cPrev.x) / 0.05;
  const vy = (cNow.y - cPrev.y) / 0.05;

  let sx = 1.0;
  let sy = 1.0;
  let driftMix = 0;
  let rageMix = 0;
  let scale = 1.0;
  let roarCycle = 0;
  let koWhip = 0;
  let koFade = 1.0;
  let poseMode = "sob"; // "sob" | "bawl" | "peek" | "drift" | "roar" | "wail" | "gone"
  let handL = { dx: -6.4, dy: -0.5, rot: 0.48 };
  let handR = { dx: 6.4, dy: -0.5, rot: -0.48 };

  if (t < T_QUIRK) {
    const u = t / T_QUIRK;
    const breath = Math.sin(u * TAU * 4.0);
    const tremble = Math.sin(t * 20) * 0.5;
    sy = 1.0 + breath * 0.055;
    sx = 1.0 - breath * 0.035;
    poseMode = "sob";
    handL = { dx: -5.8 + tremble, dy: -1.4 + breath * 0.6, rot: 0.56 };
    handR = { dx: 5.8 - tremble, dy: -1.4 + breath * 0.6, rot: -0.56 };
  } else if (t < T_PEEK) {
    const wail = Math.sin(t * 17);
    const heave = Math.sin(t * 10.5);
    sx = 1.08 + heave * 0.09;
    sy = 0.93 - heave * 0.06;
    poseMode = "bawl";
    handL = { dx: -11.5 + wail * 1.8, dy: -1.2 - Math.abs(heave) * 2.8, rot: -0.52 };
    handR = { dx: 11.5 - wail * 1.8, dy: -1.2 - Math.abs(heave) * 2.8, rot: 0.52 };
  } else if (t < T_MOVE) {
    const u = seg(t, T_PEEK, T_MOVE);
    const open = smooth(0, 0.18, u) * (1 - smooth(0.84, 1.0, u));
    const chuckle = Math.sin(t * 22) * open;
    sx = 1.0 + 0.04 * chuckle;
    sy = 1.0 - 0.03 * chuckle;
    poseMode = open > 0.22 ? "peek" : "sob";
    handR = { dx: lerp(6.2, 16.5, open), dy: lerp(-1.4, 5.2, open), rot: lerp(-0.48, -1.22, open) };
    handL = { dx: lerp(-6.0, 0.5, open) + chuckle * 0.6, dy: lerp(-1.4, 2.2, open) + chuckle * 0.9, rot: lerp(0.52, 1.08, open) };
  } else if (t < T_ATK) {
    const u = seg(t, T_MOVE, T_ATK);
    // Smooth ramp into & out of fluid liquid-drop locomotion (`driftMix` blends seamlessly!)
    driftMix = smooth(0, 0.18, u) * (1 - smooth(0.86, 1.0, u));
    const bobW = Math.sin(u * TAU * 2.5);
    sx = 1.0 + 0.12 * driftMix;
    sy = 1.0 - 0.08 * driftMix + 0.06 * bobW;
    poseMode = "drift";
    handL = { dx: lerp(-6.0, -9.8, driftMix), dy: lerp(-1.4, 3.8 + bobW * 1.4, driftMix), rot: lerp(0.52, -0.78, driftMix) };
    handR = { dx: lerp(6.0, 9.2, driftMix), dy: lerp(-1.4, 4.2 + bobW * 1.4, driftMix), rot: lerp(-0.52, -0.54, driftMix) };
  } else if (t < T_POST_IDLE) {
    const u = seg(t, T_ATK, T_POST_IDLE);
    rageMix = smooth(0, 0.10, u);
    const burst = smooth(0.05, 0.22, u);
    roarCycle = t >= T_SONIC0 && t < T_SONIC0 + 3 * T_SONIC_GAP + 0.28
      ? Math.max(0, Math.sin(((t - T_SONIC0) / T_SONIC_GAP) * Math.PI))
      : 0;
    scale = 1.0 + 0.44 * burst + 0.07 * roarCycle;
    sx = 1.06 + 0.10 * roarCycle;
    sy = 1.06 - 0.05 * roarCycle;
    poseMode = u < 0.08 ? "peek" : "roar";
    handL = { dx: lerp(-6.5, -18.5, burst), dy: lerp(1.0, -6.5, burst) - roarCycle * 2.4, rot: -1.18 };
    handR = { dx: lerp(6.5, 18.5, burst), dy: lerp(1.0, -6.5, burst) - roarCycle * 2.4, rot: 1.18 };
  } else if (t < T_KO) {
    const u = seg(t, T_POST_IDLE, T_KO);
    rageMix = 1.0 - smooth(0, 0.42, u);
    scale = lerp(1.44, 1.0, smooth(0, 0.42, u));
    const breath = Math.sin(u * TAU * 2.0);
    sy = 1.0 + breath * 0.05;
    poseMode = "sob";
    handL = { dx: lerp(-15, -5.8, smooth(0, 0.45, u)), dy: lerp(-5, -1.4, smooth(0, 0.45, u)), rot: 0.56 };
    handR = { dx: lerp(15, 5.8, smooth(0, 0.45, u)), dy: lerp(-5, -1.4, smooth(0, 0.45, u)), rot: -0.56 };
  } else if (t < T_POOF) {
    const ku = seg(t, T_KO, T_POOF);
    koWhip = ku;
    koFade = 1.0 - smooth(0.84, 1.0, ku) * 0.45;
    scale = (1.0 - smooth(0.66, 1.0, ku) * 0.62) * (0.82 + 0.18 * Math.cos(ku * 46));
    poseMode = "wail";
    const whipOffset = Math.sin(ku * TAU * 7.0) * 6.0;
    handL = { dx: -6.0 + ku * 14 + whipOffset * 0.4, dy: -3.5 + Math.cos(ku * 36) * 3.5, rot: 1.08 };
    handR = { dx: 6.5 + ku * 24 - whipOffset * 0.4, dy: -4.5 - Math.cos(ku * 36) * 3.5, rot: 1.38 };
  } else {
    poseMode = "gone";
    scale = 0;
  }

  return {
    x: cNow.x,
    y: cNow.y,
    vx,
    vy,
    sx,
    sy,
    driftMix,
    rageMix,
    scale,
    roarCycle,
    koWhip,
    koFade,
    poseMode,
    handL,
    handR,
  };
}

// Evaluate an articulated 10-node spine (`pts = [{ x, y, r, u }]`) forming ONE seamless, soft-contoured
// liquid ghostfire water-drop (`水滴状半透明幽冥鬼火`) whose shape morphs smoothly across every action:
// - Idle / Quirk / Roar : plump rounded water-drop belly tapering gently up into a wavy ghost-flame tip bead!
// - Move (`driftMix`)   : true watery fluid motion! Head stays plump and round while its body/neck streams
//                         continuously along its actual past trajectory `centerAt(t - u * lag)` with an S-wave!
// - KO (`koWhip`)       : gale blows the fluid candle-flame crown into a long, wildly whipping flame ribbon!
function buildFluidBodySpine(st, t, seed) {
  const sc = st.scale;
  const N = 10;
  const pts = [];

  // Static upright water-drop profile vs u (0 = round lower belly .. 1 = soft flickering flame tip)
  // Swells into plump lower cheeks (`u=0.26`), tapers smoothly through a delicate rounded waist into a living flame lick!
  const dropRadius = (u, s) => {
    const base = u < 0.28
      ? Math.sqrt(clamp(1.0 - Math.pow((0.28 - u) / 0.32, 2), 0.14, 1.0))
      : Math.pow(clamp(1.0 - (u - 0.28) / 0.74, 0.0, 1.0), 0.76);
    const crownBead = u > 0.72 && u < 0.96 ? Math.sin(((u - 0.72) / 0.24) * Math.PI) * 0.09 : 0;
    return (13.4 * base + 13.4 * crownBead) * s;
  };

  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);

    // 1. Upright/Flame crown path (`xUp, yUp`):
    const fireSway =
      Math.sin(u * 5.6 - t * 10.5 + seed) * (1.5 + 2.6 * u) * u * sc +
      lnoise(t, T_END, 26, u * 3.0, seed + 5) * 1.8 * u * sc;
    const lagHead = centerAt(Math.max(0, t - u * 0.14));
    const galePush = st.koWhip > 0
      ? (st.koWhip * 38 + Math.sin(st.koWhip * TAU * 7.5 - u * 4.5) * 11.5 * st.koWhip) * Math.pow(u, 1.15)
      : 0;
    const galeFlatten = st.koWhip > 0 ? 1.0 - 0.44 * smooth(0.40, 1.0, st.koWhip) * u : 1.0;

    const xUp = lerp(st.x, lagHead.x, 0.65) + fireSway * (1 + st.koWhip * 0.9) + galePush;
    const yUp = lerp(st.y, lagHead.y, 0.65) + 6.5 * sc * st.sy - u * 31.5 * sc * st.sy * (1 + 0.42 * st.koWhip) * galeFlatten;
    const rUp = Math.max(1.0, dropRadius(u, sc) * lerp(st.sx, 0.76, u) * (1 - 0.34 * st.koWhip * u));

    // 2. Fluid swimming liquid-teardrop path (`xSwim, ySwim`):
    //    Samples actual past trajectory `centerAt(t - u * 0.48)` PLUS steady buoyant trailing wake so the tail
    //    flows like liquid ink/ectoplasm in water across EVERY frame (never telescoping into a short blob)!
    const cTrail = centerAt(Math.max(0, t - u * 0.48));
    const rippleY = Math.sin(u * 7.8 - t * 13.0) * (4.2 * Math.sin(u * Math.PI * 0.85 + 0.15));
    const rippleX = Math.cos(u * 5.2 - t * 10.0) * 1.4 * u;
    const steadyWake = -u * (30.0 + 7.0 * clamp(st.vx / 40, 0, 1.0));
    const xSwim = lerp(st.x, cTrail.x, 0.45) + steadyWake + rippleX;
    const ySwim = lerp(st.y, cTrail.y, 0.82) + rippleY - u * 12.5;

    // Smooth plump liquid head (`r = 13.0 -> 10.2 px`) flowing cleanly into a long sinuous water-flame filament!
    const swimFront = u < 0.24 ? Math.sqrt(clamp(1.0 - Math.pow((0.24 - u) / 0.28, 2), 0.24, 1.0)) : 1.0;
    const swimTaper = Math.pow(clamp(1.0 - u * 0.90, 0.08, 1.0), 0.84);
    const rSwim = Math.max(1.0, 13.0 * sc * swimFront * swimTaper);

    pts.push({
      x: lerp(xUp, xSwim, st.driftMix),
      y: lerp(yUp, ySwim, st.driftMix),
      r: lerp(rUp, rSwim, st.driftMix),
      u,
    });
  }

  return pts;
}

// Render translucent water-drop ghostfire body via `Grid` metaball union + `g.depths(6)` + subsurface caustics + glass specular sheen!
const BODY_GRID = new Grid(-84, -76, 168, 124);

function drawFluidGhostBody(p, st, C, t, seed, X0) {
  if (st.poseMode === "gone" || st.scale <= 0.05) return;

  const sc = st.scale;
  const spine = buildFluidBodySpine(st, t, seed);
  const head = spine[1];

  // Outer ghostly radial illumination (`halo`)
  p.glow(head.x, head.y - 2 * sc, 38 * sc, C[4], 0.46 * st.koFade);
  p.glow(head.x, head.y, 18 * sc, C[5], 0.30 * st.koFade);
  if (st.driftMix > 0.1) {
    const mid = spine[5], tail = spine[8];
    p.glow(mid.x, mid.y, 20 * sc, C[4], 0.26 * st.driftMix);
    p.glow(tail.x, tail.y, 12 * sc, C[3], 0.18 * st.driftMix);
  }

  const g = BODY_GRID.clear();
  // Local grid origin anchored at rounded `st.x, st.y` so fractional jitter never breaks pixel depth edges
  const ox = Math.round(st.x);
  const oy = Math.round(st.y);

  // Convert world-space spine nodes into Grid-local coordinates and clamp left boundary cleanly within `X0`
  const localSpine = spine.map((nd) => ({
    x: Math.max(X0 - ox + 4 + nd.r, nd.x - ox),
    y: nd.y - oy,
    r: nd.r,
    u: nd.u,
  }));

  let x0 = 999, y0 = 999, x1 = -999, y1 = -999;
  for (const nd of localSpine) {
    x0 = Math.min(x0, nd.x - nd.r - 4);
    x1 = Math.max(x1, nd.x + nd.r + 4);
    y0 = Math.min(y0, nd.y - nd.r - 4);
    y1 = Math.max(y1, nd.y + nd.r + 4);
  }
  x0 = Math.max(-80, Math.floor(x0));
  x1 = Math.min(80, Math.ceil(x1));
  y0 = Math.max(-72, Math.floor(y0));
  y1 = Math.min(44, Math.ceil(y1));

  // Sub-sample 25 dense circles along the Catmull-like spine curve so metaball fusion is silky-smooth with zero bumps!
  const subNodes = [];
  const NSUB = 25;
  for (let i = 0; i < NSUB; i++) {
    const f = (i / (NSUB - 1)) * (localSpine.length - 1);
    const i0 = Math.floor(f);
    const i1 = Math.min(localSpine.length - 1, i0 + 1);
    const fr = f - i0;
    subNodes.push({
      x: lerp(localSpine[i0].x, localSpine[i1].x, fr),
      y: lerp(localSpine[i0].y, localSpine[i1].y, fr),
      r: lerp(localSpine[i0].r, localSpine[i1].r, fr),
      u: lerp(localSpine[i0].u, localSpine[i1].u, fr),
    });
  }

  const nCells = g.w * g.h;
  if (!g._nx || g._nx.length !== nCells) {
    g._nx = new Float32Array(nCells);
    g._ny = new Float32Array(nCells);
    g._q = new Float32Array(nCells);
    g._u = new Float32Array(nCells);
  }

  // Pass 1: Smooth fluid metaball union over the articulated spline (`starlight-slime` / `lava-slug` style!)
  g.shade(x0, y0, x1, y1, (lx, ly, out) => {
    let field = 0;
    let bestD = 99;
    let bestNx = 0;
    let bestNy = -1;
    let bestU = 0;

    for (let i = 0; i < subNodes.length; i++) {
      const nd = subNodes[i];
      const dx = (lx - nd.x) / nd.r;
      const dy = (ly - nd.y) / nd.r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 2.3) continue;
      const d = Math.sqrt(d2);
      const s = Math.max(0, 1.24 - d);
      field += s * s * 0.92;
      if (d2 < bestD) {
        bestD = d2;
        bestNx = dx;
        bestNy = dy;
        bestU = nd.u;
      }
    }

    if (field < 0.34) return 0;

    const idx = g.idx(lx, ly);
    if (idx >= 0) {
      const nl = Math.hypot(bestNx, bestNy) || 1;
      g._nx[idx] = bestNx / nl;
      g._ny[idx] = bestNy / nl;
      g._q[idx] = clamp(Math.sqrt(bestD));
      g._u[idx] = bestU;
    }
    out.t = 1;
    out.a = 0.85;
    return C[4];
  });

  g.depths(6);

  // Pass 2: Liquid translucent underworld ghostfire shading + flowing subsurface water caustics + curved glass specular highlight!
  const flowT = t * 2.8;
  g.recolor((lx, ly, col, al, tag) => {
    if (tag !== 1) return col;
    const idx = g.idx(lx, ly);
    const d = g.depth(lx, ly);
    const nx = g._nx[idx];
    const ny = g._ny[idx];
    const q = g._q[idx];
    const uSpine = g._u[idx];
    const lit = -0.52 * nx - 0.78 * ny;

    // Flowing aquatic internal caustics (`水的流动感`): liquid ripples glide continuously up/along the spine!
    const caustic = tileFbm(lx * 0.16 - flowT * 0.45, ly * 0.18 + flowT * 0.72, 0, 0, seed + 13, 2);
    const waterWave = Math.sin(uSpine * 11.0 - t * 9.5 + caustic * 3.8);

    let cOut = C[3];
    let aOut = 0.78;

    if (d === 1) {
      // Crisp luminous 1px outer membrane: bright cold highlights on top-left & crown, deep emerald/violet rim on shadow
      if (lit > 0.12 || uSpine > 0.68) {
        cOut = uSpine > 0.82 ? C[6] : C[5];
        aOut = 0.94;
      } else {
        cOut = C[1];
        aOut = 0.90;
      }
    } else if (d === 2) {
      cOut = lit > 0.25 || uSpine > 0.62 ? C[5] : C[4];
      aOut = 0.86;
    } else if (d === 3) {
      cOut = waterWave > 0.35 ? C[4] : C[3];
      aOut = 0.78;
    } else {
      // Translucent deep inner cavity (`d >= 4`): swirling watery ectoplasm & pulsing ghost-soul heart!
      const isHeart = uSpine < 0.38 && q < 0.46;
      if (isHeart) {
        cOut = waterWave > 0.2 ? C[4] : C[2];
        aOut = 0.72;
      } else {
        cOut = waterWave > 0.48 ? C[3] : C[1];
        aOut = 0.64;
      }
    }

    // Flowing water-drop glass specular curve along the upper-left contour (`d === 2 || d === 3`)
    if ((d === 2 || d === 3) && lit > 0.46 && uSpine > 0.08 && uSpine < 0.78) {
      const sheen = 0.5 + 0.5 * Math.sin(uSpine * 7.5 - t * 6.5);
      if (d === 2 && sheen > 0.36) {
        cOut = sheen > 0.66 ? WHITE : C[6];
        aOut = 0.96;
      } else if (sheen > 0.55) {
        cOut = C[6];
        aOut = 0.88;
      }
    }

    // Glowing droplet tip bead at `u > 0.88`
    if (uSpine > 0.88) {
      cOut = d <= 2 ? WHITE : C[6];
      aOut = 0.94;
    }

    g.a[idx] = aOut * st.koFade;
    return cOut;
  });

  // Extra furious dark-purple side flame horns/tongues when attacking
  if (st.poseMode === "roar") {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const fu = k / 5;
        const fxHorn = st.x + side * (10.5 + fu * 6.0) + Math.sin(t * 16 + k) * 1.4;
        const fyHorn = st.y - 6.0 - fu * 18.0 * sc;
        p.disc(fxHorn, fyHorn, (2.8 - fu * 1.6) * sc, fu < 0.45 ? C[5] : C[6], 0.88 * (1 - fu * 0.4));
      }
    }
  }

  // Paint the smooth translucent Grid onto painter BEFORE crisp foreground face & hands!
  g.draw(p, 1, ox, oy);

  // Move stage: 3 small detached liquid ectoplasm beads pinching off the undulating tail tip!
  if (st.driftMix > 0.25) {
    const tail = spine[9];
    for (let k = 1; k <= 3; k++) {
      const ph = ((t * 3.8 + k * 0.33) % 1);
      const bx = tail.x - ph * (8 + k * 5) - 2 * k;
      const by = tail.y + Math.sin(ph * TAU + k * 2.1) * 3.0;
      if (bx < X0 + 4) continue;
      const ba = (1 - ph) * st.driftMix * 0.85;
      p.disc(bx, by, lerp(1.7, 0.7, ph), ph < 0.35 ? C[5] : C[4], ba);
      p.glow(bx, by, 4.5, C[4], ba * 0.35);
    }
  }

  // Facial Expressions (`戏精狡猾微表情`) anchored squarely on the plump head (`spine[1]`)!
  const fx = spine[1].x + (st.driftMix > 0.2 ? 3.2 * st.driftMix : 0);
  const fy = spine[1].y - 0.8;

  if (st.poseMode === "sob") {
    // Tearful worried puppy eyes + glistening tear drop welling right above face-covering flame hands!
    for (const side of [-1, 1]) {
      const ex = fx + side * 4.5;
      p.line(ex - side * 1.6, fy - 4.4, ex + side * 1.4, fy - 3.6, C[0]);
      p.line(ex - side * 1.6, fy - 5.0, ex + side * 1.4, fy - 4.2, WHITE);
      const blinkTear = 0.65 + 0.35 * Math.sin(t * 7 + side);
      p.blend(ex + side * 0.4, fy - 2.6, C[6], 0.96 * blinkTear);
      p.blend(ex + side * 0.4, fy - 1.8, WHITE, 0.92 * blinkTear);
    }
  } else if (st.poseMode === "bawl") {
    for (const side of [-1, 1]) {
      const ex = fx + side * 4.6;
      p.line(ex - 1.8, fy - 2.5, ex + 1.8, fy - 2.5, WHITE);
      p.line(ex, fy - 2.5, ex, fy + 2.8, C[5]);
    }
    p.ellipse(fx, fy + 3.6, 3.3, 2.4, C[0]);
    p.px(Math.round(fx), Math.round(fy + 2.9), C[2]);
  } else if (st.poseMode === "peek") {
    // SLY ONE-EYED PEEK (`露出狡黠的独眼偷看`): big gleaming crafty eye with arched villain brow + smug half-grin!
    const rx = fx + 4.8;
    p.ellipse(rx, fy - 2.6, 4.0, 3.3, C[0]);
    p.ellipse(rx, fy - 2.6, 3.0, 2.5, WHITE);
    p.px(Math.round(rx + 1.1), Math.round(fy - 2.6), C[0]);
    p.px(Math.round(rx + 1.1), Math.round(fy - 1.6), C[0]);
    p.px(Math.round(rx - 0.7), Math.round(fy - 3.4), C[5]);
    p.line(rx - 3.0, fy - 6.2, rx + 2.8, fy - 4.6, C[0]);
    p.line(rx - 3.0, fy - 6.8, rx + 2.8, fy - 5.2, C[6]);
    p.line(fx - 5.8, fy - 3.2, fx - 2.0, fy - 2.2, C[6]);
    // Smug curved smirk cheek crease peaking past the covering left hand!
    p.line(fx + 1.5, fy + 2.2, fx + 5.2, fy + 0.6, C[0]);
  } else if (st.poseMode === "drift") {
    // Pitiful watery puppy eyes glancing ahead as it flows through air
    for (const side of [-1, 1]) {
      const ex = fx + side * 3.8 + 1.0;
      p.line(ex - side * 1.5, fy - 3.0, ex + side * 1.5, fy - 1.4, C[6]);
      p.ellipse(ex, fy - 0.6, 1.5, 1.5, WHITE);
      p.px(Math.round(ex + 0.5), Math.round(fy - 0.6), C[0]);
    }
    p.line(fx - 1.8, fy + 3.2, fx + 2.2, fy + 2.8, C[0]);
  } else if (st.poseMode === "roar") {
    for (const side of [-1, 1]) {
      const ex = fx + side * 5.2;
      p.line(ex - side * 2.5, fy - 8.4, ex + side * 1.8, fy - 5.2, WHITE);
      p.px(Math.round(ex), Math.round(fy - 5.6), C[6]);
      p.glow(ex, fy - 5.6, 8, C[5], 0.72);
    }
    const mw = 6.2 * sc, mh = 5.4 * sc;
    p.ellipse(fx + 2.6, fy + 1.6, mw + 1, mh + 1, C[3]);
    p.ellipse(fx + 2.6, fy + 1.6, mw, mh, C[0]);
    p.ellipse(fx + 3.4, fy + 1.6, mw * 0.45, mh * 0.45, C[5]);
    p.px(Math.round(fx + 4.0), Math.round(fy + 1.6), WHITE);
    p.px(Math.round(fx + 1.6), Math.round(fy - 2.2), WHITE);
    p.px(Math.round(fx + 4.8), Math.round(fy - 1.8), C[6]);
    p.px(Math.round(fx + 2.0), Math.round(fy + 5.2), C[6]);
  } else if (st.poseMode === "wail") {
    const lxShift = st.koWhip * 3.5;
    for (const side of [-1, 1]) {
      p.ellipse(fx + side * 4.0 + lxShift, fy - 3.0, 2.3, 2.3, WHITE);
      p.px(Math.round(fx + side * 4.0 + lxShift), Math.round(fy - 3.0), C[0]);
    }
    p.ellipse(fx + lxShift * 1.1, fy + 2.8, 3.2, 2.8, C[0]);
  }

  // Slender Floating Willow-Leaf Flame Hands (`柳叶状火苗小手`) with crisp dark contrast outline!
  drawWillowHand(p, spine[1].x + st.handL.dx, spine[1].y + st.handL.dy, st.handL.rot, sc, C, t, seed + 41, st.koFade);
  drawWillowHand(p, spine[1].x + st.handR.dx, spine[1].y + st.handR.dy, st.handR.rot, sc, C, t, seed + 83, st.koFade);
}

// Slender willow-leaf flame hand (`柳叶状火苗小手`)
function drawWillowHand(p, hx, hy, rot, sc, C, t, seed, fade = 1) {
  const len = 10.6 * sc;
  const maxW = 3.0 * sc;
  const ca = Math.cos(rot), sa = Math.sin(rot);
  for (let r = -len * 0.45; r <= len * 0.55; r += 0.5) {
    const u = (r + len * 0.45) / len;
    const half = maxW * Math.sin(Math.pow(u, 0.72) * Math.PI) + lnoise(t, T_END, 24, r * 0.5, seed) * 0.20;
    if (half < 0.25) continue;
    const sway = Math.sin(t * 10 + u * 4 + seed) * 0.85 * u;
    for (let q = -half - 0.8; q <= half + 0.8; q += 0.5) {
      const px = hx + r * sa + (q + sway) * ca;
      const py = hy - r * ca + (q + sway) * sa;
      const aq = Math.abs(q);
      if (aq > half) {
        p.blend(px, py, C[0], 0.84 * fade);
      } else {
        const col = aq < half * 0.42 && u > 0.18 && u < 0.82 ? WHITE : aq < half * 0.72 ? C[5] : C[4];
        p.blend(px, py, col, 0.96 * fade);
      }
    }
  }
  p.glow(hx, hy, 7.5 * sc, C[4], 0.28 * fade);
}

// Substantiated Sonic Shockwave Ring (`实质化的凄厉音波冲击环`) + Smooth Air-Distortion Shimmer (`扭曲空气感`)!
function drawSonicRing(p, w, R_PAL, t) {
  const age = t - w.t0;
  if (age < 0 || age > w.life) return;
  const u = age / w.life;
  const x = lerp(w.x0, X_HIT, ease.outQuad(u));
  const y = w.y0 + Math.sin(u * 14 + w.seed) * 1.8;
  const ry = lerp(11, 28, ease.outCubic(u));
  const rx = ry * 0.37;
  const fade = Math.min(1, u * 10) * (1 - smooth(0.84, 1.0, u));

  // 1. Continuous Warped Air-Distortion Shear Ribbons (`扭曲空气感`) sampled smoothly
  for (let i = -3; i <= 3; i++) {
    const syBase = y + i * (ry * 0.30);
    const lenAir = 28;
    const ptsAir = 38;
    for (let k = 0; k < ptsAir; k++) {
      const f = k / (ptsAir - 1);
      const wx = lerp(x - rx - lenAir, x + rx + 6, f);
      const wy = syBase + Math.sin(f * TAU * 1.7 - t * 28 + i * 1.4 + w.seed) * 2.1;
      const a = Math.sin(f * Math.PI) * 0.44 * fade;
      p.blend(wx, wy, f > 0.65 ? R_PAL[6] : R_PAL[4], a);
      p.blend(wx, wy + 0.8, R_PAL[2], a * 0.65);
    }
  }
  // Curved acoustic Mach-cone wake wings top & bottom
  for (const side of [-1, 1]) {
    for (let k = 0; k < 36; k++) {
      const f = k / 35;
      const mx = x - f * 30;
      const my = y + side * (ry * 0.92 + f * 8.0 + Math.sin(f * 9 - t * 28) * 1.8);
      p.blend(mx, my, f < 0.35 ? WHITE : R_PAL[5], (1 - f) * 0.86 * fade);
      p.blend(mx, my + side * 0.9, R_PAL[3], (1 - f) * 0.56 * fade);
    }
  }

  // 2. High-density continuous thickened Sonic Pressure Wave Torus
  const steps = Math.max(96, Math.ceil(ry * 6.5));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    const horn = 1 + 0.14 * Math.sin(a * 6 - t * 32 + w.seed);
    const px = x + Math.cos(a) * rx * horn;
    const py = y + Math.sin(a) * ry * horn;
    const front = Math.cos(a) > -0.15;
    p.blend(px - 2.6, py, R_PAL[2], 0.78 * fade);
    p.blend(px - 1.4, py, R_PAL[4], 0.90 * fade);
    p.blend(px, py, front ? WHITE : R_PAL[5], 0.98 * fade);
    p.blend(px + 1.4, py, front ? R_PAL[6] : R_PAL[4], 0.90 * fade);
  }
  p.glow(x, y, ry * 1.7, R_PAL[4], 0.60 * fade);
}

export function create(o) {
  const G_PAL = fit(o.palette, 8);
  const R_PAL = fit(o.rage, 8);
  const S_PAL = fit(o.smoke, 5);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const [CW, CH] = meta.size;
  const [OX, OY] = meta.origin;
  const X0 = -OX + 4, X1 = CW - OX - 4, Y0 = -OY + 4, Y1 = CH - OY - 4;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, G_PAL[5], G_PAL[4], G_PAL[2]],
    haze: G_PAL[3],
  });
  const ragePs = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, R_PAL[6], R_PAL[4], R_PAL[2]],
    haze: R_PAL[3],
  });
  const lights = new Lights();

  const tears = [];
  const burnHoles = [];
  const sonicWaves = [];
  const soulFlames = [];
  const windStreaks = [];
  const koSmokeRibbon = [];

  let t = 0;
  let tearAcc = 0;
  let moveEmberAcc = 0;
  let rageEmberAcc = 0;
  let windAcc = 0;
  let snapFlashDone = false;
  let koSmokeSpawned = false;
  const wavesFired = [false, false, false, false];
  const wavesHit = [false, false, false, false];

  return {
    update(dt) {
      t += dt;
      const st = stateAt(t);

      // 1. Stage 2A: Bawling bursts out BIG green fiery spark-tears that burn holes onto floor `y = 0`!
      if (t >= T_QUIRK + 0.08 && t < T_PEEK - 0.12) {
        tearAcc += dt * 15;
        while (tearAcc >= 1) {
          tearAcc -= 1;
          const side = R.chance(0.5) ? -1 : 1;
          tears.push({
            x: st.x + side * 4.8,
            y: st.y - 2,
            vx: side * R.range(24, 62),
            vy: -R.range(48, 92),
            r: R.range(1.8, 2.9),
            life: 1.0,
            age: 0,
            pts: [],
          });
        }
      }
      for (let i = tears.length - 1; i >= 0; i--) {
        const tr = tears[i];
        tr.age += dt;
        tr.vy += 320 * dt;
        tr.x += tr.vx * dt;
        tr.y += tr.vy * dt;
        tr.pts.push([tr.x, tr.y]);
        if (tr.pts.length > 5) tr.pts.shift();
        if (tr.y >= 0 && tr.vy > 0) {
          burnHoles.push({
            x: clamp(tr.x, X0 + 10, X1 - 10),
            rx: R.range(2.8, 5.0),
            age: 0,
            life: R.range(2.8, 3.8),
          });
          lights.add(tr.x, -1, 14, G_PAL[5], 0.55, 0.22);
          for (let k = 0; k < 5; k++) {
            const a = -Math.PI * 0.5 + R.range(-1.2, 1.2);
            const sp = R.range(22, 62);
            ps.spawn(P.SPARK, tr.x, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.16, 0.34));
          }
          tears.splice(i, 1);
        } else if (tr.age >= tr.life) {
          tears.splice(i, 1);
        }
      }
      for (let i = burnHoles.length - 1; i >= 0; i--) {
        burnHoles[i].age += dt;
        if (burnHoles[i].age >= burnHoles[i].life) burnHoles.splice(i, 1);
      }

      // 2. Stage 3 Move: Cold ghost-green embers drifting off sinuous fluid water-drop tail
      if (t >= T_MOVE && t < T_ATK) {
        moveEmberAcc += dt * 16;
        while (moveEmberAcc >= 1) {
          moveEmberAcc -= 1;
          const sx = clamp(st.x - R.range(8, 34), X0 + 6, X1 - 6);
          ps.spawn(P.STAR, sx, st.y + R.range(-6, 6), -R.range(10, 26), -R.range(8, 26), R.range(0.26, 0.50), R.pick([G_PAL[5], G_PAL[6], WHITE]), R.range(0.6, 1.3));
        }
      }

      // 3. Stage 4 Attack: Instant dark-purple snap + 4 Sonic Shockwave Rings + Soul-Flame Explosion Hit!
      if (!snapFlashDone && t >= T_ATK + 0.06) {
        snapFlashDone = true;
        lights.add(X_ATK, Y_IDLE - 4, 56, R_PAL[5], 0.95, 0.32);
        for (let i = 0; i < 16; i++) {
          const a = R.range(0, TAU);
          const sp = R.range(45, 130);
          ragePs.spawn(P.SPARK, X_ATK, Y_IDLE - 4, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.18, 0.38));
        }
      }
      if (t >= T_ATK + 0.1 && t < T_POST_IDLE) {
        rageEmberAcc += dt * 22;
        while (rageEmberAcc >= 1) {
          rageEmberAcc -= 1;
          ragePs.spawn(P.STAR, st.x + R.range(-11, 11), st.y + R.range(-15, 5), R.range(-18, 18), -R.range(24, 58), R.range(0.22, 0.45), R.pick([R_PAL[5], R_PAL[6], WHITE]), R.range(0.7, 1.5));
        }
      }

      for (let w = 0; w < 4; w++) {
        const launchT = T_SONIC0 + w * T_SONIC_GAP;
        if (!wavesFired[w] && t >= launchT) {
          wavesFired[w] = true;
          sonicWaves.push({
            t0: launchT,
            life: 0.42,
            x0: X_ATK + 13,
            y0: Y_IDLE - 2,
            seed: w * 13 + o.seed,
          });
          lights.add(X_ATK + 13, Y_IDLE - 2, 36, R_PAL[5], 0.88, 0.20);
        }
        const hitT = launchT + 0.42;
        if (!wavesHit[w] && t >= hitT) {
          wavesHit[w] = true;
          const isFinal = w === 3;
          lights.add(X_HIT, Y_IDLE - 2, isFinal ? 90 : 48, R_PAL[5], isFinal ? 1.0 : 0.80, isFinal ? 0.48 : 0.25);
          lights.add(X_HIT, Y_IDLE - 2, isFinal ? 40 : 22, WHITE, 0.94, 0.14);

          const countFlames = isFinal ? 16 : 6;
          for (let k = 0; k < countFlames; k++) {
            const ang = (k / countFlames) * TAU + R.range(-0.22, 0.22);
            const spd = R.range(isFinal ? 52 : 36, isFinal ? 138 : 88);
            soulFlames.push({
              x: X_HIT + Math.cos(ang) * 4,
              y: Y_IDLE - 2 + Math.sin(ang) * 4,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd - R.range(14, 38),
              r: R.range(3.2, isFinal ? 5.8 : 4.2),
              life: R.range(0.48, isFinal ? 0.98 : 0.65),
              age: 0,
              teal: k % 3 === 0,
              pts: [],
              seed: R.range(0, 100),
            });
          }
          for (let k = 0; k < (isFinal ? 28 : 10); k++) {
            const ang = R.range(0, TAU);
            const sp = R.range(60, isFinal ? 205 : 125);
            ragePs.spawn(P.SPARK, X_HIT, Y_IDLE - 2, Math.cos(ang) * sp, Math.sin(ang) * sp, R.range(0.20, 0.48));
          }
        }
      }

      for (let i = soulFlames.length - 1; i >= 0; i--) {
        const sf = soulFlames[i];
        sf.age += dt;
        sf.vy -= 50 * dt;
        sf.vx *= 1 - 2.5 * dt;
        sf.vy *= 1 - 1.4 * dt;
        sf.x += (sf.vx + Math.sin(sf.age * 11 + sf.seed) * 15) * dt;
        sf.y += sf.vy * dt;
        if (sf.y > -2) { sf.y = -2; sf.vy = -Math.abs(sf.vy) * 0.4; }
        sf.pts.push([sf.x, sf.y]);
        if (sf.pts.length > 10) sf.pts.shift();
        if (sf.age >= sf.life || sf.x > X1 - 6 || sf.y < Y0 + 8) soulFlames.splice(i, 1);
      }

      // 4. Stage 5 KO: Wind gale streaks (`狂风吹灭蜡烛`) & Graceful Long Curving S-Smoke Plume (`一缕青烟消散`)!
      if (t >= T_KO && t < T_POOF) {
        windAcc += dt * 20;
        while (windAcc >= 1) {
          windAcc -= 1;
          windStreaks.push({
            x: Math.max(X0 + 8, X_ATK - 64 + R.range(-8, 10)),
            y: Y_IDLE + R.range(-30, 16),
            vx: R.range(145, 230),
            len: R.range(20, 34),
            life: R.range(0.28, 0.46),
            age: 0,
          });
        }
      }
      for (let i = windStreaks.length - 1; i >= 0; i--) {
        const ws = windStreaks[i];
        ws.age += dt;
        ws.x += ws.vx * dt;
        if (ws.age >= ws.life || ws.x + ws.len > X1 - 6) windStreaks.splice(i, 1);
      }

      if (!koSmokeSpawned && t >= T_POOF) {
        koSmokeSpawned = true;
        lights.add(X_ATK + 24, Y_IDLE - 10, 32, G_PAL[5], 0.84, 0.16);
        for (let k = 0; k < 12; k++) {
          const a = R.range(-1.4, 1.2);
          const sp = R.range(28, 86);
          ps.spawn(P.SPARK, X_ATK + 24, Y_IDLE - 10, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.14, 0.28));
        }
        for (let i = 0; i < 28; i++) {
          const u = i / 27;
          const dly = u * 0.22;
          const lf = clamp(T_END - 0.04 - t - dly, 0.26, 0.74);
          koSmokeRibbon.push({
            x: X_ATK + 24 + Math.sin(u * 5.2) * 4.8 + u * 10,
            y: Y_IDLE - 10 - u * 30,
            delay: dly,
            age: 0,
            life: lf,
            r: lerp(4.0, 1.2, u),
            ph: u * 6.5,
          });
        }
      }
      for (let i = koSmokeRibbon.length - 1; i >= 0; i--) {
        const kr = koSmokeRibbon[i];
        if (kr.delay > 0) { kr.delay -= dt; continue; }
        kr.age += dt;
        kr.x += (16 + Math.sin(kr.age * 8 + kr.ph) * 20) * dt;
        kr.y -= 44 * dt;
        if (kr.age >= kr.life || kr.y < Y0 + 6 || kr.x > X1 - 6) koSmokeRibbon.splice(i, 1);
      }

      ps.update(dt);
      ragePs.update(dt);
      cullParticles(ps, X0, Y0, X1, Y1);
      cullParticles(ragePs, X0, Y0, X1, Y1);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.03) return;
      const st = stateAt(t);
      const C = st.rageMix > 0 ? G_PAL.map((gc, i) => mix(gc, R_PAL[i], st.rageMix)) : G_PAL;

      if (st.poseMode !== "gone") {
        shadow(p, st.x, 0.5, 17 * st.scale, 2.3, C[0], 0.45 * clamp(st.scale) * st.koFade);
        p.glow(st.x, 0, 30 * st.scale, C[3], 0.28 * clamp(st.scale) * st.koFade);
      }

      for (const bh of burnHoles) {
        const u = bh.age / bh.life;
        const fade = Math.min(1, u * 10) * (1 - smooth(0.65, 1.0, u));
        const ry = bh.rx * 0.34;
        p.ellipse(bh.x, 0.5, bh.rx + 1, ry + 0.5, G_PAL[3], 0.80 * fade);
        p.ellipse(bh.x, 0.5, bh.rx * 0.72, ry * 0.72, G_PAL[0], 0.94 * fade);
        if (u < 0.35) p.px(Math.round(bh.x), 0, G_PAL[5]);
        p.glow(bh.x, 0, bh.rx * 2.4, G_PAL[4], 0.34 * fade);
      }

      ps.draw(p, "back");
      ragePs.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.03) return;
      const st = stateAt(t);
      const C = st.rageMix > 0 ? G_PAL.map((gc, i) => mix(gc, R_PAL[i], st.rageMix)) : G_PAL;

      // 1. Stage 5 wind gale streaks
      for (const ws of windStreaks) {
        const u = ws.age / ws.life;
        const a = Math.sin(u * Math.PI) * 0.62;
        for (let k = 0; k < 14; k++) {
          const f = k / 13;
          const wx = ws.x + f * ws.len;
          const wy = ws.y + Math.sin(ws.age * 16 + f * 3) * 2.2;
          if (wx < X0 + 2 || wx > X1 - 2) continue;
          p.blend(wx, wy, f > 0.6 ? S_PAL[4] : S_PAL[2], a * Math.sin(f * Math.PI));
        }
      }

      // 2. Stage 2A fiery green spark-tears flying outward (`大颗绿色火星眼泪`)
      for (const tr of tears) {
        for (let k = 1; k < tr.pts.length; k++) {
          p.line(tr.pts[k - 1][0], tr.pts[k - 1][1], tr.pts[k][0], tr.pts[k][1], G_PAL[4]);
        }
        p.circle(tr.x, tr.y, tr.r + 0.6, G_PAL[4]);
        p.circle(tr.x, tr.y, tr.r * 0.55, WHITE);
        p.glow(tr.x, tr.y, tr.r * 3.2, G_PAL[5], 0.52);
      }

      // 3. Stage 2B sneaky giggle puff sparks (`捂嘴偷笑`)
      if (st.poseMode === "peek") {
        for (let k = 0; k < 2; k++) {
          const ph = (t * 2.4 + k * 0.5) % 1;
          const gx = st.x - 10 - ph * 6;
          const gy = st.y - 3 - ph * 11;
          const ga = Math.sin(ph * Math.PI) * 0.85;
          p.disc(gx, gy, 1.4, k === 0 ? WHITE : G_PAL[5], ga);
        }
      }

      // 4. Unified smooth fluid liquid-water-drop ghostfire body & slender willow-leaf hands
      drawFluidGhostBody(p, st, C, t, o.seed, X0);

      // 5. Stage 4 instant mood-snap flare
      if (t >= T_ATK + 0.04 && t < T_ATK + 0.22) {
        const fu = (t - (T_ATK + 0.04)) / 0.18;
        flare(p, X_ATK, Y_IDLE - 4, 38 * (1 - fu), 1 - fu, [R_PAL[2], R_PAL[4], R_PAL[6], WHITE]);
      }

      // 6. Stage 4 Sonic Shockwave Rings + Warped Air Distortion
      for (const w of sonicWaves) drawSonicRing(p, w, R_PAL, t);

      // 7. Stage 4 Hit Result: Soul-Flame Sprouts & Ribbons
      for (let w = 0; w < 4; w++) {
        const hitT = T_SONIC0 + w * T_SONIC_GAP + 0.42;
        if (t >= hitT && t < hitT + 0.24) {
          const hu = (t - hitT) / 0.24;
          const isFinal = w === 3;
          flare(p, X_HIT, Y_IDLE - 2, (isFinal ? 52 : 26) * (1 - hu), 1 - hu, [R_PAL[2], R_PAL[4], R_PAL[6], WHITE]);
          const rr = 5 + ease.outCubic(hu) * (isFinal ? 36 : 19);
          const steps = Math.ceil(rr * 3);
          for (let i = 0; i < steps; i++) {
            const a = (i / steps) * TAU;
            p.blend(X_HIT + Math.cos(a) * rr, Y_IDLE - 2 + Math.sin(a) * rr, hu < 0.35 ? WHITE : R_PAL[5], (1 - hu) * 0.85);
          }
        }
      }
      for (const sf of soulFlames) {
        const u = sf.age / sf.life;
        const fade = Math.min(1, u * 8) * (1 - u * u);
        const pal = sf.teal ? G_PAL : R_PAL;
        for (let k = 1; k < sf.pts.length; k++) {
          const pu = k / sf.pts.length;
          p.blend(sf.pts[k][0], sf.pts[k][1], pu > 0.65 ? pal[6] : pal[4], pu * fade * 0.92);
          p.blend(sf.pts[k][0] + 0.7, sf.pts[k][1] + 0.7, pal[3], pu * fade * 0.70);
        }
        const rad = sf.r * (1 - u * 0.45);
        const wag = Math.sin(sf.age * 22 + sf.seed) * rad * 0.35;
        p.disc(sf.x, sf.y, rad + 1.1, pal[3], 0.84 * fade);
        p.disc(sf.x + wag * 0.4, sf.y - rad * 0.75, rad * 0.72, pal[4], 0.88 * fade);
        p.disc(sf.x + wag * 0.8, sf.y - rad * 1.45, rad * 0.44, pal[5], 0.90 * fade);
        p.disc(sf.x, sf.y - rad * 0.1, rad * 0.54, u < 0.35 ? WHITE : pal[6], 0.96 * fade);
        p.glow(sf.x, sf.y, rad * 3.2, pal[5], 0.54 * fade);
      }

      // 8. Stage 5 Candle-Extinguish POOF Flash + Tall Graceful S-Curved Wisp of Smoke (`一缕青烟消散`)!
      if (t >= T_POOF && t < T_POOF + 0.16) {
        const pu = (t - T_POOF) / 0.16;
        sparkle(p, X_ATK + 24, Y_IDLE - 10, 9 * (1 - pu), WHITE, G_PAL[5], 1 - pu);
      }
      for (const kr of koSmokeRibbon) {
        if (kr.delay > 0) continue;
        const u = kr.age / kr.life;
        const a = Math.min(1, u * 8) * Math.pow(1 - u, 1.25) * 0.76;
        if (a <= 0.02) continue;
        const rad = kr.r * (0.75 + u * 1.15);
        p.disc(kr.x, kr.y, rad, mix(S_PAL[2], S_PAL[3], 1 - u), a);
        p.disc(kr.x - rad * 0.25, kr.y - rad * 0.25, rad * 0.55, S_PAL[4], a * 0.55);
      }

      ps.draw(p, "front");
      ragePs.draw(p, "front");
      lights.draw(p);
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
