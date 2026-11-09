import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, composite } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as paleRisingSlash from "../src/fx/melee/pale-rising-slash.js";

function countLit(buf) {
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] >>> 24) n++;
  return n;
}

function stepTo(fx, frame, targetT, fps = 30) {
  const steps = Math.round(targetT * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  fx.drawBack?.(frame);
  fx.draw(frame);
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

test("melee/pale-rising-slash is registered with two-actor oppressive hit choreography", () => {
  assert.equal(effects["melee/pale-rising-slash"], paleRisingSlash);

  const { meta, act } = paleRisingSlash;
  assert.equal(meta.actor, 2);
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.ok(act && act.target && act.target.x > 60, "expected forward target placement");
  assert.ok(Array.isArray(act.poses) && act.poses.length >= 8);
  assert.ok(Array.isArray(act.hits) && act.hits.length >= 4);

  const mainHit = act.hits.find((h) => h.target !== false && h.stop >= 0.15);
  assert.ok(mainHit, "expected heavy oppressive hit-stop on primary impact");
  assert.ok(mainHit.amp >= 5 && mainHit.slide >= 18, "expected strong camera shake and knockback slide");

  const finalHit = act.hits[act.hits.length - 1];
  assert.equal(finalHit.skin, null, "target skin tint must reset cleanly before sequence end");
  assert.equal(finalHit.daze, 0, "target daze must clear before sequence end");
});

test("melee/pale-rising-slash sweeps upward from bottom to top, bursts into cross glare & scarlet sparks, drops white chips, and clears cleanly", () => {
  const { meta } = paleRisingSlash;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const frame = createFrame(W, H);

  // 1. Bottom-to-top release progression: t = 0.075s starts near floor before reaching upper sky; t = 0.135s reaches high overhead
  {
    const fxEarly = createFx(paleRisingSlash, { x: OX, y: OY, seed: 17 });
    stepTo(fxEarly, frame, 0.075, 60);
    let lowPx = 0, highSkyPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (y >= OY - 50) lowPx++;
        if (y < OY - 85) highSkyPx++;
      }
    }
    assert.ok(lowPx > 40, `expected bottom crescent ignition near floor at t=0.075s, got ${lowPx}`);
    assert.equal(highSkyPx, 0, "crescent must start at the bottom before sweeping into the upper sky");

    const fxRise = createFx(paleRisingSlash, { x: OX, y: OY, seed: 17 });
    const outRise = stepTo(fxRise, frame, 0.135, 60);
    let upperArcPx = 0, paleAshPx = 0, crimsonPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (!(frame.color[idx] >>> 24)) continue;
        if (y < OY - 75) upperArcPx++;
        const j = idx * 4;
        const r = outRise[j], g = outRise[j + 1], b = outRise[j + 2];
        if (r > 135 && Math.abs(r - b) < 35) paleAshPx++;
        if (r > 110 && r > g * 1.75 && r > b * 1.55) crimsonPx++;
      }
    }
    assert.ok(upperArcPx > 250, `expected rising crescent to reach upper sky by t=0.135s, got ${upperArcPx}`);
    assert.ok(paleAshPx > 350, `expected abundant ashen-white crescent & crystal pixels, got ${paleAshPx}`);
    assert.ok(crimsonPx > 80, `expected dark-crimson flowing light inside crescent, got ${crimsonPx}`);
  }

  // 2. Impact 4-arm pale cross glare + intense illumination spike (t = 0.20s)
  {
    const fxImpact = createFx(paleRisingSlash, { x: OX, y: OY, seed: 17 });
    stepTo(fxImpact, frame, 0.20);

    let lightEnergy = 0;
    for (let i = 0; i < frame.light.length; i++) {
      const v = frame.light[i];
      lightEnergy += (v & 255) + ((v >>> 8) & 255) + ((v >>> 16) & 255);
    }
    assert.ok(lightEnergy > 350000, `expected intense cross-glare illumination at impact, got ${lightEnergy}`);

    let minX = W, maxX = 0, minY = H, maxY = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    assert.ok(maxX - minX > 130, `expected wide horizontal cross-glare span >130px, got ${maxX - minX}`);
    assert.ok(maxY - minY > 110, `expected tall vertical crescent + cross-glare span >110px, got ${maxY - minY}`);
  }

  // 3. Splashing scarlet sparks & airborne/falling white fragments (t = 0.50s & t = 0.85s)
  {
    const fxAfter = createFx(paleRisingSlash, { x: OX, y: OY, seed: 17 });
    const outAfter = stepTo(fxAfter, frame, 0.50);
    let scarletSparkPx = 0, whiteChipPx = 0;
    for (let idx = 0; idx < W * H; idx++) {
      if (!(frame.color[idx] >>> 24)) continue;
      const j = idx * 4;
      const r = outAfter[j], g = outAfter[j + 1], b = outAfter[j + 2];
      if (r > 130 && r > g * 1.7 && r > b * 1.5) scarletSparkPx++;
      if (r > 180 && g > 175 && b > 185) whiteChipPx++;
    }
    assert.ok(scarletSparkPx > 60, `expected splashing scarlet sparks at t=0.50s, got ${scarletSparkPx}`);
    assert.ok(whiteChipPx > 40, `expected white crystal/fragment pixels at t=0.50s, got ${whiteChipPx}`);

    const fxGroundChips = createFx(paleRisingSlash, { x: OX, y: OY, seed: 17 });
    stepTo(fxGroundChips, frame, 0.85);
    let floorDebrisPx = 0;
    for (let y = OY - 12; y <= OY + 2; y++) {
      for (let x = 0; x < W; x++) {
        if (frame.color[y * W + x] >>> 24) floorDebrisPx++;
      }
    }
    assert.ok(floorDebrisPx > 45, `expected tiny white fragments settled/bouncing on floor at t=0.85s, got ${floorDebrisPx}`);
  }

  // 4. Clean empty final frame at t = duration
  {
    const fxEnd = createFx(paleRisingSlash, { x: OX, y: OY, seed: 17 });
    stepTo(fxEnd, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end completely empty at t = duration");
  }
});

test("melee/pale-rising-slash is deterministic and supports custom 4-step palette & crimson ramps", () => {
  const [W, H] = paleRisingSlash.meta.size;
  const [OX, OY] = paleRisingSlash.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H);

  const opts = {
    x: OX,
    y: OY,
    seed: 29,
    palette: ["#10141f", "#3a455e", "#9aa8c7", "#f2f6ff"],
    crimson: ["#22040a", "#7a0e22", "#e0243c", "#ff9ea4"],
  };
  const a = createFx(paleRisingSlash, opts);
  const b = createFx(paleRisingSlash, opts);
  const outA = stepTo(a, f1, 0.22);
  const outB = stepTo(b, f2, 0.22);

  assert.ok(countLit(f1.color) > 900);
  assert.deepEqual(Array.from(outA), Array.from(outB));
});
