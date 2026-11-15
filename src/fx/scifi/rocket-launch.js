// Heavy multi-stage rocket launch: pad materialization & gantry lock -> cryo-venting & ROFI sparkshower ->
// main-engine ignition & flame-trench deflection -> clamp release & heavy liftoff with Mach shock diamonds ->
// Max-Q condensation collar & towering volumetric smoke column.
// Smoke volume, fireballs, sparks, rocks and scorch adapted from Sprite Fusion's open-source explosion & muzzle-flash
// (https://www.spritefusion.com/pixel-art-vfx/explosion), MIT License, Copyright (c) 2026 Hugo Duprez.
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
  clamp,
  smooth,
  lerp,
  ease,
  tileFbm,
  mix,
  TAU,
  WHITE,
  hex,
} from "../../core/index.js";
import { stone, fireRamp, heatRamp, drawPs, draft, cull, fadeEdges, scorch, rock, dome, pool } from "../explosions/_lib.js";
import { cloud, Smoke } from "../projectiles/_lib.js";

export const meta = {
  name: "Rocket launch",
  desc: "A heavy booster assembles on the pad and vents cryo-mist; igniters shower sparks, three engines roar into a split trench cloud, clamps release and it climbs on shock diamonds.",
  tags: ["scifi", "rocket", "launch", "liftoff", "booster", "fire", "smoke", "explosion", "ground", "one-shot"],
  size: [264, 284],
  origin: [132, 250],
  duration: 5.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#4a1712", "#8a1f17", "#c9281f", "#f2561d", "#ff8a2a", "#ffc23d", "#ffe26b", "#fff3a6", "#ffffff"],
    metal: ["#111019", "#222436", "#393e56", "#59617d", "#8893b0", "#c2cce0", "#eef4ff"],
    paint: ["#421018", "#881b24", "#c93030", "#f05c44", "#ff9e82"],
    smoke: ["#231f2b", "#383344", "#524c5f", "#736c80", "#9a93a6", "#c4bdd0", "#ece6f2"],
    stone: "#4a3f69",
    seed: 14,
  },
};

// Choreography beats (seconds)
const T_LOCK = 0.56;    // Pad assembly, laser-scan & gantry umbilical lock complete
const T_IGN = 0.78;     // ROFI pre-ignition spark shower starts
const T_MAIN = 1.08;    // Main engine ignition & hold-down thrust build-up
const T_LIFT = 1.66;    // Gantry clamps release; heavy liftoff begins
const T_MAXQ = 2.52;    // Max-Q transonic vapor cone
const T_CLEAR = 3.42;   // Rocket nozzle clears upper sky threshold

const OUTLINE = hex("#0f0d17");

