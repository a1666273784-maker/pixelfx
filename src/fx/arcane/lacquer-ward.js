// Impact starburst, broken shock-rings, surface ripple and looping Ghost particle physics build on Sprite Fusion's
// open-source shield and impact VFX (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { P, Rng, fit, sparkle, flare, band, clamp, lerp, smooth, ease, rand, luma, TAU, WHITE } from "../../core/index.js";
import { Ghosts, flash, since } from "../scifi/_lib.js";
import { shape, colorAt } from "../status/_lib.js";
import { spikes, star, brokenRing } from "../impacts/_lib.js";

const D = 3.6;
const T_WRAP = 0.66;   // Viscous black lacquer climbs ankles -> knees -> torso -> crown
const T_DRAIN = 3.06;  // Smooth viscous drain back into the underfoot pool for a zero-seam loop
const HIT1 = 1.16;
const HIT2 = 2.16;

export const meta = {
  name: "Lacquer ward",
  desc: "Black lacquer climbs from underfoot to coat the body in a mirror-gloss membrane with flowing golden huiwen, shattering heavy strikes in gold seals and glossy black splatter.",
  tags: ["arcane", "shield", "ward", "barrier", "lacquer", "armor", "gold", "chinese", "hit", "defense", "loop"],
  size: [268, 144],
  origin: [100, 116],
  duration: D,
  loop: true,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#06050a", "#130f19", "#331512", "#6b3810", "#b57616", "#f2b024", "#ffe578", "#fffdf0"],
    strike: ["#3d080c", "#96161c", "#f23e2e", "#ffd8bf"],
    seed: 7,
  },
};

// Martial-arts warding stances (all hands strictly within natural 14px shoulder reach)
const STAND_ = { turn: 0.9, crouch: 2, lean: 0, fx: -7, fy: -21, bx: 7, by: -21, ffx: -4, fbx: 5 };
const SURGE = { turn: 1, crouch: 4, lean: 0, fx: -8, fy: -19, bx: 8, by: -19, ffx: -5, fbx: 6 };
const WARD = { turn: 1, crouch: 3, lean: 1, fx: -5, fy: -26, bx: 6, by: -26, ffx: -5, fbx: 6 };
const BRACE1 = { turn: 0.85, x: -3, crouch: 6, lean: -2, fx: 7, fy: -26, bx: -4, by: -23, ffx: -3, fbx: 7 };
const BRACE2 = { turn: 0.8, x: -5, crouch: 7, lean: -3, fx: 8, fy: -28, bx: -3, by: -25, ffx: -2, fbx: 8 };

export const act = {
  onBody: true,
  poses: [
    [0, STAND_],
    [0.24, SURGE],
    [T_WRAP, WARD, "out"],
    [HIT1, WARD],
    [HIT1, BRACE1, "snap"],
    [HIT1 + 0.34, WARD],
    [HIT2, WARD],
    [HIT2, BRACE2, "snap"],
    [HIT2 + 0.44, WARD],
    [T_DRAIN, WARD],
    [D, STAND_],
  ],
  hits: [
    { t: HIT1, stop: 0.08, shake: 0.2, amp: 2.8 },
    { t: HIT2, stop: 0.14, shake: 0.32, amp: 4.4 },
  ],
  dust: [
    { t: HIT1, x: -8, n: 5, dir: -1 },
    { t: HIT2, x: -11, n: 10, dir: -1 },
  ],
};

// Crisp 1px-stroke 9x7 orthogonal Chinese Huiwen (回纹) meander tile
const HUIWEN_TILE = [
  "111111110",
  "100000010",
  "101111010",
  "101001010",
  "101011010",
  "101000000",
  "101111111",
];
const huiwenBit = (u, v) => {
  const iv = Math.floor(v);
  if (iv < 0 || iv >= 7) return false;
  const iu = ((Math.floor(u) % 9) + 9) % 9;
  return HUIWEN_TILE[iv].charCodeAt(iu) === 49;
};

function bodyWrapReach(t) {
  if (t < 0.48) return ease.inOutCubic(t / 0.48);
  if (t < T_DRAIN + 0.08) return 1;
  return 1 - ease.inOutCubic((t - (T_DRAIN + 0.08)) / (D - (T_DRAIN + 0.08)));
}

function wardShellReach(t) {
  if (t < 0.12) return 0;
  if (t < T_WRAP) return ease.outCubic((t - 0.12) / (T_WRAP - 0.12));
  if (t < T_DRAIN) return 1;
  return 1 - ease.inOutCubic((t - T_DRAIN) / (D - T_DRAIN));
}

