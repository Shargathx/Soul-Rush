// The Samurai's mirror image frames (look "D Spirit Echo"), made from his own animation frames so every pose matches.
// Writes assets/Enemies/Samurai/mirror/<same file name>.png for each animation the mirror plays, and a list (mirror_frames.json)
// that the scene script reads to build the Samurai_Mirror object. Run: node tools/fx/mirror_frames.js
// The mirror never takes damage, so it is a separate object: it has no collision mask and no events that hurt it.
const fs = require("fs");
const path = require("path");
const { ROOT, readPng, writePng, LOOKS } = require("./mirror_look.js");
const ANIMATIONS = ["Idle", "Samurai_Dash_QuickDraw", "Samurai_Petal_Cast", "Samurai_Tornado_Cast", "Samurai_Dash_Out_Back", "Samurai_Passing_Dash_Attack", "Samurai_Attack", "Samurai_Run", "Samurai_Idle_Walk"]; // Out_Back: the short dash away
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
    if (fs.existsSync(path.join(ROOT, dst))) continue; // Same frame already made (frames are shared between animations)
    writePng(look(readPng(from)), path.join(ROOT, dst), 1);
  }
}
fs.writeFileSync(path.join(__dirname, "mirror_frames.json"), JSON.stringify({ animations: list }, null, 2));
console.log("mirror frames:", Object.entries(list).map(([k, v]) => k + " " + v.length).join(", "));
