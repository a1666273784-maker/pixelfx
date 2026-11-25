// Magma body crust/veins, boiling lava pools, fireball comet tails, and ash collapse build on
// ../fire/lava-boulder.js, ../fire/fireball.js, ../fire/_lib.js, ../explosions/small-explosion.js,
// ../status/sleep.js, and ../status/petrified.js (adapted from Sprite Fusion's open-source VFX, MIT License, Copyright (c) 2026 Hugo Duprez).
import {
  Particles,
  Bits,
  Lights,
  P,
  B,
  Rng,
  fit,
  band,
  flare,
  clamp,
  smooth,
  seg,
  ease,
  lerp,
  rand,
  noise,
  tileFbm,
  TAU,
  WHITE,
  mix,
} from "../../core/index.js";
import { Grid, shadow } from "./_lib.js";
import { hotFirst, flameTongue, flameBlade, simDraw, floorLight, LAYERS } from "../fire/_lib.js";
import { spikes, star, frontCrescent } from "../impacts/_lib.js";

export const meta = {
  name: "Lava slug",
  desc: "A drowsy magma slug blows and pops a lava snot-bubble, inchworms forward leaving smoking scorch, swells red to spit arcing fireballs, catches its breath, then cools to ash.",
  tags: ["critter", "monster", "lava", "slug", "fire", "fireball", "cute", "one-shot"],
  size: [308, 168],
  origin: [138, 134],
  duration: 12.0,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    // 8-step Incandescent Magma & Solar Fire ramp (deep crimson -> scarlet -> bright orange -> yellow-white)
    palette: ["#3a0a06", "#781409", "#b8240c", "#e84410", "#ff761a", "#ffae34", "#ffe478", "#ffffff"],
    // 6-step Charcoal Stone & Pale Ash ramp (avoiding pure-black dither noise!)
    crust: ["#24202b", "#383342", "#504a5c", "#6e687c", "#908a9e", "#b8b2c6"],
    // 4-step Cyan-Slate Volcanic Smoke ("青烟") ramp
    smoke: ["#3c5268", "#54708a", "#7292ad", "#9ebbd4"],
    seed: 7,
  },
};

// 5-Stage Choreography + Post-Attack Idle Buffer Timeline (12.00s total):
// 0.00..1.95  【待机 Idle】               3 lazy breathing cycles; semi-fluid magma, orange heatwaves, bobbing antennae, sleepy Zs
// 1.95..4.20  【生态小动作 Quirk】        Blows a giant fiery red magma snot-bubble -> POP! -> startled leap & shudder -> flops back asleep
// 4.20..6.35  【移动 Move】               4 full caterpillar inchworm arch-lunge crawl cycles rightward, leaving hot scorched smoking trail
// 6.35..8.65  【攻击 Attack】             Rears back & swells into crimson-red orb -> opens wide maw -> spits 4 arcing fireballs -> lava pool
// 8.65..9.85  【攻击后待机缓冲 IdleBuf】  Smoothly settles back into 2 calm idle breathing cycles while the lava pool boils nearby
// 9.85..12.00 【倒地 KO】                 Internal fire extinguishes -> hardens to charcoal stone -> cracks & shatters into wind-blown ash
const T_QUIRK = 1.95;
const T_BUB_POP = 3.28;
const T_JOLT_END = 3.80;
const T_MOVE = 4.20;
const T_CRAWL_START = 4.34;
const T_CRAWL_END = 6.26;
const T_ATK = 6.35;
const T_SPIT_START = 7.10;
const T_POST_IDLE = 8.65;
const T_KO = 9.85;
const T_HARDEN = 10.36;
const T_SHATTER = 10.74;
const T_END = meta.duration;

const X_IDLE = -88;
const X_ATK = -22;
const X_POOL = 76;

const FIREBALL_SHOTS = [
  { tFire: 7.12, flight: 0.52, tx: 54, ty: 0, apex: 92, rPool: 17 },
  { tFire: 7.33, flight: 0.56, tx: 78, ty: 0, apex: 102, rPool: 20 },
  { tFire: 7.54, flight: 0.52, tx: 65, ty: 0, apex: 88, rPool: 18 },
  { tFire: 7.75, flight: 0.58, tx: 94, ty: 0, apex: 96, rPool: 19 },
];

const Z_GLYPH = [
  [1, 1, 1, 1],
  [0, 0, 1, 0],
  [0, 1, 0, 0],
  [1, 1, 1, 1],
];
const BANG_GLYPH = [
  [1, 1],
  [1, 1],
  [1, 1],
  [0, 0],
  [1, 1],
];

function drawGlyph(p, g, cx, cy, col, rim, a = 1) {
  const h = g.length, w = g[0].length;
  const ox = Math.round(cx - w * 0.5), oy = Math.round(cy - h * 0.5);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!g[y][x]) continue;
      p.blend(ox + x, oy + y + 1, rim, a * 0.72);
      p.blend(ox + x, oy + y, col, a);
    }
  }
}

