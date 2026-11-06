import { Particles, Lights, P, Rng, fit, clamp, smooth, hex } from "../../core/index.js";
import { simDraw } from "./_lib.js";

export const meta = {
  name: "Meteor shower", desc: "A staggered volley of small burning stones strikes the ground, scattering sparks and smoke over cooling craters.",
  tags: ["fire", "meteor", "shower", "impact", "ground", "one-shot"],
  size: [260, 170], origin: [130, 145], duration: 3, loop: false, fps: 30, bg: "ground",
  options: { palette: ["#42150d", "#78270e", "#af3d10", "#db5b18", "#f68029", "#ffa851", "#ffd19a", "#fff0db"], seed: 24 },
};

// A spread of independent impacts, not one enlarged explosion.
const SITES = [[0, 0.00, 5, 13], [-46, 0.23, 3.2, 9], [42, 0.46, 4.4, 17], [-24, 0.70, 3.8, 12], [25, 0.95, 3.1, 10], [-60, 1.15, 3.7, 14]];
export function create(o) {
  const C = fit(o.palette, 8), R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0, sparks: [C[7], C[6], C[5], C[4]] });
  const lights = new Lights(), stones = SITES.map(([x, delay, r, tail], i) => ({
    x: x + R.range(-3, 3), start: delay + R.range(0, 0.035), r: r * R.range(0.9, 1.1),
    tail: tail * R.range(0.9, 1.1), fall: R.range(0.38, 0.46), slant: R.range(0.43, 0.57), landed: false, i,
  }));
  let t = 0;
  function impact(s) {
    s.landed = true;
    lights.add(s.x, -4, 26, C[5], 0.48, 0.25);
    for (let j = 0; j < 5; j++) ps.spawn(P.FIRE, s.x + R.range(-3, 3), -R.range(2, 7), R.range(-27, 27), -R.range(25, 75), R.range(0.25, 0.48), 0, R.range(2.5, 4.2));
    for (let j = 0; j < 4; j++) ps.spawn(P.SMOKE, s.x + R.range(-3, 3), -R.range(3, 8), R.range(-12, 12), -R.range(12, 30), R.range(0.65, 1), hex("#635653"), R.range(3, 5), R.range(0.02, 0.16));
    for (let j = 0; j < 7; j++) ps.spawn(P.SPARK, s.x, -2, R.range(-90, 90), -R.range(55, 135), R.range(0.42, 0.85));
    for (let j = 0; j < 3; j++) ps.spawn(P.EMBER, s.x + R.range(-4, 4), -R.range(2, 6), R.range(-12, 12), -R.range(12, 35), R.range(0.55, 1.1), C[5], 1);
  }
  function flight(p, s) {
    const q = clamp((t - s.start) / s.fall), y = -100 * (1 - q), x = s.x - y * s.slant;
    // Compact, tapered tongues, anchored to each individual stone rather than a screen-length streak.
    const len = s.tail;
    p.poly([[x-2, y-1], [x + len * s.slant, y-len], [x+4, y+1]], C[3]);
    p.poly([[x-1, y-1], [x + len * s.slant * 0.72, y-len*0.72], [x+2, y+1]], C[5]);
    p.circle(x, y, s.r+1, C[3]);
    p.circle(x, y, s.r, C[4]);
    p.circle(x-1, y+1, Math.max(1, s.r*0.55), C[6]);
    p.line(x-s.r*0.6, y+s.r*0.7, x+s.r*0.4, y+s.r*0.7, C[7]);
    p.glow(x, y, 12, C[5], 0.3);
  }
  function crater(p, s) {
    if (!s.landed) return;
    const age = t - s.start - s.fall, fade = (1 - smooth(1.05 + s.i*0.08, 1.65 + s.i*0.06, age)) * (1 - smooth(2.55, 2.95, t));
    if (fade <= 0) return;
    const rx = s.r*2.1;
    p.ellipse(s.x, 0, rx, 3, C[3], fade);
    p.ellipse(s.x, -0.4, rx*0.8, 1.8, C[1], fade);
    p.line(s.x-rx*0.65, 1, s.x+rx*0.55, 1, age < 0.5 ? C[5] : C[3], fade);
    p.line(s.x-rx*0.45, -2, s.x+rx*0.35, -2, age < 0.35 ? C[6] : C[4], fade);
    if (age < 1.1) p.glow(s.x, -1, 12, C[4], 0.22 * (1-age/1.1));
  }
  return {
    update(dt) {
      t += dt;
      for (const s of stones) if (!s.landed && t >= s.start+s.fall) impact(s);
      ps.update(dt); lights.update(dt);
    },
    drawBack(p) { if (t >= meta.duration - 1e-6) return; for (const s of stones) crater(p, s); simDraw(p, ps, [...C].reverse(), "back"); },
    draw(p) {
      if (t >= meta.duration - 1e-6) return;
      for (const s of stones) if (t >= s.start && !s.landed) flight(p, s);
      // Each strike opens into a small, brief lobed fireball before the smoke takes over.
      for (const s of stones) {
        const age = t - s.start - s.fall;
        if (!s.landed || age < 0 || age >= 0.28) continue;
        const k = 1 - age / 0.28, r = s.r * (0.9 + 0.6 * (1-k)) * k;
        p.circle(s.x, -3-r*0.6, r+1, C[3]);
        p.circle(s.x-r*0.65, -3-r*0.45, r*0.55, C[4]);
        p.circle(s.x+r*0.65, -3-r*0.5, r*0.55, C[4]);
        p.circle(s.x, -3-r*0.65, r*0.7, age < 0.07 ? C[7] : C[5]);
        p.glow(s.x, -4, 18, C[5], k*0.4);
      }
      simDraw(p, ps, [...C].reverse(), "front"); lights.draw(p);
    },
  };
}
