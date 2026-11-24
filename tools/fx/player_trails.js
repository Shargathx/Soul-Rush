// The player's dash speed lines: the Samurai's flash step trail (assets/Enemies/Samurai/Dash/Trail/flashstep_trail_sheet_32x40.png, 128x40, blue
// streaks) recoloured, so the player's dashes use the same speed lines in their own colours (docs/design-brand-mercy.md, phase 4):
//   Flash step   gold and white.
//   Wraith dash  green.
// The brightness of each pixel picks its place between a dark and a light colour of the palette; the alpha is kept as it is.
// That is --samurai (the whole sheet recoloured). The DEFAULT is an experiment with FEWER lines: one clean streak (or two with --lines=2), drawn
// from scratch in the same palette, bright at the left end and fading smoothly to the right (the dash script flips it so the bright end leads).
// Usage: node tools/fx/player_trails.js [--lines=1|2] [--samurai]   writes assets/Player/Dash/dash_trail_flash.png and dash_trail_wraith.png
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

// One or two clean streaks on a 128x40 image: bright at x 0 and fading to the right (alpha and colour), soft one-pixel edges so it looks smooth when stretched.
function streaks(look, lines) {
  const w = 128, h = 40, data = Buffer.alloc(w * h * 4);
  const mix = (a, b, u) => Math.round(a + (b - a) * u);
  const streak = (yc, thick, x0, x1, gain) => {
    for (let x = x0; x <= x1; x++) {
      const u = (x - x0) / (x1 - x0), a = 255 * gain * Math.pow(1 - u, 1.3);
      for (let y = Math.floor(yc - thick / 2) - 1; y <= Math.ceil(yc + thick / 2); y++) {
        const edge = y < yc - thick / 2 || y >= yc + thick / 2 ? 0.4 : 1, alpha = Math.round(a * edge), i = (y * w + x) * 4;
        if (alpha > data[i + 3]) { for (let c = 0; c < 3; c++) data[i + c] = mix(look.light[c], look.dark[c], u); data[i + 3] = alpha; }
      }
    }
  };
  streak(18, 4, 0, 127, 1);
  if (lines === 2) streak(27, 2, 14, 118, 0.65);
  return { w, h, data };
}

const root = path.join(__dirname, "..", "..");
const arg = process.argv.find(a => a.startsWith("--lines="));
const LINES = arg ? Number(arg.split("=")[1]) : 1;
const src = readPng(path.join(root, SRC));
fs.mkdirSync(path.join(root, OUT), { recursive: true });
for (const look of LOOKS) writePng(process.argv.includes("--samurai") ? recolour(src, look) : streaks(look, LINES), path.join(root, OUT, look.file));
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
