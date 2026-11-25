// Translucent deep-sea ink-shadow fish spine & tail wag build on ./fish-school.js and ./ink-soot.js;
// glowing cyan lantern orb, electric thunder orb & branching zigzag arcs build on ../lightning/ball-lightning.js,
// ../lightning/plasma-ball.js, and ../lightning/_lib.js; deep-sea bubbles and splash droplets/ripples build on
// ../water/bubbles.js, ../water/splash.js, and ../water/_lib.js (adapted from Sprite Fusion's open-source
// pixel-art VFX, MIT License, Copyright (c) 2026 Hugo Duprez).
import {
  Particles,
  Lights,
  P,
  Rng,
  fit,
  flare,
  clamp,
  smooth,
  seg,
  ease,
  lerp,
  TAU,
  WHITE,
} from "../../core/index.js";
import { Grid, shadow, lnoise } from "./_lib.js";
import { zigzag, stroke } from "../lightning/_lib.js";
import { Drops, Ripples, Mist } from "../water/_lib.js";

export const meta = {
  name: "Abyssal angler fry",
  desc: "A translucent shadow angler fry swings a huge cyan lantern, chases it in circles getting zapped, swims leaving deep-sea bubbles, flings a thunder orb, and melts into ink.",
  tags: ["critter", "monster", "fish", "angler", "lantern", "shadow", "lightning", "water", "one-shot"],
  size: [336, 180],
  origin: [130, 142],
  duration: 12.0,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    // 8-step Translucent Abyssal Shadow-Ink & Deep-Sea Teal Rim ramp
    palette: ["#04060e", "#0b1226", "#16284d", "#22467a", "#306aa6", "#50a2d4", "#94e4ff", "#ffffff"],
    // 6-step Glowing Cyan Lantern Lure ramp
    lantern: ["#093446", "#0e6b85", "#17b0c8", "#3cf0f5", "#a4fffd", "#ffffff"],
    // 8-step Deep-Sea Sapphire-Cyan Splash Water ramp (required 8 stops for water/_lib `Drops` & `Ripples`!)
    splash: ["#091e3a", "#11366a", "#1b589e", "#2882c8", "#42b4ec", "#7ce2ff", "#c4f5ff", "#ffffff"],
    // 4-step High-Voltage Deep-Sea Thunder Orb & Arc ramp
    lightning: ["#145596", "#2eb2ff", "#94f6ff", "#ffffff"],
    seed: 17,
  },
};

// 5-Stage Choreography + Post-Attack Idle Buffer (12.00s, 360 frames):
// 0.00..2.05  【待机 Idle】               Translucent shadow fry floats gently; oversized cyan lantern swings broadly overhead
// 2.05..4.55  【生态小动作 Quirk】        Spots lure like a kitten -> spins chasing it in wide loops -> bites it -> ZAP & wild pain head-shake!
// 4.55..6.85  【移动 Move】               Cyan lantern lights path ahead; silky undulating tail-wag swim trailing glowing deep-sea bubbles
// 6.85..8.82  【攻击 Attack】             Wicked smirk wind-up -> flings lantern with comet ribbon trail -> turns into crackling thunder orb -> explodes into deep-sea splash!
// 8.82..9.88  【攻击后待机缓冲 IdleBuf】  Calm hover with newly sprouted cyan lantern while explosion ripples settle
// 9.88..12.00 【倒地 KO】                 Shadow body bleeds & disperses like sumi ink -> cyan lantern drops *plop*, rolls twice, flickers & goes out!
const T_QUIRK = 2.05;
const T_BITE = 3.48;
const T_MOVE = 4.55;
const T_ATK = 6.85;
const T_FLING = 7.24;
const T_ORB_FORM = 7.60;
const T_BOOM = 7.90;
const T_REGROW = 8.10;
const T_POST_IDLE = 8.84;
const T_KO = 9.88;
const T_LANTERN_DROP = 9.95;
const T_LANTERN_LAND = 10.28;
const T_END = meta.duration;

const X_IDLE = -86;
const X_ATK = -22;
const X_HIT = 98;
const Y_HOVER = -28;
const R_LANTERN = 9.2; // Unmistakably larger than the fry's compact dark-indigo body!

