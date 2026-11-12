// Draws the hub's furniture and trophies as pixel art (1x, saved at 2x):
// bench, keeper (2 breathing frames), lectern, pew, rug, candles, plinth, sword_stand, relic_katana, relic_bow, dummy,
// construction_sign, construction_tape_x, construction_tape_cones (the gag at unfinished bosses' gates),
// plus god_ray.png (a soft light beam, saved at 1x so it stays smooth).
// Usage: node tools/hub/props.js
const path = require("path");
const { canvas, savePng, hex, mix } = require("./pixel.js");
const OUT = path.join(__dirname, "..", "..", "assets", "backgrounds", "hub");
const noise = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

const P = {
  stoneDark: hex("#1c1c23"), stone: hex("#33333d"), stoneLit: hex("#4d4d5a"), stoneHi: hex("#62627a"),
  woodDark: hex("#2a1a12"), wood: hex("#4a2e1c"), woodLit: hex("#6b4428"),
  robeDark: hex("#16131b"), robe: hex("#26202e"), robeLit: hex("#3a3146"), skin: hex("#c8a68a"),
  iron: hex("#2b2731"), ironLit: hex("#4d4757"),
  page: hex("#d8ccb0"), pageShade: hex("#a89a7c"), ink: hex("#5a4a3a"),
  red: hex("#5c161b"), redDark: hex("#3a0d11"), redLit: hex("#7e2228"), gold: hex("#9a7636"),
  wax: hex("#e3d8bd"), waxShade: hex("#a89c84"), flame: hex("#ffc24a"), flameCore: hex("#fff0b8"), ember: hex("#f06a1c"),
  steel: hex("#b8c0cc"), steelDark: hex("#6c7482"), wrap: hex("#3a0f14"), wrapLit: hex("#6a1c24"), tsuba: hex("#7a6a3a"),
  bowWood: hex("#6b4a2a"), bowDark: hex("#3e2a18"), string: hex("#d8d0b8"), leaf: hex("#3c6a3a")
};
const rect = (c, x0, y0, x1, y1, col) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.set(x, y, col); };
const flame = (c, x, y) => { c.set(x, y, P.flame); c.set(x, y - 1, P.flameCore); c.set(x + 1, y - 1, P.ember); c.set(x, y - 2, P.flame); };

// A stone bench: a thick slab on two blocky legs.
function bench() {
  const c = canvas(40, 14);
  rect(c, 0, 0, 40, 2, P.stoneLit); rect(c, 0, 2, 40, 5, P.stone); rect(c, 0, 5, 40, 6, P.stoneDark);
  for (const x0 of [3, 29]) { rect(c, x0, 6, x0 + 8, 14, P.stone); rect(c, x0, 6, x0 + 1, 14, P.stoneLit); rect(c, x0 + 7, 6, x0 + 8, 14, P.stoneDark); }
  for (let x = 0; x < 40; x += 9) c.set(x, 3, P.stoneDark);
  return c;
}

