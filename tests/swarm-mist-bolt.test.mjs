import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, createAct, composite } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as swarmMistBolt from "../src/fx/moves/swarm-mist-bolt.js";

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

test("moves/swarm-mist-bolt is registered in src/fx/index.js with valid two-actor move metadata", () => {
  assert.equal(effects["moves/swarm-mist-bolt"], swarmMistBolt);

  const { meta, act } = swarmMistBolt;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.equal(meta.actor, 2);
  assert.ok(meta.desc.length > 40 && meta.desc.length < 180);
  assert.ok(act && act.target && act.hits?.length >= 4, "must export multi-stage oppressive act choreography");
});

test("moves/swarm-mist-bolt progresses from dispersing black smoke -> straight-line swarm & stray black dots -> exploded black chitin & gnawing blood-light -> empty end", () => {
  const { meta, act } = swarmMistBolt;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const TX = act.target.x;
  const frame = createFrame(W, H);

  // 1. Origin black smoke dispersion (t = 0.24s): billowing dark smoke near caster muzzle, zero hit at target yet
  {
    const fx = createFx(swarmMistBolt, { x: OX, y: OY, seed: 23 });
    stepTo(fx, frame, 0.24);
    let originDarkPx = 0, targetPx = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = frame.color[y * W + x];
        if (!(v >>> 24)) continue;
        const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
        if (x < OX + 65 && r < 90 && g < 75 && b < 110) originDarkPx++;
        if (x > OX + TX - 25) targetPx++;
      }
    }
    assert.ok(originDarkPx > 140, `expected dispersing black smoke cloud at origin, got ${originDarkPx}`);
    assert.equal(targetPx, 0, "swarm bolt must not reach enemy at t = 0.24s");
  }

  // 2. Straight-line horizontal flight (t = 0.36s vs t = 0.56s):
  //    - Dense pitch-black insect dots wrapped in dark-crimson miasma advance monotonically along +x at steady y (~OY - 27)
  //    - Scattered stray black bug-dots drop below the straight flight axis along the corridor
  {
    const measureFlight = (targetT) => {
      const fx = createFx(swarmMistBolt, { x: OX, y: OY, seed: 23 });
      stepTo(fx, frame, targetT);
      let headMaxX = 0, headYSum = 0, headN = 0;
      let swarmBlackDots = 0, crimsonMiasmaPx = 0, strayBelowDots = 0;

      for (let y = 0; y < H; y++) {
        for (let x = OX + 45; x < OX + TX; x++) {
          const idx = y * W + x;
          const v = frame.color[idx];
          if (!(v >>> 24)) continue;
          const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
          if (x > headMaxX) headMaxX = x;
          if (r > 95 && r > g * 2) crimsonMiasmaPx++;
          // Pitch-black insect/speck pixels (#020104, stripped of additive light)
          if (r <= 8 && g <= 6 && b <= 10 && frame.light[idx] === 0) {
            if (Math.abs(y - (OY - 27)) <= 12) swarmBlackDots++;
            if (y > OY - 15 && y <= OY) strayBelowDots++;
          }
        }
      }
      for (let y = 0; y < H; y++) {
        for (let x = Math.max(OX + 45, headMaxX - 18); x <= headMaxX; x++) {
          if (frame.color[y * W + x] >>> 24) {
            headYSum += y;
            headN++;
          }
        }
      }
      return { headMaxX, meanHeadY: headYSum / Math.max(1, headN), swarmBlackDots, crimsonMiasmaPx, strayBelowDots };
    };

    const f1 = measureFlight(0.36);
    const f2 = measureFlight(0.56);

    assert.ok(f2.headMaxX > f1.headMaxX + 50, `swarm must fly forward rapidly (${f1.headMaxX} -> ${f2.headMaxX})`);
    assert.ok(Math.abs(f1.meanHeadY - (OY - 27)) < 3.0 && Math.abs(f2.meanHeadY - (OY - 27)) < 3.0,
      `swarm must fly in a straight horizontal line near y=${OY - 27} (got ${f1.meanHeadY.toFixed(1)}, ${f2.meanHeadY.toFixed(1)})`);
    assert.ok(f2.swarmBlackDots >= 35, `expected dense black-dot insect cluster in flight, got ${f2.swarmBlackDots}`);
    assert.ok(f2.crimsonMiasmaPx >= 180, `expected dark-crimson miasma wrapping and trailing the swarm, got ${f2.crimsonMiasmaPx}`);
    assert.ok(f2.strayBelowDots >= 8, `expected stray black dots dropping below the flight path, got ${f2.strayBelowDots}`);
  }

  // 3. Impact shatter & devouring blood-light (t = 0.80s & t = 1.05s):
  //    - Instantaneous scatter into countless tiny pitch-black chitin carapace particles (with zeroed light at black cores)
  //    - Ferocious dark-crimson gnawing blood-light burst + additive light glow around the struck enemy
  {
    const fx = createFx(swarmMistBolt, { x: OX, y: OY, seed: 23 });
    stepTo(fx, frame, 0.80);
    let crimsonImpactPx = 0, blackChitinPx = 0, lightSum = 0;
    let minChitinX = W, maxChitinX = 0;

    for (let y = 0; y < H; y++) {
      for (let x = OX + TX - 75; x < W; x++) {
        const idx = y * W + x;
        const v = frame.color[idx];
        const lv = frame.light[idx];
        lightSum += (lv & 255) + ((lv >>> 8) & 255) + ((lv >>> 16) & 255);
        if (!(v >>> 24)) continue;
        const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
        if (r > 90 && r > g * 1.8) crimsonImpactPx++;
        if (r <= 8 && g <= 6 && b <= 10 && lv === 0) {
          blackChitinPx++;
          if (x < minChitinX) minChitinX = x;
          if (x > maxChitinX) maxChitinX = x;
        }
      }
    }
    assert.ok(crimsonImpactPx > 750, `expected explosive dark-crimson gnawing blood-light at impact, got ${crimsonImpactPx}`);
    assert.ok(blackChitinPx > 150, `expected shattered storm of tiny pitch-black chitin particles, got ${blackChitinPx}`);
    assert.ok(maxChitinX - minChitinX > 55, `expected wide radial scatter of black chitin particles, span=${maxChitinX - minChitinX}`);
    assert.ok(lightSum > 25000, `expected strong crimson blood-light illumination on impact, got ${lightSum}`);
  }

  // 4. Clean one-shot fadeout at t = duration (zero residual color or light)
  {
    const fx = createFx(swarmMistBolt, { x: OX, y: OY, seed: 23 });
    stepTo(fx, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end completely empty at t = duration");
    assert.ok(frame.light.every((v) => v === 0), "light buffer must be completely empty at t = duration");
    assert.ok(fx.done(), "fx.done() must be true at t = duration");
  }
});

