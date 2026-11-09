import { Particles, Bits, Lights, P, B, Rng, fit, flare, sparkle, clamp, smooth, lerp, ease, TAU, WHITE } from "../../core/index.js";
import { ringFast, unlight, blackStar } from "./_lib.js";

const T_OPEN = 0.14;
const T_PINCH = 0.88;
const T_BURST = 1.06;
const T_END = 1.92;
const K_WIND = 3.1;

export const meta = {
  name: "Crimson vortex",
  desc: "A pitch-black dark-red vortex pulls shards and airflow inward, compresses tight, and bursts into radial dark-red spikes with hit-confirm cleave and rupture effects.",
  tags: ["shadow", "crimson", "vortex", "suction", "spikes", "impact", "dark", "one-shot"],
  size: [300, 300],
  origin: [150, 150],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#030001", "#240308", "#500712", "#860d1c", "#bc1824", "#e42b2d", "#ff5240", "#ffd0bd"],
    seed: 13,
  },
};

function drawChunk(p, x, y, a, s, stretch, C, alpha) {
  if (alpha <= 0.03) return;
  const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
  const L = s * stretch;
  const pts = [
    [x + ca * L * 1.4, y + sa * L * 1.4],
    [x + nx * s * 0.9 + ca * L * 0.1, y + ny * s * 0.9 + sa * L * 0.1],
    [x - ca * L * 1.1 + nx * s * 0.35, y - sa * L * 1.1 + ny * s * 0.35],
    [x - ca * L * 0.8 - nx * s * 0.85, y - sa * L * 0.8 - ny * s * 0.85],
  ];
  p.poly(pts, C[2], alpha);
  p.tri(pts[0][0], pts[0][1], pts[1][0], pts[1][1], x, y, C[5], alpha);
  p.tri(pts[0][0], pts[0][1], pts[3][0], pts[3][1], x - ca * L * 0.2, y - sa * L * 0.2, C[4], alpha);
  p.dot(pts[0][0], pts[0][1], C[6], alpha);
}

// Clean luminous tapered airflow stream along the log-spiral field (no choppy black outline noise)
function drawSpiralWisp(p, pts, widths, C, pinch, alpha, bright = false) {
  if (alpha <= 0.03 || pts.length < 3) return;
  const n = pts.length;
  for (let i = 1; i < n; i++) {
    const u = i / (n - 1);
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const w = widths[i];
    const segA = alpha * Math.sin(u * Math.PI);
    if (segA <= 0.03) continue;
    const colOuter = u > 0.5 ? C[4] : C[3];
    const colCore = u > 0.72 && (bright || pinch > 0.28) ? C[6] : u > 0.42 ? C[5] : C[4];
    if (w > 1.0) {
      p.line(x0 + nx * 0.8, y0 + ny * 0.8, x1 + nx * 0.8, y1 + ny * 0.8, colOuter, segA * 0.82);
      p.line(x0 - nx * 0.8, y0 - ny * 0.8, x1 - nx * 0.8, y1 - ny * 0.8, C[2], segA * 0.7);
    }
    p.line(x0, y0, x1, y1, colCore, segA);
  }
}

function drawArcSeg(p, r, a0, a1, thick, col, alpha) {
  if (alpha <= 0.03 || r < 2) return;
  const span = a1 - a0;
  const steps = Math.max(4, Math.ceil((Math.abs(span) * r) / 5));
  const rings = thick > 1.8 ? [-0.6, 0.6] : [0];
  for (const off of rings) {
    const rr = r + off;
    let px = Math.cos(a0) * rr, py = Math.sin(a0) * rr;
    for (let k = 1; k <= steps; k++) {
      const a = a0 + (span * k) / steps;
      const nx = Math.cos(a) * rr, ny = Math.sin(a) * rr;
      p.line(px, py, nx, ny, col, alpha);
      px = nx;
      py = ny;
    }
  }
}

function brokenRing(p, r, thick, segs, gapPh, col, alpha) {
  if (alpha <= 0.03 || r < 2) return;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * TAU + gapPh;
    const a1 = a0 + (TAU / segs) * 0.54;
    drawArcSeg(p, r, a0, a1, thick, col, alpha);
  }
}