// The keeper: a hooded figure sitting on a low stool, both hands on a staff that carries a small lantern.
// Frame 2 breathes (the hood dips a pixel) and the lantern flame shifts.
function keeper(frame) {
  const c = canvas(26, 36), b = frame; // b: 0 or 1, the breath
  // Stool.
  rect(c, 7, 31, 19, 33, P.woodLit); rect(c, 8, 33, 10, 36, P.wood); rect(c, 16, 33, 18, 36, P.wood);
  // Robe: a wide cone from the shoulders to the floor, folds as darker stripes.
  for (let y = 12 + b; y < 34; y++) {
    const t = (y - 12) / 22, half = 4 + t * 7;
    for (let x = Math.round(12 - half); x <= Math.round(12 + half); x++) {
      const fold = (x + Math.floor(y / 3)) % 5 === 0;
      c.set(x, y, x < 12 - half * 0.5 ? P.robeLit : fold ? P.robeDark : P.robe);
    }
  }
  // Hood and the shadow inside it, with a pale glint of a face.
  for (let y = 3 + b; y < 14 + b; y++) for (let x = 6; x < 18; x++) {
    const dx = (x - 11.5) / 5.5, dy = (y - (8.5 + b)) / 5.5;
    if (dx * dx + dy * dy > 1) continue;
    c.set(x, y, dx < -0.5 ? P.robeLit : P.robe);
  }
  rect(c, 10, 7 + b, 15, 12 + b, P.robeDark);
  c.set(12, 10 + b, P.skin); c.set(13, 10 + b, mix(P.skin, P.robeDark, 0.5));
  // Hands on the staff, and the staff with its lantern.
  rect(c, 18, 2, 19, 34, P.woodLit); rect(c, 19, 2, 20, 34, P.wood);
  rect(c, 16, 20 + b, 19, 22 + b, P.skin);
  rect(c, 20, 3, 25, 4, P.iron); // hook arm
  rect(c, 22, 4, 25, 10, P.iron); rect(c, 23, 5, 24, 9, frame ? P.flame : P.flameCore); c.set(23, 6 + frame, P.ember);
  rect(c, 22, 10, 25, 11, P.ironLit);
  return c;
}

// A wooden lectern holding an open book.
function lectern() {
  const c = canvas(22, 34);
  // Foot and post.
  rect(c, 4, 31, 18, 34, P.woodDark); rect(c, 5, 30, 17, 31, P.wood);
  rect(c, 9, 12, 13, 30, P.wood); rect(c, 9, 12, 10, 30, P.woodLit); rect(c, 12, 12, 13, 30, P.woodDark);
  for (const y of [16, 24]) rect(c, 8, y, 14, y + 1, P.woodLit);
  // Slanted desk.
  for (let x = 1; x < 21; x++) { const top = 6 + Math.round((20 - x) * 0.25); rect(c, x, top, x + 1, top + 4, x < 3 ? P.woodLit : P.wood); c.set(x, top + 4, P.woodDark); }
  // Open book on the desk, with a ribbon.
  for (let x = 3; x < 19; x++) { const top = 4 + Math.round((20 - x) * 0.25); rect(c, x, top, x + 1, top + 2, x === 10 || x === 11 ? P.pageShade : P.page); if (x % 3 === 0 && x !== 9 && x !== 12) c.set(x, top, P.ink); }
  c.set(11, 9, P.red); c.set(11, 10, P.red); c.set(11, 11, P.redDark);
  return c;
}

// A wooden pew (side view): a seat, a tall back, three legs.
function pew() {
  const c = canvas(92, 24);
  rect(c, 0, 12, 92, 15, P.wood); rect(c, 0, 12, 92, 13, P.woodLit); rect(c, 0, 15, 92, 16, P.woodDark);
  rect(c, 2, 0, 92, 3, P.woodLit); rect(c, 2, 3, 92, 5, P.wood); rect(c, 2, 5, 92, 6, P.woodDark); // back rail
  for (const x0 of [2, 30, 58, 86]) { rect(c, x0, 3, x0 + 3, 12, P.wood); c.set(x0, 3, P.woodLit); }
  for (const x0 of [3, 44, 85]) { rect(c, x0, 16, x0 + 4, 24, P.wood); rect(c, x0 + 3, 16, x0 + 4, 24, P.woodDark); }
  return c;
}

// A long red runner lying on the floor, seen almost edge-on: a thin band with gold edges and fringes at the ends.
function rug() {
  const c = canvas(140, 6);
  rect(c, 3, 1, 137, 5, P.red); rect(c, 3, 1, 137, 2, P.redLit); rect(c, 3, 4, 137, 5, P.redDark);
  for (let x = 3; x < 137; x++) if (x % 6 === 0) c.set(x, 2, P.gold), c.set(x, 3, P.gold);
  rect(c, 3, 1, 4, 5, P.gold); rect(c, 136, 1, 137, 5, P.gold);
  for (let y = 1; y < 5; y++) { if (y % 2) { c.set(1, y, P.gold); c.set(2, y, P.gold); c.set(137, y, P.gold); c.set(138, y, P.gold); } }
  return c;
}

