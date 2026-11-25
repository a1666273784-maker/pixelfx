// Translucent jelly body, swirling belly nebula, and glossy water-drop highlights build on ./starlight-slime.js
// and ./jellyfish.js; frog silhouette & limbs follow ./frog.js; cosmic beam, star trails, and ground star-impacts
// build on ../arcane/arcane-beam.js, ../arcane/star-fall.js, and ../water/ripples.js (adapted from Sprite Fusion's
// open-source pixel-art VFX, MIT License, Copyright (c) 2026 Hugo Duprez).
import {
  Particles,
  Lights,
  P,
  Rng,
  fit,
  flare,
  sparkle,
  clamp,
  smooth,
  seg,
  ease,
  lerp,
  noise,
  TAU,
  WHITE,
} from "../../core/index.js";
import { Grid, shadow, spring, lnoise } from "./_lib.js";

export const meta = {
  name: "Starry frog",
  desc: "A plump cosmic-jelly toad drools over its swirling belly nebula, snaps a golden mote, hops leaving starry ripples, blasts a meteor torrent, and bursts into fireworks.",
  tags: ["critter", "monster", "frog", "toad", "nebula", "starlight", "beam", "cute", "one-shot"],
  size: [340, 184],
  origin: [134, 146],
  duration: 12.0,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    // 8-step Translucent Deep-Blue Cosmic Jelly ramp
    palette: ["#0b1030", "#152157", "#20398a", "#305cc2", "#4886eb", "#74b8ff", "#bce9ff", "#ffffff"],
    // 6-step Swirling Belly Nebula & Galaxy Torrent ramp
    nebula: ["#260f59", "#5c1eb0", "#a23ef7", "#e66bff", "#ff94eb", "#fff294"],
    // 4-step Neon Pink Tongue (used ONLY during tongue whip & KO flop — never as permanent idle spot!)
    tongue: ["#7a1446", "#c92874", "#ff4da8", "#ffabde"],
    // 4-step Golden Mote & Meteor Shards ramp
    gold: ["#944e08", "#eb9314", "#ffcd40", "#fff7ad"],
    seed: 11,
  },
};

// 5-Stage Sustained Choreography + Post-Attack Idle Buffer (12.00s, 360 frames):
// 0.00..2.00  【待机 Idle】               Plump translucent deep-blue jelly toad, swirling belly nebula, dark gaping maw + glowing drool
// 2.00..4.55  【生态小动作 Quirk】        Golden mote flies by -> eyes flash bright -> pink tongue whips & swallows -> belly flares -> pats belly & burps bubbles
// 4.55..6.80  【移动 Move】               3 heavy hops with BOTH hind legs kicking & front paws spread -> water-balloon jiggle + organic cosmic water ripples
// 6.80..8.74  【攻击 Attack】             Swirling cosmic-vortex inhale into puffed cheeks -> galaxy meteor torrent + shattering star-burst impact
// 8.74..9.88  【攻击后待机缓冲 IdleBuf】  Calm 2-cycle idle breathing while shattered crater embers glow
// 9.88..12.00 【倒地 KO】                 Slumps with rolled white eyes & flopped long tongue -> jelly ruptures -> nebula fireworks ascend & vanish
const T_QUIRK = 2.00;
const T_SNAP = 2.62;
const T_GULP = 2.90;
const T_MOVE = 4.55;
const T_HOP1 = 4.62;
const T_HOP2 = 5.28;
const T_HOP3 = 5.94;
const T_ATK = 6.80;
const T_BEAM_ON = 7.64;
const T_BEAM_OFF = 8.54;
const T_POST_IDLE = 8.74;
const T_KO = 9.88;
const T_RUPTURE = 10.48;
const T_END = meta.duration;

const X_IDLE = -86;
const X_ATK = -26;
const X_HIT = 104;

const HOPS = [
  { t0: T_HOP1, tLand: 5.18, x0: X_IDLE, x1: -66, h: 25 },
  { t0: T_HOP2, tLand: 5.84, x0: -66, x1: -46, h: 27 },
  { t0: T_HOP3, tLand: 6.50, x0: -46, x1: X_ATK, h: 26 },
];

const INNER_STARS = [
  { a0: 0.3, r: 0.56, ph: 0.1, freq: 3.1, c: 0 },
  { a0: 1.4, r: 0.66, ph: 0.4, freq: 4.0, c: 1 },
  { a0: 2.5, r: 0.50, ph: 0.7, freq: 3.5, c: 2 },
  { a0: 3.6, r: 0.70, ph: 0.2, freq: 4.5, c: 0 },
  { a0: 4.5, r: 0.42, ph: 0.6, freq: 3.8, c: 1 },
  { a0: 5.4, r: 0.62, ph: 0.9, freq: 3.3, c: 2 },
  { a0: 0.9, r: 0.74, ph: 0.3, freq: 4.2, c: 1 },
  { a0: 2.9, r: 0.58, ph: 0.8, freq: 3.6, c: 0 },
  { a0: 4.9, r: 0.38, ph: 0.5, freq: 4.4, c: 2 },
  { a0: 2.0, r: 0.65, ph: 0.15, freq: 3.2, c: 0 },
  { a0: 5.9, r: 0.78, ph: 0.65, freq: 3.9, c: 1 },
  { a0: 0.6, r: 0.46, ph: 0.85, freq: 4.1, c: 2 },
];

function goldenMoteAt(t) {
  if (t < T_QUIRK + 0.05 || t > T_GULP) return null;
  if (t < T_SNAP) {
    const u = seg(t, T_QUIRK + 0.05, T_SNAP);
    const ex = ease.outCubic(u);
    const mx = lerp(X_IDLE + 76, X_IDLE + 32, ex) + Math.sin(u * TAU * 1.4) * 5;
    const my = lerp(-62, -34, ex) + Math.sin(u * TAU * 2.0) * 5;
    return { x: mx, y: my, caught: false };
  }
  const u = seg(t, T_SNAP, T_GULP);
  const pull = ease.inQuad(clamp((u - 0.14) / 0.86));
  return {
    x: lerp(X_IDLE + 32, X_IDLE + 15, pull),
    y: lerp(-34, -17, pull),
    caught: true,
    pull,
  };
}

