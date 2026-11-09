// Speed-line head-to-tail tapering and sonic launch cone build on Sprite Fusion's open-source movement dash VFX
// (https://www.spritefusion.com/pixel-art-vfx/movement), MIT License, Copyright (c) 2026 Hugo Duprez.
import { Particles, Lights, P, Rng, fit, clamp, smooth, lerp, ease, TAU, WHITE, hex } from "../../core/index.js";
import { cracks } from "../melee/_lib.js";

// Timeline: Standing showcase -> Low crouch & unsheathe -> Supersonic sprint -> Gentle sword-tip tap -> Oppressive hold -> Calm recovery
const T_COIL = 0.10;
const T_DASH = 0.24;
const T_BRAKE = 0.48;
const T_TAP = 0.62;
const T_RISE = 1.40;
const T_FADE = 1.84;
const T_END = 2.04;

const START_X = 0;
const DASH_X = 172;

export const meta = {
  name: "Sword dash",
  desc: "A ponytail wuxia swordsman crouches low and sprints forward, leaving three fading silver phantoms and white foot-streams before lightly tapping his sword tip to the stone.",
  tags: ["move", "melee", "sword", "dash", "sprint", "afterimage", "wuxia", "wind", "directional", "one-shot"],
  size: [444, 148],
  origin: [96, 112],
  duration: T_END,
  fps: 30,
  loop: false,
  bg: "ground",
  options: {
    palette: ["#0e1628", "#1d2d4e", "#385382", "#6285b8", "#9bbbe4", "#d4e8fd", "#f0f7ff", "#ffffff"],
    showHero: true,
    seed: 7,
  },
};

// Palette matched to the user's black-robed, crimson-sashed, high-ponytail wuxia swordsman reference
const HERO = Object.fromEntries(
  Object.entries({
    ink: "#09080f",
    hairD: "#100f18",
    hairM: "#181724",
    hairL: "#262438",
    skinL: "#ffe3c2",
    skinM: "#f3c197",
    skinD: "#c78963",
    eye: "#534c86",
    collarL: "#d2d7f4",
    collarD: "#858bb8",
    robeL: "#2a2938",
    robeM: "#1b1a24",
    robeD: "#111018",
    strapL: "#85513a",
    strapD: "#533020",
    sashL: "#e42029",
    sashM: "#b0121a",
    sashD: "#6e0910",
    scabL: "#8a8dba",
    scabM: "#585a82",
    scabD: "#343652",
    chape: "#eef2ff",
    bladeHi: "#ffffff",
    bladeMid: "#bfd5f6",
    bladeSh: "#637eab",
    bootL: "#282736",
    bootM: "#171620",
  }).map(([k, v]) => [k, hex(v)])
);

const MAT_HAIR = 1, MAT_SKIN = 2, MAT_ROBE = 3, MAT_SASH = 4, MAT_STRAP = 5, MAT_SCAB = 6, MAT_BLADE = 7, MAT_BOOT = 8, MAT_COLLAR = 9, MAT_SLEEVE = 10;

const GW = 152, GH = 96, GX0 = 78, GY0 = 84;
const gMat = new Uint8Array(GW * GH);
const gTone = new Uint8Array(GW * GH);
const gCol = new Uint32Array(GW * GH);
const gTouched = [];

function plotPx(lx, ly, mat, tone, col) {
  const ix = GX0 + Math.round(lx), iy = GY0 + Math.round(ly);
  if (ix < 1 || ix >= GW - 1 || iy < 1 || iy >= GH - 1) return;
  const idx = iy * GW + ix;
  if (gMat[idx] === 0) gTouched.push(idx);
  gMat[idx] = mat;
  gTone[idx] = tone;
  gCol[idx] = col;
}

function fillSeg(ax, ay, bx, by, rA, rB, mat, cD, cM, cL, clipFloor = true) {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(dist * 2.4));
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const cx = lerp(ax, bx, u), cy = lerp(ay, by, u);
    const r = lerp(rA, rB, u);
    const x0 = Math.floor(cx - r - 0.5), x1 = Math.ceil(cx + r + 0.5);
    const y0 = Math.floor(cy - r - 0.5), y1 = Math.ceil(cy + r + 0.5);
    for (let y = y0; y <= y1; y++) {
      if (clipFloor && y > -1) continue;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r * r + 0.12) continue;
        const light = (dx * 0.42 - dy * 0.78) / Math.max(0.8, r);
        const tone = light > 0.30 ? 2 : light > -0.34 ? 1 : 0;
        plotPx(x, y, mat, tone, tone === 2 ? cL : tone === 1 ? cM : cD);
      }
    }
  }
}

function fillQuad(p0, p1, p2, p3, mat, cD, cM, cL) {
  const xs = [p0[0], p1[0], p2[0], p3[0]], ys = [p0[1], p1[1], p2[1], p3[1]];
  const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys)), y1 = Math.min(-1, Math.ceil(Math.max(...ys)));
  const poly = [p0, p1, p2, p3];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      let inside = false;
      for (let i = 0, j = 3; i < 4; j = i++) {
        const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
        if ((yi > y + 0.1) !== (yj > y + 0.1) && x + 0.1 < ((xj - xi) * (y + 0.1 - yi)) / (yj - yi + 1e-6) + xi) {
          inside = !inside;
        }
      }
      if (!inside) continue;
      const uX = (x - x0) / Math.max(1, x1 - x0);
      const uY = (y - y0) / Math.max(1, y1 - y0);
      const tone = uX > 0.66 && uY < 0.68 ? 2 : uX < 0.25 || uY > 0.84 ? 0 : 1;
      plotPx(x, y, mat, tone, tone === 2 ? cL : tone === 1 ? cM : cD);
    }
  }
}

