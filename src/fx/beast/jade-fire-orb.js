// 青岚瑞火弹: the boss's ranged shot. Jade cloud winds inward to a gold fire core, then a fat comet with a
// curled 祥云 tail crosses the screen. On a hit the screen blows white for one frame and tears open into
// concentric pixel rings and jade wind blades; on a miss the core gutters out, the body stretches and curls
// away into three 青灰 smokes.

import { seg, ease, clamp, lerp, TAU, Rng, rand, smooth } from "../../core/index.js";
import { FIRE, JADE, COOL, GREY, bone, gold, crimson, flame, ember, jade, teal, ink, rampAt, shown, curl, cloud, thunder, ribbon, Field, flashStar, flight, clipTo, bay } from "./_lib.js";

export const meta = {
  name: "青岚瑞火弹 · Jade Cloud Fireball",
  desc: "A jade cloud vortex winds in to a gold core, then a fire comet with a curled cloud tail crosses the screen. Hit: white flash, rings, wind blades. Miss: it curls into smoke.",
  tags: ["beast", "projectile", "boss", "chinese", "fire", "cloud", "one-shot"],
  size: [320, 180],
  origin: [0, 0],
  duration: 2.10,
  loop: false,
  fps: 24,
  bg: "dark",
  options: { seed: 5, hit: true },
};

const G = 143;
const Y0 = 86;
const T = { castEnd: 0.58, fly: 0.62, flyEnd: 0.98, hitLen: 0.9, missLen: 0.95 };
const CAST_X = 58;
const orbY = (t) => Y0 + Math.sin((t - T.fly) * 8) * 4;
const orbX = (t) => 48 + (272 - 48) * ease.outQuart(seg(t, T.fly, T.fly + 0.30));
// when the orb reaches the far side
const ARRIVE = T.fly + 0.30;

function makeBits(seed) {
  const R = new Rng(seed);
  const b = { trail: [], sparks: [], blades: [], motes: [], cinders: [] };
  for (let i = 0; i < 46; i++)
    b.trail.push({ at: R.next(), r: R.range(2, 4.6), life: R.range(0.25, 0.55), ph: R.range(0, TAU), off: R.range(-6, 6) });
  for (let i = 0; i < 64; i++) {
    const a = R.range(0, TAU), sp = R.range(40, 260);
    b.sparks.push({ a, sp, life: R.range(0.3, 0.95), jade: R.next() < 0.42, sz: R.next() < 0.35 ? 2 : 1 });
  }
  for (let i = 0; i < 20; i++) {
    const a = R.range(0, TAU), sp = R.range(90, 210);
    b.blades.push({ a, sp, life: R.range(0.45, 0.95), len: R.range(10, 22) });
  }
  for (let i = 0; i < 34; i++) b.motes.push({ a: R.range(0, TAU), r0: R.range(28, 46), spin: R.range(1.4, 2.8), ph: R.range(0, 0.34) });
  for (let i = 0; i < 24; i++) b.cinders.push({ a: R.range(0, TAU), sp: R.range(6, 30), life: R.range(0.3, 0.7) });
  return b;
}
const B = makeBits(19);

export const shake = (t) => {
  const k = Math.pow(1 - seg(t, ARRIVE, ARRIVE + 0.28), 2);
  const on = t >= ARRIVE ? k : 0;
  return [Math.round(Math.sin(t * 93) * 7 * on), Math.round(Math.cos(t * 71) * 5 * on)];
};

