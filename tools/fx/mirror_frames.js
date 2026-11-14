// The Samurai's mirror image frames (look "D Spirit Echo"), made from his own animation frames so every pose matches.
// Writes assets/Enemies/Samurai/mirror/<same file name>.png for each animation the mirror plays, and a list (mirror_frames.json)
// that the scene script reads to build the Samurai_Mirror object. Run: node tools/fx/mirror_frames.js
// The mirror never takes damage, so it is a separate object: it has no collision mask and no events that hurt it.
const fs = require("fs");
const path = require("path");
const { ROOT, readPng, writePng, LOOKS } = require("./mirror_look.js");
const ANIMATIONS = ["Idle", "Samurai_Dash_QuickDraw", "Samurai_Petal_Cast", "Samurai_Tornado_Cast", "Samurai_Dash_Out_Back", "Samurai_Passing_Dash_Attack", "Samurai_Attack", "Samurai_Run", "Samurai_Idle_Walk", "Samurai_Dash_Slash"]; // Dash_Slash: the wall slash image. Out_Back: the short dash away
// The sheathe glint of the wall slash (Samurai_Dash_Slash, frames 7 to 9) is red in his own frames; the cyan look would hide it, so those frames keep
// the glint red and get a red glow around it.
const GLINT_ANIMATIONS = ["Samurai_Dash_Slash"]; // Dash_Slash: the sheathe glint before the draw
function redGlint(original, out) {
  const { w, h } = original, pts = [];
  for (let i = 0; i < w * h; i++) { const r = original.px[i * 4], g = original.px[i * 4 + 1], b = original.px[i * 4 + 2], a = original.px[i * 4 + 3]; if (a > 0.5 && r > 200 && g < 90 && b < 110) pts.push([i % w, Math.floor(i / w)]); }
  if (!pts.length) return out;
  const cx = pts.reduce((t, p) => t + p[0], 0) / pts.length, cy = pts.reduce((t, p) => t + p[1], 0) / pts.length, strength = 0.7 + Math.min(1, pts.length / 10) * 0.6, R = 9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - cx, y - cy); if (d > R) continue;
    const k = Math.min(1, Math.pow(1 - d / R, 1.6) * strength), i = (y * w + x) * 4, a = out.px[i + 3], na = Math.max(a, k);
    for (let j = 0; j < 3; j++) out.px[i + j] = (out.px[i + j] * a * (1 - k) + [255, 40, 55][j] * k) / (na || 1);
    out.px[i + 3] = na;
  }
  for (const [x, y] of pts) { const i = (y * w + x) * 4; out.px[i] = original.px[i]; out.px[i + 1] = original.px[i + 1]; out.px[i + 2] = original.px[i + 2]; out.px[i + 3] = 1; }
  return out;
}
const OUT = path.join(ROOT, "assets", "Enemies", "Samurai", "mirror");
const scene = JSON.parse(fs.readFileSync(path.join(ROOT, "layouts", "samurai_fight.json"), "utf8"));
const samurai = scene.objects.find(o => o.name === "Samurai_NPC");
// A frame's "image" is a resource name, which is usually its file path but not always (e.g. "Samurai_NPC8").
const resources = JSON.parse(fs.readFileSync(path.join(ROOT, "Soul Rush.json"), "utf8")).resources.resources;
const fileOf = name => { const r = resources.find(x => x.name === name); if (!r) throw new Error("no resource " + name); return r.file; };
fs.mkdirSync(OUT, { recursive: true });
const look = LOOKS["D  Spirit Echo"], list = {};
for (const name of ANIMATIONS) {
  const anim = samurai.animations.find(a => a.name === name);
  if (!anim) throw new Error("no animation " + name);
  list[name] = anim.directions[0].sprites.map(s => {
    const src = fileOf(s.image), dst = "assets/Enemies/Samurai/mirror/" + path.basename(src);
    return { image: s.image, src, dst };
  });
  for (const { src, dst } of list[name]) {
    const from = path.join(ROOT, src);
    if (!fs.existsSync(from)) throw new Error("missing " + from);
    const glint = GLINT_ANIMATIONS.includes(name);
    if (!glint && fs.existsSync(path.join(ROOT, dst))) continue; // Same frame already made (frames are shared between animations)
    const original = readPng(from);
    writePng(glint ? redGlint(original, look(original)) : look(original), path.join(ROOT, dst), 1);
  }
}
fs.writeFileSync(path.join(__dirname, "mirror_frames.json"), JSON.stringify({ animations: list }, null, 2));
console.log("mirror frames:", Object.entries(list).map(([k, v]) => k + " " + v.length).join(", "));
