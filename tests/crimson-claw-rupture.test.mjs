import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, createAct, composite } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as crimsonClaw from "../src/fx/moves/crimson-claw-rupture.js";

function countLit(buf) {
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] >>> 24) n++;
  return n;
}

function stepTo(fx, frame, t, fps = 30) {
  const steps = Math.round(t * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  fx.draw(frame);
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

function crimsonBladeRunsAtRow(frame, sy) {
  if (sy < 0 || sy >= frame.h) return 0;
  let runs = 0, inRun = false;
  for (let x = 0; x < frame.w; x++) {
    const c = frame.color[sy * frame.w + x];
    const r = c & 255;
    const lit = (c >>> 24) !== 0 && r >= 120;
    if (lit && !inRun) {
      runs++;
      inRun = true;
    } else if (!lit) {
      inRun = false;
    }
  }
  return runs;
}

test("moves/crimson-claw-rupture is registered with two-actor ground ambush & oppressive hit act", () => {
  assert.equal(effects["moves/crimson-claw-rupture"], crimsonClaw);
  assert.equal(crimsonClaw.meta.loop, false);
  assert.equal(crimsonClaw.meta.bg, "ground");
  assert.equal(crimsonClaw.meta.actor, 2);
  assert.ok(crimsonClaw.act && crimsonClaw.act.target && crimsonClaw.act.hits?.length >= 4);
  assert.equal(crimsonClaw.act.target.x, 124);
  assert.ok(crimsonClaw.act.poses[0][0] < 0, "act should include pre-release wind-up before t = 0");
});

test("moves/crimson-claw-rupture progresses from cold black-purple mist & soil churn to 3 upward crimson claw blades, cross scar, shadow smoke & red light, and empty end", () => {
  const { meta, act } = crimsonClaw;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const TX = act.target.x;
  const frame = createFrame(W, H);

  // 1. Pre-eruption omen (t = 0.34s < 0.46s): cold black-purple mist + churning soil under target feet, nothing high in sky yet
  {
    const fx = createFx(crimsonClaw, { x: OX, y: OY, seed: 1 });
    for (let i = 0; i < Math.round(0.34 * 30); i++) fx.update(1 / 30);
    clearFrame(frame);
    fx.draw(frame, "back");
    const backMistPx = countLit(frame.color);
    fx.draw(frame, "front");

    let footWarningPx = 0, highSkyPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + TX - 38; x <= OX + TX + 38; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (y >= OY - 46 && y <= OY + 4) footWarningPx++;
        if (y < OY - 75) highSkyPx++;
      }
    }
    assert.ok(backMistPx > 80, `expected black-purple cold mist behind target during omen, got ${backMistPx}`);
    assert.ok(footWarningPx > 220, `expected rich cold mist & churning soil under target feet, got ${footWarningPx}`);
    assert.equal(highSkyPx, 0, "claw blades must not tear into upper sky before T_ERUPT (0.46s)");
  }

  // 2. Upward triple dark-crimson claw eruption (t = 0.54s): 3 distinct rising claw blades tearing bottom-to-top
  {
    const fx = createFx(crimsonClaw, { x: OX, y: OY, seed: 1 });
    stepTo(fx, frame, 0.54);

    let upperTearPx = 0;
    for (let y = 0; y < OY - 105; y++) {
      for (let x = 0; x < W; x++) {
        if (frame.color[y * W + x] >>> 24) upperTearPx++;
      }
    }
    assert.ok(upperTearPx > 120, `expected upward claw blades to tear high into the air above y = -105, got ${upperTearPx}`);
    const midRuns = crimsonBladeRunsAtRow(frame, OY - 84);
    assert.ok(midRuns >= 3, `expected at least 3 distinct rising claw blade lanes at y = -84, got ${midRuns}`);
  }

  // 3. Hit-result phase (t = 0.73s): dark-crimson cross claw-scar on knocked-back enemy + black-purple shadow smoke + red light
  {
    const fx = createFx(crimsonClaw, { x: OX, y: OY, seed: 1 });
    stepTo(fx, frame, 0.73);

    const hitCenterX = OX + 150;
    const hitCenterY = OY - 28;
    let crossHorizontalPx = 0, crossVerticalPx = 0, smokeAndMotePx = 0, lightSum = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const lv = frame.light[idx];
        lightSum += (lv & 255) + ((lv >>> 8) & 255) + ((lv >>> 16) & 255);
        if (!(frame.color[idx] >>> 24)) continue;
        if (Math.abs(y - hitCenterY) <= 8 && Math.abs(x - hitCenterX) >= 12 && Math.abs(x - hitCenterX) <= 38) {
          crossHorizontalPx++;
        }
        if (Math.abs(x - hitCenterX) <= 8 && Math.abs(y - hitCenterY) >= 12 && Math.abs(y - hitCenterY) <= 35) {
          crossVerticalPx++;
        }
        if (Math.hypot(x - hitCenterX, y - hitCenterY) <= 56) {
          smokeAndMotePx++;
        }
      }
    }
    assert.ok(crossHorizontalPx > 40, `expected horizontal cross-scar arms on enemy torso, got ${crossHorizontalPx}`);
    assert.ok(crossVerticalPx > 35, `expected vertical cross-scar arms on enemy torso, got ${crossVerticalPx}`);
    assert.ok(smokeAndMotePx > 900, `expected dense shadow smoke & red-light particles around struck target, got ${smokeAndMotePx}`);
    assert.ok(lightSum > 40000, `expected strong red-light glow buffer on hit result, got ${lightSum}`);
  }

  // 4. Clean one-shot fadeout at t = meta.duration
  {
    const fx = createFx(crimsonClaw, { x: OX, y: OY, seed: 1 });
    stepTo(fx, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end empty at t = duration");
    assert.ok(frame.light.every((v) => v === 0), "light buffer must be empty at t = duration");
  }
});

