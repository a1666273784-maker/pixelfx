import { test } from "node:test";
import assert from "node:assert/strict";
import { composite, createFrame, createFx, hex } from "../src/core/index.js";
import * as lightfall from "../src/fx/fire/qilin-lightfall.js";

const [W, H] = lightfall.meta.size;
const [OX, OY] = lightfall.meta.origin;

function frameAt(t, options = {}) {
  const frame = createFrame(W, H);
  const fx = createFx(lightfall, { x: OX, y: OY, ...options });
  fx.update(t);
  fx.draw(frame);
  return frame;
}

const colorAt = (f, x, y) => f.color[y * W + x];
const hasColor = (f, x, y) => (colorAt(f, x, y) >>> 24) !== 0;
const different = (a, b) => a.some((value, i) => value !== b[i]);

function bottomColorY(frame) {
  for (let y = H - 1; y >= 0; y--) {
    for (let x = 0; x < W; x++) if (hasColor(frame, x, y)) return y;
  }
  return -1;
}

test("metadata and four independent default ramps match the brief", () => {
  assert.deepEqual(lightfall.meta.size, [320, 200]);
  assert.deepEqual(lightfall.meta.origin, [160, 176]);
  assert.equal(lightfall.meta.duration, 2.8);
  assert.equal(lightfall.meta.actor, 2);
  assert.deepEqual(lightfall.meta.options.crimson, ["#2a0608", "#6e1014", "#b01c1a", "#e0481f", "#f58a24", "#ffe9a8"]);
  assert.deepEqual(lightfall.meta.options.gold, ["#5c3c06", "#b8860f", "#ffd23c", "#fffbe0"]);
  assert.deepEqual(lightfall.meta.options.core, ["#fff1c4", "#ffffff"]);
  assert.deepEqual(lightfall.meta.options.edge, ["#170b10"]);
});

test("the shaft falls, persists through the hold, pulses, and then lifts upward", () => {
  const falling = [0.1, 0.133, 0.167, 0.2].map(t => bottomColorY(frameAt(t)));
  assert.ok(falling.every((y, i) => i === 0 || y > falling[i - 1]), `falling front: ${falling}`);
  assert.ok(falling.at(-1) >= OY - 3, `the pillar didn't reach the floor: ${falling}`);

  const widths = [];
  for (const t of [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.9, 2.2, 2.4]) {
    const frame = frameAt(t);
    for (const y of [16, 64, 112, 160, 175]) {
      assert.ok([OX - 1, OX, OX + 1].some(x => hasColor(frame, x, y)), `shaft missing at t=${t}, y=${y}`);
    }
    // The solid elevated shaft and bolts stay in the central +/- 50 px lane.
    for (let x = 0; x < W; x++) {
      if (Math.abs(x - OX) > 50) assert.ok(!hasColor(frame, x, 80), `paint outside the lane at t=${t}, x=${x}`);
    }
    if (t <= 1.6) widths.push(Array.from({ length: 61 }, (_, i) => hasColor(frame, OX - 30 + i, 80) ? 1 : 0).reduce((a, b) => a + b, 0));
  }
  assert.ok(Math.max(...widths) - Math.min(...widths) >= 7, `the shaft does not breathe: ${widths}`);

  const bottomOfThread = t => {
    const f = frameAt(t);
    for (let y = 130; y >= 0; y--) if (hasColor(f, OX, y)) return y;
    return -1;
  };
  const ends = [2.48, 2.56, 2.64].map(bottomOfThread);
  assert.ok(ends[0] > ends[1] && ends[1] > ends[2] && ends[2] >= 0, `thread did not lift: ${ends}`);
});

test("ring fades before the shaft; both buffers end completely empty", () => {
  assert.ok(hasColor(frameAt(1.3), OX, OY + 6), "the thin ground ring should linger");
  assert.ok(!hasColor(frameAt(2.2), OX, OY + 6), "the ring should fade before the shaft");
  const brightestGold = hex(lightfall.meta.options.gold.at(-1)) & 0xffffff;
  for (const t of [2.45, 2.55, 2.65, 2.7]) {
    assert.ok(frameAt(t).color.some(c => (c & 0xffffff) === brightestGold), `the last line and embers should stay bright at t=${t}`);
  }
  for (const t of [2.8, 2.9]) {
    const frame = frameAt(t);
    assert.ok(frame.color.every(c => c === 0), `color remains at t=${t}`);
    assert.ok(frame.light.every(c => c === 0), `light remains at t=${t}`);
  }
});

test("the effect layer is transparent around its shapes and default pixels stay warm", () => {
  for (const t of [0, 0.1, 0.23, 0.37, 0.7, 1.1, 1.6, 2.0, 2.35, 2.55, 2.8]) {
    const frame = frameAt(t);
    const rgba = composite(frame, new Uint8ClampedArray(W * H * 4), null);
    for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1], [20, 90], [W - 21, 90]]) {
      assert.equal(rgba[(y * W + x) * 4 + 3], 0, `background painted at t=${t}, (${x},${y})`);
    }
    for (const buf of [frame.color, frame.light]) {
      for (const c of buf) {
        if (!(c & 0xffffff)) continue;
        const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
        assert.ok(r >= g && r >= b, `cool-hued pixel at t=${t}: ${r},${g},${b}`);
      }
    }
    if (t >= 0.23 && t <= 2.0) assert.ok(frame.color.some(c => (c & 0xffffff) === 0xffffff), `no white-hot step at t=${t}`);
  }
});

test("seeds repeat and all ramps, including the standard palette alias, can be recolored", () => {
  const a = frameAt(0.85, { seed: 41 });
  const same = frameAt(0.85, { seed: 41 });
  const other = frameAt(0.85, { seed: 42 });
  assert.deepEqual(a.color, same.color);
  assert.deepEqual(a.light, same.light);
  assert.ok(different(a.color, other.color), "different seeds must change the lightning and sparks");

  const base = frameAt(0.65).color;
  const overrides = [
    { crimson: ["#170100", "#ff3322"] },
    { gold: ["#220800", "#ff8800"] },
    { core: ["#ffaa33"] },
    { edge: ["#070100"] },
    { palette: ["#170100", "#ff3322"] },
  ];
  for (const options of overrides) assert.ok(different(base, frameAt(0.65, options).color), `override had no effect: ${Object.keys(options)}`);
});
