// Draws the Necromancer's gate for the hub: 128x128 pixel art (the hub draws gates at 2x), in the style of gates_new.js:
// an empty dark doorway while inert (inactive), an animated portal once woken (active, 12 frames at 0.1 s), and the
// doorway sealed once the boss is beaten (completed).
//   A crypt door from his Gothic Graveyard: a pointed arch of mossy, cracked grave-stone on two buttressed pillars, a
//   horned skull for the keystone (its eyes burn green while the gate is awake), a row of small skulls along the lintel,
//   candles guttering on the pillar ledges, and a leaning headstone in the grass on the left.
//   The portal is a slow vortex of sickly green soul-fire with wisps rising through it and a faint face in the middle;
//   sealed, a wrought-iron grille bars the arch, the eyes go dark and the candles are out.
// Output: assets/backgrounds/hub/necro_gate/{inactive_00, active_00..11, completed_00}.png
// Run: node tools/hub/necro_gate.js, then node tools/hub/build.js
const fs = require("fs");
const path = require("path");
const png = require("../bosses/png.js");

const W = 128, H = 128, FRAMES = 12;
const ROOT = path.join(__dirname, "..", "..");
const DIR = "assets/backgrounds/hub/necro_gate/";

// ---- A little canvas (the same helpers as gates_new.js) ---------------------------------------------------------------------
function canvas() { return { w: W, h: H, data: Buffer.alloc(W * H * 4) }; }
const set = (c, x, y, col) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const p = (y * W + x) * 4; c.data[p] = col[0]; c.data[p + 1] = col[1]; c.data[p + 2] = col[2]; c.data[p + 3] = col.length > 3 ? col[3] : 255; };
const get = (c, x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return [0, 0, 0, 0]; const p = (y * W + x) * 4; return [c.data[p], c.data[p + 1], c.data[p + 2], c.data[p + 3]]; };
const rect = (c, x0, y0, x1, y1, col) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(c, x, y, col); };
const line = (c, x0, y0, x1, y1, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) set(c, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, col); };
const disc = (c, cx, cy, r, col) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5) set(c, x, y, col); };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function outline(c, col) {
  const add = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (get(c, x, y)[3] === 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(c, x + dx, y + dy)[3] > 0)) add.push([x, y]);
  for (const [x, y] of add) set(c, x, y, col);
}
function over(dst, src) { for (let i = 0; i < W * H; i++) { const a = src.data[i * 4 + 3]; if (!a) continue; for (let k = 0; k < 4; k++) dst.data[i * 4 + k] = src.data[i * 4 + k]; } }

// ---- Palette ------------------------------------------------------------------------------------------------------------------
const STONE = [[176, 178, 168], [138, 140, 132], [104, 108, 102], [74, 78, 76], [48, 52, 54]];   // light to dark grave-stone
const MOSS = [[96, 128, 70], [66, 98, 54], [44, 70, 44]];
const BONE = [[236, 228, 204], [200, 190, 160], [150, 140, 116], [96, 88, 74]];
const SOUL = [[230, 255, 220], [150, 250, 160], [80, 220, 120], [36, 150, 80], [16, 70, 44], [8, 28, 22]]; // bright to deep green
const INK = [16, 18, 22];

// The doorway: a pointed arch.
const DOOR = { x0: 42, x1: 86, y0: 58, y1: 118, apex: 34 };
const inDoor = (x, y) => {
  const o = DOOR; if (x < o.x0 || x >= o.x1 || y >= o.y1 || y < o.apex) return false;
  if (y >= o.y0) return true;
  const half = (o.x1 - o.x0) / 2, k = (y - o.apex) / (o.y0 - o.apex);
  return Math.abs(x - 63.5) <= half * Math.pow(k, 0.55);
};