test("moves/swarm-mist-bolt act choreography delivers oppressive hit-stop, heavy shake, knockback slide, and daze", () => {
  const [W, H] = swarmMistBolt.meta.size;
  const [OX, OY] = swarmMistBolt.meta.origin;
  const inst = createAct(swarmMistBolt, { x: OX, y: OY, seed: 23 });
  const frame = createFrame(W, H);
  let sawFreeze = false, maxShake = 0;

  for (let i = 0; i < 360 && !inst.done(); i++) {
    inst.update(1 / 30);
    if (inst.frozen) sawFreeze = true;
    maxShake = Math.max(maxShake, Math.hypot(inst.shake[0], inst.shake[1]));
    if (i % 6 === 0) inst.draw(clearFrame(frame));
  }

  assert.ok(sawFreeze, "act must trigger oppressive hit-stop freeze");
  assert.ok(maxShake >= 2.5, `act must trigger heavy screen shake, got maxShake=${maxShake}`);
  assert.ok(inst.done(), "act choreography must complete cleanly");
});

test("moves/swarm-mist-bolt is deterministic by seed and supports custom palette recoloring", () => {
  const [W, H] = swarmMistBolt.meta.size;
  const [OX, OY] = swarmMistBolt.meta.origin;
  const f1 = createFrame(W, H), f2 = createFrame(W, H), f3 = createFrame(W, H);

  const a = createFx(swarmMistBolt, { x: OX, y: OY, seed: 31 });
  const b = createFx(swarmMistBolt, { x: OX, y: OY, seed: 31 });
  const c = createFx(swarmMistBolt, {
    x: OX,
    y: OY,
    seed: 31,
    palette: ["#020503", "#061c10", "#0d4224", "#167a3f", "#24b85e", "#42e87e", "#84ffa8", "#dcffe4", "#ffffff"],
  });

  const outA = stepTo(a, f1, 0.80);
  const outB = stepTo(b, f2, 0.80);
  const outC = stepTo(c, f3, 0.80);

  assert.ok(countLit(f1.color) > 600);
  assert.deepEqual(Array.from(outA), Array.from(outB), "identical seeds must produce byte-identical output");
  assert.notDeepEqual(Array.from(outA), Array.from(outC), "custom palette option must recolor miasma and gnawing light");
});
