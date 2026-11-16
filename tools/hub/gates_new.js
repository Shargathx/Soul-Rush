// Draws the Cat's and the Bladekeeper's gates for the hub: 128x128 pixel art (the hub draws gates at 2x), in the style of the
// gate pack's gates: an empty dark doorway while inert (inactive), an animated portal once woken (active, 12 frames at 0.1 s),
// and the doorway sealed once the boss is beaten (completed).
//   The Cat's gate is a cat tree: sisal-wrapped posts, a carpeted perch with a plush hide on top, a toy dangling in the
//   doorway and a tabby on the perch that is gone once the fight is over (the real cat, if you befriended it, sits somewhere in the hall: hub.js CAT). The portal is a vortex of yarn with a cat's eyes in it;
//   sealed, it is criss-crossed with yarn like the torii's ties.
//   The Bladekeeper's gate is steel: pillars of riveted plates, a crown of blades round a pointed arch with a cog and a gem on
//   top, swords planted either side. The portal is slashes of light; sealed, a great sword bars it, with chains.
// Output: assets/backgrounds/hub/cat_gate/{inactive,active_00..11,completed}.png and blade_gate/ likewise.
// Run: node tools/hub/gates_new.js
const fs = require("fs");
const path = require("path");
const png = require("../bosses/png.js");

const W = 128, H = 128, FRAMES = 12;
const ROOT = path.join(__dirname, "..", "..");
const OUT = "assets/backgrounds/hub/";

// ---- A little canvas ------------------------------------------------------------------------------------------------------
function canvas() { return { w: W, h: H, data: Buffer.alloc(W * H * 4) }; }
const set = (c, x, y, col) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const p = (y * W + x) * 4; c.data[p] = col[0]; c.data[p + 1] = col[1]; c.data[p + 2] = col[2]; c.data[p + 3] = col.length > 3 ? col[3] : 255; };
const get = (c, x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return [0, 0, 0, 0]; const p = (y * W + x) * 4; return [c.data[p], c.data[p + 1], c.data[p + 2], c.data[p + 3]]; };
const rect = (c, x0, y0, x1, y1, col) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(c, x, y, col); };
const line = (c, x0, y0, x1, y1, col) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) set(c, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, col); };
const disc = (c, cx, cy, r, col) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.5) set(c, x, y, col); };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const seeded = seed => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
// Dark outline round every opaque shape (on transparent pixels next to opaque ones).
function outline(c, col) {
  const add = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (get(c, x, y)[3] === 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => get(c, x + dx, y + dy)[3] > 0)) add.push([x, y]);
  for (const [x, y] of add) set(c, x, y, col);
}
// Paint `src` over `dst`.
function over(dst, src) { for (let i = 0; i < W * H; i++) { const a = src.data[i * 4 + 3]; if (!a) continue; for (let k = 0; k < 4; k++) dst.data[i * 4 + k] = src.data[i * 4 + k]; } }
const save = (c, rel) => { fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true }); png.encode(c, path.join(ROOT, rel)); };

// =========================================================================================================================
// THE CAT'S GATE: a cat tree
// =========================================================================================================================
const CAT = {
  open: { x0: 38, x1: 90, y0: 42, y1: 118, r: 14 },    // the doorway: a rounded cat-hole between the posts
  outline: [30, 24, 44],
  sisal: [[226, 196, 140], [206, 172, 114], [176, 140, 90], [138, 104, 66]],
  carpet: [[112, 184, 190], [70, 138, 148], [48, 104, 118], [30, 70, 88]],
  plush: [[170, 134, 196], [132, 98, 164], [96, 68, 128], [64, 44, 94]]
};
const inCatDoor = (x, y) => { const o = CAT.open; if (x < o.x0 || x >= o.x1 || y < o.y0 || y >= o.y1) return false; const r = o.r; const cx = x < o.x0 + r ? o.x0 + r : x >= o.x1 - r ? o.x1 - r : x; const cy = y < o.y0 + r ? o.y0 + r : y; return (x - cx) ** 2 + (y - cy) ** 2 <= r * r; };

