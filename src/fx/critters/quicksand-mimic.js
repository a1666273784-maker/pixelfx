// Flowing surface sand rivulets, royal crown splat reformation, giant hammer smear & textured sandstorm eruption, and spinning tornado
// build on ../moves/hourglass-rewind-heal.js, ../nature/tornado.js, ../melee/hammer-smash.js, ../impacts/ground-slam.js,
// and ./slime.js (adapted from Sprite Fusion's open-source pixel-art VFX, MIT License, Copyright (c) 2026 Hugo Duprez).
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
  sparkle,
  clamp,
  smooth,
  seg,
  ease,
  lerp,
  mix,
  rand,
  tileFbm,
  tileNoise,
  TAU,
  WHITE,
} from "../../core/index.js";
import { Grid, shadow, spring } from "./_lib.js";
import { swing, onSwing, smear } from "../melee/_lib.js";
import { frontCrescent } from "../impacts/_lib.js";

export const meta = {
  name: "Quicksand mimic",
  desc: "A shifting golden sand mimic with sapphire eyes fails to hold a crown and splats flat, spins as a sand tornado, slams a giant golden sand-hammer, then collapses to a dune.",
  tags: ["critter", "monster", "sand", "desert", "gold", "tornado", "hammer", "one-shot"],
  size: [320, 184],
  origin: [120, 140],
  duration: 12.0,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    // 8-step Shimmering Desert Quicksand & Imperial Gold ramp
    palette: ["#2c1506", "#64330c", "#9e5716", "#d68722", "#f6bd42", "#ffe57f", "#fff7c8", "#ffffff"],
    // 5-step Curious Sapphire-Blue Gem Eyes ramp
    gems: ["#041038", "#0c2e8a", "#1c6cff", "#6ec4ff", "#d8f8ff"],
    // 5-step Lifeless Matte Sand Dune ramp for KO collapse
    dune: ["#302214", "#5c442c", "#8a6d49", "#b8996e", "#dcc299"],
    seed: 17,
  },
};

// 5-Stage Sustained Choreography + Smooth Transitions + Post-Attack Buffer (12.00s, 360 frames):
// 0.00..2.10  【待机 Idle】               Irregular water-drop golden sand blob; downward flowing surface grains; curious sapphire eyes
// 2.10..4.75  【生态小动作 Quirk】        Shapes a grand golden crown (2.10..2.98) -> wobbles left-right & WHOOSH splats flat into a sand pancake (2.98..4.02) -> scoops awkwardly back up (4.02..4.75)
// 4.75..6.85  【移动 Move】               Morphs into a low-skimming golden quicksand tornado racing across the floor kicking up glittering sandstorm dust (-58 -> -14)
// 6.85..9.00  【攻击 Attack】             Rears upright, condenses a colossal golden sand-hammer overhead (6.85..7.54), slams onto X_HIT = +56 (7.72) unleashing a blazing gold sand trail & roaring textured sandstorm!
// 9.00..9.85  【攻击后待机缓冲 IdleBuf】  Settles calmly back to shimmering sand blob while storm subsides
// 9.85..12.00 【倒地 KO】                 Mystic glow vanishes -> body pours down into an ordinary matte desert sand dune -> sapphire eyes roll cleanly down the slope & vanish!
const T_QUIRK = 2.10;
const T_CROWN_PEAK = 2.98;
const T_SPLAT = 3.36;
const T_REFORM = 4.04;
const T_MOVE = 4.75;
const T_SPIN_FULL = 5.05;
const T_SPIN_STOP = 6.55;
const T_ATK = 6.85;
const T_SWING = 7.54;
const T_IMPACT = 7.72;
const T_POST_IDLE = 9.00;
const T_KO = 9.85;
const T_KO_DETACH = 10.00;
const T_DUNE = 10.68;
const T_END = meta.duration;

const X_IDLE = -58;
const X_ATK = -14;
const X_HIT = 56;

const BODY_GRID = new Grid(-114, -90, 176, 98);

