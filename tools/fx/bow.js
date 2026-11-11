// The Leaf Ranger's bow sounds, made from scratch (no samples): the shape follows measurements of reference bow and
// volley sounds, not their audio. 16-bit mono WAV, 48 kHz, in assets/Sfx. Deterministic: the same files every run.
//
//   node tools/fx/bow.js
//
// bow_release_1..5.wav - an arrow loosed. Three layers:
//   snap  - the string letting go: a 1-6 kHz crack, gone in about 25 ms.
//   thump - the string and limbs springing back: a deep tone sliding down (around 90 -> 55 Hz) with a little
//           wobble, the body of the sound, fading over about 250 ms.
//   hiss  - the arrow leaving: a soft high whoosh (4-8 kHz) that swells after the snap and trails off by ~0.7 s.
// volley_fall.wav      - a sky full of arrows coming down: many thin whistles falling in pitch over a rising whoosh.
//                        0.6 s, building to the end: in game the first arrows land about 0.57 s after it starts.
// volley_impact_1..3.wav - the arrows landing: a quick burst of thuds into earth and wood, with dry cracks and a few
//                         arrows quivering, densest at the start, over about 0.9 s.
const fs = require("fs");
const path = require("path");
const RATE = 48000;
const OUT = path.join(__dirname, "../../assets/Sfx");

