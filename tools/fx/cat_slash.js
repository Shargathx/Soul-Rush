// The Cat's claw slashes: three tapering red streaks with a white-hot core, a glow, blood flecks and embers (the reference is a
// three-claw swipe from a souls-like). Drawn in code, no source art: an RGBA frame set per slash kind, used by tools/bosses/cat.def.js.
//
//   node tools/fx/cat_slash.js          writes a preview GIF to docs/previews/cat_slash.gif (dark background, all frames in a row)
//
// Kinds: "Horizontal", "Vertical", "Diagonal", and two crossed ones: "CrossX" (two diagonals) and "CrossPlus" (a horizontal and a vertical). A frame set is FRAMES images of W x H pixels; the slash is drawn
// for a cat facing right, and the game flips it about its centre (so the origin is the image centre) for a cat facing left.
const path = require("path");
const fs = require("fs");
const png = require("../bosses/png.js");

const W = 160, H = 120, SS = 4, FRAMES = 8, DT = 0.03;   // SS: supersampling for smooth edges

// A small seeded random generator: the same flecks every build.
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const cubic = (p, t) => { const u = 1 - t; return [u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0], u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]]; };

// Each kind is a list of claws: a cubic bezier (control points in image pixels) and how thick it is.
const KINDS = {
  Horizontal: [
    { p: [[10, 34], [62, 26], [118, 30], [150, 8]], w: 4.6, len: 0.94 },
    { p: [[6, 62], [60, 54], [122, 58], [156, 34]], w: 5.8, len: 1.0 },
    { p: [[12, 90], [64, 82], [114, 86], [146, 64]], w: 4.4, len: 0.9 }
  ],
  // Vertical: three claws coming straight down, hooking forward (to the right) at the bottom.
  Vertical: [
    { p: [[40, 6], [36, 40], [38, 78], [56, 112]], w: 4.4, len: 0.9 },
    { p: [[80, 4], [76, 40], [78, 80], [98, 116]], w: 5.6, len: 1.0 },
    { p: [[120, 8], [116, 42], [118, 78], [138, 108]], w: 4.4, len: 0.92 }
  ],
  // Diagonal (mixed): three claws from high on the cat's side down to low in front, curving a little.
  Diagonal: [
    { p: [[14, 8], [50, 22], [92, 52], [138, 80]], w: 4.4, len: 0.92 },
    { p: [[40, 4], [80, 20], [120, 52], [156, 88]], w: 5.6, len: 1.0 },
    { p: [[8, 44], [40, 56], [74, 82], [112, 108]], w: 4.4, len: 0.9 }
  ],
  // CrossX: two diagonal strokes (two claws each) crossing in an X; the second stroke follows the first.
  CrossX: [
    { p: [[16, 8], [54, 26], [96, 54], [140, 88]], w: 5, len: 0.94 },
    { p: [[34, 4], [70, 20], [110, 48], [152, 78]], w: 4.4, len: 0.9 },
    { p: [[144, 8], [106, 26], [64, 54], [20, 88]], w: 5, len: 0.94, start: 0.3 },
    { p: [[126, 4], [90, 20], [50, 48], [8, 78]], w: 4.4, len: 0.9, start: 0.3 }
  ],
  // CrossPlus: a horizontal stroke and a vertical one crossing in a plus (two claws each); the vertical follows.
  CrossPlus: [
    { p: [[8, 46], [60, 40], [112, 44], [152, 30]], w: 5, len: 0.94 },
    { p: [[10, 74], [62, 68], [114, 72], [148, 58]], w: 4.4, len: 0.9 },
    { p: [[66, 4], [62, 36], [64, 78], [82, 114]], w: 5, len: 0.94, start: 0.3 },
    { p: [[96, 6], [92, 38], [94, 80], [112, 112]], w: 4.4, len: 0.9, start: 0.3 }
  ]
};

// One layer is an alpha plane; stamping a soft disc keeps the strongest value, so overlapping stamps do not pile up.
const plane = () => new Float32Array(W * SS * H * SS);
function stamp(pl, x, y, r, peak, soft) {
  const w = W * SS, x0 = Math.max(0, Math.floor((x - r) * SS)), x1 = Math.min(w - 1, Math.ceil((x + r) * SS)), y0 = Math.max(0, Math.floor((y - r) * SS)), y1 = Math.min(H * SS - 1, Math.ceil((y + r) * SS));
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
    const d = Math.hypot((i + 0.5) / SS - x, (j + 0.5) / SS - y) / r; if (d >= 1) continue;
    const a = soft ? peak * Math.pow(1 - d, soft) : peak; if (a > pl[j * w + i]) pl[j * w + i] = a;
  }
}

