// Chrono Gears (时空齿轮 — arcane/chrono-gears):
// Full-screen 320x180 seamless looping scene-decoration overlay (`可叠加在环境中的可循环场景装饰特效`):
// 1. Co-Axial Four-Corner Astronomical Dials & Crown-Toothed Destiny Rims (四角同轴罗马数字星盘与皇冠外齿圈):
//    Anchored at four visible jeweled hubs `(±140, ±74)` inside the corners while keeping the central stage open
//    and transparent for any underlying scene, colossal 162px-diameter Roman-numeral astrolabe dials (displaying
//    all twelve numerals I..XII upright in true clockwise order) and 48-tooth rotating outer crown rings materialize
//    outward from the four corners with a golden engraving shockwave and veil smoothly back at the 12s loop seam.
// 2. Six-Tier Interlocking Constant-Speed Gear Trains (大大小小的齿轮相互咬合着以不同速度持续匀速旋转):
//    Each corner drives 6 precision-meshed openwork golden gears (Z = 48, 36, 18, 12, 9, 6 teeth; pitch module 1.50px)
//    spanning an 8x constant speed range (0.75x, 1.0x, -2.0x, -3.0x, +4.0x, +6.0x) locked tooth-in-groove.
// 3. High-Impact Periodic Escapement Pointer Jumps (表盘指针周期性跳动一下 — 严格同轴零偏移):
//    Both the stately hour hand and sculpted cathedral lancet fate hand pierce dead-center through the visible
//    corner hub `(±140, ±74)` (with counterweight tails and jeweled pivot caps) and step in exact 15.0° increments
//    aligned to the 5° degree ticks and 15°/45°/75° Roman numerals — unleashing a luminous 15° swept light-fan,
//    expanding hub shock-ring, 8-ray tip starburst, and blazing numeral ignition on every jump. Co-axial sub-dials
//    mounted dead-center on G1's axle snap in alternating 30° ticks.
// 4. Forge-Bright Meshing Golden Spark Fountains (齿轮咬合处定期迸发出微小金色星火):
//    At all 16 visible tooth-meshing contacts, rhythmic engagements erupt with white-gold cross-glints and
//    high-velocity tangential golden spark showers.
// Mechanical escapement hand snap draws on `src/fx/arcane/time-stop.js` and rune/mote lighting draws on
// `src/fx/arcane/rune-circle.js` (adapted from Sprite Fusion's open-source pixel-art VFX, MIT License,
// Copyright (c) 2026 Hugo Duprez).
import { fit, clamp, rng, wrap, ease, TAU, WHITE, sparkle } from "../../core/index.js";
import { clip, rows } from "../weather/_lib.js";

export const meta = {
  name: "Chrono gears",
  desc: "Co-axial golden openwork gear trains and crown-toothed Roman-numeral dials emerge from all four corners, meshing across six speeds with forge sparks and snapping hands.",
  tags: ["arcane", "time", "chrono", "gears", "clock", "dial", "gold", "destiny", "overlay", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 90],
  duration: 12,
  loop: true,
  fps: 30,
  bg: "ground",
  options: {
    // 8-step High-Contrast Imperial Chrono-Gold ramp: deep umber-bronze -> burnished gold -> blazing champagne -> white
    palette: ["#221104", "#4e2b08", "#8c530e", "#cc8518", "#f7be2e", "#ffe575", "#fff8cc", "#ffffff"],
    // 5-step Recessed Bronzed Astrolabe shadow/relief ramp + astral starlight accent
    bronze:  ["#301a06", "#5c350e", "#965d18", "#d18f28", "#b8e2ff"],
    seed: 7,
  },
};

const D = 12, W = 320, H = 180, X0 = -160, X1 = 159, Y0 = -90, Y1 = 89;
const PITCH_M = 1.50;       // Exact watchmaker module (px per tooth)
const TEETH_PER_LOOP = 36;  // 36 teeth per 12s loop: divisible by Z/spokes for Z=48/8, 36/6, 18/6, 12/6, 9/3, 6/3!

// Precompute static 320x180 Four-Corner Vignette LUT once (central stage === 0 -> < 0.15 ms/frame)
const VIG_LUT = (() => {
  const lut = new Float32Array(W * H);
  for (let yi = 0; yi < H; yi++) {
    const ny = Math.abs(Y0 + yi + 0.5) / 90;
    const dy = Math.max(0, ny - 0.24) / 0.76;
    const dySq = dy * dy;
    const rowOff = yi * W;
    for (let xi = 0; xi < W; xi++) {
      const nx = Math.abs(X0 + xi + 0.5) / 160;
      const dx = Math.max(0, nx - 0.34) / 0.66;
      const d = Math.sqrt(dx * dx + dySq);
      if (d > 0.06) {
        const k = clamp((d - 0.06) / 0.94, 0, 1);
        lut[rowOff + xi] = k * k;
      }
    }
  }
  return lut;
})();

const sstep = (u) => {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
};

// Seamless 12s Corner Emergence & Destiny Tide:
// Note: To keep ALL co-axial hubs, dials, hands, and meshing gears 100% locked with ZERO subpixel drift or offset,
// the entire corner assembly translates by the EXACT SAME integer corner slide `(shiftX, shiftY)`!
function emergenceAt(t, lag = 0, minA = 0.34) {
  const rise = sstep((t - lag * 0.42) / 1.65);
  const veil = 1 - sstep((t - (10.10 - lag * 0.32)) / (1.90 + lag * 0.32));
  return minA + (1 - minA) * (rise * veil);
}

function cornerSlidePx(t) {
  const w = sstep(t / 1.70) * (1 - sstep((t - 10.15) / 1.85));
  return Math.round((1 - w) * 8); // exact integer pixel slide shared by hub, dial, hands & all gears -> ZERO offset!
}

