// Deflect sparks: a burst of hot metal sparks thrown off the sword point when a deflect lands.
// Pixel art drawn at 1x on a SIZE x SIZE canvas and saved at 2x (the project's scale for new art), so the
// Deflect_Spark object is used at scale 1. The burst's centre (the blade point) is the image centre: origin SIZE/2*2.
//
//   node tools/fx/sparks.js            -> every variant in VARIANTS
//   node tools/fx/sparks.js A          -> just variant A
//
// Each variant is the same simulation with its own seed and settings (VARIANTS), so new ones are cheap:
// add an entry and rerun. Frames go to assets/Player/Deflect/Deflect_Sparks_<id><n>.png, and each variant is one
// animation on Deflect_Spark (Spark, Spark_B, Spark_C...); the deflect events pick one at random.
//
// The look: frame 1 is a white-hot impact star; then streaks fly out (mostly upward and sideways, like sparks
// skating off a blade), slowing with drag and arcing down with gravity, cooling white -> yellow -> orange -> red,
// and the last few frames leave a handful of fading embers.
const path = require("path");
const { canvas, savePng } = require("../hub/pixel.js");

const SIZE = 80;           // Canvas, in art pixels (saved at 2x: 160x160).
const FRAMES = 9;          // At FRAME_TIME seconds each in GDevelop.
const FRAME_TIME = 0.04;   // Matches the old flash's speed.
const OUT = path.join(__dirname, "../../assets/Player/Deflect");

// Settings per variant; anything left out uses DEFAULTS (which are variant A).
//   count: sparks. low: share thrown out low and sideways (within lowSpread radians of level).
//   fan: width in radians of the upward fan, centred straight up. speed: [min, extra random].
//   life: [min, extra random] share of the animation a spark lives. trail: streak length in seconds of path.
//   star: impact star arm length per frame (frames after the list have none). fat: share of 2-pixel-wide sparks.
//   glow: the light the clash throws around it, per frame [radius in art px, strength 0-1]; frames after the list have
//   none. Drawn under the sparks as a warm halo in a few stepped bands (pixel-art, not a smooth blur). The game draws
//   Deflect_Spark additively, so the halo brightens whatever is behind it, like real light.
const GLOW = [[20, 0.55], [26, 0.45], [30, 0.33], [32, 0.22], [33, 0.13], [33, 0.07], [32, 0.03]];
const DEFAULTS = { count: 22, low: 0.2, lowSpread: 0.7, fan: 2.9, speed: [120, 120], life: [0.55, 0.45], trail: 0.055,
  star: [10, 6, 2], fat: 0.3, glow: GLOW };
const VARIANTS = {
  A: { seed: 7 },                    // The all-round burst: up and out to both sides.
  B: { seed: 21, count: 14, low: 0.6, lowSpread: 0.9, fan: 2.4, speed: [170, 110], trail: 0.08, star: [8, 4], fat: 0.45 },
  // B, the glancing scrape: fewer, longer streaks, most thrown out sideways.
  C: { seed: 33, count: 30, low: 0.1, fan: 1.5, speed: [110, 100], life: [0.5, 0.4], trail: 0.04, star: [11, 7, 3], fat: 0.2 },
  // C, the fountain: a dense, tight spray straight up that rains back down.
};

// Colours as the spark cools (0 = just struck, 1 = dying).
const HOT = [
  [0.00, [255, 255, 255]],
  [0.18, [255, 246, 190]],
  [0.40, [255, 214, 96]],
  [0.65, [255, 140, 40]],
  [0.85, [214, 72, 24]],
  [1.00, [140, 36, 20]],
];
const heat = k => {
  k = Math.max(0, Math.min(1, k));
  for (let i = 1; i < HOT.length; i++) if (k <= HOT[i][0]) {
    const [k0, c0] = HOT[i - 1], [k1, c1] = HOT[i], t = (k - k0) / (k1 - k0);
    return c0.map((v, j) => Math.round(v + (c1[j] - v) * t));
  }
  return HOT[HOT.length - 1][1];
};

