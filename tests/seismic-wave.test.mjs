import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createFrame, clearFrame, createFx, composite } from "../src/core/index.js";
import * as seismicWave from "../src/fx/nature/seismic-wave.js";

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

test("nature/seismic-wave is standalone VFX without actor or magic circle, heaving shattered rocks into a target hit cataclysm", () => {
  const { meta } = seismicWave;
  assert.equal(meta.actor, undefined, "must be pure VFX layer without character/actor");
  assert.equal("act" in seismicWave, false, "must not export actor choreography");
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");

  const src = readFileSync(new URL("../src/fx/nature/seismic-wave.js", import.meta.url), "utf8");
  assert.equal(/glyph|arcane\/_lib/.test(src), false, "must not use arcane runes or magic circle glyphs");

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const frame = createFrame(W, H);

  // 1. Release & traveling wave phase (t = 0.27s): airborne shattered rocks in high sky above origin, target not yet hit
  {
    const fx = createFx(seismicWave, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, 0.27);
    let airborneRockPx = 0, subFaultPx = 0, farTargetPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (x < OX + 130 && y < OY - 50) airborneRockPx++;
        if (y > OY + 2) subFaultPx++;
        if (x > OX + 175 && y < OY - 20) farTargetPx++;
      }
    }
    assert.ok(airborneRockPx > 120, `expected airborne shattered boulders above release crater, got ${airborneRockPx}`);
    assert.ok(subFaultPx > 60, `expected subterranean fault fissures in ground cross-section, got ${subFaultPx}`);
    assert.equal(farTargetPx, 0, "target zone must not detonate before shockwave arrives");
  }

  // 2. Target Hit-Result Cataclysm (t = 0.53s) spikes target-zone light & high-contrast burst pixels
  {
    const fxHit = createFx(seismicWave, { x: OX, y: OY, seed: 19 });
    stepTo(fxHit, frame, 0.53);
    let targetBurstPx = 0, targetLightSum = 0;
    for (let y = 0; y < OY; y++) {
      for (let x = OX + 140; x < W; x++) {
        const idx = y * W + x;
        if (frame.color[idx] >>> 24) targetBurstPx++;
        const v = frame.light[idx];
        targetLightSum += (v & 255) + ((v >>> 8) & 255) + ((v >>> 16) & 255);
      }
    }
    assert.ok(targetBurstPx > 900, `expected strong target hit-result burst pixels, got ${targetBurstPx}`);
    assert.ok(targetLightSum > 150000, `expected intense target hit illumination, got ${targetLightSum}`);
  }

  // 3. Oppressive Target Monolith Crown height (t = 0.80s reaches > 130px above floor)
  {
    const fxCrown = createFx(seismicWave, { x: OX, y: OY, seed: 19 });
    stepTo(fxCrown, frame, 0.80);
    let minY = H;
    for (let y = 0; y < OY; y++) {
      for (let x = OX + 150; x < OX + 225; x++) {
        if (frame.color[y * W + x] >>> 24) {
          if (y < minY) minY = y;
        }
      }
    }
    const crownHeight = OY - minY;
    assert.ok(crownHeight >= 135, `expected towering target monolith >= 135px tall, got ${crownHeight}px`);
  }

  // 4. Split-and-crumble rubble phase (t = 1.90s) and clean empty final frame (t = duration)
  {
    const fxCrumble = createFx(seismicWave, { x: OX, y: OY, seed: 19 });
    stepTo(fxCrumble, frame, 1.90);
    assert.ok(countLit(frame.color) > 800, "expected active crumbling boulders at t = 1.90s");

    const fxEnd = createFx(seismicWave, { x: OX, y: OY, seed: 19 });
    stepTo(fxEnd, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end completely empty at t = duration");
  }
});

test("nature/seismic-wave is deterministic and supports custom 4-step stone and glow ramps", () => {
  const [W, H] = seismicWave.meta.size;
  const [OX, OY] = seismicWave.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H);

  const opts = {
    x: OX,
    y: OY,
    seed: 23,
    stone: ["#101218", "#343b4d", "#7d8ba8", "#e8eefc"],
    glow: ["#2b1204", "#9c3d0c", "#ff9e2c", "#fff6d6"],
  };
  const outA = stepTo(createFx(seismicWave, opts), f1, 0.70);
  const outB = stepTo(createFx(seismicWave, opts), f2, 0.70);

  assert.ok(countLit(f1.color) > 1500);
  assert.deepEqual(f1.color, f2.color);
  assert.deepEqual(outA, outB);
});
