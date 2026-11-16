// The player's kneeling pose for petting the Cat (the hidden ending of the cat fight). The sprites have no kneel, so it is built
// from pieces of the idle frame (facing right; the game flips it): the head and body sink, the back leg goes down on one knee (its
// shin, turned on its side, lies along the ground), the front leg's knee comes up with the thigh level and the shin upright, and the
// front arm is DRAWN as a rigid arm (upper arm, forearm, a gold gauntlet) that reaches out, so nothing is stretched or smeared.
//
// Output: assets/Player/Pet/Player_Pet_1..4.png (stand, half way down, kneeling, reaching) and Player_PetStroke_1..4.png (the hand
// stroking). Animations on the Player object: Player_Pet (4 frames, 0.14 s, not looping: holds the reach) and Player_PetStroke
// (4 frames, 0.2 s, looping). Close GDevelop first. Safe to run again. `node tools/fx/player_pet.js --preview out.png` writes a
// contact sheet of the frames instead of touching the project.
const fs = require("fs");
const path = require("path");
const png = require("../bosses/png.js");
const ROOT = path.join(__dirname, "..", "..");
const idle = png.decode(path.join(ROOT, "assets/Player/Player_Idle.png")), W = idle.w, H = idle.h;
const blank = () => ({ w: W, h: H, data: Buffer.alloc(W * H * 4) });
const at = (img, x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return null; const p = (y * W + x) * 4; return img.data[p + 3] ? [img.data[p], img.data[p + 1], img.data[p + 2], 255] : null; };
const put = (img, x, y, c) => { if (!c || x < 0 || y < 0 || x >= W || y >= H) return; const p = (y * W + x) * 4; img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255; };
// The sprite's own palette.
const STEEL = [136, 145, 157], DARK = [26, 14, 19], MID = [75, 73, 94], LIGHT = [202, 213, 215], GOLD_D = [136, 107, 46], GOLD_L = [195, 153, 66], BROWN = [80, 60, 31];

// Copy a rectangle of the idle frame, moved by (dx, dy), skipping pixels `skip(x, y)` says no to.
function copy(dst, x0, y0, x1, y1, dx, dy, skip) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!skip || !skip(x, y)) put(dst, x + dx, y + dy, at(idle, x, y)); }
// Copy a rectangle turned a quarter turn clockwise (its top goes to the right), with its right end at xr and bottom at yb.
function copyTurned(dst, x0, y0, x1, y1, xr, yb) {
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(dst, xr - (h - 1 - y), yb - (w - 1) + x, at(idle, x0 + x, y0 + y));
}
// A rigid limb: a 3 px thick strip along each segment of `pts`, lit on top, shaded below, with a dark outline round it.
function limb(pts, color) {
  const L = blank();
  for (let s = 0; s + 1 < pts.length; s++) {
    const [ax, ay] = pts[s], [bx, by] = pts[s + 1], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
    for (let i = 0; i <= n; i++) { const x = Math.round(ax + (bx - ax) * i / n), y = Math.round(ay + (by - ay) * i / n); put(L, x, y - 1, LIGHT); put(L, x, y, color || STEEL); put(L, x, y + 1, MID); }
  }
  return L;
}
function outline(img, only) {
  const add = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!at(img, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(img, x + dx, y + dy))) add.push([x, y]);
  for (const [x, y] of add) put(img, x, y, DARK);
}
function over(dst, src) { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(dst, x, y, at(src, x, y)); }
// A gold gauntlet (a fist with a lighter top) with its upper left corner at (x, y).
function fist(img, x, y) {
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) put(img, x + i, y + j, j === 0 ? GOLD_L : j === 1 ? (i === 3 ? GOLD_D : GOLD_L) : GOLD_D);
  put(img, x + 3, y + 3, BROWN); put(img, x, y + 3, BROWN);
}

