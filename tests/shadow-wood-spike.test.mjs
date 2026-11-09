import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, createAct, composite } from "../src/core/index.js";
import * as woodSpike from "../src/fx/moves/shadow-wood-spike.js";

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

test("moves/shadow-wood-spike progresses from 0.5s ground smoke/dirt warning to deadwood shadow eruption, shockwave, wood splinters, and empty end", () => {
  const { meta, act } = woodSpike;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.ok(act && act.target && act.hits?.length >= 3, "must export act choreography with release, warning, and impale hits");

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const TX = act.target.x;
  const frame = createFrame(W, H);

  // 1. Ground warning phase (t = 0.30s < 0.50s): purple-black smoke and churning dirt at target TX, spike NOT erupted yet
  {
    const fx = createFx(woodSpike, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, 0.30);
    let lowWarnPx = 0, highSpikePx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + TX - 35; x <= OX + TX + 35; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (y >= OY - 34) lowWarnPx++;
        if (y < OY - 48) highSpikePx++;
      }
    }
    assert.ok(lowWarnPx > 220, `expected warning smoke and churning dirt at target ground, got ${lowWarnPx}`);
    assert.equal(highSpikePx, 0, "deadwood spike must not pierce high before 0.5s eruption");
  }

  // 2. Eruption & shadow shock + wood splinter spread (t = 0.60s)
  {
    const fx = createFx(woodSpike, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, 0.60);
    let tallSpikePx = 0, splinterSpreadPx = 0, lightSum = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + TX - 65; x <= OX + TX + 65; x++) {
        const idx = y * W + x;
        if (frame.color[idx] >>> 24) {
          if (y < OY - 55) tallSpikePx++;
          if (Math.abs(x - (OX + TX)) > 22) splinterSpreadPx++;
        }
        const v = frame.light[idx];
        lightSum += (v & 255) + ((v >>> 8) & 255) + ((v >>> 16) & 255);
      }
    }
    assert.ok(tallSpikePx > 140, `expected tall deadwood spike piercing upward, got ${tallSpikePx}`);
    assert.ok(splinterSpreadPx > 140, `expected scattering wood splinters & burst ring around impact, got ${splinterSpreadPx}`);
    assert.ok(lightSum > 20000, `expected cohesive shadow impact lighting, got ${lightSum}`);
  }

  // 3. Back + front layering active while impaled spike stands (t = 1.15s)
  {
    const fx = createFx(woodSpike, { x: OX, y: OY, seed: 17 });
    for (let i = 0; i < Math.round(1.15 * 30); i++) fx.update(1 / 30);
    clearFrame(frame);
    fx.draw(frame, "back");
    const backPx = countLit(frame.color);
    clearFrame(frame);
    fx.draw(frame, "front");
    const frontPx = countLit(frame.color);
    assert.ok(backPx > 160, `expected back root-fangs and smoke behind target, got ${backPx}`);
    assert.ok(frontPx > 450, `expected primary deadwood shadow spike and debris on front layer, got ${frontPx}`);
  }

  // 4. Clean one-shot fadeout at t = duration (zero residual color or light)
  {
    const fx = createFx(woodSpike, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end empty at t = duration");
    assert.ok(frame.light.every((v) => v === 0), "light buffer must be empty at t = duration");
  }
});

test("moves/shadow-wood-spike act freezes, shakes, darkens target with shadow skin on impale, and ends cleanly", () => {
  const [W, H] = woodSpike.meta.size;
  const [OX, OY] = woodSpike.meta.origin;
  const inst = createAct(woodSpike, { x: OX, y: OY, seed: 17 });
  const frame = createFrame(W, H);
  let sawFreeze = false, sawShake = false, sawShadow = false;

  for (let i = 0; i < 320 && !inst.done(); i++) {
    inst.update(1 / 30);
    if (inst.frozen) sawFreeze = true;
    if (inst.shake[0] !== 0 || inst.shake[1] !== 0) sawShake = true;
    if (inst.targets[0]?.skin === "shadow") sawShadow = true;
    if (i % 5 === 0) inst.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger hit-stop freeze");
  assert.ok(sawShake, "act must trigger screen shake");
  assert.ok(sawShadow, "act must apply shadow skin tint to struck target on impale");
  assert.ok(inst.done(), "act must finish cleanly");
});

test("moves/shadow-wood-spike is deterministic by seed and recolors via custom palette and shadow", () => {
  const [W, H] = woodSpike.meta.size;
  const [OX, OY] = woodSpike.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H), f3 = createFrame(W, H);

  const a = createFx(woodSpike, { x: OX, y: OY, seed: 29 });
  const b = createFx(woodSpike, { x: OX, y: OY, seed: 29 });
  const c = createFx(woodSpike, {
    x: OX,
    y: OY,
    seed: 29,
    palette: ["#040a10", "#102838", "#2c6882", "#b8ecff"],
    shadow: ["#020a04", "#0a2a14", "#18622e", "#50d878"],
  });

  const outA = stepTo(a, f1, 0.70);
  const outB = stepTo(b, f2, 0.70);
  const outC = stepTo(c, f3, 0.70);

  assert.ok(countLit(f1.color) > 400);
  assert.deepEqual(Array.from(outA), Array.from(outB));
  assert.notDeepEqual(Array.from(outA), Array.from(outC));
});