// A cluster of candles on a flat stone, melted together.
function candles() {
  const c = canvas(24, 16);
  rect(c, 0, 13, 24, 16, P.stone); rect(c, 0, 13, 24, 14, P.stoneLit);
  for (const [x, h] of [[2, 4], [6, 9], [10, 6], [14, 11], [18, 7], [21, 3]]) {
    rect(c, x, 13 - h, x + 2, 13, P.wax); rect(c, x + 1, 13 - h, x + 2, 13, P.waxShade); flame(c, x, 12 - h);
  }
  for (let x = 1; x < 23; x++) if (noise(x, 1) > 0.5) c.set(x, 12, P.wax); // pooled wax
  return c;
}

// A stone plinth: capped base, shaft, cap.
function plinth() {
  const c = canvas(26, 32);
  rect(c, 1, 0, 25, 3, P.stoneHi); rect(c, 1, 3, 25, 5, P.stone);
  rect(c, 4, 5, 22, 27, P.stone); rect(c, 4, 5, 6, 27, P.stoneLit); rect(c, 20, 5, 22, 27, P.stoneDark);
  for (let y = 9; y < 27; y += 6) rect(c, 6, y, 20, y + 1, P.stoneDark);
  rect(c, 1, 27, 25, 29, P.stone); rect(c, 0, 29, 26, 32, P.stoneLit);
  return c;
}

// A katana-kake: a low black-lacquered sword stand with two curved arms, red cord at the joints. Always shown;
// the katana (relic_katana) appears resting on its arms once the Samurai is beaten.
const lacquer = hex("#151216"), lacquerLit = hex("#33292e"), cord = hex("#8a1f26");
function swordStand() {
  const c = canvas(56, 20);
  // Base: a low plank with feet.
  rect(c, 2, 16, 54, 18, lacquerLit); rect(c, 2, 18, 54, 19, lacquer);
  rect(c, 3, 19, 8, 20, lacquer); rect(c, 48, 19, 53, 20, lacquer);
  // Two uprights, each ending in a forward-curving arm that cradles the sword.
  for (const x0 of [10, 43]) {
    rect(c, x0, 6, x0 + 3, 16, lacquer); rect(c, x0, 6, x0 + 1, 16, lacquerLit);
    rect(c, x0 - 2, 4, x0 + 5, 6, lacquer); c.set(x0 - 2, 3, lacquer); c.set(x0 + 4, 3, lacquer); rect(c, x0 - 1, 4, x0 + 4, 5, lacquerLit);
    c.set(x0 + 1, 13, cord); c.set(x0 + 2, 13, cord); c.set(x0 + 1, 14, cord);
  }
  return c;
}
// The Samurai's katana, lying level: red-wrapped grip on the left, the round guard, a slightly curved blade.
function relicKatana() {
  const c = canvas(56, 6);
  for (let x = 0; x < 13; x++) { rect(c, x, 2, x + 1, 4, x % 2 ? P.wrap : P.wrapLit); }
  c.set(0, 2, P.gold); c.set(0, 3, P.gold);
  rect(c, 13, 0, 15, 6, P.tsuba); c.set(13, 0, P.gold); c.set(14, 5, P.gold);
  // The blade: edge on top, back below. Towards the tip the back falls away first, so it ends in a sharp point.
  for (let x = 15; x < 55; x++) {
    c.set(x, 2, P.steel);
    if (x < 50) c.set(x, 3, P.steelDark);
  }
  return c;
}