// One frame. head = how far along each claw the leading tip has got (0 to 1), tail = where the trailing end has got to, fade = overall opacity.
function frame(kind, head, tail, fade, seed) {
  const claws = KINDS[kind], glow = plane(), body = plane(), core = plane(), fleck = plane(), ember = plane(), r = rng(seed);
  claws.forEach((c, ci) => {
    const st = c.start || 0, a = Math.max(0, (tail - st) / (1 - st)), b = Math.max(0, Math.min(1, (head - st) / (1 - st))) * c.len;   // a later stroke (start > 0) sweeps after the first if (b <= a) return;
    const n = Math.ceil((b - a) * 260);
    for (let s = 0; s <= n; s++) {
      const t = a + (b - a) * (s / n), [x, y] = cubic(c.p, t / c.len);
      // Thin where the claw starts, fullest at about two thirds, a fine point at the end.
      const prof = Math.pow(Math.sin(Math.PI * Math.pow(t / c.len, 0.75)), 0.8), rad = Math.max(0.35, c.w * prof);
      stamp(glow, x, y, rad * 3.4, 0.4, 1.6);
      stamp(body, x, y, rad * 1.25, 1, 0);
      stamp(core, x, y, rad * 0.5, 1, 0);
    }
    // Blood flecks and embers thrown off just behind the leading tip.
    const [hx, hy] = cubic(c.p, Math.min(1, b / c.len));
    for (let i = 0; i < 7; i++) {
      const back = r() * 0.35 * (b - a), t = Math.max(0, b - back), [x, y] = cubic(c.p, Math.min(1, t / c.len));
      const dx = (r() - 0.3) * 18 * (0.4 + head), dy = (r() - 0.5) * 30;
      if (i % 3) stamp(fleck, x + dx, y + dy, 0.9 + r() * 1.9, 1, 0); else stamp(ember, x + dx * 0.6, y + dy * 0.6, 0.8 + r() * 1.1, 1, 0);
    }
    void hx; void hy; void ci;
  });
  // Composite: glow, then blood-red body, dark flecks, embers, then the hot core, down-sampled to W x H.
  const out = { w: W, h: H, data: Buffer.alloc(W * H * 4) }, w = W * SS;
  const layers = [[glow, [215, 10, 25]], [body, [235, 22, 32]], [fleck, [150, 0, 12]], [ember, [255, 150, 60]], [core, [255, 236, 228]]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let R = 0, G = 0, B = 0, A = 0;                                    // premultiplied, summed over the SS x SS samples
    for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) {
      const k = (y * SS + j) * w + x * SS + i; let cr = 0, cg = 0, cb = 0, ca = 0;
      for (const [pl, col] of layers) { const a = pl[k]; if (a <= 0) continue; cr = col[0] * a + cr * (1 - a); cg = col[1] * a + cg * (1 - a); cb = col[2] * a + cb * (1 - a); ca = a + ca * (1 - a); }
      R += cr; G += cg; B += cb; A += ca;
    }
    const n = SS * SS, p = (y * W + x) * 4, a = A / n;
    if (a <= 0) continue;
    out.data[p] = Math.round(Math.min(255, R / A)); out.data[p + 1] = Math.round(Math.min(255, G / A)); out.data[p + 2] = Math.round(Math.min(255, B / A));   // R, G, B are premultiplied sums
    out.data[p + 3] = Math.round(255 * Math.min(1, a * fade));
  }
  return out;
}

// The animation: the claws sweep out (frames 0 to 3), then the tail catches up and the whole thing fades (4 to 7).
function frames(kind) {
  const plan = [[0.26, 0, 1], [0.55, 0, 1], [0.85, 0, 1], [1, 0.08, 1], [1, 0.32, 0.9], [1, 0.58, 0.68], [1, 0.8, 0.42], [1, 0.93, 0.18]];
  return plan.map((p, i) => frame(kind, p[0], p[1], p[2], 7 + i));
}

module.exports = { W, H, FRAMES, DT, kinds: Object.keys(KINDS), frames };

if (require.main === module) {
  const KIND_LIST = Object.keys(KINDS), gif = require("./gif.js"), root = path.join(__dirname, "..", "..");
  fs.mkdirSync(path.join(root, "docs", "previews"), { recursive: true });
  const bg = [24, 20, 34], fs2 = [];
  for (const kind of KIND_LIST) for (const f of frames(kind)) {
    const c = { w: W, h: H, data: Buffer.alloc(W * H * 4) };
    for (let i = 0; i < W * H; i++) { const a = f.data[i * 4 + 3] / 255; for (let k = 0; k < 3; k++) c.data[i * 4 + k] = Math.round(f.data[i * 4 + k] * a + bg[k] * (1 - a)); c.data[i * 4 + 3] = 255; }
    fs2.push(c);
  }
  const buf = gif.encode(fs2, fs2.map(() => 6));
  fs.writeFileSync(path.join(root, "docs", "previews", "cat_slash.gif"), buf);
  // Also a still strip of every frame, for a quick look.
  const strip = { w: W * FRAMES, h: H * KIND_LIST.length, data: Buffer.alloc(W * FRAMES * H * KIND_LIST.length * 4) };
  fs2.forEach((f, n) => { const row = Math.floor(n / FRAMES), col = n % FRAMES; for (let y = 0; y < H; y++) f.data.copy(strip.data, ((row * H + y) * W * FRAMES + col * W) * 4, y * W * 4, (y + 1) * W * 4); });
  png.encode(strip, path.join(root, "docs", "previews", "cat_slash_frames.png"));
  console.log("wrote docs/previews/cat_slash.gif and cat_slash_frames.png");
}