// Rounded arch guardian ward silhouette (y in [-50, 0]) + exact Euclidean distance to silhouette edge!
function shellRxAt(y) {
  if (y < -50 || y > 0) return 0;
  if (y < -26) {
    const s = clamp((-26 - y) / 24, 0, 1);
    return 23 * Math.sqrt(Math.max(0, 1 - s * s));
  }
  const footFlare = y > -7 ? Math.pow((y + 7) / 7, 1.8) * 4.2 : 0;
  const waistTaper = -1.0 * Math.sin(((y + 26) / 26) * Math.PI);
  return 23 + waistTaper + footFlare;
}

// Exact pixel distance inward from the 2D arch contour (prevents any thick flat cap at the top pole!)
function shellEdgeDist(x, y) {
  if (y < -26) {
    const q = Math.hypot(x / 23, (y + 26) / 24);
    return (1 - q) * 23.5;
  }
  return shellRxAt(y) - Math.abs(x);
}

const SHOTS = [
  { t: HIT1, hx: 22, hy: -25, sx: 128, sy: -27, aim: -0.20, big: false },
  { t: HIT2, hx: 21, hy: -30, sx: 124, sy: -58, aim: -0.42, big: true },
];

// Dilate body mask by 2px once per actor so the warrior wears a bold, sculpted glossy black-lacquer sheath!
const sheathCache = new WeakMap();
function getActorSheath(A) {
  let s = sheathCache.get(A.mask);
  if (s) return s;
  const S = shape(A), outer2 = [];
  const seen = new Set();
  for (const [ox, oy] of S.outline) seen.add((oy + 4) * 64 + (ox + 4));
  for (const [ox, oy, nx, ny] of S.outline) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const x2 = ox + dx, y2 = oy + dy, k = (y2 + 4) * 64 + (x2 + 4);
      if (S.on(x2, y2) || seen.has(k)) continue;
      seen.add(k);
      outer2.push([x2, y2, nx, ny]);
    }
  }
  s = { S, outer2 };
  sheathCache.set(A.mask, s);
  return s;
}

const fxCache = new Map();
function getCached(o, C) {
  const key = `${o.seed}:${C.join()}`;
  if (fxCache.has(key)) return fxCache.get(key);
  const rn = new Rng(o.seed * 29 + 11);
  const star1 = spikes(rn, 12, -0.22, { len: [12, 19], w: [1.7, 2.5], fwd: 2.0, back: 0.55, jag: 0.56 });
  const star2 = spikes(rn, 16, -0.42, { len: [17, 27], w: [2.1, 3.2], fwd: 2.35, back: 0.7, jag: 0.52 });
  const ringSegs = Array.from({ length: 10 }, (_, i) => ({
    a: (i / 10) * TAU + rn.range(-0.1, 0.1),
    gap: rn.range(0.5, 0.86),
    dr: rn.range(0.08, 0.36),
    w: rn.range(0.85, 1.4),
  }));

  const g = new Ghosts(D, { ground: () => 0, sparks: [WHITE, C[6], C[5], C[3]], box: [-94, -110, 148, 22] });

  for (let i = 0; i < 24; i++) {
    const bt = 0.04 + (i / 24) * 0.56;
    const sd = i % 2 === 0 ? -1 : 1;
    g.add(bt, P.MOTE, sd * rn.range(8, 22), -rn.range(2, 42), sd * rn.range(12, 36), -rn.range(32, 76), rn.range(0.25, 0.48), i % 3 === 0 ? C[5] : C[6], 1);
  }

  for (let i = 0; i < 14; i++) {
    g.add((i / 14) * D, P.FLAKE, rn.range(-19, 19), -rn.range(4, 38), rn.range(-5, 5), -rn.range(12, 25), rn.range(0.55, 0.95), rn.pick([C[6], C[5]]), 1);
  }

  for (const s of SHOTS) {
    const m = s.big ? 1.55 : 1;
    for (let i = 0; i < Math.round(42 * m); i++) {
      const a = s.aim + rn.range(-1.18, 1.08);
      const sp = rn.range(135, 365) * (s.big ? 1.14 : 0.94);
      g.add(s.t + rn.range(0, 0.025), P.SPARK, s.hx, s.hy, Math.cos(a) * sp, Math.sin(a) * sp - 26, rn.range(0.25, 0.68));
    }
    for (let i = 0; i < Math.round(26 * m); i++) {
      const a = s.aim + rn.range(-1.25, 1.15);
      const sp = rn.range(68, 235);
      g.add(s.t + rn.range(0, 0.03), P.GRIT, s.hx + 1, s.hy, Math.cos(a) * sp, Math.sin(a) * sp - 36, rn.range(0.5, 0.94), i % 2 === 0 ? C[5] : C[3], i % 4 === 0 ? 2 : 1);
    }
    for (let i = 0; i < Math.round(8 * m); i++) {
      g.add(s.t + 0.02 + i * 0.045, P.STAR, s.hx + rn.range(-10, 18), s.hy + rn.range(-14, 10), rn.range(6, 26), -rn.range(8, 24), rn.range(0.28, 0.52), i % 2 ? WHITE : C[6], rn.range(1.4, 2.5));
    }
  }

  const res = { star1, star2, ringSegs, ghosts: g };
  fxCache.set(key, res);
  return res;
}

