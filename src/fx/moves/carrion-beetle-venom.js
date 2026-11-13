// Carrion beetle venom spit ("moves/carrion-beetle-venom"): a blood-red venom orb condenses out of dark-crimson
// miasma, slime beading off it and the fog winding inward as it swells. Then it screams flat across the arena
// shedding dripping after-images, bursts on the target into a fat viscous crimson splat veined with ink-green
// corrosion, and leaves the body smoking bubbling black rot while blood-worms bite and glow all over it.
import { Particles, Lights, P, PF, Rng, fit, clamp, smooth, lerp, ease, noise2, rand, TAU, WHITE, READY, mix, hex, stockActor } from "../../core/index.js";
import { Drops, bubble } from "../nature/_lib.js";
import { star, brokenRing, spikes, frontCrescent } from "../impacts/_lib.js";
import { unlight } from "../shadow/_lib.js";

const TX = 258;                    // the target's feet
const MOUTH_X = 36, MOUTH_Y = -38; // where the venom ball gathers in front of the caster
const T_SPIT = 0.60;
const T_HIT = 1.00;
const T_END = 3.55;
const X_MIN = -84, X_MAX = 384, Y_MIN = -172, Y_MAX = 16;

export const meta = {
  name: "Carrion beetle venom",
  desc: "Dark-crimson fog and slime gather into a hissing blood-red venom orb that screams into the target and bursts into a sticky corrosion splash, black rot smoke and biting blood-worms.",
  tags: ["move", "poison", "venom", "corrosion", "beetle", "spit", "ranged", "insect", "boss", "one-shot"],
  size: [480, 226],
  origin: [84, 176],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#0a0408", "#220610", "#420a16", "#6d1020", "#9e1728", "#cc2433", "#f04a44", "#ff8d6e", "#ffc9b0", "#ffffff"],
    bile: ["#050d07", "#0a1a0d", "#112b13", "#1a441c", "#27682a", "#3f9440", "#74c25a", "#c8f08a"],
    shell: ["#090510", "#1a0d16", "#2f1722", "#4a2431", "#6b3945", "#955459"],
    seed: 41,
  },
};

const GUARD = { ...READY, x: 0, crouch: 3, lean: 2, fx: 10, fy: -21, bx: 9, by: -21, ffx: 7, fbx: -8 };
const GATHER = { ...READY, x: -4, crouch: 7, lean: -5, hx: -2, hy: -1, fx: 5, fy: -26, bx: 12, by: -24, ffx: 7, fbx: -9 };
const SPIT = { ...READY, x: 6, crouch: 4, lean: 7, hx: 3, hy: 1, fx: 3, fy: -22, bx: 18, by: -24, ffx: 12, fbx: -9, ghost: 1 };
const FOLLOW = { ...SPIT, x: 6, lean: 5, fx: 6, fy: -21, bx: 17, by: -23, ghost: 0 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.34, GUARD],
    [0.0, GATHER],
    [T_SPIT, SPIT, "snap"],
    [T_SPIT + 0.15, FOLLOW],
    [1.45, { ...GUARD, x: 4, crouch: 4 }],
    [2.15, GUARD],
  ],
  hits: [
    { t: T_SPIT, stop: 0.04, shake: 0.15, amp: 1.8, target: false },
    { t: T_HIT, stop: 0.19, shake: 0.52, amp: 5.6, push: 2.4, straw: 36, y: -25, skin: "char", shiver: 1.8 },
    { t: T_HIT + 1.35, push: 0, straw: 0, flash: 0, skin: null },
  ],
  dust: [
    { t: T_SPIT, x: 10, n: 6, dir: 1 },
    { t: T_SPIT, x: -8, n: 5, dir: -1 },
    { t: T_HIT, x: TX - 6, n: 10, dir: -1 },
    { t: T_HIT, x: TX + 6, n: 9, dir: 1 },
  ],
};

// ---- soft pixel-cloud puffs. A scalloped, lumpy silhouette, translucent inside, with a lit rim, so fog and
// smoke never read as perfect soap circles.
const FUME = Array.from({ length: 21 }, (_, r) => {
  if (r < 2) return [];
  const pts = [];
  for (let dy = -r - 2; dy <= r + 2; dy++)
    for (let dx = -r - 2; dx <= r + 2; dx++) {
      const a = Math.atan2(dy, dx);
      const edge = 0.84 + 0.19 * Math.sin(a * 5 + r * 0.9) + 0.1 * Math.cos(a * 8 - r * 0.6) + 0.06 * Math.sin(a * 13 + r);
      const q = Math.hypot(dx, dy) / (r * edge);
      if (q > 1) continue;
      const lit = (-dx * 0.45 - dy * 0.9) / Math.max(1, r);
      pts.push(dx, dy, q, lit);
    }
  return pts;
});

function fume(p, cx, cy, r, alpha, cols, solid = false) {
  if (alpha <= 0.02 || r < 1.5) return;
  const ri = Math.min(20, Math.max(2, Math.round(r))), pts = FUME[ri];
  const rx = Math.round(cx), ry = Math.round(cy);
  for (let i = 0; i < pts.length; i += 4) {
    const px = rx + pts[i], py = ry + pts[i + 1];
    if (px < X_MIN + 3 || px > X_MAX - 3 || py < Y_MIN + 3 || py > Y_MAX - 2) continue;
    const q = pts[i + 2], lit = pts[i + 3];
    const c = cols(q, lit, px, py);
    if (!c) continue;
    p.blend(px, py, c, alpha * (solid ? (q > 0.9 ? 0.9 : 0.97) : q > 0.9 ? 0.85 : q > 0.6 ? 0.5 : 0.3));
  }
}

// ---- where the venom ball hangs while it gathers, and how it drifts as it swells
const chargePoint = (t) => [MOUTH_X + Math.sin(t * 2.1) * 0.9 - smooth(T_SPIT, T_SPIT + 0.2, t) * 3, MOUTH_Y + Math.sin(t * 2.6) * 1.2];

function slimeStrand(p, x0, y0, x1, y1, sag, t, ph, C, a) {
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const u = i / n, wob = Math.sin(t * 11 + ph + u * 6) * 0.6 * Math.sin(Math.PI * u);
    const x = lerp(x0, x1, u), y = lerp(y0, y1, u) + Math.sin(Math.PI * u) * sag + wob;
    p.px(x, y, i % 6 === 0 ? C[7] : i % 4 === 0 ? C[6] : C[3]);
    p.px(x, y + 1, i % 4 === 0 ? C[4] : C[1]);
  }
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + sag;
  p.px(mx - 1, my + 1, C[7]);
  p.px(mx, my + 1, C[6]);
  p.px(mx, my + 2, C[3]);
  p.px(mx, my + 3, C[1]);
}

