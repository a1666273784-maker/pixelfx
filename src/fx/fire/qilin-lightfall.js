import { Rng, fit, clamp, smooth, ease, noise, TAU, WHITE } from "../../core/index.js";
import { Column } from "../explosions/_lib.js";
import { zigzag } from "../lightning/_lib.js";
import { flameTongue } from "./_lib.js";

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
  const tongues = Array.from({ length: 12 }, (_, i) => ({
    side: i & 1 ? 1 : -1, phase: R.range(0, 1), speed: R.range(27, 45), len: R.range(9, 20),
    half: R.range(1.6, 2.7), lean: R.range(-3, 3), seed: 73 + i * 29,
  }));
  const tongueNoise = (tt) => (rate, seed, off = 0) => noise(tt * rate + off, seed);
  // Keep the shared explosion Column as the turbulent, upward-running flame just outside the hard-hot beam.
  const column = new Column(R, { w: 7, foot: 12, speed: 138, size: [3, 6], n: 30, sway: 2.7, fade: 0.22, style: 1 });
  const strikes = [];
  for (let i = 0; i < 15; i++) {
    const sx = R.range(-29, 29), ex = clamp(sx + R.range(-17, 17), -43, 43);
    const b = zigzag(R, sx, TOP + 5 + R.range(0, 8), ex, -1, 0.24, 0.82, 1.25);
    for (const path of b.paths) {
      path.pts = path.pts.filter((_, j, pts) => !(j & 1) || j === pts.length - 1);
      for (const point of path.pts) {
        point[0] = clamp(point[0], -156, 156);
        point[1] = clamp(point[1], TOP + 3, -1);
      }
    }
    strikes.push({ b, delay: i * 0.172, life: R.range(0.205, 0.275), flicker: R.range(0.72, 1) });
  }
  const sparks = [];
  for (const [at, count] of [[0.205, 26], [0.91, 13], [1.35, 14]]) {
    for (let i = 0; i < count; i++) {
      const a = (R.chance(0.5) ? -1 : 1) * R.range(0.12, 0.72), speed = R.range(72, i < count * 0.35 ? 158 : 112);
      sparks.push({ at: at + R.range(0, 0.07), x0: R.range(-5, 5), vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - R.range(24, 52), life: R.range(0.29, 0.55), size: R.range(1, 1.7), c: R.chance(0.7) ? G[2] : C[4] });
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
      p.line(-8, TOP + 0.5, 8, TOP + 0.5, H[1], 1 - tt / 0.15);
      p.line(-4, TOP + 1.5, 4, TOP + 1.5, G[2], 0.8 * (1 - tt / 0.15));
      p.glow(0, TOP + 12, 10, G[2], 0.72 * (1 - tt / 0.15));
    }
    if (tt <= 0.12 || tt >= 2.8) return;

    const fadeIn = smooth(0.12, 0.19, tt);
    const bodyA = hold * fadeIn * Math.min(1, (tt - 0.12) * 16 + 0.25);
    const yEnd = Math.min(0, headY);
    // A noisy, independently breathing silhouette: the shoulder flares at the ground and the upper rim licks.
    for (let y = Math.ceil(TOP + 2); y <= Math.floor(yEnd); y++) {
      const v = clamp01((y - TOP) / -TOP);
      const drift = noise(y * 0.075 + tt * 2.6, o.seed + 13) * 1.45 + noise(y * 0.21 - tt * 4.8, o.seed + 5) * 0.55;
      const cx = drift * (0.55 + 0.45 * v) + Math.sin(y * 0.033 + tt * 3.4) * 0.65;
      const foot = 1 + 0.16 * smooth(-18, 0, y);
      const left = width * foot * (1 + 0.095 * noise(y * 0.115 + tt * 4.2, o.seed + 21));
      const right = width * foot * (1 + 0.095 * noise(y * 0.115 + tt * 4.2, o.seed + 44));
      const streamA = Math.sin(y * 0.058 - tt * 5.4 + o.seed) * 0.2;
      const streamB = Math.sin(y * 0.041 + tt * 4.2 + o.seed * 0.7) * 0.18;
      const rimL = noise(y * 0.23 + tt * 5.1, o.seed + 32), rimR = noise(y * 0.23 + 7 + tt * 5.1, o.seed + 32);
      const innerFlicker = Math.sin(y * 0.1 - tt * 6) > -0.55;
      for (let x = Math.floor(cx - left - 1); x <= Math.ceil(cx + right + 1); x++) {
        const dx = x + 0.5 - cx, sideW = dx < 0 ? left : right, q = Math.abs(dx) / sideW;
        if (q > 1.08) continue;
        const rimWobble = dx < 0 ? rimL : rimR;
        if (q > 0.98 + rimWobble * 0.025 && ((y + x) & 1)) continue;
        let color;
        if (q > 0.96) color = E;
        else if (q > 0.86) color = rimWobble > 0.18 ? C[1] : C[0];
        else if (q > 0.68) color = q > 0.79 ? C[1] : C[2];
        else if (q > 0.53) color = C[3];
        else if (q > 0.39) color = G[1];
        else if (q > 0.26) color = G[2];
        else if (q > 0.12) color = G[3];
        else color = H[1];
        // Two wavering hot channels break the flat stripe into living, upward-running volume.
        if (q < 0.68 && Math.abs(dx / width - streamA) < 0.026) color = q < 0.28 ? H[0] : G[3];
        if (q < 0.58 && Math.abs(dx / width - streamB - 0.21) < 0.024 && innerFlicker) color = G[2];
        if (bodyA >= 0.999) p.px(x, y, color);
        else p.dot(x, y, color, bodyA);
      }
      // Irregular, attached tongues make the rim crackle like a hand-built fire column, not a vector bar.
      const lickNoise = noise(y * 0.17 + tt * 3.6, o.seed + 8), lickSide = noise(y * 0.13 - tt * 2.7, o.seed + 18) > 0 ? 1 : -1;
      if (lickNoise > 0.48 && v < 0.94) {
        const len = 1 + Math.floor(3 * Math.max(0, noise(y * 0.11 - tt * 2, o.seed + 61)));
        for (let j = 1; j <= len; j++) p.dot(cx + lickSide * (width * 0.98 + j), y - Math.floor((j + 1) / 2), j === len ? G[2] : C[4], bodyA * 0.9);
      }
      if (lickNoise > 0.91 && v < 0.88) p.dot(cx - lickSide * (width + 1), y - 1, G[1], bodyA * 0.8);
    }
    if (bodyA > 0.03) {
      const prevFade = p.fade;
      p.fade = prevFade * bodyA;
      const N = tongueNoise(tt);
      for (const q of tongues) {
        let d = (q.phase * 174 - tt * q.speed) % 174;
        if (d < 0) d += 174;
        const tip = TOP + 3 + d, base = Math.min(-1, tip + q.len), h = base - tip;
        if (h < 2 || tip > headY) continue;
        const v = clamp01((tip - TOP) / -TOP);
        const center = noise(tip * 0.075 + tt * 2.6, o.seed + 13) * 1.45 * (0.55 + 0.45 * v) + Math.sin(tip * 0.033 + tt * 3.4) * 0.65;
        const x = center + q.side * width * 0.72 + noise(tt * 2.1, q.seed) * 1.3;
        flameTongue(p, x, base, h, q.half, q.lean, N, q.seed, fire, undefined, 0.42, 0.9);
      }
      p.fade = prevFade;
    }
    if (hold > 0.02) {
      p.glowLine(0, TOP + 34, 0, Math.min(headY, -18), 16 + width * 0.3, G[2], 0.26 * hold);
      p.glowLine(0, TOP + 8, 0, headY, 5.5, H[0], 0.34 * hold);
    }
    // The final filament starts full and contracts from its footward end up and away.
    if (retract > 0.06) {
      const tip = TOP * (1 - retract);
      p.glowLine(0, tip, 0, 0, 4.5, G[2], 0.28 * (1 - retract));
      p.line(0, tip, 0, 0, G[2], 0.9 * (1 - retract * 0.25));
      p.line(0, tip, 0, 0, G[3], 0.7 * (1 - retract));
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
        const a = alpha * (branch ? 0.76 : 1);
        p.beam(x0, y0, x1, y1, branch ? 1.6 : 4.8, G[0], a * 0.9);
        p.beam(x0, y0, x1, y1, branch ? 1 : 2.7, G[2], a);
        p.line(x0, y0, x1, y1, branch ? G[3] : H[0], a);
        if (!branch && i % 4 === 0 && Math.min(y0, y1) > TOP + 9) p.glowLine(x0, y0, x1, y1, 4.2, G[2], 0.22 * a);
      }
    }
  }

  function ring(p, rx, thickness, sy, alpha, color, roughness = 1) {
    if (alpha <= 0.005 || rx <= 0.5) return;
    const ry = Math.max(1, rx * sy), halfH = Math.min(22, ry + thickness + 2), scaleR = Math.min(rx, ry);
    p.shade(-159, -halfH, 159, Math.min(22, halfH), (x, y, out) => {
      const dx = (x + 0.5) / rx, dy = (y + 0.5) / ry, angle = Math.atan2(dy, dx);
      const wobble = (Math.sin(angle * 13 + t * 7) * 0.36 + Math.sin(angle * 23 - t * 4.5) * 0.24) * roughness;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const edgeDist = Math.abs(dist - 1 - wobble / scaleR) * scaleR;
      if (edgeDist > thickness + 0.4) return;
      out.a = alpha * (edgeDist < thickness * 0.42 ? 1 : 0.72);
      if (edgeDist < 0.55 && t < 0.34) return H[1];
      return edgeDist < thickness * 0.32 || Math.sin(angle * 11 + t * 4) > 0.86 ? G[3] : color;
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
      if (k > 0.02) column.draw(p, TOP + 4, fire, fire, 0.72 * k, 0.24 * k);
      if (t > 0.185 && t < 1.08) {
        const u = clamp01((t - 0.185) / 0.79);
        const r = 5 + 205 * ease.outCubic(u);
        ring(p, r, 3 + 1.6 * (1 - u), 0.115, (1 - smooth(0.72, 1, u)) * (t < 0.31 ? 1 : 0.78), G[2], 1.35);
      }
      if (t > 0.35 && t < 1.83) {
        const fade = 1 - smooth(1.55, 1.84, t);
        ring(p, 43 + 1.5 * Math.sin(t * 5), 1.35, 0.13, 0.72 * fade, G[2], 0.62);
      }
    },
    draw(p) {
      const tt = t;
      if (tt >= 2.79) return;
      shaft(p, tt);
      const boltFade = 1 - smooth(1.62, 2.24, tt);
      if (boltFade > 0.01) for (const q of strikes) {
        const age = tt - (0.1 + q.delay);
        if (age < 0 || age > q.life) continue;
        const u = age / q.life;
        const envelope = Math.sin(Math.PI * u) ** 0.28 * q.flicker * boltFade;
        drawStrike(p, q, envelope, clamp01(u * 7 + 0.18));
      }
      if (tt >= 0.185 && tt < 0.33) {
        const k = 1 - smooth(0.205, 0.33, tt);
        p.glow(0, -1, 18 * (1 - 0.18 * k), H[1], 0.74 * k);
        p.line(-25, -1, 25, -1, H[1], 0.85 * k);
      }
      for (const s of sparks) {
        const age = tt - s.at;
        if (age < 0 || age >= s.life) continue;
        const k = 1 - age / s.life;
        const x = s.x0 + s.vx * age, y = -1 + s.vy * age + 475 * age * age;
        if (y > 0) continue;
        const tail = Math.min(3.8, Math.hypot(s.vx, s.vy) * 0.018) * k;
        p.line(x - s.vx * 0.024, y - s.vy * 0.024, x, y, s.c, k);
        p.dot(x, y, k > 0.55 ? G[3] : s.c, Math.min(1, k * 1.4));
        if (tail > 1.4) p.glow(x, y, tail + 2, s.c, 0.18 * k);
      }
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
