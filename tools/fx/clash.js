// Deflect clash: the second, denser model for the deflect sound, built to match measurements of
// Souls-style deflect hits (not their audio): the hit jumps to full level and HOLDS a loud, dense plateau for
// ~60-100 ms, then fades over ~300 ms; at the hit, energy is broadband (lows, mids and highs all present);
// the ring is a dense cluster of many close, inharmonic metal tones (not a few clean ones) that fades out in its band.
// 16-bit stereo WAV, 44.1 kHz, in assets/Sfx. Deterministic: the same files every run.
//
//   node tools/fx/clash.js         -> every variant in VARIANTS
//   node tools/fx/clash.js mid     -> just one
//
// Layers, per channel (left and right get their own random tones and reflections, for width):
//   burst - the strike: a short noise burst that holds for `hold` seconds, then dies. It is the "plateau".
//   ring  - `modes` metal tones spread between ring[0] and ring[1] Hz, loudest near ring[2] Hz, each with its own
//           decay around `ringDecay`. Struck together they read as one dense, shimmering clang.
//   thud  - the low impact: a sine sweeping down from thud[0] to thud[1] Hz plus low noise, level thud[2].
//   body  - low-mid weight: band-passed noise and a few wooden-ish tones around body[0] Hz, level body[1].
//   air   - the bright edge: high-passed noise above 5 kHz, level `air`.
//   room  - a few early reflections, different per side.
// Then a smooth compressor holds the first ~100 ms dense and level (the plateau), and the peak is normalized.
const fs = require("fs");
const path = require("path");
const RATE = 44100;
const OUT = path.join(__dirname, "../../assets/Sfx");

const VARIANTS = {
  // The reference's typical hit: ring centred around 3.5 kHz.
  mid: { seed: 5, ring: [1700, 5200, 3400], modes: 26, ringDecay: 0.055, hold: 0.06, thud: [150, 70, 0.75], body: [520, 0.9], air: 0.5, length: 0.42 },
  // Lower and heavier: ring centred around 2 kHz, more thud and body.
  low: { seed: 9, ring: [1100, 3600, 2050], modes: 24, ringDecay: 0.065, hold: 0.07, thud: [130, 60, 1.0], body: [400, 1.2], air: 0.3, length: 0.45 },
  // Higher and brighter: ring centred around 5.5 kHz, a bright edge, less low end.
  high: { seed: 13, ring: [3000, 8500, 5500], modes: 28, ringDecay: 0.05, hold: 0.05, thud: [180, 90, 0.45], body: [700, 0.7], air: 0.9, length: 0.38 },
};

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
  console.log(path.relative(process.cwd(), file), (len / RATE).toFixed(2) + " s", (b.length / 1024).toFixed(0) + " KB");
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

function channel(v, seed, taps) {
  const rnd = (() => { let s = seed; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })();
  const noise = () => rnd() * 2 - 1;
  const n = Math.round(v.length * RATE), out = new Float32Array(n);
  // The strike's envelope: in over 1.5 ms, flat for `hold`, then a fast fall.
  const strike = t => Math.min(1, t / 0.0015) * (t < v.hold ? 1 : Math.exp(-(t - v.hold) / 0.02));

  // burst: broadband, slightly darkened noise.
  { const lp = biquad("lp", 9000, 0.7), hp = biquad("hp", 120, 0.7);
    for (let i = 0; i < n; i++) { const t = i / RATE, e = strike(t); if (e < 1e-4 && t > v.hold) break; out[i] += 0.5 * e * hp(lp(noise())); } }

  // ring: a dense cluster of inharmonic metal tones, log-spread in the band, weighted towards the centre.
  { const [lo, hi, centre] = v.ring;
    for (let m = 0; m < v.modes; m++) {
      const f = lo * Math.pow(hi / lo, rnd());
      const w = Math.exp(-Math.pow(Math.log(f / centre) / 0.45, 2));             // Loudest near the centre.
      const decay = v.ringDecay * (0.6 + rnd() * 0.9) * Math.pow(centre / f, 0.3); // Higher tones die a little faster.
      const amp = (0.25 + 0.75 * w) * (0.5 + rnd() * 0.5), ph0 = rnd() * 6.283;
      let p = ph0;
      for (let i = 0; i < n; i++) {
        const t = i / RATE, bend = 1 + 0.01 * Math.exp(-t / 0.01);              // A touch of pitch drop at the hit.
        p += 2 * Math.PI * f * bend / RATE;
        // Excited through the whole strike: full while it holds, then free decay.
        const e = Math.min(1, t / 0.001) * (t < v.hold ? 1 : Math.exp(-(t - v.hold) / decay));
        out[i] += 0.11 * amp * e * Math.sin(p);
      }
    }
  }

  // thud: a low sweep plus low noise, gone in ~80 ms.
  { const [from, to, level] = v.thud, lp = biquad("lp", 260, 0.8); let p = 0;
    for (let i = 0; i < 0.25 * RATE && i < n; i++) {
      const t = i / RATE, f = to + (from - to) * Math.exp(-t / 0.025);
      p += 2 * Math.PI * f / RATE;
      const e = Math.min(1, t / 0.002) * Math.exp(-t / 0.045);
      out[i] += level * e * (0.6 * Math.sin(p) + 1.4 * lp(noise()));
    } }

  // body: low-mid weight.
  { const [f0, level] = v.body, bp = biquad("bp", f0, 0.9);
    const tones = [0.78, 1, 1.31, 1.62].map(r => [f0 * r * (0.97 + rnd() * 0.06), rnd() * 6.283]);
    for (let i = 0; i < 0.3 * RATE && i < n; i++) {
      const t = i / RATE, e = Math.min(1, t / 0.0015) * (t < v.hold ? 1 : Math.exp(-(t - v.hold) / 0.035));
      let s = 2.2 * bp(noise());
      for (const tn of tones) s += 0.12 * Math.sin(tn[1] + 2 * Math.PI * tn[0] * t);
      out[i] += level * e * s;
    } }

  // air: the bright edge.
  { const hp = biquad("hp", 5000, 0.7);
    for (let i = 0; i < 0.2 * RATE && i < n; i++) { const t = i / RATE; out[i] += v.air * 0.6 * hp(noise()) * Math.min(1, t / 0.001) * Math.exp(-t / 0.03); } }

  // room: early reflections, darkened.
  { const dry = Float32Array.from(out), lp = biquad("lp", 5000, 0.7);
    for (let i = 0; i < n; i++) { let w = 0; for (const [d, g] of taps) { const j = i - Math.round(d * RATE); if (j >= 0) w += dry[j] * g; } out[i] += lp(w); } }
  return out;
}

