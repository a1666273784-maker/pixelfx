// Monster liquid-venom deluge VFX (怪物喷吐大量毒液液体特效):
// A predatory dark-chitin beast rears its head, inflates glowing throat poison sacs, unhinges fanged jaws dripping
// sticky acid drool, and blasts a massive, surging, gravity-heavy torrent of liquid venom from its mouth. The
// high-pressure deluge violently hammers the ground into a towering fluid splash crown and sweeping toxic surf,
// boiling away in a deep etched corrosive acid swamp full of glowing fissures, popping blisters, and rising vapor.

import { Particles, Lights, P, Rng, fit, clamp, smooth, lerp, ease, noise, noise2, rand, TAU, WHITE, mix, hex } from "../../core/index.js";
import { spikes, star, brokenRing, frontCrescent, makeCracks, drawCracks } from "../impacts/_lib.js";

const T_OPEN = 0.04;
const T_BLAST = 0.28;
const T_HIT = 0.41;
const T_SHUT = 1.46;
const T_END = 3.15;

const MOUTH_X = 8;
const MOUTH_Y = -42;
const HIT_X = 186;
const SY = 0.22;

export const meta = {
  name: "Venom deluge",
  desc: "A horned beast unhinges dripping fanged jaws and blasts a heavy deluge of liquid venom into a violent splash crown and boiling acid swamp.",
  tags: ["nature", "poison", "acid", "liquid", "monster", "breath", "deluge", "corrosion", "one-shot"],
  size: [424, 212],
  origin: [82, 166],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#0b0614", "#210c34", "#275214", "#469818", "#84e224", "#c6ff4c", "#ebff9c", "#ffffff"],
    beast: ["#0b0714", "#181026", "#2c1d42", "#473168", "#6c4e94"],
    monster: true,
    seed: 17,
  },
};

// Offscreen monster rasterizer (fast dirty-clear polygon/disc buffer in local coords)
const MW = 104, MH = 108, MX0 = -76, MY0 = -100;
const mCol = new Uint32Array(MW * MH);
const mTag = new Uint8Array(MW * MH);
const pxA = new Float32Array(24), pyA = new Float32Array(24);
const xsBuf = [];
let mx0 = MW, mx1 = 0, my0 = MH, my1 = 0;

function clearMBuf() {
  if (mx0 <= mx1 && my0 <= my1) {
    const a = Math.max(0, mx0 - 1), b = Math.min(MW - 1, mx1 + 1);
    for (let iy = Math.max(0, my0 - 1); iy <= Math.min(MH - 1, my1 + 1); iy++) {
      mCol.fill(0, iy * MW + a, iy * MW + b + 1);
      mTag.fill(0, iy * MW + a, iy * MW + b + 1);
    }
  }
  mx0 = MW; mx1 = 0; my0 = MH; my1 = 0;
}

function polyM(pts, colFn, tag = 1) {
  const n = pts.length;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) {
    const x = pts[i][0], y = pts[i][1];
    pxA[i] = x; pyA[i] = y;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const ix0 = Math.max(1, Math.floor(x0) - MX0), ix1 = Math.min(MW - 2, Math.ceil(x1) - MX0);
  const iy0 = Math.max(1, Math.floor(y0) - MY0), iy1 = Math.min(MH - 2, Math.ceil(y1) - MY0);
  if (ix0 > ix1 || iy0 > iy1) return;
  if (ix0 < mx0) mx0 = ix0; if (ix1 > mx1) mx1 = ix1;
  if (iy0 < my0) my0 = iy0; if (iy1 > my1) my1 = iy1;
  for (let iy = iy0; iy <= iy1; iy++) {
    const wy = iy + MY0 + 0.5;
    xsBuf.length = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yA = pyA[j], yB = pyA[i];
      if ((yA <= wy && yB > wy) || (yB <= wy && yA > wy)) xsBuf.push(pxA[j] + ((wy - yA) * (pxA[i] - pxA[j])) / (yB - yA));
    }
    xsBuf.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xsBuf.length; k += 2) {
      const a = Math.max(1, Math.ceil(xsBuf[k] - 0.5) - MX0), b = Math.min(MW - 2, Math.floor(xsBuf[k + 1] - 0.5) - MX0);
      for (let ix = a; ix <= b; ix++) {
        const wx = ix + MX0 + 0.5, id = iy * MW + ix;
        if (tag >= mTag[id]) { mCol[id] = typeof colFn === "function" ? colFn(wx, wy) : colFn; mTag[id] = tag; }
      }
    }
  }
}

