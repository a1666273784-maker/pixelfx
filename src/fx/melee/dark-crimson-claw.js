// Colossal beast-crescent / flame-wave techniques adapted from Sprite Fusion's open-source slash,
// impact and fire VFX (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, B, Rng, fit, flare, sparkle, clamp, smooth, lerp, ease, loopNoise, TAU, WHITE } from "../../core/index.js";
import { cracks, star, sliver, along, rock, stone } from "./_lib.js";
import { hotFirst, flameTongue, floorLight, simDraw } from "../fire/_lib.js";

const T0 = 0.08; // colossal claw starts raking down from overhead
const SWEEP_D = 0.3;
const T_HIT = T0 + SWEEP_D; // 0.38 — the rend lands
const T_GONE = T_HIT + 0.34; // claw body fully eaten away
const T_END = 2.26;

export const meta = {
  name: "Dark crimson claw",
  desc: "A colossal three-talon dark-crimson energy claw rakes down from overhead trailing phantoms; the hit ruptures crimson shards; three parallel molten scars smolder out.",
  tags: ["melee", "claw", "dark", "crimson", "demon", "rend", "slash", "boss", "ultimate", "directional", "one-shot"],
  size: [368, 236],
  origin: [152, 176],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#090205", "#24040c", "#4d0716", "#820d22", "#bd1930", "#eb3648", "#ff7d88", "#ffe6ea"],
    stone: "#3a2c36",
    seed: 7,
  },
};

// ============================================================================
// COLOSSAL SWING GEOMETRY: a R=124 overhead arc raking down-across to the floor.
// Three MASSIVE parallel talon bands (18/16/14 px thick) ride the same arc at
// radial offsets 0/26/52 — a beast-claw crescent, never thin geometric lines.
// ============================================================================
const CX = 20, CY = -52, RAD = 124, SY = 0.92, A0 = -1.62, SPAN = 2.17;
const OFF = [0, 26, 52], WB = [18, 16, 14];
const R_MIN = RAD - 72;
const pt = (r, u) => {
  const a = A0 + u;
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r * SY];
};

// Pre-filter the annular sector once: per-pixel (x, y, u, dr) — zero trig per frame
const SECTOR = (() => {
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (let s = 0; s <= 12; s++) {
    const u = (SPAN * s) / 12;
    for (const r of [R_MIN - 2, RAD + 3]) {
      const [x, y] = pt(r, u);
      bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x);
      by0 = Math.min(by0, y); by1 = Math.max(by1, y);
    }
  }
  const xs = [], ys = [], us = [], drs = [];
  for (let py = Math.floor(by0); py <= Math.ceil(by1); py++) {
    for (let px = Math.floor(bx0); px <= Math.ceil(bx1); px++) {
      const dx = px + 0.5 - CX, dy = (py + 0.5 - CY) / SY;
      const r = Math.hypot(dx, dy);
      if (r < R_MIN - 1 || r > RAD + 2) continue;
      let u = Math.atan2(dy, dx) - A0;
      if (u < -0.4) u += TAU;
      if (u < -0.02 || u > SPAN + 0.02) continue;
      xs.push(px); ys.push(py); us.push(u); drs.push(RAD - r);
    }
  }
  return { n: xs.length, xs: Int16Array.from(xs), ys: Int16Array.from(ys), us: Float32Array.from(us), drs: Float32Array.from(drs) };
})();

const SHAPE_LUT = Float32Array.from({ length: 129 }, (_, i) => {
  const v = i / 128;
  return Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(v, 1.7))), 0.55);
});
const ENV_LUT = Float32Array.from({ length: 129 }, (_, i) => {
  const v = i / 128;
  return Math.pow(Math.max(0, Math.sin(Math.PI * v)), 0.5);
});

// Prebake scalloped threshold-erodible molten blast-puff LUTs (chunky pixel clusters)
const BLAST_LUTS = Array.from({ length: 18 }, (_, r) => {
  if (r < 1) return [];
  const pts = [];
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const ang = Math.atan2(dy, dx);
      const scallop = 1 + 0.16 * Math.sin(ang * 5 + r * 1.1) + 0.1 * Math.cos(ang * 8 - r * 0.7);
      const q = Math.hypot(dx, dy) / (r * scallop);
      if (q > 1) continue;
      pts.push(dx, dy, q, (-dx * 0.45 + dy * 0.45) / Math.max(1, r) + (1 - q) * 0.58);
    }
  }
  return pts;
});

