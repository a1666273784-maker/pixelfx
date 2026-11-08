// Column and midpoint-displaced bolts reuse the explosion/lightning helpers adapted from
// Sprite Fusion (https://www.spritefusion.com/pixel-art-vfx), MIT, Copyright (c) 2026 Hugo Duprez.
import { Rng, fit, clamp, smooth, TAU } from "../../core/index.js";
import { Column, pool } from "../explosions/_lib.js";
import { zigzag } from "../lightning/_lib.js";

export const meta = {
  name: "麒麟·赤金光坠",
  desc: "A crimson-gold boss lightfall: a breathing white-hot pillar, repeated golden lightning and a racing ground shock ring. Dodge sideways out of the central lane.",
  tags: ["fire", "qilin", "pillar", "lightning", "boss", "ground", "one-shot"],
  size: [320, 200], origin: [160, 176], duration: 2.8, fps: 30, loop: false,
  bg: "black", actor: 2,
  options: {
    crimson: ["#2a0608", "#6e1014", "#b01c1a", "#e0481f", "#f58a24", "#ffe9a8"],
    gold: ["#5c3c06", "#b8860f", "#ffd23c", "#fffbe0"],
    core: ["#fff1c4", "#ffffff"], edge: ["#170b10"], seed: 17,
  },
};
const DESIGN = { width: 30, bolts: 2, ring: 240 };
const TOP = -171, HIT = 0.2;
const READY = { fx: 7, fy: -14, bx: -8, by: -14 };
export const act = {
  target: false,
  poses: [[-0.22, READY], [-0.08, { ...READY, crouch: 3, lean: -2 }],
    [0.2, { ...READY, crouch: 5, lean: 2 }, "snap"], [0.6, READY], [2.8, READY]],
  hits: [{ t: HIT, stop: 0.07, shake: 0.16, amp: 2, target: false }],
};

