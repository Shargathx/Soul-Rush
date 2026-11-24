// Draws the Necromancer's gate for the hub: 128x128 pixel art (the hub draws gates at 2x), in the style of gates_new.js, with a small
// loop in every state:
//   inactive  (8 frames, 0.15 s)  an empty dark doorway: the candles flicker amber, a little green mist creeps along the threshold,
//                                 the ivy sways and the raven on the skull's horn blinks and tilts its head.
//   active    (12 frames, 0.1 s)  the portal: a vortex of sickly green soul-fire with wisps rising and a faint face in it; the candles
//                                 burn green, the runes carved down the pillars and the skull's eyes pulse.
//   completed (8 frames, 0.15 s)  the doorway barred by a wrought-iron grille with a padlock; the candles are out and smoke curls up
//                                 from them; the raven stays.
// The door is a crypt arch from his Gothic Graveyard: mossy, cracked grave-stone on two buttressed pillars with rune grooves, a horned
// skull for the keystone, a row of skulls in niches along the lintel, ivy hanging from the arch, a cobweb in its corner, candles on the
// pillar ledges, a leaning headstone on the left and a little pile of skulls on the right.
// Output: assets/backgrounds/hub/necro_gate/{inactive_00..07, active_00..11, completed_00..07}.png
// Run: node tools/hub/necro_gate.js, then node tools/hub/build.js
const fs = require("fs");
const path = require("path");
const png = require("../bosses/png.js");

const W = 128, H = 128;
const COUNT = { inactive: 8, active: 12, completed: 8 };
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
const MOSS = [[110, 140, 78], [70, 102, 56], [44, 70, 44]];
const BONE = [[236, 228, 204], [200, 190, 160], [150, 140, 116], [96, 88, 74]];
const SOUL = [[230, 255, 220], [150, 250, 160], [80, 220, 120], [36, 150, 80], [16, 70, 44], [8, 28, 22]]; // bright to deep green
const FLAME = [[255, 240, 180], [255, 190, 90], [220, 120, 50]];
const IRON = [[92, 96, 104], [58, 60, 68], [34, 36, 42]];
const WEB = [200, 205, 210, 150];
const SMOKE = [[150, 150, 160, 170], [120, 120, 132, 120], [100, 100, 110, 70]];
const INK = [16, 18, 22];

// The doorway: a pointed arch.
const DOOR = { x0: 42, x1: 86, y0: 58, y1: 118, apex: 34 };
const inDoor = (x, y) => {
  const o = DOOR; if (x < o.x0 || x >= o.x1 || y >= o.y1 || y < o.apex) return false;
  if (y >= o.y0) return true;
  const half = (o.x1 - o.x0) / 2, k = (y - o.apex) / (o.y0 - o.apex);
  return Math.abs(x - 63.5) <= half * Math.pow(k, 0.55);
};
const archOuter = (x, y) => { const dx = Math.abs(x - 63.5), k = (y - 12) / (DOOR.y0 - 12); return k >= 0 && dx <= 38 * Math.pow(Math.min(1, k), 0.5); };

