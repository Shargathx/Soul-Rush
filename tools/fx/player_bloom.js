// The player's Bloom (the Leaf Ranger's mercy gift, tools/powers/runtime.js): the arrow he plants and the flowers it puts out. The art is the Leaf
// Ranger's own mercy sprout (tools/fx/ranger_sprout.js); his object Ranger_Sprout lives only in his scene, so the player needs a GLOBAL one.
//   Player_Bloom  animation Grow (12 frames, holds the last) and Fly (1 frame, the arrow on its way down). Origin: the arrow's tip at the ground line.
//
//   node tools/fx/player_bloom.js --install   adds the global object to the project (the images are the sprout's: run ranger_sprout.js --install first
//                                             if they are missing). Close GDevelop first. Safe to run again.
const fs = require("fs");
const path = require("path");
const L = require("../bosses/lib.js");
const sprout = require("./ranger_sprout.js");
const ROOT = path.join(__dirname, "..", "..");
const DIR = "assets/Leaf_Ranger/mercy";

if (require.main === module && process.argv[2] === "--install") {
  const grow = Array.from({ length: sprout.FRAMES }, (_, i) => DIR + "/Ranger_Sprout_" + (i + 1) + ".png"), fly = [DIR + "/Ranger_Arrow_Fly_1.png"];
  for (const f of grow.concat(fly)) if (!fs.existsSync(path.join(ROOT, f))) throw new Error(f + " is missing: run tools/fx/ranger_sprout.js --install first");
  const project = L.readJson("Soul Rush.json");
  L.registerImages(project, grow.concat(fly));
  const frames = files => files.map(image => ({ image, origin: sprout.SPROUT.origin, mask: null }));
  const obj = L.spriteObject("Player_Bloom", {}, [L.animation("Grow", frames(grow), sprout.DT, false), L.animation("Fly", frames(fly), sprout.DT, false)]);   // visual only
  const at = project.objects.findIndex(o => o.name === "Player_Bloom");
  if (at >= 0) { obj.persistentUuid = project.objects[at].persistentUuid; project.objects[at] = obj; } else project.objects.push(obj);
  if (!project.objectsFolderStructure.children.some(c => c.objectName === "Player_Bloom")) project.objectsFolderStructure.children.push({ objectName: "Player_Bloom" });
  L.writeJson("Soul Rush.json", project);
  console.log("Registered the global object Player_Bloom.");
}
