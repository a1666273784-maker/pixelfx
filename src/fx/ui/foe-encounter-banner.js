// Strong-foe encounter banner, torn open by a streaming blade of light ("ui/foe-encounter-banner"): ink-teal
// dark mist pours in from the top and bottom edges of the screen while a piercing warm-white gleam ignites at
// the left; a粗犷 coral-and-white pixel beam slashes across the middle and unfolds a deep-grey banner band in
// its wake, its two edges licking with flowing withered-yellow and warm-orange flame; the banner slams to a
// hold with one red-white misregistered flicker and a ring of shockwave air, presses on the screen, then
// shatters into coral sparks and pale cloud-mist that the wind carries off.
// The banded edge mist follows Sprite Fusion's open-source fog recipe (https://www.spritefusion.com/pixel-art-
// vfx/fog), the flame licks their fire recipe (https://www.spritefusion.com/pixel-art-vfx/fire), both MIT
// License, Copyright (c) 2026 Hugo Duprez; the striped beam borrows our melee/red-white-pierce, the misregister
// our scifi/glitch, the debris our core Bits.
import {
  Particles, Bits, Lights, P, Rng, fit, clamp, seg, smooth, lerp, ease, noise, noise2, rand, mix, scale, hex,
  TAU, WHITE, sparkle, createFrame, painterFor,
} from "../../core/index.js";
import { rows, bayer, field, sample, box, clip } from "../weather/_lib.js";
import { spell, drawWord, shake } from "./_lib.js";
import { hotFirst } from "../fire/_lib.js";

export const meta = {
  name: "Foe encounter banner",
  desc: "Ink-teal mist pours from the screen edges as a gleam burns left; a coral-white beam slashes open a flame-edged grey banner that glitches, rings out and shatters on the wind.",
  tags: ["ui", "banner", "boss", "encounter", "warning", "slash", "beam", "flame", "glitch", "shatter", "one-shot"],
  size: [320, 180],
  origin: [160, 90],
  duration: 4.7,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    // 珊瑚红: the beam, the sparks and the title
    palette: ["#300a0c", "#6b1216", "#a81e22", "#d43a30", "#f2604c", "#ff8a6e", "#ffb49c", "#ffe6da"],
    // 墨青: the dark mist pouring in off the edges of the screen
    ink: ["#04080b", "#0a151b", "#12262e", "#1c3a42", "#2b545a", "#417276", "#6fa0a0"],
    // 枯黄 -> 暖橙: the flame riding the banner's two edges
    flame: ["#241505", "#4a2a08", "#7a4409", "#b0650c", "#d98a1a", "#f2b23c", "#ffd76a", "#fff3c4"],
    // 深灰: the banner band itself
    steel: ["#101216", "#1c2026", "#2a2f36", "#3c434b", "#565e66", "#79828a"],
    // 苍白: what it all turns into on the wind
    pale: ["#232a2c", "#414c4e", "#6b7678", "#98a2a2", "#c3cbc8", "#eef2ee"],
    text: "STRONG FOE",
    sub: "ENCOUNTER",
    wind: 1,
    seed: 7,
  },
};

const W = 320, H = 180, OX = 160, OY = 90, B = box(meta);
const INK = hex("#04070a");
// the beats: the mist and the gleam gather, the beam slashes, the banner slams and holds, the wind takes it
const GLOW = 0.12, GATHER = 0.9, SLASH0 = 0.92, SLASHD = 0.24, SLAM = 1.5, BREAK = 3.3, GONE = 4.6, DUR = 4.7;
const SLASH1 = SLASH0 + SLASHD;
// the banner band: half height, half width, and where its two lines of type sit
const HH = 13, HW = 116, TITLE_Y = -11, SUB_Y = 4;
// where the gleam burns, and how far the beam runs
const GX = -132, BX0 = -180, BX1 = 190;
// scratch: the band's unfolded half-height per column, the mist's ragged front, boil and crest per column
const HHC = new Float32Array(W), RAG = new Float32Array(W), BOIL = new Float32Array(W), CREST = new Float32Array(W);

