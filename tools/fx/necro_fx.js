// The Necromancer's spell effects, drawn from scratch as pixel art at the Necromancer's own pixel size (the game draws
// them at 3x, like him). Most are drawn in pale greys and whites so the events can tint them per phase (ChangeColor:
// sickly green in phase 1, blood red in phase 2); the skull and the hitbox keep their own colours.
// Run: node tools/fx/necro_fx.js   Writes assets/Enemies/Necromancer/fx/... (register new files in the project).
//
//   sigil/Necro_Sigil_1..6.png   40x8   a flat rune ring on the ground that pulses: the warning before rain and eruptions
//   pillar/Necro_Pillar_1..8.png 20x56  a column of soul fire bursting out of the ground (the eruption), feet at the bottom
//   nova/Necro_Nova_1..6.png     112x64 a flattened ring of force swelling out from his feet (the nova)
//   skull/Necro_Skull_1..2.png   12x12  a flying skull with a flickering trail (phase 2 skull swarm), facing left
//   spark/Necro_Spark_1..4.png   16x16  a small burst where a bolt lands or is turned back
//   hitbox/Necro_Hitbox.png      8x8    the invisible attack box (drawn at opacity 0 in the game)
const path = require("path");
const fs = require("fs");
const { canvas, savePng } = require("../hub/pixel.js");
const ROOT = path.join(__dirname, "..", "..", "assets", "Enemies", "Necromancer", "fx");
const out = (dir, name) => { const d = path.join(ROOT, dir); fs.mkdirSync(d, { recursive: true }); return path.join(d, name); };

// A deterministic noise, so every run writes the same files.
let seed = 31;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const WHITE = [255, 255, 255], PALE = [222, 226, 230], MIDG = [168, 174, 182], DIMG = [110, 116, 126], CORE = [255, 255, 255];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- Sigil: an ellipse of runes, brighter in the middle of the loop ------------------------------------------
{
  const W = 40, H = 8, N = 6;
  for (let k = 0; k < N; k++) {
    const c = canvas(W, H), pulse = 0.55 + 0.45 * Math.sin((k / N) * Math.PI * 2);
    const cx = (W - 1) / 2, cy = (H - 1) / 2, rx = 18.5, ry = 3.2;
    // Soft glow inside the ring.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d < 1) c.blend(x, y, MIDG, (1 - d) * 0.35 * pulse);
    }
    // The ring: an outline with gaps, the gaps turning as the loop runs, so it reads as runes crawling round.
    for (let a = 0; a < 360; a += 3) {
      const r = a * Math.PI / 180, x = cx + Math.cos(r) * rx, y = cy + Math.sin(r) * ry;
      const gap = Math.floor((a + k * 15) / 30) % 4 === 3;
      if (!gap) c.blend(x, y, PALE, 0.65 + 0.35 * pulse);
    }
    // Rune ticks on the front edge.
    for (let i = 0; i < 6; i++) {
      const x = Math.round(6 + i * 5.6 + (k % 2)), y = H - 2;
      c.blend(x, y - 1, WHITE, 0.8 * pulse); c.blend(x, y, PALE, 0.6 * pulse);
    }
    savePng(c, out("sigil", "Necro_Sigil_" + (k + 1) + ".png"), 1);
  }
}

// ---- Pillar: crack, burst, full column, fade ---------------------------------------------------------------------
{
  const W = 20, H = 56, N = 8;
  const heights = [3, 6, 30, 52, 56, 56, 46, 30], widths = [8, 10, 7, 9, 10, 9, 7, 5], alphas = [0.7, 0.85, 1, 1, 1, 0.95, 0.7, 0.4];
  for (let k = 0; k < N; k++) {
    const c = canvas(W, H), h = heights[k], w = widths[k], A = alphas[k], cx = (W - 1) / 2;
    for (let y = H - 1; y >= H - h; y--) {
      const t = (H - 1 - y) / Math.max(1, h); // 0 at the ground, 1 at the tip
      const wob = Math.sin(y * 0.55 + k * 1.7) * 1.2 * t;
      const half = Math.max(0.6, (w / 2) * (1 - t * 0.55));
      for (let x = 0; x < W; x++) {
        const d = Math.abs(x - cx - wob) / half;
        if (d > 1.35) continue;
        const col = d < 0.35 ? CORE : d < 0.75 ? PALE : d < 1.05 ? MIDG : DIMG;
        const fade = t > 0.8 ? (1 - t) / 0.2 : 1;
        c.blend(x, y, col, A * clamp(1.25 - d * 0.6, 0, 1) * fade);
      }
    }
    // Wisps rising off the column once it is up.
    if (k >= 3) for (let i = 0; i < 6; i++) {
      const x = cx + (rnd() - 0.5) * 12, y = H - h * (0.3 + rnd() * 0.7) - (k - 3) * 2;
      c.blend(x, y, PALE, 0.7 * A); c.blend(x, y - 1, MIDG, 0.5 * A);
    }
    // The ground crack it comes out of.
    for (let x = 1; x < W - 1; x++) if (Math.abs(x - cx) < 4 + k * 0.6) c.blend(x, H - 1, k < 2 ? PALE : MIDG, A * 0.9);
    savePng(c, out("pillar", "Necro_Pillar_" + (k + 1) + ".png"), 1);
  }
}

