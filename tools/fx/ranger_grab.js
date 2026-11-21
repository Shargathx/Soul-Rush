// The Leaf Ranger's bow grab (tools/mercy/mercy.js, ranger(), his get-up). In his kneel animation the bow lies on the ground with his hands
// hanging 7 px above it, and then it is 2 px from his hand in the next frame: it seems to jump into his hand. These two frames put the
// grab in between: he leans forward over the bow so his hand lands on it (frame 1, made from kneel frame 7, the upper body folded 6 px down
// and 2 forward), and comes up with it (frame 2, from kneel frame 6, the lean halved). After them his own kneel frame 5 has the hand on the
// bow and he is upright. (An arm drawn longer to reach was tried first: it looked like a stretching arm.)
//   Animation Ranger_BowGrab on the object Leaf_Ranger: 2 frames, same size, origin, hurtbox and blood point as his kneel frames.
//
//   node tools/fx/ranger_grab.js --preview   writes docs/previews/ranger_grab.png and ranger_grab.gif (nothing else is touched)
//   node tools/fx/ranger_grab.js --install   writes assets/Leaf_Ranger/mercy/Ranger_Grab_*.png, registers the images and the animation.
//                                            Close GDevelop first. Safe to run again.
const fs = require("fs");
const path = require("path");
const png = require("../bosses/png.js");
const ROOT = path.join(__dirname, "..", "..");
const DT = 0.13;

function load() {
  const L = require("../bosses/lib.js"), scene = L.readJson("layouts/leaf_ranger_fight.json"), project = L.readJson("Soul Rush.json");
  const spr = scene.objects.find(o => o.name === "Leaf_Ranger").animations.find(a => a.name === "Ranger_kneel").directions[0].sprites;
  const img = i => png.decode(path.join(ROOT, project.resources.resources.find(r => r.name === spr[i].image).file));
  const poly = spr[7].customCollisionMask && spr[7].customCollisionMask[0] || [], xs = poly.map(p => p.x), ys = poly.map(p => p.y);
  return { k7: img(7), k6: img(6), origin: [spr[7].originPoint.x, spr[7].originPoint.y],
    mask: poly.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null, points: Object.fromEntries(spr[7].points.map(p => [p.name, [p.x, p.y]])) };
}
const GOLD = [[255, 241, 160], [242, 210, 125], [213, 166, 96]];                 // the bow's colours: they never move with his body
const isGold = (d, o) => GOLD.some(g => d[o] === g[0] && d[o + 1] === g[1] && d[o + 2] === g[2]);
// He leans forward from the waist: everything of him above row 113 (head, shoulders, torso, cloak) and his two arms (x 144-145 and 157-158,
// down to row 116) move together by (dx, dy), the way a body folds over, and the skirt, legs and the bow stay. The hand rides down with
// the body, so it reaches the bow without the arm stretching. The moved part is drawn over the rest (the torso sinks into the skirt).
function lean(im, dx, dy) {
  const W = im.w, upper = [], out = { w: W, h: im.h, data: Buffer.from(im.data) };
  for (let y = 0; y < im.h; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4; if (!im.data[o + 3]) continue;
    if (isGold(im.data, o) && !(y <= 100 && x <= 148)) continue;               // gold is the bow, except his gold shoulder ornament (up by the head), which moves with him
    const arm = y >= 114 && y <= 116 && (x === 144 || x === 145 || x === 157 || x === 158);
    if (y <= 113 || arm) { upper.push([x, y, im.data[o], im.data[o + 1], im.data[o + 2]]); out.data[o + 3] = 0; }
  }
  for (const [x, y, r, g, b] of upper) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= im.h) continue; const o = (ny * W + nx) * 4; out.data[o] = r; out.data[o + 1] = g; out.data[o + 2] = b; out.data[o + 3] = 255; }
  return out;
}
function frames(src) {
  return [lean(src.k7, 2, 6),      // bent over the bow: the hands are on it (the right hand sits on the bow lying at row 123)
          lean(src.k6, 1, 3)];     // coming up with it: the hand over the bow's grip, the lean halved
}
module.exports = { DT, frames, load };

if (require.main === module && process.argv[2] === "--preview") {
  const src = load(), F = [src.k7].concat(frames(src), [src.k6]), dir = path.join(ROOT, "docs", "previews"); fs.mkdirSync(dir, { recursive: true });
  const X0 = 124, Y0 = 92, CW = 60, CH = 40, S = 8, bg = (x, y) => (((x >> 4) + (y >> 4)) % 2 ? [58, 64, 74] : [74, 80, 92]);
  const paint = (img, f, ox, scale) => { for (let y = 0; y < CH * scale; y++) for (let x = 0; x < CW * scale; x++) { const sx = X0 + Math.floor(x / scale), sy = Y0 + Math.floor(y / scale), p = (sy * f.w + sx) * 4; let c = bg(x + ox, y); if (f.data[p + 3]) c = [f.data[p], f.data[p + 1], f.data[p + 2]];
    const q = (y * img.w + ox + x) * 4; img.data[q] = c[0]; img.data[q + 1] = c[1]; img.data[q + 2] = c[2]; img.data[q + 3] = 255; } };
  const sheet = { w: F.length * CW * S, h: CH * S, data: Buffer.alloc(F.length * CW * S * CH * S * 4) };
  F.forEach((f, k) => paint(sheet, f, k * CW * S, S));
  png.encode(sheet, path.join(dir, "ranger_grab.png"));
  console.log("wrote docs/previews/ranger_grab.png (kneel 7, grab 1, grab 2, kneel 6)");
}

if (require.main === module && process.argv[2] === "--install") {
  const L = require("../bosses/lib.js"), src = load(), F = frames(src), dir = "assets/Leaf_Ranger/mercy";
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  const files = F.map((img, i) => { const f = dir + "/Ranger_Grab_" + (i + 1) + ".png"; png.encode(img, path.join(ROOT, f)); return f; });
  const project = L.readJson("Soul Rush.json"); L.registerImages(project, files); L.writeJson("Soul Rush.json", project);
  const scene = L.readJson("layouts/leaf_ranger_fight.json"), obj = scene.objects.find(o => o.name === "Leaf_Ranger");
  const anim = L.animation("Ranger_BowGrab", files.map(image => ({ image, origin: src.origin, mask: src.mask, points: src.points })), DT, false);
  const i = obj.animations.findIndex(a => a.name === "Ranger_BowGrab"); if (i >= 0) obj.animations[i] = anim; else obj.animations.push(anim);
  L.writeJson("layouts/leaf_ranger_fight.json", scene);
  console.log("Ranger_BowGrab (" + files.length + " frames) added to Leaf_Ranger");
}
