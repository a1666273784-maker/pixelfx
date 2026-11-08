// Fire tongues, puffs, ground rubble and shockwave recipes build on Sprite Fusion's open-source fire and explosion VFX
// (https://www.spritefusion.com/pixel-art-vfx), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Bits, Lights, P, PF, B, Rng, fit, band, flare, sparkle, clamp, smooth, seg, lerp, ease, loopNoise, TAU, WHITE, mix } from "../../core/index.js";
import { hotFirst, flameTongue, soft, simDraw, floorLight, LAYERS } from "./_lib.js";
import { stoneShape, drawRock } from "../nature/_lib.js";
import { shape } from "../status/_lib.js";

const T_TREMBLE = 0.10;
const T_ROAR = 0.58;     // Warrior & Qilin Dharmakaya throw heads skyward; crimson-gold halo blasts open!
const T_SURGE2 = 1.28;   // Second oppressive roar pulse heaves the crimson-gold halo even wider
const T_DROP = 2.52;     // Pressure releases; levitating boulders crash back to earth and aura dissolves
const T_END = 3.8;
const SY = 0.18;

export const meta = {
  name: "Qilin roar",
  desc: "The warrior coils as cracked-earth boulders levitate, then roars skyward with a towering Crimson-Gold Qilin phantom while an oppressive solar-flame halo forces outward.",
  tags: ["fire", "qilin", "roar", "charge", "aura", "boss", "earth", "gold", "chinese", "one-shot"],
  size: [308, 228],
  origin: [154, 198],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#1c0508", "#480b10", "#841616", "#c62f18", "#ee621a", "#f9a626", "#ffdf6c", "#fff9dc"],
    stone: ["#120f1a", "#211b2e", "#352c47", "#4d4066", "#6a5a88", "#8d7cab", "#b6a7cf", "#e2d9f2"],
    seed: 7,
  },
};

// Pure self-originating roar & charge stances (NO target, NO hit-on-enemy VFX)
const STAND_END = { crouch: 3, fx: 11, fy: -21, bx: 9, by: -21, ffx: 7, fbx: -7 };
const COIL1 = { turn: 0.96, crouch: 7, lean: 4, hy: 3, fx: -7, fy: -16, bx: 8, by: -16, ffx: -6, fbx: 7 };
const COIL2 = { turn: 1.0, crouch: 10, lean: 5, hy: 4, fx: -6, fy: -14, bx: 7, by: -14, ffx: -7, fbx: 8 };
const ROAR1 = { turn: 1.08, crouch: 1, lean: -5, hy: -4, fx: -14, fy: -24, bx: 15, by: -24, ffx: -7, fbx: 8 };
const ROAR2 = { turn: 1.12, crouch: 2, lean: -6, hy: -5, fx: -15, fy: -26, bx: 16, by: -26, ffx: -8, fbx: 9 };
const RECOVER = { turn: 0.98, crouch: 5, lean: 1, hy: 0, fx: -7, fy: -18, bx: 8, by: -18, ffx: -5, fbx: 6 };

export const act = {
  onBody: true,
  follow: 0,
  poses: [
    [-0.28, STAND_END],
    [0.0, COIL1],
    [T_ROAR - 0.05, COIL2],
    [T_ROAR, ROAR1, "snap"],
    [T_SURGE2 - 0.04, { ...ROAR1, crouch: 3, fy: -22, by: -22 }],
    [T_SURGE2, ROAR2, "snap"],
    [T_DROP, ROAR2],
    [3.12, RECOVER],
    [T_END, STAND_END],
  ],
  hits: [
    { t: T_TREMBLE, stop: 0.03, shake: 0.25, amp: 1.8 },
    { t: T_ROAR, stop: 0.13, shake: 0.46, amp: 4.6 },
    { t: T_SURGE2, stop: 0.06, shake: 0.38, amp: 3.4 },
  ],
  dust: [
    { t: T_TREMBLE, x: -12, n: 4, dir: -1 },
    { t: T_TREMBLE, x: 12, n: 4, dir: 1 },
    { t: T_ROAR, x: -18, n: 10, dir: -1 },
    { t: T_ROAR, x: 18, n: 10, dir: 1 },
    { t: T_SURGE2, x: -22, n: 7, dir: -1 },
    { t: T_SURGE2, x: 22, n: 7, dir: 1 },
  ],
};

function makeRockSpriteCache(pts, s, S) {
  const angles = new Map();
  const captureP = {
    cur: null,
    dot(x, y, c) {
      this.cur.push(Math.round(x), Math.round(y), c);
    },
  };
  return (p, rx, ry, rot, alpha = 1, flashWhite = false) => {
    if (flashWhite || alpha < 0.99) {
      drawRock(p, rx, ry, s, rot, pts, S, alpha, flashWhite);
      return;
    }
    const qi = ((Math.round((rot / TAU) * 48) % 48) + 48) % 48;
    let buf = angles.get(qi);
    if (!buf) {
      buf = [];
      captureP.cur = buf;
      drawRock(captureP, 0, 0, s, (qi / 48) * TAU, pts, S, 1, false);
      angles.set(qi, buf);
    }
    const ox = Math.round(rx), oy = Math.round(ry);
    for (let i = 0; i < buf.length; i += 3) {
      p.px(ox + buf[i], oy + buf[i + 1], buf[i + 2]);
    }
  };
}

// Dirty-bounded offscreen scratch buffer + zero-allocation polygon scanline rasterizer
const QW = 128, QH = 140, QX0 = -68, QY0 = -140;
const qCol = new Uint32Array(QW * QH);
const qTag = new Uint8Array(QW * QH);
const polyX = new Float32Array(32);
const polyY = new Float32Array(32);
let qxMin = QW, qxMax = 0, qyMin = QH, qyMax = 0;

function clearQBuf() {
  if (qxMin <= qxMax && qyMin <= qyMax) {
    const x0 = Math.max(0, qxMin - 1), x1 = Math.min(QW - 1, qxMax + 1);
    const y0 = Math.max(0, qyMin - 1), y1 = Math.min(QH - 1, qyMax + 1);
    for (let iy = y0; iy <= y1; iy++) {
      const a = iy * QW + x0, b = iy * QW + x1 + 1;
      qCol.fill(0, a, b);
      qTag.fill(0, a, b);
    }
  }
  qxMin = QW;
  qxMax = 0;
  qyMin = QH;
  qyMax = 0;
}

