import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, painterFor, resolveOptions } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as starlightSlime from "../src/fx/critters/starlight-slime.js";

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

test("critters/starlight-slime is registered in effects catalog with expected meta", () => {
  const fx = effects["critters/starlight-slime"];
  assert.ok(fx, "critters/starlight-slime should be registered in src/fx/index.js");
  assert.equal(fx.meta.name, "Starlight slime");
  assert.equal(fx.meta.loop, true);
  assert.equal(fx.meta.bg, "ground");
  assert.equal(fx.meta.duration, 2.4);
  assert.equal(fx.meta.fps, 30);
  assert.deepEqual(fx.meta.size, [160, 124]);
  assert.deepEqual(fx.meta.origin, [80, 98]);
});

test("critters/starlight-slime animates through idle water-drop, squash wind-up, high jump, and landing splat with stardust splash ring", () => {
  const [ox, oy] = starlightSlime.meta.origin;

  // 1. Idle water-drop body on the ground (t = 0.15s): body occupies y in [-32..0]
  const fIdle = renderAt(starlightSlime, 0.15);
  const idleBody = countRegion(fIdle, ox - 22, oy - 32, ox + 22, oy);
  assert.ok(
    idleBody.colorCount > 500 && idleBody.lightCount > 800,
    `Idle water-drop slime should have rich body & nebula pixels and glow (got color=${idleBody.colorCount}, light=${idleBody.lightCount})`
  );

  // 2. Q-elastic downward squash wind-up (t = 0.90s): body squashes lower and wider than idle
  const fSquash = renderAt(starlightSlime, 0.90);
  const squashUpper = countRegion(fSquash, ox - 20, oy - 32, ox + 20, oy - 22);
  const idleUpper = countRegion(fIdle, ox - 20, oy - 32, ox + 20, oy - 22);
  assert.ok(
    squashUpper.colorCount < idleUpper.colorCount * 0.4,
    `Squashed wind-up should lower the water-drop crown compared to idle (squash=${squashUpper.colorCount}, idle=${idleUpper.colorCount})`
  );

  // 3. High jump apex (t = 1.35s): body soars high into y in [-68..-36] above the floor
  const fApex = renderAt(starlightSlime, 1.35);
  const apexHigh = countRegion(fApex, ox - 22, oy - 70, ox + 22, oy - 36);
  const idleHigh = countRegion(fIdle, ox - 22, oy - 70, ox + 22, oy - 36);
  assert.ok(
    apexHigh.colorCount > 450 && apexHigh.colorCount > idleHigh.colorCount * 5,
    `High jump apex should lift the slime high into the air (apexHigh=${apexHigh.colorCount}, idleHigh=${idleHigh.colorCount})`
  );

  // 4. Instant landing splat & 360° colorful stardust splash ring (t = 1.73s & t = 1.90s):
  // Wide splash ring and droplets spread far to the left and right (|x| in 24..66)
  const fSplash = renderAt(starlightSlime, 1.90);
  const splashLeft = countRegion(fSplash, ox - 66, oy - 28, ox - 24, oy + 16);
  const splashRight = countRegion(fSplash, ox + 24, oy - 28, ox + 66, oy + 16);
  const idleLeft = countRegion(fIdle, ox - 66, oy - 28, ox - 24, oy + 16);
  assert.ok(
    splashLeft.colorCount + splashRight.colorCount > idleLeft.colorCount * 2 + 120,
    `Landing splat should fling a wide ring of colorful stardust splash to both sides (left=${splashLeft.colorCount}, right=${splashRight.colorCount})`
  );
});

test("critters/starlight-slime loops seamlessly and supports custom palette, nebula, and hop options", () => {
  const fStart = renderAt(starlightSlime, 0);
  const fEnd = renderAt(starlightSlime, starlightSlime.meta.duration);

  assert.deepEqual(fStart.color, fEnd.color, "Color buffer at t=0 and t=duration must match for seamless loop");
  assert.deepEqual(fStart.light, fEnd.light, "Light buffer at t=0 and t=duration must match for seamless loop");

  const fDefault = renderAt(starlightSlime, 0.4, { seed: 3 });
  const fCustom = renderAt(starlightSlime, 0.4, {
    seed: 3,
    palette: ["#041810", "#0a3424", "#126044", "#1e9668", "#34d494", "#74ffbe", "#c8ffe6", "#ffffff"],
    nebula: ["#240818", "#5c143c", "#a8286e", "#f052a8", "#ff94d0", "#fff098"],
  });

  let recolored = 0;
  for (let i = 0; i < fDefault.color.length; i++) {
    if (fDefault.color[i] !== fCustom.color[i]) recolored++;
  }
  assert.ok(recolored > 400, `Custom palette and nebula options should recolor slime pixels (recolored=${recolored})`);
});