const POSE_CACHE = new Map();
function buildSwordsmanPose(key, q) {
  if (key && POSE_CACHE.has(key)) return POSE_CACHE.get(key);

  const crouch = q.crouch ?? 0;
  const lean = q.lean ?? 0;
  const stride = q.stride ?? 0;
  const hairFlow = q.hairFlow ?? 0;
  const sashFlow = q.sashFlow ?? 0;
  const drawn = !!q.swordDrawn;

  const hipX = lean * 0.24, hipY = -18 + crouch * 5.0;
  const waistX = lean * 0.48, waistY = -23 + crouch * 6.0;
  const chestX = lean * 0.82, chestY = -31 + crouch * 7.8;
  const headX = chestX + 1.4 + crouch * 2.2, headY = chestY - 9.2 + crouch * 1.4;

  // 1) 45° Diagonal back-slung scabbard + silver chape tip (plus upper hilt & crossguard when sheathed)
  const scBotX = waistX - 10.2 - crouch * 2.4;
  const scBotY = Math.min(-4, waistY + 9.2 - crouch * 1.4);
  const scMidX = chestX - 3.4;
  const scMidY = chestY + 1.5;
  fillSeg(scBotX + 1.2, scBotY - 1.2, scMidX, scMidY, 1.5, 1.5, MAT_SCAB, HERO.scabD, HERO.scabM, HERO.scabL);
  fillSeg(scBotX, scBotY, scBotX + 1.6, scBotY - 1.6, 1.3, 1.4, MAT_SCAB, HERO.scabL, HERO.chape, WHITE);

  const scThroatX = chestX - 5.0, scThroatY = chestY - 3.8;
  fillSeg(scMidX, scMidY, scThroatX, scThroatY, 1.4, 1.4, MAT_SCAB, HERO.scabD, HERO.scabM, HERO.scabL);
  if (!drawn) {
    fillSeg(scThroatX - 2.2, scThroatY + 1.6, scThroatX + 1.8, scThroatY - 2.0, 0.8, 0.8, MAT_SCAB, HERO.scabD, HERO.scabL, HERO.chape);
    const pomX = scThroatX - 4.6, pomY = scThroatY - 6.4;
    fillSeg(scThroatX - 0.4, scThroatY - 0.5, pomX, pomY, 1.1, 1.1, MAT_SCAB, HERO.scabD, HERO.scabM, HERO.scabL);
    plotPx(pomX, pomY, MAT_SCAB, 2, HERO.chape);
    plotPx(pomX - 1, pomY + 1, MAT_SCAB, 2, HERO.scabL);
  }

  // 2) Split dark boots
  const absSt = Math.abs(stride);
  const rearFootX = lerp(-2.8, stride >= 0 ? -14.5 : -9.5, absSt);
  const rearFootY = stride > 0.7 ? -2.0 : -1;
  const frontFootX = lerp(3.0, stride >= 0 ? 12.5 : 8.8, absSt);
  const frontFootY = -1;

  fillSeg(hipX - 2.0, hipY + 3, rearFootX, rearFootY - 2, 2.2, 1.8, MAT_BOOT, HERO.ink, HERO.robeD, HERO.bootM);
  fillSeg(rearFootX - 1.2, rearFootY - 1, rearFootX + 3.8, rearFootY - 1, 1.3, 1.1, MAT_BOOT, HERO.ink, HERO.bootM, HERO.bootL);

  fillSeg(hipX + 2.0, hipY + 3, frontFootX, frontFootY - 2, 2.3, 1.9, MAT_BOOT, HERO.robeD, HERO.bootM, HERO.bootL);
  fillSeg(frontFootX - 1.0, frontFootY - 1, frontFootX + 4.5, frontFootY - 1, 1.4, 1.1, MAT_BOOT, HERO.robeD, HERO.bootM, HERO.bootL);

  // 3) Flared black martial-arts robe coat, inner lavender collar & brown X-straps
  const hemBackX = waistX - 6.5 - hairFlow * 5.2 - crouch * 2.0;
  const hemBackY = lerp(-8.8, -10.4, crouch) - hairFlow * 0.8;
  const hemFrontX = waistX + 5.8 + crouch * 2.8;
  const hemFrontY = lerp(-8.8, -9.6, crouch);
  fillQuad(
    [waistX - 4.2, waistY],
    [waistX + 4.4, waistY],
    [hemFrontX, hemFrontY],
    [hemBackX, hemBackY],
    MAT_ROBE,
    HERO.robeD,
    HERO.robeM,
    HERO.robeL
  );
  fillSeg(waistX, waistY, chestX, chestY, 4.4, 4.6, MAT_ROBE, HERO.robeD, HERO.robeM, HERO.robeL);

  plotPx(chestX + 2.6, chestY - 3.2, MAT_COLLAR, 2, HERO.collarL);
  plotPx(chestX + 3.2, chestY - 2.2, MAT_COLLAR, 2, HERO.collarL);
  plotPx(chestX + 2.2, chestY - 2.0, MAT_COLLAR, 1, HERO.collarD);
  plotPx(chestX + 3.6, chestY - 1.2, MAT_COLLAR, 1, HERO.collarD);

  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    plotPx(lerp(chestX - 3.0, waistX + 3.8, u), lerp(chestY - 2.8, waistY - 1.5, u), MAT_STRAP, 2, HERO.strapL);
    plotPx(lerp(chestX - 3.0, waistX + 3.8, u), lerp(chestY - 1.9, waistY - 0.8, u), MAT_STRAP, 0, HERO.strapD);
    plotPx(lerp(chestX + 3.2, waistX - 1.2, u), lerp(chestY - 1.5, waistY - 1.2, u), MAT_STRAP, 1, HERO.strapL);
  }

  // 4) Vivid crimson waist sash & long trailing ribbon
  fillSeg(waistX - 4.0, waistY - 0.6, waistX + 4.4, waistY - 0.6, 1.6, 1.6, MAT_SASH, HERO.sashD, HERO.sashM, HERO.sashL);
  for (let i = 1; i <= 13; i++) {
    const u = i / 13;
    const sx = lerp(waistX + 3.2, waistX - 2.5 - u * 15.0, sashFlow);
    const sy = lerp(waistY + u * 12.0, waistY + 0.8 - Math.sin(u * 4.8) * 1.8 + u * 2.0, sashFlow);
    plotPx(sx, sy, MAT_SASH, 2, u < 0.72 ? HERO.sashL : HERO.sashM);
    plotPx(sx - 1, sy, MAT_SASH, 1, u < 0.55 ? HERO.sashM : HERO.sashD);
  }

  // 5) Head, side-profile face, bangs, temple lock, ear & sleek high ponytail
  fillSeg(chestX + 0.8, chestY - 2.5, headX, headY + 3.5, 2.0, 2.0, MAT_SKIN, HERO.skinD, HERO.skinM, HERO.skinL);
  fillSeg(headX - 1.4, headY - 2.0, headX + 1.5, headY + 1.0, 5.2, 4.8, MAT_HAIR, HERO.hairD, HERO.hairM, HERO.hairL);

  for (let dy = -2; dy <= 4; dy++) {
    const xEnd = dy === 1 ? 5.6 : dy === 0 ? 5.0 : dy < 0 ? 4.5 : 4.8 - (dy - 1) * 0.45;
    for (let dx = 0.8; dx <= xEnd; dx += 0.9) {
      const c = dx > 3.6 ? HERO.skinL : dy >= 3 ? HERO.skinD : HERO.skinM;
      plotPx(headX + dx, headY + dy, MAT_SKIN, dx > 3.6 ? 2 : 1, c);
    }
  }
  plotPx(headX + 4.4, headY - 2.5, MAT_HAIR, 1, HERO.hairM);
  plotPx(headX + 4.9, headY - 1.6, MAT_HAIR, 0, HERO.hairD);
  plotPx(headX + 3.8, headY - 2.0, MAT_HAIR, 0, HERO.hairD);

  for (let dy = -2; dy <= 4; dy++) {
    plotPx(headX + 0.6, headY + dy, MAT_HAIR, 0, HERO.hairD);
    if (dy <= 2) plotPx(headX + 1.3, headY + dy, MAT_HAIR, 1, HERO.hairM);
  }
  plotPx(headX - 1.0, headY + 0.2, MAT_SKIN, 2, HERO.skinL);
  plotPx(headX - 1.0, headY + 1.2, MAT_SKIN, 1, HERO.skinM);
  plotPx(headX - 0.3, headY + 1.2, MAT_SKIN, 0, HERO.skinD);

  plotPx(headX + 3.0, headY - 1.0, MAT_HAIR, 0, HERO.hairD);
  plotPx(headX + 3.8, headY - 1.0, MAT_HAIR, 0, HERO.hairD);
  plotPx(headX + 3.3, headY, MAT_SKIN, 0, HERO.eye);

  // Spiky high hair-knot crown
  const knotX = headX - 4.0, knotY = headY - 5.0;
  fillSeg(headX - 2.5, headY - 3.8, knotX - 0.5, knotY - 3.0, 2.2, 1.3, MAT_HAIR, HERO.hairD, HERO.hairM, HERO.hairL);
  plotPx(knotX + 0.5, knotY - 4.2, MAT_HAIR, 2, HERO.hairL);
  plotPx(knotX - 1.1, knotY - 3.6, MAT_HAIR, 1, HERO.hairM);

  // Calligraphy S-curved ponytail:
  //  - Standing (`hairFlow = 0`): rises from spiky knot, curves left with clear open gap behind neck/hilt, tapers to hooked tip at waist!
  //  - Dashing (`hairFlow = 1`): whips taut & sleek horizontally backward (`24px` behind head) with sharp tapered wind-tips!
  const p0 = [knotX - 0.8, knotY - 1.4];
  const p1 = [knotX - lerp(7.8, 9.5, hairFlow), knotY + lerp(-0.5, 0.2, hairFlow)];
  const p2 = [knotX - lerp(12.2, 17.5, hairFlow), knotY + lerp(11.5, 2.8, hairFlow)];
  const p3 = [knotX - lerp(8.0, 25.5, hairFlow), knotY + lerp(21.5, 0.8, hairFlow)];
  const maxThick = lerp(3.2, 2.35, hairFlow);
  const hSteps = 32;
  for (let i = 0; i <= hSteps; i++) {
    const s = i / hSteps, m = 1 - s;
    const hx = m * m * m * p0[0] + 3 * m * m * s * p1[0] + 3 * m * s * s * p2[0] + s * s * s * p3[0];
    const hy = m * m * m * p0[1] + 3 * m * m * s * p1[1] + 3 * m * s * s * p2[1] + s * s * s * p3[1];
    const swell = s < 0.22 ? lerp(2.1, maxThick, s / 0.22) : maxThick * Math.pow(1 - (s - 0.22) / 0.78, 0.72);
    const rad = Math.max(0.55, swell);
    fillSeg(hx, hy, hx + 0.2, hy + 0.1, rad, rad, MAT_HAIR, HERO.hairD, HERO.hairM, HERO.hairL, false);
  }
  if (hairFlow < 0.45) {
    plotPx(p3[0] + 1.4, p3[1] - 0.5, MAT_HAIR, 1, HERO.hairM);
    plotPx(p3[0] + 2.2, p3[1] - 1.3, MAT_HAIR, 0, HERO.hairD);
  } else {
    // Wind-split secondary hair lock at high speed!
    for (let k = 1; k <= 5; k++) {
      plotPx(p2[0] - k * 1.5, p2[1] + 2.2 + k * 0.25, MAT_HAIR, 1, HERO.hairM);
    }
  }
  // Signature delicate 1px outer hair strand
  for (let i = 7; i <= 23; i++) {
    const s = i / 30, m = 1 - s;
    const sx = m * m * p1[0] + 2 * m * s * (p2[0] - 3.6) + s * s * (p3[0] - 3.0);
    const sy = m * m * (p1[1] + 3.5) + 2 * m * s * (p2[1] + 1.5) + s * s * (p3[1] - 1.8);
    plotPx(sx, sy, MAT_HAIR, 0, HERO.hairD);
  }

  // 6) Drawn silver jian sword & wide martial sleeve + clenched fist
  const shX = chestX - 0.5, shY = chestY - 1.5;
  const fHandX = q.handX ?? (chestX - 0.8);
  const fHandY = q.handY ?? (waistY + 3.8);

  let tipX = fHandX, tipY = fHandY;
  if (drawn) {
    const sa = q.swordAng ?? 0.5;
    const ca = Math.cos(sa), ssa = Math.sin(sa);
    const bladeLen = q.bladeLen ?? 31.0;
    tipX = fHandX + ca * bladeLen;
    tipY = Math.min(-0.4, fHandY + ssa * bladeLen);
    const effLen = Math.hypot(tipX - fHandX, tipY - fHandY);
    const ux = (tipX - fHandX) / (effLen || 1), uy = (tipY - fHandY) / (effLen || 1);
    const nx = -uy, ny = ux;

    for (let d = -3.8; d <= 1.5; d += 0.7) {
      plotPx(fHandX + ux * d, fHandY + uy * d, MAT_SCAB, 1, d < -2.6 ? HERO.chape : HERO.scabM);
    }
    for (let k = -3.0; k <= 3.0; k += 0.7) {
      plotPx(fHandX + ux * 2.1 + nx * k, fHandY + uy * 2.1 + ny * k, MAT_SCAB, 2, Math.abs(k) > 2.0 ? HERO.scabL : HERO.chape);
    }
    const bSteps = Math.ceil(effLen * 2.2);
    for (let i = 5; i <= bSteps; i++) {
      const d = (i / bSteps) * effLen;
      const taper = d > effLen - 5.5 ? (effLen - d) / 5.5 : 1;
      const bx = fHandX + ux * d, by = fHandY + uy * d;
      if (by > 0) continue;
      plotPx(bx, by, MAT_BLADE, 2, HERO.bladeHi);
      if (taper > 0.35) {
        plotPx(bx + nx * 0.85, by + ny * 0.85, MAT_BLADE, 1, d > effLen * 0.65 ? HERO.bladeHi : HERO.bladeMid);
        plotPx(bx - nx * 0.75, by - ny * 0.75, MAT_BLADE, 0, HERO.bladeSh);
      }
    }
  }

  const elbX = (shX + fHandX) * 0.5 - 2.0, elbY = (shY + fHandY) * 0.5 + 1.2;
  fillSeg(shX, shY, elbX, elbY, 2.8, 3.0, MAT_SLEEVE, HERO.ink, HERO.robeM, HERO.robeL);
  fillSeg(elbX, elbY, fHandX, fHandY - 1.2, 3.0, 2.7, MAT_SLEEVE, HERO.ink, HERO.robeM, HERO.robeL);
  fillSeg(fHandX - 0.6, fHandY - 0.4, fHandX + 1.0, fHandY + 0.6, 1.8, 1.6, MAT_SKIN, HERO.skinD, HERO.skinM, HERO.skinL);

  // 7) 1px contour with windward-edge flag (`rimLit = 1` on right/front/top edges, `0` in recessed back creases!)
  const bodyIdx = gTouched.slice();
  const rimIdx = [];
  const rimWind = [];
  const seenRim = new Set();
  for (const idx of bodyIdx) {
    const ix = idx % GW, iy = (idx / GW) | 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const ny = iy + dy;
      if (ny > GY0) continue;
      const nIdx = ny * GW + (ix + dx);
      if (gMat[nIdx] === 0 && !seenRim.has(nIdx)) {
        seenRim.add(nIdx);
        rimIdx.push(nIdx);
        // Windward / front-right leading contour ONLY (on face, chest, front arm & front leg — never inflating the back ponytail!)
        const isLeading = gMat[nIdx - 1] !== 0 && (ix - GX0 > -1);
        rimWind.push(isLeading ? 1 : 0);
      }
    }
  }

  const total = bodyIdx.length + rimIdx.length;
  const out = {
    n: total,
    xs: new Int16Array(total),
    ys: new Int16Array(total),
    mat: new Uint8Array(total),
    tone: new Uint8Array(total),
    col: new Uint32Array(total),
    rim: new Uint8Array(total),
    tipX,
    tipY,
  };

  let ptr = 0;
  for (let r = 0; r < rimIdx.length; r++) {
    const idx = rimIdx[r];
    out.xs[ptr] = (idx % GW) - GX0;
    out.ys[ptr] = ((idx / GW) | 0) - GY0;
    out.mat[ptr] = 0;
    out.tone[ptr] = rimWind[r];
    out.col[ptr] = HERO.ink;
    out.rim[ptr] = 1;
    ptr++;
  }
  for (const idx of bodyIdx) {
    out.xs[ptr] = (idx % GW) - GX0;
    out.ys[ptr] = ((idx / GW) | 0) - GY0;
    out.mat[ptr] = gMat[idx];
    out.tone[ptr] = gTone[idx];
    out.col[ptr] = gCol[idx];
    out.rim[ptr] = 0;
    ptr++;
    gMat[idx] = 0;
  }
  gTouched.length = 0;

  if (key) POSE_CACHE.set(key, out);
  return out;
}

