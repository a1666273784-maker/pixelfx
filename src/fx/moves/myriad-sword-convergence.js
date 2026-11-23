// Myriad Swords Convergence ("moves/myriad-sword-convergence" — 【万剑合一】):
// 1. Myriad Swords Release & Sword-Array Unfolding (0.00..0.60s): The sword-master forms a sword-seal and points
//    skyward; a twin-ringed celestial sword-array unfolds behind him as 42 distinct pixel-art spirit swords
//    materialize in a wide fan-halo, glinting and humming with sword-qi.
// 2. Swirling Vortex Convergence into One Colossal Greatsword (0.44..1.06s): All 42 spirit swords launch forward
//    along braided helical paths toward the sky apex (114, -124), orbiting and fusing one by one in white-hot flashes
//    into a single Colossal Sovereign Greatsword ("合成一柄巨剑") that hovers with crushing gravitational oppressiveness.
// 3. Sky-Cleaving Plunge & Cataclysmic Multi-Stage Impact (1.06..1.75s): The Colossal Greatsword plunges diagonally
//    into the target at TX = 194, tearing a sky-splitting sonic wake, impaling the earth in a blinding white
//    hit-flash, erupting upward sword-qi pillars, pulsing with runic lightning, and shattering into radial blades.
// 4. Sword-Graveyard Aftermath (1.62..4.15s): A glowing cyan-gold sword-chasm and floor cracks linger at the impact
//    site while 5 tilted remnant spirit swords stay embedded in the ground around the target, humming and dissolving
//    into sinuous rising sword-qi mist and golden-cyan light motes.
// Slash, shockwave, star-glint and debris techniques build on Sprite Fusion's open-source slash, holy and impact VFX
// (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import {
  Particles,
  Bits,
  Lights,
  P,
  PF,
  B,
  Rng,
  fit,
  band,
  flare,
  sparkle,
  bolt,
  clamp,
  smooth,
  lerp,
  ease,
  fract,
  hex,
  mix,
  TAU,
  WHITE,
  READY,
} from "../../core/index.js";
import { cracks, star, stone, rock } from "../melee/_lib.js";
import { floorLight } from "../fire/_lib.js";
import { unlight } from "../shadow/_lib.js";

const ARRAY_X = 16;            // Sword-array center X behind/above caster
const ARRAY_Y = -78;           // Sword-array center Y
const APEX_X = 114;            // Sky convergence apex X where the 42 swords merge into the Colossal Greatsword
const APEX_Y = -124;           // Sky convergence apex Y
const TX = 194;                // Enemy target X
const SLIDE_1 = 12;
const SLIDE_2 = 18;
const SLIDE_3 = 26;

// Choreography timing constants (seconds)
const T_SUMMON = 0.06;         // Caster points sword skyward; 42 spirit swords begin materializing
const T_SWARM = 0.44;          // 42 spirit swords launch in a swirling vortex toward the sky apex
const T_FORGE = 0.92;          // All 42 swords lock together in a blinding flash, forging the Colossal Greatsword
const T_LAUNCH = 1.06;         // Colossal Greatsword plunges diagonally down toward TX
const T_HIT = 1.16;            // Colossal Greatsword impales the target & earth (Primary Hit)
const T_PULSE2 = 1.38;         // Impaled Colossal Greatsword drives deeper with runic lightning shockwave
const T_SHATTER = 1.62;        // Colossal Greatsword shatters into radial sword-qi blades & leaves Sword-Graveyard
const T_END = 4.15;

// Plunge angle from (APEX_X, APEX_Y) to (TX + 6, -4)
const PLUNGE_DX = (TX + 6) - APEX_X;
const PLUNGE_DY = -4 - APEX_Y;
const PLUNGE_ANG = Math.atan2(PLUNGE_DY, PLUNGE_DX); // ~0.98 rad (~56 deg downward right)

const SY = 0.20;

export const meta = {
  name: "Myriad sword convergence",
  desc: "Dozens of summoned spirit swords swirl together to forge a colossal greatsword that cleaves down in a blinding blast, leaving embedded blades and sword-qi mist.",
  tags: ["move", "boss", "sword", "blade", "ultimate", "convergence", "wuxia", "holy", "arcane", "one-shot"],
  size: [436, 248],
  origin: [92, 198],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    // 8-step Celestial Sword-Qi Cyan-Silver -> Azure -> Ice-Silver -> White ramp
    palette: ["#091326", "#14294a", "#234b7c", "#3a7ec2", "#62b8f6", "#9ee2ff", "#daf6ff", "#ffffff"],
    // 7-step Sovereign Imperial Gold hilt / rune / convergence ramp
    gold: ["#261204", "#582c08", "#985210", "#d8881a", "#f8be32", "#ffe878", "#fffbe0"],
    // 5-step Crimson Sword-Seal accent ramp
    crimson: ["#28040c", "#680a1c", "#b8182c", "#f44438", "#ff9e78"],
    stone: "#4a4258",
    seed: 17,
  },
};

// Sword-master caster choreography: guard -> sword-seal gather -> skyward summon -> convergence command -> downward cleave -> recovery
const GUARD = { ...READY, x: 0, weapon: "sword", crouch: 2, lean: 1, fx: 12, fy: -20, sa: -0.65, bx: -6, by: -20, ffx: 8, fbx: -8 };
const SEAL = { ...GUARD, x: -5, crouch: 4, lean: -3, turn: 0.75, fx: -4, fy: -26, sa: -1.85, bx: 8, by: -25, armsFront: true, ffx: 6, fbx: -9 };
const SUMMON = { ...GUARD, x: -2, crouch: 2, lean: -4, turn: 0.85, hy: -2, fx: 4, fy: -36, sa: -1.55, bx: 11, by: -31, armsFront: true, ffx: 7, fbx: -9, ghost: 1 };
const FORGE_HOLD = { ...GUARD, x: 2, crouch: 3, lean: -2, turn: 0.65, hy: -1, fx: 8, fy: -34, sa: -1.20, bx: 13, by: -28, ffx: 9, fbx: -9, ghost: 1 };
const CLEAVE = { ...GUARD, x: 12, crouch: 8, lean: 7, turn: 0.35, hy: 2, fx: 18, fy: -14, sa: 0.68, bx: 12, by: -16, ffx: 13, fbx: -9, toeB: true, ghost: 1 };
const CHANNEL = { ...CLEAVE, x: 13, crouch: 7, lean: 6, fx: 19, fy: -16, sa: 0.52, ghost: 0 };
const RECOVER = { ...GUARD, x: 4, crouch: 3, lean: 1, fx: 14, fy: -20, sa: -0.35 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.30, GUARD],
    [-0.08, SEAL],
    [T_SUMMON, SUMMON, "snap"],
    [T_SWARM, { ...SUMMON, fy: -38, sa: -1.45 }],
    [T_FORGE, FORGE_HOLD, "snap"],
    [T_LAUNCH - 0.03, { ...FORGE_HOLD, crouch: 5, fy: -36 }],
    [T_LAUNCH, CLEAVE, "snap"],
    [T_PULSE2, CHANNEL],
    [T_SHATTER, { ...CLEAVE, x: 14, fx: 20, fy: -12, sa: 0.82, ghost: 1 }, "snap"],
    [2.35, RECOVER],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_SUMMON, stop: 0.03, shake: 0.16, amp: 1.8, target: false },
    { t: T_FORGE, stop: 0.07, shake: 0.30, amp: 3.4, target: false },
    { t: T_HIT, stop: 0.18, shake: 0.56, amp: 5.8, push: 5.4, slide: SLIDE_1, straw: 42, y: -28, skin: "shock", shiver: 0.55, flash: 0.08 },
    { t: T_PULSE2, stop: 0.07, shake: 0.38, amp: 4.5, push: 4.2, slide: SLIDE_2, straw: 26, y: -26, skin: "holy", shiver: 0.52, flash: 0.06 },
    { t: T_SHATTER, stop: 0.10, shake: 0.48, amp: 5.2, push: 5.0, slide: SLIDE_3, daze: 1.45, straw: 36, y: -28, skin: "char", shiver: 0.62, flash: 0.08 },
    { t: 2.10, push: 0, straw: 0, flash: 0, skin: "shock" },
    { t: T_END - 0.32, push: 0, straw: 0, flash: 0, skin: null, daze: 0 },
  ],
  dust: [
    { t: T_SUMMON, x: 0, n: 6, dir: -1 },
    { t: T_LAUNCH, x: 16, n: 9, dir: 1 },
    { t: T_HIT, x: TX - 8, n: 12, dir: -1 },
    { t: T_HIT, x: TX + 14, n: 14, dir: 1 },
  ],
};

