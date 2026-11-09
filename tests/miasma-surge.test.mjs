import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, createAct, composite, painterFor, resolveOptions } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as miasmaSurge from "../src/fx/moves/miasma-surge.js";
import * as miasmaWave from "../src/fx/nature/miasma-wave.js";

function countLit(buf) {
  let n = 0;
  for (let i = 0; i < buf.length; i++) if (buf[i] >>> 24) n++;
  return n;
}

function stepTo(fx, frame, targetT, fps = 30) {
  const steps = Math.round(targetT * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  if (fx.drawBack) fx.drawBack(frame);
  fx.draw(frame);
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

test("moves/miasma-surge is registered in src/fx/index.js with valid two-actor move metadata", () => {
  assert.equal(effects["moves/miasma-surge"], miasmaSurge);

  const { meta, act } = miasmaSurge;
  assert.equal(meta.loop, false);
  assert.equal(meta.bg, "ground");
  assert.equal(meta.actor, 2);
  assert.ok(meta.size[0] / meta.size[1] > 1.75, "must be wide horizontal arena canvas, not screen-ratio overlay");
  assert.ok(meta.desc.length > 40 && meta.desc.length < 180);
  assert.ok(act && act.target && act.hits?.length >= 5, "must export multi-stage oppressive enemy hit choreography");
});

test("moves/miasma-surge progresses from ground-hugging dark-yellow & ink-green miasma + bottom bubbles -> ink-green smoke burst, strobing dark-green flashes & enemy poison bubbles -> empty end", () => {
  const { meta, act } = miasmaSurge;
  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const TX = act.target.x;
  const frame = createFrame(W, H);

  // 1. Ground-hugging rolling miasma surge (t = 0.28s vs t = 0.56s):
  //    - Cleanly ahead of caster (OX), advancing along +x while hugging the floor (OY)
  //    - Interwoven murky dark-yellow (ochre) AND deep ink-green mist pixels
  //    - Tiny vivid green bubble-popping particles concentrated along the bottom edge (OY - 10 .. OY)
  {
    const measureWave = (targetT) => {
      const fx = createFx(miasmaSurge, { x: OX, y: OY, seed: 19 });
      stepTo(fx, frame, targetT);
      let maxWaveX = 0, minWaveY = H, sumY = 0, litN = 0;
      let darkYellowPx = 0, inkGreenPx = 0, bottomVividGreenBubblePx = 0, behindCasterPx = 0, targetZonePx = 0;

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const v = frame.color[y * W + x];
          if (!(v >>> 24)) continue;
          const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
          litN++;
          sumY += y;
          if (x > maxWaveX) maxWaveX = x;
          if (y < minWaveY) minWaveY = y;
          if (x < OX + 4) behindCasterPx++;
          if (x > OX + TX - 8) targetZonePx++;

          // Murky dark-yellow / ochre-sulfur mist pixels
          if (r > 70 && g > 55 && r > g * 1.08 && g > b * 1.8) darkYellowPx++;
          // Deep ink-green mist pixels
          if (g > 25 && g < 150 && g > r * 1.25 && g >= b) inkGreenPx++;
          // Bottom vivid green bubble / burst pixels near floor (OY - 12 .. OY + 1)
          if (y >= OY - 12 && y <= OY + 1 && g >= 145 && g > r * 1.35 && g > b * 1.6) {
            bottomVividGreenBubblePx++;
          }
        }
      }
      return {
        maxWaveX,
        waveHeight: OY - minWaveY,
        meanHeightAboveFloor: OY - sumY / Math.max(1, litN),
        darkYellowPx,
        inkGreenPx,
        bottomVividGreenBubblePx,
        behindCasterPx,
        targetZonePx,
      };
    };

    const w1 = measureWave(0.28);
    const w2 = measureWave(0.56);

    assert.ok(w2.maxWaveX > w1.maxWaveX + 55, `miasma wave must surge rapidly forward (${w1.maxWaveX} -> ${w2.maxWaveX})`);
    assert.equal(w1.targetZonePx, 0, "enemy zone must not trigger before miasma touches enemy at t = 0.28s");
    assert.equal(w1.behindCasterPx, 0, "rolling miasma must stay cleanly ahead of caster without occluding caster sprite");
    assert.ok(w2.meanHeightAboveFloor > 5 && w2.meanHeightAboveFloor < 24 && w2.waveHeight < 52,
      `miasma must hug the ground tightly (meanHeight=${w2.meanHeightAboveFloor.toFixed(1)}, maxH=${w2.waveHeight})`);
    assert.ok(w2.darkYellowPx >= 120, `expected murky dark-yellow mist interwoven in wave, got ${w2.darkYellowPx}`);
    assert.ok(w2.inkGreenPx >= 120, `expected deep ink-green mist interwoven in wave, got ${w2.inkGreenPx}`);
    assert.ok(w2.bottomVividGreenBubblePx >= 25, `expected vivid green bubble-popping particles at mist bottom, got ${w2.bottomVividGreenBubblePx}`);
  }

  // 2. Crisp ON/OFF Dark-Green Hit-Flash Strobing on Impact (0.74s ON -> 0.83s OFF -> 0.90s ON):
  {
    const countTargetFlashSpikes = (targetT) => {
      const fx = createFx(miasmaSurge, { x: OX, y: OY, seed: 19 });
      stepTo(fx, frame, targetT);
      let flashPx = 0;
      for (let y = OY - 68; y <= OY; y++) {
        for (let x = OX + TX - 42; x <= Math.min(W - 1, OX + TX + 68); x++) {
          const v = frame.color[y * W + x];
          if (!(v >>> 24)) continue;
          const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
          if (g >= 150 && g > r * 1.4 && g > b * 1.6) flashPx++;
        }
      }
      return flashPx;
    };

    const on1 = countTargetFlashSpikes(0.74);
    const offGap = countTargetFlashSpikes(0.83);
    const on2 = countTargetFlashSpikes(0.90);

    assert.ok(on1 > 180, `expected strong dark-green hit-flash burst at impact (0.74s), got ${on1}`);
    assert.ok(on1 > offGap * 2.2 && on2 > offGap * 1.6,
      `expected crisp ON/OFF dark-green hit-flash strobing (on1=${on1}, offGap=${offGap}, on2=${on2})`);
  }

  // 3. Exploded Deep Ink-Green Smoke Cloud + Glossy Green Poison Bubbles around Enemy (t = 1.35s):
  {
    const fx = createFx(miasmaSurge, { x: OX, y: OY, seed: 19 });
    stepTo(fx, frame, 1.35);
    let inkSmokePx = 0, poisonBubbleGreenPx = 0, bubbleSpecularPx = 0;
    let minSmokeX = W, maxSmokeX = 0;

    for (let y = 0; y <= OY; y++) {
      for (let x = OX + TX - 85; x < W; x++) {
        const v = frame.color[y * W + x];
        if (!(v >>> 24)) continue;
        const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
        if (g > 18 && g < 130 && g > r * 1.2) {
          inkSmokePx++;
          if (x < minSmokeX) minSmokeX = x;
          if (x > maxSmokeX) maxSmokeX = x;
        }
        if (g >= 150 && g > r * 1.35 && g > b * 1.6) poisonBubbleGreenPx++;
        if (r >= 235 && g >= 245 && b >= 235) bubbleSpecularPx++;
      }
    }

    assert.ok(inkSmokePx > 900 && maxSmokeX - minSmokeX >= 95,
      `expected wide exploded deep ink-green smoke cloud around enemy, got ${inkSmokePx} px spanning ${maxSmokeX - minSmokeX}px`);
    assert.ok(poisonBubbleGreenPx >= 90 && bubbleSpecularPx >= 5,
      `expected glossy green poison bubbles with specular highlights around enemy, got green=${poisonBubbleGreenPx}, spec=${bubbleSpecularPx}`);
  }

  // 4. Clean empty termination at duration
  {
    const fxEnd = createFx(miasmaSurge, { x: OX, y: OY, seed: 19 });
    stepTo(fxEnd, frame, meta.duration);
    assert.equal(countLit(frame.color), 0, "one-shot must end completely empty at t = duration");
  }
});

