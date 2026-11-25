// Scalloped cumulus puff shading, internal storm-vein illumination, thick Z-bolt inking, impact shockwaves,
// and cartoon smoke-ring dissipation build on ../lightning/storm-cloud.js, ../lightning/_lib.js,
// ../impacts/_lib.js, and ../spawn/poof.js (adapted from Sprite Fusion's open-source VFX, MIT, Hugo Duprez).
import {
  Particles,
  Lights,
  P,
  Rng,
  fit,
  band,
  flare,
  sparkle,
  clamp,
  smooth,
  seg,
  ease,
  lerp,
  rand,
  TAU,
  WHITE,
  mix,
} from "../../core/index.js";
import { Grid, shadow } from "./_lib.js";
import { stroke, crackle, trace, zigzag, scorch, SOOT } from "../lightning/_lib.js";
import { spikes, star, brokenRing, makeCracks, drawCracks, frontCrescent, dustRing } from "../impacts/_lib.js";

export const meta = {
  name: "Thundercloud puff",
  desc: "A white cloud puff blinks yellow bean eyes, glides on static sparks leaving mist, swells into a dark-purple thunderhead to cleave a golden Z-bolt, then deflates in smoke.",
  tags: ["critter", "monster", "cloud", "lightning", "thunder", "cute", "berserk", "one-shot"],
  size: [224, 148],
  origin: [112, 110],
  duration: 7.2,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#263052", "#495a8a", "#8ba2d4", "#bfd3f7", "#e2edff", "#f6f9ff", "#ffffff"],
    storm: ["#0a0417", "#180b33", "#2e175c", "#4e2a91", "#7c49cc", "#c89eff"],
    bolt: ["#6e2c04", "#b85408", "#e8840e", "#ffaa18", "#ffd026", "#ffe86e", "#fff8c8", "#ffffff"],
    seed: 7,
  },
};

// 4-Stage Choreography Timeline (seconds):
// 0.00..1.85  【待机 Idle】   Fluffy pure-white cloud-ball bobs gently & blinks two bright-yellow bean eyes
// 1.85..3.20  【移动 Move】   Stretches & leans forward, glides fast scraping static sparks + cloud-mist trail
// 3.20..5.10  【攻击 Attack】 Instant dark-purple shift & violent swell, thunderclap flash + thick golden Z-bolt
// 5.10..7.20  【倒地 KO】     Internal thunder dies, rapidly deflates flat like leaking air, pops into white smoke ring
const T_MOVE = 1.85;
const T_DASH = 2.02;
const T_BRAKE = 2.96;
const T_ATK = 3.20;
const T_STRIKE = 3.90;
const T_IMPACT = 3.94;
const T_BOLT_END = 4.46;
const T_KO = 5.10;
const T_DEFLATE = 5.48;
const T_POP = 6.02;

const X_IDLE = -60;
const X_ATK = -14;
const X_RECOIL = -22;
const X_HIT = 65;

// Distinct round cumulus puffs [ox, oy, rxFrac, ryFrac, zLayer, phase]
// Placed around the perimeter so each puff forms a crisp, bouncy semicircular cloud scallop!
const PUFF_LOBES = [
  // Back / Crown & Core scallops (zLayer = 0)
  [0.00, -0.04, 0.72, 0.68, 0, 0.0],
  [-0.46, -0.44, 0.48, 0.50, 0, 0.8],
  [0.02, -0.62, 0.56, 0.56, 0, 2.1],
  [0.46, -0.42, 0.47, 0.49, 0, 3.5],
  [-0.74, -0.02, 0.45, 0.47, 0, 1.4],
  [0.72, 0.00, 0.45, 0.47, 0, 4.2],
  // Lower cheek & belly cushion scallops (zLayer = 1 — subtle soft inner pillow folds!)
  [-0.50, 0.28, 0.48, 0.44, 1, 2.7],
  [0.02, 0.34, 0.54, 0.44, 1, 3.9],
  [0.50, 0.28, 0.48, 0.44, 1, 5.1],
];

// Extra boiling thunderhead anvil lobes that erupt outward during Berserk Attack!
const STORM_LOBES = [
  [-0.68, -0.52, 0.44, 0.44, 0, 1.7],
  [0.58, -0.56, 0.48, 0.46, 0, 4.8],
  [-0.86, 0.16, 0.38, 0.38, 0, 0.4],
  [0.82, -0.14, 0.40, 0.40, 0, 3.1],
];

// Build a bold, unmistakable Z-shaped golden lightning bolt from (x0,y0) -> (x1,y1) -> (x2,y2) -> (x3,y3)
function makeZBolt(R, x0, y0, x1, y1, x2, y2, x3, y3, jag = 1.45) {
  const leg = (ax, ay, bx, by, n) => {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L, pts = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const env = i === 0 || i === n ? 0 : Math.sin(u * Math.PI);
      const off = env * R.range(-jag, jag);
      pts.push([ax + dx * u + nx * off, ay + dy * u + ny * off]);
    }
    return pts;
  };
  const a = leg(x0, y0, x1, y1, 5);
  const b = leg(x1, y1, x2, y2, 5);
  const c = leg(x2, y2, x3, y3, 6);
  const main = [...a, ...b.slice(1), ...c.slice(1)];

  // Razor-sharp anime lightning corner spurs on Knee 1 (upper-right) & Knee 2 (mid-left)
  const spur1 = [
    [x1 - 3, y1 + 0.6],
    [x1 + R.range(7, 11), y1 - R.range(2.5, 5.0)],
  ];
  const spur2 = [
    [x2 + 3, y2 - 0.6],
    [x2 - R.range(7, 11), y2 + R.range(1.5, 4.0)],
  ];
  return { main, spur1, spur2, k1: [x1, y1], k2: [x2, y2] };
}

function clipPath(pts, frac) {
  if (frac >= 1) return pts;
  if (frac <= 0 || pts.length < 2) return [];
  let total = 0;
  const lens = [];
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    lens.push(d);
    total += d;
  }
  let rem = total * frac;
  const out = [pts[0]];
  for (let i = 0; i < lens.length; i++) {
    if (rem <= 0) break;
    const d = lens[i];
    if (rem >= d) {
      out.push(pts[i + 1]);
      rem -= d;
    } else {
      const f = rem / (d || 1);
      out.push([
        pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f,
        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f,
      ]);
      break;
    }
  }
  return out;
}

