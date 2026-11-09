// Soul-flame head & tongue recipe adapted from the repo's will-o'-the-wisp (critters/wisp), the ribbon trail and
// pop from its energy bolt (arcane/arcane-missiles), and the curling soul threads from melee/scythe-reap — all
// building on Sprite Fusion's open-source fire & energy VFX, MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, B, Rng, fit, flare, sparkle, clamp, smooth, lerp, ease, noise, TAU, WHITE } from "../../core/index.js";
import { star, sliver, rock } from "../melee/_lib.js";
import { hotFirst, flameTongue, floorLight, simDraw } from "../fire/_lib.js";
import { unlight } from "../shadow/_lib.js";

const T_LAUNCH = 0.3; // the wisp tears away from its condensation point
const T_HIT = 0.62; // main ghost-fire detonation on the target
const T_END = 1.85;

export const meta = {
  name: "Ghostfire strike",
  desc: "A green will-o'-the-wisp condenses, streaks across trailing soul-flame with three follower wisps, and detonates on the target in a ghost-fire bloom, shards and rising souls.",
  tags: ["shadow", "ghost", "wisp", "soul", "fire", "green", "projectile", "volley", "one-shot"],
  size: [320, 184],
  origin: [160, 126],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#03140c", "#06351d", "#0b6231", "#17a04b", "#35d968", "#86ff9d", "#d6ffe2", "#ffffff"],
    seed: 5,
  },
};

const SX = -132, SY = -50; // condensation nucleus (off-caster side)
const TX = 96, TY = -50; // impact point: dead-straight horizontal shot line

