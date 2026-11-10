// Writes the hub from hub.js into layouts/hub_area.json and registers its images. Close GDevelop first.
// Usage: node tools/hub/build.js [project folder] [--force]. Safe to run again after editing hub.js: it removes what
// it added last time (Hub_* objects, Ruins_Tiles instances, the parallax layers, its own events) and rebuilds.
// It also puts the Player (and Player_Hitbox, keeping its offset) at hub.js's spawn point.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const HUB = require("./hub.js");
const root = process.argv.slice(2).find(a => !a.startsWith("--")) || path.join(__dirname, "..", "..");
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
const OUR_COMMENT = /^(Camera follow:|Hub ambience:|Hub gates:|Hub music:|Hub lights:|Hub crow:|Hub interactions:|Hub sounds:)/;

const F = "layouts/hub_area.json";
const d = load(F);
// Guard: Hub_* pieces are rebuilt from hub.js, so edits made to them in the editor (and not yet put into hub.js)
// would be lost. If the scene's Hub_* instances differ from the last commit, stop and list them.
// Run with --force to rebuild anyway.
if (!process.argv.includes("--force")) {
  try {
    const { execSync } = require("child_process");
    const head = JSON.parse(execSync("git show HEAD:" + F, { cwd: root, maxBuffer: 1e9 }).toString());
    const sig = list => list.filter(i => i.name.startsWith("Hub_")).map(i => i.name + " " + i.layer + " " + i.x + "," + i.y + " " + i.width + "x" + i.height).sort();
    const before = new Set(sig(head.instances)), now = sig(d.instances).filter(x => !before.has(x));
    const gone = [...before].filter(x => !sig(d.instances).includes(x));
    if (now.length || gone.length) {
      console.error("HUB_Area has Hub_* changes made outside build.js (moved, added or deleted in the editor?):");
      for (const x of gone) console.error("  was: " + x);
      for (const x of now) console.error("  now: " + x);
      console.error("Put them into tools/hub/hub.js (or commit them first if they came from a build), or run with --force to discard them.");
      process.exit(1);
    }
  } catch (e) { if (e.status === 1) throw e; /* no git or no commit: nothing to compare */ }
}
const before = JSON.parse(JSON.stringify(d));

// 1. Clean out the previous build.
d.objects = d.objects.filter(o => !OURS.test(o.name));
// Ruins_Tiles instances are the user's once they exist (painted and resized by hand in the editor): kept as they are.
const userTiles = d.instances.some(i => i.name === "Ruins_Tiles");
d.instances = d.instances.filter(i => !OURS.test(i.name));
const PARALLAX_LAYERS = Object.keys(HUB.parallax); // Back to front.
d.layers = d.layers.filter(l => !PARALLAX_LAYERS.includes(l.name) && l.name !== "Far" && l.name !== "Mid");
for (let k = d.events.length - 1; k >= 0; k--) if (d.events[k].comment && OUR_COMMENT.test(d.events[k].comment)) d.events.splice(k, 2);
const prune = f => { f.children = (f.children || []).filter(ch => {
  if (ch.objectName !== undefined) return !OURS.test(ch.objectName);
  prune(ch); return ch.children.length > 0 || ch.folderName === "Hub - Ruins"; }); };
prune(d.objectsFolderStructure);
let folder = d.objectsFolderStructure.children.find(ch => ch.folderName === "Hub - Ruins");
if (!folder) { folder = { folderName: "Hub - Ruins", children: [] }; d.objectsFolderStructure.children.push(folder); }
if (!folder.children.some(ch => ch.objectName === "Ruins_Tiles")) folder.children.push({ objectName: "Ruins_Tiles" });

// 2. The parallax layers, back to front, behind Background. The camera event scrolls each at its HUB.parallax share.
const bg = d.layers.find(l => l.name === "Background");
for (const name of PARALLAX_LAYERS)
  d.layers.splice(d.layers.indexOf(bg), 0, Object.assign(JSON.parse(JSON.stringify(bg)), { name, cameras: [], effects: [] }));

// 3. Tiles: the hub's tinted atlas, one Ruins_Tiles instance per piece, in front of the backdrop.
const tilesObj = d.objects.find(o => o.name === "Ruins_Tiles");
tilesObj.content.atlasImage = ATLAS;
const TILE_Z = 1000;
for (const t of userTiles ? [] : HUB.tiles) {
  const dimX = t.rows[0].length, dimY = t.rows.length;
  const tilemap = { tileWidth: 16, tileHeight: 16, dimX, dimY, layers: [{ id: 0, alpha: 1, tiles: t.rows }] };
  d.instances.push({ angle: 0, customSize: true, depth: 1, height: dimY * 32, keepRatio: true, layer: "Background", name: "Ruins_Tiles",
    persistentUuid: uuid(), width: dimX * 32, x: t.x, y: t.y, zOrder: TILE_Z, numberProperties: [],
    stringProperties: [{ name: "tilemap", value: JSON.stringify(tilemap) }], initialVariables: [] });
}

// 3b. Spawn: the Player at HUB.spawn, and Player_Hitbox moved by the same amount.
const playerInst = d.instances.find(i => i.name === "Player");
const dx = HUB.spawn[0] - playerInst.x, dy = HUB.spawn[1] - playerInst.y;
for (const i of d.instances) if (i.name === "Player" || i.name === "Player_Hitbox") { i.x += dx; i.y += dy; }

