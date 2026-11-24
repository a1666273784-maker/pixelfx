import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, painterFor, resolveOptions } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as hologramScan from "../src/fx/scifi/hologram-scan.js";

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

test("scifi/hologram-scan is registered in effects catalog with expected full-screen loop meta", () => {
  const fx = effects["scifi/hologram-scan"];
  assert.ok(fx, "scifi/hologram-scan should be registered in src/fx/index.js");
  assert.equal(fx.meta.name, "Hologram scan");
  assert.equal(fx.meta.loop, true);
  assert.equal(fx.meta.bg, "dark");
  assert.equal(fx.meta.duration, 3.6);
  assert.equal(fx.meta.fps, 30);
  assert.deepEqual(fx.meta.size, [320, 180]);
  assert.deepEqual(fx.meta.origin, [160, 90]);
});

test("scifi/hologram-scan sweeps cyan laser line uniformly from top to bottom with trailing hex grid, jumping code, CRT scanlines, and edge RGB glitch", () => {
  const D = hologramScan.meta.duration;
  const H = 180;

  // Verify at t = 0.25*D (y_scan = 45), t = 0.50*D (y_scan = 90), and t = 0.75*D (y_scan = 135)
  // that the laser scanline and wake are concentrated right at and above y_scan, while far ahead is dark
  for (const frac of [0.25, 0.5, 0.75]) {
    const t = frac * D;
    const frame = renderAt(hologramScan, t);
    const scanPy = Math.floor(frac * H);

    // 1. Laser scanline row itself emits full-width bright color and additive glow
    const laserBand = countRegion(frame, 20, scanPy - 1, 300, scanPy + 1);
    assert.ok(
      laserBand.lightCount > 500,
      `Laser scanline should emit strong full-width light at py=${scanPy} (t=${t.toFixed(2)}s, got ${laserBand.lightCount})`
    );

    // 2. Wake region (4..48 px above scanPy) has dense hex grid and jumping digital code glow
    const wakeBand = countRegion(frame, 30, scanPy - 42, 290, scanPy - 4);
    assert.ok(
      wakeBand.lightCount > 1500,
      `Trailing hex grid and jumping digital code should glow in the wake above py=${scanPy} (got ${wakeBand.lightCount})`
    );

    // 3. Unscanned region well ahead of the scanline (15..35 px below scanPy) has zero wake light in the center
    const aheadBand = countRegion(frame, 40, scanPy + 12, 280, scanPy + 32);
    assert.equal(
      aheadBand.lightCount,
      0,
      `Unscanned center zone ahead of the laser line should have faded out completely (got ${aheadBand.lightCount})`
    );
  }

  // Verify fine CRT scanline texture spans odd rows across the screen
  const fMid = renderAt(hologramScan, 1.8);
  let oddRowColored = 0;
  for (let x = 60; x < 260; x++) {
    if (fMid.color[141 * 320 + x] !== 0) oddRowColored++;
  }
  assert.equal(oddRowColored, 200, "Fine CRT dark scanline grooves should span odd rows across the screen");
});

test("scifi/hologram-scan loops seamlessly and supports custom palette, red, and blue options", () => {
  const fStart = renderAt(hologramScan, 0);
  const fEnd = renderAt(hologramScan, hologramScan.meta.duration);

  assert.deepEqual(fStart.color, fEnd.color, "Color buffer at t=0 and t=duration must match for seamless loop");
  assert.deepEqual(fStart.light, fEnd.light, "Light buffer at t=0 and t=duration must match for seamless loop");

  const fDefault = renderAt(hologramScan, 1.5, { seed: 17 });
  const fCustom = renderAt(hologramScan, 1.5, {
    seed: 17,
    palette: ["#04180c", "#08321a", "#105c30", "#1c9650", "#2edc78", "#58ffa2", "#c4ffde", "#ffffff"],
    red: "#ff4400",
    blue: "#8822ff",
  });

  let recolored = 0;
  for (let i = 0; i < fDefault.color.length; i++) {
    if (fDefault.color[i] !== fCustom.color[i]) recolored++;
  }
  assert.ok(recolored > 5000, `Custom palette/red/blue options should recolor hologram scan pixels (recolored=${recolored})`);
});