// Safe local bounds inside [436, 248] with origin [92, 198] -> x in [-92..343], y in [-198..49]
const X_MIN = -86, X_MAX = 336, Y_MIN = -190, Y_MAX = 38;

// Sinuous, translucent Sword-Qi Mist Wisp ("升腾剑气灵雾") rising from the sword-chasm in Phase 4
function drawSwordQiWisp(p, x0, yBase, h, w0, swayPhase, t, uLife, C, G, isGold) {
  const fade = Math.sin(Math.min(1, uLife * 3.2) * (Math.PI / 2)) * (1 - smooth(0.46, 1.0, uLife));
  if (fade <= 0.02 || h < 4) return;
  const rows = Math.ceil(h);
  for (let r = 0; r <= rows; r++) {
    const v = r / Math.max(1, h);
    const py = Math.round(yBase - r);
    if (py < Y_MIN + 4 || py > 2) continue;

    const sway = Math.sin(v * Math.PI * 2.1 - t * 5.0 + swayPhase) * (3.2 + 6.0 * v);
    const cx = x0 + sway + v * 4.0;
    const env = Math.sin(v * Math.PI) * (0.55 + 0.60 * v);
    const hw = w0 * env;
    if (hw < 0.6) continue;

    const ix0 = Math.max(X_MIN + 4, Math.floor(cx - hw));
    const ix1 = Math.min(X_MAX - 4, Math.ceil(cx + hw));
    for (let px = ix0; px <= ix1; px++) {
      const q = Math.abs(px - cx) / hw;
      if (q > 1) continue;
      const a = fade * (1 - q * q) * 0.44;
      if (a <= 0.02) continue;
      const col = isGold
        ? (q < 0.36 && v > 0.35 ? G[5] : q < 0.72 ? G[4] : G[2])
        : (q < 0.36 && v > 0.35 ? C[6] : q < 0.72 ? C[4] : C[2]);
      p.blend(px, py, col, a);
    }
  }
}

// Hand-crafted pixel-art Spirit Sword renderer (tip at +len*0.68 along angle, crossguard & hilt at -len*0.46)
function drawSpiritSword(p, cx, cy, ang, len, C, G, alpha = 1, flashWhite = false, isGold = false, clipFloor = false) {
  if (alpha <= 0.04 || len < 4) return;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const nx = -sa, ny = ca;

  const tipD = len * 0.68;
  const guardD = -len * 0.22;
  const pommelD = -len * 0.46;
  const yMax = clipFloor ? 1 : Y_MAX;

  // 1. Blade shaft from guardD to tipD
  const steps = Math.ceil((tipD - guardD) * 1.4);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const d = lerp(guardD, tipD, u);
    const bx = cx + ca * d;
    const by = cy + sa * d;
    if (bx < X_MIN || bx > X_MAX || by < Y_MIN || by > yMax) continue;

    const taper = u > 0.72 ? (1 - u) / 0.28 : 1.0;
    const hw = Math.max(0.4, (len > 20 ? 1.8 : 1.25) * taper);

    const coreCol = flashWhite ? WHITE : u > 0.82 ? WHITE : isGold ? G[6] : C[7];
    const upperCol = flashWhite ? WHITE : isGold ? G[5] : C[6];
    const lowerCol = flashWhite ? C[6] : isGold ? G[3] : C[4];

    if (alpha > 0.90) {
      p.px(bx, by, coreCol);
      if (hw > 0.75) {
        p.px(bx + nx * 0.95, by + ny * 0.95, upperCol);
        p.px(bx - nx * 0.95, by - ny * 0.95, lowerCol);
      }
    } else {
      p.dot(bx, by, coreCol, alpha);
      if (hw > 0.75) {
        p.dot(bx + nx * 0.95, by + ny * 0.95, upperCol, alpha);
        p.dot(bx - nx * 0.95, by - ny * 0.95, lowerCol, alpha * 0.85);
      }
    }
  }

  // 2. Golden Crossguard ("护手剑格") perpendicular to the blade at guardD
  const gx = cx + ca * guardD;
  const gy = cy + sa * guardD;
  const gw = Math.max(2.2, len * 0.22);
  for (let s = -Math.ceil(gw); s <= Math.ceil(gw); s++) {
    const q = Math.abs(s) / gw;
    if (q > 1.05) continue;
    const px = gx + nx * s + ca * (q * 0.6);
    const py = gy + ny * s + sa * (q * 0.6);
    if (px < X_MIN || px > X_MAX || py < Y_MIN || py > yMax) continue;
    const gCol = flashWhite ? WHITE : q < 0.35 ? G[6] : q < 0.75 ? G[4] : G[3];
    p.dot(px, py, gCol, alpha);
  }

  // 3. Hilt grip & pommel jewel
  const hSteps = Math.max(2, Math.ceil((guardD - pommelD) * 1.2));
  for (let i = 1; i <= hSteps; i++) {
    const u = i / hSteps;
    const d = lerp(guardD, pommelD, u);
    const hx = cx + ca * d;
    const hy = cy + sa * d;
    if (hx < X_MIN || hx > X_MAX || hy < Y_MIN || hy > yMax) continue;
    const hCol = flashWhite ? WHITE : i === hSteps ? G[6] : G[2];
    p.dot(hx, hy, hCol, alpha);
  }
}

