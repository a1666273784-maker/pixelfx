// The 山海 boss effect showcase: one page that plays the four effects at 320x180 and exports sprite sheets.
import { createFrame, clearFrame, painterFor, composite } from "../core/index.js";
import * as claw from "../fx/beast/claw-rift.js";
import * as orb from "../fx/beast/jade-fire-orb.js";
import * as step from "../fx/beast/step-flame-array.js";
import * as sky from "../fx/beast/burn-the-mountains.js";

const W = 320, H = 180;
const $ = (s) => document.querySelector(s);
const el = (tag, props = {}, kids = []) => {
  const e = Object.assign(document.createElement(tag), props);
  for (const k of [].concat(kids)) e.append(k);
  return e;
};

// ---- the catalogue. `cuts` are sub-clips of one effect: the combo's three hits, played alone or chained.
const FX = [
  {
    id: "claw", mod: claw, name: "赤金裂爪", sub: "普攻 · 三段连招", branch: true,
    cuts: [
      { id: "all", name: "连播", a: 0, b: claw.meta.duration },
      { id: "1", name: "一段 · 挥砍", a: 0, b: 0.68 },
      { id: "2", name: "二段 · 十字", a: 0.62, b: 1.40 },
      { id: "3", name: "三段 · 重砸", a: 1.34, b: claw.meta.duration },
    ],
  },
  { id: "orb", mod: orb, name: "青岚瑞火弹", sub: "技能一 · 远程投射", branch: true },
  { id: "step", mod: step, name: "踏炎连环阵", sub: "技能二 · 突进与阵法", branch: true },
  { id: "sky", mod: sky, name: "山海焚天", sub: "大招 · 万象瑞火", branch: true },
];

// ---- the stage
const cv = $("#stage"), ctx = cv.getContext("2d", { alpha: true });
cv.width = W; cv.height = H;
const img = new ImageData(W, H);
const frame = createFrame(W, H);
const rgb = (h) => {
  const v = parseInt(h.slice(1), 16);
  return [v >> 16, (v >> 8) & 255, v & 255];
};
const BGS = {
  ink: { name: "深黛蓝", css: "radial-gradient(circle at 50% 45%, #22303f 0%, #18222F 70%)", color: "#18222F", hex: true },
  black: { name: "纯黑", css: "#000000", color: "#000000", hex: true },
  grey: { name: "游戏灰", css: "#5a6068", color: "#5a6068", hex: true },
  checker: { name: "透明棋盘格", css: "checker", color: null },
  green: { name: "绿幕", css: "#00b140", color: "#00b140", hex: true },
};

const state = {
  fx: 0, cut: 0, hit: true, bg: "ink", fps: 24, t: 0, playing: true, loop: true,
  zoom: 4, shake: true,
};
const cur = () => FX[state.fx];
const clip = () => {
  const f = cur();
  return f.cuts ? f.cuts[state.cut] : { a: 0, b: f.mod.meta.duration };
};
const opts = () => ({ ...cur().mod.meta.options, hit: state.hit });

// ---- drawing one frame of the effect at time t (absolute effect time)
function applyShake(t) {
  const s = cur().mod.shake;
  if (!state.shake || !s) return [0, 0];
  const [x, y] = s(Math.max(0, t));
  return [Math.round(x), Math.round(y)];
}
function renderSprite(dst, t) {
  // the effect's colour buffer, with the shake applied by sampling with an offset
  clearFrame(frame);
  const p = painterFor(frame).place(0, 0);
  cur().mod.draw(p, t, opts());
  const [sx, sy] = applyShake(t);
  const out = dst || img.data;
  const C = frame.color;
  for (let y = 0; y < H; y++) {
    const syy = Math.min(H - 1, Math.max(0, y - sy));
    for (let x = 0; x < W; x++) {
      const sxx = Math.min(W - 1, Math.max(0, x - sx));
      const c = C[syy * W + sxx], i = (y * W + x) * 4;
      out[i] = c & 255; out[i + 1] = (c >>> 8) & 255; out[i + 2] = (c >>> 16) & 255; out[i + 3] = c >>> 24;
    }
  }
  return out;
}
function paintBackground() {
  const bg = BGS[state.bg];
  if (bg.color) {
    const [r, g, b] = rgb(bg.color);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, W, H);
  } else {
    // the transparency checkerboard is drawn in the pixels too, so what you see is what exports
    const a = 40, b = 26;
    for (let y = 0; y < H; y += 8)
      for (let x = 0; x < W; x += 8) {
        ctx.fillStyle = ((x / 8 + y / 8) & 1) ? `rgb(${a},${a},${a})` : `rgb(${b},${b},${b})`;
        ctx.fillRect(x, y, 8, 8);
      }
  }
}
function quantT(t) {
  const c = clip(), step = 1 / state.fps;
  return Math.min(c.b, c.a + Math.floor(Math.max(0, t - c.a) / step + 1e-6) * step);
}
function draw() {
  paintBackground();
  renderSprite(img.data, quantT(state.t));
  ctx.putImageData(img, 0, 0);
  hud();
}