export function create(o) {
  const C = fit(o.palette, 8), H = hotFirst(C);
  const R = new Rng(o.seed), S = o.seed * 17, floor = () => 0;
  const X_MIN = -154, X_MAX = 154, Y_MIN = -122, Y_MAX = 54;

  const ps = new Particles({ rng: R, ground: floor, sparks: [C[6], C[5], C[4], WHITE], haze: C[3] });
  const bits = new Bits({ ground: floor }), lights = new Lights();
  const gst = { light: C[6], body: C[4], shade: C[2], dust: C[3] }; // faceted ghost-fire shards

  const hitSpikes = Array.from({ length: 12 }, (_, i) => {
    const base = (i / 12) * TAU + R.range(-0.08, 0.08);
    const mul = Math.abs(Math.cos(base + 0.6)) > 0.92 ? 1.85 : Math.abs(Math.cos(base)) > 0.88 ? 1.45 : i % 2 === 0 ? 1.05 : 0.66;
    return { a: base, len: R.range(13, 21) * mul, w: R.range(1.8, 2.8) };
  });
  const burstSlivers = Array.from({ length: 7 }, (_, i) => ({
    a: -1.4 + (i / 6) * 2.3 + R.range(-0.08, 0.08),
    r: 12 + R.range(0, 6),
    v: R.range(120, 190),
    arc: R.range(0.3, 0.5),
  }));

  // flight paths: accelerating sweep from the nucleus to the target with an upward bulge
  // dead-straight parallel shot lines: constant speed, constant lateral offset
  const path = (u, lat) => [lerp(SX, TX, u), lerp(SY, TY, u) + lat];
  const followers = [0, 1, 2].map((i) => ({
    i,
    t0: 0.34 + i * 0.05,
    t1: 0.64 + i * 0.05,
    lat: [-16, 14, -9][i],
    ph: i * 2.1,
    trail: [],
    hit: -1,
  }));

  const souls = [];
  const pops = [];
  let mainTrail = [];
  let flightHead = null;
  let t = 0, launched = false, hitDone = false;

  const NZ = (rate, s0, off = 0) => noise(t * rate + off, s0);

  function wispHead(p, x, y, r, flick) {
    // cold soul-flame ball: white-green heart, flickering rim (wisp recipe)
    p.shade(Math.floor(x - r - 3), Math.floor(y - r - 3), Math.ceil(x + r + 3), Math.ceil(y + r + 3), (px, py, out) => {
      const dx = px - x, dy = py - y;
      const ang = Math.atan2(dy, dx);
      const rr = r + 0.9 * noise(ang * 1.6 + t * 9, S + 3) + (dy > 0 ? -0.5 : 0.4) * flick;
      const d = Math.hypot(dx, dy) / rr;
      if (d > 1) return;
      out.a = 1;
      out.c = d < 0.3 ? C[7] : d < 0.55 ? C[6] : d < 0.8 ? C[5] : C[4];
    });
  }

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
          p.dot(x + nx * q, y + ny * q, v < 0.35 ? (u < 0.3 ? WHITE : C[6]) : v < 0.7 ? (u < 0.45 ? C[6] : C[5]) : u < 0.55 ? C[5] : C[4], a * (v < 0.7 ? 1 : 0.8));
        }
        // one strand twisting round the trail: bright coming round the front
        const ph2 = u * 9 - t * 24 + seedTw;
        const off = Math.sin(ph2) * (w + 1.3);
        if (Math.cos(ph2) > -0.2) p.dot(x + nx * off, y + ny * off, Math.cos(ph2) > 0.4 ? (u < 0.35 ? WHITE : C[6]) : C[4], a);
      }
      if (i % 3 === 0) p.glow(x0, y0, 10 * (1 - i / n) + 3, C[4], 0.3 * (1 - i / n) * fade);
    }
  }

  function pop(p, q, x, y, big) {
    const m = big ? 1.5 : 1;
    if (q < 0.16) {
      const r = (9 * m) * (1 - q / 0.16) + 1.5;
      p.circle(x, y, r + 1.5, C[5]);
      p.circle(x, y, r, WHITE);
    }
    if (q < 0.4) {
      const l = (15 * m) * (1 - q / 0.4) + 3;
      for (let d = -l; d <= l; d++) {
        const a = Math.abs(d) / l, c = a < 0.3 ? WHITE : a < 0.65 ? C[6] : C[5];
        p.dot(x + d, y, c, 1.15 - a);
        p.dot(x, y + d * 0.7, c, 1.15 - a);
      }
    }
    const rr = 3 + (18 * m) * ease.outCubic(q);
    p.ring(x, y, rr + 0.5, Math.max(1, 3 * (1 - q)), q < 0.3 ? WHITE : C[6], (1.2 - q) * (1 - q * 0.55));
  }

  return {
    update(dt) {
      t += dt;
      if (t < T_LAUNCH && R.chance(1.3 * dt * 60)) {
        const a = R.range(0, TAU), d = R.range(26, 62);
        ps.spawn(P.STREAK, SX + Math.cos(a) * d, SY + Math.sin(a) * d * 0.7, -Math.cos(a) * 150, -Math.sin(a) * 104, R.range(0.1, 0.2), R.chance(0.5) ? C[5] : C[6], 1);
      }
      if (!launched && t >= T_LAUNCH) {
        launched = true;
        lights.add(SX, SY, 54, C[5], 0.8, 0.2);
        for (let i = 0; i < 14; i++) {
          const a = R.range(0, TAU), v = R.range(60, 190);
          ps.spawn(P.SPARK, SX, SY, Math.cos(a) * v, Math.sin(a) * v, R.range(0.15, 0.35));
        }
      }
      // main wisp flight
      if (t >= T_LAUNCH && t < T_HIT) {
        const k = clamp((t - T_LAUNCH) / (T_HIT - T_LAUNCH), 0, 1);
        const [x, y] = path(k, 0);
        mainTrail.unshift([x, y]);
        if (mainTrail.length > 26) mainTrail.pop();
        if (R.chance(0.85 * dt * 60)) ps.spawn(P.MOTE, x, y, R.range(-24, 24), R.range(-30, 10), R.range(0.2, 0.42), R.chance(0.5) ? C[6] : C[5], 0.6);
        if (R.chance(0.5 * dt * 60)) ps.spawn(P.SMOKE, x + R.range(-4, 4), y + R.range(-2, 4), R.range(-10, 10), -R.range(6, 20), R.range(0.4, 0.8), C[1], R.range(2, 3.6));
      }
      for (const f of followers) {
        if (t < f.t0 || f.hit >= 0) continue;
        const k = clamp((t - f.t0) / (f.t1 - f.t0), 0, 1);
        const [x, y] = path(k, f.lat);
        f.trail.unshift([x, y]);
        if (f.trail.length > 18) f.trail.pop();
        if (R.chance(0.4 * dt * 60)) ps.spawn(P.MOTE, x, y, R.range(-18, 18), R.range(-24, 8), R.range(0.18, 0.36), C[5], 0.5);
        if (k >= 1) {
          f.hit = t;
          pops.push({ t, x, y, big: false });
          lights.add(x, y, 46, C[5], 0.75, 0.22);
          for (let i = 0; i < 10; i++) {
            const a = R.range(0, TAU), v = R.range(70, 200);
            ps.spawn(P.SPARK, x, y, Math.cos(a) * v, Math.sin(a) * v - 30, R.range(0.14, 0.4));
          }
        }
      }
      if (!hitDone && t >= T_HIT) {
        hitDone = true;
        pops.push({ t, x: TX, y: TY, big: true });
        lights.add(TX, TY, 110, C[5], 0.9, 0.5);
        lights.add(TX, TY, 34, WHITE, 0.9, 0.12);
        for (let i = 0; i < 40; i++) {
          const a = R.range(0, TAU), v = R.range(90, 300);
          ps.spawn(P.SPARK, TX, TY, Math.cos(a) * v, Math.sin(a) * v - 30, R.range(0.18, 0.5));
        }
        for (let i = 0; i < 18; i++) {
          const a = R.range(-Math.PI, 0.2), v = R.range(50, 170);
          bits.add({ kind: B.SHARD, x: TX, y: TY, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 1, drag: 0.36, bounce: 0.3, life: R.range(0.5, 0.9), a: R.range(0, TAU), va: R.range(-16, 16), s: R.pick([1, 1, 2]) });
        }
        for (let i = 0; i < 9; i++) {
          ps.spawn(P.VAPOUR, TX + R.range(-16, 16), TY + R.range(-10, 12), R.range(-12, 12), -R.range(10, 30), R.range(0.6, 1.05), C[2], R.range(2.2, 3.8));
        }
        for (let i = 0; i < 7; i++) {
          souls.push({
            x: TX + R.range(-10, 10), y: TY + R.range(-8, 8),
            vx: R.range(-14, 14), vy: -R.range(32, 72),
            life: R.range(0.55, 0.9), max: 0, seed: R.range(0, 100), pts: [],
          });
        }
      }
      for (const s of souls) {
        s.max += dt;
        if (s.max > s.life) continue;
        s.vy += 34 * dt; // souls decelerate as they lift into the dark
        s.vx += Math.sin(s.max * 8 + s.seed) * 90 * dt;
        s.vx -= s.vx * 1.8 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.y < Y_MIN + 10) { s.y = Y_MIN + 10; s.vy = 0; }
        s.pts.push([s.x, s.y]);
        if (s.pts.length > 16) s.pts.shift();
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
      // ectoplasm scorch pool left under the detonation, evaporating with blinking flecks
      const q = t - T_HIT;
      if (q >= 0) {
        const k = smooth(0, 0.25, q) * (1 - smooth(1.35, 1.85, t));
        if (k > 0.02) {
          for (let x = -46; x <= 46; x++) {
            const u = x / 46, d = Math.round(4.2 * (1 - u * u));
            if (d < 1) continue;
            for (let dy = 0; dy < d; dy++) {
              if (rand2(x, dy) < 0.25 + (1 - k) * 0.5) continue;
              p.blend(TX + x, dy, dy === 0 ? C[2] : C[0], 0.62 * k);
            }
          }
          floorLight(p, TX, 0.5, 58, 8, C[4], 0.32 * k * clamp(1.3 - q * 0.55));
        }
      }
      simDraw(p, ps, H, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;
      flightHead = null;

      // ---- 1) condensation: green soul-motes spiral into the nucleus, light bends away
      if (t < T_LAUNCH + 0.1) {
        const ck = smooth(0, 0.24, t) * (1 - smooth(T_LAUNCH, T_LAUNCH + 0.1, t));
        if (ck > 0.02) {
          for (let i = 0; i < 9; i++) {
            const a = i * (TAU / 9) + t * 5.2;
            const rr = 34 * (1 - ease.outCubic(clamp(t / T_LAUNCH, 0, 1))) + 6;
            const x = SX + Math.cos(a) * rr, y = SY + Math.sin(a) * rr * 0.7;
            const al = Math.min(1, ck * 1.3);
            p.dot(x, y, i % 3 === 0 ? C[6] : C[5], al);
            p.dot(x + 1, y, i % 3 === 0 ? C[6] : C[5], al * 0.7);
            p.dot(x + Math.cos(a + 0.5) * 3, y + Math.sin(a + 0.5) * 2, C[4], al * 0.8);
          }
          sparkle(p, SX, SY, 10 * ck, C[7], C[5], 0.7 * ck);
          p.glow(SX, SY, 30 * ck + 8, C[4], 0.42 * ck);
        }
      }

      // ---- 1b) muzzle flash: the shot tears out of the nucleus in a straight line
      const mq = t - T_LAUNCH;
      if (mq >= 0 && mq < 0.09) {
        const mk = 1 - mq / 0.09;
        p.ellipse(SX + 5, SY, 11 * mk + 3, 5 * mk + 2, C[6]);
        p.ellipse(SX + 7, SY, 6 * mk + 1.5, 3 * mk + 1, mq < 0.045 ? WHITE : C[7]);
        flare(p, SX + 8, SY, 28 * mk, mk, [C[3], C[5], C[6], WHITE]);
        p.ring(SX, SY, 4 + 16 * ease.outCubic(mq / 0.09), 2, C[6], mk);
      }

      // ---- 2) the volley: follower ribbons + heads, then the colossal main wisp
      for (const f of followers) {
        if (t < f.t0) continue;
        const fade = f.hit >= 0 ? 1 - clamp((t - f.hit) / 0.18, 0, 1) : 1;
        ribbon(p, f.trail, 2.6, fade, f.ph);
        if (f.hit < 0) {
          const k = clamp((t - f.t0) / (f.t1 - f.t0), 0, 1);
          const [x, y] = path(k, f.lat);
          wispHead(p, x, y, 4.6, 1);
          flameTongue(p, x - 2, y - 2, 8, 2.2, -4, NZ, S + 40 + f.i * 9, H);
          p.glow(x, y - 2, 16, C[4], 0.4);
        }
      }
      if (t >= T_LAUNCH && t < T_HIT + 0.22) {
        const fade = 1 - smooth(T_HIT, T_HIT + 0.22, t);
        ribbon(p, mainTrail, 4.0, fade, 1.3);
        if (t < T_HIT) {
          const k = clamp((t - T_LAUNCH) / (T_HIT - T_LAUNCH), 0, 1);
          const [x, y] = path(k, 0);
          flightHead = [x, y];
          // colossal soul-flame: three tongues streaming back off the head
          const lean = -8 - 10 * k;
          flameTongue(p, x - 4, y - 2, 18 + 5 * noise(t * 3.3, S + 1), 3.4, lean, NZ, S + 11, H);
          flameTongue(p, x + 3, y - 3, 21 + 6 * noise(t * 3.1, S + 2), 3.8, lean * 0.8, NZ, S + 23, H);
          flameTongue(p, x - 1, y - 5, 16 + 5 * noise(t * 3.7, S + 4), 2.8, lean * 1.2, NZ, S + 31, H);
          wispHead(p, x, y, 9.5, 1.4);
          p.glow(x, y - 3, 34, C[4], 0.45);
          p.glow(x, y - 1, 14, C[6], 0.4);
        }
      }

      // ---- 3) HIT RESULT: main detonation bloom, starburst, ring, slivers, rising souls
      const q = t - T_HIT;
      if (q >= 0) {
        if (q < 0.6) {
          // ghost-fire bloom: a swelling soul-flame ball that burns then lifts away
          const gk = q < 0.1 ? ease.outQuart(q / 0.1) : 1 - smooth(0.24, 0.6, q);
          const br = 22 * gk;
          if (br > 1.5) {
            for (let i = 0; i < 4; i++) {
              const a = (i / 4) * TAU + 0.4;
              flameTongue(p, TX + Math.cos(a) * br * 0.5, TY - br * 0.4 + Math.sin(a) * br * 0.3, (16 + 10 * noise(t * 4 + i, S + 60 + i)) * gk, 3.2 * gk, Math.cos(a) * 5, NZ, S + 60 + i * 7, H);
            }
            wispHead(p, TX, TY - br * 0.35, br * 0.8, 1.6);
            p.glow(TX, TY - br * 0.3, 40 * gk + 10, C[4], 0.5 * gk);
          }
        }
        if (q < 0.075) {
          const hot = q < 0.037, hk = 1 - q / 0.075;
          star(p, TX, TY, hitSpikes, hot ? 1 : 1.3, hot ? 1 : 0.6, WHITE, C[6], C[7], C[4]);
          flare(p, TX, TY, 56 * hk, hk, [C[3], C[5], C[6], WHITE]);
          p.beam(TX - 42 * hk, TY, TX + 42 * hk, TY, hot ? 3.6 : 2, WHITE);
        }
        if (q >= 0.02 && q < 0.24) {
          const sk = (q - 0.02) / 0.22;
          for (const sl of burstSlivers) sliver(p, TX, TY, sl.a, sl.r + sl.v * (q - 0.02), sl.arc * (1 - 0.4 * sk), sk < 0.4 ? C[6] : sk < 0.75 ? C[5] : C[3], 1 - sk);
        }
        // curling soul threads lift out of the wound (scythe-reap wisp recipe)
        for (const s of souls) {
          if (s.max <= 0 || s.max > s.life) continue;
          const k = 1 - s.max / s.life;
          const n = s.pts.length;
          for (let i = 1; i < n; i++) {
            const u = i / n;
            const al = (0.2 + 0.8 * u) * k;
            const col = u > 0.6 ? C[5] : C[3];
            p.dot(s.pts[i][0], s.pts[i][1], col, al);
            p.dot(s.pts[i][0] + 1, s.pts[i][1], col, al * 0.6);
          }
          p.dot(s.x, s.y, C[6], k);
          p.dot(s.x + 1, s.y, C[6], k * 0.8);
          p.dot(s.x, s.y - 1, C[7], k * 0.95);
          p.glow(s.x, s.y, 9, C[5], 0.4 * k);
        }
      }
      for (const pp of pops) {
        const k = (t - pp.t) / (pp.big ? 0.36 : 0.28);
        if (k >= 0 && k < 1) pop(p, k, pp.x, pp.y, pp.big);
      }

      for (const b of bits.list) rock(p, b, gst);
      simDraw(p, ps, H, "front");
      lights.draw(p);
      // ghost-fire drinks the ambient light round its flying core (after lights composite)
      if (flightHead) {
        const [fx2, fy2] = flightHead;
        unlight(p, fx2 - 26, fy2 - 26, fx2 + 26, fy2 + 20, (ax, ay) => {
          const dx = ax - fx2, dy = ay - fy2;
          return dx * dx + dy * dy < 620;
        }, 0.55);
      }
    },
  };
}

// cheap deterministic hash for scorch-fleck breakup
function rand2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