// Draw the launch pad base, flame trench V-deflector, and swinging umbilical gantry towers
function drawLaunchPad(p, M, A, F, t) {
  const appear = ease.outCubic(clamp(t / (T_LOCK * 0.85)));
  const fade = 1 - smooth(meta.duration - 0.95, meta.duration - 0.12, t);
  if (appear <= 0.02 || fade <= 0.01) return;

  const heatK = t >= T_MAIN ? clamp((t - T_MAIN) / 0.25) * (1 - smooth(T_CLEAR, T_CLEAR + 1.0, t)) : 0;

  // 1. Concrete/steel launch bunker & flame trench at y = -5 .. 1
  const pw = Math.round(32 * appear);
  for (let y = -5; y <= 1; y++) {
    const w = pw + (y + 5) * 2;
    for (let x = -w; x <= w; x++) {
      const inTrench = Math.abs(x) < 13 && y >= -3;
      let c;
      if (inTrench) {
        const d = Math.abs(x) / 13;
        c = heatK > 0.25 ? mix(M[1], F[d < 0.45 ? 6 : 4], heatK * (1 - d * 0.5)) : M[0];
      } else if (y === -5) {
        c = Math.abs(x) < 20 ? M[4] : M[3];
      } else if (y === 1 || Math.abs(x) >= w - 1) {
        c = M[0];
      } else {
        const stripe = ((x + y * 2) & 7) < 3 && Math.abs(x) > 15 && Math.abs(x) < 28 && y === -3;
        c = stripe ? A[3] : x < 0 ? M[2] : M[1];
      }
      p.dot(x, y, c, fade);
    }
  }

  // 2. Left & right umbilical service towers + swinging hold-down arms
  const towerH = Math.round(54 * appear);
  // Arms swing IN to lock during t = 0.25..T_LOCK, then swing OUT at T_LIFT
  const lockInU = 1 - ease.outBack(clamp((t - 0.22) / (T_LOCK - 0.22)));
  const releaseU = clamp((t - T_LIFT) / 0.32);
  const swingAng = Math.max(lockInU * 0.55, ease.outBack(releaseU) * 0.65);

  for (const s of [-1, 1]) {
    const tx = s * 24;
    for (let y = -5; y >= -5 - towerH; y--) {
      const h = -5 - y;
      p.dot(tx, y, s < 0 ? M[3] : M[2], fade);
      p.dot(tx + s * 3, y, s < 0 ? M[2] : M[1], fade);
      if (h % 6 === 0 || (h + (s > 0 ? 3 : 0)) % 6 === 3) {
        p.dot(tx + s, y, M[2], fade);
        p.dot(tx + s * 2, y, M[1], fade);
      }
    }
    // Lower hold-down arm at y = -16 and upper umbilical arm at y = -35
    for (const [ay0, armLen] of [[-16, 12], [-35, 13]]) {
      if (-5 - towerH <= ay0) {
        const ax0 = tx;
        const ang = (s < 0 ? 0 : Math.PI) + s * swingAng;
        const ax1 = ax0 + Math.cos(ang) * armLen;
        const ay1 = ay0 - Math.abs(Math.sin(ang)) * armLen * 0.65;
        p.line(ax0, ay0, ax1, ay1, M[4], fade);
        p.line(ax0, ay0 + 1, ax1, ay1 + 1, M[1], fade);
        const lockFlash = Math.abs(t - T_LOCK) < 0.08 || (releaseU > 0 && releaseU < 0.35);
        p.dot(ax1, ay1, lockFlash ? WHITE : A[3], fade);
      }
    }
    // Tower top warning strobe beacon
    if (towerH >= 50) {
      const wy = -5 - towerH - 1;
      const blink = Math.sin(t * 18 + (s > 0 ? 1.2 : 0)) > 0.15;
      p.dot(tx + s, wy, blink ? WHITE : A[3], fade);
      if (blink) p.glow(tx + s, wy, 7, A[3], 0.42 * fade);
    }
  }
}