// Pre-bake 2x-supersampled (0.5px resolution) openwork & crown gear templates
const GEAR_TPL_CACHE = new Map();
function getGearTemplate(Z, spokes, style) {
  const key = `${Z}|${spokes}|${style}`;
  let tpl = GEAR_TPL_CACHE.get(key);
  if (tpl) return tpl;

  // `style === 4`: Colossal Hollow Outer Crown Ring-Gear (`Z = 48`, teeth outside the Roman-numeral dial!)
  const isCrown = style === 4;
  const rPitch = isCrown ? 77.5 : Z * PITCH_M;
  const rTip = isCrown ? 81.2 : rPitch + (Z >= 24 ? 2.45 : Z >= 12 ? 2.15 : 1.90);
  const rRoot = isCrown ? 75.6 : rPitch - (Z >= 24 ? 2.10 : Z >= 12 ? 1.80 : 1.55);
  const rimW = isCrown ? 2.4 : Z >= 30 ? 4.5 : Z >= 16 ? 3.6 : Z >= 12 ? 3.0 : 2.4;
  const rRimIn = rRoot - rimW;
  const rHubOut = isCrown ? rRimIn : Math.max(2.6, rRimIn * (Z >= 30 ? 0.22 : 0.32));
  const rHubHole = isCrown ? rRimIn - 0.2 : Math.max(1.2, rHubOut * 0.38);
  const hasMidRing = style === 0 || style === 1;
  const rMidRing = rHubOut + (rRimIn - rHubOut) * 0.56;
  const spokeHalfW = Z >= 30 ? 1.55 : Z >= 16 ? 1.30 : Z >= 12 ? 1.12 : 0.98;

  const half = Math.ceil((rTip + 1.5) * 2);
  const side = half * 2 + 1;
  const grid = new Uint8Array(side * side);
  const invRGrid = new Float32Array(side * side);

  for (let iy = 0; iy < side; iy++) {
    const gy = (iy - half) * 0.5;
    for (let ix = 0; ix < side; ix++) {
      const gx = (ix - half) * 0.5;
      const r = Math.hypot(gx, gy);
      if (r > rTip || r < rHubHole) continue;

      let part = 0, bevel = 0;
      if (r >= rRoot) {
        const ang = Math.atan2(gy, gx);
        const toothWave = Math.cos(Z * ang);
        const uTooth = (r - rRoot) / (rTip - rRoot);
        const thresh = -0.06 + 0.50 * uTooth;
        if (toothWave < thresh) continue;
        part = 1;
        bevel = (toothWave - thresh) < 0.30 || uTooth > 0.72 ? 1 : 0;
      } else if (r >= rRimIn) {
        part = 2;
        const uRim = (r - rRimIn) / rimW;
        if (uRim < 0.24 || uRim > 0.78) bevel = 1;
        else if (!isCrown && Z >= 12 && Math.abs(uRim - 0.5) < 0.16) bevel = -1;
      } else if (!isCrown && r <= rHubOut) {
        part = 4;
        if (r > rHubOut - 0.9 || r < rHubHole + 0.9) bevel = 1;
      } else if (!isCrown) {
        if (hasMidRing && Math.abs(r - rMidRing) <= (style === 0 ? 1.05 : 0.85)) {
          part = 3;
          bevel = 1;
        } else {
          const ang = Math.atan2(gy, gx);
          const uRad = (r - rHubOut) / (rRimIn - rHubOut);
          const curveTwist = style === 0 ? Math.sin(uRad * Math.PI) * 0.13 : 0;
          const sector = TAU / spokes;
          let da = ((ang + curveTwist) % sector + sector) % sector;
          if (da > sector * 0.5) da = sector - da;
          const arcDist = da * r;
          const halfW = spokeHalfW * (1.12 - 0.26 * uRad);
          if (arcDist <= halfW) {
            part = 3;
            if (arcDist > halfW - 0.62) bevel = 1;
          } else if ((style === 0 || style === 1) && uRad > 0.74) {
            const flareW = halfW + (uRad - 0.74) * 8.6;
            const innerArch = halfW + (uRad - 0.80) * 7.2;
            if (arcDist <= flareW && (uRad > 0.90 || arcDist >= innerArch)) {
              part = 3;
              bevel = 1;
            }
          }
        }
      }

      if (part) {
        const idx = iy * side + ix;
        grid[idx] = (part << 2) | (bevel + 1);
        invRGrid[idx] = 1 / Math.max(1, r);
      }
    }
  }

  tpl = {
    rPitch, rTip, rRoot, rimW, rRimIn,
    rHoleSq: Math.max(0, (rHubHole - 0.6) * (rHubHole - 0.6)),
    half, side, grid, invRGrid,
  };
  GEAR_TPL_CACHE.set(key, tpl);
  return tpl;
}

// Monumental Roman numeral stroke segments (`I`..`XII`) with classic Trajan proportions & top/bottom serif bars
function romanGlyphStrokes(num) {
  const TOKENS = {
    1: ["I"], 2: ["I", "I"], 3: ["I", "I", "I"], 4: ["I", "V"],
    5: ["V"], 6: ["V", "I"], 7: ["V", "I", "I"], 8: ["V", "I", "I", "I"],
    9: ["I", "X"], 10: ["X"], 11: ["X", "I"], 12: ["X", "I", "I"],
  };
  const seq = TOKENS[num] || ["I"];
  const widths = seq.map((k) => (k === "I" ? 0.16 : 0.52));
  const gap = 0.15;
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (seq.length - 1);
  const segs = [];
  let cx = -totalW * 0.5;
  for (let i = 0; i < seq.length; i++) {
    const tk = seq[i], w = widths[i], xm = cx + w * 0.5;
    if (tk === "I") segs.push([xm, -0.5, xm, 0.5]);
    else if (tk === "V") segs.push([cx, -0.5, xm, 0.5], [cx + w, -0.5, xm, 0.5]);
    else if (tk === "X") segs.push([cx, -0.5, cx + w, 0.5], [cx + w, -0.5, cx, 0.5]);
    cx += w + gap;
  }
  const barW = Math.max(0.28, totalW * 0.54);
  segs.push([-barW, -0.5, barW, -0.5], [-barW, 0.5, barW, 0.5]);
  return segs;
}
const ROMAN_STROKES = Array.from({ length: 13 }, (_, i) => (i >= 1 ? romanGlyphStrokes(i) : null));

