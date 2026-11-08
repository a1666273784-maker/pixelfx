// The wide-open war-fan reveal: adapted ideas (deep lacquer sheath, huiwen discipline, flare-and-freeze hits) from
// the library's own lacquer ward, and the slash-crescent discipline of Sprite Fusion's open-source effects.
import { Particles, Lights, P, Rng, fit, sparkle, flare, band, clamp, smooth, lerp, seg, ease, TAU, WHITE, READY } from "../../core/index.js";

const D = 2.25;
const OPEN = 0;          // t = 0: the fan snaps open
const HIT_T = 0.1;       // the blast lands on the target
const SHUT = 1.34;       // the fan snaps shut
const PX = 9, PY = -23;  // the fan's pivot, at his front hand
const AXIS = -1.32;      // the fan lifts up and leans into the facing direction
const HALF = 1.02;       // half the fan's opening angle
const FAN_R = 38;
const TARGET_X = 64, TARGET_Y = -27;

export const meta = {
  name: "Lacquer fan",
  desc: "The folded fan snaps open before his face into a gold-ribbed black half-moon with a red sun; a point-blank ring of red and black lacquer spatters the floor and the target.",
  tags: ["melee", "fan", "lacquer", "chinese", "boss", "aoe", "hit", "one-shot"],
  size: [296, 188],
  origin: [148, 162],
  duration: D,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#150507", "#2a090e", "#4a0f16", "#6f1620", "#9c1f26", "#cb3324", "#f0582c", "#ffb15e"],
    gold: ["#33200a", "#63410f", "#9c6f24", "#d1a03a", "#ffd84a", "#fff3b0"],
    ink: ["#070405", "#100a0d", "#1b1114", "#281c1f", "#352723", "#48362e"],
    seed: 5,
    shut: 1.34,
  },
};

const GUARD = { ...READY, weapon: "handle", sa: -0.75, fx: 10, fy: -18, bx: 8, by: -20 };
// he lifts the folded fan before his face until the room is quiet, then it is simply open
const COIL = { ...GUARD, crouch: 6, lean: -3, turn: 0.7, fx: 1, fy: -27, sa: -2.05, bx: 4, by: -23, armsFront: true, ffx: 9, fbx: -9 };
const HIDE = { ...GUARD, crouch: 6, lean: -1, turn: 1.0, fx: 5, fy: -33, sa: -1.45, bx: -2, by: -27, armsFront: true };
const OPENP = { ...GUARD, crouch: 5, lean: 2, turn: 1.15, fx: PX, fy: PY, sa: -1.35, bx: -6, by: -24, ffx: 10, fbx: -10, ghost: 1 };
const HOLD = { ...OPENP, ghost: 0, lean: 3, crouch: 4 };
const SHUTP = { ...GUARD, crouch: 6, lean: 3, fx: 7, fy: -21, sa: -0.9, bx: 4, by: -19 };
export const act = {
  target: { x: TARGET_X },
  poses: [
    [-0.66, GUARD],
    [-0.36, COIL],
    [-0.1, HIDE],
    [0, OPENP, "snap"],
    [0.55, HOLD],
    [1.12, { ...HOLD, lean: 2, crouch: 5 }],
    [SHUT, SHUTP, "snap"],
    [1.56, { ...SHUTP, lean: 1, crouch: 4 }],
    [1.9, { ...GUARD, crouch: 3 }],
    [D, GUARD],
  ],
  hits: [{ t: HIT_T, stop: 0.16, shake: 0.26, amp: 3.6, push: 3.6, straw: 26, skin: "red", y: TARGET_Y }],
  dust: [
    { t: 0.02, x: 6, n: 7, dir: 1 },
    { t: 0.02, x: -8, n: 5, dir: -1 },
    { t: HIT_T, x: 56, n: 8, dir: 1 },
    { t: HIT_T, x: 40, n: 4, dir: -1 },
  ],
};

const RIBS = Array.from({ length: 9 }, (_, k) => -HALF + (k * 2 * HALF) / 8);

