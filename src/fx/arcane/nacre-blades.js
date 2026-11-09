// Spinning disc wake, slash starburst, shard shatter and shock-ring choreography build on Sprite Fusion's
// open-source energy, slash and impact VFX (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, B, Rng, fit, flare, sparkle, clamp, smooth, seg, lerp, ease, TAU, WHITE, mix, READY } from "../../core/index.js";
import { shape } from "../status/_lib.js";

const TX = 204, TY = -26;
const T_SHOT1 = 0.24, T_HIT1 = 0.50;
const T_SHOT2 = 0.54, T_HIT2 = 0.80;
const T_CHARGE3 = 0.82, T_SHOT3 = 1.04, T_GRIND3 = 1.25, T_SHATTER3 = 1.35;
const T_END = 2.95;
const SY = 0.18;

export const meta = {
  name: "Nacre blades",
  desc: "Three spinning mother-of-pearl discs with rainbow-glinting rims launch from a black-lacquer halo, cleaving the target and shattering into storms of iridescent flecks.",
  tags: ["arcane", "projectile", "blade", "disc", "nacre", "lacquer", "pearl", "iridescent", "rainbow", "chinese", "shatter", "one-shot"],
  size: [412, 208],
  origin: [82, 172],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#05040a", "#110c1c", "#261a38", "#504268", "#8e82a6", "#ccc6e0", "#f0edf8", "#fffefa"],
    prism: ["#2cf5e8", "#48fa92", "#ffe45e", "#ff6eb0", "#cc5eff", "#52abff", "#ffffff"],
    seed: 7,
  },
};

const COIL = { ...READY, x: -4, crouch: 5, lean: -3, fx: -6, fy: -24, bx: 9, by: -20, ffx: 7, fbx: -8 };
const SLING1 = { ...READY, x: 2, crouch: 3, lean: 4, fx: 15, fy: -27, bx: -8, by: -20, ffx: 10, fbx: -8 };
const SLING2 = { ...READY, x: 4, crouch: 5, lean: 5, fx: -7, fy: -20, bx: 15, by: -22, ffx: 11, fbx: -8 };
const GATHER3 = { ...READY, x: -6, crouch: 8, lean: -5, hy: -2, fx: -8, fy: -27, bx: -4, by: -25, ffx: 6, fbx: -10 };
const HURL3 = { ...READY, x: 10, crouch: 6, lean: 7, fx: 16, fy: -25, bx: -9, by: -19, ffx: 13, fbx: -9, ghost: 1 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.32, READY],
    [0.0, COIL],
    [T_SHOT1, SLING1, "snap"],
    [T_SHOT2 - 0.08, { ...COIL, x: 0, crouch: 4 }],
    [T_SHOT2, SLING2, "snap"],
    [T_CHARGE3, GATHER3],
    [T_SHOT3 - 0.03, { ...GATHER3, crouch: 9, lean: -6 }],
    [T_SHOT3, HURL3, "snap"],
    [T_SHATTER3 + 0.28, HURL3],
    [2.15, { ...READY, x: 3, crouch: 3 }],
    [T_END, READY],
  ],
  hits: [
    { t: T_HIT1, stop: 0.05, shake: 0.16, amp: 2.0, push: 1.9, straw: 5, y: -30, flash: 0.05 },
    { t: T_HIT2, stop: 0.05, shake: 0.18, amp: 2.4, push: 2.3, straw: 6, y: -20, flash: 0.05 },
    { t: T_SHOT3, stop: 0.04, shake: 0.15, amp: 2.2, target: false },
    { t: T_GRIND3, stop: 0.04, shake: 0.20, amp: 2.4, push: 1.3, shiver: 0.14, straw: 3, y: -26, flash: 0.03 },
    { t: T_SHATTER3, stop: 0.16, shake: 0.48, amp: 5.0, push: 4.8, straw: 12, shiver: 0.34, y: -26, skin: "char" },
  ],
  dust: [
    { t: T_SHOT1, x: 8, n: 4, dir: 1 },
    { t: T_SHOT2, x: 10, n: 5, dir: 1 },
    { t: T_SHOT3, x: 16, n: 10, dir: 1 },
  ],
};

function prismAt(PR, u) {
  const n = 6;
  const f = (((u % 1) + 1) % 1) * n;
  const i = Math.floor(f);
  return mix(PR[i % n], PR[(i + 1) % n], f - i);
}

// Smooth zero-dither feathered black-lacquer volume / floor pool (eliminates hard circle edges & Bayer stipple!)
function softLacquerDisc(p, cx, cy, rx, ry, col, alpha, clipFloor = false) {
  if (alpha <= 0.02 || rx < 1 || ry < 1) return;
  const x0 = Math.max(-78, Math.floor(cx - rx)), x1 = Math.min(326, Math.ceil(cx + rx));
  const y0 = Math.max(-168, Math.floor(cy - ry)), y1 = Math.min(clipFloor ? 1 : 32, Math.ceil(cy + ry));
  const invRx = 1 / rx, invRy = 1 / ry;
  for (let y = y0; y <= y1; y++) {
    const ny = (y - cy) * invRy, ny2 = ny * ny;
    if (ny2 >= 1) continue;
    const maxDx = Math.floor(rx * Math.sqrt(1 - ny2));
    const xa = Math.max(x0, Math.ceil(cx - maxDx)), xb = Math.min(x1, Math.floor(cx + maxDx));
    for (let x = xa; x <= xb; x++) {
      const nx = (x - cx) * invRx;
      const q = 1 - (nx * nx + ny2);
      if (q > 0) p.blend(x, y, col, alpha * q * q);
    }
  }
}

