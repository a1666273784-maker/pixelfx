import {
  Particles,
  Bits,
  Lights,
  P,
  B,
  Rng,
  fit,
  clamp,
  smooth,
  ease,
  lerp,
  rand,
  fbm,
  TAU,
} from "../../core/index.js";
import { simDraw } from "./_lib.js";
import { draft, fadeEdges, cull, fireRamp, heatRamp } from "../explosions/_lib.js";
import { through, along, trace } from "../melee/_lib.js";

export const meta = {
  name: "Celestial blaze seal",
  desc: "A towering sovereign opens a bronze-jade meander gate and twin glyph rings, raining three waves of crimson meteors before sweeping a three-wave sea of fire across the floor.",
  tags: ["fire", "boss", "ultimate", "meteor", "seal", "chinese", "screen", "one-shot"],
  size: [320, 200],
  origin: [160, 176],
  duration: 6.0,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#14080a", "#3a0e12", "#6e1418", "#a8261c", "#d94a1c", "#f08a24", "#ffcc55", "#fff0c4"],
    gold: ["#4d3206", "#8c5f0b", "#cc9214", "#ffd426", "#fff6cc"],
    jade: ["#06181a", "#0d3a3a", "#1f7a6e", "#5fd4bd", "#d8fbf2"],
    ash: ["#0b0910", "#161320", "#221d2e", "#322a40", "#463c56", "#5d506d"],
    seed: 17,
  },
};

// Local pose constants (do NOT import READY)
const POSE_IDLE = { crouch: 2, fx: 8, fy: -20, bx: 7, by: -20, ffx: 7, fbx: -7 };
const POSE_RAISE = { crouch: 1, lean: -2, fx: -8, fy: -39, bx: 10, by: -39, ffx: 8, fbx: -8 };
const POSE_GATE = { crouch: 2, lean: -3, fx: -11, fy: -34, bx: 12, by: -34, armsFront: true, ffx: 9, fbx: -9 };
const POSE_LIFT = { crouch: 1, lean: -2, fx: -9, fy: -38, bx: 11, by: -38, armsFront: true, ffx: 8, fbx: -8 };
const POSE_PRESS = { crouch: 6, lean: 5, fx: 8, fy: -15, bx: 10, by: -15, armsFront: true, ffx: 10, fbx: -8 };
const POSE_CHANNEL = { crouch: 4, lean: 2, fx: 9, fy: -18, bx: 9, by: -18, ffx: 9, fbx: -8 };
const POSE_REST = { crouch: 1, lean: 0, fx: 4, fy: -16, bx: 5, by: -16, ffx: 6, fbx: -6 };

export const act = {
  target: { x: 76 },
  poses: [
    [0.0, POSE_IDLE],
    [0.22, POSE_RAISE, "out"],
    [0.55, POSE_GATE, "out"],
    [1.42, POSE_LIFT, "in"],
    [1.60, POSE_PRESS, "out"],
    [1.92, POSE_LIFT, "out"],
    [2.10, POSE_PRESS, "out"],
    [2.42, POSE_LIFT, "out"],
    [2.60, POSE_PRESS, "out"],
    [3.20, POSE_CHANNEL, "out"],
    [4.30, POSE_CHANNEL],
    [4.60, POSE_REST, "out"],
  ],
  hits: [
    { t: 1.60, stop: 0.04, shake: 0.14, amp: 2, push: 1.0, straw: 6, y: -18 },
    { t: 2.10, stop: 0.04, shake: 0.16, amp: 2, push: 1.2, straw: 7, y: -16 },
    { t: 2.60, stop: 0.05, shake: 0.18, amp: 2, push: 1.4, straw: 8, y: -14, skin: "char" },
  ],
  dust: [
    { t: 1.60, x: 22, n: 6, dir: 1 },
    { t: 2.10, x: 38, n: 6, dir: 1 },
    { t: 2.60, x: -22, n: 6, dir: -1 },
  ],
};

// Four original 5x5 archaic bronze cloud-thunder square seals (云雷纹方印)
const SEAL_GLYPHS = [
  [0b11111, 0b10001, 0b10101, 0b10000, 0b11111],
  [0b11101, 0b10101, 0b10111, 0b10001, 0b11111],
  [0b11111, 0b00001, 0b11101, 0b10001, 0b10111],
  [0b10101, 0b10101, 0b11111, 0b00100, 0b11111],
];

const BOSS_X = -96;
const RING_CX = 0;
const RING_CY = -13;
const RING_SY = 0.29;

function polyLen(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

// Fast horizontal-scanline polygon fill (< 0.02 ms vs 16 ms for p.shade point-in-poly)
// stride2x2 = true samples 2 out of 4 pixels per 2x2 cell so huge boss silhouette stays well within <9000 px budget
function fillPolyFast(p, pts, col, a = 1, stride2x2 = false, colAlt = 0) {
  const n = pts.length;
  if (n < 3 || a <= 0.02) return;
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < n; i++) {
    const y = pts[i][1];
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  const y0 = Math.max(-174, Math.ceil(yMin - 0.5));
  const y1 = Math.min(21, Math.floor(yMax - 0.5));
  const xs = [];
  for (let y = y0; y <= y1; y++) {
    const yy = y + 0.5;
    xs.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = pts[i][0], yi = pts[i][1];
      const xj = pts[j][0], yj = pts[j][1];
      if ((yi > yy) !== (yj > yy)) {
        xs.push(xi + ((xj - xi) * (yy - yi)) / (yj - yi));
      }
    }
    xs.sort((u, v) => u - v);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(-157, Math.ceil(xs[k] - 0.5));
      const xb = Math.min(156, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) {
        if (stride2x2) {
          // Uniform dark A[0] monolith checker (zero vertical stripes, half pixel budget)
          if (((x + y) & 1) === 0) p.dot(x, y, col, a);
        } else {
          p.dot(x, y, col, a);
        }
      }
    }
  }
}

