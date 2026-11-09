// Ground-crack, floor-ring, column and collapse recipes adapted from Sprite Fusion's open-source explosion and
// holy-light VFX (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, PF, B, Rng, fit, flare, band, clamp, smooth, ease, noise, rand, TAU, WHITE } from "../../core/index.js";
import { hotFirst, flameTongue, simDraw, floorLight, LAYERS } from "./_lib.js";
import { star, rock, stone } from "../melee/_lib.js";
import { glyph } from "../arcane/_lib.js";
import { unlight } from "../shadow/_lib.js";

const T_RING = 0.42; // omen ring fully seared into the ground
const T_ERUPT = 0.55; // first pillar bursts
const T_END = 2.6;

export const meta = {
  name: "Dark crimson eruption",
  desc: "A dark-crimson omen ring sears the ground, six staggered pillars of black-rooted crimson fire burst from it, then collapse into falling embers over a cooling scorched ring.",
  tags: ["fire", "eruption", "ground", "pillars", "dark", "crimson", "demon", "omen", "aoe", "one-shot"],
  size: [320, 216],
  origin: [160, 160],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#090205", "#24040c", "#4d0716", "#820d22", "#bd1930", "#eb3648", "#ff7d88", "#ffe6ea"],
    stone: "#3a2c36",
    seed: 11,
  },
};

const RSY = 0.3; // ground perspective squash
const RING_R = 96;

// Static per-pixel mask of the omen ring band at full radius (self-similar while growing):
// exact normal distance + angular wave are radius-independent => zero trig per frame.
const RING_MASK = (() => {
  const xs = [], ys = [], ds = [], ws = [], as = [], half = [];
  const th = 7.5, rx = RING_R + th + 2, ry = (RING_R + th) * RSY + th * 0.6 + 1;
  const invR = 1 / RING_R, invRsy = 1 / (RING_R * RSY);
  for (let y = Math.floor(-ry - 1); y <= Math.ceil(ry + 1); y++) {
    const ny = (y + 0.5) * invRsy;
    if (ny * ny > 1.75) continue;
    for (let x = Math.floor(-rx - 1); x <= Math.ceil(rx + 1); x++) {
      const nx = (x + 0.5) * invR;
      const e = Math.hypot(nx, ny);
      if (e < 0.25) continue;
      const ang = Math.atan2(ny, nx);
      const wave = 0.85 + 0.18 * Math.sin(ang * 6 + 0.9) + 0.1 * Math.cos(ang * 10 - 0.6);
      const grad = Math.hypot(nx * invR, ny * invRsy);
      const dist = Math.abs(e - 1) / Math.max(1e-4, grad);
      if (dist > 10.5 * wave) continue;
      xs.push(x); ys.push(y); ds.push(dist); ws.push(wave); as.push(ang); half.push(y < 0 ? 1 : 0);
    }
  }
  const pick = (want) => {
    const xi = [], yi = [], di = [], wi = [], ai = [];
    for (let i = 0; i < xs.length; i++)
      if (half[i] === want) { xi.push(xs[i]); yi.push(ys[i]); di.push(ds[i]); wi.push(ws[i]); ai.push(as[i]); }
    return { n: xi.length, xs: Int16Array.from(xi), ys: Int16Array.from(yi), ds: Float32Array.from(di), ws: Float32Array.from(wi), as: Float32Array.from(ai) };
  };
  return [pick(1), pick(0)]; // [back, front]
})();

