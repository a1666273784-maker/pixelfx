// Ground-hugging surging miasma wave loop ("nature/miasma-wave"):
// The seamless post-launch traveling loop of the ground-hugging miasma surge when no enemy is hit yet.
// A thick, boiling bank of interwoven murky dark-yellow (ochre-sulfur) and deep ink-green mist hugs the floor
// (y = 0) and rolls relentlessly rightward: billowing vortex clouds tumble over the surging brow, soft curling
// gas tongues sweep along the stone, irregular mist billows break apart into the wake, and tiny vivid-green
// bubbles swell and pop into radial droplets and ripples all along the wave's floor-skimming belly.
// Translucent gas puffs, smoke billows, and bubble physics build on Sprite Fusion's open-source poison and
// explosion VFX (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.

import { fit, rng, clamp, smooth, lerp, ease, TAU, WHITE } from "../../core/index.js";
import { gasPuff } from "./_lib.js";
import { beat, wake } from "../projectiles/_lib.js";
import { pool } from "../explosions/_lib.js";

export const meta = {
  name: "Miasma wave",
  desc: "Ground-hugging miasma surging right in a loop: murky dark-yellow and ink-green mist rolls forward in curling tongues while tiny green bubbles pop along its foot.",
  tags: ["nature", "poison", "miasma", "surge", "wave", "projectile", "gas", "smoke", "toxic", "ground", "bubbles", "directional", "loop"],
  size: [236, 92],
  origin: [168, 74],
  duration: 1.2,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // Smoky Deep Ink-Green ramp ("墨绿色")
    palette: ["#030907", "#071812", "#0e2b20", "#164332", "#226048", "#358264", "#5aa886", "#9adcb9"],
    // Turbid Murky Dark-Yellow / Ochre-Sulfur ramp ("浑浊的暗黄色")
    ochre: ["#141005", "#2c2209", "#503f11", "#7d631a", "#a98725", "#cfad3b", "#ebd26e"],
    // Vivid Green Bubbles & Pop-Droplet ramp ("雾气底部细小的绿色气泡破裂粒子")
    venom: ["#04150a", "#0b361a", "#16612f", "#30ad40", "#70e64e", "#dcff9c"],
    speed: 144,
    seed: 19,
  },
};

const D = meta.duration;
// Safe local bounds inside [236, 92] with origin [168, 74] -> x in [-168..67], y in [-74..17]
const X_MIN = -162, X_MAX = 61, Y_MIN = -68;

// 4 Distinctly rotated organic mist LUT variants (radii 2..19) for soft, non-uniform gaseous billows
const MIST_LUTS = Array.from({ length: 4 }, (_, vIdx) => {
  const rotOff = vIdx * 1.17;
  return Array.from({ length: 20 }, (__, r) => {
    if (r < 2) return [];
    const pts = [];
    for (let dy = -r - 3; dy <= r + 3; dy++) {
      for (let dx = -r - 3; dx <= r + 3; dx++) {
        const a = Math.atan2(dy, dx) + rotOff;
        const sc = 0.85 + 0.14 * Math.sin(a * 3 + r * 0.67) + 0.10 * Math.cos(a * 5 - r * 0.49);
        const q = Math.hypot(dx, dy) / (r * sc);
        if (q > 1) continue;
        pts.push(dx, dy, q);
      }
    }
    return pts;
  });
});

function drawMistPuff(p, cx, cy, r, vIdx, belly, body, cap, hi, alpha, rimDirX = 0.36) {
  if (alpha <= 0.02 || r < 1.8) return;
  const ri = clamp(Math.round(r), 2, 19);
  const pts = MIST_LUTS[vIdx & 3][ri];
  if (!pts.length) return;
  const rx = Math.round(cx), ry = Math.round(cy);
  for (let i = 0; i < pts.length; i += 3) {
    const dx = pts[i], dy = pts[i + 1], q = pts[i + 2];
    const px = rx + dx, py = ry + dy;
    if (px < X_MIN + 2 || px > X_MAX - 2 || py < Y_MIN + 2 || py > 1) continue;
    const lightDot = (dx * rimDirX - dy * 0.78) / Math.max(1, ri);
    let col;
    if (dy > ri * 0.26 && q < 0.82) col = belly;
    else if (lightDot > 0.44 && q > 0.42) col = hi || cap;
    else if (lightDot > 0.10) col = cap;
    else col = body;
    const edgeFade = q > 0.62 ? (1 - q) / 0.38 : 1;
    p.blend(px, py, col, alpha * edgeFade * (q < 0.42 ? 0.88 : 0.70));
  }
}

