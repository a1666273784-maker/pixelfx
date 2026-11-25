import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as anglerFry from "../src/fx/critters/angler-fry.js";

function countPixels(f) {
  let n = 0;
  const d = f.color;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
}

function countLight(f) {
  let n = 0;
  const l = f.light;
  for (let i = 0; i < l.length; i += 3) if (l[i] + l[i + 1] + l[i + 2] > 0) n++;
  return n;
}

function centroidX(f) {
  let sx = 0, w = 0;
  const d = f.color;
  const { w: W, h: H } = f;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = d[(y * W + x) * 4 + 3];
      if (a > 0) { sx += x * a; w += a; }
    }
  }
  return w > 0 ? sx / w : 0;
}

test("critters/angler-fry metadata & index registration", () => {
  assert.equal(anglerFry.meta.duration, 12.0);
  assert.equal(anglerFry.meta.loop, false);
  assert.equal(anglerFry.meta.bg, "ground");
  assert.ok(anglerFry.meta.desc.length <= 180);
  assert.ok(anglerFry.meta.tags.includes("critter"));
  assert.ok(anglerFry.meta.tags.includes("angler"));
  assert.ok(anglerFry.meta.tags.includes("lightning"));
  assert.ok(anglerFry.meta.tags.includes("water"));
  assert.equal(effects["critters/angler-fry"], anglerFry);
});

test("critters/angler-fry renders all 5 stages and exits cleanly", () => {
  const dt = 1 / 30;
  const [W, H] = anglerFry.meta.size;
  const [ox, oy] = anglerFry.meta.origin;
  const inst = createFx(anglerFry, { x: ox, y: oy });
  const frame = createFrame(W, H);

  const snapshots = new Map();
  const sampleFrames = new Set([15, 78, 107, 147, 186, 223, 233, 242, 276, 305, 318, 342, 346, 351, 360]);

  for (let f = 0; f <= 360; f++) {
    if (f > 0) inst.update(dt);
    clearFrame(frame);
    inst.draw(frame, "back");
    inst.draw(frame, "front");
    if (sampleFrames.has(f)) {
      snapshots.set(f, {
        count: countPixels(frame),
        light: countLight(frame),
        cx: centroidX(frame),
      });
    }
  }

  // Stage 1 Idle: translucent fry + big glowing cyan lantern active
  const sIdle = snapshots.get(15);
  assert.ok(sIdle.count >= 150 && sIdle.light > 1200, "Idle must render fry + glowing lantern");

  // Stage 2 Quirk: circle chase + bite spark zap
  const sSpin = snapshots.get(78);
  const sBite = snapshots.get(107);
  assert.ok(sSpin.count >= 140 && sBite.count >= 140, "Quirk chase and bite must remain active");

  // Stage 3 Move: swims forward trailing glowing deep-sea cyan bubble wake
  const sMoveEarly = snapshots.get(147);
  const sMoveLate = snapshots.get(186);
  assert.ok(sMoveLate.count > sIdle.count + 80, "Swimming wake bubbles should expand active pixel count");
  assert.ok(sMoveLate.light > 2500, "Leading lantern + wake must illuminate path");

  // Stage 4 Attack: lantern fling trail -> thunder orb -> water splash explosion -> lantern regrowth
  const sFling = snapshots.get(223);
  const sOrb = snapshots.get(233);
  const sBoom = snapshots.get(242);
  const sPostIdle = snapshots.get(276);
  assert.ok(sFling.cx > sIdle.cx + 25, "Flung lantern must travel forward cleanly");
  assert.ok(sOrb.count >= 350 && sOrb.light > 2800, "Deep-sea thunder orb must blaze brightly");
  assert.ok(sBoom.count >= 450 && sBoom.light > 4000, "Explosion & sapphire splash must maximize visual impact");
  assert.ok(sPostIdle.count >= 150, "Regrown lantern & idle buffer should stay active");

  // Stage 5 KO: ink dispersion + lantern drop & rolls + sputter flicker + clean extinction
  const sKoInk = snapshots.get(318);
  const sFlickOff1 = snapshots.get(342);
  const sFlickOn = snapshots.get(346);
  const sFlickOff2 = snapshots.get(351);
  const sEnd = snapshots.get(360);
  assert.ok(sKoInk.count > 400, "KO ink-wash dispersion must bloom noticeably");
  assert.ok(sFlickOff1.light === 0 && sFlickOn.light > 200 && sFlickOff2.light === 0, "Dropped lantern must visibly flicker OFF -> ON -> OFF before going out");
  assert.equal(sEnd.count, 0, "One-shot KO must extinguish to 0 color pixels by 12.0s");
  assert.equal(sEnd.light, 0, "One-shot KO must extinguish to 0 light pixels by 12.0s");
});

test("critters/angler-fry is deterministic and supports custom lantern/palette overrides", () => {
  const [W, H] = anglerFry.meta.size;
  const [ox, oy] = anglerFry.meta.origin;
  const runAt = (opts, frameIdx) => {
    const inst = createFx(anglerFry, { x: ox, y: oy, ...opts });
    const f = createFrame(W, H);
    for (let i = 0; i < frameIdx; i++) inst.update(1 / 30);
    clearFrame(f);
    inst.draw(f, "back");
    inst.draw(f, "front");
    return f.color;
  };
  const a = runAt({ seed: 42 }, 45);
  const b = runAt({ seed: 42 }, 45);
  assert.deepEqual(a, b, "Same seed must produce byte-identical frames");

  const recolored = runAt({
    seed: 42,
    lantern: ["#300a30", "#701870", "#b832b8", "#f068f0", "#ffb8ff", "#ffffff"],
  }, 45);
  assert.notDeepEqual(a, recolored, "Custom lantern ramp must recolor rendered pixels");
});
