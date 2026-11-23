import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, createAct, WHITE } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as hourglassRewindHeal from "../src/fx/moves/hourglass-rewind-heal.js";

test("moves/hourglass-rewind-heal is registered in src/fx/index.js with valid metadata and revival act choreography", () => {
  const { meta, create, act } = hourglassRewindHeal;
  assert.equal(meta.name, "Hourglass rewind heal");
  assert.deepEqual(meta.size, [320, 216]);
  assert.deepEqual(meta.origin, [160, 176]);
  assert.ok(meta.size[0] / meta.size[1] < 1.5, "aspect ratio must stay < 1.5 so gallery renders ground & hero");
  assert.equal(meta.duration, 3.64);
  assert.equal(meta.loop, false);
  assert.equal(meta.actor, 2);
  assert.equal(meta.bg, "ground");
  assert.ok(meta.desc.length < 180);
  assert.equal(typeof create, "function");
  assert.equal(typeof act, "object");
  assert.ok(act.poses.length >= 8);
  assert.ok(act.hits.length >= 3);
  assert.equal(effects["moves/hourglass-rewind-heal"], hourglassRewindHeal);
});

test("moves/hourglass-rewind-heal progresses through colossal hourglass & pouring sand -> violent shatter & mid-air freeze -> anti-gravity rewind inflow -> golden melt ripples & clean clear", () => {
  const { meta } = hourglassRewindHeal;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const inst = createFx(hourglassRewindHeal, { x: ox, y: oy, seed: 19 });
  const frame = createFrame(W, H);

  const countBox = (xMin, xMax, yMin = 0, yMax = H - 1) => {
    let n = 0;
    const ax0 = Math.max(0, Math.floor(xMin));
    const ax1 = Math.min(W - 1, Math.ceil(xMax));
    const ay0 = Math.max(0, Math.floor(yMin));
    const ay1 = Math.min(H - 1, Math.ceil(yMax));
    for (let y = ay0; y <= ay1; y++) {
      const row = y * W;
      for (let x = ax0; x <= ax1; x++) {
        if ((frame.color[row + x] >>> 24) || (frame.light[row + x] & 0xffffff)) n++;
      }
    }
    return n;
  };

  const assertZeroBorderSpill = (label) => {
    let spill = 0;
    for (let x = 0; x < W; x++) {
      if ((frame.color[x] >>> 24) || (frame.light[x] & 0xffffff)) spill++;
      if ((frame.color[(H - 1) * W + x] >>> 24) || (frame.light[(H - 1) * W + x] & 0xffffff)) spill++;
    }
    for (let y = 0; y < H; y++) {
      if ((frame.color[y * W] >>> 24) || (frame.light[y * W] & 0xffffff)) spill++;
      if ((frame.color[y * W + (W - 1)] >>> 24) || (frame.light[y * W + (W - 1)] & 0xffffff)) spill++;
    }
    assert.equal(spill, 0, `expected zero canvas border spill at ${label}, got ${spill}`);
  };

  const stepTo = (targetT, curT) => {
    while (curT + 1 / 60 <= targetT + 1e-6) {
      inst.update(1 / 60);
      curT += 1 / 60;
    }
    clearFrame(frame);
    inst.draw(frame);
    return curT;
  };

  let t = 0;

  // Phase 1 (t = 0.35s): Colossal translucent glass hourglass + upper golden sand + pouring stream
  t = stepTo(0.35, t);
  assertZeroBorderSpill("t=0.35s");
  const upperBulb = countBox(ox - 45, ox + 45, oy - 138, oy - 72);
  const lowerBulb = countBox(ox - 45, ox + 45, oy - 64, oy + 2);
  assert.ok(upperBulb > 800, `expected colossal upper hourglass bulb & golden sand at t=0.35s, got ${upperBulb}`);
  assert.ok(lowerBulb > 800, `expected colossal lower hourglass bulb & pouring sand at t=0.35s, got ${lowerBulb}`);

  // Phase 2a (t = 0.80s): Violent shatter flash & radial crystal splinters
  t = stepTo(0.80, t);
  assertZeroBorderSpill("t=0.80s");
  const shatterPixels = countBox(ox - 95, ox + 95, oy - 150, oy + 4);
  assert.ok(shatterPixels > 2500, `expected violent crystal shatter & cascading sand at t=0.80s, got ${shatterPixels}`);

  // Phase 2b (t = 1.30s -> 1.38s): Mid-air time-freeze locks crystal shards & golden sand motionless!
  t = stepTo(1.30, t);
  assertZeroBorderSpill("t=1.30s");
  const snapA = new Uint32Array(frame.color);
  t = stepTo(1.38, t);
  assertZeroBorderSpill("t=1.38s");
  let identicalOpaque = 0, totalOpaque = 0;
  for (let i = 0; i < W * H; i++) {
    const a = snapA[i], b = frame.color[i];
    if ((a >>> 24) === 255 || (b >>> 24) === 255) {
      totalOpaque++;
      if (a === b) identicalOpaque++;
    }
  }
  assert.ok(totalOpaque > 350, `expected suspended opaque shards & golden sand grains during freeze, got ${totalOpaque}`);
  assert.ok(
    identicalOpaque / totalOpaque > 0.95,
    `expected frozen sand & shards to stay locked still between t=1.30s and t=1.38s, ratio=${identicalOpaque / totalOpaque}`
  );

  // Phase 3 (t = 2.12s): Anti-gravity rewind streams converging into the hero's body + early melt ripple
  t = stepTo(2.12, t);
  assertZeroBorderSpill("t=2.12s");
  const convergeCore = countBox(ox - 55, ox + 55, oy - 95, oy + 12);
  assert.ok(convergeCore > 1800, `expected converging golden sand ribbons & shards at t=2.12s, got ${convergeCore}`);

  // Phase 4 (t = 2.82s): Grand volumetric golden melt ripples (coupled 3D golden dome + perspective floor wave rings)
  t = stepTo(2.82, t);
  assertZeroBorderSpill("t=2.82s");
  const leftRipple = countBox(ox - 135, ox - 45, oy - 135, oy + 28);
  const rightRipple = countBox(ox + 45, ox + 135, oy - 135, oy + 28);
  assert.ok(leftRipple > 600, `expected expanding golden ripple on left side at t=2.82s, got ${leftRipple}`);
  assert.ok(rightRipple > 600, `expected expanding golden ripple on right side at t=2.82s, got ${rightRipple}`);

  // Clean fadeout (t = 3.64s): Zero lingering pixels at end of one-shot
  t = stepTo(3.64, t);
  const endPixels = countBox(0, W - 1, 0, H - 1);
  assert.equal(endPixels, 0, `expected 0 pixels at end t=3.64s, got ${endPixels}`);
});

test("moves/hourglass-rewind-heal runs cleanly in createAct with custom palette swap", () => {
  const { meta } = hourglassRewindHeal;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const scene = createAct(hourglassRewindHeal, {
    x: ox,
    y: oy,
    palette: ["#092418", "#165236", "#25915d", "#42d88b", "#89f8b8", "#c8ffe0", "#edfff5", "#ffffff"],
  });
  const frame = createFrame(W, H);

  for (let i = 0; i < 60; i++) scene.update(1 / 30);
  clearFrame(frame);
  scene.draw(frame);

  let lit = 0, whiteCount = 0;
  for (let i = 0; i < W * H; i++) {
    if (frame.color[i] >>> 24) lit++;
    if ((frame.color[i] >>> 0) === (WHITE >>> 0)) whiteCount++;
  }
  assert.ok(lit > 400, `expected active acted scene pixels with swapped palette, got ${lit}`);
  assert.ok(whiteCount > 10, `expected crisp white highlights preserved under palette swap, got ${whiteCount}`);
});
