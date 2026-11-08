import test from "node:test";
import assert from "node:assert/strict";
import * as fx from "../src/fx/fire/qilin-lightfall.js";
import { createFrame, painterFor, resolveOptions } from "../src/core/index.js";

function render(t, seed = 17) {
  const sim = fx.create(resolveOptions(fx.meta, { seed }));
  const steps = Math.floor(t * 120);
  for (let i = 0; i < steps; i++) sim.update(1 / 120);
  if (t - steps / 120 > 0) sim.update(t - steps / 120);
  const f = createFrame(320, 200), p = painterFor(f);
  p.place(160, 176);
  sim.drawBack(p); sim.draw(p);
  return f;
}

test("seeded lightfall is repeatable, and reseeding changes lightning", () => {
  const a = render(0.4), b = render(0.4), c = render(0.4, 42);
  assert.deepEqual(a.color, b.color);
  assert.deepEqual(a.light, b.light);
  assert.notDeepEqual(a.color, c.color);
});

test("pillar stays upright through the hold and narrowing phases; sides stay transparent", () => {
  for (const t of [0.3, 0.7, 1.2, 1.6, 2, 2.4]) {
    const f = render(t);
    for (const y of [20, 60, 100, 150]) assert.ok(f.color[y * 320 + 160], `pillar at ${t}, ${y}`);
    for (let y = 0; y < 120; y++) for (let x = 0; x < 320; x++) {
      if (x >= 108 && x <= 212) continue;
      assert.equal(f.color[y * 320 + x], 0);
      assert.equal(f.light[y * 320 + x], 0);
    }
  }
});

test("both effect buffers end empty at 2.8 seconds and later", () => {
  for (const t of [2.8, 3]) {
    const f = render(t);
    assert.ok(f.color.every(v => v === 0));
    assert.ok(f.light.every(v => v === 0));
  }
});
