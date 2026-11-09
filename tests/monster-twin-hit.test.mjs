import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, createFx } from "../src/core/index.js";
import * as impact from "../src/fx/impacts/monster-twin-hit.js";

function renderAt(t, options = {}) {
  const { size, origin } = impact.meta;
  const frame = createFrame(...size);
  const fx = createFx(impact, { x: origin[0], y: origin[1], seed: 13, ...options });
  // Small steps allow exact sampling at the declared duration as well as at the hit beats.
  const n = Math.round(t * 120);
  for (let i = 0; i < n; i++) fx.update(1 / 120);
  fx.draw(frame);
  return frame;
}

function countColor(frame) {
  return frame.color.reduce((n, c) => n + ((c >>> 24) !== 0), 0);
}

function brightIn(frame, cx, cy, r) {
  const [ox, oy] = impact.meta.origin;
  let count = 0;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const c = frame.color[(y + oy) * frame.w + x + ox];
      if ((c >>> 24) && (c & 255) > 210 && ((c >>> 8) & 255) > 125) count++;
    }
  }
  return count;
}

test("target-only twin hit has two staggered impacts and a larger detonation", () => {
  assert.equal(impact.meta.actor, undefined);
  assert.equal("act" in impact, false);
  assert.equal(impact.meta.loop, false);
  assert.equal(impact.meta.bg, "ground");

  const first = renderAt(1 / 30);
  assert.ok(brightIn(first, -16, -46, 8) > 100, "first blow lights the upper target");
  assert.ok(brightIn(first, 14, -20, 8) < 20, "lower blow has not landed yet");
  const second = renderAt(1 / 6);
  assert.ok(brightIn(second, 14, -20, 8) > 100, "second blow lights the lower target");
  assert.ok(brightIn(second, -16, -46, 8) > 10, "first impact leaves a visible scar");
  const detonation = renderAt(0.4);
  assert.ok(countColor(detonation) > countColor(second) * 2, "the final hit-result expands beyond either hit");
  assert.ok(countColor(renderAt(0.7)) > 1000, "blast and debris remain visible after the flash");
});

test("twin hit is deterministic, accepts a short palette and clears at its end", () => {
  const options = { seed: 7, palette: ["#101828", "#344f83", "#7ab1ff", "#ffffff"] };
  const a = renderAt(0.4, options), b = renderAt(0.4, options);
  assert.ok(countColor(a) > 1000);
  assert.deepEqual(a.color, b.color);
  assert.deepEqual(a.light, b.light);
  for (const seed of [2, 7, 13, 19]) {
    const end = renderAt(impact.meta.duration, { seed });
    assert.equal(countColor(end), 0, `seed ${seed} leaves no color pixels`);
    assert.ok(end.light.every((pixel) => pixel === 0), `seed ${seed} leaves no light`);
  }
});