// Articulated 5-control-point spine evaluator across all 5 states + post-attack idle buffer
function slugPoseAt(t) {
  let xTail = X_IDLE - 18;
  let xHead = X_IDLE + 18;
  let archH = 0;
  let bodyThick = 15.8;
  let swell = 0;
  let rearAngle = 0;
  let startle = 0;
  let shudderJolt = 0;
  let mouthOpen = 0;
  let antBob = 0;
  let antAlert = 0;
  let bubbleR = 0;
  let bubblePop = false;
  let fireHeat = 1.0;
  let stoneLv = 0;
  let crackLv = 0;
  let ashErode = 0;
  let eyeMode = "sleep";
  let crawlDist = 0;

  if (t < T_QUIRK) {
    // STAGE 1: 【待机时 IDLE (0.00..1.95s)】 — 3 slow lazy breaths + bobbing glowing antennae
    const spawnK = ease.outBack(clamp(t / 0.20), 1.25);
    const breath = Math.sin((t / T_QUIRK) * TAU * 3.0);
    xTail = lerp(X_IDLE - 10, X_IDLE - 18.5 - breath * 1.1, spawnK);
    xHead = lerp(X_IDLE + 10, X_IDLE + 18.5 + breath * 1.2, spawnK);
    bodyThick = (15.6 + breath * 1.75) * (0.85 + 0.15 * spawnK);
    antBob = breath * 2.9;
    antAlert = 0.08 + 0.14 * breath;
    eyeMode = "sleep";
  } else if (t < T_MOVE) {
    // STAGE 2: 【生态小动作 QUIRK (1.95..4.20s)】 — Giant fiery snot-bubble -> POP -> startled leap & tremor -> flop asleep
    if (t < T_BUB_POP) {
      const u = seg(t, T_QUIRK, T_BUB_POP);
      const puffCycle = (u * 3.0) % 1;
      const inhale = Math.sin(u * TAU * 3.0);
      const baseGrowth = ease.outQuad(clamp(u / 0.94));
      bubbleR = (2.8 + 12.6 * baseGrowth) * (0.92 + 0.08 * Math.sin(puffCycle * Math.PI));
      xTail = X_IDLE - 18.5 + inhale * 0.9;
      xHead = X_IDLE + 18.5 - inhale * 1.4;
      bodyThick = 15.4 - 1.5 * baseGrowth + inhale * 1.3;
      antBob = inhale * 2.6 - baseGrowth * 1.4;
      antAlert = 0.05;
      eyeMode = "sleep";
    } else if (t < T_JOLT_END) {
      bubblePop = true;
      const age = t - T_BUB_POP;
      const joltEnv = Math.exp(-age * 3.3);
      const hop = age < 0.28 ? Math.sin((age / 0.28) * Math.PI) * 12.5 : 0;
      const shudder = Math.sin(age * 104) * 2.8 * joltEnv;
      startle = clamp(1 - age / 0.52);
      shudderJolt = joltEnv;
      xTail = X_IDLE - 15.0 + shudder;
      xHead = X_IDLE + 14.0 + shudder;
      archH = hop;
      bodyThick = 19.0 * (1 - 0.12 * clamp(age / 0.46)) + Math.sin(age * 58) * 1.3;
      rearAngle = -0.46 * joltEnv;
      antBob = -4.6 * joltEnv;
      antAlert = 1.0 * joltEnv;
      eyeMode = age < 0.44 ? "shock" : "sleep";
    } else {
      const u = seg(t, T_JOLT_END, T_MOVE);
      const flop = ease.outBack(clamp(u / 0.52), 1.45);
      const sigh = Math.sin(clamp((u - 0.35) / 0.65) * Math.PI);
      xTail = lerp(X_IDLE - 15.5, X_IDLE - 19.5, flop);
      xHead = lerp(X_IDLE + 14.5, X_IDLE + 19.5, flop);
      bodyThick = lerp(16.4, 13.8, flop) - sigh * 1.1;
      antBob = lerp(-1.2, 2.0, flop);
      antAlert = lerp(0.28, 0.04, flop);
      eyeMode = "sleep";
    }
  } else if (t < T_ATK) {
    // STAGE 3: 【移动时 MOVE (4.20..6.35s)】 — 4 rhythmic caterpillar inchworm crawl cycles!
    eyeMode = "crawl";
    if (t < T_CRAWL_START) {
      const u = seg(t, T_MOVE, T_CRAWL_START);
      xTail = lerp(X_IDLE - 19.5, X_IDLE - 17, u);
      xHead = lerp(X_IDLE + 19.5, X_IDLE + 16, u);
      bodyThick = lerp(13.8, 15.8, u);
      antAlert = lerp(0.05, 0.75, u);
      antBob = -1.4 * u;
    } else if (t < T_CRAWL_END) {
      const N_STRIDES = 4;
      const totalU = seg(t, T_CRAWL_START, T_CRAWL_END);
      const strideF = totalU * N_STRIDES;
      const idx = Math.min(N_STRIDES - 1, Math.floor(strideF));
      const pStride = strideF - idx;
      const stepDist = (X_ATK - X_IDLE) / N_STRIDES;

      let tailProg, headProg, archCurve;
      if (pStride < 0.52) {
        const q = ease.inOutSine(pStride / 0.52);
        tailProg = idx + q;
        headProg = idx;
        archCurve = Math.sin(q * Math.PI);
      } else {
        const q = ease.inOutSine((pStride - 0.52) / 0.48);
        tailProg = idx + 1;
        headProg = idx + q;
        archCurve = Math.sin((1 - q) * Math.PI * 0.5) * 0.22;
      }

      const cxTail = X_IDLE + tailProg * stepDist;
      const cxHead = X_IDLE + headProg * stepDist;
      xTail = cxTail - 16.5;
      xHead = cxHead + 16.5;
      archH = 12.2 * archCurve;
      bodyThick = 14.2 + 2.5 * archCurve;
      antAlert = 0.80;
      antBob = -2.2 * archCurve + 0.9 * Math.sin(pStride * TAU);
      crawlDist = clamp((cxTail - X_IDLE) / (X_ATK - X_IDLE));
    } else {
      const u = seg(t, T_CRAWL_END, T_ATK);
      xTail = lerp(X_ATK - 16.5, X_ATK - 18, u);
      xHead = lerp(X_ATK + 16.5, X_ATK + 17, u);
      bodyThick = lerp(14.6, 16.0, u);
      antAlert = 0.88;
      crawlDist = 1;
    }
  } else if (t < T_POST_IDLE) {
    // STAGE 4: 【攻击时 ATTACK (6.35..8.65s)】 — Rears backward & swells into crimson-red sphere -> opens wide maw -> spits 4 arcing fireballs!
    crawlDist = 1;
    eyeMode = "glare";
    if (t < T_SPIT_START) {
      const u = seg(t, T_ATK, T_SPIT_START);
      const swellEase = ease.outBack(clamp(u / 0.85), 1.35);
      const tremor = Math.sin(t * 92) * 1.15 * u;
      swell = clamp(swellEase);
      xTail = X_ATK - 16.0 - 3.5 * swell + tremor * 0.5;
      xHead = X_ATK + 14.5 - 7.5 * swell + tremor * 0.5;
      bodyThick = lerp(16.0, 29.0, swell) + 0.9 * Math.sin(t * 48);
      rearAngle = -0.84 * swell;
      fireHeat = 1.0 + 0.42 * swell;
      antAlert = 1.0;
      antBob = -3.4 * swell;
    } else {
      const settle = seg(t, 8.05, T_POST_IDLE);
      let recoilKick = 0;
      let localMouth = 0;
      for (const sh of FIREBALL_SHOTS) {
        const dtS = t - sh.tFire;
        if (dtS >= -0.05 && dtS < 0.22) {
          const mEnv = dtS < 0 ? 1 + dtS / 0.05 : Math.exp(-dtS * 8.5);
          localMouth = Math.max(localMouth, mEnv);
          if (dtS >= 0) recoilKick = Math.max(recoilKick, Math.exp(-dtS * 12));
        }
      }
      const lungeSnap = ease.outBack(clamp((t - T_SPIT_START) / 0.14), 1.6);
      swell = Math.max(0, 1 - clamp((t - T_SPIT_START) / 0.48)) * (1 - settle);
      xTail = X_ATK - 19.5 - 3.4 * recoilKick + 1.5 * settle;
      xHead = lerp(X_ATK + 18.0 * lungeSnap - 4.4 * recoilKick, X_ATK + 18.5, settle);
      bodyThick = lerp(25.5, 16.0, clamp((t - T_SPIT_START) / 0.58)) - 2.2 * recoilKick;
      rearAngle = lerp(-0.84, 0.44, lungeSnap) * (1 - settle) - 0.22 * recoilKick * (1 - settle);
      mouthOpen = Math.max(localMouth, 0.65 * (1 - clamp((t - 7.92) / 0.28))) * (1 - settle);
      fireHeat = lerp(1.38, 1.0, settle);
      antAlert = lerp(0.95, 0.25, settle);
      antBob = lerp(-2.2 + 1.8 * recoilKick, 0.0, settle);
    }
  } else if (t < T_KO) {
    // STAGE 4.5: 【攻击后待机缓冲 POST-ATTACK IDLE BUFFER (8.65..9.85s, 1.20s)】
    // Slug settles into 2 calm lazy breathing cycles & bobbing antennae while admiring its boiling lava pool before cooling!
    crawlDist = 1;
    const u = seg(t, T_POST_IDLE, T_KO);
    const breath = Math.sin(u * TAU * 2.0);
    xTail = X_ATK - 18.0 - breath * 1.1;
    xHead = X_ATK + 18.5 + breath * 1.2;
    bodyThick = 15.8 + breath * 1.65;
    antBob = breath * 2.4;
    antAlert = 0.22 + 0.12 * breath;
    eyeMode = u > 0.45 ? "sleep" : "crawl";
  } else {
    // STAGE 5: 【倒地时 KO (9.85..12.00s)】 — Fire extinguishes -> cools/hardens into charcoal stone -> cracks & shatters into wind-blown ash!
    crawlDist = 1;
    eyeMode = "dead";
    const koAge = t - T_KO;
    fireHeat = Math.max(0, 1 - koAge / 0.08);
    stoneLv = smooth(T_KO + 0.03, T_HARDEN, t);
    crackLv = smooth(T_HARDEN - 0.06, T_SHATTER, t);
    ashErode = smooth(T_SHATTER, T_END - 0.12, t);

    const slump = ease.inQuad(clamp(koAge / 0.32));
    const shudder = t >= T_HARDEN && t < T_SHATTER ? Math.sin(t * 98) * 1.2 * crackLv : 0;
    xTail = X_ATK - 17.5 + slump * 1.2 + shudder;
    xHead = X_ATK + 17.5 - slump * 1.8 + shudder;
    bodyThick = lerp(16.0, 15.4, slump);
    rearAngle = 0;
    antAlert = lerp(0.22, -0.95, clamp(koAge / 0.24));
    antBob = lerp(0, 5.4, clamp(koAge / 0.24));
  }

  return {
    xTail,
    xHead,
    archH,
    bodyThick,
    swell,
    rearAngle,
    startle,
    shudderJolt,
    mouthOpen,
    antBob,
    antAlert,
    bubbleR,
    bubblePop,
    fireHeat,
    stoneLv,
    crackLv,
    ashErode,
    eyeMode,
    crawlDist,
  };
}

