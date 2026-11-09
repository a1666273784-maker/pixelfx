// Underground shadow-wood spike ambush ("moves/shadow-wood-spike"):
// 1. Release (0.00s): caster raises both hands and slams abyssal shadow force into the floor, sending a dark-violet
//    ground fissure straight under the target.
// 2. Warning (0.00s..0.50s): purple-black ominous smoke billows and churning brown soil clods & mound heave violently
//    beneath the target for 0.5 seconds.
// 3. Eruption & Impale (0.50s): a towering, razor-sharp gnarled deadwood shadow spike blasts upward out of the earth
//    through the target amid flying soil slabs, grit, and rolling dust.
// 4. Hit Result & Shatter (0.51s..2.95s): an oppressive purple-black shadow shockwave, cursed violet sparks, and
//    30 scattering deadwood splinters burst from the strike point; the dark spike holds menacingly, then fractures top-down.
import { Particles, Bits, Lights, P, PF, B, Rng, fit, clamp, smooth, lerp, ease, rand, TAU, WHITE, READY, mix } from "../../core/index.js";
import { stoneShape, drawRock } from "../nature/_lib.js";
import { spikes, star, brokenRing, frontCrescent } from "../impacts/_lib.js";
import { Puffs, PK } from "../shadow/_lib.js";

const TX = 128;
const T_ERUPT = 0.50;
const T_IMPALE = 0.51;
const T_SHATTER = 1.68;
const T_END = 2.95;

export const meta = {
  name: "Shadow wood spike",
  desc: "Purple-black smoke and churning dirt warn for 0.5s before a deadwood shadow spike impales the target with a shadow shockwave and scattering wood splinters.",
  tags: ["move", "wood", "shadow", "spike", "ground", "ambush", "impale", "one-shot"],
  size: [324, 204],
  origin: [82, 176],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#09050b", "#1c1018", "#351e22", "#54322c", "#764b3b", "#9d6c53", "#c69676", "#efd5b8"],
    shadow: ["#06040b", "#150924", "#2a104c", "#4b1a86", "#7832c6", "#ad6ae8", "#dfbcff"],
    soil: ["#120c0c", "#251917", "#3b2a24", "#553d31", "#715440", "#8f6e52", "#b8966e", "#e6d0a8"],
    seed: 17,
  },
};

const GUARD = { ...READY, crouch: 2, lean: 1, fx: 11, fy: -21, bx: 9, by: -21, ffx: 8, fbx: -8 };
const RAISE = { ...READY, crouch: 0, lean: -5, turn: 0.72, fx: -6, fy: -36, bx: 12, by: -35, armsFront: true, ffx: 7, fbx: -9 };
const SLAM = { ...READY, crouch: 8, lean: 7, fx: 16, fy: -11, bx: 12, by: -12, armsFront: true, ffx: 12, fbx: -9, ghost: 1 };
const HOLD = { ...SLAM, crouch: 7, lean: 5, ghost: 0 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.42, GUARD],
    [-0.14, RAISE],
    [-0.01, { ...RAISE, fx: -4, fy: -38 }],
    [0.00, SLAM, "snap"],
    [T_ERUPT + 0.35, HOLD],
    [1.15, { ...GUARD, x: 2, crouch: 3 }],
    [1.65, GUARD],
    [T_END, GUARD],
  ],
  hits: [
    { t: 0.00, stop: 0.03, shake: 0.14, amp: 2.0, target: false },
    { t: 0.28, stop: 0, shake: 0.22, amp: 0.9, push: 0, straw: 0, flash: 0, shiver: 0.22 },
    { t: T_ERUPT, stop: 0.18, shake: 0.54, amp: 5.8, push: -2.6, straw: 48, flash: 0.10, skin: "shadow", shiver: 2.2, y: -24 },
    { t: T_SHATTER + 0.25, push: 0.4, straw: 0, flash: 0, skin: null },
  ],
  dust: [
    { t: 0.00, x: 13, n: 9, dir: 1 },
    { t: 0.14, x: TX, n: 6 },
    { t: T_ERUPT, x: TX + 12, n: 10, dir: 1 },
    { t: T_ERUPT, x: TX - 12, n: 10, dir: -1 },
  ],
};