function drawHeavySpike(p, a, r0, r1, w0, curve, barbU, C, hot, shatterFade, alpha) {
  if (alpha <= 0.03 || r1 <= r0 + 4) return;
  const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
  const len = r1 - r0;
  const pt = (u, offN) => {
    const r = r0 + u * len;
    const bend = Math.sin(u * Math.PI) * curve;
    return [ca * r + nx * (bend + offN), sa * r + ny * (bend + offN)];
  };

  const wBarb = w0 * (1 - barbU * 0.42);
  const wMid = w0 * (1 - (barbU + 0.18) * 0.6);
  const tip = pt(1, 0);

  const outer = [
    pt(0, w0),
    pt(barbU * 0.7, w0 * 0.74),
    pt(barbU, wBarb * 1.5),
    pt(barbU + 0.08, wMid * 0.72),
    tip,
    pt(barbU + 0.11, -wMid * 0.7),
    pt(barbU + 0.02, -wBarb * 1.4),
    pt(barbU * 0.7, -w0 * 0.74),
    pt(0, -w0),
  ];
  p.poly(outer, C[0], alpha);

  const cMid = pt(0.35, 0);
  const body = outer.map(([px, py], idx) => (idx === 4 ? tip : [lerp(px, cMid[0], 0.15), lerp(py, cMid[1], 0.15)]));
  p.poly(body, hot > 0.58 ? C[5] : C[4], alpha);
  p.poly([body[0], body[1], body[2], body[3], tip, pt(0.46, 0), pt(0.04, 0)], hot > 0.62 ? C[6] : C[5], alpha);
  p.poly([pt(0.03, w0 * 0.44), pt(0.64, 0), pt(0.03, -w0 * 0.44)], hot > 0.85 ? C[2] : C[0], alpha * 0.94);

  for (let i = 1; i <= 4; i++) {
    p.line(body[i - 1][0], body[i - 1][1], body[i][0], body[i][1], hot > 0.5 && i >= 3 ? WHITE : C[6], alpha);
  }
  const pMid = pt(0.66, 0);
  p.line(pMid[0], pMid[1], tip[0], tip[1], hot > 0.36 ? WHITE : C[7], alpha);

  if (shatterFade > 0.28) {
    const f0 = pt(0.36, w0 * 0.85), f1 = pt(0.5, -w0 * 0.85);
    p.line(f0[0], f0[1], f1[0], f1[1], C[0], alpha);
  }
}

