// The Leaf Ranger's entangle vines (a Ranger_Trap with Vine = 1): idle frames of three vines writhing out of the ground
// like snakes. 32x24 per frame like the snare art (the game draws them at 2x), the ground at the bottom row, a loop of 8.
// Run: node tools/fx/vine.js   Writes assets/Enemies/Leaf_Ranger/fx/vine/Ranger_Vine_1..8.png (register them in the project).
const path = require("path");
const fs = require("fs");
const { canvas, savePng, hex } = require("../hub/pixel.js");
const OUT = path.join(__dirname, "..", "..", "assets", "Enemies", "Leaf_Ranger", "fx", "vine");
fs.mkdirSync(OUT, { recursive: true });
const W = 32, H = 24, FRAMES = 8;
const DARK = hex("#1d3b1f"), MID = hex("#3f7a35"), LIGHT = hex("#7bc05a"), TIP = hex("#c4e88a"), THORN = hex("#5f2c36");
// Three vines: where they come out, how tall, how much they snake, and their own rhythm.
const VINES = [{ x: 8, h: 13, amp: 2.2, off: 0 }, { x: 16, h: 17, amp: 2.8, off: 2.1 }, { x: 24, h: 12, amp: 2.0, off: 4.2 }];
for (let k = 0; k < FRAMES; k++) {
  const c = canvas(W, H), t = (k / FRAMES) * Math.PI * 2;
  // A dark root mat on the ground, so the vines grow out of something.
  for (let x = 3; x < 29; x++) { c.set(x, 23, DARK); if (x > 5 && x < 27) c.set(x, 22, MID); }
  for (const v of VINES) {
    const pts = [];
    for (let s = 0; s <= v.h; s++) {
      const y = 22 - s, a = v.amp * Math.min(1, s / 5); // The base is still, the tip swings most.
      pts.push([v.x + a * Math.sin(t * 1 + v.off + s * 0.55), y]);
    }
    // Outline, body, highlight, then the tip curling a little.
    for (const [x, y] of pts) { c.set(x - 1, y, DARK); c.set(x + 2, y, DARK); }
    for (const [x, y] of pts) { c.set(x, y, MID); c.set(x + 1, y, MID); }
    pts.forEach(([x, y], i) => { if (i % 2 === 0) c.set(x, y, LIGHT); });
    const [tx, ty] = pts[pts.length - 1], curl = Math.sign(Math.sin(t + v.off)) || 1;
    c.set(tx + curl, ty - 1, TIP); c.set(tx + curl * 2, ty - 1, LIGHT); c.set(tx, ty - 1, TIP);
    // A thorn or two, on the side the vine is leaning away from.
    for (const s of [4, 8]) if (s < v.h - 1) { const [x, y] = pts[s]; c.set(x + (s % 8 === 0 ? 3 : -2), y, THORN); }
  }
  savePng(c, path.join(OUT, "Ranger_Vine_" + (k + 1) + ".png"), 1);
}
