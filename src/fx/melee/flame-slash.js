// Crescent slash, impact starburst, ground shockwaves and fire-plume techniques build on Sprite Fusion's
// open-source slash, impact and fire VFX (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, B, Rng, fit, flare, sparkle, clamp, smooth, lerp, ease, tileFbm, loopNoise, TAU, WHITE } from "../../core/index.js";
import { swing, smear, glowAlong, cracks, star, sliver, along, stone, rock } from "./_lib.js";
import { hotFirst, flameTongue, flameBlade, floorLight, simDraw, BIG_LAYERS } from "../fire/_lib.js";

const TX = 186;
const T_SLASH = 0.14;
const T_LAUNCH = 0.16;
const T_HIT = 0.62;
const T_END = 2.25;

export const meta = {
  name: "Flame slash",
  desc: "A greatsword cleaves the floor to unleash an oppressive, scroll-carved crimson-gold flame crescent that scours the earth and erupts through the target in a roaring pillar of fire.",
  tags: ["melee", "fire", "slash", "wave", "crescent", "sword", "ultimate", "combat", "directional", "one-shot"],
  size: [364, 224],
  origin: [58, 186],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#220608", "#4d0b0e", "#881008", "#cc2c16", "#f56e1e", "#ffad38", "#ffe47a", "#fffbe0"],
    ash: ["#6e6264", "#b8aba8", "#f2e8df"],
    stone: "#463a4a",
    seed: 9,
  },
};

// Greatsword stance & heavy lunging cleave (strictly within natural IK arm reach)
const GUARD = { x: 0, weapon: "greatsword", two: true, crouch: 4, lean: 2, fx: 11, fy: -21, sa: -0.95, ffx: 9, fbx: -8 };
const COIL = { ...GUARD, x: -6, crouch: 5, lean: -4, fx: -1, fy: -38, sa: -2.42, ffx: 8, fbx: -9 };
const WHIP = { ...GUARD, x: 5, y: -2, crouch: 2, lean: 4, fx: 15, fy: -35, sa: -1.02, ffx: 11, fbx: -9, ghost: 1 };
const CLEAVE = { ...GUARD, x: 14, crouch: 8, lean: 7, fx: 19, fy: -15, sa: 0.76, ffx: 14, fbx: -10, toeB: true, ghost: 1 };
const FOLLOW = { ...CLEAVE, x: 15, crouch: 7, lean: 6, fx: 20, fy: -17, sa: 0.62, ghost: 0 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.38, GUARD],
    [-0.14, COIL],
    [0.06, { ...COIL, crouch: 6, lean: -5, fy: -39 }],
    [T_SLASH - 0.03, WHIP, "snap"],
    [T_SLASH, CLEAVE, "snap"],
    [T_HIT, FOLLOW],
    [T_HIT + 0.04, { ...FOLLOW, x: 13, crouch: 8 }, "snap"],
    [1.25, { ...GUARD, x: 6, crouch: 4, fx: 15, fy: -20, sa: 0.15 }],
    [1.85, GUARD],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_SLASH, stop: 0.05, shake: 0.14, amp: 2, target: false },
    { t: T_HIT, stop: 0.18, shake: 0.45, amp: 4.4, push: 4.8, straw: 42, y: -22, skin: "char" },
  ],
  dust: [
    { t: T_SLASH, x: 20, n: 9, dir: 1 },
    { t: T_SLASH, x: -10, n: 6, dir: -1 },
  ],
};

// Prebake scalloped threshold-erodible molten fire/smoke puff LUTs (chunky pixel clusters)
const BLAST_LUTS = Array.from({ length: 18 }, (_, r) => {
  if (r < 1) return [];
  const pts = [];
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const ang = Math.atan2(dy, dx);
      const scallop = 1 + 0.16 * Math.sin(ang * 5 + r * 1.1) + 0.10 * Math.cos(ang * 8 - r * 0.7);
      const q = Math.hypot(dx, dy) / (r * scallop);
      if (q > 1) continue;
      const lit = (-dx * 0.45 + dy * 0.45) / Math.max(1, r) + (1 - q) * 0.58;
      pts.push(dx, dy, q, lit);
    }
  }
  return pts;
});

