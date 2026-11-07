import { Particles, Lights, P, PF, Rng, fit, band, sparkle, clamp, smooth, seg, lerp, ease, tileFbm, loopNoise, mix, TAU } from "../../core/index.js";
import { hotFirst, flameTongue, flameBlade, firePuff, simDraw, floorLight, LAYERS } from "./_lib.js";

export const meta = {
  name: "Qilin descent",
  desc: "Teal spirit rings contract under four hooffalls, blasting a shockwave and fiery cracks before a golden pillar wrapped in teal mane-fire erupts, shatters, and cools.",
  tags: ["fire", "qilin", "pillar", "eruption", "spirit", "shockwave", "ground", "one-shot"],
  size: [224, 256],
  origin: [112, 228],
  duration: 4.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#1a0f0a", "#4a1a10", "#7d2a12", "#b84416", "#e0701c", "#f5a429", "#ffd166", "#fff4c9"],
    spirit: ["#0d2426", "#14393b", "#1d5254", "#2a7376", "#3f9a9d", "#6fc3c4", "#b5e6e5"],
    shadow: ["#141d2e"],
    seed: 7,
  },
};

const T_CHARGE = 0.5;
const T_ERUPT = 0.7;
const T_SHATTER = 1.6;
const T_COLLAPSED = 1.98;
const T_AFTER = 2.4;
const T_END = 4.5;
const H_MAX = 148;
const R_MAX = 92;
const SY = 0.18;

// Four Qilin hoof landing spots in perspective around (0, 0)
const HOOVES = [
  [-14, -2.5],
  [14, -2.5],
  [-21, 2.2],
  [21, 2.2],
];