function mimicStateAt(t) {
  let x = X_IDLE;
  let y = 0;
  let W = 33.5;
  let H = 30.0;
  let lean = 0;
  let crownMix = 0;
  let crownTilt = 0;
  let splatMix = 0;
  let swirlMix = 0;
  let tornadoH = 0;
  let rageStand = 0;
  let hammerProg = 0;
  let swingU = -1;
  let koPour = 0;
  let koFade = 1;
  let magicGlow = 1;
  let eyeMode = "idle";
  let eyeScale = 1;
  let lookX = 0;
  let lookY = 0;
  let blink = 0;

  if (t < T_QUIRK) {
    // Stage 1: 【待机 Idle】 Gentle breathing irregular teardrop + curious glances + cute blink
    const breath = Math.sin((t / T_QUIRK) * TAU * 3.0);
    W = 33.5 + breath * 1.5;
    H = 30.0 - breath * 1.4;
    lean = 1.8 + Math.sin((t / T_QUIRK) * TAU * 1.5) * 1.6;
    lookX = t < 0.72 ? -0.7 : t < 1.45 ? 1.3 : 0.1;
    lookY = t > 1.0 && t < 1.6 ? -0.6 : 0;
    blink = t > 0.80 && t < 0.98 ? Math.sin(seg(t, 0.80, 0.98) * Math.PI) : 0;
    eyeMode = "idle";
  } else if (t < T_MOVE) {
    // Stage 2: 【生态小动作 Quirk】 Sculpt 3-pronged golden crown -> wild left-right wobble -> WHOOSH pancake splat -> scoop reform
    if (t < T_CROWN_PEAK) {
      const u = seg(t, T_QUIRK, T_CROWN_PEAK);
      const lift = ease.outBack(u, 1.35);
      crownMix = smooth(0.06, 0.65, u);
      W = lerp(33.5, 29.0, lift);
      H = lerp(30.0, 38.0, lift);
      lean = Math.sin(u * TAU * 1.8) * 1.1;
      eyeMode = u > 0.35 ? "proud" : "idle";
      lookY = -0.5 * u;
    } else if (t < T_SPLAT) {
      const u = seg(t, T_CROWN_PEAK, T_SPLAT);
      crownMix = 1 - smooth(0.72, 1.0, u);
      // Heavy top-heavy wobble left then violently right before face-planting flat!
      crownTilt = -Math.sin(u * Math.PI * 3.0) * (4.2 + 3.6 * u) + ease.inCubic(u) * 13.5;
      lean = crownTilt * 0.92;
      W = lerp(29.0, 36.0, u);
      H = lerp(38.0, 25.0, ease.inQuad(u));
      eyeMode = "panic";
      eyeScale = 1.24;
    } else if (t < T_REFORM) {
      const age = t - T_SPLAT;
      const bounce = age < 0.08 ? 1.0 : 1.0 - 0.14 * spring(age - 0.08, 2.2, 4.5);
      splatMix = 1.0;
      W = 52.0 * clamp(bounce, 0.85, 1.15);
      H = lerp(8.5, 7.6, clamp(age / 0.2));
      eyeMode = "dizzy";
    } else {
      const u = seg(t, T_REFORM, T_MOVE);
      const eu = ease.outBack(u, 1.45);
      splatMix = 1 - eu;
      W = lerp(51.0, 33.5, eu);
      H = lerp(7.6, 30.0, eu);
      lean = -2.2 * Math.sin(u * Math.PI);
      eyeMode = u < 0.72 ? "shy" : "idle";
      lookX = u < 0.75 ? -1.1 : 0;
    }
  } else if (t < T_ATK) {
    // Stage 3: 【移动 Move】 Low-skimming golden quicksand tornado racing X_IDLE -> X_ATK
    const u = seg(t, T_MOVE, T_ATK);
    const inK = smooth(T_MOVE, T_SPIN_FULL, t);
    const outK = 1 - smooth(T_SPIN_STOP, T_ATK, t);
    swirlMix = inK * outK;

    const glideU = seg(t, T_SPIN_FULL - 0.06, T_SPIN_STOP + 0.06);
    x = lerp(X_IDLE, X_ATK, ease.inOutSine(glideU));
    y = swirlMix * (-1.4 + Math.sin(u * TAU * 4) * 1.1);
    tornadoH = lerp(30.0, 46.0, swirlMix);
    W = lerp(33.5, 23.0, swirlMix);
    H = tornadoH;
    lean = 5.4 * swirlMix;
    eyeMode = swirlMix > 0.35 ? "spin" : "idle";
  } else if (t < T_POST_IDLE) {
    // Stage 4: 【攻击 Attack】 Rears upright -> condenses colossal golden sand-hammer -> slams onto X_HIT & shatters!
    x = X_ATK;
    if (t < T_SWING) {
      const u = seg(t, T_ATK, T_SWING);
      const stand = ease.outBack(clamp(u / 0.42), 1.35);
      rageStand = stand;
      hammerProg = smooth(0.16, 0.86, u);
      W = lerp(33.5, 26.0, stand);
      H = lerp(30.0, 38.0, stand);
      lean = -5.0 * stand + Math.sin(t * 70) * 0.7 * smooth(0.5, 1, u);
      eyeMode = "glare";
      lookX = 1.4;
    } else if (t < T_IMPACT) {
      const u = seg(t, T_SWING, T_IMPACT);
      rageStand = 1.0;
      hammerProg = 1.0;
      swingU = ease.inQuad(u);
      W = lerp(26.0, 30.0, u);
      H = lerp(38.0, 31.0, u);
      lean = lerp(-5.0, 8.2, u);
      eyeMode = "glare";
      lookX = 1.6;
    } else {
      const age = t - T_IMPACT;
      const slamRecoil = Math.exp(-age * 5.8);
      const relax = smooth(0.45, 1.15, age);
      rageStand = 1 - relax;
      hammerProg = 1 - smooth(0.02, 0.14, age);
      swingU = age < 0.16 ? 1.0 : -1;
      W = lerp(36.0 * (1 + 0.12 * slamRecoil), 33.5, relax);
      H = lerp(22.0 * (1 - 0.10 * slamRecoil), 30.0, relax);
      lean = lerp(8.0 * slamRecoil, 0, relax);
      eyeMode = age < 0.82 ? "glare" : "idle";
      lookX = 1.3 * (1 - relax);
    }
  } else if (t < T_KO) {
    // Stage 4.5: 【攻击后待机缓冲 IdleBuf】 Calm shimmering recovery cycle before KO
    x = X_ATK;
    const u = seg(t, T_POST_IDLE, T_KO);
    const breath = Math.sin(u * TAU * 1.5);
    W = 33.5 + breath * 1.4;
    H = 30.0 - breath * 1.3;
    lean = 1.5 + breath * 0.9;
    eyeMode = "idle";
    blink = u > 0.45 && u < 0.62 ? Math.sin(seg(u, 0.45, 0.62) * Math.PI) : 0;
  } else {
    // Stage 5: 【倒地 KO】 Mystic glow vanishes -> collapses into ordinary sand dune -> sapphire eyes roll down slope & vanish!
    x = X_ATK;
    const u = seg(t, T_KO, T_DUNE);
    magicGlow = 1 - smooth(T_KO, T_KO + 0.22, t);
    koPour = ease.inOutQuad(u);
    W = lerp(33.5, 58.0, koPour);
    H = lerp(30.0, 15.0, ease.outCubic(u));
    koFade = 1 - smooth(T_DUNE + 0.48, T_END - 0.08, t);
    if (t >= T_DUNE + 0.1) H *= lerp(1.0, 0.34, smooth(T_DUNE + 0.1, T_END - 0.10, t));
    eyeMode = t < T_KO_DETACH ? "panic" : t < T_DUNE + 0.82 ? "roll" : "gone";
  }

  return {
    x, y, W, H, lean,
    crownMix, crownTilt, splatMix,
    swirlMix, tornadoH,
    rageStand, hammerProg, swingU,
    koPour, koFade, magicGlow,
    eyeMode, eyeScale, lookX, lookY, blink,
  };
}

