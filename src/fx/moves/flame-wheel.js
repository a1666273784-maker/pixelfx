// Flaming wheel ranged attack ("moves/flame-wheel"): wind-up ignition behind the caster, explosive forward hurl,
// high-speed spinning serrated solar-fire wheel trailing curved whirling flame ribbons and ground-scorching wake,
// brief grinding bite on contact, then catastrophic multi-layered detonation with X-cleave, shock-fronts & molten crater.
import { Particles, Bits, Lights, P, PF, B, Rng, fit, flare, sparkle, clamp, smooth, lerp, ease, rand, TAU, WHITE, READY } from "../../core/index.js";
import { hotFirst, flameBlade, flameTongue, simDraw, LAYERS } from "../fire/_lib.js";
import { star, brokenRing, makeCracks, drawCracks, frontCrescent, stone, rock, rockShape } from "../impacts/_lib.js";

const TX = 216;
const T_LAUNCH = 0.34;
const T_HIT = 0.90;
const T_BOOM = 1.02;
const T_END = 2.85;

export const meta = {
  name: "Flame wheel",
  desc: "Gathers an incandescent serrated fire wheel, hurls it hurtling along the ground in whirling flame arcs, grinds into the target, and erupts in an oppressive molten blast.",
  tags: ["move", "fire", "wheel", "chakram", "ranged", "projectile", "impact", "boss", "one-shot"],
  size: [400, 196],
  origin: [80, 152],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#1c0408", "#47090e", "#7d1112", "#ba2214", "#eb4e18", "#ff8424", "#ffbe3b", "#fff099", "#ffffff"],
    stone: "#3e3348",
    seed: 17,
  },
};

// Clean 12 fps-friendly poses with zero IK shortfall (both arms stay well within reach of shoulder)
const GUARD = { ...READY, x: 0, crouch: 3, lean: 2, fx: 11, fy: -21, bx: 9, by: -21, ffx: 8, fbx: -8 };
const COIL = { ...READY, x: -5, crouch: 6, lean: -4, turn: 0.7, fx: -9, fy: -27, bx: 3, by: -24, armsFront: true, ffx: 7, fbx: -9 };
const LAUNCH = { ...READY, x: 9, crouch: 5, lean: 5, turn: 0.45, fx: 20, fy: -24, bx: 1, by: -24, ffx: 13, fbx: -9, toeB: true, ghost: 1 };
const FOLLOW = { ...LAUNCH, x: 10, crouch: 6, lean: 6, fx: 21, fy: -22, bx: 1, by: -23, ghost: 0 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.28, GUARD],
    [0.0, COIL],
    [T_LAUNCH - 0.06, { ...COIL, crouch: 7, lean: -5, fx: -10, fy: -26 }],
    [T_LAUNCH, LAUNCH, "snap"],
    [T_LAUNCH + 0.16, FOLLOW],
    [T_BOOM, { ...FOLLOW, lean: 5, fx: 20, by: -23 }],
    [T_BOOM + 0.36, { ...GUARD, x: 4, crouch: 4 }],
    [1.8, GUARD],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_LAUNCH, stop: 0.04, shake: 0.14, amp: 1.8, target: false },
    { t: T_HIT, stop: 0.06, shake: 0.14, amp: 2.4, push: 2.0, straw: 18, y: -25 },
    { t: T_BOOM, stop: 0.18, shake: 0.46, amp: 4.9, push: 5.2, straw: 46, y: -25, skin: "char" },
    { t: T_END - 0.35, push: 0, straw: 0, flash: 0, skin: null },
  ],
  dust: [
    { t: T_LAUNCH, x: 12, n: 8, dir: 1 },
    { t: T_LAUNCH, x: -8, n: 6, dir: -1 },
  ],
};

const X_MIN = -74, X_MAX = 314, Y_MIN = -146, Y_MAX = 38;
const RSY = 0.22;

// Prebaked scalloped molten blast-puff LUTs (hand-pixeled jagged fire/smoke billows instead of plain circles)
const PUFF_LUTS = Array.from({ length: 22 }, (_, r) => {
  if (r < 2) return [];
  const pts = [];
  for (let dy = -r - 2; dy <= r + 2; dy++) {
    for (let dx = -r - 2; dx <= r + 2; dx++) {
      const a = Math.atan2(dy, dx);
      const scallop = 0.88 + 0.16 * Math.sin(a * 5 + r * 0.9) + 0.09 * Math.cos(a * 8 - r * 0.6);
      const q = Math.hypot(dx, dy) / (r * scallop);
      if (q > 1) continue;
      pts.push(dx, dy, q, (-dx * 0.35 + dy * 0.38) / Math.max(1, r) + (1 - q) * 0.55);
    }
  }
  return pts;
});

