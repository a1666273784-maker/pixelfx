import { hex } from "../../core/index.js";

const C = ["#2a0608", "#6e1014", "#b01c1a", "#e0481f", "#f58a24", "#ffe9a8"].map(hex);
const G = ["#5c3c06", "#b8860f", "#ffd23c", "#fffbe0"].map(hex);
const CORE = ["#fff1c4", "#ffffff"].map(hex);
const EDGE = hex("#170b10");

export const meta = {
  name: "Qilin lightfall",
  desc: "A crimson-gold pillar strikes the ground, held by jagged lightning as a flat shock ring races outward.",
  tags: ["fire", "lightning", "pillar", "impact"],
  size: [320, 200], origin: [160, 176], duration: 2.8, loop: false, fps: 30,
  bg: "dark", options: { seed: 1 },
};

// Integer hash: stable even when frames are requested out of order.
function hash(a, b, seed) {
  let n = Math.imul(a + 101, 374761393) + Math.imul(b + 71, 668265263) + Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// Sampling the ellipse with 1px segments preserves hard edges, including at the canvas crop.
function ring(p, r, thick, color, accent) {
  const n = Math.ceil(r * 7), sy = 0.105;
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n;
    const x = Math.round(Math.cos(a) * r), y = Math.round(Math.sin(a) * r * sy);
    for (let j = 0; j < thick; j++) {
      const yy = y + j;
      if (x >= -160 && x <= 159 && yy >= -176 && yy <= 23)
        p.px(x, yy, accent && j === 0 ? accent : color);
    }
  }
}

function lightning(p, t, seed) {
  if (t < 0.15 || t >= 2.45) return;
  const frame = Math.floor(t * 30 + 1e-6), phase = Math.floor((frame - 4) / 5);
  // New zigzags every five frames; the pair guarantees continuous visible lightning.
  for (let b = 0; b < 2; b++) {
    const side = b ? 1 : -1, pts = [];
    for (let k = 0; k <= 8; k++) {
      const x = side * (77 + 18 * hash(k, phase * 3 + b, seed) - k * 2.7);
      pts.push([Math.round(x), -176 + k * 22]);
    }
    for (let pass = 0; pass < 3; pass++) {
      if (pass === 2 && (frame - 4) % 5 >= 2) continue;
      const c = pass === 0 ? C[2] : pass === 1 ? G[2] : CORE[1];
      const w = pass === 0 ? (b ? 2 : 3) : pass === 1 ? 1 : 0;
      for (let j = -w; j <= w; j++) for (let k = 1; k < pts.length; k++)
        p.line(pts[k - 1][0] + j, pts[k - 1][1], pts[k][0] + j, pts[k][1], c);
    }
    // One short first-order fork, with the same red/gold/white hierarchy.
    const q = pts[4], x = q[0] + side * 17, y = q[1] + 27;
    p.line(q[0] + side, q[1], x + side, y, C[2]);
    p.line(q[0], q[1], x, y, (frame - 4) % 5 < 2 ? CORE[0] : G[2]);
  }
}

export function draw(p, t, o) {
  if (t < 0 || t >= meta.duration) return;
  // Runtime stepping accumulates floating-point error at exact frame boundaries.
  t += 1e-8;
  const seed = o.seed ?? 1;
  if (t < 0.2) {
    const r = 3 + 13 * t / 0.2;
    p.ellipse(0, 0, r, 2 + r * 0.12, t < 0.1 ? G[1] : G[2]);
    if (t >= 0.1) p.ellipse(0, 0, r * 0.5, 1.5, G[3]);
  }
  if (t >= 0.2 && t < 2.8) {
    const retreat = Math.max(0, (t - 2.45) / 0.35);
    const width = (62 + 3 * Math.sin((t - 0.2) * 2.4)) * (1 - retreat);
    const bottom = -Math.floor(176 * retreat * retreat);
    const dark = retreat > 0.62 ? 2 : retreat > 0.3 ? 1 : 0;
    for (let y = -176; y <= bottom && width >= 1; y++) {
      const center = 3 * Math.sin(t * 2.8 + y * 0.014) + 1.5 * Math.sin(y * 0.045 - t * 2.3);
      const tooth = Math.floor(y / 6);
      const left = Math.round(center - width + 2 * hash(tooth, 1, seed));
      const right = Math.round(center + width - 2 * hash(tooth, 2, seed));
      const span = right - left + 1;
      p.rect(left, y, span, 1, EDGE);
      const cols = [C[1], C[2], C[3], C[4], C[5], CORE[0], CORE[1]];
      const fractions = [0.96, 0.86, 0.7, 0.5, 0.29, 0.15, 0.055];
      const drift = 4 * Math.sin(t * 3.2 + y * 0.012);
      for (let i = 0; i < fractions.length; i++) {
        const w = Math.max(1, Math.round(span * fractions[i]));
        p.rect(Math.round(center + drift * (i / 6) - w / 2), y, w, 1, cols[Math.max(0, i - dark)]);
      }
    }
    // Long, downward-travelling block facets stay inside the pillar, never in the background.
    if (retreat < 0.7) for (let i = 0; i < 26; i++) {
      const x = Math.round((hash(i, 3, seed) - 0.5) * width * 1.45);
      const len = 12 + Math.floor(hash(i, 4, seed) * 32);
      const y = -176 + ((Math.floor(t * (65 + i * 3)) + i * 37) % 190);
      const h = Math.min(len, bottom - y + 1, -y + 1);
      if (h > 0 && Math.abs(x) < width * 0.78) p.rect(x, y, 2 + (i % 4), h, Math.abs(x) < width * 0.24 ? C[5] : Math.abs(x) < width * 0.5 ? C[4] : C[3]);
    }
  }
  lightning(p, t, seed);
  if (t >= 0.2 && t < 0.9) {
    const u = (t - 0.2) / 0.7;
    ring(p, 30 + 170 * u, u < 0.3 ? 3 : u < 0.65 ? 2 : 1, u < 0.45 ? C[3] : C[2], u < 0.55 ? G[2] : null);
  }
  if (t >= 0.9 && t < 1.6) ring(p, 150, 1, t < 1.4 ? G[2] : t < 1.53 ? G[1] : G[0], null);

  // The explicitly requested three short sprays are impact sparks, not ambient particles.
  for (const start of [0.62, 1.02, 1.42]) {
    const age = t - start;
    if (age < 0 || age >= 0.23) continue;
    for (let i = 0; i < 12; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (58 + (90 + 150 * hash(i, start * 100, seed)) * age);
      const y = -1 - (75 + 100 * hash(i, 8, seed)) * age + 230 * age * age;
      p.line(x, y, x - side * (4 + (i % 4)), y + 1, age < 0.1 ? G[2] : G[1]);
    }
  }
  // A small ground ember, cooling by color steps, dies before the final frame.
  if (t >= 2.45 && t < 2.76) {
    const r = 12 * (1 - (t - 2.45) / 0.31);
    p.ellipse(0, 0, r, 1.5, t < 2.62 ? C[3] : C[1]);
  }
}
