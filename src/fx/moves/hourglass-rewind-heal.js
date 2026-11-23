// Hourglass Rewind Heal (沙漏倒流恢复 — moves/hourglass-rewind-heal):
// 1. Colossal Phantom Hourglass & Pouring Sand (0.00..0.76s): A 134px-tall translucent crystal-glass hourglass
//    materializes directly out of the wounded character's body as golden sand cascades rapidly through its waist;
//    branching stress fractures flash across the glass.
// 2. Cataclysmic Shatter & Sudden Mid-Air Freeze (0.76..1.44s): The giant hourglass shatters with radial fracture rays
//    into 54 sharp crystal daggers/splinters while the upper golden sand bursts into a falling cascade — then time
//    slams to an absolute standstill inside an astral chrono-dial before its hands whip counter-clockwise.
// 3. Anti-Gravity Rewind & Wound Restoration (1.44..2.48s): Defying gravity, the 220 frozen golden sand grains and
//    glowing golden-rimmed shards float upward and spiral along helical ribbons into the character's mortal wounds,
//    sealing crimson scars in molten white-gold as the hero rises back from the brink of death.
// 4. Golden Melt & Volumetric 3D Golden Ripples (1.96..3.64s): As golden sand melts into the body, 3D body hoops and
//    coupled spherical golden shock-domes + perspective floor wave-rings radiate outward before clearing cleanly.
import {
  Particles, Lights, P, Rng,
  fit, clamp, smooth, seg, lerp, ease,
  flare, sparkle, band, TAU, WHITE, READY, luma,
} from "../../core/index.js";
import { glassPoly } from "../ice/_lib.js";
import { ringLight } from "../shadow/_lib.js";

const PI = Math.PI;
const W_CANVAS = 320, H_CANVAS = 216;
const OX = 160, OY = 176;

// Strict interior stage bounds (canvas 320x216, origin [160, 176] => x in [-160..159], y in [-176..39])
const X_MIN = -152, X_MAX = 151, Y_MIN = -168, Y_MAX = 33;
const inStage = (x, y, pad = 0) =>
  x >= X_MIN + pad && x <= X_MAX - pad && y >= Y_MIN + pad && y <= Y_MAX - pad;

// Frame-exact 4-beat timeline (30 fps)
const T_CRACK   = 0.50;   // branching fractures race out from the pinched crystal waist
const T_SHATTER = 0.76;   // colossal crystal hourglass explodes violently; sand reservoir cascades down
const T_FREEZE  = 1.06;   // pouring golden sand & flying crystal splinters freeze dead-still mid-air!
const T_REWIND  = 1.44;   // gravity inverts: sand & glowing shards lift upward and spiral into wounds
const T_BLOOM   = 2.48;   // all golden sand melts into body; grand volumetric golden ripples erupt
const T_END     = 3.64;   // all golden waves & rising motes clear cleanly to 0 px

// Colossal 134px-tall hourglass geometry (3.5x character height!)
const HG_TOP = -136, HG_NECK = -68, HG_BOT = -2;
const HEART_Y = -22;

export const meta = {
  name: "Hourglass rewind heal",
  desc: "A giant glass hourglass emerges from the hero and shatters; pouring golden sand freezes mid-air, rewinds with glowing shards to heal wounds, and pulses golden ripples.",
  tags: ["move", "heal", "hourglass", "rewind", "time", "sand", "glass", "gold", "restore", "revive", "one-shot"],
  size: [W_CANVAS, H_CANVAS],
  origin: [OX, OY],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    // 8-step Imperial Chrono-Gold Sand & Ripple ramp
    palette: ["#2b1506", "#5e2f0c", "#a05714", "#df8a1c", "#f9c238", "#ffe980", "#fff8cf", "#ffffff"],
    // 7-step Translucent Astral Crystal-Glass ramp
    glass:   ["#081828", "#123450", "#22608e", "#46a4d6", "#8ee0ff", "#d4f7ff", "#ffffff"],
    // 4-step Mortal Crimson Wound ramp (knitted shut by molten golden sand)
    wound:   ["#29040a", "#720c18", "#d41e2c", "#ff6c76"],
    seed: 19,
  },
};

// Wounded brink-of-death kneel -> shatter recoil -> frozen stillness -> rising revival -> golden rebirth bloom -> READY
const HURT = {
  ...READY,
  turn: 0.90, crouch: 8.5, lean: 4, hy: 2,
  fx: 1, fy: -19, bx: 7, by: -16,
  ffx: 4, fbx: -5,
};
const RECOIL = {
  ...HURT,
  crouch: 9.5, lean: -2.5, hy: 1,
  fx: -9, fy: -24, bx: 10, by: -22,
  ffx: 3, fbx: -6, ghost: 1,
};
const MEND_STIR = {
  ...READY,
  turn: 0.98, crouch: 5, lean: 1, hy: 1,
  fx: -6, fy: -23, bx: 8, by: -22,
  ffx: -2, fbx: 3,
};
const RISE = {
  ...READY,
  turn: 1.08, crouch: 1.5, lean: -1, hy: 0,
  fx: -11, fy: -29, bx: 12, by: -29,
  ffx: -3, fbx: 4, ghost: 1,
};
const BLOOM_POSE = {
  ...READY,
  turn: 1.15, crouch: -1, lean: -2, hy: -1,
  fx: -14, fy: -35, bx: 14, by: -35,
  ffx: -4, fbx: 5, ghost: 1,
};