function rng(seed) { // mulberry32
  return function () { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// A crisp pixel line (no anti-aliasing); col(k) gives the colour along it, k = 0 at the tail, 1 at the head.
function line(c, x0, y0, x1, y1, col, alpha) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const k = i / n, x = Math.round(x0 + (x1 - x0) * k), y = Math.round(y0 + (y1 - y0) * k);
    if (x < 0 || y < 0 || x >= c.w || y >= c.h) continue;
    c.blend(x, y, col(k), alpha);
  }
}

function make(id, variant) {
  const opt = Object.assign({}, DEFAULTS, variant);
  const r = rng(opt.seed), cx = SIZE / 2, cy = SIZE / 2;
  const G = 320, DRAG = 3.4, LIFE = FRAMES * FRAME_TIME;
  // The sparks: a fan thrown mostly upward and out to both sides (the burst is not flipped with the player),
  // plus a few that skitter low.
  const sparks = [];
  for (let i = 0; i < opt.count; i++) {
    const low = r() < opt.low;
    const ang = low ? (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * opt.lowSpread : -Math.PI / 2 + (r() - 0.5) * opt.fan;
    const speed = opt.speed[0] + r() * opt.speed[1];
    sparks.push({ vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: LIFE * (opt.life[0] + r() * opt.life[1]), born: r() * 0.03, fat: r() < opt.fat });
  }
  // Position after t seconds: drag slows it, gravity pulls it down.
  const at = (s, t) => {
    const e = (1 - Math.exp(-DRAG * t)) / DRAG;
    return [cx + s.vx * e, cy + s.vy * e + 0.5 * G * t * t];
  };
  for (let f = 0; f < FRAMES; f++) {
    const c = canvas(SIZE, SIZE), T = (f + 1) * FRAME_TIME;
    // The glow: a warm halo around the impact, in 5 stepped bands, fading over the first frames.
    const g = opt.glow[f];
    if (g) {
      const [R, k] = g;
      for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / R;
        if (d >= 1) continue;
        const band = Math.ceil((1 - d) * 5) / 5;                      // 0.2, 0.4 ... 1: stepped, not smooth.
        c.blend(x, y, heat(0.45 + 0.3 * d), k * band * band);         // Yellow-white near the core, orange outside.
      }
    }
    // The impact star: big on frame 1, a small glint on frame 2, gone after.
    const star = opt.star[f] || 0;
    if (star) {
      for (let k = -star; k <= star; k++) {
        const fade = 1 - Math.abs(k) / (star + 1);
        const col = heat(0.25 * (1 - fade));
        c.blend(cx + k, cy, col, 0.4 + 0.6 * fade); c.blend(cx, cy + k, col, 0.4 + 0.6 * fade);
        if (Math.abs(k) <= star / 2) { c.blend(cx + k, cy + k, col, 0.7 * fade); c.blend(cx + k, cy - k, col, 0.7 * fade); }
      }
      if (f === 0) c.rect(cx - 1, cy - 1, cx + 2, cy + 2, [255, 255, 255], 1);
    }
    for (const s of sparks) {
      const t = T - s.born;
      if (t <= 0 || t > s.life) continue;
      const age = t / s.life;
      const head = at(s, t), tail = at(s, Math.max(0, t - opt.trail)); // The streak is the last `trail` seconds of its path.
      const col = k => heat(age * age * 0.9 + (1 - k) * 0.3);
      const alpha = age < 0.75 ? 1 : 1 - (age - 0.75) / 0.25 * 0.6;
      line(c, tail[0], tail[1], head[0], head[1], col, alpha);
      if (s.fat && age < 0.6) line(c, tail[0] + 1, tail[1], head[0] + 1, head[1], col, alpha * 0.6);
    }
    savePng(c, path.join(OUT, "Deflect_Sparks_" + id + (f + 1) + ".png"), 2);
  }
}

const pick = process.argv[2];
for (const id of Object.keys(VARIANTS)) if (!pick || pick === id) make(id, VARIANTS[id]);
