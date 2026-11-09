// The lacquer fan's signature chain, written as ONE continuous effect: the fan bursts open, winds across his
// body into a horizontal scythe, and the emerald cyclone is thrown off the fan's face — tearing apart leaf by
// leaf as it dies on the target, before the fan clicks shut on the afterglow. Tornado volume and dissipation
// adapted from the nature/tornado recipe; crescent discipline after sword-slash & melee/_lib.
import { Particles, Lights, P, Rng, fit, sparkle, flare, band, clamp, smooth, lerp, seg, ease, rand, rng, cycle, tileNoise, mix, TAU, WHITE, READY } from "../../core/index.js";
import { swing, onSwing, smear, trace, glowAlong } from "../melee/_lib.js";
import { drawLeaf, drawRock, stoneShape } from "../nature/_lib.js";

const A = 0;                 // the opener starts now
const B = 0.58;              // the sweep ignites
const CY = 1.24;             // the cyclone is thrown
const FAN_SHUT = 2.11;       // the fan clicks shut on the burst's afterglow
const FINISH = 2.6;
const HIT_X = 118, HIT_Y = -27;
const SWEEP_T = 0.055;       // the sweep's edge completes the cut this long after it ignites
const SWEEP_HIT = B + SWEEP_T;
const COLLAPSE = (HIT_X - 16) / 146;  // local cyclone time: the fold begins exactly on arrival
const CL_D = COLLAPSE + 0.72;         // the cyclone's full local life — the teardown is a long
const CYC_HIT = CY + (HIT_X - 16) / 146;  // ≈ 1.94: it bursts on the target
const OPEN = 0, HIT_T = 0.1;
const PX = 9, PY = -23;      // the fan's pivot at his front hand
const AXIS = -1.32, HALF = 1.02, FAN_R = 38;

export const meta = {
  name: "Lacquer fan combo",
  desc: "The lacquer fan bursts open, scythes low and throws an emerald cyclone that bursts into a rain of leaves — one unbroken fan chain.",
  tags: ["move", "melee", "fan", "lacquer", "cyclone", "combo", "chinese", "one-shot"],
  size: [346, 188],
  origin: [173, 162],
  duration: 3.65,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#150507", "#2a090e", "#4a0f16", "#6f1620", "#9c1f26", "#cb3324", "#f0582c", "#ffb15e"],
    gold: ["#33200a", "#63410f", "#9c6f24", "#d1a03a", "#ffd84a", "#fff3b0"],
    ink: ["#070405", "#100a0d", "#1b1114", "#281c1f", "#352723", "#48362e"],
    jade: ["#03150d", "#052419", "#073323", "#0b4a30", "#11603f", "#177a4d", "#209552", "#2fb863", "#4ee082", "#8ff2a8", "#d6ffc8"],
    dust: ["#141a10", "#242e1c", "#3a4a2a", "#5a6c3c", "#7f9050"],
    leaves: ["#0e3a1e", "#1f5c2c", "#2f8a3e", "#56bd52", "#8fe06a", "#d4ffb2"],
    seed: 1,
  },
};

const GUARD = { ...READY, weapon: "handle", sa: -0.75, fx: 10, fy: -18, bx: 8, by: -20 };
const COIL = { ...GUARD, crouch: 6, lean: -3, turn: 0.7, fx: 1, fy: -27, sa: -2.05, bx: 4, by: -23, armsFront: true, ffx: 9, fbx: -9 };
const HIDE = { ...GUARD, crouch: 6, lean: -1, turn: 1.0, fx: 5, fy: -33, sa: -1.45, bx: -2, by: -27, armsFront: true };
const OPENP = { ...GUARD, crouch: 5, lean: 2, turn: 1.15, fx: PX, fy: PY, sa: -1.35, bx: -6, by: -24, ffx: 10, fbx: -10, ghost: 1 };
const OPEN_SETTLE = { ...OPENP, ghost: 0, lean: 1, crouch: 5 };
const REACH = { ...GUARD, crouch: 6, lean: -2, turn: 0.45, x: -5, fx: -6, fy: -27, sa: -2.3, bx: 7, by: -23, armsFront: true, ffx: 9, fbx: -9 };
const SWEEP = { ...GUARD, crouch: 4, lean: 5, turn: 0.6, x: 3, fx: 16, fy: -22, sa: 0.28, bx: -6, by: -22, ffx: 12, fbx: -8, armsFront: true, toeB: true, ghost: 1 };
const FOLLOW = { ...SWEEP, ghost: 0, lean: 7, crouch: 5, fx: 14, fy: -19, turn: 0.75 };
const RECOIL = { ...GUARD, crouch: 5, lean: 2, turn: 1.15, fx: 2, fy: -27, sa: -1.1, bx: -2, by: -25, armsFront: true };
const LAUNCH = { ...GUARD, crouch: 4, lean: 3, turn: 1.3, x: 1, fx: 14, fy: -25, sa: -0.42, bx: -5, by: -23, ffx: 11, fbx: -8, ghost: 1 };
const FOLLOW2 = { ...LAUNCH, ghost: 0, lean: 5, turn: 1.28, fx: 12, fy: -22 };
const SHUTP = { ...GUARD, crouch: 6, lean: 3, fx: 7, fy: -21, sa: -0.9, bx: 4, by: -19 };
const RELAX = { ...SHUTP, lean: 1, crouch: 4 };
const SETTLE = { ...GUARD, crouch: 3 };

export const act = {
  target: { x: HIT_X },
  poses: [
    [-0.58, GUARD],
    [-0.34, COIL],
    [-0.08, HIDE],
    [A, OPENP, "snap"],
    [0.16, OPEN_SETTLE],
    [0.4, REACH],
    [B + 0.075, SWEEP, "snap"],
    [B + 0.42, FOLLOW],
    [CY - 0.14, RECOIL],
    [CY, LAUNCH, "out"],
    [CY + 0.22, FOLLOW2],
    [FAN_SHUT - 0.09, FOLLOW2],
    [FAN_SHUT + 0.05, SHUTP, "snap"],
    [FAN_SHUT + 0.36, RELAX],
    [FINISH, SETTLE],
    [3.65, SETTLE],
  ],
  hits: [
    { t: HIT_T, stop: 0.16, shake: 0.26, amp: 3.6, push: 3.6, straw: 26, skin: "red", y: HIT_Y },
    { t: SWEEP_HIT, stop: 0.09, shake: 0.18, amp: 2.4, push: 2.6, straw: 16, y: -22 },
    { t: CYC_HIT, stop: 0.15, shake: 0.24, amp: 3.2, push: 3.4, straw: 24, skin: "poison", y: -18 },
  ],
  dust: [
    { t: 0.02, x: 6, n: 7, dir: 1 },
    { t: 0.02, x: -8, n: 5, dir: -1 },
    { t: SWEEP_HIT, x: 12, n: 7, dir: 1 },
    { t: CYC_HIT, x: 108, n: 10, dir: 1 },
  ],
};
const RIBS = Array.from({ length: 9 }, (_, k) => -HALF + (k * 2 * HALF) / 8);

