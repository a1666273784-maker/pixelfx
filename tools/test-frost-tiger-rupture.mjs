#!/usr/bin/env node
// Focused regression/audit: node tools/test-frost-tiger-rupture.mjs
// Artifacts stay in ignored records/. No dependencies, no generated assets in Git.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createFrame, clearFrame, createFx, painterFor, resolveOptions, luma, hex } from "../src/core/index.js";
import { ROOT, loadEffect, renderFrames, spriteSheet } from "./lib/fxlib.mjs";

const fx = await loadEffect("ice/frost-tiger-rupture"), { meta, mod } = fx;
const dir = join(ROOT, "records/ice/frost-tiger-rupture");
mkdirSync(dir, { recursive: true });
const [w, h] = meta.size, [ox, oy] = meta.origin;
const nonempty = (buf) => buf.some(c => c & 0xffffff || c >>> 24);

// Compare BOTH buffers, and inspect an un-faded 48 px margin (not the exporter's edge fade).
function run(seed, options = {}) {
  const f = createFrame(w + 96, h + 96, -48, -48);
  const inst = createFx(mod, { x: ox, y: oy, seed, ...options });
  const hash = createHash("sha256");
  let partialAlpha = false;
  for (let i = 0; i <= 135; i++) {
    if (i) inst.update(1 / 30);
    inst.draw(clearFrame(f));
    hash.update(Buffer.from(f.color.buffer)); hash.update(Buffer.from(f.light.buffer));
    for (let j = 0; j < f.color.length; j++) {
      const x = j % f.w - 48, y = Math.floor(j / f.w) - 48;
      if (x < 0 || x >= w || y < 0 || y >= h) {
        assert.equal(f.color[j], 0, `color spill: seed ${seed}, frame ${i}, ${x},${y}`);
        assert.equal(f.light[j] & 0xffffff, 0, `light spill: seed ${seed}, frame ${i}, ${x},${y}`);
      }
      const a = f.color[j] >>> 24;
      partialAlpha ||= a > 0 && a < 255;
    }
    if (i === 135) {
      assert.equal(nonempty(f.color), false, "last color frame must be empty");
      assert.equal(nonempty(f.light), false, "last light frame must be empty");
    }
  }
  assert(partialAlpha, "hoarfrost must use real transparency");
  return hash.digest("hex");
}
const seedHashes = {};
for (const seed of [1, 2, 3, 7, 17, 42]) seedHashes[seed] = run(seed);
assert.equal(seedHashes[17], run(17), "seed must reproduce both buffers");
assert.notEqual(seedHashes[17], seedHashes[42], "different seeds must vary the fissures");
const recolor = { palette: ["#081418", "#4f9099", "#dbf5f8"], frost: ["#28313a", "#ffffff"], gold: ["#86520c"] };
assert.equal(run(23, recolor), run(23, recolor), "short-ramp recoloring must be deterministic");

// Exercise the simulated export directly, including exactly t = duration (no runtime early-out).
const impl = mod.create(resolveOptions(meta)), direct = createFrame(w, h);
for (let i = 0; i < 540; i++) impl.update(meta.duration / 540);
const p = painterFor(direct).place(ox, oy);
impl.drawBack(p); impl.draw(p);
assert(!nonempty(direct.color) && !nonempty(direct.light), "direct create ends empty");

// The anticipatory cleave must exist in the exported effect, not only the stock actor's poses.
for (const time of [0.8, 0.8333333333, 0.8666666667]) {
  const slash = createFx(mod, { x: ox, y: oy }), f = createFrame(w, h);
  slash.update(time); slash.draw(f);
  let bladePixels = 0;
  for (let y = oy - 85; y < oy - 35; y++) for (let x = ox - 45; x < ox + 60; x++)
    if (f.color[y*w+x] >>> 24) bladePixels++;
  assert(bladePixels > 15, `missing overhead/downward cleave before impact at ${time}`);
}

// The exact contact frame and its successor must both contain a white-hot core.
const hero = createFx(mod, { x: ox, y: oy }), heroFrame = createFrame(w, h);
hero.update(0.9);
for (let i = 0; i < 2; i++) {
  hero.draw(clearFrame(heroFrame));
  let white = 0;
  for (let y = oy - 12; y <= oy + 3; y++) for (let x = ox - 16; x <= ox + 16; x++)
    if ((heroFrame.color[y * w + x] >>> 0) === 0xffffffff) white++;
  assert(white > 10, `missing white hero core at frame ${27+i}`);
  hero.update(1 / 30);
}

