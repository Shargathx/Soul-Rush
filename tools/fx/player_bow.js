// The player's bow (for the Samurai's mercy: they bow to each other). The sprites have no bow, so it is built from the idle frame
// (facing right; the game flips it): the head and torso fold forward from the hips while the legs stay planted, like a formal bow.
// Each torso row moves right and down by an amount that grows toward the head, so the pixels stay crisp (no rotation blur).
//
//   node tools/fx/player_bow.js --preview     writes docs/previews/player_bow.png/.gif (the full bow) and player_nod.png/.gif (head only), touches nothing else
const fs = require("fs");
const path = require("path");
const png = require("../bosses/png.js");
const ROOT = path.join(__dirname, "..", "..");
const idle = png.decode(path.join(ROOT, "assets/Player/Player_Idle.png")), W = idle.w, H = idle.h;
const blank = () => ({ w: W, h: H, data: Buffer.alloc(W * H * 4) });
const at = (img, x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return null; const p = (y * W + x) * 4; return img.data[p + 3] ? [img.data[p], img.data[p + 1], img.data[p + 2], 255] : null; };
const put = (img, x, y, c) => { if (!c || x < 0 || y < 0 || x >= W || y >= H) return; const p = (y * W + x) * 4; img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255; };

const TOP = 43, HEAD = 51, CUT = 61, WAIST = 69;   // helmet rows 43 to 50 (turns), chest and collar 49 to 60 (moves flat), belt and hips 61 to 69 and legs 70 to 79 (stay)
const NECK = [56.5, 50];                            // the helmet turns about the neck
const isRed = c => c && c[0] > c[1] + 30 && c[0] > c[2] + 40;                  // the collar's red: part of the chest, never of the helmet
const isHelm = (x, y) => { const c = at(idle, x, y); return !!c && y < HEAD && !isRed(c); };
// One pose, like the Samurai's bow: the chest moves as ONE flat piece, `lean` pixels forward and `sink` down (no squashing). The helmet
// is turned forward `deg` degrees about the neck (pixels copied back from the idle helmet, nearest, so they stay crisp) so he looks at
// the ground. The helmet is drawn after the chest, the belt and hips over both: the chest sinks behind the belt instead of leaving a gap.
function pose(lean, sink, deg) {
  const out = blank();
  for (let y = 49; y < CUT; y++) for (let x = 0; x < W; x++) if (!isHelm(x, y)) put(out, x + lean, y + sink, at(idle, x, y));
  const th = deg * Math.PI / 180, c = Math.cos(th), sn = Math.sin(th), nx = NECK[0] + lean, ny = NECK[1] + sink;
  for (let y = 30; y < 70; y++) for (let x = 20; x < 100; x++) {
    const rx = x + 0.5 - nx, ry = y + 0.5 - ny, sx = Math.floor(NECK[0] + c * rx + sn * ry), sy = Math.floor(NECK[1] - sn * rx + c * ry);   // turn back by deg
    if (sy >= TOP && isHelm(sx, sy)) put(out, x, y, at(idle, sx, sy));
  }
  const hip = Math.round(lean / 2);
  for (let y = CUT; y <= WAIST; y++) for (let x = 0; x < W; x++) put(out, x + hip, y, at(idle, x, y));
  for (let y = WAIST + 1; y < H; y++) for (let x = 0; x < W; x++) put(out, x, y, at(idle, x, y));
  return out;
}
// Stand, lean in, bow with the head tipping down, hold, hold, rise (8 frames, like the Samurai's).
const BOW = [[0, 0, 0], [1, 1, 8], [3, 2, 16], [5, 4, 24], [6, 5, 30], [6, 5, 30], [3, 3, 16], [1, 1, 8]];
// The nod (the smaller one): only the helmet moves, 0 to 20 degrees, the body stays as it is.
const NOD = [[0, 0, 0], [0, 0, 5], [0, 0, 11], [0, 0, 17], [0, 0, 20], [0, 0, 20], [0, 0, 10], [0, 0, 4]];
const VARIANTS = { player_bow: BOW, player_nod: NOD };
const POSES = BOW;
const frames = (poses = BOW) => poses.map(p => pose(...p));
module.exports = { frames, BOW, NOD, VARIANTS };

if (require.main === module) {
  for (const [name, poses] of Object.entries(VARIANTS)) {
  const F = frames(poses), S = 6, cw = 56, ch = 40, x0 = 34, y0 = 40, dir = path.join(ROOT, "docs", "previews");
  fs.mkdirSync(dir, { recursive: true });
  const bgAt = (x, y) => { const v = (((x >> 4) + (y >> 4)) % 2) ? 70 : 90; return [v, v, v + 10]; };
  // Draws frame k at 6x into `out` at column offset ox.
  const draw = (out, img, ox, scale) => { for (let y = 0; y < ch * scale; y++) for (let x = 0; x < cw * scale; x++) { const c = at(img, x0 + Math.floor(x / scale), y0 + Math.floor(y / scale)) || bgAt(x, y), p = (y * out.w + ox + x) * 4; out.data[p] = c[0]; out.data[p + 1] = c[1]; out.data[p + 2] = c[2]; out.data[p + 3] = 255; } };
  const sheet = { w: cw * S * F.length, h: ch * S, data: Buffer.alloc(cw * S * F.length * ch * S * 4) };
  F.forEach((f, k) => draw(sheet, f, k * cw * S, S));
  png.encode(sheet, path.join(dir, name + ".png"));
  const gif = require("./gif.js"), G = 5, fr = F.map(f => { const o = { w: cw * G, h: ch * G, data: Buffer.alloc(cw * G * ch * G * 4) }; draw(o, f, 0, G); return o; });
  fs.writeFileSync(path.join(dir, name + ".gif"), gif.encode(fr, poses.map((p, i) => i === 0 ? 30 : i === 4 || i === 5 ? 25 : 12)));
  console.log("wrote docs/previews/" + name + ".png and .gif");
}
}