// The Leaf Ranger's longbow, leaning against the side of its plinth (to the right of this image), with his quiver
// standing beside it. The stave is thick with recurved tips, a leather grip and leaf wraps; the string runs along the
// lean, so the bow bulges away from the plinth.
const bowLit = hex("#9a6e3e"), leather = hex("#5a3a22"), leatherDark = hex("#3a2414"), leatherLit = hex("#7a5232");
function relicBow() {
  const c = canvas(40, 48);
  // The lean: an axis from the foot on the floor to the top against the plinth.
  const foot = [26, 46], tip = [36, 2];
  const len = Math.hypot(tip[0] - foot[0], tip[1] - foot[1]);
  const dx = (tip[0] - foot[0]) / len, dy = (tip[1] - foot[1]) / len;
  const nx = dy, ny = -dx; // the normal pointing away from the plinth (left)
  const at = (u, off) => [foot[0] + dx * len * u + nx * off, foot[1] + dy * len * u + ny * off];
  // The string, along the axis.
  for (let u = 0.03; u <= 0.97; u += 0.004) { const [x, y] = at(u, 0); c.set(Math.round(x), Math.round(y), P.string); }
  // The stave: bulging out to 8 px at the grip, curving back near the tips.
  for (let u = 0; u <= 1; u += 0.003) {
    const t = 2 * u - 1;
    let bulge = 8 * (1 - t * t);
    if (Math.abs(t) > 0.88) bulge -= (Math.abs(t) - 0.88) * 20; // recurved tips
    const cols = [bowLit, P.bowWood, P.bowDark];
    for (let k = 0; k < 3; k++) { const [x, y] = at(u, bulge + 1 - k); c.set(Math.round(x), Math.round(y), cols[k]); }
  }
  // Grip and leaf wraps.
  for (let u = 0.44; u <= 0.56; u += 0.004) for (let k = -1; k <= 3; k++) { const [x, y] = at(u, 8 + 1 - k); c.set(Math.round(x), Math.round(y), (u < 0.455 || u > 0.545) ? P.woodDark : P.wood); }
  for (const u of [0.24, 0.76]) { const t = 2 * u - 1, bulge = 8 * (1 - t * t); for (let k = 0; k < 2; k++) { const [x, y] = at(u + k * 0.01, bulge + 2); c.set(Math.round(x), Math.round(y), P.leaf); } }
  // The quiver, standing on the floor to the left: a leather tube with a strap band and a lighter rim,
  // three arrows sticking out with green fletching.
  for (let y = 26; y < 48; y++) for (let x = 3; x < 10; x++) c.set(x, y, x === 3 ? leatherLit : x === 9 ? leatherDark : leather);
  for (let x = 3; x < 10; x++) { c.set(x, 26, leatherLit); c.set(x, 33, leatherDark); c.set(x, 41, leatherDark); }
  for (const [x, top] of [[4, 17], [6, 15], [8, 18]]) {
    for (let y = top; y < 26; y++) c.set(x, y, P.bowWood);
    c.set(x - 1, top, P.leaf); c.set(x + 1, top, P.leaf); c.set(x - 1, top + 1, P.leaf); c.set(x + 1, top + 1, P.leaf); c.set(x, top - 1, P.leaf);
  }
  return c;
}

