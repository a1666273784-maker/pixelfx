import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, createAct, WHITE } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as myriadSwordConvergence from "../src/fx/moves/myriad-sword-convergence.js";

test("moves/myriad-sword-convergence is registered in src/fx/index.js with valid metadata and act choreography", () => {
  const { meta, create, act } = myriadSwordConvergence;
  assert.equal(meta.name, "Myriad sword convergence");
  assert.deepEqual(meta.size, [436, 248]);
  assert.deepEqual(meta.origin, [92, 198]);
  assert.equal(meta.duration, 4.15);
  assert.equal(meta.loop, false);
  assert.equal(meta.actor, 2);
  assert.equal(meta.bg, "ground");
  assert.equal(typeof create, "function");
  assert.equal(typeof act, "object");
  assert.equal(act.target.x, 194);
  assert.ok(act.poses.length >= 9);
  assert.ok(act.hits.length >= 7);
  assert.equal(effects["moves/myriad-sword-convergence"], myriadSwordConvergence);
});

test("moves/myriad-sword-convergence progresses through myriad swords array -> swirling convergence into colossal greatsword -> sky-cleaving plunge & cataclysmic impact -> embedded remnant swords, glowing sword-chasm & rising sword-qi mist -> empty end", () => {
  const { meta } = myriadSwordConvergence;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const inst = createFx(myriadSwordConvergence, { x: ox, y: oy, seed: 17 });
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
        if (frame.color[row + x] >>> 24) n++;
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

  // Phase 1 (t = 0.36s): Celestial Sword-Array & 42 Spirit Swords fanned out above the caster
  t = stepTo(0.36, t);
  const arrayPixels = countBox(ox - 55, ox + 85, oy - 155, oy - 15);
  const targetEarly = countBox(ox + 150, W - 1, 0, H - 1);
  assert.ok(arrayPixels > 900, `expected celestial sword-array and 42 spirit swords at t=0.36s, got ${arrayPixels}`);
  assert.equal(targetEarly, 0, "expected target zone to be empty during initial sword-array summon");

  // Phase 2a (t = 0.72s): Swirling stream of spirit swords converging into the sky apex (APEX_X = 114, APEX_Y = -124)
  t = stepTo(0.72, t);
  const streamPixels = countBox(ox + 20, ox + 175, oy - 175, oy - 40);
  assert.ok(streamPixels > 1100, `expected swirling convergence of spirit swords forging the colossal greatsword at t=0.72s, got ${streamPixels}`);

  // Phase 2b (t = 1.00s): Forged Colossal Sovereign Greatsword hovering at the sky apex with lock-on pressure lines
  t = stepTo(1.00, t);
  const greatswordHover = countBox(ox + 70, ox + 185, oy - 170, oy - 35);
  assert.ok(greatswordHover > 850, `expected forged Colossal Greatsword hovering at sky apex at t=1.00s, got ${greatswordHover}`);

  // Phase 3 (t = 1.20s): Colossal Greatsword impales the target at TX = 194 with blinding white hit-flash & upward sword-qi blades
  t = stepTo(1.20, t);
  const impactPixels = countBox(ox + 115, ox + 265, oy - 165, oy + 18);
  assert.ok(impactPixels > 2400, `expected massive Colossal Greatsword impact, upward phantom blades & shockwaves at t=1.20s, got ${impactPixels}`);

  let whiteCount = 0;
  for (let y = oy - 70; y <= oy + 4; y++) {
    const row = y * W;
    for (let x = ox + 155; x <= ox + 235; x++) {
      if ((frame.color[row + x] >>> 0) === (WHITE >>> 0)) whiteCount++;
    }
  }
  assert.ok(whiteCount > 120, `expected blinding white hit-flash pixels on enemy at t=1.20s, got ${whiteCount}`);

  // Phase 4 (t = 2.50s): Sword-Graveyard Aftermath — 5 embedded remnant swords, glowing sword-chasm, and rising sword-qi mist
  t = stepTo(2.50, t);
  const chasmAndRemnants = countBox(ox + 140, ox + 260, oy - 42, oy + 10);
  const risingMist = countBox(ox + 135, ox + 265, oy - 115, oy - 35);
  assert.ok(chasmAndRemnants > 700, `expected glowing sword-chasm and 5 embedded remnant swords at t=2.50s, got ${chasmAndRemnants}`);
  assert.ok(risingMist > 600, `expected rising sinuous sword-qi mist and motes at t=2.50s, got ${risingMist}`);

  // Final Frame (t = 4.15s): Cleanly faded out
  t = stepTo(meta.duration, t);
  assert.equal(countBox(0, W - 1, 0, H - 1), 0, "expected final frame at t=4.15s to fade out completely");
});

test("moves/myriad-sword-convergence createAct scene steps smoothly with multi-stage hit-stop, heavy shake, and clean completion", () => {
  const { meta } = myriadSwordConvergence;
  const [W, H] = meta.size;
  const scene = createAct(myriadSwordConvergence, { x: meta.origin[0], y: meta.origin[1], seed: 17 });
  const frame = createFrame(W, H);
  let maxShake = 0;
  let sawFreeze = false;

  for (let i = 0; i < 420 && !scene.done(); i++) {
    scene.update(1 / 30);
    const sh = Math.hypot(scene.shake[0], scene.shake[1]);
    if (sh > maxShake) maxShake = sh;
    if (scene.frozen) sawFreeze = true;
    if (i % 6 === 0) scene.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger oppressive hit-stop freeze");
  assert.ok(maxShake > 2.5, `expected strong screen shake during Colossal Greatsword impact, got ${maxShake}`);
  assert.ok(scene.done(), "act choreography must complete cleanly");
});

test("moves/myriad-sword-convergence is deterministic by seed and supports custom palette, gold, and crimson options", () => {
  const { meta } = myriadSwordConvergence;
  const [W, H] = meta.size;
  const customPalette = ["#120624", "#2c1054", "#562096", "#8c42dc", "#c888ff", "#ffffff"];
  const customGold = ["#062218", "#12543a", "#269868", "#52dc9c", "#b8ffe0"];
  const customCrimson = ["#081828", "#184468", "#3288c2", "#78d2ff"];

  const runAt = (opts) => {
    const inst = createFx(myriadSwordConvergence, { x: meta.origin[0], y: meta.origin[1], ...opts });
    const f = createFrame(W, H);
    for (let i = 0; i < 38; i++) inst.update(1 / 30);
    inst.draw(f);
    return f.color.slice();
  };

  const a = runAt({ seed: 17 });
  const b = runAt({ seed: 17 });
  const c = runAt({ seed: 17, palette: customPalette, gold: customGold, crimson: customCrimson });

  assert.deepEqual(a, b, "same seed should produce identical frames");
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== c[i]) diff++;
  assert.ok(diff > 1000, `expected custom palette/gold/crimson to recolor swords and impact, got ${diff} differing pixels`);
});
