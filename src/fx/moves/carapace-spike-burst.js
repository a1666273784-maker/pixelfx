// Carapace spike burst ("moves/carapace-spike-burst"):
// 1. Carapace Tension (-0.34s..0.03s): Caster coils low as dark-brown chitin pressure streaks gather tightly to the chest.
// 2. Origin Spike Burst & Flight Cycle (0.03s..0.34s): Centered at the caster, a short-distance burst sprays 8 short
//    dark-brown cold-glint chitin spikes and 18 black shell shards radially outward while launching a staggered barrage of
//    drilling chitin spikes across the arena; each spike spins through a cyclic edge-glint, spiral air-cut ring, and shell-shed
//    flight cycle before piercing the target.
// 3. Localized Red-White Piercing Flash & Bouncing Black Debris (0.29s..1.90s): Spikes skewer the enemy in a heavy oppressive
//    beat, knocking it back as a tight, non-glaring red-white interlaced piercing flash pops at the wound and flings 10 jet-black
//    shell fragments bouncing outward across the floor before fading cleanly to empty.
import { Particles, Bits, Lights, P, B, Rng, fit, clamp, smooth, lerp, ease, rand, TAU, WHITE, READY } from "../../core/index.js";
import { spikes, star, brokenRing } from "../impacts/_lib.js";
import { unlight } from "../shadow/_lib.js";

const TX = 160;
const BX = 14, BY = -24;
const T_BURST = 0.03;
const FLIGHT = 0.25;
const T_HIT1 = T_BURST + FLIGHT;       // 0.28s
const T_HIT2 = T_BURST + 0.055 + FLIGHT; // 0.335s
const T_END = 1.90;

export const meta = {
  name: "Carapace spike burst",
  desc: "Bursts short dark-brown cold-glint spikes and black shell shards from the caster, drilling across in a spinning flight cycle to pierce the target in a tight red-white flash.",
  tags: ["move", "insect", "carapace", "spike", "pierce", "burst", "ranged", "combat", "one-shot"],
  size: [368, 184],
  origin: [72, 148],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#070404", "#1d0c07", "#3d1a0d", "#632c14", "#8a4420", "#b89c8a", "#e6eef6", "#ffffff"],
    shell: ["#020204", "#08060c", "#141017", "#2e2428", "#685c58"],
    flash: ["#220206", "#780614", "#cc0e24", "#ff1f38", "#ff7280", "#ffffff"],
    seed: 19,
  },
};

const GUARD = { ...READY, x: 0, crouch: 3, lean: 1, fx: 11, fy: -21, bx: 9, by: -21, ffx: 8, fbx: -8 };
const COIL = { ...READY, x: -4, crouch: 8, lean: 6, turn: 0.78, fx: 1, fy: -20, bx: 7, by: -21, armsFront: true, ffx: 6, fbx: -9 };
const BURST = { ...READY, x: 5, crouch: 4, lean: -3, turn: 1.02, fx: -8, fy: -28, bx: 15, by: -26, armsFront: false, ffx: 12, fbx: -10, toeB: true, ghost: 1 };
const THRUST = { ...BURST, x: 9, crouch: 5, lean: 4, fx: 16, fy: -25, bx: -5, by: -24, ffx: 14, fbx: -10, ghost: 0 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.34, GUARD],
    [-0.14, COIL],
    [0.01, { ...COIL, crouch: 9, lean: 7 }],
    [T_BURST, BURST, "snap"],
    [0.14, THRUST, "snap"],
    [T_HIT2 + 0.14, { ...THRUST, crouch: 6, lean: 3 }],
    [1.00, { ...GUARD, x: 3, crouch: 4 }],
    [1.48, GUARD],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_BURST, stop: 0.025, shake: 0.14, amp: 2.0, target: false },
    { t: T_HIT1, stop: 0.03, shake: 0.16, amp: 2.6, push: 1.8, straw: 12, flash: 0.03, skin: "red", shiver: 0.45, y: -28 },
    { t: T_HIT2, stop: 0.16, shake: 0.40, amp: 5.0, push: 4.5, slide: 14, straw: 38, flash: 0.032, skin: "red", shiver: 1.15, y: -24 },
    { t: T_HIT2 + 0.18, push: 0, straw: 0, flash: 0, skin: "char" },
    { t: T_HIT2 + 0.50, push: 0, straw: 0, flash: 0, skin: null },
  ],
  dust: [
    { t: T_BURST, x: 4, n: 7, dir: -1 },
    { t: T_BURST, x: 16, n: 6, dir: 1 },
    { t: T_HIT2, x: TX + 12, n: 10, dir: 1 },
  ],
};

