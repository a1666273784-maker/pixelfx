import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, composite } from "../src/core/index.js";
import * as venomDeluge from "../src/fx/nature/venom-deluge.js";

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

test("nature/venom-deluge progresses through jaw swell/drool, continuous deluge torrent, impact splash, acid swamp corrosion, and empty end", () => {
  const { meta } = venomDeluge;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.equal(meta.actor, undefined);

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const frame = createFrame(W, H);

  // 1. Jaw gather & drool phase (t = 0.24s): monster head & throat sac drawn near origin, zero pixels at far impact zone
  {
    const fx = createFx(venomDeluge, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, 0.24);
    let mawPx = 0, impactPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (x <= OX + 30) mawPx++;
        if (x >= OX + 130) impactPx++;
      }
    }
    assert.ok(mawPx > 450, `expected monster head, throat sac, and drool pixels, got ${mawPx}`);
    assert.equal(impactPx, 0, "deluge must not reach impact zone before T_BLAST");
  }

  // 2. Continuous liquid torrent & violent impact phase (t = 0.85s): heavy stream spans mid-arena into splash crater
  {
    const fx = createFx(venomDeluge, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, 0.85);
    let streamPx = 0, splashPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + 25; x < OX + 140; x++) {
        if (frame.color[y * W + x] >>> 24) streamPx++;
      }
      for (let x = OX + 140; x < W; x++) {
        if (frame.color[y * W + x] >>> 24) splashPx++;
      }
    }
    assert.ok(streamPx > 1400, `expected thick continuous liquid venom column in mid-span, got ${streamPx}`);
    assert.ok(splashPx > 1000, `expected violent splash plumes & flood surf at impact zone, got ${splashPx}`);
  }

  // 3. Boiling corrosive acid swamp aftermath (t = 1.90s): stream shut, wide etched crater & fumes remain
  {
    const fx = createFx(venomDeluge, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, 1.90);
    let swampPx = 0;
    for (let y = OY - 40; y < H; y++) {
      for (let x = OX + 120; x < W; x++) {
        if (frame.color[y * W + x] >>> 24) swampPx++;
      }
    }
    assert.ok(swampPx > 350, `expected etched boiling acid swamp & rising steam, got ${swampPx}`);
  }

  // 4. Clean one-shot end at t = duration
  {
    const fx = createFx(venomDeluge, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end empty at t = duration");
  }
});

test("nature/venom-deluge supports monster: false for modular boss integration", () => {
  const [W, H] = venomDeluge.meta.size;
  const [OX, OY] = venomDeluge.meta.origin;
  const frame = createFrame(W, H);
  const fx = createFx(venomDeluge, { x: OX, y: OY, seed: 17, monster: false });
  stepTo(fx, frame, 0.24);
  let leftNeckPx = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < OX - 12; x++) {
      if (frame.color[y * W + x] >>> 24) leftNeckPx++;
    }
  }
  assert.equal(leftNeckPx, 0, "monster: false must omit beast head/neck pixels behind mouth");
});

test("nature/venom-deluge is deterministic and supports custom 4-step palette", () => {
  const [W, H] = venomDeluge.meta.size;
  const [OX, OY] = venomDeluge.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H);

  const a = createFx(venomDeluge, { x: OX, y: OY, seed: 41, palette: ["#100820", "#502080", "#b870f0", "#ffffff"] });
  const b = createFx(venomDeluge, { x: OX, y: OY, seed: 41, palette: ["#100820", "#502080", "#b870f0", "#ffffff"] });
  const outA = stepTo(a, f1, 0.85);
  const outB = stepTo(b, f2, 0.85);

  assert.ok(countLit(f1.color) > 1500);
  assert.deepEqual(Array.from(outA), Array.from(outB));
});
