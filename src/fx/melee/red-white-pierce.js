// Red-white piercing streak ("melee/red-white-pierce"): a point of white light at the hand is squeezed into a
// hair-thin line, then a striped white-and-red streak lunges a short way straight out and punches into the enemy.
// The wound is a point-like white flash, and the streak shatters into a few grey-white glints that drift slowly
// down. Sparks, light and the star glint come from the core toolkit; the act follows melee/thrust.
import { Particles, Lights, P, Rng, fit, sparkle, clamp, smooth, lerp, ease, TAU, WHITE, READY } from "../../core/index.js";

const HX = 10, HY = -22; // the hand: the light gathers here and the streak leaves from here
const REACH = 60; // a short lunge: the streak's head reaches this far out
const TX = HX + REACH; // where the head meets the enemy
const T_FIRE = 0.16; // release: the compressed line lets go
const FLIGHT = 0.08; // the lunge is fast, about five frames
const T_HIT = T_FIRE + FLIGHT;
const T_END = 1.5;
const BAND = 3; // length of each white or red stripe along the streak, px

export const meta = {
  name: "Red-white pierce",
  desc: "A piercing lunge: a white point squeezes to a line at the hand, a red-and-white streak stabs a short way out, a white flash marks the wound, and grey glints shatter off and fall.",
  tags: ["melee", "thrust", "pierce", "streak", "red", "white", "linear", "combat", "directional", "one-shot"],
  size: [160, 80],
  origin: [34, 62],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#2a0508", "#6b0c14", "#b3121e", "#e0202c", "#ff4a4a", "#ffb4a8", "#ffffff"],
    ash: ["#7d828e", "#b4b9c4", "#d6dae2", "#f2f4f8"],
    seed: 7,
  },
};

const GUARD = { ...READY, x: 0, crouch: 3, lean: 1, fx: 10, fy: -22, bx: 8, by: -20, ffx: 7, fbx: -7 };
const DRAW = { ...READY, x: -3, crouch: 5, lean: -3, fx: 2, fy: -24, bx: 10, by: -22, ffx: 6, fbx: -8 };
const THRUST = { ...READY, x: 4, crouch: 4, lean: 6, fx: 14, fy: -22, bx: 14, by: -22, ffx: 10, fbx: -6, ghost: 1 };
const HOLD = { ...READY, x: 4, crouch: 4, lean: 4, fx: 13, fy: -23, bx: 13, by: -22, ffx: 9, fbx: -6 };
const RECOVER = { ...READY, x: 1, crouch: 2, lean: 1, fx: 9, fy: -21, bx: 9, by: -20, ffx: 7, fbx: -7 };

export const act = {
  target: { x: 82 },
  poses: [
    [-0.28, GUARD],
    [-0.12, DRAW],
    [T_FIRE, THRUST, "snap"],
    [T_HIT, HOLD],
    [0.6, HOLD],
    [1.0, RECOVER],
    [T_END, READY],
  ],
  hits: [
    { t: T_HIT, stop: 0.1, shake: 0.16, amp: 2.2, push: 3.2, straw: 14, y: -22 },
  ],
};

// the release: a point of white light at the hand, squeezed (u 0..1) into a hair-thin line that ends at the hand
function gather(p, u, C) {
  const r = lerp(2.6, 0.7, smooth(0, 0.8, u)), sx = lerp(1, 8, smooth(0.25, 1, u));
  p.glow(HX, HY, lerp(6, 14, u), C[4], lerp(0.3, 0.6, u));
  for (let x = HX - sx; x <= HX; x += 0.5) p.px(x, HY, WHITE);
  if (sx > 3) for (let x = HX - sx + 1; x <= HX - 1; x += 0.5) p.px(x, HY - 1, C[5]);
  p.circle(HX, HY, r, WHITE);
}

// the streak from tail x0 to head x1 along the line y = HY: stripes of white and red, a hot white head,
// thickest near the head and a single hair at the tail; k fades it
function streak(p, x0, x1, C, k) {
  const L = x1 - x0;
  if (L < 0.5) return;
  for (let x = x0; x <= x1; x += 0.5) {
    const v = (x - x0) / L; // 0 at the tail, 1 at the head
    const white = Math.floor((x1 - x) / BAND) % 2 === 0; // stripes counted back from the head: white first
    const core = white ? WHITE : C[4], edge = white ? C[5] : C[2];
    const a = k * Math.min(1, 0.3 + v);
    if (a < 0.5) continue;
    p.px(x, HY, core);
    if (v > 0.5) p.px(x, HY - 1, edge);
    if (v > 0.8) p.px(x, HY + 1, edge);
  }
}