function frogPoseAt(t) {
  let x = X_IDLE;
  let y = 0;
  let sq = 0;
  let slosh = 0;
  let lean = 0;
  let mouthOpen = 0.60;
  let cheekPuff = 0;
  let nebBoost = 0;
  let patPhase = 0;
  let patBeat = 0;
  let eyeMode = "derpy";
  let tongueOut = 0;
  let bellyCharge = 0;
  let shellCrack = 0;
  let popped = false;
  let legExtend = 0;
  let firing = false;

  if (t < T_QUIRK) {
    const spawnK = ease.outBack(clamp(t / 0.24), 1.25);
    const breath = Math.sin((t / T_QUIRK) * TAU * 3.0);
    sq = -0.09 * breath - 0.20 * (1 - spawnK);
    slosh = 0.04 * Math.sin((t / T_QUIRK) * TAU * 3.0 - 0.8);
    mouthOpen = 0.62 + 0.10 * breath;
    eyeMode = "derpy";
  } else if (t < T_MOVE) {
    if (t < T_SNAP) {
      const u = seg(t, T_QUIRK, T_SNAP);
      const notice = smooth(0.16, 0.34, u);
      sq = -0.10 * notice + 0.05 * Math.sin(u * 14);
      lean = 0.10 * notice;
      mouthOpen = lerp(0.58, 0.84, notice);
      eyeMode = u > 0.16 ? "alert" : "derpy";
    } else if (t < T_GULP) {
      const u = seg(t, T_SNAP, T_GULP);
      sq = 0.15 * Math.sin(u * Math.PI);
      lean = lerp(0.16, -0.04, u);
      mouthOpen = 0.96;
      eyeMode = "alert";
    } else {
      const age = t - T_GULP;
      nebBoost = Math.exp(-age * 4.2) * (1 - Math.exp(-age * 24));
      patPhase = clamp((age - 0.14) / 1.32);
      patBeat = patPhase > 0 && patPhase < 1 ? Math.max(0, Math.sin(patPhase * TAU * 4.0)) : 0;
      sq = -0.22 * patBeat - 0.06 * Math.sin(age * 11) * Math.exp(-age * 1.4);
      slosh = 0.18 * Math.sin(patPhase * TAU * 4.0) * (1 - patPhase * 0.35);
      lean = -0.10 * (1 - smooth(1.25, 1.62, age));
      mouthOpen = patPhase > 0.35 && patPhase < 0.78 ? 0.52 : lerp(0.24, 0.56, smooth(1.25, 1.62, age));
      eyeMode = age < 1.38 ? "happy" : "derpy";
    }
  } else if (t < T_ATK) {
    eyeMode = "derpy";
    mouthOpen = 0.28;
    let activeHop = null;
    let lastLand = null;
    for (const h of HOPS) {
      if (t >= h.t0 && t <= h.tLand) activeHop = h;
      if (t >= h.tLand) lastLand = h;
    }
    if (activeHop) {
      const u = (t - activeHop.t0) / (activeHop.tLand - activeHop.t0);
      if (u < 0.18) {
        const c = ease.inOutSine(u / 0.18);
        x = activeHop.x0;
        sq = -0.28 * c;
        lean = 0.08 * c;
      } else {
        const q = (u - 0.18) / 0.82;
        x = lerp(activeHop.x0, activeHop.x1, q);
        y = -activeHop.h * 4 * q * (1 - q);
        sq = lerp(0.32, 0.10, Math.sin(q * Math.PI)) * (q < 0.5 ? 1 : 0.7);
        lean = lerp(0.22, -0.16, q);
        legExtend = Math.sin(q * Math.PI);
        mouthOpen = 0.44;
      }
    } else if (lastLand) {
      x = lastLand.x1;
      const age = t - lastLand.tLand;
      sq = -0.52 * spring(age, 3.8, 5.4);
      slosh = 0.32 * Math.exp(-age * 4.0) * Math.sin(age * TAU * 4.6);
      lean = -0.07 * Math.exp(-age * 5);
    } else {
      x = X_IDLE;
      sq = -0.15 * seg(t, T_MOVE, T_HOP1);
    }
  } else if (t < T_POST_IDLE) {
    x = X_ATK;
    if (t < T_BEAM_ON) {
      const u = seg(t, T_ATK, T_BEAM_ON);
      const puff = ease.outBack(clamp(u / 0.82), 1.38);
      sq = -0.18 * puff + 0.03 * Math.sin(t * 72) * u;
      lean = -0.18 * puff;
      cheekPuff = puff;
      bellyCharge = smooth(0.08, 0.86, u);
      mouthOpen = lerp(0.22, 0.0, puff);
      eyeMode = "fierce";
    } else if (t < T_BEAM_OFF) {
      const u = seg(t, T_BEAM_ON, T_BEAM_OFF);
      const blastSnap = ease.outBack(clamp(u / 0.12), 1.4);
      sq = -0.14 + Math.sin(t * 62) * 0.05;
      slosh = 0.09 * Math.sin(t * 48);
      lean = 0.22 * blastSnap;
      cheekPuff = lerp(1.0, 0.25, u);
      bellyCharge = 1.0 - 0.55 * u;
      mouthOpen = 1.0;
      eyeMode = "fierce";
      firing = true;
    } else {
      const u = seg(t, T_BEAM_OFF, T_POST_IDLE);
      sq = lerp(-0.16, 0.0, ease.outQuad(u));
      lean = lerp(0.20, 0.0, ease.outQuad(u));
      cheekPuff = 0.25 * (1 - u);
      bellyCharge = 0.45 * (1 - u);
      mouthOpen = lerp(0.85, 0.58, u);
      eyeMode = u > 0.50 ? "derpy" : "fierce";
    }
  } else if (t < T_KO) {
    x = X_ATK;
    const u = seg(t, T_POST_IDLE, T_KO);
    const breath = Math.sin(u * TAU * 2.0);
    sq = -0.08 * breath;
    slosh = 0.03 * Math.sin(u * TAU * 2.0 - 0.6);
    mouthOpen = 0.58 + 0.07 * breath;
    eyeMode = "derpy";
  } else {
    x = X_ATK;
    const koAge = t - T_KO;
    const slump = ease.outBack(clamp(koAge / 0.28), 1.2);
    sq = lerp(0, -0.40, slump);
    slosh = 0.14 * Math.exp(-koAge * 4.2) * Math.sin(koAge * 30);
    lean = -0.18 * slump;
    mouthOpen = 0.86 * slump;
    tongueOut = ease.outBack(clamp((koAge - 0.05) / 0.26), 1.35);
    eyeMode = "white";
    shellCrack = smooth(T_KO + 0.16, T_RUPTURE, t);
    popped = t >= T_RUPTURE;
  }

  return {
    x,
    y,
    sq,
    slosh,
    lean,
    mouthOpen,
    cheekPuff,
    nebBoost,
    patPhase,
    patBeat,
    eyeMode,
    tongueOut,
    bellyCharge,
    shellCrack,
    popped,
    legExtend,
    firing,
  };
}

// Helper to draw an organic bent frog hind leg (thigh -> sharp knee angle -> shin -> splayed webbed foot!)
function drawBentFrogLeg(g, hipX, hipY, kneeX, kneeY, footX, footY, hiCol, midCol, darkCol, alpha) {
  // Muscular upper thigh (thick oval-tapered)
  g.line(hipX, hipY, kneeX, kneeY, midCol, alpha);
  g.line(hipX, hipY - 1, kneeX, kneeY - 1, hiCol, alpha);
  g.line(hipX, hipY + 1, kneeX, kneeY + 1, darkCol, alpha);
  g.line(hipX + 1, hipY, kneeX + 1, kneeY, midCol, alpha);
  // Crisp knee cap joint
  g.set(Math.round(kneeX), Math.round(kneeY - 1), hiCol, alpha);
  // Lower shin angled clearly downward/backward
  g.line(kneeX, kneeY, footX, footY, midCol, alpha);
  g.line(kneeX, kneeY - 1, footX, footY - 1, hiCol, alpha);
  g.line(kneeX - 1, kneeY + 1, footX - 1, footY + 1, darkCol, alpha);
  // 3 distinctly splayed frog webbed toes
  const ang = Math.atan2(footY - kneeY, footX - kneeX);
  for (const da of [-0.52, 0, 0.52]) {
    const tx = footX + Math.cos(ang + da) * 4.5;
    const ty = footY + Math.sin(ang + da) * 4.5;
    g.line(footX, footY, tx, ty, da === 0 ? hiCol : midCol, alpha);
  }
}

