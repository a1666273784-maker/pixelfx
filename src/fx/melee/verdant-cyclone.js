// The 碧绿 cyclone spun out of the lacquer fan — a travelling funnel in the nature-tornado mould:
// a sheared, noise-churned translucent body, wrapping wind bands, a leaf-strewn crown, and a two-stage eruption.
// Recipe adapted from the nature/tornado one (itself after Hugo Duprez's open-source VFX, MIT), reworked as a one-shot.
import { Particles, Lights, P, Rng, fit, clamp, smooth, seg, ease, lerp, rand, rng, cycle, tileNoise, TAU, WHITE, mix } from "../../core/index.js";
import { drawLeaf, drawRock, stoneShape } from "../nature/_lib.js";

const D = 0.95;
const COLLAPSE = 0.63;      // the funnel folds into the eruption here
const SY = 0.3;             // the squash of the orbit ellipse

export const meta = {
  name: "Verdant cyclone",
  desc: "A 碧绿 cyclone thrown ahead: a churning jade funnel with a leaf-strewn crown, wind bands wrapping it front and back, leaves spiralling in and erupting in a green burst.",
  tags: ["melee", "wind", "cyclone", "nature", "projectile", "green", "one-shot"],
  size: [150, 128],
  origin: [56, 114],
  duration: D,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 0,
  options: {
    palette: ["#03150d", "#052419", "#073323", "#0b4a30", "#11603f", "#177a4d", "#209552", "#2fb863", "#4ee082", "#8ff2a8", "#d6ffc8"],
    dust: ["#141a10", "#242e1c", "#3a4a2a", "#5a6c3c", "#7f9050"],
    leaves: ["#0e3a1e", "#1f5c2c", "#2f8a3e", "#56bd52", "#8fe06a", "#d4ffb2"],
    gold: ["#4a2a06", "#7a4f10", "#a8791f", "#d1a03a", "#ffd84a", "#fff3b0"],
    height: 54,
    seed: 4,
  },
};