function catFrame(sleeping, phase) {
  const c = canvas(), rnd = seeded(7);
  // The base: a carpeted plinth with a lip.
  rect(c, 8, 114, 120, 122, CAT.carpet[1]); rect(c, 8, 114, 120, 117, CAT.carpet[0]); rect(c, 8, 120, 120, 122, CAT.carpet[3]); rect(c, 8, 117, 120, 119, CAT.carpet[2]);
  for (let x = 12; x < 118; x += 6) set(c, x, 118, CAT.carpet[3]);                                    // stitching
  // Posts: sisal rope, wound in bands, with a lit edge and a shaded edge and claw scratches.
  for (const [x0, x1] of [[22, 38], [90, 106]]) {
    for (let y = 30; y < 116; y++) for (let x = x0; x < x1; x++) {
      const band = (y % 4 === 0) ? 3 : (y % 4 === 1 ? 2 : (y % 4 === 2 ? 1 : 1));
      let col = CAT.sisal[band === 3 ? 3 : band === 2 ? 2 : 1];
      if (x === x0 || x === x0 + 1) col = CAT.sisal[band === 3 ? 2 : 0]; else if (x >= x1 - 2) col = CAT.sisal[band === 3 ? 3 : 2];
      set(c, x, y, col);
    }
    for (let i = 0; i < 7; i++) { const sx = x0 + 3 + Math.floor(rnd() * (x1 - x0 - 8)), sy = 40 + Math.floor(rnd() * 60); line(c, sx, sy, sx + 2, sy + 7, CAT.sisal[3]); line(c, sx + 1, sy, sx + 3, sy + 7, CAT.sisal[0]); }
    rect(c, x0 - 2, 112, x1 + 2, 116, CAT.carpet[2]); rect(c, x0 - 2, 112, x1 + 2, 113, CAT.carpet[0]); // foot
  }
  // The top perch: a carpeted board with a lit top face.
  rect(c, 10, 20, 118, 34, CAT.carpet[1]); rect(c, 10, 20, 118, 25, CAT.carpet[0]); rect(c, 10, 25, 118, 27, CAT.carpet[1]); rect(c, 10, 31, 118, 34, CAT.carpet[3]); rect(c, 10, 29, 118, 31, CAT.carpet[2]);
  for (let x = 14; x < 116; x += 6) set(c, x, 30, CAT.carpet[3]);
  for (const x of [10, 117]) rect(c, x, 21, x + 1, 33, CAT.carpet[2]);
  // The plush hide on the right: a dome with two ears and a doorway.
  for (let y = 4; y < 20; y++) for (let x = 78; x < 114; x++) { const dx = (x - 96) / 18, dy = (y - 20) / 16; if (dx * dx + dy * dy <= 1) set(c, x, y, y < 8 ? CAT.plush[0] : x < 90 ? CAT.plush[1] : CAT.plush[2]); }
  line(c, 82, 9, 80, 3, CAT.plush[1]); line(c, 83, 9, 84, 4, CAT.plush[1]); set(c, 81, 4, CAT.plush[0]); line(c, 110, 9, 112, 3, CAT.plush[2]); line(c, 109, 9, 108, 4, CAT.plush[2]);
  disc(c, 96, 18, 7, CAT.outline); rect(c, 89, 18, 104, 20, CAT.outline);                                 // the hide's doorway
  for (const [x, y] of [[88, 12], [104, 14], [96, 7]]) set(c, x, y, CAT.plush[3]);
  // The toys: a pom-pom on a string in the doorway, a feather on the right.
  line(c, 52, 34, 52, 52, [220, 210, 190]); disc(c, 52, 55, 4, [204, 60, 76]); set(c, 51, 53, [240, 140, 150]); set(c, 53, 57, [150, 36, 56]);
  line(c, 78, 34, 78, 46, [220, 210, 190]); line(c, 78, 46, 76, 54, [92, 190, 200]); line(c, 78, 46, 79, 53, [186, 232, 236]); line(c, 77, 48, 74, 51, [92, 190, 200]);
  // A fish dish and a few tufts of fur on the plinth.
  rect(c, 12, 108, 26, 114, [198, 70, 80]); rect(c, 12, 108, 26, 110, [230, 120, 120]); for (const x of [15, 18, 21]) set(c, x, 107, [160, 110, 70]);
  for (const [x, y] of [[30, 113], [60, 114], [100, 113], [84, 112], [16, 116]]) { set(c, x, y, [226, 128, 44]); set(c, x + 1, y - 1, [226, 128, 44]); }
  // The tabby on the perch.
  if (sleeping !== null) tabby(c, sleeping, phase);                                                     // null: the cat has gone (the perch is empty once the fight is won)
  outline(c, CAT.outline);
  return c;
}

