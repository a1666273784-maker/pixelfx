import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as lavaBoulder from "../src/fx/fire/lava-boulder.js";

test("fire/lava-boulder is registered in src/fx/index.js with valid metadata", () => {
  const { meta, create } = lavaBoulder;
  assert.equal(meta.name, "Lava boulder");
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.deepEqual(meta.size, [336, 156]);
  assert.deepEqual(meta.origin, [46, 126]);
  assert.equal(typeof create, "function");
  assert.equal(effects["fire/lava-boulder"], lavaBoulder);
});

test("fire/lava-boulder progresses through left rift heave -> rolling boulder & persistent lava river -> volcanic shatter -> empty end", () => {
  const { meta } = lavaBoulder;
  const [W, H] = meta.size;
  const inst = createFx(lavaBoulder, { x: meta.origin[0], y: meta.origin[1], seed: 15 });
  const frame = createFrame(W, H);

  const countBox = (xMin, xMax, yMin = 0, yMax = H - 1) => {
    let n = 0;
    for (let y = yMin; y <= yMax; y++) {
      const row = y * W;
      for (let x = xMin; x <= xMax; x++) {
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

  // Phase 1: Left volcanic rift heave (t = 0.30s) — boulder present on left, right half empty
  t = stepTo(0.30, t);
  const leftHeavePx = countBox(0, 110, 60, 145);
  const rightEarlyPx = countBox(160, W - 1, 0, H - 1);
  assert.ok(leftHeavePx > 800, `expected magma boulder heaving at left at t=0.30s, got ${leftHeavePx}`);
  assert.equal(rightEarlyPx, 0, "expected right half of stage to be empty before boulder rolls across");

  // Phase 2: Rolling rightward & persistent molten lava river wake (t = 1.45s)
  t = stepTo(1.45, t);
  const trailWakePx = countBox(36, 130, 100, 142);
  const rollingFrontPx = countBox(140, 250, 70, 142);
  assert.ok(trailWakePx > 900, `expected persistent molten lava river & flames behind boulder, got ${trailWakePx}`);
  assert.ok(rollingFrontPx > 1200, `expected rolling boulder in front half at t=1.45s, got ${rollingFrontPx}`);

  // Phase 3: Volcanic shatter eruption & fracturing boulder halves at right (t = 2.35s)
  t = stepTo(2.35, t);
  const eruptionRightPx = countBox(190, 320, 40, 142);
  assert.ok(eruptionRightPx > 1400, `expected volcanic shatter eruption at right at t=2.35s, got ${eruptionRightPx}`);

  // Phase 4: Clean empty frame at duration (t = 4.60s)
  t = stepTo(meta.duration, t);
  const endPx = countBox(0, W - 1, 0, H - 1);
  assert.equal(endPx, 0, `expected 0 pixels at t=duration, got ${endPx}`);
});

test("fire/lava-boulder is deterministic by seed and supports custom palette & stone options", () => {
  const { meta } = lavaBoulder;
  const [W, H] = meta.size;
  const customPalette = ["#0a1e14", "#145238", "#229c64", "#46e896", "#ffffff"];
  const customStone = ["#0b0d14", "#242b42", "#52608c", "#94a6db"];

  const runAt = (opts) => {
    const inst = createFx(lavaBoulder, { x: meta.origin[0], y: meta.origin[1], ...opts });
    const f = createFrame(W, H);
    for (let i = 0; i < 45; i++) inst.update(1 / 30);
    inst.draw(f);
    return f.color.slice();
  };

  const a = runAt({ seed: 15 });
  const b = runAt({ seed: 15 });
  const c = runAt({ seed: 15, palette: customPalette, stone: customStone });

  assert.deepEqual(a, b, "same seed should produce identical frames");
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== c[i]) diff++;
  assert.ok(diff > 500, `expected custom palette/stone to recolor boulder and lava, got ${diff} differing pixels`);
});