test("moves/miasma-surge full two-actor scene (createAct) runs cleanly and effect is deterministic with custom ramps", () => {
  const [W, H] = miasmaSurge.meta.size;
  const [OX, OY] = miasmaSurge.meta.origin;
  const sceneFrame = createFrame(W, H);
  const scene = createAct(miasmaSurge, { seed: 19 });

  const totalSteps = Math.ceil(scene.duration * 30);
  for (let i = 0; i <= totalSteps; i++) {
    clearFrame(sceneFrame);
    scene.draw(sceneFrame);
    if (i === 28) assert.ok(countLit(sceneFrame.color) > 1200, "full two-actor scene must render caster, target, and miasma surge");
    scene.update(1 / 30);
  }

  const f1 = createFrame(W, H), f2 = createFrame(W, H);
  const opts = {
    x: OX,
    y: OY,
    seed: 31,
    palette: ["#050a0c", "#0c1e24", "#153640", "#225563", "#34788a", "#509fb3", "#7bc4d6", "#b8eaf5"],
    ochre: ["#171006", "#36250c", "#614215", "#946620", "#c4882b", "#e8ac46", "#fae28c"],
    venom: ["#06140c", "#0e3820", "#1c6b3d", "#36b868", "#75f09e", "#e0ffeb"],
  };
  const outA = stepTo(createFx(miasmaSurge, opts), f1, 0.85);
  const outB = stepTo(createFx(miasmaSurge, opts), f2, 0.85);

  assert.ok(countLit(f1.color) > 1000);
  assert.deepEqual(f1.color, f2.color);
  assert.deepEqual(outA, outB);
});