// Keyframe poses — clean negative space between streaming high ponytail (`y ~ -35`), back scabbard, trailing sword (`y ~ -16`) & sprinting boots!
const P_STAND = { crouch: 0.0, lean: 0.0, stride: 0.0, hairFlow: 0.0, sashFlow: 0.0, swordDrawn: false, handX: -0.8, handY: -19.0, swordAng: 0.5, bladeLen: 31 };
const P_COIL  = { crouch: 0.52, lean: 5.2, stride: 0.65, hairFlow: 0.42, sashFlow: 0.48, swordDrawn: true, handX: -2.0, handY: -16.5, swordAng: 3.05, bladeLen: 28 };
const P_DASH1 = { crouch: 0.56, lean: 6.8, stride: 0.96, hairFlow: 0.86, sashFlow: 0.94, swordDrawn: true, handX: -1.5, handY: -16.0, swordAng: 3.08, bladeLen: 24 };
const P_DASH2 = { crouch: 0.58, lean: 7.0, stride: -0.92, hairFlow: 0.92, sashFlow: 1.00, swordDrawn: true, handX: -1.0, handY: -16.0, swordAng: 3.10, bladeLen: 24 };
const P_DASH3 = { crouch: 0.55, lean: 6.6, stride: 0.95, hairFlow: 0.84, sashFlow: 0.92, swordDrawn: true, handX: -0.5, handY: -16.0, swordAng: 3.08, bladeLen: 24 };
const P_BRAKE = { crouch: 0.56, lean: 6.2, stride: 0.86, hairFlow: 0.52, sashFlow: 0.58, swordDrawn: true, handX: 12.0, handY: -15.5, swordAng: 0.30, bladeLen: 31 };
const P_TAP   = { crouch: 0.54, lean: 5.4, stride: 0.78, hairFlow: 0.24, sashFlow: 0.16, swordDrawn: true, handX: 14.2, handY: -15.0, swordAng: 0.50, bladeLen: 31 };

