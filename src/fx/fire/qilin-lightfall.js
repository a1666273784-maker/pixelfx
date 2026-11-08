import { Rng, fit, clamp, smooth, ease, TAU, WHITE } from "../../core/index.js";
import { Column } from "../explosions/_lib.js";
import { zigzag } from "../lightning/_lib.js";

export const meta = {
  name: "麒麟·赤金光坠",
  desc: "A towering qilin's red-gold pillar crashes from the sky and holds, wrapped in branching golden lightning as a flat shock ring races across the ground.",
  tags: ["fire", "gold", "pillar", "lightning", "impact", "boss", "qilin", "one-shot"],
  size: [320, 200],
  origin: [160, 176],
  duration: 2.8,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    crimson: ["#2a0608", "#6e1014", "#b01c1a", "#e0481f", "#f58a24", "#ffe9a8"],
    gold: ["#5c3c06", "#b8860f", "#ffd23c", "#fffbe0"],
    core: ["#fff1c4", "#ffffff"],
    edge: ["#170b10"],
    seed: 11,
  },
};

const TOP = -174;
const clamp01 = (v) => clamp(v, 0, 1);

export function create(o) {
  const C = fit(o.crimson, 6), G = fit(o.gold, 4), H = fit(o.core, 2), E = fit(o.edge, 1)[0];
  const R = new Rng(o.seed);
  const fire = fit(o.crimson, 8).reverse();
  // The shared explosion Column supplies the living, upward-running fire lobes inside the shaft.
  const column = new Column(R, { w: 3.4, foot: 7.5, speed: 155, size: [2.5, 5.5], n: 34, sway: 1.4, fade: 0.22, style: 1 });
  const strikes = [];
  for (let i = 0; i < 15; i++) {
    const sx = R.range(-24, 24), ex = clamp(sx + R.range(-13, 13), -38, 38);
    const b = zigzag(R, sx, TOP + 5 + R.range(0, 8), ex, -1, 0.24, 0.72, 1.25);
    for (const path of b.paths) for (const point of path.pts) {
      point[0] = clamp(point[0], -156, 156);
      point[1] = clamp(point[1], TOP + 3, -1);
    }
    strikes.push({ b, delay: i * 0.172, life: R.range(0.115, 0.165), flicker: R.range(0.72, 1) });
  }
  const sparks = [];
  for (const [at, count] of [[0.205, 26], [0.91, 13], [1.35, 14]]) {
    for (let i = 0; i < count; i++) {
      const a = R.range(-Math.PI + 0.12, -0.12), speed = R.range(42, i < count * 0.35 ? 132 : 86);
      sparks.push({ at: at + R.range(0, 0.07), vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - R.range(30, 58), life: R.range(0.29, 0.55), size: R.range(0.9, 1.7), c: R.chance(0.7) ? G[2] : C[4] });
    }
  }
  let t = 0;

  function shaft(p, tt) {
    const strike = ease.outCubic((tt - 0.025) / 0.155);
    const retract = smooth(2.39, 2.79, tt);
    const pulse = 1 + 0.14 * Math.sin((tt - 0.28) * TAU * 1.7) + 0.045 * Math.sin((tt - 0.28) * TAU * 3.4 + 0.8);
    const width = (tt < 0.3 ? 20 + 5 * clamp01((tt - 0.14) / 0.16) : 23.7 * pulse) * (1 - 0.74 * retract);
    const headY = tt < 0.16 ? TOP + (-TOP) * strike : 0;
    const hold = 1 - smooth(2.37, 2.51, tt);
    if (tt < 0.15) {
      p.line(-7, TOP + 0.5, 7, TOP + 0.5, H[1], (1 - tt / 0.15));
      p.glow(0, TOP + 1, 16, G[2], 0.7 * (1 - tt / 0.15));
    }
    if (tt > 0.12 && tt < 2.8) {
      // A breathing, hard-edged volume: separate red, gold and white-hot bands, never a blended ramp.
      const y0 = TOP;
      p.shade(-30, y0, 30, 1, (x, y, out) => {
        const yy = y + 0.5;
        if (yy > headY || yy > 0.5) return;
        const w = width * (0.94 + 0.06 * Math.sin((tt * 4.4) + yy * 0.045));
        const d = Math.abs(x + 0.5) / w;
        if (d > 1) return;
        const fadeIn = smooth(0.12, 0.19, tt);
        const a = hold * fadeIn * Math.min(1, (tt - 0.12) * 16 + 0.25);
        out.a = a;
        if (d > 0.92) return E;
        if (d > 0.62) return d > 0.82 ? C[1] : C[2];
        if (d > 0.36) return d > 0.49 ? C[3] : G[1];
        if (d > 0.19) return G[2];
        if (d > 0.075) return G[3];
        return H[1];
      });
      if (hold > 0.02) {
        p.glowLine(0, TOP, 0, Math.min(headY, -18), 19 + width * 0.5, G[2], 0.22 * hold);
        p.glowLine(0, TOP, 0, headY, 6.5, H[0], 0.32 * hold);
      }
      // Last beat: the shaft contracts upward into one gold filament and vanishes.
      if (retract > 0.06) {
        const tip = TOP * (1 - retract);
        p.glowLine(0, tip, 0, 0, 4.5, G[2], 0.28 * (1 - retract));
        p.line(0, tip, 0, 0, G[2], 0.9 * (1 - retract * 0.25));
        p.line(0, tip, 0, 0, G[3], 0.7 * (1 - retract));
      }
    }
  }

  function drawStrike(p, q, alpha, progress) {
    if (alpha <= 0) return;
    for (const path of q.b.paths) {
      const pts = path.pts;
      const end = Math.max(1, Math.ceil((pts.length - 1) * progress));
      for (let i = 0; i < end; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const branch = path.w < 1;
        const a = alpha * (branch ? 0.7 : 1);
        p.beam(x0, y0, x1, y1, branch ? 1.3 : 3.6, G[0], a * 0.8);
        p.beam(x0, y0, x1, y1, branch ? 0.8 : 2.1, G[2], a);
        p.line(x0, y0, x1, y1, branch ? G[3] : H[0], a);
        if (!branch && i % 4 === 0) p.glowLine(x0, y0, x1, y1, 5, G[2], 0.22 * a);
      }
    }
  }

  function ring(p, rx, thickness, sy, alpha, color, glow = 0) {
    if (alpha <= 0.005 || rx <= 0.5) return;
    const ry = Math.max(1, rx * sy), halfH = Math.min(22, ry + thickness + 2);
    p.shade(-159, -halfH, 159, Math.min(22, halfH), (x, y, out) => {
      const dx = (x + 0.5) / rx, dy = (y + 0.5) / ry;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const edgeDist = Math.abs(dist - 1) * Math.min(rx, ry);
      if (edgeDist > thickness) return;
      out.a = alpha * (edgeDist < thickness * 0.48 ? 1 : 0.75);
      return edgeDist < 0.7 && color === G[2] ? G[3] : color;
    });
  }

  return {
    update(dt) {
      t += dt;
      const feed = t > 0.14 && t < 2.43 ? (t < 1.62 ? 1 : 1 - smooth(1.62, 2.43, t)) : 0;
      column.update(dt, TOP + 4, feed);
    },
    drawBack(p) {
      const k = 1 - smooth(2.37, 2.53, t);
      if (k > 0.02) column.draw(p, TOP + 4, fire, fire, 0.82 * k, 0.22 * k);
      // Broad shock ring is clipped by the canvas and stays on the floor plane.
      if (t > 0.185 && t < 1.08) {
        const u = clamp01((t - 0.185) / 0.79);
        const r = 5 + 205 * ease.outCubic(u);
        ring(p, r, 2.5 + 1.2 * (1 - u), 0.115, (1 - smooth(0.72, 1, u)) * (t < 0.31 ? 1 : 0.78), G[2], 0.32);
      }
      if (t > 0.35 && t < 1.83) {
        const fade = 1 - smooth(1.55, 1.84, t);
        ring(p, 43 + 1.5 * Math.sin(t * 5), 1.15, 0.13, 0.72 * fade, G[2], 0.12);
      }
    },
    draw(p) {
      const tt = t;
      if (tt >= 2.79) return;
      shaft(p, tt);
      // Repeated, brief lightning strikes; the fold narrows the active arc and its brightness.
      const boltFade = 1 - smooth(1.62, 2.24, tt);
      if (boltFade > 0.01) for (const q of strikes) {
        const age = tt - (0.1 + q.delay);
        if (age < 0 || age > q.life) continue;
        const u = age / q.life;
        const envelope = Math.sin(Math.PI * u) ** 0.28 * q.flicker * boltFade;
        drawStrike(p, q, envelope, clamp01(u * 7 + 0.18));
      }
      // Ground hit flash and three compact, seeded spark eruptions. No smoke or debris.
      if (tt >= 0.185 && tt < 0.33) {
        const k = 1 - smooth(0.205, 0.33, tt);
        p.glow(0, -1, 32 * (1 - 0.25 * k), H[1], 0.7 * k);
        p.line(-25, -1, 25, -1, H[1], 0.85 * k);
      }
      for (const s of sparks) {
        const age = tt - s.at;
        if (age < 0 || age >= s.life) continue;
        const k = 1 - age / s.life;
        const x = s.vx * age, y = -1 + s.vy * age + 475 * age * age;
        if (y > 0) continue;
        const tail = Math.min(3.8, Math.hypot(s.vx, s.vy) * 0.018) * k;
        p.line(x - s.vx * 0.014, y - s.vy * 0.014, x, y, s.c, k);
        p.dot(x, y, k > 0.55 ? G[3] : s.c, Math.min(1, k * 1.4));
        if (tail > 1.4) p.glow(x, y, tail + 2, s.c, 0.18 * k);
      }
      // Final ember pinpricks are part of the departing ground ring and disappear before t=2.8.
      if (tt > 2.42 && tt < 2.79) {
        for (let i = 0; i < 5; i++) {
          const phase = (i * 1.71 + (o.seed % 7)) % TAU;
          const x = Math.cos(phase) * (10 + i * 4), y = -2 - (tt - 2.42) * (8 + i * 2);
          p.dot(x, y, i % 2 ? G[2] : H[0], (1 - smooth(2.58, 2.79, tt)) * (i % 2 ? 0.7 : 1));
        }
      }
    },
  };
}