export function create(o) {
  const C = fit(o.palette, 8), H = hotFirst(C), st = stone(o.stone);
  const R = new Rng(o.seed), S = o.seed * 13, floor = () => 0;
  const X_MIN = -154, X_MAX = 154, Y_MIN = -156, Y_MAX = 52;

  const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[6]], haze: C[3] });
  const bits = new Bits({ ground: floor }), lights = new Lights();

  // Six staggered eruption vents placed round the omen ring (back vents first for painter order)
  const pillars = [
    { a: -2.62, rr: 74, Hh: 96, w: 9.5, t0: 0.73 },
    { a: -1.72, rr: 82, Hh: 112, w: 11, t0: 0.61 },
    { a: -0.88, rr: 70, Hh: 88, w: 8.5, t0: 0.85 },
    { a: -0.12, rr: 86, Hh: 116, w: 12, t0: 0.55 },
    { a: 0.72, rr: 76, Hh: 100, w: 10, t0: 0.67 },
    { a: 1.62, rr: 84, Hh: 108, w: 10.5, t0: 0.79 },
  ]
    .map((q, i) => ({
      ...q,
      i,
      x: Math.round(Math.cos(q.a) * q.rr),
      y: Math.round(Math.sin(q.a) * q.rr * RSY),
      tBreak: q.t0 + 0.66 + (i % 3) * 0.04,
      seed: S + i * 17,
      back: Math.sin(q.a) < -0.12,
    }))
    .sort((p, q) => p.y - q.y);
  const MAIN = 3; // the tallest vent carries the hero hit-result burst

  // Radial jagged ground cracks racing out from the ring centre (perspective-squashed)
  const cracks = [];
  const crack = (x, y, a, len, t0) => {
    const pts = [[x, y]];
    for (let d = 0; d < len; d += 2) {
      a += R.range(-0.5, 0.5);
      x += Math.cos(a) * 2;
      y += Math.sin(a) * 0.52;
      pts.push([x, y]);
    }
    cracks.push({ pts, t0, grow: R.range(0.2, 0.3) });
  };
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + R.range(-0.2, 0.2);
    crack(R.range(-2, 2), R.range(-1, 1), a, R.range(26, 52), R.range(0.06, 0.3));
  }

  const runes = Array.from({ length: 10 }, (_, k) => ({ g: (k + 0.5) * (TAU / 10), gi: (k * 3 + 2) % 8 }));
  const strands = Array.from({ length: 2 }, (_, i) => ({ o: (rand(i, S, 1) - 0.5) * 1.2, w: 0.07 + rand(i, S, 2) * 0.06, f: 1 + rand(i, S, 3) * 2 }));

  const hitSpikes = Array.from({ length: 12 }, (_, i) => {
    const base = (i / 12) * TAU + R.range(-0.08, 0.08);
    const mul = Math.abs(Math.cos(base + 0.6)) > 0.92 ? 1.8 : Math.abs(Math.cos(base)) > 0.88 ? 1.45 : i % 2 === 0 ? 1.05 : 0.66;
    return { a: base, len: R.range(20, 32) * mul, w: R.range(1.8, 2.8) };
  });

  let t = 0;
  const done = new Set();

  const pillarState = (pl) => {
    const u = t - pl.t0;
    if (u < 0) return null;
    const bk = clamp((t - pl.tBreak) / 0.36, 0, 1);
    const grow = ease.outQuart(clamp(u / 0.1));
    const h = pl.Hh * grow * (1 - ease.inQuad(bk) * 0.92) * (1 + 0.04 * noise(t * 3, pl.seed));
    const w = pl.w * (1 + 0.45 * Math.exp(-u * 7)) * (1 - bk * 0.72) * (0.94 + 0.06 * noise(t * 9, pl.seed + 1));
    return { u, bk, h, w };
  };

  function drawPillar(p, pl) {
    const s = pillarState(pl);
    if (!s || s.h < 2 || s.w < 0.5) return;
    const { u, bk, h, w } = s;
    // blackened vent mouth the column erupts from (dark root anchor)
    p.ellipse(pl.x, pl.y, w + 5, 3.4, C[0]);
    p.ellipse(pl.x, pl.y - 0.5, w + 2.5, 2.2, bk < 0.35 ? C[4] : C[2]);
    const NZ = (rate, s0, off = 0) => noise(t * rate + off, s0);
    // blazing crown tongues where the column breaks into the air (bright top)
    if (bk < 0.55 && h > 24) {
      const k = clamp(w / pl.w, 0, 1);
      for (let i = 0; i < 2; i++) {
        const n = pl.seed + i * 31;
        const dx = (i - 0.5) * w * 0.7;
        flameTongue(p, pl.x + dx + noise(t * 2, n + 2) * 1.5, pl.y - h + 12, (14 + 12 * (0.5 + 0.5 * noise(t * 3.3 + i, n))) * k, 3.4 * k, -dx * 0.3, NZ, n, H, LAYERS);
      }
    }
    const invH = 1 / h;
    for (const sd of strands) sd.off = 0.06 * Math.sin(t * sd.f * 3 + sd.o * 9);
    for (let y = 0; y >= -h; y--) {
      const v = -y * invH;
      const heatV = Math.pow(v, 1.9) * 0.95; // black root -> blazing crown, per row
      const cx = pl.x + noise(-y * 0.04 + t * 1.6, pl.seed + 2) * 1.7 * v;
      // DARK ROOT -> BRIGHT CROWN vertical gradient, foot splash, thinning top
      const foot = 1 + 0.62 * Math.max(0, 1 - -y / 10) ** 2;
      const top = 1 - smooth(0.8, 1, v) * 0.5;
      const nl = Math.max(0, noise(y * 0.2 + t * 8, pl.seed + 3)) ** 1.5;
      const nr = Math.max(0, noise(y * 0.2 + t * 8, pl.seed + 4)) ** 1.5;
      const wv = w * (1 - v * 0.26); // column tapers toward the crown
      const wl = wv * foot * top * (1 + 0.6 * nl), wr = wv * foot * top * (1 + 0.6 * nr);
      const pulse = (-y * 0.032 + t * 3.6) % 1 < 0.09 ? 1 : 0;
      // collapse: the column crumbles from the crown down into ragged gaps
      const erode = bk > 0 ? bk * 1.5 - (1 - v) * 0.55 : -1;
      const x0 = Math.max(X_MIN, Math.floor(cx - wl * 1.15)), x1 = Math.min(X_MAX, Math.ceil(cx + wr * 1.15));
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const q = Math.abs(dx) / (dx < 0 ? wl : wr);
        if (q > 1.15) continue;
        if (erode > 0 && rand(x, y, pl.seed + 9) < erode - 0.35) continue;
        // heat = vertical climb (black root -> incandescent crown) + radial core + swirl strands
        let heat = heatV + (1 - clamp(q, 0, 1)) * 0.18;
        for (const sd of strands) if (Math.abs(dx / w - sd.o - sd.off) < sd.w) heat -= 0.22;
        heat += pulse * 0.12;
        if (bk > 0.3) heat -= bk * 0.5;
        const ci = heat < 0.16 ? 0 : heat < 0.28 ? 1 : heat < 0.4 ? 2 : heat < 0.52 ? 3 : heat < 0.64 ? 4 : heat < 0.78 ? 5 : heat < 0.9 ? 6 : 7;
        if (ci === 7 && rand(x, y, Math.floor(t * 20)) < 0.45) continue;
        p.px(x, y + pl.y, C[ci]);
      }
      if (y % 44 === 0 && v > 0.35) p.glow(cx, y + pl.y, w * 1.4 + 4, C[5], 0.22 * clamp(w / pl.w));
    }
    // black root smoke curling off the vent
    if (bk < 0.4 && u > 0.06) p.glow(pl.x, pl.y - 4, 16, C[3], 0.3 * (1 - bk));
  }

  function drawRing(p, back, alpha) {
    if (alpha <= 0.02) return;
    const k = ease.outCubic(smooth(0.02, T_RING, t));
    const cool = smooth(1.9, 2.5, t);
    const g = 0.35 + 0.65 * k; // self-similar growth scale
    const pulse = 0.82 + 0.22 * Math.sin(t * 13) * (1 - cool);
    const th = (6.0 * pulse + 2.4 * smooth(T_RING - 0.1, T_RING + 0.1, t)) * (1 - cool * 0.72);
    const M = RING_MASK[back ? 0 : 1];
    const { n, xs, ys, ds, ws, as } = M;
    for (let i = 0; i < n; i++) {
      const py = Math.round(ys[i] * g);
      const locTh = Math.max(0.7, th * ws[i]);
      const dist = ds[i] / g; // mask-space distance scales with the shrinking ring
      if (dist > locTh) continue;
      const q = clamp(dist / locTh);
      // three blazing arcs rotate round the omen ring while it charges
      const hsin = 0.5 + 0.5 * Math.sin(as[i] * 3 - t * 2.6 + 1.2);
      const hs = hsin * hsin * hsin * hsin * (1 - cool);
      let ci = q < 0.3 ? 4 : q < 0.62 ? 3 : 2;
      if (hs > 0.5 && q < 0.52) ci = q < 0.24 ? 6 : 5;
      if (k < 0.9) ci = Math.max(1, ci - 2);
      if (cool > 0.4) ci = Math.max(0, ci - 3);
      // blinking coal flecks as the omen ring dies
      if (cool > 0.55 && rand(xs[i], ys[i], 3) < cool * 0.55) continue;
      p.dot(Math.round(xs[i] * g), py, C[ci], alpha);
    }
  }

  return {
    update(dt) {
      t += dt;
      // the omen charge: crimson motes spiral inward toward the searing ring
      if (t < T_ERUPT && R.chance(0.6 * dt * 60)) {
        const a = R.range(0, TAU), d = R.range(30, 96);
        ps.spawn(P.STREAK, Math.cos(a) * d, Math.sin(a) * d * RSY, -Math.cos(a) * 150, -Math.sin(a) * 46, R.range(0.1, 0.2), R.chance(0.5) ? C[5] : C[4], 1);
      }
      for (const pl of pillars) {
        if (t >= pl.t0 && !done.has(pl.i)) {
          done.add(pl.i);
          const main = pl.i === MAIN;
          lights.add(pl.x, pl.y - 26, main ? 96 : 62, C[5], main ? 0.8 : 0.6, main ? 0.42 : 0.3);
          if (main) lights.add(0, -30, 140, C[4], 0.6, 0.3);
          for (let i = 0; i < (main ? 18 : 9); i++) {
            const a = -Math.PI / 2 + R.range(-1.05, 1.05), sp = R.range(95, 265);
            ps.spawn(P.SPARK, pl.x + R.range(-4, 4), pl.y - 2, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.5));
          }
          for (let i = 0; i < (main ? 9 : 5); i++) {
            const s2 = R.sign();
            bits.add({ kind: B.CHUNK, x: pl.x + s2 * R.range(0, 6), y: pl.y - 1, vx: s2 * R.range(35, 120), vy: -R.range(120, 260), g: 1, drag: 0.4, bounce: 0.34, life: R.range(0.6, 0.95), a: R.range(0, TAU), va: R.range(-15, 15), s: R.pick([1, 2, 2]) });
          }
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + R.range(-0.9, 0.9), sp = R.range(70, 200);
            ps.spawn(P.GRIT, pl.x, pl.y - 1, Math.cos(a) * sp, Math.sin(a) * sp * 0.6, R.range(0.6, 1.1), R.pick([st.light, st.body, C[5]]), R.chance(0.4) ? 2 : 1);
          }
        }
        // collapse: the crown crumbles and sheds falling dark-crimson embers (塌缩余烬落下)
        const s = pillarState(pl);
        if (s && s.bk > 0.02 && s.bk < 0.9 && R.chance(1.6 * dt * 60)) {
          const v = R.range(0.25, 1);
          ps.spawn(P.EMBER, pl.x + R.range(-s.w, s.w), pl.y - s.h * v, R.range(-26, 26), R.range(24, 96), R.range(0.45, 0.85), R.chance(0.5) ? C[5] : C[4], R.chance(0.3) ? 2 : 1, 0.04);
        }
        if (s && s.u > 0.05 && s.bk < 0.5 && R.chance(0.45 * dt * 60)) {
          ps.spawn(P.SMOKE, pl.x + R.range(-s.w, s.w), pl.y - 2, R.range(-16, 16), -R.range(8, 26), R.range(0.5, 0.9), R.chance(0.5) ? C[1] : C[2], R.range(2.5, 4.5));
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
      for (const q of ps.list) if (q.life === q.max && t + q.life > T_END - 0.06) q.life = q.max = Math.max(0.02, T_END - 0.06 - t);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-6) return;
      const fade = 1 - smooth(2.3, 2.55, t);
      // scorched dark pool inside the omen ring
      const pool = smooth(0.06, 0.4, t) * fade;
      if (pool > 0.02) {
        for (let y = Math.max(Y_MIN, -Math.ceil(RING_R * RSY) - 2); y <= 0; y++) {
          const ny = (y + 0.5) / (RING_R * RSY);
          for (let x = -RING_R; x <= RING_R; x++) {
            const nx = x / RING_R, e2 = nx * nx + ny * ny;
            if (e2 > 0.88) continue;
            p.blend(x, y, C[0], 0.5 * pool * (1 - e2 * 0.55));
          }
        }
      }
      drawRing(p, true, fade);
      // radial cracks sear open during the charge, cool to soot afterwards
      const ck = smooth(0.04, 0.5, t) * (1 - smooth(2.0, 2.5, t));
      if (ck > 0.02) {
        for (const c of cracks) {
          const n = Math.floor(c.pts.length * clamp((t - c.t0) / c.grow, 0, 1));
          for (let i = 1; i < n; i++) {
            const u = i / c.pts.length;
            const hot = ck * (1 - 0.5 * u) * (1 - smooth(1.5, 2.2, t));
            const [x0, y0] = c.pts[i - 1], [x1, y1] = c.pts[i];
            p.line(x0, y0, x1, y1, hot > 0.5 ? C[5] : hot > 0.2 ? C[3] : C[1], fade);
          }
        }
      }
      for (const pl of pillars) if (pl.back) drawPillar(p, pl);
      simDraw(p, ps, H, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;
      const fade = 1 - smooth(2.3, 2.55, t);

      for (const pl of pillars) if (!pl.back) drawPillar(p, pl);
      drawRing(p, false, fade);

      // rotating omen runes riding the ring
      const rk = smooth(0.16, 0.46, t) * (1 - smooth(1.95, 2.4, t));
      if (rk > 0.02) {
        for (const rn of runes) {
          const g = rn.g + t * 0.9;
          const rx = Math.cos(g) * 68, ry = Math.sin(g) * 68 * RSY;
          glyph(p, rn.gi, rx, ry - 1, rk > 0.6 ? C[6] : C[4], rk * fade, C[1]);
        }
      }

      // per-vent HIT RESULT: ground flash, shock band, and a hero starburst on the main vent
      for (const pl of pillars) {
        const q = t - pl.t0;
        if (q < 0 || q > 0.5) continue;
        const bk2 = q / 0.42;
        if (bk2 < 1) band(p, pl.x, pl.y + 0.5, 10 + 44 * ease.outCubic(bk2), 0.2, Math.max(1, 4.2 * (1 - bk2)), 1.05 - bk2, [C[2], C[4], C[6], C[7]], (g) => Math.sin(g) >= 0, bk2 < 0.1);
        if (q < 0.08) {
          const f = 1 - q / 0.08;
          p.ellipse(pl.x, pl.y - 2, (pl.w + 8) * f + 3, 4 * f + 1.5, C[6]);
          p.ellipse(pl.x, pl.y - 2.5, (pl.w + 3) * f + 1.5, 2.5 * f + 1, q < 0.04 ? WHITE : C[7]);
        }
        if (pl.i === MAIN && q < 0.075) {
          const hot = q < 0.037, hk = 1 - q / 0.075;
          star(p, pl.x, pl.y - 26, hitSpikes, hot ? 1 : 1.3, hot ? 1 : 0.6, WHITE, C[6], C[7], C[4]);
          flare(p, pl.x, pl.y - 26, 52 * hk, hk, [C[3], C[5], C[7], WHITE]);
          p.beam(pl.x - 40 * hk, pl.y - 1, pl.x + 40 * hk, pl.y - 1, hot ? 3.6 : 2, WHITE);
        }
      }

      // lingering scorch: blackened disc with blinking coal flecks
      const sc = smooth(0.7, 1.1, t) * fade;
      if (sc > 0.02) {
        for (let y = Math.max(Y_MIN, -Math.ceil(RING_R * RSY * 0.8) - 1); y <= 1; y++) {
          const ny = (y + 0.5) / (RING_R * RSY * 0.8);
          for (let x = -Math.floor(RING_R * 0.82); x <= Math.floor(RING_R * 0.82); x++) {
            const nx = x / (RING_R * 0.82), e2 = nx * nx + ny * ny;
            if (e2 > 1) continue;
            if (rand(x, y, 7) < 0.35 + e2 * 0.4) continue;
            p.blend(x, y, C[0], 0.55 * sc * (1 - e2 * 0.6));
          }
        }
        floorLight(p, 0, 0.5, 74, 10, C[4], 0.3 * sc * clamp(1.4 - (t - 1.1) * 0.8));
      } else if (t < 0.7) {
        floorLight(p, 0, 0.5, 40 + 60 * smooth(0.1, 0.6, t), 9, C[4], 0.34 * smooth(0.05, 0.3, t));
      }

      for (const b of bits.list) rock(p, b, st);
      simDraw(p, ps, H, "front");
      lights.draw(p);

      // oppressive void: the omen pool drinks the ambient light while it charges
      const dk = smooth(0.05, 0.4, t) * (1 - smooth(0.6, 1.0, t));
      if (dk > 0.02) {
        const irx = 1 / (RING_R + 4), iry = 1 / (RING_R * RSY + 6);
        unlight(p, -RING_R - 6, -RING_R * RSY - 8, RING_R + 6, 4, (x, y) => {
          const ax = x * irx, ay = (y + 2) * iry;
          return ax * ax + ay * ay < 1;
        }, 1 - 0.55 * dk);
      }
    },
  };
}
