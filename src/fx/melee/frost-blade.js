import { Particles, Lights, P, Rng, fit, sparkle, band, clamp, smooth, ease, TAU, READY } from "../../core/index.js";

export const meta = {
  name: "Frost blade",
  desc: "An expansive overhead downward cleave with a 1-2px blood-red core, wide cyan-white cold wake and 1px white serrated frost rim erupts in snow shavings and blood stars.",
  tags: ["melee", "blade", "slash", "cleave", "ice", "frost", "blood", "combat", "directional", "one-shot"],
  size: [204, 140],
  origin: [60, 114],
  duration: 0.74,
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

// Overhead downward-cleave choreography: raise blade high overhead-left, heave over the top, slam straight down-right
const GUARD = { ...READY, weapon: "sword", two: true, fx: 12, fy: -21, sa: -0.9 };
const OVER = { ...GUARD, x: -6, crouch: 2, lean: -4, fx: -5, fy: -43, sa: -2.48, ffx: 8, fbx: -8 };
const HIGH_WHIP = { ...GUARD, x: 0, y: -2, crouch: 1, lean: 3, fx: 13, fy: -40, sa: -1.25, ffx: 10, fbx: -9, ghost: 1 };
const MID_WHIP = { ...GUARD, x: 3, crouch: 4, lean: 5, fx: 19, fy: -27, sa: -0.10, ffx: 12, fbx: -10, ghost: 1 };
const CLEAVE = { ...GUARD, x: 6, crouch: 7, lean: 6, fx: 21, fy: -15, sa: 0.82, ffx: 13, fbx: -10, toeB: true };

export const act = {
  target: { x: 64 },
  poses: [
    [-0.48, { ...GUARD, x: -6 }],
    [-0.24, OVER],
    [-0.06, { ...OVER, crouch: 4, lean: -5 }],
    [0.0, HIGH_WHIP, "snap"],
    [0.035, MID_WHIP, "snap"],
    [0.065, CLEAVE, "snap"],
    [0.34, { ...CLEAVE, crouch: 6, lean: 5 }],
    [0.56, { ...GUARD, x: 1, crouch: 3, fx: 15, fy: -21, sa: 0.15 }],
    [0.74, { ...GUARD, x: -6 }],
  ],
  hits: [{ t: 0.065, stop: 0.16, shake: 0.22, amp: 3, push: 3.0, straw: 22, y: -8, skin: "ice" }],
  dust: [{ t: 0.065, x: 18, n: 8, dir: 1 }, { t: 0.065, x: -12, n: 5, dir: -1 }],
};

export function create(o) {
  // Three strictly independent color ramps — never merged into a single array
  const B = fit(o.blood, 6);
  const C = fit(o.palette, 8);
  const F = fit(o.frost, 8);

  const R = new Rng(o.seed), floor = () => 0;
  const A = o.actor;
  const [cx0, cy0] = A?.chest ?? [0, -26];
  // Read character sword-hand / shoulder pivot from o.actor so the blade arc sweeps out from the warrior's hands
  const handX = cx0 + (A ? Math.round(A.w * 0.25) : 6);
  const handY = cy0 + 2;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [F[7], F[6], C[7], C[5]],
    haze: C[2],
  });
  const lights = new Lights();

  // Expansive overhead-to-floor downward cleave arc:
  // Spans ~120px horizontally (x: -48 to +72) and ~84px vertically (y: -83 down to 0).
  // Inner radius (~32px) wraps around the warrior's swinging hands while the outer serrated rim reaches r=79!
  const ARC = {
    cx: handX - 6,
    cy: handY + 10,
    rBase: 68,
    rMax: 80,     // includes tall 9-11px outer sawtooth frost serrations
    wMax: 36.0,   // massive 36px crescent width for a commanding, expansive downward cleave
    a0: -2.34,    // far top-left behind the warrior's raised overhead blade
    a1: 0.21,     // bottom-right where the blade cleaves straight down into y ≈ 0
    sweep: 0.065,
    hold: 0.065,
    trail: 0.27,
  };
  const SPAN = ARC.a1 - ARC.a0;

  // 9 large, asymmetric swept-back sawtooth frost serrations along the expansive outer rim
  const SER_SPECS = [
    { u0: 0.05, u1: 0.14, h: 5.0, notch: 2.0 },
    { u0: 0.14, u1: 0.24, h: 7.4, notch: 2.8 },
    { u0: 0.24, u1: 0.35, h: 9.8, notch: 3.5 },
    { u0: 0.35, u1: 0.46, h: 7.8, notch: 2.9 },
    { u0: 0.46, u1: 0.58, h: 10.6, notch: 3.8 },
    { u0: 0.58, u1: 0.69, h: 8.8, notch: 3.2 },
    { u0: 0.69, u1: 0.80, h: 7.5, notch: 2.7 },
    { u0: 0.80, u1: 0.90, h: 6.0, notch: 2.2 },
    { u0: 0.90, u1: 0.98, h: 4.2, notch: 1.6 },
  ].map((s) => ({
    ...s,
    driftR: R.range(6.0, 12.0),
    driftAng: R.range(-0.06, 0.03),
  }));

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

  // Impact point at the bottom-right end of the downward cleave (around x = +58, y = -1)
  const impR = ARC.rBase - ARC.wMax * 0.22;
  const impX = ARC.cx + Math.cos(ARC.a1) * impR;
  const impY = Math.min(-1, ARC.cy + Math.sin(ARC.a1) * impR);

  // Expansive ring + upward spray of 28 snow shavings around the impact point
  const snowBurst = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * TAU + R.range(-0.09, 0.09);
    return {
      a,
      dist: R.range(16, 44),
      life: R.range(0.28, 0.48),
      sz: i % 3 === 0 ? 2 : 1,
    };
  });

  // Extremely small, sparse dark-red blood stars on the outer periphery (strictly 5 tiny specks for accent)
  const bloodStars = Array.from({ length: 5 }, (_, i) => {
    const baseAngles = [-0.95, -0.45, -0.05, 0.30, -2.35];
    const a = baseAngles[i] + R.range(-0.08, 0.08);
    return {
      a,
      r0: R.range(8.0, 12.0),
      dist: R.range(26, 44),
      life: R.range(0.30, 0.48),
      cross: i < 2,
    };
  });

  let t = 0, hit = false;

  return {
    update(dt) {
      t += dt;
      if (!hit && t >= ARC.sweep * 0.88) {
        hit = true;
        lights.add(impX, impY - 9, 34, C[6], 0.65, 0.26);
        lights.add(impX, impY - 5, 22, F[7], 0.82, 0.12);
        // Wide fan of snow shavings & frost flakes erupting from the downward cleave impact
        for (let i = 0; i < 24; i++) {
          const a = R.range(-2.75, 0.25), sp = R.range(75, 185);
          ps.spawn(
            P.FLAKE,
            impX + R.range(-5, 5),
            impY + R.range(-2, 1),
            Math.cos(a) * sp,
            Math.max(-145, Math.sin(a) * sp - 16),
            R.range(0.24, 0.44),
            F[6 + R.int(0, 1)],
            R.chance(0.45) ? 2 : 1
          );
        }
        // Fast frost streaks kicked up both ways along the ground & outward from the cleave
        for (let i = 0; i < 18; i++) {
          const a = -Math.PI * 0.5 + R.range(-1.40, 1.40), sp = R.range(80, 180);
          ps.spawn(
            P.SPARK,
            impX + R.range(-5, 5),
            impY,
            Math.cos(a) * sp,
            Math.max(-145, Math.sin(a) * sp - 14),
            R.range(0.18, 0.35)
          );
        }
        // Shavings flung off the wide outer arc across the whole sky
        for (let i = 0; i < 22; i++) {
          const u = R.range(0.08, 0.96), ang = ARC.a0 + SPAN * u;
          const sx = ARC.cx + Math.cos(ang) * (ARC.rBase + 3), sy = ARC.cy + Math.sin(ang) * (ARC.rBase + 3);
          const sp = R.range(38, 92);
          ps.spawn(P.MOTE, sx, sy, Math.cos(ang) * sp, Math.max(-105, Math.sin(ang) * sp - 6), R.range(0.22, 0.40), R.pick([F[7], C[7], C[5]]), 0.65);
        }
      }
      ps.update(dt);
      lights.update(dt);
    },

    draw(p) {
      if (t >= meta.duration - 1e-6) return;

      // Overhead release glint right at the raised top-left blade tip (frames 0..2)
      if (t < 0.075) {
        const hk = 1 - t / 0.075;
        const gx = cx0 - 6, gy = cy0 - 16;
        p.glow(gx, gy, 24, C[5], 0.42 * hk);
        sparkle(p, gx, gy, (t < 0.02 ? 8 : 5) * hk, F[7], B[4], 0.55 * hk);
        if (t < 0.025) {
          // Crisp crimson-and-frost blade flash at the raised sword tip at t=0
          p.line(gx - 7, gy - 5, gx + 5, gy + 3, F[7]);
          p.line(gx - 5, gy - 4, gx + 3, gy + 2, B[5]);
        }
      }

      const life = ARC.sweep + ARC.hold + ARC.trail;
      const swingU = clamp(t / ARC.sweep);
      const head = ease.outExpo(swingU);
      const tail = smooth(ARC.sweep + ARC.hold, life, t);
      const age = clamp(t / life);

      if (t < life && tail < 0.97 && head > 0.04) {
        const uStart = tail * 0.72;
        const uEnd = head;
        const aStart = ARC.a0 + SPAN * uStart;
        const aEnd = ARC.a0 + SPAN * uEnd;
        const curSpan = aEnd - aStart;
        const W = ARC.wMax * (1 - tail * 0.52);

        if (curSpan > 0.04 && W > 1.0) {
          const profileAt = (uu) => {
            const ug = uStart + uu * (uEnd - uStart);
            // Broad, powerful downward-cleave belly (uu^1.45), widest behind the downward-slamming edge
            const env = Math.pow(Math.sin(Math.PI * Math.pow(clamp(uu, 0.005, 0.995), 1.45)), 0.50);
            const wBody = W * env;
            const rInner = ARC.rBase - wBody;
            const tOff = toothOffset(ug, age) * Math.sin(Math.PI * clamp(uu, 0.03, 0.97));
            const rOuter = ARC.rBase + tOff;
            // Blood-red thin core (1-2px) centered inside the cyan-white cold body
            const rCore = rInner + wBody * 0.58;
            const wCore = clamp(2.0 * env * (1 - age * 0.25), 1.0, 2.0);
            return { ug, env, wBody, rInner, rOuter, rCore, wCore };
          };

          const wBand = ARC.wMax + 15;

          // Inner secondary speed-echo arc (`palette` C) for extra expanse and downward velocity feel
          if (age < 0.65) {
            const echoR = ARC.rBase - W * 0.86;
            const echoW = (uu) => Math.max(0, 3.5 * Math.sin(uu * Math.PI) * (1 - age * 0.95));
            p.arc(
              ARC.cx,
              ARC.cy,
              echoR,
              echoW,
              aStart + curSpan * 0.10,
              aEnd - curSpan * 0.04,
              (uu) => (uu > 0.55 ? C[5] : C[3]),
              (uu) => Math.min(1, uu / 0.42) * 0.85
            );
          }

          // LAYER 2 (Middle main body): Expansive cyan-white cold aura wrapping the blade (`palette` C[0..7] via p.arc)
          // Includes internal speed-rib steps so the 36px-wide crescent reads as high-velocity wind & frost.
          // Alpha dissolves ONLY at the tail (uu < 0.38), following src/fx/melee/_lib.js line 109.
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
              if (d > pr.rOuter - 0.95 || d < pr.rInner || pr.wBody < 0.8) return 0;
              const ang = aStart + curSpan * uu;
              if (ARC.cy + Math.sin(ang) * d > 1.2) return 0;

              const qSmooth = clamp((ARC.rBase - d) / Math.max(1, pr.wBody), 0, 1);
              const nearCore = Math.abs(d - pr.rCore) < pr.wCore * 0.5 + 1.5;
              const rib = qSmooth > 0.42 ? Math.sin(qSmooth * 18) * 0.48 : 0;
              const ci = (d >= ARC.rBase - 1.8 && age < 0.48)
                ? 0
                : nearCore && age < 0.55
                  ? 1
                  : Math.round(qSmooth * 5.8 + rib + age * 2.2 - uu * 0.85 + 0.35);
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
              const rimThick = uu > 0.10 ? 1.5 : 1.1;
              if (d > pr.rOuter + 0.35 || d < pr.rOuter - rimThick || pr.wBody < 0.7) return 0;
              const ang = aStart + curSpan * uu;
              if (ARC.cy + Math.sin(ang) * d > 1.2) return 0;
              const isEdge = d >= pr.rOuter - 0.75;
              if (isEdge && age < 0.58) return F[7];
              const fi = clamp(Math.round((1 - (d - (pr.rOuter - rimThick)) / rimThick) * 2.2 + age * 3.0 - uu * 0.6), 0, 7);
              return F[7 - fi];
            },
            (uu) => Math.min(1, uu / 0.26)
          );

          // Swept-back razor frost barbs jutting from each sawtooth peak
          for (const s of SER_SPECS) {
            const uPeak = s.u0 + (s.u1 - s.u0) * 0.15;
            if (uPeak < uStart + 0.04 || uPeak > uEnd - 0.02) continue;
            const localU = (uPeak - uStart) / Math.max(0.05, uEnd - uStart);
            const env = Math.sin(Math.PI * clamp(localU, 0.03, 0.97));
            const rTip = ARC.rBase + s.h * (1 - age * 0.24) * env;
            const angPeak = ARC.a0 + SPAN * uPeak;
            const xPeak = ARC.cx + Math.cos(angPeak) * rTip;
            const yPeak = ARC.cy + Math.sin(angPeak) * rTip;
            if (yPeak > 0) continue;
            const barbAng = angPeak - Math.PI * 0.43;
            const barbLen = (3.8 + s.h * 0.44) * (1 - age * 0.42);
            p.line(
              xPeak,
              yPeak,
              xPeak + Math.cos(barbAng) * barbLen,
              yPeak + Math.sin(barbAng) * barbLen,
              age < 0.5 ? F[7] : F[5],
              Math.min(1, localU / 0.26)
            );
          }

          // LAYER 1 (Inner core): 1-2px blood-red thin core embedded down the center of the blade (`blood` B[0..5] via p.arc)
          p.arc(
            ARC.cx,
            ARC.cy,
            ARC.rMax,
            wBand,
            aStart + curSpan * 0.025,
            aEnd - curSpan * 0.01,
            (uu, vv) => {
              const d = ARC.rMax - wBand * (1 - vv);
              const uFull = 0.025 + uu * 0.965;
              const pr = profileAt(uFull);
              if (pr.wBody < 2.0) return 0;
              const ang = aStart + curSpan * uFull;
              if (ARC.cy + Math.sin(ang) * d > 1.0) return 0;
              const distCore = Math.abs(d - pr.rCore);
              const halfW = pr.wCore * 0.5;
              if (distCore > halfW) return 0;
              const cNorm = distCore / Math.max(0.4, halfW);
              if (cNorm < 0.55 && age < 0.52 && uFull > 0.25) return B[5];
              const bi = clamp(Math.round(cNorm * 1.4 + age * 2.2 + (1 - uFull) * 1.3), 0, 5);
              return B[5 - bi];
            },
            (uu) => Math.min(1, uu / 0.28)
          );

          // Expansive cold additive glow riding along the wide cleave arc
          for (let s = 0; s <= 8; s++) {
            const u = s / 8;
            const ang = aStart + curSpan * u;
            const gx = ARC.cx + Math.cos(ang) * (ARC.rBase - W * 0.35);
            const gy = ARC.cy + Math.sin(ang) * (ARC.rBase - W * 0.35);
            p.glow(gx, gy, 20, C[5], 0.22 * (1 - age) * u);
          }
        }
      }

      // Shattering frost tooth splinters & lingering dotted trace after the blade passes
      if (tail > 0.04 && t < life + 0.14) {
        const th = 0.76 * (1 - clamp((t - ARC.sweep - ARC.hold) / (ARC.trail + 0.14)));
        if (th > 0.04) {
          const maxU = Math.min(1, tail);
          for (let u = 0.05; u <= maxU; u += 0.024) {
            const ang = ARC.a0 + SPAN * u;
            const rO = ARC.rBase + toothOffset(u, 0.5);
            const oy = ARC.cy + Math.sin(ang) * rO;
            if (oy <= 1) p.dot(ARC.cx + Math.cos(ang) * rO, oy, F[5], th * (0.35 + 0.65 * u));
            if (((u * 100) | 0) % 2 === 0) {
              const rC = ARC.rBase - 10.0;
              const cy2 = ARC.cy + Math.sin(ang) * rC;
              if (cy2 <= 1) p.dot(ARC.cx + Math.cos(ang) * rC, cy2, B[3], th * 0.78 * u);
            }
          }
          for (const s of SER_SPECS) {
            const uPeak = s.u0 + (s.u1 - s.u0) * 0.15;
            if (uPeak > tail * 0.88) continue;
            const dtPeel = clamp((tail - uPeak) / 0.68, 0, 1);
            if (dtPeel >= 1) continue;
            const ang = ARC.a0 + SPAN * uPeak + s.driftAng * dtPeel;
            const r = ARC.rBase + s.h * 0.75 + s.driftR * dtPeel;
            const sx = ARC.cx + Math.cos(ang) * r;
            const sy = ARC.cy + Math.sin(ang) * r;
            if (sy > 0) continue;
            const barbAng = ang - Math.PI * 0.42;
            p.line(
              sx,
              sy,
              sx + Math.cos(barbAng) * 3.5 * (1 - dtPeel),
              sy + Math.sin(barbAng) * 3.5 * (1 - dtPeel),
              dtPeel < 0.45 ? F[6] : C[5],
              1 - dtPeel
            );
          }
        }
      }

      // IMPACT POINT at the end of the downward cleave:
      // 1) 1-2 frame white-hot hero slam + 2) wide ring & fan of snow shavings + 3) tiny sparse blood stars
      const hitAge = t - ARC.sweep * 0.88;
      if (hitAge >= 0) {
        // Expansive ground snow shock-ring (up to 92px diameter!) from the downward slam
        if (hitAge < 0.38) {
          const ru = hitAge / 0.38;
          const rx = 12 + 36 * ease.outQuart(ru);
          band(
            p,
            impX,
            0,
            rx,
            0.22,
            2.6 * (1 - ru * 0.65),
            1 - ru,
            [C[3], C[5], C[7], F[7]],
            () => true,
            hitAge < 0.055
          );
        }

        // 1-2 frame white-hot hero frame (0 .. 0.062s at 30fps)
        if (hitAge < 0.062) {
          const h = hitAge < 0.032 ? 1.0 : 0.82;
          // Wide horizontal ground-slam flash + vertical downward cleave spike
          p.beam(impX - 18 * h, impY, impX + 18 * h, impY, 3.2 * h, F[7]);
          p.beam(impX, impY - 22 * h, impX, impY + 1, 3.0 * h, F[7]);
          p.circle(impX, impY - 1, 8.8 * h, C[7]);
          p.circle(impX, impY - 1, 5.6 * h, F[7]);
          sparkle(p, impX, impY - 1, 16 * h, F[7], C[6], 0.78);
          p.line(impX - 15 * h, impY - 9 * h, impX + 15 * h, impY + 2 * h, F[7]);
          p.line(impX - 12 * h, impY + 3 * h, impX + 15 * h, impY - 10 * h, F[7]);
          p.glow(impX, impY - 6, 30, F[7], 0.58 * h);
        } else if (hitAge < 0.20) {
          const gk = 1 - (hitAge - 0.062) / 0.138;
          sparkle(p, impX, impY - 1, 9 * gk, F[6], C[5], 0.42 * gk);
        }

        // Expanding ring of snow shavings around the impact point
        for (const sb of snowBurst) {
          if (hitAge >= sb.life) continue;
          const u = hitAge / sb.life;
          const r = sb.dist * ease.outQuart(u);
          const sx = impX + Math.cos(sb.a) * r;
          const sy = Math.min(2, impY + Math.sin(sb.a) * r * 0.76 + u * u * 2.5);
          const col = u < 0.34 ? F[7] : u < 0.64 ? F[6] : u < 0.84 ? C[6] : F[4];
          if (sb.sz === 2 && u < 0.60) {
            sparkle(p, sx, sy, 2, F[7], C[6], 0.26 * (1 - u));
          } else {
            p.px(sx, sy, col);
            if (u < 0.48) p.px(sx - Math.cos(sb.a), sy - Math.sin(sb.a), C[5]);
          }
        }

        // Tiny, sparse dark-red blood stars on the outer periphery (must be tiny and very few, just an accent)
        for (const bs of bloodStars) {
          if (hitAge >= bs.life) continue;
          const u = hitAge / bs.life;
          const r = bs.r0 + (bs.dist - bs.r0) * ease.outCubic(u);
          const bx = Math.round(impX + Math.cos(bs.a) * r);
          const by = Math.min(1, Math.round(impY + Math.sin(bs.a) * r * 0.80 + u * u * 2.0));
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
