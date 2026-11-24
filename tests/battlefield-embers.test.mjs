import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, composite, backdrop, luma } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as battlefieldEmbers from "../src/fx/weather/battlefield-embers.js";

test("weather/battlefield-embers is registered with valid 16:9 overlay loop metadata", () => {
  const { meta, drawBack, draw } = battlefieldEmbers;
  assert.equal(meta.name, "Battlefield embers");
  assert.deepEqual(meta.size, [320, 180]);
  assert.deepEqual(meta.origin, [160, 170]);
  assert.ok(Math.abs(meta.size[0] / meta.size[1] - 16 / 9) < 0.01, "must be 16:9 screen size");
  assert.equal(meta.duration, 8);
  assert.equal(meta.loop, true);
  assert.equal(meta.fps, 30);
  assert.equal(meta.bg, "ground");
  assert.ok(meta.desc.length <= 180);
  assert.equal(typeof drawBack, "function");
  assert.equal(typeof draw, "function");
  assert.equal(effects["weather/battlefield-embers"], battlefieldEmbers);
});

test("weather/battlefield-embers composites cleanly over environments with zero black noise specks, continuous bottom orange-red glow, spiral sparks, pop-forks, and seamless loop", () => {
  const { meta } = battlefieldEmbers;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const frame = createFrame(W, H);

  const renderAt = (tSec, seed = 13) => {
    const inst = createFx(battlefieldEmbers, { x: ox, y: oy, seed });
    inst.update(tSec);
    clearFrame(frame);
    inst.draw(frame, "back");
    inst.draw(frame, "front");
  };

  const regionLightRGB = (x0, x1, y0, y1) => {
    let rSum = 0, gSum = 0, bSum = 0;
    for (let y = y0; y <= y1; y++) {
      const row = y * W;
      for (let x = x0; x <= x1; x++) {
        const l = frame.light[row + x];
        rSum += l & 255;
        gSum += (l >>> 8) & 255;
        bSum += (l >>> 16) & 255;
      }
    }
    return [rSum, gSum, bSum];
  };

  const countBrightSparks = (x0, x1, y0, y1, minLuma = 0.55) => {
    let n = 0;
    for (let y = y0; y <= y1; y++) {
      const row = y * W;
      for (let x = x0; x <= x1; x++) {
        const c = frame.color[row + x];
        if ((c >>> 24) >= 180 && luma(c) >= minLuma) n++;
      }
    }
    return n;
  };

  // 1. Verify true environment-overlay transparency (`可叠加在环境中`) & zero opaque black noise specks (`零黑色杂点`)
  renderAt(1.2);
  let transparentUpperPixels = 0;
  let translucentOrEmptyUpper = 0;
  const upperTotal = W * 105;
  for (let i = 0; i < upperTotal; i++) {
    const a = frame.color[i] >>> 24;
    if (a === 0) transparentUpperPixels++;
    if (a < 128) translucentOrEmptyUpper++;
  }
  assert.ok(
    transparentUpperPixels > upperTotal * 0.84 && translucentOrEmptyUpper > upperTotal * 0.97,
    `expected upper/mid sky to stay transparent/translucent for scene overlaying: empty=${transparentUpperPixels}/${upperTotal}, translucent=${translucentOrEmptyUpper}/${upperTotal}`
  );

  let opaqueBlackSpecks = 0;
  for (let i = 0; i < W * H; i++) {
    const c = frame.color[i];
    const a = c >>> 24, r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
    if (a === 255 && r < 20 && g < 20 && b < 20) opaqueBlackSpecks++;
  }
  assert.equal(opaqueBlackSpecks, 0, "expected zero opaque black noise specks anywhere in the overlay");

  // Verify compositing over a transparent background (`bg = null`) produces transparent sky & glowing bottom
  const rgba = new Uint8ClampedArray(W * H * 4);
  composite(frame, rgba, null);
  let lowAlphaOut = 0;
  for (let i = 0; i < W * 90; i++) {
    if (rgba[i * 4 + 3] < 32) lowAlphaOut++;
  }
  assert.ok(lowAlphaOut > W * 90 * 0.90, "expected composite(frame, out, null) to preserve alpha transparency");

  // Verify compositing over different environments (`ground` vs `light`) shows the underlying scene right through, even at the bottom!
  const groundOut = new Uint8ClampedArray(W * H * 4);
  const lightOut  = new Uint8ClampedArray(W * H * 4);
  composite(frame, groundOut, backdrop("ground", W, H, oy));
  composite(frame, lightOut, backdrop("light", W, H, oy));
  const botIdx = (174 * W + 160) * 4;
  assert.ok(
    lightOut[botIdx + 2] > groundOut[botIdx + 2] + 80,
    "expected underlying environment to show right through the translucent bottom orange-red glow"
  );

  // 2. Continuous bottom orange-red glow + bright-orange sparks piercing out top + mid-air pop-flashes
  let totalTopExitSparks = 0;
  let totalWhiteHotPopPixels = 0;

  for (const t of [0.0, 1.3, 2.7, 4.1, 5.6, 7.1]) {
    renderAt(t);
    const [botR, botG, botB] = regionLightRGB(8, 311, 144, 178);
    const [topR, topG, topB] = regionLightRGB(8, 311, 8, 48);
    assert.ok(
      botR > 180000 && botR > botG * 2.2 && botG > botB * 2.5,
      `expected continuous searing orange-red bottom glow at t=${t}: R=${botR}, G=${botG}, B=${botB}`
    );
    assert.ok(
      botR + botG + botB > (topR + topG + topB) * 4,
      `expected bottom furnace glow to dominate upper sky at t=${t}`
    );

    totalTopExitSparks += countBrightSparks(4, 315, 0, 22, 0.50);
    totalWhiteHotPopPixels += countBrightSparks(4, 315, 8, 138, 0.92);
  }

  assert.ok(
    totalTopExitSparks >= 45,
    `expected bright-orange sparks to continuously ascend and pierce out the top edge: got ${totalTopExitSparks}`
  );
  assert.ok(
    totalWhiteHotPopPixels >= 20,
    `expected incandescent white-gold pop-flash & bifurcating sparks mid-air: got ${totalWhiteHotPopPixels}`
  );

  // 3. Seamless loop periodicity (`t = 8.0` matches `t = 0.0` identically)
  renderAt(0.0);
  const zeroColor = new Uint32Array(frame.color);
  const zeroLight = new Uint32Array(frame.light);

  renderAt(8.0);
  assert.deepEqual(frame.color, zeroColor, "expected exact color loop periodicity at t = duration (8.0s)");
  assert.deepEqual(frame.light, zeroLight, "expected exact light loop periodicity at t = duration (8.0s)");
});