// Perspective ground shockwave ring that modulates organically and breaks into fiery arcs
function drawFloorBand(p, cx, cy, r, sy, th, progress, alpha, ramp, back, hot, xMin, xMax) {
  if (alpha <= 0.03 || r <= 1 || th <= 0.2) return;
  const rx = r + th + 2, ry = (r + th) * sy + th * 0.6 + 1;
  const x0 = Math.max(xMin, Math.floor(cx - rx - 1)), x1 = Math.min(xMax, Math.ceil(cx + rx + 1));
  const y0 = back ? Math.max(-172, Math.floor(cy - ry - 1)) : Math.floor(cy);
  const y1 = back ? Math.floor(cy) : Math.min(30, Math.ceil(cy + ry + 1));
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
      if (progress > 0.32 && wave < (progress - 0.32) * 1.45 + 0.32) continue;
      const locTh = Math.max(0.75, th * wave);
      const grad = Math.hypot(nx * invR, ny * invRsy);
      const dist = (1 - e) / Math.max(1e-4, grad);
      if (dist < -0.5 || dist > locTh) continue;
      const u = clamp(dist / locTh);
      p.dot(x, y, ramp[u < 0.26 ? 3 : u < 0.56 ? 2 : u < 0.82 ? 1 : 0], alpha * (u < 0.45 ? 1.15 : 1.05 - u * 0.8));
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8), H = hotFirst(C), st = stone(o.stone);
  const R = new Rng(o.seed), seed = o.seed * 31, floor = () => 0;
  const X_MIN = -146, X_MAX = 210, Y_MIN = -170, Y_MAX = 54;

  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], WHITE], haze: C[3] });
  const bits = new Bits({ ground: floor }), lights = new Lights();

  // Impact point: outer talon tip where the rend slams into the floor line
  const [EX, EY] = pt(RAD - 8, SPAN * 0.965);
  const [SXp, SYp] = pt(RAD - 10, 0.03); // condensation nucleus high overhead

  const hitSpikes = Array.from({ length: 14 }, (_, i) => {
    const base = (i / 14) * TAU + R.range(-0.06, 0.06);
    const diag = Math.abs(Math.cos(base + 0.62)), horiz = Math.abs(Math.cos(base));
    const mul = diag > 0.92 ? 1.92 : horiz > 0.88 ? 1.5 : i % 2 === 0 ? 1.06 : 0.68;
    return { a: base, len: R.range(26, 40) * mul, w: R.range(2.0, 3.2) };
  });
  const hitSlivers = Array.from({ length: 8 }, (_, i) => ({
    a: -1.45 + (i / 7) * 2.35 + R.range(-0.06, 0.06),
    r: 16 + R.range(0, 8),
    v: R.range(175, 275),
    arc: R.range(0.28, 0.48),
  }));
  const blastClouds = Array.from({ length: 24 }, (_, i) => {
    const u = i / 23;
    const fan = (i % 2 === 0 ? -1 : 1) * (9 + u * 22) + R.range(-6, 10);
    return {
      x0: EX - 6 + u * 26 + fan * 0.4,
      y0: -5 - u * 92 + R.range(-5, 5),
      vx: 20 + u * 30 + fan * 1.4,
      vy: -lerp(22, 84, u) + R.range(-9, 9),
      r0: lerp(11.5, 7.5, u),
      r1: lerp(16.5, 13.5, u),
      t0: T_HIT + u * 0.05 + R.range(0, 0.03),
      life: R.range(0.5, 0.86),
    };
  });
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      blastClouds.push({
        x0: EX - 4 + sd * (8 + i * 7), y0: -4 - R.range(0, 3),
        vx: sd * lerp(44, 110, i / 3), vy: -R.range(4, 14),
        r0: 7, r1: 12, t0: T_HIT + i * 0.02, life: R.range(0.45, 0.76),
      });
    }
  }
  const hitCracks = cracks(R, EX, 9, 74, 7, 0.4);

  // 1D molten-coal noise tables along u for the 3 parallel scars
  const N_LUT = 150;
  const noiseLut = [0, 1, 2].map((b) =>
    Array.from({ length: N_LUT + 1 }, (_, i) => ({
      n: clamp(0.5 + 0.32 * Math.sin(i * 0.09 + b * 2.0) + 0.22 * Math.sin(i * 0.23 + b * 0.7) + (R.next() - 0.5) * 0.3, 0, 1),
      ph: R.range(0, TAU),
    }))
  );

  let t = 0, hitDone = false, condDone = false, dripDone = false;

  const clampParticles = (list, maxT) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const q = list[i];
      if (q.life === q.max && t + q.life > maxT) q.life = q.max = Math.max(0.02, maxT - t);
    }
  };

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
        if (lut[k + 2] > cut) continue;
        const heat = lut[k + 3] - cool;
        const ci = heat > 0.72 ? 7 : heat > 0.48 ? 6 : heat > 0.25 ? 5 : heat > 0.04 ? 4 : heat > -0.18 ? 3 : heat > -0.42 ? 2 : heat > -0.68 ? 1 : 0;
        const px = cx + lut[k], py = cy + lut[k + 1];
        if (py > 2 || py < Y_MIN || px < X_MIN || px > X_MAX) continue;
        p.dot(px, py, C[ci], u > 0.75 ? (1 - u) * 4 : 1);
      }
    }
  }

  // Void rupture column: a towering dark-crimson rift of energy blasting up out of the wound
  function drawRupture(p, q) {
    const gk = q < 0.08 ? ease.outQuart(q / 0.08) : 1 - smooth(0.2, 0.62, q);
    if (gk <= 0.05) return;
    const fullH = Math.min(150, 148 * gk);
    const baseW = 15 * gk;
    const invH = 1 / Math.max(1, fullH);
    for (let y = 1; y >= -fullH; y--) {
      const v = clamp(-y * invH, 0, 1);
      const cx = EX + 2 + 20 * Math.pow(v, 1.12) + Math.sin(v * 8.5 - t * 22) * (2.2 + 4.2 * v);
      const hw = Math.max(0.5, baseW * Math.pow(1 - v, 0.62) * (1 + 0.4 * (y > -14 ? (1 + y / 14) ** 2 : 0)) + 2.6 * gk * Math.sin(v * 13 - t * 9));
      const xL = Math.max(X_MIN, Math.floor(cx - hw)), xR = Math.min(X_MAX, Math.ceil(cx + hw));
      for (let x = xL; x <= xR; x++) {
        const qx = Math.abs(x - cx) / hw;
        if (qx > 1) continue;
        const swirl = 0.5 + 0.5 * Math.sin((x - cx) * 0.3 + v * 11 - t * 24);
        // VOID heart with blazing crimson rim (inverse of a fire column — oppressive dark energy)
        let ci;
        if (qx < 0.3) ci = v < 0.5 && q < 0.12 ? 7 : swirl > 0.5 ? 1 : 0;
        else if (qx < 0.62) ci = swirl > 0.6 ? 4 : 2;
        else ci = v < 0.6 ? 5 : 4;
        p.dot(x, y, qx < 0.14 && q < 0.1 && v < 0.4 ? WHITE : C[ci]);
      }
    }
    if (q < 0.07) {
      const ek = 1 - q / 0.07;
      p.ellipse(EX + 2, -1, (baseW + 9) * ek, 4 * ek, C[6]);
      p.ellipse(EX + 2, -1.5, (baseW + 4) * ek, 2.5 * ek, WHITE);
    }
    const NZ = (rate, s0, off = 0) => loopNoise(t * rate * 0.16 + off * 0.1, 1.4, s0);
    if (gk > 0.3) {
      flameTongue(p, EX - 10, 1, 62 * gk, 7.5 * gk, -9 * gk, NZ, seed + 131, H);
      flameTongue(p, EX + 12, -4, 54 * gk, 6.5 * gk, 8 * gk, NZ, seed + 179, H);
    }
  }

  return {
    update(dt) {
      t += dt;
      if (!condDone && t >= 0.02) {
        condDone = true;
        lights.add(SXp, SYp, 46, C[4], 0.5, 0.16);
      }
      if (t < T0 + 0.02 && R.chance(0.75 * dt * 60)) {
        const a = R.range(0, TAU), d = R.range(22, 46);
        ps.spawn(P.STREAK, SXp + Math.cos(a) * d, SYp + Math.sin(a) * d, -Math.cos(a) * 260, -Math.sin(a) * 260, R.range(0.05, 0.08), R.chance(0.5) ? C[6] : C[5], 1);
      }
      if (t > T0 && t < T_HIT && R.chance(0.5 * dt * 60)) {
        const u = SPAN * Math.pow(clamp((t - T0) / SWEEP_D, 0, 1), 1.55) * R.range(0.5, 0.95);
        const [sx2, sy2] = pt(RAD - R.range(0, 60), u);
        ps.spawn(P.SMOKE, sx2, sy2, R.range(-14, 14), -R.range(6, 20), R.range(0.4, 0.75), R.chance(0.5) ? C[1] : C[2], R.chance(0.4) ? 2 : 1);
      }
      if (!hitDone && t >= T_HIT) {
        hitDone = true;
        lights.add(EX, -30, 122, C[5], 0.88, 0.5);
        lights.add(EX, -6, 46, WHITE, 0.92, 0.13);
        for (let i = 0; i < 46; i++) {
          const fwd = R.chance(0.74);
          const a = (fwd ? -0.5 : -Math.PI + 0.45) + R.range(-0.85, 0.85);
          const sp = R.range(155, 385) * (fwd ? 1 : 0.65);
          ps.spawn(P.SPARK, EX + R.range(-8, 12), -R.range(2, 56), Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.52));
        }
        for (let i = 0; i < 26; i++) {
          ps.spawn(P.EMBER, EX + R.range(-14, 26), -R.range(4, 96), R.range(-45, 105), -R.range(40, 125), R.range(0.55, 1.1), R.pick([C[7], C[6], C[4]]), R.chance(0.42) ? 2 : 1);
        }
        for (let i = 0; i < 14; i++) {
          const s = R.sign();
          bits.add({ kind: B.CHUNK, x: EX + s * R.range(0, 14), y: -2, vx: s * R.range(40, 140), vy: -R.range(135, 295), g: 1, drag: 0.4, bounce: 0.36, life: R.range(0.64, 0.9), a: R.range(0, TAU), va: R.range(-14, 14), s: R.pick([1, 2, 2, 3]) });
        }
        for (let i = 0; i < 22; i++) {
          const a = -Math.PI / 2 + R.range(-1.15, 1.15), sp = R.range(120, 330);
          bits.add({ kind: B.SHARD, x: EX + R.range(-8, 10), y: -R.range(2, 40), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1, drag: 0.32, bounce: 0.3, life: R.range(0.5, 0.85), a: R.range(0, TAU), va: R.range(-18, 18), s: R.pick([1, 1, 2]) });
        }
      }
      if (!dripDone && t >= T_HIT + 0.05) {
        dripDone = true;
        for (let i = 0; i < 26; i++) {
          const b = i % 3, u = SPAN * R.range(0.12, 0.9);
          const [dx2, dy2] = pt(RAD - OFF[b] - WB[b] * 0.42, u);
          ps.spawn(P.EMBER, dx2, dy2, R.range(-8, 8), R.range(26, 82), R.range(0.45, 0.95), R.chance(0.5) ? C[5] : C[4], 1, 0.06);
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
      clampParticles(ps.list, T_END - 0.06);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-6) return;
      const RING = [C[2], C[4], C[6], C[7]];
      const q = t - T_HIT;
      if (q >= 0 && q < 0.5) {
        const rk = q / 0.5;
        drawFloorBand(p, EX, 0.5, 14 + 112 * ease.outQuart(rk), 0.17, Math.max(1, 4.8 * (1 - rk)), rk, 1 - smooth(0.55, 1, rk), RING, true, rk < 0.16, X_MIN, X_MAX);
      }
      simDraw(p, ps, H, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;
      const RING = [C[2], C[4], C[6], C[7]];

      // ---- 0) Condensation nucleus: dark-crimson energy gathers high overhead
      if (t < 0.14) {
        const ck = Math.sin(clamp(t / 0.12, 0, 1) * Math.PI);
        sparkle(p, SXp, SYp, 14 * ck, C[7], C[5], 0.85);
        p.glow(SXp, SYp, 34, C[4], 0.5 * ck);
      }

      // ---- 1) THREE PARALLEL MOLTEN SCARS (drawn under the claw body)
      const tailK = smooth(T_HIT + 0.02, T_HIT + 0.3, t);
      const head = Math.pow(clamp((t - T0) / SWEEP_D, 0, 1), 1.55);
      const U = SPAN * head;
      if (t > T0 + 0.06) {
        const cool = smooth(T_HIT + 0.1, 2.02, t);
        const fadeTail = 1 - smooth(1.92, 2.2, t);
        const u1 = Math.min(SPAN * 0.985, U) - SPAN * 0.1 * smooth(1.35, 2.08, t);
        const u0 = SPAN * 0.07 + SPAN * 0.24 * smooth(1.15, 1.98, t);
        if (fadeTail > 0.02 && u1 - u0 > 0.03) {
          const invSc = 1 / (u1 - u0);
          const curN = [new Float32Array(N_LUT + 1), new Float32Array(N_LUT + 1), new Float32Array(N_LUT + 1)];
          for (let b = 0; b < 3; b++) {
            const row = noiseLut[b], dst = curN[b];
            for (let j = 0; j <= N_LUT; j++) dst[j] = clamp(row[j].n + 0.12 * Math.sin(t * 5.2 + row[j].ph), 0, 1);
          }
          const { n, xs, ys, us, drs } = SECTOR;
          for (let i = 0; i < n; i++) {
            const uu = us[i];
            if (uu < u0 || uu > u1) continue;
            const v = clamp((uu - u0) * invSc, 0.004, 0.996);
            const env = ENV_LUT[(v * 128) | 0];
            if (env < 0.05) continue;
            const dr = drs[i];
            for (let b = 0; b < 3; b++) {
              const d = Math.abs(dr - (OFF[b] + WB[b] * 0.42));
              const nVal = curN[b][clamp(Math.round((uu / SPAN) * N_LUT), 0, N_LUT)];
              const ws = (7.8 - 3.4 * cool) * env * (0.78 + 0.42 * nVal);
              if (d > ws) continue;
              if (cool > 0.34 && nVal < (cool - 0.34) * 1.5) continue;
              const q = d / ws;
              let col;
              if (cool < 0.2) col = q < 0.3 ? C[0] : q < 0.58 ? C[7] : q < 0.82 ? C[5] : C[3];
              else if (cool < 0.52) col = q < 0.26 ? C[0] : q < 0.62 ? C[5] : q < 0.85 ? C[4] : C[2];
              else if (cool < 0.8) col = q < 0.45 ? C[4] : C[2];
              else col = nVal > 0.72 ? C[3] : C[1];
              if (fadeTail > 0.92) p.px(xs[i], ys[i], col);
              else p.blend(xs[i], ys[i], col, fadeTail);
              break;
            }
          }
          if (cool < 0.86) {
            for (let b = 0; b < 3; b++) {
              const rr = RAD - OFF[b] - WB[b] * 0.42;
              for (let s2 = 1; s2 <= 11; s2++) {
                const [gx, gy] = pt(rr, lerp(u0, u1, s2 / 12));
                if (gy > Y_MIN + 14 && gy < -2) p.glow(gx, gy, 12 - 5 * cool, C[4], 0.3 * (1 - cool) * fadeTail);
              }
            }
          }
        }
      }

      // ---- 2) THE COLOSSAL THREE-TALON DARK-CRIMSON CLAW (massive crescent bands)
      const fadeOut = 1 - smooth(T_HIT + 0.16, T_GONE, t);
      if (fadeOut > 0.02 && U - SPAN * 0.46 * tailK > 0.02 && t >= T0 - 0.02) {
        const T = SPAN * 0.46 * tailK;
        const invSpan = 1 / (U - T);
        const hot = t >= T_HIT && t < T_HIT + 0.05 ? 1 : 0;
        const ignite = smooth(T0 - 0.02, T0 + 0.09, t);
        const { n, xs, ys, us, drs } = SECTOR;
        const ghostOn = t > T0 + 0.07 && t < T_HIT + 0.16;
        const gU = [0, 0];
        if (ghostOn) {
          gU[0] = SPAN * Math.pow(clamp((t - 0.055 - T0) / SWEEP_D, 0, 1), 1.55);
          gU[1] = SPAN * Math.pow(clamp((t - 0.11 - T0) / SWEEP_D, 0, 1), 1.55);
        }
        for (let i = 0; i < n; i++) {
          const uu = us[i];
          const v = (uu - T) * invSpan;
          const dr = drs[i];
          if (v > 0.004 && v < 0.996) {
            const sh = SHAPE_LUT[(v * 128) | 0];
            // Dark demonic fist mass welding the three talon tails into one colossal claw body
            const fistW = 66 * (1 - smooth(0.05, 0.27, v)) * smooth(0.004, 0.07, v);
            if (fistW > 1.2 && dr < fistW) {
              const q2 = dr / fistW;
              const col = q2 > 0.88 ? C[4] : q2 > 0.5 ? C[2] : C[1];
              if (fadeOut > 0.95 && ignite > 0.95) p.px(xs[i], ys[i], col);
              else p.blend(xs[i], ys[i], col, fadeOut * ignite);
              continue;
            }
            if (sh > 0.02) {
              let drew = false;
              for (let b = 0; b < 3; b++) {
                const w = WB[b] * sh;
                const d = dr - OFF[b];
                if (d < 0 || d > w) continue;
                const q = d / w;
                let col;
                if (hot) col = q < 0.3 ? WHITE : q < 0.62 ? C[7] : q < 0.85 ? C[6] : C[5];
                else {
                  let ci = q < 0.13 ? 7 : q < 0.32 ? 6 : q < 0.6 ? 5 : q < 0.84 ? 4 : 3;
                  if (v < 0.22) ci = Math.max(1, ci - 2);
                  else if (v < 0.4) ci = Math.max(1, ci - 1);
                  col = C[ci];
                }
                if (fadeOut > 0.95 && ignite > 0.95) p.px(xs[i], ys[i], col);
                else p.blend(xs[i], ys[i], col, fadeOut * ignite);
                drew = true;
                break;
              }
              if (drew) continue;
            }
          }
          // Dark-crimson phantom afterimages trailing behind the live talons (爪尖残影)
          if (ghostOn) {
            for (let g = 0; g < 2; g++) {
              const ug = gU[g];
              if (uu > ug - 0.02 || uu < 0.03) continue;
              const vg = uu / ug;
              if (vg <= 0.004 || vg >= 0.996) continue;
              const shg = SHAPE_LUT[(vg * 128) | 0];
              if (shg < 0.03) continue;
              let hitG = false;
              for (let b = 0; b < 3; b++) {
                const w = WB[b] * shg * 0.9;
                const d = dr - OFF[b];
                if (d < 0 || d > w) continue;
                p.blend(xs[i], ys[i], g === 0 ? C[5] : C[3], (g === 0 ? 0.6 : 0.32) * fadeOut);
                hitG = true;
                break;
              }
              if (hitG) break;
            }
          }
        }
        // Blazing talon-tip glows riding the sweep head
        for (let b = 0; b < 3; b++) {
          const [hx, hy] = pt(RAD - OFF[b] - WB[b] * 0.45, Math.max(0.02, U - 0.03));
          if (hy > Y_MIN + 12 && hy < Y_MAX - 8) p.glow(hx, hy, 10 + 5 * (1 - head), C[5], 0.55 * fadeOut * (hot ? 1.5 : 1));
        }
      }

      // ---- 3) HIT RESULT: starburst, shock dome, floor ring, cracks, blast plume, void rupture
      const q = t - T_HIT;
      if (q >= 0) {
        const scarFade = 1 - smooth(1.86, 2.2, t);
        const crackHeat = Math.pow(clamp(1 - q / 1.1), 1.2);
        if (scarFade > 0.03) {
          for (const c of hitCracks) {
            const reach = 74 * ease.outCubic(clamp((q - c.at * 0.06) / 0.1)) * (c.fork ? 0.42 : 1);
            if (reach > 0) {
              along(c.pts, reach, (x0, y0, x1, y1, d) => {
                if (y0 + 1 > Y_MAX - 2 || y1 + 1 > Y_MAX - 2 || x1 > X_MAX - 2) return;
                const lh = crackHeat * (1 - d / 82);
                p.line(x0, y0 + 1, x1, y1 + 1, lh > 0.7 ? WHITE : lh > 0.48 ? C[7] : lh > 0.28 ? C[5] : lh > 0.12 ? C[3] : C[0], scarFade);
              });
            }
          }
          for (let dx = -26; dx <= 26; dx++) {
            const u2 = dx / 26, d = Math.round(3.5 * (1 - u2 * u2));
            for (let dy = 0; dy < d; dy++) p.blend(EX + dx, dy, C[0], 0.7 * scarFade);
            if (d > 0) p.dot(EX + dx, d, crackHeat > 0.4 ? C[5] : C[2], scarFade);
          }
          floorLight(p, EX + 6, 0.5, 60, 8, C[4], 0.3 * scarFade * clamp(1.2 - q * 0.7));
        }
        const dk = (q - 0.01) / 0.15;
        if (dk >= 0 && dk < 1) {
          const dr = 18 + 58 * ease.outQuart(dk), dth = Math.max(2, 5.8 * (1 - dk));
          p.shade(Math.max(X_MIN, EX - dr - 2), -dr - 2, Math.min(X_MAX - 2, EX + dr + 2), 0, (x, y, out) => {
            const e = dr - Math.hypot(x - EX, y);
            if (e < 0 || e > dth || y > -0.5) return;
            const ang = Math.atan2(y, x - EX);
            if (Math.sin(ang * 3.5 + 0.4) < -0.25 + dk * 0.55) return;
            out.c = e < dth * 0.38 ? WHITE : e < dth * 0.72 ? C[7] : C[5];
            out.a = 1;
          });
        }
        if (q < 0.5) {
          const rk = q / 0.5;
          drawFloorBand(p, EX, 0.5, 14 + 112 * ease.outQuart(rk), 0.17, Math.max(1, 4.8 * (1 - rk)), rk, 1 - smooth(0.55, 1, rk), RING, false, rk < 0.16, X_MIN, X_MAX);
        }
        drawBlastClouds(p);
        if (q < 0.62) drawRupture(p, q);
        if (q >= 0.02 && q < 0.22) {
          const sk = (q - 0.02) / 0.2;
          for (const sl of hitSlivers) sliver(p, EX + 4, -34, sl.a, sl.r + sl.v * (q - 0.02), sl.arc * (1 - 0.4 * sk), sk < 0.4 ? C[7] : sk < 0.75 ? C[5] : C[3], 1 - sk);
        }
        if (q < 0.068) {
          const hot2 = q < 0.034, hk = 1 - q / 0.068;
          p.beam(EX - 44 * hk, -1, Math.min(X_MAX - 4, EX + 56 * hk), -1, hot2 ? 4.4 : 2.6, WHITE);
          star(p, EX + 2, -34, hitSpikes, hot2 ? 1 : 1.28, hot2 ? 1 : 0.58, WHITE, C[6], C[7], C[4]);
          flare(p, EX + 2, -34, 62 * hk, hk, [C[3], C[5], C[7], WHITE]);
          flare(p, EX + 2, -4, 38 * hk, hk * 0.9, [C[4], C[6], WHITE]);
        }
      }

      for (const b of bits.list) rock(p, b, st);
      simDraw(p, ps, H, "front");
      lights.draw(p);
    },
  };
}
