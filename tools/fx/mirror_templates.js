// Mirror image templates for the Samurai's phase 3: a review sheet of the looks (A Hologram, B Echo, D Spirit Echo, C Spirit).
// Nothing here is in the game. Run: node tools/fx/mirror_templates.js [outDir]
const fs = require("fs");
const path = require("path");
const { ROOT, readPng, writePng, blank, over, LOOKS } = require("./mirror_look.js");
const OUT = process.argv[2] || __dirname;
const FRAMES = [0, 3, 6]; // Idle frames shown (NewSprite14 + n).
const SCALE = 3;

// ---- Sheet: the real Samurai on top, then each look, three idle frames each, on the dark arena colour and a lighter one --
const load = n => readPng(path.join(ROOT, "assets", "Enemies", "Samurai", "NewSprite" + (14 + n) + ".png"));
const frames = FRAMES.map(load), cell = frames[0].w;
const rows = [["Samurai (real)", s => s], ...Object.entries(LOOKS)];
const bgs = [[26, 22, 34], [92, 120, 96]]; // night arena, forest green
const sheet = blank(cell * FRAMES.length * bgs.length, cell * rows.length);
for (let i = 0; i < sheet.w * sheet.h; i++) sheet.px[i * 4 + 3] = 1;
rows.forEach(([name, fn], r) => bgs.forEach((bg, b) => frames.forEach((f, c) => {
  const x0 = (b * FRAMES.length + c) * cell, y0 = r * cell;
  for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) { const o = ((y0 + y) * sheet.w + x0 + x) * 4; sheet.px[o] = bg[0]; sheet.px[o + 1] = bg[1]; sheet.px[o + 2] = bg[2]; }
  const lit = fn(f), placed = over({ w: sheet.w, h: sheet.h, px: sheet.px }, lit, x0, y0);
  sheet.px.set(placed.px);
})));
writePng(sheet, path.join(OUT, "mirror_templates.png"), SCALE);
// And each look on its own, one frame, for closer inspection.
Object.entries(LOOKS).forEach(([name, fn]) => writePng(fn(frames[0]), path.join(OUT, "mirror_" + name[0] + ".png"), 6));
console.log("written to", OUT, "rows:", rows.map(r => r[0]).join(" | "));

// ---- Zoomed comparison: the figure only, frame 0, each look beside the real Samurai, 8x, on the night colour -------------------
{
  let x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
  for (const f of frames) for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.px[(y * f.w + x) * 4 + 3] > 0.2) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 = Math.max(0, x0 - 6); y0 = Math.max(0, y0 - 4); x1 = Math.min(cell - 1, x1 + 6); y1 = Math.min(cell - 1, y1 + 4);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, zoom = blank(cw * rows.length, ch);
  for (let i = 0; i < zoom.w * zoom.h; i++) { zoom.px[i * 4] = bgs[0][0]; zoom.px[i * 4 + 1] = bgs[0][1]; zoom.px[i * 4 + 2] = bgs[0][2]; zoom.px[i * 4 + 3] = 1; }
  rows.forEach(([name, fn], r) => {
    const lit = fn(frames[0]);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const si = ((y0 + y) * cell + x0 + x) * 4, a = lit.px[si + 3], o = (y * zoom.w + r * cw + x) * 4;
      for (let j = 0; j < 3; j++) zoom.px[o + j] = lit.px[si + j] * a + zoom.px[o + j] * (1 - a); }
  });
  writePng(zoom, path.join(OUT, "mirror_zoom.png"), 8);
}
