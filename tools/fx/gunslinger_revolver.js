// Swaps the Gunslinger's Glock for a revolver in his attack_pistol frames. Used by gunslinger_hat.js, which runs it
// on the clean frames before stamping the hat; it isn't run on its own.
//
// In each frame the Glock is found as the largest patch of dark, grey pixels left of his hand (plus the lighter
// grey bits and the orange hit outline right around it), and its angle from the slope of the slide's top edge.
// It's erased, and a revolver is drawn at the same angle with its muzzle where the Glock's was, so the muzzle
// flash and smoke still line up. The revolver only fills pixels that were empty or Glock, so his hand stays in
// front of the grip and the smoke stays in front of the barrel.

const W = 256;
const SCAN = { x1: 150, y1: 130 };   // The Glock is always in this top-left part of the frame.

// ---- Finding the Glock --------------------------------------------------------------------------------------
const rgb = (d, i) => [d[i], d[i + 1], d[i + 2]];
const spread = c => Math.max(...c) - Math.min(...c);
const isGun = (d, i) => d[i + 3] > 100 && Math.max(...rgb(d, i)) < 95 && spread(rgb(d, i)) < 28;
const isGrey = (d, i) => d[i + 3] > 100 && Math.max(...rgb(d, i)) < 170 && spread(rgb(d, i)) < 30;
const isOutline = (d, i) => { const [r, g, b] = rgb(d, i); return d[i + 3] > 100 && r > 140 && g > 70 && g < 200 && b < 80 && r - g > 40; };
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

function findGlock(img) {
  const d = img.data, m = new Uint8Array(W * W);
  for (let y = 0; y < SCAN.y1; y++) for (let x = 0; x < SCAN.x1; x++) if (isGun(d, (y * W + x) * 4)) m[y * W + x] = 1;
  // Keep the largest connected patch: that's the gun, not stray dark pixels.
  const lab = new Int32Array(m.length); let best = 0, bestN = 0, id = 0;
  for (let s = 0; s < m.length; s++) if (m[s] && !lab[s]) {
    id++; let n = 0; const st = [s]; lab[s] = id;
    while (st.length) {
      const p = st.pop(), x = p % W, y = (p / W) | 0; n++;
      for (const [dx, dy] of N8) { const q = (y + dy) * W + x + dx; if (x + dx >= 0 && x + dx < W && y + dy >= 0 && m[q] && !lab[q]) { lab[q] = id; st.push(q); } }
    }
    if (n > bestN) { bestN = n; best = id; }
  }
  // In hit frames the orange outline cuts the Glock into pieces, so take in every dark patch within 4px of it too.
  const keep = new Set([best]);
  for (let round = 0; round < 3; round++) for (let p = 0; p < m.length; p++) if (lab[p] && !keep.has(lab[p])) {
    const x = p % W, y = (p / W) | 0;
    near: for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const q = (y + dy) * W + x + dx;
      if (q >= 0 && q < m.length && keep.has(lab[q])) { keep.add(lab[p]); break near; }
    }
  }
  for (let s = 0; s < m.length; s++) m[s] = keep.has(lab[s]) ? 1 : 0;
  // Grow into the lighter grey parts (magazine, trigger) touching it, three pixels at most.
  for (let pass = 0; pass < 3; pass++) {
    const add = [];
    for (let p = 0; p < m.length; p++) if (!m[p] && isGrey(d, p * 4)) { const x = p % W, y = (p / W) | 0; if (N8.some(([dx, dy]) => m[(y + dy) * W + x + dx])) add.push(p); }
    for (const p of add) m[p] = 1;
  }
  // The orange hit outline traced round the Glock: erased, and later traced round the revolver instead.
  const outline = []; let outCol = null;
  for (let p = 0; p < m.length; p++) if (!m[p] && isOutline(d, p * 4)) {
    const x = p % W, y = (p / W) | 0;
    let near = false;
    for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) if (m[(y + dy) * W + x + dx]) { near = true; break; }
    if (near) { outline.push(p); outCol = outCol || rgb(d, p * 4); }
  }
  // Angle: median slope of the slide's top edge, from the topmost gun pixel in each column.
  const top = {};
  for (let p = 0; p < m.length; p++) if (m[p]) { const x = p % W, y = (p / W) | 0; if (top[x] === undefined || y < top[x]) top[x] = y; }
  const xs = Object.keys(top).map(Number), slopes = [];
  for (const a of xs) for (const b of xs) if (b - a >= 8) slopes.push((top[b] - top[a]) / (b - a));
  slopes.sort((a, b) => a - b);
  const ang = Math.atan(slopes[slopes.length >> 1] || 0);
  // Muzzle: the front-top corner, along the slide (u, pointing back towards the hand) and across it (v, down).
  const c = Math.cos(ang), s = Math.sin(ang); let u0 = Infinity, v0 = Infinity;
  for (let p = 0; p < m.length; p++) if (m[p]) { const x = p % W, y = (p / W) | 0; u0 = Math.min(u0, x * c + y * s); v0 = Math.min(v0, -x * s + y * c); }
  return { mask: m, outline, outCol, ang, u0, v0 };
}

