// Lightning paths use the midpoint-displacement zigzag from Sprite Fusion's open-source lightning
// (https://www.spritefusion.com/pixel-art-vfx/lightning), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, P, Rng, clamp, ease, fit, seg, smooth, TAU } from "../../core/index.js";
import { Column, pool } from "../explosions/_lib.js";
import { zigzag } from "../lightning/_lib.js";

export const meta = {
  name: "麒麟·赤金光坠",
  desc: "A crimson-gold column crashes down, crackling with lightning as a ground ring races out, then narrows into a lifting golden thread.",
  tags: ["fire", "qilin", "gold", "pillar", "lightning", "shockwave", "boss", "ground", "one-shot"],
  size: [320, 200],
  origin: [160, 176],
  duration: 2.8,
  loop: false,
  fps: 30,
  // A gallery backdrop only; the effect itself paints no background.
  bg: "black",
  actor: 2,
  options: {
    crimson: ["#2a0608", "#6e1014", "#b01c1a", "#e0481f", "#f58a24", "#ffe9a8"],
    gold: ["#5c3c06", "#b8860f", "#ffd23c", "#fffbe0"],
    core: ["#fff1c4", "#ffffff"],
    edge: ["#170b10"],
    seed: 13,
  },
};

// The stand-in is a player safely to the side, not part of the effect layer.
const READY_ = { x: -76, crouch: 3, fx: 11, fy: -21, bx: 9, by: -21, ffx: 7, fbx: -7 };
const BRACE = { ...READY_, crouch: 6, lean: -2, fx: 7, fy: -25, bx: 8, by: -24 };
export const act = {
  poses: [[-0.16, READY_], [0.13, BRACE], [0.2, BRACE, "snap"], [0.7, READY_], [2.8, READY_]],
  hits: [{ t: 0.2, stop: 0.05, shake: 0.12, amp: 1, target: false }],
};

const TOP = -172, HIT = 0.2, DURATION = 2.8;
const DESIGN = { width: 23, cadence: 0.10, pair: 2, reach: 190 };