// ---- The stonework --------------------------------------------------------------------------------------------------------
// A stone block's colour: mortar lines every `bh` rows, staggered joints, a lit left edge, speckle and moss low down.
function stonePx(x, y, x0, bw, bh, lit) {
  const row = Math.floor(y / bh), off = row % 2 ? Math.floor(bw / 2) : 0, bx = ((x - x0 + off) % bw + bw) % bw;
  if (y % bh === 0 || bx === 0) return STONE[4];
  const n = hash(x, y, 3);
  let col = bx === 1 || y % bh === 1 ? STONE[lit ? 0 : 1] : n < 0.18 ? STONE[3] : n > 0.9 ? STONE[1] : STONE[2];
  if (y > 92 && hash(x >> 1, y >> 1, 7) < (y - 92) / 40) col = MOSS[hash(x, y, 9) < 0.5 ? 1 : 2];
  return col;
}
function frame(state, f) {
  const c = canvas(), awake = state === "active", sealed = state === "completed";
  // Steps: two worn tiers.
  for (const [x0, x1, y0, y1] of [[14, 114, 118, 124], [22, 106, 114, 118]]) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(c, x, y, y === y0 ? STONE[1] : y === y1 - 1 ? STONE[4] : hash(x, y, 1) < 0.2 ? STONE[3] : STONE[2]);
    for (let x = x0 + 5; x < x1 - 3; x += 13) line(c, x, y0 + 1, x + 2, y1 - 1, STONE[4]);           // cracks
  }
  // Pillars with a buttress foot and a ledge near the top.
  for (const [x0, x1, left] of [[22, 42, true], [86, 106, false]]) {
    for (let y = 40; y < 114; y++) for (let x = x0; x < x1; x++) {
      let col = stonePx(x, y, x0, 10, 7, left);
      if (x === x0 || x === x0 + 1) col = mix(col, STONE[0], 0.4);
      if (x >= x1 - 3) col = mix(col, STONE[4], 0.45);
      set(c, x, y, col);
    }
    for (let y = 96; y < 114; y++) { const w = Math.round((y - 96) / 4); rect(c, x0 - w, y, x0, y + 1, STONE[3]); rect(c, x1, y, x1 + w, y + 1, STONE[3]); } // buttress feet
    rect(c, x0 - 3, 46, x1 + 3, 50, STONE[1]); rect(c, x0 - 3, 46, x1 + 3, 47, STONE[0]); rect(c, x0 - 3, 49, x1 + 3, 50, STONE[4]); // ledge
    // A crack running down each pillar.
    let cx = left ? x0 + 12 : x0 + 6; for (let y = 54; y < 94; y++) { if (hash(y, x0, 5) < 0.3) cx += hash(y, x0, 6) < 0.5 ? -1 : 1; set(c, cx, y, STONE[4]); }
    // Candles on the ledge.
    for (const k of [0, 1]) {
      const cxp = x0 + 5 + k * 9, h = k ? 6 : 9;
      rect(c, cxp, 46 - h, cxp + 3, 46, BONE[1]); set(c, cxp, 46 - h, BONE[0]); rect(c, cxp + 2, 46 - h, cxp + 3, 46, BONE[2]);
      if (!sealed) {
        const fl = awake ? (f + k * 5) % 3 : 0;
        const flame = awake ? [SOUL[1], SOUL[0]] : [[230, 170, 80], [255, 236, 170]];
        set(c, cxp + 1, 46 - h - 1, flame[0]); set(c, cxp + 1, 46 - h - 2, flame[1]); if (fl !== 1) set(c, cxp + (fl === 0 ? 1 : 2), 46 - h - 3, flame[0]);
      } else set(c, cxp + 1, 46 - h - 1, INK);
    }
  }
  // The arch: a thick pointed band of voussoirs over the doorway.
  for (let y = 14; y < 62; y++) for (let x = 26; x < 102; x++) {
    if (inDoor(x, y)) continue;
    const dx = Math.abs(x - 63.5), outer = (y - 12) / (DOOR.y0 - 12);
    if (outer < 0 || dx > 38 * Math.pow(Math.min(1, outer), 0.5)) continue;
    const a = Math.atan2(y - 62, x - 63.5), seg = Math.floor((a + Math.PI) / (Math.PI / 11));
    const edge = Math.abs(((a + Math.PI) / (Math.PI / 11)) - Math.round((a + Math.PI) / (Math.PI / 11))) < 0.06;
    let col = edge ? STONE[4] : x < 63.5 ? (hash(x, y, seg) < 0.15 ? STONE[2] : STONE[1]) : (hash(x, y, seg) < 0.15 ? STONE[3] : STONE[2]);
    if (hash(x >> 1, y >> 1, 11) < 0.07) col = MOSS[1];
    set(c, x, y, col);
  }
  // Lintel: a row of small skulls in niches across the pillar tops.
  for (let i = 0; i < 5; i++) {
    const sx = i < 2 ? 25 + i * 9 : i > 2 ? 85 + (i - 3) * 9 : -1;
    if (sx < 0) continue;
    rect(c, sx, 52, sx + 8, 60, STONE[4]);
    disc(c, sx + 4, 55.5, 2.6, BONE[1]); rect(c, sx + 3, 57, sx + 6, 59, BONE[2]); set(c, sx + 3, 55, INK); set(c, sx + 5, 55, INK);
    if (awake && (f + i) % 4 === 0) { set(c, sx + 3, 55, SOUL[2]); set(c, sx + 5, 55, SOUL[2]); }
  }
  // Keystone: a horned skull at the top of the arch.
  const kx = 63.5, ky = 22;
  for (const s of [-1, 1]) for (let i = 0; i < 12; i++) { const t = i / 11, hx = kx + s * (6 + t * 9), hy = ky - 2 - Math.sin(t * 2.6) * 8; disc(c, hx, hy, 2.2 - t * 1.6, i < 6 ? BONE[2] : BONE[1]); }
  disc(c, kx, ky, 7.5, BONE[1]); disc(c, kx - 1.5, ky - 1.5, 5, BONE[0]);
  rect(c, Math.round(kx) - 4, ky + 5, Math.round(kx) + 5, ky + 10, BONE[2]);
  for (let k = -3; k <= 4; k += 2) set(c, Math.round(kx) + k, ky + 8, INK);                       // teeth
  const eye = awake ? SOUL[(f % 4 < 2) ? 1 : 0] : sealed ? INK : SOUL[4];
  for (const ex of [-3, 3]) { disc(c, kx + ex, ky, 2, INK); if (!sealed) { set(c, kx + ex, ky, eye); if (awake) set(c, kx + ex, ky - 1, SOUL[2]); } }
  set(c, kx, ky + 3, INK); set(c, kx + 1, ky + 3, INK);                                              // nose
  // The graveyard either side: a leaning headstone, a skull and bones in the grass.
  for (let y = 98; y < 118; y++) { const sh = Math.round((y - 98) * 0.25); for (let x = 3; x < 16; x++) { const top = 98 + (Math.abs(x - 9.5) > 4 ? 2 : 0); if (y < top) continue; set(c, x + sh - 4, y, x < 5 ? STONE[1] : hash(x, y, 13) < 0.2 ? STONE[3] : STONE[2]); } }
  line(c, 4, 104, 10, 104, STONE[4]); line(c, 7, 101, 7, 108, STONE[4]);                         // the cross carved on it
  // (No bones on the right: his altar stands just east of the gate in the hub.)
  for (let x = 0; x < W; x++) if (hash(x, 0, 21) < 0.5 && x < 22) { const h = 1 + Math.floor(hash(x, 1, 22) * 4); line(c, x, 118, x, 118 - h, MOSS[hash(x, 2, 23) < 0.5 ? 0 : 1]); }
  outline(c, INK);
  if (sealed) grille(c);
  return c;
}
// The seal: a wrought-iron grille across the arch, its bars topped with spikes, and a chain with a padlock.
function grille(c) {
  const IRON = [[92, 96, 104], [58, 60, 68], [34, 36, 42]];
  for (let x = DOOR.x0 + 3; x < DOOR.x1 - 1; x += 6) for (let y = DOOR.apex; y < DOOR.y1; y++) if (inDoor(x, y) && inDoor(x, y - 3)) { set(c, x, y, IRON[1]); set(c, x - 1, y, IRON[0]); }
  for (const y of [66, 92, 112]) for (let x = DOOR.x0; x < DOOR.x1; x++) if (inDoor(x, y)) { set(c, x, y, IRON[1]); set(c, x, y + 1, IRON[2]); }
  for (let x = DOOR.x0 + 3; x < DOOR.x1 - 1; x += 6) { let y = DOOR.apex; while (y < DOOR.y1 && !(inDoor(x, y) && inDoor(x, y - 3))) y++; set(c, x, y - 1, IRON[0]); set(c, x - 1, y - 2, IRON[0]); }
  for (let i = 0; i < 14; i++) { const x = 50 + i * 2, y = 78 + Math.round(Math.sin(i / 13 * Math.PI) * 6); rect(c, x, y, x + 2, y + 2, i % 2 ? IRON[0] : IRON[1]); }
  rect(c, 61, 84, 67, 90, [120, 104, 60]); rect(c, 61, 84, 67, 85, [170, 150, 90]); set(c, 64, 87, INK);
}