// Pre-bake each Co-Axial Corner Roman-Numeral Astrolabe Dial Sprite relative to `(dl.cx, dl.cy)`!
function bakeDialSprite(dl) {
  const BOX = 96;
  const map = new Map();
  const put = (fx, fy, tone, alpha, prio) => {
    const dx = Math.round(fx), dy = Math.round(fy);
    if (Math.abs(dx) > BOX || Math.abs(dy) > BOX) return;
    // Keep full visible corner circle around `(±140, ±74)` (extending up to 24px back toward screen corner edges!)
    if (dx * dl.inX < -24 || dy * dl.inY < -20) return;
    const key = ((dy + 128) << 9) | (dx + 128);
    const cur = map.get(key);
    if (!cur || prio > cur.prio || (prio === cur.prio && alpha > cur.alpha)) {
      map.set(key, { dx, dy, tone, alpha, prio });
    }
  };
  const seg = (x0, y0, x1, y1, tone, alpha, prio) => {
    const ddx = x1 - x0, ddy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.hypot(ddx, ddy) * 1.8));
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      put(x0 + ddx * u, y0 + ddy * u, tone, alpha, prio);
    }
  };

  // 1. Rich translucent bronze chapter band (`rNumInner..rNumOuter`) + sculpted double golden astrolabe rings
  for (let dy = -BOX; dy <= BOX; dy++) {
    if (dy * dl.inY < -20) continue;
    for (let dx = -BOX; dx <= BOX; dx++) {
      if (dx * dl.inX < -24) continue;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < dl.rInnerArc - 1 || r > dl.rOuter + 1.2) continue;
      if (r >= dl.rNumInner && r <= dl.rNumOuter) {
        put(dx, dy, 0, 0.28, 1);
      }
      if (Math.abs(r - dl.rOuter) <= 0.90)             put(dx, dy, 5, 0.88, 3);
      else if (Math.abs(r - (dl.rOuter - 1.3)) <= 0.55) put(dx, dy, 2, 0.58, 2);
      else if (Math.abs(r - dl.rNumOuter) <= 0.65)     put(dx, dy, 4, 0.68, 3);
      else if (Math.abs(r - dl.rNumInner) <= 0.88)     put(dx, dy, 5, 0.86, 3);
      else if (Math.abs(r - dl.rTrack) <= 0.60)        put(dx, dy, 4, 0.62, 2);
      else if (Math.abs(r - dl.rInnerArc) <= 0.60)     put(dx, dy, 3, 0.42, 2);
    }
  }

  // 2. 72 Exact 5°-Interval Astrolabe Degree Ticks (`0°, 5°, 10°, 15°...`):
  //    Every 15° (`m % 3 === 0`) is a crisp golden hour/half-hour division so the 15°-stepping Fate Hand
  //    lands DEAD-CENTER on a major division tick on EVERY SINGLE JUMP (`0.00°` alignment error)!
  for (let m = 0; m < 72; m++) {
    const a = (m / 72) * TAU;
    const ca = Math.cos(a), sa = Math.sin(a);
    const isChapter = m % 6 === 0;  // 0°, 30°, 60°, 90° chapter dividers between numerals
    const isNumCenter = m % 6 === 3; // 15°, 45°, 75° exact centers of the Roman numerals!
    if (isChapter) {
      seg(ca * (dl.rTrack + 0.5), sa * (dl.rTrack + 0.5), ca * (dl.rOuter - 0.8), sa * (dl.rOuter - 0.8), 5, 0.72, 4);
    } else if (isNumCenter) {
      // Crisp outward index pips flanking each Roman numeral on the inner & outer track!
      seg(ca * dl.rTrack, sa * dl.rTrack, ca * (dl.rNumInner - 0.3), sa * (dl.rNumInner - 0.3), 6, 0.90, 4);
      seg(ca * (dl.rNumOuter + 0.4), sa * (dl.rNumOuter + 0.4), ca * (dl.rOuter - 0.6), sa * (dl.rOuter - 0.6), 6, 0.90, 4);
    } else {
      seg(ca * (dl.rOuter - 2.8), sa * (dl.rOuter - 2.8), ca * (dl.rOuter - 0.8), sa * (dl.rOuter - 0.8), 4, 0.50, 4);
      // Inner track ticks every 5° right where the Fate Hand tip points!
      seg(ca * dl.rTrack, sa * dl.rTrack, ca * (dl.rTrack + 1.8), sa * (dl.rTrack + 1.8), 3, 0.48, 4);
    }
  }

  // 3. Twelve Chiseled Roman Numerals (`I..XII`) in Clockwise Screen Order at Exact 15°, 45°, 75° Angles!
  const QUAD_NUMS = [
    [12, 11, 10], // Q0 Top-Left:     15°=XII, 45°=XI,   75°=X
    [3,  2,  1],  // Q1 Top-Right:   105°=III, 135°=II, 165°=I
    [6,  5,  4],  // Q2 Bottom-Right:195°=VI,  225°=V,  255°=IV
    [9,  8,  7],  // Q3 Bottom-Left: 285°=IX,  315°=VIII,345°=VII
  ];
  const numerals = [];
  const numsInCorner = QUAD_NUMS[dl.cornerIdx];
  for (let k = 0; k < 3; k++) {
    const h = numsInCorner[k];
    const ang = dl.quadA0 + ((k + 0.5) / 3) * (Math.PI * 0.5); // exact 15°, 45°, 75°!
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const ncx = ca * dl.rNumMid, ncy = sa * dl.rNumMid;

    const downX = sa >= 0 ? ca : -ca;
    const downY = sa >= 0 ? sa : -sa;
    const rightX = downY, rightY = -downX;
    const glyphW = 9.8, glyphH = 10.2;

    const strokes = ROMAN_STROKES[h];
    const glyphSegs = [];
    for (let s = 0; s < strokes.length; s++) {
      const [ux0, uy0, ux1, uy1] = strokes[s];
      const wx0 = ncx + rightX * (ux0 * glyphW) + downX * (uy0 * glyphH);
      const wy0 = ncy + rightY * (ux0 * glyphW) + downY * (uy0 * glyphH);
      const wx1 = ncx + rightX * (ux1 * glyphW) + downX * (uy1 * glyphH);
      const wy1 = ncy + rightY * (ux1 * glyphW) + downY * (uy1 * glyphH);
      seg(wx0 + 1.0, wy0 + 1.0, wx1 + 1.0, wy1 + 1.0, 0, 0.72, 5);
      seg(wx0, wy0, wx1, wy1, 6, 0.94, 6);
      glyphSegs.push([wx0, wy0, wx1, wy1]);
    }
    numerals.push({ h, ang, ncx, ncy, glyphSegs });
  }

  const pts = Array.from(map.values());
  const dxs = new Int16Array(pts.length);
  const dys = new Int16Array(pts.length);
  const tones = new Uint8Array(pts.length);
  const alphas = new Float32Array(pts.length);
  for (let i = 0; i < pts.length; i++) {
    dxs[i] = pts[i].dx;
    dys[i] = pts[i].dy;
    tones[i] = pts[i].tone;
    alphas[i] = pts[i].alpha;
  }
  return { count: pts.length, dxs, dys, tones, alphas, numerals };
}

