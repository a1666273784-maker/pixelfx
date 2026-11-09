import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, createAct, composite } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as coldflameFireball from "../src/fx/moves/coldflame-fireball.js";

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

test("moves/coldflame-fireball is registered in src/fx/index.js with valid two-actor move metadata", () => {
  assert.equal(effects["moves/coldflame-fireball"], coldflameFireball);
  const { meta, act } = coldflameFireball;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.equal(meta.actor, 2);
  assert.ok(meta.desc.length > 40 && meta.desc.length <= 180);
  assert.ok(act && act.target && act.hits?.length >= 4, "must export multi-stage oppressive act choreography");
});

test("moves/coldflame-fireball progresses from crimson ignition -> S-curve pale/blue fireball + falling white sparks -> rising pale cold flames + scattering blue flamelets -> empty end", () => {
  const { meta, act } = coldflameFireball;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const TX = act.target.x;
  const frame = createFrame(W, H);

  // 1. Origin crimson ignition (t = 0.167s): red glow & streaks at caster hand before launch
  {
    const fx = createFx(coldflameFireball, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, 0.167);
    let crimsonPx = 0, targetPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
        if (x < OX + 65 && r > 120 && r > g * 1.8 && r > b * 1.6) crimsonPx++;
        if (x > OX + TX - 30) targetPx++;
      }
    }
    assert.ok(crimsonPx > 70, `expected crimson ignition light/streaks near caster hand, got ${crimsonPx}`);
    assert.equal(targetPx, 0, "projectile must not hit target during origin ignition");
  }

  // 2. S-curve flight + pale core + ghostly-blue rim + falling white sparks (t = 0.433s, 0.633s, 0.800s)
  {
    const sampleFlight = (tVal) => {
      const fx = createFx(coldflameFireball, { x: OX, y: OY, seed: 17 });
      stepTo(fx, frame, tVal);
      let maxX = 0, sumY = 0, n = 0, palePx = 0, blueRimPx = 0, whiteSparksBelow = 0;
      for (let y = 0; y < H; y++) {
        for (let x = OX + 25; x < OX + TX - 5; x++) {
          const c = frame.color[y * W + x];
          if (!(c >>> 24)) continue;
          const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
          if (x > maxX) maxX = x;
          if (r > 220 && g > 225 && b > 235) palePx++;
          if (b > r + 40 && b > 140) blueRimPx++;
          if (r > 235 && g > 235 && b > 235 && y > OY - 14 && y <= OY) whiteSparksBelow++;
        }
      }
      for (let y = 0; y < H; y++) {
        for (let x = Math.max(OX + 25, maxX - 14); x <= maxX; x++) {
          if (frame.color[y * W + x] >>> 24) {
            sumY += y;
            n++;
          }
        }
      }
      return { maxX, headY: sumY / Math.max(1, n), palePx, blueRimPx, whiteSparksBelow };
    };

    const s1 = sampleFlight(0.433); // cresting upward lobe
    const s2 = sampleFlight(0.633); // dipping downward lobe
    const s3 = sampleFlight(0.800); // sweeping back up toward target chest

    assert.ok(s1.maxX < s2.maxX && s2.maxX < s3.maxX, `fireball must advance horizontally (${s1.maxX} -> ${s2.maxX} -> ${s3.maxX})`);
    assert.ok(s2.headY > s1.headY + 14 && s3.headY < s2.headY - 8,
      `fireball must trace clear S-wave up/down/up y trajectory (y=${s1.headY.toFixed(1)} -> ${s2.headY.toFixed(1)} -> ${s3.headY.toFixed(1)})`);
    assert.ok(s2.palePx >= 35, `expected broad corpse-pale fireball core, got ${s2.palePx}`);
    assert.ok(s2.blueRimPx >= 45, `expected vivid ghostly-blue outer corona rim, got ${s2.blueRimPx}`);
    assert.ok(s3.whiteSparksBelow >= 8, `expected falling white sparks drifting down along path, got ${s3.whiteSparksBelow}`);
  }

  // 3. Explosive hit result: central rising pale cold flames + outward scattering ghostly-blue flamelets + back/front layering
  {
    const fx = createFx(coldflameFireball, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, 1.333);
    let palePlumePx = 0, tallPalePx = 0, leftBluePx = 0, rightBluePx = 0;
    const hitX = OX + TX + 4;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = frame.color[y * W + x];
        if (!(c >>> 24)) continue;
        const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
        if (Math.abs(x - hitX) <= 32 && r > 205 && g > 220 && b > 235) {
          palePlumePx++;
          if (y < OY - 45) tallPalePx++;
        }
        if (b > r + 45 && b > 140) {
          if (x < hitX - 30) leftBluePx++;
          if (x > hitX + 30) rightBluePx++;
        }
      }
    }
    assert.ok(palePlumePx > 260 && tallPalePx > 60, `expected rising cluster of pale cold flames at enemy, got ${palePlumePx} (tall=${tallPalePx})`);
    assert.ok(leftBluePx > 25 && rightBluePx > 25, `expected scattering ghostly-blue flamelets left & right (${leftBluePx}, ${rightBluePx})`);

    const fxLayers = createFx(coldflameFireball, { x: OX, y: OY, seed: 17 });
    for (let i = 0; i < 36; i++) fxLayers.update(1 / 30);
    clearFrame(frame);
    fxLayers.draw(frame, "back");
    const backPx = countLit(frame.color);
    clearFrame(frame);
    fxLayers.draw(frame, "front");
    const frontPx = countLit(frame.color);
    assert.ok(backPx > 150 && frontPx > 250, `expected rich back/front layering (${backPx}, ${frontPx})`);
  }

  // 4. Clean one-shot fadeout at t = duration
  {
    const fx = createFx(coldflameFireball, { x: OX, y: OY, seed: 17 });
    stepTo(fx, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end completely empty at t = duration");
    assert.ok(frame.light.every((v) => v === 0), "light buffer must be completely empty at t = duration");
    assert.ok(fx.done(), "fx.done() must be true at t = duration");
  }
});

