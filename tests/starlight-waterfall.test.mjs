import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, painterFor, resolveOptions } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as starlightWaterfall from "../src/fx/water/starlight-waterfall.js";

function countPixelsInRegion(frame, x0, y0, x1, y1) {
  const { w, h, color, light } = frame;
  let count = 0;
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
      const i = y * w + x;
      if (color[i] !== 0 || light[i] !== 0) count++;
    }
  }
  return count;
}

test("water/starlight-waterfall is registered in effects catalog with expected loop meta", () => {
  assert.ok(effects["water/starlight-waterfall"], "Expected water/starlight-waterfall in effects index");
  const { meta } = starlightWaterfall;
  assert.equal(meta.name, "Starlight waterfall");
  assert.deepEqual(meta.size, [224, 168]);
  assert.deepEqual(meta.origin, [112, 144]);
  assert.equal(meta.duration, 3.6);
  assert.equal(meta.loop, true);
  assert.equal(meta.bg, "ground");
  assert.ok(meta.tags.includes("water"));
  assert.ok(meta.tags.includes("waterfall"));
  assert.ok(meta.tags.includes("loop"));
});

test("water/starlight-waterfall renders mid-air source, waterfall column with meteors, pool ripples, and rising side mist plumes", () => {
  const [w, h] = starlightWaterfall.meta.size;
  const [ox, oy] = starlightWaterfall.meta.origin;
  const inst = createFx(starlightWaterfall, { x: ox, y: oy });
  const frame = createFrame(w, h);

  inst.update(1.45);
  clearFrame(frame);
  inst.draw(frame);

  // 1. Mid-air nebula source & weir around y = oy - 98 = 46
  const sourcePx = countPixelsInRegion(frame, ox - 45, oy - 114, ox + 45, oy - 90);
  assert.ok(sourcePx > 600, `Expected mid-air cosmic nebula source pixels, got ${sourcePx}`);

  // 2. Central pouring pale-violet starlight waterfall column & internal shooting stars
  const columnPx = countPixelsInRegion(frame, ox - 24, oy - 90, ox + 24, oy - 6);
  assert.ok(columnPx > 2200, `Expected central starlight waterfall column pixels, got ${columnPx}`);

  // 3. Left & right rising glowing mist circulation plumes
  const leftMistPx = countPixelsInRegion(frame, ox - 85, oy - 88, ox - 28, oy - 8);
  const rightMistPx = countPixelsInRegion(frame, ox + 28, oy - 88, ox + 85, oy - 8);
  assert.ok(leftMistPx > 800, `Expected left rising mist plume pixels, got ${leftMistPx}`);
  assert.ok(rightMistPx > 800, `Expected right rising mist plume pixels, got ${rightMistPx}`);

  // 4. Bottom star-pool, stardust splash crowns & continuous expanding ripples
  const poolAndRipplesPx = countPixelsInRegion(frame, ox - 84, oy - 8, ox + 84, oy + 18);
  assert.ok(poolAndRipplesPx > 2000, `Expected bottom star-pool and ripple pixels, got ${poolAndRipplesPx}`);
});

test("water/starlight-waterfall loops seamlessly and supports custom palette options", () => {
  const [w, h] = starlightWaterfall.meta.size;
  const [ox, oy] = starlightWaterfall.meta.origin;
  const opts = resolveOptions(starlightWaterfall.meta, {
    palette: ["#081828", "#163858", "#2c6898", "#58b0e0", "#aef0ff", "#ffffff"],
    star: ["#281808", "#684016", "#c8882c", "#ffd868", "#fff6c8", "#ffffff"],
    seed: 11,
  });

  const f0 = createFrame(w, h);
  const p0 = painterFor(clearFrame(f0));
  p0.place(ox, oy);
  starlightWaterfall.drawBack(p0, 0, opts);
  starlightWaterfall.draw(p0, 0, opts);

  const fEnd = createFrame(w, h);
  const pEnd = painterFor(clearFrame(fEnd));
  pEnd.place(ox, oy);
  starlightWaterfall.drawBack(pEnd, starlightWaterfall.meta.duration, opts);
  starlightWaterfall.draw(pEnd, starlightWaterfall.meta.duration, opts);

  assert.deepEqual(f0.color, fEnd.color, "Expected t=0 and t=duration color buffers to match seamlessly");
  assert.deepEqual(f0.light, fEnd.light, "Expected t=0 and t=duration light buffers to match seamlessly");
});