function drawScallopPuff(p, cx, cy, r, u, C, alpha) {
  const ri = clamp(Math.round(r), 2, 21), pts = PUFF_LUTS[ri];
  if (!pts || !pts.length || alpha <= 0.02) return;
  const rx = Math.round(cx), ry = Math.round(cy);
  const fade = 1 - smooth(0.55, 1, u);
  for (let i = 0; i < pts.length; i += 4) {
    const px = rx + pts[i], py = ry + pts[i + 1];
    if (px < X_MIN || px > X_MAX || py < Y_MIN || py > -1) continue;
    const q = pts[i + 2], shade = pts[i + 3];
    if (u > 0.65 && rand(px, py, ri + Math.floor(u * 10)) < (u - 0.65) * 2.2) continue;
    let col;
    if (q > 0.84) col = C[0];
    else if (u < 0.22) col = shade > 0.72 ? WHITE : shade > 0.45 ? C[7] : C[5];
    else if (u < 0.5) col = shade > 0.68 ? C[7] : shade > 0.4 ? C[5] : C[3];
    else if (u < 0.76) col = shade > 0.55 ? C[4] : shade > 0.25 ? C[2] : C[1];
    else col = shade > 0.42 ? C[2] : C[0];
    p.dot(px, py, col, alpha * fade);
  }
}

// High-speed serrated solar-fire wheel: counter-rotating inner turbine + heavy dark-forged rim + 9 hooked scythe teeth + swirling fire corona
function drawFlameWheel(p, cx, cy, R, rot, C, t, scale = 1, alpha = 1) {
  const rOut = R * scale;
  if (rOut < 2 || alpha <= 0.03) return;
  const tooth = 6.8 * scale;
  const corona = 4.6 * scale;
  const rad = Math.ceil(rOut + tooth + corona);
  const seg = TAU / 9;
  const frac = (v) => v - Math.floor(v);
  const x0 = Math.max(X_MIN, Math.floor(cx - rad)), x1 = Math.min(X_MAX, Math.ceil(cx + rad));
  const y0 = Math.max(Y_MIN, Math.floor(cy - rad)), y1 = Math.min(Y_MAX, Math.ceil(cy + rad));

  p.shade(x0, y0, x1, y1, (x, y, out) => {
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
    if (r > rOut + tooth + corona) return;
    const th = Math.atan2(dy, dx);

    // 1. Inside the wheel disc: blazing hub, dark forged collar, counter-spinning turbine spokes, white-hot outer rim
    if (r <= rOut) {
      if (r < rOut * 0.20) { out.a = alpha; return WHITE; }
      if (r < rOut * 0.34) { out.a = alpha; return C[0]; }
      if (r > rOut - 1.9 * scale) { out.a = alpha; return r > rOut - 0.9 * scale ? WHITE : C[7]; }
      if (Math.abs(r - rOut * 0.61) < 1.0 * scale) { out.a = alpha; return C[7]; }

      const outer = Math.sin(4 * (th - rot) - r * 0.26);
      const inner = Math.cos(6 * (th + rot * 0.85) + r * 0.18);
      out.a = alpha;
      if (r < rOut * 0.61) return inner > 0.38 ? C[7] : inner > -0.18 ? C[5] : C[1];
      return outer > 0.42 ? C[7] : outer > -0.12 ? C[5] : outer > -0.48 ? C[3] : C[1];
    }

    // 2. Hooked scythe-blade saw teeth spinning clockwise
    const ph = frac((th - rot) / seg);
    const h = tooth * Math.pow(ph, 1.32);
    if (r - rOut < h) {
      out.a = alpha;
      return ph > 0.86 ? WHITE : ph > 0.6 ? C[7] : ph > 0.32 ? C[5] : C[3];
    }

    // 3. Swirling tangential fire-sheath corona peeling off teeth in direction of rotation
    const dr = r - rOut;
    const swirl = 0.52 + 0.48 * Math.sin(th * 6 - rot * 2.4 - dr * 0.45 + t * 18);
    const env = Math.max(0, 1 - dr / (tooth + corona)) * swirl;
    if (env > 0.22) {
      out.a = alpha * Math.min(1, env * 1.45);
      return env > 0.62 ? C[6] : env > 0.4 ? C[4] : C[2];
    }
  });
}