// Irregular curved water-drop sand body silhouette + downward flowing sand rivulets + sapphire gem eyes!
function drawQuicksandBody(g, p, C, D, G, st, t, seed) {
  if (st.koFade <= 0.02 || st.swirlMix > 0.86) return { eyePos: [] };

  g.clear();
  const bx = st.x;
  const by = Math.round(st.y);
  const hw = st.W * 0.5;
  const H = st.H;

  const dunefy = st.koPour * 0.96;
  const ramp = dunefy > 0.02 ? C.map((c, i) => mix(c, D[Math.min(4, Math.floor((i * 5) / 8))], dunefy)) : C;

  // Compute true rounded irregular water-drop / crown / flat-pancake / matte-dune half-width at v (0..1)
  const halfWAt = (v) => {
    if (v < 0 || v > 1) return -1;
    // Lifeless KO Sand Dune (`普通的沙丘`): broad smooth desert mound silhouette
    if (st.koPour > 0.05) {
      const duneW = hw * Math.pow(Math.max(0, 1 - v * 0.98), 0.68);
      const dropW = hw * Math.sin(clamp(v * 0.82 + 0.18) * Math.PI * 0.88);
      return lerp(dropW, duneW, st.koPour);
    }
    // Flat goofy pancake splat profile with soft rounded rim!
    if (st.splatMix > 0.5 && H < 12) {
      return hw * Math.sqrt(clamp(1 - Math.pow(v, 1.5), 0.06, 1));
    }
    // True organic water-drop silhouette (`不规则水滴状`: plump rounded lower belly `v < 0.45`, pinching softly to droplet tip!)
    let base;
    if (v < 0.42) {
      // Wide rounded belly tapering gently at floor contact
      const s = (0.42 - v) / 0.46;
      base = Math.sqrt(clamp(1 - s * s * 0.55, 0.25, 1));
    } else {
      // Smooth concave S-curve water-drop neck pinching into rounded droplet apex
      const u = (v - 0.42) / 0.58;
      base = Math.pow(clamp(1 - u, 0, 1), 0.82) * (1 - 0.16 * Math.sin(u * Math.PI));
    }
    // Organic squishable fluid sand wobble
    base += 0.055 * Math.sin(v * Math.PI * 2.4 + t * 3.0);

    // Bold 3-pronged royal crown top during Stage 2A!
    if (st.crownMix > 0.05 && v > 0.50) {
      const cu = (v - 0.50) / 0.50;
      const crownRim = 0.84 + 0.14 * Math.sin(cu * Math.PI);
      base = lerp(base, crownRim, st.crownMix * smooth(0.50, 0.68, v));
    }
    return Math.max(0, hw * base);
  };

  const inCrownNotch = (nx, v) => {
    if (st.crownMix < 0.16 || v < 0.70) return false;
    const cu = (v - 0.70) / 0.30;
    const arch = Math.cos(nx * Math.PI * 2.35);
    const spikeH = 0.25 + 0.75 * clamp((arch + 0.25) / 1.25);
    return cu > spikeH * st.crownMix;
  };

  const flowY = t * 26; // Continuous downward golden sand flow speed!
  const pad = 16;

  g.shade(bx - hw - pad, by - H - pad, bx + hw + pad, by + 2, (wx, wy, out) => {
    if (wy > 0.45) return 0;
    const v = clamp((by - wy) / Math.max(2, H), 0, 1.05);
    if (v > 1.0) return 0;

    const edgeNoise = (tileFbm(wx * 0.22, (wy - flowY * 0.5) * 0.22, 0, 0, seed + 3, 2) - 0.5) * (1.1 + 0.8 * st.koPour);
    // S-curving droplet tip tilt (`lean` curves cleanly up toward peak)
    const spineShift = st.lean * Math.pow(v, 1.45) + st.crownTilt * Math.pow(Math.max(0, v - 0.48), 1.5) * 2.2;
    const hW = halfWAt(v) + edgeNoise * (v > 0.08 && v < 0.95 ? 1 : 0);
    if (hW < 0.8) return 0;

    const dx = wx - (bx + spineShift);
    if (Math.abs(dx) > hW) return 0;

    const nx = dx / Math.max(1, hW);
    if (inCrownNotch(nx, v)) return 0;

    out.t = 1;
    out.a = (1 - st.swirlMix * 0.92) * st.koFade;
    return ramp[4];
  });

  g.depths(5);

  const eyePositions = [];
  g.recolor((wx, wy, col, al, tag) => {
    if (tag !== 1) return col;
    const d = g.depth(wx, wy);
    const v = clamp((by - wy) / Math.max(2, H), 0, 1);
    const spineShift = st.lean * Math.pow(v, 1.45) + st.crownTilt * Math.pow(Math.max(0, v - 0.48), 1.5) * 2.2;
    const hW = Math.max(2, halfWAt(v));
    const nx = (wx - (bx + spineShift)) / hW;
    const lit = -0.56 * nx + 0.65 * v;

    if (d === 1) return lit > 0.28 && st.koPour < 0.5 ? ramp[2] : ramp[0];

    const grain1 = tileNoise(wx * 0.55, (wy - flowY) * 0.45, 8, 8, seed + 9);
    const rivulet = Math.sin(wx * 0.56 + tileFbm(wx * 0.16, (wy - flowY * 0.78) * 0.18, 0, 0, seed + 17, 2) * 3.8);
    const shimmer = rand(Math.floor(wx), Math.floor(wy - flowY * 0.9), seed + ((t * 15) | 0));

    let i = lit > 0.34 ? 5 : lit > -0.05 ? 4 : lit > -0.38 ? 3 : 2;
    if (st.magicGlow > 0.2) {
      if (rivulet > 0.36 && d >= 2) i = Math.min(7, i + 1);
      if (rivulet < -0.40 && d >= 2) i = Math.max(1, i - 1);
      if (grain1 > 0.72 || (shimmer > 0.92 && lit > -0.25)) i = 6;
      if (shimmer > 0.975 && st.magicGlow > 0.6) i = 7;
    } else {
      const ripple = Math.sin((wx - bx) * 0.25 + (wy - by) * 0.45) * 0.35;
      i = clamp(Math.round(2.4 + lit * 1.45 + ripple + (grain1 - 0.5) * 1.2), 1, 4);
    }

    if (st.crownMix > 0.3) {
      if (v > 0.63 && v < 0.71) i = 6;
      if (v > 0.72 && d <= 2 && lit > -0.1) i = 7;
    }

    return ramp[clamp(i, 0, ramp.length - 1)];
  });

  g.outline((wx, wy, ox, oy) => {
    const idx = g.idx(wx, wy);
    if (idx >= 0) g.a[idx] = (1 - st.swirlMix * 0.92) * st.koFade;
    return oy < 0 && ox <= 0 ? ramp[1] : ramp[0];
  });

  if (st.eyeMode !== "spin" && st.eyeMode !== "roll" && st.eyeMode !== "gone") {
    const eyV = st.splatMix > 0.5 ? 0.56 : st.crownMix > 0.3 ? 0.44 : 0.52;
    const spineX = bx + st.lean * Math.pow(eyV, 1.45) + st.lookX * 1.8;
    const eyY = Math.round(by - H * eyV + st.lookY * 1.2);
    const sep = st.splatMix > 0.5 ? 9.5 : Math.max(5.0, hw * 0.32);

    for (const side of [-1, 1]) {
      const ex = Math.round(spineX + side * sep);
      eyePositions.push({ x: ex, y: eyY, side });
      drawSapphireEye(g, G, ex, eyY, st.eyeMode, st.blink, st.eyeScale, side, true);
    }
  }

  g.draw(p);
  return { eyePos: eyePositions };
}

