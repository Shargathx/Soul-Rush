// Draws the pieces the graveyard pack lacks for the Necromancer's arena, in the pack's own palette (drawn at 1x, placed at 3x like
// the other Grave_* props):
//   grave_ground.png  (448 x 44)  the floor: a mossy edge with tufts, then dark grave earth with buried stones, bones, a skull and roots.
//                                  The floor line is row 5 (so the instance sits 15 px above the floor, GroundCY 657).
//   grave_far.png     (448 x 60)  the far graveyard as one dark silhouette on a low hill: a chapel with a spire, a mausoleum, crosses,
//                                  headstones, a fence and bare trees, with a faint rim of moonlight on top.
//   moon_glow.png     (96 x 96)   a stepped halo for behind the moon.
// The Necromancer's Phase colours script tints them with the rest of the arena (green, then red).
// Run: node tools/fx/necro_arena.js
const path = require("path");
const png = require("../bosses/png.js");
const OUT = path.join(__dirname, "..", "..", "assets", "backgrounds", "graveyard");

const C = { ink: [33, 30, 44], dark: [63, 50, 82], mid: [85, 69, 128], stone: [114, 94, 173], light: [129, 136, 205], pale: [172, 185, 208],
  earth: [40, 32, 50], deep: [22, 18, 30], root: [80, 52, 62], moss: [96, 118, 104], mossHi: [140, 168, 140], mossDk: [62, 78, 76],
  sil: [38, 33, 58], silRim: [58, 54, 90] };
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function canvas(w, h) {
  const c = { w, h, data: Buffer.alloc(w * h * 4) };
  c.set = (x, y, col, a = 255) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= w || y >= h) return; const p = (y * w + x) * 4; c.data[p] = col[0]; c.data[p + 1] = col[1]; c.data[p + 2] = col[2]; c.data[p + 3] = a; };
  c.get = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return 0; return c.data[(y * w + x) * 4 + 3]; };
  c.rect = (x0, y0, x1, y1, col) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.set(x, y, col); };
  c.line = (x0, y0, x1, y1, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) c.set(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, col); };
  return c;
}

