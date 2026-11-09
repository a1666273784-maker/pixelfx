// Coldflame fireball attack ("moves/coldflame-fireball"):
// 1. Origin Crimson Ignition (0.00..0.28s): Blood-crimson omen light flares at the caster's palm with inward
//    crimson streaks and a warm red ground pool, breaking in a red-to-cold temperature inversion on release.
// 2. S-Curve Swaying Flight & Falling White Sparks (0.28..0.92s): A corpse-pale white fireball rimmed with
//    vivid ghostly-blue fire weaves forward in a full sinusoidal S-wave, trailing twisting cold ribbons and
//    scalloped wisps while crisp pure-white sparks drift visibly downward below the curve.
// 3. Oppressive Shatter, Rising Pale Cold Flames & Scattering Blue Flamelets (0.92..2.95s): Arena light
//    tightens around impact as the fireball explodes violently across the enemy—erupting into surging
//    sinuous corpse-pale cold flames and 26 outward-scattering ghostly-blue flamelets.

import { Particles, Lights, P, Rng, fit, flare, sparkle, clamp, smooth, lerp, ease, rand, mix, hex, TAU, WHITE, READY } from "../../core/index.js";
import { star, brokenRing, makeCracks, drawCracks, frontCrescent } from "../impacts/_lib.js";
import { unlight } from "../shadow/_lib.js";
import { floorLight } from "../fire/_lib.js";

const TX = 198;
const MX = 20, MY = -26;
const T_LAUNCH = 0.28;
const T_HIT = 0.90;
const T_END = 2.95;

export const meta = {
  name: "Coldflame fireball",
  desc: "Crimson light ignites at the caster, firing a ghostly-blue rimmed pale fireball in an S-wave dropping white sparks, erupting into rising pale cold flames and blue flamelets.",
  tags: ["move", "fire", "cold", "ghost", "spirit", "fireball", "projectile", "one-shot"],
  size: [416, 216],
  origin: [84, 168],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    // 9-step ghostly cobalt-blue -> eerie cyan -> corpse-pale cold flame ramp (dark to bright)
    palette: ["#040818", "#0a205c", "#1246a6", "#1c74e0", "#38b0f8", "#7ae0ff", "#c4e9f8", "#e8f3f9", "#ffffff"],
    crimson: ["#180206", "#560612", "#a2101e", "#e62432", "#ff6058", "#ffd4ce"],
    seed: 17,
  },
};

// Caster choreography: guard -> deep crimson gather coil -> crisp palm-thrust release -> hold -> recover
const GUARD = { ...READY, x: 0, crouch: 3, lean: 1, fx: 11, fy: -21, bx: 9, by: -21, ffx: 8, fbx: -8 };
const COIL = { ...READY, x: -5, crouch: 6, lean: -4, turn: 0.82, fx: -7, fy: -25, bx: 10, by: -22, armsFront: true, ffx: 6, fbx: -9 };
const CAST = { ...READY, x: 9, crouch: 4, lean: 6, turn: 0.44, fx: 20, fy: -26, bx: -5, by: -23, ffx: 13, fbx: -9, toeB: true, ghost: 1 };
const FOLLOW = { ...CAST, x: 10, crouch: 5, lean: 4, fx: 20, fy: -24, bx: -5, by: -22, ghost: 0 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.28, GUARD],
    [-0.04, COIL],
    [T_LAUNCH - 0.04, { ...COIL, crouch: 7, lean: -5 }],
    [T_LAUNCH, CAST, "snap"],
    [T_LAUNCH + 0.16, FOLLOW],
    [T_HIT + 0.28, { ...FOLLOW, lean: 2, fx: 16, fy: -22 }],
    [1.68, { ...GUARD, x: 4, crouch: 4 }],
    [2.18, GUARD],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_LAUNCH + 0.008, stop: 0.03, shake: 0.12, amp: 1.8, target: false },
    { t: T_HIT + 0.008, stop: 0.19, shake: 0.50, amp: 5.0, push: 5.4, slide: 28, straw: 44, y: -25, skin: "char", shiver: 0.18, flash: 0.06 },
    { t: T_HIT + 0.15, stop: 0, shake: 0.16, amp: 1.8, push: 0.8, straw: 0, skin: "ice", shiver: 1.6, flash: 0, daze: 1.3 },
    { t: T_END - 0.35, push: 0, straw: 0, flash: 0, skin: null, daze: 0 },
  ],
  dust: [
    { t: T_LAUNCH + 0.008, x: 12, n: 6, dir: 1 },
    { t: T_HIT + 0.008, x: TX + 6, n: 10, dir: 1 },
  ],
};

const X_MIN = -78, X_MAX = 326, Y_MIN = -162, Y_MAX = 40;

