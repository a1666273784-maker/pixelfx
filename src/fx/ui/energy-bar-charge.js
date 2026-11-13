// UI purple-glow energy bar charging & mist overflow ("ui/energy-bar-charge"):
// 1. Release: Purplish-crimson and withered-yellow pixel micro-light motes drift in from all four directions
//    and converge into a heavy dark-grey segmented UI energy bar.
// 2. Hit / Injection: Motes inject into the deep-grey energy slot; segmented cells fill left-to-right in a
//    purplish-crimson highlight gradient, with bright white pixel light spots and tiny shaded pixel bubbles
//    fizzing along the advancing fill edge.
// 3. Full-Charge Climax: At 100% capacity, the entire dark-grey outer frame jolts with oppressive force and
//    radiates an outward shockwave halo of interwoven purplish-crimson and slate-cyan (daiqing) pixel rings.
// 4. Aftermath Result: A slowly undulating translucent grey-white mist light-film hovers across the bar's
//    surface while sporadic purplish-crimson pixel light motes drift upward and dissipate before folding out.
import { Particles, Lights, P, Rng, fit, sparkle, clamp, seg, smooth, lerp, ease, noise2, TAU, WHITE, hex, mix } from "../../core/index.js";
import { panel, shake } from "./_lib.js";

export const meta = {
  name: "Energy bar charge",
  desc: "Purple-crimson and withered-yellow motes converge into a dark-grey UI bar, filling it rightwards with a bubbling white edge, a purple-and-cyan frame shockwave, and mist.",
  tags: ["ui", "energy", "bar", "charge", "mist", "overflow", "purple", "hud", "one-shot"],
  size: [212, 100],
  origin: [106, 56],
  duration: 3.25,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#160414", "#34092a", "#5e1147", "#8f1b68", "#c42888", "#ec4ca8", "#ff94d0", "#ffffff"],
    amber: ["#2b210e", "#594319", "#8c6926", "#c49638", "#ebd47a"],
    cyan: ["#09171e", "#122c38", "#1d4959", "#2b6e82", "#48a3b8", "#8ce2f0"],
    mist: ["#4b4e5c", "#74798c", "#a3a9ba", "#cfd5e3", "#f0f4fa"],
    seed: 7,
  },
};

// Timing constants (seconds)
const T_OPEN = 0.12;
const T_INJECT = 0.34;
const T_FULL = 1.46;
const T_SHOCK_END = 2.08;
const T_FOLD = 2.92;
const T_END = 3.25;

// Dark-grey UI bar geometry in local space around (0, 0)
const FX = -66, FY = -10, FW = 132, FH = 20; // Heavy dark-grey outer frame
const BX = -48, BY = -5, BW = 106, BH = 10, CELLS = 8; // Recessed deep-grey energy slot
const SX = -57, SY = 0; // Left arcane intake socket

const INK = {
  outline: hex("#09080e"),
  rim: hex("#4e4b60"),
  top: hex("#302d3d"),
  body: hex("#211f2b"),
  low: hex("#15131c"),
  slot: hex("#0f0d16"),
  slotRim: hex("#1c1926"),
};

