// Poison sting needle volley ("moves/poison-sting-volley"): a hunter flicks three thin glowing wood-thorn
// needles out of a condensing thorn halo, each one crossing the gap in a blink and trailing a long hair-thin
// cyan-violet streamer; every needle sticks in the enemy and detonates into a small but blinding green-violet
// cross spark, quivers in the wound, then dissolves while light poison smoke leaks off the impacts and a
// toxic sheen pools under the staggering target.
import { Particles, Lights, P, Rng, fit, clamp, smooth, lerp, ease, noise, rand, TAU, WHITE, mix, hex, READY } from "../../core/index.js";
import { star, brokenRing } from "../impacts/_lib.js";
import { gasPuff } from "../nature/_lib.js";
import { floorLight, hotFirst } from "../fire/_lib.js";
import { unlight } from "../shadow/_lib.js";
import { simDraw } from "../fire/_lib.js";

const MX = 16, MY = -26; // needle muzzle at the snapping hand
const FIRE = [0.22, 0.34, 0.46];
const FLIGHT = 0.09; // brutally fast: the gap closes in three frames
const HITS = FIRE.map((f) => f + FLIGHT);
const IMP = [{ x: 176, y: -30 }, { x: 182, y: -21 }, { x: 179, y: -26 }]; // staggered wound heights
const T_END = 1.9;

export const meta = {
  name: "Poison sting volley",
  desc: "Three hair-thin glowing wood-thorn needles whip out of a thorn halo at blinding speed, stick in the enemy and pop into bright green-violet cross sparks with leaking poison smoke.",
  tags: ["move", "poison", "sting", "needle", "thorn", "volley", "ranged", "toxin", "one-shot"],
  size: [360, 184],
  origin: [64, 132],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#0b0614", "#1d4a14", "#2b7316", "#54b622", "#98ea2c", "#ddff64", "#f6ffd6", "#ffffff"],
    sheen: ["#221038", "#642ea0", "#8f5cff", "#7ce8c8"],
    seed: 41,
  },
};

const GUARD = { ...READY, x: 0, crouch: 3, lean: 1, fx: 10, fy: -22, bx: 8, by: -20, ffx: 7, fbx: -7 };
const COIL = { ...READY, x: -3, crouch: 6, lean: -4, fx: 6, fy: -24, bx: 10, by: -22, ffx: 6, fbx: -8 };
const SNAP1 = { ...READY, x: 4, crouch: 3, lean: 6, fx: 14, fy: -26, bx: 14, by: -24, ffx: 10, fbx: -6 };
const SNAP2 = { ...READY, x: 3, crouch: 3, lean: 5, fx: 14, fy: -26, bx: 13, by: -24, ffx: 10, fbx: -6 };
const SNAP3 = { ...READY, x: 5, crouch: 4, lean: 7, fx: 15, fy: -26, bx: 15, by: -24, ffx: 11, fbx: -6, ghost: 1 };
const HOLD = { ...READY, x: 4, crouch: 4, lean: 4, fx: 12, fy: -25, bx: 14, by: -23, ffx: 9, fbx: -6 };
const RECOVER = { ...READY, x: 1, crouch: 2, lean: 1, fx: 9, fy: -21, bx: 9, by: -20, ffx: 7, fbx: -7 };

export const act = {
  target: { x: 180 },
  poses: [
    [-0.26, GUARD],
    [-0.1, COIL],
    [FIRE[0], SNAP1, "snap"],
    [FIRE[1], SNAP2, "snap"],
    [FIRE[2], SNAP3, "snap"],
    [0.62, HOLD],
    [1.15, RECOVER],
    [T_END, READY],
  ],
  hits: [
    { t: HITS[0], stop: 0.03, shake: 0.12, amp: 1.6, push: 1.5, straw: 4, y: -29, skin: "poison", shiver: 0.18, flash: 0 },
    { t: HITS[1], stop: 0.03, shake: 0.14, amp: 1.8, push: 1.7, straw: 5, y: -21, skin: "poison", shiver: 0.22, flash: 0 },
    { t: HITS[2], stop: 0.09, shake: 0.3, amp: 3, push: 3.4, straw: 12, y: -26, skin: "poison", shiver: 0.4, flash: 0 },
    { t: 1.35, stop: 0, shake: 0, amp: 0, push: 0, straw: 0, flash: 0, skin: null },
  ],
  dust: [
    { t: FIRE[2], x: 4, n: 4, dir: -1 },
    { t: HITS[2], x: 178, n: 6, dir: 1 },
  ],
};