// ---- the HUD inside the stage: phase name and time, tiny pixel text drawn in the DOM instead
const PHASES = {
  claw: [[0, "蓄力"], [0.28, "一段 · 裂爪"], [0.62, "二段 · 十字"], [1.34, "三段 · 裂地"], [2.2, "余烬"]],
  orb: [[0, "青岚聚气"], [0.62, "瑞火飞行"], [0.92, "命中爆发"], [1.2, "余烬"]],
  step: [[0, "云雷成阵"], [0.58, "踏炎突进"], [0.78, "连环喷发"], [1.7, "碎裂"], [2.2, "余烬"]],
  sky: [[0, "八卦吸能"], [1.12, "焚天"], [1.2, "陨火倾泻"], [1.55, "祥云火海"], [2.7, "火海退去"], [3.1, "星火升空"]],
};
function phaseAt(t) {
  const id = cur().id;
  if (id === "orb" && !state.hit) return t < 0.62 ? "青岚聚气" : t < 0.92 ? "瑞火飞行" : t < 1.2 ? "火核熄灭" : "青灰消散";
  const list = PHASES[id] || [];
  let name = "—";
  for (const [tt, n] of list) if (t >= tt) name = n;
  return name;
}
function hud() {
  const t = quantT(state.t);
  $("#hud-phase").textContent = phaseAt(t);
  $("#hud-time").textContent = `${t.toFixed(2)}s / ${clip().b.toFixed(2)}s`;
  $("#hud-frame").textContent = `FRAME ${Math.round((t - clip().a) * state.fps).toString().padStart(3, "0")}`;
}

// ---- playback
let last = performance.now();
function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state.playing) {
    const c = clip();
    state.t += dt;
    if (state.t >= c.b + 0.35) {
      if (state.loop) state.t = c.a;
      else { state.t = c.b; state.playing = false; syncPlay(); }
    }
    render();
  }
  requestAnimationFrame(tick);
}
function render() {
  draw();
  $("#scrub").value = String(Math.round(((quantT(state.t) - clip().a) / Math.max(0.001, clip().b - clip().a)) * 1000));
}

// ---- controls
function setFx(i) {
  state.fx = i;
  state.cut = 0;
  state.t = clip().a;
  state.playing = true;
  syncPlay();
  buildFxList(); buildCuts(); render();
}
function buildFxList() {
  const box = $("#fxlist");
  box.textContent = "";
  FX.forEach((f, i) => {
    const b = el("button", { className: "card" + (i === state.fx ? " on" : ""), type: "button" });
    b.append(el("span", { className: "card-k", textContent: String(i + 1).padStart(2, "0") }));
    const t = el("span", { className: "card-t" });
    t.append(el("strong", { textContent: f.name }), el("em", { textContent: f.sub }));
    b.append(t);
    b.onclick = () => setFx(i);
    box.append(b);
  });
}
function buildCuts() {
  const box = $("#cuts");
  box.textContent = "";
  const f = cur();
  $("#cuts-wrap").style.display = f.cuts ? "" : "none";
  if (!f.cuts) return;
  f.cuts.forEach((c, i) => {
    const b = el("button", { className: "pill" + (i === state.cut ? " on" : ""), textContent: c.name, type: "button" });
    b.onclick = () => { state.cut = i; state.t = clip().a; state.playing = true; syncPlay(); buildCuts(); render(); };
    box.append(b);
  });
}
function syncPlay() {
  $("#play").textContent = state.playing ? "❙❙ 暂停" : "▶ 播放";
  $("#play").classList.toggle("on", state.playing);
}
function stepFrame(dir) {
  const c = clip();
  const dt = 1 / state.fps;
  state.t = Math.min(c.b, Math.max(c.a, state.t + dir * dt));
  state.playing = false;
  syncPlay();
  render();
}
function seek(e) {
  const c = clip();
  const u = +e.target.value / 1000;
  state.t = c.a + (c.b - c.a) * u;
  render();
}

