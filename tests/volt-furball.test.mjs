import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, painterFor, resolveOptions } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as voltFurball from "../src/fx/critters/volt-furball.js";

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

function regionStats(frame, x0, y0, x1, y1) {
  const { w, h, color, light } = frame;
  let colorCount = 0;
  let lightCount = 0;
  let sumX = 0;
  let sumY = 0;
  let minX = w;
  let maxX = 0;
  const cx0 = Math.max(0, Math.floor(x0));
  const cy0 = Math.max(0, Math.floor(y0));
  const cx1 = Math.min(w - 1, Math.floor(x1));
  const cy1 = Math.min(h - 1, Math.floor(y1));
  for (let y = cy0; y <= cy1; y++) {
    for (let x = cx0; x <= cx1; x++) {
      const idx = y * w + x;
      const c = color[idx];
      const l = light[idx];
      if (l !== 0) lightCount++;
      if (c !== 0) {
        const a = (c >>> 24) & 0xff;
        if (a > 24) {
          colorCount++;
          sumX += x;
          sumY += y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
  }
  return {
    colorCount,
    lightCount,
    cx: colorCount ? sumX / colorCount : 0,
    cy: colorCount ? sumY / colorCount : 0,
    minX: colorCount ? minX : 0,
    maxX: colorCount ? maxX : 0,
    spanX: colorCount ? maxX - minX : 0,
  };
}

test("critters/volt-furball is registered in the catalog with valid metadata", () => {
  const entry = effects["critters/volt-furball"];
  assert.ok(entry, "critters/volt-furball should be registered");
  assert.equal(voltFurball.meta.name, "Volt furball");
  assert.equal(voltFurball.meta.loop, true);
  assert.equal(voltFurball.meta.bg, "ground");
  assert.equal(voltFurball.meta.duration, 7.5);
  assert.equal(voltFurball.meta.fps, 30);
  assert.deepEqual(voltFurball.meta.size, [248, 136]);
  assert.deepEqual(voltFurball.meta.origin, [118, 108]);
  assert.equal(voltFurball.meta.options.palette.length, 7);
  assert.equal(voltFurball.meta.options.plasma.length, 6);
  assert.equal(voltFurball.meta.options.storm.length, 6);
});

test("critters/volt-furball renders all 5 sustained action states: Idle hops, Eco Quirk 3x sea-urchin & shake, Z-Move afterimage, Thunderstorm Attack & Scorched Grid, and KO Charred Smoke", () => {
  const [ox, oy] = voltFurball.meta.origin;

  // 1. STATE 1 — IDLE (0.00..1.40s): Fluffy golden furball + twin lightning ahoge tufts hopping left & right
  const idle0 = renderAt(voltFurball, 0.10);
  const idle1 = renderAt(voltFurball, 0.50);
  const statsIdle0 = regionStats(idle0, ox - 85, oy - 50, ox - 20, oy + 4);
  const statsIdle1 = regionStats(idle1, ox - 85, oy - 50, ox - 20, oy + 4);
  assert.ok(statsIdle0.colorCount > 450, `Expected golden static furball in idle, got ${statsIdle0.colorCount}`);
  assert.ok(statsIdle0.lightCount > 700, `Expected static glow in idle, got ${statsIdle0.lightCount}`);
  let idleDiffs = 0;
  for (let i = 0; i < idle0.color.length; i++) {
    if (idle0.color[i] !== idle1.color[i]) idleDiffs++;
  }
  assert.ok(idleDiffs > 180, `Expected restless high-frequency hops in idle, got ${idleDiffs} changed px`);

  // 2. STATE 2 — ECO QUIRK (1.40..2.95s): Self-zap puffs into 3x spiky sea-urchin ball + mosquito-coil eyes, then shakes off sparks
  const quirkPuff = renderAt(voltFurball, 1.95);
  const statsQuirkPuff = regionStats(quirkPuff, ox - 105, oy - 75, ox - 5, oy + 4);
  assert.ok(
    statsQuirkPuff.colorCount > statsIdle0.colorCount * 2.2,
    `Expected ~3x puffed sea-urchin area (${statsQuirkPuff.colorCount}) vs normal idle (${statsIdle0.colorCount})`
  );

  const quirkShake = renderAt(voltFurball, 2.50);
  const statsQuirkShake = regionStats(quirkShake, ox - 105, oy - 75, ox + 10, oy + 4);
  assert.ok(
    statsQuirkShake.colorCount > 800,
    `Expected shaking furball flinging static sparks at t=2.50s, got ${statsQuirkShake.colorCount}`
  );

  // 3. STATE 3 — MOVE (2.95..4.35s): Rubber-ball squash & Z-shaped zigzag ricochet with blue-white lightning polyline afterimage
  const moveSquash = renderAt(voltFurball, 3.00);
  const statsSquash = regionStats(moveSquash, ox - 85, oy - 35, ox - 25, oy + 4);
  assert.ok(statsSquash.colorCount > 350, `Expected squashed furball at t=3.00s, got ${statsSquash.colorCount}`);

  const moveZ = renderAt(voltFurball, 3.97);
  const statsZ = regionStats(moveZ, ox - 70, oy - 68, ox + 25, oy + 2);
  assert.ok(
    statsZ.colorCount > 900 && statsZ.spanX > 60,
    `Expected wide Z-shaped lightning polyline afterimage and airborne furball at t=3.97s, got count=${statsZ.colorCount}, spanX=${statsZ.spanX}`
  );

  // 4. STATE 4 — ATTACK & SCORCHED GRID HIT (4.35..5.85s): Mid-air thunderstorm vortex + purple-gold sawtooth bolt + scorched floor grid
  const atkVortex = renderAt(voltFurball, 4.47);
  const statsVortex = regionStats(atkVortex, ox - 35, oy - 82, ox + 35, oy - 14);
  assert.ok(
    statsVortex.colorCount > 650,
    `Expected mid-air spinning purple-gold thunderstorm vortex at t=4.47s, got ${statsVortex.colorCount}`
  );

  const atkStrike = renderAt(voltFurball, 4.97);
  const statsBolt = regionStats(atkStrike, ox - 25, oy - 80, ox + 98, oy + 14);
  const statsGrid = regionStats(atkStrike, ox + 10, oy - 8, ox + 98, oy + 15);
  assert.ok(
    statsBolt.colorCount > 1800,
    `Expected thick purple-gold sawtooth lightning bolt and air-tearing arcs at t=4.97s, got ${statsBolt.colorCount}`
  );
  assert.ok(
    statsGrid.colorCount > 550,
    `Expected scorched black electric grid on the target floor at t=4.97s, got ${statsGrid.colorCount}`
  );

  // 5. STATE 5 — KO & CHARRED SMOKE DISSIPATION (5.85..7.50s): Runaway static -> Short-circuit pop into charred black smoke & stray sparks
  const koOverload = renderAt(voltFurball, 5.97);
  const statsOverload = regionStats(koOverload, ox - 45, oy - 65, ox + 25, oy + 4);
  assert.ok(
    statsOverload.colorCount > 600,
    `Expected runaway static overload arcs across body at t=5.97s, got ${statsOverload.colorCount}`
  );

  const koSmoke1 = renderAt(voltFurball, 6.47);
  const koSmoke2 = renderAt(voltFurball, 6.97);
  const statsSmoke1 = regionStats(koSmoke1, ox - 60, oy - 65, ox + 25, oy + 4);
  const statsSmoke2 = regionStats(koSmoke2, ox - 60, oy - 75, ox + 25, oy + 4);
  assert.ok(
    statsSmoke1.colorCount > 500,
    `Expected billowing charred black smoke cloud and short-circuit sparks at t=6.47s, got ${statsSmoke1.colorCount}`
  );
  assert.ok(
    statsSmoke2.colorCount > 250 && statsSmoke2.cy < statsSmoke1.cy,
    `Expected rising and dissipating charred smoke puffs and stray sparks at t=6.97s, got count=${statsSmoke2.colorCount}, cy=${statsSmoke2.cy} vs ${statsSmoke1.cy}`
  );
});

test("critters/volt-furball is deterministic and supports custom palette, plasma, and storm options", () => {
  const a = renderAt(voltFurball, 4.97, { seed: 7 });
  const b = renderAt(voltFurball, 4.97, { seed: 7 });
  assert.deepEqual(a.color, b.color);
  assert.deepEqual(a.light, b.light);

  const custom = renderAt(voltFurball, 4.97, {
    seed: 7,
    palette: ["#102404", "#245208", "#429610", "#68dc1c", "#9eff38", "#d4ff88", "#ffffff"],
    plasma: ["#280818", "#581236", "#a42068", "#e852a4", "#ffb8dc", "#ffffff"],
    storm: ["#041828", "#0a3458", "#1664a4", "#2ca4f0", "#78d4ff", "#d4f2ff"],
  });
  let diffs = 0;
  for (let i = 0; i < a.color.length; i++) {
    if (a.color[i] !== custom.color[i]) diffs++;
  }
  assert.ok(diffs > 600, `Expected custom palettes to change rendered colors, got ${diffs} diffs`);
});
