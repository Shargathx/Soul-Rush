// Writes the hub from hub.js into layouts/hub_area.json and registers its images. Close GDevelop first.
// Usage: node tools/hub/build.js [project folder]. Safe to run again after editing hub.js: it removes what
// it added last time (Hub_* objects, Ruins_Tiles instances, the Far layer, its own events) and rebuilds.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const HUB = require("./hub.js");
const root = process.argv[2] || path.join(__dirname, "..", "..");
const P = f => path.join(root, f);
const load = f => JSON.parse(fs.readFileSync(P(f), "utf8"));
const save = (f, d) => fs.writeFileSync(P(f), JSON.stringify(d, null, 2) + "\n");
const uuid = () => crypto.randomUUID();
const pngSize = f => { const b = fs.readFileSync(P(f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const yellow = { b: 109, g: 230, r: 255, textB: 0, textG: 0, textR: 0 };
const comment = text => ({ type: "BuiltinCommonInstructions::Comment", color: yellow, comment: text });
const jsEvent = lines => ({ type: "BuiltinCommonInstructions::JsCode", inlineCode: lines, parameterObjects: "", useStrict: true, eventsSheetExpanded: false });
const ambientSource = fs.readFileSync(path.join(__dirname, "..", "arenas", "ambient.js"), "utf8").replace(/\r\n/g, "\n").replace(/\nif \(typeof module[^\n]*\n?$/, "\n");
const ATLAS = "assets/tilemaps/ruins/ruins_hub.png";
const OLD_ATLAS = "assets/tilemaps/ruins/ruins_night.png";
const OURS = /^Hub_/;
const OUR_COMMENT = /^(Camera follow:|Hub ambience:|Hub gates:)/;

const F = "layouts/hub_area.json";
const d = load(F);
const before = JSON.parse(JSON.stringify(d));

// 1. Clean out the previous build.
d.objects = d.objects.filter(o => !OURS.test(o.name));
d.instances = d.instances.filter(i => !OURS.test(i.name) && i.name !== "Ruins_Tiles");
d.layers = d.layers.filter(l => l.name !== "Far");
for (let k = d.events.length - 1; k >= 0; k--) if (d.events[k].comment && OUR_COMMENT.test(d.events[k].comment)) d.events.splice(k, 2);
const prune = f => { f.children = (f.children || []).filter(ch => {
  if (ch.objectName !== undefined) return !OURS.test(ch.objectName);
  prune(ch); return ch.children.length > 0 || ch.folderName === "Hub - Ruins"; }); };
prune(d.objectsFolderStructure);
let folder = d.objectsFolderStructure.children.find(ch => ch.folderName === "Hub - Ruins");
if (!folder) { folder = { folderName: "Hub - Ruins", children: [] }; d.objectsFolderStructure.children.push(folder); }
if (!folder.children.some(ch => ch.objectName === "Ruins_Tiles")) folder.children.push({ objectName: "Ruins_Tiles" });

// 2. The Far layer, behind Background. The camera event scrolls it at HUB.parallax.
const bg = d.layers.find(l => l.name === "Background");
d.layers.splice(d.layers.indexOf(bg), 0, Object.assign(JSON.parse(JSON.stringify(bg)), { name: "Far", cameras: [], effects: [] }));

// 3. Tiles: the hub's tinted atlas, one Ruins_Tiles instance per piece, in front of the backdrop.
const tilesObj = d.objects.find(o => o.name === "Ruins_Tiles");
tilesObj.content.atlasImage = ATLAS;
const TILE_Z = 1000;
for (const t of HUB.tiles) {
  const dimX = t.rows[0].length, dimY = t.rows.length;
  const tilemap = { tileWidth: 16, tileHeight: 16, dimX, dimY, layers: [{ id: 0, alpha: 1, tiles: t.rows }] };
  d.instances.push({ angle: 0, customSize: true, depth: 1, height: dimY * 32, keepRatio: true, layer: "Background", name: "Ruins_Tiles",
    persistentUuid: uuid(), width: dimX * 32, x: t.x, y: t.y, zOrder: TILE_Z, numberProperties: [],
    stringProperties: [{ name: "tilemap", value: JSON.stringify(tilemap) }], initialVariables: [] });
}

// 4. Sprites. Ledges get a jump-through Platform behaviour and a mask over their standing band.
const subfolder = { folderName: "Hub pieces", children: [] };
let z = 100;
for (const it of HUB.items) {
  const [w, h] = pngSize(it.img);
  const sx = it.sx || it.scale || 1, sy = it.sy || it.scale || 1;
  const mask = it.mask ? [[{ x: it.mask[0], y: it.mask[1] }, { x: it.mask[2], y: it.mask[1] }, { x: it.mask[2], y: it.mask[3] }, { x: it.mask[0], y: it.mask[3] }]] : [];
  d.objects.push({
    adaptCollisionMaskAutomatically: false, assetStoreId: "", name: it.name, persistentUuid: uuid(), type: "Sprite", updateIfNotVisible: false,
    variables: it.gate ? ["Scene", "Label", "Color"].map(n => ({ name: n, persistentUuid: uuid(), type: "string", value: "" })) : [],
    effects: [],
    behaviors: it.platform ? [{ name: "Platform", type: "PlatformBehavior::PlatformBehavior", canBeGrabbed: false, platformType: "Jumpthru", yGrabOffset: 0 }] : [],
    animations: [{ name: "", useMultipleDirections: false, directions: [{ looping: false, timeBetweenFrames: 0.08, sprites: [{
      hasCustomCollisionMask: !!it.mask, image: it.img, points: [], originPoint: { name: "origine", x: 0, y: 0 },
      centerPoint: { automatic: true, name: "centre", x: 0, y: 0 }, customCollisionMask: mask }] }] }]
  });
  subfolder.children.push({ objectName: it.name });
  z++;
  it.at.forEach(([x, y], k) => d.instances.push({
    angle: 0, customSize: true, depth: 1, height: Math.round(h * sy), keepRatio: false, layer: it.layer || "Background", name: it.name,
    persistentUuid: uuid(), width: Math.round(w * sx), x, y, zOrder: z, numberProperties: [], stringProperties: [],
    initialVariables: it.gate ? [
      { name: "Scene", persistentUuid: uuid(), type: "string", value: HUB.gates[k].scene },
      { name: "Label", persistentUuid: uuid(), type: "string", value: HUB.gates[k].label },
      { name: "Color", persistentUuid: uuid(), type: "string", value: HUB.gates[k].color.join(";") }] : []
  }));
}
// The gate prompt: same look as the tutorial prompt, smaller.
d.objects.push({ assetStoreId: "", bold: false, italic: false, name: "Hub_Prompt", persistentUuid: uuid(), smoothed: true, type: "TextObject::Text",
  underlined: false, variables: [], effects: [], behaviors: [], string: "", font: "", textAlignment: "center", characterSize: 24,
  color: { b: 255, g: 255, r: 255 },
  content: { bold: false, isOutlineEnabled: true, isShadowEnabled: true, italic: false, outlineColor: "0;0;0", outlineThickness: 3, shadowAngle: 90,
    shadowBlurRadius: 2, shadowColor: "0;0;0", shadowDistance: 4, shadowOpacity: 127, smoothed: true, underlined: false, text: "", font: "",
    textAlignment: "center", verticalTextAlignment: "top", characterSize: 24, lineHeight: 0, color: "255;255;255" } });
subfolder.children.push({ objectName: "Hub_Prompt" });
d.instances.push({ angle: 0, customSize: false, depth: 1, height: 0, keepRatio: true, layer: "", name: "Hub_Prompt", persistentUuid: uuid(),
  width: 0, x: 0, y: 0, zOrder: 50, numberProperties: [], stringProperties: [], initialVariables: [] });
folder.children.push(subfolder);

// 5. Events, after the Player_Movement link: camera follow, then (after Combat_Shared) ambience and gates.
const pm = d.events.findIndex(e => e.type === "BuiltinCommonInstructions::Link" && e.target === "Player_Movement");
const camera = [
  "// Camera follow. Keeps the player in the middle of the screen, but stops before the screen edge passes an off-limits wall.",
  "// So once the player is about mid-screen from a wall, the camera is touching it and stops; the player walks on alone.",
  "// The walls are the tall Invisible_Wall instances, so moving them in the editor moves the limits too.",
  "// Runs before Combat_Shared, whose screen shake shakes around runtimeScene.__cameraBase.",
  "// Generated by tools/hub/build.js: edit there and rebuild.",
  "const FOLLOW_LAYERS = [\"\", \"Background\"]; // The floor is on Background. The UI layer stays still.",
  "const PARALLAX = " + HUB.parallax + "; // The Far layer (sky, moon, mountains) scrolls this much of the camera's movement.",
  "const players = runtimeScene.getObjects(\"Player\");",
  "if (players.length === 0) return;",
  "const player = players[0];",
  "const game = runtimeScene.getGame();",
  "const halfW = game.getGameResolutionWidth() / 2;",
  "// The off-limits line on each side: the inner edge of the tall walls.",
  "let left = -Infinity, right = Infinity;",
  "for (const wall of runtimeScene.getObjects(\"Invisible_Wall\")) {",
  "  if (wall.getHeight() <= wall.getWidth()) continue; // Floor and ceiling strips.",
  "  const x = wall.getX(), w = wall.getWidth();",
  "  if (x + w / 2 < player.getCenterXInScene()) left = Math.max(left, x + w);",
  "  else right = Math.min(right, x);",
  "}",
  "// The image centre, not the body: the body sits a little off-centre and flips with the player, which would jolt the camera on every turn.",
  "let camX = player.getCenterXInScene();",
  "if (right - left <= halfW * 2) camX = (left + right) / 2; // Room narrower than the screen: just centre it.",
  "else camX = Math.min(Math.max(camX, left + halfW), right - halfW);",
  "const camY = game.getGameResolutionHeight() / 2;",
  "runtimeScene.__cameraBase = { x: camX, y: camY };",
  "for (const name of FOLLOW_LAYERS) {",
  "  if (!runtimeScene.hasLayer(name)) continue;",
  "  const layer = runtimeScene.getLayer(name);",
  "  layer.setCameraX(camX);",
  "  layer.setCameraY(camY);",
  "}",
  "if (runtimeScene.hasLayer(\"Far\")) {",
  "  const far = runtimeScene.getLayer(\"Far\");",
  "  far.setCameraX(halfW + (camX - halfW) * PARALLAX);",
  "  far.setCameraY(camY);",
  "}"
];
d.events.splice(pm + 1, 0,
  comment("Camera follow: keep the player mid-screen, stopping when the screen edge reaches an off-limits wall (the tall Invisible_Wall instances). The Far layer scrolls slower, for depth. Runs before Combat_Shared so its screen shake shakes around this spot."),
  jsEvent(camera));

const spec = { id: "Hub", name: "Hub", ambient: HUB.ambient,
  items: HUB.items.filter(it => it.anim || it.alpha !== undefined).map(it => ({ name: it.name, alpha: it.alpha, anim: it.anim })) };
const ambience = [
  "// Hub ambience. Generated by tools/hub/build.js from tools/hub/hub.js: edit there and rebuild.",
  "// The moving parts work as in the arenas (tools/arenas/ambient.js): moon pulse, drifting fog, fireflies.",
  "const ARENA = " + JSON.stringify(spec) + ";",
  ...ambientSource.split("\n"),
  "if (!runtimeScene.__hubAmbience) runtimeScene.__hubAmbience = {};",
  "arenaAmbience({",
  "  dt: runtimeScene.getElapsedTime() / 1000,",
  "  getObjects: function (name) { return runtimeScene.getObjects(name); },",
  "  pixiLayer: runtimeScene.getLayer(\"Background\").getRenderer().getRendererObject(),",
  "  renderer: runtimeScene.getGame().getRenderer().getPIXIRenderer()",
  "}, ARENA, runtimeScene.__hubAmbience);"
];
const gatesJs = [
  "// Hub gates. Each Hub_Gate_Glow instance has Scene, Label and Color variables (set on the instance in the editor).",
  "// Standing in front of a glow shows \"[W] Label\" above the gate; W then loads that scene.",
  "// Generated by tools/hub/build.js: edit there and rebuild.",
  "const KEY = \"w\";",
  "const state = runtimeScene.__hubGates || (runtimeScene.__hubGates = { t: 0, tinted: false });",
  "state.t += runtimeScene.getElapsedTime() / 1000;",
  "const glows = runtimeScene.getObjects(\"Hub_Gate_Glow\");",
  "if (!state.tinted) {",
  "  state.tinted = true;",
  "  for (const g of glows) g.setColor(g.getVariables().get(\"Color\").getAsString());",
  "}",
  "const prompts = runtimeScene.getObjects(\"Hub_Prompt\");",
  "const prompt = prompts.length ? prompts[0] : null;",
  "const players = runtimeScene.getObjects(\"Player\");",
  "const player = players.length ? players[0] : null;",
  "let near = null;",
  "glows.forEach(function (g, i) {",
  "  // A slow breathing glow, brighter while the player stands in front of it.",
  "  const inFront = player && Math.abs(player.getCenterXInScene() - g.getCenterXInScene()) < g.getWidth() / 2 - 20 &&",
  "    player.getY() + player.getHeight() > g.getY() + g.getHeight() / 2;",
  "  if (inFront) near = g;",
  "  const k = 0.5 + 0.5 * Math.sin(state.t * 1.6 + i * 1.3);",
  "  g.setOpacity(inFront ? 235 + 20 * k : 150 + 50 * k);",
  "});",
  "if (prompt) {",
  "  if (near) {",
  "    prompt.setText(\"[W] \" + near.getVariables().get(\"Label\").getAsString());",
  "    prompt.setX(near.getCenterXInScene() - prompt.getWidth() / 2);",
  "    prompt.setY(near.getY() - 140);",
  "    prompt.hide(false);",
  "  } else prompt.hide(true);",
  "}",
  "if (near && gdjs.evtTools.input.wasKeyJustPressed(runtimeScene, KEY)) {",
  "  gdjs.evtTools.runtimeScene.replaceScene(runtimeScene, near.getVariables().get(\"Scene\").getAsString(), false);",
  "}"
];
d.events.push(
  comment("Hub ambience: the moon breathes, fog drifts and fireflies wander. The pieces are in the \"Hub pieces\" folder; their layout is in tools/hub/hub.js."),
  jsEvent(ambience),
  comment("Hub gates: stand in front of a gate's glow to see its name, press W to enter. Each Hub_Gate_Glow instance names its scene in its Scene variable."),
  jsEvent(gatesJs));

// 6. Keep the IDs of anything unchanged since the last build, so a rebuild only shows real changes in git.
const signature = node => JSON.stringify(node, (k, v) => (k === "persistentUuid" ? undefined : v));
const pool = new Map();
const collect = n => { if (Array.isArray(n)) n.forEach(collect); else if (n && typeof n === "object") {
  if (n.persistentUuid) { const s = signature(n); if (!pool.has(s)) pool.set(s, []); pool.get(s).push(n.persistentUuid); }
  for (const k of Object.keys(n)) collect(n[k]); } };
collect(before);
const reuse = n => { if (Array.isArray(n)) n.forEach(reuse); else if (n && typeof n === "object") {
  if (n.persistentUuid) { const list = pool.get(signature(n)); if (list && list.length) n.persistentUuid = list.shift(); }
  for (const k of Object.keys(n)) reuse(n[k]); } };
reuse(d);
save(F, d);

// 7. Project resources: the hub images and atlas in, the untinted atlas out.
const p = load("Soul Rush.json");
const images = new Set([ATLAS, ...HUB.items.map(i => i.img)]);
p.resources.resources = p.resources.resources.filter(r => r.name !== OLD_ATLAS && !(r.name.startsWith("assets/backgrounds/hub/") && !images.has(r.name)));
for (const img of images) if (!p.resources.resources.some(r => r.name === img))
  p.resources.resources.push({ file: img, kind: "image", metadata: "", name: img, smoothed: false, userAdded: true });
save("Soul Rush.json", p);
console.log("HUB_Area:", HUB.items.length, "piece types,", HUB.tiles.length, "tile pieces,", HUB.gates.length, "gates | images:", images.size);
