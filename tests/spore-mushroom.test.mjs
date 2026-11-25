import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, painterFor, resolveOptions } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as sporeMushroom from "../src/fx/critters/spore-mushroom.js";

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
  let minY = h;
  let maxY = 0;
  let satSum = 0;
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
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          const r = c & 0xff;
          const g = (c >>> 8) & 0xff;
          const b = (c >>> 16) & 0xff;
          satSum += Math.max(r, g, b) - Math.min(r, g, b);
        }
      }
    }
  }
  return {
    colorCount,
    lightCount,
    cx: colorCount ? sumX / colorCount : 0,
    cy: colorCount ? sumY / colorCount : 0,
    minY: colorCount ? minY : 0,
    maxY: colorCount ? maxY : 0,
    avgSat: colorCount ? satSum / colorCount : 0,
  };
}

test("critters/spore-mushroom is registered in the catalog with valid metadata", () => {
  const entry = effects["critters/spore-mushroom"];
  assert.ok(entry, "critters/spore-mushroom should be registered");
  assert.equal(sporeMushroom.meta.name, "Spore mushroom");
  assert.equal(sporeMushroom.meta.loop, true);
  assert.equal(sporeMushroom.meta.bg, "ground");
  assert.equal(sporeMushroom.meta.duration, 4.8);
  assert.equal(sporeMushroom.meta.fps, 30);
  assert.deepEqual(sporeMushroom.meta.size, [236, 136]);
  assert.deepEqual(sporeMushroom.meta.origin, [100, 110]);
  assert.equal(sporeMushroom.meta.options.palette.length, 7);
  assert.equal(sporeMushroom.meta.options.spots.length, 6);
  assert.equal(sporeMushroom.meta.options.stem.length, 6);
});

