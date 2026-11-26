// Lazy forest-floor moss critter: plush sphere with glowing florets, golden sunbeam rug nap, double moss-trail roll,
// bristling grass-needles + rolling sleep-spore fluid cloud & emerald hypnotic hit spots, and dried-mud dust crumble KO
// building on ../weather/god-rays.js, ../nature/spore-burst.js, ../nature/poison-cloud.js, ../nature/healing-bloom.js,
// ../status/sleep.js, ./volt-furball.js, and ./slime.js (adapted from Sprite Fusion's open-source VFX, MIT License, Copyright (c) 2026 Hugo Duprez).
import {
  Particles,
  Bits,
  Lights,
  P,
  B,
  Rng,
  fit,
  flare,
  clamp,
  smooth,
  seg,
  ease,
  lerp,
  mix,
  tileFbm,
  tileNoise,
  TAU,
  WHITE,
} from "../../core/index.js";
import { Grid, shadow } from "./_lib.js";
import { icon, bitmap } from "../status/_lib.js";

export const meta = {
  name: "Moss puff",
  desc: "A plush moss ball with glowing florets naps flat in a sunbeam under a yellow bloom, rolls leaving a moss trail, bristles needles, blasts sleep spores, then crumbles dry.",
  tags: ["critter", "monster", "moss", "plant", "sleep", "spores", "sunbeam", "one-shot"],
  size: [320, 184],
  origin: [120, 140],
  duration: 12.0,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    // 8-step Plush Emerald Moss & Sleep-Spore Cloud ramp
    palette: ["#091b0c", "#133a18", "#206224", "#328f2e", "#50bd3c", "#84e356", "#c4fa88", "#f0ffd4"],
    // 5-step Warm Golden Sunbeam & Tiny Dandelion-Yellow Flower ramp
    sun: ["#4a2806", "#9a5b10", "#de981e", "#ffd548", "#fff6ae"],
    // 5-step Parched Withered Mud & Dry Clay Dust ramp for KO crumble
    wither: ["#2e2214", "#5c452b", "#8a6842", "#ba9464", "#dfc090"],
    seed: 23,
  },
};

// 5-Stage Sustained Choreography + Smooth Transitions (12.00s, 360 frames):
// 0.00..2.15  【待机 Idle】               Plush emerald moss sphere with rice-grain glowing white florets quietly breathing on floor
// 2.15..4.85  【生态小动作 Quirk】        Warm golden sunbeam descends -> melts flat into lush green carpet -> yellow flower blooms -> emerald sleep bubbles drift
// 4.85..7.05  【移动 Move】               Coils back into a sphere -> lazily rolls 2 full revolutions forward (-68 -> -12) leaving a long plush moss trail -> pauses to pant
// 7.05..9.85  【攻击 + 命中 Attack】      Disturbed & angry -> bristles stiff tapered emerald grass needles -> blasts dense tumbling emerald sleep-spore cloud -> bursts hypnotic emerald light spots at +56 -> calms
// 9.85..12.00 【倒地 KO】                 Emerald fades to parched yellow-brown -> crown flower droops, sheds petals & wilts -> cracks like dry mud & crumbles into powdery beige dust cleanly to 0 px
const T_QUIRK = 2.15;
const T_CARPET = 2.55;
const T_SUN_OFF = 4.35;
const T_MOVE = 4.85;
const T_ROLL_END = 6.62;
const T_ATK = 7.05;
const T_BREATH = 7.48;
const T_HIT = 7.90;
const T_POST_IDLE = 9.15;
const T_KO = 9.85;
const T_CRACK = 10.45;
const T_END = meta.duration;

const X_IDLE = -68;
const X_ATK = -12;
const X_HIT = 56;
const R_BASE = 16.5;

const BODY_GRID = new Grid(-112, -76, 158, 82);

// Tiny hypnotic Z icon from `status/sleep.js` for the sleep-spore hit result!
const SLEEP_Z = bitmap(["#####", "...#.", "..#..", ".#...", "#####"]);

// 6 glowing rice-grain white florets embedded across the upper mossy sphere
const FLORETS = [
  [-0.50, -0.44],
  [-0.18, -0.74],
  [0.24, -0.68],
  [0.54, -0.34],
  [-0.60, -0.02],
  [0.14, -0.30],
];