// 4. Sprites. Ledges get a jump-through Platform behaviour and a mask over their standing band.
const subfolder = { folderName: "Hub pieces", children: [] };
let z = 100;
for (const it of HUB.items) {
  // Animations: either a list ({ name, frames, time, loop, origin }) or one unnamed animation from img / frames.
  const anims = it.animations || [{ name: "", frames: it.frames || [it.img], time: it.frameTime || 0.08, loop: !!it.frames }];
  const [w, h] = it.size || pngSize(anims[0].frames[0]);
  const sx = it.size ? 1 : it.sx || it.scale || 1, sy = it.size ? 1 : it.sy || it.scale || 1;
  if (it.tiled) {
    // A Tiled Sprite: its image repeats sideways across the instance's width.
    d.objects.push({ assetStoreId: "", height: h, name: it.name, persistentUuid: uuid(), texture: it.img, type: "TiledSpriteObject::TiledSprite",
      width: w, variables: [], effects: [], behaviors: [] });
    subfolder.children.push({ objectName: it.name });
    z++;
    for (const [x, y] of it.at) d.instances.push({ angle: 0, customSize: true, depth: 1, height: h, keepRatio: false, layer: it.layer || "Background",
      name: it.name, persistentUuid: uuid(), width: it.width, x, y, zOrder: z, numberProperties: [], stringProperties: [], initialVariables: [] });
    continue;
  }
  const mask = it.mask ? [[{ x: it.mask[0], y: it.mask[1] }, { x: it.mask[2], y: it.mask[1] }, { x: it.mask[2], y: it.mask[3] }, { x: it.mask[0], y: it.mask[3] }]] : [];
  // vars: one object of string variables per instance; the object declares the same names, empty.
  const varNames = it.vars && it.vars.length ? Object.keys(it.vars[0]) : [];
  d.objects.push({
    adaptCollisionMaskAutomatically: false, assetStoreId: "", name: it.name, persistentUuid: uuid(), type: "Sprite", updateIfNotVisible: false,
    variables: varNames.map(n => ({ name: n, persistentUuid: uuid(), type: "string", value: "" })),
    effects: [],
    behaviors: it.platform ? [{ name: "Platform", type: "PlatformBehavior::PlatformBehavior", canBeGrabbed: false, platformType: "Jumpthru", yGrabOffset: 0 }] : [],
    animations: anims.map(a => ({ name: a.name, useMultipleDirections: false, directions: [{ looping: !!a.loop, timeBetweenFrames: a.time || 0.08,
      sprites: a.frames.map(image => ({ hasCustomCollisionMask: !!it.mask, image, points: [],
        originPoint: { name: "origine", x: a.origin ? a.origin[0] : 0, y: a.origin ? a.origin[1] : 0 },
        centerPoint: { automatic: true, name: "centre", x: 0, y: 0 }, customCollisionMask: mask })) }] }))
  });
  subfolder.children.push({ objectName: it.name });
  z++;
  it.at.forEach(([x, y], k) => d.instances.push({
    angle: 0, customSize: true, depth: 1, height: Math.round(h * sy), keepRatio: false, layer: it.layer || "Background", name: it.name,
    persistentUuid: uuid(), width: Math.round(w * sx), x, y, zOrder: it.z || z, numberProperties: [], stringProperties: [],
    initialVariables: varNames.map(n => ({ name: n, persistentUuid: uuid(), type: "string", value: it.vars[k][n] }))
  }));
}
// The light glow: no instances; the lights event creates one per light at scene start.
const GLOW = "assets/backgrounds/hub/light_glow.png";
d.objects.push({ adaptCollisionMaskAutomatically: false, assetStoreId: "", name: "Hub_Light_Glow", persistentUuid: uuid(), type: "Sprite", updateIfNotVisible: false,
  variables: [], effects: [], behaviors: [],
  animations: [{ name: "", useMultipleDirections: false, directions: [{ looping: false, timeBetweenFrames: 0.08, sprites: [{ hasCustomCollisionMask: false,
    image: GLOW, points: [], originPoint: { name: "origine", x: 0, y: 0 }, centerPoint: { automatic: true, name: "centre", x: 0, y: 0 }, customCollisionMask: [] }] }] }] });
subfolder.children.push({ objectName: "Hub_Light_Glow" });
// The dialog line: the keeper's words and the lectern's pages, at the bottom of the screen (UI layer).
d.objects.push({ assetStoreId: "", bold: false, italic: true, name: "Hub_Dialog", persistentUuid: uuid(), smoothed: true, type: "TextObject::Text",
  underlined: false, variables: [], effects: [], behaviors: [], string: "", font: "", textAlignment: "center", characterSize: 22,
  color: { b: 220, g: 232, r: 240 },
  content: { bold: false, isOutlineEnabled: true, isShadowEnabled: true, italic: true, outlineColor: "0;0;0", outlineThickness: 3, shadowAngle: 90,
    shadowBlurRadius: 2, shadowColor: "0;0;0", shadowDistance: 3, shadowOpacity: 127, smoothed: true, underlined: false, text: "", font: "",
    textAlignment: "center", verticalTextAlignment: "top", characterSize: 22, lineHeight: 0, color: "240;232;220" } });
subfolder.children.push({ objectName: "Hub_Dialog" });
d.instances.push({ angle: 0, customSize: false, depth: 1, height: 0, keepRatio: true, layer: "UI", name: "Hub_Dialog", persistentUuid: uuid(),
  width: 0, x: 640, y: 600, zOrder: 60, numberProperties: [], stringProperties: [], initialVariables: [] });
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
  "const PARALLAX = " + JSON.stringify(HUB.parallax) + "; // Each backdrop layer scrolls this share of the camera's movement.",
  "// The endless backdrops (Tiled Sprites) and their image widths. Each frame they are moved and sized to cover the screen,",
  "// in whole image widths so the pattern never jumps. However wide the hub gets, they never run out.",
  "const BACKDROPS = " + JSON.stringify(HUB.items.filter(i => i.tiled).map(i => ({ name: i.name, tile: pngSize(i.img)[0] }))) + ";",
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
  "let camY = game.getGameResolutionHeight() / 2;",
  "// A cutscene (the gates event) can take the camera: runtimeScene.__cameraOverride = { x, y, zoom }. The follow spot is",
  "// kept in runtimeScene.__cameraFollow, so the cutscene can glide back to it.",
  "runtimeScene.__cameraFollow = { x: camX, y: camY };",
  "const ov = runtimeScene.__cameraOverride;",
  "const zoom = ov ? ov.zoom : 1;",
  "if (ov) { camX = ov.x; camY = ov.y; }",
  "runtimeScene.__cameraBase = { x: camX, y: camY };",
  "for (const name of FOLLOW_LAYERS) {",
  "  if (!runtimeScene.hasLayer(name)) continue;",
  "  const layer = runtimeScene.getLayer(name);",
  "  layer.setCameraX(camX);",
  "  layer.setCameraY(camY);",
  "  layer.setCameraZoom(zoom);",
  "}",
  "for (const name in PARALLAX) {",
  "  if (!runtimeScene.hasLayer(name)) continue;",
  "  const layer = runtimeScene.getLayer(name);",
  "  layer.setCameraX(halfW + (camX - halfW) * PARALLAX[name]);",
  "  layer.setCameraY(camY);",
  "  layer.setCameraZoom(zoom);",
  "}",
  "const cover = runtimeScene.__backdropOrigin || (runtimeScene.__backdropOrigin = {});",
  "for (const b of BACKDROPS) for (const o of runtimeScene.getObjects(b.name)) {",
  "  const id = o.id;",
  "  if (cover[id] === undefined) cover[id] = o.getX(); // Where the editor put it: the pattern stays aligned to this.",
  "  const viewLeft = runtimeScene.getLayer(o.getLayer()).getCameraX() - halfW;",
  "  o.setX(cover[id] + Math.floor((viewLeft - cover[id]) / b.tile) * b.tile);",
  "  o.setWidth(halfW * 2 + b.tile * 2);",
  "}"
];
d.events.splice(pm + 1, 0,
  comment("Camera follow: keep the player mid-screen, stopping when the screen edge reaches an off-limits wall (the tall Invisible_Wall instances). The backdrop layers scroll slower, for depth, and the endless cathedral backdrops are kept covering the screen. Runs before Combat_Shared so its screen shake shakes around this spot."),
  jsEvent(camera));

