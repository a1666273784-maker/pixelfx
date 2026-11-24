import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, luma } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as bioluminescentTide from "../src/fx/weather/bioluminescent-tide.js";

test("weather/bioluminescent-tide is registered with valid 16:9 full-screen loop metadata", () => {
  const { meta, drawBack, draw } = bioluminescentTide;
  assert.equal(meta.name, "Bioluminescent tide");
  assert.deepEqual(meta.size, [320, 180]);
  assert.deepEqual(meta.origin, [160, 118]);
  assert.ok(Math.abs(meta.size[0] / meta.size[1] - 16 / 9) < 0.01, "must be 16:9 screen size");
  assert.equal(meta.duration, 12);
  assert.equal(meta.loop, true);
  assert.equal(meta.fps, 30);
  assert.equal(meta.bg, "dark");
  assert.ok(meta.desc.length <= 180);
  assert.equal(typeof drawBack, "function");
  assert.equal(typeof draw, "function");
  assert.equal(effects["weather/bioluminescent-tide"], bioluminescentTide);
});

test("weather/bioluminescent-tide ignites dark swells into neon curls, erupts into droplets, recedes with dimming sand-veins, shimmers continuously, and loops seamlessly", () => {
  const { meta } = bioluminescentTide;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const frame = createFrame(W, H);

  const renderAt = (tSec) => {
    const inst = createFx(bioluminescentTide, { x: ox, y: oy, seed: 11 });
    inst.update(tSec);
    clearFrame(frame);
    inst.draw(frame, "back");
    inst.draw(frame, "front");
  };

  const regionLightEnergy = (x0, x1, y0, y1) => {
    let sum = 0;
    for (let y = y0; y <= y1; y++) {
      const row = y * W;
      for (let x = x0; x <= x1; x++) {
        const l = frame.light[row + x];
        sum += (l & 255) + ((l >>> 8) & 255) + ((l >>> 16) & 255);
      }
    }
    return sum;
  };

  const countBrightPixels = (x0, x1, y0, y1, minLuma = 0.55) => {
    let n = 0;
    for (let y = y0; y <= y1; y++) {
      const row = y * W;
      for (let x = x0; x <= x1; x++) {
        const c = frame.color[row + x];
        if ((c >>> 24) && luma(c) >= minLuma) n++;
      }
    }
    return n;
  };

  // 1. Capture t = 0.0s (dark approaching swell + continuous shimmering sea)
  renderAt(0.0);
  const colorAtZero = new Uint32Array(frame.color);
  const seaGlintsAtZero = countBrightPixels(10, 310, 52, 86, 0.45);

  // 2. Dark Swell (t = 0.5s) -> Blazing Peeling Neon-Blue Curl (t = 3.1s):
  // Surf zone (screen rows y = 88..124) ignites massively as the shoaling wave curls & tumbles!
  renderAt(0.5);
  const surfDarkSwellLight = regionLightEnergy(10, 310, 88, 124);

  renderAt(3.1);
  const surfNeonCurlLight = regionLightEnergy(10, 310, 88, 124);
  assert.ok(
    surfNeonCurlLight > surfDarkSwellLight * 8 + 80000,
    `expected shoaling wave to ignite into piercing neon-blue curl: dark=${surfDarkSwellLight}, curl=${surfNeonCurlLight}`
  );

  // 3. Shore Crash -> Skyward Glowing Water Droplets (t = 3.4s vs quiet retreat t = 8.5s):
  // Left-to-mid bay air band above the surf (x = 8..165, y = 66..104, outside the moon reflection column at x≈194)
  renderAt(3.4);
  const crashDropletSparks = countBrightPixels(8, 165, 66, 104, 0.50);

  renderAt(8.5);
  const quietAirSparks = countBrightPixels(8, 165, 66, 104, 0.50);
  const seaGlintsAtRetreat = countBrightPixels(10, 310, 52, 86, 0.45);
  assert.ok(
    crashDropletSparks > quietAirSparks + 35,
    `expected airborne glowing droplets during wave crash: crash=${crashDropletSparks}, quiet=${quietAirSparks}`
  );

  // 4. Continuous ocean surface shimmer (海面持续波光粼粼) across both start & retreat phases
  assert.ok(
    seaGlintsAtZero >= 35 && seaGlintsAtRetreat >= 35,
    `expected continuous ocean surface shimmer glints: t0=${seaGlintsAtZero}, retreat=${seaGlintsAtRetreat}`
  );

  // 5. Swash Surge -> Slow Retreat -> Gradually Dimming Blue Sand-Veins on Beach (rows y = 128..175):
  renderAt(5.1);
  const beachHighSwashLight = regionLightEnergy(12, 308, 128, 175);

  renderAt(8.4);
  const beachVeinGlowMid = regionLightEnergy(12, 308, 128, 175);

  renderAt(10.2);
  const beachVeinGlowDimming = regionLightEnergy(12, 308, 128, 175);

  renderAt(11.7);
  const beachBeforeNextWave = regionLightEnergy(12, 308, 128, 175);

  assert.ok(
    beachHighSwashLight > beachVeinGlowMid &&
    beachVeinGlowMid > beachVeinGlowDimming * 1.4 &&
    beachVeinGlowDimming > beachBeforeNextWave * 1.4 &&
    beachVeinGlowMid > 18000,
    `expected swash retreat leaving gradually dimming blue sand-veins: swash=${beachHighSwashLight}, midVein=${beachVeinGlowMid}, dimming=${beachVeinGlowDimming}, late=${beachBeforeNextWave}`
  );

  // 6. Seamless infinite loop wrap between last frame (t = 11.967s) and t = 0.0s
  renderAt(12 - 1 / 30);
  let seamJumps = 0;
  for (let i = 0; i < W * H; i++) {
    const a = frame.color[i], b = colorAtZero[i];
    const dr = Math.abs((a & 255) - (b & 255));
    const dg = Math.abs(((a >>> 8) & 255) - ((b >>> 8) & 255));
    const db = Math.abs(((a >>> 16) & 255) - ((b >>> 16) & 255));
    if (dr + dg + db > 18) seamJumps++;
  }
  assert.ok(seamJumps < 1800, `expected smooth seamless wrap at t=12s -> 0s, got ${seamJumps} noticeable px jumps`);
});

test("weather/bioluminescent-tide is deterministic per seed and recolors cleanly with a custom palette", () => {
  const { meta } = bioluminescentTide;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H), f3 = createFrame(W, H);

  const run = (f, opts) => {
    const inst = createFx(bioluminescentTide, { x: ox, y: oy, ...opts });
    inst.update(3.4);
    clearFrame(f);
    inst.draw(f, "back");
    inst.draw(f, "front");
  };

  run(f1, { seed: 11 });
  run(f2, { seed: 11 });
  assert.deepEqual(f1.color, f2.color, "identical seeds must produce identical pixel buffers");

  run(f3, { seed: 11, palette: ["#072419", "#0f6e4b", "#28e09b", "#d9fff0"] });
  let recoloredDiff = 0;
  for (let i = 0; i < W * H; i++) {
    if (f1.color[i] !== f3.color[i]) recoloredDiff++;
  }
  assert.ok(recoloredDiff > 1500, `expected custom palette to recolor neon curl, spray & swash, got ${recoloredDiff}`);
});