// Underfoot pool of mirror-polished JET-BLACK raw lacquer (curved concentric meniscus gloss — NO straight stripes!)
function drawLacquerPool(p, t, C, near) {
  const ph = t / D;
  const a1 = since(t, HIT1, D), a2 = since(t, HIT2, D);
  const pulse = (a1 < 0.3 ? (1 - a1 / 0.3) * 2.6 : 0) + (a2 < 0.38 ? (1 - a2 / 0.38) * 4.5 : 0);
  const rx = 34 + 1.2 * Math.sin(ph * TAU * 2) + pulse;
  const ry = 7.4 + pulse * 0.16;
  const y0 = near ? 0 : -Math.ceil(ry);
  const y1 = near ? Math.ceil(ry) : -1;

  for (let y = y0; y <= y1; y++) {
    for (let x = -Math.ceil(rx) - 1; x <= Math.ceil(rx) + 1; x++) {
      const nx = x / rx, ny = (y - 0.5) / ry;
      const d = Math.hypot(nx, ny);
      if (d > 1.02) continue;
      const ang = Math.atan2(ny, nx);

      // Fine inlaid gold Huiwen key-border right inside the outer obsidian lip
      const inGoldKey = d > 0.77 && d < 0.92;
      const keyPattern = (((Math.floor((ang / TAU + ph) * 32) + Math.floor((d - 0.77) * 20)) & 1) === 0);

      let col;
      if (d > 0.93) {
        col = near && ny > 0.3 ? C[5] : C[1];
      } else if (inGoldKey && keyPattern) {
        const chase = 0.5 + 0.5 * Math.sin(ang * 2 - ph * TAU * 3);
        col = pulse > 1.2 || chase > 0.82 ? C[7] : chase > 0.38 ? C[5] : C[3];
      } else {
        // Curved concentric wet-lacquer specular crescents hugging the pool's oval surface!
        const crescent1 = Math.abs(d - (0.48 + 0.05 * Math.sin(ph * TAU * 2))) < 0.055 && Math.cos(ang + 2.1 - ph * TAU) > 0.58;
        const crescent2 = Math.abs(d - 0.66) < 0.045 && Math.cos(ang - 0.9 + ph * TAU) > 0.68;
        const urushi = Math.sin(d * 16 - ph * TAU * 3) > 0.82;
        col = crescent1 ? WHITE : crescent2 ? C[7] : urushi ? C[2] : C[0];
      }
      p.px(x, y, col);
    }
  }
}

// Viscous black-lacquer tendrils pulling upward from the underfoot pool (kept flanking while sustained so hero center stays clear!)
function drawViscousClimbRibbons(p, t, C, bReach, sReach, near) {
  if (bReach <= 0.02) return;
  const ph = t / D;
  for (let k = 0; k < 6; k++) {
    const baseAng = ph * TAU * 2 + (k * TAU) / 6;
    const surgeBoost = bReach < 0.96 ? 1 : 0.36;
    const maxH = (42 * surgeBoost + (k % 2) * 7) * bReach;
    for (let h = 0; h <= maxH; h++) {
      const u = h / Math.max(1, maxH);
      const ang = baseAng + u * 1.35 * (k % 2 ? 1 : -1);
      const z = Math.sin(ang);
      if ((z >= 0) !== near) continue;
      // Keep sustained front ribbons off dead-center so they frame the lacquered warrior!
      if (near && bReach >= 0.96 && Math.abs(Math.cos(ang)) < 0.42 && h > 9) continue;
      const bodyR = lerp(18, 10, clamp(h / 42, 0, 1));
      const domeR = shellRxAt(-h) * 0.96;
      const r = lerp(bodyR, domeR, sReach * 0.75);
      const cx = Math.cos(ang) * r;
      const hw = lerp(2.1, 0.5, u);
      for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
        if (Math.abs(dx) > hw) continue;
        const wetSpec = near && Math.abs(dx + hw) < 0.75;
        const goldLead = bReach < 0.96 && u > 0.82;
        p.dot(cx + dx, -h, goldLead ? C[6] : wetSpec ? WHITE : C[0], near ? 0.95 : 0.5);
      }
    }
  }
}

