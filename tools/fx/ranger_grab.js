// The Leaf Ranger's bow grab (tools/mercy/mercy.js, ranger(), his get-up). In his kneel animation the bow lies on the ground with his hands
// hanging 7 px above it, and then it is 2 px from his hand in the next frame: it seems to jump into his hand. These two frames put the
// grab in between: his right arm reaches down and the hand takes the bow (frame 1, made from kneel frame 7), and the hand lifts it as it
// rises (frame 2, made from kneel frame 6, the hand over the bow's grip). After them his own kneel frame 5 has the hand on the bow.
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
const SLEEVE = [72, 28, 40], SKIN = [255, 181, 128], SKIN_D = [229, 128, 100];       // his own colours (the sleeve and the hand of the kneel frames)

function load() {
  const L = require("../bosses/lib.js"), scene = L.readJson("layouts/leaf_ranger_fight.json"), project = L.readJson("Soul Rush.json");
  const spr = scene.objects.find(o => o.name === "Leaf_Ranger").animations.find(a => a.name === "Ranger_kneel").directions[0].sprites;
  const img = i => png.decode(path.join(ROOT, project.resources.resources.find(r => r.name === spr[i].image).file));
  const poly = spr[7].customCollisionMask && spr[7].customCollisionMask[0] || [], xs = poly.map(p => p.x), ys = poly.map(p => p.y);
  return { k7: img(7), k6: img(6), origin: [spr[7].originPoint.x, spr[7].originPoint.y],
    mask: poly.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null, points: Object.fromEntries(spr[7].points.map(p => [p.name, [p.x, p.y]])) };
}
const clone = im => ({ w: im.w, h: im.h, data: Buffer.from(im.data) });
const put = (im, x, y, c) => { const o = (y * im.w + x) * 4; im.data[o] = c[0]; im.data[o + 1] = c[1]; im.data[o + 2] = c[2]; im.data[o + 3] = 255; };
// The right arm is two pixels wide at x 157-158: the sleeve down to row `sleeveTo`, then the hand (2 x 2, a darker row under it) down to row `handTo`.
function arm(im, sleeveFrom, sleeveTo, handTo) {
  for (let y = sleeveFrom; y <= sleeveTo; y++) for (const x of [157, 158]) put(im, x, y, SLEEVE);
  for (const x of [157, 158]) { put(im, x, handTo - 1, SKIN); put(im, x, handTo, SKIN_D); }
}
function frames(src) {
  const a = clone(src.k7); arm(a, 115, 120, 122);         // reaches down: the hand lands on the bow lying at row 123
  const b = clone(src.k6); arm(b, 115, 116, 118);         // lifts: the hand is over the bow's grip (row 118) as the bow comes up
  return [a, b];
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
