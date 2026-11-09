// Needle-spindle spider-web attack ("moves/web-snare"): winds pale grey-white spider silk into a sleek
// double-pointed needle projectile wrapped in helical silk strands, hurls it trailing long gossamer wakes,
// and on impact slams the target into a complete, taut grey-white spiderweb pinning them to the floor.
import { Particles, Lights, P, Rng, fit, flare, clamp, smooth, lerp, ease, TAU, WHITE, READY } from "../../core/index.js";
import { spikes, star, brokenRing, frontCrescent } from "../impacts/_lib.js";

const TX = 216;
const HX = 16, HY = -25;
const T_LAUNCH = 0.34;
const T_HIT = 0.72;
const T_HOLD_END = 1.98;
const T_END = 2.75;

export const meta = {
  name: "Web snare",
  desc: "Hurls a sharp double-pointed silk needle wrapped in spinning threads that explodes into a complete spiderweb pinning the struck target.",
  tags: ["move", "web", "silk", "spider", "snare", "binding", "needle", "projectile", "one-shot"],
  size: [416, 224],
  origin: [82, 174],
  duration: T_END,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#0b0e15", "#1b202c", "#303848", "#4f596c", "#768396", "#a0aebf", "#ccd6e2", "#ecf1f7", "#ffffff"],
    sheen: ["#1a2b3a", "#3d6a82", "#8ec4d8", "#e8f8ff"],
    seed: 19,
  },
};

const GUARD = { ...READY, x: 0, crouch: 3, lean: 2, fx: 11, fy: -21, bx: 9, by: -21, ffx: 8, fbx: -8 };
const WIND = { ...READY, x: -5, crouch: 6, lean: -5, turn: 0.75, fx: -4, fy: -25, bx: 12, by: -25, armsFront: true, ffx: 7, fbx: -9 };
const HURL = { ...READY, x: 10, crouch: 4, lean: 7, turn: 0.45, fx: 21, fy: -25, bx: -4, by: -23, ffx: 13, fbx: -9, toeB: true, ghost: 1 };
const FOLLOW = { ...HURL, x: 10, crouch: 5, lean: 5, fx: 20, fy: -23, bx: -2, by: -22, ghost: 0 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.28, GUARD],
    [0.0, WIND],
    [T_LAUNCH - 0.05, { ...WIND, crouch: 7, lean: -6, fx: -6, fy: -24 }],
    [T_LAUNCH, HURL, "snap"],
    [T_LAUNCH + 0.16, FOLLOW],
    [1.15, { ...GUARD, x: 4, crouch: 4 }],
    [1.75, GUARD],
    [T_END, GUARD],
  ],
  hits: [
    { t: T_LAUNCH, stop: 0.03, shake: 0.12, amp: 1.8, target: false },
    { t: T_HIT, stop: 0.17, shake: 0.50, amp: 5.0, push: 5.2, straw: 42, flash: 0.09, y: -27, shiver: 2.1 },
  ],
  dust: [
    { t: T_LAUNCH, x: 12, n: 8, dir: 1 },
    { t: T_LAUNCH, x: -8, n: 5, dir: -1 },
    { t: T_HIT, x: TX + 6, n: 9, dir: 1 },
    { t: T_HIT, x: TX - 8, n: 6, dir: -1 },
  ],
};

const X_MIN = -76, X_MAX = 326, Y_MIN = -168;

function filament(p, len, fn, c, a = 1) {
  const n = Math.max(2, Math.ceil(len / 2));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(fn(i / n));
  p.polyline(pts, c, a);
}