// Plump 46x30 Cosmic Jelly Frog with dark gaping abyssal mouth (NO permanent pink tongue patch!) and full 4 limbs!
function drawStarryFrog(g, p, pz, C, N, TG, GD, t) {
  g.clear();
  if (pz.popped) return { cx: pz.x, cy: pz.y - 13, mouthX: pz.x + 17, mouthY: pz.y - 17 };

  const W = 46 / Math.sqrt(Math.max(0.42, 1 + pz.sq));
  const H = 30 * (1 + pz.sq);
  const rx = W * 0.50;
  const ry = H * 0.50;
  const cyBody = -ry;
  const spin = t * 1.95;

  const nebCx = -3.0 + pz.bellyCharge * 8.0;
  const nebCy = cyBody + 3.2 - pz.bellyCharge * 3.5;
  const nebRx = rx * (0.58 - 0.14 * pz.bellyCharge);
  const nebRy = ry * (0.58 - 0.10 * pz.bellyCharge);

  const inFrog = (x, y) => {
    const v = clamp(-y / Math.max(4, H), 0, 1);
    const waveSlosh = pz.slosh * Math.sin(v * Math.PI * 1.5) * 6.5;
    const lx = x - waveSlosh - pz.lean * v * 8.5;

    const pearW = rx * (1.08 - 0.20 * v * v);
    if ((lx / pearW) ** 2 + ((y - cyBody) / ry) ** 2 <= 1.0) return true;

    // Rounded chubby frog snout (`y ≈ -17`)
    if (((lx - rx * 0.54) / (6.8 + 1.2 * pz.mouthOpen)) ** 2 + ((y + H * 0.58) / 6.2) ** 2 <= 1.0) return true;

    // Bulging frog throat & side cheeks (`腮帮子鼓得巨大`) — contoured pear cheeks instead of flat bright circles
    if (pz.cheekPuff > 0.04) {
      const cr = 6.0 + 9.2 * pz.cheekPuff;
      const cxFront = 7.5 + 3.5 * pz.cheekPuff;
      const cyFront = -H * 0.48;
      if (((lx - cxFront) / (cr * 1.12)) ** 2 + ((y - cyFront) / (cr * 0.96)) ** 2 <= 1.0) return true;
      const cxBack = -6.0 - 2.5 * pz.cheekPuff;
      if (((lx - cxBack) / (cr * 0.98)) ** 2 + ((y - cyFront) / (cr * 0.92)) ** 2 <= 1.0) return true;
    }

    // Twin cute frog eye domes
    for (const ex of [-3.5, 9.5]) {
      if ((lx - ex) ** 2 + (y + H - 0.5) ** 2 <= 4.8 ** 2) return true;
    }
    return false;
  };

  const x0 = -Math.ceil(rx + 24), x1 = Math.ceil(rx + 26);
  const y0 = -Math.ceil(H + 14), y1 = 16;

  g.shade(x0, y0, x1, y1, (x, y, out) => {
    if (!inFrog(x, y)) return 0;
    out.t = 1;
    out.a = 0.88;
    return C[2];
  });

  g.depths(6);

  g.recolor((x, y, col, al, tag) => {
    if (tag !== 1) return col;
    const idx = g.idx(x, y);
    const px = x + 0.5, py = y + 0.5;
    const d = g.depth(x, y);
    const v = clamp(-py / Math.max(4, H), 0, 1);

    let c = C[2];
    let a = 0.72 + 0.08 * (1 - v);

    if (d === 1) {
      c = px < 2 && v > 0.24 ? C[5] : v < 0.2 ? C[1] : C[3];
      a = 0.92;
    } else if (d === 2) {
      c = px < 0 && v > 0.28 ? C[4] : C[2];
      a = 0.84;
    } else {
      const dx = (px - nebCx) / Math.max(4, nebRx);
      const dy = (py - nebCy) / Math.max(4, nebRy);
      const nr = Math.hypot(dx, dy);
      const na = Math.atan2(dy, dx);

      if (nr < 1.12) {
        const spiral = na - spin - nr * 4.5;
        const armWave = Math.cos(spiral * 2);
        const subWave = Math.sin(spiral * 2 - nr * 2.5);
        const wisp = lnoise(t, 3.0, 3, nr * 2.0 + na * 0.5, 7) * 0.18;
        const amp = (0.52 + 0.48 * armWave + 0.22 * subWave + wisp) * (1 - nr * 0.45) + pz.nebBoost * 0.42;

        if (nr < 0.24) {
          c = pz.nebBoost > 0.30 ? WHITE : armWave > 0 ? N[5] : N[4];
          a = 0.96;
        } else if (amp > 0.48) {
          const isMagenta = Math.cos(spiral) > -0.1;
          if (pz.nebBoost > 0.45 && amp > 0.74) c = N[5];
          else if (isMagenta) c = amp > 0.70 ? N[4] : amp > 0.55 ? N[3] : N[2];
          else c = amp > 0.70 ? C[6] : amp > 0.55 ? C[5] : C[4];
          a = 0.90;
        } else if (amp > 0.28) {
          c = subWave > 0 ? N[1] : C[3];
          a = 0.80;
        } else {
          c = N[0];
          a = 0.74;
        }

        if (pz.patBeat > 0.15) {
          const patRing = Math.abs(nr - (0.35 + (1 - pz.patBeat) * 0.55));
          if (patRing < 0.14) {
            c = C[6];
            a = 0.95;
          }
        }
      } else {
        c = v > 0.65 ? C[3] : C[2];
        a = 0.78;
      }
    }

    // Swelling puffed-cheek cosmic pressure glow (`腮帮子鼓得巨大`) — smooth fluid lnoise nebula currents rushing into mouth (NO sine polka-dot grid!)
    if (pz.cheekPuff > 0.20 && d >= 2) {
      const cd = Math.hypot((px - 8) / (12 * pz.cheekPuff + 4), (py + H * 0.48) / (9.5 * pz.cheekPuff + 3));
      if (cd < 0.96) {
        const flow = lnoise(t * 2.2, 2.4, 2, px * 0.14 - t * 2.5, py * 0.14);
        const energy = clamp(1 - cd) + flow * 0.28;
        if (energy > 0.85 && pz.cheekPuff > 0.55) c = N[5];
        else if (energy > 0.62) c = N[4];
        else if (energy > 0.42) c = N[3];
        else if (energy > 0.24) c = N[2];
        else c = C[4];
        a = 0.88;
      }
    }

    if ((d === 2 || d === 3) && px < -4 && v > 0.44 && v < 0.88) {
      const wave = 0.5 + 0.5 * Math.sin(v * 7.0 - t * 3.8);
      if (wave > 0.42) {
        c = d === 2 && wave > 0.72 ? WHITE : C[6];
        a = 0.95;
      }
    }

    if (pz.shellCrack > 0.08 && d >= 2) {
      const cr = Math.abs(Math.sin(px * 0.42 + py * 0.50 + 1.2) + Math.cos(px * 0.30 - py * 0.38));
      if (cr < 0.26 * pz.shellCrack) {
        c = pz.shellCrack > 0.60 ? WHITE : C[6];
        a = 1.0;
      }
    }

    g.a[idx] = a;
    return c;
  });

  // Twinkling inner stars
  for (let i = 0; i < INNER_STARS.length; i++) {
    const st = INNER_STARS[i];
    const a = st.a0 + spin * (i % 2 === 0 ? 0.5 : -0.5);
    const sx = Math.round(nebCx + Math.cos(a) * nebRx * st.r);
    const sy = Math.round(nebCy + Math.sin(a) * nebRy * st.r);
    if (g.depth(sx, sy) < 3) continue;
    const tw = 0.5 + 0.5 * Math.sin(t * st.freq * 2.2 + st.ph * TAU);
    const col = st.c === 0 ? N[5] : st.c === 1 ? C[6] : GD[2];
    if (tw > 0.62) g.set(sx, sy, WHITE, 1);
    else if (tw > 0.22) g.set(sx, sy, col, 0.94);
  }

  // Happy rosy cheek blush ONLY during belly-pat burp
  if (pz.eyeMode === "happy") {
    g.set(11, -13, TG[2], 0.82);
    g.set(12, -13, TG[2], 0.82);
  }

  // BOTH Frog Hind Legs (`双后腿` separated with distinct Z-knee bends!) & BOTH Front Paws!
  if (pz.legExtend > 0.18) {
    const ext = pz.legExtend;
    // Far/belly-side hind leg: bends steeply DOWNWARD under body (`knee -> downward kick`) so it is 100% separated from the upper leg!
    drawBentFrogLeg(
      g,
      -rx * 0.18, -3,
      -rx * 0.56 - 2 * ext, 3 + 2 * ext,
      -rx * 0.92 - 6 * ext, 10 * ext + 2,
      C[4], C[2], C[1], 0.96
    );
    // Near/back-side hind leg: arcs UP at the knee then kicks OUT backward & slightly downward!
    drawBentFrogLeg(
      g,
      -rx * 0.54, -7,
      -rx * 0.98 - 2 * ext, -10,
      -rx * 1.28 - 8 * ext, -1 + 2 * ext,
      C[5], C[3], C[1], 0.98
    );
    // BOTH plump front arms reaching eagerly forward in mid-jump!
    g.line(rx * 0.68, -9, rx * 0.96, -3, C[3], 0.95);
    g.line(rx * 0.72, -9, rx * 0.98, -4, C[4], 0.95);
    g.line(rx * 0.44, -7, rx * 0.68, 0, C[4], 0.98);
    g.line(rx * 0.44, -8, rx * 0.70, -1, C[5], 0.98);
    g.set(Math.round(rx * 0.72), 0, C[6], 0.98);
    g.set(Math.round(rx * 0.99), -3, C[5], 0.96);
  } else {
    // Grounded folded hind legs (both near thigh + subtle far foot peeking beside front haunch!)
    g.ellipse(-rx * 0.72, -3.5, 5.4, 3.5, (nx, ny) => (ny < 0 ? C[4] : C[2]), 0.94);
    g.line(-rx * 0.92, -1, -rx * 1.04, 0, C[3], 0.94);
    // Far tucked front foot slightly ahead
    if (pz.y >= -1) {
      g.line(rx * 0.76, -5, rx * 0.86, 0, C[2], 0.92);
      g.set(Math.round(rx * 0.88), 0, C[3], 0.92);
    }
  }

  // Goofy Deep Cosmic Abyssal Open Mouth (`呆呆张大嘴`: deep dark indigo cavity + lower jelly chin — NO permanent pink tongue spot!)
  const mx = Math.round(rx * 0.44);
  const my = Math.round(-H * 0.54);
  if (pz.mouthOpen > 0.14) {
    const mw = Math.round(3.6 + 2.2 * pz.mouthOpen);
    const mh = Math.round(1.6 + 2.4 * pz.mouthOpen);
    for (let dy = -mh; dy <= mh; dy++) {
      for (let dx = -mw * 0.45; dx <= mw; dx++) {
        const nd = (dx / (mw + 0.4)) ** 2 + (dy / (mh + 0.4)) ** 2;
        if (nd <= 1.0) {
          let inner;
          if (pz.firing) {
            inner = nd < 0.45 ? WHITE : N[4];
          } else if (pz.eyeMode === "alert") {
            // Subtle dark violet inner mouth right before snapping tongue
            inner = dy > 0 ? N[1] : C[0];
          } else {
            // Deep cosmic navy-indigo dark gaping maw (`深幽大嘴空腔`) — zero pink tongue look!
            inner = nd < 0.55 ? C[0] : C[1];
          }
          g.set(mx + Math.round(dx), my + dy, inner, 0.96);
        }
      }
    }
    // Soft translucent blue upper & lower lip rim (`嘴巴轮廓`)
    if (!pz.firing) {
      for (let dx = -1; dx <= mw; dx++) {
        g.set(mx + dx, my + mh + 1, C[5], 0.96);
        g.set(mx + dx, my - mh - 1, C[4], 0.92);
      }
      g.set(mx + mw + 1, my, C[4], 0.94);
    }
  } else if (pz.cheekPuff > 0.35) {
    // Tight pinched pursed O-mouth sucking cosmic wind
    g.set(mx + 4, my, C[0], 0.96);
    g.set(mx + 5, my, C[5], 0.96);
  }

  // Expressive eyes
  const ey = Math.round(-H + 0.5);
  for (const ex of [-3.5, 9.5]) {
    const ix = Math.round(ex);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy > 5.8) continue;
        if (pz.eyeMode === "white") g.set(ix + dx, ey + dy, dy < 1 ? WHITE : C[6], 0.98);
        else if (pz.eyeMode === "happy") g.set(ix + dx, ey + dy, C[1], 0.96);
        else g.set(ix + dx, ey + dy, pz.eyeMode === "alert" ? GD[3] : WHITE, 0.98);
      }
    }
    if (pz.eyeMode === "derpy") {
      const pxShift = ex < 0 ? 1 : -1;
      g.set(ix + pxShift, ey, C[0], 1);
      g.set(ix + pxShift, ey + 1, C[0], 1);
      g.set(ix - 1, ey - 1, WHITE, 1);
    } else if (pz.eyeMode === "alert") {
      g.set(ix, ey, WHITE, 1);
      g.set(ix + 1, ey, GD[2], 1);
      g.set(ix - 1, ey - 1, WHITE, 1);
    } else if (pz.eyeMode === "happy") {
      g.set(ix - 1, ey, WHITE, 1);
      g.set(ix, ey - 1, WHITE, 1);
      g.set(ix + 1, ey, WHITE, 1);
    } else if (pz.eyeMode === "fierce") {
      g.set(ix, ey, WHITE, 1);
      g.set(ix + 1, ey, N[4], 1);
      g.set(ix - 1, ey - 1, N[5], 1);
    } else if (pz.eyeMode === "white") {
      g.set(ix, ey - 2, C[3], 0.9);
    }
  }

  g.outline((ox, oy, nx, ny) => (ny < 0 && nx <= 0 ? C[5] : C[1]), 0.96);

  // Foreground arm: belly-patting jelly paw during quirk, OR grounded supporting front foot
  if (pz.patPhase > 0.02 && pz.patPhase < 0.95) {
    const pawX = Math.round(3 + 3.0 * (1 - pz.patBeat));
    const pawY = Math.round(-7 - 4.5 * (1 - pz.patBeat));
    g.line(rx * 0.56, -7, pawX, pawY, C[4], 0.98);
    g.line(rx * 0.56, -6, pawX, pawY + 1, C[2], 0.98);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dy * dy > 4.5) continue;
        const border = Math.abs(dx) === 2 || Math.abs(dy) === 2;
        g.set(pawX + dx, pawY + dy, border ? C[1] : dx + dy < 0 ? WHITE : C[5], 0.98);
      }
    }
  } else if (pz.y >= -1 && pz.legExtend <= 0.18) {
    g.line(rx * 0.50, -6, rx * 0.66, 0, C[3], 0.96);
    g.set(Math.round(rx * 0.66) + 1, 0, C[4], 0.96);
  }

  g.draw(p, 1, Math.round(pz.x), Math.round(pz.y));

  // Soft volumetric nebula & jelly body glow (subtle during inhale so no plain white orb sits over cheeks!)
  p.glow(pz.x + nebCx, pz.y + nebCy, 20 + 11 * pz.nebBoost, pz.nebBoost > 0.25 ? N[5] : N[3], 0.34 + 0.42 * pz.nebBoost);
  p.glow(pz.x, pz.y + cyBody, 30, C[4], 0.22);

  if (pz.eyeMode === "alert") {
    p.glow(pz.x + 9.5, pz.y + ey, 11, GD[2], 0.72);
    sparkle(p, pz.x + 9.5, pz.y + ey - 2, 3.8, WHITE, GD[3], 0.90);
  }

  // Belly-pat ripple wave over tummy
  if (pz.patBeat > 0.24) {
    const rPat = 4 + 7 * (1 - pz.patBeat);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * TAU;
      p.blend(pz.x + 2 + Math.cos(a) * rPat, pz.y - 9 + Math.sin(a) * rPat * 0.75, C[6], pz.patBeat * 0.78);
    }
  }

  // Glowing Drool: soft shimmering aqua-cyan dew bead clinging at mouth corner & dripping down periodically (`流着发光的口水`)
  if ((t < T_QUIRK + 0.24 || (t >= T_POST_IDLE + 0.15 && t < T_KO)) && pz.y >= -1) {
    const droopLen = 2.5 + 1.8 * Math.sin(t * 4.5);
    const dxLip = pz.x + mx + 3;
    const dyLip = pz.y + my + 3;
    for (let s = 0; s <= droopLen; s++) {
      const yy = Math.min(-1, dyLip + s);
      p.blend(dxLip + Math.sin(s * 0.7) * 0.4, yy, s > droopLen - 1.2 ? WHITE : C[6], 0.85);
    }
    const dripPhase = (t * 1.45) % 1;
    const dropY = lerp(dyLip + 2.5, -0.5, dripPhase * dripPhase);
    p.disc(dxLip, dropY, 1.1, C[5], 0.85);
    p.blend(dxLip, dropY - 0.3, WHITE, 0.92);
    p.glow(dxLip, dropY, 5.0, C[5], 0.44);
    if (dripPhase > 0.82) {
      const rRing = (dripPhase - 0.82) / 0.18;
      const rxD = 1.4 + 4.8 * rRing;
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        p.blend(dxLip + Math.cos(a) * rxD, Math.sin(a) * rxD * 0.28, C[6], (1 - rRing) * 0.82);
      }
    }
  }

  // Long floppy neon-pink tongue on KO (`倒地时吐出长长的舌头`)
  if (pz.tongueOut > 0.05) {
    const tLen = 28 * pz.tongueOut;
    const sx = pz.x + mx + 2;
    const sy = pz.y + my + 2;
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      const tx = sx + u * tLen;
      const ty = Math.min(0.5, sy + Math.pow(u, 0.72) * (0 - sy) + Math.sin(u * Math.PI * 1.8) * 1.6);
      p.line(tx, ty - 1.5, tx, ty + 1.5, u > 0.82 ? TG[3] : TG[2]);
      p.px(Math.round(tx), Math.round(ty - 1), TG[3]);
    }
    p.glow(sx + tLen * 0.82, 0, 8, TG[2], 0.42);
  }

  return {
    cx: pz.x,
    cy: pz.y + cyBody,
    mouthX: pz.x + mx + 5,
    mouthY: pz.y + my,
  };
}

