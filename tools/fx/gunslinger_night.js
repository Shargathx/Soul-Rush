// Redraws the Gunslinger scene's night backdrop (layouts/gunslinger.json) at double resolution, 256x128 from the
// original 128x64, with more detail:
//   - bg_sky (NewSprite415-497, 83 animated frames): the moon gets a smooth edge, seas, craters and a darker rim,
//     and the stars become finer twinkles;
//   - bg_land (NewSprite498): the cacti and bush are backlit by the moon, with a moonlit rim on the side facing it
//     and along their tops, ribs and spines; they throw shadows away from it along the ground; the ground's crest
//     catches the light, its dithering is finer, and there are rocks and grass tufts.
//
//   node tools/fx/gunslinger_night.js            paints the frames in place
//   node tools/fx/gunslinger_night.js <dir>      writes them to <dir> instead (for previewing)
//
// It always starts from the clean 128x64 originals, kept in "assets (raw)/gunslinger-night-original" (git-ignored,
// made on the first run), so it can be rerun after changing anything below. The scene stretches both objects to a
// fixed size and scales with nearest-neighbour, so the bigger images fill the same space and stay crisp.
//
// Each image is first doubled with Scale2x, a pixel-art upscaler that keeps the exact palette and rounds off
// staircase edges without blurring, so the moon's glow, the streak and the hills keep their look. The moon's disc
// is one flat colour in every frame (only its glow ring changes and a streak passes by), and only pixels of
// exactly that colour are repainted, so the craters sit still while the animation plays on around them.
const fs = require("fs");
const path = require("path");
const { readPng, writePng } = require("./gunslinger_png");

const ROOT = path.join(__dirname, "../..");
const ASSETS = path.join(ROOT, "assets");
const CLEAN = path.join(ROOT, "assets (raw)/gunslinger-night-original");
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : null;
const SKY = Array.from({ length: 83 }, (_, i) => `NewSprite${415 + i}.png`);
const LAND = "NewSprite498.png";

// ---- Scale2x ------------------------------------------------------------------------------------------------
function scale2x(img) {
  const { w, h, data } = img, W2 = w * 2, out = Buffer.alloc(W2 * h * 2 * 4);
  const px = (x, y) => { x = Math.max(0, Math.min(w - 1, x)); y = Math.max(0, Math.min(h - 1, y)); return data.readUInt32LE((y * w + x) * 4); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const E = px(x, y), B = px(x, y - 1), D = px(x - 1, y), F = px(x + 1, y), H = px(x, y + 1);
    const q = [E, E, E, E];
    if (B !== H && D !== F) { if (D === B) q[0] = D; if (B === F) q[1] = F; if (D === H) q[2] = D; if (H === F) q[3] = F; }
    q.forEach((v, k) => out.writeUInt32LE(v >>> 0, (((y * 2 + (k >> 1)) * W2) + x * 2 + (k & 1)) * 4));
  }
  return { w: W2, h: h * 2, data: out };
}

// ---- The moon -----------------------------------------------------------------------------------------------
const MOON_COLOUR = [255, 243, 156];
const M = {
  limb: [244, 226, 140],      // The outermost ring, darker towards the edge.
  limb2: [236, 216, 132],     // Its outer pixel.
  mare: [236, 216, 132],      // The dark "seas".
  mareEdge: [246, 231, 146],  // Dithered edge of a sea, and the rays.
  pit: [228, 205, 122],       // A crater's floor.
  shadow: [206, 180, 102],    // A crater's inner wall away from the light (upper left).
  lit: [255, 253, 216],       // A crater's rim catching the light (lower right), and the bright ray crater.
};
// Positions are in original pixels from the moon's centre (radius 27.5 there), scaled up when painting.
const MARIA = [   // Seas: blobs of overlapping circles [dx, dy, r].
  [[-9, -9, 7], [-3, -12, 5], [-13, -3, 4]],
  [[7, -5, 6], [12, -9, 4], [9, 1, 4]],
  [[-2, 6, 5], [3, 9, 4]],
  [[-16, 10, 3]],
];
const CRATERS = [   // [dx, dy, r]: the big ones, then small pits that only fit at the higher resolution.
  [-12, 5, 3.4], [11, 9, 4.2], [2, -15, 2.6], [-4, 15, 3], [17, -5, 2.2], [-19, -7, 2.2],
  [7, 19, 2.4], [-14, 17, 1.6], [21, 6, 1.6], [-6, -3, 1.6], [14, -15, 1.6], [-22, 3, 1.4],
  [-1, -6, 0.9], [5, 3, 0.8], [-9, 11, 0.9], [15, 2, 0.8], [-17, -14, 0.9], [4, -21, 0.8], [19, 14, 0.9],
  [-24, -2, 0.7], [10, -19, 0.7], [-10, -18, 0.8], [13, 16, 0.7], [-20, 12, 0.7], [0, 12, 0.7], [23, -2, 0.7],
];
const RAY_CRATER = [-6, 21, 1.4];   // A small bright crater with rays, low on the disc.