// ---- The floor ------------------------------------------------------------------------------------------------------------------
function ground() {
  const W = 448, H = 44, TOP = 5, c = canvas(W, H);
  for (let x = 0; x < W; x++) {
    // Earth: a lit lip, then darker toward the bottom, speckled.
    for (let y = TOP; y < H; y++) {
      const t = (y - TOP) / (H - TOP), n = hash(x, y, 1);
      let col = y === TOP + 2 ? C.dark : t < 0.35 ? (n < 0.12 ? C.dark : C.earth) : t < 0.7 ? (n < 0.06 ? C.dark : C.earth) : (n < 0.5 + (t - 0.7) ? C.deep : C.earth);
      c.set(x, y, col);
    }
    // The mossy edge: two rows, broken here and there, and tufts above it.
    c.set(x, TOP, hash(x, 0, 2) < 0.8 ? C.moss : C.mossDk); c.set(x, TOP + 1, hash(x, 1, 2) < 0.55 ? C.mossDk : C.moss);
    if (hash(x, 0, 3) < 0.18) c.set(x, TOP, C.mossHi);
    if (hash(x, 2, 4) < 0.22) { const h = 1 + Math.floor(hash(x, 3, 4) * 4); for (let k = 1; k <= h; k++) c.set(x + (k > 2 && hash(x, 5, 4) < 0.5 ? 1 : 0), TOP - k, k === h ? C.mossHi : C.moss); }
    if (hash(x, 4, 6) < 0.25) c.set(x, TOP + 2 + Math.floor(hash(x, 6, 6) * 2), C.mossDk);   // moss hanging over the lip
  }
  // Buried stones: little outlined lumps, lit on top.
  for (let i = 0; i < 46; i++) {
    const x0 = Math.floor(hash(i, 0, 10) * (W - 8)), y0 = TOP + 5 + Math.floor(hash(i, 1, 10) * (H - TOP - 10)), w = 3 + Math.floor(hash(i, 2, 10) * 5), h = 2 + Math.floor(hash(i, 3, 10) * 3);
    const lit = y0 < TOP + 14 ? C.stone : C.mid;
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      const corner = (x < 0 || x >= w) && (y < 0 || y >= h); if (corner) continue;
      const edge = x < 0 || x >= w || y < 0 || y >= h;
      c.set(x0 + x, y0 + y, edge ? C.ink : y === 0 ? lit : C.dark);
    }
  }
  // Bones, two skulls and a few roots.
  for (let i = 0; i < 9; i++) {
    const x0 = 10 + Math.floor(hash(i, 0, 20) * (W - 30)), y0 = TOP + 8 + Math.floor(hash(i, 1, 20) * (H - TOP - 14)), len = 5 + Math.floor(hash(i, 2, 20) * 5), up = hash(i, 3, 20) < 0.5 ? 1 : -1;
    c.line(x0, y0, x0 + len, y0 + up, C.pale); c.set(x0 - 1, y0 - 1, C.pale); c.set(x0 - 1, y0 + 1, C.pale); c.set(x0 + len + 1, y0 + up - 1, C.pale); c.set(x0 + len + 1, y0 + up + 1, C.pale);
  }
  for (const [sx, sy] of [[118, TOP + 14], [331, TOP + 22]]) {
    c.rect(sx, sy, sx + 6, sy + 4, C.pale); c.rect(sx + 1, sy + 4, sx + 5, sy + 6, C.pale); c.set(sx + 1, sy + 2, C.deep); c.set(sx + 4, sy + 2, C.deep);
    c.rect(sx + 1, sy - 1, sx + 5, sy, C.pale); for (let k = 0; k < 4; k++) c.set(sx + 1 + k, sy + 5, k % 2 ? C.ink : C.pale);
  }
  for (let i = 0; i < 7; i++) {
    let x = 20 + Math.floor(hash(i, 0, 30) * (W - 40)), y = TOP + 3;
    for (let k = 0; k < 12 + Math.floor(hash(i, 1, 30) * 10); k++) { c.set(x, y, C.root); y++; if (hash(i, k, 31) < 0.45) x += hash(i, k, 32) < 0.5 ? -1 : 1; }
  }
  return c;
}

