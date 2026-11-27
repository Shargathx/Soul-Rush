// The player's hipshot for Pistol parry (tools/powers/runtime.js). The sprites have no gun, so the frames are built from the idle frame
// (facing right; the game flips it): the body dips a little, and his NEAR arm (the one facing the camera) is drawn again with a level
// revolver in the hand, held at the hip. Six frames: the draw, the level, the SHOT (muzzle
// flash), two frames of kick with smoke, and the gun going back down.
//
// Output: assets/Player/Pistol/Player_Pistol_1..6.png and the animation Player_Pistol on the Player (6 frames, 0.06 s, not looping;
// the shot is frame 3, at 0.12 s). Close GDevelop first. Safe to run again. `--preview out.png` writes a contact sheet instead.
const fs = require("fs");
const path = require("path");
const png = require("../bosses/png.js");
const ROOT = path.join(__dirname, "..", "..");
const idle = png.decode(path.join(ROOT, "assets/Player/Player_Idle.png")), W = idle.w, H = idle.h;
const blank = () => ({ w: W, h: H, data: Buffer.alloc(W * H * 4) });
const at = (img, x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return null; const p = (y * W + x) * 4; return img.data[p + 3] ? [img.data[p], img.data[p + 1], img.data[p + 2], img.data[p + 3]] : null; };
const put = (img, x, y, c, a) => { if (!c || x < 0 || y < 0 || x >= W || y >= H) return; const p = (y * W + x) * 4; img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = a === undefined ? 255 : a; };
const DARK = [26, 14, 19], MID = [75, 73, 94], STEEL = [136, 145, 157], LIGHT = [202, 213, 215], BROWN = [80, 60, 31], WOOD = [128, 84, 42], BRASS = [195, 153, 66];
const GOLD_D = [136, 107, 46];
const WHITE = [255, 252, 230], YELLOW = [255, 214, 90], ORANGE = [240, 128, 40], SMOKE = [190, 190, 200];
const line = (a, b, fn) => { const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1); for (let i = 0; i <= n; i++) fn(Math.round(a[0] + (b[0] - a[0]) * i / n), Math.round(a[1] + (b[1] - a[1]) * i / n), i, n); };

// g is laid over img. With rim, a dark outline goes round it first: ONLY the pistol has one, the arm and glove never do (the user's call).
function stamp(img, g, rim) {
  if (rim) {
    const edge = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!at(g, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(g, x + dx, y + dy))) edge.push([x, y]);
    for (const [x, y] of edge) put(g, x, y, DARK);
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = at(g, x, y); if (c) put(img, x, y, c); }
}
// A revolver. It is ONE rigid shape that always lies level (a tilted barrel breaks into steps and looks bent): the recoil only moves
// it back and up. (x, y) is the top left of its frame; the grip runs down into the fist. Returns the muzzle's tip.
const GUN_LENGTH = 10, IRON = [52, 50, 64], SHINE = [112, 116, 132];
function revolver(img, x, y) {
  const g = blank();
  for (const [dx, dy, c] of [[0, 3, WOOD], [1, 3, BROWN], [0, 4, WOOD], [1, 4, BROWN], [-1, 5, WOOD], [0, 5, BROWN]]) put(g, x + dx, y + dy, c);   // the grip
  for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) put(g, x + i, y + j, j === 0 ? SHINE : IRON);         // the frame and cylinder
  for (let i = 1; i <= 3; i++) { put(g, x + i, y - 1, SHINE); put(g, x + i, y + 3, IRON); }                  // the drum is fatter than the frame
  for (let i = 1; i <= 3; i++) put(g, x + i, y + 1, i === 2 ? LIGHT : STEEL);                                 // its shine, and the flutes
  put(g, x + 2, y + 2, MID);                                                    // the flute between the chambers
  put(g, x, y - 1, SHINE);                                                                                    // the hammer
  put(g, x + 2, y + 3, BRASS);                                                                                // the trigger guard
  for (let i = 4; i <= GUN_LENGTH; i++) { put(g, x + i, y, SHINE); put(g, x + i, y + 1, IRON); }              // the barrel: dead straight
  put(g, x + GUN_LENGTH, y, LIGHT);                                                                           // the glint on the muzzle
  stamp(img, g, true);
  return [x + GUN_LENGTH, y];
}
// His NEAR arm (the one that faces the camera, on the left of the sprite), in its own colours: a gold upper arm from the shoulder
// plate down to the elbow, held back at his side, a steel forearm coming forward at waist height, and (over the grip) a gold glove.
function nearArm(img, shoulder, elbow, wrist) {
  const g = blank();
  // A square brush along the bone, shaded by the side of it a pixel lies on, so the width stays the same however the limb lies.
  const limb = (from, to, shade) => {
    line(from, to, (x, y, i, n) => { for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) put(g, x + k, y + j, shade(k, j, i, n)); });
  };
  limb(shoulder, elbow, k => (k < 1 ? BRASS : GOLD_D));                                                       // the upper arm: lit on the camera side
  limb(elbow, wrist, (k, j) => (j < 0 ? LIGHT : j === 0 ? STEEL : MID));                                     // the forearm: light on top, shaded under
  line(elbow, wrist, (x, y, i) => { if (i === 4) for (let j = -1; j <= 1; j++) put(g, x, y + j, BROWN); });   // one thin leather strap
  for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) put(g, elbow[0] + k, elbow[1] + j, j < 1 && k < 1 ? BRASS : GOLD_D);   // the elbow plate
  stamp(img, g);
}
function glove(img, x, y) {
  const g = blank();
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) put(g, x + i, y + j, j === 0 || i === 0 ? BRASS : GOLD_D);
  stamp(img, g);
}