// ---- the venom orb: a stretched globe blotched with ink-green corrosion, a spiked skin and a white-hot core
function orbBody(p, x, y, r, C, B, t, k = 1, spiky = 1) {
  const spin = t * 26;
  // a dark, ragged venom cloud dragged behind it (only when it is actually flying: at rest those
  // translucent ellipses would dither into pepper)
  if (spiky > 0.35) {
    p.ellipse(x - r * 1.15, y + 0.5, r * 1.5, r * 0.62, (d) => (d > 0.7 ? C[1] : C[2]), 0.5 * k);
    p.ellipse(x - r * 0.55, y + 0.5, r * 1.05, r * 0.8, (d) => (d > 0.7 ? C[2] : C[4]), 0.75 * k);
  }
  // thorny skin, dulled when the ball is only gathering (spiky 0) and full when it is screaming
  if (spiky > 0.05) {
    for (let i = 0; i < 9; i++) {
      const a = spin + (i / 9) * TAU;
      const L = r * (0.3 + 0.3 * Math.abs(Math.sin(i * 2.1 + t * 17))) * spiky;
      const bx = x + Math.cos(a) * r * 0.78, by = y + Math.sin(a) * r * 0.78;
      p.line(bx, by, bx + Math.cos(a) * L, by + Math.sin(a) * L, i % 2 ? B[2] : C[2], 0.75 * k);
    }
  }
  p.ellipse(x, y, r * 1.08, r * 0.94, (d) => (d > 0.9 ? C[1] : d > 0.64 ? C[3] : d > 0.38 ? (spiky > 0.5 ? C[5] : C[4]) : (spiky > 0.5 ? C[7] : C[5])), k);
  // ink-green corrosion eating through the skin
  for (let i = 0; i < 5; i++) {
    const a = spin * 0.55 + i * 1.75, d = r * (0.26 + 0.3 * (((i * 7) % 5) / 5));
    const bx = x + Math.cos(a) * d, by = y + Math.sin(a) * d, br = r * (0.17 + 0.09 * (i % 3));
    p.shade(bx - br, by - br, bx + br, by + br, (px, py, out) => {
      const dd = Math.hypot(px - bx, py - by) / br;
      if (dd > 1) return;
      out.c = dd > 0.7 ? B[1] : i % 2 ? B[4] : B[3];
      out.a = k;
    });
  }
  p.circle(x - r * 0.16, y - r * 0.2, r * (0.14 + 0.16 * spiky), k > 0.5 ? C[8] : C[7], k);
  p.px(x - r * 0.3, y - r * 0.36, WHITE);
  p.px(x + r * 0.52, y + r * 0.26, C[6]);
  p.arc(x, y, r * 1.05, 1.5, -2.45, -0.35, spiky > 0.5 ? C[8] : C[6], (0.35 + 0.45 * spiky) * k);
  p.glow(x, y, 30, C[4], (0.2 + 0.3 * spiky) * k);
  p.glow(x, y, 13, C[7], (0.14 + 0.2 * spiky) * k);
}

// ---- the worm: a blood-gu maggot, dark crimson with a glowing rim and a tiny inked head
function worm(p, x, y, len, ang, t, ph, C, B, k) {
  const n = 7, ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, wav = Math.sin(t * 7.5 + ph + u * 4.6) * (0.8 + u * 1.7);
    pts.push([x + ca * len * u + nx * wav, y + sa * len * u + ny * wav]);
  }
  // soft dark cast under the grub so it sits on the body
  for (let i = 0; i <= n; i++) {
    const u = i / n, [px, py] = pts[i];
    p.shade(px - 3, py - 1, px + 3, py + 3, (qx, qy, o) => { o.c = C[0]; o.a = 0.22 * k * (1 - u * 0.3); });
  }
  // a fat segmented grub: a hard dark outline keeps it legible over the wet red body,
  // pale dorsal ridge on top, black shadow underneath
  for (let i = n; i >= 0; i--) {
    const u = i / n, [px, py] = pts[i];
    const r = (2.7 - u * 0.85) * (1 + 0.1 * Math.sin(t * 12 + ph + u * 7));
    p.circle(px, py, r + 1, C[0], 0.8 * k);
  }
  for (let i = n; i >= 0; i--) {
    const u = i / n, [px, py] = pts[i];
    const r = (2.7 - u * 0.85) * (1 + 0.1 * Math.sin(t * 12 + ph + u * 7));
    p.circle(px, py, r, (d, q) => {
      const lit = -(Math.cos(q) * 0.45 + Math.sin(q) * 0.9);
      return d > 0.72 ? C[1] : lit > 0.55 ? C[7] : lit > 0.2 ? C[5] : lit > -0.4 ? C[4] : C[2];
    }, k);
    if (i > 0 && i < n) p.px(px + nx * 0.6, py + ny * 0.6, C[0], 0.6 * k);
  }
  const h = pts[n], hb = pts[n - 1];
  const hdx = (h[0] - hb[0]), hdy = (h[1] - hb[1]), hl = Math.hypot(hdx, hdy) || 1;
  const ux = hdx / hl, uy = hdy / hl;
  // head plate, eyes and the two hooked mandibles
  p.circle(h[0], h[1], 3, (d, q) => (d > 0.7 ? C[1] : d > 0.3 ? C[3] : C[4]), k);
  p.px(h[0] - uy * 1.6, h[1] + ux * 1.6, C[0], k);
  p.px(h[0] + uy * 1.6, h[1] - ux * 1.6, C[0], k);
  p.dot(h[0], h[1], C[7], 0.95 * k);
  p.px(h[0] + ux * 1.4 - uy * 1.2, h[1] + uy * 1.4 + ux * 1.2, C[8], k);
  p.line(h[0] + ux * 2, h[1] + uy * 2, h[0] + ux * 5 - uy * 1.8, h[1] + uy * 5 + ux * 1.8, C[5], k);
  p.line(h[0] + ux * 2, h[1] + uy * 2, h[0] + ux * 5 + uy * 1.8, h[1] + uy * 5 - ux * 1.8, C[5], k);
  p.px(h[0] + ux * 5 - uy * 1.8, h[1] + uy * 5 + ux * 1.8, C[7], k);
  p.px(h[0] + ux * 5 + uy * 1.8, h[1] + uy * 5 - ux * 1.8, C[7], k);
  p.glow(h[0], h[1], 10, C[5], 0.42 * k);
  return h;
}

// ---- a sticky blob of venom: an irregular glossy lump with a sick green sheen and a hanging drip
function glob(p, x, y, s, ph, t, C, B, k, stretch = 1) {
  p.shade(x - s * stretch - 1, y - s * 1.15 - 1, x + s * stretch + 1, y + s * 1.25 + 2, (px, py, out) => {
    const dx = (px - x) / stretch, dy = py - y, a = Math.atan2(dy, dx);
    const edge = s * (1 + 0.15 * Math.sin(a * 4 + ph) + 0.07 * Math.cos(a * 7 - ph));
    const d = Math.hypot(dx, dy);
    if (d > edge) return;
    const lit = (-dx * 0.4 - dy * 0.9) / s;
    out.c = d > edge - 1.2 ? C[1] : lit > 0.45 ? C[6] : lit > 0 ? C[5] : lit > -0.7 ? C[4] : C[2];
    out.a = Math.min(1, k * 1.5);
  });
  if (s > 2.6 && k > 0.45) {
    p.px(x - s * 0.32, y - s * 0.5, C[8], k);
    p.px(x - s * 0.32 + 1, y - s * 0.5, C[7], k);
  }
  p.dot(x + s * 0.5, y + 1, B[4], 0.9 * k);
  const drip = 2 + ((ph * 3) % 4);
  p.line(x + 0.5, y + s * 0.55, x + 0.5, y + s * 0.55 + drip + Math.sin(t * 3 + ph) * 0.7, C[2], 0.85 * Math.min(1, k * 1.4));
  p.px(x + 0.5, y + s * 0.55 + drip, C[6], k);
}

// ---- a fat splat of venom: a lumpy blob, hot on its lit side, veined with ink-green rot
function splat(p, x, y, r, ph, C, B, a, stretch = 1) {
  p.shade(x - r * (1.3 * stretch) - 1, y - r * 1.4, x + r * (1.3 * stretch) + 1, y + r * 1.4, (px, py, out) => {
    const dx = (px - x) / stretch, dy = py - y, ang = Math.atan2(dy, dx);
    const edge = r * (1 + 0.26 * Math.sin(ang * 3 + ph) + 0.12 * Math.sin(ang * 5 - ph * 1.7) + 0.07 * Math.sin(ang * 7 + ph * 2.3));
    const d = Math.hypot(dx, dy);
    if (d > edge) return;
    const lit = (-dx * 0.45 - dy * 0.9) / r;
    out.c = d > edge - 1.3 ? C[1] : lit > 0.74 ? C[6] : lit > 0.34 ? C[5] : lit > -0.25 ? C[4] : lit > -0.68 ? C[3] : C[2];
    // a few darker channels running out from the core, so the mass reads as one run of liquid
    const riv = Math.abs(Math.sin(ang * 3 + ph * 0.6)) * r;
    if (d < edge * 0.9 && d < riv + 0.9 && d > r * 0.18) out.c = C[1];
    if (d < edge * 0.5 && rand(Math.floor(px * 2) + 3, Math.floor(py * 2), 9) > 0.97) out.c = C[1];
    if (d < edge * 0.34 && lit < -0.1 && rand(Math.floor(px * 2.4) + 7, Math.floor(py * 2.4), 3) > 0.96) out.c = C[7];
    if (d > edge - 1.4 && lit > 0.3) out.c = C[7];
    out.a = a;
  });
}