const X_MIN = -66, X_MAX = 286, Y_MIN = -142, Y_MAX = 28;

// Tapered dark-brown chitin spike with cyclic axial cold-glint shimmer during flight
function drawChitinSpike(p, x, y, ang, len, hw, C, alpha, glint = 0, roll = 0) {
  if (len < 2 || alpha <= 0.03) return;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const nx = -sa, ny = ca;
  const sideFlip = Math.sin(roll) >= 0 ? 1 : -1;
  const ridgePos = -0.32 * sideFlip;
  for (let d = 0; d <= len; d += 0.5) {
    const u = d / len;
    const w = hw * Math.pow(1 - u, 0.7) * Math.min(1, 0.34 + d / 2.2);
    const px = x + ca * d, py = y + sa * d;
    if (px < X_MIN || px > X_MAX || py < Y_MIN || py > -0.5) continue;
    for (let o = -w - 0.6; o <= w + 0.6; o += 0.5) {
      const ao = Math.abs(o);
      const q = o / Math.max(0.4, w);
      let col;
      if (ao > w) col = C[0];
      else if (u > 0.78) col = glint > 0.32 ? WHITE : C[6];
      else if (Math.abs(q - ridgePos) < 0.28) col = u > 0.35 ? C[6] : C[5]; // cyclic cold metallic bevel
      else if (sideFlip > 0 ? q < 0.35 : q > -0.35) col = u < 0.32 ? C[3] : C[4]; // deep dark-brown chitin body
      else col = C[1]; // shadow espresso facet
      p.dot(px + nx * o, py + ny * o, col, alpha);
    }
  }
}

// Cyclic spinning spiral air-cut ring pulsing down a flying chitin spike's wake
function drawSpinSheath(p, cx, cy, ang, phase, C, Sh, alpha) {
  if (alpha <= 0.04) return;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const nx = -sa, ny = ca;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + phase;
    const axial = Math.cos(a) * 2.2;
    const perp = Math.sin(a) * 3.6;
    const px = cx + ca * axial + nx * perp;
    const py = cy + sa * axial + ny * perp;
    if (px < X_MIN + 2 || px > X_MAX - 2 || py < Y_MIN + 2 || py > -1) continue;
    p.dot(px, py, i % 3 === 0 ? C[6] : i % 2 === 0 ? C[4] : Sh[3], alpha * (0.45 + 0.55 * (0.5 + 0.5 * Math.cos(a))));
  }
}

// Jet-black angular carapace shard / debris chunk with 1px thin top-left rim edge
function drawBlackShell(p, b, Sh, rimFlash = 0) {
  const fade = Math.min(1, b.life / 0.28);
  if (fade <= 0.04 || b.x < X_MIN + 2 || b.x > X_MAX - 2 || b.y < Y_MIN + 2 || b.y > Y_MAX) return;
  const r = 1.05 + b.s * 0.94, ca = Math.cos(b.a), sa = Math.sin(b.a);
  const el = b.elong ?? 1.45;
  p.shade(b.x - r - 2, b.y - r - 2, b.x + r + 2, b.y + r + 2, (x, y, out) => {
    const dx = x - b.x, dy = y - b.y;
    const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    const d = Math.abs(u) / (r * el) + Math.abs(v) / (r * 0.66);
    if (d > 1.05) return;
    out.a = fade;
    if (d > 0.75 && dx + dy < -r * 0.45) out.c = rimFlash > 0.25 ? WHITE : Sh[4];
    else if (d > 0.80) out.c = Sh[0];
    else if (dx + dy < -r * 0.3 && d > 0.58) out.c = Sh[3];
    else out.c = Sh[0];
  });
}

