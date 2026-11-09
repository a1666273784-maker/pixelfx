// Venom spit ranged attack ("moves/venom-spit"): coils and spits a serrated toxic dart to corrode the target,
// then blasts a colossal dark-violet & chartreuse fanged venom maw-glob trailing whipping mucus tentacles and
// sizzling floor drops; impact unleashes a towering acid crown eruption, through-target splash arcs,
// dark-purple scalloped miasma plumes, viscous target-melting drips, and a tar-veined boiling acid crater.
import { Particles, Lights, P, Rng, fit, flare, sparkle, clamp, smooth, lerp, ease, noise, rand, mix, hex, TAU, WHITE, READY } from "../../core/index.js";
import { Drops, bubble } from "../nature/_lib.js";
import { star, brokenRing, makeCracks, drawCracks, frontCrescent } from "../impacts/_lib.js";

const TX = 216;
const MX = 17, MY = -28; // mouth emitter in SPIT poses
const T_SPIT1 = 0.24;
const T_HIT1 = 0.43;
const T_SPIT2 = 0.50;
const T_HIT2 = 0.88;
const T_END = 3.10;

export const meta = {
  name: "Venom spit",
  desc: "Coils and spits a serrated acid fang to poison the target, then blasts a colossal fanged venom orb that erupts in an acid crown, melting drips, and a boiling etched pit.",
  tags: ["move", "poison", "venom", "acid", "spit", "corrosion", "ranged", "boss", "one-shot"],
  size: [408, 204],
  origin: [80, 156],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#0c0614", "#210e36", "#163b14", "#2b7316", "#54b622", "#98ea2c", "#ddff64", "#f6ffd6", "#ffffff"],
    sheen: ["#2a1448", "#642ea0", "#1c7a74", "#7ce8c8"],
    seed: 29,
  },
};

const GUARD = { ...READY, x: 0, crouch: 3, lean: 2, fx: 11, fy: -21, bx: 9, by: -21, ffx: 8, fbx: -8 };
const COIL = { ...READY, x: -4, crouch: 6, lean: -5, hx: -2, hy: -1, fx: 5, fy: -25, bx: 11, by: -23, ffx: 7, fbx: -9 };
const SPIT1 = { ...READY, x: 5, crouch: 4, lean: 5, hx: 2, hy: 1, fx: 3, fy: -22, bx: 15, by: -23, ffx: 10, fbx: -8 };
const COIL2 = { ...READY, x: 2, crouch: 7, lean: -5, hx: -2, hy: -1, fx: 7, fy: -26, bx: 13, by: -24, ffx: 10, fbx: -9 };
const SPIT2 = { ...READY, x: 10, crouch: 4, lean: 8, hx: 3, hy: 1, fx: 3, fy: -21, bx: 18, by: -23, ffx: 13, fbx: -9, toeB: true, ghost: 1 };
const FOLLOW = { ...SPIT2, x: 10, crouch: 5, lean: 6, fx: 5, fy: -20, bx: 17, by: -22, ghost: 0 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.28, GUARD],
    [0.0, COIL],
    [T_SPIT1, SPIT1, "snap"],
    [T_SPIT2 - 0.05, COIL2],
    [T_SPIT2, SPIT2, "snap"],
    [T_SPIT2 + 0.16, FOLLOW],
    [1.35, { ...GUARD, x: 4, crouch: 4 }],
    [1.95, GUARD],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_SPIT1, stop: 0.03, shake: 0.08, amp: 1.2, target: false },
    { t: T_HIT1, stop: 0.06, shake: 0.15, amp: 2.2, push: 1.8, straw: 16, y: -26, skin: "poison", shiver: 0.6 },
    { t: T_SPIT2, stop: 0.04, shake: 0.15, amp: 2.2, target: false },
    { t: T_HIT2, stop: 0.19, shake: 0.48, amp: 5.0, push: 5.4, straw: 46, y: -25, skin: "poison", shiver: 2.0 },
    { t: T_END - 0.38, push: 0, straw: 0, flash: 0, skin: null },
  ],
  dust: [
    { t: T_SPIT1, x: 10, n: 5, dir: 1 },
    { t: T_SPIT2, x: 14, n: 8, dir: 1 },
    { t: T_SPIT2, x: -8, n: 6, dir: -1 },
  ],
};

const X_MIN = -74, X_MAX = 320, Y_MIN = -150;

