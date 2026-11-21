// The Leaf Ranger's mercy (tools/mercy/mercy.js, ranger()): he kneels, plants his last arrow in the ground and it flowers; then he is
// gone in a drift of leaves. Two small objects, drawn in code in pixel art (each art pixel is PX screen pixels: the Ranger's own sprite
// is drawn at 2x, so PX 2 keeps the pixels the same size as his):
//   Ranger_Sprout (animation Grow, 12 frames): the arrow stands in the ground, a vine winds up the shaft with leaves, and it ends in
//                 a cream blossom with a gold heart and two small ones. Origin: the ground line, middle. Not looping (holds its last frame).
//   Ranger_Leaves (animation Drift, 12 frames): a handful of green leaves rise and sway away. Origin: the picture centre.
//
//   node tools/fx/ranger_sprout.js --preview   writes docs/previews/ranger_sprout.png and ranger_sprout.gif (nothing else is touched)
//   node tools/fx/ranger_sprout.js --install   writes assets/Leaf_Ranger/mercy/*.png and registers both objects in the Leaf Ranger
//                                              scene and the images in the project. Close GDevelop first. Safe to run again.
const fs = require("fs");
const path = require("path");
const png = require("../bosses/png.js");
const ROOT = path.join(__dirname, "..", "..");

const PX = 2, DT = 0.1, FRAMES = 12;
const C = {
  shaft: [128, 92, 52], shaftD: [88, 60, 34], fl: [48, 150, 78], flL: [132, 214, 120], flD: [28, 100, 56],
  stem: [70, 170, 86], stemD: [38, 120, 62], leaf: [104, 204, 104], leafD: [48, 140, 70], leafL: [170, 232, 140],
  petal: [252, 246, 226], petalS: [226, 214, 188], heart: [240, 196, 72], soil: [96, 66, 48], soilD: [62, 42, 34]
};

function canvas(w, h) { return { w, h, cell: Array.from({ length: h }, () => Array(w).fill(null)) }; }
const put = (cv, x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < cv.w && y < cv.h) cv.cell[y][x] = c; };
function toImage(cv) {
  const W = cv.w * PX, H = cv.h * PX, img = { w: W, h: H, data: Buffer.alloc(W * H * 4) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = cv.cell[(y / PX) | 0][(x / PX) | 0]; if (!c) continue; const p = (y * W + x) * 4; img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255; }
  return img;
}

// ---- The sprout: art canvas 36 x 60, the ground line at row GY, the shaft at column MX ----
const SW = 36, SH = 60, GY = 54, MX = 18, TOP = 30;                 // the shaft stands from the ground (GY) up to TOP
function sprout(n) {
  const cv = canvas(SW, SH);
  // The soil: a small dark crack and a few crumbs around the shaft.
  for (let x = MX - 4; x <= MX + 4; x++) put(cv, x, GY + 1, Math.abs(x - MX) > 2 ? C.soil : C.soilD);
  for (let x = MX - 2; x <= MX + 2; x++) put(cv, x, GY + 2, C.soil);
  if (n === 0) { put(cv, MX - 5, GY - 1, C.soil); put(cv, MX + 6, GY - 2, C.soil); put(cv, MX - 3, GY - 3, C.soilD); }
  // The arrow: a brown shaft with a two-tone edge, and green fletching at the top.
  for (let y = TOP; y <= GY; y++) { put(cv, MX, y, C.shaft); put(cv, MX + 1, y, C.shaftD); }
  for (let i = 0; i < 8; i++) { const y = TOP + i, w = i < 6 ? 2 : 1; for (let k = 1; k <= w; k++) { put(cv, MX - k, y - (k > 1 ? 1 : 0) + 1, k === 1 ? C.flL : C.fl); put(cv, MX + 1 + k, y - (k > 1 ? 1 : 0) + 1, k === 1 ? C.fl : C.flD); } }
  put(cv, MX, TOP - 1, C.shaft);
  // The growth: g goes 0 to 1 over frames 3 to 11. A vine winds up the shaft; leaves open where it passes; flowers last.
  const g = Math.max(0, Math.min(1, (n - 2) / (FRAMES - 3)));
  if (g > 0) {
    const reach = (GY - 1) - (GY - TOP + 2) * g;                      // the vine's tip, row
    for (let y = GY - 1; y >= reach; y--) { const x = MX + Math.round(Math.sin((GY - y) * 0.6) * 2.2); put(cv, x, y, C.stem); put(cv, x + (x > MX ? 1 : -1), y, C.stemD); }
    const LEAVES = [[48, -1], [42, 1], [36, -1], [31, 1]];
    LEAVES.forEach(([ly, dir], i) => { if (reach > ly) return; const lx = MX + Math.round(Math.sin((GY - ly) * 0.6) * 2.2), k = Math.min(1, (ly - reach) / 3);
      put(cv, lx + dir, ly, C.leaf); put(cv, lx + 2 * dir, ly, C.leaf); if (k > 0.4) { put(cv, lx + 2 * dir, ly - 1, C.leafL); put(cv, lx + 3 * dir, ly - 1, C.leaf); put(cv, lx + dir, ly + 1, C.leafD); put(cv, lx + 2 * dir, ly + 1, C.leafD); } });
  }
  // Flowers: a bud, then the blossom (five petals round a gold heart); two small blossoms lower down.
  const flower = (fx, fy, size) => {
    if (size <= 0) return;
    if (size === 1) { put(cv, fx, fy, C.petal); put(cv, fx, fy + 1, C.leafD); return; }
    put(cv, fx, fy, C.heart);
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) put(cv, fx + dx, fy + dy, C.petal);
    if (size >= 3) for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(cv, fx + dx, fy + dy, C.petalS);
    if (size >= 4) for (const [dx, dy] of [[0, -2], [-2, 0], [2, 0]]) put(cv, fx + dx, fy + dy, C.petal);
  };
  flower(MX, TOP - 4, g < 0.6 ? 0 : g < 0.75 ? 1 : g < 0.9 ? 2 : g < 1 ? 3 : 4);
  flower(MX - 6, 38, g < 0.8 ? 0 : g < 1 ? 2 : 4);
  flower(MX + 6, 44, g < 0.9 ? 0 : g < 1 ? 2 : 4);
  return cv;
}