// static fan-frame details for one seed: wet-lacquer beads on the black silk, mottle inside the red sun
const fanCache = new Map();
function fanDetails(seed) {
  let d = fanCache.get(seed);
  if (d) return d;
  const R = new Rng(seed * 7 + 3);
  const beads = Array.from({ length: 8 }, () => ({ u: R.range(FAN_R * 0.26, FAN_R * 0.9), a: R.range(-0.74, 0.74) }));
  const mottle = Array.from({ length: 7 }, () => {
    const a = R.range(0, TAU), rr = R.range(1.5, FAN_R * 0.27);
    return { du: Math.cos(a) * rr, dv: Math.sin(a) * rr };
  });
  const jag = Array.from({ length: 12 }, (_, k) => 0.66 + R.range(0.02, 0.52));
  fanCache.set(seed, (d = { beads, mottle, jag }));
  return d;
}

function drawFan(p, t, C, G, K, seed, shut = 1.34) {
  const openK = ease.outBack(clamp(t / 0.17), 2.1);
  const shutK = t < shut ? 0 : ease.inQuad(clamp((t - shut) / 0.12));
  const span = lerp(0.04, HALF, openK) * (1 - shutK) + 0.04 * shutK;
  const Rr = FAN_R * (0.86 + 0.14 * Math.min(1, openK));
  const ax = AXIS + Math.sin(t * 33) * Math.exp(-t * 4.6) * 0.02;
  const c = Math.cos(ax), s = Math.sin(ax);
  const hot = t < 0.05;
  const u0 = FAN_R * 0.58, sunR = FAN_R * 0.335;
  const { beads, mottle } = fanDetails(seed);
  p.shade(Math.floor(PX - Rr - 2), Math.floor(PY - Rr - 2), Math.ceil(PX + Rr + 2), Math.ceil(PY + Rr + 2), (x, y, out) => {
    const dx = x + 0.5 - PX, dy = y + 0.5 - PY;
    const u = dx * c + dy * s, v = -dx * s + dy * c;
    if (u <= 0.4 || u > Rr + 0.45) return;
    const ang = Math.atan2(v, u), aang = Math.abs(ang);
    if (aang > span + 0.008) return;
    const dSun = Math.hypot(u - u0, v);
    // a gold rib under this pixel?
    let rib = false;
    for (const ra of RIBS) {
      if (Math.abs(ra) > span + 0.02) continue;
      if (Math.abs(v - Math.tan(ra) * u) < 0.7 && u > 4.3) { rib = true; break; }
    }
    const edgeRib = aang > span - 0.07 && u > 4.3;
    let col;
    if (dSun < sunR) {
      // blood-red lacquer sun with a wet gloss crescent high on its left cheek
      const q = dSun / sunR;
      col = q < 0.34 ? C[6] : q < 0.62 ? C[5] : q < 0.85 ? C[4] : C[3];
      const gq = Math.atan2(v, u - u0);
      if (dSun > sunR * 0.5 && dSun < sunR * 0.78 && Math.cos(gq - 3.85) > 0.55) col = C[7];
    } else {
      // jet-black wet lacquer: hard steps, one broad specular streak up left,
      // ember bleed from the red sun soaking into the dark half so it never reads as a void
      const sh = (v * 0.82 - u * 0.38) / FAN_R;
      if (sh > 0.155) col = sh > 0.3 ? K[4] : K[5];
      else {
        const b = clamp(1 - (dSun - sunR) / (FAN_R * 1.05), 0, 1);
        col = b > 0.62 ? C[3] : b > 0.3 ? (sh > 0.02 ? K[4] : C[2]) : sh > 0.02 ? K[4] : sh > -0.3 ? K[3] : K[2];
        if (aang > span - 0.18 && sh < 0.02) col = C[3];
      }
      if (dSun < sunR * 1.5) col = sh > 0.02 ? K[4] : K[3];
    }
    if (hot) col = dSun < sunR ? (dSun < sunR * 0.6 ? WHITE : G[5]) : G[4];
    // thin gold ring hugging the sun
    if (Math.abs(dSun - sunR) < 0.72) col = hot ? WHITE : G[3];
    // outer rim: double line of gold
    if (u > Rr - 2.6 && u <= Rr - 2.0) col = hot ? G[5] : G[2];
    else if (u > Rr - 2.0) col = hot ? WHITE : u > Rr - 0.85 ? G[5] : G[3];
    if (rib || edgeRib) col = hot ? WHITE : u > FAN_R * 0.7 ? G[4] : G[3];
    // the brass hub
    if (u < 4.3) col = u < 1.5 ? (hot ? WHITE : G[5]) : u < 2.7 ? G[3] : u < 3.6 ? G[4] : K[0];
    out.c = col;
    out.a = 1;
  });
  // black mottle inside the red sun
  const axv = [PX + c * u0, PY + s * u0], pv = [-s, c];
  for (const m of mottle) {
    const mx = axv[0] + c * m.du + pv[0] * m.dv, my = axv[1] + s * m.du + pv[1] * m.dv;
    const dxm = mx - PX, dym = my - PY, um = dxm * c + dym * s, vm = -dxm * s + dym * c;
    if (um <= 0 || um > Rr) continue;
    if (Math.abs(Math.atan2(vm, um)) > span) continue;
    p.dot(mx, my, K[1], 0.9);
  }
  // wet-lacquer beads scattered on the black field
  for (const b of beads) {
    if (Math.abs(b.a) > span) continue;
    const bx = PX + b.u * Math.cos(ax + b.a), by = PY + b.u * Math.sin(ax + b.a);
    p.dot(bx, by, K[5]);
    p.dot(bx - 0.6, by - 0.6, WHITE, 0.62);
  }
  // the red tassel hanging off the pivot: it kicks out when the fan opens or shuts
  if (shutK < 1) {
    const kick = Math.exp(-Math.abs(t - OPEN) * 2.1) * 0.55 + Math.exp(-Math.abs(t - (shut ?? 1.34)) * 2.6) * 0.7;
    const sway = Math.sin(t * 12.5 + 0.8) * (0.16 + kick) + kick * 0.5;
    const bx = PX + 1.5, by = PY + 2.5;
    p.dot(bx, by, G[3]);
    p.dot(bx + 1, by, G[1]);
    for (const [off, col] of [[-1.4, C[3]], [0, C[5]], [1.4, C[4]]]) {
      const a = Math.PI / 2 + sway + off * 0.16;
      p.line(bx, by + 1, bx + Math.cos(a) * 9, by + 1 + Math.sin(a) * 9, col, 1);
    }
    p.dot(bx + Math.cos(Math.PI / 2 + sway) * 9, by + 1 + Math.sin(Math.PI / 2 + sway) * 9, C[6]);
  }
  // glints running along the rim as it opens
  if (t > 0.05 && t < 0.55) {
    const q = (t - 0.05) / 0.5;
    for (const a of [-0.62, 0.2, 0.78]) {
      if (Math.abs(a) > span) continue;
      const gx = PX + Rr * Math.cos(ax + a), gy = PY + Rr * Math.sin(ax + a);
      p.dot(gx, gy, WHITE, (1 - q) * 0.85);
    }
  }
}