export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [WHITE, C[7], C[6], C[5], C[3]], haze: C[2] });
  const bits = new Bits({});
  const lights = new Lights();

  const streams = Array.from({ length: 28 }, () => ({
    a0: R.range(0, TAU),
    rStart: R.range(74, 132),
    speed: R.range(0.88, 1.52),
    phase: R.next(),
    thick: R.chance(0.42) ? 1.8 : 1.0,
    bright: R.chance(0.5),
  }));

  const debris = Array.from({ length: 30 }, (_, i) => ({
    a0: R.range(0, TAU),
    rStart: i % 4 === 0 ? R.range(96, 134) : R.range(68, 122),
    phase: R.next(),
    speed: R.range(0.84, 1.46),
    spin: R.range(7, 14) * (R.chance(0.65) ? 1 : -1),
    size: i % 5 === 0 ? R.range(4.2, 6.0) : i % 2 === 0 ? R.range(2.6, 3.8) : R.range(1.7, 2.6),
  }));

  const spikes = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + R.range(-0.12, 0.12);
    spikes.push({
      a,
      delay: R.range(0, 0.01),
      rBase0: 4,
      rBaseEnd: R.range(32, 62),
      rMax: R.range(112, 132),
      w0: R.range(7.2, 9.4),
      curve: R.range(-4.5, 4.5),
      barbU: R.range(0.32, 0.52),
      life: R.range(0.50, 0.66),
      retractPow: R.range(1.2, 1.7),
    });
    for (const off of [-0.21, 0.22]) {
      const needle = R.chance(0.45);
      spikes.push({
        a: a + off + R.range(-0.04, 0.04),
        delay: needle ? R.range(0.025, 0.055) : R.range(0.01, 0.03),
        rBase0: needle ? 9 : 4,
        rBaseEnd: needle ? R.range(18, 38) : R.range(28, 56),
        rMax: needle ? R.range(58, 86) : R.range(84, 110),
        w0: needle ? R.range(2.4, 3.8) : R.range(4.4, 6.0),
        curve: R.range(-3.6, 3.6),
        barbU: R.range(0.34, 0.58),
        life: needle ? R.range(0.36, 0.48) : R.range(0.42, 0.56),
        retractPow: R.range(1.1, 1.6),
      });
    }
    spikes.push({
      a: a + 0.31 + R.range(-0.06, 0.06),
      delay: R.range(0.03, 0.065),
      rBase0: 3,
      rBaseEnd: R.range(8, 20),
      rMax: R.range(42, 66),
      w0: R.range(3.2, 4.6),
      curve: R.range(-2.6, 2.6),
      barbU: R.range(0.36, 0.56),
      life: R.range(0.44, 0.56),
      retractPow: R.range(1.3, 1.8),
    });
  }

  const hitNodes = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * TAU + R.range(-0.22, 0.22);
    const d = R.range(34, 58);
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, delay: 0.025 + i * 0.02, life: 0.2, sz: R.range(11, 16) };
  });

  const splatter = Array.from({ length: 22 }, (_, i) => ({
    a: (i / 22) * TAU + R.range(-0.18, 0.18),
    r0: R.range(12, 26),
    r1: R.range(42, 94),
    size: R.range(1.8, 4.0),
  }));

  const woundVeins = Array.from({ length: 14 }, (_, i) => ({
    a: (i / 14) * TAU + R.range(-0.16, 0.16),
    len: i % 2 === 0 ? R.range(38, 60) : R.range(22, 40),
    w: i % 2 === 0 ? R.range(3.2, 5.2) : R.range(1.8, 3.0),
    bend: R.range(-4.0, 4.0),
  }));

  let t = 0, bursted = false, secondary = false, acc = 0;

  return {
    update(dt) {
      t += dt;

      if (t < T_PINCH) {
        const k = clamp(t / T_PINCH);
        for (acc += dt * (42 + 64 * k); acc >= 1; acc -= 1) {
          const a = R.range(0, TAU), d = R.range(72, 130);
          const rx = -Math.cos(a), ry = -Math.sin(a), tx = -Math.sin(a), ty = Math.cos(a);
          ps.spawn(
            P.MOTE,
            Math.cos(a) * d, Math.sin(a) * d,
            rx * (150 + 190 * k) + tx * 145, ry * (150 + 190 * k) + ty * 145,
            R.range(0.24, 0.45), R.pick([C[4], C[5], C[5], C[6]]), R.range(0.75, 1.3)
          );
        }
      }

      if (t < T_BURST) {
        for (let i = ps.list.length - 1; i >= 0; i--) {
          const q = ps.list[i];
          const d = Math.hypot(q.x, q.y) || 1;
          if (d < 10) { ps.list.splice(i, 1); continue; }
          const pull = (360 + 740 * clamp(t / T_PINCH)) * dt;
          const swirl = pull * (0.48 + 22 / (d + 16));
          q.vx += (-q.x / d) * pull - (q.y / d) * swirl;
          q.vy += (-q.y / d) * pull + (q.x / d) * swirl;
        }
      }

      if (!bursted && t >= T_BURST) {
        bursted = true;
        ps.list.length = 0;
        lights.add(0, 0, 74, C[5], 1.1, 0.52);
        lights.add(0, 0, 34, C[6], 0.75, 0.14);
        lights.add(0, 0, 68, C[2], 0.9, 0.76);

        for (let i = 0; i < 42; i++) {
          const a = R.range(0, TAU), sp = R.range(135, 330);
          bits.add({
            kind: B.SHARD,
            x: Math.cos(a) * R.range(8, 22),
            y: Math.sin(a) * R.range(8, 22),
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            g: 0.15,
            drag: 2.3,
            bounce: 0,
            life: R.range(0.42, 0.78),
            a,
            va: R.range(-20, 20),
            s: R.range(1.8, 4.2),
            c: R.pick([C[2], C[4], C[5], C[6]]),
          });
        }
        for (let i = 0; i < 66; i++) {
          const a = R.range(0, TAU), sp = R.range(165, 400);
          ps.spawn(P.SPARK, Math.cos(a) * 14, Math.sin(a) * 14, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.18, 0.40), R.pick([WHITE, C[6], C[5], C[4]]));
        }
        for (let i = 0; i < 18; i++) {
          const a = R.range(0, TAU), sp = R.range(24, 88);
          ps.spawn(P.SMOKE, Math.cos(a) * R.range(4, 18), Math.sin(a) * R.range(4, 18), Math.cos(a) * sp, Math.sin(a) * sp - 10, R.range(0.48, 0.78), R.chance(0.55) ? C[1] : C[2], R.range(4.5, 8.5), 0, 0);
        }
      }

      if (!secondary && t >= T_BURST + 0.11) {
        secondary = true;
        lights.add(0, 0, 66, C[6], 0.8, 0.22);
        for (let i = 0; i < 30; i++) {
          const a = R.range(0, TAU), sp = R.range(115, 250);
          bits.add({
            kind: B.SHARD,
            x: Math.cos(a) * R.range(24, 50),
            y: Math.sin(a) * R.range(24, 50),
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            g: 0.2,
            drag: 2.7,
            bounce: 0,
            life: R.range(0.36, 0.64),
            a,
            va: R.range(-22, 22),
            s: R.range(1.7, 3.6),
            c: R.pick([C[3], C[4], C[5], C[6]]),
          });
        }
        for (let i = 0; i < 28; i++) {
          const a = R.range(0, TAU), sp = R.range(55, 155);
          ps.spawn(P.MOTE, Math.cos(a) * R.range(14, 40), Math.sin(a) * R.range(14, 40), Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.3, 0.64), R.pick([C[6], C[5], C[4]]), R.range(0.8, 1.5));
        }
      }

      for (const q of ps.list) {
        q.x = clamp(q.x, -140, 140);
        q.y = clamp(q.y, -140, 140);
      }
      for (const b of bits.list) {
        b.x = clamp(b.x, -140, 140);
        b.y = clamp(b.y, -140, 140);
      }

      bits.update(dt);
      ps.update(dt);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-4) return;
      const fadeEnd = 1 - smooth(T_END - 0.24, T_END - 0.02, t);

      if (t < T_BURST) {
        const open = ease.outCubic(clamp(t / T_OPEN));
        const charge = clamp(t / T_PINCH);
        const pinch = t > T_PINCH ? ease.inQuad((t - T_PINCH) / (T_BURST - T_PINCH)) : 0;
        const rAura = (74 + 18 * charge) * open * (1 - 0.44 * pinch);
        p.glow(0, 0, rAura, C[4], (0.58 + 0.52 * charge) * open);
      } else {
        const age = t - T_BURST;
        const k = (1 - smooth(0.1, 0.78, age)) * fadeEnd;
        if (k > 0.02) p.glow(0, 0, 74, C[4], 0.7 * k);
      }
      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-4) return;
      const fadeEnd = 1 - smooth(T_END - 0.22, T_END - 0.02, t);

      if (t < T_BURST) {
        const open = ease.outCubic(clamp(t / T_OPEN));
        const charge = clamp(t / T_PINCH);
        const pinch = t > T_PINCH ? ease.inQuad((t - T_PINCH) / (T_BURST - T_PINCH)) : 0;
        const swirlR = (74 + 20 * charge) * open * (1 - 0.52 * pinch);
        const coreR = (11.5 + 5.5 * ease.outQuad(charge)) * open * (1 - 0.56 * pinch);
        const EYE = coreR / Math.max(12, swirlR);
        const K = K_WIND * (1 + 0.38 * pinch);
        const ph = t * (0.45 + 0.58 * charge) + pinch * 0.95;
        const swirlR2 = swirlR * swirlR;

        // Clean, luminous dark-red vortex: silky multi-turn crimson currents over rich burgundy basin (zero speckled noise!)
        const W = Math.ceil(swirlR + 2);
        p.shade(-W, -W, W, W, (x, y, out) => {
          const d2 = x * x + y * y;
          if (d2 > swirlR2) return;
          const d = Math.sqrt(d2);
          const rho = d / swirlR;
          const th = Math.atan2(y, x);

          // Deep pitch-black funnel throat with clean dark crimson wall gradient
          if (rho < EYE) {
            const wall = rho / Math.max(0.01, EYE);
            if (wall < 0.76) {
              out.a = 1;
              return C[0];
            }
            out.a = 1;
            return wall > 0.91 ? C[3] : wall > 0.83 ? C[1] : C[0];
          }

          const k = (rho - EYE) / (1 - EYE);
          const fadeOut = 1 - smooth(0.54, 1.0, k);
          if (fadeOut <= 0.03) return;

          const s = Math.log(Math.max(rho, 0.025));
          const a = th + K * s - ph * TAU;
          const b = th + K * 1.24 * s - ph * TAU * 1.75;

          // Two smooth, continuous non-symmetric spiral band families (5 & 9) -> silky fluid currents without speckle clutter
          const f1 = Math.pow(0.5 + 0.5 * Math.cos(5 * a + 0.45 * Math.sin(a + s * 1.8)), 3.2);
          const f2 = Math.pow(0.5 + 0.5 * Math.cos(9 * b + 0.3 * Math.cos(2 * b - s * 2.0)), 8.0) * (0.65 + 0.35 * Math.sin(s * 6 - ph * TAU * 2.2));
          const envelope = 0.72 + 0.28 * Math.sin(s * 5 + ph * TAU * 2.0 + a);

          // Bright, clean crimson-scarlet accretion lip framing the pitch-black center
          const lip = k < 0.06 ? (0.72 + 0.28 * Math.cos(th * 7 - ph * TAU * 4.0)) * (1 - k / 0.06) : 0;

          const band = (f1 * 0.78 + f2 * 0.85) * envelope + lip * 0.95;
          // Continuous rich crimson base gradient (darker near rim/throat edge, glowing blood-red in mid vortex)
          const bodyGlow = Math.sin(Math.PI * Math.pow(1 - k, 0.85)) * 0.36 + (1 - k) * 0.22;
          const L = clamp((bodyGlow + band * 0.78) * fadeOut, 0, 1.45);

          if (L <= 0.08) return;
          out.a = clamp(smooth(0.08, 0.28, L) * open, 0, 1);
          if (L > 0.56) {
            out.l = L > 0.9 ? C[6] : C[5];
            out.k = 0.12 + 0.22 * clamp((L - 0.56) / 0.7, 0, 1);
          }

          if (L > 1.06 && pinch > 0.32) return C[7];
          if (L > 0.86) return C[6];
          if (L > 0.62) return C[5];
          if (L > 0.42) return C[4];
          if (L > 0.26) return C[3];
          return C[2];
        });

        // Smooth luminous crimson airflow streams pulled along the differential spiral
        for (const st of streams) {
          const prog = (t * st.speed * (0.8 + 0.68 * charge) + st.phase) % 1;
          const rScale = 1 - 0.46 * pinch;
          const rHead = lerp(st.rStart * rScale, coreR + 2, Math.pow(prog, 1.32));
          const tailLen = lerp(18, 42, Math.sin(prog * Math.PI)) * (1 - 0.35 * pinch);
          const rTail = Math.min(134 * rScale + 4, rHead + tailLen);
          const pts = [], widths = [];
          for (let k = 0; k <= 6; k++) {
            const u = k / 6;
            const r = lerp(rTail, rHead, u);
            const ang = st.a0 - K * 0.72 * Math.log(Math.max(4, r) / st.rStart) + prog * (1.6 + 1.4 * charge) + t * 0.6;
            pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
            widths.push(st.thick * Math.sin(Math.PI * Math.pow(u, 0.78)));
          }
          const al = Math.sin(prog * Math.PI) * open;
          drawSpiralWisp(p, pts, widths, C, pinch, al * (st.bright ? 0.95 : 0.76), st.bright && rHead < swirlR * 0.86);
        }

        // Debris chunks swept inward along the vortex flow
        for (const db of debris) {
          const prog = (t * db.speed * (0.76 + 0.65 * charge) + db.phase) % 1;
          const r = lerp(db.rStart * (1 - 0.46 * pinch), coreR + 1.5, Math.pow(prog, 1.38));
          const a = db.a0 - K * 0.72 * Math.log(Math.max(4, r) / db.rStart) + prog * (1.5 + 1.3 * charge) + t * 0.55;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          const al = Math.min(1, prog * 5) * (1 - smooth(0.82, 1, prog)) * open;
          drawChunk(p, x, y, a + 1.15 + t * db.spin * 0.5, db.size * (1 - prog * 0.28), 1 + prog * 1.1, C, al);
        }

        // Tightening inward implosion shear arcs during full-charge pinch
        if (t > T_PINCH) {
          const kP = (t - T_PINCH) / (T_BURST - T_PINCH);
          const rr = lerp(56, coreR + 2.5, ease.inQuad(kP));
          drawArcSeg(p, rr, t * 9, t * 9 + 2.2, 2.2, C[1], 0.88);
          drawArcSeg(p, rr, t * 9 + Math.PI, t * 9 + Math.PI + 2.1, 2.2, C[1], 0.88);
          drawArcSeg(p, rr - 1, t * 12, t * 12 + 2.0, 1.2, kP > 0.5 ? WHITE : C[6], kP);
          drawArcSeg(p, rr - 1, t * 12 + Math.PI, t * 12 + Math.PI + 1.9, 1.2, kP > 0.5 ? WHITE : C[6], kP);
          drawArcSeg(p, coreR + 5, -t * 16, -t * 16 + 3.4, 1.3, kP > 0.65 ? WHITE : C[6], kP * 0.92);
          p.glow(0, 0, 38, C[6], 0.95 * kP);
        }

        // Opening rift snap
        if (t < 0.14) {
          const uO = t / 0.14, kO = 1 - uO;
          p.line(-38 * (1 - uO * 0.4), -6 * (1 - uO), 38 * (1 - uO * 0.4), 6 * (1 - uO), uO < 0.35 ? WHITE : C[6], kO);
          ringFast(p, 0, 0, 6 + 38 * ease.outCubic(uO), Math.max(1, 2.4 * kO), C[5], kO);
        }

        bits.draw(p);
        ps.draw(p, "front");
        lights.draw(p);

        // Lock pitch-black void throat inside the vortex even over bloom/glow
        p.circle(0, 0, coreR * 0.74, C[0]);
        unlight(p, -coreR, -coreR, coreR, coreR, (x, y) => x * x + y * y < (coreR * 0.78) ** 2, 0.02);
      } else {
        // ==== BURST & HIT RESULT ====
        const age = t - T_BURST;

        if (age < 0.068) {
          const f = age < 0.034 ? 1 : 0.72;
          flare(p, 0, 0, 46 * f, 0.65 * f, [C[3], C[5], C[6], WHITE]);
          for (let i = 0; i < 22; i++) {
            const aa = (i / 22) * TAU + (age < 0.034 ? 0 : 0.13);
            p.line(Math.cos(aa) * 14, Math.sin(aa) * 14, Math.cos(aa) * 124 * f, Math.sin(aa) * 124 * f, i % 3 === 0 ? C[0] : (age < 0.034 ? WHITE : C[6]), 0.92 * f);
          }
        }

        for (const sp of spikes) {
          const sAge = age - sp.delay;
          if (sAge < -0.005 || sAge >= sp.life) continue;
          const u = Math.max(0.05, sAge / sp.life);
          const thrust = ease.outExpo(clamp(u / 0.14));
          const shatterBase = Math.pow(smooth(0.28, 1.0, u), sp.retractPow);
          const r1 = lerp(34, sp.rMax, thrust);
          const r0 = lerp(sp.rBase0, sp.rBaseEnd, shatterBase);
          const w0 = sp.w0 * (1 - 0.42 * shatterBase);
          const al = (1 - smooth(0.56, 1.0, u)) * fadeEnd;
          drawHeavySpike(p, sp.a, r0, r1, w0, sp.curve * (1 - u * 0.25), sp.barbU, C, 1 - smooth(0.02, 0.22, Math.max(0, sAge)), shatterBase, al);
        }

        const uR1 = age / 0.34;
        if (uR1 < 1) {
          const rr = 16 + 112 * ease.outCubic(uR1);
          brokenRing(p, rr, Math.max(1, 3.6 * (1 - uR1)), 9, 0.3, uR1 < 0.2 ? WHITE : C[6], (1 - uR1) * fadeEnd);
          brokenRing(p, rr * 0.66, Math.max(1, 2.2 * (1 - uR1)), 7, -0.5, C[4], (1 - uR1) * 0.9 * fadeEnd);
        }
        const uR2 = (age - 0.11) / 0.34;
        if (uR2 > 0 && uR2 < 1) {
          brokenRing(p, 18 + 92 * ease.outCubic(uR2), Math.max(1, 2.6 * (1 - uR2)), 11, 0.9, uR2 < 0.22 ? WHITE : C[5], (1 - uR2) * 0.92 * fadeEnd);
        }

        if (age < 0.62) {
          const uS = age / 0.62;
          const easeS = ease.outQuart(uS);
          const alS = (1 - smooth(0.42, 1.0, uS)) * fadeEnd;
          for (const sp of splatter) {
            const r = lerp(sp.r0, sp.r1, easeS);
            const x = Math.cos(sp.a) * r, y = Math.sin(sp.a) * r + uS * uS * 10;
            const rad = sp.size * (1 - uS * 0.45);
            p.circle(x, y, rad + 0.6, C[0], alS);
            p.circle(x, y, rad, age < 0.18 ? C[5] : C[4], alS);
            p.dot(x - rad * 0.3, y - rad * 0.3, C[6], alS * 0.85);
          }
        }

        if (age < 0.82) {
          const uW = age / 0.82;
          const expand = ease.outBack(clamp(age / 0.08), 1.6);
          const alW = (1 - smooth(0.46, 1.0, uW)) * fadeEnd;
          blackStar(p, 0, 0, 11 * expand * (1 - uW * 0.3), 27 * expand * (1 - uW * 0.26), 11, 0.35, C[0], age < 0.24 ? C[6] : C[5]);
          for (const wv of woundVeins) {
            const ca = Math.cos(wv.a), sa = Math.sin(wv.a), nx = -sa, ny = ca;
            const L = wv.len * expand * (1 - uW * 0.2);
            const hw = wv.w * 0.54 * (1 - uW * 0.58);
            const mx = ca * L * 0.5 + nx * wv.bend, my = sa * L * 0.5 + ny * wv.bend;
            p.poly([[ca * 5, sa * 5], [mx + nx * hw, my + ny * hw], [ca * L, sa * L], [mx - nx * hw, my - ny * hw]], C[0], alW * 0.95);
            p.line(ca * 5, sa * 5, mx, my, age < 0.26 ? C[6] : C[5], alW);
            p.line(mx, my, ca * L * 0.95, sa * L * 0.95, age < 0.2 ? WHITE : C[6], alW);
          }
        }

        for (const hn of hitNodes) {
          const hAge = age - hn.delay;
          if (hAge <= 0 || hAge >= hn.life) continue;
          const uh = hAge / hn.life;
          sparkle(p, hn.x, hn.y, hn.sz * (1 - uh), C[6], WHITE, 0.95 * (1 - uh));
        }

        bits.draw(p);
        ps.draw(p, "front");
        lights.draw(p);

        if (age < 0.29) {
          const uX = age / 0.29;
          const kX = ease.outCubic(clamp(uX / 0.16)) * (1 - smooth(0.32, 1.0, uX));
          for (const [ang, L0, w0] of [[-0.64, 122, 6.4], [0.82, 106, 5.4], [-0.06, 70, 3.2]]) {
            const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
            const L = L0 * (0.55 + 0.45 * ease.outCubic(clamp(uX / 0.14)));
            const hw = w0 * (1 - uX * 0.56);
            p.poly([[ca * L, sa * L], [nx * hw, ny * hw], [-ca * L, -sa * L], [-nx * hw, -ny * hw]], C[0], kX);
            p.poly([[ca * L * 0.93, sa * L * 0.93], [nx * hw * 0.52, ny * hw * 0.52], [-ca * L * 0.93, -sa * L * 0.93], [-nx * hw * 0.52, -ny * hw * 0.52]], uX < 0.34 ? WHITE : C[6], kX);
          }
          sparkle(p, 0, 0, 28 * (1 - uX), C[6], WHITE, 0.9 * (1 - uX));
        }

        if (age < 0.085) {
          const kB = 1 - age / 0.085;
          blackStar(p, 0, 0, 11 * kB, 32 * kB, 10, t * 8, C[0], C[6]);
          p.circle(0, 0, 8 * kB, C[0]);
          unlight(p, -18, -18, 18, 18, (x, y) => x * x + y * y < 256, 0.02);
        }
      }
    },
  };
}
