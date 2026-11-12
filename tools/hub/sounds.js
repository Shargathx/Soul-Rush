// Synthesizes the hub's sounds as 16-bit mono WAVs in assets/Sfx/hub (deterministic: the same files every run).
// - gate_gong.wav: a deep, bass-heavy gong for a gate waking (about 49 Hz, inharmonic partials that bloom and beat).
// - hearth_loop.wav: a seamless fire loop (low roar plus random crackles and pops), heard from across a stone hall.
// - distant_bell.wav: a far-off, muffled bell with a long tail, rung now and then.
// Usage: node tools/hub/sounds.js
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "..", "assets", "Sfx", "hub");
const RATE = 32000;

let seed = 1234;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const noise = () => rnd() * 2 - 1;

function writeWav(file, samples, peakDb) {
  let peak = 0; for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const gain = Math.pow(10, peakDb / 20) / (peak || 1);
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * gain * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
  console.log(path.relative(process.cwd(), file), (samples.length / RATE).toFixed(1) + " s", (b.length / 1024).toFixed(0) + " KB");
}
// RBJ biquad filters.
function biquad(type, f, q) {
  const w = 2 * Math.PI * f / RATE, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else { b0 = a; b1 = 0; b2 = -a; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; } // band-pass
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
// Runs a filter chain over a loop twice and keeps the second pass, so the filters' state wraps and the loop is seamless.
function loopFilter(src, makeChain) {
  const chain = makeChain(), out = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < src.length; i++) { const y = chain(src[i]); if (pass) out[i] = y; }
  return out;
}
// A small reverb: a few feedback delays, mixed in.
function reverb(x, mix, decay) {
  const out = Float32Array.from(x);
  for (const ms of [37, 53, 71, 97, 131]) {
    const d = Math.round(ms * RATE / 1000), buf = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) buf[i] = x[i] + (i >= d ? buf[i - d] * decay : 0);
    for (let i = 0; i < x.length; i++) out[i] += buf[i] * mix / 5;
  }
  return out;
}

// Gate gong: a deep gong. Partials bloom in over the first moments (gongs swell after the strike) and decay,
// lower ones lasting longest; pairs slightly detuned beat slowly. A soft mallet thud starts it.
function gong() {
  const len = Math.round(7.5 * RATE), out = new Float32Array(len), f0 = 49;
  const partials = [
    [1.0, 1.0, 6.5, 0.0], [1.008, 0.6, 6.0, 0.0], [1.52, 0.55, 4.5, 0.08], [2.03, 0.5, 3.8, 0.12], [2.36, 0.35, 3.0, 0.15],
    [2.71, 0.38, 2.6, 0.2], [3.29, 0.26, 2.0, 0.25], [4.13, 0.2, 1.5, 0.3], [5.2, 0.12, 1.1, 0.35], [6.6, 0.07, 0.8, 0.4]
  ];
  for (const [ratio, amp, decay, bloom] of partials) {
    const ph = rnd() * Math.PI * 2;
    for (let i = 0; i < len; i++) {
      const t = i / RATE;
      const env = (1 - Math.exp(-t / (0.02 + bloom))) * Math.exp(-t / decay);
      const glide = 1 + 0.015 * Math.exp(-t / 0.6); // the pitch settles slightly after the strike
      out[i] += amp * env * Math.sin(2 * Math.PI * f0 * ratio * glide * t + ph);
    }
  }
  // Mallet: a short low-passed thud.
  const lp = biquad("lp", 180, 0.7);
  for (let i = 0; i < 0.12 * RATE; i++) out[i] += lp(noise()) * 2.2 * Math.exp(-i / (0.03 * RATE));
  const fadeN = Math.round(1.0 * RATE);
  for (let i = 0; i < fadeN; i++) out[len - 1 - i] *= i / fadeN;
  return reverb(out, 0.35, 0.45);
}

