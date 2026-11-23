import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, createAct, WHITE } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as swordArrayWard from "../src/fx/moves/sword-array-ward.js";

test("moves/sword-array-ward is registered in src/fx/index.js with valid metadata and defensive act choreography", () => {
  const { meta, create, act } = swordArrayWard;
  assert.equal(meta.name, "Sword array ward");
  assert.deepEqual(meta.size, [316, 196]);
  assert.deepEqual(meta.origin, [124, 160]);
  assert.equal(meta.duration, 3.75);
  assert.equal(meta.loop, false);
  assert.equal(meta.actor, 2);
  assert.equal(meta.bg, "ground");
  assert.equal(typeof create, "function");
  assert.equal(typeof act, "object");
  assert.ok(act.poses.length >= 10);
  assert.ok(act.hits.length >= 5);
  assert.equal(effects["moves/sword-array-ward"], swordArrayWard);
});

test("moves/sword-array-ward progresses through 8 glowing spirit swords emergence -> high-speed circular sword-light barrier -> 3 parried strikes with crisp metallic clash sparks -> counter-pulse & clean fadeout", () => {
  const { meta } = swordArrayWard;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const inst = createFx(swordArrayWard, { x: ox, y: oy, seed: 17 });
  const frame = createFrame(W, H);

  const countBox = (xMin, xMax, yMin = 0, yMax = H - 1) => {
    let n = 0;
    const ax0 = Math.max(0, Math.floor(xMin));
    const ax1 = Math.min(W - 1, Math.ceil(xMax));
    const ay0 = Math.max(0, Math.floor(yMin));
    const ay1 = Math.min(H - 1, Math.ceil(yMax));
    for (let y = ay0; y <= ay1; y++) {
      const row = y * W;
      for (let x = ax0; x <= ax1; x++) {
        if ((frame.color[row + x] >>> 24) || (frame.light[row + x] & 0xffffff)) n++;
      }
    }
    return n;
  };

  const stepTo = (targetT, curT) => {
    while (curT + 1 / 60 <= targetT + 1e-6) {
      inst.update(1 / 60);
      curT += 1 / 60;
    }
    clearFrame(frame);
    inst.draw(frame);
    return curT;
  };

  let t = 0;

  // Phase 1 (t = 0.48s): 8 Glowing Spirit Swords emerging symmetrically around the hero's body + underfoot Bagua sigil
  t = stepTo(0.48, t);
  const leftSwords = countBox(ox - 58, ox - 8, oy - 82, oy - 4);
  const rightSwords = countBox(ox + 8, ox + 58, oy - 82, oy - 4);
  assert.ok(leftSwords > 140, `expected left-side glowing spirit swords at t=0.48s, got ${leftSwords}`);
  assert.ok(rightSwords > 140, `expected right-side glowing spirit swords at t=0.48s, got ${rightSwords}`);

  // Phase 2 (t = 1.15s): High-speed rotation forming the 360-degree Circular Sword-Light Barrier around (ox, oy - 33)
  t = stepTo(1.15, t);
  const barrierPixels = countBox(ox - 52, ox + 52, oy - 84, oy + 12);
  assert.ok(barrierPixels > 1800, `expected dense circular sword-light barrier at t=1.15s, got ${barrierPixels}`);

  // Phase 3a (t = 1.38s): First incoming strike parried with crossed X-locked spirit swords & crisp clash sparks
  t = stepTo(1.38, t);
  const parrySparks1 = countBox(ox + 24, ox + 98, oy - 86, oy + 10);
  assert.ok(parrySparks1 > 900, `expected parry clash starburst and crisp sparks on 1st strike at t=1.38s, got ${parrySparks1}`);

  // Phase 3c (t = 2.25s): Climax Greatsword strike parried with blinding clash flash and shower of metallic sparks
  t = stepTo(2.25, t);
  const parrySparks3 = countBox(ox + 22, ox + 115, oy - 92, oy + 12);
  assert.ok(parrySparks3 > 1400, `expected heavy parry clash and metallic spark burst on 3rd strike at t=2.25s, got ${parrySparks3}`);

  let whiteSparks = 0;
  for (let y = oy - 80; y <= oy + 6; y++) {
    const row = y * W;
    for (let x = ox + 20; x <= ox + 95; x++) {
      if ((frame.color[row + x] >>> 0) === (WHITE >>> 0)) whiteSparks++;
    }
  }
  assert.ok(whiteSparks > 120, `expected bright white-hot clash core & spark tips at t=2.25s, got ${whiteSparks}`);

  // Phase 4 (t = 2.95s): 360-degree Sword-Array Counter-Pulse shockwave ring + saluting Spirit Swords
  t = stepTo(2.95, t);
  const pulsePixels = countBox(ox - 95, ox + 95, oy - 125, oy + 15);
  assert.ok(pulsePixels > 1200, `expected 360-degree repelling sword-qi shockwave at t=2.95s, got ${pulsePixels}`);

  // Final Frame (t = 3.75s): Cleanly faded out
  t = stepTo(meta.duration, t);
  assert.equal(countBox(0, W - 1, 0, H - 1), 0, "expected final frame at t=3.75s to fade out completely");
});

test("moves/sword-array-ward createAct defensive choreography runs with hit-stop freeze, parry recoil shake, and clean completion", () => {
  const { meta } = swordArrayWard;
  const [W, H] = meta.size;
  const scene = createAct(swordArrayWard, { x: meta.origin[0], y: meta.origin[1], seed: 17 });
  const frame = createFrame(W, H);
  let maxShake = 0;
  let sawFreeze = false;

  for (let i = 0; i < 380 && !scene.done(); i++) {
    scene.update(1 / 30);
    const sh = Math.hypot(scene.shake[0], scene.shake[1]);
    if (sh > maxShake) maxShake = sh;
    if (scene.frozen) sawFreeze = true;
    if (i % 6 === 0) scene.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger hit-stop freeze on sword-barrier parries");
  assert.ok(maxShake > 2.5, `expected strong screen shake during heavy sword-barrier parry, got ${maxShake}`);
  assert.ok(scene.done(), "act choreography must complete cleanly");
});

test("moves/sword-array-ward is deterministic by seed and supports custom palette, gold, sparks, and strike options", () => {
  const { meta } = swordArrayWard;
  const [W, H] = meta.size;
  const customPalette = ["#120624", "#280f4c", "#4b1d8c", "#7834cc", "#ab64ff", "#d4abff", "#f0e0ff", "#ffffff"];
  const customGold = ["#062218", "#12543a", "#269868", "#52dc9c", "#98ffd0", "#e4fff2"];
  const customSparks = ["#ffffff", "#d0ffff", "#68e8ff", "#2498e0", "#0e4888"];

  const runAt = (opts) => {
    const inst = createFx(swordArrayWard, { x: meta.origin[0], y: meta.origin[1], ...opts });
    const f = createFrame(W, H);
    for (let i = 0; i < 68; i++) inst.update(1 / 30);
    inst.draw(f);
    return f.color.slice();
  };

  const a = runAt({ seed: 17 });
  const b = runAt({ seed: 17 });
  const c = runAt({ seed: 17, palette: customPalette, gold: customGold, sparks: customSparks });

  assert.deepEqual(a, b, "same seed should produce identical frames");
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== c[i]) diff++;
  assert.ok(diff > 900, `expected custom palette/gold/sparks to recolor barrier and clash sparks, got ${diff} differing pixels`);
});