// The muzzle flash at the barrel's tip: a white heart, a long forward tongue and four short points.
function flash(img, x, y) {
  for (let i = 1; i <= 9; i++) { put(img, x + i, y, i <= 4 ? WHITE : i <= 7 ? YELLOW : ORANGE); if (i <= 5) { put(img, x + i, y - 1, YELLOW); put(img, x + i, y + 1, YELLOW); } }
  for (let i = 2; i <= 3; i++) { put(img, x + i, y - 2, ORANGE); put(img, x + i, y + 2, ORANGE); }
  for (const [dx, dy] of [[1, -3], [1, 3], [5, -3], [5, 3], [7, -2], [7, 2]]) put(img, x + dx, y + dy, ORANGE);
  put(img, x + 2, y, WHITE);
}
function smoke(img, x, y, r, a) { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r && !at(img, x + i, y + j) && (i + j + r) % 3 !== 0) put(img, x + i, y + j, SMOKE, a); }

// The idle body without its near arm. sink: how far the upper body drops (the knees give).
const inNearArm = (x, y) => (y >= 57 && y <= 59 && x <= 49) || (y >= 60 && y <= 68 && x <= 48);
function body(out, sink) {
  for (let y = 70; y <= 79; y++) for (let x = 0; x < W; x++) put(out, x, y, at(idle, x, y));                   // the legs stay planted
  for (let y = 38; y <= 69; y++) for (let x = 0; x < W; x++) if (!inNearArm(x, y)) put(out, x, y + sink, at(idle, x, y));
}
// One frame: the sink, the near arm (elbow and wrist) with the gun in its hand, and what comes out of the gun.
function pose(o) {
  const out = blank();
  body(out, o.sink);
  nearArm(out, [48, 57 + o.sink], o.elbow, o.wrist);
  const tip = revolver(out, o.wrist[0] + 4, o.wrist[1] - 3);
  glove(out, o.wrist[0] + 1, o.wrist[1] - 1);
  const butt = blank(), gx = o.wrist[0], gy = o.wrist[1] + 2;                       // the butt of the grip shows under the fist
  for (const [dx, dy, c] of [[1, 0, WOOD], [2, 0, BROWN], [0, 1, WOOD], [1, 1, BROWN]]) put(butt, gx + dx, gy + dy, c);
  stamp(out, butt, true);
  if (o.flash) flash(out, tip[0] + 1, tip[1]);
  for (const [dx, dy, r, a] of o.smoke || []) smoke(out, tip[0] + dx, tip[1] + dy, r, a);
  return out;
}
const POSES = [
  { sink: 0, elbow: [49, 63], wrist: [52, 66] },                                       // the draw: the gun comes up by his side
  { sink: 1, elbow: [50, 62], wrist: [57, 63] },                                       // level at the hip: the elbow against his side, an open bend
  { sink: 1, elbow: [50, 62], wrist: [57, 63], flash: true },                          // the shot
  { sink: 1, elbow: [48, 61], wrist: [54, 61], smoke: [[3, -1, 2, 200]] },             // the kick: arm and gun jolt back and up, the gun still level
  { sink: 1, elbow: [49, 62], wrist: [55, 62], smoke: [[4, -4, 2, 140], [2, -8, 1, 120]] },
  { sink: 0, elbow: [49, 63], wrist: [52, 66], smoke: [[6, -12, 2, 80]] }              // back down
];
const frames = () => POSES.map(pose);
module.exports = { frames, SHOT_FRAME: 2, FRAME_TIME: 0.06 };

