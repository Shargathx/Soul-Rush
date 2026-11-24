// The player's dash speed lines: the Samurai's flash step trail (assets/Enemies/Samurai/Dash/Trail/flashstep_trail_sheet_32x40.png, 128x40, blue
// streaks) recoloured, so the player's dashes use the same speed lines in their own colours (docs/design-brand-mercy.md, phase 4):
//   Flash step   gold and white.
//   Wraith dash  green.
// The brightness of each pixel picks its place between a dark and a light colour of the palette; the alpha is kept as it is.
// Usage: node tools/fx/player_trails.js            writes assets/Player/Dash/dash_trail_flash.png and dash_trail_wraith.png
//        node tools/fx/player_trails.js --install  also registers them and adds the global object Player_Dash_Trail (animations Flash and Wraith)
//                                                  to Soul Rush.json (close GDevelop first; safe to run again)
const fs = require("fs");
const path = require("path");
const { readPng, writePng } = require("./gunslinger_png");
const L = require("../bosses/lib.js");

const SRC = "assets/Enemies/Samurai/Dash/Trail/flashstep_trail_sheet_32x40.png";
const OUT = "assets/Player/Dash";
const LOOKS = [
  { name: "Flash", file: "dash_trail_flash.png", dark: [0xb0, 0x74, 0x1c], light: [0xff, 0xf6, 0xd2] },
  { name: "Wraith", file: "dash_trail_wraith.png", dark: [0x0e, 0x5a, 0x36], light: [0x86, 0xff, 0xb8] }
];

function recolour(img, look) {
  const out = { w: img.w, h: img.h, data: Buffer.from(img.data) }, d = out.data;
  let lo = 255, hi = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; lo = Math.min(lo, l); hi = Math.max(hi, l); }
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2], t = hi > lo ? (l - lo) / (hi - lo) : 1;
    for (let c = 0; c < 3; c++) d[i + c] = Math.round(look.dark[c] + (look.light[c] - look.dark[c]) * t);
  }
  return out;
}

const root = path.join(__dirname, "..", "..");
const src = readPng(path.join(root, SRC));
fs.mkdirSync(path.join(root, OUT), { recursive: true });
for (const look of LOOKS) writePng(recolour(src, look), path.join(root, OUT, look.file));
console.log("Wrote " + LOOKS.map(l => OUT + "/" + l.file).join(", "));

if (process.argv.includes("--install")) {
  const project = L.readJson("Soul Rush.json");
  const files = LOOKS.map(l => OUT + "/" + l.file);
  L.registerImages(project, files);
  for (const r of project.resources.resources) if (files.includes(r.name)) r.smoothed = true;   // Stretched over a dash, they look soft, not blocky.
  const animations = LOOKS.map((l, i) => L.animation(l.name, [{ image: files[i], origin: [0, 0], mask: null }], 0.08, false));
  const have = project.objects.findIndex(o => o.name === "Player_Dash_Trail");
  const obj = L.spriteObject("Player_Dash_Trail", {}, animations);
  if (have >= 0) { obj.persistentUuid = project.objects[have].persistentUuid; project.objects[have] = obj; } else project.objects.push(obj);
  if (!project.objectsFolderStructure.children.some(c => c.objectName === "Player_Dash_Trail")) project.objectsFolderStructure.children.push({ objectName: "Player_Dash_Trail" });
  L.writeJson("Soul Rush.json", project);
  console.log("Registered the images and the global object Player_Dash_Trail.");
}
