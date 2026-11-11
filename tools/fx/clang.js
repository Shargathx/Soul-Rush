// Deflect clang: a loud, bright steel-on-steel hit for a perfect deflect, synthesized from scratch
// (deterministic: the same file every run). 16-bit mono WAV, 44.1 kHz, in assets/Sfx.
//
//   node tools/fx/clang.js         -> every variant in VARIANTS
//   node tools/fx/clang.js A       -> just variant A
//
// The sound, in layers (all summed, then soft-clipped for loudness and normalized):
//   1. crack  - a 3 ms broadband click: the instant of contact.
//   2. thump  - a short low body hit (a falling ~170 Hz sine), so it has weight, not just ring.
//   3. ring   - the blade itself: inharmonic partials of a struck steel bar (free-free beam ratios
//               1 : 2.756 : 5.404 : 8.933), each a slightly detuned pair so they beat and shimmer.
//               Low partials ring long, high ones die fast. The pitch dips a few percent at the hit and settles.
//   4. ting   - a bright, high "kiiin" partial that rings over the top, the part you hear across the arena.
//   5. shing  - band-passed noise (3-9 kHz) that flares and dies in ~150 ms: the scrape of edge on edge.
//   6. air    - a short, quiet early-reflection tail so it sits in a space instead of being bone-dry.
const fs = require("fs");
const path = require("path");
const RATE = 44100;
const OUT = path.join(__dirname, "../../assets/Sfx");

// Settings per variant; anything left out uses DEFAULTS (which are variant A).
//   f0: the blade's lowest partial (Hz); the others follow the bar ratios. ringDecay: multiplies every partial's decay.
//   ting: the high ring (Hz); ting2: an optional second high ring (a second blade), 0 for none.
//   thump: [from Hz, to Hz, level, decay s]. shing: [band centre Hz, level, high-pass Hz]. length: seconds.
const DEFAULTS = { f0: 610, ringDecay: 1, ting: 3150, ting2: 0, thump: [220, 150, 0.55, 0.035], shing: [5200, 0.9, 2800], length: 1.5 };
const VARIANTS = {
  A: { seed: 11, file: "deflect_clang_A.wav" },
  // B, low: a heavy, dark blade and a deep, booming body hit that drops into the sub-bass. A short ring.
  B: { seed: 23, f0: 270, ringDecay: 0.8, ting: 1550, thump: [150, 55, 1.6, 0.11], shing: [3200, 0.5, 1700], length: 1.2, file: "deflect_clang_B.wav" },
  // C, high: steel on steel. Two bright blades ringing against each other, a sharp scrape, little body. A short ring.
  C: { seed: 37, f0: 1330, ringDecay: 0.5, ting: 5300, ting2: 7150, thump: [320, 250, 0.25, 0.02], shing: [7800, 1.1, 4200], length: 1.0, file: "deflect_clang_C.wav" },
};