function fillPolyBuf(pts, col, tag = 1) {
  const n = pts.length;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let i = 0; i < n; i++) {
    const x = pts[i][0], y = pts[i][1];
    polyX[i] = x;
    polyY[i] = y;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const ix0 = Math.max(1, Math.floor(x0) - QX0), ix1 = Math.min(QW - 2, Math.ceil(x1) - QX0);
  const iy0 = Math.max(1, Math.floor(y0) - QY0), iy1 = Math.min(QH - 2, Math.ceil(y1) - QY0);
  if (ix0 > ix1 || iy0 > iy1) return;
  if (ix0 < qxMin) qxMin = ix0;
  if (ix1 > qxMax) qxMax = ix1;
  if (iy0 < qyMin) qyMin = iy0;
  if (iy1 > qyMax) qyMax = iy1;

  const isFn = typeof col === "function";
  for (let iy = iy0; iy <= iy1; iy++) {
    const py = iy + QY0 + 0.5;
    const rowOff = iy * QW;
    for (let ix = ix0; ix <= ix1; ix++) {
      const px = ix + QX0 + 0.5;
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = polyY[i], yj = polyY[j];
        if ((yi > py) !== (yj > py) && px < ((polyX[j] - polyX[i]) * (py - yi)) / (yj - yi) + polyX[i]) {
          inside = !inside;
        }
      }
      if (inside) {
        const k = rowOff + ix;
        qCol[k] = isFn ? col(px, py) : col;
        qTag[k] = tag;
      }
    }
  }
}

function strokePolyBuf(spine, col, tag = 1) {
  const m = spine.length;
  const pts = new Array(m * 2);
  for (let i = 0; i < m; i++) {
    const [x, y, w] = spine[i];
    const p0 = spine[i > 0 ? i - 1 : 0], p1 = spine[i < m - 1 ? i + 1 : m - 1];
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    pts[i] = [x + nx * w, y + ny * w];
    pts[m * 2 - 1 - i] = [x - nx * w, y - ny * w];
  }
  fillPolyBuf(pts, col, tag);
}

function lineBuf(x0, y0, x1, y1, col, tag = 3) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= steps; i++) {
    const ix = Math.round(x0 + ((x1 - x0) * i) / steps) - QX0;
    const iy = Math.round(y0 + ((y1 - y0) * i) / steps) - QY0;
    if (ix >= 1 && ix < QW - 1 && iy >= 1 && iy < QH - 1) {
      qCol[iy * QW + ix] = col;
      qTag[iy * QW + ix] = tag;
      if (ix < qxMin) qxMin = ix;
      if (ix > qxMax) qxMax = ix;
      if (iy < qyMin) qyMin = iy;
      if (iy > qyMax) qyMax = iy;
    }
  }
}

