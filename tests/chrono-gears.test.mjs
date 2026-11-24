import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, composite, backdrop, luma } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as chronoGears from "../src/fx/arcane/chrono-gears.js";

test("arcane/chrono-gears is registered with valid 16:9 loopable scene-overlay metadata", () => {
  const { meta, drawBack, draw } = chronoGears;
  assert.equal(meta.name, "Chrono gears");
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
  assert.equal(effects["arcane/chrono-gears"], chronoGears);
});

test("arcane/chrono-gears emerges from all four corners, keeps central scene open & semi-transparent, fires meshing sparks & pointer ticks, and loops seamlessly", () => {
  const { meta } = chronoGears;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const frame = createFrame(W, H);

  const renderAt = (tSec, seed = 7) => {
    const inst = createFx(chronoGears, { x: ox, y: oy, seed });
    inst.update(tSec);
    clearFrame(frame);
    inst.draw(frame, "back");
    inst.draw(frame, "front");
  };

  const quadWeightedCoverage = (x0, x1, y0, y1) => {
    let alphaSum = 0;
    for (let y = y0; y <= y1; y++) {
      const row = y * W;
      for (let x = x0; x <= x1; x++) {
        alphaSum += frame.color[row + x] >>> 24;
      }
    }
    return alphaSum;
  };

  // 1. Central stage (`x in [130..190], y in [62..118]`) stays cleanly open so underlying game scenes are unobstructed
  renderAt(4.2);
  let centerEmpty = 0;
  const cx0 = 130, cx1 = 190, cy0 = 62, cy1 = 118;
  const centerTotal = (cx1 - cx0 + 1) * (cy1 - cy0 + 1);
  for (let y = cy0; y <= cy1; y++) {
    const row = y * W;
    for (let x = cx0; x <= cx1; x++) {
      if ((frame.color[row + x] >>> 24) === 0) centerEmpty++;
    }
  }
  assert.ok(
    centerEmpty > centerTotal * 0.96,
    `expected central viewport to stay clear for underlying scenes: ${centerEmpty}/${centerTotal}`
  );

  // Zero opaque black noise specks anywhere in the overlay
  let opaqueBlackSpecks = 0;
  for (let i = 0; i < W * H; i++) {
    const c = frame.color[i];
    const a = c >>> 24, r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
    if (a === 255 && r < 20 && g < 20 && b < 20) opaqueBlackSpecks++;
  }
  assert.equal(opaqueBlackSpecks, 0, "expected zero opaque black specks in scene overlay");

  // 2. Four-corner emergence (`从四个角落浮现出`) and symmetric presence in all 4 corners
  renderAt(0.0);
  const tl0 = quadWeightedCoverage(0, 120, 0, 75);
  const tr0 = quadWeightedCoverage(199, 319, 0, 75);
  const bl0 = quadWeightedCoverage(0, 120, 104, 179);
  const br0 = quadWeightedCoverage(199, 319, 104, 179);

  renderAt(4.45);
  const tlMid = quadWeightedCoverage(0, 120, 0, 75);
  const trMid = quadWeightedCoverage(199, 319, 0, 75);
  const blMid = quadWeightedCoverage(0, 120, 104, 179);
  const brMid = quadWeightedCoverage(199, 319, 104, 179);

  // Verify exact co-axial corner hubs `(±140, ±74)` -> screen `(20, 16)`, `(300, 16)`, `(300, 164)`, `(20, 164)`
  // and verify Top-Left settled 75° Fate Hand (`t = 4.45s`) pierces dead-center from `(20, 16)` to the X numeral!
  for (const [hx, hy] of [[20, 16], [300, 16], [300, 164], [20, 164]]) {
    const hc = frame.color[hy * W + hx];
    assert.ok((hc >>> 24) >= 220 && luma(hc) > 0.85, `corner hub (${hx},${hy}) must be pinned at exact co-axial center`);
  }
  const ang75 = (75 * Math.PI) / 180;
  for (const rad of [12, 24, 38, 52]) {
    const sx = Math.round(20 + Math.cos(ang75) * rad);
    const sy = Math.round(16 + Math.sin(ang75) * rad);
    const pc = frame.color[sy * W + sx];
    assert.ok((pc >>> 24) >= 200 && luma(pc) > 0.80, `settled pointer ray must lie dead-on 75° at r=${rad} without offset`);
  }

  assert.ok(tl0 > 40000 && tr0 > 40000 && bl0 > 40000 && br0 > 40000, "all four corners should shimmer at t = 0");
  assert.ok(
    tlMid > tl0 * 1.45 && trMid > tr0 * 1.45 && blMid > bl0 * 1.45 && brMid > br0 * 1.45,
    `expected all 4 corner mechanisms to emerge strongly into full presence: t0=[${tl0},${tr0},${bl0},${br0}] -> mid=[${tlMid},${trMid},${blMid},${brMid}]`
  );

  // 3. Semi-transparent compositing (`半透明金色镂空`) lets underlying dark vs light backdrops show through
  const rgbaDark = new Uint8ClampedArray(W * H * 4);
  const rgbaLight = new Uint8ClampedArray(W * H * 4);
  composite(frame, rgbaDark, backdrop("dark", W, H, 160));
  composite(frame, rgbaLight, backdrop("light", W, H, 160));

  // Blue channel at center `(160, 90)` and inside a semi-transparent corner gear `(22, 18)` must reflect the backdrop
  const midBlueIdx = (90 * W + 160) * 4 + 2;
  assert.ok(rgbaLight[midBlueIdx] > rgbaDark[midBlueIdx] + 150, "center must show underlying backdrop");

  let semiTransparentCornerPixels = 0;
  for (let y = 0; y < 75; y++) {
    for (let x = 0; x < 120; x++) {
      const a = frame.color[y * W + x] >>> 24;
      if (a >= 40 && a <= 220) semiTransparentCornerPixels++;
    }
  }
  assert.ok(
    semiTransparentCornerPixels > 1800,
    `expected abundant semi-transparent golden clockwork pixels in each corner, got ${semiTransparentCornerPixels}`
  );

  // 4. Continuous gear motion + periodic bright glints/sparks across the steady-rotation window (`t = 2.5..9.5s`)
  renderAt(3.2);
  const snapA = frame.color.slice();
  renderAt(3.6);
  let movedPixels = 0;
  for (let i = 0; i < W * H; i++) if (frame.color[i] !== snapA[i]) movedPixels++;
  assert.ok(movedPixels > 2500, `expected rotating gears to continuously update pixels, got ${movedPixels}`);

  let peakHotGlints = 0;
  for (let k = 0; k < 24; k++) {
    renderAt(2.4 + k * 0.25);
    let hot = 0;
    for (let i = 0; i < W * H; i++) {
      const c = frame.color[i];
      if ((c >>> 24) >= 180 && luma(c) > 0.88) hot++;
    }
    if (hot > peakHotGlints) peakHotGlints = hot;
  }
  assert.ok(peakHotGlints > 80, `expected bright white-gold pointer glints and meshing sparks, got ${peakHotGlints}`);

  // 5. Seamless loop wrap (`t = 0` matches `t = 12`, and `f = 359 -> f = 0` has no seam jump)
  renderAt(0);
  const startColors = frame.color.slice();
  const startLight = frame.light.slice();

  renderAt(meta.duration);
  assert.deepEqual(frame.color, startColors, "t = duration must wrap cleanly to t = 0 color buffer");
  assert.deepEqual(frame.light, startLight, "t = duration must wrap cleanly to t = 0 light buffer");

  const nFrames = Math.round(meta.duration * meta.fps); // 360
  renderAt(((nFrames - 2) / nFrames) * meta.duration);
  const penultColors = frame.color.slice();
  renderAt(((nFrames - 1) / nFrames) * meta.duration);
  let normalStepDiff = 0, seamStepDiff = 0;
  for (let i = 0; i < W * H; i++) {
    if (frame.color[i] !== penultColors[i]) normalStepDiff++;
    if (frame.color[i] !== startColors[i]) seamStepDiff++;
  }
  assert.ok(
    seamStepDiff <= Math.max(normalStepDiff * 1.6, 50),
    `expected smooth loop transition across seam: seam=${seamStepDiff} vs step=${normalStepDiff}`
  );
});
