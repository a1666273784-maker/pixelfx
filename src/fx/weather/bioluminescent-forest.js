// Bioluminescent Forest (荧光森林环境变化 — weather/bioluminescent-forest):
// 1. Unhurried Dusk-to-Night Transition: Soft amber-rose & slate-teal woodland twilight dims gradually over ~5.3s
//    through misty violet blue-hour into tranquil midnight indigo, then eases back over ~3.4s for a seamless 12s loop.
// 2. Realistic Botanical Mushroom Colonies & Bark-Coiling Woody Vines: Four authentic woodland fungal forms
//    (umbo parasols with annulus rings, tall conical Mycena fairy-bells, decurrent-gill funnel chanterelles, and
//    overlapping bark oyster clusters — all with crisp radial dark/lit gill lamellae, moist dew gloss, subsurface
//    rim translucency, curved tapered stipes, and natural multi-cap tufts) plus 3D trunk-coiling & nurse-log woody
//    vines awaken sequentially from foreground to distant horizon in calm 6-second breathing cyan & violet waves.
// 3. Serene Mid-Air Life: Weightless glowing dandelion pappus seeds drift lazily on gentle air currents while three
//    cohesive firefly swarms weave calmly through the glade.
import { fit, clamp, smooth, mix, rand, TAU, WHITE, hex, loopNoise } from "../../core/index.js";
import { clip, rows, field, sample } from "./_lib.js";

export const meta = {
  name: "Bioluminescent forest",
  desc: "Woodland dusk slowly deepens into night as 3D mushroom colonies and trunk vines wake from near to far in breathing cyan and violet light amid dandelion fluff and fireflies.",
  tags: ["weather", "nature", "forest", "bioluminescent", "mushroom", "vine", "fireflies", "dandelion", "night", "ambient", "loop"],
  size: [320, 180],
  origin: [160, 170],
  duration: 12,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    // 7-step Ghostly Neon Cyan-Blue bioluminescence ramp (primary recolorable palette)
    palette: ["#041826", "#083854", "#0e7298", "#1ec6e0", "#5af6ff", "#bafdff", "#f4ffff"],
    // 7-step Neon Violet-Purple bioluminescence ramp
    violet:  ["#150628", "#320f59", "#621da8", "#9a38eb", "#cf74ff", "#efc6ff", "#fdf5ff"],
    // 6-step Swarming Firefly warm chartreuse-gold ramp
    firefly: ["#23330b", "#557d15", "#9de32b", "#e2ff69", "#f8ffca", "#ffffff"],
    // 8-step Forest Dusk-to-Midnight foliage, bark & moss ramp
    forest:  ["#04070e", "#08101c", "#0f1d2c", "#182f3a", "#284848", "#456854", "#739164", "#c79e72"],
    seed: 7,
  },
};

const D = 12, W = 320, H = 180, X0 = -160, Y0 = -170;
const cyc = (t, n, ph = 0) => (TAU * n * t) / D + ph;

// Unhurried C1-continuous twilight -> blue-hour -> midnight -> pre-dusk envelope:
// Dims gradually over 5.3s (u = 0.00..0.44), holds tranquil night (0.44..0.72), and eases back over 3.4s (0.72..1.00).
function nightEnv(t) {
  const u = (((t % D) + D) % D) / D;
  if (u < 0.44) return 0.5 - 0.5 * Math.cos(Math.PI * (u / 0.44));
  if (u < 0.72) return 1;
  return 0.5 + 0.5 * Math.cos(Math.PI * ((u - 0.72) / 0.28));
}

// Slow sequential near-to-far awakening + calm 6-second breathing-LED wave for depth z in [0..1]
function bioBreath(t, z, ph) {
  const u = (((t % D) + D) % D) / D;
  const wakeStart = 0.15 + z * 0.27; // foreground stirs ~1.8s, far horizon wakes ~5.0s
  const wake = smooth(wakeStart, wakeStart + 0.16, u) * (1 - smooth(0.71 + z * 0.03, 0.95 + z * 0.03, u));
  if (wake <= 0.002) return 0;
  // Calm 2-cycle/12s (6s period) breathing wave propagating cleanly from foreground to deep woods
  const s = 0.5 + 0.5 * Math.sin(cyc(t, 2, -z * 3.2 + ph * 0.32));
  const led = s * s * (3 - 2 * s);
  return wake * (0.25 + 0.75 * led);
}

const pathCenterX = (layer) => [8, -22, 16, -12, -4][layer] ?? 0;

function groundYAt(x, layer, S) {
  const base = [2, -12, -28, -45, -61][layer];
  const pc = pathCenterX(layer);
  const dipW = [4600, 3800, 3200, 2600, 2200][layer];
  const dipAmp = [8.0, 6.2, 4.8, 3.4, 2.0][layer];
  const dip = Math.exp(-((x - pc) * (x - pc)) / dipW) * dipAmp;
  const bankLift = layer === 0 && x < -72 ? Math.min(13, (-72 - x) * 0.15) : layer === 0 && x > 76 ? Math.min(12, (x - 76) * 0.14) : 0;
  return base + dip - bankLift + 2.5 * Math.sin(x * 0.04 + layer * 2.1 + S) + 1.2 * Math.cos(x * 0.10 - layer * 1.4);
}

