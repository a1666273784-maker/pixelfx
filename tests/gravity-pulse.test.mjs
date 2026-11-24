import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, painterFor, resolveOptions } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as gravityPulse from "../src/fx/arcane/gravity-pulse.js";

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

test("arcane/gravity-pulse is registered in effects catalog with expected loop meta", () => {
  const fx = effects["arcane/gravity-pulse"];
  assert.ok(fx, "arcane/gravity-pulse should be registered in src/fx/index.js");
  assert.equal(fx.meta.name, "Gravity pulse");
  assert.equal(fx.meta.loop, true);
  assert.equal(fx.meta.bg, "ground");
  assert.equal(fx.meta.duration, 3.6);
  assert.equal(fx.meta.fps, 30);
  assert.deepEqual(fx.meta.size, [224, 164]);
  assert.deepEqual(fx.meta.origin, [112, 128]);
});

test("arcane/gravity-pulse progresses through ground ripple -> upward float -> 1s apex pause with arcs -> gravity drop & bounce with light-dust", () => {
  const [ox, oy] = gravityPulse.meta.origin;

  // 1. Resting state at t = 0.0: stones and droplets sit on the ground, upper air is empty
  const fRest = renderAt(gravityPulse, 0.0);
  const restUpper = countRegion(fRest, ox - 80, oy - 95, ox + 80, oy - 25);
  const restGround = countRegion(fRest, ox - 80, oy - 12, ox + 80, oy + 14);
  assert.equal(restUpper.colorCount, 0, "Upper air should have no floating stones at t=0.0");
  assert.ok(restGround.colorCount > 150, "Ground should have resting stones and water droplets at t=0.0");

  // 2. Expanding pale-blue anti-gravity ground ripple (t = 0.65s)
  const fRipple = renderAt(gravityPulse, 0.65);
  const outerGroundRipple = countRegion(fRipple, ox - 92, oy - 22, ox + 92, oy + 22);
  assert.ok(
    outerGroundRipple.colorCount > restGround.colorCount + 500,
    `Expanding pale-blue anti-gravity ripple should illuminate the floor (got ${outerGroundRipple.colorCount} vs rest ${restGround.colorCount})`
  );

  // 3. 1-second apex pause (t = 1.45s, 1.90s, 2.35s): stones & droplets hover at their highest point with crawling electric arcs
  for (const tApex of [1.45, 1.9, 2.35]) {
    const fApex = renderAt(gravityPulse, tApex);
    const highZone = countRegion(fApex, ox - 76, oy - 96, ox + 76, oy - 26);
    assert.ok(highZone.colorCount > 450, `Stones and water droplets should hover in mid-air at apex t=${tApex}s (got ${highZone.colorCount})`);
    assert.ok(highZone.lightCount > 700, `Electric arcs and droplet glints should emit strong light in mid-air at t=${tApex}s (got ${highZone.lightCount})`);
  }

  // 4. Gravity drop impact, bounce & luminous dust puffs (t = 2.95s): upper air is clear, ground has billowing light-dust glow
  const fDust = renderAt(gravityPulse, 2.95);
  const dustUpper = countRegion(fDust, ox - 80, oy - 95, ox + 80, oy - 30);
  const dustGround = countRegion(fDust, ox - 84, oy - 14, ox + 84, oy + 14);
  assert.equal(dustUpper.colorCount, 0, "Stones and droplets should have dropped back to the ground by t=2.95s");
  assert.ok(
    dustGround.lightCount > restGround.lightCount + 400,
    `Landing luminous dust puffs should glow across the ground at t=2.95s (got ${dustGround.lightCount} vs rest ${restGround.lightCount})`
  );
});

test("arcane/gravity-pulse loops seamlessly and supports custom palette, stone, and water options", () => {
  const fStart = renderAt(gravityPulse, 0);
  const fEnd = renderAt(gravityPulse, gravityPulse.meta.duration);

  assert.deepEqual(fStart.color, fEnd.color, "Color buffer at t=0 and t=duration must match for seamless loop");
  assert.deepEqual(fStart.light, fEnd.light, "Light buffer at t=0 and t=duration must match for seamless loop");

  const fDefault = renderAt(gravityPulse, 1.8, { seed: 23 });
  const fCustom = renderAt(gravityPulse, 1.8, {
    seed: 23,
    palette: ["#041814", "#0a342a", "#14624e", "#229c7a", "#3ad8a8", "#7ef5d0", "#caffec", "#ffffff"],
    stone: ["#14100d", "#261e18", "#3c3026", "#564538", "#755f4e", "#997d68", "#bfa18a", "#e6cdb8"],
    water: ["#06221c", "#0e4a3d", "#1b826b", "#38c4a4", "#96f7df", "#ffffff"],
  });

  let diff = 0;
  for (let i = 0; i < fDefault.color.length; i++) {
    if (fDefault.color[i] !== fCustom.color[i]) diff++;
  }
  assert.ok(diff > 300, `Custom palette/stone/water options should recolor pixels (diff=${diff})`);
});