function poseAt(t) {
  let x = X_IDLE;
  let y = Y_HOVER;
  let facing = 1;
  let yawCos = 1;
  let tailSpeed = 8.5;
  let tailAmp = 2.0;
  let headTilt = 0;
  let eyeMode = "smirk"; // "smirk" | "excited" | "pain" | "wicked" | "shock"
  let jawOpen = 0.25;
  let baitX = X_IDLE + 16;
  let baitY = Y_HOVER - 20;
  let baitShow = true;
  let baitScale = 1.0;
  let bodyDissolve = 0;

  if (t < T_QUIRK) {
    // Stage 1: 【待机】 Hovering calmly while the huge cyan lantern swings in wide lazy pendulum arcs
    const u = t / T_QUIRK;
    const sw = Math.sin(u * TAU * 2.5);
    y = Y_HOVER + Math.sin(u * TAU * 3.0) * 2.4;
    tailSpeed = 8.0;
    tailAmp = 2.0;
    headTilt = Math.sin(u * TAU * 3.0 - 0.5) * 0.09;
    baitX = x + 15 + sw * 7.2;
    baitY = y - 21 + (1 - sw * sw) * -1.8;
    eyeMode = "smirk";
    jawOpen = 0.28 + 0.14 * Math.sin(u * TAU * 3.0);
  } else if (t < T_BITE) {
    // Stage 2A: 【生态小动作 - 原地转圈追咬诱饵】 Orbits opposite the teasing lure so both read cleanly!
    const u = seg(t, T_QUIRK, T_BITE);
    const spin = u * TAU * 3.1; // ~3 wide teasing circles
    const ramp = smooth(0, 1, Math.min(1, u * 4.5));
    // Fry orbits radius 14x7; lantern stays teasingly ahead along the loop (`+1.6 rad`) so they stay clearly separated!
    x = X_IDLE + Math.cos(spin) * 14 * ramp;
    y = Y_HOVER - 2 + Math.sin(spin) * 7.5 * ramp;
    const vx = -Math.sin(spin);
    yawCos = clamp(vx * 1.1, -1, 1);
    facing = vx >= 0 ? 1 : -1;
    tailSpeed = 26.0;
    tailAmp = 3.4;
    headTilt = Math.sin(spin * 2) * 0.36;

    const baitAng = spin + 1.65;
    baitX = X_IDLE + Math.cos(baitAng) * 20 * ramp + 4 * (1 - ramp);
    baitY = Y_HOVER - 16 + Math.sin(baitAng) * 10 * ramp;
    eyeMode = "excited";
    jawOpen = 0.45 + 0.52 * Math.max(0, Math.sin(u * TAU * 9.0));
  } else if (t < T_MOVE) {
    // Stage 2B: 【生态小动作 - 咬到灯笼痛得直甩头】 Clamps bait -> electric shock -> vigorous long comic head-shake!
    const age = t - T_BITE; // 0..1.07s
    if (age < 0.22) {
      x = X_IDLE + 6 * (1 - age / 0.22);
      y = Y_HOVER - 4;
      baitX = x + 11;
      baitY = y - 2;
      jawOpen = 0.04;
      eyeMode = "pain";
    } else {
      const k = clamp(1 - (age - 0.22) / 0.88);
      const thrash = Math.sin((age - 0.22) * TAU * 8.5) * Math.pow(k, 0.72);
      const nod = Math.cos((age - 0.22) * TAU * 6.5) * Math.pow(k, 0.72);
      x = X_IDLE + thrash * 8.5;
      y = Y_HOVER + nod * 5.5;
      headTilt = thrash * 1.15; // Wild comic left-right/up-down head thrash!
      tailSpeed = 14 + 22 * k;
      tailAmp = 2.4 + 2.5 * k;
      baitX = x + 15 + thrash * 13;
      baitY = lerp(y - 4, y - 21, ease.outCubic(clamp((age - 0.22) / 0.70))) + nod * 6;
      eyeMode = age < 0.96 ? "pain" : "smirk";
      jawOpen = age < 0.85 ? 0.75 : 0.26;
    }
  } else if (t < T_ATK) {
    // Stage 3: 【移动】 Smooth forward swim (`-86 -> -22`) with glowing lantern projecting light out front!
    const u = seg(t, T_MOVE, T_ATK);
    x = lerp(X_IDLE, X_ATK, ease.inOutSine(u));
    y = Y_HOVER - 2 - Math.sin(u * TAU * 1.5) * 7.5;
    headTilt = -Math.cos(u * TAU * 1.5) * 0.26;
    tailSpeed = 19.0;
    tailAmp = 3.4;
    // Extended forward to illuminate the swimming corridor!
    baitX = x + 23 + Math.sin(u * TAU * 3) * 1.6;
    baitY = y - 12 + Math.sin(u * TAU * 3 + 1.2) * 1.8;
    eyeMode = "smirk";
    jawOpen = 0.20;
  } else if (t < T_POST_IDLE) {
    // Stage 4: 【攻击】 Wicked smirk draw-back -> lantern fling -> sprout & regrow small lantern back!
    x = X_ATK;
    if (t < T_FLING) {
      const u = seg(t, T_ATK, T_FLING);
      const cock = ease.inOutCubic(u);
      x = X_ATK - 8 * cock;
      y = Y_HOVER - 3 * Math.sin(u * Math.PI);
      headTilt = -0.42 * cock;
      baitX = x + lerp(22, -16, cock);
      baitY = y + lerp(-12, -25, Math.sin(cock * Math.PI * 0.7));
      eyeMode = "wicked";
      jawOpen = 0.55 * cock;
      tailSpeed = 15;
      tailAmp = 2.8;
    } else if (t < T_REGROW) {
      const u = seg(t, T_FLING, T_REGROW);
      x = X_ATK + 5 * Math.exp(-u * 5.5);
      y = Y_HOVER + Math.exp(-u * 4.5) * Math.sin(u * Math.PI * 2) * 3.5;
      headTilt = 0.42 * Math.exp(-u * 4);
      baitShow = false;
      eyeMode = "wicked";
      jawOpen = 0.72 * Math.exp(-u * 2.5);
    } else {
      // Fresh small cyan lantern regrows smoothly back overhead (`8.10..8.84s`)!
      const u = seg(t, T_REGROW, T_POST_IDLE);
      y = Y_HOVER + Math.sin(u * TAU) * 2.0;
      baitShow = true;
      baitScale = ease.outBack(u, 1.45);
      baitX = x + lerp(10, 16, u);
      baitY = y + lerp(-11, -20, u);
      eyeMode = u > 0.72 ? "smirk" : "wicked";
      jawOpen = lerp(0.45, 0.25, u);
    }
  } else if (t < T_KO) {
    // Stage 4.5: 【攻击后待机缓冲】 Calm hover & sway before KO
    const u = seg(t, T_POST_IDLE, T_KO);
    const sw = Math.sin(u * TAU * 1.5);
    x = X_ATK;
    y = Y_HOVER + Math.sin(u * TAU * 2.0) * 2.2;
    headTilt = Math.sin(u * TAU * 2.0 - 0.5) * 0.08;
    baitX = x + 16 + sw * 5.5;
    baitY = y - 20 + (1 - sw * sw) * -1.4;
    eyeMode = "smirk";
    jawOpen = 0.25;
  } else {
    // Stage 5: 【倒地 KO】 Shadow body swells & bleeds apart like sumi ink in mid-air; lantern snaps off & drops!
    const koAge = t - T_KO;
    x = X_ATK;
    y = Y_HOVER + Math.sin(koAge * 16) * 1.8 * Math.max(0, 1 - koAge * 2.5);
    eyeMode = "shock";
    jawOpen = 0.88;
    tailSpeed = 5 * Math.max(0, 1 - koAge * 2.5);
    bodyDissolve = clamp((koAge - 0.06) / 0.78);
    baitShow = t < T_LANTERN_DROP;
    baitX = x + 16;
    baitY = y - 20;
  }

  return {
    x,
    y,
    facing,
    yawCos,
    tailSpeed,
    tailAmp,
    headTilt,
    eyeMode,
    jawOpen,
    baitX,
    baitY,
    baitShow,
    baitScale,
    bodyDissolve,
  };
}