function drawSapphireEye(target, G, ex, ey, mode, blink, scale, side, inGrid) {
  const put = (x, y, col) => {
    if (inGrid) target.set(x, y, col, 1, 5);
    else target.px(Math.round(x), Math.round(y), col);
  };

  if (mode === "dizzy") {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > 2.6) continue;
        put(ex + dx, ey + dy, d > 1.8 ? G[0] : (dx + dy) % 2 === 0 ? G[3] : G[1]);
      }
    }
    put(ex - 1, ey - 1, WHITE);
    return;
  }

  if (blink > 0.55) {
    for (let dx = -2; dx <= 2; dx++) put(ex + dx, ey + (Math.abs(dx) === 2 ? 1 : 0), G[0]);
    put(ex, ey, G[3]);
    return;
  }

  const rx = 3.1 * scale;
  const ry = (mode === "proud" ? 2.6 : 3.3) * scale;
  for (let dy = -Math.ceil(ry) - 1; dy <= Math.ceil(ry) + 1; dy++) {
    for (let dx = -Math.ceil(rx) - 1; dx <= Math.ceil(rx) + 1; dx++) {
      const nx = dx / rx;
      const ny = dy / ry;
      const d = Math.hypot(nx, ny);
      if (d > 1.32) continue;
      let col;
      if (d > 0.96) col = G[0];
      else if (mode === "proud" && ny > 0.15) col = G[1];
      else if (d < 0.34 && nx < 0.2 && ny < 0.1) col = WHITE;
      else if (nx + ny < -0.25) col = G[4];
      else if (nx + ny < 0.45) col = G[3];
      else col = G[2];
      put(ex + dx, ey + dy, col);
    }
  }
  put(ex - 1, ey - 1, WHITE);
  if (mode === "glare") {
    for (let dx = -2; dx <= 2; dx++) {
      put(ex + dx, ey - 3 + (side < 0 ? Math.max(0, dx) : Math.max(0, -dx)) * 0.45, G[0]);
    }
  }
}

// Stage 3 Move: Low-Skimming Golden Quicksand Tornado + Swirling Wisps + Orbiting Sapphire Eyes
function drawSandTornado(p, C, G, st, t, seed, back) {
  if (st.swirlMix <= 0.08) return;
  const k = st.swirlMix;
  const FH = st.tornadoH;
  const SY = 0.26;
  const cxAt = (u) => st.x + st.lean * u + Math.sin(t * 17 - u * 4.2) * 3.8 * u * k;
  const radAt = (u) => (4.5 + 13.5 * Math.pow(u, 1.35) + 6.5 * smooth(0.78, 1.0, u)) * k;

  if (back) {
    for (let y = -Math.ceil(FH); y <= 0; y++) {
      const u = -y / Math.max(1, FH);
      const cx = cxAt(u);
      const r = radAt(u);
      if (r < 1) continue;
      const rot = t * 18 + y * 0.25;
      const fade = Math.min(1, u * 7 + 0.25) * (1 - smooth(0.84, 1.0, u)) * k;
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const c = (x + 0.5 - cx) / r;
        if (Math.abs(c) > 1) continue;
        const n = tileNoise(((Math.acos(c) + rot) * 5) / TAU, y * 0.36, 5, 0, seed + 19);
        const v = -c * 0.5 + 0.15 + n * 0.55;
        const col = v > 0.65 ? C[6] : v > 0.32 ? C[5] : v > 0 ? C[4] : C[2];
        p.blend(x, y, col, (0.30 + 0.44 * Math.sqrt(1 - c * c)) * fade);
      }
    }
  }

  for (let j = 0; j < 38; j++) {
    const R = new Rng(seed * 13 + j * 17);
    const u = (j + 0.35) / 38;
    if (u > 0.94) continue;
    const cx = cxAt(u);
    const r = radAt(u) * (1.02 + R.range(0, 0.18));
    const y0 = -u * FH;
    const head = R.range(0, TAU) + t * (16 + (j % 3) * 4);
    const span = R.range(1.0, 2.3);
    const step = 0.5 / Math.max(2, r);
    for (let s = 0; s <= span; s += step) {
      const th = head - s;
      const sn = Math.sin(th);
      if ((sn > 0) === back) continue;
      const ku = s / span;
      const x = cx + r * Math.cos(th);
      const y = y0 + r * SY * sn;
      const col = ku < 0.22 ? WHITE : ku < 0.56 ? C[5] : C[4];
      p.blend(x, y, col, (1 - ku * 0.72) * k * (back ? 0.65 : 0.96));
    }
  }

  if (!back && k > 0.45) {
    const cyEye = -FH * 0.54;
    const rEye = radAt(0.54) * 0.72;
    for (const side of [-1, 1]) {
      const th = t * 11 + side * 0.55;
      const ex = cxAt(0.54) + Math.sin(th) * rEye;
      const ey = cyEye + Math.cos(th) * 1.4;
      if (Math.cos(th) > -0.25) {
        drawSapphireEye(p, G, ex, ey, "idle", 0, 0.85, side, false);
        p.glow(ex, ey, 6, G[3], 0.42 * k);
      }
    }
  }

  const footX = cxAt(0);
  if (!back) {
    p.glow(footX, -10, 22, C[4], 0.34 * k);
    p.glow(cxAt(0.5), -FH * 0.5, 28, C[5], 0.34 * k);
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * TAU + t * 18;
      const rx = 18 * k + (i % 2) * 5;
      const yOff = -(i % 3) * 1.8;
      for (let s = 0; s < 1.3; s += 0.08) {
        const a = a0 - s;
        const x = footX + Math.cos(a) * rx;
        const y = yOff + Math.sin(a) * rx * 0.22;
        const col = s < 0.3 ? WHITE : s < 0.75 ? C[5] : C[3];
        p.blend(x, y, col, (1 - s / 1.3) * 0.88 * k);
      }
    }
  }
}