// Organic, undulating starry cosmic water ripple crests (`荡漾的星空水波纹` — wavy broken highlights & deep indigo water sheen, NOT stiff oval wireframes!)
function drawOrganicStarryRipples(p, cx, age, C, N, GD, t, isBack) {
  if (age < 0 || age > 0.90) return;
  const SY = 0.24;
  if (isBack) {
    const uPud = clamp(age / 0.80);
    const rxPud = lerp(16, 48, ease.outCubic(uPud));
    shadow(p, cx, 1, rxPud, rxPud * SY, C[1], 0.62 * (1 - uPud));
    shadow(p, cx, 1, rxPud * 0.72, rxPud * 0.72 * SY, N[2], 0.36 * (1 - uPud));
    p.glow(cx, 1, rxPud * 0.85, C[5], 0.26 * (1 - uPud));
    // Twinkling reflected stars inside the starry puddle!
    for (let i = 0; i < 8; i++) {
      const a = i * 1.9 + 0.5;
      const r = rxPud * (0.25 + 0.55 * ((i * 0.37) % 1));
      const sx = cx + Math.cos(a) * r;
      const sy = 1 + Math.sin(a) * r * SY;
      const tw = 0.5 + 0.5 * Math.sin(t * 14 + i * 2.1);
      p.blend(sx, sy, tw > 0.6 ? WHITE : i % 2 ? N[5] : GD[3], (1 - uPud) * 0.88);
    }
  }

  const waves = [
    { delay: 0.00, dur: 0.78, r0: 15, r1: 54, c0: C[4], c1: C[6] },
    { delay: 0.14, dur: 0.72, r0: 10, r1: 36, c0: N[3], c1: N[5] },
  ];
  for (let w = 0; w < waves.length; w++) {
    const wa = age - waves[w].delay;
    if (wa < 0 || wa >= waves[w].dur) continue;
    const u = wa / waves[w].dur;
    const rx = lerp(waves[w].r0, waves[w].r1, ease.outCubic(u));
    const fade = (1 - u) * Math.min(1, u * 12);
    const steps = Math.max(36, Math.ceil(rx * 5.0));
    const halfT = (1.6 - w * 0.4) * (1 - u * 0.45);
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU;
      const sinA = Math.sin(a);
      if ((isBack && sinA >= 0) || (!isBack && sinA < 0)) continue;
      // Organic ripple modulation: crest gaps & fluid wobble so it looks like rippling liquid starlight, not a geometric ellipse!
      const crest = 0.5 + 0.5 * Math.sin(a * 5 + u * 8 + w * 2.2);
      if (crest < 0.22) continue;
      const wobble = 1.4 * Math.sin(a * 6 - t * 12 + w);
      const rLocal = rx + wobble;
      const cosA = Math.cos(a);
      const frontGain = (isBack ? 0.55 : 1.0) * (0.55 + 0.45 * crest);
      for (let dr = -halfT; dr <= halfT; dr += 0.5) {
        const radFrac = Math.abs(dr) / Math.max(0.5, halfT);
        const px = cx + cosA * (rLocal + dr);
        const py = 1 + sinA * (rLocal * SY + dr * SY);
        const col = radFrac < 0.3 && crest > 0.78 ? WHITE : radFrac < 0.45 ? waves[w].c1 : waves[w].c0;
        p.blend(px, py, col, fade * frontGain * (1 - radFrac * 0.7));
      }
    }
  }
}

