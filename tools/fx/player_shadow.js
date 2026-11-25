// The player's shadow (docs/design-brand-mercy.md, phase 5, Riposte): the dark double that strikes for him after a perfect deflect. Made from the
// player's own heavy attack (Player_Attack_Two, 6 frames, 120x80 like every player frame), recoloured:
//   the body        black with a violet cast (the cloth and armour are told apart only by their brightness, kept as faint folds),
//   the slash arc   (the white sweep: the very bright, unsaturated pixels) a hot crimson-violet, so the cut itself glows,
//   the rim         a 2 px halo of violet that fades outwards, so the figure is a glow-edged hole in the air, not a flat cutout,
//   the eyes        two hot red pixels on the head (the head is the highest body pixel that is not part of the arc).
// The script (tools/powers via tools/brand/brand.js) makes it translucent, flickers it and fades it out; this file only draws the frames.
// Usage: node tools/fx/player_shadow.js            writes assets/Player/Shadow/shadow_1.png to shadow_6.png (and a 4x preview, preview.png)
//        node tools/fx/player_shadow.js --install  also registers them and adds the global object Player_Shadow (animations "Strike", 6 frames at 0.07 s, and
//                                                  "Strike1", the light attack, 4 frames at 0.08 s, no loop) to Soul Rush.json (close GDevelop first; safe to run again)
const fs = require("fs");
const path = require("path");
const { readPng, writePng } = require("./gunslinger_png");
const L = require("../bosses/lib.js");

const root = path.join(__dirname, "..", "..");
const SRC = n => "assets/Player/Player_Attack_Two" + (n + 6) + ".png";    // Player_Attack_Two7 to 12.
const SRC1 = n => "assets/Player/Player" + (n + 22) + ".png";             // Player_Attack_One: Player23 to 26 (the light attack: the Shadow echo replays it).
const OUT = "assets/Player/Shadow";
const FRAMES = 6, FRAMES1 = 4;

function shade(img) {
  const w = img.w, h = img.h, src = img.data, out = Buffer.alloc(src.length);
  const alpha = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : src[(y * w + x) * 4 + 3];
  const isArc = i => { const r = src[i], g = src[i + 1], b = src[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx > 205 && mx - mn < 48; };
  // The body and the arc.
  const body = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = src[i + 3];
    if (!a) continue;
    if (isArc(i)) {                                                   // The slash: crimson at the edge of its brightness, violet-white at the core.
      const l = (src[i] + src[i + 1] + src[i + 2]) / 3, t = Math.min(1, Math.max(0, (l - 190) / 65));
      out[i] = Math.round(150 + 90 * t); out[i + 1] = Math.round(30 + 40 * t); out[i + 2] = Math.round(120 + 100 * t); out[i + 3] = Math.round(a * (0.55 + 0.45 * t));
    } else {                                                          // The body: near black, the folds a little lighter.
      const l = (0.3 * src[i] + 0.59 * src[i + 1] + 0.11 * src[i + 2]) / 255;
      out[i] = Math.round(8 + 30 * l); out[i + 1] = Math.round(4 + 12 * l); out[i + 2] = Math.round(16 + 48 * l); out[i + 3] = a;
      body.push([x, y]);
    }
  }
  // The eyes: the head is the highest body pixel; two red pixels a little below it, side by side.
  if (body.length) {
    const top = body.reduce((m, p) => (p[1] < m[1] ? p : m), body[0]);
    const cols = body.filter(p => p[1] === top[1] + 3).map(p => p[0]);
    if (cols.length >= 2) {
      const mid = Math.round((Math.min(...cols) + Math.max(...cols)) / 2);
      for (const x of [mid - 1, mid + 1]) { const i = ((top[1] + 3) * w + x) * 4; out[i] = 255; out[i + 1] = 40; out[i + 2] = 40; out[i + 3] = 255; }
    }
  }
  // The rim: transparent pixels near an opaque one get a violet glow that fades with distance (2 px).
  const rim = Buffer.from(out);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (out[i + 3] > 40) continue;
    let near = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const d = Math.hypot(dx, dy); if (d <= 2.2) near = Math.max(near, alpha(x + dx, y + dy) / 255 * (1 - d / 3)); }
    if (near > 0) { rim[i] = 120; rim[i + 1] = 40; rim[i + 2] = 200; rim[i + 3] = Math.max(rim[i + 3], Math.round(190 * near)); }
  }
  return { w: w, h: h, data: rim };
}

const sheets = [];
fs.mkdirSync(path.join(root, OUT), { recursive: true });
for (let n = 1; n <= FRAMES; n++) { const img = shade(readPng(path.join(root, SRC(n)))); sheets.push(img); writePng(img, path.join(root, OUT, "shadow_" + n + ".png")); }
const light = [];
for (let n = 1; n <= FRAMES1; n++) { const img = shade(readPng(path.join(root, SRC1(n)))); light.push(img); writePng(img, path.join(root, OUT, "shadow_light_" + n + ".png")); }
// A 4x preview strip on a grey-violet ground, to look at the frames.
const S = 4, pw = 120 * S, ph = 80 * S, prev = { w: pw * 3, h: ph * 2, data: Buffer.alloc(pw * 3 * ph * 2 * 4) };
for (let i = 0; i < prev.data.length; i += 4) { prev.data[i] = 90; prev.data[i + 1] = 84; prev.data[i + 2] = 104; prev.data[i + 3] = 255; }
sheets.forEach((img, k) => {
  const ox = (k % 3) * pw, oy = Math.floor(k / 3) * ph;
  for (let y = 0; y < 80 * S; y++) for (let x = 0; x < 120 * S; x++) {
    const s = ((Math.floor(y / S)) * 120 + Math.floor(x / S)) * 4, d = ((oy + y) * prev.w + ox + x) * 4, a = img.data[s + 3] / 255;
    for (let c = 0; c < 3; c++) prev.data[d + c] = Math.round(prev.data[d + c] * (1 - a) + img.data[s + c] * a);
  }
});
writePng(prev, path.join(root, OUT, "preview.png"));
console.log("Wrote " + FRAMES + " frames to " + OUT + " and preview.png");

if (process.argv.includes("--install")) {
  const project = L.readJson("Soul Rush.json");
  const files = sheets.map((_, k) => OUT + "/shadow_" + (k + 1) + ".png");
  L.registerImages(project, files);
  const attack = project.objects.find(o => o.name === "Player").animations.find(a => a.name === "Player_Attack_Two").directions[0].sprites[0];
  const frames = files.map(f => ({ image: f, origin: [0, 0], mask: null }));
  const files1 = light.map((_, k) => OUT + "/shadow_light_" + (k + 1) + ".png");
  L.registerImages(project, files1);
  const frames1 = files1.map(f => ({ image: f, origin: [0, 0], mask: null }));
  const obj = L.spriteObject("Player_Shadow", {}, [L.animation("Strike", frames, 0.07, false), L.animation("Strike1", frames1, 0.08, false)]);
  const have = project.objects.findIndex(o => o.name === "Player_Shadow");
  if (have >= 0) { obj.persistentUuid = project.objects[have].persistentUuid; project.objects[have] = obj; } else project.objects.push(obj);
  if (!project.objectsFolderStructure.children.some(c => c.objectName === "Player_Shadow")) project.objectsFolderStructure.children.push({ objectName: "Player_Shadow" });
  L.writeJson("Soul Rush.json", project);
  console.log("Registered the images and the global object Player_Shadow.");
}