function interpPose(a, b, u) {
  return {
    crouch: lerp(a.crouch, b.crouch, u),
    lean: lerp(a.lean, b.lean, u),
    stride: lerp(a.stride, b.stride, u),
    hairFlow: lerp(a.hairFlow, b.hairFlow, u),
    sashFlow: lerp(a.sashFlow, b.sashFlow, u),
    swordDrawn: u < 0.5 ? a.swordDrawn : b.swordDrawn,
    handX: lerp(a.handX, b.handX, u),
    handY: lerp(a.handY, b.handY, u),
    swordAng: lerp(a.swordAng, b.swordAng, u),
    bladeLen: lerp(a.bladeLen ?? 31, b.bladeLen ?? 31, u),
  };
}

const SPR_GHOST1 = buildSwordsmanPose("ghost1", P_DASH1);
const SPR_GHOST2 = buildSwordsmanPose("ghost2", P_DASH2);
const SPR_GHOST3 = buildSwordsmanPose("ghost3", P_DASH3);
const SPR_TAP    = buildSwordsmanPose("tap", P_TAP);
const TIP_X = Math.round(DASH_X + SPR_TAP.tipX);

// Three cleanly separated (`48px` spacing!), progressively fading Cold Silver-White Phantoms (`0.36 -> 0.62 -> 0.90`)
const GHOST_SPECS = [
  { x: 32,  tSpawn: T_DASH + 0.030, life: 0.68, peakA: 0.36, spr: SPR_GHOST1, cBright: 5, cLight: 4, cMid: 3, cDark: 1 },
  { x: 80,  tSpawn: T_DASH + 0.085, life: 0.78, peakA: 0.62, spr: SPR_GHOST2, cBright: 6, cLight: 5, cMid: 3, cDark: 2 },
  { x: 128, tSpawn: T_DASH + 0.148, life: 0.88, peakA: 0.90, spr: SPR_GHOST3, cBright: 7, cLight: 6, cMid: 4, cDark: 2 },
];

