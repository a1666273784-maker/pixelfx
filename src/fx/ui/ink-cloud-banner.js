// Ink-wash cloud sea: a zone notice that gathers out of the sky, cuts itself open and hangs heavy, then lets
// go and streams off sideways. The banded pixel mist (a baked tiling noise, warped, cut into a few translucent
// tones with Bayer edges, a lit crest wherever a band meets thinner fog) is the recipe of Sprite Fusion's
// open-source fog (https://www.spritefusion.com/pixel-art-vfx/fog), MIT License, Copyright (c) 2026 Hugo
// Duprez; the wind-blown motes that carry the notice away follow our own spawn/disintegrate.
import {
  Particles, Lights, P, Rng, fit, clamp, seg, smooth, ease, noise, noise2, rand, mix, scale, hex, luma,
  TAU, WHITE, sparkle, createFrame, painterFor,
} from "../../core/index.js";
import { rows, bayer, field, sample, box, clip } from "../weather/_lib.js";
import { spell, drawWord, shake } from "./_lib.js";

export const meta = {
  name: "Ink cloud banner",
  desc: "Two currents of ink-blue and pale pixel cloud gather up top, part as a withered-yellow line ignites and a cold-white zone notice swells solid, then stream off as pale-cyan mist.",
  tags: ["ui", "banner", "zone", "notice", "ink", "mist", "cloud", "sea", "chinese", "one-shot"],
  size: [320, 180],
  origin: [160, 40],
  duration: 4.62,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    // 黛青 -> 苍白: the two currents of pixel cloud, deep ink-blue to pale grey-white
    palette: ["#0a1014", "#14212a", "#223844", "#38575f", "#587f84", "#87a6a6", "#b7c8c4", "#e9efec"],
    // 枯黄: the withered-yellow hairline and its dust
    gold: ["#241d0c", "#3f3315", "#61501f", "#8a7330", "#b09648", "#cbb469", "#e2d396", "#f7f0d2"],
    // 冷白: the zone notice's own light
    cold: ["#1b2b34", "#33525e", "#5d8492", "#93b6bf", "#c3dce2", "#e8f4f8", "#ffffff"],
    // 淡青: what the whole thing turns into on the wind
    fade: ["#16343a", "#27565c", "#3f7c80", "#63a2a2", "#93c8c2", "#c4e6dc", "#e8f6ef"],
    text: "CLOUD SEA",
    sub: "NEW AREA",
    wind: 1,
    seed: 11,
  },
};

const W = 320, H = 180, OX = 160, OY = 40, B = box(meta);
const INK = hex("#05080b");
// the notice, top to bottom: its crown rule, the title, the withered-yellow spine, the small line under it
const BAND_T = -31, BAND_B = 15, BAND_HW = 113, TITLE_Y = -27, SUB_Y = 5;
const SPINE_Y = 0, HALF = 100, CAP = 4;
// the beats: the currents meet, the line ignites, the channel opens, the notice goes solid, it lets go
const GATHER = 0.84, HIT = 0.84, OPEN = 1.46, RISE = 0.94, SOLID = 1.68, BLOOM = 1.38, PRESS = 1.72;
const SCATTER = 3.14, GONE = 4.5, DUR = 4.62;
// the strips the notice tears into: they peel from the bottom up and stream off horizontally
const NS = 15, SY0 = -40, SH = 4;

// the mist front: it sweeps in from off-canvas to the middle, then is shoved out to either side and drifts off
function front(t) {
  if (t < HIT) return 238 * (1 - ease.outQuad(seg(t, 0.03, GATHER)));
  return 118 * ease.outCubic(seg(t, HIT, OPEN)) + 46 * ease.inQuad(seg(t, OPEN, GONE));
}
// how far the cloud pattern has travelled: inward while it gathers, outward once it is pushed apart
function flowAt(t) {
  return t < HIT ? -80 * ease.inOutSine(seg(t, 0, GATHER)) : -80 + 268 * ease.outQuad(seg(t, HIT, GONE));
}
const diss0 = (t) => seg(t, SCATTER, GONE);

// 黛青 below, 苍白 riding higher and leading it: two currents, two speeds, two tones, two densities
const MIST = [
  { top: -25, bot: 26, sx: 0.92, sy: 1.6, flow: 1, lead: 0, alpha: 0.5, th1: 0.55, th2: 0.8, tone: [1, 2, 3], crest: 5, warp: 24, fk: 3 },
  { top: -34, bot: -4, sx: 1.45, sy: 2.05, flow: 1.45, lead: 13, alpha: 0.36, th1: 0.68, th2: 0.92, tone: [4, 5, 6], crest: 7, warp: 30, fk: 9 },
];
const BULGE = 8;
// scratch for the mist: the warp per column, and two rows of density history so a band's top can catch light
const WARP = new Float32Array(W), PREV = [new Float32Array(W), new Float32Array(W)], PREV2 = [new Float32Array(W), new Float32Array(W)];
// how much heavier the ink sits towards the edges of the screen (baked: it never changes)
const EDGE = Float32Array.from({ length: W }, (_, i) => smooth(94, 170, Math.abs(B.x0 + i + 0.5)));
// where the ink veil presses: the sky above the notice and the depth below it
const VEIL_BANDS = [[B.y0, -16], [114, B.y1 - 1]];
// the mist's three band tones per layer, mixed again as it dissolves (scratch: no arrays per frame)
const TONES = [[0, 0, 0], [0, 0, 0]];
// a drawing state that leaves everything where it is: what the mist and the light shafts are drawn with
const FLAT = { y0: -1e4, y1: 1e4, dx: 0, dy: 0, a: 1, tone: 0, tear: 0 };

/** A soft flattened ring of mist: an annulus blended, not dithered, lit a little along its top. */
function mistRing(p, cx, cy, rx, ry, w, c, a) {
  if (a <= 0.012 || rx < 1.5 || ry < 0.6) return;
  if (cx + rx < B.x0 || cx - rx > B.x1 || cy + ry < B.y0 || cy - ry > B.y1) return;
  p.each(Math.max(B.x0, cx - rx - 2), Math.max(B.y0, cy - ry - 2), Math.min(B.x1 - 1, cx + rx + 2), Math.min(B.y1 - 1, cy + ry + 2), (x, y) => {
    const dx = (x - cx) / rx, dy = (y - cy) / ry, d = Math.hypot(dx, dy);
    if (d > 1.32) return;
    const q = (d - 1) / w, g = 1 - q * q * 2.1, f = (g > 0 ? g * g : 0) * (d < 1 ? 1 : 0.7);
    if (f * a < 0.012) return;
    p.blend(x, y, mix(c, WHITE, clamp(0.3 * (1 - dy))), f * a);
  });
}

