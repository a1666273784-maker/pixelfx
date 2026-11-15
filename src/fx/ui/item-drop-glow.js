// Translucent three-tier item-drop rarity UI beacons (Rare Blue, Epic Purple, Legendary Gold).
// Uses continuous polynomial-Gaussian alpha blending (p.blendPx) and additive light (p.add) —
// zero Bayer dithering (no black dots between particles), a continuous atmospheric glow field,
// and a sheer, non-occluding item cradle (alpha <= 0.22 in the item zone) so the effect can be
// overlaid directly on any item sprite.
import {
  fit,
  clamp,
  lerp,
  seg,
  smooth,
  ease,
  Rng,
  TAU,
  WHITE,
} from "../../core/index.js";

const BLUE_DEFAULT = ["#07152e", "#112f62", "#1e57a8", "#358ce8", "#6bc0ff", "#aee3ff", "#e2f6ff", "#ffffff"];
const PURPLE_DEFAULT = ["#15082c", "#2f125e", "#5820a4", "#8c3ce0", "#be6aff", "#dfa8ff", "#f5dfff", "#ffffff"];
const GOLD_DEFAULT = ["#2b1304", "#632f08", "#a85c10", "#e6961c", "#ffcb3d", "#ffe98a", "#fff7cc", "#ffffff"];

export const meta = {
  name: "Item drop glow",
  desc: "Three translucent item-drop rarity UI beacons (sapphire spire, amethyst double-helix vortex, sovereign gold solar fan) that frame and illuminate items without occluding them.",
  tags: ["ui", "loot", "drop", "rarity", "beam", "glow", "item", "one-shot"],
  size: [272, 152],
  origin: [136, 124],
  duration: 3.45,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: GOLD_DEFAULT,
    blue: BLUE_DEFAULT,
    purple: PURPLE_DEFAULT,
    tier: "all",
    seed: 7,
  },
};

const TIERS = [
  { key: "blue", x: -74, tDrop: 0.05, tHit: 0.21, tFold: 2.86, h: 78, w: 6.8, rx: 19, ry: 4.8 },
  { key: "purple", x: 0, tDrop: 0.19, tHit: 0.36, tFold: 2.96, h: 96, w: 8.8, rx: 24, ry: 6.0 },
  { key: "gold", x: 74, tDrop: 0.33, tHit: 0.51, tFold: 3.06, h: 112, w: 11.2, rx: 29, ry: 7.2 },
];

// Fast C1-smooth bell curve: (1 - x^2)^2 for |x| < 1
function bell(x) {
  if (x <= -1 || x >= 1) return 0;
  const u = 1 - x * x;
  return u * u;
}

// Continuous soft light-wisp / star mote with a silky vertical comet tail and wide additive halo
// so neighboring particles merge into a continuous luminous field with zero dark gaps.
function drawSoftMote(p, cx, cy, r, C, k, isStar, tailLen = 0) {
  if (k <= 0.02 || r < 0.5) return;
  const sxC = p.toX(cx, cy), syC = p.toY(cx, cy);
  const rad = r * 2.5;
  const r2Inv = 1 / (rad * rad);
  const x0 = Math.floor(sxC - rad), x1 = Math.ceil(sxC + rad);
  const y0 = Math.floor(syC - rad), y1 = Math.ceil(syC + rad + tailLen);

  for (let sy = y0; sy <= y1; sy++) {
    const dy = sy + 0.5 - syC;
    // Elongate downward into a soft comet tail when dy > 0 and tailLen > 0
    const effDy = dy > 0 && tailLen > 0 ? dy / (1 + (dy / (rad + tailLen)) * 1.45) : dy;
    const dy2 = effDy * effDy;
    for (let sx = x0; sx <= x1; sx++) {
      const dx = sx + 0.5 - sxC;
      const d2 = (dx * dx + dy2) * r2Inv;
      if (d2 >= 1) continue;
      const u = 1 - d2;
      let wCore = u * u * u;
      let wHalo = u * (0.65 + 0.35 * u);
      if (isStar && dy < rad) {
        const ax = Math.max(
          bell(dx / (r * 0.48)) * bell(dy / (rad * 0.92)),
          bell(dy / (r * 0.48)) * bell(dx / (rad * 0.92)),
        );
        wCore = Math.max(wCore, ax * 0.92);
        wHalo = Math.max(wHalo, ax);
      }
      const aCore = wCore * k;
      const aHalo = wHalo * k;
      if (aHalo <= 0.01) continue;
      if (d2 < 0.24 && aCore > 0.02) {
        p.blendPx(sx, sy, d2 < 0.07 ? WHITE : C[6], Math.min(0.38, aCore * 0.42));
      }
      p.add(sx, sy, d2 < 0.18 ? C[6] : d2 < 0.52 ? C[5] : C[4], Math.min(0.72, aHalo * 0.56));
    }
  }
}