function discM(cx, cy, r, colFn, tag = 1) {
  const ix0 = Math.max(1, Math.floor(cx - r) - MX0), ix1 = Math.min(MW - 2, Math.ceil(cx + r) - MX0);
  const iy0 = Math.max(1, Math.floor(cy - r) - MY0), iy1 = Math.min(MH - 2, Math.ceil(cy + r) - MY0);
  if (ix0 > ix1 || iy0 > iy1) return;
  if (ix0 < mx0) mx0 = ix0; if (ix1 > mx1) mx1 = ix1;
  if (iy0 < my0) my0 = iy0; if (iy1 > my1) my1 = iy1;
  const r2 = r * r;
  for (let iy = iy0; iy <= iy1; iy++) {
    const wy = iy + MY0 + 0.5, dy = wy - cy;
    for (let ix = ix0; ix <= ix1; ix++) {
      const wx = ix + MX0 + 0.5, dx = wx - cx;
      if (dx * dx + dy * dy <= r2) {
        const id = iy * MW + ix;
        if (tag >= mTag[id]) { mCol[id] = typeof colFn === "function" ? colFn(wx, wy) : colFn; mTag[id] = tag; }
      }
    }
  }
}

function drawMonster(p, t, C, B, S) {
  clearMBuf();
  const enter = smooth(0, 0.10, t);
  const exit = 1 - smooth(T_END - 0.34, T_END, t);
  const fade = enter * exit;
  if (fade <= 0.02) return null;

  const coil = smooth(0, T_BLAST, t) * (1 - smooth(T_BLAST, T_BLAST + 0.09, t));
  const spew = smooth(T_BLAST, T_BLAST + 0.06, t) * (1 - smooth(T_SHUT - 0.04, T_SHUT + 0.14, t));
  const throb = spew * Math.sin(t * 34);
  const jawOpen = clamp(smooth(T_OPEN, T_BLAST, t) * 0.62 + spew * 0.62 - smooth(T_SHUT, T_SHUT + 0.14, t) * 1.0, 0.06, 1.2);
  const sacGlow = smooth(0.02, T_BLAST, t) * (0.72 + 0.28 * Math.sin(t * 26)) * (1 - smooth(T_SHUT, T_SHUT + 0.4, t));

  const hx = -26 - coil * 9 + spew * 8 + throb * 0.7;
  const hy = -47 + coil * 6 - spew * 1.5 + throb * 1.3 + (1 - enter) * 10;
  const pitch = -0.22 * coil + 0.08 * spew + spew * Math.sin(t * 11) * 0.04;
  const ux = Math.cos(pitch), uy = Math.sin(pitch), dx = -uy, dy = ux;
  const hp = (lx, ly) => [hx + ux * lx + dx * ly, hy + uy * lx + dy * ly];

  const jAng = pitch + 0.14 + jawOpen * 0.68;
  const jux = Math.cos(jAng), juy = Math.sin(jAng), jdx = -juy, jdy = jux;
  const j0 = hp(4, 3);
  const jp = (lx, ly) => [j0[0] + jux * lx + jdx * ly, j0[1] + juy * lx + jdy * ly];

  // Armored arched monster neck & hunched shoulder base
  polyM([[-64, 0], [-57, -36], hp(-12, -13), hp(7, 2), hp(5, 16), [-22, 0]], (wx, wy) => {
    const k = (wx + 56) * 0.028 - (wy + 26) * 0.022;
    return k > 0.75 ? B[3] : k > 0.2 ? B[2] : B[1];
  }, 1);

  // Jagged dorsal chitin spines down the neck
  for (let i = 0; i < 4; i++) {
    const bx = -46 + i * 9, by = -18 - i * 8.5;
    polyM([[bx - 3, by], [bx - 14, by - 10], [bx + 4, by - 4]], B[3], 1);
  }

  // Bulging throat venom glands pulsing with glowing acid veins
  const sacR = 10.5 + 5.2 * sacGlow + spew * (1.8 + 1.4 * Math.sin(t * 22));
  const sacC = hp(-2, 14 + 2.8 * sacGlow);
  discM(sacC[0], sacC[1], sacR, (wx, wy) => {
    const d = Math.hypot(wx - sacC[0], wy - sacC[1]) / sacR;
    const v = noise2(wx * 0.34 - t * 4.5, wy * 0.34, S + 9);
    if (sacGlow > 0.12 && (d < 0.48 + 0.28 * sacGlow || v > 0.38 - 0.32 * sacGlow)) return d < 0.28 ? C[6] : d < 0.56 ? C[5] : C[4];
    return d < 0.72 ? B[3] : B[2];
  }, 2);

  // Glowing inner gullet cavern when jaws crank wide open
  if (jawOpen > 0.18) {
    polyM([hp(3, -3), hp(24, 1), jp(22, -1), jp(1, 2)], (wx) => {
      const u = clamp((wx - j0[0]) / 22);
      return u < 0.4 ? C[6] : C[4];
    }, 2);
  }

  // Lower jaw + jagged ivory fangs
  polyM([jp(0, -1), jp(23, -1.5), jp(27, 2.2), jp(22, 6.5), jp(6, 7.5), jp(-2, 4.5)], (wx, wy) => (wy < j0[1] + 5.5 ? B[3] : B[2]), 3);
  if (jawOpen > 0.14) {
    polyM([jp(19.5, -1), jp(23, -1), jp(21.5, -7)], WHITE, 4);
    polyM([jp(11.5, -0.5), jp(14.5, -0.5), jp(13, -5)], C[6], 4);
  }

  // Armored horned skull + brow crest + upper snout + curved front fangs
  polyM([hp(-11, -12), hp(6, -15), hp(22, -10), hp(30, -3), hp(27, 2.2), hp(10, 1.5), hp(-5, 2.5)], (wx, wy) => {
    const d = wy - hy;
    return d < -9 ? B[4] : d < -3.5 ? B[3] : B[2];
  }, 3);
  // Swept horns & cheek spur
  polyM([hp(-4, -11), hp(-24, -27), hp(4, -13)], B[4], 3);
  polyM([hp(3, -11), hp(-11, -22), hp(10, -12)], B[3], 3);
  polyM([hp(2, 1), hp(-10, 9), hp(4, 5)], B[3], 3);

  if (jawOpen > 0.14) {
    polyM([hp(23.5, 1.6), hp(28, 1.6), hp(25.8, 9.2)], WHITE, 4);
    polyM([hp(15, 1.3), hp(18.5, 1.3), hp(16.8, 6.4)], C[6], 4);
  }
  // Glowing slit predator eye
  const eye = hp(10, -6);
  discM(eye[0], eye[1], 2.5, C[5], 4);
  discM(eye[0] + 0.6, eye[1], 1.2, WHITE, 5);

  // Rasterize with clean 1px dark outline
  const iyS = Math.max(1, my0 - 1), iyE = Math.min(MH - 2, my1 + 1);
  const ixS = Math.max(1, mx0 - 1), ixE = Math.min(MW - 2, mx1 + 1);
  for (let iy = iyS; iy <= iyE; iy++) {
    const wy = iy + MY0;
    if (wy > 0) continue;
    const baseFade = fade * (wy > -14 ? clamp(-wy / 14, 0.35, 1) : 1);
    for (let ix = ixS; ix <= ixE; ix++) {
      const idx = iy * MW + ix, wx = ix + MX0, c = mCol[idx];
      if (!c) {
        if (mCol[idx - MW] || mCol[idx + MW] || mCol[idx - 1] || mCol[idx + 1]) p.blend(wx, wy, B[0], baseFade * 0.96);
        continue;
      }
      p.blend(wx, wy, c, baseFade);
    }
  }
  const mouth = [(hp(25, 1)[0] + jp(22, -1)[0]) * 0.5, (hp(25, 1)[1] + jp(22, -1)[1]) * 0.5];
  p.glow(eye[0], eye[1], 9, C[5], 0.5 * fade);
  p.glow(sacC[0], sacC[1], sacR + 7, C[4], 0.42 * sacGlow * fade);
  if (jawOpen > 0.25) p.glow(mouth[0], mouth[1], 16, C[5], 0.45 * fade * (0.35 + 0.65 * spew));
  return { mx: mouth[0], my: mouth[1], uFang: hp(25.5, 6), lFang: jp(21.5, -4) };
}