// Compact tilted vertical-oval pierce shock ring
function drawPierceRing(p, cx, cy, rx, ry, colOuter, colInner, alpha, brk = 0) {
  if (alpha <= 0.03 || rx < 1.5) return;
  const steps = Math.max(20, Math.ceil(Math.max(rx, ry) * 2.8));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    if (brk > 0 && Math.sin(a * 5 + 0.7) > 1 - brk * 1.55) continue;
    const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
    if (px < X_MIN + 2 || px > X_MAX - 2 || py < Y_MIN + 2 || py > -0.5) continue;
    p.dot(px, py, colOuter, alpha);
    p.dot(px - Math.cos(a) * 0.8, py - Math.sin(a) * 0.6, colInner, alpha * 0.88);
  }
}

// Tight, localized Red-White Interlaced Piercing Flash at the strike point (no oversized glaring halo!)
function drawRedWhitePierce(p, cx, cy, q, dur, hitStar, ringSegs, pressureArcs, F, Sh) {
  if (q < 0 || q >= dur) return;
  const u = q / dur;
  const fade = 1 - smooth(0.45, 1, u);

  // 1. Compact black-rimmed oppressive impact arcs around the struck chest
  if (q < 0.14) {
    const au = q / 0.14;
    const ak = 1 - smooth(0.48, 1, au);
    for (const arc of pressureArcs) {
      const lim = Math.ceil((arc.length - 1) * ease.outQuart(Math.min(1, au * 2.2)));
      for (let i = 0; i < lim; i++) {
        const [x0, y0] = arc[i], [x1, y1] = arc[i + 1];
        p.line(x0, y0 + 1, x1, y1 + 1, Sh[0], ak * 0.9);
        p.line(x0, y0 - 1, x1, y1 - 1, Sh[0], ak * 0.9);
        p.line(x0, y0, x1, y1, au < 0.42 ? WHITE : F[3], ak);
      }
    }
  }

  // 2. Tight interlaced red & white skewer lance-needles focused around the wound (max reach ~34px)
  const rayL = (q < 0.03 ? lerp(18, 34, q / 0.03) : 34 * (1 - smooth(0.08, 0.78, u)));
  const lanceRays = [
    [0.0, 1.0, WHITE, F[3], 1.15],
    [0.05, 0.86, F[3], WHITE, 0.9],
    [-0.05, 0.86, F[3], WHITE, 0.9],
    [Math.PI, 0.62, WHITE, F[2], 0.95],
    [-0.24, 0.72, WHITE, F[3], 0.85],
    [0.24, 0.72, WHITE, F[3], 0.85],
    [-Math.PI / 2, 0.56, WHITE, F[3], 0.85],
    [Math.PI / 2, 0.48, F[3], WHITE, 0.85],
  ];
  for (const [ang, mul, cCore, cSide, wMul] of lanceRays) {
    const L = rayL * mul;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let d = 1; d <= L; d += 0.5) {
      const du = d / L;
      const px = cx + ca * d, py = cy + sa * d;
      if (px < X_MIN || px > X_MAX || py < Y_MIN || py > -0.5) continue;
      const a = fade * (du < 0.64 ? 1 : 1 - (du - 0.64) / 0.36);
      p.dot(px, py, du < 0.46 ? cCore : du < 0.82 ? cSide : F[1], a);
      if (du < 0.30 * wMul) {
        p.dot(px - sa, py + ca, cSide, a * 0.88);
        p.dot(px + sa, py - ca, cSide, a * 0.88);
      }
    }
  }
  p.glowLine(cx - rayL * 0.55, cy, cx + rayL * 0.85, cy, 3.2, F[3], 0.32 * fade);

  // 3. Compact Red-White Interlaced Starburst right on the chest wound
  if (q < 0.14) {
    const su = q / 0.14;
    const sc = su < 0.24 ? lerp(0.75, 1.05, su / 0.24) : lerp(1.05, 0.68, (su - 0.24) / 0.76);
    const cols = su < 0.35 ? [F[1], F[3], WHITE, WHITE] : [F[0], F[2], F[4], WHITE];
    star(p, cx, cy, hitStar, sc, Math.max(0.28, 1 - su * 0.72), cols, 1 - smooth(0.55, 1, su), 2.5);
  }

  // 4. Compact vertical-oval pierce ring (r <= 19px)
  if (q < 0.16) {
    const ru = q / 0.16;
    const ox = cx + 4 + 12 * ease.outQuart(ru);
    drawPierceRing(p, ox, cy, 2.5 + 6.5 * ease.outCubic(ru), 5 + 14 * ease.outCubic(ru), ru < 0.32 ? WHITE : F[3], F[1], 1 - ru, smooth(0.18, 0.9, ru));
    brokenRing(p, cx, cy, 5 + 15 * ease.outQuart(ru), Math.max(0.5, 1.4 * (1 - ru)), ringSegs, smooth(0.1, 0.82, ru), ru < 0.3 ? WHITE : F[3], F[1], (1 - ru) * 0.78, 0.88, 0);
  }
}