// The disc's centre and radius in this image, from its pixels (it runs off the bottom of the frame).
function findMoon(img) {
  const [mr, mg, mb] = MOON_COLOUR; let x0 = Infinity, x1 = -1, y0 = Infinity;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = (y * img.w + x) * 4;
    if (img.data[i] === mr && img.data[i + 1] === mg && img.data[i + 2] === mb) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
  }
  const r = (x1 - x0 + 1) / 2;
  return { x: x0 + r - 0.5, y: y0 + r - 0.5, r, u: r / 27.5 };
}

function moonPixel(moon, x, y) {
  const u = moon.u, dx = (x - moon.x) / u, dy = (y - moon.y) / u, edge = moon.r - Math.hypot(x - moon.x, y - moon.y);
  const px1 = 1 / u;   // One output pixel, in moon units.
  let col = MOON_COLOUR;
  for (const blob of MARIA) {
    let inside = Infinity;
    for (const [cx, cy, r] of blob) inside = Math.min(inside, Math.hypot(dx - cx, dy - cy) - r);
    if (inside <= 0) col = M.mare;
    else if (inside <= 1 && (x + y) % 2 === 0) col = M.mareEdge;
  }
  const [rx, ry, rr] = RAY_CRATER, rd = Math.hypot(dx - rx, dy - ry), ra = Math.atan2(dy - ry, dx - rx);
  if (rd > rr + 0.5 && rd < 10 && [0.3, 1.5, 2.6, -2.2, -0.9, 2.05].some(a => Math.abs(Math.atan2(Math.sin(ra - a), Math.cos(ra - a))) < 0.5 / rd + 0.03)) col = M.mareEdge;
  for (const [cx, cy, r] of CRATERS) {
    const ex = dx - cx, ey = dy - cy, e = Math.hypot(ex, ey);
    if (e > r + px1 * 0.5) continue;
    const side = (ex + ey) / (e || 1);   // -1 towards the upper left, +1 towards the lower right.
    if (e > r - px1) col = side > 0.2 ? M.lit : side < -0.2 ? M.shadow : M.pit;
    else col = e > r - 2.2 * px1 && side < -0.3 ? M.shadow : M.pit;
  }
  if (rd <= rr) col = M.lit;
  if (col === MOON_COLOUR) { if (edge < 1) col = M.limb2; else if (edge < 3.2) col = M.limb; }
  return col;
}

// Stars: after doubling, each is a 2x2 white block. It becomes one bright pixel with a dim cross, and every
// third star a smaller single point, so they read as finer twinkles at the same brightness.
const STAR = [255, 255, 255], STAR_DIM = [128, 116, 176];
function refineStars(img) {
  const { w, h, data: d } = img, isStar = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d.readUInt32LE((y * w + x) * 4) === 0xffffffff;
  const skyAt = (x, y) => d.slice((y * w + x) * 4, (y * w + x) * 4 + 4);
  for (let y = 0; y < h - 1; y += 2) for (let x = 0; x < w - 1; x += 2) {
    if (!(isStar(x, y) && isStar(x + 1, y) && isStar(x, y + 1) && isStar(x + 1, y + 1))) continue;
    // Only lone stars: anything bigger (the streak) is left as it is.
    let lone = true;
    for (let k = -1; k <= 2 && lone; k++) for (const [ax, ay] of [[x - 1, y + k], [x + 2, y + k], [x + k, y - 1], [x + k, y + 2]]) if (isStar(ax, ay)) { lone = false; break; }
    if (!lone) continue;
    const bg = [...skyAt(Math.max(0, x - 1), y)].slice(0, 3), small = ((x * 7 + y * 13) >> 1) % 3 === 0;
    const set = (sx, sy, c) => { const i = (sy * w + sx) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; };
    set(x, y, small ? bg : STAR_DIM); set(x + 1, y, small ? bg : STAR_DIM); set(x, y + 1, small ? bg : STAR_DIM); set(x + 1, y + 1, STAR);
  }
}

