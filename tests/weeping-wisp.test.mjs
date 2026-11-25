import { test } from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx } from "../src/core/index.js";
import { effects } from "../src/fx/index.js";
import * as weepingWisp from "../src/fx/critters/weeping-wisp.js";

function countPixels(f) {
  let n = 0;
  const d = f.color;
  for (let i = 0; i < d.length; i++) if ((d[i] >>> 24) > 0) n++;
  return n;
}

function countLight(f) {
  let n = 0;
  const l = f.light;
  for (let i = 0; i < l.length; i++) if ((l[i] & 0xffffff) > 0) n++;
  return n;
}

function centroidX(f) {
  let sx = 0, w = 0;
  const d = f.color;
  const { w: W, h: H } = f;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = d[y * W + x] >>> 24;
      if (a > 0) { sx += x * a; w += a; }
    }
  }
  return w > 0 ? sx / w : 0;
}

function rgbSums(f) {
  let r = 0, g = 0, b = 0;
  const d = f.color;
  for (let i = 0; i < d.length; i++) {
    const px = d[i];
    const a = px >>> 24;
    if (a > 0) {
      r += (px & 255) * a;
      g += ((px >>> 8) & 255) * a;
      b += ((px >>> 16) & 255) * a;
    }
  }
  return { r, g, b };
}

test("critters/weeping-wisp metadata & catalog registration", () => {
  assert.equal(weepingWisp.meta.name, "Weeping wisp");
  assert.equal(weepingWisp.meta.duration, 12.0);
  assert.equal(weepingWisp.meta.loop, false);
  assert.equal(weepingWisp.meta.bg, "ground");
  assert.ok(weepingWisp.meta.desc.length <= 180);
  assert.ok(weepingWisp.meta.tags.includes("critter"));
  assert.ok(weepingWisp.meta.tags.includes("ghost"));
  assert.ok(weepingWisp.meta.tags.includes("sonic"));
  assert.equal(effects["critters/weeping-wisp"], weepingWisp);
});

test("critters/weeping-wisp executes all 5 sustained stages and clears cleanly", () => {
  const dt = 1 / 30;
  const [W, H] = weepingWisp.meta.size;
  const [ox, oy] = weepingWisp.meta.origin;
  const inst = createFx(weepingWisp, { x: ox, y: oy });
  const frame = createFrame(W, H);

  const sampleFrames = new Set([20, 96, 125, 165, 200, 228, 254, 285, 320, 344, 360]);
  const snapshots = new Map();

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
        rgb: rgbSums(frame),
      });
    }
  }

  // Stage 1 Idle: ghostly green wisp active (green dominant over blue/red)
  const sIdle = snapshots.get(20);
  assert.ok(sIdle.count >= 400 && sIdle.light > 4000, `Idle wisp must render visibly (${sIdle.count})`);
  assert.ok(sIdle.rgb.g > sIdle.rgb.b && sIdle.rgb.g > sIdle.rgb.r, "Idle wisp must render pale ghost-green");

  // Stage 2 Quirk: tear sparks burning holes + sly peek
  const sBawl = snapshots.get(96);
  const sPeek = snapshots.get(125);
  assert.ok(sBawl.count > sIdle.count + 200, "Bawling spark-tears & burn holes must add active pixels");
  assert.ok(sPeek.count >= 500, "Sly peek & giggle + lingering burn holes stay rendered");

  // Stage 3 Move: erratic drift gliding forward
  const sMoveEarly = snapshots.get(165);
  const sMoveLate = snapshots.get(200);
  assert.ok(sMoveLate.cx > sMoveEarly.cx + 12, "Move drift should advance rightward");

  // Stage 4 Attack: dark-purple snap + sonic shockwave rings + soul-flame hit burst + idle buffer return
  const sWaves = snapshots.get(228);
  const sBlast = snapshots.get(254);
  const sBuffer = snapshots.get(285);
  assert.ok(sWaves.rgb.b > sWaves.rgb.g && sWaves.count > 1200, "Rage sonic attack must switch cleanly to dark purple");
  assert.ok(sBlast.count > 1800 && sBlast.light > 12000, "Soul-flame impact detonation must deliver strong visual impact");
  assert.ok(sBuffer.rgb.g > sBuffer.rgb.r && sBuffer.count >= 350, "Post-attack buffer must cool smoothly back to green idle");

  // Stage 5 KO: candle wind whip -> curling smoke wisp -> 0-pixel extinction
  const sWhip = snapshots.get(320);
  const sSmoke = snapshots.get(344);
  const sEnd = snapshots.get(360);
  assert.ok(sWhip.count >= 350, "Wind-whipped flame stretch should remain active before poof");
  assert.ok(sSmoke.count >= 80, "Extinguished wisp should curl into visible smoke wisp");
  assert.equal(sEnd.count, 0, "One-shot KO must extinguish completely to 0 color pixels by 12.0s");
  assert.equal(sEnd.light, 0, "One-shot KO must extinguish completely to 0 light pixels by 12.0s");
});

test("critters/weeping-wisp is deterministic and supports custom palette & rage recoloring", () => {
  const [W, H] = weepingWisp.meta.size;
  const [ox, oy] = weepingWisp.meta.origin;
  const runAt = (opts, frameIdx) => {
    const inst = createFx(weepingWisp, { x: ox, y: oy, ...opts });
    const f = createFrame(W, H);
    for (let i = 0; i < frameIdx; i++) inst.update(1 / 30);
    clearFrame(f);
    inst.draw(f, "back");
    inst.draw(f, "front");
    return new Uint32Array(f.color);
  };
  const a = runAt({ seed: 77 }, 225);
  const b = runAt({ seed: 77 }, 225);
  assert.deepEqual(a, b, "Same seed must produce identical frames");

  const recolored = runAt({
    seed: 77,
    rage: ["#180404", "#480808", "#881010", "#c02020", "#f04830", "#ff8860", "#ffc8a8", "#ffffff"],
  }, 225);
  assert.notDeepEqual(a, recolored, "Custom rage ramp must recolor attack state");
});
