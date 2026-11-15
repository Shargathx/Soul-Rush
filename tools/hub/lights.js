// Draws the hub's light sources as pixel art (1x, saved at 2x) plus a soft glow texture:
// - flame_hearth_1..4: looping fire animations.
// (brazier() still draws the iron fire bowl the hub used to have; it is no longer saved.)
// - hearth.png: a round stone fire pit on a stepped plinth, the hall's centre.
// - candelabra.png: a tall iron stand with three lit candles.
// - torch.png + flame_torch_1..4: a wall torch for the arcade columns.
// - chandelier.png: an iron ring of candles hanging on a chain.
// - light_glow.png: a smooth white radial glow, tinted and flickered in the game (additive).
// Usage: node tools/hub/lights.js
const path = require("path");
const { canvas, savePng, hex, mix } = require("./pixel.js");
const OUT = path.join(__dirname, "..", "..", "assets", "backgrounds", "hub");

const P = {
  ironDark: hex("#121015"), iron: hex("#2b2731"), ironLit: hex("#4d4757"), ironHot: hex("#7a4a34"),
  stoneDark: hex("#1a1a20"), stone: hex("#2f2f38"), stoneLit: hex("#4a4a56"),
  coal: hex("#3a1410"), coalHot: hex("#c2401c"),
  wax: hex("#e3d8bd"), waxShade: hex("#a89c84"),
  fRed: hex("#9c2a18"), fOrange: hex("#f06a1c"), fYellow: hex("#ffc24a"), fCore: hex("#fff0b8")
};
// Deterministic noise so every run draws the same art.
const noise = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

// One flame frame: a teardrop that sways and licks upward, hottest at the bottom centre.
function flame(w, h, frame, frames, seed) {
  const c = canvas(w, h), cx = (w - 1) / 2, ph = (frame / frames) * Math.PI * 2;
  for (let y = 0; y < h; y++) {
    const t = 1 - y / (h - 1); // 0 at the bottom, 1 at the tip.
    const sway = Math.sin(t * 3.2 + ph + seed) * t * w * 0.14 + Math.sin(t * 7 - ph * 2) * t * t * w * 0.06;
    let half = (w * 0.46) * Math.pow(1 - t, 0.75) * (0.9 + 0.12 * Math.sin(ph + t * 5 + seed));
    if (t < 0.12) half *= 0.75 + t * 2; // Rounded base.
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x - cx - sway) / Math.max(0.6, half);
      // Tongues: near the tip, the outer edge breaks into licks. Only the rim is cut, never the body, so no holes.
      const lick = t > 0.6 && d > 0.72 && noise(Math.floor(x / 2) + frame * 3, Math.floor(y / 3) + seed) > 0.6;
      if (d > 1 || lick) continue;
      const heat = (1 - d) * (1 - t * 0.85);
      const col = heat > 0.62 ? P.fCore : heat > 0.42 ? P.fYellow : heat > 0.2 ? P.fOrange : P.fRed;
      c.set(x, y, col);
    }
  }
  // A spark or two above the tip.
  for (let k = 0; k < 2; k++) {
    const sx = Math.round(cx + (noise(frame, k + seed) - 0.5) * w * 0.6), sy = Math.round(h * (0.05 + 0.25 * noise(k, frame + seed)));
    if (noise(frame + 7, k) > 0.4) c.set(sx, sy, P.fYellow);
  }
  return c;
}

// Iron brazier: a shallow bowl of glowing coals on three legs.
function brazier() {
  const w = 24, h = 44, c = canvas(w, h), cx = 11.5;
  // Legs: two splayed outer legs and a straight middle one, joined by a ring.
  for (let y = 12; y < h; y++) {
    const t = (y - 12) / (h - 12);
    c.set(Math.round(cx - 3 - t * 7), y, P.iron); c.set(Math.round(cx - 3 - t * 7) + 1, y, P.ironDark);
    c.set(Math.round(cx + 3 + t * 7), y, P.iron); c.set(Math.round(cx + 3 + t * 7) - 1, y, P.ironLit);
    c.set(Math.round(cx), y, P.ironDark); c.set(Math.round(cx) + 1, y, P.iron);
  }
  for (let x = 4; x < 20; x++) { c.set(x, 30, P.ironLit); c.set(x, 31, P.ironDark); }
  for (const fx of [Math.round(cx - 10), Math.round(cx + 10), Math.round(cx)]) { c.set(fx - 1, h - 1, P.iron); c.set(fx, h - 1, P.iron); c.set(fx + 1, h - 1, P.iron); }
  // Bowl.
  for (let y = 2; y < 13; y++) {
    const half = 11.5 - Math.pow((y - 2) / 11, 1.6) * 7;
    for (let x = 0; x < w; x++) {
      const d = Math.abs(x - cx);
      if (d > half) continue;
      const edge = d > half - 1.2;
      c.set(x, y, edge ? P.ironDark : x < cx - half * 0.4 ? P.ironLit : y < 5 ? P.ironHot : P.iron);
    }
  }
  // Rim and coals.
  for (let x = 0; x < w; x++) { c.set(x, 2, P.ironLit); c.set(x, 1, x % 3 === 0 ? P.coalHot : P.coal); }
  for (let x = 3; x < 21; x++) if (noise(x, 3) > 0.45) c.set(x, 0, P.coalHot);
  // Decorative bands.
  for (let x = 2; x < 22; x++) if (Math.abs(x - cx) < 11.5 - Math.pow(5 / 11, 1.6) * 7) c.set(x, 7, P.ironDark);
  return c;
}

