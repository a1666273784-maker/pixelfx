import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, createAct, composite } from "../src/core/index.js";
import * as carapaceSpikeBurst from "../src/fx/moves/carapace-spike-burst.js";

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

test("moves/carapace-spike-burst shows origin burst, sustained spinning flight cycle, compact red-white hit flash, bouncing black debris, and empty end", () => {
  const { meta, act } = carapaceSpikeBurst;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.ok(act && act.target && act.hits?.length >= 3, "must export act choreography with release and hit beats");

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const TX = act.target.x;
  const frame = createFrame(W, H);

  // 1. Origin burst phase (t = 0.067s): dark-brown cold-glint spikes & black shell shards bursting radially around origin
  {
    const fx = createFx(carapaceSpikeBurst, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, 0.067);
    let originBurstPx = 0, radialBehindPx = 0, targetFlashPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (x >= OX - 36 && x <= OX + 56) originBurstPx++;
        if (x < OX + 4) radialBehindPx++;
        if (x >= OX + TX - 10) targetFlashPx++;
      }
    }
    assert.ok(originBurstPx > 160, `expected dense chitin spikes & shell shards bursting around origin, got ${originBurstPx}`);
    assert.ok(radialBehindPx > 40, `expected radial spikes/shards behind/around origin center, got ${radialBehindPx}`);
    assert.equal(targetFlashPx, 0, "target must NOT be struck instantaneously before spike flight cycle completes");
  }

  // 2. Mid-flight cycle phase (t = 0.20s): spikes clearly mid-air between origin and target TX
  {
    const fx = createFx(carapaceSpikeBurst, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, 0.20);
    let midAirPx = 0, targetHitPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (x >= OX + 55 && x <= OX + TX - 15) midAirPx++;
        if (x >= OX + TX - 6) targetHitPx++;
      }
    }
    assert.ok(midAirPx > 120, `expected spikes & spinning sheaths flying visibly mid-air at t=0.20s, got ${midAirPx}`);
    assert.equal(targetHitPx, 0, "spikes must still be flying before T_HIT1 (0.28s)");
  }

  // 3. Compact red-white piercing flash phase (t = 0.367s, just after T_HIT2 = 0.335s)
  {
    const fx = createFx(carapaceSpikeBurst, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, 0.367);
    let pierceCorePx = 0, redWhitePx = 0, strayFarRedPx = 0, lightSum = 0;
    for (let y = 0; y < H; y++) {
      for (let x = OX + TX - 55; x <= OX + TX + 75; x++) {
        const idx = y * W + x;
        const c = frame.color[idx];
        if (c >>> 24) {
          pierceCorePx++;
          const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
          if (r > 200 && (g < 80 || (g > 200 && b > 200))) {
            redWhitePx++;
            if (Math.abs(x - (OX + TX + 6)) > 40) strayFarRedPx++;
          }
        }
        const v = frame.light[idx];
        lightSum += (v & 255) + ((v >>> 8) & 255) + ((v >>> 16) & 255);
      }
    }
    assert.ok(pierceCorePx > 110, `expected localized piercing impact cluster at target, got ${pierceCorePx}`);
    assert.ok(redWhitePx > 60, `expected compact red-white interlaced piercing flash pixels, got ${redWhitePx}`);
    assert.equal(strayFarRedPx, 0, "red piercing flash must remain localized around hit point rather than glaring far across screen");
    assert.ok(lightSum > 6000 && lightSum < 80000, `expected controlled localized hit light bloom, got ${lightSum}`);
  }

  // 4. Bouncing black shell debris scattering around target in all directions (t = 0.633s)
  {
    const fx = createFx(carapaceSpikeBurst, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, 0.633);
    let leftDebris = 0, rightDebris = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!(frame.color[y * W + x] >>> 24)) continue;
        if (x < OX + TX) leftDebris++;
        else rightDebris++;
      }
    }
    assert.ok(leftDebris > 20 && rightDebris > 20, `expected black debris scattering in multiple directions (${leftDebris} left, ${rightDebris} right)`);
  }

  // 5. Back + front layering active at burst (t = 0.067s)
  {
    const fx = createFx(carapaceSpikeBurst, { x: OX, y: OY, seed: 19 });
    for (let i = 0; i < 2; i++) fx.update(1 / 30);
    clearFrame(frame);
    fx.draw(frame, "back");
    const backPx = countLit(frame.color);
    clearFrame(frame);
    fx.draw(frame, "front");
    const frontPx = countLit(frame.color);
    assert.ok(backPx > 40, `expected back-half radial chitin spikes behind caster, got ${backPx}`);
    assert.ok(frontPx > 120, `expected front-half spikes and forward volley, got ${frontPx}`);
  }

  // 6. Clean one-shot fadeout at t = duration
  {
    const fx = createFx(carapaceSpikeBurst, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end empty at t = duration");
    assert.ok(frame.light.every((v) => v === 0), "light buffer must be empty at t = duration");
  }
});

test("moves/carapace-spike-burst act triggers freeze, shake, knockback slide, red/char skin, and ends cleanly", () => {
  const [W, H] = carapaceSpikeBurst.meta.size;
  const [OX, OY] = carapaceSpikeBurst.meta.origin;
  const inst = createAct(carapaceSpikeBurst, { x: OX, y: OY, seed: 19 });
  const frame = createFrame(W, H);
  let sawFreeze = false, sawShake = false, sawRed = false, sawChar = false, maxTargetX = 0;

  for (let i = 0; i < 260 && !inst.done(); i++) {
    inst.update(1 / 30);
    if (inst.frozen) sawFreeze = true;
    if (inst.shake[0] !== 0 || inst.shake[1] !== 0) sawShake = true;
    if (inst.targets[0]?.skin === "red") sawRed = true;
    if (inst.targets[0]?.skin === "char") sawChar = true;
    if (inst.targets[0]) maxTargetX = Math.max(maxTargetX, inst.targets[0].x);
    if (i % 4 === 0) inst.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger hit-stop freeze");
  assert.ok(sawShake, "act must trigger screen shake");
  assert.ok(sawRed, "act must tint target red during piercing impact");
  assert.ok(sawChar, "act must transition target to charred skin before recovering");
  assert.ok(maxTargetX >= carapaceSpikeBurst.act.target.x + 10, `expected target knockback slide past ${carapaceSpikeBurst.act.target.x}, got ${maxTargetX}`);
  assert.ok(inst.done(), "act must finish cleanly");
});

test("moves/carapace-spike-burst is deterministic by seed and supports custom palette and flash recoloring", () => {
  const [W, H] = carapaceSpikeBurst.meta.size;
  const [OX, OY] = carapaceSpikeBurst.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H), f3 = createFrame(W, H);

  const a = createFx(carapaceSpikeBurst, { x: OX, y: OY, seed: 29 });
  const b = createFx(carapaceSpikeBurst, { x: OX, y: OY, seed: 29 });
  const c = createFx(carapaceSpikeBurst, {
    x: OX,
    y: OY,
    seed: 29,
    palette: ["#040a10", "#102838", "#2c6882", "#b8ecff"],
    flash: ["#041812", "#0c5a3e", "#1ad478", "#ffffff"],
  });

  const outA = stepTo(a, f1, 0.367);
  const outB = stepTo(b, f2, 0.367);
  const outC = stepTo(c, f3, 0.367);

  assert.ok(countLit(f1.color) > 100);
  assert.deepEqual(Array.from(outA), Array.from(outB));
  assert.notDeepEqual(Array.from(outA), Array.from(outC));
});