// Stage 4 Attack: Giant Sculpted Golden Sand-Hammer + Swirling Gold-Sand Smear Trail
function drawGoldenSandHammer(p, C, st, t, seed) {
  if (st.hammerProg <= 0.04) return;

  const pivotX = st.x + 2;
  const pivotY = -24;
  const R_ARM = 56;
  const hammerSwing = swing({ cx: pivotX, cy: pivotY, R: R_ARM, sy: 1, rot: 0, a0: -2.28, dir: 1 });
  const U_END = 2.66; // Strikes cleanly onto floor level (`y = -3`) at `X_HIT = +56`!

  let curU = 0;
  if (st.swingU >= 0 && t < T_IMPACT) {
    curU = U_END * st.swingU;
  } else if (t >= T_IMPACT) {
    curU = U_END;
  } else {
    curU = 0.07 * Math.sin(t * 28);
  }

  if (t >= T_SWING && t < T_IMPACT + 0.16) {
    const after = smooth(T_IMPACT, T_IMPACT + 0.16, t);
    const U = curU;
    const lag = 0.45 + 1.65 * (curU / U_END);
    const T = Math.max(0, U - lag) + (U - Math.max(0, U - lag)) * after * 0.85;
    const HW = 20;
    const Rm = hammerSwing.R - HW * 0.42;

    if (U - T > 0.04 && after < 0.96) {
      const arcLen = (U - T) * Rm;
      smear(p, hammerSwing, T, U, HW + 2, (u, r, out) => {
        const lead = (U - u) * Rm;
        const f = lead / Math.max(1, arcLen);
        const w = HW * (lead < 4 ? 1 : Math.pow(clamp(1 - (lead - 4) / Math.max(1, arcLen - 4)), 0.72)) * (1 - after * 0.45);
        const off = (r - Rm) / (w * 0.5 + 0.01);
        if (w < 0.7 || Math.abs(off) > 1) return;
        const idx = lead < 4 ? 7 : Math.round(6.6 - f * 3.8 - Math.abs(off) * 1.3 - after * 3.0);
        if (idx < 1) return;
        out.c = C[clamp(idx, 1, 7)];
      });

      for (const [dr, len] of [[-12, 34], [-6, 44], [1, 48], [7, 36], [12, 26]]) {
        const rr = Rm + dr;
        for (let d = 1; d < len * (1 - after); d += 0.55) {
          const u = U - d / rr;
          if (u < 0) break;
          const k = d / len;
          const [sx, sy] = onSwing(hammerSwing, rr, u);
          p.blend(sx, sy, k < 0.25 ? WHITE : k < 0.65 ? C[5] : C[4], (1 - k) * (1 - after));
        }
      }
      const [hx, hy] = onSwing(hammerSwing, Rm, U);
      p.glow(hx, Math.min(-10, hy), 34, C[5], 0.56 * (1 - after));
    }
  }

  const kForm = st.hammerProg;
  const [hx, hy] = onSwing(hammerSwing, R_ARM - 2, curU);
  const aShaft = hammerSwing.a0 + hammerSwing.dir * curU;
  const ca = Math.cos(aShaft), sa = Math.sin(aShaft);
  const tx = -sa, ty = ca;

  const shaftSteps = 44;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i <= shaftSteps; i++) {
      const f = i / shaftSteps;
      const sx = lerp(pivotX, hx, f);
      const sy = lerp(pivotY, hy, f);
      const r = lerp(4.0, 2.5, f) * kForm;
      if (pass === 0) {
        p.disc(sx, sy, r + 1.0, C[0], 0.92 * kForm);
      } else {
        p.disc(sx, sy, r, f > 0.65 ? C[5] : f > 0.25 ? C[4] : C[3], 0.98 * kForm);
      }
    }
  }

  const halfLen = 15.5 * kForm;
  const halfThick = 11.2 * kForm;
  const minX = Math.floor(hx - 24), maxX = Math.ceil(hx + 24);
  const minY = Math.floor(hy - 24), maxY = Math.ceil(hy + 24);

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      if (py > 0) continue;
      const dx = px + 0.5 - hx;
      const dy = py + 0.5 - hy;
      const uFace = dx * tx + dy * ty;
      const vAxis = dx * ca + dy * sa;

      const flareW = 1 + 0.18 * clamp(uFace / Math.max(1, halfLen), -1, 1);
      const ax = Math.abs(uFace) / halfLen;
      const ay = Math.abs(vAxis) / (halfThick * flareW);
      const boxD = Math.max(ax, ay);
      const bevel = ax + ay;
      if (boxD > 1.0 || bevel > 1.72) continue;

      const isContour = boxD > 0.89 || bevel > 1.56;
      const isCollar = Math.abs(uFace) < halfLen * 0.22;
      const sandFlow = tileNoise(px * 0.42, (py - t * 24) * 0.42, 8, 8, seed + 41);
      let col;
      if (isContour) {
        col = uFace > 0.5 * halfLen && vAxis > 0 ? C[6] : C[0];
      } else if (uFace > 0.62 * halfLen) {
        col = sandFlow > 0.58 ? WHITE : C[6];
      } else if (isCollar) {
        col = sandFlow > 0.45 ? C[6] : C[5];
      } else if (vAxis < -halfThick * 0.25) {
        col = sandFlow > 0.65 ? C[6] : C[5];
      } else if (vAxis > halfThick * 0.35) {
        col = C[2];
      } else {
        col = sandFlow > 0.72 ? C[6] : sandFlow > 0.3 ? C[4] : C[3];
      }
      p.blend(px, py, col, Math.min(1, kForm * 1.15));
    }
  }
  p.glow(hx, Math.min(-14, hy), 26 * kForm, C[5], 0.48 * kForm);
}

