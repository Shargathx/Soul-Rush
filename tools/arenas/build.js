// Adds the candidate arenas from arenas.js to Leaf_Ranger_Fight, switchable with F4.
// Usage: node build.js <project folder>. Safe to run twice: it removes its own earlier output first.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ARENAS = require("./arenas.js");
const ambientSource = fs.readFileSync(path.join(__dirname, "ambient.js"), "utf8").replace(/\nif \(typeof module[^\n]*\n?$/, "\n");
const root = process.argv[2] || path.join(__dirname, "..", "..");
const P = f => path.join(root, f);
const load = f => JSON.parse(fs.readFileSync(P(f), "utf8"));
const save = (f, d) => fs.writeFileSync(P(f), JSON.stringify(d, null, 2).replace(/\n/g, "\r\n") + "\r\n");
const uuid = () => crypto.randomUUID();
const pngSize = f => { const b = fs.readFileSync(P(f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const comment = text => ({ type: "BuiltinCommonInstructions::Comment", color: { b: 109, g: 230, r: 255, textB: 0, textG: 0, textR: 0 }, comment: text });
const c = (type, params, inverted) => ({ type: inverted ? { inverted: true, value: type } : { value: type }, parameters: params });
const MARK = "Arena test:";
const SCENE = "layouts/leaf_ranger_fight.json";
const FLOOR_Z = 1000;

// 1. Project: image resources and the ArenaChoice global.
const p = load("Soul Rush.json");
const images = new Set();
for (const a of ARENAS) for (const it of a.items) images.add(it.img);
for (const img of images) if (!p.resources.resources.some(r => r.name === img))
  p.resources.resources.push({ file: img, kind: "image", metadata: "", name: img, smoothed: false, userAdded: true });
if (!p.variables.some(v => v.name === "ArenaChoice"))
  p.variables.push({ name: "ArenaChoice", persistentUuid: uuid(), type: "number", value: 1 });
save("Soul Rush.json", p);

// 2. Scene: clear earlier arena output, then add objects, groups, instances and events.
const d = load(SCENE);
const names = new Set();
for (const a of ARENAS) for (const it of a.items) names.add(it.name);
const groupNames = ARENAS.map(a => "Arena_" + a.id);
d.objects = d.objects.filter(o => !names.has(o.name));
d.instances = d.instances.filter(i => !names.has(i.name));
d.objectsGroups = d.objectsGroups.filter(g => !groupNames.includes(g.name));
d.events = d.events.filter(e => !e.__arena);
for (let k = d.events.length - 1; k >= 0; k--) {
  const e = d.events[k];
  if (e.comment && e.comment.startsWith(MARK)) d.events.splice(k, 2); // Comment and the event under it.
}
const folders = d.objectsFolderStructure;
folders.children = (folders.children || []).filter(ch => !(ch.folderName && ch.folderName.startsWith("Arena ")));

let z = 100;
for (const a of ARENAS) {
  const folder = { folderName: "Arena " + a.name, children: [] };
  for (const it of a.items) {
    const [w, h] = pngSize(it.img);
    const sx = it.sx || it.scale || 1, sy = it.sy || it.scale || 1;
    const effects = a.mute ? [{ effectType: "Adjustment", name: "Mute", doubleParameters: { alpha: 1, blue: 1, brightness: a.mute.brightness, contrast: 1, gamma: 1, green: 1, red: 1, saturation: a.mute.saturation }, stringParameters: {}, booleanParameters: {} }] : [];
    d.objects.push({
      adaptCollisionMaskAutomatically: true, assetStoreId: "", name: it.name, persistentUuid: uuid(), type: "Sprite", updateIfNotVisible: false,
      variables: [], effects, behaviors: [],
      animations: [{ name: "", useMultipleDirections: false, directions: [{ looping: false, timeBetweenFrames: 0.08, sprites: [{
        hasCustomCollisionMask: false, image: it.img, points: [], originPoint: { name: "origine", x: 0, y: 0 },
        centerPoint: { automatic: true, name: "centre", x: 0, y: 0 }, customCollisionMask: [] }] }] }]
    });
    folder.children.push({ objectName: it.name });
    z++;
    for (const [x, y] of it.at) d.instances.push({
      angle: 0, customSize: true, depth: 1, height: Math.round(h * sy), keepRatio: false, layer: "Background", name: it.name,
      persistentUuid: uuid(), width: Math.round(w * sx), x, y, zOrder: z, numberProperties: [], stringProperties: [], initialVariables: []
    });
  }
  folders.children.push(folder);
  d.objectsGroups.push({ name: "Arena_" + a.id, objects: a.items.map(it => ({ name: it.name })) });
}
for (const i of d.instances) if (i.name === "Ground_Stuff") i.zOrder = FLOOR_Z;

// Ambience code: arena data trimmed to what the animation needs.
const spec = ARENAS.map(a => ({ id: a.id, name: a.name, ambient: a.ambient,
  items: a.items.filter(it => it.anim || it.alpha !== undefined).map(it => ({ name: it.name, alpha: it.alpha, anim: it.anim })) }));
const js = [
  "// Arena test ambience: drifting clouds and fog, bobbing rocks, pulsing light, a flickering lamp and fireflies,",
  "// for the arena picked by the global ArenaChoice. Generated from the arena preview; edit there and rebuild if possible.",
  "const ARENAS = " + JSON.stringify(spec) + ";",
  ...ambientSource.split("\n"),
  "const choice = runtimeScene.getGame().getVariables().get(\"ArenaChoice\").getAsNumber();",
  "let st = runtimeScene.__arena;",
  "if (!st) st = runtimeScene.__arena = { shownLabel: 0 };",
  "const names = [\"Original\"].concat(ARENAS.map(function (a) { return a.name; }));",
  "// Label: which arena this is, for 3 seconds after the scene starts.",
  "if (!st.label) {",
  "  st.label = new PIXI.Text(\"Arena \" + choice + \": \" + (names[choice] || \"?\") + \"   (F4 for the next one)\", { fontFamily: \"Arial\", fontSize: 18, fill: 0xffffff, stroke: 0x000000, strokeThickness: 4 });",
  "  st.label.x = 640 - st.label.width / 2; st.label.y = 100;",
  "  runtimeScene.getLayer(\"UI\").getRenderer().getRendererObject().addChild(st.label);",
  "}",
  "st.shownLabel += runtimeScene.getElapsedTime() / 1000;",
  "st.label.alpha = Math.max(0, Math.min(1, 3.5 - st.shownLabel));",
  "const arena = ARENAS[choice - 1];",
  "if (!arena) return;",
  "const scene = {",
  "  dt: runtimeScene.getElapsedTime() / 1000,",
  "  getObjects: function (name) { return runtimeScene.getObjects(name); },",
  "  pixiLayer: runtimeScene.getLayer(\"Background\").getRenderer().getRendererObject(),",
  "  renderer: runtimeScene.getGame().getRenderer().getPIXIRenderer()",
  "};",
  "if (!st.ambient) st.ambient = {};",
  "arenaAmbience(scene, arena, st.ambient);"
];

const newEvents = [];
const add = (text, ev) => { newEvents.push(comment(MARK + " " + text), ev); };
add("ArenaChoice is a global number that picks the backdrop (0 original, 1 Deep Forest, 2 Moonlit Ruins, 3 Magic Cliffs, 4 Gothic Graveyard). At scene start, delete the original background unless it is picked.",
  { type: "BuiltinCommonInstructions::Standard", conditions: [c("SceneJustBegins", [""]), c("NumberVariable", ["ArenaChoice", "!=", "0"])],
    actions: ["BG_1", "BG_2", "BG_3", "BG_4"].map(n => c("Delete", [n, ""])) });
ARENAS.forEach((a, i) => add("at scene start, delete the " + a.name + " objects unless ArenaChoice is " + (i + 1) + ".",
  { type: "BuiltinCommonInstructions::Standard", conditions: [c("SceneJustBegins", [""]), c("NumberVariable", ["ArenaChoice", "!=", String(i + 1)])],
    actions: [c("Delete", ["Arena_" + a.id, ""])] }));
add("F4 switches to the next arena and restarts the fight. Debug key: remove before release.",
  { type: "BuiltinCommonInstructions::Standard", conditions: [c("KeyFromTextJustPressed", ["", "\"F4\""])],
    actions: [c("SetNumberVariable", ["ArenaChoice", "=", "mod(ArenaChoice + 1, " + (ARENAS.length + 1) + ")"]), c("Scene", ["", "CurrentSceneName()", ""])] });
add("ambience for the picked arena (moving clouds, fog, light and fireflies), plus a 3 second label naming it.",
  { type: "BuiltinCommonInstructions::JsCode", inlineCode: js, parameterObjects: "", useStrict: true, eventsSheetExpanded: false });

// Floor fix: the red floor collider is only hidden by the Samurai sheet, which this scene does not use.
const FLOOR_NOTE = "Scene start: hide the red Invisible_Wall colliders. The Samurai sheet does this in his scenes, but this scene does not include it.";
if (!d.events.some(e => e.comment === FLOOR_NOTE)) newEvents.unshift(comment(FLOOR_NOTE),
  { type: "BuiltinCommonInstructions::Standard", conditions: [c("SceneJustBegins", [""])], actions: [c("Hide", ["Invisible_Wall"])] });
const at = d.events.findIndex(e => e.comment && e.comment.startsWith("The Leaf Ranger, from"));
if (at < 0) throw new Error("anchor event not found");
d.events.splice(at, 0, ...newEvents);
save(SCENE, d);
console.log("arenas:", ARENAS.length, "objects:", names.size, "images:", images.size, "events:", newEvents.length);