// The hearth: a round fire pit of fitted stones on a two-step plinth, full of coals.
function hearth() {
  const w = 56, h = 30, c = canvas(w, h), cx = 27.5;
  // Plinth steps.
  for (let x = 0; x < w; x++) for (let y = 24; y < h; y++) c.set(x, y, y === 24 ? P.stoneLit : (x + (y > 26 ? 4 : 0)) % 14 === 0 ? P.stoneDark : P.stone);
  for (let x = 4; x < w - 4; x++) for (let y = 18; y < 24; y++) c.set(x, y, y === 18 ? P.stoneLit : (x + 7) % 12 === 0 ? P.stoneDark : P.stone);
  // Stone ring (seen from the side): a band of blocks with dark joints.
  for (let x = 8; x < w - 8; x++) for (let y = 6; y < 18; y++) {
    const dx = (x - cx) / (cx - 8);
    if (y < 6 + Math.pow(Math.abs(dx), 4) * 4) continue;
    const joint = (x - 8) % 8 === 0 || y === 11;
    c.set(x, y, joint ? P.stoneDark : y < 8 ? P.stoneLit : x < cx - 8 ? mix(P.stone, P.stoneLit, 0.4) : P.stone);
  }
  // Coals heaped in the top, glowing.
  for (let x = 10; x < w - 10; x++) {
    const top = 5 - Math.round(Math.sin(((x - 10) / (w - 20)) * Math.PI) * 3);
    for (let y = top; y < 7; y++) c.set(x, y, noise(x, y) > 0.5 ? P.coalHot : P.coal);
  }
  return c;
}

// A tall iron candelabra: three candles on a crossbar, a long shaft, a footed base.
function candelabra() {
  const w = 22, h = 76, c = canvas(w, h), cx = 10.5;
  const candle = (x, y, len) => {
    for (let k = 0; k < len; k++) { c.set(x, y - k, P.wax); c.set(x + 1, y - k, P.waxShade); }
    c.set(x, y - len, P.fYellow); c.set(x, y - len - 1, P.fCore); c.set(x + 1, y - len - 1, P.fOrange); c.set(x, y - len - 2, P.fYellow);
  };
  // Shaft with knots.
  for (let y = 16; y < h - 4; y++) { c.set(Math.floor(cx), y, P.ironLit); c.set(Math.floor(cx) + 1, y, P.ironDark); }
  for (const ky of [30, 48]) for (let x = 8; x < 14; x++) { c.set(x, ky, P.iron); c.set(x, ky + 1, P.ironDark); }
  // Arms: a shallow bowl-shaped crossbar.
  for (let x = 1; x < 21; x++) { const y = 15 + Math.round(Math.pow((x - cx) / 10, 2) * -4) + 4; c.set(x, y, P.iron); c.set(x, y + 1, P.ironDark); }
  // Drip cups and candles.
  for (const [x, len] of [[1, 6], [10, 9], [19, 5]]) {
    const cupY = 15 + Math.round(Math.pow((x + 0.5 - cx) / 10, 2) * -4) + 3;
    for (let k = -1; k < 3; k++) c.set(x + k, cupY, P.ironLit);
    candle(x, cupY - 1, len);
  }
  // Footed base.
  for (let y = h - 6; y < h; y++) { const half = 2 + (y - (h - 6)) * 1.6; for (let x = 0; x < w; x++) if (Math.abs(x - cx) <= half) c.set(x, y, y === h - 1 ? P.ironDark : x < cx ? P.ironLit : P.iron); }
  return c;
}