export function create(o) {
  // Keep the four caller-adjustable ramps separate. `palette` is the standard optional alias for crimson.
  const C = fit(o.palette ?? o.crimson, 6), G = fit(o.gold, 4), K = fit(o.core, 2), E = fit(o.edge, 1);
  const R = new Rng(o.seed), ps = new Particles({ rng: R, ground: () => 0 });
  // Column's own lobe renderer supplies the living, hot interior, never a smoke palette.
  const column = new Column(R, { w: DESIGN.width * 1.1, foot: 0, speed: 105, size: [3.2, 5.0], n: 24, sway: 1.5 });
  const columnFire = fit(o.palette ?? o.crimson, 9).reverse(), columnGold = fit(o.gold, 5).reverse();

  function makeBolt(side, contraction = 1) {
    const x0 = side * (DESIGN.width * 0.95 + R.range(2, 6));
    const x1 = side * (DESIGN.width * 0.85 + R.range(1, 7));
    const bolt = zigzag(R, x0, TOP + 1, x1, -2, 0.15, 0.16);
    // Keep the large bends from the reference's midpoint displacement: long, angular
    // segments read as lightning at 1x instead of a vibrating wire. Keep forks in the lane.
    for (const path of bolt.paths) {
      const stride = path.w >= 1 ? 6 : 3, last = path.pts.length - 1;
      const points = path.pts.filter((_, i) => i === 0 || i === last || i % stride === 0);
      path.pts = points.map(([x, y], i) => [
        clamp((x + (i > 0 && i < points.length - 1 ? (i % 2 ? -3 : 3) : 0)) * contraction, -46, 46),
        clamp(y, TOP + 1, -2),
      ]);
    }
    return bolt;
  }
  const strikes = [];
  for (let start = 0.05, i = 0; start < 1.61; start += DESIGN.cadence, i++) {
    const side = i % 2 ? -1 : 1;
    strikes.push({ start, end: start + DESIGN.cadence * 1.06, bolts: Array.from({ length: DESIGN.pair }, (_, j) => makeBolt(j ? -side : side)) });
  }
  for (const [i, start] of [1.74, 1.98, 2.2].entries()) {
    const contraction = 1 - 0.65 * smooth(1.6, 2.45, start);
    strikes.push({ start, end: start + 0.13, bolts: [makeBolt(i % 2 ? -1 : 1, contraction)] });
  }

  const bursts = [{ at: HIT, count: 22 }, { at: 0.73, count: 10 }, { at: 1.22, count: 10 }];
  let t = 0, landed = false, after = false, nextBurst = 0;

  function eject(n) {
    for (let i = 0; i < n; i++) {
      // Start near the foot's edge, with a shallow outward launch, so the beam cannot hide the burst.
      const side = i % 2 ? 1 : -1;
      ps.spawn(P.SPARK, side * R.range(10, 17), -2, side * R.range(125, 185), -R.range(60, 145), R.range(0.27, 0.42));
    }
  }

  // A true-alpha ellipse on the ground. Unlike a dithered fade it leaves no screen-door pattern.
  function ring(p, radius, ry, thickness, alpha, back, hot = false) {
    if (radius < 1 || alpha <= 0.004) return;
    const rx = radius, xlim = Math.min(159, rx + thickness + 1), ylim = ry + thickness + 1;
    p.each(-xlim, -ylim, xlim, ylim, (x, y, sx, sy) => {
      if ((y < 0) !== back) return;
      const d = Math.hypot(x / rx, y / ry);
      if (d < 0.001) return;
      // Convert normalized elliptical distance to approximately one screen pixel of thickness.
      const normal = Math.hypot(x / (rx * rx * d), y / (ry * ry * d));
      const dist = Math.abs(d - 1) / normal;
      if (dist > thickness) return;
      const col = dist < thickness * 0.52 ? (hot ? K[1] : G[3]) : G[2];
      p.blendPx(sx, sy, col, alpha);
      p.add(sx, sy, G[2], 0.09 * alpha);
    });
  }

  function ground(p, back) {
    if (t < HIT) return;
    const age = t - HIT;
    if (age < 0.61) {
      const u = seg(age, 0, 0.52), radius = 12 + (DESIGN.reach - 12) * ease.outCubic(u);
      const ry = Math.min(10.5, 2 + radius * 0.07), alpha = 1 - smooth(0.4, 0.61, age);
      ring(p, radius, ry, 1.8 - 0.9 * u, alpha, back, age < 0.07);
    }
    // The residual ring is plain and thin: no sigil, marks, floor texture or scorch.
    if (t >= 0.4 && t < 2.12) {
      const alpha = smooth(0.4, 0.55, t) * (1 - smooth(1.65, 2.12, t)) * (0.75 + 0.15 * Math.sin(t * 5));
      ring(p, 32, 6.5, 0.8, alpha, back);
    }
    if (!back && age < 0.12) {
      const flash = 1 - smooth(0.01, 0.12, age);
      pool(p, 0, 0, 46, 7, K[0], flash * 0.55);
      if (age < 0.045) p.line(-28, -1, 28, -1, K[1]);
    }
  }

  const dropEnd = () => TOP + (-1 - TOP) * ease.inQuad(seg(t, 0.035, HIT));

  function beam(p) {
    if (t >= 2.72) return;
    if (t >= 2.45) {
      // The bottom of the last one-pixel shaft lifts into the sky.
      const bottom = -1 + (TOP + 1) * ease.outCubic(seg(t, 2.45, 2.72));
      if (bottom >= TOP) p.line(0, TOP, 0, bottom, G[3]);
      return;
    }
    if (t < 0.035) {
      p.line(-3, TOP, 3, TOP, K[1]);
      return;
    }
    const bottom = t < HIT ? dropEnd() : -1;
    const arrival = smooth(0.035, 0.19, t);
    const cool = smooth(1.6, 2.45, t);
    // A two-beat surge followed by a quieter trough, instead of a uniform oscillating tube.
    const beat = (t - HIT) * TAU * 1.2;
    const pulse = 0.86 + 0.17 * Math.sin(beat) + 0.06 * Math.sin(beat * 2 - 0.6);
    const width = 0.8 + DESIGN.width * arrival * (1 - cool) * pulse;
    const rows = [];
    for (let y = TOP; y <= Math.floor(bottom); y++) {
      const center = 1.4 * Math.sin(y * 0.036 + t * 5.4) * (1 - cool);
      const w = width * (0.96 + 0.06 * Math.sin(y * 0.045 - t * 7));
      rows.push([y, center, w]);
      if (w < 1.5) continue;
      p.line(center - w - 1, y, center + w + 1, y, E[0]);
      p.line(center - w, y, center + w, y, C[3]);
      p.line(center - w * 0.83, y, center + w * 0.83, y, C[4]);
    }
    if (landed && t < 1.72) column.draw(p, TOP + 9, columnFire, columnGold, 1, 0.35);
    for (const [y, center, w] of rows) {
      if (w < 1.5) {
        p.px(0, y, G[3]);
        continue;
      }
      p.line(center - w * 0.66, y, center + w * 0.66, y, G[2]);
      p.line(center - w * 0.42, y, center + w * 0.42, y, G[3]);
      const bright = center + Math.sin(y * 0.025 - t * 8) * w * 0.09;
      const coreWidth = Math.max(0.3, w * (0.19 - 0.12 * cool));
      p.line(bright - coreWidth, y, bright + coreWidth, y, cool < 0.86 ? K[1] : G[3]);
    }
    if (bottom > -40 && width > 5) p.glowLine(0, TOP + 18, 0, -20, Math.min(18, width * 0.9), G[2], 0.16 * (1 - cool));
  }

  // Ink each zigzag separately with its gold body and white-hot centre, without a combined color ramp.
  function bolt(p, b, maxY, age, duration) {
    for (const path of b.paths) {
      const trunk = path.w >= 1;
      for (let i = 1; i < path.pts.length; i++) {
        let [ax, ay] = path.pts[i - 1], [bx, by] = path.pts[i];
        if (ay > maxY && by > maxY) continue;
        if (ay > maxY) { const u = (maxY - by) / (ay - by); ax = bx + (ax - bx) * u; ay = maxY; }
        if (by > maxY) { const u = (maxY - ay) / (by - ay); bx = ax + (bx - ax) * u; by = maxY; }
        if (trunk) {
          p.line(ax - 1, ay, bx - 1, by, G[2]);
          p.line(ax + 1, ay, bx + 1, by, G[2]);
        }
        p.line(ax, ay, bx, by, trunk && age < duration * 0.8 ? K[1] : G[3]);
        if (trunk && i % 16 === 0 && ay > TOP + 7 && ay < -7) p.glow(ax, ay, 6, G[2], 0.22);
      }
    }
  }

  function sparks(p) {
    for (const q of ps.list) {
      const k = q.life / q.max;
      if (q.k === P.EMBER) {
        // The last gold flecks fade in alpha, not down into a dull color step.
        p.blend(q.x, q.y, G[3], Math.min(1, k * 3));
        continue;
      }
      const sp = Math.hypot(q.vx, q.vy) || 1, ux = q.vx / sp, uy = q.vy / sp, len = Math.min(6, 1 + sp * 0.025);
      p.line(q.x - ux * len, q.y - uy * len, q.x, q.y, C[4]);
      p.line(q.x - ux * len * 0.35, q.y - uy * len * 0.35, q.x, q.y, k > 0.55 ? K[1] : k > 0.3 ? G[3] : G[2]);
      p.glow(q.x, q.y, 3, G[2], 0.25 * k);
    }
  }

  return {
    update(dt) {
      t += dt;
      if (!landed && t >= HIT) {
        landed = true;
        // Fill the reusable column immediately on impact; it then moves upward under its own simulation.
        for (let y = -7; y >= TOP + 18; y -= 10) {
          column.spawn(y);
          column.lobes[column.lobes.length - 1].a = 1;
        }
      }
      if (landed && t < 1.8) column.update(dt, TOP + 9, 1);
      while (nextBurst < bursts.length && t >= bursts[nextBurst].at) eject(bursts[nextBurst++].count);
      if (!after && t >= 2.45) {
        after = true;
        for (let i = 0; i < 4; i++) ps.spawn(P.EMBER, R.range(-7, 7), -R.range(4, 16), R.range(-5, 5), -R.range(12, 25), R.range(0.18, 0.29));
      }
      ps.update(dt);
    },
    drawBack(p) {
      if (t >= DURATION - 1e-6) return;
      ground(p, true);
    },
    draw(p) {
      if (t >= DURATION - 1e-6) return;
      beam(p);
      const maxY = t < HIT ? dropEnd() : -2;
      for (const s of strikes) if (t >= s.start && t < s.end) for (const b of s.bolts) bolt(p, b, maxY, t - s.start, s.end - s.start);
      ground(p, false);
      sparks(p);
    },
  };
}
