// An emerald cyclone swept forward: a stacked, spinning funnel with a dust skirt, suction leaves and a collapsing burst.
import { Particles, Lights, P, Rng, fit, clamp, smooth, seg, ease, band, TAU, WHITE } from "../../core/index.js";

const D = 0.78;
const COLLAPSE = D - 0.2;

export const meta = {
  name: "Verdant cyclone",
  desc: "A 碧绿 tornado spun out ahead: a tall churning funnel of jade wind with a dust skirt, leaves spiralling in and a collapsing white-green burst at its end.",
  tags: ["melee", "wind", "cyclone", "nature", "projectile", "green", "one-shot"],
  size: [128, 110],
  origin: [42, 100],
  duration: D,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 0,
  options: {
    palette: ["#03180f", "#06281f", "#0b3c2b", "#14533c", "#1d7050", "#289160", "#38b673", "#63df8f", "#b8ffd2"],
    gold: ["#63410f", "#9c6f24", "#d1a03a", "#ffd84a"],
    seed: 4,
  },
};

export function create(o) {
  const C = fit(o.palette, 9), G = fit(o.gold, 4);
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  const lights = new Lights();
  const TAU_C = TAU;
  const sliceRx = (v, k) => (4.1 + (10.8 - 4.1) * Math.pow(v, 1.32)) * (1 - k * 0.72) + k * 5.6;
  const sliceY = (v, k = 0) => -2 - v * 52 * (1 - 0.45 * k);
  const sliceWob = (v, tt) => Math.sin(v * 6.4 - tt * 8.6 + 1.4) * (0.7 + v * 2.7) + Math.sin(tt * 2.3) * 1.1;

  // leaves sucked in and spiralling up the funnel; a sixth of them are gold
  const leaves = Array.from({ length: 15 }, () => ({
    v: R.range(0.15, 0.9),
    a: R.range(0, TAU),
    av: R.range(2.8, 5.6),
    r: R.range(4.5, 12.5),
    gold: R.next() < 0.16,
  }));
  const hist = [];
  let t = 0, spin = 0, bursted = false, dustAcc = 0, auraAcc = 1;

  return {
    update(dt) {
      t += dt;
      spin += dt * 9.5;
      for (const L of leaves) {
        L.a += L.av * dt;
        if (t < COLLAPSE) {
          L.r -= dt * (1.5 + L.v * 1.2);
          if (L.r < 2.1) {
            L.r = R.range(6.5, 12.5);
            L.a = R.range(0, TAU);
            L.v = R.range(0.12, 0.88);
            L.gold = R.next() < 0.16;
          }
        }
      }
      // a faint jade aura while it travels
      auraAcc += dt;
      if (t < COLLAPSE && auraAcc >= 0.09) { auraAcc = 0; lights.add(0, -22, 26, C[5], 0.32, 0.16); }
      // dust kicked up at the skirt while it travels
      dustAcc += dt;
      if (t < COLLAPSE && dustAcc >= 0.055) {
        dustAcc = 0;
        ps.spawn(P.MOTE, R.range(-3, 4), 0, R.range(-26, 26), R.range(-34, -8), R.range(0.2, 0.36), C[2 + (R.int(0, 2))], 0.6);
      }
      if (!bursted && t >= COLLAPSE) {
        bursted = true;
        // the funnel folds in and erupts: debris, a cold green ring, a white heart
        for (let i = 0; i < 18; i++) {
          const a = R.range(0, TAU), sp = R.range(35, 128);
          ps.spawn(P.MOTE, 0, -16 + R.range(-10, 6), Math.cos(a) * sp, Math.sin(a) * sp * 0.8 - 26, R.range(0.14, 0.26), i % 5 === 0 ? G[2] : C[4 + (i % 3)], 0.85);
        }
        for (let i = 0; i < 5; i++) ps.spawn(P.GRIT, 0, -18, R.range(-50, 50), R.range(-120, -40), R.range(0.1, 0.19), i % 2 ? C[6] : G[3], 1);
        lights.add(0, -19, 40, C[6], 0.9, 0.34);
        lights.add(0, -22, 18, WHITE, 0.55, 0.2);
      }
      ps.update(dt);
      lights.update(dt);
      hist.push(o.x ?? 0);
      if (hist.length > 10) hist.shift();
    },
    draw(p) {
      const ox = o.x ?? 0;
      const endFade = 1 - smooth(D - 0.09, D - 0.005, t);
      if (endFade <= 0.005) return; // one-shots end empty
      const k = clamp(seg(t, COLLAPSE, D)); // collapse amount 0→1 at the end of life
      const ghost = (dx, a, step) => {
        for (let i = 0; i < 15; i += step) {
          const v = i / 14, rx = sliceRx(v, k), y = sliceY(v), wob = sliceWob(v, t) + dx;
          p.ellipse(wob, y, rx, rx * 0.36, C[1], a * (0.8 + v * 0.4) * endFade);
        }
      };
      // afterimages of the travelling funnel
      const gh = hist.length;
      if (gh >= 4) ghost(hist[gh - 4] - ox, 0.28, 3);
      if (gh >= 8) ghost(hist[gh - 8] - ox, 0.13, 4);

      // ground skirt: a low dark swirl at the floor
      const skirt = sliceRx(0, k) + 2.5;
      p.ellipse(sliceWob(0, t), -0.5, skirt + 2.2, 2.5, C[0], 0.6 * endFade);
      p.ellipse(sliceWob(0, t), -1.2, skirt, 1.6, C[1], 0.8 * endFade);

      // the funnel body: a shaded cone of vertical wind, one dense pass of pixels
      const topY = sliceY(1, k) - 2;
      p.shade(-16, topY - 3, 16, 1.6, (x, y, out) => {
        const H = 52 * (1 - 0.45 * k);
        const v = clamp((-2 - y) / H, 0, 1);
        const wob = sliceWob(v, t);
        const rx = sliceRx(v, k);
        const nx = (x - wob) / rx;
        if (Math.abs(nx) > 1) return;
        // vertical churning streaks sweeping around the cone + depth by height
        const wind = Math.sin(nx * 3.1 + v * 2.3 - spin * 1.15) * 0.5 + Math.sin(nx * 6.7 - v * 5.1 + spin * 1.9) * 0.3 + Math.sin(nx * 1.5 + v * 8.6 - spin * 0.7) * 0.2;
        let c;
        if (Math.abs(nx) > 0.87) c = C[5 + (wind > 0 ? 1 : 0)]; // lit silhouette edge
        else if (wind > 0.42) c = C[4];
        else if (wind > 0.08) c = C[3];
        else if (wind > -0.3) c = C[2];
        else c = C[1];
        if (v > 0.78 && wind > 0.1) c = C[5];       // the mouth catches the sky light
        if (v < 0.14 && wind <= 0.08) c = C[1];     // the root is choked with dust
        out.c = c;
        out.a = endFade;
      });
      // the open mouth: a bright rim with a dark throat
      const mWob = sliceWob(1, t), mRx = sliceRx(1, k);
      p.ellipse(mWob, sliceY(1, k), mRx, mRx * 0.36, C[6], endFade);
      p.ellipse(mWob, sliceY(1, k), Math.max(0.6, mRx - 1.6), Math.max(0.3, mRx * 0.36 - 0.8), "#020e08", 0.92 * endFade);

      // orbiting hot wind bands spiralling up the outside
      for (let i = 0; i < 15; i++) {
        const v = i / 14, rx = sliceRx(v, k) + 0.6, y = sliceY(v, k), wob = sliceWob(v, t), ry = rx * 0.36;
        const phase = spin * (1 + v * 0.55) + v * 5.2;
        for (let a = 0; a < TAU_C; a += 0.17) {
          const sn = Math.sin(a);
          const dash = Math.sin(a * 2 + phase) * 0.62 + Math.sin(a * 3.5 - phase * 1.3 + v * 4.1) * 0.38;
          if (dash < 0.36) continue;
          const front = sn >= -0.12, hot = Math.sin(a * 4 - phase * 2.1 + v * 6.8) > 0.58;
          p.dot(wob + Math.cos(a) * rx, y + sn * ry, hot ? C[7] : C[5], (front ? 0.95 : 0.4) * endFade);
        }
      }
      // two bright wind streaks spiralling up the outside
      for (const [v, rate] of [[0.68, 1.35], [0.38, 1.0]]) {
        const y = sliceY(v, k), rx = sliceRx(v, k) + 2.5, wob = sliceWob(v, t);
        const ang = spin * rate + v * 9;
        for (let j = -3; j <= 3; j++) {
          const a = ang + j * 0.16, sn = Math.sin(a);
          if (sn < -0.2) continue;
          p.dot(wob + Math.cos(a) * rx, y + sn * rx * 0.36, j === 0 ? C[8] : C[6], (sn >= 0 ? 0.95 : 0.5) * endFade);
        }
      }
      // leaves spiralling inward
      for (const L of leaves) {
        const v = L.v, y = sliceY(v, k) + Math.sin(L.a * 1.7) * 1.6, wob = sliceWob(v, t);
        const rx = Math.min(L.r, sliceRx(v, k) + 3), ry = rx * 0.4;
        const px = wob + Math.cos(L.a) * rx, py = y + Math.sin(L.a) * ry;
        const dim = Math.sin(L.a) < 0;
        if (L.gold) {
          p.dot(px, py, G[2], (dim ? 0.5 : 1) * endFade);
          if (!dim) p.dot(px + 0.6, py - 0.6, G[3], 0.8 * endFade);
        } else {
          const n = 3 + (Math.floor(L.a * 1.3) & 1);
          p.dot(px, py, dim ? C[3] : C[n + 3], (dim ? 0.5 : 1) * endFade);
          if (!dim && L.r > 4) p.dot(px + 0.7, py - 0.5, C[4], 0.7 * endFade);
        }
      }
      // the eruption's white pillar — fast in, fast out
      const pq = clamp((t - COLLAPSE + 0.02) / 0.09, 0, 1);
      if (pq > 0 && pq < 1) {
        const pa = Math.sin(pq * Math.PI) * endFade;
        for (let yy = 0; yy < 46; yy += 1.5) {
          const vv = clamp(yy / 52, 0, 1), wob = sliceWob(vv, t), spread = 1 - yy / 80;
          p.dot(wob - spread * 2, -2 - yy, C[7], pa * 0.75);
          p.dot(wob, -2 - yy, WHITE, pa * 0.9);
          p.dot(wob + spread * 2, -2 - yy, C[7], pa * 0.75);
        }
      }
      // collapsing into the burst
      if (t > COLLAPSE) {
        const q = clamp(seg(t, COLLAPSE, D)), e = ease.outCubic(q);
        p.glow(0, -20, 16 + 26 * e, C[5], (0.5 * (1 - q) + 0.18) * endFade);
        p.circle(0, -20, 2.2 + 5.6 * e, C[8], Math.max(0, 1 - q * 0.55) * endFade);
        p.circle(0, -20, 1.2 + 2.6 * e, WHITE, Math.max(0, 1 - q) * endFade);
        band(p, 0, -20, 3.5 + ease.outQuart(q) * 22, 0.44, Math.max(0.6, 2.6 * (1 - q)), (1 - q) * 1.05 * endFade, [C[1], C[3], C[5], C[7]], (g) => Math.sin(g) >= 0, q < 0.45);
        band(p, 0, -20, 2.5 + ease.outQuart(q) * 14, 0.44, Math.max(0.6, 1.8 * (1 - q)), (1 - q) * 0.8 * endFade, [C[2], C[4], C[6]], (g) => Math.sin(g) < 0, false);
      }
      if (t < D - 0.02) { ps.draw(p); lights.draw(p); }
    },
  };
}