// Hand-crafted S-Curved Mythical Qilin Dharmakaya ("赤金麒麟法相仰头长啸")
function drawQilinDharmakaya(p, t, C, alpha) {
  if (alpha <= 0.03) return null;
  clearQBuf();

  const preCoil = t < T_ROAR ? smooth(0, T_ROAR, t) : 0;
  const roarSnap = t < T_ROAR ? 0 : ease.outBack(seg(t, T_ROAR, T_ROAR + 0.18), 1.36);
  const surge2 = t >= T_SURGE2 ? 0.14 * Math.sin(Math.PI * seg(t, T_SURGE2, T_DROP)) : 0;
  const poseK = clamp(roarSnap + surge2 - 0.18 * preCoil, -0.2, 1.15);

  const hx = lerp(6, 2, clamp(roarSnap, 0, 1));
  const hy = lerp(-54, -90, clamp(roarSnap, 0, 1)) - surge2 * 5;
  const pitch = lerp(0.18, -0.78, clamp(poseK, -0.2, 1.12));
  const jawOpen = t < T_ROAR ? 0.06 : lerp(0.08, 0.72, clamp(roarSnap, 0, 1)) + 0.05 * Math.sin(t * 36) + surge2 * 0.08;

  const ux = Math.cos(pitch), uy = Math.sin(pitch);
  const dx = -uy, dy = ux;
  const hp = (f, d) => [hx + ux * f + dx * d, hy + uy * f + dy * d];

  const n0 = [-10, -10, 15.0];
  const n1 = [lerp(-7, -14, clamp(roarSnap, 0, 1)), lerp(-24, -36, clamp(roarSnap, 0, 1)), 14.0];
  const n2 = [lerp(2, -4, clamp(roarSnap, 0, 1)), lerp(-40, -62, clamp(roarSnap, 0, 1)), 11.4];
  const n3 = [hx - ux * 2, hy - uy * 2 + 2, 8.5];
  const neckSpine = [n0, n1, n2, n3];

  const spineXAtY = (py) => {
    if (py >= n1[1]) return lerp(n0[0], n1[0], clamp((py - n0[1]) / (n1[1] - n0[1] || -1), 0, 1));
    if (py >= n2[1]) return lerp(n1[0], n2[0], clamp((py - n1[1]) / (n2[1] - n1[1] || -1), 0, 1));
    return lerp(n2[0], n3[0], clamp((py - n2[1]) / (n3[1] - n2[1] || -1), 0, 1));
  };
  const spineWAtY = (py) => lerp(15.0, 8.5, clamp((-py - 10) / Math.max(1, -hy - 10), 0, 1));

  // 1) FAR CORAL ANTLER
  {
    const aBase = hp(0, -6.5);
    const aMid = [aBase[0] - 14, aBase[1] - 12];
    const aTip = [aBase[0] - 28, aBase[1] - 25];
    strokePolyBuf([[aBase[0], aBase[1], 2.3], [aMid[0], aMid[1], 1.6], [aTip[0], aTip[1], 0.5]], C[4], 1);
    strokePolyBuf([[aMid[0], aMid[1], 1.4], [aMid[0] - 4, aMid[1] - 11, 0.5]], C[5], 1);
  }

  // 2) BILLOWING 9-PLUME S-CURVED CRIMSON-GOLD FLAME MANE ("赤金烈焰火鬃")
  for (let i = 0; i < 9; i++) {
    const u = i / 8;
    const ry = lerp(-18, hy + 2, u);
    const rx = spineXAtY(ry) - spineWAtY(ry) * 0.55;
    const flk = Math.sin(t * 15 - i * 0.95);
    const len = lerp(31, 21, u) * (0.72 + 0.36 * clamp(roarSnap, 0, 1));
    const l2 = len * len;
    const ang = lerp(2.72, 2.32, u) + flk * 0.11;
    const mx1 = rx + Math.cos(ang) * (len * 0.52);
    const my1 = ry - Math.sin(ang) * (len * 0.52);
    const mx2 = rx + Math.cos(ang - 0.28) * len;
    const my2 = ry - Math.sin(ang - 0.28) * len - 4;
    strokePolyBuf(
      [[rx, ry, 4.8], [mx1, my1, 2.9], [mx2, my2, 0.5]],
      (px, py) => {
        const d2 = ((px - rx) * (px - rx) + (py - ry) * (py - ry)) / l2;
        return d2 > 0.58 ? C[7] : d2 > 0.21 ? C[6] : d2 > 0.04 ? C[4] : C[2];
      },
      2
    );
  }

  // 3) S-CURVED SCALED QILIN NECK & SEGMENTED VENTRAL BREASTPLATE
  strokePolyBuf(
    neckSpine,
    (px, py) => {
      const cx = spineXAtY(py), hw = spineWAtY(py);
      const q = (px - cx) / hw;
      if (py > -39 && Math.abs(px) < 10) return C[1];
      if (q > 0.38) {
        const platePhase = (py + q * 5.5) % 6;
        if (Math.abs(platePhase) < 1.05) return C[3];
        return q > 0.68 ? C[7] : C[6];
      }
      const dScale = ((Math.floor(px * 0.36) + Math.floor(py * 0.36)) & 1) === 0;
      if (q > -0.08) return dScale ? C[5] : C[4];
      if (q > -0.52) return dScale ? C[3] : C[2];
      return C[2];
    },
    1
  );

  // 4) DARK ROARING MOUTH CAVITY + DEEP THROAT FIRE CORE + CURLED FIERY TONGUE
  const jAng = pitch + jawOpen;
  const jux = Math.cos(jAng), juy = Math.sin(jAng);
  const jdx = -juy, jdy = jux;
  const jp = (f, d) => [hx + dx * 4.5 + jux * f + jdx * d, hy + dy * 4.5 + juy * f + jdy * d];

  if (jawOpen > 0.18) {
    const tx = hx + ux * 6 + dx * 2, ty = hy + uy * 6 + dy * 2;
    fillPolyBuf([hp(4, 1.2), hp(20, 1.5), jp(17, -0.5), jp(3, -1)], (px, py) => {
      const d2 = (px - tx) * (px - tx) + (py - ty) * (py - ty);
      return d2 < 17.6 ? WHITE : d2 < 56.2 ? C[6] : C[1];
    }, 2);
    const tg0 = jp(5, -0.8), tg1 = hp(12, 4.5), tg2 = hp(17, 3.8);
    strokePolyBuf([[tg0[0], tg0[1], 1.8], [tg1[0], tg1[1], 1.3], [tg2[0], tg2[1], 0.5]], C[5], 2);
  }

  // 5) SCULPTED DRAGON-WOLF UPPER SKULL, ANGRY BROW, SNOUT & UPTURNED QILIN NASAL HORN
  fillPolyBuf(
    [
      hp(-6, -4.5),
      hp(2, -9.5),
      hp(10, -7.0),
      hp(19, -6.2),
      hp(26, -11.0),
      hp(27.5, -3.5),
      hp(25, 1.6),
      hp(14, 1.2),
      hp(5, 2.4),
      hp(-4, 2.0),
    ],
    (px, py) => {
      const relD = (px - hx) * dx + (py - hy) * dy;
      const relF = (px - hx) * ux + (py - hy) * uy;
      if (relF > 20 && relD < -5.0) return WHITE;
      if (relD < -5.2) return C[7];
      if (relD < -1.5) return C[6];
      if (relD < 0.8) return C[5];
      return C[3];
    },
    2
  );

  if (jawOpen > 0.18) {
    fillPolyBuf([hp(21.5, 1.0), hp(24.5, 1.2), hp(22.8, 6.2)], WHITE, 3);
    fillPolyBuf([hp(15.0, 1.0), hp(17.5, 1.1), hp(16.2, 4.8)], C[7], 3);
  }

  // 6) HINGED LOWER JAW, LOWER CANINE FANG & GOLDEN FLAME BEARD
  fillPolyBuf(
    [
      jp(0, -0.8),
      jp(19, -0.5),
      jp(22.5, 1.2),
      jp(18.5, 4.6),
      jp(9, 5.2),
      jp(1, 4.0),
    ],
    (px, py) => {
      const relD = (px - (hx + dx * 4.5)) * jdx + (py - (hy + dy * 4.5)) * jdy;
      return relD < 1.3 ? C[7] : relD < 3.2 ? C[5] : C[3];
    },
    2
  );
  if (jawOpen > 0.18) {
    fillPolyBuf([jp(18.5, -0.4), jp(21.2, 0.2), jp(20.2, -5.0)], WHITE, 3);
  }
  const chin = jp(13, 4.5);
  strokePolyBuf([[chin[0], chin[1], 2.4], [chin[0] - 9, chin[1] + 6, 1.5], [chin[0] - 18, chin[1] + 9 + Math.sin(t * 18) * 2, 0.5]], C[6], 2);

  // 7) HERO NEAR BRANCHED CORAL-DRAGON ANTLER + FLOWING DRAGON WHISKER
  {
    const b0 = hp(3, -8.0);
    const b1 = [b0[0] + Math.cos(pitch - 2.52) * 16, b0[1] + Math.sin(pitch - 2.52) * 16];
    const b2 = [b1[0] + Math.cos(pitch - 2.25) * 19, b1[1] + Math.sin(pitch - 2.25) * 19];
    strokePolyBuf(
      [[b0[0], b0[1], 3.0], [b1[0], b1[1], 2.1], [b2[0], b2[1], 0.6]],
      (px, py) => ((px - b0[0]) * (px - b0[0]) + (py - b0[1]) * (py - b0[1]) > 324 ? WHITE : C[7]),
      3
    );
    const t1 = [b1[0] + Math.cos(pitch - 1.62) * 11, b1[1] + Math.sin(pitch - 1.62) * 11];
    strokePolyBuf([[b1[0], b1[1], 1.6], [t1[0], t1[1], 0.5]], WHITE, 3);
    const bMid = [(b0[0] + b1[0]) * 0.5, (b0[1] + b1[1]) * 0.5];
    const t0 = [bMid[0] + Math.cos(pitch - 1.72) * 9, bMid[1] + Math.sin(pitch - 1.72) * 9];
    strokePolyBuf([[bMid[0], bMid[1], 1.4], [t0[0], t0[1], 0.5]], C[7], 3);

    const w0 = hp(17, -1.2);
    const wWave = Math.sin(t * 17) * 3;
    strokePolyBuf([[w0[0], w0[1], 1.2], [w0[0] - 12, w0[1] - 4 + wWave * 0.5, 0.8], [w0[0] - 24, w0[1] - 11 + wWave, 0.4]], C[7], 3);
  }

  // 8) BLAZING SLANTED EYE + STREAMING GOLDEN EYE-FLAME
  const eye = hp(8.5, -4.0);
  lineBuf(eye[0] - 1, eye[1], eye[0] + 2.5, eye[1] - 1, WHITE, 4);
  lineBuf(eye[0] - 2, eye[1] + 0.5, eye[0] - 10, eye[1] - 3, C[7], 4);

  const iyStart = Math.max(1, qyMin - 1), iyEnd = Math.min(QH - 2, qyMax + 1);
  const ixStart = Math.max(1, qxMin - 1), ixEnd = Math.min(QW - 2, qxMax + 1);
  for (let iy = iyStart; iy <= iyEnd; iy++) {
    const wy = iy + QY0;
    if (wy > -4) continue;
    const baseDissolve = wy > -28 ? clamp((-4 - wy) / 24, 0, 1) : 1;
    const rowOff = iy * QW;
    for (let ix = ixStart; ix <= ixEnd; ix++) {
      const idx = rowOff + ix;
      const wx = ix + QX0;
      const c = qCol[idx];
      if (!c) {
        if (wy < -18) {
          const nU = qCol[idx - QW], nD = qCol[idx + QW], nL = qCol[idx - 1], nR = qCol[idx + 1];
          if (nU || nD || nL || nR) {
            p.blend(wx, wy, nD && !nU ? C[6] : C[0], alpha * baseDissolve * 0.9);
          }
        }
        continue;
      }
      if (wy > -28) {
        const fLick = 0.5 + 0.5 * Math.sin(wx * 0.45 + t * 22);
        if (baseDissolve + fLick * 0.38 < 0.56) continue;
      }
      const aPx = alpha * baseDissolve * (qTag[idx] >= 3 ? 1 : 0.94);
      if (aPx > 0.92) p.px(wx, wy, c);
      else p.blend(wx, wy, c, aPx);
    }
  }

  const mouth = [(hp(23, 1)[0] + jp(20, 0)[0]) * 0.5, (hp(23, 1)[1] + jp(20, 0)[1]) * 0.5];
  p.glow(eye[0], eye[1], 9, C[7], 0.55 * alpha);
  if (jawOpen > 0.2) p.glow(mouth[0], mouth[1], 18, C[6], 0.55 * alpha);

  return { mouthX: mouth[0], mouthY: mouth[1], pitch };
}