// Prebaked scalloped cold-mist puffs for wake & explosion billows
const BILLOW_LUTS = Array.from({ length: 19 }, (_, r) => {
  if (r < 2) return [];
  const pts = [];
  for (let dy = -r - 2; dy <= r + 2; dy++) {
    for (let dx = -r - 2; dx <= r + 2; dx++) {
      const a = Math.atan2(dy, dx);
      const sc = 0.86 + 0.16 * Math.sin(a * 5 + r * 0.88) + 0.09 * Math.cos(a * 8 - r * 0.62);
      const q = Math.hypot(dx, dy) / (r * sc);
      if (q > 1) continue;
      pts.push(dx, dy, q, (-dx * 0.25 + dy * 0.35) / Math.max(1, r) + (1 - q) * 0.62);
    }
  }
  return pts;
});

function drawScallopColdPuff(p, cx, cy, r, u, C, alpha) {
  const ri = clamp(Math.round(r), 2, 18), pts = BILLOW_LUTS[ri];
  if (!pts.length || alpha <= 0.03) return;
  const rx = Math.round(cx), ry = Math.round(cy);
  const fade = 1 - smooth(0.46, 1, u);
  for (let i = 0; i < pts.length; i += 4) {
    const px = rx + pts[i], py = ry + pts[i + 1];
    if (px < X_MIN + 2 || px > X_MAX - 2 || py < Y_MIN + 2 || py > -1) continue;
    const q = pts[i + 2], lit = pts[i + 3];
    if (u > 0.58 && rand(px, py, ri + Math.floor(u * 10)) < (u - 0.58) * 2.2) continue;
    let col;
    if (q > 0.82) col = C[1];
    else if (q > 0.62) col = C[3];
    else if (u < 0.35) col = lit > 0.52 ? C[7] : C[5];
    else col = lit > 0.45 ? C[6] : C[3];
    p.dot(px, py, col, alpha * fade * 0.90);
  }
}

// Sinuous Pale Cold-Flame Tongue ("苍白冷焰"):
// Broad organic corpse-pale body (#ffffff / #e8f3f9 / #c4e9f8) fringed by a thin ghostly-blue rim so it reads unmistakably PALE WHITE!
function drawPaleColdTongue(p, x, y, h, w, lean, t, seed, C, PALE_CORPSE, isBack, alpha) {
  if (h < 1.5 || alpha <= 0.03) return;
  const rimCol = isBack ? C[2] : C[3];
  const haloCol = isBack ? C[4] : C[5];
  const bodyCol = isBack ? PALE_CORPSE[1] : PALE_CORPSE[2];
  const coreCol = isBack ? PALE_CORPSE[2] : WHITE;
  const rows = Math.ceil(h);
  for (let r = 0; r <= rows; r++) {
    const u = r / Math.max(1, h);
    // Sinuous flame belly + lively curling whip at upper half
    const swell = Math.min(1, (r + 2.5) / 4.2) * (1 + 0.20 * Math.sin(u * Math.PI * 1.45));
    const wave = (Math.sin(r * 0.20 - t * 14.5 + seed) * 2.9 + Math.sin(r * 0.09 - t * 7.5 + seed * 0.6) * 3.4) * Math.pow(u, 1.35);
    const jit = Math.sin(r * 0.56 - t * 19 + seed * 1.4) * 0.65 * u;
    const half = w * swell * Math.pow(Math.max(0, 1 - u), 0.68) + jit;
    if (half < 0.38) continue;
    const cx = x + lean * u * u + wave;
    const py = Math.round(y - r);
    if (py < Y_MIN + 2 || py > 1) continue;
    for (let px = Math.round(cx - half), x1 = Math.round(cx + half); px <= x1; px++) {
      if (px < X_MIN + 2 || px > X_MAX - 2) continue;
      const q = Math.abs(px - cx) / Math.max(0.5, half);
      let col;
      if (q > 0.85 || u > 0.91) col = rimCol;
      else if (q > 0.72 || u > 0.80) col = haloCol;
      else if (u < 0.72 && q < 0.50) col = coreCol;
      else col = bodyCol;
      p.dot(px, py, col, alpha);
    }
  }
}

// Ghostly-Blue Flamelet ("幽蓝火苗"):
// Vivid deep-cobalt to electric cyan-blue dancing flamelet (distinctly GHOSTLY BLUE contrast vs central pale flames!)
function drawBlueFlamelet(p, x, y, h, w, lean, t, seed, C, alpha) {
  if (h < 1.5 || alpha <= 0.03) return;
  const rows = Math.ceil(h);
  for (let r = 0; r <= rows; r++) {
    const u = r / Math.max(1, h);
    const wave = Math.sin(r * 0.34 - t * 18 + seed) * 1.8 * u;
    const half = w * Math.pow(Math.max(0, 1 - u), 0.74) * Math.min(1, (r + 1.8) / 3.2);
    if (half < 0.34) continue;
    const cx = x + lean * u * u + wave;
    const py = Math.round(y - r);
    if (py < Y_MIN + 2 || py > 1) continue;
    for (let px = Math.round(cx - half), x1 = Math.round(cx + half); px <= x1; px++) {
      if (px < X_MIN + 2 || px > X_MAX - 2) continue;
      const q = Math.abs(px - cx) / Math.max(0.5, half);
      // Saturated ghostly cobalt -> vivid ghostly blue -> cyan-blue heart (NO flat chalk fill!)
      const col = q > 0.72 || u > 0.80 ? C[1] : q > 0.38 ? C[3] : u < 0.48 ? C[5] : C[4];
      p.dot(px, py, col, alpha);
    }
  }
}

