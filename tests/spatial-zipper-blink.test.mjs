import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, createAct, WHITE } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as zipperMod from "../src/fx/moves/spatial-zipper-blink.js";

const countColor = (f) => {
  let n = 0;
  for (let i = 0; i < f.color.length; i++) if (f.color[i] >>> 24) n++;
  return n;
};

const countLight = (f) => {
  let n = 0;
  for (let i = 0; i < f.light.length; i++) if (f.light[i] & 0xffffff) n++;
  return n;
};

const countRegion = (f, x0, y0, x1, y1, pred = (c) => (c >>> 24) !== 0) => {
  let n = 0;
  for (let y = Math.max(0, y0); y <= Math.min(f.h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(f.w - 1, x1); x++) {
      const idx = y * f.w + x;
      if (pred(f.color[idx], f.light[idx])) n++;
    }
  }
  return n;
};

test("moves/spatial-zipper-blink is registered with valid metadata, options, and act choreography", () => {
  assert.ok(effects["moves/spatial-zipper-blink"], "effect should be registered in src/fx/index.js");
  const { meta, act, actorAlpha } = zipperMod;
  assert.equal(meta.name, "Spatial zipper blink");
  assert.equal(meta.loop, false);
  assert.equal(meta.duration, 3.75);
  assert.equal(meta.fps, 30);
  assert.equal(meta.bg, "ground");
  assert.equal(meta.actor, 2);
  assert.deepEqual(meta.size, [384, 208]);
  assert.deepEqual(meta.origin, [88, 168]);
  assert.equal(meta.options.palette.length, 8);
  assert.equal(meta.options.metal.length, 6);
  assert.equal(meta.options.sparks.length, 5);

  assert.ok(Array.isArray(act.poses) && act.poses.length >= 9);
  assert.ok(Array.isArray(act.hits) && act.hits.length >= 4);
  assert.ok(Array.isArray(act.dust) && act.dust.length >= 3);
  assert.equal(typeof actorAlpha, "function");
  assert.equal(actorAlpha(0.1), 1);
  assert.equal(actorAlpha(1.0), 0);
});

