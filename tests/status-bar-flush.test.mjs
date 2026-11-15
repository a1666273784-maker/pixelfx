import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, composite, red, green, blue } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as statusBarFlush from "../src/fx/ui/status-bar-flush.js";

function stepTo(fx, frame, targetT, fps = 30) {
  const steps = Math.round(targetT * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  fx.draw(frame);
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

test("ui/status-bar-flush is registered in src/fx/index.js with valid UI metadata", () => {
  assert.equal(effects["ui/status-bar-flush"], statusBarFlush);
  const { meta } = statusBarFlush;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "dark");
  assert.deepEqual(meta.size, [236, 108]);
  assert.ok(meta.desc.length >= 20 && meta.desc.length <= 180);
});

test("ui/status-bar-flush progresses through left twin orbs -> rightward white-amber wave & bouncing cells -> right tri-color burst -> outer mist & falling golden afterglow -> empty end", () => {
  const { meta } = statusBarFlush;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const frame = createFrame(W, H);

  // 1. Release phase (t = 0.30s): twin interwoven cloud-white & warm-yellow orbs at the far-left of HP and Energy bars
  {
    const fx = createFx(statusBarFlush, { x: OX, y: OY, seed: 11 });
    stepTo(fx, frame, 0.30);
    let topOrbPx = 0, botOrbPx = 0;
    for (let y = OY - 13; y <= OY + 11; y++) {
      for (let x = OX - 54; x <= OX - 40; x++) {
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = red(c), g = green(c), b = blue(c);
        if (r > 180 && g > 170 && b > 80) {
          if (y < OY) topOrbPx++;
          else botOrbPx++;
        }
      }
    }
    assert.ok(topOrbPx >= 15, `expected left orb on HP bar at t=0.30s, got ${topOrbPx}`);
    assert.ok(botOrbPx >= 12, `expected simultaneous left orb on Energy bar at t=0.30s, got ${botOrbPx}`);
  }

  // 2. Hit & Flush sweep (t = 0.72s vs t = 1.05s): rightward wave + coral-red HP & cangqing Energy segments filling and bouncing up
  {
    const measureSweep = (targetT) => {
      const fx = createFx(statusBarFlush, { x: OX, y: OY, seed: 11 });
      stepTo(fx, frame, targetT);
      let maxCoralX = 0, maxCyanX = 0, waveCrestPx = 0, bouncedCoralPx = 0;
      for (let y = OY - 14; y <= OY + 10; y++) {
        for (let x = OX - 50; x <= OX + 65; x++) {
          const c = frame.color[y * W + x];
          if (!(c >>> 24)) continue;
          const r = red(c), g = green(c), b = blue(c);
          if (r > 200 && g < 140 && b < 140) {
            maxCoralX = Math.max(maxCoralX, x);
            if (y < OY - 9) bouncedCoralPx++;
          }
          if (b > 165 && g > 140 && r < 110) {
            maxCyanX = Math.max(maxCyanX, x);
          }
          if (r >= 220 && g >= 165 && (b >= 220 || r > b * 1.4)) {
            waveCrestPx++;
          }
        }
      }
      return { maxCoralX, maxCyanX, waveCrestPx, bouncedCoralPx };
    };

    const s1 = measureSweep(0.72);
    const s2 = measureSweep(1.05);
    assert.ok(s2.maxCoralX > s1.maxCoralX + 40, `coral-red HP segments must fill rightward (${s1.maxCoralX} -> ${s2.maxCoralX})`);
    assert.ok(s2.maxCyanX > s1.maxCyanX + 40, `cangqing energy segments must fill rightward (${s1.maxCyanX} -> ${s2.maxCyanX})`);
    assert.ok(s1.waveCrestPx > 35 && s2.waveCrestPx > 35, "expected pure-white & withered-yellow wave crest during sweep");
    assert.ok(s1.bouncedCoralPx > 10 || s2.bouncedCoralPx > 10, "expected newly filled segments to bounce upward above baseline");
  }

  // 3. Flush completion climax (t = 1.55s): right-end cluster of mixed warm-gold, coral-red, and cangqing pixel motes
  {
    const fx = createFx(statusBarFlush, { x: OX, y: OY, seed: 11 });
    stepTo(fx, frame, 1.55);
    let goldMotePx = 0, coralMotePx = 0, cyanMotePx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + 62; x < W; x++) {
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = red(c), g = green(c), b = blue(c);
        if (r > 180 && g > 125 && g > b * 1.35) goldMotePx++;
        else if (r > 180 && r > g * 1.35 && r > b * 1.25) coralMotePx++;
        else if (b > 150 && g > 130 && b > r * 1.25) cyanMotePx++;
      }
    }
    assert.ok(goldMotePx >= 10, `expected warm-gold motes scattered at right end, got ${goldMotePx}`);
    assert.ok(coralMotePx >= 8, `expected coral-red motes scattered at right end, got ${coralMotePx}`);
    assert.ok(cyanMotePx >= 8, `expected cangqing motes scattered at right end, got ${cyanMotePx}`);
  }

  // 4. Post-hit result phase (t = 2.20s): outer breathing grey-white mist halo + falling golden-yellow afterglow from above
  {
    const fx = createFx(statusBarFlush, { x: OX, y: OY, seed: 11 });
    stepTo(fx, frame, 2.20);
    let outerMistPx = 0, fallingGoldAfterglowPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = red(c), g = green(c), b = blue(c);
        const outsidePlate = x < OX - 72 || x > OX + 62 || y < OY - 15 || y > OY + 13;
        if (outsidePlate && r > 90 && g > 100 && b > 120 && Math.abs(r - g) < 35) {
          outerMistPx++;
        }
        if (y < OY - 15 && r > 175 && g > 120 && g > b * 1.3) {
          fallingGoldAfterglowPx++;
        }
      }
    }
    assert.ok(outerMistPx > 140, `expected grey-white thin mist halo around the UI bar perimeter, got ${outerMistPx}`);
    assert.ok(fallingGoldAfterglowPx >= 12, `expected golden-yellow afterglow specks drifting down from above, got ${fallingGoldAfterglowPx}`);
  }

  // 5. Clean one-shot end at t = duration
  {
    const fx = createFx(statusBarFlush, { x: OX, y: OY, seed: 11 });
    stepTo(fx, frame, meta.duration);
    assert.ok(frame.color.every((v) => (v >>> 24) === 0), "color buffer must be empty at t = duration");
    assert.ok(frame.light.every((v) => v === 0), "light buffer must be empty at t = duration");
    assert.ok(fx.done(), "fx.done() must be true at t = duration");
  }
});

test("ui/status-bar-flush is deterministic by seed and supports custom palette recoloring", () => {
  const { meta } = statusBarFlush;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H), f3 = createFrame(W, H);

  const a = createFx(statusBarFlush, { x: OX, y: OY, seed: 11 });
  const b = createFx(statusBarFlush, { x: OX, y: OY, seed: 11 });
  const c = createFx(statusBarFlush, {
    x: OX,
    y: OY,
    seed: 11,
    palette: ["#061c14", "#0d3d2c", "#176e50", "#26a67a", "#3ad9a2", "#78f0c6", "#bdfae3", "#ffffff"],
  });

  const outA = stepTo(a, f1, 1.55);
  const outB = stepTo(b, f2, 1.55);
  const outC = stepTo(c, f3, 1.55);

  assert.deepEqual(Array.from(outA), Array.from(outB), "identical seeds must produce byte-identical output");
  assert.notDeepEqual(Array.from(outA), Array.from(outC), "custom palette must recolor the HP segments and motes");
});
