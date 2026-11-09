// Thorn lash ("nature/thorn-lash"): the hunter coils and cracks a thorn whip forward — a long, thin, vicious
// S-curved arc of dark green light edged in bark brown that snaps across the gap in a blink, shivers, then
// dissolves into a few sharp thorn glints; where it passes through the enemy it leaves a diagonal tearing
// green rend across the body that bursts with emerald and dark-red sparks woven together.
import { Particles, Lights, P, Rng, fit, clamp, smooth, lerp, ease, noise, rand, TAU, WHITE, READY } from "../../core/index.js";
import { star } from "../impacts/_lib.js";
import { unlight } from "../shadow/_lib.js";
import { hotFirst, simDraw } from "../fire/_lib.js";

const HX = 14, HY = -30; // whip hand at the crack
const TIPX = 128, TIPY = -24; // the lash overshoots the enemy
const TX = 104; // the enemy
const T_CRACK = 0.2;
const SWEEP = 0.1;
const T_HIT = 0.34;
const T_END = 1.7;

export const meta = {
  name: "Thorn lash",
  desc: "A coiled crack snaps a thin S-curved thorn-whip arc of dark green, bark-edged light forward; it sheds thorn glints and leaves a diagonal rend bursting emerald and dark-red sparks.",
  tags: ["nature", "thorn", "whip", "lash", "slash", "rend", "melee", "directional", "one-shot"],
  size: [320, 168],
  origin: [70, 120],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#0b1206", "#1c3a10", "#2c5c16", "#478c1e", "#6cc028", "#a4e83c", "#dcff9a", "#ffffff"],
    bark: ["#1c1208", "#3d2a16", "#5e4224", "#8a6a3a"],
    blood: ["#2a0808", "#5c1212", "#8f1e1a", "#c8402a"],
    seed: 23,
  },
};

const GUARD = { ...READY, x: 0, crouch: 3, lean: 1, fx: 9, fy: -22, bx: 8, by: -20, ffx: 7, fbx: -7 };
const COIL = { ...READY, x: -4, crouch: 7, lean: -6, fx: 3, fy: -32, bx: 10, by: -22, ffx: 5, fbx: -9 };
const CRACK = { ...READY, x: 5, crouch: 4, lean: 8, fx: 14, fy: -30, bx: 15, by: -24, ffx: 11, fbx: -6, ghost: 1 };
const FOLLOW = { ...READY, x: 4, crouch: 4, lean: 6, fx: 13, fy: -28, bx: 14, by: -23, ffx: 10, fbx: -6 };
const RECOVER = { ...READY, x: 1, crouch: 2, lean: 1, fx: 9, fy: -21, bx: 9, by: -20, ffx: 7, fbx: -7 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.26, GUARD],
    [-0.1, COIL],
    [T_CRACK, CRACK, "snap"],
    [0.42, FOLLOW],
    [1.05, RECOVER],
    [T_END, READY],
  ],
  hits: [
    { t: T_HIT, stop: 0.1, shake: 0.32, amp: 3.2, push: 4.2, straw: 10, y: -26, skin: "poison", shiver: 0.35 },
    { t: 1.25, stop: 0, shake: 0, amp: 0, push: 0, straw: 0, flash: 0, skin: null },
  ],
  dust: [
    { t: T_CRACK, x: 2, n: 5, dir: -1 },
    { t: T_HIT, x: TX, n: 5, dir: 1 },
  ],
};