test("moves/crimson-claw-rupture act delivers oppressive hit-stop, heavy shake, knockback slide, red/shadow skins, and clean reset", () => {
  const [W, H] = crimsonClaw.meta.size;
  const [OX, OY] = crimsonClaw.meta.origin;
  const inst = createAct(crimsonClaw, { x: OX, y: OY, seed: 1 });
  const frame = createFrame(W, H);

  let sawOmenShiver = false;
  let sawFreeze = false;
  let sawRedSkin = false;
  let sawShadowSkin = false;
  let maxShake = 0;
  let maxSlide = 0;

  for (let i = 0; i < 320 && !inst.done(); i++) {
    inst.update(1 / 30);
    const tgt = inst.targets[0];
    if (tgt && i < 24 && tgt.shiver > 0.05) sawOmenShiver = true;
    if (inst.frozen) sawFreeze = true;
    if (tgt?.skin === "red") sawRedSkin = true;
    if (tgt?.skin === "shadow") sawShadowSkin = true;
    maxShake = Math.max(maxShake, Math.hypot(inst.shake[0], inst.shake[1]));
    if (tgt) maxSlide = Math.max(maxSlide, tgt.dx);
    if (i % 5 === 0) inst.draw(clearFrame(frame));
  }

  assert.ok(sawOmenShiver, "enemy should tremble during cold black-purple mist omen");
  assert.ok(sawFreeze, "enemy strike should trigger oppressive hit-stop freeze");
  assert.ok(sawRedSkin, "enemy should flash red skin on initial triple-claw rend");
  assert.ok(sawShadowSkin, "enemy should shift to cursed shadow skin on cross-scar detonation");
  assert.ok(maxShake > 2.5, `expected heavy oppressive screen shake, got ${maxShake}`);
  assert.ok(maxSlide >= 22, `expected strong knockback slide, got ${maxSlide}`);
  assert.ok(inst.done(), "act must finish cleanly");
  assert.equal(inst.targets[0]?.skin, null, "target skin must reset cleanly to null by recovery");
});

test("moves/crimson-claw-rupture is deterministic per seed and recolors cleanly with custom 4-step palettes", () => {
  const [W, H] = crimsonClaw.meta.size;
  const [OX, OY] = crimsonClaw.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H), f3 = createFrame(W, H), f4 = createFrame(W, H);

  const a = createFx(crimsonClaw, { x: OX, y: OY, seed: 11 });
  const b = createFx(crimsonClaw, { x: OX, y: OY, seed: 11 });
  const c = createFx(crimsonClaw, { x: OX, y: OY, seed: 29 });
  const d = createFx(crimsonClaw, {
    x: OX,
    y: OY,
    seed: 11,
    palette: ["#050814", "#122c5c", "#2a6bd4", "#a8dcff"],
    shadow: ["#04080a", "#102830", "#24646c", "#98f0f4"],
    soil: ["#0c0c10", "#282834", "#58586c", "#b8b8cc"],
  });

  const outA = stepTo(a, f1, 0.68);
  const outB = stepTo(b, f2, 0.68);
  const outC = stepTo(c, f3, 0.68);
  const outD = stepTo(d, f4, 0.68);

  assert.ok(countLit(f1.color) > 600);
  assert.deepEqual(Array.from(outA), Array.from(outB), "identical seeds must produce bit-identical frames");
  assert.notDeepEqual(Array.from(outA), Array.from(outC), "different seeds must vary particle & smoke layout");
  assert.notDeepEqual(Array.from(outA), Array.from(outD), "custom 4-step ramps must recolor the move");
});
