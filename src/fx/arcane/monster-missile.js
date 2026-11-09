// Missile head, ribbon trail and pop recipes adapted from Sprite Fusion's open-source energy bolt
// (https://www.spritefusion.com/pixel-art-vfx/energy), MIT License, Copyright (c) 2026 Hugo Duprez.
// Phantom-beast apparition technique follows the repo's qilin-roar; blast puffs follow flame-slash.
import { Particles, Bits, Lights, P, B, Rng, fit, flare, sparkle, band, clamp, smooth, lerp, ease, noise, TAU, WHITE } from "../../core/index.js";
import { star, sliver, rock } from "../melee/_lib.js";
import { hotFirst, flameTongue, floorLight, simDraw } from "../fire/_lib.js";
import { unlight } from "../shadow/_lib.js";

const T_FIRE = 0.22; // the missile tears out of the demon's mouth / caster's hands
const T_HIT = 0.62; // main impact on the enemy
const T_END = 1.9;

export const meta = {
  name: "Monster missile",
  desc: "A horned demon phantom looms over the caster as a colossal violet magic missile charges, then blasts straight into the enemy, engulfing them in purple fire, shards and shock rings.",
  tags: ["arcane", "monster", "demon", "missile", "projectile", "violet", "boss", "directional", "one-shot"],
  size: [320, 200],
  origin: [70, 168],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#12061f", "#2a0a44", "#4a1170", "#7a1ea8", "#a83ae0", "#cf6cff", "#eab8ff", "#ffffff"],
    seed: 9,
  },
};

// Caster: coil back into a deep crouch, then hurl both arms straight at the enemy
const STAND = { crouch: 3, fx: 11, fy: -21, bx: 9, by: -21, ffx: 7, fbx: -7 };
const COIL = { turn: 0.9, crouch: 7, lean: -3, hy: 1, fx: -8, fy: -18, bx: -5, by: -15, ffx: -4, fbx: 8 };
const COIL2 = { turn: 0.95, crouch: 9, lean: -5, hy: 2, fx: -10, fy: -16, bx: -7, by: -13, ffx: -5, fbx: 9 };
const CAST = { turn: 1.05, crouch: 4, lean: 7, hy: -2, fx: 16, fy: -26, bx: 13, by: -23, ffx: 9, fbx: -8, ghost: 1 };
const HOLD = { turn: 1.02, crouch: 5, lean: 5, hy: -1, fx: 15, fy: -25, bx: 12, by: -22, ffx: 9, fbx: -8 };
const RECOVER = { turn: 1, crouch: 4, lean: 1, fx: 10, fy: -20, bx: 8, by: -19, ffx: 7, fbx: -7 };

export const act = {
  target: { x: 150 },
  poses: [
    [-0.5, STAND],
    [-0.24, COIL],
    [-0.04, COIL2],
    [T_FIRE, CAST, "snap"],
    [0.5, HOLD],
    [1.2, RECOVER],
    [T_END, STAND],
  ],
  hits: [
    { t: T_HIT, stop: 0.12, shake: 0.34, amp: 3.5, push: 6, straw: 26, y: -24, skin: "shadow", shiver: 0.35 },
    { t: 0.74, stop: 0.03, shake: 0.12, amp: 1.6, push: 1.4, straw: 8, y: -22, skin: "shadow" },
    { t: 0.86, stop: 0.04, shake: 0.16, amp: 2, push: 1.8, straw: 10, y: -20, skin: "shadow" },
    { t: 1.3, stop: 0, shake: 0, amp: 0, push: 0, straw: 0, flash: 0, skin: null },
  ],
  dust: [
    { t: T_FIRE, x: -6, n: 6, dir: -1 },
    { t: T_HIT, x: 150, n: 10, dir: 1 },
    { t: T_HIT, x: 142, n: 6, dir: -1 },
  ],
};

const HX0 = 16, HY0 = -26; // muzzle: the caster's thrust hands
const EX = 150, EY = -26; // enemy chest

// Prebake scalloped blast-puff LUTs (chunky pixel clusters) for the engulfment
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