// Swirling Cosmic Vortex Inhale (`蓄力涡旋聚能`) — dynamic curved spiral wind streams + cross-flare (NO boring plain circles!)
function drawVortexInhale(p, mx, my, uCharge, t, C, N, GD) {
  const pulse = ease.inOutSine(clamp(uCharge));
  if (pulse <= 0.05) return;

  // 6 spiraling cosmic energy tendrils rushing inward along curved Archimedean spirals straight into the mouth!
  for (let i = 0; i < 6; i++) {
    const phase = (i / 6 + t * 1.85) % 1;
    const baseAngle = (i / 6) * TAU + t * 4.5;
    const maxR = lerp(42, 22, pulse);
    for (let s = 0; s < 14; s++) {
      const sf = s / 13;
      const dist = lerp(maxR, 3, sf);
      const ang = baseAngle + sf * 1.9;
      const sx = mx + Math.cos(ang) * dist;
      const sy = my + Math.sin(ang) * dist * 0.72;
      const col = sf > 0.78 ? WHITE : i % 3 === 0 ? N[4] : i % 3 === 1 ? C[6] : GD[3];
      const a = Math.sin(sf * Math.PI) * pulse * 0.92;
      p.blend(sx, sy, col, a);
    }
  }

  // Sharp twinkling astral diamond core at mouth tip (NOT a big blurry ball!)
  const fSize = 6 + 9 * pulse + Math.sin(t * 48) * 1.8;
  flare(p, mx, my, fSize, pulse, [N[3], N[5], C[6], WHITE]);
  p.glow(mx, my, 15 * pulse, N[4], 0.48 * pulse);
}

