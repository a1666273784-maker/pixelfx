import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, painterFor, resolveOptions } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as tricolorLacquerFlame from "../src/fx/fire/tricolor-lacquer-flame.js";

function renderAt(fx, t, customOpts = {}) {
  const [w, h] = fx.meta.size;
  const [ox, oy] = fx.meta.origin;
  const opts = resolveOptions(fx.meta, customOpts);
  const frame = createFrame(w, h);
  const p = painterFor(clearFrame(frame));
  p.place(ox, oy);
  fx.drawBack?.(p, t, opts);
  fx.draw(p, t, opts);
  return frame;
}

function countRegion(frame, x0, y0, x1, y1) {
  let colorCount = 0;
  let lightCount = 0;
  const { w, h, color, light } = frame;
  const cx0 = Math.max(0, Math.floor(x0));
  const cy0 = Math.max(0, Math.floor(y0));
  const cx1 = Math.min(w - 1, Math.floor(x1));
  const cy1 = Math.min(h - 1, Math.floor(y1));
  for (let y = cy0; y <= cy1; y++) {
    for (let x = cx0; x <= cx1; x++) {
      const idx = y * w + x;
      if (color[idx] !== 0) colorCount++;
      if (light[idx] !== 0) lightCount++;
    }
  }
  return { colorCount, lightCount };
}

test("fire/tricolor-lacquer-flame is registered in effects catalog with expected loop meta", () => {
  const fx = effects["fire/tricolor-lacquer-flame"];
  assert.ok(fx, "fire/tricolor-lacquer-flame should be registered in src/fx/index.js");
  assert.equal(fx.meta.name, "Tricolor lacquer flame");
  assert.equal(fx.meta.loop, true);
  assert.equal(fx.meta.bg, "black");
  assert.equal(fx.meta.actor, undefined);
  assert.equal(fx.meta.duration, 3.0);
  assert.equal(fx.meta.fps, 30);
  assert.deepEqual(fx.meta.size, [204, 132]);
  assert.deepEqual(fx.meta.origin, [102, 112]);
});

test("fire/tricolor-lacquer-flame renders three stationary, strictly separated flames burning in place across the loop", () => {
  const [ox, oy] = tricolorLacquerFlame.meta.origin;
  const spots = tricolorLacquerFlame.FLAME_SPOTS;
  assert.equal(spots.length, 3, "Must define 3 separated stationary flame spots");

  for (const t of [0.0, 0.5, 1.0, 1.5, 2.0, 2.5]) {
    const frame = renderAt(tricolorLacquerFlame, t);

    // 1. Verify each of the 3 stationary flames (Left: Gold, Center: Frost, Right: Celadon) burns richly at its fixed spot
    for (let k = 0; k < 3; k++) {
      const [sx, sy] = spots[k];
      const fx = ox + sx;
      const fy = oy + sy;
      const flameBox = countRegion(frame, fx - 20, fy - 68, fx + 20, fy + 4);
      assert.ok(
        flameBox.colorCount > 500,
        `Stationary flame ${k} should be densely rendered at x=${sx} at t=${t}s (got ${flameBox.colorCount})`
      );
      assert.ok(
        flameBox.lightCount > 600,
        `Stationary flame ${k} should emit rich lacquer glow at x=${sx} at t=${t}s (got ${flameBox.lightCount})`
      );
    }

    // 2. Verify the gaps between Left & Center (x = -31) and Center & Right (x = +31) remain completely clear of pixels
    const gapLeftCenter = countRegion(frame, ox - 34, oy - 75, ox - 28, oy + 4);
    const gapCenterRight = countRegion(frame, ox + 28, oy - 75, ox + 34, oy + 4);
    assert.equal(gapLeftCenter.colorCount, 0, `Gap between Gold and Frost flames must stay empty at t=${t}s`);
    assert.equal(gapCenterRight.colorCount, 0, `Gap between Frost and Celadon flames must stay empty at t=${t}s`);
  }
});

test("fire/tricolor-lacquer-flame loops seamlessly and supports custom palette, frost, and celadon options", () => {
  const fStart = renderAt(tricolorLacquerFlame, 0);
  const fEnd = renderAt(tricolorLacquerFlame, tricolorLacquerFlame.meta.duration);

  assert.deepEqual(fStart.color, fEnd.color, "Color buffer at t=0 and t=duration must match for seamless loop");
  assert.deepEqual(fStart.light, fEnd.light, "Light buffer at t=0 and t=duration must match for seamless loop");

  const fDefault = renderAt(tricolorLacquerFlame, 1.2, { seed: 19 });
  const fCustom = renderAt(tricolorLacquerFlame, 1.2, {
    seed: 19,
    palette: ["#120404", "#320b0b", "#681616", "#a82828", "#e24a4a", "#ff8a8a", "#ffd0d0", "#ffffff"],
    frost: ["#080a0c", "#161e24", "#2c3e48", "#506e7e", "#88aab8", "#c6dce8", "#eef6fa", "#ffffff"],
    celadon: ["#080c04", "#18260c", "#325218", "#588c28", "#88cc44", "#bcf478", "#e6ffc4", "#ffffff"],
  });

  let recolored = 0;
  for (let i = 0; i < fDefault.color.length; i++) {
    if (fDefault.color[i] !== fCustom.color[i]) recolored++;
  }
  assert.ok(recolored > 400, `Custom palette/frost/celadon options should recolor lacquer flames (recolored=${recolored})`);
});