test("nature/miasma-wave provides the seamless post-launch ground-hugging loop (no hit) with dark-yellow & ink-green mist and popping bottom green bubbles", () => {
  assert.equal(effects["nature/miasma-wave"], miasmaWave);

  const { meta } = miasmaWave;
  assert.equal(meta.loop, true);
  assert.equal(meta.bg, "ground");
  assert.equal(meta.actor, undefined);

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const f0 = createFrame(W, H), fD = createFrame(W, H), fMid = createFrame(W, H);

  // Verify seamless loop wrap: transition from last frame (n - 1) back to frame 0 has no seam jump
  const opts = resolveOptions(meta, { seed: 19 });
  const n = Math.round(meta.duration * meta.fps);
  const shots = [];
  for (let i = 0; i < n; i++) {
    const f = createFrame(W, H);
    const p = painterFor(f);
    p.place(OX, OY, false, 0);
    const tt = (i / n) * meta.duration;
    miasmaWave.drawBack(p, tt, opts);
    miasmaWave.draw(p, tt, opts);
    shots.push(f.color);
  }
  const diffPx = (a, b) => {
    let d = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
    return d;
  };
  const stepDiffs = shots.slice(0, -1).map((a, i) => diffPx(a, shots[i + 1])).sort((x, y) => x - y);
  const typicalStep = stepDiffs[Math.floor(stepDiffs.length * 0.9)];
  const seamStep = diffPx(shots[n - 1], shots[0]);
  assert.ok(seamStep <= typicalStep * 1.25, `expected zero loop seam (seamStep=${seamStep}, typicalStep=${typicalStep})`);

  // Mid-cycle check: ground-hugging profile, interwoven dark-yellow + ink-green mist, and bottom green bubble particles
  stepTo(createFx(miasmaWave, { x: OX, y: OY, seed: 19 }), fMid, 0.45);
  let darkYellowPx = 0, inkGreenPx = 0, bottomBubbleGreenPx = 0, sumY = 0, litN = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = fMid.color[y * W + x];
      if (!(v >>> 24)) continue;
      const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
      litN++;
      sumY += y;
      if (r > 65 && g > 50 && r > g * 1.05 && g > b * 1.7) darkYellowPx++;
      if (g > 25 && g < 155 && g > r * 1.2 && g >= b) inkGreenPx++;
      if (y >= OY - 12 && y <= OY + 1 && g >= 145 && g > r * 1.35 && g > b * 1.6) bottomBubbleGreenPx++;
    }
  }
  const meanHeight = OY - sumY / Math.max(1, litN);
  assert.ok(meanHeight > 5 && meanHeight < 24, `traveling miasma loop must hug the ground tightly, got meanHeight=${meanHeight.toFixed(1)}`);
  assert.ok(darkYellowPx >= 150, `expected murky dark-yellow mist in loop, got ${darkYellowPx}`);
  assert.ok(inkGreenPx >= 180, `expected deep ink-green mist in loop, got ${inkGreenPx}`);
  assert.ok(bottomBubbleGreenPx >= 30, `expected vivid green popping bubble particles along wave bottom, got ${bottomBubbleGreenPx}`);
});