// Galaxy Energy Torrent + Meteor Shards + Shattering Starburst Impact
function drawGalaxyTorrent(p, sx, sy, t, C, N, GD, meteorShards) {
  if (t < T_BEAM_ON || t > T_BEAM_OFF) return;
  const env =
    t < T_BEAM_ON + 0.08
      ? (t - T_BEAM_ON) / 0.08
      : t > T_BEAM_OFF - 0.14
        ? (T_BEAM_OFF - t) / 0.14
        : 1;
  if (env <= 0.02) return;

  const L = X_HIT - sx;
  const W = 7.8 * env;
  const LV = [WHITE, GD[3], N[4], N[3], C[5], C[2]];

  for (let d = 0; d <= L; d += 0.5) {
    const x = sx + d;
    const w = W * (1 + 0.15 * Math.sin(d * 0.28 - t * 28)) * Math.min(1, (d + 3) / 7);
    const pulse = ((d * 0.032 - t * 4.0) % 1 + 1) % 1 < 0.08 ? 1 : 0;
    for (let q0 = -w * 1.25; q0 <= w * 1.25; q0 += 0.5) {
      const q = Math.abs(q0) / Math.max(0.5, w);
      let lv = q < 0.15 ? 0 : q < 0.30 ? 1 : q < 0.52 ? 2 : q < 0.74 ? 3 : q < 0.96 ? 4 : 5;
      lv = Math.max(0, lv - pulse);
      const a = lv === 5 ? clamp((1.25 - q) / 0.28) * env * 0.72 : env;
      p.blend(x, sy + q0, LV[lv], a);
    }
    for (let s = 0; s < 3; s++) {
      const a = d * 0.15 - t * 22 + (s * TAU) / 3;
      if (Math.cos(a) > -0.1) {
        const off = Math.sin(a) * w * 1.18;
        p.blend(x, sy + off, Math.cos(a) > 0.55 ? WHITE : s === 0 ? GD[3] : C[6], env * 0.95);
      }
    }
    if ((Math.round(d * 2) & 15) === 0) p.glow(x, sy, w * 2.0 + 4, N[3], 0.16 * env);
  }

  for (const ms of meteorShards) {
    const prog = ((t - T_BEAM_ON) * ms.speed + ms.phase) % 1;
    const mx = sx + prog * L;
    const my = sy + ms.yOff + Math.sin(prog * 9 + ms.phase * 6) * ms.amp;
    const tailLen = ms.len * (0.75 + 0.25 * env);
    for (let k = 0; k <= 16; k++) {
      const u = k / 16;
      const tx = mx - u * tailLen;
      if (tx < sx - 2) continue;
      const ty = my - u * ms.vyDrift;
      const col =
        u < 0.18
          ? WHITE
          : u < 0.44
            ? ms.kind === 0
              ? GD[3]
              : ms.kind === 1
                ? N[5]
                : C[6]
            : ms.kind === 0
              ? GD[2]
              : ms.kind === 1
                ? N[3]
                : C[4];
      p.blend(tx, ty, col, (1 - u) * env);
      if (u < 0.35) p.blend(tx, ty + (k % 2 ? 0.5 : -0.5), col, (1 - u) * env * 0.6);
    }
    const headCol = ms.kind === 0 ? GD[3] : ms.kind === 1 ? N[5] : C[6];
    p.px(Math.round(mx), Math.round(my), WHITE);
    p.px(Math.round(mx - 1), Math.round(my), headCol);
    p.px(Math.round(mx + 1), Math.round(my), headCol);
    p.px(Math.round(mx), Math.round(my - 1), headCol);
    p.px(Math.round(mx), Math.round(my + 1), headCol);
    p.glow(mx, my, 9, ms.kind === 0 ? GD[2] : N[4], 0.44 * env);
  }

  flare(p, sx, sy, 14 * env, env, [N[2], N[4], C[6], WHITE]);
  p.glow(sx, sy, 22, N[4], 0.58 * env);

  // Shattering 360-degree Starburst Impact (`撞击时星辰炸裂`)
  const ir = (5.5 + Math.sin(t * 36) * 1.0) * env;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + t * 4.5 + Math.sin(t * 16 + i) * 0.12;
    const rayL = (14 + 16 * Math.abs(noise(t * 10, i * 17))) * env;
    p.line(
      X_HIT,
      sy,
      X_HIT + Math.cos(a) * rayL,
      sy + Math.sin(a) * rayL,
      (u) => (u < 0.35 ? WHITE : i % 3 === 0 ? GD[3] : i % 3 === 1 ? N[4] : C[6]),
      env
    );
  }
  p.disc(X_HIT, sy, ir + 2.5, N[3], env * 0.85);
  p.disc(X_HIT, sy, ir + 0.6, C[6], env * 0.95);
  p.disc(X_HIT, sy, ir * 0.55, WHITE, env);
  flare(p, X_HIT, sy, 26 * env, env, [N[2], N[4], GD[3], WHITE]);
  p.glow(X_HIT, sy, 36, N[4], 0.65 * env);
  p.glow(X_HIT, sy, 16, WHITE, 0.55 * env);
}

