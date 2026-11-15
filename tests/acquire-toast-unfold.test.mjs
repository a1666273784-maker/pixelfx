import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, composite, red, green, blue } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as acquireToastUnfold from "../src/fx/ui/acquire-toast-unfold.js";

function stepTo(fx, frame, targetT, fps = 30) {
  const steps = Math.round(targetT * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  fx.draw(frame);
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

test("ui/acquire-toast-unfold is registered in src/fx/index.js with valid UI metadata", () => {
  assert.equal(effects["ui/acquire-toast-unfold"], acquireToastUnfold);
  const { meta } = acquireToastUnfold;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "dark");
  assert.deepEqual(meta.size, [240, 132]);
  assert.ok(meta.desc.length >= 20 && meta.desc.length <= 180);
});

test("ui/acquire-toast-unfold progresses through central white line & spinning amber motes -> 4-way snow-flurry unfold -> 4-corner amber & coral geometric flashes -> multi-depth falling snow & rising gold fluors -> empty end", () => {
  const { meta } = acquireToastUnfold;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const frame = createFrame(W, H);

  // 1. Release phase (t = 0.30s): central pure-white vertical hairline + orbiting withered-yellow light particles
  {
    const fx = createFx(acquireToastUnfold, { x: OX, y: OY, seed: 13 });
    stepTo(fx, frame, 0.30);
    let whiteCenterLinePx = 0, orbitingAmberPx = 0;
    for (let y = OY - 25; y <= OY + 25; y++) {
      for (let x = OX - 28; x <= OX + 28; x++) {
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = red(c), g = green(c), b = blue(c);
        if (Math.abs(x - OX) <= 1 && r >= 245 && g >= 245 && b >= 245) whiteCenterLinePx++;
        else if (Math.abs(x - OX) > 2 && r > 150 && g > 105 && g > b * 1.35) orbitingAmberPx++;
      }
    }
    assert.ok(whiteCenterLinePx >= 35, `expected central pure-white vertical pixel line at t=0.30s, got ${whiteCenterLinePx}`);
    assert.ok(orbitingAmberPx >= 15, `expected orbiting withered-yellow light particles at t=0.30s, got ${orbitingAmberPx}`);
  }

  // 2. Hit & Snow-Flurry Unfold (t = 0.78s): unfolding ash-grey bordered dark UI region + 4-directional snow flurry
  {
    const fx = createFx(acquireToastUnfold, { x: OX, y: OY, seed: 13 });
    stepTo(fx, frame, 0.78);
    let snowPx = 0, snowDirs = new Set();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = red(c), g = green(c), b = blue(c);
        const dx = x - OX, dy = y - OY;
        if (Math.abs(dx) > 45 || Math.abs(dy) > 21) {
          if (b >= 110 && g >= 95 && b >= r) {
            snowPx++;
            if (dx < -45) snowDirs.add("L");
            if (dx > 45) snowDirs.add("R");
            if (dy < -21) snowDirs.add("T");
            if (dy > 21) snowDirs.add("B");
          }
        }
      }
    }
    assert.ok(snowPx >= 45, `expected spinning snowflakes and snow specks around unfolding box, got ${snowPx}`);
    assert.equal(snowDirs.size, 4, "snow flurry must erupt outward in all 4 directions (L, R, T, B)");
  }

  // 3. UI Frame Formation Climax (t = 1.26s): all 4 corners simultaneously flash with withered-yellow & coral-red geometry
  {
    const fx = createFx(acquireToastUnfold, { x: OX, y: OY, seed: 13 });
    stepTo(fx, frame, 1.26);
    let cornersWithAmberAndCoral = 0;
    for (const [cx, cy] of [
      [OX - 68, OY - 21],
      [OX + 68, OY - 21],
      [OX - 68, OY + 21],
      [OX + 68, OY + 21],
    ]) {
      let amberPx = 0, coralPx = 0;
      for (let y = cy - 16; y <= cy + 16; y++) {
        for (let x = cx - 16; x <= cx + 16; x++) {
          const c = frame.color[y * W + x];
          if (!(c >>> 24)) continue;
          const r = red(c), g = green(c), b = blue(c);
          if (r > 180 && g > 130 && g > b * 1.35) amberPx++;
          if (r > 180 && r > g * 1.35 && r > b * 1.25) coralPx++;
        }
      }
      if (amberPx >= 12 && coralPx >= 12) cornersWithAmberAndCoral++;
    }
    assert.equal(cornersWithAmberAndCoral, 4, "all 4 UI corners must simultaneously display withered-yellow and coral-red geometric flashes");
  }

  // 4. Aftermath Result (t = 2.15s): pale ash-grey border with top snow drift, falling snow outside & inside UI box, and rising warm-gold particles
  {
    const fx = createFx(acquireToastUnfold, { x: OX, y: OY, seed: 13 });
    stepTo(fx, frame, 2.15);
    let ashBorderPx = 0, outerSnowPx = 0, innerSnowPx = 0, risingGoldFluorPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = red(c), g = green(c), b = blue(c);
        const inBox = x >= OX - 68 && x <= OX + 68 && y >= OY - 21 && y <= OY + 21;
        if (!inBox) {
          if (b >= 110 && g >= 95 && b >= r) outerSnowPx++;
        } else {
          const onBorder = x === OX - 68 || x === OX + 67 || y === OY - 21 || y === OY + 20;
          if (onBorder && r > 140 && g > 150 && b > 170) ashBorderPx++;
          if (!onBorder) {
            if (b >= 115 && g >= 100 && b > r * 1.1) innerSnowPx++;
            if (r > 165 && g > 115 && g > b * 1.3) risingGoldFluorPx++;
          }
        }
      }
    }
    assert.ok(ashBorderPx > 240, `expected pale ash-grey UI border at t=2.15s, got ${ashBorderPx}`);
    assert.ok(outerSnowPx >= 25, `expected falling snow outside UI box at t=2.15s, got ${outerSnowPx}`);
    assert.ok(innerSnowPx >= 15, `expected falling snow inside UI background at t=2.15s, got ${innerSnowPx}`);
    assert.ok(risingGoldFluorPx >= 14, `expected faint warm-gold pixel fluorescent particles rising from bottom at t=2.15s, got ${risingGoldFluorPx}`);
  }

  // 5. Clean one-shot end at t = duration
  {
    const fx = createFx(acquireToastUnfold, { x: OX, y: OY, seed: 13 });
    stepTo(fx, frame, meta.duration);
    assert.ok(frame.color.every((v) => (v >>> 24) === 0), "color buffer must be empty at t = duration");
    assert.ok(frame.light.every((v) => v === 0), "light buffer must be empty at t = duration");
    assert.ok(fx.done(), "fx.done() must be true at t = duration");
  }
});

test("ui/acquire-toast-unfold is deterministic by seed and supports custom palette recoloring", () => {
  const { meta } = acquireToastUnfold;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H), f3 = createFrame(W, H);

  const a = createFx(acquireToastUnfold, { x: OX, y: OY, seed: 13 });
  const b = createFx(acquireToastUnfold, { x: OX, y: OY, seed: 13 });
  const c = createFx(acquireToastUnfold, {
    x: OX,
    y: OY,
    seed: 13,
    palette: ["#0b0624", "#1d1052", "#381c8c", "#5b32c9", "#8556f2", "#b38cff", "#dac4ff", "#ffffff"],
  });

  const outA = stepTo(a, f1, 1.26);
  const outB = stepTo(b, f2, 1.26);
  const outC = stepTo(c, f3, 1.26);

  assert.deepEqual(Array.from(outA), Array.from(outB), "identical seeds must produce byte-identical output");
  assert.notDeepEqual(Array.from(outA), Array.from(outC), "custom palette must recolor the effect");
});