function poseAt(t) {
  let x = X_IDLE;
  let by = -6;
  let hw = 16.5;
  let hh = 13.8;
  let lean = 0;
  let glideK = 0;
  let stormMix = 0;
  let stormSwell = 0;
  let charge = 0;
  let flash = 0;
  let boil = 1;
  let blink = 0;
  let lookX = 1;
  let expr = "idle"; // "idle" | "move" | "berserk" | "ko" | "flat"
  let alive = true;
  let pancake = 0;

  if (t < T_MOVE) {
    // STAGE 1: IDLE — gentle floating bob + two bright-yellow bean eyes blinking
    const spawnK = ease.outBack(clamp(t / 0.16), 1.4);
    const bob = Math.sin(t * TAU * 0.85);
    const breathe = Math.sin(t * TAU * 0.85 + 1.1);
    by = -6.0 - 3.8 * bob;
    hw = 16.6 * (1 - 0.04 * breathe) * (0.86 + 0.14 * spawnK);
    hh = 14.0 * (1 + 0.045 * breathe) * (0.86 + 0.14 * spawnK);
    lean = 0.04 * Math.sin(t * TAU * 0.42);

    // Clear, expressive single blink (0.54..0.70) + cute double-blink (1.20..1.34 & 1.42..1.55)
    const b1 = 1 - Math.abs(seg(t, 0.54, 0.70) * 2 - 1);
    const b2 = 1 - Math.abs(seg(t, 1.20, 1.34) * 2 - 1);
    const b3 = 1 - Math.abs(seg(t, 1.42, 1.55) * 2 - 1);
    blink = Math.max(
      t > 0.54 && t < 0.70 ? b1 : 0,
      t > 1.20 && t < 1.34 ? b2 : 0,
      t > 1.42 && t < 1.55 ? b3 : 0
    );
    if (t > 1.60) lookX = 2;
  } else if (t < T_ATK) {
    // STAGE 2: MOVE — anticipation dip -> forward-tilted aerodynamic stretch & static-spark glide
    expr = "move";
    lookX = 2;
    if (t < T_DASH) {
      const u = ease.inOutSine(seg(t, T_MOVE, T_DASH));
      x = lerp(X_IDLE, X_IDLE - 4, u);
      by = lerp(-6.0, -1.5, u);
      hw = lerp(16.6, 18.8, u);
      hh = lerp(14.0, 12.2, u);
      lean = lerp(0, -0.18, u);
    } else if (t < T_BRAKE) {
      const u = seg(t, T_DASH, T_BRAKE);
      const easeGlide = u < 0.16 ? ease.inQuad(u / 0.16) * 0.14 : 0.14 + 0.86 * ease.outCubic((u - 0.16) / 0.84);
      x = lerp(X_IDLE - 4, X_ATK + 3, easeGlide);
      const speedEnv = Math.sin(Math.pow(u, 0.65) * Math.PI);
      glideK = clamp(speedEnv * 1.2);
      by = -1.4 - 0.7 * Math.sin(u * TAU * 4);
      // Plump leading head + forward-leaning stretch (not a flat pancake!)
      hw = 17.5 + 5.2 * glideK;
      hh = 13.6 - 1.8 * glideK;
      lean = 0.58 * glideK;
      boil = 1.8;
    } else {
      const u = seg(t, T_BRAKE, T_ATK);
      const k = ease.outBack(u, 1.9);
      x = lerp(X_ATK + 3, X_ATK, k);
      by = lerp(-1.4, -4.0, ease.outCubic(u));
      hw = lerp(20.0, 17.0, k);
      hh = lerp(12.4, 14.2, k);
      lean = lerp(0.30, -0.06, ease.outCubic(u));
    }
  } else if (t < T_KO) {
    // STAGE 3: ATTACK — instant dark-purple storm transformation & violent ~1.85x berserk swell!
    expr = "berserk";
    lookX = 2;
    stormMix = ease.outCubic(clamp((t - T_ATK) / 0.14));

    if (t < T_STRIKE) {
      const u = seg(t, T_ATK, T_STRIKE);
      const swell = ease.outBack(clamp(u / 0.68), 1.85);
      stormSwell = clamp(swell);
      const tremor = Math.sin(t * 84) * (0.7 + 1.8 * u);
      x = X_ATK - 2.5 * u + tremor * 0.65;
      by = lerp(-4.0, -14.5, ease.outCubic(u)) + Math.cos(t * 68) * 0.7;
      hw = lerp(17.0, 27.5, swell) + 0.9 * Math.sin(t * 46);
      hh = lerp(14.2, 22.2, swell) - 0.8 * Math.sin(t * 46);
      lean = lerp(-0.06, -0.22 * smooth(0.6, 1, u), u);
      charge = clamp(0.28 + 0.72 * u * u);
      boil = 3.5 + 2.5 * u;
    } else {
      const dtS = t - T_STRIKE;
      stormSwell = 1 - 0.22 * smooth(0.45, 1.15, dtS);
      const strikeEnv = Math.exp(-dtS * 4.5);
      const recoil = dtS < 0.07 ? lerp(-4, 6, dtS / 0.07) : lerp(6, 0, ease.outCubic(clamp((dtS - 0.07) / 0.52)));
      x = lerp(X_ATK, X_RECOIL, ease.outCubic(clamp(dtS / 0.32))) - recoil * 0.75 + Math.sin(t * 65) * 1.3 * strikeEnv;
      const pant = dtS > 0.52 ? Math.sin((dtS - 0.52) * TAU * 2.3) : 0;
      by = lerp(-14.5, -9.0, smooth(0.45, 1.15, dtS)) + pant * 1.1;
      hw = lerp(28.2, 23.5, smooth(0.35, 1.15, dtS)) * (1 + 0.04 * pant);
      hh = lerp(22.6, 18.2, smooth(0.35, 1.15, dtS)) * (1 - 0.04 * pant);
      lean = dtS < 0.14 ? 0.28 : lerp(0.28, 0.05, clamp((dtS - 0.14) / 0.45));
      flash = dtS < 0.54 ? Math.max(0, 1 - dtS / 0.54) : 0;
      charge = clamp(1.0 - smooth(0.45, 1.15, dtS) * 0.55);
      boil = 4.6 - 2.2 * clamp(dtS / 1.1);
    }
  } else if (t < T_POP) {
    // STAGE 4A: KO — internal thunder extinguishes -> rapid air-leak flattening onto ground!
    x = X_RECOIL;
    if (t < T_DEFLATE) {
      expr = "ko";
      const u = seg(t, T_KO, T_DEFLATE);
      // Two crisp dying thunder-vein flickers before complete power blackout
      const stutter = (t > 5.14 && t < 5.20) || (t > 5.26 && t < 5.31) ? 0.85 : 0;
      charge = stutter * (1 - u * 0.5);
      stormSwell = (1 - u) * 0.6;
      stormMix = 1 - ease.inOutQuad(clamp((t - T_KO) / 0.34));
      by = lerp(-9.0, -0.4, ease.inQuad(u));
      hw = lerp(23.5, 18.5, u) + Math.sin(u * TAU * 3) * 0.7;
      hh = lerp(18.2, 13.5, u) - Math.sin(u * TAU * 3) * 0.7;
      lean = 0.07 * Math.sin(u * TAU * 2);
      boil = 1.0;
    } else {
      const u = seg(t, T_DEFLATE, T_POP);
      expr = u < 0.42 ? "ko" : "flat";
      stormMix = 0;
      charge = 0;
      pancake = ease.outQuart(u);
      // Hissing balloon-leak lateral shudder as air escapes
      const leakWobble = Math.sin(u * TAU * 5.0) * (1 - u) * 3.4;
      x = X_RECOIL + leakWobble;
      by = 0;
      hw = lerp(18.5, 26.5, pancake) * (1 + 0.05 * Math.sin(u * TAU * 6));
      hh = lerp(13.5, 2.7, ease.inOutCubic(u));
      lean = leakWobble * 0.05;
      boil = 0.5;
    }
  } else {
    alive = false;
  }

  return {
    x,
    by,
    hw,
    hh,
    lean,
    glideK,
    stormMix,
    stormSwell,
    charge,
    flash,
    boil,
    blink,
    lookX,
    expr,
    alive,
    pancake,
  };
}

