import { Particles, Lights, P, Rng, fit, sparkle, clamp, smooth, ease, TAU, READY } from "../../core/index.js";

export const meta = {
  name: "Frost blade",
  desc: "A wide top-left to bottom-right slash with a 1-2px blood-red core wrapped in serrated cyan-white frost bursts into snow shavings, a white-hot flash and sparse blood stars.",
  tags: ["melee", "blade", "slash", "ice", "frost", "blood", "combat", "directional", "one-shot"],
  size: [148, 100],
  origin: [46, 84],
  duration: 0.68,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    blood: ["#14040a", "#3a0a14", "#6a101c", "#a01824", "#d42a30", "#ff5a50"],
    palette: ["#08181c", "#0d2e34", "#12474f", "#196a74", "#21909c", "#37b8c4", "#79dde6", "#c4f4f8"],
    frost: ["#1a2228", "#2e3d46", "#4d616e", "#728c9a", "#9fb4c0", "#c8d8e2", "#eaf4f8", "#ffffff"],
    seed: 7,
  },
};

const GUARD = { ...READY, weapon: "sword", fx: 12, fy: -21, sa: -0.85 };
const WIND = { ...GUARD, x: -7, crouch: 4, lean: -4, fx: -7, fy: -35, sa: -2.6, bx: 9, by: -25, armsFront: true, ffx: 9, fbx: -8 };
const CUT = { ...GUARD, x: 1, crouch: 2, lean: 3, fx: 16, fy: -36, sa: -1.35, bx: -7, by: -24, ffx: 11, fbx: -10, ghost: 1 };
const DOWN = { ...GUARD, x: 3, crouch: 5, lean: 5, fx: 21, fy: -19, sa: 0.65, bx: -9, by: -24, ffx: 13, fbx: -10, toeB: true };

export const act = {
  target: { x: 56 },
  poses: [
    [-0.5, { ...GUARD, x: -7 }],
    [-0.26, WIND],
    [-0.07, { ...WIND, crouch: 5, lean: -5 }],
    [0, CUT, "snap"],
    [0.06, DOWN, "snap"],
    [0.28, { ...DOWN, x: 4, crouch: 6 }],
    [0.52, { ...GUARD, x: 1, crouch: 3, fx: 15, fy: -21, sa: 0.1, bx: -5, by: -21, ffx: 9, fbx: -7 }],
    [0.68, { ...GUARD, x: -7 }],
  ],
  hits: [{ t: 0.06, stop: 0.12, shake: 0.16, amp: 2, push: 2.6, straw: 16, skin: "ice" }],
  dust: [{ t: 0.06, x: 15, n: 6, dir: 1 }, { t: 0.06, x: -10, n: 3, dir: -1 }],
};