// static fan-frame details for one seed: wet-lacquer beads on the black silk, mottle inside the red sun
const fanCache = new Map();
function fanDetails(seed) {
  let d = fanCache.get(seed);
  if (d) return d;
  const R = new Rng(seed * 7 + 3);
  const beads = Array.from({ length: 8 }, () => ({ u: R.range(FAN_R * 0.26, FAN_R * 0.9), a: R.range(-0.74, 0.74) }));
  const mottle = Array.from({ length: 7 }, () => {
    const a = R.range(0, TAU), rr = R.range(1.5, FAN_R * 0.27);
    return { du: Math.cos(a) * rr, dv: Math.sin(a) * rr };
  });
  const jag = Array.from({ length: 12 }, (_, k) => 0.66 + R.range(0.02, 0.52));
  fanCache.set(seed, (d = { beads, mottle, jag }));
  return d;
}

function drawFan(p, t, C, G, K, seed, shut = 1.34) {
  const openK = ease.outBack(clamp(t / 0.17), 2.1);
  const shutK = t < shut ? 0 : ease.inQuad(clamp((t - shut) / 0.12));
  const span = lerp(0.04, HALF, openK) * (1 - shutK) + 0.04 * shutK;
  const Rr = FAN_R * (0.86 + 0.14 * Math.min(1, openK));
  const ax = AXIS + Math.sin(t * 33) * Math.exp(-t * 4.6) * 0.02;
  const c = Math.cos(ax), s = Math.sin(ax);
  const hot = t < 0.05;
  const u0 = FAN_R * 0.58, sunR = FAN_R * 0.335;
  const { beads, mottle } = fanDetails(seed);
  p.shade(Math.floor(PX - Rr - 2), Math.floor(PY - Rr - 2), Math.ceil(PX + Rr + 2), Math.ceil(PY + Rr + 2), (x, y, out) => {
    const dx = x + 0.5 - PX, dy = y + 0.5 - PY;
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    if (u <= 0.4 || u > Rr + 0.45) return;
    const ang = Math.atan2(v, u), aang = Math.abs(ang);
    if (aang > span + 0.008) return;
    const dSun = Math.hypot(u - u0, v);
    // a gold rib under this pixel?
    let rib = false;
    for (const ra of RIBS) {
      if (Math.abs(ra) > span + 0.02) continue;
      if (Math.abs(v - Math.tan(ra) * u) < 0.7 && u > 4.3) { rib = true; break; }
    }
    const edgeRib = aang > span - 0.07 && u > 4.3;
    let col;
    if (dSun < sunR) {
      // blood-red lacquer sun with a wet gloss crescent high on its left cheek
      const q = dSun / sunR;
      col = q < 0.34 ? C[6] : q < 0.62 ? C[5] : q < 0.85 ? C[4] : C[3];
      const gq = Math.atan2(v, u - u0);
      if (dSun > sunR * 0.5 && dSun < sunR * 0.78 && Math.cos(gq - 3.85) > 0.55) col = C[7];
    } else {
      // jet-black wet lacquer: hard steps, one broad specular streak up left,
      // ember bleed from the red sun soaking into the dark half so it never reads as a void
      const sh = (v * 0.82 - u * 0.38) / FAN_R;
      if (sh > 0.155) col = sh > 0.3 ? K[4] : K[5];
      else {
        const b = clamp(1 - (dSun - sunR) / (FAN_R * 1.05), 0, 1);
        col = b > 0.62 ? C[3] : b > 0.3 ? (sh > 0.02 ? K[4] : C[2]) : sh > 0.02 ? K[4] : sh > -0.3 ? K[3] : K[2];
        if (aang > span - 0.18 && sh < 0.02) col = C[3];
      }
      if (dSun < sunR * 1.5) col = sh > 0.02 ? K[4] : K[3];
    }
    if (hot) col = dSun < sunR ? (dSun < sunR * 0.6 ? WHITE : G[5]) : G[4];
    // thin gold ring hugging the sun
    if (Math.abs(dSun - sunR) < 0.72) col = hot ? WHITE : G[3];
    // outer rim: double line of gold
    if (u > Rr - 2.6 && u <= Rr - 2.0) col = hot ? G[5] : G[2];
    else if (u > Rr - 2.0) col = hot ? WHITE : u > Rr - 0.85 ? G[5] : G[3];
    if (rib || edgeRib) col = hot ? WHITE : u > FAN_R * 0.7 ? G[4] : G[3];
    // the brass hub
    if (u < 4.3) col = u < 1.5 ? (hot ? WHITE : G[5]) : u < 2.7 ? G[3] : u < 3.6 ? G[4] : K[0];
    out.c = col;
    out.a = 1;
  });
  // black mottle inside the red sun
  const axv = [PX + c * u0, PY + s * u0], pv = [-s, c];
  for (const m of mottle) {
    const mx = axv[0] + c * m.du + pv[0] * m.dv, my = axv[1] + s * m.du + pv[1] * m.dv;
    const dxm = mx - PX, dym = my - PY, um = dxm * c + dym * s, vm = -dxm * s + dym * c;
    if (um <= 0 || um > Rr) continue;
    if (Math.abs(Math.atan2(vm, um)) > span) continue;
    p.dot(mx, my, K[1], 0.9);
  }
  // wet-lacquer beads scattered on the black field
  for (const b of beads) {
    if (Math.abs(b.a) > span) continue;
    const bx = PX + b.u * Math.cos(ax + b.a), by = PY + b.u * Math.sin(ax + b.a);
    p.dot(bx, by, K[5]);
    p.dot(bx - 0.6, by - 0.6, WHITE, 0.62);
  }
  // the red tassel hanging off the pivot: it kicks out when the fan opens or shuts
  if (shutK < 1) {
    const kick = Math.exp(-Math.abs(t - OPEN) * 2.1) * 0.55 + Math.exp(-Math.abs(t - (shut ?? 1.34)) * 2.6) * 0.7;
    const sway = Math.sin(t * 12.5 + 0.8) * (0.16 + kick) + kick * 0.5;
    const bx = PX + 1.5, by = PY + 2.5;
    p.dot(bx, by, G[3]);
    p.dot(bx + 1, by, G[1]);
    for (const [off, col] of [[-1.4, C[3]], [0, C[5]], [1.4, C[4]]]) {
      const a = Math.PI / 2 + sway + off * 0.16;
      p.line(bx, by + 1, bx + Math.cos(a) * 9, by + 1 + Math.sin(a) * 9, col, 1);
    }
    p.dot(bx + Math.cos(Math.PI / 2 + sway) * 9, by + 1 + Math.sin(Math.PI / 2 + sway) * 9, C[6]);
  }
  // glints running along the rim as it opens
  if (t > 0.05 && t < 0.55) {
    const q = (t - 0.05) / 0.5;
    for (const a of [-0.62, 0.2, 0.78]) {
      if (Math.abs(a) > span) continue;
      const gx = PX + Rr * Math.cos(ax + a), gy = PY + Rr * Math.sin(ax + a);
      p.dot(gx, gy, WHITE, (1 - q) * 0.85);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8), G = fit(o.gold, 6), K = fit(o.ink, 6);
  const J = fit(o.jade, 11), Dd = fit(o.dust, 5), L = fit(o.leaves, 6);
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  const lights = new Lights();
  const rockShape = stoneShape(R, 5);

  // ==== cyclone motion: position by time; the funnel spins down as it dies ====
  const cxAt = (tt) => (tt < CY ? 16 : Math.min(HIT_X, 16 + (tt - CY) * 146));

  // ==== shared fx state ====
  const drops = [];   // airborne lacquer droplets
  const splats = [];  // landed lacquer on the floor
  const flakes = [];  // black lacquer petals sifting while the fan is open
  const litter = [];  // leaf speckles left in the cyclone's wake
  const hist = [];    // recent cyclone x for afterimages
  let t = 0, opened = false, hitFx = false, shutFx = false, sweepFx = false;
  let cycBursted = false, flakeAcc = 0, dustAcc = 0, auraAcc = 1, trailAcc = 0;
  let cySpin = 0, velS = 0, lastCx = 16;
  // the jagged splat that blooms on the target: static pattern for this seed
  const sd = fanDetails(o.seed);
  const jagOut = sd.jag;

  // ==== the sweep: a crescent swinging across his front at waist height ====
  const SWING = swing({ cx: 5, cy: -27, R: 46, sy: 0.42, rot: -0.06, a0: Math.PI * 0.96, dir: -1, k: 0.06, span: Math.PI * 0.86 });
  const ECHO = { ...SWING, R: 38, a0: Math.PI * 0.9, span: Math.PI * 0.68 };
  const tip = onSwing(SWING, SWING.R, SWING.span);

  const drawSmear = (p, s, lag, W0, ramp, whiteRim) => {
    const u = t - B - lag;
    if (u < 0) return;
    const span = s.span, sweep = SWEEP_T, hold = 0.06, trail = 0.3, life = sweep + hold + trail;
    if (u >= life) return;
    const head = ease.outExpo(clamp(u / sweep));
    const tail = smooth(sweep + hold, life, u) * 0.6;
    const age = clamp(u / life);
    const U = span * head, T = span * tail;
    if (U - T < 0.02) return;
    const W = W0 * (1 - age * 0.6);
    const n = ramp.length;
    smear(p, s, T, U, W, (uu, r, out) => {
      const v = clamp((uu - T) / Math.max(0.01, U - T), 0, 1);
      const w = W * Math.pow(Math.sin(Math.PI * Math.pow(clamp(v, 0.001, 0.999), 1.15)), 0.62);
      if (w < 0.4) return;
      const dr = s.R - r;
      if (dr < 0 || dr > w) return;
      const q = dr / w;
      if (whiteRim && dr < 1.7 && age < 0.55 && v > 0.14) {
        out.c = age < 0.24 ? WHITE : ramp[n - 2];
        out.a = 1;
        return;
      }
      if (q > 0.66) {
        out.c = q > 0.85 ? C[2] : v < 0.35 ? C[3] : C[4];
        out.a = v < 0.3 ? 0.92 : 1;
        return;
      }
      const ci = clamp(Math.round(q * (n - 1) * 0.74 + age * 2.7 + (1 - v) * 1.15 + 0.35), 0, n - 1);
      out.c = ramp[n - 1 - ci];
      out.a = age > 0.58 && v < 0.82 && ((Math.floor(uu * 26) + Math.floor(r * 1.7)) & 1) ? 0.55 : 1;
    }, 1);
    if (t - B > sweep * 0.6)
      trace(p, s, s.R - 0.5, 0, U, ramp[3], (uu) => 0.85 * (1 - clamp((u - sweep - hold) / (trail + 0.2))) * (0.4 + 0.6 * (uu / span)), 1);
    if (t - B < 0.17) glowAlong(p, s, s.R - 5, 0, U, 12, ramp[4], (uu) => 0.34 * (1 - (t - B) / 0.17) * (0.35 + uu / span), 1);
  };

  // ==== the fan: burst, splatter, shut (ported from melee/lacquer-fan, target at his side) ====
  const spawnBurst = () => {
    const Rd = new Rng(o.seed * 1013 + 77);
    for (let i = 0; i < 46; i++) {
      const a = Rd.range(0, TAU);
      const r0 = FAN_R * Rd.range(0.45, 0.95);
      const sp = Rd.range(78, 200);
      const kind = Rd.next();
      drops.push({
        x: PX + Math.cos(a) * r0, y: PY + Math.sin(a) * r0 * 0.92,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 26,
        r: Rd.range(1.0, 2.7), kind,
        delay: Rd.range(0, 0.05), seed: Rd.next() * 997,
      });
    }
    for (let i = 0; i < 5; i++) {
      const a = Rd.range(0, TAU);
      drops.push({
        x: PX + Math.cos(a) * 20, y: PY + Math.sin(a) * 18,
        vx: Math.cos(a) * Rd.range(46, 88), vy: Math.sin(a) * Rd.range(46, 82) - 18,
        r: Rd.range(2.6, 3.5), kind: Rd.next() < 0.5 ? 0.1 : 0.62,
        delay: Rd.range(0, 0.03), seed: Rd.next() * 977,
      });
    }
    for (let i = 0; i < 12; i++) {
      const a = Rd.range(-1.15, 1.15);
      const sp = Rd.range(120, 275);
      ps.spawn(P.SPARK, PX + Math.cos(a) * 20, PY + Math.sin(a) * 18, Math.cos(a) * sp, Math.sin(a) * sp * 0.72 - 46, Rd.range(0.16, 0.36), G[4]);
    }
    for (let i = 0; i < 8; i++) {
      const a = Rd.range(0, TAU);
      ps.spawn(P.GRIT, PX + Math.cos(a) * 14, PY + Math.sin(a) * 12, Math.cos(a) * Rd.range(90, 190), Math.sin(a) * Rd.range(90, 170) - 30, Rd.range(0.5, 0.9), i % 3 ? K[1] : G[2], i % 4 === 0 ? 2 : 1);
    }
  };
  const spawnHitSplatter = () => {
    const Rd = new Rng(o.seed * 733 + 29);
    for (let i = 0; i < 9; i++) {
      const a = Rd.range(-0.9, 0.9) + (Rd.next() < 0.5 ? 0 : Math.PI);
      const sp = Rd.range(70, 175);
      drops.push({
        x: HIT_X, y: HIT_Y,
        vx: Math.cos(a) * sp + 26, vy: Math.sin(a) * sp - 48,
        r: Rd.range(0.8, 1.8), kind: Rd.next() < 0.55 ? 0.2 : 0.6,
        delay: Rd.range(0, 0.03), seed: Rd.next() * 991,
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = Rd.range(0, TAU);
      ps.spawn(P.SPARK, HIT_X, HIT_Y, Math.cos(a) * Rd.range(80, 220), Math.sin(a) * Rd.range(90, 230) - 30, Rd.range(0.15, 0.32), WHITE);
    }
  };
  const spawnSweepFx = () => {
    for (let i = 0; i < 11; i++) {
      const a = R.range(-0.55, 0.55), sp = R.range(140, 330);
      ps.spawn(P.SPARK, tip[0], tip[1], Math.cos(a) * sp, Math.sin(a) * sp * 0.7 - 30, R.range(0.14, 0.34), G[4]);
    }
    for (let i = 0; i < 13; i++) {
      const a = R.range(-1.1, 0.9), sp = R.range(45, 150);
      ps.spawn(P.MOTE, tip[0] - R.range(0, 34), tip[1] + R.range(-4, 4), Math.cos(a) * sp, Math.sin(a) * sp - 12, R.range(0.28, 0.55), i % 4 === 0 ? C[4] : G[2 + (i % 2)], 0.6);
    }
    for (let i = 0; i < 3; i++) ps.spawn(P.GRIT, tip[0] - 6, tip[1], R.range(60, 160), R.range(-90, -20), R.range(0.4, 0.7), i ? G[2] : C[2], 1);
    lights.add(tip[0], tip[1], 34, G[4], 0.85, 0.32);
    lights.add(5, -21, 44, C[4], 0.4, 0.4);
  };
  const spawnCycloneBurst = () => {
    for (let i = 0; i < 20; i++) {
      const a = R.range(0, TAU), sp = R.range(35, 130);
      ps.spawn(P.MOTE, HIT_X, -15 + R.range(-9, 6), Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 26, R.range(0.14, 0.26), i % 5 === 0 ? G[3] : J[5 + R.int(0, 3)], 0.85);
    }
    for (let i = 0; i < 6; i++) ps.spawn(P.GRIT, HIT_X, -16, R.range(-55, 55), R.range(-125, -40), R.range(0.1, 0.19), i % 2 ? J[6] : G[3], 1);
    lights.add(HIT_X, -18, 42, J[6], 0.9, 0.34);
    lights.add(HIT_X, -22, 19, WHITE, 0.55, 0.2);
  };
  const cyx = (k) => (k < CY ? 16 : Math.min(HIT_X, 16 + (k - CY) * 146));
  // ==== the cyclone, ported into this file: a travelling funnel that dissipates leaf by leaf ====
  const SY = 0.3;
  const collapseK = () => clamp(seg(t - CY, COLLAPSE, COLLAPSE + 0.22));
  const growK = () => 0.35 + 0.65 * smooth(0, 0.16, t - CY);
  const shearK = () => clamp(velS * 0.0078, 0, 3.6);
  const killK = () => 1 - smooth(CL_D - 0.11, CL_D - 0.008, t - CY);
  // the funnel tears apart from the top down, each height peeling away in turn
  const disK = (v) => 1 - smooth(COLLAPSE + 0.14, CL_D - 0.02, t - CY - (1 - v) * 0.22);
  const geo = (k) => {
    const H = 54 * (1 - 0.18 * k), ph = cySpin;
    const shear = shearK(), grow = growK();
    return {
      H,
      ph,
      ax: (u) => 5.2 * Math.sin(ph - 2.5 * u) * (0.22 + 0.78 * u) + 2 * Math.sin(2 * ph + 1.1 - 4.3 * u) * u - shear * u * u,
      rad: (u) => (2.4 + 8.8 * Math.pow(u, 1.42) + 3.6 * Math.pow(smooth(0.72, 1, u), 2)) * grow * (1 - k * 0.72) + k * 4.6,
    };
  };

  const body = (p, g, ox, k, kill) => {
    for (let y = -Math.ceil(g.H) + 1; y <= 0; y++) {
      const u = -y / g.H, cx = g.ax(u) + ox, r = g.rad(u);
      if (r < 0.7) continue;
      const fade = Math.min(1, u * 8 + 0.3) * (1 - smooth(0.93, 1.06, u) * 0.6) * disK(u) * kill;
      if (fade <= 0.01) continue;
      const K2 = 2 + (rand(y, o.seed) < 0.4 ? 1 : 0), rot = (g.ph * K2) / 3.2 + u * 4.6;
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const c = (x + 0.5 - cx) / r;
        if (Math.abs(c) > 1) continue;
        const n = tileNoise(((Math.acos(clamp(c, -1, 1)) + rot) * 6) / TAU, y * 0.34, 6, 0, o.seed), v = -c * 0.55 + 0.15 + n * 0.58;
        let col = v > 0.55 ? J[8] : v > 0.22 ? J[6] : v > -0.02 ? J[5] : v > -0.35 ? J[3] : J[2];
        if (u < 0.3) col = mix(col, Dd[v > 0.3 ? 3 : v > -0.2 ? 2 : 1], 0.72 * (1 - u / 0.3));
        p.blend(x, y, col, (0.17 + 0.38 * Math.sqrt(1 - c * c)) * fade);
      }
    }
  };

  const bands = (p, g, ox, seed, back, kill) => {
    for (let j = 0; j < 34; j++) {
      const Rj = rng(seed, j), u = (j + Rj.range(0.15, 0.85)) / 34;
      if (u > 0.97) continue;
      const Kk = Rj.int(2, 4), span = Rj.range(0.7, 2.2), lvl = Rj.next();
      const fade = disK(u) * kill;
      if (fade <= 0.02) continue;
      const cx = g.ax(u), r = g.rad(u) * Rj.range(1.02, 1.14), y0 = -u * g.H;
      const head = Rj.range(0, TAU) + g.ph * Kk * 0.62;
      for (let s = 0; s <= span; s += 0.5 / Math.max(2, r)) {
        const th = head - s, sn = Math.sin(th);
        if ((sn > 0) === back) continue;
        const kk = s / span, x = cx + r * Math.cos(th), y = y0 + r * SY * sn, lit = Math.cos(th) < 0.25;
        let i = lvl < 0.16 ? 3 : kk < 0.16 && lvl > 0.5 ? 10 : kk < 0.45 ? (lit ? 8 : 6) : lit ? 6 : 4;
        if (back) i = Math.max(1, i - 3);
        const a = (kk < 0.5 ? 1 : 2.4 * (1 - kk)) * (back ? 0.7 : 1) * fade;
        if (kk < 0.5) p.dot(x + ox, y, J[i], a); else p.blend(x + ox, y, J[i], a * 0.62);
      }
      if (!back && lvl > 0.55 && Math.sin(head) > 0.35) {
        const hx = cx + r * Math.cos(head) + ox, hy = y0 + r * SY * Math.sin(head);
        p.dot(hx, hy, WHITE, fade);
        p.glow(hx, hy, 4, J[7], 0.35 * fade);
      }
    }
  };

  const mouth = (p, g, ox, seed, back, kill, flash) => {
    const cx = g.ax(1) + ox, r = g.rad(1), y0 = -g.H - 2, fadeTop = disK(1) * kill, L2 = (c) => mix(c, J[10], flash * 0.55);
    if (fadeTop <= 0.015) return;
    if (!back) {
      p.ellipse(cx, y0 + 0.5, r, r * 0.34, "#020e08", 0.95 * fadeTop);
      for (let a = 0; a < TAU; a += TAU / 12) {
        const x = cx + Math.cos(a) * r, y = y0 + 0.5 + Math.sin(a) * r * 0.34;
        const hot = Math.sin(a * 2 + g.ph * 2.2) > 0.35;
        p.dot(x, y, L2(hot ? J[8] : J[6]), fadeTop);
      }
      if (flash > 0.05) p.glow(cx, y0, 16 + flash * 10, J[8], 0.4 * flash * fadeTop);
    }
    for (let j = 0; j < 9; j++) {
      const Rj = rng(seed + 2, j), rr = r * Rj.range(0.35, 1.12), Kk = Rj.int(1, 2);
      const span = Rj.range(1.3, 2.5), head = Rj.range(0, TAU) + g.ph * Kk * 0.5;
      const th0 = Rj.range(3.2, 6), lift = Rj.range(-3.5, 2) - (1 - rr / (r * 1.12)) * 4;
      for (let s2 = 0; s2 <= span; s2 += 0.6 / rr) {
        const th = head - s2, sn = Math.sin(th);
        if ((sn > 0) === back) continue;
        const kk = s2 / span, th2 = th0 * Math.sin(Math.PI * Math.pow(1 - kk, 0.7));
        const x = cx + rr * Math.cos(th), y = y0 + lift + rr * SY * sn;
        const T = Math.max(1.5, Math.round(th2)), d = back ? 2 : 0, lit = Math.cos(th) < 0.3;
        for (let i = 0; i < T; i++) {
          const c = i === 0 ? L2(J[(lit ? 9 : 7) - d]) : i === T - 1 && T > 2 ? J[2] : L2(J[(i === 1 ? 6 : 4) - d]);
          p.blend(x, y - T / 2 + i, c, (0.6 + 0.35 * (1 - kk)) * (back ? 0.65 : 1) * fadeTop);
        }
      }
    }
  };

  const debris = (p, g, ox, seed, back, kill) => {
    cycle(t - CY, CL_D, 15, seed, (q) => q.range(0.4, 0.95), (age, life, R2, i) => {
      const kk = age / life, u = lerp(0.04, 0.94, Math.pow(kk, 0.8));
      const th = R2.range(0, TAU) + R2.range(2.2, 3.6) * TAU * kk, sn = Math.sin(th);
      if ((sn > 0) === back) return;
      const fling = smooth(0.7, 1, kk);
      const fade = disK(u) * kill;
      if (fade <= 0.02) return;
      const rr = Math.min(26, g.rad(u) * (1.1 + fling * 0.9) + R2.range(1.5, 5));
      const x = g.ax(u) + ox + rr * Math.cos(th), y = -u * g.H + rr * SY * sn - fling * 7;
      const a = Math.min(1, kk * 7) * (1 - smooth(0.8, 1, kk)) * fade;
      const kind = R2.next(), spin = R2.range(-16, 16) * age, dk = back ? 1 : 0;
      if (kind < 0.56) {
        if (R2.next() < 0.18) drawLeaf(p, x, y, R2.range(4.5, 7), R2.range(1.5, 2.3), spin, age * R2.range(5, 11), [G[0], G[2], G[3 + dk], G[4]], a);
        else drawLeaf(p, x, y, R2.range(4.5, 7), R2.range(1.5, 2.3), spin, age * R2.range(5, 11), [L[0], L[1 + dk], L[2 + dk], L[3 + dk]], a);
      } else if (kind < 0.74) {
        const ca = Math.cos(spin) * 2.2, sa = Math.sin(spin) * 2.2;
        p.line(x - ca, y - sa, x + ca, y + sa, back ? L[0] : L[1], a);
        p.dot(x + ca, y + sa, L[2 + dk], a);
      } else {
        drawRock(p, x, y, R2.range(1.3, 2.1), spin, rockShape, back ? [Dd[1], Dd[2], Dd[3], Dd[4]] : [Dd[0], Dd[1], Dd[2], Dd[3]], a);
      }
    });
  };

  const skirt = (p, g, ox, seed, back, kill) => {
    const skirtFade = (1 - smooth(0.8, 1.18, t - CY)) * kill;
    if (skirtFade <= 0.02) return;
    cycle(t - CY, CL_D, 17, seed + 3, (q) => q.range(0.32, 0.7), (age, life, R2) => {
      const kk = age / life, th = R2.range(0, TAU) + R2.range(5, 9) * age, sn = Math.sin(th);
      if ((sn > 0) === back) return;
      const rr = 3.5 + kk * R2.range(9, 17), x = g.ax(0) + ox + rr * Math.cos(th), y = -1.2 - kk * R2.range(3, 11) + rr * 0.3 * sn;
      const s = R2.range(2.2, 4.4) * (0.6 + 0.8 * kk), a = Math.min(1, kk * 6) * (1 - kk) * 0.55 * skirtFade;
      p.disc(x, y + s * 0.2, s, Dd[back ? 1 : 2], a);
      p.disc(x - s * 0.2, y - s * 0.3, s * 0.55, Dd[back ? 2 : 3], a * 0.8);
    });
    for (let j = 0; j < 5; j++) {
      const Rj = rng(seed + 7, j), rr = Rj.range(6, 15), th0 = Rj.range(0, TAU) + g.ph * 1.6, span = Rj.range(0.6, 1.2);
      for (let s = 0; s < span; s += 0.5 / rr) {
        const th = th0 - s;
        if ((Math.sin(th) > 0) === back) continue;
        p.dot(g.ax(0) + ox + rr * Math.cos(th), 0.5 + rr * 0.18 * Math.sin(th), Dd[s < span * 0.4 ? 3 : 2], (1 - s / span) * 0.9 * skirtFade);
      }
    }
  };

  // the eruption: a fountain of leaves arcing out and raining back
  const fountain = (p, seed, ox, kill) => {
    const age = t - CY - COLLAPSE;
    if (age <= 0) return;
    for (let j = 0; j < 16; j++) {
      const R2 = rng(seed + 21, j);
      const ang = R2.range(0, Math.PI), sp = R2.range(24, 66);
      const x = ox + Math.cos(ang) * sp * age, vy = Math.sin(ang) * sp;
      let y = -16 - vy * age + 250 * age * age;
      if (y > -0.5) y = -0.5;
      const a = clamp(1 - age / (CL_D - COLLAPSE + 0.04), 0, 1) * kill;
      if (a <= 0.02) continue;
      const pal = R2.next() < 0.2 ? [G[0], G[2], G[3], G[4]] : [L[0], L[2], L[3], L[4]];
      drawLeaf(p, x, y, R2.range(4, 6.5), 1.5, R2.range(-7, 7) * age * 3, age * 9, pal, a);
    }
  };

  // the dissipation itself: strands of wind tearing off the dying funnel and blowing apart
  const wisps = (p, g, ox, kill) => {
    const tc = t - CY, age0 = tc - COLLAPSE;
    if (age0 <= 0) return;
    for (let j = 0; j < 22; j++) {
      const R2 = rng(o.seed + 31, j);
      const delay = R2.range(0.0, 0.3), life = R2.range(0.4, 0.78);
      const age = age0 - delay;
      if (age <= 0 || age >= life) continue;
      const q = age / life;
      const v0 = 0.5 + 0.5 * R2.next() * R2.next();        // detach from the upper half
      const dirX = R2.range(-1, 1), up = R2.range(4, 13);
      const x = ox + g.ax(v0) + dirX * (4 + 14 * q) + R2.range(-1.5, 1.5) * q * 5;
      const y = -v0 * g.H - up * age - 3 * q * q;
      const s = R2.range(1.5, 4.6) * (1 - q * 0.6);
      const a = Math.pow(Math.sin(Math.PI * q), 1.1) * kill * 0.7;
      if (a <= 0.02) continue;
      p.disc(x, y, s, Dd[2], a * 0.62);
      p.dot(x + R2.range(-1.2, 1.2), y + R2.range(-1.2, 1.2), J[4 + (j % 2)], a * 0.85);
      p.dot(x + R2.range(-1.2, 1.2), y + R2.range(-1.2, 1.2), J[6], a * 0.4);
      if (R2.next() < 0.3) p.dot(x, y - 0.5, G[3], a * 0.7);
      if (R2.next() < 0.5) p.line(x - dirX * s * 1.7, y + 0.5, x + dirX * s * 0.6, y - 1, J[3], a * 0.55);
    }
  };
  return {
    update(dt) {
      t += dt;
      const tc = t - CY;
      // cyclone: spins down as it unravels, tracks velocity for the lean
      if (tc > 0) {
        cySpin += dt * (11.5 * (1 - 0.55 * smooth(COLLAPSE, COLLAPSE + 0.5, tc)));
        const cx = cxAt(t);
        const vx = (cx - lastCx) / Math.max(dt, 1e-4);
        lastCx = cx;
        velS += (Math.min(340, Math.abs(vx)) - velS) * Math.min(1, dt * 4.5);
        hist.push(cx);
        if (hist.length > 9) hist.shift();
        auraAcc += dt;
        if (tc < COLLAPSE && auraAcc >= 0.08) { auraAcc = 0; lights.add(cx, -24, 26, J[6], 0.3, 0.15); }
        dustAcc += dt;
        if (tc < COLLAPSE + 0.12 && dustAcc >= 0.05) {
          dustAcc = 0;
          ps.spawn(P.MOTE, cx + R.range(-4, 5), 0, R.range(-30, 30), R.range(-38, -8), R.range(0.2, 0.36), Dd[2 + R.int(0, 2)], 0.6);
        }
        trailAcc += dt;
        if (tc < CL_D - 0.2 && trailAcc >= 0.04 && litter.length < 46) {
          trailAcc = 0;
          litter.push({ x: cx + R.range(-7, 6), c: R.next() < 0.16 ? G[3] : L[2 + R.int(0, 2)], a: R.range(0.4, 0.85) });
        }
        if (!cycBursted && tc >= COLLAPSE) { cycBursted = true; spawnCycloneBurst(); }
      }
      // sweep: the edge completes the cut
      if (!sweepFx && t >= SWEEP_HIT) { sweepFx = true; spawnSweepFx(); }
      // fan: open, splatter, shut
      if (!opened && t >= OPEN) {
        opened = true;
        spawnBurst();
        lights.add(PX, PY - 6, 68, C[5], 0.72, 0.5);
        lights.add(PX, PY - 8, 26, G[4], 1.0, 0.27);
      }
      if (!hitFx && t >= HIT_T) {
        hitFx = true;
        spawnHitSplatter();
        lights.add(HIT_X, HIT_Y, 52, C[5], 0.78, 0.42);
        lights.add(HIT_X, HIT_Y, 19, WHITE, 0.9, 0.15);
      }
      if (!shutFx && t >= FAN_SHUT) {
        shutFx = true;
        lights.add(PX, PY, 15, G[4], 0.6, 0.2);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.55;
          ps.spawn(P.SPARK, PX, PY, Math.cos(a) * 70, Math.sin(a) * 70, 0.22, G[4]);
        }
      }
      // lacquer droplets arc down and burst into floor splats
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        if (d.delay > 0) { d.delay -= dt; continue; }
        d.vy += 640 * dt;
        d.vx -= d.vx * 0.9 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.y >= 0) {
          splats.push({ x: d.x, r: d.r * (1.1 + Math.min(1.05, Math.hypot(d.vx, d.vy) / 260)), red: d.kind < 0.45, die: t + 0.95 + (d.seed % 1) * 0.35, seed: d.seed });
          if ((d.seed | 0) % 3 === 0) splats.push({ x: d.x + Math.sign(d.vx || 1) * d.r * 2.2, r: d.r * 0.55, red: d.kind >= 0.45 && d.kind < 0.8, die: t + 0.8, seed: d.seed + 3 });
          ps.spawn(P.DUST, d.x, -1, d.vx * 0.1, -14, 0.38, K[3], 1);
          drops.splice(i, 1);
          continue;
        }
        if (d.y < -156 || d.x < -146 || d.x > HIT_X + 40) drops.splice(i, 1);
      }
      // black lacquer petals sifting while the fan is open
      if (t > 0.3 && t < 1.75) {
        flakeAcc += dt * 19;
        while (flakeAcc >= 1) {
          flakeAcc -= 1;
          const Rf = new Rng((o.seed * 31 + ((t * 97) | 0) * 7 + flakeAcc * 1000) | 0);
          if (flakes.length < 42) flakes.push({ x: Rf.range(-96, 112), y: -118 - Rf.range(0, 30), vy: 22 + Rf.range(0, 18), ph: Rf.range(0, TAU), f: 0.9 + Rf.range(0, 1.4), age: 0, gold: Rf.next() < 0.14 });
        }
      }
      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i];
        f.age += dt;
        f.y += f.vy * dt;
        f.x += Math.sin(f.age * f.f * 2 + f.ph) * 7.5 * dt;
        if (f.y >= -0.5 || f.age > 3.4) flakes.splice(i, 1);
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const tt = t, tc = tt - CY;
      // the air itself darkens around the opening fan
      if (tt < 0.62) {
        const q = tt / 0.62;
        p.disc(PX, PY - 6, 30 + ease.outQuart(q) * 12, K[0], 0.25 * (1 - q));
      }
      // the shockwave laid onto the floor, far half behind him
      const fq = seg(tt, OPEN, OPEN + 0.58);
      if (tt >= OPEN && fq < 1) {
        const r = 12 + ease.outQuart(fq) * 88, th = Math.max(0.8, 3.6 * (1 - fq)), k = 1 - smooth(0.42, 1, fq);
        band(p, 2, 0.5, r, 0.17, th, k, [K[0], K[1], G[2], G[4]], (g) => Math.sin(g) < 0, fq < 0.2);
      }
      // glossy lacquer splats welded to the floor
      const splatFade = 1 - smooth(1.55, 2.02, tt);
      for (const s of splats) {
        const fade = Math.min(clamp((s.die - tt) / 0.38), splatFade);
        if (fade <= 0.03) continue;
        const rx = s.r * 1.75, ry = Math.max(0.8, rx * 0.36);
        const rim = s.red ? C[1] : G[1], core = s.red ? C[4] : K[2], hot = s.red ? C[5] : K[4];
        p.ellipse(s.x, 1.15, rx + 0.9, ry + 0.55, rim, fade);
        p.ellipse(s.x, 1.15, rx, ry, core, fade);
        p.ellipse(s.x - rx * 0.22, 0.95, rx * 0.48, ry * 0.52, hot, fade * 0.9);
        p.dot(s.x - rx * 0.42, 0.55, WHITE, 0.7 * fade);
        const dripDir = (s.seed % 1) < 0.5 ? -1 : 1;
        p.line(s.x + dripDir * rx * 0.4, 1.55, s.x + dripDir * (rx * 0.4 + 2 + s.r), 1.9, core, fade * 0.9);
      }
      // a warm pool at his feet while the fan is open
      if (tt > 0 && tt < FAN_SHUT) p.glow(PX, 0.5, 36, G[3], 0.1 + 0.02 * Math.sin(tt * 9));
      // ==== the cyclone, behind the actor ====
      if (tc > 0) {
        const kill = killK();
        if (kill > 0.005) {
          const ox = cxAt(t), k = collapseK(), g = geo(k);
          // leaf litter left in the wake
          for (const q of litter) p.dot(q.x, 0.4 + ((q.x * 7) & 1) * 0.5, q.c, q.a * kill * 0.8);
          // afterimages of the travelling funnel
          const gh = hist.length;
          for (const gi of [gh - 4, gh - 8]) {
            if (gi < 0) continue;
            const dx = hist[gi] - ox, a = (gi === gh - 4 ? 0.18 : 0.08) * kill;
            if (a <= 0.008) continue;
            const gg = geo(k);
            gg.ax = (u) => g.ax(u) + dx;
            p.ellipse(ox + gg.ax(1), -g.H - 2, g.rad(1), g.rad(1) * 0.34, J[2], a);
            for (let j = 0; j < 22; j++) {
              const u = (j + 0.5) / 22, cx = ox + gg.ax(u), r = g.rad(u);
              p.blend(cx, -u * g.H, J[2], a * 0.5);
              p.blend(cx - r * 0.55, -u * g.H + 1, J[1], a * 0.4);
              p.blend(cx + r * 0.55, -u * g.H + 1, J[1], a * 0.4);
            }
          }
          skirt(p, g, ox, o.seed * 5 + 1, true, kill);
          mouth(p, g, ox, o.seed * 7 + 2, true, kill, 0);
          bands(p, g, ox, o.seed * 3 + 5, true, kill);
          debris(p, g, ox, o.seed * 11 + 3, true, kill);
          body(p, g, ox, k, kill);
        }
      }
    },
    draw(p) {
      const tt = t, tc = tt - CY;
      // the heat-haze glow bleeding out from behind the open fan
      const heatK = tt < FAN_SHUT ? clamp(tt / 0.1) * (1 - seg(tt, FAN_SHUT, FAN_SHUT + 0.16)) : 0;
      if (heatK > 0.02) p.glow(PX, PY - 10, 30, C[4], 0.3 * heatK);
      // the fan, while it is anything like open
      if (tt < FAN_SHUT + 0.18) drawFan(p, tt, C, G, K, o.seed, FAN_SHUT);
      // the aerial shell of the blast: a full lacquer dome over him
      const rq = seg(tt, OPEN, OPEN + 0.42);
      if (tt >= OPEN && rq < 1) {
        const r = 10 + ease.outQuart(rq) * 56, th = Math.max(0.7, 3.1 * (1 - rq)), k = (1 - rq) * 0.92;
        const hot = rq < 0.2, m = Math.ceil(r * TAU * 1.2);
        for (let j = 0; j < m; j++) {
          const a = (j / m) * TAU, ca = Math.cos(a), sa = Math.sin(a);
          for (let oo = th; oo >= -0.4; oo -= 0.5) {
            const y = PY + sa * (r - oo);
            if (y > 1.5) continue;
            const x = PX + ca * (r - oo), u = oo / th;
            const col = u < 0.18 ? (hot ? WHITE : G[4]) : u < 0.45 ? (hot ? G[5] : C[4]) : u < 0.75 ? C[2] : K[0];
            p.dot(x, y, col, Math.min(1, k * (u < 0.45 ? 1.2 : 1.12 - u)));
          }
        }
      }
      const fq = seg(tt, OPEN, OPEN + 0.58);
      if (tt >= OPEN && fq < 1) {
        const r = 12 + ease.outQuart(fq) * 88, th = Math.max(0.8, 3.6 * (1 - fq)), k = 1 - smooth(0.42, 1, fq);
        band(p, 2, 0.5, r, 0.17, th, k, [K[0], K[1], G[2], G[4]], (g) => Math.sin(g) >= 0, fq < 0.2);
      }
      // anime menace: speed lines screaming out of the fan
      if (tt < 0.13) {
        const k = 1 - tt / 0.13;
        const Rl = new Rng(o.seed * 13 + 5);
        for (let i = 0; i < 11; i++) {
          const a = Rl.range(0, TAU);
          if (Math.sin(a) > 0.6) continue;
          const r0 = 21 + Rl.range(0, 11), r1 = r0 + (7 + Rl.range(0, 21)) * (0.45 + 0.55 * k);
          const cr = Rl.next();
          p.line(PX + Math.cos(a) * r0, PY + Math.sin(a) * r0, PX + Math.cos(a) * r1, PY + Math.sin(a) * r1, cr < 0.4 ? G[4] : cr < 0.75 ? WHITE : C[6], k * 0.72);
        }
      }
      // white-hot hero flash on the snap
      if (tt < 0.07) {
        const hk = 1 - tt / 0.07;
        flare(p, PX, PY - 4, 44 * hk + 12, hk, [C[4], G[3], G[5], WHITE]);
      }
      // ==== the sweep crescent rides in front of his body ====
      drawSmear(p, ECHO, 0.018, 7.5, G, false);
      drawSmear(p, SWING, 0, 15, G, true);
      if (t > B + 0.012 && t < SWEEP_HIT + 0.05) {
        const hk = clamp(1 - (t - B) / (SWEEP_T + 0.05), 0, 1);
        p.glow(tip[0], tip[1], 9 + 8 * (1 - hk), G[4], 0.5 * hk);
      }
      if (t > B && t < B + 0.14) {
        sparkle(p, tip[0], tip[1], 6 * clamp(1.6 - (t - B) / 0.14, 0.25, 1) * clamp((t - B - 0.012) / 0.02, 0, 1), G[5], WHITE, 0.8);
      }
      // ==== the cyclone, in front of his body ====
      if (tc > 0) {
        const kill = killK();
        if (kill > 0.005) {
          const ox = cxAt(t), k = collapseK(), g = geo(k);
          const flash = Math.max(0, 1 - Math.abs(tc - 0.4) / 0.055) + 0.7 * Math.max(0, 1 - Math.abs(tc - 0.51) / 0.03);
          mouth(p, g, ox, o.seed * 7 + 2, false, kill, flash);
          bands(p, g, ox, o.seed * 3 + 5, false, kill);
          skirt(p, g, ox, o.seed * 5 + 1, false, kill);
          debris(p, g, ox, o.seed * 11 + 3, false, kill);
          // the eruption: a white pillar, a fountain of leaves, a cold green pool
          const pq = clamp((tc - COLLAPSE + 0.02) / 0.09, 0, 1);
          if (pq > 0 && pq < 1) {
            const pa = Math.sin(pq * Math.PI) * kill;
            for (let yy = 0; yy < 46; yy += 1.5) {
              const vv = clamp(yy / 52, 0, 1), wob = g.ax(vv) + ox, spread = 1 - yy / 82;
              p.dot(wob - spread * 2, -2 - yy, J[8], pa * 0.75);
              p.dot(wob, -2 - yy, WHITE, pa * 0.9);
              p.dot(wob + spread * 2, -2 - yy, J[8], pa * 0.75);
            }
          }
          fountain(p, o.seed, ox, kill);
          wisps(p, g, ox, kill);
          if (tc > COLLAPSE) {
            const q = clamp(seg(tc, COLLAPSE, COLLAPSE + 0.32)), e = ease.outCubic(q);
            p.glow(ox, -18, 16 + 26 * e, J[5], (0.5 * (1 - q) + 0.2) * kill);
            p.circle(ox, -18, 2.2 + 5.6 * e, J[9], Math.pow(1 - q, 1.6) * kill);
            p.circle(ox, -18, 1.2 + 2.6 * e, WHITE, Math.pow(1 - q, 2) * kill);
            p.ellipse(ox, 0, 5 + ease.outQuart(q) * 20, 1.5 + ease.outQuart(q) * 5, J[4], (1 - q) * 0.75 * kill);
          }
        }
      }
      // lacquer droplets: streaked beads with a hot rim
      for (const d of drops) {
        if (d.delay > 0) continue;
        const l = Math.hypot(d.vx, d.vy) || 1, tail = clamp(l * 0.026, 1.4, 5.2);
        const red = d.kind < 0.45, ember = d.kind >= 0.8;
        if (ember) {
          p.line(d.x, d.y, d.x - (d.vx / l) * tail, d.y - (d.vy / l) * tail, G[3], 0.85);
          p.px(d.x, d.y, G[4]);
          p.glow(d.x, d.y, 3.2, G[3], 0.5);
          continue;
        }
        const rim = red ? C[1] : G[2], core = red ? C[5] : K[1], lit = red ? WHITE : G[4];
        p.line(d.x, d.y, d.x - (d.vx / l) * tail, d.y - (d.vy / l) * tail, rim, 0.9);
        p.circle(d.x, d.y, d.r + 0.35, rim);
        p.circle(d.x, d.y, d.r, core);
        p.dot(d.x - d.r * 0.4, d.y - d.r * 0.45, lit, 0.85);
        if (!red) p.dot(d.x + d.r * 0.4, d.y + d.r * 0.45, G[1], 0.8);
        p.glow(d.x, d.y, 2.6, core, 0.32);
      }
      // black lacquer petals sifting down
      if (flakes.length) {
        const fade = 1 - smooth(1.85, 2.2, tt);
        for (const f of flakes) p.dot(f.x, f.y, f.gold ? G[2] : C[2], fade);
      }
      // the hit result: a jagged lacquer splat bursts across the target and weeps downward
      const age = tt - HIT_T;
      if (age >= 0 && age < 1.02) {
        const q = seg(age, 0, 0.09), r = ease.outBack(q, 2.3) * 15.5;
        const fade = 1 - smooth(0.52, 1.0, age / 1.02), hotNow = age < 0.16;
        const pts = [], inner = [];
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * TAU, rr = r * (0.52 + jagOut[k] * 0.78);
          pts.push([HIT_X + Math.cos(a) * rr, HIT_Y + Math.sin(a) * rr * 0.92]);
        }
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * TAU + 0.33, rr = r * 0.47 * (0.66 + jagOut[(k * 4 + 3) % 12] * 0.5);
          inner.push([HIT_X + Math.cos(a) * rr, HIT_Y + Math.sin(a) * rr * 0.92]);
        }
        p.poly(pts, K[0], fade);
        p.poly(inner, hotNow ? C[5] : C[4], fade);
        if (hotNow) p.circle(HIT_X, HIT_Y, r * 0.24, C[6], fade);
        for (let k = 0; k < 12; k += 2) {
          const a = (k / 12) * TAU, rr = r * jagOut[k] * 1.22;
          p.dot(HIT_X + Math.cos(a) * rr, HIT_Y + Math.sin(a) * rr * 0.92, K[0], fade * 0.9);
        }
        p.dot(HIT_X - r * 0.4, HIT_Y - r * 0.35, WHITE, 0.8 * fade);
        p.dot(HIT_X + r * 0.34, HIT_Y - r * 0.1, C[7], 0.7 * fade);
        p.dot(HIT_X + r * 0.05, HIT_Y + r * 0.4, WHITE, 0.6 * fade);
        const drip = smooth(0.1, 0.66, age);
        for (const [off, len, col] of [[-6, 8.5, C[4]], [0.5, 12, K[1]], [6.5, 6, C[3]]]) {
          const l = drip * len;
          if (l > 0.8) {
            p.line(HIT_X + off, HIT_Y + r * 0.28, HIT_X + off, HIT_Y + r * 0.28 + l, col, fade);
            p.dot(HIT_X + off, HIT_Y + r * 0.28 + l, col, fade);
          }
        }
        const ringQ = seg(age, 0, 0.3);
        if (ringQ < 1) {
          const rr = 5 + ease.outQuart(ringQ) * 30, rk = 1 - ringQ;
          band(p, HIT_X, HIT_Y, rr, 0.8, Math.max(0.7, 1.8 * (1 - ringQ)), rk * 0.72, [K[0], K[1], G[2]], () => true, false);
        }
        if (age < 0.12) {
          const hk = 1 - age / 0.12;
          flare(p, HIT_X, HIT_Y - 2, 19 * hk + 6, hk, [C[3], C[5], G[4], WHITE]);
        }
      }
      // the snap-shut click
      if (tt > FAN_SHUT && tt < FAN_SHUT + 0.34) {
        const q = (tt - FAN_SHUT) / 0.34;
        if (q < 0.28) sparkle(p, PX, PY - 2, 7 * (1 - q / 0.28) + 2, G[5], C[6], 0.7);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}