function attackLanternAt(t) {
  if (t < T_FLING || t > T_BOOM + 0.04) return null;
  if (t < T_ORB_FORM) {
    const u = seg(t, T_FLING, T_ORB_FORM);
    const eu = ease.outCubic(u);
    const x = lerp(X_ATK - 16, X_HIT, eu);
    const y = lerp(Y_HOVER - 25, Y_HOVER - 3, u) - 26 * Math.sin(u * Math.PI);
    return { x, y, phase: "fling", u };
  }
  const u = seg(t, T_ORB_FORM, T_BOOM);
  return { x: X_HIT, y: Y_HOVER - 3, phase: "orb", u };
}

function koLanternAt(t) {
  if (t < T_LANTERN_DROP || t >= T_END - 0.03) return null;
  const x0 = X_ATK + 16;
  const y0 = Y_HOVER - 20;
  const xLand = X_ATK + 24;
  if (t < T_LANTERN_LAND) {
    // Drops onto ground with *plop* ("啪嗒一声掉在地上")
    const u = seg(t, T_LANTERN_DROP, T_LANTERN_LAND);
    const x = lerp(x0, xLand, u);
    const y = lerp(y0, -R_LANTERN, u * u);
    return { x, y, roll: u * 0.7, light: 1.0, fade: 1.0, phase: "fall" };
  }
  const age = t - T_LANTERN_LAND; // 10.28..12.00s (1.72s)
  const bounceY = age < 0.16 ? -Math.sin((age / 0.16) * Math.PI) * 3.8 : 0;
  const rollU = ease.outCubic(clamp(age / 0.94));
  const x = xLand + 32 * rollU;
  const y = -R_LANTERN + bounceY;
  const roll = 0.7 + rollU * TAU * 2.0; // Two visible rotations ("滚了两圈")!

  // True crisp ON / OFF sputtering flicker ("闪烁熄灭") from 11.15..11.88s, dead cleanly before 12.00s!
  let light = 1.0;
  let phase = "roll";
  if (age > 0.87) {
    phase = "flicker";
    const fu = (age - 0.87) / 0.73; // ~11.15..11.88s
    const cycle = Math.sin(fu * Math.PI * 5.0);
    if (fu >= 0.96) {
      light = 0;
    } else if (cycle < -0.1 + fu * 0.35) {
      light = 0.02;
    } else {
      light = (1 - fu * 0.32);
    }
  }
  const fade = age > 1.54 ? clamp(1 - (age - 1.54) / 0.15) : 1.0;
  return { x, y, roll, light, fade, phase };
}

function drawCyanLantern(p, cx, cy, r, C, L, t, { roll = 0, glow = 1.0, fade = 1.0 } = {}) {
  if (fade <= 0.02 || r < 1) return;
  const ir = Math.ceil(r + 2);

  p.shade(cx - ir, cy - ir, cx + ir, cy + ir, (px, py) => {
    const dx = (px - cx) / r;
    const dy = (py - cy) / r;
    const d = Math.hypot(dx, dy);
    if (d > 1.06) return;

    const rotX = dx * Math.cos(roll) - dy * Math.sin(roll);
    const rotY = dx * Math.sin(roll) + dy * Math.cos(roll);

    if (d > 0.84) {
      // Rotating dark/bright cap notch on the rim (`rotY < -0.82`) lets you literally SEE the orb roll twice!
      const isCapRim = rotY < -0.78 && Math.abs(rotX) < 0.48;
      const rimCol = isCapRim ? C[2] : dx + dy < -0.35 ? L[4] : dx + dy > 0.55 ? L[0] : L[2];
      p.blend(px, py, rimCol, 0.94 * fade);
      return;
    }

    const pulse = 0.5 + 0.5 * Math.sin(t * 9.0 + rotY * 2.5);
    if (glow > 0.08) {
      const innerD = Math.hypot(rotX - 0.14, rotY + 0.10);
      if (innerD < 0.34 * Math.min(1, glow + 0.25)) {
        p.blend(px, py, glow > 0.45 ? WHITE : L[4], glow * fade * 0.98);
      } else if (d < 0.64) {
        p.blend(px, py, pulse > 0.42 ? L[3] : L[2], (0.55 + 0.35 * glow) * fade);
      } else {
        p.blend(px, py, L[1], 0.58 * fade);
      }
    } else {
      // Extinguished dark glass orb between sputters / after going out
      p.blend(px, py, L[0], 0.72 * fade);
    }
  });

  // Rotating cap bracket + specular highlight arc rotating with the orb when rolling!
  const capAngle = roll - Math.PI * 0.5;
  const capX = cx + Math.cos(capAngle) * (r * 0.92);
  const capY = cy + Math.sin(capAngle) * (r * 0.92);
  p.disc(capX, capY, 1.5, C[3], fade);

  // Rotating glass glint & filament spark
  p.blend(cx - r * 0.42, cy - r * 0.46, glow > 0.08 ? WHITE : L[2], 0.90 * fade);
  if (r >= 4 && glow > 0.08) {
    const fx = cx + Math.cos(roll) * (r * 0.38);
    const fy = cy + Math.sin(roll) * (r * 0.38);
    p.blend(fx, fy, WHITE, glow * fade);
    p.blend(fx + 0.5, fy, L[4], glow * fade * 0.85);
  }

  if (glow > 0.08) {
    p.glow(cx, cy, r * 3.2, L[3], 0.58 * glow * fade);
    p.glow(cx, cy, r * 1.45, L[4], 0.45 * glow * fade);
  }
}