export function create(o) {
  const C = fit(o.palette, 8), B = fit(o.bark, 4), D = fit(o.blood, 4), H = hotFirst(C);
  const R = new Rng(o.seed), S = o.seed * 31;
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [C[7], C[6], C[5], D[3]], haze: C[3] });
  const lights = new Lights();

  // thorns studding the lash, alternating sides
  const THORNS = Array.from({ length: 7 }, (_, i) => ({ u: 0.16 + i * 0.12 + rand(S + i) * 0.03, side: i % 2 ? 1 : -1, len: 2.5 + rand(S + 40 + i) * 2 }));
  // where the arc sheds its thorn glints as it dissolves
  const GLINTS = [0.26, 0.44, 0.6, 0.76, 0.9].map((u, i) => ({ u, t: 0.5 + i * 0.045 + rand(S + 60 + i) * 0.02 }));
  const REND = { x0: TX - 9, y0: -35, x1: TX + 8, y1: -15 }; // the diagonal tear across the enemy
  const FLARE = [0, 1, 2, 3, 4, 5].map((i) => ({ a: (i / 6) * TAU + 0.35, len: i % 2 ? 6.5 : 9.5, w: 1.1 }));

  // the S-curved lash path: a straight base line bent by a travelling two-lobe wave pinned at both ends
  function whipPt(u, t) {
    const us = clamp((t - T_CRACK) / SWEEP, 0, 1);
    const phase = -1.6 + 3.2 * ease.outExpo(us) + (t > T_CRACK + SWEEP ? Math.sin(t * 34) * 0.55 * Math.exp(-(t - T_CRACK - SWEEP) * 6) : 0);
    const amp = 14 * (0.55 + 0.45 * ease.outExpo(us)) * (1 - 0.35 * smooth(0.44, 0.68, t));
    const w = Math.sin(u * TAU - phase) * Math.sin(Math.PI * u) * amp * (0.55 + 0.45 * u);
    return [lerp(HX, TIPX, u) + w * 0.16, lerp(HY, TIPY, u) + w];
  }

  let t = 0;
  return {
    update(dt) {
      t += dt;
      // sap motes sucked into the coiling hand during the wind-up
      if (t < T_CRACK && R.chance(1.3 * dt * 60)) {
        const a = R.range(0, TAU), d = R.range(12, 30);
        ps.spawn(P.STREAK, HX + Math.cos(a) * d, HY - 4 + Math.sin(a) * d, -Math.cos(a) * 120, -Math.sin(a) * 120, R.range(0.07, 0.13), R.chance(0.5) ? C[5] : B[3], 1);
      }
      if (t >= T_CRACK && t - dt < T_CRACK) {
        for (let k = 0; k < 8; k++) {
          const a = R.range(-0.6, 0.6), v = R.range(70, 170);
          ps.spawn(P.SPARK, HX + 2, HY, Math.cos(a) * v, Math.sin(a) * v * 0.6, R.range(0.08, 0.2));
        }
      }
      // the rend bursts with emerald and dark-red sparks woven together
      if (t >= T_HIT && t - dt < T_HIT) {
        for (let k = 0; k < 18; k++) {
          const a = R.range(0, TAU), v = R.range(50, 170);
          const green = R.chance(0.48);
          ps.spawn(P.SPARK, REND.x0 + 9 + R.range(-3, 3), REND.y0 + 10 + R.range(-4, 4), Math.cos(a) * v, Math.sin(a) * v - 24, R.range(0.14, 0.42), green ? (R.chance(0.5) ? C[5] : C[6]) : R.chance(0.6) ? D[3] : D[2]);
        }
        for (let k = 0; k < 4; k++) ps.spawn(P.EMBER, TX + R.range(-6, 6), -26 + R.range(-6, 6), R.range(-26, 30), -R.range(16, 60), R.range(0.4, 0.8), R.chance(0.5) ? D[2] : C[4], 1);
      }
      // thorn glints pop as the arc dissolves
      for (const g of GLINTS) if (t >= g.t && t - dt < g.t) {
        const [x, y] = whipPt(g.u, 0.5);
        for (let k = 0; k < 3; k++) {
          const a = R.range(0, TAU), v = R.range(20, 60);
          ps.spawn(P.SPARK, x, y, Math.cos(a) * v, Math.sin(a) * v, R.range(0.1, 0.24), C[6]);
        }
      }
      ps.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-6) return;
      // oppression: the light drains out round the coil, and the raised whip coils behind the hunter
      const gk = smooth(-0.2, 0.0, t) * (1 - smooth(0.34, 0.62, t));
      if (gk > 0.02) {
        unlight(p, -50, -104, 60, 4, (x, y) => {
          const d = Math.hypot((x - 4) / 56, (y + 44) / 62);
          return d < 1;
        }, 1 - 0.66 * gk);
      }
      const vk = smooth(-0.16, -0.02, t) * (1 - smooth(T_CRACK - 0.02, T_CRACK + 0.1, t));
      if (vk > 0.02) {
        // a thorned vine reared up behind the hunter, swaying, about to crack forward
        for (let i = 0; i <= 22; i++) {
          const u = i / 22;
          const x = HX - 2 - Math.sin(u * 2.2) * 30 + Math.sin(t * 6) * 1.5 * u;
          const y = HY + 4 - u * 74 - Math.sin(u * 3.1) * 8;
          const w = 2.6 * (1 - u) + 0.5;
          for (let q = -w; q <= w; q += 0.5) {
            p.dot(x + q, y + q * 0.3, Math.abs(q) > w - 0.9 ? B[2] : q < 0 ? B[1] : B[0], 0.9 * vk);
          }
          if (i % 4 === 2) {
            const sd = i % 8 === 2 ? 1 : -1;
            p.dot(x + sd * (w + 1.5), y - 1, B[3], 0.9 * vk);
            p.dot(x + sd * (w + 2.5), y - 2, C[4], 0.8 * vk);
          }
        }
        p.glow(HX - 16, HY - 52, 12, C[3], 0.3 * vk);
      }
      simDraw(p, ps, H, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;
      const uq = t - T_CRACK;
      const head = ease.outExpo(clamp(uq / SWEEP, 0, 1));
      const tail = smooth(0.22, 0.56, uq);
      const bandA = 1 - smooth(0.38, 0.6, uq);

      // ---- the S-curved lash arc: bark-brown edges, dark green body, white-hot cracking head
      if (uq >= 0 && bandA > 0.01 && head - tail > 0.01) {
        const U = head, T0 = tail * head;
        for (let uu = T0; uu <= U; uu += 0.015) {
          const [x, y] = whipPt(uu, t);
          const [x2, y2] = whipPt(Math.min(1, uu + 0.015), t);
          const dx = x2 - x, dy = y2 - y, L = Math.hypot(dx, dy) || 1;
          const px = -dy / L, py = dx / L;
          const w = lerp(2.6, 0.6, uu) * (1 - tail * 0.45);
          const hot = uu > U - 0.18;
          const aIn = smooth(T0, T0 + 0.05, uu) * bandA;
          for (let q = -w; q <= w; q += 0.5) {
            const f = Math.abs(q) / w;
            const col = hot ? (f > 0.6 ? C[6] : C[7]) : f > 0.84 ? B[3] : f > 0.55 ? (q > 0 ? B[2] : B[1]) : f > 0.3 ? C[2] : uu > U - 0.3 ? C[5] : C[3];
            p.dot(x + px * q, y + py * q, col, aIn * (f > 0.85 ? 0.75 : 1));
          }
          // thorns studding the lash
          for (const th of THORNS) {
            if (Math.abs(th.u - uu) > 0.007 || th.u < T0 || th.u > U) continue;
            for (let d = 1; d <= th.len; d += 0.5) p.dot(x + px * th.side * (w + d), y + py * th.side * (w + d), d > th.len - 1 ? C[6] : B[3], aIn);
          }
        }
        // light riding the lash
        const [hx2, hy2] = whipPt(U, t);
        lights.add(hx2, hy2, 10, C[5], 0.85 * bandA);
        for (let uu = T0; uu <= U; uu += 0.12) {
          const [lx, ly] = whipPt(uu, t);
          lights.add(lx, ly, 4.5, C[4], 0.3 * bandA * smooth(T0, T0 + 0.1, uu));
        }
      }

      // ---- thorn glints left behind as the arc dissolves
      for (const g of GLINTS) {
        const q = t - g.t;
        if (q < 0 || q > 0.16) continue;
        const [x, y] = whipPt(g.u, 0.5);
        const k = 1 - q / 0.16;
        const sc = 0.55 * (0.4 + 0.6 * ease.outQuad(clamp(q / 0.04, 0, 1)));
        star(p, x, y, [{ a: 0, len: 5, w: 0.9 }, { a: Math.PI / 2, len: 5, w: 0.9 }, { a: Math.PI, len: 5, w: 0.9 }, { a: -Math.PI / 2, len: 5, w: 0.9 }], sc, 0.7, [C[4], C[6], C[7], WHITE], k, 1.1);
        lights.add(x, y, 6, C[6], 0.5 * k);
      }

      // ---- the rend: a diagonal tearing green slash across the enemy, dark-red seam inside
      const rq = t - T_HIT;
      if (rq >= 0) {
        const sa = ease.outQuad(clamp(rq / 0.06, 0, 1));
        const fade = 1 - smooth(0.85, 1.35, rq);
        if (fade > 0.01) {
          const dx = REND.x1 - REND.x0, dy = REND.y1 - REND.y0, L = Math.hypot(dx, dy);
          const px = -dy / L, py = dx / L;
          const jit = 1 + 0.6 * Math.exp(-rq * 9) * Math.sin(rq * 60);
          for (let s = 0; s <= sa; s += 0.02) {
            const nz = noise(s * 9, S) * 1.3;
            const x = lerp(REND.x0, REND.x1, s) + px * nz, y = lerp(REND.y0, REND.y1, s) + py * nz;
            const tip = s > sa - 0.06;
            p.dot(x + px * 1.1 * jit, y + py * 1.1 * jit, C[3], 0.85 * fade);
            p.dot(x, y, rq < 0.07 ? WHITE : tip ? C[7] : C[6], fade);
            p.dot(x - px * 0.9, y - py * 0.9, C[4], 0.9 * fade);
            p.dot(x - px * 1.9, y - py * 1.9, D[2], 0.8 * fade); // the dark-red seam inside the tear
            p.dot(x - px * 2.8, y - py * 2.8, D[1], 0.55 * fade);
            if (Math.floor(s * 25) % 6 === 0) p.dot(x + px * 2.2, y + py * 2.2, C[6], 0.7 * fade); // torn barbs
          }
          lights.add((REND.x0 + REND.x1) / 2, (REND.y0 + REND.y1) / 2, 11 * sa, C[5], 0.6 * fade);
          // sap dripping out of the wound
          if (rq > 0.25 && rq < 1.15) {
            for (let i = 0; i < 2; i++) {
              const fq = (rq - 0.25 - i * 0.18) * 26;
              const dy2 = fq % 16;
              if (fq > 0 && fq < 20) p.dot(REND.x0 + 6 + i * 6 + Math.sin(i * 5) * 2, REND.y0 + 12 + dy2, i ? C[5] : C[4], (1 - dy2 / 16) * fade);
            }
          }
        }
        // the burst flare where the lash cut through: emerald and dark-red woven
        if (rq < 0.22) {
          const k = 1 - rq / 0.22;
          star(p, TX + 1, -25, FLARE, 0.4 + 0.8 * ease.outQuad(clamp(rq / 0.06, 0, 1)), 0.8, [D[2], C[4], C[6], C[7]], k, 1.7);
          lights.add(TX + 1, -25, 14, C[5], 1.1 * k);
          lights.add(TX + 1, -25, 7, D[3], 0.7 * k);
        }
      }

      simDraw(p, ps, H, "front");
      lights.draw(p);
    },
  };
}
