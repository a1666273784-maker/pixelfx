import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, createAct, composite } from "../src/core/index.js";
import * as emberFlash from "../src/fx/moves/ember-flash.js";

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

test("moves/ember-flash gathers a warm spark, pops a small fire wave and leaves a thin wisp and ash", () => {
  const { meta, act } = emberFlash;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.ok(act && act.target, "must export act choreography with a target");
  assert.equal(act.hits.length, 1);

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const TX = act.target.x;
  const frame = createFrame(W, H);
  const hit = act.hits[0].t;

  // 1. the charge (0.30s): a small warm spark on the mark, and darkness gathering round it
  {
    const fx = createFx(emberFlash, { x: OX, y: OY, seed: 41 });
    stepTo(fx, frame, 0.3);
    let corePx = 0, lightSum = 0, spreadPx = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const idx = y * W + x, d = Math.hypot(x - (OX + TX), y - (OY - 26));
        if (frame.color[idx] >>> 24) {
          if (d < 7) corePx++;
          if (d > 30) spreadPx++;
        }
        const v = frame.light[idx];
        if (d < 20) lightSum += (v & 255) + ((v >>> 8) & 255) + ((v >>> 16) & 255);
      }
    assert.ok(corePx > 14, `expected a small bright spark on the mark, got ${corePx}`);
    assert.ok(lightSum > 3000, `expected the spark to give off light, got ${lightSum}`);
    assert.ok(spreadPx < 60, `the charge must stay small, got ${spreadPx} px past 30 px`);
  }

  // 2. the pop (at the hit): a compact orange fire wave, a lit scene, and it must not grow into a big blast
  {
    const fx = createFx(emberFlash, { x: OX, y: OY, seed: 41 });
    stepTo(fx, frame, hit + 0.1);
    let firePx = 0, farPx = 0, lightSum = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const idx = y * W + x, c = frame.color[idx], d = Math.hypot(x - (OX + TX), y - (OY - 26));
        if (c >>> 24) {
          const r = c & 255, g = (c >>> 8) & 255;
          if (r > 120 && r > g + 30) firePx++;      // orange-red flame
          if (d > 48) farPx++;
        }
        const v = frame.light[idx];
        lightSum += (v & 255) + ((v >>> 8) & 255) + ((v >>> 16) & 255);
      }
    assert.ok(firePx > 120, `expected an orange-red fire wave at the pop, got ${firePx}`);
    assert.ok(lightSum > 8000, `expected the pop to light the scene, got ${lightSum}`);
    assert.equal(farPx, 0, "the wave must stay small - nothing past 48 px of the mark");
  }

  // 3. what it leaves (1.75s): a thin wisp above the mark, a few charred flakes settled below it
  {
    const fx = createFx(emberFlash, { x: OX, y: OY, seed: 41 });
    stepTo(fx, frame, 1.75);
    let wispPx = 0, wispW = 0, ashPx = 0, firePx = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const idx = y * W + x, c = frame.color[idx];
        if (!(c >>> 24)) continue;
        const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
        const nearX = Math.abs(x - (OX + TX)) < 26;
        if (nearX && y < OY - 40) {
          wispPx++;
          if (b >= r && b >= g) wispW++;      // the wisp is cool grey, not flame
        }
        if (Math.abs(x - (OX + TX)) < 20 && y > OY - 4 && y <= OY) ashPx++;
        if (r > 150 && r > b + 60) firePx++;
      }
    assert.ok(wispPx > 40, `expected a thin column of smoke above the mark, got ${wispPx}`);
    assert.ok(wispW > 30, `the smoke must read cool grey, got ${wispW} cool px`);
    assert.ok(ashPx >= 6, `expected a few charred flakes settled near the floor, got ${ashPx}`);
    assert.ok(firePx < 12, `the flame must be out by now, got ${firePx}`);
  }

  // 4. one-shot must be blank at t = duration
  {
    const fx = createFx(emberFlash, { x: OX, y: OY, seed: 41 });
    stepTo(fx, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end empty at t = duration");
  }
});

test("moves/ember-flash act freezes, shakes, flashes the target white and finishes cleanly", () => {
  const [W, H] = emberFlash.meta.size;
  const [OX, OY] = emberFlash.meta.origin;
  const inst = createAct(emberFlash, { x: OX, y: OY, seed: 41 });
  const frame = createFrame(W, H);
  let sawFreeze = false, sawShake = false, sawFlash = false, sawSway = false;

  for (let i = 0; i < 300 && !inst.done(); i++) {
    inst.update(1 / 30);
    if (inst.frozen) sawFreeze = true;
    if (inst.shake[0] !== 0 || inst.shake[1] !== 0) sawShake = true;
    if ((inst.targets[0]?.flashT ?? 0) > 0) sawFlash = true;
    if (Math.abs(inst.targets[0]?.theta ?? 0) > 0.02) sawSway = true;
    if (i % 5 === 0) inst.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger hit-stop freeze");
  assert.ok(sawShake, "act must trigger screen shake");
  assert.ok(sawFlash, "the hit must flash the target white");
  assert.ok(sawSway, "the hit must rock the target on its spring");
  assert.ok(inst.done(), "act must finish cleanly");
});

test("moves/ember-flash is deterministic and takes a custom palette", () => {
  const [W, H] = emberFlash.meta.size;
  const [OX, OY] = emberFlash.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H), f3 = createFrame(W, H);

  const a = createFx(emberFlash, { x: OX, y: OY, seed: 7 });
  const b = createFx(emberFlash, { x: OX, y: OY, seed: 7 });
  const outA = stepTo(a, f1, 0.9);
  const outB = stepTo(b, f2, 0.9);
  assert.ok(countLit(f1.color) > 60);
  assert.deepEqual(Array.from(outA), Array.from(outB));

  // a green flame: the palette drives the fire, not a fixed ramp
  const c = createFx(emberFlash, { x: OX, y: OY, seed: 7, palette: ["#04140a", "#0b2a12", "#145c22", "#1f9a34", "#38c94e", "#6be86a", "#a8f7a0", "#d8ffd0", "#f0fff0", "#ffffff"] });
  stepTo(c, f3, 0.62);
  let green = 0;
  for (let i = 0; i < f3.color.length; i++) {
    const v = f3.color[i];
    if (!(v >>> 24)) continue;
    const r = v & 255, g = (v >>> 8) & 255;
    if (g > 120 && g > r + 40) green++;
  }
  assert.ok(green > 60, `expected a green fire wave with a custom palette, got ${green}`);
});
