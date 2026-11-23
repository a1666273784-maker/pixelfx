// Boss Ground-Hugging Crimson Glare & Triple Spiralling Flame Pillars ("moves/crimson-spire-chain"):
// 1. Downward Compression & Pale-Grey/Crimson Ground Air-Wave (0.00..0.44s): A heavy mass of dark-crimson energy and
//    blinding flowing-gold light compresses violently downward in front of the Boss, slamming the floor at t = 0.28s
//    and detonating a colossal ground-hugging mixed pale-grey ("苍灰色") and crimson ("赤色") shock air-wave.
// 2. High-Luminance Crimson-Gold Ground Ray & 3 Sequential Spiralling Flame Pillars (0.30..1.88s): A searing
//    crimson-gold ray races forward along the floor; along its path, three colossal vertical pillars of interwoven
//    deep-crimson and flowing-gold spiralling flames erupt sequentially skyward (at x = 70, 128, and 186).
// 3. Oppressive Enemy Hit — Bottom-to-Top Gold-Red Streamers & Blinding White Flash (0.68..1.85s): The third pillar
//    erupts directly beneath the enemy, driving a high-density bottom-to-top rush of gold-red light streamers and
//    blinding white hit-flash bursts with heavy hit-stop, screen shake, and arena darkening.
// 4. Scorched Floor Aftermath — Glowing Dark-Red Light Band, Charred-Black Ash & Bluish-Grey Smoke (1.65..4.10s):
//    After the pillars subside, a persistent dark-red glowing hot light band lingers along the floor, continuously
//    wafting upward charred-black ash particles ("焦黑色的灰烬粒子") and translucent bluish-grey light smoke ("青灰轻烟").
// Fire tongues, pillars, sparks and shockwave recipes build on Sprite Fusion's open-source fire & explosion VFX
// (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import {
  Particles,
  Lights,
  P,
  PF,
  Rng,
  fit,
  band,
  flare,
  sparkle,
  clamp,
  smooth,
  lerp,
  ease,
  noise,
  fract,
  hex,
  TAU,
  WHITE,
  READY,
} from "../../core/index.js";
import { hotFirst, flameTongue, flameBlade, simDraw, floorLight, LAYERS } from "../fire/_lib.js";
import { unlight } from "../shadow/_lib.js";

const SX = 18;                 // Ground slam & ray origin X in front of the Boss
const TX = 186;                // Enemy standing X
const SLIDE_1 = 10;
const SLIDE_2 = 18;
const SLIDE_3 = 24;            // Total knockback slide distance
const RAY_END_X = TX + 36;     // Ground ray reaches slightly past the enemy

// Choreography timing constants (seconds)
const T_SLAM = 0.28;           // Compressed dark-crimson & gold energy slams into the floor
const T_RAY_DONE = 0.68;       // High-luminance crimson-gold ground ray reaches TX
const T_P1 = 0.44;             // Pillar 1 erupts at x = 70
const T_P2 = 0.56;             // Pillar 2 erupts at x = 128
const T_HIT = 0.68;            // Pillar 3 erupts under the Enemy at x = 186 (Primary Hit)
const T_HIT2 = 0.88;           // Second upward gold-red streamer surge & white flash
const T_HIT3 = 1.08;           // Third terminal upward surge & white flash
const T_PILLAR_END = 1.88;     // All three spiralling flame pillars finish collapsing
const T_END = 4.10;

const SY = 0.20;
const CHAR_BLACK = hex("#08050a");
const CHAR_DARK = hex("#1a1118");

export const meta = {
  name: "Crimson spire chain",
  desc: "Dark-crimson and gold energy slams into a grey-crimson ground wave, racing a crimson-gold ray that erupts three spiralling flame pillars with white hit flashes and ash.",
  tags: ["move", "boss", "fire", "pillar", "crimson", "gold", "spiral", "ground", "ash", "smoke", "one-shot"],
  size: [424, 240],
  origin: [84, 198],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    // 9-step deep crimson-red -> blood-scarlet -> blazing orange-red -> white ramp
    palette: ["#140205", "#38050c", "#6c0916", "#a81220", "#dc2428", "#ff522e", "#ff9240", "#ffd478", "#ffffff"],
    // 7-step flowing-gold ("流金色") ramp
    gold: ["#281204", "#5c2c08", "#9c500e", "#d88218", "#f8b828", "#ffe468", "#fff9d2"],
    // 6-step pale-grey / bluish-grey ("苍灰色 / 青灰轻烟") ramp
    ash: ["#10131a", "#222734", "#3b4356", "#5c6780", "#8895b0", "#c4d0de"],
    seed: 21,
  },
};