function clash(v) {
  // Mostly one shared sound in the centre, plus a small difference pushed left and right (`width`), so the
  // image is a little wide, like the reference (side about 14 dB under mid), not two unrelated sounds.
  const core = channel(v, v.seed * 7919 + 1, [[0.017, 0.2], [0.033, 0.14], [0.061, 0.09], [0.091, 0.05]]);
  const diff = channel(v, v.seed * 7919 + 2, [[0.023, 0.2], [0.041, 0.14], [0.053, 0.09], [0.103, 0.05]]);
  const k = v.width || 0.2;
  const chans = [core.map((x, i) => x + k * diff[i]), core.map((x, i) => x - k * diff[i])];
  // Compressor: follow the louder side's level (fast attack, short release) and pull peaks down smoothly and
  // firmly, so the strike sits as a dense, level plateau instead of a spike. Same gain on both sides.
  const n = chans[0].length, att = Math.exp(-1 / (0.0005 * RATE)), rel = Math.exp(-1 / (0.04 * RATE));
  let env = 0, peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(chans[0][i]), Math.abs(chans[1][i]));
  const thresh = peak * 0.15, ratio = 8;
  for (let i = 0; i < n; i++) {
    const x = Math.max(Math.abs(chans[0][i]), Math.abs(chans[1][i]));
    env = x > env ? att * env + (1 - att) * x : rel * env + (1 - rel) * x;
    const g = env > thresh ? Math.pow(env / thresh, 1 / ratio - 1) : 1;
    chans[0][i] *= g; chans[1][i] *= g;
  }
  // A gentle soft clip for the last bit of density, then a short fade at the end.
  const fade = Math.round(0.06 * RATE);
  for (const ch of chans) {
    let p = 0; for (const x of ch) p = Math.max(p, Math.abs(x));
    for (let i = 0; i < n; i++) ch[i] = Math.tanh(1.5 * ch[i] / p) / Math.tanh(1.5);
    for (let i = 0; i < fade; i++) ch[n - 1 - i] *= i / fade;
  }
  return chans;
}

// Echo: the finished dry clash in a stone hall. Two quick echoes that bounce left then right (slap, at e.slap
// seconds apart), then a dark reverb tail (Freeverb-style: 8 damped combs into 4 all-passes per side, the right
// side's delays a little longer for width) of about e.tail seconds. e.mix is the wet level against the dry hit.
const ECHO = { mix: 0.45, slap: 0.13, tail: 1.3, damp: 0.45 };
function echo(dry, e) {
  const n = dry[0].length + Math.round(e.tail * RATE), out = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) out[c].set(dry[c]);
  // Feedback from the tail length: the combs fall 60 dB in about e.tail seconds.
  const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], ALLPASS = [556, 441, 341, 225];
  for (let c = 0; c < 2; c++) {
    const spread = c ? 23 : 0, wet = new Float32Array(n), mono = i => i < dry[0].length ? (dry[0][i] + dry[1][i]) * 0.5 : 0;
    for (const d0 of COMBS) {
      const d = d0 + spread, buf = new Float32Array(d), fb = Math.pow(10, -3 * d / (e.tail * RATE));
      let idx = 0, store = 0;
      for (let i = 0; i < n; i++) {
        const y = buf[idx]; store = y * (1 - e.damp) + store * e.damp;
        buf[idx] = mono(i) * 0.1 + store * fb; idx = (idx + 1) % d; wet[i] += y;
      }
    }
    for (const d0 of ALLPASS) {
      const d = d0 + spread, buf = new Float32Array(d); let idx = 0;
      for (let i = 0; i < n; i++) { const b = buf[idx], x = wet[i]; wet[i] = b - x; buf[idx] = x + b * 0.5; idx = (idx + 1) % d; }
    }
    // The slap echoes: left at 1x, right at 2x the delay, each quieter and darker.
    const lp = biquad("lp", 3500, 0.7), delay = Math.round(e.slap * RATE * (c + 1)), gain = c ? 0.32 : 0.5;
    for (let i = 0; i < n; i++) {
      const j = i - delay; const s = j >= 0 && j < dry[c].length ? dry[c][j] : 0;
      out[c][i] += e.mix * (wet[i] + gain / e.mix * lp(s));
    }
  }
  const fade = Math.round(0.15 * RATE);
  for (const ch of out) for (let i = 0; i < fade; i++) ch[n - 1 - i] *= i / fade;
  return out;
}

const pick = process.argv[2];
for (const id of Object.keys(VARIANTS)) if (!pick || pick === id) {
  const dry = clash(VARIANTS[id]);
  writeWav(path.join(OUT, "deflect_clash_" + id + ".wav"), dry, -0.5);
  writeWav(path.join(OUT, "deflect_clash_" + id + "_echo.wav"), echo(dry, ECHO), -0.5); // Test: the same hit with echo.
}