// ---- the ball: a fat, hard-edged fireball with a bone-hot heart and a jade wind rim
function ball(p, x, y, r, t, opt = {}) {
  const cool = opt.cool ?? 0, rim = opt.rim !== false;
  for (let py = -r - 2; py <= r + 2; py++) {
    for (let px = -r - 2; px <= r + 2; px++) {
      const d = Math.hypot(px, py) / r;
      const ang = Math.atan2(py, px);
      const wob = 1 + Math.sin(ang * 6 + t * 15) * 0.055 + Math.sin(ang * 3 - t * 9) * 0.04;
      if (d > wob) continue;
      const n = rand(Math.round(px + 60), Math.round(py + 60), 7);
      let c;
      if (cool > 0) c = rampAt(COOL, clamp(d * 0.62 + cool * 1.3 + n * 0.1));
      // a thin white heart, gold, flame, crimson, and a dark rim: light falls off hard
      else if (d < 0.22) c = n > 0.3 ? bone : gold;
      else if (d < 0.44) c = n > 0.4 ? gold : bone;
      else if (d < 0.62) c = n > 0.35 ? flame : gold;
      else if (d < 0.82) c = n > 0.4 ? crimson : flame;
      else c = n > 0.45 ? ember : crimson;
      p.px(x + px, y + py, c);
    }
  }
  if (rim && cool < 0.4) {
    // jade wind, spun round the outside: two broken rings with gaps
    for (let i = 0; i < 54; i++) {
      const a = (i / 54) * TAU + t * 5;
      if (Math.sin(a * 3 + t * 9) < -0.55) continue;
      const rr = r + 1.5 + (i % 3 === 0 ? 1 : 0);
      p.px(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.94, i % 4 ? jade : teal);
    }
    // the hot leading edge at the front, bone
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.16;
      for (let q = 0; q < 3; q++) p.px(x + Math.cos(a) * (r - q), y + Math.sin(a) * (r - q) * 0.94, q < 2 ? bone : gold);
    }
  }
}

// ---- the tail: a chain of solid 祥云 scrolls of fire, shrinking and cooling down the line
function tail(p, x, y, t, len = 96) {
  // a thin core of fire straight back from the head, so the scrolls are strung on something hot
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const bx = x - i * 0.92, by = y + Math.sin(u * 3.6 + t * 14) * 9 * u + u * 4;
    const w = (1 - u) * 6 + 1.5;
    for (let q = -w; q <= w; q++) {
      const v = Math.abs(q) / w;
      if (v > 1) continue;
      const heat = (1 - v * 0.8) * (1 - u * 0.9);
      if (u > 0.4 && !shown(bx, by + q, (1 - u) * 1.5)) continue;
      const c = heat > 0.7 ? bone : heat > 0.45 ? gold : heat > 0.22 ? flame : crimson;
      p.px(bx, by + q, c);
    }
  }
  // the scrolls proper: four, biggest at the head, each curling as it is left behind
  for (let k = 0; k < 5; k++) {
    const u = 0.1 + k * 0.2;
    const bx = x - len * 0.9 * u, by = y + Math.sin(u * 3.6 + t * 14) * 9 * u + u * 4;
    const rr = (14 - k * 2.6) * (1 - u * 0.15);
    const ph = t * 3.4 + k * 1.9;
    // fire all the way down the line, cooling from gold to ember; the far pair pick up a jade rim
    const col = (v) => (k < 3
      ? rampAt([ember, crimson, flame, gold, bone], clamp(v * 0.9 + 0.15 - k * 0.06))
      : v > 0.6 ? jade : v > 0.26 ? teal : ink);
    cloud(p, bx, by, rr, ph, col, { solid: true, rim: k >= 3 ? ink : ember, a: 1 - Math.max(0, (u - 0.72) / 0.28) });
    // licks of flame off the top of the fresh ones
    if (k < 2) {
      for (let q = 0; q < 7; q++) {
        const a2 = -0.4 - q * 0.36 + Math.sin(t * 9 + q) * 0.14;
        const fl = 4 + Math.abs(Math.sin(t * 12 + q * 2)) * 5;
        for (let j = 1; j < fl; j++)
          p.px(bx + Math.cos(a2) * (rr + j * 0.55), by + Math.sin(a2) * (rr + j * 0.55), j > fl * 0.6 ? flame : j > fl * 0.3 ? gold : bone);
      }
    }
  }
}