// Boss caster choreography: guard -> high overhead gather -> violent ground-compress slam -> channel -> recovery
const GUARD = { ...READY, x: 0, crouch: 2, lean: 1, fx: 11, fy: -21, bx: 9, by: -21, ffx: 8, fbx: -8 };
const RAISE = { ...READY, x: -4, crouch: 3, lean: -4, turn: 0.85, hy: -2, fx: 4, fy: -35, bx: 10, by: -33, armsFront: true, ffx: 7, fbx: -9 };
const SLAM = { ...READY, x: 6, crouch: 9, lean: 7, turn: 0.55, hy: 3, fx: 15, fy: -11, bx: 9, by: -12, ffx: 11, fbx: -8, ghost: 1 };
const CHANNEL = { ...READY, x: 7, crouch: 8, lean: 6, turn: 0.48, hy: 2, fx: 16, fy: -13, bx: 10, by: -14, ffx: 11, fbx: -8, ghost: 0 };
const SURGE_UP = { ...READY, x: 8, crouch: 3, lean: 2, turn: 0.40, hy: -1, fx: 18, fy: -26, bx: 11, by: -23, ffx: 11, fbx: -8, ghost: 1 };
const RECOVER = { ...READY, x: 3, crouch: 3, lean: 1, fx: 13, fy: -21, bx: 9, by: -21, ffx: 8, fbx: -8 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.28, GUARD],
    [-0.06, RAISE],
    [T_SLAM - 0.04, { ...RAISE, fy: -37, by: -35, lean: -5 }],
    [T_SLAM, SLAM, "snap"],
    [T_P2, CHANNEL],
    [T_HIT, SURGE_UP, "snap"],
    [T_HIT3 + 0.35, { ...SURGE_UP, ghost: 0, fy: -24 }],
    [2.35, RECOVER],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_SLAM, stop: 0.06, shake: 0.32, amp: 3.6, target: false },
    { t: T_P1, stop: 0.02, shake: 0.20, amp: 2.2, target: false },
    { t: T_P2, stop: 0.03, shake: 0.24, amp: 2.8, target: false },
    { t: T_HIT, stop: 0.17, shake: 0.56, amp: 5.6, push: 5.2, slide: SLIDE_1, straw: 40, y: -28, skin: "red", shiver: 0.52, flash: 0.07 },
    { t: T_HIT2, stop: 0.06, shake: 0.38, amp: 4.5, push: 4.4, slide: SLIDE_2, straw: 28, y: -32, skin: "char", shiver: 0.54, flash: 0.07 },
    { t: T_HIT3, stop: 0.08, shake: 0.46, amp: 5.0, push: 4.8, slide: SLIDE_3, daze: 1.40, straw: 34, y: -26, skin: "red", shiver: 0.60, flash: 0.08 },
    { t: 1.85, push: 0, straw: 0, flash: 0, skin: "char" },
    { t: T_END - 0.32, push: 0, straw: 0, flash: 0, skin: null, daze: 0 },
  ],
  dust: [
    { t: T_SLAM, x: SX - 10, n: 9, dir: -1 },
    { t: T_SLAM, x: SX + 10, n: 9, dir: 1 },
    { t: T_P1, x: 70, n: 7, dir: 1 },
    { t: T_P2, x: 128, n: 8, dir: 1 },
    { t: T_HIT, x: TX + 4, n: 12, dir: 1 },
  ],
};

// Safe local bounds inside [424, 240] with origin [84, 198] -> x in [-84..339], y in [-198..41]
const X_MIN = -78, X_MAX = 332, Y_MIN = -190, Y_MAX = 34;