// ---- The leaves: art canvas 56 x 56, they start at the middle low and rise and sway away ----
const LW = 56, LH = 56;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const LEAVES = (() => { const r = rng(7); return Array.from({ length: 30 }, (_, i) => ({ x0: 28 + (r() - 0.5) * 20, y0: 42 + (r() - 0.5) * 16, vx: (r() - 0.5) * 16, vy: -(7 + r() * 14), sw: 2 + r() * 3, ph: r() * 6.28, life: 0.5 + r() * 0.6, tone: i % 3 })); })();
function drift(n) {
  const cv = canvas(LW, LH), t = n * DT;
  for (const l of LEAVES) {
    if (t > l.life * FRAMES * DT * 0.95) continue;
    const x = l.x0 + l.vx * t + Math.sin(l.ph + t * 5) * l.sw, y = l.y0 + l.vy * t * 1.4;
    const body = l.tone === 0 ? C.leaf : l.tone === 1 ? C.leafD : C.leafL, edge = l.tone === 1 ? C.stemD : C.stem, flip = (n + Math.round(l.ph)) % 2;
    // a small leaf: three pixels and a tip, turning between two poses as it tumbles
    if (flip) { put(cv, x - 1, y, body); put(cv, x, y, body); put(cv, x + 1, y, body); put(cv, x + 1, y - 1, body); put(cv, x + 2, y - 1, edge); }
    else { put(cv, x, y - 1, body); put(cv, x, y, body); put(cv, x, y + 1, body); put(cv, x + 1, y + 1, body); put(cv, x + 1, y + 2, edge); }
  }
  return cv;
}

const sproutFrames = () => Array.from({ length: FRAMES }, (_, n) => toImage(sprout(n)));
const driftFrames = () => Array.from({ length: FRAMES }, (_, n) => toImage(drift(n)));
const SPROUT = { w: SW * PX, h: SH * PX, origin: [SW * PX / 2, (GY + 1) * PX] }, LEAF = { w: LW * PX, h: LH * PX, origin: [LW * PX / 2, LH * PX / 2] };
module.exports = { FRAMES, DT, PX, sproutFrames, driftFrames, SPROUT, LEAF };

