// Hologram Scan (全息扫描场景装饰特效 — scifi/hologram-scan):
// A full-screen (320x180) loopable sci-fi surveillance monitor overlay:
// 1. Uniform Top-to-Bottom Cyan Laser Scanline (从屏幕顶部匀速向下平推扫过全屏的纤细青色激光扫描线):
//    A razor-sharp 1px white-cyan laser core with a tight electric-cyan corona and left/right rail emitters
//    sweeps at constant velocity from top to bottom.
// 2. Transient Translucent Hexagonal Tech Grid (扫描线经过之处短暂浮现半透明六边形科技网格，随后迅速暗淡消失):
//    In the wake above the advancing scanline, a pointy-top hexagonal wireframe & bevelled holo-plate grid
//    flashes into view, shimmers across staggered telemetry cells, and rapidly dims back to transparency.
// 3. Jumping Digital Code Readouts (跳动数字代码):
//    Inside active hex nodes and data columns behind the scanline, crisp 3x5 pixel-font numeric & hex readouts
//    rapidly count and scramble before fading out with the grid.
// 4. Fine CRT TV Scanlines & Screen-Edge Red-Blue RGB Chromatic Aberration Glitch (细密电视扫描线与边缘红蓝RGB色差故障闪烁):
//    Fine 2px horizontal CRT scanline grooves span the monitor while the screen edges and corner HUD brackets
//    twitch with red (#ff2652) and blue (#2468ff) chromatic aberration splits and micro-tears.
// Hexagonal grid math builds on src/fx/scifi/force-field.js (adapted from Sprite Fusion's open-source shield,
// MIT License, Copyright (c) 2026 Hugo Duprez), scanline/readout logic on src/fx/scifi/scanner.js and
// src/fx/scifi/hologram.js, and RGB glitch splits on src/fx/scifi/glitch.js.

import { fit, clamp, smooth, mix, rand, hex, TAU, WHITE } from "../../core/index.js";
import { clip, rows } from "../weather/_lib.js";
import { FONTS } from "../../core/font.js";

export const meta = {
  name: "Hologram scan",
  desc: "A thin cyan laser line sweeps uniformly down the screen, briefly revealing a translucent hex grid and jumping digital code amid fine CRT scanlines and edge RGB glitch splits.",
  tags: ["scifi", "hologram", "scan", "scanline", "hex", "grid", "digital", "glitch", "rgb", "crt", "monitor", "overlay", "loop"],
  size: [320, 180],
  origin: [160, 90],
  duration: 3.6,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    // 8-step Cyan Hologram Ramp: deep monitor slate -> dark teal -> holo cyan -> electric cyan -> laser white-cyan
    palette: ["#041018", "#072232", "#0c425c", "#147296", "#1eb4dc", "#42f2ff", "#b8fcff", "#ffffff"],
    // Red & Blue chromatic aberration channels for screen-edge glitch splits
    red: "#ff2652",
    blue: "#2468ff",
    seed: 17,
  },
};

const D = meta.duration;
const W = 320, H = 180;
const X0 = -160, X1 = 160, Y0 = -90, Y1 = 90;
const NF = Math.round(D * meta.fps); // 108 frames per loop
const S3 = Math.sqrt(3);
const HEX_SCALE = 11.5; // Pointy-top hex radius in px (~20px wide, ~23px tall)
const WAKE_SPAN = 64;   // Height of the trailing hex-grid & digital-code wake behind the scanline (px)

// Pre-computed screen-edge falloff LUTs (0 in center, 1 at screen borders)
const EDGE_X = new Float32Array(W);
const EDGE_Y = new Float32Array(H);
for (let i = 0; i < W; i++) EDGE_X[i] = smooth(104, 158, Math.abs(X0 + i + 0.5));
for (let py = 0; py < H; py++) EDGE_Y[py] = smooth(58, 88, Math.abs(Y0 + py + 0.5));

// ---------------------------------------------------------------------------
// 1. Pre-baked 320x180 Pointy-Top Hexagonal Grid Lookup Table (adapted from force-field.js)
// ---------------------------------------------------------------------------
const hexCache = new Map();

