import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, composite } from "../src/core/index.js";
import * as crimsonEruption from "../src/fx/fire/crimson-eruption.js";

function countLit(buf) {
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] >>> 24) n++;
  return n;
}

function stepTo(fx, frame, targetT, fps = 30) {
  const steps = Math.round(targetT * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  fx.draw(frame);
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

test("fire/crimson-eruption has no actor and progresses through omen, staggered black-to-red pillars, hit burst, and falling embers", () => {
  const { meta } = crimsonEruption;
  assert.equal(meta.actor, undefined, "must not include any character/actor");
  assert.equal("act" in crimsonEruption, false, "must not export character choreography");
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const frame = createFrame(W, H);

  // 1. Omen phase (t = 0.30s): ground omen ring lit near OY, sky above is still empty
  {
    const fx = createFx(crimsonEruption, { x: OX, y: OY, seed: 7 });
    stepTo(fx, frame, 0.30);
    let groundRingPx = 0, highSkyPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (y >= OY - 26) groundRingPx++;
        if (y < OY - 50) highSkyPx++;
      }
    }
    assert.ok(groundRingPx > 400, `expected omen ring pixels on ground, got ${groundRingPx}`);
    assert.equal(highSkyPx, 0, "pillars must not erupt during initial omen phase");
  }

  // 2. Hit burst peak (t = 0.93s) has stronger additive light than steady burn (t = 1.40s)
  let hitLightSum = 0, steadyLightSum = 0;
  {
    const fxHit = createFx(crimsonEruption, { x: OX, y: OY, seed: 7 });
    stepTo(fxHit, frame, 0.93);
    for (let i = 0; i < frame.light.length; i++) {
      const v = frame.light[i];
      hitLightSum += (v & 255) + ((v >>> 8) & 255) + ((v >>> 16) & 255);
    }

    const fxSteady = createFx(crimsonEruption, { x: OX, y: OY, seed: 7 });
    const lit = stepTo(fxSteady, frame, 1.40);
    for (let i = 0; i < frame.light.length; i++) {
      const v = frame.light[i];
      steadyLightSum += (v & 255) + ((v >>> 8) & 255) + ((v >>> 16) & 255);
    }
    assert.ok(hitLightSum > steadyLightSum * 1.15, "hit burst should boost scene illumination over steady burn");

    // 3. Pillar gradient check at t = 1.40s: dark-black roots vs bright-red crowns
    let rootLumaSum = 0, rootN = 0, crownLumaSum = 0, crownRedSum = 0, crownN = 0;
    for (let y = OY - 24; y <= OY - 6; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (!(frame.color[idx] >>> 24)) continue;
        const j = idx * 4;
        rootLumaSum += 0.2126 * lit[j] + 0.7152 * lit[j + 1] + 0.0722 * lit[j + 2];
        rootN++;
      }
    }
    for (let y = OY - 150; y <= OY - 105; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (!(frame.color[idx] >>> 24)) continue;
        const j = idx * 4;
        crownLumaSum += 0.2126 * lit[j] + 0.7152 * lit[j + 1] + 0.0722 * lit[j + 2];
        crownRedSum += lit[j];
        crownN++;
      }
    }
    assert.ok(rootN > 80 && crownN > 80, "expected solid pixels in both pillar roots and crowns");
    const avgRootLuma = rootLumaSum / rootN;
    const avgCrownLuma = crownLumaSum / crownN;
    const avgCrownRed = crownRedSum / crownN;
    assert.ok(avgCrownLuma > avgRootLuma * 2.0, `crown luma (${avgCrownLuma.toFixed(1)}) must substantially exceed dark root luma (${avgRootLuma.toFixed(1)})`);
    assert.ok(avgCrownRed > 180, `crown should read bright red, got average R=${avgCrownRed.toFixed(1)}`);
  }

  // 4. Ember collapse phase (t = 2.40s) and clean empty final frame (t = duration)
  {
    const fxEmber = createFx(crimsonEruption, { x: OX, y: OY, seed: 7 });
    stepTo(fxEmber, frame, 2.40);
    const emberPx = countLit(frame.color);
    assert.ok(emberPx > 120, `expected falling dark-red embers at t=2.40s, got ${emberPx}`);

    const fxEnd = createFx(crimsonEruption, { x: OX, y: OY, seed: 7 });
    stepTo(fxEnd, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end completely empty at t = duration");
  }
});

test("fire/crimson-eruption is deterministic and supports a 4-step custom palette", () => {
  const [W, H] = crimsonEruption.meta.size;
  const [OX, OY] = crimsonEruption.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H);

  const a = createFx(crimsonEruption, { x: OX, y: OY, seed: 19, palette: ["#101828", "#2d4a7a", "#66a3ff", "#e6f2ff"] });
  const b = createFx(crimsonEruption, { x: OX, y: OY, seed: 19, palette: ["#101828", "#2d4a7a", "#66a3ff", "#e6f2ff"] });
  const outA = stepTo(a, f1, 1.0);
  const outB = stepTo(b, f2, 1.0);

  assert.ok(countLit(f1.color) > 1000);
  assert.deepEqual(Array.from(outA), Array.from(outB));
});
