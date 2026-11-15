// UI status bar spirit-wave flush & instant full charge ("ui/status-bar-flush"):
// 1. Release: At the far-left entrance of both the UI HP bar and the Energy slot, two soft orbs of interwoven
//    cloud-white and warm-yellow light kindle simultaneously.
// 2. Hit & Flush: A pixel light-wave of interwoven pure-white and withered-yellow rapidly flushes from left to
//    right across the entire UI bar; wherever the wave sweeps, all coral-red HP segments and cangqing energy
//    segments sequentially fill to 100% and gently bounce upward once.
// 3. Flush Completion Climax: As the light-wave bursts out of the far-right end of the UI slot, the frame jolts
//    with oppressive force and scatters a cluster of mixed warm-gold, coral-red, and cangqing pixel light motes.
// 4. Aftermath Result: A slowly breathing translucent grey-white thin mist halo envelops the outer perimeter of
//    the entire UI bar while specks of golden-yellow pixel afterglow drift down from above before folding out.
import { Particles, Lights, P, Rng, fit, flare, clamp, seg, smooth, ease, noise2, TAU, WHITE, hex } from "../../core/index.js";
import { panel, shake, HEART, heartPal } from "./_lib.js";

export const meta = {
  name: "Status bar flush",
  desc: "Cloud-white and warm-yellow orbs ignite at the left of a dual HP and energy bar; a white-and-amber wave flushes right, filling and bouncing cells into a tri-color burst and mist.",
  tags: ["ui", "status", "health", "energy", "flush", "heal", "bar", "hud", "one-shot"],
  size: [236, 108],
  origin: [104, 56],
  duration: 3.45,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#24060a", "#520d16", "#8c1724", "#c92836", "#f24b52", "#ff7b78", "#ffb8b3", "#ffffff"],
    gold: ["#241705", "#4d320b", "#7d5314", "#b57b22", "#e3a838", "#ffd463", "#fff0b3", "#ffffff"],
    cyan: ["#07171e", "#10303b", "#1c5263", "#2e7f94", "#52b4c7", "#96e3f0", "#e8fbff"],
    mist: ["#363b48", "#586073", "#848ea3", "#b8c1d4", "#eef3fc"],
    seed: 11,
  },
};

// Timing constants (seconds)
const T_OPEN = 0.14; // UI status plate unfolds
const T_SWEEP = 0.56; // Twin left orbs launch into the left-to-right light-wave flush
const T_BURST = 1.22; // Light-wave bursts out of the far-right end of the UI slot
const T_FOLD = 3.08; // UI status plate begins folding away
const T_END = 3.45;

// Dual-track UI status bar geometry in local coords around origin (104, 56)
const CELLS = 10;
const CW = 10, GAP = 1;
const BW = CELLS * CW + (CELLS - 1) * GAP; // 109 px total track width
const BX = -50; // Track spans x = -50 .. +59 (leaves +73px on the right for the burst plume)
const HY = -9, HH = 7; // Top Coral-Red HP bar: y = -9 .. -2
const EY = 2, EH = 5; // Bottom Cangqing Energy bar: y = +2 .. +7
const FX = BX - 22, FY = -15, FW = BW + 25, FH = 28; // Outer HUD frame: x = -72 .. +62, y = -15 .. +13

