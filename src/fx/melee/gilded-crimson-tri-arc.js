import {
  Particles,
  Bits,
  Lights,
  P,
  B,
  Rng,
  fit,
  flare,
  clamp,
  smooth,
  seg,
  ease,
  TAU,
  WHITE,
} from "../../core/index.js";
import { star, along } from "./_lib.js";

export const meta = {
  name: "Gilded crimson tri-arc",
  desc: "Boss gilded crimson triple crescent slash: three white-gold glints with dark-red heat waves erupt into three parallel tearing crescents, cross-slash impact, and lingering ash.",
  tags: ["melee", "boss", "slash", "fire", "gold", "crimson", "combo", "directional", "one-shot"],
  size: [320, 224],
  origin: [80, 160],
  duration: 2.0,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#120406", "#38080c", "#6e1014", "#a81e18", "#dc4418", "#f58820", "#ffd24c", "#fff5cc"],
    gold: ["#3a2204", "#8a560e", "#d99e22", "#ffeaa0"],
    smoke: ["#120e0c", "#261c18", "#3d2c24", "#594236"],
    seed: 19,
  },
};

const READY = {
  x: 0,
  weapon: "sword",
  sa: -0.5,
  sb: -0.9,
  crouch: 5,
  lean: 3,
  fx: 13,
  fy: -22,
  bx: 7,
  by: -24,
  ffx: 10,
  fbx: -9,
};
const WIND = {
  ...READY,
  x: -8,
  crouch: 8,
  lean: -6,
  fx: -6,
  fy: -36,
  sa: -2.4,
  bx: 5,
  by: -20,
  sb: -0.4,
  ffx: 9,
  fbx: -10,
};
const CUT = {
  ...READY,
  x: 24,
  crouch: 7,
  lean: 8,
  fx: 20,
  fy: -15,
  sa: 0.85,
  bx: -6,
  by: -24,
  ffx: 14,
  fbx: -9,
  toeB: true,
  ghost: 1,
};

const HIT_T = 0.48;

export const act = {
  target: { x: 128 },
  poses: [
    [-0.28, { ...READY, x: -4 }],
    [0.0, WIND],
    [0.32, { ...WIND, crouch: 9, lean: -7 }],
    [0.38, { ...READY, x: 12, crouch: 4, lean: 5, fx: 16, fy: -32, sa: -0.9, bx: -5, by: -23, ghost: 1 }, "snap"],
    [HIT_T, CUT, "snap"],
    [0.85, { ...CUT, crouch: 6, fx: 18, fy: -17 }],
    [1.45, { ...READY, x: 10, crouch: 5 }],
    [2.0, { ...READY, x: 0 }],
  ],
  hits: [
    { t: HIT_T, stop: 0.1, shake: 0.34, amp: 4, push: 5.5, straw: 28, y: -28, skin: "char" },
  ],
  dust: [
    { t: 0.38, x: 18, n: 8, dir: -1 },
    { t: HIT_T, x: 34, n: 10, dir: 1 },
  ],
};

// Three parallel crescent arcs (upper, middle, lower)
const ARCS = [
  { cx: 56, cy: -42, r: 76, a0: -0.92, a1: 0.42, w: 12, delay: 0.0 },
  { cx: 64, cy: -26, r: 82, a0: -0.88, a1: 0.46, w: 14, delay: 0.025 },
  { cx: 52, cy: -10, r: 74, a0: -0.84, a1: 0.50, w: 11, delay: 0.05 },
];

// Three charge glint points in mid-air
const GLINTS = [
  { x: 30, y: -56, delay: 0.0 },
  { x: 40, y: -38, delay: 0.05 },
  { x: 28, y: -20, delay: 0.1 },
];