function writeWav(file, x, peakDb) {
  let peak = 0; for (const v of x) peak = Math.max(peak, Math.abs(v));
  const gain = Math.pow(10, peakDb / 20) / (peak || 1), b = Buffer.alloc(44 + x.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * gain * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
  console.log(path.relative(process.cwd(), file), (x.length / RATE).toFixed(2) + " s");
}
function biquad(type, f, q) {
  const w = 2 * Math.PI * f / RATE, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else { b0 = a; b1 = 0; b2 = -a; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const fn = x => { const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  fn.state = () => [x1, x2, y1, y2]; fn.load = s => { [x1, x2, y1, y2] = s; };
  return fn;
}
function retune(old, type, f, q) { const nf = biquad(type, f, q); if (old.state) nf.load(old.state()); return nf; }
const rng = seed => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

// One bow release. v: seed, thump pitch (Hz at the start), hiss brightness (Hz), snap level, length, and style knobs
// (each defaults to the original sound):
//   thumpLvl, thumpDecay - the deep thump's level and fade time (s).   body - the low thud under it.
//   twang, twangHz       - a singing string tone (level, pitch), with a fast wobble that settles.
//   hissLvl, hissHold, hissDecay - the arrow's whoosh: level, how long it holds full (s), and its fade (s).
//   sweep                - how far the whoosh's pitch drops as the arrow flies off (0 = none, 0.4 = 40%).
//   flutter              - fletching flutter on the whoosh (0-1), a fast ripple.
function bowRelease(v) {
  v = Object.assign({ thumpLvl: 0.5, thumpDecay: 0.065, body: 0.8, twang: 0, twangHz: 210, hissLvl: 0.55, hissHold: 0.11, hissDecay: 0.16, sweep: 0, flutter: 0 }, v);
  const rnd = rng(v.seed), noise = () => rnd() * 2 - 1, n = Math.round(v.len * RATE), out = new Float32Array(n);
  // Snap.
  const sbp = biquad("bp", v.snapHz, 1.1), shp = biquad("hp", 900, 0.7);
  for (let i = 0; i < 0.04 * RATE; i++) out[i + Math.round(0.004 * RATE)] += shp(sbp(noise())) * 9 * v.snap * Math.exp(-i / (0.007 * RATE));
  // Thump: the string's deep twang, with the limbs' second tone a little above it beating against it.
  let ph1 = 0, ph2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE, f = v.thump * (0.62 + 0.38 * Math.exp(-t / 0.06)) * (1 + 0.012 * Math.sin(2 * Math.PI * 9 * t));
    ph1 += f / RATE; ph2 += f * 2.03 / RATE;
    const env = Math.min(1, Math.max(0, t - 0.008) / 0.006) * Math.exp(-Math.max(0, t - 0.008) / v.thumpDecay); // Starts just after the snap.
    out[i] += env * (Math.sin(2 * Math.PI * ph1) + 0.35 * Math.sin(2 * Math.PI * ph2)) * v.thumpLvl;
  }
  const tlp = biquad("lp", 420, 0.7); // A soft body thud under the twang.
  for (let i = 0; i < 0.09 * RATE; i++) out[i] += tlp(noise()) * v.body * Math.exp(-i / (0.015 * RATE));
  // Twang: the string singing, its pitch wobbling fast at first and settling, a touch of its octave for bite.
  if (v.twang > 0) {
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE, wob = 1 + 0.04 * Math.exp(-t / 0.05) * Math.sin(2 * Math.PI * 28 * t), f = v.twangHz * (1 + 0.06 * Math.exp(-t / 0.03)) * wob;
      ph += f / RATE;
      const env = Math.min(1, Math.max(0, t - 0.006) / 0.003) * Math.exp(-t / 0.13);
      out[i] += env * (Math.sin(2 * Math.PI * ph) + 0.3 * Math.sin(4 * Math.PI * ph) + 0.12 * Math.sin(6 * Math.PI * ph)) * v.twang;
    }
  }
  // Hiss: the arrow leaving, a whoosh that gets darker and quieter as it goes.
  // With a sweep, the band's centre slides down as the arrow flies off (re-tuned every 64 samples).
  let h1 = biquad("bp", v.hiss, 1.6); const h2 = biquad("hp", 2500, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    if (v.sweep && i % 64 === 0) h1 = retune(h1, "bp", v.hiss * (1 - v.sweep * Math.min(1, t / 0.5)), 1.6);
    const env = Math.min(1, Math.max(0, (t - 0.02) / 0.09)) * Math.exp(-Math.max(0, t - v.hissHold) / v.hissDecay);
    const flut = 1 - v.flutter * 0.5 * (1 + Math.sin(2 * Math.PI * (55 - 25 * Math.min(1, t / 0.4)) * t));
    out[i] += h2(h1(noise())) * env * v.hissLvl * flut;
  }
  for (let i = 0; i < 0.03 * RATE; i++) out[n - 1 - i] *= i / (0.03 * RATE);
  return out;
}

// The falling volley: a broad whoosh swelling as the arrows near, and a dozen thin whistles dropping in pitch.
function volleyFall(seed) {
  const rnd = rng(seed), noise = () => rnd() * 2 - 1, len = 0.6, n = Math.round(len * RATE), out = new Float32Array(n);
  const w1 = biquad("bp", 3200, 0.8), w2 = biquad("hp", 600, 0.7);
  for (let i = 0; i < n; i++) { const t = i / len / RATE; out[i] += w2(w1(noise())) * Math.pow(t, 1.8) * (t > 0.92 ? (1 - t) / 0.08 : 1) * 1.0; }
  for (let k = 0; k < 14; k++) {
    const t0 = 0.05 + rnd() * 0.35, dur = 0.18 + rnd() * 0.18, f0 = 5200 + rnd() * 2600, i0 = Math.round(t0 * RATE), m = Math.round(dur * RATE);
    const bp = biquad("bp", 1, 1); let ph = 0;
    for (let j = 0; j < m && i0 + j < n; j++) {
      const u = j / m, f = f0 * (1 - 0.35 * u); ph += f / RATE;
      const tone = Math.sin(2 * Math.PI * ph) * (0.6 + 0.4 * noise()); // breathy, not a pure whistle
      out[i0 + j] += tone * Math.sin(Math.PI * u) * 0.08;
    }
  }
  return out;
}

// The volley landing: thuds (earth and wood), dry cracks, and the odd arrow quivering.
function volleyImpact(seed, count) {
  const rnd = rng(seed), noise = () => rnd() * 2 - 1, len = 1.15, n = Math.round(len * RATE), out = new Float32Array(n);
  for (let k = 0; k < count; k++) {
    const t0 = 0.01 + Math.pow(rnd(), 1.7) * 0.85, i0 = Math.round(t0 * RATE), lvl = 0.5 + rnd() * 0.5;
    // Thud: low noise into the ground plus a short low tone.
    const lp = biquad("lp", 380 + rnd() * 400, 0.8), f = 70 + rnd() * 50;
    for (let j = 0; j < 0.12 * RATE && i0 + j < n; j++) {
      const t = j / RATE;
      out[i0 + j] += (lp(noise()) * 1.5 * Math.exp(-t / 0.018) + Math.sin(2 * Math.PI * f * t) * Math.exp(-t / 0.035) * 0.5) * lvl;
    }
    // Crack: the arrowhead biting in.
    const cb = biquad("bp", 2200 + rnd() * 2500, 1.4);
    for (let j = 0; j < 0.03 * RATE && i0 + j < n; j++) out[i0 + j] += cb(noise()) * 5 * lvl * Math.exp(-j / (0.005 * RATE));
    // Knock: the shaft hitting wood and stone, a hollow mid tone.
    const kb = biquad("bp", 700 + rnd() * 600, 2.5);
    for (let j = 0; j < 0.05 * RATE && i0 + j < n; j++) out[i0 + j] += kb(noise()) * 3 * lvl * Math.exp(-j / (0.012 * RATE));
    // Now and then a shaft quivers after it sticks.
    if (rnd() < 0.3) {
      const qf = 160 + rnd() * 120, q0 = i0 + Math.round(0.01 * RATE);
      for (let j = 0; j < 0.25 * RATE && q0 + j < n; j++) { const t = j / RATE; out[q0 + j] += Math.sin(2 * Math.PI * qf * t) * Math.sin(2 * Math.PI * 22 * t) * Math.exp(-t / 0.07) * 0.25 * lvl; }
    }
  }
  for (let i = 0; i < 0.12 * RATE; i++) out[n - 1 - i] *= i / (0.12 * RATE);
  return out;
}

// Shot styles to compare (node tools/fx/bow.js preview <dir>): each is laid over the five RELEASES variants.
const STYLES = {
  A_heavy: { thumpLvl: 0.95, thumpDecay: 0.12, body: 1.4, snap: 0.8, hissLvl: 0.45, hissHold: 0.22, hissDecay: 0.2, sweep: 0.15 },
  B_twang: { thumpLvl: 0.55, thumpDecay: 0.08, twang: 0.35, hissLvl: 0.5, hissHold: 0.2, hissDecay: 0.2, sweep: 0.2 },
  C_whoosh: { snap: 0.6, thumpLvl: 0.4, thumpDecay: 0.06, hissLvl: 1.0, hissHold: 0.28, hissDecay: 0.22, sweep: 0.4, flutter: 0.6 }
};
const RELEASES = [
  { seed: 11, thump: 92, hiss: 5600, snapHz: 3200, snap: 1.0, len: 0.7 },
  { seed: 23, thump: 84, hiss: 6200, snapHz: 2600, snap: 0.9, len: 0.75 },
  { seed: 37, thump: 98, hiss: 5200, snapHz: 3800, snap: 1.1, len: 0.68 },
  { seed: 41, thump: 88, hiss: 6800, snapHz: 3000, snap: 0.8, len: 0.72 },
  { seed: 53, thump: 80, hiss: 5900, snapHz: 2400, snap: 1.0, len: 0.78 }
];
if (process.argv[2] === "preview") {
  const dir = process.argv[3];
  for (const [name, style] of Object.entries(STYLES)) {
    const demo = new Float32Array(Math.round(4.4 * RATE));
    RELEASES.forEach((v, k) => {
      const x = bowRelease(Object.assign({}, v, style, { snap: (style.snap || 1) * v.snap })); let pk = 0; for (const s of x) pk = Math.max(pk, Math.abs(s));
      const i0 = Math.round((0.2 + k * 0.8) * RATE); for (let i = 0; i < x.length && i0 + i < demo.length; i++) demo[i0 + i] += x[i] / pk * 0.89;
    });
    writeWav(path.join(dir, "shots_" + name + ".wav"), demo, -1);
  }
  process.exit(0);
}
RELEASES.forEach((v, k) => writeWav(path.join(OUT, "bow_release_" + (k + 1) + ".wav"), bowRelease(v), -1));
writeWav(path.join(OUT, "volley_fall.wav"), volleyFall(71), -3);
[[83, 11], [97, 13], [101, 10]].forEach(([s, c], k) => writeWav(path.join(OUT, "volley_impact_" + (k + 1) + ".wav"), volleyImpact(s, c), -1));