// Draw the Heavy Multi-Stage Rocket (Central Core Stage + Twin Side Liquid Boosters + Fairing + 3 Engine Bells)
// Base of nozzles is at (rx, ry). Total rocket height = 68 px (ry - 68 .. ry).
function drawHeavyRocket(p, M, A, F, rx, ry, t, topEdge) {
  if (ry < topEdge) return;
  const scanU = clamp(t / (T_LOCK * 0.92));
  const scanY = ry - Math.round(70 * ease.outCubic(scanU));
  const ignK = t >= T_MAIN ? clamp((t - T_MAIN) / 0.18) : t >= T_IGN ? 0.35 : 0;

  const putR = (dx, dy, c) => {
    const x = Math.round(rx + dx), y = Math.round(ry + dy);
    if (y < scanY || y < topEdge || y > 1) return;
    if (t < T_LOCK * 0.92 && y <= scanY + 2) {
      p.px(x, y, y === scanY ? WHITE : F[6]);
      return;
    }
    p.px(x, y, c);
  };

  // 1. THREE FLARED ENGINE BELLS (dy = -4 .. 0): Center main nozzle (dx = 0) + Twin side nozzles (dx = -8, +8)
  for (const bx of [-8, 0, 8]) {
    const isCore = bx === 0;
    const bTop = isCore ? -5 : -4;
    for (let dy = bTop; dy <= 0; dy++) {
      const w = isCore ? 2 + Math.floor((dy - bTop) * 0.55) : 1 + Math.floor((dy - bTop) * 0.55);
      for (let x = -w; x <= w; x++) {
        const edge = Math.abs(x) === w;
        const lip = dy === 0 && Math.abs(x) < w;
        const c = lip && ignK > 0.2
          ? (ignK > 0.7 ? WHITE : F[6])
          : edge
            ? OUTLINE
            : x < 0
              ? M[3]
              : M[1];
        putR(bx + x, dy, c);
      }
    }
  }

  // 2. TWIN SIDE STRAP-ON BOOSTERS (dx = -8 and +8, dy = -38 .. -4, half-width = 3)
  for (const s of [-1, 1]) {
    const cx = s * 8;
    for (let dy = -31; dy <= -5; dy++) {
      const bandStripe = dy === -28 || dy === -27 || dy === -10 || dy === -9;
      for (let x = -3; x <= 3; x++) {
        if (Math.abs(x) === 3) {
          putR(cx + x, dy, OUTLINE);
        } else {
          const sh = x === -2 ? 4 : x === -1 ? 6 : x === 0 ? 5 : x === 1 ? 3 : 2;
          let c = bandStripe ? A[Math.min(4, Math.max(0, sh - 2))] : M[sh];
          if (ignK > 0.5 && dy >= -8) c = mix(c, F[5], 0.35 * ignK);
          putR(cx + x, dy, c);
        }
      }
      if (dy === -26 || dy === -11) {
        putR(s * 5, dy, M[2]);
        putR(s * 5, dy + 1, OUTLINE);
      }
    }
    for (let dy = -38; dy <= -32; dy++) {
      const u = (dy + 38) / 6;
      const hw = Math.round(u * 2.6);
      for (let x = -hw - 1; x <= hw + 1; x++) {
        if (Math.abs(x) > hw) putR(cx + x, dy, OUTLINE);
        else {
          const isRed = dy <= -35;
          const c = x < 0 ? (isRed ? A[4] : M[6]) : x === 0 ? (isRed ? A[3] : M[5]) : (isRed ? A[1] : M[3]);
          putR(cx + x, dy, c);
        }
      }
    }
    // Swept aerodynamic tail fins on outer side of each booster
    for (let i = 0; i < 8; i++) {
      const dy = -12 + i;
      const finW = Math.min(4, Math.floor((i + 2) * 0.6));
      for (let f = 1; f <= finW; f++) {
        const fx = cx + s * (3 + f);
        const isRim = f === finW || i === 0 || i === 7;
        putR(fx, dy, isRim ? OUTLINE : i <= 2 ? A[3] : s < 0 ? M[4] : M[2]);
      }
    }
  }

  // 3. CENTRAL HEAVY CORE STAGE & PAYLOAD FAIRING (dx = -5..+5, dy = -66 .. -5)
  for (let dy = -66; dy <= -5; dy++) {
    let hw = 4;
    if (dy < -50) {
      const u = (dy + 66) / 16;
      hw = Math.floor(Math.pow(u, 0.75) * 4.4);
    } else if (dy >= -48 && dy <= -43) {
      hw = 5;
    }

    const isRedNose = dy <= -59;
    const isInterstage = (dy >= -36 && dy <= -33) || (dy >= -18 && dy <= -16);
    const isRollCheck = dy === -35 || dy === -34;
    const isWindow = dy >= -47 && dy <= -45;

    for (let x = -hw - 1; x <= hw + 1; x++) {
      if (Math.abs(x) > hw) {
        putR(x, dy, OUTLINE);
        continue;
      }
      const normX = hw > 0 ? x / hw : 0;
      const step = normX < -0.55 ? 4 : normX < -0.15 ? 6 : normX < 0.25 ? 5 : normX < 0.65 ? 3 : 2;
      let c = M[step];

      if (isRedNose) {
        c = A[Math.min(4, Math.max(0, step - 2))];
      } else if (isRollCheck) {
        const chk = ((x + 6) >> 1) & 1;
        c = chk ? M[step] : M[1];
      } else if (isInterstage) {
        c = A[Math.min(4, Math.max(0, step - 2))];
      } else if (isWindow && Math.abs(x) <= 1) {
        c = x <= 0 ? WHITE : F[5];
      }

      if (x === 1 && dy > -33 && dy < -7 && !isInterstage) {
        c = M[3];
      }
      if (ignK > 0.5 && dy >= -8) c = mix(c, F[5], 0.35 * ignK);
      putR(x, dy, c);
    }
  }

  // Escape tower needle at very tip (dy = -68 .. -67)
  putR(0, -67, M[5]);
  putR(0, -68, WHITE);

  // Horizontal laser-scan bar while materializing on the pad (Phase 1)
  if (t < T_LOCK * 0.92 && scanY > topEdge + 18) {
    p.line(rx - 16, scanY, rx + 16, scanY, (u) => (Math.abs(u - 0.5) < 0.28 ? WHITE : F[5]));
    p.glow(rx, scanY, 15, F[5], 0.55);
  }
}