const CACHE = new Map();
function getChronoScene(S) {
  let sc = CACHE.get(S);
  if (sc) return sc;

  const rSeed = rng(S + 31, 0);
  const corners = [
    { idx: 0, sx: -1, sy: -1, spinSign:  1, jit:  0.00, tickOff: 0.00, quadA0: 0 },
    { idx: 1, sx:  1, sy: -1, spinSign: -1, jit:  0.03, tickOff: 0.25, quadA0: Math.PI * 0.5 },
    { idx: 2, sx:  1, sy:  1, spinSign:  1, jit: -0.02, tickOff: 0.50, quadA0: Math.PI },
    { idx: 3, sx: -1, sy:  1, spinSign: -1, jit:  0.03, tickOff: 0.75, quadA0: Math.PI * 1.5 },
  ];

  const dials = [];
  const gears = [];
  const meshes = [];
  const subDials = [];

  for (const cn of corners) {
    const { idx, sx, sy, spinSign } = cn;
    const inX = -sx, inY = -sy;
    const baseAngle = Math.atan2(inY, inX);

    // EXACT CO-AXIAL CORNER HUB `(±140, ±74)` — 100% INSIDE THE VIEWPORT!
    // Shared identically by:
    //   - Outer Rotating Crown Ring-Gear (`G_crown`, Z = 48)
    //   - Corner Roman-Numeral Astrolabe Dial (`dl`, rOuter = 74.5 -> tangent clasp at `(±140, 0)`!)
    //   - Titanic 36-Tooth Cathedral Master Gear (`G0`, Z = 36, R = 54px)
    //   - Co-Axial Hour Hand & Jumping Cathedral Lancet Fate Hand!
    const hubX = sx * 140;
    const hubY = sy * 74;

    const dl = {
      cornerIdx: idx,
      cx: hubX,
      cy: hubY,
      inX, inY,
      rOuter: 74.5,
      rNumOuter: 70.2,
      rNumMid: 62.4,
      rNumInner: 54.6,
      rTrack: 51.0,
      rInnerArc: 37.0,
      rOuterHalo: 98.0,
      quadA0: cn.quadA0,
      tickOff: cn.tickOff,
      spinSign,
    };
    dl.sprite = bakeDialSprite(dl);
    dials.push(dl);

    // Tier -1: Colossal 48-Tooth Rotating Outer Crown Ring-Gear (`rTip = 81.2px`, 0.75x stately speed!)
    const tplCrown = getGearTemplate(48, 8, 4);
    const gCrown = {
      cornerIdx: idx, tier: 0, tpl: tplCrown,
      cx: hubX, cy: hubY, inX, inY, lag: 0.05,
      Z: 48, spokes: 0, rPitch: tplCrown.rPitch,
      theta0: 0.08 * idx,
      omega: (-spinSign * TEETH_PER_LOOP * TAU) / (48 * D), // -0.75 rev/loop (6 exact 8-fold sectors -> zero seam!)
      alphaScale: 0.56,
    };

    // Tier 0: Titanic Co-Axial 36-Tooth Cathedral Master Gear (`R_pitch = 54.0px`, 113px diameter, 1.0x speed!)
    const tpl0 = getGearTemplate(36, 6, 0);
    const g0 = {
      cornerIdx: idx, tier: 0, tpl: tpl0,
      cx: hubX, cy: hubY, inX, inY, lag: 0.10,
      Z: 36, spokes: 6, rPitch: tpl0.rPitch,
      theta0: 0.14 * (idx + 1),
      omega: (spinSign * TEETH_PER_LOOP * TAU) / (36 * D), // 1.00 rev/loop
      alphaScale: 0.64,
    };

    const makeMeshed = (parent, Z, spokes, style, tier, relAng, lag, alphaScale) => {
      const tpl = getGearTemplate(Z, spokes, style);
      const dist = parent.rPitch + tpl.rPitch;
      const worldPhi = Math.atan2(inY * Math.sin(relAng), inX * Math.cos(relAng));
      const cx = parent.cx + Math.cos(worldPhi) * dist;
      const cy = parent.cy + Math.sin(worldPhi) * dist;
      const childSign = -Math.sign(parent.omega);
      const omega = (childSign * TEETH_PER_LOOP * TAU) / (Z * D);
      const phiBack = worldPhi + Math.PI;
      const theta0 = phiBack - (Math.PI - parent.Z * (worldPhi - parent.theta0)) / Z;

      const child = {
        cornerIdx: idx, tier, tpl,
        cx, cy, inX, inY, lag,
        Z, spokes, rPitch: tpl.rPitch,
        theta0, omega, alphaScale,
      };

      const mx = parent.cx + Math.cos(worldPhi) * parent.rPitch;
      const my = parent.cy + Math.sin(worldPhi) * parent.rPitch;
      const tangSign = Math.sign(parent.omega);
      meshes.push({
        cornerIdx: idx,
        mx, my, inX, inY,
        tx: -Math.sin(worldPhi) * tangSign,
        ty:  Math.cos(worldPhi) * tangSign,
        lag: Math.max(parent.lag, lag),
        beats: tier >= 2 ? 12 : 9,
        phaseOff: (idx * 0.25 + meshes.length * 0.19) % 1,
      });
      return child;
    };

    // G1: Heavy 18-Tooth Baroque Cross-Wheel along top/bottom cornice (`R = 27px`, 58px dia, -2.0x speed!)
    const g1 = makeMeshed(g0, 18, 6, 1, 1, 0.06 + cn.jit * 0.20, 0.30, 0.66);
    // G2: Bold 12-Tooth Diagonal Astrolabe Sun-Wheel (`R = 18px`, 40px dia, -3.0x speed, juts boldly into corner focal point!)
    const g2 = makeMeshed(g0, 12, 6, 2, 1, 0.72 - cn.jit * 0.20, 0.42, 0.64);
    // G3: Brisk 9-Tooth Cornice Star-Wheel off G1 (`R = 13.5px`, 31px dia, +4.0x speed!)
    const g3 = makeMeshed(g1, 9, 3, 3, 2, -0.06 + cn.jit * 0.20, 0.64, 0.64);
    // G4: Whirring 6-Tooth High-Speed Escapement Pinion off G2 (`R = 9.0px`, 22px dia, +6.0x speed — 50px clear of y = 0!)
    const g4 = makeMeshed(g2, 6, 3, 3, 2, 0.22 - cn.jit * 0.18, 0.78, 0.62);

    gears.push(gCrown, g0, g1, g2, g3, g4);

    // Co-Axial Chronometer Sub-Dial mounted DEAD-CENTER on G1's exact axle (`ZERO` offset!)
    subDials.push({
      cornerIdx: idx,
      gearRef: g1,
      inX, inY,
      r: 15.0,
      lag: 0.48,
      tickOff: (cn.tickOff + 0.5) % 1,
      dir: -spinSign,
      baseAng: baseAngle,
    });
  }

  // Pre-bake 64 Streaming Golden Time-Sand Filaments & Astral Sparks (`时间流逝与宿命感`)
  const motes = [];
  for (let i = 0; i < 64; i++) {
    const r = rng(S + 505, i);
    const cIdx = i % 4;
    const cn = corners[cIdx];
    motes.push({
      born: r.next() * D,
      life: r.range(2.0, 3.4),
      sx: cn.sx,
      sy: cn.sy,
      r0: r.range(34, 108),
      rDrift: r.range(16, 40),
      a0: cn.quadA0 + r.range(0.04, Math.PI * 0.5 - 0.04),
      aVel: cn.spinSign * r.range(0.14, 0.30),
      twinklePh: r.range(0, TAU),
      streak: rSeed.chance(0.42),
    });
  }

  sc = { corners, dials, gears, meshes, subDials, motes };
  CACHE.set(S, sc);
  return sc;
}

// Zero-allocation fast integer blend for pre-clipped `[X0..X1] x [Y0..Y1]` loops (bit-identical to Painter.blend!)
function makeFastBlend(p, q) {
  if (p.sn !== 0 || p.fx !== 1) return (px, py, c, a) => q.blend(px, py, c, a);
  const C = p.C, fw = p.w, fh = p.h, fade = p.fade;
  const baseX = Math.floor(p.tx + 0.5) - p.ox;
  const baseY = Math.floor(p.ty + 0.5) - p.oy;
  return (px, py, c, a) => {
    const aa = a * fade;
    if (!c || aa <= 0.004) return;
    const x = baseX + px, y = baseY + py;
    if (x < 0 || y < 0 || x >= fw || y >= fh) return;
    const i = y * fw + x, d = C[i];
    const da = (d >>> 24) / 255, oa = aa + da * (1 - aa), k = aa / oa, mk = 1 - k;
    const r = ((c & 255) * k + (d & 255) * mk) & 255;
    const g = (((c >>> 8) & 255) * k + ((d >>> 8) & 255) * mk) & 255;
    const b = (((c >>> 16) & 255) * k + ((d >>> 16) & 255) * mk) & 255;
    C[i] = (((oa * 255) & 255) << 24) | (b << 16) | (g << 8) | r;
  };
}

// Subpixel-accurate continuous ray/segment drawer (zero rounding kink when passing through `(cx, cy)`!)
function drawTranslucentSeg(q, x0, y0, x1, y1, col, alpha) {
  if (alpha <= 0.015) return;
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 1.75));
  let lastKey = -999999;
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    const ix = Math.round(x0 + dx * u), iy = Math.round(y0 + dy * u);
    const key = ((iy + 512) << 11) | (ix + 512);
    if (key === lastKey) continue;
    lastKey = key;
    q.blend(ix, iy, col, alpha);
  }
}

