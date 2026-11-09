import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, createAct, composite } from "../src/core/index.js";
import * as flameWheel from "../src/fx/moves/flame-wheel.js";

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

test("moves/flame-wheel progresses cleanly from launch charge through spinning flight to target impact and empty end", () => {
  const { meta, act } = flameWheel;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.ok(act && act.target && act.hits?.length >= 3, "must export act choreography with launch, grind, and detonation hits");

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const TX = act.target.x;
  const frame = createFrame(W, H);

  // 1. Charge phase (t = 0.20s): pixels cluster near caster OX, zero pixels yet at target TX
  {
    const fx = createFx(flameWheel, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, 0.20);
    let casterPx = 0, targetPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (x < OX + 40) casterPx++;
        if (x > OX + TX - 30) targetPx++;
      }
    }
    assert.ok(casterPx > 120, `expected charge wheel pixels near caster, got ${casterPx}`);
    assert.equal(targetPx, 0, "projectile must not hit target during charge phase");
  }

  // 2. Mid-flight phase (t = 0.60s): spinning wheel advances well into mid-arena
  {
    const fx = createFx(flameWheel, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, 0.60);
    let midPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + 40; x < OX + TX - 35; x++) {
        if (frame.color[y * W + x] >>> 24) midPx++;
      }
    }
    assert.ok(midPx > 450, `expected sizable spinning flame wheel in mid-flight, got ${midPx}`);
  }

  // 3. Impact detonation peak (t = 1.08s): massive hit-result blast at target TX
  {
    const fx = createFx(flameWheel, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, 1.08);
    let impactPx = 0, lightSum = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + TX - 65; x < W; x++) {
        const idx = y * W + x;
        if (frame.color[idx] >>> 24) impactPx++;
        const v = frame.light[idx];
        lightSum += (v & 255) + ((v >>> 8) & 255) + ((v >>> 16) & 255);
      }
    }
    assert.ok(impactPx > 1400, `expected high-impact hit burst around target, got ${impactPx}`);
    assert.ok(lightSum > 100000, `expected strong scene illumination on impact, got ${lightSum}`);
  }

  // 4. Clean one-shot fadeout at t = duration
  {
    const fx = createFx(flameWheel, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end empty at t = duration");
  }
});

test("moves/flame-wheel act freezes, shakes, chars target, and finishes cleanly", () => {
  const [W, H] = flameWheel.meta.size;
  const [OX, OY] = flameWheel.meta.origin;
  const inst = createAct(flameWheel, { x: OX, y: OY, seed: 17 });
  const frame = createFrame(W, H);
  let sawFreeze = false, sawShake = false, sawChar = false;

  for (let i = 0; i < 300 && !inst.done(); i++) {
    inst.update(1 / 30);
    if (inst.frozen) sawFreeze = true;
    if (inst.shake[0] !== 0 || inst.shake[1] !== 0) sawShake = true;
    if (inst.targets[0]?.skin === "char") sawChar = true;
    if (i % 5 === 0) inst.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger hit-stop freeze");
  assert.ok(sawShake, "act must trigger screen shake");
  assert.ok(sawChar, "impact detonation must char the target");
  assert.ok(inst.done(), "act must finish cleanly");
});

test("moves/flame-wheel is deterministic and supports a 4-step custom palette", () => {
  const [W, H] = flameWheel.meta.size;
  const [OX, OY] = flameWheel.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H);

  const a = createFx(flameWheel, { x: OX, y: OY, seed: 23, palette: ["#141024", "#5a3c8c", "#c8a0f0", "#ffffff"] });
  const b = createFx(flameWheel, { x: OX, y: OY, seed: 23, palette: ["#141024", "#5a3c8c", "#c8a0f0", "#ffffff"] });
  const outA = stepTo(a, f1, 0.7);
  const outB = stepTo(b, f2, 0.7);

  assert.ok(countLit(f1.color) > 400);
  assert.deepEqual(Array.from(outA), Array.from(outB));
});
