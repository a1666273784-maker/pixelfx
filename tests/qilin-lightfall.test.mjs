import { test } from "node:test";
import assert from "node:assert/strict";
import { createFx, createFrame, composite } from "../src/core/index.js";
import * as fx from "../src/fx/fire/qilin-lightfall.js";

function at(t, options = {}) {
  const frame = createFrame(...fx.meta.size);
  const inst = createFx(fx, { x: 160, y: 176, ...options });
  inst.update(t);
  inst.draw(frame);
  return frame;
}
const count = a => a.reduce((n, v) => n + (v !== 0), 0);

test("timing and explicitly exported gameplay geometry", () => {
  assert.deepEqual(fx.meta.size, [320, 200]);
  assert.deepEqual(fx.meta.origin, [160, 176]);
  assert.equal(fx.meta.duration, 2.8);
  assert.deepEqual(fx.danger.column, { from: 0.2, to: 2.45, minX: -48, maxX: 48 });
  assert.deepEqual(fx.danger.shock, { from: 0.22, to: 0.9, halfWidth: 8 });
  assert.equal(fx.shockRadius(0.2), 20);
  assert.equal(fx.shockRadius(0.22), 90);
  assert.equal(fx.shockRadius(0.9), 200);
  assert.equal(fx.shockRadius(0.901), null);
});

test("visible and bright through the hold; terminal frame is transparent", () => {
  for (let i = 0; i < 84; i++) {
    const t = i / 30, f = at(t), rgba = composite(f, new Uint8ClampedArray(320 * 200 * 4));
    assert.ok(count(f.color), `empty at ${t}`);
    if (t <= 1.6) {
      let bright = false;
      for (let j = 0; j < rgba.length; j += 4) {
        const y = (0.2126 * rgba[j] + 0.7152 * rgba[j + 1] + 0.0722 * rgba[j + 2]) / 255;
        if (rgba[j + 3] && y >= 0.9) { bright = true; break; }
      }
      assert.ok(bright, `no bright pixel at ${t}`);
    }
  }
  const end = at(2.8);
  assert.equal(count(end.color), 0);
  assert.equal(count(end.light), 0);
});

test("seed repeatability and recoloring", () => {
  assert.deepEqual(at(0.7, { seed: 7 }).color, at(0.7, { seed: 7 }).color);
  assert.notDeepEqual(at(0.7, { seed: 7 }).color, at(0.7, { seed: 8 }).color);
  assert.notDeepEqual(at(0.7).color, at(0.7, { palette: ["#300000", "#ff0000", "#ffff00"] }).color);
});

test("residual line retracts from below", () => {
  const f = at(2.55), center = 160;
  assert.ok(f.color[5 * 320 + center]);
  assert.equal(f.color[175 * 320 + center], 0);
});