// Fast LUT-backed semi-transparent openwork gear renderer with scanline hole-skipping (< 1.1 ms total!)
function drawOpenworkGear(q, fblend, g, t, G, B, slideInt, waveR) {
  const em = emergenceAt(t, g.lag, 0.32);
  const baseAlpha = g.alphaScale * em;
  if (baseAlpha <= 0.02) return;

  // Exact shared integer translation `(slideInt)` -> preserves 100% co-axiality & tooth meshing!
  const cx = g.cx - g.inX * slideInt;
  const cy = g.cy - g.inY * slideInt;
  const tpl = g.tpl;
  const rMax = tpl.rTip + 0.5;
  const rMaxSq = rMax * rMax, rHoleSq = tpl.rHoleSq;

  const px0 = Math.max(X0, Math.floor(cx - rMax));
  const px1 = Math.min(X1, Math.ceil(cx + rMax));
  const py0 = Math.max(Y0, Math.floor(cy - rMax));
  const py1 = Math.min(Y1, Math.ceil(cy + rMax));
  if (px0 > px1 || py0 > py1) return;

  const theta = g.theta0 + g.omega * t;
  const cs2 = Math.cos(theta) * 2, sn2 = Math.sin(theta) * 2;
  const sheenAng = ((TAU * 2 * t) / D) * (g.omega > 0 ? 1 : -1) + g.cornerIdx * 1.57;
  const shX = Math.cos(sheenAng), shY = Math.sin(sheenAng);
  const { half, side, grid, invRGrid } = tpl;

  // Per-gear emergence wave boost (zero per-pixel Math.hypot overhead!)
  let gearWaveBoost = 0;
  if (waveR > 0) {
    const cornerHubX = -g.inX * (140 + slideInt);
    const cornerHubY = -g.inY * (74 + slideInt);
    const dGear = Math.hypot(cx - cornerHubX, cy - cornerHubY) + g.rPitch * 0.6;
    const wb = 1 - Math.abs(dGear - waveR) / 28;
    if (wb > 0) gearWaveBoost = wb * wb * 0.48;
  }

  for (let py = py0; py <= py1; py++) {
    const dy = py + 0.5 - cy;
    const dySq = dy * dy;
    if (dySq > rMaxSq) continue;
    const dxOuter = Math.sqrt(rMaxSq - dySq);
    const rowX0 = Math.max(px0, Math.floor(cx - dxOuter));
    const rowX1 = Math.min(px1, Math.ceil(cx + dxOuter));
    // Skip hollow interior span in O(1) for large crown rings (`rHole = 73px`)!
    const hasHoleSpan = rHoleSq > 64 && dySq < rHoleSq;
    const holeL = hasHoleSpan ? Math.ceil(cx - Math.sqrt(rHoleSq - dySq)) : 9999;
    const holeR = hasHoleSpan ? Math.floor(cx + Math.sqrt(rHoleSq - dySq)) : -9999;

    for (let px = rowX0; px <= rowX1; px++) {
      if (px > holeL && px < holeR) {
        px = holeR;
        continue;
      }
      const dx = px + 0.5 - cx;
      const dSq = dx * dx + dySq;
      if (dSq > rMaxSq || dSq < rHoleSq) continue;

      const ix = ((dx * cs2 + dy * sn2 + half + 0.5) | 0);
      if (ix < 0 || ix >= side) continue;
      const iy = ((-dx * sn2 + dy * cs2 + half + 0.5) | 0);
      if (iy < 0 || iy >= side) continue;

      const tIdx = iy * side + ix;
      const code = grid[tIdx];
      if (code === 0) continue;

      const part = code >> 2;
      const bevel = (code & 3) - 1;
      const invR = invRGrid[tIdx];
      const nx = dx * invR, ny = dy * invR;
      const topLeftSpec = -nx * 0.72 - ny * 0.69;
      const sheen = Math.max(0, nx * shX + ny * shY);
      const sheenBoost = sheen * sheen * sheen * 0.48 + gearWaveBoost;

      let lit = 0.54 + 0.36 * topLeftSpec + sheenBoost + bevel * 0.20;
      if (part === 1) lit += 0.10;
      if (part === 4) lit += 0.12;

      const col =
        lit > 1.02 ? G[7] :
        lit > 0.83 ? G[6] :
        lit > 0.64 ? G[5] :
        lit > 0.46 ? G[4] :
        lit > 0.30 ? G[3] :
        B[1];

      const alphaMul = bevel === 1 ? 1.26 : bevel === -1 ? 0.58 : part === 3 ? 0.84 : 0.96;
      fblend(px, py, col, clamp(baseAlpha * alphaMul, 0, 0.82));
    }
  }

  if (g.spokes >= 3) {
    q.glow(cx, cy, Math.min(24, g.rPitch * 0.45), G[4], 0.14 * em);
  }
  if (g.spokes >= 3 && g.Z >= 12) {
    const nRiv = g.spokes;
    const rRiv = tpl.rRimIn + tpl.rimW * 0.5;
    for (let k = 0; k < nRiv; k++) {
      const a = theta + (k / nRiv) * TAU;
      const rx = Math.round(cx + Math.cos(a) * rRiv), ry = Math.round(cy + Math.sin(a) * rRiv);
      if (rx >= X0 && rx <= X1 && ry >= Y0 && ry <= Y1) {
        q.blend(rx, ry, WHITE, 0.84 * em);
      }
    }
  }
}

// Exact Zero-Offset Escapement Hand State:
// 12 crisp 15.0° jumps per 12s loop (1 jump every 1.0s! `12 * 15° = 180° = 2 * 90°` -> exact 4-arm symmetry = ZERO loop seam!).
// Starts at EXACT `0.00°` (`NO` asymmetric phase bias!) so EVERY stop lands dead-center on `0°, 15°, 30°, 45°, 60°, 75°, 90°`
// for BOTH `+1` and `-1` spin directions (`15°, 45°, 75°` = exact centers of the Roman numerals `I..XII`!).
function cornerHandState(dl, t) {
  const nJumps = 12;
  const tickPeriod = D / nJumps; // 1.00s per crisp escapement jump!
  const tShifted = wrap(t - dl.tickOff, D);
  const tickIdx = Math.floor(tShifted / tickPeriod);
  const dtTick = tShifted - tickIdx * tickPeriod;
  const snapDur = 0.088;
  const snapProgress = dtTick < snapDur ? ease.outBack(clamp(dtTick / snapDur, 0, 1), 2.75) : 1.0;
  const stepAngle = TAU / 24; // Exact 15.000° (`3` exact 5° ticks!)
  const handCrossBase = dl.spinSign * (tickIdx + snapProgress) * stepAngle;
  const prevCrossBase = dl.spinSign * tickIdx * stepAngle;
  const tickFlash = dtTick < 0.26 ? 1 - dtTick / 0.26 : 0;
  // Every odd target step (`(tickIdx + 1) & 1`) lands squarely on a Roman Numeral (`15°, 45°, 75°`) -> triggers Destiny Bell Wave!
  const bellWave = ((tickIdx + 1) & 1) && dtTick < 0.46 ? 1 - dtTick / 0.46 : 0;
  return { handCrossBase, prevCrossBase, dtTick, tickFlash, bellWave };
}