// A training dummy: a wooden post on a cross foot with a crossbar for arms, a stuffed burlap body and head tied
// with rope, straw poking out at the seams, and a few old sword cuts across the chest. F at it offers practice.
const burlap = hex("#8e6e40"), burlapLit = hex("#b08c56"), burlapDark = hex("#5e4628"), straw = hex("#d8b860"), strawDark = hex("#a8883c"), rope = hex("#3e2a18");
function dummy() {
  const c = canvas(30, 46);
  // Cross foot and post.
  rect(c, 6, 43, 24, 45, P.wood); rect(c, 6, 43, 24, 44, P.woodLit); rect(c, 4, 45, 26, 46, P.woodDark);
  rect(c, 14, 8, 17, 43, P.wood); rect(c, 14, 8, 15, 43, P.woodLit); rect(c, 16, 8, 17, 43, P.woodDark);
  // Crossbar arms, rope-bound at the ends, with straw tufts.
  rect(c, 2, 16, 28, 18, P.wood); rect(c, 2, 16, 28, 17, P.woodLit);
  for (const x0 of [3, 25]) { rect(c, x0, 15, x0 + 2, 19, burlap); c.set(x0, 15, burlapLit); c.set(x0 + 1, 18, rope); }
  c.set(1, 16, straw); c.set(0, 17, strawDark); c.set(28, 16, straw); c.set(29, 17, strawDark);
  // Body: a stuffed sack, rounded at the shoulders and hips, lit from the left.
  for (let y = 13; y < 35; y++) {
    const t = (y - 13) / 21, half = 6 - 2.2 * Math.pow(2 * t - 1, 4) * 1.4;
    for (let x = Math.round(15.5 - half); x <= Math.round(15.5 + half); x++) {
      const n = noise(x, y);
      c.set(x, y, x < 15.5 - half * 0.45 ? burlapLit : x > 15.5 + half * 0.6 ? burlapDark : n > 0.8 ? burlapDark : burlap);
    }
  }
  // Rope bindings at the chest and waist.
  for (const y of [19, 28]) for (let x = 9; x <= 22; x++) c.set(x, y, x % 3 ? rope : P.woodDark);
  // Old sword cuts: dark diagonal slashes with straw showing through.
  for (const [x0, y0, len] of [[11, 22, 6], [17, 21, 5], [12, 31, 4]]) for (let k = 0; k < len; k++) { c.set(x0 + k, y0 + Math.floor(k / 2), burlapDark); if (k % 2) c.set(x0 + k, y0 + Math.floor(k / 2) - 1, strawDark); }
  // Straw poking out under the hem.
  for (const [x, l] of [[10, 3], [12, 2], [14, 4], [17, 3], [19, 2], [21, 3]]) for (let k = 0; k < l; k++) c.set(x + (k === l - 1 ? 1 : 0), 35 + k, k ? strawDark : straw);
  // Head: a smaller sack tied at the neck, a stitched cross for a face.
  for (let y = 1; y < 12; y++) for (let x = 9; x < 22; x++) {
    const dx = (x - 15.5) / 5.5, dy = (y - 6.5) / 5.2;
    if (dx * dx + dy * dy > 1) continue;
    c.set(x, y, dx < -0.45 ? burlapLit : dx > 0.6 ? burlapDark : burlap);
  }
  rect(c, 12, 11, 20, 13, rope); c.set(11, 12, straw); c.set(20, 11, straw); // the neck tie, straw sticking out
  for (const [x, y] of [[13, 5], [14, 6], [13, 7], [15, 5]]) c.set(x, y, rope); // an X-stitch eye
  rect(c, 17, 6, 20, 7, rope); // a stitched slit for the other
  return c;
}

// ---- The construction gag: unfinished bosses' gates are taped off with a sign in front. -------------------------
const caution = hex("#e2b42c"), cautionLit = hex("#f4d258"), cautionDark = hex("#9c7618"), black = hex("#16120e");
const cone = hex("#e8661c"), coneLit = hex("#ff9a4a"), coneDark = hex("#a4400e"), white = hex("#ece6d8");
// A 3x5 pixel font, just the letters the gag needs.
const FONT = {
  A: ["010", "101", "111", "101", "101"], C: ["011", "100", "100", "100", "011"], D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"], I: ["111", "010", "010", "010", "111"], K: ["101", "110", "100", "110", "101"],
  N: ["101", "111", "111", "111", "101"], O: ["010", "101", "101", "101", "010"], P: ["110", "101", "110", "100", "100"],
  R: ["110", "101", "110", "101", "101"], S: ["011", "100", "010", "001", "110"], T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"], " ": ["000", "000", "000", "000", "000"]
};
const textWidth = s => s.length * 4 - 1;
const text = (c, s, x0, y0, col) => [...s].forEach((ch, k) => FONT[ch].forEach((row, y) => [...row].forEach((b, x) => { if (b === "1") c.set(x0 + k * 4 + x, y0 + y, col); })));