const SCENE = new Map();
function buildScene(S) {
  let sc = SCENE.get(S);
  if (sc) return sc;

  const depthBuf = new Int8Array(W * H).fill(-1); // -1 = sky, 0 = foreground .. 4 = far horizon
  const shadeBuf = new Uint8Array(W * H);         // 0 = deep shadow, 1 = mid bark/moss, 2 = lit rim, 3 = wet moss/dew

  const put = (px, py, layer, sh) => {
    const xi = Math.round(px) - X0, yi = Math.round(py) - Y0;
    if (xi < 0 || xi >= W || yi < 0 || yi >= H) return;
    const idx = yi * W + xi;
    if (depthBuf[idx] === -1 || layer <= depthBuf[idx]) {
      depthBuf[idx] = layer;
      shadeBuf[idx] = sh;
    }
  };

  // Asymmetric ancient woodland trunks: [x, layer, halfW, lean]
  const trunks = [
    [-124, 4, 4, 0.01], [-78, 4, 5, -0.01], [-36, 4, 4, 0.02], [12, 4, 4, -0.01], [54, 4, 5, 0.01], [96, 4, 4, -0.02],
    [-100, 3, 7, 0.02], [-50, 3, 6, -0.02], [38, 3, 7, 0.02], [86, 3, 6, -0.01],
    [-70, 2, 11, 0.03], [66, 2, 11, -0.03],
    [-114, 1, 16, 0.04], [110, 1, 16, -0.04],
    [-150, 0, 22, 0.05], [148, 0, 23, -0.05],
  ];

  const trunkCenter = (tr, y) => {
    const [tx, tl, , lean] = tr;
    const botY = [9, -5, -21, -38, -55][tl];
    return tx + lean * (botY - y) + 1.8 * Math.sin(y * 0.032 + tx * 0.17);
  };

  for (let layer = 4; layer >= 0; layer--) {
    const pc = pathCenterX(layer);
    for (let x = X0; x < X0 + W; x++) {
      const gy = Math.round(groundYAt(x, layer, S));
      const nearPath = Math.abs(x - pc) < (24 - layer * 3.2);
      for (let y = gy; y < Y0 + H; y++) {
        const dy = y - gy;
        const mossTex = ((x * 5 + y * 3 + layer * 11) & 7) < 3;
        const sh = dy === 0 ? (nearPath ? 3 : 2) : dy <= 2 ? (nearPath && dy === 1 ? 3 : 2) : dy <= 6 && mossTex ? 1 : 0;
        put(x, y, layer, sh);
      }
    }

    for (const tr of trunks) {
      const [tx, tl, hw] = tr;
      if (tl !== layer) continue;
      const botY = Math.round(groundYAt(tx, tl, S)) + 8;
      for (let y = Y0; y <= botY; y++) {
        const dy = botY - y;
        const cx = trunkCenter(tr, y);
        const rootFlare = dy < 24 ? Math.pow((24 - dy) / 24, 2.1) * hw * 1.05 : 0;
        const w = hw + rootFlare;
        for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
          const relX = x - cx;
          const u = (relX + w) / (2 * w);
          const ridge = Math.sin(relX * (1.35 - hw * 0.025) + tx) > 0.35 ? 1 : 0;
          const innerRim = tx < 0 ? u > 0.78 : u < 0.22;
          const sh = innerRim ? 2 : (u > 0.26 && u < 0.74 && ridge) ? 1 : 0;
          put(x, y, layer, sh);
        }
      }
    }
  }

  // Mossy fallen foreground nurse-log on bottom-left bank (-142..-68)
  for (let x = -142; x <= -68; x++) {
    const u = (x + 142) / 74;
    const ly = Math.round(-2 + u * 8 + 1.4 * Math.sin(u * 4.6));
    const rad = Math.round(6.0 - u * 1.6);
    for (let dy = -rad; dy <= rad; dy++) {
      put(x, ly + dy, 0, dy <= -rad + 1 ? 2 : dy <= 0 ? 1 : 0);
    }
  }

  // Gnarled overarching canopy foliage silhouettes
  const canopyClusters = [
    [-146, -158, 38, 24, 0], [-112, -162, 32, 18, 1], [-76, -166, 26, 14, 1], [-44, -169, 20, 10, 2],
    [144, -156, 40, 25, 0],  [108, -162, 32, 18, 1],  [72, -166, 26, 14, 1],  [40, -169, 20, 10, 2],
    [-152, -124, 26, 20, 0], [150, -122, 28, 20, 0],  [-34, -171, 18, 7, 3], [22, -171, 20, 7, 3],
  ];
  for (const [bx, by, rx, ry, bl] of canopyClusters) {
    for (let y = Math.floor(by - ry); y <= Math.ceil(by + ry); y++) {
      for (let x = Math.floor(bx - rx); x <= Math.ceil(bx + rx); x++) {
        const dx = (x - bx) / rx, dy = (y - by) / ry, d2 = dx * dx + dy * dy;
        const leafJag = 0.16 * Math.sin(x * 0.5 + y * 0.4 + S) + 0.09 * Math.cos(x * 0.95 - y * 0.8);
        if (d2 <= 1 + leafJag) {
          const rim = d2 > 0.74 + leafJag && dy > 0.35;
          put(x, y, bl, rim ? 1 : 0);
        }
      }
    }
  }

  const ferns = [
    [-138, -7, 1, 0, 13], [-64, 6, -1, 0, 11], [74, 6, 1, 0, 12], [134, -2, -1, 0, 14],
    [-90, -10, 1, 1, 10], [88, -10, -1, 1, 10], [-44, -26, 1, 2, 8], [46, -26, -1, 2, 8],
  ];

  // Authentic Botanical Mushroom Colonies across 5 depth tiers:
  // style: 0 = Umbo Woodland Parasol (with annulus ring), 1 = Tall Conical Mycena Fairy-Bell,
  //        2 = Imbricated Panellus Bark Oyster Cluster, 3 = Wavy Decurrent-Gill Funnel Chanterelle
  const gy = (x, tier, dy = 1) => Math.round(groundYAt(x, tier, S)) + dy;
  const mushrooms = [
    // === TIER 0 FOREGROUND LEFT NURSE-LOG COLONY (z = 0.02..0.10) ===
    { x: -112, y: -4,  z: 0.02, cw: 14,  ch: 9.0,  stemH: 22, lean: -0.07, isV: false, style: 0, ph: 0.0, ring: true, buds: [-9, 7] },
    { x: -126, y: -4,  z: 0.04, cw: 7.5, ch: 10.2, stemH: 17, lean: -0.26, isV: false, style: 1, ph: 0.3 },
    { x: -96,  y: 0,   z: 0.05, cw: 10,  ch: 6.5,  stemH: 15, lean:  0.22, isV: true,  style: 3, ph: 0.5, buds: [7] },
    { x: -85,  y: 3,   z: 0.08, cw: 5.8, ch: 7.5,  stemH: 11, lean:  0.30, isV: true,  style: 1, ph: 0.8 },
    { x: -136, y: -5,  z: 0.09, cw: 5.5, ch: 4.5,  stemH: 8,  lean: -0.32, isV: true,  style: 0, ph: 1.0 },

    // === TIER 0 FOREGROUND RIGHT OAK-ROOT COLONY (z = 0.04..0.13) ===
    { x: 108, y: gy(108, 0, 2), z: 0.04, cw: 13.5, ch: 8.8,  stemH: 23, lean:  0.09, isV: true,  style: 0, ph: 0.2, ring: true, buds: [-8, 8] },
    { x: 93,  y: gy(93,  0, 3), z: 0.06, cw: 7.2,  ch: 9.6,  stemH: 16, lean: -0.24, isV: false, style: 1, ph: 0.6, buds: [-6] },
    { x: 122, y: gy(122, 0, 1), z: 0.08, cw: 8.5,  ch: 5.6,  stemH: 13, lean:  0.26, isV: false, style: 3, ph: 0.9 },
    { x: 82,  y: gy(82,  0, 4), z: 0.11, cw: 5.2,  ch: 6.8,  stemH: 9,  lean: -0.30, isV: true,  style: 1, ph: 1.1 },

    // === TIER 0 FOREGROUND MOSSY HOLLOW TUFTS (z = 0.14..0.19) ===
    { x: -42, y: gy(-42, 0, 2), z: 0.15, cw: 7.2, ch: 5.0, stemH: 11, lean: -0.14, isV: false, style: 0, ph: 0.4, buds: [5] },
    { x: -34, y: gy(-34, 0, 3), z: 0.16, cw: 4.8, ch: 6.2, stemH: 8,  lean:  0.24, isV: true,  style: 1, ph: 0.7 },
    { x: 48,  y: gy(48,  0, 2), z: 0.17, cw: 6.8, ch: 4.6, stemH: 10, lean:  0.15, isV: true,  style: 3, ph: 0.5 },
    { x: 56,  y: gy(56,  0, 3), z: 0.19, cw: 4.6, ch: 5.8, stemH: 7.5,lean:  0.28, isV: false, style: 1, ph: 0.9 },

    // === TIER 1 NEAR-MID BARK OYSTER CLUSTERS & ROOT TUFTS (z = 0.26..0.42) ===
    { x: -101, y: -42, z: 0.26, cw: 12, ch: 4.5, stemH: 0, lean: 1,  isV: false, style: 2, ph: 0.2 }, // left trunk oyster shelves
    { x: 97,   y: -46, z: 0.28, cw: 12, ch: 4.5, stemH: 0, lean: -1, isV: true,  style: 2, ph: 0.5 }, // right trunk oyster shelves
    { x: -78, y: gy(-78, 1, 1), z: 0.31, cw: 6.8, ch: 4.8, stemH: 10, lean: -0.15, isV: true,  style: 0, ph: 0.3 },
    { x: -70, y: gy(-70, 1, 2), z: 0.33, cw: 4.5, ch: 5.6, stemH: 7.5,lean:  0.22, isV: false, style: 1, ph: 0.6 },
    { x: 68,  y: gy(68,  1, 1), z: 0.36, cw: 6.5, ch: 4.6, stemH: 9.5,lean:  0.14, isV: false, style: 0, ph: 0.4 },
    { x: 60,  y: gy(60,  1, 2), z: 0.38, cw: 4.4, ch: 5.4, stemH: 7,  lean: -0.22, isV: true,  style: 1, ph: 0.8 },
    { x: -8,  y: gy(-8,  1, 2), z: 0.41, cw: 5.6, ch: 4.0, stemH: 8,  lean: -0.10, isV: false, style: 0, ph: 0.5, buddy: 1 },

    // === TIER 2 MID-GROUND GLADE MULTI-CAP TUFTS (z = 0.49..0.63) ===
    { x: -55, y: gy(-55, 2, 1), z: 0.49, cw: 5.2, ch: 3.8, stemH: 7.5, lean: -0.14, isV: false, style: 0, ph: 0.2, buddy: 1 },
    { x: 45,  y: gy(45,  2, 1), z: 0.56, cw: 5.0, ch: 3.6, stemH: 7.0, lean:  0.14, isV: true,  style: 0, ph: 0.4, buddy: -1 },
    { x: 10,  y: gy(10,  2, 2), z: 0.62, cw: 4.4, ch: 3.2, stemH: 6.0, lean: -0.10, isV: true,  style: 0, ph: 0.3, buddy: 1 },

    // === TIER 3 & TIER 4 FAR MISTY WOODLAND TUFTS (z = 0.72..0.96) — awaken LAST! ===
    { x: -76, y: gy(-76, 3, 1), z: 0.72, cw: 3.5, ch: 2.6, stemH: 4.5, lean:  0.08, isV: false, style: 0, ph: 0.3, buddy: 1 },
    { x: -30, y: gy(-30, 3, 1), z: 0.77, cw: 3.4, ch: 2.6, stemH: 4.5, lean: -0.10, isV: true,  style: 0, ph: 0.6, buddy: -1 },
    { x: 30,  y: gy(30,  3, 1), z: 0.82, cw: 3.5, ch: 2.6, stemH: 4.5, lean:  0.10, isV: false, style: 0, ph: 0.4, buddy: 1 },
    { x: -52, y: gy(-52, 4, 1), z: 0.90, cw: 2.5, ch: 2.0, stemH: 3.0, lean:  0,    isV: true,  style: 0, ph: 0.5, buddy: 1 },
    { x: -14, y: gy(-14, 4, 1), z: 0.93, cw: 2.5, ch: 2.0, stemH: 3.0, lean:  0,    isV: false, style: 0, ph: 0.7, buddy: -1 },
    { x: 24,  y: gy(24,  4, 1), z: 0.96, cw: 2.4, ch: 2.0, stemH: 3.0, lean:  0,    isV: true,  style: 0, ph: 0.3, buddy: 1 },
  ];

  // Expand companion sub-caps ("buddy") once at scene build time for zero per-frame allocations!
  const allMushrooms = [];
  for (const m of mushrooms) {
    if (m.buddy) {
      allMushrooms.push({
        x: m.x + m.buddy * Math.max(3, Math.round(m.cw * 1.05)),
        y: m.y + 1,
        z: m.z + 0.01,
        cw: m.cw * 0.65,
        ch: m.ch * 0.72,
        stemH: m.stemH * 0.68,
        lean: m.buddy * 0.26,
        isV: !m.isV,
        style: m.style === 0 ? 1 : 0,
        ph: m.ph + 0.35,
      });
    }
    allMushrooms.push(m);
  }
  allMushrooms.sort((a, b) => a.z - b.z);
  // 1) Gnarled root/log vines hugging the bottom corners;
  // 2) True 3D cylindrical trunk-wrapping lianas that coil all the way into the canopy foliage or behind bark!
  const makeRootVine = (ptsRaw, z0, z1, violet, ph, baseW) => {
    const pts = [];
    const segs = ptsRaw.length - 1, sub = 8;
    for (let i = 0; i < segs; i++) {
      const [ax, ay] = ptsRaw[i], [bx, by] = ptsRaw[i + 1];
      for (let s = 0; s < (i === segs - 1 ? sub + 1 : sub); s++) {
        const u = (i + s / sub) / segs, tLoc = s / sub;
        const x = ax + (bx - ax) * tLoc;
        const y = ay + (by - ay) * tLoc + 1.0 * Math.sin(u * Math.PI * 3 + ph);
        const w = 0.7 + (baseW - 0.7) * Math.pow(1 - u, 0.65);
        pts.push([x, y, z0 + (z1 - z0) * u, w, 1]);
      }
    }
    return { violet, ph, pts };
  };

  // Continuous S-curving trunk-clinging woody liana: rooted at the trunk's mossy base and climbing all the way into the
  // overarching canopy boughs (zero broken mid-air fragments, zero upright antenna tips!)
  const makeClimbingTrunkLiana = (trIdx, yBot, yTop, phase0, waves, zBase, violet, ph, baseW) => {
    const tr = trunks[trIdx];
    const hw = tr[2], trunkLayer = tr[1];
    const steps = Math.max(24, Math.ceil(Math.abs(yBot - yTop) / 4.2));
    const pts = [];
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const y = yBot + (yTop - yBot) * u;
      const cx = trunkCenter(tr, y);
      const flare = yBot - y < 24 ? Math.pow((24 - (yBot - y)) / 24, 2) * hw * 0.95 : 0;
      const wCyl = hw + flare;
      // Smooth S-curve across the rounded front of the trunk, biasing slightly toward the inner glade rim
      const innerSign = tr[0] < 0 ? 1 : -1;
      const sCurve = innerSign * 0.22 + 0.62 * Math.sin(u * Math.PI * waves + phase0);
      const x = cx + sCurve * wCyl;
      const w = 0.72 + (baseW - 0.72) * Math.pow(1 - u * 0.72, 0.65);
      pts.push([x, y, zBase + u * 0.10, w, 1]);
    }
    return { violet, ph, pts, trunkLayer };
  };

  const vines = [
    // 1. Foreground Left Nurse-Log Woody Vine (hugs mossy log under Left Hero Colony)
    makeRootVine([[-154, -8], [-134, -5], [-110, -1], [-84, 5], [-68, 8]], 0.03, 0.14, true, 0.2, 2.5),
    // 2. Foreground Right Oak-Root Woody Vine (hugs right root flare under Right Hero Colony)
    makeRootVine([[154, -6], [134, -1], [112, 3], [88, 6], [72, 9]], 0.05, 0.16, false, 0.7, 2.5),
    // 3 & 4. Near-Mid Gnarled Trunk Climbing Lianas (unbroken graceful S-curves from mossy roots all the way into canopy!)
    makeClimbingTrunkLiana(12, -4, -158,  0.4, 2.1, 0.26, false, 0.3, 2.1),
    makeClimbingTrunkLiana(13, -3, -156, -0.6, 1.9, 0.29, true,  1.4, 2.0),
    // 5 & 6. Mid-Ground Trunk Winding Ivy (softer, finer S-curves rising into upper mid-canopy)
    makeClimbingTrunkLiana(10, -20, -164, -0.3, 2.0, 0.50, true,  0.8, 1.45),
    makeClimbingTrunkLiana(11, -20, -164,  0.8, 1.8, 0.54, false, 1.9, 1.40),
  ];

  sc = { depthBuf, shadeBuf, ferns, mushrooms: allMushrooms, vines };
  SCENE.set(S, sc);
  return sc;
}

