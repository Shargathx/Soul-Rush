// The Desperation glow on the blade ITSELF: cuts the blade out of the player's eight deflect frames (the steel pixels connected to the
// frame's Blade point) and paints them teal, as frames of a global sprite object Player_Blade_Glow whose animations are named like the
// Player's deflect animations (Player_Deflect_1 = A1..A4, Player_Deflect_2 = B1..B4). The glow script in Combat_Shared lays that sprite
// exactly over the player (same animation, frame, size, flip, position) for 0.3 s, additive and fading, so only the blade turns teal.
// Output: assets/Player/Deflect/BladeGlow_A1..B4.png. Writes the object and resources into Soul Rush.json. Close GDevelop first. Safe to rerun.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const png = require("../bosses/png.js");
const ROOT = path.join(__dirname, "..", "..");
const DIR = "assets/Player/Deflect/";
const FRAMES = [["Player_Deflect_1", "A", [72, 44]], ["Player_Deflect_2", "B", [80, 50]]];
const isSteel = (r, g, b) => r >= 150 && g >= 160 && b >= 160 && Math.max(r, g, b) - Math.min(r, g, b) <= 40;   // the blade's light greys, not the armour's darker ones or the gold
const TEAL_DARK = [30, 170, 160], TEAL_LIGHT = [190, 255, 246];
function bladeOf(img, [px, py]) {
  const W = img.w, H = img.h, at = (x, y) => { const p = (y * W + x) * 4; return img.data[p + 3] === 255 ? [img.data[p], img.data[p + 1], img.data[p + 2]] : null; };
  // Start from the nearest steel pixel to the Blade point, then take every steel pixel connected to it.
  let start = null, best = 1e9;
  for (let y = Math.max(0, py - 16); y < Math.min(H, py + 17); y++) for (let x = Math.max(0, px - 16); x < Math.min(W, px + 17); x++) { const c = at(x, y); if (c && isSteel(...c)) { const d = (x - px) ** 2 + (y - py) ** 2; if (d < best) { best = d; start = [x, y]; } } }
  const out = { w: W, h: H, data: Buffer.alloc(W * H * 4) }, seen = new Uint8Array(W * H), stack = start ? [start] : [];
  let count = 0;
  while (stack.length) {
    const [x, y] = stack.pop(); if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x]) continue; seen[y * W + x] = 1;
    const c = at(x, y); if (!c || !isSteel(...c)) continue;
    const t = Math.min(1, Math.max(0, (c[0] - 150) / 80)), q = (y * W + x) * 4;       // brighter steel, brighter teal
    for (let k = 0; k < 3; k++) out.data[q + k] = Math.round(TEAL_DARK[k] + (TEAL_LIGHT[k] - TEAL_DARK[k]) * t);
    out.data[q + 3] = 255; count++;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) stack.push([x + dx, y + dy]);
  }
  return { img: out, count };
}
const pf = path.join(ROOT, "Soul Rush.json"), raw = fs.readFileSync(pf, "utf8"), P = JSON.parse(raw);
const have = new Set(P.resources.resources.map(r => r.name)), animations = [];
for (const [anim, letter, point] of FRAMES) {
  const sprites = [];
  for (let n = 1; n <= 4; n++) {
    const src = png.decode(path.join(ROOT, DIR + "Player_Deflect_" + letter + n + ".png")), { img, count } = bladeOf(src, point);
    if (count < 15) throw new Error("no blade found in " + letter + n + " (" + count + " pixels)");
    const file = DIR + "BladeGlow_" + letter + n + ".png"; png.encode(img, path.join(ROOT, file));
    if (!have.has(file)) P.resources.resources.push({ file, kind: "image", metadata: JSON.stringify({ localFilePath: file, extension: ".png" }), name: file, smoothed: false, userAdded: false });
    sprites.push({ hasCustomCollisionMask: false, image: file, points: [], originPoint: { name: "origine", x: 0, y: 0 }, centerPoint: { automatic: true, name: "centre", x: 0, y: 0 }, customCollisionMask: [] });
    console.log(letter + n + ": " + count + " blade pixels");
  }
  animations.push({ name: anim, useMultipleDirections: false, directions: [{ looping: false, metadata: "{\"pskl\":{}}", timeBetweenFrames: 0.07, sprites }] });
}
const existing = P.objects.findIndex(o => o.name === "Player_Blade_Glow");
const obj = { adaptCollisionMaskAutomatically: false, assetStoreId: "", name: "Player_Blade_Glow", persistentUuid: existing >= 0 ? P.objects[existing].persistentUuid : crypto.randomUUID(), type: "Sprite", updateIfNotVisible: false, variables: [], effects: [], behaviors: [], animations };
if (existing >= 0) P.objects[existing] = obj; else P.objects.push(obj);
fs.writeFileSync(pf, JSON.stringify(P, null, 2) + (raw.endsWith("\n") ? "\n" : ""));
console.log("Player_Blade_Glow: 2 animations");