const hsv = (s) => {
  const v = s.slice(1).match(/../g).map(c => parseInt(c, 16) / 255);
  const [r, g, b] = v, hi = Math.max(...v), lo = Math.min(...v), d = hi - lo;
  const hue = !d ? null : ((hi === r ? (g-b)/d : hi === g ? (b-r)/d+2 : (r-g)/d+4) * 60 + 360) % 360;
  return { hue, saturation: hi ? d / hi * 100 : 0 };
};
const ramps = {};
for (const name of ["palette", "frost", "gold"]) {
  const colors = meta.options[name], ys = colors.map(c => luma(hex(c))), hs = colors.map(hsv);
  const steps = hs.slice(1).map((v, i) => v.hue === null || hs[i].hue === null ? 0 : Math.min(Math.abs(v.hue - hs[i].hue), 360 - Math.abs(v.hue - hs[i].hue)));
  assert(ys.every((v, i) => !i || v > ys[i-1]), `${name}: luma must strictly rise`);
  assert(Math.max(...steps) <= 21, `${name}: hue steps exceed 21 degrees`);
  ramps[name] = { luma: ys, maxHueStepDegrees: Math.max(...steps), brightestSaturationHSV: hs.at(-1).saturation,
    saturationCapPassed: hs.at(-1).saturation <= 40 };
}
assert(ramps.palette.saturationCapPassed && ramps.frost.saturationCapPassed);
// The requested five-color gold ramp ends at #f0b424 (85% HSV saturation).
// Preserve the exact requested colors; report the conflict, do not falsely claim a pass.

const r = renderFrames(fx, { actor: false });
const s = spriteSheet(fx, r, "frost-tiger-rupture");
const frames = r.frames.map((f, index) => {
  const rawRGB = new Set(), clearRGB = new Set(), packedRGB = new Set(), alphas = new Set();
  const packed = new Uint8ClampedArray(3);
  let pixels = 0;
  for (const c of f.raw) if (c >>> 24) rawRGB.add(c & 0xffffff);
  for (let j = 0; j < f.clear.length; j += 4) {
    const a = f.clear[j+3]; alphas.add(a);
    if (a) {
      pixels++;
      clearRGB.add(f.clear[j] | f.clear[j+1] << 8 | f.clear[j+2] << 16);
      // spriteSheet/canvas.paste composites RGB over its zero-filled transparent canvas.
      for (let k = 0; k < 3; k++) packed[k] = f.clear[j+k] * a / 255;
      packedRGB.add(packed[0] | packed[1] << 8 | packed[2] << 16);
    }
  }
  return { index, t: f.t, rawColors: rawRGB.size, compositedColors: clearRGB.size, exportedColors: packedRGB.size, pixels, alphaLevels: alphas.size,
    binaryAlpha: [...alphas].every(a => a === 0 || a === 255) };
});
assert.equal(frames.at(-1).pixels, 0);
const report = {
  frameSize: [w, h], pivot: meta.origin, fps: r.fps, frames: r.n, sheetSize: s.json.meta.size,
  seeds: Object.keys(seedHashes).map(Number), deterministic: true, shortRamps: true,
  emptyAtDuration: true, colorAndLightSpill: 0,
  rawColorsRange: [Math.min(...frames.map(f => f.rawColors)), Math.max(...frames.map(f => f.rawColors))],
  compositedColorsRange: [Math.min(...frames.map(f => f.compositedColors)), Math.max(...frames.map(f => f.compositedColors))],
  exportedColorsRange: [Math.min(...frames.map(f => f.exportedColors)), Math.max(...frames.map(f => f.exportedColors))],
  binaryAlphaOnly: frames.every(f => f.binaryAlpha), ramps,
};
writeFileSync(join(dir, "audit.json"), JSON.stringify({ ...report, perFrame: frames }, null, 2));
writeFileSync(join(dir, "colors-per-frame.csv"), "frame,time,raw_rgb,composited_rgb,exported_rgb,visible_pixels,alpha_levels,binary_alpha\n" + frames.map(f => `${f.index},${f.t.toFixed(6)},${f.rawColors},${f.compositedColors},${f.exportedColors},${f.pixels},${f.alphaLevels},${f.binaryAlpha}`).join("\n") + "\n");
console.log(JSON.stringify(report, null, 2));
console.log("PASS: determinism, seed variation, short ramps, color/light bounds, real alpha, empty final frame.\nNOTE: the user-specified gold ramp exceeds the 40% saturation cap; see audit.json.");