function drawFern(q, f, t, night, Cy, Vi, Fo) {
  const [fx, fy, dir, layer, len] = f;
  const sway = Math.sin(cyc(t, 1, fx * 0.05)) * 1.3;
  const br = bioBreath(t, layer * 0.28 + 0.05, fx * 0.02);
  const baseC = mix(Fo[Math.min(6, 5 - layer)], Fo[1], night * 0.8);
  const tipC = mix(baseC, (fx & 1) ? Cy[4] : Vi[4], br * 0.55);
  for (let i = 0; i <= len; i++) {
    const u = i / len;
    const x = fx + dir * i * 0.86 + sway * u * u;
    const y = fy - i * 0.66 + u * u * 3.1;
    q.px(x, y, u > 0.68 ? tipC : baseC);
    if (i % 2 === 1 && i < len - 1) {
      q.px(x - dir * 0.5, y - 1, u > 0.65 ? tipC : baseC);
      q.px(x + dir * 0.8, y + 1, baseC);
    }
  }
}

// Sculpted 3D Botanical Bioluminescent Mushrooms:
// - Crisp dark/bright alternating radial gill lamellae inside a concave 3D underside bowl
// - Four authentic woodland species: Umbo Parasol (with annulus ring), Conical Fairy-Bell, Decurrent Funnel-Cap & Oyster Cluster
// - Natural multi-cap tufts in mid/far tiers so distant fungi never look like isolated pins
function drawBotanicalMushroom(q, m, t, night, br, Cy, Vi, Fo) {
  const { x: bx, y: by, z, cw, ch, stemH, lean, isV, style, ph, ring, buds } = m;
  const P = isV ? Vi : Cy;

  // Style 2: Broad Overlapping Panellus / Oyster Bark-Shelf Cluster (3 rich imbricated kidney fans)
  if (style === 2) {
    const dir = lean >= 0 ? 1 : -1;
    const tiers = [[-2, -6, 0.74], [0, 0, 1.0], [-1, 5, 0.82]];
    const capDark = mix(Fo[4], mix(Fo[0], P[1], 0.55), night * 0.86);
    const capMid  = mix(capDark, P[3], 0.22 + 0.42 * br);
    const gillSlot = mix(Fo[2], P[2], 0.4 + 0.5 * br);
    const gillBlade = mix(Fo[4], P[5], 0.25 + 0.75 * br);

    for (const [ox, oy, k] of tiers) {
      const sx = bx + ox * dir, sy = by + oy;
      const w = Math.round(cw * k), h = Math.max(2, Math.round(ch * k));
      // Visible underside radial gill fan (2px deep with crisp alternating dark slots & lit blades!)
      for (let dx = 0; dx <= w; dx++) {
        const u = dx / w;
        const arch = Math.round(Math.sin(u * Math.PI) * 1.5);
        const blade = (dx % 2 === 0);
        const cGill = blade ? (br > 0.55 ? P[6] : gillBlade) : gillSlot;
        q.px(sx + dx * dir, sy + 1 - arch, cGill);
        if (u > 0.15 && u < 0.88) q.px(sx + dx * dir, sy + 2 - arch, blade ? gillBlade : gillSlot);
      }
      // Velvety curved upper oyster cap with scalloped outer lip & wet gloss
      for (let dy = -h; dy <= 0; dy++) {
        const v = -dy / h;
        const rw = Math.round(w * Math.sqrt(Math.max(0, 1 - v * v * 0.80)));
        for (let dx = 0; dx <= rw; dx++) {
          const isTop = dy === -h || dx === rw;
          const isLip = dy === 0;
          const col = isLip
            ? mix(capMid, P[5], 0.2 + 0.78 * br)
            : isTop
              ? mix(Fo[1], P[2], br * 0.30)
              : (dy === -h + 1 && dx >= 1 && dx < rw * 0.55) ? mix(capMid, WHITE, 0.24) : capMid;
          q.px(sx + dx * dir, sy + dy, col);
        }
      }
    }
    if (br > 0.06) q.glow(bx + dir * 6, by, 15, P[4], 0.34 * br);
    return;
  }

  // Far-horizon miniature mushrooms (cw <= 3.6): shaded dark cap crown + crisp glowing underside gill row
  if (cw <= 3.6) {
    const rw = Math.max(1, Math.round(cw));
    const stemC = mix(Fo[3], P[4], br * 0.72);
    for (let s = 0; s < Math.max(2, Math.round(stemH)); s++) q.px(Math.round(bx), Math.round(by - s), stemC);
    const cy = Math.round(by - stemH);
    const crownC = mix(mix(Fo[4], Fo[1], night), P[2], 0.30 + 0.42 * br);
    const gillC  = br > 0.58 ? P[6] : mix(Fo[3], P[5], 0.2 + 0.8 * br);
    for (let dx = -rw; dx <= rw; dx++) {
      q.px(Math.round(bx + dx), cy, (dx & 1) === 0 ? gillC : mix(crownC, P[4], br * 0.8));
      q.px(Math.round(bx + dx), cy - 1, Math.abs(dx) === rw ? mix(crownC, P[4], br * 0.65) : crownC);
      if (Math.abs(dx) < rw) q.px(Math.round(bx + dx), cy - 2, dx === -1 ? mix(crownC, WHITE, 0.18) : crownC);
    }
    if (br > 0.08) q.glow(bx, cy - 1, 6.5, P[4], 0.26 * br);
    return;
  }

  // === FULL 3D BOTANICAL MUSHROOM (Hero Foreground & Midground) ===
  const sway = Math.sin(cyc(t, 1, ph)) * 0.45 * (cw / 12);
  const cx = bx + Math.sin(lean) * stemH * 0.56 + sway;
  const cy = by - Math.cos(lean) * stemH * 0.94;
  const funnel = style === 3;
  const bonnet = style === 1;
  const gillRy = Math.max(1.6, cw * (bonnet ? 0.22 : funnel ? 0.30 : 0.26));

  // 1) CONCAVE 3D ELLIPTICAL UNDERSIDE GILL BOWL (preserved dark gill slots vs luminous gill blades — NEVER washed out!)
  const gillSlotCol  = mix(mix(Fo[3], Fo[1], night), P[2], 0.25 + 0.50 * br);
  const gillBladeCol = mix(mix(Fo[4], P[3], 0.5), P[5], 0.20 + 0.80 * br);
  const gillHotBlade = mix(gillBladeCol, P[6], br * 0.85);
  const rxG = cw * 0.94;
  const nBlades = Math.max(9, Math.round(cw * 1.45));

  for (let dy = Math.floor(-gillRy * 0.65); dy <= Math.ceil(gillRy * 0.95); dy++) {
    for (let dx = -Math.ceil(rxG); dx <= Math.ceil(rxG); dx++) {
      const tiltY = dy - dx * lean * 0.26;
      const d2 = (dx / rxG) * (dx / rxG) + (tiltY / gillRy) * (tiltY / gillRy);
      if (d2 > 1) continue;
      const ang = Math.atan2(tiltY * 2.3, dx);
      const wave = Math.sin(ang * nBlades);
      const coreProx = 1 - Math.sqrt(d2);
      // Distinct radial gill blades alternating with deep shadow slots all the way into the stipe collar!
      let col = wave > 0.05
        ? (coreProx > 0.35 ? gillHotBlade : gillBladeCol)
        : (d2 > 0.72 ? mix(gillSlotCol, Fo[0], 0.35) : gillSlotCol);
      q.px(Math.round(cx + dx), Math.round(cy + dy), col);
    }
  }

  // 2) CURVED TAPERED STIPE (with optional delicate annulus skirt ring & decurrent funnel gill ridges!)
  const steps = Math.max(8, Math.ceil(stemH * 1.4));
  const stemDark = mix(Fo[3], Fo[1], night * 0.85);
  const stemBaseLit = mix(Fo[5], Fo[2], night * 0.75);
  for (let s = 0; s <= steps; s++) {
    const u = s / steps;
    const bend = Math.sin(u * Math.PI) * lean * 2.2;
    const sx = bx + (cx - bx) * (u * u * (3 - 2 * u)) + bend;
    const sy = by + (cy + 0.5 - by) * u;
    const flareTop = funnel && u > 0.68 ? Math.pow((u - 0.68) / 0.32, 1.6) * (cw * 0.38) : (u > 0.80 ? (u - 0.80) * 1.8 : 0);
    const halfW = (cw / 12) * (1.75 * Math.pow(1 - u, 1.5) + 0.88) + flareTop;
    const apexGlow = Math.pow(u, 1.6) * (0.20 + 0.80 * br);

    for (let dx = -Math.ceil(halfW); dx <= Math.ceil(halfW); dx++) {
      if (Math.abs(dx) > halfW + 0.15) continue;
      const cyl = halfW > 0.6 ? (dx / halfW) : 0;
      let scCol = cyl < -0.2 ? stemBaseLit : cyl > 0.35 ? stemDark : mix(stemBaseLit, stemDark, 0.45);
      scCol = mix(scCol, cyl < 0.25 ? P[5] : P[3], apexGlow * 0.82);
      // Decurrent gill ridges running down upper funnel stem!
      if (funnel && u > 0.68 && (dx & 1) === 0) {
        scCol = mix(scCol, P[6], (u - 0.68) * 2.4 * br);
      }
      q.px(Math.round(sx + dx), Math.round(sy), scCol);
    }

    // Delicate woodland parasol annulus (skirt ring) at u ≈ 0.68!
    if (ring && Math.abs(u - 0.68) < (0.55 / steps)) {
      const rw = Math.ceil(halfW + 1.4);
      for (let dx = -rw; dx <= rw; dx++) {
        q.px(Math.round(sx + dx), Math.round(sy + (Math.abs(dx) === rw ? 1 : 0)), mix(stemBaseLit, P[5], 0.35 + 0.55 * br));
      }
    }
  }

  // 3) ORGANIC 3D UPPER CAP DOME (Species-authentic silhouette, dark upper contour, moist dew gloss & SSS rim!)
  const skinDark = mix(mix(Fo[4], P[1], 0.42), mix(Fo[0], P[1], 0.60), night);
  const skinMid  = mix(mix(Fo[5], P[2], 0.36), mix(Fo[1], P[2], 0.68), night);
  const outlineC = mix(Fo[0], P[1], 0.30 + 0.30 * br);

  const iCw = Math.ceil(cw + 1);
  for (let dx = -iCw; dx <= iCw; dx++) {
    const u = Math.abs(dx) / cw;
    if (u > 1) continue;

    // Species-specific botanical cap profile:
    // - style 0 (Umbo Parasol): broad convex dome + distinct central umbo boss + gently flared outer skirt
    // - style 1 (Conical Mycena Bell): tall graceful parabolic thimble/lantern dome
    // - style 3 (Wavy Chanterelle Funnel): dipped concave center with uplifted wavy trumpet margins
    const u2 = u * u;
    let domeShape;
    if (bonnet) {
      domeShape = Math.pow(1 - u2, 0.78) * 0.82 + 0.18 * Math.exp(-u2 * 5.5);
    } else if (funnel) {
      domeShape = 0.62 + 0.36 * u * Math.sqrt(u) - 0.18 * Math.exp(-u2 * 6.0);
    } else {
      const umbo = 0.17 * Math.exp(-u2 * 9.5);
      domeShape = Math.sqrt(Math.max(0, 1 - u2)) * 0.76 + 0.12 * Math.cos(u * Math.PI * 0.5) + umbo;
    }

    const tiltOff = dx * lean * 0.26;
    const yTop = cy + tiltOff - ch * domeShape;
    const waveRim = funnel ? 0.65 * Math.sin((dx / cw) * Math.PI * 3.5 + ph) : 0.30 * Math.sin((dx / cw) * Math.PI * 3.0 + ph);
    const yRim = cy + tiltOff - gillRy * 0.50 * Math.sqrt(Math.max(0, 1 - u2)) + waveRim;

    const iy0 = Math.round(yTop), iy1 = Math.round(yRim);
    const span = Math.max(1, iy1 - iy0);
    const pleat = 0.5 + 0.5 * Math.sin((dx / cw) * Math.PI * (bonnet ? 6 : 8) + ph);
    const uEdge = u2 * Math.sqrt(u) * 0.30;
    const sssGain = (0.78 + 0.28 * pleat) * (0.16 + 0.86 * br);
    const baseBodyCol = dx < -cw * 0.10 ? skinMid : mix(skinMid, skinDark, 0.58);
    const gx = (dx + cw * 0.28) / (cw * 0.30), gx2 = gx * gx;
    const gyCenter = iy0 + span * 0.30, gyInv = 1 / Math.max(1.3, span * 0.24);
    const ix = Math.round(cx + dx);

    for (let py = iy0; py <= iy1; py++) {
      const oneMinusV = 1 - (iy1 - py) / span;
      const isUpperOutline = py === iy0 && u < 0.95;
      const isMarginLip = py === iy1;

      // Subsurface Scattering (SSS): fast algebraic thinness (no Math.pow inside pixel loop!)
      const thinness = oneMinusV * oneMinusV * 0.76 + uEdge;
      const sss = clamp(thinness * sssGain, 0, 1);

      let col = mix(baseBodyCol, sss > 0.64 ? P[5] : P[3], sss);

      const gy = (py - gyCenter) * gyInv;
      const gloss = 1 - (gx2 + gy * gy);
      if (gloss > 0.15 && !isMarginLip) {
        col = mix(col, mix(WHITE, P[6], 0.45), gloss * (0.34 - 0.10 * night + 0.14 * br));
      }

      if (isUpperOutline) {
        col = mix(outlineC, P[3], sss * 0.40);
      } else if (isMarginLip) {
        col = mix(mix(skinMid, P[4], 0.38), br > 0.55 ? P[6] : P[5], 0.22 + 0.78 * br);
      }
      q.px(ix, py, col);
    }
  }

  // 4) MINIATURE BABY PINHEAD BUDS (Primordia) & DAMP MOSS TUFT at Hero Colony Base
  const mossBase = mix(Fo[4], Fo[1], night * 0.8);
  const mossGlow = mix(mossBase, P[3], br * 0.55);
  for (let dx = -3; dx <= 3; dx++) {
    if ((dx & 1) === 0) q.px(Math.round(bx + dx), Math.round(by), mossGlow);
    q.px(Math.round(bx + dx), Math.round(by + 1), mossBase);
  }
  if (buds) {
    for (const bOff of buds) {
      const px = Math.round(bx + bOff), py = Math.round(by + 1);
      const dir = bOff < 0 ? -1 : 1;
      q.px(px, py, mossBase);
      q.px(px + dir * 0.5, py - 1, mix(mossBase, P[4], br * 0.7));
      q.px(px + dir, py - 2, br > 0.52 ? P[6] : mix(Fo[3], P[5], 0.3 + 0.7 * br));
      q.px(px + dir - 1, py - 3, mix(skinDark, P[3], br * 0.55));
      q.px(px + dir,     py - 3, mix(skinMid, P[4], br * 0.65));
      q.px(px + dir + 1, py - 3, mix(skinDark, P[3], br * 0.55));
    }
  }

  // 5) SUBSURFACE GILL HALO, WET-MOSS BOUNCE & DRIFTING SPORE MOTE
  if (br > 0.06) {
    const rHalo = (6 + cw * 1.12) * (0.82 + 0.22 * br);
    q.glow(cx, cy, rHalo, P[4], (0.22 + 0.34 * (1 - z * 0.55)) * br);
    if (cw >= 8) {
      q.glow(cx, cy + 1, cw * 0.52, P[5], 0.20 * br);
      const poolW = Math.round(cw * 1.05);
      for (let dx = -poolW; dx <= poolW; dx += 2) {
        q.blend(Math.round(bx + dx), Math.round(by + 1), P[4], 0.26 * br * (1 - Math.abs(dx) / (poolW + 1)));
      }
      if (br > 0.58) {
        const spU = ((t / D) * 2 + ph * 0.5) % 1;
        const sx = cx + Math.sin(spU * TAU + ph) * cw * 0.45;
        const sy = cy - ch - 2 - spU * 10;
        q.blend(sx, sy, P[6], (br - 0.58) * 1.8 * Math.sin(Math.PI * spU));
      }
    }
  }
}