export function create(o) {
  const C = fit(o.palette, 8); // Coral-red ramp (珊瑚红)
  const G = fit(o.gold, 8); // Withered-yellow / warm-yellow / warm-gold ramp (枯黄色/暖黄色/暖金色/金黄色)
  const Q = fit(o.cyan, 7); // Cangqing / pale-cyan ramp (苍青色)
  const M = fit(o.mist, 5); // Cloud-white & grey-white thin mist ramp (云白色/灰白色薄雾)
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [WHITE, G[5], C[5], Q[5]] });
  const lights = new Lights();
  const hPal = heartPal(C);
  const end = T_END - 0.06;

  // Mixed Warm-Gold, Coral-Red & Cangqing pixel light motes scattered from the far-right end
  const burstMotes = [];
  // Golden-yellow pixel afterglow specks drifting down from above the UI bar
  const afterglow = [];

  let t = 0;
  let burstDone = false;
  let burstWave2 = false;
  let glowAcc = 0;

  // Smooth, punchy left-to-right wave progress u in [0, 1] with exact analytical inverse
  const sweepAt = (time) => {
    if (time < T_SWEEP) return 0;
    if (time >= T_BURST) return 1;
    const u = (time - T_SWEEP) / (T_BURST - T_SWEEP);
    return ease.inOutSine(u);
  };

  // Exact time when sweepAt(t) reaches normalized position pos in [0, 1]
  const timeAtPos = (pos) => {
    const p = clamp(pos, 0, 1);
    const u = Math.acos(1 - 2 * p) / Math.PI;
    return T_SWEEP + (T_BURST - T_SWEEP) * u;
  };

  const spawnTriColorBurst = (count, minSp, maxSp) => {
    const rx = BX + BW + 1;
    for (let i = 0; i < count; i++) {
      const kind = i % 3; // 0: Warm-Gold (暖金色), 1: Coral-Red (珊瑚红), 2: Cangqing (苍青色)
      const baseA = R.chance(0.88) ? R.range(-0.98, 0.98) : R.range(-1.65, 1.65);
      const a = baseA + (kind === 1 ? -0.14 : kind === 2 ? 0.14 : 0);
      const sp = R.range(minSp, maxSp);
      const col = kind === 0
        ? R.pick([G[4], G[5], G[6]])
        : kind === 1
          ? R.pick([C[4], C[5], C[6]])
          : R.pick([Q[4], Q[5], Q[6]]);
      const core = kind === 0 ? G[6] : kind === 1 ? C[6] : Q[6];
      burstMotes.push({
        x: rx + R.range(0, 4),
        y: kind === 1 ? R.range(HY - 1, HY + HH + 1) : kind === 2 ? R.range(EY - 1, EY + EH + 1) : R.range(HY - 1, EY + EH + 1),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.76 - R.range(2, 9),
        age: 0,
        life: Math.min(R.range(0.54, 1.08), end - t),
        col,
        core,
        big: R.chance(0.58),
        ph: R.range(0, TAU),
        trail: [],
      });
    }
  };

  return {
    update(dt) {
      t += dt;

      // Fine trailing sparkles shed by the pure-white & withered-yellow light-wave during the sweep
      if (t >= T_SWEEP && t < T_BURST && R.chance(0.75)) {
        const wx = BX + BW * sweepAt(t);
        ps.spawn(
          P.SPARK,
          wx + R.range(-4, 2),
          R.range(HY - 1, EY + EH + 1),
          R.range(-42, -12),
          R.range(-26, 26),
          Math.min(R.range(0.14, 0.28), end - t),
        );
      }

      // Phase 3: Flush Completion Climax at T_BURST when the light-wave bursts out the far-right end
      if (!burstDone && t >= T_BURST) {
        burstDone = true;
        const rx = BX + BW;
        lights.add(rx + 6, -1, 86, G[5], 0.76, 0.44);
        lights.add(rx + 14, -6, 64, C[5], 0.64, 0.4);
        lights.add(rx + 14, 6, 64, Q[5], 0.64, 0.4);
        lights.add(rx + 2, -1, 38, WHITE, 0.85, 0.1);
        spawnTriColorBurst(38, 68, 168);
      }
      if (!burstWave2 && t >= T_BURST + 0.07) {
        burstWave2 = true;
        spawnTriColorBurst(22, 48, 125);
      }

      for (let i = burstMotes.length - 1; i >= 0; i--) {
        const m = burstMotes[i];
        m.age += dt;
        if (m.age >= m.life) {
          burstMotes.splice(i, 1);
          continue;
        }
        m.trail.unshift([m.x, m.y]);
        if (m.trail.length > 4) m.trail.pop();
        m.vx -= m.vx * 1.95 * dt;
        m.vy = m.vy * (1 - 1.95 * dt) + 12 * dt;
        m.x = clamp(m.x + m.vx * dt, -96, 124);
        m.y = clamp(m.y + m.vy * dt, -46, 44);
      }

      // Phase 4: Golden-yellow pixel afterglow specks drifting down from above the UI bar
      if (t >= T_BURST - 0.08 && t < T_FOLD - 0.14) {
        glowAcc += dt * 28;
        while (glowAcc >= 1) {
          glowAcc -= 1;
          afterglow.push({
            x: R.range(FX - 4, FX + FW + 4),
            y: FY - R.range(7, 25),
            vx: R.range(-4.5, 4.5),
            vy: R.range(9.5, 18.5),
            age: 0,
            life: Math.min(R.range(0.72, 1.22), end - t),
            c: R.pick([G[4], G[5], G[6]]),
            big: R.chance(0.46),
            ph: R.range(0, TAU),
          });
        }
      }

      for (let i = afterglow.length - 1; i >= 0; i--) {
        const g = afterglow[i];
        g.age += dt;
        if (g.age >= g.life) {
          afterglow.splice(i, 1);
          continue;
        }
        g.x += (g.vx + Math.sin(t * 5.0 + g.ph) * 5.5) * dt;
        g.y += g.vy * dt;
      }

      ps.update(dt);
      lights.update(dt);
    },

    draw(p) {
      // Oppressive shake when the light-wave blasts out the far-right end of the UI slot
      const [sx, sy] = shake(t, 4.2, T_BURST, 0.36, o.seed, 36);
      const open = ease.outBack(seg(t, 0, T_OPEN), 1.8) * (1 - ease.inBack(seg(t, T_FOLD, T_END - 0.04), 1.8));
      if (open <= 0.02) return;

      const ox = sx, oy = sy;
      const flashFrame = t >= T_BURST && t < T_BURST + 0.07;

      // 1. Post-Hit Result: Slowly breathing grey-white thin mist halo around the entire UI bar outer perimeter
      if (t >= T_BURST - 0.04) {
        const mistIn = ease.outCubic(seg(t, T_BURST - 0.04, T_BURST + 0.28));
        const mistOut = 1 - smooth(T_FOLD - 0.16, T_END - 0.05, t);
        // Slow breathing oscillation (缓慢呼吸) in both intensity and halo thickness
        const breathPhase = Math.sin((t - T_BURST) * 4.4);
        const breathK = 0.74 + 0.26 * breathPhase;
        const maxDist = 8.0 + 2.2 * breathPhase;
        const mistEnv = mistIn * mistOut * breathK * open;

        const padX = 11, padY = 10;
        p.each(FX - padX + ox, FY - padY + oy, FX + FW + padX + ox, FY + FH + padY + oy, (x, y, px, py) => {
          const lx = x - ox, ly = y - oy;
          const dx = Math.max(FX - lx, 0, lx - (FX + FW));
          const dy = Math.max(FY - ly, 0, ly - (FY + FH));
          const distOut = Math.hypot(dx, dy);
          // Envelop the outer perimeter of the UI bar (and 1px of its outer rim)
          if (distOut < 0.1 && lx > FX + 2 && lx < FX + FW - 2 && ly > FY + 2 && ly < FY + FH - 2) return;
          if (distOut > maxDist) return;

          const n1 = noise2(lx * 0.085 - t * 1.3, ly * 0.13 + Math.sin(t * 1.9), o.seed + 31);
          const n2 = noise2(lx * 0.17 + t * 1.7, ly * 0.21 - t * 1.1, o.seed + 47);
          const wisp = 0.56 * (n1 * 0.5 + 0.5) + 0.44 * (n2 * 0.5 + 0.5);
          const falloff = 1 - distOut / maxDist;
          const d = falloff * (0.48 + 0.52 * wisp) * mistEnv;
          if (d < 0.15) return;

          const mc = d > 0.62 ? M[4] : d > 0.42 ? M[3] : d > 0.25 ? M[2] : M[1];
          p.blendPx(px, py, mc, Math.min(0.68, d * 0.82));
          if (d > 0.4) p.add(px, py, M[4], d * 0.24);
        });
      }

      // 2. Dark Ornate UI Status Bar Outer Plate
      const fh = Math.max(4, Math.round(FH * open));
      const fy0 = Math.round(FY + (FH - fh) / 2) + oy;
      const fx0 = FX + ox;
      const plateCols = flashFrame
        ? { outline: G[5], rim: WHITE, top: hex("#3d3550"), body: hex("#282238"), low: hex("#1a1526") }
        : { outline: hex("#0d0b14"), rim: hex("#4c4663"), top: hex("#262235"), body: hex("#1a1726"), low: hex("#110e1a") };
      panel(p, fx0, fy0, FW, fh, plateCols, { r: Math.min(5, Math.floor(fh / 2)) });

      if (open > 0.7) {
        // Left HUD emblems: Heart for Coral-Red HP row, Cangqing Mana Crystal for Energy row
        const emblemHop = t >= T_SWEEP && t < T_SWEEP + 0.24
          ? Math.round(-2 * Math.sin(clamp((t - T_SWEEP) / 0.24) * Math.PI))
          : 0;
        p.sprite(HEART, hPal, BX - 17 + ox, HY - 2 + oy + emblemHop);
        const mx = BX - 11 + ox, my = EY + 2 + oy + emblemHop;
        for (let dy = -3; dy <= 3; dy++) {
          const span = 3 - Math.abs(dy);
          for (let dx = -span; dx <= span; dx++) {
            const mc = Math.abs(dx) + Math.abs(dy) === 3 ? Q[1] : dy < 0 && dx <= 0 ? Q[6] : dy < 1 ? Q[4] : Q[3];
            p.px(mx + dx, my + dy, mc);
          }
        }

        // 3. Draw 10 Segmented Coral-Red HP Cells & 10 Cangqing Energy Cells with Sequential Fill & Upward Bounce
        const sweepU = sweepAt(t);
        for (let i = 0; i < CELLS; i++) {
          const cellStartU = i / CELLS;
          const cellMidU = (i + 0.35) / CELLS;
          const tHitCell = timeAtPos(cellMidU);
          const dtCell = t - tHitCell;
          const isFilled = t >= T_SWEEP && sweepU >= cellStartU;
          const fillFrac = clamp(sweepU * CELLS - i, 0, 1);

          // Gentle upward bounce once as the wave fills each cell (依次填满并轻轻弹起一下)
          let bounceY = 0;
          if (dtCell > 0 && dtCell < 0.26) {
            const bk = dtCell / 0.26;
            bounceY = Math.round(-3.4 * Math.sin(bk * Math.PI) * (1 - 0.3 * bk));
          }
          const justFlashed = dtCell >= -0.01 && dtCell < 0.065;

          const cx0 = BX + i * (CW + GAP) + ox;
          // Recessed empty socket stays at baseline first
          p.rect(cx0 - 1, HY + oy - 1, CW + 2, HH + 2, hex("#0d0b14"));
          p.rect(cx0, HY + oy, CW, HH, hex("#181322"));
          p.rect(cx0, HY + oy, CW, 1, hex("#251e33"));

          p.rect(cx0 - 1, EY + oy - 1, CW + 2, EH + 2, hex("#0d0b14"));
          p.rect(cx0, EY + oy, CW, EH, hex("#111923"));
          p.rect(cx0, EY + oy, CW, 1, hex("#1c2938"));

          if (isFilled) {
            const hy0 = HY + oy + bounceY;
            const ey0 = EY + oy + bounceY;
            const wFill = Math.max(1, Math.round(CW * fillFrac));

            // 1px dark outline around the bouncing filled segment so its upward pop reads super crisply
            p.rect(cx0 - 1, hy0 - 1, wFill + 2, HH + 2, hex("#0d0b14"));
            p.rect(cx0 - 1, ey0 - 1, wFill + 2, EH + 2, hex("#0d0b14"));

            // Coral-Red HP Segment (珊瑚红血格)
            for (let py = 0; py < HH; py++) {
              for (let px = 0; px < wFill; px++) {
                let col;
                if (justFlashed) {
                  col = py < 2 ? WHITE : C[6];
                } else {
                  col = py === 0 ? C[6] : py < 2 ? C[5] : py < 5 ? C[4] : C[3];
                  if (px === 0) col = py < 3 ? C[6] : C[4];
                  else if (px === wFill - 1) col = py < 2 ? C[5] : C[3];
                }
                p.px(cx0 + px, hy0 + py, col);
              }
            }

            // Cangqing / Pale-Cyan Energy Segment (能量格)
            for (let py = 0; py < EH; py++) {
              for (let px = 0; px < wFill; px++) {
                let col;
                if (justFlashed) {
                  col = py < 2 ? WHITE : Q[6];
                } else {
                  col = py === 0 ? Q[6] : py < 2 ? Q[5] : py < 4 ? Q[4] : Q[3];
                  if (px === 0) col = py < 2 ? Q[6] : Q[4];
                  else if (px === wFill - 1) col = py < 2 ? Q[5] : Q[3];
                }
                p.px(cx0 + px, ey0 + py, col);
              }
            }

            if (justFlashed) {
              p.glow(cx0 + wFill * 0.5, hy0 + HH * 0.5, 8, C[5], 0.45);
              p.glow(cx0 + wFill * 0.5, ey0 + EH * 0.5, 7, Q[5], 0.42);
            }
          }
        }

        // 4. Phase 1 (Release): Two Soft Interwoven Cloud-White (云白色) & Warm-Yellow (暖黄色) Orbs at Far-Left
        if (t < T_SWEEP + 0.12) {
          const orbIn = ease.outCubic(seg(t, 0.03, 0.24));
          const orbOut = 1 - smooth(T_SWEEP - 0.04, T_SWEEP + 0.12, t);
          const ok = orbIn * orbOut;
          if (ok > 0.02) {
            const lx = BX + 3 + ox;
            const hyC = HY + HH * 0.5 + oy;
            const eyC = EY + EH * 0.5 + oy;
            const pulse = 1 + 0.14 * Math.sin(t * 18);
            const rHP = 5.4 * pulse * ok;
            const rEN = 4.8 * pulse * ok;

            // Render each of the two left orbs with interwoven Cloud-White (M[4]/WHITE) and Warm-Yellow (G[5]/G[6])
            for (const [cy, rOrb, phaseOff] of [[hyC, rHP, 0], [eyC, rEN, 2.2]]) {
              const rCeil = Math.ceil(rOrb + 2);
              p.each(lx - rCeil, cy - rCeil, lx + rCeil, cy + rCeil, (x, y, px, py) => {
                const d = Math.hypot(x - lx, y - cy);
                if (d > rOrb) return;
                const u = 1 - d / rOrb;
                const ang = Math.atan2(y - cy, x - lx);
                const swirl = Math.sin(ang * 2 + d * 0.8 - t * 16 + phaseOff);
                let col;
                if (u > 0.72) col = WHITE;
                else if (swirl > 0.0) col = u > 0.42 ? M[4] : M[3]; // Soft Cloud-White (云白色)
                else col = u > 0.42 ? G[6] : G[5]; // Soft Warm-Yellow (暖黄色)
                p.blendPx(px, py, col, Math.min(1, u * 1.35) * 0.95);
                if (u > 0.45) p.add(px, py, swirl > 0 ? M[4] : G[5], u * 0.32);
              });
              // Orbiting cloud-white & warm-yellow satellite motes around each left orb
              for (let k = 0; k < 2; k++) {
                const oa = t * 9 + phaseOff + k * Math.PI;
                const ox1 = lx + Math.cos(oa) * (rOrb + 1.5);
                const oy1 = cy + Math.sin(oa) * (rOrb * 0.75);
                p.dot(ox1, oy1, k === 0 ? M[4] : G[5], 0.85 * ok);
              }
            }
            p.glow(lx, hyC, 11 * ok, G[5], 0.48 * ok);
            p.glow(lx, eyC, 10 * ok, M[4], 0.46 * ok);
          }
        }

        // 5. Phase 2 (Hit / Sweep): Pure-White & Withered-Yellow Interwoven Pixel Light-Wave Flushing Left-to-Right
        if (t >= T_SWEEP && t <= T_BURST + 0.04) {
          const wk = clamp((t - T_SWEEP) / (T_BURST - T_SWEEP));
          const wx = BX + BW * sweepU + ox;
          const waveEnv = 1 - smooth(0.94, 1.0, wk) * 0.65;
          const wy0 = HY - 5 + oy, wy1 = EY + EH + 5 + oy;

          p.each(wx - 17, wy0, wx + 6, wy1, (x, y, px, py) => {
            const dyNorm = (y - (wy0 + wy1) * 0.5) / ((wy1 - wy0) * 0.5);
            // Forward-curving wave crest with pixel foam ripples
            const crestX = wx - dyNorm * dyNorm * 3.2 + Math.sin(y * 0.58 - t * 30) * 1.1;
            const dx = x - crestX;
            if (dx > 3.2 || dx < -14.5) return;

            const u = dx >= 0 ? 1 - dx / 3.2 : 1 - (-dx) / 14.5;
            if (u <= 0) return;

            // Interwoven Pure-White (纯白色) & Withered-Yellow (枯黄色 G[2]..G[5]) strands
            const braid = Math.sin(y * 0.72 - t * 32 + dx * 0.48);
            let col;
            if (dx > -1.8 && u > 0.6) {
              col = WHITE; // Pure-white leading wave crest
            } else if (braid > 0.16) {
              col = u > 0.52 ? WHITE : G[6];
            } else {
              col = u > 0.66 ? G[5] : u > 0.36 ? G[4] : G[2]; // Withered-yellow braided wake
            }
            p.blendPx(px, py, col, u * waveEnv * 0.96);
            if (u > 0.48) p.add(px, py, braid > 0 ? WHITE : G[4], u * 0.34);
          });
          p.glow(wx - 1, (wy0 + wy1) * 0.5, 16, G[4], 0.56);
          p.glow(wx + 1, (wy0 + wy1) * 0.5, 9, WHITE, 0.52);
        }

        // 6. Phase 3 (Flush Completion Climax): Right-End Oppressive Shock-Flare
        if (t >= T_BURST && t < T_BURST + 0.16) {
          const bk = (t - T_BURST) / 0.16;
          const rx = BX + BW + ox, ry = (HY + EY + EH) * 0.5 + oy;
          const fk = 1 - bk;
          flare(p, rx + 2, ry, 24 * fk, fk, G);
          p.circle(rx + 1, ry, 5 * fk, WHITE);
        }
      }

      // Draw tri-color right-end burst motes (散开一簇暖金色、珊瑚红与苍青色混合的像素光粒)
      for (const m of burstMotes) {
        const k = 1 - m.age / m.life;
        const tw = 0.78 + 0.22 * Math.sin(t * 20 + m.ph);
        const a = Math.min(1, m.age / 0.025) * Math.min(1, k * 1.35) * tw;
        if (a <= 0.04) continue;
        for (let j = 1; j < m.trail.length; j++) {
          const [x0, y0] = m.trail[j - 1], [x1, y1] = m.trail[j];
          p.line(x0 + ox, y0 + oy, x1 + ox, y1 + oy, m.col, a * (1 - j / m.trail.length) * 0.82);
        }
        const X = Math.round(m.x + ox), Y0 = Math.round(m.y + oy);
        p.dot(X, Y0, k > 0.65 ? WHITE : m.core, a);
        if (m.big && k > 0.2) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            p.dot(X + dx, Y0 + dy, m.col, a * 0.88);
          }
        } else {
          p.dot(X - 1, Y0, m.col, a * 0.88);
          p.dot(X, Y0 + 1, m.col, a * 0.72);
        }
        p.glow(X, Y0, 5, m.col, 0.45 * a);
      }

      // Draw golden-yellow afterglow specks drifting down from above (上方飘落点点金黄色的像素余晖)
      for (const g of afterglow) {
        const k = 1 - g.age / g.life;
        const tw = 0.74 + 0.26 * Math.sin(t * 15 + g.ph);
        const a = Math.min(1, g.age / 0.07) * Math.min(1, k * 1.65) * tw * open;
        if (a <= 0.04) continue;
        const X = Math.round(g.x + ox), Y0 = Math.round(g.y + oy);
        p.dot(X, Y0, k > 0.6 ? WHITE : G[6], a);
        if (g.big && k > 0.26) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            p.dot(X + dx, Y0 + dy, g.c, a * 0.82);
          }
        } else {
          p.dot(X, Y0 - 1, g.c, a * 0.84);
        }
        p.glow(X, Y0, 5, G[5], 0.45 * a);
      }

      ps.draw(p);
      lights.draw(p);
    },
  };
}