// A strip of tape from (x0, y0) to (x1, y1), sagging `sag` px in the middle, `w` px wide. Diagonal black and yellow
// stripes, or, with `label`, plain yellow with the label repeated along it in black. `back`: the tape's plain, duller
// back side (for a twisted, hanging end).
const tapeBack = hex("#b08c2c");
function tape(c, x0, y0, x1, y1, sag, w, label, back) {
  const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.ceil(len * 3);
  const at = t => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)];
  const unit = label ? label + "   " : "", unitW = unit.length * 4;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, [px, py] = at(t), [qx, qy] = at(Math.min(1, t + 0.01)), [rx, ry] = at(Math.max(0, t - 0.01));
    let dx = qx - rx, dy = qy - ry; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const s = t * len;
    for (let v = -(w - 1) / 2; v <= (w - 1) / 2; v += 0.5) {
      const x = px - dy * v, y = py + dx * v, edge = Math.abs(v) > (w - 1) / 2 - 0.6;
      let col;
      if (back) col = edge ? cautionDark : tapeBack;
      else if (label) {
        const col0 = (((Math.floor(s - len / 2 + textWidth(label) / 2) % unitW) + unitW) % unitW), // A copy centred on the strip.
          ch = unit[Math.floor(col0 / 4)], gx = col0 % 4, gy = Math.round(v + 2);
        // Only whole copies show: one cut by the strip's end is left blank.
        const k = Math.floor((s - len / 2 + textWidth(label) / 2) / unitW), start = len / 2 - textWidth(label) / 2 + k * unitW;
        const whole = start >= 1 && start + textWidth(label) <= len - 1;
        const on = whole && ch && gx < 3 && gy >= 0 && gy < 5 && FONT[ch][gy][gx] === "1";
        col = on ? black : edge ? (v < 0 ? cautionLit : cautionDark) : caution;
      } else col = edge ? (v < 0 ? cautionLit : cautionDark) : Math.floor((s + v * 1.2) / 3) % 2 ? black : caution; // Yellow edges keep it readable on dark stone.
      c.set(Math.round(x), Math.round(y), col);
    }
  }
}
const tack = (c, x, y) => { c.set(x, y, P.ironLit); c.set(x + 1, y, P.iron); c.set(x, y + 1, P.iron); };

// The sign: a yellow board reading UNDER / CONSTRUCTION, a striped band at its foot, on a wooden A-frame.
function constructionSign() {
  const c = canvas(55, 37), W = 55;
  // Legs first (the board covers their tops): splayed, with a crossbar.
  for (const [xa, xb] of [[9, 5], [45, 49]]) for (let y = 14; y < 37; y++) {
    const x = Math.round(xa + (xb - xa) * (y - 14) / 22);
    c.set(x, y, P.woodLit); c.set(x + 1, y, P.wood); c.set(x + 2, y, P.woodDark);
  }
  rect(c, 8, 28, 48, 30, P.wood); rect(c, 8, 28, 48, 29, P.woodLit);
  // Board, black rim, lit top edge.
  rect(c, 0, 0, W, 23, black); rect(c, 1, 1, W - 1, 22, caution); rect(c, 1, 1, W - 1, 2, cautionLit); rect(c, 1, 21, W - 1, 22, cautionDark);
  text(c, "UNDER", Math.round((W - textWidth("UNDER")) / 2), 3, black);
  text(c, "CONSTRUCTION", Math.round((W - textWidth("CONSTRUCTION")) / 2), 10, black);
  // Hazard band.
  for (let y = 16; y < 21; y++) for (let x = 2; x < W - 2; x++) c.set(x, y, Math.floor((x + y) / 3) % 2 ? black : caution);
  // Wear: a chipped corner, scuffs and a rust streak under a bolt.
  c.clear(W - 1, 0); c.clear(W - 2, 0); c.clear(W - 1, 1); c.set(W - 2, 1, black);
  for (const [x, y] of [[6, 2], [40, 3], [27, 8], [14, 15]]) c.set(x, y, cautionDark);
  tack(c, 3, 3); tack(c, W - 5, 3); c.set(W - 5, 5, cautionDark); c.set(W - 5, 6, cautionDark);
  return c;
}

