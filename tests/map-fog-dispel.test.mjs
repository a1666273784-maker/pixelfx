import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, composite, red, green, blue } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as mapFogDispel from "../src/fx/ui/map-fog-dispel.js";

function stepTo(fx, frame, targetT, fps = 30) {
  const steps = Math.round(targetT * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  fx.draw(frame);
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

test("ui/map-fog-dispel is registered in src/fx/index.js with valid UI metadata", () => {
  assert.equal(effects["ui/map-fog-dispel"], mapFogDispel);
  const { meta } = mapFogDispel;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "dark");
  assert.deepEqual(meta.size, [216, 148]);
  assert.ok(meta.desc.length >= 20 && meta.desc.length <= 180);
});

test("ui/map-fog-dispel progresses through release ink-fog vortex -> rectangular amber-purple halo & cyan-white motes -> pale-ash to white to withered-yellow grid unlock -> edge dust & empty end", () => {
  const { meta } = mapFogDispel;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const frame = createFrame(W, H);

  // 1. Release phase (t = 0.30s): heavy ink-cyan (daiqing) and pale-white pixel clouds swirling over dark UI grid
  {
    const fx = createFx(mapFogDispel, { x: OX, y: OY, seed: 9 });
    stepTo(fx, frame, 0.30);
    let inkCyanPx = 0, paleWhiteCloudPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = red(c), g = green(c), b = blue(c);
        if (b > r * 1.4 && g > r * 1.2 && b >= 40 && r < 90) inkCyanPx++;
        if (r >= 175 && g >= 220 && b >= 230) paleWhiteCloudPx++;
      }
    }
    assert.ok(inkCyanPx > 400, `expected heavy ink-cyan cloud pixels at t=0.30s, got ${inkCyanPx}`);
    assert.ok(paleWhiteCloudPx > 120, `expected pale-white cloud crests at t=0.30s, got ${paleWhiteCloudPx}`);
  }

  // 2. Hit & Fog Dispel + Grid Unlock progression (t = 0.72s -> t = 0.94s):
  //    expanding rectangular interwoven withered-yellow & purplish-crimson halo + flying cyan-white motes + pure-white grid flash
  {
    const fx = createFx(mapFogDispel, { x: OX, y: OY, seed: 9 });
    stepTo(fx, frame, 0.94);
    let amberHaloOrGridPx = 0, purpleHaloPx = 0, whiteHighlightPx = 0, cyanWhiteMotePx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = red(c), g = green(c), b = blue(c);
        if (r >= 245 && g >= 245 && b >= 245) whiteHighlightPx++;
        else if (r > 150 && g > 110 && g > b * 1.35) amberHaloOrGridPx++;
        else if (r > 150 && b > 110 && r > g * 1.35) purpleHaloPx++;
        else if (b > 170 && g > 150 && b > r * 1.15) cyanWhiteMotePx++;
      }
    }
    assert.ok(amberHaloOrGridPx > 100, `expected withered-yellow halo and unlocked grid lines at t=0.94s, got ${amberHaloOrGridPx}`);
    assert.ok(purpleHaloPx > 60, `expected purplish-crimson interwoven halo pixels at t=0.94s, got ${purpleHaloPx}`);
    assert.ok(whiteHighlightPx > 60, `expected pure-white highlight flash on newly exposed grid borders at t=0.94s, got ${whiteHighlightPx}`);
    assert.ok(cyanWhiteMotePx > 25, `expected flying cyan-white vaporized light motes at t=0.94s, got ${cyanWhiteMotePx}`);
  }

  // 3. Post-hit result phase (t = 2.00s): unlocked shimmering withered-yellow grid + rising purple-crimson & grey-white edge dust
  {
    const fx = createFx(mapFogDispel, { x: OX, y: OY, seed: 9 });
    stepTo(fx, frame, 2.00);
    let yellowGridPx = 0, edgeDustPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = red(c), g = green(c), b = blue(c);
        const nearOrOutsideEdge = Math.abs(x - OX) >= 56 || Math.abs(y - OY) >= 32;
        if (r > 140 && g > 100 && g > b * 1.3) yellowGridPx++;
        if (nearOrOutsideEdge && ((r > 150 && b > 110 && r > g * 1.3) || (r > 140 && g > 150 && b > 170))) {
          edgeDustPx++;
        }
      }
    }
    assert.ok(yellowGridPx > 350, `expected shimmering withered-yellow grid lines at t=2.00s, got ${yellowGridPx}`);
    assert.ok(edgeDustPx >= 12, `expected sporadic purple-crimson & grey-white dust around grid edges at t=2.00s, got ${edgeDustPx}`);
  }

  // 4. Clean one-shot end at t = duration
  {
    const fx = createFx(mapFogDispel, { x: OX, y: OY, seed: 9 });
    stepTo(fx, frame, meta.duration);
    assert.ok(frame.color.every((v) => (v >>> 24) === 0), "color buffer must be empty at t = duration");
    assert.ok(frame.light.every((v) => v === 0), "light buffer must be empty at t = duration");
    assert.ok(fx.done(), "fx.done() must be true at t = duration");
  }
});

test("ui/map-fog-dispel is deterministic by seed and supports custom palette recoloring", () => {
  const { meta } = mapFogDispel;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H), f3 = createFrame(W, H);

  const a = createFx(mapFogDispel, { x: OX, y: OY, seed: 9 });
  const b = createFx(mapFogDispel, { x: OX, y: OY, seed: 9 });
  const c = createFx(mapFogDispel, {
    x: OX,
    y: OY,
    seed: 9,
    palette: ["#041812", "#0a3828", "#126848", "#1ca06e", "#2cd494", "#66f0b8", "#b4ffe0", "#ffffff"],
  });

  const outA = stepTo(a, f1, 0.94);
  const outB = stepTo(b, f2, 0.94);
  const outC = stepTo(c, f3, 0.94);

  assert.deepEqual(Array.from(outA), Array.from(outB), "identical seeds must produce byte-identical output");
  assert.notDeepEqual(Array.from(outA), Array.from(outC), "custom palette must recolor the effect");
});
