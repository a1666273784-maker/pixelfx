import { Particles, Lights, P, Rng, fit, band, flare, sparkle, clamp, smooth, seg, lerp, ease, tileFbm, loopNoise, rand, TAU, WHITE } from "../../core/index.js";
import { hotFirst, flameTongue, flameBlade, simDraw, floorLight, LAYERS } from "./_lib.js";

export const meta = {
  name: "Flame array",
  desc: "Four yellow cloud-thunder arrays flicker on the floor, a bone-white and vermilion dash slices across, and four cyan-crimson fire pillars erupt and dissolve into embers.",
  tags: ["fire", "wind", "array", "pillar", "chinese", "combo", "ground", "one-shot"],
  size: [320, 236],
  origin: [28, 206],
  duration: 4.4,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#1c070a", "#4a0f14", "#82181d", "#bf2422", "#e84825", "#ff7930", "#ffc478", "#fff8eb"],
    wind: ["#071d21", "#0f363c", "#195860", "#27858b", "#40b9b8", "#7be8df", "#dcfffb"],
    array: ["#4d3206", "#8c5f0b", "#cc9214", "#ffd426", "#fff380"],
    shadow: ["#0d0a12"],
    seed: 7,
  },
};

const X_NODES = [38, 102, 166, 230];
const N_P = 4;
const SY = 0.33;
const H_MAX = 152;
const W_COL = 12.0;

const T_DASH = 0.48;
const T_DASH_END = 0.76;
const T_ERUPT = [0.68, 0.84, 1.0, 1.16];
const T_WIND_BREAK = [2.04, 2.16, 2.28, 2.4];
const T_FIRE_BREAK = [2.46, 2.58, 2.7, 2.82];
const T_AFTER = 3.0;
const T_END = 4.4;

// Stepped 5x5 Chinese Cloud-Thunder (雷纹/回纹) floating seal glyph
const THUNDER_GLYPH = [
  "#####",
  "#...#",
  "#.###",
  "#.#..",
  "#####",
];