// the beam's head: fast in, carried out
const headX = (t) => lerp(BX0, BX1, ease.inOutQuad(seg(t, SLASH0, SLASH1)));
// when the head passed a column (the inverse of inOutQuad), so the band can unfold in its wake
function passT(x) {
  const v = clamp((x - BX0) / (BX1 - BX0));
  const u = v < 0.5 ? Math.sqrt(v / 2) : 1 - Math.sqrt((1 - v) / 2);
  return SLASH0 + u * SLASHD;
}
// the mist fronts: off-screen at rest, poured in by GATHER, blown back out when the banner shatters
function bankFront(s, t) {
  const rest = s < 0 ? B.y0 - 26 : B.y1 + 26, inY = s < 0 ? -34 : 38;
  const recede = ease.inQuad(seg(t, BREAK + 0.08, GONE - 0.05));
  const press = 1.6 * smooth(SLAM, SLAM + 0.5, t) * (1 - seg(t, BREAK, BREAK + 0.3));
  return lerp(rest, inY, ease.outCubic(seg(t, 0.05, GATHER))) * (1 - recede) + rest * recede - s * press * (0.6 + 0.4 * noise(t * 1.3, 3));
}
const bankAlpha = (t) => (1 - seg(t, BREAK + 0.15, GONE - 0.12)) * smooth(0.02, 0.22, t);

/** The banner's two lines of type, rasterized once into pixels so they can flicker, misregister and fly. */
function notice(o, C, FL) {
  const title = spell(o.text, "big"), sub = spell(o.sub, "mini");
  const f = createFrame(W, H), p = painterFor(f).place(OX, OY), list = [];
  const TS = 2, tx = (-title.w * TS) / 2;
  drawWord(
    p,
    title.letters.filter((L) => L.g).map((L) => ({ g: L.g, x: tx + L.x * TS, y: TITLE_Y, sx: TS, sy: TS })),
    { fill: [C[3], C[4], C[5], WHITE], edge: WHITE, under: C[2], outline: INK, shadow: scale(INK, 0.45) },
  );
  const sx = -sub.w / 2;
  drawWord(
    p,
    sub.letters.filter((L) => L.g).map((L) => ({ g: L.g, x: sx + L.x, y: SUB_Y, sx: 1, sy: 1 })),
    { fill: [FL[3], FL[4], FL[5]], edge: FL[6], under: FL[2], outline: INK, shadow: scale(INK, 0.45) },
  );
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = f.color[y * W + x];
      if (!(c >>> 24)) continue;
      const lx = x - OX, ly = y - OY;
      list.push({
        x: lx, y: ly, c, l: ly < 0, title: ly < 0,
        key: clamp(0.5 * seg(Math.abs(lx), 4, HW - 6) + 0.5 * rand(x, y, o.seed + 31)),
        fk: rand(x, y, o.seed + 47),
      });
    }
  return list;
}