// Double-pointed silk spindle/needle: plump curved middle tapering sharply to needle tips at both ends
function drawSilkNeedle(p, cx, cy, rx, ry, spin, C, t, alpha = 1) {
  if (rx < 2 || ry < 1 || alpha <= 0.02) return;
  const x0 = Math.max(X_MIN, Math.floor(cx - rx - 3)), x1 = Math.min(X_MAX, Math.ceil(cx + rx + 3));
  const y0 = Math.max(Y_MIN, Math.floor(cy - ry - 3)), y1 = Math.min(40, Math.ceil(cy + ry + 3));
  p.shade(x0, y0, x1, y1, (x, y, out) => {
    const dx = x - cx, dy = y - cy;
    const ax = Math.abs(dx) / rx;
    if (ax >= 1) return;
    // Bulging center tapering into sharp stiletto needle points at both ends
    const profile = ry * Math.pow(Math.cos(ax * Math.PI * 0.5), 1.32);
    const ay = Math.abs(dy) / Math.max(0.45, profile);
    if (ay > 1) return;

    // Helical wound silk threads twisting rapidly around the needle spindle
    const twistA = Math.sin(dx * 0.62 - dy * 1.05 + spin);
    const twistB = Math.sin(dx * 0.54 + dy * 1.15 - spin * 0.72);
    const strand = Math.max(twistA, twistB * 0.85);
    const crease = Math.min(twistA, twistB);
    const topLit = -dy / Math.max(1, profile);
    const tipBoost = ax > 0.7 ? (ax - 0.7) * 3.0 : 0;

    if (ay > 0.84 && ax < 0.82) {
      out.c = topLit > 0.25 ? C[6] : C[1];
      out.a = alpha;
      return;
    }
    let ci;
    if (tipBoost > 0.32 || (ay < 0.22 && strand > 0.14)) ci = 8; // gleaming white core spine & sharp tips
    else if (crease < -0.58 && ay > 0.22) ci = 2;               // dark slate thread groove
    else if (strand > 0.42) ci = topLit > -0.2 ? 8 : 7;          // bright silver-white spun thread highlight
    else if (strand > -0.05) ci = topLit > -0.3 ? 6 : 5;         // pale ash-grey silk thread
    else if (strand > -0.45) ci = 4;                             // cool slate silk midtone
    else ci = 3;
    out.c = C[ci];
    out.a = alpha;
  });

  // 3 live helical silk strands coiling tightly around the spinning spindle body
  for (let s = 0; s < 3; s++) {
    const ph = spin * (s % 2 ? 1.1 : -0.95) + s * 2.09;
    filament(p, rx * 2, (u) => {
      const px = cx + lerp(-rx * 0.96, rx * 0.94, u);
      const env = Math.pow(Math.cos((u * 2 - 1) * Math.PI * 0.5), 1.2) * (ry + 1.5);
      const py = cy + Math.sin(u * 10 + ph) * env;
      return [px, py];
    }, s === 0 ? C[8] : C[6], (u) => alpha * (0.45 + 0.55 * Math.sin(u * Math.PI)));
  }
}