// Draw the supersonic triple-nozzle exhaust jet with turbulent flame rim and Mach shock diamonds
function drawSupersonicPlume(p, F, rx, ry, jetLen, power, t, topEdge) {
  if (power <= 0.02 || jetLen < 2) return;
  const topY = Math.max(topEdge, ry);
  const botY = Math.min(0, ry + jetLen);
  if (botY <= topY) return;

  const halfW = 14 + 4 * power;
  p.shade(rx - halfW - 2, topY, rx + halfW + 2, botY + 1, (x, y, out) => {
    if (y > 0.5 || y < ry || y < topEdge) return;
    const dy = y - ry;
    const v = dy / jetLen;
    if (v > 1.05) return;

    const dx = x - rx;
    const adx = Math.abs(dx);
    const envSplit = Math.max(0, 1 - dy / 14);
    const dBell = Math.min(adx / 4.8, Math.abs(adx - 8) / 3.6);
    const wCol = lerp(11.5 * power, 2.8, Math.pow(clamp(v), 0.75)) + 2.2 * Math.sin(v * Math.PI);
    const dCol = adx / Math.max(1.5, wCol);
    const q = lerp(dCol, dBell, envSplit * 0.72);

    const n = tileFbm(dx / 3.5, dy / 5 - t * 28, 0, 12, 17, 2);
    const qN = q + (n - 0.5) * 0.42 * Math.min(1, 0.25 + v * 1.4);
    if (qN > 1.15) return;

    if (qN > 0.92) {
      out.c = v < 0.45 ? F[3] : F[2];
      return;
    }

    // 5 pulsing Mach shock diamonds strung down the central exhaust core
    for (let i = 0; i < 5; i++) {
      const diaY = 5.5 + i * 9.5 + Math.sin(t * 38 + i * 1.4) * 0.8;
      if (diaY > jetLen * 0.82) break;
      const diaRx = (3.4 - i * 0.42) * power;
      const diaRy = 3.2 - i * 0.32;
      const dd = Math.abs(dy - diaY) / diaRy + adx / Math.max(1, diaRx);
      if (dd < 1) {
        out.c = dd < 0.55 && i < 4 ? WHITE : F[7];
        return;
      }
    }

    if (dy < 4.5 && dBell < 0.75) {
      out.c = WHITE;
      return;
    }

    const heat = (1 - qN * 0.88) * (1 - Math.pow(clamp(v), 1.45)) + (n - 0.5) * 0.2;
    out.c = heat > 0.72 ? WHITE : heat > 0.54 ? F[7] : heat > 0.38 ? F[6] : heat > 0.22 ? F[5] : heat > 0.08 ? F[4] : F[3];
  });

  // Keep glow strictly inside top canvas edge so glow never spills past the canvas
  const gTop = Math.max(topEdge + 22, ry + 4);
  const gBot = Math.min(-2, ry + jetLen * 0.85);
  if (gBot > gTop) {
    p.glow(rx, gTop, 16 * power, WHITE, 0.58 * power);
    p.glowLine(rx, gTop, rx, gBot, 20 * power, F[4], 0.38 * power);
  }
}