export function create(o) {
  const C = fit(o.palette, 10), B = fit(o.bile, 8), S = fit(o.shell, 6), R = new Rng(o.seed);
  const floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[8], C[6], C[4]], haze: C[4] });
  const drops = new Drops(floor), lights = new Lights();

  // charge: dark-crimson fog spiralling into the venom ball
  const mists = Array.from({ length: 46 }, (_, i) => ({
    t0: R.range(-0.08, T_SPIT - 0.04), life: R.range(0.5, 0.78), a0: R.range(0, TAU), spin: R.range(1.3, 2.9) * (i % 2 ? 1 : -1),
    r0: R.range(60, 104), r1: R.range(12, 22), size: R.range(4, 7.5), ph: R.range(0, TAU),
  }));
  // the shroud that closes over the empty spot after the spit
  const shroud = Array.from({ length: 18 }, (_, i) => ({
    a0: R.range(0, TAU), r: R.range(6, 26), t0: T_SPIT + 0.08 + i * 0.02, life: R.range(0.5, 0.9), size: R.range(5, 10), drift: R.range(-10, 10),
  }));

  const stains = [];
  const ghosts = [];

  // sticky globs thrown onto the target, sliding slowly down its body
  const globs = Array.from({ length: 11 }, () => ({
    dx: R.range(-12, 12), dy: R.range(-42, -7), s: R.range(2.4, 5.2), stretch: R.range(0.85, 1.5),
    t0: T_HIT + R.range(0.01, 0.18), slide: R.range(2, 13), ph: R.range(0, TAU),
  }));
  // long strands of goo hanging off the body, beading at their ends
  const strands = Array.from({ length: 4 }, () => ({
    dx: R.range(-13, 13), dy: R.range(-40, -12), len: R.range(6, 15), t0: T_HIT + R.range(0.08, 0.3), ph: R.range(0, TAU),
  }));

  // corrosion: blisters swelling on the body, black smoke boiling off it, blood-worms biting
  const bodyBubbles = Array.from({ length: 20 }, (_, i) => ({
    dx: R.range(-12, 12), dy: R.range(-45, -6), r: R.range(1.4, 3),
    t0: T_HIT + 0.08 + i * 0.09 + R.range(-0.03, 0.03), life: R.range(0.42, 0.72), ph: R.range(0, TAU),
  }));
  // three rot vents on the body, each breathing a column of black smoke up over the victim
  const VENTS = [[-8, -40], [-2, -26], [6, -15]];
  const blackPuffs = [];
  for (let v = 0; v < VENTS.length; v++)
    for (let j = 0; j < 11; j++)
      blackPuffs.push({
        dx: VENTS[v][0] + R.range(-3.5, 3.5), dy: VENTS[v][1] + R.range(-3, 3),
        t0: T_HIT + 0.1 + j * 0.16 + v * 0.06, life: R.range(1.0, 1.5),
        r0: R.range(2.6, 4.2), r1: R.range(8, 13), rise: R.range(26, 40), drift: R.range(-7, 9), ph: R.range(0, TAU),
      });
  const worms = Array.from({ length: 5 }, (_, i) => ({
    dx: [-11, 9, -4, 7, -9][i], dy: [-34, -31, -22, -14, -8][i],
    ang: [2.55, 0.35, -2.15, 2.5, -0.55][i], len: R.range(13, 18), ph: R.range(0, TAU),
    t0: T_HIT + 0.16 + i * 0.14, bite: 0.5 + (i % 3) * 0.08,
  }));
  // crimson veins crawling over the soaked body
  const veins = Array.from({ length: 7 }, () => {
    const pts = [[R.range(-12, 12), R.range(-42, -30)]];
    for (let i = 0; i < 4; i++) pts.push([clamp(pts[i][0] + R.range(-7, 7), -13, 13), clamp(pts[i][1] + R.range(3, 8), -46, -5)]);
    return { pts, ph: R.range(0, TAU) };
  });

  // impact: liquid arms, a broken ring, splat shards and a floor pool
  // splatter arms: uneven, bunched, mostly thrown up and sideways, never a neat burst
  const ARM_A = [-2.75, -1.95, -1.15, -0.35, 0.5, 1.5, 2.5];
  const arms = ARM_A.map((a0, i) => ({
    a: a0 + R.range(-0.14, 0.14), len: R.range(16, 30) * (i % 3 === 0 ? 1.5 : i % 2 ? 0.75 : 1.1),
    w: R.range(3.6, 6.4), sag: R.range(2, 14), curl: R.range(-0.22, 0.22), ph: R.range(0, TAU), r0: R.range(0.6, 0.85),
  }));
  const hitSpikes = spikes(R, 11, -0.3, { len: [8, 16], w: [1.6, 2.4], fwd: 1.5, back: 0.7 });
  const splatShards = Array.from({ length: 5 }, (_, i) => ({
    a: R.range(-Math.PI, Math.PI), sp: R.range(26, 70), s: R.range(4, 8), ph: R.range(0, TAU), life: R.range(0.45, 0.75), delay: R.range(0, 0.05),
    dx: 0, dy: 0, i,
  }));
  const poolBubbles = Array.from({ length: 16 }, (_, i) => ({
    x: R.range(-38, 38), t0: T_HIT + 0.18 + i * 0.12, swell: R.range(0.28, 0.46), rmax: R.range(1.8, 3.8), ph: R.range(0, TAU),
  }));

  const BODY = stockActor(2);
  const bodyCells = [];
  for (let by = 0; by < BODY.h; by++)
    for (let bx = 0; bx < BODY.w; bx++)
      if (BODY.mask.data[by * BODY.w + bx] && (bx * 5 + by * 3) % 4 !== 0) bodyCells.push([TX + BODY.x + bx + 0.5, BODY.y + by + 0.5]);

  const soakCenters = [
    { x: TX + 0.5, y: -34, r: 8 }, { x: TX - 2, y: -24, r: 11 }, { x: TX + 3, y: -14, r: 9 }, { x: TX - 9, y: -22, r: 6 }, { x: TX + 9, y: -20, r: 6 },
  ];
  const coated = (px, py, tt) => {
    const grow = smooth(0.02, 0.42, tt - T_HIT);
    let f = 0;
    for (const c of soakCenters) f = Math.max(f, 1 - Math.hypot(px - c.x, py - c.y) / c.r);
    const n = noise2(px * 0.34, py * 0.34 - tt * 0.24, 9);
    return f * 1.55 + n * 0.5 > 0.62 + (1 - grow) * 1.3;
  };

  const orbPos = (tt) => {
    const u = clamp((tt - T_SPIT) / (T_HIT - T_SPIT));
    return [lerp(MOUTH_X, TX, Math.pow(u, 0.9)), lerp(MOUTH_Y, -26, u) - Math.sin(Math.PI * u) * 4];
  };
  const endFade = (tt) => 1 - smooth(T_END - 0.55, T_END - 0.06, tt);

  let t = 0, acc = 0, dripAcc = 0, ghostAcc = 0, spat = false, hit = false;

  return {
    update(dt) {
      t += dt;
      const f = Math.min(1, dt * 120);
      const cp = chargePoint(t);

      // during the charge the jaws drool and the poison fog is torn inward
      if (t < T_SPIT) {
        for (acc += dt; acc >= 0.1; acc -= 0.1) {
          drops.add(cp[0] + R.range(-4, 4), cp[1] + R.range(3, 8), R.range(-8, 10), R.range(14, 50), 1, 0);
        }
        if (t > 0.16 && R.chance(0.22 * f)) {
          const a = R.range(0, TAU), d = R.range(50, 88);
          ps.spawn(P.STREAK, cp[0] + Math.cos(a) * d, cp[1] + Math.sin(a) * d * 0.8, -Math.cos(a) * d * 3.4, -Math.sin(a) * d * 3.4, R.range(0.18, 0.3), R.chance(0.22) ? B[3] : C[4], R.range(0.9, 1.5));
        }
        if (R.chance(0.09 * f)) ps.spawn(P.VAPOUR, cp[0] + R.range(-9, 11), cp[1] + R.range(-9, 8), R.range(-9, 9), R.range(-30, -12), R.range(0.5, 0.9), C[2], R.range(3.5, 6.5));
      }

      // the spit: the jaws snap open, the slime strands tear and the mouth blooms with light
      if (!spat && t >= T_SPIT) {
        spat = true;
        const mo = chargePoint(T_SPIT);
        lights.add(mo[0], mo[1], 52, C[5], 0.9, 0.16);
        lights.add(mo[0], mo[1], 20, WHITE, 0.6, 0.07);
        for (let i = 0; i < 24; i++) {
          const a = R.range(-0.7, 0.7), sp = R.range(110, 300);
          ps.spawn(P.SPARK, mo[0], mo[1], Math.cos(a) * sp, Math.sin(a) * sp - 30, R.range(0.12, 0.34));
        }
        for (let i = 0; i < 16; i++) {
          const a = R.range(-1, 0.5), sp = R.range(30, 150);
          drops.add(mo[0], mo[1], Math.cos(a) * sp + 80, Math.sin(a) * sp, R.range(1, 2.4));
        }
        for (let i = 0; i < 6; i++) ps.spawn(P.SMOKE, mo[0] + R.range(-4, 8), mo[1] + R.range(-6, 6), R.range(30, 90), R.range(-30, 4), R.range(0.8, 1.3), C[1], R.range(3.5, 5.5), 0, 2);
        for (let i = 0; i < 9; i++) ps.spawn(P.SMOKE, cp[0] + R.range(-16, 10), cp[1] + R.range(-12, 12), R.range(-24, 24), R.range(-20, 8), R.range(0.6, 1.1), C[0], R.range(4, 7), 0, PF.BIG);
      }

      // the orb sheds venom as it flies; the shed drops leave streaks of after-image behind them
      if (t >= T_SPIT && t < T_HIT) {
        for (dripAcc += dt; dripAcc >= 0.042; dripAcc -= 0.042) {
          const [ox, oy] = orbPos(t);
          drops.add(ox + R.range(-5, 5), oy + R.range(-4, 4), -R.range(15, 70), R.range(10, 70), R.chance(0.55) ? 2.4 : 1.6);
        }
        for (ghostAcc += dt; ghostAcc >= 0.02; ghostAcc -= 0.02) {
          const [ox, oy] = orbPos(t);
          ghosts.push({ x: ox, y: oy, t0: t, r: 7.4 + Math.sin(t * 32) * 0.5 });
          if (ghosts.length > 32) ghosts.shift();
        }
        if (R.chance(0.6 * f)) {
          const [ox, oy] = orbPos(t);
          ps.spawn(P.MOTE, ox + R.range(-5, 2), oy + R.range(-5, 5), -R.range(50, 120), R.range(-20, 20), R.range(0.18, 0.36), R.chance(0.5) ? B[4] : C[4], R.range(0.6, 1.1));
        }
        if (R.chance(0.2 * f)) {
          const [ox, oy] = orbPos(t);
          ps.spawn(P.VAPOUR, ox - 7, oy + R.range(-4, 4), -R.range(25, 70), R.range(-14, 10), R.range(0.5, 0.9), C[2], R.range(3.5, 6));
        }
      }

      // impact: a hot white punch, thick venom thrown both ways, sticky globs left on the body
      if (!hit && t >= T_HIT) {
        hit = true;
        lights.add(TX, -26, 32, WHITE, 1, 0.06);
        lights.add(TX, -24, 92, C[5], 0.8, 0.5);
        lights.add(TX - 30, -10, 46, C[4], 0.5, 0.8);
        lights.add(TX + 30, -14, 44, C[3], 0.45, 0.8);
        for (let i = 0; i < 9; i++) {
          const a = R.range(-Math.PI, Math.PI), sp = R.range(70, 280);
          ps.spawn(P.SPARK, TX, -26, Math.cos(a) * sp, Math.sin(a) * sp - 40, R.range(0.14, 0.4));
        }
        for (let i = 0; i < 22; i++) {
          const a = R.range(-Math.PI, Math.PI), sp = R.range(90, 330);
          drops.add(TX + R.range(-3, 3), -26 + R.range(-4, 4), Math.cos(a) * sp, Math.sin(a) * sp - 70, R.range(1.8, 3.6));
        }
        for (let i = 0; i < 9; i++) ps.spawn(P.SMOKE, TX + R.range(-9, 9), -24 + R.range(-9, 9), R.range(-70, 70), R.range(-40, 20), R.range(0.9, 1.5), C[1], R.range(3.5, 6), 0, R.chance(0.5) ? 2 : 0);
        for (let i = 0; i < 10; i++) ps.spawn(P.DUST, TX + R.range(-20, 20), -2, R.range(-110, 110), R.range(-36, -8), R.range(0.45, 0.9), C[1], R.range(3, 5.5));
        for (const s of splatShards) {
          const a = s.a, sp = s.sp;
          s.dx = Math.cos(a) * (sp / 3.4);
          s.dy = -26 + Math.sin(a) * (sp / 3.4) - 10;
        }
      }

      // the drops land: each one leaves a stain and a puff of dark venom breath
      drops.update(dt, (d, gy) => {
        stains.push({ x: clamp(d.x, X_MIN + 6, X_MAX - 6), t0: t, w: 0.8 + d.s * 0.9, green: R.chance(0.4) });
        if (t < T_END - 0.9) ps.spawn(P.VAPOUR, d.x, gy - 1, R.range(-10, 10), R.range(-24, -8), R.range(0.4, 0.7), R.chance(0.4) ? B[3] : C[2], R.range(2.5, 4.5));
      });
      for (const d of drops.list) {
        d.x = clamp(d.x, X_MIN + 4, X_MAX - 4);
        if (d.y < Y_MIN + 3) { d.y = Y_MIN + 3; d.vy = Math.max(0, d.vy); }
      }
      if (t > T_END - 0.4) drops.list.length = 0;

      if (t > T_HIT + 0.2 && t < T_HIT + 1.9 && R.chance(0.4 * f)) {
        const bp = blackPuffs[Math.floor(R.next() * blackPuffs.length)];
        ps.spawn(P.VAPOUR, TX + bp.dx, bp.dy, R.range(-10, 10), R.range(-26, -10), R.range(0.5, 0.9), C[0], R.range(2.5, 5));
      }

      ps.update(dt);
      lights.update(dt);
      for (let i = ghosts.length - 1; i >= 0; i--) if (t - ghosts[i].t0 > 0.2) ghosts.splice(i, 1);
      for (let i = stains.length - 1; i >= 0; i--) if (t - stains[i].t0 > T_END) stains.splice(i, 1);
    },

    drawBack(p) {
      if (t >= T_END - 0.02) return;
      const fade = endFade(t);

      // floor stains eaten by the dripping venom, glossy dark red with an ink-green edge
      for (const s of stains) {
        const age = t - s.t0, k = Math.min(1, age * 14) * (1 - smooth(1.6, 2.8, age)) * fade;
        if (k <= 0.02) continue;
        const w = s.w * (1 + age * 0.25);
        for (let x = Math.floor(s.x - w); x <= Math.ceil(s.x + w); x++) {
          const d = Math.abs(x - s.x) / w;
          if (d > 1) continue;
          p.dot(x, 0, d < 0.45 ? mix(C[1], hex("#070407"), 0.5) : C[2], k);
          p.dot(x, 1, d < 0.5 ? C[1] : B[1], k * 0.6);
          if (s.green && d > 0.55) p.dot(x, 0, B[3], k * 0.8);
        }
      }

      // the venom pool: a dark crimson puddle veined with ink-green corrosion, bubbling and cooling
      if (t >= T_HIT) {
        const age = t - T_HIT;
        const w = 46 * ease.outCubic(clamp(age / 0.42)) * (1 - smooth(T_HIT + 1.9, T_END - 0.2, t));
        if (w > 1) {
          for (let x = Math.floor(-w); x <= Math.ceil(w); x++) {
            const d = Math.abs(x + 0.5) / w;
            if (d > 1) continue;
            const deep = Math.max(1, Math.round(4 * Math.sqrt(1 - d * d)));
            for (let y = 0; y <= deep; y++) {
              const n = noise2(x * 0.22 + TX * 0.5, y * 0.6 + t * 0.7, 3);
              p.dot(TX + x, y, y === deep ? (d > 0.82 ? C[0] : n > 0.35 ? B[2] : C[2]) : y === 0 ? (n > 0.45 ? B[3] : C[4]) : C[1], fade);
            }
            if (d < 0.36) p.dot(TX + x, 0, d < 0.16 ? C[6] : C[3], fade * (0.5 + 0.5 * Math.sin(t * 3 + x * 0.3)));
          }
          p.glow(TX, -3, w * 1.3, C[4], 0.24 * fade * (0.8 + 0.2 * Math.sin(t * 5)));
          p.glow(TX, 0, w * 0.75, B[4], 0.14 * fade);
          for (const pb of poolBubbles) {
            const bAge = t - pb.t0;
            if (bAge < 0) continue;
            if (bAge < pb.swell) bubble(p, TX + pb.x, 0, pb.rmax * ease.outCubic(bAge / pb.swell), C[8], C[0], C[4], fade, true);
            else if (bAge < pb.swell + 0.24) {
              const u = (bAge - pb.swell) / 0.24, rr = 1.5 + 9 * ease.outCubic(u);
              for (let a = 0; a < TAU; a += 0.45 / rr) p.dot(TX + pb.x + Math.cos(a) * rr, Math.sin(a) * rr * 0.26, u < 0.4 ? C[8] : C[5], (1 - u) * fade);
            }
          }
        }
      }

      drawArms(p, true, fade);
      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.02) return;
      const fade = endFade(t);
      const cp = chargePoint(t);

      // ---- 1. the charge: dark-crimson fog winds in, and the venom ball condenses inside it, slime
      // beading off its underside, until it is flung loose
      if (t < T_SPIT + 0.22) drawCharge(p, t, cp, C, B, fade);

      // ---- 3. the orb in flight: dripping after-images, a viscous wake, then the orb itself
      if (t >= T_SPIT && t < T_HIT) drawFlight(p, t, C, B);

      // ---- 4. the impact
      if (t >= T_HIT) drawHit(p, t, C, B, fade);

      drawDrops(p, t, C, B);
      ps.draw(p, "front");

      lights.draw(p);
      if (t >= T_HIT) drawBlackSmoke(p, t, C, B, fade);

      // ---- 5. what it leaves on the target: bubbling black corrosion and blood-worms biting in the smoke
      if (t >= T_HIT) drawCorrosion(p, t, C, B, fade);
    },
  };

  // ================= drops =================
  function drawDrops(p, tt, C, B) {
    for (const d of drops.list) {
      if (d.delay > 0) continue;
      const sp = Math.hypot(d.vx, d.vy) || 1, ux = d.vx / sp, uy = d.vy / sp;
      const len = Math.min(7, 0.6 + sp * 0.016) * Math.min(2, d.s);
      p.beam(d.x - ux * len, d.y - uy * len, d.x, d.y, Math.max(1, d.s * 0.9), (v) => (v > 0.55 ? C[1] : C[3]), 0.95);
      p.circle(d.x, d.y, 0.7 + d.s * 0.45, C[5], 1);
      p.px(d.x - ux, d.y - uy, C[7]);
      if (d.s > 2.1) p.dot(d.x + 0.5, d.y + 0.5, B[2], 0.7);
      if (d.s > 1.8) p.dot(d.x - ux * 1.6, d.y - uy * 1.6, C[4], 0.8);
    }
  }

  // ================= charge =================
  function drawCharge(p, tt, cp, C, B, fade) {
    const m = { cx: cp[0], cy: cp[1] };
    const charge = smooth(0, 0.22, tt);
    for (const q of mists) {
      const age = tt - q.t0;
      if (age < 0 || age >= q.life) continue;
      const u = age / q.life;
      const rad = lerp(q.r0, q.r1, ease.inCubic(u));
      const a = Math.sin(Math.PI * Math.min(1, u * 1.08)) * 0.68 * fade * (0.45 + 0.55 * charge);
      for (let s = 0; s < 2; s++) {
        const uu = Math.max(0, u - s * 0.11), rr = lerp(q.r0, q.r1, ease.inCubic(uu));
        const aa = q.a0 + q.spin * (age - s * 0.06) * 2.2;
        const x = m.cx + Math.cos(aa) * rr, y = m.cy + Math.sin(aa) * rr * 0.72 - u * 8;
        const sz = q.size * (0.6 + 0.55 * (1 - uu)) * (0.6 + 0.4 * smooth(18, 40, rr));
        fume(p, x, y, sz, a * (0.62 - s * 0.18), (qd, lit, px, py) => {
          if (qd > 0.82) return C[0];
          if (qd > 0.6) return lit > -0.5 ? C[1] : C[2];
          if (lit > 0.25) return C[2];
          if (noise2(px * 0.12, py * 0.12, 7) > 0.55) return B[2];
          return C[1];
        });
      }
      if (rad < 22) p.glow(m.cx, m.cy, rad * 1.8, C[4], 0.08 * fade);
    }
    // long tongues of fog winding inward on the charge point. Drawn with blended discs: these are translucent
    // volumes, and the dithered put() would break them into a dotted ring
    for (let i = 0; i < 3; i++) {
      const ph = i * 2.1 + tt * 0.9, N = 44;
      for (let s2 = 0; s2 <= N; s2++) {
        const u = s2 / N, ang = ph + u * 4.2 * (i % 2 ? 1 : -1);
        const rr = lerp(52 + i * 7, 14, ease.inCubic(u));
        const x = m.cx + Math.cos(ang) * rr, y = m.cy + Math.sin(ang) * rr * 0.7;
        const aa = 0.26 * charge * fade * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.6 + 0.4 * Math.sin(u * 14 - tt * 3 + i));
        if (aa <= 0.01) continue;
        p.disc(x, y, 3.4 - u * 1.5, (d) => (d > 0.5 ? C[0] : u < 0.5 ? C[2] : C[1]), aa);
      }
    }
    // tendrils of poison fog tying the charge back to the caster's chest
    for (let i = 0; i < 3; i++) {
      const ph = i * 2.1 + tt * 1.6;
      for (let s = 0; s <= 22; s++) {
        const u = s / 22;
        const x = lerp(m.cx - 16, 4, u) + Math.sin(u * 6 + ph) * 3.5 * u;
        const y = lerp(m.cy + 8, -26, u) + Math.cos(u * 5 + ph * 1.3) * 3 * u;
        const ta = 0.34 * (1 - u * 0.3) * charge * fade;
        p.disc(x, y + 0.5, 1.9 - u * 0.7, (d) => (d > 0.5 ? C[0] : i === 1 ? B[2] : C[2]), ta);
      }
    }
    // ---- the venom ball itself: it condenses out of the fog, sloshing and strung with mucus
    const grow = Math.pow(smooth(0.04, T_SPIT, tt), 1.15);
    const r = 1.1 + 5.4 * grow * (1 + 0.05 * Math.sin(tt * 23));
    const live = tt < T_SPIT;
    if (live && r > 1.2) {
      const a = fade * smooth(0.04, 0.2, tt);
      // a lumpy membrane of goo under the globe: only its outer lobes show past the orb, so the
      // silhouette breaks up instead of the ball reading as a clean circle
      for (let i = 0; i < 5; i++) {
        const ang = tt * 2.2 + (i / 5) * TAU;
        const rr = r * (0.72 + 0.14 * Math.sin(tt * 9 + i * 2));
        const gx = m.cx + Math.cos(ang) * rr, gy = m.cy + Math.sin(ang) * rr * 0.9;
        p.circle(gx, gy, r * 0.46, (d, q) => (d > 0.78 ? C[1] : Math.sin(q) < -0.15 ? S[3] : S[2]), a * 0.95);
      }
      p.circle(m.cx, m.cy, r + 0.8, C[0], a);
      orbBody(p, m.cx, m.cy, r, C, B, tt, a, 0.25);
      // wet glints on the membrane, and two heavy drips hanging off the belly
      for (let i = 0; i < 3; i++) {
        const ang = tt * 2.2 + (i / 3) * TAU + 0.6;
        const gx = m.cx + Math.cos(ang) * r * 0.78, gy = m.cy + Math.sin(ang) * r * 0.7;
        p.px(gx, gy, C[7], a * 0.9);
        p.px(gx, gy + 1, C[4], a * 0.7);
      }
      glob(p, m.cx - r * 0.55, m.cy + r * 0.6, r * 0.5, 1.1, tt, C, B, a * 0.95, 0.9);
      glob(p, m.cx + r * 0.5, m.cy + r * 0.65, r * 0.42, 3.3, tt, C, B, a * 0.95, 0.85);
      // slime strings off the underside, and one tying the ball back to the caster
      for (let i = 0; i < 4; i++) {
        const sx = m.cx + (i - 1.5) * 2.2, sy = m.cy + r * 0.94;
        slimeStrand(p, sx, sy, sx + Math.sin(tt * 1.6 + i) * 1.1, sy + 4 + i * 2.6, 2.2, tt, i * 1.9, C, a * 0.85);
      }
      slimeStrand(p, m.cx - r * 0.75, m.cy + 1, 14, -33, 3.4, tt, 0.7, C, a * 0.8);
      p.glow(m.cx, m.cy, 18 + 12 * grow, C[4], 0.2 * grow * a);
      p.glow(m.cx, m.cy, 9 + 6 * grow, C[5], 0.16 * grow * a);
    }
    // the strands that tied it whip back and the fog closes over the empty spot
    if (!live && tt < T_SPIT + 0.22) {
      const k = clamp((tt - T_SPIT) / 0.22);
      for (const [tx, ty, sgn] of [[m.cx + 10, m.cy - 7, 1], [m.cx + 9, m.cy + 8, -1]]) {
        p.polyline([[tx, ty], [tx + 3 - k * 6, ty + sgn * (2 + k * 5)], [tx + 1 - k * 10, ty + sgn * (4 + k * 8)]], C[3], (1 - k) * 0.9);
        p.px(tx + 1 - k * 10, ty + sgn * (4 + k * 8), C[7], 1 - k);
      }
      for (const q of shroud) {
        const age = tt - q.t0;
        if (age < 0 || age >= q.life) continue;
        const u = age / q.life, rr = q.r * (0.6 + u * 1.4);
        fume(p, m.cx + Math.cos(q.a0) * rr + q.drift * u, m.cy + Math.sin(q.a0) * rr * 0.8, q.size * (0.6 + u * 0.6), (1 - smooth(0.55, 1, u)) * 0.75, (d) => (d > 0.72 ? C[0] : d > 0.45 ? C[1] : B[1]));
      }
    }

    p.glow(m.cx, -2, 52, C[3], 0.16 * charge * fade);
    p.glow(4, -24, 24, C[3], 0.1 * charge * fade);
  }

  // ================= flight =================
  function drawFlight(p, tt, C, B) {
    const [ox, oy] = orbPos(tt);

    // after-images: the orb's own past positions smeared into a tapering, dripping comet tail
    const tail = ghosts.slice().reverse();
    for (let i = 0; i < tail.length; i++) {
      const g = tail[i], u = i / Math.max(1, tail.length - 1);
      const age = tt - g.t0, fadeK = 1 - clamp(age / 0.22);
      if (fadeK <= 0.02) continue;
      const rr = g.r * (0.9 - u * 0.72);
      if (rr < 1) continue;
      const a = 0.34 * fadeK * (1 - u * 0.7);
      // two offset discs per sample make an elongated smear rather than a chain of beads
      p.disc(g.x + rr * 0.35, g.y, rr, (d) => (d > 0.68 ? C[1] : d > 0.4 ? C[2] : C[4]), a);
      p.disc(g.x - rr * 0.6, g.y, rr * 0.72, (d) => (d > 0.6 ? C[1] : C[3]), a * 0.85);
      if (i % 4 === 0 && rr > 2.4) p.disc(g.x - rr * 0.2, g.y + rr * 0.8, rr * 0.34, (d) => (d > 0.5 ? C[2] : C[6]), a * 1.1);
    }

    // a thick strand of mucus still tying the orb to the charge point, breaking and curling back
    const snap = clamp((tt - T_SPIT) / 0.15);
    if (snap < 1) {
      const mo = chargePoint(T_SPIT);
      const bx = lerp(mo[0], ox, 0.5), by = lerp(mo[1], oy, 0.5) + Math.sin(snap * Math.PI) * 3;
      p.polyline([[mo[0], mo[1]], [bx, by], [ox, oy]], (u) => (u > 0.4 ? C[6] : C[3]), 1 - snap);
      p.line(mo[0], mo[1] + 1, bx, by + 1.5, C[2], (1 - snap) * 0.8);
    }

    // the wake: a thick, twisting ribbon of dark venom trailing the orb. Blended, so it stays a ribbon
    for (let s = 0; s < 2; s++) {
      const N = 26;
      for (let i = 0; i <= N; i++) {
        const u = i / N, x = ox - 1 - u * (30 + 10 * Math.sin(tt * 11 + s)), y = oy + Math.sin(tt * 24 - u * 5 + s * 1.7) * (1.1 + u * 3.4);
        const aa = (1 - u) * (0.5 - s * 0.16);
        if (aa <= 0.02) continue;
        p.disc(x, y, (4.4 - u * 3.4) * (1 - s * 0.28), (d) => (d > 0.55 ? C[0] : u < 0.25 ? C[4] : u < 0.6 ? C[2] : C[1]), aa);
      }
    }
    // a few long strands of slime peeling off the back of the orb
    for (let i = 0; i < 3; i++) {
      const yy = oy - 4 + i * 4.5, len = 9 + i * 4;
      p.line(ox - 5, yy, ox - 5 - len, yy + 1 + i * 0.8, i === 1 ? C[4] : C[2], 0.9);
      p.px(ox - 5 - len, yy + 1 + i * 0.8, C[6]);
    }

    orbBody(p, ox, oy, 7.8 + Math.sin(tt * 34) * 0.5, C, B, tt, 1);
    p.glow(ox, -2, 34, C[4], 0.3);
    p.glow(ox, oy, 20, B[3], 0.12);
  }

  // ================= impact =================
  function drawArms(p, back, fade) {
    const age = t - T_HIT;
    if (age < 0 || age > 0.42) return;
    const u = age / 0.42, k = Math.sin(Math.PI * Math.pow(u, 0.5)), a = (1 - u * 0.45) * fade;
    const mass = 10 + 25 * ease.outCubic(clamp(age / 0.07));
    for (const s of arms) {
      if (Math.sin(s.a) < 0 !== back) continue;
      const reach = 4 + 16 * ease.outCubic(u) + s.len * 0.7 * k;
      const pts = [];
      for (let j = 0; j <= 5; j++) {
        const w = j / 5, ang = s.a + s.curl * w * w, rr = mass * s.r0 * (1 - w * 0.15) + reach * w;
        pts.push([TX + Math.cos(ang) * rr, clamp(-26 + Math.sin(ang) * rr * 0.92 + s.sag * u * u * w * w, -60, 44)]);
      }
      for (let j = 0; j < 5; j++) {
        const w = j / 5, th = s.w * (1 - w * 0.8) * (0.5 + k * 0.5);
        p.beam(pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1], th, (v) => (v < 0.5 ? C[2] : C[3]), a * 0.95);
      }
      for (let j = 0; j < 5; j++) {
        const w = j / 5, th = s.w * 0.45 * (1 - w * 0.8) * (0.4 + k * 0.6);
        p.beam(pts[j][0], pts[j][1] + 0.7, pts[j + 1][0], pts[j + 1][1] + 0.7, Math.max(1.4, th * 1.3), () => (w > 0.55 ? C[6] : C[5]), a);
      }
      const tip = pts[5], tp = pts[4];
      p.beam(tp[0], tp[1], tip[0], tip[1], Math.max(1, s.w * 0.34 * k), () => (u < 0.45 ? C[7] : C[5]), a);
      p.dot(tip[0], tip[1], u < 0.45 ? C[8] : C[6], a);
      if (u > 0.5) {
        const d = (u - 0.5) / 0.5, bx = clamp(tip[0] + Math.cos(s.a + s.curl) * 18 * d, X_MIN + 6, X_MAX - 6), by = clamp(tip[1] + Math.sin(s.a + s.curl) * 13 * d + 6 * d * d, -60, 44);
        glob(p, bx, by, (1.5 + s.w * 0.45) * (1 - d * 0.5), s.ph, age, C, B, (1 - d) * fade);
      }
      if (u < 0.35) p.glow(tip[0], tip[1], 7, C[5], 0.14 * (1 - u) * fade);
    }
  }

  function drawHit(p, tt, C, B, fade) {
    const age = tt - T_HIT;

    // a two-frame white punch, then a lumpy crimson splat that swells and tears apart
    if (age < 0.05) {
      const k = 1 - age / 0.05;
      p.circle(TX, -26, 4.5 + 4 * k, WHITE, 1);
      p.glow(TX, -26, 26 * k + 10, C[8], 0.5 * k);
    }
    if (age < 0.3) {
      const u = age / 0.3;
      const grow = ease.outCubic(clamp(age / 0.07));
      const shrink = 1 - smooth(0.16, 0.34, age);
      const r = 9 + 20 * grow;
      splat(p, TX, -26, r * (0.6 + 0.4 * shrink), 1.7, C, B, shrink * 0.97 * fade, 1.18);
      // a hot wet cap riding the splat, and its hot rim
      p.glow(TX, -26, 56 * (0.5 + grow * 0.5), C[5], 0.45 * shrink * fade);
      if (age < 0.11) {
        const kk = 1 - age / 0.11;
        star(p, TX, -26, hitSpikes, 0.7 + 0.2 * u, 0.55, [C[1], C[4], C[5], C[7]], kk * 0.85 * fade, 2.6);
      }
    }

    // thick venom arms thrown off the hit
    drawArms(p, false, fade);

    // floor shock: two low crescents and a kicked ring of dust and venom
    if (age < 0.2) {
      const u = age / 0.2, k = (1 - u) * fade;
      frontCrescent(p, TX + 14 + 50 * ease.outCubic(u), 1, 26 * (1 - u * 0.5), 8 * (1 - u * 0.5), [C[7], C[6], C[2]], k);
      frontCrescent(p, TX - 14 - 50 * ease.outCubic(u), -1, 26 * (1 - u * 0.5), 8 * (1 - u * 0.5), [C[7], C[6], C[2]], k);
    }

    // fat teardrops flying off, each with a bright bead head and a dark trailing body
    for (const s of splatShards) {
      const sa = age - s.delay;
      if (sa < 0 || sa > s.life) continue;
      const u = sa / s.life;
      const drag = 1 - Math.exp(-sa * 3);
      const dx = s.dx * 1.22 * drag, dy = s.dy * 1.1 * drag + s.dy * 1.6 * sa * sa;
      const x = TX + dx, y = -26 + dy;
      const a = (1 - u) * fade;
      const tx = x - Math.cos(s.a) * 5 * (1 - u), ty = y - Math.sin(s.a) * 5 * (1 - u) - 2;
      p.beam(tx, ty, x, y, s.s * (1 - u * 0.5), (v) => (v > 0.6 ? C[1] : C[4]), a);
      glob(p, x, y, s.s * 0.7 * (1 - u * 0.4), s.ph, sa, C, B, a);
      if (s.s > 4.5) p.dot(x + 1, y + 1, B[3], a);
    }

    // a couple of scorpion-sting splashes tearing across the target, ink-green edged
    if (age < 0.3) {
      const u = age / 0.3, k = 1 - u;
      for (const [a0, len] of [[-0.5, 34], [0.62, 30], [2.3, 24]]) {
        const ca = Math.cos(a0), sa = Math.sin(a0);
        p.line(TX + ca * 6, -26 + sa * 6, TX + ca * len, -26 + sa * len * 0.8, u < 0.4 ? C[8] : C[5], k * fade);
        p.line(TX + ca * 8, -25 + sa * 8, TX + ca * len * 0.82, -25 + sa * len * 0.66, B[3], k * fade * 0.8);
      }
    }
  }

  // ================= corrosion =================
  function drawCorrosion(p, tt, C, B, fade) {
    const age = tt - T_HIT;
    if (age < 0.05) return;
    const k = smooth(0.05, 0.3, age) * (1 - smooth(2.55, 3.35, tt)) * fade;
    if (k <= 0.01) return;

    // the venom soaks into the charred body first: a dark crimson stain over the silhouette,
    // lit along its top edge so the figure still reads under the rot
    const soak = k * smooth(0.02, 0.5, age);
    if (soak > 0.02) {
      const drift = Math.sin(tt * 2.6) * 0.35;
      const grid = new Map();
      const at = (gx, gy) => {
        const key = gx * 1000 + gy;
        let v = grid.get(key);
        if (v === undefined) { v = coated(TX + BODY.x + gx + 0.5 + drift, BODY.y + gy + 0.5, tt); grid.set(key, v); }
        return v;
      };
      for (let i = 0; i < bodyCells.length; i++) {
        const [bx, by] = bodyCells[i];
        const gx = Math.round(bx - TX - BODY.x), gy = Math.round(by - BODY.y);
        if (!at(gx, gy)) continue;
        p.px(bx, by, !at(gx, gy - 1) ? (i % 3 ? C[3] : C[4]) : (i % 5 === 0 ? C[3] : C[2]), soak * 0.92);
      }
    }

    // a few fat lumps of venom bulking out the chest, head and hip
    for (const [cx2, cy2, rr, ph, st] of [
      [TX - 1, -24, 10.5, 1.2, 1.15], [TX + 3, -35, 7.5, 2.6, 0.95], [TX - 4, -13, 8, 4.1, 1.25], [TX - 8, -27, 6, 5.2, 0.9],
    ]) {
      splat(p, cx2, cy2, rr * (0.65 + 0.35 * smooth(0.05, 0.3, age)), ph + tt * 0.3, C, B, k, st);
      p.line(cx2 + 1, cy2 + rr * 0.6, cx2 + 1, cy2 + rr * 0.6 + 4 + (ph * 2) % 5, C[2], 0.8 * k);
      p.px(cx2 + 1, cy2 + rr * 0.6 + 4 + (ph * 2) % 5, C[6], k);
    }

    // glossy wet highlights riding the lumps
    for (const [cx2, cy2, rr, ph] of [[TX - 1, -24, 10.5, 1.2], [TX + 3, -35, 7.5, 2.6], [TX - 4, -13, 8, 4.1]]) {
      p.px(cx2 - rr * 0.3, cy2 - rr * 0.5, C[8], k);
      p.px(cx2 - rr * 0.3 + 1, cy2 - rr * 0.5, C[7], k);
      p.px(cx2 - rr * 0.15, cy2 - rr * 0.35, C[6], k);
    }
    // drips let go of the soaked body
    for (let i = 0; i < 7; i++) {
      const dx = [-10, -5, 1, 6, 10, -2, 4][i], top = -30 + i * 3;
      const len = 3 + ((i * 5) % 6) + Math.sin(tt * 2.4 + i) * 1.2;
      const a = k * (1 - smooth(T_HIT + 2.1, T_END - 0.2, tt));
      if (a <= 0.03) continue;
      p.line(TX + dx, top, TX + dx, top + len, C[2], 0.75 * a);
      p.px(TX + dx, top + len, C[6], a);
    }

    // sticky globs thrown onto the target, sliding down its body and hanging there
    for (const g of globs) {
      if (tt < g.t0) continue;
      const u = clamp((tt - g.t0) / 0.26);
      const x = TX + g.dx, y = -26 + g.dy + g.slide * ease.outCubic(u);
      const a = fade * (1 - smooth(T_HIT + 1.7, T_END - 0.2, tt));
      glob(p, x, y, g.s * (0.7 + 0.3 * u), g.ph, tt, C, B, a, g.stretch);
      p.glow(x, y, 9, C[4], 0.16 * a);
    }

    // long strands of goo hanging off the body, beading at their tips
    for (const s of strands) {
      if (tt < s.t0) continue;
      const u = clamp((tt - s.t0) / 0.35);
      const a = fade * (1 - smooth(T_HIT + 1.8, T_END - 0.2, tt));
      const x = TX + s.dx, y = -26 + s.dy;
      const len = s.len * ease.outCubic(u) + Math.sin(tt * 3 + s.ph) * 0.8;
      p.line(x, y, x, y + len, C[2], 0.85 * a);
      p.line(x + 1, y, x + 1, y + len * 0.8, B[2], 0.45 * a);
      p.px(x, y + len, C[6], a);
    }

    // crimson veins crawling over the soaked body, breathing with the rot
    for (const v of veins) {
      const kk = k * (0.55 + 0.45 * Math.sin(tt * 3.4 + v.ph));
      for (let i = 1; i < v.pts.length; i++) {
        p.line(TX + v.pts[i - 1][0], -26 + v.pts[i - 1][1], TX + v.pts[i][0], -26 + v.pts[i][1], C[3], 0.42 * kk);
        p.px(TX + v.pts[i][0], -26 + v.pts[i][1], C[5], kk * 0.9);
      }
    }

    // blisters swelling on the body, then bursting into a ring of black and green
    for (const bl of bodyBubbles) {
      const bAge = tt - bl.t0;
      if (bAge < 0 || bAge > bl.life) continue;
      const u = bAge / bl.life;
      const x = TX + bl.dx, y = bl.dy;
      if (u < 0.74) {
        const rr = bl.r * 0.55 + bl.r * 0.45 * ease.outCubic(u / 0.74);
        bubble(p, x, y, rr, C[6], C[0], B[1], k * 0.9, false);
        p.px(x - rr * 0.4, y - rr * 0.5, C[8], k);
      } else {
        const uk = (u - 0.74) / 0.26, rr = bl.r + 8 * ease.outCubic(uk);
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU + bl.ph;
          p.dot(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8, i % 2 ? B[4] : C[5], (1 - uk) * k);
        }
        p.dot(x, y - 2 - uk * 8, C[0], (1 - uk) * k);
      }
    }

    // blood-worms: they crawl over the rot and bite in pulses, each bite a crimson flash
    for (const w of worms) {
      if (tt < w.t0) continue;
      const wk = smooth(w.t0, w.t0 + 0.24, tt) * k;
      if (wk <= 0.02) continue;
      const wob = Math.sin(tt * 1.5 + w.ph) * 1.7;
      const x = TX + w.dx + wob, y = w.dy + Math.sin(tt * 2.1 + w.ph * 2) * 1.2;
      const head = worm(p, x, y, w.len, w.ang + Math.sin(tt * 1.3 + w.ph) * 0.4, tt, w.ph, C, B, wk);
      const cyc = (tt - w.t0) % w.bite;
      const biting = cyc < 0.15;
      if (biting) {
        const bk = 1 - cyc / 0.15;
        p.glow(head[0], head[1], 16, C[6], 0.7 * bk * wk);
        // mandibles snap shut on a flash of white, then a crimson wound ring blooms
        for (const s of [-1, 1]) p.line(head[0] + s * 3.5, head[1] - 2 - (1 - bk) * 3, head[0] + s * 1.2, head[1] + 2, WHITE, wk);
        p.px(head[0], head[1] + 1, WHITE);
        const rr = 4 + 5 * (1 - bk);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * TAU + 0.3;
          if (i % 3 === 2) continue;
          p.px(head[0] + Math.cos(a) * rr, head[1] + Math.sin(a) * rr * 0.85, i % 2 ? C[7] : C[5], bk * wk);
        }
        p.dot(head[0] - 1, head[1] + 2, C[8], bk * wk);
        p.px(head[0] + 3, head[1] - 4, C[7], bk * wk);
        p.px(head[0] - 4, head[1] - 1, C[6], bk * wk);
      }
    }

    p.glow(TX, -26, 30, B[3], 0.12 * k * (0.7 + 0.3 * Math.sin(tt * 6)));
    p.glow(TX, -26, 18, C[4], 0.12 * k);
  }

  // black rot smoke: every live puff is merged into one continuous, lumpy plume instead of a stack of
  // soap circles, then shaded as a single volume with a lit top rim and a hot venous underside
  function drawBlackSmoke(p, tt, C, B, fade) {
    const live = [];
    for (const bp of blackPuffs) {
      const age = tt - bp.t0;
      if (age < 0 || age > bp.life) continue;
      const u = age / bp.life;
      const r = lerp(bp.r0, bp.r1, ease.outCubic(u));
      const x = TX + bp.dx + bp.drift * age + Math.sin(tt * 2.2 + bp.ph) * 1.6;
      const y = bp.dy - bp.rise * age - 3 * u + Math.sin(tt * 1.6 + bp.ph) * 1.4;
      const a = (1 - smooth(0.55, 1, u)) * Math.min(1, u * 7) * fade;
      if (a <= 0.02) continue;
      live.push({ x, y, r, a, ph: bp.ph });
    }
    if (!live.length) return;

    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const b of live) {
      x0 = Math.min(x0, b.x - b.r - 2); x1 = Math.max(x1, b.x + b.r + 2);
      y0 = Math.min(y0, b.y - b.r - 2); y1 = Math.max(y1, b.y + b.r + 2);
    }
    x0 = Math.max(X_MIN + 2, x0); x1 = Math.min(X_MAX - 2, x1);
    y0 = Math.max(Y_MIN + 2, y0); y1 = Math.min(Y_MAX - 2, y1);
    if (x1 <= x0) return;

    // a dull crimson bloom under the plume so the black column has something to cut into
    for (const b of live) if (b.a > 0.4) p.glow(b.x, b.y + b.r * 0.3, b.r * 0.9, C[3], 0.05 * b.a);

    p.each(x0, y0, x1, y1, (px, py, sx, sy) => {
      let cov = 0, lit = 0;
      for (const b of live) {
        const dx = (px - b.x) / b.r, dy = (py - b.y) / b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1.1) continue;
        const d = Math.sqrt(d2);
        const ang = Math.atan2(dy, dx);
        const edge = 0.86 + 0.16 * Math.sin(ang * 5 + b.ph) + 0.08 * Math.cos(ang * 8 - b.ph * 0.7);
        if (d > edge) continue;
        const c = b.a * (1 - (d > edge - 0.5 ? (d - edge + 0.5) / 0.5 * 0.35 : 0));
        if (c > cov) { cov = c; lit = (-dx * 0.45 - dy * 0.9) / edge; }
      }
      if (cov < 0.05) return;
      const col = lit > 0.55 ? mix(hex("#6a5573"), C[2], 0.28)
        : lit > 0.1 ? hex("#463855")
        : lit > -0.35 ? hex("#2f2540")
        : lit > -0.72 ? hex("#241b30")
        : mix(hex("#171021"), C[1], 0.45);
      p.blendPx(sx, sy, col, Math.min(1, cov * 1.15));
    });
  }
}
