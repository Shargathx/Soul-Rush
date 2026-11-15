// Shared pixel-art helpers for the hub's generated art (cathedral.js, lights.js):
// a tiny RGBA canvas that wraps horizontally, a PNG writer that saves at SCALE x (nearest neighbour),
// colour helpers, pointed-arch geometry and stone masonry.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const SCALE = 2;

// ---- A tiny RGBA canvas -----------------------------------------------------
function canvas(w, h) {
  const px = new Float32Array(w * h * 4);
  const c = { w, h, px };
  c.blend = (x, y, col, a = 1) => {
    x = ((Math.round(x) % w) + w) % w; y = Math.round(y);
    if (y < 0 || y >= h || a <= 0) return;
    const i = (y * w + x) * 4, k = Math.min(1, a) * (col[3] === undefined ? 1 : col[3]);
    const da = px[i + 3], oa = k + da * (1 - k);
    for (let j = 0; j < 3; j++) px[i + j] = oa ? (col[j] * k + px[i + j] * da * (1 - k)) / oa : 0;
    px[i + 3] = oa;
  };
  c.set = (x, y, col) => { x = ((Math.round(x) % w) + w) % w; y = Math.round(y); if (y < 0 || y >= h) return;
    const i = (y * w + x) * 4; px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = col[3] === undefined ? 1 : col[3]; };
  c.clear = (x, y) => { x = ((Math.round(x) % w) + w) % w; if (y < 0 || y >= h) return; px[(y * w + x) * 4 + 3] = 0; };
  c.get = (x, y) => { x = ((Math.round(x) % w) + w) % w; const i = (y * w + x) * 4; return [px[i], px[i + 1], px[i + 2], px[i + 3]]; };
  c.rect = (x0, y0, x1, y1, col, a = 1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.blend(x, y, col, a); };
  return c;
}
function savePng(c, file, scale) {
  const SCALE_ = scale || SCALE;
  const W = c.w * SCALE_, Hh = c.h * SCALE_;
  const raw = Buffer.alloc((W * 4 + 1) * Hh);
  for (let y = 0; y < Hh; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const i = ((Math.floor(y / SCALE_)) * c.w + Math.floor(x / SCALE_)) * 4, o = y * (W * 4 + 1) + 1 + x * 4;
      raw[o] = Math.round(Math.max(0, Math.min(255, c.px[i]))); raw[o + 1] = Math.round(Math.max(0, Math.min(255, c.px[i + 1])));
      raw[o + 2] = Math.round(Math.max(0, Math.min(255, c.px[i + 2]))); raw[o + 3] = Math.round(Math.max(0, Math.min(1, c.px[i + 3])) * 255);
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let k = n; for (let j = 0; j < 8; j++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1; return k >>> 0; });
  const crc = buf => { let k = 0xffffffff; for (const b of buf) k = crcTable[(k ^ b) & 255] ^ (k >>> 8); return (k ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(Hh, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
  console.log(path.relative(process.cwd(), file), W + "x" + Hh);
}

// ---- Helpers ----------------------------------------------------------------
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// A two-centred pointed arch between xl and xr, springing at y0. r >= span / 2 (r = span: equilateral).
const inArch = (x, y, xl, xr, y0, r) => {
  if (y >= y0) return x >= xl && x <= xr;
  return Math.hypot(x - (xl + r), y - y0) <= r && Math.hypot(x - (xr - r), y - y0) <= r;
};
const archTop = (xl, xr, r) => { const s = (xr - xl) / 2; return Math.sqrt(r * r - (r - s) * (r - s)); };
// Stone courses: rows of blocks with staggered joints and a little tone noise per block.
function masonry(c, x0, y0, x1, y1, base, opts = {}) {
  const bh = opts.bh || 8, bw = opts.bw || 16, joint = opts.joint || mix(base, [0, 0, 0], 0.45), vary = opts.vary || 0.06;
  for (let y = y0; y < y1; y++) {
    const row = Math.floor(y / bh), off = row % 2 ? bw / 2 : 0;
    for (let x = x0; x < x1; x++) {
      const col = Math.floor((x + off) / bw);
      const s = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453; const n = (s - Math.floor(s) - 0.5) * 2 * vary;
      const isJoint = y % bh === 0 || (x + off) % bw === 0;
      c.set(x, y, isJoint ? joint : base.map(v => v * (1 + n)));
    }
  }
}


module.exports = { canvas, savePng, rand, hex, mix, inArch, archTop, masonry, SCALE };