// ---- The portal -----------------------------------------------------------------------------------------------------------
function portal(state, f) {
  const c = canvas(), o = DOOR, ph = f / FRAMES * Math.PI * 2;
  for (let y = o.apex; y < o.y1; y++) for (let x = o.x0; x < o.x1; x++) {
    if (!inDoor(x, y)) continue;
    const t = (y - o.apex) / (o.y1 - o.apex);
    let col = mix([10, 14, 16], [20, 28, 26], t);                                                    // an empty dark doorway
    if (state === "inactive" && hash(x >> 2, y >> 2, 31) < 0.08 && y > 100) col = mix(col, SOUL[4], 0.5); // a little green mist on the floor
    if (state === "active") {
      const dx = x - 63.5, dy = y - 80, r = Math.hypot(dx, dy * 0.8), a = Math.atan2(dy, dx);
      const swirl = Math.sin(a * 3 + r * 0.22 - ph) * 0.5 + 0.5;                                    // three arms, turning (one loop = 12 frames)
      const glow = Math.max(0, 1 - r / 38);
      let k = Math.min(1, glow * 0.75 + swirl * 0.45 * (0.3 + glow));
      col = k > 0.85 ? SOUL[1] : k > 0.65 ? SOUL[2] : k > 0.42 ? SOUL[3] : k > 0.2 ? SOUL[4] : SOUL[5];
      if (r < 4) col = SOUL[0];
    }
    set(c, x, y, state === "completed" ? mix(col, [4, 6, 8], 0.4) : col);
  }
  if (state === "active") {
    // Wisps rising through the doorway, each on its own loop of the 12 frames.
    for (let i = 0; i < 7; i++) {
      const x0 = 47 + i * 5.5, y = o.y1 - 4 - ((f / FRAMES + i * 0.37) % 1) * 70, x = x0 + Math.sin(ph + i) * 2;
      if (inDoor(Math.round(x), Math.round(y)) && inDoor(Math.round(x), Math.round(y) + 2)) { set(c, x, y, SOUL[0]); set(c, x, y + 1, SOUL[1]); set(c, x, y + 2, SOUL[2]); }
    }
    // A faint face in the middle of the vortex: two eyes and a mouth, fading in and out.
    if (Math.sin(ph) > -0.2) { const k = SOUL[Math.sin(ph) > 0.6 ? 0 : 1]; for (const ex of [-5, 4]) { set(c, 63.5 + ex, 74, k); set(c, 64.5 + ex, 74, k); } line(c, 61, 82, 66, 82, k); set(c, 60, 81, k); set(c, 67, 81, k); }
  }
  return c;
}

// ---- Write the gate ---------------------------------------------------------------------------------------------------------
const files = [];
function emit(name, c) { const rel = DIR + name + ".png"; fs.mkdirSync(path.join(ROOT, DIR), { recursive: true }); png.encode(c, path.join(ROOT, rel)); files.push(rel); }
function gate(state, f) { const c = canvas(); over(c, portal(state, f)); over(c, frame(state, f)); return c; }
emit("inactive_00", gate("inactive", 0));
emit("completed_00", gate("completed", 0));
for (let f = 0; f < FRAMES; f++) emit("active_" + String(f).padStart(2, "0"), gate("active", f));
console.log("necro_gate: " + files.length + " frames written to " + DIR);
module.exports = { files };