if (require.main === module) {
  const list = frames();
  if (process.argv[2] === "--preview") {
    const S = Number(process.env.ZOOM || 6), cw = 62, ch = 46, cols = 3, rows = 2;
    const out = { w: cw * S * cols, h: ch * S * rows, data: Buffer.alloc(cw * S * cols * ch * S * rows * 4) };
    for (let i = 0; i < out.data.length; i += 4) { out.data[i] = 70; out.data[i + 1] = 78; out.data[i + 2] = 92; out.data[i + 3] = 255; }
    list.forEach((img, k) => {
      for (let y = 0; y < ch * S; y++) for (let x = 0; x < cw * S; x++) {
        const c = at(img, 36 + Math.floor(x / S), 34 + Math.floor(y / S)); if (!c) continue;
        const d = ((Math.floor(k / cols) * ch * S + y) * out.w + (k % cols) * cw * S + x) * 4, a = c[3] / 255;
        for (let n = 0; n < 3; n++) out.data[d + n] = Math.round(out.data[d + n] * (1 - a) + c[n] * a);
      }
    });
    png.encode(out, process.argv[3]); console.log("preview written");
  } else {
    const dir = "assets/Player/Pistol"; fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
    const files = list.map((img, i) => { const f = dir + "/Player_Pistol_" + (i + 1) + ".png"; png.encode(img, path.join(ROOT, f)); return { f, img }; });
    const L = require("../bosses/lib.js"), project = L.readJson("Soul Rush.json"), pl = project.objects.find(o => o.name === "Player");
    L.registerImages(project, files.map(x => x.f));
    // The hurtbox: the idle one's width, and each pose's own height from its body (the smoke and flash are not him).
    const mask = pl.animations.find(a => a.name === "Player_Idle").directions[0].sprites[0].customCollisionMask[0];
    const x0 = Math.min(...mask.map(v => v.x)), x1 = Math.max(...mask.map(v => v.x));
    const anim = { name: "Player_Pistol", useMultipleDirections: false, directions: [{ looping: false, metadata: "{\"pskl\":{}}", timeBetweenFrames: 0.06,
      sprites: files.map(({ f }, i) => { const top = Math.min(...mask.map(v => v.y)) + POSES[i].sink; return { hasCustomCollisionMask: true, image: f, points: [], originPoint: { name: "origine", x: 0, y: 0 }, centerPoint: { automatic: true, name: "centre", x: 0, y: 0 },
        customCollisionMask: [[{ x: x0, y: top }, { x: x1, y: top }, { x: x1, y: 80 }, { x: x0, y: 80 }]] }; }) }] };
    const at_ = pl.animations.findIndex(a => a.name === anim.name); if (at_ >= 0) pl.animations[at_] = anim; else pl.animations.push(anim);
    L.writeJson("Soul Rush.json", project);
    console.log("Player_Pistol (6 frames) written.");
  }
}
