import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, createAct, actBounds, composite } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as mossBoulder from "../src/fx/moves/moss-boulder-throw.js";

function countLit(buf) {
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] >>> 24) n++;
  return n;
}

function stepTo(fx, frame, t, fps = 60) {
  const steps = Math.round(t * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  fx.draw(frame);
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

test("moves/moss-boulder-throw is registered and exposes valid meta + act choreography", () => {
  assert.equal(effects["moves/moss-boulder-throw"], mossBoulder);
  assert.equal(mossBoulder.meta.name, "Moss boulder throw");
  assert.equal(mossBoulder.meta.loop, false);
  assert.equal(mossBoulder.meta.bg, "ground");
  assert.equal(mossBoulder.meta.actor, 2);
  assert.ok(mossBoulder.act && mossBoulder.act.target.x === 184);
  assert.ok(mossBoulder.act.poses.length >= 10);
  assert.ok(mossBoulder.act.hits.some((h) => h.slide === 46 && h.daze > 0));
});

test("moves/moss-boulder-throw progresses cleanly through cast storm, supersonic hurl, shatter wave, stun, and empty end", () => {
  const { meta, act } = mossBoulder;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const TX = act.target.x;
  const frame = createFrame(W, H);

  // 1. Cast emergence & dust storm (t = 0.35s): colossal boulder & storm at caster, nothing at target yet
  {
    const fx = createFx(mossBoulder, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, 0.35);
    let casterPx = 0, targetPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (x < OX + 80) casterPx++;
        if (x > OX + TX - 25) targetPx++;
      }
    }
    assert.ok(casterPx > 600, `expected colossal boulder + dust storm near caster, got ${casterPx}`);
    assert.equal(targetPx, 0, "boulder must not reach target during cast levitation");
  }

  // 2. Supersonic hurl & thick Mach wake (t = 0.80s): boulder & sonic-boom wake tear across mid-corridor
  {
    const fx = createFx(mossBoulder, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, 0.80);
    let midPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + 15; x < OX + TX; x++) {
        if (frame.color[y * W + x] >>> 24) midPx++;
      }
    }
    assert.ok(midPx > 900, `expected thick sonic-boom wake + boulder in mid-flight, got ${midPx}`);
  }

  // 3. Catastrophic shatter, sky-high rock shrapnel & expanding 3D dust shockwave (t = 1.20s)
  {
    const fx = createFx(mossBoulder, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, 1.20);
    let impactPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + TX - 110; x < W; x++) {
        if (frame.color[y * W + x] >>> 24) impactPx++;
      }
    }
    assert.ok(impactPx > 1400, `expected massive shatter debris + expanding dust wave, got ${impactPx}`);
  }

  // 4. Post-impact 3D orbiting stun stars above knocked-back enemy (t = 2.50s)
  {
    const fx = createFx(mossBoulder, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, 2.50);
    assert.ok(countLit(frame.color) > 40, "expected orbiting stun stars & settling crater scars at 2.50s");
  }

  // 5. Clean one-shot fadeout at t = duration (both color and light empty)
  {
    const fx = createFx(mossBoulder, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "final frame color buffer must be empty");
    assert.equal(countLit(frame.light), 0, "final frame light buffer must be empty");
  }
});

test("moves/moss-boulder-throw act freezes, shakes, knocks target back 46 px, dazes, and finishes cleanly", () => {
  const b = actBounds(mossBoulder);
  const inst = createAct(mossBoulder, { x: b.ox, y: b.oy, seed: 19 });
  const frame = createFrame(b.w, b.h);
  let sawFreeze = false, sawShake = false, sawDaze = false;
  const startTargetX = inst.targets[0].x;

  for (let i = 0; i < 360 && !inst.done(); i++) {
    inst.update(1 / 30);
    if (inst.frozen) sawFreeze = true;
    if (inst.shake[0] !== 0 || inst.shake[1] !== 0) sawShake = true;
    if ((inst.targets[0]?.daze ?? 0) > 0) sawDaze = true;
    if (i % 5 === 0) inst.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger hit-stop freeze");
  assert.ok(sawShake, "act must trigger screen shake");
  assert.ok(sawDaze, "boulder shatter must apply daze sway to target");
  assert.equal(inst.targets[0].x, startTargetX + 46, "target must skid backward by full 46 px knockback distance");
  assert.ok(inst.done(), "act must finish cleanly");
});

test("moves/moss-boulder-throw is deterministic and supports custom 4-step palettes", () => {
  const [W, H] = mossBoulder.meta.size;
  const [OX, OY] = mossBoulder.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H);
  const opts = {
    x: OX,
    y: OY,
    seed: 7,
    palette: ["#061a10", "#1c6b3a", "#5ce07a", "#ffffff"],
    stone: ["#0e0c14", "#3d354a", "#857a96", "#e6e0f0"],
    dust: ["#1a130e", "#594230", "#a68562", "#edd8ba"],
    stun: ["#3a1c08", "#c97a16", "#ffd859", "#ffffff"],
  };

  const a = createFx(mossBoulder, opts);
  const b = createFx(mossBoulder, opts);
  const outA = stepTo(a, f1, 1.15);
  const outB = stepTo(b, f2, 1.15);

  assert.ok(countLit(f1.color) > 1000);
  assert.deepEqual(Array.from(outA), Array.from(outB));
});
