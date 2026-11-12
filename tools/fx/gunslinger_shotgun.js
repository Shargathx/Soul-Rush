// Repaints the Gunslinger's black shotgun as a classic pump-action: a wooden stock and pump (forend), and a lighter
// steel barrel, magazine tube and receiver. Used by gunslinger_hat.js on the clean attack_shotgun frames before the
// hat goes on; it isn't run on its own.
//
// The shotgun keeps its shape, so it still moves exactly as it did; only its colours change. In each frame:
//   - the gun is the large patches of near-black pixels; the barrel's top edge gives its angle and the muzzle;
//   - his grey gloves on the gun give the hands: everything from the rear (trigger) hand back is the stock, the
//     stretch just in front of it is the receiver, and the part under the front hand is the pump;
//   - each pixel is placed along the gun (a, from the muzzle) and across it (t, 0 at the top edge, 1 at the
//     bottom), and shaded lit from above like the sprite, with grain running along the wood.
// If a hand is out of view, its part sits where that hand holds the gun in the standing pose.

const W = 256;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
const PUMP_HALF = 20;        // The pump runs this far either side of the front hand (px along the gun).
// Where the hands sit in the standing pose, as a share of the gun's length from the muzzle: used for a hand
// that's out of view.
const PUMP_SHARE = 0.16, REAR_SHARE = 0.58;
const RECEIVER = 30;         // Length of the steel receiver in front of the rear hand.
const STOCK_FROM = -4;       // The stock starts this far in front of the rear hand's centre (its grip is under it).

const STEEL = [[176, 180, 186], [146, 150, 157], [116, 120, 127], [86, 89, 96], [58, 60, 66]];   // light to dark
const WOOD = [[168, 104, 56], [140, 82, 40], [112, 62, 28], [84, 44, 18], [58, 30, 12]];
const ramp = (r, t) => { t = Math.max(0, Math.min(1, t)) * (r.length - 1); const i = Math.min(r.length - 2, Math.floor(t)), f = t - i; return r[i].map((v, k) => v + (r[i + 1][k] - v) * f); };

function components(m) {
  const lab = new Int32Array(m.length), out = []; let id = 0;
  for (let s = 0; s < m.length; s++) if (m[s] && !lab[s]) {
    id++; const px = [s]; lab[s] = id;
    for (let k = 0; k < px.length; k++) {
      const p = px[k], x = p % W, y = (p / W) | 0;
      for (const [dx, dy] of N8) { const q = (y + dy) * W + x + dx; if (x + dx >= 0 && x + dx < W && y + dy >= 0 && y + dy < W && m[q] && !lab[q]) { lab[q] = id; px.push(q); } }
    }
    out.push(px);
  }
  return out.sort((a, b) => b.length - a.length);
}

