// A taut thread of silk snaps into a needle: it flies dead straight, pins a tuft of white thread to the target
// and breaks back into short ends that sag, dry out and are gone.
// Method notes: the body is a per-pixel profile of three polylines (the lit ridge, the cut above it, the keel
// below), built with p.polyline and never with stamped shapes, so the cross-section steps 1 / 2 / 3 px and the
// point stays sharp; the light sits on the ridge and the loosening thread behind the butt peels off, following
// the approach in src/fx/ice/ice-lance.js. Hugo Duprez's energy-bolt recipe (MIT, Copyright (c) 2026 Hugo
// Duprez, https://www.spritefusion.com/pixel-art-vfx/energy) is where that file got the idea of a profile body
// with a travelling highlight; this effect's shape, timing and choreography are its own.
import { Rng, fit, clamp, smooth, at, rand, TAU, WHITE } from "../../core/index.js";

const SILK = ["#0a0c10", "#161a20", "#252b33", "#3a4250", "#576273", "#788595", "#a3b0bf", "#c9d4e0", "#e8eef5", "#ffffff"];
const TACK = ["#0d1a24", "#16303d", "#234a5c", "#376f85", "#5aa0b8", "#93cfe0"];

const HX = 14, HY = -26;                    // the hand
const TIP0 = HX + 3;                        // the point clears the hand on the launch frame
const PULL = 0.08, HIT = 0.22, D = 0.58;    // thread taut, needle buried, gone
const HIT_X = HX + 109, CARRY = 0.05;
const L = 19;                               // the needle's full length, point at (0, 0)

const READY = { x: 0, sa: -0.9, sb: -0.9, crouch: 4, lean: 0, bx: 8, by: -25, ffx: 9, fbx: -8 };
const COCK = { ...READY, crouch: 6, lean: -5, fx: -5, fy: -19, bx: -2, by: -24 };
const REACH = { ...READY, crouch: 3, lean: -1, fx: HX, fy: HY, bx: 4, by: -23, ffx: 11, fbx: -9 };
const FLICK = { ...REACH, lean: 4, crouch: 2, fx: HX + 1, fy: HY, bx: 2, by: -22, ffx: 12 };

export const meta = {
  name: "Web needle",
  desc: "A thread of silk pulled taut snaps into a needle: it flies dead straight, pins a knot of white thread to the target and breaks back into short ends that sag and dry.",
  tags: ["projectile", "web", "silk", "spider", "needle", "dart", "directional", "one-shot"],
  size: [176, 76],
  origin: [46, 64],
  duration: D,
  loop: false,
  fps: 30,
  bg: "dark",
  actor: 2,
  options: { silk: SILK, palette: SILK, tack: TACK, seed: 17 },
};

export const act = {
  target: { x: HIT_X - 3 },
  poses: [
    [-0.42, READY],
    [-0.18, COCK],
    [0, REACH, "snap"],
    [PULL, FLICK, "snap"],
    [HIT, { ...FLICK, lean: 5, fx: HX, fy: HY - 1 }],
    [0.34, { ...FLICK, lean: 3, fx: HX - 2, crouch: 3 }],
    [0.48, READY],
    [D, READY],
  ],
  hits: [{ t: HIT, stop: 0.06, shake: 0.1, amp: 1, push: 1.6, straw: 8, y: HY }],
  dust: [{ t: PULL, x: -9, n: 3, dir: -1 }],
};

// The cross-section, in whole rows, by px back from the point (s) and the shaft's current length (len):
//   0 rows  the last 2 px, a 1 px lancet point
//   1 row   2 px: the fine shank just behind the point
//   2 rows  3 px: the belly, where a loom-shuttle is thickest
//   1 row   2 px again, then 1 px for the last seventh: the tail tapers away fast
// It only ever steps in from the point outwards and steps in again at the tail, so the outline is always a
// straight tapered rod and can never round off: 3 px at its widest, never 4.
const rows = (s, len) => (s < 2.2 || s > len - 0.2 ? 0 : s < 4.5 ? 1 : s < len * 0.68 ? 2 : s < len * 0.86 ? 1 : 0);

/**
 * The needle: sampled every pixel from the point (tx, ty) back `len` px, built as one polyline per facet (the lit
 * ridge, the upper cut, the keel), each split into runs of one colour so a colour change never leaves a hole.
 * Nothing here is stamped: the body can only ever be a straight, tapering rod of thread.
 */