/**
 * Renders one Cold Silver-White Sword-Qi Phantom while preserving the character's internal value hierarchy:
 *  - Face, fist, collar, scabbard chape & trailing jian blade -> Pure White / Ice-White (`cBright`)
 *  - Crimson sash & ribbons + chest straps -> Luminous Frost-Silver (`cLight`)
 *  - Flowing ponytail, black martial robe & boots -> Sculpted Moon-Slate (`cDark` .. `cMid` .. `cLight` top highlight)
 *  - Leading windward rim -> Crisp specular edge (`cBright`), recessed contour -> Deep steel (`cDark`) so limbs & ponytail never bloat!
 */
function drawSilverWhitePhantom(p, gx, spr, C, g, alpha, u) {
  if (alpha <= 0.02) return;
  const drift = -Math.round(u * 5);
  const colBright = g.cBright >= 7 ? WHITE : C[g.cBright];
  const colLight  = g.cLight >= 7 ? WHITE : C[g.cLight];
  const colMid    = C[g.cMid];
  const colDark   = C[g.cDark];

  for (let i = 0; i < spr.n; i++) {
    const ry = spr.ys[i];
    if (ry > 0) continue;
    const shred = u > 0.50 && ((ry * 7) & 3) === 0 ? -Math.round((u - 0.50) * 10) : 0;
    const lx = gx + drift + shred + spr.xs[i];
    if (lx < -92 || lx > 342) continue;

    let col, aMul;
    if (spr.rim[i]) {
      if (spr.tone[i] === 1) {
        col = colBright;
        aMul = 0.96;
      } else {
        col = colDark;
        aMul = 0.58;
      }
    } else {
      const m = spr.mat[i], tn = spr.tone[i];
      if (m === MAT_BLADE || m === MAT_COLLAR || (m === MAT_SCAB && tn === 2)) {
        col = colBright;
        aMul = 0.98;
      } else if (m === MAT_SKIN) {
        col = tn >= 1 ? colBright : colLight;
        aMul = 0.95;
      } else if (m === MAT_SASH || m === MAT_STRAP || m === MAT_SCAB) {
        col = tn >= 1 ? colLight : colMid;
        aMul = 0.90;
      } else if (m === MAT_HAIR) {
        col = tn === 2 ? colLight : tn === 1 ? colMid : colDark;
        aMul = 0.84;
      } else {
        // Black robe, sleeve & boots: deep silver-slate body so face, sash, scabbard & fist pop!
        col = tn === 2 ? colMid : colDark;
        aMul = 0.78;
      }
    }
    const al = alpha * aMul;
    if (al > 0.92) p.px(lx, ry, col);
    else if (al > 0.025) p.blend(lx, ry, col, al);
  }
}

function drawSolidHero(p, hx, spr, alpha, shredU = 0) {
  if (alpha <= 0.02) return;
  if (alpha > 0.3) {
    for (let dx = -11; dx <= 12; dx++) {
      p.blend(Math.round(hx + dx), 0, HERO.ink, 0.40 * alpha * (1 - Math.abs(dx) / 13));
    }
  }
  for (let i = 0; i < spr.n; i++) {
    const shred = shredU > 0 && ((spr.ys[i] * 5) & 3) === 0 ? Math.round(shredU * 10) : 0;
    const lx = Math.round(hx) + shred + spr.xs[i];
    const ly = spr.ys[i];
    if (lx < -92 || lx > 342 || ly > 0) continue;
    if (alpha > 0.96) p.px(lx, ly, spr.col[i]);
    else p.blend(lx, ly, spr.col[i], alpha);
  }
}

function drawWhiteAirflowBlade(p, xHead, yBase, len, tiltUp, thick, curlH, alpha, C, dir = -1, maxY = 2) {
  if (alpha <= 0.03 || len < 3) return;
  const steps = Math.ceil(len * 1.5);
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const x = xHead + dir * s * len;
    if (x < -92 || x > 342) continue;
    const curl = curlH * Math.pow(Math.max(0, s - 0.50) / 0.50, 2.0);
    const y = Math.min(maxY, yBase - s * tiltUp - curl);
    const profile = Math.sin(Math.PI * Math.pow(1 - s, 0.70));
    const w = thick * profile;
    const col = s < 0.62 ? WHITE : s < 0.85 ? C[6] : C[5];
    const al = alpha * (s < 0.08 ? 0.65 + 0.35 * (s / 0.08) : Math.pow(1 - s, 0.66));
    if (al <= 0.04) continue;

    const ix = Math.round(x), iy = Math.round(y);
    if (al > 0.76) p.px(ix, iy, col);
    else p.blend(ix, iy, col, al);

    if (w > 1.05 && iy - 1 >= -106) {
      const alU = al * 0.86;
      if (alU > 0.80) p.px(ix, iy - 1, s < 0.48 ? WHITE : C[6]);
      else p.blend(ix, iy - 1, s < 0.48 ? WHITE : C[6], alU);
    }
    if (w > 1.80 && iy + 1 <= maxY) {
      p.blend(ix, iy + 1, s < 0.32 ? WHITE : C[5], al * 0.64);
    }
  }
}

