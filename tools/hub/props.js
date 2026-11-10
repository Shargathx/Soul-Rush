// Draws the hub's furniture and trophies as pixel art (1x, saved at 2x):
// bench, keeper (2 breathing frames), lectern, pew, rug, candles, plinth, sword_stand, relic_katana, relic_bow,
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
  for (let x = 15; x < 56; x++) {
    const lift = x > 50 ? 1 : 0; // the tip rises, the katana's curve
    c.set(x, 2 - lift, P.steel); c.set(x, 3 - lift, P.steelDark);
  }
  c.set(55, 2, P.steel);
  return c;
}

// The Leaf Ranger's longbow, standing upright on the plinth: a thick curved stave with recurved tips, a leather grip
// and leaf wraps, its string drawn straight.
const bowLit = hex("#9a6e3e");
function relicBow() {
  const c = canvas(20, 50), top = 1, bottom = 48, mid = (top + bottom) / 2, STRING = 15;
  for (let y = top; y <= bottom; y++) {
    const t = (y - mid) / (mid - top);                         // -1 at the top, 1 at the bottom
    let x = Math.round(2 + 9 * (t * t));                        // the stave bows out to the left of the string
    if (Math.abs(t) > 0.9) x += Math.round((Math.abs(t) - 0.9) * 30); // recurved tips turning back toward the string
    c.set(x, y, bowLit); c.set(x + 1, y, P.bowWood); c.set(x + 2, y, P.bowDark);
  }
  for (let y = top + 2; y < bottom - 1; y++) c.set(STRING, y, P.string); // the string, tied at the tips
  c.set(STRING - 1, top + 1, P.string); c.set(STRING - 1, bottom - 1, P.string);
  const m = Math.round(mid);
  rect(c, 2, m - 4, 6, m + 5, P.wood); rect(c, 2, m - 4, 3, m + 5, P.woodLit); // grip
  for (const y of [m - 4, m + 4]) rect(c, 2, y, 6, y + 1, P.woodDark);
  for (const y of [11, 37]) { const t = (y - mid) / (mid - top), x = Math.round(2 + 9 * t * t); c.set(x, y, P.leaf); c.set(x + 1, y, P.leaf); c.set(x + 1, y + 1, P.leaf); }
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
savePng(godRay(), path.join(OUT, "god_ray.png"), 1);
