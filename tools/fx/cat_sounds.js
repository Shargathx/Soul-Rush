// Synthesizes the Cat's voice as 16-bit mono WAVs in assets/Sfx/cat (deterministic: the same files every run).
//   meow_1..4: a pitched voice (a buzzy source through two sweeping vowel formants, "mee" opening to "ow") with vibrato, breath
//              and a pitch that rises then sags; the four differ in pitch, length and shape. Played on pounces and dashes.
//   hiss_1..3: filtered noise with a ragged envelope and a low rasp under it. Played at the hiss, the feints and the comeback.
// Usage: node tools/fx/cat_sounds.js, then node tools/bosses/build.js cat (registers the files).
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "..", "assets", "Sfx", "cat");
const RATE = 32000;

let seed = 99;
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
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, b);
  console.log(path.relative(process.cwd(), file), (samples.length / RATE).toFixed(2) + " s");
}
// A band-pass biquad whose centre can move: set(f, q) between samples.
function bandpass() {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0 = 0, b2 = 0, a1 = 0, a2 = 0, a0 = 1;
  return {
    set(f, q) { const w = 2 * Math.PI * f / RATE, c = Math.cos(w), a = Math.sin(w) / (2 * q); b0 = a; b2 = -a; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; },
    run(x) { const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }
  };
}
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);

function meow(len, base, peak, mouth) {
  const n = Math.floor(RATE * len), out = new Float32Array(n), f1 = bandpass(), f2 = bandpass(), f3 = bandpass(), air = bandpass();
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n, sec = i / RATE;
    // Pitch: up to a peak early on, then sagging, with a little vibrato late in the note.
    const contour = t < 0.35 ? lerp(base, peak, smooth(t / 0.35)) : lerp(peak, base * 0.85, smooth((t - 0.35) / 0.65));
    const f0 = contour * (1 + 0.025 * Math.sin(sec * 38) * smooth(Math.min(1, t * 2)));
    phase += f0 / RATE; phase -= Math.floor(phase);
    const src = (2 * phase - 1) * 0.8 + (phase < 0.12 ? 0.6 : 0);   // a sawtooth with a sharp edge: buzzy like a voice
    // Vowels: "ee" (F1 low, F2 high) opening to "ow" (F1 high, F2 low).
    const open = smooth(Math.min(1, t / mouth));
    f1.set(lerp(330, 760, open), 5); f2.set(lerp(2500, 1150, open), 6); f3.set(3300, 8); air.set(4500, 1.2);
    const env = Math.min(1, t / 0.06) * Math.pow(1 - t, 0.7) * (t > 0.9 ? (1 - t) / 0.1 : 1);
    out[i] = (f1.run(src) * 1.0 + f2.run(src) * 0.55 + f3.run(src) * 0.2 + air.run(noise()) * 0.12) * env;
  }
  return out;
}
function hiss(len, centre, rasp) {
  const n = Math.floor(RATE * len), out = new Float32Array(n), a = bandpass(), b = bandpass(), low = bandpass();
  let slow = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n; slow += (noise() - slow) * 0.002;
    a.set(centre * lerp(0.85, 1.1, t), 1.4); b.set(centre * 1.7, 1.0); low.set(180, 2);
    // A ragged envelope: a sharp rise, a hold with flutter, a long fall.
    const env = Math.min(1, t / 0.05) * Math.pow(1 - t, 1.3) * (0.75 + 0.25 * Math.sin(t * 60 + slow * 40));
    out[i] = (a.run(noise()) * 1.0 + b.run(noise()) * 0.5 + low.run(noise()) * rasp) * env;
  }
  return out;
}

[[0.62, 520, 820, 0.35], [0.85, 460, 700, 0.5], [0.5, 600, 960, 0.3], [1.0, 420, 640, 0.6]].forEach(([len, base, peak, mouth], k) => writeWav(path.join(OUT, "meow_" + (k + 1) + ".wav"), meow(len, base, peak, mouth), -6));
[[0.7, 6500, 0.4], [1.0, 5500, 0.6], [0.55, 7200, 0.3]].forEach(([len, c, r], k) => writeWav(path.join(OUT, "hiss_" + (k + 1) + ".wav"), hiss(len, c, r), -9));
