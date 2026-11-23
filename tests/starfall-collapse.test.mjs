import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, createAct, WHITE } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as starfallCollapse from "../src/fx/moves/starfall-collapse.js";

test("moves/starfall-collapse is registered in src/fx/index.js with valid metadata and act choreography", () => {
  const { meta, create, act } = starfallCollapse;
  assert.equal(meta.name, "Starfall collapse");
  assert.deepEqual(meta.size, [436, 264]);
  assert.deepEqual(meta.origin, [88, 214]);
  assert.equal(meta.duration, 4.2);
  assert.equal(meta.loop, false);
  assert.equal(meta.fps, 30);
  assert.equal(meta.bg, "ground");
  assert.equal(meta.actor, 2);
  assert.equal(typeof create, "function");
  assert.equal(typeof act, "object");
  assert.equal(act.target.x, 192);
  assert.ok(act.poses.length >= 8);
  assert.ok(act.hits.length >= 5);
  assert.equal(effects["moves/starfall-collapse"], starfallCollapse);
});

test("moves/starfall-collapse progresses through starfall descent -> relativistic black hole accretion of light & boulders -> extreme compression into a single point -> cosmic supernova detonation & spatial fractures -> astral crater & zero-G rubble -> empty end", () => {
  const { meta } = starfallCollapse;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;
  const inst = createFx(starfallCollapse, { x: ox, y: oy, seed: 19 });
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

  // Phase 1a (t = 0.24s): Falling star core plunging from the cosmos toward (TX=192, BH_Y=-54)
  t = stepTo(0.24, t);
  const starPlungePx = countBox(ox + 60, ox + 195, oy - 205, oy - 45);
  assert.ok(starPlungePx > 140, `expected blazing falling star and comet wake at t=0.24s, got ${starPlungePx}`);

  // Phase 1b (t = 0.65s): Relativistic Black Hole, accretion disk, Einstein lensing arcs, sucked-in light ribbons & faceted boulders
  t = stepTo(0.65, t);
  const bhAccretionPx = countBox(ox + 192 - 90, ox + 192 + 90, oy - 135, oy + 10);
  assert.ok(bhAccretionPx > 2200, `expected relativistic black hole accretion disk, light ribbons, and boulders at t=0.65s, got ${bhAccretionPx}`);

  // Phase 2 (t = 1.13s): Extreme compression into a single Planck singularity point ("极度压缩成一点")
  t = stepTo(1.13, t);
  const compressedPointPx = countBox(ox + 192 - 14, ox + 192 + 14, oy - 54 - 14, oy - 54 + 14);
  const totalAtPointPx = countBox(ox + 192 - 90, ox + 192 + 90, oy - 135, oy + 10);
  assert.ok(compressedPointPx > 60, `expected bright Planck singularity point & crosshair lens at t=1.13s, got ${compressedPointPx}`);
  assert.ok(totalAtPointPx < bhAccretionPx * 0.55, `expected accretion disk to collapse tightly into a point at t=1.13s (${totalAtPointPx} vs ${bhAccretionPx})`);

  // Phase 3 (t = 1.40s): Cosmic Supernova Detonation, Bipolar Quasar Jets, Spatial Distortion Shockwaves & Dimensional Space-Fractures
  t = stepTo(1.40, t);
  const supernovaPx = countBox(ox + 192 - 115, ox + 192 + 115, oy - 205, oy + 14);
  assert.ok(supernovaPx > 3200, `expected cataclysmic supernova eruption, quasar jets & spatial fractures at t=1.40s, got ${supernovaPx}`);

  let whiteCount = 0;
  for (let i = 0; i < frame.color.length; i++) {
    if ((frame.color[i] >>> 0) === (WHITE >>> 0)) whiteCount++;
  }
  assert.ok(whiteCount > 120, `expected blinding white-gold/violet supernova pixels at t=1.40s, got ${whiteCount}`);

  // Phase 4 (t = 2.45s): Scorched Starfall Abyssal Crater, astral magma fissures, zero-G levitating boulders & rising cosmic nebula smoke
  t = stepTo(2.45, t);
  const craterPx = countBox(ox + 192 - 60, ox + 192 + 78, oy - 6, oy + 10);
  const aftermathAirPx = countBox(ox + 192 - 70, ox + 192 + 85, oy - 110, oy - 6);
  assert.ok(craterPx > 120, `expected scorched astral crater & glowing floor fissures at t=2.45s, got ${craterPx}`);
  assert.ok(aftermathAirPx > 400, `expected rising cosmic nebula smoke & zero-G levitating boulders at t=2.45s, got ${aftermathAirPx}`);

  // End (t = 4.25s > duration): Complete dissipation with 0 remaining pixels
  t = stepTo(4.25, t);
  const endPixels = countBox(0, W - 1, 0, H - 1);
  assert.equal(endPixels, 0, `expected 0 pixels after duration (t=4.25s), got ${endPixels}`);
});

test("moves/starfall-collapse createAct scene steps smoothly with gravitational pull-in, multi-stage hit-stop, heavy shake, and clean completion", () => {
  const { meta } = starfallCollapse;
  const [W, H] = meta.size;
  const scene = createAct(starfallCollapse, { seed: 19 });
  const frame = createFrame(W, H);

  let maxShake = 0;
  let steps = 0;
  while (!scene.done() && steps < 400) {
    scene.update(1 / 30);
    const sh = Math.hypot(scene.shake[0], scene.shake[1]);
    if (sh > maxShake) maxShake = sh;
    if (steps === 34 || steps === 48) {
      clearFrame(frame);
      scene.draw(frame);
    }
    steps++;
  }

  assert.ok(scene.done(), "expected createAct scene to finish cleanly");
  assert.ok(maxShake >= 3.2, `expected heavy camera shake during Supernova detonation, got maxShake=${maxShake}`);
});

test("moves/starfall-collapse is deterministic by seed and supports custom palette, star, cyan, and rock options", () => {
  const { meta } = starfallCollapse;
  const [W, H] = meta.size;
  const [ox, oy] = meta.origin;

  const runOnce = (opts) => {
    const inst = createFx(starfallCollapse, { x: ox, y: oy, ...opts });
    const f = createFrame(W, H);
    for (let i = 0; i < 42; i++) inst.update(1 / 60);
    inst.draw(f);
    return f.color;
  };

  const a = runOnce({ seed: 31 });
  const b = runOnce({ seed: 31 });
  assert.deepEqual(a, b, "same seed must produce identical pixel output");

  const c = runOnce({
    seed: 31,
    palette: ["#040b10", "#0b1e2d", "#143854", "#205c88", "#348cc4", "#5cc2f6", "#a8e6ff", "#f0fbff"],
    star: ["#1c0414", "#480a34", "#821460", "#c42494", "#f654c8", "#ffa4e4", "#ffffff"],
    cyan: ["#062418", "#105238", "#1e8e62", "#42d498", "#9ef6ce", "#ffffff"],
  });
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== c[i]) diff++;
  }
  assert.ok(diff > 300, `expected custom palette/star/cyan options to recolor the effect, diff=${diff}`);
});
