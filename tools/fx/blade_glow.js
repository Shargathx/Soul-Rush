// The Desperation glow on the blade ITSELF. The blade is cut out of each of the player's eight deflect frames (the steel pixels connected
// to the frame's Blade point) and painted teal; the result is a full copy of the frame with a teal blade. Those copies are two extra
// animations on the Player object, Player_Deflect_1_Teal and Player_Deflect_2_Teal (same frames, points, hurtboxes and timing as the
// originals). The glow script in Combat_Shared switches the Player to the _Teal twin of the deflect animation it is playing, on the same frame,
// when a deflect only worked thanks to Desperation: the rest of that deflect is drawn with a teal blade, in the player's own sprite, so
// nothing has to line up and nothing has to be created.
// (An earlier version laid a separate overlay sprite over the player; it never showed in the game, so it was dropped.)
// Output: assets/Player/Deflect/Player_DeflectTeal_A1..B4.png. Edits Soul Rush.json (animations, resources). Close GDevelop first. Safe to rerun.
const fs = require("fs");
const path = require("path");
const png = require("../bosses/png.js");
const ROOT = path.join(__dirname, "..", "..");
const DIR = "assets/Player/Deflect/";
const SETS = [["Player_Deflect_1", "A", [72, 44]], ["Player_Deflect_2", "B", [80, 50]]];
const isSteel = (r, g, b) => r >= 150 && g >= 160 && b >= 160 && Math.max(r, g, b) - Math.min(r, g, b) <= 40;   // the blade's light greys, not the armour's darker ones or the gold
const TEAL_DARK = [20, 190, 175], TEAL_LIGHT = [150, 255, 240];
function tealBlade(img, [px, py]) {
  const W = img.w, H = img.h, out = { w: W, h: H, data: Buffer.from(img.data) };
  const at = (x, y) => { const p = (y * W + x) * 4; return img.data[p + 3] === 255 ? [img.data[p], img.data[p + 1], img.data[p + 2]] : null; };
  let start = null, best = 1e9;
  for (let y = Math.max(0, py - 16); y < Math.min(H, py + 17); y++) for (let x = Math.max(0, px - 16); x < Math.min(W, px + 17); x++) { const c = at(x, y); if (c && isSteel(...c)) { const d = (x - px) ** 2 + (y - py) ** 2; if (d < best) { best = d; start = [x, y]; } } }
  const seen = new Uint8Array(W * H), stack = start ? [start] : []; let count = 0;
  while (stack.length) {
    const [x, y] = stack.pop(); if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x]) continue; seen[y * W + x] = 1;
    const c = at(x, y); if (!c || !isSteel(...c)) continue;
    const t = Math.min(1, Math.max(0, (c[0] - 150) / 80)), q = (y * W + x) * 4;                 // brighter steel, brighter teal
    for (let k = 0; k < 3; k++) out.data[q + k] = Math.round(TEAL_DARK[k] + (TEAL_LIGHT[k] - TEAL_DARK[k]) * t);
    count++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) stack.push([x + dx, y + dy]);
  }
  return { img: out, count };
}
const pf = path.join(ROOT, "Soul Rush.json"), raw = fs.readFileSync(pf, "utf8"), P = JSON.parse(raw), pl = P.objects.find(o => o.name === "Player");
// Drop the earlier overlay attempt (object, its frames and resources).
P.objects = P.objects.filter(o => o.name !== "Player_Blade_Glow");
P.resources.resources = P.resources.resources.filter(r => !/\/BladeGlow_/.test(r.name));
for (const n of fs.readdirSync(path.join(ROOT, DIR)).filter(n => /^BladeGlow_/.test(n))) fs.unlinkSync(path.join(ROOT, DIR, n));
const have = new Set(P.resources.resources.map(r => r.name));
for (const [anim, letter, point] of SETS) {
  const orig = pl.animations.find(a => a.name === anim), twin = JSON.parse(JSON.stringify(orig));
  twin.name = anim + "_Teal";
  twin.directions[0].sprites.forEach((s, i) => {
    const src = png.decode(path.join(ROOT, s.image)), { img, count } = tealBlade(src, point);
    if (count < 15) throw new Error("no blade found in " + s.image + " (" + count + " pixels)");
    const file = DIR + "Player_DeflectTeal_" + letter + (i + 1) + ".png"; png.encode(img, path.join(ROOT, file));
    if (!have.has(file)) P.resources.resources.push({ file, kind: "image", metadata: JSON.stringify({ localFilePath: file, extension: ".png" }), name: file, smoothed: false, userAdded: false });
    s.image = file; console.log(letter + (i + 1) + ": " + count + " blade pixels");
  });
  const k = pl.animations.findIndex(a => a.name === twin.name); if (k >= 0) pl.animations[k] = twin; else pl.animations.push(twin);
}
fs.writeFileSync(pf, JSON.stringify(P, null, 2) + (raw.endsWith("\n") ? "\n" : ""));
console.log("Player_Deflect_1_Teal and Player_Deflect_2_Teal");
