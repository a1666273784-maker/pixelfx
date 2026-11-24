import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, composite, backdrop } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as fireflyVines from "../src/fx/nature/firefly-vines.js";

test("nature/firefly-vines is registered with valid 16:9 loopable scene-overlay metadata", () => {
  const { meta, drawBack, draw } = fireflyVines;
  assert.equal(meta.name, "Firefly vines");
  assert.deepEqual(meta.size, [320, 180]);
  assert.deepEqual(meta.origin, [160, 90]);
  assert.ok(Math.abs(meta.size[0] / meta.size[1] - 16 / 9) < 0.01, "must be 16:9 screen size");
  assert.equal(meta.duration, 12);
  assert.equal(meta.loop, true);
  assert.equal(meta.fps, 30);
  assert.equal(meta.bg, "ground");
  assert.ok(meta.desc.length <= 180);
  assert.equal(typeof drawBack, "function");
  assert.equal(typeof draw, "function");
  assert.equal(effects["nature/firefly-vines"], fireflyVines);
});

test("nature/firefly-vines drapes dark swaying vines from both upper corners, rims leaves in moonlight, swims fireflies with trails toward an open center, and loops seamlessly", () => {
  const { meta } = fireflyVines;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const frame = createFrame(W, H);

  const renderAt = (tSec, extra = {}) => {
    const inst = createFx(fireflyVines, { x: ox, y: oy, seed: 11, ...extra });
    inst.update(tSec);
    clearFrame(frame);
    inst.draw(frame, "back");
    inst.draw(frame, "front");
  };

  // 1. Both upper corners (`top-left` & `top-right`) feature lush dark botanical silhouettes,
  //    while the central-lower stage (`x in [115..205], y in [138..179]`) stays cleanly open for underlying scenes
  renderAt(2.4);
  let tlDarkFoliage = 0, trDarkFoliage = 0;
  for (let y = 0; y < 85; y++) {
    const row = y * W;
    for (let x = 0; x < 105; x++) {
      const c = frame.color[row + x];
      const a = c >>> 24, r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
      if (a >= 180 && r < 45 && g < 70 && b < 100) tlDarkFoliage++;
    }
    for (let x = 215; x < 320; x++) {
      const c = frame.color[row + x];
      const a = c >>> 24, r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
      if (a >= 180 && r < 45 && g < 70 && b < 100) trDarkFoliage++;
    }
  }
  assert.ok(tlDarkFoliage > 1800, `expected lush top-left vine silhouette coverage, got ${tlDarkFoliage}`);
  assert.ok(trDarkFoliage > 1800, `expected lush top-right vine silhouette coverage, got ${trDarkFoliage}`);

  let lowerCenterClear = 0;
  const cx0 = 115, cx1 = 205, cy0 = 138, cy1 = 179;
  const lowerCenterTotal = (cx1 - cx0 + 1) * (cy1 - cy0 + 1);
  for (let y = cy0; y <= cy1; y++) {
    const row = y * W;
    for (let x = cx0; x <= cx1; x++) {
      if ((frame.color[row + x] >>> 24) === 0) lowerCenterClear++;
    }
  }
  assert.ok(
    lowerCenterClear > lowerCenterTotal * 0.97,
    `expected lower-central arena to remain open for scene compositing: ${lowerCenterClear}/${lowerCenterTotal}`
  );

  // Underlying backdrop shows cleanly through the central stage
  const rgbaDark = new Uint8ClampedArray(W * H * 4);
  const rgbaLight = new Uint8ClampedArray(W * H * 4);
  composite(frame, rgbaDark, backdrop("dark", W, H, 160));
  composite(frame, rgbaLight, backdrop("light", W, H, 160));
  const stageIdx = (155 * W + 160) * 4 + 2;
  assert.ok(rgbaLight[stageIdx] > rgbaDark[stageIdx] + 150, "central-lower stage must transmit underlying backdrop");

  // 2. Hanging vines gently sway in the breeze across the 12s cycle (`t = 0.0s` vs `t = 3.0s`)
  renderAt(0.0);
  const colorT0 = new Uint32Array(frame.color);
  const lightT0 = new Uint32Array(frame.light);

  renderAt(3.0);
  let swayDiffPixels = 0;
  for (let y = 30; y < 145; y++) {
    const row = y * W;
    for (let x = 0; x < 95; x++) {
      if (frame.color[row + x] !== colorT0[row + x]) swayDiffPixels++;
    }
  }
  assert.ok(swayDiffPixels > 400, `expected hanging vines to sway visibly in the breeze, diff=${swayDiffPixels}`);

  // 3. Moonlight leaf-edge rim outlines (`叶片边缘偶尔泛起月光描边`) + soft, non-glaring yellow-green fireflies & trails
  //    both nestled in the vines and swimming coherently into the central glade (`x in [95..225], y in [30..130]`)
  let totalMoonRimPx = 0;
  let vineFireflyGlowPx = 0;
  let centerSwimmingGlowPx = 0;
  let whiteBlowoutPx = 0;
  for (const sampleT of [1.2, 3.6, 6.0, 8.4, 10.8]) {
    renderAt(sampleT);
    for (let i = 0; i < W * H; i++) {
      const l = frame.light[i];
      const lr = l & 255, lg = (l >>> 8) & 255, lb = (l >>> 16) & 255;
      if (lr > 220 && lg > 220 && lb > 200) whiteBlowoutPx++;
    }
    for (let y = 0; y < 95; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        if (x >= 100 && x <= 220) continue;
        const c = frame.color[row + x];
        const a = c >>> 24, r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
        if (a >= 200 && b >= 185 && g >= 145 && b > r + 35) totalMoonRimPx++;

        const l = frame.light[row + x];
        const lr = l & 255, lg = (l >>> 8) & 255, lb = (l >>> 16) & 255;
        if (lg > 26 && lg > lb * 1.35 && lr > lb) vineFireflyGlowPx++;
      }
    }
    for (let y = 30; y <= 130; y++) {
      const row = y * W;
      for (let x = 95; x <= 225; x++) {
        const l = frame.light[row + x];
        const lr = l & 255, lg = (l >>> 8) & 255, lb = (l >>> 16) & 255;
        if (lg > 22 && lg > lb * 1.35 && lr >= lb) centerSwimmingGlowPx++;
      }
    }
  }
  assert.equal(whiteBlowoutPx, 0, "firefly glow must remain mellow and eye-soothing with zero white blowout");
  assert.ok(totalMoonRimPx > 120, `expected shimmering silver-cyan moonlight rim pixels on leaves, got ${totalMoonRimPx}`);
  assert.ok(vineFireflyGlowPx > 250, `expected soft yellow-green fireflies kindling among corner vines, got ${vineFireflyGlowPx}`);
  assert.ok(centerSwimmingGlowPx > 250, `expected fireflies & trails gliding calmly toward screen center, got ${centerSwimmingGlowPx}`);

  // 4. Custom palette & moonlight options are respected
  renderAt(4.2, { palette: ["#220010", "#660030", "#cc2277", "#ff66bb", "#ffccee"] });
  let magentaGlowPx = 0;
  for (let i = 0; i < W * H; i++) {
    const l = frame.light[i];
    const lr = l & 255, lg = (l >>> 8) & 255;
    if (lr > 35 && lr > lg * 1.4) magentaGlowPx++;
  }
  assert.ok(magentaGlowPx > 80, `expected custom firefly palette to tint additive glow, got ${magentaGlowPx}`);

  // 5. Exact seamless loop continuity (`t = 0` vs `t = 12` via createFx wrapping, and direct `drawBack`/`draw` periodicity)
  renderAt(12.0);
  assert.deepEqual(frame.color, colorT0, "loop seam color buffer must match t = 0 exactly at t = duration");
  assert.deepEqual(frame.light, lightT0, "loop seam light buffer must match t = 0 exactly at t = duration");
});