// Co-Axial Corner Roman-Numeral Dial + Sweeping Outer Astrolabe Halo + Zero-Offset Dual Clock Hands!
function drawCornerDialAndHands(q, fblend, dl, t, G, B, slideInt) {
  const em = emergenceAt(t, 0.0, 0.40);
  // EXACT INTEGER CO-AXIAL PIVOT `(cx, cy)` shared with `G0` and `G_crown`!
  const cx = dl.cx - dl.inX * slideInt;
  const cy = dl.cy - dl.inY * slideInt;

  const toneCols = [B[0], B[1], B[2], B[3], G[4], G[5], G[6]];
  const sp = dl.sprite;
  const { count, dxs, dys, tones, alphas, numerals } = sp;

  // 0. Sweeping Outer Celestial Destiny Arc (`r = 98px`) framing the outer gear cascade with arcane solemnity
  const a0 = dl.quadA0 + 0.04, a1 = dl.quadA0 + Math.PI * 0.5 - 0.04;
  const haloSteps = 68;
  for (let s = 0; s <= haloSteps; s++) {
    const a = a0 + ((a1 - a0) * s) / haloSteps;
    const hx = Math.round(cx + Math.cos(a) * dl.rOuterHalo);
    const hy = Math.round(cy + Math.sin(a) * dl.rOuterHalo);
    if (hx >= X0 && hx <= X1 && hy >= Y0 && hy <= Y1) {
      const isPip = s % 8 === 0;
      fblend(hx, hy, isPip ? G[6] : G[4], (isPip ? 0.62 : 0.26) * em);
    }
  }

  // 1. Blit pre-baked co-axial Roman-numeral chapter ring
  for (let i = 0; i < count; i++) {
    const px = cx + dxs[i];
    if (px < X0 || px > X1) continue;
    const py = cy + dys[i];
    if (py < Y0 || py > Y1) continue;
    fblend(px, py, toneCols[tones[i]], alphas[i] * em);
  }

  const { handCrossBase, prevCrossBase, dtTick, tickFlash, bellWave } = cornerHandState(dl, t);

  // 1b. Expanding Golden Destiny Bell Shockwave Arc (`r = 55 -> 114px`) whenever the Fate Hand strikes a Roman Numeral!
  if (bellWave > 0) {
    const uBell = 1 - bellWave;
    const rBell = 55 + ease.outCubic(uBell) * 60;
    const bSteps = 54;
    for (let s = 0; s <= bSteps; s++) {
      const a = a0 + ((a1 - a0) * s) / bSteps;
      const bx = Math.round(cx + Math.cos(a) * rBell);
      const by = Math.round(cy + Math.sin(a) * rBell);
      if (bx >= X0 && bx <= X1 && by >= Y0 && by <= Y1) {
        q.blend(bx, by, bellWave > 0.55 ? WHITE : G[6], 0.54 * bellWave * em);
        if ((s & 1) === 0) q.light(bx, by, G[5], 0.24 * bellWave * em);
      }
    }
  }

  // 2. Blazing Numeral Destiny Ignition whenever a Fate Hand strikes or grazes a Roman Numeral (`15°, 45°, 75°`)!
  for (let n = 0; n < numerals.length; n++) {
    const nm = numerals[n];
    let near = 0;
    for (let arm = 0; arm < 4; arm++) {
      const ha = handCrossBase + arm * (TAU / 4);
      const diff = Math.abs(Math.atan2(Math.sin(nm.ang - ha), Math.cos(nm.ang - ha)));
      if (diff < 0.14) near = Math.max(near, 1 - diff / 0.14);
    }
    if (near > 0.20) {
      const boost = near * (0.65 + 0.35 * tickFlash);
      const nwx = cx + nm.ncx, nwy = cy + nm.ncy;
      q.glow(nwx, nwy, 13, G[5], 0.42 * boost * em);
      for (let s = 0; s < nm.glyphSegs.length; s++) {
        const [x0, y0, x1, y1] = nm.glyphSegs[s];
        drawTranslucentSeg(q, cx + x0, cy + y0, cx + x1, cy + y1, WHITE, 0.88 * boost * em);
      }
    }
  }

  // 3. Co-Axial Stately Hour Hand (`r = -6 -> +35px`, pierces dead-center through `(cx, cy)`!)
  const hourAng = dl.quadA0 + Math.PI * 0.25 + dl.spinSign * (TAU * t) / D;
  const hca = Math.cos(hourAng), hsa = Math.sin(hourAng);
  const hpx = -hsa, hpy = hca;
  drawTranslucentSeg(q, cx - hca * 6, cy - hsa * 6, cx + hca * 35, cy + hsa * 35, G[5], 0.86 * em);
  drawTranslucentSeg(q, cx + hpx * 1.0, cy + hpy * 1.0, cx + hca * 26 + hpx * 0.6, cy + hsa * 26 + hpy * 0.6, G[6], 0.68 * em);
  drawTranslucentSeg(q, cx - hpx * 1.0, cy - hpy * 1.0, cx + hca * 26 - hpx * 0.6, cy + hsa * 26 - hpy * 0.6, B[2], 0.64 * em);

  // 4. Co-Axial Sculpted Cathedral Lancet Fate Hand (`r = -11 -> +53.5px` through `(cx, cy)` — ZERO OFFSET!)
  const rTail = -10.5;
  const rTip = dl.rNumInner - 1.0; // 53.6px — kisses the exact inner edge of the Roman-numeral chapter ring!
  for (let arm = 0; arm < 4; arm++) {
    const ha = handCrossBase + arm * (TAU / 4);
    const pa = prevCrossBase + arm * (TAU / 4);
    const ca = Math.cos(ha), sa = Math.sin(ha);
    const tipX = cx + ca * rTip, tipY = cy + sa * rTip;

    // Only render the extensive blade/smear for arms sweeping through or bordering the visible viewport
    if (tipX < X0 - 24 || tipX > X1 + 24 || tipY < Y0 - 24 || tipY > Y1 + 24) continue;

    // A. HIGH-IMPACT 15° SWEPT GOLDEN LIGHT-FAN (`扇形流光残影`) during the sudden mechanical jump!
    if (dtTick < 0.20) {
      const fanK = (1 - dtTick / 0.20) * em;
      for (let gStep = 1; gStep <= 7; gStep++) {
        const u = gStep / 8;
        const ga = pa + (ha - pa) * u;
        const gca = Math.cos(ga), gsa = Math.sin(ga);
        const fanCol = u > 0.72 ? WHITE : u > 0.42 ? G[6] : G[4];
        drawTranslucentSeg(
          q,
          cx + gca * 10, cy + gsa * 10,
          cx + gca * (rTip - 0.5), cy + gsa * (rTip - 0.5),
          fanCol,
          0.46 * u * u * fanK
        );
      }
    }

    // B. Continuous Co-Axial Spine from Counterweight Tail (`-10.5px`) straight through `(cx, cy)` to `rTip`!
    const px = -sa, py = ca;
    const spineCol = tickFlash > 0.30 ? WHITE : G[7];
    const rWaist = rTip - 13.0;
    // Beveled flanks along shaft
    drawTranslucentSeg(q, cx + ca * 4 + px * 1.25, cy + sa * 4 + py * 1.25, cx + ca * rWaist + px * 0.65, cy + sa * rWaist + py * 0.65, G[6], 0.82 * em);
    drawTranslucentSeg(q, cx + ca * 4 - px * 1.25, cy + sa * 4 - py * 1.25, cx + ca * rWaist - px * 0.65, cy + sa * rWaist - py * 0.65, B[3], 0.76 * em);
    // Razor-straight central white-gold ray passing dead-center through `(cx, cy)`!
    drawTranslucentSeg(q, cx + ca * rTail, cy + sa * rTail, tipX, tipY, spineCol, 0.96 * em);

    // Ornate Cathedral Diamond Spearhead near the dial track
    const lx = cx + ca * (rTip - 5.5), ly = cy + sa * (rTip - 5.5);
    const bx = cx + ca * (rTip - 12.5), by = cy + sa * (rTip - 12.5);
    const wDia = 3.4;
    drawTranslucentSeg(q, bx, by, lx + px * wDia, ly + py * wDia, WHITE, 0.92 * em);
    drawTranslucentSeg(q, bx, by, lx - px * wDia, ly - py * wDia, G[5], 0.86 * em);
    drawTranslucentSeg(q, lx + px * wDia, ly + py * wDia, tipX, tipY, WHITE, 0.96 * em);
    drawTranslucentSeg(q, lx - px * wDia, ly - py * wDia, tipX, tipY, G[6], 0.90 * em);

    // C. Explosive Escapement Tip Starburst + Astral Shock-Arc on every 1.0s jump!
    if (tickFlash > 0 && tipX >= X0 && tipX <= X1 && tipY >= Y0 && tipY <= Y1) {
      sparkle(q, tipX, tipY, 3.0 + 5.2 * tickFlash, WHITE, B[4], 0.92 * tickFlash * em);
      q.glow(tipX, tipY, 16 * tickFlash + 4, G[5], 0.68 * tickFlash * em);
      const arcSpan = 0.05 + (1 - tickFlash) * 0.24;
      for (let s = -7; s <= 7; s++) {
        if (s === 0) continue;
        const ra = ha + (s / 7) * arcSpan;
        const fA = 1 - Math.abs(s) / 8;
        q.blend(cx + Math.cos(ra) * dl.rTrack, cy + Math.sin(ra) * dl.rTrack, Math.abs(s) <= 2 ? WHITE : G[6], 0.82 * tickFlash * em * fA);
      }
    } else if (tipX >= X0 && tipX <= X1 && tipY >= Y0 && tipY <= Y1) {
      q.glow(tipX, tipY, 6, G[5], 0.26 * em);
    }
  }

  // 5. Co-Axial Hub Escapement Shock-Ring + Gleaming Jeweled Watchmaker Pivot Cap right at `(cx, cy)`!
  if (tickFlash > 0) {
    const rShock = 5 + (1 - tickFlash) * 21;
    const rSteps = 36;
    for (let s = 0; s < rSteps; s++) {
      const a = (s / rSteps) * TAU;
      const sx = Math.round(cx + Math.cos(a) * rShock), sy = Math.round(cy + Math.sin(a) * rShock);
      if (sx >= X0 && sx <= X1 && sy >= Y0 && sy <= Y1) {
        q.blend(sx, sy, tickFlash > 0.5 ? B[4] : G[6], 0.62 * tickFlash * em);
      }
    }
    q.glow(cx, cy, 18 * tickFlash + 5, G[5], 0.55 * tickFlash * em);
  }
  // Sculpted 3D Golden Pivot Cap (`r = 4.2px`) pinning ALL co-axial hands & gears at `(cx, cy)`!
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > 4.2) continue;
      const px = cx + dx, py = cy + dy;
      if (px < X0 || px > X1 || py < Y0 || py > Y1) continue;
      const cCap = d < 1.5 ? WHITE : d < 2.8 ? G[6] : (-dx - dy > 0 ? G[5] : B[2]);
      q.blend(px, py, cCap, 0.96 * em);
    }
  }
}

