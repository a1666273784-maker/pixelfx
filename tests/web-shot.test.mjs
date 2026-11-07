import { test } from "node:test";
import assert from "node:assert/strict";
import { createFx, createFrame } from "../src/core/index.js";
import * as web from "../src/fx/projectiles/web-shot.js";

function frameAt(time, options = {}) {
  const f = createFrame(...web.meta.size);
  const fx = createFx(web, { x: web.meta.origin[0], y: web.meta.origin[1], ...options });
  fx.update(time);
  fx.draw(f);
  return f;
}
const count = f => f.color.reduce((n, c) => n + ((c >>> 24) !== 0), 0);

test("charge, flight, impact, web, and breakup all draw before an empty end", () => {
  for (const t of [0, 0.07, 0.15, 0.23, 0.30, 0.34, 0.6, 0.9, 1.15, 1.4]) {
    assert.ok(count(frameAt(t)) > 0, `nothing drawn at ${t}`);
  }
  const end = frameAt(web.meta.duration);
  assert.equal(count(end), 0);
  assert.ok(end.light.every(c => c === 0));
});

test("seed is repeatable and affects the web", () => {
  assert.deepEqual(frameAt(0.65, { seed: 42 }).color, frameAt(0.65, { seed: 42 }).color);
  assert.notDeepEqual(frameAt(0.65, { seed: 42 }).color, frameAt(0.65, { seed: 43 }).color);
});

test("silk and standard palette overrides recolor independently of tack", () => {
  const silk = ["#100000", "#ff2200"], palette = ["#001000", "#22ff00"];
  const baseline = frameAt(0.2).color;
  assert.notDeepEqual(frameAt(0.2, { silk }).color, baseline);
  assert.notDeepEqual(frameAt(0.2, { palette }).color, baseline);
  assert.notDeepEqual(frameAt(0.2, { silk, palette }).color, frameAt(0.2, { palette }).color);
});