export function create(o) {
  const C = fit(o.palette, 8), H = hotFirst(C);
  const W = fit(o.wind, 7), HW = [...W, W[6]].reverse();
  const A = fit(o.array, 5);
  const SH = fit(o.shadow, 1)[0];
  const R = new Rng(o.seed), seed = o.seed * 19, floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [C[7], A[3], C[4], C[2]],
    haze: W[3],
  });
  const lights = new Lights();

  // Stage 4A: Outer cyan wind-blade sheath shatters FIRST into crisp pixel dots (1x1 and 2x2 cyan pixel blocks)
  const windPixels = [];
  for (let idx = 0; idx < N_P; idx++) {
    const cx = X_NODES[idx], t0 = T_WIND_BREAK[idx];
    for (let i = 0; i < 92; i++) {
      const y0 = -R.range(6, H_MAX * 0.96);
      const side = R.sign();
      const x0 = cx + side * R.range(W_COL * 0.55, W_COL * 1.45);
      windPixels.push({
        idx,
        t0: t0 + R.range(0, 0.1),
        life: R.range(0.44, 0.74),
        x0,
        y0,
        vx: side * R.range(15, 56) + R.range(-8, 8),
        vy: -R.range(8, 42),
        col: R.pick([W[6], W[5], W[5], W[4], W[3]]),
        big: R.chance(0.48),
        ph: R.range(0, TAU),
      });
    }
  }

  // Stage 4B & 5: Inner crimson fire pillar snaps into 6 distinct fractured ember clusters per column (with clear broken gaps between clusters!),
  // and the suspended dark-red embers wink out one by one ("内层赤火随后断裂成悬浮的暗红余烬，逐颗熄灭")!
  const suspendedEmbers = [];
  for (let idx = 0; idx < N_P; idx++) {
    const cx = X_NODES[idx], t0 = T_FIRE_BREAK[idx];
    const nClusters = 6;
    const allForPillar = [];
    for (let cIdx = 0; cIdx < nClusters; cIdx++) {
      const cyBase = -16 - cIdx * 23 + R.range(-2.5, 2.5);
      const cxBase = cx + R.range(-5.5, 5.5);
      for (let m = 0; m < 6; m++) {
        const isCore = m === 0;
        const ox = isCore ? 0 : R.range(-7.5, 7.5);
        const oy = isCore ? 0 : R.range(-5.5, 5.5);
        allForPillar.push({
          x0: cxBase + ox,
          y0: clamp(cyBase + oy, -H_MAX + 4, -5),
          r: isCore ? R.range(2.8, 3.7) : m <= 2 ? R.range(1.8, 2.5) : R.range(1.1, 1.7),
          vx: R.range(-3.2, 3.2),
          vy: R.range(-2.4, 1.0),
          ph: R.range(0, TAU),
        });
      }
    }
    for (let i = 0; i < allForPillar.length; i++) {
      const e = allForPillar[i];
      const order = (i * 13 + idx * 7) % allForPillar.length;
      const tOut = lerp(t0 + 0.42, 4.28, Math.pow((order + R.range(0.1, 0.9)) / allForPillar.length, 0.9));
      suspendedEmbers.push({
        idx,
        t0: t0 + R.range(0, 0.1),
        tOut,
        ...e,
      });
    }
  }

  let t = 0, dashed = false;
  const nodeErupted = [false, false, false, false];
  const nodeWindBroke = [false, false, false, false];
  const nodeFireBroke = [false, false, false, false];

  const colHeight = (idx, tt) => {
    const tE = T_ERUPT[idx], tFB = T_FIRE_BREAK[idx];
    if (tt < tE) return 0;
    if (tt < tE + 0.095) return H_MAX * ease.outCubic((tt - tE) / 0.095);
    if (tt < tFB + 0.36) return H_MAX * (0.97 + 0.03 * loopNoise((tt - tE) * 1.2, 1.2, seed + idx * 7));
    return 0;
  };

  // Stage 1: Bright Yellow Chinese Cloud-Thunder Pattern (明黄色中式云雷纹法阵) on the floor
  function drawCloudThunderArray(p, idx) {
    const cx = X_NODES[idx];
    const tAppear = -0.18 + idx * 0.04;
    if (t < tAppear) return;
    const afterFade = 1 - smooth(3.85, 4.35, t);
    if (afterFade <= 0) return;

    const grow = ease.outBack(clamp((t - tAppear) / 0.17), 1.35);
    const rx = 27 * grow;

    // Distinct rapid flicker in bright imperial yellow (A[2]..A[4]) during windup
    const flick = 0.5 + 0.5 * Math.sin(t * 34 + idx * 1.8);
    const isPre = t < T_ERUPT[idx];
    const isActive = t >= T_ERUPT[idx] && t < T_FIRE_BREAK[idx];

    if (t >= T_ERUPT[idx]) {
      p.ellipse(cx, 0.5, 27, 27 * SY, SH, 0.78 * afterFade);
    }

    const mainCol = isPre ? (flick > 0.6 ? A[4] : A[3]) : isActive ? A[3] : t < T_AFTER ? C[3] : C[1];
    const subCol = isPre ? (flick > 0.42 ? A[3] : A[2]) : isActive ? A[2] : C[1];
    const rimCol = isPre ? A[1] : C[0];
    const a = (isPre ? 0.86 + 0.14 * flick : isActive ? 0.95 : 0.65) * afterFade;

    // 1. Outer & inner perspective rings in bright imperial yellow
    band(p, cx, 0.5, rx, SY, 1.4, a, [rimCol, A[2], mainCol, A[4]], () => true, false);
    band(p, cx, 0.5, rx * 0.48, SY, 1.1, a * 0.9, [rimCol, subCol, mainCol, A[4]], () => true, false);

    // 2. Stepped Chinese Cloud-Thunder Fretwork (云雷纹 / 方形回纹: 8 angular hooked spiral meanders around the ring)
    const nFrets = 8;
    const rot = t < T_FIRE_BREAK[idx] ? t * 0.65 * (idx % 2 ? -1 : 1) : 0;
    const rIn = rx * 0.54, rMid = rx * 0.75, rOut = rx * 0.92;
    const pt = (r, ang) => [cx + Math.cos(ang) * r, 0.5 + Math.sin(ang) * r * SY];

    for (let k = 0; k < nFrets; k++) {
      const a0 = rot + (k / nFrets) * TAU;
      const a1 = a0 + (0.62 * TAU) / nFrets;
      const aMid = (a0 + a1) * 0.5;
      const fretFlick = 0.5 + 0.5 * Math.sin(t * 36 + k * 2.3 + idx);
      const fc = isPre ? (fretFlick > 0.65 ? A[4] : fretFlick > 0.3 ? A[3] : A[2]) : k % 2 === 0 ? mainCol : subCol;

      const [x1, y1] = pt(rIn, a0);
      const [x2, y2] = pt(rOut, a0);
      const [x3, y3] = pt(rOut, aMid);
      const [x4, y4] = pt(rMid, aMid);
      const [x5, y5] = pt(rMid, a1);
      const [x6, y6] = pt(rIn, a1);
      p.line(x1, y1, x2, y2, fc, a);
      p.line(x2, y2, x3, y3, fc, a);
      p.line(x3, y3, x4, y4, fc, a);
      p.line(x4, y4, x5, y5, fc, a);
      p.line(x5, y5, x6, y6, fc, a * 0.8);
    }

    // 3. Central Square Thunder-Seal (雷纹方印) + 4 corner upright light-pins during windup
    const sr = rx * 0.35;
    const sq = [0, 1, 2, 3].map((k) => pt(sr, -rot + (k * Math.PI) / 2 + Math.PI / 4));
    for (let k = 0; k < 4; k++) {
      const [ax, ay] = sq[k], [bx, by] = sq[(k + 1) % 4];
      p.line(ax, ay, bx, by, mainCol, a);
      if (isPre && grow > 0.6) {
        const pinH = (3 + 3 * Math.sin(t * 26 + k * 1.5 + idx)) * grow;
        p.line(ax, ay, ax, ay - pinH, A[4], a * 0.85);
      }
    }

    // 4. During wind-up (0.0 - 0.68s), a bright yellow 5x5 Chinese 雷纹 seal glyph hovers & bobs over each array center!
    if (isPre && grow > 0.55) {
      const bob = Math.sin(t * 14 + idx * 1.5) * 1.2;
      const gy = Math.round(-7 + bob);
      const gc = flick > 0.6 ? A[4] : A[3];
      p.sprite(THUNDER_GLYPH, {}, Math.round(cx) - 2, gy, { tint: A[1], a: a * 0.85 });
      p.sprite(THUNDER_GLYPH, {}, Math.round(cx) - 2, gy - 1, { tint: gc, a });
      p.glow(cx, gy - 1, 8, A[3], 0.35 * flick);
    }

    if (isPre || isActive) {
      floorLight(p, cx, 0.5, 28 * grow, 6, A[3], (isPre ? 0.38 * (0.5 + 0.5 * flick) : 0.42) * afterFade);
    }
  }

  // Linking golden array rails connecting the 4 formations into a linked chain ("连环阵")
  function drawArrayLinks(p) {
    if (t >= 3.8) return;
    const fade = 1 - smooth(2.8, 3.8, t);
    for (let i = 0; i < N_P - 1; i++) {
      const x0 = X_NODES[i] + 24, x1 = X_NODES[i + 1] - 24;
      const flick = 0.5 + 0.5 * Math.sin(t * 32 + i);
      const col = t < T_DASH ? (flick > 0.6 ? A[4] : A[3]) : t < T_AFTER ? A[2] : C[1];
      p.line(x0, 0.5, x1, 0.5, col, 0.9 * fade);
      p.line(x0, -1.5, x1, -1.5, A[2], 0.55 * fade);
      p.line(x0, 2.5, x1, 2.5, A[2], 0.55 * fade);
    }
  }

  // Stage 2: Blinding Bone-White & Vermilion intertwined horizontal wind-dash afterimage ("一道刺眼的骨白与朱红交织的横向疾风残影瞬间划过屏幕")
  function drawHorizontalDash(p) {
    if (t < T_DASH || t >= T_DASH_END) return;
    const u = seg(t, T_DASH, T_DASH_END);
    const headX = lerp(-10, 274, ease.outQuart(Math.min(1, u * 1.6)));
    const tailX = lerp(-16, 210, Math.pow(u, 2.4));
    const fade = 1 - smooth(0.58, 1, u);
    const yMid = -30;

    for (let x = Math.max(-14, Math.floor(tailX)); x <= Math.min(274, Math.ceil(headX)); x++) {
      const q = (x - tailX) / Math.max(1, headX - tailX);
      const env = Math.sin(Math.PI * clamp(q, 0, 1)) * (0.42 + 0.58 * q) * fade;
      if (env <= 0.04) continue;

      // Two bold braided ribbons: Vermilion-Crimson (朱红, C[3..4]) & Bone-White (骨白, C[7]/WHITE) crossing over each other!
      const phase = x * 0.065 - t * 34;
      const sWave = Math.sin(phase), cWave = Math.cos(phase);
      const yRed = yMid + sWave * 10.0 * (1 - 0.2 * q);
      const yWhite = yMid - sWave * 8.0 * (1 - 0.2 * q);

      const drawRed = () => {
        const rh = Math.max(1, Math.round(4.0 * env));
        for (let dy = -rh; dy <= rh; dy++) {
          const rc = Math.abs(dy) === 0 ? C[5] : Math.abs(dy) === 1 ? C[4] : Math.abs(dy) === 2 ? C[3] : C[2];
          p.dot(x, yRed + dy, rc, Math.min(1, env * 1.35));
        }
      };
      const drawWhite = () => {
        const wh = Math.max(1, Math.round(3.0 * env));
        for (let dy = -wh; dy <= wh; dy++) {
          const wc = Math.abs(dy) <= 1 ? WHITE : C[7];
          p.dot(x, yWhite + dy, wc, Math.min(1, env * 1.45));
        }
      };

      // True over/under braiding based on cos(phase)
      if (cWave >= 0) {
        drawRed();
        drawWhite();
      } else {
        drawWhite();
        drawRed();
      }

      // Central bone-white core spine + vermilion edge slashes
      p.dot(x, yMid, WHITE, Math.min(1, env * 1.45));
      p.dot(x, yMid - 1, C[7], env);
      p.dot(x, yMid + 1, C[4], env);
      p.dot(x, yMid + 2, C[3], env * 0.9);

      // High-speed wind-shear filaments above and below
      if (((x + Math.floor(t * 180)) & 7) < 5) {
        p.dot(x, yMid - 14 + Math.sin(x * 0.04) * 2, C[7], env * 0.9);
        p.dot(x, yMid + 14 - Math.sin(x * 0.04) * 2, C[4], env * 0.9);
      }

      if ((x & 15) === 0) {
        p.glow(x, yRed, 16, C[4], 0.4 * env);
        p.glow(x, yWhite, 12, C[7], 0.36 * env);
      }
    }

    // Diagonal martial-step slash afterimages ("踏炎疾风残影") at each array node the dash has crossed
    for (let idx = 0; idx < N_P; idx++) {
      const nx = X_NODES[idx];
      if (headX >= nx && tailX <= nx + 36) {
        const ka = fade * clamp(1 - Math.abs((headX - nx - 35) / 90));
        p.line(nx - 15, yMid + 16, nx + 13, yMid - 16, C[4], ka * 0.95);
        p.line(nx - 13, yMid + 16, nx + 15, yMid - 16, WHITE, ka);
      }
    }

    // Piercing spear-tip flare at the leading edge of the dash
    if (headX < 270) {
      flare(p, headX, yMid, 34 * fade, fade, [C[3], C[4], C[7], WHITE]);
      sparkle(p, headX, yMid, 16 * fade, WHITE, C[4], 0.85);
    }
  }

  // Stage 3, 4 & 5: Four sequential Cyan-and-Crimson Pillars with internal spiraling pixel light-streams & two-stage dissipation
  function drawPillar(p, idx) {
    const cx = X_NODES[idx];
    const tE = T_ERUPT[idx], tWB = T_WIND_BREAK[idx], tFB = T_FIRE_BREAK[idx];
    if (t < tE) return;

    const h = colHeight(idx, t);
    const fireBreak = t < tFB ? 0 : seg(t, tFB, tFB + 0.36);
    const windBreak = t < tWB ? 0 : seg(t, tWB, tWB + 0.24);
    const NZ = (rate, s0, off = 0) => loopNoise(t * rate * 0.15 + off * 0.1, 1.4, s0);

    if (h > 2 && fireBreak < 1) {
      const pop = t < tFB ? 1 + 0.38 * Math.exp(-(t - tE) * 9) : 1 - fireBreak * 0.42;
      const w0 = W_COL * pop;

      // 1. Back half of outer 青岚风刃 (Cyan Wind-Blade sheath) — intact until T_WIND_BREAK[idx]
      if (windBreak < 1) {
        drawWindBlades(p, cx, h, w0, idx, windBreak, true, NZ);
      }

      // 2. Crown of crimson flame tongues at the top of the pillar
      if (fireBreak < 0.45) {
        const ck = 1 - fireBreak / 0.45;
        for (let i = -2; i <= 2; i++) {
          const dx = i * w0 * 0.34;
          const th = (14 + 10 * (0.5 + 0.5 * NZ(3.2, seed + idx * 31 + i))) * ck;
          flameTongue(p, cx + dx, -h + 10, th, 3.2 * ck, -dx * 0.2, NZ, seed + idx * 43 + i, H, LAYERS);
        }
      }

      // 3. Inner Crimson-Vermilion Fire Pillar (赤火内层) — rich crimson/vermilion body so internal pixel light-streams pop!
      for (let y = 0; y >= -h; y--) {
        const v = -y / h;
        const sway = tileFbm(v * 3.5, -t * 4.0, 8, 8, seed + idx * 17, 2) * 2.2 * v;

        // Organic necking & diagonal fracture seams when fireBreak > 0
        let pinch = 1, driftX = 0;
        if (fireBreak > 0) {
          const nBreak = tileFbm(v * 7.0 + idx * 2.1, -t * 1.8, 8, 8, seed + idx * 89, 2);
          if (nBreak < -0.25 + fireBreak * 0.88) continue;
          pinch = clamp((nBreak - (-0.25 + fireBreak * 0.88)) * 2.2, 0.28, 1);
          driftX = Math.sin(v * 16 + idx * 3) * fireBreak * 4.2;
        }

        const turbL = Math.max(0, tileFbm(v * 6.5, -t * 5.2, 8, 8, seed + idx * 23, 2));
        const turbR = Math.max(0, tileFbm(v * 6.5 + 3.1, -t * 5.2, 8, 8, seed + idx * 29, 2));
        const foot = 1 + 0.5 * Math.max(0, 1 - -y / 14) ** 2;
        const top = 1 - smooth(0.84, 1, v) * 0.65;
        const wl = w0 * foot * top * (1 + 0.42 * turbL) * pinch;
        const wr = w0 * foot * top * (1 + 0.42 * turbR) * pinch;

        for (let x = Math.floor(sway - wl); x <= Math.ceil(sway + wr); x++) {
          const dx = x - sway;
          const q = Math.abs(dx) / Math.max(0.5, dx < 0 ? wl : wr);
          if (q > 1) continue;
          const fNoise = 0.16 * tileFbm((cx + x) * 0.15, y * 0.12 - t * 6.5, 16, 16, seed + idx * 37, 2);
          if (fireBreak > 0 && q + fNoise > 1.05 - fireBreak * 0.35) continue;
          const d = clamp(q + fNoise, 0, 1);
          // Rich crimson-vermilion fire core (C[5] warm orange-red heart -> C[4] vermilion -> C[3] crimson -> C[2..1] dark red rim)
          let ci = d < 0.16 ? 5 : d < 0.42 ? 4 : d < 0.72 ? 3 : d < 0.9 ? 2 : 1;
          if (fireBreak > 0) ci = Math.max(1, ci - Math.floor(fireBreak * 2.2));
          p.px(cx + x + driftX, y, C[ci]);
        }

        if ((-y) % 18 === 0 && -y > 12) {
          p.glow(cx + sway + driftX, y, 22, C[3], 0.22 * (1 - fireBreak));
        }
      }

      // 4. Internal Spiraling Pixel Light-Streams (内部螺旋上升的像素流光 — stepped 2x2 pixel-art streams with dark-crimson edge contrast!)
      if (fireBreak < 0.58) {
        const streamA = 1 - fireBreak / 0.58;
        for (let s = 0; s < 2; s++) {
          const phase0 = s * Math.PI + idx * 1.2;
          for (let y = -4; y >= -h + 8; y -= 2) {
            const v = -y / h;
            const ang = -v * TAU * 2.5 - t * 14.0 + phase0;
            const sn = Math.sin(ang), cs = Math.cos(ang);
            if (sn < -0.2) continue;
            const rStream = w0 * 0.58 * (1 - smooth(0.85, 1, v) * 0.5);
            const sx = Math.round((cx + cs * rStream) * 0.5) * 2;
            const sy = Math.round(y * 0.5) * 2;
            const packet = ((v * 3.5 - t * 3.8 + s * 0.5) % 1 + 1) % 1;
            if (packet < 0.72) {
              const isHead = packet < 0.22;
              const cMain = isHead ? WHITE : packet < 0.45 ? A[4] : W[6];
              const cSub = isHead ? W[6] : A[3];
              // 1px dark-crimson contrast shadow next to the pixel stream so it pops against the inner fire core
              p.px(sx - 1, sy, C[2]);
              p.px(sx + 2, sy, C[2]);
              p.px(sx, sy, cMain);
              p.px(sx + 1, sy, cMain);
              p.px(sx, sy - 1, cSub);
              p.px(sx + 1, sy - 1, cSub);
              if (isHead && ((-y) & 6) === 0) p.glow(sx, sy, 5, A[4], 0.26 * streamA);
            }
          }
        }
      }

      // 5. Front half of outer 青岚风刃 (Cyan Wind-Blade sheath) — shatters BEFORE the inner crimson pillar!
      if (windBreak < 1) {
        drawWindBlades(p, cx, h, w0, idx, windBreak, false, NZ);
      }

      // Base flames at the formation foot
      if (fireBreak < 0.55) {
        const bk = 1 - fireBreak / 0.55;
        flameTongue(p, cx - 5, 1, 12 * bk, 2.5 * bk, -2, NZ, seed + idx * 61, H, LAYERS);
        flameTongue(p, cx + 5, 1, 12 * bk, 2.5 * bk, 2, NZ, seed + idx * 67, H, LAYERS);
      }
    }

    // Step A Dissipation: Outer cyan wind-blades shatter into crisp floating pixel dots (`windPixels`)!
    if (t >= tWB) {
      for (let i = 0; i < windPixels.length; i++) {
        const wp = windPixels[i];
        if (wp.idx !== idx) continue;
        const age = t - wp.t0;
        if (age < 0 || age >= wp.life) continue;
        const k = 1 - age / wp.life;
        const drag = (1 - Math.exp(-2.8 * age)) / 2.8;
        const px = Math.round(wp.x0 + wp.vx * drag);
        const py = Math.round(wp.y0 + wp.vy * drag);
        if (k < 0.22 && Math.sin(t * 42 + wp.ph) < 0) continue;
        const c = k > 0.65 ? W[6] : k > 0.35 ? wp.col : W[3];
        p.px(px, py, c);
        if (wp.big && k > 0.3) {
          p.px(px + 1, py, W[5]);
          p.px(px, py - 1, W[4]);
          p.px(px + 1, py - 1, W[3]);
        }
        if ((i & 3) === 0) p.glow(px, py, 4, W[4], 0.26 * k);
      }
    }

    // Step B & C Dissipation: Inner crimson fire breaks into 6 suspended dark-red ember clusters that wink out one by one!
    if (t >= tFB) {
      for (let i = 0; i < suspendedEmbers.length; i++) {
        const se = suspendedEmbers[i];
        if (se.idx !== idx || t < se.t0 || t >= se.tOut) continue;
        const age = t - se.t0;
        const rem = se.tOut - t;
        const k = clamp(rem / 0.45);
        const ex = Math.round(se.x0 + se.vx * age + Math.sin(t * 3.4 + se.ph) * 1.4);
        const ey = Math.round(se.y0 + se.vy * age + Math.cos(t * 2.7 + se.ph) * 1.1);

        if (rem < 0.15 && Math.sin(t * 52 + se.ph) < 0) continue;

        const coreCol = age < 0.16 ? C[5] : rem > 0.48 ? C[4] : rem > 0.22 ? C[3] : C[2];
        const midCol = rem > 0.38 ? C[3] : C[2];
        const rimCol = rem > 0.25 ? C[1] : C[0];
        const curR = se.r * (0.55 + 0.45 * k);

        if (curR >= 2.2) {
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const d = Math.abs(dx) + Math.abs(dy) * 0.85;
              if (d > curR * 0.95) continue;
              p.px(ex + dx, ey + dy, d < 0.8 ? coreCol : d < 1.65 ? midCol : rimCol);
            }
          }
        } else if (curR >= 1.3) {
          p.px(ex - 1, ey, midCol);
          p.px(ex + 1, ey, midCol);
          p.px(ex, ey - 1, midCol);
          p.px(ex, ey + 1, rimCol);
          p.px(ex, ey, coreCol);
        } else {
          p.px(ex, ey + 1, rimCol);
          p.px(ex, ey, coreCol);
        }
        if ((i & 1) === 0) p.glow(ex, ey, 4 + curR * 1.8, C[3], 0.3 * k);
      }
    }
  }

  // Outer 青岚风刃 (Cyan-Jade Wind-Blade sheath) wrapping around pillar `idx`
  function drawWindBlades(p, cx, h, w0, idx, windBreak, back, NZ) {
    for (let s = 0; s < 2; s++) {
      const baseA = s * Math.PI + idx * 0.8;
      for (let y = -3; y >= -h * 0.96; y--) {
        const v = -y / h;
        const ang = baseA + v * TAU * 1.85 - t * 10.5;
        const sn = Math.sin(ang), cs = Math.cos(ang);
        if ((sn < 0) !== back) continue;

        if (windBreak > 0 && rand(y, s + idx * 11, Math.floor(t * 30)) < windBreak * 1.15) continue;

        const foot = 1 + 0.35 * Math.max(0, 1 - -y / 14) ** 2;
        const topTaper = 1 - smooth(0.8, 0.96, v) * 0.7;
        const rWind = w0 * foot * topTaper * 1.12 + 2.2;
        const wx = cx + cs * rWind;
        const bladeW = (2.6 + 2.0 * Math.abs(cs)) * topTaper * (1 - windBreak * 0.5);

        for (let dx = -Math.ceil(bladeW); dx <= Math.ceil(bladeW); dx++) {
          const q = Math.abs(dx) / Math.max(0.6, bladeW);
          if (q > 1) continue;
          const col = q < 0.28 ? W[6] : q < 0.58 ? W[5] : q < 0.82 ? W[4] : W[2];
          p.px(wx + dx, y, col);
        }

        if (Math.abs(cs) > 0.92 && ((-y) | 0) % 20 === 0 && windBreak < 0.4) {
          const dirX = cs > 0 ? 0.38 : -0.38;
          flameBlade(p, wx, y, dirX, -0.92, 13 * (1 - windBreak), 2.2, -cs * 2.6, NZ, seed + idx * 71 + ((-y) | 0), HW);
        }
      }
    }
  }

  function drawShockRings(p, back) {
    const keep = back ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0;
    for (let idx = 0; idx < N_P; idx++) {
      const u = (t - T_ERUPT[idx]) / 0.36;
      if (u <= 0 || u >= 1) continue;
      const r = 10 + 38 * ease.outQuart(u);
      const th = Math.max(1, 3.6 * (1 - u));
      band(p, X_NODES[idx], 0.5, r, SY, th, (1 - u) * 1.05, [W[3], W[5], A[3], C[7]], keep, u < 0.16);
    }
  }

  return {
    update(dt) {
      t += dt;

      for (let idx = 0; idx < N_P; idx++) {
        if (t < T_ERUPT[idx] && R.chance(0.32 * dt * 60)) {
          const a = R.range(0, TAU), d = R.range(6, 24);
          ps.spawn(P.FLAKE, X_NODES[idx] + Math.cos(a) * d, Math.sin(a) * d * SY - 1, R.range(-8, 8), -R.range(18, 42), R.range(0.25, 0.45), A[3], R.chance(0.45) ? 1.5 : 1);
        }
      }

      if (!dashed && t >= T_DASH) {
        dashed = true;
        lights.add(134, -30, 95, C[4], 0.78, 0.25);
        for (let i = 0; i < 38; i++) {
          const x0 = R.range(-4, 220), y0 = -30 + R.range(-10, 10);
          ps.spawn(P.STREAK, x0, y0, R.range(140, 290), R.range(-14, 14), R.range(0.1, 0.2), R.chance(0.55) ? WHITE : C[4], 1, R.range(0, 0.08));
        }
      }

      for (let idx = 0; idx < N_P; idx++) {
        if (!nodeErupted[idx] && t >= T_ERUPT[idx]) {
          nodeErupted[idx] = true;
          const cx = X_NODES[idx];
          lights.add(cx, -54, 68, C[5], 0.72, 0.55);
          lights.add(cx, -12, 34, W[5], 0.75, 0.18);
          for (let i = 0; i < 24; i++) {
            const a = -Math.PI / 2 + R.range(-0.95, 0.95), sp = R.range(85, 225);
            ps.spawn(P.SPARK, cx + R.range(-6, 6), -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.24, 0.58));
          }
        }

        if (!nodeWindBroke[idx] && t >= T_WIND_BREAK[idx]) {
          nodeWindBroke[idx] = true;
          lights.add(X_NODES[idx], -68, 52, W[5], 0.55, 0.28);
        }

        if (!nodeFireBroke[idx] && t >= T_FIRE_BREAK[idx]) {
          nodeFireBroke[idx] = true;
          lights.add(X_NODES[idx], -64, 56, C[3], 0.58, 0.42);
        }
      }

      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      if (t >= T_END - 1e-6) return;
      drawArrayLinks(p);
      for (let idx = 0; idx < N_P; idx++) drawCloudThunderArray(p, idx);
      drawShockRings(p, true);
      simDraw(p, ps, H, "back");
    },
    draw(p) {
      if (t >= T_END - 1e-6) return;
      for (let idx = 0; idx < N_P; idx++) drawPillar(p, idx);
      drawHorizontalDash(p);
      simDraw(p, ps, H, "front");
      drawShockRings(p, false);

      for (let idx = 0; idx < N_P; idx++) {
        const eq = (t - T_ERUPT[idx]) / 0.08;
        if (eq >= 0 && eq < 1) {
          const cx = X_NODES[idx], ek = 1 - eq * 0.5;
          p.ellipse(cx, -2, 16 * ek, 4.5 * ek, W[5]);
          p.ellipse(cx, -2.5, 10 * ek, 2.8 * ek, WHITE);
          sparkle(p, cx, -6, 11 * (1 - eq), WHITE, W[5], 0.75);
        }
      }

      lights.draw(p);
    },
  };
}