function mossStateAt(t) {
  let x = X_IDLE;
  let y = 0;
  let rx = R_BASE;
  let ry = R_BASE * 0.90;
  let rollAng = 0;
  let sunK = 0;
  let carpetMix = 0;
  let bloomK = 0;
  let flowerScale = 0;
  let flowerWilt = 0;
  let needleK = 0;
  let blowLean = 0;
  let dryMix = 0;
  let crumbleU = 0;
  let eyeMode = "shy";
  let blink = 0;
  let fade = 1;

  if (t < T_QUIRK) {
    // Stage 1: 【待机 Idle】 Cozy quiet breathing sphere on floor
    const breath = Math.sin((t / T_QUIRK) * TAU * 2.5);
    rx = R_BASE + breath * 1.1;
    ry = R_BASE * 0.90 - breath * 1.0;
    blink = (t > 0.72 && t < 0.88) || (t > 1.58 && t < 1.72) ? 1 : 0;
    eyeMode = "shy";
  } else if (t < T_MOVE) {
    // Stage 2: 【生态小动作 Quirk】 Golden sunbeam -> flattens into plush moss carpet -> yellow bloom + sleep bubbles
    sunK = smooth(T_QUIRK, T_QUIRK + 0.34, t) * (1 - smooth(T_SUN_OFF, T_MOVE - 0.08, t));
    const flatIn = ease.inOutCubic(seg(t, T_QUIRK + 0.22, T_CARPET + 0.35));
    const flatOut = 1 - ease.inOutCubic(seg(t, T_SUN_OFF - 0.08, T_MOVE));
    carpetMix = flatIn * flatOut;

    rx = lerp(R_BASE, 26.5, carpetMix);
    ry = lerp(R_BASE * 0.90, 5.4, carpetMix);

    bloomK = ease.outBack(seg(t, 2.80, 3.45), 1.35);
    flowerScale = lerp(0.85, 1.05, carpetMix) * bloomK;
    eyeMode = carpetMix > 0.32 ? "bliss" : "shy";
  } else if (t < T_ATK) {
    // Stage 3: 【移动 Move】 Lazy 2-turn roll (`0 -> 2 * TAU`) from X_IDLE to X_ATK leaving a long lush moss trail -> stops to pant
    flowerScale = 0.75;
    if (t < T_ROLL_END) {
      const u = seg(t, T_MOVE, T_ROLL_END);
      let rollU;
      if (u < 0.45) rollU = 0.50 * ease.inOutSine(u / 0.45);
      else if (u < 0.55) rollU = 0.50; // Lazy breather between turn 1 & turn 2!
      else rollU = 0.50 + 0.50 * ease.inOutSine((u - 0.55) / 0.45);

      x = lerp(X_IDLE, X_ATK, rollU);
      rollAng = rollU * TAU * 2.0; // Two complete lazy revolutions!
      const rolling = u < 0.45 || u > 0.55 ? 1 : 0;
      const bounce = Math.abs(Math.sin(rollU * Math.PI * 2)) * 1.8 * rolling;
      y = -bounce;
      rx = R_BASE * (0.98 + 0.04 * Math.cos(rollAng * 2));
      ry = R_BASE * (0.96 - 0.04 * Math.cos(rollAng * 2));
      eyeMode = "pant";
    } else {
      x = X_ATK;
      const u = seg(t, T_ROLL_END, T_ATK);
      const pant = Math.sin(u * Math.PI * 4.0) * (1 - u * 0.35);
      rx = R_BASE + pant * 1.6;
      ry = R_BASE * 0.88 - pant * 1.5;
      eyeMode = "pant";
    }
  } else if (t < T_KO) {
    // Stage 4: 【攻击 + 缓冲 Attack & Post-Idle】 Startles & bristles grass needles -> blasts rolling spore cloud -> settles
    x = X_ATK;
    flowerScale = 0.80;
    if (t < T_BREATH) {
      const u = seg(t, T_ATK, T_BREATH);
      needleK = ease.outBack(clamp(u / 0.50), 1.45);
      const swell = smooth(0.35, 1.0, u);
      rx = lerp(R_BASE, R_BASE * 1.15, swell);
      ry = lerp(R_BASE * 0.88, R_BASE * 1.08, swell);
      blowLean = -2.2 * swell;
      eyeMode = "rage";
    } else if (t < T_POST_IDLE) {
      const age = t - T_BREATH;
      const lunge = Math.exp(-age * 4.8) * Math.sin(Math.min(1, age / 0.14) * Math.PI);
      needleK = 1 - smooth(0.55, 1.15, age);
      rx = R_BASE * (1 + 0.18 * lunge);
      ry = R_BASE * (0.88 - 0.14 * lunge);
      blowLean = 4.5 * Math.exp(-age * 4.2);
      eyeMode = age < 0.95 ? "rage" : "pant";
    } else {
      const u = seg(t, T_POST_IDLE, T_KO);
      const breath = Math.sin(u * TAU * 1.5);
      rx = R_BASE + breath * 1.1;
      ry = R_BASE * 0.90 - breath * 1.0;
      eyeMode = "shy";
      blink = u > 0.42 && u < 0.58 ? 1 : 0;
    }
  } else {
    // Stage 5: 【倒地 KO】 Drains to parched yellow-brown -> flower droops & wilts dry -> cracks & crumbles into powdery dust!
    x = X_ATK;
    dryMix = ease.inOutQuad(seg(t, T_KO, T_KO + 0.52));
    flowerWilt = ease.inQuad(seg(t, T_KO + 0.05, T_CRACK + 0.25));
    flowerScale = Math.max(0, 0.80 * (1 - smooth(T_CRACK + 0.10, T_CRACK + 0.65, t)));
    crumbleU = ease.inQuad(seg(t, T_CRACK, T_END - 0.35));
    rx = lerp(R_BASE, R_BASE * 1.28, crumbleU * 0.65);
    ry = lerp(R_BASE * 0.88, 3.2, crumbleU);
    fade = 1 - smooth(T_END - 0.45, T_END - 0.04, t);
    eyeMode = t < T_KO + 0.25 ? "wince" : "dead";
  }

  return {
    x, y, rx, ry, rollAng,
    sunK, carpetMix, flowerScale, flowerWilt,
    needleK, blowLean, dryMix, crumbleU,
    eyeMode, blink, fade,
  };
}

function mossPerimeterR(ang, st, t, seed) {
  if (st.carpetMix > 0.55) {
    return 1.0 + 0.09 * Math.abs(Math.cos(ang * 14));
  }
  const nTufts = st.needleK > 0.25 ? 24 : 26;
  const wave = Math.cos(ang * nTufts + st.rollAng * 2);
  if (st.needleK > 0.05) {
    const sharpSpike = Math.pow(Math.abs(wave), 3.2) * (0.68 + 0.32 * Math.sin(ang * 9 + seed));
    const softTuft = Math.pow(0.5 + 0.5 * wave, 1.3);
    const amp = lerp(0.11 * softTuft, 0.48 * sharpSpike, st.needleK);
    return 1.0 + amp;
  }
  const soft = Math.pow(0.5 + 0.5 * wave, 1.35) * (0.7 + 0.3 * Math.sin(ang * 7 + t * 2));
  return 1.0 + 0.11 * soft;
}