// The idle body, parts: the torso and head are rows 43 to 69, the front (right) arm is the strip right of x 60, legs are rows 70 to 79.
const inFrontArm = (x, y) => x >= 61 && y >= 54 && y <= 68;
function kneel(arm) {
  const out = blank(), S = 7, L = 1;
  // Head and torso sink (and lean toward the cat); the front arm is left out and drawn again below.
  copy(out, 38, 43, 70, 69, L, S, inFrontArm);
  // The back leg: down on the knee. Its thigh goes straight down from the hip, the shin lies along the ground pointing back.
  for (let y = 73; y <= 78; y++) { put(out, 50, y, DARK); for (let x = 51; x <= 54; x++) put(out, x, y, x === 51 ? LIGHT : x === 54 ? MID : STEEL); put(out, 55, y, DARK); }
  copyTurned(out, 49, 70, 53, 79, 55, 79);
  for (let x = 51; x <= 54; x++) put(out, x, 76, x === 51 ? LIGHT : STEEL); // the knee plate, on the ground
  // The front leg: thigh level with the hip, knee forward, shin upright, foot flat.
  for (let x = 57; x <= 65; x++) { put(out, x, 71, LIGHT); put(out, x, 72, STEEL); put(out, x, 73, STEEL); put(out, x, 74, MID); put(out, x, 75, DARK); }
  copy(out, 55, 70, 62, 79, 6, 0);
  for (let y = 71; y <= 74; y++) put(out, 66, y, y === 71 ? LIGHT : STEEL);   // the knee
  // The front arm.
  if (arm.draw) arm.draw(out); else { const A = limb(arm.pts); fist(A, arm.hand[0], arm.hand[1]); outline(A); over(out, A); }
  return out;
}
// Half way down: the old squash (torso down and forward, legs shortened) is enough for one 0.14 s frame.
function half() {
  const out = blank(), sink = 4, lean = 1;
  for (let y = 43; y <= 79; y++) for (let x = 0; x < W; x++) {
    if (y < 62) put(out, x + Math.round(lean * (1 - (y - 43) / 19)), y + sink, at(idle, x, y));
    else { const rows = 18, nl = rows - sink, ty = 80 - nl + Math.floor((y - 62) * nl / rows); put(out, x + 1, Math.min(79, ty), at(idle, x, y)); }
  }
  return out;
}
// The arm poses: shoulder at the torso's front, then elbow and wrist. `hand` is the fist's corner.
const SH = [60, 64];
const ARMS = {
  rest: { pts: [SH, [62, 68], [65, 70]], hand: [65, 69] },
  reach: { pts: [SH, [64, 67], [70, 68]], hand: [70, 67] },
  stroke1: { pts: [SH, [64, 67], [70, 68]], hand: [70, 67] },
  stroke2: { pts: [SH, [63, 68], [69, 70]], hand: [69, 69] },
  stroke3: { pts: [SH, [65, 66], [72, 67]], hand: [72, 66] }
};
function frames() {
  return {
    pet: [idle, half(), kneel(ARMS.rest), kneel(ARMS.reach)],
    stroke: [kneel(ARMS.stroke1), kneel(ARMS.stroke2), kneel(ARMS.stroke3), kneel(ARMS.stroke2)]
  };
}
module.exports = { frames, kneel, limb, fist, outline, over, blank, put, at, STEEL, DARK, MID, LIGHT, GOLD_D, GOLD_L, BROWN };

if (require.main === module) {
  const F = frames(), all = process.env.ONLY ? process.env.ONLY.split(",").map(n => F.pet.concat(F.stroke)[+n]) : F.pet.concat(F.stroke);
  if (process.argv[2] === "--preview") {
    // A contact sheet: 60 px wide crops at 6x.
    const S = Number(process.env.ZOOM || 6), cw = 60, ch = 40, out = { w: cw * S * all.length, h: ch * S, data: Buffer.alloc(cw * S * all.length * ch * S * 4) };
    for (let i = 0; i < out.data.length / 4; i++) { const v = ((i % out.w >> 4) + (Math.floor(i / out.w) >> 4)) % 2 ? 70 : 90; out.data[i * 4] = v; out.data[i * 4 + 1] = v; out.data[i * 4 + 2] = v + 10; out.data[i * 4 + 3] = 255; }
    all.forEach((img, k) => { for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const c = at(img, 36 + x, 40 + y); if (!c) continue; for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) put2(out, k * cw * S + x * S + xx, y * S + yy, c); } });
    function put2(im, x, y, c) { const p = (y * im.w + x) * 4; im.data[p] = c[0]; im.data[p + 1] = c[1]; im.data[p + 2] = c[2]; }
    png.encode(out, process.argv[3]); console.log("preview written");
  } else {
    const files = a => a.map((img, i) => null);
    const write = (list, name) => list.map((img, i) => { const f = "assets/Player/Pet/" + name + "_" + (i + 1) + ".png"; fs.mkdirSync(path.join(ROOT, "assets/Player/Pet"), { recursive: true }); png.encode(img, path.join(ROOT, f)); return { f, img }; });
    const pet = write(F.pet, "Player_Pet"), stroke = write(F.stroke, "Player_PetStroke");
    const pf = path.join(ROOT, "Soul Rush.json"), raw = fs.readFileSync(pf, "utf8"), P = JSON.parse(raw), pl = P.objects.find(o => o.name === "Player");
    const have = new Set(P.resources.resources.map(r => r.name));
    for (const { f } of pet.concat(stroke)) if (!have.has(f)) P.resources.resources.push({ file: f, kind: "image", metadata: JSON.stringify({ localFilePath: f, extension: ".png" }), name: f, smoothed: false, userAdded: false });
    // The hurtbox: the idle one's width, and each pose's own height.
    const idleMask = pl.animations.find(a => a.name === "Player_Idle").directions[0].sprites[0].customCollisionMask[0];
    const x0 = Math.min(...idleMask.map(v => v.x)), x1 = Math.max(...idleMask.map(v => v.x));
    const anim = (name, list, dt, loop) => ({ name, useMultipleDirections: false, directions: [{ looping: loop, metadata: "{\"pskl\":{}}", timeBetweenFrames: dt,
      sprites: list.map(({ f, img }) => { const b = png.bbox(img); return { hasCustomCollisionMask: true, image: f, points: [], originPoint: { name: "origine", x: 0, y: 0 }, centerPoint: { automatic: true, name: "centre", x: 0, y: 0 },
        customCollisionMask: [[{ x: x0, y: b.y0 }, { x: x1, y: b.y0 }, { x: x1, y: b.y1 + 1 }, { x: x0, y: b.y1 + 1 }]] }; }) }] });
    for (const a of [anim("Player_Pet", pet, 0.14, false), anim("Player_PetStroke", stroke, 0.2, true)]) { const i = pl.animations.findIndex(x => x.name === a.name); if (i >= 0) pl.animations[i] = a; else pl.animations.push(a); }
    fs.writeFileSync(pf, JSON.stringify(P, null, 2) + (raw.endsWith("\n") ? "\n" : ""));
    console.log("Player_Pet (4 frames) and Player_PetStroke (4 frames)");
  }
}