const X_MIN = -76, X_MAX = 236, Y_MIN = -170;

// Gnarled deadwood shadow spike: sharp asymmetrical silhouette, dark shadow-soaked lower bark,
// protruding wood barbs, vertical bark grain fissures, and razor bevel ridge up to a 1px tip
function drawDeadwoodSpike(p, cx, base, h, w, lean, hook, W, Sh, seed, opts = {}) {
  if (h < 2) return;
  const a = opts.a ?? 1, white = opts.white, clip = opts.clip ?? 1, floorY = opts.floor ?? Infinity;
  const spine = (u) => cx + lean * u + hook * Math.pow(u, 2.0) + Math.sin(u * 8.5 + seed) * 0.9 * (1 - u);
  const hw = (u, side) => {
    let v = (w * 0.5) * Math.pow(Math.max(0, 1 - u), 0.78) + 0.35;
    if (side < 0 && u > 0.26 && u < 0.36) v -= 1.6;
    if (side > 0 && u > 0.54 && u < 0.63) v -= 1.3;
    return Math.max(0.35, v);
  };
  const Y0 = Math.max(Y_MIN, Math.floor(base - h) - 2);
  const Y1 = Math.min(20, Math.ceil(base));

  for (let py = Y0; py < Y1; py++) {
    const u = (base - (py + 0.5)) / h;
    if (u < 0 || u > clip || py + 0.5 > floorY) continue;
    const mid = spine(u);
    const l = mid - hw(u, -1), r = mid + hw(u, 1);
    for (let px = Math.floor(l) - 1; px <= Math.ceil(r) + 1; px++) {
      if (px < X_MIN || px > X_MAX) continue;
      const fx = px + 0.5;
      if (fx < l || fx > r) {
        if (fx >= l - 1.1 && fx <= r + 1.1) p.dot(px, py, u < 0.42 ? Sh[3] : W[0], a);
        continue;
      }
      if (white) { p.dot(px, py, WHITE, a); continue; }
      const q = ((fx - l) / Math.max(0.5, r - l)) * 2 - 1;
      const grain = rand(Math.floor(fx), Math.floor(u * 14), seed) < 0.16;
      const ridge = -0.2 + Math.sin(u * 6.5 + seed) * 0.08;
      let col;
      if (u < 0.20 && (q > 0.1 || rand(px, py, seed + 5) < 0.48)) col = u < 0.10 ? Sh[1] : Sh[2];
      else if (u > 0.88) col = q < ridge + 0.25 ? W[7] : Sh[5];
      else if (Math.abs(q - ridge) < 0.14) col = W[6];
      else if (q < ridge) col = fx - l < 1.2 ? Sh[4] : q < -0.52 ? W[5] : W[4];
      else col = r - fx < 1.2 ? Sh[3] : q < 0.45 ? W[3] : W[2];
      if (grain && col !== W[7]) col = u < 0.36 ? Sh[0] : W[1];
      p.dot(px, py, col, a);
    }
  }

  // Sharp protruding deadwood barbs (only on full-size main spike)
  if (!white && opts.barbs && h > 30) {
    for (const [bu, side, bLen] of [[0.25, -1, 11], [0.45, 1, 9.5], [0.64, -1, 7.5]]) {
      if (bu > clip) continue;
      const y0 = base - bu * h, mid = spine(bu);
      const bx = mid + side * hw(bu, side) * 0.86;
      const tx = bx + side * bLen * 0.72, ty = y0 - bLen * 0.98;
      if (ty < Y_MIN || y0 > floorY) continue;
      p.tri(bx, y0 + 2, bx, y0 - 2.2, tx, ty, W[2], a);
      p.line(bx, y0 - 2, tx, ty, side < 0 ? W[6] : Sh[4], a);
      p.line(bx, y0 + 2, tx, ty, W[0], a);
      p.dot(tx, ty, W[7], a);
    }
  }
}