// Hearth: a low roar (filtered noise, gently breathing) plus crackles (short bright clicks) and the odd pop.
function hearth() {
  const len = 8 * RATE, roar = new Float32Array(len), crack = new Float32Array(len);
  for (let i = 0; i < len; i++) roar[i] = noise();
  const r = loopFilter(roar, () => { const a = biquad("lp", 380, 0.6), b = biquad("hp", 60, 0.7); return x => b(a(x)); });
  for (let i = 0; i < len; i++) r[i] *= 0.55 + 0.25 * Math.sin(2 * Math.PI * 3 * i / len) + 0.12 * Math.sin(2 * Math.PI * 7 * i / len + 1);
  // Crackles: random bursts, placed around the loop (wrapping at the end, so the seam is clean).
  for (let k = 0; k < 140; k++) {
    const at = Math.floor(rnd() * len), size = 0.15 + rnd() * 0.85, dur = Math.floor((0.002 + rnd() * 0.012) * RATE);
    const bp = biquad("bp", 1800 + rnd() * 4000, 1.2);
    for (let j = 0; j < dur * 4; j++) crack[(at + j) % len] += bp(noise()) * size * Math.exp(-j / dur);
  }
  for (let k = 0; k < 10; k++) { // pops: lower and fuller
    const at = Math.floor(rnd() * len), dur = Math.floor(0.02 * RATE), bp = biquad("bp", 500 + rnd() * 500, 1.5);
    for (let j = 0; j < dur * 5; j++) crack[(at + j) % len] += bp(noise()) * 2.5 * Math.exp(-j / dur);
  }
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = r[i] * 0.7 + crack[i] * 1.6;
  return farAway(out);
}
// Puts a loop at a distance in a stone hall: the highs soften (crackles lose their bite), and a long, dark echo
// (feedback delays) carries most of it. Everything wraps round the loop, so it stays seamless.
function farAway(x) {
  const len = x.length;
  const dry = loopFilter(x, () => { const a = biquad("lp", 2600, 0.7), b = biquad("lp", 4200, 0.7); return v => b(a(v)); });
  const wet = new Float32Array(len);
  for (const [ms, g] of [[89, 0.62], [131, 0.6], [173, 0.58], [227, 0.55], [293, 0.52], [367, 0.48]]) {
    const d = Math.round(ms * RATE / 1000), buf = new Float32Array(len);
    // Feedback around the loop: three laps, so the tail that runs past the end comes back in at the start.
    for (let lap = 0; lap < 3; lap++) for (let i = 0; i < len; i++) buf[i] = dry[i] + buf[(i - d + len) % len] * g;
    for (let i = 0; i < len; i++) wet[i] += buf[i] / 6;
  }
  const dark = loopFilter(wet, () => { const a = biquad("lp", 1500, 0.7), b = biquad("hp", 90, 0.7); return v => b(a(v)); });
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = dry[i] * 0.45 + dark[i] * 0.9;
  return out;
}

// Distant bell: a church-like bell (hum, prime, minor third, fifth, octave partials), muffled by distance
// (low-passed) with a long reverb tail.
function distantBell() {
  const len = Math.round(7 * RATE), out = new Float32Array(len), f = 174.6; // F3
  const partials = [[0.5, 0.8, 4.5], [1, 1.0, 3.5], [1.2, 0.6, 2.6], [1.5, 0.45, 2.0], [2, 0.5, 1.6], [2.5, 0.25, 1.1], [3, 0.2, 0.8]];
  for (const [ratio, amp, decay] of partials) {
    const ph = rnd() * Math.PI * 2;
    for (let i = 0; i < len; i++) { const t = i / RATE; out[i] += amp * Math.exp(-t / decay) * (1 - Math.exp(-t / 0.004)) * Math.sin(2 * Math.PI * f * ratio * t + ph); }
  }
  const lp = biquad("lp", 900, 0.7);
  for (let i = 0; i < len; i++) out[i] = lp(out[i]);
  const fadeN = Math.round(1.5 * RATE);
  for (let i = 0; i < fadeN; i++) out[len - 1 - i] *= i / fadeN;
  return reverb(out, 0.9, 0.6);
}

fs.mkdirSync(OUT, { recursive: true });
writeWav(path.join(OUT, "gate_gong.wav"), gong(), -1);
writeWav(path.join(OUT, "hearth_loop.wav"), hearth(), -3);
writeWav(path.join(OUT, "distant_bell.wav"), distantBell(), -3);