// ---- The stonework (drawn once per frame; `f`/`n` animate the small things) -------------------------------------------------------
function stonePx(x, y, x0, bw, bh, lit) {
  const row = Math.floor(y / bh), off = row % 2 ? Math.floor(bw / 2) : 0, bx = ((x - x0 + off) % bw + bw) % bw;
  if (y % bh === 0 || bx === 0) return STONE[4];
  const n = hash(x, y, 3);
  let col = bx === 1 || y % bh === 1 ? STONE[lit ? 0 : 1] : n < 0.18 ? STONE[3] : n > 0.9 ? STONE[1] : STONE[2];
  if (n > 0.97) col = STONE[4];                                                                  // pits in the stone
  if (y > 92 && hash(x >> 1, y >> 1, 7) < (y - 92) / 40) col = MOSS[hash(x, y, 9) < 0.5 ? 1 : 2];
  return col;
}
function frame(state, f, n) {
  const c = canvas(), awake = state === "active", sealed = state === "completed", ph = f / n;  // ph: 0..1 round the loop
  const pulse = 0.5 + 0.5 * Math.sin(ph * Math.PI * 2);
  // Steps: two worn tiers, with rubble.
  for (const [x0, x1, y0, y1] of [[14, 114, 118, 124], [22, 106, 114, 118]]) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(c, x, y, y === y0 ? STONE[1] : y === y1 - 1 ? STONE[4] : hash(x, y, 1) < 0.2 ? STONE[3] : STONE[2]);
    for (let x = x0 + 5; x < x1 - 3; x += 13) line(c, x, y0 + 1, x + 2, y1 - 1, STONE[4]);
  }
  rect(c, 18, 116, 21, 118, STONE[2]); set(c, 19, 116, STONE[1]); rect(c, 107, 115, 111, 118, STONE[3]); set(c, 108, 115, STONE[1]); set(c, 25, 113, STONE[2]);
  // Pillars: buttress feet, a ledge, a capital, a crack and a rune groove down the middle.
  const RUNES = ["..#..", ".#.#.", "#...#", ".###.", "..#..", "#.#.#", ".#.#.", "#...#", "##.##", ".#.#."];
  for (const [x0, x1, left] of [[22, 42, true], [86, 106, false]]) {
    for (let y = 40; y < 114; y++) for (let x = x0; x < x1; x++) {
      let col = stonePx(x, y, x0, 10, 7, left);
      if (x === x0 || x === x0 + 1) col = mix(col, STONE[0], 0.4);
      if (x >= x1 - 3) col = mix(col, STONE[4], 0.45);
      set(c, x, y, col);
    }
    for (let y = 96; y < 114; y++) { const w = Math.round((y - 96) / 4); rect(c, x0 - w, y, x0, y + 1, STONE[3]); rect(c, x1, y, x1 + w, y + 1, STONE[3]); }
    rect(c, x0 - 3, 46, x1 + 3, 50, STONE[1]); rect(c, x0 - 3, 46, x1 + 3, 47, STONE[0]); rect(c, x0 - 3, 49, x1 + 3, 50, STONE[4]);   // ledge
    rect(c, x0 - 2, 90, x1 + 2, 93, STONE[1]); rect(c, x0 - 2, 92, x1 + 2, 93, STONE[4]);                                           // a band low down
    let cx = left ? x0 + 15 : x0 + 4; for (let y = 54; y < 90; y++) { if (hash(y, x0, 5) < 0.3) cx += hash(y, x0, 6) < 0.5 ? -1 : 1; set(c, cx, y, STONE[4]); }
    // The rune groove: a sunken channel with glyphs; they glow green while the gate is awake (pulsing), faintly now and then while inert.
    const gx = x0 + 8;
    rect(c, gx - 1, 55, gx + 6, 88, STONE[4]); rect(c, gx, 56, gx + 5, 87, STONE[3]);
    const glow = awake ? 0.55 + 0.45 * pulse : state === "inactive" ? (f % n === (left ? 2 : 5) ? 0.45 : 0.08) : 0;
    RUNES.forEach((r, k) => { for (let i = 0; i < 5; i++) if (r[i] === "#") { const y = 57 + k * 3 + (k % 2), on = (k + (left ? 0 : 3)) % 10 / 10; set(c, gx + i, y, glow > 0 ? mix(STONE[4], SOUL[glow > 0.7 && Math.abs(on - ph) < 0.25 ? 0 : 2], glow) : STONE[4]); } });
    // Candles on the ledge: amber flicker inert, green awake, out and smoking once sealed.
    for (const k of [0, 1]) {
      const cxp = x0 + 4 + k * 10, h = k ? 6 : 9, top = 46 - h;
      rect(c, cxp, top, cxp + 3, 46, BONE[1]); set(c, cxp, top, BONE[0]); rect(c, cxp + 2, top, cxp + 3, 46, BONE[2]); set(c, cxp + 2, top + 2, BONE[0]); // a drip
      if (!sealed) {
        const fl = (f + k * 3 + (left ? 0 : 1)) % 4, pal = awake ? [SOUL[2], SOUL[1], SOUL[0]] : [FLAME[2], FLAME[1], FLAME[0]];
        set(c, cxp + 1, top - 1, pal[1]); set(c, cxp + 1, top - 2, pal[2]); set(c, cxp + (fl === 1 ? 0 : fl === 3 ? 2 : 1), top - 3, pal[0]); if (fl === 0) set(c, cxp + 1, top - 4, pal[0]);
        set(c, cxp, top - 1, pal[0]); set(c, cxp + 2, top - 1, pal[0]);
      } else {
        set(c, cxp + 1, top - 1, INK);
        for (let s = 0; s < 3; s++) { const p = ((f / n) + s / 3 + k * 0.17) % 1, y = top - 2 - p * 14, x = cxp + 1 + Math.round(Math.sin(p * 6 + k) * 1.5); set(c, x, y, SMOKE[Math.min(2, Math.floor(p * 3))]); }
      }
    }
  }
  // The arch: voussoirs, mossy here and there.
  for (let y = 14; y < 62; y++) for (let x = 26; x < 102; x++) {
    if (inDoor(x, y) || !archOuter(x, y)) continue;
    const a = Math.atan2(y - 62, x - 63.5), u = (a + Math.PI) / (Math.PI / 11), seg = Math.floor(u);
    const edge = Math.abs(u - Math.round(u)) < 0.06;
    const inner = inDoor(x, y + 2) || inDoor(x - 1, y + 1) || inDoor(x + 1, y + 1);
    let col = edge ? STONE[4] : x < 63.5 ? (hash(x, y, seg) < 0.15 ? STONE[2] : STONE[1]) : (hash(x, y, seg) < 0.15 ? STONE[3] : STONE[2]);
    if (inner) col = STONE[3];
    if (hash(x >> 1, y >> 1, 11) < 0.07) col = MOSS[1];
    set(c, x, y, col);
  }
  // Ivy hanging off the arch, swaying a pixel either way round the loop.
  const sway = Math.round(Math.sin(ph * Math.PI * 2));
  for (const [sx, len, s] of [[33, 22, 1], [38, 14, 2], [90, 18, 3], [95, 26, 4], [58, 7, 5], [70, 9, 6]]) {
    let y0 = 14; while (y0 < 62 && !(get(c, sx, y0)[3] && !get(c, sx, y0 - 1)[3])) y0++;
    if (sx > 50 && sx < 80) { y0 = 30; while (y0 < 62 && !inDoor(sx, y0)) y0++; y0 -= 1; }
    for (let k = 0; k < len; k++) {
      const x = sx + Math.round(Math.sin(k / 4 + s) * 1.2 + sway * (k / len)), y = y0 + k;
      set(c, x, y, MOSS[k % 5 === 0 ? 0 : 1]);
      if (k % 3 === 1) set(c, x + (k % 2 ? 1 : -1), y, MOSS[hash(k, s, 12) < 0.5 ? 0 : 2]);
    }
  }
  // A cobweb in the arch's left corner, over the doorway.
  for (let k = 0; k < 4; k++) line(c, 44, 46 + k * 0, 44 + 9 - k * 2, 46 + k * 3, WEB);
  for (const r of [3, 6, 9]) for (let k = 0; k <= r; k++) set(c, 44 + r - k, 46 + Math.round(k * 0.9), WEB);
  // Lintel: skulls in niches across the pillar tops; their eyes catch the light while awake.
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
  for (let k = -3; k <= 4; k += 2) set(c, Math.round(kx) + k, ky + 8, INK);
  line(c, kx + 2, ky - 6, kx + 4, ky - 2, BONE[3]);                                                // a crack in the skull
  const eye = awake ? SOUL[pulse > 0.5 ? 0 : 1] : sealed ? INK : SOUL[4];
  for (const ex of [-3, 3]) { disc(c, kx + ex, ky, 2, INK); if (!sealed) { set(c, kx + ex, ky, eye); if (awake) set(c, kx + ex, ky - 1, SOUL[2]); } }
  set(c, kx, ky + 3, INK); set(c, kx + 1, ky + 3, INK);
  // The graveyard either side: a leaning headstone (left) and a little pile of skulls (right).
  for (let y = 98; y < 118; y++) { const sh = Math.round((y - 98) * 0.25); for (let x = 3; x < 16; x++) { const top = 98 + (Math.abs(x - 9.5) > 4 ? 2 : 0); if (y < top) continue; set(c, x + sh - 4, y, x < 5 ? STONE[1] : hash(x, y, 13) < 0.2 ? STONE[3] : STONE[2]); } }
  line(c, 4, 104, 10, 104, STONE[4]); line(c, 7, 101, 7, 108, STONE[4]);
  for (const [sx, sy] of [[110, 113], [116, 113], [113, 109]]) { disc(c, sx, sy, 2.6, BONE[1]); set(c, sx - 1, sy, INK); set(c, sx + 1, sy, INK); set(c, sx, sy + 2, BONE[2]); }
  for (let x = 0; x < W; x++) if (hash(x, 0, 21) < 0.5 && x < 22) { const h = 1 + Math.floor(hash(x, 1, 22) * 4); line(c, x, 118, x, 118 - h, MOSS[hash(x, 2, 23) < 0.5 ? 0 : 1]); }
  raven(c, f, n);
  outline(c, INK);
  if (sealed) grille(c);
  return c;
}
// The raven on the skull's right horn: it blinks, now and then tilts its head, and once a loop ruffles a wing.
function raven(c, f, n) {
  // It perches on the tip of the right horn (about 78, 15), facing out; drawn before the outline, so it gets one.
  const B = [26, 24, 34], B2 = [56, 52, 72], BEAK = [84, 78, 70], fx = 79, fy = 15;
  const tilt = f === Math.floor(n * 0.5) || f === Math.floor(n * 0.5) + 1, blink = f === 2, ruffle = f === n - 2;
  for (let y = 0; y < 6; y++) for (let x = 0; x < 8 - (y > 3 ? (y - 3) * 2 : 0); x++) set(c, fx - 3 + x + (y > 3 ? y - 3 : 0), fy - 7 + y, B);   // body
  line(c, fx - 4, fy - 4, fx - 7, fy - 1, B); line(c, fx - 4, fy - 3, fx - 6, fy, B);                            // tail
  if (ruffle) { line(c, fx - 2, fy - 8, fx + 2, fy - 8, B2); set(c, fx - 1, fy - 9, B2); set(c, fx + 1, fy - 9, B2); } else line(c, fx - 2, fy - 6, fx + 2, fy - 5, B2); // wing
  const hx = fx + 3 + (tilt ? 1 : 0), hy = fy - 11 + (tilt ? 1 : 0);
  rect(c, hx, hy, hx + 4, hy + 4, B); rect(c, hx + 4, hy + 2 + (tilt ? 1 : 0), hx + 7, hy + 3 + (tilt ? 1 : 0), BEAK); set(c, hx + 4, hy + 1 + (tilt ? 1 : 0), BEAK);
  set(c, hx + 2, hy + 1, blink ? B2 : [230, 210, 110]);
  set(c, fx - 1, fy - 1, BEAK); set(c, fx + 1, fy - 1, BEAK);                                                  // feet on the horn
}
// The seal: a wrought-iron grille across the arch, spiked bars, a chain and a padlock.
function grille(c) {
  for (let x = DOOR.x0 + 3; x < DOOR.x1 - 1; x += 6) for (let y = DOOR.apex; y < DOOR.y1; y++) if (inDoor(x, y) && inDoor(x, y - 3)) { set(c, x, y, IRON[1]); set(c, x - 1, y, IRON[0]); }
  for (const y of [66, 92, 112]) for (let x = DOOR.x0; x < DOOR.x1; x++) if (inDoor(x, y)) { set(c, x, y, IRON[1]); set(c, x, y + 1, IRON[2]); }
  for (let x = DOOR.x0 + 3; x < DOOR.x1 - 1; x += 6) { let y = DOOR.apex; while (y < DOOR.y1 && !(inDoor(x, y) && inDoor(x, y - 3))) y++; set(c, x, y - 1, IRON[0]); set(c, x - 1, y - 2, IRON[0]); }
  for (let i = 0; i < 14; i++) { const x = 50 + i * 2, y = 78 + Math.round(Math.sin(i / 13 * Math.PI) * 6); rect(c, x, y, x + 2, y + 2, i % 2 ? IRON[0] : IRON[1]); }
  rect(c, 61, 84, 67, 90, [120, 104, 60]); rect(c, 61, 84, 67, 85, [170, 150, 90]); set(c, 64, 87, INK);
}