export function draw(p, t, o) {
  if (t < 0) return;
  clipTo(p, { x: 2, y: 2, w: 316, h: 176 });
  const hit = o.hit !== false;
  const end = ARRIVE + (hit ? T.hitLen : T.missLen);

  // ---- cast: a jade cloud vortex winding into a gold core
  if (t < T.fly + 0.02) {
    const k = seg(t, 0, T.castEnd);
    const spin = ease.outCubic(k);
    // three thick arms of cloud, curling in tighter as it charges
    for (let arm = 0; arm < 3; arm++) {
      const base = arm * (TAU / 3) + t * 2.4;
      const n = 34;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const rr = lerp(74, 9, Math.pow(u, 0.7)) + (1 - spin) * 22;
        const a = base + u * 3.9;
        const w = 1 + Math.round(4.4 * (1 - u) * (0.4 + spin));
        for (let q = 0; q <= w; q++) {
          const x = CAST_X + Math.cos(a) * (rr + q), y = Y0 + Math.sin(a) * (rr + q) * 0.84;
          if (!shown(x, y, 0.55 + 0.45 * spin)) continue;
          const c = u > 0.84 ? gold : u > 0.62 ? (arm % 2 ? jade : flame) : u > 0.32 ? (arm % 2 ? teal : crimson) : ember;
          p.px(x, y, c);
        }
        // the arm's outer edge catches gold
        if (i % 4 === 0) p.px(CAST_X + Math.cos(a) * (rr + w + 1), Y0 + Math.sin(a) * (rr + w + 1) * 0.84, u > 0.5 ? gold : jade);
      }
    }
    // motes pulled in along the spiral
    for (const q of B.motes) {
      const life = seg(t, q.ph, q.ph + 0.4);
      if (life <= 0 || life >= 1) continue;
      const r = q.r0 * (1 - ease.inQuad(life)) + 4;
      const a = q.a + life * q.spin * 3.4;
      for (let s = 0; s < 4; s++) p.px(CAST_X + Math.cos(a) * (r + s * 2), Y0 + Math.sin(a) * (r + s * 2) * 0.84, s > 2 ? teal : life > 0.55 ? gold : jade);
    }
    // the core, growing to a fist of light
    const cr = 1.5 + spin * 15;
    ball(p, CAST_X, Y0, cr, t, { rim: spin > 0.5 });
    if (spin > 0.6) {
      const gl = 6 * (spin - 0.6) / 0.4;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + t * 8;
        if (!shown(CAST_X, Y0, spin)) continue;
        p.px(CAST_X + Math.cos(a) * (cr + 3 + gl), Y0 + Math.sin(a) * (cr + 3 + gl) * 0.9, i % 2 ? gold : bone);
      }
    }
    // the release: the vortex collapses into the shot, throwing off a hard ring and a burst of cloud
    const rel = seg(t, T.castEnd - 0.06, T.fly + 0.10);
    if (rel > 0 && rel < 1) {
      const f = 1 - rel;
      for (let ring = 0; ring < 3; ring++) {
        const R = (12 + ring * 10 + ease.outCubic(rel) * (30 + ring * 12));
        const N = Math.max(40, Math.round(R * 4.2));
        const w = Math.max(1, (4 - ring) * f);
        for (let i = 0; i < N; i++) {
          const ang = (i / N) * TAU;
          for (let q = 0; q < w; q++) {
            if (!shown(CAST_X, Y0, f * (1 - q / w * 0.5))) continue;
            p.px(CAST_X + Math.cos(ang) * (R + q), Y0 + Math.sin(ang) * (R + q) * 0.9,
              ring === 0 ? (q === 0 ? bone : gold) : ring === 1 ? (q === 0 ? gold : flame) : (q === 0 ? flame : crimson));
          }
        }
      }
      flashStar(p, CAST_X, Y0, 18 * f + 5, bone, 8, t * 4);
      // the cloud it leaves behind, flung outward
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * TAU + 0.6;
        const d = ease.outCubic(rel) * 34;
        cloud(p, CAST_X + Math.cos(ang) * d, Y0 + Math.sin(ang) * d * 0.8, 5 + rel * 3, i * 2 + t * 3,
          (v) => (rel < 0.4 ? rampAt([ember, crimson, flame, gold], v + 0.1) : v > 0.55 ? jade : teal), { solid: true, a: f });
      }
    }
  }

  // ---- flight
  if (t >= T.fly && t < (hit ? ARRIVE : T.fly + 0.30)) {
    const x = orbX(t), y = orbY(t);
    tail(p, x, y, t, 104);
    ball(p, x, y, 17, t);
    // hopping sparks round the head
    for (let i = 0; i < 20; i++) {
      const a = rand(i, 3) * TAU + t * 3, rr = 18 + rand(i, 4) * 12;
      const sx = x + Math.cos(a) * rr, sy = y + Math.sin(a) * rr;
      if (!shown(sx, sy, 0.75)) continue;
      p.px(sx, sy, i % 3 ? gold : bone);
      p.px(sx - 1, sy + 1, flame);
    }
  }

  // ---- hit
  if (hit && t >= ARRIVE) {
    const x = 272, y = orbY(ARRIVE);
    const u = seg(t, ARRIVE, end);
    // the impact frame: the screen blows white, cut by ink rays
    if (t < ARRIVE + 0.045) {
      for (let py = 0; py < 180; py++)
        for (let px = 0; px < 320; px++) {
          const a = Math.atan2(py - y, px - x);
          if (Math.sin(a * 7) > 0.86) p.px(px, py, gold);
          else if (Math.sin(a * 13 + 1) > 0.94) p.px(px, py, crimson);
          else p.px(px, py, bone);
        }
      flashStar(p, x, y, 60, gold, 8, 0.3);
      return;
    }
    // the burst: a ring of fire petals thrown out from the point of impact, bone at the tips
    const burst = seg(t, ARRIVE, ARRIVE + 0.34);
    if (burst > 0 && burst < 1) {
      const reach = lerp(10, 74, ease.outQuart(burst));
      const f = Math.pow(1 - burst, 0.7);
      for (let i = 0; i < 13; i++) {
        const ang = (i / 13) * TAU + 0.2 + Math.sin(i * 7) * 0.06;
        const rr = reach * (0.72 + rand(i, 4) * 0.5);
        const w = (11 - i % 3 * 2) * f;
        if (w < 1) continue;
        const ex = x + Math.cos(ang) * rr, ey = y + Math.sin(ang) * rr * 0.9;
        ribbon(p, x + Math.cos(ang) * 6, y + Math.sin(ang) * 6 * 0.9, ex, ey, w * 2, (u, v) => {
          if (v < 0.18) return u > 0.72 ? bone : gold;
          if (v < 0.44) return u > 0.82 ? bone : u > 0.5 ? gold : flame;
          if (v < 0.74) return u > 0.5 ? flame : crimson;
          return ink;
        }, { a: f, skew: 0.75 });
        // a torn bit of cloud flung with each petal
        if (i % 3 === 0) cloud(p, ex, ey, 3 + f * 4, i + t * 3, (v) => (v > 0.5 ? flame : ember), { solid: true, a: f * 0.9 });
      }
      // two thick rings running out under the petals
      for (let ring = 0; ring < 2; ring++) {
        const kk = seg(t, ARRIVE + ring * 0.05, ARRIVE + 0.3 + ring * 0.06);
        if (kk <= 0 || kk >= 1) continue;
        const rr = (14 + ring * 26) * ease.outQuart(kk);
        const w = (10 - ring * 3) * Math.pow(1 - kk, 0.8) + 1;
        const N = Math.max(36, Math.round(rr * 3.2));
        for (let i = 0; i < N; i++) {
          const ang = (i / N) * TAU;
          const jag = 1 + Math.sin(ang * 6 + ring * 2 + t * 6) * 0.05;
          for (let q = 0; q < w; q++) {
            const v = q / w;
            const c = v < 0.22 ? bone : v < 0.5 ? gold : v < 0.8 ? flame : crimson;
            p.px(x + Math.cos(ang) * (rr + q) * jag, y + Math.sin(ang) * (rr + q) * jag * 0.92, c);
          }
        }
      }
    }
    // jade wind blades skidding out of the middle
    for (const s of B.blades) {
      const age = t - (ARRIVE + 0.02);
      if (age < 0 || age > s.life) continue;
      const kk = age / s.life;
      const px = x + Math.cos(s.a) * s.sp * age, py = y + Math.sin(s.a) * s.sp * age * 0.85;
      for (let q = 0; q < s.len * 0.7; q++) {
        if (!shown(px, py, (1 - kk) * (1 - q / s.len))) break;
        const qx = px - Math.cos(s.a) * q * 1.6, qy = py - Math.sin(s.a) * q * 1.6;
        const thick = Math.round((1 - q / s.len) * 2.2);
        for (let th = 0; th <= thick; th++) p.px(qx, qy - th, th === thick ? teal : q > s.len * 0.45 ? teal : kk > 0.5 ? jade : bone);
      }
    }
    // fire left hanging where it landed, cooling into cloud, then gone
    // the wound: a jet of fire boiling up out of where it landed, cooling to 青灰 cloud
    const hang = seg(t, ARRIVE + 0.04, ARRIVE + 0.62);
    if (hang > 0 && hang < 1) {
      const f = 1 - Math.max(0, (hang - 0.72) / 0.28);
      for (let i = 0; i < 5; i++) {
        const age = seg(t, ARRIVE + 0.04 + i * 0.05, ARRIVE + 0.62 + i * 0.02);
        if (age <= 0 || age >= 1) continue;
        const rr = (4 + age * 12) * (1 - age * 0.3) * (1 - i * 0.08);
        const cx = x - 6 - i * 9 + Math.sin(age * 4 + i * 2) * 6;
        const cy = y - Math.max(0, age - 0.12) * 52 * (0.5 + i * 0.14) - i * 0.5;
        const sm = Math.max(0, (age - 0.38) / 0.62);
        const col = (v) => (sm < 0.4
          ? rampAt([ember, crimson, flame, gold, bone], clamp(v * (1 - sm) + 0.1))
          : v > 0.55 ? jade : v > 0.25 ? teal : ink);
        cloud(p, cx, cy, rr, i * 2 + age * 3.4, col, { solid: true, a: (1 - age * age) * f });
        if (age < 0.45) {
          // fire licks off the top of the freshest puffs
          for (let q = 0; q < 6; q++) {
            const a2 = rand(q, i, 5) * TAU;
            const ly = cy - rr * 0.6 - rand(q, i, 6) * 6;
            p.px(cx + Math.cos(a2) * rr * 0.7, ly, q % 2 ? gold : flame);
          }
        }
      }
    }
    // sparks: gravity, bounce, cooling
    for (const s of B.sparks) {
      const age = t - ARRIVE;
      if (age < 0 || age > s.life) continue;
      const kk = age / s.life;
      const vx = Math.cos(s.a) * s.sp, vy = Math.sin(s.a) * s.sp * 0.9 - 50;
      const [px, py] = flight(x, y, vx, vy, 470, age, G, 0.45);
      if (pp2(px, py, kk)) continue;
      const c = kk > 0.5 ? ember : s.jade ? (kk > 0.25 ? teal : jade) : rampAt(COOL, kk * 0.85);
      for (let i = 1; i <= s.sz + 1; i++) {
        const ax = Math.round(px - vx * 0.004 * i), ay = Math.round(py - vy * 0.004 * i);
        if (i > s.sz) { if (kk < 0.45) p.px(ax, ay, ember); } else p.px(ax, ay, c);
      }
    }
  }

  // ---- miss: the core gutters out, the body sags and splits into three curls of 青灰 smoke
  if (!hit && t >= ARRIVE - 0.06) {
    const x = 266, y = orbY(ARRIVE);
    const k = seg(t, ARRIVE - 0.06, ARRIVE + 0.30);
    if (k < 1) {
      const r = 17 * (1 - k * 0.55);
      const bx = x + k * 10, by = y + k * k * 6;
      ball(p, bx, by, r, t, { cool: 0.1 + k * 0.75, rim: k < 0.35 });
      for (let i = 0; i < 22; i++) {
        if (!shown(bx, by, (1 - k) * 1.4)) continue;
        const a2 = rand(i, 8) * TAU + t * 2;
        const rr = r + 3 + rand(i, 9) * 10 * k;
        p.px(bx + Math.cos(a2) * rr, by + Math.sin(a2) * rr * 0.9, i % 2 ? teal : jade);
      }
      // the body being drawn out into a sagging smear before it lets go
      if (k > 0.3) {
        const st = (k - 0.3) / 0.7;
        for (let i = 0; i < 30 * st; i++) {
          const u = i / 30;
          const tx = bx - 2 + u * 34, ty = by + Math.sin(u * 2.6 + t * 3) * 7 + u * 4;
          const w = Math.max(0, (1 - u) * 8 * (1 - st * 0.35));
          for (let q = -w; q <= w; q++) if (shown(tx, ty + q, 1 - st * 0.5)) p.px(tx, ty + q, rampAt(COOL, clamp(0.42 + st * 0.55 + Math.abs(q) * 0.05 + u * 0.15)));
        }
      }
    }
    // three curls of 青灰 smoke lift away, unrolling, swaying, dying one by one
    for (let i = 0; i < 3; i++) {
      const t0 = ARRIVE + 0.1 + i * 0.09, life = 0.72 + i * 0.08;
      const age = seg(t, t0, t0 + life);
      if (age <= 0 || age >= 1) continue;
      const sway = Math.sin(age * 3.2 + i * 2.1);
      const cx = x + 4 + (i - 1) * 13 + sway * 10 * age;
      const cy = y - age * 58 * (0.9 + i * 0.1) - i * 2;
      const rr = 6 + Math.min(1, age * 1.25) * 10;
      const hot = age < 0.16;
      const col = (v) => (hot ? rampAt([ember, crimson, flame, gold], clamp(v + 0.12)) : v > 0.64 ? jade : v > 0.3 ? teal : ink);
      const al = age < 0.55 ? 1 : (1 - age) / 0.45;
      if (hot) curl(p, cx, cy - rr * 0.7, rr * 0.9, i + age * 5, col, { w: 2, sy: 0.8 });
      cloud(p, cx, cy, rr, i * 2.1 + age * 3.4, col, { solid: true, a: al });
      // the wisp it leaves below, thinning out
      for (let q = 0; q < 10; q++) {
        const u = q / 10;
        const wx = cx + Math.sin(u * 3.4 + age * 4 + i) * 5, wy = cy + rr * 0.65 + u * 14;
        if (!shown(wx, wy, al * (1 - u) * 1.1)) continue;
        p.px(wx, wy, u > 0.55 ? ink : teal);
      }
    }
    cinders(p, t, x, y, hit);
  }
}

/** sparks that fall out of a broken shot; kept tiny */
function cinders(p, t, x, y, hit) {
  if (hit) return;
  for (let i = 0; i < 20; i++) {
    const t0 = T.fly + 0.3 + rand(i, 12) * 0.18;
    const life = 0.35 + rand(i, 13) * 0.3;
    const k = seg(t, t0, t0 + life);
    if (k <= 0 || k >= 1) continue;
    const px = x + 8 + (rand(i, 14) - 0.5) * 46 + Math.sin(k * 6 + i) * 7;
    const py = y + 4 - k * 34 + (rand(i, 15) - 0.5) * 26;
    if (!shown(px, py, 1 - k)) continue;
    p.px(px, py, k < 0.35 ? gold : k < 0.7 ? flame : ember);
  }
}
const pp2 = (x, y, k) => k > 0.68 && !shown(x, y, (1 - k) / 0.32);