// Curved tangential fire-whirl ribbons hugging the wheel's outer circumference so high-speed rotation reads in every frame
function drawWhirlArcs(p, cx, cy, rBase, rot, C, sc, alpha) {
  if (rBase < 4 || alpha <= 0.03) return;
  for (let i = 0; i < 3; i++) {
    const a0 = rot + (i * TAU) / 3;
    const span = 1.48;
    const steps = 26;
    for (let s = 0; s <= steps; s++) {
      const u = s / steps; // 0 = leading tooth tip, 1 = trailing swept flame tail
      const a = a0 - u * span;
      const rr = rBase + (2.4 + 6.8 * Math.pow(u, 0.78)) * sc;
      const hw = (1.6 + 2.8 * Math.sin(Math.PI * Math.pow(u, 0.55))) * sc * (1 - u * 0.45);
      const ca = Math.cos(a), sa = Math.sin(a);
      const col = u < 0.16 ? WHITE : u < 0.38 ? C[7] : u < 0.65 ? C[5] : u < 0.85 ? C[3] : C[1];
      const al = alpha * (1 - u * 0.65);
      for (let o = -hw; o <= hw; o += 0.85) {
        const px = cx + ca * (rr + o), py = cy + sa * (rr + o);
        if (px >= X_MIN && px <= X_MAX && py >= Y_MIN && py <= -1) p.dot(px, py, col, al);
      }
    }
  }
}

