// The Cat's eye glint: a four-point star flash at the cat's eye, the tell before an attack. Two colours: Yellow (the start of a
// combo, a pounce, the charge) and Red (the dangerous ones: the flurry and the maul). Drawn in code, used by tools/bosses/cat.def.js
// (object Cat_Glint, animations Yellow and Red, origin at the picture centre).
//
//   node tools/fx/cat_glint.js          writes docs/previews/cat_glint.gif (both colours on a dark background)
const path = require("path");
const fs = require("fs");

const W = 64, H = 64, FRAMES = 8, DT = 0.04;
const COLORS = { Yellow: [255, 226, 70], Red: [255, 36, 36] };
// How big and how bright the star is on each frame: it snaps out, holds, then thins away.
const SIZE = [0.3, 0.75, 1, 1, 0.85, 0.6, 0.38, 0.18], FADE = [0.7, 1, 1, 1, 0.9, 0.7, 0.45, 0.2];

function frame(color, n) {
  const img = { w: W, h: H, data: Buffer.alloc(W * H * 4) }, c = COLORS[color], s = SIZE[n], fade = FADE[n], cx = W / 2, cy = H / 2;
  const L = 29 * s, Ld = 14 * s;                              // length of the long spikes and of the short diagonal ones
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy);
    const spike = (along, across, len, thick) => { const a = Math.abs(along); return a >= len ? 0 : Math.exp(-Math.abs(across) / thick) * Math.pow(1 - a / len, 1.3); };
    const u = (dx + dy) * Math.SQRT1_2, v = (dx - dy) * Math.SQRT1_2;
    let I = spike(dx, dy, L, 1.5 * s + 0.4) + spike(dy, dx, L, 1.5 * s + 0.4) + 0.55 * (spike(u, v, Ld, 1.1 * s + 0.3) + spike(v, u, Ld, 1.1 * s + 0.3)) + 0.9 * Math.exp(-(r * r) / (2 * Math.pow(5.5 * s + 1, 2)));
    I = Math.min(1.4, I);
    const white = Math.min(1, Math.pow(I, 2.2)) * (color === "Red" ? 0.65 : 1), p = (y * W + x) * 4, a = Math.min(1, I * 1.1) * fade;
    if (a < 0.01) continue;
    for (let k = 0; k < 3; k++) img.data[p + k] = Math.round(c[k] * (1 - white * 0.85) + 255 * white * 0.85);
    img.data[p + 3] = Math.round(255 * a);
  }
  return img;
}
const frames = color => Array.from({ length: FRAMES }, (_, n) => frame(color, n));

module.exports = { W, H, FRAMES, DT, colors: Object.keys(COLORS), frames };

if (require.main === module) {
  const gif = require("./gif.js"), root = path.join(__dirname, "..", "..");
  fs.mkdirSync(path.join(root, "docs", "previews"), { recursive: true });
  const bg = [44, 38, 56], flat = [];
  for (const color of Object.keys(COLORS)) for (const f of frames(color)) { const c = { w: W, h: H, data: Buffer.alloc(W * H * 4) }; for (let i = 0; i < W * H; i++) { const a = f.data[i * 4 + 3] / 255; for (let k = 0; k < 3; k++) c.data[i * 4 + k] = Math.round(f.data[i * 4 + k] * a + bg[k] * (1 - a)); c.data[i * 4 + 3] = 255; } flat.push(c); }
  fs.writeFileSync(path.join(root, "docs", "previews", "cat_glint.gif"), gif.encode(flat, flat.map(() => 6)));
  const png = require("../bosses/png.js"), strip = { w: W * FRAMES, h: H * 2, data: Buffer.alloc(W * FRAMES * H * 2 * 4) };
  flat.forEach((f, n) => { const row = Math.floor(n / FRAMES), col = n % FRAMES; for (let y = 0; y < H; y++) f.data.copy(strip.data, ((row * H + y) * W * FRAMES + col * W) * 4, y * W * 4, (y + 1) * W * 4); });
  png.encode(strip, path.join(root, "docs", "previews", "cat_glint_frames.png"));
  console.log("wrote docs/previews/cat_glint.gif and cat_glint_frames.png");
}