// Ghostly-blue rimmed pale-white flame blade peeling back off the fireball head along the S-tangent
function drawRimBlade(p, x, y, ux, uy, len, w, bend, t, seed, C, PALE_CORPSE, alpha) {
  if (len < 1.5 || alpha <= 0.03) return;
  const nx = -uy, ny = ux;
  for (let r = 0; r <= len; r += 0.6) {
    const u = r / len;
    const half = w * Math.pow(Math.max(0, 1 - u), 0.78) * Math.min(1, (r + 1.4) / 3.2) + Math.sin(r * 0.5 - t * 20 + seed) * 0.45;
    if (half < 0.3) continue;
    const off = bend * u * u + Math.sin(r * 0.25 - t * 16 + seed) * 1.4 * u;
    const cx = x + ux * r + nx * off, cy = y + uy * r + ny * off;
    for (let q = -half; q <= half; q += 0.6) {
      const v = Math.abs(q) / Math.max(0.5, half);
      const px = cx + nx * q, py = cy + ny * q;
      if (px < X_MIN + 2 || px > X_MAX - 2 || py < Y_MIN + 2 || py > 2) continue;
      const col = v > 0.70 || u > 0.78 ? C[2] : v > 0.44 ? C[4] : u < 0.45 ? PALE_CORPSE[2] : C[5];
      p.dot(px, py, col, alpha);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 9), Cr = fit(o.crimson, 6);
  const PALE_CORPSE = [hex("#b6d6ea"), hex("#d8ebf6"), hex("#f0f7fb")];
  const R = new Rng(o.seed), seed = o.seed * 37, floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, PALE_CORPSE[2], C[4], C[2]], haze: C[3] });
  const lights = new Lights();

  // Sweeping S-curve flight path across the lane
  const ballPos = (tt) => {
    const u = clamp((tt - T_LAUNCH) / (T_HIT - T_LAUNCH));
    const prog = 0.22 * u + 0.78 * Math.pow(u, 1.06);
    const x = lerp(MX + 4, TX - 4, prog);
    const env = Math.sin(Math.PI * Math.pow(u, 0.72));
    const y = lerp(MY, -26, u) - Math.sin(u * Math.PI * 2.5) * 18.0 * env;
    return [x, y, u];
  };

  const trail = [];
  const wakePuffs = [];
  const whiteSparks = [];
  const blueFlamelets = [];

  // 10 Sinuous Pale Cold-Flame Plumes surging upward from the struck target (broader organic tongues)
  const palePlumes = Array.from({ length: 10 }, (_, i) => {
    const off = i - 4.5;
    const dist = Math.abs(off);
    return {
      dx: off * 5.0 + R.range(-1.8, 1.8),
      yOff: -Math.max(0, 2 - dist * 0.4),
      hMax: dist <= 1.2 ? R.range(76, 92) : dist <= 2.8 ? R.range(54, 70) : R.range(34, 48),
      w0: dist <= 1.2 ? R.range(6.4, 7.8) : dist <= 2.8 ? R.range(4.6, 5.8) : R.range(3.2, 4.2),
      lean: off * 2.4 + R.range(-2.6, 2.6),
      t0: T_HIT + dist * 0.010,
      life: R.range(1.24, 1.74),
      back: i % 2 === 1,
      s: seed + i * 29,
    };
  });

  // Rising pale-white detached flame curls lifting off the burning plume tips
  const paleWisps = Array.from({ length: 12 }, (_, i) => ({
    x0: TX + 4 + R.range(-18, 18),
    y0: -R.range(38, 68),
    vx: R.range(-16, 16),
    vy: -R.range(26, 56),
    r: R.range(2.2, 3.6),
    t0: T_HIT + 0.08 + i * 0.065,
    life: R.range(0.55, 0.95),
    ph: R.range(0, TAU),
  }));

  // Scalloped cold-blast puffs billowing outward on impact
  const impactPuffs = Array.from({ length: 14 }, (_, i) => {
    const u = i / 13;
    const a = R.range(-Math.PI * 0.92, -0.08);
    const sp = R.range(38, 102);
    return {
      x0: TX + 4 + R.range(-10, 10),
      y0: -18 - u * 26,
      vx: Math.cos(a) * sp * 0.9 + 10,
      vy: Math.sin(a) * sp * 0.85,
      r0: lerp(10.5, 7, u),
      r1: lerp(16, 10.5, u),
      t0: T_HIT + u * 0.04,
      life: R.range(0.46, 0.82),
    };
  });

  // Ground frost-scorch cracks at the target's feet
  const hitCracks = makeCracks(R, 10, { len: [16, 52], dive: 0.42, maxY: 9, forks: 0.5 }).map((c) => ({
    ...c,
    pts: c.pts.map(([x, y, d]) => [clamp(x + TX + 4, X_MIN + 4, X_MAX - 4), clamp(y, 0.5, 10), d]),
    kids: c.kids.map((k) => k.map(([x, y, d]) => [clamp(x + TX + 4, X_MIN + 4, X_MAX - 4), clamp(y, 0.5, 10), d])),
  }));

  // Asymmetric forward-driving impact star spikes (attenuated downward so zero pixels escape Y_MAX)
  const hitSpikes = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * TAU + R.range(-0.08, 0.08);
    const sa = Math.sin(a);
    const downClamp = sa > 0.25 ? 1 - 0.55 * sa : 1;
    const fwd = Math.cos(a) > 0 ? 1.18 : 0.92;
    return {
      a,
      len: R.range(24, 44) * (i % 2 === 0 ? 1.42 : 0.72) * fwd * downClamp,
      w: R.range(2.2, 3.6),
    };
  });
  const ringSegs = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * TAU, gap: R.range(0.45, 0.72), dr: R.range(0.15, 0.42), w: 1.15 }));

  let t = 0, ignited = false, launched = false, hitDone = false, acc = 0, nextSparkT = T_LAUNCH + 0.012, nextWakeT = T_LAUNCH + 0.02;

  return {
    update(dt) {
      t += dt;

      // 1. Origin Crimson Light ("起点亮起红光")
      if (!ignited) {
        ignited = true;
        lights.add(MX, MY, 46, Cr[3], 0.95, T_LAUNCH + 0.08);
      }
      if (t < T_LAUNCH) {
        for (acc += dt * 84; acc >= 1; acc -= 1) {
          const a = R.range(0, TAU), d = R.range(14, 34);
          ps.spawn(P.STREAK, MX - 4 + Math.cos(a) * d, MY + Math.sin(a) * d, -Math.cos(a) * 165, -Math.sin(a) * 165, 0.13, R.pick([Cr[4], Cr[3], Cr[5]]));
        }
      }

      // 2. Crimson -> Coldflame Release Transition (NO wireframe ring, pure flame burst & dying crimson sparks)
      if (!launched && t >= T_LAUNCH) {
        launched = true;
        lights.add(MX + 4, MY, 54, Cr[4], 0.88, 0.18);
        lights.add(MX + 10, MY, 42, C[3], 0.68, 0.22);
        for (let i = 0; i < 16; i++) {
          const a = R.range(-1.6, 1.6), sp = R.range(42, 145);
          ps.spawn(P.SPARK, MX + 2, MY, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.16, 0.34), i % 3 === 0 ? C[4] : Cr[4]);
        }
      }

      // 3. S-Curve Flight: wake puffs + trail + falling pure-white sparks ("沿途飘落白色火星")
      if (t >= T_LAUNCH && t < T_HIT) {
        const [bx, by] = ballPos(t);
        trail.unshift([bx, by]);
        if (trail.length > 26) trail.pop();

        while (t >= nextWakeT && nextWakeT < T_HIT - 0.01) {
          const [wx, wy] = ballPos(nextWakeT);
          wakePuffs.push({
            x: wx - R.range(2, 7),
            y: wy + R.range(-3.0, 3.0),
            vx: -R.range(18, 40),
            vy: -R.range(6, 20),
            r0: R.range(3.5, 5.2),
            r1: R.range(5.0, 7.6),
            age: 0,
            life: R.range(0.22, 0.38),
          });
          nextWakeT += R.range(0.024, 0.038);
        }

        while (t >= nextSparkT && nextSparkT < T_HIT - 0.01) {
          const [sx, sy] = ballPos(nextSparkT);
          const cnt = R.chance(0.70) ? 2 : 1;
          for (let k = 0; k < cnt; k++) {
            whiteSparks.push({
              x: sx - R.range(1, 12) + k * R.range(-4, 4),
              y: sy + R.range(1, 8),
              vx: R.range(-18, 16),
              vy: R.range(26, 52),
              g: R.range(54, 94),
              drag: R.range(1.4, 2.4),
              sway: R.range(14, 26),
              ph: R.range(0, TAU),
              cross: R.chance(0.58),
              age: 0,
              life: R.range(0.75, 1.25),
            });
          }
          nextSparkT += R.range(0.012, 0.019);
        }
      }

      // 4. Target Impact: explodes violently on contact frame so hit-stop captures full blast!
      if (!hitDone && t >= T_HIT) {
        hitDone = true;
        lights.add(TX + 4, -26, 78, C[3], 1.05, 0.68);
        lights.add(TX + 4, -26, 46, WHITE, 0.94, 0.12);
        lights.add(TX + 4, -6, 56, C[2], 0.85, 0.90);

        for (let i = 0; i < 56; i++) {
          const a = R.range(0, TAU), sp = R.range(105, 320);
          ps.spawn(P.SPARK, TX + 2, -26, Math.cos(a) * sp + 18, Math.sin(a) * sp - 26, R.range(0.20, 0.56), R.pick([WHITE, PALE_CORPSE[2], C[4], C[3]]));
        }

        // 26 Ghostly-Blue Flamelets ("四散的幽蓝火苗") — pre-stepped 16px outward at T_HIT so hit-stop hero frame bursts!
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * TAU + R.range(-0.10, 0.10);
          const sp = i % 3 === 0 ? R.range(155, 250) : R.range(78, 148);
          const rStart = R.range(10, 18);
          blueFlamelets.push({
            x: TX + 4 + Math.cos(a) * rStart,
            y: Math.min(-2, -26 + Math.sin(a) * rStart),
            vx: Math.cos(a) * sp + 18,
            vy: Math.sin(a) * sp * 0.88 - 28,
            g: R.range(135, 225),
            drag: R.range(1.5, 2.6),
            h0: R.range(10, 18),
            w0: R.range(2.6, 4.0),
            bounce: R.range(0.36, 0.54),
            age: 0,
            life: R.range(0.88, 1.50),
            s: seed + 400 + i * 19,
          });
        }
      }

      for (let i = wakePuffs.length - 1; i >= 0; i--) {
        const w = wakePuffs[i];
        w.age += dt;
        if (w.age >= w.life) { wakePuffs.splice(i, 1); continue; }
        w.x += w.vx * dt;
        w.y += w.vy * dt;
      }

      for (let i = whiteSparks.length - 1; i >= 0; i--) {
        const sp = whiteSparks[i];
        sp.age += dt;
        if (sp.age >= sp.life || t >= T_END - 0.05) { whiteSparks.splice(i, 1); continue; }
        sp.vx = (sp.vx * (1 - sp.drag * dt)) + Math.sin(t * 14 + sp.ph) * sp.sway * dt;
        sp.vy = sp.vy * (1 - 0.85 * dt) + sp.g * dt;
        sp.x = clamp(sp.x + sp.vx * dt, X_MIN + 4, X_MAX - 4);
        sp.y += sp.vy * dt;
        if (sp.y >= 0) { sp.y = 0; sp.vx *= 0.4; sp.vy = 0; }
      }

      for (let i = blueFlamelets.length - 1; i >= 0; i--) {
        const bf = blueFlamelets[i];
        bf.age += dt;
        if (bf.age >= bf.life || t >= T_END - 0.05) { blueFlamelets.splice(i, 1); continue; }
        const dec = Math.exp(-bf.drag * dt);
        bf.vx *= dec;
        bf.vy = bf.vy * dec + bf.g * dt;
        bf.x = clamp(bf.x + bf.vx * dt, X_MIN + 6, X_MAX - 6);
        bf.y += bf.vy * dt;
        if (bf.y >= 0) {
          bf.y = 0;
          bf.vy = -Math.abs(bf.vy) * bf.bounce;
          bf.vx *= 0.65;
        }
      }

      for (const q of ps.list) {
        q.x = clamp(q.x, X_MIN + 3, X_MAX - 3);
        q.y = clamp(q.y, Y_MIN + 3, -0.5);
        if (t + q.life > T_END - 0.06) q.life = Math.max(0.02, T_END - 0.06 - t);
      }
      ps.update(dt);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-4) return;
      const endFade = 1 - smooth(T_END - 0.45, T_END - 0.04, t);

      if (t < 0.72) {
        const k = t < T_LAUNCH ? smooth(0, 0.12, t) : 1 - smooth(T_LAUNCH, 0.72, t);
        floorLight(p, MX, 0.5, 32 * k, 5.5, Cr[3], 0.52 * k * endFade);
      }

      if (t >= T_HIT) {
        const ageH = t - T_HIT;
        // Arena-dimming shadow pressure ring tightening around struck target (oppressive impact!)
        const pressK = smooth(0, 0.015, ageH + 0.02) * (1 - smooth(0.62, 1.25, ageH));
        if (pressK > 0.03) {
          unlight(p, TX - 82, -108, TX + 96, 8, (x, y) => {
            const d = Math.hypot((x - (TX + 6)) / 84, (y + 32) / 68);
            return d > 0.52 && d < 1;
          }, 1 - 0.78 * pressK);
        }

        const crK = (1 - smooth(1.00, 1.65, ageH)) * endFade;
        if (crK > 0.02) {
          drawCracks(p, hitCracks, (c) => c.len * ease.outCubic(clamp((ageH - c.t0 + 0.04) / 0.14)), (d) => clamp(1 - ageH / 1.15 - d * 0.008, 0, 1), [WHITE, C[5], C[3], C[1]], C[0], C[2], crK * 0.88);
        }

        const poolK = (1 - smooth(1.05, 1.48, ageH)) * endFade;
        if (poolK > 0.02) {
          p.ellipse(TX + 4, 0.5, 36 * ease.outCubic(clamp((ageH + 0.04) / 0.18)), 3.5, (d) => (d < 0.42 ? C[1] : d < 0.78 ? C[2] : C[3]), 0.86 * poolK);
          floorLight(p, TX + 4, 0.5, 52, 7.5, C[3], 0.44 * poolK);
        }

        const uR = (ageH + 0.02) / 0.44;
        if (uR < 1) {
          const rr = 16 + 68 * ease.outQuart(uR);
          for (let i = 0; i < 40; i++) {
            const th = Math.PI + (i / 39) * Math.PI;
            const px = TX + 4 + Math.cos(th) * rr, py = Math.sin(th) * rr * 0.18;
            if (px >= X_MIN + 4 && px <= X_MAX - 4) p.dot(px, py, uR < 0.25 ? C[5] : C[3], (1 - uR) * endFade * 0.85);
          }
        }

        for (const ip of impactPuffs) {
          const bAge = t - ip.t0;
          if (bAge < 0 || bAge >= ip.life) continue;
          const u = bAge / ip.life;
          const fx = clamp(ip.x0 + ip.vx * (1 - Math.exp(-3.0 * bAge)) / 3.0, X_MIN + 14, X_MAX - 14);
          const fy = clamp(ip.y0 + ip.vy * (1 - Math.exp(-2.8 * bAge)) / 2.8, Y_MIN + 14, -4);
          drawScallopColdPuff(p, fx, fy, lerp(ip.r0, ip.r1, ease.outCubic(u)), u, C, endFade * 0.88);
        }

        for (const pl of palePlumes) {
          if (!pl.back) continue;
          const pAge = t - pl.t0;
          if (pAge < 0 || pAge >= pl.life) continue;
          const u = pAge / pl.life;
          const rise = 0.36 + 0.64 * ease.outCubic(clamp(u / 0.20));
          const fh = pl.hMax * rise * (1 - smooth(0.44, 1, u));
          drawPaleColdTongue(p, TX + 4 + pl.dx, pl.yOff, fh, pl.w0 * (1 - u * 0.42), pl.lean, t, pl.s, C, PALE_CORPSE, true, endFade);
        }
      }
      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-4) return;
      const endFade = 1 - smooth(T_END - 0.45, T_END - 0.04, t);

      // ==== 1. ORIGIN CRIMSON IGNITION ("起点亮起红光") ====
      if (t < T_LAUNCH + 0.22) {
        const crK = t < T_LAUNCH ? ease.outCubic(clamp(t / 0.15)) : 1 - (t - T_LAUNCH) / 0.22;
        const rPulse = 8.5 + 2.5 * Math.sin(t * 28);
        p.circle(MX - 2, MY, rPulse * crK, Cr[2], crK * 0.9);
        p.circle(MX - 2, MY, rPulse * 0.62 * crK, Cr[4], crK);
        p.circle(MX - 2, MY, rPulse * 0.28 * crK, Cr[5], crK);
        flare(p, MX - 2, MY, 26 * crK, crK, [Cr[2], Cr[3], Cr[4], Cr[5]]);
        p.glow(MX - 2, MY, 38 * crK, Cr[3], 0.85 * crK);
        p.glow(MX - 2, MY, 16 * crK, Cr[4], 0.65 * crK);
      }

      // ==== 2. S-CURVE CORPSE-PALE FIREBALL WITH GHOSTLY-BLUE OUTER RIM ====
      if (t >= T_LAUNCH && t < T_HIT + 0.16) {
        const ft = t < T_HIT ? 1 : 1 - (t - T_HIT) / 0.16;

        for (const wp of wakePuffs) {
          const u = wp.age / wp.life;
          drawScallopColdPuff(p, wp.x, wp.y, lerp(wp.r0, wp.r1, ease.outCubic(u)), u, C, ft * 0.78);
        }

        // Smooth S-curve flame ribbon (corpse-pale core wrapped in ghostly blue edge!)
        for (let i = 0; i < trail.length - 1; i++) {
          const [x0, y0] = trail[i], [x1, y1] = trail[i + 1];
          const u = i / Math.max(1, trail.length - 1);
          const L = Math.hypot(x1 - x0, y1 - y0) || 1;
          const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
          const w = 6.8 * Math.pow(1 - u, 0.72) + 0.6;
          for (let d = 0; d < L; d += 0.8) {
            const x = lerp(x0, x1, d / L), y = lerp(y0, y1, d / L);
            for (let q = -w; q <= w; q += 0.8) {
              const v = Math.abs(q) / w;
              const col = v < 0.45 ? (u < 0.35 ? PALE_CORPSE[2] : PALE_CORPSE[1]) : v < 0.75 ? C[4] : C[2];
              p.dot(x + nx * q, y + ny * q, col, (1 - u * 0.90) * ft * (v > 0.75 ? 0.68 : 0.94));
            }
          }
          const ox = Math.sin(u * 13 - t * 28) * (w + 1.8);
          p.dot(x0 + nx * ox, y0 + ny * ox, C[4], (1 - u) * ft * 0.90);
          p.dot(x0 - nx * ox, y0 - ny * ox, C[3], (1 - u) * ft * 0.82);
          if (i % 4 === 0) p.glow(x0, y0, 11 * (1 - u), C[3], 0.28 * (1 - u) * ft);
        }

        if (t < T_HIT) {
          const [bx, by] = ballPos(t);
          const next = ballPos(Math.min(T_HIT, t + 0.02));
          const vx = next[0] - bx, vy = next[1] - by, vl = Math.hypot(vx, vy) || 1;
          const ux = -vx / vl, uy = -vy / vl;

          // Ghostly-blue rimmed flame blades peeling off the pale head
          for (const [len, hw, angOff] of [[24, 5.4, 0], [18, 4.2, -0.32], [18, 4.2, 0.32]]) {
            const ca = Math.cos(angOff), sa = Math.sin(angOff);
            drawRimBlade(p, bx, by, ux * ca - uy * sa, ux * sa + uy * ca, len, hw, Math.sin(t * 22 + angOff * 4) * 3.2, t, seed + angOff * 13, C, PALE_CORPSE, 1);
          }

          // Broad CORPSE-PALE WHITE body (76% area) wrapped in fierce directional GHOSTLY-BLUE corona rim!
          const R0 = 9.8 + 0.9 * Math.sin(t * 25);
          const fx = -ux, fy = -uy;
          p.shade(Math.floor(bx - R0 - 6), Math.floor(by - R0 - 6), Math.ceil(bx + R0 + 6), Math.ceil(by + R0 + 6), (x, y, out) => {
            const dx = x - bx, dy = y - by;
            const along = dx * fx + dy * fy;
            const side = -dx * fy + dy * fx;
            // Tight bullet nose forward (along > 0), stretched turbulent flame crest backward (along < 0)
            const d = Math.hypot(along < 0 ? along * 0.80 : along * 1.06, side);
            const th = Math.atan2(side, along);
            const wakeRough = along < 0 ? 1.35 : 0.45;
            const turb = (0.75 * Math.sin(th * 3 - t * 29) + 0.55 * Math.cos(th * 7 + t * 23)) * wakeRough;
            const rim = R0 + turb;
            if (d > rim + 1.8) return;
            out.a = 1;
            if (d > rim - 0.3) return C[1];
            if (d > rim - 1.3) return C[2];
            if (d > rim - 2.3) return C[4];
            if (d > R0 * 0.58) return PALE_CORPSE[2];
            return WHITE;
          });
          // Ghostly-blue outer aura halo (stays outside pale core so pale ball vs blue rim contrast stays crisp!)
          p.glow(bx, by, 38, C[2], 0.56);
          p.glow(bx, by, 20, C[3], 0.34);
        }
      }

      // ==== 3. FALLING PURE-WHITE SPARKS ALONG S-CURVE ("沿途飘落白色火星") ====
      for (const sp of whiteSparks) {
        const u = sp.age / sp.life;
        const fade = (1 - smooth(0.55, 1, u)) * endFade;
        if (fade <= 0.05) continue;
        const tw = 0.72 + 0.28 * Math.sin(t * 28 + sp.ph);
        const rx = Math.round(sp.x), ry = Math.min(0, Math.round(sp.y));
        p.dot(rx, ry, WHITE, fade * tw);
        p.dot(rx, Math.max(Y_MIN + 2, ry - 1), WHITE, fade * 0.85);
        if (sp.cross) {
          p.dot(rx - 1, ry, PALE_CORPSE[2], fade * 0.80);
          p.dot(rx + 1, ry, PALE_CORPSE[2], fade * 0.80);
          p.dot(rx, Math.max(Y_MIN + 2, ry - 2), PALE_CORPSE[1], fade * 0.60);
        }
        p.glow(rx, ry, sp.cross ? 4.5 : 3, C[3], 0.25 * fade * tw);
      }

      // ==== 4. HIT RESULT: VIOLENT SHATTER + RISING PALE COLD FLAMES + SCATTERING BLUE FLAMELETS ====
      if (t >= T_HIT) {
        const ageH = t - T_HIT;
        // Start burst already expanded 28-36% at ageH = 0 so the hit-stop freeze frame delivers maximum punch!
        const uR = (ageH + 0.06) / 0.42;
        if (uR < 1) {
          brokenRing(p, TX + 4, -26, 16 + 64 * ease.outCubic(uR), Math.max(1, 3.8 * (1 - uR)), ringSegs, smooth(0.15, 0.75, uR), uR < 0.28 ? WHITE : C[5], C[3], (1 - uR) * endFade, 1, 0);
          const dist = 18 + 64 * ease.outCubic(uR);
          frontCrescent(p, clamp(TX + 4 + dist, X_MIN + 10, X_MAX - 10), 1, 28 * (1 - uR * 0.55), 8.5 * (1 - uR * 0.55), [WHITE, C[5], C[2]], (1 - uR) * endFade);
          frontCrescent(p, clamp(TX + 4 - dist, X_MIN + 10, X_MAX - 10), -1, 28 * (1 - uR * 0.55), 8.5 * (1 - uR * 0.55), [WHITE, C[5], C[2]], (1 - uR) * endFade);
        }

        // Diagonal icy cold-flame shatter cleave + jagged impact burst (peak scale right on T_HIT freeze frame!)
        if (ageH < 0.28) {
          const uX = ageH / 0.28;
          const kX = (0.72 + 0.28 * ease.outCubic(clamp(uX / 0.12))) * (1 - smooth(0.32, 1, uX));
          for (const [ang, L0, w0] of [[-0.60, 78, 5.2], [0.64, 74, 4.6]]) {
            const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
            const L = L0 * (0.68 + 0.32 * ease.outCubic(clamp(uX / 0.12))), hw = w0 * (1 - uX * 0.55);
            p.poly([[clamp(TX + 4 + ca * L, X_MIN, X_MAX), clamp(-26 + sa * L, Y_MIN, -2)], [clamp(TX + 4 + nx * hw, X_MIN, X_MAX), clamp(-26 + ny * hw, Y_MIN, -2)], [clamp(TX + 4 - ca * L, X_MIN, X_MAX), clamp(-26 - sa * L, Y_MIN, -2)], [clamp(TX + 4 - nx * hw, X_MIN, X_MAX), clamp(-26 - ny * hw, Y_MIN, -2)]], C[2], kX);
            p.poly([[clamp(TX + 4 + ca * L * 0.88, X_MIN, X_MAX), clamp(-26 + sa * L * 0.88, Y_MIN, -2)], [clamp(TX + 4 + nx * hw * 0.52, X_MIN, X_MAX), clamp(-26 + ny * hw * 0.52, Y_MIN, -2)], [clamp(TX + 4 - ca * L * 0.88, X_MIN, X_MAX), clamp(-26 - sa * L * 0.88, Y_MIN, -2)], [clamp(TX + 4 - nx * hw * 0.52, X_MIN, X_MAX), clamp(-26 - ny * hw * 0.52, Y_MIN, -2)]], uX < 0.28 ? WHITE : PALE_CORPSE[2], kX);
          }
        }
        if (ageH < 0.18) {
          const kS = 1 - ageH / 0.18;
          star(p, TX + 4, -26, hitSpikes, ageH < 0.04 ? 1.15 : 0.98, 0.72 + 0.38 * kS, [C[2], C[4], C[6], WHITE], kS, 3.0);
          flare(p, TX + 4, -26, 50 * kS, kS, [C[3], C[4], C[5], WHITE]);
        }

        // Front cluster of rising CORPSE-PALE cold flames ("化作一簇向上升腾的苍白冷焰")
        for (const pl of palePlumes) {
          if (pl.back) continue;
          const pAge = t - pl.t0;
          if (pAge < 0 || pAge >= pl.life) continue;
          const u = pAge / pl.life;
          const rise = 0.38 + 0.62 * ease.outCubic(clamp(u / 0.20));
          const fh = pl.hMax * rise * (1 - smooth(0.44, 1, u));
          drawPaleColdTongue(p, TX + 4 + pl.dx, pl.yOff, fh, pl.w0 * (1 - u * 0.40), pl.lean, t, pl.s, C, PALE_CORPSE, false, endFade);
          if (pAge < 0.85) p.glow(TX + 4 + pl.dx, pl.yOff - fh * 0.42, 12, C[3], 0.16 * (1 - u));
        }

        // Pale detached wisps rising off the cold-flame tips
        for (const pw of paleWisps) {
          const wAge = t - pw.t0;
          if (wAge < 0 || wAge >= pw.life) continue;
          const u = wAge / pw.life;
          const wx = clamp(pw.x0 + pw.vx * wAge + Math.sin(wAge * 7 + pw.ph) * 4, X_MIN + 4, X_MAX - 4);
          const wy = clamp(pw.y0 + pw.vy * wAge, Y_MIN + 4, -2);
          const rr = pw.r * (1 - u * 0.7);
          const fa = (1 - smooth(0.45, 1, u)) * endFade;
          p.circle(wx, wy, rr, PALE_CORPSE[1], fa * 0.85);
          p.dot(wx, wy - 0.5, WHITE, fa * 0.9);
          p.glow(wx, wy, 5, C[3], 0.22 * fa);
        }

        // 26 Scattering VIVID GHOSTLY-BLUE Flamelets ("与四散的幽蓝火苗")
        for (const bf of blueFlamelets) {
          const u = bf.age / bf.life;
          const fade = (1 - smooth(0.48, 1, u)) * endFade;
          if (fade <= 0.04) continue;
          const tilt = clamp(-bf.vx * 0.025, -4, 4);
          drawBlueFlamelet(p, bf.x, Math.min(0, bf.y), bf.h0 * (1 - u * 0.45), bf.w0 * (1 - u * 0.35), tilt, t, bf.s, C, fade);
          p.glow(bf.x, Math.min(0, bf.y) - 4, 11 * (1 - u * 0.4), C[3], 0.52 * fade);
        }
      }

      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