/**
 * The notice's words, rasterized once into a list of pixels, so every one of them can flicker up out of
 * nothing, hold solid, then tear loose and blow away on its own.
 */
function notice(o, K, G) {
  const title = spell(o.text, "big"), sub = spell(o.sub, "mini");
  const f = createFrame(W, H), p = painterFor(f).place(OX, OY), list = [];
  const TS = 2, tx = (-title.w * TS) / 2;
  drawWord(
    p,
    title.letters.filter((L) => L.g).map((L) => ({ g: L.g, x: tx + L.x * TS, y: TITLE_Y, sx: TS, sy: TS })),
    { fill: [K[3], K[4], K[5], WHITE], edge: WHITE, under: K[3], outline: INK, shadow: scale(INK, 0.45) },
  );
  const sx = -sub.w / 2;
  drawWord(
    p,
    sub.letters.filter((L) => L.g).map((L) => ({ g: L.g, x: sx + L.x, y: SUB_Y, sx: 1, sy: 1 })),
    { fill: [G[3], G[4], G[5]], edge: G[6], under: G[2], outline: INK, shadow: scale(INK, 0.45) },
  );
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = f.color[y * W + x];
      if (!(c >>> 24)) continue;
      const lx = x - OX, ly = y - OY;
      list.push({
        x: lx, y: ly, c, l: luma(c), title: ly < -1,
        // it emerges from the middle out, on a front of its own
        key: clamp(0.62 * seg(Math.abs(lx), 6, BAND_HW - 4) + 0.38 * rand(x, y, o.seed + 31)),
        fk: rand(x, y, o.seed + 47),
      });
    }
  return list;
}

