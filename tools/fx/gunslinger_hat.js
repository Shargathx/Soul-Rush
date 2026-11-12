// Puts a cowboy hat on every Gunslinger frame. The Gunslinger_NPC object (layouts/gunslinger.json) animates idle,
// attack_shotgun (frames 125-148), attack_pistol (21-29), attack_sniper (40-78), dash_fwd, dash_bwd and
// gunslinger_posture_broken. The pistol, sniper and posture-broken frames sit directly in assets/, the rest in
// assets/Enemies/Gunslinger. The unused Gunslinger_NPC1-40 sniper frames get the hat too, in case they come back.
//
//   node tools/fx/gunslinger_hat.js            stamps the hat onto the frames in place
//   node tools/fx/gunslinger_hat.js <dir>      writes the hatted frames to <dir> instead (for previewing)
//
// The hat is always stamped onto clean, hatless copies of the frames, kept in "assets (raw)/gunslinger-no-hat"
// (git-ignored). A frame is copied there the first time the script sees it, so rerunning never stacks a second
// hat. If that folder is lost once the frames have hats, get the clean frames back from git (the commit before the
// hat was added) and put them there first. To hat a new animation, add a group below.
//
// The hat is drawn once, side-on and facing left, and is lit from the upper left like the sprite. Each group of
// frames shares a pose: the hat is placed by hand on the group's reference frame, and the other frames find their
// head by matching it against the reference's head, so the hat bobs, recoils and leans along with it.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { swapGun } = require("./gunslinger_revolver");   // attack_pistol: the Glock becomes a revolver.
const { paintShotgun } = require("./gunslinger_shotgun");   // attack_shotgun: repainted as a wood-and-steel pump-action.

const ROOT = path.join(__dirname, "../..");
const DIR = path.join(ROOT, "assets/Enemies/Gunslinger");
const CLEAN = path.join(ROOT, "assets (raw)/gunslinger-no-hat");
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : null;

const seq = (name, from, to) => Array.from({ length: to - from + 1 }, (_, i) => name + (from + i > 1 ? from + i : "") + ".png");
// Each group: its frames, the reference frame, where the brim's centre sits on the reference's head and the hat's
// tilt (radians, negative tips the front down), and the box around the reference's head used for matching.
// tiltPerDx tips the hat forward as the head moves right (the sniper leaning into his aim).
const GROUPS = [
  { name: "idle", dir: DIR, files: seq("idle", 1, 26), hat: { x: 193, y: 45, tilt: -0.15 },
    box: { x0: 175, x1: 212, y0: 40, y1: 62 } },
  { name: "attack_shotgun", dir: DIR, files: seq("attack_shotgun", 125, 148), hat: { x: 170, y: 47, tilt: -0.15 },
    box: { x0: 150, x1: 192, y0: 36, y1: 62 }, before: paintShotgun },
  { name: "dash_fwd", dir: DIR, files: seq("dash_fwd", 1, 3), hat: { x: 131, y: 46, tilt: -0.35 },
    box: { x0: 112, x1: 150, y0: 40, y1: 64 } },
  { name: "dash_bwd", dir: DIR, files: seq("dash_bwd", 1, 1), hat: { x: 197, y: 48, tilt: -0.15 },
    box: { x0: 180, x1: 216, y0: 42, y1: 64 } },
  { name: "posture broken", dir: path.join(ROOT, "assets"), files: seq("gunslinger_posture_broken", 1, 5),
    hat: { x: 193, y: 45, tilt: -0.15 }, box: { x0: 175, x1: 212, y0: 40, y1: 62 } },
  { name: "attack_pistol", dir: path.join(ROOT, "assets"), files: seq("attack_pistol", 21, 29),
    hat: { x: 182, y: 47, tilt: -0.15 }, box: { x0: 162, x1: 204, y0: 36, y1: 62 }, before: swapGun },
  { name: "attack_sniper", dir: path.join(ROOT, "assets"), files: seq("attack_sniper", 40, 78),
    hat: { x: 188, y: 45, tilt: -0.12 }, box: { x0: 165, x1: 212, y0: 38, y1: 72 }, tiltPerDx: 0.01 },
  { name: "old sniper (unused)", dir: DIR, files: seq("Gunslinger_NPC", 1, 40), hat: { x: 188, y: 45, tilt: -0.12 },
    box: { x0: 165, x1: 212, y0: 38, y1: 72 }, tiltPerDx: 0.01 },
];
const SEARCH = 12;   // How far (px) a frame's head may be from the reference's.