// Render scalloped multi-puff cloud body + internal storm veins + expressive yellow bean eyes
function drawPuffBody(g, C, S, B, st, t) {
  g.clear();
  if (!st.alive) return;

  const { x: cx, by, hw, hh, lean, glideK, stormMix, stormSwell, charge, flash, boil, expr, pancake } = st;
  const cy = by - hh * 0.88;

  // 1. Assemble distinct round cumulus lobes [lx, ly, rx, ry, zLayer]
  const lobes = [];
  for (let i = 0; i < PUFF_LOBES.length; i++) {
    const [ox, oy, rxf, ryf, zLayer, ph] = PUFF_LOBES[i];
    const amp = (0.42 + 0.85 * stormMix) * (1 - pancake * 0.8);
    const wobX = Math.sin(t * (2.5 * boil) + ph) * amp;
    const wobY = Math.cos(t * (2.2 * boil) + ph * 1.3) * amp;
    // Forward lean shifts upper puffs (+x when oy < 0) while base stays grounded!
    const leanShift = -oy * hh * lean * 1.25;
    // Slight backward taper on rear puffs during Move
    const glideStretchX = glideK > 0 && ox < 0 ? ox * hw * 0.28 * glideK : 0;
    const lx = cx + ox * hw + leanShift + glideStretchX + wobX;
    const ly = Math.min(by - 0.3, cy + oy * hh + wobY * Math.min(1, hh / 8));
    lobes.push([lx, ly, Math.max(2.4, rxf * hw), Math.max(1.6, ryf * hh), zLayer]);
  }

  // Boiling thunderhead anvil knuckles during Berserk Attack!
  if (stormSwell > 0.05) {
    for (let i = 0; i < STORM_LOBES.length; i++) {
      const [ox, oy, rxf, ryf, zLayer, ph] = STORM_LOBES[i];
      const wobX = Math.sin(t * 14 + ph) * 1.3 * stormSwell;
      const wobY = Math.cos(t * 13 + ph * 1.4) * 1.2 * stormSwell;
      const lx = cx + ox * hw * (0.75 + 0.30 * stormSwell) - oy * hh * lean + wobX;
      const ly = Math.min(by - 0.5, cy + oy * hh * (0.75 + 0.30 * stormSwell) + wobY);
      lobes.push([lx, ly, rxf * hw * stormSwell + 1.5, ryf * hh * stormSwell + 1.5, zLayer]);
    }
  }

  // Streamlined trailing cloud-tail puffs during high-speed Move (`身体向前拉长倾斜`)
  if (glideK > 0.04) {
    lobes.push([
      cx - hw * (0.78 + 0.34 * glideK),
      Math.min(by - 1.0, cy + hh * 0.12 + Math.sin(t * 26) * 0.9),
      hw * (0.40 + 0.08 * glideK),
      Math.max(2.4, hh * 0.44),
      0,
    ]);
    lobes.push([
      cx - hw * (1.10 + 0.46 * glideK),
      Math.min(by - 1.2, cy + hh * 0.22 + Math.cos(t * 30) * 1.0),
      hw * (0.28 * glideK) + 2.4,
      Math.max(2.0, hh * 0.32),
      0,
    ]);
  }

  // Face center (used to protect the angry eyes' dark storm mask from bright internal glow!)
  const faceX = cx + st.lookX + lean * hh * 0.42 + (expr === "move" ? hw * 0.24 : hw * 0.10);
  const faceY = cy + (expr === "flat" ? 0 : expr === "move" ? -hh * 0.02 : -hh * 0.08);

  const nCells = g.w * g.h;
  if (!g._nx || g._nx.length !== nCells) {
    g._nx = new Float32Array(nCells);
    g._ny = new Float32Array(nCells);
    g._seam = new Uint8Array(nCells);
  }

  const x0 = Math.floor(cx - hw * 1.85 - 8);
  const x1 = Math.ceil(cx + hw * 1.45 + 8);
  const y0 = Math.floor(cy - hh * 1.55 - 8);
  const y1 = Math.ceil(by + 1);

  // Pass 1: Crisp scalloped puff union + per-puff spherical normal + inner overlap pillow seams!
  g.shade(x0, y0, x1, y1, (x, y, o) => {
    const py = y + 0.5;
    if (py > by + 0.35) return 0;
    const px = x + 0.5;

    let bestScore = -99;
    let bestDx = 0;
    let bestDy = 0;
    let bestZ = 0;
    let smoothSum = 0;
    let nearFrontRim = false;

    for (let i = 0; i < lobes.length; i++) {
      const [lx, ly, rx, ry, zLayer] = lobes[i];
      const dx = (px - lx) / rx;
      const dy = (py - ly) / ry;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1.55) continue;
      const d = Math.sqrt(d2);
      // Sharp fillet union (`p = 6`) keeps every round cloud scallop crisp & distinct!
      if (d < 1.12) {
        const s = Math.max(0, 1.06 - d);
        smoothSum += s * s * s;
      }
      const score = (1 - d) + zLayer * 0.09;
      if (d <= 1.02 && score > bestScore) {
        bestScore = score;
        bestDx = dx;
        bestDy = dy;
        bestZ = zLayer;
      }
      if (zLayer === 1 && d > 1.0 && d < 1.17) {
        nearFrontRim = true;
      }
    }

    if (bestScore < -0.02 && smoothSum < 0.0012) return 0;

    const idx = g.idx(x, y);
    if (idx >= 0) {
      const domeX = (px - cx) / Math.max(4, hw);
      const domeY = (py - cy) / Math.max(2.5, hh);
      // 52% local puff sphere normal + 48% overall cloud dome normal -> bouncy 3D cumulus puffs!
      const mx = bestDx * 0.52 + domeX * 0.48;
      const my = bestDy * 0.52 + domeY * 0.48;
      const ml = Math.hypot(mx, my) || 1;
      g._nx[idx] = mx / ml;
      g._ny[idx] = my / ml;
      g._seam[idx] = bestZ === 0 && nearFrontRim ? 1 : 0;
    }

    o.t = 1;
    o.a = 1;
    return C[5];
  });

  g.depths(4);

  const koDrain = t >= T_KO ? smooth(T_KO, T_DEFLATE + 0.12, t) : 0;
  const staticBounce = expr === "move" && glideK > 0.15 ? 0.55 + 0.45 * Math.sin(t * 58) : 0;

  // Pass 2: Crisp Pixel-Art Cloud Shading (Snow-White Puff <-> Brooding Dark-Purple Thunderhead)
  g.recolor((x, y, col, al, tag) => {
    if (tag !== 1) return col;
    const idx = g.idx(x, y);
    const d = g.depth(x, y);
    const nx = g._nx[idx];
    const ny = g._ny[idx];
    const seam = g._seam[idx];
    const px = x + 0.5;
    const py = y + 0.5;

    // 1px directional pixel-art contour outline (`d === 1`)
    if (d === 1) {
      const topLeft = -0.55 * nx - 0.80 * ny;
      let outWhite = topLeft > 0.20 ? C[1] : C[0];
      if (koDrain > 0.3) outWhite = mix(outWhite, C[2], 0.25 * koDrain);
      let outStorm = topLeft > 0.38 ? S[2] : S[0];
      // Searing golden thunderclap rim on the storm-front during Z-bolt strike!
      if (flash > 0.14 && nx > 0.08 && ny < 0.5) {
        outStorm = flash > 0.58 ? B[4] : B[2];
      }
      return stormMix <= 0.01 ? outWhite : stormMix >= 0.99 ? outStorm : mix(outWhite, outStorm, stormMix);
    }

    const sun = -0.50 * nx - 0.82 * ny;
    const seamDip = seam && d >= 3 ? -0.26 : 0;
    const lit = sun + seamDip;

    // Pure-white fluffy marshmallow ramp (`蓬松洁白`)
    let cw =
      lit > 0.32 ? C[6]
      : lit > -0.05 ? C[5]
      : lit > -0.38 ? C[4]
      : lit > -0.66 ? C[3]
      : C[2];

    if (d === 2 && sun > 0.22) cw = C[6];

    // Underside electrostatic spark reflection during high-speed glide
    if (staticBounce > 0 && ny > 0.36 && d <= 3) {
      if (rand(x + ((t * 30) | 0), y, 19) > 0.38) {
        cw = mix(cw, B[3], 0.62 * staticBounce);
      }
    }

    if (koDrain > 0) cw = mix(cw, C[3], 0.22 * koDrain);

    if (stormMix <= 0.01 && charge <= 0.01) return cw;

    // Brooding dark-purple storm ramp (`暗紫色雷云`)
    let cs =
      lit > 0.52 ? S[4]
      : lit > 0.14 ? S[3]
      : lit > -0.32 ? S[2]
      : S[1];

    // Protect a dark abyssal storm mask around the angry eyes ONLY while in berserk storm mode!
    const eyeMaskDist = Math.hypot((px - faceX) / Math.max(8, hw * 0.58), (py - faceY) / Math.max(5, hh * 0.42));
    const eyeShield = clamp((eyeMaskDist - 0.76) / 0.40);
    if (expr === "berserk" && eyeMaskDist < 0.88 && d >= 2) {
      cs = eyeMaskDist < 0.62 ? S[0] : S[1];
    }

    // Organic sheet-lightning pockets pulsing inside the upper crown & rear thunderhead lobes (no geometric ring!)
    if (charge > 0.02 && eyeShield > 0.05) {
      const p1 = Math.hypot((px - (cx - hw * 0.46)) / Math.max(4, hw * 0.42), (py - (cy - hh * 0.42)) / Math.max(3, hh * 0.42));
      const p2 = Math.hypot((px - (cx + hw * 0.36)) / Math.max(4, hw * 0.42), (py - (cy - hh * 0.48)) / Math.max(3, hh * 0.42));
      const pulse1 = Math.max(0, 1 - p1) * (0.45 + 0.55 * Math.max(0, Math.sin(t * 34)));
      const pulse2 = Math.max(0, 1 - p2) * (0.45 + 0.55 * Math.max(0, Math.sin(t * 41 + 2.1)));
      const frontSurge = flash * 0.58 * Math.max(0, nx * 0.88 + 0.12);
      const gVal = (pulse1 * 0.58 + pulse2 * 0.58 + frontSurge) * charge * eyeShield;
      if (gVal > 0.68) cs = B[3];
      else if (gVal > 0.48) cs = B[2];
      else if (gVal > 0.28) cs = S[5];
      else if (gVal > 0.14) cs = S[4];
    }

    // Bright golden thunderclap rim-light along right/top ridges during Z-bolt cleave!
    if (flash > 0.10 && d === 2 && (nx > 0.06 || ny < -0.58)) {
      cs = flash > 0.52 ? B[3] : mix(cs, B[2], flash * 0.85);
    }

    return stormMix >= 0.99 ? cs : mix(cw, cs, stormMix);
  });

  // Pass 2.5: Crisp internal branching lightning veins flickering inside the upper/side dark-purple cloud!
  if (charge > 0.08 && hh > 8) {
    const veinSeed = ((t * 18) | 0) * 13 + 7;
    const anchors = [
      [-0.48, -0.46, 1, 1],
      [0.34, -0.52, -1, 1],
      [-0.64, 0.02, 1, 0],
      [0.54, -0.18, -1, 1],
    ];
    for (let v = 0; v < anchors.length; v++) {
      if (rand(veinSeed, v, 3) > 0.30 + 0.58 * charge) continue;
      const [ax, ay, dirX, dirY] = anchors[v];
      let vx = Math.round(cx + ax * hw);
      let vy = Math.round(cy + ay * hh);
      for (let step = 0; step < 8; step++) {
        const idx = g.idx(vx, vy);
        const d = g.depth(vx, vy);
        const distFace = Math.hypot(vx - faceX, vy - faceY);
        if (idx >= 0 && d >= 2 && distFace > 9.0) {
          g.set(vx, vy, step < 2 || flash > 0.4 ? WHITE : B[3], 0.95);
          const nIdx = g.idx(vx + 1, vy);
          if (nIdx >= 0 && g.depth(vx + 1, vy) >= 2 && distFace > 9.5) {
            g.set(vx + 1, vy, step < 3 ? B[2] : S[5], 0.88);
          }
        }
        vx += dirX + (rand(veinSeed + step, v, 11) > 0.52 ? 1 : -1);
        vy += dirY + (rand(veinSeed + step, v, 17) > 0.45 ? 1 : -1);
      }
    }
  }

  // Pass 3: Expressive Gap-Moe Pixel-Art Bean Eyes!
  drawEyes(g, C, S, B, st, cx, cy);
}

