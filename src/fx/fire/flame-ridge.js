import { Particles, Bits, Lights, P, PF, B, Rng, fit, sparkle, clamp, smooth, seg, lerp, ease, loopNoise, rand, mix, TAU, WHITE } from "../../core/index.js";
import { hotFirst, flameTongue, flameBlade, firePuff, simDraw, floorLight, LAYERS, BACK_LAYERS } from "./_lib.js";
import { stoneShape, drawRock, drawSpike, spikeLook, spikeCrack } from "../nature/_lib.js";

export const meta = {
  name: "Flame ridge",
  desc: "A magma seam races ahead as volcanic rock spikes crowned in fire burst up in a rising wave, surge white-hot, shatter into fireballs and smoke, and leave a breathing rift.",
  tags: ["fire", "ridge", "spikes", "lava", "earth", "ground", "wave", "directional", "one-shot"],
  size: [280, 124],
  origin: [24, 106],
  duration: 3.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#1a0f0a", "#4a1a10", "#7d2a12", "#b84416", "#e0701c", "#f5a429", "#ffd166", "#fff4c9"],
    stone: ["#110d12", "#1e171f", "#2f242e", "#45343f", "#5e4752", "#7c5f68", "#a18086", "#cbb0b2"],
    shadow: ["#0d0a12"],
    reach: 184,
    height: 66,
    seed: 11,
  },
};

const T_START = 0.0;
const T_RUN = 0.44;
const T_SURGE = 0.76;
const T_TREMBLE = 1.22;
const T_SHATTER = 1.4;
const T_AFTER = 2.25;
const T_END = 3.5;
const RISE = 0.095;
const FALL = 0.21;
const SINK = 0.34;

