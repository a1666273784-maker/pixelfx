import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, painterFor, resolveOptions } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as magnetLith from "../src/fx/critters/magnet-lith.js";

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

test("critters/magnet-lith is registered in the catalog with valid metadata", () => {
  const entry = effects["critters/magnet-lith"];
  assert.ok(entry, "critters/magnet-lith should be registered");
  assert.equal(magnetLith.meta.name, "Magnet lith");
  assert.equal(magnetLith.meta.loop, true);
  assert.equal(magnetLith.meta.bg, "ground");
  assert.equal(magnetLith.meta.duration, 4.8);
  assert.equal(magnetLith.meta.fps, 30);
  assert.deepEqual(magnetLith.meta.size, [240, 124]);
  assert.deepEqual(magnetLith.meta.origin, [104, 100]);
  assert.equal(magnetLith.meta.options.palette.length, 7);
  assert.equal(magnetLith.meta.options.stone.length, 6);
  assert.equal(magnetLith.meta.options.rune.length, 5);
});

test("critters/magnet-lith renders all 4 action states: Idle core/orbit/tethers, Move thruster dash, Attack giant rock fist & ground shatter, and Collapse core shatter & free-fall rolling stones", () => {
  const [ox, oy] = magnetLith.meta.origin;

  // 1. STATE 1 — IDLE (0.00..1.05s): Levitating cyan core + 4 orbiting angular black stones + electric tether lines
  const idle0 = renderAt(magnetLith, 0.15);
  const idle1 = renderAt(magnetLith, 0.65);
  const statsIdle0 = regionStats(idle0, ox - 95, oy - 65, ox - 15, oy - 2);
  const statsIdle1 = regionStats(idle1, ox - 95, oy - 65, ox - 15, oy - 2);
  assert.ok(statsIdle0.colorCount > 450, `Expected levitating core and 4 angular stones in idle, got ${statsIdle0.colorCount}`);
  assert.ok(statsIdle0.lightCount > 800, `Expected cyan core & tether glow in idle, got ${statsIdle0.lightCount}`);
  // Verify stones orbit between t=0.15s and t=0.65s
  let idleDiffs = 0;
  for (let i = 0; i < idle0.color.length; i++) {
    if (idle0.color[i] !== idle1.color[i]) idleDiffs++;
  }
  assert.ok(idleDiffs > 180, `Expected 4 black stones to revolve around the core in idle, got ${idleDiffs} changed px`);

  // 2. STATE 2 — MOVE (1.05..2.02s): 4 black stones gather behind core spinning like a thruster & pushing core forward
  const moveStart = renderAt(magnetLith, 1.27);
  const moveDash = renderAt(magnetLith, 1.60);
  const moveEnd = renderAt(magnetLith, 1.90);
  const statsMoveStart = regionStats(moveStart, ox - 98, oy - 60, ox + 10, oy - 1);
  const statsMoveDash = regionStats(moveDash, ox - 98, oy - 60, ox + 10, oy - 1);
  const statsMoveEnd = regionStats(moveEnd, ox - 98, oy - 60, ox + 10, oy - 1);
  assert.ok(
    statsMoveDash.cx > statsMoveStart.cx + 12 && statsMoveEnd.cx > statsMoveDash.cx + 12,
    `Expected thruster dash to propel core rightward: ${statsMoveStart.cx.toFixed(1)} -> ${statsMoveDash.cx.toFixed(1)} -> ${statsMoveEnd.cx.toFixed(1)}`
  );

  // 3. STATE 3 — ATTACK & HEAVY FIST SHATTER (2.02..3.38s):
  //    t=2.23s: Giant Rock Fist assembled in front; t=2.53s: Lightning-wreathed fist smash in flight; t=2.87s: Heavy crater shatter, cracks & flying rocks
  const atkFist = renderAt(magnetLith, 2.23);
  const atkSmash = renderAt(magnetLith, 2.53);
  const atkImpact = renderAt(magnetLith, 2.87);

  // Assembled Giant Rock Fist in front of the core (ox - 5 .. ox + 35, oy - 48 .. oy - 12)
  const statsFist = regionStats(atkFist, ox - 5, oy - 48, ox + 36, oy - 12);
  assert.ok(statsFist.colorCount > 450, `Expected large assembled Obsidian Rock Fist in front of core at t=2.23s, got ${statsFist.colorCount}`);

  // Lightning-wreathed fist smashing forward toward X_HIT at t=2.53s
  const statsSmash = regionStats(atkSmash, ox + 10, oy - 42, ox + 65, oy - 2);
  assert.ok(
    statsSmash.colorCount > 480 && statsSmash.lightCount > 600,
    `Expected lightning-wreathed Giant Rock Fist smashing forward at t=2.53s, got color=${statsSmash.colorCount}, light=${statsSmash.lightCount}`
  );

  // Shattered floor crater, glowing cracks, shockwaves & flying faceted rock boulders around X_HIT (ox + 15 .. ox + 110) at t=2.87s
  const statsImpact = regionStats(atkImpact, ox + 15, oy - 50, ox + 115, oy + 16);
  assert.ok(
    statsImpact.colorCount > 750 && statsImpact.lightCount > 900,
    `Expected heavy fist shatter crater, glowing cracks, shockwaves & flying rocks at t=2.87s, got color=${statsImpact.colorCount}, light=${statsImpact.lightCount}`
  );

  // 4. STATE 4 — COLLAPSE, CORE SHATTER & FREE-FALL ROLL (3.38..4.80s):
  //    t=3.50s: Core shatters into crystal shards; t=3.80s: Stones hit floor in free-fall; t=4.13s & t=4.43s: Stones roll outward on floor, mid-air core gone!
  const koShatter = renderAt(magnetLith, 3.50);
  const koHitFloor = renderAt(magnetLith, 3.80);
  const koSettled = renderAt(magnetLith, 4.43);

  const statsShatterAir = regionStats(koShatter, ox - 55, oy - 55, ox + 20, oy - 12);
  assert.ok(statsShatterAir.colorCount > 250, `Expected shattering core shards & falling stones in mid-air at t=3.50s, got ${statsShatterAir.colorCount}`);

  // By t=4.43s, the mid-air core zone (oy - 55 .. oy - 18) is completely empty (core shattered & dissolved!)
  const statsSettledAir = regionStats(koSettled, ox - 65, oy - 55, ox + 30, oy - 18);
  assert.equal(statsSettledAir.colorCount, 0, `Expected mid-air core to be completely shattered & gone at t=4.43s, got ${statsSettledAir.colorCount}`);

  // All 4 angular black stones rest on the floor band (oy - 16 .. oy + 1) and have rolled wider apart from t=3.80s to t=4.43s!
  const statsFloorHit = regionStats(koHitFloor, ox - 85, oy - 18, ox + 45, oy + 1);
  const statsFloorSettled = regionStats(koSettled, ox - 85, oy - 18, ox + 45, oy + 1);
  assert.ok(statsFloorSettled.colorCount > 280, `Expected 4 fallen black stones resting on the floor at t=4.43s, got ${statsFloorSettled.colorCount}`);
  assert.ok(
    statsFloorSettled.spanX > statsFloorHit.spanX + 8,
    `Expected 4 black stones to roll outward across the floor from t=3.80s (span=${statsFloorHit.spanX}) to t=4.43s (span=${statsFloorSettled.spanX})`
  );
});

test("critters/magnet-lith supports custom palette, stone, rune, and seed options", () => {
  const f1 = renderAt(magnetLith, 2.53, { seed: 1 });
  const f2 = renderAt(magnetLith, 2.53, {
    palette: ["#200614", "#4c0e32", "#8e185e", "#d82894", "#ff68c4", "#ffb8e6", "#ffffff"],
    stone: ["#0e0a08", "#221812", "#3a281e", "#5c4030", "#84604a", "#b48c72"],
    rune: ["#081c14", "#144432", "#24805c", "#3cc892", "#98ffd4"],
    seed: 11,
  });
  let diffs = 0;
  for (let i = 0; i < f1.color.length; i++) {
    if (f1.color[i] !== f2.color[i] || f1.light[i] !== f2.light[i]) {
      diffs++;
    }
  }
  assert.ok(diffs > 300, `Expected custom palette/stone/rune/seed to alter >300 pixels, got ${diffs}`);
});