const spec = { id: "Hub", name: "Hub", ambient: HUB.ambient,
  items: HUB.items.filter(it => it.anim || it.alpha !== undefined).map(it => ({ name: it.name, alpha: it.alpha, anim: it.anim })) };
const ambience = [
  "// Hub ambience. Generated by tools/hub/build.js from tools/hub/hub.js: edit there and rebuild.",
  "// The moving parts work as in the arenas (tools/arenas/ambient.js): drifting fog and dust motes in the candlelight.",
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
  "// Hub gates. Generated by tools/hub/build.js from tools/hub/hub.js: edit there and rebuild.",
  "// Every gate (a Hub_Gate_Glow or a gate-art sprite) has Scene, Label, State and Order variables, set on the instance.",
  "// Glow gates (no Order) are always open. Art gates open one at a time, by Order:",
  "//   locked    - an earlier gate's boss isn't beaten yet, or State is \"locked\": inert art, \"<Label> - sealed\".",
  "//   ready     - the next gate in order, not awakened yet: inert art, a faint glow, \"[F] Awaken - <Label>\".",
  "//   active    - awakened: the gate's live loop, \"[F] <Label>\" enters.",
  "//   completed - its boss is beaten: the completed art, still enterable for a rematch.",
  "// Awakening plays a short cutscene: the player freezes, the camera glides and zooms to the gate, the gate wakes",
  "// with a shake, holds, and the camera glides back. F or Esc skips it.",
  "// Progress (awakened gates, beaten bosses) is saved in local storage under SAVE_KEY, and merged with BossesBeaten,",
  "// the global structure Combat_Shared fills in when a boss falls. Debug: F10 wipes it (remove before release).",
  "// Each gate's shown state goes in its Shown variable, which the lights event reads.",
  "const KEY = \"f\";",
  "const SAVE_KEY = \"SoulRush.progress\";",
  "const ART = [\"Hub_Gate_Torii\", \"Hub_Gate_Eclipse\", \"Hub_Gate_Infernal\"];",
  "const ART_REACH = 70; // How far from an art gate's centre the player still counts as standing in its doorway.",
  "const CUT = { glideIn: 1.2, wait: 0.5, hold: 1.8, glideOut: 1.0, zoom: 1.45 }; // Cutscene timings (seconds) and zoom.",
  "const st = runtimeScene.__hubGates || (runtimeScene.__hubGates = { t: 0, ready: false, fronts: [], cut: null });",
  "const time = runtimeScene.getTimeManager();",
  "const dt = time.getElapsedTime() / 1000 / time.getTimeScale();",
  "st.t += dt;",
  "const game = runtimeScene.getGame();",
  "const input = gdjs.evtTools.input;",
  "const beaten = game.getVariables().get(\"BossesBeaten\");",
  "// Saved progress: { awakened: { scene: true }, beaten: { scene: true } }.",
  "const save = function () { try { localStorage.setItem(SAVE_KEY, JSON.stringify(st.progress)); } catch (e) {} };",
  "if (!st.progress) {",
  "  let p = null;",
  "  try { p = JSON.parse(localStorage.getItem(SAVE_KEY) || \"null\"); } catch (e) {}",
  "  st.progress = { awakened: (p && p.awakened) || {}, beaten: (p && p.beaten) || {} };",
  "  for (const scene in st.progress.beaten) beaten.getChild(scene).setBoolean(true);",
  "}",
  "for (const scene of Object.keys(beaten.getAllChildren())) {",
  "  if (beaten.getChild(scene).getAsBoolean() && !st.progress.beaten[scene]) { st.progress.beaten[scene] = true; save(); }",
  "}",
  "if (input.wasKeyJustPressed(runtimeScene, \"F10\")) {",
  "  st.progress = { awakened: {}, beaten: {} }; save();",
  "  for (const scene of Object.keys(beaten.getAllChildren())) beaten.removeChild(scene);",
  "}",
  "const isBeaten = function (scene) { return !!scene && !!st.progress.beaten[scene]; };",
  "const glows = runtimeScene.getObjects(\"Hub_Gate_Glow\");",
  "const arts = [];",
  "for (const name of ART) for (const o of runtimeScene.getObjects(name)) arts.push(o);",
  "if (!st.ready) {",
  "  st.ready = true;",
  "  for (const g of glows) { g.setColor(g.getVariables().get(\"Color\").getAsString()); g.setBlendMode(1); } // Additive: it reads as light.",
  "  // Each torii gets its front layer (spirits, petals), drawn over the crow, kept on the torii's spot and frame.",
  "  for (const t of runtimeScene.getObjects(\"Hub_Gate_Torii\")) {",
  "    const f = runtimeScene.createObject(\"Hub_Gate_Torii_Front\");",
  "    f.setLayer(t.getLayer()); f.setZOrder(t.getZOrder() + 2);",
  "    st.fronts.push({ t: t, f: f });",
  "  }",
  "}",
  "// The lowest Order whose boss isn't beaten: that gate is the one that can open.",
  "let nextOrder = Infinity;",
  "for (const o of arts) {",
  "  const v = o.getVariables(), order = Number(v.get(\"Order\").getAsString()) || Infinity;",
  "  if (!isBeaten(v.get(\"Scene\").getAsString())) nextOrder = Math.min(nextOrder, order);",
  "}",
  "const artState = function (o) {",
  "  const v = o.getVariables(), scene = v.get(\"Scene\").getAsString();",
  "  if (isBeaten(scene)) return \"completed\";",
  "  if (v.get(\"State\").getAsString() === \"locked\" || !scene) return \"locked\";",
  "  if ((Number(v.get(\"Order\").getAsString()) || Infinity) > nextOrder) return \"locked\";",
  "  return st.progress.awakened[scene] ? \"active\" : \"ready\";",
  "};",
  "const players = runtimeScene.getObjects(\"Player\");",
  "const player = players.length ? players[0] : null;",
  "const feet = player ? player.getY() + player.getHeight() : 0;",
  "let near = null;",
  "glows.forEach(function (g, i) {",
  "  g.getVariables().get(\"Shown\").setString(\"active\");",
  "  const inFront = player && Math.abs(player.getCenterXInScene() - g.getCenterXInScene()) < g.getWidth() / 2 - 20 && feet > g.getY() + g.getHeight() / 2;",
  "  if (inFront) near = { o: g, state: \"active\", promptY: g.getY() - 140 };",
  "  // A slow breathing glow, brighter while the player stands in front of it.",
  "  const k = 0.5 + 0.5 * Math.sin(st.t * 1.6 + i * 1.3);",
  "  g.setOpacity(inFront ? 235 + 20 * k : 150 + 50 * k);",
  "});",
  "for (const o of arts) {",
  "  const state = artState(o);",
  "  // While the cutscene is waking this gate, it stays inert until the moment it wakes.",
  "  const shown = st.cut && st.cut.gate === o && !st.cut.woke ? \"ready\" : state;",
  "  o.getVariables().get(\"Shown\").setString(shown);",
  "  const anim = shown === \"locked\" || shown === \"ready\" ? \"inactive\" : shown;",
  "  if (o.getAnimationName() !== anim) { o.setAnimationName(anim); o.setAnimationFrame(0); }",
  "  const inFront = player && Math.abs(player.getCenterXInScene() - o.getCenterXInScene()) < ART_REACH && feet > o.getY() + o.getHeight() / 2;",
  "  if (inFront) near = { o: o, state: state, promptY: o.getY() - 30 };",
  "}",
  "for (const p of st.fronts) {",
  "  p.f.setX(p.t.getX()); p.f.setY(p.t.getY()); p.f.setWidth(p.t.getWidth()); p.f.setHeight(p.t.getHeight());",
  "  const on = p.t.getAnimationName() === \"active\";",
  "  p.f.hide(!on);",
  "  if (on && p.f.getAnimationFrame() !== p.t.getAnimationFrame()) p.f.setAnimationFrame(p.t.getAnimationFrame());",
  "}",
  "// The awakening cutscene.",
  "const ease = function (k) { k = Math.max(0, Math.min(1, k)); return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; };",
  "const wake = function (c) {",
  "  if (c.woke) return;",
  "  c.woke = true;",
  "  st.progress.awakened[c.scene] = true; save();",
  "  game.getSoundManager().playSound(" + JSON.stringify(HUB.sounds.gong.file) + ", false, " + HUB.sounds.gong.volume + ", 1); // A deep gong.",
  "  if (player) { const pv = player.getVariables(); pv.get(\"ShakeLeft\").setNumber(0.45); pv.get(\"ShakeStrength\").setNumber(7); }",
  "};",
  "if (st.cut) {",
  "  const c = st.cut;",
  "  c.t += dt;",
  "  const follow = runtimeScene.__cameraFollow || c.from;",
  "  // Aim at the gate, but keep the bottom of the zoomed view on the screen's bottom edge (nothing is drawn below it).",
  "  const viewH = game.getGameResolutionHeight();",
  "  const target = { x: c.gate.getCenterXInScene(), y: Math.min(c.gate.getY() + c.gate.getHeight() * 0.5, viewH - viewH / 2 / CUT.zoom) };",
  "  const skip = input.wasKeyJustPressed(runtimeScene, KEY) || input.wasKeyJustPressed(runtimeScene, \"Escape\");",
  "  if (skip && c.phase !== \"out\") { wake(c); c.phase = \"out\"; c.t = 0; c.outFrom = { x: c.cam.x, y: c.cam.y, zoom: c.cam.zoom }; }",
  "  if (c.phase === \"in\") {",
  "    const k = ease(c.t / CUT.glideIn);",
  "    c.cam = { x: c.from.x + (target.x - c.from.x) * k, y: c.from.y + (target.y - c.from.y) * k, zoom: 1 + (CUT.zoom - 1) * k };",
  "    if (c.t >= CUT.glideIn) { c.phase = \"hold\"; c.t = 0; }",
  "  } else if (c.phase === \"hold\") {",
  "    c.cam = { x: target.x, y: target.y, zoom: CUT.zoom };",
  "    if (c.t >= CUT.wait) wake(c);",
  "    if (c.t >= CUT.wait + CUT.hold) { c.phase = \"out\"; c.t = 0; c.outFrom = { x: c.cam.x, y: c.cam.y, zoom: c.cam.zoom }; }",
  "  } else if (c.phase === \"out\") {",
  "    const k = ease(c.t / CUT.glideOut);",
  "    c.cam = { x: c.outFrom.x + (follow.x - c.outFrom.x) * k, y: c.outFrom.y + (follow.y - c.outFrom.y) * k, zoom: c.outFrom.zoom + (1 - c.outFrom.zoom) * k };",
  "    if (c.t >= CUT.glideOut) {",
  "      st.cut = null; runtimeScene.__cameraOverride = null;",
  "      if (player) player.getVariables().get(\"ControlsLocked\").setBoolean(false);",
  "    }",
  "  }",
  "  if (st.cut) runtimeScene.__cameraOverride = c.cam;",
  "}",
  "// Prompt and the F key.",
  "const prompts = runtimeScene.getObjects(\"Hub_Prompt\");",
  "const prompt = prompts.length ? prompts[0] : null;",
  "if (prompt) {",
  "  if (near && !st.cut) {",
  "    const label = near.o.getVariables().get(\"Label\").getAsString();",
  "    prompt.setText(near.state === \"locked\" ? label + \" - sealed\" : near.state === \"ready\" ? \"[F] Awaken - \" + label : \"[F] \" + label);",
  "    prompt.setX(near.o.getCenterXInScene() - prompt.getWidth() / 2);",
  "    prompt.setY(near.promptY);",
  "    prompt.hide(false);",
  "  } else prompt.hide(true);",
  "}",
  "if (near && !st.cut && input.wasKeyJustPressed(runtimeScene, KEY)) {",
  "  const scene = near.o.getVariables().get(\"Scene\").getAsString();",
  "  if (near.state === \"ready\") {",
  "    if (player) player.getVariables().get(\"ControlsLocked\").setBoolean(true);",
  "    const from = runtimeScene.__cameraFollow || { x: runtimeScene.getLayer(\"\").getCameraX(), y: runtimeScene.getLayer(\"\").getCameraY() };",
  "    st.cut = { gate: near.o, scene: scene, phase: \"in\", t: 0, woke: false, from: from, cam: { x: from.x, y: from.y, zoom: 1 } };",
  "  } else if (near.state !== \"locked\" && scene) {",
  "    gdjs.evtTools.runtimeScene.replaceScene(runtimeScene, scene, false);",
  "  }",
  "}"
];
const crowJs = [
  "// The torii crow, as the gates pack's HANDOFF.md describes it. Generated by tools/hub/build.js: edit tools/hub/hub.js and rebuild.",
  "// Each torii gets one crow, drawn between the torii's back (portal, gate, lanterns) and front (spirits, petals).",
  "// Cycle: appear (dust gathers) -> idle on a perch (15-40 s; every 4-10 s it hops 1-3 times along the beam) ->",
  "// vanish (dusts away) -> gone (6-15 s) -> appear again at a random perch, facing a random way.",
  "// The animations' origins are the feet anchors, so the crow's X/Y is where its feet are: gate X/Y + perch * gate scale.",
  "const C = " + JSON.stringify(HUB.crow) + ";",
  "const st = runtimeScene.__hubCrows || (runtimeScene.__hubCrows = { birds: null });",
  "const dt = runtimeScene.getElapsedTime() / 1000;",
  "const rnd = function (r) { return r[0] + Math.random() * (r[1] - r[0]); };",
  "const perchAt = function (px) { const i = C.perchX.indexOf(px); return i < 0 ? null : C.perchY[i]; };",
  "if (!st.birds) {",
  "  st.birds = [];",
  "  for (const t of runtimeScene.getObjects(\"Hub_Gate_Torii\")) {",
  "    const o = runtimeScene.createObject(\"Hub_Crow\");",
  "    o.setLayer(t.getLayer()); o.setZOrder(t.getZOrder() + 1);",
  "    o.hide(true);",
  "    st.birds.push({ o: o, t: t, mode: \"gone\", timer: rnd([1, 4]), px: 0, dir: 1 });",
  "  }",
  "}",
  "for (const b of st.birds) {",
  "  const t = b.t, o = b.o, scale = t.getWidth() / 128;",
  "  o.setScale(scale);",
  "  const place = function (px, py) { o.setX(t.getX() + px * scale); o.setY(t.getY() + py * scale); };",
  "  const play = function (name) { o.setAnimationName(name + (b.dir > 0 ? \"_right\" : \"_left\")); o.setAnimationFrame(0); };",
  "  b.timer -= dt;",
  "  if (b.mode === \"gone\") {",
  "    if (b.timer <= 0) {",
  "      b.px = C.perchX[Math.floor(Math.random() * C.perchX.length)];",
  "      b.dir = Math.random() < 0.5 ? 1 : -1;",
  "      b.mode = \"appear\"; o.hide(false); play(\"appear\");",
  "      place(b.px, perchAt(b.px));",
  "    }",
  "  } else if (b.mode === \"appear\") {",
  "    if (o.hasAnimationEnded()) { b.mode = \"idle\"; b.stay = rnd(C.stay); b.timer = rnd(C.hopEvery); b.hopsLeft = 0; play(\"idle\"); }",
  "  } else if (b.mode === \"idle\") {",
  "    b.stay -= dt;",
  "    if (b.stay <= 0) { b.mode = \"vanish\"; play(\"vanish\"); }",
  "    else if (b.timer <= 0) {",
  "      if (b.hopsLeft <= 0) b.hopsLeft = Math.round(rnd(C.hops));",
  "      const to = b.px + C.hopBy * b.dir;",
  "      if (perchAt(to) === null) { b.dir = -b.dir; play(\"idle\"); b.timer = rnd([0.8, 2]); b.hopsLeft = 0; } // End of a beam: turn round.",
  "      else { b.mode = \"hop\"; b.from = b.px; b.to = to; b.hopT = 0; play(\"hop\"); }",
  "    }",
  "  } else if (b.mode === \"hop\") {",
  "    // The hop animation carries the bird 10 px; the feet stay on the start perch's X while the Y follows the beam's curve.",
  "    b.hopT += dt;",
  "    const k = Math.min(1, b.hopT / (C.hopFrames * C.hopTime));",
  "    place(b.from, perchAt(b.from) + (perchAt(b.to) - perchAt(b.from)) * k);",
  "    if (o.hasAnimationEnded()) {",
  "      b.px = b.to; b.mode = \"idle\"; play(\"idle\");",
  "      b.hopsLeft--; b.timer = b.hopsLeft > 0 ? 0.35 : rnd(C.hopEvery);",
  "    }",
  "  } else if (b.mode === \"vanish\") {",
  "    if (o.hasAnimationEnded()) { b.mode = \"gone\"; o.hide(true); b.timer = rnd(C.gone); }",
  "  }",
  "  if (b.mode === \"idle\" || b.mode === \"vanish\" || b.mode === \"appear\") place(b.px, perchAt(b.px));",
  "}"
];
const interactJs = [
  "// Hub interactions. Generated by tools/hub/build.js from tools/hub/hub.js: edit there and rebuild.",
  "// Furniture with an Action variable answers to F when the player stands at it (and no gate is in reach):",
  "//   rest  - the bench: a warm fade, and the player's HP, stamina and posture are restored.",
  "//   speak - the keeper: a line for how far the player has come (the next line on each press).",
  "//   read  - the lectern: the next page.",
  "// Lines show in Hub_Dialog at the bottom of the screen and fade after a few seconds.",
  "// Also shows each trophy relic once its boss is beaten (the relic's Scene variable).",
  "const DATA = " + JSON.stringify({ keeper: HUB.keeper, lectern: HUB.lectern }) + ";",
  "const KEY = \"f\", REACH = 60, SHOW = 5.5, REST = 2.6;",
  "const st = runtimeScene.__hubTalk || (runtimeScene.__hubTalk = { t: 0, talk: 0, read: 0, dialogLeft: 0, rest: null });",
  "const time = runtimeScene.getTimeManager();",
  "const dt = time.getElapsedTime() / 1000 / time.getTimeScale();",
  "st.t += dt;",
  "const input = gdjs.evtTools.input;",
  "const gates = runtimeScene.__hubGates || {};",
  "const progress = gates.progress || { awakened: {}, beaten: {} };",
  "// Relics.",
  "for (const name of [\"Hub_Relic_Katana\", \"Hub_Relic_Bow\"]) for (const o of runtimeScene.getObjects(name))",
  "  o.hide(!progress.beaten[o.getVariables().get(\"Scene\").getAsString()]);",
  "// The dialog line fades out on its own.",
  "const dialogs = runtimeScene.getObjects(\"Hub_Dialog\"), dialog = dialogs.length ? dialogs[0] : null;",
  "const say = function (text) {",
  "  if (!dialog) return;",
  "  dialog.setWrapping(true); dialog.setWrappingWidth(900); dialog.setText(text);",
  "  dialog.setX(640 - dialog.getWidth() / 2); dialog.setY(612 - dialog.getHeight() / 2);",
  "  st.dialogLeft = SHOW;",
  "};",
  "if (dialog) { st.dialogLeft = Math.max(0, st.dialogLeft - dt); dialog.setOpacity(255 * Math.min(1, st.dialogLeft / 0.6)); }",
  "const players = runtimeScene.getObjects(\"Player\");",
  "if (!players.length) return;",
  "const player = players[0], pv = player.getVariables();",
  "// The rest: a warm fade out and back in; the player is restored at its darkest.",
  "if (st.rest) {",
  "  const r = st.rest; r.t += dt;",
  "  const k = r.t < REST / 2 ? r.t / (REST / 2) : Math.max(0, 1 - (r.t - REST / 2) / (REST / 2));",
  "  r.overlay.alpha = 0.7 * k;",
  "  if (!r.restored && r.t >= REST / 2) {",
  "    r.restored = true;",
  "    pv.get(\"Health\").setNumber(pv.get(\"MaxHealth\").getAsNumber());",
  "    pv.get(\"Stamina\").setNumber(pv.get(\"MaxStamina\").getAsNumber());",
  "    pv.get(\"Posture\").setNumber(0);",
  "  }",
  "  if (r.t >= REST) {",
  "    r.overlay.parent && r.overlay.parent.removeChild(r.overlay); r.overlay.destroy(); st.rest = null;",
  "    pv.get(\"ControlsLocked\").setBoolean(false);",
  "    say(\"The fire's warmth settles into your bones.\");",
  "  }",
  "  return;",
  "}",
  "if (gates.cut) return; // A gate is waking: leave the prompt and F to it.",
  "// Find the furniture the player stands at (only when no gate prompt is showing).",
  "const prompts = runtimeScene.getObjects(\"Hub_Prompt\"), prompt = prompts.length ? prompts[0] : null;",
  "if (prompt && !prompt.isHidden()) return;",
  "let near = null;",
  "for (const name of [\"Hub_Bench\", \"Hub_Keeper\", \"Hub_Lectern\"]) for (const o of runtimeScene.getObjects(name))",
  "  if (Math.abs(player.getCenterXInScene() - o.getCenterXInScene()) < o.getWidth() / 2 + REACH / 2) near = o;",
  "if (!near) return;",
  "const action = near.getVariables().get(\"Action\").getAsString();",
  "if (prompt) {",
  "  prompt.setText(action === \"rest\" ? \"[F] Rest\" : action === \"speak\" ? \"[F] Speak\" : \"[F] Read\");",
  "  prompt.setX(near.getCenterXInScene() - prompt.getWidth() / 2);",
  "  prompt.setY(near.getY() - 50);",
  "  prompt.hide(false);",
  "}",
  "if (!input.wasKeyJustPressed(runtimeScene, KEY)) return;",
  "if (action === \"rest\") {",
  "  pv.get(\"ControlsLocked\").setBoolean(true);",
  "  const ui = runtimeScene.getLayer(\"UI\"), game = runtimeScene.getGame();",
  "  const g = new PIXI.Graphics(); g.beginFill(0x1a0c04, 1); g.drawRect(0, 0, game.getGameResolutionWidth(), game.getGameResolutionHeight()); g.endFill();",
  "  g.alpha = 0; g.zIndex = 900000; ui.getRenderer().getRendererObject().addChild(g);",
  "  st.rest = { t: 0, overlay: g, restored: false };",
  "  if (prompt) prompt.hide(true);",
  "} else if (action === \"speak\") {",
  "  const stage = progress.beaten.Leaf_Ranger_Fight ? \"leafBeaten\" : progress.beaten.Samurai_Fight ? \"samuraiBeaten\" : progress.awakened.Samurai_Fight ? \"samuraiAwake\" : \"start\";",
  "  if (st.stage !== stage) { st.stage = stage; st.talk = 0; }",
  "  const list = DATA.keeper[stage];",
  "  say(list[st.talk % list.length]); st.talk++;",
  "} else if (action === \"read\") {",
  "  say(DATA.lectern[st.read % DATA.lectern.length]); st.read++;",
  "}"
];
const soundsJs = [
  "// Hub sounds. Generated by tools/hub/build.js from tools/hub/hub.js (sounds.js makes the files).",
  "// The hearth crackles on its own channel, louder the nearer the player is;",
  "// a distant bell rings now and then. The next scene stops them all.",
  "const S = " + JSON.stringify(HUB.sounds) + ";",
  "const st = runtimeScene.__hubSounds || (runtimeScene.__hubSounds = { started: false, bell: S.bell.every[0] * Math.random() + 10 });",
  "const sm = runtimeScene.getGame().getSoundManager();",
  "const dt = runtimeScene.getElapsedTime() / 1000;",
  "if (!st.started) {",
  "  st.started = true;",
  "  sm.playSoundOnChannel(S.hearth.file, S.hearth.channel, true, 0, 1);",
  "}",
  "const players = runtimeScene.getObjects(\"Player\"), hearths = runtimeScene.getObjects(\"Hub_Hearth\");",
  "const crackle = sm.getSoundOnChannel(S.hearth.channel);",
  "if (crackle && players.length && hearths.length) {",
  "  const d = Math.abs(players[0].getCenterXInScene() - hearths[0].getCenterXInScene());",
  "  const k = Math.max(0, Math.min(1, (S.hearth.far - d) / (S.hearth.far - S.hearth.near)));",
  "  crackle.setVolume(S.hearth.volume / 100 * (0.08 + 0.92 * k * k));",
  "}",
  "st.bell -= dt;",
  "if (st.bell <= 0) { sm.playSound(S.bell.file, false, S.bell.volume, 0.97 + Math.random() * 0.06); st.bell = S.bell.every[0] + Math.random() * (S.bell.every[1] - S.bell.every[0]); }"
];
const M = HUB.music;
const musicJs = [
  "// Hub music: " + M.title + ". The intro (a lead-in plus one loop cycle) plays once, then the loop repeats.",
  "// Both play as sounds, not music: sounds are decoded up front and loop without a gap, while music streams and can click at the seam.",
  "// The next scene stops it (Stop sounds on startup). Generated by tools/hub/build.js from tools/hub/hub.js: edit there and rebuild.",
  "const INTRO = " + JSON.stringify(M.intro) + ";",
  "const LOOP = " + JSON.stringify(M.loop) + ";",
  "const VOLUME = " + M.volume + "; // 0 to 100, like the fight music.",
  "const CHANNEL = " + M.channel + ";",
  "if (runtimeScene.__hubMusicStarted) return;",
  "runtimeScene.__hubMusicStarted = true;",
  "const sm = runtimeScene.getGame().getSoundManager();",
  "sm.playSoundOnChannel(INTRO, CHANNEL, false, VOLUME, 1);",
  "const intro = sm.getSoundOnChannel(CHANNEL);",
  "intro.once(\"end\", function () {",
  "  // Only if the intro is still this channel's sound (not stopped by a scene change or replaced).",
  "  if (sm.getSoundOnChannel(CHANNEL) === intro) sm.playSoundOnChannel(LOOP, CHANNEL, true, VOLUME, 1);",
  "});"
];
d.events.push(
  comment("Hub music: " + M.title + " (" + M.credit + "). The intro plays once, then the loop repeats."),
  jsEvent(musicJs),
  comment("Hub ambience: fog drifts and dust motes float in the candlelight. The pieces are in the \"Hub pieces\" folder; their layout is in tools/hub/hub.js."),
  jsEvent(ambience),
  comment("Hub gates: the boss gates open one at a time (Order). Walk up to the next one and press F to awaken it (a short camera move shows it waking); F at an awakened gate enters it. A beaten boss's gate shows its completed art. Progress is saved in local storage; F10 wipes it (debug)."),
  jsEvent(gatesJs),
  comment("Hub crow: a crow lives on each torii gate. It perches, hops along the beam, and vanishes and reappears as dust."),
  jsEvent(crowJs));