export function create(o) {
  const C = fit(o.palette, 8), Sh = fit(o.shell, 5), F = fit(o.flash, 6);
  const R = new Rng(o.seed), floor = () => 0;

  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, F[4], F[3], C[5]], haze: F[2] });
  const shellBits = new Bits({ ground: floor }), debrisBits = new Bits({ ground: floor }), lights = new Lights();
  const bounceDust = [];

  // Origin radial burst: 8 short razor dark-brown cold-glint chitin spikes radiating cleanly from caster center
  const originSpikes = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * TAU + R.range(-0.14, 0.14);
    const fwd = Math.cos(a) > 0.25;
    return {
      a,
      back: Math.cos(a) < -0.1,
      len: fwd ? R.range(13, 18) : R.range(10, 15),
      hw: fwd ? R.range(1.8, 2.4) : R.range(1.5, 2.1),
      r0: 6,
      rMax: fwd ? R.range(20, 29) : R.range(15, 23),
      delay: R.range(0, 0.012),
      dur: R.range(0.095, 0.135),
    };
  });

  // 6 staggered forward chitin spikes travelling over a clearly visible ~0.25s spinning flight cycle across 146px
  const volleyDarts = Array.from({ length: 6 }, (_, i) => {
    const row = i - 2.5;
    const wave2 = i % 2 === 1;
    const t0 = T_BURST + (wave2 ? 0.055 : 0) + Math.abs(row) * 0.008;
    const t1 = t0 + FLIGHT;
    const y0 = BY + row * 2.2;
    const y1 = -26 + row * 3.2;
    const x1 = TX + (wave2 ? 6 : 0) + R.range(-2, 3);
    const ang = Math.atan2(y1 - y0, x1 - (BX + 4));
    return {
      t0,
      t1,
      x0: BX + 4,
      y0,
      x1,
      y1,
      ang,
      len: R.range(15, 21),
      hw: wave2 ? 2.25 : 1.9,
      spinRate: R.range(36, 48) * (i % 2 ? 1 : -1),
      phase: R.range(0, TAU),
      shedAcc: R.range(0, 0.5),
    };
  });

  const hitStar1 = spikes(R, 10, 0, { len: [7, 11], w: [1.3, 1.8], fwd: 1.4, back: 0.7, jag: 0.48 });
  const hitStar2 = spikes(R, 14, 0, { len: [10, 15], w: [1.5, 2.2], fwd: 1.55, back: 0.78, jag: 0.46 });
  const ringSegs = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * TAU + R.range(-0.1, 0.1), gap: R.range(0.48, 0.76), dr: R.range(0.16, 0.4) }));

  // 4 compact jagged black-rimmed oppressive stress arcs tight around the impact point
  const pressureArcs = Array.from({ length: 4 }, (_, i) => {
    const a0 = [-0.65, 0.55, -2.55, 2.45][i] + R.range(-0.1, 0.1);
    const pts = [[TX + 6 + Math.cos(a0) * 4, -25 + Math.sin(a0) * 4]];
    let a = a0, x = pts[0][0], y = pts[0][1];
    for (let s = 0; s < 4; s++) {
      a += (s % 2 ? -1 : 1) * R.range(0.28, 0.5);
      const step = R.range(4, 6.5);
      x = clamp(x + Math.cos(a) * step, X_MIN + 10, X_MAX - 10);
      y = clamp(y + Math.sin(a) * step, Y_MIN + 10, -2);
      pts.push([x, y]);
    }
    return pts;
  });

  let t = 0, burstDone = false, hit1Done = false, hit2Done = false;

  return {
    update(dt) {
      t += dt;

      // Pre-burst inward dark-chitin tension streaks
      if (t < T_BURST && R.chance(1.3 * dt * 60)) {
        const a = R.range(0, TAU), d = R.range(12, 26);
        ps.spawn(P.STREAK, BX + Math.cos(a) * d, BY + Math.sin(a) * d, -Math.cos(a) * 145, -Math.sin(a) * 145, R.range(0.05, 0.10), R.chance(0.5) ? C[5] : C[3], 1);
      }

      // 0.03s: Origin radial burst of crisp black shell shard particles (18 angular flakes)
      if (!burstDone && t >= T_BURST) {
        burstDone = true;
        lights.add(BX + 4, BY, 32, C[4], 0.48, 0.14);
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * TAU + R.range(-0.16, 0.16);
          const sp = R.range(92, 210) * (Math.cos(a) > 0 ? 1.15 : 0.85);
          shellBits.add({
            kind: B.SHARD,
            x: BX + Math.cos(a) * 6,
            y: BY + Math.sin(a) * 6,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 16,
            g: 0.86,
            drag: 0.82,
            bounce: 0.30,
            life: R.range(0.32, 0.54),
            a: R.range(0, TAU),
            va: R.range(-24, 24),
            s: R.range(1.3, 2.2),
            elong: R.range(1.2, 1.6),
          });
        }
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU + R.range(-0.2, 0.2), sp = R.range(105, 225);
          ps.spawn(P.MOTE, BX + Math.cos(a) * 5, BY + Math.sin(a) * 5, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.09, 0.18), R.pick([C[6], C[4], C[2]]), 0.7);
        }
      }

      // Cyclic mid-flight shedding of tiny black shell flakes and crisp speed motes during flight cycle!
      for (const d of volleyDarts) {
        if (t >= d.t0 && t <= d.t1) {
          const u = clamp((t - d.t0) / (d.t1 - d.t0));
          const hx = lerp(d.x0, d.x1, u), hy = lerp(d.y0, d.y1, u);
          for (d.shedAcc += dt * 26; d.shedAcc > 1; d.shedAcc--) {
            ps.spawn(P.GRIT, hx - Math.cos(d.ang) * d.len * 0.7, hy + R.range(-2, 2), R.range(-30, 35), R.range(-22, 16), R.range(0.16, 0.34), R.pick([Sh[0], Sh[3], C[3]]), 1);
          }
        }
      }

      // Wave 1 hits enemy chest
      if (!hit1Done && t >= T_HIT1) {
        hit1Done = true;
        lights.add(TX + 1, -27, 18, F[3], 0.34, 0.10);
        for (let i = 0; i < 3; i++) {
          const a = R.range(-2.6, 0.6), sp = R.range(105, 185);
          debrisBits.add({ kind: B.CHUNK, x: TX + 1, y: -27, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 22, g: 0.95, drag: 0.42, bounce: 0.52, life: R.range(0.55, 0.95), a: R.range(0, TAU), va: R.range(-20, 20), s: R.range(1.9, 2.8), elong: R.range(1.2, 1.6), pvy: 0 });
        }
        for (let i = 0; i < 8; i++) {
          const a = R.range(-0.85, 0.85), sp = R.range(115, 225);
          ps.spawn(P.SPARK, TX + 1, -27, Math.cos(a) * sp, Math.sin(a) * sp - 14, R.range(0.08, 0.18), i % 2 ? WHITE : F[3], 1);
        }
      }

      // Wave 2 heavy pierce — compact red-white piercing flash + 8 angular jet-black debris chunks bouncing outward
      if (!hit2Done && t >= T_HIT2) {
        hit2Done = true;
        lights.add(TX + 6, -25, 24, F[3], 0.38, 0.18);
        lights.add(TX + 6, -25, 10, WHITE, 0.54, 0.055);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + R.range(-0.2, 0.2);
          const sp = R.range(125, 255);
          debrisBits.add({
            kind: B.CHUNK,
            x: TX + 6 + R.range(-4, 4),
            y: -25 + R.range(-5, 5),
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 38,
            g: 0.96,
            drag: 0.36,
            bounce: 0.58,
            life: R.range(0.75, 1.25),
            a: R.range(0, TAU),
            va: R.range(-22, 22),
            s: R.range(2.1, 3.4),
            elong: R.range(1.2, 1.65),
            pvy: 0,
          });
        }
        for (let i = 0; i < 18; i++) {
          const fwd = R.chance(0.7);
          const a = (fwd ? 0 : Math.PI) + R.range(-0.9, 0.9);
          const sp = R.range(120, 255) * (fwd ? 1 : 0.65);
          ps.spawn(P.SPARK, TX + 6, -25, Math.cos(a) * sp, Math.sin(a) * sp - 18, R.range(0.10, 0.24), i % 2 ? WHITE : F[3], 1);
        }
      }

      for (const b of debrisBits.list) b.pvy = b.vy;
      shellBits.update(dt);
      debrisBits.update(dt);
      for (const b of debrisBits.list) {
        if (b.pvy > 48 && b.vy <= 0 && b.x > X_MIN + 8 && b.x < X_MAX - 8) {
          bounceDust.push({ x: b.x, y: -1, vx: R.sign() * R.range(8, 20), vy: -R.range(4, 10), r: R.range(1.5, 2.5), age: 0, life: 0.28 });
          b.pvy = 0;
        }
      }
      for (let i = bounceDust.length - 1; i >= 0; i--) {
        const d = bounceDust[i];
        d.age += dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.age >= d.life) bounceDust.splice(i, 1);
      }

      ps.update(dt);
      for (const arr of [shellBits.list, debrisBits.list, ps.list]) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const q = arr[i];
          if (q.x < X_MIN + 2 || q.x > X_MAX - 2 || q.y < Y_MIN + 2 || t >= T_END - 0.04) arr.splice(i, 1);
        }
      }
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;
      const uk1 = smooth(-0.04, T_BURST + 0.02, t) * (1 - smooth(T_BURST + 0.05, T_BURST + 0.18, t));
      if (uk1 > 0.02) {
        unlight(p, BX - 40, -64, BX + 42, 4, (x, y) => Math.hypot((x - BX) / 38, (y + 24) / 38) < 1, 1 - 0.54 * uk1);
      }
      const uk2 = smooth(T_HIT2 - 0.01, T_HIT2 + 0.015, t) * (1 - smooth(T_HIT2 + 0.12, T_HIT2 + 0.30, t));
      if (uk2 > 0.02) {
        unlight(p, TX - 42, -74, TX + 52, 4, (x, y) => Math.hypot((x - TX - 4) / 42, (y + 25) / 40) < 1, 1 - 0.72 * uk2);
      }

      if (t >= T_BURST && t < T_BURST + 0.14) {
        const age = t - T_BURST;
        for (const rs of originSpikes) {
          if (!rs.back) continue;
          const sa = age - rs.delay;
          if (sa < 0 || sa > rs.dur) continue;
          const ku = sa / rs.dur;
          const dist = rs.r0 + rs.rMax * ease.outCubic(ku);
          const sx = BX + Math.cos(rs.a) * dist, sy = BY + Math.sin(rs.a) * dist;
          p.line(sx - Math.cos(rs.a) * 6, sy - Math.sin(rs.a) * 6, sx, sy, C[2], (1 - ku) * 0.6);
          drawChitinSpike(p, sx, sy, rs.a, rs.len * (1 - 0.28 * ku), rs.hw * (1 - 0.25 * ku), C, 1 - smooth(0.45, 1, ku), 1 - ku);
        }
      }

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;

      // 0. Pre-burst coiled chitin pressure creases around caster chest
      if (t < T_BURST + 0.025) {
        const k = t < T_BURST ? smooth(-0.08, T_BURST, t) : 1 - (t - T_BURST) / 0.025;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + 0.25;
          const r = lerp(14, 6, t < T_BURST ? k : 1);
          drawChitinSpike(p, BX + Math.cos(a) * r, BY + Math.sin(a) * r, a + 0.35, 7 * k, 1.4, C, k * 0.88, k);
        }
      }

      // 1. Origin radial burst: front-side short dark-brown cold-glint spikes & shell fracture ring
      if (t >= T_BURST && t < T_BURST + 0.14) {
        const age = t - T_BURST;
        if (age < 0.08) {
          const rk = age / 0.08;
          p.ring(BX + 2, BY, 5 + 14 * ease.outQuart(rk), rk < 0.35 ? C[6] : C[4], 1 - rk);
        }
        for (const rs of originSpikes) {
          if (rs.back) continue;
          const sa = age - rs.delay;
          if (sa < 0 || sa > rs.dur) continue;
          const ku = sa / rs.dur;
          const dist = rs.r0 + rs.rMax * ease.outCubic(ku);
          const sx = BX + Math.cos(rs.a) * dist, sy = BY + Math.sin(rs.a) * dist;
          p.line(sx - Math.cos(rs.a) * 7, sy - Math.sin(rs.a) * 7, sx, sy, C[2], (1 - ku) * 0.65);
          drawChitinSpike(p, sx, sy, rs.a, rs.len * (1 - 0.28 * ku), rs.hw * (1 - 0.25 * ku), C, 1 - smooth(0.45, 1, ku), 1 - ku);
        }
      }

      // 2. Animated chitin spike flight cycle: spinning axial cold-glints, spiral air-cut sheaths, and speed tails
      for (const d of volleyDarts) {
        const u = (t - d.t0) / (d.t1 - d.t0);
        if (u < 0 || u > 1.02) continue;
        const cu = clamp(u);
        const hx = lerp(d.x0, d.x1, cu), hy = lerp(d.y0, d.y1, cu);
        const sx = hx - Math.cos(d.ang) * d.len, sy = hy - Math.sin(d.ang) * d.len;
        const roll = t * d.spinRate + d.phase;
        // Cycling slipstream wake + twisting air-cut ring pulsing down the flying shaft
        for (let k = 0; k < 14; k++) {
          const ku = k / 14;
          const wx = sx - Math.cos(d.ang) * k * 1.4, wy = sy - Math.sin(d.ang) * k * 1.4 + Math.sin(roll - k * 0.55) * 0.9 * (1 - ku);
          if (wx >= X_MIN + 2) p.dot(wx, wy, k < 4 ? C[5] : C[2], (1 - ku) * 0.78);
        }
        drawSpinSheath(p, lerp(sx, hx, 0.32), lerp(sy, hy, 0.32), d.ang, roll, C, Sh, 0.85 * (1 - 0.25 * cu));
        drawChitinSpike(p, sx, sy, d.ang, d.len, d.hw, C, u > 1 ? 1 - (u - 1) / 0.02 : 1, 0.9, roll);
      }

      // 3. Localized Red-White Interlaced Piercing Flashes + floor knockback skid at TX
      const q1 = t - T_HIT1;
      if (q1 >= 0 && q1 < 0.08) {
        const u1 = q1 / 0.08;
        star(p, TX + 1, -27, hitStar1, 0.8 + 0.25 * u1, 1 - 0.45 * u1, [F[1], F[3], WHITE, WHITE], 1 - u1, 1.9);
      }

      const q2 = t - T_HIT2;
      if (q2 >= 0 && q2 < 0.42) {
        const sk = 1 - smooth(0.18, 0.42, q2);
        const skidL = 16 * ease.outQuart(clamp(q2 / 0.14));
        p.line(TX - 2, 0.5, TX + skidL, 0.5, Sh[0], sk * 0.9);
        p.line(TX, 1.5, TX + skidL * 0.85, 1.5, F[1], sk * 0.65);
      }
      if (q2 >= 0 && q2 < 0.22) {
        drawRedWhitePierce(p, TX + 6, -25, q2, 0.22, hitStar2, ringSegs, pressureArcs, F, Sh);
      }

      // 4. Bounce dust puffs + jet-black origin shell shards + bold jet-black bouncing debris chunks
      for (const d of bounceDust) {
        const u = d.age / d.life;
        p.disc(d.x, d.y, d.r * (0.8 + 0.6 * u), Sh[3], (rad) => 0.42 * (1 - u) * (1 - rad * rad));
      }
      const rimFlash = t >= T_HIT2 && t < T_HIT2 + 0.06 ? 1 - (t - T_HIT2) / 0.06 : 0;
      for (const b of shellBits.list) drawBlackShell(p, b, Sh, 0);
      for (const b of debrisBits.list) drawBlackShell(p, b, Sh, rimFlash);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
