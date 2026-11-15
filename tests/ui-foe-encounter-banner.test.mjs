import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, composite } from "../src/core/index.js";
import * as foeEncounterBanner from "../src/fx/ui/foe-encounter-banner.js";

function stepTo(fx, frame, targetT, fps = 30) {
  const steps = Math.round(targetT * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  fx.draw(frame, "back");
  fx.draw(frame, "front");
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

const { meta } = foeEncounterBanner;
const [W, H] = meta.size;
const [OX, OY] = meta.origin;

/** Pixels in a box, and how many read coral-red, flame-orange or warm-white. */
function survey(out, x0, y0, x1, y1) {
  let n = 0, coral = 0, flame = 0, white = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const o = (y * W + x) * 4;
      if (!out[o + 3]) continue;
      const r = out[o], g = out[o + 1], b = out[o + 2];
      n++;
      if (r > 130 && r - g > 60 && g - b < 40) coral++;
      if (r > 150 && g > 90 && g - b >= 40 && r - b > 90) flame++;
      if (r > 225 && g > 225 && b > 215) white++;
    }
  return { n, coral, flame, white };
}

test("ui/foe-encounter-banner: mist pours in, a gleam ignites, the beam slashes the banner open, it slams and shatters", () => {
  assert.equal(meta.loop, false);
  assert.deepEqual(meta.size, [320, 180]);
  assert.ok(meta.duration > 4 && meta.duration <= 6);

  const frame = createFrame(W, H);
  const run = (seed, t) => stepTo(createFx(foeEncounterBanner, { x: OX, y: OY, ...meta.options, seed }), frame, t);

  // 1. release (t = 0.6): dark mist in from the top and bottom edges, the middle still clear, a gleam at the left
  {
    const out = run(meta.options.seed, 0.6);
    const top = survey(out, 0, 0, W, 40), bot = survey(out, 0, H - 40, W, H), mid = survey(out, 40, 60, W - 40, 120);
    assert.ok(top.n > 900, `mist pours in from the top edge (${top.n} px)`);
    assert.ok(bot.n > 900, `mist pours in from the bottom edge (${bot.n} px)`);
    assert.ok(mid.n < top.n / 4, `the middle of the screen stays clear (${mid.n} px)`);
    const gleam = survey(out, OX - 145, OY - 12, OX - 115, OY + 12);
    assert.ok(gleam.white > 4, `a piercing gleam burns at the left (${gleam.white} px)`);
  }

  // 2. hit (t = 1.04): the coral-and-white beam is mid-sweep across the middle
  {
    const out = run(meta.options.seed, 1.04);
    const cut = survey(out, 0, OY - 4, 170, OY + 5);
    assert.ok(cut.coral + cut.white > 60, `the beam slashes across the middle (${cut.coral} coral, ${cut.white} white px)`);
  }

  // 3. hold (t = 2.4): the grey band holds with flame on both edges and the warning type on it
  {
    const out = run(meta.options.seed, 2.4);
    const band = survey(out, OX - 110, OY - 14, OX + 110, OY + 15);
    assert.ok(band.n > 3000, `the banner band covers its strip (${band.n} px)`);
    assert.ok(band.flame > 90, `flame flows along the band's edges (${band.flame} px)`);
    assert.ok(band.coral > 60, `the coral warning type holds the centre (${band.coral} px)`);
    const above = survey(out, OX - 110, OY - 26, OX + 110, OY - 15);
    assert.ok(above.flame > 20, `tongues lick out past the band (${above.flame} px)`);
  }

  // 4. shatter (t = 3.5): coral sparks and pale mist where the banner was
  {
    const out = run(meta.options.seed, 3.5);
    const burst = survey(out, OX - 120, OY - 20, OX + 120, OY + 20);
    assert.ok(burst.coral > 150, `coral sparks spray out of the burst (${burst.coral} px)`);
    const later = run(meta.options.seed, 4.0);
    const mist = survey(later, 0, OY - 30, W, OY + 30);
    assert.ok(mist.n > 60, `pale mist drifts on the wind (${mist.n} px)`);
  }

  // 5. one-shot ends empty
  {
    const out = run(meta.options.seed, meta.duration);
    assert.equal(survey(out, 0, 0, W, H).n, 0, "the screen is clear at t = duration");
  }

  // 6. seeded: the same seed repeats, another seed boils differently
  {
    const a = run(11, 2.0), b = run(11, 2.0), c = run(23, 2.0);
    let same = 0, diff = 0;
    for (let i = 3; i < a.length; i += 4) {
      if (a[i] !== b[i]) same++;
      if (a[i] !== c[i]) diff++;
    }
    assert.equal(same, 0, "the same seed draws the same frame");
    assert.ok(diff > 40, `another seed boils differently (${diff} px differ)`);
  }
});
