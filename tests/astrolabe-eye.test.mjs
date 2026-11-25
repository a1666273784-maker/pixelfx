import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as astrolabeEye from "../src/fx/critters/astrolabe-eye.js";

test("critters/astrolabe-eye is registered with valid one-shot monster metadata", () => {
  const { meta, create } = astrolabeEye;
  assert.equal(meta.name, "Astrolabe eye");
  assert.deepEqual(meta.size, [296, 156]);
  assert.deepEqual(meta.origin, [152, 118]);
  assert.equal(meta.duration, 7.6);
  assert.equal(meta.loop, false);
  assert.equal(meta.fps, 30);
  assert.equal(meta.bg, "ground");
  assert.ok(meta.desc.length <= 180);
  assert.equal(typeof create, "function");
  assert.equal(effects["critters/astrolabe-eye"], astrolabeEye);
});

test("critters/astrolabe-eye executes all 4 action states (Idle, Saucer Move, Crosshair Solar Laser, Petrified Shatter KO) and clears cleanly", () => {
  const { meta } = astrolabeEye;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const frame = createFrame(W, H);

  const stepTo = (targetT, extra = {}) => {
    const inst = createFx(astrolabeEye, { x: ox, y: oy, seed: 11, ...extra });
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
    let count = 0, bluePx = 0, goldPx = 0, solarPx = 0, greyPx = 0, lightPx = 0;
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
        if (b > r + 25 && b > 80) bluePx++;
        if (r > 140 && g > 85 && b < 170) goldPx++;
        if (r > 210 && g > 130 && b < 180) solarPx++;
        if (Math.abs(r - g) < 28 && Math.abs(g - b) < 34 && r >= 20 && r <= 215) greyPx++;
      }
    }
    return {
      count,
      bluePx,
      goldPx,
      solarPx,
      greyPx,
      lightPx,
      cx: count ? sumX / count : 0,
      cy: count ? sumY / count : 0,
      spanY: maxY >= minY ? maxY - minY + 1 : 0,
    };
  };

  // 1. STAGE 1 (IDLE): Levitating glowing sapphire eye surrounded by 3 rotating golden rune rings
  stepTo(0.45);
  const idleEarly = stats(ox - 120, ox - 45, 30, oy + 6);
  const idleEarlyBuf = new Uint32Array(frame.color);
  assert.ok(idleEarly.bluePx > 140, `expected glowing sapphire eye in idle, got ${idleEarly.bluePx}`);
  assert.ok(idleEarly.goldPx > 180, `expected 3 golden rune rings in idle, got ${idleEarly.goldPx}`);
  assert.ok(idleEarly.lightPx > 800, `expected celestial glow in idle, got ${idleEarly.lightPx}`);

  stepTo(1.35);
  const idleLate = stats(ox - 120, ox - 45, 30, oy + 6);
  let idleChanged = 0;
  for (let i = 0; i < frame.color.length; i++) if (frame.color[i] !== idleEarlyBuf[i]) idleChanged++;
  assert.ok(idleChanged > 400, `expected 3-axis ring rotation to change pixel silhouette during idle (${idleChanged})`);
  assert.ok(Math.abs(idleLate.cx - idleEarly.cx) < 8, "expected idle sentinel to hover in place");

  // 2. STAGE 2 (MOVE): Rings snap into flat horizontal saucer, dash rapidly right trailing stardust stream
  stepTo(2.55);
  const moveFull = stats(0, W - 1, 30, oy - 12);
  const saucerBody = stats(Math.floor(moveFull.cx) - 26, Math.floor(moveFull.cx) + 26, oy - 58, oy - 22);
  const stardustWake = stats(10, Math.floor(moveFull.cx) - 24, oy - 56, oy - 24);
  assert.ok(moveFull.cx > idleEarly.cx + 20, `expected rapid rightward dash (${moveFull.cx} vs ${idleEarly.cx})`);
  assert.ok(saucerBody.spanY <= 26, `expected horizontal UFO saucer profile during dash, spanY=${saucerBody.spanY}`);
  assert.ok(stardustWake.count > 90 && stardustWake.goldPx > 35, `expected golden stardust trail behind saucer, got ${stardustWake.count}`);

  // 3. STAGE 3 (ATTACK): Rings lock forward into crosshair scope; eye fires searing solar laser + burn spot
  stepTo(3.76);
  const lockScope = stats(ox - 16, ox + 40, oy - 64, oy - 8);
  assert.ok(lockScope.goldPx > 180, `expected golden crosshair reticle locked ahead of eye, got ${lockScope.goldPx}`);

  stepTo(4.45);
  const beamZone = stats(ox - 24, ox + 96, oy - 62, oy + 6);
  const burnSpot = stats(ox + 60, ox + 128, oy - 16, oy + 14);
  assert.ok(beamZone.solarPx > 520, `expected searing solar laser beam across trajectory, got ${beamZone.solarPx}`);
  assert.ok(burnSpot.solarPx > 140 && burnSpot.lightPx > 450, `expected intense laser burn crater on ground (solar=${burnSpot.solarPx}, light=${burnSpot.lightPx})`);

  // 4. STAGE 4 (KO): Eye extinguishes & petrifies to grey stone -> rings fracture & clatter on floor -> clean 0 px end
  stepTo(5.60);
  const petrifyOrb = stats(ox - 34, ox - 2, oy - 52, oy - 16);
  assert.ok(petrifyOrb.greyPx > 160 && petrifyOrb.bluePx === 0, `expected extinguished grey stone eye before drop (grey=${petrifyOrb.greyPx}, blue=${petrifyOrb.bluePx})`);

  stepTo(6.65);
  const fallenRemains = stats(ox - 95, ox + 75, oy - 26, oy + 12);
  assert.ok(fallenRemains.greyPx > 120, `expected fallen petrified eye on ground, got grey=${fallenRemains.greyPx}`);
  assert.ok(fallenRemains.goldPx > 160, `expected shattered golden ring segments scattered across ground, got gold=${fallenRemains.goldPx}`);

  stepTo(meta.duration);
  const endStats = stats();
  assert.equal(endStats.count, 0, "one-shot must end cleanly with 0 color pixels at t = duration");
  assert.equal(endStats.lightPx, 0, "one-shot must end cleanly with 0 light pixels at t = duration");

  // Determinism & 4-color palette override check
  stepTo(4.45, { palette: ["#1a1426", "#42335e", "#7e68b0", "#e6d8ff"], seed: 23 });
  const customBuf = new Uint32Array(frame.color);
  stepTo(4.45, { palette: ["#1a1426", "#42335e", "#7e68b0", "#e6d8ff"], seed: 23 });
  assert.deepEqual(frame.color, customBuf, "rendering with identical seed and 4-color palette override must be deterministic");
});