// ---- export
const COLS = 8;
function framesForExport() {
  const c = clip(), fps = state.fps, n = Math.max(1, Math.round((c.b - c.a) * fps) + 1);
  const list = [];
  for (let i = 0; i < n; i++) list.push(c.a + i / fps > c.b ? c.b : c.a + i / fps);
  return { t: list, fps, cols: Math.min(COLS, list.length) };
}
function sheetCanvas(list, cols) {
  const rows = Math.ceil(list.length / cols);
  const sh = el("canvas", { width: W * cols, height: H * rows });
  const sc = sh.getContext("2d");
  const buf = new Uint8ClampedArray(W * H * 4);
  const im = new ImageData(W, H);
  list.forEach((t, i) => {
    renderSprite(buf, t);
    im.data.set(buf);
    sc.putImageData(im, (i % cols) * W, Math.floor(i / cols) * H);
  });
  return { canvas: sh, rows, cols };
}
function download(blob, name) {
  const a = el("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function status(msg) {
  const s = $("#status");
  s.textContent = msg;
  s.classList.add("on");
  clearTimeout(status._t);
  status._t = setTimeout(() => s.classList.remove("on"), 4200);
}
function baseName() {
  const f = cur(), c = clip();
  return `${f.id}${f.cuts ? "-" + c.id : ""}${f.branch ? (state.hit ? "-hit" : "-miss") : ""}`;
}

// a zip of stored (uncompressed) PNGs: no dependency, every engine and OS opens it
function crc32(u8) {
  let c, crc = 0xffffffff;
  for (let i = 0; i < u8.length; i++) {
    c = (crc ^ u8[i]) & 255;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const enc = new TextEncoder();
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0, true);
    lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    locals.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(8, 0, true); ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true);
    ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    centrals.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = centrals.reduce((n, a) => n + a.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...locals, ...centrals, new Uint8Array(end.buffer)], { type: "application/zip" });
}
const pngBytes = (canvas) => new Promise((res) => canvas.toBlob((b) => b.arrayBuffer().then((a) => res(new Uint8Array(a))), "image/png"));

