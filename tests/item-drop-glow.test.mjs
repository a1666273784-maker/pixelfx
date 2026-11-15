import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, composite } from "../src/core/index.js";
import * as itemDropGlow from "../src/fx/ui/item-drop-glow.js";

test("ui/item-drop-glow metadata and options contract", () => {
  const { meta, create } = itemDropGlow;
  assert.equal(meta.name, "Item drop glow");
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "dark");
  assert.deepEqual(meta.size, [272, 152]);
  assert.deepEqual(meta.origin, [136, 124]);
  assert.equal(typeof create, "function");
  assert.ok(Array.isArray(meta.options.palette));
  assert.ok(Array.isArray(meta.options.blue));
  assert.ok(Array.isArray(meta.options.purple));
  assert.equal(meta.options.tier, "all");
});

test("ui/item-drop-glow escalates across blue, purple, and gold tiers and ends cleanly", () => {
  const { meta } = itemDropGlow;
  const [W, H] = meta.size;

  const measureTierPeak = (tier) => {
    const inst = createFx(itemDropGlow, { x: meta.origin[0], y: meta.origin[1], tier, seed: 7 });
    const frame = createFrame(W, H);
    let peak = 0;
    const steps = Math.round(meta.duration * meta.fps);
    for (let i = 0; i <= steps; i++) {
      if (i > 0) inst.update(1 / meta.fps);
      clearFrame(frame);
      inst.draw(frame);
      let lit = 0;
      for (let j = 0; j < frame.color.length; j++) {
        if (frame.color[j] >>> 24 || frame.light[j] & 0xffffff) lit++;
      }
      if (lit > peak) peak = lit;
    }
    // One-shot must end completely clean at duration
    let endLit = 0;
    for (let j = 0; j < frame.color.length; j++) {
      if (frame.color[j] >>> 24) endLit++;
    }
    assert.equal(endLit, 0, `tier ${tier} should end empty at duration`);
    return peak;
  };

  const bluePeak = measureTierPeak("blue");
  const purplePeak = measureTierPeak("purple");
  const goldPeak = measureTierPeak("gold");

  assert.ok(bluePeak > 200, `expected blue tier to render substantial beacon, got ${bluePeak}`);
  assert.ok(purplePeak > bluePeak, `expected purple (${purplePeak}) > blue (${bluePeak})`);
  assert.ok(goldPeak > purplePeak, `expected gold (${goldPeak}) > purple (${purplePeak})`);
});

test("ui/item-drop-glow uses translucent non-occluding pixels so overlaid items remain visible", () => {
  const { meta } = itemDropGlow;
  const [W, H] = meta.size;
  const inst = createFx(itemDropGlow, { x: meta.origin[0], y: meta.origin[1], tier: "all", seed: 7 });
  const frame = createFrame(W, H);

  // Advance to active sustain phase (t = 1.5s)
  for (let i = 0; i < 45; i++) inst.update(1 / meta.fps);
  inst.draw(frame);

  // 1. Zero fully opaque (alpha = 255) pixels anywhere in the effect
  let opaqueCount = 0;
  for (let i = 0; i < frame.color.length; i++) {
    if ((frame.color[i] >>> 24) === 255) opaqueCount++;
  }
  assert.equal(opaqueCount, 0, "effect should use smooth translucent alpha (< 255) with zero opaque occluding pixels");

  // 2. Item sanctuary centers ((cx, -15) for blue=-74, purple=0, gold=74) keep color alpha gentle (<= 64/255)
  // so an item sprite placed at the drop point is never occluded when the glow is overlaid on top.
  for (const dxTier of [-74, 0, 74]) {
    const sx = meta.origin[0] + dxTier;
    const sy = meta.origin[1] - 15;
    const idx = sy * W + sx;
    const ca = frame.color[idx] >>> 24;
    assert.ok(ca <= 64, `expected gentle non-occluding alpha at item center (${dxTier}, -15), got ${ca}/255`);

    // Verify compositing over two distinct item pixels preserves strong contrast between dark and bright item details
    const darkBg = new Uint32Array(W * H).fill(0xff202020);
    const brightBg = new Uint32Array(W * H).fill(0xff202020);
    brightBg[idx] = 0xffd0d0d0; // bright item detail at the item center
    const outDark = new Uint8ClampedArray(W * H * 4);
    const outBright = new Uint8ClampedArray(W * H * 4);
    composite(frame, outDark, darkBg);
    composite(frame, outBright, brightBg);

    const diffR = outBright[idx * 4] - outDark[idx * 4];
    assert.ok(diffR >= 60, `item detail contrast should shine through overlay at tier ${dxTier}, got delta ${diffR}`);
  }
});
