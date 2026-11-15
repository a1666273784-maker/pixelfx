// UI acquisition toast snow-flurry unfold & light-dust resonance ("ui/acquire-toast-unfold"):
// 1. Release: A bright pure-white vertical pixel hairline ignites at the center of the screen, surrounded by
//    rapidly orbiting withered-yellow light particles.
// 2. Hit & Snow Unfold: The white vertical line pulls apart left and right into a dark UI region framed by a
//    pale ash-grey border; at the instant of unfolding, a 4-directional flurry of spinning snowflakes and
//    ice-cyan/cloud-white snow crystals bursts outward and fills the canvas with multi-depth falling snow.
// 3. UI Frame Formation Climax: As the UI frame locks into full width, all four corners simultaneously light up
//    with oppressive geometric pixel flashes of withered-yellow and coral-red.
// 4. Aftermath Result: Three depth layers of pixel snow (far specks, drifting flakes, and spinning six-armed
//    crystals) fall gently across the frame and inside the dark UI box while faint warm-gold pixel fluorescent
//    particles continuously rise from the bottom before folding out.
import { Particles, Lights, P, Rng, fit, clamp, seg, smooth, ease, noise2, TAU, WHITE } from "../../core/index.js";
import { flakeDesign, snowflake } from "../ice/_lib.js";
import { shake } from "./_lib.js";

export const meta = {
  name: "Acquire toast unfold",
  desc: "A central white line ringed by spinning amber motes pulls open into an ash-grey UI frame, bursting into falling snow crystals, corner geometric flashes, and rising gold dust.",
  tags: ["ui", "toast", "acquire", "unfold", "snow", "snowflake", "banner", "hud", "one-shot"],
  size: [240, 132],
  origin: [120, 66],
  duration: 3.45,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    // 枯黄色 / 暖金色 (Withered-yellow & warm-gold ramp)
    palette: ["#211706", "#45300d", "#735017", "#a67522", "#d49c35", "#f2c65a", "#fae49b", "#ffffff"],
    // 珊瑚红色 (Coral-red ramp for 4-corner geometric flashes)
    coral: ["#26070c", "#54101a", "#8f1b2a", "#cc2b3d", "#f5515c", "#ff8589", "#ffc2c2"],
    // 黛青色 -> 云白色冰雪 (Ice-cyan to snow-white ramp for falling snow & snowflakes)
    ink: ["#08151c", "#112833", "#1c4152", "#2d647a", "#4b8fa6", "#7ec0d1", "#c2ebf2", "#f2fcff"],
    // 苍灰色边框 & 深色UI底盘 (Dark UI backing & pale ash-grey border ramp)
    ash: ["#0b0e14", "#131822", "#252d3d", "#4c566b", "#8a95ab", "#bcc6d9", "#e4ebf5"],
    seed: 13,
  },
};

// Timing constants (seconds)
const T_OPEN = 0.56; // Central white line pulls apart left & right; snow flurry & snowfall begin
const T_LOCK = 1.06; // UI frame locks into full width; 4 corners flash with geometric withered-yellow & coral-red
const T_FOLD = 3.08; // UI frame begins folding out
const T_END = 3.45;

// UI Toast box half-dimensions: full box is 136 x 42 px (-68..68, -21..21)
const HW = 68, HH = 21;

