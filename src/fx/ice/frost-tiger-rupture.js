import { Particles, Lights, P, Rng, fit, band, flare, clamp, smooth, ease, TAU, READY } from "../../core/index.js";

export const meta = {
  name: "霜牙·白虎破",
  desc: "An overhead frost cleave slams into a flat shock ring and asymmetric tiger-stripe fissures; translucent hoarfrost breathes and thaws. No creature imagery.",
  tags: ["ice", "frost", "cleave", "sword", "tiger", "rupture", "ground", "ultimate", "one-shot"],
  size: [320, 176], origin: [160, 112], duration: 4.5, loop: false, fps: 30, bg: "ground", actor: 2,
  options: {
    palette: ["#08181c", "#0d2e34", "#12474f", "#196a74", "#21909c", "#37b8c4", "#79dde6", "#c4f4f8"],
    frost: ["#1a2228", "#2e3d46", "#4d616e", "#728c9a", "#9fb4c0", "#c8d8e2", "#eaf4f8", "#ffffff"],
    gold: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424"], seed: 17,
  },
};
const SWING = 0.74, HIT = 0.9, END = 4.5, REACH = 116, PLANE = 0.16;
const GUARD = { ...READY, weapon: "greatsword", two: true, fx: 5, fy: -23, bx: 1, by: -20, sa: -1.4 };
const COCK = { ...GUARD, crouch: 3, lean: -3, turn: 1, fx: -6, fy: -38, bx: 3, by: -34, sa: -2.1 };
const CUT = { ...GUARD, crouch: 8, lean: 2, fx: 1, fy: -9, bx: -3, by: -12, sa: 1.62, armsFront: true };
export const act = {
  poses: [[0, GUARD], [0.45, COCK], [SWING, { ...COCK, crouch: 5 }],
    [0.82, { ...GUARD, crouch: 3, lean: 1, fx: 8, fy: -30, bx: 3, by: -27, sa: -0.8 }, "snap"],
    [0.867, { ...GUARD, crouch: 5, lean: 3, fx: 10, fy: -19, bx: 5, by: -20, sa: 0.45 }, "snap"], [HIT, CUT, "snap"], [1.3, CUT], [2.4, GUARD, "line"], [END, READY]],
  hits: [{ t: HIT, stop: 0.13, shake: 0.24, amp: 3, target: false }],
};

// A strip is generated in world-plane coordinates, then projected down onto the floor.
// Short alternating kinks and a broad-to-needle taper suggest stripes, never a tiger silhouette.
function makeStrip(R, x, z, angle, length, width, start, branch = false) {
  const bend = R.range(-0.18, 0.18) * length;
  const pts = [[x, z]], count = Math.ceil(length / R.range(8, 12));
  for (let j = 1; j <= count; j++) {
    const u = j / count, kink = Math.sin(u * Math.PI) * bend + (j % 2 ? 1 : -1) * R.range(1.4, branch ? 3 : 5);
    pts.push([x + Math.cos(angle) * length * u - Math.sin(angle) * kink,
      z + Math.sin(angle) * length * u + Math.cos(angle) * kink]);
  }
  return { pts, length, width, start, branch };
}
function layout(R) {
  const strips = [];
  for (let i = 0; i < 8; i++) {
    const angle = i * TAU / 8 + R.range(-0.24, 0.24), len = R.range(65, 112);
    const trunk = makeStrip(R, Math.cos(angle) * 8, Math.sin(angle) * 8, angle, len, R.range(3, 6), 1.12 + R.range(0, 0.17));
    strips.push(trunk);
    const forks = R.int(1, 2);
    for (let j = 0; j < forks; j++) {
      const idx = Math.floor((0.3 + j * 0.24 + R.range(0, 0.12)) * (trunk.pts.length - 1));
      const [x, z] = trunk.pts[idx], a = angle + (j % 2 ? -1 : 1) * R.range(0.48, 1.05);
      strips.push(makeStrip(R, x, z, a, len * R.range(0.3, 0.6), trunk.width * 0.58, trunk.start + 0.14 + idx * 0.015, true));
    }
  }
  return strips;
}

