// Ember flash ("moves/ember-flash"): a warm yellow spark swells on the foe while the air round it is
// drawn inward, then breaks with a soft pop into a small orange-red fire wave and a low grey-white dust
// cloud. The body snaps white for a few frames; afterwards a thin wisp of cool smoke rises from the mark
// and a few charred flakes drift slowly down and settle.
import { Particles, Lights, P, PF, Rng, READY, fit, clamp, lerp, smooth, ease, TAU, WHITE, hex, mix, stockActor } from "../../core/index.js";

const TX = 96;          // the target's feet
const BY = -26;         // where the light gathers: its chest
const T_POP = 0.42;     // the light breaks
const T_END = 2.45;
const X_MIN = -46, X_MAX = 170, Y_MIN = -100, Y_MAX = 13;

export const meta = {
  name: "Ember flash",
  desc: "A warm yellow spark swells on the foe, its air sucked inward, then pops into a small fire wave and dust; the body flashes white, leaving a thin wisp and ash.",
  tags: ["move", "fire", "burst", "flash", "impact", "one-shot"],
  size: [232, 144],
  origin: [60, 116],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#150a05", "#35150a", "#61290c", "#a44410", "#e06d15", "#ff9b23", "#ffc94c", "#ffe7a0", "#fffdf2", "#ffffff"],
    dust: ["#23212b", "#393641", "#514d5b", "#6e6877", "#918a99", "#b9b2bf", "#dcd6de"],
    seed: 12,
  },
};

const GUARD = { ...READY, x: 0, crouch: 3, lean: 1, fx: 10, fy: -21, bx: 9, by: -21, ffx: 7, fbx: -8 };
const COCK = { ...READY, x: -3, crouch: 6, lean: -6, hx: -3, hy: -2, fx: -4, fy: -30, bx: 11, by: -22, ffx: 6, fbx: -9 };
const PUSH = { ...READY, x: 5, crouch: 3, lean: 8, hx: 4, hy: 1, fx: 21, fy: -27, bx: 17, by: -23, ffx: 13, fbx: -10, ghost: 1 };
const HOLD = { ...PUSH, ghost: 0, lean: 6, fx: 18, fy: -25 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.5, GUARD],
    [-0.16, COCK],
    [0.26, PUSH, "snap"],
    [T_POP, HOLD],
    [1.05, GUARD],
    [2.1, GUARD],
  ],
  hits: [
    { t: T_POP, stop: 0.09, shake: 0.2, amp: 2.2, push: 1.6, straw: 6, y: BY, flash: 0.09 },
  ],
  dust: [
    { t: T_POP, x: TX - 5, n: 5, dir: -1 },
    { t: T_POP, x: TX + 5, n: 5, dir: 1 },
  ],
};