// Sculpted Clear-Window Mirror-Gloss Lacquer Membrane ("亮膜") + Flowing 3D Golden Huiwen Sashes!
function drawLacquerMembrane(p, t, C, sReach, near) {
  if (sReach <= 0.02) return;
  const ph = t / D;
  const a1 = since(t, HIT1, D), a2 = since(t, HIT2, D);

  for (let y = -50; y <= 0; y++) {
    const curRx = shellRxAt(y);
    if (curRx < 1) continue;

    for (let x = -Math.ceil(curRx); x <= Math.ceil(curRx); x++) {
      const edgePx = shellEdgeDist(x, y);
      if (edgePx < 0) continue;
      const u = clamp(x / curRx, -1, 1);
      const vz = Math.sqrt(Math.max(0, 1 - u * u)) * (near ? 1 : -1);
      const lon = Math.atan2(u, vz);
      const rim = 1 - Math.abs(vz);

      const tongue =
        0.09 * Math.sin(lon * 3 + ph * TAU * 3) +
        0.05 * Math.cos(lon * 5 - ph * TAU * 4);
      const localReach = clamp(sReach * 1.14 - 0.07 + (sReach > 0.04 && sReach < 0.97 ? tongue : 0), 0, 1);
      const topY = -50 * localReach;
      if (y < topY) continue;
      const crestDist = y - topY;
      const onMeniscus = sReach < 0.97 && crestDist < 2.6;

      // Impact shockwaves racing across the curved lacquer membrane
      let hitWave = 0, hitHot = 0;
      for (const [s, age] of [[SHOTS[0], a1], [SHOTS[1], a2]]) {
        if (age < 0.76) {
          const dist = Math.hypot((x - s.hx) * 0.042, (y - s.hy) * 0.038);
          const front = age * 3.6;
          const ring = Math.exp(-(((dist - front) / 0.16) ** 2)) * (1 - age / 0.76);
          const echo = age > 0.08 ? 0.55 * Math.exp(-(((dist - (age - 0.08) * 2.8) / 0.13) ** 2)) * (1 - age / 0.76) : 0;
          hitWave = Math.max(hitWave, (ring + echo) * (s.big ? 1.48 : 1.1));
          const hr = s.big ? 0.52 : 0.36;
          if (age < 0.25 && dist < hr) {
            hitHot = Math.max(hitHot, (1 - age / 0.25) * (1 - dist / hr));
          }
        }
      }

      // Open-filigree Flowing Golden Huiwen Sashes (upper & lower counter-rotating orbital belts)
      const sash1Y = -37 + 5.0 * Math.sin(lon + ph * TAU);
      const sash2Y = -12 - 4.5 * Math.sin(lon - ph * TAU);
      let activeHuiwen = false;
      if (Math.abs(y - sash1Y) <= 3.5) {
        activeHuiwen = huiwenBit((lon / TAU) * 45 + ph * 18, y - (sash1Y - 3.5));
      } else if (Math.abs(y - sash2Y) <= 3.5) {
        activeHuiwen = huiwenBit((lon / TAU) * 45 - ph * 18, y - (sash2Y - 3.5));
      }

      // Dormant full-surface Huiwen ward lattice that IGNITES across the membrane when struck!
      const shockHuiwen = hitWave > 0.16 && huiwenBit((lon / TAU) * 45, (-y * 0.95) % 7);

      // Clear visibility window right over the lacquered warrior's head & upper chest!
      const heroWindow = Math.abs(x) < 10 && y >= -39 && y <= -16;

      if (!near) {
        if (onMeniscus) p.blend(x, y, C[5], 0.42);
        else if (activeHuiwen || shockHuiwen) {
          p.blend(x, y, hitWave > 0.35 ? C[6] : C[4], clamp((heroWindow ? 0.12 : 0.28) + 0.55 * hitWave));
        } else if (edgePx < 3.2) {
          p.blend(x, y, C[0], 0.32);
        }
        continue;
      }

      // NEAR SIDE:
      if (onMeniscus) {
        p.px(x, y, crestDist < 1.1 ? WHITE : crestDist < 1.9 ? C[6] : C[0]);
        continue;
      }

      if (hitHot > 0.64) {
        p.px(x, y, huiwenBit(x, y) ? C[6] : WHITE);
        continue;
      }

      // 1) TRUE UNIFORM 1.4px WET MIRROR-GLOSS SILHOUETTE RIM ("亮膜") + 1.8px INNER JET-BLACK LACQUER BAND!
      //    Uses exact Euclidean `edgePx` so the arch crown is a razor-clean 1.4px highlight curve (NEVER a flat white cap!)
      const sheenSweep = Math.sin(lon * 1.4 - (y / 50) * 2.1 - ph * TAU * 2);
      if (edgePx <= 1.35) {
        const litTopLeft = x < 4 && y < -8;
        const rCol = hitWave > 0.28 || litTopLeft || sheenSweep > 0.82 ? WHITE : x > 9 ? C[6] : C[2];
        p.px(x, y, rCol);
        if (litTopLeft || hitWave > 0.3) p.light(x, y, C[6], 0.18);
        continue;
      }
      if (edgePx <= 3.1 && !activeHuiwen && !shockHuiwen) {
        p.dot(x, y, hitWave > 0.42 ? C[5] : C[0], 0.92);
        continue;
      }

      // 2) FLOWING GOLDEN HUIWEN MEANDERS & SHOCKWAVE-IGNITED HUIWEN LATTICE
      if (activeHuiwen || shockHuiwen) {
        const flowPulse = 0.5 + 0.5 * Math.sin(lon * 3 - ph * TAU * 4 + y * 0.1);
        const gCol =
          hitWave > 0.36 || hitHot > 0.22 || flowPulse > 0.88 ? WHITE :
          flowPulse > 0.52 || rim > 0.45 ? C[6] :
          flowPulse > 0.2 ? C[5] : C[4];
        if (activeHuiwen) {
          const aH = heroWindow && hitWave < 0.2 ? 0.42 : 0.96;
          p.blend(x, y, gCol, aH);
          if (flowPulse > 0.82 || hitWave > 0.3) p.light(x, y, C[5], (heroWindow ? 0.08 : 0.18) + 0.26 * hitWave);
        } else {
          p.blend(x, y, gCol, clamp(hitWave * 1.35));
        }
        continue;
      }

      // 3) WET MIRROR-GLOSS SPECULAR HIGHLIGHT CRESCENT ("水亮漆膜反光弧" on upper-left shoulder of dome!)
      const vy = (y + 27) / 23;
      const glossArc = u < -0.48 && u > -0.80 && vy > -0.80 && vy < 0.24 && Math.abs(u + 0.64 + vy * 0.15) < 0.06;
      if (glossArc) {
        p.px(x, y, vy < -0.25 ? WHITE : C[7]);
        continue;
      }

      // 4) CRYSTAL-CLEAR WINDOW OVER HERO, RICH SMOKED-OBSIDIAN TOWARD GRAZING EDGES
      const filmA = clamp((heroWindow ? 0.0 : 0.03) + 0.36 * Math.pow(rim, 3.4) + 0.36 * hitWave + (sheenSweep > 0.91 && !heroWindow ? 0.18 : 0));
      if (filmA > 0.05) {
        const filmC = hitWave > 0.45 ? C[6] : sheenSweep > 0.91 ? C[7] : rim > 0.52 ? C[2] : C[0];
        p.blend(x, y, filmC, filmA);
      }
    }
  }
}

