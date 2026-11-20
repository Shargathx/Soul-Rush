// The Cat's landing dust: a ring of dusty puffs thrown out along the ground, rising and thinning, with a flat shock streak at the
// base and a few flung stones. Drawn in code, used by tools/bosses/cat.def.js (object Cat_Dust, animation Puff).
//
//   node tools/fx/cat_dust.js          writes docs/previews/cat_dust.gif and cat_dust_frames.png
//
// One animation of FRAMES images, W x H, symmetrical (so the game never flips it). The picture's bottom edge is the ground line, a
// little below the cat's feet, and its horizontal centre is where the cat lands.
const path = require("path");
const fs = require("fs");
const png = require("../bosses/png.js");

const W = 320, H = 120, FRAMES = 9, DT = 0.045;
const GROUND = H - 14;                                   // the ground line inside the picture

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
// Composite a soft disc "over" the canvas: colour c, centre (x, y), radius r, peak opacity a, edge softness (higher = softer).
function disc(img, x, y, r, c, a, soft) {
  for (let j = Math.max(0, Math.floor(y - r)); j <= Math.min(H - 1, Math.ceil(y + r)); j++) for (let i = Math.max(0, Math.floor(x - r)); i <= Math.min(W - 1, Math.ceil(x + r)); i++) {
    const d = Math.hypot(i + 0.5 - x, j + 0.5 - y) / r; if (d >= 1) continue;
    const al = a * Math.pow(1 - d, soft), p = (j * W + i) * 4, da = img.data[p + 3] / 255, oa = al + da * (1 - al);
    if (oa <= 0) continue;
    for (let k = 0; k < 3; k++) img.data[p + k] = Math.round((c[k] * al + img.data[p + k] * da * (1 - al)) / oa);
    img.data[p + 3] = Math.round(oa * 255);
  }
}

// The puffs: fixed starting points and velocities (seeded), so every frame is the same cloud a moment later.
function puffs() {
  const r = rng(11), list = [];
  for (let i = 0; i < 40; i++) {
    const side = i % 2 ? 1 : -1, near = r();
    list.push({ side, x0: side * (2 + r() * 10), vx: 170 + r() * 340, vy: 6 + r() * 40, up: 8 + near * 36, r0: 5 + r() * 6, r1: 15 + r() * 15, life: 0.6 + r() * 0.4, shade: r() });
  }
  return list;
}
const PUFFS = puffs(), STONES = (() => { const r = rng(5); return Array.from({ length: 9 }, () => ({ side: r() < 0.5 ? -1 : 1, vx: 60 + r() * 150, vy: -(110 + r() * 150), s: 1.2 + r() * 1.6 })); })();

function frame(n) {
  const u = n / (FRAMES - 1), t = u * 0.5, img = { w: W, h: H, data: Buffer.alloc(W * H * 4) }, cx = W / 2;
  // The flat shock streak along the ground: a thin pale line racing outward, gone by two thirds.
  if (u < 0.7) { const reach = 20 + 118 * Math.sqrt(u / 0.7), a = 0.75 * (1 - u / 0.7); for (const side of [-1, 1]) for (let s = 0; s <= 30; s++) { const f = s / 30; disc(img, cx + side * reach * f, GROUND - 3 - 5 * (1 - f) * (1 - u), 2.4 * (1 - f) + 1, [226, 214, 196], a * f, 0.6); } }
  // The puffs, back to front: a dark underside, the body, a pale top.
  for (const p of PUFFS) {
    const age = Math.min(1, u / p.life); if (age >= 1) continue;
    const e = 1 - Math.pow(1 - age, 2), x = cx + p.x0 + p.side * p.vx * t * (1 - 0.55 * age), y = GROUND - 6 - p.up * e - p.vy * t * (1 - age), rad = p.r0 + (p.r1 - p.r0) * e, a = 0.85 * Math.pow(1 - age, 1.2);
    disc(img, x, y + rad * 0.18, rad, [118, 102, 88], a, 0.55);
    disc(img, x, y, rad * 0.9, [156 + p.shade * 20, 140 + p.shade * 18, 122 + p.shade * 14], a, 0.7);
    disc(img, x - rad * 0.12, y - rad * 0.28, rad * 0.55, [196, 182, 162], a * 0.55, 0.8);
  }
  // Flung stones: small dark flecks on an arc.
  for (const s of STONES) { const x = cx + s.side * (12 + s.vx * t), y = GROUND - 6 + s.vy * t + 520 * t * t; if (y < GROUND && u < 0.85) disc(img, x, y, s.s, [88, 76, 66], 1 - u / 0.85, 0); }
  return img;
}
const frames = () => Array.from({ length: FRAMES }, (_, n) => frame(n));

module.exports = { W, H, FRAMES, DT, GROUND, frames };

if (require.main === module) {
  const gif = require("./gif.js"), root = path.join(__dirname, "..", "..");
  fs.mkdirSync(path.join(root, "docs", "previews"), { recursive: true });
  const bg = [52, 46, 62], flat = frames().map(f => { const c = { w: W, h: H, data: Buffer.alloc(W * H * 4) }; for (let i = 0; i < W * H; i++) { const a = f.data[i * 4 + 3] / 255; for (let k = 0; k < 3; k++) c.data[i * 4 + k] = Math.round(f.data[i * 4 + k] * a + bg[k] * (1 - a)); c.data[i * 4 + 3] = 255; } return c; });
  fs.writeFileSync(path.join(root, "docs", "previews", "cat_dust.gif"), gif.encode(flat, flat.map(() => 5)));
  const strip = { w: W * 3, h: H * 3, data: Buffer.alloc(W * 3 * H * 3 * 4) };
  flat.forEach((f, n) => { const row = Math.floor(n / 3), col = n % 3; for (let y = 0; y < H; y++) f.data.copy(strip.data, ((row * H + y) * W * 3 + col * W) * 4, y * W * 4, (y + 1) * W * 4); });
  png.encode(strip, path.join(root, "docs", "previews", "cat_dust_frames.png"));
  console.log("wrote docs/previews/cat_dust.gif and cat_dust_frames.png");
}