function paintSky(img) {
  const moon = findMoon(img), d = img.data, [mr, mg, mb] = MOON_COLOUR;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = (y * img.w + x) * 4;
    if (d[i] === mr && d[i + 1] === mg && d[i + 2] === mb) d.set(moonPixel(moon, x, y), i);
  }
  refineStars(img);
  return moon;
}

// ---- The foreground ---------------------------------------------------------------------------------------
const L = {
  groundDark: [22, 0, 37], groundLight: [31, 0, 52],   // The original ground's two dither colours.
  crest: [80, 48, 96],        // The ground's top edge, catching the moon.
  crest2: [46, 18, 68],       // The rows under it, dithered.
  shadow: [9, 0, 18],         // Cast shadows on the ground.
  cactusDarkest: [0, 12, 2],  // The rib on the far side.
  cactusDark: [0, 22, 4],     // The side away from the moon.
  cactusMid: [16, 54, 24],    // The side facing it.
  cactusRim: [104, 134, 80],  // The moonlit edge.
  spineLit: [76, 104, 64], spineDark: [4, 26, 8],
  rock: [36, 12, 50], rockLit: [86, 60, 98], rockDark: [16, 0, 28],
  tuft: [12, 0, 24], tuftLit: [70, 46, 84],
};
const ROCKS = [[44, 4, 2], [114, 5, 3], [140, 3, 2], [200, 4, 2], [236, 6, 3], [92, 2, 1], [176, 2, 1]];   // [x, w, h]
const TUFTS = [[28, 4], [60, 3], [96, 4], [132, 3], [176, 4], [216, 3], [248, 4]];                        // [x, height]