// ---- The doorway --------------------------------------------------------------------------------------------------------------
function portal(state, f, n) {
  const c = canvas(), o = DOOR, ph = f / n * Math.PI * 2;
  for (let y = o.apex; y < o.y1; y++) for (let x = o.x0; x < o.x1; x++) {
    if (!inDoor(x, y)) continue;
    const t = (y - o.apex) / (o.y1 - o.apex);
    let col = mix([10, 14, 16], [20, 28, 26], t);
    if (state === "inactive" && y > 100) {
      // Mist creeping along the threshold: blobs that drift right round the loop.
      const k = Math.sin((x - f / n * 44) * 0.28) * 0.5 + Math.sin((x + f / n * 44) * 0.13 + 2) * 0.5, d = (y - 100) / 18;
      if (k + d * 0.9 > 0.5) col = mix(SOUL[4], SOUL[3], 0.3 + 0.5 * d); else if (k + d * 0.9 > 0.15) col = SOUL[4]; else if (k + d > 0) col = SOUL[5];
    }
    if (state === "active") {
      const dx = x - 63.5, dy = y - 80, r = Math.hypot(dx, dy * 0.8), a = Math.atan2(dy, dx);
      const swirl = Math.sin(a * 3 + r * 0.22 - ph) * 0.5 + 0.5, glow = Math.max(0, 1 - r / 38);
      const k = Math.min(1, glow * 0.75 + swirl * 0.45 * (0.3 + glow));
      col = k > 0.85 ? SOUL[1] : k > 0.65 ? SOUL[2] : k > 0.42 ? SOUL[3] : k > 0.2 ? SOUL[4] : SOUL[5];
      if (r < 4) col = SOUL[0];
    }
    set(c, x, y, state === "completed" ? mix(col, [4, 6, 8], 0.4) : col);
  }
  if (state === "active") {
    for (let i = 0; i < 7; i++) {
      const x0 = 47 + i * 5.5, y = o.y1 - 4 - ((f / n + i * 0.37) % 1) * 70, x = x0 + Math.sin(ph + i) * 2;
      if (inDoor(Math.round(x), Math.round(y)) && inDoor(Math.round(x), Math.round(y) + 2)) { set(c, x, y, SOUL[0]); set(c, x, y + 1, SOUL[1]); set(c, x, y + 2, SOUL[2]); }
    }
    if (Math.sin(ph) > -0.2) { const k = SOUL[Math.sin(ph) > 0.6 ? 0 : 1]; for (const ex of [-5, 4]) { set(c, 63.5 + ex, 74, k); set(c, 64.5 + ex, 74, k); } line(c, 61, 82, 66, 82, k); set(c, 60, 81, k); set(c, 67, 81, k); }
  }
  return c;
}

// ---- Write the gate ---------------------------------------------------------------------------------------------------------
const files = [];
fs.mkdirSync(path.join(ROOT, DIR), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, DIR))) if (f.endsWith(".png")) fs.unlinkSync(path.join(ROOT, DIR, f));   // frame counts may have changed
for (const state of Object.keys(COUNT)) for (let f = 0; f < COUNT[state]; f++) {
  const c = canvas(); over(c, portal(state, f, COUNT[state])); over(c, frame(state, f, COUNT[state]));
  const rel = DIR + state + "_" + String(f).padStart(2, "0") + ".png"; png.encode(c, path.join(ROOT, rel)); files.push(rel);
}
console.log("necro_gate: " + files.length + " frames written to " + DIR);
module.exports = { files, COUNT };