function drawGroundWave(p, cx, cy, r, sy, th, alpha, cols, back) {
  if (alpha <= 0.03 || r < 2) return;
  const rx = r + th + 2, ry = (r + th) * sy + th + 1;
  const x0 = Math.max(X_MIN, Math.floor(cx - rx)), x1 = Math.min(X_MAX, Math.ceil(cx + rx));
  const y0 = back ? Math.max(Y_MIN, Math.floor(cy - ry)) : Math.floor(cy);
  const y1 = back ? Math.floor(cy) : Math.min(Y_MAX, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / Math.max(1, r * sy);
    if (dy * dy > 1.7) continue;
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / r;
      const e = Math.hypot(dx, dy);
      if (e < 0.3) continue;
      const dist = Math.abs(1 - e) * r;
      if (dist > th) continue;
      const u = dist / th;
      p.dot(x, y, u < 0.26 ? cols[3] : u < 0.58 ? cols[2] : cols[1], alpha * (1 - u * 0.72));
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 9), H = hotFirst(C), st = stone(o.stone), R = new Rng(o.seed), seed = o.seed * 31;
  const floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[7], C[6], C[4]], haze: C[2] });
  const bits = new Bits({ ground: floor }), lights = new Lights();

  // Wheel trajectory: charges behind caster hand (-10, -27) -> snaps out to (24, -26) at launch -> hurtles across into target!
  const wheelX = (tt) => {
    if (tt < T_LAUNCH - 0.07) return lerp(-7, -10, clamp(tt / (T_LAUNCH - 0.07)));
    if (tt < T_LAUNCH) return lerp(-10, 23, ease.inQuad((tt - (T_LAUNCH - 0.07)) / 0.07));
    if (tt <= T_HIT) {
      const u = (tt - T_LAUNCH) / (T_HIT - T_LAUNCH);
      return lerp(23, TX - 6, 0.28 * u + 0.72 * Math.pow(u, 1.32));
    }
    return TX - 4;
  };
  const wheelY = (tt) => {
    if (tt < T_LAUNCH) return lerp(-27, -26, clamp(tt / T_LAUNCH));
    if (tt <= T_HIT) return -25 + Math.sin(tt * 36) * 1.1;
    return -25 + Math.sin(tt * 95) * 1.5;
  };

  // Clamped floor cracks centered at TX - 4 so zero pixels ever spill past canvas
  const hitCracks = makeCracks(R, 12, { len: [16, 62], maxY: 16, forks: 0.55 }).map((c) => ({
    ...c,
    pts: c.pts.map(([x, y, d]) => [clamp(x + TX - 4, X_MIN + 2, X_MAX - 2), clamp(y, 0.5, 18), d]),
    kids: c.kids.map((k) => k.map(([x, y, d]) => [clamp(x + TX - 4, X_MIN + 2, X_MAX - 2), clamp(y, 0.5, 18), d])),
  }));

  const hitSpikes = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * TAU + R.range(-0.06, 0.06);
    const downClamp = Math.sin(a) > 0.2 ? 1 - 0.55 * Math.sin(a) : 1;
    return { a, len: R.range(30, 52) * (i % 3 === 0 ? 1.45 : 0.82) * downClamp, w: R.range(2.2, 3.6) };
  });
  const segs = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * TAU, gap: R.range(0.5, 0.85), dr: R.range(0.08, 0.4), w: R.range(0.85, 1.35) }));

  // Scalloped rising magma explosion billows
  const blastPuffs = Array.from({ length: 22 }, (_, i) => {
    const u = i / 21;
    const a = R.range(-Math.PI * 0.9, -0.1);
    const sp = R.range(38, 138) * (1 - u * 0.25);
    return {
      x0: TX - 4 + R.range(-10, 10),
      y0: -16 - u * 34,
      vx: Math.cos(a) * sp * 0.72 + 10,
      vy: Math.sin(a) * sp,
      r0: lerp(12, 8, u),
      r1: lerp(18, 13, u),
      t0: T_BOOM + u * 0.06,
      life: R.range(0.5, 0.92),
    };
  });

  let t = 0, launched = false, grindDone = false, boomDone = false, acc = 0;

  return {
    update(dt) {
      t += dt;
      if (t < T_LAUNCH) {
        const k = clamp(t / T_LAUNCH);
        const cx = wheelX(t), cy = wheelY(t);
        for (acc += dt * (44 + 64 * k); acc >= 1; acc -= 1) {
          const a = R.range(0, TAU), d = R.range(16, 36);
          ps.spawn(P.STREAK, clamp(cx + Math.cos(a) * d, X_MIN + 2, X_MAX - 2), clamp(cy + Math.sin(a) * d, Y_MIN + 2, -2), -Math.cos(a) * 145, -Math.sin(a) * 145, 0.18, R.pick([C[7], C[6], C[5]]));
        }
      }
      if (!launched && t >= T_LAUNCH) {
        launched = true;
        lights.add(24, -26, 62, C[6], 0.9, 0.26);
        for (let i = 0; i < 24; i++) {
          const a = R.range(-1.15, 1.15), sp = R.range(95, 240);
          ps.spawn(P.SPARK, 24, -26, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.16, 0.34));
        }
      }
      if (t >= T_LAUNCH && t < T_BOOM) {
        const wx = wheelX(t), wy = wheelY(t);
        const grinding = t >= T_HIT;
        for (acc += dt * (grinding ? 380 : 210); acc >= 1; acc -= 1) {
          const a = R.range(0, TAU);
          if (R.chance(grinding ? 0.22 : 0.42)) {
            // Fast-cooling short fire wisps (no lingering detached dot lines in midair!)
            ps.spawn(P.FIRE, wx - 6 + R.range(-8, 6), wy + R.range(-14, 14), -R.range(55, 150), R.range(-26, 26), R.range(0.15, 0.28), 0, R.range(2.6, 5.0), 0, 0);
          } else {
            const sp = grinding ? R.range(190, 350) : 180;
            ps.spawn(P.SPARK, wx + Math.cos(a) * 20, wy + Math.sin(a) * 20, -Math.sin(a) * sp - (grinding ? 30 : 120), Math.cos(a) * sp, R.range(0.14, 0.34));
          }
          if (!grinding && R.chance(0.4)) {
            ps.spawn(P.SPARK, wx + R.range(-12, 8), -1, -R.range(70, 210), -R.range(28, 105), R.range(0.18, 0.36));
          }
        }
      }
      if (!grindDone && t >= T_HIT) {
        grindDone = true;
        lights.add(TX - 6, -25, 76, C[6], 1.0, 0.14);
      }
      if (!boomDone && t >= T_BOOM) {
        boomDone = true;
        lights.add(TX - 4, -24, 96, C[5], 1.25, 0.56);
        lights.add(TX - 4, -24, 52, WHITE, 1.0, 0.14);
        lights.add(TX - 4, -4, 78, C[4], 0.85, 0.65);
        for (let i = 0; i < 66; i++) {
          const a = R.range(0, TAU), sp = R.range(135, 340);
          ps.spawn(P.SPARK, TX - 4, -24, Math.cos(a) * sp + 20, Math.sin(a) * sp - 40, R.range(0.22, 0.62));
        }
        for (let i = 0; i < 28; i++) {
          const a = R.range(-Math.PI * 0.92, 0.18), sp = R.range(115, 280);
          bits.add({ kind: B.SHARD, x: TX - 4, y: -24, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 35, g: 0.78, drag: 0.88, bounce: 0.38, life: R.range(0.7, 1.38), a: R.range(0, TAU), va: R.range(-24, 24), s: R.range(2.4, 4.4), c: R.pick([C[1], C[4], C[5], C[6], C[7]]) });
        }
        for (let i = 0; i < 16; i++) {
          const a = -Math.PI / 2 + R.range(-0.9, 0.9), sp = R.range(130, 290);
          bits.add({ kind: B.CHUNK, x: TX + R.range(-8, 8), y: -2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.95, drag: 0.55, bounce: 0.35, life: R.range(1.0, 1.65), a: R.range(0, TAU), va: R.range(-16, 16), s: R.int(1, 3), pts: rockShape(R, 6) });
        }
        for (let i = 0; i < 26; i++) {
          const a = -Math.PI / 2 + R.range(-1.05, 1.05), sp = R.range(35, 130);
          ps.spawn(P.EMBER, TX + R.range(-16, 16), -R.range(4, 26), Math.cos(a) * sp, Math.sin(a) * sp - 20, R.range(0.8, 1.65), C[5], R.chance(0.32) ? 2 : 1);
        }
      }
      for (const q of ps.list) { q.x = clamp(q.x, X_MIN + 2, X_MAX - 2); q.y = clamp(q.y, Y_MIN + 2, -0.5); }
      for (const b of bits.list) { b.x = clamp(b.x, X_MIN + 4, X_MAX - 4); b.y = clamp(b.y, Y_MIN + 4, 0); }
      bits.update(dt);
      ps.update(dt);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-4) return;
      const endFade = 1 - smooth(T_END - 0.55, T_END - 0.04, t);
      if (t >= T_LAUNCH && t < T_BOOM + 0.85) {
        const wx = wheelX(Math.min(t, T_HIT));
        const trailA = (1 - smooth(T_BOOM, T_BOOM + 0.8, t)) * endFade;
        for (let x = 20; x <= Math.min(wx, TX); x += 2) {
          const u = clamp((wx - x) / 108);
          if (u >= 1) continue;
          const k = (1 - u) * trailA;
          p.dot(x, 0, k > 0.55 ? C[6] : k > 0.25 ? C[4] : C[2], k * 0.9);
          if (k > 0.35) p.dot(x, 1, C[3], k * 0.6);
        }
      }
      if (t >= T_BOOM) {
        const age = t - T_BOOM;
        const crK = (1 - smooth(0.95, 1.65, age)) * endFade;
        if (crK > 0.02) {
          const hotRamp = [WHITE, C[6], C[5], C[3]];
          drawCracks(p, hitCracks, (c) => c.len * ease.outCubic(clamp((age - c.t0) / 0.1)), (d) => clamp(1 - age / 1.15 - d * 0.005, 0, 1), hotRamp, C[1], st.lip, crK);
        }
        const uW = age / 0.45;
        if (uW < 1) drawGroundWave(p, TX - 4, 0, 14 + 72 * ease.outCubic(uW), RSY, Math.max(1, 5.2 * (1 - uW)), (1 - uW) * endFade, [C[2], C[4], C[6], WHITE], true);
      }
      simDraw(p, ps, H, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-4) return;
      const endFade = 1 - smooth(T_END - 0.55, T_END - 0.04, t);
      const N = (rate, s2 = 0, off = 0) => Math.sin(t * rate * 2 + off + s2);

      if (t < T_BOOM) {
        const wx = wheelX(t), wy = wheelY(t);
        const rot = t < T_LAUNCH ? t * t * 50 : 0.34 * 0.34 * 50 + (t - T_LAUNCH) * (t >= T_HIT ? 58 : 42);
        const sc = t < T_LAUNCH ? lerp(0.32, 0.52, clamp(t / (T_LAUNCH - 0.07))) + smooth(T_LAUNCH - 0.07, T_LAUNCH, t) * 0.56 : t >= T_HIT ? lerp(1.08, 1.24, (t - T_HIT) / (T_BOOM - T_HIT)) : 1.08;
        const Rw = 19.5 * sc;

        // Roaring comet flame wake & top/bottom speed lines when hurtling forward
        if (t >= T_LAUNCH && t < T_HIT) {
          for (const [len, hw, dy] of [[80, 12.0, 0], [56, 9.5, -8], [54, 9.5, 8]]) {
            const L = Math.min(len, Math.max(12, wx - X_MIN - 6));
            flameBlade(p, wx - 4, wy + dy, -1, dy * 0.02, L, hw, Math.sin(t * 24 + dy) * 3.5, N, seed + dy, H, LAYERS, 0.58, 1.45);
          }
          for (const yOff of [-Rw - 4, Rw + 4]) {
            const xEnd = Math.max(X_MIN + 4, wx - 60);
            p.line(wx - 2, wy + yOff, xEnd, wy + yOff, C[6], 0.85);
          }
        }

        // Clockwise whirling curved fire ribbons wrapping the rim + smaller tangential sparks
        if (t >= T_LAUNCH - 0.05) {
          drawWhirlArcs(p, wx, wy, Rw, rot, C, sc, 1);
          for (let i = 0; i < 4; i++) {
            const a = rot + (i * TAU) / 4;
            const ox = Math.cos(a) * Rw * 0.92, oy = Math.sin(a) * Rw * 0.92;
            const tx = -Math.sin(a) * 0.95 - (t >= T_LAUNCH && t < T_HIT ? 0.25 : 0);
            const ty = Math.cos(a) * 0.95;
            const l = Math.hypot(tx, ty) || 1;
            flameBlade(p, clamp(wx + ox, X_MIN + 6, X_MAX - 6), clamp(wy + oy, Y_MIN + 6, -4), tx / l, ty / l, 13 * sc, 3.4 * sc, 3.8 * sc, N, seed + i * 13, H, LAYERS, 0.45, 1.0);
          }
        }

        drawFlameWheel(p, wx, wy, 19.5, rot, C, t, sc, 1);

        // Launch snap sonic flame burst ring
        if (t >= T_LAUNCH && t < T_LAUNCH + 0.14) {
          const uL = (t - T_LAUNCH) / 0.14;
          p.ellipse(22, -26, 6, 25 * (1 - uL * 0.35), uL < 0.4 ? WHITE : C[6], 1 - uL);
          p.glow(22, -26, 40, C[6], (1 - uL) * 0.85);
        }

        // Grinding contact spark-cross right as the wheel bites the target!
        if (t >= T_HIT) {
          sparkle(p, wx + 6, wy, 20 + Math.sin(t * 65) * 6, C[6], WHITE, 1);
        }

        p.glow(wx, wy, 60 * sc, C[4], 0.7);
        p.glow(wx, wy, 24 * sc, C[7], 0.52);
        p.glow(wx, -2, 36 * sc, C[4], 0.38);
      } else {
        const age = t - T_BOOM;
        const uW = age / 0.45;
        if (uW < 1) drawGroundWave(p, TX - 4, 0, 14 + 72 * ease.outCubic(uW), RSY, Math.max(1, 5.2 * (1 - uW)), (1 - uW) * endFade, [C[2], C[4], C[6], WHITE], false);

        // Standing left/right shock crescents sweeping out across the floor
        if (age < 0.28) {
          const uC = age / 0.28;
          const dist = 12 + 58 * ease.outCubic(uC);
          const hC = 26 * (1 - uC * 0.65), wC = 8.5 * (1 - uC * 0.6);
          frontCrescent(p, clamp(TX - 4 + dist, X_MIN + 12, X_MAX - 8), 1, hC, wC, [WHITE, C[6], C[3]], (1 - uC) * endFade);
          frontCrescent(p, clamp(TX - 4 - dist, X_MIN + 8, X_MAX - 12), -1, hC, wC, [WHITE, C[6], C[3]], (1 - uC) * endFade);
        }

        // Towering vertical-diagonal flame rupture pillars shooting out of the explosion
        if (age < 0.42) {
          const uP = age / 0.42;
          const kP = ease.outCubic(clamp(uP / 0.18)) * (1 - smooth(0.45, 1, uP));
          for (const [dx, dxDir, dyDir, L0, w0] of [[0, 0.08, -1, 98, 12], [-8, -0.32, -0.95, 76, 9], [10, 0.38, -0.92, 82, 9.5]]) {
            flameBlade(p, TX - 4 + dx, -4, dxDir, dyDir, L0 * kP, w0 * kP, Math.sin(t * 20 + dx) * 3, N, seed + dx * 5, H, LAYERS, 0.55, 1.3);
          }
        }

        // Scalloped hand-pixeled molten blast clouds (dark crimson rim + blazing gold interior!)
        for (const bp of blastPuffs) {
          const bAge = t - bp.t0;
          if (bAge < 0 || bAge >= bp.life) continue;
          const u = bAge / bp.life;
          const bx = clamp(bp.x0 + bp.vx * (1 - Math.exp(-3.4 * bAge)) / 3.4, X_MIN + 18, X_MAX - 18);
          const by = clamp(bp.y0 + bp.vy * (1 - Math.exp(-2.8 * bAge)) / 2.8, Y_MIN + 18, -6);
          const r = lerp(bp.r0, bp.r1, ease.outCubic(u)) * (1 - smooth(0.62, 1, u) * 0.35);
          drawScallopPuff(p, bx, by, r, u, C, endFade);
        }

        // Diagonal fiery X-cleave slashes across impact center (crisp hit-confirm wheel tear!)
        if (age < 0.34) {
          const uX = age / 0.34;
          const kX = ease.outCubic(clamp(uX / 0.14)) * (1 - smooth(0.32, 1, uX));
          for (const [ang, L0, w0] of [[-0.66, 86, 6.2], [0.72, 82, 5.4]]) {
            const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
            const L = L0 * (0.55 + 0.45 * ease.outCubic(clamp(uX / 0.14)));
            const hw = w0 * (1 - uX * 0.55);
            p.poly([[clamp(TX - 4 + ca * L, X_MIN, X_MAX), clamp(-24 + sa * L, Y_MIN, Y_MAX)], [clamp(TX - 4 + nx * hw, X_MIN, X_MAX), clamp(-24 + ny * hw, Y_MIN, Y_MAX)], [clamp(TX - 4 - ca * L, X_MIN, X_MAX), clamp(-24 - sa * L, Y_MIN, Y_MAX)], [clamp(TX - 4 - nx * hw, X_MIN, X_MAX), clamp(-24 - ny * hw, Y_MIN, Y_MAX)]], C[0], kX);
            p.poly([[clamp(TX - 4 + ca * L * 0.9, X_MIN, X_MAX), clamp(-24 + sa * L * 0.9, Y_MIN, Y_MAX)], [clamp(TX - 4 + nx * hw * 0.55, X_MIN, X_MAX), clamp(-24 + ny * hw * 0.55, Y_MIN, Y_MAX)], [clamp(TX - 4 - ca * L * 0.9, X_MIN, X_MAX), clamp(-24 - sa * L * 0.9, Y_MIN, Y_MAX)], [clamp(TX - 4 - nx * hw * 0.55, X_MIN, X_MAX), clamp(-24 - ny * hw * 0.55, Y_MIN, Y_MAX)]], uX < 0.28 ? WHITE : C[6], kX);
          }
        }

        // Broken radial shockwave & blinding hit starburst
        const uR = age / 0.36;
        if (uR < 1) brokenRing(p, TX - 4, -24, 14 + 54 * ease.outCubic(uR), Math.max(1, 4.2 * (1 - uR)), segs, smooth(0.15, 0.7, uR), uR < 0.25 ? WHITE : C[6], C[3], (1 - uR) * endFade, 1, 0);
        if (age < 0.16) {
          const kS = 1 - age / 0.16;
          star(p, TX - 4, -24, hitSpikes, age < 0.04 ? 1.18 : 1.0, 0.7 + 0.5 * kS, [C[3], C[5], C[6], WHITE], kS, 2.5);
          flare(p, TX - 4, -24, 58 * kS, kS, [C[4], C[6], C[7], WHITE]);
        }

        // Ground fire aftermath smoldering cleanly out before T_END
        if (age < 1.55) {
          const kF = 1 - smooth(0.65, 1.55, age);
          for (let i = -2; i <= 2; i++) {
            const fh = (20 - Math.abs(i) * 4) * kF * (0.8 + 0.2 * Math.sin(t * 16 + i));
            flameTongue(p, TX - 4 + i * 11, 0, fh, 3.8 * kF, Math.sin(t * 8 + i) * 2, N, seed + i * 7, H, LAYERS);
          }
        }
      }

      for (const b of bits.list) if (b.kind === B.CHUNK) rock(p, b, st);
      bits.draw(p);
      simDraw(p, ps, H, "front");
      lights.draw(p);
    },
  };
}