// ---- The far graveyard ----------------------------------------------------------------------------------------------------------
function far() {
  const W = 448, H = 60, c = canvas(W, H), S = C.sil;
  const hill = x => 46 - Math.round(3 * Math.sin(x / 47) + 2 * Math.sin(x / 19 + 1) + (x > 150 && x < 300 ? 3 * Math.sin((x - 150) / 150 * Math.PI) : 0));
  for (let x = 0; x < W; x++) for (let y = hill(x); y < H; y++) c.set(x, y, S);
  const cross = (x, h) => { const b = hill(x); c.rect(x, b - h, x + 1, b, S); c.rect(x - 1, b - h + 2, x + 2, b - h + 3, S); };
  const stone = (x, w, h) => { const b = hill(x + (w >> 1)); c.rect(x, b - h, x + w, b, S); c.rect(x + 1, b - h - 1, x + w - 1, b - h, S); };
  const tree = (x, h, seed) => {
    const b = hill(x); c.line(x, b, x, b - h, S); c.line(x + 1, b, x + 1, b - h * 0.6, S);
    for (let k = 0; k < 5; k++) { const y = b - h * (0.45 + k * 0.12), d = (k % 2 ? 1 : -1), l = 4 + Math.floor(hash(seed, k, 40) * 6); c.line(x, y, x + d * l, y - l * 0.7, S); c.line(x + d * l, y - l * 0.7, x + d * (l + 2), y - l * 0.7 - 3, S); }
  };
  // A chapel with a spire (left of centre) and a mausoleum (right), the two landmarks of the skyline.
  { const x0 = 96, b = hill(x0 + 15); c.rect(x0, b - 22, x0 + 30, b, S); for (let k = 0; k < 16; k++) c.rect(x0 - 1 + k, b - 22 - k * 0.6, x0 + 31 - k, b - 22 - k * 0.6 + 1, S);
    c.rect(x0 + 20, b - 40, x0 + 27, b - 22, S); for (let k = 0; k < 9; k++) c.rect(x0 + 20 + (k >> 1), b - 40 - k * 1.6, x0 + 27 - (k >> 1), b - 39 - k * 1.6, S); c.rect(x0 + 23, b - 58, x0 + 24, b - 52, S); c.rect(x0 + 21, b - 56, x0 + 26, b - 55, S);
    c.rect(x0 + 6, b - 14, x0 + 9, b - 7, C.deep); c.set(x0 + 7, b - 15, C.deep); c.rect(x0 + 23, b - 34, x0 + 25, b - 29, C.deep); }
  { const x0 = 330, b = hill(x0 + 12); c.rect(x0, b - 16, x0 + 24, b, S); for (let k = 0; k < 13; k++) c.rect(x0 - 2 + k, b - 16 - k * 0.55, x0 + 26 - k, b - 15 - k * 0.55, S);
    c.rect(x0 + 2, b - 16, x0 + 4, b, C.silRim); c.rect(x0 + 20, b - 16, x0 + 22, b, C.silRim); c.rect(x0 + 9, b - 11, x0 + 15, b, C.deep); c.rect(x0 + 11, b - 28, x0 + 12, b - 23, S); c.rect(x0 + 10, b - 27, x0 + 14, b - 26, S); }
  // Crosses, headstones and trees along the hill.
  for (const [x, h] of [[18, 9], [40, 7], [63, 11], [150, 8], [176, 10], [214, 7], [262, 9], [300, 12], [372, 8], [398, 10], [430, 7]]) cross(x, h);
  for (const [x, w, h] of [[28, 4, 5], [52, 5, 6], [80, 4, 4], [140, 5, 5], [190, 4, 6], [226, 6, 5], [248, 4, 4], [282, 5, 6], [316, 4, 5], [362, 5, 4], [386, 4, 6], [414, 5, 5], [440, 4, 4]]) stone(x, w, h);
  tree(8, 30, 1); tree(232, 24, 2); tree(420, 34, 3);
  // A fence line in front, spikes every 3 px with gaps.
  for (let x = 0; x < W; x++) if (!(x > 128 && x < 140) && !(x > 300 && x < 318)) { const b = hill(x) + 3; if (x % 3 === 0) c.rect(x, b - 5, x + 1, b, S); if (x % 3 !== 2) c.set(x, b - 3, S); }
  // Moonlight: a one-pixel rim along every top edge.
  const rim = [];
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) if (c.get(x, y) && !c.get(x, y - 1)) rim.push([x, y]);
  for (const [x, y] of rim) c.set(x, y, C.silRim);
  return c;
}

// ---- The moon's halo ------------------------------------------------------------------------------------------------------------
function glow() {
  const N = 96, c = canvas(N, N), col = [200, 220, 255];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = Math.hypot(x - 47.5, y - 47.5) / 48; if (r >= 1) continue;
    const step = r < 0.45 ? 64 : r < 0.62 ? 40 : r < 0.8 ? 20 : 8;                          // stepped rings, a pixel-art halo
    const dither = (r > 0.78 && r < 0.84 && (x + y) % 2) || (r > 0.6 && r < 0.64 && (x + y) % 2) ? -10 : 0;
    c.set(x, y, col, Math.max(0, step + dither));
  }
  return c;
}

png.encode(ground(), path.join(OUT, "grave_ground.png"));
png.encode(far(), path.join(OUT, "grave_far.png"));
png.encode(glow(), path.join(OUT, "moon_glow.png"));
console.log("necro_arena: grave_ground.png, grave_far.png, moon_glow.png written to assets/backgrounds/graveyard");