function evalSpine(st) {
  const { xTail, xHead, archH, bodyThick, swell, rearAngle, startle } = st;
  const pts = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    let px = lerp(xTail, xHead, u);
    const archBell = Math.sin(u * Math.PI);
    const baseH = -archH * (startle > 0.05 ? 0.8 + 0.25 * u : archBell * archBell);

    const pivotU = Math.max(0, u - 0.26) / 0.74;
    const rearLift = -rearAngle * pivotU * 21.0;
    const rearPullX = rearAngle < 0 ? rearAngle * pivotU * 11.5 : rearAngle * pivotU * 4.5;
    px += rearPullX;

    const profile =
      swell > 0.05
        ? lerp(0.65 + 0.55 * Math.sin(u * Math.PI * 0.92), 1.0, swell * 0.78)
        : 0.44 + 0.70 * Math.sin(Math.pow(u, 0.78) * Math.PI * 0.90);
    const r = bodyThick * 0.52 * profile * (1 + 0.24 * swell);
    const py = Math.min(-r * 0.78, baseH + rearLift - r * 0.78);
    pts.push({ x: px, y: py, r, u });
  }
  return pts;
}

function drawLavaSlug(g, p, st, F, S, cracks, seed, t) {
  g.clear();
  if (st.ashErode >= 0.995) return { snoutX: st.xHead, snoutY: -6, headX: st.xHead, headY: -6, tailX: st.xTail };

  const spine = evalSpine(st);
  const head = spine[4];

  let bx0 = 999, by0 = 999, bx1 = -999, by1 = -999;
  for (const nd of spine) {
    bx0 = Math.min(bx0, nd.x - nd.r - 10);
    bx1 = Math.max(bx1, nd.x + nd.r + 14);
    by0 = Math.min(by0, nd.y - nd.r - 18);
    by1 = Math.max(by1, nd.y + nd.r + 4);
  }
  by1 = Math.min(1, by1);

  const nCells = g.w * g.h;
  if (!g._tagD || g._tagD.length !== nCells) {
    g._tagD = new Float32Array(nCells);
    g._nx = new Float32Array(nCells);
    g._ny = new Float32Array(nCells);
    g._u = new Float32Array(nCells);
  }

  g.shade(bx0, by0, bx1, by1, (wx, wy, out) => {
    const px = wx + 0.5;
    const py = wy + 0.5;
    if (py > 0.45) return 0;

    // Organic jagged rock crumble erosion (`st.ashErode > 0`) — breaks into irregular rock shards, NO checkerboard Bayer grid!
    if (st.ashErode > 0) {
      const nBig = tileFbm(px * 0.24, py * 0.24, 0, 0, seed + 17, 2);
      const nFine = tileFbm(px * 0.58 + 3.1, py * 0.58 - 1.7, 0, 0, seed + 29, 2);
      const mottle = 0.34 * nBig + 0.16 * nFine;
      const xNorm = clamp((px - (st.xTail - 6)) / Math.max(12, st.xHead - st.xTail + 14));
      const yNorm = clamp(1 + py / 28);
      const wave = st.ashErode * 1.48 - xNorm * 0.22 - (1 - yNorm) * 0.12 + mottle;
      if (wave > 0.52) return 0;
    }

    if (st.mouthOpen > 0.12) {
      const mx = head.x + head.r * 0.56;
      const my = head.y - head.r * 0.02;
      const dx = (px - mx) * 0.85 - (py - my) * 0.38;
      const dy = (px - mx) * 0.38 + (py - my) * 0.85;
      const md = Math.hypot(dx / (head.r * 0.68 * st.mouthOpen + 1.5), dy / (head.r * 0.54 * st.mouthOpen + 1.5));
      if (md < 0.96) {
        out.t = 3;
        out.a = 1;
        return md < 0.42 ? WHITE : md < 0.72 ? F[6] : F[4];
      }
    }

    let field = 0;
    let bestD = 99;
    let bestNx = 0;
    let bestNy = -1;
    let bestU = 0.5;

    for (let i = 0; i < 9; i++) {
      const fIdx = (i / 8) * 4;
      const i0 = Math.floor(fIdx);
      const i1 = Math.min(4, i0 + 1);
      const fr = fIdx - i0;
      const sx = lerp(spine[i0].x, spine[i1].x, fr);
      const sy = lerp(spine[i0].y, spine[i1].y, fr);
      let sr = lerp(spine[i0].r, spine[i1].r, fr);

      if (st.stoneLv > 0.15) {
        const ang = Math.atan2(py - sy, px - sx);
        const facet = 0.94 + 0.13 * Math.sin(ang * 5 + i + seed) + 0.08 * Math.cos(ang * 9 - seed);
        sr *= lerp(1, facet, st.stoneLv);
      }

      const dx = (px - sx) / sr;
      const dy = (py - sy) / sr;
      const d2 = dx * dx + dy * dy;
      if (d2 < 2.2) {
        const s = Math.max(0, 1.22 - Math.sqrt(d2));
        field += s * s * 0.95;
      }
      if (d2 < bestD) {
        bestD = d2;
        bestNx = dx;
        bestNy = dy;
        bestU = lerp(spine[i0].u, spine[i1].u, fr);
      }
    }

    if (field < 0.24) return 0;

    const idx = g.idx(wx, wy);
    if (idx >= 0) {
      const nl = Math.hypot(bestNx, bestNy) || 1;
      g._nx[idx] = bestNx / nl;
      g._ny[idx] = bestNy / nl;
      g._tagD[idx] = clamp(Math.sqrt(bestD));
      g._u[idx] = bestU;
    }

    out.t = 1;
    out.a = 1;
    return F[3];
  });

  g.depths(4);

  g.recolor((wx, wy, col, al, tag) => {
    if (tag === 3) return col;
    if (tag !== 1) return col;
    const idx = g.idx(wx, wy);
    const d = g.depth(wx, wy);
    const nx = g._nx[idx];
    const ny = g._ny[idx];
    const q = g._tagD[idx];
    const uSpine = g._u[idx];
    const px = wx + 0.5;
    const py = wy + 0.5;
    const lit = -0.52 * nx - 0.78 * ny;

    // HARDENED CHARCOAL STONE (`黑灰色的焦炭石头`): during erosion, brighten outline & pores cleanly so crumbling edges stay grey ash, NOT black specks!
    if (st.stoneLv > 0.85) {
      if (d === 1) return st.ashErode > 0.02 ? S[2] : S[0];
      const crag = 0.18 * tileFbm(px * 0.42, py * 0.42, 0, 0, seed + 11, 2);
      const qLit = Math.round((lit * 0.58 + 0.48 + crag) * 4.4);
      if (st.ashErode <= 0.02 && rand(wx, wy, seed + 3) > 0.92 && d >= 2) return S[1];
      return S[clamp(qLit, st.ashErode > 0.02 ? 2 : 1, 5)];
    }

    if (d === 1 && !(st.swell > 0.05 && st.fireHeat > 0.7)) {
      return st.fireHeat < 0.35 ? S[0] : (lit > 0.3 ? F[2] : F[0]);
    }

    const flow = t * 1.85;
    const m1 = tileFbm(px * 0.22 - flow * 0.4, py * 0.24 - flow * 0.25, 0, 0, seed + 5, 2);
    const m2 = Math.sin(px * 0.36 + py * 0.28 - t * 3.6 + m1 * 4.5);
    const coreGlow = (1 - q * 0.58) * (0.68 + 0.32 * m2) * st.fireHeat + (uSpine > 0.7 ? 0.10 : 0);

    let cMagma;
    if (d === 1) cMagma = st.fireHeat < 0.35 ? S[0] : (lit > 0.3 ? F[2] : F[0]);
    else if (coreGlow > 0.88) cMagma = F[6];
    else if (coreGlow > 0.66) cMagma = F[5];
    else if (coreGlow > 0.46) cMagma = F[4];
    else if (coreGlow > 0.30) cMagma = F[3];
    else if (coreGlow > 0.17) cMagma = F[2];
    else cMagma = F[1];

    if (d === 2 && lit > 0.48 && ny < -0.35 && st.fireHeat > 0.5) cMagma = F[6];
    // Warm dark-crimson basalt plates while alive — NO cold black speckles on the magma body!
    if (d >= 2 && m1 < -0.24 && ny < -0.1 && st.fireHeat > 0.3) {
      cMagma = m1 < -0.36 ? F[0] : F[1];
    }

    if (st.swell > 0.05 && st.fireHeat > 0.7) {
      const mSw = tileFbm(px * 0.25 - t * 2.4, py * 0.25 - t * 1.8, 0, 0, seed + 9, 2);
      const redPulse = 0.5 + 0.5 * Math.sin(px * 0.34 + py * 0.26 - t * 9.0 + mSw * 4.2);
      const redCore = (1 - q * 0.42) * (0.58 + 0.42 * redPulse);
      let cRed = redCore > 0.86 && mSw > 0.14 ? F[6] : redCore > 0.65 ? F[4] : redCore > 0.42 ? F[3] : F[2];
      if (d === 1) cRed = lit > 0.2 ? F[4] : F[1];
      else if (d === 2 && lit > 0.52 && ny < -0.3) cRed = F[6];
      return mix(cMagma, cRed, clamp(st.swell));
    }

    if (st.stoneLv <= 0.02) return cMagma;
    const coolMask = st.stoneLv * 1.45 - (1 - q) * 0.35 + m1 * 0.15;
    if (coolMask > 0.50) {
      const qLit = Math.round((lit * 0.55 + 0.48) * 4.0);
      return S[clamp(qLit, 1, 4)];
    }
    if (coolMask > 0.32) return mix(cMagma, S[2], (coolMask - 0.32) / 0.18);
    return cMagma;
  });

  if (st.crackLv > 0.05 && st.ashErode < 0.18) {
    const centerX = (head.x + spine[1].x) * 0.5;
    const centerY = (head.y + spine[1].y) * 0.5;
    for (const cr of cracks) {
      const n = Math.max(1, Math.floor((cr.length - 1) * st.crackLv));
      for (let i = 0; i < n; i++) {
        const px = Math.round(centerX + cr[i][0]);
        const py = Math.round(centerY + cr[i][1]);
        const idx = g.idx(px, py);
        if (idx >= 0 && g.c[idx]) {
          g.set(px, py, S[1]);
          if (i === n - 1 && st.crackLv < 0.92) g.set(px, py - 1, S[4]);
        }
      }
    }
  }

  const antRoots = [
    { ox: -1.5, oy: -head.r * 0.82, dx: -5.5, len: 8.8, phase: 0.0 },
    { ox: 3.5, oy: -head.r * 0.78, dx: 4.5, len: 9.5, phase: 0.68 },
  ];
  const bulbPos = [];
  for (let aIdx = 0; aIdx < antRoots.length; aIdx++) {
    const ar = antRoots[aIdx];
    const rx = head.x + ar.ox - st.rearAngle * 4;
    const ry = head.y + ar.oy;
    const bobWave = Math.sin(t * 3.4 + ar.phase) * (st.eyeMode === "sleep" ? 2.1 : 0.75);
    const tipDx = ar.dx * (1 - 0.35 * clamp(st.antAlert)) - st.rearAngle * 7;
    const tipDy = lerp(-ar.len * 0.60, -ar.len * 1.28, clamp((st.antAlert + 1) * 0.5)) + st.antBob + bobWave;
    const tx = rx + tipDx;
    const ty = ry + tipDy;
    if (st.ashErode > 0.22 + aIdx * 0.08) continue;

    const midX = (rx + tx) * 0.5 - st.rearAngle * 2;
    const midY = (ry + ty) * 0.5 - 1.5;
    const stalkCol = st.stoneLv > 0.5 ? S[2] : st.fireHeat > 0.4 ? F[2] : S[1];
    g.line(rx, ry, midX, midY, stalkCol);
    g.line(midX, midY, tx, ty, st.stoneLv > 0.5 ? S[3] : F[4]);

    const bulbCore = st.stoneLv > 0.45 ? S[4] : st.fireHeat > 1.15 ? WHITE : F[6];
    const bulbRim = st.stoneLv > 0.45 ? S[2] : F[4];
    g.set(Math.round(tx), Math.round(ty), bulbCore);
    g.set(Math.round(tx) - 1, Math.round(ty), bulbRim);
    g.set(Math.round(tx) + 1, Math.round(ty), bulbRim);
    g.set(Math.round(tx), Math.round(ty) - 1, bulbRim);
    g.set(Math.round(tx), Math.round(ty) + 1, bulbRim);
    bulbPos.push({ x: tx, y: ty });
  }

  const exBase = Math.round(head.x + head.r * 0.25);
  const eyBase = Math.round(head.y - head.r * 0.14 - st.rearAngle * 3);
  if (st.ashErode < 0.35) {
    for (const side of [-1, 1]) {
      const ex = exBase + (side < 0 ? -3 : 3);
      const ey = eyBase + (side < 0 ? 0 : -1);
      if (st.eyeMode === "sleep") {
        g.set(ex - 1, ey, F[0]);
        g.set(ex, ey + 1, F[0]);
        g.set(ex + 1, ey, F[0]);
      } else if (st.eyeMode === "shock") {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            g.set(ex + dx, ey + dy, dx === 0 && dy === 0 ? S[0] : WHITE);
          }
        }
        g.set(ex - 2, ey, F[0]);
        g.set(ex + 2, ey, F[0]);
      } else if (st.eyeMode === "crawl") {
        g.set(ex, ey, WHITE);
        g.set(ex, ey + 1, F[6]);
        g.set(ex - 1, ey, F[0]);
        g.set(ex + 1, ey, F[0]);
        g.set(ex, ey - 1, F[0]);
      } else if (st.eyeMode === "glare") {
        g.set(ex - 1, ey - (side < 0 ? 1 : 0), F[0]);
        g.set(ex, ey, WHITE);
        g.set(ex + 1, ey + (side < 0 ? 0 : -1), F[6]);
      } else {
        g.set(ex - 1, ey - 1, S[0]);
        g.set(ex + 1, ey + 1, S[0]);
        g.set(ex + 1, ey - 1, S[0]);
        g.set(ex - 1, ey + 1, S[0]);
      }
    }
  }

  g.draw(p);

  if (st.shudderJolt > 0.18) {
    const flick = (Math.floor(t * 28) & 1) === 0 ? 1 : 0;
    const lx = Math.round(spine[0].x - 5 - flick);
    const rx = Math.round(head.x + head.r + 4 + flick);
    const my = Math.round(spine[2].y);
    for (let dy = -4; dy <= 4; dy++) {
      const curve = Math.round(Math.abs(dy) * 0.35);
      p.px(lx + curve, my + dy, F[6]);
      p.px(rx - curve, my + dy, F[6]);
    }
  }

  if (st.fireHeat > 0.08 && st.stoneLv < 0.70) {
    const bodyGlowK = clamp(st.fireHeat * (1 - st.stoneLv));
    p.glow((spine[1].x + head.x) * 0.5, head.y + 3, 28 + 16 * st.swell, F[3], (0.28 + 0.30 * st.swell) * bodyGlowK);
    p.glow(head.x, head.y, 18 + 8 * st.swell, F[4], (0.22 + 0.22 * st.swell) * bodyGlowK);
    for (const bp of bulbPos) {
      p.glow(bp.x, bp.y, 9 + 3 * st.swell, F[5], (0.48 + 0.22 * st.swell) * bodyGlowK);
    }
  }

  return {
    snoutX: head.x + head.r * 0.92,
    snoutY: head.y + head.r * 0.16,
    headX: head.x,
    headY: head.y,
    tailX: spine[0].x,
  };
}