// Multi-ring Stepped Golden Huiwen Imperial Ward Seal (巨型鎏金回纹护印) stamping at the hit point!
function drawHuiwenImpactSeal(p, cx, cy, age, big, C) {
  const dur = big ? 0.60 : 0.46;
  if (age >= dur) return;
  const k = age / dur;
  const fade = 1 - smooth(0.28, 1, k);
  const R = Math.round((big ? 20 : 14) * ease.outBack(clamp(k * 3.8), 1.55));
  if (R < 3) return;
  const colOuter = age < 0.06 ? WHITE : age < 0.18 ? C[7] : C[6];
  const colInner = age < 0.09 ? WHITE : C[5];
  const sx = 0.76;

  const hSeg = (x0, x1, y, c, a) => {
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    for (let x = lo; x <= hi; x++) p.blend(x, Math.round(y), c, a);
  };
  const vSeg = (x, y0, y1, c, a) => {
    const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
    for (let y = lo; y <= hi; y++) p.blend(Math.round(x), y, c, a);
  };
  const box = (rx, ry, c, a) => {
    const x0 = Math.round(cx - rx), x1 = Math.round(cx + rx);
    const y0 = Math.round(cy - ry), y1 = Math.round(cy + ry);
    hSeg(x0, x1, y0, c, a);
    vSeg(x1, y0, y1, c, a);
    hSeg(x0, x1, y1, c, a);
    vSeg(x0, y0, y1, c, a);
  };

  box(R * sx, R, colOuter, fade);
  const r2 = R * 0.64, r3 = R * 0.34;
  box(r2 * sx, r2, colInner, fade * 0.92);
  const xL = Math.round(cx - r3 * sx), xR = Math.round(cx + r3 * sx);
  const yT = Math.round(cy - r3), yB = Math.round(cy + r3);
  hSeg(xL, xR, yT, WHITE, fade);
  vSeg(xR, yT, cy, WHITE, fade);
  hSeg(cx, xR, cy, colOuter, fade);
  vSeg(xL, yT, yB, colOuter, fade);
  hSeg(xL, xR, yB, colOuter, fade);

  if (big && k < 0.65) {
    const pin = Math.round(8 * (1 - k / 0.65));
    vSeg(cx, cy - R - 2 - pin, cy - R - 2, WHITE, fade);
    vSeg(cx, cy + R + 2, cy + R + 2 + pin, WHITE, fade);
    hSeg(cx + R * sx + 2, cx + R * sx + 2 + pin, cy, WHITE, fade);
  }
}