function drawMossBallBody(g, p, C, Sun, Wither, st, t, seed) {
  if (st.fade <= 0.02 || st.crumbleU >= 0.96) return;
  g.clear();

  const bx = st.x;
  const by = Math.round(st.y);
  const cx = bx + st.blowLean * 0.5;
  const cy = by - st.ry * 0.86;
  const rx = st.rx;
  const ry = st.ry;
  const pad = Math.ceil(Math.max(rx, ry) + 14);

  const ramp = st.dryMix > 0.02
    ? C.map((c, i) => mix(c, Wither[Math.min(4, Math.floor((i * 5) / 8))], st.dryMix))
    : C;

  const cosR = Math.cos(st.rollAng);
  const sinR = Math.sin(st.rollAng);

  g.shade(cx - pad, cy - pad, cx + pad, by + 2, (wx, wy, out) => {
    if (wy > 0.4) return 0;
    const dx = wx - (cx + st.blowLean * clamp((by - wy) / Math.max(4, ry * 2)));
    const dy = wy - cy;
    const nx = dx / Math.max(2, rx);
    const ny = dy / Math.max(2, ry);
    const rNorm = Math.hypot(nx, ny);
    const ang = Math.atan2(ny, nx);

    const maxR = mossPerimeterR(ang, st, t, seed);
    if (rNorm > maxR) return 0;

    if (st.crumbleU > 0.04) {
      const nDust = tileFbm(wx * 0.32, wy * 0.32, 0, 0, seed + 17, 2);
      const topDrain = clamp((cy - wy) / Math.max(4, ry) + 0.65);
      if (nDust + topDrain * 0.48 < st.crumbleU * 1.24) return 0;
    }

    out.t = 1;
    out.a = st.fade;
    return ramp[4];
  });

  g.depths(5);

  g.recolor((wx, wy, col, al, tag) => {
    if (tag !== 1) return col;
    const d = g.depth(wx, wy);
    const dx = wx - cx;
    const dy = wy - cy;
    const nx = dx / Math.max(2, rx);
    const ny = dy / Math.max(2, ry);
    const lit = -0.52 * nx - 0.68 * ny;

    if (d === 1) {
      if (st.needleK > 0.35 && Math.hypot(nx, ny) > 1.05) return C[6];
      return lit > 0.30 && st.dryMix < 0.5 ? ramp[2] : ramp[0];
    }

    // Crisp sun-dried mud fracture ledges (`#dec192` light rim next to `#2e2214` crack) during KO!
    if (st.dryMix > 0.45) {
      const crackNoise = Math.abs(tileFbm(wx * 0.24, wy * 0.24, 0, 0, seed + 83, 2) - 0.5);
      if (crackNoise < 0.048 * (st.dryMix + st.crumbleU)) return Wither[0];
      if (crackNoise < 0.082 * (st.dryMix + st.crumbleU)) return Wither[4];
    }

    const uRot = nx * cosR + ny * sinR;
    const vRot = -nx * sinR + ny * cosR;
    const mossFuzz = tileNoise(uRot * 9, vRot * 9, 8, 8, seed + 31);

    let i = lit > 0.42 ? 5 : lit > 0.05 ? 4 : lit > -0.32 ? 3 : 2;
    if (mossFuzz > 0.72 && d >= 2) i = Math.min(6, i + 1);
    if (mossFuzz < 0.25 && d >= 2) i = Math.max(1, i - 1);
    if (st.sunK > 0.15 && ny < -0.1) i = Math.min(7, i + 1);

    return ramp[clamp(i, 0, ramp.length - 1)];
  });

  g.outline((wx, wy, ox, oy) => {
    const idx = g.idx(wx, wy);
    if (idx >= 0) g.a[idx] = st.fade;
    return oy < 0 && ox <= 0 ? ramp[1] : ramp[0];
  });

  // Crisp 2x2 / 3px Rice-Grain Glowing White Little Florets (`米粒大小的白色发光小碎花`)!
  const floretPositions = [];
  if (st.crumbleU < 0.55) {
    for (let f = 0; f < FLORETS.length; f++) {
      const [fnx, fny] = FLORETS[f];
      const rnx = fnx * cosR - fny * sinR;
      const rny = fnx * sinR + fny * cosR;
      if (rny > 0.55 && st.carpetMix < 0.5) continue;
      const fx = Math.round(cx + rnx * rx * 0.84);
      const fy = Math.round(cy + rny * ry * 0.84);
      if (fy >= -1) continue;
      if (g.idx(fx, fy) >= 0) {
        const fc = st.dryMix > 0.4 ? Wither[4] : WHITE;
        const fcCenter = st.dryMix > 0.4 ? Wither[2] : Sun[4];
        const fcRim = st.dryMix > 0.4 ? Wither[1] : C[1];
        // Dark green micro-sepal base + luminous white cross/rice-grain petals + pale gold heart!
        g.set(fx, fy + 1, fcRim, 1, 5);
        g.set(fx, fy, fcCenter, 1, 5);
        g.set(fx - 1, fy, fc, 1, 5);
        g.set(fx + 1, fy, fc, 1, 5);
        g.set(fx, fy - 1, fc, 1, 5);
        floretPositions.push({ x: fx, y: fy });
      }
    }
  }

  // Expressive Cozy Forest-Floor Critter Eyes
  if (st.eyeMode !== "dead" && Math.cos(st.rollAng) > -0.2) {
    const eyOffset = st.carpetMix > 0.5 ? 0 : Math.sin(st.rollAng) * ry * 0.28;
    const exShift = Math.sin(st.rollAng) * rx * 0.30;
    const ey = Math.round(cy + ry * 0.10 + eyOffset);
    const sep = st.carpetMix > 0.5 ? 7.5 : 5.4;

    if (ey < -1) {
      for (const side of [-1, 1]) {
        const ex = Math.round(cx + exShift + side * sep);
        if (st.eyeMode === "bliss" || st.blink > 0.5) {
          for (let dx = -2; dx <= 2; dx++) {
            g.set(ex + dx, ey + (Math.abs(dx) === 2 ? -1 : 0), C[0], 1, 5);
          }
        } else if (st.eyeMode === "rage") {
          // Furious glaring white-lime slits `> <`!
          for (let dx = -2; dx <= 2; dx++) {
            g.set(ex + dx, ey + (dx * side > 0 ? 0 : -1), WHITE, 1, 5);
            g.set(ex + dx, ey + 1 + (dx * side > 0 ? 0 : -1), C[0], 1, 5);
          }
        } else {
          // Clear shy rounded dark-emerald eyes with crisp pale-gold catchlight!
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              g.set(ex + dx, ey + dy, dx === 0 && dy === -1 ? Sun[4] : C[0], 1, 5);
            }
          }
        }
      }
    }
  }

  g.draw(p);

  if (st.dryMix < 0.5) {
    for (const fp of floretPositions) {
      p.glow(fp.x, fp.y, 4.5, C[6], 0.36 * (1 - st.dryMix * 2) * st.fade);
    }
  }

  if (st.flowerScale > 0.06) {
    drawYellowCrownFlower(p, C, Sun, Wither, cx, cy, rx, ry, st.rollAng, st.flowerScale, st.flowerWilt, st.dryMix, t);
  }
}