// Tape taped across a doorway: two striped strips in an X and a KEEP OUT strip across the middle, tacked at the ends,
// one end come loose and hanging. Sized for the Fire Knight's gate opening (1x 44-86 x 40-110 in its 128px frame).
function tapeX() {
  const c = canvas(56, 74);
  tape(c, 2, 3, 53, 57, 3, 5);
  // The other diagonal has torn off its lower tack: it runs down from the top right, then drops and hangs, twisting
  // to show its duller back, and curls up at the very end. A scrap of it is still stuck under the empty tack.
  tape(c, 53, 4, 19, 40, 2, 5);
  tape(c, 19, 40, 15, 50, 0, 5);
  tape(c, 15, 50, 14, 56, 0, 3, "", true); // Edge-on as it twists.
  tape(c, 14, 56, 14, 63, 0, 5, "", true); // Back side out.
  tape(c, 14, 63, 16, 68, 0, 3, "", true);
  tape(c, 16, 68, 18, 71, 0, 4);           // Front again, curling.
  c.set(19, 70, cautionDark); c.set(19, 69, caution);
  for (const [x, y] of [[2, 56], [3, 56], [3, 57], [4, 57]]) c.set(x, y, caution); // The torn scrap.
  c.set(2, 57, cautionDark);
  tape(c, 0, 24, 55, 25, 2, 7, "KEEP OUT");
  for (const [x, y] of [[1, 2], [52, 3], [52, 56], [0, 23], [54, 25], [3, 57]]) tack(c, x, y);
  return c;
}

// KEEP OUT tape strung between two traffic cones, for a gate with no frame to tape to (the Gunslinger's glow gate).
function tapeCones() {
  const W = 124, H = 34, c = canvas(W, H);
  const coneAt = x0 => {
    for (let y = 0; y < 22; y++) {
      const half = 1 + y * 0.28, cx = x0 + 6;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const band = y >= 8 && y < 11 || y >= 15 && y < 17;
        c.set(x, H - 25 + y, band ? white : x < cx - half * 0.4 ? coneLit : x > cx + half * 0.5 ? coneDark : cone);
      }
    }
    rect(c, x0 - 1, H - 3, x0 + 14, H, black); rect(c, x0 - 1, H - 3, x0 + 14, H - 2, hex("#2e2a26"));
  };
  coneAt(2); coneAt(W - 16);
  tape(c, 8, H - 24, W - 9, H - 24, 3, 7, "KEEP OUT");
  return c;
}

// A soft, slanted beam of moonlight: brightest at the top, fading towards the floor and at its edges.
function godRay() {
  const w = 160, h = 560, c = canvas(w, h);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1), cx = 40 + t * 70, half = 18 + t * 32;
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x - cx) / half; if (d >= 1) continue;
      c.set(x, y, [255, 255, 255, Math.pow(1 - d, 1.5) * Math.pow(1 - t, 1.2) * Math.min(1, t * 8)]);
    }
  }
  return c;
}

require("fs").mkdirSync(OUT, { recursive: true });
savePng(bench(), path.join(OUT, "bench.png"));
savePng(keeper(0), path.join(OUT, "keeper_1.png"));
savePng(keeper(1), path.join(OUT, "keeper_2.png"));
savePng(lectern(), path.join(OUT, "lectern.png"));
savePng(pew(), path.join(OUT, "pew.png"));
savePng(rug(), path.join(OUT, "rug.png"));
savePng(candles(), path.join(OUT, "candles.png"));
savePng(plinth(), path.join(OUT, "plinth.png"));
savePng(swordStand(), path.join(OUT, "sword_stand.png"));
savePng(relicKatana(), path.join(OUT, "relic_katana.png"));
savePng(relicBow(), path.join(OUT, "relic_bow.png"));
savePng(dummy(), path.join(OUT, "dummy.png"));
savePng(constructionSign(), path.join(OUT, "construction_sign.png"));
savePng(tapeX(), path.join(OUT, "construction_tape_x.png"));
savePng(tapeCones(), path.join(OUT, "construction_tape_cones.png"));
savePng(godRay(), path.join(OUT, "god_ray.png"), 1);
