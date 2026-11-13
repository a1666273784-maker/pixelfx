import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, composite } from "../src/core/index.js";
import * as crimsonRipple from "../src/fx/melee/crimson-ripple.js";

function stepTo(fx, frame, targetT, fps = 120) {
  const steps = Math.round(targetT * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  fx.draw(frame);
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

test("melee/crimson-ripple: a red light kindles at the palm, two gas rings roll forward, the enemy takes a tremor and embers, then it ends empty", () => {
  const { meta, act } = crimsonRipple;
  assert.equal(meta.loop, false);
  assert.ok(act && act.target && act.hits?.length >= 1, "must export act choreography with a hit");

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const HX = OX + 10, HY = OY - 22, TX = OX + 72;
  const frame = createFrame(W, H);
  const idx = (x, y) => (y * W + x) * 4;
  const litAt = (buf, x, y) => buf[idx(x, y) + 3] > 0;
  const redAt = (buf, x, y) => buf[idx(x, y) + 3] > 0 && buf[idx(x, y)] > buf[idx(x, y) + 2] + 20;

  // 1. release: a faint red light at the palm and nothing fired yet
  {
    const fx = createFx(crimsonRipple, { x: OX, y: OY, seed: 9 });
    const buf = stepTo(fx, frame, 0.1);
    let near = 0, far = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!litAt(buf, x, y)) continue;
      if (Math.abs(x - HX) < 8 && Math.abs(y - HY) < 8) near++;
      if (x > HX + 30) far++;
    }
    assert.ok(near > 3, `expected a faint light at the palm, got ${near}`);
    assert.equal(far, 0, "no ring should reach far out during the release");
  }

  // 2. gas rings: the second ring reaches out in front, and the pixels it lights are red
  {
    const fx = createFx(crimsonRipple, { x: OX, y: OY, seed: 9 });
    const buf = stepTo(fx, frame, 0.32);
    let reach = 0, reds = 0;
    for (let y = 0; y < H; y++) for (let x = HX + 6; x < W; x++) {
      if (!litAt(buf, x, y)) continue;
      reach = Math.max(reach, x - HX);
      if (redAt(buf, x, y)) reds++;
    }
    assert.ok(reach >= 40, `the rings should roll forward, reached ${reach}px`);
    assert.ok(reds > 10, `the gas rings should be red, got ${reds} red pixels`);
  }

  // 3. the hit: embers scatter round the enemy after the second ring arrives
  {
    const fx = createFx(crimsonRipple, { x: OX, y: OY, seed: 9 });
    const buf = stepTo(fx, frame, 0.6);
    let embers = 0;
    for (let y = 0; y < H; y++) for (let x = TX - 20; x < TX + 24; x++) if (x >= 0 && x < W && litAt(buf, x, y)) embers++;
    assert.ok(embers > 4, `expected embers round the enemy, got ${embers}`);
  }

  // 4. the end: everything has faded and nothing is drawn at the duration
  {
    const fx = createFx(crimsonRipple, { x: OX, y: OY, seed: 9 });
    const buf = stepTo(fx, frame, meta.duration);
    let n = 0;
    for (let i = 3; i < buf.length; i += 4) if (buf[i]) n++;
    assert.equal(n, 0, `the effect should end empty, got ${n} lit pixels`);
  }
});