function writeWav(file, samples, peakDb) {
  let peak = 0; for (const v of samples) peak = Math.max(peak, Math.abs(v));
  const gain = Math.pow(10, peakDb / 20) / (peak || 1);
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * gain * 32767))), 44 + i * 2);
  fs.writeFileSync(file, b);
  console.log(path.relative(process.cwd(), file), (samples.length / RATE).toFixed(2) + " s", (b.length / 1024).toFixed(0) + " KB");
}
// RBJ biquad: "lp", "hp" or "bp".
function biquad(type, f, q) {
  const w = 2 * Math.PI * f / RATE, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else { b0 = a; b1 = 0; b2 = -a; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}

function clang(variant) {
  const v = Object.assign({}, DEFAULTS, variant);
  let seed = v.seed;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const noise = () => rnd() * 2 - 1;
  const n = Math.round(v.length * RATE), out = new Float32Array(n);

  // 1. Crack.
  const crackHp = biquad("hp", 1800, 0.7);
  for (let i = 0; i < 0.004 * RATE; i++) { const t = i / RATE; out[i] += 1.3 * crackHp(noise()) * Math.exp(-t / 0.0012); }

  // 2. Thump: a sine falling from thump[0] to thump[1] Hz over about 60 ms.
  const [thFrom, thTo, thLevel, thDecay] = v.thump;
  let ph = 0;
  for (let i = 0; i < Math.max(0.12, thDecay * 3.4) * RATE; i++) {
    const t = i / RATE, f = thTo + (thFrom - thTo) * Math.exp(-t / 0.02);
    ph += 2 * Math.PI * f / RATE; out[i] += thLevel * Math.sin(ph) * Math.exp(-t / thDecay) * Math.min(1, t / 0.001);
  }

  // 3. Ring: struck-bar partials, each a detuned pair. [ratio, level, decay seconds]
  const modes = [[1, 0.55, 0.9], [2.756, 0.75, 0.55], [5.404, 0.5, 0.3], [8.933, 0.3, 0.16], [13.34, 0.16, 0.08]];
  for (const [ratio, level, decay] of modes) {
    const f = v.f0 * ratio; if (f > RATE * 0.45) continue;
    for (const [detune, pairLevel] of [[-1, 1], [1, 0.45]]) { // Unequal, so the beating shimmers instead of pumping.
      const fd = f + detune * (1.5 + ratio * 0.6), start = rnd() * Math.PI * 2; let p = start;
      for (let i = 0; i < n; i++) {
        const t = i / RATE, bend = 1 + 0.035 * Math.exp(-t / 0.012); // The pitch dips at the hit, then settles.
        p += 2 * Math.PI * fd * bend / RATE;
        out[i] += 0.32 * level * pairLevel * Math.sin(p) * Math.exp(-t / (decay * v.ringDecay)) * Math.min(1, t / 0.0006);
      }
    }
  }

  // 4. Ting: the high ring over the top, with a slow shimmer.
  // A second ring (ting2) is a second blade: a little quieter, shorter, shimmering at its own rate.
  for (const [freq, level, decay, wobble] of [[v.ting, 0.3, 0.45, 6.5], [v.ting2, 0.22, 0.3, 9.1]]) {
    if (!freq) continue;
    let pt = 0;
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      pt += 2 * Math.PI * freq * (1 + 0.02 * Math.exp(-t / 0.01)) / RATE;
      out[i] += level * Math.sin(pt) * (0.85 + 0.15 * Math.sin(2 * Math.PI * wobble * t)) * Math.exp(-t / (decay * v.ringDecay)) * Math.min(1, t / 0.002);
    }
  }

  // 5. Shing: the edge scrape, band-passed around shing[0] Hz.
  const s1 = biquad("bp", v.shing[0], 0.9), s2 = biquad("hp", v.shing[2], 0.7);
  for (let i = 0; i < 0.25 * RATE; i++) {
    const t = i / RATE, env = Math.min(1, t / 0.003) * Math.exp(-t / 0.05);
    out[i] += v.shing[1] * s2(s1(noise())) * env;
  }

  // 6. Air: a few quiet, darkened echoes (a stone hall's early reflections).
  const dry = Float32Array.from(out), lp = biquad("lp", 4500, 0.7);
  const taps = [[0.023, 0.22], [0.041, 0.16], [0.067, 0.11], [0.097, 0.07], [0.131, 0.045]];
  for (let i = 0; i < n; i++) {
    let w = 0; for (const [d, g] of taps) { const j = i - Math.round(d * RATE); if (j >= 0) w += dry[j] * g; }
    out[i] += lp(w);
  }

  // Loudness: a soft clip on the first 80 ms only, so the hit itself is dense and loud while the ring
  // keeps its natural decay. Then a short fade at the very end.
  for (let i = 0; i < n; i++) {
    const drive = 1 + 1.5 * Math.exp(-(i / RATE) / 0.08);
    out[i] = Math.tanh(out[i] * drive) / Math.tanh(drive) * Math.min(1, drive);
  }
  const fade = Math.round(0.08 * RATE);
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;
  return out;
}

const pick = process.argv[2];
for (const id of Object.keys(VARIANTS)) if (!pick || pick === id) writeWav(path.join(OUT, VARIANTS[id].file), clang(VARIANTS[id]), -0.5);