export function create(o) {
  const C = fit(o.palette, 8);
  const N = fit(o.nebula, 6);
  const TG = fit(o.tongue, 4);
  const GD = fit(o.gold, 4);
  const R = new Rng(o.seed);
  const floor = () => 0;

  const [W, H_CANVAS] = meta.size;
  const [OX, OY] = meta.origin;
  const X0 = -OX + 4, X1 = W - OX - 4, Y0 = -OY + 4, Y1 = H_CANVAS - OY - 4;

  const ps = new Particles({
    rng: R,
    ground: floor,
    sparks: [WHITE, GD[3], N[4], C[6]],
    haze: N[3],
  });
  const lights = new Lights();
  const frogGrid = new Grid(-48, -48, 96, 68);

  const meteorShards = Array.from({ length: 20 }, (_, i) => ({
    phase: i / 20 + R.range(0, 0.04),
    speed: R.range(1.75, 2.75),
    yOff: (i % 2 === 0 ? 1 : -1) * R.range(4, 16),
    amp: R.range(-3.5, 3.5),
    len: R.range(14, 28),
    vyDrift: R.range(-3.5, 3.5),
    kind: i % 3,
  }));

  const jellyChunks = Array.from({ length: 12 }, (_, i) => {
    const a = -Math.PI / 2 + lerp(-1.40, 1.40, i / 11) + R.range(-0.08, 0.08);
    const spd = R.range(40, 84);
    return {
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - 16,
      r: R.range(2.8, 4.4),
      c: i % 2 === 0 ? C[4] : C[5],
    };
  });

  const fireworkBursts = [
    {
      t0: T_RUPTURE + 0.30,
      fx: X_ATK - 6,
      fy: -54,
      col1: N[5],
      col2: GD[3],
      spokes: Array.from({ length: 18 }, (_, i) => ({
        a: (i / 18) * TAU + R.range(-0.08, 0.08),
        r: R.range(18, 30),
        c: i % 2,
      })),
    },
    {
      t0: T_RUPTURE + 0.56,
      fx: X_ATK + 12,
      fy: -76,
      col1: C[6],
      col2: N[4],
      spokes: Array.from({ length: 22 }, (_, i) => ({
        a: (i / 22) * TAU + R.range(-0.08, 0.08),
        r: R.range(20, 34),
        c: i % 2,
      })),
    },
    {
      t0: T_RUPTURE + 0.80,
      fx: X_ATK + 2,
      fy: -94,
      col1: GD[3],
      col2: N[5],
      spokes: Array.from({ length: 16 }, (_, i) => ({
        a: (i / 16) * TAU + R.range(-0.08, 0.08),
        r: R.range(16, 26),
        c: i % 2,
      })),
    },
  ];

  const burpBubbles = [
    { t0: 3.30, dur: 0.72, vx: 12, vy: -26, r: 3.6, col: N[4] },
    { t0: 3.48, dur: 0.76, vx: 18, vy: -32, r: 4.2, col: C[6] },
    { t0: 3.68, dur: 0.74, vx: 10, vy: -28, r: 3.2, col: N[5] },
  ];

  let t = 0;
  let moteTrailAcc = 0;
  let gulpFlashDone = false;
  let chargeAcc = 0;
  let beamHitAcc = 0;
  let ruptureDone = false;
  const landedHops = new Set();
  const poppedBurps = new Set();
  const firedBursts = new Set();

  return {
    update(dt) {
      t += dt;

      const gm = goldenMoteAt(t);
      if (gm && !gm.caught) {
        moteTrailAcc += dt * 42;
        while (moteTrailAcc >= 1) {
          moteTrailAcc -= 1;
          ps.spawn(P.STAR, gm.x + R.range(-2, 2), gm.y + R.range(-2, 2), R.range(-8, 8), R.range(-8, 8), R.range(0.28, 0.48), R.pick([WHITE, GD[3], GD[2]]), R.range(0.6, 1.2));
        }
      }

      if (!gulpFlashDone && t >= T_GULP) {
        gulpFlashDone = true;
        lights.add(X_IDLE - 2, -13, 38, GD[3], 0.88, 0.32);
        for (let i = 0; i < 14; i++) {
          const a = R.range(0, TAU);
          ps.spawn(P.STAR, X_IDLE - 2, -13, Math.cos(a) * R.range(18, 48), Math.sin(a) * R.range(14, 42) - 10, R.range(0.32, 0.62), R.pick([WHITE, N[5], GD[3]]), R.range(0.7, 1.4));
        }
      }
      for (let i = 0; i < burpBubbles.length; i++) {
        const bb = burpBubbles[i];
        if (!poppedBurps.has(i) && t >= bb.t0 + bb.dur) {
          poppedBurps.add(i);
          const bx = X_IDLE + 22 + bb.vx * bb.dur;
          const by = -18 + bb.vy * bb.dur;
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * TAU + R.range(-0.3, 0.3);
            ps.spawn(P.STAR, bx, by, Math.cos(a) * R.range(12, 26), Math.sin(a) * R.range(12, 26), R.range(0.22, 0.40), R.pick([WHITE, bb.col, GD[3]]), R.range(0.5, 1.0));
          }
        }
      }

      for (let i = 0; i < HOPS.length; i++) {
        const h = HOPS[i];
        if (!landedHops.has(i) && t >= h.tLand) {
          landedHops.add(i);
          lights.add(h.x1, -2, 38, C[5], 0.72, 0.34);
          for (let k = 0; k < 16; k++) {
            const a = -Math.PI / 2 + R.range(-1.35, 1.35);
            const spk = R.range(42, 110);
            ps.spawn(P.SPARK, h.x1 + R.range(-10, 10), -1.5, Math.cos(a) * spk, Math.sin(a) * spk * 0.65, R.range(0.22, 0.45));
          }
          for (let k = 0; k < 8; k++) {
            ps.spawn(P.STAR, h.x1 + R.range(-16, 16), -2, R.range(-36, 36), -R.range(16, 48), R.range(0.32, 0.62), R.pick([WHITE, C[6], N[4]]), R.range(0.6, 1.3));
          }
        }
      }

      if (t >= T_ATK && t < T_BEAM_ON) {
        chargeAcc += dt * 60;
        while (chargeAcc >= 1) {
          chargeAcc -= 1;
          const a = R.range(0, TAU);
          const d = R.range(28, 56);
          const mx = X_ATK + 16, my = -16;
          const sx = mx + Math.cos(a) * d, sy = my + Math.sin(a) * d * 0.72;
          ps.spawn(P.STREAK, sx, sy, (mx - sx) * 4.8, (my - sy) * 4.8, R.range(0.14, 0.24), R.pick([N[4], C[6], GD[3]]), 1);
        }
      }

      if (t >= T_BEAM_ON && t <= T_BEAM_OFF) {
        beamHitAcc += dt * 88;
        while (beamHitAcc >= 1) {
          beamHitAcc -= 1;
          const a = R.range(-1.9, 1.9);
          const spk = R.range(72, 235);
          ps.spawn(P.SPARK, X_HIT, -16, Math.cos(a) * spk, Math.sin(a) * spk - 20, R.range(0.24, 0.50));
          if (R.chance(0.45)) {
            const sa = R.range(0, TAU);
            const ss = R.range(38, 132);
            ps.spawn(P.STAR, X_HIT, -16, Math.cos(sa) * ss, Math.sin(sa) * ss - 14, R.range(0.32, 0.64), R.pick([WHITE, GD[3], N[4], C[6]]), R.range(0.8, 1.9));
          }
        }
      }

      if (!ruptureDone && t >= T_RUPTURE) {
        ruptureDone = true;
        lights.add(X_ATK, -14, 56, N[4], 0.95, 0.42);
        lights.add(X_ATK, -14, 28, WHITE, 0.90, 0.14);
        for (let i = 0; i < 24; i++) {
          const a = -Math.PI / 2 + R.range(-1.45, 1.45);
          const spk = R.range(52, 148);
          ps.spawn(P.SPARK, X_ATK + R.range(-10, 10), -10, Math.cos(a) * spk, Math.sin(a) * spk, R.range(0.28, 0.56));
        }
        for (let i = 0; i < 16; i++) {
          const life = Math.min(R.range(0.75, 1.15), Math.max(0.2, T_END - 0.12 - t));
          ps.spawn(P.VAPOUR, X_ATK + R.range(-8, 8), -14, R.range(-16, 16), -R.range(54, 96), life, R.pick([N[3], N[4], C[5]]), R.range(3.2, 5.4));
        }
      }

      for (let i = 0; i < fireworkBursts.length; i++) {
        const fb = fireworkBursts[i];
        if (!firedBursts.has(i) && t >= fb.t0) {
          firedBursts.add(i);
          lights.add(fb.fx, fb.fy, 48, fb.col1, 0.88, 0.36);
          for (let k = 0; k < 24; k++) {
            const a = (k / 24) * TAU + R.range(-0.1, 0.1);
            const spk = R.range(36, 98);
            const life = Math.min(R.range(0.45, 0.85), Math.max(0.12, T_END - 0.10 - t));
            ps.spawn(P.STAR, fb.fx, fb.fy, Math.cos(a) * spk, Math.sin(a) * spk - 12, life, R.pick([WHITE, fb.col1, fb.col2]), R.range(0.7, 1.7));
          }
        }
      }

      ps.update(dt);
      cullParticles(ps, X0, Y0, X1, Y1);
      lights.update(dt);
    },

    drawBack(p) {
      if (t >= T_END - 0.04) return;
      const pz = frogPoseAt(t);

      if (!pz.popped) {
        const hgt = clamp(-pz.y / 28);
        shadow(p, pz.x, 0.5, 26 * (1 - 0.25 * hgt), 2.8, C[0], 0.54 * (1 - 0.35 * hgt));
      }

      // Organic starry water ripples fade cleanly BEFORE Stage 4 charge starts (`t < T_ATK + 0.10`) so zero stray rings linger around puffed cheeks!
      if (t < T_ATK + 0.12) {
        const rippleFadeOut = t > T_ATK - 0.10 ? clamp(1 - (t - (T_ATK - 0.10)) / 0.22) : 1;
        if (rippleFadeOut > 0.02) {
          for (const h of HOPS) {
            if (t >= h.tLand) drawOrganicStarryRipples(p, h.x1, t - h.tLand, C, N, GD, t, true);
          }
        }
      }

      // Organic ground radial energy scatter under hit target (replacing mechanical thin ring!)
      if (t >= T_BEAM_ON && t < 10.6) {
        const craterFade = t < T_BEAM_OFF ? 1 : clamp(1 - (t - T_BEAM_OFF) / 1.9);
        shadow(p, X_HIT, 0.5, 28 * craterFade, 3.8 * craterFade, N[2], 0.56 * craterFade);
        p.glow(X_HIT, 0, 34 * craterFade, N[4], 0.42 * craterFade);
        if (t <= T_BEAM_OFF) {
          // Jagged floor shockwave splashes along back side of ground crater
          for (let i = 0; i < 6; i++) {
            const a = Math.PI + (i / 5) * Math.PI + Math.sin(t * 20 + i) * 0.18;
            const r = 14 + 22 * ((t * 3.5 + i * 0.2) % 1);
            p.line(X_HIT + Math.cos(a) * (r * 0.5), Math.sin(a) * (r * 0.12), X_HIT + Math.cos(a) * r, Math.sin(a) * (r * 0.25), C[6], 0.72);
          }
        }
      }

      ps.draw(p, "back");
    },

    draw(p) {
      if (t >= T_END - 0.04) return;
      const pz = frogPoseAt(t);

      const anchors = drawStarryFrog(frogGrid, p, pz, C, N, TG, GD, t);

      if (t < T_ATK + 0.12) {
        for (const h of HOPS) {
          if (t >= h.tLand) drawOrganicStarryRipples(p, h.x1, t - h.tLand, C, N, GD, t, false);
        }
      }

      // Rupturing deep-blue jelly shell droplets bursting outward on KO
      if (pz.popped && t < T_RUPTURE + 0.58) {
        const aPop = t - T_RUPTURE;
        const fade = clamp(1 - aPop / 0.58);
        for (const jc of jellyChunks) {
          const jx = X_ATK + jc.vx * aPop;
          const jy = Math.min(0, -14 + jc.vy * aPop + 140 * aPop * aPop);
          const jr = jc.r * (0.4 + 0.6 * fade);
          p.disc(jx, jy, jr, jc.c, 0.85 * fade);
          p.blend(jx - jr * 0.3, jy - jr * 0.3, WHITE, 0.85 * fade);
        }
        if (aPop < 0.26) {
          const u = aPop / 0.26;
          flare(p, X_ATK, -14, 28 * (1 - u), 1 - u, [C[4], N[4], GD[3], WHITE]);
        }
      }

      // Stage 2: Golden light-mote + Neon Pink Tongue Whip + Iridescent Burp Bubbles
      const gm = goldenMoteAt(t);
      if (gm) {
        sparkle(p, gm.x, gm.y, 4.6 + Math.sin(t * 24), WHITE, GD[2], 0.88);
        p.disc(gm.x, gm.y, 2.2, GD[3], 0.96);
        p.disc(gm.x, gm.y, 1.2, WHITE, 1);
        p.glow(gm.x, gm.y, 13, GD[2], 0.72);
      }

      if (t >= T_SNAP && t < T_GULP) {
        const u = seg(t, T_SNAP, T_GULP);
        const reach = Math.sin(Math.min(1, u * 1.15) * Math.PI);
        const mx = anchors.mouthX;
        const my = anchors.mouthY;
        const tx = lerp(mx, X_IDLE + 32, reach);
        const ty = lerp(my, -34, reach);
        const cxMid = lerp(mx, tx, 0.5) + 3 * (1 - reach);
        const cyMid = lerp(my, ty, 0.5) + 4 * reach;
        for (let i = 0; i < 16; i++) {
          const s0 = i / 16, s1 = (i + 1) / 16;
          const p0x = (1 - s0) * (1 - s0) * mx + 2 * (1 - s0) * s0 * cxMid + s0 * s0 * tx;
          const p0y = (1 - s0) * (1 - s0) * my + 2 * (1 - s0) * s0 * cyMid + s0 * s0 * ty;
          const p1x = (1 - s1) * (1 - s1) * mx + 2 * (1 - s1) * s1 * cxMid + s1 * s1 * tx;
          const p1y = (1 - s1) * (1 - s1) * my + 2 * (1 - s1) * s1 * cyMid + s1 * s1 * ty;
          p.line(p0x, p0y, p1x, p1y, TG[2]);
          p.line(p0x, p0y + 1, p1x, p1y + 1, TG[1]);
          p.px(Math.round(p0x), Math.round(p0y - 1), TG[3]);
        }
        p.disc(tx, ty, 2.4, TG[2], 0.98);
        p.px(Math.round(tx), Math.round(ty), TG[3]);
        p.glow(tx, ty, 9, TG[2], 0.58);
      }

      for (const bb of burpBubbles) {
        const ba = t - bb.t0;
        if (ba >= 0 && ba < bb.dur) {
          const bu = ba / bb.dur;
          const bx = X_IDLE + 22 + bb.vx * ba + Math.sin(bu * 9) * 2.5;
          const by = -18 + bb.vy * ba;
          const r = bb.r * Math.min(1, bu * 4.5);
          p.disc(bx, by, r, bb.col, 0.34 * (1 - bu * 0.4));
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * TAU;
            p.blend(bx + Math.cos(a) * r, by + Math.sin(a) * r, WHITE, 0.78 * (1 - bu * 0.3));
          }
          p.px(Math.round(bx - r * 0.35), Math.round(by - r * 0.35), WHITE);
          p.glow(bx, by, r * 2.2, bb.col, 0.28 * (1 - bu));
        }
      }

      // Stage 4A: Swirling Cosmic Vortex Inhale (`蓄力阶段`) — spiral stardust ribbons instead of circular rings!
      if (t >= T_ATK && t < T_BEAM_ON) {
        drawVortexInhale(p, anchors.mouthX, anchors.mouthY, seg(t, T_ATK, T_BEAM_ON), t, C, N, GD);
      }

      // Stage 4B: Galaxy Energy Torrent + Meteor Shards + Floor Jagged Energy Arcs
      drawGalaxyTorrent(p, anchors.mouthX, anchors.mouthY, t, C, N, GD, meteorShards);
      if (t >= T_BEAM_ON && t <= T_BEAM_OFF) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 5) * Math.PI + Math.sin(t * 22 + i) * 0.18;
          const r = 12 + 24 * ((t * 3.5 + i * 0.2) % 1);
          p.line(X_HIT + Math.cos(a) * (r * 0.5), Math.sin(a) * (r * 0.12), X_HIT + Math.cos(a) * r, Math.sin(a) * (r * 0.25), i % 2 ? N[5] : GD[3], 0.85);
        }
      }

      // Stage 5: Dizzy orbiting stars on KO slump
      if (t >= T_KO && !pz.popped) {
        for (let i = 0; i < 3; i++) {
          const a = t * 7.5 + (i * TAU) / 3;
          const sx = X_ATK + 2 + Math.cos(a) * 13;
          const sy = -31 + Math.sin(a) * 3.5;
          sparkle(p, sx, sy, 2.5, WHITE, GD[3], 0.88);
        }
      }

      // Stage 5: Multi-Ray Cosmic Firework Chrysanthemum Blooms
      for (const fb of fireworkBursts) {
        const fa = t - fb.t0;
        if (fa >= 0 && fa < 0.85) {
          const u = fa / 0.85;
          const bloom = ease.outCubic(u);
          const fade = Math.max(0, 1 - u * u);
          for (const sp of fb.spokes) {
            const dist = sp.r * bloom;
            const tailDist = Math.max(0, dist - 7 * (1 - u * 0.6));
            const gravity = 8 * u * u;
            const x0 = fb.fx + Math.cos(sp.a) * tailDist;
            const y0 = fb.fy + Math.sin(sp.a) * tailDist + gravity * 0.4;
            const x1 = fb.fx + Math.cos(sp.a) * dist;
            const y1 = fb.fy + Math.sin(sp.a) * dist + gravity;
            const col = sp.c === 0 ? fb.col1 : fb.col2;
            p.line(x0, y0, x1, y1, (s) => (s > 0.72 ? WHITE : col), fade);
            if (u < 0.75) p.px(Math.round(x1), Math.round(y1), WHITE);
          }
          if (u < 0.32) {
            flare(p, fb.fx, fb.fy, 20 * (1 - u / 0.32), 1 - u / 0.32, [N[2], fb.col1, GD[3], WHITE]);
          }
          p.glow(fb.fx, fb.fy, 26 * bloom + 8, fb.col1, 0.36 * fade);
        }
      }

      ps.draw(p, "front");
      lights.draw(p);
    },
  };
}

function cullParticles(ps, x0, y0, x1, y1) {
  const L = ps.list;
  for (let i = L.length - 1; i >= 0; i--) {
    const q = L[i];
    const r = (q.size || 2) * 1.8 + 4;
    if (q.x - r < x0 || q.x + r > x1 || q.y - r < y0 || q.y + r > y1) {
      L.splice(i, 1);
    }
  }
}
