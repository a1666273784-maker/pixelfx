import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, createAct } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as mobiusMod from "../src/fx/moves/mobius-infinity-lock.js";

const countLight = (f) => {
  let n = 0;
  for (let i = 0; i < f.light.length; i++) if (f.light[i] & 0xffffff) n++;
  return n;
};

const countColor = (f) => {
  let n = 0;
  for (let i = 0; i < f.color.length; i++) if (f.color[i] >>> 24) n++;
  return n;
};

const countRegion = (f, x0, y0, x1, y1, pred = (c, l) => (c >>> 24) !== 0 || (l & 0xffffff) !== 0) => {
  let n = 0;
  for (let y = Math.max(0, y0); y <= Math.min(f.h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(f.w - 1, x1); x++) {
      const idx = y * f.w + x;
      if (pred(f.color[idx], f.light[idx])) n++;
    }
  }
  return n;
};

test("moves/mobius-infinity-lock is registered with valid metadata, 4 color ramps, and struggling/crushed act choreography", () => {
  assert.ok(effects["moves/mobius-infinity-lock"], "effect should be registered in src/fx/index.js");
  const { meta, act } = mobiusMod;
  assert.equal(meta.name, "Mobius infinity lock");
  assert.equal(meta.loop, false);
  assert.equal(meta.duration, 3.9);
  assert.equal(meta.fps, 30);
  assert.equal(meta.bg, "ground");
  assert.equal(meta.actor, 2);
  assert.deepEqual(meta.size, [288, 204]);
  assert.deepEqual(meta.origin, [144, 162]);
  assert.equal(meta.options.cyan.length, 6);
  assert.equal(meta.options.magenta.length, 6);
  assert.equal(meta.options.gold.length, 6);
  assert.equal(meta.options.pressure.length, 6);

  assert.ok(Array.isArray(act.poses) && act.poses.length >= 14);
  assert.ok(Array.isArray(act.hits) && act.hits.length >= 6);
  assert.ok(Array.isArray(act.dust) && act.dust.length >= 4);
});

test("moves/mobius-infinity-lock progresses through dual ribbon weave -> head-to-tail 3D infinity lock -> accelerating circulation & heavy descending light-pressure -> clean end", () => {
  const { meta } = mobiusMod;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const inst = createFx(mobiusMod, { x: OX, y: OY });
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

  // Phase 1 (t = 0.50s): Dual colorful ribbons spiraling & interweaving around the target
  stepTo(0.50);
  const weavePx = countRegion(frame, OX - 65, OY - 75, OX + 65, OY);
  assert.ok(weavePx > 350, `Expected weaving colorful ribbons around target at t=0.50s, got ${weavePx}`);

  // Phase 2 (t = 1.02s): Head-to-tail snap-lock into the 3D "∞" Möbius halo spanning left & right lobes
  stepTo(1.02);
  const leftLobePx = countRegion(frame, OX - 66, OY - 68, OX - 18, OY - 14);
  const rightLobePx = countRegion(frame, OX + 18, OY - 68, OX + 66, OY - 14);
  const nexusPx = countRegion(frame, OX - 16, OY - 56, OX + 16, OY - 24);
  assert.ok(leftLobePx > 180 && rightLobePx > 180 && nexusPx > 150, `Expected full 3D infinity halo at t=1.02s, got L=${leftLobePx}, R=${rightLobePx}, N=${nexusPx}`);

  // Phase 3 (t = 2.60s): Accelerating light-stream circulation & Climax Heavy Descending Light-Pressure wave
  stepTo(2.60);
  const pressureZonePx = countRegion(frame, OX - 60, OY - 38, OX + 60, OY + 4);
  const floorShockPx = countRegion(frame, OX - 95, OY - 16, OX + 95, OY + 22);
  assert.ok(pressureZonePx > 450, `Expected heavy descending light-pressure curtain & compression rings at t=2.60s, got ${pressureZonePx}`);
  assert.ok(floorShockPx > 300, `Expected crushing floor shockwave rings at t=2.60s, got ${floorShockPx}`);

  // Phase 4 (t = 3.90s): Clean one-shot completion with 0 active pixels and 0 light
  stepTo(meta.duration);
  assert.equal(countColor(frame), 0, "Expected 0 color pixels at end of one-shot effect");
  assert.equal(countLight(frame), 0, "Expected 0 light pixels at end of one-shot effect");
});

test("moves/mobius-infinity-lock createAct executes full struggle and light-pressure crouch sequence cleanly", () => {
  const actInst = createAct(mobiusMod, { x: 144, y: 162 });
  const frame = createFrame(288, 204);

  for (let i = 0; i < 160 && !actInst.done(); i++) {
    actInst.update(1 / 30);
    if (i % 10 === 0) {
      clearFrame(frame);
      actInst.draw(frame);
    }
  }
  assert.equal(actInst.done(), true, "Act instance should complete cleanly");
});

test("moves/mobius-infinity-lock is deterministic for identical seeds", () => {
  const [W, H] = mobiusMod.meta.size;
  const [OX, OY] = mobiusMod.meta.origin;
  const f1 = createFrame(W, H);
  const f2 = createFrame(W, H);
  const i1 = createFx(mobiusMod, { x: OX, y: OY, seed: 77 });
  const i2 = createFx(mobiusMod, { x: OX, y: OY, seed: 77 });

  for (let step = 0; step < 60; step++) {
    i1.update(1 / 30);
    i2.update(1 / 30);
  }
  i1.draw(f1);
  i2.draw(f2);
  assert.deepEqual(f1.color, f2.color);
  assert.deepEqual(f1.light, f2.light);
});