// Physical, Grounded Woody Vine (unbroken S-curves anchored to bark & nurse-logs with local bark-grain bounce light!)
function drawWoodyVine(q, v, sc, t, night, Cy, Vi, Fo) {
  const P = v.violet ? Vi : Cy;
  const pts = v.pts;
  const barkShadow = mix(Fo[2], Fo[0], night * 0.88);
  const barkLit    = mix(Fo[5], Fo[2], night * 0.78);
  const tl = v.trunkLayer;

  // Pass 1: Subtle bioluminescent bark-grain bounce on the tree trunk right behind the climbing vine + physical woody stem
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0, z0, w0] = pts[i], [x1, y1] = pts[i + 1];
    const br = bioBreath(t, z0, v.ph + i * 0.05);

    if (tl !== undefined && br > 0.08) {
      const ix = Math.round(x0), iy = Math.round(y0);
      const yi = iy - Y0;
      if (yi >= 0 && yi < H) {
        const span = tl <= 1 ? 5 : 3;
        for (let dx = -span; dx <= span; dx++) {
          const xi = ix + dx - X0;
          if (xi >= 0 && xi < W && sc.depthBuf[yi * W + xi] === tl && sc.shadeBuf[yi * W + xi] >= 1) {
            q.blend(ix + dx, iy, P[2], 0.34 * br * (1 - Math.abs(dx) / (span + 1)));
          }
        }
      }
    }

    const sapGlow = mix(barkLit, P[4], br * 0.65);
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;

    q.line(x0 + nx * w0 * 0.45, y0 + ny * w0 * 0.45, x1 + nx * w0 * 0.45, y1 + ny * w0 * 0.45, barkShadow, 0.95);
    q.line(x0, y0, x1, y1, mix(barkLit, P[3], br * 0.44), 1);
    if (w0 > 1.1) {
      q.line(x0 - nx * w0 * 0.4, y0 - ny * w0 * 0.4, x1 - nx * w0 * 0.4, y1 - ny * w0 * 0.4, sapGlow, 0.9);
    }
  }

  // Pass 2: Natural bioluminescent ivy leaf-clusters & soft bark-lighting sap nodes
  for (let i = 2; i < pts.length - 2; i += 3) {
    const [x, y, z0, w0] = pts[i];
    const [xp, yp] = pts[i - 1], [xn, yn] = pts[i + 1];
    const br = bioBreath(t, z0, v.ph + i * 0.07);
    const side = (i & 1) ? 1 : -1;
    const tangA = Math.atan2(yn - yp, xn - xp);
    const leafA = tangA + side * 1.05 + Math.sin(cyc(t, 1, i)) * 0.08;
    const len = w0 > 1.45 ? 3.3 : 2.3;

    const lx1 = x + Math.cos(leafA) * len * 0.55, ly1 = y + Math.sin(leafA) * len * 0.55;
    const lx2 = x + Math.cos(leafA) * len,        ly2 = y + Math.sin(leafA) * len;
    const px = -Math.sin(leafA) * 0.85,           py = Math.cos(leafA) * 0.85;

    const leafBase = mix(barkLit, P[3], 0.25 + 0.75 * br);
    const leafTip  = br > 0.58 ? P[6] : mix(barkLit, P[5], 0.2 + 0.8 * br);

    q.px(Math.round(x), Math.round(y), mix(barkLit, P[5], br * 0.82));
    q.px(Math.round(lx1), Math.round(ly1), leafTip);
    if (w0 > 1.15) {
      q.px(Math.round(lx1 + px), Math.round(ly1 + py), leafBase);
      q.px(Math.round(lx1 - px), Math.round(ly1 - py), leafBase);
    }
    q.px(Math.round(lx2), Math.round(ly2), leafTip);

    if (br > 0.10 && i % 6 === 2) {
      q.glow(lx1, ly1, w0 > 1.45 ? 10 : 7, P[4], 0.25 * br);
    }
  }
}