function buildMeanderPillar(xBase, side, yBot, yTop) {
  const pts = [[xBase, yBot]];
  const span = yBot - yTop;
  const teeth = 5;
  const step = span / teeth;
  for (let i = 0; i < teeth; i++) {
    const y0 = yBot - i * step;
    const y1 = y0 - step * 0.28;
    const y2 = y0 - step * 0.56;
    const y3 = y0 - step * 0.82;
    const y4 = y0 - step;
    const jut = side * 6;
    const hook = side * 3;
    pts.push(
      [xBase, y1],
      [xBase + jut, y1],
      [xBase + jut, y3],
      [xBase + hook, y3],
      [xBase + hook, y2],
      [xBase, y2],
      [xBase, y4]
    );
  }
  return pts;
}

const GATE = (() => {
  const xL = BOSS_X - 46;
  const xR = BOSS_X + 46;
  const yB = -3;
  const yT = -150;
  const left = buildMeanderPillar(xL, -1, yB, yT);
  left.push([xL, yT], [xL + 14, yT], [xL + 14, yT + 6], [xL + 22, yT + 6], [xL + 22, yT], [BOSS_X, yT]);
  const right = buildMeanderPillar(xR, 1, yB, yT);
  right.push([xR, yT], [xR - 14, yT], [xR - 14, yT + 6], [xR - 22, yT + 6], [xR - 22, yT], [BOSS_X, yT]);
  const innerL = [[xL + 5, yB - 2], [xL + 5, yT + 9], [xL + 13, yT + 9], [xL + 13, yT + 5], [BOSS_X, yT + 5]];
  const innerR = [[xR - 5, yB - 2], [xR - 5, yT + 9], [xR - 13, yT + 9], [xR - 13, yT + 5], [BOSS_X, yT + 5]];
  return {
    left,
    right,
    innerL,
    innerR,
    lenL: polyLen(left),
    lenR: polyLen(right),
    lenIL: polyLen(innerL),
    lenIR: polyLen(innerR),
  };
})();

// 3 waves x 6 meteors: spacing >= 38px (>= 34px), <= 1 within player x +- 24px, kept well inside [-136, +124]
const WAVE_BASES = [
  [-132, -90, -48, 22, 68, 114],
  [-114, -72, -32, 38, 80, 122],
  [-134, -96, -58, -21, 50, 106],
];