export function create(o) {
  const F = fit(o.palette, 9);
  const FR = fireRamp(F);
  const HR = heatRamp(FR);
  const M = fit(o.metal, 7);
  const A = fit(o.paint, 5);
  const SM = fit(o.smoke, 7);
  const st = stone(o.stone);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const X0 = -OX + 8, X1 = W - OX - 8, Y0 = -OY + 16, Y1 = H - OY - 6;

  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, F[7], F[5], F[3]] });
  const smoke = new Smoke(R);
  const rocks = new Bits({ ground: floor });
  const lights = new Lights();

  let t = 0;
  let lockFlashed = false;
  let mainIgnited = false;
  let liftedOff = false;
  let clearedSky = false;
  let ventAcc = 0;
  let rofiAcc = 0;
  let plumeAcc = 0;

  const capLife = (l) => Math.max(0.08, Math.min(l, meta.duration - 0.14 - t));

  function rocketPos(time) {
    if (time < T_LOCK) {
      const u = ease.outCubic(clamp(time / (T_LOCK * 0.92)));
      return [0, lerp(-1, -8, u)];
    }
    if (time < T_LIFT) {
      const vib = time >= T_MAIN ? Math.sin(time * 95) * 0.75 : time >= T_IGN ? Math.sin(time * 55) * 0.25 : 0;
      return [vib, -8];
    }
    const u = (time - T_LIFT) / (T_CLEAR - T_LIFT);
    const climb = 248 * Math.pow(Math.max(0, u), 2.45);
    const sway = Math.sin((time - T_LIFT) * 14) * 0.45 * clamp(1 - u * 0.7);
    return [sway, -8 - climb];
  }

  return {
    update(dt) {
      t += dt;
      const [rx, ry] = rocketPos(t);

      // PHASE 1: Umbilical clamp lock-in spark glint at T_LOCK, then Cryogenic LOX venting (t = 0.32 .. T_MAIN)
      if (!lockFlashed && t >= T_LOCK) {
        lockFlashed = true;
        lights.add(0, -34, 36, F[6], 0.65, 0.22);
        for (const s of [-1, 1]) {
          for (let i = 0; i < 8; i++) {
            const a = (s < 0 ? 0 : Math.PI) + R.range(-0.8, 0.8);
            const sp = R.range(35, 95);
            ps.spawn(P.SPARK, s * 11, -35, Math.cos(a) * sp, Math.sin(a) * sp - 10, capLife(R.range(0.12, 0.26)));
          }
        }
      }
      if (t >= 0.30 && t < T_MAIN) {
        for (ventAcc += dt * 32; ventAcc >= 1; ventAcc--) {
          const s = R.sign();
          ps.spawn(
            P.VAPOUR,
            rx + s * R.range(5, 11),
            ry - R.range(22, 46),
            s * R.range(18, 48),
            R.range(6, 22),
            capLife(R.range(0.45, 0.85)),
            SM[5],
            R.range(2.4, 4.2),
          );
        }
      }

      // PHASE 2: Pre-ignition ROFI spark shower under nozzles (T_IGN .. T_MAIN)
      if (t >= T_IGN && t < T_MAIN + 0.12) {
        for (rofiAcc += dt * 105; rofiAcc >= 1; rofiAcc--) {
          const s = R.sign();
          const a = (s < 0 ? 0.35 : Math.PI - 0.35) + R.range(-0.35, 0.35);
          const sp = R.range(75, 195);
          ps.spawn(P.SPARK, s * 13, -4, Math.cos(a) * sp, Math.sin(a) * sp - 25, capLife(R.range(0.14, 0.36)));
        }
        if (t >= T_IGN + 0.12 && R.chance(28 * dt)) {
          ps.spawn(P.FIRE, R.range(-6, 6), -6, R.range(-25, 25), R.range(10, 45), capLife(R.range(0.2, 0.4)), 0, R.range(3.5, 5.5));
        }
      }

      // PHASE 3: Main Engine Ignition Hero Burst at T_MAIN
      if (!mainIgnited && t >= T_MAIN) {
        mainIgnited = true;
        lights.add(0, -18, 95, F[4], 0.82, 0.9);
        lights.add(0, -10, 48, WHITE, 0.82, 0.14);

        for (const s of [-1, 1]) {
          for (let i = 0; i < 16; i++) {
            const sp = R.range(55, 185);
            ps.spawn(
              P.FIRE,
              s * R.range(2, 12),
              -R.range(2, 7),
              s * sp,
              -R.range(8, 55),
              capLife(R.range(0.45, 0.95)),
              0,
              R.range(5, 9.0),
              R.range(0, 0.12),
              PF.SMOKES | PF.BIG,
            );
          }
          for (let i = 0; i < 12; i++) {
            smoke.add({
              x: s * R.range(4, 16),
              y: -R.range(2, 6),
              vx: s * R.range(68, 165),
              vy: -R.range(4, 22),
              r0: 3.5,
              r1: R.range(9.5, 15),
              life: capLife(R.range(2.1, 3.1)),
              a: 0.72,
              b: 0.92,
              warm: 1.0,
              rise: 15,
              drag: 2.2,
              curl: -s * R.range(0.45, 0.95),
              delay: R.range(0, 0.16),
            });
          }
        }
        for (let i = 0; i < 70; i++) {
          const s = R.sign();
          const a = (s > 0 ? 0 : Math.PI) - s * R.range(0.08, 0.85);
          const sp = R.range(110, 290);
          ps.spawn(P.SPARK, s * R.range(2, 10), -3, Math.cos(a) * sp, Math.sin(a) * sp, capLife(R.range(0.25, 0.65)));
        }
        for (let i = 0; i < 16; i++) {
          const s = R.sign();
          rocks.add({
            kind: B.CHUNK,
            x: s * R.range(4, 14),
            y: -3,
            vx: s * R.range(45, 130),
            vy: -R.range(130, 250),
            g: 1,
            drag: 0.35,
            bounce: 0.32,
            life: capLife(R.range(2.0, 3.2)),
            a: R.range(0, TAU),
            va: R.range(-14, 14),
            s: R.range(1.2, 2.4),
            heat: R.chance(0.5) ? R.range(0.6, 1) : 0,
          });
        }
      }

      // PHASE 3 & 4: Continuous Supersonic Exhaust Feeding Trench & Sky Column (T_MAIN .. T_CLEAR)
      if (t >= T_MAIN && t < T_CLEAR) {
        const power = clamp((t - T_MAIN) / 0.22);
        const jetLen = t < T_LIFT ? 12 : Math.min(62, 12 + (-ry - 8) * 0.75);
        const tailY = Math.min(-3, ry + jetLen * 0.76);
        const nearGround = clamp(1 - (-ry - 8) / 55);

        for (plumeAcc += dt * 62; plumeAcc >= 1; plumeAcc--) {
          const s = R.sign();
          if (nearGround > 0.15 && R.chance(nearGround)) {
            smoke.add({
              x: s * R.range(4, 16),
              y: -R.range(2, 7),
              vx: s * R.range(55, 140) * nearGround,
              vy: -R.range(8, 26),
              r0: 3.2,
              r1: R.range(8.5, 14),
              life: capLife(R.range(1.9, 2.8)),
              a: 0.68,
              b: 0.88,
              warm: 0.95,
              rise: 16,
              drag: 2.3,
              curl: -s * R.range(0.35, 0.8),
            });
          } else if (tailY > Y0 + 18) {
            smoke.add({
              x: rx + R.range(-4.0, 4.0),
              y: clamp(tailY + R.range(-4, 6), Y0 + 18, -4),
              vx: R.range(-18, 18),
              vy: R.range(16, 48),
              r0: 3.0,
              r1: R.range(8.0, 13.5),
              life: capLife(R.range(1.5, 2.1)),
              a: 0.66,
              b: 0.9,
              warm: 0.9,
              rise: 20,
              drag: 2.8,
            });
          }

          // Spawn fireballs at the TAIL of the supersonic jet (0.68..0.95 of jetLen) so they trail into smoke
          if (R.chance(0.48)) {
            const fy = clamp(ry + R.range(jetLen * 0.65, jetLen * 0.95), Y0 + 16, -3);
            const lat = fy > -14 ? s * R.range(30, 105) : R.range(-16, 16);
            ps.spawn(
              P.FIRE,
              rx + R.range(-4, 4),
              fy,
              lat,
              fy > -14 ? -R.range(10, 40) : R.range(35, 90),
              capLife(R.range(0.28, 0.58)),
              0,
              R.range(3.8, 6.8) * power,
              0,
              R.chance(0.35) ? PF.SMOKES : 0,
            );
          }

          if (R.chance(0.6)) {
            const sy = clamp(ry + R.range(4, jetLen * 0.7), Y0 + 14, -2);
            const sp = R.range(70, 200);
            const ang = sy > -12 ? (s > 0 ? -0.25 : Math.PI + 0.25) + R.range(-0.35, 0.35) : Math.PI / 2 + R.range(-0.42, 0.42);
            ps.spawn(P.SPARK, rx + R.range(-5, 5), sy, Math.cos(ang) * sp, Math.sin(ang) * sp, capLife(R.range(0.18, 0.42)));
          }
          if (R.chance(0.25)) {
            ps.spawn(
              P.EMBER,
              rx + R.range(-6, 6),
              clamp(tailY, Y0 + 18, -4),
              R.range(-40, 40),
              R.range(-30, 25),
              capLife(R.range(1.0, 1.9)),
              F[4],
            );
          }
        }
      }

      // Clamp release spark burst at T_LIFT
      if (!liftedOff && t >= T_LIFT) {
        liftedOff = true;
        lights.add(0, -34, 44, F[6], 0.72, 0.28);
        for (const s of [-1, 1]) {
          for (let i = 0; i < 14; i++) {
            const a = (s < 0 ? 0 : Math.PI) + R.range(-0.9, 0.9);
            const sp = R.range(50, 145);
            ps.spawn(P.SPARK, s * 11, -34, Math.cos(a) * sp, Math.sin(a) * sp - 20, capLife(R.range(0.16, 0.36)));
          }
        }
      }

      // High-altitude staging / sky-breakaway flash right as rocket tail crosses Y0 + 18
      if (!clearedSky && t >= T_CLEAR - 0.06) {
        clearedSky = true;
        lights.add(0, Y0 + 34, 34, F[5], 0.75, 0.45);
        for (let i = 0; i < 16; i++) {
          ps.spawn(
            P.STAR,
            R.range(-14, 14),
            Y0 + R.range(14, 38),
            R.range(-18, 18),
            R.range(6, 28),
            capLife(R.range(0.4, 0.85)),
            R.chance(0.5) ? WHITE : F[6],
            R.range(0.8, 1.4),
          );
        }
      }

      draft(ps, dt, {
        x: 0,
        top: Math.max(Y0 + 20, ry),
        w: 14,
        up: 135,
        pull: 90,
        low: 14,
        reach: 110,
        k: t >= T_MAIN ? 1 - smooth(T_CLEAR + 0.2, T_CLEAR + 1.3, t) : 0,
      });

      for (let i = smoke.list.length - 1; i >= 0; i--) {
        const q = smoke.list[i];
        const maxR = q.r1 + 4;
        if (q.x - maxR < X0 + 4) q.vx = Math.max(q.vx, 12);
        if (q.x + maxR > X1 - 4) q.vx = Math.min(q.vx, -12);
        if (q.y - maxR < Y0 + 4) q.life = Math.min(q.life, q.age + 0.14);
        if (q.y + maxR > 3) q.y = Math.min(q.y, -q.r0 * 0.6 - 1);
      }

      rocks.update(dt);
      for (let i = rocks.list.length - 1; i >= 0; i--) {
        const b = rocks.list[i];
        if (b.x < X0 + 4 || b.x > X1 - 4 || t > meta.duration - 0.12) {
          rocks.list.splice(i, 1);
          continue;
        }
        if (b.heat > 0) b.heat = Math.max(0, b.heat - dt * 0.35);
      }

      smoke.update(dt);
      ps.update(dt);
      cull(ps, X0, Y0, X1, Y1);
      fadeEdges(ps, X0, X1, 24, Y1);
      lights.update(dt);
    },

    drawBack(p) {
      const fadeEnd = 1 - smooth(meta.duration - 0.85, meta.duration - 0.12, t);
      if (fadeEnd <= 0.01) return;

      if (t >= T_MAIN) {
        scorch(p, HR, t - T_MAIN, 54, 2.7, fadeEnd, 3);
      }

      if (t < T_LOCK + 0.25) {
        const k = clamp(t / (T_LOCK + 0.25));
        band(p, 0, 0.5, 50 * ease.outCubic(k), 0.16, Math.max(1, 3 * (1 - k)), 1 - k, [M[3], M[5], F[5], WHITE], (g) => Math.sin(g) < 0);
      }
      if (t >= T_MAIN) {
        const k = (t - T_MAIN) / 0.58;
        if (k < 1) {
          band(p, 0, 0.5, 114 * ease.outCubic(k), 0.16, Math.max(1, 5.5 * (1 - k)), 1.15 - k, [st.body, st.light, F[4], F[7]], (g) => Math.sin(g) < 0);
        }
      }

      drawPs(p, ps, "back", FR);
      drawLaunchPad(p, M, A, F, t);
    },

    draw(p) {
      const fadeEnd = 1 - smooth(meta.duration - 0.8, meta.duration - 0.1, t);
      if (fadeEnd <= 0.01) return;

      const [rx, ry] = rocketPos(t);
      const topEdge = -OY + 1; // True top edge of canvas in local coordinates (-249)

      // 1. Volumetric Billowing Smoke Cloud (split into low ground cloud and tall sky column)
      const allPuffs = smoke.puffs();
      if (allPuffs.length) {
        const WR = [mix(F[0], SM[0], 0.5), mix(F[1], SM[1], 0.45), mix(F[2], SM[2], 0.35), F[3], F[4], F[6], F[7]];
        const clipFn = (lx, ly) => lx > X0 && lx < X1 && ly > topEdge + 2 && ly <= 2;
        const groundPuffs = [];
        const colPuffs = [];
        for (const q of allPuffs) {
          q.a *= fadeEnd;
          if (q.a <= 0.02) continue;
          if (q.y > -46) groundPuffs.push(q);
          else colPuffs.push(q);
        }
        if (colPuffs.length) cloud(p, colPuffs, SM, WR, { dens: 1.38, max: 0.85, lit: 1.45, clip: clipFn });
        if (groundPuffs.length) cloud(p, groundPuffs, SM, WR, { dens: 1.38, max: 0.85, lit: 1.45, clip: clipFn });
      }

      // 2. Tumbling pad debris & fire/spark particles (drawn BEFORE the supersonic core jet so cooling fireballs
      // never obscure the white-hot Mach shock diamonds!)
      for (const b of rocks.list) rock(p, b, st, FR);
      drawPs(p, ps, "front", FR);

      // 3. Supersonic Triple-Nozzle Exhaust Plume & 5 Mach Shock Diamonds
      if (t >= T_MAIN && t < T_CLEAR + 0.08) {
        const power = clamp((t - T_MAIN) / 0.2) * (1 - smooth(T_CLEAR - 0.12, T_CLEAR + 0.06, t));
        const jetLen = t < T_LIFT ? 13 : Math.min(62, 13 + (-ry - 8) * 0.78);
        drawSupersonicPlume(p, F, rx, ry, jetLen, power, t, topEdge);
      }

      // 4. The Heavy Multi-Stage Rocket
      if (t < T_CLEAR + 0.05) {
        drawHeavyRocket(p, M, A, F, rx, ry, t, topEdge);
      }

      // 5. Max-Q Transonic Prandtl-Glauert Vapor Cone around fairing during supersonic climb
      const mq = (t - T_MAXQ) / 0.46;
      if (mq > 0 && mq < 1 && ry - 42 > topEdge + 10) {
        const ma = Math.sin(mq * Math.PI) * 0.78;
        const vy = ry - 42;
        const vr = 14 + 10 * mq;
        for (let dy = 0; dy <= 7; dy++) {
          const w = vr * (0.45 + dy * 0.11);
          p.disc(rx, vy + dy, w * 0.35, WHITE, ma * 0.28 * (1 - dy / 8));
          for (let dx = -Math.ceil(w); dx <= Math.ceil(w); dx++) {
            const q = Math.abs(dx) / w;
            if (q > 0.65 && q <= 1 && vy + dy > topEdge + 4) {
              p.blend(rx + dx, vy + dy, WHITE, ma * 0.45 * (1 - dy / 8));
            }
          }
        }
      }

      // 6. Ignition Hero Dome & Flare at T_MAIN
      const aMain = t - T_MAIN;
      if (aMain >= 0 && aMain < 0.09) {
        dome(p, F, 0, 28 * (1 - aMain * 4), 1 - aMain / 0.09);
      }
      if (aMain >= 0 && aMain < 0.22) {
        flare(p, 0, -10, 52 * Math.pow(1 - aMain / 0.22, 1.3), 1 - aMain / 0.22, F);
      }

      // 7. Near half of floor rings
      if (t < T_LOCK + 0.25) {
        const k = clamp(t / (T_LOCK + 0.25));
        band(p, 0, 0.5, 50 * ease.outCubic(k), 0.16, Math.max(1, 3 * (1 - k)), 1 - k, [M[3], M[5], F[5], WHITE], (g) => Math.sin(g) >= 0);
      }
      if (t >= T_MAIN) {
        const k = (t - T_MAIN) / 0.58;
        if (k < 1) {
          band(p, 0, 0.5, 114 * ease.outCubic(k), 0.16, Math.max(1, 5.5 * (1 - k)), 1.15 - k, [st.body, st.light, F[4], F[7]], (g) => Math.sin(g) >= 0);
        }
      }

      // 8. High-altitude breakaway star glint right at upper sky threshold
      const aClear = t - (T_CLEAR - 0.06);
      if (aClear >= 0 && aClear < 0.28) {
        const u = aClear / 0.28;
        sparkle(p, 0, topEdge + 24, 14 * Math.sin(u * Math.PI), WHITE, F[5], 0.85 * (1 - u));
      }

      // 9. Floor light pool while engines roar and smoke glows
      if (t >= T_MAIN) {
        const poolK = clamp((t - T_MAIN) / 0.15) * (1 - smooth(T_CLEAR - 0.2, T_CLEAR + 1.3, t)) * fadeEnd;
        pool(p, 0, 1, 112, 15, F[4], 0.42 * poolK);
      }

      lights.draw(p);
    },
  };
}
