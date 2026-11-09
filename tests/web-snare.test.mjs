import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, createAct, composite } from "../src/core/index.js";
import * as webSnare from "../src/fx/moves/web-snare.js";

function countLit(buf) {
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] >>> 24) n++;
  return n;
}

function stepTo(fx, frame, targetT, fps = 30) {
  const steps = Math.round(targetT * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  fx.draw(frame);
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

test("moves/web-snare progresses from silk windup through spinning flight to tattered plastered impact web and empty end", () => {
  const { meta, act } = webSnare;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.ok(act && act.target && act.hits?.length >= 2, "must export act choreography with launch and impact hits");

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const TX = act.target.x;
  const frame = createFrame(W, H);

  // 1. Wind-up phase (t = 0.20s): silk orb builds near caster OX without hitting target TX yet
  {
    const fx = createFx(webSnare, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, 0.20);
    let casterPx = 0, targetPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (x < OX + 40) casterPx++;
        if (x > OX + TX - 30) targetPx++;
      }
    }
    assert.ok(casterPx > 90, `expected winding silk sphere near caster, got ${casterPx}`);
    assert.equal(targetPx, 0, "projectile must not hit target during windup");
  }

  // 2. Mid-flight phase (t = 0.45s): double-pointed silk needle (wider middle, sharp tips) + trailing wake
  {
    const fx = createFx(webSnare, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, 0.45);
    let midPx = 0;
    const colHeights = new Map();
    for (let y = 0; y < H; y++) {
      for (let x = OX + 35; x < OX + TX - 15; x++) {
        if (frame.color[y * W + x] >>> 24) {
          midPx++;
          const cur = colHeights.get(x) ?? [y, y];
          colHeights.set(x, [Math.min(cur[0], y), Math.max(cur[1], y)]);
        }
      }
    }
    const span = (x) => { const b = colHeights.get(x); return b ? b[1] - b[0] + 1 : 0; };
    const xs = [...colHeights.keys()].sort((a, b) => a - b);
    const tipX = xs[xs.length - 1];
    // Needle spans ~42px ending at tipX, so center belly sits ~21px behind tipX, rear point ~39px behind tipX
    const centerSpan = Math.max(span(tipX - 21), span(tipX - 20), span(tipX - 19));
    const frontTipSpan = Math.min(span(tipX - 2), span(tipX - 1));
    const rearTipSpan = Math.min(span(tipX - 39), span(tipX - 38), span(tipX - 37));
    assert.ok(centerSpan >= 11 && centerSpan > frontTipSpan && centerSpan > rearTipSpan,
      `expected needle spindle wider in middle (${centerSpan}) than rear (${rearTipSpan}) and front tip (${frontTipSpan})`);
    assert.ok(midPx > 260, `expected spinning silk needle and slender afterimages in flight, got ${midPx}`);
  }

  // 3. Impact detonation (t = 0.80s): high-impact starburst + shock ring + flying snapped threads around target
  {
    const fx = createFx(webSnare, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, 0.80);
    let impactPx = 0, lightSum = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + TX - 65; x < W; x++) {
        const idx = y * W + x;
        if (frame.color[idx] >>> 24) impactPx++;
        const v = frame.light[idx];
        lightSum += (v & 255) + ((v >>> 8) & 255) + ((v >>> 16) & 255);
      }
    }
    assert.ok(impactPx > 850, `expected strong impact burst at target, got ${impactPx}`);
    assert.ok(lightSum > 25000, `expected impact flash light at target, got ${lightSum}`);
  }

  // 4. Tattered web holding phase (t = 1.20s): draws across BOTH back and front layers around target
  {
    const fx = createFx(webSnare, { x: OX, y: OY, seed: 19 });
    for (let i = 0; i < Math.round(1.20 * 30); i++) fx.update(1 / 30);
    clearFrame(frame);
    fx.draw(frame, "back");
    const backPx = countLit(frame.color);
    clearFrame(frame);
    fx.draw(frame, "front");
    const frontPx = countLit(frame.color);
    assert.ok(backPx > 120, `expected back web anchor lines around target, got ${backPx}`);
    assert.ok(frontPx > 180, `expected front plastered web + snapped thread debris, got ${frontPx}`);
  }

  // 5. Clean one-shot fadeout at t = duration (zero residual color or light)
  {
    const fx = createFx(webSnare, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end empty at t = duration");
    assert.ok(frame.light.every((v) => v === 0), "light buffer must be empty at t = duration");
  }
});

test("moves/web-snare act triggers freeze, shake, target knockback, and ends cleanly", () => {
  const [W, H] = webSnare.meta.size;
  const [OX, OY] = webSnare.meta.origin;
  const inst = createAct(webSnare, { x: OX, y: OY, seed: 19 });
  const frame = createFrame(W, H);
  let sawFreeze = false, sawShake = false;

  for (let i = 0; i < 320 && !inst.done(); i++) {
    inst.update(1 / 30);
    if (inst.frozen) sawFreeze = true;
    if (inst.shake[0] !== 0 || inst.shake[1] !== 0) sawShake = true;
    if (i % 5 === 0) inst.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger hit-stop freeze on launch/impact");
  assert.ok(sawShake, "act must trigger screen shake");
  assert.ok(inst.done(), "act must finish cleanly");
});

test("moves/web-snare is deterministic by seed and recolors via custom palette", () => {
  const [W, H] = webSnare.meta.size;
  const [OX, OY] = webSnare.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H), f3 = createFrame(W, H);

  const a = createFx(webSnare, { x: OX, y: OY, seed: 29 });
  const b = createFx(webSnare, { x: OX, y: OY, seed: 29 });
  const c = createFx(webSnare, { x: OX, y: OY, seed: 29, palette: ["#100518", "#3d1a59", "#9b6bc7", "#f5e8ff"] });

  const outA = stepTo(a, f1, 0.90);
  const outB = stepTo(b, f2, 0.90);
  const outC = stepTo(c, f3, 0.90);

  assert.ok(countLit(f1.color) > 400);
  assert.deepEqual(Array.from(outA), Array.from(outB));
  assert.notDeepEqual(Array.from(outA), Array.from(outC));
});