export function create(o) {
  const C = fit(o.palette, 8), H = hotFirst(C);
  const S = fit(o.spirit, 7), SH_MANE = [...S, S[6]].reverse();
  const SH = fit(o.shadow, 1)[0];
  const R = new Rng(o.seed), seed = o.seed * 17, floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [C[7], C[6], C[5], C[3]],
    haze: S[3],
  });
  const lights = new Lights();

  // Floor cracks radiating from the four hooffalls and center
  const cracks = [];
  const fissureVents = [];
  const addCrack = (x, y, a, len, t0, main) => {
    const pts = [[x, y]];
    for (let d = 0; d < len; d += 2.2) {
      a += R.range(-0.46, 0.46);
      x += Math.cos(a) * 2.2;
      y += Math.sin(a) * 0.62;
      pts.push([x, y]);
    }
    cracks.push({ pts, t0, grow: R.range(0.07, 0.12), main, ph: R.range(0, TAU) });
    return pts;
  };
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + R.range(-0.18, 0.18);
    const h0 = HOOVES[i % 4];
    const pts = addCrack(h0[0] * 0.45, h0[1] * 0.45, a, R.range(28, 54), T_CHARGE + R.range(0, 0.025), true);
    if (pts.length > 6) {
      const vi = Math.min(pts.length - 2, 4 + (i % 4));
      fissureVents.push({ x: pts[vi][0], y: pts[vi][1], lean: Math.cos(a) * 1.5, h: R.range(8, 13), s: seed + i * 29 });
    }
    if (pts.length > 7) {
      const bi = 3 + R.int(0, pts.length - 5);
      addCrack(pts[bi][0], pts[bi][1], a + R.sign() * R.range(0.45, 0.9), R.range(10, 20), T_CHARGE + R.range(0.02, 0.06), false);
    }
  }

  // Shatter flame clusters that break off the column during 1.6 - 2.28s
  const shatterBlobs = Array.from({ length: 18 }, (_, i) => ({
    x0: R.range(-9, 9),
    y0: -14 - (i / 18) * (H_MAX - 20) + R.range(-4, 4),
    vx: R.range(-22, 22),
    vy: -R.range(16, 42),
    size: R.range(4.0, 6.8),
    delay: R.range(0, 0.16),
    life: R.range(0.32, 0.5),
    frac: R.next(),
  }));

  // Breathing ember coals arranged around the scorched ring for the afterglow phase
  const coalSpots = Array.from({ length: 32 }, (_, i) => {
    const ring = i < 18;
    const a = (i / (ring ? 18 : 14)) * TAU + R.range(-0.18, 0.18);
    const d = ring ? R.range(22, 36) : R.range(4, 20);
    return {
      x: Math.cos(a) * d,
      y: Math.sin(a) * d * SY,
      d: d / 38,
      ph: R.range(0, 0.9),
      tEnd: R.range(3.85, 4.38),
    };
  });

  let t = 0, released = false, erupted = false, shattered = false;

  const colHeight = (tt) => {
    if (tt < T_ERUPT) return 0;
    if (tt < T_ERUPT + 0.11) return H_MAX * ease.outCubic((tt - T_ERUPT) / 0.11);
    if (tt < T_SHATTER) return H_MAX * (0.97 + 0.03 * loopNoise((tt - T_ERUPT) / 0.9, 1.2, seed + 5));
    if (tt < T_COLLAPSED) return H_MAX * (1 - ease.inQuad(seg(tt, T_SHATTER, T_COLLAPSED)));
    return 0;
  };

  const colWidth = (tt) => {
    if (tt < T_ERUPT || tt >= T_COLLAPSED) return 0;
    if (tt < T_SHATTER) {
      const pop = 1 + 0.38 * Math.exp(-(tt - T_ERUPT) * 9);
      return 13.5 * pop * (0.94 + 0.06 * loopNoise(tt * 1.5, 1, seed + 9));
    }
    return 13.5 * (1 - smooth(T_SHATTER, T_COLLAPSED, tt));
  };

  // Counter-spiraling teal Qilin mane-flames wrapping outside the golden pillar
  function drawMane(p, back) {
    if (t < T_ERUPT || t >= T_COLLAPSED) return;
    const h = colHeight(t), w0 = colWidth(t);
    if (h < 6 || w0 < 1) return;
    const dissolve = t < T_SHATTER ? 0 : seg(t, T_SHATTER, T_COLLAPSED);
    const NZ = (rate, s0, off = 0) => loopNoise(t * rate * 0.14 + off * 0.1, 1.3, s0);

    for (let s = 0; s < 2; s++) {
      const baseA = s * Math.PI;
      for (let y = -3; y >= -h * 0.95; y--) {
        const v = -y / h;
        // Counter-rotating helix (opposite direction to the column's internal scroll)
        const ang = baseA - v * TAU * 1.75 + t * 9.2;
        const sn = Math.sin(ang), cs = Math.cos(ang);
        if ((sn < 0) !== back) continue;

        const nTurb = tileFbm(v * 6.5, t * 4.2 + s * 3.7, 8, 8, seed + 41, 2);
        if (dissolve > 0 && 0.5 + 0.5 * nTurb < dissolve * 1.15) continue;

        const foot = 1 + 0.45 * Math.max(0, 1 - -y / 16) ** 2;
        const topTaper = 1 - smooth(0.78, 0.95, v) * 0.72;
        const rMane = w0 * foot * topTaper * (1.05 + 0.25 * Math.sin(Math.PI * v)) + 2.0 + nTurb * 2.0;
        const x = cs * rMane;
        const depth = 0.5 + 0.5 * sn;
        const sideCrest = Math.pow(Math.abs(cs), 1.4);
        const mw = (2.8 + 2.0 * sideCrest) * topTaper * (1 - dissolve * 0.65);

        for (let dx = -Math.ceil(mw); dx <= Math.ceil(mw); dx++) {
          const q = Math.abs(dx) / Math.max(0.7, mw);
          if (q > 1) continue;
          const lickNoise = 0.5 + 0.5 * tileFbm((x + dx) * 0.18, y * 0.14 - t * 6.0, 8, 8, seed + 63, 2);
          const col =
            q < 0.3 ? (depth > 0.52 ? S[6] : S[5]) : q < 0.64 ? (depth > 0.42 ? S[5] : S[4]) : q < 0.86 ? S[3] : S[1];
          // Upward-licking flame serrations along the upper edge of the spiral band
          const liftH = Math.ceil((1 - q * 0.7) * (1.8 + 2.8 * lickNoise) * topTaper * (1 - dissolve * 0.5));
          for (let ly = 0; ly <= liftH; ly++) {
            const cStep = ly === liftH ? S[2] : ly > liftH * 0.6 ? S[4] : col;
            p.px(x + dx, y - ly, cStep);
          }
        }

        // At the left/right turning points of the helix, flick out an upward teal mane-tongue
        if (Math.abs(cs) > 0.9 && ((-y) | 0) % 15 === 0 && dissolve < 0.55) {
          const dirX = cs > 0 ? 0.38 : -0.38;
          flameBlade(
            p,
            x,
            y,
            dirX,
            -0.92,
            (10 + 5 * (1 - v)) * (1 - dissolve),
            2.0 * (1 - dissolve * 0.5),
            -cs * 2.4,
            NZ,
            seed + s * 31 + ((-y) | 0),
            SH_MANE
          );
        }

        if (((-y) | 0) % 12 === 0 && -y > 10) {
          p.glow(x, y, 7, S[4], (back ? 0.12 : 0.24) * (1 - dissolve));
        }
      }
    }
  }

  function drawColumn(p) {
    // Draw rising & cooling shatter flame blobs during 1.6 - 2.28s so the pillar breaks apart organically
    if (t >= T_SHATTER && t < T_AFTER) {
      for (const b of shatterBlobs) {
        const age = t - T_SHATTER - b.delay;
        if (age <= 0 || age >= b.life) continue;
        const k = 1 - age / b.life;
        const bx = b.x0 + b.vx * age;
        const by = b.y0 + b.vy * age;
        firePuff(p, bx, by, k, b.size, b.frac, H, 0.14);
      }
    }

    const h = colHeight(t), w0 = colWidth(t);
    if (h < 2 || w0 < 0.8) return;
    const shatter = t < T_SHATTER ? 0 : seg(t, T_SHATTER, T_COLLAPSED);
    const NZ = (rate, s0, off = 0) => loopNoise(t * rate * 0.15 + off * 0.1, 1.4, s0);

    // Crown of flame tongues at the top of the pillar
    if (shatter < 0.75) {
      const k = (1 - shatter / 0.75) * clamp(w0 / 13);
      for (let i = -2; i <= 2; i++) {
        const dx = i * w0 * 0.36;
        const th = (15 + 11 * (0.5 + 0.5 * NZ(3.2, seed + i * 11))) * k * (i === 0 ? 1.25 : Math.abs(i) === 2 ? 0.65 : 0.92);
        flameTongue(p, dx, -h + 10, th, 3.6 * k, -dx * 0.25, NZ, seed + i * 19, H, LAYERS);
      }
    }

    for (let y = 0; y >= -h; y--) {
      const v = -y / h;
      const sway = tileFbm(v * 3.5, -t * 3.8, 8, 8, seed + 10, 3) * 3.2 * v;
      const turbL = Math.max(0, tileFbm(v * 7, -t * 5.4, 8, 8, seed + 20, 2));
      const turbR = Math.max(0, tileFbm(v * 7 + 3.1, -t * 5.4, 8, 8, seed + 30, 2));

      const foot = 1 + 0.72 * Math.max(0, 1 - -y / 15) ** 2;
      const top = 1 - smooth(0.82, 1, v) * 0.68;
      const wl = w0 * foot * top * (1 + 0.58 * turbL);
      const wr = w0 * foot * top * (1 + 0.58 * turbR);
      const pulse = 0.14 * loopNoise(v * 2.5 - t * 3.2, 1.3, seed + 77);

      for (let x = Math.floor(sway - wl * 1.12); x <= Math.ceil(sway + wr * 1.12); x++) {
        const dx = x + 0.5 - sway;
        const q = Math.abs(dx) / Math.max(0.5, dx < 0 ? wl : wr);
        if (q > 1.08) continue;
        const fNoise = 0.18 * tileFbm(x * 0.14, y * 0.11 - t * 6.5, 16, 16, seed + 91, 2);
        if (shatter > 0 && q + (0.5 + fNoise * 2.2) * shatter > 1.02 - shatter * 0.45) continue;
        const d = clamp(q + fNoise - pulse - (1 - shatter) * 0.06, 0, 1.05);
        if (d > 1.0) continue;
        const ci = d < 0.16 ? 7 : d < 0.32 ? 6 : d < 0.5 ? 5 : d < 0.66 ? 4 : d < 0.8 ? 3 : d < 0.92 ? 2 : 1;
        const cooled = Math.max(1, ci - Math.floor(shatter * 2.2));
        p.px(x, y, C[cooled]);
      }
      if ((-y) % 14 === 0 && -y > 16) {
        p.glow(sway, y, Math.min(28, w0 * 1.8 + 6), C[5], 0.22 * (1 - shatter * 0.85));
      }
    }

    // Ring of lively base flames + outer teal hoof-flames around the foot of the pillar
    if (shatter < 0.85) {
      const bk = 1 - shatter / 0.85;
      for (let i = -3; i <= 3; i++) {
        const bx = i * 4.2, bh = (10 - Math.abs(i) * 1.4) * bk;
        flameTongue(p, bx, 1, bh, 2.2 * bk, i * 0.8, NZ, seed + 120 + i * 7, H, LAYERS);
      }
      for (let s = -1; s <= 1; s += 2) {
        flameBlade(p, s * (w0 + 4), 1, s * 0.42, -0.9, 11 * bk, 2.2 * bk, -s * 2.2, NZ, seed + 160 + s * 17, SH_MANE);
      }
    }
    if (h > 44) {
      p.glow(0, -h * 0.46, Math.min(54, h * 0.42 + 12), C[4], 0.24 * (1 - shatter * 0.85));
    }
  }

  function drawScorchAndCracks(p) {
    if (t < T_CHARGE - 0.1) return;
    const afterFade = 1 - smooth(3.9, 4.44, t);
    if (afterFade <= 0) return;

    // Breathing rhythm during afterglow (2.4 - 4.5s): clear warm peaks and dim troughs
    const breathWave = 0.5 + 0.5 * Math.cos((t - T_AFTER) * 9.5);
    const breathMod = 0.8 + 0.2 * loopNoise(t * 0.9, 1.2, seed + 99);
    const breath = breathWave * breathMod;

    const baseHeat =
      t < T_ERUPT
        ? smooth(T_CHARGE - 0.05, T_CHARGE + 0.08, t)
        : t < T_SHATTER
        ? 1
        : t < T_AFTER
        ? lerp(1, 0.65, seg(t, T_SHATTER, T_AFTER))
        : (0.22 + 0.52 * breath) * afterFade;

    // Flat perspective scorch ellipse on the floor (squashed by SY = 0.18)
    if (t >= T_CHARGE) {
      const sGrow = ease.outCubic(seg(t, T_CHARGE, T_CHARGE + 0.18));
      const rx = 44 * sGrow, ry = Math.max(1.5, rx * SY);
      for (let py = Math.floor(-ry); py <= Math.ceil(ry + 1); py++) {
        const dy = (py - 0.5) / ry;
        if (Math.abs(dy) >= 1) continue;
        const spanX = rx * Math.sqrt(1 - dy * dy);
        for (let px = Math.floor(-spanX); px <= Math.ceil(spanX); px++) {
          const d = Math.hypot(px / rx, dy);
          if (d >= 1) continue;
          const col = d < 0.62 ? SH : C[0];
          p.blend(px, py, col, (1 - d * d) * 0.78 * afterFade);
        }
      }

      // Breathing ember ring around the scorched perimeter
      if (t >= T_ERUPT) {
        const ringAlpha = (t < T_AFTER ? 0.55 : (0.25 + 0.55 * breath)) * afterFade;
        const rCol = baseHeat > 0.55 ? [C[1], C[2], C[4], C[5]] : [C[0], C[1], C[2], C[3]];
        band(p, 0, 0.5, 32 * sGrow, SY, 2.2, ringAlpha, rCol, () => true, false);
      }

      // Four hoof scorch imprints
      for (const [hx, hy] of HOOVES) {
        p.ellipse(
          hx,
          hy,
          5.2 * sGrow,
          1.6 * sGrow,
          baseHeat > 0.62 ? C[5] : baseHeat > 0.35 ? C[3] : C[1],
          afterFade * 0.9
        );
      }
    }

    // Radiating cracks seeping fire, then pulsing with the breathing rhythm in afterglow
    for (const c of cracks) {
      if (t < c.t0) continue;
      const nPts = Math.floor(c.pts.length * clamp((t - c.t0) / c.grow));
      const cBreath = t >= T_AFTER ? 0.45 + 0.55 * Math.cos((t - T_AFTER) * 9.5 + c.ph * 0.25) : 1;
      for (let i = 1; i < nPts; i++) {
        const u = i / c.pts.length;
        const localH = baseHeat * (1 - 0.38 * u) * (0.7 + 0.3 * cBreath);
        const [x0, y0] = c.pts[i - 1], [x1, y1] = c.pts[i];
        if (localH < 0.08) {
          p.line(x0, y0, x1, y1, SH, afterFade * 0.75);
          continue;
        }
        const col =
          localH > 0.85 ? C[7] : localH > 0.65 ? C[6] : localH > 0.46 ? C[5] : localH > 0.3 ? C[4] : localH > 0.18 ? C[2] : C[1];
        if (c.main && u < 0.48 && localH > 0.26) {
          p.line(x0, y0 + 1, x1, y1 + 1, SH, afterFade * 0.85);
        }
        p.line(x0, y0, x1, y1, col, afterFade);
        if (i % 3 === 0 && localH > 0.22) {
          p.glow(x1, y1, 5, C[4], 0.18 * localH * afterFade);
        }
      }
    }

    // During Release (0.5 - 0.78s), flame tongues visibly seep upward out of the ground cracks
    if (t >= T_CHARGE + 0.01 && t < T_ERUPT + 0.12) {
      const seepK = Math.sin(Math.PI * seg(t, T_CHARGE + 0.01, T_ERUPT + 0.12));
      const NZ = (rate, s0, off = 0) => loopNoise(t * rate * 0.15 + off * 0.1, 1.4, s0);
      for (const fv of fissureVents) {
        flameTongue(p, fv.x, fv.y, fv.h * seepK, 2.0 * seepK, fv.lean, NZ, fv.s, H, LAYERS);
      }
    }

    // Breathing ember coals in the crater during afterglow
    if (t >= T_SHATTER) {
      for (const cs of coalSpots) {
        if (t >= cs.tEnd) continue;
        const k = (1 - smooth(cs.tEnd - 0.55, cs.tEnd, t)) * afterFade;
        const pulse = 0.45 + 0.55 * Math.cos((t - T_AFTER) * 9.5 + cs.ph);
        const h = k * (0.35 + 0.65 * pulse) * (1 - cs.d * 0.3);
        if (h < 0.12) continue;
        const col = h > 0.68 ? C[6] : h > 0.45 ? C[5] : h > 0.26 ? C[3] : C[2];
        p.dot(cs.x, cs.y, col, Math.min(1, h * 1.45));
        if (h > 0.42) p.light(cs.x, cs.y, C[4], 0.35 * h);
      }
    }

    if (baseHeat > 0.02) {
      floorLight(p, 0, 0.5, 48, 9, C[4], 0.32 * baseHeat * afterFade);
    }
  }

  // Shockwave rings using band(p, cx, cy, r, sy, thick, alpha, ramp, keep)
  function drawBands(p, back) {
    const keep = back ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0;

    // Phase 1 (0 - 0.5s): Teal spirit-qi thin rings contracting inward (visible right from t = 0)
    if (t < T_CHARGE + 0.04) {
      for (let i = 0; i < 2; i++) {
        const t0 = i * 0.12;
        if (t < t0) continue;
        const u = seg(t, t0, T_CHARGE);
        if (u >= 1) continue;
        const r = lerp(70 - i * 16, 6, ease.inQuad(u));
        const th = 1.4 + 1.4 * Math.sin(Math.PI * u);
        const alpha = (i === 0 ? 0.48 + 0.52 * Math.sin(Math.PI * u) : Math.sin(Math.PI * u)) * 0.96;
        band(p, 0, 0.5, r, SY, th, alpha, [S[2], S[4], S[5], S[6]], keep, false);
      }
    }

    // Phase 2 (0.5 - 0.95s): White-hot & golden fire shockwave ring + outer teal spirit ring racing outward
    if (t >= T_CHARGE && t < T_CHARGE + 0.48) {
      const u1 = seg(t, T_CHARGE, T_CHARGE + 0.42);
      if (u1 < 1) {
        const r1 = 8 + (R_MAX - 8) * ease.outQuart(u1);
        const th1 = Math.max(1, 5.2 * (1 - u1));
        const a1 = (1 - smooth(0.55, 1, u1)) * 1.1;
        band(p, 0, 0.5, r1, SY, th1, a1, [C[3], C[5], C[6], C[7]], keep, u1 < 0.14);
      }
      const u2 = seg(t, T_CHARGE + 0.035, T_CHARGE + 0.45);
      if (u2 > 0 && u2 < 1) {
        const r2 = 6 + (R_MAX - 14) * ease.outCubic(u2);
        const th2 = Math.max(1, 3.2 * (1 - u2));
        const a2 = (1 - smooth(0.5, 1, u2)) * 0.95;
        band(p, 0, 0.5, r2, SY, th2, a2, [S[2], S[4], S[5], S[6]], keep, false);
      }
    }
  }

  return {
    update(dt) {
      t += dt;

      // Phase 1 (0 - 0.5s): Charge — teal spirit streaks and vapour gathering inward
      if (t < T_CHARGE) {
        if (R.chance(0.65 * dt * 60)) {
          const a = R.range(0, TAU), d = R.range(28, 66);
          const x = Math.cos(a) * d, y = Math.sin(a) * d * SY - R.range(0, 6);
          const life = R.range(0.14, 0.24), sp = (d * 2.6) / (Math.exp(3 * life) - 1);
          ps.spawn(P.STREAK, x, y, (-x / d) * sp, (-y / d) * sp, life, R.chance(0.5) ? S[6] : S[5]);
        }
        if (R.chance(0.38 * dt * 60)) {
          const a = R.range(0, TAU), d = R.range(18, 48);
          ps.spawn(P.VAPOUR, Math.cos(a) * d, Math.sin(a) * d * SY - 1, -Math.cos(a) * 28, -R.range(4, 14), R.range(0.25, 0.42), S[4], R.range(2, 3.5));
        }
      }

      // Phase 2 (0.5 - 0.7s): Release — Qilin's four hooves land, shockwave & cracks erupt
      if (!released && t >= T_CHARGE) {
        released = true;
        lights.add(0, -28, 52, C[6], 0.75, 0.35);
        lights.add(0, -14, 36, C[7], 0.85, 0.1);
        for (let i = 0; i < 44; i++) {
          const a = -Math.PI / 2 + R.range(-1.35, 1.35), sp = R.range(95, 260);
          ps.spawn(P.SPARK, R.range(-10, 10), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.22, 0.55));
        }
        for (let i = 0; i < 16; i++) {
          const s = i % 2 ? 1 : -1;
          ps.spawn(P.VAPOUR, s * R.range(6, 18), -R.range(1, 4), s * R.range(55, 135), -R.range(4, 18), R.range(0.45, 0.8), S[4], R.range(3.5, 6));
        }
      }

      // Between 0.5s and 0.7s, fire seeps up from the spreading cracks
      if (t >= T_CHARGE && t < T_ERUPT && R.chance(0.95 * dt * 60)) {
        const c = R.pick(cracks);
        const pt = R.pick(c.pts);
        ps.spawn(P.FIRE, pt[0], pt[1] - 1, R.range(-8, 8), -R.range(18, 42), R.range(0.18, 0.32), 0, R.range(1.6, 2.8));
      }

      // Phase 3 (0.7 - 1.6s): Eruption — Golden flame pillar roars up with counter-spiraling teal mane
      if (!erupted && t >= T_ERUPT) {
        erupted = true;
        lights.add(0, -64, 78, C[5], 0.7, 0.85);
        for (let i = 0; i < 36; i++) {
          const a = -Math.PI / 2 + R.range(-0.9, 0.9), sp = R.range(110, 270);
          ps.spawn(P.SPARK, R.range(-6, 6), -2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.3, 0.75));
        }
      }
      if (t >= T_ERUPT && t < T_SHATTER) {
        const h = colHeight(t), w = colWidth(t);
        if (R.chance(0.85 * dt * 60)) {
          const side = R.sign(), y = -R.range(6, h * 0.92);
          ps.spawn(P.FIRE, side * w * R.range(0.7, 1.05), y, side * R.range(12, 34), -R.range(28, 64), R.range(0.24, 0.46), 0, R.range(2.0, 3.6), 0, R.chance(0.35) ? PF.SMOKES : 0);
        }
        if (R.chance(0.65 * dt * 60)) {
          const side = R.sign(), y = -R.range(10, h * 0.9);
          ps.spawn(P.VAPOUR, side * (w + 3), y, side * R.range(14, 36), -R.range(20, 48), R.range(0.32, 0.58), R.pick([S[5], S[4]]), R.range(2.2, 3.8));
        }
        if (R.chance(0.65 * dt * 60)) {
          const isCrown = R.chance(0.5);
          const ey = isCrown ? -h + R.range(0, 14) : -R.range(12, h * 0.88);
          const ex = isCrown ? R.range(-w, w) : R.sign() * (w + R.range(1, 5));
          ps.spawn(P.EMBER, ex, ey, R.range(-45, 45), -R.range(35, 85), R.range(0.55, 1.05), R.pick([C[6], S[6], S[5]]), R.chance(0.28) ? 2 : 1);
        }
      }

      // Phase 4 (1.6 - 2.4s): Shatter — Pillar breaks into gravity-falling sparks and outward-billowing smoke
      if (!shattered && t >= T_SHATTER) {
        shattered = true;
        lights.add(0, -68, 76, C[5], 0.55, 0.55);
        for (let i = 0; i < 68; i++) {
          const y = -R.range(12, H_MAX * 0.96);
          const x = R.range(-14, 14);
          const vx = R.range(-78, 78), vy = R.range(-60, 40);
          ps.spawn(P.SPARK, x, y, vx, vy, R.range(0.45, 0.95));
        }
        for (let i = 0; i < 28; i++) {
          const y = -R.range(8, H_MAX * 0.95);
          const side = R.sign();
          const low = 1 - -y / H_MAX;
          ps.spawn(P.FIRE, side * R.range(0, 12), y, side * R.range(14, 42), -R.range(10, 36), R.range(0.28, 0.52), 0, R.range(3.2, 5.4), 0, PF.SMOKES | PF.BIG);
          ps.spawn(
            P.SMOKE,
            side * R.range(2, 16),
            y,
            side * R.range(24 + 18 * low, 58 + 24 * low),
            -R.range(6, 24),
            R.range(1.0, 1.65),
            mix(SH, C[1], 0.35),
            R.range(5.8, 9.8),
            R.range(0, 0.16),
            PF.BIG
          );
        }
        for (let i = 0; i < 16; i++) {
          const y = -R.range(14, H_MAX * 0.9);
          const side = R.sign();
          ps.spawn(P.VAPOUR, side * R.range(4, 14), y, side * R.range(28, 64), -R.range(6, 24), R.range(0.55, 0.95), S[3], R.range(4.0, 6.8));
        }
      }
      if (t >= T_SHATTER && t < T_AFTER - 0.18) {
        if (R.chance(0.75 * dt * 60)) {
          const y = -R.range(15, H_MAX * 0.85);
          ps.spawn(P.SPARK, R.range(-12, 12), y, R.range(-55, 55), R.range(-15, 55), R.range(0.32, 0.65));
        }
        if (t < T_SHATTER + 0.38 && R.chance(0.5 * dt * 60)) {
          const y = -R.range(15, H_MAX * 0.8);
          ps.spawn(P.FIRE, R.range(-10, 10), y, R.range(-22, 22), -R.range(12, 38), R.range(0.24, 0.42), 0, R.range(3.0, 4.8), 0, PF.SMOKES);
        }
      }

      // Phase 5 (2.4 - 4.5s): Afterglow — Breathing scorch & cracks release lazy embers and thin smoke wisps
      if (t >= T_AFTER && t < 3.65) {
        if (R.chance(0.28 * dt * 60)) {
          const cs = R.pick(coalSpots);
          ps.spawn(P.EMBER, cs.x, cs.y - 1, R.range(-10, 10), -R.range(14, 34), R.range(0.45, 0.75), C[4], 1);
        }
        if (R.chance(0.18 * dt * 60)) {
          const cs = R.pick(coalSpots);
          ps.spawn(P.SMOKE, cs.x, cs.y - 1, R.range(-6, 6), -R.range(10, 22), R.range(0.55, 0.85), SH, R.range(2.2, 3.6));
        }
      }

      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      if (t >= T_END - 1e-6) return;
      if (t < T_CHARGE) {
        const ck = 0.25 + 0.75 * smooth(0, T_CHARGE, t);
        floorLight(p, 0, 0.5, 42 * (1.2 - 0.4 * ck), 8, S[4], 0.3 * ck);
        for (const [hx, hy] of HOOVES) {
          p.ellipse(hx, hy, 5.0 * ck, 1.6 * ck, S[5], 0.75 * ck);
          p.glow(hx, hy, 9, S[5], 0.28 * ck);
        }
      }
      drawScorchAndCracks(p);
      drawBands(p, true);
      simDraw(p, ps, H, "back");
      drawMane(p, true);
    },
    draw(p) {
      if (t >= T_END - 1e-6) return;
      drawColumn(p);
      drawMane(p, false);
      simDraw(p, ps, H, "front");
      drawBands(p, false);

      // Phase 2 Release (0.5 - 0.567s): 1-2 frame white-hot hero frame at t = 0.5s
      const rq = t - T_CHARGE;
      if (rq >= 0 && rq < 0.066) {
        const hk = rq < 0.033 ? 1 : 0.76;
        p.ellipse(0, -2, 26 * hk, 6.5 * hk, C[6]);
        p.ellipse(0, -2.5, 18 * hk, 4.5 * hk, C[7]);
        for (const [hx, hy] of HOOVES) {
          sparkle(p, hx, hy - 1, 8 * hk, C[7], S[6], 0.65);
        }
        sparkle(p, 0, -4, 14 * hk, C[7], C[5], 0.8);
        p.glow(0, -14, 38, C[7], 0.65 * hk);
      }
      // Eruption flash when the pillar shoots up at t = 0.7s
      const eq = t - T_ERUPT;
      if (eq >= 0 && eq < 0.066) {
        const ek = eq < 0.033 ? 1 : 0.72;
        p.ellipse(0, -3, 18 * ek, 5.5 * ek, C[6]);
        p.ellipse(0, -4, 12 * ek, 3.8 * ek, C[7]);
        p.glow(0, -18, 40, C[7], 0.55 * ek);
      }

      lights.draw(p);
    },
  };
}
