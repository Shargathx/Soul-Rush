// The Samurai's mirror image look ("D Spirit Echo" and the other templates): PNG read/write, blur, tint, rim and dissolve helpers.
// Used by mirror_templates.js (a review sheet) and mirror_frames.js (the game's mirror frames).
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const ROOT = path.join(__dirname, "..", "..");

// ---- PNG read/write (RGBA, 8 bit) ------------------------------------------------------------------------------------
function readPng(file) {
  const b = fs.readFileSync(file);
  let p = 8, w, h, ct, idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString("ascii", p + 4, p + 8);
    if (type === "IHDR") { w = b.readUInt32BE(p + 8); h = b.readUInt32BE(p + 12); ct = b[p + 17]; }
    if (type === "IDAT") idat.push(b.slice(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 1, raw = zlib.inflateSync(Buffer.concat(idat));
  const px = new Float32Array(w * h * 4);
  let prev = Buffer.alloc(w * bpp);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (w * bpp + 1)], line = Buffer.from(raw.slice(y * (w * bpp + 1) + 1, (y + 1) * (w * bpp + 1)));
    for (let x = 0; x < line.length; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, u = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      if (ft === 1) line[x] = (line[x] + a) & 255; else if (ft === 2) line[x] = (line[x] + u) & 255;
      else if (ft === 3) line[x] = (line[x] + ((a + u) >> 1)) & 255;
      else if (ft === 4) { const pa = Math.abs(u - c), pb = Math.abs(a - c), pc = Math.abs(a + u - 2 * c); line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? u : c)) & 255; }
    }
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; px[i] = line[x * bpp]; px[i + 1] = line[x * bpp + 1]; px[i + 2] = line[x * bpp + 2]; px[i + 3] = bpp === 4 ? line[x * bpp + 3] / 255 : 1; }
    prev = line;
  }
  return { w, h, px };
}
function writePng(img, file, scale) {
  const S = scale || 1, W = img.w * S, H = img.h * S, raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (Math.floor(y / S) * img.w + Math.floor(x / S)) * 4, o = y * (W * 4 + 1) + 1 + x * 4;
    for (let j = 0; j < 3; j++) raw[o + j] = Math.max(0, Math.min(255, Math.round(img.px[i + j])));
    raw[o + 3] = Math.max(0, Math.min(255, Math.round(img.px[i + 3] * 255)));
  }
  const table = Array.from({ length: 256 }, (_, n) => { let k = n; for (let j = 0; j < 8; j++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1; return k >>> 0; });
  const crc = buf => { let k = 0xffffffff; for (const v of buf) k = table[(k ^ v) & 255] ^ (k >>> 8); return (k ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
}
const blank = (w, h) => ({ w, h, px: new Float32Array(w * h * 4) });

// ---- Image operations --------------------------------------------------------------------------------------------------
// A box blur on premultiplied colour, so transparent edges do not turn dark.
function blur(img, r) {
  if (r <= 0) return img;
  const { w, h } = img, pre = new Float32Array(w * h * 4), out = blank(w, h);
  for (let i = 0; i < w * h; i++) { const a = img.px[i * 4 + 3]; pre[i * 4] = img.px[i * 4] * a; pre[i * 4 + 1] = img.px[i * 4 + 1] * a; pre[i * 4 + 2] = img.px[i * 4 + 2] * a; pre[i * 4 + 3] = a; }
  const pass = (src, dst, dx, dy) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = [0, 0, 0, 0], n = 0;
    for (let k = -r; k <= r; k++) { const xx = x + k * dx, yy = y + k * dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const i = (yy * w + xx) * 4; for (let j = 0; j < 4; j++) s[j] += src[i + j]; n++; }
    const o = (y * w + x) * 4; for (let j = 0; j < 4; j++) dst[o + j] = s[j] / n; } };
  const tmp = new Float32Array(w * h * 4); pass(pre, tmp, 1, 0); pass(tmp, pre, 0, 1);
  for (let i = 0; i < w * h; i++) { const a = pre[i * 4 + 3]; out.px[i * 4 + 3] = a; for (let j = 0; j < 3; j++) out.px[i * 4 + j] = a > 0.001 ? pre[i * 4 + j] / a : 0; }
  return out;
}
const luma = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
// Replace the colours by a tint scaled by brightness: dark pixels stay dark blue, light pixels glow.
function tint(img, dark, light, alpha) {
  const out = blank(img.w, img.h);
  for (let i = 0; i < img.w * img.h; i++) { const l = Math.min(1, luma(img.px[i * 4], img.px[i * 4 + 1], img.px[i * 4 + 2]) * 1.4);
    for (let j = 0; j < 3; j++) out.px[i * 4 + j] = dark[j] + (light[j] - dark[j]) * l; out.px[i * 4 + 3] = img.px[i * 4 + 3] * alpha; }
  return out;
}
// Lay b over a at an offset, with an optional additive mode.
function over(a, b, dx, dy, add) {
  const out = { w: a.w, h: a.h, px: Float32Array.from(a.px) };
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= a.w || Y >= a.h) continue;
    const i = (y * b.w + x) * 4, o = (Y * a.w + X) * 4, sa = b.px[i + 3]; if (sa <= 0) continue;
    const da = out.px[o + 3], oa = sa + da * (1 - sa);
    for (let j = 0; j < 3; j++) out.px[o + j] = add ? Math.min(255, out.px[o + j] + b.px[i + j] * sa) : (b.px[i + j] * sa + out.px[o + j] * da * (1 - sa)) / (oa || 1);
    out.px[o + 3] = add ? Math.max(da, sa) : oa; }
  return out;
}
// The outline of the shape: where a pixel is solid but a neighbour is not.
function rim(img, col, strength) {
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const a = img.px[(y * img.w + x) * 4 + 3]; if (a < 0.4) continue;
    let edge = false; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= img.w || Y >= img.h || img.px[(Y * img.w + X) * 4 + 3] < 0.25) edge = true; }
    if (edge) { const o = (y * img.w + x) * 4; out.px[o] = col[0]; out.px[o + 1] = col[1]; out.px[o + 2] = col[2]; out.px[o + 3] = strength; } }
  return out;
}
function scanlines(img, every, dim) { const out = { w: img.w, h: img.h, px: Float32Array.from(img.px) }; for (let y = 0; y < img.h; y++) if (y % every === 0) for (let x = 0; x < img.w; x++) out.px[(y * img.w + x) * 4 + 3] *= dim; return out; }
// Dissolve the lower part into drifting pixels (a cheap deterministic hash, so every run is the same).
function dissolve(img, from, seed) {
  const out = { w: img.w, h: img.h, px: Float32Array.from(img.px) };
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const k = Math.max(0, (y - from) / (img.h - from)); const hsh = Math.abs(Math.sin((x * 12.9898 + y * 78.233 + seed) * 43758.5453)) % 1; if (hsh < k * 1.1) out.px[(y * img.w + x) * 4 + 3] *= hsh > k * 0.5 ? 0.4 : 0; }
  return out;
}