export function create(o) {
  const C = fit(o.palette, 8), K = fit(o.ink, 7), FL = fit(o.flame, 8), ST = fit(o.steel, 6), PL = fit(o.pale, 6);
  const FH = hotFirst(FL); // hot-first flame ramp: FH[0] white-hot .. FH[7] smouldering
  const wind = o.wind < 0 ? -1 : 1, S = o.seed;
  const R = new Rng(S);
  const ps = new Particles({ rng: R, sparks: [C[6], C[5], C[4], C[2]], haze: PL[3] });
  const bits = new Bits({}), lights = new Lights();
  const letters = notice(o, C, FL);
  const LY0 = letters.length ? letters[0].y : 0, LY1 = letters.length ? letters[letters.length - 1].y + 1 : 1;
  const LROW = new Int32Array(LY1 - LY0 + 1);
  {
    let j = 0;
    for (let y = LY0; y <= LY1; y++) {
      LROW[y - LY0] = j;
      while (j < letters.length && letters[j].y < y) j++;
    }
  }
  const FF = field(S * 5 + 3, 256, 128), FG = field(S * 5 + 9, 256, 128);
  const drift = [], motes = [];
  let t = 0, slammed = false, broken = false;

  // the slam's one red-white misregister: a split and three torn slices, re-rolled per frame
  const glOn = () => t >= SLAM && t < SLAM + 0.2;
  function glSplit() {
    if (!glOn()) return 0;
    const f = Math.floor(t * 30 + 1e-6), k = 1 - seg(t, SLAM, SLAM + 0.2);
    return Math.round(1 + rand(S, f, 1) * 2.4) * (rand(S, f, 2) < 0.5 ? -1 : 1) * (k > 0.4 ? 1 : 0.5);
  }
  function glDx(yv, x = 0) {
    if (!glOn()) return 0;
    const f = Math.floor(t * 30 + 1e-6), k = 1 - seg(t, SLAM, SLAM + 0.2);
    const cf = 1 - smooth(46, 78, Math.abs(x)); // the flicker is the banner's centre talking
    if (cf <= 0.02) return 0;
    const s = [[-5, -3, 5, 3], [-1, 1, -6, 4], [3, 5, 4, 5]];
    for (const [a, b, dx, n] of s) if (yv >= a && yv <= b) return Math.round(dx * k * cf * (0.5 + 0.5 * rand(S, f, n)));
    return 0;
  }
  const glTint = (yv, x = 0) => {
    if (!glOn()) return 0;
    const f = Math.floor(t * 30 + 1e-6);
    const d = glDx(yv, x);
    if (!d) return 0;
    return rand(S, f, 6 + Math.abs(d)) < 0.55 ? 1 : 2; // 1: coral ghost, 2: white ghost
  };

  const offs = () => {
    const [ax, ay] = shake(t, 2.6, SLAM, 0.3, S);
    const [bx, by] = shake(t, 1.1, SLASH0, 0.14, S + 5);
    return [Math.round(ax + bx), Math.round(ay + by)];
  };
  const flameK = () =>
    (seg(t, SLASH1 - 0.08, SLASH1 + 0.34) * (1 - seg(t, BREAK, BREAK + 0.26)) +
      seg(t, BREAK, BREAK + 0.03) * (1 - seg(t, BREAK + 0.03, BREAK + 0.18)) * 1.1) *
    (0.86 + 0.14 * noise(t * 8.2, 21));

  return {
    update(dt) {
      t += dt;
      // the gleam feeds: motes drawn in from around it while the mist pours
      if (t > GLOW && t < SLASH0 && R.chance(30 * dt)) {
        const a = R.range(0, TAU), r = R.range(10, 26);
        motes.push({ x: GX + Math.cos(a) * r, y: Math.sin(a) * r * 0.5, age: 0, life: R.range(0.1, SLASH0 - t + 0.05) });
      }
      for (let i = motes.length - 1; i >= 0; i--) {
        const m = motes[i];
        m.age += dt;
        m.x += (GX - m.x) * 6 * dt;
        m.y += (0 - m.y) * 6 * dt;
        if (m.age >= m.life) motes.splice(i, 1);
      }
      // the beam spits sparks back off its head
      if (t >= SLASH0 && t < SLASH1 && R.chance(0.85)) {
        const hx = headX(t);
        ps.spawn(P.SPARK, hx, R.range(-2, 2), -R.range(60, 190), R.range(-40, 40), R.range(0.1, 0.26));
      }
      // the slam: a flash, a few sparks kicked out of the middle
      if (!slammed && t >= SLAM) {
        slammed = true;
        lights.add(0, 0, 58, C[5], 0.42, 0.16);
        lights.add(0, 0, 26, WHITE, 0.55, 0.08);
        for (let i = 0; i < 10; i++) {
          const a = R.range(0, TAU), v = R.range(50, 150);
          ps.spawn(P.SPARK, 0, 0, Math.cos(a) * v, Math.sin(a) * v * 0.5, R.range(0.14, 0.3), WHITE);
        }
      }
      // embers off the flame edges while they flow
      if (flameK() > 0.35 && t < BREAK && R.chance(7 * dt)) {
        const s = R.chance(0.5) ? -1 : 1;
        ps.spawn(P.EMBER, R.range(-HW + 8, HW - 8), s * HH + s, R.range(-6, 6) + wind * 8, -s * R.range(6, 18), R.range(0.4, 0.9), FL[R.int(4, 6)], R.chance(0.3) ? 1.4 : 0.8);
      }
      // 命中结果: the banner bursts into chunks, coral sparks and pale mist
      if (!broken && t >= BREAK) {
        broken = true;
        lights.add(0, 0, 40, WHITE, 0.7, 0.06);
        lights.add(0, 0, 74, C[4], 0.4, 0.2);
        for (let gx = -HW + 4; gx < HW - 4; gx += 11)
          for (let gy = -HH + 3; gy < HH - 2; gy += 8) {
            const j = R.range(-2, 2);
            bits.add({
              x: gx + j, y: gy + R.range(-1.5, 1.5), vx: gx * 2.6 + wind * R.range(30, 80) + R.range(-35, 35),
              vy: R.range(-115, -20) + gy * 3, a: R.range(0, TAU), va: R.range(-8, 8), s: R.range(2, 3.4),
              c: R.chance(0.35) ? C[2] : ST[1], ramp: [ST[0], ST[1], ST[2], C[3], C[5]], g: 0.55, drag: 1.3,
              life: R.range(0.55, 0.95),
            });
          }
        for (let i = 0; i < 32; i++) {
          const a = R.range(-TAU / 2, TAU / 2), v = R.range(70, 260);
          ps.spawn(P.SPARK, R.range(-HW, HW) * 0.8, R.range(-HH, HH), Math.cos(a) * v * (Math.cos(a) > 0 ? 1 : 0.6), Math.sin(a) * v * 0.5 - R.range(0, 40), R.range(0.2, 0.7));
        }
        for (let i = 0; i < 10; i++)
          ps.spawn(P.VAPOUR, R.range(-HW, HW), R.range(-HH - 4, HH + 4), wind * R.range(36, 105), R.range(-14, 8), R.range(0.5, 0.95), PL[R.int(2, 5)], R.range(2, 3.8), R.range(0, 0.12));
        for (let i = 0; i < 4; i++)
          ps.spawn(P.SMOKE, R.range(-HW * 0.8, HW * 0.8), R.range(-8, 8), wind * R.range(16, 44), -R.range(6, 16), R.range(0.7, 1.1), PL[2], R.range(2.6, 4.5), R.range(0, 0.1));
        for (let i = 0; i < 26; i++)
          drift.push({ x: R.range(-HW, HW), y: R.range(-HH - 6, HH + 6), vx: wind * R.range(50, 150), vy: R.range(-16, 10), life: R.range(0.5, 1.15), max: 0, kind: R.chance(0.25) ? 2 : R.chance(0.5) ? 0 : 1, size: R.range(1.6, 3.4) });
        for (const m of drift) m.max = m.life;
        for (let i = 0; i < letters.length; i += 5) {
          const L = letters[i];
          ps.spawn(P.SPARK, L.x, L.y, wind * R.range(20, 90), R.range(-50, -6), R.range(0.2, 0.5), 0, 0.6);
        }
      }
      for (let i = drift.length - 1; i >= 0; i--) {
        const m = drift[i];
        if ((m.life -= dt) <= 0) {
          drift.splice(i, 1);
          continue;
        }
        const kk = Math.min(1, (m.max - m.life) / 0.15);
        m.vx += (wind * 120 - m.vx * 1.1) * dt * kk;
        m.vy += (-6 + 30 * noise2(m.x * 0.05, m.y * 0.05 - t, 9) - m.vy * 1.4) * dt * kk;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
      }
      ps.update(dt);
      bits.update(dt);
      lights.update(dt);
      // let go of anything the screen can no longer show
      for (let i = ps.list.length - 1; i >= 0; i--) {
        const q = ps.list[i];
        if (q.x < B.x0 - 20 || q.x > B.x1 + 20 || q.y < B.y0 - 20 || q.y > B.y1 + 20) ps.list.splice(i, 1);
      }
      for (let i = bits.list.length - 1; i >= 0; i--) {
        const b = bits.list[i];
        if (b.x < B.x0 - 24 || b.x > B.x1 + 24 || b.y > B.y1 + 24) bits.list.splice(i, 1);
      }
    },

    drawBack(p) {
      const [ox, oy] = offs();
      banks(p, oy);
      const q = ps.count ? clip(p, meta) : p;
      ps.draw(q, "back");
    },

    draw(p) {
      const [ox, oy] = offs();
      band(p, ox, oy);
      flames(p, ox, oy);
      words(p, ox, oy);
      beam(p, ox, oy);
      gleam(p, ox, oy);
      ring(p, ox, oy);
      const loose = drift.length || ps.count || bits.count ? clip(p, meta) : p;
      drawDrift(loose);
      ps.draw(loose, "front");
      bits.draw(loose);
      lights.draw(p);
    },
  };

  // ---- the ink-teal mist pouring in from the top and bottom edges of the screen
  function banks(p, oy) {
    const a = bankAlpha(t);
    if (a <= 0.012) return;
    for (const s of [-1, 1]) {
      const yF = bankFront(s, t) + oy * 0.4;
      const seed = s < 0 ? 41 : 77;
      for (let i = 0; i < W; i += 2) {
        RAG[i] = RAG[i + 1] = 6 * noise(i * 0.05 + t * 0.6 + seed, seed) + 3 * noise(i * 0.16 - t * 1.1, seed + 4);
        CREST[i] = CREST[i + 1] = noise(i * 0.09 + t * 1.7, 55 + s * 8);
      }
      const y0 = s < 0 ? B.y0 : Math.min(B.y1 - 1, Math.floor(yF - 20));
      const y1 = s < 0 ? Math.max(B.y0, Math.ceil(yF + 8)) : B.y1 - 1;
      const FFx = s < 0 ? FF : FG;
      rows(p, meta, y0, y1, (y, Rr) => {
        const boil = t * 6.5, yb = (Math.floor(y) & ~1) * 0.55 + boil * 0.3;
        for (let i = 0; i < W; i += 2) BOIL[i] = BOIL[i + 1] = sample(FFx, i * 0.5 + boil * 0.5, yb);
        for (let i = 0; i < W; i++) {
          const g = (y - yF - RAG[i]) * s; // > 0 inside the bank, 0 at its ragged front
          if (g < -2.5) continue;
          const cover = 1 - smooth(-2.5, 2.5, -g);
          if (cover <= 0.02) continue;
          const deep = 0.55 + 0.45 * smooth(0, 20, g);
          const dens = a * cover * deep * (0.3 + 0.95 * BOIL[i]);
          const th = bayer(i, y) * 0.12;
          // a broken lit rim right at the pouring front, then banded ink-teal behind it, mostly in the darks
          const crest = g < 2.4 && g > 0.2 && CREST[i] > -0.25;
          const c = crest ? K[4] : dens > 0.98 + th ? K[3] : dens > 0.6 + th ? K[2] : dens > 0.36 + th ? K[1] : 0;
          if (!c) continue;
          Rr.c[i] = c;
          Rr.a[i] = crest ? 0.8 * a : Math.min(0.9, 0.4 + dens * 0.65);
          Rr.b[i] = 0;
          if (crest) (Rr.l[i] = K[5]), (Rr.k[i] = 0.04 * a);
        }
      });
    }
  }

  // ---- the deep-grey band, unfolded column by column in the beam's wake
  function band(p, ox, oy) {
    const a = 1 - seg(t, BREAK, BREAK + 0.08);
    if (a <= 0.012 || t < SLASH0) return;
    for (let i = 0; i < W; i++) {
      const x = B.x0 + i + 0.5 - ox;
      if (Math.abs(x) > HW + 24) {
        HHC[i] = 0;
        continue;
      }
      const u = seg(t, passT(x) + 0.02, passT(x) + 0.24);
      HHC[i] = HH * ease.outQuart(u) * (1 + 0.05 * Math.sin((t - SLAM) * 2.6) * smooth(SLAM, SLAM + 0.4, t) * (1 - seg(t, BREAK - 0.4, BREAK, t)));
    }
    rows(p, meta, -HH - 2 + oy, HH + 2 + oy, (y, Rr) => {
      const yv = y - oy;
      if (Math.abs(yv) > HH + 1) return;
      for (let i = 0; i < W; i++) {
        const dx = glDx(yv, B.x0 + i + 0.5 - ox);
        const ii = dx ? clamp(i - dx, 0, W - 1) : i;
        const hh = HHC[ii];
        if (hh < 1 || Math.abs(yv) > hh) continue;
        const x = B.x0 + ii + 0.5 - ox, ax = Math.abs(x);
        if (ax > HW + 2) continue;
        const v = yv / HH;
        const taper = 1 - 0.9 * smooth(HW - 20, HW + 1, ax);
        if (taper <= 0.06) continue;
        const brush = noise2(x * 0.014, yv * 2.7, 7);
        const rim = Math.abs(yv) > hh - 1.2;
        let c = rim ? (yv < 0 ? (hh < 5 ? ST[2] : ST[3]) : ST[0]) : Math.abs(v) > 0.72 ? ST[1] : brush > 0.85 ? ST[3] : brush > 0.45 ? ST[2] : ST[1];
        if (ax > HW - 3) c = ST[0];
        const tint = glTint(yv, x);
        if (tint === 1) c = mix(c, C[5], 0.5);
        else if (tint === 2) c = mix(c, WHITE, 0.6);
        Rr.c[i] = c;
        Rr.a[i] = a * taper;
        Rr.b[i] = 0;
        // the flame's light on the band's own edges
        if (Math.abs(v) > 0.55) (Rr.l[i] = FL[4]), (Rr.k[i] = 0.045 * flameK() * a);
      }
    });
  }

  // ---- 枯黄 and 暖橙 flame flowing along the band's two edges
  function flames(p, ox, oy) {
    const k = flameK(), a = 1 - seg(t, BREAK, BREAK + 0.1);
    if (k <= 0.02 || a <= 0.012) return;
    for (let i = 0; i < W; i++) {
      const hh = HHC[i];
      if (hh < 5) continue;
      const x = B.x0 + i + 0.5 - ox, ax = Math.abs(x);
      if (ax > HW - 2) continue;
      const taper = 1 - smooth(HW - 14, HW - 2, ax);
      for (const s of [-1, 1]) {
        const e = s * hh + oy;
        // tongues: where both noises fall low the flame gaps out, so the edge breathes instead of smearing
        p.dot(B.x0 + i + 0.5, e, FH[4], a * 0.55 * k * taper); // the ember bed the tongues rise from
        const gate = noise(x * 0.16 - t * 2.2, 71 + s * 4) > -0.35 ? 1 : 0.25; // separate tongues
        const tongue = Math.max(0, noise((x - t * 46) * 0.09, 13 + s * 6) * 1.5 - 0.3) + Math.max(0, noise((x - t * 82) * 0.2, 29 + s * 3) * 1.7 - 0.6);
        const h = k * taper * gate * tongue * 6.2;
        if (h < 0.9) continue;
        const hi = Math.min(8, Math.floor(h));
        for (let d = 0; d <= hi; d++) {
          if (d === hi && noise(x * 0.7 + s * 9, t * 9.5, 5) < -0.1) continue; // crackling tips
          const sway = d > 2 ? Math.round(Math.sin(d * 0.7 + x * 0.22 + t * 6) * 0.8) : 0; // licks lean as they rise
          const yy = s < 0 ? e - d : e + d; // the edge, then outwards from the band
          const c = d === 0 ? FH[1] : FH[Math.min(7, 2 + Math.floor((d / (h + 1)) * 5))];
          p.dot(B.x0 + i + 0.5 + sway, yy, c, a * (d === 0 ? 1 : 0.94));
        }
        if (s < 0 && i % 28 === 0 && h > 2.5) p.glow(x, e - 2, 6, FL[4], 0.06 * k * a);
      }
    }
  }

  // ---- the type: up out of the slam, misregistered once, then torn away
  function words(p, ox, oy) {
    if (t < SLAM + 0.02 || t >= BREAK + 0.05) return;
    const rise = seg(t, SLAM + 0.04, SLAM + 0.34), split = glSplit();
    const flick = Math.floor(t * 24);
    const ry0 = Math.max(LY0, B.y0 - oy), ry1 = Math.min(LY1, B.y1 - oy);
    const li0 = ry0 < ry1 ? LROW[ry0 - LY0] : 0, li1 = ry0 < ry1 ? LROW[ry1 - LY0] : 0;
    for (let li = li0; li < li1; li++) {
      const L = letters[li];
      const g = rise * 1.15 - L.key;
      if (g <= 0) continue;
      const dx = glDx(L.y, L.x);
      let x = L.x + dx + ox, y = L.y + oy;
      let c = L.c, al = 1;
      if (g < 0.25) {
        if (rand(L.x * 3 + flick, L.y, 5) < 0.3 - g) continue;
        c = mix(L.c, C[4], 0.5);
        al *= 0.35 + 0.6 * (g / 0.25);
      } else if (g < 0.34) c = WHITE;
      const tint = glTint(L.y, L.x);
      if (split && !tint) {
        p.dot(x - split, y, mix(c, C[4], 0.85), al * 0.8);
        p.dot(x + split, y, WHITE, al * 0.7);
      }
      if (tint === 1) c = mix(c, C[5], 0.65);
      else if (tint === 2) c = WHITE;
      p.dot(x, y, c, al);
    }
  }

  // ---- the beam: coral and white stripes behind a hot head, the band unfolding where it passes
  function beam(p, ox, oy) {
    const u = seg(t, SLASH0, SLASH1);
    const y = oy;
    if (u > 0 && u < 1) {
      const hx = headX(t), tail = hx - 120;
      const q = clip(p, meta);
      for (let x = Math.max(B.x0, tail); x <= Math.min(B.x1 - 1, hx); x += 0.5) {
        const stripe = Math.floor((hx - x) / 5) % 2 === 0;
        const v = (x - tail) / (hx - tail);
        const a = Math.min(1, 0.25 + v);
        q.px(x, y, stripe ? WHITE : C[4]);
        q.px(x, y - 1, stripe ? C[6] : C[3]);
        q.px(x, y + 1, stripe ? C[6] : C[3]);
        if (v > 0.3) q.dot(x, y - 2, C[3], 0.9 * a);
        if (v > 0.3) q.dot(x, y + 2, C[3], 0.9 * a);
        if (v > 0.8) q.dot(x, y - 3, C[1], 0.5);
        if (v > 0.8) q.dot(x, y + 3, C[1], 0.5);
      }
      // the head: a white knot with a cross of light
      q.px(hx, y, WHITE);
      q.px(hx - 1, y, WHITE);
      q.px(hx, y - 1, WHITE);
      q.px(hx, y + 1, WHITE);
      sparkle(q, hx, y, 3, C[6], WHITE, 0.5);
      q.glow(hx, y, 16, C[5], 0.5);
      q.glowLine(hx - 74, y, hx, y, 7, C[5], 0.26);
    }
    // the afterglow along the cut, while the band rises out of it
    const ag = 1 - seg(t, SLASH1, SLASH1 + 0.16);
    if (ag > 0.02 && t >= SLASH1) {
      p.glowLine(-HW, y, HW, y, 5, C[5], 0.16 * ag);
      for (let x = -HW; x < HW; x += 1) if (rand(x, 3, 8) < ag * 0.5) p.dot(x + ox, y, WHITE, 0.5 * ag);
    }
  }

  // ---- the warm-white gleam at the left: a piercing point that squeezes into the beam
  function gleam(p, ox, oy) {
    if (t < GLOW || t > SLASH0 + 0.06) return;
    const x = GX + ox, y = oy;
    const u = seg(t, GLOW, SLASH0), squeeze = ease.inQuad(seg(t, SLASH0 - 0.16, SLASH0));
    const pulse = 0.75 + 0.25 * noise(t * 13, 4);
    const arm = (2 + 5 * u) * pulse * (1 - squeeze * 0.6);
    sparkle(p, x, y, arm, C[6], WHITE, 0.4 * u + 0.15);
    p.glow(x, y, lerp(5, 15, u), WHITE, (0.25 + 0.3 * u) * pulse);
    p.glow(x, y, lerp(10, 26, u), C[5], 0.16 * u);
    // squeezed into a hairline pointing the way the beam will go
    const sx = lerp(1, 26, squeeze);
    for (let d = 0; d < sx; d += 0.5) p.px(x + d, y, d < sx * 0.5 ? WHITE : C[6]);
    for (const m of motes) p.dot(m.x + ox, m.y + oy, C[6], 0.8);
  }

  // ---- the slam's ring of shockwave air
  function ring(p, ox, oy) {
    const u = seg(t, SLAM, SLAM + 0.34);
    if (u <= 0 || u >= 1) return;
    const a = Math.pow(1 - u, 1.6);
    if (a < 0.14) return;
    const R0 = 6 + 112 * ease.outQuart(u), sq = R0 * 0.44;
    const x0 = Math.max(B.x0, Math.floor(-R0 - 2)), x1 = Math.min(B.x1 - 1, Math.ceil(R0 + 2));
    const y0 = Math.max(B.y0, Math.floor(-sq - 2)), y1 = Math.min(B.y1 - 1, Math.ceil(sq + 2));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const r = Math.hypot(x + 0.5, ((y + 0.5) * R0) / sq), dist = Math.abs(r - R0);
        if (dist < 1.4) p.dot(x + ox, y + oy, WHITE, 0.95 * a);
        else if (dist < 3 && bayer(x, y) < 0.6) p.dot(x + ox, y + oy, C[5], 0.7 * a);
      }
    p.glowRing(ox, oy, R0, 5, C[4], 0.16 * a * a);
  }

  // ---- pale dashes and dust the wind carries off
  function drawDrift(p) {
    for (const m of drift) {
      if (m.x < B.x0 || m.x >= B.x1 || m.y < B.y0 || m.y >= B.y1) continue;
      const k = m.life / m.max, al = k < 0.3 ? k / 0.3 : 1;
      if (m.kind === 0) {
        const c = mix(PL[2], PL[4], 1 - k), w = m.size * (0.9 + (1 - k) * 1.4);
        p.line(m.x - w, m.y, m.x + w * 0.6, m.y, c, 0.2 * al);
        p.dot(m.x - w * 0.4, m.y - 1, scale(c, 0.8), 0.15 * al);
      } else if (m.kind === 2) {
        p.dot(m.x, m.y, mix(C[5], PL[4], 1 - k), al);
        if (k > 0.5) p.glow(m.x, m.y, 4, C[4], 0.16 * al);
      } else {
        const sp = Math.hypot(m.vx, m.vy), ux = m.vx / (sp || 1);
        const c = mix(PL[4], PL[2], 1 - k);
        if (sp > 30) p.dot(m.x - ux * 1.6, m.y, scale(c, 0.6), 0.7 * al);
        p.dot(m.x, m.y, c, al);
      }
    }
  }
}
