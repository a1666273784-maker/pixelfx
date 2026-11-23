import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, luma } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as bioluminescentForest from "../src/fx/weather/bioluminescent-forest.js";

test("weather/bioluminescent-forest is registered with valid 16:9 full-screen loop metadata", () => {
  const { meta, drawBack, draw } = bioluminescentForest;
  assert.equal(meta.name, "Bioluminescent forest");
  assert.deepEqual(meta.size, [320, 180]);
  assert.deepEqual(meta.origin, [160, 170]);
  assert.ok(Math.abs(meta.size[0] / meta.size[1] - 16 / 9) < 0.01, "must be 16:9 screen size");
  assert.equal(meta.duration, 12);
  assert.equal(meta.loop, true);
  assert.equal(meta.fps, 30);
  assert.equal(meta.bg, "dark");
  assert.ok(meta.desc.length < 180);
  assert.equal(typeof drawBack, "function");
  assert.equal(typeof draw, "function");
  assert.equal(effects["weather/bioluminescent-forest"], bioluminescentForest);
});

test("weather/bioluminescent-forest dims from dusk into night, wakes mushrooms & vines near-to-far with breathing LEDs, and loops seamlessly", () => {
  const { meta } = bioluminescentForest;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const frame = createFrame(W, H);

  const renderAt = (tSec) => {
    const inst = createFx(bioluminescentForest, { x: ox, y: oy, seed: 7 });
    inst.update(tSec);
    clearFrame(frame);
    inst.draw(frame, "back");
    inst.draw(frame, "front");
  };

  const regionLumaSum = (x0, x1, y0, y1) => {
    let sum = 0;
    for (let y = y0; y <= y1; y++) {
      const row = y * W;
      for (let x = x0; x <= x1; x++) {
        const c = frame.color[row + x];
        if (c >>> 24) sum += luma(c);
      }
    }
    return sum;
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

  // Isolates cyan (#58f6ff) & violet (#d173ff) bioluminescence (B=255) from chartreuse fireflies (#c4ff4a, B=74, G=255)
  const regionBioBlueEnergy = (x0, x1, y0, y1) => {
    let sum = 0;
    for (let y = y0; y <= y1; y++) {
      const row = y * W;
      for (let x = x0; x <= x1; x++) {
        const l = frame.light[row + x];
        const g = (l >>> 8) & 255, b = (l >>> 16) & 255;
        if (b > g * 0.45) sum += b - g * 0.35;
      }
    }
    return sum;
  };

  // 1. Unhurried progressive Dusk (0.0s) -> Blue-Hour Twilight (2.6s) -> Midnight (5.4s):
  // Scene dims smoothly over ~5.3s rather than snapping abruptly!
  renderAt(0.0);
  const skyAtZero = new Uint32Array(frame.color);
  const duskUpperLuma = regionLumaSum(40, 280, 12, 95);

  renderAt(2.6);
  const twilightUpperLuma = regionLumaSum(40, 280, 12, 95);

  renderAt(5.4);
  const nightUpperLuma = regionLumaSum(40, 280, 12, 95);

  assert.ok(
    duskUpperLuma > twilightUpperLuma * 1.35 && twilightUpperLuma > nightUpperLuma * 1.45 && duskUpperLuma > nightUpperLuma * 2.2,
    `expected gradual dusk->twilight->night dimming: dusk=${duskUpperLuma.toFixed(0)}, twilight=${twilightUpperLuma.toFixed(0)}, night=${nightUpperLuma.toFixed(0)}`
  );

  // 2. Near-to-far sequential awakening: at t = 3.2s foreground (y=148..179) is glowing while far horizon (y=104..120) is still asleep
  renderAt(3.2);
  const fgLightEarly = regionBioBlueEnergy(10, 310, 148, 179);
  const farLightEarly = regionBioBlueEnergy(40, 280, 104, 120);
  assert.ok(fgLightEarly > 10000, `expected foreground mushrooms/vines glowing at t=3.2s, got ${fgLightEarly.toFixed(0)}`);

  // By t = 6.8s, far-ridge & horizon mushroom tufts and mid-trunk lianas have awakened!
  renderAt(6.8);
  const farLightAwake = regionBioBlueEnergy(40, 280, 104, 120);
  assert.ok(
    farLightAwake > farLightEarly * 2.5 + 1500,
    `expected far horizon bioluminescence to wake after foreground (early=${farLightEarly.toFixed(0)}, awake=${farLightAwake.toFixed(0)})`
  );

  // 3. Calm 6-second breathing LED modulation: foreground exhales smoothly around t = 4.6s and inhales brightly around t = 7.6s
  renderAt(4.6);
  const fgLightExhale = regionBioBlueEnergy(10, 310, 148, 179);
  renderAt(7.6);
  const fgLightPeak = regionBioBlueEnergy(10, 310, 148, 179);
  assert.ok(
    fgLightPeak > fgLightExhale * 1.30,
    `expected calm breathing LED modulation on foreground flora: exhale=${fgLightExhale.toFixed(0)}, peak=${fgLightPeak.toFixed(0)}`
  );

  // 4. Mid-air ambient dandelion fluff & swarming fireflies remain active across the mid-air band (y=55..130)
  const midAirGlow = regionLightEnergy(25, 295, 55, 130);
  assert.ok(midAirGlow > 20000, `expected active mid-air dandelion fluff & firefly swarm glow at t=7.6s, got ${midAirGlow}`);

  // 5. Seamless loop wrap between last frame (t = 11.966s) and t = 0.0s (no noticeable pixel jumps > 8 RGB steps)
  renderAt(12 - 1 / 30);
  let seamJumps = 0;
  for (let i = 0; i < W * H; i++) {
    const a = frame.color[i], b = skyAtZero[i];
    const dr = Math.abs((a & 255) - (b & 255));
    const dg = Math.abs(((a >>> 8) & 255) - ((b >>> 8) & 255));
    const db = Math.abs(((a >>> 16) & 255) - ((b >>> 16) & 255));
    if (dr + dg + db > 18) seamJumps++;
  }
  assert.ok(seamJumps < 2500, `expected smooth seamless wrap at t=12s -> 0s, got ${seamJumps} noticeable px jumps`);
});

test("weather/bioluminescent-forest is deterministic per seed and recolors cleanly with a custom 4-step palette", () => {
  const { meta } = bioluminescentForest;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H), f3 = createFrame(W, H);

  const run = (f, opts) => {
    const inst = createFx(bioluminescentForest, { x: ox, y: oy, ...opts });
    inst.update(5.4);
    clearFrame(f);
    inst.draw(f, "back");
    inst.draw(f, "front");
  };

  run(f1, { seed: 7 });
  run(f2, { seed: 7 });
  assert.deepEqual(f1.color, f2.color, "identical seeds must produce identical pixel buffers");

  run(f3, { seed: 7, palette: ["#1a0826", "#6e1868", "#e854b8", "#ffe6f7"] });
  let recoloredDiff = 0;
  for (let i = 0; i < W * H; i++) {
    if (f1.color[i] !== f3.color[i]) recoloredDiff++;
  }
  assert.ok(recoloredDiff > 800, `expected custom palette to recolor bioluminescent flora & mist, got ${recoloredDiff}`);
});