// Crisp Unbroken 3D Foreshortened Sonic Roar Shock-Arcs & Sound-Pressure Speed Lines!
function drawSonicRoarCones(p, qInfo, t, C) {
  if (!qInfo || t < T_ROAR || t >= T_DROP + 0.28) return;
  const dirX = Math.cos(qInfo.pitch), dirY = Math.sin(qInfo.pitch);
  const perpX = -dirY, perpY = dirX;
  const roarFade = t < T_DROP ? 1 : 1 - seg(t, T_DROP, T_DROP + 0.28);

  for (let k = 0; k < 7; k++) {
    const t0 = T_ROAR + k * 0.28;
    const u = (t - t0) / 0.46;
    if (u <= 0 || u >= 1) continue;
    const dist = 6 + 76 * ease.outCubic(u);
    const cx = qInfo.mouthX + dirX * dist;
    const cy = qInfo.mouthY + dirY * dist;
    const major = 10 + 38 * ease.outQuad(u);
    const minor = major * 0.35;
    const fade = (1 - smooth(0.42, 1, u)) * roarFade;

    const steps = Math.max(76, Math.ceil(major * 4.4));
    for (let s = 0; s <= steps; s++) {
      const g = lerp(-2.0, 2.0, s / steps);
      const cg = Math.cos(g), sg = Math.sin(g);
      const wx = cx + dirX * (cg * minor) + perpX * (sg * major);
      const wy = cy + dirY * (cg * minor) + perpY * (sg * major);
      if (wy > -2 || wy < -194 || Math.abs(wx) > 150) continue;
      const ag = Math.abs(g);
      const tipFade = 1 - (ag * ag) * 0.25;
      const a = fade * tipFade;
      if (a < 0.06) continue;
      const col = ag < 0.95 && u < 0.52 ? WHITE : ag < 1.45 ? C[7] : C[5];
      p.blend(Math.round(wx), Math.round(wy), col, a);
      if (ag < 1.15 && u < 0.65) {
        p.blend(Math.round(wx - dirX), Math.round(wy - dirY), C[6], a * 0.82);
        if (ag < 0.65 && u < 0.38) {
          p.blend(Math.round(wx + dirX), Math.round(wy + dirY), WHITE, a * 0.9);
        }
      }
    }
  }

  for (let i = 0; i < 8; i++) {
    const cyc = ((t - T_ROAR) * 3.8 + i * 0.37) % 1;
    if (t - T_ROAR < i * 0.03) continue;
    const spread = ((i / 7) - 0.5) * 0.68;
    const rayA = qInfo.pitch + spread;
    const r0 = 8 + cyc * 56;
    const r1 = r0 + (16 + (i % 3) * 7) * (1 - cyc * 0.5);
    const rx0 = qInfo.mouthX + Math.cos(rayA) * r0, ry0 = qInfo.mouthY + Math.sin(rayA) * r0;
    const rx1 = qInfo.mouthX + Math.cos(rayA) * r1, ry1 = qInfo.mouthY + Math.sin(rayA) * r1;
    if (ry0 > -2 || ry1 > -2 || ry1 < -194) continue;
    const col = cyc < 0.35 ? WHITE : C[6];
    const steps = Math.max(1, Math.ceil(Math.hypot(rx1 - rx0, ry1 - ry0)));
    const a = (1 - cyc) * 0.85 * roarFade;
    for (let s = 0; s <= steps; s++) {
      p.blend(Math.round(lerp(rx0, rx1, s / steps)), Math.round(lerp(ry0, ry1, s / steps)), col, a);
    }
  }
}