// Colossal Sovereign Greatsword renderer ("合成一柄巨剑": 120px long, 17px wide faceted diamond blade, winged golden guard)
function drawColossalGreatsword(p, cx, cy, ang, scaleK, C, G, CR, alpha = 1, flashK = 0, crackK = 0, clipFloor = false) {
  if (alpha <= 0.03 || scaleK <= 0.08) return;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const nx = -sa, ny = ca;

  const bladeLen = 84 * scaleK;
  const guardD = -14 * scaleK;
  const pommelD = -36 * scaleK;
  const maxHalfW = 8.4 * scaleK;

  const corners = [
    [guardD - 24 * scaleK, -22 * scaleK],
    [bladeLen + 6, -22 * scaleK],
    [bladeLen + 6, 22 * scaleK],
    [guardD - 24 * scaleK, 22 * scaleK],
  ];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [ld, lw] of corners) {
    const sx = cx + ca * ld + nx * lw;
    const sy = cy + sa * ld + ny * lw;
    if (sx < x0) x0 = sx;
    if (sx > x1) x1 = sx;
    if (sy < y0) y0 = sy;
    if (sy > y1) y1 = sy;
  }
  x0 = Math.max(X_MIN, Math.floor(x0 - 2));
  x1 = Math.min(X_MAX, Math.ceil(x1 + 2));
  y0 = Math.max(Y_MIN, Math.floor(y0 - 2));
  y1 = Math.min(clipFloor ? 2 : Y_MAX, Math.ceil(y1 + 2));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx, dy = y - cy;
      const d = dx * ca + dy * sa;
      const w = dx * nx + dy * ny;
      const aw = Math.abs(w);

      // A. Blade body (from guardD to bladeLen)
      if (d >= guardD && d <= bladeLen) {
        const u = (d - guardD) / Math.max(1, bladeLen - guardD);
        const shoulder = u < 0.14 ? 1.25 - u * 1.8 : 1.0;
        const pointTaper = u > 0.72 ? Math.pow(Math.max(0, (1 - u) / 0.28), 0.82) : 1.0;
        const notch = Math.abs(u - 0.16) < 0.025 ? 0.78 : 1.0;
        const halfW = maxHalfW * shoulder * pointTaper * notch;

        if (aw <= halfW) {
          if (flashK > 0.65) {
            p.px(x, y, WHITE);
            continue;
          }
          const q = aw / Math.max(0.5, halfW);

          if (crackK > 0.05) {
            const seam = Math.abs(Math.sin(d * 0.22 + w * 0.35) * Math.cos(d * 0.14 - w * 0.28));
            if (seam < 0.14 * crackK) {
              p.px(x, y, crackK > 0.5 ? WHITE : G[6]);
              continue;
            }
          }

          let col;
          if (q < 0.16) {
            const runeSeg = Math.sin(d * 0.42) > 0.15;
            col = u > 0.84 ? WHITE : runeSeg ? G[6] : CR[3];
          } else if (q < 0.34 && u < 0.78) {
            col = C[2];
          } else if (q > 0.84) {
            col = w < 0 || u > 0.75 ? WHITE : C[6];
          } else if (w < 0) {
            col = q > 0.58 ? C[6] : C[5];
          } else {
            col = q > 0.62 ? C[5] : C[3];
          }

          if (flashK > 0.05) col = mix(col, WHITE, flashK);
          if (alpha > 0.92) p.px(x, y, col);
          else p.blend(x, y, col, alpha);
          continue;
        }
      }

      // B. Winged Imperial-Gold Crossguard ("流金巨剑护手")
      const guardSweep = d - (guardD + Math.pow(aw / Math.max(1, 18 * scaleK), 1.4) * 9 * scaleK);
      if (aw <= 19 * scaleK && Math.abs(guardSweep) <= 3.2 * scaleK * (1 - aw / (23 * scaleK))) {
        const gq = Math.abs(guardSweep) / (3.2 * scaleK);
        let col = aw < 3.5 * scaleK && gq < 0.45 ? WHITE : gq < 0.45 ? G[5] : gq < 0.80 ? G[4] : G[2];
        if (flashK > 0.05) col = mix(col, WHITE, flashK);
        if (alpha > 0.92) p.px(x, y, col);
        else p.blend(x, y, col, alpha);
        continue;
      }

      // C. Two-Handed Hilt & Pommel Ring (guardD down to pommelD)
      if (d >= pommelD && d < guardD) {
        const isPommel = d < pommelD + 5.5 * scaleK;
        const hiltHalfW = (isPommel ? 4.2 : 2.2) * scaleK;
        if (aw <= hiltHalfW) {
          let col = isPommel ? (aw < 1.6 * scaleK ? WHITE : G[5]) : ((Math.floor(d) & 2) === 0 ? G[3] : C[1]);
          if (flashK > 0.05) col = mix(col, WHITE, flashK);
          if (alpha > 0.92) p.px(x, y, col);
          else p.blend(x, y, col, alpha);
        }
      }
    }
  }

  // Additive glow along the Colossal Greatsword spine and tip
  for (let u = 0; u <= 1; u += 0.25) {
    const d = lerp(guardD, bladeLen, u);
    const gx = cx + ca * d;
    const gy = cy + sa * d;
    if (clipFloor && gy > 2) continue;
    p.glow(gx, gy, (18 - u * 4) * scaleK, u > 0.75 ? C[6] : C[4], (0.22 + 0.25 * flashK) * alpha);
  }
  const ggx = cx + ca * guardD, ggy = cy + sa * guardD;
  if (!clipFloor || ggy <= 2) {
    p.glow(ggx, ggy, 20 * scaleK, G[4], 0.28 * alpha);
  }
}