// High-contrast viscous jet-black raw-lacquer splash globs (gold/white rimmed obsidian beads!)
function drawLacquerSplatter(p, s, age, C) {
  const dur = s.big ? 0.68 : 0.52;
  if (age >= dur) return;
  const n = s.big ? 20 : 13;
  for (let i = 0; i < n; i++) {
    const ang = s.aim + (rand(i, s.big ? 31 : 13) - 0.5) * 2.25;
    const sp = (74 + rand(i, 47) * 155) * (s.big ? 1.16 : 0.96);
    const drag = (1 - Math.exp(-3.1 * age)) / 3.1;
    const dx = s.hx + Math.cos(ang) * sp * drag;
    const rawY = s.hy + Math.sin(ang) * sp * drag + 235 * age * age;
    if (dx > 148 || dx < -90 || rawY < -108) continue;

    if (rawY >= 0) {
      const pFade = 1 - smooth(0.52, 1, age / dur);
      if (pFade > 0.08) {
        const pw = i % 3 === 0 ? 3 : 2;
        p.line(dx - pw - 1, 0, dx + pw + 1, 0, C[5], pFade * 0.75);
        p.line(dx - pw, 0, dx + pw, 0, C[0], pFade);
        p.dot(dx - 1, 0, WHITE, pFade * 0.9);
      }
      continue;
    }

    const r = i % 4 === 0 ? 2.5 : i % 2 === 0 ? 1.9 : 1.3;
    const vx = Math.cos(ang) * sp * Math.exp(-3.1 * age);
    const vy = Math.sin(ang) * sp * Math.exp(-3.1 * age) + 470 * age;
    const vLen = Math.hypot(vx, vy) || 1;
    p.line(dx, rawY, dx - (vx / vLen) * (r * 2.9), rawY - (vy / vLen) * (r * 2.9), C[4]);
    p.circle(dx, rawY, r + 0.55, i % 2 === 0 ? C[5] : C[3]);
    p.circle(dx, rawY, r, C[0]);
    p.px(dx - 0.6, rawY - 0.6, WHITE);
  }
}

function drawTaperedGleam(p, xA, yA, xB, yB, halfW, colCore, colEdge, alpha) {
  if (alpha <= 0.03 || halfW <= 0.15) return;
  const dx = xB - xA, dy = yB - yA, len = Math.hypot(dx, dy);
  if (len < 2) return;
  const nx = -dy / len, ny = dx / len, steps = Math.ceil(len * 1.4);
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const hw = halfW * Math.sin(Math.PI * u);
    const bx = xA + dx * u, by = yA + dy * u, span = Math.ceil(hw);
    for (let w = -span; w <= span; w++) {
      if (Math.abs(w) > hw + 0.2) continue;
      p.dot(Math.round(bx + nx * w), Math.round(by + ny * w), Math.abs(w) <= hw * 0.45 ? colCore : colEdge, alpha);
    }
  }
}

