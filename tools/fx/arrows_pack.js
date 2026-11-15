// Cuts the user's arrow sound pack (assets/Sfx/arrows/source/*.mp3) into the Leaf Ranger's sounds, with variations,
// as 16-bit stereo 48 kHz WAVs in assets/Sfx/arrows.
//
// Node can't decode MP3, so each source is first decoded (in a browser, with WebAudio, at 48 kHz) to raw interleaved
// stereo float32 named <source>.mp3.pcm in one folder, then:  node tools/fx/arrows_pack.js <that folder>
//
// Every source starts with 40-120 ms of silence, which would make it late against the animation; cuts start just
// before the sound does. arrow_release and arrow_impact also swell for ~0.4 s before their peak, which would put the
// twang or thunk 0.4 s after the release frame or the landing, so their cuts start just before the peak (SWELL_SKIP).
// Pitch changes resample (a lower pitch is also a little longer); "warm" adds low end.
//   draw_1..3    - the string being pulled, three 0.5 s pieces of arrow_draw. The shot animation reaches its release
//                  frame 0.56 s after it starts, so a draw played at the start ends just as the arrow goes.
//   release_1..4 - arrow_release (the twang, then the arrow's whoosh): as is, higher, lower and warmer, and shorter.
//   whistle_1..3 - arrow_whistle without the low thump at its end: as is, lower, higher.
//   land_1..5    - single arrows biting into ground or wood: arrow_impact, _2 and _3, plus two pitched versions.
//   rain_1..4    - a shower of arrows landing: multi_impact_arrow, and three 1.2 s stretches of multi_impact_arrow_LONG.
const fs = require("fs");
const path = require("path");
const R = 48000;
const SRC = process.argv[2];
const SWELL_SKIP = { release: 0.26, impact: 0.12 }; // Seconds of the slow swell cut off the front.
const OUT = path.join(__dirname, "..", "..", "assets", "Sfx", "arrows");

const load = name => {
  const b = fs.readFileSync(path.join(SRC, name + ".mp3.pcm"));
  const p = new Float32Array(b.buffer, b.byteOffset, b.length / 4), n = p.length / 2;
  const L = new Float32Array(n), Rt = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = p[2 * i]; Rt[i] = p[2 * i + 1]; }
  return [L, Rt];
};
// Where the sound starts: the first sample within 40 dB of the peak, less 5 ms.
const onset = ch => {
  let pk = 0; for (const c of ch) for (const v of c) pk = Math.max(pk, Math.abs(v));
  const th = pk * 0.01;
  for (let i = 0; i < ch[0].length; i++) if (Math.abs(ch[0][i]) > th || Math.abs(ch[1][i]) > th) return Math.max(0, i - Math.round(0.005 * R)) / R;
  return 0;
};
// A piece [from, to) seconds (to = null: the end), with short fades so it never clicks.
const cut = (ch, from, to, fadeIn, fadeOut) => ch.map(c => {
  const i0 = Math.round(from * R), i1 = to == null ? c.length : Math.min(c.length, Math.round(to * R)), out = c.slice(i0, i1), n = out.length;
  for (let i = 0; i < n; i++) out[i] *= Math.min(1, i / (fadeIn * R + 1)) * Math.min(1, (n - i) / (fadeOut * R + 1));
  return out;
});
// Pitch by resampling (linear interpolation): 1.06 = 6% higher and shorter.
const pitch = (ch, k) => ch.map(c => {
  const n = Math.floor(c.length / k), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * k, j = Math.floor(x), f = x - j; out[i] = (c[j] || 0) * (1 - f) + (c[j + 1] || 0) * f; }
  return out;
});
// Warm: adds a low-passed copy (below about 250 Hz) for weight.
const warm = (ch, g) => ch.map(c => {
  const a = Math.exp(-2 * Math.PI * 250 / R); let y = 0; const out = Float32Array.from(c);
  for (let i = 0; i < c.length; i++) { y = (1 - a) * c[i] + a * y; out[i] += y * g; }
  return out;
});
// The source minus its sub-bass after `from` s (the whistle's stray low thump at its end).
const dropLowAfter = (ch, from) => ch.map(c => {
  const a = Math.exp(-2 * Math.PI * 200 / R); let y = 0; const out = Float32Array.from(c);
  for (let i = 0; i < c.length; i++) { y = (1 - a) * c[i] + a * y; if (i / R >= from) out[i] -= y; }
  return out;
});
function writeWav(name, ch) {
  const n = ch[0].length, b = Buffer.alloc(44 + n * 4);
  let pk = 0; for (const c of ch) for (const v of c) pk = Math.max(pk, Math.abs(v));
  const g = Math.pow(10, -1 / 20) / (pk || 1);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 4, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22); b.writeUInt32LE(R, 24); b.writeUInt32LE(R * 4, 28);
  b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(ch[c][i] * g * 32767))), 44 + (i * 2 + c) * 2);
  fs.writeFileSync(path.join(OUT, name + ".wav"), b);
  console.log("assets/Sfx/arrows/" + name + ".wav", (n / R).toFixed(2) + " s");
}

fs.mkdirSync(OUT, { recursive: true });
// Draw: three pieces of the pull, each 0.5 s.
const draw = load("arrow_draw");
[[0.05, 0.55], [0.3, 0.8], [0.58, 1.08]].forEach(([a, z], k) => writeWav("draw_" + (k + 1), cut(draw, a, z, 0.03, 0.04)));
// Release.
const rel = load("arrow_release"), r0 = onset(rel) + SWELL_SKIP.release;
const relBase = cut(rel, r0, null, 0.01, 0.06);
writeWav("release_1", relBase);
writeWav("release_2", pitch(relBase, 1.06));
writeWav("release_3", warm(pitch(relBase, 0.94), 0.8));
writeWav("release_4", cut(rel, r0, r0 + 0.3, 0.01, 0.1));
// Whistle.
const wh = load("arrow_whistle"), w0 = onset(wh), whBase = dropLowAfter(cut(wh, w0, w0 + 0.32, 0.002, 0.06), 0.2);
writeWav("whistle_1", whBase);
writeWav("whistle_2", pitch(whBase, 0.93));
writeWav("whistle_3", pitch(whBase, 1.07));
// Single landings.
const lands = ["arrow_impact", "arrow_impact_2", "arrow_impact_3"].map(name => { const s = load(name), skip = name === "arrow_impact" ? SWELL_SKIP.impact : 0; return cut(s, onset(s) + skip, null, skip ? 0.01 : 0.002, 0.08); });
lands.forEach((s, k) => writeWav("land_" + (k + 1), s));
writeWav("land_4", warm(pitch(lands[1], 0.9), 0.5));
writeWav("land_5", pitch(lands[2], 1.08));
// Rain.
const multi = load("multi_impact_arrow");
writeWav("rain_1", cut(multi, onset(multi), null, 0.002, 0.15));
const long = load("multi_impact_arrow_LONG"), l0 = onset(long);
[[l0, l0 + 1.2], [1.3, 2.5], [2.45, 3.65]].forEach(([a, z], k) => writeWav("rain_" + (k + 2), cut(long, a, z, k ? 0.01 : 0.002, 0.15)));