export function create(o) {
  const C = fit(o.palette, 9), Sh = fit(o.sheen, 4), R = new Rng(o.seed);
  const floor = () => 0;
  const ps = new Particles({ rng: R, ground: floor, sparks: [WHITE, C[7], C[5], C[3]], haze: C[5] });
  const lights = new Lights();

  const hitSpikes = spikes(R, 14, 0, { len: [16, 30], w: [1.6, 2.6], fwd: 1.55, back: 0.72, jag: 0.65 });
  const ringSegs = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * TAU + R.range(-0.14, 0.14), gap: R.range(0.32, 0.52), dr: R.range(0.22, 0.44) }));

  // Complete 12-spoke intact cobweb centered on target torso (TX, -27)
  const N_RAYS = 12;
  const webRays = Array.from({ length: N_RAYS }, (_, i) => {
    // Symmetrical web frame with slight organic hand-drawn jitter, zero missing spokes!
    const a = (i / N_RAYS) * TAU - Math.PI / 2 + R.range(-0.045, 0.045);
    return {
      a,
      len: 37 + (i % 2 === 0 ? 4 : -1) + R.range(-1.5, 1.5),
      sag: R.range(0.35, 0.95),
    };
  });
  const snaps = [];

  let t = 0, launchDone = false, hitDone = false;
  const needlePos = (tt) => {
    const u = clamp((tt - T_LAUNCH) / (T_HIT - T_LAUNCH));
    return [lerp(HX + 14, TX - 6, ease.outQuad(u)), lerp(HY, -27, u) - Math.sin(Math.PI * u) * 3.5];
  };

  return {
    update(dt) {
      t += dt;
      lights.update(dt);
      const f = Math.min(1, dt * 120);

      if (t < T_LAUNCH && R.chance(0.5 * f)) {
        const a = R.range(0, TAU), r = R.range(13, 24);
        ps.spawn(P.STREAK, HX + Math.cos(a) * r, HY + Math.sin(a) * r, -Math.cos(a) * 145, -Math.sin(a) * 145, 0.16, C[7], 1);
      }
      if (!launchDone && t >= T_LAUNCH) {
        launchDone = true;
        lights.add(HX + 10, HY, 24, C[6], 0.45, 0.22);
        for (let i = 0; i < 14; i++) {
          const a = R.range(-0.65, 0.65), sp = R.range(85, 225);
          ps.spawn(P.SPARK, HX + 8, HY, Math.cos(a) * sp, Math.sin(a) * sp, R.range(0.14, 0.26));
        }
      }
      if (t >= T_LAUNCH && t < T_HIT && R.chance(0.85 * f)) {
        const [bx, by] = needlePos(t);
        ps.spawn(P.MOTE, bx - 14 + R.range(-4, 4), by + R.range(-5, 5), -R.range(60, 140), R.range(-18, 18), R.range(0.16, 0.34), R.pick([C[7], C[6], C[5]]), 0.72);
      }
      if (!hitDone && t >= T_HIT) {
        hitDone = true;
        lights.add(TX, -27, 60, Sh[2], 0.72, 0.40);
        lights.add(TX, -27, 26, WHITE, 0.76, 0.12);
        // Explosive spray of silk-strand sparks and broken thread fragments when the needle snaps open into the web
        for (let i = 0; i < 34; i++) {
          const a = R.range(0, TAU), sp = R.range(80, 265);
          snaps.push({
            x: TX + R.range(-6, 6), y: -27 + R.range(-8, 8),
            vx: Math.cos(a) * sp + 22, vy: Math.sin(a) * sp - 34,
            ang: R.range(0, TAU), va: R.range(-22, 22),
            len: R.range(3.2, 6.8), bend: R.range(-1.6, 1.6),
            col: R.pick([WHITE, C[7], C[6], C[5]]),
            age: 0, life: Math.min(R.range(0.45, 0.95), T_END - t - 0.14),
          });
        }
        for (let i = 0; i < 24; i++) {
          const a = R.range(0, TAU), sp = R.range(95, 250);
          ps.spawn(P.SPARK, TX, -27, Math.cos(a) * sp, Math.sin(a) * sp - 20, R.range(0.15, 0.34));
        }
        for (let i = 0; i < 10; i++) {
          ps.spawn(P.VAPOUR, TX + R.range(-14, 14), -27 + R.range(-16, 12), R.range(-36, 62), -R.range(8, 30), R.range(0.42, 0.84), C[6], R.range(5, 10));
        }
      }
      for (let i = snaps.length - 1; i >= 0; i--) {
        const s = snaps[i];
        s.age += dt;
        if (s.age >= s.life) { snaps.splice(i, 1); continue; }
        s.vx *= 1 - 2.8 * dt;
        s.vy += 240 * dt;
        s.x = clamp(s.x + s.vx * dt, X_MIN + 2, X_MAX - 2);
        s.y = Math.max(Y_MIN + 2, s.y + s.vy * dt);
        s.ang += s.va * dt;
        if (s.y > 0) { s.y = 0; s.vy *= -0.2; s.vx *= 0.45; s.va *= 0.3; }
      }
      ps.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;
      if (t >= T_HIT && t < T_END - 0.06) {
        const age = t - T_HIT;
        const spread = ease.outBack(clamp(age / 0.10), 1.35);
        const fade = 1 - smooth(T_HOLD_END, T_END - 0.06, t);
        const cx = TX, cy = -27;
        const tug = age > 0.22 && t < T_HOLD_END ? Math.sin(t * 34) * 0.55 : 0;

        // Heavy oppressive diagonal anchor cables pinning the bound target down into the stone floor
        for (const [dx0, dy0, dx1, dy1] of [[-8, -32, -36, 0], [8, -32, 36, 0], [-10, -18, -28, 0], [10, -18, 28, 0]]) {
          p.line(cx + dx0 + tug, dy0 + 1, cx + lerp(dx0, dx1, spread), lerp(dy0, dy1, spread) + 1, C[1], fade * 0.85);
          p.line(cx + dx0 + tug, dy0, cx + lerp(dx0, dx1, spread), lerp(dy0, dy1, spread), C[6], fade * 0.94);
        }

        // Complete 12 radial spokes of the intact cobweb (grounded cleanly at y = 0)
        const rayLen = (ray, r) => (Math.sin(ray.a) > 0.14 ? Math.min(r, 26.5 / Math.sin(ray.a)) : r);
        for (let i = 0; i < N_RAYS; i++) {
          const ray = webRays[i];
          const L = rayLen(ray, ray.len) * spread;
          // 1px dark contrast backing under radial web frame
          p.line(cx, cy + 1, cx + Math.cos(ray.a) * L, cy + Math.sin(ray.a) * L + 1, C[1], fade * 0.58);
          filament(p, L, (u) => {
            const bend = Math.sin(u * Math.PI) * ray.sag * spread;
            return [cx + Math.cos(ray.a) * L * u - Math.sin(ray.a) * bend * 0.35, cy + Math.sin(ray.a) * L * u + bend];
          }, age < 0.07 ? WHITE : C[6], fade * 0.94);
        }

        // 5 COMPLETE concentric silk web tiers connecting every adjacent spoke cleanly 360 degrees
        const radii = [7, 13.5, 20.5, 28, 36];
        for (let tier = 0; tier < radii.length; tier++) {
          const tierFade = fade * (1 - smooth(T_HOLD_END + (4 - tier) * 0.08, T_END - 0.1 - tier * 0.04, t));
          if (tierFade <= 0.03) continue;
          const rad = radii[tier] * spread;
          for (let i = 0; i < N_RAYS; i++) {
            const r0 = webRays[i], r1 = webRays[(i + 1) % N_RAYS];
            const L0 = rayLen(r0, rad), L1 = rayLen(r1, rad);
            const x0 = cx + Math.cos(r0.a) * L0, y0 = cy + Math.sin(r0.a) * L0;
            const x1 = cx + Math.cos(r1.a) * L1, y1 = cy + Math.sin(r1.a) * L1;
            const dx = (x0 + x1) * 0.5 - cx, dy = (y0 + y1) * 0.5 - cy;
            const dist = Math.max(1, Math.hypot(dx, dy));
            const pull = (1.15 + tier * 0.38) * spread;
            // Taut spiderweb catenary bowing slightly inward toward center
            const mx = (x0 + x1) * 0.5 - (dx / dist) * pull;
            const my = (y0 + y1) * 0.5 - (dy / dist) * pull + 0.55;
            p.line(x0, y0 + 1, x1, y1 + 1, C[1], tierFade * 0.38);
            filament(p, Math.hypot(x1 - x0, y1 - y0), (u) => {
              const s = 1 - u;
              return [s * s * x0 + 2 * s * u * mx + u * u * x1, s * s * y0 + 2 * s * u * my + u * u * y1];
            }, age < 0.07 ? WHITE : C[5 + (tier & 1)], tierFade * 0.92);
          }
        }
      }
      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;

      // 1. Wind-up silk orb morphing into primed needle spindle at caster hand (t < T_LAUNCH)
      if (t < T_LAUNCH) {
        const k = smooth(0, T_LAUNCH * 0.65, t);
        const needleStretch = smooth(T_LAUNCH * 0.55, T_LAUNCH, t);
        const rx = lerp(4 + k * 4.5, 16.5, needleStretch);
        const ry = lerp(4 + k * 4.5, 7.2, needleStretch);
        drawSilkNeedle(p, HX + needleStretch * 4, HY, rx, ry, -t * 24, C, t, 1);
        p.glow(HX + needleStretch * 4, HY, 12, Sh[2], 0.22 * k);
      }

      // 2. High-speed double-pointed silk needle flight + slender trailing spider-silk wake (T_LAUNCH..T_HIT)
      if (t >= T_LAUNCH && t <= T_HIT + 0.08) {
        const [bx, by] = needlePos(Math.min(t, T_HIT));
        const u = clamp((t - T_LAUNCH) / (T_HIT - T_LAUNCH));
        const wakeFade = t < T_HIT ? 1 : 1 - smooth(T_HIT, T_HIT + 0.08, t);
        const tailTip = bx - 19;
        const tailLen = Math.min(tailTip - (HX + 2), 132 * ease.outCubic(u * 1.15));

        // 5 long slender trailing spider-silk ribbons streaming back from the rear point & body shoulders
        for (let r = 0; r < 5; r++) {
          const yOff = (r - 2) * 2.5;
          const amp = 1.0 + (r % 2) * 1.3;
          const xStart = tailTip - tailLen * (0.68 + (r % 3) * 0.16);
          filament(p, Math.max(2, tailTip - xStart), (s) => {
            const px = lerp(xStart, bx - 14, s);
            const py = lerp(HY + yOff * 0.45, by + yOff * (1 - s * 0.6), s) + Math.sin(s * 16 - t * 32 + r * 1.8) * amp * (1 - s * 0.55);
            return [px, py];
          }, r === 2 ? C[8] : C[5 + (r & 1)], (u0) => u0 * wakeFade * (r === 2 ? 0.96 : 0.76));
        }
        // Sharp needle-shaped speed afterimage echoes behind the spinning shaft
        for (let g = 1; g <= 3; g++) {
          const gt = Math.max(T_LAUNCH, t - g * 0.032);
          if (gt <= T_LAUNCH) continue;
          const [gx, gy] = needlePos(gt);
          const ga = (1 - g / 3.8) * 0.34 * wakeFade;
          const grx = 19 - g * 2.2, gry = 5.8 - g * 0.9;
          p.line(gx - grx, gy, gx + grx, gy, C[7], ga * 1.35);
          p.line(gx - grx * 0.55, gy - gry * 0.55, gx + grx * 0.55, gy - gry * 0.55, C[5], ga);
          p.line(gx - grx * 0.55, gy + gry * 0.55, gx + grx * 0.55, gy + gry * 0.55, C[5], ga);
        }
        // Aerodynamic V-cone silk launch wake instead of a round ring
        if (t - T_LAUNCH < 0.12) {
          const lu = (t - T_LAUNCH) / 0.12;
          const lx = HX + 6 + lu * 12;
          p.line(lx + 8, HY, lx - 6, HY - 7 - lu * 4, C[7], (1 - lu) * 0.9);
          p.line(lx + 8, HY, lx - 6, HY + 7 + lu * 4, C[7], (1 - lu) * 0.9);
        }

        if (t < T_HIT) {
          drawSilkNeedle(p, bx, by, 21.0, 7.6, t * 40, C, t, 1);
          p.glow(bx, by, 15, Sh[2], 0.22);
        }
      }

      // 3. Impact detonation + Complete Cobweb Front Cocoon Straps & Hub Locking Target Inside Web
      if (t >= T_HIT) {
        const age = t - T_HIT;
        const burst = age < 0.25 ? Math.sin(Math.PI * clamp(age / 0.25)) : 0;
        if (burst > 0.04) {
          const u = clamp(age / 0.25);
          star(p, TX, -27, hitSpikes, 0.74 + 0.76 * ease.outCubic(u), 1 - u * 0.42, [C[1], C[5], C[7], WHITE], burst, 3.6);
          brokenRing(p, TX, -27, 12 + 44 * ease.outCubic(u), 2.8, ringSegs, u, C[8], C[3], 1 - u, 0.82, 1);
          flare(p, TX, -27, 28 * burst, burst, C);
          p.line(TX - 28, -49, TX + 32, -5, WHITE, burst * 0.92);
          p.line(TX - 28, -5, TX + 32, -49, C[7], burst * 0.92);
          frontCrescent(p, TX + 18 + 20 * u, 1, 18 * burst, 10 * burst, [C[7], C[5], C[2]], burst * 0.85);
        }

        if (t < T_END - 0.06) {
          const spread = ease.outBack(clamp(age / 0.10), 1.35);
          const fade = 1 - smooth(T_HOLD_END, T_END - 0.06, t);
          const tug = age > 0.22 && t < T_HOLD_END ? Math.sin(t * 34) * 0.55 : 0;

          // Front cocoon straps & radial silk cross-threads locking directly over the struck target
          const straps = [
            [-13, -38, 14, -22], [-13, -22, 13, -37],
            [-11, -30, 12, -14], [-11, -15, 11, -29],
            [-9, -45, 10, -37],
          ];
          for (let i = 0; i < straps.length; i++) {
            const [x0, y0, x1, y1] = straps[i];
            p.line(TX + x0 * spread + tug, y0 + 1, TX + x1 * spread - tug, y1 + 1, C[1], fade * 0.88);
            filament(p, 26, (u) => [TX + lerp(x0, x1, u) * spread + tug * (1 - 2 * u), lerp(y0, y1, u)], age < 0.08 ? WHITE : C[7], fade);
          }

          // Front concentric binding rings & hub knot binding the target right into the complete cobweb center
          for (const rad of [7, 13.5, 20.5]) {
            p.arc(TX + tug * 0.4, -27, rad * spread, 1.15, -Math.PI * 0.72, Math.PI * 0.72, age < 0.08 ? WHITE : C[7], fade * 0.92);
          }
          p.circle(TX + tug * 0.4, -27, 4.2 * spread, C[1], fade * 0.65);
          p.circle(TX + tug * 0.4, -27, 3.2 * spread, age < 0.1 ? WHITE : C[7], fade * 0.92);

          if (age < 0.8) p.glow(TX, -27, 28, Sh[2], 0.22 * (1 - age / 0.8));
        }
      }

      // 4. Flying silk-strand debris sparks
      for (const s of snaps) {
        const k = (1 - smooth(0.55, 1, s.age / s.life)) * (1 - smooth(T_END - 0.14, T_END - 0.04, t));
        if (k <= 0.02) continue;
        const ca = Math.cos(s.ang), sa = Math.sin(s.ang), nx = -sa, ny = ca;
        const x0 = s.x - ca * s.len * 0.5, y0 = s.y - sa * s.len * 0.5;
        const x1 = s.x + ca * s.len * 0.5, y1 = s.y + sa * s.len * 0.5;
        const mx = s.x + nx * s.bend, my = s.y + ny * s.bend;
        p.line(x0, y0, mx, my, s.col, k);
        p.line(mx, my, x1, y1, s.col, k);
      }

      ps.draw(p);
      lights.draw(p);
    },
  };
}