const FUME_LUTS = Array.from({ length: 15 }, (_, r) => {
  if (r < 1) return [];
  const pts = [];
  for (let dy = -r - 1; dy <= r + 1; dy++) for (let dx = -r - 1; dx <= r + 1; dx++) {
    const a = Math.atan2(dy, dx), sc = 1 + 0.16 * Math.sin(a * 5 + r * 1.1) + 0.08 * Math.cos(a * 8 - r);
    const q = Math.hypot(dx, dy) / (r * sc);
    if (q <= 1) pts.push(dx, dy, q, (-dx * 0.42 - dy * 0.91) / r);
  }
  return pts;
});

function drawFume(p, cx, cy, r, C, alpha) {
  const ir = Math.min(14, Math.round(r)), lut = FUME_LUTS[ir];
  if (!lut || !lut.length || alpha <= 0.03) return;
  const rx = Math.round(cx), ry = Math.round(cy);
  for (let i = 0; i < lut.length; i += 4) {
    const wy = ry + lut[i + 1];
    if (wy > 1) continue;
    const q = lut[i + 2], lit = lut[i + 3];
    // Dark violet top-outer rim, acid-lit underside glowing from the pool below
    const c = q > 0.76 ? C[1] : lut[i + 1] > 1.5 && lit < 0.2 ? C[4] : lit > 0.25 ? C[3] : C[2];
    p.blend(rx + lut[i], wy, c, alpha * (1 - q * 0.28) * 0.88);
  }
}