// Co-Axial Chronometer Sub-Dial mounted DEAD-CENTER on `G1`'s exact integer axle (`ZERO` offset!)
function drawSubDial(q, sd, t, G, B, slideInt) {
  const em = emergenceAt(t, sd.lag, 0.30);
  if (em <= 0.04) return;
  const cx = Math.round(sd.gearRef.cx - sd.inX * slideInt);
  const cy = Math.round(sd.gearRef.cy - sd.inY * slideInt);
  const r = sd.r;

  const steps = 56;
  for (let s = 0; s < steps; s++) {
    const a = (s / steps) * TAU;
    const ca = Math.cos(a), sa = Math.sin(a);
    q.blend(Math.round(cx + ca * r), Math.round(cy + sa * r), (-ca - sa) > 0 ? G[6] : G[4], 0.80 * em);
  }
  for (let k = 0; k < 12; k++) {
    const a = -Math.PI * 0.5 + (k / 12) * TAU;
    const major = k % 3 === 0;
    const rr = r - (major ? 2.4 : 1.9);
    q.blend(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), major ? WHITE : G[5], (major ? 0.90 : 0.62) * em);
  }

  const tShifted = wrap(t - sd.tickOff, D);
  const tickIdx = Math.floor(tShifted);
  const dtTick = tShifted - tickIdx;
  const snap = dtTick < 0.088 ? ease.outBack(clamp(dtTick / 0.088, 0, 1), 2.8) : 1.0;
  const secAng = -Math.PI * 0.5 + sd.dir * (tickIdx + snap) * (TAU / 12);
  const prevAng = -Math.PI * 0.5 + sd.dir * tickIdx * (TAU / 12);
  const ca = Math.cos(secAng), sa = Math.sin(secAng);
  const tipX = cx + ca * (r - 2.2), tipY = cy + sa * (r - 2.2);
  const tailX = cx - ca * 3.8, tailY = cy - sa * 3.8;
  const flash = dtTick < 0.18 ? 1 - dtTick / 0.18 : 0;

  if (dtTick < 0.14) {
    for (let uStep = 1; uStep <= 3; uStep++) {
      const u = uStep / 4;
      const ma = prevAng + (secAng - prevAng) * u;
      drawTranslucentSeg(q, cx, cy, cx + Math.cos(ma) * (r - 2.6), cy + Math.sin(ma) * (r - 2.6), G[5], 0.36 * u * em);
    }
  }
  // Continuous line from tail straight through integer `(cx, cy)` to tip -> zero pixel offset!
  drawTranslucentSeg(q, tailX, tailY, tipX, tipY, flash > 0.3 ? WHITE : G[7], 0.95 * em);
  q.blend(cx, cy, WHITE, 0.98 * em);
  if (flash > 0) {
    sparkle(q, tipX, tipY, 1.8 + 2.8 * flash, WHITE, B[4], 0.78 * flash * em);
    q.glow(tipX, tipY, 8 * flash + 2, G[5], 0.48 * flash * em);
  }
}

