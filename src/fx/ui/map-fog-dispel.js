// UI map ink-fog dispel & grid illumination ("ui/map-fog-dispel"):
// 1. Release: Heavy ink-cyan (daiqing) and pale-white pixel clouds covering a dark UI map grid begin to swirl
//    and gather inward toward the center.
// 2. Hit & Vaporization: The center detonates with an oppressive jolt and a bright rectangular halo of interwoven
//    withered-yellow and purplish-crimson light that rapidly expands outward; wherever it sweeps, the pixel clouds
//    instantly vaporize and shatter into a sky full of flying cyan-white light motes.
// 3. Grid Unlock: Newly revealed pale ash-grey UI grid borders flash once in pure white highlight, then settle
//    into shimmering withered-yellow lines across the unlocked map cells.
// 4. Aftermath Result: Sporadic purplish-crimson and grey-white pixel dust motes continuously drift up from all
//    four outer edges of the grid and slowly fade into nothing before the UI grid folds away.
import { Particles, Lights, P, Rng, fit, flare, sparkle, clamp, seg, smooth, lerp, ease, noise2, TAU, WHITE, mix } from "../../core/index.js";
import { shake } from "./_lib.js";

export const meta = {
  name: "Map fog dispel",
  desc: "Ink-cyan and pale fog over a dark UI map grid swirls inward; a rectangular amber-and-purple halo blasts outward, vaporizing the fog into cyan-white motes and unlocking the grid.",
  tags: ["ui", "map", "fog", "grid", "unlock", "dispel", "ink", "hud", "one-shot"],
  size: [216, 148],
  origin: [108, 76],
  duration: 3.45,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1e1508", "#3d2c10", "#694c1a", "#997026", "#c99636", "#e8be58", "#f7e29c", "#ffffff"],
    purple: ["#1c0518", "#3d0b31", "#6e1454", "#a31f7a", "#d6339e", "#f56bc4", "#ffb5e2"],
    ink: ["#071217", "#0e222b", "#173847", "#235469", "#387c94", "#66b3c7", "#b4e4ed", "#eef9fc"],
    ash: ["#101218", "#1c202b", "#363c4f", "#5e6780", "#96a0b8", "#d8e0ed"],
    seed: 9,
  },
};

// Timing constants (seconds)
const T_HIT = 0.58; // Vortex compresses to center and rectangular halo detonates
const T_WAVE_END = 1.28; // Rectangular halo finishes sweeping outward across the map
const T_FOLD = 3.08; // Grid begins folding/fading out
const T_END = 3.45;

// UI Map Grid geometry: 5 cols x 3 rows of 24x24 cells = 120 x 72 px
const COLS = 5, ROWS = 3, CELL = 24;
const GW = COLS * CELL, GH = ROWS * CELL; // 120 x 72
const GX = -GW / 2, GY = -GH / 2; // -60 .. 60, -36 .. 36
const ASPECT = GH / GW; // 0.6
const WAVE_MAX = 78; // Max half-width of expanding rectangular halo

// Rectangular distance metric normalized to the 120x72 grid aspect ratio:
// returns half-width equivalent distance from (0, 0)
function rectDist(x, y) {
  return Math.max(Math.abs(x), Math.abs(y) / ASPECT);
}