export function create(o) {
  // Three strictly independent color ramps — never merged into a single array
  const B = fit(o.blood, 6);
  const C = fit(o.palette, 8);
  const F = fit(o.frost, 8);

  const R = new Rng(o.seed), floor = () => 0;
  const A = o.actor;
  const [cx0, cy0] = A?.chest ?? [0, -26];
  // Read character sword-hand / shoulder pivot from o.actor so the blade arc sweeps directly from the hand path
  const handX = cx0 + (A ? Math.round(A.w * 0.25) : 6);
  const handY = cy0 + 2;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [F[7], F[6], C[7], C[5]],
    haze: C[2],
  });
  const lights = new Lights();

  // Wide crescent sweeping from top-left behind the raised hand (a0 = -2.24) to bottom-right (a1 = 0.12).
  // Inner radius (~28px) tracks the warrior's swinging hand arc around the shoulder pivot (cx, cy).
  const ARC = {
    cx: handX - 2,
    cy: handY + 14,
    rBase: 45,
    rMax: 52,     // includes outer sawtooth frost serration height
    wMax: 16.5,   // wide crescent body for speed & weight
    a0: -2.24,    // top-left behind the warrior's raised wind-up hand
    a1: 0.12,     // bottom-right impact point just above the floor
    sweep: 0.062,
    hold: 0.062,
    trail: 0.25,
  };
  const SPAN = ARC.a1 - ARC.a0;

  // 8 asymmetric, swept-back sawtooth frost serrations along the wide outer rim (unequal widths & heights)
  const SER_SPECS = [
    { u0: 0.07, u1: 0.17, h: 3.0, notch: 1.3 },
    { u0: 0.17, u1: 0.28, h: 4.5, notch: 1.7 },
    { u0: 0.28, u1: 0.40, h: 5.6, notch: 2.1 },
    { u0: 0.40, u1: 0.51, h: 4.4, notch: 1.8 },
    { u0: 0.51, u1: 0.64, h: 5.8, notch: 2.2 },
    { u0: 0.64, u1: 0.75, h: 4.6, notch: 1.7 },
    { u0: 0.75, u1: 0.86, h: 3.8, notch: 1.5 },
    { u0: 0.86, u1: 0.96, h: 2.8, notch: 1.1 },
  ].map((s) => ({
    ...s,
    driftR: R.range(3.2, 6.4),
    driftAng: R.range(-0.06, 0.04),
  }));

  // Swept-back linear sawtooth profile: peaks sharply near the rear of each tooth (f = 0.15) and slopes
  // inward in a straight chisel edge to a V-notch, pointing backward against the swing direction!
  function toothOffset(ug, age) {
    for (let i = 0; i < SER_SPECS.length; i++) {
      const s = SER_SPECS[i];
      if (ug >= s.u0 && ug < s.u1) {
        const f = (ug - s.u0) / (s.u1 - s.u0);
        const fin = f < 0.15
          ? -s.notch + (s.h + s.notch) * (f / 0.15)
          : s.h - (s.h + s.notch) * ((f - 0.15) / 0.85);
        return fin * (1 - age * 0.24);
      }
    }
    return 0;
  }

  // Impact point at the bottom-right end of the arc
  const impR = ARC.rBase - ARC.wMax * 0.22;
  const impX = ARC.cx + Math.cos(ARC.a1) * impR;
  const impY = ARC.cy + Math.sin(ARC.a1) * impR;

  // Ring of 16 snow shavings bursting radially around the impact point
  const snowBurst = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * TAU + R.range(-0.12, 0.12);
    return {
      a,
      dist: R.range(9, 23),
      life: R.range(0.24, 0.42),
      sz: i % 3 === 0 ? 2 : 1,
    };
  });

  // Extremely small, sparse dark-red blood stars on the outer periphery (strictly 4 tiny specks for accent)
  const bloodStars = Array.from({ length: 4 }, (_, i) => {
    const baseAngles = [-0.75, -0.20, 0.32, 2.50];
    const a = baseAngles[i] + R.range(-0.10, 0.10);
    return {
      a,
      r0: R.range(5.5, 8.5),
      dist: R.range(16, 26),
      life: R.range(0.28, 0.44),
      cross: i < 2,
    };
  });

  let t = 0, hit = false;

  return {
    update(dt) {
      t += dt;
      if (!hit && t >= ARC.sweep * 0.88) {
        hit = true;
        lights.add(impX, impY, 34, C[6], 0.55, 0.22);
        // Snow-frost shavings bursting out of the impact point
        for (let i = 0; i < 12; i++) {
          const a = R.range(-2.5, 0.55), sp = R.range(55, 165);
          ps.spawn(
            P.FLAKE,
            impX + R.range(-2, 2),
            impY + R.range(-2, 2),
            Math.cos(a) * sp,
            Math.sin(a) * sp - 16,
            R.range(0.20, 0.42),
            F[6 + R.int(0, 1)],
            R.chance(0.35) ? 2 : 1
          );
        }
        // Frost motes flung tangentially off the serrated outer edge
        for (let i = 0; i < 11; i++) {
          const u = R.range(0.18, 0.96), ang = ARC.a0 + SPAN * u;
          const sx = ARC.cx + Math.cos(ang) * (ARC.rBase + 2), sy = ARC.cy + Math.sin(ang) * (ARC.rBase + 2);
          const sp = R.range(28, 76);
          ps.spawn(P.MOTE, sx, sy, Math.cos(ang) * sp, Math.sin(ang) * sp - 8, R.range(0.20, 0.40), R.pick([F[7], C[7], C[5]]), 0.6);
        }
      }
      ps.update(dt);
      lights.update(dt);
    },

    draw(p) {
      if (t >= meta.duration - 1e-6) return;

      // Release glint at the warrior's raised top-left sword hand at t = 0..0.06s
      if (t < 0.065) {
        const hk = 1 - t / 0.065;
        const gx = cx0 - 7, gy = cy0 - 9;
        p.glow(gx, gy, 15, C[5], 0.30 * hk);
        if (t < 0.035) sparkle(p, gx, gy, 4 * hk, F[7], B[4], 0.40 * hk);
      }

      const life = ARC.sweep + ARC.hold + ARC.trail;
      const head = 0.16 + 0.84 * ease.outExpo(clamp(t / ARC.sweep));
      const tail = smooth(ARC.sweep + ARC.hold, life, t);
      const age = clamp(t / life);

      if (t < life && tail < 0.97) {
        const uStart = tail * 0.72;
        const uEnd = head;
        const aStart = ARC.a0 + SPAN * uStart;
        const aEnd = ARC.a0 + SPAN * uEnd;
        const curSpan = aEnd - aStart;
        const W = ARC.wMax * (1 - tail * 0.55);

        if (curSpan > 0.04 && W > 0.9) {
          // Helper computing the blade's inner radius, base outer radius, serrated outer radius, and core spine at local uu in [0, 1]
          const profileAt = (uu) => {
            const ug = uStart + uu * (uEnd - uStart);
            // Thickest just behind the leading edge (uu^1.60), tapering smoothly to a fine point at tail & tip
            const env = Math.pow(Math.sin(Math.PI * Math.pow(clamp(uu, 0.005, 0.995), 1.60)), 0.56);
            const wBody = W * env;
            const rInner = ARC.rBase - wBody;
            const tOff = toothOffset(ug, age) * Math.sin(Math.PI * clamp(uu, 0.04, 0.96));
            const rOuter = ARC.rBase + tOff;
            // Blood core sits strictly along the central spine inside the smooth cyan-white body
            const rCore = rInner + wBody * 0.54;
            const wCore = clamp(1.95 * env * (1 - age * 0.28), 1.0, 2.0);
            return { ug, env, wBody, rInner, rOuter, rCore, wCore };
          };

          const wBand = ARC.wMax + 9;

          // LAYER 2 (Middle main body): Cyan-white cold aura wrapping both sides of the blood core (`palette` C[0..7] via p.arc)
          // Alpha dissolves ONLY at the tail (uu < 0.38), following src/fx/melee/_lib.js line 109
          p.arc(
            ARC.cx,
            ARC.cy,
            ARC.rMax,
            wBand,
            aStart,
            aEnd,
            (uu, vv) => {
              const d = ARC.rMax - wBand * (1 - vv);
              const pr = profileAt(uu);
              if (d > pr.rOuter - 0.9 || d < pr.rInner || pr.wBody < 0.8) return 0;
              // Bright cyan-white in the outer frost teeth and right around the blood core sheath,
              // stepping down cleanly toward the inner trailing rim
              const qSmooth = clamp((ARC.rBase - d) / Math.max(1, pr.wBody), 0, 1);
              const nearCore = Math.abs(d - pr.rCore) < pr.wCore * 0.5 + 1.2;
              const ci = (d >= ARC.rBase - 1.2 && age < 0.48)
                ? 0
                : nearCore && age < 0.55
                  ? 1
                  : Math.round(qSmooth * 5.8 + age * 2.2 - uu * 0.85 + 0.35);
              return C[7 - clamp(ci, 0, 7)];
            },
            (uu) => Math.min(1, uu / 0.38)
          );

          // LAYER 3 (Outer rim): 1px bright white serrated frost contour (`frost` F[0..7] via p.arc)
          // Following src/fx/melee/_lib.js line 107: brightest white rim holds up the serrated outer silhouette
          p.arc(
            ARC.cx,
            ARC.cy,
            ARC.rMax,
            wBand,
            aStart,
            aEnd,
            (uu, vv) => {
              const d = ARC.rMax - wBand * (1 - vv);
              const pr = profileAt(uu);
              const rimThick = uu > 0.12 ? 1.4 : 1.05;
              if (d > pr.rOuter + 0.3 || d < pr.rOuter - rimThick || pr.wBody < 0.7) return 0;
              const isEdge = d >= pr.rOuter - 0.7;
              if (isEdge && age < 0.55) return F[7];
              const fi = clamp(Math.round((1 - (d - (pr.rOuter - rimThick)) / rimThick) * 2.2 + age * 3.0 - uu * 0.6), 0, 7);
              return F[7 - fi];
            },
            (uu) => Math.min(1, uu / 0.26)
          );

          // Backward-swept razor barbs at the peak of each frost sawtooth for crisp pixel-level serration
          for (const s of SER_SPECS) {
            const uPeak = s.u0 + (s.u1 - s.u0) * 0.15;
            if (uPeak < uStart + 0.05 || uPeak > uEnd - 0.03) continue;
            const localU = (uPeak - uStart) / Math.max(0.05, uEnd - uStart);
            const env = Math.sin(Math.PI * clamp(localU, 0.04, 0.96));
            const rTip = ARC.rBase + s.h * (1 - age * 0.24) * env;
            const angPeak = ARC.a0 + SPAN * uPeak;
            const xPeak = ARC.cx + Math.cos(angPeak) * rTip;
            const yPeak = ARC.cy + Math.sin(angPeak) * rTip;
            const barbAng = angPeak - Math.PI * 0.44;
            const barbLen = (2.6 + s.h * 0.35) * (1 - age * 0.45);
            p.line(
              xPeak,
              yPeak,
              xPeak + Math.cos(barbAng) * barbLen,
              yPeak + Math.sin(barbAng) * barbLen,
              age < 0.5 ? F[7] : F[5],
              Math.min(1, localU / 0.28)
            );
          }

          // LAYER 1 (Inner core): 1-2px blood-red thin core embedded down the center of the blade (`blood` B[0..5] via p.arc)
          p.arc(
            ARC.cx,
            ARC.cy,
            ARC.rMax,
            wBand,
            aStart + curSpan * 0.03,
            aEnd - curSpan * 0.015,
            (uu, vv) => {
              const d = ARC.rMax - wBand * (1 - vv);
              const uFull = 0.03 + uu * 0.955;
              const pr = profileAt(uFull);
              if (pr.wBody < 2.0) return 0;
              const distCore = Math.abs(d - pr.rCore);
              const halfW = pr.wCore * 0.5;
              if (distCore > halfW) return 0;
              const cNorm = distCore / Math.max(0.4, halfW);
              if (cNorm < 0.55 && age < 0.50 && uFull > 0.28) return B[5];
              const bi = clamp(Math.round(cNorm * 1.4 + age * 2.2 + (1 - uFull) * 1.3), 0, 5);
              return B[5 - bi];
            },
            (uu) => Math.min(1, uu / 0.30)
          );

          // Cold additive glow riding along the slash arc
          for (let s = 0; s <= 5; s++) {
            const u = s / 5;
            const ang = aStart + curSpan * u;
            const gx = ARC.cx + Math.cos(ang) * (ARC.rBase - W * 0.35);
            const gy = ARC.cy + Math.sin(ang) * (ARC.rBase - W * 0.35);
            p.glow(gx, gy, 12, C[5], 0.19 * (1 - age) * u);
          }
        }
      }

      // Shattering frost tooth splinters & lingering dotted trace after the blade passes
      if (tail > 0.04 && t < life + 0.12) {
        const th = 0.72 * (1 - clamp((t - ARC.sweep - ARC.hold) / (ARC.trail + 0.12)));
        if (th > 0.04) {
          const maxU = Math.min(1, tail);
          for (let u = 0.06; u <= maxU; u += 0.035) {
            const ang = ARC.a0 + SPAN * u;
            const rO = ARC.rBase + toothOffset(u, 0.5);
            p.dot(ARC.cx + Math.cos(ang) * rO, ARC.cy + Math.sin(ang) * rO, F[5], th * (0.35 + 0.65 * u));
            if (((u * 100) | 0) % 2 === 0) {
              const rC = ARC.rBase - 4.2;
              p.dot(ARC.cx + Math.cos(ang) * rC, ARC.cy + Math.sin(ang) * rC, B[3], th * 0.75 * u);
            }
          }
          // Peeling frost tooth splinters drifting off the outer sawtooth peaks as the tail recedes
          for (const s of SER_SPECS) {
            const uPeak = s.u0 + (s.u1 - s.u0) * 0.15;
            if (uPeak > tail * 0.85) continue;
            const dtPeel = clamp((tail - uPeak) / 0.65, 0, 1);
            if (dtPeel >= 1) continue;
            const ang = ARC.a0 + SPAN * uPeak + s.driftAng * dtPeel;
            const r = ARC.rBase + s.h * 0.7 + s.driftR * dtPeel;
            const sx = ARC.cx + Math.cos(ang) * r;
            const sy = ARC.cy + Math.sin(ang) * r;
            const barbAng = ang - Math.PI * 0.42;
            p.line(
              sx,
              sy,
              sx + Math.cos(barbAng) * 2.2 * (1 - dtPeel),
              sy + Math.sin(barbAng) * 2.2 * (1 - dtPeel),
              dtPeel < 0.45 ? F[6] : C[5],
              1 - dtPeel
            );
          }
        }
      }

      // IMPACT POINT at the end of the arc:
      // 1) 1-2 frame white-hot hero flash at center + 2) radial ring of snow shavings + 3) tiny sparse blood stars
      const hitAge = t - ARC.sweep * 0.85;
      if (hitAge >= 0) {
        // 1-2 frame white-hot hero frame (0 .. 0.06s at 30fps)
        if (hitAge < 0.062) {
          const h = hitAge < 0.032 ? 1.0 : 0.80;
          p.circle(impX, impY, 5.5 * h, C[7]);
          p.circle(impX, impY, 3.6 * h, F[7]);
          sparkle(p, impX, impY, 10 * h, F[7], C[6], 0.65);
          p.line(impX - 8 * h, impY - 3 * h, impX + 8 * h, impY + 3 * h, F[7]);
          p.line(impX - 4 * h, impY + 6 * h, impX + 4 * h, impY - 6 * h, F[7]);
          p.glow(impX, impY, 24, F[7], 0.48 * h);
        } else if (hitAge < 0.18) {
          const gk = 1 - (hitAge - 0.062) / 0.118;
          sparkle(p, impX, impY, 6 * gk, F[6], C[5], 0.35 * gk);
        }

        // Expanding ring of snow shavings around the impact point
        for (const sb of snowBurst) {
          if (hitAge >= sb.life) continue;
          const u = hitAge / sb.life;
          const r = sb.dist * ease.outQuart(u);
          const sx = impX + Math.cos(sb.a) * r;
          const sy = impY + Math.sin(sb.a) * r * 0.82 + u * u * 2.5;
          const col = u < 0.32 ? F[7] : u < 0.62 ? F[6] : u < 0.82 ? C[6] : F[4];
          if (sb.sz === 2 && u < 0.58) {
            sparkle(p, sx, sy, 2, F[7], C[6], 0.25 * (1 - u));
          } else {
            p.px(sx, sy, col);
            if (u < 0.45) p.px(sx - Math.cos(sb.a), sy - Math.sin(sb.a), C[5]);
          }
        }

        // Tiny, sparse dark-red blood stars on the outer periphery (must be tiny and very few, just an accent)
        for (const bs of bloodStars) {
          if (hitAge >= bs.life) continue;
          const u = hitAge / bs.life;
          const r = bs.r0 + (bs.dist - bs.r0) * ease.outCubic(u);
          const bx = Math.round(impX + Math.cos(bs.a) * r);
          const by = Math.round(impY + Math.sin(bs.a) * r * 0.84 + u * u * 2.0);
          const bCol = u < 0.22 ? B[5] : u < 0.55 ? B[4] : u < 0.80 ? B[3] : B[2];
          p.px(bx, by, bCol);
          if (bs.cross && u > 0.06 && u < 0.50) {
            p.px(bx - 1, by, B[2]);
            p.px(bx + 1, by, B[2]);
            p.px(bx, by - 1, B[2]);
            p.px(bx, by + 1, B[2]);
          }
        }
      }

      ps.draw(p);
      lights.draw(p);
    },
  };
}