function drawMagmaSnotBubble(p, sx, sy, r, F, t) {
  if (r < 1.2) return;
  const wob = 0.065 * Math.sin(t * 22);
  const rx = r * (1 + wob);
  const ry = r * (1 - wob);
  const cx = sx + rx * 0.84;
  const cy = sy - ry * 0.14 + Math.sin(t * 9) * 0.6;

  p.line(sx - 1, sy, cx - rx * 0.85, cy, F[3], 1.5);

  const minX = Math.floor(cx - rx - 1), maxX = Math.ceil(cx + rx + 1);
  const minY = Math.floor(cy - ry - 1), maxY = Math.ceil(cy + ry + 1);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d = Math.hypot(dx, dy);
      if (d > 1.0) continue;

      if (d > 0.90) {
        p.px(x, y, F[1]);
      } else if (d > 0.80) {
        p.px(x, y, F[4]);
      } else {
        const swirl = 0.5 + 0.5 * Math.sin(x * 0.34 - t * 6.5 + y * 0.28 + Math.cos(d * 4));
        const col = d > 0.58 ? F[3] : swirl > 0.62 ? F[3] : F[2];
        p.px(x, y, col);
      }
    }
  }

  for (let a = -2.55; a <= -1.25; a += 0.14) {
    const gx = Math.round(cx + Math.cos(a) * rx * 0.66);
    const gy = Math.round(cy + Math.sin(a) * ry * 0.66);
    p.px(gx, gy, a > -2.1 && a < -1.55 ? WHITE : F[6]);
  }
  p.px(Math.round(cx + rx * 0.32), Math.round(cy + ry * 0.28), F[5]);
  p.glow(cx, cy, r * 2.5 + 4, F[3], 0.58);
  p.glow(cx - rx * 0.25, cy - ry * 0.25, r * 1.15, F[5], 0.36);
}