function drawEyes(g, C, S, B, st, cx, cy) {
  const { hw, hh, lean, blink, lookX, expr, charge } = st;
  const faceX = Math.round(cx + lookX + lean * hh * 0.42 + (expr === "move" ? hw * 0.24 : hw * 0.10));
  const faceY = Math.round(cy + (expr === "flat" ? 0 : expr === "move" ? -hh * 0.02 : -hh * 0.08));
  const sep = Math.max(4, Math.round(hw * 0.28));

  const putInBody = (x, y, col, a = 1) => {
    const i = g.idx(x, y);
    if (i >= 0 && g.c[i]) g.set(x, y, col, a);
  };

  if (expr === "flat") {
    for (const side of [-1, 1]) {
      const ex = faceX + side * sep;
      putInBody(ex - 1, faceY, C[0]);
      putInBody(ex, faceY, C[0]);
      putInBody(ex + 1, faceY, C[1]);
    }
    return;
  }

  if (expr === "ko") {
    // Squeezed '> <' power-outage eyes flickering from dim gold to dark slate as internal thunder dies!
    const coreCol = charge > 0.25 ? B[3] : C[0];
    for (const side of [-1, 1]) {
      const ex = faceX + side * sep;
      if (side < 0) {
        g.set(ex - 1, faceY - 1, C[0]);
        g.set(ex, faceY, coreCol);
        g.set(ex + 1, faceY, C[0]);
        g.set(ex - 1, faceY + 1, C[0]);
      } else {
        g.set(ex + 1, faceY - 1, C[0]);
        g.set(ex, faceY, coreCol);
        g.set(ex - 1, faceY, C[0]);
        g.set(ex + 1, faceY + 1, C[0]);
      }
    }
    return;
  }

  if (expr === "berserk") {
    // Fierce blazing golden slanted anger-eyes (`\ /`) + tiny crackling golden scowl against dark storm face!
    for (const side of [-1, 1]) {
      const ex = faceX + side * sep - (side > 0 ? 2 : 1);
      // Crisp dark obsidian socket
      for (let dy = -3; dy <= 2; dy++) {
        for (let dx = -1; dx <= 4; dx++) putInBody(ex + dx, faceY + dy, S[0]);
      }
      // 4x3 fiercely slanted golden-white fury eye!
      if (side < 0) {
        // Left eye slants down-right `\`
        g.set(ex, faceY - 2, B[2]);
        g.set(ex + 1, faceY - 2, B[3]);
        g.set(ex, faceY - 1, B[3]);
        g.set(ex + 1, faceY - 1, WHITE);
        g.set(ex + 2, faceY - 1, B[3]);
        g.set(ex + 1, faceY, B[3]);
        g.set(ex + 2, faceY, WHITE);
        g.set(ex + 3, faceY, B[3]);
        g.set(ex + 1, faceY + 1, B[2]);
        g.set(ex + 2, faceY + 1, B[2]);
      } else {
        // Right eye slants down-left `/`
        g.set(ex + 3, faceY - 2, B[2]);
        g.set(ex + 2, faceY - 2, B[3]);
        g.set(ex + 3, faceY - 1, B[3]);
        g.set(ex + 2, faceY - 1, WHITE);
        g.set(ex + 1, faceY - 1, B[3]);
        g.set(ex + 2, faceY, B[3]);
        g.set(ex + 1, faceY, WHITE);
        g.set(ex, faceY, B[3]);
        g.set(ex + 1, faceY + 1, B[2]);
        g.set(ex + 2, faceY + 1, B[2]);
      }
    }
    // Tiny jagged golden rage-mouth / gritted lightning fang between eyes during strike!
    if (st.flash > 0.2 || st.charge > 0.72) {
      g.set(faceX - 2, faceY + 3, B[2]);
      g.set(faceX - 1, faceY + 2, B[3]);
      g.set(faceX, faceY + 3, WHITE);
      g.set(faceX + 1, faceY + 2, B[3]);
      g.set(faceX + 2, faceY + 3, B[2]);
    }
    return;
  }

  // IDLE & MOVE: Two adorable bright-yellow bean eyes (`两只亮黄色豆豆眼`)!
  const beanH = expr === "move" ? 4 : blink > 0.70 ? 1 : blink > 0.30 ? 2 : 5;
  for (const side of [-1, 1]) {
    const ex = faceX + side * sep - 1;
    if (beanH === 1) {
      // Cute happy curved wink with bright yellow lash glint!
      putInBody(ex - 1, faceY + 1, C[0]);
      g.set(ex, faceY, C[0]);
      g.set(ex + 1, faceY, C[0]);
      g.set(ex + 2, faceY, C[0]);
      putInBody(ex + 3, faceY + 1, C[0]);
      g.set(ex + 1, faceY + 1, B[2]);
      continue;
    }

    const top = faceY - Math.floor(beanH / 2);
    // Clean 1px rounded dark-indigo border hugging a plump 2x4 / 2x5 golden-yellow bean!
    for (let dy = 0; dy < beanH; dy++) {
      putInBody(ex - 1, top + dy, C[0]);
      putInBody(ex + 2, top + dy, C[0]);
    }
    putInBody(ex, top - 1, C[0]);
    putInBody(ex + 1, top - 1, C[0]);
    putInBody(ex, top + beanH, C[0]);
    putInBody(ex + 1, top + beanH, C[0]);

    // Vivid saturated bright-yellow bean interior + crisp white specular dot!
    for (let dy = 0; dy < beanH; dy++) {
      const cL = dy === 0 ? WHITE : dy === 1 ? B[3] : B[2];
      const cR = dy <= 1 ? B[3] : dy === beanH - 1 ? B[1] : B[2];
      g.set(ex, top + dy, cL);
      g.set(ex + 1, top + dy, cR);
    }

    // Determined aerodynamic brow tilt when gliding fast
    if (expr === "move") {
      const inner = side < 0 ? ex + 1 : ex;
      g.set(inner, top, C[0]);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 7);
  const S = fit(o.storm, 6);
  const B8 = fit(o.bolt, 8);
  const B = [B8[1], B8[3], B8[4], B8[5], B8[6]];
  const R = new Rng(o.seed);
  const floor = () => 0;

  const grid = new Grid(-104, -96, 144, 102);
  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, B8[6], B8[5], B8[4], B8[3]],
    haze: C[4],
  });
  const lights = new Lights();

  const mouthSpikes = spikes(R, 12, 0.2, { len: [8, 14], w: [1.4, 2.1], fwd: 1.8, jag: 0.62 });
  const hitSpikes = spikes(R, 16, -Math.PI / 2, { len: [11, 18], w: [1.6, 2.4], fwd: 1.6, jag: 0.58 });
  const shockSegs = Array.from({ length: 12 }, (_, i) => ({
    a: (i / 12) * TAU + R.range(-0.09, 0.09),
    gap: R.range(0.32, 0.68),
    dr: R.range(0.06, 0.24),
    w: R.range(0.85, 1.35),
  }));
  const rawCracks = makeCracks(R, 9, { len: [12, 28], dive: 0.78, maxY: 16, forks: 0.6, x0: [1, 4] });
  for (const cr of rawCracks) {
    for (const pt of cr.pts) pt[0] += X_HIT;
    for (const kid of cr.kids) for (const pt of kid) pt[0] += X_HIT;
  }

  const mistPuffs = [];
  const leakPuffs = [];
  const koBalls = [];
  const koLines = [];
  const bodyArcs = [];

  let t = 0;
  let mistAcc = 0;
  let staticAcc = 0;
  let chargeAcc = 0;
  let leakAcc = 0;
  let idleMoteAcc = 0;
  let boltTimer = 0;
  let struck = false;
  let impacted = false;
  let restruck = false;
  let koTriggered = false;
  let popped = false;
  let activeZ = null;

  const spawnZVariant = (thickScale = 1) => {
    const x0 = X_ATK + 24;
    const y0 = -40;
    const x1 = 58 + R.range(-1.5, 1.5);
    const y1 = -36 + R.range(-1.2, 1.2);
    const x2 = 20 + R.range(-1.5, 1.5);
    const y2 = -17 + R.range(-1.2, 1.2);
    const x3 = X_HIT + R.range(-1, 1);
    const y3 = 0;
    const zb = makeZBolt(R, x0, y0, x1, y1, x2, y2, x3, y3, 1.5);
    const forks = [
      ...zigzag(R, x1, y1, x1 + R.range(14, 24), y1 + R.range(-11, 4), 0.28, 0.35, 0.65).paths,
      ...zigzag(R, x2, y2, x2 - R.range(10, 20), y2 + R.range(2, 11), 0.28, 0.35, 0.65).paths,
      ...zigzag(R, x3, -1, x3 + R.range(12, 24), -R.range(8, 18), 0.30, 0.30, 0.6).paths,
      ...zigzag(R, x3, -1, x3 - R.range(12, 22), -R.range(7, 16), 0.30, 0.30, 0.6).paths,
    ];
    activeZ = { ...zb, forks, thickScale };
  };

  const triggerStrike = () => {
    struck = true;
    spawnZVariant(1.08);
    boltTimer = 0.045;
    // Thunderclap sky & storm-cloud flash (`攻击时的雷鸣闪光`)
    lights.add(4, -44, 60, B[2], 0.72, 0.24);
    lights.add(-14, -36, 48, S[4], 0.65, 0.36);
  };

  const triggerImpact = () => {
    impacted = true;
    lights.add(X_HIT, -5, 24, B[3], 0.90, 0.30);
    lights.add(X_HIT, -3, 14, WHITE, 0.85, 0.14);

    // High-energy golden lightning spark burst at X_HIT (safely bounded within canvas!)
    for (let i = 0; i < 34; i++) {
      const a = -Math.PI / 2 + R.range(-1.32, 1.15);
      const sp = R.range(45, 142);
      const vx = Math.min(82, Math.cos(a) * sp);
      const vy = Math.sin(a) * sp - R.range(12, 42);
      ps.spawn(
        P.SPARK,
        X_HIT + R.range(-3, 3),
        -1.5,
        vx,
        vy,
        R.range(0.34, 0.76),
        R.pick([WHITE, B8[6], B8[5], B8[4]]),
        R.range(1.2, 2.0)
      );
    }
    for (let i = 0; i < 10; i++) {
      const s = R.sign();
      ps.spawn(P.DUST, X_HIT + s * R.range(2, 8), -1, s * R.range(20, 52), -R.range(5, 16), R.range(0.36, 0.64), B[3], R.range(1.8, 3.0));
    }
  };

  const triggerPop = () => {
    popped = true;
    const cx = X_RECOIL;
    const cy = -1.5;

    // 360° perspective ground ring of plump white cartoon smoke balls (`化作一圈白色烟雾散开`)
    const ringCount = 16;
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * TAU + R.range(-0.08, 0.08);
      const sp = R.range(96, 128);
      const r = R.range(4.8, 6.5);
      koBalls.push({
        x: cx + Math.cos(a) * 9,
        y: cy + Math.sin(a) * 3.2,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.34 - R.range(0.5, 2.2),
        r0: r * 0.55,
        r1: r,
        life: R.range(0.68, 0.86),
        max: 0,
        delay: R.range(0, 0.02),
      });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2 + R.range(-0.12, 0.12);
      const sp = R.range(135, 172);
      const r = R.range(2.6, 3.8);
      koBalls.push({
        x: cx + Math.cos(a) * 10,
        y: cy + Math.sin(a) * 3.4,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.32 - 1.2,
        r0: r * 0.6,
        r1: r,
        life: R.range(0.38, 0.54),
        max: 0,
        delay: R.range(0, 0.02),
      });
    }
    for (const b of koBalls) b.max = b.life;

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + R.range(-0.08, 0.08);
      koLines.push({ a, r0: 10, r1: R.range(30, 40), d: R.range(0, 0.03) });
    }

    lights.add(cx, -4, 30, C[6], 0.55, 0.24);
  };

  const smokeRadius = (b) => {
    const age = b.max - b.life;
    const u = age / b.max;
    const grow = b.r0 + (b.r1 - b.r0) * ease.outBack(clamp(age / 0.18), 1.7);
    const breathe = 1 + 0.05 * Math.sin(age * 15 + b.r1);
    return grow * breathe * (u < 0.55 ? 1 : 1 - ease.inQuad(clamp((u - 0.55) / 0.45)));
  };

  const drawSmokeBall = (p, b, layer, isTrail = false) => {
    const age = b.max - b.life;
    const u = age / b.max;
    const r = smokeRadius(b);
    if (r < 0.55) return;
    const fadeOut = u > 0.62 ? 1 - (u - 0.62) / 0.38 : 1;
    const a = Math.min(1, age * 24) * fadeOut * (isTrail ? 0.88 : 0.94);
    if (a <= 0.03) return;
    const lit = !isTrail && age < 0.09;
    if (layer === "shade") {
      p.disc(b.x + r * 0.16, b.y + r * 0.22, r, lit ? C[4] : C[2], 0.76 * a);
    } else if (layer === "body") {
      p.disc(b.x - r * 0.06, b.y - r * 0.08, r * 0.86, lit ? C[6] : C[4], 0.88 * a);
    } else {
      p.disc(b.x - r * 0.24, b.y - r * 0.30, r * 0.46, C[6], 0.92 * a);
      if (age < 0.22) p.disc(b.x - r * 0.28, b.y - r * 0.34, r * 0.22, WHITE, 0.9 * a * (1 - age / 0.22));
    }
  };

  return {
    update(dt) {
      t += dt;
      const st = poseAt(t);

      // 1. IDLE: soft tiny white puff-motes floating gently off crown
      if (t < T_MOVE) {
        idleMoteAcc += dt * 3.0;
        while (idleMoteAcc >= 1) {
          idleMoteAcc -= 1;
          const life = R.range(0.45, 0.72);
          mistPuffs.push({
            x: st.x + R.range(-10, 10),
            y: st.by - st.hh * 1.7,
            vx: R.range(-5, 5),
            vy: -R.range(7, 13),
            r0: 1.0,
            r1: R.range(1.5, 2.2),
            life,
            max: life,
            delay: 0,
          });
        }
      }

      // 2. MOVE: billowing white cloud-mist wake + underside electrostatic sparks!
      if (t >= T_DASH && t < T_BRAKE + 0.06) {
        const intensity = clamp(st.glideK + 0.28);
        mistAcc += dt * 42 * intensity;
        while (mistAcc >= 1) {
          mistAcc -= 1;
          const r = R.range(3.2, 5.6);
          const life = R.range(0.44, 0.72);
          mistPuffs.push({
            x: st.x - st.hw * R.range(0.65, 1.15),
            y: st.by - R.range(2.2, st.hh * 1.1),
            vx: -R.range(20, 46),
            vy: R.range(-10, 3),
            r0: r * 0.55,
            r1: r,
            life,
            max: life,
            delay: 0,
          });
        }

        // Underside electrostatic friction sparks (`底部擦出细小静电火花快速滑行`)
        staticAcc += dt * 60 * intensity;
        while (staticAcc >= 1) {
          staticAcc -= 1;
          const sx = st.x + R.range(-st.hw * 0.45, st.hw * 0.48);
          ps.spawn(
            P.SPARK,
            sx,
            -0.8,
            -R.range(42, 105),
            -R.range(14, 54),
            R.range(0.16, 0.34),
            R.pick([WHITE, B8[6], B8[5], B8[4]]),
            R.range(1.0, 1.5)
          );
          if (R.chance(0.62)) {
            bodyArcs.push({
              bolt: zigzag(R, sx - R.range(5, 10), -0.6, sx + R.range(3, 8), -R.range(1.2, 5.0), 0.34, 0.2, 0.8),
              life: 0.065,
              max: 0.065,
            });
          }
        }
      }

      // 3. ATTACK: raging coronal arcs + thunderclap Z-bolt cleave!
      if (t >= T_ATK && t < T_KO) {
        const rate = t < T_STRIKE ? 20 + 30 * seg(t, T_ATK, T_STRIKE) : 16;
        chargeAcc += dt * rate;
        while (chargeAcc >= 1) {
          chargeAcc -= 1;
          const a0 = R.range(0, TAU);
          const a1 = a0 + R.sign() * R.range(0.65, 1.45);
          const cy = st.by - st.hh * 0.88;
          bodyArcs.push({
            bolt: zigzag(
              R,
              st.x + Math.cos(a0) * st.hw * 0.92,
              cy + Math.sin(a0) * st.hh * 0.92,
              st.x + Math.cos(a1) * st.hw * 1.04,
              cy + Math.sin(a1) * st.hh * 1.04,
              0.32,
              0.28,
              1
            ),
            life: 0.075,
            max: 0.075,
          });
          if (t < T_STRIKE && R.chance(0.5)) {
            ps.spawn(
              P.SPARK,
              st.x + R.range(-24, 26),
              -1,
              R.range(-12, 12),
              -R.range(30, 62),
              R.range(0.18, 0.34),
              R.pick([B8[5], B8[4], S[5]]),
              1.1
            );
          }
        }

        if (!struck && t >= T_STRIKE) triggerStrike();
        if (!impacted && t >= T_IMPACT) triggerImpact();

        if (struck && t < T_BOLT_END) {
          boltTimer -= dt;
          if (boltTimer <= 0) {
            boltTimer = 0.048;
            spawnZVariant(t < T_STRIKE + 0.26 ? 1.06 : 0.78);
          }
          if (!restruck && t >= T_STRIKE + 0.16) {
            restruck = true;
            lights.add(X_HIT, -5, 22, B[2], 0.72, 0.22);
            for (let i = 0; i < 16; i++) {
              const a = -Math.PI / 2 + R.range(-1.15, 1.05);
              const sp = R.range(40, 108);
              ps.spawn(P.SPARK, X_HIT, -1.5, Math.min(76, Math.cos(a) * sp), Math.sin(a) * sp - 14, R.range(0.24, 0.50), R.pick([WHITE, B8[5], B8[4]]), 1.3);
            }
          }
        }
      }

      // 4. KO: dying sparks -> bright white air-leak jets -> 360° perspective white smoke ring!
      if (!koTriggered && t >= T_KO) {
        koTriggered = true;
        for (let i = 0; i < 7; i++) {
          ps.spawn(P.SPARK, X_RECOIL + R.range(-14, 14), -20, R.range(-30, 30), -R.range(4, 22), R.range(0.18, 0.34), B[2], 1.0);
        }
      }

      if (t >= T_DEFLATE && t < T_POP) {
        // Crisp white cartoon air-leak jet puffs hissing out of two vents as body pancakes!
        leakAcc += dt * 48;
        while (leakAcc >= 1) {
          leakAcc -= 1;
          const side = R.pick([-1, 1]);
          const life = R.range(0.20, 0.34);
          leakPuffs.push({
            x: st.x + side * st.hw * 0.58,
            y: -Math.max(2, st.hh * 1.25),
            vx: side * R.range(42, 78),
            vy: -R.range(24, 52),
            r0: 1.4,
            r1: R.range(2.2, 3.4),
            life,
            max: life,
            delay: 0,
          });
        }
      }

      if (!popped && t >= T_POP) triggerPop();

      // Advance mist & air-leak puffs
      for (const arr of [mistPuffs, leakPuffs]) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const b = arr[i];
          if ((b.life -= dt) <= 0) {
            arr.splice(i, 1);
            continue;
          }
          b.vx -= b.vx * 4.8 * dt;
          b.vy -= b.vy * 4.8 * dt + 10 * dt;
          b.x = clamp(b.x + b.vx * dt, -102, 102);
          b.y = clamp(b.y + b.vy * dt, -96, -1.2);
        }
      }

      // Advance KO white smoke ring balls (staying hugged to the ground perspective ellipse!)
      for (let i = koBalls.length - 1; i >= 0; i--) {
        const b = koBalls[i];
        if (b.delay > 0) {
          b.delay -= dt;
          continue;
        }
        if ((b.life -= dt) <= 0) {
          koBalls.splice(i, 1);
          continue;
        }
        b.vx -= b.vx * 5.6 * dt;
        b.vy -= b.vy * 5.6 * dt + 1.8 * dt;
        b.x = clamp(b.x + b.vx * dt, -104, 100);
        const r = smokeRadius(b);
        b.y = clamp(b.y + b.vy * dt, -40, 15 - r);
      }

      for (let i = bodyArcs.length - 1; i >= 0; i--) {
        if ((bodyArcs[i].life -= dt) <= 0) bodyArcs.splice(i, 1);
      }

      ps.update(dt);
      lights.update(dt);
    },

    drawBack(p) {
      const st = poseAt(t);

      // 1. Thunderclap storm backdrop, crisp sky flash rays (`攻击时的雷鸣闪光`), and ground illumination
      if (t >= T_ATK && t < T_KO) {
        const stormAura = st.charge * 0.30 + st.flash * 0.45;
        if (stormAura > 0.02) {
          p.glow(-10, -36, 48, S[3], stormAura * 0.65);
        }
        if (st.flash > 0.04) {
          p.glow(12, -44, 58, B[2], 0.38 * st.flash);
          // Crisp radial thunderclap flash beams radiating behind the storm-head on strike frames!
          if (st.flash > 0.58) {
            const bk = (st.flash - 0.58) / 0.42;
            const cx = st.x + 8, cy = -38;
            for (let i = 0; i < 7; i++) {
              const ang = -1.35 + i * 0.44;
              const r0 = 18, r1 = 36 + (i % 2) * 12;
              p.glowLine(
                cx + Math.cos(ang) * r0,
                cy + Math.sin(ang) * r0,
                cx + Math.cos(ang) * r1,
                cy + Math.sin(ang) * r1,
                3.5,
                i % 2 ? B[3] : S[5],
                0.35 * bk
              );
            }
          }
        }
        if (t >= T_IMPACT && st.flash > 0.04) {
          p.glow(X_HIT, -3, 24, B[3], 0.52 * st.flash);
        }
      }

      // 2. Monster ground shadow + static-spark floor sheen
      if (st.alive) {
        const lift = Math.max(0, -st.by);
        const shRx = Math.round(st.hw * (1.06 - Math.min(0.30, lift * 0.013)));
        const shRy = Math.max(2, Math.round(shRx * 0.22));
        shadow(p, st.x, 2, shRx, shRy, st.stormMix > 0.5 ? S[0] : C[0], 0.34 + 0.14 * st.stormMix);

        if (st.glideK > 0.1) {
          p.glow(st.x, -1, 18, B[3], 0.28 * st.glideK * (0.6 + 0.4 * Math.sin(t * 62)));
        }
      }

      // 3. Z-bolt ground scorch, glowing golden fissures, and far-half shockwave bands at X_HIT
      if (t >= T_IMPACT && t < 6.42) {
        const dtI = t - T_IMPACT;
        const coolFade = 1 - smooth(5.30, 6.40, t);
        if (coolFade > 0.01) {
          scorch(p, X_HIT, 0, 19, clamp(1 - dtI * 1.05), 0.88 * coolFade);
          const grow = (cr) => cr.len * ease.outQuart(clamp((dtI - cr.t0) / 0.14));
          const heat = (d) => clamp(1.18 - dtI * 0.88 - d * 0.022) * coolFade;
          drawCracks(p, rawCracks, grow, heat, [WHITE, B[3], B[2], B[1]], SOOT, B[2], coolFade);
        }

        for (let k = 0; k < 2; k++) {
          const rk = (dtI - k * 0.07) / 0.38;
          if (rk > 0 && rk < 1) {
            const rx = 8 + 28 * ease.outCubic(rk);
            band(
              p,
              X_HIT,
              0,
              rx,
              0.30,
              3.4 * (1 - rk * 0.65),
              (1 - rk) * 0.92,
              k === 0 ? [B[0], B[2], B[3], WHITE] : [S[2], S[4], S[5], B[3]],
              (ang) => Math.sin(ang) < 0,
              k === 0
            );
          }
        }
      }

      // 4. Far half of KO 360° perspective white smoke ring
      if (t >= T_POP) {
        const dtP = t - T_POP;
        const rk = dtP / 0.88;
        if (rk > 0 && rk < 1) {
          const rx = 12 + 31 * ease.outCubic(rk);
          dustRing(p, X_RECOIL, -1, rx, 5.6 * (1 - rk * 0.55), (1 - rk) * 0.78, C[5], {
            sy: 0.34,
            ph: 1.2,
            brk: smooth(0.38, 0.96, rk),
            lit: 0.68,
            maxY: 20,
            half: -1,
          });
        }
      }

      // 5. Billowing white cloud-mist wake puffs (`移动时的云雾拖尾`)
      for (const layer of ["shade", "body", "cap"]) {
        for (const b of mistPuffs) drawSmokeBall(p, b, layer, true);
      }

      ps.draw(p, "back");
    },

    draw(p) {
      const st = poseAt(t);

      // 1. Far-side KO smoke ring balls (y < -1.5)
      if (koBalls.length) {
        const backBalls = koBalls.filter((b) => b.delay <= 0 && b.y < -1.5);
        for (const layer of ["shade", "body", "cap"]) {
          for (const b of backBalls) drawSmokeBall(p, b, layer, false);
        }
      }

      // 2. Monster scalloped cloud body & expressive bean eyes
      if (st.alive) {
        drawPuffBody(grid, C, S, B, st, t);
        grid.draw(p);

        // Soft warm glint on the two yellow bean eyes in Idle, and fierce blazing eye-glare in Berserk Attack!
        const cy = st.by - st.hh * 0.88;
        const faceX = st.x + st.lookX + st.lean * st.hh * 0.42 + (st.expr === "move" ? st.hw * 0.24 : st.hw * 0.10);
        const faceY = cy + (st.expr === "flat" ? 0 : st.expr === "move" ? -st.hh * 0.02 : -st.hh * 0.08);
        if (st.expr === "idle" && st.blink < 0.3) {
          p.glow(faceX, faceY, 7, B[3], 0.14);
        } else if (st.expr === "berserk") {
          const sep = Math.max(4, Math.round(st.hw * 0.28));
          p.glow(faceX - sep, faceY - 1, 7, B[2], 0.36 * (0.65 + 0.35 * st.flash));
          p.glow(faceX + sep, faceY - 1, 7, B[2], 0.36 * (0.65 + 0.35 * st.flash));
          if (st.charge > 0.62) {
            sparkle(p, faceX - sep - 2, faceY - 2, 2.6, B[3], 0.8);
            sparkle(p, faceX + sep + 2, faceY - 2, 2.6, B[3], 0.8);
          }
        }
      }

      // 3. Air-leak hiss puffs (`像漏气一样迅速扁平`) + cartoon speed lines escaping vents!
      if (leakPuffs.length) {
        for (const layer of ["shade", "body", "cap"]) {
          for (const b of leakPuffs) drawSmokeBall(p, b, layer, false);
        }
      }
      if (t >= T_DEFLATE && t < T_POP) {
        const u = seg(t, T_DEFLATE, T_POP);
        if (((t * 30) | 0) % 2 === 0) {
          for (const side of [-1, 1]) {
            const vx0 = st.x + side * st.hw * 0.55;
            const vy0 = -Math.max(2, st.hh * 1.2);
            p.line(vx0, vy0, vx0 + side * (7 + 5 * (1 - u)), vy0 - (6 + 5 * (1 - u)), WHITE, 0.85 * (1 - u * 0.4));
          }
        }
      }

      // 4. Coronal lightning on swollen dark-purple cloud & static friction crackle under gliding belly
      for (const a of bodyArcs) {
        const k = a.life / a.max;
        crackle(p, a.bolt, k, B8, 0.25, k);
      }

      // 5. HERO ATTACK: Thick Z-Shaped Golden Lightning Bolt + Thunderclap Flares + Impact Shockwaves!
      if (t >= T_STRIKE && t < T_BOLT_END + 0.14 && activeZ) {
        const dtS = t - T_STRIKE;
        const reach = clamp(dtS / (T_IMPACT - T_STRIKE));

        if (dtS < T_BOLT_END - T_STRIKE) {
          const pts = clipPath(activeZ.main, reach);
          const pulse = dtS < 0.24 ? 1 : 1 - seg(dtS, 0.24, T_BOLT_END - T_STRIKE) * 0.42;

          // Rich golden plasma aura hugging all 3 Z-legs!
          for (let i = 1; i < pts.length; i++) {
            const [ax, ay] = pts[i - 1];
            const [bx, by] = pts[i];
            p.glowLine(ax, ay, bx, by, 7, B[2], 0.34 * pulse);
          }

          const zPaths = [{ pts, w: 1 }];
          if (reach > 0.34) zPaths.push({ pts: activeZ.spur1, w: 0.98 });
          if (reach > 0.66) zPaths.push({ pts: activeZ.spur2, w: 0.98 });
          if (reach > 0.46) {
            for (let i = 0; i < activeZ.forks.length; i++) {
              if (i >= 2 && reach < 0.98) continue;
              zPaths.push(activeZ.forks[i]);
            }
          }
          stroke(p, { paths: zPaths }, pulse, B8, 1.78 * activeZ.thickScale, {
            hero: dtS < 0.065,
            core: 1.05,
            light: 0.32,
          });

          // Thunderclap 8-ray flares (`雷鸣闪光`) at launch mouth & Z-knees!
          if (dtS < 0.18) {
            const fk = 1 - dtS / 0.18;
            const [mx, my] = activeZ.main[0];
            star(p, mx, my, mouthSpikes, 0.95 + 0.35 * (1 - fk), fk, [B[1], B[2], B[3], WHITE], fk, 2.5);
            if (reach > 0.35) flare(p, activeZ.k1[0], activeZ.k1[1], 15 * fk, 0.9 * fk, [B[0], B[1], B[2], B[3], WHITE]);
            if (reach > 0.68) flare(p, activeZ.k2[0], activeZ.k2[1], 14 * fk, 0.9 * fk, [B[0], B[1], B[2], B[3], WHITE]);
          }
        } else {
          // Dying Z-channel: crackling golden plasma beads + afterimage trace!
          const dk = 1 - (dtS - (T_BOLT_END - T_STRIKE)) / 0.14;
          const pts = activeZ.main;
          if (dk > 0.45) trace(p, pts, B[1], dk * 0.55);
          for (let i = 1; i < pts.length; i++) {
            const [ax, ay] = pts[i - 1];
            const [bx, by] = pts[i];
            const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 3));
            for (let s = 0; s < steps; s++) {
              if (rand(i * 17 + s, (t * 60) | 0, 9) < 0.52 * dk) {
                const u = s / steps;
                const px = ax + (bx - ax) * u;
                const py = ay + (by - ay) * u;
                p.circle(px, py, 1.4 * dk, dk > 0.5 ? B[3] : B[2], dk);
                p.dot(px, py, WHITE, dk);
              }
            }
          }
        }

        // Synchronized ground detonation at (X_HIT, 0) once Z-bolt touches down (`t >= T_IMPACT`)!
        if (t >= T_IMPACT) {
          const ik = t - T_IMPACT;
          if (ik < 0.20) {
            const fk = 1 - ik / 0.20;
            // Ground horizon flash + vertical golden impact pillar + multi-spike hit star!
            p.glowLine(X_HIT - 30 * fk, 0, X_HIT + 30 * fk, 0, 5, B[3], 0.48 * fk);
            p.glowLine(X_HIT, 0, X_HIT, -28 * fk, 6, B[3], 0.55 * fk);
            p.line(X_HIT, 0, X_HIT, -24 * fk, WHITE, 0.9 * fk);
            star(p, X_HIT, -2, hitSpikes, 0.95 + 0.5 * (1 - fk), fk, [B[1], B[2], B[3], WHITE], fk, 3.0);
            flare(p, X_HIT, -3, 21 * fk, fk, [B[0], B[1], B[2], B[3], WHITE]);
          }
          if (ik < 0.30) {
            const u = ik / 0.30;
            const spread = 6 + 26 * ease.outQuart(u);
            const h = 17 * (1 - u * 0.52);
            const w = 4.6 * (1 - u * 0.68);
            frontCrescent(p, X_HIT + spread, 1, h, w, [WHITE, B[3], B[1]], 1 - u);
            frontCrescent(p, X_HIT - spread, -1, h, w, [WHITE, B[3], B[1]], 1 - u);
          }
          if (ik < 0.36) {
            const u = ik / 0.36;
            brokenRing(p, X_HIT, -1, 8 + 28 * ease.outCubic(u), 2.8, shockSegs, ease.inQuad(u), WHITE, B[2], 1 - u, 0.32, 20);
          }
          for (let k = 0; k < 2; k++) {
            const rk = (ik - k * 0.07) / 0.38;
            if (rk > 0 && rk < 1) {
              const rx = 8 + 28 * ease.outCubic(rk);
              band(
                p,
                X_HIT,
                0,
                rx,
                0.30,
                3.4 * (1 - rk * 0.65),
                (1 - rk) * 0.95,
                k === 0 ? [B[0], B[2], B[3], WHITE] : [S[2], S[4], S[5], B[3]],
                (ang) => Math.sin(ang) >= 0,
                k === 0
              );
            }
          }
        }
      }

      // 6. KO WHITE SMOKE RING DISPERSION (`化作一圈白色烟雾散开`)
      if (t >= T_POP) {
        const dtP = t - T_POP;
        if (dtP < 0.08) {
          const fk = 1 - dtP / 0.08;
          p.ellipse(X_RECOIL, -2.5, 20 + 8 * (1 - fk), 5.5 + 3 * (1 - fk), C[5], 0.88 * fk);
          p.ellipse(X_RECOIL, -2.5, 13 + 6 * (1 - fk), 3.8 + 2 * (1 - fk), WHITE, 0.95 * fk);
          flare(p, X_RECOIL, -3.5, 16 * fk, 0.85 * fk, C);
        }
        const rk = dtP / 0.88;
        if (rk > 0 && rk < 1) {
          const rx = 12 + 31 * ease.outCubic(rk);
          dustRing(p, X_RECOIL, -1, rx, 5.6 * (1 - rk * 0.55), (1 - rk) * 0.82, C[5], {
            sy: 0.34,
            ph: 1.2,
            brk: smooth(0.38, 0.96, rk),
            lit: 0.74,
            maxY: 20,
            half: 1,
          });
        }
        for (const l of koLines) {
          const u = (dtP - l.d) / 0.22;
          if (u <= 0 || u >= 1) continue;
          const head = l.r0 + (l.r1 - l.r0) * ease.outExpo(clamp(u / 0.62));
          const tail = l.r0 + (l.r1 - l.r0) * ease.inCubic(u);
          const ca = Math.cos(l.a);
          const sa = Math.sin(l.a) * 0.35;
          p.line(X_RECOIL + ca * tail, -1.5 + sa * tail, X_RECOIL + ca * head, -1.5 + sa * head, (v) => (v > 0.55 ? WHITE : C[5]), 1 - u);
        }
        const frontBalls = koBalls.filter((b) => b.delay <= 0 && b.y >= -1.5);
        for (const layer of ["shade", "body", "cap"]) {
          for (const b of frontBalls) drawSmokeBall(p, b, layer, false);
        }
      }

      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