export const act = {
  poses: [
    [-0.28, HURT],
    [T_CRACK, { ...HURT, crouch: 9 }],
    [T_SHATTER, RECOIL, "snap"],
    [T_FREEZE, { ...RECOIL, ghost: 0 }],
    [T_REWIND + 0.12, MEND_STIR],
    [2.12, RISE, "out"],
    [T_BLOOM, BLOOM_POSE, "snap"],
    [3.06, { ...READY, turn: 0.92, fx: -9, fy: -24, bx: 10, by: -24 }],
    [T_END, READY],
  ],
  hits: [
    { t: T_SHATTER, stop: 0.08, shake: 0.32, amp: 5.4, target: false },
    { t: T_FREEZE,  stop: 0.05, shake: 0.12, amp: 1.8, target: false },
    { t: T_BLOOM,   stop: 0.10, shake: 0.36, amp: 4.4, target: false },
  ],
  dust: [
    { t: T_SHATTER, x: 0, n: 10, c: "#d4f7ff" },
    { t: T_BLOOM,   x: 0, n: 13, c: "#ffe980" },
  ],
};

// Colossal sculpted crystal hourglass bulb profile (40px half-width bulbs pinching to 3.8px waist)
function crystalRx(y) {
  if (y < HG_TOP || y > HG_BOT) return 0;
  const u = Math.abs(y - HG_NECK) / (HG_NECK - HG_TOP);
  return 3.8 + 40.2 * Math.sin(Math.pow(u, 0.72) * PI * 0.76);
}

const bez2 = (a, b, c, u) => {
  const m = 1 - u;
  return m * m * a + 2 * m * u * b + u * u * c;
};

// Shaded multi-pixel volumetric golden shock-dome whose base at y = 0 meets the perspective floor wave ring!
function drawGoldenDomeWave(p, cy, R3d, thick, shimmerAmp, shimmerPhase, G, hotK, alpha) {
  if (R3d < 4 || alpha <= 0.02) return;
  const steps = Math.max(56, Math.ceil(R3d * 1.65));
  const passes = thick > 2.2 ? 3 : thick > 1.2 ? 2 : 1;
  for (let pass = passes - 1; pass >= 0; pass--) {
    const dr = -pass * 1.15;
    const col = pass === 0 ? (hotK > 0.32 ? WHITE : G[6]) : pass === 1 ? G[5] : G[3];
    const alBase = alpha * (pass === 0 ? 0.98 : pass === 1 ? 0.84 : 0.56);
    for (let s = 0; s < steps; s++) {
      const a0 = (s / steps) * TAU, a1 = ((s + 1) / steps) * TAU;
      // Gentle liquid-gold harmonic near body that damps to a pure regal sphere as R3d expands!
      const w0 = 1 + shimmerAmp * Math.cos(a0 * 8 - shimmerPhase);
      const w1 = 1 + shimmerAmp * Math.cos(a1 * 8 - shimmerPhase);
      const r0 = Math.max(0, R3d * w0 + dr), r1 = Math.max(0, R3d * w1 + dr);
      let x0 = Math.cos(a0) * r0, y0 = cy + Math.sin(a0) * r0;
      let x1 = Math.cos(a1) * r1, y1 = cy + Math.sin(a1) * r1;
      if (y0 > 0 && y1 > 0) continue;
      // Exact linear clip at y = 0 so dome walls land razor-cleanly on the floor wave ring!
      if (y0 > 0) { x0 = x0 + (x1 - x0) * (-y0 / (y1 - y0)); y0 = 0; }
      else if (y1 > 0) { x1 = x0 + (x1 - x0) * (-y0 / (y1 - y0)); y1 = 0; }
      if (!inStage(x0, y0, 4) || !inStage(x1, y1, 4)) continue;
      p.line(x0, y0, x1, y1, col, alBase);
    }
  }
}

