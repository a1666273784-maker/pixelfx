// Ancient moss boulder throw ("moves/moss-boulder-throw"):
// 1. Ground Tremor & Levitation (0.00..0.62s): Caster stamps the earth; tilted bedrock slabs heave and glowing
//    emerald-jade fault lines crack open as a wide cyclonic ochre dust storm and coiling emerald moss spiritual
//    qi heave a colossal moss-crusted granite boulder and satellite cobbles out of the trembling ground.
// 2. Supersonic Hurl & Mach Slipstream (0.62..0.94s): Hurled through a sound-barrier vapor ring, punching staggered
//    parabolic Mach air-cones while pulling out translucent boulder silhouettes, thick slipstream sheaths, and grit.
// 3. Oppressive Being-Hit & Catastrophic Shatter (0.94..2.60s): Slams into the enemy's chest, splitting along
//    blinding white-jade fault seams with a blow-through exit cone before detonating into sky-high all-directional
//    tumbling moss-rock shrapnel and a massive 3D-perspective expanding ring of billowing dust shockwaves.
// 4. Knockback & Stun (1.00..3.50s): Blasts the enemy skidding 46 px backward down twin ploughed dirt furrows and
//    leaves a tilted 3D orbit of spinning golden dizzy stars and moss-spirit pips above the dazed target's head.

import { Particles, Bits, Lights, P, PF, B, Rng, fit, flare, sparkle, clamp, smooth, lerp, ease, rand, mix, TAU, WHITE, READY } from "../../core/index.js";
import { stoneShape, drawRock, drawLeaf } from "../nature/_lib.js";
import { spikes, star, brokenRing, makeCracks, drawCracks, frontCrescent, dustRing } from "../impacts/_lib.js";
import { icon, shaped, starShape } from "../status/_lib.js";

const TX = 184;
const KNOCK_DIST = 46;
const T_STAMP = 0.03;
const T_THROW = 0.62;
const T_HIT = 0.94;
const T_SHATTER = 1.00;
const T_END = 3.50;

const R_BOULDER = 24.0;
const RSY = 0.20;

export const meta = {
  name: "Moss boulder throw",
  desc: "Rips a colossal moss-aura boulder from a trembling dust storm, hurls it in a thick sonic-boom wake, and shatters it on the enemy with a dust shockwave, knockback, and stun.",
  tags: ["move", "nature", "earth", "moss", "boulder", "rock", "projectile", "shockwave", "knockback", "stun", "boss", "one-shot"],
  size: [476, 224],
  origin: [88, 176],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#05130c", "#0c2818", "#164828", "#23733b", "#39a852", "#67de72", "#a8f99e", "#e2ffd8", "#ffffff"],
    stone: ["#0b0910", "#1a1623", "#2d2738", "#463d54", "#655a75", "#8a7f99", "#b5aac4", "#e4ddef"],
    dust: ["#18120e", "#2e2219", "#4a3829", "#6d533d", "#957656", "#bfa07a", "#e8d2b2"],
    stun: ["#3b1d0a", "#8a4812", "#d98b1c", "#f7c534", "#ffe878", "#ffffff"],
    seed: 19,
  },
};

// Caster choreography: knee-lift -> heavy ground stamp -> strain upward under colossal boulder -> deep coil -> explosive hurl -> brace -> recover
const GUARD = { ...READY, x: 0, crouch: 3, lean: 2, fx: 11, fy: -21, bx: 9, by: -21, ffx: 8, fbx: -8 };
const LIFT_KNEE = { ...READY, x: -2, crouch: 2, lean: -2, turn: 0.78, fx: -4, fy: -31, bx: 6, by: -30, ffx: 5, ffy: -8, fbx: -7 };
const STAMP_REND = { ...READY, x: 2, crouch: 8, lean: 5, turn: 0.82, fx: 12, fy: -13, bx: 5, by: -15, armsFront: true, ffx: 11, ffy: 0, fbx: -9 };
const HEAVE_LIFT = { ...READY, x: -2, crouch: 5, lean: -2, turn: 0.94, fx: -6, fy: -34, bx: 8, by: -33, ffx: 8, fbx: -8 };
const COIL_BACK = { ...READY, x: -6, crouch: 6, lean: -5, turn: 0.66, fx: -9, fy: -36, bx: 4, by: -32, armsFront: true, ffx: 7, fbx: -10 };
const HURL_SNAP = { ...READY, x: 12, crouch: 5, lean: 7, turn: 0.46, fx: 22, fy: -24, bx: -4, by: -23, ffx: 14, fbx: -10, toeB: true, ghost: 1 };
const HURL_FOLLOW = { ...HURL_SNAP, x: 13, crouch: 6, lean: 8, fx: 23, fy: -21, bx: -5, by: -22, ghost: 0 };
const IMPACT_BRACE = { ...READY, x: 10, crouch: 6, lean: 4, fx: 17, fy: -24, bx: -3, by: -22, ffx: 12, fbx: -9 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.32, GUARD],
    [-0.12, LIFT_KNEE],
    [T_STAMP, STAMP_REND, "snap"],
    [0.28, HEAVE_LIFT],
    [T_THROW - 0.06, COIL_BACK],
    [T_THROW, HURL_SNAP, "snap"],
    [T_THROW + 0.16, HURL_FOLLOW],
    [T_SHATTER, IMPACT_BRACE, "snap"],
    [1.68, { ...READY, x: 5, crouch: 4, lean: 2 }],
    [2.35, GUARD],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_STAMP, stop: 0.04, shake: 0.26, amp: 2.2, target: false },
    { t: T_THROW, stop: 0.05, shake: 0.22, amp: 2.8, target: false },
    { t: T_HIT, stop: 0.06, shake: 0.18, amp: 3.4, push: 2.8, straw: 18, y: -28, skin: "poison" },
    { t: T_SHATTER, stop: 0.20, shake: 0.56, amp: 5.8, push: 6.5, slide: KNOCK_DIST, daze: 2.15, straw: 52, y: -26, skin: "poison", shiver: 0.34 },
    { t: T_SHATTER + 0.42, push: 0, straw: 0, flash: 0, skin: null },
    { t: T_END - 0.34, push: 0, straw: 0, flash: 0, skin: null, daze: 0 },
  ],
  dust: [
    { t: T_STAMP, x: 11, n: 10, dir: 1 },
    { t: T_STAMP, x: -7, n: 7, dir: -1 },
    { t: T_THROW, x: 14, n: 10, dir: 1 },
    { t: T_THROW, x: -9, n: 8, dir: -1 },
  ],
};

// Safe local coordinate bounds inside [456, 224] with origin [88, 176] -> x in [-88..367], y in [-176..47]
const X_MIN = -82, X_MAX = 360, Y_MIN = -170, Y_MAX = 42;

// Prebaked scalloped pixel-art dust & storm billow LUTs (radii 2..21, dark outline + warm sand lit cap)
const PUFF_LUTS = Array.from({ length: 22 }, (_, r) => {
  if (r < 2) return [];
  const pts = [];
  for (let dy = -r - 2; dy <= r + 2; dy++) {
    for (let dx = -r - 2; dx <= r + 2; dx++) {
      const a = Math.atan2(dy, dx);
      const sc = 0.88 + 0.15 * Math.sin(a * 5 + r * 0.95) + 0.09 * Math.cos(a * 8 - r * 0.62);
      const q = Math.hypot(dx, dy) / (r * sc);
      if (q > 1) continue;
      const lit = (-dx * 0.44 - dy * 0.78) / Math.max(1, r) + (1 - q) * 0.42;
      pts.push(dx, dy, q, lit);
    }
  }
  return pts;
});

function drawDustBillow(p, cx, cy, r, u, D, C, alpha, emeraldTint = 0) {
  const fade = (1 - smooth(0.54, 1, u)) * alpha;
  if (fade <= 0.03) return;
  const ri = clamp(Math.round(r), 2, 21), pts = PUFF_LUTS[ri];
  if (!pts.length) return;
  const rx = Math.round(cx), ry = Math.round(cy);
  const dither = u > 0.62 ? (u - 0.62) * 2.35 : 0;
  for (let i = 0; i < pts.length; i += 4) {
    const px = rx + pts[i], py = ry + pts[i + 1];
    if (px < X_MIN || px > X_MAX || py < Y_MIN || py > 2) continue;
    if (dither > 0 && rand(px, py, ri) < dither) continue;
    const q = pts[i + 2], lit = pts[i + 3];
    let col;
    if (q > 0.86) col = D[0];
    else if (emeraldTint > 0.25 && lit > 0.70 && u < 0.36) col = C[5];
    else if (u < 0.28) col = lit > 0.64 ? D[6] : lit > 0.32 ? D[5] : D[3];
    else if (u < 0.62) col = lit > 0.56 ? D[5] : lit > 0.24 ? D[4] : D[2];
    else col = lit > 0.42 ? D[4] : D[1];
    p.dot(px, py, col, fade);
  }
}