function drawShadowFry(g, p, pz, C, L, EL, t) {
  g.clear();
  if (pz.bodyDissolve >= 0.98) return;

  const S = clamp(Math.abs(pz.yawCos) * 0.62 + 0.38, 0.44, 1.0);
  const fDir = pz.facing;
  const len = 18.5 * S;
  const ht = 12.5;
  const phase = t * pz.tailSpeed;

  const bend = (u) => pz.tailAmp * Math.pow(u, 1.7) * Math.sin(phase - 4.4 * u);
  const halfH = (u) => {
    if (u < 0.28) return ht * 0.5 * Math.sqrt(Math.max(0, u / 0.28));
    return ht * 0.5 * (1 - Math.pow((u - 0.28) / 0.72, 1.45) * 0.78);
  };

  const xSpan = Math.ceil(len + 18);
  const ySpan = Math.ceil(ht + 18);
  const diss = pz.bodyDissolve;

  // Soft ghostly deep-indigo aura wrapping the translucent fry (`幽暗黑影质感`)
  if (diss < 0.5) {
    p.glow(pz.x - 2 * fDir, pz.y, 17, C[3], 0.30 * (1 - diss * 2));
  }

  g.shade(-xSpan, -ySpan, xSpan, ySpan, (x, y, out) => {
    const bx = 6.5 * fDir - x * fDir;
    const u = bx / len;
    if (u < 0 || u > 1) return 0;

    const bleed = diss > 0 ? lnoise(t * 2.5, 3, 4, x * 0.22 + y * 0.22, 11) * diss * 7.0 + diss * 5.5 : 0;
    const h = halfH(u) + bleed;
    const dy = y - bend(u) - pz.headTilt * (0.5 - u) * 9.5;
    if (Math.abs(dy) > h) return 0;

    const rimFrac = Math.abs(dy) / Math.max(1, h);
    if (diss > 0.14 && rimFrac > 1.15 - diss * 0.92) {
      const wisp = lnoise(t * 2.5, 2.5, 3, x * 0.35, y * 0.35 + t);
      if (wisp < diss * 0.55 - 0.15) return 0;
    }

    out.t = 1;
    out.a = (0.86 - 0.24 * rimFrac * rimFrac) * (1 - diss * 0.90);
    return C[0];
  });

  if (diss < 0.7) {
    const tb = bend(1) - pz.headTilt * (-0.5) * 9.5;
    const ta = Math.atan(pz.tailAmp * 1.7 * Math.cos(phase - 4.4)) * 0.78;
    const tailLen = 9.0;
    const tailBaseX = (6.5 - len) * fDir;
    const hb = halfH(1);
    const rotTail = (dx, dy) => [
      tailBaseX - (dx * Math.cos(ta) - dy * Math.sin(ta)) * fDir,
      tb + dx * Math.sin(ta) + dy * Math.cos(ta),
    ];
    g.poly(
      [
        rotTail(-0.5, -hb),
        rotTail(tailLen, -hb - 4.8),
        rotTail(tailLen * 0.55, 0),
        rotTail(tailLen, hb + 4.8),
        rotTail(-0.5, hb),
      ],
      (x, y) => (y < tb ? C[3] : C[2]),
      0.76 * (1 - diss)
    );
  }

  if (diss < 0.6) {
    const d0 = 0.36, d1 = 0.68;
    const xD0 = (6.5 - d0 * len) * fDir, yD0 = bend(d0) - halfH(d0) + 0.5;
    const xD1 = (6.5 - d1 * len) * fDir, yD1 = bend(d1) - halfH(d1) + 0.5;
    g.poly([[xD0, yD0], [(6.5 - (d0 + 0.13) * len) * fDir, yD0 - 5.0], [xD1, yD1]], C[3], 0.78 * (1 - diss));
    const pFlap = Math.sin(phase * 0.7) * 2.0;
    const pxF = (6.5 - 0.35 * len) * fDir;
    const pyF = bend(0.35) + 2.2;
    g.line(pxF, pyF, pxF - 4.2 * fDir, pyF + 2.6 + pFlap, C[4], 0.85 * (1 - diss));
    g.line(pxF, pyF + 1, pxF - 3.6 * fDir, pyF + 3.6 + pFlap, C[3], 0.82 * (1 - diss));
  }

  g.depths(4);

  g.recolor((x, y, col, al, tag) => {
    if (tag !== 1) return col;
    const d = g.depth(x, y);
    const idx = g.idx(x, y);
    const aScale = 1 - diss * 0.90;
    if (d === 1) {
      const isLitFace = (x * fDir > 0 && y < 2) || y < -3;
      g.a[idx] = 0.88 * aScale;
      return isLitFace && pz.baitShow ? L[3] : C[4];
    }
    if (d === 2) {
      g.a[idx] = 0.82 * aScale;
      return y < 0 ? C[3] : C[2];
    }
    g.a[idx] = 0.72 * aScale;
    return (x + y) % 5 === 0 ? C[1] : C[0];
  });

  if (diss < 0.45) {
    const ex = Math.round(2.5 * fDir);
    const ey = Math.round(bend(0.2) - 2.2 - pz.headTilt * 3.5);
    if (pz.eyeMode === "pain" || pz.eyeMode === "shock") {
      // Comic squeezed `>` / `X` eye in bright electric cyan-white!
      g.set(ex - fDir, ey - 1, EL[2], 1);
      g.set(ex, ey, WHITE, 1);
      g.set(ex - fDir, ey + 1, EL[2], 1);
      g.set(ex + fDir, ey - 1, L[4], 1);
      g.set(ex + fDir, ey + 1, L[4], 1);
    } else {
      for (let dy = -2; dy <= 1; dy++) {
        for (let dx = -1; dx <= 2; dx++) {
          if (dx === -1 && dy === -2) continue;
          g.set(ex + dx * fDir, ey + dy, L[4], 1);
        }
      }
      if (pz.eyeMode === "wicked") {
        g.set(ex - fDir, ey - 2, C[0], 1);
        g.set(ex, ey - 1, C[0], 1);
        g.set(ex + fDir, ey, WHITE, 1);
      } else if (pz.eyeMode === "excited") {
        g.set(ex, ey - 1, WHITE, 1);
        g.set(ex + fDir, ey, L[5], 1);
        g.set(ex + fDir, ey - 1, WHITE, 1);
      } else {
        g.set(ex + fDir, ey, C[0], 1);
        g.set(ex, ey - 1, WHITE, 1);
      }
    }

    const my = ey + 4;
    const mx = Math.round(4.5 * fDir);
    const mh = Math.round(1 + pz.jawOpen * 2.2);
    for (let dx = 0; dx <= 3; dx++) {
      g.set(mx - dx * fDir, my + (dx === 0 ? -1 : 0), C[0], 0.98);
      if (pz.jawOpen > 0.25) g.set(mx - dx * fDir, my + mh, C[0], 0.96);
    }
    g.set(mx, my + 1, WHITE, 1);
    g.set(mx - 2 * fDir, my + mh - 1, L[5], 1);
  }

  g.draw(p, 1, Math.round(pz.x), Math.round(pz.y));

  const headX = pz.x + 3.5 * fDir;
  const headY = pz.y - 4.5 - pz.headTilt * 3.5;

  if (pz.baitShow) {
    const ctrlX = lerp(headX, pz.baitX, 0.35) - 3 * fDir;
    const ctrlY = Math.min(headY, pz.baitY) - 9;
    for (let i = 0; i < 14; i++) {
      const s0 = i / 14, s1 = (i + 1) / 14;
      const p0x = (1 - s0) * (1 - s0) * headX + 2 * (1 - s0) * s0 * ctrlX + s0 * s0 * pz.baitX;
      const p0y = (1 - s0) * (1 - s0) * headY + 2 * (1 - s0) * s0 * ctrlY + s0 * s0 * pz.baitY;
      const p1x = (1 - s1) * (1 - s1) * headX + 2 * (1 - s1) * s1 * ctrlX + s1 * s1 * pz.baitX;
      const p1y = (1 - s1) * (1 - s1) * headY + 2 * (1 - s1) * s1 * ctrlY + s1 * s1 * pz.baitY;
      p.line(p0x, p0y, p1x, p1y, s0 > 0.65 ? L[4] : C[4], 1 - diss);
    }
    drawCyanLantern(p, pz.baitX, pz.baitY, R_LANTERN * pz.baitScale, C, L, t, {
      roll: Math.sin(t * 2.5) * 0.28,
      glow: 1.0,
      fade: 1 - diss * 0.2,
    });
  } else if (t >= T_FLING && t < T_REGROW) {
    p.line(headX, headY, headX + 4 * fDir, headY - 7, C[4], 0.9);
    p.px(Math.round(headX + 4 * fDir), Math.round(headY - 7), L[4]);
  }
}