// Smooth alpha-blended Scorched Slime Trail (`p.blend` instead of Bayer-dithered `p.dot` — ZERO black floor dots!)
function drawScorchedSlimeTrail(p, xStart, xEnd, F, S, seed, t) {
  if (xEnd <= xStart + 2) return;
  const coolFade = t < T_KO ? 1 : clamp(1 - (t - T_KO) / 1.35);
  const crustFade = t < 10.55 ? 1 : clamp(1 - (t - 10.55) / 0.95);
  if (crustFade <= 0.02) return;

  const minX = Math.floor(xStart);
  const maxX = Math.ceil(xEnd);
  for (let x = minX; x <= maxX; x++) {
    const wWave = 2.8 + 1.25 * noise(x * 0.22, seed + 41);
    const edgeFade = clamp(Math.min(x - minX, maxX - x) / 6);
    const ry = wWave * edgeFade;
    if (ry < 0.7) continue;

    for (let dy = -1; dy <= Math.ceil(ry); dy++) {
      const q = Math.abs(dy - 1.0) / Math.max(0.8, ry);
      if (q > 1.0) continue;

      const xAge = clamp((xEnd - x) / 56);
      const nCrack = tileFbm(x * 0.28, dy * 0.55 - t * 0.4, 0, 0, seed + 13, 2);
      const pulse = 0.78 + 0.22 * Math.sin(t * 5.2 + x * 0.17);
      const heat = clamp((1 - q * 0.78) * (1 - xAge * 0.42) * (0.55 + 0.65 * nCrack) * pulse) * coolFade;

      let col;
      if (q > 0.66) col = S[0];
      else if (heat > 0.64) col = F[5];
      else if (heat > 0.42) col = F[4];
      else if (heat > 0.22) col = F[2];
      else col = S[1];

      p.blend(x, dy, col, crustFade);
    }
    if ((x % 9) === 0 && coolFade > 0.18) {
      p.glow(x, 0, 7, F[3], 0.22 * coolFade * crustFade);
    }
  }
}