// Hand-crafted Circular Mother-of-Pearl Blade ("贝母圆片，边缘泛七彩反光")
function drawNacreDisc(p, cx, cy, r, squash, tilt, spin, C, PR, alpha = 1, flashWhite = false, crackU = 0) {
  if (alpha <= 0.03 || r < 1.5) return;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const splitPush = crackU * 2.4;
  const bound = Math.ceil(r + splitPush + 4);
  p.glow(cx, cy, Math.min(34, r * 1.45), prismAt(PR, spin / TAU), (0.34 + 0.30 * crackU) * alpha);

  const rimWidth = Math.max(2.8, r * 0.27);
  const innerHub = Math.max(2.1, r * 0.26);

  for (let dy = -bound; dy <= bound; dy++) {
    const wy = Math.round(cy + dy);
    if (wy > 2 || wy < -168) continue;
    for (let dx = -bound; dx <= bound; dx++) {
      const wx = Math.round(cx + dx);
      let ux = dx * ct + dy * st;
      let uy = (-dx * st + dy * ct) / squash;
      let ang = Math.atan2(uy, ux);

      if (splitPush > 0.05) {
        const sec = Math.floor(((ang + Math.PI) / TAU) * 6);
        const secA = ((sec + 0.5) / 6) * TAU - Math.PI;
        ux -= Math.cos(secA) * splitPush;
        uy -= Math.sin(secA) * splitPush;
        ang = Math.atan2(uy, ux);
      }

      const d = Math.hypot(ux, uy);
      if (d > r + 1.5) continue;
      const notch = 0.78 * Math.max(0, Math.sin((ang - spin) * 4));
      const rEdge = r + notch;
      if (d > rEdge + 1.05) continue;

      if (flashWhite) {
        p.blend(wx, wy, WHITE, alpha);
        continue;
      }

      let col;
      const sectorSeam = crackU > 0.05 ? Math.abs(Math.sin(ang * 3 + 0.2)) : 1;
      if (crackU > 0.05 && sectorSeam < 0.14 * crackU && d > innerHub * 0.5) {
        col = crackU > 0.55 ? WHITE : prismAt(PR, (ang / TAU) * 2 + crackU);
      } else if (d > rEdge) {
        col = C[0];
      } else if (d > rEdge - rimWidth) {
        // HIGH-SATURATION 7-COLOR IRIDESCENT BEVELED RAZOR RIM ("边缘泛七彩反光")
        const spec = Math.sin((ang - spin) * 2);
        col = spec > 0.90 ? WHITE : prismAt(PR, (ang / TAU) * 2.0 - spin * 0.22);
      } else if (d > rEdge - rimWidth - 0.95 && r >= 9) {
        col = C[2];
      } else if (d < innerHub) {
        const spoke = Math.sin((ang - spin) * 3) > 0.58;
        col = d < innerHub * 0.38 ? WHITE : spoke ? prismAt(PR, spin * 0.18 + ang / TAU) : C[0];
      } else {
        const spiral = Math.sin((ang - spin) * 2 + d * 0.38);
        col = spiral > 0.52
          ? WHITE
          : spiral > -0.10
          ? C[6]
          : spiral > -0.55
          ? C[5]
          : mix(C[4], prismAt(PR, ang / TAU - spin * 0.1), 0.38);
      }

      if (alpha > 0.92) p.px(wx, wy, col);
      else p.blend(wx, wy, col, alpha);
    }
  }

  if (r >= 9 && alpha > 0.5) {
    for (const off of [0, Math.PI]) {
      const ga = spin + off;
      const lx = Math.cos(ga) * r, ly = Math.sin(ga) * r * squash;
      const gx = cx + lx * ct - ly * st;
      const gy = cy + lx * st + ly * ct;
      if (gy < 0) sparkle(p, gx, gy, r > 15 ? 4.2 : 2.6, WHITE, prismAt(PR, ga / TAU), 0.78 * alpha);
    }
  }
}

function drawSonicLaunchRing(p, cx, cy, rx, ry, PR, C, u, seedShift) {
  if (u <= 0 || u >= 1) return;
  const fade = 1 - smooth(0.25, 1, u);
  const steps = Math.ceil(ry * 5.2);
  for (let i = 0; i <= steps; i++) {
    const g = (i / steps) * TAU;
    const x = Math.round(cx + Math.cos(g) * rx);
    const y = Math.round(cy + Math.sin(g) * ry);
    if (y > 1 || y < -168) continue;
    p.blend(x, y, u < 0.25 ? WHITE : prismAt(PR, g / TAU + seedShift), fade * 0.88);
    p.blend(x - 1, y, C[0], fade * 0.65);
  }
}