// Menacing incoming attack visuals: blazing crimson spear-lance (HIT1) & towering 36px crimson blade-crescent (HIT2)!
function drawIncomingStrike(p, s, tk, ST) {
  const k = ease.inQuad(tk);
  const hx = lerp(s.sx, s.hx, k), hy = lerp(s.sy, s.hy, k);

  if (!s.big) {
    const tailK = Math.max(0, k - 0.56);
    const tx = lerp(s.sx, s.hx, tailK), ty = lerp(s.sy, s.hy, tailK);
    drawTaperedGleam(p, tx, ty, hx, hy, 3.2, WHITE, ST[2], 1);
    const mx = lerp(tx, hx, 0.58), my = lerp(ty, hy, 0.58);
    p.line(mx, my - 5, mx + 3, my + 5, ST[3], 0.85);
    p.glow(hx, hy, 20, ST[2], 0.8);
  } else {
    // Towering crimson blade-wave crescent + two ghostly motion-afterimage crescents & tip streamers!
    const dirA = Math.atan2(s.hy - s.sy, s.hx - s.sx);
    const perpX = -Math.sin(dirA), perpY = Math.cos(dirA);
    const backX = -Math.cos(dirA), backY = -Math.sin(dirA);

    for (const [lag, alpha] of [[24, 0.28], [12, 0.52], [0, 1]]) {
      const cx = hx + backX * lag, cy = hy + backY * lag;
      const span = lag === 0 ? 19 : 16;
      for (let v = -span; v <= span; v += 0.65) {
        const nv = v / span;
        const curve = nv * nv * 13.5;
        const thick = (1 - nv * nv) * (lag === 0 ? 5.8 : 3.4) + 0.6;
        const bx = cx + perpX * v + backX * curve;
        const by = cy + perpY * v + backY * curve;
        for (let d = 0; d <= thick; d += 0.85) {
          const col = lag > 0 ? (d < 1.4 ? ST[2] : ST[1]) : d < 1.4 ? WHITE : d < thick * 0.48 ? ST[3] : d < thick * 0.82 ? ST[2] : ST[0];
          p.blend(Math.round(bx + backX * d), Math.round(by + backY * d), col, alpha);
        }
      }
    }
    // Horn-tip crimson wind streamers trailing off the upper and lower crescent tips!
    for (const sg of [-1, 1]) {
      const tipX = hx + perpX * sg * 18.5 + backX * 13;
      const tipY = hy + perpY * sg * 18.5 + backY * 13;
      p.line(tipX, tipY, tipX + backX * 22, tipY + backY * 22, ST[2], 0.72);
    }
    p.glow(hx + backX * 4, hy + backY * 4, 30, ST[2], 0.85);
  }
}

