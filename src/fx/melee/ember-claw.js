import { Particles, Lights, P, Rng, fit, sparkle, clamp, smooth, ease, READY } from "../../core/index.js";
import { simDraw, firePuff, flameTongue, noiseFor } from "../fire/_lib.js";

export const meta = {
  name: "Ember claw",
  desc: "Three staggered fiery claw arcs sweep from top-left to bottom-right as translucent heat trails, sparking a white-hot impact, a ring of ground embers and a fast-cooling flame.",
  tags: ["melee", "claw", "fire", "ember", "swipe", "beast", "combat", "directional", "one-shot"],
  size: [136, 96],
  origin: [38, 82],
  duration: 0.68,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#1a0f0a", "#4a1a10", "#7d2a12", "#b84416", "#e0701c", "#f5a429", "#ffd166", "#fff4c9"],
    sparks: ["#fff4c9", "#ffd166", "#f5a429", "#b84416"],
    seed: 11,
  },
};

const READY_ = { ...READY, weapon: "claw", offWeapon: "claw", sa: -0.4, sb: -0.9, crouch: 5, lean: 3, fx: 14, fy: -21, bx: 8, by: -25, ffx: 9, fbx: -8 };
const HIGH = { ...READY_, x: -5, crouch: 4, lean: -3, fx: 2, fy: -40, sa: -1.4, bx: 7, by: -18, sb: -0.3, ffx: 10 };
export const act = {
  target: { x: 56 },
  poses: [
    [-0.4, { ...READY_, x: -5 }],
    [-0.18, HIGH],
    [-0.04, { ...HIGH, crouch: 5 }],
    [0, { ...READY_, x: 1, crouch: 3, lean: 4, fx: 18, fy: -35, sa: -0.8, bx: -6, by: -24, ghost: 1 }, "snap"],
    [0.05, { ...READY_, x: 2, crouch: 5, lean: 6, fx: 22, fy: -24, sa: 0.4, bx: -7, by: -24, ffx: 13, fbx: -10, toeB: true }, "snap"],
    [0.1, { ...READY_, x: 3, crouch: 6, lean: 6, fx: 22, fy: -14, sa: 1.0, bx: -7, by: -24, ffx: 13, fbx: -10, toeB: true }, "snap"],
    [0.36, { ...READY_, x: 3, crouch: 5, lean: 5, fx: 21, fy: -15, sa: 0.95, bx: -6, by: -22, ffx: 13, fbx: -10 }],
    [0.68, { ...READY_, x: -5 }],
  ],
  hits: [
    { t: 0.05, stop: 0.03, push: 0.9, straw: 5, y: -24, flash: 0.03 },
    { t: 0.09, stop: 0.08, shake: 0.14, amp: 2, push: 1.6, straw: 10, y: -12, skin: "char" },
  ],
  dust: [{ t: 0.08, x: 14, n: 6, dir: 1 }],
};

const NL = noiseFor(0);