// Prebaked scalloped dark-violet/chartreuse toxic fume puff LUTs (crisp pixel clouds, never smooth soap-circles)
const FUME_LUTS = Array.from({ length: 18 }, (_, r) => {
  if (r < 2) return [];
  const pts = [];
  for (let dy = -r - 2; dy <= r + 2; dy++) {
    for (let dx = -r - 2; dx <= r + 2; dx++) {
      const a = Math.atan2(dy, dx);
      const scallop = 0.86 + 0.17 * Math.sin(a * 5 + r * 0.85) + 0.09 * Math.cos(a * 8 - r * 0.65);
      const q = Math.hypot(dx, dy) / (r * scallop);
      if (q > 1) continue;
      // Lit from BELOW by the glowing acid crater & target impact
      const bottomLit = (dy * 0.72 - dx * 0.18) / Math.max(1, r) + (1 - q) * 0.4;
      pts.push(dx, dy, q, bottomLit);
    }
  }
  return pts;
});

function drawFumePuff(p, cx, cy, r, u, C, Sh, alpha) {
  const ri = clamp(Math.round(r), 2, 17), pts = FUME_LUTS[ri];
  if (!pts || !pts.length || alpha <= 0.02) return;
  const rx = Math.round(cx), ry = Math.round(cy);
  const fade = 1 - smooth(0.5, 1, u);
  for (let i = 0; i < pts.length; i += 4) {
    const px = rx + pts[i], py = ry + pts[i + 1];
    if (px < X_MIN + 2 || px > X_MAX - 2 || py < Y_MIN + 2 || py > -1) continue;
    const q = pts[i + 2], lit = pts[i + 3];
    if (u > 0.62 && rand(px, py, ri + Math.floor(u * 10)) < (u - 0.62) * 2.4) continue;
    let col;
    if (q > 0.84) col = C[0];
    else if (u < 0.28) col = lit > 0.62 ? C[6] : lit > 0.25 ? C[4] : Sh[1];
    else if (u < 0.6) col = lit > 0.55 ? C[5] : lit > 0.18 ? Sh[1] : C[1];
    else col = lit > 0.42 ? Sh[1] : C[0];
    p.dot(px, py, col, alpha * fade * 0.88);
  }
}

// Curling acid steam wisp
function wisp(p, q, t, col) {
  const age = t - q.t0, u = age / q.life;
  if (u < 0 || u >= 1) return;
  const head = q.rise * age, tail = Math.max(0, head - q.len), fade = smooth(0, 0.15, u) * (1 - smooth(0.45, 1, u));
  for (let h = tail; h <= head; h += 0.6) {
    const s = (h - tail) / Math.max(1, head - tail);
    const x = clamp(q.x + q.amp * Math.sin(h * q.k + q.ph) * (0.2 + s) + q.drift * age, X_MIN + 4, X_MAX - 4);
    const y = clamp(q.y - h, Y_MIN + 4, 2);
    p.blend(x, y, col, fade * Math.sin(Math.PI * s) * 0.52);
  }
}