export function create(o) {
  const C = fit(o.palette, 8), H = hotFirst(C);
  const R = new Rng(o.seed), S = o.seed * 23, floor = () => 0;
  const X_MIN = -66, X_MAX = 246, Y_MIN = -164, Y_MAX = 30;

  const ps = new Particles({ rng: R, ground: floor, sparks: [C[7], C[6], C[5], WHITE], haze: C[3] });
  const bits = new Bits({ ground: floor }), lights = new Lights();
  const vst = { light: C[6], body: C[4], shade: C[2], dust: C[3] }; // violet faceted shards

  const hitSpikes = Array.from({ length: 12 }, (_, i) => {
    const base = (i / 12) * TAU + R.range(-0.08, 0.08);
    const mul = Math.abs(Math.cos(base + 0.6)) > 0.92 ? 1.85 : Math.abs(Math.cos(base)) > 0.88 ? 1.45 : i % 2 === 0 ? 1.05 : 0.66;
    return { a: base, len: R.range(15, 24) * mul, w: R.range(1.8, 2.8) };
  });
  const burstSlivers = Array.from({ length: 7 }, (_, i) => ({
    a: -1.4 + (i / 6) * 2.3 + R.range(-0.08, 0.08),
    r: 12 + R.range(0, 6),
    v: R.range(130, 200),
    arc: R.range(0.3, 0.5),
  }));
  const engulf = Array.from({ length: 12 }, (_, i) => {
    const u = i / 11;
    return {
      x0: EX - 8 + u * 16 + R.range(-5, 5),
      y0: EY + 14 - u * 30 + R.range(-4, 4),
      vx: R.range(-16, 26),
      vy: -lerp(14, 52, u) + R.range(-8, 8),
      r0: lerp(9, 6.5, u),
      r1: lerp(13, 10, u),
      t0: T_HIT + u * 0.04 + R.range(0, 0.03),
      life: R.range(0.4, 0.7),
    };
  });

  const followers = [0, 1].map((i) => ({
    i,
    t0: 0.3 + i * 0.06,
    t1: 0.74 + i * 0.12,
    lat: i === 0 ? -12 : 11,
    ph: i * 2.4,
    trail: [],
    hit: -1,
  }));

  let mainTrail = [];
  let t = 0, fired = false, hitDone = false;
  const NZ = (rate, s0, off = 0) => noise(t * rate + off, s0);

  const missilePos = (tt) => {
    const k = clamp((tt - T_FIRE) / (T_HIT - T_FIRE), 0, 1);
    return [lerp(HX0, EX, k), HY0 + Math.sin(k * Math.PI * 2) * 1.5 * (1 - k)];
  };
  const followPos = (f, tt) => {
    const k = clamp((tt - f.t0) / (f.t1 - f.t0), 0, 1);
    return [lerp(HX0, EX, k), HY0 + Math.sin(k * Math.PI) * f.lat + Math.sin(k * 9 + f.ph) * 2 * (1 - k)];
  };

  function ribbon(p, pts, tw, fade, seedTw) {
    const n = pts.length;
    if (n < 2 || fade <= 0) return;
    for (let i = 0; i < n - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const L = Math.hypot(x1 - x0, y1 - y0) || 1;
      const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      for (let d = 0; d < L; d += 0.6) {
        const u = (i + d / L) / (n - 1);
        const x = x0 + ((x1 - x0) * d) / L, y = y0 + ((y1 - y0) * d) / L;
        const a = (1 - u) * 1.9 * fade;
        const w = tw * Math.pow(1 - u, 0.8) + 0.3;
        for (let q = -w; q <= w; q += 0.5) {
          const v = Math.abs(q) / w;
          p.dot(x + nx * q, y + ny * q, v < 0.35 ? (u < 0.3 ? WHITE : C[6]) : v < 0.7 ? (u < 0.45 ? C[6] : C[5]) : u < 0.55 ? C[5] : C[3], a * (v < 0.7 ? 1 : 0.8));
        }
        const ph2 = u * 9 - t * 24 + seedTw;
        const off = Math.sin(ph2) * (w + 1.3);
        if (Math.cos(ph2) > -0.2) p.dot(x + nx * off, y + ny * off, Math.cos(ph2) > 0.4 ? (u < 0.35 ? WHITE : C[6]) : C[4], a);
      }
      if (i % 3 === 0) p.glow(x0, y0, 9 * (1 - i / n) + 3, C[4], 0.28 * (1 - i / n) * fade);
    }
  }

  function missileHead(p, x, y, r) {
    for (let i = 0; i < 4; i++) {
      const a = t * 26 + (i * TAU) / 4, l = r + 4 + 2 * Math.sin(t * 50 + i);
      p.line(x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1), x + Math.cos(a) * l, y + Math.sin(a) * l, C[6]);
    }
    p.circle(x, y, r + 1.4, C[4]);
    p.circle(x, y, r, C[5]);
    p.circle(x, y, r - 1.6, C[6]);
    p.circle(x, y, r - 3.2, WHITE);
    p.glow(x, y, r * 4.4, C[4], 0.5);
    p.glow(x, y, r * 1.6, C[6], 0.45);
  }

  // The horned demon phantom looming over the caster: beast skull in profile, swept horns,
  // socketed burning eyes and a roaring jaw; its neck dissolves into wisps down to the caster
  function drawPhantom(p, k, roar) {
    if (k <= 0.02) return;
    const hx = -2 + roar * 12, hy = -88 - roar * 6;
    p.shade(Math.floor(hx - 44), Math.floor(hy - 40), Math.ceil(hx + 44), Math.ceil(hy + 34), (x, y, out) => {
      const dx = x - hx, dy = y - hy;
      const skull = Math.hypot(dx / 24, dy / 19);
      const brow = Math.hypot((dx - 6) / 17, (dy + 8) / 7); // heavy brow ridge over the eyes
      const muz = Math.hypot((dx - 22) / 15, (dy - 2 - roar * 2) / 8);
      const jaw = Math.hypot((dx - 16) / 13, (dy - 12 - roar * 8) / (4 + roar * 5));
      const neck = Math.hypot((dx + 10) / 13, (dy - 14) / 11);
      const d = Math.min(skull, brow, muz, jaw, neck);
      if (d > 1) return;
      out.a = (d > 0.86 ? 0.85 : 0.66) * k;
      out.c = d > 0.86 ? (dy < -2 ? C[5] : C[4]) : d > 0.62 ? C[3] : d > 0.3 ? C[2] : C[1];
    });
    // two thick swept-back horns (profile): perpendicular-filled, wide base tapering to a point
    for (const [bx, by, ex, ey, cw] of [[-4, -13, -30, -32, 5.2], [8, -15, -10, -38, 4.2]]) {
      const vx = ex - bx, vy = ey - by, L = Math.hypot(vx, vy);
      const ux = vx / L, uy = vy / L, px2 = -uy, py2 = ux;
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        const cx2 = hx + bx + ux * L * u - u * u * 5, cy2 = hy + by + uy * L * u + u * u * 8;
        const w = cw * (1 - u) + 0.5;
        for (let q = -w; q <= w; q += 0.5) {
          const edge = Math.abs(q) > w - 1.2;
          p.dot(cx2 + px2 * q, cy2 + py2 * q, edge ? C[5] : q < 0 ? C[3] : C[2], 0.85 * k);
        }
      }
    }
    // socketed burning eyes
    const fl = 0.75 + 0.25 * noise(t * 21, S + 5);
    for (const [ex2, ey2] of [[9, -4], [19, -2]]) {
      p.dot(hx + ex2 - 1, hy + ey2, C[1], k); p.dot(hx + ex2, hy + ey2 + 1, C[1], k);
      p.dot(hx + ex2, hy + ey2, C[7], k); p.dot(hx + ex2 + 1, hy + ey2, C[6], k);
    }
    p.glow(hx + 14, hy - 3, 12 * fl, C[5], 0.6 * k);
    if (roar > 0.1) {
      // roaring jaw maw: hot throat glow + fangs
      p.glow(hx + 16, hy + 11 + roar * 7, 15 * roar, C[5], 0.6 * roar * k);
      for (let i = 0; i < 4; i++) p.dot(hx + 8 + i * 5, hy + 6 + roar * 2, C[6], 0.8 * k * roar);
    }
    // neck wisps tying the phantom down to the caster's head
    for (let i = 0; i < 3; i++) {
      const wx = hx - 6 + i * 7 + Math.sin(t * 7 + i * 2.1) * 2.5;
      for (let j = 0; j < 5; j++) {
        const wy = hy + 16 + j * 5 + Math.sin(t * 9 + i + j) * 1.5;
        p.dot(wx, wy, j < 2 ? C[3] : C[2], (0.55 - j * 0.1) * k);
      }
    }
  }

  function pop(p, q, x, y, m) {
    if (q < 0.16) {
      const r = 8 * m * (1 - q / 0.16) + 1.5;
      p.circle(x, y, r + 1.5, C[5]);
      p.circle(x, y, r, WHITE);
    }
    if (q < 0.4) {
      const l = 13 * m * (1 - q / 0.4) + 3;
      for (let d = -l; d <= l; d++) {
        const a = Math.abs(d) / l, c = a < 0.3 ? WHITE : a < 0.65 ? C[6] : C[5];
        p.dot(x + d, y, c, 1.15 - a);
        p.dot(x, y + d * 0.7, c, 1.15 - a);
      }
    }
    const rr = 3 + 16 * m * ease.outCubic(q);
    p.ring(x, y, rr + 0.5, Math.max(1, 3 * (1 - q)), q < 0.3 ? WHITE : C[6], (1.2 - q) * (1 - q * 0.55));
  }

  return {
    update(dt) {
      t += dt;
      // charge: violet motes spiral into the caster's coiled hands
      if (t < T_FIRE && R.chance(1.4 * dt * 60)) {
        const a = R.range(0, TAU), d = R.range(18, 44);
        ps.spawn(P.STREAK, HX0 - 6 + Math.cos(a) * d, HY0 + Math.sin(a) * d, -Math.cos(a) * 160, -Math.sin(a) * 160, R.range(0.08, 0.16), R.chance(0.5) ? C[6] : C[5], 1);
      }
      if (!fired && t >= T_FIRE) {
        fired = true;
        lights.add(HX0, HY0, 50, C[5], 0.85, 0.2);
        for (let i = 0; i < 16; i++) {
          const a = R.range(-1.2, 1.2), v = R.range(70, 220);
          ps.spawn(P.SPARK, HX0, HY0, Math.cos(a) * v, Math.sin(a) * v, R.range(0.14, 0.32));
        }
      }
      if (t >= T_FIRE && t < T_HIT) {
        const [x, y] = missilePos(t);
        mainTrail.unshift([x, y]);
        if (mainTrail.length > 22) mainTrail.pop();
        if (R.chance(0.9 * dt * 60)) ps.spawn(P.MOTE, x, y, R.range(-22, 22), R.range(-26, 12), R.range(0.18, 0.4), R.chance(0.5) ? C[6] : C[5], 0.6);
      }
      for (const f of followers) {
        if (t < f.t0 || f.hit >= 0) continue;
        const [x, y] = followPos(f, t);
        f.trail.unshift([x, y]);
        if (f.trail.length > 16) f.trail.pop();
        const k = clamp((t - f.t0) / (f.t1 - f.t0), 0, 1);
        if (k >= 1) {
          f.hit = t;
          lights.add(x, y, 40, C[5], 0.7, 0.2);
          for (let i = 0; i < 10; i++) {
            const a = R.range(0, TAU), v = R.range(60, 190);
            ps.spawn(P.SPARK, x, y, Math.cos(a) * v, Math.sin(a) * v - 26, R.range(0.14, 0.38));
          }
        }
      }
      if (!hitDone && t >= T_HIT) {
        hitDone = true;
        lights.add(EX, EY, 56, C[5], 0.95, 0.5);
        lights.add(EX, EY, 34, WHITE, 0.9, 0.12);
        for (let i = 0; i < 42; i++) {
          const a = R.range(0, TAU), v = R.range(90, 300);
          ps.spawn(P.SPARK, EX, EY, Math.cos(a) * v, Math.sin(a) * v - 26, R.range(0.18, 0.5));
        }
        for (let i = 0; i < 16; i++) {
          const a = R.range(-Math.PI, 0.2), v = R.range(50, 170);
          bits.add({ kind: B.SHARD, x: EX, y: EY, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1, drag: 0.36, bounce: 0.3, life: R.range(0.5, 0.9), a: R.range(0, TAU), va: R.range(-16, 16), s: R.pick([1, 1, 2]) });
        }
        for (let i = 0; i < 14; i++) {
          ps.spawn(P.EMBER, EX + R.range(-10, 10), EY + R.range(-12, 12), R.range(-30, 40), -R.range(20, 80), R.range(0.5, 0.95), R.pick([C[7], C[6], C[4]]), R.chance(0.4) ? 2 : 1);
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
      // scorched violet burn under the enemy's feet
      const q = t - T_HIT;
      if (q >= 0) {
        const k = smooth(0, 0.22, q) * (1 - smooth(1.15, 1.7, t));
        if (k > 0.02) {
          for (let x = -40; x <= 40; x++) {
            const u = x / 40, d = Math.round(4 * (1 - u * u));
            if (d < 1) continue;
            for (let dy = 0; dy < d; dy++) p.blend(EX + x, dy, dy === 0 ? C[3] : C[0], 0.6 * k);
          }
          floorLight(p, EX, 0.5, 56, 8, C[4], 0.34 * k * clamp(1.3 - q * 0.5));
        }
        const rk = q / 0.46;
        if (rk < 1) band(p, EX, 0.5, 12 + 80 * ease.outQuart(rk), 0.18, Math.max(1, 4.6 * (1 - rk)), 1.1 - rk, [C[2], C[4], C[6], C[7]], (g) => Math.sin(g) >= 0, rk < 0.14);
      }
      simDraw(p, ps, H, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;

      // ---- 1) the demon phantom manifests over the coiling caster, then roars the missile out
      const pk = smooth(0, 0.2, t) * (1 - smooth(0.5, 0.85, t));
      const roar = smooth(T_FIRE - 0.02, T_FIRE + 0.16, t) * (1 - smooth(0.5, 0.85, t));
      drawPhantom(p, pk, roar);
      if (t < T_FIRE) {
        const ck = smooth(0, 0.16, t) * (1 - smooth(T_FIRE - 0.04, T_FIRE + 0.04, t));
        sparkle(p, HX0 - 4, HY0, 9 * ck + 2, C[7], C[5], 0.75 * ck);
        p.glow(HX0 - 4, HY0, 26 * ck + 6, C[4], 0.5 * ck);
        // oppressive void around the charging demon
        unlight(p, -60, -150, 40, 6, (x, y) => {
          const dx = (x + 10) / 52, dy = (y + 80) / 70;
          return dx * dx + dy * dy < 1;
        }, 1 - 0.5 * ck);
      }
      // release flash at the hands / demon mouth
      const fq = t - T_FIRE;
      if (fq >= 0 && fq < 0.09) {
        const mk = 1 - fq / 0.09;
        p.ellipse(HX0 + 4, HY0, 11 * mk + 3, 5 * mk + 2, C[6]);
        p.ellipse(HX0 + 6, HY0, 6 * mk + 1.5, 3 * mk + 1, fq < 0.045 ? WHITE : C[7]);
        flare(p, HX0 + 7, HY0, 30 * mk, mk, [C[3], C[5], C[6], WHITE]);
      }

      // ---- 2) the volley: follower ribbons, then the colossal missile straight down the lane
      for (const f of followers) {
        if (t < f.t0) continue;
        const fade = f.hit >= 0 ? 1 - clamp((t - f.hit) / 0.16, 0, 1) : 1;
        ribbon(p, f.trail, 2.2, fade, f.ph);
        if (f.hit < 0) {
          const [x, y] = followPos(f, t);
          missileHead(p, x, y, 3.4);
        }
      }
      if (t >= T_FIRE && t < T_HIT + 0.18) {
        const fade = 1 - smooth(T_HIT, T_HIT + 0.18, t);
        ribbon(p, mainTrail, 3.6, fade, 1.3);
        if (t < T_HIT) {
          const [x, y] = missilePos(t);
          missileHead(p, x, y, 6);
        }
      }

      // ---- 3) HIT RESULT on the enemy: starburst, engulfing violet fire, shards, slivers, rings
      const q = t - T_HIT;
      if (q >= 0) {
        if (q < 0.075) {
          const hot = q < 0.037, hk = 1 - q / 0.075;
          star(p, EX, EY, hitSpikes, hot ? 1 : 1.3, hot ? 1 : 0.6, WHITE, C[6], C[7], C[4]);
          flare(p, EX, EY, 54 * hk, hk, [C[3], C[5], C[6], WHITE]);
          p.beam(EX - 40 * hk, EY, EX + 40 * hk, EY, hot ? 3.6 : 2, WHITE);
        }
        const dk = (q - 0.01) / 0.15;
        if (dk >= 0 && dk < 1) {
          const dr = 14 + 46 * ease.outQuart(dk), dth = Math.max(1.6, 5 * (1 - dk));
          p.shade(EX - dr - 2, EY - dr - 2, EX + dr + 2, EY + dr + 2, (x, y, out) => {
            const e = dr - Math.hypot(x - EX, y - EY);
            if (e < 0 || e > dth || y > -0.5) return;
            const ang = Math.atan2(y - EY, x - EX);
            if (Math.sin(ang * 3.5 + 0.4) < -0.25 + dk * 0.55) return;
            out.c = e < dth * 0.38 ? WHITE : e < dth * 0.72 ? C[7] : C[5];
            out.a = 1;
          });
        }
        if (q >= 0.02 && q < 0.24) {
          const sk = (q - 0.02) / 0.22;
          for (const sl of burstSlivers) sliver(p, EX, EY, sl.a, sl.r + sl.v * (q - 0.02), sl.arc * (1 - 0.4 * sk), sk < 0.4 ? C[6] : sk < 0.75 ? C[5] : C[3], 1 - sk);
        }
        // the enemy engulfed: scalloped violet blast puffs + flames licking up the body
        for (const bc of engulf) {
          const age = t - bc.t0;
          if (age <= 0 || age >= bc.life) continue;
          const u = age / bc.life;
          const drag = (1 - Math.exp(-2.8 * age)) / 2.8;
          const cx = Math.round(bc.x0 + bc.vx * drag), cy = Math.round(bc.y0 + bc.vy * age);
          if (cx < X_MIN + 10 || cx > X_MAX - 10 || cy < Y_MIN + 12 || cy > 8) continue;
          const r = clamp(Math.round(lerp(bc.r0, bc.r1, 1 - Math.pow(1 - u, 2.2))), 1, 17);
          const lut = BLAST_LUTS[r];
          if (!lut.length) continue;
          const cut = 1 - Math.pow(u, 1.32) * 0.85, cool = u * 1.22;
          for (let k2 = 0; k2 < lut.length; k2 += 4) {
            if (lut[k2 + 2] > cut) continue;
            const heat = lut[k2 + 3] - cool;
            const ci = heat > 0.72 ? 7 : heat > 0.48 ? 6 : heat > 0.25 ? 5 : heat > 0.04 ? 4 : heat > -0.18 ? 3 : heat > -0.42 ? 2 : heat > -0.68 ? 1 : 0;
            p.dot(cx + lut[k2], cy + lut[k2 + 1], C[ci], u > 0.75 ? (1 - u) * 4 : 1);
          }
        }
        if (q < 0.5) {
          const gk = 1 - smooth(0.26, 0.5, q);
          if (gk > 0.05) {
            flameTongue(p, EX - 7, EY + 12, 30 * gk, 4.4 * gk, -5, NZ, S + 71, H);
            flameTongue(p, EX + 6, EY + 10, 36 * gk, 4.8 * gk, 4, NZ, S + 83, H);
            flameTongue(p, EX, EY - 6, 26 * gk, 3.6 * gk, 0, NZ, S + 97, H);
          }
        }
        // smouldering violet wisps lift off the burnt enemy
        if (q > 0.3 && q < 1.25) {
          const wk = smooth(0.3, 0.45, q) * (1 - smooth(0.95, 1.25, q));
          for (let i = 0; i < 4; i++) {
            const wx = EX - 9 + i * 6 + Math.sin(t * 6 + i * 2.2) * 3;
            const wy = EY + 8 - ((t - T_HIT - 0.3) * 30 + i * 7) % 42;
            p.dot(wx, wy, C[5], wk * 0.8);
            p.dot(wx, wy - 1, C[6], wk * 0.6);
            p.glow(wx, wy, 6, C[4], 0.22 * wk);
          }
        }
      }
      for (const f of followers) {
        if (f.hit < 0) continue;
        const k = (t - f.hit) / 0.3;
        if (k >= 0 && k < 1) pop(p, k, EX - 4 + f.i * 8, EY + 4 - f.i * 8, 1);
      }

      for (const b of bits.list) rock(p, b, vst);
      simDraw(p, ps, H, "front");
      lights.draw(p);
    },
  };
}