// Crisp pixel-cluster cobble stamps for small levitating & flying moss-gravel stones
const COBBLE_STAMPS = [
  [
    [-1, -2, 0, 0], [0, -2, 0, 0], [1, -2, 0, 0],
    [-2, -1, 0, 0], [-1, -1, 1, 5], [0, -1, 1, 4], [1, -1, 0, 6], [2, -1, 0, 0],
    [-2, 0, 0, 0], [-1, 0, 0, 6], [0, 0, 0, 4], [1, 0, 0, 3], [2, 0, 0, 0],
    [-1, 1, 0, 2], [0, 1, 0, 2], [1, 1, 0, 0],
    [0, 2, 0, 0],
  ],
  [
    [-1, -2, 0, 0], [0, -2, 0, 0], [1, -2, 0, 0],
    [-2, -1, 0, 0], [-1, -1, 1, 6], [0, -1, 1, 4], [1, -1, 0, 6], [2, -1, 0, 0],
    [-3, 0, 0, 0], [-2, 0, 0, 7], [-1, 0, 0, 5], [0, 0, 0, 4], [1, 0, 0, 3], [2, 0, 0, 0],
    [-2, 1, 0, 3], [-1, 1, 0, 3], [0, 1, 0, 2], [1, 1, 0, 2], [2, 1, 0, 0],
    [-1, 2, 0, 0], [0, 2, 0, 0], [1, 2, 0, 0],
  ],
  [
    [0, -2, 0, 0], [1, -2, 0, 0],
    [-1, -1, 0, 0], [0, -1, 1, 5], [1, -1, 0, 6], [2, -1, 0, 0],
    [-1, 0, 0, 0], [0, 0, 0, 4], [1, 0, 0, 2], [2, 0, 0, 0],
    [0, 1, 0, 0], [1, 1, 0, 0],
  ],
];

function drawMossCobble(p, cx, cy, kind, S, C, alpha = 1) {
  if (alpha <= 0.03) return;
  const st = COBBLE_STAMPS[kind % COBBLE_STAMPS.length];
  const rx = Math.round(cx), ry = Math.round(cy);
  if (rx < X_MIN + 3 || rx > X_MAX - 3 || ry < Y_MIN + 3 || ry > 2) return;
  for (let i = 0; i < st.length; i++) {
    const [dx, dy, isMoss, idx] = st[i];
    if (ry + dy > 1) continue;
    p.dot(rx + dx, ry + dy, isMoss ? C[idx] : S[idx], alpha);
  }
}

// Quantized rotation sprite cache for large & medium shattered moss-and-granite chunks
function makeMossChunkCache(pts, s, S, C, hasMoss) {
  const angles = new Map();
  const cap = {
    cur: null,
    dot(x, y, c) {
      this.cur.push(Math.round(x), Math.round(y), c);
    },
  };
  return (p, rx, ry, rot, alpha = 1, hot = 0) => {
    if (alpha <= 0.03) return;
    const qi = ((Math.round((rot / TAU) * 36) % 36) + 36) % 36;
    let buf = angles.get(qi);
    if (!buf) {
      buf = [];
      cap.cur = buf;
      drawRock(cap, 0, 0, s, (qi / 36) * TAU, pts, S, 1, false);
      angles.set(qi, buf);
    }
    const ox = Math.round(rx), oy = Math.round(ry);
    if (ox < X_MIN + 10 || ox > X_MAX - 10 || oy < Y_MIN + 10) return;
    for (let i = 0; i < buf.length; i += 3) {
      const dx = buf[i], dy = buf[i + 1];
      if (oy + dy > 1) continue;
      let col = buf[i + 2];
      if (col !== S[0]) {
        if (hot > 0.3 && dy > s * 0.44) col = hot > 0.65 ? C[7] : C[5];
        else if (hasMoss && dy < -s * 0.22 && (dx + dy * 2) % 3 !== 0) col = dy < -s * 0.52 ? C[5] : C[3];
      }
      if (alpha >= 0.99) p.px(ox + dx, oy + dy, col);
      else p.dot(ox + dx, oy + dy, col, alpha);
    }
  };
}

// Multi-material colossal moss-crusted granite boulder + 48-angle quantized cache
function makeHeroBoulder(R, rad) {
  const n = 13;
  const verts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + R.range(-0.11, 0.11);
    const rr = i % 3 === 0 ? R.range(1.02, 1.15) : i % 2 === 0 ? R.range(0.87, 0.98) : R.range(0.75, 0.87);
    verts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.87]);
  }
  // Branching internal spiritual seams (also widen & blaze white-jade on T_HIT..T_SHATTER!)
  const seams = [
    [[-0.72, -0.16], [-0.26, -0.03], [0.15, 0.09], [0.68, -0.10]],
    [[-0.24, -0.03], [-0.06, 0.38], [0.22, 0.68]],
    [[0.14, 0.08], [0.28, -0.34], [0.54, -0.62]],
    [[-0.26, -0.03], [-0.46, -0.48]],
  ];

  const inPoly = (V, x, y) => {
    let inside = false;
    for (let i = 0, j = V.length - 1; i < V.length; j = i++) {
      const [xi, yi] = V[i], [xj, yj] = V[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };

  const distSeg = (px, py, ax, ay, bx, by) => {
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy || 1e-6;
    const t = clamp(((px - ax) * vx + (py - ay) * vy) / l2, 0, 1);
    return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
  };

  const cache = new Map();
  const BBOX = Math.ceil(rad * 1.30) + 2;
  const W = BBOX * 2 + 1;
  const mask = new Uint8Array(W * W);

  function getAngleBuf(qi) {
    let buf = cache.get(qi);
    if (buf) return buf;
    const a = (qi / 48) * TAU, ca = Math.cos(a), sa = Math.sin(a);
    const V = verts.map(([u, v]) => [(u * ca - v * sa) * rad, (u * sa + v * ca) * rad]);
    const rotSeams = seams.map((path) => path.map(([u, v]) => [(u * ca - v * sa) * rad, (u * sa + v * ca) * rad]));
    mask.fill(0);

    for (let iy = 0; iy < W; iy++) {
      const py = iy - BBOX + 0.5;
      for (let ix = 0; ix < W; ix++) {
        const px = ix - BBOX + 0.5;
        if (inPoly(V, px, py)) mask[iy * W + ix] = 1;
      }
    }

    const at = (ix, iy) => ix >= 0 && iy >= 0 && ix < W && iy < W && mask[iy * W + ix] === 1;
    buf = []; // [dx, dy, kind, shade]  kind: 0=outline, 1=stone, 2=moss, 3=veinCore, 4=veinShoulder

    for (let iy = 0; iy < W; iy++) {
      const dy = iy - BBOX;
      for (let ix = 0; ix < W; ix++) {
        const dx = ix - BBOX;
        if (!at(ix, iy)) {
          if (at(ix - 1, iy) || at(ix + 1, iy) || at(ix, iy - 1) || at(ix, iy + 1)) {
            buf.push(dx, dy, 0, 0);
          }
          continue;
        }
        const u = (dx * ca + dy * sa) / rad;
        const v = (-dx * sa + dy * ca) / rad;

        let minD = 99;
        for (const path of rotSeams) {
          for (let k = 0; k < path.length - 1; k++) {
            const d = distSeg(dx, dy, path[k][0], path[k][1], path[k + 1][0], path[k + 1][1]);
            if (d < minD) minD = d;
          }
        }
        if (minD < 0.72) {
          buf.push(dx, dy, 3, minD < 0.38 ? 2 : 1);
          continue;
        }
        if (minD < 1.85) {
          // Normally a dark crevice shadow lip; on impact crush (mode 2) it erupts into wide white-jade fracture cracks!
          buf.push(dx, dy, 4, dy > 0 ? 1 : 3);
          continue;
        }

        // Bold planar granite facets
        const facetAng = Math.atan2(v, u);
        const sector = Math.floor(((facetAng + Math.PI) / TAU) * 5);
        const facetBias = (sector === 1 || sector === 2) ? 0.24 : sector === 4 ? -0.26 : -0.05;
        const screenLit = (-dx * 0.55 - dy * 0.83) / rad + facetBias;
        const edge = !at(ix - 1, iy) || !at(ix + 1, iy) || !at(ix, iy - 1) || !at(ix, iy + 1);

        // Organic clumpy emerald moss mantle & hanging moss tendrils along upper crags
        const mossWave = -v * 0.90 - u * 0.18 + 0.20 * Math.sin(u * 7.2) + 0.14 * Math.cos(u * 13.5 - 0.8);
        if (mossWave > 0.24) {
          const mRim = mossWave < 0.36;
          const mTone = mRim ? 1 : screenLit > 0.52 ? 6 : screenLit > 0.22 ? 5 : screenLit > -0.08 ? 4 : 3;
          buf.push(dx, dy, 2, mTone);
          continue;
        }

        let sTone = screenLit > 0.56 ? 7 : screenLit > 0.26 ? 6 : screenLit > -0.04 ? 4 : screenLit > -0.34 ? 3 : 1;
        if (edge) sTone = screenLit > 0.22 ? 7 : 1;
        buf.push(dx, dy, 1, sTone);
      }
    }
    cache.set(qi, buf);
    return buf;
  }

  return {
    // mode: 0 = full boulder, 1 = translucent sonic silhouette afterimage, 2 = impact-crushing splitting boulder!
    draw(p, cx, cy, rot, S, C, D, { scaleX = 1, scaleY = 1, clipFloor = Infinity, veinGlow = 0.5, noseHeat = 0, mode = 0, ghostTint = 0, alpha = 1 } = {}) {
      if (alpha <= 0.03) return;
      const qi = ((Math.round((rot / TAU) * 48) % 48) + 48) % 48;
      const buf = getAngleBuf(qi);
      const ox = Math.round(cx), oy = Math.round(cy);

      for (let i = 0; i < buf.length; i += 4) {
        const dx = scaleX === 1 ? buf[i] : Math.round(buf[i] * scaleX);
        const dy = scaleY === 1 ? buf[i + 1] : Math.round(buf[i + 1] * scaleY);
        const px = ox + dx, py = oy + dy;
        if (px < X_MIN || px > X_MAX || py < Y_MIN || py > clipFloor) continue;
        const kind = buf[i + 2], sh = buf[i + 3];

        if (mode === 1) {
          const isFrontRim = kind === 0 && dx > 0;
          const gCol = isFrontRim
            ? (ghostTint === 0 ? WHITE : C[6])
            : kind === 3
              ? C[6]
              : ghostTint === 0
                ? mix(S[5], C[5], 0.55)
                : ghostTint === 1
                  ? mix(D[5], C[4], 0.45)
                  : D[4];
          p.blend(px, py, gCol, isFrontRim ? Math.min(1, alpha * 1.45) : alpha);
          continue;
        }

        if (mode === 2) {
          // Giant boulder slamming into the enemy & splitting wide open along blinding white-jade fault seams!
          let hCol;
          if (kind === 0) hCol = S[0];
          else if (kind === 3) hCol = WHITE;
          else if (kind === 4) hCol = C[7];
          else if (kind === 2) hCol = sh >= 5 ? C[7] : C[5];
          else hCol = sh >= 6 ? S[7] : sh >= 4 ? S[5] : S[2];
          p.px(px, py, hCol);
          continue;
        }

        let col;
        if (kind === 0) col = S[0];
        else if (kind === 3) col = sh === 2 ? (veinGlow > 0.65 ? WHITE : C[7]) : veinGlow > 0.35 ? C[5] : C[3];
        else if (kind === 4) col = S[sh];
        else if (kind === 2) col = C[clamp(sh, 1, 6)];
        else col = S[clamp(sh, 1, 7)];

        if (noseHeat > 0.1 && kind !== 0 && dx > rad * 0.52) {
          const hk = ((dx - rad * 0.52) / (rad * 0.55)) * noseHeat;
          if (hk > 0.62) col = WHITE;
          else if (hk > 0.30) col = C[6];
        }

        if (alpha >= 0.99) p.px(px, py, col);
        else p.dot(px, py, col, alpha);
      }
    },
  };
}

// Swept mid-air parabolic sonic-boom shockwave cone ")" trailing along the boulder's supersonic flight path
function drawSonicCone(p, apexX, cy, halfH, thick, sweepBack, cols, alpha) {
  if (halfH < 2 || thick < 0.4 || alpha <= 0.03) return;
  const x0 = Math.max(X_MIN, Math.floor(apexX - sweepBack - thick - 2));
  const x1 = Math.min(X_MAX, Math.ceil(apexX + 2));
  const y0 = Math.max(Y_MIN, Math.floor(cy - halfH - 1));
  const y1 = Math.min(-1, Math.ceil(cy + halfH + 1));
  p.shade(x0, y0, x1, y1, (px, py, out) => {
    const ny = (py - cy) / halfH;
    if (Math.abs(ny) >= 1) return;
    const leadX = apexX - ny * ny * sweepBack;
    const wt = thick * Math.pow(1 - ny * ny, 0.55);
    const q = (leadX - px) / Math.max(0.6, wt);
    if (q < 0 || q > 1) return;
    out.c = q < 0.28 ? cols[0] : q < 0.62 ? cols[1] : cols[2];
    out.a = alpha * (1 - Math.pow(Math.abs(ny), 2.2)) * (1 - q * 0.45);
  });
}

// Vertical tilted sound-barrier vapor ring punched open at supersonic release!
function drawSoundBarrierRing(p, cx, cy, rx, ry, th, cols, alpha, back) {
  if (alpha <= 0.03 || ry < 2) return;
  const x0 = Math.max(X_MIN, Math.floor(cx - rx - th - 1)), x1 = Math.min(X_MAX, Math.ceil(cx + rx + th + 1));
  const y0 = Math.max(Y_MIN, Math.floor(cy - ry - th - 1)), y1 = Math.min(-1, Math.ceil(cy + ry + th + 1));
  for (let y = y0; y <= y1; y++) {
    const ny = (y + 0.5 - cy) / ry;
    if (Math.abs(ny) > 1.35) continue;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      if (back ? dx >= 0 : dx < 0) continue;
      const nx = dx / Math.max(1.2, rx);
      const e = Math.hypot(nx, ny);
      const d = Math.abs(1 - e) * ry * 0.42;
      if (d > th) continue;
      const u = d / th;
      p.blend(x, y, u < 0.35 ? cols[0] : u < 0.72 ? cols[1] : cols[2], alpha * (1 - u * 0.75));
    }
  }
}