// Clean, smooth Boiling Target Lava Pool (NO random `scorch()` black soot dots, NO black Bayer fade ring!)
function drawTargetLavaPool(p, F, H, S, t, poolRadius, poolFlames, blisters) {
  if (poolRadius < 3) return;
  const hitStart = FIREBALL_SHOTS[0].tFire + FIREBALL_SHOTS[0].flight;
  if (t < hitStart) return;

  const cool = t < T_KO ? 0 : smooth(T_KO + 0.15, T_KO + 1.20, t);
  const fade = t < 10.65 ? 1 : clamp(1 - (t - 10.65) / 0.85);
  if (fade <= 0.02) return;

  const rx = poolRadius * (1 - 0.15 * cool);
  const ry = Math.max(2.4, rx * 0.25);

  // Soft translucent scorched basalt halo around pool (`shadow()` elliptical alpha blend — completely smooth, zero speckles!)
  shadow(p, X_POOL, 1.0, rx * 1.18, ry * 1.18, S[0], 0.42 * fade);

  for (let y = -Math.ceil(ry * 0.85); y <= Math.ceil(ry * 1.25); y++) {
    for (let x = Math.floor(X_POOL - rx); x <= Math.ceil(X_POOL + rx); x++) {
      const dx = (x - X_POOL) / rx;
      const dy = (y - 1.0) / ry;
      const d = Math.hypot(dx, dy);
      if (d > 1.0) continue;

      if (d > 0.82) {
        p.blend(x, y, cool > 0.55 ? S[1] : F[0], fade);
        continue;
      }
      const n = tileFbm(x * 0.18 - t * 0.6, y * 0.36 + t * 0.4, 0, 0, 19, 2);
      const swirl = 0.52 + 0.48 * Math.sin(x * 0.22 - t * 6.0 + n * 4.5);
      const heat = (1 - d * 0.68) * (0.58 + 0.42 * swirl) * (1 - cool * 0.94);
      let col;
      if (heat > 0.78) col = WHITE;
      else if (heat > 0.60) col = F[6];
      else if (heat > 0.42) col = F[5];
      else if (heat > 0.25) col = F[4];
      else if (heat > 0.13) col = F[2];
      else col = S[1];
      p.blend(x, y, col, fade);
    }
  }

  if (cool < 0.72) {
    for (let i = 0; i < blisters.length; i++) {
      const bl = blisters[i];
      if (Math.abs(bl.x) > rx * 0.72) continue;
      const cyc = (t / bl.period + bl.phase) % 1;
      const bx = X_POOL + bl.x;
      const by = bl.y * 0.4;
      if (cyc < 0.72) {
        const r = bl.rMax * ease.outQuad(cyc / 0.72) * (1 - cool);
        if (r >= 1.1) {
          p.circle(bx, by, r, F[3], fade);
          p.circle(bx - 0.3, by - 0.3, r * 0.65, cyc > 0.55 ? WHITE : F[6], fade);
        }
      } else if (cyc < 0.90) {
        const u = (cyc - 0.72) / 0.18;
        p.ring(bx, by, bl.rMax * (1 + u * 0.7), 1, u < 0.4 ? WHITE : F[5], (1 - u) * fade);
      }
    }
  }

  if (cool < 0.85) {
    const NZ = (rate, s2 = 0, off = 0) => noise(t * rate + off, s2);
    for (const tf of poolFlames) {
      if (Math.abs(tf.x) > rx * 0.76) continue;
      const k = (1 - cool) * fade;
      const pulse = 0.55 + 0.45 * Math.sin(t * tf.freq + tf.phase);
      const fh = tf.h * k * pulse;
      if (fh < 3) continue;
      flameTongue(p, X_POOL + tf.x, tf.y, fh, tf.w * k, Math.sin(t * 7 + tf.seed) * 3.0, NZ, tf.seed, H, LAYERS, 0.48, 0.95);
    }
    floorLight(p, X_POOL, 1, rx * 1.3, ry * 2.2, F[5], 0.45 * (1 - cool) * fade);
  }
}