const LIGHTS = {};
for (const it of HUB.items) if (it.light) LIGHTS[it.name] = it.light;
const lightsJs = [
  "// Hub lights. Generated by tools/hub/build.js from the light entries in tools/hub/hub.js: edit there and rebuild.",
  "// At scene start every light source instance gets its glows (Hub_Light_Glow, additive, tinted). Each frame the glows",
  "// follow their source and flicker, and embers rise from the fires. Moving or copying a light in the editor moves its glow.",
  "const LIGHTS = " + JSON.stringify(LIGHTS) + ";",
  "const GLOW_Z = 1500; // Above the floor tiles (1000), so the light falls on them too.",
  "const st = runtimeScene.__hubLights || (runtimeScene.__hubLights = { t: 0, glows: [], embers: [], sources: [] });",
  "const dt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000);",
  "st.t += dt;",
  "if (!st.ready) {",
  "  st.ready = true;",
  "  for (const name in LIGHTS) for (const o of runtimeScene.getObjects(name)) {",
  "    // Animated fires start on a random frame, so they don't all flicker in step.",
  "    if (o.getAnimationFrameCount && o.getAnimationFrameCount() > 1) o.setAnimationFrame(Math.floor(Math.random() * o.getAnimationFrameCount()));",
  "    for (const L of LIGHTS[name]) {",
  "      const g = runtimeScene.createObject(\"Hub_Light_Glow\");",
  "      if (!g) continue;",
  "      g.setLayer(o.getLayer());",
  "      g.setZOrder(GLOW_Z);",
  "      g.setBlendMode(1); // Additive.",
  "      g.setColor(L.color.join(\";\"));",
  "      st.glows.push({ g: g, o: o, L: L, phase: Math.random() * 100 });",
  "      if (L.embers) st.sources.push({ o: o, L: L, carry: 0 });",
  "    }",
  "  }",
  "  // Embers are tiny PIXI sprites on the Background layer, drawn above the glows.",
  "  const layer = runtimeScene.getLayer(\"Background\");",
  "  st.container = new PIXI.Container();",
  "  st.container.zIndex = GLOW_Z + 10;",
  "  layer.getRenderer().getRendererObject().addChild(st.container);",
  "  const dot = new PIXI.Graphics();",
  "  dot.beginFill(0xffffff, 1); dot.drawRect(0, 0, 2, 2); dot.endFill();",
  "  st.texture = runtimeScene.getGame().getRenderer().getPIXIRenderer().generateTexture(dot);",
  "}",
  "// Flicker: two quick waves and a slow breath, different for every glow.",
  "for (const e of st.glows) {",
  "  const k = 0.84 + 0.07 * Math.sin(st.t * 9.3 + e.phase) + 0.05 * Math.sin(st.t * 23.1 + e.phase * 1.7) + 0.04 * Math.sin(st.t * 1.3 + e.phase);",
  "  const r = e.L.r * (0.96 + 0.05 * k);",
  "  e.g.setWidth(r * 2); e.g.setHeight(r * 2);",
  "  e.g.setX(e.o.getX() + e.L.x - r); e.g.setY(e.o.getY() + e.L.y - r);",
  "  // A light with states (gate art) shines only as much as the gate's shown state allows (set by the gates event).",
  "  const stateK = e.L.states ? e.L.states[e.o.getVariables().get(\"Shown\").getAsString()] || 0 : 1;",
  "  e.g.setOpacity(255 * e.L.strength * k * stateK);",
  "}",
  "// God rays: moonlight through the windows, additive and pale blue, slowly breathing.",
  "runtimeScene.getObjects(\"Hub_God_Ray\").forEach(function (o, i) {",
  "  if (!o.__rayReady) { o.__rayReady = true; o.setBlendMode(1); o.setColor(\"170;195;240\"); }",
  "  o.setOpacity(255 * (0.11 + 0.05 * Math.sin(st.t * 0.35 + i * 1.9) + 0.02 * Math.sin(st.t * 1.1 + i)));",
  "});",
  "// Embers: a few per second per fire, rising, drifting and cooling from yellow to red before they fade.",
  "for (const s of st.sources) {",
  "  s.carry += dt * 5 * s.L.embers;",
  "  while (s.carry >= 1) {",
  "    s.carry -= 1;",
  "    const p = new PIXI.Sprite(st.texture);",
  "    st.container.addChild(p);",
  "    st.embers.push({ p: p, x: s.o.getX() + s.L.x + (Math.random() - 0.5) * 18, y: s.o.getY() + s.L.y + (Math.random() - 0.5) * 10,",
  "      vx: (Math.random() - 0.5) * 24, vy: -40 - Math.random() * 45, life: 0, max: 1.4 + Math.random() * 1.8, ph: Math.random() * 6 });",
  "  }",
  "}",
  "for (let i = st.embers.length - 1; i >= 0; i--) {",
  "  const e = st.embers[i];",
  "  e.life += dt;",
  "  if (e.life >= e.max) { st.container.removeChild(e.p); e.p.destroy(); st.embers.splice(i, 1); continue; }",
  "  const t = e.life / e.max;",
  "  e.vx += Math.sin(st.t * 3 + e.ph) * 14 * dt;",
  "  e.x += e.vx * dt; e.y += e.vy * dt;",
  "  e.p.x = Math.round(e.x); e.p.y = Math.round(e.y);",
  "  e.p.tint = t < 0.35 ? 0xffd27a : t < 0.7 ? 0xff8a3c : 0xc8401c;",
  "  e.p.alpha = (1 - t) * (0.6 + 0.4 * Math.sin(e.life * 20 + e.ph));",
  "}"
];
d.events.push(
  comment("Hub lights: the hearth, torches, candles, candelabras, chandeliers and gate art glow and flicker, embers rise from the fires, and the god rays breathe. Each light source object brings its own glow, so lights can be moved or copied in the editor."),
  jsEvent(lightsJs),
  comment("Hub interactions: F at the bench rests, at the keeper speaks, at the lectern reads. Trophy relics appear once their boss is beaten."),
  jsEvent(interactJs),
  comment("Hub sounds: the hearth crackles louder as the player nears it, and a distant bell rings now and then."),
  jsEvent(soundsJs));

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
const images = new Set([ATLAS, GLOW, ...HUB.items.flatMap(i => i.animations ? i.animations.flatMap(a => a.frames) : i.frames || [i.img])]);
p.resources.resources = p.resources.resources.filter(r => r.name !== OLD_ATLAS && !(r.name.startsWith("assets/backgrounds/hub/") && !images.has(r.name)));
for (const img of images) if (!p.resources.resources.some(r => r.name === img))
  p.resources.resources.push({ file: img, kind: "image", metadata: "", name: img, smoothed: false, userAdded: true });
// The music, preloaded as sounds so the intro starts at once and the loop is gapless.
// Hub sounds no longer in hub.js are dropped.
const soundFiles = new Set(Object.values(HUB.sounds).map(x => x.file));
p.resources.resources = p.resources.resources.filter(r => !r.name.startsWith("assets/Sfx/hub/") || soundFiles.has(r.name));
for (const f of [M.intro, M.loop, ...Object.values(HUB.sounds).map(x => x.file)]) {
  p.resources.resources = p.resources.resources.filter(r => r.name !== f);
  p.resources.resources.push({ file: f, kind: "audio", metadata: "", name: f, preloadAsMusic: false, preloadAsSound: true, preloadInCache: false, userAdded: true });
}
// BossesBeaten: the global structure Combat_Shared fills in when a boss falls, read by the hub gates.
if (!p.variables.some(v => v.name === "BossesBeaten")) p.variables.push({ name: "BossesBeaten", persistentUuid: uuid(), type: "structure", children: [] });
save("Soul Rush.json", p);
console.log("HUB_Area:", HUB.items.length, "piece types,", HUB.tiles.length, "tile pieces,", HUB.gates.length, "gates | images:", images.size);
