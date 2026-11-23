// The Cat's eye glint, in pixel art like the Samurai's (his dash tell is a tiny cross of red pixels with a pale core): a star of
// square pixels that grows from a single pixel to a cross with diagonal tips and shrinks away. Two colours: Yellow (the start of a
// combo, a pounce, the charge) and Red (the dangerous ones: the flurry and the maul).
// Used by tools/bosses/cat.def.js (object Cat_Glint, animations Yellow and Red, origin at the picture centre). Each art pixel is PX
// screen pixels, so the glint's pixels are a similar size to the Cat's own.
//
//   node tools/fx/cat_glint.js          writes docs/previews/cat_glint.gif and cat_glint_frames.png
const path = require("path");
const fs = require("fs");

const N = 11, PX = 6, W = N * PX, H = N * PX, FRAMES = 8, DT = 0.045;
// tip: the arms, core: the pale middle (the Samurai's glint is 255,42,60 with a 255,214,214 core).
const COLORS = { Red: { tip: [255, 42, 60], core: [255, 214, 214] }, Yellow: { tip: [255, 214, 56], core: [255, 250, 214] } };
// Per frame: the long arms' length, whether the diagonal tips are there, how many pixels long they are.
const PLAN = [{ arm: 0, diag: 0 }, { arm: 1, diag: 0 }, { arm: 2, diag: 1 }, { arm: 4, diag: 2 }, { arm: 4, diag: 2 }, { arm: 3, diag: 1 }, { arm: 2, diag: 0 }, { arm: 1, diag: 0 }];

function frame(color, n) {
  const c = COLORS[color], { arm, diag } = PLAN[n], cell = Array.from({ length: N }, () => Array(N).fill(null)), mid = (N - 1) / 2;
  const put = (dx, dy, col) => { const x = mid + dx, y = mid + dy; if (x >= 0 && y >= 0 && x < N && y < N) cell[y][x] = col; };
  for (let d = 1; d <= arm; d++) for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(sx * d, sy * d, d === 1 && arm >= 2 ? c.core : c.tip);
  for (let d = 1; d <= diag; d++) for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) put(sx * d, sy * d, c.tip);
  put(0, 0, c.core);
  if (arm >= 4) for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(sx, sy, c.core);   // a hotter middle at the peak
  const img = { w: W, h: H, data: Buffer.alloc(W * H * 4) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const col = cell[(y / PX) | 0][(x / PX) | 0]; if (!col) continue; const p = (y * W + x) * 4; img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255; }
  return img;
}
const frames = color => Array.from({ length: FRAMES }, (_, n) => frame(color, n));

module.exports = { W, H, FRAMES, DT, colors: Object.keys(COLORS), frames };

if (require.main === module) {
  const gif = require("./gif.js"), root = path.join(__dirname, "..", "..");
  fs.mkdirSync(path.join(root, "docs", "previews"), { recursive: true });
  const bg = [44, 38, 56], flat = [];
  for (const color of Object.keys(COLORS)) for (const f of frames(color)) { const c = { w: W, h: H, data: Buffer.alloc(W * H * 4) }; for (let i = 0; i < W * H; i++) { const a = f.data[i * 4 + 3] / 255; for (let k = 0; k < 3; k++) c.data[i * 4 + k] = Math.round(f.data[i * 4 + k] * a + bg[k] * (1 - a)); c.data[i * 4 + 3] = 255; } flat.push(c); }
  fs.writeFileSync(path.join(root, "docs", "previews", "cat_glint.gif"), gif.encode(flat, flat.map(() => 7)));
  const png = require("../bosses/png.js"), strip = { w: W * FRAMES, h: H * 2, data: Buffer.alloc(W * FRAMES * H * 2 * 4) };
  flat.forEach((f, n) => { const row = Math.floor(n / FRAMES), col = n % FRAMES; for (let y = 0; y < H; y++) f.data.copy(strip.data, ((row * H + y) * W * FRAMES + col * W) * 4, y * W * 4, (y + 1) * W * 4); });
  png.encode(strip, path.join(root, "docs", "previews", "cat_glint_frames.png"));
  console.log("wrote docs/previews/cat_glint.gif and cat_glint_frames.png");
}
