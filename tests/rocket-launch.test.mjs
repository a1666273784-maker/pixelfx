import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as rocketLaunch from "../src/fx/scifi/rocket-launch.js";

test("scifi/rocket-launch is registered in src/fx/index.js with valid metadata", () => {
  const { meta, create } = rocketLaunch;
  assert.equal(meta.name, "Rocket launch");
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.deepEqual(meta.size, [264, 284]);
  assert.deepEqual(meta.origin, [132, 250]);
  assert.equal(typeof create, "function");
  assert.equal(effects["scifi/rocket-launch"], rocketLaunch);
});

test("scifi/rocket-launch progresses through pad assembly -> ignition & trench cloud -> liftoff & sky ascent -> empty end", () => {
  const { meta } = rocketLaunch;
  const [W, H] = meta.size;
  const inst = createFx(rocketLaunch, { x: meta.origin[0], y: meta.origin[1], seed: 14 });
  const frame = createFrame(W, H);

  const countPixels = (yMin = 0, yMax = H - 1) => {
    let n = 0;
    for (let y = yMin; y <= yMax; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
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

  // Phase 1: Pad assembly & laser scan (t = 0.45s) — rocket and pad present in lower half, upper sky empty
  t = stepTo(0.45, t);
  const padPx = countPixels(140, 255);
  const earlyUpperSkyPx = countPixels(0, 100);
  assert.ok(padPx > 400, `expected rocket & pad assembly at t=0.45s, got ${padPx}`);
  assert.equal(earlyUpperSkyPx, 0, "expected upper sky to be empty before liftoff");

  // Phase 3: Main engine ignition & lateral flame trench deflection (t = 1.35s)
  t = stepTo(1.35, t);
  const ignPx = countPixels(130, 260);
  assert.ok(ignPx > padPx + 500, `expected ignition & trench plume (${ignPx}) > pad assembly (${padPx})`);

  // Phase 4: Supersonic ascent into upper sky (t = 2.95s) — rocket & exhaust reach upper half of canvas
  t = stepTo(2.95, t);
  const ascentUpperSkyPx = countPixels(0, 120);
  assert.ok(ascentUpperSkyPx > 400, `expected ascending rocket & plume in upper sky at t=2.95s, got ${ascentUpperSkyPx}`);

  // Phase 5: Clean end at duration (t = 5.5s)
  t = stepTo(meta.duration, t);
  const endPx = countPixels(0, H - 1);
  assert.equal(endPx, 0, `expected 0 pixels at t=duration, got ${endPx}`);
});

test("scifi/rocket-launch is deterministic by seed and supports custom 4-step palette", () => {
  const { meta } = rocketLaunch;
  const [W, H] = meta.size;
  const custom = ["#120924", "#4a1c8c", "#a85cf5", "#ffffff"];

  const runAt = (opts) => {
    const inst = createFx(rocketLaunch, { x: meta.origin[0], y: meta.origin[1], ...opts });
    const f = createFrame(W, H);
    for (let i = 0; i < 75; i++) inst.update(1 / 30);
    inst.draw(f);
    return f.color.slice();
  };

  const a = runAt({ seed: 14 });
  const b = runAt({ seed: 14 });
  const c = runAt({ seed: 14, palette: custom });

  assert.deepEqual(a, b, "same seed should produce identical frames");
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== c[i]) diff++;
  assert.ok(diff > 100, `expected custom palette to recolor exhaust plume, got ${diff} differing pixels`);
});