function drawYellowCrownFlower(p, C, Sun, Wither, cx, cy, rx, ry, rollAng, scale, wilt, dryMix, t) {
  const rotA = -Math.PI * 0.5 + rollAng;
  const nx = Math.cos(rotA), ny = Math.sin(rotA);
  if (ny > 0.35) return;
  const baseX = cx + nx * rx * 0.90;
  const baseY = Math.min(-1, cy + ny * ry * 0.90);

  const sway = Math.sin(t * 3.2) * 1.4 * (1 - wilt);
  const droop = wilt * 7.8;
  const stemH = 7.8 * scale * (1 - wilt * 0.35);
  const tipX = baseX + sway + wilt * 5.8;
  const tipY = Math.min(-1, baseY - stemH + droop);

  const stemCol = dryMix > 0.4 ? Wither[2] : C[5];
  p.line(baseX, baseY, tipX, tipY, stemCol, 0.96);

  const petalR = 3.6 * scale * (1 - wilt * 0.45);
  if (petalR < 0.8) return;
  const pCol = dryMix > 0.42 ? mix(Sun[2], Wither[3], (dryMix - 0.42) / 0.58) : Sun[3];
  const pHi = dryMix > 0.42 ? Wither[4] : Sun[4];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + t * 0.6;
    const px = tipX + Math.cos(a) * petalR * 0.68;
    const py = tipY + Math.sin(a) * petalR * 0.68;
    p.disc(px, py, petalR * 0.44, pCol, 0.96);
  }
  p.disc(tipX, tipY, petalR * 0.36, dryMix > 0.45 ? Wither[1] : Sun[1], 0.98);
  p.blend(Math.round(tipX - 0.5), Math.round(tipY - 0.5), pHi, 0.95);
  if (dryMix < 0.4) p.glow(tipX, tipY, 8 * scale, Sun[3], 0.36 * (1 - dryMix * 2));
}

// Stage 2: Full-Height Warm Slanted Golden Sunbeam Column (`y = -OY -> 0`, ZERO top cutoff bar!)
function drawGoldenSunbeam(p, Sun, st, t, X0, X1, OY) {
  if (st.sunK <= 0.03) return;
  const k = st.sunK;
  const targetX = st.x;
  const sxTop = targetX - 44;
  const yTop = -OY;

  // Floor warm sunlit pool oval
  for (let dx = -34; dx <= 34; dx++) {
    const u = Math.abs(dx) / 34;
    if (u > 1) continue;
    const a = Math.sqrt(1 - u * u) * 0.48 * k;
    p.blend(targetX + dx, 0, u < 0.4 ? Sun[4] : Sun[3], a);
    p.blend(targetX + dx, -1, Sun[3], a * 0.65);
  }
  p.glow(targetX, -14, 38, Sun[3], 0.34 * k);

  for (let py = yTop; py <= -1; py++) {
    const v = (py - yTop) / Math.max(1, -yTop);
    const cx = lerp(sxTop, targetX, v);
    const halfW = lerp(11, 27, v);
    const minX = Math.max(X0 + 4, Math.floor(cx - halfW));
    const maxX = Math.min(X1 - 4, Math.ceil(cx + halfW));
    const sway = Math.sin(t * 2.5 + v * 2.0) * 1.5;

    for (let px = minX; px <= maxX; px++) {
      const q = Math.abs(px + 0.5 - (cx + sway)) / halfW;
      if (q >= 1) continue;
      const bandRays = 0.72 + 0.28 * Math.sin(((px - cx) / halfW) * 11 + t * 2.2);
      const e = Math.pow(1 - q * q, 1.4) * bandRays * (0.35 + 0.65 * Math.sin(v * Math.PI * 0.85));
      const col = e > 0.78 ? Sun[4] : e > 0.45 ? Sun[3] : Sun[2];
      p.blend(px, py, col, e * 0.42 * k);
    }
  }
}

