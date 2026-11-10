// Draws the hub's cathedral backdrop as seamless, horizontally tileable pixel art.
// Each strip is drawn at 1x and saved at 2x (nearest neighbour), like the rest of the game's art.
// Every shape that crosses a tile edge is drawn twice (once per side) so the tiles wrap without a seam.
// Usage: node tools/hub/cathedral.js   -> assets/backgrounds/hub/cathedral_far.png, cathedral_mid.png
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const OUT = path.join(__dirname, "..", "..", "assets", "backgrounds", "hub");
const SCALE = 2;
const H = 360; // 720 on screen.
const FLOOR = 328; // The floor line (657 on screen / 2).

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
function savePng(c, file) {
  const W = c.w * SCALE, Hh = c.h * SCALE;
  const raw = Buffer.alloc((W * 4 + 1) * Hh);
  for (let y = 0; y < Hh; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const i = ((Math.floor(y / SCALE)) * c.w + Math.floor(x / SCALE)) * 4, o = y * (W * 4 + 1) + 1 + x * 4;
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

const P = {
  wall: hex("#1d2029"), wallDeep: hex("#15171e"), vault: hex("#101218"),
  pillar: hex("#262a35"), pillarLit: hex("#3d4556"), pillarDark: hex("#14161c"),
  glassTop: hex("#9cb0c8"), glassMid: hex("#61779a"), glassLow: hex("#38455c"), lead: hex("#0d0e13"),
  moon: hex("#9fb4d0"), candle: hex("#e3d8bd"), flame: hex("#ffd27a"), flameHot: hex("#fff2c4"), ember: hex("#ff9a3c"),
  arcade: hex("#14151b"), arcadeLit: hex("#2c3240"), arcadeDark: hex("#0b0c10"), banner: hex("#4c1519"), bannerDark: hex("#2e0c0f"), gold: hex("#8a6a32")
};

// ---- Far strip: a bay of the nave wall -------------------------------------
// A tall lancet window full of moonlight between two ribbed pillars; candles at the pillar feet.
function far() {
  const W = 160, c = canvas(W, H), cx = W / 2;
  masonry(c, 0, 0, W, H, P.wall, { bw: 20, bh: 10 });
  // Vault shadow: darker towards the top.
  for (let y = 0; y < 120; y++) for (let x = 0; x < W; x++) c.blend(x, y, P.vault, 0.75 * (1 - y / 120));
  // Window light spilling onto the wall around it.
  const wl = cx - 24, wr = cx + 24, spring = 120, sill = 286, r = 48;
  for (let y = 40; y < FLOOR; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot((x - cx) / 1.3, (y - 190) / 2.1);
    c.blend(x, y, P.moon, 0.18 * Math.max(0, 1 - d / 70));
  }
  // Window: jamb, glass, tracery.
  const top = spring - archTop(wl, wr, r);
  for (let y = Math.floor(top) - 4; y < sill + 4; y++) for (let x = wl - 4; x <= wr + 4; x++) {
    if (inArch(x, y, wl - 4, wr + 4, spring, r + 4) && y < sill + 4) c.set(x, y, mix(P.pillar, P.pillarLit, 0.35));
  }
  for (let y = Math.floor(top); y < sill; y++) for (let x = wl; x <= wr; x++) {
    if (!inArch(x, y, wl, wr, spring, r)) continue;
    const t = (y - top) / (sill - top);
    let col = t < 0.5 ? mix(P.glassTop, P.glassMid, t * 2) : mix(P.glassMid, P.glassLow, (t - 0.5) * 2);
    if ((x + y) % 7 === 0 || rand() < 0.05) col = mix(col, P.glassTop, 0.25);
    c.set(x, y, col);
  }
  // Tracery: a centre mullion splitting two small lancets, an oculus above, and lead bars.
  const sub = (xl, xr) => { for (let y = Math.floor(top); y < spring + 6; y++) for (let x = xl - 1; x <= xr + 1; x++)
    if (inArch(x, y, xl - 1, xr + 1, spring + 6, 23) && !inArch(x, y, xl, xr, spring + 6, 22) && inArch(x, y, wl, wr, spring, r)) c.set(x, y, P.lead); };
  sub(wl, cx - 1); sub(cx + 1, wr);
  for (let y = spring; y < sill; y++) { c.set(cx, y, P.lead); c.set(cx - 1, y, P.lead); }
  for (let a = 0; a < 360; a += 2) { const t = a * Math.PI / 180; c.set(cx + Math.cos(t) * 8, spring - 22 + Math.sin(t) * 8, P.lead); }
  for (let a = 0; a < 4; a++) { const t = a * Math.PI / 2 + Math.PI / 4; for (let k = 0; k < 8; k++) c.set(cx + Math.cos(t) * k, spring - 22 + Math.sin(t) * k, P.lead); }
  for (let y = spring + 22; y < sill; y += 22) for (let x = wl; x <= wr; x++) c.set(x, y, P.lead);
  // Sill.
  c.rect(wl - 6, sill, wr + 7, sill + 4, P.pillarLit); c.rect(wl - 6, sill + 4, wr + 7, sill + 6, P.pillarDark);
  // Shaft of moonlight falling to the floor.
  for (let y = sill; y < FLOOR; y++) { const k = (y - sill) / (FLOOR - sill); const x0 = wl - 6 - k * 26, x1 = wr + 6 - k * 6;
    for (let x = Math.floor(x0); x < x1; x++) c.blend(x, y, P.moon, 0.10 * (1 - k * 0.6)); }
  // Pillars at the tile edge (drawn across x = 0, so they wrap).
  const pw = 12; // Half width.
  for (let y = 0; y < FLOOR; y++) for (let dx = -pw; dx < pw; dx++) {
    const t = (dx + pw) / (2 * pw);
    let col = t < 0.2 ? P.pillarLit : t > 0.75 ? P.pillarDark : P.pillar;
    if (dx === -6 || dx === 0 || dx === 5) col = mix(col, P.pillarDark, 0.5); // Fluting.
    c.set(dx, y, col);
  }
  // Capital and base.
  c.rect(-pw - 3, 112, pw + 3, 117, P.pillarLit); c.rect(-pw - 2, 117, pw + 2, 121, P.pillarDark);
  c.rect(-pw - 4, FLOOR - 16, pw + 4, FLOOR - 11, P.pillarLit); c.rect(-pw - 4, FLOOR - 11, pw + 4, FLOOR, P.pillar);
  // Vault ribs springing from each capital over the bay (only the lower part is in view).
  for (let y = 0; y < 112; y++) for (let x = 0; x < W; x++) {
    const R = 170, dl = Math.hypot(x - (0 + R), y - 112), dr = Math.hypot(x - (W - R), y - 112);
    if (x < W / 2 && Math.abs(dl - R) < 2.2) c.set(x, y, Math.abs(dl - R) < 1 ? P.pillarLit : P.pillar);
    if (x >= W / 2 && Math.abs(dr - R) < 2.2) c.set(x, y, Math.abs(dr - R) < 1 ? P.pillarLit : P.pillar);
  }
  // Candles on the floor beside each pillar, with a warm glow.
  const candles = [[18, 8], [23, 5], [27, 10], [W - 20, 6], [W - 25, 9]];
  for (const [x, hgt] of candles) for (let y = 0; y < FLOOR; y++) for (let xx = x - 20; xx < x + 20; xx++) {
    const d = Math.hypot(xx - x, (y - (FLOOR - hgt - 3)) * 1.2); if (d < 30) c.blend(xx, y, P.ember, 0.16 * (1 - d / 30));
  }
  for (const [x, hgt] of candles) {
    c.rect(x - 1, FLOOR - hgt, x + 2, FLOOR, P.candle); c.rect(x + 1, FLOOR - hgt, x + 2, FLOOR, mix(P.candle, P.pillarDark, 0.4));
    c.set(x, FLOOR - hgt - 1, P.flame); c.set(x, FLOOR - hgt - 2, P.flameHot); c.set(x + 1, FLOOR - hgt - 1, P.ember);
  }
  // Floor below the line: dark flagstones (mostly hidden by the tile floor).
  masonry(c, 0, FLOOR, W, H, P.wallDeep, { bw: 24, bh: 6 });
  return c;
}

// ---- Mid strip: the arcade between nave and aisle ---------------------------
// Massive columns carrying pointed arches. The openings are see-through to the far strip.
// A tattered banner hangs at the crown of every arch.
function mid() {
  const W = 256, c = canvas(W, H);
  const colW = 16, spring = 170, r = 0.62 * (W - 2 * colW);
  const xl = colW, xr = W - colW, apex = spring - archTop(xl, xr, r);
  masonry(c, 0, 0, W, H, P.arcade, { bw: 22, bh: 11, vary: 0.08 });
  // Openings.
  for (let y = 0; y < FLOOR; y++) for (let x = 0; x < W; x++) if (inArch(x, y, xl, xr, spring, r)) c.clear(x, y);
  // Arch ring: voussoirs with a moonlit inner edge.
  for (let y = 0; y < spring; y++) for (let x = 0; x < W; x++) {
    if (inArch(x, y, xl, xr, spring, r)) continue;
    if (inArch(x, y, xl - 12, xr + 12, spring, r + 12)) {
      const inner = inArch(x, y, xl - 2, xr + 2, spring, r + 2);
      const outer = !inArch(x, y, xl - 11, xr + 11, spring, r + 11);
      if (outer) { c.set(x, y, P.arcadeDark); continue; }
      const ang = Math.atan2(y - spring, x - W / 2), seg = Math.floor((ang + Math.PI) / 0.16) % 2;
      c.set(x, y, inner ? P.arcadeLit : seg ? mix(P.arcade, P.arcadeLit, 0.25) : mix(P.arcade, P.arcadeDark, 0.2));
    }
  }
  // Columns at the tile edge (across x = 0, so they wrap), rim-lit on the window side.
  for (let y = 0; y < FLOOR; y++) for (let dx = -colW; dx < colW; dx++) {
    if (y < spring) continue; // Above the capital is the wall between the arches.
    const t = (dx + colW) / (2 * colW);
    let col = t < 0.12 ? P.arcadeLit : t > 0.8 ? P.arcadeDark : P.arcade;
    if (dx === -8 || dx === 1 || dx === 8) col = mix(col, P.arcadeDark, 0.55);
    c.set(dx, y, col);
  }
  // Capitals and bases.
  c.rect(-colW - 4, spring - 2, colW + 4, spring + 4, P.arcadeLit); c.rect(-colW - 3, spring + 4, colW + 3, spring + 8, P.arcadeDark);
  c.rect(-colW - 5, FLOOR - 20, colW + 5, FLOOR - 14, P.arcadeLit); c.rect(-colW - 5, FLOOR - 14, colW + 5, FLOOR, P.arcade);
  // Banner at the crown of the arch: dark crimson, gold trim, frayed hem.
  const bx = W / 2, bTop = Math.ceil(apex) + 2, bw = 13, bh = 92;
  c.rect(bx - bw - 3, bTop - 2, bx + bw + 3, bTop, P.gold);
  for (let y = bTop; y < bTop + bh + 10; y++) for (let x = bx - bw; x < bx + bw; x++) {
    const fray = bh + Math.round(Math.sin(x * 1.7) * 4 + Math.sin(x * 0.6) * 4 + (x - bx === 0 ? 8 : 0));
    if (y - bTop > fray) continue;
    const fold = Math.sin((x - bx) * 0.7) > 0.4 ? P.bannerDark : P.banner;
    c.set(x, y, (x === bx - bw || x === bx + bw - 1) ? P.gold : fold);
  }
  // A simple emblem: a pale ring with a vertical bar.
  for (let a = 0; a < 360; a += 3) { const t = a * Math.PI / 180; c.set(bx + Math.cos(t) * 6, bTop + 30 + Math.sin(t) * 6, P.gold); }
  for (let y = bTop + 22; y < bTop + 46; y++) c.set(bx, y, P.gold);
  // Floor under the arcade.
  masonry(c, 0, FLOOR, W, H, P.arcadeDark, { bw: 24, bh: 6 });
  return c;
}

fs.mkdirSync(OUT, { recursive: true });
savePng(far(), path.join(OUT, "cathedral_far.png"));
savePng(mid(), path.join(OUT, "cathedral_mid.png"));
