// Cuts the torii crows' caws from a real recording: the user's "crow-sound-effect-hd" MP3 (Downloads, 10.8 s,
// three crows). Each clip is two caws in a row, with the room tail kept and a short fade at each end.
// 16-bit stereo WAV, 44.1 kHz, in assets/Sfx/hub.
//
// Node can't decode MP3, so the recording is first decoded (in a browser, with WebAudio) to raw interleaved stereo
// float32 at 44.1 kHz, then:  node tools/fx/crow_cut.js <pcm.bin>
//
// Caw onsets in the recording (s): a close crow 0.71, 1.36, 2.01, 2.76; a distant one 4.12, 4.72, 5.34;
// a third voice 6.79, 7.32, 8.00. A clip ends just before the next caw, or where its tail has died away.
const fs = require("fs");
const path = require("path");
const RATE = 44100;
const OUT = path.join(__dirname, "../../assets/Sfx/hub");

// [first caw onset, end] in seconds, and the peak level (dB) the clip is set to: the distant crow stays quieter.
const CLIPS = {
  1: { from: 0.71, to: 1.98, peak: -1 },   // Close crow, caws 1 and 2.
  2: { from: 1.36, to: 2.73, peak: -1 },   // Close crow, caws 2 and 3.
  3: { from: 2.01, to: 3.6, peak: -1 },    // Close crow, caws 3 and 4, and its tail.
  4: { from: 4.12, to: 5.31, peak: -6 },   // The distant crow.
  5: { from: 6.79, to: 7.97, peak: -2 },   // Third voice, caws 1 and 2.
  6: { from: 7.32, to: 8.9, peak: -2 },    // Third voice, caws 2 and 3, and its tail.
};
const PRE = 0.03, FADE_IN = 0.005, FADE_OUT = 0.08;

const raw = fs.readFileSync(process.argv[2]);
const pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
const total = pcm.length / 2;

function writeWav(file, L, R, peakDb) {
  const len = L.length, bytes = len * 4;
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const gain = Math.pow(10, peakDb / 20) / (peak || 1);
  const b = Buffer.alloc(44 + bytes);
  b.write("RIFF", 0); b.writeUInt32LE(36 + bytes, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(RATE, 24); b.writeUInt32LE(RATE * 4, 28);
  b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(bytes, 40);
  for (let i = 0; i < len; i++) {
    b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * gain * 32767))), 44 + i * 4);
    b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * gain * 32767))), 46 + i * 4);
  }
  fs.writeFileSync(file, b);
  console.log(path.relative(process.cwd(), file), (len / RATE).toFixed(2) + " s");
}

for (const [id, c] of Object.entries(CLIPS)) {
  const a = Math.floor((c.from - PRE) * RATE), z = Math.min(total, Math.floor(c.to * RATE)), len = z - a;
  const L = new Float32Array(len), R = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / RATE, left = (len - i) / RATE;
    const g = Math.min(1, t / FADE_IN) * Math.min(1, left / FADE_OUT);
    L[i] = pcm[2 * (a + i)] * g; R[i] = pcm[2 * (a + i) + 1] * g;
  }
  writeWav(path.join(OUT, "crow_caw_" + id + ".wav"), L, R, c.peak);
}
