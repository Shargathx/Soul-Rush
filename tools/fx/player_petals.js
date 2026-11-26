// The petals Petal step leaves behind (tools/powers/runtime.js): a copy of the player bursting into petals, which stays where he stood and fades at its own
// slow pace while he reappears elsewhere. The frames are the player's own Player_Petal_Burst (the Samurai's Thousand Cuts teleport).
//   Player_Petals  animation Burst: the same images and origins as the Player's, not looping.
//
//   node tools/fx/player_petals.js --install   adds the global object to the project. Close GDevelop first. Safe to run again.
const L = require("../bosses/lib.js");

if (require.main === module && process.argv[2] === "--install") {
  const project = L.readJson("Soul Rush.json");
  const player = project.objects.find(o => o.name === "Player");
  const burst = player && player.animations.find(a => a.name === "Player_Petal_Burst");
  if (!burst) throw new Error("the Player's Player_Petal_Burst animation is missing");
  const dir = burst.directions[0];
  const frames = dir.sprites.map(s => ({ image: s.image, origin: [s.originPoint.x, s.originPoint.y], mask: null }));
  const obj = L.spriteObject("Player_Petals", {}, [L.animation("Burst", frames, dir.timeBetweenFrames, false)]);   // visual only
  const at = project.objects.findIndex(o => o.name === "Player_Petals");
  if (at >= 0) { obj.persistentUuid = project.objects[at].persistentUuid; project.objects[at] = obj; } else project.objects.push(obj);
  if (!project.objectsFolderStructure.children.some(c => c.objectName === "Player_Petals")) project.objectsFolderStructure.children.push({ objectName: "Player_Petals" });
  L.writeJson("Soul Rush.json", project);
  console.log("Registered the global object Player_Petals (" + frames.length + " frames).");
}
