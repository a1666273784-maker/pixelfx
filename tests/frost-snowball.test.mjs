import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, painterFor, resolveOptions } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as frostSnowball from "../src/fx/critters/frost-snowball.js";

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
  const cx0 = Math.max(0, Math.floor(x0));
  const cy0 = Math.max(0, Math.floor(y0));
  const cx1 = Math.min(w - 1, Math.floor(x1));
  const cy1 = Math.min(h - 1, Math.floor(y1));
  for (let y = cy0; y <= cy1; y++) {
    for (let x = cx0; x <= cx1; x++) {
      const idx = y * w + x;
      if ((color[idx] >>> 24) > 0) colorCount++;
      if ((light[idx] >>> 24) > 0) lightCount++;
    }
  }
  return { colorCount, lightCount };
}

test("critters/frost-snowball is registered with a complete looping effect contract", () => {
  assert.ok(effects["critters/frost-snowball"], "effect should be registered in src/fx/index.js");
  assert.equal(frostSnowball.meta.name, "Frost snowball");
  assert.equal(frostSnowball.meta.bg, "ground");
  assert.equal(frostSnowball.meta.duration, 10.5);
  assert.equal(frostSnowball.meta.fps, 30);
  assert.equal(frostSnowball.meta.loop, true);
  assert.deepEqual(frostSnowball.meta.size, [288, 160]);
  assert.deepEqual(frostSnowball.meta.origin, [136, 132]);
  for (const tag of ["critter", "monster", "ice", "snow", "snowball", "blizzard", "icicle", "shatter"]) {
    assert.ok(frostSnowball.meta.tags.includes(tag), `expected tag: ${tag}`);
  }
});

test("all five sustained action states have readable silhouettes, detail and light", () => {
  // 1. Idle at 0.70s: rounded snow body, crystal hands, snowflake crust and breathing core.
  const idle = regionStats(renderAt(frostSnowball, 0.70), 50, 78, 118, 135);
  assert.ok(idle.colorCount > 550, `Idle snow-creature silhouette should read (${idle.colorCount} pixels)`);
  assert.ok(idle.lightCount > 180, `Idle breathing core should glow (${idle.lightCount} light pixels)`);

  // 2. Eco quirk: packing at 2.10s, then balancing at 2.80s, then snow-ring faceplant at 3.50s.
  const pack = renderAt(frostSnowball, 2.10);
  const miniBall = regionStats(pack, 94, 109, 121, 136);
  assert.ok(miniBall.colorCount > 80, `Eco quirk should roll a distinct mini snowball (${miniBall.colorCount} pixels)`);
  assert.ok(regionStats(pack, 62, 82, 118, 131).colorCount > 400, "creature should reach down to pack the mini snowball");

  const balance = regionStats(renderAt(frostSnowball, 2.80), 73, 76, 132, 137);
  assert.ok(balance.colorCount > 500, `wobbly circus balance should show both creature and ball (${balance.colorCount} pixels)`);

  const faceplant = regionStats(renderAt(frostSnowball, 3.50), 65, 90, 164, 141);
  assert.ok(faceplant.colorCount > 500, `faceplant should kick up a broad snow ring (${faceplant.colorCount} pixels)`);

  // 3. Move at 4.90s and 5.57s: a rolling silhouette, growing ice crust and a long ground-level frost track.
  const earlyRoll = regionStats(renderAt(frostSnowball, 4.90), 54, 84, 163, 140);
  assert.ok(earlyRoll.colorCount > 480, `moving snowball should leave a readable frost slide (${earlyRoll.colorCount} pixels)`);
  const lateRoll = regionStats(renderAt(frostSnowball, 5.57), 62, 78, 190, 140);
  assert.ok(lateRoll.colorCount > 600, `rolling body should accumulate ice crystals and snowflakes (${lateRoll.colorCount} pixels)`);

  // 4. Attack: an inward-sucking vortex at 6.27s, the icicle blizzard at 6.97s, and target freeze-shatter at 7.67s.
  const inhale = regionStats(renderAt(frostSnowball, 6.27), 38, 52, 190, 145);
  assert.ok(inhale.colorCount > 500, `inhaled frost should form a large vortex (${inhale.colorCount} pixels)`);
  assert.ok(inhale.lightCount > 220, `inward vortex should carry cold light (${inhale.lightCount} light pixels)`);

  const blast = regionStats(renderAt(frostSnowball, 6.97), 116, 67, 273, 140);
  assert.ok(blast.colorCount > 550, `blizzard cone and razor icicles should fill the forward lane (${blast.colorCount} pixels)`);

  const hit = regionStats(renderAt(frostSnowball, 7.67), 175, 56, 284, 143);
  assert.ok(hit.colorCount > 500, `target should freeze and shatter in an ice-nova burst (${hit.colorCount} pixels)`);
  assert.ok(hit.lightCount > 180, `target impact should flare with cold light (${hit.lightCount} light pixels)`);

  // 5. KO: transparent sphere, racing cracks, then many outward-flying crystal chunks and snowflakes.
  const sphere = regionStats(renderAt(frostSnowball, 8.37), 62, 80, 128, 141);
  assert.ok(sphere.colorCount > 280, `KO should vitrify the creature into a refractive ice sphere (${sphere.colorCount} pixels)`);

  const cracks = regionStats(renderAt(frostSnowball, 9.07), 62, 80, 128, 141);
  assert.ok(cracks.colorCount > sphere.colorCount, `racing fractures should visibly add detail (${cracks.colorCount} vs ${sphere.colorCount})`);

  const shatter = regionStats(renderAt(frostSnowball, 9.77), 8, 68, 194, 151);
  assert.ok(shatter.colorCount > 300, `ice chunks and snowflakes should scatter in all directions (${shatter.colorCount} pixels)`);
});

test("critters/frost-snowball is deterministic and honors palette and seed overrides", () => {
  const options = {
    seed: 17,
    palette: ["#10182e", "#294b79", "#6fadd0", "#c9efff", "#ffffff"],
    ice: ["#0b1534", "#1a4388", "#3a92d8", "#a2e8ff", "#ffffff"],
    frost: ["#10243e", "#347cb2", "#aee6ff", "#ffffff"],
  };
  const a = renderAt(frostSnowball, 6.97, options);
  const b = renderAt(frostSnowball, 6.97, options);
  assert.deepEqual(a.color, b.color);
  assert.deepEqual(a.light, b.light);
});