// Glossy pixel-art tiny green bubble with 1px dark-ink border, bright toxic-lime rim, and white specular dot
function drawBottomBubble(p, x, y, r, Vn, C, alpha, domeOnly = false) {
  if (alpha <= 0.04 || r < 0.8 || x < X_MIN + 6 || x > X_MAX - 6 || y < Y_MIN + 6) return;
  const X = Math.round(x), Y = Math.round(y), R = Math.ceil(r) + 1;
  const jMax = domeOnly ? 0 : R;

  for (let j = -R - 1; j <= jMax + (domeOnly ? 0 : 1); j++) {
    for (let i = -R - 1; i <= R + 1; i++) {
      const d = Math.hypot(i, j);
      if (d > r + 0.38 && d <= r + 1.38) {
        p.blend(X + i, Math.min(1, Y + j), C[0], alpha * 0.92);
      }
    }
  }

  for (let j = -R; j <= jMax; j++) {
    for (let i = -R; i <= R; i++) {
      const d = Math.hypot(i, j);
      if (d > r + 0.38) continue;
      const py = Math.min(1, Y + j);
      if (d > r - 0.72) {
        const litRim = i <= 0 && j <= -r * 0.10;
        p.dot(X + i, py, litRim ? Vn[4] : Vn[2], alpha);
      } else {
        const innerGlow = d < r * 0.46 && j > 0 ? Vn[4] : Vn[3];
        p.blend(X + i, py, innerGlow, alpha * 0.54);
      }
    }
  }

  if (r >= 1.35) {
    p.dot(X - Math.max(1, Math.round(r * 0.35)), Y - Math.max(1, Math.round(r * 0.38)), WHITE, alpha);
  }
}