export function create(o) {
  const C = fit(o.palette, 10), D = fit(o.dust, 7), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [C[9], C[7], C[6], C[4]], haze: C[4] });
  const lights = new Lights();
  const BODY = stockActor(2);
  const onBody = (x, y) => {
    const mx = Math.round(x) - (TX + BODY.x), my = Math.round(y) - BODY.y;
    return mx >= 0 && my >= 0 && mx < BODY.w && my < BODY.h && BODY.mask.data[my * BODY.w + mx] !== 0;
  };

  // filaments of air pulled in toward the spark, and a few warm motes riding with them
  const air = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * TAU + R.range(-0.24, 0.24), p: R.next(), sp: R.range(0.85, 1.25), len: R.range(3.5, 6) }));
  const motes = Array.from({ length: 5 }, (_, i) => ({ a: R.range(0, TAU), p: i / 5, sp: R.range(0.7, 1.05), spin: R.sign() * R.range(0.4, 0.9) }));

  // the fire wave: a ring of flame blobs flung out, plus the burst at the heart of it
  const blobs = [
    ...Array.from({ length: 16 }, (_, i) => ({ a: (i / 16) * TAU + R.range(-0.14, 0.14), d: R.range(1.5, 5.5), s: R.range(1.7, 3.2), up: R.chance(0.5) })),
    ...Array.from({ length: 5 }, () => ({ a: R.range(0, TAU), d: R.range(0, 1.5), s: R.range(2.2, 3.4), up: false })),
  ];
  // the grey-white dust that bursts with it and rolls low over the body
  const cloud = Array.from({ length: 13 }, (_, i) => ({ a: (i / 13) * TAU + R.range(-0.26, 0.26), d: R.range(1, 5), sp: R.range(3, 11), s: R.range(2, 3.2), up: R.range(0, 3), ph: R.range(0, TAU) }));

  // what it leaves: a thin wisp off the mark and a few charred flakes
  const W0 = { t0: T_POP + 0.24, ph: R.range(0, TAU), lean: R.range(4.5, 7.5), sway: R.range(1.6, 2.8) };
  const ash = Array.from({ length: 6 }, () => ({
    x0: TX + R.range(-10, 9), y0: BY + R.range(-7, 5), t0: T_POP + R.range(0.08, 0.5),
    up: R.range(4, 12), fall: R.range(10, 18), sway: R.range(1.2, 3), ph: R.range(0, TAU), big: R.chance(0.4),
  }));

  let t = 0, popped = false;
  const fade = (tt) => 1 - smooth(T_END - 0.45, T_END - 0.02, tt);

  return {
    update(dt) {
      t += dt;
      const f = Math.min(1, dt * 120);

      if (!popped && t <= T_POP) {
        // the air is being drawn in, faster as the spark swells
        if (t > 0.1 && R.chance(16 * f)) {
          const a = R.range(0, TAU), d = R.range(20, 36), sp = 26 + 34 * (t / T_POP);
          ps.spawn(P.STREAK, TX + Math.cos(a) * d, BY + Math.sin(a) * d * 0.85, -Math.cos(a) * sp, -Math.sin(a) * sp * 0.85, R.range(0.1, 0.18), R.chance(0.25) ? C[5] : C[3], R.range(0.5, 0.9));
        }
        if (R.chance(4 * f)) ps.spawn(P.VAPOUR, TX + R.range(-12, 12), BY + R.range(-10, 10), R.range(-6, 6), R.range(-6, 6), R.range(0.3, 0.5), C[2], R.range(2, 3));
      }

      if (!popped && t >= T_POP) {
        popped = true;
        lights.add(TX, BY, 19, C[5], 0.7, 0.3);
        lights.add(TX, BY, 8, WHITE, 0.9, 0.05);
        lights.add(TX, 0, 30, C[4], 0.3, 0.7);
        // the fire wave: small puffs that cool as they fly, some turning to smoke
        for (let i = 0; i < 7; i++) {
          const a = R.range(0, TAU), sp = R.range(34, 80);
          ps.spawn(P.FIRE, TX + Math.cos(a) * R.range(1, 5), BY + Math.sin(a) * R.range(1, 5), Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 8, R.range(0.16, 0.3), 0, R.range(1.6, 3), R.range(0, 0.02), R.chance(0.3) ? PF.SMOKES : 0);
        }
        for (let i = 0; i < 8; i++) {
          const a = R.range(0, TAU), sp = R.range(55, 150);
          ps.spawn(P.SPARK, TX, BY, Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.14, 0.42));
        }
        for (let i = 0; i < 2; i++) {
          const a = R.range(0, TAU), sp = R.range(14, 34);
          ps.spawn(P.EMBER, TX + Math.cos(a) * 3, BY + Math.sin(a) * 3, Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.4, 0.8), C[4]);
        }
        // grey-white dust and smoke, low and slow, a small cloud rather than a wall
        for (let i = 0; i < 7; i++) {
          const s = R.sign();
          ps.spawn(P.DUST, TX + s * R.range(2, 9), -R.range(1, 2.5), s * R.range(12, 34), -R.range(1, 5), R.range(0.35, 0.6), R.pick([D[3], D[4], D[5]]), R.range(0.8, 1.4), R.range(0, 0.05));
        }
      }

      ps.update(dt);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.01) return;
      const k = fade(t);
      ps.draw(p, "back");
      if (t >= T_POP) {
        const age = t - T_POP, u = clamp(age / 0.8);
        // the floor takes a small, soft wash of dust
        if (u < 1) {
          const rr = 9 + 20 * ease.outCubic(clamp(age / 0.4)), al = (1 - u) ** 1.5 * 0.55 * k;
          for (let y = -4; y <= 0; y++)
            for (let x = Math.floor(TX - rr); x <= TX + rr; x++) {
              const d = Math.hypot((x - TX) / rr, (y + 1.5) / 3.2);
              if (d >= 1) continue;
              p.blend(x, y, d > 0.72 ? D[3] : d < 0.4 ? D[5] : D[4], al * (1 - d) * 0.55);
            }
        }
        // the grey-white dust wave, behind the body: a small cloud that is gone in under a second
        const du = age / 0.6;
        if (du < 1) {
          for (const c of cloud) {
            const d = c.d + c.sp * age, x = TX + Math.cos(c.a) * d, y = BY + 12 + Math.sin(c.a) * d * 0.32 - c.up * age;
            const r = c.s * (0.9 + age * 1.1), al = Math.sin(Math.PI * Math.min(1, du * 1.02)) * 0.5;
            p.disc(x, y, r, D[5], al * 0.5);
            p.disc(x - r * 0.12, y - r * 0.18, r * 0.82, D[6], al * 0.42);
            if (du > 0.45) p.disc(x + r * 0.1, y + r * 0.2, r * 0.7, D[4], al * 0.32);
          }
        }
        const sk = (1 - smooth(0.04, 0.7, age)) * k;
        if (sk > 0.02)
          for (let x = Math.floor(TX - 15); x <= TX + 15; x++) {
            const d = Math.abs(x - TX) / 15;
            p.dot(x, 0, d < 0.4 ? mix(C[2], hex("#0b0910"), 0.65) : hex("#171320"), sk * (1 - d * 0.85));
          }
      }
    },

    draw(p) {
      if (t >= T_END - 0.01) return;
      const k = fade(t);

      // ---------------- 1. the charge: a small warm spark, the air pressing in ----------------
      if (t < T_POP) {
        const g = smooth(0.02, 0.4, t);
        const r = 1.6 + 3.9 * g * (1 + 0.13 * Math.sin(t * 14));
        for (const a of air) {
          const pr = (a.p + t * a.sp) % 1;
          const rr = lerp(34, r + 2, ease.inCubic(pr));
          const al = 0.42 * Math.sin(Math.PI * Math.min(1, pr * 1.05)) * (0.3 + 0.7 * g);
          for (let i = 0; i < a.len; i++) {
            const x = TX + Math.cos(a.a) * (rr + i), y = BY + Math.sin(a.a) * (rr + i) * 0.9;
            if (onBody(x, y)) continue;   // the air runs round the body, not over it
            p.blend(x, y, i ? C[4] : C[5], al * (0.4 + 0.6 * (i / a.len)) * 0.9);
          }
        }
        for (const m of motes) {
          const pr = (m.p + t * m.sp) % 1;
          const rr = lerp(30, r + 1, ease.inCubic(pr)), ang = m.a + pr * 2.2 * m.spin;
          p.px(TX + Math.cos(ang) * rr, BY + Math.sin(ang) * rr * 0.9, pr > 0.55 ? C[6] : C[4]);
        }
        // a wavering thread tying the spark back to the caster's palm
        for (let i = 0; i <= 14; i++) {
          const u = i / 14, x = lerp(24, TX - 2, u), y = lerp(-27, BY, u) + Math.sin(u * 7 - t * 10) * 1.8 * Math.sin(Math.PI * u);
          p.blend(x, y, C[4], (0.06 + 0.14 * u) * g);
        }
        // the spark: soft halo, hot core, a thin turning rim
        p.disc(TX, BY, r * 2.4 + 2.5, C[4], 0.1 + 0.14 * g);
        p.disc(TX, BY, r * 1.5, C[5], 0.16 + 0.3 * g);
        p.circle(TX, BY, r, C[7], 1);
        p.circle(TX, BY, r * 0.72, C[8], 1);
        p.circle(TX, BY, r * 0.34, WHITE, 1);
        p.ring(TX, BY, r + 1.4 + Math.sin(t * 10) * 0.5, 1, C[6], 0.3 + 0.3 * g);
        p.glow(TX, BY, 12 + 4 * Math.sin(t * 12), C[4], 0.18 * g);
      }

      // ---------------- 2. the pop ----------------
      if (t >= T_POP) {
        const age = t - T_POP;
        // the body snaps white first, and the mark itself cracks white
        const bk = 1 - smooth(0.012, 0.045, age);
        if (bk > 0.02) p.mask(BODY.mask, TX + BODY.x, BODY.y, C[8], bk * k);
        const wk = 1 - smooth(0, 0.07, age);
        if (wk > 0.02) {
          p.circle(TX, BY, 1.4 + 2.2 * wk, WHITE, 1);
          p.disc(TX, BY, 5 + 3 * wk, C[8], 0.35 * wk);
        }
        // the fire wave: flame blobs flung out in a small ring, cooling from yellow to ember red
        const ur = age / 0.42;
        if (ur < 1) {
          const hot = (1 - ur) ** 1.05, prog = ease.outQuart(Math.min(1, ur * 1.7));
          const c1 = mix(C[4], C[2], 1 - hot), c2 = mix(C[5], C[3], 1 - hot), c3 = mix(C[7], C[5], 1 - hot);
          for (const b of blobs) {
            const d = (b.d + 17 * prog) * (0.78 + 0.22 * hot);
            const x = TX + Math.cos(b.a) * d, y = BY + Math.sin(b.a) * d * 0.86 - (b.up ? prog * 1.5 : 0);
            const r = b.s * (0.45 + 0.55 * hot);
            if (r < 0.55) continue;
            p.circle(x, y, r, c1);
            p.circle(x - 0.3, y - 0.35, r * 0.64, c2);
            if (r > 1.7) p.circle(x - 0.5, y - 0.6, r * 0.3, c3);
          }
          // the firelight off it: a warm bloom round the mark
          if (age < 0.3) p.glow(TX, BY, 10 + 22 * prog, C[4], 0.45 * (1 - age / 0.3));
          // the crack itself: a pale ball that is gone in a blink
          if (age < 0.1) {
            const fk2 = 1 - age / 0.1;
            p.circle(TX, BY, 1.6 + 2.6 * fk2, fk2 > 0.5 ? C[8] : C[7]);
            if (fk2 > 0.6) p.circle(TX, BY, 1.2, WHITE);
          }
        }
        const ok = 1 - smooth(0.04, 0.22, age);
        if (ok > 0.02) p.outline(BODY.mask, TX + BODY.x, BODY.y, (mx, my) => (my < 20 ? C[6] : C[5]), ok * 0.8 * k);
        // short flame tongues off the chest, cooling fast
        const fk = 1 - smooth(0.03, 0.3, age);
        if (fk > 0.02) {
          for (let i = 0; i < 2; i++) {
            const fx = TX + [-5, 5][i], h = (4 + i * 2) * fk;
            for (let j = 0; j <= h; j++) {
              const u = j / Math.max(1, h), x = fx + Math.sin(u * 2.8 + age * 20 + i) * (0.3 + u * 1.2);
              p.dot(x, BY + 3 - j, u > 0.65 ? C[6] : u > 0.35 ? C[5] : C[4], fk * (1 - u * 0.55));
            }
          }
        }
      }

      ps.draw(p, "front");
      lights.draw(p);

      // ---------------- 3. what it leaves: a thin wisp, charred ash ----------------
      if (t >= T_POP) {
        const trail = 1 - smooth(T_END - 0.5, T_END - 0.05, t);
        const wt = t - W0.t0;
        if (wt > 0) {
          const life = 1.75, u = clamp(wt / life), grow = Math.min(1, wt / 0.7), rise = smooth(0, 0.3, wt);
          const h = (14 + 34 * grow) * (1 - 0.25 * u);
          for (let j = 0; j <= 30; j++) {
            const q = j / 30;
            const y = BY + 4 - q * h;
            const bx = TX + 6 + q * W0.lean + Math.sin(q * 3.1 + wt * 1.5 + W0.ph) * (0.6 + q * W0.sway);
            const al = Math.pow(1 - u, 1.3) * Math.sin(Math.PI * Math.min(1, q * 1.15)) * 0.72 * rise * trail;
            if (al <= 0.01) continue;
            const c = q < 0.1 && wt < 0.8 ? mix(hex("#a09a9c"), C[4], 0.35) : q > 0.55 ? hex("#8d929b") : hex("#aeb3ba");
            for (const [ox, oy, k2] of [[0, 0, 1], [-0.9, 0.5, 0.55], [0.8, -0.4, 0.5]]) {
              const wx = bx + ox * (0.4 + q), wy = y + oy;
              if (onBody(wx, wy)) continue;   // it comes from behind the body, not across it
              p.disc(wx, wy, (0.6 + q * 1.1) * (1 - 0.15 * u), c, al * k2 * 0.75);
            }
          }
        }
        for (const a of ash) {
          const a3 = t - a.t0;
          if (a3 < 0 || a3 > 1.8) continue;
          const y = a.y0 - a.up * a3 * (1 - a3 * 1.8) + a.fall * a3 * a3;
          const x = a.x0 + Math.sin(a3 * 1.9 + a.ph) * a.sway * Math.min(1, a3 * 2.5);
          const heat = clamp(a3 / 0.55), al = (1 - smooth(1.35, 1.8, a3)) * trail;
          const landed = y > -0.4;
          const cy = landed ? -0.25 : y;
          // charred black with a grey rim, so it reads against the dark; a last ember at its tip
          p.dot(x, cy, hex("#0c0a10"), al);
          p.dot(x + 1, cy, hex("#5f5968"), al);
          p.dot(x, cy - 1, hex("#332e3d"), al * 0.95);
          p.dot(x + 1, cy - 1, hex("#7a7484"), al * 0.8);
          if (a.big) p.dot(x + 2, cy, hex("#3b3546"), al * 0.85);
          if (heat < 0.4) p.px(x, cy - 1, C[6], al);
          else if (heat < 0.75) p.px(x, cy - 1, C[3], al * 0.7);
          if (landed && heat < 1) p.px(x, cy, C[2], al * (1 - heat) * 0.8);
        }
      }
    },
  };
}