export function create(o) {
  // Deliberately separate ramps: colored energy / neutral hoarfrost / tiny armor glints.
  const C = fit(o.palette, 8), F = fit(o.frost, 8), G = fit(o.gold, 5), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, haze: C[5] }), lights = new Lights();
  const cracks = layout(R), shards = [], teeth = [], patches = [];
  for (let i = 0; i < 29; i++) teeth.push({ a: R.range(0, TAU), h: R.range(1.5, 5.5), w: R.range(1, 3) });
  for (const c of cracks) for (let i = 1; i < c.pts.length; i += 2) {
    const [x, z] = c.pts[i];
    patches.push({ x, y: z * PLANE, r: R.range(5, 10), start: c.start + i * 0.025 });
  }
  // A broken, translucent ground skin joins the crack-local frost without a flat opaque fill.
  for (let i = 0; i < 32; i++) {
    const a = R.range(0, TAU), r = Math.sqrt(R.next()) * REACH * 0.88;
    patches.unshift({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.16,
      r: R.range(8, 14), start: 1.2 + r / REACH * 0.4 });
  }
  let t = 0, released = false, gather = 0, mist = 0, snow = 0;
  const fade = () => 1 - smooth(2.8, END - 0.03, t);
  const breath = () => {
    const q = clamp((t - 2.8) / 1.7);
    return t < 2.8 ? 1 : 0.64 + 0.36 * (1 - q) * Math.cos(q * TAU * 2.5);
  };
  const radius = () => 5 + (REACH - 5) * ease.outCubic(clamp((t - HIT) / 0.84));
  const ring = (p, back) => {
    if (t < HIT || t >= 1.9) return;
    const u = clamp((t - HIT) / 1), r = radius(), k = 1 - smooth(1.48, 1.9, t);
    band(p, 0, 0, r, 0.16, Math.max(1, 5 * (1 - u)), k, C,
      back ? (g) => Math.sin(g) < 0 : (g) => Math.sin(g) >= 0, t < HIT + 0.06);
    for (const q of teeth) {
      if ((Math.sin(q.a) < 0) !== back) continue;
      const x = Math.cos(q.a) * r, y = Math.sin(q.a) * r * 0.16;
      const h = q.h * Math.sin(Math.PI * u), w = q.w;
      p.polyline([[x - w, y], [x + w * 0.4, y - h], [x + w, y]], F[5], k);
      p.line(x + w * 0.4, y - h, x, y - 1, F[7], k);
    }
  };
  // Original overhead-to-floor sweep: a blade-tip Bezier, not a creature silhouette.
  // Its final point is exactly the rupture anchor. The raised-back section belongs behind the body.
  const edge = (u) => {
    const v = 1 - u;
    const x = -25 * v ** 3 + 3 * 36 * v * v * u + 3 * 57 * v * u * u;
    const y = -65 * v ** 3 - 3 * 84 * v * v * u - 3 * 23 * v * u * u - u ** 3;
    const dx = 3 * 61 * v * v + 6 * 21 * v * u - 3 * 57 * u * u;
    const dy = -3 * 19 * v * v + 6 * 61 * v * u + 3 * 22 * u * u;
    const len = Math.hypot(dx, dy);
    return { x, y, nx: -dy / len, ny: dx / len };
  };
  const cleave = (p, back) => {
    // A restrained blade charge first, then a broad, fast downward smear.
    if (back && t >= 0.52 && t < SWING) {
      const k = smooth(0.52, 0.69, t);
      p.polyline([[-8, -40], [-25, -65]], C[6], k);
      p.glowLine(-8, -40, -25, -65, 7, C[5], k * 0.22);
    }
    if (t < SWING || t >= HIT + 0.12) return;
    const head = ease.inQuad(clamp((t - SWING) / (HIT - SWING)));
    const tail = Math.max(0, head - 0.65) + smooth(HIT, HIT + 0.12, t) * 0.65;
    const alpha = 1 - smooth(HIT + 0.02, HIT + 0.12, t);
    if (tail >= head) return;
    const ink = Object.create(p);
    ink.put = (x, y, c, a = 1) => p.blendPx(x, y, c, a);
    const width = (u) => 14 * smooth(0, 0.22, head) * Math.sin(Math.PI * clamp((u - tail) / (head - tail))) ** 0.65;
    for (let i = 0; i < 48; i++) {
      const u0 = tail + (head - tail) * i / 48, u1 = tail + (head - tail) * (i + 1) / 48;
      if ((u0 < 0.19) !== back) continue;
      const a = edge(u0), b = edge(u1), wa = width(u0), wb = width(u1);
      const at = (q, w, lane) => [q.x + q.nx * w * lane, q.y + q.ny * w * lane];
      // Separate colored energy lanes and a neutral-white cutting edge, never a merged ramp.
      for (const [lo, hi, col] of [[0, 0.35, C[6]], [0.35, 0.7, C[4]], [0.7, 1, C[2]]])
        ink.poly([at(a, wa, lo), at(b, wb, lo), at(b, wb, hi), at(a, wa, hi)], col, alpha);
      ink.polyline([[a.x, a.y], [b.x, b.y]], F[6], alpha);
      if (i > 32) ink.polyline([[a.x + a.nx, a.y + a.ny], [b.x + b.nx, b.y + b.ny]], F[7], alpha);
      if (i % 13 === 8 && wa > 4) {
        // A few swept-back ice teeth, not an even comb along the whole blade.
        ink.polyline([[a.x, a.y], [a.x - a.nx * 2 - a.ny * 3, a.y - a.ny * 2 + a.nx * 3]], F[5], alpha * 0.8);
      }
      if (i % 9 === 0) p.glow(a.x, a.y, 9, C[5], 0.18 * alpha);
    }
    if (!back && t < HIT) {
      const tip = edge(head);
      p.glow(tip.x, tip.y, 12, C[6], 0.28);
    }
  };
  const floor = (p) => {
    if (t < 1.1 || t >= END) return;
    // Keep the taper readable during the long thaw: real alpha, not line dithering.
    const ink = Object.create(p);
    ink.put = (x, y, c, a) => p.blendPx(x, y, c, a);
    // Project the disc's sampling box as well as its pixels; don't scan a whole
    // 28 px circle just to keep its 6 px-thin floor ellipse. blendPx stays untouched.
    const skin = Object.create(p), squash = 0.23;
    skin.each = (x0, y0, x1, y1, fn) => p.each(x0, y0 * squash, x1, y1 * squash,
      (x, y, sx, sy) => fn(x, y / squash, sx, sy));
    const k = fade() * breath(), hot = 1 - smooth(1.9, 2.9, t);
    for (const s of patches) {
      const grow = smooth(s.start, s.start + 0.4, t);
      if (!grow) continue;
      skin.disc(s.x, s.y / squash, s.r, F[5], (d) =>
        (d < 0.72 ? 0.22 : 0.11) * grow * k);
    }
    for (const c of cracks) {
      const grow = clamp((t - c.start) / 0.48), last = grow * (c.pts.length - 1);
      for (let j = 0; j < last; j++) {
        const u = j / (c.pts.length - 1), [x0, z0] = c.pts[j], [x1, z1] = c.pts[j + 1];
        const f = Math.min(1, last - j), x = x0 + (x1 - x0) * f, y = (z0 + (z1 - z0) * f) * PLANE;
        const pts = [[x0, z0 * PLANE], [x, y]], width = Math.max(0, Math.round(c.width * (1 - u)));
        for (let w = -width; w <= width; w++)
          ink.polyline(pts.map(([xx, yy]) => [xx, yy + w * 0.55]), w < 0 ? F[3] : C[1], k);
        ink.polyline(pts, hot > 0.65 ? C[7] : hot > 0.2 ? C[5] : F[4], k);
        if (j % 3 === 0 && hot > 0) p.glow(x0, z0 * PLANE, 7, C[5], 0.18 * hot * k);
      }
    }
  };
  return {
    update(dt) {
      t += dt;
      // 120 Hz accumulation can land one ulp before 0.9: don't miss the sword's exact contact frame.
      if (Math.abs(t - HIT) < 1e-9) t = HIT;
      if (Math.abs(t - END) < 1e-9) t = END;
      if (t < HIT - 0.1) {
        for (gather += dt * 18; gather >= 1; gather--) {
          const a = R.range(Math.PI, TAU), r = R.range(18, 48);
          ps.spawn(P.MOTE, Math.cos(a) * r, Math.sin(a) * r * 0.2 - 2,
            -Math.cos(a) * r * 2.8, -Math.sin(a) * r * 0.45, 0.3, C[6], 0.7);
        }
      }
      if (t >= HIT && !released) {
        released = true;
        lights.add(0, -2, 68, C[6], 0.85, 0.2);
        lights.add(0, -2, 36, F[7], 1, 0.1);
        for (let i = 0; i < 38; i++) {
          const a = R.range(-Math.PI, 0), speed = R.range(40, 155);
          shards.push({ x: R.range(-3, 3), y: -2, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 20,
            a: R.range(0, TAU), spin: R.range(-13, 13), s: R.range(1, 3), life: R.range(0.5, 0.95) });
        }
      }
      if (t > 1.1 && t < 1.75) for (mist += dt * 23; mist >= 1; mist--) {
        const a = R.range(0, TAU), r = radius();
        ps.spawn(P.VAPOUR, Math.cos(a) * r, Math.sin(a) * r * 0.16 - 2,
          Math.cos(a) * 20, -R.range(3, 10), R.range(0.45, 0.8), F[5], R.range(2, 4));
      }
      if (t > 1.9 && t < 2.65) for (snow += dt * 14; snow >= 1; snow--) {
        const c = R.pick(cracks), [x, z] = R.pick(c.pts);
        ps.spawn(P.MOTE, x, z * PLANE - 1, R.range(-3, 3), -R.range(9, 20), R.range(0.3, 0.65), F[5], 0.6);
      }
      for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i];
        s.life -= dt; s.vy += 340 * dt; s.vx *= Math.exp(-1.4 * dt);
        s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.spin * dt;
        if (s.life <= 0 || s.y >= 0) shards.splice(i, 1); // ice extinguishes on landing, never bounces below the floor
      }
      ps.update(dt); lights.update(dt);
    },
    drawBack(p) {
      if (t >= END) return;
      cleave(p, true); floor(p); ring(p, true); ps.draw(p, "back");
    },
    draw(p) {
      if (t >= END) return;
      if (t < HIT) {
        const u = t / HIT;
        for (let i = 0; i < 2; i++) {
          const q = (u + i * 0.48) % 1, r = 8 + 43 * (1 - q);
          band(p, 0, 0, r, 0.16, 1, Math.sin(q * Math.PI) * 0.8, C, (g) => Math.sin(g) >= 0);
        }
        p.glow(0, -1, 16 + u * 12, C[6], u * u * 0.38);
      }
      cleave(p, false);
      ring(p, false);
      for (const s of shards) {
        const dx = Math.cos(s.a) * s.s, dy = Math.sin(s.a) * s.s;
        p.polyline([[s.x - dx, s.y - dy], [s.x + dx, s.y + dy]], F[6]);
        p.px(s.x - dx, s.y - dy, C[5]); p.light(s.x, s.y, C[5], 0.25);
      }
      if (t >= HIT && t < HIT + 0.06) {
        const u = (t - HIT) / 0.06;
        p.ellipse(0, -1, 13 * (1 - u * 0.4), 4, F[7]);
        flare(p, 0, -2, 31 * (1 - u * 0.4), 1, F);
        p.px(-3, -4, G[4]); p.px(4, -2, G[3]);
      }
      ps.draw(p, "front"); lights.draw(p);
    },
  };
}