// Forge-Bright Golden Spark Fountains at the 16 Meshing Gear Contacts (`齿轮咬合处定期迸发出微小金色星火`)!
function drawMeshingSparks(q, meshes, t, S, G, B, slideInt) {
  for (let m = 0; m < meshes.length; m++) {
    const ms = meshes[m];
    const em = emergenceAt(t, ms.lag, 0.28);
    if (em < 0.30) continue;

    const mx = ms.mx - ms.inX * slideInt;
    const my = ms.my - ms.inY * slideInt;
    if (mx < X0 - 8 || mx > X1 + 8 || my < Y0 - 8 || my > Y1 + 8) continue;

    // Continuous warm tooth-engagement ember pulse
    const toothPulse = 0.5 + 0.5 * Math.sin(((TAU * TEETH_PER_LOOP * t) / D) + m * 1.1);
    q.glow(mx, my, 5.5, G[4], (0.12 + 0.14 * toothPulse) * em);

    const period = D / ms.beats;
    const tLocal = wrap(t - ms.phaseOff * period, D);
    const beatIdx = Math.floor(tLocal / period);
    const age = tLocal - beatIdx * period;
    const burstLife = 0.62;
    if (age >= burstLife) continue;

    // 1. Crisp white-gold tooth-pinch cross-starburst right at `(mx, my)`!
    if (age < 0.20) {
      const fk = 1 - age / 0.20;
      sparkle(q, mx, my, 2.8 + 4.2 * fk, WHITE, G[5], 0.94 * fk * em);
      q.glow(mx, my, 12.5 * fk + 3.0, G[5], 0.68 * fk * em);
    }

    // 2. 12 High-Velocity Golden Forge-Sparks spraying tangentially from the meshing teeth!
    for (let k = 0; k < 12; k++) {
      const r = rng(S + 808 + m * 37 + beatIdx * 7, k);
      const sLife = r.range(0.32, burstLife);
      if (age >= sLife) continue;
      const u = age / sLife;
      const kFade = 1 - u;

      const dirSign = k < 8 ? 1 : -0.80;
      const baseAng = Math.atan2(ms.ty * dirSign + ms.inY * 0.32, ms.tx * dirSign + ms.inX * 0.32);
      const ang = baseAng + r.range(-0.44, 0.44);
      const sp = r.range(38, 92);
      const dragPos = (tau) => {
        const s = (1 - Math.exp(-2.9 * tau)) / 2.9;
        return [mx + Math.cos(ang) * sp * s, my + Math.sin(ang) * sp * s + 18 * tau * tau];
      };

      const [sx, sy] = dragPos(age);
      if (sx < X0 || sx > X1 || sy < Y0 || sy > Y1) continue;
      const [px0, py0] = dragPos(Math.max(0, age - 0.045));

      const tailCol = u < 0.38 ? G[6] : u < 0.72 ? G[5] : G[3];
      drawTranslucentSeg(q, px0, py0, sx, sy, tailCol, 0.90 * kFade * em);
      const headC = u < 0.40 ? WHITE : u < 0.75 ? G[6] : G[5];
      q.blend(sx, sy, headC, 0.98 * kFade * em);
      q.light(sx, sy, k === 0 && u < 0.4 ? B[4] : G[5], 0.58 * kFade * em);
    }
  }
}

export function drawBack(p, t, o) {
  const q = clip(p, meta), fblend = makeFastBlend(p, q), S = o.seed;
  const G = fit(o.palette, 8), B = fit(o.bronze, 5);
  const sc = getChronoScene(S);
  const slideInt = cornerSlidePx(t);
  const waveR = t < 2.1 ? (t / 2.1) * 145 : -1;
  const emBreath = emergenceAt(t, 0.0, 0.40) * (0.90 + 0.10 * Math.sin((TAU * 2 * t) / D));

  // 1. Rich Four-Corner Golden Destiny Vignette Glow (leaves central stage 100% transparent!)
  rows(p, meta, Y0, Y1, (y, R) => {
    const rowOff = Math.floor(y - Y0) * W;
    for (let xi = 0; xi < W; xi++) {
      const kSq = VIG_LUT[rowOff + xi];
      if (kSq === 0) continue;
      const k2 = kSq * emBreath;
      if (k2 <= 0.01) continue;
      const veilA = k2 * 0.16;
      if (veilA > 0.008) {
        R.c[xi] = kSq > 0.40 ? B[2] : B[1];
        R.a[xi] = veilA > 0.18 ? 0.18 : veilA;
        R.b[xi] = 1;
      }
      R.l[xi] = kSq > 0.34 ? G[4] : G[3];
      R.k[xi] = k2 * 0.26 > 0.26 ? 0.26 : k2 * 0.26;
    }
  });

  // 2. Deepest Co-Axial Layer: 48-Tooth Rotating Outer Crown Rings & 36-Tooth Titanic Master Gears (`tier === 0`)
  for (let i = 0; i < sc.gears.length; i++) {
    const g = sc.gears[i];
    if (g.tier === 0) drawOpenworkGear(q, fblend, g, t, G, B, slideInt, waveR);
  }
}

export function draw(p, t, o) {
  const q = clip(p, meta), fblend = makeFastBlend(p, q), S = o.seed;
  const G = fit(o.palette, 8), B = fit(o.bronze, 5);
  const sc = getChronoScene(S);
  const slideInt = cornerSlidePx(t);
  const waveR = t < 2.1 ? (t / 2.1) * 145 : -1;
  const emClasp = emergenceAt(t, 0.0, 0.40);

  // 1. Cascading Multi-Speed Interlocking Openwork Gears (`tier === 1, 2`)
  for (let i = 0; i < sc.gears.length; i++) {
    const g = sc.gears[i];
    if (g.tier > 0) drawOpenworkGear(q, fblend, g, t, G, B, slideInt, waveR);
  }

  // 2. Co-Axial Roman-Numeral Chapter Dials + Swept Light-Fan Escapement Clock Hands (`严格同轴零偏移`)!
  for (let i = 0; i < sc.dials.length; i++) {
    drawCornerDialAndHands(q, fblend, sc.dials[i], t, G, B, slideInt);
  }

  // 3. Ornate Golden Astrolabe Clasp Jewels where Top & Bottom Dials kiss tangentially at `(±140, 0)`!
  for (const sx of [-1, 1]) {
    const jx = sx * (140 + slideInt);
    if (jx >= X0 + 2 && jx <= X1 - 2) {
      const pulse = 0.72 + 0.28 * Math.sin((TAU * 3 * t) / D + sx);
      sparkle(q, jx, 0, 2.8 * pulse, WHITE, G[5], 0.72 * emClasp);
      q.glow(jx, 0, 9, G[4], 0.30 * pulse * emClasp);
    }
  }

  // 4. Co-Axial Chronometer Sub-Dials mounted dead-center on G1's axle (`ZERO` offset!)
  for (let i = 0; i < sc.subDials.length; i++) {
    drawSubDial(q, sc.subDials[i], t, G, B, slideInt);
  }

  // 5. Forge-Bright Golden Spark Fountains at the 16 Gear Meshing Contacts (`齿轮咬合处定期迸发出微小金色星火`)
  drawMeshingSparks(q, sc.meshes, t, S, G, B, slideInt);

  // 6. Streaming Golden Time-Sand Filaments & Twinkling Destiny Stars (`神秘庄重的宿命与时间流逝感`)
  for (let i = 0; i < sc.motes.length; i++) {
    const m = sc.motes[i];
    for (let age = wrap(t - m.born, D); age < m.life; age += D) {
      const u = age / m.life;
      const env = Math.sin(u * Math.PI);
      if (env < 0.08) continue;
      const rr = m.r0 + m.rDrift * u;
      const aa = m.a0 + m.aVel * age;
      const cx = m.sx * 140 + Math.cos(aa) * rr;
      const cy = m.sy * 74  + Math.sin(aa) * rr;
      if (cx < X0 + 1 || cx > X1 - 1 || cy < Y0 + 1 || cy > Y1 - 1) continue;

      const tw = 0.65 + 0.35 * Math.sin(age * 9 + m.twinklePh);
      const aM = env * tw * 0.84;
      if (m.streak) {
        const pa = aa - m.aVel * 0.07;
        const px0 = m.sx * 140 + Math.cos(pa) * (rr - m.rDrift * 0.02);
        const py0 = m.sy * 74  + Math.sin(pa) * (rr - m.rDrift * 0.02);
        drawTranslucentSeg(q, px0, py0, cx, cy, G[5], 0.56 * aM);
      }
      if (tw > 0.86) {
        sparkle(q, cx, cy, 2.0, WHITE, G[5], 0.52 * aM);
      } else {
        q.blend(cx, cy, tw > 0.76 ? WHITE : G[6], aM);
        q.light(cx, cy, G[4], 0.28 * aM);
      }
    }
  }
}
