import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, composite } from "../src/core/index.js";
import * as inkCloudBanner from "../src/fx/ui/ink-cloud-banner.js";

function stepTo(fx, frame, targetT, fps = 30) {
  const steps = Math.round(targetT * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  fx.draw(frame);
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

const { meta } = inkCloudBanner;
const [W, H] = meta.size;
const [OX, OY] = meta.origin;

/** Pixels in a box, and how many of them are gold (withered yellow) or cold white. */
function survey(out, x0, y0, x1, y1) {
  let n = 0, gold = 0, white = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const o = (y * W + x) * 4, a = out[o + 3];
      if (!a) continue;
      const r = out[o], g = out[o + 1], b = out[o + 2];
      n++;
      if (r > 120 && r - b > 40 && g - b > 20) gold++;
      if (r > 200 && g > 200 && b > 200) white++;
    }
  return { n, gold, white };
}

test("ui/ink-cloud-banner: two currents gather, a gold line ignites, the notice goes solid, the wind takes it", () => {
  assert.equal(meta.loop, false);
  assert.deepEqual(meta.size, [320, 180]);
  assert.deepEqual(meta.origin, [160, 40]);
  assert.ok(meta.duration > 4 && meta.duration <= 6);

  const frame = createFrame(W, H);
  const run = (seed, t) => stepTo(createFx(inkCloudBanner, { x: OX, y: OY, ...meta.options, seed }), frame, t);

  // 1. release (t = 0.5): cloud banks either side of a clear middle, where the notice will open
  {
    const out = run(meta.options.seed, 0.5);
    const left = survey(out, 8, 10, 90, 70), right = survey(out, 230, 10, 312, 70), mid = survey(out, 140, 10, 180, 70);
    assert.ok(left.n > 120, `left current draws (${left.n} px)`);
    assert.ok(right.n > 120, `right current draws (${right.n} px)`);
    assert.ok(mid.n < left.n / 3, `the middle stays clear while the currents gather (${mid.n} px)`);
  }

  // 2. hit (t = 0.9): the withered-yellow line runs out across the middle
  {
    const out = run(meta.options.seed, 0.9);
    const spine = survey(out, OX - 80, OY - 3, OX + 80, OY + 4);
    assert.ok(spine.gold > 50, `gold line along the spine (${spine.gold} px)`);
  }

  // 3. fully open (t = 2.4): a cold-white notice holds solid over the band, words and all
  {
    const out = run(meta.options.seed, 2.4);
    const band = survey(out, OX - 100, OY - 32, OX + 100, OY + 18);
    assert.ok(band.n > 2500, `the notice covers its band (${band.n} px)`);
    assert.ok(band.white > 300, `cold white, 虚 turned 实 (${band.white} px)`);
    assert.ok(band.gold > 60, `the gold rule still holds it (${band.gold} px)`);
  }

  // 4. dissolve (t = 3.7): thin pale-cyan mist streaming, the notice torn loose
  {
    const out = run(meta.options.seed, 3.7);
    const sky = survey(out, 0, 4, W, 80), below = survey(out, 0, 74, W, 150);
    assert.ok(sky.n > 400, `the light turns to streaming mist (${sky.n} px)`);
    assert.ok(below.n < 150, `nothing is left hanging below the notice (${below.n} px)`);
  }

  // 5. one-shot ends empty
  {
    const out = run(meta.options.seed, meta.duration);
    assert.equal(survey(out, 0, 0, W, H).n, 0, "the screen is clear at t = duration");
  }

  // 6. seeded: the same seed repeats, another seed drifts differently
  {
    const a = run(11, 1.6), b = run(11, 1.6), c = run(23, 1.6);
    let same = 0, diff = 0;
    for (let i = 3; i < a.length; i += 4) {
      if (a[i] !== b[i]) same++;
      if (a[i] !== c[i]) diff++;
    }
    assert.equal(same, 0, "the same seed draws the same frame");
    assert.ok(diff > 40, `another seed boils differently (${diff} px differ)`);
  }
});
