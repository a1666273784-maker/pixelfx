// The lacquer fan's signature chain: burst open, wind it across his body, scythe the air, then throw the air
// itself — one unbroken line of motion from the opening snap to the closing click. Sword-combo pattern.
import { chain, READY } from "../../core/index.js";
import * as opener from "../melee/lacquer-fan.js";
import * as sweep from "../melee/fan-sweep.js";
import * as cyclone from "../melee/verdant-cyclone.js";

const A = 0, B = 0.58, CY = 1.24, FAN_SHUT = 2.11;
const TX = 118;
const SWEEP_HIT = B + 0.055;                 // 0.635 — the edge completes the cut
const CYC_HIT = CY + (TX - 16) / 146;        // ≈ 1.94 — the cyclone bursts on the target
const FINISH = 2.6;

export const meta = {
  name: "Lacquer fan combo",
  desc: "The lacquer fan bursts open, scythes horizontally through the air, then throws an emerald cyclone ahead of it — one unbroken line of motion, punctuated by the shut.",
  tags: ["move", "melee", "fan", "lacquer", "cyclone", "combo", "chinese", "one-shot"],
  size: [346, 188],
  origin: [173, 162],
  duration: FINISH + 1.05,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { seed: 1 },
};

const GUARD = { ...READY, weapon: "handle", sa: -0.75, fx: 10, fy: -18, bx: 8, by: -20 };
// ---- the open ----
const COIL = { ...GUARD, crouch: 6, lean: -3, turn: 0.7, fx: 1, fy: -27, sa: -2.05, bx: 4, by: -23, armsFront: true, ffx: 9, fbx: -9 };
const HIDE = { ...GUARD, crouch: 6, lean: -1, turn: 1.0, fx: 5, fy: -33, sa: -1.45, bx: -2, by: -27, armsFront: true };
const OPENP = { ...GUARD, crouch: 5, lean: 2, turn: 1.15, fx: 9, fy: -23, sa: -1.35, bx: -6, by: -24, ffx: 10, fbx: -10, ghost: 1 };
const OPEN_SETTLE = { ...OPENP, ghost: 0, lean: 1, crouch: 5 };
// ---- the sweep: the line keeps running, no beat dropped ----
const REACH = { ...GUARD, crouch: 6, lean: -2, turn: 0.45, x: -5, fx: -6, fy: -27, sa: -2.3, bx: 7, by: -23, armsFront: true, ffx: 9, fbx: -9 };
const SWEEP = { ...GUARD, crouch: 4, lean: 5, turn: 0.6, x: 3, fx: 16, fy: -22, sa: 0.28, bx: -6, by: -22, ffx: 12, fbx: -8, armsFront: true, toeB: true, ghost: 1 };
const FOLLOW = { ...SWEEP, ghost: 0, lean: 7, crouch: 5, fx: 14, fy: -19, turn: 0.75 };
// ---- the launch: straight off the sweep's follow-through ----
const RECOIL = { ...GUARD, crouch: 5, lean: 2, turn: 1.15, fx: 2, fy: -27, sa: -1.1, bx: -2, by: -25, armsFront: true };
const LAUNCH = { ...GUARD, crouch: 4, lean: 3, turn: 1.3, x: 1, fx: 14, fy: -25, sa: -0.42, bx: -5, by: -23, ffx: 11, fbx: -8, ghost: 1 };
const FOLLOW2 = { ...LAUNCH, ghost: 0, lean: 5, turn: 1.28, fx: 12, fy: -22 };
// ---- the shut: punctuation on the burst's afterglow ----
const SHUTP = { ...GUARD, crouch: 6, lean: 3, fx: 7, fy: -21, sa: -0.9, bx: 4, by: -19 };
const RELAX = { ...SHUTP, lean: 1, crouch: 4 };
const SETTLE = { ...GUARD, crouch: 3 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.58, GUARD],
    [-0.34, COIL],
    [-0.08, HIDE],
    [A, OPENP, "snap"],
    [0.16, OPEN_SETTLE],
    [0.4, REACH],
    [B + 0.075, SWEEP, "snap"],
    [B + 0.42, FOLLOW],
    [CY - 0.14, RECOIL],
    [CY, LAUNCH, "out"],
    [CY + 0.22, FOLLOW2],
    [FAN_SHUT - 0.09, FOLLOW2],
    [FAN_SHUT + 0.05, SHUTP, "snap"],
    [FAN_SHUT + 0.36, RELAX],
    [FINISH, SETTLE],
    [FINISH + 1.05, SETTLE],
  ],
  hits: [
    { t: 0.1, stop: 0.16, shake: 0.26, amp: 3.6, push: 3.6, straw: 26, skin: "red", y: -27 },
    { t: SWEEP_HIT, stop: 0.09, shake: 0.18, amp: 2.4, push: 2.6, straw: 16, y: -22 },
    { t: CYC_HIT, stop: 0.15, shake: 0.24, amp: 3.2, push: 3.4, straw: 24, skin: "poison", y: -18 },
  ],
  dust: [
    { t: 0.02, x: 6, n: 7, dir: 1 },
    { t: 0.02, x: -8, n: 5, dir: -1 },
    { t: SWEEP_HIT, x: 12, n: 7, dir: 1 },
    { t: CYC_HIT, x: 108, n: 10, dir: 1 },
  ],
};

export const create = chain([
  { fx: opener, t: A, shut: FAN_SHUT, targetX: TX },
  { fx: sweep, t: B },
  { fx: cyclone, t: CY, x: (t) => (t < CY ? 16 : 16 + (t - CY) * 146) },
]);