export function create(o) {
  const R = new Rng(o.seed), C = fit(o.crimson, 6), G = fit(o.gold, 4), K = fit(o.core, 2), E = fit(o.edge, 1);
  // Column expects bright-to-dark fire colors. Keep this ramp entirely crimson;
  // gold shell and white-hot optical core are independent layers, never a combined ramp.
  const FR = [C[5], C[5], C[4], C[4], C[3], C[3], C[2], C[2], C[1], C[0]];
  const column = new Column(R, { w: 19, foot: 8, speed: 125, size: [8, 12], n: 20, sway: 1.5 });
  for (let y = -145; y < 0; y += 9) { column.spawn(y); column.lobes.at(-1).a = 1; }
  const strikes = [];
  for (let i = 0; i < 18; i++) {
    const at = 0.09 + i * 0.118;
    if (at > 1.6 && i % 3 !== 0) continue;
    for (let j = 0; j < DESIGN.bolts; j++) {
      const side = (i + j) % 2 ? -1 : 1, x = side * R.range(28, 39);
      const b = zigzag(R, x * 0.7, TOP + 7, side * R.range(30, 44), -2, 0.075, 0.25);
      for (const q of b.paths) q.pts = q.pts.filter((_, i, pts) => i % 4 === 0 || i === pts.length - 1).map(([x, y]) => [clamp(x, -48, 48), clamp(y, TOP + 5, -2)]);
      strikes.push({ at, b });
    }
  }
  const sparks = [];
  for (const at of [HIT, 0.73, 1.25]) for (let i = 0; i < 22; i++) {
    const side = i % 2 ? -1 : 1;
    sparks.push({ at: at + R.range(0, 0.035), x: R.range(-18, 18), vx: side * R.range(50, 200), vy: R.range(-100, -25), life: R.range(0.25, 0.48) });
  }
  const embers = Array.from({ length: 6 }, () => ({ x: R.range(-12, 12), y: R.range(-18, -3), v: R.range(16, 35), end: R.range(2.65, 2.79) }));
  let t = 0;
  const cool = () => 1 - smooth(1.6, 2.45, t);
  function ring(p, back) {
    if (t < HIT || t >= 2.12) return;
    const age = t - HIT, fade = 1 - smooth(1.6, 2.12, t);
    const drawRing = (rx, ry, thick, alpha) => {
      // Rasterize only the ring, clipped as it travels beyond the canvas (no background fill).
      for (let y = Math.max(-22, Math.floor(-ry - 2)); y <= Math.min(21, Math.ceil(ry + 2)); y++) {
        if ((y < 0) !== back) continue;
        for (let x = -157; x <= 157; x++) {
          const d = Math.abs(Math.hypot(x / rx, y / ry) - 1) * ry;
          if (d < thick) p.blend(x, y, d < thick * 0.4 ? G[3] : G[2], alpha);
        }
      }
    };
    if (age < 0.65) drawRing(18 + DESIGN.ring * (1 - Math.exp(-age * 5)), 3 + age * 42, 1.8, 1 - smooth(0.4, 0.65, age));
    drawRing(45, 8, 0.65, fade * smooth(0, 0.12, age));
  }
  function shaft(p) {
    if (t >= 2.74) return;
    if (t >= 2.45) {
      const bottom = -171 * smooth(2.45, 2.74, t);
      p.line(0, TOP, 0, bottom, G[3]);
      return;
    }
    const front = TOP * (1 - clamp((t - 0.035) / 0.165));
    const heat = cool(), pulse = 1 + 0.09 * Math.sin(t * 19) + 0.035 * Math.sin(t * 37);
    const w = (1 + (DESIGN.width - 1) * Math.pow(heat, 0.65)) * pulse * (0.08 + 0.92 * smooth(0.025, 0.15, t));
    if (t >= HIT && t < 2.2) {
      column.o.w = w * 0.6; column.o.foot = 8 * heat;
      column.draw(p, TOP + 18, FR, FR, 4, 0);
    }
    for (let y = TOP; y <= front; y++) {
      const wave = Math.pow(Math.max(0, Math.cos(y * 0.035 - t * 15)), 6);
      const bulge = 1 + 0.035 * Math.sin(y * 0.08 + t * 20) + 0.1 * wave, hw = w * bulge;
      p.rect(-hw, y, hw * 2, 1, E[0]);
      p.rect(-hw + 1, y, Math.max(1, hw * 2 - 2), 1, C[3]);
      p.rect(-hw * 0.82, y, hw * 1.64, 1, C[4]);
      p.rect(-hw * 0.65, y, hw * 1.3, 1, G[2]);
      p.rect(-hw * 0.48, y, hw * (0.72 + 0.12 * wave), 1, G[3]);
      p.rect(-hw * 0.3, y, Math.max(1, hw * (0.33 + 0.12 * wave)), 1, heat > 0.15 ? K[1] : G[3]);
    }
    if (t >= HIT) pool(p, 0, -1, 46, 10, G[2], 0.45 * heat);
  }
  return {
    update(dt) { t += dt; column.update(dt, TOP + 18, t < 1.8 ? 1 : 0); },
    drawBack(p) { if (t < 2.8) ring(p, true); },
    draw(p) {
      if (t >= 2.8) return;
      shaft(p);
      for (const s of strikes) {
        const age = t - s.at;
        if (age < 0 || age > 0.16) continue;
        for (const q of s.b.paths) {
          const w = (age < 0.07 ? 3 : 1.5) * q.w;
          for (let i = 1; i < q.pts.length; i++) {
            const [x, y] = q.pts[i - 1], [xx, yy] = q.pts[i];
            p.beam(x, y, xx, yy, w + 1, G[1]);
            p.beam(x, y, xx, yy, w, G[2]);
            p.line(x, y, xx, yy, age < 0.1 ? K[1] : G[3]);
          }
        }
      }
      ring(p, false);
      if (t >= HIT && t < HIT + 0.067) p.ellipse(0, -1, 45, 5, K[1]);
      for (const s of sparks) {
        const a = t - s.at;
        if (a < 0 || a >= s.life) continue;
        const x = s.x + s.vx * a, y = -2 + s.vy * a + 180 * a * a;
        if (y > 0) continue;
        p.line(x - s.vx * 0.018, y - (s.vy + 360 * a) * 0.018, x, y, G[2]);
        p.px(x, y, G[3]);
      }
      if (t >= 2.45) for (const s of embers) if (t < s.end) {
        p.px(s.x, s.y - (t - 2.45) * s.v, G[3]);
      }
    },
  };
}