export function create(o) {
  const C = fit(o.palette, 8), G = fit(o.gold, 8), K = fit(o.cold, 7), F = fit(o.fade, 7), S = o.seed;
  const wind = o.wind < 0 ? -1 : 1;
  const R = new Rng(S);
  const ps = new Particles({ rng: R, sparks: [K[6], K[5], G[6], G[4]], haze: F[4] }), lights = new Lights();
  const letters = notice(o, K, G);
  // the pixels come out row by row, so one table of row starts is enough to slice them per strip
  const LY0 = letters.length ? letters[0].y : 0, LY1 = letters.length ? letters[letters.length - 1].y + 1 : 1;
  const LROW = new Int32Array(LY1 - LY0 + 1);
  {
    let j = 0;
    for (let y = LY0; y <= LY1; y++) {
      LROW[y - LY0] = j;
      while (j < letters.length && letters[j].y < y) j++;
    }
  }
  const strips = Array.from({ length: NS }, (_, i) => {
    const t0 = SCATTER + (NS - 1 - i) * 0.045 + rand(i, S, 3) * 0.05;
    return {
      i, y0: SY0 + i * SH, y1: SY0 + (i + 1) * SH, t0,
      v: 78 + rand(i, S, 4) * 104,
      lift: 1 + rand(i, S, 5) * 5,
      dur: Math.min(0.5 + rand(i, S, 6) * 0.24, GONE - t0),
      ph: rand(i, S, 7) * TAU,
    };
  });
  // ink hanging off the banner's foot: it lengthens, wavers, swells a bead and lets it fall
  const drips = Array.from({ length: 9 }, (_, i) => ({
    x: (i / 8 - 0.5) * 2 * (BAND_HW - 18) + (rand(i, S, 11) - 0.5) * 11,
    len: 8 + rand(i, S, 12) * 17,
    ph: rand(i, S, 13) * TAU,
    t0: SOLID + rand(i, S, 14) * 0.42,
    fall: 0.42 + rand(i, S, 15) * 0.5,
  }));
  // the pale-cyan sheets the notice turns into: layer upon layer, each with its own speed
  const sheets = Array.from({ length: 9 }, (_, i) => {
    const t0 = SCATTER - 0.12 + i * 0.072 + rand(i, S, 23) * 0.12;
    return {
      y: -33 + i * 8 + rand(i, S, 21) * 5, h: 2 + rand(i, S, 22) * 3.6, t0,
      v: 56 + rand(i, S, 24) * 128, life: Math.min(0.9 + rand(i, S, 25) * 0.7, GONE - t0),
      ph: rand(i, S, 26) * TAU, tone: rand(i, S, 27) < 0.5 ? 4 : 5, near: i % 3 === 2,
    };
  });
  // cold light falling from the banner down the screen: the weight of it
  const beams = Array.from({ length: 7 }, (_, i) => ({
    x: (i / 6 - 0.5) * 2 * (BAND_HW - 12) + (rand(i, S, 31) - 0.5) * 9,
    w: 3 + rand(i, S, 32) * 6, ph: rand(i, S, 34) * TAU, k: 0.5 + rand(i, S, 35) * 0.6,
  }));
  const streaks = [], drift = [];
  const released = new Array(NS).fill(false);
  let t = 0, hitDone = false, bloomed = false, pressed = false;
  const end = DUR - 0.07;
  const spawn = (k, x, y, vx, vy, life, ...rest) => {
    const l = Math.min(life, end - t);
    if (l > 0.05) ps.spawn(k, x, y, vx, vy, l, ...rest);
  };
  const gust = (tt) => 0.72 + 0.5 * (noise(tt * 1.5, 11) * 0.5 + 0.5);
  // the banner's own weight: it drops a hair as it goes solid and settles, then breathes while it holds
  const pressAt = (tt) => {
    const a = tt < SOLID ? 0 : 2.6 * (1 - Math.exp(-(tt - SOLID) * 26)) * Math.exp(-(tt - SOLID) * 5.5);
    return a + (tt > SOLID && tt < SCATTER ? 0.55 * Math.sin((tt - SOLID) * 2.3) : 0);
  };
  const offs = () => {
    const [jx, jy] = shake(t, 2.4, HIT, 0.26, S);
    return [Math.round(jx), Math.round(jy + pressAt(t))];
  };

  // ---- the pixel cloud: one of the two currents, row by row across the canvas
  function mist(p, n, st) {
    if (t >= GONE) return;
    const L = MIST[n], FF = field(S * 7 + L.fk, 256, 128), GW = field(S * 7 + 11, 256, 128, [4, 8, 16]);
    const diss = diss0(t);
    const e = front(t) + (t < HIT ? -L.lead : L.lead), fl = flowAt(t) * L.flow, boil = t * 7.5;
    const heap = smooth(GATHER - 0.6, GATHER, t) * (1 - smooth(HIT, HIT + 0.22, t));
    const thin = 0.62 * smooth(OPEN, GONE - 0.2, t) + diss;
    const squash = 1 - 0.34 * smooth(OPEN, GONE - 0.3, t);
    const tones = TONES[n];
    for (let j = 0; j < 3; j++) tones[j] = mix(C[L.tone[j]], F[Math.min(6, L.tone[j] + 1)], diss);
    const crest = mix(C[L.crest], F[6], diss * 0.8);
    const dx = Math.round(st.dx), dy = Math.round(st.dy), Pv = PREV[n], P2 = PREV2[n];
    Pv.fill(0);
    P2.fill(0);
    const bul = heap * BULGE;
    rows(p, meta, L.top - bul - 1 + dy, L.bot + 2 + bul * 0.6 + dy, (yy, Rr) => {
      const yv = yy - dy;
      // with nothing heaped at the middle the profile is the same across the row: work it out once
      const profRow = smooth(L.top, L.top + 11, yv) * (1 - smooth(L.bot - 15, L.bot + 2, yv)) * squash;
      if (profRow <= 0.02 && bul <= 0.02) return;
      // the front is a ragged wall, not a cut: its x breathes with the row
      const eRow = e + (n ? 9 : 13) * noise(yv * 0.16 + n * 9 + boil * 0.1, 41 + n);
      // the warp noise is only worth sampling where the front can reach: two ranges, either side of the gap
      const wy = yv * 0.5 + boil * 0.4, off = dx - B.x0 - 0.5, lo = eRow - 13;
      for (let i = Math.max(0, Math.floor(off - 250)) & ~1, e1 = Math.min(W - 2, Math.ceil(off - lo)); i <= e1; i += 2)
        WARP[i] = WARP[i + 1] = sample(GW, i * 0.35 + n * 70, wy) - 0.5;
      for (let i = Math.max(0, Math.floor(off + lo)) & ~1, e1 = Math.min(W - 2, Math.ceil(off + 250)); i <= e1; i += 2)
        WARP[i] = WARP[i + 1] = sample(GW, i * 0.35 + n * 70, wy) - 0.5;
      for (let i = 0; i < W; i++) {
        const x = B.x0 + i + 0.5, xv = x - dx, ax = Math.abs(xv);
        const above = P2[i];
        P2[i] = Pv[i];
        let f = 0;
        if (ax >= eRow - 13 && ax <= 250) {
          const w = WARP[i];
          const b2 = bul > 0.02 ? bul * clamp(1 - ax / 96) : 0;
          const prof = b2 > 0.02
            ? smooth(L.top - b2, L.top - b2 + 11, yv) * (1 - smooth(L.bot + b2 * 0.6 - 15, L.bot + b2 * 0.6 + 2, yv)) * squash
            : profRow;
          // deep in the body, bright right at the front, thinning towards the edge of the screen once pushed apart
          const body = smooth(eRow - 12, eRow + 8, ax) * (1 - thin * smooth(126, 244, ax));
          const dens = (1 + heap * 0.8 * clamp(1 - ax / 82)) * body * (1 - 0.78 * diss);
          if (prof > 0.02 && dens > 0.02) {
            const nn = clamp((sample(FF, (ax - fl) * L.sx + w * L.warp, yv * L.sy + w * 9 + boil * 0.2) - 0.5) * 2.6 + 0.5) - 0.5;
            f = (dens * prof * 0.5 + nn * 1.12) * (0.55 + 0.45 * dens * prof);
          }
        }
        Pv[i] = f;
        const th = bayer(i, yv) * 0.09;
        if (f <= L.th1 * 0.6 + th) continue;
        // torn into blocks as the wind takes it
        if (diss > 0.02 && rand(Math.floor(xv / 7), Math.floor(yv / 4), 77) < diss * 0.92) continue;
        const solid = f > L.th2 ? 2 : f > L.th1 ? 1 : 0;
        const band = f > L.th2 + th ? 2 : f > L.th1 + th ? 1 : 0;
        // lit where the front is piled up, and along the top of a band where it meets thinner fog
        const crestHere = ax - eRow < 3 || (solid >= 1 && above < L.th1);
        const a = L.alpha * (0.42 + 0.3 * band) * (1 - diss * 0.9) * st.a;
        if (a <= 0.012) continue;
        Rr.c[i] = crestHere ? (band >= 1 ? crest : tones[2]) : tones[band];
        Rr.a[i] = Math.min(0.9, a * (crestHere ? 1.15 : 1));
        // only the dense core is truly translucent: the thin mist stays dithered pixel art
        Rr.b[i] = band === 2 ? 1 : 0;
        if (crestHere && band >= 1) (Rr.l[i] = crest), (Rr.k[i] = 0.06 * (1 - diss));
      }
    });
  }

  // ---- the ink pressing down on the whole screen
  function veil(p) {
    const k = seg(t, 0.06, HIT) * (1 - seg(t, SCATTER, GONE - 0.12));
    if (k <= 0.01) return;
    const press = 1 - 0.16 * smooth(HIT, PRESS, t), wob = 0.03 * noise(t * 0.6, 5);
    for (const [ya, yb] of VEIL_BANDS)
      rows(p, meta, ya, yb, (y, Rr) => {
      const v = (y - B.y0) / H;
      const base = k * (0.04 + wob + 0.54 * (1 - smooth(0, 0.22, v)) * press + 0.42 * smooth(0.74, 1, v));
      if (base <= 0.012) return;
      Rr.b.fill(1);
      const ek = 0.22 * k;
      for (let i = 0; i < W; i++) {
        const a = clamp(base + ek * EDGE[i]);
        if (a <= 0.012) continue;
        Rr.c[i] = INK;
        Rr.a[i] = a;
      }
      });
  }

  // ---- cold light falling from the banner: shafts that sway and thin with distance
  function shafts(p, st) {
    const k = seg(t, SOLID - 0.18, SOLID + 0.3) * (1 - seg(t, SCATTER - 0.06, SCATTER + 0.42));
    if (k <= 0.02) return;
    const dx = Math.round(st.dx), dy = Math.round(st.dy), y0 = BAND_B + dy;
    const ya = Math.max(B.y0, y0 + 1), yb = Math.min(B.y1 - 1, y0 + 72);
    for (let y = ya; y <= yb; y++) {
      const d = y - y0, fall = Math.pow(1 - d / 88, 1.5);
      if (fall <= 0.02) continue;
      const ka = 0.12 * k * fall * (0.6 + 0.4 * noise2(d * 0.12 - t * 2.2, t * 0.7, 3)) * st.a;
      if (ka <= 0.012) continue;
      const lk0 = 0.04 * k * fall * st.a;
      for (const s of beams) {
        const sway = 5 * Math.sin(t * 0.9 + s.ph) * (d / 90) + 3 * noise(d * 0.09 - t * 1.4, s.ph * 7);
        const cx = s.x + dx + sway * wind, hw = (s.w * (1 + d / 130)) / 2;
        const x0 = Math.max(B.x0, Math.floor(cx - hw)), x1 = Math.min(B.x1 - 1, Math.ceil(cx + hw));
        const a0 = ka * s.k, l0 = lk0 * s.k;
        for (let x = x0; x <= x1; x++) {
          const q = Math.abs(x + 0.5 - cx) / hw;
          if (q >= 1) continue;
          const a = a0 * (1 - q * q);
          if (a <= 0.012) continue;
          p.blend(x, y, K[3], a);
          if (l0 > 0.004) p.light(x, y, K[4], l0 * (1 - q));
        }
      }
    }
  }

  // ---- the banner: the cold-white wash and its rules, the ink hanging off it, the words, the spine and the
  // ripples at the spine's ends. One call draws the lot; during the scatter it is called once per strip.
  function banner(p, st) {
    const dx = Math.round(st.dx), dy = Math.round(st.dy), a = st.a, tone = st.tone, tear = st.tear;
    if (a <= 0.012) return;
    const rise = seg(t, RISE, SOLID), hw = BAND_HW * ease.outCubic(seg(t, RISE, RISE + 0.56));
    const throb = 0.82 + 0.18 * Math.sin((t - SOLID) * 2.1);
    const gone = 1 - a;
    const cold = (c) => (tone > 0.01 ? mix(c, F[4], tone) : c);
    const torn = (x, y) => tear > 0.01 && rand(Math.floor(x / 5), Math.floor(y / 3), 91) < tear;
    const inY = (y0, y1) => y1 + dy >= st.y0 && y0 + dy < st.y1;

    if (rise > 0 && hw > 2 && inY(BAND_T, BAND_B + 2)) {
      const solidK = ease.outQuad(rise);
      const ya = Math.max(BAND_T + dy, st.y0), yb = Math.min(BAND_B + 2 + dy, st.y1);
      rows(p, meta, ya, yb - 1, (yy, Rr) => {
        const yv = yy - dy;
        // densest just over the spine, thinning up to the crown and down to the foot
        const prof = Math.pow(clamp(1 - Math.abs(yv + 6) / 30), 1.35) * (0.4 + 0.6 * smooth(BAND_T, BAND_T + 10, yv));
        if (prof <= 0.012) return;
        const i0 = Math.max(0, Math.floor(dx - hw - B.x0)), i1 = Math.min(W - 1, Math.ceil(dx + hw - B.x0));
        const cWash = cold(yv > -5 && yv < 2 ? K[4] : K[3]), lWash = cold(K[4]);
        const al0 = prof * (0.16 + 0.52 * solidK) * throb * a, k0 = 0.05 * solidK * prof * a;
        for (let i = i0; i <= i1; i += 2) {
          // the mottle is a slow noise: one sample serves the pair of pixels it covers
          const xv = B.x0 + i + 0.5 - dx;
          const mottle = 0.86 + 0.28 * noise2(xv * 0.07 + t * 0.5, yv * 0.26, 17);
          for (let j = i; j < i + 2 && j <= i1; j++) {
            const xvv = B.x0 + j + 0.5 - dx, ax = Math.abs(xvv);
            if (ax > hw || torn(xvv, yv)) continue;
            const ends = 1 - 0.72 * smooth(hw - 32, hw, ax);
            const al = clamp(al0 * ends * mottle);
            if (al <= 0.008) continue;
            Rr.c[j] = cWash;
            Rr.a[j] = al;
            // a ghost is only a dithered hint of the shape; once it is solid it is a body of translucent light
            Rr.b[j] = solidK > 0.55 ? 1 : 0;
            Rr.l[j] = lWash;
            Rr.k[j] = k0 * ends;
          }
        }
      });
      // the crown and foot rules, and the caps that hold the banner's two ends together
      const ruleA = (0.72 + 0.28 * solidK) * a;
      const rule = (y, c, k2) => {
        const Y = y + dy;
        if (Y < st.y0 || Y >= st.y1 || ruleA <= 0.03) return;
        for (let x = -hw + 2; x < hw - 2; x++) {
          if (torn(x, y)) continue;
          const taper = 1 - 0.85 * smooth(hw - 18, hw - 3, Math.abs(x));
          if (taper <= 0.05) continue;
          p.dot(x + dx, Y, cold(c), Math.min(1, ruleA * taper * k2));
        }
      };
      rule(BAND_T, K[5], 1);
      rule(BAND_T - 1, INK, 0.8);
      rule(BAND_B, K[4], 0.9);
      rule(BAND_B + 1, INK, 0.65);
      for (const s of [-1, 1]) {
        const x = s * (hw - 3) + dx;
        if (x < B.x0 || x >= B.x1) continue;
        for (let y = Math.max(BAND_T + dy, st.y0); y < Math.min(BAND_B + 2 + dy, st.y1); y++) {
          if (torn(s * (hw - 3), y - dy)) continue;
          p.dot(x, y, cold(K[5]), ruleA * 0.92);
          p.dot(x + s, y, cold(INK), ruleA * 0.5);
        }
        if (BAND_T + dy + 6 >= st.y0 && BAND_T + dy + 6 < st.y1) p.glow(x, BAND_T + dy + 6, 18, cold(K[4]), 0.1 * ruleA * (1 - tone));
      }
      // the notice's own light, over the whole banner
      const mid = (BAND_T + BAND_B) / 2 + dy;
      if (mid >= st.y0 && mid < st.y1)
        p.glowLine(dx - hw + 8, mid, dx + hw - 8, mid, 19, cold(K[4]), (0.13 + 0.17 * solidK) * throb * a * (1 - tone));
    }

    // the words: up out of nothing, pixel by pixel, from the middle out; a shine sweeps them once they hold
    if (rise > 0) {
      const sh = seg(t, SOLID + 0.34, SOLID + 0.78), shine = sh > 0 && sh < 1 ? -BAND_HW + 2 * BAND_HW * ease.inOutSine(sh) : null;
      const flick = Math.floor(t * 24);
      const ry0 = Math.max(LY0, st.y0 - dy), ry1 = Math.min(LY1, st.y1 - dy);
      const li0 = ry0 < ry1 ? LROW[ry0 - LY0] : 0, li1 = ry0 < ry1 ? LROW[ry1 - LY0] : 0;
      for (let li = li0; li < li1; li++) {
        const L = letters[li];
        const y = L.y + dy;
        if (y < st.y0 || y >= st.y1) continue;
        const x = L.x + dx;
        if (x < B.x0 || x >= B.x1 || torn(L.x, L.y)) continue;
        const g = rise * 1.18 - L.key;
        if (g <= 0) continue;
        let c = L.c, al = a;
        if (g < 0.22) {
          // the ghost: faint and cold, flickering where it is about to be
          if (rand(L.x * 3 + flick, L.y, 5) < 0.28 - g * 1.1) continue;
          c = cold(L.title ? K[3] : G[3]);
          al *= 0.3 + 0.55 * (g / 0.22);
        } else {
          if (g < 0.3) c = WHITE;
          else if (tone > 0.01) c = mix(L.c, L.l > 0.45 ? F[5] : F[2], tone);
          if (shine !== null) {
            const d = Math.abs(L.x - (L.y - TITLE_Y) * 0.5 - shine);
            if (d < 1.2) c = WHITE;
            else if (d < 2.8) c = cold(L.title ? K[6] : G[6]);
          }
          if (L.fk < gone * 1.25) continue;
        }
        p.dot(x, y, c, Math.min(1, al));
      }
    }

    // the withered-yellow spine: it runs out of the middle, white-hot at the head, cooling behind it
    const u = t - HIT;
    if (u >= 0 && inY(SPINE_Y - 2, SPINE_Y + 3)) {
      const run = ease.outQuart(seg(u, 0, 0.26)), len = HALF * run, head = u < 0.3, y = SPINE_Y + dy;
      if (y >= st.y0 && y < st.y1) {
        for (let x = -Math.floor(len); x <= Math.floor(len); x++) {
          if (torn(x, SPINE_Y)) continue;
          const ax = Math.abs(x), tap = 1 - 0.92 * smooth(HALF - CAP - 10, HALF - CAP, ax);
          if (tap <= 0.04) continue;
          const cool = head ? clamp((len - ax) / 26) : 1;
          const hot = head && len - ax < 7;
          const glint = noise2(x * 0.35, t * 5.5, 21) > 0.62;
          const c = hot ? WHITE : cool < 0.3 ? G[7] : cool < 0.6 ? G[6] : glint ? G[6] : G[5];
          p.dot(x + dx, y, cold(tone > 0.4 ? mix(c, F[4], 0.5) : c), tap * a);
          // a hair of ink under it, so the line sits in the wash instead of floating on it
          if (!torn(x, SPINE_Y + 1)) p.dot(x + dx, y + 1, cold(G[1]), 0.5 * tap * a);
          if (glint && ax < len - 1 && !torn(x, SPINE_Y - 1)) p.dot(x + dx, y - 1, cold(G[4]), 0.32 * tap * a);
        }
        // the caps at its ends, where the ripples bloom
        if (run > 0.9)
          for (const s of [-1, 1])
            for (let d = -2; d <= 2; d++) {
              const yy = y + d;
              if (yy < st.y0 || yy >= st.y1 || torn(s * (HALF - CAP), SPINE_Y + d)) continue;
              p.dot(s * (HALF - CAP) + dx, yy, cold(Math.abs(d) === 2 ? G[4] : G[6]), (1 - Math.abs(d) / 3.4) * a);
            }
        // a pulse of light running out along it while it holds
        if (t > SOLID && t < SCATTER) {
          const ph = ((t - SOLID) * 0.85) % 1.6;
          if (ph < 0.8) {
            const q = ph / 0.8, w = Math.sin(q * Math.PI);
            for (const s of [-1, 1]) {
              const x0 = s * (10 + q * (HALF - 16));
              p.glow(x0 + dx, y, 13, cold(G[5]), 0.3 * w * a * (1 - tone));
              for (let d = -6; d <= 6; d++) {
                const xx = x0 + d;
                if (Math.abs(xx) > HALF - CAP || torn(xx, SPINE_Y)) continue;
                p.dot(xx + dx, y, cold(WHITE), 0.8 * (1 - Math.abs(d) / 6) * w * a);
              }
            }
          }
        }
        p.glowLine(dx - len, y, dx + len, y, 11, cold(G[4]), (head ? 0.4 : 0.2) * throb * a * (1 - tone));
        p.glowLine(dx - len, y, dx + len, y, 4, cold(G[6]), (head ? 0.4 : 0.15) * a * (1 - tone));
        if (head) {
          const k = 1 - u / 0.3;
          for (const s of [-1, 1]) {
            sparkle(p, s * (len + dx), y, 5 * k, cold(G[7]), cold(G[5]), 0.5 * a);
            p.glow(s * (len + dx), y, 22, cold(WHITE), 0.4 * k * a);
          }
        }
      }
    }

    // 雾气涟漪: three soft grey-white rings at each end of the spine, staggered, swelling and thinning
    for (const s of [-1, 1]) {
      const cx = s * (HALF - 2) + dx, cy = SPINE_Y + dy;
      if (cy < st.y0 || cy >= st.y1) continue;
      for (let i = 0; i < 3; i++) {
        const u2 = (t - BLOOM - i * 0.15) / 0.72;
        if (u2 <= 0 || u2 >= 1) continue;
        const rx = (7 + 30 * ease.outCubic(u2)) * (1 - 0.3 * diss0(t));
        mistRing(p, cx, cy, rx, rx * 0.4, 0.2, cold(i === 0 ? K[5] : C[6]), 0.3 * Math.pow(Math.sin(u2 * Math.PI), 0.75) * (1 - 0.55 * u2) * a);
      }
      const gl = (t - BLOOM) / 0.4;
      if (gl > 0 && gl < 1) sparkle(p, cx, cy, 7 * Math.sin(gl * Math.PI), cold(G[7]), cold(G[5]), 0.45 * a);
    }

    // ink hanging off the banner's foot: it grows, wavers, swells a bead and lets it fall
    for (const d of drips) {
      const age = t - d.t0;
      if (age < 0) continue;
      const grow = ease.outCubic(clamp(age / 0.7)) * (1 - seg(t, SCATTER + 0.08, SCATTER + 0.46));
      const len = d.len * grow;
      if (len < 1.5) continue;
      const sway = (k2) => (1.6 + k2 * 0.16) * Math.sin(t * 1.5 + d.ph + k2 * 0.22) * wind;
      for (let k2 = 0; k2 < len; k2++) {
        const y = BAND_B + 2 + k2 + dy;
        if (y < st.y0 || y >= st.y1 || torn(d.x, BAND_B + 2 + k2)) continue;
        const tap = (1 - k2 / len) * (0.5 + 0.5 * grow);
        p.dot(d.x + dx + sway(k2), y, cold(k2 < 2 ? C[2] : INK), tap * 0.85 * a);
        if (k2 < 3) p.light(d.x + dx + sway(k2), y, cold(K[3]), 0.1 * tap * a);
      }
      const tip = BAND_B + 2 + len, tx = d.x + dx + sway(len);
      if (tip + dy >= st.y0 && tip + dy < st.y1 && grow > 0.4) {
        const swell = 0.5 + 0.5 * Math.sin((age - 0.7) * 3.4 + d.ph);
        p.dot(tx, tip + dy, cold(C[3]), 0.8 * a);
        if (swell > 0.7) p.dot(tx, tip + dy + 1, cold(C[2]), 0.7 * a * swell);
      }
      const fu = (age - d.fall) / 0.5;
      if (fu > 0 && fu < 1 && tip + fu * fu * 46 + dy < st.y1 && tip + fu * fu * 46 + dy >= st.y0) {
        p.dot(tx + fu * 9 * wind, tip + fu * fu * 46 + dy, cold(C[3]), (1 - fu) * a);
        p.dot(tx + fu * 9 * wind - wind, tip + fu * fu * 46 + dy - 1, cold(C[2]), (1 - fu) * 0.6 * a);
      }
    }

    // the flash that cuts the whole thing open: two frames of cold white at the middle of the screen
    const hu = t - HIT;
    if (hu >= 0 && hu < 0.1 && dy >= st.y0 - 4 && dy < st.y1 + 4) {
      const k = 1 - hu / 0.1;
      if (hu < 0.04) {
        p.ellipse(dx, dy, 48 * k + 9, 9 * k + 2.5, WHITE, 0.92 * a);
        p.glow(dx, dy, 62, WHITE, 0.5 * k * a);
      } else {
        p.ellipse(dx, dy, 22 + 62 * (1 - k), 3 + 9 * (1 - k), cold(K[5]), 0.6 * k * a);
        p.glow(dx, dy, 70, cold(K[4]), 0.3 * k * a);
      }
      const rr = 20 + 96 * ease.outCubic(hu / 0.42);
      mistRing(p, dx, dy, rr, rr * 0.24, 0.14, cold(K[5]), 0.5 * k * a);
    }
  }

  // ---- the layered pale-cyan sheets the notice turns into
  function sheetsDraw(p, near) {
    for (const s of sheets) {
      if (s.near !== near || t < s.t0 || t >= s.t0 + s.life) continue;
      const age = t - s.t0, u = age / s.life;
      const driftX = wind * ((s.v * (1 - Math.exp(-2.1 * age))) / 2.1 + 34 * age);
      const fade = Math.pow(Math.sin(u * Math.PI), 0.6);
      if (fade <= 0.02) continue;
      const yTop = s.y - 3 + 3 * ease.outQuad(u);
      rows(p, meta, yTop - 1.5, yTop + s.h + 1.5, (y, Rr) => {
        const yv = y - yTop;
        const prof = clamp(1 - Math.abs(yv - s.h / 2) / (s.h / 2 + 1));
        if (prof <= 0.02) return;
        Rr.b.fill(1);
        const a0 = 0.5 * prof * fade, lk0 = 0.045 * prof * fade;
        // wind-combed: long horizontal streaks, ragged at the ends, thinning off-screen. Sampled every other
        // column: a streak is far wider than a pixel, so nothing changes but the cost.
        for (let i = 0; i < W; i += 2) {
          const xs = B.x0 + i + 0.5 - driftX;
          const streak = noise2(xs * 0.016 + s.ph, y * 1.35 - t * 0.55, 29) * 0.7 + noise2(xs * 0.05 + s.ph * 2, y * 0.7, 43) * 0.45;
          const cover = smooth(0.06, 0.66, 0.55 + streak - Math.abs(xs) / 380);
          const al = a0 * cover;
          if (cover <= 0.02 || al <= 0.012) continue;
          const c = F[s.tone], l = F[5], k = lk0 * cover;
          for (let j = i; j < i + 2 && j < W; j++) {
            if (Rr.c[j] && Rr.a[j] > al) continue;
            Rr.c[j] = c;
            Rr.a[j] = al;
            Rr.l[j] = l;
            Rr.k[j] = k;
          }
        }
      });
    }
  }

  function drawDrift(p) {
    for (const m of drift) {
      const k = m.life / m.max;
      if (m.x < B.x0 || m.x >= B.x1 || m.y < B.y0 || m.y >= B.y1) continue;
      const al = k < 0.3 ? k / 0.3 : 1;
      if (m.kind === 0) {
        const c = mix(F[3], F[5], 1 - k), w = m.size * (0.9 + (1 - k) * 1.5);
        p.line(m.x - w, m.y, m.x + w * 0.6, m.y, c, 0.16 * al);
        p.dot(m.x - w * 0.4, m.y - 1, scale(c, 0.8), 0.13 * al);
        p.dot(m.x + w * 0.2, m.y + 1, scale(c, 0.8), 0.11 * al);
        if (k > 0.6) p.glow(m.x, m.y, m.size * 2.2, F[4], 0.04 * al);
      } else {
        const sp = Math.hypot(m.vx, m.vy), ux = m.vx / (sp || 1);
        const c = m.kind === 2 ? mix(G[6], F[5], 1 - k) : mix(F[5], F[3], 1 - k);
        if (sp > 26) p.dot(m.x - ux * 1.4, m.y, scale(c, 0.6), 0.7 * al);
        if (sp > 70) p.dot(m.x - ux * 2.6, m.y, scale(c, 0.42), 0.45 * al);
        p.dot(m.x, m.y, c, al);
        if (m.kind === 2 && k > 0.5) p.glow(m.x, m.y, 4, G[5], 0.22 * al);
      }
    }
  }

  function stripAt(s) {
    const age = t - s.t0;
    if (age <= 0) return { y0: s.y0, y1: s.y1, dx: 0, dy: 0, a: 1, tone: 0, tear: 0 };
    const u = clamp(age / s.dur), travel = (s.v * (1 - Math.exp(-2.3 * age))) / 2.3 + 30 * age;
    return {
      y0: s.y0, y1: s.y1,
      dx: wind * travel,
      dy: -s.lift * ease.outQuad(u) + Math.round(1.5 * Math.sin(age * 3.4 + s.ph)),
      a: (1 - ease.inQuad(u)) * (1 - 0.3 * u),
      tone: ease.outQuad(clamp(age / (s.dur * 0.8))),
      tear: ease.inQuad(clamp((u - 0.12) / 0.88)) * 0.95,
    };
  }

  return {
    update(dt) {
      t += dt;
      // 释放: the currents pour in from off-screen, the pale one leading
      if (t < HIT) {
        const k = seg(t, 0, GATHER);
        for (let i = 0; i < (k > 0.8 ? 2 : 3); i++) {
          const s = R.sign(), pale = R.chance(0.44), x0 = s * R.range(118, 236);
          const y0 = pale ? R.range(-34, -6) : R.range(-22, 20), sp = R.range(160, 340) * (1 + 0.45 * k);
          streaks.push({
            x: x0, y: y0, vx: -s * sp, vy: -y0 * R.range(0.5, 1.1),
            life: (Math.abs(x0) - R.range(2, 26)) / sp, len: R.range(5, 13),
            c: pale ? (R.chance(0.5) ? C[6] : C[7]) : R.chance(0.6) ? C[4] : C[3], pale,
          });
        }
        if (R.chance(0.08 + 0.16 * k)) {
          const s = R.sign();
          spawn(P.VAPOUR, s * R.range(10, 46), R.range(-20, 14), -s * R.range(24, 62), R.range(-10, 8), R.range(0.5, 1), R.chance(0.5) ? C[4] : C[5], R.range(3, 5.5));
        }
      }
      for (let i = streaks.length - 1; i >= 0; i--) {
        const m = streaks[i];
        m.life -= dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.vx *= 1 - 0.7 * dt;
        if (m.life <= 0 || Math.abs(m.x) < 3) streaks.splice(i, 1);
      }
      // 命中: the heap at the middle blows apart
      if (!hitDone && t >= HIT) {
        hitDone = true;
        lights.add(0, 0, 64, K[6], 0.7, 0.34);
        lights.add(0, 0, 44, WHITE, 0.9, 0.12);
        for (let i = 0; i < 28; i++) {
          const s = R.sign(), sp = R.range(90, 280);
          spawn(P.MOTE, s * R.range(0, 16), R.range(-26, 18), s * sp, R.range(-34, 34), R.range(0.3, 0.72), R.chance(0.42) ? K[6] : C[6], R.range(0.7, 1.3));
        }
        for (let i = 0; i < 14; i++) {
          const s = R.sign();
          spawn(P.VAPOUR, s * R.range(4, 34), R.range(-20, 14), s * R.range(42, 118), R.range(-18, 18), R.range(0.5, 1.05), R.chance(0.5) ? C[5] : K[4], R.range(3, 5.5));
        }
        for (let i = 0; i < 12; i++) {
          const an = R.range(0, TAU), sp = R.range(28, 96);
          spawn(P.STAR, Math.cos(an) * 9, Math.sin(an) * 7, Math.cos(an) * sp, Math.sin(an) * sp * 0.55, R.range(0.3, 0.75), R.pick([WHITE, K[6], G[6]]), R.chance(0.3) ? 1.5 : 0.6);
        }
      }
      // 展开: both ends of the line bloom into mist and withered-yellow dust
      if (!bloomed && t >= BLOOM) {
        bloomed = true;
        for (const s of [-1, 1]) {
          lights.add(s * HALF, SPINE_Y, 38, G[5], 0.45, 0.55);
          spawn(P.VAPOUR, s * (HALF + 8), SPINE_Y - 2, s * 26, -7, R.range(0.8, 1.4), K[5], R.range(4, 7));
          spawn(P.VAPOUR, s * (HALF + 16), SPINE_Y + 3, s * 34, -11, R.range(0.7, 1.2), C[6], R.range(3.5, 6));
          for (let i = 0; i < 6; i++) {
            const an = (s > 0 ? 0 : Math.PI) + R.range(-1.1, 1.1), sp = R.range(6, 26);
            spawn(P.STAR, s * HALF + s * R.range(-4, 10), SPINE_Y + R.range(-7, 7), Math.cos(an) * sp, -R.range(7, 24), R.range(1, 2), R.pick([G[6], G[5], G[7]]), R.chance(0.34) ? R.range(1.2, 1.9) : 0.6);
          }
          for (let i = 0; i < 2; i++) spawn(P.EMBER, s * (HALF + R.range(0, 12)), SPINE_Y + R.range(-5, 5), s * R.range(5, 18), -R.range(7, 20), R.range(1, 1.9), G[5], R.range(0.8, 1.4));
        }
      }
      // 压迫: the banner settles heavy and the screen feels it
      if (!pressed && t >= PRESS) {
        pressed = true;
        lights.add(0, BAND_B, 62, K[4], 0.3, 0.7);
        for (let i = 0; i < 10; i++) {
          const s = R.sign();
          spawn(P.VAPOUR, s * R.range(20, BAND_HW), BAND_B + R.range(0, 8), s * R.range(6, 26), R.range(8, 26), R.range(0.7, 1.3), C[2], R.range(3, 5));
        }
      }
      // it breathes while it holds: a wisp off the banks, a twinkle along the notice
      if (t > SOLID && t < SCATTER) {
        if (R.chance(0.07)) {
          const s = R.sign();
          spawn(P.STAR, s * R.range(18, BAND_HW - 6), R.range(-28, 12), R.range(-5, 5), -R.range(4, 13), R.range(0.4, 0.95), R.pick([K[6], G[6], C[7]]), 0.6);
        }
        if (R.chance(0.05)) {
          const s = R.sign();
          spawn(P.VAPOUR, s * R.range(116, 152), R.range(-26, 12), s * R.range(10, 30), R.range(-9, 5), R.range(0.9, 1.6), C[5], R.range(3, 6));
        }
        if (R.chance(0.035)) spawn(P.STAR, R.range(-HALF + 8, HALF - 8), SPINE_Y + R.range(-1, 1), 0, 0, R.range(0.25, 0.45), G[7], R.chance(0.3) ? 1.4 : 0.6);
      }
      // 消散: each strip lets go in turn and sheds mist and dust onto the wind
      if (t >= SCATTER) {
        const g = gust(t);
        for (const s of strips) {
          if (released[s.i] || t < s.t0) continue;
          released[s.i] = true;
          const yMid = (s.y0 + s.y1) / 2;
          for (let i = 0; i < 9; i++) {
            const q = R.next(), kind = q < 0.34 ? 0 : q < 0.46 ? 2 : 1;
            const life = Math.min(R.range(0.7, 1.5) * (kind === 0 ? 1.2 : 1), end - t);
            if (life <= 0.05) continue;
            drift.push({
              x: (R.next() - 0.5) * 2 * (BAND_HW + 14), y: yMid + R.range(-2.5, 2.5),
              vx: wind * R.range(26, 96), vy: R.range(-10, 8), life, max: life,
              size: kind === 0 ? R.range(2, 4.6) : 1, kind,
            });
          }
          for (let i = 0; i < 2; i++)
            spawn(P.VAPOUR, (R.next() - 0.5) * 2 * BAND_HW, yMid + R.range(-2, 2), wind * R.range(40, 120), R.range(-12, 10), R.range(0.5, 1), F[R.int(3, 5)], R.range(2, 3.6));
        }
        // dust off the mist banks too, so the whole screen empties on the same wind
        if (R.chance(0.5)) {
          const s = R.sign(), e = front(t);
          spawn(P.FLAKE, s * R.range(e, Math.min(158, e + 60)), R.range(-28, 20), wind * R.range(30, 90) * g, R.range(-12, 8), R.range(0.8, 1.6), R.pick([F[4], F[5], C[6]]), R.chance(0.3) ? 1.6 : 0.8);
        }
        for (let i = drift.length - 1; i >= 0; i--) {
          const m = drift[i];
          if ((m.life -= dt) <= 0) {
            drift.splice(i, 1);
            continue;
          }
          const kk = Math.min(1, (m.max - m.life) / 0.18);
          const fx = wind * (104 * g + 34 * noise2(m.x * 0.06, m.y * 0.06 - t * 0.85, 3)) * kk;
          const fy = (-11 * (m.kind === 0 ? 0.5 : 1) + 40 * noise2(m.x * 0.05 + 40, m.y * 0.05 - t * 1.1, 9)) * kk;
          const drag = m.kind === 0 ? 1.5 : 1.05;
          m.vx += (fx - m.vx * drag) * dt;
          m.vy += (fy - m.vy * drag) * dt;
          m.x += m.vx * dt;
          m.y += m.vy * dt;
        }
      }
      ps.update(dt);
      // let go of anything the screen can no longer show (it is off the edge, so nothing changes visually)
      for (let i = ps.list.length - 1; i >= 0; i--) {
        const q = ps.list[i];
        if (q.x < B.x0 - 20 || q.x > B.x1 + 20 || q.y < B.y0 - 20 || q.y > B.y1 + 20) ps.list.splice(i, 1);
      }
      for (let i = drift.length - 1; i >= 0; i--) {
        const m = drift[i];
        if (m.x < B.x0 - 6 || m.x > B.x1 + 6 || m.y < B.y0 - 6 || m.y > B.y1 + 6) drift.splice(i, 1);
      }
      lights.update(dt);
    },

    drawBack(p) {
      veil(p);
      mist(p, 0, FLAT);
      mist(p, 1, FLAT);
      // the currents themselves, racing in: a dark tail and a bright head. Both they and the loose particles
      // can leave the screen, so those two passes are held to it (the row shaders above clip themselves).
      const loose = streaks.length || ps.count ? clip(p, meta) : p;
      if (streaks.length) {
        const q = loose;
        for (const m of streaks) {
          const sp = Math.hypot(m.vx, m.vy) || 1, ux = m.vx / sp, uy = m.vy / sp, L = m.len * (0.6 + Math.min(1, sp / 260));
          const k = clamp(m.life * 6);
          q.line(m.x - ux * L, m.y - uy * L, m.x - ux * L * 0.35, m.y - uy * L * 0.35, scale(m.c, 0.5), 0.55 * k);
          q.line(m.x - ux * L * 0.4, m.y - uy * L * 0.4, m.x, m.y, m.c, 0.95 * k);
          if (m.pale) q.glow(m.x, m.y, 5, C[6], 0.16 * k);
        }
      }
      shafts(p, FLAT);
      ps.draw(loose, "back");
    },

    draw(p) {
      const [ox, oy] = offs();
      sheetsDraw(p, false);
      // until it lets go the whole notice sits inside the screen, so it draws straight through
      if (t < SCATTER) banner(p, { y0: -1e4, y1: 1e4, dx: ox, dy: oy, a: 1, tone: 0, tear: 0 });
      else {
        const q = clip(p, meta); // the strips stream off sideways: hold them to the screen
        for (const s of strips) {
          const st = stripAt(s);
          st.dx += ox;
          st.dy += oy;
          banner(q, st);
        }
      }
      sheetsDraw(p, true);
      const q = drift.length || ps.count ? clip(p, meta) : p;
      drawDrift(q);
      ps.draw(q, "front");
      lights.draw(p);
      // the last of the light going out along the banner as it scatters
      const out = seg(t, SCATTER, SCATTER + 0.5);
      if (out > 0 && out < 1) p.glowLine(-BAND_HW, SPINE_Y + oy, BAND_HW, SPINE_Y + oy, 26, F[4], 0.16 * (1 - out));
    },
  };
}