export function create(o) {
  const Y = fit(o.palette, 8); // Withered-yellow ramp (枯黄色)
  const M = fit(o.purple, 7); // Purplish-crimson ramp (紫红色)
  const I = fit(o.ink, 8); // Ink-cyan to pale cyan-white ramp (浓重黛青色..苍白色/青白色)
  const A = fit(o.ash, 6); // Dark UI base, pale ash-grey grid & grey-white dust (深色底盘/苍灰色/灰白色)
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [WHITE, I[7], I[6], I[5], I[4]] });
  const lights = new Lights();
  const end = T_END - 0.06;

  // Swirling ink-cloud wisps pulled inward during Release (0 .. T_HIT)
  const swirlStreaks = Array.from({ length: 28 }, (_, i) => ({
    a0: (i / 28) * TAU + R.range(-0.1, 0.1),
    r0: R.range(36, 72),
    spin: R.range(2.6, 4.2),
    palIdx: i % 3 === 0 ? 7 : i % 2 === 0 ? 6 : 4,
  }));

  // Vaporized cyan-white light motes flung out as the rectangular halo vaporizes the ink-clouds
  const vaporMotes = [];
  // Aftermath purple-crimson & grey-white micro-dust rising from all 4 edges of the grid
  const edgeDust = [];

  let t = 0;
  let detonated = false;
  let vaporAcc = 0;
  let dustAcc = 0;

  // Expanding rectangular halo half-width rx(t): ease.outQuad for clear mid-grid progression
  const waveRxAt = (time) => {
    if (time < T_HIT) return 0;
    const u = clamp((time - T_HIT) / (T_WAVE_END - T_HIT));
    return 2 + WAVE_MAX * ease.outQuad(u);
  };

  return {
    update(dt) {
      t += dt;

      // Detonation at T_HIT
      if (!detonated && t >= T_HIT) {
        detonated = true;
        lights.add(0, 0, 88, Y[5], 0.65, 0.36);
        lights.add(0, 0, 68, M[5], 0.55, 0.32);
        lights.add(0, 0, 38, WHITE, 0.7, 0.08);
        // Initial burst of cyan-white vaporized light motes from the center
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * TAU + R.range(-0.08, 0.08);
          const sp = R.range(55, 130);
          ps.spawn(
            P.SPARK,
            Math.cos(a) * 3,
            Math.sin(a) * 2,
            Math.cos(a) * sp,
            Math.sin(a) * sp * 0.72,
            Math.min(R.range(0.24, 0.48), end - t),
          );
        }
      }

      // As the rectangular halo sweeps across the cloud bank (rx = 2 .. 66), vaporize clouds into flying cyan-white motes
      const curWaveR = waveRxAt(t);
      if (t >= T_HIT && t < T_WAVE_END - 0.08 && curWaveR < 68) {
        vaporAcc += dt * 170;
        while (vaporAcc >= 1) {
          vaporAcc -= 1;
          // Spawn along the 4 sides of the expanding rectangular wavefront
          const side = R.int(0, 3);
          const rx = curWaveR, ry = curWaveR * ASPECT;
          const x = side < 2 ? R.range(-rx, rx) : (side === 2 ? -rx : rx);
          const y = side < 2 ? (side === 0 ? -ry : ry) : R.range(-ry, ry);
          const a = Math.atan2(y, x) + R.range(-0.38, 0.38);
          const sp = R.range(42, 102);
          vaporMotes.push({
            x,
            y,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp * 0.82 - R.range(5, 15),
            age: 0,
            life: Math.min(R.range(0.42, 0.82), end - t),
            c: R.pick([I[7], I[6], I[5], WHITE]),
            big: R.chance(0.48),
            ph: R.range(0, TAU),
          });
        }
      }

      for (let i = vaporMotes.length - 1; i >= 0; i--) {
        const v = vaporMotes[i];
        v.age += dt;
        if (v.age >= v.life) {
          vaporMotes.splice(i, 1);
          continue;
        }
        v.vx -= v.vx * 3.6 * dt;
        v.vy -= v.vy * 3.6 * dt;
        v.x = clamp(v.x + (v.vx + Math.cos(t * 10 + v.ph) * 4) * dt, -96, 96);
        v.y = clamp(v.y + (v.vy - 6) * dt, -64, 60);
      }

      // Aftermath: sporadic purple-crimson & grey-white pixel micro-dust rising from all 4 outer edges of the grid
      if (t >= T_HIT + 0.32 && t < T_FOLD - 0.14) {
        dustAcc += dt * 28;
        while (dustAcc >= 1) {
          dustAcc -= 1;
          const edge = R.int(0, 3); // 0 top, 1 bottom, 2 left, 3 right
          let x, y, vx, vy;
          if (edge === 0) {
            x = R.range(GX - 2, GX + GW + 2);
            y = GY + R.range(-4, 1);
            vx = R.range(-6, 6);
            vy = -R.range(12, 24);
          } else if (edge === 1) {
            x = R.range(GX - 2, GX + GW + 2);
            y = GY + GH + R.range(-1, 4);
            vx = R.range(-6, 6);
            vy = -R.range(8, 16);
          } else if (edge === 2) {
            x = GX + R.range(-5, 0);
            y = R.range(GY - 2, GY + GH + 2);
            vx = -R.range(5, 13);
            vy = -R.range(10, 20);
          } else {
            x = GX + GW + R.range(0, 5);
            y = R.range(GY - 2, GY + GH + 2);
            vx = R.range(5, 13);
            vy = -R.range(10, 20);
          }
          const isPurple = (edgeDust.length % 2 === 0);
          edgeDust.push({
            x,
            y,
            vx,
            vy,
            age: 0,
            life: Math.min(R.range(0.62, 1.08), end - t),
            isPurple,
            c: isPurple ? R.pick([M[4], M[5], M[6]]) : R.pick([A[4], A[5]]),
            big: R.chance(0.45),
            ph: R.range(0, TAU),
          });
        }
      }
      for (let i = edgeDust.length - 1; i >= 0; i--) {
        const d = edgeDust[i];
        d.age += dt;
        if (d.age >= d.life) {
          edgeDust.splice(i, 1);
          continue;
        }
        d.x += (d.vx + Math.sin(t * 5.5 + d.ph) * 5) * dt;
        d.y += d.vy * dt;
      }

      ps.update(dt);
      lights.update(dt);
    },

    draw(p) {
      // Oppressive shake when the rectangular halo detonates
      const [sx, sy] = shake(t, 4.0, T_HIT, 0.36, o.seed, 38);
      const env = ease.outCubic(seg(t, 0, 0.12)) * (1 - ease.inCubic(seg(t, T_FOLD, T_END - 0.04)));
      if (env <= 0.01) return;

      const waveRx = waveRxAt(t);

      // 1. UI Map Base & Grid Unlock Choreography
      const gx0 = GX + sx, gy0 = GY + sy;
      // Dark UI map backing plate
      p.rect(gx0 - 3, gy0 - 3, GW + 6, GH + 6, A[0], env);
      p.rect(gx0 - 1, gy0 - 1, GW + 2, GH + 2, A[1], env);
      p.rect(gx0, gy0, GW, GH, A[0], env);

      // Exact unlock time for coordinate at rectangular distance d:
      // Since waveRx(t) = 2 + WAVE_MAX * (1 - (1 - u)^2), inverse is u = 1 - sqrt(1 - (d - 2) / WAVE_MAX)
      const gridStateAt = (lx, ly, isBorder = false) => {
        const d = rectDist(lx, ly);
        if (t < T_HIT || d > waveRx) {
          // Locked under fog: dark-slate grid line
          return { col: isBorder ? A[2] : A[1], white: false, unlocked: false };
        }
        const normD = clamp((d - 2) / WAVE_MAX, 0, 1);
        const uUnlock = 1 - Math.sqrt(1 - normD);
        const tUnlock = T_HIT + (T_WAVE_END - T_HIT) * uUnlock;
        const dt = Math.max(0, t - tUnlock);

        if (dt < 0.09) {
          // Step 1: Newly exposed pale ash-grey UI grid border (新显露出的苍灰色UI网格边框)
          return { col: isBorder ? A[5] : A[4], white: false, unlocked: true };
        }
        if (dt < 0.23) {
          // Step 2: Instantaneous pure-white highlight flash (瞬间亮起一次纯白高光)
          return { col: WHITE, white: true, unlocked: true };
        }
        // Step 3: Settles into shimmering withered-yellow lines (随后沉淀为微光闪烁的枯黄色线条)
        const settleK = clamp((dt - 0.23) / 0.16);
        const shimmer = 0.5 + 0.5 * Math.sin(t * 11 + lx * 0.12 + ly * 0.15);
        const shimmerStep = shimmer > 0.76 ? Y[6] : shimmer > 0.32 ? Y[5] : Y[4];
        return { col: settleK < 0.45 ? Y[6] : shimmerStep, white: false, unlocked: true };
      };

      // Subtle topographic map runes/contours inside unlocked cells
      if (t >= T_HIT) {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const cx = -GW / 2 + (c + 0.5) * CELL;
            const cy = -GH / 2 + (r + 0.5) * CELL;
            if (rectDist(cx, cy) > waveRx - 4) continue;
            const px = Math.round(cx + sx), py = Math.round(cy + sy);
            if ((c + r) % 2 === 0) {
              p.dot(px - 3, py + 2, Y[1], 0.75 * env);
              p.dot(px - 2, py + 1, Y[2], 0.75 * env);
              p.dot(px - 1, py + 2, Y[1], 0.75 * env);
              p.dot(px + 3, py - 2, A[2], 0.7 * env);
            } else {
              p.dot(px, py, Y[2], 0.8 * env);
              p.dot(px - 4, py - 3, A[2], 0.65 * env);
              p.dot(px + 4, py + 3, A[2], 0.65 * env);
            }
          }
        }
      }

      // Draw vertical and horizontal UI grid lines
      for (let c = 0; c <= COLS; c++) {
        const lx = -GW / 2 + c * CELL;
        const isOuter = c === 0 || c === COLS;
        for (let ly = -GH / 2; ly <= GH / 2; ly++) {
          const st = gridStateAt(lx, ly, isOuter);
          p.dot(lx + sx, ly + sy, st.col, env);
          if (st.white && (ly & 3) === 0) p.light(lx + sx, ly + sy, WHITE, 0.38 * env);
          else if (st.unlocked && (ly & 7) === 0) p.light(lx + sx, ly + sy, Y[4], 0.16 * env);
        }
      }
      for (let r = 0; r <= ROWS; r++) {
        const ly = -GH / 2 + r * CELL;
        const isOuter = r === 0 || r === ROWS;
        for (let lx = -GW / 2; lx <= GW / 2; lx++) {
          const st = gridStateAt(lx, ly, isOuter);
          p.dot(lx + sx, ly + sy, st.col, env);
          if (st.white && (lx & 3) === 0) p.light(lx + sx, ly + sy, WHITE, 0.38 * env);
          else if (st.unlocked && (lx & 7) === 0) p.light(lx + sx, ly + sy, Y[4], 0.16 * env);
        }
      }

      // Grid intersection crosshairs & ornate outer map corner clasps
      for (let r = 0; r <= ROWS; r++) {
        for (let c = 0; c <= COLS; c++) {
          const lx = -GW / 2 + c * CELL, ly = -GH / 2 + r * CELL;
          const st = gridStateAt(lx, ly, true);
          if (st.unlocked) {
            const nodeCol = st.white ? WHITE : Y[6];
            p.dot(lx + sx, ly + sy, nodeCol, env);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              if (Math.abs(lx + dx) <= GW / 2 && Math.abs(ly + dy) <= GH / 2) {
                p.dot(lx + dx + sx, ly + dy + sy, st.col, env);
              }
            }
          }
        }
      }
      // Heavy outer UI corner brackets
      for (const dx of [-1, 1]) {
        for (const dy of [-1, 1]) {
          const cx = dx * (GW / 2 + 2), cy = dy * (GH / 2 + 2);
          const st = gridStateAt(dx * (GW / 2), dy * (GH / 2), true);
          for (let k = 0; k < 5; k++) {
            p.dot(cx - dx * k + sx, cy + sy, st.col, env);
            p.dot(cx + sx, cy - dy * k + sy, st.col, env);
          }
        }
      }

      // 2. Release & Vaporization: Heavy Ink-Cyan (黛青) & Pale-White (苍白) Pixel Clouds Swirling to Center
      if (t < T_WAVE_END - 0.08) {
        const gatherU = clamp(t / T_HIT);
        // Superellipse cloud boundary shrouds the full 120x72 UI grid initially (1.32), then contracts inward (0.86)
        const maxEnv = lerp(1.32, 0.86, ease.inOutQuad(gatherU));
        const spin = gatherU * gatherU * 3.9 + Math.max(0, t - T_HIT) * 3.2;

        p.each(GX - 8 + sx, GY - 8 + sy, GX + GW + 8 + sx, GY + GH + 8 + sy, (x, y, px, py) => {
          const lx = x - sx, ly = y - sy;
          const rRect = rectDist(lx, ly);
          // Any cloud inside the expanding rectangular shockwave halo is instantly vaporized!
          if (t >= T_HIT && rRect < waveRx - 1.5) return;

          const dx = lx / (GW / 2), dy = ly / (GH / 2);
          const rEll = Math.hypot(dx, dy);
          const rSuper = Math.pow(dx * dx * dx * dx + dy * dy * dy * dy, 0.25);
          // Superellipse shape covers the rectangular map grid at t=0 and rounds toward a vortex as gatherU -> 1
          const shapeR = lerp(rSuper, rSuper * 0.45 + rEll * 0.55, gatherU);
          const billow = 0.09 * noise2(dx * 3.4 + t * 1.4, dy * 3.4 - t * 1.2, o.seed + 19);
          if (shapeR + billow > maxEnv) return;

          // Logarithmic spiral coordinates winding inward
          const th = Math.atan2(dy, dx);
          const logR = Math.log(Math.max(0.06, rEll));
          const swirlA = th + 2.35 * logR + spin + t * 2.0;
          const n1 = noise2(Math.cos(swirlA) * 2.2 + rEll * 3.0 - t * 2.5, Math.sin(swirlA) * 2.2 + rEll * 3.0, o.seed);
          const n2 = noise2(lx * 0.08 + spin * 0.5, ly * 0.1 - t * 1.8, o.seed + 5);
          const spiralArm = 0.5 + 0.5 * Math.cos(swirlA * 3 + n1 * 2.1);
          const edgeFade = 1 - smooth(maxEnv - 0.18, maxEnv, shapeR + billow);
          const centerPull = 1 + 0.46 * gatherU * (1 - clamp(rEll, 0, 1));
          const dens = (0.45 * spiralArm + 0.35 * (n1 * 0.5 + 0.5) + 0.2 * (n2 * 0.5 + 0.5)) * edgeFade * centerPull;

          if (dens < 0.18) return;

          // Boiling cyan-white vaporization rim right where the rectangular halo cuts into the ink cloud
          if (t >= T_HIT && rRect < waveRx + 4.8) {
            p.blendPx(px, py, rRect < waveRx + 2.0 ? WHITE : I[7], 0.96 * env);
            p.add(px, py, I[6], 0.48 * env);
            return;
          }

          // Quantized ink-wash cloud steps: deep ink-cyan (浓重黛青色 I[1]..I[3]) & pale-white crests (苍白色 I[6]..I[7])
          let col, alpha;
          if (dens > 0.71 || (rEll < 0.36 * gatherU && spiralArm > 0.6)) {
            col = dens > 0.83 ? I[7] : I[6]; // Pale-white cloud crest (苍白色云雾)
            alpha = 0.92;
          } else if (dens > 0.52) {
            col = I[3]; // Rich ink slate-cyan
            alpha = 0.9;
          } else if (dens > 0.34) {
            col = I[2]; // Deep ink-cyan (浓重黛青色)
            alpha = 0.88;
          } else {
            col = I[1]; // Darkest ink-cyan shadow
            alpha = 0.8;
          }
          p.blendPx(px, py, col, alpha * env);
          if (dens > 0.75) p.add(px, py, I[6], 0.14 * env);
        });

        // Swirling cloud-fleck streaks pulled into the vortex during Release
        if (t < T_HIT) {
          for (const s of swirlStreaks) {
            const u = t / T_HIT;
            const r = s.r0 * (1 - 0.72 * ease.inQuad(u));
            const a = s.a0 + u * s.spin + 1.4 * Math.log(Math.max(4, r) / s.r0);
            const x0 = Math.cos(a) * r + sx, y0 = Math.sin(a) * r * ASPECT + sy;
            const a1 = a - 0.25, x1 = Math.cos(a1) * (r + 4.5) + sx, y1 = Math.sin(a1) * (r + 4.5) * ASPECT + sy;
            const col = I[s.palIdx];
            p.line(x1, y1, x0, y0, col, 0.88 * env);
            if (s.palIdx >= 6) p.glow(x0, y0, 4, I[6], 0.28 * u);
          }
          // Gathering eye glow at (0, 0) as the clouds compress inward
          const eyeK = ease.inCubic(gatherU);
          p.glow(sx, sy, 6 + 18 * eyeK, I[6], 0.48 * eyeK);
          if (gatherU > 0.6) {
            p.circle(sx, sy, 2.5 * eyeK, I[7]);
            p.px(sx, sy, WHITE);
          }
        }
      }

      // 3. Hit Climax: Rectangular Interwoven Withered-Yellow (枯黄) & Purplish-Crimson (紫红) Shockwave Halo
      const wk = (t - T_HIT) / (T_WAVE_END - T_HIT);
      if (wk >= 0 && wk < 1) {
        const rx = waveRx, ry = waveRx * ASPECT;
        const fade = 1 - smooth(0.62, 1, wk);
        const bandW = Math.max(2.0, 4.2 * (1 - 0.26 * wk));
        const bx1 = Math.ceil(rx + 8), by1 = Math.ceil(ry + 7);

        // Center hero flash on the first 2 frames of detonation
        if (t < T_HIT + 0.065) {
          const fk = 1 - (t - T_HIT) / 0.065;
          flare(p, sx, sy, 28 * fk, fk, Y);
          p.circle(sx, sy, 6.5 * fk, WHITE);
        }

        // Draw the expanding rectangular interwoven halo
        p.each(-bx1 + sx, -by1 + sy, bx1 + sx, by1 + sy, (x, y, px, py) => {
          const lx = x - sx, ly = y - sy;
          const d = rectDist(lx, ly);
          if (Math.abs(d - rx) > bandW + 3.2) return;

          // Perimeter phase around the rectangle so Withered-Yellow (Y) and Purplish-Crimson (M) weave over/under
          const theta = Math.atan2(ly / ASPECT, lx);
          const weave = Math.sin(theta * 6 - wk * 16) * 2.35;
          const dAmber = rx + weave;
          const dPurple = rx - weave;

          const uY = 1 - Math.abs(d - dAmber) / bandW;
          const uM = 1 - Math.abs(d - dPurple) / bandW;
          if (uY <= 0 && uM <= 0) return;

          let c, u;
          if (uY > 0.42 && uM > 0.42) {
            // Interwoven crossover node (交织高光节点)
            u = Math.max(uY, uM);
            c = u > 0.74 ? WHITE : mix(Y[6], M[5], 0.5);
          } else if (uY >= uM) {
            u = uY;
            c = wk < 0.06 && u > 0.78 ? WHITE : u > 0.65 ? Y[6] : u > 0.34 ? Y[5] : Y[4];
          } else {
            u = uM;
            c = wk < 0.06 && u > 0.78 ? WHITE : u > 0.65 ? M[5] : u > 0.34 ? M[4] : M[3];
          }
          p.blendPx(px, py, c, fade * Math.min(1, u * 1.15) * 0.96);
          if (u > 0.55) p.add(px, py, uY >= uM ? Y[4] : M[4], fade * u * 0.22);
        });

        // Sharp rectangular corner glints riding the 4 corners of the expanding halo
        for (const dx of [-1, 1]) {
          for (const dy of [-1, 1]) {
            const cx = sx + dx * rx, cy = sy + dy * ry;
            sparkle(p, cx, cy, 2.6 * fade, Y[6], M[5], 0.45 * fade);
          }
        }
      }

      // 4. Vaporized Cyan-White Light Motes (漫天飞散的青白色光粒)
      for (const v of vaporMotes) {
        const k = 1 - v.age / v.life;
        const tw = 0.74 + 0.26 * Math.sin(t * 18 + v.ph);
        const a = Math.min(1, v.age / 0.04) * k * tw;
        if (a <= 0.04) continue;
        const X = Math.round(v.x + sx), Y0 = Math.round(v.y + sy);
        p.dot(X, Y0, k > 0.56 ? WHITE : v.c, a);
        if (v.big && k > 0.25) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            p.dot(X + dx, Y0 + dy, I[6], a * 0.82);
          }
        } else {
          p.dot(X - Math.sign(v.vx || 1), Y0, I[5], a * 0.8);
        }
        p.glow(X, Y0, 4.5, I[6], 0.42 * a);
      }

      // 5. Aftermath: Sporadic Purplish-Crimson & Grey-White Pixel Dust Rising from All 4 Grid Edges
      for (const d of edgeDust) {
        const k = 1 - d.age / d.life;
        const tw = 0.75 + 0.25 * Math.sin(t * 13 + d.ph);
        const a = Math.min(1, d.age / 0.06) * Math.min(1, k * 1.6) * tw * env;
        if (a <= 0.04) continue;
        const X = Math.round(d.x + sx), Y0 = Math.round(d.y + sy);
        const head = d.isPurple ? (k > 0.65 ? M[6] : d.c) : (k > 0.65 ? WHITE : d.c);
        p.dot(X, Y0, head, a);
        if (d.big && k > 0.28) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            p.dot(X + dx, Y0 + dy, d.c, a * 0.78);
          }
        } else {
          p.dot(X, Y0 + 1, d.isPurple ? M[3] : A[3], a * 0.82);
        }
        p.glow(X, Y0, 5, d.isPurple ? M[5] : A[4], 0.42 * a);
      }

      ps.draw(p);
      lights.draw(p);
    },
  };
}