export function create(o) {
  const C = fit(o.palette, 8), n = C.length, S = fit(o.sparks, 4), H = [...C].reverse();
  const R = new Rng(o.seed), floor = () => 0;
  const A = o.actor;
  const ox = A ? A.x + (A.w >> 1) : 0, oy = A ? A.y + A.h : 0;
  const [cx0, cy0] = A?.chest ?? [0, -26];
  const ps = new Particles({ rng: R, ground: floor, sparks: S }), lights = new Lights();

  // Three staggered claw marks with distinct curvature (r), angular length, and start delay
  const specs = [
    { r: 35, w: 5.2, a0: -0.98, a1: -0.14, t0: 0.0, sweep: 0.05, hold: 0.08, trail: 0.27 },
    { r: 45, w: 6.4, a0: -1.18, a1: -0.03, t0: 0.04, sweep: 0.055, hold: 0.09, trail: 0.29 },
    { r: 55, w: 5.4, a0: -1.06, a1: -0.06, t0: 0.08, sweep: 0.05, hold: 0.08, trail: 0.28 },
  ];

  const claws = specs.map((s, i) => {
    // Asymmetric short flame edges trailing tangentially off the outer rim
    const flames = [0.26, 0.5, 0.72, 0.87].map((uBase) => ({
      u: clamp(uBase + R.range(-0.05, 0.05), 0.18, 0.92),
      len: R.range(2.4, 4.4),
      lift: R.range(8, 18),
    }));
    // Peeling rim fragments that flake off as the claw trail dissolves
    const flakes = Array.from({ length: 6 }, (_, k) => ({
      u0: 0.14 + k * 0.14 + R.range(-0.03, 0.03),
      du: R.range(0.06, 0.11),
      vx: R.range(4, 15),
      vy: -R.range(10, 24),
    }));
    return {
      ...s,
      i,
      launched: false,
      struck: false,
      peeled: false,
      hx: ox + Math.cos(s.a1) * (s.r - s.w * 0.3),
      hy: oy + Math.sin(s.a1) * (s.r - s.w * 0.3),
      flames,
      flakes,
    };
  });

  const impX = claws[1].hx, impY = -1;
  const ringSparks = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2 + R.range(-0.12, 0.12);
    return {
      a,
      rx: R.range(9, 22),
      ry: R.range(2.2, 4.8),
      life: R.range(0.34, 0.52),
      size: R.chance(0.35) ? 2 : 1,
    };
  });

  let t = 0, hitT = -1;

  return {
    update(dt) {
      t += dt;
      for (const c of claws) {
        if (!c.launched && t >= c.t0) {
          c.launched = true;
          const sx = cx0 + (A ? A.w * 0.38 : 9) + R.range(-2, 2);
          const sy = cy0 - 5 + c.i * 3;
          ps.spawn(P.EMBER, sx, sy, R.range(22, 48), R.range(-24, 6), R.range(0.24, 0.42), C[6], 1);
        }
        if (!c.struck && t >= c.t0 + c.sweep * 0.85) {
          c.struck = true;
          lights.add(c.hx, c.hy - 4, 20, C[5], 0.28, 0.24);
          for (let j = 0; j < 6; j++) {
            const a = R.range(-2.35, -0.25), sp = R.range(75, 190);
            ps.spawn(P.SPARK, c.hx, c.hy, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.18, 0.38));
          }
          for (let j = 0; j < 5; j++) {
            const ang = c.a0 + (c.a1 - c.a0) * R.range(0.22, 0.9);
            const px = ox + Math.cos(ang) * c.r, py = oy + Math.sin(ang) * c.r;
            ps.spawn(P.MOTE, px, py, R.range(10, 34), -R.range(14, 38), R.range(0.2, 0.38), R.pick([C[6], C[5]]), 0.55);
          }
          if (c.i === 1) {
            hitT = t;
            lights.add(impX, -4, 28, C[5], 0.38, 0.34);
            // Small cluster of rapidly cooling fire at the landing point
            for (let j = 0; j < 5; j++) {
              ps.spawn(P.FIRE, impX + R.range(-3.5, 3.5), -R.range(1, 4), R.range(-14, 18), -R.range(16, 42), R.range(0.24, 0.42), 0, R.range(2.4, 3.6));
            }
            for (let j = 0; j < 9; j++) {
              const a = R.range(-2.65, -0.35), sp = R.range(80, 210);
              ps.spawn(P.SPARK, impX, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.2, 0.44));
            }
          }
        }
        if (!c.peeled && t >= c.t0 + c.sweep + c.hold * 0.7) {
          c.peeled = true;
          for (let j = 0; j < 5; j++) {
            const ang = c.a0 + (c.a1 - c.a0) * R.range(0.2, 0.88);
            const px = ox + Math.cos(ang) * c.r, py = oy + Math.sin(ang) * c.r;
            ps.spawn(P.EMBER, px, py, R.range(6, 24), -R.range(16, 42), R.range(0.24, 0.42), R.pick([C[5], C[4], C[3]]), 1);
          }
        }
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      if (t >= meta.duration - 1e-6) return;
      if (hitT >= 0) {
        const q = t - hitT;
        if (q >= 0 && q < 0.52) {
          const fade = 1 - smooth(0.28, 0.51, q);
          p.ellipse(impX, 0, 12, 2.5, C[1], fade * 0.75);
          p.ellipse(impX, 0, 7, 1.5, q < 0.16 ? C[4] : C[2], fade * 0.88);
        }
      }
      simDraw(p, ps, H, "back");
    },
    draw(p) {
      if (t >= meta.duration - 1e-6) return;
      const N = (rate, seed = 0, off = 0) => NL(t, rate, seed, off);

      if (A && t < 0.16) {
        const k = 1 - t / 0.16;
        p.glow(cx0 + A.w * 0.36, cy0 - 3, 15, C[4], 0.26 * k);
      }

      for (const c of claws) {
        const u = t - c.t0;
        if (u < 0) continue;
        const life = c.sweep + c.hold + c.trail;
        if (u >= life) continue;

        const span = c.a1 - c.a0;
        const head = ease.outExpo(clamp(u / c.sweep));
        const tail = smooth(c.sweep + c.hold, life, u);
        const age = clamp(u / life);
        const peel = smooth(c.sweep + c.hold * 0.5, life, u);

        const aStart = c.a0 + span * tail * 0.65;
        const aEnd = c.a0 + span * (head - tail * 0.18);
        const W = c.w * (1 - tail * 0.58);

        if (tail < 0.96 && aEnd - aStart > 0.03 && W > 0.6) {
          // 1) Claw arc centered at origin (ox, oy) using p.arc
          // Following _lib.js: 1px white-hot outer rim (q < 0.22), visible mid-tone golden-orange fill, dark-red inner edge;
          // alpha dissolves at the trailing tail (uu < 0.38) so the crescent stays clean and free of speckle
          const wAt = (uu) => W * Math.pow(Math.sin(Math.PI * Math.pow(clamp(uu, 0.02, 0.98), 1.35)), 0.68);
          p.arc(
            ox,
            oy,
            c.r,
            wAt,
            aStart,
            aEnd,
            (uu, vv) => {
              const ww = Math.max(1.2, wAt(uu));
              const q = 1 - vv; // 0 at outer rim, 1 at inner edge
              if (q < Math.max(0.22, 1.15 / ww) && age < 0.52) return C[n - 1];
              const ci = Math.round(q * (n - 1) * 0.72 + age * 2.4 - uu * 0.7 + 0.45);
              return C[n - 1 - clamp(ci, 0, n - 1)];
            },
            (uu, vv) => {
              const tailA = Math.min(1, uu / (vv > 0.76 ? 0.18 : 0.38));
              return tailA * (vv > 0.76 ? 1 : 0.86);
            }
          );

          // Continuous 1px outer contour line (p.polyline) while the claw mark is hot and intact (house rule 5.3)
          if (peel < 0.38) {
            const rimPts = [];
            const rSteps = 12;
            const rA0 = aStart + (aEnd - aStart) * 0.08;
            for (let s = 0; s <= rSteps; s++) {
              const ang = rA0 + (aEnd - rA0) * (s / rSteps);
              rimPts.push([ox + Math.cos(ang) * c.r, oy + Math.sin(ang) * c.r]);
            }
            p.polyline(rimPts, age < 0.42 ? C[n - 1] : C[n - 2], 1 - peel * 0.6);
          }

          // 2) Short flame edge trailed along the outer rim (p.beam)
          for (const fl of c.flames) {
            if (fl.u < tail * 0.65 || fl.u > head) continue;
            const ang = c.a0 + span * fl.u;
            const bx = ox + Math.cos(ang) * (c.r + 0.3);
            const by = oy + Math.sin(ang) * (c.r + 0.3) - peel * fl.lift * 0.25;
            const tang = ang - Math.PI * 0.42;
            const len = fl.len * (1 - age * 0.75);
            if (len > 0.8) {
              p.beam(
                bx,
                by,
                bx + Math.cos(tang) * len,
                by + Math.sin(tang) * len,
                1.6 * (1 - age * 0.5),
                (bu) => (bu < 0.4 ? (age < 0.4 ? C[6] : C[5]) : age < 0.45 ? C[4] : C[2]),
                Math.min(1, (1 - age) * 1.3)
              );
            }
          }

          p.glowLine(
            ox + Math.cos(aStart) * (c.r - 2),
            oy + Math.sin(aStart) * (c.r - 2),
            ox + Math.cos(aEnd) * (c.r - 2),
            oy + Math.sin(aEnd) * (c.r - 2),
            7,
            C[4],
            0.2 * (1 - age)
          );
        }

        // 3) Peeling / flaking outer edge fragments (p.polyline) that lift and dissolve after the strike
        if (peel > 0.08) {
          for (const fk of c.flakes) {
            if (fk.u0 > head) continue;
            const d0 = fk.vx * peel * 0.42, d1 = fk.vy * peel * 0.42;
            const fa0 = c.a0 + span * fk.u0;
            const faM = c.a0 + span * (fk.u0 + fk.du * 0.5 * (1 - peel * 0.35));
            const fa1 = c.a0 + span * (fk.u0 + fk.du * (1 - peel * 0.35));
            const pts = [
              [ox + Math.cos(fa0) * c.r + d0, oy + Math.sin(fa0) * c.r + d1],
              [ox + Math.cos(faM) * (c.r + 0.7) + d0, oy + Math.sin(faM) * (c.r + 0.7) + d1],
              [ox + Math.cos(fa1) * c.r + d0, oy + Math.sin(fa1) * c.r + d1],
            ];
            const col = peel < 0.4 ? C[5] : peel < 0.7 ? C[3] : C[2];
            p.polyline(pts, col, clamp((1 - peel) * 1.25, 0, 1));
          }
        }
      }

      // Impact point: 1-2 frame white-hot hero flash + ring of ground sparks + small rapidly cooling fire
      if (hitT >= 0) {
        const q = t - hitT;
        // 2-frame white-hot hero flash at the landing point
        if (q >= 0 && q < 0.066) {
          const hero = q < 0.033 ? 1 : 0.74;
          p.beam(impX - 6 * hero, impY - 2, impX + 6 * hero, impY - 2, 2.2 * hero, C[7]);
          p.circle(impX, impY - 2, 3.6 * hero, C[6]);
          p.circle(impX, impY - 2, 2.2 * hero, C[7]);
          sparkle(p, impX, impY - 2, 7 * hero, C[7], C[5], 0.6);
          p.glow(impX, impY - 2, 16, C[7], 0.38 * hero);
        }
        // Small cluster of rapidly cooling fire at the landing spot
        if (q >= 0.015 && q < 0.44) {
          const fk = 1 - (q - 0.015) / 0.425;
          flameTongue(p, impX, 0, 9.5 * fk, 2.8 * fk, 1.5 * (1 - fk), N, 7, H);
          firePuff(p, impX, -2.5 - (1 - fk) * 4.5, fk, 3.8, 0.06, H, 0.15);
          firePuff(p, impX - 3.5, -1.5 - (1 - fk) * 3, fk * 0.85, 2.6, 0.2, H, 0.11);
          firePuff(p, impX + 3.5, -1.5 - (1 - fk) * 3, fk * 0.85, 2.6, 0.2, H, 0.11);
        }
        // Ring of ground sparks expanding on the floor
        if (q >= 0 && q < 0.52) {
          for (const gs of ringSparks) {
            if (q >= gs.life) continue;
            const k = 1 - q / gs.life;
            const expand = 0.25 + 0.75 * ease.outQuart(q / gs.life);
            const sx = impX + Math.cos(gs.a) * gs.rx * expand;
            const sy = impY + Math.sin(gs.a) * gs.ry * expand;
            const col = k > 0.65 ? S[0] : k > 0.36 ? S[1] : k > 0.16 ? S[2] : S[3];
            p.px(sx, sy, col);
            if (gs.size > 1 && k > 0.42) p.px(sx + (Math.cos(gs.a) > 0 ? 1 : -1), sy, S[2]);
            p.light(sx, sy, col, 0.34 * k);
          }
        }
      }

      simDraw(p, ps, H, "front");
      lights.draw(p);
    },
  };
}
