import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx, createAct } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as crimsonGoldTorrent from "../src/fx/moves/crimson-gold-torrent.js";

test("moves/crimson-gold-torrent is registered in src/fx/index.js with valid two-actor Boss move metadata", () => {
  const { meta, create, act } = crimsonGoldTorrent;
  assert.equal(meta.name, "Crimson gold torrent");
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.equal(meta.actor, 2);
  assert.deepEqual(meta.size, [448, 216]);
  assert.deepEqual(meta.origin, [82, 168]);
  assert.equal(typeof create, "function");
  assert.equal(typeof act, "object");
  assert.equal(act.target.x, 196);
  assert.equal(effects["moves/crimson-gold-torrent"], crimsonGoldTorrent);
});

test("moves/crimson-gold-torrent progresses through heat distortion & spiral collapse -> gold sonic rings & crimson-gold torrent -> enemy engulfment, white strobe & spatial ripples -> singed smoke & rising embers -> empty end", () => {
  const { meta } = crimsonGoldTorrent;
  const [W, H] = meta.size;
  const inst = createFx(crimsonGoldTorrent, { x: meta.origin[0], y: meta.origin[1], seed: 19 });
  const frame = createFrame(W, H);

  const countBox = (xMin, xMax, yMin = 0, yMax = H - 1) => {
    let n = 0;
    for (let y = yMin; y <= yMax; y++) {
      const row = y * W;
      for (let x = xMin; x <= xMax; x++) {
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

  // Phase 1: Heat-wave distortion & spiraling collapse into white core at caster (t = 0.30s)
  t = stepTo(0.30, t);
  const gatherLeftPx = countBox(35, 175, 80, 172);
  const farRightEarlyPx = countBox(240, W - 1, 0, H - 1);
  assert.ok(gatherLeftPx > 600, `expected heat distortion & spiraling crimson-gold collapse at t=0.30s, got ${gatherLeftPx}`);
  assert.equal(farRightEarlyPx, 0, "expected target zone to be empty during initial spiral gather");

  // Phase 2a: Multi-layer translucent flowing-gold sonic-boom rings erupting forward first (t = 0.52s)
  t = stepTo(0.52, t);
  const sonicRingPx = countBox(95, 220, 95, 172);
  assert.ok(sonicRingPx > 450, `expected expanding flowing-gold sonic-boom rings at t=0.52s, got ${sonicRingPx}`);

  // Phase 2b & 3: Colossal crimson-gold flame torrent piercing horizontally & engulfing enemy (t = 0.85s)
  t = stepTo(0.85, t);
  const torrentCorridorPx = countBox(105, 365, 95, 172);
  const enemyEngulfPx = countBox(235, 345, 75, 172);
  assert.ok(torrentCorridorPx > 4500, `expected colossal horizontal crimson-gold flame torrent at t=0.85s, got ${torrentCorridorPx}`);
  assert.ok(enemyEngulfPx > 2200, `expected enemy engulfment, shockwaves, white strobe & spatial ripples at t=0.85s, got ${enemyEngulfPx}`);

  // Phase 4: Singed-grey smoke billowing along energy path & ascending gold sparks / dark-red light dust (t = 2.15s)
  t = stepTo(2.15, t);
  const aftermathPathPx = countBox(100, 365, 50, 170);
  assert.ok(aftermathPathPx > 2000, `expected dense singed-grey smoke & ascending gold/crimson embers at t=2.15s, got ${aftermathPathPx}`);

  // Phase 5: Clean empty frame at duration (t = 3.85s)
  t = stepTo(meta.duration, t);
  const endPx = countBox(0, W - 1, 0, H - 1);
  assert.equal(endPx, 0, `expected 0 pixels at t=duration, got ${endPx}`);
});

test("moves/crimson-gold-torrent act choreography delivers multi-stage hit-stop, heavy shake, knockback slide, and clean recovery", () => {
  const { meta } = crimsonGoldTorrent;
  const [W, H] = meta.size;
  const scene = createAct(crimsonGoldTorrent, { x: meta.origin[0], y: meta.origin[1], seed: 19 });
  const frame = createFrame(W, H);
  let maxShake = 0;
  let sawFreeze = false;

  for (let i = 0; i < 360 && !scene.done(); i++) {
    scene.update(1 / 30);
    const sh = Math.hypot(scene.shake[0], scene.shake[1]);
    if (sh > maxShake) maxShake = sh;
    if (scene.frozen) sawFreeze = true;
    if (i % 6 === 0) scene.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger oppressive hit-stop freeze");
  assert.ok(maxShake > 2.5, `expected heavy oppressive screen shake, got maxShake=${maxShake}`);
  assert.ok(scene.done(), "act choreography must complete cleanly");
});

test("moves/crimson-gold-torrent is deterministic by seed and supports custom palette, gold, and smoke options", () => {
  const { meta } = crimsonGoldTorrent;
  const [W, H] = meta.size;
  const customPalette = ["#081624", "#12385e", "#2272b8", "#48b8ff", "#ffffff"];
  const customGold = ["#1a0826", "#581884", "#b246f2", "#f2c8ff"];
  const customSmoke = ["#0a1412", "#1c3630", "#3c6e62", "#78b8a8"];

  const runAt = (opts) => {
    const inst = createFx(crimsonGoldTorrent, { x: meta.origin[0], y: meta.origin[1], ...opts });
    const f = createFrame(W, H);
    for (let i = 0; i < 28; i++) inst.update(1 / 30);
    inst.draw(f);
    return f.color.slice();
  };

  const a = runAt({ seed: 19 });
  const b = runAt({ seed: 19 });
  const c = runAt({ seed: 19, palette: customPalette, gold: customGold, smoke: customSmoke });

  assert.deepEqual(a, b, "same seed should produce identical frames");
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== c[i]) diff++;
  assert.ok(diff > 1000, `expected custom palette/gold/smoke to recolor torrent and rings, got ${diff} differing pixels`);
});