function getHexMap(seed) {
  let cached = hexCache.get(seed);
  if (cached) return cached;

  const seam = new Uint8Array(W * H);      // 1 on 1px hex edge seam
  const bevel = new Uint8Array(W * H);     // 1 on inner top-left bevel of each hex plate
  const vertex = new Uint8Array(W * H);    // 1 near the 6 vertices of each hex
  const cellQ = new Int16Array(W * H);     // Axial q coordinate
  const cellR = new Int16Array(W * H);     // Axial r coordinate
  const localX = new Int8Array(W * H);     // Pixel offset dx from hex center (-11..+11)
  const localY = new Int8Array(W * H);     // Pixel offset dy from hex center (-11..+11)
  const cellSpanArr = new Float32Array(W * H); // Pre-computed wake decay span per pixel
  const cellFlags = new Uint8Array(W * H); // bit 0: hasCode, bit 1: isActiveTile
  const ids = new Int32Array(W * H);

  for (let py = 0; py < H; py++) {
    const y = Y0 + py + 0.5;
    const gy = y / HEX_SCALE;
    for (let px = 0; px < W; px++) {
      const x = X0 + px + 0.5;
      const gx = x / HEX_SCALE;

      // Axial hex coordinates (pointy-top hexagon, adapted from src/fx/scifi/force-field.js)
      const fq = (S3 / 3) * gx - gy / 3;
      const fr = (2 / 3) * gy;
      const fs = -fq - fr;
      let q = Math.round(fq), r = Math.round(fr);
      const s = Math.round(fs);
      const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
      if (dq > dr && dq > ds) q = -r - s;
      else if (dr > ds) r = -q - s;

      const hx = S3 * (q + r / 2);
      const hy = 1.5 * r;
      const dx = gx - hx;
      const dy = gy - hy;

      // Distance to nearest of the 6 hex corners
      const k = Math.round((Math.atan2(dy, dx) - Math.PI / 6) / (Math.PI / 3));
      const ca = Math.PI / 6 + (k * Math.PI) / 3;
      const cornerDist = Math.hypot(dx - Math.cos(ca), dy - Math.sin(ca)) * HEX_SCALE;

      const idx = py * W + px;
      const id = (q + 500) * 1000 + (r + 500);
      ids[idx] = id;
      cellQ[idx] = q;
      cellR[idx] = r;
      const lx = Math.round(dx * HEX_SCALE);
      const ly = Math.round(dy * HEX_SCALE);
      localX[idx] = lx;
      localY[idx] = ly;
      if (cornerDist < 1.65) vertex[idx] = 1;

      const ch = rand(q, r, seed);
      cellSpanArr[idx] = WAKE_SPAN * (0.58 + 0.42 * ch);
      const inReadoutBox = lx >= -5 && lx <= 5 && ly >= -2 && ly <= 2 && lx !== -2 && lx !== 2;
      const hasCode = ch > 0.58 && inReadoutBox ? 1 : 0;
      const isActiveTile = ch > 0.74 ? 2 : 0;
      cellFlags[idx] = hasCode | isActiveTile;
    }
  }

  // Compute crisp 1px seams & inner top-left bevels (exactly as in force-field.js)
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const idx = py * W + px;
      const id = ids[idx];
      const rId = px + 1 < W ? ids[idx + 1] : id;
      const dId = py + 1 < H ? ids[idx + W] : id;
      const lId = px - 1 >= 0 ? ids[idx - 1] : id;
      const uId = py - 1 >= 0 ? ids[idx - W] : id;
      const isSeam = rId !== id || dId !== id;
      seam[idx] = isSeam ? 1 : 0;
      bevel[idx] = !isSeam && (lId !== id || uId !== id) ? 1 : 0;
    }
  }

  cached = { seam, bevel, vertex, cellQ, cellR, localX, localY, cellSpanArr, cellFlags };
  hexCache.set(seed, cached);
  return cached;
}

// ---------------------------------------------------------------------------
// 2. Fast 3x5 Pixel Font Digit Sampler for Jumping Digital Code inside Hex Cells
// ---------------------------------------------------------------------------
const HEX_CHARS = "0123456789ABCDEF";
const MINI_GLYPHS = FONTS.mini.glyphs;

function sampleMiniChar(ch, gx, gy) {
  const g = MINI_GLYPHS[ch];
  return g ? !!g.rows[gy]?.[gx] : false;
}