function shaft(p, tx, ty, len, color, fade) {
  const n = Math.max(1, Math.round(len));
  // one facet: run r of the profile (1 the ridge, 2 with the cut above, 3 with the keel below), joined as a line
  const facet = (r, row, shade) => {
    let run = [], key = null, prev = 0, started = false;
    const flush = () => {
      if (run.length > 1) p.polyline(run, prev, fade);
      run = [];
    };
    for (let i = 0; i <= n; i++) {
      if (rows(i, len) < r) {
        flush();
        key = null;
        continue;
      }
      const u = i / n, c = shade(u, i);
      if (c !== key) {
        flush();
        run = started ? [[Math.round(tx - i + 1), ty + row]] : [];   // bridge from the last pixel drawn
        key = prev = c;
      }
      run.push([Math.round(tx - i), ty + row]);
      started = true;
    }
    flush();
  };
  facet(1, 0, (u, i) => (i < 1 ? WHITE : color(u, 0)));
  facet(1, -1, (u) => color(u, 1));
  facet(2, 1, (u) => color(u, 2));
  p.px(tx, ty, WHITE);
}

export function create(o) {
  const base = o.silk === SILK && o.palette !== SILK ? o.palette : o.silk;
  const C = fit(base, 10), T = fit(o.tack, 6), R = new Rng(o.seed);
  const dur = meta.duration;
  let t = 0;

  // the slack filament in the hand before it snaps tight: a wavering 1 px thread with the wobble dying as it pulls
  const slack = Array.from({ length: 8 }, (_, i) => [i / 7, R.range(0.5, 1.1), R.range(4.2, 7.2)]);
  // the shaft's ends after it breaks: kicked off the point, then curling down and going grey
  const ends = Array.from({ length: 3 }, (_, i) => ({
    s0: 4 + i * 5.4, l: 3.2 + R.range(0, 1.6), vx: -R.range(2, 6), vy: -R.range(1, 4), kick: R.range(2.5, 4.5),
    lilt: R.range(-0.5, 0.4), bend: R.range(0.5, 1.1) * (i === 1 ? -1 : 1), ph: R.range(0, TAU),
  }));
  // three motes of silk shaken off the butt in the last frames before impact
  const motes = Array.from({ length: 3 }, (_, i) => ({ at: HIT - 0.09 + i * 0.03, vx: -R.range(1, 5), vy: R.range(-4, 4), life: R.range(0.04, 0.06) }));

  // a hard, front-loaded flight (ease.outExpo, then a little settle): most of the gap in two frames, but a
  // 14 / 26 / 27 / 25 px step between them, so nothing teleports
  const flight = (tt) => {
    const q = clamp((tt - PULL) / (HIT - PULL));
    return TIP0 + (HIT_X - TIP0) * (1.25 * q - 0.25 * q * q);
  };
  // how much of the shaft has been drawn out of the point: 6, 14, 19 px over the first three frames
  const drawn = (tt) => (tt < PULL ? 0 : L * smooth(0, CARRY * 1.6, tt - PULL));

  return {
    update(dt) {
      t += dt;
    },
    draw(p) {
      if (t >= dur) return;
      // no additive light rides the needle: at this size any halo reads as a round head. The white silk, and
      // the flash on contact, are the light.
      // ---- 1. the thread pulled taut in the hand, then gone
      if (t < PULL + 0.05) {
        const k = smooth(0, PULL, Math.max(0, t)), a = 1 - smooth(PULL, PULL + 0.05, t), reach = 3 + 8 * k;
        for (let i = 0; i < slack.length; i++) {
          const [u, wob, sp] = slack[i], amp = (1 - k) * wob * 2.1;
          p.dot(HX - u * reach, HY + amp * Math.sin(u * sp + Math.max(0, t) * 26) * u, i > 3 ? C[7] : C[6], a);
        }
        if (t < PULL) {
          // the last of the slack snapping to a single line: no plus-sign cross, which reads as a sparkle
          p.px(HX, HY, WHITE);
          p.dot(HX - 1, HY, C[8], 0.85 * k);
          if (k < 0.45) p.dot(HX - 2, HY, C[5], 0.35);
          p.glow(HX, HY, 4, C[5], 0.09 * a);
        }
      }
      // ---- 2. in flight: the point first, the shaft drawn out behind it, a short thread trailing
      if (t >= PULL && t < HIT) {
        const tx = flight(t), seg = drawn(t), full = clamp(seg / L);
        shaft(p, tx, HY, seg, (u, band) => {
          // the beading: the silk is lit along the top edge, cool in the groove, dark in the cut below it
          const sheen = Math.floor(u * seg / 9) % 2;
          if (u < 0.04) return band ? C[7] : C[9];
          if (band === 0) return sheen ? C[9] : C[8];        // the ridge, near white
          if (band === 1) return sheen ? C[5] : C[4];        // the cut under it, one hard step darker
          return C[3];                                       // the keel, the darkest facet
        }, 1);
        // a sheen of light along the shaft itself while it is at speed: a line, so it can't read as a head
        if (full < 0.9 && seg > 4) p.glowLine(tx, HY, tx - seg * 0.8, HY, 2, C[6], 0.1 * (1 - full));
        // the thread off the butt: a 1 px filament, 4 to 9 px, drawn straight by the speed and breaking into
        // separate strands as the pull on it runs out. It tapers away rather than stopping: nothing at all on
        // the last pixels, so the eye never reads a rope.
        const bx = tx - seg, len = Math.round((4 + 5 * full) * Math.min(1, full * 1.6));
        for (let i = 0; i < len; i++) {
          const u = i / len;
          if (rand(Math.floor(bx) - i, o.seed) < (1 - full) * 0.6) continue;
          const wob = Math.sin(i * 1.6 - t * 46) * (1 - u);
          p.dot(bx - i, HY + Math.round(wob * (0.5 + (1 - full))), i < 2 ? C[8] : i < 5 ? C[6] : C[5], (1 - u) * (0.45 + full * 0.55));
        }
        // a few motes shaken off the tail in the last frames, never ahead of it
        for (const m of motes) {
          const age = t - m.at;
          if (age < 0 || age > m.life) continue;
          const x = flight(m.at) - L + m.vx * age;
          if (x > bx - 1.5) continue;
          p.dot(x, HY + m.vy * age, C[4], (1 - age / m.life) * 0.9);
        }
      }
      // ---- 3. the hit: a hard 1 px flash, a pinch of thread left on the target, the shaft broken back
      if (t >= HIT) {
        const age = t - HIT;
        // the flash: one hard white pixel and a breath of light round it for a single frame. No glow ball:
        // at this size a soft blob reads as a round head, and this projectile is never round.
        if (age < 0.034) {
          const k = 1 - age / 0.034;
          p.px(HIT_X, HY, WHITE);
          p.px(HIT_X + 1, HY, C[9], k * 0.6);
          p.px(HIT_X - 1, HY, C[9], k * 0.5);
          p.px(HIT_X, HY - 1, C[8], k * 0.4);
          p.glow(HIT_X, HY, 3, WHITE, 0.2 * k);
        }
        // the tuft: a pinch of silk on the point, never bigger than 4 px across, drying white to grey.
        // It is thread, not a ball: three or four short ends converging on one pinned pixel.
        const dry = smooth(0.11, 0.24, age), fade = 1 - smooth(0.2, 0.28, age);
        if (fade > 0) {
          const cx = HIT_X, cy = HY, sh = 1 - 0.4 * dry;
          const pale = dry < 0.3 ? WHITE : at([C[9], C[8], C[7]], clamp((dry - 0.3) / 0.5));
          const grey = at([C[7], C[6], C[5], C[4]], dry);
          // the pin, then threads fanning off it on the diagonals, so the silhouette is a crossed pinch of silk
          // and never a square or a plus sign. Diagonals are what reads as thread at this size; the wad is 5 to
          // 7 px across, a third of the needle's length, and nothing like a ball.
          const fan = [
            [-2, -2, 0.95], [2, -2, 0.85], [2, 1, 0.8], [-2, 1, 0.75],
            [-1, -2, 0.7], [1, -1, 0.95], [-1, 1, 0.9], [1, 2, 0.6], [0, 2, 0.65], [-3, 0, 0.45], [3, -1, 0.4],
          ];
          p.px(cx, cy, pale);
          for (const [ox, oy, w] of fan) {
            if (dry > 0.55 && Math.abs(ox) > 1) continue;    // the outer threads pull in as it dries
            const x = Math.round(cx + ox * sh), y = Math.round(cy + oy * sh);
            p.dot(x, y, oy < 0 ? pale : grey, fade * w);
          }
          // the tack: one cool glint on the wet thread, gone before the grey sets in
          const wet = clamp(1 - dry / 0.45);
          if (wet > 0) p.dot(cx - 1, cy + 1, T[5], fade * wet * 0.9);
        }
        // the shaft's ends: two short pieces kicked back along the line of the shot, then hanging slack and dark
        for (let i = 0; i < 2; i++) {
          const a = 1 - smooth(0.13, 0.21, age);
          if (a <= 0) continue;
          const k = smooth(0, 0.05, age), drop = smooth(0.02, 0.13, age);
          const x = HIT_X - 5 - i * 4 - k * (1 + i), y = HY - 1 + i * 2 + drop * (2 + i);
          const c = at([C[6], C[5], C[4]], smooth(0.03, 0.2, age));
          p.dot(x, y, c, a * 0.95);
          p.dot(x - 1, y + drop * 0.8, c, a * 0.8);
          p.dot(x - 2, y + drop * 1.3, c, a * 0.55);
        }
        // the last wisp: a soft pale haze where the tuft was, gone well before t = duration
        if (age > 0.18 && age < 0.29) {
          const m = Math.sin(Math.PI * clamp((age - 0.18) / 0.11));
          if (m > 0) {
            p.disc(HIT_X - 1, HY + 1, 0.8 + m * 1.1, C[5], (d) => 0.16 * m * (1 - d * d));
            p.dot(HIT_X - 1, HY + 1, C[7], m * 0.6);
            p.dot(HIT_X, HY, C[6], m * 0.35);
          }
        }
      }
    },
  };
}