function paintShotgun(img) {
  const d = img.data, dark = new Uint8Array(W * W), glove = new Uint8Array(W * W);
  for (let p = 0; p < W * W; p++) {
    const i = p * 4; if (d[i + 3] < 100) continue;
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), sp = mx - Math.min(d[i], d[i + 1], d[i + 2]);
    if (mx < 40 && sp < 20) dark[p] = 1; else if (mx >= 50 && mx < 150 && sp < 22) glove[p] = 1;
  }
  // The gun: the big near-black patches (the rear hand splits it into a stock and a front half).
  const parts = components(dark).filter(c => c.length >= 300);
  if (!parts.length) return null;
  const gun = new Uint8Array(W * W); for (const c of parts) for (const p of c) gun[p] = 1;
  const front = parts.reduce((a, c) => (Math.min(...c.map(p => p % W)) < Math.min(...a.map(p => p % W)) ? c : a));
  // Angle from the top edge of the front half's leftmost 60% (the barrel), then the muzzle.
  const top = {}; for (const p of front) { const x = p % W, y = (p / W) | 0; if (top[x] === undefined || y < top[x]) top[x] = y; }
  const xs = Object.keys(top).map(Number).sort((a, b) => a - b), cut = xs[0] + (xs[xs.length - 1] - xs[0]) * 0.6, sl = [];
  for (const a of xs) for (const b of xs) if (b <= cut && b - a >= 10) sl.push((top[b] - top[a]) / (b - a));
  sl.sort((a, b) => a - b);
  const ang = Math.atan(sl.length ? sl[sl.length >> 1] : 0), c = Math.cos(ang), s = Math.sin(ang);
  const A = p => (p % W) * c + ((p / W) | 0) * s, B = p => -(p % W) * s + ((p / W) | 0) * c;
  let a0 = Infinity; for (let p = 0; p < gun.length; p++) if (gun[p]) a0 = Math.min(a0, A(p));
  // Hands: grey glove patches touching the gun, placed along it. The grey knee joints below can touch the stock,
  // so only gloves above the gun's lowest point count. A hand in the front 45% of the gun is on the pump; one
  // further back is the trigger hand. When one is out of view, it's put where the standing pose has it.
  let aMax = 0, yMax = 0;
  for (let p = 0; p < gun.length; p++) if (gun[p]) { aMax = Math.max(aMax, A(p) - a0); yMax = Math.max(yMax, (p / W) | 0); }
  const hands = components(glove)
    .filter(g => g.length >= 25 && g.reduce((t, p) => t + ((p / W) | 0), 0) / g.length < yMax - 15
      && g.some(p => { const x = p % W, y = (p / W) | 0; return N8.some(([dx, dy]) => gun[(y + dy) * W + x + dx]); }))
    .map(g => g.reduce((t, p) => t + A(p), 0) / g.length - a0).sort((a, b) => a - b);
  const fronts = hands.filter(a => a < 0.45 * aMax), rears = hands.filter(a => a >= 0.45 * aMax);
  const rear = rears.length ? rears[rears.length - 1] : REAR_SHARE * aMax;
  const pump = fronts.length ? fronts[0] : PUMP_SHARE * aMax;
  // Each pixel's place across the gun: the top and bottom of the gun at its position along it.
  const lo = {}, hi = {};
  for (let p = 0; p < gun.length; p++) if (gun[p]) { const a = Math.round(A(p) - a0), b = B(p); lo[a] = Math.min(lo[a] ?? Infinity, b); hi[a] = Math.max(hi[a] ?? -Infinity, b); }
  let barrelTop = Infinity; for (const a in lo) if (+a < 30) barrelTop = Math.min(barrelTop, lo[a]);
  for (let p = 0; p < gun.length; p++) if (gun[p]) {
    const a = A(p) - a0, b = B(p), ai = Math.round(a), x = p % W, y = (p / W) | 0;
    const t = hi[ai] > lo[ai] ? (b - lo[ai]) / (hi[ai] - lo[ai]) : 0.5;
    const edge = N8.slice(0, 4).some(([dx, dy]) => !gun[(y + dy) * W + x + dx] && !glove[(y + dy) * W + x + dx]);
    let col;
    if (a >= rear + STOCK_FROM) {
      // Stock: lit along the top, grain following its length.
      const grain = Math.sin((b - barrelTop) * 1.7 + Math.sin(a * 0.21) * 1.4) * 0.07;
      col = ramp(WOOD, 0.15 + 0.65 * t + grain);
    } else if (Math.abs(a - pump) <= PUMP_HALF && b - barrelTop >= 3) {
      // Pump: grooved wood around the magazine tube.
      const groove = Math.abs(a - pump) < PUMP_HALF - 3 && Math.round(a) % 4 === 0 ? 0.18 : 0;
      col = ramp(WOOD, 0.2 + 0.55 * t + groove + Math.sin(a * 0.5) * 0.04);
    } else {
      // Steel: barrel and receiver, brightest along the top.
      const receiver = a >= rear - RECEIVER;
      col = ramp(STEEL, (receiver ? 0.15 : 0.05) + 0.75 * t);
    }
    if (edge) col = col.map(v => v * 0.6);
    d[p * 4] = Math.round(col[0]); d[p * 4 + 1] = Math.round(col[1]); d[p * 4 + 2] = Math.round(col[2]);
  }
  return { angle: Math.round(ang * 180 / Math.PI), rear: Math.round(rear), pump: Math.round(pump) };
}

module.exports = { paintShotgun };