// Sharp weathered deadwood splinter fragment
function drawSplinter(p, b, W, Sh) {
  const fade = Math.min(1, b.life / 0.35);
  const ca = Math.cos(b.a), sa = Math.sin(b.a), L = b.s * 2.3, hw = Math.max(0.85, b.s * 0.38);
  const x0 = b.x - ca * L * 0.5, y0 = b.y - sa * L * 0.5;
  const x1 = b.x + ca * L * 0.5, y1 = b.y + sa * L * 0.5;
  const nx = -sa * hw, ny = ca * hw;
  if (x0 < X_MIN + 2 || x1 > X_MAX - 2 || y0 < Y_MIN + 2 || y1 < Y_MIN + 2) return;
  p.tri(x0, y0, x1 + nx, y1 + ny, x1 - nx, y1 - ny, W[0], fade);
  p.line(x0, y0, x1, y1, b.cursed ? Sh[5] : b.pale ? W[6] : W[5], fade);
  p.line(x0, y0, x1 - nx * 0.65, y1 - ny * 0.65, W[3], fade);
  p.dot(x0, y0, b.cursed ? Sh[6] : W[7], fade);
}

export function create(o) {
  const W = fit(o.palette, 8), Sh = fit(o.shadow, 7), S = fit(o.soil, 8);
  const R = new Rng(o.seed), seed = o.seed * 19 + 5, floor = () => 0;

  const ps = new Particles({ rng: R, ground: floor, sparks: [Sh[6], Sh[5], Sh[4], W[7]], haze: Sh[3] });
  const bits = new Bits({ ground: floor }), splinters = new Bits({ ground: floor }), lights = new Lights();
  const puffs = new Puffs({
    rng: R,
    flame: [Sh[6], Sh[5], Sh[4], Sh[3], Sh[2], Sh[1], Sh[0]],
    soot: [mix(Sh[2], Sh[0], 0.45), Sh[0]],
    cap: Sh[3],
    rim: [Sh[5], Sh[4], Sh[2]],
    floor,
  });
  const mainH = 92;
  const slabs = [-1, 1].map((sd) => ({ sd, x: TX + sd * R.range(12, 16), pts: [[-1.15, -0.35], [1.15, -0.4], [1.2, 0.35], [-1.15, 0.4]], s: R.range(5.2, 6.8), a: sd * R.range(0.45, 0.7) }));
  const hitSpikes = spikes(R, 12, 0, { len: [12, 22], w: [1.5, 2.4], fwd: 1.35, back: 1.25, jag: 0.5 });
  const ringSegs = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * TAU + R.range(-0.1, 0.1), gap: R.range(0.42, 0.7), dr: R.range(0.2, 0.45) }));

  let t = 0, eruptDone = false, impaleDone = false, shatterDone = false, sootAcc = 0;

  // Starts punching well through the target chest at exact T_ERUPT and rams full-height in ~48ms
  const spikeGrown = () => (t < T_ERUPT ? 0 : ease.outBack(clamp(0.36 + (t - T_ERUPT) / 0.068), 2.15));

  return {
    update(dt) {
      t += dt;
      const f = Math.min(1, dt * 120);

      // 0.00..0.50s: Rich purple-black shadow soot smoke + churning rolling dirt warning particles at TX
      if (t < T_ERUPT) {
        const rampK = smooth(0, T_ERUPT, t);
        for (sootAcc += dt * (28 + 38 * rampK); sootAcc > 1; sootAcc--) {
          puffs.spawn(PK.SOOT, TX + R.range(-23, 23), -R.range(2, 8), R.range(-32, 32), -R.range(34, 78), R.range(0.42, 0.78), R.range(5.2, 9.0));
        }
        // Dark-violet rising warning wisps curling upward from the cursed dirt
        if (R.chance(0.45 * f)) {
          ps.spawn(P.VAPOUR, TX + R.range(-18, 18), -R.range(2, 10), R.range(-18, 18), -R.range(28, 64), R.range(0.35, 0.62), R.pick([Sh[3], Sh[4], Sh[2]]), R.range(3.2, 5.8));
        }
        if (R.chance(0.78 * f)) {
          const sd = R.sign();
          ps.spawn(P.GRIT, TX + R.range(-18, 18), -1, sd * R.range(20, 76), -R.range(62, 160), R.range(0.35, 0.72), R.pick([S[6], S[5], S[4]]), R.chance(0.45) ? 2 : 1);
        }
        if (R.chance(0.44 * f)) {
          const sd = R.sign();
          ps.spawn(P.DUST, TX + sd * R.range(4, 16), -1, sd * R.range(28, 84), -R.range(8, 28), R.range(0.36, 0.66), S[5], R.range(2.5, 4.5));
        }
        if (R.chance(0.28 * f)) {
          bits.add({ kind: B.CHUNK, x: TX + R.range(-14, 14), y: -1, vx: R.range(-64, 64), vy: -R.range(80, 158), g: 1, drag: 0.38, bounce: 0.3, life: R.range(0.48, 0.85), a: R.range(0, TAU), va: R.range(-14, 14), s: R.range(1.6, 2.9), pts: stoneShape(R) });
        }
      }

      // 0.50s: Colossal Deadwood Shadow Spike explodes upward + bursts soil chunks & dark smoke
      if (!eruptDone && t >= T_ERUPT) {
        eruptDone = true;
        lights.add(TX, -mainH * 0.52, 56, Sh[3], 0.45, 0.42);
        lights.add(TX, -26, 26, WHITE, 0.45, 0.08);
        for (let i = 0; i < 18; i++) {
          puffs.spawn(PK.SOOT, TX + R.range(-14, 14), -R.range(2, 16), R.range(-72, 72), -R.range(22, 82), R.range(0.55, 0.98), R.range(4.5, 8.2));
        }
        for (let i = 0; i < 20; i++) {
          const a = -Math.PI / 2 + R.range(-1.05, 1.05), sp = R.range(135, 325);
          bits.add({ kind: B.CHUNK, x: TX + R.range(-10, 10), y: -2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1, drag: 0.35, bounce: 0.32, life: R.range(1.0, 1.75), a: R.range(0, TAU), va: R.range(-14, 14), s: R.range(1.8, 3.8), pts: stoneShape(R) });
        }
        for (let i = 0; i < 46; i++) {
          const a = -Math.PI / 2 + R.range(-1.0, 1.0), sp = R.range(95, 295);
          ps.spawn(P.GRIT, TX + R.range(-10, 10), -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.8, 1.55), R.pick([S[6], S[5], S[4], S[3]]), R.chance(0.4) ? 2 : 1);
        }
        for (let i = 0; i < 12; i++) {
          const sd = R.sign();
          ps.spawn(P.SMOKE, TX + sd * R.range(2, 10), -2, sd * R.range(52, 162), -R.range(6, 28), R.range(0.75, 1.35), S[5], R.range(3.5, 6), 0, PF.BIG);
        }
      }

      // 0.51s: Impale Hit Result — shadow-violet shock burst, dark wisps, sparks, and 30 scattering deadwood splinters!
      if (!impaleDone && t >= T_IMPALE) {
        impaleDone = true;
        lights.add(TX, -30, 56, Sh[4], 0.72, 0.34);
        lights.add(TX, -30, 22, Sh[6], 0.54, 0.10);
        for (let i = 0; i < 30; i++) {
          const a = -Math.PI / 2 + R.range(-1.35, 1.35), sp = R.range(120, 305);
          splinters.add({ kind: B.SHARD, x: TX + R.range(-5, 5), y: -R.range(16, 44), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 24, g: 0.88, drag: 0.44, bounce: 0.28, life: R.range(0.85, 1.5), a: R.range(0, TAU), va: R.range(-24, 24), s: R.range(2.2, 4.6), pale: R.chance(0.45), cursed: R.chance(0.24) });
        }
        for (let i = 0; i < 12; i++) {
          puffs.spawn(PK.SOOT, TX + R.range(-8, 8), -R.range(20, 42), R.range(-78, 78), -R.range(18, 72), R.range(0.42, 0.78), R.range(4.0, 7.0));
        }
        for (let i = 0; i < 14; i++) {
          const a = -Math.PI / 2 + R.range(-1.2, 1.2), sp = R.range(40, 120);
          ps.spawn(P.VAPOUR, TX + R.range(-5, 5), -28, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.32, 0.58), R.pick([Sh[4], Sh[5], Sh[3]]), R.range(3.5, 6.2));
        }
        for (let i = 0; i < 28; i++) {
          const a = -Math.PI / 2 + R.range(-1.35, 1.35), sp = R.range(130, 320);
          ps.spawn(P.SPARK, TX + R.range(-4, 4), -28, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.18, 0.42));
        }
      }

      if (!shatterDone && t >= T_SHATTER) {
        shatterDone = true;
        lights.add(TX, -40, 32, Sh[3], 0.4, 0.28);
        for (let i = 0; i < 14; i++) {
          const u = R.range(0.25, 0.95);
          splinters.add({ kind: B.SHARD, x: TX + R.range(-5, 5), y: -u * mainH, vx: R.range(-98, 98), vy: -R.range(15, 95), g: 0.9, drag: 0.4, bounce: 0.25, life: Math.min(R.range(0.65, 1.05), T_END - t - 0.1), a: R.range(0, TAU), va: R.range(-18, 18), s: R.range(2.0, 3.8), pale: R.chance(0.4), cursed: R.chance(0.2) });
        }
        for (let i = 0; i < 8; i++) {
          puffs.spawn(PK.SOOT, TX + R.range(-6, 6), -R.range(10, 68), R.range(-28, 28), -R.range(18, 45), R.range(0.45, 0.78), R.range(3.5, 5.8));
        }
      }

      puffs.update(dt);
      bits.update(dt);
      splinters.update(dt);
      ps.update(dt);
      for (const arr of [bits.list, splinters.list, ps.list]) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const q = arr[i];
          if (q.x < X_MIN + 2 || q.x > X_MAX - 2 || q.y < Y_MIN + 2 || t >= T_END - 0.04) arr.splice(i, 1);
        }
      }
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;
      // Jagged creeping shadow fissure pulse racing from caster to target during release
      if (t < 0.34) {
        const head = 16 + ease.outCubic(clamp(t / 0.16)) * (TX - 16);
        const tail = 16 + ease.outCubic(clamp((t - 0.08) / 0.18)) * (TX - 16);
        const pulseFade = 1 - smooth(0.18, 0.34, t);
        if (head > tail + 2 && pulseFade > 0.02) {
          for (let px = Math.floor(tail); px <= Math.floor(head); px += 2) {
            const jy = rand(px, 13, seed) > 0.6 ? 1 : 0;
            const u = (px - tail) / Math.max(1, head - tail);
            p.dot(px, jy, u > 0.65 ? Sh[5] : Sh[3], pulseFade * (0.4 + 0.6 * u));
          }
          p.glow(head, 0, 12, Sh[4], 0.38 * pulseFade);
        }
      }

      const teleA = t < T_ERUPT ? smooth(0, 0.10, t) : 1 - smooth(1.85, T_END - 0.12, t);
      if (teleA > 0.02) {
        const w = 23 * smooth(0, 0.25, t);
        p.line(TX - w, 0, TX + w, 0, Sh[0], teleA);
        p.line(TX - w * 0.85, 1, TX + w * 0.85, 1, Sh[3], teleA * 0.92);
        p.glow(TX, -8, 42, Sh[4], (t < T_ERUPT ? 0.52 : 0.24) * teleA);
      }

      // Billowing purple-black smoke with stronger violet backlit rim so black smoke pops against dark sky
      puffs.draw(p, PK.SOOT, { x: TX, y: -16, k: t < T_ERUPT + 0.7 ? 0.82 : 0.22, reach: 72 });

      // Two short jagged splinter-fangs flanking the base behind target
      if (t >= T_ERUPT) {
        const sinkK = smooth(T_SHATTER + 0.2, T_END - 0.25, t);
        const a = 1 - smooth(T_SHATTER + 0.35, T_END - 0.1, t);
        if (a > 0.02) {
          const g = spikeGrown();
          drawDeadwoodSpike(p, TX - 11, sinkK * 12, 29 * Math.min(1.05, g), 8.5, -6, -3, W, Sh, seed + 1, { white: t - T_ERUPT < 0.035, floor: 0, a });
          drawDeadwoodSpike(p, TX + 12, sinkK * 12, 24 * Math.min(1.05, g), 7.5, 7, 3, W, Sh, seed + 2, { white: t - T_ERUPT < 0.035, floor: 0, a });
        }
      }
      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;

      // 0.00..0.50s: Wider trembling dark soil mound heaving violently under target TX
      if (t < T_ERUPT + 0.03) {
        const k = smooth(0.03, T_ERUPT, t), hm = 9.5 * k, jx = Math.sin(t * 98) * 1.1 * k;
        if (hm > 0.6) {
          p.shade(TX - 22, -hm - 1, TX + 22, 1, (x, y, out) => {
            const dx = (x - (TX + jx)) / 20, dy = y / hm, d = dx * dx + dy * dy;
            if (y > 0.5 || d > 1.15) return;
            out.c = d > 1 ? Sh[0] : dy < -0.68 ? S[6] : dx < -0.25 ? S[5] : Sh[2];
          });
        }
      }

      // 0.50s+: Uplifted soil slabs & Colossal Gnarled Deadwood Shadow Spike
      if (t >= T_ERUPT) {
        const sinkK = smooth(T_SHATTER + 0.2, T_END - 0.25, t);
        const aSpike = 1 - smooth(T_SHATTER + 0.35, T_END - 0.12, t);
        if (aSpike > 0.02) {
          for (const sl of slabs) {
            const g = ease.outBack(clamp((t - T_ERUPT) / 0.1), 2);
            drawRock(p, sl.x, -1 + sinkK * 6, sl.s * Math.min(1, g), sl.a * g, sl.pts, S, aSpike, t - T_ERUPT < 0.04);
          }
          const h = mainH * spikeGrown();
          const clip = t < T_SHATTER ? 1 : lerp(1, 0.15, ease.inQuad(clamp((t - T_SHATTER) / 0.5)));
          drawDeadwoodSpike(p, TX, sinkK * 14, h, 23, 5, 4, W, Sh, seed, { white: t - T_ERUPT < 0.04, clip, floor: 0, a: aSpike, barbs: true });
        }
      }

      // 0.51s+: Shadow-Wood Impact Shockwave & Piercing Flare (cohesive purple-black shadow + dry dust crescents)
      const q = t - T_IMPALE;
      if (q >= 0 && q < 0.38) {
        const u = q / 0.38;
        const sc = q < 0.05 ? 0.85 + (q / 0.05) * 0.42 : 1.27 * (1 - (q - 0.05) / 0.33);
        const col = q < 0.04 ? [Sh[3], Sh[5], Sh[6], WHITE] : [Sh[1], Sh[3], Sh[4], Sh[6]];
        if (sc > 0.08) star(p, TX, -28, hitSpikes, sc, Math.max(0.25, 1 - u * 0.85), col, 1 - smooth(0.18, 0.38, q), 2.4);
        brokenRing(p, TX, -28, 10 + 36 * ease.outCubic(u), 2.4 * (1 - u), ringSegs, u * 0.85, Sh[5], Sh[2], 1 - u, 0.82, 0);
        frontCrescent(p, TX + 16 + 18 * u, 1, 16 * (1 - u), 6 * (1 - u), [Sh[5], Sh[3], Sh[1]], 1 - u);
        frontCrescent(p, TX - 16 - 18 * u, -1, 16 * (1 - u), 6 * (1 - u), [Sh[5], Sh[3], Sh[1]], 1 - u);
      }

      for (const b of bits.list) drawRock(p, b.x, b.y, b.s, b.a, b.pts, S, Math.min(1, b.life / 0.35));
      for (const s of splinters.list) drawSplinter(p, s, W, Sh);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
