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
//   6. scrape - (optional) the blades grinding along each other for a moment after the hit: grainy stick-slip
//               friction (a burst of tiny catches, plus a little hiss) through a metallic resonance whose pitch
//               slides as the edges pass, and a narrow "singing" band at one of the blade's own partials.
//   7. body   - (optional) a low-mid "thwack": the weight of the hit, between the thump and the blade.
//   8. crunch - (optional) the attack driven into distortion and mixed back in: a real clash's saturated bite.
//   9. air    - a short, quiet early-reflection tail so it sits in a space instead of being bone-dry
//               (different on each side in stereo, for width).
const fs = require("fs");
const path = require("path");
const RATE = 44100;
const OUT = path.join(__dirname, "../../assets/Sfx");

// Settings per variant; anything left out uses DEFAULTS (which are variant A).
//   f0: the blade's lowest partial (Hz); the others follow the bar ratios. ringDecay: multiplies every partial's decay.
//   ting: the high ring (Hz); ting2: an optional second high ring (a second blade), 0 for none.
//   thump: [from Hz, to Hz, level, decay s]. shing: [band centre Hz, level, high-pass Hz]. length: seconds.
//   scrape: null for none, or { from, to (Hz the grind slides between), time (s), level, grains (catches per second) }.
//   body: null, or [resonance Hz, level, decay s]: the low-mid "thwack". crunch: level of the distorted attack (0 = none).
//   stereo: two channels with their own reflections. drive: how hard the first 80 ms are soft-clipped (default 1.5).
//   punch: 0 = the impact layers are clipped with the rest; otherwise they skip the clip and are added clean at this gain.
const DEFAULTS = { f0: 610, ringDecay: 1, ting: 3150, ting2: 0, thump: [220, 150, 0.55, 0.035], shing: [5200, 0.9, 2800], scrape: null,
  body: null, crunch: 0, stereo: false, drive: 1.5, punch: 0, length: 1.5 };
const VARIANTS = {
  A: { seed: 11, file: "deflect_clang_A.wav" },
  // B, low: a quick, heavy clash. A dark blade and a punchy, kick-like body hit that snaps down into the sub-bass.
  B: { seed: 23, f0: 270, ringDecay: 0.28, ting: 1550, thump: [200, 50, 2.2, 0.06], shing: [3200, 0.5, 1700],
    scrape: { from: 2600, to: 1500, time: 0.22, level: 1.3, grains: 210 },
    body: [140, 1.4, 0.03], crunch: 0.5, stereo: true, drive: 2.5, punch: 1.0, length: 0.55, file: "deflect_clang_B.wav" },
  // C, high: a quick steel-on-steel clash. Two bright blades, a sharp scrape, and a solid hit under them.
  C: { seed: 37, f0: 1650, ringDecay: 0.25, ting: 6600, ting2: 8800, thump: [230, 120, 1.1, 0.04], shing: [9000, 1.1, 4800],
    scrape: { from: 5400, to: 3300, time: 0.2, level: 2.2, grains: 330 },
    body: [240, 3.2, 0.03], crunch: 0.55, stereo: true, drive: 2.5, punch: 1.0, length: 0.45, file: "deflect_clang_C.wav" },
};

