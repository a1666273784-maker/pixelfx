// A self-centred frost detonation: cold drawn in, a white detonation frame, an ice crown torn up from the floor
// that stands, flashes and shatters, needles flung through a fake depth, and frost that crusts, melts and clears.
// The hero flash, the depth-flung shards, the shock lip, the floor cracks and the cold volumes borrow techniques
// from Sprite Fusion's open-source ice and explosion effects
// (https://www.spritefusion.com/pixel-art-vfx/ice, https://www.spritefusion.com/pixel-art-vfx/explosion),
// MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, B, Rng, fit, flare, clamp, smooth, seg, ease, rand, mix, TAU, WHITE } from "../../core/index.js";
import { READY } from "../../core/poses.js";
import { Panes, blade, endBy, splitPoly, flakeDesign, snowflake } from "./_lib.js";

export const meta = {
  name: "Ice burst",
  desc: "Cold winds to a point at his chest and detonates: a snowflake flash, needles blown through the air, blades torn up from the floor, a shattering ring, frost settling to melt.",
  tags: ["ice", "burst", "explosion", "nova", "aoe", "spell", "shockwave", "ground", "one-shot"],
  size: [320, 224],
  origin: [160, 176],
  duration: 3.6,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { palette: ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#dcfbff", "#ffffff"], reach: 128, seed: 9 },
};

const CY = -26; // the cold's heart, at his chest
const GATHER = 0.4; // the last breath before it lets go
const BANG = 0.5; // detonation
const TREMBLE = 1.3, BLADE_FLASH = 1.38, SHATTER = 1.46; // the standing blades
const D = meta.duration;
const F = 540; // the camera's distance, for the fake depth
const CAM = (z) => F / (F - z); // a shard's scale: near ones bigger

// ---- the act: draws himself in, then tears it open
const DRAW_IN = { ...READY, crouch: 6, lean: 4, turn: 1, fx: -2, fy: -30, bx: 5, by: -27, ffx: 4, fbx: -5 };
const COIL = { ...READY, crouch: 9, lean: 7, turn: 1.05, fx: -1, fy: -24, bx: 3, by: -22, ffx: 2, fbx: -3 };
const OPEN = { ...READY, crouch: 7, lean: -3, turn: 1.2, fx: -17, fy: -25, bx: 17, by: -22, ffx: -7, fbx: 8 };
const SETTLE = { ...READY, crouch: 5, lean: 1, fx: -9, fy: -17, bx: 10, by: -17, ffx: -4, fbx: 5 };
export const act = {
  target: { x: 104 },
  poses: [
    [-0.42, READY],
    [-0.16, DRAW_IN],
    [-0.03, COIL],
    [BANG, OPEN, "snap"],
    [BANG + 0.3, { ...OPEN, crouch: 9 }],
    [1.5, SETTLE],
    [2.7, { ...READY, crouch: 4 }],
    [3.6, READY],
  ],
  hits: [
    { t: BANG, stop: 0.12, shake: 0.28, amp: 3, target: false },
    { t: BANG + 0.2, push: 1.9, straw: 12, y: -24, skin: "ice", shiver: 1.3 },
    { t: 2.9, push: 0.15, straw: 0, flash: 0, skin: null },
  ],
  dust: [{ t: BANG, x: -13, n: 6, dir: -1, c: "#d8f2ff" }, { t: BANG, x: 13, n: 6, dir: 1, c: "#d8f2ff" }],
};

/**
 * A needle of ice on screen: base at (x, y) pointing along (ux, uy), L long, w wide, shaded in the ice ramp C with
 * a lit ridge, a dark rim, a white tip and light at the point.
 */
function needle(p, x, y, ux, uy, L, w, C, a, dim) {
  const K = (i) => C[clamp(i - dim, 0, C.length - 1)], px = -uy, py = ux, n = Math.max(2, Math.ceil(L));
  for (let i = 0; i <= n; i++) {
    const u = i / n, half = (w / 2) * Math.pow(1 - u, 1.2) + 0.45, cx = x + ux * u * L, cy = y + uy * u * L;
    for (let o = -half; o <= half; o += 0.5) {
      const edge = Math.abs(o) >= half - 0.7;
      const c = u > 0.82 ? WHITE : edge ? K(0) : Math.abs(o) < 0.5 ? (u < 0.25 ? K(6) : K(5)) : o < 0 ? K(4) : K(2);
      p.dot(cx + px * o, cy + py * o, c, a);
    }
  }
  if (Math.abs(x + ux * L) < 150 && y + uy * L > -46) p.glow(x + ux * L, y + uy * L, 3.5, C[5], 0.35 * a);
}

/**
 * Cold mist: a puff of three overlapping soft discs, lit on its top left by the core, so it reads as a volume instead
 * of a bubble. add(x, y, vx, vy, r, life, seed); update(dt); draw(p).
 */
class Mist {
  constructor(R) {
    this.R = R;
    this.list = [];
  }
  add(x, y, vx, vy, r, life, front = false) {
    this.list.push({ x, y, vx, vy, r, life, max: life, front, ph: this.R.range(0, TAU), lobes: [0, 1, 2].map(() => [this.R.range(-0.38, 0.38), this.R.range(-0.34, 0.34), this.R.range(0.5, 0.72)]) });
  }
  update(dt) {
    const R = this.R;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const q = this.list[i];
      if ((q.life -= dt) <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      q.vx -= q.vx * 2.6 * dt;
      q.vy -= q.vy * 2.6 * dt;
      q.x += q.vx * dt + Math.sin(q.ph + q.life * 2.4) * 5 * dt;
      q.y += q.vy * dt - 7 * dt;
    }
  }
  draw(p, C, front) {
    for (const q of this.list) {
      if (q.front !== front) continue;
      const k = q.life / q.max, sw = 1.45 - k * 0.6, a = Math.pow(k, 1.3) * 0.2;
      if (a < 0.01) continue;
      for (const [ox, oy, rs] of q.lobes) {
        const x = q.x + ox * q.r * sw * 0.9, y = q.y + oy * q.r * sw * 0.9, r = q.r * rs * sw * 1.25;
        p.disc(x, y, r, (d) => (d < 0.5 ? C[5] : C[4]), (d) => a * (d > 0.78 ? 0.5 : d > 0.55 ? 0.85 : 1));
      }
      // the lit cap, a step brighter, offset up and left of the mass
      p.disc(q.x - q.r * 0.3 * sw, q.y - q.r * 0.42 * sw, q.r * 0.5 * sw, C[6], a * 0.5);
      p.glow(q.x, q.y, q.r * 2.4, C[4], 0.035 * a);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed), REACH = o.reach, floor = () => 0;
  const [W, H] = meta.size, [OX, OY] = meta.origin, X0 = -OX + 3, X1 = W - OX - 3, Y0 = -OY + 3, Y1 = H - OY - 3;
  const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], C[3]], haze: C[4] });
  const bits = new Bits({ ground: floor }), lights = new Lights(), scuffs = [], mist = new Mist(R);
  const DIM = C.map((c, i) => C[Math.max(0, i - 2)]), OUTC = C[0];

  const panes = new Panes({
    ground: floor,
    onCrumble: (q) => {
      for (let i = 0; i < 3; i++) bits.add({ kind: B.SHARD, x: q.x + R.range(-2, 2), y: 0, vx: R.range(-40, 40), vy: -R.range(20, 80), g: 0.8, drag: 0.6, bounce: 0.3, life: R.range(0.3, 0.6), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1, 2), c: C[R.int(4, 7)] });
      mist.add(q.x, -2, R.range(-12, 12), -R.range(2, 8), R.range(2, 3.2), R.range(0.4, 0.7));
    },
    onLand: (q, x, y, v) => {
      if (v < 130) return;
      mist.add(x, y - 1, R.range(-18, 18), -R.range(2, 8), R.range(1.6, 2.6), R.range(0.35, 0.6));
      if (R.chance(0.35)) ps.spawn(P.STAR, x, y - 2, 0, -5, R.range(0.2, 0.4), WHITE, R.range(0.8, 1.6));
    },
    onSkid: (q, x) => {
      if (R.chance(0.28)) scuffs.push({ x: Math.round(x + R.range(-1, 1)), t: 0 });
    },
  });

  let t = 0, banged = false, shattered = false;

  // ---- the blast's parts, laid out once
  // needles: an even shell of directions, thrown out through the screen's depth; every few are long spears
  const needles = [];
  for (let i = 0; i < 76; i++) {
    const a = R.range(0, TAU), e = Math.asin(R.range(-0.88, 1)), ce = Math.cos(e), spear = i % 9 === 0, sp = R.range(170, 360) * (spear ? 1.5 : 1);
    needles.push({
      X: 0, Y: 0, Z: 0, vx: ce * Math.cos(a) * sp, vy: Math.sin(e) * sp, vz: ce * Math.sin(a) * sp,
      len: spear ? R.range(22, 36) : R.range(9, 19), w: spear ? R.range(2.8, 4.4) : R.range(1.6, 3.1),
      life: R.range(0.85, 1.9), age: 0, G: R.range(0.55, 0.85), rest: false, delay: spear ? 0.02 : R.range(0, 0.05),
    });
  }
  // a few big snowflakes thrown out with the shell, tumbling and twinkling
  const flakes = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + R.range(-0.3, 0.3), e = R.range(-0.55, 0.9), ce = Math.cos(e), sp = R.range(110, 215);
    flakes.push({ X: 0, Y: 0, Z: 0, vx: ce * Math.cos(a) * sp, vy: Math.sin(e) * sp, vz: ce * Math.sin(a) * sp, r: R.range(3.6, 8), rot: R.range(0, TAU), w: R.sign() * R.range(0.6, 3.2), life: R.range(1.1, 1.9), age: 0, d: flakeDesign(R), tw: R.range(0, TAU) });
  }
  // the crown: clusters of blades torn up from the floor in a starburst, each a tall one leaning out with
  // smaller blades splayed round its foot, tallest inside and falling off toward the rim
  const crown = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + R.range(-0.18, 0.18), rad = 18 + R.range(0, 34), q = rad / REACH, near = 1 + Math.sin(a) * 0.34;
    const H0 = R.range(54, 84) * (1.05 - q * 0.4) * near, W0 = clamp(H0 * R.range(0.21, 0.3), 5, 17);
    const blades = [{ dx: 0, dy: 0, h: H0, w: W0, lean: Math.cos(a) * H0 * R.range(0.26, 0.5), delay: 0, main: true, jag: R.chance(0.6) ? R.range(0.3, 0.58) : -1 }];
    const kids = H0 > 52 ? 2 : 1;
    for (let k = 0; k < kids; k++) {
      const side = k % 2 ? -1 : 1, h = H0 * R.range(0.38, 0.62);
      blades.push({ dx: side * W0 * R.range(0.5, 1.05), dy: side * R.range(0, 3), h, w: W0 * R.range(0.5, 0.7), lean: Math.cos(a) * h * R.range(0.3, 0.85) + side * h * 0.18, delay: R.range(0.03, 0.07), jag: R.chance(0.4) ? R.range(0.3, 0.5) : -1 });
    }
    if (H0 > 50) blades.push({ dx: -Math.sign(Math.cos(a) || 1) * W0 * R.range(0.6, 1), dy: R.range(0, 2), h: H0 * R.range(0.2, 0.34), w: W0 * 0.6, lean: Math.cos(a) * H0 * 0.1, delay: R.range(0.04, 0.08), jag: -1 });
    crown.push({
      a, rad, bx: Math.cos(a) * rad, by: Math.sin(a) * rad * 0.16, h: H0, w: W0, lean: blades[0].lean, back: Math.sin(a) < -0.05,
      t0: BANG + 0.04 + 0.16 * q + R.range(0, 0.03), blades,
    });
  }

  // the floor cracks: radial jagged walks in the floor plane
  const cracks = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + R.range(-0.2, 0.2), len = R.range(58, 124), pts = [];
    let A = a, r = 5;
    while (r < len) {
      A += R.range(-0.17, 0.17);
      r += R.range(2.5, 5.5);
      pts.push([Math.cos(A) * r, Math.sin(A) * r * 0.16, r]);
    }
    const kids = [];
    for (let k = 2; k < pts.length - 2; k++) {
      if (!R.chance(0.3)) continue;
      const [fx, fy, fd] = pts[k];
      let b = A + R.sign() * R.range(0.5, 1), rr = fd, bx = fx, by = fy, path = [[bx, by, fd]];
      for (let j = 0; j < 5; j++) {
        b += R.range(-0.36, 0.36);
        rr += R.range(2, 3.6);
        bx = Math.cos(b) * rr;
        by = Math.sin(b) * rr * 0.16;
        path.push([bx, by, rr]);
      }
      kids.push(path);
    }
    cracks.push({ pts, kids });
  }

  // ---- helpers that read the clock
  const front = (tt) => 8 + (REACH + 14) * ease.outCubic(seg(tt, BANG, BANG + 0.42));
  const gone = () => 1 - smooth(D - 0.5, D - 0.1, t);
  const alive = () => t < D - 0.05;
  // a glow that stops at the stage edge instead of lighting the empty margin past it
  const glowIn = (p, x, y, r, c, k) => {
    const rr = Math.min(r, X1 - Math.abs(x) - 2, y - Y0 - 2, Y1 - y - 2);
    if (rr > 1.5) p.glow(x, y, rr, c, k);
  };

  // the floor: crusted rime. Solid columns of crust with a bright crest, clumped so the top edge steps, a white
  // leading edge while the wave runs, perspective grit behind, tufts standing off the crest
  const drawFrost = (p) => {
    const out = (1 - smooth(2.1, 3.35, t)) * smooth(BANG, BANG + 0.08, t);
    if (out <= 0.02) return;
    const R0 = Math.max(4, REACH * ease.outCubic(seg(t, BANG, BANG + 0.5))), lead = R0 < REACH - 1;
    const fade = clamp(out * 1.15);
    for (let x = -Math.ceil(R0); x <= Math.ceil(R0); x++) {
      const q = Math.abs(x + 0.5) / R0, n = rand(x, 21), n2 = rand(x, 33);
      if (q > 1) continue;
      // a ragged edge: some columns stop short of the wave front
      if (n > 0.94 - q * 0.1) continue;
      const clump = Math.sin(x * 0.34 + Math.sin(x * 0.11) * 2.4), inner = 1 - q;
      // crust height: 1 px at the rim, up to 3 px in the thick of it, stepping in clumps
      const h = 1 + (clump > 0.35 ? 1 : 0) + (inner > 0.55 && n2 > 0.35 ? 1 : 0), rim = lead && R0 - Math.abs(x) < 2.5;
      for (let j = 0; j < h; j++) {
        const top = j === h - 1;
        const c = top ? (rim ? WHITE : n2 > 0.62 ? WHITE : C[6]) : j > 0 ? C[5] : n2 > 0.5 ? C[5] : C[4];
        p.dot(x, -j, c, fade * (top ? 1 : 0.92));
      }
      // shade under the crust and a chip or two proud of it
      // contact shadow right under the crust, so it sits on the floor
      p.dot(x, 1, OUTC, fade * 0.7);
      if (n2 > 0.5) p.dot(x, 2, OUTC, fade * 0.3);
      if (n2 > 0.88) p.dot(x, -h, WHITE, fade * 0.9);
      // rime tufts standing up off the crest, tallest in the middle of the patch
      const L = n > 0.34 ? Math.round((1 + rand(x, 7) * 2.6) * (1 - q * 0.6) * fade) : 0;
      for (let j = 0; j < L; j++) p.dot(x, -h - j, j === L - 1 ? WHITE : C[5], fade * (0.9 - j * 0.2));
    }
    if (out > 0.02) p.shade(-R0, -7, R0, 6, (x, y, o) => {
      const q = Math.hypot(x / R0, y / 5.5);
      if (q >= 1) return;
      o.l = q < 0.5 ? C[4] : C[3];
      o.k = (1 - q) * (1 - q) * 0.26 * out;
    });
    for (const s of scuffs) {
      const a = (1 - s.t / 0.6) * out;
      if (a > 0) p.dot(s.x, 0, s.t < 0.1 ? WHITE : C[5], a), p.dot(s.x, 1, OUTC, a * 0.5);
    }
  };

  // cracks: dark grooves with a white-hot head while they run, cooling to cyan then deep blue
  const drawCracks = (p) => {
    const reach = Math.max(0, (t - BANG) * 700), cool = clamp(1 - (t - BANG) / 1.6);
    if (reach <= 0) return;
    const out = (1 - smooth(2.2, 3.1, t)) * cool;
    if (out <= 0.02) return;
    for (const c of cracks)
      for (const path of [c.pts, ...c.kids])
        for (let i = 1; i < path.length; i++) {
          const [x0, y0, d0] = path[i - 1], [x1, y1, d1] = path[i];
          if (d0 >= reach) break;
          const f = d1 > reach ? (reach - d0) / Math.max(0.01, d1 - d0) : 1, ex = x0 + (x1 - x0) * f, ey = y0 + (y1 - y0) * f, head = d1 > reach - 7;
          p.line(x0, y0 + 1, ex, ey + 1, OUTC, 0.9 * out);
          p.line(x0, y0, ex, ey, head ? WHITE : d0 > 64 ? C[3] : C[5], out);
          if (head) {
            p.dot(ex, ey, WHITE, out);
            p.dot(ex, ey + 1, C[6], out * 0.8);
            glowIn(p, ex, ey + 1, 3.4, C[6], 0.5 * out);
          } else if (i % 2) glowIn(p, (x0 + ex) / 2, (y0 + ey) / 2, 3, C[4], 0.11 * out);
        }
  };

  // the shock ring on the floor, laid out in screen x: at the ellipse's ends the two halves would pile up, so
  // each column gets its band thickness once and the face is chosen by which side of the ring it is on
  const drawRing = (p, back) => {
    const u = seg(t, BANG, BANG + 0.34);
    if (u <= 0 || u >= 1) return;
    const r = front(t), rise = Math.sin(Math.PI * Math.min(1, u * 1.35)) ** 0.7;
    const th = Math.max(1.1, 4.2 * (1 - u) ** 0.75 * smooth(0.01, 0.14, u)), k = (0.5 + 0.45 * smooth(0.03, 0.2, u)) * (0.92 - u * 0.7);
    const sy = 0.16, R = Math.max(2, r), cool = clamp(1.25 - u * 1.6);
    for (let x = -Math.ceil(R); x <= Math.ceil(R); x++) {
      const q = Math.abs(x + 0.5) / (R * (1 + 0.16 * (rand(x, 91) - 0.5)));
      if (q > 1) continue;
      const ey = sy * R * Math.sqrt(1 - q * q); // where the ring's front edge sits in this column
      const n = rand(x, 51), n2 = rand(x, 77);
      // only the near lip of a ground wave is visible: the far side is buried under the crust it raises
      if (back) continue;
      {
        const hh = th * (0.85 + 0.55 * n);
        // the crust front: a solid 1px crest, a body of ice under it, then its own shadow on the floor
        for (let j = 0; j < hh; j += 0.5) {
          const f = 1 - j / hh, c = j < 0.6 ? (n > 0.5 && cool > 0.5 ? WHITE : C[6]) : j < hh * 0.4 ? (cool > 0.4 ? C[6] : C[5]) : j < hh * 0.7 ? C[5] : j < hh * 0.9 ? C[4] : C[2];
          p.dot(x, ey + 1 - j, c, Math.min(1, k * (0.6 + 0.7 * f)));
        }
        p.dot(x, ey + 2, OUTC, k * 0.5);
        // rime teeth standing off the rim, taller near the middle of the wave's arc
        if (q < 0.94 && n2 > 0.52) {
          const hgt = (1 + rand(x, 13) * 3.2) * rise * (0.5 + 0.5 * (1 - Math.abs(q - 0.55)));
          for (let j = 1; j <= hgt; j++) p.dot(x, ey - j, j > hgt - 1.1 ? WHITE : C[5], k * (0.85 - j / (hgt + 1.6)));
        }
        if (n2 > 0.8) p.dot(x, ey + 1, WHITE, k * 0.8);
      }
    }
    if (!back && u > 0.04) p.shade(-R, -6, R, 5, (x, y, o) => {
      const q = Math.hypot(x / R, (y - 1) / 5.5);
      if (q >= 1 || q < 0.7) return;
      o.l = C[4];
      o.k = (1 - q) * 0.42 * (1 - u);
    });
  };

  // the crown: blades erupting in a wave, standing, trembling, flashing white and breaking apart
  const crownPose = (c, b) => {
    const t0 = c.t0 + b.delay, g = ease.outBack(clamp((t - t0) / 0.1), 2.4), m = 1 - smooth(SHATTER, SHATTER + 0.16, t);
    return { g, m, white: t - t0 < 0.035 || (t >= BLADE_FLASH && t < SHATTER) };
  };
  const drawCrown = (p, back) => {
    if (t >= SHATTER) return;
    for (const c of crown) {
      if (t < c.t0 || c.back !== back) continue;
      const jx = t >= TREMBLE && t < BLADE_FLASH ? ((Math.floor(t * 40) + Math.round(c.a * 10)) % 2 ? 1 : 0) : 0;
      for (const b of c.blades) {
        if (t < c.t0 + b.delay) continue;
        const s2 = crownPose(c, b), h = b.h * s2.g * s2.m, lean = b.lean * s2.g * s2.m, x = c.bx + b.dx + jx, y = c.by + b.dy;
        if (h <= 1.5) continue;
        const gl = (t - BANG - 0.62 - (c.rad / REACH) * 0.28) / 0.16;
        blade(p, x, y, x + lean, y - h, b.w * (1 - 0.22 * (1 - s2.m)), back ? DIM : C, {
          white: s2.white, jag: b.jag, dim: back ? 1 : 0, glint: gl >= 0 && gl <= 1 ? gl : -1,
        });
      }
      if (!back) {
        const s2 = crownPose(c, c.blades[0]), pop = clamp(1 - (t - c.t0) / 0.15), wh = t >= BLADE_FLASH && t < SHATTER, h = c.h * s2.g * s2.m;
        p.glow(c.bx + c.lean * 0.4, c.by - h * 0.45, h * 0.5 + 8, C[4], (0.1 + 0.3 * pop + (wh ? 0.12 : 0)) * s2.m);
        if (pop > 0) p.glow(c.bx, c.by - 1, 12, WHITE, 0.5 * pop);
      }
    }
  };

  // the shock in the air: a fast ragged shell, and thin cold streaks sheared off it around the core
  const drawShock = (p, back) => {
    if (t < BANG || t > BANG + 0.3 || back) return;
    const u = seg(t, BANG, BANG + 0.26);
    if (u <= 0 || u >= 1) return;
    const rad = 12 + 66 * ease.outCubic(u), th = Math.max(0.7, 4 * (1 - u));
    const step = TAU / 108;
    for (let a = 0; a < TAU; a += step) {
      const j = 1 + 0.05 * Math.sin(a * 7 + 1.3) + 0.03 * Math.sin(a * 13 - 2.1), r = rad * j;
      const x = Math.cos(a) * r, y = Math.min(CY + Math.sin(a) * r * 0.94, -1);
      for (let o = 0; o < th; o += 0.5) {
        const px2 = x * (1 - o / rad), py2 = CY + (y - CY) * (1 - o / rad);
        if (px2 < X0 + 2 || px2 > X1 - 2 || py2 < Y0 + 2) continue;
        p.dot(px2, py2, o < th * 0.45 ? WHITE : C[5], (1 - u) * 1.15);
      }
    }
    // the streaks: thin cold lines off the core, kept above the floor and inside the stage
    for (let i = 0; i < 54; i++) {
      const a = (i / 54) * TAU + rand(i, 11) * 0.12;
      const ca = Math.cos(a), sa = Math.sin(a), L0 = (18 + rand(i, 5) * 40) * (0.5 + u), L1 = L0 + (22 + rand(i, 7) * 58) * (1 - u * 0.55);
      const k = Math.sin(Math.PI * Math.min(1, u * 1.25)) * 0.95;
      const x0 = ca * L0, y0 = CY + sa * L0, x1 = ca * L1, y1 = CY + sa * L1;
      if (y1 > -1 || Math.abs(x1) > X1 - 2 || y1 < Y0 + 2) continue;
      p.line(x0, y0, x1, y1, (v) => (v > 0.62 ? C[3] : C[6]), k);
    }
  };

  // the snowflake flash: the effect's signature frame, a giant six-armed flake of light over the stage
  const drawFlakeFlash = (p) => {
    const u = seg(t, BANG + 0.02, BANG + 0.26);
    if (u <= 0 || u >= 1) return;
    const grow = ease.outCubic(Math.min(1, u * 1.9)), fade = Math.pow(1 - u, 1.6), rot = 0.16 + u * 0.14;
    // arm length: as long as the stage allows from the heart in each direction, so nothing is clipped away
    const maxR = (a) => { const ca = Math.cos(a), sa = Math.sin(a); let L = Infinity; if (ca > 0.02) L = Math.min(L, (X1 - 6) / ca); if (ca < -0.02) L = Math.min(L, (X0 + 6) / ca); if (sa > 0.02) L = Math.min(L, (-1 - CY) / sa); if (sa < -0.02) L = Math.min(L, (Y0 + 6 - CY) / sa); return Math.max(10, L); };
    const arm = Math.min(122, 74 * (0.55 + 0.45 * grow) + 48 * grow) * 0.86;
    const col = u < 0.24 ? WHITE : mix(WHITE, C[6], Math.min(1, (u - 0.24) / 0.35));
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * TAU) / 6, ca = Math.cos(a), sa = Math.sin(a), L = Math.min(i % 2 ? arm * 0.86 : arm, maxR(a));
      // the arm: a thin wedge, white at the heart of the flake, cooling to cyan at the tip
      for (let d = 4; d <= L; d += 0.5) {
        const q = d / L, half = (3.4 * Math.pow(1 - q, 1.35) + 0.35) * (0.55 + 0.45 * fade);
        for (let o = -half; o <= half; o += 0.5) p.dot(ca * d - sa * o, CY + sa * d + ca * o, q < 0.16 ? WHITE : col, fade);
      }
      // the side branches: two pairs at sixty degrees, each with a small fork at its end
      for (const [u0, bl, fork] of [[0.4, 0.3, true], [0.68, 0.19, true], [0.86, 0.1, false]]) {
        const bx = ca * L * u0, by = CY + sa * L * u0;
        for (const s2 of [-1, 1]) {
          const ba = a + (s2 * Math.PI) / 3, n = Math.min(Math.max(2, L * bl), maxR(ba) * 0.6);
          for (let d = 2; d <= n; d += 0.5) {
            const q = d / n, half = (1.9 * (1 - q) + 0.35) * fade;
            for (let o = -half; o <= half; o += 0.5) p.dot(bx + Math.cos(ba) * d - Math.sin(ba) * o, by + Math.sin(ba) * d + Math.cos(ba) * o, col, fade);
          }
          for (const f2 of fork ? [-1, 1] : []) {
            const fa = ba + f2 * 0.9;
            for (let d = 0; d < n * 0.3; d += 0.5) p.dot(bx + Math.cos(ba) * n + Math.cos(fa) * d, by + Math.sin(ba) * n + Math.sin(fa) * d, col, fade * 0.9);
          }
        }
      }
      p.dot(ca * L, CY + sa * L, WHITE, fade);
    }
    p.circle(0, CY, 11 * (0.55 + 0.45 * fade), u < 0.34 ? WHITE : C[6], fade);
    glowIn(p, 0, CY, 96 * fade + 20, C[5], 0.5 * fade);
  };

  // needles: out through the depth, dragged hard, falling, bouncing off the floor and melting there
  const proj = (q) => {
    const k = CAM(q.Z);
    return { x: q.X * k, y: CY - q.Y * k, k };
  };
  const drawNeedles = (p, back) => {
    if (t < BANG) return;
    const list = needles.filter((n) => n.age > 0 && (n.Z < 0) === back);
    list.sort((a, b) => a.Z - b.Z);
    const out = gone();
    for (const n of list) {
      if (n.age > n.life) continue;
      const { x, y, k } = proj(n), melt = n.rest ? clamp((t - n.melt) / 0.4) : 0;
      const restK = n.rest ? 0.62 * (1 - melt) : 1, a = n.rest ? restK * out * (n.Z < 0 ? 0.78 : 1) : Math.min(1, (n.life - n.age) / 0.25) * out * (n.Z < 0 ? 0.78 : 1);
      const sp = Math.hypot(n.vx, n.vy) || 1, ux = n.vx / sp, uy = -n.vy / sp, L = (n.len + sp * 0.022) * k;
      // a shard half out of the stage is worse than no shard: its whole silhouette has to fit
      if (x - ux * (L + 9) < X0 + 3 || x - ux * (L + 9) > X1 - 3 || x + ux * L * 0.5 > X1 - 3 || x + ux * L * 0.5 < X0 + 3 || y - uy * (L + 9) < Y0 + 3) continue;
      for (let d = 1; d <= 3; d++) p.dot(x - ux * (L + d * 2.6), y - uy * (L + d * 2.6), C[4], a * (0.42 - d * 0.11));
      if (melt > 0.05 && melt < 0.85) p.dot(x, y - L * 0.3, WHITE, 0.8 * Math.sin(Math.PI * melt));
      needle(p, x - ux * L * 0.55, y - uy * L * 0.55, ux, uy, L, n.w * k, C, a, n.Z < 0 ? 2 : 0);
    }
  };
  const drawFlakes = (p, back) => {
    if (t < BANG) return;
    for (const f of flakes) {
      if (f.age <= 0 || f.age > f.life || (f.Z < 0) !== back) continue;
      const { x, y, k } = proj(f), a = Math.min(1, (f.life - f.age) / 0.3) * gone() * (back ? 0.7 : 1);
      const tw = Math.max(0, Math.sin(f.age * 9 + f.tw)) ** 6;
      snowflake(p, x, y, f.r * k, f.rot, f.d, C, { a, hot: Math.max(tw * 0.8, 1 - f.age / 0.2) });
    }
  };
  // the white heart cooling into blue, shrinking hard
  const drawCore = (p) => {
    const u = seg(t, BANG, BANG + 0.3);
    if (u >= 1) return;
    const rr = 15 * Math.pow(1 - u, 1.6) + 1;
    if (u < 0.32) p.circle(0, CY, rr + 2.2, C[5], 1 - u);
    p.circle(0, CY, rr, u < 0.28 ? WHITE : C[6], 1);
    p.glow(0, CY, 50 * (1 - u) + 8, C[5], 0.4 * (1 - u));
  };

  return {
    update(dt) {
      t += dt;
      // gathering: streaks spiral in to the point, mist slides in along the floor, then the last beat crushes it down
      if (t < BANG - 0.015) {
        const squeeze = smooth(GATHER - 0.14, BANG, t);
        if (t < GATHER) {
          if (R.chance(1.0)) {
            const a = R.range(0, TAU), D0 = R.range(24, 66) * (1 - squeeze * 0.5), T = R.range(0.15, 0.26), v = (D0 * 3) / (Math.exp(3 * T) - 1);
            const x = Math.cos(a) * D0, y = Math.min(CY + Math.sin(a) * D0 * 0.85, -2), l = Math.hypot(x, y - CY) || 1;
            ps.spawn(P.STREAK, x, y, (-x / l) * v, ((CY - y) / l) * v, T, R.chance(0.5) ? C[6] : C[5]);
          }
          if (R.chance(0.22)) mist.add(R.sign() * R.range(34, 78), -R.range(0, 2), -R.sign() * R.range(0, 1) * -40, -R.range(0, 3), R.range(1.6, 2.6), R.range(0.4, 0.6));
          if (R.chance(0.24)) ps.spawn(P.FLAKE, R.range(-1, 1) * 46, CY + R.range(-30, 26), R.range(-14, 14), R.range(-10, 10), R.range(0.3, 0.5), C[6], R.range(0.5, 1.1));
        }
      }
      if (!banged && t >= BANG) {
        banged = true;
        lights.add(0, CY, 68, C[4], 0.62, 1.2);
        lights.add(0, CY, 64, WHITE, 1, 0.18);
        lights.add(0, -3, 48, C[3], 0.34, 0.6);
        // the floor takes it: mist blown out flat, dust, grit kicked up
        for (let i = 0; i < 18; i++) {
          const a = R.range(0, TAU), sp = R.range(200, 520), d0 = R.range(14, 56);
          mist.add(Math.cos(a) * d0, -R.range(0, 2), Math.cos(a) * sp, Math.sin(a) * sp * 0.1 - R.range(0, 8), R.range(4, 7.5), R.range(0.6, 1.1));
        }
        for (let i = 0; i < 10; i++) {
          const a = R.range(-Math.PI * 0.8, -Math.PI * 0.2), sp = R.range(120, 320);
          mist.add(Math.cos(a) * 8, CY + Math.sin(a) * 8, Math.cos(a) * sp, Math.sin(a) * sp, R.range(4, 6.5), R.range(0.5, 0.9), true);
        }
        for (let i = 0; i < 34; i++) {
          const a = R.range(0, TAU), sp = R.range(140, 400);
          ps.spawn(P.DUST, Math.cos(a) * 6, -R.range(0, 3), Math.cos(a) * sp, Math.sin(a) * sp * 0.12 - R.range(4, 20), R.range(0.35, 0.7), C[4], R.range(1.8, 3.6));
        }
        // the air takes it: frost and motes thrown out with the needles
        for (let i = 0; i < 44; i++) {
          const a = R.range(0, TAU), sp = R.range(180, 400);
          ps.spawn(P.SPARK, 0, CY, Math.cos(a) * sp, Math.sin(a) * sp - 40, R.range(0.2, 0.5));
        }
        for (let i = 0; i < 34; i++) {
          const a = R.range(-Math.PI, 0.3), sp = R.range(60, 210);
          ps.spawn(P.FLAKE, 0, CY, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.8, 1.5), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.4));
        }
        for (let i = 0; i < 30; i++) {
          const a = R.range(0, TAU), sp = R.range(90, 280);
          ps.spawn(P.MOTE, 0, CY + R.range(-6, 6), Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.22, 0.45), R.pick([C[6], C[5], C[4]]), R.range(0.7, 1.1));
        }
        // heavy ice flung out of the heart, tumbling and skidding
        for (let i = 0; i < 30; i++) {
          const a = R.range(0, TAU), sp = R.range(100, 280);
          bits.add({ kind: R.chance(0.7) ? B.CHUNK : B.SHARD, x: R.range(-4, 4), y: CY + R.range(-4, 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - R.range(40, 150), g: 0.9, drag: 0.5, bounce: 0.35, life: R.range(1.1, 2), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1.3, 2.7), ramp: [C[1], C[3], C[4], C[6], C[7]] });
        }
      }
      // the rolling front keeps shedding mist as it runs
      if (t > BANG && t < BANG + 0.6 && R.chance(26 * dt)) {
        const a = R.range(0, TAU), rr = 18 + 92 * seg(t, BANG, BANG + 0.6);
        mist.add(Math.cos(a) * rr, -R.range(0, 8), Math.cos(a) * R.range(50, 150), -R.range(2, 14), R.range(2, 3.6), R.range(0.5, 0.9));
      }
      // the crown erupts: shards, a puff and a glint at each blade's foot
      for (const c of crown) {
        if (c.up || t < c.t0) continue;
        c.up = true;
        for (const b of c.blades) {
          const bx = c.bx + b.dx, by = c.by + b.dy;
          for (let i = 0; i < 2 + Math.round(b.h / 16); i++) {
            const a = -Math.PI / 2 + R.range(-1.25, 1.25), sp = R.range(60, 220) * (0.5 + b.h / 52);
            bits.add({ kind: B.SHARD, x: bx + R.range(-3, 3), y: by - 1, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.85, drag: 0.6, bounce: 0.3, life: R.range(0.5, 1), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(1.2, 2.6), c: C[R.int(5, 7)] });
          }
          ps.spawn(P.STAR, bx + b.lean * 0.5, by - b.h * 0.62, 0, -4, R.range(0.25, 0.5), WHITE, R.range(0.9, 2.1), R.range(0.02, 0.12));
        }
        mist.add(c.bx, c.by - 1, R.range(-10, 10), -R.range(2, 10), R.range(1.8, 3) * (0.6 + c.h / 62), R.range(0.4, 0.7));
      }
      // standing frost: glints run over the blades, then they tremble
      if (t > BANG + 0.55 && t < TREMBLE && R.chance(0.1)) {
        const c = R.pick(crown);
        if (t > c.t0) ps.spawn(P.STAR, c.bx + c.lean * R.range(0.2, 0.9), c.by - c.h * R.range(0.3, 0.95), 0, -3, R.range(0.25, 0.5), R.chance(0.6) ? WHITE : C[6], R.range(0.6, 2));
      }
      if (!shattered && t >= SHATTER) {
        shattered = true;
        // the whole crown breaks at once: each blade split along its length into toppling panes
        for (const c of crown) {
          if (t < c.t0) continue;
          for (const b of c.blades) {
            const bx = c.bx + b.dx, by = c.by + b.dy, ax = b.lean, ay = -b.h, L = Math.hypot(ax, ay) || 1, nx = -ay / L, ny = ax / L, hw = b.w / 2;
            const tri = [[bx - nx * hw, by - ny * hw], [bx + ax, by + ay], [bx + nx * hw, by + ny * hw]];
            if (tri.some(([x, y]) => Math.abs(x) > X1 - 6 || y < Y0 + 6)) continue;
            const ang = Math.atan2(ay, ax) + Math.PI / 2;
            let parts = [tri];
            // cut the blade up its length, then across, so no piece is bigger than a fist of ice
            for (let k2 = 1; k2 <= 3; k2++) parts = parts.flatMap((poly) => splitPoly(poly, bx + ax * (k2 / 4), by + ay * (k2 / 4), ang));
            parts = parts.flatMap((poly) => {
              const [lo, hi] = [Math.min(...poly.map((q) => q[1])), Math.max(...poly.map((q) => q[1]))];
              return hi - lo > 7 ? splitPoly(poly, bx + ax * 0.5, (lo + hi) / 2, ang + Math.PI / 2) : [poly];
            });
            for (const part of parts) {
              let mx = 0, my = 0;
              for (const [x, y] of part) (mx += x), (my += y);
              (mx /= part.length), (my /= part.length);
              panes.add({
                pts: part.map(([x, y]) => [x - mx, y - my]).map(([x, y]) => [x * 0.92, y * 0.92]), x: mx, y: my, vx: Math.cos(c.a) * R.range(26, 120) + R.range(-22, 22), vy: -R.range(30, 170) * (0.45 + clamp(-my / 40)),
                a: 0, va: R.range(-9, 9), f: R.range(-0.7, 0.7), vf: R.range(-7, 7), lit: c.back ? 0.22 : 0.4,
                g: 0.9, drag: 0.62, bounce: 0.3, solid: true, ridge: Math.atan2(ay, ax), brittle: 1, crumble: R.range(0.14, 0.34), life: R.range(0.5, 0.85),
              });
            }
            for (let i = 0; i < 2 + b.h / 12; i++) {
              const u = R.next();
              bits.add({ kind: R.chance(0.2) ? B.CHUNK : B.SHARD, x: bx + ax * u + R.range(-1.5, 1.5), y: by + ay * u, vx: R.range(-60, 80), vy: -R.range(50, 220), g: 0.9, drag: 0.6, bounce: 0.3, life: R.range(0.5, 1.1), a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(1.2, 3), c: C[R.int(4, 7)], ramp: [C[1], C[3], C[4], C[6], C[7]] });
            }
            mist.add(bx + ax * 0.4, by + ay * 0.4, R.range(-20, 20), -R.range(2, 12), R.range(2, 3.2) * (0.7 + b.h / 62), R.range(0.4, 0.8));
            if (b === c.blades[0]) for (let i = 0; i < 4; i++) mist.add(bx + ax * R.range(0.1, 0.8), by + ay * R.range(0.1, 0.9), R.range(-46, 46), -R.range(0, 30), R.range(3.2, 5.4), R.range(0.8, 1.4));
            if (b === c.blades[0]) for (let i = 0; i < 2; i++) mist.add(bx + ax * 0.3, by + ay * 0.15, R.range(-26, 26), -R.range(4, 16), R.range(5, 7), R.range(1.0, 1.6), true);
            lights.add(bx + ax * 0.5, by + ay * 0.5, 8 + b.h * 0.3, WHITE, 0.16, 0.1);
          }
        }
        for (let i = 0; i < 6; i++) lights.add(R.range(-1, 1) * REACH * 0.7, -14, 22, C[4], 0.2, 0.4);
      }
      // the needles fly, drag out and fall
      for (const n of needles) {
        if (t < BANG || n.age > n.life || n.rest) continue;
        if ((n.delay -= dt) > 0) continue;
        n.age += dt;
        if (n.age > n.life) continue;
        n.vx -= n.vx * 2.6 * dt;
        n.vy -= n.vy * 2.6 * dt;
        n.vz -= n.vz * 2.6 * dt;
        n.vy -= 720 * n.G * dt;
        n.X += n.vx * dt;
        n.Y += n.vy * dt;
        n.Z += n.vz * dt;
        const k = CAM(n.Z), sx = n.X * k, sy = CY - n.Y * k;
        // the floor is world Y = CY / k; below it the needle lands
        if (n.Y < CY / k + 0.5) {
          n.Y = CY / k + 0.5;
          if (R.chance(0.55)) mist.add(sx, -1, n.vx * 0.2 + R.range(-14, 14), -R.range(2, 8), R.range(1, 2.2), R.range(0.25, 0.5));
          if (R.chance(0.35)) bits.add({ kind: B.SHARD, x: sx, y: -1, vx: n.vx * 0.2 + R.range(-30, 30), vy: -R.range(20, 70), g: 0.8, drag: 0.6, bounce: 0.3, life: R.range(0.3, 0.55), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(0.9, 1.8), c: C[R.int(4, 7)] });
          if (Math.abs(n.vy) > 100) {
            n.vy = -n.vy * 0.26;
            n.vx *= 0.6;
            n.vz *= 0.6;
            n.Y += 0.4;
          } else {
            n.rest = true;
            // it sits in the frost a while, then melts from the tip down, rim first
            n.melt = 1.9 + R.range(0, 0.9) + (Math.abs(n.X) / REACH) * 0.5 + (n.Z < 0 ? 0.2 : 0);
            n.life = Math.min(n.life, n.age + R.range(0.3, 0.8));
          }
        }
        if (sx < X0 - 6 || sx > X1 + 6 || sy < Y0 - 6 || sy > Y1 + 6) n.life = 0;
        const nk = CAM(n.Z), nx2 = n.X * nk, ny2 = CY - n.Y * nk;
        if (Math.abs(nx2) > X1 - 2 || ny2 < Y0 + 2) n.life = 0;
      }
      for (const f of flakes) {
        if (t < BANG || f.age > f.life) continue;
        f.age += dt;
        f.vx -= f.vx * 2.4 * dt;
        f.vy -= f.vy * 2.4 * dt;
        f.vz -= f.vz * 2.4 * dt;
        f.vy -= 520 * dt;
        f.X += f.vx * dt;
        f.Y += f.vy * dt;
        f.Z += f.vz * dt;
        f.rot += f.w * dt;
        const k2 = CAM(f.Z);
        if (f.Y < CY / k2 + 2) (f.Y = CY / k2 + 2), (f.vy *= -0.2), (f.vx *= 0.5), (f.vz *= 0.5), (f.life = Math.min(f.life, f.age + 0.6));
        // a flake that gets too close to the lens or too far reads as a smear: it is gone
        const px2 = f.X * k2, py2 = CY - f.Y * k2;
        if (f.Z > 210 || f.Z < -320 || Math.abs(px2) > X1 + 10 || py2 < Y0 + 4) f.life = 0;
      }
      for (const s of scuffs) s.t += dt;
      // the tail: glints crawl over the frozen floor, and the last chunks drop off the broken crown
      if (t > 1.5 && t < 2.9 && R.chance(0.55)) {
        const a = R.range(0, TAU), d = R.range(0.2, 1) * REACH;
        ps.spawn(P.STAR, Math.cos(a) * d, -R.range(0, 2.5), 0, -3, R.range(0.2, 0.45), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.6));
      }
      if (t > 1.5 && t < 2.4 && R.chance(0.3)) {
        const c = R.pick(crown), b = R.pick(c.blades), u = R.range(0.2, 0.8);
        bits.add({ kind: B.SHARD, x: c.bx + b.dx + b.lean * u, y: c.by + b.dy - b.h * u, vx: R.range(-14, 14), vy: R.range(-6, 16), g: 0.9, drag: 0.3, bounce: 0.2, life: R.range(0.5, 0.9), a: R.range(0, TAU), va: R.range(-14, 14), s: R.range(1, 2), c: C[R.int(4, 7)] });
      }
      // a little snow settles out of the cold air
      if (t > BANG + 0.5 && t < BANG + 1.7 && R.chance(0.12)) ps.spawn(P.FLAKE, R.range(-1, 1) * REACH, -R.range(70, 140), R.range(-4, 4), R.range(12, 26), R.range(1, 1.6), R.chance(0.5) ? WHITE : C[6], R.range(0.5, 1.2));
      // thin mist lifting off the frozen floor
      if (t > BANG + 0.25 && t < 2.7 && R.chance(0.1)) mist.add(R.range(-1, 1) * REACH * 0.8, -R.range(0, 3), R.range(-6, 6), -R.range(3, 9), R.range(2, 3.4), R.range(0.6, 1));
      ps.update(dt);
      mist.update(dt);
      bits.update(dt);
      panes.update(dt);
      lights.update(dt);
      // nothing may live past the end: drop anything that runs out of the stage
      for (let i = ps.list.length - 1; i >= 0; i--) {
        const q = ps.list[i];
        if (q.x < X0 - 8 || q.x > X1 + 8 || q.y < Y0 - 8 || q.y > Y1 + 8) ps.list.splice(i, 1);
      }
      for (let i = bits.list.length - 1; i >= 0; i--) {
        const q = bits.list[i], r = q.s * 0.6 + 1;
        if (q.x < X0 + r || q.x > X1 - r || q.y < Y0 + r) bits.list.splice(i, 1);
      }
      for (let i = panes.list.length - 1; i >= 0; i--) {
        const q = panes.list[i];
        let far = Math.abs(q.x) > X1 - 4 || q.y < Y0 + 4;
        for (const [x, y] of panes.corners(q)) if (Math.abs(x) > X1 || y < Y0) far = true;
        if (far) panes.list.splice(i, 1);
      }
      for (let i = ps.list.length - 1; i >= 0; i--) {
        const q = ps.list[i];
        if (q.y > 3 || Math.abs(q.x) > X1 - 2) ps.list.splice(i, 1);
      }
      // mist and flakes are soft volumes: once their edge would cross the stage they are pulled, not clipped
      for (let i = mist.list.length - 1; i >= 0; i--) {
        const q = mist.list[i];
        if (Math.abs(q.x) > X1 - q.r * 2.2 || q.y < Y0 + q.r * 2.2) mist.list.splice(i, 1);
      }
      endBy(t, D, ps, bits, panes);
    },
    drawBack(p) {
      if (!alive()) return;
      drawFrost(p);
      drawCracks(p);
      drawRing(p, true);
      drawCrown(p, true);
      mist.draw(p, C, false);
      drawNeedles(p, true);
      drawFlakes(p, true);
      panes.draw(p, C);
      ps.draw(p, "back");
    },
    draw(p) {
      if (!alive()) return;
      // the light the frost keeps in the floor
      const pool = (1 - smooth(2.2, D - 0.1, t)) * 0.3;
      if (pool > 0) p.shade(-REACH, -10, REACH, 8, (x, y, o) => {
        const d = Math.hypot(x / (REACH * 0.92), y / 6);
        if (d >= 1) return;
        const f = 1 - d;
        o.l = C[3];
        o.k = f * f * pool;
      });
      if (t < BANG) {
        // the gathering: a hard little star at the heart, spinning up, inside a ring that contracts
        const k = clamp(t / BANG), beat = 1 + 0.34 * Math.exp(-(((t - BANG * 0.55) ** 2) / 0.003)) + 0.44 * Math.exp(-(((t - BANG * 0.9) ** 2) / 0.0012));
        // the crush: in the last two frames everything stops and collapses to a spark
        const crush = smooth(GATHER, BANG - 0.005, t), r = (1.8 + 5.4 * k * k) * beat * (1 - crush * 0.85);
        for (let i = 0; i < 6; i++) {
          const a = t * 3.2 + (i / 6) * TAU, L = r * (i % 2 ? 1 : 1.8);
          p.line(0, CY, Math.cos(a) * L, CY + Math.sin(a) * L * 0.9, i % 2 ? C[6] : WHITE);
        }
        p.dot(0, CY, WHITE);
        glowIn(p, 0, CY, 8 + 24 * k * (1 - crush * 0.75), C[4], (0.22 + 0.5 * k) * (1 - crush * 0.6));
        glowIn(p, 0, CY, 3 + 7 * k, WHITE, 0.35 + 0.5 * k);
        const cr = (1 - k) * 48;
        for (let i = 0; i < 44; i++) {
          const a = (i / 44) * TAU, yy = Math.sin(a) * cr * 0.16;
          p.dot(Math.cos(a) * cr, yy, i % 3 ? C[4] : C[6], (0.45 + 0.4 * k) * (1 - crush));
        }
        // the floor freezes outward from his feet as the cold builds, and the crust cracks in a tight star
        const fr = 6 + 40 * Math.pow(k, 1.5);
        for (let x = -Math.ceil(fr); x <= Math.ceil(fr); x++) {
          const q = Math.abs(x + 0.5) / fr, n = rand(x, 31);
          if (q > 1 || n > 0.9 - q * 0.16) continue;
          const a = (0.2 + 0.55 * k) * clamp((1.02 - q) / 0.14) * (0.6 + 0.4 * n);
          p.dot(x, 0, q > 0.92 ? C[6] : n < 0.2 ? WHITE : C[5], a);
          if (n < 0.4) p.dot(x, -1, C[5], a * 0.45);
        }
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU + 0.2, L = fr * (0.5 + rand(i, 3) * 0.5) * 0.6;
          for (let d = 2; d < L; d += 0.5) p.dot(Math.cos(a) * d, Math.sin(a) * d * 0.14, d > L * 0.7 ? C[4] : C[5], 0.55 * k);
        }
        // cold streaming in: short dashes on the floor, drawn inward, faster as the charge fills
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * TAU + rand(i, 17) * 0.2, d0 = 20 + rand(i, 7) * 74 + 26 * (1 - k);
          const ca = Math.cos(a), sa = Math.sin(a) * 0.16, L = 5 + rand(i, 9) * 7 + 8 * k;
          for (let d = 0; d < L; d += 0.5) p.dot(ca * (d0 - d), sa * (d0 - d), d < L * 0.4 ? WHITE : C[5], (0.3 + 0.6 * k) * (1 - d / L) * (1 - crush));
        }
        glowIn(p, 0, -1, 44, C[4], 0.12 + 0.16 * k);
        return;
      }
      // the detonation: one frame of white over the whole stage, then the snowflake flash
      const q = t - BANG;
      if (q < 1 / 45) {
        // the detonation frame: a hard white heart, rays flung to every edge, and light over the whole stage
        p.circle(0, CY, 30, WHITE, 1);
        p.circle(0, CY, 24, WHITE, 1);
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * TAU + rand(i, 21) * 0.1, ca = Math.cos(a), sa = Math.sin(a);
          const L = Math.min(X1 - 4, Y1 - 4) * (0.7 + rand(i, 5) * 0.7), w = 1.4 + rand(i, 9) * 2.2;
          for (let d = 16; d < L; d += 0.5) {
            const hw = w * (1 - d / L);
            for (let o = -hw; o <= hw; o += 0.5) {
              const x = ca * d - sa * o, y = CY + sa * d * 0.92 + ca * o * 0.92;
              if (x < X0 + 2 || x > X1 - 2 || y < Y0 + 2 || y > Y1 - 2) continue;
              p.dot(x, y, d < 34 ? WHITE : C[6], d < 34 ? 1 : 0.85 * (1 - (d - 34) / (L - 34)));
            }
          }
        }
        glowIn(p, 0, CY, 110, WHITE, 1.1);
        return;
      }
      drawFlakeFlash(p);
      drawRing(p, false);
      drawCrown(p, false);
      drawShock(p, false);
      drawCore(p);
      if (q < 0.15) flare(p, 0, CY, 104 * Math.pow(1 - q / 0.15, 1.4), 1 - q / 0.15, C);
      drawNeedles(p, false);
      drawFlakes(p, false);
      mist.draw(p, C, true);
      bits.draw(p);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
