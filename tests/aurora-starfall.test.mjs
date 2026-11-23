import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as auroraStarfall from "../src/fx/weather/aurora-starfall.js";

function countPixelsInRegion(frame, x0, y0, x1, y1) {
  const { w, h, color, light } = frame;
  let count = 0;
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
      const i = y * w + x;
      if (color[i] !== 0 || light[i] !== 0) count++;
    }
  }
  return count;
}

test("weather/aurora-starfall is registered in effects catalog with expected meta", () => {
  assert.ok(effects["weather/aurora-starfall"], "Expected weather/aurora-starfall in effects index");
  const { meta } = auroraStarfall;
  assert.equal(meta.name, "Aurora starfall");
  assert.deepEqual(meta.size, [320, 180]);
  assert.deepEqual(meta.origin, [160, 152]);
  assert.equal(meta.duration, 4.5);
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.ok(meta.tags.includes("weather"));
  assert.ok(meta.tags.includes("aurora"));
  assert.ok(meta.tags.includes("star"));
});

test("weather/aurora-starfall renders all 4 cosmic phases and resolves cleanly", () => {
  const [w, h] = auroraStarfall.meta.size;
  const [ox, oy] = auroraStarfall.meta.origin;
  const inst = createFx(auroraStarfall, { x: ox, y: oy });
  const frame = createFrame(w, h);

  const stepTo = (targetT, curT) => {
    const dt = 1 / 60;
    while (curT + 1e-6 < targetT) {
      const step = Math.min(dt, targetT - curT);
      inst.update(step);
      curT += step;
    }
    clearFrame(frame);
    inst.draw(frame);
    return curT;
  };

  let curT = 0;

  // Phase 1 (0.55s): Interwoven emerald & magenta-violet ribbon aurora emerges & sways in upper sky (canvas y in [25..105])
  curT = stepTo(0.55, curT);
  const auroraSkyPx = countPixelsInRegion(frame, 10, 25, 310, 105);
  assert.ok(auroraSkyPx > 1200, `Expected emerging ribbon aurora in sky at t=0.55s, got ${auroraSkyPx}`);

  // Phase 2 (1.20s): Glowing stardust motes shake loose from inside the aurora and drift through mid-sky (canvas y in [95..148])
  curT = stepTo(1.20, curT);
  const stardustMidSkyPx = countPixelsInRegion(frame, 15, 95, 305, 148);
  assert.ok(stardustMidSkyPx > 120, `Expected falling stardust motes in mid-sky at t=1.20s, got ${stardustMidSkyPx}`);

  // Phase 3 & 4 (2.40s): Long-tailed shooting stars streak across the sky while the ground plane (canvas y in [152..178])
  // glows with flowing aurora reflections and stardust landing ripples
  curT = stepTo(2.40, curT);
  const climaxSkyPx = countPixelsInRegion(frame, 10, 15, 310, 150);
  const groundReflectionAndRipplePx = countPixelsInRegion(frame, 10, 152, 310, 178);
  assert.ok(climaxSkyPx > 2500, `Expected aurora + shooting stars in sky at t=2.40s, got ${climaxSkyPx}`);
  assert.ok(
    groundReflectionAndRipplePx > 1500,
    `Expected flowing aurora ground reflections and stardust landing ripples at t=2.40s, got ${groundReflectionAndRipplePx}`,
  );

  // Clean one-shot completion at t=4.50s
  curT = stepTo(4.50, curT);
  const endPx = countPixelsInRegion(frame, 0, 0, w - 1, h - 1);
  assert.equal(endPx, 0, `Expected 0 active pixels at end of one-shot effect (t=4.50s), got ${endPx}`);
});

test("weather/aurora-starfall supports custom palette options", () => {
  const [w, h] = auroraStarfall.meta.size;
  const [ox, oy] = auroraStarfall.meta.origin;
  const inst = createFx(auroraStarfall, {
    x: ox,
    y: oy,
    emerald: ["#082228", "#16505c", "#2898a8", "#50e2f0", "#b2faff", "#ffffff"],
    magenta: ["#28081e", "#5c1644", "#a8287a", "#f050b8", "#ffb2e6", "#ffffff"],
    seed: 42,
  });
  const frame = createFrame(w, h);
  inst.update(1.8);
  inst.draw(frame);
  const activePx = countPixelsInRegion(frame, 0, 0, w - 1, h - 1);
  assert.ok(activePx > 2000, `Expected custom-palette aurora-starfall to render >2000 pixels, got ${activePx}`);
});