function drawTiltedMachCone(p, cx, cy, rx, ry, rot, alpha, C) {
  if (alpha <= 0.03) return;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const pad = Math.max(rx, ry) + 3;
  const x0 = Math.max(-92, Math.floor(cx - pad)), x1 = Math.min(342, Math.ceil(cx + pad));
  const y0 = Math.max(-106, Math.floor(cy - pad)), y1 = Math.min(1, Math.ceil(cy + pad));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const ux = (dx * cr + dy * sr) / rx;
      const uy = (-dx * sr + dy * cr) / ry;
      const d = Math.hypot(ux, uy);
      const frontBias = clamp((ux + 0.45) / 1.35, 0, 1);
      if (frontBias <= 0.02) continue;
      const halfW = 0.08 + 0.18 * frontBias;
      if (Math.abs(d - 1) > halfW) continue;
      const edge = 1 - Math.abs(d - 1) / halfW;
      const col = frontBias > 0.55 && edge > 0.45 ? WHITE : C[6];
      const al = alpha * frontBias * edge;
      if (al > 0.88) p.px(x, y, col);
      else if (al > 0.03) p.blend(x, y, col, al);
    }
  }
}

function drawSmoothPressureRing(p, cx, cy, rOuter, width, sy, alpha, C, half) {
  if (alpha <= 0.02 || rOuter < 2 || width < 0.4) return;
  const rInner = Math.max(0, rOuter - width);
  const x0 = Math.max(-92, Math.floor(cx - rOuter - 2));
  const x1 = Math.min(342, Math.ceil(cx + rOuter + 2));
  const y0 = half > 0 ? Math.floor(cy) : Math.max(-106, Math.floor(cy - rOuter * sy - 2));
  const y1 = half < 0 ? Math.ceil(cy) : Math.min(30, Math.ceil(cy + rOuter * sy + 2));

  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / sy;
    if (half < 0 && dy >= 0) continue;
    if (half > 0 && dy < 0) continue;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const d = Math.hypot(dx, dy);
      if (d > rOuter + 0.8 || d < rInner - 0.8) continue;
      const q = clamp((rOuter - d) / Math.max(0.6, width), 0, 1);
      const wing = 0.64 + 0.36 * Math.abs(dx / Math.max(1, d));
      const col = q < 0.38 ? WHITE : q < 0.70 ? C[6] : C[4];
      const edgeAA = d > rOuter ? 1 - (d - rOuter) / 0.8 : d < rInner ? 1 - (rInner - d) / 0.8 : 1;
      const al = alpha * wing * edgeAA * (1 - q * 0.65);
      if (al > 0.90) p.px(x, y, col);
      else if (al > 0.025) p.blend(x, y, col, al);
    }
  }
}

function drawColdTipGlint(p, cx, cy, hSpan, vSpan, alpha, C) {
  if (alpha <= 0.03) return;
  const hInt = Math.ceil(hSpan);
  for (let dx = -hInt; dx <= hInt; dx++) {
    const q = Math.abs(dx) / Math.max(1, hSpan);
    const al = alpha * Math.pow(1 - q, 1.5);
    if (al > 0.04 && cx + dx >= -92 && cx + dx <= 342) {
      const col = q < 0.45 ? WHITE : C[6];
      if (al > 0.88) p.px(cx + dx, cy, col);
      else p.blend(cx + dx, cy, col, al);
    }
  }
  const vInt = Math.ceil(vSpan);
  for (let dy = -vInt; dy <= Math.min(3, vInt); dy++) {
    const q = Math.abs(dy) / Math.max(1, vSpan);
    const al = alpha * Math.pow(1 - q, 1.45);
    if (al > 0.04) {
      const col = q < 0.45 ? WHITE : C[6];
      if (al > 0.88) p.px(cx, cy + dy, col);
      else p.blend(cx, cy + dy, col, al);
    }
  }
  for (const [ox, oy] of [[-1, -1], [1, -1], [-2, 0], [2, 0]]) {
    p.blend(cx + ox, cy + oy, WHITE, alpha * 0.80);
  }
}

function sampleHeroState(t) {
  let hx = START_X, pose = P_STAND, key = "stand";
  if (t < T_COIL) {
    pose = P_STAND;
    key = "stand";
  } else if (t < T_DASH) {
    const u = ease.outCubic((t - T_COIL) / (T_DASH - T_COIL));
    hx = lerp(START_X, -4, u);
    const q = Math.round(u * 3) / 3;
    pose = interpPose(P_STAND, P_COIL, q);
    key = `coil_${q.toFixed(2)}`;
  } else if (t < T_BRAKE) {
    const u = (t - T_DASH) / (T_BRAKE - T_DASH);
    hx = lerp(4, DASH_X - 6, ease.outCubic(u));
    if (u < 0.34) { pose = P_DASH1; key = "ghost1"; }
    else if (u < 0.68) { pose = P_DASH2; key = "ghost2"; }
    else { pose = P_DASH3; key = "ghost3"; }
  } else if (t < T_TAP) {
    const u = ease.outCubic((t - T_BRAKE) / (T_TAP - T_BRAKE));
    hx = lerp(DASH_X - 6, DASH_X, u);
    const q = Math.round(u * 3) / 3;
    pose = interpPose(P_BRAKE, P_TAP, q);
    key = `brake_${q.toFixed(2)}`;
  } else if (t < T_RISE) {
    hx = DASH_X;
    pose = P_TAP;
    key = "tap";
  } else {
    hx = DASH_X;
    const u = ease.inOutSine(clamp((t - T_RISE) / 0.28, 0, 1));
    const q = Math.round(u * 4) / 4;
    pose = interpPose(P_TAP, P_STAND, q);
    key = q >= 0.99 ? "stand" : `rise_${q.toFixed(2)}`;
  }
  return { hx, spr: buildSwordsmanPose(key, pose) };
}