export function create(o) {
  const G = fit(o.palette, 8); // Withered-yellow / warm-gold (枯黄色 / 暖金色)
  const C = fit(o.coral, 7); // Coral-red (珊瑚红色)
  const I = fit(o.ink, 8); // Ice-cyan to snow-white (黛青色 -> 云白雪花)
  const A = fit(o.ash, 7); // Dark UI region & pale ash-grey border (深色UI区域 / 苍灰色边框)
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, sparks: [WHITE, G[5], C[5], I[6]] });
  const lights = new Lights();
  const end = T_END - 0.06;

  // Phase 1: Rapidly orbiting withered-yellow light particles around the central vertical white line
  const orbitMotes = Array.from({ length: 20 }, (_, i) => ({
    a0: (i / 20) * TAU,
    rx: R.range(9, 25),
    y0: R.range(-HH - 2, HH + 2),
    vy: R.range(-14, 14),
    sp: R.range(10.5, 15.5),
    big: i % 3 === 0,
  }));

  // Phase 2: 4-directional snow flurry crystals & flakes bursting outward on unfold, then transitioning into falling snow
  const burstFlakes = [];
  // Phase 2..4: Ambient multi-depth falling snow across the canvas & inside the UI box
  const snowFlakes = [];
  // Phase 4: Faint warm-gold pixel fluorescent particles rising from the bottom of the UI box
  const goldFluors = [];

  let t = 0;
  let opened = false;
  let locked = false;
  let snowAcc = 0;
  let fluorAcc = 0;

  // Half-width of the unfolding UI box at time t
  const hwAt = (time) => {
    if (time < T_OPEN) return 0;
    if (time < T_LOCK) {
      const u = (time - T_OPEN) / (T_LOCK - T_OPEN);
      return Math.round(HW * ease.outCubic(u));
    }
    if (time < T_FOLD) return HW;
    const u = clamp((time - T_FOLD) / (T_END - 0.04 - T_FOLD));
    return Math.round(HW * (1 - ease.inCubic(u)));
  };

  return {
    update(dt) {
      t += dt;

      // Trigger 4-way snow-flurry burst + seed initial falling snow across the canvas when the white line pulls apart
      if (!opened && t >= T_OPEN) {
        opened = true;
        lights.add(0, 0, 82, I[6], 0.65, 0.4);
        lights.add(0, 0, 40, WHITE, 0.78, 0.1);

        // 1) 4-directional burst of spinning six-armed snowflakes & crisp snow crystals erupting outward
        for (let i = 0; i < 40; i++) {
          const dir = i % 4; // 0: left, 1: right, 2: top, 3: bottom
          let x, y, vx, vy;
          if (dir < 2) {
            const s = dir === 0 ? -1 : 1;
            x = s * R.range(4, 18);
            y = R.range(-HH, HH);
            vx = s * R.range(78, 165);
            vy = (y / HH) * R.range(18, 44) + R.range(-15, 18);
          } else {
            const s = dir === 2 ? -1 : 1;
            x = R.range(-HW * 0.7, HW * 0.7);
            y = s * R.range(3, 12);
            vx = (x / HW) * R.range(42, 95) + R.range(-18, 18);
            vy = s * R.range(48, 102);
          }
          const tier = i % 5 === 0 ? 2 : i % 2 === 0 ? 1 : 0; // 2: 6-arm crystal, 1: plus-flake, 0: snow speck
          burstFlakes.push({
            x,
            y,
            vx,
            vy,
            r: tier === 2 ? R.range(3.6, 5.8) : tier === 1 ? 2.0 : 1.0,
            rot: R.range(0, TAU),
            vrot: R.sign() * R.range(4, 9),
            design: tier === 2 ? flakeDesign(R) : null,
            tier,
            age: 0,
            life: Math.min(R.range(0.65, 1.35), end - t),
            ph: R.range(0, TAU),
            isWhite: i % 3 === 0,
          });
        }

        // 2) Seed initial multi-depth falling snow across the canvas and inside the UI box
        for (let i = 0; i < 42; i++) {
          const depth = i % 7 === 0 ? 2 : i % 2 === 0 ? 1 : 0;
          snowFlakes.push({
            x: R.range(-106, 106),
            y: R.range(-56, 36),
            vx: R.range(4, 12),
            vy: depth === 2 ? R.range(24, 36) : depth === 1 ? R.range(17, 27) : R.range(11, 19),
            swayAmp: depth === 2 ? R.range(8, 14) : depth === 1 ? R.range(5, 9) : R.range(2, 5),
            swayFreq: R.range(2.8, 4.8),
            r: depth === 2 ? R.range(3.2, 4.8) : depth === 1 ? 1.8 : 1.0,
            rot: R.range(0, TAU),
            vrot: R.sign() * R.range(2.2, 4.8),
            design: depth === 2 ? flakeDesign(R) : null,
            depth,
            inside: R.chance(0.45),
            age: 0,
            life: Math.min(R.range(1.1, 2.2), end - t),
            ph: R.range(0, TAU),
          });
        }
      }

      // Continuously spawn multi-depth falling snow across the frame and inside the UI box
      if (t >= 0.08 && t < T_FOLD - 0.16) {
        const rate = t < T_OPEN ? 20 : 44;
        snowAcc += dt * rate;
        while (snowAcc >= 1) {
          snowAcc -= 1;
          const inside = t >= T_OPEN && R.chance(0.38);
          const depth = R.chance(0.18) ? 2 : R.chance(0.54) ? 1 : 0;
          snowFlakes.push({
            x: inside ? R.range(-HW + 5, HW - 5) : R.range(-104, 104),
            y: inside ? R.range(-HH + 2, -HH + 8) : R.range(-56, 12),
            vx: R.range(3, 10),
            vy: depth === 2 ? R.range(30, 44) : depth === 1 ? R.range(24, 34) : R.range(18, 28),
            swayAmp: depth === 2 ? R.range(7, 13) : depth === 1 ? R.range(4, 8) : R.range(2, 5),
            swayFreq: R.range(2.8, 4.8),
            r: depth === 2 ? R.range(3.0, 4.6) : depth === 1 ? 1.8 : 1.0,
            rot: R.range(0, TAU),
            vrot: R.sign() * R.range(2.2, 4.8),
            design: depth === 2 ? flakeDesign(R) : null,
            depth,
            inside,
            age: 0,
            life: Math.min(inside ? R.range(1.1, 1.8) : R.range(1.8, 2.8), end - t),
            ph: R.range(0, TAU),
          });
        }
      }

      // Trigger 4-corner geometric flash climax when the UI frame locks at T_LOCK
      if (!locked && t >= T_LOCK) {
        locked = true;
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            const cx = sx * HW, cy = sy * HH;
            lights.add(cx, cy, 46, G[5], 0.72, 0.4);
            lights.add(cx + sx * 3, cy + sy * 3, 36, C[5], 0.65, 0.36);
            lights.add(cx, cy, 22, WHITE, 0.82, 0.08);
            for (let k = 0; k < 6; k++) {
              const a = Math.atan2(sy, sx) + R.range(-0.95, 0.95);
              const sp = R.range(38, 88);
              ps.spawn(
                P.SPARK,
                cx,
                cy,
                Math.cos(a) * sp,
                Math.sin(a) * sp,
                Math.min(R.range(0.2, 0.38), end - t),
              );
            }
          }
        }
      }

      // Update burst snowflakes (decelerate from outward burst into gentle downward snowfall)
      for (let i = burstFlakes.length - 1; i >= 0; i--) {
        const f = burstFlakes[i];
        f.age += dt;
        f.vx -= f.vx * 3.2 * dt;
        f.vy = f.vy * (1 - 2.8 * dt) + 22 * dt; // Gravity pulls them into falling snow
        f.x += (f.vx + Math.sin(t * 4.5 + f.ph) * 6) * dt;
        f.y += f.vy * dt;
        f.rot += f.vrot * dt;
        if (f.age >= f.life || Math.abs(f.x) > 108 || f.y > 52 || f.y < -56) {
          burstFlakes.splice(i, 1);
        }
      }

      // Update ambient falling snowflakes
      for (let i = snowFlakes.length - 1; i >= 0; i--) {
        const s = snowFlakes[i];
        s.age += dt;
        s.x += (s.vx + Math.sin(t * s.swayFreq + s.ph) * s.swayAmp) * dt;
        s.y += s.vy * dt;
        s.rot += s.vrot * dt;
        if (s.age >= s.life || Math.abs(s.x) > 108 || s.y > 52 || s.y < -58) {
          snowFlakes.splice(i, 1);
        }
      }

      // Phase 4: Faint warm-gold pixel fluorescent particles rising continuously from the bottom of the UI box
      if (t >= T_LOCK - 0.14 && t < T_FOLD - 0.14) {
        fluorAcc += dt * 32;
        while (fluorAcc >= 1) {
          fluorAcc -= 1;
          goldFluors.push({
            x: R.range(-HW + 5, HW - 5),
            y: HH - R.range(1, 5),
            vx: R.range(-4.5, 4.5),
            vy: -R.range(15, 27),
            age: 0,
            life: Math.min(R.range(0.85, 1.45), end - t),
            c: R.pick([G[4], G[5], G[6]]),
            big: R.chance(0.44),
            ph: R.range(0, TAU),
          });
        }
      }

      for (let i = goldFluors.length - 1; i >= 0; i--) {
        const f = goldFluors[i];
        f.age += dt;
        if (f.age >= f.life) {
          goldFluors.splice(i, 1);
          continue;
        }
        f.x += (f.vx + Math.sin(t * 5.2 + f.ph) * 4.5) * dt;
        f.y += f.vy * dt;
      }

      ps.update(dt);
      lights.update(dt);
    },

    draw(p) {
      // Oppressive shake when the UI box locks into shape at T_LOCK
      const [sx, sy] = shake(t, 4.2, T_LOCK, 0.36, o.seed, 38);
      const fadeOut = 1 - ease.inCubic(seg(t, T_FOLD, T_END - 0.04));
      if (fadeOut <= 0.01) return;

      const curHW = hwAt(t);

      // Helper to draw a single snowflake at depth tier (0: speck, 1: plus/cluster flake, 2: 6-armed snowflake)
      const drawFlake = (fx, fy, tier, r, rot, design, alpha, isWhite = false) => {
        if (alpha <= 0.04) return;
        const X = Math.round(fx), Y = Math.round(fy);
        if (tier === 2 && design) {
          snowflake(p, X, Y, r, rot, design, I, { a: alpha, hot: isWhite ? 0.55 : 0.2 });
        } else if (tier === 1) {
          p.dot(X, Y, WHITE, alpha);
          const pose = Math.floor(rot * 2) & 1;
          const arms = pose ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 1], [-1, -1], [1, -1], [-1, 1]];
          for (const [dx, dy] of arms) {
            p.dot(X + dx, Y + dy, isWhite ? I[7] : I[6], alpha * 0.85);
          }
          p.light(X, Y, I[6], 0.32 * alpha);
        } else {
          p.dot(X, Y, isWhite ? I[7] : I[5], alpha * 0.9);
          p.dot(X + 1, Y, I[4], alpha * 0.55);
        }
      };

      // 1. Background / Outer Falling Snow (far & mid layers behind the UI toast)
      for (const s of snowFlakes) {
        if (s.inside) continue;
        const k = 1 - s.age / s.life;
        const a = Math.min(1, s.age / 0.08) * Math.min(1, k * 1.6) * fadeOut;
        drawFlake(s.x + sx, s.y + sy, s.depth, s.r, s.rot, s.design, a, s.depth >= 1);
      }

      // 2. Unfolding Dark UI Region with Pale Ash-Grey Border, Interior Snowfall & Top Snow-Frost Drift
      if (t >= T_OPEN && curHW >= 1) {
        const x0 = -curHW + sx, x1 = curHW + sx;
        const y0 = -HH + sy, y1 = HH + sy;
        const lockFlash = t >= T_LOCK && t < T_LOCK + 0.07;

        // Dark UI region backing (深色UI区域 A[0]..A[1])
        p.rect(x0 - 1, y0 - 1, curHW * 2 + 2, HH * 2 + 2, A[0], fadeOut);
        p.rect(x0, y0, curHW * 2, HH * 2, A[1], fadeOut);

        // Subtle cold winter night frost gradient & central acquisition emblem inside the dark UI box
        if (curHW > 6) {
          p.each(x0 + 2, y0 + 2, x1 - 2, y1 - 2, (x, y, px, py) => {
            const lx = x - sx, ly = y - sy;
            // Soft frosty rim glow near the top & bottom inside edges of the UI box
            const frostEdge = Math.max(0, 1 - (ly + HH) / 9) * 0.35 + Math.max(0, 1 - (HH - ly) / 8) * 0.22;
            if (frostEdge > 0.06) {
              p.blendPx(px, py, I[2], frostEdge * fadeOut);
            }
          });

          if (curHW > 28) {
            const innerAlpha = clamp((curHW - 28) / 36) * 0.62 * fadeOut;
            const ruleW = Math.min(curHW - 14, 46);
            p.line(-ruleW + sx, sy + 7, ruleW + sx, sy + 7, A[3], innerAlpha * 0.7);
            for (let d = -5; d <= 5; d++) {
              const s = 5 - Math.abs(d);
              p.dot(sx - s, sy - 4 + d, G[3], innerAlpha);
              p.dot(sx + s, sy - 4 + d, G[3], innerAlpha);
            }
            p.dot(sx, sy - 4, G[5], innerAlpha);
          }

          // Interior Falling Snow (clipped cleanly inside the dark UI region)
          for (const s of snowFlakes) {
            if (!s.inside) continue;
            if (Math.abs(s.x) > curHW - 3 || s.y < -HH + 3 || s.y > HH - 3) continue;
            const k = 1 - s.age / s.life;
            const a = Math.min(1, s.age / 0.08) * Math.min(1, k * 1.6) * 0.88 * fadeOut;
            drawFlake(s.x + sx, s.y + sy, s.depth === 2 ? 1 : s.depth, Math.min(2.6, s.r), s.rot, s.design, a, false);
          }
        }

        // Pale ash-grey UI border (苍灰色边框 A[4]..A[6])
        const bTop = lockFlash ? WHITE : A[6];
        const bMain = lockFlash ? A[6] : A[5];
        const bIn = A[3];
        p.rect(x0, y0, curHW * 2, 1, bTop, fadeOut);
        p.rect(x0, y1 - 1, curHW * 2, 1, bMain, fadeOut);
        p.rect(x0, y0, 1, HH * 2, bMain, fadeOut);
        p.rect(x1 - 1, y0, 1, HH * 2, bMain, fadeOut);
        if (curHW > 3) {
          p.rect(x0 + 2, y0 + 2, curHW * 2 - 4, 1, bIn, 0.75 * fadeOut);
          p.rect(x0 + 2, y1 - 3, curHW * 2 - 4, 1, bIn, 0.75 * fadeOut);
        }

        // Sparkling snow-drift crust settling along the top border of the UI box
        if (curHW > 12) {
          const driftK = clamp((t - T_OPEN) / 0.5) * fadeOut;
          for (let lx = -curHW + 5; lx <= curHW - 5; lx++) {
            const hSnow = noise2(lx * 0.14, o.seed + 71) * 0.5 + 0.5;
            if (hSnow > 0.36) {
              p.dot(lx + sx, y0 - 1, hSnow > 0.65 ? WHITE : I[7], driftK * 0.92);
              if (hSnow > 0.72) p.dot(lx + sx, y0 - 2, WHITE, driftK * 0.85);
            }
          }
        }

        // While pulling apart (T_OPEN .. T_LOCK), the two vertical white leading edges glow brightly
        if (t < T_LOCK + 0.08) {
          const edgeK = 1 - smooth(T_LOCK - 0.04, T_LOCK + 0.08, t);
          for (const dir of [-1, 1]) {
            const ex = dir * curHW + sx;
            p.rect(ex - (dir > 0 ? 1 : 0), y0 - 1, 2, HH * 2 + 2, WHITE, edgeK);
            p.glow(ex, sy, 14, I[6], 0.55 * edgeK);
          }
        }
      }

      // 3. Phase 2: 4-Directional Snow-Flurry Burst (spinning six-armed snowflakes & crystals erupting outward)
      for (const f of burstFlakes) {
        const k = 1 - f.age / f.life;
        const a = Math.min(1, f.age / 0.03) * Math.min(1, k * 1.45) * fadeOut;
        drawFlake(f.x + sx, f.y + sy, f.tier, f.r, f.rot, f.design, a, f.isWhite);
      }

      // 4. Phase 1 (Release): Central Bright Pure-White Vertical Pixel Line & Orbiting Withered-Yellow Motes
      if (t < T_OPEN + 0.1) {
        const lineIn = ease.outCubic(seg(t, 0, 0.15));
        const lineOut = 1 - smooth(T_OPEN - 0.02, T_OPEN + 0.09, t);
        const lk = lineIn * lineOut;
        const hLine = Math.round((HH + 4) * lineIn);

        // Orbiting withered-yellow light particles (四周环绕着快速旋转的枯黄色光粒)
        for (let i = 0; i < orbitMotes.length; i++) {
          const m = orbitMotes[i];
          const pull = 1 - 0.32 * ease.inCubic(clamp((t - 0.35) / 0.22));
          const a = m.a0 + t * m.sp;
          const rx = m.rx * pull;
          const mx = Math.cos(a) * rx + sx;
          const my = ((m.y0 + m.vy * t + HH * 3) % (HH * 2)) - HH + sy;
          const z = Math.sin(a);
          const alpha = (0.64 + 0.36 * (z * 0.5 + 0.5)) * lk;

          for (let s = 1; s <= 3; s++) {
            const aPrev = a - s * 0.18;
            const tx = Math.cos(aPrev) * rx + sx;
            const ty = my - Math.sin(a - aPrev) * 1.5;
            p.dot(tx, ty, s === 1 ? G[5] : G[3], alpha * (1 - s * 0.26));
          }
          const headCol = z > 0.38 ? WHITE : G[6];
          p.dot(mx, my, headCol, alpha);
          if (m.big) {
            p.dot(mx + 1, my, G[5], alpha * 0.85);
            p.dot(mx, my + 1, G[4], alpha * 0.85);
          }
          p.glow(mx, my, 4.5, G[5], 0.44 * alpha);
        }

        // Central pure-white vertical pixel thin line (画面中央出现一条高亮纯白色的垂直像素细线)
        if (hLine > 1) {
          p.glow(sx, sy, 18 * lk, G[5], 0.42 * lk);
          p.glow(sx, sy, 10 * lk, WHITE, 0.68 * lk);
          const midH = Math.round(hLine * 0.65);
          p.rect(sx - 1, sy - midH, 3, midH * 2, G[6], 0.42 * lk);
          p.rect(sx, sy - hLine, 1, hLine * 2 + 1, WHITE, lk);
          if (t > 0.34) p.rect(sx - 1, sy - hLine + 2, 2, hLine * 2 - 3, WHITE, lk * 0.9);
          for (const dy of [-hLine, 0, hLine]) {
            p.dot(sx - 1, sy + dy, WHITE, lk);
            p.dot(sx + 1, sy + dy, WHITE, lk);
          }
        }
      }

      // 5. Phase 3: 4-Corner Withered-Yellow (枯黄色) & Coral-Red (珊瑚红色) Geometric Pixel Flashes
      // (UI框四个边角同时亮起枯黄色与珊瑚红色的几何像素闪光，展现压迫感)
      if (t >= T_LOCK) {
        const ck = (t - T_LOCK) / 0.68;

        for (const dx of [-1, 1]) {
          for (const dy of [-1, 1]) {
            const cx = dx * curHW + sx;
            const cy = dy * HH + sy;

            // Persistent ornate geometric corner clasps in Withered-Yellow & Coral-Red
            for (let k = 0; k < 6; k++) {
              p.dot(cx - dx * k, cy - dy, k < 2 ? G[6] : G[4], fadeOut);
              p.dot(cx - dx, cy - dy * k, k < 2 ? G[6] : G[4], fadeOut);
            }
            p.dot(cx, cy, WHITE, fadeOut);
            p.dot(cx + dx, cy + dy, C[5], fadeOut);
            p.dot(cx - dx * 2, cy - dy * 2, C[5], fadeOut);

            // Expanding geometric pixel flash at each corner during T_LOCK .. T_LOCK + 0.68s
            if (ck >= 0 && ck < 1) {
              const e1 = ease.outQuart(ck);
              const gFade = (1 - smooth(0.48, 1.0, ck)) * fadeOut;
              const rOuter = Math.round(4 + 13 * e1);
              const rInner = Math.round(2 + 7 * ease.outQuad(ck));
              const isWhite = ck < 0.08;

              // 1) Solid Coral-Red (珊瑚红色) outer geometric diamond + stepped corner bracket
              const colCoral = isWhite ? WHITE : C[5];
              const colCoralHi = isWhite ? WHITE : C[6];
              for (let s = -rOuter; s <= rOuter; s++) {
                const rem = rOuter - Math.abs(s);
                const cStep = Math.abs(s) < 2 || rem < 2 ? colCoralHi : colCoral;
                p.dot(cx + s, cy - rem, cStep, gFade * 0.96);
                p.dot(cx + s, cy + rem, cStep, gFade * 0.96);
              }
              const bOff = Math.round(3 + 7 * e1);
              for (let k = 0; k <= 5; k++) {
                p.dot(cx + dx * (bOff - k), cy + dy * bOff, colCoralHi, gFade * 0.92);
                p.dot(cx + dx * bOff, cy + dy * (bOff - k), colCoral, gFade * 0.92);
              }

              // 2) Solid Withered-Yellow (枯黄色) inner geometric diamond + 4-way cross-rays
              const colGold = isWhite ? WHITE : G[5];
              const colGoldHi = isWhite ? WHITE : G[6];
              for (let s = -rInner; s <= rInner; s++) {
                const rem = rInner - Math.abs(s);
                p.dot(cx + s, cy - rem, colGoldHi, gFade);
                p.dot(cx + s, cy + rem, colGold, gFade);
              }
              const rayL = Math.round(5 + 13 * e1);
              for (let r = 2; r <= rayL; r++) {
                const rAlpha = gFade * (1 - r / (rayL + 3));
                p.dot(cx + dx * r, cy, r < 6 ? colGoldHi : colGold, rAlpha);
                p.dot(cx, cy + dy * r, r < 6 ? colGoldHi : colGold, rAlpha);
                p.dot(cx - dx * Math.min(r, 8), cy, colCoral, rAlpha * 0.85);
                p.dot(cx, cy - dy * Math.min(r, 8), colCoral, rAlpha * 0.85);
              }

              // 3) Satellite 3x3 hollow geometric pixel diamonds in Coral-Red and Withered-Yellow
              const satD = Math.round(5 + 10 * e1);
              for (const [ox1, oy1, sc] of [
                [dx * satD, -dy * 3, colCoralHi],
                [-dx * 3, dy * satD, colGoldHi],
              ]) {
                p.dot(cx + ox1, cy + oy1 - 1, sc, gFade * 0.9);
                p.dot(cx + ox1, cy + oy1 + 1, sc, gFade * 0.9);
                p.dot(cx + ox1 - 1, cy + oy1, sc, gFade * 0.9);
                p.dot(cx + ox1 + 1, cy + oy1, sc, gFade * 0.9);
              }

              p.glow(cx, cy, 15 * gFade, G[5], 0.52 * gFade);
              p.glow(cx + dx * 3, cy + dy * 3, 12 * gFade, C[5], 0.48 * gFade);
            }
          }
        }
      }

      // 6. Phase 4: Faint Warm-Gold Pixel Fluorescent Particles Rising from Bottom (底部不断升起微弱的暖金色像素荧光粒子)
      for (const f of goldFluors) {
        if (Math.abs(f.x) > curHW - 2 || f.y < -HH + 2) continue;
        const k = 1 - f.age / f.life;
        const tw = 0.7 + 0.3 * Math.sin(t * 14 + f.ph);
        const a = Math.min(1, f.age / 0.08) * Math.min(1, k * 1.55) * tw * fadeOut;
        if (a <= 0.04) continue;
        const X = Math.round(f.x + sx), Y0 = Math.round(f.y + sy);
        p.dot(X, Y0, k > 0.62 ? WHITE : G[6], a * 0.94);
        if (f.big && k > 0.25) {
          p.dot(X + 1, Y0, f.c, a * 0.76);
          p.dot(X, Y0 + 1, f.c, a * 0.76);
        } else {
          p.dot(X, Y0 + 1, f.c, a * 0.8);
        }
        p.glow(X, Y0, 3, G[5], 0.4 * a);
      }

      ps.draw(p);
      lights.draw(p);
    },
  };
}