// An orange tabby, 18 px: sitting and watching (tail swaying with phase 0 to 1), or curled up asleep.
function tabby(c, sleeping, phase) {
  const O = [224, 124, 40], D = [172, 84, 28], L = [250, 190, 120], N = [40, 30, 50];
  if (sleeping) {
    for (let y = 12; y < 20; y++) for (let x = 20; x < 42; x++) { const dx = (x - 31) / 11, dy = (y - 20) / 8; if (dx * dx + dy * dy <= 1) set(c, x, y, y < 14 ? L : y > 17 ? D : O); }
    disc(c, 22, 16, 3.5, O); set(c, 20, 13, D); set(c, 23, 13, D);                                     // head tucked in
    line(c, 21, 16, 23, 16, N);                                                                          // closed eye
    line(c, 40, 17, 44, 19, O); line(c, 39, 18, 43, 20, D);                                             // the tail round the body
    for (let i = 0; i < 4; i++) set(c, 28 + i * 3, 13 + (i % 2), D);                                    // stripes
    return;
  }
  rect(c, 22, 10, 31, 20, O); rect(c, 22, 10, 24, 20, L); rect(c, 29, 10, 31, 20, D);                  // body
  rect(c, 21, 3, 30, 11, O); rect(c, 21, 3, 23, 11, L);                                                 // head
  set(c, 21, 2, O); set(c, 22, 1, D); set(c, 29, 2, O); set(c, 28, 1, D);                               // ears
  set(c, 24, 6, N); set(c, 27, 6, N); set(c, 25, 8, [240, 140, 150]);                                   // eyes, nose
  for (let i = 0; i < 3; i++) { set(c, 22, 12 + i * 3, D); set(c, 23, 12 + i * 3, D); }                // stripes
  rect(c, 24, 19, 26, 20, L); rect(c, 28, 19, 30, 20, L);                                               // paws
  const sway = Math.sin(phase * Math.PI * 2) * 3;                                                        // the tail: out to the right, swinging
  for (let i = 0; i < 12; i++) { const t = i / 11; set(c, 31 + i, 18 - Math.round(Math.sin(t * Math.PI) * 4 + sway * t), O); set(c, 31 + i, 19 - Math.round(Math.sin(t * Math.PI) * 4 + sway * t), D); }
}

// The doorway's contents for each state, clipped to the cat-hole.
function catPortal(state, f) {
  const c = canvas(), o = CAT.open, cx = 64, cy = 84;
  for (let y = o.y0; y < o.y1; y++) for (let x = o.x0; x < o.x1; x++) {
    if (!inCatDoor(x, y)) continue;
    const t = (y - o.y0) / (o.y1 - o.y0);
    let col = mix([26, 20, 40], [44, 30, 56], t);
    if (state === "active") {
      const dx = x - cx, dy = (y - cy) * 0.9, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const v = Math.sin(a * 3 + r * 0.38 - (f / FRAMES) * Math.PI * 2 * 2) * 0.5 + 0.5;         // spiralling yarn
      const edge = Math.max(0, 1 - Math.abs(r - 24) / 24);                                         // brightest in a ring
      const k = Math.min(1, v * 0.8 + edge * 0.35);
      col = r < 7 ? mix([20, 14, 30], [60, 36, 40], r / 7) : mix([88, 36, 30], [255, 200, 90], Math.pow(k, 1.4) * (1 - Math.max(0, (r - 30) / 26) * 0.55));
      if (((x * 7 + y * 13 + f * 5) % 53) === 0 && r > 12) col = [255, 244, 190];                    // sparks
    } else if (state === "completed") col = mix(col, [20, 16, 30], 0.4);
    set(c, x, y, col);
  }
  if (state === "active") {                                                                          // the cat's eyes in the dark of the vortex
    const blink = f === 5 || f === 6 ? 1 : 3, pulse = 0.5 + 0.5 * Math.sin((f / FRAMES) * Math.PI * 2);
    for (const ex of [56, 72]) { for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if ((x / 3.2) ** 2 + (y / blink) ** 2 <= 1) set(c, ex + x, 74 + y, mix([200, 230, 70], [255, 255, 150], pulse)); if (blink > 1) rect(c, ex, 71, ex + 1, 78, [10, 6, 16]); }
  }
  if (state === "completed") {                                                                       // yarn criss-crossing the doorway, a ball at the foot
    const reds = [[210, 70, 84], [150, 40, 62]], blues = [[96, 140, 220], [56, 90, 170]];
    const strand = (x0, y0, x1, y1, pal) => { line(c, x0, y0, x1, y1, pal[0]); line(c, x0, y0 + 1, x1, y1 + 1, pal[1]); };
    strand(36, 52, 92, 108, reds); strand(92, 50, 36, 106, blues); strand(36, 80, 92, 74, reds); strand(36, 96, 92, 62, blues); strand(40, 112, 90, 56, reds);
    for (const [x, y] of [[64, 80], [50, 66], [78, 66], [50, 94], [78, 94]]) disc(c, x, y, 1.6, [240, 230, 210]);   // the knots
    disc(c, 56, 108, 8, reds[0]); disc(c, 56, 108, 7, reds[1]); for (let i = 0; i < 5; i++) line(c, 49 + i, 106 - i / 2, 62 - i, 112 - i, i % 2 ? reds[0] : [236, 110, 122]);
    line(c, 64, 112, 80, 116, reds[0]);
  }
  return c;
}