export function create(o) {
  const C = fit(o.palette, 8), Sh = fit(o.sheen, 4), H = hotFirst(C);
  const R = new Rng(o.seed), S = o.seed * 23;
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [C[7], C[6], C[5], WHITE], haze: C[3] });
  const lights = new Lights();

  // a pure cross: four long points plus four stub diagonals so the spark reads as a star-cross, not a plus sign
  const CROSS = [0, 1, 2, 3].map((i) => ({ a: (i / 4) * TAU, len: 11 + (i % 2), w: 1.2 }))
    .concat([0, 1, 2, 3].map((i) => ({ a: (i / 4) * TAU + TAU / 8, len: 3.1, w: 0.8 })));
  const RING_SEGS = Array.from({ length: 5 }, (_, i) => ({ a: (i / 5) * TAU + 0.4, gap: 0.34, dr: 0.9 + i * 0.22 }));

  // two smoke wisps per wound, pre-rolled so the drift is stable frame to frame
  const WISPS = IMP.map((im, i) => [0, 1].map((w) => ({
    x: im.x + 2 + w * 5 + rand(S + i * 7 + w) * 4 - 2,
    dy: rand(S + i * 13 + w) * 6 - 3,
    rise: 13 + rand(S + i * 3 + w) * 6,
    drift: 8 + rand(S + i * 5 + w) * 6,
    r: 2.2 + rand(S + i * 11 + w) * 1.4,
    delay: w * 0.12 + i * 0.04,
  })));

  let t = 0;
  return {
    update(dt) {
      t += dt;
      // the halo drinks motes in while it condenses
      if (t < FIRE[0] && R.chance(1.5 * dt * 60)) {
        const a = R.range(0, TAU), d = R.range(14, 34);
        ps.spawn(P.STREAK, MX + 2 + Math.cos(a) * d, MY - 12 + Math.sin(a) * d, -Math.cos(a) * 130, -Math.sin(a) * 130, R.range(0.07, 0.14), R.chance(0.5) ? Sh[3] : C[5], 1);
      }
      for (let i = 0; i < 3; i++) {
        // muzzle whip-crack
        if (t >= FIRE[i] && t - dt < FIRE[i]) {
          for (let k = 0; k < 6; k++) {
            const a = R.range(-0.5, 0.5), v = R.range(60, 150);
            ps.spawn(P.SPARK, MX + 2, MY, Math.cos(a) * v, Math.sin(a) * v * 0.5, R.range(0.08, 0.2));
          }
        }
        // impact: hot sparks plus a curl of poison smoke off the wound
        if (t >= HITS[i] && t - dt < HITS[i]) {
          for (let k = 0; k < 9; k++) {
            const a = R.range(0, TAU), v = R.range(40, 130);
            ps.spawn(P.SPARK, IMP[i].x, IMP[i].y, Math.cos(a) * v, Math.sin(a) * v - 20, R.range(0.1, 0.3), R.chance(0.4) ? Sh[2] : undefined);
          }
          ps.spawn(P.SMOKE, IMP[i].x + 1, IMP[i].y - 2, 6, -14, 0.7, 0, 1.5);
          ps.spawn(P.SMOKE, IMP[i].x - 2, IMP[i].y + 2, 4, -10, 0.85, 0, 1.2);
        }
      }
      ps.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-6) return;
      // thorn halo: seven dark thorns orbit the gathering point, tightening until the first shot
      const hk = smooth(-0.22, -0.06, t) * (1 - smooth(FIRE[0] - 0.04, FIRE[0] + 0.05, t));
      if (hk > 0.02) {
        const rad = lerp(15, 5, smooth(-0.1, FIRE[0], t));
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + t * 2.6 + Math.sin(t * 5 + i) * 0.06;
          const tx = MX + 2 + Math.cos(a) * rad, ty = MY - 12 + Math.sin(a) * rad * 0.8;
          const bx2 = MX + 2 + Math.cos(a) * (rad + 4.5), by2 = MY - 12 + Math.sin(a) * (rad + 4.5) * 0.8;
          p.dot(bx2, by2, Sh[1], 0.8 * hk);
          p.dot(lerp(bx2, tx, 0.4), lerp(by2, ty, 0.4), Sh[2], 0.7 * hk);
          p.dot(lerp(bx2, tx, 0.75), lerp(by2, ty, 0.75), C[4], 0.8 * hk);
          p.dot(tx, ty, C[6], hk);
          p.glow(tx, ty, 2.5, C[5], 0.5 * hk);
        }
        p.glow(MX + 2, MY - 12, 9 + 3 * Math.sin(t * 12), Sh[2], 0.4 * hk);
      }
      // oppression: the void drinks the light around the condensing halo
      const gk = smooth(-0.2, 0.02, t) * (1 - smooth(0.5, 0.85, t));
      if (gk > 0.02) {
        unlight(p, -46, -96, 46, 4, (x, y) => {
          const d = Math.hypot(x / 52, (y + 40) / 60);
          return d < 1;
        }, 1 - 0.7 * gk);
      }
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;
      for (let i = 0; i < 3; i++) {
        // muzzle whip-crack: a two-frame lash of light where the needle leaves the hand
        const mf = t - FIRE[i];
        if (mf >= 0 && mf < 0.08) {
          const k = 1 - mf / 0.08;
          star(p, MX + 3, MY, CROSS, 0.55 * k + 0.2, 0.7, [Sh[2], C[4], C[6], C[7]], k, 1.2);
          for (let d = 0; d < 4; d++) p.dot(MX + 4 + d * 2, MY + (d % 2 ? 1 : -1) * 0.5, Sh[3], k * (1 - d / 4));
          lights.add(MX + 4, MY, 9, Sh[3], 0.7 * k);
        }

        // the needle in flight: a sharp wood sliver dragging a hair-thin cyan-violet streamer
        const u = (t - FIRE[i]) / FLIGHT;
        if (u >= 0 && u < 1) {
          const hx = lerp(MX + 3, IMP[i].x, u), hy = lerp(MY, IMP[i].y, u);
          const dx = IMP[i].x - MX - 3, dy = IMP[i].y - MY, L = Math.hypot(dx, dy);
          const ux = dx / L, uy = dy / L;
          const tail = 20 + 46 * ease.outQuad(u); // the streamer stretches as it flies
          for (let s = 0; s <= 1.001; s += 0.045) {
            const x = hx - ux * tail * s, y = hy - uy * tail * s + Math.sin(s * 9 + t * 40 + i) * 0.35 * s;
            p.dot(x, y, mix(Sh[3], Sh[1], s), (1 - s));
            if (s < 0.4) p.dot(x, y + (i % 2 ? 1 : -1), Sh[2], (0.4 - s) * 0.8);
            if (s < 0.5) p.dot(x, y + (s < 0.25 ? -1 : 1), mix(Sh[2], Sh[0], s * 2), (0.5 - s) * 0.7);
          }
          // speed streaks flicking past the head
          p.dot(hx - ux * 9, hy - uy * 9 - 2, Sh[3], 0.35);
          p.dot(hx - ux * 11, hy - uy * 11 + 2, Sh[3], 0.3);
          // the thorn itself: white-hot tip, chartreuse body, dark wood butt, violet under-edge
          p.dot(hx, hy, C[7], 1);
          p.dot(hx - ux * 1.5, hy - uy * 1.5, C[6], 1);
          p.dot(hx - ux * 3, hy - uy * 3, C[4], 1);
          p.dot(hx - ux * 4.5, hy - uy * 4.5, C[3], 1);
          p.dot(hx - ux * 6, hy - uy * 6, C[2], 1);
          p.dot(hx - ux * 3, hy - uy * 3 + 1, Sh[2], 0.7);
          lights.add(hx, hy, 7, Sh[3], 0.7);
          lights.add(hx - ux * 4, hy - uy * 4, 4, C[4], 0.4);
        }

        // hit result: a small but blinding green-violet cross spark
        const q = t - HITS[i];
        if (q >= 0 && q < 0.26) {
          const grow = ease.outQuad(clamp(q / 0.05, 0, 1));
          const a = 1 - smooth(0.12, 0.26, q);
          const sc = (i === 2 ? 1.35 : 1.1) * (0.3 + 0.7 * grow);
          star(p, IMP[i].x, IMP[i].y, CROSS, sc, 0.78, [Sh[1], C[4], C[6], C[7]], a, 1.9);
          if (q < 0.05) p.circle(IMP[i].x, IMP[i].y, 2.4 - q * 30, C[7], 1 - q * 16);
          lights.add(IMP[i].x, IMP[i].y, 14, C[5], 1.25 * a);
          lights.add(IMP[i].x, IMP[i].y, 7, WHITE, 0.9 * a);
          if (i === 2) brokenRing(p, IMP[i].x, IMP[i].y, 4 + 12 * ease.outCubic(q / 0.26), 1.2, RING_SEGS, q * 3.4, Sh[2], C[5], a);
          // four micro flacks kicked off the cross points
          for (let k = 0; k < 4; k++) {
            const a2 = (k / 4) * TAU + 0.3, d = 4 + 9 * ease.outQuad(q / 0.26);
            p.dot(IMP[i].x + Math.cos(a2) * d, IMP[i].y + Math.sin(a2) * d, k % 2 ? Sh[3] : C[6], a * 0.8);
          }
        }

        // the needle stays stuck in the wound, quivering, then dissolves into droplets
        const q2 = t - HITS[i];
        if (q2 >= 0.01 && q2 < 0.62) {
          const wob = Math.sin(q2 * 46) * 2.2 * Math.exp(-q2 * 7);
          const fade = 1 - smooth(0.46, 0.62, q2);
          const ix = IMP[i].x + 1, iy = IMP[i].y;
          for (let s = 0; s <= 7; s += 0.5) {
            const f = s / 7; // 0 at the buried tip, 1 at the protruding butt
            const x = ix - 2 - s, y = iy + wob * f * f + f * 1.2;
            const col = s < 1.5 ? C[5] : s < 4 ? C[3] : C[1];
            p.dot(x, y, col, fade);
            if (s > 1.5 && s < 6) p.dot(x, y - 1, s < 3.5 ? C[5] : Sh[2], 0.6 * fade);
          }
          p.glow(ix - 3, iy, 4, C[4], 0.35 * fade);
          if (q2 > 0.46) {
            const dk = (q2 - 0.46) / 0.16;
            p.dot(ix - 4, iy + 2 + dk * 5, C[4], (1 - dk) * 0.8);
            p.dot(ix - 2, iy + 1 + dk * 7, C[3], (1 - dk) * 0.7);
          }
        }

        // light poison smoke leaking off each wound
        for (const w of WISPS[i]) {
          const q3 = t - HITS[i] - w.delay;
          if (q3 < 0 || q3 > 0.85) continue;
          const f = q3 / 0.85;
          gasPuff(p, w.x + f * w.drift + Math.sin(t * 5 + w.r * 9) * 1.4, IMP[i].y - 2 - f * w.rise + w.dy * f,
            w.r + 4.2 * ease.outQuad(f), 0.22 * (1 - f) * (0.4 + 0.6 * smooth(0, 0.12, q3)),
            C[1], C[2], C[3], Sh[2]);
        }
      }

      // toxic sheen pooling under the staggered enemy
      const pk = smooth(0.6, 0.85, t) * (1 - smooth(1.5, T_END, t));
      if (pk > 0.02) {
        p.shade(IMP[2].x - 18, -1, IMP[2].x + 18, 4, (x, y, out) => {
          const dx = (x - IMP[2].x) / 18, dy = (y - 1) / 3, d = dx * dx + dy * dy;
          if (d >= 1) return;
          const edge = d > 0.72;
          out.a = (edge ? 0.5 : 0.34) * pk;
          out.c = edge ? C[3] : C[2];
        });
        for (let i = 0; i < 5; i++) {
          const sx = IMP[2].x - 12 + i * 6 + Math.sin(t * 3 + i * 2) * 1.5;
          p.dot(sx, 1 - (i % 2), noise(t * 4 + i * 3, S) > 0.5 ? C[4] : C[5], 0.5 * pk);
        }
        floorLight(p, IMP[2].x, 1, 20, 5, C[3], 0.4 * pk);
      }

      simDraw(p, ps, H, "front");
      lights.draw(p);
      // the third wound gulps the light: a brief void beat while the poison smoke leaks off
      const vk = smooth(HITS[2] + 0.05, HITS[2] + 0.12, t) * (1 - smooth(HITS[2] + 0.3, HITS[2] + 0.55, t));
      if (vk > 0.02) {
        unlight(p, IMP[2].x - 40, -88, IMP[2].x + 40, 6, (x, y) => {
          const d = Math.hypot((x - IMP[2].x) / 44, (y + 30) / 52);
          return d < 1;
        }, 1 - 0.7 * vk);
      }
    },
  };
}