// An iron chandelier: a hoop of candles seen slightly from below, on a long chain.
function chandelier() {
  const w = 60, h = 110, c = canvas(w, h), cx = 29.5, ringY = 92;
  // Chain: alternating links.
  for (let y = 0; y < ringY - 14; y++) {
    const link = Math.floor(y / 4) % 2;
    if (link) { c.set(Math.floor(cx), y, P.iron); c.set(Math.floor(cx) + 1, y, P.ironDark); }
    else if (y % 4 === 0 || y % 4 === 3) { c.set(Math.floor(cx) - 1, y, P.iron); c.set(Math.floor(cx) + 2, y, P.ironDark); }
    else { c.set(Math.floor(cx) - 1, y, P.ironLit); c.set(Math.floor(cx) + 2, y, P.iron); }
  }
  // Four support chains fanning out to the hoop.
  for (const end of [3, 18, 41, 56]) for (let k = 0; k <= 14; k++) { const t = k / 14; c.set(Math.round(cx + (end - cx) * t), ringY - 14 + k, k % 2 ? P.iron : P.ironDark); }
  // Hoop: an ellipse band.
  for (let a = 0; a < 360; a += 1) {
    const t = a * Math.PI / 180, x = cx + Math.cos(t) * 28, y = ringY + Math.sin(t) * 4;
    c.set(x, y, Math.sin(t) > 0 ? P.ironLit : P.iron); c.set(x, y + 1, P.ironDark);
  }
  // Candles on the front of the hoop (back ones hidden behind the flames' glow anyway).
  for (const x of [4, 15, 29, 44, 55]) {
    const by = Math.round(ringY + Math.sin(Math.acos((x - cx) / 28.5)) * 4) - 1;
    const len = 5 + (x % 3);
    for (let k = 0; k < len; k++) { c.set(x, by - k, P.wax); c.set(x + 1, by - k, P.waxShade); }
    c.set(x, by - len, P.fYellow); c.set(x, by - len - 1, P.fCore); c.set(x + 1, by - len - 1, P.fOrange); c.set(x, by - len - 2, P.fYellow);
  }
  // A finial hanging below.
  for (let y = ringY + 4; y < h - 4; y++) { c.set(Math.floor(cx), y, P.iron); c.set(Math.floor(cx) + 1, y, P.ironDark); }
  for (let y = h - 6; y < h; y++) { const half = 3 - (y - (h - 6)) * 0.5; for (let x = 0; x < w; x++) if (Math.abs(x - cx) <= half) c.set(x, y, x < cx ? P.ironLit : P.iron); }
  return c;
}

// A smooth glow: white, fading to nothing. Saved at 1x so it stays smooth.
function glow() {
  const s = 128, c = canvas(s, s), m = (s - 1) / 2;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const r = Math.min(1, Math.hypot(x - m, y - m) / m);
    c.set(x, y, [255, 255, 255, Math.pow(1 - r, 2.2)]);
  }
  return c;
}

// A wall torch for the arcade columns: an iron plate and arm holding a wooden torch, burning at the top.
// The flame is its own animation (flame_torch_*), drawn over the torch head.
function torch() {
  const w = 14, h = 30, c = canvas(w, h);
  // Wall plate.
  for (let y = 16; y < 28; y++) for (let x = 4; x < 10; x++) c.set(x, y, x === 4 ? P.ironLit : x === 9 ? P.ironDark : P.iron);
  for (const [x, y] of [[5, 18], [8, 18], [5, 25], [8, 25]]) c.set(x, y, P.ironLit);
  // Arm and cup.
  for (let y = 20; y < 23; y++) for (let x = 5; x < 9; x++) c.set(x, y, P.ironDark);
  for (let x = 3; x < 11; x++) { c.set(x, 14, P.ironLit); c.set(x, 15, P.iron); }
  for (let x = 4; x < 10; x++) c.set(x, 16, P.ironDark);
  // Torch: a wooden shaft wrapped with pitch-black cloth at the head, glowing.
  const wood = hex("#5a3a22"), woodDark = hex("#3a2414"), cloth = hex("#241a18");
  for (let y = 6; y < 14; y++) { c.set(6, y, wood); c.set(7, y, woodDark); }
  for (let y = 3; y < 7; y++) for (let x = 5; x < 9; x++) c.set(x, y, (x + y) % 2 ? cloth : P.coal);
  c.set(6, 3, P.coalHot); c.set(7, 4, P.coalHot);
  return c;
}

require("fs").mkdirSync(OUT, { recursive: true });
for (let f = 0; f < 4; f++) {
  savePng(flame(10, 16, f, 4, 2.6), path.join(OUT, "flame_torch_" + (f + 1) + ".png"));
  savePng(flame(40, 44, f, 4, 4.1), path.join(OUT, "flame_hearth_" + (f + 1) + ".png"));
}
savePng(hearth(), path.join(OUT, "hearth.png"));
savePng(candelabra(), path.join(OUT, "candelabra.png"));
savePng(torch(), path.join(OUT, "torch.png"));
savePng(chandelier(), path.join(OUT, "chandelier.png"));
savePng(glow(), path.join(OUT, "light_glow.png"), 1);