// Perspective ground shockwave crest (back or front half)
function drawGroundShockBand(p, cx, cy, r, sy, th, alpha, cols, back) {
  if (alpha <= 0.03 || r <= 2 || th <= 0.2) return;
  const rx = r + th + 1, ry = (r + th) * sy + th * 0.6 + 1;
  const x0 = Math.max(X_MIN, Math.floor(cx - rx)), x1 = Math.min(X_MAX, Math.ceil(cx + rx));
  const y0 = back ? Math.max(Y_MIN, Math.floor(cy - ry)) : Math.floor(cy);
  const y1 = back ? Math.floor(cy) : Math.min(Y_MAX, Math.ceil(cy + ry));
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    if (back ? dy >= 0 : dy < 0) continue;
    const ny = dy / Math.max(0.8, r * sy);
    if (ny * ny > 1.7) continue;
    for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / r;
      const e = Math.hypot(nx, ny);
      if (e < 0.28) continue;
      const jag = 1 + 0.045 * Math.sin(nx * 9 + ny * 7);
      const dist = Math.abs(jag - e) * r;
      if (dist > th) continue;
      const u = dist / th;
      const col = u < 0.26 ? cols[3] : u < 0.56 ? cols[2] : u < 0.82 ? cols[1] : cols[0];
      p.dot(x, y, col, alpha * (1 - u * 0.72));
    }
  }
}

// Tapered supersonic shock-spear ray for blow-through exit cone & downward pressure crush
function drawShockSpear(p, x0, y0, ang, len, w, colRim, colMid, colCore, alpha) {
  if (len < 2 || alpha <= 0.03) return;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let d = 0; d <= len; d += 0.75) {
    const u = d / len;
    const hw = w * (1 - u) * Math.min(1, d / 3.5);
    const bx = x0 + ca * d, by = y0 + sa * d;
    if (bx < X_MIN + 2 || bx > X_MAX - 2 || by < Y_MIN + 2 || by > 0) continue;
    for (let o = -hw - 0.7; o <= hw + 0.7; o += 0.65) {
      const ao = Math.abs(o);
      const col = ao > hw ? colRim : ao < hw * 0.45 && u < 0.68 ? colCore : colMid;
      p.dot(bx - sa * o, by + ca * o, col, alpha * (1 - u * 0.28));
    }
  }
}

// 3D tilted emerald moss spiritual aura helix ribbons + ascending ground-to-boulder qi wisps
function drawMossAuraHelix(p, cx, cy, rad, t, C, alpha, back) {
  if (alpha <= 0.03) return;
  for (let k = 0; k < 3; k++) {
    const baseA = t * 6.0 + (k * TAU) / 3;
    const tilt = -0.36 + k * 0.36;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const rx = rad * 1.48, ry = rad * 0.54;
    const steps = 34;
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const th = baseA - u * 2.55;
      const sinTh = Math.sin(th);
      if (back ? sinTh >= 0 : sinTh < 0) continue;
      const ex = Math.cos(th) * rx, ey = sinTh * ry;
      const px = cx + ex * ct - ey * st, py = cy + ex * st + ey * ct;
      if (px < X_MIN + 2 || px > X_MAX - 2 || py < Y_MIN + 2 || py > -1) continue;
      const hw = (2.65 * (1 - u * 0.68)) * Math.sin(Math.PI * Math.min(1, u * 4.0));
      const col = u < 0.20 ? WHITE : u < 0.52 ? C[6] : u < 0.80 ? C[5] : C[3];
      for (let o = -hw; o <= hw; o += 0.75) {
        p.dot(px, py + o, Math.abs(o) > hw * 0.66 ? C[2] : col, alpha * (1 - u * 0.48));
      }
      if (s % 10 === 0 && u < 0.45) p.glow(px, py, 6, C[5], 0.16 * alpha * (1 - u));
    }
  }
}

const STUN_STAR = shaped.bind(null, starShape(0.44));
const DIZZY_PIP = (dx, dy) => (Math.hypot(dx, dy * 1.25) <= 2.1 ? "#" : "");