function drawPerspectiveHaloFloorRing(p, gr, C, alpha, frontHalf) {
  if (alpha <= 0.04) return;
  const steps = Math.ceil(gr * 2.4);
  const g0 = frontHalf ? 0 : Math.PI;
  const g1 = frontHalf ? Math.PI : TAU;
  for (let i = 0; i <= steps; i++) {
    const g = lerp(g0, g1, i / steps);
    const x = Math.round(Math.cos(g) * gr);
    const y = Math.round(0.5 + Math.sin(g) * gr * SY);
    p.blend(x, y, C[6], alpha * 0.88);
    p.blend(x, y + (frontHalf ? 1 : -1), C[4], alpha * 0.48);
  }
}

export function create(o) {
  const C = fit(o.palette, 8), H = hotFirst(C), S = fit(o.stone, 8);
  const R = new Rng(o.seed), seed = o.seed * 19, floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[7], C[6], C[4]], haze: C[4] });
  const bits = new Bits({ ground: floor }), lights = new Lights();

  const cracks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * TAU + R.range(-0.16, 0.16), len = R.range(44, 122);
    const pts = [[Math.cos(a) * 4, Math.sin(a) * 1.2]];
    let x = pts[0][0], y = pts[0][1], curA = a;
    for (let d = 4; d < len; d += 3.2) {
      curA += R.range(-0.34, 0.34);
      x += Math.cos(curA) * 3.2;
      y = clamp(y + Math.sin(curA) * 0.68, -6, 12);
      pts.push([x, y]);
    }
    return { pts, t0: 0.04 + (i % 3) * 0.03, grow: R.range(0.16, 0.36) };
  });

  const floorSlabs = [-1, 1].map((sd) => {
    const pts = [[-1.18, -0.34], [1.14, -0.40], [1.20, 0.38], [-1.10, 0.40]];
    return { x: sd * 24, sd, s: 6.2, pts, render: makeRockSpriteCache(pts, 6.2, S) };
  });

  const floatRocks = [
    { x0: -38, y0: 2.0, dx: -10, lift1: 18, lift2: 52, s: 5.5, t0: 0.07 },
    { x0: 40, y0: 2.2, dx: 11, lift1: 20, lift2: 58, s: 5.6, t0: 0.08 },
    { x0: -70, y0: 1.2, dx: -14, lift1: 15, lift2: 74, s: 4.6, t0: 0.12 },
    { x0: 72, y0: 1.5, dx: 15, lift1: 16, lift2: 70, s: 4.7, t0: 0.13 },
    { x0: -102, y0: 0.6, dx: -12, lift1: 11, lift2: 44, s: 4.1, t0: 0.17 },
    { x0: 104, y0: 0.8, dx: 12, lift1: 12, lift2: 48, s: 4.2, t0: 0.18 },
    { x0: -52, y0: -0.5, dx: -9, lift1: 22, lift2: 92, s: 3.2, t0: 0.10 },
    { x0: 54, y0: -0.5, dx: 9, lift1: 23, lift2: 96, s: 3.3, t0: 0.11 },
    { x0: -86, y0: -1.0, dx: -10, lift1: 16, lift2: 86, s: 3.0, t0: 0.19 },
    { x0: 88, y0: -1.0, dx: 10, lift1: 15, lift2: 82, s: 3.1, t0: 0.20 },
  ].map((rk, i) => {
    const pts = stoneShape(R, i < 6 ? 6 : 5);
    return {
      ...rk,
      a0: R.range(0, TAU),
      va: (rk.x0 < 0 ? -1 : 1) * R.range(0.7, 2.0),
      ph: R.range(0, TAU),
      pts,
      render: makeRockSpriteCache(pts, rk.s, S),
      heaved: false,
    };
  });

  const floatPebbles = Array.from({ length: 14 }, (_, i) => {
    const sd = i % 2 === 0 ? -1 : 1;
    return {
      x0: sd * R.range(18, 118),
      dx: sd * R.range(4, 14),
      lift1: R.range(10, 28),
      lift2: R.range(26, 108),
      t0: 0.06 + (i % 5) * 0.04,
      big: i % 3 === 0,
      ph: R.range(0, TAU),
    };
  });

  let t = 0, roared = false, surged2 = false, dropped = false;

  const haloRadius = (tt) => {
    if (tt < 0.12) return 0;
    if (tt < T_ROAR) return lerp(28, 22, ease.inQuad(seg(tt, 0.12, T_ROAR)));
    if (tt < T_SURGE2) {
      return lerp(22, 86, ease.outExpo(seg(tt, T_ROAR, T_ROAR + 0.44))) + 1.8 * Math.sin((tt - T_ROAR) * 18);
    }
    if (tt < T_DROP) {
      return lerp(86, 104, ease.outQuart(seg(tt, T_SURGE2, T_SURGE2 + 0.36))) + 1.6 * Math.sin(tt * 20);
    }
    return lerp(104, 114, ease.outQuad(seg(tt, T_DROP, T_END)));
  };

  function drawSovereignHalo(p) {
    const r = haloRadius(t);
    if (r < 4) return;
    const cx = 0, cy = -56;
    const fade =
      t < T_ROAR
        ? smooth(0.12, 0.34, t) * 0.72
        : t < T_DROP
        ? 1
        : 1 - smooth(T_DROP, T_END - 0.38, t);
    if (fade <= 0.02) return;

    const pushBoost =
      (t >= T_ROAR && t < T_ROAR + 0.26 ? 1 - (t - T_ROAR) / 0.26 : 0) +
      (t >= T_SURGE2 && t < T_SURGE2 + 0.24 ? 0.88 * (1 - (t - T_SURGE2) / 0.24) : 0);

    // 1) Deep crimson inner pressure volume behind Qilin
    soft(p, cx, -50, Math.min(r * 0.82, 46), C[1], 0.28 * fade);

    // 2) 10 Interior Sacred Sunbeam Spokes pushing the Sovereign Halo outward from within!
    if (t >= T_ROAR && r > 44 && fade > 0.12) {
      const spokeAlpha = fade * (0.24 + 0.48 * pushBoost);
      for (let k = 0; k < 10; k++) {
        const a = lerp(-Math.PI * 1.04, Math.PI * 0.04, k / 9) + t * 0.14;
        const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
        const rStart = Math.round(r * 0.34), rEnd = Math.round(r * 0.86);
        for (let rr = rStart; rr <= rEnd; rr += 1) {
          const y = Math.round(cy + sa * rr);
          if (y > -2 || y < -194) continue;
          const x = Math.round(cx + ca * rr);
          const u = (rr - rStart) / Math.max(1, rEnd - rStart);
          const al = spokeAlpha * Math.sin(u * Math.PI);
          p.blend(x, y, u > 0.55 ? C[6] : C[4], al);
          p.blend(Math.round(x + nx), Math.round(y + ny), C[3], al * 0.45);
        }
      }
    }

    // 3) Single-pass Exact-Span Annular Scanner with pure surging Chinese Flame-Cloud Scrolls ("流火祥云赤金光晕")
    const rimW = (t < T_ROAR ? 4.2 : 6.8 + 3.4 * pushBoost) * (0.55 + 0.45 * fade);
    const maxFlame = (t >= T_ROAR ? 12.2 + 5.5 * pushBoost : 3.5) * fade;
    const rMax = r + maxFlame, rMax2 = rMax * rMax;
    const rRimIn = Math.max(0, r - rimW);
    const rInner = r * 0.68, hasInner = t >= T_ROAR && r > 48;
    const rBandIn = hasInner ? rInner - 1.6 : Math.min(rRimIn, r * 0.74);
    const rBandIn2 = rBandIn * rBandIn;

    const y0 = Math.max(-195, Math.floor(cy - rMax - 1));
    const y1 = 0;

    const shadeSpan = (y, dy, dy2, groundSoft, xa, xb) => {
      const lo = Math.max(-152, xa), hi = Math.min(152, xb);
      for (let x = lo; x <= hi; x++) {
        const dx = x - cx, d2 = dx * dx + dy2;
        if (d2 > rMax2 || d2 < rBandIn2) continue;
        const d = Math.sqrt(d2);

        if (d >= rRimIn) {
          const ang = Math.atan2(dy, dx);
          if (d >= r) {
            const dr = d - r;
            const scrollWave = Math.sin(ang * 10 - dr * 0.38 - t * 9.5) + 0.45 * Math.sin(ang * 20 - dr * 0.55 + t * 6);
            const tongueReach = maxFlame * Math.max(0, 0.48 + 0.52 * scrollWave);
            if (dr <= tongueReach) {
              const q = dr / Math.max(1, tongueReach);
              const col = q < 0.22 ? WHITE : q < 0.48 ? C[7] : q < 0.74 ? C[5] : C[3];
              const a = fade * groundSoft * (1 - q * 0.68);
              if (a > 0.92) p.px(x, y, col);
              else p.blend(x, y, col, a);
            }
          } else {
            const q = (r - d) / rimW + 0.14 * Math.sin(ang * 12 + t * 7);
            const col = q < 0.24 ? WHITE : q < 0.52 ? C[7] : q < 0.78 ? C[5] : C[3];
            const a = fade * groundSoft;
            if (a > 0.92) p.px(x, y, col);
            else p.blend(x, y, col, a);
          }
        } else if (d >= r * 0.74) {
          const u = (d - r * 0.74) / Math.max(1, rRimIn - r * 0.74);
          p.blend(x, y, u > 0.6 ? C[3] : C[1], (0.10 + 0.28 * u * u) * fade * groundSoft);
        } else if (hasInner && Math.abs(d - rInner) < 1.45) {
          const ang = Math.atan2(dy, dx);
          if (((Math.floor(((ang / TAU + t * 0.08) * 36)) & 3) !== 0)) {
            p.blend(x, y, pushBoost > 0.3 ? C[7] : C[6], fade * groundSoft * 0.78);
          }
        }
      }
    };

    for (let y = y0; y <= y1; y++) {
      const dy = y - cy, dy2 = dy * dy;
      if (dy2 > rMax2) continue;
      const groundSoft = y > -5 ? clamp((0.5 - y) / 5.5, 0, 1) : 1;
      const spanOut = Math.ceil(Math.sqrt(rMax2 - dy2));
      if (dy2 >= rBandIn2) {
        shadeSpan(y, dy, dy2, groundSoft, cx - spanOut, cx + spanOut);
      } else {
        const spanIn = Math.floor(Math.sqrt(rBandIn2 - dy2));
        shadeSpan(y, dy, dy2, groundSoft, cx - spanOut, cx - spanIn);
        shadeSpan(y, dy, dy2, groundSoft, cx + spanIn, cx + spanOut);
      }
    }

    // 4) Unbroken Upper-Dome Air-Compression Shockwaves racing ahead when halo forces open!
    for (const [tStart, r0, r1] of [[T_ROAR, 26, 136], [T_SURGE2, 86, 146]]) {
      const u = (t - tStart) / 0.36;
      if (u > 0 && u < 1) {
        const sr = lerp(r0, r1, ease.outQuart(u));
        const a = (1 - u) * 0.88;
        const col = u < 0.28 ? WHITE : C[6];
        const steps = Math.ceil(sr * 3.8);
        for (let i = 0; i <= steps; i++) {
          const g = lerp(-Math.PI * 1.15, Math.PI * 0.15, i / steps);
          const sy = cy + Math.sin(g) * sr;
          if (sy > 0 || sy < -195) continue;
          const sx = cx + Math.cos(g) * sr;
          if (Math.abs(sx) > 152) continue;
          p.blend(Math.round(sx), Math.round(sy), col, a);
        }
      }
    }

    p.glow(cx, cy, Math.min(62, r * 0.72), C[5], (0.38 + 0.24 * pushBoost) * fade);
  }

  return {
    update(dt) {
      t += dt;

      for (const rk of floatRocks) {
        if (!rk.heaved && t >= rk.t0) {
          rk.heaved = true;
          for (let k = 0; k < 4; k++) {
            ps.spawn(P.GRIT, rk.x0 + R.range(-4, 4), -1, R.range(-24, 24), -R.range(30, 85), R.range(0.38, 0.7), R.pick([S[6], S[5], C[5]]), 1);
          }
          ps.spawn(P.DUST, rk.x0, -1, R.sign() * R.range(6, 18), -R.range(4, 14), R.range(0.35, 0.55), S[5], R.range(2.0, 3.4));
        }
      }

      if (t < T_ROAR && R.chance(0.9 * dt * 60)) {
        const a = R.range(-Math.PI, 0), d = R.range(30, 78);
        const sx = Math.cos(a) * d, sy = -24 + Math.sin(a) * d * 0.65;
        ps.spawn(P.STREAK, sx, sy, -Math.cos(a) * 185, -Math.sin(a) * 125, R.range(0.11, 0.18), R.chance(0.55) ? C[7] : C[5]);
      }

      if (!roared && t >= T_ROAR) {
        roared = true;
        lights.add(0, -62, 82, C[5], 0.88, 0.45);
        lights.add(0, -82, 48, WHITE, 0.92, 0.12);
        for (let i = 0; i < 64; i++) {
          const a = R.range(-Math.PI * 0.96, -Math.PI * 0.04), sp = R.range(140, 355);
          ps.spawn(P.SPARK, R.range(-10, 10), -52, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.28, 0.72));
        }
        for (let i = 0; i < 18; i++) {
          const sd = i % 2 ? 1 : -1;
          ps.spawn(P.SMOKE, sd * R.range(10, 30), -2, sd * R.range(68, 155), -R.range(6, 26), R.range(0.68, 1.15), mix(S[2], C[2], 0.38), R.range(4.8, 8.2), 0, PF.BIG);
        }
      }

      if (!surged2 && t >= T_SURGE2) {
        surged2 = true;
        lights.add(0, -64, 78, C[6], 0.78, 0.42);
        lights.add(0, -86, 40, WHITE, 0.8, 0.09);
        for (let i = 0; i < 42; i++) {
          const a = R.range(-Math.PI * 0.95, -Math.PI * 0.05), sp = R.range(125, 310);
          ps.spawn(P.SPARK, R.range(-8, 8), -56, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.26, 0.62));
        }
      }

      if (t >= T_ROAR && t < T_DROP) {
        if (R.chance(1.05 * dt * 60)) {
          ps.spawn(P.EMBER, R.range(-106, 106), R.range(-10, -1), R.range(-16, 16), -R.range(52, 120), R.range(0.5, 0.95), R.pick([C[7], C[6], C[5]]), R.chance(0.4) ? 2 : 1);
        }
        if (R.chance(0.55 * dt * 60)) {
          const rk = R.pick(floatRocks);
          const rx = rk.x0 + rk.dx, ry = rk.y0 - rk.lift2;
          ps.spawn(P.GRIT, rx + R.range(-rk.s * 0.6, rk.s * 0.6), ry + rk.s, R.range(-8, 8), R.range(8, 28), R.range(0.32, 0.55), S[6], 1);
        }
      }

      if (!dropped && t >= T_DROP) {
        dropped = true;
        for (const rk of floatRocks) {
          bits.add({
            kind: B.CHUNK,
            x: rk.x0 + rk.dx,
            y: rk.y0 - rk.lift2,
            vx: (rk.x0 > 0 ? 1 : -1) * R.range(6, 26),
            vy: R.range(-10, 24),
            g: 1.08,
            drag: 0.32,
            bounce: 0.28,
            life: R.range(0.76, 1.06),
            a: rk.a0 + t * rk.va * 0.45,
            va: rk.va * 2.8,
            s: rk.s,
            pts: rk.pts,
            render: rk.render,
          });
        }
        for (const pb of floatPebbles) {
          ps.spawn(P.GRIT, pb.x0 + pb.dx, -pb.lift2, R.range(-18, 18), R.range(0, 35), R.range(0.55, 0.95), S[6], pb.big ? 2 : 1);
        }
        for (let i = 0; i < 28; i++) {
          ps.spawn(P.EMBER, R.range(-24, 20), -R.range(18, 96), R.range(-22, 22), -R.range(32, 78), R.range(0.45, 0.85), R.pick([C[7], C[6], C[4]]), R.chance(0.4) ? 2 : 1);
        }
      }

      bits.update(dt);
      for (const b of bits.list) {
        if (b.rest && !b.dusted) {
          b.dusted = true;
          ps.spawn(P.DUST, b.x, -0.5, R.sign() * R.range(8, 28), -R.range(3, 12), Math.min(0.42, T_END - 0.08 - t), S[5], R.range(1.6, 3.0));
        }
      }
      ps.update(dt);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-6) return;
      const afterFade = 1 - smooth(T_DROP + 0.42, T_END - 0.22, t);

      if (afterFade > 0.02) {
        const sGrow = ease.outCubic(clamp(t / 0.35));
        p.ellipse(0, 0.5, 62 * sGrow, 62 * SY * sGrow, S[0], 0.72 * afterFade);
        const heat = (t < T_ROAR ? 0.58 : t < T_DROP ? 1 : 0.38) * afterFade;
        for (const c of cracks) {
          if (t < c.t0) continue;
          const n = Math.floor(c.pts.length * clamp((t - c.t0) / c.grow));
          for (let i = 1; i < n; i++) {
            const u = i / c.pts.length, lh = heat * (1 - 0.48 * u);
            const col = lh > 0.74 ? WHITE : lh > 0.52 ? C[6] : lh > 0.28 ? C[4] : lh > 0.14 ? C[2] : S[1];
            p.line(c.pts[i - 1][0], c.pts[i - 1][1], c.pts[i][0], c.pts[i][1], col, afterFade);
          }
        }
        if (t >= T_ROAR) {
          const gr = t < T_SURGE2 ? lerp(28, 72, ease.outExpo(seg(t, T_ROAR, T_ROAR + 0.44))) : lerp(72, 88, ease.outQuart(seg(t, T_SURGE2, T_SURGE2 + 0.36)));
          drawPerspectiveHaloFloorRing(p, gr, C, 0.78 * afterFade, false);
        }
        floorLight(p, 0, 0.5, 76, 9, C[4], 0.42 * heat);
      }

      drawSovereignHalo(p);

      for (const [t0, maxR] of [[T_ROAR, 136], [T_SURGE2, 144]]) {
        const u = (t - t0) / 0.50;
        if (u > 0 && u < 1) {
          band(p, 0, 0.5, 14 + (maxR - 14) * ease.outQuart(u), SY, Math.max(1, 5.2 * (1 - u)), 1 - smooth(0.5, 1, u), [C[2], C[5], C[6], WHITE], (g) => Math.sin(g) < 0, u < 0.16);
        }
      }

      const qAlpha =
        t < T_ROAR
          ? smooth(0.08, T_ROAR - 0.04, t) * 0.72
          : t < T_DROP
          ? 1
          : 1 - smooth(T_DROP, T_DROP + 0.52, t);
      const qInfo = drawQilinDharmakaya(p, t, C, qAlpha);
      drawSonicRoarCones(p, qInfo, t, C);

      simDraw(p, ps, H, "back");
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;
      const A = o.actor;
      const NZ = (rate, s0, off = 0) => loopNoise(t * rate * 0.14 + off * 0.1, 1.3, s0);
      const afterFade = 1 - smooth(T_DROP + 0.42, T_END - 0.22, t);

      if (A && t < T_DROP + 0.25) {
        const S_ACT = shape(A);
        const rimFade = t < T_ROAR ? smooth(0.05, T_ROAR, t) * 0.75 : t < T_DROP ? 1 : 1 - seg(t, T_DROP, T_DROP + 0.25);
        const hotFlash = (t >= T_ROAR && t < T_ROAR + 0.07) || (t >= T_SURGE2 && t < T_SURGE2 + 0.06);
        for (const [ox, oy, nx, ny] of S_ACT.outline) {
          if (ny < 0.45) {
            p.blend(A.x + ox, A.y + oy, hotFlash ? WHITE : ny < -0.2 ? C[7] : C[5], rimFade * 0.9);
          }
        }
      }

      if (t >= 0.08 && t < T_DROP + 0.45) {
        const sg = ease.outBack(clamp((t - 0.08) / 0.18), 1.6);
        const roarTilt = t >= T_ROAR ? 0.22 * smooth(T_ROAR, T_ROAR + 0.15, t) : 0;
        const sink = smooth(T_DROP, T_DROP + 0.45, t);
        for (const sl of floorSlabs) {
          if (sink < 0.02 && sg >= 0.98) {
            sl.render(p, sl.x, -1.8, sl.sd * (0.38 + roarTilt), 1, false);
          } else {
            drawRock(p, sl.x, -1.8 * sg + sink * 4, sl.s * Math.min(1, sg), sl.sd * (0.38 * sg + roarTilt) * (1 - sink), sl.pts, S, 1 - sink);
          }
        }
      }

      if (t >= T_ROAR - 0.04 && t < T_DROP + 0.15) {
        const fk = t < T_DROP ? 1 : 1 - seg(t, T_DROP, T_DROP + 0.15);
        for (const [bx, bh, lean] of [[-16, 17, -2.4], [-9, 12, -1.1], [9, 12, 1.1], [16, 17, 2.4]]) {
          flameTongue(p, bx, 1, bh * fk, 2.8 * fk, lean, NZ, seed + bx * 7, H, LAYERS);
        }
      }

      if (t < T_DROP) {
        for (const rk of floatRocks) {
          if (t < rk.t0) continue;
          const k1 = ease.outCubic(seg(t, rk.t0, T_ROAR));
          const k2 = t < T_ROAR ? 0 : ease.outBack(seg(t, T_ROAR, T_ROAR + 0.34), 1.32);
          const k3 = t < T_SURGE2 ? 0 : ease.outCubic(seg(t, T_SURGE2, T_SURGE2 + 0.30));
          const tremorX = t >= T_ROAR ? Math.sin(t * 58 + rk.ph) * 0.75 : Math.sin(t * 44 + rk.ph) * 0.45;
          const bobY = t >= T_ROAR ? Math.sin(t * 7.5 + rk.ph) * 2.8 : 0;
          const rx = rk.x0 + rk.dx * (0.72 * k2 + 0.28 * k3) + tremorX;
          const ry = rk.y0 - rk.lift1 * k1 - (rk.lift2 - rk.lift1) * k2 - 7 * k3 + bobY;
          const rot = rk.a0 + t * rk.va * (t < T_ROAR ? 0.2 : 0.42);
          const isFlash = t >= T_ROAR && t < T_ROAR + 0.036 && rk.s > 4.5;

          rk.render(p, rx, ry, rot, 1, isFlash);
          if (ry < -5) {
            const by = Math.round(ry + rk.s * 0.85), bx = Math.round(rx);
            p.px(bx, by, C[6]);
            p.px(bx - 1, by, C[5]);
            p.px(bx + 1, by, C[5]);
            if (rk.s > 4.2) p.glow(rx, by, 7, C[5], 0.24);
          }
        }
        for (const pb of floatPebbles) {
          if (t < pb.t0) continue;
          const k1 = ease.outCubic(seg(t, pb.t0, T_ROAR));
          const k2 = t < T_ROAR ? 0 : ease.outCubic(seg(t, T_ROAR, T_ROAR + 0.38));
          const px = Math.round(pb.x0 + pb.dx * k2 + Math.sin(t * 9 + pb.ph) * 1.5);
          const py = Math.round(-pb.lift1 * k1 - (pb.lift2 - pb.lift1) * k2 + Math.cos(t * 8 + pb.ph) * 2);
          p.px(px, py, S[7]);
          p.px(px + 1, py, S[5]);
          if (pb.big) {
            p.px(px, py + 1, C[5]);
            p.px(px + 1, py + 1, S[2]);
          }
        }
      } else {
        for (const b of bits.list) {
          const al = Math.min(1, b.life / 0.28);
          if (b.render) b.render(p, b.x, b.y, b.a, al, false);
          else drawRock(p, b.x, b.y, b.s, b.a, b.pts, S, al);
        }
      }

      if (t >= T_ROAR && afterFade > 0.02) {
        const gr = t < T_SURGE2 ? lerp(28, 72, ease.outExpo(seg(t, T_ROAR, T_ROAR + 0.44))) : lerp(72, 88, ease.outQuart(seg(t, T_SURGE2, T_SURGE2 + 0.36)));
        drawPerspectiveHaloFloorRing(p, gr, C, 0.78 * afterFade, true);
      }
      for (const [t0, maxR] of [[T_ROAR, 136], [T_SURGE2, 144]]) {
        const u = (t - t0) / 0.50;
        if (u > 0 && u < 1) {
          band(p, 0, 0.5, 14 + (maxR - 14) * ease.outQuart(u), SY, Math.max(1, 5.2 * (1 - u)), 1 - smooth(0.5, 1, u), [C[2], C[5], C[6], WHITE], (g) => Math.sin(g) >= 0, u < 0.16);
        }
      }

      for (const [tHit, fy, fSize] of [[T_ROAR, -92, 58], [T_SURGE2, -96, 42]]) {
        const dtHit = t - tHit;
        if (dtHit >= 0 && dtHit < 0.085) {
          const fk = 1 - dtHit / 0.085;
          flare(p, 14, fy, fSize * fk, fk, [C[4], C[6], C[7], WHITE]);
          sparkle(p, 14, fy, 16 * fk, WHITE, C[6], 0.85);
        }
      }

      simDraw(p, ps, H, "front");
      lights.draw(p);
    },
  };
}
