import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, createAct, stockActor } from "../src/core/index.js";
import { shortfall } from "../src/core/rig.js";
import { effects } from "../src/fx/index.js";
import * as flurryCross from "../src/fx/moves/flurry-cross-slash.js";

const count = (buf, fn) => {
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (fn(buf[i], i)) n++;
  return n;
};

const colBounds = (frame) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
  const w = frame.w;
  for (let i = 0; i < frame.color.length; i++) {
    if (!(frame.color[i] >>> 24)) continue;
    n++;
    const x = i % w, y = Math.floor(i / w);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { n, w: n ? x1 - x0 + 1 : 0, h: n ? y1 - y0 + 1 : 0, x0, y0, x1, y1 };
};

describe("moves/flurry-cross-slash", () => {
  it("is registered in the catalog with valid stage move metadata and dual-sword act", () => {
    assert.equal(effects["moves/flurry-cross-slash"], flurryCross);
    assert.equal(flurryCross.meta.loop, false);
    assert.deepEqual(flurryCross.meta.size, [416, 248]);
    assert.deepEqual(flurryCross.meta.origin, [84, 196]);
    assert.equal(flurryCross.meta.bg, "ground");
    assert.equal(flurryCross.meta.actor, 2);
    assert.ok(flurryCross.act && Array.isArray(flurryCross.act.poses) && Array.isArray(flurryCross.act.hits));

    for (const [, p] of flurryCross.act.poses) {
      assert.equal(p.weapon, "sword");
      assert.equal(p.offWeapon, "sword");
      assert.ok(shortfall(p) <= 3.5, `arm reach shortfall ${shortfall(p)} exceeds 3.5px`);
    }
  });

  it("renders omnidirectional flurry, monumental cross cleave, and persistent cross-fissure before ending clean", () => {
    const { meta } = flurryCross;
    const [W, H] = meta.size;
    const [ox, oy] = meta.origin;
    const frame = createFrame(W, H);
    const fx = createFx(flurryCross, { x: ox, y: oy, actor: stockActor(2) });

    let maxFlurryPx = 0;
    let crossSpanW = 0, crossSpanH = 0, maxCrossLight = 0;
    let fissurePx = 0;
    const steps = Math.round(meta.duration * meta.fps);

    for (let i = 0; i <= steps; i++) {
      if (i > 0) fx.update(1 / meta.fps);
      const t = i / meta.fps;
      clearFrame(frame);
      fx.draw(frame);
      const b = colBounds(frame);

      if (t >= 0.08 && t <= 0.50) {
        maxFlurryPx = Math.max(maxFlurryPx, b.n);
      }
      if (t >= 0.78 && t <= 0.92) {
        crossSpanW = Math.max(crossSpanW, b.w);
        crossSpanH = Math.max(crossSpanH, b.h);
        maxCrossLight = Math.max(maxCrossLight, count(frame.light, (c) => (c & 0xffffff) !== 0));
      }
      if (t >= 1.45 && t <= 2.05) {
        fissurePx = Math.max(fissurePx, b.n);
      }
    }

    assert.ok(maxFlurryPx > 400, `expected rich curved blade flurry pixels, got ${maxFlurryPx}`);
    assert.ok(crossSpanW >= 180, `expected wide colossal horizontal cross span >= 180px, got ${crossSpanW}`);
    assert.ok(crossSpanH >= 125, `expected tall colossal vertical cross span >= 125px, got ${crossSpanH}`);
    assert.ok(maxCrossLight > 1500, `expected strong cross-impact additive glow, got ${maxCrossLight}`);
    assert.ok(fissurePx > 350, `expected persistent cross-shaped fissure pixels, got ${fissurePx}`);

    // Final frame at t = duration must end completely empty
    const endPx = count(frame.color, (c) => (c >>> 24) !== 0);
    assert.equal(endPx, 0, `one-shot should end with 0 pixels at t = duration, got ${endPx}`);
  });

  it("is deterministic across identical seeds and stays strictly inside canvas bounds", () => {
    const { meta } = flurryCross;
    const M = 48;
    const [W, H] = meta.size;
    const fw = W + M * 2;
    const frameA = createFrame(W + M * 2, H + M * 2, -M, -M);
    const frameB = createFrame(W + M * 2, H + M * 2, -M, -M);

    const a = createFx(flurryCross, { x: meta.origin[0], y: meta.origin[1], seed: 11 });
    const b = createFx(flurryCross, { x: meta.origin[0], y: meta.origin[1], seed: 11 });
    const steps = Math.round(meta.duration * meta.fps);

    for (let i = 0; i <= steps; i++) {
      if (i > 0) {
        a.update(1 / meta.fps);
        b.update(1 / meta.fps);
      }
      clearFrame(frameA);
      clearFrame(frameB);
      a.draw(frameA);
      b.draw(frameB);

      for (let j = 0; j < frameA.color.length; j++) {
        assert.equal(frameA.color[j], frameB.color[j], `non-deterministic pixel at step ${i}`);
        if (frameA.color[j] >>> 24) {
          const x = (j % fw) - M, y = Math.floor(j / fw) - M;
          assert.ok(x >= 0 && x < W && y >= 0 && y < H, `pixel spilled outside canvas at (${x}, ${y})`);
        }
      }
    }
  });

  it("completes the full acted sequence cleanly with target hit reactions and supports custom recoloring", () => {
    const [ox, oy] = flurryCross.meta.origin;
    const scene = createAct(flurryCross, { x: ox, y: oy, seed: 11 });
    const frame = createFrame(416, 248);
    let steps = 0, maxShake = 0;
    while (!scene.done() && steps < 300) {
      scene.update(1 / 30);
      maxShake = Math.max(maxShake, Math.hypot(scene.shake[0], scene.shake[1]));
      if (steps === 28 || steps === 42) {
        clearFrame(frame);
        scene.draw(frame);
      }
      steps++;
    }
    assert.ok(scene.done(), "acted sequence should finish cleanly within 300 frames");
    assert.ok(maxShake >= 3.0, `expected strong cross-cleave camera shake, got ${maxShake}`);

    const f1 = createFrame(416, 248), f2 = createFrame(416, 248);
    const i1 = createFx(flurryCross, { x: ox, y: oy, seed: 11 });
    const i2 = createFx(flurryCross, {
      x: ox, y: oy, seed: 11,
      palette: ["#120518", "#320c42", "#681888", "#a82cd4", "#df62ff", "#f2a8ff", "#fae0ff", "#ffffff"],
      sparks: ["#061e14", "#0e4830", "#1a8858", "#2ed488", "#74f6b8", "#c2ffe0", "#ffffff"],
    });
    for (let k = 0; k < 26; k++) {
      i1.update(1 / 30);
      i2.update(1 / 30);
    }
    i1.draw(f1);
    i2.draw(f2);
    let diff = 0;
    for (let j = 0; j < f1.color.length; j++) if (f1.color[j] !== f2.color[j]) diff++;
    assert.ok(diff > 400, `expected custom palette & sparks options to recolor effect, diff=${diff}`);
  });
});