// chans: one Float32Array per channel (1 = mono, 2 = stereo), all the same length. Normalized together to peakDb.
function writeWav(file, chans, peakDb) {
  const C = chans.length, len = chans[0].length, bytes = len * C * 2;
  let peak = 0; for (const ch of chans) for (const v of ch) peak = Math.max(peak, Math.abs(v));
  const gain = Math.pow(10, peakDb / 20) / (peak || 1);
  const b = Buffer.alloc(44 + bytes);
  b.write("RIFF", 0); b.writeUInt32LE(36 + bytes, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(C, 22); b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 2 * C, 28);
  b.writeUInt16LE(2 * C, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(bytes, 40);
  for (let i = 0; i < len; i++) for (let c = 0; c < C; c++)
    b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(chans[c][i] * gain * 32767))), 44 + (i * C + c) * 2);
  fs.writeFileSync(file, b);
  console.log(path.relative(process.cwd(), file), (len / RATE).toFixed(2) + " s", C === 2 ? "stereo" : "mono", (b.length / 1024).toFixed(0) + " KB");
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
  // The impact layers (crack, thump, body) go in `hit`. With `punch` set, they skip the soft clip and are laid
  // on top afterwards, so the hit spikes above the ring instead of being flattened with it. Without, they share `out`.
  const hit = v.punch ? new Float32Array(n) : out;

  // 1. Crack.
  const crackHp = biquad("hp", 1800, 0.7);
  for (let i = 0; i < 0.004 * RATE; i++) { const t = i / RATE; hit[i] += 1.3 * crackHp(noise()) * Math.exp(-t / 0.0012); }

  // 2. Thump: a sine falling from thump[0] to thump[1] Hz over about 60 ms.
  const [thFrom, thTo, thLevel, thDecay] = v.thump;
  let ph = 0;
  for (let i = 0; i < Math.max(0.12, thDecay * 3.4) * RATE; i++) {
    const t = i / RATE, f = thTo + (thFrom - thTo) * Math.exp(-t / 0.02);
    ph += 2 * Math.PI * f / RATE; hit[i] += thLevel * Math.sin(ph) * Math.exp(-t / thDecay) * Math.min(1, t / 0.001);
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

  // 6. Scrape: the edges grinding past each other.
  if (v.scrape) {
    const sc = v.scrape, len = Math.round(sc.time * RATE);
    // Stick-slip grains: random catches (about `grains` per second), each a 1.5 ms decaying click, over a little hiss.
    const grain = new Float32Array(len);
    for (let i = 0; i < len; i += Math.max(1, Math.round(RATE / sc.grains * (0.4 + rnd() * 1.2)))) {
      const amp = 0.5 + rnd() * 0.5;
      for (let j = 0; j < 0.0015 * RATE && i + j < len; j++) grain[i + j] += amp * Math.exp(-j / (0.0005 * RATE));
    }
    // A band-pass whose centre slides from `from` to `to` (coefficients recomputed per sample), and a narrow
    // resonance at the blade's second partial that makes the grind ring like metal.
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    const sing = biquad("bp", v.f0 * 2.756, 18), hiss = biquad("hp", sc.to * 0.6, 0.7);
    for (let i = 0; i < len; i++) {
      const t = i / RATE, k = t / sc.time;
      const f = sc.from * Math.pow(sc.to / sc.from, k), w = 2 * Math.PI * f / RATE, a = Math.sin(w) / (2 * 4);
      const x = noise() * (0.25 + grain[i]);
      const y = (a * x - a * x2 + 2 * Math.cos(w) * y1 - (1 - a) * y2) / (1 + a);
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      // In over 6 ms, a few ms after contact; holds, then thins out to nothing by the end.
      const env = Math.min(1, Math.max(0, (t - 0.004) / 0.006)) * Math.pow(1 - k, 1.4);
      out[i] += sc.level * env * (2.2 * y + 0.35 * hiss(x) + 6 * sing(y));
    }
  }

  // 7. Body: the "thwack" of the hit, the weight between the thump and the blade. Noise through a low-mid
  //    resonance, in within 1 ms, gone in a few tens of ms.
  if (v.body) {
    const [bf, bl, bd] = v.body, r1 = biquad("bp", bf, 1.4), r2 = biquad("lp", bf * 2.5, 0.7);
    for (let i = 0; i < bd * 5 * RATE && i < n; i++) {
      const t = i / RATE; hit[i] += bl * 5 * r2(r1(noise())) * Math.min(1, t / 0.001) * Math.exp(-t / bd);
    }
  }

  // 8. Crunch: the first 70 ms of everything so far, band-passed into the upper mids and driven hard into
  //    distortion, mixed back in. Gives the attack the gritty, saturated bite of a real clash recording.
  if (v.crunch) {
    const cb = biquad("bp", 1400, 0.8), src = Float32Array.from(out.subarray(0, Math.round(0.07 * RATE)));
    if (hit !== out) for (let i = 0; i < src.length; i++) src[i] += hit[i];
    for (let i = 0; i < src.length; i++) out[i] += v.crunch * Math.tanh(cb(src[i]) * 10) * Math.exp(-(i / RATE) / 0.025);
  }

  // 9. Air: a few quiet, darkened echoes (a stone hall's early reflections). In stereo, each side gets its own
  //    set, so the hit sits in a space with width instead of dead centre.
  const air = (src, taps) => {
    const dry = Float32Array.from(src), ch = Float32Array.from(src), lp = biquad("lp", 4500, 0.7);
    for (let i = 0; i < n; i++) {
      let w = 0; for (const [d, g] of taps) { const j = i - Math.round(d * RATE); if (j >= 0) w += dry[j] * g; }
      ch[i] += lp(w);
    }
    return ch;
  };
  const TAPS = v.stereo
    ? [[[0.019, 0.26], [0.037, 0.17], [0.071, 0.11], [0.089, 0.07], [0.127, 0.045]],
       [[0.027, 0.26], [0.044, 0.17], [0.061, 0.11], [0.103, 0.07], [0.139, 0.045]]]
    : [[[0.023, 0.22], [0.041, 0.16], [0.067, 0.11], [0.097, 0.07], [0.131, 0.045]]];
  const chans = TAPS.map(t => air(out, t));
  const hits = hit !== out ? TAPS.map(t => air(hit, t)) : null;

  // Loudness: a soft clip on the first 80 ms only, so the hit itself is dense and loud while the ring
  // keeps its natural decay (`drive` sets how hard). Then a short fade at the very end.
  const hot = v.drive || 1.5;
  for (const [c, ch] of chans.entries()) {
    for (let i = 0; i < n; i++) {
      const drive = 1 + hot * Math.exp(-(i / RATE) / 0.08);
      ch[i] = Math.tanh(ch[i] * drive) / Math.tanh(drive) * Math.min(1, drive);
      if (hits) ch[i] += v.punch * hits[c][i]; // The impact, clean, on top.
    }
    const fade = Math.round(0.08 * RATE);
    for (let i = 0; i < fade; i++) ch[n - 1 - i] *= i / fade;
  }
  return chans;
}

const pick = process.argv[2];
for (const id of Object.keys(VARIANTS)) if (!pick || pick === id) writeWav(path.join(OUT, VARIANTS[id].file), clang(VARIANTS[id]), -0.5);
