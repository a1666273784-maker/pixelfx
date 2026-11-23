import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, createAct, WHITE } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as thunderTalisman from "../src/fx/moves/celestial-thunder-talisman.js";

test("moves/celestial-thunder-talisman is registered in src/fx/index.js with valid metadata and act choreography", () => {
  const { meta, create, act } = thunderTalisman;
  assert.equal(meta.name, "Celestial thunder talisman");
  assert.deepEqual(meta.size, [436, 268]);
  assert.deepEqual(meta.origin, [88, 224]);
  assert.equal(meta.duration, 4.15);
  assert.equal(meta.loop, false);
  assert.equal(meta.fps, 30);
  assert.equal(meta.bg, "ground");
  assert.equal(meta.actor, 2);
  assert.equal(typeof create, "function");
  assert.equal(typeof act, "object");
  assert.equal(act.target.x, 192);
  assert.ok(act.poses.length >= 8);
  assert.ok(act.hits.length >= 5);
  assert.equal(effects["moves/celestial-thunder-talisman"], thunderTalisman);
});

test("moves/celestial-thunder-talisman progresses through Daoist talisman wheel & seal beams -> boiling thunderhead & stepped leader -> 3 colossal golden thunderbolt strikes -> Lichtenberg floor cracks, crawling arcs & ozone smoke -> empty end", () => {
  const { meta } = thunderTalisman;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const inst = createFx(thunderTalisman, { x: ox, y: oy, seed: 23 });
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

  // Phase 1a (t = 0.27s): Main Daoist Thunder Talisman & 8-talisman wheel flying out from caster
  t = stepTo(0.27, t);
  const talismanWheelPx = countBox(ox + 10, ox + 86, oy - 95, oy - 35);
  assert.ok(talismanWheelPx > 120, `expected Daoist yellow-paper cinnabar talisman wheel at t=0.27s, got ${talismanWheelPx}`);

  // Phase 1b (t = 0.54s): Seal beams to sky/ground + 4 target-binding talismans around enemy at TX=192
  t = stepTo(0.54, t);
  const skyGatePx = countBox(ox + 192 - 55, ox + 192 + 55, oy - 212, oy - 175);
  const enemyCagePx = countBox(ox + 192 - 48, ox + 192 + 48, oy - 58, oy - 25);
  assert.ok(skyGatePx > 80, `expected sky thunder-gate and upper binding talismans at t=0.54s, got ${skyGatePx}`);
  assert.ok(enemyCagePx > 80, `expected enemy-binding talismans and lightning chain at t=0.54s, got ${enemyCagePx}`);

  // Phase 2 (t = 0.82s): Boiling thunderclouds, rotating ground Eight-Trigram sigil, and stepped golden lightning leader
  t = stepTo(0.82, t);
  const cloudPx = countBox(ox + 192 - 70, ox + 192 + 70, oy - 214, oy - 180);
  const leaderPx = countBox(ox + 192 - 45, ox + 192 + 45, oy - 175, oy - 25);
  const sigilPx = countBox(ox + 192 - 50, ox + 192 + 50, oy - 14, oy + 12);
  assert.ok(cloudPx > 150, `expected dark thunderhead clouds & sky gate at t=0.82s, got ${cloudPx}`);
  assert.ok(leaderPx > 120, `expected descending stepped golden lightning leader at t=0.82s, got ${leaderPx}`);
  assert.ok(sigilPx > 120, `expected rotating ground Eight-Trigram thunder sigil at t=0.82s, got ${sigilPx}`);

  // Phase 3a (t = 0.88s): 1st Colossal Golden Thunderbolt strike
  t = stepTo(0.88, t);
  const strike1Px = countBox(ox + 192 - 65, ox + 192 + 80, oy - 205, oy + 10);
  assert.ok(strike1Px > 1800, `expected 1st colossal golden lightning pillar at t=0.88s, got ${strike1Px}`);

  // Phase 3b (t = 1.40s): 3rd Climax Colossal Golden Thunderbolt strike
  t = stepTo(1.40, t);
  const strike3Px = countBox(ox + 192 - 65, ox + 192 + 80, oy - 205, oy + 10);
  assert.ok(strike3Px > 2200, `expected 3rd climax colossal golden lightning pillar at t=1.40s, got ${strike3Px}`);

  let whiteCount = 0;
  for (let i = 0; i < frame.color.length; i++) {
    if ((frame.color[i] >>> 0) === (WHITE >>> 0)) whiteCount++;
  }
  assert.ok(whiteCount > 150, `expected blinding white-gold core pixels at t=1.40s, got ${whiteCount}`);

  // Phase 4 (t = 2.40s): Scorched crater, Lichtenberg golden floor cracks, crawling residual arcs, charred ash & rising ozone smoke
  t = stepTo(2.40, t);
  const craterAndCracksPx = countBox(ox + 192 - 60, ox + 192 + 75, oy - 6, oy + 10);
  const smokeAndArcsPx = countBox(ox + 192 - 60, ox + 192 + 75, oy - 75, oy - 6);
  assert.ok(craterAndCracksPx > 120, `expected scorched crater & Lichtenberg golden floor cracks at t=2.40s, got ${craterAndCracksPx}`);
  assert.ok(smokeAndArcsPx > 250, `expected rising ozone smoke wisps, charred ash & residual golden arcs at t=2.40s, got ${smokeAndArcsPx}`);

  // End (t = 4.20s > duration): Complete dissipation with 0 remaining pixels
  t = stepTo(4.20, t);
  const endPixels = countBox(0, W - 1, 0, H - 1);
  assert.equal(endPixels, 0, `expected 0 pixels after duration (t=4.20s), got ${endPixels}`);
});