// Signed distance from the outer dark-grey frame's rounded rectangle
function frameDist(px, py, hw = FW / 2, hh = FH / 2, r = 4) {
  const dx = Math.abs(px) - (hw - r);
  const dy = Math.abs(py) - (hh - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

// Crisp 1px, 2x2 or 3x3 shaded pixel bubble near the advancing fill edge
function drawBubble(p, C, x, y, r, k) {
  const X = Math.round(x), Y = Math.round(y);
  const a = Math.min(1, k * 2.8);
  if (r < 1.05) {
    p.dot(X, Y, k > 0.45 ? WHITE : C[6], a);
    return;
  }
  if (r < 1.6) {
    // 2x2 shaded pixel bubble with dark lower-right rim and white specular pixel
    p.dot(X, Y, WHITE, a);
    p.dot(X + 1, Y, C[6], a);
    p.dot(X, Y + 1, C[5], a);
    p.dot(X + 1, Y + 1, C[1], a);
    p.glow(X + 0.5, Y + 0.5, 3, C[5], 0.22 * a);
    return;
  }
  // 3x3 hollow-rimmed pixel bubble with specular white highlight
  p.dot(X, Y - 1, C[6], a);
  p.dot(X + 1, Y, C[5], a);
  p.dot(X, Y + 1, C[2], a);
  p.dot(X - 1, Y, C[5], a);
  p.dot(X - 1, Y - 1, WHITE, a);
  p.dot(X + 1, Y + 1, C[1], a);
  p.blend(X, Y, C[4], 0.28 * a);
  p.glow(X, Y, 4, C[5], 0.28 * a);
}

export function create(o) {
  const C = fit(o.palette, 8);
  const Y = fit(o.amber, 5);
  const T = fit(o.cyan, 6);
  const M = fit(o.mist, 5);
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [WHITE, C[6], C[5], T[4], C[3]] });
  const lights = new Lights();
  const end = T_END - 0.06;

  // 1. Gathering motes from all 4 directions (quadrant-balanced so every frame in release shows all-around convergence)
  const motes = Array.from({ length: 24 }, (_, i) => {
    const isAmber = i % 2 === 1 && i % 5 !== 0; // ~42% withered-yellow, ~58% purple-crimson
    const baseAng = (i * 2.3999632) % TAU;
    const ang = baseAng + R.range(-0.14, 0.14);
    const rx = R.range(58, 92), ry = R.range(22, 40);
    const x0 = Math.cos(ang) * rx;
    const y0 = Math.sin(ang) * ry;
    const t0 = i < 12 ? 0.015 + i * 0.012 : 0.16 + ((i - 12) / 12) * 0.68 + R.range(0, 0.03);
    const dur = R.range(0.36, 0.5);
    return {
      isAmber,
      x0,
      y0,
      cx: x0 * 0.52 + R.range(-12, 12),
      cy: y0 * 0.92 + R.range(-10, 10),
      t0,
      dur,
      x: x0,
      y: y0,
      trail: [],
      done: false,
      sway: R.range(0, TAU),
      big: i % 2 === 0,
    };
  });

  // Fine bubbles fizzing at the advancing fill edge
  const bubbles = [];
  // Sporadic purple-crimson pixel light motes drifting upward during the mist aftermath
  const risers = [];

  let t = 0;
  let fullTriggered = false;
  let lastCell = 0;
  let cellFlash = 0;
  let socketPulse = 0;
  let riserAcc = 0;
  let bubbleAcc = 0;

  // Rightward fill progress 0..1 with organic surge steps as motes inject
  const fillAt = (time) => {
    if (time <= T_INJECT) return 0;
    if (time >= T_FULL) return 1;
    const u = (time - T_INJECT) / (T_FULL - T_INJECT);
    const base = ease.inOutSine(u);
    const surge = 0.016 * Math.sin(u * Math.PI * 8) * Math.sin(u * Math.PI);
    return clamp(base + surge, 0, 1);
  };

  return {
    update(dt) {
      t += dt;
      const fill = fillAt(t);
      const edgeX = BX + BW * fill;

      // Update converging motes
      for (const m of motes) {
        if (t < m.t0 || m.done) continue;
        const u = (t - m.t0) / m.dur;
        if (u >= 1) {
          m.done = true;
          socketPulse = 1;
          const tx = t < T_INJECT + 0.1 ? SX : Math.min(BX + BW - 2, BX + BW * fillAt(t));
          lights.add(tx, 0, 14, m.isAmber ? Y[3] : C[5], 0.26, 0.12);
          for (let k = 0; k < 2; k++) {
            const a = R.range(-1.3, 1.3), sp = R.range(22, 52);
            ps.spawn(P.SPARK, tx, R.range(-3, 3), Math.cos(a) * sp, Math.sin(a) * sp - 12, Math.min(R.range(0.09, 0.18), end - t));
          }
          continue;
        }
        const e = u < 0.32 ? (u / 0.32) * 0.16 : 0.16 + 0.84 * ease.inCubic((u - 0.32) / 0.68);
        const tx = t < T_INJECT + 0.08 ? SX : lerp(SX + 8, Math.max(BX + 6, edgeX), clamp((t - T_INJECT) / 0.38));
        const ty = Math.sin(m.sway + t * 8) * 2.2;
        const om = 1 - e;
        const wobX = Math.cos(t * 7 + m.sway) * 3 * (1 - e);
        const wobY = Math.sin(t * 8 + m.sway) * 2.5 * (1 - e);
        m.x = om * om * m.x0 + 2 * om * e * m.cx + e * e * tx + wobX;
        m.y = om * om * m.y0 + 2 * om * e * m.cy + e * e * ty + wobY;
        m.trail.unshift([m.x, m.y]);
        if (m.trail.length > 5) m.trail.pop();
      }

      // Cell divider crossing pulse
      const curCell = Math.floor(fill * CELLS);
      if (curCell > lastCell && t < T_FULL) {
        lastCell = curCell;
        cellFlash = 1;
        lights.add(edgeX, 0, 15, C[6], 0.32, 0.1);
      }
      cellFlash = Math.max(0, cellFlash - dt / 0.09);
      socketPulse = Math.max(0, socketPulse - dt / 0.14);

      // Spawn fine bubbles at and around the advancing fill edge
      if (t >= T_INJECT && t < T_FULL && fill > 0.02) {
        bubbleAcc += dt * 48;
        while (bubbleAcc >= 1) {
          bubbleAcc -= 1;
          const slot = bubbles.length % 3;
          bubbles.push({
            x: edgeX + (slot === 0 ? R.range(1, 6) : slot === 1 ? R.range(-5, 2) : -R.range(3, Math.min(16, BW * fill))),
            y: slot === 1 ? BY + R.range(-5, 0) : BY + R.range(0, BH - 1),
            vx: slot === 0 ? R.range(8, 24) : R.range(-10, 12),
            vy: -R.range(14, 28),
            r: slot === 0 ? 1.35 : R.chance(0.35) ? 1.8 : 1.25,
            age: 0,
            life: R.range(0.24, 0.42),
            wob: R.range(0, TAU),
          });
        }
      }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.age += dt;
        if (b.age >= b.life) {
          bubbles.splice(i, 1);
          continue;
        }
        b.x += (b.vx + Math.sin(t * 20 + b.wob) * 9) * dt;
        b.y += b.vy * dt;
      }

      // Full-charge climax at T_FULL: oppressive shockwave & burst + initial wave of rising purple-crimson motes
      if (!fullTriggered && t >= T_FULL) {
        fullTriggered = true;
        lights.add(0, 0, 84, C[5], 0.62, 0.4);
        lights.add(0, 0, 56, T[4], 0.56, 0.36);
        lights.add(0, 0, 36, WHITE, 0.55, 0.07);
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * TAU + R.range(-0.09, 0.09);
          const cx = Math.cos(a) * (FW / 2), cy = Math.sin(a) * (FH / 2);
          const sp = R.range(52, 125);
          ps.spawn(
            P.SPARK,
            cx,
            cy,
            Math.cos(a) * sp,
            Math.sin(a) * sp * 0.52,
            Math.min(R.range(0.16, 0.32), end - t),
          );
        }
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU + R.range(-0.12, 0.12);
          const isCyan = i % 2 === 0;
          ps.spawn(
            P.STAR,
            Math.cos(a) * 60,
            Math.sin(a) * 11,
            Math.cos(a) * R.range(32, 68),
            Math.sin(a) * R.range(16, 34),
            Math.min(R.range(0.24, 0.44), end - t),
            isCyan ? T[5] : C[6],
            i % 3 === 0 ? 1.3 : 0.7,
          );
        }
        // Seed initial rising purple-crimson motes so aftermath immediately shows upward-drifting particles
        for (let i = 0; i < 6; i++) {
          risers.push({
            x: BX + 8 + (i / 5) * (BW - 16) + R.range(-5, 5),
            y: BY + R.range(-3, 2),
            vx: R.range(-4, 4),
            vy: -R.range(18, 28),
            age: R.range(0, 0.14),
            life: Math.min(R.range(0.7, 1.08), end - t),
            c: R.pick([C[4], C[5], C[6]]),
            big: i % 2 === 0,
            ph: R.range(0, TAU),
          });
        }
      }

      // Aftermath: steady sporadic stream of purple-crimson pixel light motes drifting upward & dissipating
      if (t >= T_FULL + 0.04 && t < T_FOLD - 0.14) {
        riserAcc += dt * 13.5;
        while (riserAcc >= 1) {
          riserAcc -= 1;
          risers.push({
            x: R.range(BX + 4, BX + BW - 4),
            y: BY + R.range(-3, 2),
            vx: R.range(-5, 5),
            vy: -R.range(16, 28),
            age: 0,
            life: Math.min(R.range(0.65, 1.02), end - t),
            c: R.pick([C[4], C[5], C[6]]),
            big: R.chance(0.55),
            ph: R.range(0, TAU),
          });
        }
      }
      for (let i = risers.length - 1; i >= 0; i--) {
        const r = risers[i];
        r.age += dt;
        if (r.age >= r.life) {
          risers.splice(i, 1);
          continue;
        }
        r.x += (r.vx + Math.sin(t * 5.5 + r.ph) * 6.5) * dt;
        r.y += r.vy * dt;
      }

      ps.update(dt);
      lights.update(dt);
    },

    draw(p) {
      // Heavy oppressive frame shake on full charge
      const [sx, sy] = shake(t, 4.0, T_FULL, 0.34, o.seed, 38);
      const open = ease.outBack(seg(t, 0, T_OPEN), 1.8) * (1 - ease.inBack(seg(t, T_FOLD, T_END - 0.04), 1.8));
      const fill = fillAt(t);
      const heroWhite = t >= T_FULL && t < T_FULL + 0.05;

      // 1. Full-Charge Climax: Outer dark-grey frame radiates an interwoven Purple-Crimson & Slate-Cyan shockwave halo
      const sk = (t - T_FULL) / (T_SHOCK_END - T_FULL);
      if (sk > 0 && sk < 1) {
        const e1 = ease.outQuart(sk);
        const pad = 2.5 + 22 * e1;
        const padInner = 1 + 10 * ease.outCubic(clamp((sk - 0.04) / 0.85));
        const fade = 1 - smooth(0.5, 1, sk);
        const bx1 = Math.ceil(FW / 2 + pad + 6), by1 = Math.ceil(FH / 2 + pad + 6);

        p.each(-bx1 + sx, -by1 + sy, bx1 + sx, by1 + sy, (x, y, px, py) => {
          const lx = x - sx, ly = y - sy;
          const d = frameDist(lx, ly, FW / 2, FH / 2, 4);
          if (d < -0.5) return;

          // Two counter-weaving streams (Purple-Crimson & Slate-Cyan) around the outer frame contour
          const theta = Math.atan2(ly * 2.8, lx);
          const s = Math.sin(theta * 4 - sk * 11);
          const weave = s * 2.35;
          const dPurple = pad + weave;
          const dCyan = pad - weave;
          const bandW = Math.max(1.35, 2.25 * (1 - 0.32 * sk));

          const uP = 1 - Math.abs(d - dPurple) / bandW;
          const uC = 1 - Math.abs(d - dCyan) / bandW;

          if (uP > 0 || uC > 0) {
            let c, u;
            if (uP > 0.38 && uC > 0.38) {
              // Tight crossover glint node where Purple-Crimson and Slate-Cyan interlace
              u = Math.max(uP, uC);
              c = u > 0.72 ? WHITE : mix(C[6], T[5], 0.5);
            } else if (uP >= uC) {
              u = uP;
              c = sk < 0.06 && u > 0.78 ? WHITE : u > 0.62 ? C[6] : u > 0.32 ? C[5] : C[3];
            } else {
              u = uC;
              c = sk < 0.06 && u > 0.78 ? WHITE : u > 0.62 ? T[5] : u > 0.32 ? T[4] : T[2];
            }
            p.blendPx(px, py, c, fade * u * 0.95);
            if (u > 0.48) p.add(px, py, uP >= uC ? C[5] : T[4], fade * u * 0.3);
            return;
          }

          // Secondary inner oppressive echo ring around the frame
          const uIn = 1 - Math.abs(d - padInner) / 1.8;
          if (uIn > 0 && sk > 0.04) {
            const cIn = Math.cos(theta * 4 + sk * 9) > 0 ? T[4] : C[4];
            p.blendPx(px, py, cIn, fade * uIn * 0.78);
            return;
          }

          // Dark oppressive pressure field between the bar and outer wave right after full charge
          if (d > 0 && d < pad && sk < 0.45) {
            const pk = (1 - sk / 0.45) * (1 - d / pad) * 0.32;
            p.blendPx(px, py, s > 0 ? T[1] : C[1], pk);
          }
        });

        // Oppressive corner shock-chevrons & radial pressure ticks
        if (sk < 0.72) {
          const kRay = 1 - sk / 0.72;
          const anchors = [
            [-FW / 2, -FH / 2, -2.55], [FW / 2, -FH / 2, -0.59],
            [-FW / 2, FH / 2, 2.55], [FW / 2, FH / 2, 0.59],
            [-FW / 4, -FH / 2, -Math.PI / 2], [FW / 4, -FH / 2, -Math.PI / 2],
            [-FW / 4, FH / 2, Math.PI / 2], [FW / 4, FH / 2, Math.PI / 2],
            [-FW / 2, 0, Math.PI], [FW / 2, 0, 0],
          ];
          for (let i = 0; i < anchors.length; i++) {
            const [cx0, cy0, an] = anchors[i];
            const r0 = 2 + 12 * ease.outCubic(sk), r1 = r0 + (i < 4 ? 13 : 8) * kRay;
            const col = i % 2 === 0 ? C[5] : T[4];
            p.line(
              sx + cx0 + Math.cos(an) * r0,
              sy + cy0 + Math.sin(an) * r0 * 0.72,
              sx + cx0 + Math.cos(an) * r1,
              sy + cy0 + Math.sin(an) * r1 * 0.72,
              (u) => (u < 0.35 ? WHITE : col),
              kRay,
            );
          }
        }
      }

      // 2. Dark-grey UI Energy Bar Frame & Segmented Slot
      if (open > 0.04) {
        const fh = Math.max(4, Math.round(FH * open));
        const fy = Math.round(-fh / 2) + sy;
        const fx = FX + sx;

        // Outer dark-grey plate: flashes cyan-rimmed & purple-lit on full charge
        const frameCol = heroWhite
          ? { outline: T[2], rim: WHITE, top: T[4], body: C[3], low: T[1] }
          : sk > 0 && sk < 0.4
            ? { ...INK, outline: T[1], rim: mix(INK.rim, T[4], 0.55 * (1 - sk / 0.4)) }
            : INK;
        panel(p, fx, fy, FW, fh, frameCol, { r: Math.min(4, fh / 2) });

        if (open > 0.75) {
          // Heavy reinforced dark-grey corner clasps
          const brCol = heroWhite ? WHITE : sk > 0 && sk < 0.45 ? T[4] : hex("#5e5a73");
          for (const dx of [-1, 1]) {
            for (const dy of [-1, 1]) {
              const cx = sx + dx * (FW / 2 - 2), cy = sy + dy * (FH / 2 - 1);
              p.px(cx, cy, brCol);
              p.px(cx - dx, cy, brCol);
              p.px(cx - dx * 2, cy, INK.rim);
              p.px(cx, cy - dy, INK.rim);
            }
          }

          // Left arcane intake socket
          const scx = SX + sx, scy = SY + sy;
          p.circle(scx, scy, 5, INK.outline);
          p.circle(scx, scy, 4, INK.slot);
          const coreLit = clamp(socketPulse + (fill > 0 ? 0.45 + 0.45 * fill : 0) + (heroWhite ? 1 : 0), 0, 1);
          if (coreLit > 0.05) {
            p.circle(scx, scy, 3, coreLit > 0.7 ? C[5] : C[3]);
            p.circle(scx - 0.5, scy - 0.5, 1.5, heroWhite || coreLit > 0.85 ? WHITE : C[6]);
            p.glow(scx, scy, 9 + 5 * socketPulse, C[5], 0.3 * coreLit);
          } else {
            p.ring(scx, scy, 3.5, 1, INK.rim);
          }

          // Inner recessed deep-grey energy slot
          const bx = BX + sx, by = BY + sy;
          p.rect(bx - 1, by - 1, BW + 2, BH + 2, INK.outline);
          p.rect(bx, by, BW, BH, INK.slot);
          p.line(bx, by, bx + BW - 1, by, INK.slotRim);

          // Purplish-crimson rightward gradient highlight fill
          const fillPx = Math.round(BW * fill);
          const settle = smooth(T_FULL + 0.08, T_FULL + 0.35, t);
          if (fillPx > 0) {
            p.shade(bx, by, bx + fillPx, by + BH, (x, y) => {
              const u = (x - bx) / BW; // 0 left .. 1 right of bar
              const rel = (x - bx) / Math.max(1, fillPx); // 0 left .. 1 advancing edge
              const v = y - by; // 0 top .. BH bottom
              if (heroWhite) return v < 1 || v > BH - 2 ? C[5] : v < 3 ? WHITE : C[6];

              // Left-to-right purple-crimson gradient; after full charge settles slightly so grey-white mist film contrasts clearly
              const g = (u * 0.55 + rel * 0.45) * (1 - 0.22 * settle);
              if (v < 1) return g > 0.74 ? WHITE : g > 0.36 ? C[6] : C[5];
              if (v < 2.2) return g > 0.78 ? C[6] : g > 0.4 ? C[5] : C[4];
              if (v < BH - 2.2) {
                return g > 0.84 ? C[6] : g > 0.56 ? C[5] : g > 0.26 ? C[4] : C[3];
              }
              if (v < BH - 1) return g > 0.65 ? C[4] : g > 0.3 ? C[3] : C[2];
              return g > 0.5 ? C[2] : C[1];
            });

            p.glowLine(bx + 2, by + BH / 2, bx + fillPx, by + BH / 2, 10, C[4], (0.22 + 0.14 * fill) * (1 - 0.2 * settle));
          }

          // Segmented cell dividers across the deep-grey slot
          for (let i = 1; i < CELLS; i++) {
            const cx = bx + Math.round((BW * i) / CELLS);
            const crossed = fill >= i / CELLS;
            const justCrossed = Math.abs(fill - i / CELLS) < 0.042 && t < T_FULL;
            p.rect(cx, by, 1, BH, justCrossed ? WHITE : crossed ? C[1] : INK.outline);
            if (crossed && !heroWhite) {
              p.px(cx, by, C[5]);
              p.px(cx, by + 1, C[4]);
            }
          }

          // Advancing fill edge: bright white pixel light spots + fine pixel bubbles
          if (fill > 0.01 && fill < 0.999 && t < T_FULL) {
            const ex = bx + fillPx;
            const f30 = Math.floor(t * 30);
            // White-hot leading crest & distinct white pixel light spots (高亮白色的像素光斑)
            p.rect(ex - 1, by, 2, BH, WHITE);
            if (fillPx > 2) p.rect(ex - 3, by + 1, 2, BH - 2, C[6]);
            p.px(ex - 2, by + 1 + ((f30 * 3) % (BH - 2)), WHITE);
            p.px(ex + 1, by + 2 + ((f30 * 5) % (BH - 4)), WHITE);
            p.px(ex, by - 1, WHITE);
            p.px(ex - 1, by + BH, C[6]);
            sparkle(p, ex, by + 2 + Math.sin(t * 26) * 2, 2 + cellFlash, WHITE, C[6], 0.38);
            p.glow(ex, by + BH / 2, 10, WHITE, 0.38);
            p.glow(ex, by + BH / 2, 18, C[5], 0.36);

            // Deterministic companion micro-bubbles hugging the advancing meniscus so every frame shows crisp bubbles
            for (let bIdx = 0; bIdx < 3; bIdx++) {
              const ph = ((t * 4.5 + bIdx * 0.37) % 1);
              const bxOff = bIdx === 0 ? 3 + ph * 3 : bIdx === 1 ? -4 - ph * 5 : -1 - ph * 3;
              const byOff = bIdx === 0 ? 2 - ph * 6 : bIdx === 1 ? 6 - ph * 7 : -1 - ph * 5;
              drawBubble(p, C, ex + bxOff, by + byOff, bIdx === 2 ? 1.7 : 1.3, 1 - ph * 0.7);
            }
          }

          // Draw simulated fine shaded pixel bubbles inside and fizzing off the fill edge
          for (const b of bubbles) {
            drawBubble(p, C, b.x + sx, b.y + sy, b.r, 1 - b.age / b.life);
          }

          // 3. Aftermath Result: Slowly undulating translucent grey-white thin mist light-film directly over the bar surface
          if (t >= T_FULL) {
            const mistEnv = smooth(T_FULL + 0.03, T_FULL + 0.26, t) * (1 - smooth(T_FOLD - 0.08, T_FOLD + 0.14, t));
            if (mistEnv > 0.01) {
              const mt = t - T_FULL;
              for (let ix = -2; ix <= BW + 2; ix++) {
                const px = bx + ix;
                const u = ix / BW;
                const edgeFade = smooth(-2, 7, ix) * (1 - smooth(BW - 7, BW + 2, ix));
                // Gentle undulating top crest overflowing 1..2 px above the bar top rim
                const crestY = by - 1.6 + Math.sin(u * TAU * 2.2 - mt * 3.4) * 1.3 + Math.cos(u * TAU * 3.6 + mt * 2.1) * 0.6;
                // Undulating lower veil boundary draping across the upper-to-middle bar surface
                const botY = by + 7.2 + Math.sin(u * TAU * 1.8 + mt * 2.7 + 1.1) * 1.4;
                // Internal secondary ripple crest inside the mist film
                const rippleY = by + 3.0 + Math.cos(u * TAU * 2.8 - mt * 3.0) * 1.2;

                const y0 = Math.floor(crestY), y1 = Math.ceil(botY);
                for (let py = y0; py <= y1; py++) {
                  const depth = (py - crestY) / Math.max(1, botY - crestY);
                  if (depth < 0 || depth > 1) continue;
                  const n = noise2(ix * 0.15 + mt * 2.0, py * 0.28 - mt * 1.2, o.seed);
                  const isTopCrest = py - crestY < 1.25;
                  const isInnerCrest = Math.abs(py - rippleY) < 0.85;
                  const col = isTopCrest ? M[4] : isInnerCrest ? M[4] : depth < 0.55 ? M[3] : M[2];
                  const baseA = isTopCrest ? 0.66 : isInnerCrest ? 0.48 : 0.3 * (1 - depth * 0.4);
                  const alpha = mistEnv * edgeFade * baseA * (0.82 + 0.18 * n);
                  p.blend(px, py, col, alpha);
                  if (isTopCrest && (ix & 1) === 0) p.light(px, py, M[4], 0.15 * mistEnv * edgeFade);
                }
              }
              p.glowLine(bx + 6, by + 1, bx + BW - 6, by + 1, 8, M[3], 0.18 * mistEnv);
            }
          }
        }
      }

      // 4. Gathering motes (purplish-crimson & withered-yellow) converging from all 4 directions
      for (const m of motes) {
        if (t < m.t0 || m.done) continue;
        const u = (t - m.t0) / m.dur;
        const fade = Math.min(1, u * 6);
        const headCol = m.isAmber ? Y[4] : C[6];
        const midCol = m.isAmber ? Y[3] : C[5];
        const tailCol = m.isAmber ? Y[2] : C[3];
        for (let i = 1; i < m.trail.length; i++) {
          const [x0, y0] = m.trail[i - 1], [x1, y1] = m.trail[i];
          p.line(x0, y0, x1, y1, i < 2 ? midCol : tailCol, fade * (1 - i / m.trail.length));
        }
        p.px(m.x, m.y, m.isAmber ? Y[4] : WHITE);
        if (m.big) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            p.dot(m.x + dx, m.y + dy, headCol, 0.88 * fade);
          }
        } else {
          p.px(m.x - 1, m.y, headCol);
          p.px(m.x, m.y + 1, midCol);
        }
        p.glow(m.x, m.y, m.big ? 6 : 4.5, midCol, 0.45 * fade);
      }

      // 5. Sporadic purplish-crimson pixel light motes drifting upward and dissipating in aftermath
      for (const r of risers) {
        const k = 1 - r.age / r.life;
        const tw = 0.75 + 0.25 * Math.sin(t * 14 + r.ph);
        const a = Math.min(1, r.age / 0.06) * Math.min(1, k * 1.7) * tw;
        if (a <= 0.05) continue;
        const X = Math.round(r.x), Y = Math.round(r.y);
        p.dot(X, Y, k > 0.65 ? WHITE : C[6], a);
        if (r.big && k > 0.25) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            p.dot(X + dx, Y + dy, r.c, a * 0.82);
          }
        } else {
          p.dot(X, Y + 1, r.c, a * 0.9);
          p.dot(X, Y + 2, C[3], a * 0.6);
        }
        p.glow(X, Y, 5.5, r.c, 0.48 * a);
      }

      ps.draw(p);
      lights.draw(p);
    },
  };
}