// Checks if pixel (lx, ly) inside hex cell (q, r) hits a jumping 3-char digital code readout
function sampleHexCellCode(q, r, lx, ly, tickFast, tickMed, seed) {
  const bx = lx + 5;
  const by = ly + 2;
  const slot = bx < 3 ? 0 : bx < 7 ? 1 : 2;
  const gx = bx - slot * 4;

  const mode = ((q * 7 + r * 13) & 3);
  let ch;
  if (mode === 0 || mode === 1) {
    // Rapidly counting 3-digit telemetry number (100..999)
    const baseNum = ((q * 173 + r * 281 + seed * 37) & 511) + 100;
    const step = 1 + ((Math.abs(q + r * 3)) & 7);
    const num = (baseNum + tickFast * step) % 1000;
    const d = slot === 0 ? ((num / 100) | 0) : slot === 1 ? (((num / 10) | 0) % 10) : (num % 10);
    ch = HEX_CHARS[d];
  } else if (mode === 2) {
    // Jumping hexadecimal code (e.g. "A4F", "7C2", "E9B")
    const idx = ((q * 19 + r * 31 + slot * 11 + tickMed * 5 + seed) & 15);
    ch = HEX_CHARS[idx];
  } else {
    // Percentage / hex-pair readout (e.g. "84%", "62%", "95%")
    if (slot === 2) ch = "%";
    else {
      const pct = (((q * 43 + r * 67 + tickFast * 3) % 90) + 190) % 90 + 10;
      ch = HEX_CHARS[slot === 0 ? ((pct / 10) | 0) : (pct % 10)];
    }
  }

  return sampleMiniChar(ch, gx, by) ? 1 : 0;
}

// ---------------------------------------------------------------------------
// 3. Screen-Edge RGB Glitch & Tearing Schedule (seamless over NF = 108 frames)
// ---------------------------------------------------------------------------
function getEdgeGlitchState(f, seed) {
  const r = (...n) => rand(seed, f, ...n);
  const burstPhase = Math.sin((f / NF) * TAU * 6) + 0.5 * Math.cos((f / NF) * TAU * 9 + 1.2);
  const isBurst = burstPhase > 0.55 || r(1) < 0.22;
  const strength = isBurst ? 0.65 + 0.35 * r(2) : 0.25 + 0.15 * r(3);
  const splitDir = r(4) < 0.5 ? -1 : 1;
  const rgbShift = Math.max(1, Math.round((isBurst ? 2.2 + 1.8 * r(5) : 1.2) * strength)) * splitDir;

  const tears = [];
  const nTears = isBurst ? 4 + Math.floor(r(6) * 4) : 2;
  for (let i = 0; i < nTears; i++) {
    const ty = Y0 + Math.floor(r(10 + i, 1) * H);
    const th = 2 + Math.floor(r(10 + i, 2) * (isBurst ? 8 : 4));
    const tdx = Math.round((r(10 + i, 3) - 0.5) * (isBurst ? 12 : 6));
    const tintMode = r(10 + i, 4);
    tears.push({ y0: ty, y1: ty + th, dx: tdx, tintMode });
  }

  return { isBurst, strength, rgbShift, tears };
}

