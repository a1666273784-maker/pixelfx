import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, composite, red, green, blue } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as energyBarCharge from "../src/fx/ui/energy-bar-charge.js";

function stepTo(fx, frame, targetT, fps = 30) {
  const steps = Math.round(targetT * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  fx.draw(frame);
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

test("ui/energy-bar-charge is registered in src/fx/index.js with valid UI metadata", () => {
  assert.equal(effects["ui/energy-bar-charge"], energyBarCharge);
  const { meta } = energyBarCharge;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "dark");
  assert.ok(meta.desc.length >= 20 && meta.desc.length <= 180);
});

test("ui/energy-bar-charge progresses through release motes -> rightward gradient fill with white spots & bubbles -> interwoven purple-cyan frame shockwave -> undulating mist & rising purple motes -> empty end", () => {
  const { meta } = energyBarCharge;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const frame = createFrame(W, H);

  // 1. Release phase (t = 0.22s): dark-grey bar unfolded, purple-crimson & withered-yellow motes gathering from around the bar
  {
    const fx = createFx(energyBarCharge, { x: OX, y: OY, seed: 7 });
    stepTo(fx, frame, 0.22);
    let purpleMotes = 0, amberMotes = 0, darkBarPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = red(c), g = green(c), b = blue(c);
        const outsideBar = Math.abs(x - OX) > 68 || Math.abs(y - OY) > 12;
        if (outsideBar) {
          if (r > 160 && b > 140 && r > g * 1.3) purpleMotes++;
          if (r > 140 && g > 100 && g > b * 1.3) amberMotes++;
        } else if (r < 95 && g < 95 && b < 115) {
          darkBarPx++;
        }
      }
    }
    assert.ok(darkBarPx > 800, `expected dark-grey UI frame at t=0.22s, got ${darkBarPx}`);
    assert.ok(purpleMotes >= 6, `expected purple-crimson gathering motes outside bar, got ${purpleMotes}`);
    assert.ok(amberMotes >= 4, `expected withered-yellow gathering motes outside bar, got ${amberMotes}`);
  }

  // 2. Injection & rightward gradient fill with bright white pixel spots & bubbles (t = 0.68s vs t = 1.15s)
  {
    const measureFill = (targetT) => {
      const fx = createFx(energyBarCharge, { x: OX, y: OY, seed: 7 });
      stepTo(fx, frame, targetT);
      let maxFillX = 0, whiteEdgePx = 0, bubbleAboveBelowPx = 0;
      for (let y = OY - 5; y < OY + 5; y++) {
        for (let x = OX - 48; x < OX + 58; x++) {
          const c = frame.color[y * W + x];
          if (!(c >>> 24)) continue;
          const r = red(c), g = green(c), b = blue(c);
          if (r > 120 && b > 80 && r > g * 1.4) maxFillX = Math.max(maxFillX, x);
          if (r >= 245 && g >= 245 && b >= 245) whiteEdgePx++;
        }
      }
      // Check fine bubbles fizzing around the advancing fill edge
      for (let y = OY - 9; y <= OY + 8; y++) {
        for (let x = Math.max(OX - 48, maxFillX - 16); x <= Math.min(W - 1, maxFillX + 8); x++) {
          if (y >= OY - 5 && y < OY + 5) continue;
          const c = frame.color[y * W + x];
          if ((c >>> 24) && red(c) > 150) bubbleAboveBelowPx++;
        }
      }
      return { maxFillX, whiteEdgePx, bubbleAboveBelowPx };
    };

    const f1 = measureFill(0.68);
    const f2 = measureFill(1.15);
    assert.ok(f2.maxFillX > f1.maxFillX + 35, `energy bar must fill rightward (${f1.maxFillX} -> ${f2.maxFillX})`);
    assert.ok(f1.whiteEdgePx >= 12 && f2.whiteEdgePx >= 12, `advancing edge must have bright white pixel spots (${f1.whiteEdgePx}, ${f2.whiteEdgePx})`);
    assert.ok(f1.bubbleAboveBelowPx >= 3 || f2.bubbleAboveBelowPx >= 3, "expected fine pixel bubbles around the advancing fill edge");
  }

  // 3. Full-charge climax (t = 1.68s): outer frame radiates interwoven purple-crimson & slate-cyan shockwave halo
  {
    const fx = createFx(energyBarCharge, { x: OX, y: OY, seed: 7 });
    stepTo(fx, frame, 1.68);
    let haloPurplePx = 0, haloCyanPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const outsideFrame = Math.abs(x - OX) > 67 || Math.abs(y - OY) > 11;
        if (!outsideFrame) continue;
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = red(c), g = green(c), b = blue(c);
        if (r > g * 1.35 && b > g * 1.1 && r > 70) haloPurplePx++;
        if (b > r * 1.25 && g > r * 1.15 && b > 60) haloCyanPx++;
      }
    }
    assert.ok(haloPurplePx > 120, `expected purple-crimson shockwave halo pixels outside frame, got ${haloPurplePx}`);
    assert.ok(haloCyanPx > 120, `expected slate-cyan (daiqing) shockwave halo pixels outside frame, got ${haloCyanPx}`);
  }

  // 4. Aftermath result (t = 2.40s): grey-white mist film on bar surface + rising purple-crimson motes above bar
  {
    const fx = createFx(energyBarCharge, { x: OX, y: OY, seed: 7 });
    stepTo(fx, frame, 2.40);
    let mistFilmPx = 0, risingPurpleMotesPx = 0;
    for (let y = OY - 7; y <= OY + 3; y++) {
      for (let x = OX - 46; x < OX + 56; x++) {
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = red(c), g = green(c), b = blue(c);
        // Mist film raises green channel relative to pure purple-crimson fill
        if (g >= 115 && b >= 145 && r >= 135) mistFilmPx++;
      }
    }
    for (let y = 0; y < OY - 8; y++) {
      for (let x = OX - 52; x < OX + 60; x++) {
        const idx = y * W + x;
        const c = frame.color[idx], l = frame.light[idx];
        if ((c >>> 24) && red(c) > green(c) * 1.25 && blue(c) > green(c)) risingPurpleMotesPx++;
        else if ((l & 255) > ((l >>> 8) & 255) + 15) risingPurpleMotesPx++;
      }
    }
    assert.ok(mistFilmPx > 160, `expected grey-white mist light-film across the bar surface, got ${mistFilmPx}`);
    assert.ok(risingPurpleMotesPx > 20, `expected rising purple-crimson motes drifting upward above bar, got ${risingPurpleMotesPx}`);
  }

  // 5. Clean one-shot end at t = duration
  {
    const fx = createFx(energyBarCharge, { x: OX, y: OY, seed: 7 });
    stepTo(fx, frame, meta.duration);
    assert.ok(frame.color.every((v) => (v >>> 24) === 0), "color buffer must be empty at t = duration");
    assert.ok(frame.light.every((v) => v === 0), "light buffer must be empty at t = duration");
    assert.ok(fx.done(), "fx.done() must be true at t = duration");
  }
});

test("ui/energy-bar-charge is deterministic by seed and supports custom palette recoloring", () => {
  const { meta } = energyBarCharge;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H), f3 = createFrame(W, H);

  const a = createFx(energyBarCharge, { x: OX, y: OY, seed: 11 });
  const b = createFx(energyBarCharge, { x: OX, y: OY, seed: 11 });
  const c = createFx(energyBarCharge, {
    x: OX,
    y: OY,
    seed: 11,
    palette: ["#041812", "#0a3828", "#126848", "#1ca06e", "#2cd494", "#66f0b8", "#b4ffe0", "#ffffff"],
  });

  const outA = stepTo(a, f1, 1.65);
  const outB = stepTo(b, f2, 1.65);
  const outC = stepTo(c, f3, 1.65);

  assert.deepEqual(Array.from(outA), Array.from(outB), "identical seeds must produce byte-identical output");
  assert.notDeepEqual(Array.from(outA), Array.from(outC), "custom palette must recolor the energy bar");
});
