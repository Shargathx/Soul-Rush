// The Necromancer's sounds, made from scratch (no samples). 16-bit mono WAV, 48 kHz, in assets/Sfx/necro.
// Deterministic: the same files every run.
//
//   node tools/fx/necro_sounds.js
//
// necro_bolt.wav    - a bolt leaves the skull: a breathy whoosh with a hollow tone falling under it (0.45 s).
// necro_impact.wav  - a bolt bursts (on the ground, the wall or on him): a soft crackle and a low pop (0.35 s).
// necro_call.wav    - he calls the rain or the eruption: a low, detuned chord swelling up, like a far choir (1.1 s).
// necro_erupt.wav   - a soul pillar bursts out of the ground: a rumble with a crackling top (0.8 s).
// necro_charge.wav  - the nova gathering: a hum rising in pitch and loudness (0.6 s), cut off by the blast.
// necro_nova.wav    - the nova going off: a deep thump and a rushing burst of air (0.7 s).
// necro_blink.wav   - he vanishes or reappears: a reversed shimmer that snaps shut (0.45 s).
// necro_roar.wav    - the phase 2 roar: a rough, growling noise through two vowel-like resonances, falling (1.6 s).
// necro_shriek.wav  - a skull diving: a thin, wavering wail (0.55 s).
// necro_skel_rise.wav  - a skeleton claws out of the grave: crumbling dirt and a dry rattle of bones (0.8 s).
// necro_skel_swing.wav - a skeleton's cut: a short rusty whoosh with a clack of bone (0.3 s).
// necro_skel_break.wav - a skeleton falls apart: a burst of hollow bone clacks scattering and settling (0.7 s).
// (The skeleton sounds are made last, so the files above stay exactly as they were.)
const fs = require("fs");
const path = require("path");
const RATE = 48000;
const OUT = path.join(__dirname, "../../assets/Sfx/necro");
fs.mkdirSync(OUT, { recursive: true });

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
  const w = 2 * Math.PI * Math.min(f, RATE * 0.45) / RATE, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === "lp") { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else if (type === "hp") { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  else { b0 = a; b1 = 0; b2 = -a; a0 = 1 + a; a1 = -2 * c; a2 = 1 - a; }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => { const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
// A filter whose frequency moves: rebuilt every 64 samples.
function sweep(type, fOf, q) { let f = null, n = 0; return (x, t) => { if (n++ % 64 === 0) f = biquad(type, fOf(t), q); return f(x); }; }
let seed = 99;
const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
const env = (t, a, d) => t < a ? t / a : Math.exp(-(t - a) / d);
const make = (dur, fn) => { const n = Math.round(dur * RATE), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = fn(i / RATE, i); return x; };
const fadeOut = (x, sec) => { const n = Math.round(sec * RATE); for (let i = 0; i < n && i < x.length; i++) x[x.length - 1 - i] *= i / n; return x; };

// Bolt: band-passed noise sweeping down, and a hollow tone falling 420 -> 160 Hz.
{
  const bp = sweep("bp", t => 2600 - t * 4200, 1.4); let ph = 0;
  writeWav(path.join(OUT, "necro_bolt.wav"), fadeOut(make(0.45, t => {
    ph += 2 * Math.PI * (420 - 580 * t) / RATE;
    return bp(noise(), t) * env(t, 0.03, 0.12) * 1.2 + Math.sin(ph) * 0.35 * env(t, 0.01, 0.14) * (1 + 0.3 * Math.sin(ph * 0.5));
  }), 0.05), -3);
}
// Impact: crackle grains and a low pop.
{
  const hp = biquad("hp", 1800, 0.7), lp = biquad("lp", 400, 0.9); let ph = 0;
  writeWav(path.join(OUT, "necro_impact.wav"), fadeOut(make(0.35, t => {
    ph += 2 * Math.PI * (110 - 120 * t) / RATE;
    const grain = Math.abs(noise()) > 0.985 - t * 0.03 ? noise() * 3 : 0;
    return hp(grain + noise() * 0.15) * env(t, 0.002, 0.08) + lp(Math.sin(ph) + noise() * 0.3) * env(t, 0.003, 0.06) * 1.4;
  }), 0.05), -4);
}
// Call: a detuned minor chord on low saws, swelling, through a slowly opening low-pass.
{
  const lp = sweep("lp", t => 300 + t * 1400, 0.9), notes = [73.4, 87.3, 110, 146.8], ph = [0, 0, 0, 0, 0, 0, 0, 0];
  writeWav(path.join(OUT, "necro_call.wav"), fadeOut(make(1.1, (t) => {
    let s = 0;
    notes.forEach((f, i) => { for (let d = 0; d < 2; d++) { const j = i * 2 + d; ph[j] = (ph[j] + f * (d ? 1.007 : 0.996) / RATE) % 1; s += (ph[j] * 2 - 1) * 0.25; } });
    const a = Math.min(1, t / 0.7) * (t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.25) : 1);
    return lp(s + noise() * 0.05, t) * a;
  }), 0.08), -4);
}
// Erupt: brown-ish rumble plus crackles.
{
  const lp = biquad("lp", 160, 0.8), hp = biquad("hp", 2500, 0.7); let brown = 0;
  writeWav(path.join(OUT, "necro_erupt.wav"), fadeOut(make(0.8, t => {
    brown = brown * 0.985 + noise() * 0.15;
    const crack = Math.abs(noise()) > 0.97 ? noise() * 2.5 : 0;
    return lp(brown) * 3.2 * env(t, 0.02, 0.28) + hp(crack) * env(t, 0.01, 0.2) * 0.7;
  }), 0.1), -3);
}
// Charge: a hum (fundamental plus fifth) rising 90 -> 260 Hz, getting louder.
{
  let p1 = 0, p2 = 0; const lp = biquad("lp", 1800, 0.7);
  writeWav(path.join(OUT, "necro_charge.wav"), fadeOut(make(0.6, t => {
    const f = 90 + 170 * Math.pow(t / 0.6, 1.6);
    p1 += 2 * Math.PI * f / RATE; p2 += 2 * Math.PI * f * 1.5 / RATE;
    const s = Math.sin(p1) + 0.5 * Math.sin(p2) + 0.25 * Math.sign(Math.sin(p1 * 2)) + noise() * 0.1;
    return lp(s) * Math.pow(t / 0.6, 1.3);
  }), 0.02), -5);
}
// Nova: a falling sine thump and a rush of low-passed noise.
{
  let ph = 0; const lp = sweep("lp", t => 3000 - t * 3600, 0.7);
  writeWav(path.join(OUT, "necro_nova.wav"), fadeOut(make(0.7, t => {
    ph += 2 * Math.PI * (75 - 45 * t) / RATE;
    return Math.sin(ph) * env(t, 0.004, 0.18) * 1.3 + lp(noise(), t) * env(t, 0.01, 0.2) * 0.9;
  }), 0.1), -2);
}
// Blink: shimmering partials swelling (a reversed tail) and stopping on a click.
{
  const parts = [880, 1320, 1975, 2637, 3520].map(f => ({ f, p: 0 }));
  writeWav(path.join(OUT, "necro_blink.wav"), make(0.45, t => {
    let s = 0; for (const q of parts) { q.p += 2 * Math.PI * q.f * (1 + 0.004 * Math.sin(t * 40)) / RATE; s += Math.sin(q.p) / parts.length; }
    const a = Math.pow(Math.min(1, t / 0.42), 2.5) * (t > 0.42 ? Math.max(0, 1 - (t - 0.42) / 0.03) : 1);
    return s * a + (t > 0.415 && t < 0.42 ? noise() * 0.8 : 0);
  }), -6);
}
// Roar: pulsed noise (a growl at ~38 Hz) through two formants that slide down, with a low body.
{
  const f1 = sweep("bp", t => 650 - t * 220, 4), f2 = sweep("bp", t => 1150 - t * 380, 5), lp = biquad("lp", 220, 0.8); let gp = 0, bp2 = 0;
  writeWav(path.join(OUT, "necro_roar.wav"), fadeOut(make(1.6, t => {
    gp += 2 * Math.PI * (38 - t * 8) / RATE; bp2 += 2 * Math.PI * (62 - t * 14) / RATE;
    const pulse = 0.55 + 0.45 * Math.max(0, Math.sin(gp)), src = noise() * pulse;
    const a = Math.min(1, t / 0.25) * (t > 1.1 ? Math.max(0, 1 - (t - 1.1) / 0.5) : 1);
    return (f1(src, t) * 2.2 + f2(src, t) * 1.4 + lp(Math.sin(bp2) * pulse) * 0.9) * a;
  }), 0.1), -2);
}
// Shriek: a thin wailing tone with vibrato, falling, with breath.
{
  let ph = 0; const hp = biquad("hp", 2000, 0.7);
  writeWav(path.join(OUT, "necro_shriek.wav"), fadeOut(make(0.55, t => {
    ph += 2 * Math.PI * (1500 - 700 * t + 60 * Math.sin(t * 2 * Math.PI * 11)) / RATE;
    return (Math.sin(ph) * 0.6 + Math.sin(ph * 2.01) * 0.2 + hp(noise()) * 0.25) * env(t, 0.04, 0.2);
  }), 0.08), -8);
}
// Skeleton rise: low crumbling (filtered noise bursts) and a rattle of tiny hollow clicks.
{
  const lp = biquad("lp", 500, 0.8), bp = biquad("bp", 2400, 4);
  writeWav(path.join(OUT, "necro_skel_rise.wav"), fadeOut(make(0.8, t => {
    const crumble = lp(noise()) * (0.6 + 0.4 * Math.sin(t * 37)) * env(t, 0.05, 0.4);
    const rattle = bp(noise() > 0.985 && t > 0.2 ? noise() * 6 : 0);
    return crumble * 1.4 + rattle * 1.2;
  }), 0.1), -6);
}
// Skeleton swing: a band-passed whoosh, and one bone clack at the start.
{
  const bp = sweep("bp", t => 1800 - t * 3000, 1.2), clack = biquad("bp", 1400, 6);
  writeWav(path.join(OUT, "necro_skel_swing.wav"), fadeOut(make(0.3, t => bp(noise(), t) * env(t, 0.02, 0.08) * 1.3 + clack(t < 0.004 ? noise() * 8 : 0) * 1.5), 0.04), -6);
}
// Skeleton break: hollow clacks (ringing band-passed clicks at a few pitches), dense at first and thinning out, over a short crumble.
{
  const bps = [900, 1300, 1700, 2300].map(f => biquad("bp", f, 12)), lp = biquad("lp", 700, 0.8);
  writeWav(path.join(OUT, "necro_skel_break.wav"), fadeOut(make(0.7, t => {
    const rate = 0.03 * Math.exp(-t * 4), hit = noise() > 1 - rate * 2 ? noise() * 10 : 0;
    let v = 0; for (let k = 0; k < bps.length; k++) v += bps[k](k === Math.floor((t * 97) % 4) ? hit : 0);
    return v * 1.6 + lp(noise()) * env(t, 0.01, 0.15) * 0.8;
  }), 0.1), -5);
}
