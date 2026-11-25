import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as thundercloudPuff from "../src/fx/critters/thundercloud-puff.js";

test("critters/thundercloud-puff is registered with valid one-shot monster metadata", () => {
  const { meta, create } = thundercloudPuff;
  assert.equal(meta.name, "Thundercloud puff");
  assert.deepEqual(meta.size, [224, 148]);
  assert.deepEqual(meta.origin, [112, 110]);
  assert.equal(meta.duration, 7.2);
  assert.equal(meta.loop, false);
  assert.equal(meta.fps, 30);
  assert.equal(meta.bg, "ground");
  assert.ok(meta.desc.length <= 180);
  assert.equal(typeof create, "function");
  assert.equal(effects["critters/thundercloud-puff"], thundercloudPuff);
});

test("critters/thundercloud-puff executes all 4 action states (Idle, Move, Berserk Z-Bolt Attack, KO Smoke Ring) and clears cleanly", () => {
  const { meta } = thundercloudPuff;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const frame = createFrame(W, H);

  const stepTo = (targetT, extra = {}) => {
    const inst = createFx(thundercloudPuff, { x: ox, y: oy, seed: 7, ...extra });
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
    let count = 0, whitePx = 0, yellowPx = 0, purplePx = 0, lightPx = 0;
    let sumX = 0, minY = H, maxY = -1;
    for (let y = yMin; y <= yMax; y++) {
      const row = y * W;
      for (let x = xMin; x <= xMax; x++) {
        const c = frame.color[row + x];
        const l = frame.light[row + x];
        if (l !== 0) lightPx++;
        const a = c >>> 24;
        if (a < 32) continue;
        const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
        count++;
        sumX += x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (r > 215 && g > 225 && b > 235) whitePx++;
        if (r > 220 && g > 180 && b < 135) yellowPx++;
        if (b > g + 25 && r > g + 8 && b > 45) purplePx++;
      }
    }
    return { count, whitePx, yellowPx, purplePx, lightPx, cx: count ? sumX / count : 0, spanY: maxY >= minY ? maxY - minY + 1 : 0 };
  };

  // 1. STAGE 1 (IDLE): Fluffy white puffball with two bright-yellow bean eyes that blink
  stepTo(0.30);
  const idleOpen = stats(0, 110, 40, oy + 4);
  assert.ok(idleOpen.whitePx > 350, `expected fluffy white cloud body in idle, got ${idleOpen.whitePx}`);
  assert.ok(idleOpen.yellowPx >= 12, `expected bright-yellow bean eyes open at t=0.30s, got ${idleOpen.yellowPx}`);

  stepTo(0.62);
  const idleBlink = stats(0, 110, 40, oy + 4);
  assert.ok(idleBlink.yellowPx < idleOpen.yellowPx * 0.5, `expected yellow bean eyes to blink shut around t=0.62s (${idleBlink.yellowPx} vs ${idleOpen.yellowPx})`);

  // 2. STAGE 2 (MOVE): Glides rightward, trailing cloud-mist wake & scraping underside static sparks
  stepTo(2.50);
  const moveMid = stats();
  assert.ok(moveMid.cx > idleOpen.cx + 18, `expected monster to glide rapidly rightward (${moveMid.cx} vs ${idleOpen.cx})`);
  const trailStats = stats(15, Math.floor(moveMid.cx) - 16, oy - 24, oy + 2);
  assert.ok(trailStats.count > 80, `expected cloud-mist wake behind gliding monster, got ${trailStats.count}`);
  const underSparks = stats(Math.floor(moveMid.cx) - 18, Math.floor(moveMid.cx) + 26, oy - 6, oy + 2);
  assert.ok(underSparks.yellowPx >= 8, `expected electrostatic sparks scraping underneath, got ${underSparks.yellowPx}`);

  // 3. STAGE 3 (ATTACK): Violent dark-purple storm swell + thunderclap flash + forward golden Z-bolt cleave
  stepTo(4.04);
  const atkBody = stats(45, 130, 35, oy + 4);
  assert.ok(atkBody.purplePx > 650, `expected swollen dark-purple thundercloud in attack, got ${atkBody.purplePx}`);
  assert.ok(atkBody.count > idleOpen.count * 1.65, `expected violent body inflation during attack (${atkBody.count} vs ${idleOpen.count})`);

  const zBoltZone = stats(122, W - 1, oy - 52, oy + 22);
  assert.ok(zBoltZone.yellowPx > 260, `expected thick golden Z-bolt & ground impact forward of monster, got ${zBoltZone.yellowPx}`);
  const fullAtk = stats();
  assert.ok(fullAtk.lightPx > 2500, `expected dramatic thunderclap illumination during strike, got ${fullAtk.lightPx}`);

  // 4. STAGE 4 (KO): Internal thunder dies -> flattens like leaking air -> disperses into white smoke ring -> clears to 0
  stepTo(5.94);
  const koZone = stats(55, 125, oy - 24, oy + 3);
  const koCenterBody = stats(80, 100, oy - 36, oy + 1);
  assert.equal(koZone.purplePx, 0, "expected dark-purple storm pigment to drain back to white puff in KO");
  assert.equal(koZone.lightPx, 0, "expected internal thunder-light to be completely extinguished in KO");
  assert.ok(
    koCenterBody.spanY <= 12 && koCenterBody.spanY < idleOpen.spanY * 0.45 && koZone.whitePx > 70,
    `expected flattened white pancake body before pop, centerSpanY=${koCenterBody.spanY} vs idle=${idleOpen.spanY}`
  );

  stepTo(6.30);
  const koSmokeRing = stats(42, 140, oy - 16, oy + 16);
  assert.ok(koSmokeRing.whitePx > 220, `expected expanding white smoke ring at t=6.30s, got ${koSmokeRing.whitePx}`);

  // Clean zero-pixel termination at t = meta.duration
  stepTo(meta.duration);
  const endStats = stats();
  assert.equal(endStats.count, 0, "one-shot must have 0 opaque/translucent pixels at t = duration");
  assert.equal(endStats.lightPx, 0, "one-shot must have 0 additive light pixels at t = duration");

  // 4-color palette override resilience & deterministic seeding
  stepTo(4.04, { palette: ["#112233", "#335577", "#66aa99", "#ddffee"], seed: 19 });
  const pal4Color = new Uint32Array(frame.color);
  stepTo(4.04, { palette: ["#112233", "#335577", "#66aa99", "#ddffee"], seed: 19 });
  assert.deepEqual(frame.color, pal4Color, "rendering with identical seed and 4-color palette must be deterministic");
});