function drawCrescent(p, arc, u, C, G, R) {
  const sweep = ease.outCubic(clamp(u * 1.45, 0, 1));
  const tail = ease.inQuad(clamp((u - 0.18) / 0.82, 0, 1));
  const aStart = arc.a0 + (arc.a1 - arc.a0) * tail;
  const aEnd = arc.a0 + (arc.a1 - arc.a0) * sweep;
  if (aEnd <= aStart + 0.02) return;

  const alpha = u < 0.78 ? 1 : 1 - smooth(0.78, 1, u);
  const steps = 96;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const a = aStart + (aEnd - aStart) * f;
    const profile = Math.sin(f * Math.PI);
    const w = arc.w * (0.28 + 0.72 * profile) * (1 - tail * 0.45);
    if (w < 0.8) continue;

    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const jag = (Math.sin(f * 27 + arc.cy) * 0.6 + Math.cos(f * 41) * 0.4) * (1 - f * 0.3);

    for (let d = -w * 0.45; d <= w * 0.55; d += 0.5) {
      const rr = arc.r + d + jag;
      const px = arc.cx + ca * rr;
      const py = arc.cy + sa * rr * 0.82;
      const norm = (d + w * 0.45) / w;

      let col;
      if (norm > 0.82) {
        col = u < 0.22 ? WHITE : G[3];
      } else if (norm > 0.62) {
        col = G[2];
      } else if (norm > 0.35) {
        col = C[4];
      } else {
        col = C[2];
      }
      p.dot(px, py, col, alpha);
    }

    if (i % 4 === 0) {
      const gx = arc.cx + ca * (arc.r + w * 0.2);
      const gy = arc.cy + sa * (arc.r + w * 0.2) * 0.82;
      p.glow(gx, gy, 9, G[2], 0.28 * alpha);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8);
  const G = fit(o.gold, 4);
  const S = fit(o.smoke, 4);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, G[3], G[2], C[5], C[3]],
  });
  const bits = new Bits({ ground: floor });

  // Pre-schedule charge embers
  for (let i = 0; i < 18; i++) {
    const g = GLINTS[i % 3];
    const a = R.range(0, TAU);
    const v = R.range(25, 75);
    ps.spawn(
      P.MOTE,
      g.x + R.range(-8, 8),
      g.y + R.range(-8, 8),
      Math.cos(a) * v,
      Math.sin(a) * v - 25,
      R.range(0.25, 0.45),
      R.pick([G[3], C[5], C[3]]),
      0.7,
      R.range(0.02, 0.28)
    );
  }

  // Slash trail scorched smoke & dense sparks
  for (const arc of ARCS) {
    for (let i = 0; i < 16; i++) {
      const f = i / 15;
      const a = arc.a0 + (arc.a1 - arc.a0) * f;
      const px = arc.cx + Math.cos(a) * arc.r;
      const py = arc.cy + Math.sin(a) * arc.r * 0.82;
      const delay = 0.36 + arc.delay + f * 0.16;

      // Dense sparks
      for (let k = 0; k < 2; k++) {
        const sa = a + R.range(-0.5, 0.5);
        const sv = R.range(80, 220);
        ps.spawn(
          P.SPARK,
          px,
          py,
          Math.cos(sa) * sv,
          Math.sin(sa) * sv - 20,
          R.range(0.18, 0.42),
          R.pick([WHITE, G[3], G[2], C[5]]),
          1,
          delay
        );
      }

      // Scorched brown-black smoke along outer edge
      if (i % 2 === 0) {
        ps.spawn(
          P.SMOKE,
          px - 4,
          py,
          R.range(-24, 18),
          R.range(-36, -10),
          R.range(0.5, 0.95),
          R.pick([S[2], S[1], S[0]]),
          R.range(4, 8),
          delay + 0.02
        );
      }
    }
  }

  // Enemy impact explosion: gilded sparks, shards, falling embers, dark ash smoke
  for (let i = 0; i < 42; i++) {
    const a = R.range(0, TAU);
    const v = R.range(130, 380);
    ps.spawn(
      P.SPARK,
      128 + R.range(-6, 6),
      -28 + R.range(-16, 16),
      Math.cos(a) * v,
      Math.sin(a) * v - 40,
      R.range(0.2, 0.55),
      R.pick([WHITE, G[3], G[2], C[4]]),
      1,
      HIT_T + R.range(0, 0.05)
    );
  }

  for (let i = 0; i < 12; i++) {
    const a = R.range(-Math.PI * 0.85, Math.PI * 0.25);
    const v = R.range(90, 240);
    bits.add({
      kind: B.SHARD,
      x: 128,
      y: -28 + R.range(-12, 12),
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 50,
      g: 0.75,
      drag: 0.65,
      bounce: 0.32,
      life: R.range(0.5, 0.9),
      a: R.range(0, TAU),
      va: R.range(-22, 22),
      s: R.range(2, 4),
      c: R.pick([G[3], G[2], C[5], C[3]]),
      delay: HIT_T,
    });
  }

  // Lingering falling golden embers & black-gray smoke
  for (let i = 0; i < 36; i++) {
    const px = R.range(70, 165);
    const py = R.range(-62, -6);
    ps.spawn(
      P.MOTE,
      px,
      py,
      R.range(-18, 22),
      R.range(12, 42),
      R.range(0.45, 0.85),
      R.pick([G[3], G[2], C[5]]),
      0.85,
      HIT_T + 0.12 + R.range(0, 0.25)
    );
  }

  for (let i = 0; i < 18; i++) {
    ps.spawn(
      P.SMOKE,
      R.range(88, 152),
      R.range(-52, -8),
      R.range(-14, 14),
      R.range(-28, -8),
      R.range(0.45, 0.85),
      R.pick([S[0], S[1], S[2]]),
      R.range(5, 10),
      HIT_T + 0.15 + R.range(0, 0.22)
    );
  }

  let t = 0;
  return {
    update(dt) {
      t += dt;
      ps.update(dt);
      bits.update(dt);
    },
    draw(p, layer) {
      if (layer === "back") {
        // Dark-red heat distortion waves during charge (0.0 .. 0.40s)
        if (t < 0.42) {
          const u = t / 0.42;
          const k = Math.sin(u * Math.PI);
          for (let i = 0; i < 3; i++) {
            const r = 14 + u * 34 + i * 9;
            const wave = Math.sin(t * 28 + i * 2.1) * 2;
            p.ring(34 + wave, -38, r, 1.5, C[2], 0.32 * k * (1 - i * 0.25));
            p.glow(34, -38, 28 + i * 10, C[1], 0.22 * k);
          }
        }

        // Lingering dark-crimson afterglow trails (0.56 .. 1.35s)
        if (t >= 0.56 && t < 1.35) {
          const u = (t - 0.56) / 0.79;
          const aFade = (1 - ease.outQuad(u)) * 0.85;
          for (const arc of ARCS) {
            for (let i = 0; i <= 32; i++) {
              const f = i / 32;
              const a = arc.a0 + (arc.a1 - arc.a0) * f;
              const jitter = Math.sin(t * 18 + f * 12 + arc.cy) * 1.2 * u;
              const px = arc.cx + Math.cos(a) * (arc.r + jitter);
              const py = arc.cy + Math.sin(a) * (arc.r + jitter) * 0.82;
              p.dot(px, py, u < 0.4 ? C[3] : C[2], aFade * Math.sin(f * Math.PI));
              if (i % 3 === 0) {
                p.glow(px, py, 6, C[2], aFade * 0.22);
              }
            }
          }
        }
        return;
      }

      // Front layer
      // 1. Three blinding white-gold glints (0.0 .. 0.38s)
      for (const g of GLINTS) {
        const gt = t - g.delay;
        if (gt >= 0 && gt < 0.34) {
          const gu = gt / 0.34;
          const pulse = gu < 0.35 ? ease.outBack(gu / 0.35) : 1 - smooth(0.35, 1, gu);
          const len = 10 * pulse + 3;
          flare(p, g.x, g.y, len * 1.4, pulse, G);
          p.glow(g.x, g.y, 16, G[3], 0.55 * pulse);
        }
      }

      // 2. Three parallel gilded-crimson crescent blades (0.36 .. 0.74s)
      for (const arc of ARCS) {
        const at = t - (0.36 + arc.delay);
        if (at >= 0 && at < 0.34) {
          drawCrescent(p, arc, at / 0.34, C, G, R);
        }
      }

      // 3. Enemy impact cross-slash flash (HIT_T .. HIT_T + 0.28s)
      if (t >= HIT_T && t < HIT_T + 0.28) {
        const iu = (t - HIT_T) / 0.28;
        const k = iu < 0.25 ? 1 : 1 - smooth(0.25, 1, iu);
        const len = 34 * (0.6 + 0.6 * ease.outCubic(iu));
        // Dramatic gold-crimson X cross flash
        for (const ang of [-0.68, 0.68]) {
          const dx = Math.cos(ang) * len;
          const dy = Math.sin(ang) * len;
          p.line(128 - dx, -28 - dy, 128 + dx, -28 + dy, iu < 0.15 ? WHITE : G[3], k);
          p.glowLine(128 - dx, -28 - dy, 128 + dx, -28 + dy, 7, C[4], 0.65 * k);
        }
        flare(p, 128, -28, 26 * k, k, C);
        p.ring(128, -28, 12 + iu * 44, 2.2 * k, C[4], 0.7 * k);
      }

      ps.draw(p);
      bits.draw(p);
    },
    done() {
      return t >= meta.duration;
    },
  };
}