if (require.main === module && process.argv[2] === "--preview") {
  const dir = path.join(ROOT, "docs", "previews"); fs.mkdirSync(dir, { recursive: true });
  const bg = (x, y) => (((x >> 4) + (y >> 4)) % 2 ? [58, 64, 74] : [74, 80, 92]);
  const all = sproutFrames().map(f => ({ f, W: SPROUT.w, H: SPROUT.h })).concat(driftFrames().map(f => ({ f, W: LEAF.w, H: LEAF.h })));
  const cw = 112, ch = 120, S = 2, cols = FRAMES, sheet = { w: cols * cw * S / 2 * 2, h: 2 * ch * S, data: Buffer.alloc(cols * cw * S * 2 * ch * S * 4) };
  all.forEach((a, k) => { const row = Math.floor(k / cols), col = k % cols; const ox = col * cw * S, oy = row * ch * S;
    for (let y = 0; y < ch * S; y++) for (let x = 0; x < cw * S; x++) { const sx = Math.floor(x / S) - Math.floor((cw - a.W) / 2), sy = Math.floor(y / S) - Math.floor((ch - a.H) / 2); let c = bg(x, y);
      if (sx >= 0 && sy >= 0 && sx < a.W && sy < a.H) { const p = (sy * a.W + sx) * 4; if (a.f.data[p + 3]) c = [a.f.data[p], a.f.data[p + 1], a.f.data[p + 2]]; }
      const q = ((oy + y) * sheet.w + ox + x) * 4; sheet.data[q] = c[0]; sheet.data[q + 1] = c[1]; sheet.data[q + 2] = c[2]; sheet.data[q + 3] = 255; } });
  png.encode(sheet, path.join(dir, "ranger_sprout.png"));
  const gif = require("./gif.js"), G = 3, GW = 112 * G, GH = 120 * G, frames = [];
  for (let k = 0; k < FRAMES * 2; k++) { const a = all[k % FRAMES]; const b = all[FRAMES + (k % FRAMES)]; const img = { w: GW * 2, h: GH, data: Buffer.alloc(GW * 2 * GH * 4) };
    for (const [part, off] of [[a, 0], [b, GW]]) for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const sx = Math.floor(x / G) - Math.floor((112 - part.W) / 2), sy = Math.floor(y / G) - Math.floor((120 - part.H) / 2); let c = bg(x + off, y);
      if (sx >= 0 && sy >= 0 && sx < part.W && sy < part.H) { const p = (sy * part.W + sx) * 4; if (part.f.data[p + 3]) c = [part.f.data[p], part.f.data[p + 1], part.f.data[p + 2]]; }
      const q = (y * img.w + off + x) * 4; img.data[q] = c[0]; img.data[q + 1] = c[1]; img.data[q + 2] = c[2]; img.data[q + 3] = 255; }
    frames.push(img); }
  fs.writeFileSync(path.join(dir, "ranger_sprout.gif"), gif.encode(frames, frames.map((_, i) => (i % FRAMES === FRAMES - 1 ? 40 : 10))));
  console.log("wrote docs/previews/ranger_sprout.png and ranger_sprout.gif");
}

if (require.main === module && process.argv[2] === "--install") {
  const L = require("../bosses/lib.js"), dir = "assets/Leaf_Ranger/mercy";
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  const write = (name, frames) => frames.map((img, i) => { const f = dir + "/" + name + "_" + (i + 1) + ".png"; png.encode(img, path.join(ROOT, f)); return f; });
  const sFiles = write("Ranger_Sprout", sproutFrames()), lFiles = write("Ranger_Leaves", driftFrames());
  const project = L.readJson("Soul Rush.json"); L.registerImages(project, sFiles.concat(lFiles)); L.writeJson("Soul Rush.json", project);
  const scene = L.readJson("layouts/leaf_ranger_fight.json");
  const add = (name, files, anim, size) => {
    const obj = L.spriteObject(name, {}, [L.animation(anim, files.map(image => ({ image, origin: size.origin, mask: null })), DT, false)]);   // visual only
    const i = scene.objects.findIndex(o => o.name === name); if (i >= 0) scene.objects[i] = obj; else scene.objects.push(obj);
  };
  add("Ranger_Sprout", sFiles, "Grow", SPROUT); add("Ranger_Leaves", lFiles, "Drift", LEAF);
  L.addToFolder(scene.objectsFolderStructure, "Mercy", ["Ranger_Sprout", "Ranger_Leaves"]);
  L.writeJson("layouts/leaf_ranger_fight.json", scene);
  console.log("Ranger_Sprout and Ranger_Leaves registered in Leaf_Ranger_Fight (" + sFiles.length + " + " + lFiles.length + " frames)");
}
