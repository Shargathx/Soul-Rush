// The bolt the Projectile return passive (brand 4, docs/design-brand-mercy.md, phase 5) sends back at the boss: a small dark-violet comet with a hot
// crimson head and a red-white core, pointing RIGHT (the script turns it to face the boss), 48x16 with a soft glow edge and a tail that fades to nothing.
// Usage: node tools/fx/player_return_shot.js            writes assets/Player/Shadow/return_shot_1.png (the same colours as the shadow)
//        node tools/fx/player_return_shot.js --install  also registers it and adds the global object Player_Return_Shot (animation "Fly", one frame) to
//                                                       Soul Rush.json (close GDevelop first; safe to run again)
const path = require("path");
const { writePng } = require("./gunslinger_png");
const L = require("../bosses/lib.js");

const root = path.join(__dirname, "..", "..");
const FILE = "assets/Player/Shadow/return_shot_1.png", W = 48, H = 16;
const data = Buffer.alloc(W * H * 4);
const mix = (a, b, u) => Math.round(a + (b - a) * u);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const dy = (y + 0.5 - H / 2) / (H / 2), u = x / (W - 1);                         // u: 0 at the tail, 1 at the head.
  const half = 0.15 + 0.85 * Math.pow(u, 0.7);                                      // The comet widens toward the head.
  const d = Math.abs(dy) / half;                                                    // 0 on the axis, 1 at the edge.
  if (d >= 1.25) continue;
  const edge = d < 1 ? 1 : (1.25 - d) / 0.25, tail = Math.pow(u, 1.4);
  const core = Math.max(0, 1 - d / 0.45) * (0.4 + 0.6 * u);                         // The hot core, strongest at the head.
  const i = (y * W + x) * 4, a = Math.round(255 * edge * (0.12 + 0.88 * tail));
  data[i] = mix(mix(70, 235, u), 255, core); data[i + 1] = mix(mix(20, 40, u), 200, core); data[i + 2] = mix(mix(120, 120, u), 215, core); data[i + 3] = a;
}
writePng({ w: W, h: H, data }, path.join(root, FILE));
console.log("Wrote " + FILE);

if (process.argv.includes("--install")) {
  const project = L.readJson("Soul Rush.json");
  L.registerImages(project, [FILE]);
  for (const r of project.resources.resources) if (r.name === FILE) r.smoothed = true;
  const obj = L.spriteObject("Player_Return_Shot", {}, [L.animation("Fly", [{ image: FILE, origin: [0, 0], mask: null }], 0.1, true)]);
  const have = project.objects.findIndex(o => o.name === "Player_Return_Shot");
  if (have >= 0) { obj.persistentUuid = project.objects[have].persistentUuid; project.objects[have] = obj; } else project.objects.push(obj);
  if (!project.objectsFolderStructure.children.some(c => c.objectName === "Player_Return_Shot")) project.objectsFolderStructure.children.push({ objectName: "Player_Return_Shot" });
  L.writeJson("Soul Rush.json", project);
  console.log("Registered the image and the global object Player_Return_Shot.");
}