function drawCleaveGash(p, cx, cy, ang, halfLen, halfW, PR, C, u, seedShift) {
  if (u <= 0 || u >= 1) return;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const nx = -sa, ny = ca;
  const fade = 1 - smooth(0.28, 1, u);
  const curL = halfLen * ease.outQuart(Math.min(1, u * 2.6));
  const curW = halfW * (1 - u * 0.82);
  const steps = Math.ceil(curL * 2);
  for (let i = -steps; i <= steps; i++) {
    const s = i / Math.max(1, steps);
    const taper = 1 - s * s;
    const wHere = curW * taper;
    if (wHere < 0.35) continue;
    const bx = cx + ca * (s * curL), by = cy + sa * (s * curL);
    if (by > 2 || by < -168) continue;
    const wCeil = Math.ceil(wHere + 1.2);
    for (let q = -wCeil; q <= wCeil; q++) {
      const aq = Math.abs(q);
      if (aq > wHere + 1.1) continue;
      const px = Math.round(bx + nx * q), py = Math.round(by + ny * q);
      if (py > 2 || px < -78 || px > 326) continue;
      let col, al;
      if (aq <= wHere * 0.38) {
        col = WHITE;
        al = fade;
      } else if (aq <= wHere) {
        col = prismAt(PR, s * 0.8 + seedShift - u * 1.2);
        al = fade * 0.92;
      } else {
        col = C[0];
        al = fade * 0.78;
      }
      p.blend(px, py, col, al);
    }
  }
}

// Sleek Razor-Edged Prismatic & Black-Lacquer Shockwave Dome (continuous early -> sweeping thin razor wisps late!)
function drawRazorShockDome(p, cx, cy, rBase, C, PR, u, isBig, seedShift) {
  if (u <= 0 || u >= 1 || rBase < 3) return;
  const fade = 1 - smooth(0.28, 1, u);
  const steps = Math.ceil(rBase * 4.4);
  const breakStart = 0.34;
  const breakK = u > breakStart ? (u - breakStart) / (1 - breakStart) : 0;

  for (let i = 0; i <= steps; i++) {
    const g = lerp(-Math.PI * 1.10, Math.PI * 0.10, i / steps);
    // Modulate into long sweeping razor wisps (NOT short fat pills!)
    const wave = 0.55 + 0.45 * Math.sin(g * 5 + seedShift * 6) + 0.28 * Math.cos(g * 3 - u * 4);
    if (breakK > 0 && wave < breakK * 1.15) continue;

    const cg = Math.cos(g), sg = Math.sin(g);
    const rLocal = rBase + (wave - 0.5) * 4.5 * breakK;
    const x = Math.round(cx + cg * rLocal);
    const y = Math.round(cy + sg * rLocal);
    if (y > 1 || y < -168 || x < -78 || x > 326) continue;

    const wispAlpha = fade * clamp((wave - breakK * 0.9) * 1.6, 0.25, 1);
    const pCol = u < 0.22 ? WHITE : prismAt(PR, (g / TAU) * 2.4 + seedShift - u * 0.8);

    // Sleek 2px-to-1px razor profile: black-lacquer outer shadow + bright prismatic inner crest!
    p.blend(Math.round(cx + cg * (rLocal + 1.5)), Math.round(cy + sg * (rLocal + 1.5)), C[0], wispAlpha * 0.88);
    p.blend(x, y, pCol, wispAlpha);
    if (isBig && u < 0.52) {
      p.blend(Math.round(cx + cg * (rLocal - 1)), Math.round(cy + sg * (rLocal - 1)), u < 0.32 ? WHITE : pCol, wispAlpha * 0.82);
    }
  }

  // Radial air-cleave speed needles shooting outward across the shockwave front!
  if (isBig && u < 0.55) {
    const su = u / 0.55;
    for (let k = 0; k < 14; k++) {
      const a = lerp(-Math.PI * 1.04, Math.PI * 0.04, (k + 0.5) / 14) + Math.sin(k * 2.7) * 0.06;
      const r0 = rBase * (0.45 + 0.42 * su);
      const r1 = rBase * (0.85 + 0.28 * (k % 2 ? 1 : 0.7)) * (1 - su * 0.12);
      if (r1 <= r0) continue;
      const ca = Math.cos(a), sa = Math.sin(a);
      const len = Math.ceil(r1 - r0);
      const col = k % 3 === 0 ? WHITE : PR[k % 6];
      const al = (1 - su) * 0.78;
      for (let s = 0; s <= len; s++) {
        const rr = r0 + s;
        const rx = Math.round(cx + ca * rr), ry = Math.round(cy + sa * rr);
        if (ry > 0 || ry < -168 || rx < -78 || rx > 326) break;
        p.blend(rx, ry, col, al * Math.sin((s / len) * Math.PI));
      }
    }
  }
}