export function create(o) {
  const C = fit(o.palette, 8), G = fit(o.gold, 6), K = fit(o.ink, 6);
  const R = new Rng(o.seed);
  const ps = new Particles({ rng: R, ground: () => 0 });
  const lights = new Lights();
  const drops = [];
  const splats = [];
  const flakes = [];
  const shutT = o.shut ?? SHUT;
  const TX = o.targetX ?? TARGET_X;
  let t = 0, opened = false, hitFx = false, shutFx = false, flakeAcc = 0;
  // the jagged splat that blooms on the target: static pattern for this seed
  const sd = fanDetails(o.seed);
  const jagOut = sd.jag;

  const spawnBurst = () => {
    const Rd = new Rng(o.seed * 1013 + 77);
    for (let i = 0; i < 46; i++) {
      const a = Rd.range(0, TAU);
      const r0 = FAN_R * Rd.range(0.45, 0.95);
      const sp = Rd.range(78, 200);
      const kind = Rd.next();
      drops.push({
        x: PX + Math.cos(a) * r0, y: PY + Math.sin(a) * r0 * 0.92,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 26,
        r: Rd.range(1.0, 2.7), kind,
        delay: Rd.range(0, 0.05), seed: Rd.next() * 997,
      });
    }
    for (let i = 0; i < 5; i++) {
      const a = Rd.range(0, TAU);
      drops.push({
        x: PX + Math.cos(a) * 20, y: PY + Math.sin(a) * 18,
        vx: Math.cos(a) * Rd.range(46, 88), vy: Math.sin(a) * Rd.range(46, 82) - 18,
        r: Rd.range(2.6, 3.5), kind: Rd.next() < 0.5 ? 0.1 : 0.62,
        delay: Rd.range(0, 0.03), seed: Rd.next() * 977,
      });
    }
    // hot gold flecks and dark chips whipped off the arc
    for (let i = 0; i < 12; i++) {
      const a = Rd.range(-1.15, 1.15);
      const sp = Rd.range(120, 275);
      ps.spawn(P.SPARK, PX + Math.cos(a) * 20, PY + Math.sin(a) * 18, Math.cos(a) * sp, Math.sin(a) * sp * 0.72 - 46, Rd.range(0.16, 0.36), G[4]);
    }
    for (let i = 0; i < 8; i++) {
      const a = Rd.range(0, TAU);
      ps.spawn(P.GRIT, PX + Math.cos(a) * 14, PY + Math.sin(a) * 12, Math.cos(a) * Rd.range(90, 190), Math.sin(a) * Rd.range(90, 170) - 30, Rd.range(0.5, 0.9), i % 3 ? K[1] : G[2], i % 4 === 0 ? 2 : 1);
    }
  };
  const spawnHitSplatter = () => {
    const Rd = new Rng(o.seed * 733 + 29);
    for (let i = 0; i < 9; i++) {
      const a = Rd.range(-0.9, 0.9) + (Rd.next() < 0.5 ? 0 : Math.PI);
      const sp = Rd.range(70, 175);
      drops.push({
        x: TX, y: TARGET_Y,
        vx: Math.cos(a) * sp + 26, vy: Math.sin(a) * sp - 48,
        r: Rd.range(0.8, 1.8), kind: Rd.next() < 0.55 ? 0.2 : 0.6,
        delay: Rd.range(0, 0.03), seed: Rd.next() * 991,
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = Rd.range(0, TAU);
      ps.spawn(P.SPARK, TX, TARGET_Y, Math.cos(a) * Rd.range(80, 220), Math.sin(a) * Rd.range(90, 230) - 30, Rd.range(0.15, 0.32), WHITE);
    }
  };

  return {
    update(dt) {
      t += dt;
      if (!opened && t >= OPEN) {
        opened = true;
        spawnBurst();
        lights.add(PX, PY - 6, 68, C[5], 0.72, 0.5);
        lights.add(PX, PY - 8, 26, G[4], 1.0, 0.27);
      }
      if (!hitFx && t >= HIT_T) {
        hitFx = true;
        spawnHitSplatter();
        lights.add(TX, TARGET_Y, 52, C[5], 0.78, 0.42);
        lights.add(TX, TARGET_Y, 19, WHITE, 0.9, 0.15);
      }
      if (!shutFx && t >= shutT) {
        shutFx = true;
        lights.add(PX, PY, 15, G[4], 0.6, 0.2);
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.55;
          ps.spawn(P.SPARK, PX, PY, Math.cos(a) * 70, Math.sin(a) * 70, 0.22, G[4]);
        }
      }
      // lacquer droplets: heavy, streaked, they arc down and burst into floor splats
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        if (d.delay > 0) { d.delay -= dt; continue; }
        d.vy += 640 * dt;
        d.vx -= d.vx * 0.9 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.y >= 0) {
          splats.push({ x: d.x, r: d.r * (1.1 + Math.min(1.05, Math.hypot(d.vx, d.vy) / 260)), red: d.kind < 0.45, die: t + 0.95 + (d.seed % 1) * 0.35, seed: d.seed });
          if ((d.seed | 0) % 3 === 0) splats.push({ x: d.x + Math.sign(d.vx || 1) * d.r * 2.2, r: d.r * 0.55, red: d.kind >= 0.45 && d.kind < 0.8, die: t + 0.8, seed: d.seed + 3 });
          ps.spawn(P.DUST, d.x, -1, d.vx * 0.1, -14, 0.38, K[3], 1);
          drops.splice(i, 1);
          continue;
        }
        if (d.y < -156 || d.x < -146 || d.x > 146) drops.splice(i, 1);
      }
      // black lacquer petals sifting down while the fan is open
      if (t > 0.3 && t < 1.75) {
        flakeAcc += dt * 19;
        while (flakeAcc >= 1) {
          flakeAcc -= 1;
          const Rf = new Rng((o.seed * 31 + ((t * 97) | 0) * 7 + flakeAcc * 1000) | 0);
          if (flakes.length < 42) flakes.push({ x: Rf.range(-96, 112), y: -118 - Rf.range(0, 30), vy: 22 + Rf.range(0, 18), ph: Rf.range(0, TAU), f: 0.9 + Rf.range(0, 1.4), age: 0, gold: Rf.next() < 0.14 });
        }
      }
      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i];
        f.age += dt;
        f.y += f.vy * dt;
        f.x += Math.sin(f.age * f.f * 2 + f.ph) * 7.5 * dt;
        if (f.y >= -0.5 || f.age > 3.4) flakes.splice(i, 1);
      }
      ps.update(dt);
      lights.update(dt);
    },
    drawBack(p) {
      const tt = t;
      // the air itself darkens around the opening fan
      if (tt < 0.62) {
        const q = tt / 0.62;
        p.disc(PX, PY - 6, 30 + ease.outQuart(q) * 12, K[0], 0.25 * (1 - q));
      }
      // the shockwave laid onto the floor, far half behind him
      const fq = seg(tt, OPEN, OPEN + 0.58);
      if (tt >= OPEN && fq < 1) {
        const r = 12 + ease.outQuart(fq) * 88, th = Math.max(0.8, 3.6 * (1 - fq)), k = 1 - smooth(0.42, 1, fq);
        band(p, 2, 0.5, r, 0.17, th, k, [K[0], K[1], G[2], G[4]], (g) => Math.sin(g) < 0, fq < 0.2);
      }
      // glossy lacquer splats welded to the floor
      const splatFade = 1 - smooth(1.55, 2.02, tt);
      for (const s of splats) {
        const fade = Math.min(clamp((s.die - tt) / 0.38), splatFade);
        if (fade <= 0.03) continue;
        const rx = s.r * 1.75, ry = Math.max(0.8, rx * 0.36);
        const rim = s.red ? C[1] : G[1], core = s.red ? C[4] : K[2], hot = s.red ? C[5] : K[4];
        p.ellipse(s.x, 1.15, rx + 0.9, ry + 0.55, rim, fade);
        p.ellipse(s.x, 1.15, rx, ry, core, fade);
        p.ellipse(s.x - rx * 0.22, 0.95, rx * 0.48, ry * 0.52, hot, fade * 0.9);
        p.dot(s.x - rx * 0.42, 0.55, WHITE, 0.7 * fade);
        const dripDir = (s.seed % 1) < 0.5 ? -1 : 1;
        p.line(s.x + dripDir * rx * 0.4, 1.55, s.x + dripDir * (rx * 0.4 + 2 + s.r), 1.9, core, fade * 0.9);
      }
      // a warm pool at his feet while the fan is open
      if (tt > 0 && tt < shutT) p.glow(PX, 0.5, 36, G[3], 0.1 + 0.02 * Math.sin(tt * 9));
    },
    draw(p) {
      const tt = t;
      // the heat-haze glow bleeding out from behind the open fan
      const heatK = tt < shutT ? clamp(tt / 0.1) * (1 - seg(tt, shutT, shutT + 0.16)) : 0;
      if (heatK > 0.02) p.glow(PX, PY - 10, 30, C[4], 0.3 * heatK);
      // the fan, while it is anything like open
      if (tt < shutT + 0.18) drawFan(p, tt, C, G, K, o.seed, shutT);
      // the aerial shell of the blast: a full lacquer dome over him, clipped where the floor takes over
      const rq = seg(tt, OPEN, OPEN + 0.42);
      if (tt >= OPEN && rq < 1) {
        const r = 10 + ease.outQuart(rq) * 56, th = Math.max(0.7, 3.1 * (1 - rq)), k = (1 - rq) * 0.92;
        const hot = rq < 0.2, m = Math.ceil(r * TAU * 1.2);
        for (let j = 0; j < m; j++) {
          const a = (j / m) * TAU, ca = Math.cos(a), sa = Math.sin(a);
          for (let o = th; o >= -0.4; o -= 0.5) {
            const y = PY + sa * (r - o);
            if (y > 1.5) continue;
            const x = PX + ca * (r - o), u = o / th;
            const col = u < 0.18 ? (hot ? WHITE : G[4]) : u < 0.45 ? (hot ? G[5] : C[4]) : u < 0.75 ? C[2] : K[0];
            p.dot(x, y, col, Math.min(1, k * (u < 0.45 ? 1.2 : 1.12 - u)));
          }
        }
      }
      const fq = seg(tt, OPEN, OPEN + 0.58);
      if (tt >= OPEN && fq < 1) {
        const r = 12 + ease.outQuart(fq) * 88, th = Math.max(0.8, 3.6 * (1 - fq)), k = 1 - smooth(0.42, 1, fq);
        band(p, 2, 0.5, r, 0.17, th, k, [K[0], K[1], G[2], G[4]], (g) => Math.sin(g) >= 0, fq < 0.2);
      }
      // anime menace: speed lines screaming out of the fan
      if (tt < 0.13) {
        const k = 1 - tt / 0.13;
        const Rl = new Rng(o.seed * 13 + 5);
        for (let i = 0; i < 11; i++) {
          const a = Rl.range(0, TAU);
          if (Math.sin(a) > 0.6) continue;
          const r0 = 21 + Rl.range(0, 11), r1 = r0 + (7 + Rl.range(0, 21)) * (0.45 + 0.55 * k);
          const cr = Rl.next();
          p.line(PX + Math.cos(a) * r0, PY + Math.sin(a) * r0, PX + Math.cos(a) * r1, PY + Math.sin(a) * r1, cr < 0.4 ? G[4] : cr < 0.75 ? WHITE : C[6], k * 0.72);
        }
      }
      // white-hot hero flash on the snap
      if (tt < 0.07) {
        const hk = 1 - tt / 0.07;
        flare(p, PX, PY - 4, 44 * hk + 12, hk, [C[4], G[3], G[5], WHITE]);
      }
      // lacquer droplets: streaked beads with a hot rim
      for (const d of drops) {
        if (d.delay > 0) continue;
        const l = Math.hypot(d.vx, d.vy) || 1, tail = clamp(l * 0.026, 1.4, 5.2);
        const red = d.kind < 0.45, ember = d.kind >= 0.8;
        if (ember) {
          p.line(d.x, d.y, d.x - (d.vx / l) * tail, d.y - (d.vy / l) * tail, G[3], 0.85);
          p.px(d.x, d.y, G[4]);
          p.glow(d.x, d.y, 3.2, G[3], 0.5);
          continue;
        }
        const rim = red ? C[1] : G[2], core = red ? C[5] : K[1], lit = red ? WHITE : G[4];
        p.line(d.x, d.y, d.x - (d.vx / l) * tail, d.y - (d.vy / l) * tail, rim, 0.9);
        p.circle(d.x, d.y, d.r + 0.35, rim);
        p.circle(d.x, d.y, d.r, core);
        p.dot(d.x - d.r * 0.4, d.y - d.r * 0.45, lit, 0.85);
        if (!red) p.dot(d.x + d.r * 0.4, d.y + d.r * 0.45, G[1], 0.8);
        p.glow(d.x, d.y, 2.6, core, 0.32);
      }
      // black lacquer petals sifting down
      if (flakes.length) {
        const fade = 1 - smooth(1.85, 2.2, tt);
        for (const f of flakes) p.dot(f.x, f.y, f.gold ? G[2] : C[2], fade);
      }
      // the hit result: a jagged lacquer splat bursts across the target and weeps downward
      const age = tt - HIT_T;
      if (age >= 0 && age < 1.02) {
        const q = seg(age, 0, 0.09), r = ease.outBack(q, 2.3) * 15.5;
        const fade = 1 - smooth(0.52, 1.0, age / 1.02), hotNow = age < 0.16;
        const jagOut2 = jagOut;
        const pts = [], inner = [];
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * TAU, rr = r * (0.52 + jagOut[k] * 0.78);
          pts.push([TX + Math.cos(a) * rr, TARGET_Y + Math.sin(a) * rr * 0.92]);
        }
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * TAU + 0.33, rr = r * 0.47 * (0.66 + jagOut[(k * 4 + 3) % 12] * 0.5);
          inner.push([TX + Math.cos(a) * rr, TARGET_Y + Math.sin(a) * rr * 0.92]);
        }
        p.poly(pts, K[0], fade);
        p.poly(inner, hotNow ? C[5] : C[4], fade);
        if (hotNow) p.circle(TX, TARGET_Y, r * 0.24, C[6], fade);
        // specfle glints
        for (let k = 0; k < 12; k += 2) {
          const a = (k / 12) * TAU, rr = r * jagOut[k] * 1.22;
          p.dot(TX + Math.cos(a) * rr, TARGET_Y + Math.sin(a) * rr * 0.92, K[0], fade * 0.9);
        }
        p.dot(TX - r * 0.4, TARGET_Y - r * 0.35, WHITE, 0.8 * fade);
        p.dot(TX + r * 0.34, TARGET_Y - r * 0.1, C[7], 0.7 * fade);
        p.dot(TX + r * 0.05, TARGET_Y + r * 0.4, WHITE, 0.6 * fade);
        // viscous drips crawling down out of the splat
        const drip = smooth(0.1, 0.66, age);
        for (const [off, len, col] of [[-6, 8.5, C[4]], [0.5, 12, K[1]], [6.5, 6, C[3]]]) {
          const l = drip * len;
          if (l > 0.8) {
            p.line(TX + off, TARGET_Y + r * 0.28, TX + off, TARGET_Y + r * 0.28 + l, col, fade);
            p.dot(TX + off, TARGET_Y + r * 0.28 + l, col, fade);
          }
        }
        // a fast double ring off the impact
        const ringQ = seg(age, 0, 0.3);
        if (ringQ < 1) {
          const rr = 5 + ease.outQuart(ringQ) * 30, rk = 1 - ringQ;
          band(p, TX, TARGET_Y, rr, 0.8, Math.max(0.7, 1.8 * (1 - ringQ)), rk * 0.72, [K[0], K[1], G[2]], () => true, false);
        }
        if (age < 0.12) {
          const hk = 1 - age / 0.12;
          flare(p, TX, TARGET_Y - 2, 19 * hk + 6, hk, [C[3], C[5], G[4], WHITE]);
        }
      }
      // the snap-shut click
      if (tt > shutT && tt < shutT + 0.34) {
        const q = (tt - shutT) / 0.34;
        if (q < 0.28) sparkle(p, PX, PY - 2, 7 * (1 - q / 0.28) + 2, G[5], C[6], 0.7);
      }
      ps.draw(p);
      lights.draw(p);
    },
  };
}
