import test from "node:test";
import assert from "node:assert/strict";

import { createFrame, clearFrame, createFx, composite } from "../src/core/index.js";
import * as redWhitePierce from "../src/fx/melee/red-white-pierce.js";

function stepTo(fx, frame, targetT, fps = 120) {
  const steps = Math.round(targetT * fps);
  for (let i = 0; i < steps; i++) fx.update(1 / fps);
  clearFrame(frame);
  fx.draw(frame);
  const out = new Uint8ClampedArray(frame.color.length * 4);
  composite(frame, out);
  return out;
}

test("melee/red-white-pierce: a point gathers, a red-and-white streak pierces, the wound flashes, glints fall and it ends empty", () => {
  const { meta, act } = redWhitePierce;
  assert.equal(meta.loop, false);
  assert.ok(act && act.target && act.hits?.length >= 1, "must export act choreography with a hit");

  const [W, H] = meta.size;
  const [OX, OY] = meta.origin;
  const HX = OX + 10, HY = OY - 22, TX = HX + 60;
  const frame = createFrame(W, H);
  const at = (buf, x, y) => (y * W + x) * 4;
  const lit = (buf, x, y) => buf[at(buf, x, y) + 3] > 0;

  // 1. release: the light is at the hand and nothing has been fired yet
  {
    const fx = createFx(redWhitePierce, { x: OX, y: OY, seed: 7 });
    const buf = stepTo(fx, frame, 0.08);
    let near = 0, far = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!lit(buf, x, y)) continue;
      if (x < HX + 6) near++;
      if (x > HX + 20) far++;
    }
    assert.ok(near > 4, `expected a compressed point of light at the hand, got ${near}`);
    assert.equal(far, 0, "nothing should be fired during the release");
  }

  // 2. piercing streak: just before contact the streak stretches out in red and white stripes
  {
    const fx = createFx(redWhitePierce, { x: OX, y: OY, seed: 7 });
    const buf = stepTo(fx, frame, 0.22);
    let reds = 0, whites = 0, reach = 0;
    for (let x = HX; x < W; x++) {
      const i = at(buf, x, HY);
      if (buf[i + 3] === 0) continue;
      reach = Math.max(reach, x - HX);
      const r = buf[i], g = buf[i + 1], b = buf[i + 2];
      if (r > 200 && g < 110) reds++;
      if (r > 240 && g > 240 && b > 240) whites++;
    }
    assert.ok(reach >= 40, `streak should lunge a short distance, reached ${reach}px`);
    assert.ok(reds > 3 && whites > 3, `streak should alternate red and white, got red ${reds} white ${whites}`);
  }

  // 3. the wound: a white flash at the tip, the streak gone, and grey glints shattered further down
  {
    const fx = createFx(redWhitePierce, { x: OX, y: OY, seed: 7 });
    const buf = stepTo(fx, frame, 0.3);
    const flash = lit(buf, TX, HY) || lit(buf, TX - 1, HY) || lit(buf, TX + 1, HY);
    assert.ok(flash, "expected the white piercing flash at the wound");
    let glints = 0;
    for (let y = 0; y < H; y++) for (let x = HX + 12; x < TX + 10; x++) if (y > HY - 3 && lit(buf, x, y)) glints++;
    assert.ok(glints > 0, "expected grey-white glints after the shatter");
  }

  // 4. the end: everything has faded and nothing is drawn at the duration
  {
    const fx = createFx(redWhitePierce, { x: OX, y: OY, seed: 7 });
    const buf = stepTo(fx, frame, redWhitePierce.meta.duration);
    let n = 0;
    for (let i = 3; i < buf.length; i += 4) if (buf[i]) n++;
    assert.equal(n, 0, `the effect should end empty, got ${n} lit pixels`);
  }
});