// Feathery Glowing Dandelion Pappus Seed (drifting slowly & weightlessly with smooth fade envelope)
function drawDandelionFluff(q, x, y, swing, sc, alpha, night, Cy, Vi, Fo, idx) {
  if (alpha <= 0.04) return;
  const P = idx % 3 === 0 ? Vi : Cy;
  const glowK = (0.30 + 0.70 * night) * alpha;
  const wispCol = mix(Fo[7], P[5], night);
  const tipCol  = mix(WHITE, P[6], night * 0.55);
  const haloCol = mix(Fo[7], P[4], night);

  if (sc < 0.58) {
    q.blend(x, y - 1, WHITE, 0.68 * alpha);
    q.blend(x - 1, y - 2, wispCol, 0.45 * alpha);
    q.blend(x + 1, y - 2, wispCol, 0.45 * alpha);
    q.blend(x, y + 1, wispCol, 0.48 * alpha);
    q.glow(x, y - 1, 4.5, haloCol, 0.20 * glowK);
    return;
  }

  const stalk = 5.2 * sc;
  const hubX  = x + Math.sin(swing) * stalk * 0.45;
  const hubY  = y - Math.cos(swing) * stalk * 0.45;
  const seedX = x - Math.sin(swing) * stalk * 0.55;
  const seedY = y + Math.cos(swing) * stalk * 0.55;

  q.line(seedX, seedY, hubX, hubY, wispCol, 0.48 * alpha);
  q.blend(Math.round(seedX), Math.round(seedY), tipCol, 0.90 * alpha);
  if (sc > 0.92) q.blend(Math.round(seedX), Math.round(seedY + 1), mix(Fo[5], P[3], night), 0.75 * alpha);

  const hairs = sc > 0.9 ? 9 : 7;
  for (let h = 0; h < hairs; h++) {
    const frac = (h / (hairs - 1)) - 0.5;
    const a = -Math.PI * 0.5 + swing + frac * 2.50;
    const len = (2.7 + (h % 2 === 0 ? 1.1 : 0.35)) * sc;
    const mx = hubX + Math.cos(a) * len * 0.55, my = hubY + Math.sin(a) * len * 0.55;
    const tx = hubX + Math.cos(a) * len,        ty = hubY + Math.sin(a) * len;
    q.blend(mx, my, wispCol, 0.42 * alpha);
    q.blend(tx, ty, h % 2 === 0 ? WHITE : tipCol, 0.78 * alpha);
  }
  q.blend(Math.round(hubX), Math.round(hubY), WHITE, 0.92 * alpha);
  q.glow(hubX, hubY, 6.8 * sc, haloCol, 0.23 * glowK);
}