test("critters/spore-mushroom renders all 4 action states: Idle sway/glow, Move squash/hop/dust, Attack inhale/spray/miasma, and Collapse grey-white wither", () => {
  const [ox, oy] = sporeMushroom.meta.origin;

  // 1. STATE 1 — IDLE (0.00..1.05s): Sways left and right while breathing with bioluminescent cyan spots
  const idleRight = renderAt(sporeMushroom, 0.13);
  const idleLeft = renderAt(sporeMushroom, 0.39);
  const statsIdleR = regionStats(idleRight, ox - 95, oy - 55, ox - 20, oy - 2);
  const statsIdleL = regionStats(idleLeft, ox - 95, oy - 55, ox - 20, oy - 2);
  assert.ok(statsIdleR.colorCount > 450, `Expected plump mushroom in idle at t=0.13s, got ${statsIdleR.colorCount}`);
  assert.ok(statsIdleR.lightCount > 800, `Expected bioluminescent cap spot glow in idle, got ${statsIdleR.lightCount}`);
  assert.ok(
    statsIdleR.cx > statsIdleL.cx + 2.0,
    `Expected idle mushroom to sway right at t=0.13s (${statsIdleR.cx.toFixed(1)}) vs left at t=0.39s (${statsIdleL.cx.toFixed(1)})`
  );

  // 2. STATE 2 — MOVE (1.05..2.28s): Extreme downward stem compression wind-up (t=1.27s), airborne Q-elastic hop (t=1.60s), and landing dust (t=1.90s)
  const moveSquash = renderAt(sporeMushroom, 1.27);
  const moveApex = renderAt(sporeMushroom, 1.60);
  const moveLandDust = renderAt(sporeMushroom, 1.90);

  const statsSquash = regionStats(moveSquash, ox - 95, oy - 65, ox - 20, oy - 2);
  const statsApex = regionStats(moveApex, ox - 85, oy - 75, ox - 5, oy - 2);
  const statsLand = regionStats(moveLandDust, ox - 75, oy - 60, ox + 5, oy - 2);

  // Compressed wind-up sits much lower (larger cy) than airborne hop apex
  assert.ok(
    statsApex.cy < statsSquash.cy - 18,
    `Expected Hop 1 apex at t=1.60s to leap high above squashed pose (${statsApex.cy.toFixed(1)} vs ${statsSquash.cy.toFixed(1)})`
  );
  // Check landing dust puffs kicked up to the left and right of the foot at X_MID (ox - 34)
  const dustLeft = regionStats(moveLandDust, ox - 64, oy - 12, ox - 46, oy);
  const dustRight = regionStats(moveLandDust, ox - 22, oy - 12, ox - 4, oy);
  assert.ok(
    dustLeft.colorCount + dustRight.colorCount > 25,
    `Expected landing dust puffs around foot at t=1.90s, got ${dustLeft.colorCount + dustRight.colorCount}`
  );
  assert.ok(
    statsLand.cx > statsIdleR.cx + 15,
    `Expected mushroom to hop rightward from idle (${statsIdleR.cx.toFixed(1)}) to mid-hop (${statsLand.cx.toFixed(1)})`
  );

  // 3. STATE 3 — ATTACK & HIT TOXIC MIASMA (2.28..3.58s):
  //    t=2.53s: Rears backward inhaling & inflating; t=2.87s: Pitches forward spraying spore smoke & orbs; t=3.17s: Expanding hit toxic miasma cloud
  const atkInhale = renderAt(sporeMushroom, 2.53);
  const atkSpray = renderAt(sporeMushroom, 2.87);
  const atkMiasma = renderAt(sporeMushroom, 3.17);

  const statsInhaleBody = regionStats(atkInhale, ox - 55, oy - 65, ox + 15, oy - 2);
  const statsSprayBody = regionStats(atkSpray, ox - 45, oy - 65, ox + 20, oy - 2);
  assert.ok(
    statsSprayBody.cx > statsInhaleBody.cx + 5,
    `Expected mushroom to pitch forward from reared-back inhale (${statsInhaleBody.cx.toFixed(1)}) to forward spray (${statsSprayBody.cx.toFixed(1)})`
  );

  // Spore smoke jet & orbs in the corridor between the gills and the target (ox + 10 .. ox + 80)
  const statsSporeJet = regionStats(atkSpray, ox + 10, oy - 45, ox + 80, oy + 2);
  assert.ok(
    statsSporeJet.colorCount > 180 && statsSporeJet.lightCount > 300,
    `Expected dense purple spore smoke & glowing orbs spraying from under the gills at t=2.87s, got color=${statsSporeJet.colorCount}, light=${statsSporeJet.lightCount}`
  );

  // Expanding toxic miasma cloud at X_TARGET (ox + 25 .. ox + 118) at t=3.17s
  const statsToxicCloud = regionStats(atkMiasma, ox + 25, oy - 45, ox + 118, oy + 4);
  assert.ok(
    statsToxicCloud.colorCount > 600 && statsToxicCloud.lightCount > 800,
    `Expected large expanding hit toxic miasma cloud at t=3.17s, got color=${statsToxicCloud.colorCount}, light=${statsToxicCloud.lightCount}`
  );

  // 4. STATE 4 — COLLAPSE & WITHER (3.58..4.80s):
  //    Topples sideways onto the ground and shrivels into a desaturated grey-white state (t=4.18s)
  const withered = renderAt(sporeMushroom, 4.18);
  const statsWither = regionStats(withered, ox - 55, oy - 45, ox + 10, oy - 2);
  assert.ok(statsWither.colorCount > 300, `Expected fallen mushroom silhouette at t=4.18s, got ${statsWither.colorCount}`);
  assert.ok(
    statsWither.avgSat < statsIdleR.avgSat * 0.35,
    `Expected withered grey-white mushroom at t=4.18s to have much lower color saturation (${statsWither.avgSat.toFixed(1)}) than living purple/cyan idle (${statsIdleR.avgSat.toFixed(1)})`
  );
});

test("critters/spore-mushroom supports custom palette, spots, stem, and seed options", () => {
  const f1 = renderAt(sporeMushroom, 2.87, { seed: 1 });
  const f2 = renderAt(sporeMushroom, 2.87, {
    palette: ["#061810", "#0e3422", "#185c3c", "#28925e", "#44cc88", "#88f4b8", "#dcffec"],
    spots: ["#240818", "#541238", "#982068", "#e848a8", "#ff9cd8", "#ffffff"],
    stem: ["#1c1814", "#443a30", "#7c6c5a", "#b8a690", "#e8dcc8", "#fff8ee"],
    seed: 9,
  });
  let diffs = 0;
  for (let i = 0; i < f1.color.length; i++) {
    if (f1.color[i] !== f2.color[i] || f1.light[i] !== f2.light[i]) {
      diffs++;
    }
  }
  assert.ok(diffs > 250, `Expected custom palette/spots/stem/seed to alter >250 pixels, got ${diffs}`);
});
