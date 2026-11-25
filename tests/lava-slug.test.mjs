import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as lavaSlug from "../src/fx/critters/lava-slug.js";

test("critters/lava-slug is registered with valid 5-state one-shot monster metadata", () => {
  const { meta, create } = lavaSlug;
  assert.equal(meta.name, "Lava slug");
  assert.deepEqual(meta.size, [308, 168]);
  assert.deepEqual(meta.origin, [138, 134]);
  assert.equal(meta.duration, 11.6);
  assert.equal(meta.loop, false);
  assert.equal(meta.fps, 30);
  assert.equal(meta.bg, "ground");
  assert.ok(meta.desc.length <= 180);
  assert.equal(typeof create, "function");
  assert.equal(effects["critters/lava-slug"], lavaSlug);
});

test("critters/lava-slug executes all 5 sustained action states (Idle, Snot-Bubble Quirk, Caterpillar Move, Fireball Attack + Lava Pool, Charcoal Ash KO)", () => {
  const { meta } = lavaSlug;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const frame = createFrame(W, H);

  const stepTo = (targetT, extra = {}) => {
    const inst = createFx(lavaSlug, { x: ox, y: oy, seed: 7, ...extra });
    const dt = 1 / 30;
    let cur = 0;
    while (cur + 1e-6 < targetT) {
      const step = Math.min(dt, targetT - cur);
      inst.update(step);
      cur += step;
    }
    clearFrame(frame);
    inst.draw(frame, "back");
    inst.draw(frame, "front");
  };

  const stats = (xMin = 0, xMax = W - 1, yMin = 0, yMax = H - 1) => {
    let count = 0, fieryPx = 0, coolSmokePx = 0, greyStonePx = 0, lightPx = 0;
    let sumX = 0, sumY = 0, minY = H, maxY = -1;
    const cx0 = Math.max(0, xMin), cx1 = Math.min(W - 1, xMax);
    const cy0 = Math.max(0, yMin), cy1 = Math.min(H - 1, yMax);
    for (let y = cy0; y <= cy1; y++) {
      const row = y * W;
      for (let x = cx0; x <= cx1; x++) {
        const c = frame.color[row + x];
        if (frame.light[row + x] !== 0) lightPx++;
        if ((c >>> 24) < 32) continue;
        const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
        count++;
        sumX += x;
        sumY += y;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (r > 135 && r > b + 45) fieryPx++;
        if (b > r + 10 && Math.max(r, g, b) < 210) coolSmokePx++;
        if (Math.abs(r - g) < 25 && Math.abs(g - b) < 30 && r >= 12 && r <= 185) greyStonePx++;
      }
    }
    return {
      count,
      fieryPx,
      coolSmokePx,
      greyStonePx,
      lightPx,
      cx: count ? sumX / count : 0,
      cy: count ? sumY / count : 0,
      spanY: maxY >= minY ? maxY - minY + 1 : 0,
    };
  };

  // 1. STAGE 1 (IDLE, 0.00..2.10s): Semi-fluid magma slug breathing & bobbing antennae at X_IDLE
  stepTo(0.40);
  const idleEarly = stats(ox - 122, ox - 50, oy - 48, oy + 6);
  const idleBuf = new Uint32Array(frame.color);
  assert.ok(idleEarly.fieryPx > 220, `expected glowing orange-red magma body in idle, got ${idleEarly.fieryPx}`);
  assert.ok(idleEarly.lightPx > 500, `expected heat glow in idle, got ${idleEarly.lightPx}`);

  stepTo(1.50);
  const idleLate = stats(ox - 122, ox - 50, oy - 48, oy + 6);
  let idleChanged = 0;
  for (let i = 0; i < frame.color.length; i++) if (frame.color[i] !== idleBuf[i]) idleChanged++;
  assert.ok(idleChanged > 150, `expected breathing + antenna bobbing animation across sustained idle (${idleChanged})`);
  assert.ok(Math.abs(idleLate.cx - idleEarly.cx) < 8, "idle slug should remain resting at origin-left");

  // 2. STAGE 2 (ECOLOGICAL QUIRK, 2.10..4.55s): Giant fiery magma snot-bubble -> POP! -> startled leap
  stepTo(3.40);
  const bubbleZone = stats(ox - 72, ox - 36, oy - 36, oy + 8);
  assert.ok(bubbleZone.fieryPx > 220, `expected giant fiery magma snot-bubble ahead of snout, got ${bubbleZone.fieryPx}`);

  stepTo(3.70);
  const joltStats = stats(ox - 118, ox - 36, oy - 56, oy + 6);
  assert.ok(joltStats.cy < idleEarly.cy - 2.5, `expected startled slug hop upward after bubble pop (${joltStats.cy} vs ${idleEarly.cy})`);

  // 3. STAGE 3 (MOVE, 4.55..6.85s): Caterpillar inchworm crawl rightward + blackened scorch trail & bluish smoke
  stepTo(4.82);
  const archPose = stats(ox - 115, ox - 55, oy - 46, oy + 4);
  assert.ok(archPose.spanY > idleEarly.spanY - 2, "inchworm crawl should arch vertically");

  stepTo(6.45);
  const movedSlug = stats(ox - 48, ox + 10, oy - 44, oy + 6);
  const scorchTrail = stats(ox - 112, ox - 45, oy - 34, oy + 8);
  assert.ok(movedSlug.fieryPx > 200, `expected slug moved forward to attack spot, got ${movedSlug.fieryPx}`);
  assert.ok(scorchTrail.count > 120 && scorchTrail.coolSmokePx > 20, `expected blackened scorched trail emitting cool smoke (count=${scorchTrail.count}, smoke=${scorchTrail.coolSmokePx})`);

  // 4. STAGE 4 (ATTACK, 6.85..9.45s): Swells crimson sphere -> spits high-parabola fireballs -> boiling lava pool
  stepTo(7.45);
  const redBall = stats(ox - 55, ox + 12, oy - 58, oy + 4);
  assert.ok(redBall.fieryPx > 550 && redBall.spanY >= 34, `expected inflated glowing crimson sphere before firing (fiery=${redBall.fieryPx}, spanY=${redBall.spanY})`);

  stepTo(8.15);
  const highArc = stats(ox - 10, ox + 115, oy - 115, oy - 24);
  assert.ok(highArc.fieryPx > 110, `expected high-parabolic explosive fireballs with flame tails in flight, got ${highArc.fieryPx}`);

  stepTo(9.15);
  const lavaPool = stats(ox + 32, ox + 122, oy - 42, oy + 12);
  assert.ok(lavaPool.fieryPx > 450 && lavaPool.lightPx > 700, `expected boiling molten lava pool crater after impact (fiery=${lavaPool.fieryPx}, light=${lavaPool.lightPx})`);

  // 5. STAGE 5 (KO, 9.45..11.60s): Fire extinguishes -> cools into charcoal stone -> shatters into wind-blown ash -> 0 px end
  stepTo(10.05);
  const stoneSlug = stats(ox - 48, ox + 6, oy - 32, oy + 4);
  assert.ok(stoneSlug.greyStonePx > 140 && stoneSlug.fieryPx < 40, `expected extinguished dark grey-black charcoal stone slug (grey=${stoneSlug.greyStonePx}, fiery=${stoneSlug.fieryPx})`);

  stepTo(10.95);
  const ashCloud = stats(ox - 45, ox + 65, oy - 48, oy + 4);
  assert.ok(ashCloud.greyStonePx > 40, `expected shattering wind-blown charcoal ash flakes drifting right, got ${ashCloud.greyStonePx}`);

  stepTo(meta.duration);
  const endStats = stats();
  assert.equal(endStats.count, 0, "one-shot must clear completely to 0 color pixels at t = duration");
  assert.equal(endStats.lightPx, 0, "one-shot must clear completely to 0 light pixels at t = duration");

  // Determinism & 4-color palette override check
  stepTo(8.15, { palette: ["#120926", "#421e70", "#9e4be6", "#f2d6ff"], seed: 19 });
  const customBuf = new Uint32Array(frame.color);
  stepTo(8.15, { palette: ["#120926", "#421e70", "#9e4be6", "#f2d6ff"], seed: 19 });
  assert.deepEqual(frame.color, customBuf, "rendering with custom 4-color palette and seed must be deterministic");
});