// 3 Serene Cohesive Firefly Swarms (unhurried clustered flocking & gentle lantern beats)
function drawFireflySwarms(q, t, S, Ff, night, frontOnly) {
  const swarms = [
    [-54 + 22 * Math.sin(cyc(t, 1, 0.3)), -46 + 10 * Math.sin(cyc(t, 1, 1.4))],
    [6   + 26 * Math.cos(cyc(t, 1, 2.2)), -64 + 11 * Math.sin(cyc(t, 1, 0.2))],
    [58  + 20 * Math.sin(cyc(t, 1, 4.1)), -42 + 9  * Math.cos(cyc(t, 1, 2.7))],
  ];
  const lumEnv = 0.16 + 0.84 * night;

  for (let i = 0; i < 38; i++) {
    const near = i >= 26;
    if (near !== frontOnly) continue;
    const R = (k) => rand(S + 107, i, k);
    const [sx, sy] = swarms[i % 3];
    const rx = (near ? 13 : 8.5) + R(1) * 10;
    const ry = (near ? 8.5 : 5.5) + R(2) * 6.5;
    const c1 = 1 + (i % 2), c2 = 2;
    const pos = (tt) => [
      sx + rx * Math.cos(cyc(tt, c1, R(3) * TAU)) + 3.5 * loopNoise(tt / D, 1.2, i * 2),
      sy + ry * Math.sin(cyc(tt, c2, R(4) * TAU)) + 2.8 * loopNoise(tt / D, 1.2, i * 2 + 1),
    ];

    const [x, y] = pos(t);
    const beatRhythm = 0.5 + 0.5 * Math.sin(cyc(t, 2 + (i % 2), R(5) * TAU));
    const g = (0.24 + 0.76 * beatRhythm * beatRhythm) * lumEnv;
    if (g < 0.08) continue;

    if (g > 0.34) {
      for (let j = 1; j <= 2; j++) {
        const [tx, ty] = pos(t - j * 0.055);
        q.dot(tx, ty, Ff[2], (g - 0.24) * (1 - j / 3) * 0.95);
      }
    }

    const X = Math.round(x), Y = Math.round(y);
    if (!near) {
      q.px(X, Y, g > 0.62 ? Ff[5] : Ff[3]);
      q.glow(x, y, 6.0, Ff[2], 0.35 * g);
    } else {
      const [nx] = pos(t + 0.05), dir = nx >= x ? 1 : -1, wing = Math.floor(t * 24 + i) & 1;
      q.px(X + dir, Y, Ff[0]);
      q.blend(X, Y - 1 - wing, WHITE, 0.58 * lumEnv);
      q.blend(X + dir, Y - 1 - wing, Ff[4], 0.44 * lumEnv);
      q.px(X, Y, g > 0.52 ? Ff[5] : Ff[3]);
      q.px(X - dir, Y, Ff[3]);
      q.glow(x, y, 13, Ff[2], 0.38 * g);
      q.glow(x, y, 4.2, Ff[4], 0.44 * g);
    }
  }
}