test("moves/celestial-thunder-talisman createAct scene steps smoothly with multi-stage hit-stop, heavy shake, and clean completion", () => {
  const { meta } = thunderTalisman;
  const [W, H] = meta.size;
  const scene = createAct(thunderTalisman, { seed: 23 });
  const frame = createFrame(W, H);

  let maxShake = 0;
  let steps = 0;
  while (!scene.done() && steps < 400) {
    scene.update(1 / 30);
    const sh = Math.hypot(scene.shake[0], scene.shake[1]);
    if (sh > maxShake) maxShake = sh;
    if (steps === 36 || steps === 48) {
      clearFrame(frame);
      scene.draw(frame);
    }
    steps++;
  }

  assert.ok(scene.done(), "expected createAct scene to finish cleanly");
  assert.ok(maxShake >= 3.0, `expected heavy camera shake during Colossal Golden Thunderbolt hits, got maxShake=${maxShake}`);
});

test("moves/celestial-thunder-talisman is deterministic by seed and supports custom palette, cinnabar, and cloud options", () => {
  const { meta } = thunderTalisman;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;

  const runOnce = (opts) => {
    const inst = createFx(thunderTalisman, { x: ox, y: oy, ...opts });
    const f = createFrame(W, H);
    for (let i = 0; i < 68; i++) inst.update(1 / 60);
    inst.draw(f);
    return f.color;
  };

  const a = runOnce({ seed: 55 });
  const b = runOnce({ seed: 55 });
  assert.deepEqual(a, b, "same seed must produce identical pixel output");

  const c = runOnce({
    seed: 55,
    palette: ["#041226", "#0b2c5a", "#1658a8", "#2d90e8", "#5cc4ff", "#9ae4ff", "#d4f6ff", "#ffffff"],
    cinnabar: ["#1c0828", "#42125c", "#74229e", "#a83cd8", "#d67aff", "#f2c8ff"],
    cloud: ["#040810", "#0a1224", "#14223e", "#243c64", "#3e6296"],
  });
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== c[i]) diff++;
  }
  assert.ok(diff > 300, `expected custom palette/cinnabar/cloud options to recolor the effect, diff=${diff}`);
});
