// A tiny GIF89a encoder: frames are { w, h, data (RGBA) }, delays in 1/100 s, a looping animation, one global palette (<= 256 colours; extra colours map to the nearest).
function encode(frames, delays) {
  const w = frames[0].w, h = frames[0].h, pal = new Map(), colors = [];
  const key = (r, g, b) => (r << 16) | (g << 8) | b;
  for (const f of frames) for (let i = 0; i < w * h; i++) { const k = key(f.data[i * 4], f.data[i * 4 + 1], f.data[i * 4 + 2]); if (!pal.has(k) && colors.length < 256) { pal.set(k, colors.length); colors.push([f.data[i * 4], f.data[i * 4 + 1], f.data[i * 4 + 2]]); } }
  const nearest = (r, g, b) => { let best = 0, bd = 1e9; for (let i = 0; i < colors.length; i++) { const d = (colors[i][0] - r) ** 2 + (colors[i][1] - g) ** 2 + (colors[i][2] - b) ** 2; if (d < bd) { bd = d; best = i; } } return best; };
  let bits = 1; while ((1 << bits) < colors.length) bits++;
  const out = [];
  const u16 = v => out.push(v & 255, (v >> 8) & 255);
  out.push(...Buffer.from("GIF89a")); u16(w); u16(h); out.push(0x80 | (bits - 1), 0, 0);
  for (let i = 0; i < (1 << bits); i++) out.push(...(colors[i] || [0, 0, 0]));
  out.push(0x21, 0xff, 0x0b, ...Buffer.from("NETSCAPE2.0"), 3, 1, 0, 0, 0);
  frames.forEach((f, n) => {
    out.push(0x21, 0xf9, 4, 0, delays[n] & 255, (delays[n] >> 8) & 255, 0, 0);
    out.push(0x2c); u16(0); u16(0); u16(w); u16(h); out.push(0);
    const idx = new Uint8Array(w * h), cache = new Map();
    for (let i = 0; i < w * h; i++) { const r = f.data[i * 4], g = f.data[i * 4 + 1], b = f.data[i * 4 + 2], k = key(r, g, b); let v = pal.get(k); if (v === undefined) { v = cache.get(k); if (v === undefined) { v = nearest(r, g, b); cache.set(k, v); } } idx[i] = v; }
    const min = Math.max(2, bits); out.push(min);
    // LZW
    const clear = 1 << min, eoi = clear + 1; let size = min + 1, next = eoi + 1, dict = new Map(), buf = 0, nbits = 0; const bytes = [];
    const emit = code => { buf |= code << nbits; nbits += size; while (nbits >= 8) { bytes.push(buf & 255); buf >>= 8; nbits -= 8; } };
    emit(clear); let prefix = idx[0];
    for (let i = 1; i < idx.length; i++) {
      const c = idx[i], k = prefix * 256 + c, hit = dict.get(k);
      if (hit !== undefined) prefix = hit;
      else { emit(prefix); if (next < 4096) { dict.set(k, next++); if (next > (1 << size) && size < 12) size++; } else { emit(clear); dict = new Map(); size = min + 1; next = eoi + 1; } prefix = c; }
    }
    emit(prefix); emit(eoi); if (nbits > 0) bytes.push(buf & 255);
    for (let i = 0; i < bytes.length; i += 255) { const n2 = Math.min(255, bytes.length - i); out.push(n2); for (let j = 0; j < n2; j++) out.push(bytes[i + j]); }
    out.push(0);
  });
  out.push(0x3b);
  return Buffer.from(out);
}
module.exports = { encode };