export function create(o) {
  const C = fit(o.palette, 8);
  const L = fit(o.lantern, 6);
  const W = fit(o.splash, 8);
  const EL = fit(o.lightning, 4);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const [CW, CH] = meta.size;
  const [OX, OY] = meta.origin;
  const X0 = -OX + 4, X1 = CW - OX - 4, Y0 = -OY + 4, Y1 = CH - OY - 4;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, EL[2], L[4], L[3]],
    haze: L[1],
  });
  const lights = new Lights();
  const fryGrid = new Grid(-34, -26, 68, 52);

  // Water physics using rich Deep-Sea Splash ramp `W` (`幽蓝水花命中结果特效` — never flat chalky white!)
  const rings = new Ripples({ sy: 0.24 });
  const mist = new Mist();
  const plinks = [];
  const drops = new Drops({
    sy: 0.24,
    g: 680,
    onLand: (d) => {
      rings.add(d.x, d.z, 0.8, 3 + d.s * 2.5, 0.44 + d.s * 0.14, { n: 1, k: 0.95, hot: 0.04 });
      plinks.push({ x: d.x, y: d.z * 0.24, s: d.s, age: 0 });
      if (d.s > 1 && !d.small) {
        for (let k = 0; k < 2; k++) {
          const a = R.range(0, TAU), v = R.range(14, 38);
          drops.add({ x: d.x, z: d.z, h: 0.5, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vh: R.range(60, 120), s: 1, small: true, life: 0.9 });
        }
      }
    },
  });

  const bubbles = [];
  const inkBlobs = [];
  const koSmoke = [];

  let t = 0;
  let swimBubAcc = 0;
  let painSparkAcc = 0;
  let biteZapDone = false;
  let flingTrailAcc = 0;
  let boomDone = false;
  let inkSpawnDone = false;
  let clunkLandDone = false;
  let snufferPuffDone = false;

  const flingHistory = [];

  return {
    update(dt) {
      t += dt;
      const pz = poseAt(t);

      // 1. Stage 2: Electric ZAP when accidentally biting its own cyan lantern (`3.48s`) + shaken sparks during wild head-shake (`3.54..4.36s`)
      if (!biteZapDone && t >= T_BITE) {
        biteZapDone = true;
        lights.add(X_IDLE + 10, Y_HOVER - 2, 38, EL[2], 0.96, 0.28);
        for (let i = 0; i < 18; i++) {
          const a = R.range(0, TAU);
          const spk = R.range(42, 115);
          ps.spawn(P.SPARK, X_IDLE + 10, Y_HOVER - 2, Math.cos(a) * spk, Math.sin(a) * spk, R.range(0.20, 0.42));
        }
      }
      if (t >= T_BITE + 0.15 && t < T_MOVE - 0.15) {
        painSparkAcc += dt * 16;
        while (painSparkAcc >= 1) {
          painSparkAcc -= 1;
          const a = R.range(-Math.PI * 0.9, -0.2);
          const spk = R.range(24, 58);
          ps.spawn(P.STAR, pz.x + R.range(-6, 6), pz.y - 6, Math.cos(a) * spk, Math.sin(a) * spk, R.range(0.18, 0.34), R.pick([EL[2], L[4], WHITE]), R.range(0.6, 1.2));
        }
      }

      // 2. Stage 3: Smooth swimming generates a lush deep-sea cyan bubble wake (`幽蓝色的深海气泡尾迹`)
      if (t >= T_MOVE && t < T_ATK) {
        swimBubAcc += dt * 36;
        while (swimBubAcc >= 1) {
          swimBubAcc -= 1;
          bubbles.push({
            x: pz.x - R.range(6, 17),
            y: pz.y + R.range(-6, 6),
            vx: -R.range(12, 30),
            vy: -R.range(16, 38),
            r: R.range(1.1, 3.2),
            life: R.range(0.60, 1.15),
            age: 0,
            ph: R.range(0, TAU),
          });
        }
      }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.age += dt;
        b.x += (b.vx + Math.sin(b.age * 7 + b.ph) * 9) * dt;
        b.y += b.vy * dt;
        if (b.age >= b.life || b.x < X0 + 4 || b.y < Y0 + 4) bubbles.splice(i, 1);
      }

      // 3. Stage 4: Blazing fling ribbon trail (`灯笼甩出的流光轨迹`) & Deep-Sea Thunder Orb Detonation!
      const al = attackLanternAt(t);
      if (al && al.phase === "fling") {
        flingHistory.push({ x: al.x, y: al.y, t });
        if (flingHistory.length > 26) flingHistory.shift();
        flingTrailAcc += dt * 78;
        while (flingTrailAcc >= 1) {
          flingTrailAcc -= 1;
          ps.spawn(P.STAR, al.x + R.range(-3, 3), al.y + R.range(-3, 3), R.range(-22, 12), R.range(-18, 18), R.range(0.24, 0.45), R.pick([WHITE, L[4], L[3], EL[2]]), R.range(0.8, 1.6));
        }
      } else if (t > T_ORB_FORM + 0.14 && flingHistory.length) {
        flingHistory.shift();
      }

      if (!boomDone && t >= T_BOOM) {
        boomDone = true;
        lights.add(X_HIT, Y_HOVER - 3, 86, EL[2], 1.0, 0.48);
        lights.add(X_HIT, Y_HOVER - 3, 38, WHITE, 0.96, 0.16);
        lights.add(X_HIT, -2, 62, W[3], 0.85, 0.62);

        rings.add(X_HIT, 0, 8, 60, 1.45, { n: 2, gap: 4.0, k: 1.3, hot: 0.08, glint: 1 });
        rings.add(X_HIT, 0, 5, 42, 1.25, { n: 2, gap: 3.0, k: 1.0, hot: 0.04, delay: 0.12 });

        for (let i = 0; i < 38; i++) {
          const a = R.range(0, TAU);
          const spk = R.range(72, 235);
          ps.spawn(P.SPARK, X_HIT, Y_HOVER - 3, Math.cos(a) * spk, Math.sin(a) * spk - 14, R.range(0.25, 0.55));
        }
        for (let i = 0; i < 18; i++) {
          const a = R.range(0, TAU);
          const spk = R.range(38, 138);
          ps.spawn(P.STAR, X_HIT, Y_HOVER - 3, Math.cos(a) * spk, Math.sin(a) * spk - 10, R.range(0.32, 0.72), R.pick([WHITE, L[4], EL[2], W[3]]), R.range(0.8, 2.0));
        }
        // Rich deep-sea sapphire-cyan water droplets (`幽蓝水花命中结果特效`) raining down with floor crowns & ripples!
        for (let i = 0; i < 36; i++) {
          const a = R.range(0, TAU);
          const spd = R.range(26, 122);
          drops.add({
            x: X_HIT + Math.cos(a) * 6,
            z: Math.sin(a) * 14,
            h: 28 + R.range(-8, 12),
            vx: Math.cos(a) * spd,
            vz: Math.sin(a) * spd * 0.8,
            vh: R.range(90, 215),
            s: R.chance(0.38) ? 3 : R.chance(0.5) ? 2 : 1,
            life: 1.35,
          });
        }
        for (let i = 0; i < 12; i++) {
          const side = i % 2 ? 1 : -1;
          mist.add(X_HIT + side * R.range(4, 18), -R.range(2, 18), side * R.range(28, 68), -R.range(8, 22), 3.5, R.range(8.5, 13), R.range(0.90, 1.40), i % 2 ? W[3] : W[2], 0.42);
        }
      }

      // 4. Stage 5: KO Ink-Wash Dispersion (`黑影身体像墨汁一样在空中晕染散开`) + Fallen Lantern *Plop* & Final Wisp!
      if (!inkSpawnDone && t >= T_KO + 0.06) {
        inkSpawnDone = true;
        for (let i = 0; i < 28; i++) {
          const a = R.range(0, TAU);
          const spd = R.range(10, 42);
          const maxLife = Math.min(R.range(0.85, 1.38), T_END - 0.14 - t);
          inkBlobs.push({
            x: X_ATK + R.range(-10, 10),
            y: Y_HOVER + R.range(-8, 8),
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd - R.range(4, 15),
            r0: R.range(2.5, 5.2),
            r1: R.range(6.0, 12.5),
            life: maxLife,
            age: 0,
            core: C[0],
            rim: i % 2 === 0 ? C[3] : C[2], // Visible deep sumi-indigo bleeding ink rim so it reads richly against dark BG!
          });
        }
      }
      for (let i = inkBlobs.length - 1; i >= 0; i--) {
        const ib = inkBlobs[i];
        ib.age += dt;
        ib.x += ib.vx * dt;
        ib.y += ib.vy * dt;
        ib.vx *= 1 - 1.9 * dt;
        ib.vy *= 1 - 1.9 * dt;
        if (ib.age >= ib.life) inkBlobs.splice(i, 1);
      }

      if (!clunkLandDone && t >= T_LANTERN_LAND) {
        clunkLandDone = true;
        lights.add(X_ATK + 24, -4, 24, L[3], 0.58, 0.25);
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + R.range(-1.35, 1.35);
          const spk = R.range(24, 64);
          ps.spawn(P.SPARK, X_ATK + 24, -2, Math.cos(a) * spk, Math.sin(a) * spk, R.range(0.18, 0.34));
        }
      }

      if (!snufferPuffDone && t >= T_LANTERN_LAND + 1.48) {
        snufferPuffDone = true;
        const klEnd = koLanternAt(t);
        const kx = klEnd ? klEnd.x : X_ATK + 56;
        for (let i = 0; i < 5; i++) {
          koSmoke.push({
            x: kx + R.range(-3, 3),
            y: -R.range(10, 14),
            vx: R.range(-6, 6),
            vy: -R.range(14, 24),
            r: R.range(2.2, 4.0),
            age: 0,
            life: Math.min(0.45, T_END - 0.04 - t),
          });
        }
      }
      for (let i = koSmoke.length - 1; i >= 0; i--) {
        const sk = koSmoke[i];
        sk.age += dt;
        sk.x += (sk.vx + Math.sin(sk.age * 10) * 5) * dt;
        sk.y += sk.vy * dt;
        if (sk.age >= sk.life) koSmoke.splice(i, 1);
      }

      for (let i = plinks.length - 1; i >= 0; i--) if ((plinks[i].age += dt) > 0.14) plinks.splice(i, 1);

      drops.update(dt);
      rings.update(dt);
      mist.update(dt);
      ps.update(dt);
      cullParticles(ps, X0, Y0, X1, Y1);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.03) return;
      const pz = poseAt(t);

      // Abyssal shadow underneath + soft cyan lantern ground illumination
      if (pz.bodyDissolve < 0.92) {
        shadow(p, pz.x, 0.5, 19 * (1 - pz.bodyDissolve), 2.5, C[0], 0.54 * (1 - pz.bodyDissolve));
        if (pz.baitShow) {
          p.glow(lerp(pz.x, pz.baitX, 0.7), 0, 32, L[2], 0.32 * (1 - pz.bodyDissolve));
        }
      }

      // Stage 3 Move: Extended forward lantern headlamp beam illuminating the swimming path ahead!
      if (t >= T_MOVE && t < T_ATK) {
        const uFade = smooth(0, 1, Math.min(1, (t - T_MOVE) * 3)) * smooth(0, 1, Math.min(1, (T_ATK - t) * 4));
        p.glow(pz.baitX + 22, pz.baitY + 6, 36, L[3], 0.24 * uFade);
        p.glow(pz.baitX + 38, 0, 34, L[2], 0.20 * uFade);
      }

      // Swimming deep-sea cyan bubble ribbon glow trailing behind fry (`幽蓝尾迹`)
      if (t >= T_MOVE && t < T_ATK + 0.35) {
        const uFade = t < T_ATK ? 1 : clamp(1 - (t - T_ATK) / 0.35);
        for (let k = 0; k < 12; k++) {
          const wx = pz.x - 10 - k * 5.0;
          const wy = pz.y + Math.sin(t * 14 - k * 0.58) * 2.8;
          if (wx < X0 + 6) continue;
          p.disc(wx, wy, 3.4 * (1 - k / 13), W[2], 0.38 * (1 - k / 12) * uFade);
          p.glow(wx, wy, 8, L[3], 0.18 * (1 - k / 12) * uFade);
        }
      }

      // Back half of deep-sea sapphire splash ripples & droplets
      rings.draw(p, W, -1);
      drops.draw(p, W, "back");

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.03) return;
      const pz = poseAt(t);

      // 1. Stage 2A: Circular kitten-chasing motion ribbons around orbit
      if (t >= T_QUIRK && t < T_BITE) {
        const spin = t * 14;
        for (let s = 0; s < 2; s++) {
          const a0 = spin + s * Math.PI;
          for (let k = 0; k < 12; k++) {
            const ak = a0 - k * 0.14;
            const ax = X_IDLE + Math.cos(ak) * 19;
            const ay = Y_HOVER - 4 + Math.sin(ak) * 10;
            p.blend(ax, ay, k < 3 ? WHITE : L[4], (1 - k / 12) * 0.78);
          }
        }
      }

      // 2. Stage 2B: Electric bite-shock flash + wild pain head-shake motion arcs (`痛得直甩头`!)
      if (t >= T_BITE && t < T_BITE + 0.36) {
        const u = (t - T_BITE) / 0.36;
        const rBolt = new Rng(o.seed + Math.floor(t * 30) * 7);
        stroke(p, zigzag(rBolt, pz.x + 2, pz.y - 10, pz.x + 18, pz.y + 4, 0.45, 0.35), 1 - u, EL, 0.85);
        flare(p, pz.x + 10, pz.y - 2, 20 * (1 - u), 1 - u, [EL[1], L[3], L[4], WHITE]);
      }
      if (t >= T_BITE + 0.22 && t < T_MOVE - 0.14) {
        // Double comic vibration blur lines flanking head so the head-shake pops on still frames too!
        const k = clamp(1 - (t - (T_BITE + 0.22)) / 0.80);
        for (const side of [-1, 1]) {
          for (let i = 0; i < 6; i++) {
            const ang = (i / 5 - 0.5) * 1.1;
            const ax = pz.x + side * (14 + Math.cos(ang) * 3);
            const ay = pz.y - 5 + Math.sin(ang) * 7;
            p.blend(ax, ay, L[4], 0.75 * k);
          }
        }
      }

      // 3. Stage 5: Rich Ink-Wash Dispersion (`黑影身体像墨汁一样在空中晕染散开`)
      for (const ib of inkBlobs) {
        const u = ib.age / ib.life;
        const r = lerp(ib.r0, ib.r1, ease.outCubic(u));
        const a = Math.min(1, u * 6) * Math.pow(1 - u, 1.15);
        if (a <= 0.03) continue;
        // Wet bleeding indigo rim halo + deep black ink heart (reads crisply against dark background!)
        p.disc(ib.x, ib.y, r * 1.08, ib.rim, a * 0.48);
        p.disc(ib.x, ib.y, r * 0.82, ib.core, a * 0.84);
      }

      // 4. Translucent shadow angler fry + giant cyan lantern
      drawShadowFry(fryGrid, p, pz, C, L, EL, t);

      // 5. Shaded deep-sea swimming cyan bubbles (`幽蓝色的深海气泡尾迹`)
      for (const b of bubbles) {
        const u = b.age / b.life;
        const fade = Math.min(1, u * 5) * (1 - u * u);
        if (b.r < 1.4) {
          p.blend(b.x, b.y, u < 0.3 ? WHITE : L[4], fade);
        } else {
          p.disc(b.x, b.y, b.r, W[2], 0.38 * fade);
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * TAU;
            p.blend(b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r, a > Math.PI ? L[4] : W[1], 0.90 * fade);
          }
          p.blend(b.x - b.r * 0.38, b.y - b.r * 0.38, WHITE, 0.95 * fade);
        }
        p.glow(b.x, b.y, b.r * 2.5, L[3], 0.26 * fade);
      }

      // 6. Stage 4: Blazing Lantern Fling Comet Ribbon (`灯笼甩出的流光轨迹`) & Crackling Deep-Sea Thunder Orb!
      for (let i = 1; i < flingHistory.length; i++) {
        const prev = flingHistory[i - 1];
        const cur = flingHistory[i];
        const ageF = t - cur.t;
        if (ageF > 0.38) continue;
        const u = i / flingHistory.length;
        const fade = clamp(1 - ageF / 0.38) * u;
        p.line(prev.x, prev.y, cur.x, cur.y, u > 0.65 ? WHITE : L[4], fade);
        p.line(prev.x, prev.y + 1.5, cur.x, cur.y + 1.5, L[3], fade * 0.88);
        p.line(prev.x, prev.y - 1.5, cur.x, cur.y - 1.5, EL[2], fade * 0.82);
        p.line(prev.x, prev.y + 3, cur.x, cur.y + 3, W[2], fade * 0.55);
        p.glow(cur.x, cur.y, 14, L[3], 0.32 * fade);
      }

      const al = attackLanternAt(t);
      if (al) {
        if (al.phase === "fling") {
          drawCyanLantern(p, al.x, al.y, R_LANTERN * 1.05, C, L, t, { roll: t * 20, glow: 1.2 });
        } else {
          // Swells into blinding high-voltage Deep-Sea Thunder Orb (`刺眼的深海雷球`)!
          const orbR = lerp(R_LANTERN, 16.0, ease.outBack(al.u, 1.35));
          p.disc(al.x, al.y, orbR + 3, EL[0], 0.65);
          p.disc(al.x, al.y, orbR, EL[1], 0.92);
          p.disc(al.x, al.y, orbR * 0.72, L[4], 0.96);
          p.disc(al.x, al.y, orbR * 0.42, WHITE, 1.0);
          const rBolt = new Rng(o.seed + Math.floor(t * 30) * 19);
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * TAU + t * 9 + rBolt.range(-0.3, 0.3);
            const lenB = orbR + rBolt.range(7, 17);
            stroke(p, zigzag(rBolt, al.x, al.y, al.x + Math.cos(ang) * lenB, al.y + Math.sin(ang) * lenB, 0.35, 0.35), 0.95, EL, 0.82);
          }
          flare(p, al.x, al.y, orbR * 2.4, 1.0, [EL[0], EL[1], L[4], WHITE]);
          p.glow(al.x, al.y, orbR * 3.5, EL[2], 0.88);
        }
      }

      // 7. Stage 4 Thunder Detonation + Rich Deep-Sea Sapphire Water Splash Impact (`深海雷球爆炸时的幽蓝水花命中结果特效`)!
      if (t >= T_BOOM && t < T_BOOM + 0.64) {
        const bu = (t - T_BOOM) / 0.64;
        if (bu < 0.46) {
          const k = 1 - bu / 0.46;
          const rBolt = new Rng(o.seed + Math.floor(t * 30) * 31);
          for (let i = 0; i < 5; i++) {
            const gx = X_HIT + lerp(-36, 36, i / 4) + rBolt.range(-6, 6);
            stroke(p, zigzag(rBolt, X_HIT, Y_HOVER - 3, gx, 0, 0.32, 0.38), k, EL, 0.86);
          }
          flare(p, X_HIT, Y_HOVER - 3, 46 * k, k, [EL[0], EL[1], L[4], WHITE]);
          p.disc(X_HIT, Y_HOVER - 3, 22 * k, EL[2], 0.62 * k);
        }
        // Rich deep-sea sapphire & aqua geyser splash plumes (`幽蓝水花飞溅`)
        const splFade = Math.sin(Math.min(1, bu * 1.35) * Math.PI);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU + 0.15;
          const rIn = 8 + 28 * ease.outCubic(bu);
          const rOut = rIn + 16 * splFade;
          const x0 = X_HIT + Math.cos(a) * rIn;
          const y0 = Y_HOVER * 0.42 + Math.sin(a) * rIn * 0.42;
          const x1 = X_HIT + Math.cos(a) * rOut;
          const y1 = Y_HOVER * 0.42 + Math.sin(a) * rOut * 0.42 - 18 * splFade;
          p.line(x0, y0, x1, y1, (s) => (s > 0.78 ? W[6] : s > 0.4 ? W[4] : W[2]), splFade);
        }
      }

      rings.draw(p, W, 1);
      drops.draw(p, W, "front");
      for (const q of plinks) {
        const k = q.age / 0.14;
        if (k < 0.5) p.px(Math.round(q.x), Math.round(q.y), W[6]);
        if (q.s > 1) p.line(q.x, q.y - 1, q.x, q.y - 1 - 4.0 * (1 - k), k < 0.4 ? W[6] : W[4]);
        p.glow(q.x, q.y, 4.5, W[4], 0.36 * (1 - k));
      }
      mist.draw(p, W[3]);

      // 8. Stage 5 KO Dropped Lantern: drops *plop*, rolls twice, flickers & exhales final smoke wisp before vanishing!
      const kl = koLanternAt(t);
      if (kl) {
        shadow(p, kl.x, 0.5, R_LANTERN * 1.15 * kl.fade, 2.0, C[0], 0.52 * kl.fade);
        drawCyanLantern(p, kl.x, kl.y, R_LANTERN, C, L, t, {
          roll: kl.roll,
          glow: kl.light,
          fade: kl.fade,
        });
      }
      for (const sk of koSmoke) {
        const u = sk.age / sk.life;
        const a = Math.sin(u * Math.PI) * 0.45;
        p.disc(sk.x, sk.y, sk.r * (1 + u * 0.5), L[1], a);
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
