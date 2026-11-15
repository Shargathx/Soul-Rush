// Draws small HUD icons as pixel art (1x, saved at 2x), in the style of the curse drop (assets/Bars/Curse_Icon.png,
// 36x32): a soft-shaded shape with a dark outline and a bright highlight.
//   desperation_icon.png - Desperation, the curse's silver lining: each curse stack widens the deflect window a little.
//                          A pale steel blade, point up, with a glint at its edge, so it reads as "your deflect", in
//                          cool colours set against the red curse drop.
// Usage: node tools/fx/ui_icons.js
const path = require("path");
const { canvas, savePng, hex } = require("../hub/pixel.js");
const OUT = path.join(__dirname, "..", "..", "assets", "Bars");

function desperation() {
  const c = canvas(18, 16);
  const outline = hex("#14171f"), steelDark = hex("#5f7488"), steel = hex("#a9c1d4"), steelLit = hex("#e6f3ff");
  const guard = hex("#6d5a3a"), guardLit = hex("#a88a52"), grip = hex("#3a2c22"), glint = hex("#ffffff"), aura = hex("#7fd6e6");
  // Blade: a narrow diagonal from the lower left up to the point at the upper right, two pixels wide.
  const blade = [[5, 11], [6, 10], [7, 9], [8, 8], [9, 7], [10, 6], [11, 5], [12, 4], [13, 3], [14, 2]];
  for (const [x, y] of blade) { c.set(x - 1, y + 1, outline); c.set(x + 1, y - 1, outline); c.set(x + 1, y + 1, outline); }
  for (const [x, y] of blade) { c.set(x, y, steel); c.set(x + 1, y, steelDark); c.set(x, y - 1, steelLit); }
  c.set(15, 1, outline); c.set(15, 2, outline); c.set(14, 1, steelLit);
  // Guard across the blade, and the grip and pommel below it.
  for (const [x, y] of [[3, 10], [4, 11], [5, 12], [6, 13]]) { c.set(x - 1, y, outline); c.set(x, y, guardLit); c.set(x + 1, y, guard); }
  c.set(2, 9, outline); c.set(7, 14, outline);
  for (const [x, y] of [[3, 13], [2, 14]]) { c.set(x, y, grip); c.set(x - 1, y, outline); c.set(x, y + 1, outline); }
  c.set(1, 15, guardLit);
  // Glint: a small four-point star near the edge, with a faint aura round it.
  for (const [x, y] of [[11, 2], [9, 4], [13, 4], [11, 6]]) c.blend(x, y, aura, 0.55);
  for (const [x, y] of [[11, 3], [10, 4], [12, 4], [11, 5]]) c.set(x, y, steelLit);
  c.set(11, 4, glint);
  return c;
}

savePng(desperation(), path.join(OUT, "desperation_icon.png"));
