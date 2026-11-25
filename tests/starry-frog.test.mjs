import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as starryFrog from "../src/fx/critters/starry-frog.js";

test("critters/starry-frog is registered with valid 5-state + post-attack idle buffer metadata", () => {
  const { meta, create } = starryFrog;
  assert.equal(meta.name, "Starry frog");
  assert.deepEqual(meta.size, [340, 184]);
  assert.deepEqual(meta.origin, [134, 146]);
  assert.equal(meta.duration, 12.0);
  assert.equal(meta.loop, false);
  assert.equal(meta.fps, 30);
  assert.equal(meta.bg, "ground");
  assert.ok(meta.desc.length <= 180);
  assert.equal(typeof create, "function");
  assert.equal(effects["critters/starry-frog"], starryFrog);
});

test("critters/starry-frog executes all 5 sustained action states + post-attack idle buffer with starry ripples, meteor torrent, and firework KO", () => {
  const { meta } = starryFrog;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const frame = createFrame(W, H);

  const stepTo = (targetT, extra = {}) => {
    const inst = createFx(starryFrog, { x: ox, y: oy, seed: 11, ...extra });
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
    let count = 0, blueJellyPx = 0, nebulaPinkPurplePx = 0, goldPx = 0, whitePx = 0, blackSpecks = 0, lightPx = 0;
    let sumX = 0, sumY = 0, minX = W, maxX = -1, minY = H, maxY = -1;
    const cx0 = Math.max(0, xMin), cx1 = Math.min(W - 1, xMax);
    const cy0 = Math.max(0, yMin), cy1 = Math.min(H - 1, yMax);
    for (let y = cy0; y <= cy1; y++) {
      const row = y * W;
      for (let x = cx0; x <= cx1; x++) {
        const c = frame.color[row + x];
        if (frame.light[row + x] !== 0) lightPx++;
        const a = c >>> 24;
        if (a < 32) continue;
        const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
        count++;
        sumX += x;
        sumY += y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (Math.max(r, g, b) < 22 && a > 120) blackSpecks++;
        if (b > r + 25 && b > 65) blueJellyPx++;
        if (r > g + 20 && b > g + 15) nebulaPinkPurplePx++;
        if (r > 180 && g > 140 && b < 175) goldPx++;
        if (r > 235 && g > 235 && b > 235) whitePx++;
      }
    }
    return {
      count,
      blueJellyPx,
      nebulaPinkPurplePx,
      goldPx,
      whitePx,
      blackSpecks,
      lightPx,
      cx: count ? sumX / count : 0,
      cy: count ? sumY / count : 0,
      spanX: maxX >= minX ? maxX - minX + 1 : 0,
      spanY: maxY >= minY ? maxY - minY + 1 : 0,
    };
  };

  // 1. STAGE 1 (IDLE, 0.00..2.00s): Deep-blue translucent frog with rotating belly nebula & glowing drool
  stepTo(0.45);
  const idleEarly = stats(ox - 120, ox - 45, oy - 48, oy + 12);
  const idleBuf = new Uint32Array(frame.color);
  assert.ok(idleEarly.blueJellyPx > 320, `expected deep-blue translucent jelly toad in idle, got ${idleEarly.blueJellyPx}`);
  assert.ok(idleEarly.nebulaPinkPurplePx > 140, `expected visible magenta-violet belly nebula + mouth in idle, got ${idleEarly.nebulaPinkPurplePx}`);
  assert.ok(idleEarly.lightPx > 800, `expected nebula & drool illumination in idle, got ${idleEarly.lightPx}`);
  assert.equal(idleEarly.blackSpecks, 0, "idle should have zero black noise specks");

  stepTo(1.55);
  const idleLate = stats(ox - 120, ox - 45, oy - 48, oy + 12);
  let idleChanged = 0;
  for (let i = 0; i < frame.color.length; i++) if (frame.color[i] !== idleBuf[i]) idleChanged++;
  assert.ok(idleChanged > 220, `expected breathing + nebula rotation + drool animation during idle (${idleChanged})`);
  assert.ok(Math.abs(idleLate.cx - idleEarly.cx) < 8, "idle frog should stay at origin-left");

  // 2. STAGE 2 (ECOLOGICAL QUIRK, 2.00..4.55s): Golden mote flies by -> tongue snap -> belly flares -> pats belly & burps bubbles
  stepTo(2.30);
  const moteSky = stats(ox - 55, ox - 5, oy - 64, oy - 22);
  assert.ok(moteSky.goldPx + moteSky.whitePx >= 10, `expected flying golden light-mote in sky ahead of frog (gold=${moteSky.goldPx}, white=${moteSky.whitePx})`);

  stepTo(2.74);
  const tongueReach = stats(ox - 78, ox - 46, oy - 40, oy - 16);
  assert.ok(tongueReach.nebulaPinkPurplePx > 10, `expected neon-pink tongue extended upward toward golden mote, got ${tongueReach.nebulaPinkPurplePx}`);

  stepTo(3.85);
  const burpBubbles = stats(ox - 68, ox - 30, oy - 56, oy - 22);
  assert.ok(burpBubbles.count > 25, `expected floating cosmic burp bubbles & sparkles above snout, got ${burpBubbles.count}`);

  // 3. STAGE 3 (MOVE, 4.55..6.80s): 3 heavy bouncy hops + wide expanding cosmic water ripples on ground
  stepTo(4.90);
  const hopMid = stats(ox - 110, ox - 36, oy - 68, oy - 14);
  assert.ok(hopMid.blueJellyPx > 250 && hopMid.cy < oy - 20, `expected frog airborne in heavy hop arc (blue=${hopMid.blueJellyPx}, cy=${hopMid.cy})`);

  stepTo(5.92);
  const waterRipples = stats(ox - 118, ox - 4, oy - 6, oy + 18);
  assert.ok(waterRipples.blueJellyPx > 200 && waterRipples.spanX >= 85, `expected wide expanding cosmic water ripples across floor (spanX=${waterRipples.spanX})`);
  assert.equal(waterRipples.blackSpecks, 0, "water ripples must have zero black speck noise");

  // 4. STAGE 4 (ATTACK, 6.80..8.74s): Huge puffed cheeks inhale -> Galaxy Meteor Torrent -> Shattering Starburst Impact
  stepTo(7.42);
  const puffedCheeks = stats(ox - 56, ox + 4, oy - 48, oy + 4);
  assert.ok(puffedCheeks.blueJellyPx > 900 && puffedCheeks.nebulaPinkPurplePx + puffedCheeks.goldPx + puffedCheeks.whitePx > 260 && puffedCheeks.spanY >= 32, `expected inflated puffed cheeks & concentrated nebula energy before firing (blue=${puffedCheeks.blueJellyPx}, neb=${puffedCheeks.nebulaPinkPurplePx}, gold=${puffedCheeks.goldPx}, white=${puffedCheeks.whitePx}, spanY=${puffedCheeks.spanY})`);

  stepTo(8.05);
  const galaxyTorrent = stats(ox - 15, ox + 92, oy - 44, oy + 6);
  const hitImpact = stats(ox + 80, ox + 150, oy - 56, oy + 18);
  assert.ok(galaxyTorrent.count > 750 && galaxyTorrent.goldPx > 35, `expected blazing galaxy torrent + golden meteor trails (count=${galaxyTorrent.count}, gold=${galaxyTorrent.goldPx})`);
  assert.ok(hitImpact.count > 240 && hitImpact.lightPx > 1400, `expected explosive shattering star-burst impact at target (count=${hitImpact.count}, light=${hitImpact.lightPx})`);

  // 4.5. POST-ATTACK IDLE BUFFER (8.74..9.88s): Frog breathes calmly back in idle while crater embers fade
  stepTo(9.30);
  const postIdleFrog = stats(ox - 56, ox + 4, oy - 44, oy + 4);
  assert.ok(postIdleFrog.blueJellyPx > 300 && postIdleFrog.nebulaPinkPurplePx > 120, `expected calm post-attack idle buffer frog before KO (blue=${postIdleFrog.blueJellyPx}, neb=${postIdleFrog.nebulaPinkPurplePx})`);

  // 5. STAGE 5 (KO, 9.88..12.00s): Rolled white eyes & flopped tongue -> jelly shell ruptures -> cosmic fireworks -> 0 px end
  stepTo(10.16);
  const koSlump = stats(ox - 56, ox + 28, oy - 40, oy + 6);
  assert.ok(koSlump.whitePx > 16 && koSlump.nebulaPinkPurplePx > 140, `expected rolled white KO eyes and flopped pink tongue (white=${koSlump.whitePx}, pink=${koSlump.nebulaPinkPurplePx})`);

  stepTo(11.30);
  const skyFireworks = stats(ox - 68, ox + 42, oy - 138, oy - 24);
  assert.ok(skyFireworks.count > 90 && skyFireworks.lightPx > 900, `expected rising cosmic nebula chrysanthemum fireworks in upper sky (count=${skyFireworks.count}, light=${skyFireworks.lightPx})`);

  stepTo(meta.duration);
  const endStats = stats();
  assert.equal(endStats.count, 0, "one-shot must finish completely cleanly with 0 color pixels at t = duration");
  assert.equal(endStats.lightPx, 0, "one-shot must finish completely cleanly with 0 light pixels at t = duration");

  // Determinism & custom 4-color palette check
  stepTo(8.05, { palette: ["#061c18", "#0d4a3a", "#1ea37c", "#c8ffeb"], seed: 19 });
  const customBuf = new Uint32Array(frame.color);
  stepTo(8.05, { palette: ["#061c18", "#0d4a3a", "#1ea37c", "#c8ffeb"], seed: 19 });
  assert.deepEqual(frame.color, customBuf, "rendering with custom 4-color palette and seed must be deterministic");
});