export function create(o) {
  const F = fit(o.palette, 8);
  const H = hotFirst(F);
  const S = fit(o.crust, 6);
  const SM = fit(o.smoke, 4);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const [W, H_CANVAS] = meta.size;
  const [OX, OY] = meta.origin;
  const X0 = -OX + 4, X1 = W - OX - 4, Y0 = -OY + 4, Y1 = H_CANVAS - OY - 4;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, F[6], F[5], F[3]],
    haze: F[4],
  });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();
  const slugGrid = new Grid(-125, -56, 154, 60);

  const stoneCracks = Array.from({ length: 6 }, (_, i) => {
    let a = (i / 6) * TAU + R.range(-0.3, 0.3);
    let cx = R.range(-4, 4), cy = R.range(-3, 2);
    const pts = [[cx, cy]];
    for (let s = 0; s < 5; s++) {
      a += R.range(-0.45, 0.45);
      cx += Math.cos(a) * R.range(2.2, 3.8);
      cy += Math.sin(a) * R.range(1.6, 3.0);
      pts.push([cx, cy]);
    }
    return pts;
  });

  const poolFlames = [
    { x: -16, y: 0, h: 12, w: 3.2, freq: 9.2, phase: 0.4, seed: o.seed * 17 + 11 },
    { x: -7, y: -1, h: 21, w: 4.4, freq: 7.4, phase: 1.8, seed: o.seed * 17 + 29 },
    { x: 2, y: 0, h: 15, w: 3.6, freq: 11.0, phase: 3.1, seed: o.seed * 17 + 47 },
    { x: 11, y: -1, h: 23, w: 4.6, freq: 6.8, phase: 4.5, seed: o.seed * 17 + 63 },
    { x: 21, y: 0, h: 13, w: 3.1, freq: 10.2, phase: 2.2, seed: o.seed * 17 + 81 },
  ];
  const poolBlisters = Array.from({ length: 14 }, (_, i) => ({
    x: R.range(-26, 26),
    y: R.range(-2, 4),
    rMax: R.range(1.8, 3.6),
    period: R.range(0.36, 0.64),
    phase: (i * 0.27) % 1,
  }));
  const hitSpikes = spikes(R, 14, -Math.PI / 2, { len: [10, 18], w: [1.6, 2.5], fwd: 1.4, jag: 0.55 });

  let t = 0;
  let bubblePopped = false;
  let trailAcc = 0;
  let chargeAcc = 0;
  let heatAcc = 0;
  let fbTailAcc = 0;
  let ashBurstDone = false;
  let ashDriftAcc = 0;
  let koQuenchDone = false;
  let poolRadius = 0;

  const firedShots = new Set();
  const landedShots = new Set();

  const evalShotPos = (sh, time) => {
    const dtF = time - sh.tFire;
    const u = clamp(dtF / sh.flight);
    const stFire = slugPoseAt(sh.tFire);
    const spFire = evalSpine(stFire);
    const sx = spFire[4].x + spFire[4].r * 0.95;
    const sy = spFire[4].y + spFire[4].r * 0.06;
    const px = lerp(sx, sh.tx, u);
    const py = lerp(sy, sh.ty, u) - sh.apex * 4 * u * (1 - u) * 0.58;
    const vx = (sh.tx - sx) / sh.flight;
    const vy = (sh.ty - sy) / sh.flight - (sh.apex * 2.32 * (1 - 2 * u)) / sh.flight;
    return { x: px, y: py, vx, vy, u };
  };

  return {
    update(dt) {
      t += dt;
      const st = slugPoseAt(t);
      const sp = evalSpine(st);

      // 1. Orange-red rising embers & thermal flares (`散发着橙红热浪`)
      if (t < T_KO) {
        const rate = t < T_MOVE ? 11.5 : t < T_ATK ? 13 : t < T_POST_IDLE ? 20 : 11;
        heatAcc += dt * rate;
        while (heatAcc >= 1) {
          heatAcc -= 1;
          const nd = R.pick(sp);
          const rx = nd.x + R.range(-nd.r * 0.75, nd.r * 0.75);
          const ry = nd.y - nd.r * 0.65;
          if (R.chance(0.62)) {
            ps.spawn(P.EMBER, rx, ry, R.range(-8, 8), -R.range(18, 40), R.range(0.45, 0.85), R.pick([F[5], F[4], F[6]]), 1);
          } else {
            ps.spawn(P.FIRE, rx, ry - 1, R.range(-6, 6), -R.range(14, 28), R.range(0.26, 0.44), 0, R.range(1.7, 2.8), 0, 0);
          }
        }
      }

      // 2. Bubble Pop burst (`啪地一声炸开` — clean fiery flares & sparks, NO PF.SMOKES soot blobs!)
      if (!bubblePopped && t >= T_BUB_POP) {
        bubblePopped = true;
        const bx = sp[4].x + sp[4].r + 12;
        const by = sp[4].y;
        lights.add(bx, by, 44, F[5], 0.90, 0.26);
        lights.add(bx, by, 22, WHITE, 0.88, 0.11);
        for (let i = 0; i < 28; i++) {
          const a = R.range(0, TAU);
          const speed = R.range(52, 152);
          ps.spawn(P.SPARK, bx, by, Math.cos(a) * speed, Math.sin(a) * speed - 18, R.range(0.22, 0.50));
        }
        for (let i = 0; i < 9; i++) {
          const a = R.range(0, TAU);
          const speed = R.range(28, 78);
          ps.spawn(P.FIRE, bx, by, Math.cos(a) * speed, Math.sin(a) * speed - 15, R.range(0.18, 0.34), 0, R.range(2.5, 4.2), 0, 0);
        }
      }

      // 3. Scorched trail emitting clean cyan-slate smoke (`冒着青烟` via P.DUST so it never darkens into black SMOKE_RAMP soot!)
      if (t >= T_CRAWL_START && t < T_KO) {
        const endTrailX = st.crawlDist < 1 ? sp[0].x : X_ATK - 14;
        const smokeRate = t < T_ATK ? 28 : 11;
        trailAcc += dt * smokeRate;
        while (trailAcc >= 1) {
          trailAcc -= 1;
          const tx = R.range(X_IDLE - 16, endTrailX);
          if (R.chance(0.78)) {
            ps.spawn(P.DUST, tx, -1.5, R.range(-6, 10), -R.range(18, 36), R.range(0.58, 1.05), R.pick([SM[1], SM[2], SM[3]]), R.range(2.2, 4.0));
          } else {
            ps.spawn(P.EMBER, tx, -1, R.range(-8, 8), -R.range(12, 28), R.range(0.45, 0.8), F[4], 1);
          }
        }
      }

      // 4. Attack inhale & fireball volley + boiling lava pool
      if (t >= T_ATK && t < T_SPIT_START) {
        chargeAcc += dt * 52;
        while (chargeAcc >= 1) {
          chargeAcc -= 1;
          const a = R.range(0, TAU);
          const d = R.range(26, 48);
          const cx = (sp[1].x + sp[4].x) * 0.5;
          const cy = sp[2].y;
          const sx = cx + Math.cos(a) * d;
          const sy = cy + Math.sin(a) * d * 0.78;
          ps.spawn(P.STREAK, sx, sy, (cx - sx) * 4.5, (cy - sy) * 4.5, R.range(0.14, 0.24), R.pick([F[3], F[4], F[5]]), 1);
        }
      }

      for (let i = 0; i < FIREBALL_SHOTS.length; i++) {
        const sh = FIREBALL_SHOTS[i];
        if (!firedShots.has(i) && t >= sh.tFire) {
          firedShots.add(i);
          const p0 = evalShotPos(sh, sh.tFire + 0.01);
          lights.add(p0.x, p0.y, 44, F[5], 0.85, 0.22);
          for (let k = 0; k < 14; k++) {
            const a = -0.65 + R.range(-0.45, 0.45);
            const spk = R.range(65, 150);
            ps.spawn(P.SPARK, p0.x, p0.y, Math.cos(a) * spk, Math.sin(a) * spk, R.range(0.16, 0.34));
          }
        }

        if (t >= sh.tFire && t < sh.tFire + sh.flight) {
          fbTailAcc += dt * 44;
          while (fbTailAcc >= 1) {
            fbTailAcc -= 1;
            const pos = evalShotPos(sh, t);
            const speed = Math.hypot(pos.vx, pos.vy) || 1;
            const ux = pos.vx / speed, uy = pos.vy / speed;
            ps.spawn(
              P.FIRE,
              pos.x - ux * 5,
              pos.y - uy * 5,
              -ux * R.range(22, 52) + R.range(-10, 10),
              -uy * R.range(22, 52) + R.range(-10, 10),
              R.range(0.16, 0.28),
              0,
              R.range(2.8, 4.6),
              0,
              0
            );
            ps.spawn(
              P.SPARK,
              pos.x - ux * 4,
              pos.y - uy * 4,
              -ux * R.range(38, 90) + R.range(-22, 22),
              -uy * R.range(38, 90) + R.range(-22, 22),
              R.range(0.16, 0.34)
            );
          }
        }

        if (!landedShots.has(i) && t >= sh.tFire + sh.flight) {
          landedShots.add(i);
          poolRadius = Math.min(39, Math.max(poolRadius + 6.8, sh.rPool + i * 5.2));
          lights.add(sh.tx, -6, 50, F[5], 0.92, 0.42);
          lights.add(sh.tx, -4, 26, WHITE, 0.88, 0.14);

          for (let k = 0; k < 28; k++) {
            const a = -Math.PI / 2 + R.range(-1.18, 1.18);
            const spk = R.range(68, 195);
            ps.spawn(P.SPARK, sh.tx, -2, Math.cos(a) * spk, Math.sin(a) * spk, R.range(0.22, 0.56));
          }
          for (let k = 0; k < 12; k++) {
            const a = -Math.PI / 2 + R.range(-1.05, 1.05);
            const spk = R.range(38, 120);
            ps.spawn(P.FIRE, sh.tx + R.range(-3, 3), -4, Math.cos(a) * spk, Math.sin(a) * spk, R.range(0.24, 0.48), 0, R.range(3.8, 6.2), 0, 0);
          }
          for (let k = 0; k < 4; k++) {
            const a = -Math.PI / 2 + R.range(-0.9, 0.9);
            const spk = R.range(52, 112);
            ps.spawn(P.BRAND, sh.tx, -2, Math.cos(a) * spk, Math.sin(a) * spk, R.range(0.24, 0.48));
          }
        }
      }

      // 5. KO: Instant quench steam -> pale/mid-grey charcoal grit -> shattering wind-blown grey ashes (`碎裂成灰烬随风飘散`)
      if (!koQuenchDone && t >= T_KO) {
        koQuenchDone = true;
        for (let i = 0; i < 16; i++) {
          ps.spawn(
            P.DUST,
            lerp(sp[0].x, sp[4].x, R.range(0.1, 0.9)),
            -R.range(4, 15),
            R.range(-12, 18),
            -R.range(18, 44),
            R.range(0.45, 0.85),
            R.pick([SM[2], SM[3]]),
            R.range(2.8, 4.8)
          );
        }
      }

      if (t >= T_HARDEN && t < T_SHATTER && R.chance(28 * dt)) {
        const cx = lerp(sp[0].x, sp[4].x, R.range(0.15, 0.85));
        ps.spawn(P.GRIT, cx, -R.range(4, 13), R.range(-25, 28), -R.range(18, 55), R.range(0.35, 0.65), R.pick([S[3], S[4], S[5]]), 1);
      }

      if (!ashBurstDone && t >= T_SHATTER) {
        ashBurstDone = true;
        const cx = (sp[0].x + sp[4].x) * 0.5;
        for (let i = 0; i < 18; i++) {
          bits.add({
            kind: B.CHUNK,
            x: cx + R.range(-16, 16),
            y: -R.range(3, 13),
            vx: R.range(12, 72),
            vy: -R.range(28, 82),
            g: 0.90,
            drag: 0.60,
            bounce: 0.22,
            life: R.range(0.46, 0.88),
            a: R.range(0, TAU),
            va: R.range(-12, 12),
            s: R.range(1.2, 2.2),
            ramp: [S[2], S[3], S[4], S[5]],
          });
        }
      }

      if (t >= T_SHATTER && t < T_END - 0.24) {
        ashDriftAcc += dt * 92 * (1 - seg(t, T_END - 0.52, T_END - 0.24));
        while (ashDriftAcc >= 1) {
          ashDriftAcc -= 1;
          const cx = R.range(sp[0].x - 4, sp[4].x + 6);
          const cy = -R.range(1, 15);
          const life = Math.min(R.range(0.45, 0.90), Math.max(0.10, T_END - 0.10 - t));
          if (R.chance(0.65)) {
            ps.spawn(P.FLAKE, cx, cy, R.range(52, 132), -R.range(16, 56), life, R.pick([S[3], S[4], S[5]]), R.chance(0.35) ? 2 : 1);
          } else {
            ps.spawn(P.DUST, cx, cy, R.range(38, 92), -R.range(14, 40), life, R.pick([S[3], S[4], S[5], SM[2]]), R.range(1.8, 3.2));
          }
        }
      }

      bits.update(dt);
      for (let i = bits.list.length - 1; i >= 0; i--) {
        if (t > T_END - 0.14 || bits.list[i].x > X1 - 6) bits.list.splice(i, 1);
      }

      ps.update(dt);
      cullParticles(ps, X0, Y0, X1, Y1);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;
      const st = slugPoseAt(t);
      const sp = evalSpine(st);

      const shAlpha = (1 - st.ashErode) * 0.42;
      if (shAlpha > 0.03) {
        const cx = (sp[0].x + sp[4].x) * 0.5;
        const rx = Math.max(10, (sp[4].x - sp[0].x) * 0.55 + sp[2].r * 0.5);
        shadow(p, cx, 1, rx, 2.5, S[0], shAlpha);
      }

      // Organic flickering orange-red thermal haze arcs rising subtly during Idle, Quirk & Post-Attack Idle Buffer!
      if (t < T_MOVE || (t >= T_POST_IDLE && t < T_KO)) {
        const cx = (sp[0].x + sp[4].x) * 0.5;
        for (let w = 0; w < 3; w++) {
          const ph = (t * 0.78 + w * 0.33) % 1;
          const baseX = cx + (w - 1) * 9.5 + Math.sin(t * 4.4 + w * 2.1) * 2.2;
          const yBase = -11 - ph * 14;
          const alpha = Math.sin(ph * Math.PI) * 0.50;
          if (alpha > 0.12) {
            p.glow(baseX, yBase, 7.5, F[4], alpha * 0.34);
            for (let s = 0; s < 4; s++) {
              const wy = Math.round(yBase - s * 1.4);
              const wx = Math.round(baseX + Math.sin(wy * 0.9 + t * 9.5 + w * 2.3) * 1.8);
              p.blend(wx, wy, s < 2 ? F[4] : F[3], alpha);
            }
          }
        }
      }

      if (t >= T_CRAWL_START) {
        drawScorchedSlimeTrail(p, X_IDLE - 18, st.crawlDist < 1 ? sp[0].x + 2 : X_ATK - 10, F, S, o.seed, t);
      }

      drawTargetLavaPool(p, F, H, S, t, poolRadius, poolFlames, poolBlisters);
      for (const sh of FIREBALL_SHOTS) {
        const dtHit = t - (sh.tFire + sh.flight);
        if (dtHit >= 0 && dtHit < 0.44) {
          const rk = dtHit / 0.44;
          band(p, sh.tx, 0, 5 + 26 * ease.outCubic(rk), 0.28, 3.0 * (1 - rk * 0.65), (1 - rk) * 0.9, [F[1], F[3], F[5], WHITE], (a) => Math.sin(a) < 0, rk < 0.18);
        }
      }

      simDraw(p, ps, H, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;
      const st = slugPoseAt(t);

      const slugAnchors = drawLavaSlug(slugGrid, p, st, F, S, stoneCracks, o.seed, t);

      if (st.eyeMode === "sleep") {
        const zStart = t < T_QUIRK ? 0.20 : t < T_BUB_POP ? 0.20 : t < T_POST_IDLE ? 3.92 : 9.15;
        if (t > zStart) {
          for (let zi = 0; zi < 2; zi++) {
            const cyc = (t * 0.68 + zi * 0.50) % 1;
            const zx = slugAnchors.headX + 4 + cyc * 9 + Math.sin(t * 4 + zi * 2) * 1.5;
            const zy = slugAnchors.headY - 11 - cyc * 14;
            const za = Math.sin(cyc * Math.PI) * (t > T_BUB_POP - 0.15 && t < T_BUB_POP ? 0 : 0.9);
            if (za > 0.05) drawGlyph(p, Z_GLYPH, zx, zy, F[6], F[2], za);
          }
        }
      }

      if (st.bubbleR > 0) {
        drawMagmaSnotBubble(p, slugAnchors.snoutX, slugAnchors.snoutY, st.bubbleR, F, t);
      }
      if (st.bubblePop && t < T_BUB_POP + 0.36) {
        const age = t - T_BUB_POP;
        if (age < 0.18) {
          const u = age / 0.18;
          const bx = slugAnchors.snoutX + 10;
          const by = slugAnchors.snoutY;
          p.ring(bx, by, 6 + 20 * ease.outCubic(u), 1.5, u < 0.4 ? WHITE : F[5], 1 - u);
          flare(p, bx, by, 19 * (1 - u), 1 - u, [F[2], F[4], F[5], WHITE]);
        }
        const bangAlpha = age < 0.06 ? age / 0.06 : 1 - (age - 0.06) / 0.30;
        drawGlyph(p, BANG_GLYPH, slugAnchors.headX + 2, slugAnchors.headY - 19, WHITE, F[3], clamp(bangAlpha));
      }

      const NZ = (rate, s2 = 0, off = 0) => noise(t * rate + off, s2);
      for (let i = 0; i < FIREBALL_SHOTS.length; i++) {
        const sh = FIREBALL_SHOTS[i];
        const dtS = t - sh.tFire;
        if (dtS >= 0 && dtS < 0.13) {
          const fk = 1 - dtS / 0.13;
          flare(p, slugAnchors.snoutX + 3, slugAnchors.snoutY, 20 * fk, fk, [F[2], F[4], F[6], WHITE]);
        }
        if (t >= sh.tFire && t < sh.tFire + sh.flight) {
          const pos = evalShotPos(sh, t);
          const spLen = Math.hypot(pos.vx, pos.vy) || 1;
          const ux = pos.vx / spLen, uy = pos.vy / spLen;
          flameBlade(p, pos.x, pos.y, -ux, -uy, 24, 4.8, Math.sin(t * 24 + i) * 2.2, NZ, o.seed + i * 19, H, LAYERS, 0.45, 1.0);
          p.circle(pos.x, pos.y, 4.8, F[4]);
          p.circle(pos.x, pos.y, 3.2, F[6]);
          p.circle(pos.x, pos.y, 1.8, WHITE);
          p.glow(pos.x, pos.y, 20, F[5], 0.75);
          p.glow(pos.x, pos.y, 9, WHITE, 0.58);
        }

        const dtHit = t - (sh.tFire + sh.flight);
        if (dtHit >= 0 && dtHit < 0.44) {
          const rk = dtHit / 0.44;
          band(p, sh.tx, 0, 5 + 27 * ease.outCubic(rk), 0.28, 3.2 * (1 - rk * 0.65), (1 - rk) * 0.95, [F[1], F[3], F[5], WHITE], (a) => Math.sin(a) >= 0, rk < 0.18);
          if (dtHit < 0.22) {
            const fk = 1 - dtHit / 0.22;
            star(p, sh.tx, -2, hitSpikes, 0.85 + 0.48 * (1 - fk), fk, [F[2], F[4], F[6], WHITE], fk, 2.5);
            const spread = 4 + 18 * ease.outQuart(1 - fk);
            frontCrescent(p, sh.tx + spread, 1, 12 * fk, 3.6 * fk, [WHITE, F[6], F[4]], fk);
            frontCrescent(p, sh.tx - spread, -1, 12 * fk, 3.6 * fk, [WHITE, F[6], F[4]], fk);
          }
        }
      }

      for (const b of bits.list) {
        const fade = clamp(b.life / 0.35);
        p.disc(b.x, b.y, b.s * 0.85, S[3], fade);
        p.blend(Math.round(b.x), Math.round(b.y), S[5], fade);
      }
      simDraw(p, ps, H, "front");
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
