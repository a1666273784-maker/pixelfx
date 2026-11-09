import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, createAct, composite } from "../src/core/index.js";
import * as venomSpit from "../src/fx/moves/venom-spit.js";

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

test("moves/venom-spit progresses cleanly from jaw gather through twin spit barrage to acid corrosion pit and empty end", () => {
  const { meta, act } = venomSpit;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.ok(act && act.target && act.hits?.length >= 4, "must export act choreography with twin-spit hits");

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const TX = act.target.x;
  const frame = createFrame(W, H);

  // 1. Charge phase (t = 0.14s): venom streaks gather near caster, zero pixels yet at target TX
  {
    const fx = createFx(venomSpit, { x: OX, y: OY, seed: 29 });
    stepTo(fx, frame, 0.14);
    let casterPx = 0, targetPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (x < OX + 45) casterPx++;
        if (x > OX + TX - 30) targetPx++;
      }
    }
    assert.ok(casterPx > 25, `expected gather streaks near caster, got ${casterPx}`);
    assert.equal(targetPx, 0, "spit must not reach target during initial gather");
  }

  // 2. Heavy Beat-2 maw-glob mid-flight (t = 0.70s): colossal venom orb advances cleanly across mid-arena
  {
    const fx = createFx(venomSpit, { x: OX, y: OY, seed: 29 });
    stepTo(fx, frame, 0.70);
    let midPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + 45; x < OX + TX - 35; x++) {
        if (frame.color[y * W + x] >>> 24) midPx++;
      }
    }
    assert.ok(midPx > 320, `expected sizable venom orb & drip wake in mid-flight, got ${midPx}`);
  }

  // 3. Impact & acid pit corrosion phase (t = 0.94s hit peak and t = 1.50s sizzling acid pit)
  {
    const fxHit = createFx(venomSpit, { x: OX, y: OY, seed: 29 });
    stepTo(fxHit, frame, 0.94);
    let impactPx = 0, lightSum = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + TX - 65; x < W; x++) {
        const idx = y * W + x;
        if (frame.color[idx] >>> 24) impactPx++;
        const v = frame.light[idx];
        lightSum += (v & 255) + ((v >>> 8) & 255) + ((v >>> 16) & 255);
      }
    }
    assert.ok(impactPx > 1200, `expected strong hit-result splash burst around target, got ${impactPx}`);
    assert.ok(lightSum > 80000, `expected bright scene illumination on impact, got ${lightSum}`);

    const fxPit = createFx(venomSpit, { x: OX, y: OY, seed: 29 });
    stepTo(fxPit, frame, 1.50);
    let pitPx = 0;
    for (let y = OY - 2; y < OY + 10; y++) {
      for (let x = OX + TX - 60; x < OX + TX + 60; x++) {
        if (frame.color[y * W + x] >>> 24) pitPx++;
      }
    }
    assert.ok(pitPx > 260, `expected etched acid corrosion pit around target floor, got ${pitPx}`);
  }

  // 4. Clean one-shot fadeout at t = duration
  {
    const fx = createFx(venomSpit, { x: OX, y: OY, seed: 29 });
    stepTo(fx, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end empty at t = duration");
  }
});

test("moves/venom-spit act freezes, shakes, poisons & shivers target, and finishes cleanly", () => {
  const [W, H] = venomSpit.meta.size;
  const [OX, OY] = venomSpit.meta.origin;
  const inst = createAct(venomSpit, { x: OX, y: OY, seed: 29 });
  const frame = createFrame(W, H);
  let sawFreeze = false, sawShake = false, sawPoison = false, sawShiver = false;

  for (let i = 0; i < 320 && !inst.done(); i++) {
    inst.update(1 / 30);
    if (inst.frozen) sawFreeze = true;
    if (inst.shake[0] !== 0 || inst.shake[1] !== 0) sawShake = true;
    if (inst.targets[0]?.skin === "poison") sawPoison = true;
    if ((inst.targets[0]?.shiver ?? 0) > 0) sawShiver = true;
    if (i % 5 === 0) inst.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger hit-stop freeze");
  assert.ok(sawShake, "act must trigger screen shake");
  assert.ok(sawPoison, "venom hit must apply poison skin to target");
  assert.ok(sawShiver, "venom corrosion must make target shiver");
  assert.ok(inst.done(), "act must finish cleanly");
});

test("moves/venom-spit is deterministic and supports a 4-step custom palette", () => {
  const [W, H] = venomSpit.meta.size;
  const [OX, OY] = venomSpit.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H);

  const a = createFx(venomSpit, { x: OX, y: OY, seed: 37, palette: ["#141024", "#5a3c8c", "#c8a0f0", "#ffffff"] });
  const b = createFx(venomSpit, { x: OX, y: OY, seed: 37, palette: ["#141024", "#5a3c8c", "#c8a0f0", "#ffffff"] });
  const outA = stepTo(a, f1, 0.72);
  const outB = stepTo(b, f2, 0.72);

  assert.ok(countLit(f1.color) > 250);
  assert.deepEqual(Array.from(outA), Array.from(outB));
});