// =========================================================================================================================
// THE BLADEKEEPER'S GATE: steel
// =========================================================================================================================
const BLADE = {
  open: { x0: 40, x1: 88, y0: 48, y1: 120, apex: 36 },  // the doorway: a pointed arch
  outline: [18, 22, 32],
  steel: [[214, 224, 236], [164, 176, 194], [120, 132, 152], [78, 88, 108], [48, 56, 72]]
};
const inBladeDoor = (x, y) => {
  const o = BLADE.open; if (x < o.x0 || x >= o.x1 || y >= o.y1 || y < o.apex) return false;
  if (y >= o.y0) return true;
  const half = (o.x1 - o.x0) / 2, k = (y - o.apex) / (o.y0 - o.apex);                              // a pointed arch: narrower toward the apex
  return Math.abs(x - 64) <= half * Math.pow(k, 0.62);
};
function bladeFrame(state, f) {
  const c = canvas(), S = BLADE.steel;
  // Steps: three tiers of diamond plate.
  for (const [x0, x1, y0, y1] of [[10, 118, 118, 124], [16, 112, 114, 118], [20, 108, 110, 114]]) {
    rect(c, x0, y0, x1, y1, S[2]); rect(c, x0, y0, x1, y0 + 1, S[0]); rect(c, x0, y1 - 1, x1, y1, S[4]);
    for (let x = x0 + 2; x < x1 - 1; x += 4) { set(c, x, y0 + 2, S[1]); set(c, x + 1, y0 + 2, S[3]); }
  }
  // Pillars: stacked plates with seams, rivets and a lit left edge.
  for (const [x0, x1] of [[20, 40], [88, 108]]) {
    for (let y = 40; y < 112; y++) for (let x = x0; x < x1; x++) {
      const seam = (y - 40) % 9 === 0, lit = x < x0 + 3, shade = x >= x1 - 4;
      set(c, x, y, seam ? S[4] : lit ? S[0] : shade ? S[3] : (y - 40) % 9 < 3 ? S[1] : S[2]);
    }
    for (let y = 44; y < 108; y += 9) { set(c, x0 + 4, y, S[0]); set(c, x1 - 5, y, S[0]); set(c, x0 + 4, y + 1, S[4]); set(c, x1 - 5, y + 1, S[4]); }
    for (let y = 40; y < 112; y++) set(c, Math.round((x0 + x1) / 2), y, S[3]);                       // a groove down the middle
    for (let i = 0; i < 9; i++) { const w = 9 - i; rect(c, Math.round((x0 + x1) / 2) - Math.ceil(w / 2), 31 + i, Math.round((x0 + x1) / 2) + Math.floor(w / 2), 32 + i, i < 4 ? S[1] : S[2]); } // the finial spike
  }
  // The crown: blades along the arch, pointing out, long and short in turn, and a steel band under them.
  const o = BLADE.open;
  for (let i = 0; i <= 60; i++) {
    const u = i / 60, ang = Math.PI * (1 - u);                                                      // from the left springing over to the right
    const rx = 36, ry = 34, ex = 64 + Math.cos(ang) * rx, ey = 48 - Math.sin(ang) * ry * (0.55 + 0.45 * Math.sin(ang));
    const nx = Math.cos(ang), ny = -Math.sin(ang), len = i % 6 === 0 ? 11 : i % 3 === 0 ? 6 : 0;
    set(c, ex, ey, S[1]); set(c, ex + nx * -1, ey - ny * -1, S[2]);
    if (len) for (let s = 1; s <= len; s++) { const w = (len - s) / len; set(c, ex + nx * s, ey + ny * s, w > 0.5 ? S[0] : S[1]); if (w > 0.35) set(c, ex + nx * s + ny * 0.8, ey + ny * s - nx * 0.8, S[2]); }
  }
  // Lintel plates at the pillar tops joining the crown, and the cog in the middle.
  rect(c, 20, 36, 108, 44, S[2]); rect(c, 20, 36, 108, 38, S[0]); rect(c, 20, 42, 108, 44, S[4]);
  for (let x = 24; x < 106; x += 8) { set(c, x, 40, S[0]); set(c, x, 41, S[4]); }
  cog(c, 64, 26, 11, state === "active" ? f : 0, state);
  // Swords planted either side, points in the floor and hilts up, leaning out.
  for (const [bx, lean] of [[9, 0.1], [16, 0.04], [119, -0.1], [112, -0.04]]) sword(c, bx, 118, lean);
  // Chains hanging from the pillar tops.
  for (const [sx, dir] of [[20, -1], [108, 1]]) for (let i = 0; i < 9; i++) { const x = sx + dir * (2 + Math.round(Math.sin(i * 0.35) * 3)), y = 46 + i * 5; rect(c, x, y, x + 2, y + 3, i % 2 ? S[3] : S[1]); set(c, x, y + 1, S[4]); }
  outline(c, BLADE.outline);
  if (state === "completed") barSword(c);
  return c;
}
function cog(c, cx, cy, r, f, state) {
  const S = BLADE.steel, rot = (f / FRAMES) * (Math.PI / 4), teeth = 8;                             // 8 teeth: a 1/8 turn loops perfectly
  for (let y = -r - 3; y <= r + 3; y++) for (let x = -r - 3; x <= r + 3; x++) {
    const d = Math.hypot(x, y), a = Math.atan2(y, x) - rot, tooth = Math.cos(a * teeth) > 0.2 ? 3 : 0;
    if (d <= r - 1 + tooth * (d > r - 2 ? 1 : 0) && d <= r + tooth) set(c, cx + x, cy + y, d > r - 3 ? (x + y < 0 ? S[0] : S[2]) : (x + y < 0 ? S[1] : S[3]));
  }
  disc(c, cx, cy, 5, S[4]);
  const lit = state === "active" ? [140, 236, 255] : state === "completed" ? [60, 70, 88] : [70, 110, 130];
  disc(c, cx, cy, 3, lit); set(c, cx - 1, cy - 1, state === "active" ? [255, 255, 255] : mix(lit, [255, 255, 255], 0.3));
}
function sword(c, x, y, lean) {                                                                    // a sword with its point at (x, y), hilt up
  const S = BLADE.steel;
  for (let i = 0; i < 64; i++) {
    const w = i < 6 ? 0 : 1, bx = x - lean * i, by = y - i, half = i < 8 ? i / 8 * 2 : 2;
    for (let k = -Math.round(half); k <= Math.round(half); k++) set(c, bx + k, by, k < 0 ? S[0] : k === 0 && i > 8 ? S[1] : S[2]);
  }
  const tx = x - lean * 64, ty = y - 64;
  rect(c, Math.round(tx) - 5, ty - 2, Math.round(tx) + 6, ty, S[3]); rect(c, Math.round(tx) - 1, ty - 9, Math.round(tx) + 2, ty - 2, [96, 60, 44]); disc(c, tx, ty - 10, 2, S[3]);
}
function barSword(c) {                                                                             // the sealing: a great sword across the doorway and two chains
  const S = BLADE.steel, y = 86;
  for (let x = 30; x < 100; x++) { const half = x > 90 ? Math.max(0, (100 - x) / 4) : 3; for (let k = -Math.round(half); k <= Math.round(half); k++) set(c, x, y + k, k < 0 ? S[2] : k === 0 ? S[3] : S[4]); }
  rect(c, 22, y - 6, 30, y + 7, S[3]); rect(c, 22, y - 6, 24, y + 7, S[1]); rect(c, 14, y - 2, 22, y + 3, [96, 60, 44]); disc(c, 12, y, 3, S[3]);
  for (const [x0, y0, x1, y1] of [[40, 52, 88, 112], [88, 54, 40, 110]]) { const n = 26; for (let i = 0; i < n; i++) { const t = i / (n - 1), x = x0 + (x1 - x0) * t, yy = y0 + (y1 - y0) * t; rect(c, Math.round(x), Math.round(yy), Math.round(x) + 3, Math.round(yy) + 2, i % 2 ? S[3] : S[1]); } }
  outline(c, BLADE.outline);
}
function bladePortal(state, f) {
  const c = canvas(), o = BLADE.open, rnd = seeded(11);
  for (let y = o.apex; y < o.y1; y++) for (let x = o.x0; x < o.x1; x++) {
    if (!inBladeDoor(x, y)) continue;
    const t = (y - o.apex) / (o.y1 - o.apex);
    let col = mix([16, 20, 30], [30, 38, 54], t);
    if (state === "active") {
      const dx = x - 64, dy = y - 84, r = Math.hypot(dx, dy);
      const sweep = ((x * 0.8 + y * 0.6 + 0.5 * Math.sin(y * 0.15) * 4 - f * 128 / FRAMES * 1.0) % 32 + 32) % 32;  // diagonal bands of light, drifting
      const band = sweep < 3 ? 1 : sweep < 5 ? 0.45 : 0;
      const glow = Math.max(0, 1 - r / 46);
      col = mix([24, 52, 74], [150, 226, 246], Math.min(1, glow * 0.7 + band * 0.8));
      if (band > 0.9) col = [240, 252, 255];
      const sp = (x * 11 + y * 7 + f * 3) % 61; if (sp === 0 && r > 8) col = [255, 255, 255];
    }
    set(c, x, y, state === "completed" ? mix(col, [10, 12, 18], 0.35) : col);
  }
  return c;
}

