import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, createAct, WHITE } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as crimsonSpireChain from "../src/fx/moves/crimson-spire-chain.js";

test("moves/crimson-spire-chain is registered in src/fx/index.js with valid Boss metadata and act choreography", () => {
  const { meta, create, act } = crimsonSpireChain;
  assert.equal(meta.name, "Crimson spire chain");
  assert.deepEqual(meta.size, [424, 240]);
  assert.deepEqual(meta.origin, [84, 198]);
  assert.equal(meta.duration, 4.10);
  assert.equal(meta.loop, false);
  assert.equal(meta.actor, 2);
  assert.equal(meta.bg, "ground");
  assert.equal(typeof create, "function");
  assert.equal(typeof act, "object");
  assert.equal(act.target.x, 186);
  assert.ok(act.poses.length >= 8);
  assert.ok(act.hits.length >= 7);
  assert.equal(effects["moves/crimson-spire-chain"], crimsonSpireChain);
});

test("moves/crimson-spire-chain progresses through downward compression & pale-grey/crimson ground wave -> crimson-gold ray & 3 spiralling flame pillars -> upward gold-red streamers & white hit-flash -> glowing dark-red floor band, charred-black ash & bluish-grey smoke -> empty end", () => {
  const { meta } = crimsonSpireChain;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const inst = createFx(crimsonSpireChain, { x: ox, y: oy, seed: 21 });
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
        if (frame.color[row + x] >>> 24) n++;
      }
    }
    return n;
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

  // Phase 1a (t = 0.14s): Heavy dark-crimson & flowing-gold energy mass compressing downward at SX = 18
  t = stepTo(0.14, t);
  const compressPixels = countBox(ox - 20, ox + 55, oy - 75, oy + 5);
  assert.ok(compressPixels > 400, `expected downward compressing energy mass at t=0.14s, got ${compressPixels}`);

  // Phase 1b (t = 0.36s): Ground-hugging mixed pale-grey & crimson shock air-wave around SX = 18
  t = stepTo(0.36, t);
  const waveLeft = countBox(ox - 60, ox - 5, oy - 22, oy + 12);
  const waveRight = countBox(ox + 35, ox + 95, oy - 22, oy + 12);
  assert.ok(waveLeft > 120 && waveRight > 120, `expected wide ground air-wave on both sides at t=0.36s, got L=${waveLeft}, R=${waveRight}`);

  // Phase 2 (t = 0.50s, 0.62s): Sequential eruption of 3 vertical spiralling flame pillars (x = 70, 128, 186)
  t = stepTo(0.50, t);
  const p1Early = countBox(ox + 52, ox + 88, oy - 130, oy - 30);
  const p2Early = countBox(ox + 110, ox + 146, oy - 130, oy - 30);
  assert.ok(p1Early > 600, `expected Pillar 1 erupted at t=0.50s, got ${p1Early}`);
  assert.equal(p2Early, 0, "expected Pillar 2 not yet erupted at t=0.50s");

  t = stepTo(0.62, t);
  const p2Mid = countBox(ox + 110, ox + 146, oy - 145, oy - 30);
  const p3Mid = countBox(ox + 168, ox + 206, oy - 155, oy - 30);
  assert.ok(p2Mid > 700, `expected Pillar 2 erupted at t=0.62s, got ${p2Mid}`);
  assert.equal(p3Mid, 0, "expected Pillar 3 not yet erupted at t=0.62s");

  // Phase 3 (t = 0.70s): Pillar 3 + Bottom-to-Top Gold-Red Streamers + Blinding White Hit-Flash on the Enemy
  t = stepTo(0.70, t);
  const p3Hit = countBox(ox + 160, ox + 220, oy - 170, oy + 6);
  assert.ok(p3Hit > 1600, `expected massive Pillar 3 + upward streamers + white hit-flash at t=0.70s, got ${p3Hit}`);

  let whiteCount = 0;
  for (let y = oy - 65; y <= oy + 2; y++) {
    const row = y * W;
    for (let x = ox + 155; x <= ox + 220; x++) {
      if ((frame.color[row + x] >>> 0) === (WHITE >>> 0)) whiteCount++;
    }
  }
  assert.ok(whiteCount > 100, `expected blinding white hit-flash pixels on enemy at t=0.70s, got ${whiteCount}`);

  // Phase 4 (t = 2.50s): Persistent dark-red glowing floor band + rising charred-black ash & bluish-grey smoke
  t = stepTo(2.50, t);
  const hotBandPixels = countBox(ox + 14, ox + 222, oy - 5, oy + 7);
  const risingSmokeAndAsh = countBox(ox + 14, ox + 225, oy - 110, oy - 8);
  assert.ok(hotBandPixels > 600, `expected glowing dark-red floor band at t=2.50s, got ${hotBandPixels}`);
  assert.ok(risingSmokeAndAsh > 800, `expected rising charred-black ash & bluish-grey smoke at t=2.50s, got ${risingSmokeAndAsh}`);

  // Final Frame (t = 4.10s): Cleanly faded out
  t = stepTo(meta.duration, t);
  assert.equal(countBox(0, W - 1, 0, H - 1), 0, "expected final frame at t=4.10s to fade out completely");
});

test("moves/crimson-spire-chain createAct scene steps smoothly with multi-stage hit-stop, screen shake, and clean completion", () => {
  const { meta } = crimsonSpireChain;
  const [W, H] = meta.size;
  const scene = createAct(crimsonSpireChain, { x: meta.origin[0], y: meta.origin[1], seed: 21 });
  const frame = createFrame(W, H);
  let maxShake = 0;
  let sawFreeze = false;

  for (let i = 0; i < 400 && !scene.done(); i++) {
    scene.update(1 / 30);
    const sh = Math.hypot(scene.shake[0], scene.shake[1]);
    if (sh > maxShake) maxShake = sh;
    if (scene.frozen) sawFreeze = true;
    if (i % 6 === 0) scene.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger oppressive hit-stop freeze");
  assert.ok(maxShake > 2.5, `expected strong screen shake during pillar eruption/impact, got ${maxShake}`);
  assert.ok(scene.done(), "act choreography must complete cleanly");
});

test("moves/crimson-spire-chain is deterministic by seed and supports custom palette, gold, and ash options", () => {
  const { meta } = crimsonSpireChain;
  const [W, H] = meta.size;
  const customPalette = ["#081624", "#12385e", "#2272b8", "#48b8ff", "#ffffff"];
  const customGold = ["#1a0826", "#581884", "#b246f2", "#f2c8ff"];
  const customAsh = ["#0a1412", "#1c3630", "#3c6e62", "#78b8a8"];

  const runAt = (opts) => {
    const inst = createFx(crimsonSpireChain, { x: meta.origin[0], y: meta.origin[1], ...opts });
    const f = createFrame(W, H);
    for (let i = 0; i < 25; i++) inst.update(1 / 30);
    inst.draw(f);
    return f.color.slice();
  };

  const a = runAt({ seed: 21 });
  const b = runAt({ seed: 21 });
  const c = runAt({ seed: 21, palette: customPalette, gold: customGold, ash: customAsh });

  assert.deepEqual(a, b, "same seed should produce identical frames");
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== c[i]) diff++;
  assert.ok(diff > 1000, `expected custom palette/gold/ash to recolor pillars and ground ray, got ${diff} differing pixels`);
});