// Perspective ground shockwave ring that breaks into hand-pixelled sword-qi arcs
function drawFloorBand(p, cx, cy, r, sy, th, progress, alpha, ramp, back, hot = false) {
  if (alpha <= 0.03 || r <= 1 || th <= 0.2) return;
  const rx = r + th + 2, ry = (r + th) * sy + th * 0.6 + 1;
  const x0 = Math.max(X_MIN, Math.floor(cx - rx - 1)), x1 = Math.min(X_MAX, Math.ceil(cx + rx + 1));
  const y0 = back ? Math.max(Y_MIN, Math.floor(cy - ry - 1)) : Math.floor(cy);
  const y1 = back ? Math.floor(cy) : Math.min(Y_MAX - 2, Math.ceil(cy + ry + 1));
  const invR = 1 / r, invRsy = 1 / Math.max(0.8, r * sy);
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    if (back ? dy >= 0 : dy < 0) continue;
    const ny = dy * invRsy;
    if (ny * ny > 1.75) continue;
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) * invR;
      const e = Math.hypot(nx, ny);
      if (e < 0.25) continue;
      const ang = Math.atan2(ny, nx);
      const wave = 0.72 + 0.34 * Math.sin(ang * 6 + 0.6) + 0.22 * Math.cos(ang * 10 - 1.1);
      if (progress > 0.35 && wave < (progress - 0.35) * 1.45 + 0.32) continue;
      const locTh = Math.max(0.75, th * wave);
      const grad = Math.hypot(nx * invR, ny * invRsy);
      const dist = (1 - e) / Math.max(1e-4, grad);
      if (dist < -0.5 || dist > locTh) continue;
      const u = clamp(dist / locTh);
      const col = u < 0.26 ? (hot ? WHITE : ramp[3]) : u < 0.56 ? ramp[2] : u < 0.82 ? ramp[1] : ramp[0];
      p.dot(x, y, col, alpha * (u < 0.45 ? 1.15 : 1.05 - u * 0.8));
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8);
  const G = fit(o.gold, 7);
  const CR = fit(o.crimson, 5);
  const st = stone(o.stone);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, C[6], G[5], C[4]],
    haze: C[4],
  });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  // Enemy current X position accounting for multi-stage knockback slide
  const enemyX = (time) => {
    if (time < T_HIT) return TX;
    if (time < T_PULSE2) return lerp(TX, TX + SLIDE_1, ease.outCubic(clamp((time - T_HIT) / 0.16)));
    if (time < T_SHATTER) return lerp(TX + SLIDE_1, TX + SLIDE_2, ease.outCubic(clamp((time - T_PULSE2) / 0.16)));
    return lerp(TX + SLIDE_2, TX + SLIDE_3, ease.outCubic(clamp((time - T_SHATTER) / 0.22)));
  };

  // Prebake 42 summoned Spirit Swords arranged in two concentric fan-halos around (ARRAY_X, ARRAY_Y)
  const spiritSwords = Array.from({ length: 42 }, (_, i) => {
    const ring = i < 16 ? 0 : 1;
    const idxInRing = ring === 0 ? i : i - 16;
    const countInRing = ring === 0 ? 16 : 26;
    const fanAng = lerp(-Math.PI * 1.18, Math.PI * 0.18, idxInRing / (countInRing - 1)) + R.range(-0.04, 0.04);
    const rad = (ring === 0 ? 34 : 56) + R.range(-3, 3);
    const x0 = clamp(ARRAY_X + Math.cos(fanAng) * rad, X_MIN + 22, X_MAX - 40);
    const y0 = clamp(ARRAY_Y + Math.sin(fanAng) * rad * 0.82, Y_MIN + 24, -18);

    const ang0 = fanAng + Math.PI * 0.5 * (fanAng < -Math.PI * 0.5 ? 1 : -1) * 0.15;
    const tSpawn = T_SUMMON + (i / 42) * 0.30 + R.range(0, 0.02);
    // Stagger launch times across 0.44..0.78s and flight durations across 0.24..0.32s so a continuous river of swords converges!
    const tFly = T_SWARM + (i / 42) * 0.34;
    const flyDur = R.range(0.24, 0.32);
    const swirlSide = i % 2 === 0 ? 1 : -1;
    const ctrlX = lerp(x0, APEX_X, 0.50) + swirlSide * R.range(20, 46);
    const ctrlY = clamp(lerp(y0, APEX_Y, 0.46) - swirlSide * R.range(18, 38), Y_MIN + 20, -24);
    // Target point distributed along the Colossal Greatsword spine so swords visibly assemble the giant blade!
    const spineOffset = lerp(-24, 64, (i * 7 % 42) / 41);
    const destX = APEX_X + Math.cos(PLUNGE_ANG) * spineOffset;
    const destY = APEX_Y + Math.sin(PLUNGE_ANG) * spineOffset;
    const len = ring === 0 ? R.range(16, 20) : R.range(19, 25);
    const isGold = i % 3 === 0;
    return { x0, y0, ang0, tSpawn, tFly, flyDur, ctrlX, ctrlY, destX, destY, len, isGold, spawned: false, fused: false };
  });

  // Prebake 28 upward-erupting Sword-Qi Phantom Blades at the target upon Colossal Greatsword impact
  const eruptBlades = Array.from({ length: 28 }, (_, i) => {
    const ox = ((i / 27) - 0.5) * 68 + R.range(-2, 2);
    const delay = Math.abs(ox) * 0.0025 + R.range(0, 0.08);
    const dur = R.range(0.24, 0.40);
    const hMax = R.range(78, 156) * (1 - Math.abs(ox) / 95);
    const len = R.range(18, 28);
    const isGold = i % 2 === 0;
    return { ox, delay, dur, hMax, len, isGold };
  });

  // Prebake 24 radial shattering Spirit Swords when the Colossal Greatsword detonates at T_SHATTER
  const shatterSwords = Array.from({ length: 24 }, (_, i) => {
    const ang = -Math.PI * 0.92 + (i / 23) * Math.PI * 0.84 + R.range(-0.04, 0.04);
    const spd = R.range(135, 250);
    const len = R.range(15, 22);
    const life = R.range(0.32, 0.56);
    const isGold = i % 2 === 0;
    return { ang, spd, len, life, isGold };
  });

  // Prebake 5 Remnant Spirit Swords embedded in the ground around the crater for the Hit Aftermath ("剑冢残剑插地")
  const remnantSwords = [
    { ox: -44, tilt: Math.PI * 0.42, len: 26, isGold: false, tFade: 3.55 },
    { ox: -22, tilt: Math.PI * 0.47, len: 31, isGold: true, tFade: 3.78 },
    { ox: 4, tilt: Math.PI * 0.51, len: 36, isGold: false, tFade: 3.98 },
    { ox: 26, tilt: Math.PI * 0.55, len: 30, isGold: true, tFade: 3.72 },
    { ox: 48, tilt: Math.PI * 0.59, len: 25, isGold: false, tFade: 3.48 },
  ];

  // Prebake 16 Impact Starburst spikes (clamped downward so no spike ever exceeds y = 36!)
  const hitSpikes = Array.from({ length: 16 }, (_, i) => {
    const base = (i / 16) * TAU + R.range(-0.05, 0.05);
    const diag = Math.abs(Math.cos(base - PLUNGE_ANG));
    let mul = diag > 0.90 ? 1.75 : i % 2 === 0 ? 1.20 : 0.72;
    if (Math.sin(base) > 0.15) mul *= 0.48;
    return { a: base, len: R.range(26, 38) * mul, w: R.range(2.0, 3.2) };
  });

  // Prebake 8 Jagged Floor Cracks at the impact site
  const floorCracks = cracks(R, TX + 6, 8, 76, 8, 0.25);

  // Prebake 24 Sinuous Rising Sword-Qi Mist Wisps ("升腾剑气灵雾") for Phase 4 Aftermath
  const mistWisps = Array.from({ length: 24 }, (_, i) => {
    const uX = i / 23;
    const x0 = lerp(TX - 50, TX + 60, uX) + R.range(-4, 4);
    const t0 = R.range(1.42, 2.38);
    const life = Math.min(R.range(1.40, 2.05), T_END - 0.08 - t0);
    const hMax = R.range(42, 78);
    const w0 = R.range(4.0, 6.6);
    const phase = R.range(0, TAU);
    const isGold = i % 4 === 0;
    return { x0, t0, life, hMax, w0, phase, isGold };
  });

  let t = 0;
  let forgeDone = false, hit1Done = false, pulse2Done = false, shatterDone = false;

  const capLife = (l) => Math.max(0.08, Math.min(l, T_END - 0.10 - t));

  // PHASE 1 & 2A: Celestial Sword-Array Halo & 42 Spirit Swords Summoning -> Swirling into the Sky Apex
  function drawMyriadSwordsAndArray(p, isBack) {
    // 1. Rotating Twin Celestial Sword-Array Rings behind the caster (0.02 .. 0.95s)
    if (t >= 0.02 && t < 0.98) {
      const fadeArr = smooth(0.02, 0.16, t) * (1 - smooth(0.68, 0.98, t));
      if (fadeArr > 0.03) {
        const keepFn = isBack ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0;
        const rOuter = 44 * ease.outBack(clamp(t / 0.28), 1.4);
        const rInner = 26 * ease.outCubic(clamp(t / 0.24));
        band(p, ARRAY_X, ARRAY_Y, rOuter, 0.42, 2.6, fadeArr * 0.90, [C[2], C[4], C[6], WHITE], keepFn);
        band(p, ARRAY_X, ARRAY_Y, rInner, 0.42, 2.0, fadeArr * 0.85, [G[2], G[4], G[6], WHITE], keepFn);

        if (isBack) {
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * TAU + t * 2.4;
            const x1 = ARRAY_X + Math.cos(a) * rOuter * 0.92;
            const y1 = ARRAY_Y + Math.sin(a) * rOuter * 0.92 * 0.42;
            p.line(ARRAY_X, ARRAY_Y, x1, y1, k % 2 === 0 ? G[5] : C[5], fadeArr * 0.55);
          }
          p.glow(ARRAY_X, ARRAY_Y, 46, C[4], 0.45 * fadeArr);
          p.glow(ARRAY_X, ARRAY_Y, 24, G[4], 0.42 * fadeArr);
        }
      }
    }

    // 2. The 42 Spirit Swords: Materializing in Halo -> Launching in Swirling Vortex -> Fusing into Colossal Greatsword
    for (let i = 0; i < spiritSwords.length; i++) {
      if ((i % 2 === 0) !== isBack) continue;
      const sw = spiritSwords[i];
      if (t < sw.tSpawn || t >= sw.tFly + sw.flyDur) continue;

      if (t < sw.tFly) {
        const uMat = clamp((t - sw.tSpawn) / 0.14);
        const hoverY = Math.sin(t * 16 + i) * 1.8;
        const aimAng = Math.atan2(sw.destY - sw.y0, sw.destX - sw.x0);
        const curAng = lerp(sw.ang0, aimAng, ease.inOutQuad(clamp((t - sw.tSpawn) / 0.30)));

        if (uMat < 0.65) {
          sparkle(p, sw.x0, sw.y0 + hoverY, 9 * (1 - uMat), WHITE, sw.isGold ? G[5] : C[5], 0.85);
        }
        drawSpiritSword(
          p,
          sw.x0,
          sw.y0 + hoverY,
          curAng,
          sw.len * ease.outBack(uMat, 1.5),
          C,
          G,
          uMat,
          uMat < 0.30,
          sw.isGold,
        );
        p.glow(sw.x0, sw.y0 + hoverY, 10, sw.isGold ? G[4] : C[5], 0.32 * uMat);
      } else {
        // Swirling along quadratic Bezier trajectory into the Colossal Greatsword spine ("万剑归宗合成一柄巨剑")
        const uFly = clamp((t - sw.tFly) / sw.flyDur);
        const eFly = ease.inOutCubic(uFly);
        const om = 1 - eFly;
        const sx = om * om * sw.x0 + 2 * om * eFly * sw.ctrlX + eFly * eFly * sw.destX;
        const sy = om * om * sw.y0 + 2 * om * eFly * sw.ctrlY + eFly * eFly * sw.destY;

        const tx = 2 * om * (sw.ctrlX - sw.x0) + 2 * eFly * (sw.destX - sw.ctrlX);
        const ty = 2 * om * (sw.ctrlY - sw.y0) + 2 * eFly * (sw.destY - sw.ctrlY);
        const tangAng = Math.atan2(ty, tx);
        const curAng = lerp(tangAng, PLUNGE_ANG, smooth(0.60, 1.0, uFly));

        // Luminous ribbon wake behind each flying spirit sword
        for (let k = 1; k <= 5; k++) {
          const uPrev = Math.max(0, eFly - k * 0.055);
          const omP = 1 - uPrev;
          const px = omP * omP * sw.x0 + 2 * omP * uPrev * sw.ctrlX + uPrev * uPrev * sw.destX;
          const py = omP * omP * sw.y0 + 2 * omP * uPrev * sw.ctrlY + uPrev * uPrev * sw.destY;
          const col = k === 1 ? WHITE : sw.isGold ? G[5] : C[5];
          p.line(sx, sy, px, py, col, (1 - k / 6) * 0.85);
        }

        drawSpiritSword(p, sx, sy, curAng, sw.len, C, G, 1.0, uFly > 0.78, sw.isGold);
        p.glow(sx, sy, 12, sw.isGold ? G[5] : C[5], 0.45);
      }
    }
  }

  // PHASE 2B & 3: Forging the Colossal Greatsword, Sky-Cleaving Plunge & Cataclysmic Multi-Stage Impact
  function drawColossalSwordAndImpact(p) {
    if (t < T_SWARM + 0.10 || t >= T_SHATTER + 0.48) return;
    const ex = enemyX(t);

    // 1. Convergence Vortex & Colossal Greatsword Formation at Sky Apex (0.54 .. T_LAUNCH = 1.06s)
    if (t < T_LAUNCH) {
      const uBuild = clamp((t - (T_SWARM + 0.10)) / (T_FORGE - (T_SWARM + 0.10)));
      const scaleK = ease.outBack(uBuild, 1.35);
      const dtForge = t - T_FORGE;
      const flashK = dtForge >= -0.03 && dtForge < 0.12 ? 1 - Math.abs(dtForge) / 0.12 : uBuild * 0.35;

      // Spiralling convergence rings tightening around the forging Colossal Greatsword
      for (let rIdx = 0; rIdx < 2; rIdx++) {
        const ph = fract(t * 4.2 + rIdx * 0.5);
        const rVortex = lerp(52, 12, ph);
        band(
          p,
          APEX_X,
          APEX_Y,
          rVortex,
          0.36,
          Math.max(1.2, 3.4 * (1 - ph)),
          Math.sin(ph * Math.PI) * 0.92,
          rIdx === 0 ? [C[3], C[5], C[6], WHITE] : [G[3], G[4], G[6], WHITE],
        );
      }

      // 8 Orbiting Spirit Swords spiralling around the Colossal Greatsword as it consolidates!
      const collapseOrbit = 1 - smooth(T_FORGE - 0.04, T_LAUNCH - 0.02, t);
      if (collapseOrbit > 0.05) {
        const nx = -Math.sin(PLUNGE_ANG), ny = Math.cos(PLUNGE_ANG);
        for (let s = 0; s < 8; s++) {
          const a = (s / 8) * TAU + t * 18;
          const alongD = lerp(-12, 58, (s % 4) / 3) * scaleK;
          const radO = 26 * collapseOrbit;
          const ox = APEX_X + Math.cos(PLUNGE_ANG) * alongD + nx * Math.cos(a) * radO;
          const oy = APEX_Y + Math.sin(PLUNGE_ANG) * alongD + ny * Math.cos(a) * radO + Math.sin(a) * 8 * collapseOrbit;
          drawSpiritSword(p, ox, oy, PLUNGE_ANG, 16 * collapseOrbit, C, G, 0.90, collapseOrbit < 0.35, s % 2 === 0);
        }
      }

      // Draw the Colossal Sovereign Greatsword hovering in the sky with oppressive gravitational rays!
      drawColossalGreatsword(p, APEX_X, APEX_Y, PLUNGE_ANG, scaleK, C, G, CR, clamp(uBuild * 1.4), clamp(flashK));

      // Forging completion starburst at T_FORGE (0.92s) + Oppressive lock-on pressure lines toward target
      if (dtForge >= 0) {
        const uHold = clamp(dtForge / (T_LAUNCH - T_FORGE));
        if (dtForge < 0.12) {
          const kF = 1 - dtForge / 0.12;
          flare(p, APEX_X, APEX_Y, 52 * kF, kF, [C[4], G[4], G[6], WHITE]);
          sparkle(p, APEX_X + Math.cos(PLUNGE_ANG) * 72, APEX_Y + Math.sin(PLUNGE_ANG) * 72, 22 * kF, WHITE, G[5], kF);
        }
        p.line(APEX_X, APEX_Y, TX + 6, -2, G[5], 0.55 + 0.40 * uHold);
        for (let i = -2; i <= 2; i++) {
          if (i === 0) continue;
          const ox = i * 11;
          const ph = fract(t * 9 + i * 0.27);
          const py0 = lerp(-88, -14, ph);
          p.line(TX + ox, py0, TX + ox, Math.min(0, py0 + 22), i % 2 === 0 ? C[5] : G[5], 0.72);
        }
      }
    }

    // 2. Upward-Erupting Sword-Qi Phantom Blades & Blinding White Hit-Flash Bursts at Enemy (drawn behind the Colossal Greatsword!)
    if (t >= T_HIT) {
      const dtHit = t - T_HIT;
      for (const eb of eruptBlades) {
        const dtB = dtHit - eb.delay;
        if (dtB < 0 || dtB >= eb.dur) continue;
        const uB = dtB / eb.dur;
        const bx = ex + eb.ox;
        if (bx < X_MIN + 8 || bx > X_MAX - 8) continue;
        const by = lerp(-4, -eb.hMax, ease.outCubic(uB));
        const tailY = Math.min(0, by + 32 * Math.sin(uB * Math.PI));
        p.line(bx, tailY, bx, by, eb.isGold ? G[5] : C[5], 1 - uB * 0.4);
        drawSpiritSword(p, bx, by, -Math.PI * 0.5, eb.len * (1 - uB * 0.35), C, G, 1 - uB * 0.3, uB < 0.25, eb.isGold);
      }

      // Blinding Hit-Flash Bursts at T_HIT and T_SHATTER, plus crisp shock-ring at T_PULSE2
      for (const [tF, radMul, fullStar] of [[T_HIT, 1.0, true], [T_PULSE2, 0.75, false], [T_SHATTER, 1.05, true]]) {
        const dtF = t - tF;
        if (dtF >= 0 && dtF < 0.14) {
          const kF = 1 - dtF / 0.14;
          const sc = ease.outQuad(1 - kF * 0.5) * radMul;
          if (fullStar) {
            star(p, ex, -26, hitSpikes, sc, kF, WHITE, G[5], C[5], C[2]);
            p.disc(ex, -26, 24 * kF * radMul, WHITE, (d) => 0.85 * (1 - d * d) * kF);
            flare(p, ex, -26, 44 * kF * radMul, kF, [C[4], G[4], G[6], WHITE]);
            sparkle(p, ex, -26, 22 * kF * radMul, WHITE, G[5], kF);
            p.glow(ex, -26, 48 * kF * radMul, WHITE, 0.75 * kF);
          } else {
            p.ring(ex, -24, 38 * (1 - kF * 0.45), 2.2 * kF, G[5]);
            sparkle(p, ex, -14, 16 * kF, WHITE, G[5], 0.70 * kF);
            p.glow(ex, -20, 32 * kF, G[4], 0.35 * kF);
          }
        }
      }
    }

    // 3. Supersonic Sky-Cleaving Plunge & Impaled Colossal Greatsword (T_LAUNCH = 1.06 .. T_SHATTER = 1.62s)
    if (t >= T_LAUNCH && t < T_SHATTER) {
      const uPlunge = clamp((t - T_LAUNCH) / (T_HIT - T_LAUNCH));
      const ePlunge = ease.inQuart(uPlunge);

      // Keep 76px of the Colossal Blade + full Winged Crossguard + Hilt towering above the floor when impaled!
      const impaleDepth = t < T_PULSE2 ? 0 : lerp(0, 6, ease.outCubic(clamp((t - T_PULSE2) / 0.14)));
      const backDist = 76 - impaleDepth;
      const targetCX = (TX + 6) - Math.cos(PLUNGE_ANG) * backDist;
      const targetCY = -2 - Math.sin(PLUNGE_ANG) * backDist;

      const curCX = lerp(APEX_X, targetCX, ePlunge);
      const curCY = lerp(APEX_Y, targetCY, ePlunge);

      // Sky-splitting supersonic beam wake during plunge (fades briskly within 0.11s of impact)
      const wakeFade = 1 - smooth(T_HIT - 0.02, T_HIT + 0.11, t);
      if (wakeFade > 0.08) {
        const wWake = Math.max(3, 18 * wakeFade);
        p.beam(APEX_X, APEX_Y, curCX + Math.cos(PLUNGE_ANG) * 60, Math.min(0, curCY + Math.sin(PLUNGE_ANG) * 60), wWake, (u, v) =>
          v < 0.30 ? WHITE : v < 0.62 ? G[5] : C[5],
        );
        p.glowLine(APEX_X, APEX_Y, curCX, curCY, 28 * wakeFade, C[5], 0.68 * wakeFade);
      }

      const dtHit = t - T_HIT;
      const dtPulse = t - T_PULSE2;
      const flashHit = dtHit >= 0 && dtHit < 0.08 ? 1 - dtHit / 0.08 : 0;
      const flashPulse = dtPulse >= 0 && dtPulse < 0.10 ? 0.35 * (1 - dtPulse / 0.10) : 0;
      const crackK = smooth(T_PULSE2 + 0.06, T_SHATTER - 0.02, t);

      drawColossalGreatsword(
        p,
        curCX,
        curCY,
        PLUNGE_ANG,
        1.20,
        C,
        G,
        CR,
        1.0,
        Math.max(flashHit, flashPulse),
        crackK,
        true,
      );

      // Crackling runic lightning bolts climbing the impaled Colossal Greatsword!
      if (t >= T_HIT) {
        const boltRng = new Rng(o.seed + Math.floor(t * 30) * 17);
        for (let b = 0; b < 2; b++) {
          const pts = bolt(
            boltRng,
            TX + 6 + (b === 0 ? -6 : 6),
            -2,
            curCX - Math.cos(PLUNGE_ANG) * 24,
            curCY - Math.sin(PLUNGE_ANG) * 24,
            { jag: 0.26, depth: 4 },
          );
          p.polyline(pts, b === 0 ? WHITE : G[5], 0.92);
        }
      }
    }

    // 4. Radial Spirit-Sword Shatter Detonation at T_SHATTER (1.62s)
    const dtShatter = t - T_SHATTER;
    if (dtShatter >= 0 && dtShatter < 0.56) {
      for (const ss of shatterSwords) {
        if (dtShatter >= ss.life) continue;
        const uS = dtShatter / ss.life;
        const dist = ss.spd * ease.outCubic(uS) * ss.life;
        const sx = ex + Math.cos(ss.ang) * dist;
        const sy = -28 + Math.sin(ss.ang) * dist;
        if (sx < X_MIN + 8 || sx > X_MAX - 8 || sy < Y_MIN + 8 || sy > 2) continue;
        drawSpiritSword(p, sx, sy, ss.ang, ss.len * (1 - 0.3 * uS), C, G, 1 - smooth(0.55, 1.0, uS), uS < 0.22, ss.isGold);
      }
    }
  }

  // PHASE 4: Hit Result / Sword-Graveyard Aftermath — Glowing Sword-Chasm, Floor Cracks, 5 Embedded Remnant Swords & Sword-Qi Mist
  function drawAftermathSwordGraveyard(p, isBack) {
    if (t < T_HIT) return;
    const dtHit = t - T_HIT;
    const fadeEnd = 1 - smooth(T_END - 0.65, T_END - 0.06, t);
    if (fadeEnd <= 0.02) return;

    // 1. Multi-layer Ground Shockwave Rings on both back and front halves
    for (const [tRing, rMax, rampCols] of [
      [T_HIT, 96, [C[3], C[5], C[6], WHITE]],
      [T_HIT + 0.04, 74, [G[2], G[4], G[6], WHITE]],
      [T_PULSE2, 84, [CR[1], CR[3], G[5], WHITE]],
      [T_SHATTER, 104, [C[3], G[4], C[6], WHITE]],
    ]) {
      const dtR = t - tRing;
      if (dtR >= 0 && dtR < 0.48) {
        const uR = dtR / 0.48;
        drawFloorBand(
          p,
          TX + 6,
          1,
          rMax * ease.outQuart(uR),
          SY,
          Math.max(1.2, 6.2 * (1 - uR)),
          uR,
          (1 - uR) * 0.95,
          rampCols,
          isBack,
          uR < 0.20,
        );
      }
    }

    if (isBack) {
      // 2. Glowing Cyan-Gold Floor Cracks & Deep Sword-Chasm Scar at TX + 6
      const grow = ease.outCubic(clamp(dtHit / 0.14));
      const pulse = 0.78 + 0.22 * Math.sin(t * 10);
      for (const c of floorCracks) {
        const n = Math.max(1, Math.round((c.pts.length - 1) * grow));
        for (let i = 0; i < n; i++) {
          const [x0, y0] = c.pts[i], [x1, y1] = c.pts[i + 1];
          const d = Math.abs(x0 - (TX + 6)) / 76;
          const heat = clamp((1 - d * 0.55) * pulse * fadeEnd);
          if (heat <= 0.04) continue;
          const col = heat > 0.78 ? WHITE : heat > 0.56 ? G[5] : heat > 0.36 ? C[5] : C[3];
          p.line(x0, y0, x1, y1, col, heat);
          if (!c.fork && d < 0.55) p.line(x0, y0 + 1, x1, y1 + 1, C[2], heat * 0.85);
        }
      }

      // Glowing central Sword-Chasm fissure along the floor
      const chasmW = 48 * fadeEnd;
      p.ellipse(TX + 6, 1, chasmW, 3.8 * fadeEnd, C[2]);
      p.ellipse(TX + 6, 1, chasmW * 0.72, 2.5 * fadeEnd, C[5]);
      p.ellipse(TX + 6, 1, chasmW * 0.42, 1.5 * fadeEnd, dtHit < 0.8 ? WHITE : G[5]);
      floorLight(p, TX + 6, 2, 78 * fadeEnd, 11, C[5], 0.58 * pulse * fadeEnd);
      floorLight(p, TX + 6, 2, 44 * fadeEnd, 7, G[5], 0.48 * pulse * fadeEnd);
    }

    // 3. Sinuous Rising Translucent Sword-Qi Mist Wisps ("升腾剑气灵雾")
    for (let i = 0; i < mistWisps.length; i++) {
      if ((i % 2 === 0) !== isBack) continue;
      const mw = mistWisps[i];
      if (t < mw.t0 || t >= mw.t0 + mw.life) continue;
      const age = t - mw.t0;
      const u = age / mw.life;
      const curH = mw.hMax * ease.outQuad(Math.min(1, u * 1.4));
      const yBase = -1 - age * 15;
      drawSwordQiWisp(p, mw.x0, yBase, curH, mw.w0, mw.phase, t, u, C, G, mw.isGold);
    }

    if (isBack) return;

    // 4. Five Embedded Remnant Spirit Swords around the Crater ("剑冢残剑插地，护手朝上，散发微光并化作灵光消散")
    if (t >= T_SHATTER) {
      for (let i = 0; i < remnantSwords.length; i++) {
        const rs = remnantSwords[i];
        if (t >= rs.tFade) continue;
        const uRem = clamp((t - T_SHATTER) / (rs.tFade - T_SHATTER));
        const fadeR = (1 - smooth(0.68, 1.0, uRem)) * fadeEnd;
        if (fadeR <= 0.04) continue;

        const rx = TX + 6 + rs.ox;
        // Tip is at +len*0.68 along rs.tilt (pointing down into the floor); shift center up along -rs.tilt so hilt & blade stand above y = 0!
        const scx = rx - Math.cos(rs.tilt) * (rs.len * 0.52);
        const scy = -1 - Math.sin(rs.tilt) * (rs.len * 0.52);

        p.ellipse(rx, 1, 6.5 * fadeR, 1.6 * fadeR, rs.isGold ? G[4] : C[5]);
        drawSpiritSword(p, scx, scy, rs.tilt, rs.len, C, G, fadeR, uRem < 0.08, rs.isGold, true);

        const gPh = fract(t * 1.6 + i * 0.23);
        const gx = rx - Math.cos(rs.tilt) * (rs.len * (0.2 + gPh * 0.75));
        const gy = -1 - Math.sin(rs.tilt) * (rs.len * (0.2 + gPh * 0.75));
        sparkle(p, gx, gy, 4.5 * Math.sin(gPh * Math.PI) * fadeR, WHITE, rs.isGold ? G[5] : C[6], 0.75 * fadeR);
        p.glow(scx, scy, 14 * fadeR, rs.isGold ? G[4] : C[5], 0.38 * fadeR);
      }
    }
  }

  return {
    update(dt) {
      t += dt;
      const ex = enemyX(t);

      // Spark bursts as each spirit sword materializes and fuses
      for (const sw of spiritSwords) {
        if (!sw.spawned && t >= sw.tSpawn) {
          sw.spawned = true;
          ps.spawn(P.STAR, sw.x0, sw.y0, R.range(-12, 12), -R.range(8, 24), capLife(R.range(0.22, 0.42)), sw.isGold ? G[5] : C[6], R.range(1.0, 1.8));
        }
        if (!sw.fused && t >= sw.tFly + sw.flyDur) {
          sw.fused = true;
          const a = R.range(0, TAU), sp = R.range(45, 135);
          ps.spawn(P.SPARK, sw.destX, sw.destY, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.16, 0.34)));
        }
      }

      // Colossal Greatsword Forge Completion Burst at T_FORGE (0.92s)
      if (!forgeDone && t >= T_FORGE) {
        forgeDone = true;
        lights.add(APEX_X, APEX_Y, 88, G[5], 0.95, 0.38);
        lights.add(APEX_X, APEX_Y, 44, WHITE, 0.90, 0.14);
        for (let i = 0; i < 32; i++) {
          const a = R.range(0, TAU), sp = R.range(70, 210);
          ps.spawn(P.SPARK, APEX_X, APEX_Y, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.20, 0.46)));
        }
      }

      // Primary Impact of the Colossal Greatsword at T_HIT (1.16s)
      if (!hit1Done && t >= T_HIT) {
        hit1Done = true;
        lights.add(ex, -28, 92, C[5], 0.72, 0.36);
        lights.add(ex, -14, 48, WHITE, 0.85, 0.14);
        for (let i = 0; i < 64; i++) {
          const a = -Math.PI / 2 + R.range(-1.25, 1.25), sp = R.range(100, 290);
          ps.spawn(P.SPARK, ex + R.range(-8, 8), -4, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.25, 0.68)));
        }
        for (let i = 0; i < 18; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(70, 190);
          ps.spawn(P.STAR, ex + R.range(-10, 10), -8, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.38, 0.85)), i % 2 === 0 ? WHITE : G[5], R.range(1.2, 2.4));
        }
        for (let i = 0; i < 16; i++) {
          const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(85, 225);
          bits.add({
            kind: B.CHUNK,
            x: ex + R.range(-10, 10),
            y: -2,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            g: 1,
            drag: 0.4,
            bounce: 0.35,
            life: capLife(R.range(1.3, 2.1)),
            a: R.range(0, TAU),
            va: R.range(-14, 14),
            s: R.int(1, 3),
          });
        }
      }

      // Secondary Runic Resonance Pulse at T_PULSE2 (1.38s)
      if (!pulse2Done && t >= T_PULSE2) {
        pulse2Done = true;
        lights.add(ex, -26, 76, G[4], 0.48, 0.32);
        for (let i = 0; i < 32; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(85, 240);
          ps.spawn(P.SPARK, ex + R.range(-10, 10), -14, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.22, 0.54)));
        }
      }

      // Colossal Greatsword Shatter Detonation at T_SHATTER (1.62s)
      if (!shatterDone && t >= T_SHATTER) {
        shatterDone = true;
        lights.add(ex, -30, 104, G[5], 1.02, 0.58);
        lights.add(ex, -24, 52, WHITE, 0.95, 0.16);
        for (let i = 0; i < 52; i++) {
          const a = -Math.PI / 2 + R.range(-1.3, 1.3), sp = R.range(95, 275);
          ps.spawn(P.SPARK, ex + R.range(-12, 12), -22, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.28, 0.68)));
        }
        for (let i = 0; i < 12; i++) {
          const s = R.sign();
          ps.spawn(P.SMOKE, ex + s * R.range(4, 18), -R.range(2, 8), s * R.range(40, 115), -R.range(12, 38), capLife(R.range(0.85, 1.55)), C[4], R.range(4.0, 6.8), R.range(0, 0.08), PF.BIG);
        }
      }

      // Continuous rising golden & cyan sword-qi motes from the Sword-Graveyard during Phase 4 Aftermath
      if (t > T_SHATTER && t < T_END - 0.65 && R.chance(0.65)) {
        const mx = TX + 6 + R.range(-48, 48);
        if (R.chance(0.55)) {
          ps.spawn(P.EMBER, mx, -2, R.range(-10, 10), -R.range(22, 52), capLife(R.range(0.55, 1.05)), R.chance(0.5) ? G[5] : C[5]);
        } else {
          ps.spawn(P.STAR, mx, -R.range(2, 18), R.range(-6, 6), -R.range(14, 34), capLife(R.range(0.35, 0.75)), R.chance(0.5) ? WHITE : C[6], R.range(0.9, 1.8));
        }
      }

      bits.update(dt);
      ps.update(dt);
      cullParticles(ps, X_MIN + 4, Y_MIN + 4, X_MAX - 4, Y_MAX - 4);
      cullBits(bits, X_MIN + 4, Y_MIN + 4, X_MAX - 4, Y_MAX - 4);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;

      // Oppressive arena darkening during Colossal Greatsword forge, plunge, and impact ("展现压迫感")
      if (t >= T_FORGE - 0.10 && t < T_SHATTER + 0.30) {
        const kDark = 0.76 * smooth(T_FORGE - 0.10, T_HIT, t) * (1 - smooth(T_SHATTER, T_SHATTER + 0.30, t));
        if (kDark > 0.03) {
          unlight(
            p,
            -70,
            -180,
            TX + 95,
            10,
            (x, y) => {
              const dTarget = Math.hypot((x - TX) / 76, (y + 34) / 68);
              return dTarget > 0.45;
            },
            1 - kDark,
          );
        }
      }

      drawMyriadSwordsAndArray(p, true);
      drawAftermathSwordGraveyard(p, true);
      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;

      drawMyriadSwordsAndArray(p, false);
      drawColossalSwordAndImpact(p);
      drawAftermathSwordGraveyard(p, false);

      for (const b of bits.list) rock(p, b, st);

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

function cullBits(bits, x0, y0, x1, y1) {
  const L = bits.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const b = L[i];
    if (b.x < x0 || b.x > x1 || b.y < y0 || b.y > y1) {
      L.splice(i, 1);
    }
  }
}