// Perspective ground shockwave ring that modulates organically and breaks into fiery arcs (NEVER a rigid CAD oval!)
function drawFloorBand(p, cx, cy, r, sy, th, progress, alpha, ramp, back, hot = false) {
  if (alpha <= 0.03 || r <= 1 || th <= 0.2) return;
  const rx = r + th + 2, ry = (r + th) * sy + th * 0.6 + 1;
  const x0 = Math.max(-54, Math.floor(cx - rx - 1)), x1 = Math.min(302, Math.ceil(cx + rx + 1));
  const y0 = back ? Math.max(-178, Math.floor(cy - ry - 1)) : Math.floor(cy);
  const y1 = back ? Math.floor(cy) : Math.min(26, Math.ceil(cy + ry + 1));
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
      const wave = 0.72 + 0.34 * Math.sin(ang * 5 + 0.8) + 0.22 * Math.cos(ang * 9 - 1.3);
      // Break cleanly into hand-pixelled shock-arcs as the ring expands!
      if (progress > 0.32 && wave < (progress - 0.32) * 1.45 + 0.32) continue;
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
  const C = fit(o.palette, 8), H = hotFirst(C), ASH = fit(o.ash, 3);
  const st = stone(o.stone);
  const R = new Rng(o.seed), seed = o.seed * 31, floor = () => 0;
  const [W_CV, H_CV] = meta.size, [OX, OY] = meta.origin;
  const X_MIN = -OX + 6, X_MAX = W_CV - OX - 6, Y_MIN = -OY + 6, Y_MAX = H_CV - OY - 4;

  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[7], C[6], C[4]], haze: C[4] });
  const bits = new Bits({ ground: floor }), lights = new Lights();

  const swordSwing = swing({ cx: 10, cy: -26, R: 46, sy: 0.92, rot: 0.24, a0: -2.35, dir: 1 });
  const hitCracks = cracks(R, TX + 6, 9, 72, 7, 0.42);

  const hitSpikes = Array.from({ length: 14 }, (_, i) => {
    const base = (i / 14) * TAU + R.range(-0.06, 0.06);
    const diag = Math.abs(Math.cos(base + 0.62));
    const horiz = Math.abs(Math.cos(base));
    const mul = diag > 0.92 ? 1.92 : horiz > 0.88 ? 1.50 : i % 2 === 0 ? 1.06 : 0.68;
    return { a: base, len: R.range(27, 40) * mul, w: R.range(2.0, 3.2) };
  });
  const hitSlivers = Array.from({ length: 8 }, (_, i) => ({
    a: -1.35 + (i / 7) * 2.25 + R.range(-0.06, 0.06),
    r: 16 + R.range(0, 8),
    v: R.range(175, 275),
    arc: R.range(0.28, 0.48),
  }));

  const blastClouds = Array.from({ length: 26 }, (_, i) => {
    const u = i / 25;
    const fan = (i % 2 === 0 ? -1 : 1) * (9 + u * 24) + R.range(-6, 10);
    return {
      x0: TX + 4 + u * 28 + fan * 0.4,
      y0: -5 - u * 98 + R.range(-5, 5),
      vx: 22 + u * 32 + fan * 1.4,
      vy: -lerp(20, 82, u) + R.range(-9, 9),
      r0: lerp(11.5, 7.5, u),
      r1: lerp(16.5, 13.5, u),
      t0: T_HIT + u * 0.05 + R.range(0, 0.03),
      life: R.range(0.50, 0.88),
    };
  });
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      blastClouds.push({
        x0: TX + 6 + sd * (8 + i * 7),
        y0: -4 - R.range(0, 3),
        vx: sd * lerp(44, 112, i / 3),
        vy: -R.range(4, 14),
        r0: 7.0,
        r1: 12.0,
        t0: T_HIT + i * 0.02,
        life: R.range(0.45, 0.78),
      });
    }
  }

  // Reference-faithful horizontal pale ash-white slipstream speed lines
  const shearRows = [
    { u: 0.90, lenMul: 1.08, thick: 2, bright: true },  // Long streak right off the upper sickle horn!
    { u: 0.62, lenMul: 0.86, thick: 1, bright: true },  // Upper-mid rib streak
    { u: 0.36, lenMul: 0.78, thick: 1, bright: false }, // Lower-mid rib streak
    { u: 0.13, lenMul: 0.94, thick: 2, bright: true },  // Base slipstream streak
  ];

  // Selective crimson & warm-amber ember droplets in the left wake
  const wakeFlecks = Array.from({ length: 11 }, (_, i) => ({
    u: 0.10 + ((i * 7 + 2) % 11) / 11 * 0.76,
    lag: 0.62 + ((i * 5 + 3) % 9) / 8 * 0.52,
    w: i % 3 === 0 ? 3 : 2,
    hot: i % 4 === 0,
    ph: R.range(0, TAU),
  }));

  let t = 0, slashed = false, hitDone = false;

  function waveFrontX(tt) {
    if (tt <= T_HIT) {
      const u = clamp((tt - T_LAUNCH) / (T_HIT - T_LAUNCH));
      const k = 0.24 * u + 0.76 * Math.pow(u, 1.36);
      return lerp(56, TX + 22, k);
    }
    const u2 = clamp((tt - T_HIT) / 0.20);
    return TX + 22 + 58 * ease.outCubic(u2);
  }

  // True circular C-moon outer bow + overhanging leftward sickle tip at u = 0.82..1.00!
  function outerOffset(u, Hc) {
    if (u <= 0.24) {
      const s = (0.24 - u) / 0.24;
      return -Hc * 0.044 * s * s;
    }
    const s = clamp((u - 0.24) / 0.76, 0, 1);
    const extraHook = u > 0.82 ? Math.pow((u - 0.82) / 0.18, 1.65) * Hc * 0.11 : 0;
    return -Hc * 0.72 * (1 - Math.sqrt(Math.max(0, 1 - s * s))) - extraHook;
  }

  // ============================================================================
  // REFERENCE-FAITHFUL FLAME CRESCENT WAVE (火焰斩半月剑气 — Round 3)
  // Slope-connected unbroken upper sickle horn + upward-curling lower golden hook +
  // spiral cloud-scrolls (卷云火纹) + interlocking crimson/soot magma clots!
  // ============================================================================
  function drawFlameCrescent(p, xFront, Hc, growK, shearK) {
    const fade = 1 - smooth(0.56, 1.0, shearK);
    if (fade <= 0.02 || Hc < 14) return;

    const maxW = Math.round(Hc * 1.22);
    const x0 = Math.max(X_MIN, Math.floor(xFront - maxW - 8));
    const x1 = Math.min(X_MAX, Math.ceil(xFront + 6));
    const y0 = Math.max(Y_MIN, Math.floor(-Hc - 2));
    const scrollPhase = t * 11;

    const scrolls = [
      { u: 0.23, d: Hc * 0.155, r: Hc * 0.155, dir: 1 },  // Iconic lower-belly spiral scroll!
      { u: 0.49, d: Hc * 0.115, r: Hc * 0.105, dir: -1 }, // Mid-belly counter-scroll
    ];

    for (let y = y0; y <= 0; y++) {
      const u = -y / Hc;
      if (u < 0 || u > 1.0) continue;

      const bulge = outerOffset(u, Hc);
      const xf = xFront + bulge + shearK * 20 * Math.sin(u * Math.PI);

      // Compute adjacent-row horizontal step so near-horizontal upper sickle horn NEVER breaks into stair-step dots!
      const uBelow = clamp(-(y + 1) / Hc, 0, 1);
      const xfBelow = xFront + outerOffset(uBelow, Hc) + shearK * 20 * Math.sin(uBelow * Math.PI);
      const slopeConnect = Math.max(1.2, Math.abs(xfBelow - xf) + 1.35);

      // 1) TRUE C-CRESCENT GOLDEN SHELL WIDTH + LOWER-BACK UPWARD FLAME HOOK (底部回钩金舌):
      const tipTaper = Math.pow(Math.max(0, 1 - u), 0.52);
      const footProw = Hc * 0.64 * Math.pow(Math.max(0, 1 - u / 0.25), 1.85);
      // Signature upward-curling golden flame hook rising at the back of the foot (u = 0.03..0.18)!
      const backFootHook = Hc * 0.14 * Math.exp(-(((u - 0.11) / 0.055) ** 2));
      const archShell = Hc * 0.20 * Math.sin(Math.PI * Math.pow(u, 0.72)) * tipTaper;

      const lickWave1 = Math.pow(0.5 + 0.5 * Math.sin(u * 19.5 - t * 9.5 + 0.6), 2.4);
      const lickWave2 = Math.pow(0.5 + 0.5 * Math.sin(u * 33.0 + t * 13.0 - 1.2), 2.0);
      const innerTeeth = Hc * (0.11 * lickWave1 + 0.055 * lickWave2) * Math.sin(Math.PI * clamp(u / 0.86, 0, 1));
      const wGold = Math.max(slopeConnect + 0.6, (footProw + backFootHook + archShell + innerTeeth) * (1 - shearK * 0.58));

      // 2) CHUNKY BLOOD-CRIMSON & DARK MAROON INFERNO CRADLED INSIDE THE C-HOLLOW (u in 0.02..0.83!):
      const hollowU = clamp(u / 0.83, 0, 1);
      const hollowEnv = u < 0.83 ? Math.pow(Math.sin(Math.PI * Math.pow(hollowU, 0.78)), 0.72) : 0;
      const nBig = tileFbm(u * 5.6 - t * 4.0, t * 5.0, 16, 16, seed + 11, 3);
      const nMed = tileFbm(u * 13.5 + t * 6.8, t * 8.6 + 2.7, 16, 16, seed + 29, 2);
      const extraFire = Math.max(0, Hc * hollowEnv * (0.68 + 0.26 * nBig + 0.13 * nMed));
      const wFire = wGold + extraFire * (1 - shearK * 0.42);

      // Blinding white-cream leading blade, guaranteed slope-connected all the way to the razor horn tip!
      const wWhite = Math.max(
        slopeConnect * (u > 0.88 ? 0.42 : 0.65),
        (1.5 + Hc * 0.155 * Math.pow(Math.max(0, 1 - u / 0.22), 1.65) + 2.6 * Math.sin(Math.PI * u) * tipTaper) * (1 - shearK * 0.45)
      );

      const rowStart = Math.max(x0, Math.floor(xf - wFire - 2));
      const rowEnd = Math.min(X_MAX, Math.ceil(xf));

      for (let x = rowStart; x <= rowEnd; x++) {
        const d = xf - x;
        if (d < 0) continue;

        if (shearK > 0.08) {
          const shredN = tileFbm((x + y * 0.7) * 0.065, (y - x * 0.4) * 0.065 + t * 4, 16, 16, seed + 73, 2);
          if (d > wWhite * 0.8 && shredN < shearK * 1.45 - 0.42) continue;
        }

        // ZONE A: Incandescent white-cream leading blade & ground-plowing toe
        // At the very top needle tip (u > 0.92), tint cleanly from cream-white to warm gold so the horn gleams!
        if (d <= wWhite) {
          const hornTint = u > 0.93 ? C[6] : d < wWhite * 0.54 ? WHITE : C[7];
          p.dot(x, y, hornTint, fade);
          continue;
        }

        // ZONE B: Golden crescent body with bold carved spiral cloud-scrolls (卷云火纹)
        if (d <= wGold) {
          const qG = (d - wWhite) / Math.max(1, wGold - wWhite);

          // Carve a dark-crimson hollow notch INSIDE the upward-curling lower golden foot hook (d around 0.44..0.56*Hc, u = 0.08..0.18)
          if (u > 0.07 && u < 0.18 && qG > 0.56 && qG < 0.84) {
            const notch = Math.sin(((qG - 0.56) / 0.28) * Math.PI) * Math.sin(((u - 0.07) / 0.11) * Math.PI);
            if (notch > 0.55) {
              p.dot(x, y, C[3], fade); // Vermilion notch makes the rear golden tail visibly hook UPWARD!
              continue;
            }
          }

          let groove = 0;
          let highlight = 0;
          for (let s = 0; s < scrolls.length; s++) {
            const sc = scrolls[s];
            const duS = (u - sc.u) * Hc;
            const ddS = (d - sc.d) * 1.05;
            const rS = Math.hypot(duS, ddS);
            if (rS < sc.r) {
              const nr = rS / sc.r;
              const angS = Math.atan2(duS, ddS) * sc.dir;
              const sp = Math.sin(angS + nr * 7.2 - scrollPhase * 0.20);
              const envS = (1 - nr * 0.82) * (0.45 + 0.55 * Math.sin(nr * Math.PI));
              if (sp > 0.32) groove = Math.max(groove, envS);
              else if (sp < -0.36) highlight = Math.max(highlight, envS);
            }
          }

          const vein = Math.sin(qG * 7.5 - u * 11.5 + scrollPhase * 0.25);
          if (vein > 0.58 && qG > 0.18) groove = Math.max(groove, 0.62);
          else if (vein < -0.62 && qG < 0.65) highlight = Math.max(highlight, 0.5);

          let ci;
          if (u > 0.90) ci = qG < 0.5 ? 6 : 5;              // Crisp golden-amber upper sickle tip!
          else if (groove > 0.30) ci = qG < 0.42 ? 4 : 3;   // Bold orange/vermilion carved scroll line
          else if (highlight > 0.32 || qG < 0.26) ci = 7;   // Cream-white scroll highlight crest
          else if (qG < 0.72) ci = 6;                       // Bright golden-yellow body
          else ci = 5;                                      // Warm amber inner flame rim
          p.dot(x, y, C[ci], fade);
          continue;
        }

        // ZONE C: Interlocking blood-crimson, scarlet & dark-maroon magma clots
        const qF = (d - wGold) / Math.max(1, wFire - wGold);
        const cClot = tileFbm(x * 0.052 + t * 5.2, y * 0.056 - t * 2.0, 16, 16, seed + 47, 3);
        const cDetail = tileFbm(x * 0.12 + t * 8.8, y * 0.12 + 4.1, 16, 16, seed + 89, 2);
        const turb = cClot * 0.72 + cDetail * 0.28;

        if (qF + turb * 0.62 > 0.88) continue;

        const heat = (1 - qF) * 0.56 + turb * 0.72;
        let ci;
        if (heat > 0.64) ci = 4;
        else if (heat > 0.38) ci = 3;
        else if (heat > 0.10) ci = 2;
        else if (heat > -0.14) ci = 1;
        else ci = 0;
        p.dot(x, y, C[ci], fade);
      }
    }

    // 3) Selective crimson-red & amber ember droplets in the left wake
    if (shearK < 0.35) {
      for (let i = 0; i < wakeFlecks.length; i++) {
        const wf = wakeFlecks[i];
        const wy = Math.round(-wf.u * Hc + Math.sin(t * 12 + wf.ph) * 2.0);
        if (wy < Y_MIN + 2 || wy > -3) continue;
        const bulge = outerOffset(wf.u, Hc);
        const drift = ((t * 3.0 + i * 0.21) % 1) * Hc * 0.36;
        const wx = Math.round(xFront + bulge - Hc * wf.lag - drift);
        if (wx < X_MIN + 2 || wx > X_MAX - 2) continue;
        const oa = (1 - drift / (Hc * 0.36)) * fade * growK;
        if (oa <= 0.15) continue;
        const col = wf.hot ? C[5] : C[3];
        for (let dx = 0; dx < wf.w; dx++) p.dot(wx - dx, wy, dx === 0 ? col : C[2], oa);
        if (wf.hot) p.glow(wx, wy, 4, C[4], 0.25 * oa);
      }
    }

    // 4) Bold horizontal pale ash-white wind-shear speed lines streaming off the horn & ribs
    for (let i = 0; i < shearRows.length; i++) {
      const sr = shearRows[i];
      const sy = Math.round(-sr.u * Hc);
      if (sy < Y_MIN + 2) continue;
      const bulge = outerOffset(sr.u, Hc);
      const sx1 = xFront + bulge - (i === 0 ? 0 : Hc * 0.10);
      const len = Hc * sr.lenMul * (0.88 + 0.12 * Math.sin(t * 20 + i * 1.9)) * growK;
      const sx0 = Math.max(X_MIN, sx1 - len);
      if (sx1 <= sx0 + 4) continue;
      const lCol = sr.bright ? ASH[2] : ASH[1];
      const baseA = (sr.bright ? 0.72 : 0.46) * fade;
      for (let x = Math.floor(sx0); x <= Math.ceil(sx1); x++) {
        const lk = (x - sx0) / (sx1 - sx0);
        p.blend(x, sy, lCol, baseA * Math.pow(lk, 1.25));
        if (sr.thick > 1 && lk > 0.42) {
          p.blend(x, sy + 1, i === 0 ? C[6] : ASH[1], baseA * 0.42 * lk);
        }
      }
    }

    // 5) Razor-sharp incandescent white-gold ground-scouring cut beam along y = 0 (+16px ahead, -112px behind!)
    const toeX = xFront - Hc * 0.044;
    const beamR = Math.min(X_MAX - 2, toeX + 16);
    const beamL = Math.max(X_MIN + 2, toeX - Hc * 1.04);
    for (let x = Math.floor(beamL); x <= Math.ceil(beamR); x++) {
      const k = x > toeX ? 1 - (x - toeX) / 16 : (x - beamL) / Math.max(1, toeX - beamL);
      if (k <= 0) continue;
      const col = k > 0.50 ? WHITE : k > 0.26 ? C[7] : k > 0.13 ? C[5] : C[3];
      p.dot(x, 0, col, fade);
      if (k > 0.36) p.dot(x, -1, k > 0.70 ? WHITE : C[6], fade * 0.92);
      if (k > 0.32 && ((x * 11 + Math.floor(t * 30)) & 15) < 3) {
        p.dot(x, 1, C[6], fade * 0.85);
        p.dot(x - 1, 2, C[3], fade * 0.65);
      }
    }

    p.glow(toeX - Hc * 0.16, -Hc * 0.34, Hc * 0.74, C[4], 0.40 * fade);
    p.glow(toeX - 2, -8, 30, C[6], 0.56 * fade);
  }

  function drawBlastClouds(p) {
    for (let i = 0; i < blastClouds.length; i++) {
      const bc = blastClouds[i];
      const age = t - bc.t0;
      if (age <= 0 || age >= bc.life) continue;
      const u = age / bc.life;
      const drag = (1 - Math.exp(-2.8 * age)) / 2.8;
      const cx = Math.round(bc.x0 + bc.vx * drag);
      const cy = Math.round(bc.y0 + bc.vy * age);
      if (cx < X_MIN + 12 || cx > X_MAX - 12 || cy < Y_MIN + 14 || cy > 8) continue;

      const r = clamp(Math.round(lerp(bc.r0, bc.r1, 1 - Math.pow(1 - u, 2.2))), 1, 17);
      const lut = BLAST_LUTS[r];
      if (!lut.length) continue;

      const cut = 1.0 - Math.pow(u, 1.32) * 0.85;
      const cool = u * 1.22;

      for (let k = 0; k < lut.length; k += 4) {
        const edgeQ = lut[k + 2];
        if (edgeQ > cut) continue;
        const heat = lut[k + 3] - cool;
        const ci =
          heat > 0.72 ? 7 :
          heat > 0.48 ? 6 :
          heat > 0.25 ? 5 :
          heat > 0.04 ? 4 :
          heat > -0.18 ? 3 :
          heat > -0.42 ? 2 :
          heat > -0.68 ? 1 : 0;
        const px = cx + lut[k], py = cy + lut[k + 1];
        if (py > 2 || py < Y_MIN || px < X_MIN || px > X_MAX) continue;
        p.dot(px, py, C[ci], u > 0.75 ? (1 - u) * 4 : 1);
      }
    }
  }

  function drawEruptionColumn(p, q) {
    const gk = q < 0.075 ? ease.outQuart(q / 0.075) : 1 - smooth(0.18, 0.72, q);
    if (gk <= 0.05) return;
    const fullH = Math.min(162, 156 * gk);
    const baseW = 22 * gk;
    const invH = 1 / Math.max(1, fullH);

    for (let y = 1; y >= -fullH; y--) {
      const v = clamp(-y * invH, 0, 1);
      const cx = TX + 6 + 34 * Math.pow(v, 1.12) + Math.sin(v * 8.5 - t * 22) * (2.5 + 4.5 * v);
      const nEdge = tileFbm(v * 9.0 - t * 7.0, t * 5.0, 16, 16, seed + 199, 2);
      const hw = Math.max(0.5, baseW * Math.pow(1 - v, 0.68) * (1 + 0.35 * (y > -14 ? (1 + y / 14) ** 2 : 0)) + nEdge * 3.8 * gk);

      const xL = Math.max(X_MIN, Math.floor(cx - hw)), xR = Math.min(X_MAX, Math.ceil(cx + hw));
      for (let x = xL; x <= xR; x++) {
        const qx = Math.abs(x - cx) / hw;
        if (q > 0.28) {
          const erode2D = tileFbm(x * 0.075 + 2.3, y * 0.068 + t * 6.5, 16, 16, seed + 211, 2);
          if (erode2D < (q - 0.28) * 1.95 + (qx * 0.45 + v * 0.48) - 0.58) continue;
        }
        const swirl = 0.5 + 0.5 * Math.sin((x - cx) * 0.28 + v * 11 - t * 24);
        let ci;
        if (qx < 0.28 && v < 0.68 && q < 0.38) ci = 7;
        else if (qx < 0.52 && swirl > 0.38) ci = v < 0.55 ? 7 : 6;
        else if (qx < 0.76) ci = v < 0.65 ? 5 : 4;
        else ci = v < 0.5 ? 4 : 3;
        if (q > 0.38) ci = Math.max(2, ci - Math.floor((q - 0.38) * 5));
        p.dot(x, y, qx < 0.16 && q < 0.18 && v < 0.45 ? WHITE : C[ci]);
      }
    }

    const NZ = (rate, s0, off = 0) => loopNoise(t * rate * 0.16 + off * 0.1, 1.4, s0);
    flameTongue(p, TX - 12, 1, 86 * gk, 9.5 * gk, -12 * gk, NZ, seed + 131, H, BIG_LAYERS, 0.8, 1.5);
    flameBlade(p, TX + 16, -8, 0.78, -0.62, 88 * gk, 7.5 * gk, -6, NZ, seed + 179, H, BIG_LAYERS);
  }

  return {
    update(dt) {
      t += dt;

      if (t < T_SLASH - 0.02 && R.chance(0.6 * dt * 60)) {
        const a = R.range(0, TAU), d = R.range(16, 34);
        ps.spawn(P.STREAK, 2 + Math.cos(a) * d, -46 + Math.sin(a) * d, -Math.cos(a) * 235, -Math.sin(a) * 235, 0.07, R.chance(0.5) ? C[7] : C[5]);
      }

      if (!slashed && t >= T_SLASH) {
        slashed = true;
        lights.add(38, -14, 66, C[5], 0.78, 0.26);
        for (let i = 0; i < 22; i++) {
          const a = -Math.PI / 2 + R.range(-0.4, 1.25), sp = R.range(125, 290);
          ps.spawn(P.SPARK, 38, -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.15, 0.34));
        }
      }

      if (t >= T_LAUNCH && t <= T_HIT) {
        const xf = waveFrontX(t);
        if (R.chance(0.42 * dt * 60)) {
          const u = R.range(0.08, 0.78);
          const b = outerOffset(u, 116);
          ps.spawn(P.EMBER, xf + b - R.range(36, 82), -u * 114, -R.range(55, 135), R.range(-18, 10), R.range(0.24, 0.46), R.pick([C[4], C[3]]), 1);
        }
        if (R.chance(0.8 * dt * 60)) {
          ps.spawn(P.SPARK, xf - R.range(2, 12), -1, R.range(-85, 95), -R.range(50, 145), R.range(0.12, 0.26));
          ps.spawn(P.GRIT, xf - 5, -1, R.range(-60, 80), -R.range(55, 145), R.range(0.42, 0.8), R.pick([st.light, st.body, C[5]]), 1);
        }
      }

      if (!hitDone && t >= T_HIT) {
        hitDone = true;
        lights.add(TX + 10, -48, 126, C[5], 0.90, 0.56);
        lights.add(TX + 6, -24, 60, WHITE, 0.96, 0.14);

        for (let i = 0; i < 54; i++) {
          const fwd = R.chance(0.76);
          const a = (fwd ? -0.48 : -Math.PI + 0.45) + R.range(-0.8, 0.8);
          const sp = R.range(155, 385) * (fwd ? 1 : 0.65);
          ps.spawn(P.SPARK, TX + R.range(-6, 14), -R.range(2, 58), Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.52));
        }
        for (let i = 0; i < 30; i++) {
          ps.spawn(P.EMBER, TX + R.range(-12, 32), -R.range(4, 108), R.range(-45, 110), -R.range(40, 128), R.range(0.55, 1.15), R.pick([C[7], C[6], C[4]]), R.chance(0.42) ? 2 : 1);
        }
        for (let i = 0; i < 11; i++) {
          const a = -Math.PI / 2 + R.range(-0.8, 1.05), sp = R.range(115, 255);
          bits.add({
            kind: B.CHUNK, x: TX + R.range(-6, 14), y: -3,
            vx: Math.cos(a) * sp + 28, vy: Math.sin(a) * sp,
            g: 1, drag: 0.45, bounce: 0.34, life: R.range(0.85, 1.35),
            a: R.range(0, TAU), va: R.range(-15, 15), s: R.pick([1, 2, 2, 3]),
          });
        }
        for (let i = 0; i < 34; i++) {
          const a = -Math.PI / 2 + R.range(-0.85, 1.1), sp = R.range(80, 230);
          ps.spawn(P.GRIT, TX + R.range(-6, 14), -1, Math.cos(a) * sp + 22, Math.sin(a) * sp, R.range(0.65, 1.2), R.pick([st.light, st.body, C[5]]), R.chance(0.4) ? 2 : 1);
        }
      }

      bits.update(dt);
      ps.update(dt);
      for (let i = ps.list.length - 1; i >= 0; i--) {
        const q = ps.list[i];
        if (q.x < X_MIN || q.x > X_MAX || q.y < Y_MIN || q.y > Y_MAX) ps.list.splice(i, 1);
      }
      for (let i = bits.list.length - 1; i >= 0; i--) {
        const q = bits.list[i];
        if (q.x < X_MIN || q.x > X_MAX || q.y < Y_MIN || q.y > Y_MAX) bits.list.splice(i, 1);
      }
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-6) return;

      if (t >= T_LAUNCH) {
        const reachX = Math.min(TX + 52, waveFrontX(t));
        const fade = 1 - smooth(T_END - 0.65, T_END - 0.1, t);
        if (fade > 0.02) {
          for (let x = 34; x <= reachX; x++) {
            const age = Math.max(0, t - lerp(T_LAUNCH, T_HIT, clamp((x - 56) / (TX + 22 - 56))));
            const hot = clamp(Math.exp(-age * 2.1));
            p.blend(x, 1, C[0], 0.74 * fade);
            p.blend(x, 2, C[0], 0.46 * fade);
            const cCol = hot > 0.72 ? C[7] : hot > 0.45 ? C[5] : hot > 0.22 ? C[3] : C[1];
            p.dot(x, 0, cCol, fade);
            if ((x & 3) === 0 && hot > 0.24) p.dot(x, 1, hot > 0.55 ? C[5] : C[2], fade * 0.85);
          }
          floorLight(p, (38 + reachX) * 0.5, 0.5, (reachX - 38) * 0.55 + 18, 7, C[4], 0.28 * fade * clamp(1.3 - (t - T_HIT) * 0.8));
        }
      }

      if (t >= T_HIT) {
        const q = (t - T_HIT) / 0.46;
        if (q < 1) {
          const r = 12 + 102 * ease.outQuart(q);
          drawFloorBand(p, TX + 6, 0.5, r, 0.17, Math.max(1, 4.8 * (1 - q)), q, 1 - smooth(0.52, 1, q), [C[2], C[4], C[6], C[7]], true, q < 0.16);
        }
      }

      simDraw(p, ps, H, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;

      // 1) Raised greatsword ignition glint, downward cleave arc & floor-strike birth flash!
      if (t < T_SLASH + 0.02) {
        const gk = Math.sin(clamp(t / T_SLASH) * Math.PI);
        sparkle(p, 2, -48, 11 * gk, WHITE, C[5], 0.75);
        p.glow(2, -48, 26, C[4], 0.42 * gk);
      }
      if (t >= T_SLASH - 0.03 && t < T_SLASH + 0.15) {
        const su = clamp((t - (T_SLASH - 0.03)) / 0.055);
        const stail = smooth(T_SLASH + 0.025, T_SLASH + 0.15, t);
        const U = 2.45 * ease.outExpo(su), T = 2.45 * stail;
        if (U - T > 0.04) {
          smear(p, swordSwing, T, U, 19 * (1 - stail * 0.6), (uu, r, out) => {
            const v = (uu - T) / (U - T);
            const w = 19 * (1 - stail * 0.6) * Math.sin(Math.PI * Math.pow(v, 1.5));
            const q = (swordSwing.R - r) / Math.max(0.5, w);
            if (q < 0 || q > 1) return;
            out.c = q < 0.22 ? WHITE : C[7 - clamp(Math.round(q * 5 + stail * 2), 0, 7)];
            out.a = Math.min(1, v / 0.28);
          });
          glowAlong(p, swordSwing, swordSwing.R - 6, T, U, 14, C[5], 0.3 * (1 - stail));
        }
      }
      // Floor-slam ignition burst right where the greatsword rips the earth open (0.14s .. 0.19s)!
      if (t >= T_SLASH && t < T_SLASH + 0.055) {
        const bk = 1 - (t - T_SLASH) / 0.055;
        p.beam(22, -1, 56, -1, 3.2 * bk, WHITE);
        p.beam(36, 0, 52, -34 * bk, 2.6 * bk, C[7]);
        flare(p, 40, -3, 28 * bk, bk, [C[4], C[6], C[7], WHITE]);
      }

      // 2) THE REFERENCE-FAITHFUL FLAME CRESCENT WAVE (0.15s -> 0.82s)
      if (t >= T_LAUNCH - 0.01 && t < T_HIT + 0.20) {
        const launchGrow = ease.outBack(clamp((t - (T_LAUNCH - 0.01)) / 0.085), 1.32);
        const surgeSwell = 1 + 0.12 * clamp((t - T_LAUNCH) / (T_HIT - T_LAUNCH));
        const shearK = t > T_HIT ? clamp((t - T_HIT) / 0.20) : 0;
        const Hc = Math.min(132, 110 * launchGrow * surgeSwell * (1 + shearK * 0.10));
        drawFlameCrescent(p, waveFrontX(t), Hc, clamp(launchGrow), shearK);
      }

      // 3) ON-HIT RESULT: Broken Shockwave Arcs + Scalloped Blast Plume + Roaring Flame Pillar + Lingering Bisecting Cut!
      if (t >= T_HIT) {
        const q = t - T_HIT;
        const scarFade = 1 - smooth(T_END - 0.65, T_END - 0.12, t);
        const crackHeat = Math.pow(clamp(1 - q / 1.18), 1.2);

        if (scarFade > 0.03) {
          for (const c of hitCracks) {
            const reach = 72 * ease.outCubic(clamp((q - c.at * 0.06) / 0.1)) * (c.fork ? 0.42 : 1);
            if (reach > 0) {
              along(c.pts, reach, (x0, y0, x1, y1, d) => {
                if (y0 + 1 > Y_MAX - 2 || y1 + 1 > Y_MAX - 2 || x1 > X_MAX - 2) return;
                const lh = crackHeat * (1 - d / 82);
                const col = lh > 0.7 ? WHITE : lh > 0.48 ? C[7] : lh > 0.28 ? C[5] : lh > 0.12 ? C[3] : C[0];
                p.line(x0, y0 + 1, x1, y1 + 1, col, scarFade);
              });
            }
          }
        }

        // Fast, thick, broken shock-dome arcs (0.01 .. 0.15s)
        const dk = (q - 0.01) / 0.14;
        if (dk >= 0 && dk < 1) {
          const dr = 16 + 52 * ease.outQuart(dk), dth = Math.max(2.0, 5.8 * (1 - dk));
          p.shade(TX + 6 - dr - 2, -dr - 2, Math.min(X_MAX - 2, TX + 6 + dr + 2), 0, (x, y, out) => {
            const dx = x - (TX + 6);
            const e = dr - Math.hypot(dx, y);
            if (e < 0 || e > dth || y > -0.5) return;
            const ang = Math.atan2(y, dx);
            if (Math.sin(ang * 3.5 + 0.4) < -0.25 + dk * 0.55) return;
            out.c = e < dth * 0.38 ? WHITE : e < dth * 0.72 ? C[7] : C[5];
            out.a = 1;
          });
        }

        if (q < 0.46) {
          const rk = q / 0.46;
          const r = 12 + 102 * ease.outQuart(rk);
          drawFloorBand(p, TX + 6, 0.5, r, 0.17, Math.max(1, 4.8 * (1 - rk)), rk, 1 - smooth(0.52, 1, rk), [C[2], C[4], C[6], C[7]], false, rk < 0.16);
        }

        drawBlastClouds(p);
        if (q < 0.72) drawEruptionColumn(p, q);

        // Double-tapered razor sword-qi cleave scar slicing cleanly across the target (0 .. 0.13s — sharp needle tips, NEVER a blunt rod!)
        if (q < 0.13) {
          const sk = 1 - q / 0.13;
          const xA = TX - 46, yA = 0, xB = Math.min(X_MAX - 6, TX + 82), yB = -126;
          const dxS = xB - xA, dyS = yB - yA, lenS = Math.hypot(dxS, dyS);
          const nxS = -dyS / lenS, nyS = dxS / lenS;
          const steps = Math.ceil(lenS * 1.4);
          const maxHalfW = 0.6 + 3.4 * sk * sk;
          for (let s = 0; s <= steps; s++) {
            const uS = s / steps;
            // Peak width near target torso (uS ~ 0.34), tapering to a 1px razor point at both ends!
            const profile = Math.sin(Math.PI * Math.pow(uS, 0.78));
            const hwS = maxHalfW * profile;
            const bx = xA + dxS * uS, by = yA + dyS * uS;
            const span = Math.ceil(hwS);
            for (let w = -span; w <= span; w++) {
              if (Math.abs(w) > hwS + 0.25) continue;
              const core = Math.abs(w) <= hwS * 0.45;
              const col = q < 0.045 ? (core ? WHITE : C[7]) : q < 0.09 ? (core ? C[7] : C[5]) : C[4];
              p.dot(Math.round(bx + nxS * w), Math.round(by + nyS * w), col, sk > 0.35 ? 1 : sk / 0.35);
            }
          }
        }

        if (q >= 0.02 && q < 0.22) {
          const sk = (q - 0.02) / 0.20;
          for (const sl of hitSlivers) {
            sliver(p, TX + 8, -36, sl.a, sl.r + sl.v * (q - 0.02), sl.arc * (1 - 0.4 * sk), sk < 0.4 ? C[7] : sk < 0.75 ? C[5] : C[3], 1 - sk);
          }
        }

        // 2-Frame Hero Impact Starburst + Ground Crater Flash!
        if (q < 0.068) {
          const hot = q < 0.034;
          const hk = 1 - q / 0.068;
          p.beam(TX - 42 * hk, -1, Math.min(X_MAX - 4, TX + 58 * hk), -1, hot ? 4.4 : 2.6, WHITE);
          star(p, TX + 6, -36, hitSpikes, hot ? 1 : 1.28, hot ? 1 : 0.58, WHITE, C[6], C[7], C[4]);
          flare(p, TX + 6, -36, 62 * hk, hk, [C[3], C[5], C[7], WHITE]);
          flare(p, TX + 6, -4, 38 * hk, hk * 0.9, [C[4], C[6], WHITE]);
        }
      }

      for (const b of bits.list) rock(p, b, st);
      simDraw(p, ps, H, "front");
      lights.draw(p);
    },
  };
}