// ---- Write the two gates ------------------------------------------------------------------------------------------------
function composite(portal, frame) { const c = canvas(); over(c, portal); over(c, frame); return c; }
// Backing plate: transparent pixels the picture encloses (between the crown, the lintel, the arch and the pillars) would let the hub's
// background shine through the gate. Fill them with dark riveted steel. Only pockets the outline fully encloses: the
// open air (outside the outline) stays open.
function sealVoids(c, col) {
  const seen = new Uint8Array(W * H), stack = [];
  for (let x = 0; x < W; x++) stack.push([x, 0], [x, H - 1]);
  for (let y = 0; y < H; y++) stack.push([0, y], [W - 1, y]);
  while (stack.length) { const [x, y] = stack.pop(); if (x < 0 || y < 0 || x >= W || y >= H || seen[y * W + x] || get(c, x, y)[3] > 0) continue; seen[y * W + x] = 1; stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (get(c, x, y)[3] > 0 || seen[y * W + x]) continue;
    const seam = (y - 6) % 9 === 0, rivet = (y - 6) % 9 === 4 && x % 8 === 3;
    set(c, x, y, seam ? col[0] : rivet ? col[2] : col[1]); n++;
  }
  return n;
}
const files = [];
function emit(dir, name, c) { const rel = OUT + dir + "/" + name + ".png"; save(c, rel); files.push(rel); }
emit("cat_gate", "inactive_00", composite(catPortal("inactive", 0), catFrame(false, 0)));
emit("cat_gate", "completed_00", composite(catPortal("completed", 0), catFrame(null, 0)));
const bladeGate = (state, f) => { const c = composite(bladePortal(state, f), bladeFrame(state, f)); sealVoids(c, [BLADE.steel[4], mix(BLADE.steel[4], BLADE.steel[3], 0.35), BLADE.steel[2]]); return c; };
emit("blade_gate", "inactive_00", bladeGate("inactive", 0));
emit("blade_gate", "completed_00", bladeGate("completed", 0));
for (let f = 0; f < FRAMES; f++) {
  const n = "active_" + String(f).padStart(2, "0");
  emit("cat_gate", n, composite(catPortal("active", f), catFrame(false, f / FRAMES)));
  emit("blade_gate", n, bladeGate("active", f));
}
console.log("gates_new: " + files.length + " frames written to " + OUT + "cat_gate and blade_gate");
module.exports = { files };
