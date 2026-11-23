// The Leaf Ranger's mercy (tools/mercy/mercy.js, ranger()): he kneels, tosses his last arrow into the ground in front of him and it
// flowers; then he dissolves into leaves (tools/fx/ranger_dissolve.js). One small object, drawn in code in pixel art (each art pixel is PX screen pixels:
// the Ranger's own sprite is drawn at 2x, so PX 2 keeps the pixels the same size as his):
//   Ranger_Sprout  animation Grow (12 frames): the arrow stands in the ground, a vine winds up the shaft with leaves, and it ends in a
//                  cream blossom with a gold heart and two small ones. Not looping (holds its last frame).
//                  animation Fly (1 frame): the same arrow with no soil, tip down, for the toss.
//                  Origin: the arrow's tip at the ground line, middle.
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
function sprout(n, fly) {
  const cv = canvas(SW, SH);
  if (!fly) {
    // The soil: a small dark crack and a few crumbs around the shaft.
    for (let x = MX - 4; x <= MX + 4; x++) put(cv, x, GY + 1, Math.abs(x - MX) > 2 ? C.soil : C.soilD);
    for (let x = MX - 2; x <= MX + 2; x++) put(cv, x, GY + 2, C.soil);
    if (n === 0) { put(cv, MX - 5, GY - 1, C.soil); put(cv, MX + 6, GY - 2, C.soil); put(cv, MX - 3, GY - 3, C.soilD); }
  }
  // The arrow: a brown shaft with a two-tone edge, and green fletching at the top.
  for (let y = TOP; y <= GY; y++) { put(cv, MX, y, C.shaft); put(cv, MX + 1, y, C.shaftD); }
  for (let i = 0; i < 8; i++) { const y = TOP + i, w = i < 6 ? 2 : 1; for (let k = 1; k <= w; k++) { put(cv, MX - k, y - (k > 1 ? 1 : 0) + 1, k === 1 ? C.flL : C.fl); put(cv, MX + 1 + k, y - (k > 1 ? 1 : 0) + 1, k === 1 ? C.fl : C.flD); } }
  put(cv, MX, TOP - 1, C.shaft);
  if (fly) return cv;
  // The growth: g goes 0 to 1 over frames 3 to 11. A vine winds up the shaft; leaves open where it passes; flowers last.
  const g = Math.max(0, Math.min(1, (n - 2) / (FRAMES - 3)));
  if (g > 0) {
    const reach = (GY - 1) - (GY - TOP + 2) * g;                      // the vine's tip, row
    for (let y = GY - 1; y >= reach; y--) { const x = MX + Math.round(Math.sin((GY - y) * 0.6) * 2.2); put(cv, x, y, C.stem); put(cv, x + (x > MX ? 1 : -1), y, C.stemD); }
    const LEAVES = [[48, -1], [42, 1], [36, -1], [31, 1]];
    LEAVES.forEach(([ly, dir]) => { if (reach > ly) return; const lx = MX + Math.round(Math.sin((GY - ly) * 0.6) * 2.2), k = Math.min(1, (ly - reach) / 3);
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

const sproutFrames = () => Array.from({ length: FRAMES }, (_, n) => toImage(sprout(n)));
const flyFrame = () => toImage(sprout(0, true));
const SPROUT = { w: SW * PX, h: SH * PX, origin: [SW * PX / 2, (GY + 1) * PX] };
module.exports = { FRAMES, DT, PX, sproutFrames, flyFrame, SPROUT };

if (require.main === module && process.argv[2] === "--preview") {
  const dir = path.join(ROOT, "docs", "previews"); fs.mkdirSync(dir, { recursive: true });
  const bg = (x, y) => (((x >> 4) + (y >> 4)) % 2 ? [58, 64, 74] : [74, 80, 92]);
  const cell = 130, S = 2, list = sproutFrames().concat([flyFrame()]), sheet = { w: list.length * cell * S, h: cell * S, data: Buffer.alloc(list.length * cell * S * cell * S * 4) };
  const paint = (img, f, ox, scale) => { for (let y = 0; y < cell * scale; y++) for (let x = 0; x < cell * scale; x++) {
    const sx = Math.floor(x / scale) - Math.floor((cell - SPROUT.w) / 2), sy = Math.floor(y / scale) - Math.floor((cell - SPROUT.h) / 2); let c = bg(x + ox, y);
    if (sx >= 0 && sy >= 0 && sx < SPROUT.w && sy < SPROUT.h) { const p = (sy * SPROUT.w + sx) * 4; if (f.data[p + 3]) c = [f.data[p], f.data[p + 1], f.data[p + 2]]; }
    const q = (y * img.w + ox + x) * 4; img.data[q] = c[0]; img.data[q + 1] = c[1]; img.data[q + 2] = c[2]; img.data[q + 3] = 255; } };
  list.forEach((f, k) => paint(sheet, f, k * cell * S, S));
  png.encode(sheet, path.join(dir, "ranger_sprout.png"));
  const gif = require("./gif.js"), G = 3, frames = list.slice(0, FRAMES).map(f => { const img = { w: cell * G, h: cell * G, data: Buffer.alloc(cell * G * cell * G * 4) }; paint(img, f, 0, G); return img; });
  fs.writeFileSync(path.join(dir, "ranger_sprout.gif"), gif.encode(frames, frames.map((_, i) => (i === FRAMES - 1 ? 40 : 10))));
  console.log("wrote docs/previews/ranger_sprout.png and ranger_sprout.gif");
}

if (require.main === module && process.argv[2] === "--install") {
  const L = require("../bosses/lib.js"), dir = "assets/Leaf_Ranger/mercy";
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  const write = (name, frames) => frames.map((img, i) => { const f = dir + "/" + name + "_" + (i + 1) + ".png"; png.encode(img, path.join(ROOT, f)); return f; });
  const sFiles = write("Ranger_Sprout", sproutFrames()), flyFile = write("Ranger_Arrow_Fly", [flyFrame()]);
  const project = L.readJson("Soul Rush.json"); L.registerImages(project, sFiles.concat(flyFile));
  // The cloud of leaves object of the first version is gone (the dissolve is an animation of the Ranger himself now): remove it.
  project.resources.resources = project.resources.resources.filter(r => !/Ranger_Leaves_/.test(r.name));
  for (const f of fs.readdirSync(path.join(ROOT, dir))) if (/^Ranger_Leaves_/.test(f)) fs.unlinkSync(path.join(ROOT, dir, f));
  L.writeJson("Soul Rush.json", project);
  const scene = L.readJson("layouts/leaf_ranger_fight.json");
  scene.objects = scene.objects.filter(o => o.name !== "Ranger_Leaves");
  const folder = scene.objectsFolderStructure.children.find(c => c.folderName === "Mercy"); if (folder) folder.children = folder.children.filter(c => c.objectName !== "Ranger_Leaves");
  const frames = (files, size) => files.map(image => ({ image, origin: size.origin, mask: null }));
  const obj = L.spriteObject("Ranger_Sprout", {}, [L.animation("Grow", frames(sFiles, SPROUT), DT, false), L.animation("Fly", frames(flyFile, SPROUT), DT, false)]);   // visual only
  const i = scene.objects.findIndex(o => o.name === "Ranger_Sprout"); if (i >= 0) scene.objects[i] = obj; else scene.objects.push(obj);
  L.addToFolder(scene.objectsFolderStructure, "Mercy", ["Ranger_Sprout"]);
  L.writeJson("layouts/leaf_ranger_fight.json", scene);
  console.log("Ranger_Sprout (Grow " + sFiles.length + " frames, Fly 1) registered in Leaf_Ranger_Fight");
}