// ---- The three looks -------------------------------------------------------------------------------------------------------
const LOOKS = {
  "A  Hologram": src => {
    // Cyan-blue, a touch blurred, scanlines, and a faint colour-split ghost to one side, like a projection flickering.
    const base = blur(tint(src, [18, 60, 120], [150, 235, 255], 0.62), 1);
    const ghost = blur(tint(src, [10, 90, 160], [90, 200, 255], 0.28), 1);
    let o = over(blank(src.w, src.h), ghost, 3, 0); o = over(o, base, 0, 0);
    o = over(o, rim(base, [190, 245, 255], 0.55), 0, 0, true);
    return scanlines(o, 2, 0.55);
  },
  "B  Echo": src => {
    // Softer and paler: heavily blurred, one trailing afterimage behind it, no hard edge. Reads as a faint memory of him.
    const soft = blur(tint(src, [60, 90, 150], [190, 215, 255], 0.5), 2);
    const trail = blur(tint(src, [50, 80, 140], [150, 190, 255], 0.22), 3);
    let o = over(blank(src.w, src.h), trail, -6, 1); o = over(o, trail, -3, 0); o = over(o, soft, 0, 0);
    return o;
  },
  "D  Spirit Echo": src => {
    // C's clear shape (indigo body, cyan outline) on top of B's softness: a blurred bloom around it and two fading afterimages
    // trailing behind, so the outline stays readable but the whole figure feels smeared and ghostly.
    const body = blur(tint(src, [14, 22, 70], [80, 130, 220], 0.72), 1);
    const bloom = blur(tint(src, [40, 80, 170], [150, 210, 255], 0.35), 3);
    const trail = blur(tint(src, [30, 60, 150], [110, 170, 255], 0.2), 2);
    let o = over(blank(src.w, src.h), trail, -7, 1); o = over(o, trail, -4, 0); o = over(o, bloom, 0, 0, true);
    o = over(o, blur(rim(src, [60, 200, 255], 0.8), 1), 0, 0, true);
    o = over(o, body, 0, 0);
    o = over(o, rim(src, [150, 240, 255], 0.65), 0, 0, true);
    return dissolve(o, Math.round(src.h * 0.66), 3);
  },
  "C  Spirit": src => {
    // Deep indigo body with a bright cyan outline, glowing from the rim, and the legs dissolving into pixels. Most dramatic.
    const body = blur(tint(src, [14, 22, 70], [70, 120, 210], 0.78), 1);
    let o = over(blank(src.w, src.h), blur(rim(src, [60, 200, 255], 0.9), 2), 0, 0, true);
    o = over(o, body, 0, 0);
    o = over(o, rim(src, [140, 240, 255], 0.9), 0, 0, true);
    return dissolve(o, Math.round(src.h * 0.62), 3);
  }
};


module.exports = { ROOT, readPng, writePng, blank, blur, tint, over, rim, scanlines, dissolve, LOOKS };