// Stage 4: Rolling Turbulent Emerald Sleep-Spore Fluid Cloud (`令人窒息的浓密翠绿睡眠孢子云雾`)
function drawRollingSleepSporeCloud(p, C, t, seed, X0, X1, Y0) {
  if (t < T_BREATH || t >= T_POST_IDLE + 0.35) return;
  const age = t - T_BREATH;
  const dur = 1.95;
  if (age >= dur) return;
  const u = age / dur;

  const frontX = lerp(X_ATK + 8, X_HIT + 48, ease.outCubic(clamp(age / 0.56)));
  const tailX = lerp(X_ATK + 2, X_HIT - 36, smooth(0.28, 1.0, u));
  const fade = smooth(0, 0.08, u) * (1 - smooth(0.45, 1.0, u));
  if (fade <= 0.03) return;

  const minX = Math.max(X0 + 4, Math.floor(Math.min(tailX, frontX - 68)));
  const maxX = Math.min(X1 - 4, Math.ceil(frontX + 8));
  const H_MAX = Math.round(32 + 22 * Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.75));
  const minY = Math.max(Y0 + 4, -H_MAX - 6);

  for (let py = minY; py <= 0; py++) {
    const vy = -py / Math.max(1, H_MAX);
    for (let px = minX; px <= maxX; px++) {
      const span = Math.max(12, frontX - tailX);
      const ax = (px - (tailX + span * 0.5)) / (span * 0.55);
      if (Math.abs(ax) > 1.0) continue;

      const advX = (px - age * 60) * 0.12;
      const advY = (py + Math.sin(px * 0.09 - age * 7) * 5) * 0.16;
      const turb = tileFbm(advX, advY, 0, 0, seed + 61, 3);
      const curl = Math.sin(px * 0.18 - age * 12 + py * 0.15 + turb * 3.2);

      const env = Math.sqrt(clamp(1 - ax * ax, 0, 1)) * (1 - 0.56 * Math.pow(vy, 1.65));
      const dens = env * (1.32 - 0.34 * u) - (1 - turb) * 0.46;
      if (dens <= 0.14) continue;

      let idx = dens > 0.72 ? 5 : dens > 0.48 ? 4 : dens > 0.28 ? 3 : 2;
      if (curl > 0.45) idx = Math.min(7, idx + 1);
      if (vy > 0.62 && curl > 0.15) idx = Math.min(6, idx + 1);
      if (px > frontX - 10 && dens > 0.3) idx = Math.min(7, idx + 1);

      const alpha = clamp(dens * 1.40 * fade, 0, 0.90);
      p.blend(px, py, C[clamp(idx, 1, 7)], alpha);
    }
  }

  p.glow((tailX + frontX) * 0.5, -18, 46, C[5], 0.38 * fade);
}