export function drawBack(p, t, o) {
  const C = fit(o.palette, 8);
  const bReach = bodyWrapReach(t), sReach = wardShellReach(t);
  drawLacquerPool(p, t, C, false);
  drawViscousClimbRibbons(p, t, C, bReach, sReach, false);
  drawLacquerMembrane(p, t, C, sReach, false);

  for (const s of SHOTS) {
    const age = since(t, s.t, D), dur = s.big ? 0.56 : 0.42;
    if (age < dur) {
      const q = age / dur;
      const r = 18 + (s.big ? 82 : 56) * ease.outQuart(q);
      band(p, 0, 0.5, r, 0.2, Math.max(1, (s.big ? 4.6 : 3.2) * (1 - q)), 1 - smooth(0.45, 1, q), [C[0], C[4], C[6], C[7]], (g) => Math.sin(g) < 0, q < 0.16);
    }
  }
  p.glow(0, -25, 42, C[4], 0.15 * sReach);
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8), ST = fit(o.strike, 4), A = o.actor;
  const bReach = bodyWrapReach(t), sReach = wardShellReach(t), ph = t / D;
  const { star1, star2, ringSegs, ghosts } = getCached(o, C);

  // 1) HERO BODY LACQUER ENCASEMENT ("黑漆从脚下裹上全身形成一层亮膜"):
  //    2px dilated wet-specular + obsidian sheath + flowing golden inlays so the warrior inside POPS heroically!
  if (A && bReach > 0.01) {
    const { S, outer2 } = getActorSheath(A), H = S.h;
    // Outer 2nd-pixel bright golden/specular aura rim around the body
    for (const [x2, y2, nx, ny] of outer2) {
      const up = 1 - (y2 + 0.5) / H;
      const wave = 0.07 * Math.sin(x2 * 0.55 + ph * TAU * 3);
      if (up > bReach + wave) continue;
      const lit = nx * -0.68 + ny * -0.73;
      if (lit > 0.15) p.blend(A.x + x2, A.y + y2, lit > 0.55 ? C[7] : C[5], 0.72);
    }
    // Inner 1st-pixel crisp wet-gloss membrane rim hugging every limb, shoulder & helm!
    for (const [ox, oy, nx, ny] of S.outline) {
      const up = 1 - (oy + 0.5) / H;
      const wave = 0.07 * Math.sin(ox * 0.55 + ph * TAU * 3);
      if (up > bReach + wave) continue;
      const lit = nx * -0.68 + ny * -0.73;
      p.px(A.x + ox, A.y + oy, lit > 0.25 ? WHITE : lit > -0.35 ? C[6] : C[2]);
    }
    // Body interior: mirror-polished jet-black obsidian lacquer + warm urushi bevels + flowing gold trim!
    for (const [mx, my] of S.body) {
      const up = 1 - (my + 0.5) / H;
      const wave = 0.07 * Math.sin(mx * 0.55 + ph * TAU * 3);
      if (up > bReach + wave) continue;
      const x = A.x + mx, y = A.y + my;
      const edge = bReach + wave - up;
      const origL = luma(colorAt(A, mx, my));
      const topLeftEdge = !S.on(mx - 1, my) || !S.on(mx, my - 1);
      const goldArmorFlow =
        ((my === 9 || my === 20 || my === 29) && ((mx + Math.floor(ph * 18)) & 3) !== 0) ||
        (my >= 12 && my <= 17 && mx >= 9 && mx <= 15 && huiwenBit(mx + ph * 18, my - 11));

      if (edge < 0.065 && bReach < 0.98) p.px(x, y, edge < 0.03 ? WHITE : C[6]);
      else if (goldArmorFlow) p.px(x, y, C[6]);
      else if (topLeftEdge && origL > 0.22) p.px(x, y, origL > 0.48 ? WHITE : C[7]);
      else p.px(x, y, origL > 0.58 ? C[2] : origL > 0.28 ? C[1] : C[0]);
    }
  }

  // 2) NEAR SIDE OF JET-BLACK LACQUER POOL, VISCOUS CLIMB RIBBONS & CLEAR-WINDOW HUIWEN MEMBRANE
  drawLacquerPool(p, t, C, true);
  drawViscousClimbRibbons(p, t, C, bReach, sReach, true);
  drawLacquerMembrane(p, t, C, sReach, true);

  // Crown-seal flash when the rising lacquer membrane locks shut over the warrior's head!
  const sealAge = since(t, T_WRAP - 0.02, D);
  if (sealAge < 0.24) {
    const sk = 1 - sealAge / 0.24;
    sparkle(p, 0, -50, 10 * sk, WHITE, C[6], 0.72);
    p.glow(0, -48, 24, C[5], 0.44 * sk);
  }

  // 3) FIERCE INCOMING STRIKES & EXPLOSIVE GOLDEN-HUIWEN + BLACK-LACQUER DEFLECTION!
  for (const s of SHOTS) {
    const leadDur = s.big ? 0.14 : 0.11;
    const tk = (t - (s.t - leadDur)) / leadDur;
    if (tk >= 0 && tk < 1) drawIncomingStrike(p, s, tk, ST);

    const age = since(t, s.t, D);

    // Near half of perspective ground shockwaves (twin rings on the heavy climax hit!)
    const fDur = s.big ? 0.56 : 0.42;
    if (age < fDur) {
      const q = age / fDur;
      const r = 18 + (s.big ? 82 : 56) * ease.outQuart(q);
      band(p, 0, 0.5, r, 0.2, Math.max(1, (s.big ? 4.6 : 3.2) * (1 - q)), 1 - smooth(0.45, 1, q), [C[0], C[4], C[6], C[7]], (g) => Math.sin(g) >= 0, q < 0.16);
      if (s.big && age > 0.06) {
        const q2 = (age - 0.06) / (fDur - 0.06);
        band(p, 0, 0.5, 14 + 58 * ease.outQuart(q2), 0.2, Math.max(1, 2.8 * (1 - q2)), (1 - q2) * 0.85, [C[0], C[3], C[5], C[6]], (g) => Math.sin(g) >= 0, false);
      }
    }

    // Expanding broken golden shockwave rings bursting off the ward impact point
    const rDur = s.big ? 0.40 : 0.28;
    if (age < rDur) {
      const rq = age / rDur;
      brokenRing(p, s.hx, s.hy, 9 + (s.big ? 48 : 33) * ease.outQuart(rq), (s.big ? 3.6 : 2.5) * (1 - 0.65 * rq), ringSegs, rq, rq < 0.25 ? WHITE : C[6], C[4], 1 - smooth(0.55, 1, rq), 1, 0);
    }

    drawHuiwenImpactSeal(p, s.hx, s.hy, age, s.big, C);
    drawLacquerSplatter(p, s, age, C);

    if (age < (s.big ? 0.13 : 0.09)) {
      const hk = 1 - age / (s.big ? 0.13 : 0.09);
      const lenG = s.big ? 56 : 36;
      drawTaperedGleam(p, s.hx - 12, s.hy + lenG * 0.65, s.hx + 19, s.hy - lenG, (s.big ? 3.8 : 2.6) * hk, WHITE, C[6], hk);
    }
    if (age < 0.075) {
      const hot = age < 0.036;
      const spList = s.big ? star2 : star1;
      star(p, s.hx, s.hy, spList, hot ? 1.08 : 1.36, hot ? 1 : 0.58, [C[4], C[6], C[7], WHITE], 1, s.big ? 3.6 : 2.6);
      flare(p, s.hx, s.hy, (s.big ? 60 : 40) * (1 - age / 0.075), 1 - age / 0.075, [C[4], C[6], C[7], WHITE]);
    }

    flash(p, t, s.t, s.hx, s.hy, s.big ? 86 : 58, C[5], s.big ? 0.74 : 0.56, 0.42);
    flash(p, t, s.t, s.hx, s.hy, s.big ? 30 : 20, WHITE, 0.8, 0.1);
  }

  ghosts.at(t).draw(p);
}