function drawFloorShockRing(p, cx, r, th, C, PR, u, frontHalf, seedShift) {
  if (u <= 0 || u >= 1) return;
  const fade = 1 - smooth(0.32, 1, u);
  const g0 = frontHalf ? 0 : Math.PI;
  const g1 = frontHalf ? Math.PI : TAU;
  const steps = Math.ceil(r * 2.8);
  for (let i = 0; i <= steps; i++) {
    const g = lerp(g0, g1, i / steps);
    const cg = Math.cos(g), sg = Math.sin(g);
    for (let dr = -th; dr <= th + 1; dr += 1) {
      const rr = r + dr;
      const wx = Math.round(cx + cg * rr);
      const wy = Math.round(0.5 + sg * rr * SY);
      if (wx < -78 || wx > 326 || wy > 33) continue;
      const col = dr > 0.4 ? C[0] : Math.abs(dr) < 0.8 && u < 0.3 ? WHITE : prismAt(PR, (g / TAU) * 2 + seedShift);
      p.blend(wx, wy, col, fade * 0.86);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8), PR = fit(o.prism, 7);
  const R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, PR[0], PR[2], PR[3], PR[4]], haze: C[1] });
  const bits = new Bits({ ground: floor }), lights = new Lights();

  const blades = [
    { idx: 0, t0: T_SHOT1, t1: T_HIT1, r: 11.2, sq: 0.82, tilt: 0.24, sx: 10, sy: -44, cx: 104, cy: -94, ex: TX - 4, ey: -31, slotA: -0.5, cleaveA: 0.48 },
    { idx: 1, t0: T_SHOT2, t1: T_HIT2, r: 12.2, sq: 0.80, tilt: -0.22, sx: 14, sy: -16, cx: 112, cy: 6, ex: TX - 2, ey: -20, slotA: 1.6, cleaveA: -0.44 },
    { idx: 2, t0: T_SHOT3, t1: T_GRIND3, tShatter: T_SHATTER3, r: 20.5, sq: 0.88, tilt: 0.05, sx: 18, sy: -30, cx: 112, cy: -32, ex: TX + 1, ey: -27, slotA: 3.7, cleaveA: 0.05, finisher: true },
  ].map((b) => ({ ...b, trail: [], launched: false, hitDone: false, grindTriggered: false }));

  const flecks = [];
  const spawnNacreBurst = (bx, by, count, isBig, idx) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + R.range(-0.18, 0.18);
      const tier = i % 3;
      const spBase = isBig
        ? tier === 0 ? R.range(175, 315) : tier === 1 ? R.range(88, 178) : R.range(26, 92)
        : tier === 0 ? R.range(105, 195) : R.range(36, 115);
      const dirBias = Math.cos(a) > 0 ? 1.14 : 0.88;
      const sp = spBase * dirBias;
      flecks.push({
        x: bx + R.range(-5, 5),
        y: by + R.range(-7, 7),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - R.range(12, 46),
        drag: tier === 0 ? 4.5 : tier === 1 ? 5.6 : 6.8,
        grav: R.range(46, 88),
        age: 0,
        life: isBig ? R.range(0.78, 1.48) : R.range(0.52, 0.96),
        ci: (i + idx * 2) % 6,
        hero: isBig ? i % 3 !== 2 : i % 2 === 0,
        ph: R.range(0, TAU),
        spinRate: R.range(18, 34),
        floorY: R.range(-1.5, 4.5),
        landed: false,
      });
    }
  };

  // Shimmering nacre inlay brands clinging to the charred target body after Hit 3 ("命中结果特效")!
  const bodyInlays = Array.from({ length: 16 }, (_, i) => ({
    dx: R.range(-8.5, 8.5),
    dy: R.range(-41, -8),
    ci: i % 6,
    ph: R.range(0, TAU),
    dropT: T_SHATTER3 + R.range(0.55, 1.05),
    dropped: false,
  }));

  const floorFissures = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * TAU + R.range(-0.15, 0.15);
    const len = R.range(26, 68);
    const pts = [[TX, 1]];
    let x = TX, y = 1, curA = a;
    for (let d = 4; d < len; d += 4) {
      curA += R.range(-0.3, 0.3);
      x += Math.cos(curA) * 4;
      y = clamp(y + Math.sin(curA) * 0.72, -3, 10);
      pts.push([x, y]);
    }
    return { pts, ci: i % 6 };
  });

  const hitBursts = [];
  let t = 0;

  const bladePos = (b, tt) => {
    const u = clamp((tt - b.t0) / (b.t1 - b.t0), 0, 1);
    const eu = b.finisher ? ease.inQuad(u) * 0.32 + u * 0.68 : ease.outSine(u) * 0.25 + u * 0.75;
    const m = 1 - eu;
    return [
      m * m * b.sx + 2 * m * eu * b.cx + eu * eu * b.ex,
      m * m * b.sy + 2 * m * eu * b.cy + eu * eu * b.ey,
      u,
    ];
  };

  return {
    update(dt) {
      t += dt;

      if (t >= T_CHARGE3 && t < T_SHOT3 && R.chance(1.7 * dt * 60)) {
        const a = R.range(0, TAU), d = R.range(28, 56);
        ps.spawn(P.STREAK, 16 + Math.cos(a) * d, -30 + Math.sin(a) * d * 0.8, -Math.cos(a) * 195, -Math.sin(a) * 160, R.range(0.09, 0.15), PR[R.int(0, 5)]);
      }

      for (const b of blades) {
        if (t >= b.t0 && t <= b.t1) {
          if (!b.launched) {
            b.launched = true;
            lights.add(b.sx, b.sy, b.finisher ? 68 : 40, PR[(b.idx * 2) % 6], 0.85, 0.18);
          }
          const [x, y] = bladePos(b, t);
          b.trail.unshift([x, y]);
          if (b.trail.length > (b.finisher ? 18 : 13)) b.trail.pop();

          if (R.chance((b.finisher ? 1.9 : 1.0) * dt * 60)) {
            const c = PR[R.int(0, 5)];
            ps.spawn(P.MOTE, x + R.range(-4, 4), y + R.range(-b.r * 0.75, b.r * 0.75), R.range(-55, -12), R.range(-30, 30), R.range(0.22, 0.44), c, b.finisher && R.chance(0.45) ? 2 : 1);
          }
          if (b.finisher && R.chance(1.5 * dt * 60)) {
            ps.spawn(P.DUST, x - 4, -1, -R.range(45, 110), -R.range(5, 22), R.range(0.32, 0.56), C[2], R.range(2.6, 4.6));
          }
        }

        if (b.finisher && t >= T_GRIND3 && t < T_SHATTER3) {
          if (!b.grindTriggered) {
            b.grindTriggered = true;
            lights.add(b.ex, b.ey, 58, WHITE, 0.9, 0.12);
          }
          for (let k = 0; k < 4; k++) {
            const a = R.range(-2.4, 2.4), sp = R.range(90, 220);
            ps.spawn(P.SPARK, b.ex + R.range(-6, 6), b.ey + R.range(-8, 8), Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.14, 0.28));
          }
        }

        const triggerT = b.tShatter ?? b.t1;
        if (t >= triggerT && !b.hitDone) {
          b.hitDone = true;
          hitBursts.push({ x: b.ex, y: b.ey, t0: triggerT, big: !!b.finisher, idx: b.idx, cleaveA: b.cleaveA });
          lights.add(b.ex, b.ey, b.finisher ? 92 : 56, b.finisher ? WHITE : PR[(b.idx * 2) % 6], 0.95, b.finisher ? 0.52 : 0.25);

          spawnNacreBurst(b.ex, b.ey, b.finisher ? 204 : 84, !!b.finisher, b.idx);

          const nShards = b.finisher ? 26 : 10;
          for (let i = 0; i < nShards; i++) {
            const a = R.range(-2.7, 0.5), sp = R.range(65, b.finisher ? 225 : 165);
            bits.add({
              kind: B.SHARD,
              x: b.ex + R.range(-4, 4),
              y: b.ey + R.range(-6, 6),
              vx: Math.cos(a) * sp,
              vy: Math.sin(a) * sp - 32,
              g: 0.82,
              drag: 0.48,
              bounce: 0.42,
              life: R.range(0.55, b.finisher ? 1.25 : 0.85),
              a: R.range(0, TAU),
              va: R.range(-20, 20),
              s: b.finisher ? R.range(1.6, 2.9) : R.range(1.2, 2.0),
              c: i % 3 === 0 ? C[7] : PR[i % 6],
            });
          }
        }
      }

      // Clinging target nacre inlays flake off into falling rainbow specks during aftermath!
      for (const bi of bodyInlays) {
        if (!bi.dropped && t >= bi.dropT) {
          bi.dropped = true;
          flecks.push({
            x: TX + bi.dx,
            y: bi.dy,
            vx: R.range(-16, 16),
            vy: R.range(-8, 12),
            drag: 3.5,
            grav: 62,
            age: 0,
            life: R.range(0.35, 0.55),
            ci: bi.ci,
            hero: true,
            ph: bi.ph,
            spinRate: 24,
            floorY: R.range(-1, 3),
            landed: false,
          });
        }
      }

      for (let i = flecks.length - 1; i >= 0; i--) {
        const f = flecks[i];
        f.age += dt;
        if (f.age >= f.life) {
          flecks.splice(i, 1);
          continue;
        }
        if (!f.landed) {
          const damp = Math.exp(-f.drag * dt);
          f.vx *= damp;
          f.vy = f.vy * damp + f.grav * dt;
          f.x += (f.vx + Math.sin(f.age * 16 + f.ph) * 14) * dt;
          f.y += f.vy * dt;
          if (f.x < -76 || f.x > 322) f.vx *= -0.4;
          if (f.y >= f.floorY) {
            f.y = f.floorY;
            if (Math.abs(f.vy) > 28) {
              f.vy = -f.vy * 0.32;
              f.vx *= 0.55;
            } else {
              f.landed = true;
            }
          }
        }
      }

      bits.update(dt);
      ps.update(dt);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-6) return;

      // 1) Ornate Chinese Black-Lacquer Inlaid Sovereign Compass Halo ("黑漆螺钿八角星盘") behind caster!
      const haloAppear = ease.outBack(clamp(t / 0.22, 0, 1), 1.3);
      const haloFade = smooth(0.0, 0.14, t) * (1 - smooth(T_SHOT3 + 0.12, T_SHOT3 + 0.60, t));
      if (haloFade > 0.03) {
        const wx = -8, wy = -36;
        const charge3 = t >= T_CHARGE3 && t < T_SHOT3 ? seg(t, T_CHARGE3, T_SHOT3) : t >= T_SHOT3 ? 1 : 0;
        const pulse =
          (t >= T_SHOT1 && t < T_SHOT1 + 0.12 ? 1 - (t - T_SHOT1) / 0.12 : 0) +
          (t >= T_SHOT2 && t < T_SHOT2 + 0.12 ? 1 - (t - T_SHOT2) / 0.12 : 0);
        const wr = (33 + 11 * ease.outCubic(charge3) + 3 * pulse) * haloAppear;

        softLacquerDisc(p, -2, 1, 42 * haloFade, 42 * SY * haloFade, C[0], 0.90 * haloFade);
        softLacquerDisc(p, wx, wy, wr + 10, wr + 10, C[0], 0.88 * haloFade, true);

        // Rotating 8-pointed inlaid mother-of-pearl star filigree inside the black-lacquer wheel!
        for (let k = 0; k < 8; k++) {
          const a0 = (k / 8) * TAU - t * 0.9;
          const a1 = a0 + (TAU * 3) / 8;
          const x0 = wx + Math.cos(a0) * (wr * 0.68), y0 = wy + Math.sin(a0) * (wr * 0.68);
          const x1 = wx + Math.cos(a1) * (wr * 0.68), y1 = wy + Math.sin(a1) * (wr * 0.68);
          if (y0 < 1 && y1 < 1) {
            p.line(x0, y0, x1, y1, k % 2 === 0 ? C[3] : C[2], 0.55 * haloFade);
          }
        }

        const rimSteps = Math.ceil(wr * 4.5);
        for (let i = 0; i < rimSteps; i++) {
          const g = (i / rimSteps) * TAU + t * 1.9;
          const cg = Math.cos(g), sg = Math.sin(g);
          const scrollR = wr + 2.6 * Math.max(0, Math.sin(g * 8 - t * 7));
          const rx = Math.round(wx + cg * scrollR), ry = Math.round(wy + sg * scrollR);
          if (ry > 1) continue;
          const plaque = ((i * 12) % rimSteps) < rimSteps * 0.72;
          const col = plaque ? prismAt(PR, (i / rimSteps) * 2 + t * 0.6) : C[2];
          p.blend(rx, ry, col, haloFade * (plaque ? 0.95 : 0.65));
          p.blend(Math.round(wx + cg * (wr - 2)), Math.round(wy + sg * (wr - 2)), plaque ? C[6] : C[1], haloFade * 0.6);
        }

        for (const b of blades) {
          if (t < b.t0) {
            const ga = b.slotA + t * 3.2;
            const ox = wx + Math.cos(ga) * (wr * 0.72);
            const oy = wy + Math.sin(ga) * (wr * 0.72);
            if (b.finisher && t >= T_CHARGE3) {
              const k = ease.inOutCubic(seg(t, T_CHARGE3, T_SHOT3));
              const bx = lerp(ox, 18, k), by = lerp(oy, -30, k);
              const br = lerp(8.5, 20.5, ease.outBack(k, 1.22));
              drawNacreDisc(p, bx, by, br, 0.88, 0.05, t * (16 + 20 * k), C, PR, haloFade);
            } else {
              drawNacreDisc(p, ox, oy, 8.2, 0.86, 0.1, t * 15 + b.idx * 2, C, PR, haloFade);
            }
          }
        }
      }

      // 2) Feathered Velvet-Black Lacquer Abyssal Gravity-Well + Rainbow Floor Fissures at Target!
      for (const hb of hitBursts) {
        const age = t - hb.t0;
        if (age < 0) continue;

        const voidDur = hb.big ? 0.92 : 0.36;
        if (age < voidDur) {
          const vu = age / voidDur;
          const vr = (hb.big ? 74 : 34) * ease.outQuart(Math.min(1, vu * 2.2));
          const va = (1 - smooth(0.32, 1, vu)) * (hb.big ? 0.82 : 0.52);
          softLacquerDisc(p, hb.x, hb.y - 4, vr, vr * 0.88, C[0], va, true);
        }

        if (hb.big && age < 1.38) {
          const f = 1 - smooth(0.72, 1.38, age);
          const grow = ease.outCubic(clamp(age / 0.18, 0, 1));
          softLacquerDisc(p, hb.x, 1, 72 * grow, 72 * SY * grow, C[0], 0.92 * f);
          for (const fis of floorFissures) {
            const n = Math.floor(fis.pts.length * clamp(age / 0.22, 0, 1));
            for (let i = 1; i < n; i++) {
              const u = i / fis.pts.length;
              const col = age < 0.25 && u < 0.4 ? WHITE : prismAt(PR, fis.ci / 6 + u * 0.35 - age * 0.4);
              p.line(fis.pts[i - 1][0], fis.pts[i - 1][1], fis.pts[i][0], fis.pts[i][1], col, f * (1 - u * 0.45));
            }
          }
        }

        const uFloor = age / (hb.big ? 0.62 : 0.36);
        if (uFloor < 1) {
          const mr = hb.big ? 86 : 38;
          drawFloorShockRing(p, hb.x, 8 + mr * ease.outQuart(uFloor), (hb.big ? 3.2 : 1.8) * (1 - uFloor * 0.7), C, PR, uFloor, false, hb.idx * 0.33);
        }
      }

      ps.draw(p, { layer: "back" });
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;
      const A = o.actor;

      if (A && t < T_SHATTER3) {
        const S_ACT = shape(A);
        const rimA = (1 - smooth(T_SHOT3 + 0.1, T_SHATTER3, t)) * 0.68;
        if (rimA > 0.05) {
          for (const [ox, oy, nx, ny] of S_ACT.outline) {
            if (nx > 0.2 && ny < 0.2) {
              p.blend(A.x + ox, A.y + oy, prismAt(PR, oy * 0.04 - t * 1.5), rimA);
            }
          }
        }
      }

      for (const [tLaunch, lx, ly, lry, sh] of [
        [T_SHOT1, 14, -42, 13, 0.0],
        [T_SHOT2, 18, -17, 14, 0.33],
        [T_SHOT3, 24, -30, 26, 0.66],
      ]) {
        const lu = (t - tLaunch) / (lry > 20 ? 0.24 : 0.16);
        if (lu > 0 && lu < 1) {
          const s = ease.outCubic(lu);
          drawSonicLaunchRing(p, lx, ly, (lry * 0.36) * (0.4 + 0.8 * s), lry * (0.4 + 0.85 * s), PR, C, lu, sh);
        }
      }

      // 1) Glossy Black-Lacquer + Dual Prismatic Nacre Wake Ribbons & Spinning Circular Blades!
      for (const b of blades) {
        const endT = b.tShatter ?? b.t1;
        const trailFade = t <= endT ? 1 : 1 - clamp((t - endT) / 0.24, 0, 1);
        if (b.trail.length >= 2 && trailFade > 0.03) {
          const n = b.trail.length;
          for (let i = 0; i < n - 1; i++) {
            const [x0, y0] = b.trail[i], [x1, y1] = b.trail[i + 1];
            const L = Math.hypot(x1 - x0, y1 - y0) || 1;
            const nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
            const u = i / (n - 1);
            const hw = (b.finisher ? 14.5 : 7.0) * Math.pow(1 - u, 0.78);
            const steps = Math.max(1, Math.ceil(L * 1.35));
            for (let s = 0; s < steps; s++) {
              const k = s / steps;
              const cx = lerp(x0, x1, k), cy = lerp(y0, y1, k);
              const al = (1 - u) * trailFade;
              const wInt = Math.ceil(hw);
              for (let q = -wInt; q <= wInt; q++) {
                const v = Math.abs(q) / Math.max(1, hw);
                if (v > 1) continue;
                const wy = Math.round(cy + ny * q);
                if (wy > 1) continue;
                const wx = Math.round(cx + nx * q);
                let col, aPx;
                if (v > 0.68) {
                  col = v > 0.88 && u < 0.24 ? WHITE : prismAt(PR, u * 1.8 - t * 3.8 + (q > 0 ? 0 : 0.48) + b.idx * 0.25);
                  aPx = al * 0.95;
                } else if (v < 0.22 && u < 0.34) {
                  col = C[7];
                  aPx = al * 0.75;
                } else {
                  col = C[0];
                  aPx = al * 0.78;
                }
                p.blend(wx, wy, col, aPx);
              }
            }
          }
        }

        if (t >= b.t0 && t < endT) {
          const [bx, by, u] = bladePos(b, Math.min(t, b.t1));
          const isGrinding = b.finisher && t >= T_GRIND3;
          const crackU = isGrinding ? seg(t, T_GRIND3, T_SHATTER3) : 0;
          const jx = isGrinding ? Math.sin(t * 95) * 1.4 : 0;
          const jy = isGrinding ? Math.cos(t * 83) * 1.1 : 0;
          drawNacreDisc(
            p,
            bx + jx,
            by + jy,
            b.r,
            b.sq,
            b.tilt,
            t * (b.finisher ? 36 : 28) + b.idx * 2.1,
            C,
            PR,
            1,
            u < 0.045,
            crackU
          );
        }
      }

      // 2) Persistent X-shaped Inlaid Nacre Fracture Brand + Clinging Nacre Body Inlays on Target!
      if (t >= T_HIT1 && t < T_SHATTER3 + 0.10) {
        const brandFade = t < T_SHATTER3 ? 0.85 : 1 - seg(t, T_SHATTER3, T_SHATTER3 + 0.10);
        drawCleaveGash(p, TX - 2, -26, 0.48, 16, 1.3, PR, C, 0.35, 0.1);
        if (t >= T_HIT2) {
          drawCleaveGash(p, TX - 2, -24, -0.44, 17, 1.4, PR, C, 0.35, 0.55);
          sparkle(p, TX - 2, -25, 5 + Math.sin(t * 30) * 1.5, WHITE, prismAt(PR, t * 2), brandFade);
        }
      }
      if (t >= T_SHATTER3) {
        for (const bi of bodyInlays) {
          if (bi.dropped) continue;
          const ix = Math.round(TX + bi.dx), iy = Math.round(bi.dy);
          const tw = Math.sin(t * 26 + bi.ph);
          const col = tw > 0.65 ? WHITE : PR[bi.ci];
          p.px(ix, iy, col);
          if (tw > 0.4) p.blend(ix, iy - 1, PR[(bi.ci + 1) % 6], 0.78);
        }
      }

      // 3) Sleek Razor-Edged Shockwave Domes & Sovereign Cleave Beams!
      for (const hb of hitBursts) {
        const age = t - hb.t0;
        if (age < 0) continue;

        const domeDur = hb.big ? 0.56 : 0.32;
        if (age < domeDur) {
          const u = age / domeDur;
          const maxR = hb.big ? 82 : 34;
          drawRazorShockDome(p, hb.x, hb.y, 8 + maxR * ease.outQuart(u), C, PR, u, hb.big, hb.idx * 0.33);
          if (hb.big && age < 0.42) {
            const u2 = age / 0.42;
            drawRazorShockDome(p, hb.x, hb.y, 5 + 52 * ease.outCubic(u2), C, PR, u2, true, 0.52);
          }
        }

        const slashDur = hb.big ? 0.28 : 0.18;
        if (age < slashDur) {
          const su = age / slashDur;
          if (hb.big) {
            drawCleaveGash(p, hb.x, hb.y, 0.06, 68, 4.4, PR, C, su, 0.0);
            drawCleaveGash(p, hb.x, hb.y, -0.58, 52, 3.2, PR, C, su, 0.25);
            drawCleaveGash(p, hb.x, hb.y, 0.64, 50, 3.0, PR, C, su, 0.52);
            drawCleaveGash(p, hb.x, hb.y, -1.42, 46, 2.5, PR, C, su, 0.78);
          } else {
            drawCleaveGash(p, hb.x, hb.y, hb.cleaveA, 36, 2.8, PR, C, su, hb.idx * 0.4);
          }
        }

        if (age < (hb.big ? 0.09 : 0.06)) {
          const fk = 1 - age / (hb.big ? 0.09 : 0.06);
          flare(p, hb.x, hb.y, (hb.big ? 62 : 34) * fk, fk, [PR[4], PR[0], PR[2], WHITE]);
        }

        const uFloor = age / (hb.big ? 0.62 : 0.36);
        if (uFloor < 1) {
          const mr = hb.big ? 86 : 38;
          drawFloorShockRing(p, hb.x, 8 + mr * ease.outQuart(uFloor), (hb.big ? 3.2 : 1.8) * (1 - uFloor * 0.7), C, PR, uFloor, true, hb.idx * 0.33);
        }
      }

      // 4) THE HERO SHATTER STORM: Hundreds of Twinkling 7-Color Mother-of-Pearl Flecks ("命中后炸成细碎彩点")!
      for (const f of flecks) {
        const u = f.age / f.life;
        const fade = 1 - smooth(0.56, 1.0, u);
        if (fade <= 0.04) continue;
        const fx = Math.round(f.x), fy = Math.round(f.y);
        if (fx < -78 || fx > 326 || fy < -168 || fy > 32) continue;

        const tw = Math.sin(f.age * f.spinRate + f.ph);
        const baseCol = PR[f.ci];
        const col = tw > 0.76 ? WHITE : baseCol;

        if (fade > 0.85) p.px(fx, fy, col);
        else p.blend(fx, fy, col, fade);

        if (f.hero && !f.landed) {
          if (tw > 0.08) {
            p.blend(fx + 1, fy, baseCol, fade * 0.86);
            p.blend(fx, fy - 1, tw > 0.58 ? WHITE : PR[(f.ci + 1) % 6], fade * 0.86);
          } else {
            p.blend(fx + 1, fy + 1, C[0], fade * 0.72);
          }
          if (tw > 0.52) {
            p.glow(fx, fy, 4.5, baseCol, 0.34 * fade);
          }
        } else if (f.landed && tw > 0.42) {
          p.blend(fx, fy - 1, WHITE, fade * 0.68);
        }
      }

      bits.draw(p);
      ps.draw(p, { layer: "front" });
      lights.draw(p);
    },
  };
}
