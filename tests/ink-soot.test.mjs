import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, painterFor, resolveOptions } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as inkSoot from "../src/fx/critters/ink-soot.js";

function renderAt(fx, t, customOpts = {}) {
  const [w, h] = fx.meta.size;
  const [ox, oy] = fx.meta.origin;
  const opts = resolveOptions(fx.meta, customOpts);
  const frame = createFrame(w, h);
  const p = painterFor(clearFrame(frame));
  p.place(ox, oy);
  fx.drawBack?.(p, t, opts);
  fx.draw(p, t, opts);
  return frame;
}

function countRegion(frame, x0, y0, x1, y1) {
  let colorCount = 0;
  let lightCount = 0;
  const { w, h, color, light } = frame;
  const cx0 = Math.max(0, Math.floor(x0));
  const cy0 = Math.max(0, Math.floor(y0));
  const cx1 = Math.min(w - 1, Math.floor(x1));
  const cy1 = Math.min(h - 1, Math.floor(y1));
  for (let y = cy0; y <= cy1; y++) {
    for (let x = cx0; x <= cx1; x++) {
      const idx = y * w + x;
      if (color[idx] !== 0) colorCount++;
      if (light[idx] !== 0) lightCount++;
    }
  }
  return { colorCount, lightCount };
}

test("critters/ink-soot is registered in effects catalog with expected meta", () => {
  const fx = effects["critters/ink-soot"];
  assert.ok(fx, "critters/ink-soot should be registered in src/fx/index.js");
  assert.equal(fx.meta.name, "Ink soot");
  assert.equal(fx.meta.loop, true);
  assert.equal(fx.meta.bg, "ground");
  assert.equal(fx.meta.duration, 2.8);
  assert.equal(fx.meta.fps, 30);
  assert.deepEqual(fx.meta.size, [176, 128]);
  assert.deepEqual(fx.meta.origin, [88, 102]);
});

test("critters/ink-soot animates through closed-eye soot ball, opening yellow eyes, startle ink-fling shake, and huddled peeking with question marks", () => {
  const [ox, oy] = inkSoot.meta.origin;

  // 1. At t = 0.00s, eyes are shut inside the pitch-black soot ball (core has zero eye light)
  const fShut = renderAt(inkSoot, 0.0);
  const fOpen = renderAt(inkSoot, 0.30);
  const faceShut = countRegion(fShut, ox - 11, oy - 22, ox + 11, oy - 10);
  const faceOpen = countRegion(fOpen, ox - 11, oy - 22, ox + 11, oy - 10);
  assert.ok(
    faceOpen.lightCount > faceShut.lightCount + 120,
    `Opening the two bright-yellow eyes should strongly illuminate the soot face (shut=${faceShut.lightCount}, open=${faceOpen.lightCount})`
  );

  // 2. Steaming black smoke rises continuously above the crown (y in [oy - 52 .. oy - 32])
  const smokeRegion = countRegion(fOpen, ox - 20, oy - 52, ox + 20, oy - 32);
  assert.ok(
    smokeRegion.colorCount > 120,
    `Steaming black ink smoke should continuously billow above the soot ball (got ${smokeRegion.colorCount})`
  );

  // 3. Wriggling ground ink shadow clings underfoot (y in [oy - 2 .. oy + 6])
  const shadowRegion = countRegion(fOpen, ox - 36, oy - 2, ox + 36, oy + 6);
  assert.ok(
    shadowRegion.colorCount > 240,
    `Wriggling ground ink shadow should cling underfoot (got ${shadowRegion.colorCount})`
  );

  // 4. Violent startle shake & flung ink droplets (t = 1.08s & t = 1.25s) spread ink blotches wide to both sides
  const fStartle = renderAt(inkSoot, 1.15);
  const sideSplatterLeft = countRegion(fStartle, ox - 68, oy - 34, ox - 26, oy + 6);
  const sideSplatterRight = countRegion(fStartle, ox + 26, oy - 34, ox + 68, oy + 6);
  const idleLeft = countRegion(fShut, ox - 68, oy - 34, ox - 26, oy + 6);
  assert.ok(
    sideSplatterLeft.colorCount + sideSplatterRight.colorCount > idleLeft.colorCount * 2 + 80,
    `Startle shake should fling black ink droplets & blotches to both sides (left=${sideSplatterLeft.colorCount}, right=${sideSplatterRight.colorCount})`
  );

  // 5. Huddled peeking phase with overhead glowing question-mark light motes (t = 1.85s)
  const fHuddle = renderAt(inkSoot, 1.85);
  const overheadMarks = countRegion(fHuddle, ox - 28, oy - 56, ox + 28, oy - 32);
  assert.ok(
    overheadMarks.lightCount > 250 && overheadMarks.colorCount > 100,
    `Huddled peeking phase should pop glowing question-mark light motes overhead (color=${overheadMarks.colorCount}, light=${overheadMarks.lightCount})`
  );
});

test("critters/ink-soot loops seamlessly and supports custom palette and eyes options", () => {
  const fStart = renderAt(inkSoot, 0);
  const fEnd = renderAt(inkSoot, inkSoot.meta.duration);

  assert.deepEqual(fStart.color, fEnd.color, "Color buffer at t=0 and t=duration must match for seamless loop");
  assert.deepEqual(fStart.light, fEnd.light, "Light buffer at t=0 and t=duration must match for seamless loop");

  const fDefault = renderAt(inkSoot, 1.8, { seed: 2 });
  const fCustom = renderAt(inkSoot, 1.8, {
    seed: 2,
    palette: ["#040806", "#0a1612", "#162c24", "#285042", "#44826c", "#74b8a0", "#b8f0dc"],
    eyes: ["#240814", "#6e1438", "#c82868", "#ff5298", "#ffa4cc", "#ffffff"],
  });

  let recolored = 0;
  for (let i = 0; i < fDefault.color.length; i++) {
    if (fDefault.color[i] !== fCustom.color[i]) recolored++;
  }
  assert.ok(recolored > 500, `Custom palette and eyes options should recolor ink-soot pixels (recolored=${recolored})`);
});