const LUT = new Uint32Array(20);

export function drawBack(p, t, o) {
  const q = clip(p, meta), S = o.seed;
  const Cy = fit(o.palette, 7), Vi = fit(o.violet, 7), Ff = fit(o.firefly, 6), Fo = fit(o.forest, 8);
  const night = nightEnv(t), day = 1 - night;
  const blueHour = Math.sin(night * Math.PI);
  const sc = buildScene(S);
  const mistF = field(S * 5 + 3, 256, 128);
  const mistDrift = (256 * t) / D;

  // Multi-stage Twilight -> Violet Blue-Hour -> Midnight Indigo sky colors
  const skyDuskTop = hex("#1d3247"), skyDuskLow = hex("#b98463");
  const skyBlueTop = hex("#101a36"), skyBlueLow = hex("#453b67");
  const skyNightTop = hex("#030611"), skyNightLow = hex("#0b1930");

  const curSkyTop = mix(mix(skyDuskTop, skyNightTop, night), skyBlueTop, blueHour * 0.45);
  const curSkyLow = mix(mix(skyDuskLow, skyNightLow, night), skyBlueLow, blueHour * 0.52);

  const pathBioPulse = bioBreath(t, 0.45, 0.4);
  for (let layer = 0; layer < 5; layer++) {
    const hazeAmt = layer * 0.16;
    for (let sh = 0; sh < 4; sh++) {
      const duskBase = Fo[clamp(1 + layer + (sh >= 2 ? 2 : sh === 1 ? 1 : 0), 1, 6)];
      const duskCol  = mix(duskBase, skyDuskLow, hazeAmt * 0.68);
      const nightBase = Fo[clamp((layer === 0 ? 0 : layer <= 2 ? 1 : 2) + (sh >= 2 ? 1 : 0), 0, 3)];
      const nightCol = mix(nightBase, skyNightLow, hazeAmt * 0.55);
      let c = mix(mix(duskCol, nightCol, night), skyBlueLow, blueHour * hazeAmt * 0.36);
      if (sh === 3 && pathBioPulse > 0.05) {
        c = mix(c, layer % 2 === 0 ? Cy[2] : Vi[2], pathBioPulse * 0.38);
      }
      LUT[layer * 4 + sh] = c;
    }
  }

  const mistTint = mix(mix(Fo[6], Fo[7], 0.40), mix(Cy[2], Vi[2], 0.48), night);

  rows(p, meta, Y0, Y0 + H - 1, (y, R) => {
    const yi = Math.floor(y) - Y0;
    const vSky = clamp(yi / 116, 0, 1);
    const skyCol = mix(curSkyTop, curSkyLow, vSky * (0.45 + 0.55 * vSky));
    const rowOff = yi * W;
    const inMistBand = y > -78 && y < -8;
    const mistEnv = inMistBand ? smooth(-78, -50, y) * (1 - smooth(-22, -8, y)) * (0.16 + 0.28 * night) : 0;

    for (let xi = 0; xi < W; xi++) {
      const layer = sc.depthBuf[rowOff + xi];
      let c = layer < 0 ? skyCol : LUT[layer * 4 + sc.shadeBuf[rowOff + xi]];

      if (day > 0.03) {
        const bc = (X0 + xi + 118.5) * 0.75 - (y + 170) * 0.44;
        if (bc > 24 && bc < 216) {
          const b1 = bc < 76 ? Math.max(0, 1 - Math.abs(bc - 52) * 0.0416) : 0;
          const b2 = bc > 98 && bc < 158 ? Math.max(0, 1 - Math.abs(bc - 128) * 0.0333) : 0;
          const b3 = bc > 180 ? Math.max(0, 1 - Math.abs(bc - 198) * 0.0555) : 0;
          const rayK = (b1 * 0.72 + b2 * 0.92 + b3 * 0.58) * day * day * (1 - yi / 195);
          if (rayK > 0.03) {
            c = mix(c, Fo[7], rayK * (layer < 0 ? 0.38 : 0.20));
            R.l[xi] = Fo[7];
            R.k[xi] = rayK * 0.15;
          }
        }
      }
      R.c[xi] = c;
    }

    if (mistEnv > 0.01) {
      for (let xi = 0; xi < W; xi += 2) {
        const l0 = sc.depthBuf[rowOff + xi], l1 = sc.depthBuf[rowOff + xi + 1];
        if ((l0 >= 0 && l0 < 2) && (l1 >= 0 && l1 < 2)) continue;
        const m = Math.min(0.45, (sample(mistF, xi + mistDrift, yi * 2.2) - 0.47) * 1.8 * mistEnv);
        if (m > 0.03) {
          if (l0 < 0 || l0 >= 2) R.c[xi] = mix(R.c[xi], mistTint, m);
          if (l1 < 0 || l1 >= 2) R.c[xi + 1] = mix(R.c[xi + 1], mistTint, m);
        }
      }
    }
  });

  if (night > 0.32) {
    const sk = smooth(0.32, 0.88, night);
    const mcx = -12, mcy = -140, mr = 7.2;
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const d1 = dx * dx + dy * dy, d2 = (dx - 3.2) * (dx - 3.2) + (dy + 1.6) * (dy + 1.6);
        if (d1 <= mr * mr && d2 > (mr - 1.2) * (mr - 1.2)) {
          const px = mcx + dx, py = mcy + dy;
          const xi = px - X0, yi = py - Y0;
          if (xi >= 0 && xi < W && yi >= 0 && yi < H && sc.depthBuf[yi * W + xi] === -1) {
            q.blend(px, py, d1 > (mr - 1.5) * (mr - 1.5) ? WHITE : Cy[5], sk * 0.90);
          }
        }
      }
    }
    q.glow(mcx - 2, mcy, 18, Cy[3], 0.22 * sk);

    for (let i = 0; i < 28; i++) {
      const sx = -98 + rand(S, i, 31) * 196, sy = -164 + rand(S, i, 32) * 94;
      if (Math.hypot(sx - mcx, sy - mcy) < 13) continue;
      const xi = Math.floor(sx) - X0, yi = Math.floor(sy) - Y0;
      if (xi >= 0 && xi < W && yi >= 0 && yi < H && sc.depthBuf[yi * W + xi] === -1) {
        const tw = (0.42 + 0.58 * Math.sin(cyc(t, 1 + (i % 2), i * 1.7))) * sk;
        q.dot(sx, sy, i % 4 === 0 ? Cy[6] : WHITE, tw * 0.82);
      }
    }
  }

  // Mid-to-far ferns, bark-coiling lianas & botanical mushroom tufts (back-to-front)
  for (const f of sc.ferns) if (f[3] >= 1) drawFern(q, f, t, night, Cy, Vi, Fo);
  for (let i = sc.vines.length - 1; i >= 0; i--) {
    if (sc.vines[i].pts[0][2] >= 0.20) drawWoodyVine(q, sc.vines[i], sc, t, night, Cy, Vi, Fo);
  }
  for (let i = sc.mushrooms.length - 1; i >= 0; i--) {
    const m = sc.mushrooms[i];
    if (m.z >= 0.20) drawBotanicalMushroom(q, m, t, night, bioBreath(t, m.z, m.ph), Cy, Vi, Fo);
  }

  // Slow, weightless mid-air drifting dandelion pappus seeds (~6.5 px/s gentle breeze)
  for (let i = 0; i < 14; i++) {
    const R = (k) => rand(S + 41, i, k);
    const u = (t / D + R(1)) % 1;
    const env = Math.sin(Math.PI * u);
    const x = (-126 + R(6) * 252) + (u - 0.5) * 74 + 5 * Math.sin(u * TAU + i);
    const y = (-138 + R(2) * 102) - (u - 0.5) * 18 + 6 * Math.sin(u * TAU + R(3) * TAU);
    const swing = 0.26 * Math.sin(u * TAU * 2 + R(4) * TAU);
    drawDandelionFluff(q, x, y, swing, 0.46 + R(5) * 0.32, env, night, Cy, Vi, Fo, i);
  }
  drawFireflySwarms(q, t, S, Ff, night, false);
}