export function create(o) {
  const C = fit(o.palette, 8), B = fit(o.beast, 5), R = new Rng(o.seed), S = o.seed;
  const SCORCH = mix(C[0], hex("#100a0e"), 0.55), STEAM = mix(C[6], hex("#e6f5dc"), 0.6);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [C[7], C[6], C[5], C[4]] });
  const lights = new Lights();

  const drops = [], blobs = [], fumes = [], ripples = [], pops = [], wisps = [], pitBubbles = [], stains = [];
  const rag = Array.from({ length: 140 }, (_, i) => rand(i, S, 5) - 0.5);
  const hitSpikes = spikes(R, 14, -Math.PI * 0.22, { len: [16, 28], w: [1.8, 2.8], fwd: 1.5, back: 0.45, jag: 0.68 });
  const ringSegs = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * TAU + R.range(-0.14, 0.14), gap: R.range(0.32, 0.56), dr: R.range(0.22, 0.48) }));
  const cracks = makeCracks(R, 12, { len: [18, 44], dive: 0.24, maxY: 8, forks: 0.5, x0: [8, 36] });

  let t = 0, hitDone = false;

  // Dynamic target point sweeps slightly as the beast bellows & pumps liquid
  const sweepAt = (tt) => HIT_X + (tt > T_HIT ? Math.sin((tt - T_HIT) * 6.5) * 14 : 0);
  const streamY = (x, mx, my, tx) => {
    const u = clamp((x - mx) / Math.max(1, tx - mx));
    return lerp(my, 0, Math.pow(u, 1.55)) - Math.sin(Math.PI * u) * 5.5;
  };

  const addDrop = (x, y, vx, vy, s = 2, stain = true) => drops.push({ x, y, vx, vy, s, stain, life: R.range(0.6, 1.25), age: 0 });
  const addBlob = (x, y, vx, vy, r) => blobs.push({ x, y, vx, vy, r, age: 0 });
  const addFume = (x, y, vx, vy, r0, r1, life) => fumes.push({ x, y, vx, vy, r0, r1, life, age: 0 });
  const addWisp = (x, y, big = false) => wisps.push({ x, y, t0: t, life: Math.min(R.range(0.55, 1.05) * (big ? 1.3 : 1), T_END - 0.05 - t), rise: R.range(22, 36), len: R.range(6, 13), amp: R.range(1.2, 2.6), k: R.range(0.32, 0.56), ph: R.range(0, TAU), drift: R.range(-5, 6) });
  const addRipple = (x, r1) => ripples.push({ x, y: R.range(-1, 2.5), r0: 1.5, r1, life: R.range(0.28, 0.5), age: 0 });

  return {
    update(dt) {
      t += dt;
      lights.update(dt);
      const f = Math.min(1, dt * 120);
      const tx = sweepAt(t);

      // Drool drops eating sizzling pits in front of monster jaws before blast
      if (t >= T_OPEN && t < T_BLAST && R.chance(0.45 * f)) {
        addDrop(MOUTH_X + R.range(-4, 6), MOUTH_Y + 4, R.range(6, 26), R.range(0, 20), R.chance(0.45) ? 2 : 1, true);
      }

      // Massive fluid deluge shedding heavy blobs & explosive splash drops
      if (t >= T_BLAST && t <= T_SHUT + 0.14) {
        const frontX = lerp(MOUTH_X, tx, clamp((t - T_BLAST) / (T_HIT - T_BLAST)));
        const tailX = t > T_SHUT ? lerp(MOUTH_X, tx, clamp((t - T_SHUT) / 0.16)) : MOUTH_X;
        if (tailX < frontX) {
          // Heavy viscous globs tearing off the stream belly
          if (R.chance(0.95 * f)) {
            const x = R.range(Math.max(tailX, MOUTH_X + 12), frontX);
            const yc = streamY(x, MOUTH_X, MOUTH_Y, tx);
            addBlob(x, yc + R.range(4, 10), R.range(55, 145), R.range(-10, 45), R.range(1.6, 3.4));
          }
          // Continuous violent splash spray where flood slams into floor
          if (t >= T_HIT) {
            if (!hitDone) {
              hitDone = true;
              lights.add(tx, -18, 52, C[5], 0.95, 0.55);
              lights.add(tx, -10, 26, WHITE, 0.8, 0.12);
              for (let i = 0; i < 42; i++) {
                const a = -Math.PI * 0.5 + R.range(-1.3, 1.3), sp = R.range(95, 290);
                addDrop(tx + R.range(-8, 10), -3, Math.cos(a) * sp + 48, Math.sin(a) * sp, R.chance(0.35) ? 3 : 2, true);
              }
              for (let i = 0; i < 9; i++) addFume(tx + R.range(-18, 24), -R.range(4, 14), R.range(-25, 62), -R.range(24, 58), 4.5, R.range(10, 14), R.range(0.65, 1.15));
            }
            if (R.chance(1.0 * f)) {
              const a = -Math.PI * 0.42 + R.range(-1.05, 1.05), sp = R.range(75, 235);
              addDrop(tx + R.range(-14, 22), -2, Math.cos(a) * sp + 45, Math.sin(a) * sp, R.chance(0.32) ? 3 : 2, false);
            }
            if (R.chance(0.55 * f)) addBlob(tx + R.range(-12, 18), -3, R.range(-50, 130), -R.range(90, 210), R.range(2.0, 4.0));
            if (R.chance(0.32 * f)) addFume(tx + R.range(-20, 42), -R.range(10, 22), R.range(-15, 65), -R.range(28, 56), 4.5, R.range(10, 14.5), R.range(0.65, 1.05));
            if (R.chance(0.28 * f)) ps.spawn(P.SPARK, tx + R.range(-18, 30), -2, R.range(-80, 130), -R.range(45, 170), R.range(0.14, 0.3));
          }
        }
      }

      // Post-shut jaw final drip
      if (t > T_SHUT && t < T_SHUT + 0.55 && R.chance(0.18 * f)) {
        addDrop(MOUTH_X + R.range(-2, 4), MOUTH_Y + 4, R.range(4, 18), 10, 2, true);
      }

      // Continuous acid corrosion swamp (T_HIT .. T_END)
      const heat = smooth(T_HIT, T_HIT + 0.35, t) * (1 - smooth(T_END - 0.52, T_END - 0.08, t));
      if (heat > 0.05) {
        if (R.chance(0.65 * heat * f)) pitBubbles.push({ x: HIT_X + 20 + R.range(-66, 78), y: R.range(-1.5, 3.0), age: 0, dur: R.range(0.24, 0.50), r: R.range(1.6, 3.8) });
        if (R.chance(0.48 * heat * f)) addWisp(HIT_X + 18 + R.range(-64, 74), R.range(-2, 1), false);
        if (R.chance(0.35 * heat * f)) pops.push({ x: HIT_X + 18 + R.range(-60, 72), y: R.range(-1, 2.5), age: 0, dur: 0.14 });
        if (R.chance(0.26 * heat * f)) ps.spawn(P.SPARK, HIT_X + 18 + R.range(-56, 68), -1, R.range(-24, 24), -R.range(24, 60), R.range(0.14, 0.28));
      }

      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.age += dt; d.vy += 760 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
        if (d.y >= 0 && d.vy > 0) {
          if (d.stain) stains.push({ x: d.x, t0: t, w: d.s * 1.1 + 0.8 });
          if (heat > 0.1) addRipple(d.x, 3 + d.s * 2);
          if (R.chance(0.35)) addWisp(d.x, -1, false);
          drops.splice(i, 1);
        } else if (d.age >= d.life) drops.splice(i, 1);
      }
      for (let i = blobs.length - 1; i >= 0; i--) {
        const b = blobs[i]; b.age += dt; b.vy += 740 * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y >= 0 && b.vy > 0) {
          if (heat > 0.08) addRipple(b.x, b.r * 2.2);
          else stains.push({ x: b.x, t0: t, w: b.r * 1.1 });
          if (R.chance(0.45)) addWisp(b.x, -1, false);
          blobs.splice(i, 1);
        }
      }
      for (let i = fumes.length - 1; i >= 0; i--) {
        const m = fumes[i]; m.age += dt; m.vx *= 1 - 2.1 * dt; m.vy -= 14 * dt; m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.age >= m.life) fumes.splice(i, 1);
      }
      for (let i = ripples.length - 1; i >= 0; i--) if ((ripples[i].age += dt) >= ripples[i].life) ripples.splice(i, 1);
      for (let i = pops.length - 1; i >= 0; i--) if ((pops[i].age += dt) >= pops[i].dur) pops.splice(i, 1);
      for (let i = pitBubbles.length - 1; i >= 0; i--) {
        const b = pitBubbles[i]; b.age += dt;
        if (b.age >= b.dur) { addRipple(b.x, b.r * 2.4); ps.spawn(P.SPARK, b.x, b.y - 2, R.range(-24, 24), -R.range(24, 54), 0.16); pitBubbles.splice(i, 1); }
      }
      for (let i = wisps.length - 1; i >= 0; i--) if (t - wisps[i].t0 >= wisps[i].life) wisps.splice(i, 1);
      for (let i = stains.length - 1; i >= 0; i--) if (t - stains[i].t0 > 1.2) stains.splice(i, 1);
      ps.update(dt);
    },

    draw(p) {
      const endFade = 1 - smooth(T_END - 0.25, T_END, t);
      if (endFade <= 0.01) return;
      const tx = sweepAt(t);

      // 1. Etched corrosive acid stains from falling drops & massive boiling acid swamp crater + glowing floor cracks
      for (const st of stains) {
        const k = 1 - (t - st.t0) / 1.2;
        p.line(st.x - st.w, 0, st.x + st.w, 0, SCORCH, k * 0.85 * endFade);
        p.line(st.x - st.w * 0.55, 0, st.x + st.w * 0.55, 0, C[4], k * 0.75 * endFade);
      }
      const poolK = smooth(T_HIT, T_HIT + 0.4, t) * (1 - smooth(T_END - 0.42, T_END, t));
      if (poolK > 0.02) {
        const cx = HIT_X + 20, rx = 80 * ease.outCubic(smooth(T_HIT, T_HIT + 0.58, t)), ry = 5.0;
        p.shade(cx - rx - 4, -3, cx + rx + 4, 8, (x, y, out) => {
          const dx = (x - cx) / Math.max(1, rx), dy = (y - 1.5) / ry;
          const wob = rag[((Math.round(x) + 320) % 140 + 140) % 140] * 0.24;
          const d = Math.hypot(dx, dy) + wob;
          if (d > 1.05) return;
          if (d > 0.88) { out.c = SCORCH; out.a = poolK * 0.9; return; }
          const n = noise2(x * 0.16 - t * 2.5, y * 0.45 + t * 0.8, S + 4);
          const vein = Math.abs(n) < 0.14;
          out.c = vein ? C[5] : n > 0.26 ? C[4] : n > -0.14 ? C[3] : C[1];
          out.a = poolK * 0.94;
        });
        const crackAge = t - T_HIT;
        const crackHeat = (d) => clamp(1 - d * 0.02 - smooth(1.2, 2.2, crackAge) * 0.85);
        const savedTx = p.tx, savedTy = p.ty;
        p.tx = savedTx + cx * p.fx * p.cs - 1 * p.sn;
        p.ty = savedTy + cx * p.fx * p.sn + 1 * p.cs;
        drawCracks(p, cracks, (c) => Math.max(0, (crackAge - c.t0) * 140), crackHeat, [C[6], C[5], C[4], C[3]], SCORCH, C[2], poolK * 0.85);
        p.tx = savedTx;
        p.ty = savedTy;
        for (const r of ripples) {
          const u = r.age / r.life, rr = lerp(r.r0, r.r1, ease.outQuad(u)), ka = (1 - u) * poolK;
          for (let a = 0; a < TAU; a += 0.35) p.dot(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr * SY, C[6], ka * 0.78);
        }
        p.glow(cx, -16, 48, C[4], 0.34 * poolK);
      }

      // 2. Monster head/neck
      const mInfo = o.monster ? drawMonster(p, t, C, B, S) : null;
      const mx = mInfo ? mInfo.mx : MOUTH_X, my = mInfo ? mInfo.my : MOUTH_Y;

      // 3. Elastic dripping venom drool strands between fangs
      if (t >= T_OPEN && t < T_BLAST + 0.05) {
        const dk = smooth(T_OPEN, 0.14, t) * (1 - smooth(T_BLAST, T_BLAST + 0.05, t));
        for (let i = 0; i < 4; i++) {
          const sx = mx - 7 + i * 3.8, sy = my - 5 + i * 1.4;
          const stretch = (9 + i * 8) * smooth(T_OPEN + i * 0.02, T_BLAST, t);
          p.line(sx, sy, sx + i * 0.4, sy + stretch, C[5], dk * 0.92);
          p.circle(sx + i * 0.4, sy + stretch, 1.4, C[6], dk);
        }
      }

      // 4. SOLID-COLUMN (ZERO STRIPES!) VOLUMINOUS VISCOUS LIQUID VENOM TORRENT
      if (t >= T_BLAST && t <= T_SHUT + 0.22) {
        const frontX = lerp(mx, tx + 6, clamp((t - T_BLAST) / (T_HIT - T_BLAST)));
        const tailX = t > T_SHUT ? lerp(mx, tx + 6, clamp((t - T_SHUT) / 0.20)) : mx;
        if (tailX < frontX - 1) {
          const xStart = Math.floor(tailX), xEnd = Math.ceil(frontX);
          for (let X = xStart; X <= xEnd; X++) {
            const u = clamp((X - mx) / Math.max(1, tx - mx));
            const yc = streamY(X, mx, my, tx);
            // Surging peristaltic fluid waves + frothy upper crest + sagging lower fluid belly
            const wave1 = Math.sin(u * 13 - t * 22) * (1.8 + 1.6 * u);
            const wave2 = Math.sin(u * 24 - t * 36) * (0.9 + 1.1 * u);
            const frontDist = frontX - X;
            const tailDist = t > T_SHUT ? X - tailX : 999;
            const frontCap = frontDist < 11 ? Math.sqrt(clamp(frontDist / 11)) : 1;
            const tailCap = tailDist < 12 ? Math.sqrt(clamp(tailDist / 12)) : 1;
            const frontBulge = frontDist < 14 ? Math.sin(clamp(frontDist / 14) * Math.PI) * 3.8 : 0;
            const halfW = (5.4 + 13.5 * Math.pow(u, 0.78) + wave1 + wave2 + frontBulge) * frontCap * tailCap;
            if (halfW < 0.7) continue;

            const topR = halfW * (0.86 + 0.18 * noise2(X * 0.14 - t * 14, 2, S + 2));
            const botR = halfW * (1.06 + 0.24 * noise2(X * 0.12 - t * 12, 7, S + 3));
            const yMin = Math.floor(yc - topR - 1), yMax = Math.min(1, Math.ceil(yc + botR + 1));

            for (let Y = yMin; Y <= yMax; Y++) {
              const dy = Y - yc;
              const q = dy < 0 ? dy / Math.max(1, topR) : dy / Math.max(1, botR);
              const aq = Math.abs(q);
              if (aq > 1.05) continue;

              const swirl = noise2(X * 0.11 - t * 15, dy * 0.24, S + 5);
              let col;
              if (aq > 0.88) col = q > 0 ? C[0] : C[1];
              else if (frontDist < 5 && aq < 0.55) col = C[6];
              else if (q < -0.58 && swirl > 0.05) col = C[6];
              else if (q > 0.45) col = swirl > 0.25 ? C[3] : C[2];
              else if (aq < 0.26 || swirl > 0.42) col = u < 0.18 && aq < 0.2 ? WHITE : C[6];
              else if (aq < 0.56 || swirl > 0.08) col = C[5];
              else col = C[4];
              p.px(X, Y, col);
              if (col === C[6] && (X & 3) === 0 && (Y & 1) === 0) p.light(X, Y, C[5], 0.2);
            }
          }
          // Spray spikes shooting off the blunt liquid head before impact
          if (t < T_HIT) {
            const headY = streamY(Math.min(tx, frontX), mx, my, tx);
            for (let k = -2; k <= 2; k++) {
              p.line(frontX - 2, headY + k * 2, frontX + 6 + Math.abs(k) * 1.5, headY + k * 3.5, k === 0 ? WHITE : C[5], 0.9);
            }
          }
          // Glowing high-pressure throat flare inside roaring jaws
          if (t < T_SHUT + 0.04) {
            const fl = (0.85 + 0.15 * Math.sin(t * 42)) * (1 - smooth(T_SHUT - 0.03, T_SHUT + 0.04, t));
            p.circle(mx + 2, my, 6.2 * fl, C[5]);
            p.circle(mx + 2, my, 3.6 * fl, WHITE);
            p.glow(mx + 3, my, 20, C[5], 0.58 * fl);
          }
          // Dynamic whipping liquid crests & surging lobes flying down the top of the torrent
          for (let s = 0; s < 5; s++) {
            const ph = (((t * 2.4 + s * 0.21) % 1) + 1) % 1;
            const lx = lerp(mx + 10, tx - 6, ph);
            if (lx < tailX || lx > frontX) continue;
            const ly = streamY(lx, mx, my, tx) - (5 + 8 * ph);
            const lr = (2.2 + 2.4 * Math.sin(ph * Math.PI)) * (1 - smooth(T_SHUT, T_SHUT + 0.14, t));
            if (lr > 0.6) {
              p.circle(lx, ly, lr + 0.8, C[0], 0.88);
              p.circle(lx, ly, lr, C[5]);
              p.circle(lx - lr * 0.25, ly - lr * 0.25, lr * 0.45, C[7]);
            }
          }
        }
      }

      // 5. High-Impact Fluid Splash Plumes, Initial Burst & Sweeping Toxic Surf at tx (0.41..1.72s)
      if (t >= T_HIT && t < T_SHUT + 0.28) {
        const hitAge = t - T_HIT;
        const burst = hitAge < 0.30 ? Math.sin(Math.PI * clamp(hitAge / 0.30)) : 0;
        const surgeK = smooth(T_HIT, T_HIT + 0.1, t) * (1 - smooth(T_SHUT, T_SHUT + 0.26, t));
        if (burst > 0.04) {
          const u = clamp(hitAge / 0.30);
          star(p, tx, -10, hitSpikes, 0.72 + 0.72 * ease.outCubic(u), 1 - u * 0.38, [C[1], C[4], C[6], WHITE], burst * 0.96, 3.6);
          brokenRing(p, tx, -10, 10 + 42 * ease.outCubic(u), 2.8, ringSegs, u, C[5], C[1], 1 - u, 0.36, 1);
        }
        // Dynamic upward-and-forward V-shaped liquid splash jets bursting from impact core
        for (let k = -4; k <= 5; k++) {
          const ph = ((t * 8.2 + k * 0.37) % 1 + 1) % 1;
          const rise = Math.sin(ph * Math.PI);
          const ang = -Math.PI * 0.5 + k * 0.22 + 0.25;
          const len = (12 + 24 * rise) * surgeK * (1 - Math.abs(k) * 0.06);
          if (len < 3) continue;
          const x0 = tx + k * 4.2, y0 = -2;
          const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
          p.line(x0 - 1.2, y0, x1 - 0.5, y1, C[0], surgeK * 0.75);
          p.line(x0, y0, x1, y1, (u) => (u > 0.65 ? C[6] : u > 0.3 ? C[5] : C[4]), surgeK * 0.95);
          if (rise > 0.5) p.circle(x1, y1, 1.8 * surgeK, WHITE, surgeK);
        }
        // Billowing frothy liquid splash collar around the crater base
        for (let k = -3; k <= 4; k++) {
          const ph = ((t * 6.8 + k * 0.45) % 1 + 1) % 1;
          const rise = Math.sin(ph * Math.PI);
          const bx = tx + k * 7.5 + ph * (k * 3 + 6);
          const by = -3 - rise * (8 + (4 - Math.abs(k)) * 2.4) * surgeK;
          const br = (2.8 + rise * 3.4) * surgeK * (1 - Math.abs(k) * 0.08);
          if (br < 0.8 || by > 0) continue;
          p.circle(bx, by, br + 0.8, C[0], surgeK * 0.85);
          p.circle(bx, by, br, k > 0 ? C[4] : C[3], surgeK * 0.92);
          p.circle(bx - br * 0.24, by - br * 0.28, br * 0.55, C[6], surgeK * 0.95);
        }
        // Bright foam collar & surging forward tidal toxic flood crescent racing right
        p.ellipse(tx + 8, -2, 22 * surgeK, 3.2 * surgeK, C[6], surgeK * 0.85);
        frontCrescent(p, tx + 26 + 52 * smooth(T_HIT, T_SHUT, t), 1, 24 * surgeK, 15 * surgeK, [C[7], C[5], C[3]], surgeK * 0.95);
        frontCrescent(p, tx - 14, -1, 15 * surgeK, 8 * surgeK, [C[5], C[3], C[1]], surgeK * 0.85);
      }

      // 6. Miasma plumes, falling heavy liquid blobs, spray droplets, boiling tar bubbles & steam wisps
      for (const m of fumes) {
        const u = m.age / m.life, rr = lerp(m.r0, m.r1, ease.outCubic(u)), a = smooth(0, 0.16, u) * (1 - smooth(0.42, 1, u));
        drawFume(p, m.x, m.y, rr, C, a * endFade);
      }
      for (const b of blobs) {
        p.circle(b.x, b.y, b.r + 0.8, C[0], 0.88 * endFade);
        p.circle(b.x, b.y, b.r, C[4], endFade);
        p.circle(b.x - b.r * 0.28, b.y - b.r * 0.28, b.r * 0.48, C[6], endFade);
      }
      for (const d of drops) {
        p.circle(d.x, d.y, d.s * 0.7 + 0.5, C[0], 0.78 * endFade);
        p.circle(d.x, d.y, d.s * 0.55, d.s >= 3 ? C[6] : C[5], endFade);
      }
      for (const b of pitBubbles) {
        const u = b.age / b.dur, r = b.r * (0.45 + 0.55 * ease.outQuad(u));
        p.circle(b.x, b.y, r + 0.7, C[0], poolK);
        p.circle(b.x, b.y, r, C[4], poolK);
        p.circle(b.x - r * 0.25, b.y - r * 0.25, r * 0.42, C[6], poolK);
        p.px(b.x - r * 0.35, b.y - r * 0.35, WHITE);
      }
      for (const pp of pops) {
        const u = pp.age / pp.dur, r = 2 + u * 2.6;
        p.line(pp.x - r, pp.y, pp.x + r, pp.y, C[6], (1 - u) * endFade);
        p.line(pp.x, pp.y - r * 0.6, pp.x, pp.y + r * 0.6, WHITE, (1 - u) * endFade);
      }
      for (const w of wisps) {
        const age = t - w.t0, u = age / w.life, head = w.rise * age, tail = Math.max(0, head - w.len), fade = smooth(0, 0.14, u) * (1 - smooth(0.45, 1, u));
        for (let h = tail; h <= head; h += 0.55) {
          const s = (h - tail) / Math.max(1, head - tail), wx = w.x + w.amp * Math.sin(h * w.k + w.ph) * (0.25 + s) + w.drift * age;
          p.blend(wx, w.y - h, STEAM, fade * Math.sin(Math.PI * s) * 0.44 * endFade);
        }
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}
