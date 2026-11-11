// Converts the hub music (Cathedral of Shadows by mumusi_c21, CC BY 4.0) from the raw 24-bit WAVs in
// "assets (raw)/music/Cathedral of Shadows_mumusi_bgm" to the 16-bit files the game plays, in assets/Music.
//
//   node tools/hub/music.js
//
// The piece is 16 bars of 2.857 s (84 bpm). Its last bar fades almost to silence (about -37 dB, against -18 dB for
// the rest) and then the first bar swells straight back in, so every loop has an audible "here it starts again" dip,
// and the samples jump a little at the seam (a faint click). To hide it, bar 16 is crossfaded into bar 1 over the
// whole bar (equal power), so the dip is filled by bar 1 coming in and there is no hard edge:
//   loop  = [bar 16 fading out over bar 1 fading in] + bars 2..15     (15 bars, 42.9 s)
//   intro = the raw intro minus its first 4 s (near silence) and its last bar, so it ends after bar 15 and the
//           loop picks up exactly where bar 16 would have started.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
const RAW = path.join(ROOT, "assets (raw)", "music", "Cathedral of Shadows_mumusi_bgm");
const OUT = path.join(ROOT, "assets", "Music");
const TRIM_INTRO = 4; // Seconds of near silence cut from the intro's start, so the choir swells in at once.
const BARS = 16;

function readWav(file) {
  const b = fs.readFileSync(file);
  let o = 12, fmt, data;
  while (o < b.length) {
    const id = b.toString("ascii", o, o + 4), len = b.readUInt32LE(o + 4);
    if (id === "fmt ") fmt = { ch: b.readUInt16LE(o + 10), rate: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === "data") data = { off: o + 8, len };
    o += 8 + len + (len & 1);
  }
  const bps = fmt.bits / 8, n = Math.floor(data.len / (bps * fmt.ch)), ch = [];
  for (let c = 0; c < fmt.ch; c++) ch.push(new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < fmt.ch; c++) {
    const p = data.off + (i * fmt.ch + c) * bps;
    ch[c][i] = bps === 3 ? b.readIntLE(p, 3) / 8388608 : b.readInt16LE(p) / 32768;
  }
  return { rate: fmt.rate, ch, n };
}
function writeWav(file, ch, rate) {
  const C = ch.length, n = ch[0].length, bytes = n * C * 2, b = Buffer.alloc(44 + bytes);
  b.write("RIFF", 0); b.writeUInt32LE(36 + bytes, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(C, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2 * C, 28);
  b.writeUInt16LE(2 * C, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(bytes, 40);
  let seed = 1; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < n; i++) for (let c = 0; c < C; c++) {
    const dither = (rnd() - rnd()) / 32768; // TPDF dither for the 24 -> 16 bit step.
    b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((ch[c][i] + dither) * 32767))), 44 + (i * C + c) * 2);
  }
  fs.writeFileSync(file, b);
  console.log(path.relative(process.cwd(), file), (n / rate).toFixed(3) + " s");
}

const intro = readWav(path.join(RAW, "Cathedral of Shadows_intro.wav"));
const loop = readWav(path.join(RAW, "Cathedral of Shadows_loop.wav"));
const n = loop.n, X = Math.round(n / BARS); // One bar, in samples.

const newLoop = loop.ch.map(src => {
  const out = new Float32Array(n - X);
  for (let i = 0; i < X; i++) {
    const t = (i + 0.5) / X; // Equal-power: bar 16 out, bar 1 in.
    out[i] = src[n - X + i] * Math.cos(t * Math.PI / 2) + src[i] * Math.sin(t * Math.PI / 2);
  }
  out.set(src.subarray(X, n - X), X); // Bars 2..15.
  return out;
});
const from = Math.round(TRIM_INTRO * intro.rate), to = intro.n - X;
const newIntro = intro.ch.map(src => Float32Array.from(src.subarray(from, to)));

writeWav(path.join(OUT, "cathedral_of_shadows_intro.wav"), newIntro, intro.rate);
writeWav(path.join(OUT, "cathedral_of_shadows_loop.wav"), newLoop, loop.rate);