// Organic Swirling Desert Sandstorm Eruption (`漫天沙暴`) with FBM-eroded wind-torn cloud silhouettes!
// Zero spherical bubble-ball artifacts — renders turbulent billowing desert sand gusts with wind-streaked edges!
function drawSandstormEruption(p, C, q, seed, X0, X1, Y0) {
  const LIFE = 1.05;
  if (q < 0 || q >= LIFE) return;
  const u = q / LIFE;
  const fade = 1 - smooth(0.45, 1.0, u);
  const spread = ease.outCubic(clamp(q / 0.55));

  // Bounding box of erupting sandstorm wall over X_HIT = +56
  const W_HALF = Math.round(16 + 68 * spread);
  const H_MAX = Math.round(14 + 44 * Math.sin(clamp(u / 0.75) * Math.PI * 0.75));
  const minX = Math.max(X0 + 4, X_HIT - W_HALF);
  const maxX = Math.min(X1 - 4, X_HIT + W_HALF);
  const minY = Math.max(Y0 + 4, -H_MAX);

  for (let py = minY; py <= 0; py++) {
    const vy = -py / Math.max(1, H_MAX);
    // Floor sandstorm wall flares wider near ground (`vy ~ 0`), narrower upward (`vy -> 1`)
    const wallW = W_HALF * (1 - 0.55 * Math.pow(vy, 1.35));
    for (let px = minX; px <= maxX; px++) {
      const dx = px - X_HIT;
      const ax = Math.abs(dx) / Math.max(4, wallW);
      if (ax > 1.0) continue;

      // Swirling upward + outward sandstorm advection coordinates!
      const signX = dx < 0 ? -1 : 1;
      const advX = (px - signX * q * 38) * 0.14;
      const advY = (py + q * 34) * 0.16;
      const turb = tileFbm(advX, advY, 0, 0, seed + 55, 3);
      const grain = rand(px, py - ((q * 28) | 0), seed + 77);

      // Taper density smoothly radially & upward, eaten by swirling wind noise so clouds tear naturally!
      const envelope = Math.sqrt(clamp(1 - ax * ax, 0, 1)) * (1 - 0.65 * Math.pow(vy, 1.8));
      const density = envelope * (1.28 - 0.55 * u) - (1 - turb) * 0.58;
      if (density <= 0.12) continue;

      // Horizontal wind-swept sand streaks inside the cloud!
      const gustBand = Math.sin(py * 0.65 + turb * 5.0 - signX * q * 16);
      let idx = density > 0.65 ? 4 : density > 0.42 ? 3 : 2;
      if (vy > 0.55 || gustBand > 0.55) idx = Math.min(6, idx + 1);
      if (u < 0.18) idx = Math.min(7, idx + 2);
      if (grain > 0.90 && u < 0.65) idx = Math.max(idx, 5);
      if (grain > 0.975 && u < 0.45) idx = 7;

      const alpha = clamp(density * 1.45 * fade, 0, 0.92);
      p.blend(px, py, C[clamp(idx, 1, 7)], alpha);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8);
  const G = fit(o.gems, 5);
  const D = fit(o.dune, 5);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const [CW, CH] = meta.size;
  const [OX, OY] = meta.origin;
  const X0 = -OX + 4, X1 = CW - OX - 4, Y0 = -OY + 4, Y1 = CH - OY - 4;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, C[6], C[5], C[4], C[3]],
    haze: C[4],
  });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  const slamCracks = Array.from({ length: 8 }, (_, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    let cx = X_HIT + side * R.range(2, 6);
    let cy = 0;
    const pts = [[cx, cy]];
    for (let s = 0; s < 5; s++) {
      cx += side * R.range(4, 10);
      cy = clamp(cy + R.range(-1, 3.5), 0, 10);
      pts.push([Math.round(cx), Math.round(cy)]);
    }
    return pts;
  });

  const slamRays = [-1.0, -0.68, -0.36, -0.08, 0.22, 0.54, 0.88].map((d, i) => ({
    a: -Math.PI * 0.5 + d + R.range(-0.06, 0.06),
    len: (i === 3 ? 44 : i === 2 || i === 4 ? 34 : 22) * R.range(0.9, 1.1),
  }));

  // Rolling Sapphire-Blue Gem Eyes in Stage 5 KO starting EXACTLY at `T_KO_DETACH` (`10.00s`) — ZERO gap frames!
  const koEyes = [
    { side: -1, x: X_ATK - 4.5, y: -15, vx: -19, vy: -8, rot: 0, bounced: false, alive: true, fade: 1 },
    { side: 1, x: X_ATK + 5.0, y: -15, vx: 24, vy: -10, rot: 0, bounced: false, alive: true, fade: 1 },
  ];

  let t = 0;
  let idleGrainAcc = 0;
  let moveSandAcc = 0;
  let chargeAcc = 0;
  let swingTrailAcc = 0;
  let slamStormAcc = 0;
  let koCascadeAcc = 0;
  let splatDone = false;
  let hitDone = false;
  let koDropStarted = false;

  return {
    update(dt) {
      t += dt;
      const st = mimicStateAt(t);

      // 1. Idle / Quirk: Golden surface grains continually sifting downward & glittering
      if (t < T_MOVE && st.koPour < 0.1) {
        idleGrainAcc += dt * (st.splatMix > 0.2 ? 6 : 14);
        while (idleGrainAcc >= 1) {
          idleGrainAcc -= 1;
          const sx = st.x + R.range(-st.W * 0.42, st.W * 0.42);
          const sy = -R.range(2, st.H * 0.72);
          if (R.chance(0.5)) {
            ps.spawn(P.STAR, sx, sy + 2, R.range(-5, 5), R.range(6, 16), R.range(0.26, 0.44), R.pick([WHITE, C[6], C[5]]), R.range(0.5, 1.0));
          } else {
            ps.spawn(P.GRIT, sx, sy, R.range(-8, 8), R.range(10, 26), R.range(0.30, 0.52), R.pick([C[5], C[4], C[3]]), 1);
          }
        }
      }

      // 2. Quirk Pancake Splat at `T_SPLAT`
      if (!splatDone && t >= T_SPLAT) {
        splatDone = true;
        lights.add(X_IDLE, -10, 32, C[5], 0.72, 0.24);
        for (let i = 0; i < 16; i++) {
          const side = i % 2 === 0 ? -1 : 1;
          ps.spawn(P.DUST, X_IDLE + side * R.range(10, 24), -2, side * R.range(24, 62), -R.range(8, 24), R.range(0.28, 0.48), C[4], R.range(1.6, 2.8));
        }
        for (let i = 0; i < 18; i++) {
          const a = -Math.PI * 0.5 + R.range(-1.3, 1.3);
          const sp = R.range(45, 125);
          ps.spawn(P.SPARK, X_IDLE + R.range(-10, 10), -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.18, 0.34));
        }
      }

      // 3. Stage 3 Move: Fine sparkling golden sandstorm wake & wind streaks behind racing tornado!
      if (t >= T_MOVE && t < T_ATK) {
        moveSandAcc += dt * 96 * clamp(st.swirlMix + 0.2);
        while (moveSandAcc >= 1) {
          moveSandAcc -= 1;
          const rKind = R.next();
          if (rKind < 0.28) {
            ps.spawn(P.STREAK, st.x + R.range(-14, 8), -R.range(2, 18), -R.range(65, 145), -R.range(2, 18), R.range(0.16, 0.28), R.pick([C[5], C[4], C[6]]), 1);
          } else if (rKind < 0.65) {
            ps.spawn(P.SPARK, st.x + R.range(-12, 8), -1, -R.range(42, 118), -R.range(12, 58), R.range(0.20, 0.42));
          } else {
            ps.spawn(P.STAR, st.x + R.range(-16, 8), -R.range(3, 34), -R.range(30, 76), -R.range(8, 34), R.range(0.24, 0.46), R.pick([WHITE, C[6], C[5]]), R.range(0.6, 1.2));
          }
        }
      }

      // 4. Stage 4 Attack: Inward condensation -> blazing swing spray -> shattering ground sandstorm!
      if (t >= T_ATK && t < T_SWING) {
        chargeAcc += dt * 46;
        while (chargeAcc >= 1) {
          chargeAcc -= 1;
          const a = R.range(-Math.PI * 0.9, 0.2);
          const dist = R.range(26, 56);
          const tx = X_ATK - 4, ty = -48;
          const sx = tx + Math.cos(a) * dist;
          const sy = ty + Math.sin(a) * dist * 0.8;
          ps.spawn(P.STREAK, sx, sy, (tx - sx) * 4.8, (ty - sy) * 4.8, R.range(0.14, 0.24), R.pick([C[4], C[5], C[6]]), 1);
        }
      }
      if (t >= T_SWING && t < T_IMPACT) {
        swingTrailAcc += dt * 165;
        while (swingTrailAcc >= 1) {
          swingTrailAcc -= 1;
          const u = seg(t, T_SWING, T_IMPACT);
          const ang = lerp(-2.28, 0.38, ease.inQuad(u));
          const hx = X_ATK + 2 + Math.cos(ang) * 52 + R.range(-6, 6);
          const hy = -24 + Math.sin(ang) * 52 + R.range(-6, 6);
          ps.spawn(P.SPARK, hx, hy, R.range(-48, 15), R.range(-30, 30), R.range(0.18, 0.38));
          ps.spawn(P.STAR, hx, hy, R.range(-28, 15), R.range(-25, 15), R.range(0.20, 0.42), R.pick([WHITE, C[6], C[5]]), R.range(0.8, 1.5));
        }
      }

      if (!hitDone && t >= T_IMPACT) {
        hitDone = true;
        lights.add(X_HIT, -20, 52, C[5], 0.96, 0.52);
        lights.add(X_HIT, -12, 34, WHITE, 0.95, 0.16);

        for (let i = 0; i < 18; i++) {
          const s = R.sign();
          bits.add({
            kind: B.CHUNK,
            x: X_HIT + s * R.range(0, 8),
            y: -2,
            vx: s * R.range(28, 122),
            vy: -R.range(95, 245),
            g: 0.95,
            drag: 0.35,
            bounce: 0.35,
            life: R.range(1.0, 1.45),
            a: R.range(0, TAU),
            va: R.range(-15, 15),
            s: R.pick([1, 2, 2, 3]),
            ramp: [C[1], C[2], C[3], C[5]],
          });
        }

        // Dense spray of glittering golden sand streaks, sparks & fine sand grit!
        for (let i = 0; i < 62; i++) {
          const a = -Math.PI * 0.5 + R.range(-1.35, 1.35);
          const sp = R.range(80, 260);
          ps.spawn(P.SPARK, X_HIT + R.range(-6, 6), -2, Math.cos(a) * sp, Math.sin(a) * sp - 18, R.range(0.24, 0.62));
        }
        for (let i = 0; i < 72; i++) {
          const u = R.range(-1, 1);
          const a = -Math.PI * 0.5 + u * 0.80;
          const sp = R.range(72, 225);
          ps.spawn(P.GRIT, X_HIT + u * 8, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.75, 1.35), R.pick([C[6], C[5], C[4], C[3]]), R.chance(0.35) ? 2 : 1);
        }
        for (let i = 0; i < 20; i++) {
          const side = i % 2 === 0 ? -1 : 1;
          const vy = -R.range(20, 145);
          ps.spawn(P.STREAK, X_HIT + side * R.range(2, 12), -R.range(2, 8), side * R.range(85, 195), vy, R.range(0.14, 0.26), R.pick([WHITE, C[6], C[5]]), 1);
        }
      }

      if (t >= T_IMPACT && t < T_IMPACT + 0.95) {
        slamStormAcc += dt * 54 * (1 - seg(t, T_IMPACT, T_IMPACT + 0.95));
        while (slamStormAcc >= 1) {
          slamStormAcc -= 1;
          const sx = X_HIT + R.range(-54, 58);
          if (R.chance(0.55)) {
            ps.spawn(P.STAR, sx, -R.range(4, 44), R.range(-28, 28), -R.range(12, 46), R.range(0.24, 0.48), R.pick([WHITE, C[6], C[5]]), R.range(0.6, 1.3));
          } else {
            const side = sx < X_HIT ? -1 : 1;
            ps.spawn(P.STREAK, sx, -R.range(3, 24), side * R.range(45, 95), -R.range(6, 22), R.range(0.14, 0.24), R.pick([C[5], C[4]]), 1);
          }
        }
      }

      // 5. Stage 5 KO: Dying magic snap -> cascading matte grains -> rolling Sapphire Eyes
      if (!koDropStarted && t >= T_KO + 0.04) {
        koDropStarted = true;
        for (let i = 0; i < 16; i++) {
          ps.spawn(P.DUST, X_ATK + R.range(-14, 14), -R.range(4, 16), R.range(-24, 24), -R.range(4, 16), R.range(0.30, 0.58), D[3], R.range(1.6, 2.6));
        }
      }
      if (t >= T_KO + 0.10 && t < T_DUNE + 0.45) {
        koCascadeAcc += dt * 52 * (1 - seg(t, T_KO + 0.10, T_DUNE + 0.45));
        while (koCascadeAcc >= 1) {
          koCascadeAcc -= 1;
          const sx = X_ATK + R.range(-20, 20);
          ps.spawn(P.GRIT, sx, -R.range(5, 22), R.range(-18, 18), R.range(6, 32), R.range(0.28, 0.52), R.pick([D[3], D[4], D[2]]), 1);
        }
      }
      if (t >= T_KO_DETACH) {
        for (const ke of koEyes) {
          if (!ke.alive) continue;
          const age = t - T_KO_DETACH;
          if (age < 0.88) {
            ke.vy += 190 * dt;
            ke.x += ke.vx * dt;
            ke.y += ke.vy * dt;
            ke.rot += ke.vx * 0.25 * dt;
            if (ke.y >= -2.5) {
              ke.y = -2.5;
              if (!ke.bounced) {
                ke.bounced = true;
                ke.vy = -34;
                ke.vx *= 0.85;
              } else {
                ke.vy = 0;
                ke.vx *= 1 - 2.6 * dt;
              }
            }
          } else {
            ke.x += ke.vx * dt;
            ke.vx *= 1 - 4.0 * dt;
            ke.fade = clamp(1 - (age - 0.88) / 0.48);
            if (ke.fade <= 0.02) ke.alive = false;
          }
        }
      }

      bits.update(dt);
      for (let i = bits.list.length - 1; i >= 0; i--) {
        if (t > T_END - 0.12 || bits.list[i].x > X1 - 6 || bits.list[i].x < X0 + 6) bits.list.splice(i, 1);
      }
      ps.update(dt);
      cullParticles(ps, X0, Y0, X1, Y1);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.02) return;
      const st = mimicStateAt(t);

      if (st.koFade > 0.03) {
        const shRx = Math.max(12, st.W * 0.56);
        shadow(p, st.x, 1, shRx, 2.5, D[0], 0.48 * st.koFade);
        if (st.magicGlow > 0.08) {
          p.glow(st.x, -8, Math.min(26, shRx * 1.15), C[4], 0.26 * st.magicGlow);
          p.glow(st.x, -st.H * 0.5, 28, C[5], 0.34 * st.magicGlow);
        }
      }

      if (st.magicGlow > 0.2 && st.swirlMix < 0.5) {
        const rx = st.W * 0.52 + 4;
        for (let x = Math.floor(st.x - rx); x <= Math.ceil(st.x + rx); x++) {
          const d = Math.abs(x - st.x) / rx;
          if (d > 1) continue;
          const glint = rand(x, (t * 12) | 0, o.seed + 91) > 0.86;
          p.blend(x, 0, glint ? C[6] : d > 0.7 ? C[2] : C[4], 0.78 * st.magicGlow);
        }
      }

      drawSandTornado(p, C, G, st, t, o.seed, true);

      if (t >= T_IMPACT && t < T_KO + 0.65) {
        const q = t - T_IMPACT;
        const fade = 1 - smooth(T_POST_IDLE + 0.2, T_KO + 0.65, t);
        const hot = clamp(1 - q / 0.75);
        for (let dx = -12; dx <= 12; dx++) {
          const u = Math.abs(dx) / 12;
          const dp = Math.round(2.8 * (1 - u * u));
          for (let dy = 0; dy < dp; dy++) p.blend(X_HIT + dx, dy, C[0], fade * 0.9);
          if (dp > 0) p.blend(X_HIT + dx, dp, hot > 0.3 ? C[5] : C[2], fade);
        }
        for (const cr of slamCracks) {
          const reach = clamp(q / 0.14);
          const n = Math.max(1, Math.floor((cr.length - 1) * reach));
          for (let i = 1; i <= n; i++) {
            p.blend(cr[i][0], cr[i][1] + 1, q < 0.12 ? WHITE : hot > 0.2 ? C[5] : C[1], fade * 0.88);
          }
        }
        const ku = q / 0.54;
        if (ku < 1) {
          band(p, X_HIT, 0.5, 8 + 74 * ease.outCubic(ku), 0.18, Math.max(1.8, 4.6 * (1 - ku)), (1 - ku) * 0.95, [C[2], C[4], C[5], WHITE], (g) => Math.sin(g) < 0, ku < 0.28);
        }
      }

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.02) return;
      const st = mimicStateAt(t);

      // 1. Mimic Body (`Grid` unclipped irregular water-drop + flowing downward sand + Sapphire Eyes)
      const bodyInfo = drawQuicksandBody(BODY_GRID, p, C, D, G, st, t, o.seed);
      for (const ep of bodyInfo.eyePos) {
        if (st.magicGlow > 0.2) {
          p.glow(ep.x, ep.y, 7.0, G[2], 0.50 * st.magicGlow);
          p.glow(ep.x, ep.y, 3.0, G[4], 0.32 * st.magicGlow);
        }
      }

      if (st.crownMix > 0.6 && t < T_CROWN_PEAK + 0.08) {
        const tipY = Math.round(-st.H - 1);
        sparkle(p, st.x, tipY, 2.0, WHITE, C[6], 0.85);
        sparkle(p, st.x - 9, tipY + 2, 1.5, WHITE, C[5], 0.75);
        sparkle(p, st.x + 9, tipY + 2, 1.5, WHITE, C[5], 0.75);
      }

      // 2. Stage 3 Move: Front tornado swirl + orbiting sapphire eyes
      drawSandTornado(p, C, G, st, t, o.seed, false);

      // 3. Stage 4 Attack: Giant Golden Sand-Hammer + Sweeping Gold-Sand Swing Trail
      drawGoldenSandHammer(p, C, st, t, o.seed);

      // 4. Stage 4 Hit Result: Roaring FBM-Textured Desert Sandstorm Eruption (`漫天沙暴`), Racing Crescents & Force Dome!
      if (t >= T_IMPACT && t < T_KO + 0.45) {
        const q = t - T_IMPACT;

        // Textured swirling sandstorm wall — NO floating sphere bubbles!
        drawSandstormEruption(p, C, q, o.seed, X0, X1, Y0);

        const ku = q / 0.54;
        if (ku < 1) {
          band(p, X_HIT, 0.5, 8 + 74 * ease.outCubic(ku), 0.18, Math.max(1.8, 4.6 * (1 - ku)), (1 - ku) * 0.98, [C[2], C[4], C[5], WHITE], (g) => Math.sin(g) >= 0, ku < 0.28);

          const fr = 8 + 74 * ease.outCubic(ku);
          const hCr = 9 + 28 * Math.pow(1 - ku, 0.70);
          const wCr = 1.8 + 5.0 * Math.pow(1 - ku, 0.84);
          const colsCr = ku < 0.25 ? [WHITE, C[6], C[5]] : [C[6], C[4], C[2]];
          for (const s of [-1, 1]) {
            const fx = clamp(X_HIT + s * fr, X0 + 8, X1 - 8);
            frontCrescent(p, fx, s, hCr, wCr, colsCr, 1 - ku);
            p.glow(fx, -Math.max(8, hCr * 0.4), 10 + hCr * 0.45, C[4], 0.36 * (1 - ku));
          }
        }

        const dDome = (q - 0.03) / 0.36;
        if (dDome >= 0 && dDome < 1) {
          const rr = 12 + 44 * ease.outCubic(dDome);
          const a = 1 - dDome;
          const steps = Math.ceil(rr * 3);
          for (let i = 0; i <= steps; i++) {
            const ang = -Math.PI * (i / steps);
            const px = X_HIT + Math.cos(ang) * rr;
            const py = Math.sin(ang) * rr;
            if (px < X0 + 4 || px > X1 - 4 || py < Y0 + 4) continue;
            p.blend(px, py, dDome < 0.3 ? WHITE : C[5], a * 0.92);
            p.blend(px, py + 1.2, C[4], a * 0.65);
          }
        }

        if (q < 0.16) {
          const fk = 1 - q / 0.16;
          p.ellipse(X_HIT, 0, 22 * fk, 4.5 * fk, WHITE);
          flare(p, X_HIT, -3, 36 * fk, fk, [C[3], C[5], C[6], WHITE]);
          for (const ry of slamRays) {
            const l = ry.len * ease.outCubic(clamp(q / 0.08));
            p.line(X_HIT, -1, X_HIT + Math.cos(ry.a) * l, -1 + Math.sin(ry.a) * l, q < 0.07 ? WHITE : C[5], fk);
          }
        }
      }

      // 5. Stage 5 KO: Dying magic energy snap + Two Sapphire-Blue Gem Eyes Rolling Down Dune Slope & Vanishing
      if (t >= T_KO && t < T_KO + 0.24) {
        const u = seg(t, T_KO, T_KO + 0.24);
        band(p, X_ATK, -12, 8 + 18 * ease.outCubic(u), 0.35, 1.5, 1 - u, [C[4], C[6], WHITE], () => true, false);
      }
      for (const ke of koEyes) {
        if (!ke.alive) continue;
        if (t >= T_KO_DETACH) {
          p.blend(ke.x, ke.y, G[0], ke.fade);
          drawSapphireEye(p, G, ke.x, ke.y, "idle", 0, 0.94 * ke.fade, ke.side, false);
          const gx = ke.x + Math.cos(ke.rot) * 1.1;
          const gy = ke.y + Math.sin(ke.rot) * 1.1;
          p.blend(gx, gy, WHITE, ke.fade);
          p.glow(ke.x, Math.min(-4, ke.y), 6.5 * ke.fade, G[3], 0.42 * ke.fade);
        }
      }

      for (const b of bits.list) {
        const fade = clamp(b.life / 0.4);
        p.disc(b.x, b.y, b.s * 0.85, C[2], fade);
        p.blend(Math.round(b.x), Math.round(b.y), C[5], fade);
      }

      ps.draw(p, "front");
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
