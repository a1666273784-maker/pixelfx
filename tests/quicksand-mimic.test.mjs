import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx } from "../src/core/index.js";
import * as mimic from "../src/fx/critters/quicksand-mimic.js";
import { effects } from "../src/fx/index.js";

function renderAt(seed = mimic.meta.options.seed) {
  const [W, H] = mimic.meta.size;
  const [ox, oy] = mimic.meta.origin;
  const dt = 1 / mimic.meta.fps;
  const totalFrames = Math.round(mimic.meta.duration * mimic.meta.fps);
  const inst = createFx(mimic, { x: ox, y: oy, seed });
  const frame = createFrame(W, H);
  const snapshots = new Map();

  for (let i = 0; i <= totalFrames; i++) {
    clearFrame(frame);
    inst.draw(frame, "back");
    inst.draw(frame, "front");

    let colorPixels = 0;
    let lightPixels = 0;
    let minX = W, maxX = -1, minY = H, maxY = -1;
    let blueEyes = 0;
    let hitZoneColor = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = frame.color[y * W + x];
        if ((c >>> 24) > 0) {
          colorPixels++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          const r = c & 0xff, b = (c >>> 16) & 0xff;
          if (b > r + 40) blueEyes++;
          // X_HIT = +56 -> canvas x = 120 + 56 = 176
          if (x >= 140) hitZoneColor++;
        }
        if ((frame.light[y * W + x] & 0xffffff) > 0) lightPixels++;
      }
    }

    snapshots.set(i, {
      t: i * dt,
      colorPixels,
      lightPixels,
      blueEyes,
      hitZoneColor,
      minX,
      maxX,
      minY,
      maxY,
      width: maxX >= minX ? maxX - minX + 1 : 0,
      height: maxY >= minY ? maxY - minY + 1 : 0,
      checksum: frame.color.reduce((acc, v, idx) => (acc + v * ((idx & 7) + 1)) | 0, 0),
    });
    inst.update(dt);
  }
  return snapshots;
}

test("critters/quicksand-mimic metadata, catalog registration, and clean one-shot lifecycle", () => {
  assert.equal(effects["critters/quicksand-mimic"], mimic);
  assert.equal(mimic.meta.loop, false);
  assert.equal(mimic.meta.fps, 30);
  assert.ok(mimic.meta.duration > 0 && mimic.meta.duration <= 12);
  assert.ok(mimic.meta.desc.length < 180);

  const snaps = renderAt();
  const fLast = snaps.get(360);
  assert.equal(fLast.colorPixels, 0, "final frame must exit cleanly with 0 color pixels");
  assert.equal(fLast.lightPixels, 0, "final frame must exit cleanly with 0 light pixels");
});

test("critters/quicksand-mimic renders all 5 distinct sustained stages smoothly", () => {
  const snaps = renderAt();

  // 1. Idle (t = 0.60s, frame 18): teardrop sand blob + glowing sapphire eyes
  const fIdle = snaps.get(18);
  assert.ok(fIdle.colorPixels > 300 && fIdle.blueEyes >= 12);
  assert.ok(fIdle.maxX < 100, "idle mimic sits cleanly at left idle spot");

  // 2. Quirk Crown (t = 2.70s, frame 81) -> Flat Splat Pancake (t = 3.60s, frame 108)
  const fCrown = snaps.get(81);
  const fSplat = snaps.get(108);
  assert.ok(fCrown.height > fIdle.height + 4, "crown stretches taller than resting blob");
  assert.ok(fSplat.width > fIdle.width + 8 && fSplat.height < fIdle.height - 8, "pancake splat is much wider & flatter");

  // 3. Move Tornado (t = 5.80s, frame 174): tall spinning golden tornado displaced rightward
  const fMove = snaps.get(174);
  assert.ok(fMove.height >= 40, "tornado funnel rises tall during move");
  assert.ok(fMove.maxX > fIdle.maxX + 12, "tornado glides cleanly rightward");

  // 4. Attack Hammer & Massive Ground Sandstorm Hit (t = 7.90s, frame 237)
  const fHit = snaps.get(237);
  assert.ok(fHit.hitZoneColor > 600, "colossal sandstorm hit erupts richly over X_HIT");
  assert.ok(fHit.lightPixels > fIdle.lightPixels, "impact produces heightened lighting flare");

  // 5. KO Matte Sand Dune + Rolling Sapphire Eyes (t = 10.67s, frame 320): dim matte sand dune, rolling eyes visible
  const fKo = snaps.get(320);
  assert.ok(fKo.colorPixels > 250, "lifeless sand dune remains visible during KO settle");
  assert.ok(fKo.blueEyes > 0, "sapphire eyes remain visible as they roll off the dune");
});

test("critters/quicksand-mimic output is deterministic for a fixed seed", () => {
  const a = renderAt(17);
  const b = renderAt(17);
  for (const frameIdx of [0, 81, 108, 174, 237, 320, 360]) {
    assert.equal(a.get(frameIdx).checksum, b.get(frameIdx).checksum);
  }
});