// ---------------------------------------------------------------------------
// 4. Corner HUD Viewfinder Brackets, Scan Telemetry & Edge RGB Split Overlay
// ---------------------------------------------------------------------------
function drawMonitorHudAndLaserRails(q, ph, f, scanY, C, RED, BLUE, glitch, seed) {
  const shift = glitch.rgbShift;
  const burst = glitch.isBurst;

  const hudLine = (x0, y0, x1, y1, col, a = 0.75) => {
    q.line(x0 - shift, y0, x1 - shift, y1, RED, a * (burst ? 0.65 : 0.38));
    q.line(x0 + shift, y0, x1 + shift, y1, BLUE, a * (burst ? 0.65 : 0.38));
    q.line(x0, y0, x1, y1, col, a);
  };

  // A. Four Corner Surveillance Viewfinder Brackets with RGB split
  const bx0 = X0 + 7, bx1 = X1 - 8, by0 = Y0 + 7, by1 = Y1 - 8;
  const bLenX = 18, bLenY = 12;
  const corners = [
    [bx0, by0,  1,  1],
    [bx1, by0, -1,  1],
    [bx0, by1,  1, -1],
    [bx1, by1, -1, -1],
  ];
  for (const [cx, cy, sx, sy] of corners) {
    hudLine(cx, cy, cx + sx * bLenX, cy, C[5], 0.82);
    hudLine(cx, cy, cx, cy + sy * bLenY, C[5], 0.82);
    hudLine(cx + sx * 3, cy + sy * 3, cx + sx * 8, cy + sy * 3, C[4], 0.55);
    hudLine(cx + sx * 3, cy + sy * 3, cx + sx * 3, cy + sy * 6, C[4], 0.55);
    q.px(cx, cy, WHITE);
    q.glow(cx, cy, 6, C[5], 0.25);
  }

  // B. Left & Right Vertical Calibration Rails & Sliding Laser Emitter Heads
  for (const side of [-1, 1]) {
    const rx = side < 0 ? X0 + 5 : X1 - 6;
    for (let y = Y0 + 22; y <= Y1 - 22; y += 12) {
      const distScan = ((scanY - y) % H + H) % H;
      const hot = distScan < 8 || distScan > H - 4;
      const tickW = y % 24 === 0 ? 4 : 2;
      const xStart = side < 0 ? rx : rx - tickW;
      const xEnd = side < 0 ? rx + tickW : rx;
      if (hot || burst) {
        q.line(xStart - shift, y, xEnd - shift, y, RED, 0.55);
        q.line(xStart + shift, y, xEnd + shift, y, BLUE, 0.55);
      }
      q.line(xStart, y, xEnd, y, hot ? WHITE : distScan < 42 ? C[5] : C[2], hot ? 0.95 : 0.45);
    }

    // Sliding Laser Emitter Head at y = scanY on both left and right edges
    const sy = clamp(Math.round(scanY), Y0 + 5, Y1 - 6);
    const ex = side < 0 ? X0 + 4 : X1 - 5;
    q.line(ex, sy - 4, ex, sy + 4, C[6]);
    q.line(ex + side * 2, sy - 2, ex + side * 2, sy + 2, WHITE);
    q.px(ex + side * 4, sy, WHITE);
    q.line(ex - shift, sy - 3, ex - shift, sy + 3, RED, 0.75);
    q.line(ex + shift, sy - 3, ex + shift, sy + 3, BLUE, 0.75);
    q.glow(ex + side * 3, sy, 9, C[5], 0.50);
  }

  // C. Top-Left, Top-Right & Scanline Digital Monitor Readouts with RGB Chromatic Split
  const pct = String(Math.floor(ph * 100)).padStart(2, "0");
  const topLabel = `SCN:${pct}%`;
  const hexCode = `${HEX_CHARS[(f * 3) & 15]}${HEX_CHARS[(f * 7 + 5) & 15]}:${HEX_CHARS[(f * 5 + 2) & 15]}${HEX_CHARS[(f * 11 + 9) & 15]}`;

  if (burst) {
    q.text(topLabel, bx0 + 5 - shift, by0 + 4, RED, { font: "mini" });
    q.text(topLabel, bx0 + 5 + shift, by0 + 4, BLUE, { font: "mini" });
    q.text(hexCode, bx1 - 24 - shift, by0 + 4, RED, { font: "mini" });
    q.text(hexCode, bx1 - 24 + shift, by0 + 4, BLUE, { font: "mini" });
  }
  q.text(topLabel, bx0 + 5, by0 + 4, C[5], { font: "mini", shadow: C[0] });
  q.text(hexCode, bx1 - 24, by0 + 4, C[5], { font: "mini", shadow: C[0] });

  // Moving scanline Y-coordinate readout riding just above the laser line on the right margin
  const scanLabelY = clamp(Math.round(scanY) - 8, Y0 + 18, Y1 - 16);
  const yCoordStr = String(Math.floor(scanY - Y0)).padStart(3, "0");
  q.text(yCoordStr, X1 - 22 - shift, scanLabelY, RED, { font: "mini" });
  q.text(yCoordStr, X1 - 22 + shift, scanLabelY, BLUE, { font: "mini" });
  q.text(yCoordStr, X1 - 22, scanLabelY, WHITE, { font: "mini", shadow: C[1] });

  // D. Screen-Edge RGB Chromatic Aberration Glitch Slivers (边缘故障风红蓝闪烁块)
  for (let i = 0; i < (burst ? 9 : 4); i++) {
    if (rand(seed, f, 200 + i) > (burst ? 0.85 : 0.55)) continue;
    const gw = 4 + Math.floor(rand(seed, f, 230 + i) * 12);
    const gh = 1 + (rand(seed, f, 240 + i) < 0.35 ? 1 : 0);
    const isLeft = (i & 1) === 0;
    const gx = isLeft
      ? X0 + 5 + Math.floor(rand(seed, f, 210 + i) * 22)
      : X1 - 5 - gw - Math.floor(rand(seed, f, 210 + i) * 22);
    const gy = Y0 + 8 + Math.floor(rand(seed, f, 220 + i) * (H - 16));

    q.rect(gx - shift, gy, gw, gh, RED);
    q.rect(gx + shift, gy + (gh > 1 ? 1 : 0), gw, gh, BLUE);
    if (rand(seed, f, 250 + i) < 0.5) {
      q.rect(gx, gy, Math.max(2, gw - 2), 1, C[6]);
    }
    q.glow(gx + gw * 0.5, gy, 5, (i & 1) ? RED : BLUE, 0.22 * glitch.strength);
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 8);
  const RED = hex(o.red);
  const BLUE = hex(o.blue);
  const seed = o.seed;

  const time = ((t % D) + D) % D;
  const ph = time / D;
  const f = Math.floor(ph * NF) % NF;
  const tickFast = Math.floor(ph * 36); // 36 ticks per loop (10 Hz)
  const tickMed = Math.floor(ph * 18);  // 18 ticks per loop (5 Hz)

  // Uniform top-to-bottom laser scanline position across all 180 rows (匀速向下平推扫过全屏)
  const scanY = Y0 + ph * H;

  const HMAP = getHexMap(seed);
  const glitch = getEdgeGlitchState(f, seed);

  // Full-screen row-by-row shader pass
  rows(p, meta, Y0, Y1, (y, R) => {
    const py = Math.floor(y - Y0);
    if (py < 0 || py >= H) return;
    const rowOff = py * W;
    const edgeY = EDGE_Y[py] * 0.75;

    // Fine TV CRT scanline modulation: every 2nd row is a crisp phosphor scanline groove
    const isCrtDarkRow = (py & 1) === 1;
    const crtMask = isCrtDarkRow ? 0.65 : 1.0;
    const crtRoll = 0.5 + 0.5 * Math.sin((py / H) * TAU * 2 - ph * TAU * 2);

    // Distance behind the downward-moving laser scanline (wrapped modulo H for a 100% seamless loop!)
    const rawDy = scanY - y;
    const dyBehind = ((rawDy % H) + H) % H;
    const dyAhead = H - dyBehind;

    const onLaserCore = dyBehind < 1.15 || dyAhead < 0.45;
    const onLaserPre = !onLaserCore && dyAhead <= 3.0;
    const inWake = !onLaserCore && !onLaserPre && dyBehind <= WAKE_SPAN;

    // Fast path for rows outside the laser & wake in the center of the screen
    let tearDx = 0;
    let tearTint = 0;
    for (let ti = 0; ti < glitch.tears.length; ti++) {
      const tr = glitch.tears[ti];
      if (y >= tr.y0 && y < tr.y1) {
        tearDx = tr.dx;
        tearTint = tr.tintMode < 0.45 ? RED : tr.tintMode < 0.90 ? BLUE : WHITE;
        break;
      }
    }

    // -------------------------------------------------------------------------
    // A. Primary Thin Cyan Laser Scanline Row (纤细的青色激光扫描线)
    // -------------------------------------------------------------------------
    if (onLaserCore) {
      for (let i = 0; i < W; i++) {
        const edgeX = EDGE_X[i];
        const effPx = clamp(i + (edgeX > 0.15 ? Math.round(tearDx * edgeX) : 0), 0, W - 1);
        const idx = rowOff + effPx;
        const isVtx = HMAP.vertex[idx] === 1;
        const isSeam = HMAP.seam[idx] === 1;
        const isTick = (i & 15) === 0;
        let laserCol = isVtx || isSeam || isTick ? WHITE : C[6];
        if (edgeX > 0.45 && glitch.isBurst) {
          laserCol = (i & 2) ? WHITE : i < 160 ? mix(C[6], RED, 0.45) : mix(C[6], BLUE, 0.45);
        }
        R.c[i] = laserCol;
        R.a[i] = 0.96;
        R.b[i] = 1;
        R.l[i] = C[5];
        R.k[i] = isVtx || isSeam ? 0.72 : 0.52;
      }
      return;
    }

    // Crisp 1-3px pre-ionization glow just ahead (below) of the downward-moving laser line
    if (onLaserPre) {
      const preK = 1 - dyAhead / 3.0;
      for (let i = 0; i < W; i++) {
        const idx = rowOff + i;
        const isSeam = HMAP.seam[idx] === 1;
        R.c[i] = isSeam ? C[6] : C[5];
        R.a[i] = (isSeam ? 0.58 : 0.28) * preK * crtMask;
        R.b[i] = 1;
        R.l[i] = C[5];
        R.k[i] = 0.32 * preK;
      }
      return;
    }

    const uWake = inWake ? dyBehind / WAKE_SPAN : 1.0;
    const wakeEnvGlobal = inWake ? (1 - uWake) * Math.sqrt(1 - uWake) : 0;
    const bezelFlicker = 0.5 + 0.5 * Math.sin(ph * TAU * 8 + py * 0.15);
    const bezelSideCol = ((py + f) & 2) ? RED : BLUE;
    const laserTail = inWake && dyBehind < 10 ? (1 - dyBehind / 10) * (1 - dyBehind / 10) * 0.32 : 0;

    for (let i = 0; i < W; i++) {
      const edgeX = EDGE_X[i];
      const edgeFactor = edgeX > edgeY ? edgeX : edgeY;

      // Fast skip for middle columns outside the wake when neither CRT dark row nor rolling refresh bar
      if (!inWake && edgeFactor <= 0.04) {
        if (isCrtDarkRow) {
          R.c[i] = C[0];
          R.a[i] = 0.22;
          R.b[i] = 1;
        } else if (crtRoll > 0.78) {
          R.c[i] = C[2];
          R.a[i] = (crtRoll - 0.78) * 0.24;
          R.b[i] = 1;
        }
        continue;
      }

      const effPx = edgeX > 0.15 && tearDx ? clamp(i + Math.round(tearDx * edgeX), 0, W - 1) : i;
      const idx = rowOff + effPx;

      let col = 0;
      let alpha = 0;
      let lightCol = 0;
      let lightK = 0;

      // -----------------------------------------------------------------------
      // B. Translucent Hexagonal Tech Grid & Jumping Digital Code in Scan Wake
      // -----------------------------------------------------------------------
      if (inWake) {
        const cellSpan = HMAP.cellSpanArr[idx];
        if (dyBehind < cellSpan) {
          const q = HMAP.cellQ[idx];
          const r = HMAP.cellR[idx];
          const uCell = dyBehind / cellSpan;
          const om = 1 - uCell;
          const fadeEnv = om * Math.sqrt(om);
          const extinguishBlink = uCell > 0.74 && ((tickFast + q * 3 + r * 5) & 1) === 0 ? 0.25 : 1.0;
          const env = fadeEnv * extinguishBlink;

          const flags = HMAP.cellFlags[idx];
          const isSeam = HMAP.seam[idx] === 1;
          const isBevel = HMAP.bevel[idx] === 1;
          const isVtx = HMAP.vertex[idx] === 1;
          const isActiveTile = (flags & 2) !== 0;

          let codeHit = 0;
          if ((flags & 1) !== 0 && uCell < 0.88) {
            codeHit = sampleHexCellCode(q, r, HMAP.localX[idx], HMAP.localY[idx], tickFast, tickMed, seed);
          }

          if (codeHit) {
            col = dyBehind < 10 ? WHITE : uCell < 0.45 ? C[6] : C[5];
            alpha = 0.86 * env * crtMask;
            lightCol = C[5];
            lightK = 0.38 * env;
          } else if (isVtx) {
            col = dyBehind < 12 ? WHITE : uCell < 0.5 ? C[6] : C[5];
            alpha = 0.86 * env * crtMask;
            lightCol = C[5];
            lightK = 0.34 * env;
          } else if (isSeam) {
            col = dyBehind < 6 ? WHITE : uCell < 0.28 ? C[6] : uCell < 0.62 ? C[5] : C[4];
            alpha = (0.76 * env + (dyBehind < 5 ? 0.18 : 0)) * crtMask;
            lightCol = C[4];
            lightK = 0.22 * env;
          } else if (isBevel) {
            col = uCell < 0.35 ? C[5] : C[4];
            alpha = (isActiveTile ? 0.38 : 0.22) * env * crtMask;
            lightCol = C[4];
            lightK = 0.08 * env;
          } else {
            const tileAlpha = (isActiveTile ? 0.22 : 0.08) * env + laserTail;
            col = dyBehind < 5 ? C[5] : isActiveTile ? C[4] : C[3];
            alpha = tileAlpha * (isCrtDarkRow ? 0.55 : 1.0);
            if (laserTail > 0.02 || isActiveTile) {
              lightCol = C[4];
              lightK = 0.14 * laserTail + (isActiveTile ? 0.05 * env : 0);
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // C. Screen-Edge Red-Blue RGB Chromatic Aberration Split (边缘红蓝RGB色差闪烁)
      // -----------------------------------------------------------------------
      if (edgeFactor > 0.04) {
        if (inWake) {
          const shiftPx = Math.max(1, Math.round(glitch.rgbShift * (0.5 + 0.5 * edgeFactor)));
          const idxRed = rowOff + clamp(effPx - shiftPx, 0, W - 1);
          const idxBlue = rowOff + clamp(effPx + shiftPx, 0, W - 1);

          if (!HMAP.seam[idx]) {
            if (HMAP.seam[idxRed] === 1 || HMAP.vertex[idxRed] === 1) {
              const kRed = edgeFactor * wakeEnvGlobal * (0.45 + 0.40 * glitch.strength);
              if (kRed > 0.06) {
                col = col ? mix(col, RED, 0.7) : RED;
                if (kRed > alpha) alpha = kRed;
                lightCol = RED;
                if (0.28 * kRed > lightK) lightK = 0.28 * kRed;
              }
            } else if (HMAP.seam[idxBlue] === 1 || HMAP.vertex[idxBlue] === 1) {
              const kBlue = edgeFactor * wakeEnvGlobal * (0.45 + 0.40 * glitch.strength);
              if (kBlue > 0.06) {
                col = col ? mix(col, BLUE, 0.7) : BLUE;
                if (kBlue > alpha) alpha = kBlue;
                lightCol = BLUE;
                if (0.28 * kBlue > lightK) lightK = 0.28 * kBlue;
              }
            }
          }
        }

        if (tearTint && edgeX > 0.25) {
          const kTear = edgeX * (glitch.isBurst ? 0.42 : 0.22);
          col = col ? mix(col, tearTint, 0.55) : tearTint;
          if (kTear > alpha) alpha = kTear;
          lightCol = tearTint;
          if (0.20 * kTear > lightK) lightK = 0.20 * kTear;
        } else if (edgeFactor > 0.35 && !isCrtDarkRow) {
          const kBezel = (edgeFactor - 0.35) * 0.28 * bezelFlicker * glitch.strength;
          if (kBezel > 0.025) {
            col = col ? mix(col, bezelSideCol, 0.35) : bezelSideCol;
            if (kBezel > alpha) alpha = kBezel;
            lightCol = bezelSideCol;
            if (0.12 * kBezel > lightK) lightK = 0.12 * kBezel;
          }
        }
      }

      // -----------------------------------------------------------------------
      // D. Fine Full-Screen CRT Television Scanline Texture (全屏细密电视扫描线细节)
      // -----------------------------------------------------------------------
      if (isCrtDarkRow) {
        if (!col) {
          col = C[0];
          alpha = 0.22 + 0.08 * edgeFactor;
        } else if (alpha < 0.18) {
          alpha = 0.18;
        }
      } else if (!col && crtRoll > 0.78) {
        col = C[2];
        alpha = (crtRoll - 0.78) * 0.24;
      }

      if (col && alpha > 0.005) {
        R.c[i] = col;
        R.a[i] = alpha > 0.95 ? 0.95 : alpha;
        R.b[i] = 1;
      }
      if (lightK > 0.005) {
        R.l[i] = lightCol || col;
        R.k[i] = lightK;
      }
    }
  });

  // 5. Draw Clipped Corner HUD Brackets, Laser Rail Emitters, Coordinate Readouts & Edge RGB Glitch Slivers
  const q = clip(p, meta);
  drawMonitorHudAndLaserRails(q, ph, f, scanY, C, RED, BLUE, glitch, seed);
}