async function exportSheet() {
  const c = clip(), name = baseName();
  status("正在渲染序列帧…");
  await new Promise((r) => setTimeout(r, 16));
  const { t, fps, cols } = framesForExport();
  const { canvas, rows } = sheetCanvas(t, cols);
  const grid = { image: `${name}.png`, frameWidth: W, frameHeight: H, columns: cols, rows, frames: t.length, fps, clip: { from: c.a, to: c.b }, pivot: [W / 2, H], note: "每一帧横向排列，第 0 帧在左上角；按 frameWidth/frameHeight 切格即可。" };
  const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
  download(blob, `${name}-sheet.png`);
  download(new Blob([JSON.stringify(grid, null, 2)], { type: "application/json" }), `${name}-sheet.json`);
  $("#grid").textContent = `${cols} 列 × ${rows} 行 · 每帧 ${W}×${H}px · 共 ${t.length} 帧 · ${fps}fps · 整图 ${canvas.width}×${canvas.height}px`;
  status(`序列帧大图已导出：${name}-sheet.png`);
}
async function exportFrames() {
  const name = baseName();
  status("正在打包每一帧…");
  await new Promise((r) => setTimeout(r, 16));
  const { t, fps } = framesForExport();
  const buf = new Uint8ClampedArray(W * H * 4), im = new ImageData(W, H);
  const files = [];
  const meta = [];
  for (let i = 0; i < t.length; i++) {
    renderSprite(buf, t[i]);
    im.data.set(buf);
    const c = el("canvas", { width: W, height: H });
    c.getContext("2d").putImageData(im, 0, 0);
    const data = await pngBytes(c);
    files.push({ name: `${name}/${String(i).padStart(4, "0")}.png`, data });
    meta.push({ frame: `${String(i).padStart(4, "0")}.png`, index: i, time: +(t[i] - clip().a).toFixed(3) });
  }
  files.push({ name: `${name}/frames.json`, data: new TextEncoder().encode(JSON.stringify({ frameWidth: W, frameHeight: H, fps, count: t.length, pivot: [W / 2, H], frames: meta }, null, 2)) });
  download(zip(files), `${name}-frames.zip`);
  status(`已导出 ${t.length} 张独立 PNG + frames.json`);
}
async function exportCurrent() {
  const buf = renderSprite(new Uint8ClampedArray(W * H * 4), state.t);
  const im = new ImageData(W, H);
  im.data.set(buf);
  const c = el("canvas", { width: W, height: H });
  c.getContext("2d").putImageData(im, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  download(blob, `${baseName()}-${state.t.toFixed(2)}s.png`);
  status("当前帧已导出");
}

// ---- wiring
function buildBg() {
  const box = $("#bg");
  box.textContent = "";
  for (const [k, v] of Object.entries(BGS)) {
    const b = el("button", { className: "pill" + (k === state.bg ? " on" : ""), textContent: v.name, type: "button" });
    b.onclick = () => { state.bg = k; buildBg(); render(); };
    box.append(b);
  }
}
function buildFps() {
  const box = $("#fps");
  box.textContent = "";
  for (const f of [8, 12, 24, 30]) {
    const b = el("button", { className: "pill" + (f === state.fps ? " on" : ""), textContent: `${f}FPS`, type: "button" });
    b.onclick = () => { state.fps = f; state.t = quantT(state.t); buildFps(); render(); };
    box.append(b);
  }
}
function buildBranch() {
  const box = $("#branch");
  box.textContent = "";
  const on = cur().branch;
  $("#branch-wrap").style.opacity = on ? "1" : "0.4";
  for (const h of [true, false]) {
    const b = el("button", { className: "pill" + (h === state.hit && on ? " on" : ""), textContent: h ? "命中 · 爆发" : "未命中 · 消散", type: "button" });
    b.disabled = !on;
    b.onclick = () => { state.hit = h; state.t = clip().a; state.playing = true; syncPlay(); buildBranch(); render(); };
    box.append(b);
  }
}

$("#play").onclick = () => { state.playing = !state.playing; syncPlay(); };
$("#prev").onclick = () => stepFrame(-1);
$("#next").onclick = () => stepFrame(1);
$("#replay").onclick = () => { state.t = clip().a; state.playing = true; syncPlay(); render(); };
$("#scrub").oninput = seek;
$("#exp-sheet").onclick = exportSheet;
$("#exp-frames").onclick = exportFrames;
$("#exp-frame").onclick = exportCurrent;
$("#loop").onclick = () => { state.loop = !state.loop; $("#loop").classList.toggle("on", state.loop); };
$("#shake").onclick = () => { state.shake = !state.shake; $("#shake").classList.toggle("on", state.shake); render(); };
addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  if (e.code === "Space") { e.preventDefault(); state.playing = !state.playing; syncPlay(); }
  if (e.code === "ArrowLeft") { e.preventDefault(); stepFrame(-1); }
  if (e.code === "ArrowRight") { e.preventDefault(); stepFrame(1); }
  if (e.code === "KeyR") { state.t = clip().a; state.playing = true; syncPlay(); render(); }
  const n = "1234".indexOf(e.key);
  if (n >= 0) setFx(n);
});

// the zoom: an integer scale that fills the stage
function fit() {
  const wrap = $("#stage-wrap");
  const w = wrap.clientWidth, h = Math.max(220, window.innerHeight - 40);
  const z = Math.max(2, Math.min(Math.floor(w / W), Math.floor((h * 0.92) / H)));
  state.zoom = z;
  cv.style.width = `${W * z}px`;
  cv.style.height = `${H * z}px`;
}
addEventListener("resize", fit);

buildFxList();
buildCuts();
buildBg();
buildFps();
buildBranch();
$("#loop").classList.toggle("on", state.loop);
$("#shake").classList.toggle("on", state.shake);
syncPlay();
fit();
render();
requestAnimationFrame(tick);
// a first look at the current effect on load
setTimeout(() => { state.t = clip().a; render(); }, 30);