// ---- PNG in and out (8-bit, non-interlaced) -----------------------------------------------------------------
function readPng(file) {
  const b = fs.readFileSync(file);
  let p = 8, w, h, depth, type, interlace, plte, trns; const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), t = b.toString("ascii", p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    p += 12 + len;
    if (t === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; interlace = d[12]; }
    else if (t === "PLTE") plte = d; else if (t === "tRNS") trns = d; else if (t === "IDAT") idat.push(d);
  }
  if (depth !== 8 || interlace) throw new Error(file + ": only 8-bit non-interlaced PNGs are supported");
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type], raw = zlib.inflateSync(Buffer.concat(idat)), st = w * ch;
  const data = Buffer.alloc(w * h * 4); let prev = Buffer.alloc(st);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)], line = Buffer.from(raw.subarray(y * (st + 1) + 1, (y + 1) * (st + 1)));
    for (let x = 0; x < st; x++) {
      const a = x >= ch ? line[x - ch] : 0, u = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) { const q = a + u - c, pa = Math.abs(q - a), pb = Math.abs(q - u), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      line[x] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, i = x * ch;
      if (type === 6) line.copy(data, o, i, i + 4);
      else if (type === 2) { line.copy(data, o, i, i + 3); data[o + 3] = 255; }
      else if (type === 3) { const k = line[i]; plte.copy(data, o, k * 3, k * 3 + 3); data[o + 3] = trns && k < trns.length ? trns[k] : 255; }
      else { data[o] = data[o + 1] = data[o + 2] = line[i]; data[o + 3] = type === 4 ? line[i + 1] : 255; }
    }
    prev = line;
  }
  return { w, h, data };
}
function writePng(img, file) {
  const { w, h, data } = img, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const table = Array.from({ length: 256 }, (_, n) => { let k = n; for (let j = 0; j < 8; j++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1; return k >>> 0; });
  const crc = buf => { let k = 0xffffffff; for (const x of buf) k = table[(k ^ x) & 255] ^ (k >>> 8); return (k ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
}

// ---- The hat ------------------------------------------------------------------------------------------------
// Drawn into its own 64x36 grid; (AX, AY) is the brim's centre, the point placed on the head.
const HW = 64, HH = 36, AX = 32, AY = 27;
const FELT = [96, 62, 32], LITE = [150, 104, 58], DARK = [48, 30, 14], BAND = [34, 24, 18], BAND_HI = [70, 52, 36];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = v => Math.max(0, Math.min(1, v));
function drawHat() {
  const px = new Array(HW * HH).fill(null);
  // Brim: a flattened ellipse that curls up at both ends; lit on top, dark underneath, with a darker rim.
  const bw = 27, bh = 5.2;
  for (let y = 0; y < HH; y++) for (let x = 0; x < HW; x++) {
    const u = (x - AX) / bw, curl = 6 * Math.pow(Math.abs(u), 2.4), v = (y - AY + curl) / bh;
    if (u * u + v * v > 1) continue;
    let c = v < 0 ? mix(FELT, LITE, clamp(0.6 - 0.6 * u + 0.3 * v)) : mix(DARK, FELT, clamp(0.4 - 0.3 * u));
    if (u * u + v * v > 0.82) c = mix(c, DARK, 0.55);
    px[y * HW + x] = c;
  }
  // Crown: tapers and rakes forward slightly, with a crease down the middle of the top and a band at the bottom.
  const height = 17, base = AY - 2;
  for (let y = base - height; y <= base; y++) {
    const t = (base - y) / height, half = 12.5 - 3 * t, cx = AX + 1 - 1.2 * t;
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const u = (x - cx) / half, au = Math.abs(u);
      if (au > 1) continue;
      const top = base - height + (au > 0.7 ? (au - 0.7) * 9 : 0) + (au < 0.45 ? 2.2 * (1 - au / 0.45) : 0);
      if (y < top) continue;
      let c = mix(LITE, DARK, clamp(0.25 + 0.55 * u + 0.25 * (1 - t)));
      if (y < top + 1.2) c = mix(c, LITE, 0.5);
      if (au > 0.9) c = mix(c, DARK, 0.5);
      if (t < 0.3 && t > 0.05) c = au < 0.8 ? mix(BAND, BAND_HI, clamp(0.5 - 0.6 * u)) : mix(BAND, DARK, 0.3);
      px[y * HW + x] = c;
    }
  }
  return px;
}
const HAT = drawHat();
// Stamps the hat onto img with its brim centre at (x, y), rotated by tilt; nearest-neighbour, fully opaque.
function stamp(img, x0, y0, tilt) {
  const ca = Math.cos(tilt), sa = Math.sin(tilt);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const rx = x - x0, ry = y - y0;
    const hx = Math.round(ca * rx + sa * ry + AX), hy = Math.round(-sa * rx + ca * ry + AY);
    if (hx < 0 || hx >= HW || hy < 0 || hy >= HH) continue;
    const c = HAT[hy * HW + hx];
    if (!c) continue;
    const i = (y * img.w + x) * 4;
    img.data[i] = Math.round(c[0]); img.data[i + 1] = Math.round(c[1]); img.data[i + 2] = Math.round(c[2]); img.data[i + 3] = 255;
  }
}

// ---- Finding the head ---------------------------------------------------------------------------------------
// The offset (dx, dy) at which img's pixels best match frame 1's head.
function findHead(ref, img, box) {
  let best = [Infinity, 0, 0];
  for (let dy = -SEARCH; dy <= SEARCH; dy++) for (let dx = -SEARCH; dx <= SEARCH; dx++) {
    let s = 0;
    for (let y = box.y0; y < box.y1; y++) for (let x = box.x0; x < box.x1; x++) {
      const i = (y * ref.w + x) * 4, j = ((y + dy) * img.w + x + dx) * 4;
      for (let c = 0; c < 4; c++) s += Math.abs(ref.data[i + c] - img.data[j + c]);
    }
    if (s < best[0]) best = [s, dx, dy];
  }
  return { dx: best[1], dy: best[2] };
}

// ---- Run ----------------------------------------------------------------------------------------------------
fs.mkdirSync(CLEAN, { recursive: true });
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const sign = v => (v >= 0 ? "+" : "") + v;
for (const g of GROUPS) {
  // First sight of a frame: keep its hatless original.
  for (const f of g.files) if (!fs.existsSync(path.join(CLEAN, f))) fs.copyFileSync(path.join(g.dir, f), path.join(CLEAN, f));
  const ref = readPng(path.join(CLEAN, g.files[0])), moves = [];
  for (const f of g.files) {
    const img = readPng(path.join(CLEAN, f)), { dx, dy } = findHead(ref, img, g.box);
    if (g.before) g.before(img);
    stamp(img, g.hat.x + dx, g.hat.y + dy, g.hat.tilt + (g.tiltPerDx || 0) * dx);
    writePng(img, path.join(OUT || g.dir, f));
    moves.push(sign(dx) + "," + sign(dy));
  }
  console.log(`${g.name} (${g.files.length}): head moves ${[...new Set(moves)].join(" ")}`);
}