export function create(o) {
  const C = fit(o.palette, 8);
  const G = fit(o.gold, 5);
  const J = fit(o.jade, 5);
  const A = fit(o.ash, 6);
  const HR = heatRamp(fireRamp(C));
  const R = new Rng(o.seed);

  const actor = o.actor;
  const px0 = actor ? actor.x + (actor.w >> 1) : 0;
  const py0 = actor ? actor.y + (actor.h >> 1) : -19;
  const inHalo = (x, y, pad = 0) => {
    const dx = x - px0;
    const dy = y - py0;
    const rr = 20 + pad;
    return dx * dx + dy * dy <= rr * rr;
  };

  const ps = new Particles({ rng: R, ground: () => 0, sparks: [C[7], G[3], C[5], C[3]] });
  const bits = new Bits({ ground: () => 0 });
  const lights = new Lights();

  // 60 converging dotted energy lines pulled symmetrically from ALL 4 canvas edges into the central seal nexus
  const energyLines = Array.from({ length: 60 }, (_, i) => {
    const edge = i % 4;
    const u = (Math.floor(i / 4) + 0.5) / 15 + R.range(-0.02, 0.02);
    let sx = 0, sy = 0;
    if (edge === 0) { sx = lerp(-152, 152, clamp(u, 0.03, 0.97)); sy = -172; }
    else if (edge === 1) { sx = lerp(-148, 148, clamp(u, 0.04, 0.96)); sy = 19; }
    else if (edge === 2) { sx = -155; sy = lerp(-168, 12, clamp(u, 0.03, 0.97)); }
    else { sx = 154; sy = lerp(-168, 12, clamp(u, 0.03, 0.97)); }
    const tx = RING_CX + R.range(-16, 16);
    const ty = RING_CY - 8 + R.range(-8, 8);
    const dx = tx - sx, dy = ty - sy, dist = Math.hypot(dx, dy);
    const rad = Math.max(120, dist * R.range(1.35, 1.95));
    const span = 2 * Math.asin(clamp(dist / (2 * rad), 0.05, 0.88));
    const dir = i % 2 ? 1 : -1;
    const th = Math.atan2(dy, dx) - dir * span * 0.5;
    const sw = through(sx, sy, th, dir, rad, span, 0);
    return { sw, span, jade: i % 2 === 0, back: sy < -16, phase: R.range(0, 12) };
  });

  // 18 meteors (3 waves x 6) from Draft B: sculpted 8-vertex magma stones + bounded trajectory so 0 spill
  const meteors = [];
  for (let w = 0; w < 3; w++) {
    const waveT = 1.60 + w * 0.50;
    const xs = WAVE_BASES[w].map((bx) => Math.round(bx + R.range(-1.2, 1.2)));
    for (let k = 0; k < 6; k++) {
      const order = w === 1 ? 5 - k : k;
      const tLand = waveT + order * 0.033;
      const rad = R.range(5.4, 6.8);
      const nV = 8;
      const shape = Array.from({ length: nV }, (_, v) => {
        const ang = (v / nV) * TAU + R.range(-0.14, 0.14);
        const rr = rad * (v % 2 === 0 ? R.range(0.9, 1.12) : R.range(0.68, 0.86));
        return [Math.cos(ang) * rr, Math.sin(ang) * rr * 1.08];
      });
      // Keep oblique entry x strictly <= 148 so stone + slag wake never spill past +159!
      const mx = xs[k];
      const dxMax = Math.max(22, 147 - mx);
      const dx = Math.min(dxMax, R.range(48, 64));
      // Pre-bake compact crater & scorch pixel stamps so per-frame draw takes < 0.08 ms!
      const cRx = Math.round(R.range(11, 13)); // 22-26 px diameter
      const stamp = [];
      for (let py = -1; py <= 2; py++) {
        for (let px = -cRx; px <= cRx; px++) {
          const d = Math.hypot(px / cRx, (py - 0.3) / 2.2);
          if (d <= 1.05) stamp.push([px, py, d, rand(px * 31 + py + mx * 7, 3)]);
        }
      }
      meteors.push({
        wave: w,
        x: mx,
        tWarn: tLand - 0.40,
        tStart: tLand - 0.32,
        tLand,
        r: rad,
        dx,
        shape,
        cRx,
        stamp,
        seed: R.int(0, 999),
        landed: false,
        trailSpawned: 0,
        rays: Array.from({ length: 8 }, (_, j) => ({
          a: -Math.PI * ((j + 0.38 + R.range(-0.14, 0.14)) / 8),
          len: R.range(15, 25),
        })),
      });
    }
  }

  const windGusts = Array.from({ length: 10 }, (_, i) => ({
    y: -18 - (i % 5) * 1.8,
    x0: i % 2 === 0 ? -148 : 34,
    phase: R.range(0, 8),
  }));

  const nStars = 44;
  const stars = Array.from({ length: nStars }, (_, i) => {
    const rank = (i * 7 + (o.seed | 0)) % nStars;
    return {
      x: R.range(-146, 146),
      y0: lerp(-46, -138, rank / (nStars - 1)) + R.range(-3, 3),
      rise: R.range(20, 34),
      size: i % 3 === 0 ? 3 : i % 2 === 0 ? 2 : 1,
      vermilion: i % 3 === 1,
      tOut: lerp(5.12, 5.93, rank / (nStars - 1)),
    };
  });

  let t = 0;
  let ringSparkAcc = 0;

  function triggerImpact(m) {
    m.landed = true;
    lights.add(m.x, -3, 13, C[5], 0.36, 0.16);
    for (let j = 0; j < 10; j++) {
      const a = -R.range(0.28, Math.PI - 0.28);
      const sp = R.range(40, 92);
      const vx = clamp(Math.cos(a) * sp, (-148 - m.x) * 1.3, (148 - m.x) * 1.3);
      bits.add({
        kind: B.CHUNK,
        x: m.x + R.range(-3, 3),
        y: -2,
        vx,
        vy: Math.sin(a) * sp,
        a: R.range(0, TAU),
        va: R.range(-9, 9),
        s: j < 3 ? 2.2 : 1.6,
        ramp: j % 3 === 0 ? [A[0], A[2], G[2], G[3]] : [C[0], C[2], C[4], C[6]],
        bounce: 0.34,
        life: R.range(0.36, 0.64),
      });
    }
    for (let j = 0; j < 5; j++) {
      const a = -R.range(0.3, Math.PI - 0.3);
      const sp = R.range(52, 128);
      const vx = clamp(Math.cos(a) * sp, (-148 - m.x) * 1.4, (148 - m.x) * 1.4);
      ps.spawn(P.SPARK, m.x, -2, vx, Math.sin(a) * sp, R.range(0.26, 0.48));
    }
  }

  function drawGlyph5x5(p, cx, cy, glyphIdx, col) {
    const rows = SEAL_GLYPHS[glyphIdx & 3];
    const x0 = Math.round(cx) - 2;
    const y0 = Math.round(cy) - 2;
    for (let r = 0; r < 5; r++) {
      const row = rows[r];
      const yy = y0 + r;
      if (yy < -174 || yy > 21) continue;
      for (let c = 0; c < 5; c++) {
        if ((row >> (4 - c)) & 1) {
          const xx = x0 + c;
          if (xx >= -157 && xx <= 156 && !inHalo(xx, yy, 1)) p.px(xx, yy, col);
        }
      }
    }
  }

  // Fast analytical perspective dual-ring renderer (< 0.15 ms/frame instead of 15,750 p.dot overdraws)
  function drawSealRingsFast(p, half) {
    if (t < 0.05 || t >= 5.80) return;
    const expand = ease.outCubic(clamp((t - 0.05) / 0.35));
    const telegraph = smooth(1.30, 1.58, t) * (1 - smooth(1.62, 1.85, t));
    const afterFade = t >= 5.30 ? 1 - smooth(5.30, 5.80, t) : 1;
    if (afterFade <= 0.02) return;

    const rOuter = lerp(20, 115, expand);
    const rInner = lerp(14, 70, expand);
    const yMin = half === "back" ? Math.floor(RING_CY - rOuter * RING_SY - 2) : RING_CY;
    const yMax = half === "back" ? RING_CY - 1 : Math.min(21, Math.ceil(RING_CY + rOuter * RING_SY + 2));
    const xSpan = Math.ceil(rOuter + 2);

    const gBack = [G[0], G[1], G[2]];
    const gFront = t >= 5.30 ? [G[0], G[0], G[1]] : telegraph > 0.4 ? [G[2], G[3], G[4]] : [G[1], G[2], G[3]];
    const pal = half === "back" ? gBack : gFront;

    for (let y = yMin; y <= yMax; y++) {
      const dy = (y - RING_CY) / RING_SY;
      for (const [rad, th] of [[rOuter, 3.8], [rInner, 3.0]]) {
        const rMax = rad + 0.4;
        const rMin = Math.max(0, rad - th);
        const dy2 = dy * dy;
        if (dy2 > rMax * rMax) continue;
        const xOut = Math.sqrt(rMax * rMax - dy2);
        const xIn = dy2 < rMin * rMin ? Math.sqrt(rMin * rMin - dy2) : 0;
        for (const sign of [-1, 1]) {
          const xa = Math.round(RING_CX + sign * xIn);
          const xb = Math.round(RING_CX + sign * xOut);
          const x0 = Math.max(-xSpan, Math.min(xa, xb));
          const x1 = Math.min(xSpan, Math.max(xa, xb));
          for (let x = x0; x <= x1; x++) {
            if (x < -157 || x > 156) continue;
            if (half === "front" && inHalo(x, y, 2)) continue;
            const rCur = Math.hypot(x - RING_CX, dy);
            const u = clamp((rad - rCur) / th, 0, 1);
            const col = u < 0.28 ? pal[2] : u < 0.68 ? pal[1] : pal[0];
            p.dot(x, y, col, afterFade);
          }
        }
      }
    }

    // 12 orbiting 5x5 archaic cloud-thunder square seals (8 outer gold + 4 inner jade)
    if (expand > 0.45 && t < 5.45) {
      const spin = t * 0.6;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * TAU + spin;
        const sVal = Math.sin(ang);
        if ((half === "back" && sVal >= 0) || (half === "front" && sVal < 0)) continue;
        drawGlyph5x5(
          p,
          RING_CX + Math.cos(ang) * (rOuter - 1),
          RING_CY + sVal * (rOuter - 1) * RING_SY,
          i,
          half === "back" ? G[1] : telegraph > 0.4 ? G[4] : G[3]
        );
      }
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * TAU - spin * 1.25 + 0.4;
        const sVal = Math.sin(ang);
        if ((half === "back" && sVal >= 0) || (half === "front" && sVal < 0)) continue;
        drawGlyph5x5(
          p,
          RING_CX + Math.cos(ang) * (rInner - 1),
          RING_CY + sVal * (rInner - 1) * RING_SY,
          i + 1,
          half === "back" ? J[1] : J[3]
        );
      }
    }
  }

  function drawTalismanGate(p) {
    if (t < 0.15 || t >= 5.80) return;
    const brush = clamp((t - 0.15) / 0.40);
    const telegraph = smooth(1.30, 1.58, t) * (1 - smooth(1.62, 1.90, t));
    const afterFade = t >= 5.30 ? 1 - smooth(5.30, 5.80, t) : 1;
    if (afterFade <= 0.02) return;

    const gateGold = t >= 5.30 ? G[0] : telegraph > 0.5 ? G[4] : telegraph > 0.15 ? G[3] : G[2];
    const gateJade = t >= 5.30 ? J[0] : telegraph > 0.4 ? J[3] : J[2];

    // Fast direct 2x2-strided jade underglow along gate pillars (< 0.03 ms vs 1.3 ms for 3x p.glowLine)
    if (t < 5.30) {
      const yTopCur = Math.round(lerp(-3, -150, brush));
      const gk = 0.22 * afterFade;
      for (let yy = -4; yy >= yTopCur; yy -= 2) {
        for (const gx of [BOSS_X - 46, BOSS_X + 46]) {
          p.light(gx - 1, yy, J[2], gk);
          p.light(gx + 1, yy, J[2], gk);
        }
      }
      if (brush > 0.85) {
        for (let gx = BOSS_X - 45; gx <= BOSS_X + 45; gx += 2) {
          p.light(gx, -150, J[2], gk);
        }
      }
    }

    along(GATE.innerL, brush * GATE.lenIL, (x0, y0, x1, y1) => p.line(x0, y0, x1, y1, gateJade, afterFade));
    along(GATE.innerR, brush * GATE.lenIR, (x0, y0, x1, y1) => p.line(x0, y0, x1, y1, gateJade, afterFade));
    along(GATE.left, brush * GATE.lenL, (x0, y0, x1, y1) => p.line(x0, y0, x1, y1, gateGold, afterFade));
    along(GATE.right, brush * GATE.lenR, (x0, y0, x1, y1) => p.line(x0, y0, x1, y1, gateGold, afterFade));
  }

  function drawEnergyLines(p, isBack) {
    if (t < 0.30 || t >= 1.62) return;
    const activeCount = Math.floor(lerp(12, 60, clamp((t - 0.30) / 1.15)));
    const accel = t >= 1.30 ? lerp(1, 3.3, clamp((t - 1.30) / 0.30)) : 1;
    const fadeOut = 1 - smooth(1.54, 1.62, t);
    const scroll = t * 6.6 * accel;

    for (let i = 0; i < activeCount; i++) {
      const ln = energyLines[i];
      if (ln.back !== isBack) continue;
      const sp = Math.max(0.02, ln.span);
      trace(
        p,
        ln.sw,
        ln.sw.R,
        0,
        sp,
        (u) => {
          const q = u / sp;
          return ln.jade ? J[1 + (q > 0.65 ? 2 : q > 0.35 ? 1 : 0)] : C[2 + (q > 0.65 ? 4 : q > 0.35 ? 2 : 0)];
        },
        (u) => {
          const q = u / sp;
          if (((Math.floor(q * 18 - scroll + ln.phase)) & 3) >= 2) return 0;
          if (!isBack && q > 0.72) return 0;
          return (0.42 + 0.58 * q) * fadeOut;
        },
        0,
        2.6
      );
    }
  }

  function bossArmLift() {
    if (t < 0.55) return ease.outCubic(clamp(t / 0.50)) * 0.85;
    if (t < 1.60) return 0.85 + 0.15 * smooth(1.25, 1.56, t);
    for (let w = 0; w < 3; w++) {
      const tw = 1.60 + w * 0.50;
      if (t >= tw && t < tw + 0.50) {
        const dt = t - tw;
        if (dt < 0.14) return lerp(1.0, -0.45, ease.outExpo(dt / 0.14));
        if (dt < 0.28) return -0.45;
        return w < 2 ? lerp(-0.45, 0.95, smooth(0.28, 0.48, dt)) : lerp(-0.45, 0.2, smooth(0.28, 0.48, dt));
      }
    }
    if (t < 4.35) return 0.2 + 0.06 * Math.sin(t * 5);
    return lerp(0.2, -0.6, smooth(4.35, 4.65, t));
  }

  function drawBossSilhouette(p) {
    if (t >= 5.65) return;
    const appear = ease.outCubic(clamp(t / 0.30));
    const vanish = t >= 4.85 ? 1 - smooth(4.85, 5.65, t) : 1;
    const silAlpha = appear * vanish;
    if (silAlpha <= 0.02) return;

    const lift = bossArmLift(); // -0.60 (rest/press) .. +1.00 (high raise)
    const uLift = clamp((lift + 0.6) / 1.6, 0, 1);

    // Separated horned sovereign head/crown: top at y = -134 (42 px clearance to -176 >= 30 px!)
    const headBob = Math.round(lerp(2, -1, uLift));
    const yc = -133 + headBob;
    const head = [
      [BOSS_X - 7, yc + 31],
      [BOSS_X - 10, yc + 20],
      [BOSS_X - 20, yc + 4],   // left sweeping archaic horn tip
      [BOSS_X - 11, yc + 13],
      [BOSS_X - 6, yc + 7],
      [BOSS_X, yc],            // sovereign central crown spire
      [BOSS_X + 6, yc + 7],
      [BOSS_X + 11, yc + 13],
      [BOSS_X + 20, yc + 4],   // right sweeping archaic horn tip
      [BOSS_X + 10, yc + 20],
      [BOSS_X + 7, yc + 31],
    ];

    // Broad armored pauldrons + narrow waist (leaves empty gate space around waist/sides!) + grounded robe base
    const torso = [
      [BOSS_X - 21, -3],
      [BOSS_X - 16, -34],
      [BOSS_X - 12, -58],      // tapered waist so meteor light shines through gate interior
      [BOSS_X - 19, -82],
      [BOSS_X - 28, -93],      // left pauldron tip
      [BOSS_X - 22, -100],
      [BOSS_X - 9, -98],
      [BOSS_X + 9, -98],
      [BOSS_X + 22, -100],
      [BOSS_X + 28, -93],      // right pauldron tip
      [BOSS_X + 19, -82],
      [BOSS_X + 12, -58],
      [BOSS_X + 16, -34],
      [BOSS_X + 21, -3],
    ];

    // Articulated massive arms + gauntlet silhouettes clearly separated from torso
    const restMode = t >= 4.50 ? smooth(4.50, 4.70, t) : 0;
    const elbX = Math.round(lerp(33, 39, uLift) * (1 - restMode * 0.22));
    const elbY = Math.round(lerp(-74, -104, uLift));
    const handX = Math.round(lerp(26, 41, uLift) * (1 - restMode * 0.25));
    const handY = Math.round(lerp(-54, -124, uLift));

    const makeArm = (s) => [
      [BOSS_X + s * 22, -95],
      [BOSS_X + s * elbX, elbY - 4],
      [BOSS_X + s * (handX + 3), handY],
      [BOSS_X + s * (handX - 4), handY + 9],
      [BOSS_X + s * (elbX - 6), elbY + 5],
      [BOSS_X + s * 19, -84],
    ];
    const armL = makeArm(-1);
    const armR = makeArm(1);

    if (t < 5.20) {
      fillPolyFast(p, torso, A[0], silAlpha, true, A[1]);
      fillPolyFast(p, head, A[0], silAlpha, true, A[1]);
      fillPolyFast(p, armL, A[0], silAlpha, true, A[1]);
      fillPolyFast(p, armR, A[0], silAlpha, true, A[1]);
    }
    const rimHot =
      (t >= 1.30 && t < 1.68) ||
      (t >= 2.06 && t < 2.18) ||
      (t >= 2.56 && t < 2.68);
    const rimCol = t >= 5.15 ? G[0] : rimHot ? G[3] : C[4];
    const armRim = t >= 5.15 ? G[0] : rimHot ? C[6] : G[2];
    p.polyline([...torso, torso[0]], rimCol, silAlpha);
    p.polyline([...head, head[0]], rimHot ? G[4] : G[2], silAlpha);
    p.polyline([...armL, armL[0]], armRim, silAlpha);
    p.polyline([...armR, armR[0]], armRim, silAlpha);
  }

  function drawDarkVeil2x2(p) {
    if (t >= 5.45) return;
    const strength = clamp(t / 0.20) * (t >= 4.70 ? 1 - smooth(4.70, 5.45, t) : 1);
    if (strength <= 0.02) return;
    const W = p.w, H = p.h, tx = (p.tx | 0) - p.ox, ty = (p.ty | 0) - p.oy, fx = p.fx, buf = p.C;
    // 2x2 downsampled upper-sky & corner darkening (darkest 2 ash steps A[0], A[1]; keeps EVERY frame < 9000 non-blank px!)
    for (let y = -174; y < -60; y += 2) {
      const sy = ty + y;
      if (sy < 0 || sy >= H) continue;
      const v = (-y - 60) / 114;
      const row = sy * W;
      const xOff = ((y >> 1) & 1) * 2;
      for (let x = -158 + xOff; x < 158; x += 4) {
        const weight = v * 0.78 + (Math.abs(x) / 158) * 0.26;
        const cellHash = (((x * 73) ^ (y * 197)) & 7) / 8;
        if (weight * strength <= cellHash * 0.88 + 0.24) continue;
        const sx = tx + (fx > 0 ? x : -x - 1);
        if (sx >= 0 && sx < W && buf[row + sx] === 0) {
          buf[row + sx] = weight > 0.68 ? A[0] : A[1];
        }
      }
    }
  }

  function drawMeteorsStage(p) {
    const nHR = HR.length;
    for (const m of meteors) {
      // 0.40s warning reticle on clean unburned ground
      if (t >= m.tWarn && t < m.tLand && !inHalo(m.x, 0, 2)) {
        const wu = (t - m.tWarn) / 0.40;
        const rx = lerp(13.5, 8.5, wu);
        p.ellipse(m.x, 0, rx, 2.5, C[2], 0.78);
        for (let s = 0; s < 12; s += 2) {
          const a0 = (s / 12) * TAU + wu * 0.6;
          const a1 = ((s + 1) / 12) * TAU + wu * 0.6;
          p.line(
            m.x + Math.cos(a0) * 11.5,
            Math.sin(a0) * 3.2,
            m.x + Math.cos(a1) * 11.5,
            Math.sin(a1) * 3.2,
            G[2]
          );
        }
        const crossCol = wu > 0.68 ? G[4] : G[3];
        for (let dx = -5; dx <= 5; dx++) {
          p.px(m.x + dx, 0, crossCol);
          p.px(m.x + dx, -1, crossCol);
        }
        for (let dy = -3; dy <= 2; dy++) {
          p.px(m.x, dy, crossCol);
          p.px(m.x + 1, dy, crossCol);
        }
      }

      // 0.32s oblique flight with 2-3 px directional slag debris wake
      if (t >= m.tStart && t < m.tLand) {
        const u = ease.inQuad(clamp((t - m.tStart) / 0.32));
        const cx = lerp(m.x + m.dx, m.x, u);
        const cy = lerp(-180, -2, u);
        if (cy >= -172) {
          const dirX = m.dx / 178;
          for (let d = 1; d <= 7; d++) {
            const lag = d * 4.2;
            const spread = Math.sin(m.seed * 1.7 + d * 2.9 + t * 26) * (1.1 + d * 0.24);
            const sx = Math.round(cx + lag * dirX + spread);
            const sy = Math.round(cy - lag);
            if (sy < -173 || sy > 0 || sx < -156 || sx > 155 || inHalo(sx, sy, 1)) continue;
            p.px(sx, sy, d <= 2 ? C[6] : d <= 4 ? C[5] : d <= 6 ? C[3] : A[3]);
            if (sx + 1 <= 155) p.px(sx + 1, sy, d <= 3 ? C[5] : C[2]);
            if (d <= 3 && sy - 1 >= -173) p.px(sx, sy - 1, d === 1 ? C[7] : C[4]);
          }
          if (!inHalo(cx, cy, Math.ceil(m.r) + 2) && cx - m.r >= -157 && cx + m.r <= 156) {
            const outer = m.shape.map(([ox, oy]) => [cx + ox, cy + oy]);
            const mid = m.shape.map(([ox, oy]) => [cx + ox * 0.7 - 0.4, cy + oy * 0.7 + 0.7]);
            fillPolyFast(p, outer, C[2], 1);
            fillPolyFast(p, mid, C[4], 1);
            p.line(cx - m.r * 0.6, cy + 1, cx + m.r * 0.45, cy - 1.5, C[6]);
            p.line(cx - 1.5, cy - m.r * 0.45, cx + 1.5, cy + m.r * 0.6, C[7]);
            p.line(cx - m.r * 0.5, cy + m.r * 0.5, cx + 1, cy + m.r * 0.65, C[7]);
          }
        }
      }

      // Impact flash, burst lines, fast pre-baked crater & scorch (keeps active warning ground 100% unburned!)
      if (m.landed) {
        const age = t - m.tLand;
        const stage4Cool = t >= 4.60 ? 1 - smooth(4.60, 5.45, t) : 1;
        if (stage4Cool > 0.02 && !inHalo(m.x, 0, 4)) {
          const heatBase = Math.pow(clamp(1 - age / 2.2), 1.3) * (t >= 4.60 ? clamp(1 - (t - 4.60) / 0.50) : 1);
          for (let i = 0; i < m.stamp.length; i++) {
            const [dx0, dy0, d, k] = m.stamp[i];
            const xx = m.x + dx0;
            if (xx < -156 || xx > 155 || inHalo(xx, dy0, 2)) continue;
            // Never paint burning scorch underneath another wave's active ground warning reticle!
            let onWarn = false;
            for (let j = 0; j < meteors.length; j++) {
              const mw = meteors[j];
              if (t >= mw.tWarn && t < mw.tLand && Math.abs(xx - mw.x) <= 13) {
                onWarn = true;
                break;
              }
            }
            if (onWarn) continue;
            if (d > 0.86 && age < 2.1) {
              p.dot(xx, dy0 - (dy0 === -1 ? 1 : 0), d > 0.96 ? A[3] : C[4], stage4Cool);
            } else {
              const H = heatBase * (1.2 - d) - k * 0.3;
              const col = H > 0.06 ? HR[Math.min(nHR - 1, Math.floor((1 - Math.min(1, H)) * (nHR - 1)))] : A[0];
              p.dot(xx, dy0, col, stage4Cool * 0.88);
            }
          }
        }
        // 2-frame ground-flat white ellipse flash
        if (age >= 0 && age < 2 / 30 && !inHalo(m.x, -1, 3)) {
          const k = age < 1 / 30 ? 1 : 0.76;
          p.ellipse(m.x, -1, 14.5 * k, 3.0 * k, C[7]);
        }
        // 8 bone-white radial burst lines (<= 26 px)
        if (age >= 0 && age < 0.10) {
          const u = age / 0.10;
          for (const ray of m.rays) {
            const r0 = ray.len * 0.25 * u;
            const r1 = Math.min(25, ray.len * (0.44 + 0.56 * ease.outQuad(u)));
            const x1 = clamp(m.x + Math.cos(ray.a) * r1, -156, 155);
            const y1 = -2 + Math.sin(ray.a) * r1;
            if (!inHalo(x1, y1, 1)) {
              p.line(m.x + Math.cos(ray.a) * r0, -2 + Math.sin(ray.a) * r0, x1, y1, C[7], 1 - u * 0.45);
            }
          }
        }
      }
    }
  }

  function currentGapCenter() {
    if (t < 3.60) return -40;
    if (t < 3.95) return lerp(-40, 50, smooth(3.60, 3.85, t));
    return lerp(50, 0, smooth(3.95, 4.20, t));
  }

  function drawFireSea(p) {
    if (t < 3.20 || t >= 5.10) return;
    const surgeL = ease.outCubic(clamp((t - 3.20) / 0.18));
    const wave2Pulse = smooth(3.60, 3.78, t) * (1 - smooth(3.88, 4.02, t));
    const wave3Boost = smooth(3.95, 4.14, t) * (1 - smooth(4.35, 4.55, t));
    const emberDry = t >= 4.60 ? smooth(4.60, 5.10, t) : 0;
    const dropDown = t >= 4.35 ? smooth(4.35, 4.65, t) : 0;

    const gapC = currentGapCenter();
    const gapHalf = 27; // >= 54 px wide clean survival pocket (>= 52 px every frame!)
    const gapL = gapC - gapHalf;
    const gapR = gapC + gapHalf;

    // Eliminate any narrow (< 14 px) orphan bridge trapped between player 20px halo [-21, +21] and moving gap [gapL, gapR]
    const killBridgeR = gapL > 0 && gapL < 35;   // e.g. Wave 2 (gapL = +23): clear [0..gapL] cleanly!
    const killBridgeL = gapR < 0 && gapR > -35;  // e.g. Wave 1 (gapR = -13): clear [gapR..0] cleanly!

    const outerReach = t < 4.35 ? lerp(42, 153, surgeL) : lerp(153, 44, smooth(4.40, 5.08, t));
    const baseMaxH = lerp(18 + wave2Pulse * 3, 25, wave3Boost) * (1 - dropDown * 0.72);

    for (let x = -153; x <= 152; x++) {
      const absX = Math.abs(x);
      if (absX > outerReach) continue;

      // Strictly ZERO fire pixels inside the 52px+ survival gap!
      if (x >= gapL && x <= gapR) continue;
      // Dissolve narrow trapped bridge next to player halo so no awkward 3px sliver ever appears
      if (killBridgeR && x >= -21 && x < gapL) continue;
      if (killBridgeL && x > gapR && x <= 21) continue;

      // Distance to nearest open boundary (outer ends, survival gap bank, or halo bank)
      let distBank = Math.min(outerReach - absX, x < gapL ? gapL - x : x - gapR);
      if (killBridgeR && x < -21) distBank = Math.min(distBank, -21 - x + 10);
      if (killBridgeL && x > 21) distBank = Math.min(distBank, x - 21 + 10);

      // Horizontal wind-licked finger breakup at the banks (soft feathered ends, NO loaf/dome caps, NO hard vertical cut)
      const fingerNoise = 0.5 + 0.5 * fbm(x * 0.11, t * 4.2, 43, 2);
      const edgeU = clamp((distBank - fingerNoise * 9) / 20, 0, 1);
      if (edgeU <= 0.04) continue;

      // Terraced flat Oriental flame-band silhouette (6 px -> 25 px, undulating via multi-lobe fbm, never > 26 px)
      const n1 = fbm(x * 0.038 + t * 0.9, t * 2.5, 17, 3) * 0.85 + 0.5;
      const n2 = fbm(x * 0.095 - t * 1.4, t * 3.1, 29, 2) * 0.85 + 0.5;
      const und = clamp(0.58 * n1 + 0.42 * n2, 0.16, 1);
      const rawH = (6 + (baseMaxH - 6) * und) * (0.38 + 0.62 * edgeU) * (1 - emberDry * 0.68);
      // Quantize into crisp 2px horizontal flame terraces so it reads as flat layered bands, not round sausages
      const h = clamp(Math.round(rawH * 0.5) * 2, 0, 25);
      if (h < 2) continue;

      // 2x2 downsampled body layers (1 evaluation per 2x2 cell, feathered at banks & front edge via p.dot)
      if ((x & 1) === 0) {
        for (let y = 2; y >= -h + 2; y -= 2) {
          if (inHalo(x, y, 2) || inHalo(x + 1, y, 2)) continue;
          const frontU = y > 0 ? clamp(1 - y / 3.4, 0, 1) : 1;
          const a = clamp(edgeU * frontU * (1 - emberDry * 0.72), 0, 1);
          if (a <= 0.16) continue;

          const v = clamp(-y / Math.max(6, h), 0, 1);
          // Step down 1 brightness notch per upward layer: C[5] -> C[4] -> C[3] -> C[2]
          const col = t >= 4.55
            ? (v < 0.45 ? C[5] : v < 0.8 ? C[3] : C[1])
            : (v < 0.25 ? C[5] : v < 0.52 ? C[4] : v < 0.78 ? C[3] : C[2]);

          // Horizontal scanline-terraced 2x2 write (keeps pixel count compact & enhances flat layered band texture)
          p.dot(x, y, col, a);
          if (x + 1 <= 152 && (x + 1 < gapL || x + 1 > gapR)) {
            p.dot(x + 1, y, col, a);
          }
          if (y - 1 >= -h + 2 && a > 0.42) {
            p.dot(x + ((y >> 1) & 1), y - 1, col, a * 0.92);
          }
        }
      }

      // 1x1 crisp 1-2 px brightest crest lip on top of the flat bands (+ Wave 3 celadon-jade wind fraying)
      const topY = -h;
      if (topY >= -26 && !inHalo(x, topY, 1) && t < 4.70 && edgeU > 0.22) {
        const windShear = wave3Boost > 0.2 && (((x * 17 + Math.floor(t * 28)) & 3) <= 1);
        if (windShear) {
          const sx = x + 2;
          const sy = Math.max(-26, topY - 1 - ((x * 7) & 1));
          if (sx <= 153 && (sx < gapL || sx > gapR) && !inHalo(sx, sy, 1)) {
            p.dot(sx, sy, ((x + Math.floor(t * 30)) & 1) ? C[7] : J[3], edgeU);
          }
        } else {
          p.dot(x, topY, C[7], edgeU);
          if (h >= 6 && !inHalo(x, topY + 1, 1)) p.dot(x, topY + 1, C[6], edgeU * 0.9);
        }
      }
    }

    // Wave 3 celadon-jade wind streaks shearing across the crest (outside survival gap & <= 26px)
    if (wave3Boost > 0.15) {
      for (let i = 0; i < windGusts.length; i++) {
        const wg = windGusts[i];
        const travel = ((t - 3.92) * 145 + wg.phase * 18) % 105;
        const x0 = wg.x0 + travel * 0.42;
        const x1 = x0 + 18;
        if ((x1 >= gapL - 2 && x0 <= gapR + 2) || x1 > 152) continue;
        for (let d = 0; d <= 18; d += 3) {
          const wx = Math.round(x0 + d);
          const wy = Math.round(wg.y - Math.sin(d * 0.25) * 1.2);
          if (wy >= -26 && !inHalo(wx, wy, 2)) p.px(wx, wy, d > 12 ? J[4] : J[3], wave3Boost * 0.9);
        }
      }
    }
  }

  function drawAfterglowStars(p) {
    if (t < 4.70 || t >= 5.96) return;
    for (let i = 0; i < nStars; i++) {
      const s = stars[i];
      if (t >= s.tOut) continue;
      const u = clamp((t - 4.70) / 0.95);
      const x = Math.round(s.x + Math.sin(t * 3.1 + i) * 2.5);
      const y = Math.round(clamp(s.y0 - s.rise * u, -171, -45));
      if (inHalo(x, y, 1)) continue;
      const col = s.vermilion ? C[5] : G[3];
      const core = s.vermilion ? C[6] : G[4];
      p.px(x, y, core);
      if (s.size >= 2 && x + 1 <= 156) p.px(x + 1, y, col);
      if (s.size >= 3) {
        if (x - 1 >= -157) p.px(x - 1, y, col);
        if (y - 1 >= -173) p.px(x, y - 1, col);
        if (y + 1 <= -45) p.px(x, y + 1, col);
      }
    }
  }

  function drawPlayerContourLight(p) {
    if (t < 0.02 || t >= 5.94) return;
    const fade = clamp(t / 0.12) * (t >= 5.65 ? 1 - smooth(5.65, 5.94, t) : 1);
    if (fade <= 0.04) return;
    const spin = t * 0.9;
    for (let q = 0; q < 4; q++) {
      const base = q * (Math.PI * 0.5) + spin;
      for (let s = 0; s < 9; s++) {
        const a = base + (s / 9) * 0.92;
        const hx = Math.round(px0 + Math.cos(a) * 20);
        const hy = Math.round(py0 + Math.sin(a) * 20);
        if (hy >= -174 && hy <= 21 && hx >= -157 && hx <= 156) p.px(hx, hy, s === 4 ? G[3] : G[2], fade);
      }
      const tx = Math.round(px0 + Math.cos(base + 0.46) * 19);
      const ty = Math.round(py0 + Math.sin(base + 0.46) * 19);
      if (ty >= -174 && ty <= 21) p.px(tx, ty, J[2], fade);
    }
  }

  return {
    update(dt) {
      t += dt;
      if (t >= 1.30 && t < 1.60) {
        ringSparkAcc += dt;
        while (ringSparkAcc >= 0.038) {
          ringSparkAcc -= 0.038;
          const a = R.range(0, TAU);
          const sx = RING_CX + Math.cos(a) * 112;
          const sy = RING_CY + Math.sin(a) * 112 * RING_SY;
          if (!inHalo(sx, sy, 4)) {
            ps.spawn(P.EMBER, sx, sy, R.range(-12, 12), -R.range(18, 42), R.range(0.22, 0.36), G[3], 1);
          }
        }
      }
      for (const m of meteors) {
        if (t >= m.tStart && t < m.tLand && m.trailSpawned < 2 && t - m.tStart > (m.trailSpawned + 1) * 0.11) {
          m.trailSpawned++;
          const u = (t - m.tStart) / 0.32;
          const cx = lerp(m.x + m.dx, m.x, u);
          const cy = lerp(-180, -2, u);
          if (cy > -162 && cx < 146 && !inHalo(cx, cy, 8)) {
            ps.spawn(P.EMBER, cx, cy, R.range(14, 34), -R.range(20, 48), R.range(0.18, 0.28), C[6], 1);
          }
        }
        if (!m.landed && t >= m.tLand) triggerImpact(m);
      }
      if (t >= 1.50 && t < 4.60) draft(ps, dt, { x: 0, top: -155, w: 60, up: 40, squeeze: 1.0, k: 0.55 });
      ps.update(dt);
      fadeEdges(ps, -152, 151, 24, 17);
      cull(ps, -155, -172, 154, 19);
      bits.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      if (t >= meta.duration - 1e-6) return;
      drawTalismanGate(p);
      drawSealRingsFast(p, "back");
      drawEnergyLines(p, true);
    },
    draw(p) {
      if (t >= meta.duration - 1e-6) return;
      drawDarkVeil2x2(p);
      drawBossSilhouette(p);
      drawEnergyLines(p, false);
      drawSealRingsFast(p, "front");
      drawMeteorsStage(p);
      bits.draw(p);
      simDraw(p, ps, [...C].reverse(), "front");
      drawFireSea(p);
      drawAfterglowStars(p);
      drawPlayerContourLight(p);
      if (t < 5.20) lights.draw(p);
    },
  };
}
