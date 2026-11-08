import { chain, READY } from "../../core/index.js";
import * as quake from "../nature/quake.js";
import * as rockfall from "../nature/rockfall.js";

const CALL = 0.36, TX = 218;

export const meta = {
  name: "Rockfall call",
  desc: "He reaches skyward, tears both hands down and stamps a glowing rift into the floor; a storm-dust pall gathers and an avalanche of boulders and monoliths pounds the target.",
  tags: ["move", "nature", "earth", "rock", "rockfall", "avalanche", "ultimate", "aoe", "one-shot"],
  size: [480, 268],
  origin: [64, 232],
  duration: CALL + rockfall.meta.duration,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { seed: 17 },
};

const GATHER = { turn: 1.08, crouch: 2, lean: -2, fx: -3, fy: -27, bx: 4, by: -27, armsFront: true, ffx: -4, fbx: 4 };
const SKY_REACH = { turn: 1.14, crouch: -1, lean: -2, fx: -4, fy: -41, bx: 7, by: -40, ffx: 7, ffy: -10, fbx: -5 };
const REND_SLAM = { ...READY, crouch: 8, lean: 4, fx: 14, fy: -14, bx: 5, by: -17, armsFront: true, ffx: 11, fbx: -9 };
const COMMAND = { ...READY, crouch: 4, lean: 3, fx: 16, fy: -34, bx: -5, by: -24, ffx: 11, fbx: -9, toeB: true };
const BRACE = { ...COMMAND, x: -2, crouch: 6, lean: 1, fy: -31 };
const LOWER = { ...READY, crouch: 2, lean: 1, fx: 11, fy: -24, bx: -4, by: -21, ffx: 9, fbx: -8 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.36, READY],
    [0.02, GATHER],
    [0.24, SKY_REACH],
    [CALL - 0.015, { ...SKY_REACH, ffy: -12, fy: -42 }],
    [CALL, REND_SLAM, "snap"],
    [CALL + 0.45, COMMAND],
    [CALL + 2.58, COMMAND],
    [CALL + 2.62, BRACE, "snap"],
    [CALL + 3.45, COMMAND],
    [CALL + 4.35, LOWER],
    [CALL + 5.25, READY],
    [CALL + rockfall.meta.duration, READY],
  ],
  hits: [
    { t: CALL, stop: 0.09, shake: 0.24, amp: 2.8, target: false },
    { t: CALL + 0.82, stop: 0.05, shake: 0.26, amp: 2.4, push: 2.1, straw: 14 },
    { t: CALL + 1.38, stop: 0.05, shake: 0.28, amp: 2.6, push: -2.2, straw: 16 },
    { t: CALL + 1.92, shake: 0.22, amp: 2.0, push: 1.7, straw: 10 },
    { t: CALL + 2.62, stop: 0.20, shake: 0.56, amp: 4.4, push: 4.2, straw: 44 },
    { t: CALL + 3.26, stop: 0.07, shake: 0.30, amp: 2.8, push: -2.3, straw: 18 },
    { t: CALL + 4.08, shake: 0.16, amp: 1.5, push: 1.2, straw: 6 },
    { t: CALL + 4.48, shake: 0.14, amp: 1.3, push: 0.9, straw: 4 },
  ],
  dust: [
    { t: CALL, x: 11, n: 12 },
    { t: CALL + 2.62, x: 10, n: 6 },
  ],
};

export const create = chain([
  {
    fx: quake,
    t: CALL - 0.04,
    x: 22,
    reach: 38,
    palette: rockfall.meta.options.palette,
    glow: rockfall.meta.options.glow.slice(1),
  },
  { fx: rockfall, t: CALL, x: TX },
]);
