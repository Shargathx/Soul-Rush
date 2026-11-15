// Cuts the hub's background music (assets/Music/cathedral_music_background.mp3, made by the user in Suno) into a
// one-off intro and a seamless loop, as 16-bit 48 kHz WAVs in assets/Music.
//
// Node can't decode MP3, so the MP3 is first decoded (in a browser, with WebAudio, at 48 kHz) to raw interleaved
// stereo float32, then:  node tools/hub/music_suno.js <pcm.bin>
//
// The track is beatless, so it isn't cut on bars. The loop points were found by comparing the sound (36 band
// energies, 100 ms frames, 4 s either side) of every pair of moments: at A and B the music matches best (about 11x
// closer than two random moments), and the stretch between them is long, so the loop rarely repeats.
//   intro = [0, A)       plays once, then hands over to the loop at A, exactly as the track runs on.
//   loop  = [A, B)       its last XFADE seconds blend (equal power) from the track at B into the track just before A,
//                        so the end of the loop leads straight into its start with no edge.
// B is nudged (within ALIGN s) to where the waveform lines up best with the one before A, but only if they really
// line up (correlation over MIN_CORR); for this beatless choir they don't (about 0.02), so B stays where it was found.
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "..", "..", "assets", "Music");
const R = 48000;
const A_S = 10.6, B_S = 219.0, XFADE = 3, ALIGN = 0.25, MIN_CORR = 0.3;

const raw = fs.readFileSync(process.argv[2]);
const pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
const total = pcm.length / 2;
const ch = [0, 1].map(c => { const a = new Float32Array(total); for (let i = 0; i < total; i++) a[i] = pcm[2 * i + c]; return a; });

// Align B: best correlation between the XFADE seconds before A and those before B + d.
const A = Math.round(A_S * R), X = Math.round(XFADE * R);
let B = Math.round(B_S * R), best = -Infinity, bestD = 0;
for (let d = -Math.round(ALIGN * R); d <= Math.round(ALIGN * R); d += 4) {
  let s = 0, na = 0, nb = 0;
  for (let i = 0; i < X; i += 8) {
    const a = ch[0][A - X + i] + ch[1][A - X + i], b = ch[0][B + d - X + i] + ch[1][B + d - X + i];
    s += a * b; na += a * a; nb += b * b;
  }
  const c = s / Math.sqrt(na * nb);
  if (c > best) { best = c; bestD = d; }
}
if (best >= MIN_CORR) B += bestD;
console.log(best >= MIN_CORR ? "B nudged by " + (bestD / R * 1000).toFixed(1) + " ms" : "B not nudged", "-> " + (B / R).toFixed(3) + " s; best correlation", best.toFixed(3));

const intro = ch.map(c => c.slice(0, A));
const loop = ch.map(c => {
  const out = c.slice(A, B), n = out.length;
  for (let i = 0; i < X; i++) {
    const t = (i + 0.5) / X;
    out[n - X + i] = c[B - X + i] * Math.cos(t * Math.PI / 2) + c[A - X + i] * Math.sin(t * Math.PI / 2);
  }
  return out;
});

function writeWav(file, chans) {
  const C = chans.length, n = chans[0].length, bytes = n * C * 2, b = Buffer.alloc(44 + bytes);
  b.write("RIFF", 0); b.writeUInt32LE(36 + bytes, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(C, 22); b.writeUInt32LE(R, 24); b.writeUInt32LE(R * 2 * C, 28);
  b.writeUInt16LE(2 * C, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(bytes, 40);
  let seed = 1; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < n; i++) for (let c = 0; c < C; c++)
    b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round((chans[c][i] + (rnd() - rnd()) / 32768) * 32767))), 44 + (i * C + c) * 2);
  fs.writeFileSync(file, b);
  console.log(path.relative(process.cwd(), file), (n / R).toFixed(2) + " s");
}
writeWav(path.join(OUT, "cathedral_background_intro.wav"), intro);
writeWav(path.join(OUT, "cathedral_background_loop.wav"), loop);