// Crisp bubble pop burst: expanding broken green pop-ring + flying radial green droplets + floor ripple
function drawBottomBubblePop(p, x, y, rBase, u, seed, Vn, C, alpha) {
  if (alpha <= 0.04 || u < 0 || u >= 1 || x < X_MIN + 8 || x > X_MAX - 8) return;
  const fade = (1 - smooth(0.42, 1, u)) * alpha;
  const rr = rBase * 0.65 + 5.8 * ease.outQuart(u);

  if (y >= -4) {
    const rx = rr * 1.25;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + seed * 0.5;
      p.blend(x + Math.cos(a) * rx, Math.sin(a) * rx * 0.22, Vn[4], fade * 0.56);
    }
  }

  for (let i = 0; i < 8; i++) {
    if (((i + seed) & 1) && u > 0.52) continue;
    const a = (i / 8) * TAU + seed * 0.7;
    const px = x + Math.cos(a) * rr;
    const py = Math.min(1, y + Math.sin(a) * rr * 0.50);
    p.dot(px, py, u < 0.36 ? Vn[5] : Vn[4], fade);
  }

  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * 0.5 + ((i / 4) - 0.5) * 2.4 + Math.sin(seed * 3.1 + i) * 0.2;
    const sp = 23 * (0.76 + 0.34 * (((i * 7 + seed) % 3) / 2));
    const age = u * 0.16;
    const dx = x + Math.cos(a) * sp * age * 2.2;
    const dy = Math.min(0, y + Math.sin(a) * sp * age * 2.2 + 112 * age * age);
    p.dot(dx, Math.min(0, dy + 1), C[0], fade * 0.85);
    p.dot(dx, dy, i % 2 === 0 ? Vn[5] : Vn[4], fade);
  }
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8);
  const Oc = fit(o.ochre, 7);
  const Vn = fit(o.venom, 6);
  const S = o.seed;
  const V = o.speed;
  const ph = t / D, w = TAU * ph;

  // 1. Perspective corrosive floor slick streaming backward under the surging wave
  for (let x = -126; x <= 22; x++) {
    const env = smooth(-126, -76, x) * (1 - smooth(8, 23, x));
    if (env <= 0.02) continue;
    const sw = Math.sin(x * 0.14 + 4 * w) * 0.6 + Math.cos(x * 0.08 + 2 * w) * 0.4;
    p.blend(x, 0, sw > 0.18 ? Oc[3] : C[2], 0.76 * env);
    p.blend(x, 1, sw > 0.02 ? Oc[2] : C[1], 0.56 * env);
  }
  pool(p, -26 + 3 * Math.sin(2 * w), 1, 54, 5.5, Vn[2], 0.20);

  // 2. Far-layer rolling miasma billows with organic crest/trough variation (exact integer cycle 2*ph -> zero seam!)
  for (let i = 0; i < 24; i++) {
    const R = rng(S + 17, i);
    const u = (i / 24 + R.range(-0.015, 0.015) + 2 * ph + 1) % 1;
    const env = u < 0.24
      ? Math.sin((u / 0.24) * Math.PI * 0.5)
      : Math.pow(1 - (u - 0.24) / 0.76, 0.85);
    const rollA = i * 2.399 + 3 * w;
    const cx = lerp(21, -124, u) + Math.sin(rollA) * (5.2 * env + 1.2) + R.range(-4, 4) * u;
    // Lowered so billows sit snugly against y = 0 with NO gap above the floor!
    const cy = -(3.5 + 20 * env) + Math.cos(rollA) * (4.8 * env + 0.8) + R.range(-5.5, 4.0) * (0.35 + 0.65 * u);
    const r = lerp(15.2, 6.0, Math.pow(u, 0.70)) * (0.55 + 0.55 * env) * R.range(0.78, 1.24);
    const fade = smooth(0, 0.08, u) * (1 - smooth(0.78, 1, u));
    if (fade <= 0.02 || r < 2.0) continue;

    if (i % 2 === 0) {
      drawMistPuff(p, cx, Math.min(-1, cy), r, i & 3, C[0], C[2], C[3], C[5], 0.66 * fade, 0.36);
    } else {
      drawMistPuff(p, cx, Math.min(-1, cy), r, i & 3, Oc[1], Oc[2], Oc[4], Oc[5], 0.60 * fade, 0.36);
    }
  }

  // 3. Detached trailing wake puffs drifting & lifting irregularly off the tail (`beat` + `wake`)
  beat(t, D, 24, S + 101, (r) => r.range(0.56, 0.96), (age, life, r, idx) => {
    const k = age / life;
    const [wx, wy] = wake(r.range(-16, 12), -r.range(3, 21), r.range(8, 42), -r.range(2, 22), age, V * 0.86, 3.2, 0);
    const rad = r.range(5.8, 11.4) * (0.72 + 0.52 * Math.sin(Math.PI * Math.min(1, k * 1.15)));
    if (wx - rad < X_MIN + 4) return;
    const edge = smooth(X_MIN + 6, X_MIN + 42, wx - rad);
    const a = Math.min(1, age * 14) * Math.pow(1 - k, 1.35) * 0.56 * edge;
    const cy = Math.min(-1, wy - age * r.range(2, 14) + Math.sin(age * 8 + idx) * 2.0);
    if (idx % 2 === 0) {
      drawMistPuff(p, wx, cy, rad, idx & 3, C[0], C[1], C[3], C[4], a, 0.36);
    } else {
      drawMistPuff(p, wx, cy, rad, idx & 3, Oc[1], Oc[2], Oc[3], Oc[4], a, 0.36);
    }
  });
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8);
  const Oc = fit(o.ochre, 7);
  const Vn = fit(o.venom, 6);
  const S = o.seed;
  const V = o.speed;
  const ph = t / D, w = TAU * ph;

  // Forward-driving surge heave on the leading head (exact integer harmonic 2*w -> zero seam!)
  const headBobX = 2.4 * Math.sin(2 * w);
  const headBobY = 1.2 * Math.cos(2 * w);

  // 1. Floor-hugging lower mist skirt (`y = -1..-9`) so the miasma hugs the stone seamlessly from nose to tail!
  for (let i = 0; i < 18; i++) {
    const R = rng(S + 53, i);
    const u = (i / 18 + 2 * ph) % 1;
    const cx = lerp(22 + headBobX * 0.8, -112, u) + R.range(-3, 3);
    const r = lerp(9.5, 4.8, u) * R.range(0.85, 1.18);
    const fade = smooth(0, 0.08, u) * (1 - smooth(0.76, 1, u));
    if (fade <= 0.02) continue;
    const isOc = i % 3 === 1;
    drawMistPuff(p, cx, -Math.round(r * 0.38), r, (i + 1) & 3, C[0], isOc ? Oc[2] : C[1], isOc ? Oc[3] : C[3], isOc ? Oc[4] : C[4], 0.68 * fade, 0.35);
  }

  // 2. Near-layer rolling miasma billows: lush interwoven Deep Ink-Green (`C`) and Murky Dark-Yellow (`Oc`)
  //    with irregular crests & billows so the upper silhouette churns naturally instead of forming a straight slope!
  for (let i = 0; i < 28; i++) {
    const R = rng(S + 89, i);
    const u = (i / 28 + R.range(-0.015, 0.015) + 2 * ph + 1) % 1;
    const env = u < 0.26
      ? Math.sin((u / 0.26) * Math.PI * 0.5)
      : Math.pow(1 - (u - 0.26) / 0.74, 0.82);
    const rollA = i * 1.91 + 3 * w;
    const cx = lerp(22 + headBobX, -118, u) + Math.cos(rollA) * (6.2 * env + 1.2) + R.range(-4, 4) * u;
    const cy = -(4.0 + 21 * env) + headBobY * env + Math.sin(rollA) * (5.4 * env + 1.0) + R.range(-6.0, 4.2) * (0.3 + 0.7 * u);
    const r = lerp(16.0, 5.8, Math.pow(u, 0.72)) * (0.52 + 0.60 * env) * R.range(0.76, 1.26);
    const fade = smooth(0, 0.07, u) * (1 - smooth(0.80, 1, u));
    if (fade <= 0.02 || r < 2.0) continue;

    const isInkGreen = i % 5 !== 1 && i % 5 !== 3;
    if (isInkGreen) {
      drawMistPuff(p, cx, Math.min(-1, cy), r, i & 3, C[0], C[2], C[4], C[5], 0.70 * fade, 0.38);
    } else {
      drawMistPuff(p, cx, Math.min(-1, cy), r, i & 3, Oc[1], Oc[3], Oc[4], Oc[5], 0.62 * fade, 0.38);
    }
  }

  // 3. Soft `gasPuff` currents & wake mist clouds streaming backward (`beat` + `wake`)
  beat(t, D, 26, S + 205, (r) => r.range(0.46, 0.88), (age, life, r, idx) => {
    const k = age / life;
    const [wx, wy] = wake(r.range(-8, 17) + headBobX * 0.5, -r.range(3, 23), r.range(14, 52), -r.range(2, 18), age, V * 0.88, 3.4, 0);
    const rad = r.range(6.2, 11.8) * (0.76 + 0.48 * Math.sin(Math.PI * Math.min(1, k * 1.2)));
    if (wx - rad < X_MIN + 4) return;
    const edge = smooth(X_MIN + 6, X_MIN + 42, wx - rad);
    const a = Math.min(1, age * 15) * Math.pow(1 - k, 1.32) * 0.54 * edge;
    const cy = Math.min(-2, wy - age * r.range(2, 12) + Math.cos(age * 9 + idx) * 1.8);
    const isOc = idx % 2 === 1;
    gasPuff(
      p,
      wx,
      Math.min(-2, cy),
      rad,
      a,
      isOc ? Oc[2] : C[1],
      isOc ? Oc[3] : C[2],
      isOc ? Oc[5] : C[4],
      isOc ? Oc[6] : C[5]
    );
  });

  // 4. Soft Rolling Gaseous Surf-Tongues sweeping forward at the wave nose & folding under into the floor
  for (let i = 0; i < 4; i++) {
    const q = (2 * ph + i * 0.25) % 1;
    const vis = Math.sin(Math.PI * q);
    if (vis <= 0.08) continue;
    const isOc = i % 2 === 0;
    const baseX = lerp(-4, 21, ease.outQuad(q)) + headBobX * 0.7;
    const baseY = lerp(-23, -6, q) + (i % 2) * 3.5;
    const rCurl = (6.8 - 2.2 * q) * (0.75 + 0.25 * vis);
    const spin = -q * 4.2 - 0.6;
    for (let a = 0; a < 3.8; a += 0.14) {
      const rr = rCurl * (1 - a * 0.14);
      const px = baseX + Math.cos(spin + a) * rr;
      const py = Math.min(-1, baseY + Math.sin(spin + a) * rr * 0.82);
      const wid = 2.4 * (1 - a / 4.3);
      const colHi = isOc ? Oc[4] : C[5];
      const colMid = isOc ? Oc[3] : C[3];
      for (let o2 = -wid; o2 <= wid; o2 += 0.9) {
        p.blend(
          px + Math.cos(spin + a) * o2,
          Math.min(0, py + Math.sin(spin + a) * o2),
          o2 > wid * 0.25 ? colHi : colMid,
          0.44 * vis * (1 - a / 4.3)
        );
      }
    }
  }

  // 5. Wispy Torn Miasma Ribbons peeling diagonally backward off the crest
  beat(t, D, 6, S + 309, (r) => r.range(0.52, 0.84), (age, life, r, idx) => {
    const u = age / life;
    const x0 = r.range(-24, 8) - V * 0.66 * age;
    if (x0 < X_MIN + 18) return;
    const edge = smooth(X_MIN + 18, X_MIN + 46, x0);
    const fade = smooth(0, 0.18, u) * (1 - smooth(0.50, 1, u)) * edge;
    if (fade <= 0.02) return;
    const h0 = 15 + age * r.range(13, 20);
    const len = r.range(14, 22);
    const isOc = idx % 2 === 0;
    for (let s = 0; s <= 1; s += 0.07) {
      const h = h0 + s * len;
      if (-h < Y_MIN + 4) break;
      const wx = x0 - s * 13 + 2.8 * Math.sin(s * 5.0 - age * 8 + idx);
      const wid = 1.9 * Math.sin(Math.PI * s);
      for (let o2 = -wid; o2 <= wid; o2 += 0.9) {
        p.blend(wx + o2, -h, isOc ? Oc[4] : C[4], fade * 0.32 * Math.sin(Math.PI * s));
      }
    }
  });

  // 6. Bottom Tiny Green Bubble-Popping Particles ("雾气底部伴随细小的绿色气泡破裂粒子")
  //    Distributed directly inside the floor-hugging mist belly (`x = -102 .. +22`)!
  beat(t, D, 54, S + 407, (r) => r.range(0.18, 0.34), (age, life, r, idx) => {
    const swellDur = life * 0.44;
    const popDur = life - swellDur;
    const x0 = idx % 3 === 0 ? r.range(-78, -28) : r.range(-38, 21);
    const y0 = -r.range(0.5, 4.4);
    const rMax = idx % 3 === 0 ? r.range(1.4, 2.3) : r.range(1.7, 2.9);

    const activeAge = Math.min(age, swellDur);
    const bx = x0 - V * 0.62 * age + r.range(-6, 10) * activeAge;
    const by = Math.max(-10, y0 - r.range(8, 20) * activeAge);
    if (bx < -118 || bx > X_MAX - 8) return;
    const edge = smooth(-118, -88, bx);

    if (age < swellDur) {
      const uS = age / swellDur;
      const rad = rMax * ease.outCubic(Math.min(1, uS * 1.28));
      drawBottomBubble(p, bx, by, rad, Vn, C, edge, by > -1.6);
      if (rad >= 2.0) p.glow(bx, by, 5, Vn[3], 0.20 * edge);
    } else {
      const uP = (age - swellDur) / popDur;
      drawBottomBubblePop(p, bx, by, rMax, uP, idx * 17 + 3, Vn, C, edge);
    }
  });

  // 7. Low toxic internal miasma illumination along the surging wave's belly & brow
  const pulse = 0.88 + 0.12 * Math.sin(2 * w);
  p.glow(5 + headBobX, -11, 28, Oc[4], 0.20 * pulse);
  p.glow(13 + headBobX, -6, 22, Vn[3], 0.24 * pulse);
  p.glow(-34, -10, 28, C[4], 0.18 * pulse);
}