export function create(o) {
  const C = fit(o.palette, 11), Dd = fit(o.dust, 5), L = fit(o.leaves, 6), G = fit(o.gold, 6);
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  const lights = new Lights();
  const rockShape = stoneShape(R, 5);

  let t = 0, velS = 0, lastX = o.x ?? 0, bursted = false, auraAcc = 1, dustAcc = 0, trailAcc = 0;
  const hist = [];
  const litter = []; // leaf speckles left in the funnel's wake on the floor

  // the funnel: axis snakes as it churns and leans back against its motion; radius flares at the crown
  const geo = (tt, shear, grow, k) => {
    const H = o.height * (1 - 0.18 * k), ph = tt * 11.5;
    const hk = o.height / 52; // collapse squash helper
    return {
      H,
      ph,
      ax: (u) => 5.2 * Math.sin(ph - 2.5 * u) * (0.22 + 0.78 * u) + 2 * Math.sin(2 * ph + 1.1 - 4.3 * u) * u - shear * u * u,
      rad: (u) => (2.4 + 8.8 * Math.pow(u, 1.42) + 3.6 * Math.pow(smooth(0.72, 1, u), 2)) * grow * (1 - k * 0.72) + k * 4.6,
    };
  };

  // the body: a translucent churned column, dusty at the root, lit from the left, shearing as rows spin
  const body = (p, g, seed, k, endFade) => {
    for (let y = -Math.ceil(g.H) + 1; y <= 0; y++) {
      const u = -y / g.H, cx = g.ax(u), r = g.rad(u);
      if (r < 0.7) continue;
      const K = 2 + (rand(y, seed) < 0.4 ? 1 : 0), rot = (g.ph * K) / 3.2 + u * 4.6;
      const fade = Math.min(1, u * 8 + 0.3) * (1 - smooth(0.88, 1.05, u)) * endFade;
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const c = (x + 0.5 - cx) / r;
        if (Math.abs(c) > 1) continue;
        const n = tileNoise(((Math.acos(clamp(c, -1, 1)) + rot) * 6) / TAU, y * 0.34, 6, 0, seed), v = -c * 0.55 + 0.15 + n * 0.58;
        let col = v > 0.55 ? C[8] : v > 0.22 ? C[6] : v > -0.02 ? C[5] : v > -0.35 ? C[3] : C[2];
        if (u < 0.3) col = mix(col, Dd[v > 0.3 ? 3 : v > -0.2 ? 2 : 1], 0.72 * (1 - u / 0.3));
        p.blend(x, y, col, (0.17 + 0.38 * Math.sqrt(1 - c * c)) * fade);
      }
    }
  };

  // wind bands wrapping the funnel: bright heads, long tails; the far half dimmer behind
  const bands = (p, g, seed, back, endFade) => {
    for (let j = 0; j < 34; j++) {
      const Rj = rng(seed, j), u = (j + Rj.range(0.15, 0.85)) / 34;
      if (u > 0.97) continue;
      const K = Rj.int(2, 4), span = Rj.range(0.7, 2.2), lvl = Rj.next();
      const cx = g.ax(u), r = g.rad(u) * Rj.range(1.02, 1.14), y0 = -u * g.H;
      const head = Rj.range(0, TAU) + g.ph * K * 0.62;
      for (let s = 0; s <= span; s += 0.5 / Math.max(2, r)) {
        const th = head - s, sn = Math.sin(th);
        if ((sn > 0) === back) continue;
        const kk = s / span, x = cx + r * Math.cos(th), y = y0 + r * SY * sn, lit = Math.cos(th) < 0.25;
        let i = lvl < 0.16 ? 3 : kk < 0.16 && lvl > 0.5 ? 10 : kk < 0.45 ? (lit ? 8 : 6) : lit ? 6 : 4;
        if (back) i = Math.max(1, i - 3);
        const a = (kk < 0.5 ? 1 : 2.4 * (1 - kk)) * (back ? 0.7 : 1) * endFade;
        if (kk < 0.5) p.dot(x, y, C[i], a); else p.blend(x, y, C[i], a * 0.62);
      }
      if (!back && lvl > 0.55 && Math.sin(head) > 0.35) {
        const hx = cx + r * Math.cos(head), hy = y0 + r * SY * Math.sin(head);
        p.dot(hx, hy, WHITE, endFade);
        p.glow(hx, hy, 4, C[7], 0.35 * endFade);
      }
    }
  };

  // the mouth: a dark throat, a streaming jade rim, and sheared leaf-cloud bands flung off the crown
  const mouth = (p, g, seed, back, endFade, flash) => {
    const cx = g.ax(1), r = g.rad(1), y0 = -g.H - 2, L2 = (c) => mix(c, C[10], flash * 0.55);
    if (!back) {
      p.ellipse(cx, y0 + 0.5, r, r * 0.34, "#020e08", 0.95 * endFade);
      for (let a = 0; a < TAU; a += TAU / 12) {
        const x = cx + Math.cos(a) * r, y = y0 + 0.5 + Math.sin(a) * r * 0.34;
        const hot = Math.sin(a * 2 + g.ph * 2.2) > 0.35;
        p.dot(x, y, L2(hot ? C[8] : C[6]), endFade);
      }
      if (flash > 0.05) p.glow(cx, y0, 16 + flash * 10, C[8], 0.4 * flash * endFade);
    }
    for (let j = 0; j < 9; j++) {
      const Rj = rng(seed + 2, j), rr = r * Rj.range(0.35, 1.12), K = Rj.int(1, 2);
      const span = Rj.range(1.3, 2.5), head = Rj.range(0, TAU) + g.ph * K * 0.5;
      const th0 = Rj.range(3.2, 6), lift = Rj.range(-3.5, 2) - (1 - rr / (r * 1.12)) * 4;
      for (let s2 = 0; s2 <= span; s2 += 0.6 / rr) {
        const th = head - s2, sn = Math.sin(th);
        if ((sn > 0) === back) continue;
        const kk = s2 / span, th2 = th0 * Math.sin(Math.PI * Math.pow(1 - kk, 0.7));
        const x = cx + rr * Math.cos(th), y = y0 + lift + rr * SY * sn;
        const T = Math.max(1.5, Math.round(th2)), d = back ? 2 : 0, lit = Math.cos(th) < 0.3;
        for (let i = 0; i < T; i++) {
          const c = i === 0 ? L2(C[(lit ? 9 : 7) - d]) : i === T - 1 && T > 2 ? C[2] : L2(C[(i === 1 ? 6 : 4) - d]);
          p.blend(x, y - T / 2 + i, c, (0.6 + 0.35 * (1 - kk)) * (back ? 0.65 : 1) * endFade);
        }
      }
    }
  };

  // leaves, twigs and pebbles sucked in and carried up; some gold in it, a sixth or so
  const debris = (p, g, seed, back, endFade) => {
    cycle(t, D, 15, seed, (q) => q.range(0.4, 0.95), (age, life, R2, i) => {
      const kk = age / life, u = lerp(0.04, 0.94, Math.pow(kk, 0.8));
      const th = R2.range(0, TAU) + R2.range(2.2, 3.6) * TAU * kk, sn = Math.sin(th);
      if ((sn > 0) === back) return;
      const fling = smooth(0.7, 1, kk);
      const rr = Math.min(26, g.rad(u) * (1.1 + fling * 0.9) + R2.range(1.5, 5));
      const x = g.ax(u) + rr * Math.cos(th), y = -u * g.H + rr * SY * sn - fling * 7;
      const a = Math.min(1, kk * 7) * (1 - smooth(0.8, 1, kk)) * endFade;
      const kind = R2.next(), spin = R2.range(-16, 16) * age, dk = back ? 1 : 0;
      if (kind < 0.56) {
        const pal = R2.next() < 0.18 ? [G[0], G[1], G[2], G[3] - 0] : L;
        drawLeaf(p, x, y, R2.range(4.5, 7), R2.range(1.5, 2.3), spin, age * R2.range(5, 11), R2.next() < 0.18 ? [G[0], G[2], G[3 + dk], G[4]] : [L[0], L[1 + dk], L[2 + dk], L[3 + dk]], a);
      } else if (kind < 0.74) {
        const ca = Math.cos(spin) * 2.2, sa = Math.sin(spin) * 2.2;
        p.line(x - ca, y - sa, x + ca, y + sa, back ? L[0] : L[1], a);
        p.dot(x + ca, y + sa, L[2 + dk], a);
      } else {
        drawRock(p, x, y, R2.range(1.3, 2.1), spin, rockShape, back ? [Dd[1], Dd[2], Dd[3], Dd[3 + dk]] : [Dd[0], Dd[1], Dd[2], Dd[3 + dk]], a);
      }
    });
  };

  // at its foot: dust boiling out, scuff arcs swept round the floor
  const skirt = (p, g, seed, back, endFade) => {
    cycle(t, D, 17, seed + 3, (q) => q.range(0.32, 0.7), (age, life, R2) => {
      const kk = age / life, th = R2.range(0, TAU) + R2.range(5, 9) * age, sn = Math.sin(th);
      if ((sn > 0) === back) return;
      const rr = 3.5 + kk * R2.range(9, 17), x = g.ax(0) + rr * Math.cos(th), y = -1.2 - kk * R2.range(3, 11) + rr * 0.3 * sn;
      const s = R2.range(2.2, 4.4) * (0.6 + 0.8 * kk), a = Math.min(1, kk * 6) * (1 - kk) * 0.55 * endFade;
      p.disc(x, y + s * 0.2, s, Dd[back ? 1 : 2], a);
      p.disc(x - s * 0.2, y - s * 0.3, s * 0.55, Dd[back ? 2 : 3], a * 0.8);
    });
    for (let j = 0; j < 5; j++) {
      const Rj = rng(seed + 7, j), rr = Rj.range(6, 15), th0 = Rj.range(0, TAU) + g.ph * 1.6, span = Rj.range(0.6, 1.2);
      for (let s = 0; s < span; s += 0.5 / rr) {
        const th = th0 - s;
        if ((Math.sin(th) > 0) === back) continue;
        p.dot(g.ax(0) + rr * Math.cos(th), 0.5 + rr * 0.18 * Math.sin(th), Dd[s < span * 0.4 ? 3 : 2], (1 - s / span) * 0.9 * endFade);
      }
    }
  };

  // the eruption: its own fountain of leaves arcing out and raining back to the floor
  const fountain = (p, seed, endFade) => {
    const age = t - COLLAPSE;
    if (age <= 0) return;
    for (let j = 0; j < 16; j++) {
      const R2 = rng(seed + 21, j);
      const ang = R2.range(0, Math.PI), sp = R2.range(24, 66);
      const x = Math.cos(ang) * sp * age, vy = Math.sin(ang) * sp;
      let y = -16 - vy * age + 250 * age * age;
      if (y > -0.5) y = -0.5;
      const a = clamp(1 - age / (D - COLLAPSE + 0.05), 0, 1) * endFade;
      const pal = R2.next() < 0.2 ? [G[0], G[2], G[3], G[4]] : [L[0], L[2], L[3], L[4]];
      drawLeaf(p, x, y, R2.range(4, 6.5), 1.5, R2.range(-7, 7) * age * 3, age * 9, pal, a);
    }
  };

  return {
    update(dt) {
      t += dt;
      const ox = o.x ?? 0;
      const vx = dt > 0 ? (ox - lastX) / dt : 0;
      lastX = ox;
      velS += (Math.min(340, Math.abs(vx)) - velS) * Math.min(1, dt * 4.5);
      auraAcc += dt;
      if (t < COLLAPSE && auraAcc >= 0.08) { auraAcc = 0; lights.add(0, -24, 26, C[6], 0.3, 0.15); }
      dustAcc += dt;
      if (t < COLLAPSE && dustAcc >= 0.05) {
        dustAcc = 0;
        ps.spawn(P.MOTE, R.range(-4, 5), 0, R.range(-30, 30), R.range(-38, -8), R.range(0.2, 0.36), Dd[2 + R.int(0, 2)], 0.6);
      }
      // leaf litter left behind in the wake
      trailAcc += dt;
      if (t < D - 0.15 && trailAcc >= 0.04 && litter.length < 44) {
        trailAcc = 0;
        litter.push({ x: ox + R.range(-7, 6), c: R.next() < 0.16 ? G[3] : L[2 + R.int(0, 2)], o: R.range(0.4, 0.85) });
      }
      if (!bursted && t >= COLLAPSE) {
        bursted = true;
        for (let i = 0; i < 20; i++) {
          const a = R.range(0, TAU), sp = R.range(35, 130);
          ps.spawn(P.MOTE, 0, -15 + R.range(-9, 6), Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 26, R.range(0.14, 0.26), i % 5 === 0 ? G[3] : C[5 + R.int(0, 3)], 0.85);
        }
        for (let i = 0; i < 6; i++) ps.spawn(P.GRIT, 0, -16, R.range(-55, 55), R.range(-125, -40), R.range(0.1, 0.18), i % 2 ? C[6] : G[3], 1);
        lights.add(0, -18, 42, C[6], 0.9, 0.34);
        lights.add(0, -22, 19, WHITE, 0.55, 0.2);
      }
      ps.update(dt);
      lights.update(dt);
      hist.push(ox);
      if (hist.length > 9) hist.shift();
    },
    drawBack(p) {
      const endFade = 1 - smooth(D - 0.09, D - 0.005, t);
      if (endFade <= 0.005) return;
      const ox = o.x ?? 0;
      const shear = clamp(velS * 0.0078, 0, 3.6);
      const grow = 0.35 + 0.65 * smooth(0, 0.16, t);
      const k = clamp(seg(t, COLLAPSE, D));
      const g = geo(t, shear, grow, k);
      // wake litter on the floor (drawn before everything so the funnel rides over it)
      for (const q of litter) p.dot(q.x - ox, 0.4 + (q.x * 7 & 1) * 0.5, q.c, q.o * endFade * 0.8);
      // afterimages of the travelling funnel
      const gh = hist.length;
      for (const gi of [gh - 4, gh - 8]) {
        if (gi < 0) continue;
        const dx = hist[gi] - ox, a = gi === gh - 4 ? 0.2 : 0.09;
        const gg = geo(t, shear, grow, k);
        gg.ax = (u) => g.ax(u) + dx;
        p.ellipse(gg.ax(1), -g.H - 2, g.rad(1), g.rad(1) * 0.34, C[2], a * endFade);
        for (let j = 0; j < 22; j++) {
          const Rj = rng(9 + j, j), u = (j + 0.5) / 22, cx = gg.ax(u), r = g.rad(u);
          p.blend(cx, -u * g.H, C[2], a * 0.5 * endFade);
          p.blend(cx - r * 0.55, -u * g.H + 1, C[1], a * 0.4 * endFade);
          p.blend(cx + r * 0.55, -u * g.H + 1, C[1], a * 0.4 * endFade);
        }
      }
      skirt(p, g, o.seed * 5 + 1, true, endFade);
      mouth(p, g, o.seed * 7 + 2, true, endFade, 0);
      bands(p, g, o.seed * 3 + 5, true, endFade);
      debris(p, g, o.seed * 11 + 3, true, endFade);
      body(p, g, o.seed, k, endFade);
    },
    draw(p) {
      const endFade = 1 - smooth(D - 0.09, D - 0.005, t);
      if (endFade <= 0.005) return;
      const shear = clamp(velS * 0.0078, 0, 3.6);
      const grow = 0.35 + 0.65 * smooth(0, 0.16, t);
      const k = clamp(seg(t, COLLAPSE, D));
      const g = geo(t, shear, grow, k);
      // a strobe in the mouth, twice, like a flash catching static
      const flash = Math.max(0, 1 - Math.abs(t - 0.4) / 0.055) + 0.7 * Math.max(0, 1 - Math.abs(t - 0.51) / 0.03);
      mouth(p, g, o.seed * 7 + 2, false, endFade, flash);
      bands(p, g, o.seed * 3 + 5, false, endFade);
      skirt(p, g, o.seed * 5 + 1, false, endFade);
      debris(p, g, o.seed * 11 + 3, false, endFade);
      // the eruption's white pillar and fountain
      const pq = clamp((t - COLLAPSE + 0.02) / 0.09, 0, 1);
      if (pq > 0 && pq < 1) {
        const pa = Math.sin(pq * Math.PI) * endFade;
        for (let yy = 0; yy < 46; yy += 1.5) {
          const vv = clamp(yy / 52, 0, 1), wob = g.ax(vv), spread = 1 - yy / 82;
          p.dot(wob - spread * 2, -2 - yy, C[8], pa * 0.75);
          p.dot(wob, -2 - yy, WHITE, pa * 0.9);
          p.dot(wob + spread * 2, -2 - yy, C[8], pa * 0.75);
        }
      }
      fountain(p, o.seed, endFade);
      if (t > COLLAPSE) {
        const q = clamp(seg(t, COLLAPSE, D)), e = ease.outCubic(q);
        p.glow(0, -18, 16 + 26 * e, C[5], (0.5 * (1 - q) + 0.2) * endFade);
        p.circle(0, -18, 2.2 + 5.6 * e, C[9], Math.max(0, 1 - q * 0.55) * endFade);
        p.circle(0, -18, 1.2 + 2.6 * e, WHITE, Math.max(0, 1 - q) * endFade);
        p.ellipse(0, 0, 5 + ease.outQuart(q) * 20, 1.5 + ease.outQuart(q) * 5, C[4], (1 - q) * 0.75 * endFade);
      }
      if (t < D - 0.02) { ps.draw(p); lights.draw(p); }
    },
  };
}