// Tapered Sharp Emerald Grass-Needles shooting stiffly out across BOTH rim & foreground hemisphere (`无数根翠绿的草针`)!
function drawBristlingGrassNeedles(p, C, st, seed) {
  if (st.needleK <= 0.15 || st.crumbleU > 0.2) return;
  const k = st.needleK;
  const cy = -st.ry * 0.86;
  const nNeedles = 28;
  for (let i = 0; i < nNeedles; i++) {
    const a = -Math.PI + (i / (nNeedles - 1)) * Math.PI + Math.sin(i * 4.3 + seed) * 0.05;
    const tier = i % 2 === 0 ? 1.0 : 0.72;
    const r0 = st.rx * (0.76 + (i % 3) * 0.06);
    const len = (11.2 * tier + 2.5 * Math.sin(i * 2.1)) * k;
    const ca = Math.cos(a), sa = Math.sin(a);
    const x0 = st.x + ca * r0;
    const y0 = cy + sa * st.ry * 0.80;
    const x1 = st.x + ca * (r0 + len);
    const y1 = cy + sa * (st.ry * 0.84 + len);
    if (y1 > -1) continue;

    const steps = Math.ceil(len * 1.6);
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const px = lerp(x0, x1, u);
      const py = lerp(y0, y1, u);
      const col = u > 0.78 ? WHITE : u > 0.45 ? C[6] : u > 0.18 ? C[5] : C[3];
      p.blend(px, py, col, 0.96 * k);
      if (u < 0.45) {
        p.blend(px - sa * 0.7, py + ca * 0.7, C[1], 0.85 * k);
      }
    }
  }

  // Foreground 3D hemisphere needles springing forward off the moss ball face!
  const fgNeedles = [
    [-0.45, -0.58, -0.55, -0.95],
    [-0.12, -0.66, -0.08, -1.08],
    [0.24, -0.60, 0.40, -0.96],
    [-0.36, -0.26, -0.68, -0.45],
    [0.34, -0.28, 0.72, -0.42],
    [0.04, -0.35, 0.12, -0.78],
  ];
  for (const [fx, fy, dx, dy] of fgNeedles) {
    const x0 = st.x + fx * st.rx * 0.78;
    const y0 = cy + fy * st.ry * 0.78;
    const x1 = x0 + dx * 10.5 * k;
    const y1 = y0 + dy * 10.5 * k;
    const steps = Math.ceil(11 * k * 1.5);
    for (let s = 0; s <= steps; s++) {
      const u = s / Math.max(1, steps);
      p.blend(lerp(x0, x1, u), lerp(y0, y1, u), u > 0.7 ? WHITE : u > 0.35 ? C[6] : C[4], 0.96 * k);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8);
  const Sun = fit(o.sun, 5);
  const Wither = fit(o.wither, 5);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const [CW, CH] = meta.size;
  const [OX, OY] = meta.origin;
  const X0 = -OX + 4, X1 = CW - OX - 4, Y0 = -OY + 4, Y1 = CH - OY - 4;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, C[7], C[6], C[5], C[4]],
    haze: C[5],
  });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  // Longer lush fuzzy moss trail stamped along floor behind rolling ball (`-72 -> -10`)
  const mossTrail = Array.from({ length: 76 }, (_, i) => ({
    x: lerp(X_IDLE - 4, X_ATK + 2, i / 75),
    h: R.int(1, 4),
    floret: i % 10 === 3,
  }));

  const sleepBubbles = [
    { t0: 2.95, life: 1.12, dx: 6, vx: 5, rMax: 4.0 },
    { t0: 3.45, life: 1.05, dx: 10, vx: 7, rMax: 4.8 },
    { t0: 3.92, life: 0.92, dx: 7, vx: 4, rMax: 3.6 },
  ];

  // Rich Hypnotic Emerald Bokeh Light-Spots + Floating Dreamy Zs (`命中目标爆开翠绿光斑的催眠结果特效`) at X_HIT = +56!
  const hypnoSpots = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * TAU + R.range(-0.18, 0.18);
    const sp = R.range(16, 74);
    return {
      x0: X_HIT + R.range(-8, 8),
      y0: -R.range(8, 22),
      vx: Math.cos(a) * sp * 1.15,
      vy: Math.sin(a) * sp * 0.72 - 16,
      rMax: R.range(2.6, 6.6),
      t0: T_HIT + (i % 5) * 0.04,
      life: R.range(0.75, 1.42),
      phase: R.range(0, TAU),
    };
  });

  let t = 0;
  let sunMoteAcc = 0;
  let pantAcc = 0;
  let sporeAcc = 0;
  let dustKoAcc = 0;
  let hitDone = false;
  let wiltPetalsDone = false;
  let crackBitsDone = false;

  return {
    update(dt) {
      t += dt;
      const st = mossStateAt(t);

      // 1. Stage 2 Quirk: Golden motes shimmering inside sunbeam column
      if (st.sunK > 0.25) {
        sunMoteAcc += dt * 16 * st.sunK;
        while (sunMoteAcc >= 1) {
          sunMoteAcc -= 1;
          const mx = X_IDLE + R.range(-22, 22);
          const my = -R.range(4, 78);
          ps.spawn(P.MOTE, mx, my, R.range(-4, 6), R.range(-10, -2), R.range(0.45, 0.85), R.pick([Sun[4], Sun[3], WHITE]), R.range(0.7, 1.2));
        }
      }

      // 2. Stage 3 Move: Trailing moss spores during roll + cute tiny panting puffs at stop!
      if (t >= T_MOVE && t < T_ROLL_END) {
        if (R.chance(0.45)) {
          ps.spawn(P.MOTE, st.x - R.range(6, 14), -R.range(1, 5), -R.range(8, 24), -R.range(4, 16), R.range(0.28, 0.50), R.pick([C[5], C[6]]), 0.9);
        }
      }
      if (t >= T_ROLL_END && t < T_ATK) {
        pantAcc += dt * 14;
        while (pantAcc >= 1) {
          pantAcc -= 1;
          ps.spawn(P.MOTE, X_ATK + 13, -10, R.range(12, 24), -R.range(4, 14), 0.35, C[7], 0.9);
        }
      }

      // 3. Stage 4 Attack: Turbulent sleep spores + explosive emerald light-spot burst at X_HIT!
      if (t >= T_BREATH && t < T_BREATH + 1.15) {
        const kSp = 1 - seg(t, T_BREATH, T_BREATH + 1.15);
        sporeAcc += dt * 95 * kSp;
        while (sporeAcc >= 1) {
          sporeAcc -= 1;
          const sx = lerp(X_ATK + 6, X_HIT + 36, ease.outCubic(clamp((t - T_BREATH) / 0.58)));
          const sy = -R.range(4, 30);
          if (R.chance(0.55)) {
            ps.spawn(P.FLAKE, sx + R.range(-24, 12), sy, R.range(16, 48), R.range(-18, 12), R.range(0.42, 0.82), R.pick([C[7], C[6], C[5]]), R.range(0.8, 1.6));
          } else {
            ps.spawn(P.MOTE, sx + R.range(-20, 14), sy, R.range(10, 38), R.range(-24, 8), R.range(0.45, 0.88), R.pick([WHITE, C[7], C[6]]), R.range(0.9, 1.7));
          }
        }
      }

      if (!hitDone && t >= T_HIT) {
        hitDone = true;
        lights.add(X_HIT, -18, 52, C[5], 0.92, 0.68);
        lights.add(X_HIT, -14, 34, C[7], 0.88, 0.24);

        for (let i = 0; i < 44; i++) {
          const a = R.range(0, TAU);
          const sp = R.range(38, 142);
          ps.spawn(P.MOTE, X_HIT + R.range(-6, 6), -16 + R.range(-6, 6), Math.cos(a) * sp, Math.sin(a) * sp - 14, R.range(0.55, 1.15), R.pick([WHITE, C[7], C[6], C[5]]), R.range(1.0, 2.0));
        }
        for (let i = 0; i < 16; i++) {
          const a = -Math.PI * 0.5 + R.range(-1.25, 1.25);
          const sp = R.range(24, 76);
          ps.spawn(P.STAR, X_HIT + R.range(-14, 14), -R.range(8, 30), Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.45, 0.90), R.pick([WHITE, C[7], C[6]]), R.range(1.0, 2.2), R.range(0.05, 0.3));
        }
      }

      // 4. Stage 5 KO: Shedding withered petals -> fracturing dry clay clods -> powdery beige dust clouds!
      if (!wiltPetalsDone && t >= T_KO + 0.22) {
        wiltPetalsDone = true;
        for (let i = 0; i < 5; i++) {
          ps.spawn(P.FLAKE, X_ATK + R.range(-3, 5), -26, R.range(-14, 22), R.range(4, 18), R.range(0.55, 0.85), R.pick([Sun[2], Wither[3], Wither[4]]), 1.2);
        }
      }

      if (!crackBitsDone && t >= T_CRACK + 0.08) {
        crackBitsDone = true;
        for (let i = 0; i < 20; i++) {
          const s = R.sign();
          bits.add({
            kind: B.CHUNK,
            x: X_ATK + R.range(-10, 10),
            y: -R.range(4, 16),
            vx: s * R.range(14, 54),
            vy: -R.range(18, 66),
            g: 0.72,
            drag: 0.45,
            bounce: 0.15,
            life: R.range(0.65, 1.12),
            a: R.range(0, TAU),
            va: R.range(-10, 10),
            s: R.pick([1, 2, 2]),
            ramp: [Wither[0], Wither[1], Wither[2], Wither[3]],
          });
        }
      }

      if (t >= T_CRACK && t < T_END - 0.15) {
        const kD = Math.sin(clamp((t - T_CRACK) / (T_END - 0.15 - T_CRACK)) * Math.PI);
        dustKoAcc += dt * 76 * kD;
        while (dustKoAcc >= 1) {
          dustKoAcc -= 1;
          const sx = X_ATK + R.range(-20, 20);
          const sy = -R.range(2, 18 * (1 - st.crumbleU * 0.65));
          if (R.chance(0.55)) {
            ps.spawn(P.DUST, sx, sy, R.range(-16, 28), -R.range(8, 26), R.range(0.38, 0.72), R.pick([Wither[4], Wither[3], Wither[4]]), R.range(2.2, 3.6));
          } else {
            ps.spawn(P.GRIT, sx, sy, R.range(-24, 28), R.range(2, 22), R.range(0.34, 0.62), R.pick([Wither[4], Wither[3]]), 1);
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
      const st = mossStateAt(t);

      // Persistent lush moss trail left behind as it rolled (`X_IDLE -> X_ATK`)
      if (t >= T_MOVE) {
        const rollProgress = t < T_ROLL_END ? seg(t, T_MOVE, T_ROLL_END) : 1.0;
        const reachX = lerp(X_IDLE - 2, X_ATK + 2, rollProgress);
        const trailFade = 1 - smooth(T_CRACK + 0.15, T_END - 0.08, t);
        const trailDry = st.dryMix;
        for (const mt of mossTrail) {
          if (mt.x > reachX) break;
          const colBase = trailDry > 0.02 ? mix(C[2], Wither[1], trailDry) : C[2];
          const colLit = trailDry > 0.02 ? mix(C[4], Wither[3], trailDry) : C[4];
          const colTip = trailDry > 0.02 ? mix(C[5], Wither[4], trailDry) : C[5];
          p.blend(mt.x, 0, colBase, 0.90 * trailFade);
          p.blend(mt.x, 1, C[0], 0.72 * trailFade);
          for (let h = 1; h <= mt.h; h++) {
            p.blend(mt.x, -h, h === mt.h ? colTip : colLit, 0.92 * trailFade);
          }
          if (mt.floret && trailDry < 0.6) {
            p.blend(mt.x, -mt.h - 1, WHITE, 0.92 * trailFade * (1 - trailDry));
          }
        }
      }

      if (st.fade > 0.03 && st.crumbleU < 0.92) {
        const shRx = Math.max(10, st.rx * 1.10);
        shadow(p, st.x, 1, shRx, 2.5, C[0], 0.50 * st.fade * (1 - st.crumbleU));
        if (st.dryMix < 0.8) {
          p.glow(st.x, -10, Math.min(24, shRx * 1.2), C[4], 0.24 * (1 - st.dryMix) * st.fade);
        }
      }

      drawGoldenSunbeam(p, Sun, st, t, X0, X1, OY);

      // Clean silky smooth luminous emerald hypnosis pool on floor at X_HIT (pure p.blend radial gradient, ZERO Bayer dithering!)
      if (t >= T_HIT && t < T_KO) {
        const q = t - T_HIT;
        const ku = q / 0.85;
        if (ku < 1) {
          const rx = 10 + 48 * ease.outCubic(ku);
          const ry = Math.max(2, rx * 0.18);
          const a = (1 - ku) * 0.55;
          const minX = Math.max(X0 + 4, Math.floor(X_HIT - rx));
          const maxX = Math.min(X1 - 4, Math.ceil(X_HIT + rx));
          const minY = Math.floor(-ry);
          const maxY = Math.ceil(ry + 1);
          for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
              const ell = Math.hypot((px - X_HIT) / rx, (py - 0.5) / ry);
              if (ell < 1.0) {
                const k = (1 - ell * ell) * a * 0.65;
                p.blend(px, py, ell < 0.45 ? C[5] : C[4], k);
              }
            }
          }
          p.glow(X_HIT, -4, rx * 0.9, C[5], 0.38 * (1 - ku));
        }
      }

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.02) return;
      const st = mossStateAt(t);

      // 1. Plush Moss-Ball Body (`Grid` fuzzy sphere, white rice-grain florets, sunbathe carpet, grass needles, or dried mud cracks!)
      drawMossBallBody(BODY_GRID, p, C, Sun, Wither, st, t, o.seed);

      // 2. Stage 2 Quirk: Translucent Emerald Sleep Bubbles rising softly during sunbeam nap!
      for (const sb of sleepBubbles) {
        const age = t - sb.t0;
        if (age < 0 || age >= sb.life) continue;
        const u = age / sb.life;
        const bx = X_IDLE + sb.dx + Math.sin(age * 4.5) * 2.5 + age * sb.vx;
        const by = -8 - 28 * ease.outQuad(u);
        const r = sb.rMax * smooth(0, 0.18, u);
        if (u > 0.86) {
          const pk = (u - 0.86) / 0.14;
          for (let j = 0; j < 6; j++) {
            const a = (j / 6) * TAU;
            p.blend(bx + Math.cos(a) * (r + 4 * pk), by + Math.sin(a) * (r + 4 * pk), C[6], 1 - pk);
          }
          continue;
        }
        p.disc(bx, by, r, C[4], 0.32);
        // Smooth silky SDF bubble rim via p.blend (0 Bayer dithering!)
        const ri0 = Math.floor(bx - r - 1), ri1 = Math.ceil(bx + r + 1);
        const rj0 = Math.floor(by - r - 1), rj1 = Math.ceil(by + r + 1);
        for (let py = rj0; py <= rj1; py++) {
          for (let px = ri0; px <= ri1; px++) {
            const dr = Math.abs(Math.hypot(px - bx, py - by) - r);
            if (dr < 0.85) p.blend(px, py, C[6], (1 - dr) * 0.92);
          }
        }
        p.blend(bx - r * 0.42, by - r * 0.42, WHITE, 0.92);
        p.glow(bx, by, r * 2.1, C[5], 0.26);
      }

      // 3. Stage 4 Attack: Sharp Tapered Emerald Grass-Needles + Dense Rolling Sleep-Spore Fluid Cloud!
      drawBristlingGrassNeedles(p, C, st, o.seed);
      drawRollingSleepSporeCloud(p, C, t, o.seed, X0, X1, Y0);

      // 4. Stage 4 Hit Result: Hypnotic Emerald Light-Spots + Floating Dreamy Zs Bursting at Target (`命中目标爆开翠绿光斑`)!
      if (t >= T_HIT && t < T_KO) {
        const q = t - T_HIT;
        if (q < 0.32) {
          const fk = 1 - q / 0.32;
          flare(p, X_HIT, -16, 30 * fk, fk * 0.88, [C[4], C[5], C[7], WHITE]);
        }

        // Crisp continuous uniform-thickness SDF concentric emerald hypnosis rings on the floor!
        for (const tOff of [0, 0.18]) {
          const rq = (q - tOff) / 0.72;
          if (rq <= 0 || rq >= 1) continue;
          const rr = 8 + 46 * ease.outCubic(rq);
          const ry = Math.max(2, rr * 0.20);
          const a = (1 - rq) * 0.92;
          const col = rq < 0.3 ? WHITE : C[6];
          const minX = Math.max(X0 + 4, Math.floor(X_HIT - rr - 2));
          const maxX = Math.min(X1 - 4, Math.ceil(X_HIT + rr + 2));
          const minY = Math.floor(-ry - 2);
          const maxY = Math.ceil(ry + 2);
          for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
              const nx = (px - X_HIT) / rr;
              const ny = (py - 0.5) / ry;
              const ell = Math.hypot(nx, ny);
              if (ell <= 0.01) continue;
              const grad = Math.hypot(nx / rr, ny / ry) / ell;
              const dPx = Math.abs(ell - 1.0) / Math.max(1e-4, grad);
              if (dPx < 1.05) {
                p.blend(px, py, col, a * clamp(1 - dPx * 0.75));
              }
            }
          }
        }

        // Dazzling bursting emerald bokeh light-spots ("爆开翠绿光斑") floating and pulsing hypnotically!
        for (const hs of hypnoSpots) {
          const hAge = t - hs.t0;
          if (hAge < 0 || hAge >= hs.life) continue;
          const hu = hAge / hs.life;
          const sx = clamp(hs.x0 + hs.vx * (1 - Math.exp(-3.2 * hAge)) * 0.45, X0 + 8, X1 - 8);
          const sy = clamp(hs.y0 + hs.vy * (1 - Math.exp(-2.8 * hAge)) * 0.45 - 8 * hu, Y0 + 8, -2);
          const pulse = 0.78 + 0.22 * Math.sin(hAge * 14 + hs.phase);
          const rr = hs.rMax * Math.sin(Math.min(1, hu * 1.2) * Math.PI * 0.85) * pulse;
          if (rr < 0.8) continue;
          const a = (1 - smooth(0.55, 1.0, hu)) * 0.94;
          p.disc(sx, sy, rr, C[4], a * 0.46);
          const si0 = Math.floor(sx - rr - 1), si1 = Math.ceil(sx + rr + 1);
          const sj0 = Math.floor(sy - rr - 1), sj1 = Math.ceil(sy + rr + 1);
          for (let py = sj0; py <= sj1; py++) {
            for (let px = si0; px <= si1; px++) {
              const dr = Math.abs(Math.hypot(px - sx, py - sy) - rr);
              if (dr < 0.85) p.blend(px, py, C[6], (1 - dr) * a * 0.94);
            }
          }
          p.disc(sx - rr * 0.28, sy - rr * 0.28, rr * 0.38, C[7], a);
          p.glow(sx, sy, rr * 2.4, C[5], 0.40 * a);
        }

        // Two subtle floating sleepy emerald `Z` motes drifting up out of the hypnotic burst!
        for (const [zT0, zx0] of [[0.14, -10], [0.36, 12]]) {
          const zu = (q - zT0) / 0.85;
          if (zu > 0 && zu < 1) {
            const zFade = Math.sin(Math.min(1, zu * 4) * (Math.PI * 0.5)) * (1 - smooth(0.65, 1.0, zu));
            icon(p, X_HIT + zx0 + Math.sin(zu * 6) * 2.5, -18 - zu * 24, 5, SLEEP_Z, [C[0], C[4], C[6], WHITE], zFade);
          }
        }
      }

      // 5. Dried crumbling clay bits in Stage 5 KO
      for (const b of bits.list) {
        const bFade = clamp(b.life / 0.35) * st.fade;
        p.disc(b.x, b.y, b.s * 0.85, Wither[2], bFade);
        p.blend(Math.round(b.x), Math.round(b.y), Wither[4], bFade);
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