test("moves/spatial-zipper-blink executes all 4 phases (unzip & black hole -> swallow & zip shut -> destination unzip & spit out -> closure air-blast & clean end)", () => {
  const { meta } = zipperMod;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const inst = createFx(zipperMod, { x: OX, y: OY });
  const frame = createFrame(W, H);

  let curT = 0;
  const stepTo = (targetT) => {
    const dt = 1 / 30;
    while (curT + 1e-6 < targetT) {
      const step = Math.min(dt, targetT - curT);
      inst.update(step);
      curT += step;
    }
    clearFrame(frame);
    inst.draw(frame);
  };

  // Phase 1 (t = 0.55s): Entry Zipper 1 at Z1_X = 38 is open, revealing the pitch-black starry black hole interior
  stepTo(0.55);
  const z1CanvasX = OX + 38;
  const midCanvasY = OY - 50;
  const z1OpenPx = countRegion(frame, z1CanvasX - 24, OY - 102, z1CanvasX + 24, OY + 4);
  assert.ok(z1OpenPx > 400, `Expected open Zipper 1 and starry black hole at t=0.55s, got ${z1OpenPx}`);
  // Verify the black-hole event horizon center has dark abyss pixels (`#04020a`, low RGB) unwashed by external light
  const darkCorePx = countRegion(frame, z1CanvasX - 8, midCanvasY - 8, z1CanvasX + 8, midCanvasY + 8, (c, l) => {
    if (!(c >>> 24)) return false;
    const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
    return r + g + b < 45 && (l & 0xffffff) === 0;
  });
  assert.ok(darkCorePx > 30, `Expected unlit pitch-black event horizon inside Zipper 1, got ${darkCorePx}`);

  // Phase 2 (t = 0.75s): Hero is being spaghettified & swallowed into Zipper 1 (`x in [6..38]`)
  stepTo(0.75);
  const swallowStrands = countRegion(frame, OX + 4, OY - 44, z1CanvasX, OY - 4, (c, l) => (c >>> 24) !== 0 || (l & 0xffffff) !== 0);
  assert.ok(swallowStrands > 80, `Expected spaghettified hero strands being pulled into Zipper 1 at t=0.75s, got ${swallowStrands}`);

  // Phase 3 (t = 1.65s): Destination Zipper 2 at Z2_X = 152 rips open top-to-bottom
  stepTo(1.65);
  const z2CanvasX = OX + 152;
  const z2OpenPx = countRegion(frame, z2CanvasX - 24, OY - 102, z2CanvasX + 24, OY + 4);
  assert.ok(z2OpenPx > 400, `Expected open Destination Zipper 2 at t=1.65s, got ${z2OpenPx}`);

  // Spit-out (t = 1.80s): Hero is violently ejected out of Zipper 2 toward DEST_X = 196
  stepTo(1.80);
  const spitPx = countRegion(frame, z2CanvasX + 4, OY - 56, OX + 206, OY + 2, (c, l) => (c >>> 24) !== 0 || (l & 0xffffff) !== 0);
  assert.ok(spitPx > 120, `Expected hero ejection strands and body at t=1.80s, got ${spitPx}`);

  // Phase 4 (t = 2.48s): Destination Zipper 2 slams shut and detonates the Spatial Rift Closure Air-Blast!
  stepTo(2.48);
  const airBlastLeft = countRegion(frame, z2CanvasX - 65, OY - 95, z2CanvasX - 10, OY + 8, (c, l) => (c >>> 24) !== 0 || (l & 0xffffff) !== 0);
  const airBlastRight = countRegion(frame, z2CanvasX + 10, OY - 95, z2CanvasX + 65, OY + 8, (c, l) => (c >>> 24) !== 0 || (l & 0xffffff) !== 0);
  assert.ok(airBlastLeft > 150 && airBlastRight > 150, `Expected symmetric left/right closure air-blast waves at t=2.48s, got L=${airBlastLeft}, R=${airBlastRight}`);

  // Clean one-shot end at duration = 3.75s (only the ejected stand-in hero remains when drawn via render fallback, or 0 fx light)
  stepTo(meta.duration);
  assert.equal(countLight(frame), 0, "Expected 0 additive light pixels at end of one-shot effect");
});

test("moves/spatial-zipper-blink createAct hides the character during hyperspace transit and completes cleanly", () => {
  const actInst = createAct(zipperMod, { x: 88, y: 168 });
  const frame = createFrame(384, 208);

  // Advance to t = 1.15s (while hero is inside hyperspace between Zipper 1 and Zipper 2)
  for (let i = 0; i < 44; i++) actInst.update(1 / 30);
  clearFrame(frame);
  actInst.draw(frame);

  // Verify the destination landing spot (x = 88 + 196 = 284) has no premature character pixels yet
  const destEarlyPx = countRegion(frame, 88 + 180, 168 - 44, 88 + 212, 168);
  assert.equal(destEarlyPx, 0, "Hero should not appear at destination before Zipper 2 spits them out");

  // Run to completion
  for (let i = 0; i < 120 && !actInst.done(); i++) {
    actInst.update(1 / 30);
  }
  assert.equal(actInst.done(), true, "Act instance should complete cleanly");
});

test("moves/spatial-zipper-blink is deterministic for identical seeds", () => {
  const [W, H] = zipperMod.meta.size;
  const f1 = createFrame(W, H);
  const f2 = createFrame(W, H);
  const i1 = createFx(zipperMod, { seed: 42 });
  const i2 = createFx(zipperMod, { seed: 42 });

  for (let step = 0; step < 75; step++) {
    i1.update(1 / 30);
    i2.update(1 / 30);
  }
  i1.draw(f1);
  i2.draw(f2);
  assert.deepEqual(f1.color, f2.color);
  assert.deepEqual(f1.light, f2.light);
});