// Sinuous, translucent Bluish-Grey Light Smoke Wisp Plume ("青灰轻烟") rising from the scorched floor band
function drawBluishSmokeWisp(p, x0, yBase, h, w0, swayPhase, t, uLife, Ash) {
  const fade = Math.sin(Math.min(1, uLife * 3.2) * (Math.PI / 2)) * (1 - smooth(0.48, 1.0, uLife));
  if (fade <= 0.02 || h < 4) return;
  const rows = Math.ceil(h);
  for (let r = 0; r <= rows; r++) {
    const v = r / Math.max(1, h);
    const py = Math.round(yBase - r);
    if (py < Y_MIN + 4 || py > 2) continue;

    // Gentle S-curve thermal drift as the light smoke rises
    const sway = Math.sin(v * Math.PI * 2.2 - t * 4.8 + swayPhase) * (3.5 + 6.5 * v);
    const cx = x0 + sway + v * 5.0;
    const env = Math.sin(v * Math.PI) * (0.55 + 0.65 * v);
    const hw = w0 * env;
    if (hw < 0.6) continue;

    const ix0 = Math.max(X_MIN + 4, Math.floor(cx - hw));
    const ix1 = Math.min(X_MAX - 4, Math.ceil(cx + hw));
    for (let px = ix0; px <= ix1; px++) {
      const q = Math.abs(px - cx) / hw;
      if (q > 1) continue;
      const a = fade * (1 - q * q) * 0.46;
      if (a <= 0.02) continue;
      const col = q < 0.38 && v > 0.35 ? Ash[4] : q < 0.72 ? Ash[3] : Ash[2];
      p.blend(px, py, col, a);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 9);
  const H = hotFirst(C);
  const G = fit(o.gold, 7);
  const Ash = fit(o.ash, 6);
  const R = new Rng(o.seed);
  const seed = o.seed * 29;
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, G[5], G[4], C[4]],
    haze: C[4],
  });
  const lights = new Lights();

  // Enemy current X position accounting for knockback slide
  const enemyX = (time) => {
    if (time < T_HIT) return TX;
    if (time < T_HIT2) return lerp(TX, TX + SLIDE_1, ease.outCubic(clamp((time - T_HIT) / 0.16)));
    if (time < T_HIT3) return lerp(TX + SLIDE_1, TX + SLIDE_2, ease.outCubic(clamp((time - T_HIT2) / 0.16)));
    return lerp(TX + SLIDE_2, TX + SLIDE_3, ease.outCubic(clamp((time - T_HIT3) / 0.22)));
  };

  // Three sequential spiralling crimson-gold flame pillars along the ground ray
  const pillars = [
    { idx: 0, x: 70, tErupt: T_P1, tFall: 1.30, tGone: 1.62, hMax: 126, wBase: 14.0, spin: 1, seed: seed + 11, erupted: false },
    { idx: 1, x: 128, tErupt: T_P2, tFall: 1.42, tGone: 1.74, hMax: 144, wBase: 15.8, spin: -1, seed: seed + 37, erupted: false },
    { idx: 2, x: TX, tErupt: T_HIT, tFall: 1.54, tGone: T_PILLAR_END, hMax: 164, wBase: 18.0, spin: 1, seed: seed + 73, erupted: false },
  ];

  // Prebake 36 pale-grey & crimson ground-hugging air-wave puffs ("贴地炸开一圈巨大的苍灰色与赤色混合气浪")
  const groundWavePuffs = Array.from({ length: 36 }, (_, i) => {
    const dir = i % 2 === 0 ? 1 : -1;
    const isCrimson = i % 2 === 0;
    const dist = R.range(24, 82) * dir;
    const yOff = R.range(-10, 0);
    const r0 = R.range(4.5, 7.5);
    const r1 = R.range(9.5, 14.0);
    const dur = R.range(0.34, 0.56);
    return { dist, yOff, r0, r1, dur, isCrimson };
  });

  // Prebake 56 high-density bottom-to-top gold-red impact streamers on the enemy ("自下而上的高密度的金红流光冲击")
  const goldRedStreamers = Array.from({ length: 56 }, (_, i) => {
    const isGold = i % 2 === 0;
    const waveIdx = i % 3;
    const tWave = waveIdx === 0 ? T_HIT : waveIdx === 1 ? T_HIT2 : T_HIT3;
    const t0 = tWave + R.range(0.0, 0.16);
    const dur = R.range(0.20, 0.36);
    const ox = R.range(-22, 22);
    const yStart = R.range(-4, 2);
    const yEnd = -R.range(95, 168);
    const len = R.range(22, 40);
    const w = R.range(1.2, 2.4);
    return { isGold, t0, dur, ox, yStart, yEnd, len, w };
  });

  // Prebake 24 sinuous curling bluish-grey light smoke wisps ("青灰轻烟") rising from the scorched floor band
  const smokeWisps = Array.from({ length: 24 }, (_, i) => {
    const uX = i / 23;
    const x0 = lerp(SX + 4, RAY_END_X - 4, uX) + R.range(-5, 5);
    const t0 = R.range(1.30, 2.30);
    const life = Math.min(R.range(1.45, 2.10), T_END - 0.08 - t0);
    const hMax = R.range(42, 78);
    const w0 = R.range(4.2, 6.8);
    const phase = R.range(0, TAU);
    return { x0, t0, life, hMax, w0, phase };
  });

  // Prebake 125 charred-black ash particles rising from the glowing dark-red floor band ("不断向上飘起焦黑色的灰烬粒子")
  const charredAsh = Array.from({ length: 125 }, (_, i) => {
    const x0 = R.range(SX - 2, RAY_END_X + 2);
    const y0 = R.range(-4, 1);
    const t0 = R.range(1.20, 2.70);
    const life = Math.min(R.range(1.15, 1.90), T_END - 0.08 - t0);
    const vy = -R.range(28, 72);
    const vx = R.range(-9, 13);
    const swayAmp = R.range(4.0, 10.5);
    const swayFreq = R.range(4.5, 8.5);
    const phase = R.range(0, TAU);
    const sz = R.range(1.4, 2.6);
    const rimKind = i % 3;
    return { x0, y0, t0, life, vx, vy, swayAmp, swayFreq, phase, sz, rimKind };
  });

  let t = 0;
  let slammed = false;
  let hit2Done = false, hit3Done = false;

  const capLife = (l) => Math.max(0.08, Math.min(l, T_END - 0.10 - t));

  // PHASE 1: Heavy Dark-Red Energy & Flowing-Gold Glare Compressing Downward -> Colossal Pale-Grey & Crimson Ground Air-Wave
  function drawCompressionAndGroundWave(p, isBack) {
    // 1A. Downward Compression (0.00 .. T_SLAM = 0.28s)
    if (t < T_SLAM + 0.05) {
      const u = clamp(t / T_SLAM);
      const crush = ease.inCubic(u);
      const cy = lerp(-56, -6, crush);
      const rx = lerp(22, 36, crush);
      const ry = lerp(24, 6.5, crush);
      const fade = 1 - smooth(T_SLAM, T_SLAM + 0.05, t);
      const keepFn = isBack ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0;

      // Two downward-crushing gravity compression rings around the falling dark-crimson & gold mass
      for (let k = 0; k < 2; k++) {
        const ph = fract(t * 4.5 + k * 0.5);
        const rRing = lerp(42, 16, ph);
        const yRing = lerp(-66, -3, ease.inQuad(ph));
        band(
          p,
          SX,
          yRing,
          rRing,
          0.24,
          Math.max(1.2, 3.5 * (1 - ph)),
          Math.sin(ph * Math.PI) * fade,
          k === 0 ? [C[2], C[4], G[4], WHITE] : [C[1], C[3], C[5], G[5]],
          keepFn,
        );
      }

      if (!isBack) {
        // Heavy Dark-Crimson outer energy mass pressing downward (strictly elliptical so it never exceeds y = 20!)
        p.ellipse(SX, cy, rx * 1.15, ry * 1.15, C[1]);
        p.ellipse(SX, cy, rx * 0.94, ry * 0.94, C[2]);
        p.ellipse(SX, cy, rx * 0.74, ry * 0.74, C[4]);
        p.ellipse(SX, cy, rx * 0.52, ry * 0.54, G[4]);
        p.ellipse(SX, cy, rx * 0.30, ry * 0.34, WHITE);

        // High-speed vertical downward compression streaks of dark-red and flowing-gold light
        for (let i = 0; i < 22; i++) {
          const ox = ((i / 21) - 0.5) * rx * 2.1;
          const ph = fract(t * 8.0 + i * 0.37);
          const sy0 = lerp(-82, cy - 4, ph);
          const sy1 = Math.min(0, sy0 + lerp(18, 30, u));
          const isGold = i % 2 === 0;
          p.line(SX + ox, sy0, SX + ox * 0.50, sy1, isGold ? G[5] : C[4], fade * 0.92);
          p.px(SX + ox * 0.50, sy1, isGold ? WHITE : G[5]);
        }

        // Blinding Flowing-Gold star-flare inside the compressing mass (clamped above floor)
        const flareR = Math.min(20 + 14 * u, Math.abs(cy) + 18) * fade;
        flare(p, SX, cy, flareR, (0.68 + 0.32 * u) * fade, [C[4], G[4], G[6], WHITE]);
        p.glow(SX, cy, 34 * fade, C[4], 0.68 * fade);
        p.glow(SX, cy, 20 * fade, G[5], 0.78 * fade);
        floorLight(p, SX, 2, 36 * u * fade, 7, C[4], 0.48 * u * fade);
      }
    }

    // 1B. Ground-Hugging Colossal Pale-Grey & Crimson Mixed Air-Wave ("贴地炸开一圈巨大的苍灰色与赤色混合气浪")
    const dtSlam = t - T_SLAM;
    if (dtSlam >= 0 && dtSlam < 0.58) {
      const k = dtSlam / 0.58;
      const rOuter = 86 * ease.outQuart(k);
      const rMid = 70 * ease.outCubic(k);
      const rInner = 52 * ease.outQuad(k);
      const keepFn = isBack ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0;

      // Triple interwoven ground-hugging shockwave rings: Pale-Grey ("苍灰色") + Crimson ("赤色") + Flowing-Gold
      band(
        p,
        SX,
        1.0,
        rOuter,
        SY,
        Math.max(1.5, 6.8 * (1 - k)),
        (1 - k) * 0.96,
        [Ash[2], Ash[4], Ash[5], WHITE],
        keepFn,
      );
      band(
        p,
        SX,
        0.5,
        rMid,
        SY,
        Math.max(1.4, 5.8 * (1 - k)),
        (1 - k) * 0.95,
        [C[2], C[4], C[5], G[5]],
        keepFn,
      );
      band(
        p,
        SX,
        0.0,
        rInner,
        SY,
        Math.max(1.2, 4.5 * (1 - k)),
        (1 - k) * 0.90,
        [Ash[3], C[4], G[4], WHITE],
        keepFn,
      );

      if (!isBack) {
        // Rolling ground-hugging mixed pale-grey & crimson gas billows racing left & right along the floor
        for (const gp of groundWavePuffs) {
          if (dtSlam >= gp.dur) continue;
          const uP = dtSlam / gp.dur;
          const gx = clamp(SX + gp.dist * ease.outCubic(uP), X_MIN + 16, X_MAX - 16);
          const gy = Math.min(-2, gp.yOff - Math.sin(uP * Math.PI) * 6);
          const gr = lerp(gp.r0, gp.r1, ease.outQuad(uP));
          const fadeP = 1 - smooth(0.42, 1.0, uP);
          if (gp.isCrimson) {
            p.disc(gx, gy, gr, C[3], (d) => 0.68 * (1 - d * d) * fadeP);
            p.disc(gx, gy - 1, gr * 0.62, C[5], (d) => 0.75 * (1 - d * d) * fadeP);
          } else {
            p.disc(gx, gy, gr, Ash[3], (d) => 0.72 * (1 - d * d) * fadeP);
            p.disc(gx, gy - 1, gr * 0.65, Ash[5], (d) => 0.80 * (1 - d * d) * fadeP);
          }
        }

        // Slam moment blinding ground flash (clamped safely within y <= 28)
        if (dtSlam < 0.10) {
          const uF = 1 - dtSlam / 0.10;
          p.ellipse(SX, -2, 28 * uF, 7 * uF, G[5]);
          p.ellipse(SX, -2, 18 * uF, 4.5 * uF, WHITE);
          flare(p, SX, -8, 28 * uF, uF, [C[4], G[4], G[6], WHITE]);
        }
      }
    }
  }

  // PHASE 2A & 4A: High-Luminance Crimson-Gold Ground Ray -> Persistent Glowing Dark-Red Hot Light Band
  function drawGroundRayAndHotBand(p) {
    if (t < T_SLAM) return;
    const fadeEnd = 1 - smooth(T_END - 0.65, T_END - 0.06, t);
    if (fadeEnd <= 0.02) return;

    const rayU = clamp((t - T_SLAM) / (T_RAY_DONE - T_SLAM));
    const curRayX = lerp(SX, RAY_END_X, ease.outQuad(rayU));

    // Transition from blinding Crimson-Gold Ground Ray (0.28..1.65s) to Dark-Red Glowing Hot Band (1.65..4.10s)
    const afterK = smooth(1.42, 1.88, t);
    const pulse = 0.78 + 0.22 * Math.sin(t * 9.5);

    for (let x = SX - 4; x <= curRayX; x++) {
      const wave = Math.sin(x * 0.16 - t * 18) * 0.8;
      const halfW = lerp(5.0, 3.8, afterK) * fadeEnd * (0.85 + 0.25 * Math.sin(x * 0.09 + t * 7));

      for (let dy = -Math.ceil(halfW); dy <= Math.ceil(halfW); dy++) {
        const y = Math.round(0.5 + wave * 0.35 + dy);
        if (y < -5 || y > 6) continue;
        const q = Math.abs(dy) / Math.max(0.8, halfW);
        if (q > 1.05) continue;

        let col;
        if (afterK < 0.65) {
          // High-Luminance Crimson-Gold Ground Ray ("一道高亮的赤金色光线顺着地面向前极速蔓延")
          const leadBoost = Math.exp(-Math.max(0, curRayX - x) * 0.06) * (1 - rayU * 0.5);
          const h = (1 - q) + leadBoost * 0.35;
          if (h > 0.82) col = WHITE;
          else if (h > 0.62) col = G[5];
          else if (h > 0.42) col = G[4];
          else if (h > 0.24) col = C[4];
          else col = C[2];
        } else {
          // Persistent Glowing Dark-Red Hot Light Band ("底部区域留下一条持续散发暗红微光的炽热光带")
          const h = (1 - q) * pulse * fadeEnd;
          if (h > 0.78) col = C[5];
          else if (h > 0.54) col = C[4];
          else if (h > 0.32) col = C[3];
          else if (h > 0.16) col = C[2];
          else col = C[1];
        }
        p.px(x, y, col);
      }

      if ((x & 15) === 0) {
        const glowCol = afterK < 0.5 ? G[4] : C[3];
        const glowK = (afterK < 0.5 ? 0.50 : 0.42 * pulse) * fadeEnd;
        floorLight(p, x, 1.5, 34, 8, glowCol, glowK);
      }
    }

    // Soft dark-red thermal under-glow above the scorched band during the aftermath
    if (afterK > 0.2) {
      const hazeK = afterK * fadeEnd * 0.26;
      for (let hx = SX + 18; hx <= RAY_END_X - 12; hx += 32) {
        p.disc(hx, -14, 22, C[2], (d) => hazeK * (1 - d * d));
        p.glow(hx, -8, 26, C[3], hazeK * 0.85);
      }
    }

    // Blazing star-glint riding the leading tip of the spreading crimson-gold ground ray
    if (rayU < 1.0) {
      flare(p, curRayX, -4, 24, 0.9, [C[4], G[4], G[6], WHITE]);
      sparkle(p, curRayX, -2, 14, WHITE, G[5], 0.95);
      p.glow(curRayX, -2, 30, G[5], 0.85);
    }

    // Molten crimson-gold crater rings at the 3 pillar bases
    for (const pl of pillars) {
      if (t < pl.tErupt - 0.04) continue;
      const px = pl.idx === 2 ? enemyX(t) : pl.x;
      const hotP = (1 - smooth(pl.tFall, T_END - 0.2, t)) * fadeEnd;
      if (hotP > 0.05) {
        p.ellipse(px, 1, pl.wBase * 1.15 * fadeEnd, 3.2 * fadeEnd, hotP > 0.5 ? C[4] : C[2]);
        p.ellipse(px, 1, pl.wBase * 0.72 * fadeEnd, 2.0 * fadeEnd, hotP > 0.65 ? G[5] : C[4]);
      }
    }
  }

  // PHASE 2B: Three Sequential Towering Deep-Red & Flowing-Gold Spiralling Flame Pillars
  // ("光线所过之处依次向上垂直冲起三道粗壮的深红与流金色交织的螺旋烈焰光柱")
  function drawSpirallingPillars(p) {
    const NZ = (rate, s2 = 0, off = 0) => noise(t * rate + off, s2);

    for (const pl of pillars) {
      if (t < pl.tErupt || t >= pl.tGone) continue;
      const cx = pl.idx === 2 ? enemyX(t) : pl.x;
      const riseDur = 0.11;
      const uRise = clamp((t - pl.tErupt) / riseDur);
      const uFall = t < pl.tFall ? 0 : clamp((t - pl.tFall) / (pl.tGone - pl.tFall));

      const h = pl.hMax * ease.outQuart(uRise) * (1 - 0.68 * ease.inCubic(uFall));
      const strangle = 1 - 0.65 * ease.inQuad(uFall);
      const w0 = pl.wBase * (1 + 0.35 * Math.exp(-(t - pl.tErupt) * 9)) * strangle;
      if (h < 10 || w0 < 3.0) continue;

      // 1. Crown of roaring flame tongues at the top of the pillar
      if (uFall < 0.70) {
        const kCrown = clamp(w0 / pl.wBase);
        for (let i = 0; i < 5; i++) {
          const dx = (i - 2) * w0 * 0.38;
          const th = (18 + 14 * (i === 2 ? 1.25 : 0.85)) * kCrown;
          flameTongue(
            p,
            cx + dx,
            -h + 14,
            th,
            3.8 * kCrown,
            Math.sin(t * 14 + pl.seed + i) * 2.5,
            NZ,
            pl.seed + i * 19,
            H,
            LAYERS,
            0.45,
            0.95,
          );
        }
      }

      // 2. Helical flame blades jutting outward from the spiral ridges along the left & right sides of the pillar
      if (uFall < 0.65) {
        for (let b = 0; b < 6; b++) {
          const bFrac = ((b / 6) + t * 1.8) % 1;
          const bDy = lerp(14, h - 18, bFrac);
          const side = b % 2 === 0 ? -1 : 1;
          const rootX = cx + side * w0 * 0.72;
          const rootY = -bDy;
          flameBlade(
            p,
            rootX,
            rootY,
            side * 0.48,
            -0.88,
            (14 + 8 * (1 - bFrac)) * strangle,
            3.2 * strangle,
            -side * 1.8,
            NZ,
            pl.seed + 200 + b * 17,
            H,
            LAYERS,
            0.4,
            0.9,
          );
        }
      }

      // 3. Vertical Deep-Red / Blood-Crimson Pillar Column + 3 Interwoven Flowing-Gold Spiral Ribbons
      for (let dy = 0; dy <= h; dy++) {
        const y = -dy;
        if (y < Y_MIN + 4) break;
        const v = dy / h;

        const footFlare = 1 + 0.65 * Math.pow(Math.max(0, 1 - dy / 16), 2);
        const topTaper = 1 - smooth(0.76 - 0.42 * uFall, 1.0, v) * (0.72 + 0.24 * uFall);
        const spiralBulge = 1 + 0.22 * Math.sin(dy * 0.16 * pl.spin - t * 28 + pl.seed);
        const w = w0 * footFlare * topTaper * spiralBulge;
        if (w < 1.4) continue;

        const swayX = cx + Math.sin(dy * 0.05 - t * 16 + pl.seed) * 2.0 * v;
        const surge = fract(dy * 0.025 - t * 6.5) < 0.14 ? 1 : 0;

        // Draw Deep-Red / Crimson Pillar Core & Body
        const x0 = Math.max(X_MIN, Math.floor(swayX - w));
        const x1 = Math.min(X_MAX, Math.ceil(swayX + w));
        for (let x = x0; x <= x1; x++) {
          const q = Math.abs(x - swayX) / w;
          if (q > 1.08) continue;
          if (q > 0.90 && Math.sin(x * 1.7 + dy * 0.45 - t * 42) < 0.0) continue;

          let col;
          if (q < 0.15 + surge * 0.08) {
            col = uRise < 0.45 ? WHITE : G[6];
          } else if (q < 0.34) {
            col = C[5]; // Blazing scarlet inner column
          } else if (q < 0.62) {
            col = C[4]; // Vivid crimson-red column body
          } else if (q < 0.84) {
            col = C[3]; // Deep blood-red outer column
          } else {
            col = C[2]; // Dark crimson edge
          }
          p.px(x, y, col);
        }

        // Draw 3 Braided Helical Flowing-Gold Ribbons ("深红与流金色交织的螺旋烈焰光柱") winding upward around the pillar!
        for (let s = 0; s < 3; s++) {
          const ang = (dy * 0.085 * pl.spin) - t * 26 + (s * TAU) / 3;
          const depth = Math.cos(ang);
          if (depth < -0.15) continue;
          const sx = Math.round(swayX + Math.sin(ang) * w * 0.84);
          const ribW = Math.max(0, Math.round(w * 0.20 * (0.65 + 0.35 * depth)));
          for (let rdx = -ribW; rdx <= ribW; rdx++) {
            const px = sx + rdx;
            if (px < X_MIN || px > X_MAX) continue;
            const rq = Math.abs(rdx) / (ribW + 0.6);
            const rCol = rq < 0.38 && depth > 0.45 ? WHITE : rq < 0.72 ? G[5] : G[4];
            p.px(px, y, rCol);
          }
        }

        if ((dy & 15) === 0) {
          p.glow(swayX, y, w * 2.4 + 8, C[4], 0.36 * strangle);
          p.glow(swayX, y, w * 1.3 + 4, G[4], 0.32 * strangle);
        }
      }

      // Eruption base shockwave & flash for each pillar
      const dtE = t - pl.tErupt;
      if (dtE >= 0 && dtE < 0.36) {
        const kB = dtE / 0.36;
        band(
          p,
          cx,
          0.5,
          (42 + pl.idx * 10) * ease.outCubic(kB),
          SY,
          Math.max(1, 4.0 * (1 - kB)),
          1 - kB,
          [C[2], C[4], G[4], WHITE],
          (g) => Math.sin(g) >= 0,
        );
      }
      if (dtE >= 0 && dtE < 0.10) {
        const uF = 1 - dtE / 0.10;
        p.ellipse(cx, -2, w0 * 1.3, 5 * uF, G[5]);
        p.ellipse(cx, -2, w0 * 0.8, 3 * uF, WHITE);
      }
    }
  }

  // PHASE 3: Enemy Hit — High-Density Bottom-to-Top Gold-Red Streamers & Blinding White Hit-Flash
  // ("自下而上的高密度的金红流光冲击与刺眼的白色受击爆闪")
  function drawEnemyHitImpact(p) {
    if (t < T_HIT || t >= T_PILLAR_END + 0.15) return;
    const ex = enemyX(t);
    const ey = -28;

    // 1. High-Density Bottom-to-Top Gold-Red Streamer Rush ("自下而上的高密度的金红流光冲击")
    for (const st of goldRedStreamers) {
      if (t < st.t0 || t >= st.t0 + st.dur) continue;
      const u = (t - st.t0) / st.dur;
      const headY = lerp(st.yStart, st.yEnd, ease.outCubic(u));
      const tailY = Math.min(2, headY + st.len * Math.sin(u * Math.PI));
      const sx = ex + st.ox;
      if (sx < X_MIN + 4 || sx > X_MAX - 4) continue;

      const bodyCol = st.isGold ? G[4] : C[4];
      const coreCol = st.isGold ? G[6] : C[6];
      const w = Math.max(1, Math.round(st.w * (1 - u * 0.5)));

      for (let dx = -w; dx <= w; dx++) {
        const col = dx === 0 ? (u < 0.6 ? WHITE : coreCol) : bodyCol;
        p.line(sx + dx, tailY, sx + dx, Math.max(Y_MIN + 4, headY), col, 1 - u * 0.4);
      }
      p.glow(sx, (headY + tailY) * 0.5, 8, bodyCol, 0.42 * (1 - u));
    }

    // 2. Blinding White Hit-Flash Bursts ("刺眼的白色受击爆闪")
    for (const tFlash of [T_HIT, T_HIT2, T_HIT3]) {
      const dtF = t - tFlash;
      if (dtF >= 0 && dtF < 0.15) {
        const kF = 1 - dtF / 0.15;
        p.disc(ex, ey, 28 * kF, WHITE, (d) => 0.88 * (1 - d * d) * kF);
        p.ring(ex, ey, 18 + 14 * (1 - kF), 2.0, WHITE);
        p.line(ex, 2, ex, Math.max(Y_MIN + 6, -155 * kF), WHITE, kF);
        flare(p, ex, ey, 50 * kF, kF, [C[4], G[4], G[6], WHITE]);
        sparkle(p, ex, ey, 24 * kF, WHITE, G[5], kF);
        p.glow(ex, ey, 60 * kF, WHITE, 0.95 * kF);
      }
    }
  }

  // PHASE 4B: Rising Charred-Black Ash Particles & Sinuous Bluish-Grey Light Smoke Wisps
  // ("并不断向上飘起焦黑色的灰烬粒子与青灰轻烟")
  function drawAftermathAshAndSmoke(p, isBack) {
    // 1. Sinuous Translucent Bluish-Grey Light Smoke Wisps ("青灰轻烟")
    for (let i = 0; i < smokeWisps.length; i++) {
      if ((i % 2 === 0) !== isBack) continue;
      const sw = smokeWisps[i];
      if (t < sw.t0 || t >= sw.t0 + sw.life) continue;
      const age = t - sw.t0;
      const u = age / sw.life;
      const curH = sw.hMax * ease.outQuad(Math.min(1, u * 1.4));
      const yBase = -1 - age * 16;
      drawBluishSmokeWisp(p, sw.x0, yBase, curH, sw.w0, sw.phase, t, u, Ash);
    }

    if (isBack) return;

    // 2. Charred-Black Ash Particles ("焦黑色的灰烬粒子") with smoldering ember/ash rims
    for (const ca of charredAsh) {
      if (t < ca.t0 || t >= ca.t0 + ca.life) continue;
      const age = t - ca.t0;
      const u = age / ca.life;
      const fade = Math.sin(Math.min(1, u * 4) * (Math.PI / 2)) * (1 - smooth(0.60, 1.0, u));
      if (fade <= 0.06) continue;

      const sway = Math.sin(age * ca.swayFreq + ca.phase) * ca.swayAmp * u;
      const x = Math.round(ca.x0 + ca.vx * age + sway);
      const y = Math.round(ca.y0 + ca.vy * age);
      if (x < X_MIN + 4 || x > X_MAX - 4 || y < Y_MIN + 6 || y > 1) continue;

      // Smoldering dark-red / ember-gold / pale-ash rim around the charred-black core so it pops against dark sky!
      const rimCol = ca.rimKind === 0 ? C[4] : ca.rimKind === 1 ? (u < 0.5 ? G[4] : C[3]) : Ash[4];
      p.px(x - 1, y, rimCol);
      p.px(x, y + 1, ca.rimKind === 2 ? Ash[3] : C[3]);
      if (ca.sz > 1.8) {
        p.px(x + 2, y, CHAR_DARK);
        p.px(x + 1, y - 1, rimCol);
      }

      // True Charred-Black Ash Core ("焦黑色的灰烬粒子")
      p.px(x, y, CHAR_BLACK);
      p.px(x + 1, y, CHAR_BLACK);
      if (ca.sz > 1.6) {
        p.px(x, y - 1, CHAR_BLACK);
      }
    }
  }

  return {
    update(dt) {
      t += dt;
      const ex = enemyX(t);

      // Ground Slam at T_SLAM (0.28s)
      if (!slammed && t >= T_SLAM) {
        slammed = true;
        lights.add(SX, -12, 68, G[4], 0.95, 0.45);
        lights.add(SX, -8, 34, WHITE, 0.90, 0.14);
        for (let i = 0; i < 36; i++) {
          const a = -Math.PI / 2 + R.range(-1.3, 1.3);
          const sp = R.range(80, 220);
          ps.spawn(P.SPARK, SX + R.range(-6, 6), -2, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.22, 0.52)));
        }
      }

      // Sequential Eruption of the 3 Spiralling Pillars
      for (const pl of pillars) {
        if (!pl.erupted && t >= pl.tErupt) {
          pl.erupted = true;
          const px = pl.idx === 2 ? ex : pl.x;
          const isMainHit = pl.idx === 2;
          lights.add(px, -45, isMainHit ? 105 : 78, C[4], isMainHit ? 1.05 : 0.85, 0.55);
          lights.add(px, -18, isMainHit ? 54 : 38, WHITE, 0.95, 0.15);

          const nSparks = isMainHit ? 48 : 26;
          for (let i = 0; i < nSparks; i++) {
            const a = -Math.PI / 2 + R.range(-0.85, 0.85);
            const sp = R.range(90, 260);
            ps.spawn(P.SPARK, px + R.range(-8, 8), -4, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.24, 0.58)));
          }
          const nFire = isMainHit ? 22 : 12;
          for (let i = 0; i < nFire; i++) {
            ps.spawn(
              P.FIRE,
              px + R.range(-10, 10),
              -R.range(6, 45),
              R.range(-35, 35),
              -R.range(65, 165),
              capLife(R.range(0.38, 0.82)),
              0,
              R.range(4.2, 7.8),
              0,
              PF.SMOKES,
            );
          }
        }
      }

      // Secondary & Tertiary Enemy Impact Surges (T_HIT2, T_HIT3)
      if (!hit2Done && t >= T_HIT2) {
        hit2Done = true;
        lights.add(ex, -35, 88, G[4], 0.95, 0.45);
        lights.add(ex, -28, 44, WHITE, 0.90, 0.14);
        for (let i = 0; i < 28; i++) {
          const a = -Math.PI / 2 + R.range(-0.9, 0.9);
          const sp = R.range(85, 240);
          ps.spawn(P.SPARK, ex + R.range(-10, 10), -18, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.22, 0.54)));
        }
      }
      if (!hit3Done && t >= T_HIT3) {
        hit3Done = true;
        lights.add(ex, -38, 96, C[4], 1.05, 0.55);
        lights.add(ex, -28, 48, WHITE, 0.95, 0.15);
        for (let i = 0; i < 36; i++) {
          const a = -Math.PI / 2 + R.range(-1.0, 1.0);
          const sp = R.range(90, 255);
          ps.spawn(P.SPARK, ex + R.range(-10, 10), -20, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.25, 0.60)));
        }
      }

      ps.update(dt);
      cullParticles(ps, X_MIN + 4, Y_MIN + 4, X_MAX - 4, Y_MAX - 4);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;

      // Oppressive arena darkening during pillar eruptions & enemy impact ("展现压迫感")
      if (t >= T_SLAM && t < 1.65) {
        const kDark = 0.72 * smooth(T_SLAM, T_HIT, t) * (1 - smooth(1.25, 1.65, t));
        if (kDark > 0.03) {
          unlight(
            p,
            TX - 85,
            -120,
            TX + 85,
            8,
            (x, y) => {
              const d = Math.hypot((x - TX) / 84, (y + 38) / 72);
              return d > 0.46 && d < 1;
            },
            1 - kDark,
          );
        }
      }

      // Back half of the pale-grey & crimson ground shockwave rings
      drawCompressionAndGroundWave(p, true);

      // High-luminance crimson-gold ground ray & persistent dark-red hot floor band
      drawGroundRayAndHotBand(p);

      // Back layer of bluish-grey aftermath smoke
      drawAftermathAshAndSmoke(p, true);

      simDraw(p, ps, H, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;

      // 1. Downward Compression & Front Half of Pale-Grey/Crimson Ground Air-Wave
      drawCompressionAndGroundWave(p, false);

      // 2. Three Sequential Towering Deep-Red & Flowing-Gold Spiralling Flame Pillars
      drawSpirallingPillars(p);

      // 3. Enemy Hit: Bottom-to-Top High-Density Gold-Red Streamers & Blinding White Flash
      drawEnemyHitImpact(p);

      simDraw(p, ps, H, "front");
      lights.draw(p);

      // 4. Aftermath Bluish-Grey Smoke & Charred-Black Ash Particles (drawn after lights so charred-black ash stays crisp!)
      drawAftermathAshAndSmoke(p, false);
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
