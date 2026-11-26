import test from "node:test";
import assert from "node:assert/strict";
import { createFrame, clearFrame, createFx } from "../src/core/index.js";
import * as moss from "../src/fx/critters/moss-puff.js";
import { effects } from "../src/fx/index.js";

function renderAt(seed = moss.meta.options.seed) {
  const [W, H] = moss.meta.size;
  const [ox, oy] = moss.meta.origin;
  const dt = 1 / moss.meta.fps;
  const totalFrames = Math.round(moss.meta.duration * moss.meta.fps);
  const inst = createFx(moss, { x: ox, y: oy, seed });
  const frame = createFrame(W, H);
  const snapshots = new Map();

  for (let i = 0; i <= totalFrames; i++) {
    clearFrame(frame);
    inst.draw(frame, "back");
    inst.draw(frame, "front");

    let colorPixels = 0;
    let lightPixels = 0;
    let topSkyColor = 0;
    let emeraldPixels = 0;
    let ochrePixels = 0;
    let hitZoneColor = 0;
    let minX = W, maxX = -1, minY = H, maxY = -1;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = frame.color[y * W + x];
        if ((c >>> 24) > 0) {
          colorPixels++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (y < 40) topSkyColor++;
          const r = c & 0xff;
          const g = (c >>> 8) & 0xff;
          const b = (c >>> 16) & 0xff;
          if (g > r + 24 && g > b + 20) emeraldPixels++;
          if (r > g + 12 && r > b + 28) ochrePixels++;
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
      topSkyColor,
      emeraldPixels,
      ochrePixels,
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

test("critters/moss-puff metadata, catalog registration, and clean one-shot lifecycle", () => {
  assert.equal(effects["critters/moss-puff"], moss);
  assert.equal(moss.meta.loop, false);
  assert.equal(moss.meta.fps, 30);
  assert.ok(moss.meta.duration > 0 && moss.meta.duration <= 12);
  assert.ok(moss.meta.desc.length < 180);

  const snaps = renderAt();
  const fLast = snaps.get(360);
  assert.equal(fLast.colorPixels, 0, "final frame must dissolve cleanly with 0 color pixels");
  assert.equal(fLast.lightPixels, 0, "final frame must dissolve cleanly with 0 light pixels");
});

test("critters/moss-puff renders all 5 distinct sustained stages smoothly", () => {
  const snaps = renderAt();

  // 1. Idle (t = 0.60s, frame 18): lush green moss ball on left idle spot
  const fIdle = snaps.get(18);
  assert.ok(fIdle.colorPixels > 350);
  assert.ok(fIdle.emeraldPixels > 250, "idle moss ball is lush emerald green");
  assert.ok(fIdle.maxX < 100, "idle moss ball starts at left idle position");

  // 2. Eco Quirk (t = 3.50s, frame 105): sunbeam pours from top sky & golden/bubble highlights ignite
  const fQuirk = snaps.get(105);
  assert.ok(fQuirk.topSkyColor > 40, "golden sunbeam enters cleanly from upper sky");
  assert.ok(fQuirk.lightPixels > fIdle.lightPixels, "sunbeam + yellow flower raise scene glow");

  // 3. Move (t = 6.90s, frame 207): moss ball finished rolling rightward leaving persistent green moss trail
  const fMoveEnd = snaps.get(207);
  assert.ok(fMoveEnd.maxX > fIdle.maxX + 40, "moss ball rolled rightward toward attack position");
  assert.ok(fMoveEnd.minX <= 52 && fMoveEnd.width > fIdle.width + 35, "long fuzzy green moss trail remains along the ground");

  // 4. Attack & Hypnotic Spore Hit (t = 7.30s frame 219 & t = 8.20s frame 246)
  const fBristle = snaps.get(219);
  const fHit = snaps.get(246);
  assert.ok(fBristle.colorPixels > fMoveEnd.colorPixels + 40, "bristled grass needles expand silhouette");
  assert.ok(fHit.hitZoneColor > 1200, "rolling sleep-spore fluid & hypnotic emerald spots flood target zone");
  assert.ok(fHit.lightPixels > fIdle.lightPixels, "emerald burst light-spots illuminate hit zone");

  // 5. KO Wither & Mud Crumble (t = 10.40s frame 312 & t = 11.20s frame 336)
  const fDry = snaps.get(312);
  const fCrumble = snaps.get(336);
  assert.ok(fDry.ochrePixels > 180 && fDry.emeraldPixels < 40, "emerald moss drains to parched ochre brown");
  assert.ok(fCrumble.colorPixels < fDry.colorPixels && fCrumble.colorPixels > 60, "mud ball cracks and crumbles progressively into dry dust");
});

test("critters/moss-puff output is deterministic for a fixed seed", () => {
  const a = renderAt(23);
  const b = renderAt(23);
  for (const frameIdx of [0, 18, 105, 207, 219, 246, 312, 336, 360]) {
    assert.equal(a.get(frameIdx).checksum, b.get(frameIdx).checksum);
  }
});
