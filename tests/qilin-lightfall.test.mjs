import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, painterFor, hex } from "../src/core/index.js";
import { draw, meta } from "../src/fx/fire/qilin-lightfall.js";

const colors = new Set([
  "#2a0608", "#6e1014", "#b01c1a", "#e0481f", "#f58a24", "#ffe9a8",
  "#5c3c06", "#b8860f", "#ffd23c", "#fffbe0", "#fff1c4", "#ffffff", "#170b10",
].map((c) => hex(c) >>> 0));
function frame(t, seed = 1) {
  const f = createFrame(320, 200);
  draw(painterFor(f).place(160, 176), t, { seed });
  return f;
}

test("84 playback frames use only opaque prescribed colors, with no blank runs or ambient light", () => {
  assert.deepEqual(meta.size, [320, 200]);
  assert.deepEqual(meta.origin, [160, 176]);
  assert.equal(meta.fps * meta.duration, 84);
  let blank = 0;
  for (let i = 0; i < 84; i++) {
    const f = frame(i / 30);
    let count = 0;
    for (const c of f.color) if (c) { assert.ok(colors.has(c)); assert.equal(c >>> 24, 255); count++; }
    assert.ok(f.light.every((c) => c === 0));
    blank = count ? 0 : blank + 1;
    assert.ok(blank <= 10, `blank run at frame ${i}`);
  }
  assert.ok(frame(2.8).color.every((c) => c === 0));
});

test("pillar is connected to the floor throughout its hold; lightning stays visible", () => {
  for (let i = 6; i <= 73; i++) {
    const f = frame(i / 30);
    for (let y = 0; y <= 176; y++) assert.notEqual(f.color[y * 320 + 160], 0, `frame ${i}, row ${y}`);
    // Side arcs live beyond the pillar and are present in each frame of the hold.
    assert.ok(f.color.some((c, j) => c && (j % 320 < 90 || j % 320 > 230) && Math.floor(j / 320) < 140));
  }
  assert.ok(frame(5 / 30).color.some((c, j) => c && Math.floor(j / 320) < 100));
});

test("seeded drawing is deterministic and varies between seeds", () => {
  assert.deepEqual(frame(1.23, 7).color, frame(1.23, 7).color);
  assert.notDeepEqual(frame(1.23, 7).color, frame(1.23, 8).color);
});