export function create(o) {
  const C = fit(o.palette, 7), G = fit(o.ash, 4), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [WHITE, C[5], C[4], C[3]] });
  const lights = new Lights();
  let motes = [], glints = [];
  let t = 0, lit = false, fired = false, hit = false, shattered = false;

  return {
    update(dt) {
      t += dt;
      // the light gathers: motes drawn in from around the hand while the point compresses
      if (t < T_FIRE && R.chance(40 * dt)) {
        const a = R.range(0, TAU), r = R.range(12, 20);
        motes.push({ x0: HX + Math.cos(a) * r, y0: HY + Math.sin(a) * r * 0.8, age: 0, life: R.range(0.08, T_FIRE) });
      }
      for (const m of motes) m.age += dt;
      motes = motes.filter((m) => m.age < m.life);

      if (!lit) {
        lit = true;
        lights.add(HX, HY, 26, C[4], 0.35, 0.2);
      }
      // release: a pop of light at the hand and a few sparks spat back
      if (!fired && t >= T_FIRE) {
        fired = true;
        lights.add(HX + 10, HY, 30, C[4], 0.45, 0.16);
        for (let i = 0; i < 4; i++) {
          const a = R.range(-0.5, 0.5), v = R.range(60, 130);
          ps.spawn(P.SPARK, HX + 2, HY, Math.cos(a) * v, Math.sin(a) * v * 0.5, R.range(0.08, 0.18));
        }
      }
      // the hit: a hot light at the wound and sparks kicked out of it
      if (!hit && t >= T_HIT) {
        hit = true;
        lights.add(TX, HY, 36, WHITE, 0.55, 0.1);
        lights.add(TX, HY, 22, C[4], 0.4, 0.3);
        for (let i = 0; i < 7; i++) {
          const a = R.range(-0.9, 0.9) + (R.chance(0.4) ? Math.PI : 0), v = R.range(90, 220);
          ps.spawn(P.SPARK, TX, HY, Math.cos(a) * v, Math.sin(a) * v - 25, R.range(0.12, 0.3));
        }
      }
      // the shatter: the streak breaks into a few grey-white glints spread along where it was
      if (!shattered && t >= T_HIT + 0.02) {
        shattered = true;
        for (let i = 0; i < 9; i++) {
          glints.push({
            x: HX + 12 + R.range(0, REACH - 12), y: HY + R.range(-1.6, 1.6),
            vx: R.range(18, 55), vy: R.range(-14, 4), age: 0, life: R.range(0.9, 1.25),
            c: R.pick(G), big: R.chance(0.35), seed: R.range(0, 10),
          });
        }
      }
      // glints drift: a little forward, then slowly down (drag, then a gentle pull); they settle on the floor
      for (const g of glints) {
        g.age += dt;
        g.vx -= g.vx * 2.2 * dt;
        g.vy -= g.vy * 2.2 * dt;
        g.vy += 24 * dt;
        g.x += (g.vx + Math.sin(g.age * 2.2 + g.seed) * 3) * dt;
        g.y += g.vy * dt;
        if (g.y > 0) (g.y = 0), (g.vy = 0);
      }
      glints = glints.filter((g) => g.age < g.life);

      ps.update(dt);
      lights.update(dt);
    },

    draw(p) {
      // release: the point is squeezed into the line; the motes it draws in glint on the way
      if (t < T_FIRE) gather(p, clamp(t / T_FIRE), C);
      for (const m of motes) {
        const e = (m.age / m.life) ** 2, x = m.x0 + (HX - m.x0) * e, y = m.y0 + (HY - m.y0) * e;
        p.dot(x, y, C[5], 0.9 - e * 0.4);
        p.glow(x, y, 2, C[4], 0.3);
      }
      // the launch flash at the hand
      if (t >= T_FIRE && t < T_FIRE + 0.05) {
        const k = 1 - (t - T_FIRE) / 0.05;
        p.glow(HX, HY, 14 * k, WHITE, 0.8 * k);
      }

      // the lunge: the head shoots out, the tail follows and stretches the streak, then the streak collapses into the wound
      if (t >= T_FIRE && t < T_HIT + 0.06) {
        const f = clamp((t - T_FIRE) / FLIGHT);
        let head = HX + REACH * ease.outCubic(f), tail = head - lerp(8, 22, smooth(0, 0.6, f));
        if (t >= T_HIT) {
          const c = smooth(T_HIT, T_HIT + 0.05, t);
          head = TX;
          tail = TX - 22 * (1 - c);
        }
        tail = Math.max(tail, HX - 2);
        streak(p, tail, head, C, 1);
        p.glowLine(tail, HY, head, HY, 4, C[3], 0.35);
        p.glow(head, HY, 8, WHITE, 0.6);
      }

      // the wound: a point-like high white piercing flash, a glint star and a little line through it
      const q = t - T_HIT;
      if (q >= 0 && q < 0.14) {
        const k = q / 0.14, fade = 1 - k;
        p.glow(TX, HY, 3 + 4 * fade, WHITE, 0.7 * fade + 0.1);
        sparkle(p, TX, HY, 1.5 + 6 * fade, WHITE, C[5], 0.9 * fade);
        p.line(TX - 3, HY, TX + 3 + 6 * fade, HY, WHITE, fade);
        p.circle(TX, HY, 1.2 * fade + 0.4, WHITE);
      }

      // the shatter: grey-white glints, each twinkling, fading in and out as they fall
      for (const g of glints) {
        const a = Math.min(1, g.age / 0.05) * clamp((g.life - g.age) / 0.35) * (0.7 + 0.3 * Math.sin(g.age * 13 + g.seed));
        if (a <= 0.02) continue;
        p.dot(g.x, g.y, g.c, a);
        if (g.big) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.dot(g.x + dx, g.y + dy, g.c, a * 0.5);
        p.glow(g.x, g.y, 3, g.c, 0.5 * a);
      }

      ps.draw(p);
      lights.draw(p);
    },
  };
}