export function create(o) {
  const G = fit(o.palette, 8);
  const B = fit(o.blue ?? BLUE_DEFAULT, 8);
  const M = fit(o.purple ?? PURPLE_DEFAULT, 8);
  const ramps = { blue: B, purple: M, gold: G };
  const R = new Rng(o.seed);
  const end = meta.duration - 0.05;

  const active =
    o.tier === "blue"
      ? [{ ...TIERS[0], x: 0 }]
      : o.tier === "purple"
        ? [{ ...TIERS[1], x: 0 }]
        : o.tier === "gold"
          ? [{ ...TIERS[2], x: 0 }]
          : TIERS;

  const states = active.map((cfg) => {
    const idx = cfg.key === "blue" ? 0 : cfg.key === "purple" ? 1 : 2;
    return {
      ...cfg,
      idx,
      C: ramps[cfg.key],
      motes: [],
      acc: 0,
      spawnCount: 0,
      halos: [],
      nextHalo: cfg.tHit + 0.08,
    };
  });

  let t = 0;

  function renderTier(p, st, layer) {
    const { C, x: cx, tDrop, tHit, tFold, h: H, w: W0, rx, ry, idx } = st;
    if (t < tDrop) return;
    const endT = meta.duration - 0.04;

    // 0. Smooth translucent sky-fall streak before impact (tDrop .. tHit)
    if (t < tHit) {
      if (layer === "front") return;
      const u = ease.inQuad(seg(t, tDrop, tHit));
      const yHead = lerp(-H, 0, u);
      const yTail = Math.max(-H - 8, yHead - (28 + idx * 10));
      const w = 1.8 + idx * 0.45;
      p.each(cx - w - 1, yTail, cx + w + 1, yHead + 2, (lx, ly, sx, sy) => {
        const dx = Math.abs(lx - cx);
        if (dx > w) return;
        const v = clamp((ly - yTail) / Math.max(1, yHead - yTail));
        const k = (1 - dx / w) * v;
        p.blendPx(sx, sy, v > 0.7 ? WHITE : C[6], k * 0.52);
        p.add(sx, sy, C[5], k * 0.68);
      });
      drawSoftMote(p, cx, yHead, 2.0 + idx * 0.35, C, 0.82, true, 0);
      return;
    }

    const aHit = t - tHit;
    const fadeOut = 1 - ease.inCubic(seg(t, tFold, endT));
    if (fadeOut <= 0.01) return;

    const openK = ease.outExpo(clamp(aHit / 0.16));
    const liftK = ease.inCubic(seg(t, tFold, endT));
    const beat = bell(Math.min(1, aHit * 2.2));

    const top = -Math.round(H * openK);
    const bot = -Math.round(H * liftK);

    // BACK LAYER: Continuous Translucent Pillar + Atmospheric Veil + Floor Pedestal + Climbing Halos
    if (layer !== "front") {
      // 1. Perspective Floor Pedestal around dy = 0
      const prx = rx * openK * (0.75 + 0.25 * fadeOut);
      const pry = ry * openK * (0.75 + 0.25 * fadeOut);
      const prxInv = 1 / Math.max(1, prx);
      const pryInv = 1 / Math.max(1, pry);
      const pedW = Math.ceil(prx * 1.35 + 2);
      const pedH = Math.ceil(pry * 1.35 + 2);

      p.each(cx - pedW, -pedH, cx + pedW, pedH, (lx, ly, sx, sy) => {
        const nx = (lx - cx) * prxInv;
        const ny = ly * pryInv;
        const pd2 = nx * nx + ny * ny;
        if (pd2 >= 1.8) return;
        const pd = Math.sqrt(pd2);
        const r1 = bell((pd - 0.92) * 6.5);
        const r2 = idx >= 1 ? bell((pd - 0.62) * 7.0) : 0;
        const r3 = idx === 2 ? bell((pd - 0.34) * 7.5) : 0;
        const poolFill = Math.max(0, 1 - pd * 0.85) * 0.28;
        const pVal = (Math.max(r1, r2 * 0.9, r3 * 0.95) * 0.78 + poolFill) * (1 + 0.25 * beat) * fadeOut;
        if (pVal <= 0.015) return;
        const col = r1 > 0.6 || r2 > 0.6 || r3 > 0.6 ? C[6] : C[5];
        p.blendPx(sx, sy, col, Math.min(0.46, pVal * 0.48));
        p.add(sx, sy, C[5], Math.min(0.78, pVal * 0.68));
      });

      // 2. Ascending Translucent Rarity Pillar + Wide Atmospheric Glow Veil
      const sxCenter = Math.round(p.toX(cx, 0));
      const syTop = Math.round(p.toY(cx, top));
      const syBot = Math.round(p.toY(cx, bot));
      const atmoWInv = 1 / (rx * 1.05);

      for (let sy = syTop; sy <= syBot; sy++) {
        const ly = p.fromY(sxCenter + 0.5, sy + 0.5);
        const h = -ly;
        if (h < 0 || h > H) continue;
        const u = h / H;
        const vFade = (1 - smooth(0.22, 1, u)) * smooth(bot + 2, bot - 6, ly) * fadeOut;
        if (vFade <= 0.015) continue;

        const flareBase = bell(Math.min(1, h / 11)) * (2.5 + idx);
        const baseW = W0 * (1 - 0.42 * u) + flareBase;
        const baseWInv = 1 / Math.max(1, baseW);

        // Item Sanctuary Zone around h = 15 (ly = -15):
        // Keep central color alpha gentle (<= 0.20) so an overlaid item sprite is NEVER occluded
        const itemZoneY = bell((h - 15) / 13);
        const atmoY = bell(u * 1.18) * 0.34 * vFade;

        // Precompute per-row helix constants
        const helAmp = idx === 1 ? 6.2 * (1 - 0.32 * u) * openK : 0;
        const ph1 = idx === 1 ? ly * 0.11 + t * 6.2 : 0;
        const hx1 = idx === 1 ? Math.sin(ph1) * helAmp : 0;
        const hx2 = -hx1;
        const hb1 = idx === 1 ? 0.78 + 0.22 * Math.cos(ph1) : 0;
        const hb2 = idx === 1 ? 0.78 - 0.22 * Math.cos(ph1) : 0;

        const rowHalfW = Math.ceil(Math.max(rx * 1.02, idx === 2 ? baseW + h * 0.28 + 3 : baseW * 1.4 + 3));
        const sx0 = sxCenter - rowHalfW;
        const sx1 = sxCenter + rowHalfW;

        for (let sx = sx0; sx <= sx1; sx++) {
          const lx = p.fromX(sx + 0.5, sy + 0.5);
          const dx = lx - cx;
          const adx = Math.abs(dx);
          const q = adx * baseWInv;

          const itemZoneX = bell(dx / 9.5);
          const nonOccludeCol = 1 - 0.68 * itemZoneY * itemZoneX;
          const nonOccludeLight = 1 - 0.42 * itemZoneY * itemZoneX;

          // Wide atmospheric light veil across the particle flank zone so there is never bare dark bg between motes
          const atmo = bell(adx * atmoWInv) * atmoY;
          if (atmo > 0.012) {
            p.add(sx, sy, C[4], atmo * nonOccludeLight);
          }

          // Subtle peripheral sanctuary rim at r = 10.5..13 around (cx, -15)
          let sanctRim = 0;
          if (itemZoneY > 0.05) {
            const rDist = Math.sqrt(dx * dx + (h - 15) * (h - 15));
            sanctRim = bell((rDist - (10.5 + idx * 1.2)) / 2.6) * 0.42;
          }

          let val = sanctRim;
          let col = C[5];

          if (idx === 0) {
            // BLUE (Rare): Sleek Sapphire Frost-Prism Spire with ascending diamond wave crests
            if (q < 1.35) {
              const body = bell(q * 0.78);
              const rim = bell((q - 0.68) * 3.8) * 0.52;
              const dWave = (0.5 + 0.5 * Math.sin(h * 0.22 - t * 7.5 - adx * 0.35)) * 0.28 * bell(q * 0.85);
              val = Math.max(val, body * 0.66 + rim + dWave);
              if (q < 0.32 || rim > 0.35) col = C[6];
            }
          } else if (idx === 1) {
            // PURPLE (Epic): Braided Double-Helix Vortex Ribbons + Soft Arcane Core
            const core = bell(q * 0.92) * 0.48;
            const rib1 = bell((dx - hx1) * 0.36) * hb1;
            const rib2 = bell((dx - hx2) * 0.36) * hb2;
            val = Math.max(val, core, rib1 * 0.88, rib2 * 0.88);
            if (rib1 > 0.62 || rib2 > 0.62) col = WHITE;
            else if (val > 0.45) col = C[6];
          } else {
            // GOLD (Legendary): Sovereign Pillar + 4 Diagonal Solar Fan Wings + Flowing Silk Strands
            if (q < 1.35) {
              const body = bell(q * 0.76);
              const strand = 0.8 + 0.2 * Math.sin(dx * 0.68 + h * 0.14 - t * 8.5);
              val = Math.max(val, body * strand * 0.82);
            }
            if (h <= H * 0.86) {
              const fwInv = 1 / (2.0 + h * 0.015);
              const f1 = h < H * 0.86 ? bell((adx - h * 0.135) * fwInv) * (1 - h / (H * 0.86)) * 0.66 : 0;
              const f2 = h < H * 0.68 ? bell((adx - h * 0.255) * fwInv) * (1 - h / (H * 0.68)) * 0.56 : 0;
              val = Math.max(val, f1, f2);
            }
            if (q < 0.28 || val > 0.68) col = WHITE;
            else if (val > 0.42) col = C[6];
          }

          if (val <= 0.02) continue;
          const cAlpha = val * vFade * 0.44 * nonOccludeCol;
          const lAlpha = val * vFade * 0.72 * nonOccludeLight;
          p.blendPx(sx, sy, col, Math.min(0.45, cAlpha));
          p.add(sx, sy, C[5], Math.min(0.78, lAlpha));
        }
      }

      // 3. Climbing 3D Gaussian Halo Rings (Purple & Gold)
      for (const h0 of st.halos) {
        const hk = (t - h0) / 0.72;
        if (hk > 0 && hk < 1) {
          const hy = -6 - H * 0.74 * ease.outQuad(hk);
          const hrx = (W0 * 1.35 + 2.5) * (1 - 0.35 * hk);
          const hry = Math.max(1.8, hrx * 0.26);
          const hrxInv = 1 / hrx, hryInv = 1 / hry;
          const hw = Math.ceil(hrx * 1.3 + 2), hh = Math.ceil(hry * 1.3 + 2);
          p.each(cx - hw, hy - hh, cx + hw, hy + hh, (lx, ly, sx, sy) => {
            const nx = (lx - cx) * hrxInv, ny = (ly - hy) * hryInv;
            const hd = Math.sqrt(nx * nx + ny * ny);
            const hBand = bell((hd - 0.92) * 4.2) * (1 - hk) * (ly >= hy ? 1.1 : 0.55) * fadeOut;
            if (hBand <= 0.02) return;
            p.blendPx(sx, sy, hBand > 0.45 ? WHITE : C[6], Math.min(0.44, hBand * 0.46));
            p.add(sx, sy, C[5], Math.min(0.7, hBand * 0.64));
          });
        }
      }
    }

    // FRONT LAYER: Expanding Floor Shockwaves + Peripheral UI Reticle Brackets + Structured Comet Motes
    if (layer !== "back") {
      // 1. Expanding floor shockwaves on impact
      const waveCount = idx + 1;
      for (let wIdx = 0; wIdx < waveCount; wIdx++) {
        const wk = (aHit - wIdx * 0.09) / (0.52 + wIdx * 0.08);
        if (wk > 0 && wk < 1) {
          const wrx = 4 + rx * (1.12 + wIdx * 0.14) * ease.outCubic(wk);
          const wry = wrx * 0.25;
          const wa = (1 - wk) * 0.44 * fadeOut;
          const steps = Math.ceil(wrx * TAU * 1.3);
          for (let j = 0; j < steps; j++) {
            const g = (j / steps) * TAU;
            const wx = cx + Math.cos(g) * wrx;
            const wy = Math.sin(g) * wry;
            p.blend(wx, wy, wk < 0.2 ? WHITE : C[6], wa);
            p.light(wx, wy, C[5], wa * 0.62);
          }
        }
      }

      // 2. Peripheral Translucent UI Drop Reticle Brackets framing the item hover zone (y = -15, |dx| = 10..15)
      const retFade = (1 - smooth(tFold - 0.05, tFold + 0.18, t)) * fadeOut;
      if (retFade > 0.04) {
        const ry0 = -15 + Math.sin(t * 4.2 + idx) * 1.2;
        const rr = 10.5 + idx * 1.5;
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            const bx = cx + sx * rr, by = ry0 + sy * (rr * 0.65);
            for (let d = 0; d <= 3 + idx; d++) {
              p.blend(bx - sx * d, by, d === 0 ? WHITE : C[6], 0.48 * retFade);
              p.light(bx - sx * d, by, C[5], 0.4 * retFade);
              p.blend(bx, by - sy * d, d === 0 ? WHITE : C[6], 0.48 * retFade);
              p.light(bx, by - sy * d, C[5], 0.4 * retFade);
            }
          }
          if (idx === 2) {
            const wx = cx + sx * (rr + 3);
            for (let d = -4; d <= 4; d++) {
              const xOff = (4 - Math.abs(d)) * 0.75 * sx;
              p.blend(wx + xOff, ry0 + d, Math.abs(d) <= 1 ? WHITE : C[6], 0.52 * retFade);
              p.light(wx + xOff, ry0 + d, C[5], 0.44 * retFade);
            }
          }
        }
      }

      // 3. Structured Rising Comet-Stream Motes (evenly spaced lanes with silky vertical tails)
      for (const m of st.motes) {
        const k = Math.min(1, m.age / 0.16, (m.life - m.age) / 0.34) * fadeOut;
        drawSoftMote(p, cx + m.x, m.y, m.r, C, k, m.star, m.tail);
      }

      // 4. Base Pedestal Crown Glint (at y = -1, below the item hover zone)
      drawSoftMote(p, cx, -1, (2.2 + idx * 0.5 + 1.4 * beat) * fadeOut, C, (0.6 + 0.28 * beat) * fadeOut, true, 0);
    }
  }

  return {
    update(dt) {
      t += dt;
      for (const st of states) {
        const { tHit, tFold, idx, w: W0, rx, h: H } = st;
        if (idx >= 1 && t >= st.nextHalo && t < tFold - 0.25) {
          st.halos.push(t);
          st.nextHalo += idx === 2 ? 0.38 : 0.56;
        }
        if (t >= tHit && t < tFold - 0.18) {
          // Moderate, well-spaced spawn rate so particles form clean ascending streams without clumping
          const rate = idx === 0 ? 5.5 : idx === 1 ? 8.0 : 10.5;
          st.acc += dt * rate;
          while (st.acc >= 1) {
            st.acc -= 1;
            const n = st.spawnCount++;
            const side = n % 2 === 0 ? 1 : -1;
            // Golden-ratio lane stepping across [W0 * 0.62, rx * 0.78] prevents two motes from spawning right on top of each other
            const lane = ((n * 0.618034) % 1);
            const x0 = side * lerp(W0 * 0.62, rx * 0.78, lane);
            st.motes.push({
              x0,
              x: x0,
              y: -R.range(2, 6),
              vy: R.range(30, 46 + idx * 10),
              swayAmp: R.range(0.8, 1.8),
              swayFreq: R.range(2.2, 3.6),
              ph: n * 1.9 + R.range(-0.3, 0.3),
              r: R.range(1.6, 2.2 + idx * 0.3),
              tail: R.range(3.5, 6.0 + idx * 1.5),
              star: n % 3 === 0,
              age: 0,
              life: Math.min(R.range(0.85, 1.35), end - t),
            });
          }
        }
        for (let i = st.motes.length - 1; i >= 0; i--) {
          const m = st.motes[i];
          m.age += dt;
          m.y -= m.vy * dt;
          const pullIn = m.y < -24 ? smooth(-24, -H * 0.85, m.y) * 0.38 : 0;
          m.x = m.x0 * (1 - pullIn) + Math.sin(m.age * m.swayFreq + m.ph) * m.swayAmp;
          if (m.age >= m.life || m.y < -H - 4) st.motes.splice(i, 1);
        }
      }
    },

    drawBack(p) {
      for (const st of states) renderTier(p, st, "back");
    },

    draw(p) {
      for (const st of states) renderTier(p, st, "front");
    },
  };
}