export function create(o) {
  const C = fit(o.palette, 9), Sh = fit(o.sheen, 4), R = new Rng(o.seed);
  const SCORCH = mix(C[0], hex("#100c14"), 0.55), BURNT = mix(C[1], hex("#1e1824"), 0.55), STEAM = mix(C[7], hex("#e6f2d8"), 0.72);
  const floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[7], C[6], C[4]], haze: C[4] });
  const drops = new Drops(floor), lights = new Lights();

  const stains = [], wisps = [], pops = [];
  const pitW = 58, pitDMax = 7.5;
  const rag = Array.from({ length: 80 }, (_, i) => rand(i, o.seed, 5) - 0.5);

  // Shallow, etched acid floor fissures (maxY: 7 so they eat across the floor crust cleanly without deep neon spikes)
  const hitCracks = makeCracks(R, 12, { len: [16, 62], dive: 0.42, maxY: 7, forks: 0.5 }).map((c) => ({
    ...c,
    pts: c.pts.map(([x, y, d]) => [clamp(x + TX - 4, X_MIN + 4, X_MAX - 4), clamp(y, 0.5, 8), d]),
    kids: c.kids.map((k) => k.map(([x, y, d]) => [clamp(x + TX - 4, X_MIN + 4, X_MAX - 4), clamp(y, 0.5, 8), d])),
  }));
  const hitSpikes = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * TAU + R.range(-0.06, 0.06);
    const down = Math.sin(a) > 0.2 ? 1 - 0.62 * Math.sin(a) : 1;
    return { a, len: R.range(30, 56) * (i % 2 === 0 ? 1.42 : 0.82) * down, w: R.range(2.2, 3.6) };
  });
  const segs = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * TAU, gap: R.range(0.5, 0.85), dr: R.range(0.08, 0.4), w: R.range(0.9, 1.4) }));

  // Thick tapered acid splash crown spikes leaping out around impact
  const crownSpikes = Array.from({ length: 14 }, (_, i) => ({
    a: (i / 14) * TAU + R.range(-0.15, 0.15),
    h: R.range(16, 30),
    w: R.range(1.6, 2.8),
    shed: false,
  }));
  // Dark-violet/chartreuse scalloped miasma billows billowing outward/upward cleanly around the corrosive blast
  const fumePuffs = Array.from({ length: 16 }, (_, i) => {
    const u = i / 15;
    const a = R.range(-Math.PI * 0.9, -0.1);
    const sp = R.range(30, 105) * (1 - u * 0.25);
    return {
      x0: TX - 4 + R.range(-12, 12),
      y0: -14 - u * 26,
      vx: Math.cos(a) * sp * 0.82 + 8,
      vy: Math.sin(a) * sp * 0.72,
      r0: lerp(10, 6, u),
      r1: lerp(15, 10, u),
      t0: T_HIT2 + u * 0.07,
      life: R.range(0.58, 1.05),
    };
  });
  // Viscous corrosive blisters swelling & popping directly across the target body
  const bodyBlisters = Array.from({ length: 10 }, (_, i) => ({
    dx: R.range(-13, 13),
    dy: R.range(-44, -8),
    t0: T_HIT2 + 0.08 + i * 0.1,
    life: R.range(0.45, 0.75),
    r: R.range(2.3, 4.0),
  }));
  // Glossy dark-violet/chartreuse tar bubbles rising and popping across the etched acid crater
  const pitBubbles = Array.from({ length: 10 }, (_, i) => ({
    x: TX - 4 + R.range(-44, 44),
    t0: T_HIT2 + 0.14 + i * 0.16,
    swell: R.range(0.32, 0.52),
    rmax: R.range(3.8, 6.8),
    popped: false,
  }));

  const x1 = (tt) => lerp(MX + 4, TX - 6, ease.outQuad(clamp((tt - T_SPIT1) / (T_HIT1 - T_SPIT1))));
  const x2 = (tt) => {
    const u = clamp((tt - T_SPIT2) / (T_HIT2 - T_SPIT2));
    return lerp(MX + 6, TX - 6, 0.28 * u + 0.72 * Math.pow(u, 1.28));
  };
  const y2 = (tt) => {
    const u = clamp((tt - T_SPIT2) / (T_HIT2 - T_SPIT2));
    return lerp(MY, -25, u) - Math.sin(Math.PI * u) * 5.5;
  };

  const pw = () => pitW * ease.outCubic(clamp((t - T_HIT2) / 0.34));
  const pitD = () => pitDMax * ease.outCubic(clamp((t - T_HIT2) / 0.75));
  const depth = (dx) => {
    const w = pw(), d = Math.abs(dx) / Math.max(1, w);
    return d >= 1 ? -1 : pitD() * Math.sqrt(1 - d * d) + rag[(Math.round(dx) + 200) % 80] * 0.9;
  };
  const level = () => (t < T_HIT2 ? 0 : -1.8 + (pitDMax + 1.8) * ease.inQuad(smooth(T_HIT2 + 0.45, T_END - 0.55, t)));
  const poolW = () => {
    const L = level(), w = pw();
    return L <= 0 ? w : w * Math.sqrt(Math.max(0, 1 - (L / Math.max(0.1, pitD())) ** 2));
  };
  const heat = () => smooth(T_HIT2, T_HIT2 + 0.22, t) * (1 - smooth(T_END - 0.65, T_END - 0.1, t));
  const steam = (x, y, big) => wisps.push({ x, y, t0: t, life: Math.min(R.range(0.5, 0.9) * (big ? 1.25 : 1), T_END - 0.08 - t), rise: R.range(24, 38), len: R.range(7, 14) * (big ? 1.3 : 1), amp: R.range(1, 2.5), k: R.range(0.35, 0.55), ph: R.range(0, TAU), drift: R.range(-5, 5) });

  let t = 0, s1 = false, h1 = false, s2 = false, h2 = false, acc = 0;

  return {
    update(dt) {
      t += dt;
      const f = Math.min(1, dt * 120);
      if (t < T_SPIT1 || (t >= T_HIT1 && t < T_SPIT2)) {
        for (acc += dt * 80; acc >= 1; acc -= 1) {
          const a = R.range(0, TAU), d = R.range(14, 34);
          ps.spawn(P.STREAK, 12 + Math.cos(a) * d, -28 + Math.sin(a) * d, -Math.cos(a) * 145, -Math.sin(a) * 145, 0.16, R.pick([C[6], C[5], Sh[1]]));
        }
      }
      if (!s1 && t >= T_SPIT1) {
        s1 = true;
        lights.add(MX + 4, MY, 38, C[5], 0.8, 0.22);
      }
      if (!h1 && t >= T_HIT1) {
        h1 = true;
        lights.add(TX - 4, -26, 52, C[6], 0.85, 0.25);
        for (let i = 0; i < 22; i++) {
          const a = R.range(-Math.PI, 0.35), sp = R.range(80, 230);
          drops.add(TX - 4, -26, Math.cos(a) * sp, Math.sin(a) * sp, R.chance(0.35) ? 2 : 1);
        }
      }
      if (!s2 && t >= T_SPIT2) {
        s2 = true;
        lights.add(MX + 6, MY, 54, C[6], 0.9, 0.26);
        for (let i = 0; i < 22; i++) {
          const a = R.range(-0.9, 0.9), sp = R.range(95, 240);
          ps.spawn(P.SPARK, MX + 6, MY, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.14, 0.3));
        }
      }
      if (t >= T_SPIT2 && t < T_HIT2) {
        const gx = x2(t), gy = y2(t);
        if (R.chance(0.7 * f)) drops.add(gx - R.range(2, 18), gy + R.range(-6, 8), -R.range(25, 80), R.range(15, 70), R.chance(0.42) ? 2 : 1);
        if (R.chance(0.6 * f)) ps.spawn(P.MOTE, gx - 10, gy + R.range(-10, 10), -R.range(50, 130), R.range(-22, 22), R.range(0.18, 0.34), R.pick([C[6], Sh[1], C[4]]), R.range(1.2, 2.3));
      }
      if (!h2 && t >= T_HIT2) {
        h2 = true;
        lights.add(TX - 4, -26, 68, C[5], 1.15, 0.58);
        lights.add(TX - 4, -26, 42, WHITE, 0.95, 0.14);
        lights.add(TX - 4, -14, 54, C[6], 0.85, 0.74);
        for (let i = 0; i < 54; i++) {
          const a = R.range(-Math.PI * 0.96, 0.34), sp = R.range(100, 325);
          drops.add(TX - 4 + R.range(-6, 6), -24 + R.range(-6, 6), Math.cos(a) * sp, Math.sin(a) * sp, R.chance(0.4) ? 2 : 1);
        }
        for (let i = 0; i < 52; i++) {
          const a = R.range(0, TAU), sp = R.range(120, 325);
          ps.spawn(P.SPARK, TX - 4, -24, Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.18, 0.54));
        }
        for (let i = 0; i < 8; i++) steam(TX - 4 + R.range(-22, 22), -R.range(2, 18), true);
      }
      if (t >= T_HIT2) {
        for (const s of crownSpikes) {
          if (!s.shed && t > T_HIT2 + 0.1) {
            s.shed = true;
            drops.add(TX - 4 + Math.cos(s.a) * 14, -10, Math.cos(s.a) * R.range(40, 100), -R.range(65, 145), R.chance(0.45) ? 2 : 1);
          }
        }
      }
      drops.update(dt, (d) => {
        const dx = clamp(d.x, X_MIN + 6, X_MAX - 6);
        stains.push({ x: dx, t0: t, w: d.s * 0.95 + R.range(0.4, 1.4) });
        if (t < T_END - 0.5) steam(dx, -1, false);
      });
      for (const b of pitBubbles) {
        if (!b.popped && t >= b.t0 + b.swell) {
          b.popped = true;
          for (let j = 0; j < 4; j++) drops.add(b.x, -2, R.range(-55, 55), -R.range(65, 130), 1);
          steam(b.x, -2, false);
        }
      }
      const wNow = poolW();
      if (t > T_HIT2 + 0.12 && t < T_END - 0.55 && wNow > 4) {
        if (R.chance(0.36 * f)) {
          const x = TX - 4 + R.range(-0.85, 0.85) * wNow;
          pops.push({ x, y: Math.min(level(), depth(x - (TX - 4))) - 1, t0: t });
          drops.add(x, -2, R.range(-40, 40), -R.range(50, 110), 1);
        }
        if (R.chance(0.22 * f)) steam(TX - 4 + R.range(-0.85, 0.85) * wNow, -2, R.chance(0.35));
      }
      if (t > T_HIT2 + 0.12 && t < T_HIT2 + 1.65 && R.chance(0.2 * f)) {
        steam(TX - 4 + R.range(-12, 12), -R.range(10, 44), false);
      }
      for (const q of ps.list) { q.x = clamp(q.x, X_MIN + 2, X_MAX - 2); q.y = clamp(q.y, Y_MIN + 2, -0.5); }
      for (let i = pops.length - 1; i >= 0; i--) if (t - pops[i].t0 > 0.11) pops.splice(i, 1);
      for (let i = wisps.length - 1; i >= 0; i--) if (t - wisps[i].t0 > wisps[i].life) wisps.splice(i, 1);
      ps.update(dt);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-4) return;
      const endFade = 1 - smooth(T_END - 0.55, T_END - 0.04, t), hk = heat();

      // Floor acid stains etched by dripping venom along the flight trajectory & splash
      for (const s of stains) {
        const age = t - s.t0;
        if (age > 1.75) continue;
        const k = (1 - smooth(0.85, 1.75, age)) * endFade;
        const c = age < 0.14 ? C[7] : age < 0.45 ? C[6] : age < 0.9 ? C[4] : BURNT;
        for (let x = Math.floor(s.x - s.w); x <= Math.ceil(s.x + s.w); x++) p.dot(x, 0, Math.abs(x - s.x) < s.w * 0.45 ? SCORCH : c, k);
      }

      if (t >= T_HIT2) {
        const age = t - T_HIT2;
        const crK = (1 - smooth(1.0, 1.8, age)) * endFade;
        if (crK > 0.02) {
          drawCracks(p, hitCracks, (c) => c.len * ease.outCubic(clamp((age - c.t0) / 0.12)), (d) => clamp(1 - age / 1.15 - d * 0.008, 0, 1), [C[7], C[6], C[4], C[2]], C[0], Sh[1], crK * 0.9);
        }
        // Scalloped dark-violet/chartreuse toxic miasma plumes rising behind the impact
        for (const fp of fumePuffs) {
          const bAge = t - fp.t0;
          if (bAge < 0 || bAge >= fp.life) continue;
          const u = bAge / fp.life;
          const fx = clamp(fp.x0 + fp.vx * (1 - Math.exp(-3.2 * bAge)) / 3.2, X_MIN + 14, X_MAX - 14);
          const fy = clamp(fp.y0 + fp.vy * (1 - Math.exp(-2.8 * bAge)) / 2.8, Y_MIN + 14, -4);
          const r = lerp(fp.r0, fp.r1, ease.outCubic(u)) * (1 - smooth(0.6, 1, u) * 0.3);
          drawFumePuff(p, fx, fy, r, u, C, Sh, endFade);
        }
        // Deep etched boiling acid pit with obsidian-violet tar veins + chartreuse rim
        const w = pw(), lv = level();
        if (w > 2) {
          for (let dx = Math.floor(-w) - 1; dx <= Math.ceil(w) + 1; dx++) {
            const x = TX - 4 + dx, dp = depth(dx + 0.5);
            if (dp < 0) continue;
            const bottom = Math.max(0, Math.round(dp)), edge = Math.abs(dx + 0.5) / w > 0.88;
            for (let y = 0; y <= bottom; y++) p.dot(x, y, y === bottom ? (hk > 0.45 ? C[6] : hk > 0.15 ? C[4] : BURNT) : SCORCH, endFade);
            if (edge) p.dot(x, -1, hk > 0.4 ? C[7] : hk > 0.1 ? C[5] : BURNT, endFade);
          }
          if (lv < pitDMax - 0.4) {
            for (let dx = Math.floor(-w); dx <= Math.ceil(w); dx++) {
              const x = TX - 4 + dx, dp = depth(dx + 0.5);
              if (dp < 0) continue;
              const d = Math.abs(dx + 0.5) / w, dome = lv < 0 ? Math.round(lv * Math.sqrt(Math.max(0, 1 - d * d))) : Math.round(lv), bottom = Math.round(dp);
              if (dome > bottom) continue;
              const n = noise(x * 0.22 - t * 2.8, 3) + noise(x * 0.1 + t * 1.5, 5) * 0.6;
              const vein = Math.abs(noise(x * 0.14 + t * 1.4, 11));
              for (let y = dome; y <= bottom; y++) {
                let col;
                if (y === dome) col = n > 0.65 ? C[7] : n > 0.2 ? C[6] : Sh[3];
                else if (y === dome + 1) col = vein < 0.2 ? C[6] : Sh[1];
                else col = vein < 0.15 ? C[5] : C[0];
                p.dot(x, y, col, endFade);
              }
            }
          }
          p.glow(TX - 4, -12, Math.min(54, w + 10), C[5], 0.3 * hk * endFade);
        }
      }
      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-4) return;
      const endFade = 1 - smooth(T_END - 0.55, T_END - 0.04, t);

      // Beat 1: Serrated dark-violet & neon-lime stinging acid fang dart
      if (t >= T_SPIT1 && t < T_HIT1) {
        const px = x1(t);
        p.shade(Math.floor(px - 18), -33, Math.ceil(px + 12), -21, (x, y, out) => {
          const dx = x - px, dy = y - (-27);
          const w = dx < 0 ? 4.2 * Math.max(0, 1 + dx / 18) : 4.2 * Math.max(0, 1 - dx / 11);
          const jaw = dx < -2 ? Math.sin(dy * 2.4 - t * 26) * 0.8 : 0;
          if (Math.abs(dy) > w + jaw) return;
          const q = Math.abs(dy) / Math.max(0.5, w);
          out.a = 1;
          return q > 0.72 ? C[1] : dx > 2 && q < 0.45 ? WHITE : q < 0.45 ? C[7] : Sh[1];
        });
        p.glow(px, -27, 18, C[5], 0.48);
      }
      if (t >= T_HIT1 && t < T_HIT1 + 0.15) {
        const u1 = (t - T_HIT1) / 0.15;
        sparkle(p, TX - 4, -26, 16 * (1 - u1), C[6], WHITE, 1);
      }

      // Beat 2: Colossal fanged dark-violet & chartreuse venom maw-glob + whipping tentacles & mucus stream
      if (t >= T_SPIT2 - 0.06 && t < T_HIT2) {
        const gx = t < T_SPIT2 ? MX + 2 : x2(t), gy = t < T_SPIT2 ? MY : y2(t);
        const sc = t < T_SPIT2 ? 0.5 : lerp(1.06, 1.48, (t - T_SPIT2) / (T_HIT2 - T_SPIT2));
        const rx = 17 * sc, ry = 12 * sc;

        // Elastic whipping venom cord snapping mid-flight
        if (t >= T_SPIT2 && t < T_SPIT2 + 0.24) {
          const uCord = (t - T_SPIT2) / 0.24;
          const xStart = lerp(MX, gx - rx * 0.7, ease.inQuad(uCord));
          const steps = Math.max(4, Math.ceil((gx - xStart) / 1.5));
          for (let i = 0; i <= steps; i++) {
            const u = i / steps, cx = lerp(xStart, gx - rx * 0.4, u);
            const cy = lerp(MY, gy, u) + Math.sin(u * 9 - t * 28) * 2.1 * (1 - uCord);
            const hw = (1.8 + 3.0 * u) * (1 - uCord * 0.65);
            for (let o = -hw; o <= hw; o += 0.8) p.dot(cx, cy + o, Math.abs(o) < hw * 0.42 ? C[7] : Math.abs(o) < hw * 0.78 ? C[5] : C[1], 1 - uCord * 0.4);
          }
        }

        // Massive oppressive dark-violet membrane + twin swept venomous tentacles + pulsing chartreuse-white fangs
        p.shade(Math.floor(gx - rx - 10), Math.floor(gy - ry - 4), Math.ceil(gx + rx + 4), Math.ceil(gy + ry + 4), (x, y, out) => {
          const dx = (x - gx) / rx, dy = (y - gy) / ry;
          const fin = dx < 0 ? 0.34 * Math.sin(dy * 8.5 - t * 28) : 0.14 * Math.cos(dy * 6 + t * 18);
          const d = Math.hypot(dx - fin, dy * (1 + 0.2 * dx));
          if (d > 1.08) return;
          const vein = Math.sin(dx * 6 + dy * 5 - t * 26);
          out.a = 1;
          if (d > 0.78) return dx < -0.1 ? C[0] : C[1];
          if (d < 0.3 && dx > -0.05) return WHITE;
          if (d < 0.54 || vein > 0.62) return C[7];
          return dx < -0.18 ? Sh[1] : C[5];
        });

        if (t >= T_SPIT2 && t < T_SPIT2 + 0.14) {
          const uL = (t - T_SPIT2) / 0.14;
          p.ellipse(MX + 4, MY, 5.5, 19 * (1 - uL * 0.3), uL < 0.4 ? WHITE : C[6], 1 - uL);
          p.glow(MX + 4, MY, 28, C[5], (1 - uL) * 0.68);
        }
        p.glow(gx, gy, 30 * sc, C[5], 0.44);
        p.glow(gx, gy, 14 * sc, C[7], 0.38);
      }

      // Hit Result: Towering Tapered Acid Crown + Through-Target Fang Cleave + Melting Target Corrosion
      if (t >= T_HIT2) {
        const age = t - T_HIT2;

        // 1. Thick 3-tone tapered acid splash crown leaping upward & outward
        if (age < 0.34) {
          const uCr = age / 0.34;
          const kCr = Math.sin(Math.PI * Math.pow(uCr, 0.62));
          const rad = 11 + 28 * ease.outCubic(uCr);
          for (const s of crownSpikes) {
            const sx = TX - 4 + Math.cos(s.a) * rad * 0.85, sy = -8 + Math.sin(s.a) * rad * 0.24;
            const tx = sx + Math.cos(s.a) * s.h * 0.65 * kCr, ty = clamp(sy - s.h * 1.45 * kCr, Y_MIN + 4, -2);
            const nx = -(ty - sy), ny = tx - sx, l = Math.hypot(nx, ny) || 1;
            const hw = s.w * (1 - uCr * 0.45);
            p.tri(sx - (nx / l) * hw, sy - (ny / l) * hw, sx + (nx / l) * hw, sy + (ny / l) * hw, tx, ty, C[1], (1 - uCr * 0.35) * endFade);
            p.line(sx, sy, tx, ty, uCr < 0.35 ? WHITE : C[6], (1 - uCr * 0.25) * endFade);
          }
          const dist = 10 + 58 * ease.outCubic(uCr);
          frontCrescent(p, clamp(TX - 4 + dist, X_MIN + 10, X_MAX - 8), 1, 26 * (1 - uCr * 0.55), 8.5 * (1 - uCr * 0.55), [WHITE, C[6], Sh[1]], (1 - uCr) * endFade);
          frontCrescent(p, clamp(TX - 4 - dist, X_MIN + 8, X_MAX - 10), -1, 26 * (1 - uCr * 0.55), 8.5 * (1 - uCr * 0.55), [WHITE, C[6], Sh[1]], (1 - uCr) * endFade);
        }

        // 2. Broken impact ring + diagonal blow-through corrosive cleave streaks across target
        const uR = age / 0.36;
        if (uR < 1) brokenRing(p, TX - 4, -24, 14 + 58 * ease.outCubic(uR), Math.max(1, 4.4 * (1 - uR)), segs, smooth(0.15, 0.7, uR), uR < 0.25 ? WHITE : C[6], Sh[1], (1 - uR) * endFade, 1, 0);
        if (age < 0.28) {
          const uX = age / 0.28, kX = ease.outCubic(clamp(uX / 0.14)) * (1 - smooth(0.35, 1, uX));
          for (const [ang, L0, w0] of [[-0.58, 82, 5.4], [0.64, 78, 4.8]]) {
            const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
            const L = L0 * (0.55 + 0.45 * ease.outCubic(clamp(uX / 0.14))), hw = w0 * (1 - uX * 0.55);
            p.poly([[clamp(TX - 4 + ca * L, X_MIN, X_MAX), clamp(-24 + sa * L, Y_MIN, -2)], [clamp(TX - 4 + nx * hw, X_MIN, X_MAX), clamp(-24 + ny * hw, Y_MIN, -2)], [clamp(TX - 4 - ca * L, X_MIN, X_MAX), clamp(-24 - sa * L, Y_MIN, -2)], [clamp(TX - 4 - nx * hw, X_MIN, X_MAX), clamp(-24 - ny * hw, Y_MIN, -2)]], C[0], kX);
            p.poly([[clamp(TX - 4 + ca * L * 0.9, X_MIN, X_MAX), clamp(-24 + sa * L * 0.9, Y_MIN, -2)], [clamp(TX - 4 + nx * hw * 0.55, X_MIN, X_MAX), clamp(-24 + ny * hw * 0.55, Y_MIN, -2)], [clamp(TX - 4 - ca * L * 0.9, X_MIN, X_MAX), clamp(-24 - sa * L * 0.9, Y_MIN, -2)], [clamp(TX - 4 - nx * hw * 0.55, X_MIN, X_MAX), clamp(-24 - ny * hw * 0.55, Y_MIN, -2)]], uX < 0.3 ? WHITE : C[7], kX);
          }
        }
        if (age < 0.16) {
          const kS = 1 - age / 0.16;
          star(p, TX - 4, -24, hitSpikes, age < 0.04 ? 1.18 : 0.98, 0.7 + 0.5 * kS, [C[1], C[4], C[6], WHITE], kS, 2.5);
          flare(p, TX - 4, -24, 54 * kS, kS, [Sh[1], C[5], C[7], WHITE]);
        }

        // 3. Organic irregular viscous venom splatter drips sliding down into the pit (varied heights/curves, never uniform bars)
        if (age < 1.25) {
          const drips = [
            { dx: -10, y0: -32, len: 24, delay: 0.04, speed: 1.0 },
            { dx: -4, y0: -39, len: 31, delay: 0.0, speed: 1.15 },
            { dx: 1, y0: -35, len: 28, delay: 0.07, speed: 0.92 },
            { dx: 6, y0: -41, len: 33, delay: 0.02, speed: 1.08 },
            { dx: 11, y0: -28, len: 20, delay: 0.09, speed: 0.96 },
          ];
          for (let i = 0; i < drips.length; i++) {
            const d = drips[i], dAge = age - d.delay;
            if (dAge < 0) continue;
            const u = clamp((dAge * d.speed) / 1.15);
            if (u >= 1) continue;
            const mFade = (1 - smooth(0.55, 1, u)) * endFade;
            const headY = Math.min(-1.5, d.y0 + ease.inQuad(u) * d.len);
            const tailY = Math.max(d.y0, headY - (7 + 5 * Math.sin(Math.PI * u)));
            const sway = Math.sin(i * 2.1 + u * 5) * 0.9;
            const x = TX - 4 + d.dx + sway;
            p.line(x - 1, tailY, x - 1, headY, C[0], mFade * 0.72);
            p.line(x, tailY, x, headY, i % 2 === 0 ? C[6] : C[5], mFade * 0.92);
            p.circle(x, headY, 1.45 * (1 - u * 0.35), C[7], mFade);
          }
        }
        for (const bl of bodyBlisters) {
          const bAge = t - bl.t0;
          if (bAge < 0 || bAge > bl.life) continue;
          const u = bAge / bl.life;
          if (u < 0.7) bubble(p, TX - 4 + bl.dx, bl.dy, bl.r * ease.outCubic(u / 0.7), WHITE, C[0], C[5], endFade, false);
          else {
            const uk = (u - 0.7) / 0.3;
            for (let j = 0; j < 6; j++) {
              const a = (j / 6) * TAU + bl.dx, d = bl.r + uk * 6.5;
              p.dot(TX - 4 + bl.dx + Math.cos(a) * d, bl.dy + Math.sin(a) * d, C[7], (1 - uk) * endFade);
            }
          }
        }

        // 4. Glossy dark-violet/chartreuse tar bubbles swelling & popping in the etched pit
        for (const pb of pitBubbles) {
          const bAge = t - pb.t0;
          if (bAge < 0) continue;
          if (bAge < pb.swell) bubble(p, pb.x, -1, pb.rmax * ease.outCubic(bAge / pb.swell), Sh[3], C[0], C[4], endFade, true);
          else if (bAge < pb.swell + 0.28) {
            const k = (bAge - pb.swell) / 0.28, rr = 2 + 12 * ease.outCubic(k);
            for (let a = 0; a < TAU; a += 0.5 / rr) p.dot(pb.x + Math.cos(a) * rr, -1 + Math.sin(a) * rr * 0.22, k < 0.4 ? WHITE : C[6], (1 - k) * endFade);
          }
        }
      }

      for (const q of pops) {
        const k = (t - q.t0) / 0.11;
        p.px(q.x, q.y, WHITE);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]]) p.dot(q.x + dx * (1 + k * 2.5), q.y + dy * (1 + k * 2.5), C[7], (1 - k) * endFade);
      }
      for (const q of wisps) wisp(p, q, t, STEAM);
      drops.draw(p, C);
      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