export function create(o) {
  const G = fit(o.palette, 8);
  const Gl = fit(o.glass, 7);
  const Wd = fit(o.wound, 4);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, G[6], G[5], G[4], G[3]],
    haze: G[4],
  });
  const lights = new Lights();

  // Character bounding box snapshot to isolate live posed character pixels between drawBack and draw
  const BX0 = -22, BY0 = -46, BW = 44, BH = 47;
  const backSnap = new Uint32Array(BW * BH);

  // --- 54 Jagged Crystal-Glass Shards (10 large hero daggers, 22 medium wedges, 22 fine splinters) ---
  const shards = [];
  for (let i = 0; i < 54; i++) {
    const zone = i < 23 ? -1 : i < 31 ? 0 : 1;
    const y0 = zone < 0
      ? R.range(HG_TOP + 5, HG_NECK - 6)
      : zone === 0
        ? HG_NECK + R.range(-7, 7)
        : R.range(HG_NECK + 6, HG_BOT - 5);
    const maxR = crystalRx(y0);
    const x0 = R.range(-0.94, 0.94) * maxR;

    const heroShard = i < 10;
    const medShard = i >= 10 && i < 32;
    const scale = heroShard ? R.range(9.5, 14.2) : medShard ? R.range(5.4, 8.6) : R.range(2.8, 4.6);
    const tri = i % 3 !== 0;
    const elong = R.range(1.45, 2.40);
    const pts = tri
      ? [
          [0, -scale * elong * 0.64],
          [scale * R.range(0.42, 0.74), scale * R.range(0.24, 0.56)],
          [-scale * R.range(0.42, 0.74), scale * R.range(0.34, 0.68)],
        ]
      : [
          [0, -scale * elong * 0.66],
          [scale * R.range(0.38, 0.66), R.range(-0.14, 0.16) * scale],
          [R.range(-0.12, 0.12) * scale, scale * elong * 0.60],
          [-scale * R.range(0.38, 0.66), R.range(-0.16, 0.14) * scale],
        ];

    const baseA = zone === 0
      ? (x0 >= 0 ? 0 : PI) + R.range(-0.42, 0.42)
      : Math.atan2((y0 - HG_NECK) * 0.72, (x0 || R.sign() * 6) * 1.38) + R.range(-0.28, 0.28);
    const sp = heroShard ? R.range(165, 285) : R.range(140, 330);
    const lane = i % 6;
    const sideSign = lane % 2 === 0 ? -1 : 1;

    shards.push({
      pts, heroShard,
      x: x0, y: y0, fx: x0, fy: y0, lx: x0, ly: y0,
      vx: Math.cos(baseA) * sp,
      vy: Math.sin(baseA) * sp - 10,
      a: R.range(0, TAU), va: R.range(-11, 11),
      f: R.range(0, PI), vf: R.range(7, 15),
      lit: R.range(0.35, 1.0),
      scaleNow: 1,
      liftSpd: R.range(26, 46),
      rewindDelay: 0.14 + lane * 0.036 + R.range(0, 0.08),
      ctrlX: sideSign * R.range(36, 84),
      ctrlY: R.range(-112, -14),
      destX: R.range(-4, 4),
      destY: R.range(-31, -15),
      absorbed: false,
    });
  }

  // --- 220 Luminous Golden Sand Grains & Cascading Waterfall Droplets ---
  const sands = Array.from({ length: 220 }, (_, i) => {
    // 90 grains form the central pouring waterfall + collapsing golden sand curtains on shatter!
    const inCoreStream = i < 42;
    const inCascade = i >= 42 && i < 110;
    const x0 = inCoreStream
      ? R.range(-3.0, 3.0) * (1 + (i / 42) * 1.2)
      : inCascade
        ? R.range(-24, 24)
        : R.range(-30, 30);
    const y0 = inCoreStream
      ? lerp(HG_NECK - 10, -5, i / 42)
      : inCascade
        ? R.range(-104, HG_NECK - 3)
        : R.range(-36, -4);

    // Core & upper cascade pour predominantly DOWNWARD before slamming into mid-air freeze!
    const outA = inCoreStream
      ? PI * 0.5 + R.range(-0.40, 0.40)
      : inCascade
        ? PI * 0.5 + (x0 / 26) * 0.85 + R.range(-0.28, 0.28)
        : Math.atan2((y0 - HG_NECK) * 0.78, (x0 || R.sign() * 5) * 1.28) + R.range(-0.36, 0.36);
    const sp = inCoreStream ? R.range(45, 135) : inCascade ? R.range(75, 195) : R.range(115, 295);
    const lane = i % 6;
    const laneSign = lane % 2 === 0 ? -1 : 1;

    return {
      x: x0, y: y0, fx: x0, fy: y0, lx: x0, ly: y0,
      vx: Math.cos(outA) * sp,
      vy: Math.sin(outA) * sp + (inCoreStream || inCascade ? 42 : -10),
      big: i % 3 === 0,
      hero: i % 5 === 0,
      inStream: inCoreStream || inCascade,
      liftSpd: R.range(36, 68),
      rewindDelay: 0.12 + lane * 0.034 + R.range(0, 0.12),
      ctrlX: laneSign * R.range(28, 86),
      ctrlY: R.range(-116, -10),
      destX: R.range(-5, 5),
      destY: R.range(-33, -12),
      trail: [],
      absorbed: false,
    };
  });

  // Branching crystal fractures prior to T_SHATTER
  const cracks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * TAU + 0.18;
    const pts = [[0, HG_NECK]];
    let x = 0, y = HG_NECK;
    for (let s = 1; s <= 7; s++) {
      const aa = a + R.range(-0.34, 0.34), step = R.range(8, 14);
      y = clamp(y + Math.sin(aa) * step, HG_TOP + 3, HG_BOT - 3);
      const lim = Math.max(2, crystalRx(y) - 2);
      x = clamp(x + Math.cos(aa) * step, -lim, lim);
      pts.push([x, y]);
    }
    return pts;
  });

  // Volumetric 3D Golden Melt & Rebirth Ripples (3D sphere radius R3d coupled directly to floor ring sqrt(R3d^2 - 22^2)!)
  const rippleEvents = [
    { t: 1.94, maxR: 58,  hoopY: -16, dur: 0.50, big: false, fired: false },
    { t: 2.22, maxR: 82,  hoopY: -25, dur: 0.56, big: false, fired: false },
    { t: T_BLOOM, maxR: 132, hoopY: -33, dur: 0.98, big: true,  fired: false },
    { t: T_BLOOM + 0.16, maxR: 98, hoopY: -21, dur: 0.82, big: false, fired: false },
  ];

  const keepStageAboveFloor = (cx, cy) => inStage(cx, cy, 6) && cy <= 2;

  let t = 0, shattered = false, froze = false, rewound = false;
  let pourSparkAcc = 0;

  return {
    update(dt) {
      t += dt;

      // Pouring golden sand splash-sparks off the bottom mound during Phase 1
      if (t > 0.14 && t < T_SHATTER) {
        pourSparkAcc += dt * 32;
        while (pourSparkAcc >= 1) {
          pourSparkAcc -= 1;
          const side = R.sign();
          ps.spawn(P.SPARK, side * R.range(1, 6), -6, side * R.range(26, 72), -R.range(20, 56), R.range(0.12, 0.24));
        }
      }

      // Cataclysmic Crystal Shatter!
      if (!shattered && t >= T_SHATTER) {
        shattered = true;
        lights.add(0, HG_NECK, 92, Gl[5], 1.0, 0.26);
        lights.add(0, -34, 56, G[5], 0.88, 0.30);
        for (let k = 0; k < 38; k++) {
          const a = R.range(0, TAU), sp = R.range(105, 275);
          ps.spawn(P.SPARK, R.range(-10, 10), HG_NECK + R.range(-18, 18), Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.12, 0.26));
        }
        for (let k = 0; k < 12; k++) {
          ps.spawn(P.VAPOUR, R.range(-22, 22), HG_NECK + R.range(-28, 28), R.range(-65, 65), R.range(-50, 40), R.range(0.24, 0.44), Gl[5], R.range(2.4, 4.0));
        }
      }

      // Sudden Mid-Air Time-Freeze!
      if (!froze && t >= T_FREEZE) {
        froze = true;
        lights.add(0, -60, 82, WHITE, 0.75, 0.22);
        for (const sh of shards) { sh.fx = sh.x; sh.fy = sh.y; sh.lx = sh.x; sh.ly = sh.y; }
        for (const s of sands) {
          s.fx = s.x; s.fy = s.y; s.lx = s.x; s.ly = s.y;
          // Preserve a crisp 2-point downward raindrop tail on stream grains so their frozen downward fall reads!
          if (s.inStream && s.trail.length > 2) s.trail.length = 2;
          else if (!s.inStream) s.trail.length = 0;
        }
        ps.list.length = 0;
      }

      // Anti-Gravity Rewind Ignition!
      if (!rewound && t >= T_REWIND) {
        rewound = true;
        lights.add(0, -52, 80, G[5], 0.88, 0.48);
      }

      // Step shards & golden sand
      if (t >= T_SHATTER && t < T_FREEZE) {
        const u = (t - T_SHATTER) / (T_FREEZE - T_SHATTER);
        const damp = Math.pow(1 - u, 2.4);
        for (const sh of shards) {
          sh.x = clamp(sh.x + sh.vx * damp * dt, X_MIN + 20, X_MAX - 20);
          sh.y = clamp(sh.y + (sh.vy + 100 * u) * damp * dt, Y_MIN + 18, -4);
          sh.a += sh.va * damp * dt;
          sh.f += sh.vf * damp * dt;
        }
        for (const s of sands) {
          s.x = clamp(s.x + s.vx * damp * dt, X_MIN + 16, X_MAX - 16);
          s.y = clamp(s.y + (s.vy + 185 * u) * damp * dt, Y_MIN + 14, -2);
          s.trail.unshift([s.x, s.y]);
          if (s.trail.length > 4) s.trail.pop();
        }
      } else if (t >= T_REWIND) {
        // Stage 3a (0..rewindDelay): visible ANTI-GRAVITY VERTICAL FLOAT!
        // Stage 3b (rewindDelay..T_BLOOM): sweeping helical S-curve ribbons into the character's wounds!
        for (const sh of shards) {
          if (sh.absorbed) continue;
          const tMove = t - (T_REWIND + sh.rewindDelay);
          if (tMove <= 0) {
            sh.y = Math.max(Y_MIN + 16, sh.y - sh.liftSpd * dt);
            sh.lx = sh.x; sh.ly = sh.y;
            sh.a -= 3.5 * dt;
            continue;
          }
          const u = seg(t, T_REWIND + sh.rewindDelay, T_BLOOM - 0.03);
          if (u >= 1) { sh.absorbed = true; continue; }
          const e = ease.inCubic(u);
          sh.x = bez2(sh.lx, sh.ctrlX, sh.destX, e);
          sh.y = bez2(sh.ly, sh.ctrlY, sh.destY, e);
          sh.scaleNow = lerp(1.0, 0.16, smooth(0.40, 1.0, u));
          sh.a -= 11 * dt;
          sh.f += 13 * dt;
        }
        for (const s of sands) {
          if (s.absorbed) continue;
          const tMove = t - (T_REWIND + s.rewindDelay);
          if (tMove <= 0) {
            // Pure anti-gravity upward rise first!
            s.y = Math.max(Y_MIN + 14, s.y - s.liftSpd * dt);
            s.lx = s.x; s.ly = s.y;
            s.trail.unshift([s.x, s.y]);
            if (s.trail.length > 5) s.trail.pop();
            continue;
          }
          const u = seg(t, T_REWIND + s.rewindDelay, T_BLOOM + 0.02);
          if (u >= 1) { s.absorbed = true; continue; }
          const e = ease.inOutCubic(u);
          s.x = bez2(s.lx, s.ctrlX, s.destX, e);
          s.y = bez2(s.ly, s.ctrlY, s.destY, e);
          s.trail.unshift([s.x, s.y]);
          if (s.trail.length > 9) s.trail.pop();
        }
      }

      // Volumetric Golden Ripple Eruptions as sand melts into the body
      for (const ev of rippleEvents) {
        if (!ev.fired && t >= ev.t) {
          ev.fired = true;
          // Keep light radius <= 58 at y=-22 so glow NEVER spills past Y_MAX=+39!
          lights.add(0, HEART_Y, ev.big ? 58 : 46, G[5], ev.big ? 1.0 : 0.68, ev.big ? 0.68 : 0.34);
          if (ev.big) lights.add(0, -64, 78, G[5], 0.74, 0.56);

          const nSp = ev.big ? 40 : 13;
          for (let k = 0; k < nSp; k++) {
            const a = R.range(-PI * 0.95, -PI * 0.05) + (R.chance(0.35) ? R.range(-0.6, 0.6) : 0);
            const sp = R.range(48, ev.big ? 188 : 108);
            ps.spawn(
              k % 3 === 0 ? P.STAR : P.SPARK,
              R.range(-7, 7), HEART_Y + R.range(-10, 8),
              Math.cos(a) * sp, Math.sin(a) * sp - 16,
              R.range(0.34, 0.78), G[6], R.range(1.0, 2.2)
            );
          }
          if (ev.big) {
            for (let k = 0; k < 24; k++) {
              ps.spawn(P.EMBER, R.range(-58, 58), -2, R.range(-18, 18), -R.range(24, 68), R.range(0.60, 1.00), G[5], 1.9);
            }
          }
        }
      }

      ps.update(dt);
      lights.update(dt);
      const endClear = t >= T_END - 0.04;
      for (let i = ps.list.length - 1; i >= 0; i--) {
        if (endClear || !inStage(ps.list[i].x, ps.list[i].y, 6)) ps.list.splice(i, 1);
      }
      if (endClear) lights.list.length = 0;
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;

      // 1. Phase 1: Colossal Translucent Glass Hourglass Emerging Directly from Character's Body!
      if (t < T_SHATTER) {
        const emRaw = ease.outBack(seg(t, 0, 0.24), 1.18);
        const em = clamp(emRaw, 0.08, 1.04);
        const ce = clamp(emRaw, 0, 1);
        // Scale vertically & horizontally around HEART_Y = -22 so the entire hourglass grows out of the character!
        const topNow = Math.round(HEART_Y + (HG_TOP - HEART_Y) * em);
        const botNow = Math.round(HEART_Y + (HG_BOT - HEART_Y) * em);

        for (let y = topNow; y <= botNow; y++) {
          const modelY = HEART_Y + (y - HEART_Y) / em;
          const rx = crystalRx(modelY) * em;
          if (rx < 1) continue;
          const ix = Math.floor(rx);
          for (let x = -ix; x <= ix; x++) {
            const edge = Math.abs(x) / rx;
            p.blend(x, y, edge > 0.72 ? Gl[2] : Gl[1], (edge > 0.72 ? 0.30 : 0.20) * ce);
          }
        }

        // Top & bottom perspective golden astral crowns flush with exact crystal mouth radius!
        const cw = crystalRx(HG_TOP) * em;
        band(p, 0, topNow - 1, cw, 0.18, 2.8, 0.94 * ce, [G[2], G[4], G[6], WHITE], () => true, false);
        band(p, 0, botNow + 1, cw, 0.18, 2.8, 0.88 * ce, [G[2], G[4], G[5], G[6]], (g) => Math.sin(g) < 0, false);
        for (const sgn of [-1, 1]) {
          p.dot(sgn * cw, topNow - 1, WHITE, 0.92 * ce);
          p.dot(sgn * cw, botNow + 1, G[6], 0.88 * ce);
        }
        p.line(0, topNow - 7 * ce, 0, topNow - 2, G[6], 0.92 * ce);
        p.dot(0, topNow - 8 * ce, WHITE, 0.92 * ce);
      }

      // 2. Far Half of Coupled Floor Golden Ripples & 3D Body-Level Golden Melt Hoops!
      for (const ev of rippleEvents) {
        const dtR = t - ev.t;
        if (dtR <= 0 || dtR >= ev.dur) continue;
        const u = dtR / ev.dur;
        const R3d = ev.maxR * ease.outQuart(u);

        // Exact 3D sphere-plane intersection radius on floor y = 0, plus trailing inner harmonic ripple!
        if (R3d > Math.abs(HEART_Y) + 2) {
          const rFloor = Math.sqrt(R3d * R3d - HEART_Y * HEART_Y);
          band(p, 0, 0, rFloor, 0.21, (ev.big ? 4.8 : 3.0) * (1 - u * 0.65), (1 - u) * 0.94, [G[2], G[4], G[6], WHITE], (g) => Math.sin(g) < 0, u < 0.32);
          if (ev.big && rFloor > 26) {
            band(p, 0, 0, rFloor * 0.68, 0.21, 2.4 * (1 - u * 0.65), (1 - u) * 0.72, [G[2], G[4], G[5], G[6]], (g) => Math.sin(g) < 0, false);
          }
        }

        // 3D horizontal golden melt hoop radiating out around the body (far half)
        if (u < 0.72) {
          const hu = u / 0.72;
          const hr = 9 + (ev.big ? 54 : 32) * ease.outCubic(hu);
          band(p, 0, ev.hoopY, hr, 0.20, (ev.big ? 3.0 : 2.0) * (1 - hu * 0.6), (1 - hu) * 0.85, [G[3], G[5], G[6], WHITE], (g) => Math.sin(g) < 0, hu < 0.35);
        }
      }

      ps.draw(p, "back");

      // Snapshot character box at end of drawBack so draw() detects exact live posed character pixels!
      for (let j = 0; j < BH; j++) {
        const sy = p.cellY(0, BY0 + j) - p.oy;
        for (let i = 0; i < BW; i++) {
          const sx = p.cellX(BX0 + i, 0) - p.ox;
          backSnap[j * BW + i] = sx >= 0 && sy >= 0 && sx < p.w && sy < p.h ? p.C[sy * p.w + sx] : 0;
        }
      }
    },

    draw(p) {
      if (t >= T_END - 0.04) return;

      // 1. Live Character Wounds -> Molten Golden Sand Knitting Wounds Shut & Liquid-Gold Body Sheen!
      const healProg = seg(t, T_REWIND + 0.16, T_BLOOM + 0.02);
      const meltWave = t >= 1.88 ? Math.sin(PI * seg(t, 1.88, 3.16)) : 0;
      if (t < 3.20) {
        for (let j = 0; j < BH; j++) {
          const ly = BY0 + j;
          const sy = p.cellY(0, ly) - p.oy;
          if (sy < 0 || sy >= p.h) continue;
          for (let i = 0; i < BW; i++) {
            const lx = BX0 + i;
            const sx = p.cellX(lx, 0) - p.ox;
            if (sx < 0 || sx >= p.w) continue;
            const c = p.C[sy * p.w + sx];
            if (!c || c === backSnap[j * BW + i]) continue;

            const dWound = Math.min(
              Math.abs((lx + 1) * 0.72 + (ly + 23) * 0.69) + Math.max(0, Math.abs(ly + 23) - 6.2) * 2,
              Math.abs((lx - 1) * 0.80 - (ly + 13) * 0.60) + Math.max(0, Math.abs(ly + 13) - 3.6) * 2
            );
            if (dWound < 1.45 && healProg < 1) {
              const wCol = healProg < 0.18
                ? (dWound < 0.7 ? Wd[3] : Wd[2])
                : healProg < 0.72
                  ? G[5]
                  : WHITE;
              p.px(lx, ly, wCol);
            } else if (meltWave > 0.04) {
              const rippleBand = 0.55 + 0.45 * Math.sin(ly * 0.34 - t * 16);
              const lm = luma(c);
              p.blend(lx, ly, lm > 0.52 ? WHITE : G[5], meltWave * rippleBand * 0.74);
            }
          }
        }
      }

      // 2. Phase 1: Colossal Translucent Glass Hourglass Front + Pouring Golden Sand Waterfall + Fractures
      if (t < T_SHATTER) {
        const emRaw = ease.outBack(seg(t, 0, 0.24), 1.18);
        const em = clamp(emRaw, 0.08, 1.04);
        const ce = clamp(emRaw, 0, 1);
        const topNow = Math.round(HEART_Y + (HG_TOP - HEART_Y) * em);
        const botNow = Math.round(HEART_Y + (HG_BOT - HEART_Y) * em);
        const neckNow = HEART_Y + (HG_NECK - HEART_Y) * em;
        const drain = seg(t, 0.04, T_SHATTER);

        // Upper bulb draining golden sand reservoir with V-funnel vortex dimple!
        const upDepth = (1 - drain * 0.76) * 32 * em;
        for (let dy = 0; dy < upDepth; dy++) {
          const y = Math.round(neckNow - 3 - dy);
          const modelY = HEART_Y + (y - HEART_Y) / em;
          const rx = Math.max(0, Math.min(crystalRx(modelY) * em - 2.4, 3.4 + dy * 1.12));
          const ix = Math.floor(rx);
          for (let x = -ix; x <= ix; x++) {
            if (dy > upDepth - 2.8 && Math.abs(x) < (dy - (upDepth - 3.4)) * 2.2) continue;
            const col = dy > upDepth - 1.8
              ? (x < 0 ? WHITE : G[6])
              : x < -rx * 0.25 ? G[5] : x < rx * 0.35 ? G[4] : G[3];
            p.px(x, y, col);
          }
        }

        // Voluminous sparkling golden sand waterfall pouring down through the waist!
        if (ce > 0.25) {
          for (let y = Math.round(neckNow) - 2; y <= Math.min(-5, botNow - 2); y++) {
            const prog = (y - neckNow) / Math.max(12, botNow - neckNow);
            const spread = 0.7 + prog * 1.8;
            const h1 = ((y * 19 - Math.floor(t * 125)) % 7 + 7) % 7;
            if (h1 < 5) {
              const ox = ((h1 - 2) * 0.48) * spread;
              p.px(ox, y, h1 === 2 ? WHITE : h1 < 3 ? G[6] : G[5]);
              if (h1 === 1) p.px(-ox, y, G[4]);
            }
          }
          p.glow(0, neckNow, 16 * ce, G[5], 0.50 * ce);
          p.glow(0, (neckNow + botNow) * 0.5, 20 * ce, G[4], 0.34 * ce);
        }

        // Lower bulb growing golden sand mound around the character's feet
        const moundH = (3.5 + drain * 13.5) * em;
        for (let dy = 0; dy < moundH; dy++) {
          const y = Math.round(botNow - 2 - dy);
          const modelY = HEART_Y + (y - HEART_Y) / em;
          const rx = Math.min(crystalRx(modelY) * em - 2.2, (moundH - dy) * 2.5);
          const ix = Math.floor(rx);
          for (let x = -ix; x <= ix; x++) {
            p.blend(x, y, dy > moundH - 1.6 ? G[6] : x < 0 ? G[5] : G[3], 0.84 * ce);
          }
        }

        // Translucent crystal front bevels, double-wall sheen & crisp silhouette rims
        for (let y = topNow; y <= botNow; y++) {
          const modelY = HEART_Y + (y - HEART_Y) / em;
          const rx = crystalRx(modelY) * em;
          if (rx < 1) continue;
          p.dot(-rx, y, Gl[6], 0.96 * ce);
          p.dot(-rx + 1, y, Gl[4], 0.50 * ce);
          p.dot(rx, y, Gl[4], 0.88 * ce);
          if (rx > 10) {
            p.dot(-rx * 0.44, y, modelY < -92 || (modelY > -50 && modelY < -20) ? WHITE : Gl[5], 0.78 * ce);
            p.dot(rx * 0.44, y, Gl[3], 0.44 * ce);
          }
        }
        // Pinched glass waist collar & near-half bottom golden crown flush with crystal mouth
        const cw = crystalRx(HG_TOP) * em;
        band(p, 0, neckNow, 5.4 * em, 0.28, 1.7, 0.94 * ce, [G[3], G[5], G[6], WHITE], () => true, true);
        band(p, 0, botNow + 1, cw, 0.18, 2.8, 0.95 * ce, [G[2], G[4], G[6], WHITE], (g) => Math.sin(g) >= 0, false);
        if (ce > 0.6) {
          sparkle(p, -26 * em, topNow + 28 * em, 5 * ce, WHITE, Gl[5], 0.58);
          sparkle(p, 24 * em, botNow - 28 * em, 4 * ce, WHITE, G[5], 0.48);
        }

        // Branching stress cracks spiderwebbing right before shatter!
        if (t >= T_CRACK) {
          const cu = seg(t, T_CRACK, T_SHATTER);
          for (const pts of cracks) {
            const maxI = Math.max(1, Math.ceil((pts.length - 1) * cu));
            for (let i = 1; i <= maxI; i++) {
              p.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], cu > 0.50 ? WHITE : Gl[6], 0.98);
            }
          }
          flare(p, 0, HG_NECK, 26 * cu, cu, [Gl[3], Gl[5], G[5], WHITE]);
        }
      }

      // 3. Phase 2 & 3: Cataclysmic Crystal Shatter + Mid-Air Chrono-Freeze + Anti-Gravity Rewind!
      if (t >= T_SHATTER && t < T_BLOOM + 0.06) {
        const isFrozen = t >= T_FREEZE && t < T_REWIND;
        const isRewind = t >= T_REWIND;

        // Crisp Temporal Freeze Shockwave + 12-Tick Astral Chrono-Dial with Counter-Clockwise Rewinding Hands!
        if (t >= T_FREEZE && t < T_FREEZE + 0.22) {
          const fu = (t - T_FREEZE) / 0.22;
          const rF = 20 + 82 * ease.outQuart(fu);
          ringLight(p, 0, -62, rF, 7, Gl[5], (1 - fu) * 0.58, keepStageAboveFloor);
          drawGoldenDomeWave(p, -62, rF, 1.8 * (1 - fu), 0, 0, Gl, 1 - fu, (1 - fu) * 0.85);
        }
        if (t >= T_FREEZE && t < T_REWIND + 0.44) {
          const dialAl = t < T_REWIND
            ? smooth(T_FREEZE, T_FREEZE + 0.08, t) * 0.86
            : (1 - seg(t, T_REWIND, T_REWIND + 0.44)) * 0.86;
          const rewU = seg(t, T_REWIND - 0.06, T_REWIND + 0.42);
          const dialCy = -68, rDial = 66;
          p.ring(0, dialCy, rDial, 1, isRewind ? G[4] : Gl[3], dialAl * 0.52);
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * TAU - PI * 0.5;
            const r0 = k % 3 === 0 ? rDial - 6 : rDial - 3;
            p.line(
              Math.cos(a) * r0, dialCy + Math.sin(a) * r0,
              Math.cos(a) * (rDial + 1.5), Math.min(0, dialCy + Math.sin(a) * (rDial + 1.5)),
              k % 3 === 0 ? G[6] : Gl[5], dialAl
            );
          }
          // Hands locked frozen during T_FREEZE, then whipping counter-clockwise on rewind!
          const fastA = -PI * 0.30 - ease.inOutCubic(rewU) * TAU * 1.45;
          const slowA =  PI * 0.74 - ease.inOutCubic(rewU) * PI * 0.90;
          p.line(0, dialCy, Math.cos(fastA) * 52, dialCy + Math.sin(fastA) * 52, WHITE, dialAl * 0.96);
          p.line(0, dialCy, Math.cos(slowA) * 32, dialCy + Math.sin(slowA) * 32, G[5], dialAl * 0.90);
          sparkle(p, 0, dialCy, 5, WHITE, G[5], dialAl * 0.58);
        }

        // 54 Jagged Crystal Daggers & Splinters (with internal specular facet spine on hero shards!)
        for (const sh of shards) {
          if (sh.absorbed) continue;
          const sc = sh.scaleNow;
          const ca = Math.cos(sh.a) * sc, sa = Math.sin(sh.a) * sc, fk = Math.cos(sh.f);
          const wPts = sh.pts.map(([px, py]) => {
            const yy = py * fk;
            return [sh.x + px * ca - yy * sa, clamp(sh.y + px * sa + yy * ca, Y_MIN + 6, 2)];
          });
          const gMix = isRewind ? smooth(T_REWIND, T_REWIND + 0.18, t) : 0;
          if (sc > 0.28) {
            glassPoly(p, wPts, gMix > 0.5 ? G[5] : Gl[4], 0.30 + 0.18 * sh.lit);
          }
          for (let i = 0; i < wPts.length; i++) {
            const a0 = wPts[i], a1 = wPts[(i + 1) % wPts.length];
            p.line(a0[0], a0[1], a1[0], a1[1], i === 0 ? WHITE : gMix > 0.32 ? G[6] : Gl[5], 0.95);
          }
          // Internal specular facet ridge on large hero crystal daggers!
          if (sh.heroShard && sc > 0.45) {
            p.line(wPts[0][0], wPts[0][1], sh.x, clamp(sh.y, Y_MIN + 6, 2), WHITE, 0.72);
          }
          if (isFrozen && sh.lit > 0.68) p.px(Math.round(sh.x), Math.round(sh.y), WHITE);
          if (isRewind) p.glow(sh.x, sh.y, 5 * sc + 2.2, G[5], 0.36);
        }

        // 220 Luminous Golden Sand Grains & Cascading / Rewinding Golden Ribbons!
        for (const s of sands) {
          if (s.absorbed) continue;
          const trLen = s.trail.length;
          for (let j = 1; j < trLen; j++) {
            const p0 = s.trail[j - 1], p1 = s.trail[j];
            p.line(p0[0], p0[1], p1[0], p1[1], j < 3 ? G[6] : j < 6 ? G[5] : G[3], (1 - j / trLen) * 0.95);
          }
          const rx = Math.round(s.x), ry = Math.round(s.y);
          p.px(rx, ry, s.hero || isRewind ? WHITE : G[6]);
          if (s.big) {
            p.px(rx + 1, ry, G[5]);
            p.px(rx, ry + 1, G[4]);
          }
          if (s.hero) p.glow(s.x, s.y, 4.8, G[5], isFrozen ? 0.50 : 0.32);
        }

        // Explosive Shatter Flash + 18 Radial Crystal Fracture Rays ("轰然碎裂"!)
        if (t < T_SHATTER + 0.11) {
          const fk = 1 - (t - T_SHATTER) / 0.11;
          for (let k = 0; k < 18; k++) {
            const a = (k / 18) * TAU + ((k * 7) % 5) * 0.06;
            const rIn = 8 * (1 - fk * 0.5);
            const rOut = (k % 2 === 0 ? 78 : 50) * fk;
            const x0 = Math.cos(a) * rIn, y0 = HG_NECK + Math.sin(a) * rIn;
            const x1 = Math.cos(a) * rOut, y1 = Math.min(1, HG_NECK + Math.sin(a) * rOut);
            p.line(x0, y0, x1, y1, k % 2 === 0 ? WHITE : Gl[5], fk * 0.92);
          }
          flare(p, 0, HG_NECK, 58 * fk, fk, [Gl[3], G[4], G[6], WHITE]);
          flare(p, 0, -30, 32 * fk, fk * 0.85, [Gl[2], Gl[5], G[6], WHITE]);
        }
      }

      // 4. Phase 4: Volumetric 3D Golden Melt Ripples ("金沙融化进身体时的金色波纹扩散结果特效")
      for (const ev of rippleEvents) {
        const dtR = t - ev.t;
        if (dtR <= 0 || dtR >= ev.dur) continue;
        const u = dtR / ev.dur;
        const R3d = ev.maxR * ease.outQuart(u);

        // Near half of coupled floor golden ripple waves (tangent-locked to the 3D golden dome!)
        if (R3d > Math.abs(HEART_Y) + 2) {
          const rFloor = Math.sqrt(R3d * R3d - HEART_Y * HEART_Y);
          band(p, 0, 0, rFloor, 0.21, (ev.big ? 4.8 : 3.0) * (1 - u * 0.65), (1 - u) * 0.98, [G[2], G[4], G[6], WHITE], (g) => Math.sin(g) >= 0, u < 0.32);
          if (ev.big && rFloor > 26) {
            band(p, 0, 0, rFloor * 0.68, 0.21, 2.4 * (1 - u * 0.65), (1 - u) * 0.78, [G[2], G[4], G[5], G[6]], (g) => Math.sin(g) >= 0, false);
          }
        }

        // Near half of 3D horizontal body-level golden melt hoop!
        if (u < 0.72) {
          const hu = u / 0.72;
          const hr = 9 + (ev.big ? 54 : 32) * ease.outCubic(hu);
          band(p, 0, ev.hoopY, hr, 0.20, (ev.big ? 3.0 : 2.0) * (1 - hu * 0.6), (1 - hu) * 0.94, [G[3], G[5], G[6], WHITE], (g) => Math.sin(g) >= 0, hu < 0.35);
        }

        // Shaded 3-pixel golden dome wave (gentle liquid shimmer near body -> pure regal sphere as it expands!)
        const shimmer = 0.032 * (1 - u) * (1 - u);
        drawGoldenDomeWave(
          p, HEART_Y, R3d,
          (ev.big ? 3.5 : 2.3) * (1 - u * 0.72),
          shimmer,
          u * 14,
          G,
          1 - u * 2.2,
          1 - smooth(0.66, 1.0, u)
        );
        ringLight(p, 0, HEART_Y, R3d * 0.95, 8, G[5], (1 - u) * (ev.big ? 0.62 : 0.34), keepStageAboveFloor);

        // Shimmering molten golden sand-dust motes trailing inside the expanding main ripple crest!
        if (ev.big && u > 0.06 && u < 0.82) {
          const moteAl = (1 - smooth(0.45, 0.82, u)) * 0.88;
          for (let m = 0; m < 18; m++) {
            const ma = -PI * 0.06 - (m / 17) * PI * 0.88 + Math.sin(m * 3.7 + u * 6) * 0.04;
            const mr = R3d - 3 - ((m * 5) % 9);
            const mx = Math.cos(ma) * mr, my = HEART_Y + Math.sin(ma) * mr;
            if (my <= -1 && inStage(mx, my, 6)) {
              p.dot(mx, my, m % 3 === 0 ? WHITE : G[5], moteAl);
            }
          }
        }
      }

      if (t >= T_BLOOM && t < T_BLOOM + 0.30) {
        const bk = 1 - (t - T_BLOOM) / 0.30;
        flare(p, 0, HEART_Y, 44 * bk, bk, [G[2], G[4], G[6], WHITE]);
        sparkle(p, 0, -44, 12 * bk, WHITE, G[5], 0.75 * bk);
      }

      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
