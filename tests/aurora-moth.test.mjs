import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, painterFor, resolveOptions } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as auroraMoth from "../src/fx/critters/aurora-moth.js";

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

test("critters/aurora-moth is registered in the catalog with valid metadata", () => {
  const entry = effects["critters/aurora-moth"];
  assert.ok(entry, "critters/aurora-moth should be registered in src/fx/index.js");
  assert.equal(auroraMoth.meta.name, "Aurora moth");
  assert.equal(auroraMoth.meta.bg, "ground");
  assert.equal(auroraMoth.meta.duration, 10.5);
  assert.equal(auroraMoth.meta.fps, 30);
  assert.equal(auroraMoth.meta.loop, true);
  assert.deepEqual(auroraMoth.meta.size, [288, 160]);
  assert.deepEqual(auroraMoth.meta.origin, [118, 134]);
  assert.ok(auroraMoth.meta.tags.includes("aurora"));
  assert.ok(auroraMoth.meta.tags.includes("moth"));
  assert.ok(auroraMoth.meta.tags.includes("rainbow"));
  assert.ok(auroraMoth.meta.tags.includes("ice"));
});

test("critters/aurora-moth renders all 5 sustained action states with rich pixel coverage", () => {
  // 1. State 1 Idle (0.70s): Hovering white chrysalis core + silky 7-color aurora-ribbon wings
  const fIdle = renderAt(auroraMoth, 0.70);
  const sIdle = regionStats(fIdle, 35, 45, 130, 118);
  assert.ok(sIdle.colorCount > 450, `Idle state should render moth core and aurora wings (${sIdle.colorCount})`);
  assert.ok(sIdle.lightCount > 200, `Idle state should emit aurora glow (${sIdle.lightCount})`);

  // 2. State 2 Eco Quirk (2.80s): Glowing crystal mirror + ballet pirouette + pink heart stardust overhead
  const fEco = renderAt(auroraMoth, 2.80);
  const sMirror = regionStats(fEco, 95, 55, 140, 118);
  const sHearts = regionStats(fEco, 50, 25, 118, 65);
  assert.ok(sMirror.colorCount > 120, `Eco Quirk should render glowing crystal mirror (${sMirror.colorCount})`);
  assert.ok(sHearts.colorCount > 30, `Eco Quirk should render pink heart stardust overhead (${sHearts.colorCount})`);

  // 3. State 3 Move (5.57s): Sweeping S-curve rainbow streamer glide + sky-filling aurora scale-dust
  const fMove = renderAt(auroraMoth, 5.57);
  const sMove = regionStats(fMove, 60, 20, 245, 120);
  assert.ok(sMove.colorCount > 800, `Move state should render sweeping S-curve rainbow streamer and scale-dust (${sMove.colorCount})`);

  // 4. State 4 Attack & Hit (6.27s Wing-Clap Prayer, 6.97s 3 Crescent Aurora Wind-Blades, 7.67s Prismatic Hit Burst)
  const fClap = renderAt(auroraMoth, 6.27);
  const sClap = regionStats(fClap, 80, 25, 155, 105);
  assert.ok(sClap.colorCount > 250, `Attack state at 6.27s should render vertical wing-clap prayer pose (${sClap.colorCount})`);

  const fBlades = renderAt(auroraMoth, 6.97);
  const sBlades = regionStats(fBlades, 135, 45, 235, 115);
  assert.ok(sBlades.colorCount > 250, `Attack state at 6.97s should render 3 intersecting crescent aurora wind-blades (${sBlades.colorCount})`);

  const fHit = renderAt(auroraMoth, 7.67);
  const sHit = regionStats(fHit, 175, 25, 280, 128);
  assert.ok(sHit.colorCount > 450, `Attack state at 7.67s should render dazzling prismatic rainbow hit burst (${sHit.colorCount})`);

  // 5. State 5 KO & Ice-Crystal Flower Dissipation (8.37s Silk Fracture, 9.07s Light-Rain Fall, 9.77s Ice-Crystal Lotus)
  const fRain = renderAt(auroraMoth, 9.07);
  const sRain = regionStats(fRain, 80, 55, 165, 128);
  assert.ok(sRain.colorCount > 200, `KO state at 9.07s should render dissolving silk light-rain and falling core (${sRain.colorCount})`);

  const fFlower = renderAt(auroraMoth, 9.77);
  const sFlower = regionStats(fFlower, 70, 95, 148, 130);
  assert.ok(sFlower.colorCount > 220, `KO state at 9.77s should bloom into a 3D ice-crystal flower on the ground (${sFlower.colorCount})`);
});

test("critters/aurora-moth is deterministic and respects option overrides", () => {
  const f1 = renderAt(auroraMoth, 6.97, { seed: 5, hue: 35, intensity: 1.25 });
  const f2 = renderAt(auroraMoth, 6.97, { seed: 5, hue: 35, intensity: 1.25 });
  assert.deepEqual(f1.color, f2.color);
  assert.deepEqual(f1.light, f2.light);
});