export function create(o) {
  const C = fit(o.palette, 8), H = hotFirst(C);
  const S = fit(o.stone, 8);
  const SH = fit(o.shadow, 1)[0];
  const GLOW_RAMP = [C[1], C[3], C[5], C[6], C[7]];
  const R = new Rng(o.seed), seed = o.seed * 19, floor = () => 0;
  const REACH = o.reach, H_MAX = o.height;
  const SOOT = mix(SH, S[1], 0.4);

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [C[7], C[6], C[5], C[3]],
    haze: C[4],
  });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  const front = (tt) => 12 + (REACH - 12) * (1 - Math.pow(1 - seg(tt, T_START, T_START + T_RUN), 1.65));
  const reachedAt = (x) => (x <= 12 ? 0 : T_START + T_RUN * (1 - Math.pow(1 - clamp((x - 12) / (REACH - 12)), 1 / 1.65)));

  // Height envelope swelling from left to a towering crest at q = 0.80
  const env = (q) => 0.34 + 0.66 * Math.pow(clamp(q / 0.82), 0.78) * (q > 0.85 ? 0.88 : 1);

  const clusters = [];
  const xs = [12, 38, 68, 102, 138, 172];
  for (let idx = 0; idx < xs.length; idx++) {
    const x = xs[idx] + R.range(-2, 2);
    const q = clamp(x / REACH);
    const ch = H_MAX * env(q) * R.range(0.94, 1.05);
    const cw = clamp(ch * 0.38, 9, 23);
    const t0 = reachedAt(x) + 0.015;
    const tSplit = T_SHATTER + q * 0.11;
    const spikes = [
      {
        dx: cw * R.range(0.32, 0.52),
        h: ch * R.range(0.56, 0.7),
        w: cw * 0.7,
        lean: ch * R.range(0.32, 0.46),
        at: t0 + 0.022,
        split: tSplit - 0.02,
        back: true,
        main: false,
      },
      {
        dx: -cw * R.range(0.34, 0.48),
        h: ch * R.range(0.38, 0.5),
        w: cw * 0.6,
        lean: ch * R.range(0.08, 0.18),
        at: t0 + 0.036,
        split: tSplit + 0.015,
        back: false,
        main: false,
      },
      {
        dx: 0,
        h: ch,
        w: cw,
        lean: ch * R.range(0.2, 0.3),
        at: t0,
        split: tSplit,
        back: false,
        main: true,
      },
    ];
    for (const sp of spikes) {
      sp.look = spikeLook(R);
      sp.cracks = [
        spikeCrack(R, R.range(0.05, 0.18), R.range(-0.55, -0.1), 1),
        spikeCrack(R, R.range(0.24, 0.42), R.range(0.1, 0.55), -1),
        spikeCrack(R, R.range(0.45, 0.62), R.range(-0.35, 0.35), R.sign()),
      ];
      sp.cut = R.range(0.13, 0.2);
      sp.top = 1;
    }
    // Heaved basalt floor slab at the foot of each ridge cluster
    const slabs = [-1, 1].map((sd) => ({
      dx: sd * (cw * 0.44 + R.range(2, 5)),
      s: R.range(4.2, 5.8) * (0.7 + 0.3 * q),
      a: sd * R.range(0.4, 0.62),
      pts: [
        [-1.15, -0.34],
        [1.1, -0.42],
        [1.18, 0.38],
        [-1.08, 0.4],
      ],
    }));

    // Side floor cracks radiating out from each cluster crater
    const sideCracks = [-1, 1].map((sd) => {
      const pts = [[x, 0.5]];
      let cx = x, cy = 0.5, a = (sd > 0 ? 0.35 : -0.35) + R.range(-0.2, 0.2);
      const len = R.range(10, 18) * (0.7 + 0.3 * q);
      for (let d = 0; d < len; d += 2.5) {
        a += R.range(-0.35, 0.35);
        cx += Math.cos(a) * 2.5 * R.sign();
        cy = clamp(cy + Math.sin(a) * 0.85, -2.2, 3.2);
        pts.push([cx, cy]);
      }
      return pts;
    });

    clusters.push({
      idx,
      x,
      q,
      H: ch,
      W: cw,
      t0,
      tSplit,
      spikes,
      main: spikes[2],
      slabs,
      sideCracks,
      up: false,
      shattered: false,
      blobs: Array.from({ length: 4 }, () => ({
        dx: R.range(-cw * 0.38, cw * 0.48),
        y0: -ch * R.range(0.18, 0.82),
        vx: R.range(8, 34),
        vy: -R.range(16, 42),
        size: R.range(4.2, 7.0) * (0.65 + 0.45 * q),
        life: R.range(0.32, 0.5),
        frac: R.next(),
      })),
    });
  }

  // Breathing ember coals along the magma rift for afterglow
  const riftCoals = Array.from({ length: 42 }, (_, i) => {
    const x = 4 + (i / 41) * (REACH - 4) + R.range(-2.5, 2.5);
    return {
      x,
      y: R.range(-1.2, 2.2),
      q: clamp(x / REACH),
      ph: R.range(0, TAU),
      tEnd: R.range(2.85, 3.38),
    };
  });

  const addRock = (b) => bits.add({ ...b, pts: stoneShape(R) });
  let t = 0, cast = false;

  const grown = (sp) => (t < sp.at ? 0 : ease.outBack(clamp((t - sp.at) / RISE), 2.1));
  const gap = (sp) => smooth(sp.split, sp.split + 0.08, t) * (sp.main ? 2.4 : 1.6);
  const tip = (sp) => smooth(sp.split, sp.split + 0.08 + FALL, t) * 0.12 * sp.h;
  const topAt = (sp) => lerp(1, sp.cut, ease.outQuad(clamp((t - sp.split - 0.015) / FALL)));

  function crumbleBand(c, sp, u0, u1) {
    const gp = gap(sp), tp = tip(sp), x0 = c.x + sp.dx;
    const u = (u0 + u1) / 2;
    const hw = (sp.w / 2) * Math.pow(1 - u, 0.85);
    if (hw < 1.2) return;
    const half = R.sign();
    const rx = x0 + sp.lean * u + half * (gp / 2 + hw * 0.45 + tp * u);
    const ry = -u * sp.h;
    addRock({
      kind: B.CHUNK,
      x: rx,
      y: ry,
      vx: half * R.range(10, 38) + sp.lean * 0.4,
      vy: -R.range(14, 68),
      g: 1,
      drag: 0.45,
      bounce: 0.3,
      life: Math.min(R.range(0.68, 1.15), T_END - 0.15 - t),
      a: R.range(0, TAU),
      va: R.range(-12, 12),
      s: clamp(hw * 0.58, 1.8, 3.8),
    });
  }

  function eruptCluster(c) {
    const k = 0.45 + 0.65 * (c.H / H_MAX);
    lights.add(c.x + 4, -Math.min(34, c.H * 0.45), Math.min(34, 16 + c.H * 0.25), C[7], 0.55 * k, 0.12);
    lights.add(c.x + 4, -15, Math.min(32, 18 + c.H * 0.2), C[5], 0.48 * k, 0.45);
    for (let i = 0; i < Math.round(3 * k) + 2; i++) {
      const a = -Math.PI / 2 + R.range(-0.85, 0.9), sp = R.range(85, 200) * k;
      addRock({
        kind: B.CHUNK,
        x: c.x + R.range(-c.W * 0.3, c.W * 0.3),
        y: -R.range(1, 5),
        vx: Math.cos(a) * sp + 18,
        vy: Math.sin(a) * sp,
        g: 1,
        drag: 0.5,
        bounce: 0.3,
        life: R.range(0.65, 1.15),
        a: R.range(0, TAU),
        va: R.range(-15, 15),
        s: R.range(1.7, 3.0) * (0.75 + 0.3 * k),
      });
    }
    for (let i = 0; i < Math.round(24 * k) + 6; i++) {
      const a = -Math.PI / 2 + R.range(-0.85, 0.85), sp = R.range(65, 195) * k;
      ps.spawn(P.GRIT, c.x + R.range(-c.W * 0.35, c.W * 0.35), -1, Math.cos(a) * sp + 12, Math.sin(a) * sp, R.range(0.65, 1.25), R.pick([S[6], S[5], S[4], C[5]]), R.chance(0.4) ? 2 : 1);
    }
    for (let i = 0; i < Math.round(14 * k) + 4; i++) {
      const a = -Math.PI / 2 + R.range(-0.8, 0.85), sp = R.range(95, 215);
      ps.spawn(P.SPARK, c.x + R.range(-3, 3), -2, Math.cos(a) * sp + 14, Math.sin(a) * sp, R.range(0.22, 0.5));
    }
    for (let i = 0; i < Math.round(5 * k) + 2; i++) {
      ps.spawn(P.FIRE, c.x + R.range(-4, 6), -R.range(2, c.H * 0.45), R.range(4, 28), -R.range(26, 64), R.range(0.22, 0.42), 0, R.range(2.2, 4.0) * k, 0, R.chance(0.45) ? PF.SMOKES : 0);
    }
  }

  function shatterCluster(c) {
    const k = 0.5 + 0.55 * (c.H / H_MAX);
    lights.add(c.x + c.main.lean * 0.4, -Math.min(36, c.H * 0.5), Math.min(34, 18 + c.H * 0.22), C[6], 0.6 * k, 0.35);
    for (let i = 0; i < Math.round(16 * k) + 6; i++) {
      const u = R.range(0.15, 0.92);
      ps.spawn(P.SPARK, c.x + c.main.lean * u + R.range(-4, 4), -c.H * u, R.range(-50, 62), R.range(-72, 35), R.range(0.35, 0.75));
    }
    for (let i = 0; i < Math.round(14 * k) + 4; i++) {
      const u = R.range(0.2, 0.9);
      ps.spawn(P.GRIT, c.x + c.main.lean * u + R.range(-4, 4), -c.H * u, R.range(-40, 55), -R.range(20, 85), R.range(0.7, 1.3), R.pick([S[6], S[5], S[4], C[5]]), R.chance(0.45) ? 2 : 1);
    }
    for (let i = 0; i < Math.round(6 * k) + 3; i++) {
      const u = R.range(0.12, 0.85);
      const sx = c.x + c.main.lean * u + R.range(-6, 6), sy = -c.H * u;
      ps.spawn(P.FIRE, sx, sy, R.range(-12, 28), -R.range(16, 44), R.range(0.26, 0.48), 0, R.range(3.2, 5.4) * k, 0, PF.SMOKES | PF.BIG);
      ps.spawn(
        P.SMOKE,
        sx,
        sy,
        R.range(-14, 34),
        -R.range(8, 26),
        R.range(0.85, 1.38),
        SOOT,
        R.range(5.4, 9.2) * (0.75 + 0.3 * k),
        R.range(0, 0.14),
        PF.BIG
      );
    }
  }

  function drawSpikeShard(p, c, sp) {
    const g = grown(sp);
    if (g <= 0) return;
    const x = c.x + sp.dx;
    const jx = t >= T_TREMBLE && t < sp.split ? ((Math.floor(t * 42) + c.idx) % 2 ? 1 : -1) : 0;
    const surgeWave = clamp(1 - Math.abs(t - (T_SURGE + c.q * 0.36)) / 0.24);
    const crackAmt = clamp(smooth(sp.at + 0.08, sp.split - 0.04, t) * 0.75 + 0.35 * surgeWave);
    const heatAmt = clamp(0.45 + 0.55 * surgeWave + 0.5 * smooth(T_TREMBLE, sp.split, t));

    if (t < sp.split) {
      const isWhite = t - sp.at < 0.036 || (t >= sp.split - 0.045 && t < sp.split);
      const gl = (t - (T_SURGE + c.q * 0.32)) / 0.22;
      drawSpike(p, x + jx, 0, sp.h * g, sp.w, sp.lean * Math.min(1, g), sp.look, S, {
        white: isWhite,
        glint: gl >= 0 && gl <= 1 ? gl : -1,
        cracks: sp.cracks,
        crack: crackAmt,
        heat: heatAmt,
        glowRamp: GLOW_RAMP,
      });
      return;
    }

    // Split & crumble into parting halves while the stump sinks back into the floor
    const top = topAt(sp), gp = gap(sp), tp = tip(sp);
    const sink = smooth(sp.split + FALL * 0.45, sp.split + FALL + SINK, t) * sp.h * (sp.cut + 0.08);
    if (sink >= sp.h * (sp.cut + 0.06)) return;
    const cool = 1 - smooth(sp.split, sp.split + 0.38, t);
    if (!sp.main) {
      drawSpike(p, x, sink, sp.h, sp.w, sp.lean, sp.look, S, {
        clip: top,
        floor: 0,
        cracks: sp.cracks,
        crack: 1,
        heat: cool,
        glowRamp: GLOW_RAMP,
      });
      return;
    }
    for (const half of [-1, 1]) {
      drawSpike(p, x + (half * gp) / 2, sink, sp.h, sp.w, sp.lean + half * tp, sp.look, S, {
        half,
        clip: top,
        floor: 0,
        cracks: sp.cracks,
        crack: 1,
        heat: cool,
        glowRamp: GLOW_RAMP,
      });
    }
  }

  function drawRiftAndScorch(p) {
    const fr = front(t);
    if (fr < 1) return;
    const afterFade = 1 - smooth(2.95, 3.44, t);
    if (afterFade <= 0) return;

    // Breathing rhythm in afterglow (2.25 - 3.5s)
    const breath = 0.5 + 0.5 * Math.cos((t - T_AFTER) * 10.5);

    // Scorched elliptical craters & branching floor fissures at each cluster site
    for (const c of clusters) {
      if (t < c.t0 - 0.02) continue;
      const cGrow = ease.outCubic(clamp((t - c.t0 + 0.02) / 0.14));
      const localBreath = 0.5 + 0.5 * Math.cos((t - T_AFTER) * 10.5 - c.q * 2.4);
      const cHot =
        t < T_SHATTER
          ? 0.9
          : t < T_AFTER
          ? lerp(0.9, 0.52, seg(t, T_SHATTER, T_AFTER))
          : (0.2 + 0.56 * localBreath) * afterFade;

      const rx = (c.W * 0.72 + 4) * cGrow, ry = 2.4 * cGrow;
      p.ellipse(c.x, 0.5, rx, ry, SH, 0.76 * afterFade);
      p.ellipse(c.x, 0.5, rx * 0.68, ry * 0.68, cHot > 0.55 ? C[5] : cHot > 0.3 ? C[3] : C[1], 0.85 * afterFade);

      for (const sc of c.sideCracks) {
        const nPts = Math.floor(sc.length * cGrow);
        for (let i = 1; i < nPts; i++) {
          const u = i / sc.length;
          const lh = cHot * (1 - 0.35 * u);
          const col = lh > 0.68 ? C[6] : lh > 0.45 ? C[5] : lh > 0.25 ? C[3] : C[1];
          p.line(sc[i - 1][0], sc[i - 1][1], sc[i][0], sc[i][1], col, afterFade * 0.9);
        }
      }
    }

    for (let x = -2; x <= Math.min(fr, REACH + 4); x++) {
      const q = clamp(x / REACH);
      const age = t - reachedAt(Math.max(0, x));
      if (age < 0) continue;
      const head = fr - x < 5 && fr < REACH - 1;
      const localBreath = 0.5 + 0.5 * Math.cos((t - T_AFTER) * 10.5 - q * 3.5);
      const hot =
        t < T_SHATTER
          ? clamp(0.75 + 0.35 * Math.exp(-age * 5))
          : t < T_AFTER
          ? lerp(0.85, 0.48, seg(t, T_SHATTER, T_AFTER))
          : (0.18 + 0.52 * localBreath) * afterFade;

      // Dark scorched trench across the floor (y = -1..3)
      const trenchW = 2 + Math.round(rand(x, 13) * 2.2);
      for (let dy = -1; dy <= trenchW; dy++) {
        p.blend(x, dy, dy <= 0 ? SH : SOOT, 0.72 * afterFade * (1 - Math.abs(dy) / (trenchW + 1.5)));
      }

      // Jagged magma seam in the center of the trench
      const jy = Math.round((rand(Math.floor(x / 3), 29) - 0.4) * 1.6);
      const seamCol = head
        ? WHITE
        : hot > 0.78
        ? C[7]
        : hot > 0.58
        ? C[6]
        : hot > 0.4
        ? C[5]
        : hot > 0.24
        ? C[3]
        : hot > 0.12
        ? C[2]
        : C[1];
      p.dot(x, jy, seamCol, afterFade);
      if (hot > 0.35 && (x & 1) === 0) {
        p.dot(x, jy + 1, hot > 0.65 ? C[5] : C[3], afterFade * 0.85);
      }
      if ((x & 7) === 0 && hot > 0.2) {
        p.glow(x, jy, 8, C[4], 0.24 * hot * afterFade);
      }
    }

    // Blazing lead head of the racing magma fissure
    if (fr < REACH - 1 && t >= T_START) {
      p.glow(fr, -2, 14, C[6], 0.65);
      p.glow(fr, -1, 7, WHITE, 0.7);
    }

    // Breathing ember coals along the scorched trench during afterglow
    if (t >= T_SHATTER) {
      for (const rc of riftCoals) {
        if (t >= rc.tEnd || rc.x > fr) continue;
        const k = (1 - smooth(rc.tEnd - 0.45, rc.tEnd, t)) * afterFade;
        const pulse = 0.45 + 0.55 * Math.cos((t - T_AFTER) * 10.5 + rc.ph);
        const h = k * (0.3 + 0.7 * pulse);
        if (h < 0.12) continue;
        const col = h > 0.68 ? C[6] : h > 0.45 ? C[5] : h > 0.26 ? C[3] : C[2];
        p.dot(rc.x, rc.y, col, Math.min(1, h * 1.4));
        if (h > 0.45) p.light(rc.x, rc.y, C[4], 0.32 * h);
      }
      floorLight(p, REACH * 0.52, 0.5, 86, 8, C[4], 0.24 * (0.35 + 0.65 * breath) * afterFade);
    }
  }

  return {
    update(dt) {
      t += dt;

      // Initial origin ignition slam at t = T_START
      if (!cast && t >= T_START) {
        cast = true;
        lights.add(8, -12, 26, C[6], 0.75, 0.25);
        for (let i = 0; i < 18; i++) {
          const a = -Math.PI / 2 + R.range(-0.25, 1.15), sp = R.range(80, 195);
          ps.spawn(P.SPARK, R.range(2, 8), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.18, 0.42));
        }
      }

      // Racing magma front throws forward streaks, sparks, and fire wisps
      const fr = front(t);
      if (t >= T_START && fr < REACH - 1) {
        if (R.chance(0.75 * dt * 60)) {
          ps.spawn(P.STREAK, fr - R.range(2, 10), -R.range(1, 3), R.range(50, 105), -R.range(2, 12), R.range(0.08, 0.15), R.chance(0.5) ? C[7] : C[5]);
        }
        if (R.chance(0.55 * dt * 60)) {
          ps.spawn(P.FIRE, fr - R.range(0, 6), -1, R.range(12, 48), -R.range(22, 52), R.range(0.16, 0.3), 0, R.range(1.6, 2.8));
        }
      }

      // Staggered cluster eruptions & chain-reaction shatter
      for (const c of clusters) {
        if (!c.up && t >= c.t0) {
          c.up = true;
          eruptCluster(c);
        }
        if (!c.shattered && t >= c.tSplit) {
          c.shattered = true;
          shatterCluster(c);
        }
        // Progressive top-down crumbling of the main spike after split
        const sp = c.main;
        if (t >= sp.split) {
          const top = topAt(sp);
          while (sp.top - top > 0.08 || (top <= sp.cut + 1e-6 && sp.top > sp.cut + 1e-6)) {
            const u1 = sp.top, u0 = Math.max(top, sp.top - 0.2);
            crumbleBand(c, sp, u0, u1);
            sp.top = u0;
            if (u0 <= sp.cut + 1e-6) break;
          }
        }
        // Active ridge vents fire & embers while standing
        if (c.up && !c.shattered && R.chance(0.42 * dt * 60)) {
          const u = R.range(0.15, 0.85);
          ps.spawn(P.FIRE, c.x + c.main.lean * u + R.range(-3, 3), -c.H * u, R.range(6, 26), -R.range(24, 54), R.range(0.18, 0.34), 0, R.range(1.8, 3.4), 0, R.chance(0.3) ? PF.SMOKES : 0);
        }
      }

      // Afterglow lazy embers and thin soot smoke rising from the breathing rift
      if (t >= T_AFTER && t < 3.0) {
        if (R.chance(0.32 * dt * 60)) {
          const rc = R.pick(riftCoals);
          ps.spawn(P.EMBER, rc.x, rc.y - 1, R.range(-8, 14), -R.range(16, 36), R.range(0.42, 0.72), C[5], 1);
        }
        if (R.chance(0.18 * dt * 60)) {
          const rc = R.pick(riftCoals);
          ps.spawn(P.SMOKE, rc.x, rc.y - 1, R.range(-5, 10), -R.range(10, 22), R.range(0.45, 0.75), SH, R.range(2.0, 3.4));
        }
      }

      bits.update(dt);
      // Stones that land hard kick up a little soot/grit puff
      for (const b of bits.list) {
        if (b.rest && !b.dusted) {
          b.dusted = true;
          ps.spawn(P.SMOKE, b.x, -0.5, R.sign() * R.range(6, 22), -R.range(4, 14), Math.min(R.range(0.28, 0.5), T_END - 0.1 - t), SOOT, R.range(1.6, 2.8));
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      if (t >= T_END - 1e-6) return;
      drawRiftAndScorch(p);
      simDraw(p, ps, H, "back");

      // Back companion shards and rear flame tongues
      const NZ = (rate, s0, off = 0) => loopNoise(t * rate * 0.15 + off * 0.1, 1.4, s0);
      for (const c of clusters) {
        if (t < c.t0) continue;
        for (const sp of c.spikes) if (sp.back) drawSpikeShard(p, c, sp);
        if (t < c.tSplit + 0.12) {
          const surge = 1 + 0.42 * clamp(1 - Math.abs(t - (T_SURGE + c.q * 0.36)) / 0.25);
          const fk = (t < c.tSplit ? smooth(c.t0, c.t0 + 0.08, t) : 1 - seg(t, c.tSplit, c.tSplit + 0.12)) * surge;
          flameTongue(p, c.x - c.W * 0.25, 0, c.H * 0.68 * fk, 3.2 * fk, c.H * 0.18, NZ, seed + c.idx * 37, H, BACK_LAYERS);
        }
      }
    },
    draw(p) {
      if (t >= T_END - 1e-6) return;
      const NZ = (rate, s0, off = 0) => loopNoise(t * rate * 0.15 + off * 0.1, 1.4, s0);

      // Origin cast flash (1-2 frames at t = T_START) + initial ignition flame jet
      if (t >= T_START && t < T_START + 0.09) {
        const hk = t < T_START + 0.033 ? 1 : 0.72;
        flameTongue(p, 8, 1, 22 * hk, 3.6 * hk, 5.0, NZ, seed + 7, H, LAYERS);
        p.ellipse(8, -1.5, 13 * hk, 4.0 * hk, C[6]);
        p.ellipse(8, -2.0, 8.5 * hk, 2.6 * hk, C[7]);
        sparkle(p, 8, -4, 9 * hk, C[7], C[5], 0.75);
      }

      // Main & front ridge spikes + heaved floor slabs + roaring base/crown flame blades + shatter fireballs
      for (const c of clusters) {
        if (t < c.t0) continue;

        // Heaved basalt slabs around the base of each cluster (before shatter)
        if (t < c.tSplit + 0.18) {
          const slabSink = smooth(c.tSplit, c.tSplit + 0.18, t);
          const sg = ease.outBack(clamp((t - c.t0) / 0.09), 1.8);
          for (const sl of c.slabs) {
            drawRock(p, c.x + sl.dx, -1.2 + slabSink * 4, sl.s * Math.min(1, sg), sl.a * sg, sl.pts, S, 1 - slabSink, t - c.t0 < 0.035);
          }
        }

        for (const sp of c.spikes) if (!sp.back) drawSpikeShard(p, c, sp);

        // Roaring flame tongue at the base + tall forward-sweeping flameBlade crowning past the spike tip
        if (t < c.tSplit + 0.1) {
          const surge = 1 + 0.42 * clamp(1 - Math.abs(t - (T_SURGE + c.q * 0.36)) / 0.24);
          const fk = (t < c.tSplit ? smooth(c.t0, c.t0 + 0.07, t) : 1 - seg(t, c.tSplit, c.tSplit + 0.1)) * surge;
          flameTongue(p, c.x + c.W * 0.18, 1, c.H * 0.56 * fk, 3.2 * fk, c.H * 0.24, NZ, seed + c.idx * 53, H, LAYERS);
          flameBlade(p, c.x + c.main.lean * 0.34, -c.H * 0.28, 0.34, -0.94, (14 + c.H * 0.68) * fk, 2.8 * fk, -2.6, NZ, seed + c.idx * 71, H);
        }

        // Breakthrough hero glint at spike tip + pre-shatter flash
        const eUp = t - c.t0;
        if (eUp >= 0 && eUp < 0.14) {
          const g = grown(c.main);
          sparkle(p, c.x + c.main.lean * g, -c.H * g, 9 * (1 - eUp / 0.14), C[7], C[5], 0.55);
        }
        const eSplit = c.tSplit - t;
        if (eSplit > 0 && eSplit < 0.09) {
          sparkle(p, c.x + c.main.lean, -c.H, 8 * (1 - eSplit / 0.09), C[7], C[5], 0.6);
        }

        // Shatter fireball puffs rising from each detonated spike
        if (t >= c.tSplit) {
          for (const b of c.blobs) {
            const age = t - c.tSplit;
            if (age <= 0 || age >= b.life) continue;
            const k = 1 - age / b.life;
            firePuff(p, c.x + b.dx + b.vx * age, b.y0 + b.vy * age, k, b.size, b.frac, H, 0.14);
          }
        }
      }

      // Tumbling volcanic rock chunks
      for (const b of bits.list) {
        drawRock(p, b.x, b.y, b.s, b.a, b.pts, S, Math.min(1, b.life / 0.3));
      }

      simDraw(p, ps, H, "front");
      lights.draw(p);
    },
  };
}
