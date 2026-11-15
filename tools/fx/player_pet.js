// The player's kneeling pose for petting the Cat (the hidden ending of the cat fight): the sprites have no kneel, so it is made from
// the idle frame, facing right (the game flips it): the legs are squashed so the body sinks, and the upper body leans forward a few
// pixels. Three frames (standing, half, kneeling) in assets/Player/Pet and an animation Player_Pet on the Player object (3 frames,
// 0.12 s, not looping: it holds the last frame). Close GDevelop first. Safe to run again.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const png = require("../bosses/png.js");
const ROOT = path.join(__dirname, "..", "..");
const idle = png.decode(path.join(ROOT, "assets/Player/Player_Idle.png")), box = png.bbox(idle);
const legTop = Math.round(box.y0 + (box.y1 - box.y0) * 0.56);
function pose(sink, lean) {
  const out = { w: idle.w, h: idle.h, data: Buffer.alloc(idle.w * idle.h * 4) };
  const legRows = box.y1 + 1 - legTop, newLegs = Math.max(2, legRows - sink);
  const put = (sx, sy, dx, dy) => { if (dx < 0 || dy < 0 || dx >= idle.w || dy >= idle.h) return; const a = (sy * idle.w + sx) * 4, b = (dy * idle.w + dx) * 4; if (idle.data[a + 3]) idle.data.copy(out.data, b, a, a + 4); };
  for (let y = box.y0; y <= box.y1; y++) for (let x = 0; x < idle.w; x++) {
    if (y < legTop) { const t = (y - box.y0) / Math.max(1, legTop - box.y0); put(x, y, x + Math.round(lean * (1 - t)), y + sink); }          // torso and head: down, leaning forward
    else { const ty = box.y1 + 1 - newLegs + Math.floor((y - legTop) * newLegs / legRows); put(x, y, x + Math.round(lean * 0.3), Math.min(box.y1, ty)); }   // legs: squashed
  }
  return out;
}
const frames = [[0, 0], [6, 2], [13, 5]].map(([s, l], i) => { const f = "assets/Player/Pet/Player_Pet_" + (i + 1) + ".png"; fs.mkdirSync(path.join(ROOT, "assets/Player/Pet"), { recursive: true }); const img = i === 0 ? idle : pose(s, l); png.encode(img, path.join(ROOT, f)); return { f, img }; });
const pf = path.join(ROOT, "Soul Rush.json"), P = JSON.parse(fs.readFileSync(pf, "utf8")), pl = P.objects.find(o => o.name === "Player");
const have = new Set(P.resources.resources.map(r => r.name));
for (const { f } of frames) if (!have.has(f)) P.resources.resources.push({ file: f, kind: "image", metadata: JSON.stringify({ localFilePath: f, extension: ".png" }), name: f, smoothed: false, userAdded: false });
// The hurtbox is the idle one's width and the pose's own height.
const idleMask = pl.animations.find(a => a.name === "Player_Idle").directions[0].sprites[0].customCollisionMask[0];
const x0 = Math.min(...idleMask.map(v => v.x)), x1 = Math.max(...idleMask.map(v => v.x));
const anim = { name: "Player_Pet", useMultipleDirections: false, directions: [{ looping: false, metadata: "{\"pskl\":{}}", timeBetweenFrames: 0.12,
  sprites: frames.map(({ f, img }) => { const b = png.bbox(img); return { hasCustomCollisionMask: true, image: f, points: [], originPoint: { name: "origine", x: 0, y: 0 }, centerPoint: { automatic: true, name: "centre", x: 0, y: 0 },
    customCollisionMask: [[{ x: x0, y: b.y0 }, { x: x1, y: b.y0 }, { x: x1, y: b.y1 + 1 }, { x: x0, y: b.y1 + 1 }]] }; }) }] };
const i = pl.animations.findIndex(a => a.name === "Player_Pet"); if (i >= 0) pl.animations[i] = anim; else pl.animations.push(anim);
fs.writeFileSync(pf, JSON.stringify(P, null, 2) + "\n");
console.log("Player_Pet: 3 frames, legs from row " + legTop);
