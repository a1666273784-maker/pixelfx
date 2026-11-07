import { Rng, fit, ease, clamp, loopNoise, TAU } from "../../core/index.js";

const SILK = ["#0a0c10", "#161a20", "#252b33", "#3a4250", "#576273", "#788595", "#a3b0bf", "#c9d4e0", "#e8eef5", "#ffffff"];
const TACK = ["#0d1a24", "#16303d", "#234a5c", "#376f85", "#5aa0b8", "#93cfe0"];
const D = 1.6, RELEASE = 0.12, HIT = 0.30, HX = 15, HY = -24, RANGE = 120, EX = HX + RANGE;
const READY = { x: 0, sa: -0.9, sb: -0.9, crouch: 4, lean: 0, bx: 8, by: -25, ffx: 9, fbx: -8 };
const CHARGE = { ...READY, lean: -4, crouch: 5, fx: HX, fy: HY, bx: 4, by: -23 };
const CAST = { ...READY, lean: 4, crouch: 3, fx: HX, fy: HY, bx: 8, by: -20, ffx: 12, fbx: -9 };
export const meta = {
  name: "Web shot", desc: "A hand spins sticky silk into a three-strand shot, then a trembling web unravels from its rim.",
  tags: ["projectile", "web", "silk", "spider", "directional"], size: [220, 116], origin: [28, 78],
  duration: D, loop: false, fps: 30, bg: "ground", actor: 2,
  options: { silk: SILK, palette: SILK, tack: TACK, seed: 17 },
};
export const act = {
  target: { x: EX + 8 },
  poses: [[-0.48, READY], [-0.20, { ...CHARGE, fx: 4, fy: -29 }], [0, CHARGE],
    [RELEASE, CAST, "snap"], [HIT, CAST], [0.55, { ...CAST, lean: 2 }], [1.25, READY], [D, READY]],
  hits: [{ t: HIT, stop: 0.09, shake: 0.13, amp: 2, push: 1.5, straw: 10, y: HY }],
  dust: [{ t: RELEASE, x: -8, n: 4, dir: -1 }],
};

