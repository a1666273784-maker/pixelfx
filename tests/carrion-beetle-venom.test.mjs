import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, createAct, composite } from "../src/core/index.js";
import * as carrionBeetleVenom from "../src/fx/moves/carrion-beetle-venom.js";

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

test("moves/carrion-beetle-venom charges, spits a dripping orb, splashes and leaves rot that clears", () => {
  const { meta, act } = carrionBeetleVenom;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.ok(act && act.target && act.hits?.length >= 3, "must export act choreography with spit and impact beats");

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const TX = act.target.x;
  const frame = createFrame(W, H);

  // 1. charge (t = 0.30s): fog and maw gather at the caster, nothing at the target yet
  {
    const fx = createFx(carrionBeetleVenom, { x: OX, y: OY, seed: 41 });
    stepTo(fx, frame, 0.3);
    let casterPx = 0, targetPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (x < OX + 96) casterPx++;
        if (x > OX + TX - 34) targetPx++;
      }
    }
    assert.ok(casterPx > 40, `expected a charging maw near the caster, got ${casterPx}`);
    assert.equal(targetPx, 0, "the orb must not reach the target during the charge");
  }

  // 2. flight (t = 0.82s): a fat venom orb with its dripping wake crossing mid-arena
  {
    const fx = createFx(carrionBeetleVenom, { x: OX, y: OY, seed: 41 });
    stepTo(fx, frame, 0.82);
    let midPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + 96; x < OX + TX - 20; x++) {
        if (frame.color[y * W + x] >>> 24) midPx++;
      }
    }
    assert.ok(midPx > 260, `expected a venom orb and its wake in mid-flight, got ${midPx}`);
  }

  // 3. impact (t = 1.06s): a big crimson splat, brightly lit, that also stains the floor
  {
    const fx = createFx(carrionBeetleVenom, { x: OX, y: OY, seed: 41 });
    stepTo(fx, frame, 1.06);
    let impactPx = 0, lightSum = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + TX - 70; x < W; x++) {
        const idx = y * W + x;
        if (frame.color[idx] >>> 24) impactPx++;
        const v = frame.light[idx];
        lightSum += (v & 255) + ((v >>> 8) & 255) + ((v >>> 16) & 255);
      }
    }
    assert.ok(impactPx > 900, `expected a heavy splash burst on impact, got ${impactPx}`);
    assert.ok(lightSum > 40000, `expected the impact to light the scene, got ${lightSum}`);
  }

  // 4. corrosion (t = 2.10s): red rot on the body plus black smoke rising above it
  {
    const fx = createFx(carrionBeetleVenom, { x: OX, y: OY, seed: 41 });
    stepTo(fx, frame, 2.1);
    let bodyPx = 0, smokePx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + TX - 26; x < OX + TX + 26; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (y > OY - 42) bodyPx++;
        else smokePx++;
      }
    }
    assert.ok(bodyPx > 120, `expected the victim's body to stay coated in rot, got ${bodyPx}`);
    assert.ok(smokePx > 40, `expected black smoke rising above the victim, got ${smokePx}`);
  }

  // 5. one-shot must be blank at t = duration
  {
    const fx = createFx(carrionBeetleVenom, { x: OX, y: OY, seed: 41 });
    stepTo(fx, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end empty at t = duration");
  }
});

test("moves/carrion-beetle-venom act freezes, shakes, chars, shakes the body and finishes cleanly", () => {
  const [W, H] = carrionBeetleVenom.meta.size;
  const [OX, OY] = carrionBeetleVenom.meta.origin;
  const inst = createAct(carrionBeetleVenom, { x: OX, y: OY, seed: 41 });
  const frame = createFrame(W, H);
  let sawFreeze = false, sawShake = false, sawChar = false, sawShiver = false, sawSway = false;

  for (let i = 0; i < 360 && !inst.done(); i++) {
    inst.update(1 / 30);
    if (inst.frozen) sawFreeze = true;
    if (inst.shake[0] !== 0 || inst.shake[1] !== 0) sawShake = true;
    if (inst.targets[0]?.skin === "char") sawChar = true;
    if ((inst.targets[0]?.shiver ?? 0) > 0) sawShiver = true;
    if (Math.abs(inst.targets[0]?.theta ?? 0) > 0.02) sawSway = true;
    if (i % 5 === 0) inst.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger hit-stop freeze");
  assert.ok(sawShake, "act must trigger screen shake");
  assert.ok(sawChar, "the venom hit must char the target");
  assert.ok(sawShiver, "corrosion must make the target shiver");
  assert.ok(sawSway, "the hit must rock the target on its spring");
  assert.ok(inst.done(), "act must finish cleanly");
});

test("moves/carrion-beetle-venom is deterministic and supports a 4-step custom palette", () => {
  const [W, H] = carrionBeetleVenom.meta.size;
  const [OX, OY] = carrionBeetleVenom.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H);

  const a = createFx(carrionBeetleVenom, { x: OX, y: OY, seed: 7, palette: ["#100818", "#40102c", "#a02040", "#ffffff"] });
  const b = createFx(carrionBeetleVenom, { x: OX, y: OY, seed: 7, palette: ["#100818", "#40102c", "#a02040", "#ffffff"] });
  const outA = stepTo(a, f1, 0.9);
  const outB = stepTo(b, f2, 0.9);

  assert.ok(countLit(f1.color) > 200);
  assert.deepEqual(Array.from(outA), Array.from(outB));
});