// Tilted 3D stun halo (back half behind head, near half in front of head)
function drawStunHalo(p, cx, cy, t, scaleK, St, C, layer) {
  if (scaleK <= 0.04) return;
  const far = layer === "back";
  const rx = 18.5 * scaleK, ry = 4.8 * scaleK;
  const N = 5;
  const ringSteps = 36;
  for (let i = 0; i < ringSteps; i++) {
    const th = (i / ringSteps) * TAU;
    const s = Math.sin(th);
    if ((s >= 0) === far) continue;
    if ((i + Math.floor(t * 20)) % 3 === 0) continue;
    p.dot(cx + Math.cos(th) * rx, cy + s * ry, far ? St[2] : St[3], 0.62 * scaleK);
  }

  for (let i = 0; i < N; i++) {
    const th = t * 7.8 + (i * TAU) / N;
    const s = Math.sin(th);
    const near = s >= 0;
    if (near === far) continue;
    const ix = cx + Math.cos(th) * rx;
    const iy = cy + s * ry + Math.sin(t * 11 + i) * 0.8;
    const depth = 0.5 + 0.5 * s;
    const isPip = i % 2 === 1;

    if (!isPip) {
      for (let k = 1; k <= 8; k++) {
        const th2 = th - k * 0.11;
        if ((Math.sin(th2) >= 0) === far) continue;
        const gx = cx + Math.cos(th2) * rx, gy = cy + Math.sin(th2) * ry;
        p.dot(gx, gy, k < 3 ? St[5] : k < 6 ? St[4] : C[5], (1 - k / 9) * scaleK);
      }
      const spin = t * 9.5 + i;
      const ramp = far ? [St[0], St[1], St[3], St[4]] : [St[0], St[2], St[4], St[5]];
      icon(p, ix, iy, 6, STUN_STAR((4.0 + 0.9 * depth) * Math.min(1, scaleK * 1.15), spin), ramp, Math.min(1, scaleK * 1.2));
      p.glow(ix, iy, 9 * scaleK, St[3], (0.20 + 0.22 * depth) * scaleK);
      const frontDist = Math.abs(Math.atan2(Math.sin(th - Math.PI / 2), Math.cos(th - Math.PI / 2)));
      if (!far && frontDist < 0.36) {
        const fk = (1 - frontDist / 0.36) * scaleK;
        flare(p, ix, iy, 8 * fk, fk * 0.85, [St[2], St[3], St[4], St[5]]);
      }
    } else {
      const ramp = far ? [C[0], C[2], C[4], C[5]] : [C[0], C[3], C[5], C[7]];
      icon(p, ix, iy, 4, DIZZY_PIP, ramp, Math.min(1, scaleK * 1.2));
      p.glow(ix, iy, 5 * scaleK, C[5], 0.18 * scaleK);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 9);
  const S = fit(o.stone, 8);
  const D = fit(o.dust, 7);
  const St = fit(o.stun, 6);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[7], C[5], St[3]], haze: C[4] });
  const bits = new Bits({ ground: floor });
  const lights = new Lights();

  const heroBoulder = makeHeroBoulder(R, R_BOULDER);

  // Pre-build 8 distinct moss-and-granite chunk caches (sizes 4.2..7.5 px so shattered rocks read starkly against sky!)
  const chunkRenderers = Array.from({ length: 8 }, (_, i) =>
    makeMossChunkCache(stoneShape(R, R.int(5, 7)), 4.2 + (i % 4) * 1.1, S, C, i % 2 === 0)
  );

  // Heaving tilted floor bedrock slabs around cast origin
  const castSlabs = Array.from({ length: 8 }, (_, i) => {
    const side = i < 4 ? -1 : 1;
    const dist = 12 + (i % 4) * 11.5 + R.range(-2, 2);
    return {
      x: 14 + side * dist,
      y: 0,
      vy: 0,
      a: 0,
      va: 0,
      side,
      s: R.range(4.2, 6.2),
      pts: [[-1, -0.36], [1, -0.40], [1.04, 0.38], [-0.96, 0.36]],
      cache: null,
    };
  });
  for (const sl of castSlabs) sl.cache = makeMossChunkCache(sl.pts, sl.s, S, C, true);

  // Cast-origin emerald fissures around x = 14
  const castCracks = makeCracks(R, 10, { len: [18, 52], dive: 0.48, maxY: 14, forks: 0.55 }).map((c) => ({
    ...c,
    pts: c.pts.map(([x, y, d]) => [clamp(x + 14, X_MIN + 4, X_MAX - 4), clamp(y, 0.5, 15), d]),
    kids: c.kids.map((k) => k.map(([x, y, d]) => [clamp(x + 14, X_MIN + 4, X_MAX - 4), clamp(y, 0.5, 15), d])),
  }));

  // Impact crater fissures around TX
  const hitCracks = makeCracks(R, 14, { len: [24, 72], dive: 0.56, maxY: 20, forks: 0.65 }).map((c) => ({
    ...c,
    pts: c.pts.map(([x, y, d]) => [clamp(x + TX, X_MIN + 4, X_MAX - 4), clamp(y, 0.5, 22), d]),
    kids: c.kids.map((k) => k.map(([x, y, d]) => [clamp(x + TX, X_MIN + 4, X_MAX - 4), clamp(y, 0.5, 22), d])),
  }));

  // 10 anti-gravity levitating pebbles & moss-cobbles rising from the shaking earth during cast
  const levPebbles = Array.from({ length: 10 }, (_, i) => ({
    x0: 14 + (i % 2 ? 1 : -1) * R.range(18, 50),
    rise: R.range(22, 54),
    t0: 0.03 + (i / 10) * 0.16,
    kind: i % 3,
    ph: R.range(0, TAU),
  }));

  // Wide cyclonic dust-storm billows whipping around the rising boulder (0.03..0.68s)
  const castStormPuffs = Array.from({ length: 22 }, (_, i) => ({
    ang0: (i / 22) * TAU,
    rad0: R.range(36, 58),
    rad1: R.range(22, 38),
    yEnd: -R.range(8, 46),
    t0: 0.03 + (i % 11) * 0.045,
    life: R.range(0.38, 0.58),
    r0: R.range(6, 9),
    r1: R.range(9.5, 14.5),
  }));

  // 4 staggered mid-air supersonic Mach shock-cones + rolling sonic shock-puffs along the flight corridor!
  const machCones = [
    { t0: T_THROW, x0: 26, x1: 42, y: -39, h0: 28, h1: 50, th: 10.0, sweep: 23, dur: 0.26 },
    { t0: T_THROW + 0.08, x0: 68, x1: 86, y: -36, h0: 26, h1: 46, th: 9.0, sweep: 21, dur: 0.25 },
    { t0: T_THROW + 0.16, x0: 112, x1: 130, y: -33, h0: 25, h1: 44, th: 8.5, sweep: 20, dur: 0.24 },
    { t0: T_THROW + 0.24, x0: 150, x1: 168, y: -30, h0: 24, h1: 42, th: 8.2, sweep: 19, dur: 0.22 },
  ];

  // Impact starburst, concussive shock-wedges, and heavily gapped radial shatter arcs (downward spikes stop at floor!)
  const clampFloorSpikes = (arr, cy) => arr.map((sp) => {
    const sa = Math.sin(sp.a);
    return sa > 0.05 ? { ...sp, len: Math.min(sp.len, (-cy - 1) / (sa * 1.25)) } : sp;
  });
  const crushStar = clampFloorSpikes(spikes(R, 12, 0.06, { len: [22, 38], w: [2.2, 3.4], fwd: 1.75, back: 0.45, jag: 0.55 }), -28);
  const shatterStar = clampFloorSpikes(spikes(R, 18, 0.02, { len: [34, 66], w: [2.6, 4.4], fwd: 1.55, back: 0.65, jag: 0.48 }), -26);
  const ringSegs = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * TAU + R.range(-0.08, 0.08);
    return { a, gap: Math.sin(a) > 0.28 ? 0 : R.range(0.62, 0.88), dr: R.range(0.14, 0.46), w: R.range(0.9, 1.45) };
  });

  // 22 radially surging 3D ground dust-shockwave billows ("一圈扩散的尘土气浪")
  const radialDustWave = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * TAU + R.range(-0.06, 0.06);
    return {
      a,
      reach: R.range(78, 108),
      r0: R.range(6.5, 9.5),
      r1: R.range(11.5, 16.5),
      lift: R.range(3, 13),
      t0: T_SHATTER + R.range(0, 0.04),
      life: R.range(0.72, 1.15),
    };
  });

  // Rising central dust & emerald-spore plume clouds above the crater
  const plumeBillows = Array.from({ length: 14 }, (_, i) => {
    const u = i / 13;
    const a = -Math.PI / 2 + R.range(-1.05, 1.05);
    const sp = R.range(40, 132) * (1 - u * 0.22);
    return {
      x0: TX + R.range(-12, 12),
      y0: -14 - u * 26,
      vx: Math.cos(a) * sp * 0.85 + 8,
      vy: Math.sin(a) * sp * 0.80,
      r0: lerp(11, 7, u),
      r1: lerp(17, 11, u),
      t0: T_SHATTER + u * 0.07,
      life: R.range(0.62, 1.10),
      emerald: i % 3 === 0 ? 0.45 : 0,
    };
  });

  const leaves = [];
  const addLeaf = (x, y, vx, vy, life) => {
    leaves.push({
      x, y, vx, vy,
      len: R.range(4.2, 6.6),
      wid: R.range(1.6, 2.5),
      ang: R.range(0, TAU),
      va: R.range(-14, 14),
      fl: R.range(0, TAU),
      vfl: R.range(9, 18),
      age: 0,
      life,
    });
  };

  // Boulder center trajectory
  const boulderPos = (tt) => {
    if (tt < T_THROW - 0.07) {
      const u = clamp((tt - T_STAMP) / (T_THROW - 0.07 - T_STAMP));
      const lift = ease.outCubic(u);
      const jitter = Math.sin(tt * 84) * 1.5 * (1 - u * 0.35);
      const x = lerp(14, -1, smooth(0.45, 1.0, u)) + jitter;
      const y = lerp(14, -52, lift) + Math.sin(tt * 22) * 1.2 * u;
      return [x, y];
    }
    if (tt < T_THROW) {
      const u = (tt - (T_THROW - 0.07)) / 0.07;
      return [lerp(-1, 23, ease.inQuad(u)), lerp(-52, -40, u)];
    }
    if (tt <= T_HIT) {
      const u = clamp((tt - T_THROW) / (T_HIT - T_THROW));
      const prog = 0.24 * u + 0.76 * Math.pow(u, 1.32);
      return [lerp(23, TX - 8, prog), lerp(-40, -28, ease.inQuad(u))];
    }
    return [TX - 6 + Math.sin(tt * 120) * 1.5, -28];
  };

  const boulderRot = (tt) => {
    if (tt < T_THROW) return -0.35 * ease.outQuad(clamp(tt / T_THROW));
    return -0.35 + (tt - T_THROW) * 19.5;
  };

  // Exact analytical knockback curve matching Target.step(dt) in src/core/act.js
  const enemyX = (tt) => {
    if (tt <= T_SHATTER) return TX;
    return TX + KNOCK_DIST * (1 - Math.exp(-8.5 * (tt - T_SHATTER)));
  };

  let t = 0;
  let stamped = false, jolt2 = false, thrown = false, hitDone = false, shattered = false;
  let auraAcc = 0, flightAcc = 0, skidAcc = 0;

  return {
    update(dt) {
      t += dt;
      const f = Math.min(1, dt * 120);

      // Phase 1: Ground stamp & 2nd tremor jolt heaving floor slabs & dust storm
      if (!stamped && t >= T_STAMP) {
        stamped = true;
        lights.add(14, -14, 52, C[5], 0.65, 0.35);
        lights.add(14, -8, 28, WHITE, 0.55, 0.08);
        for (const sl of castSlabs) {
          sl.vy = -R.range(65, 135);
          sl.va = sl.side * R.range(3.5, 7.5);
        }
        for (let i = 0; i < 42; i++) {
          const x = 14 + R.range(-40, 40), a = -Math.PI / 2 + R.range(-0.9, 0.9), sp = R.range(60, 205);
          ps.spawn(P.GRIT, x, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.5, 1.0), R.pick([S[6], S[5], D[5], C[4]]), R.chance(0.38) ? 2 : 1);
        }
        for (let i = 0; i < 16; i++) {
          const sd = R.sign();
          ps.spawn(P.SMOKE, 14 + sd * R.range(6, 28), -R.range(1, 5), sd * R.range(35, 115), -R.range(10, 44), R.range(0.7, 1.25), R.chance(0.55) ? D[5] : D[4], R.range(5.0, 8.5), 0, PF.BIG);
        }
      }
      if (!jolt2 && t >= 0.28) {
        jolt2 = true;
        for (const sl of castSlabs) {
          sl.vy = -R.range(45, 95);
          sl.va = sl.side * R.range(2.5, 5.5);
        }
      }

      if (t < 1.35) {
        for (const sl of castSlabs) {
          sl.vy += 680 * dt;
          sl.y += sl.vy * dt;
          sl.a += sl.va * dt;
          if (sl.y >= 0) {
            sl.y = 0;
            sl.a = clamp(sl.a, -0.42, 0.42);
            sl.vy *= -0.22;
            sl.va *= -0.35;
          }
        }
      }

      if (t >= T_STAMP && t < T_THROW) {
        const [bx, by] = boulderPos(t);
        const k = clamp((t - T_STAMP) / (T_THROW - T_STAMP));
        for (auraAcc += dt * (48 + 56 * k); auraAcc >= 1; auraAcc -= 1) {
          const a = R.range(0, TAU), dist = R.range(30, 50);
          const sx = clamp(bx + Math.cos(a) * dist, X_MIN + 4, X_MAX - 4);
          const sy = clamp(by + Math.sin(a) * dist * 0.75, Y_MIN + 4, -2);
          ps.spawn(P.STREAK, sx, sy, -Math.cos(a) * 160, -Math.sin(a) * 160, 0.17, R.pick([C[7], C[6], C[5]]));
          if (R.chance(0.26)) addLeaf(sx, sy, -Math.cos(a) * 45 + R.range(-20, 20), -R.range(25, 65), R.range(0.45, 0.75));
        }
        if (R.chance(0.48 * f)) {
          ps.spawn(P.GRIT, 14 + R.range(-42, 42), -1, R.range(-18, 18), -R.range(32, 90), R.range(0.4, 0.75), R.pick([S[6], D[4], C[4]]), 1);
        }
      }

      // Phase 2: Supersonic hurl & ground-tearing pressure wake
      if (!thrown && t >= T_THROW) {
        thrown = true;
        lights.add(26, -38, 56, C[6], 0.85, 0.18);
        lights.add(26, -38, 32, WHITE, 0.85, 0.08);
        for (let i = 0; i < 28; i++) {
          const a = R.range(-1.1, 1.1), sp = R.range(115, 285);
          ps.spawn(P.SPARK, 26, -39, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.15, 0.32));
        }
        for (let i = 0; i < 12; i++) {
          ps.spawn(P.SMOKE, 8 - R.range(0, 14), -R.range(2, 16), -R.range(48, 135), -R.range(6, 32), R.range(0.65, 1.15), D[5], R.range(4.5, 7.5), 0, PF.BIG);
        }
      }

      if (t >= T_THROW && t < T_HIT) {
        const [bx, by] = boulderPos(t);
        for (flightAcc += dt * 210; flightAcc >= 1; flightAcc -= 1) {
          ps.spawn(P.MOTE, bx - R.range(8, 24), by + R.range(-16, 16), -R.range(95, 225), R.range(-28, 28), R.range(0.16, 0.32), R.pick([C[6], C[5], D[5]]), R.range(1.4, 2.5));
          if (R.chance(0.45)) {
            ps.spawn(P.DUST, bx - R.range(10, 26), by + R.range(-13, 13), -R.range(60, 150), R.range(-20, 20), R.range(0.26, 0.48), R.chance(0.5) ? D[5] : D[4], R.range(2.8, 5.2));
          }
          if (R.chance(0.32)) {
            ps.spawn(P.STREAK, bx - R.range(12, 34), by + R.range(-15, 15), -R.range(220, 360), R.range(-14, 14), R.range(0.08, 0.15), R.chance(0.55) ? WHITE : C[6]);
          }
          if (R.chance(0.55)) {
            ps.spawn(P.GRIT, clamp(bx + R.range(-12, 8), X_MIN + 6, X_MAX - 6), -1, -R.range(45, 150), -R.range(35, 115), R.range(0.4, 0.75), R.pick([D[5], S[5], S[4]]), 1);
          }
          if (R.chance(0.24)) {
            addLeaf(bx - 12, by + R.range(-14, 14), -R.range(70, 165), R.range(-38, 38), R.range(0.45, 0.85));
          }
        }
      }

      // Phase 3: Oppressive Being-Hit crush frame (0.94s) — splitting boulder + concussive shock
      if (!hitDone && t >= T_HIT) {
        hitDone = true;
        lights.add(TX - 2, -28, 60, C[6], 0.85, 0.10);
        lights.add(TX - 2, -28, 32, WHITE, 0.85, 0.05);
        for (let i = 0; i < 28; i++) {
          const a = R.range(-0.85, 0.85), sp = R.range(160, 360);
          ps.spawn(P.SPARK, TX, -28, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.14, 0.30));
        }
      }

      // Phase 4: Thunderous Boulder Shatter, Sky-Filling Shrapnel Storm & Expanding Dust Wave (1.00s)
      if (!shattered && t >= T_SHATTER) {
        shattered = true;
        lights.add(TX, -28, 66, C[5], 1.05, 0.32);
        lights.add(TX, -28, 40, WHITE, 1.0, 0.08);
        lights.add(TX, -16, 54, D[5], 0.65, 0.48);

        // 16 Large multi-faceted moss-granite boulder chunks blasted HIGH & WIDE across the sky ("碎石四射")!
        for (let i = 0; i < 16; i++) {
          const u = (i - 7.5) / 7.5;
          const vx = clamp(u * R.range(185, 260) + R.range(-20, 24), -245, 260);
          const vy = -R.range(215, 420) * (1 - 0.24 * Math.abs(u));
          bits.add({
            kind: B.CHUNK,
            x: TX + R.range(-8, 8),
            y: -28 + R.range(-8, 6),
            vx,
            vy,
            g: 0.92,
            drag: 0.20,
            bounce: R.range(0.36, 0.46),
            life: R.range(1.50, 2.18),
            a: R.range(0, TAU),
            va: R.sign() * R.range(9, 19),
            s: 4.2 + (i % 4) * 1.1,
            ci: i % chunkRenderers.length,
            pvy: 0,
            hot: 1,
          });
        }

        // 18 Medium cobble fragments flying in all directions
        for (let i = 0; i < 18; i++) {
          const a = -Math.PI / 2 + R.range(-1.36, 1.36), sp = R.range(155, 345);
          bits.add({
            kind: B.CHUNK,
            x: TX + R.range(-6, 6),
            y: -24 + R.range(-8, 6),
            vx: clamp(Math.cos(a) * sp + 12, -230, 245),
            vy: Math.sin(a) * sp - 35,
            g: 0.98,
            drag: 0.28,
            bounce: 0.34,
            life: R.range(1.15, 1.75),
            a: R.range(0, TAU),
            va: R.range(-22, 22),
            s: R.range(1.8, 2.6),
            cobble: i % 3,
            pvy: 0,
          });
        }

        // 95 High-velocity gravel & moss flecks
        for (let i = 0; i < 95; i++) {
          const u = R.range(-1, 1), a = -Math.PI / 2 + u * 1.32, sp = R.range(115, 360);
          ps.spawn(P.GRIT, TX + u * 8, -R.range(4, 30), clamp(Math.cos(a) * sp + 18, -240, 255), Math.sin(a) * sp - 22, R.range(0.95, 1.85), R.pick([S[7], S[6], S[4], D[5], C[5], C[3]]), R.chance(0.45) ? 2 : 1);
        }

        // 48 Jade & golden flint impact sparks
        for (let i = 0; i < 48; i++) {
          const a = R.range(0, TAU), sp = R.range(135, 355);
          ps.spawn(P.SPARK, TX, -26, Math.cos(a) * sp + 20, Math.sin(a) * sp - 35, R.range(0.18, 0.54));
        }

        // 20 Torn moss leaves & glowing spiritual embers
        for (let i = 0; i < 20; i++) {
          const a = -Math.PI / 2 + R.range(-1.25, 1.25), sp = R.range(85, 230);
          addLeaf(TX + R.range(-8, 8), -26 + R.range(-8, 8), Math.cos(a) * sp + 16, Math.sin(a) * sp - 30, R.range(1.0, 1.75));
        }
        for (let i = 0; i < 20; i++) {
          const a = -Math.PI / 2 + R.range(-1.1, 1.1), sp = R.range(35, 130);
          ps.spawn(P.EMBER, TX + R.range(-14, 14), -R.range(6, 32), Math.cos(a) * sp, Math.sin(a) * sp - 20, R.range(0.85, 1.65), R.chance(0.6) ? C[6] : St[4], R.chance(0.35) ? 2 : 1);
        }

        // Rolling ground dust smoke clouds expanding left & right
        for (let i = 0; i < 20; i++) {
          const sd = R.sign();
          ps.spawn(P.SMOKE, TX + sd * R.range(4, 18), -R.range(1, 6), sd * R.range(65, 185) + 10, -R.range(4, 24), R.range(1.15, 1.95), R.chance(0.55) ? D[5] : D[4], R.range(5.5, 9.5), R.range(0, 0.08), PF.BIG);
        }
      }

      // Phase 5: Continuous heel-skid dust & gravel rooster-tail while enemy skids backward (1.00..1.38s)
      if (t >= T_SHATTER && t < T_SHATTER + 0.38) {
        const ex = enemyX(t);
        const kSkid = 1 - (t - T_SHATTER) / 0.38;
        for (skidAcc += dt * 145 * kSkid; skidAcc >= 1; skidAcc -= 1) {
          ps.spawn(P.DUST, ex + R.range(-4, 8), -R.range(1, 5), R.range(28, 100), -R.range(8, 38), R.range(0.35, 0.68), R.chance(0.5) ? D[6] : D[4], R.range(2.6, 5.0));
          ps.spawn(P.GRIT, ex + R.range(0, 8), -1, R.range(38, 130), -R.range(35, 98), R.range(0.45, 0.85), R.pick([D[5], S[5], C[4]]), 1);
        }
      }

      for (const b of bits.list) {
        b.pvy = b.vy;
        if (b.hot) b.hot = Math.max(0, b.hot - dt * 1.8);
      }
      bits.update(dt);
      for (const b of bits.list) {
        b.x = clamp(b.x, X_MIN + 12, X_MAX - 12);
        b.y = clamp(b.y, Y_MIN + 12, 0);
        if (b.pvy > 75 && b.vy <= 0 && t < T_END - 0.55) {
          const n = b.s > 3.5 ? 3 : 2;
          for (let j = 0; j < n; j++) {
            ps.spawn(P.DUST, b.x + R.range(-2, 2), -0.5, R.sign() * R.range(12, 44), -R.range(4, 18), Math.min(R.range(0.32, 0.62), T_END - 0.12 - t), D[4], R.range(1.6, 3.2));
          }
          b.pvy = 0;
        }
      }

      for (let i = leaves.length - 1; i >= 0; i--) {
        const lf = leaves[i];
        lf.age += dt;
        if (lf.age >= lf.life || t >= T_END - 0.08) {
          leaves.splice(i, 1);
          continue;
        }
        lf.vy += 180 * dt;
        lf.vx *= 1 - 2.1 * dt;
        lf.vy *= 1 - 1.4 * dt;
        lf.x = clamp(lf.x + lf.vx * dt, X_MIN + 8, X_MAX - 8);
        lf.y = clamp(lf.y + lf.vy * dt, Y_MIN + 8, -1);
        lf.ang += lf.va * dt;
        lf.fl += lf.vfl * dt;
      }

      ps.update(dt);
      for (const q of ps.list) {
        q.x = clamp(q.x, X_MIN + 4, X_MAX - 4);
        q.y = clamp(q.y, Y_MIN + 4, -0.5);
      }
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-4) return;
      const endFade = 1 - smooth(T_END - 0.52, T_END - 0.04, t);

      // 1. Cast-origin fractured pit, glowing emerald fissures & far-half cyclonic dust storm
      if (t >= T_STAMP && t < 1.55) {
        const ageC = t - T_STAMP;
        const cFade = (1 - smooth(0.92, 1.52, ageC)) * endFade;
        const cHeat = 1 - smooth(0.50, 1.10, ageC);
        drawCracks(p, castCracks, (c) => c.len * ease.outCubic(clamp((ageC - c.t0) / 0.12)), (d) => clamp(cHeat - d * 0.008, 0, 1), [WHITE, C[6], C[5], C[3]], S[0], S[5], cFade);

        const pitW = 28 * ease.outCubic(clamp(ageC / 0.14));
        for (let dx = -Math.floor(pitW); dx <= Math.floor(pitW); dx++) {
          const q = Math.abs(dx) / Math.max(1, pitW);
          p.dot(14 + dx, 0, q < 0.68 ? S[0] : D[2], cFade);
          if (q < 0.75) p.dot(14 + dx, 1, cHeat > 0.4 && q < 0.36 ? C[5] : S[1], cFade * 0.9);
          if (q > 0.84) p.dot(14 + dx, -1, D[5], cFade * 0.88);
        }

        if (t < T_THROW + 0.26) {
          const uS = clamp(ageC / 0.62);
          const sFade = (1 - smooth(T_THROW - 0.02, T_THROW + 0.24, t)) * endFade;
          dustRing(p, 14, 0, 26 + 30 * Math.sin(uS * 1.45), 9.5, 0.84 * sFade, D[4], { sy: RSY, ph: t * 5.8, lit: 0.34, half: -1 });
          drawGroundShockBand(p, 14, 0, 18 + 42 * ease.outCubic(clamp(ageC / 0.36)), RSY, 2.8, (1 - clamp(ageC / 0.46)) * sFade, [C[2], C[4], C[6], WHITE], true);
        }
      }

      // Back half of sound-barrier vapor ring punched open at supersonic launch!
      if (t >= T_THROW && t < T_THROW + 0.28) {
        const uB = (t - T_THROW) / 0.28;
        drawSoundBarrierRing(p, 26, -39, 9 + 6 * uB, 18 + 20 * ease.outCubic(uB), 3.6 * (1 - uB * 0.65), [WHITE, D[6], C[5]], (1 - uB) * 0.9, true);
      }

      // Back half of boulder's orbiting emerald spiritual aura
      if (t >= T_STAMP && t < T_HIT) {
        const [bx, by] = boulderPos(t);
        const auraA = smooth(T_STAMP, T_STAMP + 0.14, t);
        drawMossAuraHelix(p, bx, by, R_BOULDER, t, C, auraA, true);
      }

      // Ground-skimming supersonic pressure furrow scarred along the flight path
      if (t >= T_THROW && t < 1.80) {
        const reachX = t < T_HIT ? boulderPos(t)[0] : TX - 6;
        const fFade = (1 - smooth(1.15, 1.78, t)) * endFade;
        for (let x = 22; x <= reachX; x += 2) {
          const dist = reachX - x;
          const k = clamp(1 - dist / 145) * fFade;
          if (k <= 0.04) continue;
          p.dot(x, 0, k > 0.6 ? D[5] : D[2], k * 0.85);
          if ((x & 2) === 0 && k > 0.35) p.dot(x, -1, k > 0.68 ? C[5] : D[4], k * 0.72);
        }
      }

      // 2. Impact crater, subterranean fault cracks, far-half dust-shockwave ring & knockback skid trenches
      if (t >= T_HIT) {
        const ageH = t - T_HIT;
        const hFade = (1 - smooth(1.65, 2.38, ageH)) * endFade;
        const hHeat = 1 - smooth(0.12, 0.95, ageH);

        if (hFade > 0.02) {
          drawCracks(p, hitCracks, (c) => c.len * ease.outCubic(clamp((ageH - c.t0) / 0.11)), (d) => clamp(hHeat - d * 0.007, 0, 1), [WHITE, C[7], C[5], C[3]], S[0], S[6], hFade);
        }

        const crW = 30 * ease.outCubic(clamp(ageH / 0.09));
        for (let dx = -Math.floor(crW); dx <= Math.floor(crW); dx++) {
          const q = Math.abs(dx) / Math.max(1, crW);
          const dep = Math.round(3.4 * (1 - q * q));
          for (let y = 0; y <= dep; y++) {
            p.dot(TX + dx, y, y === dep && hHeat > 0.35 ? (hHeat > 0.65 ? C[6] : C[4]) : S[0], endFade * 0.95);
          }
          if (q > 0.82) p.dot(TX + dx, -1, q > 0.92 ? D[5] : S[5], endFade * 0.9);
        }
      }

      if (t >= T_SHATTER) {
        const ageS = t - T_SHATTER;

        // Twin deep ploughed knockback skid-furrows from TX to enemyX(t)
        const ex = enemyX(t);
        const skidFade = (1 - smooth(1.68, 2.38, ageS)) * endFade;
        for (let x = TX - 2; x <= Math.round(ex) + 8; x++) {
          const u = (x - TX) / Math.max(1, KNOCK_DIST);
          p.dot(x, 0, S[0], skidFade);
          p.dot(x, 1, D[1], skidFade * 0.94);
          if ((x + 1) % 2 === 0) {
            p.dot(x, -1, u > 0.6 ? D[6] : D[4], skidFade * 0.92);
            p.dot(x, 2, x % 5 === 0 ? C[4] : D[4], skidFade * 0.85);
          }
        }

        // Far half of 3D expanding ground shockwave crest + wide rolling dust-storm ring
        const uW = ageS / 0.58;
        if (uW < 1) {
          drawGroundShockBand(p, TX, 0, 16 + 92 * ease.outQuart(uW), RSY, Math.max(1, 5.6 * (1 - uW)), (1 - uW) * endFade, [D[2], D[5], C[6], WHITE], true);
        }
        const uD = ageS / 1.22;
        if (uD < 1) {
          dustRing(p, TX, 0, 16 + 90 * ease.outCubic(uD), 10 + 5.5 * Math.sin(Math.PI * uD), (1 - smooth(0.42, 1, uD)) * 0.88 * endFade, D[5], {
            sy: RSY,
            ph: 1.3 + ageS * 1.4,
            brk: smooth(0.45, 1, uD) * 0.75,
            lit: 0.38,
            half: -1,
          });
        }

        for (const rw of radialDustWave) {
          if (Math.sin(rw.a) >= 0) continue;
          const rAge = t - rw.t0;
          if (rAge < 0 || rAge >= rw.life) continue;
          const u = rAge / rw.life;
          const dist = 12 + rw.reach * ease.outQuart(u);
          const wx = TX + Math.cos(rw.a) * dist;
          const wy = Math.sin(rw.a) * dist * RSY - rw.lift * Math.sin(Math.PI * Math.pow(u, 0.7));
          drawDustBillow(p, wx, wy, lerp(rw.r0, rw.r1, ease.outCubic(u)), u, D, C, endFade, 0.2);
        }

        for (const pb of plumeBillows) {
          const bAge = t - pb.t0;
          if (bAge < 0 || bAge >= pb.life) continue;
          const u = bAge / pb.life;
          const px = clamp(pb.x0 + (pb.vx * (1 - Math.exp(-2.8 * bAge))) / 2.8, X_MIN + 18, X_MAX - 18);
          const py = clamp(pb.y0 + (pb.vy * (1 - Math.exp(-2.4 * bAge))) / 2.4, Y_MIN + 18, -5);
          drawDustBillow(p, px, py, lerp(pb.r0, pb.r1, ease.outCubic(u)), u, D, C, endFade, pb.emerald);
        }
      }

      // Far half of 3D orbiting stun halo behind the dazed enemy's head
      if (t >= T_SHATTER + 0.08) {
        const stunAge = t - (T_SHATTER + 0.08);
        const stunK = smooth(0, 0.16, stunAge) * (1 - smooth(1.92, 2.28, stunAge)) * endFade;
        if (stunK > 0.03) {
          const sway = Math.sin(t * 8.2) * 3.2 * stunK;
          drawStunHalo(p, enemyX(t) + sway, -55, t, stunK, St, C, "back");
        }
      }

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-4) return;
      const endFade = 1 - smooth(T_END - 0.52, T_END - 0.04, t);

      // Heaving tilted floor bedrock slabs at cast origin (0.03..1.30s)
      if (t >= T_STAMP && t < 1.32) {
        const slSink = smooth(0.85, 1.30, t);
        const jx = t < T_THROW ? Math.sin(t * 85) * 1.0 : 0;
        for (const sl of castSlabs) {
          sl.cache(p, sl.x + jx, sl.y - 1.5 + slSink * 4, sl.a, (1 - slSink) * endFade, 0);
        }
      }

      // ==== PHASE 1 & 2: EMERGING & HURTLING COLOSSAL MOSS BOULDER ====
      if (t >= T_STAMP && t < T_SHATTER) {
        const [bx, by] = boulderPos(t);
        const rot = boulderRot(t);

        // A. Cast phase (0.03..0.62s): wide cyclonic dust storm, ascending emerald qi wisps & anti-gravity cobbles
        if (t < T_THROW + 0.24) {
          const ageC = t - T_STAMP;
          const sFade = (1 - smooth(T_THROW - 0.02, T_THROW + 0.22, t)) * endFade;
          const uS = clamp(ageC / 0.62);
          dustRing(p, 14, 0, 26 + 30 * Math.sin(uS * 1.45), 9.5, 0.86 * sFade, D[5], { sy: RSY, ph: t * 5.8, lit: 0.38, half: 1 });
          drawGroundShockBand(p, 14, 0, 18 + 42 * ease.outCubic(clamp(ageC / 0.36)), RSY, 2.8, (1 - clamp(ageC / 0.46)) * sFade, [C[2], C[4], C[6], WHITE], false);

          if (t < T_THROW) {
            const wK = Math.sin(Math.PI * clamp(ageC / 0.60));
            frontCrescent(p, 14 - 38 - 8 * uS, -1, 24 * wK, 7.0 * wK, [D[6], D[5], D[3]], 0.84 * sFade);
            frontCrescent(p, 14 + 38 + 8 * uS, 1, 24 * wK, 7.0 * wK, [D[6], D[5], D[3]], 0.84 * sFade);

            // Ascending emerald-jade spiritual qi ribbons rising from the earth fissure into the levitating rock!
            for (let k = 0; k < 4; k++) {
              const xBase = 14 + (k - 1.5) * 18;
              for (let s = 0; s <= 18; s++) {
                const u = s / 18;
                const qx = lerp(xBase, bx + (k - 1.5) * 8, u) + Math.sin(u * 6.5 - t * 14 + k * 1.7) * 4.5;
                const qy = lerp(-1, by + 6, u);
                if (qy >= 0) continue;
                const col = u > 0.65 ? C[7] : u > 0.3 ? C[5] : C[4];
                p.dot(qx, qy, col, 0.82 * wK * (0.4 + 0.6 * Math.sin(Math.PI * u)));
                p.dot(qx + 1, qy, C[3], 0.55 * wK * Math.sin(Math.PI * u));
              }
            }
          }

          for (const sp of castStormPuffs) {
            const pAge = t - sp.t0;
            if (pAge < 0 || pAge >= sp.life) continue;
            const u = pAge / sp.life;
            const ang = sp.ang0 + pAge * 7.4;
            const rr = lerp(sp.rad0, sp.rad1, u);
            const sx = lerp(14, bx, u * 0.55) + Math.cos(ang) * rr;
            const sy = lerp(-3, sp.yEnd, ease.outQuad(u)) + Math.sin(ang) * rr * 0.22;
            drawDustBillow(p, sx, sy, lerp(sp.r0, sp.r1, u), u, D, C, sFade * 0.94, 0.32);
          }

          if (t < T_THROW) {
            for (const lp of levPebbles) {
              if (t < lp.t0) continue;
              const uL = clamp((t - lp.t0) / (T_THROW - lp.t0));
              const lx = lp.x0 + Math.sin(t * 14 + lp.ph) * 2.5 * uL;
              const ly = -2 - lp.rise * ease.outQuad(uL) + Math.cos(t * 24 + lp.ph) * 1.2;
              drawMossCobble(p, lx, ly, lp.kind, S, C, 1);
            }
          }
        }

        // B. Flight phase (0.62..0.94s): thick swept Mach cones + sound-barrier ring + boulder silhouettes!
        if (t >= T_THROW && t < T_HIT) {
          // 1) Thick slipstream wind-sheath ribbons & emerald spiritual streamers trailing behind the boulder
          const wakeStart = Math.max(18, bx - 118);
          for (const [yOff, thick, isJade] of [[-R_BOULDER * 0.88, 5.2, false], [R_BOULDER * 0.86, 5.0, false], [-8, 3.8, true], [9, 3.6, true]]) {
            const steps = Math.max(8, Math.ceil((bx - wakeStart) / 1.8));
            for (let s = 0; s <= steps; s++) {
              const u = s / steps;
              const wx = lerp(wakeStart, bx - 4, u);
              const wave = Math.sin(wx * 0.10 - t * 40 + yOff) * 2.4 * (1 - u);
              const wy = by + yOff * (1.20 - 0.20 * u) + wave;
              const hw = thick * u * (0.58 + 0.42 * Math.sin(Math.PI * Math.pow(u, 0.56)));
              const col = isJade ? (u > 0.72 ? C[7] : u > 0.38 ? C[5] : C[3]) : (u > 0.75 ? WHITE : u > 0.40 ? D[6] : D[4]);
              for (let o = -hw; o <= hw; o += 0.8) {
                p.blend(wx, wy + o, col, u * 0.76);
              }
            }
          }

          // 2) 3 True-Translucent Boulder Silhouette Afterimages ("厚重的音爆气浪残影")
          const lags = [0.092, 0.058, 0.027];
          for (let gi = 0; gi < lags.length; gi++) {
            const gt = t - lags[gi];
            if (gt < T_THROW - 0.01) continue;
            const [gx, gy] = boulderPos(gt);
            const sc = 0.80 + 0.07 * gi;
            heroBoulder.draw(p, gx, gy, boulderRot(gt), S, C, D, {
              scaleX: sc * 1.14,
              scaleY: sc * 0.92,
              clipFloor: -1,
              mode: 1,
              ghostTint: 2 - gi,
              alpha: 0.24 + gi * 0.16,
            });
          }

          // 3) 4 Staggered Thick Parabolic Sonic-Boom Cones left booming in the air!
          for (const mc of machCones) {
            const mAge = t - mc.t0;
            if (mAge < 0 || mAge >= mc.dur) continue;
            const uM = mAge / mc.dur;
            const cx = lerp(mc.x0, mc.x1, ease.outQuad(uM));
            const hh = lerp(mc.h0, mc.h1, ease.outCubic(uM));
            const wt = mc.th * (1 - uM * 0.58);
            const cols = uM < 0.34 ? [WHITE, D[6], C[5]] : [D[6], D[4], C[3]];
            drawSonicCone(p, cx, mc.y, hh, wt, mc.sweep * (0.8 + 0.4 * uM), cols, (1 - uM) * 0.94);
          }

          // 4) Ground-skimming supersonic shock-crescent racing under the boulder
          frontCrescent(p, clamp(bx + 8, X_MIN + 14, X_MAX - 14), 1, 22, 6.5, [WHITE, D[6], C[5]], 0.90);
        }

        // C. Draw the Colossal Ancient Moss Boulder (splitting wide open along white-jade fault seams on T_HIT!)
        const crushing = t >= T_HIT;
        heroBoulder.draw(p, bx, by, rot, S, C, D, {
          scaleX: crushing ? 0.88 : t >= T_THROW ? 1.04 : 1,
          scaleY: crushing ? 1.12 : 1,
          clipFloor: 0,
          veinGlow: crushing ? 1.0 : t >= T_THROW ? 0.80 : smooth(0, 0.45, t) * 0.72,
          noseHeat: t >= T_THROW && !crushing ? smooth(T_THROW, T_THROW + 0.1, t) * 0.78 : 0,
          mode: crushing ? 2 : 0,
          alpha: 1,
        });

        drawMossAuraHelix(p, bx, by, R_BOULDER, t, C, 1, false);

        // Front half of sound-barrier vapor ring punched open at supersonic launch
        if (t >= T_THROW && t < T_THROW + 0.28) {
          const uB = (t - T_THROW) / 0.28;
          drawSoundBarrierRing(p, 26, -39, 9 + 6 * uB, 18 + 20 * ease.outCubic(uB), 3.6 * (1 - uB * 0.65), [WHITE, D[6], C[5]], (1 - uB) * 0.94, false);
        }

        // Leading parabolic supersonic Mach bow-shock hood hugging the boulder's nose
        if (t >= T_THROW && t < T_HIT) {
          drawSonicCone(p, bx + R_BOULDER + 7, by, R_BOULDER * 1.44, 6.6, 30, [WHITE, C[6], D[5]], 0.94);
        }

        p.glow(bx, by, 40, C[5], crushing ? 0.55 : 0.18);
      }

      // ==== PHASE 3: OPPRESSIVE ENEMY BEING-HIT VFX (0.94..1.16s) ====
      if (t >= T_HIT && t < T_HIT + 0.22) {
        const ageH = t - T_HIT;
        const kH = 1 - ageH / 0.22;

        // Impact spikes radiating AROUND the splitting boulder's contact face (TX + 4) so the splitting rock stays visible!
        if (ageH < 0.09) {
          const kC = 1 - ageH / 0.09;
          star(p, TX + 5, -28, crushStar, ageH < 0.04 ? 1.15 : 0.94, 0.75 + 0.35 * kC, [C[0], C[5], C[7], WHITE], kC * 0.92, 2.4);
          flare(p, TX + 5, -28, 27 * kC, kC * 0.85, [C[4], C[6], C[7], WHITE]);
        }

        // Through-enemy supersonic blow-out shock cone blasting rightward (+x) out the enemy's back!
        for (const [ang, len0, w0] of [[-0.36, 76, 3.3], [-0.18, 94, 4.2], [0.0, 108, 5.0], [0.17, 90, 4.0], [0.33, 70, 3.1]]) {
          const L = len0 * ease.outCubic(clamp(ageH / 0.08));
          drawShockSpear(p, TX + 4, -28, ang, L, w0 * kH, C[0], ageH < 0.07 ? C[6] : D[5], WHITE, kH);
        }

        // Oppressive vertical downward-crushing pressure spears slamming the floor under the enemy!
        if (ageH < 0.14) {
          const kV = 1 - ageH / 0.14;
          for (const dx of [-14, 0, 14]) {
            drawShockSpear(p, TX + dx, -58, Math.PI / 2, 57, 2.8 * kV, C[0], C[5], WHITE, kV * 0.92);
          }
          p.ellipse(TX, 0, 36 * (1 - ageH * 2.2), 4.5, (d) => (d > 0.72 ? C[5] : d > 0.4 ? C[7] : WHITE), kV);
        }
      }

      // ==== PHASE 4: THUNDEROUS BOULDER SHATTER & EXPANDING DUST-STORM RING (1.00..3.50s) ====
      if (t >= T_SHATTER) {
        const ageS = t - T_SHATTER;

        // 1. Near half of 3D-perspective ground shockwave crest & wide lumpy dust-storm ring
        const uW = ageS / 0.58;
        if (uW < 1) {
          drawGroundShockBand(p, TX, 0, 16 + 92 * ease.outQuart(uW), RSY, Math.max(1, 5.6 * (1 - uW)), (1 - uW) * endFade, [D[2], D[5], C[6], WHITE], false);
        }
        const uD = ageS / 1.22;
        if (uD < 1) {
          dustRing(p, TX, 0, 16 + 90 * ease.outCubic(uD), 10 + 5.5 * Math.sin(Math.PI * uD), (1 - smooth(0.42, 1, uD)) * 0.94 * endFade, D[6], {
            sy: RSY,
            ph: 1.3 + ageS * 1.4,
            brk: smooth(0.45, 1, uD) * 0.75,
            lit: 0.40,
            half: 1,
          });
        }

        // 2. Near half of radially surging scalloped dust-wave billows ("一圈扩散的尘土气浪")
        for (const rw of radialDustWave) {
          if (Math.sin(rw.a) < 0) continue;
          const rAge = t - rw.t0;
          if (rAge < 0 || rAge >= rw.life) continue;
          const u = rAge / rw.life;
          const dist = 12 + rw.reach * ease.outQuart(u);
          const wx = TX + Math.cos(rw.a) * dist;
          const wy = Math.sin(rw.a) * dist * RSY - rw.lift * Math.sin(Math.PI * Math.pow(u, 0.7));
          drawDustBillow(p, wx, wy, lerp(rw.r0, rw.r1, ease.outCubic(u)), u, D, C, endFade, 0.2);
        }

        // 3. Towering left & right crescent dust-storm air walls racing outward along the ground
        if (ageS < 0.48) {
          const uC = ageS / 0.48;
          const dist = 16 + 92 * ease.outQuart(uC);
          const hC = 42 * (1 - uC * 0.60), wC = 11.5 * (1 - uC * 0.56);
          const cols = uC < 0.24 ? [WHITE, D[6], D[4]] : [D[6], D[5], D[2]];
          frontCrescent(p, clamp(TX + dist, X_MIN + 14, X_MAX - 10), 1, hC, wC, cols, (1 - uC) * endFade);
          frontCrescent(p, clamp(TX - dist, X_MIN + 10, X_MAX - 14), -1, hC, wC, cols, (1 - uC) * endFade);
        }

        // 4. Snappy shatter starburst + gapped flying shock-crescent shards (clipped cleanly at floor!)
        if (ageS < 0.13) {
          const kS = 1 - ageS / 0.13;
          star(p, TX, -26, shatterStar, ageS < 0.04 ? 1.24 : 1.0, 0.72 + 0.5 * kS, [C[0], C[5], C[7], WHITE], kS, 3.2);
          flare(p, TX, -26, 26 * kS, kS, [D[4], C[6], C[7], WHITE]);
        }
        const uR = ageS / 0.34;
        if (uR < 1) {
          brokenRing(p, TX, -26, 18 + 68 * ease.outQuart(uR), Math.max(1, 4.2 * (1 - uR)), ringSegs, 0.42 + 0.55 * uR, uR < 0.24 ? WHITE : D[6], C[5], (1 - uR) * endFade, 0.85, 0);
        }

        // 5. Kinetic knockback shove-crescent wrapping the skidding enemy (1.00..1.34s)
        if (ageS < 0.34) {
          const uK = ageS / 0.34;
          const ex = enemyX(t);
          frontCrescent(p, clamp(ex + 10, X_MIN + 12, X_MAX - 12), 1, 40 * (1 - uK * 0.45), 8.0 * (1 - uK * 0.55), [WHITE, C[6], D[4]], (1 - uK) * endFade);
        }

        // 6. Near half of 3D orbiting stun halo + popping dizzy sparkles above the knocked-back enemy!
        if (t >= T_SHATTER + 0.08) {
          const stunAge = t - (T_SHATTER + 0.08);
          const stunK = smooth(0, 0.16, stunAge) * (1 - smooth(1.92, 2.28, stunAge)) * endFade;
          if (stunK > 0.03) {
            const ex = enemyX(t);
            const sway = Math.sin(t * 8.2) * 3.2 * stunK;
            drawStunHalo(p, ex + sway, -55, t, stunK, St, C, "front");
            for (let k = 0; k < 3; k++) {
              const ph = (stunAge * 3.2 + k * 0.37) % 1;
              const arm = Math.round(2.6 * Math.sin(Math.PI * ph) * stunK);
              if (arm >= 1) {
                const tx = ex + sway + Math.cos(k * 2.1 + Math.floor(stunAge * 3.2)) * 15;
                const ty = -55 - 4 + Math.sin(k * 3.7) * 4;
                sparkle(p, tx, ty, arm, St[4], St[5], 0.42 * stunK);
              }
            }
          }
        }
      }

      // Draw all sky-arcing & bouncing shattered boulder chunks & cobbles (+ brief motion trails right after detonation!)
      const trailK = t >= T_SHATTER && t < T_SHATTER + 0.28 ? 1 - (t - T_SHATTER) / 0.28 : 0;
      for (const b of bits.list) {
        const bFade = Math.min(1, b.life / 0.42) * endFade;
        if (trailK > 0.05 && b.cobble === undefined) {
          const tx = clamp(b.x - b.vx * 0.026, X_MIN + 8, X_MAX - 8);
          const ty = clamp(b.y - b.vy * 0.026, Y_MIN + 8, -1);
          p.line(b.x, b.y, tx, ty, b.hot > 0.4 ? C[6] : D[5], 0.48 * trailK * bFade);
        }
        if (b.cobble !== undefined) drawMossCobble(p, b.x, b.y, b.cobble, S, C, bFade);
        else chunkRenderers[b.ci ?? 0](p, b.x, b.y, b.a, bFade, b.hot ?? 0);
      }

      const leafPal = [C[0], C[2], C[4], C[6]];
      for (const lf of leaves) {
        const lfFade = (1 - smooth(0.65, 1, lf.age / lf.life)) * endFade;
        drawLeaf(p, lf.x, lf.y, lf.len, lf.wid, lf.ang, lf.fl, leafPal, lfFade);
      }

      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}