// ---- Nova: a ring swelling out from the feet ------------------------------------------------------------------------
{
  const W = 112, H = 64, N = 6, cx = (W - 1) / 2, cy = H - 14;
  for (let k = 0; k < N; k++) {
    const c = canvas(W, H), t = (k + 1) / N, rx = 10 + t * 44, ry = 4 + t * 16, thick = 3.2 - t * 1.6, A = k < 4 ? 1 : 1 - (k - 3) * 0.3;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      const edge = Math.abs(d - 1) * Math.min(rx, ry);
      if (edge < thick) c.blend(x, y, edge < thick * 0.4 ? CORE : PALE, A * (1 - edge / thick));
      else if (d < 1) c.blend(x, y, MIDG, A * 0.18 * (1 - t));
    }
    // A few shards thrown out ahead of the ring.
    for (let i = 0; i < 10; i++) {
      const a = rnd() * Math.PI * 2, r = 1.05 + rnd() * 0.15;
      c.blend(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, WHITE, A * 0.8);
    }
    savePng(c, out("nova", "Necro_Nova_" + (k + 1) + ".png"), 1);
  }
}

// ---- Skull: bone white with red eyes, a trail behind it (it flies left; the events flip it) --------------------------
{
  const W = 12, H = 12, BONE = [232, 222, 200], SHADE = [168, 150, 128], DARK = [40, 20, 24], EYE = [255, 60, 60], TRAIL = [200, 40, 50];
  const SHAPE = [
    "....####....",
    "...######...",
    "..########..",
    "..##EE#EE#..",
    "..##EE#EE#..",
    "..########..",
    "...#####s...",
    "...#.#.#....",
  ];
  for (let k = 0; k < 2; k++) {
    const c = canvas(W, H);
    // Trail to the right (behind a skull flying left).
    for (let i = 0; i < 4; i++) for (let y = 3; y < 8; y++) {
      const x = 9 + i, a = (0.6 - i * 0.14) * (((y + k + i) % 2) ? 1 : 0.55);
      if (x < W) c.blend(x, y + (i % 2 ? 0 : (k ? 1 : -1)) * 0, TRAIL, a);
    }
    SHAPE.forEach((row, y) => [...row].forEach((ch, x) => {
      const yy = y + 2 + (k ? 1 : 0) * 0;
      if (ch === "#") c.set(x - 1, yy, y < 2 ? BONE : x < 4 ? SHADE : BONE);
      else if (ch === "E") c.set(x - 1, yy, k ? EYE : [200, 30, 40]);
      else if (ch === "s") c.set(x - 1, yy, SHADE);
    }));
    // Dark nose and outline under the jaw.
    c.set(4, 7, DARK); c.set(5, 7, DARK);
    savePng(c, out("skull", "Necro_Skull_" + (k + 1) + ".png"), 1);
  }
}

// ---- Spark: a small burst -------------------------------------------------------------------------------------------
{
  const W = 16, H = 16, N = 4, cx = 7.5, cy = 7.5;
  for (let k = 0; k < N; k++) {
    const c = canvas(W, H), r = 1.5 + k * 2, A = 1 - k * 0.22;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + k * 0.2;
      for (let s = 0; s < 3; s++) c.blend(cx + Math.cos(a) * (r + s), cy + Math.sin(a) * (r + s), s ? PALE : CORE, A * (1 - s * 0.3));
    }
    if (k < 2) for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 4 - k * 2) c.blend(cx + x, cy + y, CORE, A);
    savePng(c, out("spark", "Necro_Spark_" + (k + 1) + ".png"), 1);
  }
}

// ---- Hitbox: a plain red box, like the other bosses' (only seen in the debug view) ------------------------------------
{
  const c = canvas(8, 8);
  c.rect(0, 0, 8, 8, [220, 40, 40], 0.6);
  savePng(c, out("hitbox", "Necro_Hitbox.png"), 1);
}
