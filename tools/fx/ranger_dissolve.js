// The Leaf Ranger's disappearance in his mercy (tools/mercy/mercy.js, ranger()): an animation of his own, like the Samurai's petal burst.
// It is made from his standing frame (Ranger_kneel, frame 0), pixel by pixel: the pixels of his body come loose from the head down, each
// at its own moment, and fly off as leaves (about 40% of them: little green leaves) or as specks in his own colours (about 25%); the rest
// just vanish. The first frame is his standing frame exactly (so it joins the pose he is in) and the last is empty.
//   Animation Ranger_Dissolve on the object Leaf_Ranger: FR frames, DT apart, not looping, the same picture size and origin as his other
//   frames (so the game flips and places it like any of them).
//
//   node tools/fx/ranger_dissolve.js --preview   writes docs/previews/ranger_dissolve.png and ranger_dissolve.gif (nothing else is touched)
//   node tools/fx/ranger_dissolve.js --install   writes assets/Leaf_Ranger/mercy/Ranger_Dissolve_*.png, registers the images and adds the
//                                                animation to Leaf_Ranger in the scene. Close GDevelop first. Safe to run again.
const fs = require("fs");
const path = require("path");
const png = require("../bosses/png.js");
const ROOT = path.join(__dirname, "..", "..");

const FR = 18, DT = 0.07;
const LEAF = { a: [104, 204, 104], b: [48, 140, 70], c: [170, 232, 140], edge: [70, 170, 86], edgeD: [38, 120, 62] };

// A repeatable "random" for each pixel and purpose, so every frame sees the same pixel behave the same way.
const hash = (x, y, k) => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function loadSource() {
  const L = require("../bosses/lib.js"), scene = L.readJson("layouts/leaf_ranger_fight.json"), project = L.readJson("Soul Rush.json");
  const obj = scene.objects.find(o => o.name === "Leaf_Ranger"), spr = obj.animations.find(a => a.name === "Ranger_kneel").directions[0].sprites[0];
  const res = project.resources.resources.find(r => r.name === spr.image);
  const poly = spr.customCollisionMask && spr.customCollisionMask[0] || [], xs = poly.map(p => p.x), ys = poly.map(p => p.y);
  // His hurtbox and blood points come from the standing frame too (the blood test wants them on every frame of his).
  return { img: png.decode(path.join(ROOT, res ? res.file : spr.image)), origin: [spr.originPoint.x, spr.originPoint.y],
    mask: poly.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null, points: Object.fromEntries(spr.points.map(p => [p.name, [p.x, p.y]])) };
}

function frames(src) {
  const { w, h } = src.img, px = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = (y * w + x) * 4; if (src.img.data[p + 3] > 128) px.push({ x, y, c: [src.img.data[p], src.img.data[p + 1], src.img.data[p + 2]] }); }
  const y0 = Math.min(...px.map(p => p.y)), y1 = Math.max(...px.map(p => p.y));
  for (const p of px) {
    p.t = 0.05 + (p.y - y0) / Math.max(1, y1 - y0) * 0.5 + hash(p.x, p.y, 1) * 0.22;           // when it comes loose (0..1 of the animation): head first
    p.fp = Math.ceil(p.t * (FR - 1));                                                            // the frame it is gone from the body
    const k = hash(p.x, p.y, 2); p.kind = k < 0.4 ? "leaf" : k < 0.65 ? "speck" : "none";
    p.vx = (hash(p.x, p.y, 3) - 0.5) * 1.5 + 0.3; p.vy = -(0.5 + hash(p.x, p.y, 4) * 1.3); p.ph = hash(p.x, p.y, 5) * 6.28; p.sw = 1 + hash(p.x, p.y, 6) * 2.5;
    p.life = Math.min(2 + Math.floor(hash(p.x, p.y, 7) * 6), FR - 2 - p.fp); p.tone = Math.floor(hash(p.x, p.y, 8) * 3);
  }
  const out = [];
  for (let n = 0; n < FR; n++) {
    const img = { w, h, data: Buffer.alloc(w * h * 4) }, put = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= w || y >= h) return; const o = (y * w + x) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255; };
    const s = n / (FR - 1);
    for (const p of px) if (s < p.t) put(p.x, p.y, p.c);                                          // the body that is still there
    for (const p of px) {                                                                         // what has come off it
      const a = n - p.fp; if (p.kind === "none" || a < 0 || a >= p.life || n >= FR - 1) continue;
      const x = p.x + p.vx * a * 1.4 + Math.sin(p.ph + a * 0.8) * p.sw, y = p.y + p.vy * a * 1.4;
      if (p.kind === "speck") { put(x, y, p.c); continue; }
      const body = p.tone === 0 ? LEAF.a : p.tone === 1 ? LEAF.b : LEAF.c, edge = p.tone === 1 ? LEAF.edgeD : LEAF.edge, flip = (n + Math.round(p.ph)) % 2;
      if (flip) { put(x - 1, y, body); put(x, y, body); put(x + 1, y, body); put(x + 1, y - 1, body); put(x + 2, y - 1, edge); }
      else { put(x, y - 1, body); put(x, y, body); put(x, y + 1, body); put(x + 1, y + 1, body); put(x + 1, y + 2, edge); }
    }
    out.push(img);
  }
  return out;
}
module.exports = { FR, DT, frames, loadSource };