// Sample actual filaments at <= 2.5 px, including the short perpendicular frays.
function filament(p, length, point, color, alpha = 1) {
  const n = Math.max(1, Math.ceil(length / 2.5)), pts = [];
  for (let i = 0; i <= n; i++) pts.push(point(i / n));
  p.polyline(pts, color, alpha);
}
export function create(o) {
  const C = fit(o.silk, 10), P = o.silk === SILK && o.palette !== SILK ? fit(o.palette, 10) : C, T = fit(o.tack, 6);
  const r = new Rng(o.seed);
  const rays = Array.from({ length: 10 }, (_, i) => ({
    a: i * TAU / 10 + r.range(-0.13, 0.13), len: r.range(23, 29),
    phase: r.range(0, TAU), cut: 0.91 + ((i * 7) % 10) * 0.037 + r.range(0, 0.035), curl: r.range(-1, 1),
  }));
  let t = 0;
  return {
    update(dt) { t += dt; },
    draw(p) {
      if (t >= D) return;
      const age = Math.max(0, t - HIT), web = clamp(age / 0.08), fade = 1 - clamp((t - 1.43) / 0.17);
      // Handful of sticky silk, growing in the first three frames.
      if (t < 0.26) {
        const k = Math.min(1, t / 0.075), a = t < RELEASE ? 1 : 1 - clamp((t - RELEASE) / 0.14);
        p.circle(HX, HY, 1.8 + k * 2.1, P[5], a);
        p.circle(HX - 0.5, HY - 0.8, 1.2 + k * 1.35, P[8], a);
        for (let j = 0; j < 2; j++) p.arc(HX, HY, 4 + j * 1.8, 1, t * 12 + j * 2, t * 12 + j * 2 + 3.1, P[7], a);
        p.glow(HX, HY, 11, P[6], 0.22 * a);
      }
      if (t >= RELEASE) {
        const q = clamp((t - RELEASE) / (HIT - RELEASE));
        const length = RANGE * ease.outExpo(q);
        const taut = 1 - clamp((t - 0.27) / 0.03);
        const cableFade = 1 - clamp((t - 1.32) / 0.1);
        if (cableFade > 0 && length > 0) {
          const main = 3;
          for (let j = 0; j < main; j++) {
            const base = (j - 1) * 1.5;
            const threadLength = length * (1 - clamp((t - (0.96 + j * 0.08)) / 0.25));
            const y = x => HY + base + taut * (1.3 + j * 0.2) * Math.sin(x * 0.12 - t * 20 + j * 2.1);
            if (threadLength > 0) filament(p, threadLength, u => [HX + u * threadLength, y(u * threadLength)], t >= HIT && t < 0.367 ? P[9] : P[7 + j % 2], cableFade);
          }
          const twists = 3;
          for (let j = 0; j < twists; j++) {
            const threadLength = length * (1 - clamp((t - (0.93 + j * 0.08)) / 0.23));
            if (threadLength <= 0) continue;
            filament(p, threadLength, u => {
            const x = u * threadLength;
            return [HX + x, HY + (2.6 + taut) * Math.sin(x * 0.21 - t * 22 + j * TAU / twists)];
          }, P[6 + j % 2], cableFade * 0.8);
          }
          const step = 8;
          for (let x = 5; x < length * (1 - clamp((t - 1.02) / 0.25)) - 2; x += step) {
            const sign = (Math.floor(x / step) % 2) ? 1 : -1;
            const y = HY + sign * (2.5 + taut * Math.sin(x * 0.12 - t * 20));
            filament(p, 2, u => [HX + x + u * 0.5, y + sign * u * 1.5], P[6], cableFade);
          }
          if (t < HIT) {
            p.circle(HX + length, HY, 3, P[6]); p.circle(HX + length + 0.5, HY - 0.5, 1.8, P[9]);
            p.glow(HX + length, HY, 10, P[7], 0.25);
          }
        }
      }
      if (t >= HIT) {
        // Unequal radii and angles give the radial net its organic silhouette.
        for (let i = 0; i < rays.length; i++) {
          const ray = rays[i], len = Math.min(ray.len, Math.sin(ray.a) > 0 ? 22 / Math.sin(ray.a) : ray.len) * ease.outQuart(web), broken = clamp((t - ray.cut) / 0.25);
          if (broken >= 1) continue;
          const a = ray.a, wobble = 0.7 * loopNoise(t * 0.9, 1, i + o.seed);
          const sag = (i === 1 || i === 3 || i === 4) ? clamp((t - 0.58) / 0.45) * 2 : 0;
          const end = 1 - broken;
          filament(p, len * end, u => {
            const v = u * end, curve = Math.sin(Math.PI * v) * (wobble + broken * ray.curl * 4);
            return [EX + Math.cos(a) * len * v - Math.sin(a) * curve, HY + Math.sin(a) * len * v + Math.cos(a) * curve + sag * v * v];
          }, P[t < 0.37 ? 9 : 7], fade);
          if (broken > 0 && broken < 0.75) {
            const x = EX + Math.cos(a) * len * end, y = HY + Math.sin(a) * len * end + sag * end * end;
            filament(p, 2, u => [x - Math.sin(a) * u * 2 * ray.curl, y + Math.cos(a) * u * 2 * ray.curl], P[8], fade);
            p.dot(x + Math.cos(a) * broken * 5, y + Math.sin(a) * broken * 5 + broken * 3, P[7], fade * (1 - broken));
          }
        }
        // Arc bands remain distinct from spokes, then lose sectors from outside inward.
        for (let j = 0; j < 3; j++) {
          const rad = (9 + j * 7) * ease.outQuart(web);
          if (rad < 1) continue;
          if (t < 0.9) p.arc(EX, HY, rad, 1, 0, TAU, P[7], fade);
          else for (let i = 0; i < 10; i++) {
            const cut = rays[i].cut + (2 - j) * 0.07;
            const remain = 1 - clamp((t - cut) / 0.16);
            if (remain > 0) p.arc(EX, HY, rad, 1, i * TAU / 10, (i + remain) * TAU / 10, P[7], fade);
          }
        }
        const drop = clamp((t - 0.38) / 0.9) * 5, ball = 1 - clamp((t - 1.15) / 0.31);
        if (ball > 0) {
          p.circle(EX, HY + drop, 3.4 * ball + 0.6, P[5], fade);
          p.circle(EX - 0.6, HY + drop - 0.7, 2 * ball + 0.3, P[t < 0.65 ? 8 : 6], fade);
        }
        if (t > 1.05) {
          const mist = Math.sin(Math.PI * clamp((t - 1.05) / 0.55));
          const rad = 4 + (t - 1.05) * 7;
          p.disc(EX, HY + drop, rad, P[8], d => 0.32 * mist * (1 - d * d));
          p.disc(EX - 2, HY + drop - 1, rad * 0.6, P[7], d => 0.18 * mist * (1 - d * d));
        }
        if (age < 0.075) {
          const flash = 1 - age / 0.075;
          p.circle(EX, HY, 2 + flash * 3, P[9]);
          p.dot(EX + 4, HY - 3, T[5]); p.dot(EX - 3, HY + 4, T[4]);
          p.glow(EX, HY, 18, T[5], 0.26 * flash);
          p.glow(EX, HY, 8, P[9], 0.35 * flash);
        }
      }
    },
  };
}