export function create(o) {
  const C = fit(o.palette, 8);
  const R = new Rng(o.seed), floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[6], C[5], C[4]], haze: C[4] });
  const lights = new Lights();

  const footAirRow = Array.from({ length: 22 }, (_, i) => {
    const isBrake = i >= 15;
    const tier = i % 3;
    return {
      t0: T_DASH + (isBrake ? 0.19 + (i - 15) * 0.022 : 0.004 + i * 0.013),
      x0: isBrake ? 148 + (i - 15) * 5.4 : 4 + i * 10.6 + R.range(-1.2, 1.2),
      y0: tier === 0 ? 1.2 : tier === 1 ? -1.8 : -5.4,
      vx: isBrake ? -R.range(165, 250) : -R.range(200, 315),
      len: isBrake ? R.range(34, 54) : tier === 0 ? R.range(32, 48) : R.range(28, 46),
      tiltUp: tier === 2 ? R.range(3.8, 8.2) : tier === 1 ? R.range(1.4, 3.8) : R.range(0.4, 1.8),
      thick: isBrake || i % 2 === 0 ? 2.4 : 1.7,
      curlH: tier === 1 ? R.range(4.5, 9.0) : R.range(1.8, 4.5),
      life: R.range(0.35, 0.52),
      layer: tier === 2 ? "back" : "front",
    };
  });

  const bodySlipLines = Array.from({ length: 8 }, (_, i) => ({
    t0: T_DASH + 0.012 + i * 0.024,
    x0: 14 + i * 20,
    y0: -15 - (i % 3) * 7,
    vx: -R.range(215, 315),
    len: R.range(28, 46),
    life: R.range(0.25, 0.38),
  }));

  const radialGroundStreaks = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * TAU + 0.18;
    return { ca: Math.cos(a), sa: Math.sin(a), rMax: R.range(56, 102), len: R.range(18, 32) };
  });

  const tipCracks = cracks(R, TIP_X, 9, 46, 8, 0.44);
  const floatSpecks = Array.from({ length: 15 }, (_, i) => {
    const nearTip = i < 9;
    const sgn = R.sign();
    const dist = nearTip ? R.range(4, 36) : R.range(36, 78);
    return {
      dx: sgn * dist,
      riseH: (nearTip ? R.range(9, 21) : R.range(4, 12)) * R.range(0.85, 1.15),
      delay: R.range(0.0, 0.16) + (dist / 90) * 0.08,
      life: R.range(0.42, 0.80),
      big: R.chance(0.32),
    };
  });

  let t = 0, unsheathed = false, launched = false, tapped = false;

  return {
    update(dt) {
      t += dt;

      if (!unsheathed && t >= 0.15) {
        unsheathed = true;
        lights.add(-6, -32, 24, C[6], 0.36, 0.14);
      }

      if (!launched && t >= T_DASH) {
        launched = true;
        lights.add(4, -14, 44, WHITE, 0.64, 0.24);
        for (let i = 0; i < 20; i++) {
          ps.spawn(P.SPARK, R.range(-4, 6), -R.range(1, 8), -R.range(140, 295), -R.range(8, 56), R.range(0.16, 0.34), WHITE);
        }
      }

      if (t >= T_DASH && t <= T_BRAKE + 0.08 && R.chance(3.0 * dt * 60)) {
        const curX = lerp(0, DASH_X, clamp((t - T_DASH) / (T_BRAKE - T_DASH), 0, 1));
        ps.spawn(P.MOTE, curX + R.range(-8, 8), -R.range(1, 6), -R.range(160, 290), -R.range(4, 26), R.range(0.20, 0.38), WHITE, R.chance(0.45) ? 2 : 1);
      }

      if (!tapped && t >= T_TAP) {
        tapped = true;
        lights.add(TIP_X, -2, 38, C[6], 0.50, 0.44);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.48 + R.range(-0.10, 0.10), sp = R.range(28, 66);
          ps.spawn(P.SPARK, TIP_X, -1, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.14, 0.26), WHITE);
        }
      }

      if (t >= T_TAP + 0.04 && t <= T_TAP + 0.46 && R.chance(1.2 * dt * 60)) {
        const dir = R.sign();
        ps.spawn(P.MOTE, TIP_X + dir * R.range(4, 18), -1.5, dir * R.range(55, 125), -R.range(2, 10), R.range(0.22, 0.38), C[6], 1);
      }

      ps.update(dt);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 1e-6) return;

      for (const bs of bodySlipLines) {
        const age = t - bs.t0;
        if (age <= 0 || age >= bs.life) continue;
        const u = age / bs.life;
        const drag = (1 - Math.exp(-age * 5.5)) / 5.5;
        drawWhiteAirflowBlade(p, bs.x0 + bs.vx * drag, bs.y0, bs.len * (1 - u * 0.3), 0.5, 1.3, 0, (1 - u) * 0.84, C, -1, 0);
      }
      for (const fl of footAirRow) {
        if (fl.layer !== "back") continue;
        const age = t - fl.t0;
        if (age <= 0 || age >= fl.life) continue;
        const u = age / fl.life;
        const drag = (1 - Math.exp(-age * 5.0)) / 5.0;
        const curLen = fl.len * Math.min(1, age / 0.028) * (1 - u * 0.25);
        drawWhiteAirflowBlade(p, fl.x0 + fl.vx * drag, fl.y0, curLen, fl.tiltUp, fl.thick, fl.curlH, Math.pow(1 - u, 0.76), C, -1, 0);
      }

      // Three progressively fading Cold Silver-White Phantoms of this Ponytail Swordsman!
      for (const g of GHOST_SPECS) {
        const age = t - g.tSpawn;
        if (age < 0 || age >= g.life) continue;
        const u = age / g.life;
        const fade = g.peakA * Math.pow(1 - u, 1.25) * Math.min(1, age / 0.02);
        drawSilverWhitePhantom(p, g.x, g.spr, C, g, fade, u);
      }

      if (t >= T_TAP) {
        const ageT = t - T_TAP;
        const fadeCr = 1 - smooth(1.25, T_END - 0.12, t);
        if (fadeCr > 0.03) {
          const grow = clamp(ageT / 0.13, 0, 1);
          for (const cr of tipCracks) {
            const n = Math.floor(cr.pts.length * grow);
            for (let i = 1; i < n; i++) {
              const hot = 1 - smooth(0, 0.44, ageT);
              p.line(cr.pts[i - 1][0], cr.pts[i - 1][1], cr.pts[i][0], cr.pts[i][1], hot > 0.45 ? WHITE : C[5], fadeCr * 0.88);
            }
          }
        }

        for (const [delay, dur, rMax, width, aPeak] of [[0, 0.60, 108, 11.0, 0.94], [0.10, 0.62, 70, 7.2, 0.78], [0.21, 0.60, 42, 4.6, 0.62]]) {
          const u = (ageT - delay) / dur;
          if (u <= 0 || u >= 1) continue;
          const r = 5 + rMax * ease.outQuart(u);
          drawSmoothPressureRing(p, TIP_X, 0, r, width * (1 - u * 0.45), 0.17, aPeak * Math.pow(1 - u, 1.22), C, -1);
        }
      }

      ps.draw(p, { layer: "back" });
    },

    draw(p) {
      if (t >= T_END - 1e-6) return;

      if (o.showHero !== false && t < T_END - 0.03) {
        const { hx, spr } = sampleHeroState(t);
        const fadeHero = t < T_FADE ? 1 : 1 - smooth(T_FADE, T_END - 0.03, t);
        const shredHero = t < T_FADE ? 0 : smooth(T_FADE, T_END - 0.03, t);
        drawSolidHero(p, hx, spr, fadeHero, shredHero);
      }

      if (t >= 0.13 && t < 0.22) {
        const uD = (t - 0.13) / 0.09;
        drawColdTipGlint(p, Math.round(-7 - uD * 4), Math.round(-32 + uD * 8), 11 * Math.sin(Math.PI * uD), 6 * Math.sin(Math.PI * uD), Math.sin(Math.PI * uD), C);
      }

      if (t >= T_DASH && t < T_DASH + 0.24) {
        const u = (t - T_DASH) / 0.24;
        const ry = 9 + 25 * ease.outQuart(u), rx = ry * 0.44;
        drawTiltedMachCone(p, 4 - u * 12, -18, rx, ry, 0.28, Math.pow(1 - u, 1.1), C);
      }

      for (const fl of footAirRow) {
        if (fl.layer !== "front") continue;
        const age = t - fl.t0;
        if (age <= 0 || age >= fl.life) continue;
        const u = age / fl.life;
        const drag = (1 - Math.exp(-age * 5.0)) / 5.0;
        const curX = fl.x0 + fl.vx * drag;
        const curLen = fl.len * Math.min(1, age / 0.028) * (1 - u * 0.25);
        drawWhiteAirflowBlade(p, curX, fl.y0, curLen, fl.tiltUp, fl.thick, fl.curlH, Math.pow(1 - u, 0.72), C, -1, 2);
      }

      if (t > T_DASH && t < T_DASH + 0.40) {
        const dtDash = t - T_DASH;
        const uG = dtDash / 0.40;
        const x0 = lerp(-8, 108, smooth(0.08, 0.40, dtDash));
        const x1 = lerp(12, DASH_X + 10, clamp(dtDash / 0.28, 0, 1));
        if (x1 > x0 + 4) {
          p.glowLine(x0, -1, x1, -1, 7, WHITE, 0.30 * (1 - uG));
        }
      }

      if (t >= T_BRAKE + 0.03 && t < T_TAP) {
        const uSlide = ease.inQuad((t - (T_BRAKE + 0.03)) / (T_TAP - (T_BRAKE + 0.03)));
        const gx = Math.round(lerp(DASH_X + 18, TIP_X, uSlide));
        const gy = Math.round(lerp(-14, -1, uSlide));
        drawColdTipGlint(p, gx, gy, 5 + 4 * uSlide, 4, 0.85, C);
      }

      if (t >= T_TAP) {
        const ageT = t - T_TAP;

        for (const [delay, dur, rMax, width, aPeak] of [[0, 0.60, 108, 11.0, 0.98], [0.10, 0.62, 70, 7.2, 0.84], [0.21, 0.60, 42, 4.6, 0.68]]) {
          const u = (ageT - delay) / dur;
          if (u <= 0 || u >= 1) continue;
          const r = 5 + rMax * ease.outQuart(u);
          drawSmoothPressureRing(p, TIP_X, 0, r, width * (1 - u * 0.45), 0.17, aPeak * Math.pow(1 - u, 1.22), C, 1);
        }

        if (ageT < 0.40) {
          const uR = ageT / 0.40;
          const easeR = ease.outQuart(uR);
          const alR = (1 - uR) * 0.88;
          for (const rs of radialGroundStreaks) {
            const r1 = 8 + rs.rMax * easeR;
            const r0 = Math.max(4, r1 - rs.len * (1 - uR * 0.4));
            p.line(
              TIP_X + rs.ca * r0,
              rs.sa * r0 * 0.17,
              TIP_X + rs.ca * r1,
              rs.sa * r1 * 0.17,
              uR < 0.48 ? WHITE : C[6],
              alR
            );
          }
        }

        if (ageT < 0.52) {
          const uW = ageT / 0.52;
          const reach = 8 + 102 * ease.outQuart(uW);
          const wLen = 38 * (1 - uW * 0.30);
          const alW = Math.pow(1 - uW, 0.92);
          drawWhiteAirflowBlade(p, TIP_X - reach + wLen * 0.6, -1.0, wLen, 2.2, 2.5, 7.0, alW, C, -1, 1);
          drawWhiteAirflowBlade(p, TIP_X + reach - wLen * 0.6, -1.0, wLen, 2.2, 2.5, 7.0, alW, C, 1, 1);
        }

        if (ageT < 0.70) {
          const uQ = ageT / 0.70;
          const hQ = 15 * Math.sin(Math.PI * Math.pow(uQ, 0.58));
          const alQ = Math.sin(Math.PI * uQ) * 0.82;
          for (let dy = 1; dy <= hQ; dy++) {
            const sway = Math.sin(dy * 0.45 - ageT * 12) * 1.3;
            p.blend(Math.round(TIP_X + sway), -dy, dy < 5 ? WHITE : C[6], alQ * (1 - dy / (hQ + 1)));
          }
        }

        for (const sp of floatSpecks) {
          const ageS = ageT - sp.delay;
          if (ageS <= 0 || ageS >= sp.life) continue;
          const us = ageS / sp.life;
          const h = sp.riseH * Math.sin(Math.PI * Math.pow(us, 0.58));
          const sx = Math.round(TIP_X + sp.dx * (1 + 0.16 * ease.outCubic(us)));
          const sy = Math.round(-1 - h);
          const alS = Math.sin(Math.PI * us) * 0.94;
          if (sx >= -92 && sx <= 342 && sy >= -106) {
            p.blend(sx, sy, us < 0.52 ? WHITE : C[5], alS);
            if (sp.big) p.blend(sx + 1, sy, C[4], alS * 0.72);
          }
        }

        if (ageT < 0.44) {
          const uG = ageT / 0.44;
          const kG = ease.outBack(clamp(ageT / 0.035, 0, 1), 1.8) * (1 - smooth(0.18, 1.0, uG));
          drawColdTipGlint(p, TIP_X, -1, 34 * kG, 14 * kG, kG, C);
        }
      }

      ps.draw(p, { layer: "front" });
      lights.draw(p);
    },
  };
}