// ---- The revolver -------------------------------------------------------------------------------------------
// Side-on, muzzle to the left, in gun coordinates: a runs from the muzzle back towards the hand, b from the top of
// the barrel down. Lit from the upper left like the sprite. Returns a colour, or null for no pixel.
const STEEL = [[22, 22, 26], [44, 45, 50], [72, 74, 80], [118, 121, 128], [170, 173, 180]];   // dark to bright
const WOOD = [[58, 30, 14], [96, 54, 26], [134, 80, 40]];
const shade = (ramp, t) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))))];
function revolver(a, b) {
  // Hammer spur, cocked back over the frame.
  if (a >= 39 && a < 44 && b >= -3 + (a - 39) * 0.4 && b < 1) return shade(STEEL, b < -1.5 ? 0.75 : 0.4);
  // Front sight blade.
  if (a >= 1 && a < 3 && b >= -1 && b < 0) return STEEL[2];
  // Barrel: round, bright along the top, with an ejector rod housing underneath.
  if (a >= 0 && a < 23 && b >= 0 && b < 5) return a < 1 ? STEEL[0] : shade(STEEL, [0.95, 0.7, 0.45, 0.25, 0.1][b | 0]);
  if (a >= 5 && a < 21 && b >= 5 && b < 7) return b < 6 ? STEEL[1] : STEEL[0];
  // Cylinder: taller than the barrel, rounded, with dark flutes.
  if (a >= 22 && a < 33 && b >= -1 && b < 10) {
    const ca = Math.abs(a - 27.5) / 5.5, cb = Math.abs(b - 4.5) / 5.5;
    if (ca > 0.82 && cb > 0.72) return null;
    if ((b | 0) === 2 || (b | 0) === 6) return STEEL[0];
    return shade(STEEL, 0.85 - 0.5 * ((b + 1) / 11) - 0.15 * ca);
  }
  // Frame behind the cylinder, with the top strap.
  if (a >= 33 && a < 42 && b >= 0 && b < 10) return shade(STEEL, b < 2 ? 0.8 : 0.45 - 0.2 * (b / 10));
  // Trigger guard (a loop under the frame) and the trigger inside it.
  if (a >= 29 && a < 39 && b >= 10 && b < 16) {
    const ea = (a - 34) / 5, eb = (b - 10) / 6, r = ea * ea + eb * eb;
    if (r <= 1 && r > 0.5) return STEEL[1];
    if (a >= 34 && a < 36 && b < 14) return STEEL[2];
    return null;
  }
  // Plow-handle grip, sweeping down and back into the hand, wood with a steel butt.
  const gx0 = 37 + (b - 8) * 0.45, gx1 = 45 + (b - 8) * 0.55;
  if (b >= 8 && b < 25 && a >= gx0 && a < gx1) {
    if (b >= 23) return STEEL[1];
    const t = (a - gx0) / (gx1 - gx0);
    return shade(WOOD, t < 0.3 ? 1 : t < 0.75 ? 0.6 : 0.1);
  }
  return null;
}

// ---- Swapping ----------------------------------------------------------------------------------------------
function swapGun(img) {
  const g = findGlock(img), d = img.data, c = Math.cos(g.ang), s = Math.sin(g.ang);
  const free = new Uint8Array(W * W);
  for (let p = 0; p < free.length; p++) {
    if (g.mask[p]) d[p * 4 + 3] = 0;
    free[p] = g.mask[p] || d[p * 4 + 3] === 0 ? 1 : 0;
  }
  for (const p of g.outline) { d[p * 4 + 3] = 0; free[p] = 1; }
  const drawn = new Uint8Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (!free[p]) continue;
    const a = Math.round(x * c + y * s - g.u0), b = Math.round(-x * s + y * c - g.v0), col = revolver(a, b);
    if (!col) continue;
    d[p * 4] = col[0]; d[p * 4 + 1] = col[1]; d[p * 4 + 2] = col[2]; d[p * 4 + 3] = 255; drawn[p] = 1;
  }
  // Where the Glock's grip sat over his fist, erasing it leaves holes: fill those from the hand around them.
  for (let pass = 0; pass < 4; pass++) {
    const fills = [];
    for (let p = 0; p < free.length; p++) if (g.mask[p] && !drawn[p] && d[p * 4 + 3] === 0) {
      const x = p % W, y = (p / W) | 0, solid = N8.map(([dx, dy]) => (y + dy) * W + x + dx).filter(q => d[q * 4 + 3] > 200);
      const nb = solid.filter(q => !drawn[q]);   // Colour comes from the hand only, never the revolver.
      if (solid.length >= 5 && nb.length >= 2) fills.push([p, [0, 1, 2].map(k => Math.round(nb.reduce((t, q) => t + d[q * 4 + k], 0) / nb.length))]);
    }
    for (const [p, col] of fills) { d.set(col, p * 4); d[p * 4 + 3] = 255; }
  }
  // Retrace the hit outline round the revolver, where the Glock had one.
  if (g.outCol) for (let p = 0; p < drawn.length; p++) if (!drawn[p] && d[p * 4 + 3] === 0) {
    const x = p % W, y = (p / W) | 0;
    if (N8.slice(0, 4).some(([dx, dy]) => drawn[(y + dy) * W + x + dx])) { d.set(g.outCol, p * 4); d[p * 4 + 3] = 255; }
  }
  return { angle: Math.round(g.ang * 180 / Math.PI), outline: !!g.outCol };
}

module.exports = { swapGun };