if (require.main === module && process.argv[2] === "--preview") {
  const src = loadSource(), F = frames(src), dir = path.join(ROOT, "docs", "previews"); fs.mkdirSync(dir, { recursive: true });
  const X0 = 100, Y0 = 50, CW = 100, CH = 80, S = 3, cols = 9, rows = Math.ceil(FR / cols);
  const bg = (x, y) => (((x >> 4) + (y >> 4)) % 2 ? [58, 64, 74] : [74, 80, 92]);
  const paint = (img, f, ox, oy, scale) => { for (let y = 0; y < CH * scale; y++) for (let x = 0; x < CW * scale; x++) {
    const sx = X0 + Math.floor(x / scale), sy = Y0 + Math.floor(y / scale); let c = bg(x + ox, y + oy); const p = (sy * f.w + sx) * 4; if (f.data[p + 3]) c = [f.data[p], f.data[p + 1], f.data[p + 2]];
    const q = ((oy + y) * img.w + ox + x) * 4; img.data[q] = c[0]; img.data[q + 1] = c[1]; img.data[q + 2] = c[2]; img.data[q + 3] = 255; } };
  const sheet = { w: cols * CW * S, h: rows * CH * S, data: Buffer.alloc(cols * CW * S * rows * CH * S * 4) };
  F.forEach((f, k) => paint(sheet, f, (k % cols) * CW * S, Math.floor(k / cols) * CH * S, S));
  png.encode(sheet, path.join(dir, "ranger_dissolve.png"));
  const gif = require("./gif.js"), G = 4, g = F.map(f => { const img = { w: CW * G, h: CH * G, data: Buffer.alloc(CW * G * CH * G * 4) }; paint(img, f, 0, 0, G); return img; });
  fs.writeFileSync(path.join(dir, "ranger_dissolve.gif"), gif.encode(g, g.map((_, i) => (i === 0 ? 30 : i === FR - 1 ? 30 : 7))));
  console.log("wrote docs/previews/ranger_dissolve.png and ranger_dissolve.gif");
}

if (require.main === module && process.argv[2] === "--install") {
  const L = require("../bosses/lib.js"), src = loadSource(), F = frames(src), dir = "assets/Leaf_Ranger/mercy";
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  const files = F.map((img, i) => { const f = dir + "/Ranger_Dissolve_" + (i + 1) + ".png"; png.encode(img, path.join(ROOT, f)); return f; });
  const project = L.readJson("Soul Rush.json"); L.registerImages(project, files); L.writeJson("Soul Rush.json", project);
  const scene = L.readJson("layouts/leaf_ranger_fight.json"), obj = scene.objects.find(o => o.name === "Leaf_Ranger");
  const anim = L.animation("Ranger_Dissolve", files.map(image => ({ image, origin: src.origin, mask: src.mask, points: src.points })), DT, false);
  const i = obj.animations.findIndex(a => a.name === "Ranger_Dissolve"); if (i >= 0) obj.animations[i] = anim; else obj.animations.push(anim);
  L.writeJson("layouts/leaf_ranger_fight.json", scene);
  console.log("Ranger_Dissolve (" + files.length + " frames) added to Leaf_Ranger");
}
