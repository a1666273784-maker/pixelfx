// The lacquer fan's signature chain: burst open → a horizontal sweep of the fan → an emerald cyclone thrown ahead,
// the fan snapping shut as the finishing punctuation. Built on moves/melee practice like sword-combo.
import { chain, READY } from "../../core/index.js";
import * as opener from "../melee/lacquer-fan.js";
import * as sweep from "../melee/fan-sweep.js";
import * as cyclone from "../melee/verdant-cyclone.js";

const A = 0, B = 0.72, CY = 1.3, FAN_SHUT = 1.98;
const TX = 118;
const SWEEP_HIT = B + 0.055;                 // 0.775 — the edge completes the cut
const CYC_HIT = CY + (TX - 16) / 134;        // ≈ 2.06 — the cyclone bursts on the target
const FINISH = 2.68;

export const meta = {
  name: "Lacquer fan combo",
  desc: "The lacquer fan bursts open, scythes horizontally through the air, then throws an emerald cyclone ahead of it — the fan snaps shut on the finishing beat.",
  tags: ["move", "melee", "fan", "lacquer", "cyclone", "combo", "chinese", "one-shot"],
  size: [296, 188],
  origin: [148, 162],
  duration: FINISH + 1.25,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: { seed: 1 },
};

const GUARD = { ...READY, weapon: "handle", sa: -0.75, fx: 10, fy: -18, bx: 8, by: -20 };
// ---- open ----
const COIL = { ...GUARD, crouch: 6, lean: -3, turn: 0.7, fx: 1, fy: -27, sa: -2.05, bx: 4, by: -23, armsFront: true, ffx: 9, fbx: -9 };
const HIDE = { ...GUARD, crouch: 6, lean: -1, turn: 1.0, fx: 5, fy: -33, sa: -1.45, bx: -2, by: -27, armsFront: true };
const OPENP = { ...GUARD, crouch: 5, lean: 2, turn: 1.15, fx: 9, fy: -23, sa: -1.35, bx: -6, by: -24, ffx: 10, fbx: -10, ghost: 1 };
const HOLD = { ...OPENP, ghost: 0, lean: 3, crouch: 4 };
// ---- horizontal sweep ----
const REACH = { ...GUARD, crouch: 6, lean: -2, turn: 0.5, x: -5, fx: -6, fy: -26, sa: -2.3, bx: 7, by: -23, armsFront: true, ffx: 9, fbx: -9 };
const SWEEP = { ...GUARD, crouch: 4, lean: 5, turn: 0.55, x: 3, fx: 16, fy: -22, sa: 0.28, bx: -6, by: -22, ffx: 12, fbx: -8, armsFront: true, toeB: true, ghost: 1 };
const FOLLOW = { ...SWEEP, ghost: 0, lean: 7, crouch: 5, fx: 14, fy: -19 };
// ---- launch the cyclone ----
const RECOIL = { ...GUARD, crouch: 5, lean: 1, turn: 1.2, fx: 2, fy: -27, sa: -1.15, bx: -3, by: -24, armsFront: true };
const LAUNCH = { ...GUARD, crouch: 4, lean: 3, turn: 1.25, x: 1, fx: 13, fy: -26, sa: -0.45, bx: -4, by: -23, ffx: 11, fbx: -8, ghost: 1 };
const FOLLOW2 = { ...LAUNCH, ghost: 0, lean: 5, fx: 11, fy: -22 };
// ---- shut ----
const SHUTP = { ...GUARD, crouch: 6, lean: 3, fx: 7, fy: -21, sa: -0.9, bx: 4, by: -19 };
const RELAX = { ...SHUTP, lean: 1, crouch: 4 };
const SETTLE = { ...GUARD, crouch: 3 };

export const act = {
  target: { x: TX },
  poses: [
    [-0.66, GUARD],
    [-0.36, COIL],
    [-0.1, HIDE],
    [A, OPENP, "snap"],
    [0.55, HOLD],
    [B - 0.15, REACH],
    [B + 0.075, SWEEP, "snap"],
    [B + 0.34, FOLLOW],
    [CY - 0.16, RECOIL],
    [CY, LAUNCH, "snap"],
    [CY + 0.36, FOLLOW2],
    [FAN_SHUT - 0.08, FOLLOW2],
    [FAN_SHUT + 0.05, SHUTP, "snap"],
    [FAN_SHUT + 0.34, RELAX],
    [FINISH, SETTLE],
    [FINISH + 1.25, SETTLE],
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
    { t: CYC_HIT, x: 108, n: 9, dir: 1 },
  ],
};

export const create = chain([
  { fx: opener, t: A, shut: FAN_SHUT },
  { fx: sweep, t: B },
  { fx: cyclone, t: CY, x: (t) => (t < CY ? 16 : 16 + (t - CY) * 134) },
]);