test("moves/coldflame-fireball act delivers oppressive freeze, heavy shake, knockback slide, char->ice target reaction, and finishes cleanly", () => {
  const [W, H] = coldflameFireball.meta.size;
  const [OX, OY] = coldflameFireball.meta.origin;
  const inst = createAct(coldflameFireball, { x: OX, y: OY, seed: 17 });
  const frame = createFrame(W, H);
  let sawFreeze = false, maxShake = 0, sawChar = false, sawIce = false, maxTargetX = 0;

  for (let i = 0; i < 320 && !inst.done(); i++) {
    inst.update(1 / 30);
    if (inst.frozen) sawFreeze = true;
    maxShake = Math.max(maxShake, Math.hypot(inst.shake[0], inst.shake[1]));
    if (inst.targets[0]?.skin === "char") sawChar = true;
    if (inst.targets[0]?.skin === "ice") sawIce = true;
    if (inst.targets[0]) maxTargetX = Math.max(maxTargetX, inst.targets[0].x);
    if (i % 6 === 0) inst.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger hit-stop freeze");
  assert.ok(maxShake >= 3.5, `act must trigger heavy screen shake, got ${maxShake}`);
  assert.ok(sawChar && sawIce, "act must flash target scorched char then chilled ice");
  assert.ok(maxTargetX >= coldflameFireball.act.target.x + 15, `expected knockback slide past ${coldflameFireball.act.target.x}, got ${maxTargetX}`);
  assert.ok(inst.done(), "act choreography must complete cleanly");
});

test("moves/coldflame-fireball is deterministic by seed and supports custom palette/crimson recoloring", () => {
  const [W, H] = coldflameFireball.meta.size;
  const [OX, OY] = coldflameFireball.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H), f3 = createFrame(W, H);

  const a = createFx(coldflameFireball, { x: OX, y: OY, seed: 31 });
  const b = createFx(coldflameFireball, { x: OX, y: OY, seed: 31 });
  const c = createFx(coldflameFireball, {
    x: OX,
    y: OY,
    seed: 31,
    palette: ["#040a08", "#0c2c1f", "#145940", "#1e9069", "#34cca0", "#76f2cf", "#c2faea", "#e8fbf6", "#ffffff"],
  });

  const outA = stepTo(a, f1, 1.15);
  const outB = stepTo(b, f2, 1.15);
  const outC = stepTo(c, f3, 1.15);

  assert.ok(countLit(f1.color) > 400);
  assert.deepEqual(Array.from(outA), Array.from(outB));
  assert.notDeepEqual(Array.from(outA), Array.from(outC));
});