export function draw(p, t, o) {
  const q = clip(p, meta), S = o.seed;
  const Cy = fit(o.palette, 7), Vi = fit(o.violet, 7), Ff = fit(o.firefly, 6), Fo = fit(o.forest, 8);
  const night = nightEnv(t);
  const sc = buildScene(S);

  // Foreground ferns, woody nurse-log/root vines & hero 3D mushroom colonies (awaken FIRST!)
  for (const f of sc.ferns) if (f[3] === 0) drawFern(q, f, t, night, Cy, Vi, Fo);
  for (let i = sc.vines.length - 1; i >= 0; i--) {
    if (sc.vines[i].pts[0][2] < 0.20) drawWoodyVine(q, sc.vines[i], sc, t, night, Cy, Vi, Fo);
  }
  for (let i = sc.mushrooms.length - 1; i >= 0; i--) {
    const m = sc.mushrooms[i];
    if (m.z < 0.20) drawBotanicalMushroom(q, m, t, night, bioBreath(t, m.z, m.ph), Cy, Vi, Fo);
  }

  // Slow foreground feathery dandelion pappus seeds + foreground fireflies
  for (let i = 0; i < 7; i++) {
    const R = (k) => rand(S + 79, i, k);
    const u = (t / D + R(1)) % 1;
    const env = Math.sin(Math.PI * u);
    const x = (-120 + R(6) * 240) + (u - 0.5) * 84 + 6 * Math.sin(u * TAU + i * 1.7);
    const y = (-118 + R(2) * 92) - (u - 0.5) * 22 + 8 * Math.sin(u * TAU + R(3) * TAU);
    const swing = 0.32 * Math.sin(u * TAU * 2 + R(4) * TAU);
    drawDandelionFluff(q, x, y, swing, 0.94 + R(5) * 0.28, env, night, Cy, Vi, Fo, i);
  }
  drawFireflySwarms(q, t, S, Ff, night, true);
}