function paintLand(img, moonX) {
  const { w, h } = img, d = img.data, at = (x, y) => (y * w + x) * 4;
  const opaque = (x, y) => x >= 0 && x < w && y >= 0 && y < h && d[at(x, y) + 3] > 0;
  const green = (x, y) => { if (!opaque(x, y)) return false; const i = at(x, y); return d[i + 1] > d[i] && d[i + 1] > d[i + 2]; };
  const ground = (x, y) => opaque(x, y) && !green(x, y);
  const put = (x, y, c) => { if (x >= 0 && x < w && y >= 0 && y < h) { d.set(c, at(x, y)); d[at(x, y) + 3] = 255; } };
  const isCol = (x, y, c) => { const i = at(x, y); return d[i] === c[0] && d[i + 1] === c[1] && d[i + 2] === c[2]; };
  // Finer dithering: the doubled ground's 2x2 checks become a 1px pattern of the same two colours, keeping the
  // local mix of light and dark.
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const light = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0, l = 0;
    for (let j = -2; j <= 2; j++) for (let k = -2; k <= 2; k++) if (ground(x + k, y + j)) { n++; if (isCol(x + k, y + j, L.groundLight)) l++; }
    light[y * w + x] = n ? l / n : 0;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isCol(x, y, L.groundDark) || isCol(x, y, L.groundLight))
    put(x, y, light[y * w + x] * 16 > BAYER[y & 3][x & 3] + 0.5 ? L.groundLight : L.groundDark);
  // Where the ground's surface is in each column (below any plant).
  const top = [];
  for (let x = 0; x < w; x++) { let y = 0; while (y < h && !ground(x, y)) y++; top[x] = y; }
  // The plants: each connected patch of green, with its extent.
  const seen = new Uint8Array(w * h), plants = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (green(x, y) && !seen[y * w + x]) {
    const px = [[x, y]]; seen[y * w + x] = 1;
    for (let k = 0; k < px.length; k++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = px[k][0] + dx, ny = px[k][1] + dy;
      if (green(nx, ny) && !seen[ny * w + nx]) { seen[ny * w + nx] = 1; px.push([nx, ny]); }
    }
    const xs = px.map(p => p[0]), ys = px.map(p => p[1]);
    plants.push({ px, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
  }
  // The ground's crest: a lit top edge, then two dithered rows fading into the ground.
  for (let x = 0; x < w; x++) {
    const t = top[x]; if (t >= h) continue;
    put(x, t, L.crest);
    if (ground(x, t + 1)) put(x, t + 1, (x + t) % 2 === 0 ? L.crest2 : d.slice(at(x, t + 1), at(x, t + 1) + 3));
    if (ground(x, t + 2) && x % 4 === (t % 2) * 2) put(x, t + 2, L.crest2);
  }
  // Shadows: each plant throws one along the ground away from the moon, 60% of its height long, tapering.
  for (const p of plants) {
    const dir = (p.x0 + p.x1) / 2 < moonX ? -1 : 1, len = Math.round((p.y1 - p.y0 + 1) * 0.6), from = dir < 0 ? p.x0 : p.x1;
    for (let k = 0; k <= len; k++) {
      const x = from + dir * k; if (x < 0 || x >= w || top[x] >= h) continue;
      const rows = k < len * 0.35 ? 3 : k < len * 0.7 ? 2 : 1;
      for (let j = 0; j < rows; j++) if (ground(x, top[x] + j) && (k < len * 0.85 || (x + j) % 2 === 0)) put(x, top[x] + j, L.shadow);
    }
    for (let x = p.x0; x <= p.x1; x++) if (top[x] < h) { put(x, top[x], L.shadow); put(x, top[x] + 1, L.shadow); }
  }
  // The plants: moonlit edge and tops, the lit side, the dark side and a rib on its far edge, and spines.
  for (const p of plants) {
    const dir = (p.x0 + p.x1) / 2 < moonX ? 1 : -1;   // Towards the moon.
    const spines = [];
    for (const [x, y] of p.px) {
      const up = !green(x, y - 1), t1 = !green(x + dir, y), t2 = !green(x + 2 * dir, y), a1 = !green(x - dir, y);
      let c = L.cactusDark;
      if (t1 || up) c = L.cactusRim;
      else if (t2) c = L.cactusMid;
      else if (a1) c = L.cactusDarkest;
      put(x, y, c);
      if ((t1 || a1) && !up && (y + (t1 ? 0 : 1)) % 3 === 0) spines.push([x + (t1 ? dir : -dir), y, t1]);
    }
    for (const [x, y, lit] of spines) if (!opaque(x, y)) put(x, y, lit ? L.spineLit : L.spineDark);
  }
  // Rocks sitting on the ground: lit on top, dark underneath, a little shadow away from the moon.
  for (const [x, rw, rh] of ROCKS) for (let k = 0; k < rw; k++) {
    const gx = x + k; if (gx >= w || top[gx] >= h) continue;
    const hh = rh - ((k === 0 || k === rw - 1) && rh > 1 ? 1 : 0);
    for (let j = 1; j <= hh; j++) put(gx, top[gx] - j, j === hh ? L.rockLit : j === 1 ? L.rockDark : L.rock);
    const sx = gx + (gx < moonX ? -1 : 1) * rw; if (k === 0 && sx >= 0 && sx < w) put(sx, top[sx], L.shadow);
  }
  // Grass tufts: three dark blades fanning out, their tips lit.
  for (const [x, th] of TUFTS) {
    if (x >= w || top[x] >= h) continue;
    for (const [bx, bh, lean] of [[0, th, 0], [-1, th - 1, -1], [1, th - 1, 1]]) {
      const gx = x + bx; if (gx < 0 || gx >= w || top[gx] >= h) continue;
      for (let j = 1; j <= bh; j++) put(gx + (j === bh ? lean : 0), top[gx] - j, j === bh ? L.tuftLit : L.tuft);
    }
  }
}

// ---- Run ----------------------------------------------------------------------------------------------------
fs.mkdirSync(CLEAN, { recursive: true });
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let moonX = null;
for (const f of [...SKY, LAND]) {
  const clean = path.join(CLEAN, f);
  if (!fs.existsSync(clean)) fs.copyFileSync(path.join(ASSETS, f), clean);
  const src = readPng(clean);
  if (src.w !== 128 || src.h !== 64) throw new Error(`${f} in ${path.relative(ROOT, CLEAN)} should be the 128x64 original`);
  const img = scale2x(src);
  if (f === LAND) paintLand(img, moonX);
  else { const moon = paintSky(img); if (moonX === null) moonX = moon.x; }   // The sky comes first: the land needs the moon.
  writePng(img, path.join(OUT || ASSETS, f));
}
console.log(`Painted ${SKY.length} sky frames and the foreground at 256x128.`);
