// Writes the hub from hub.js into layouts/hub_area.json and registers its images. Close GDevelop first.
// Usage: node tools/hub/build.js [project folder]. Safe to run again after editing hub.js: it removes what
// it added last time (Hub_* objects, Ruins_Tiles instances, the parallax layers, its own events) and rebuilds.
// It also puts the Player (and Player_Hitbox, keeping its offset) at hub.js's spawn point.
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
const OUR_COMMENT = /^(Camera follow:|Hub ambience:|Hub gates:|Hub music:|Hub lights:)/;

const F = "layouts/hub_area.json";
const d = load(F);
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
  const images = it.frames || [it.img];
  const [w, h] = pngSize(images[0]);
  const sx = it.sx || it.scale || 1, sy = it.sy || it.scale || 1;
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
  d.objects.push({
    adaptCollisionMaskAutomatically: false, assetStoreId: "", name: it.name, persistentUuid: uuid(), type: "Sprite", updateIfNotVisible: false,
    variables: it.gate ? ["Scene", "Label", "Color"].map(n => ({ name: n, persistentUuid: uuid(), type: "string", value: "" })) : [],
    effects: [],
    behaviors: it.platform ? [{ name: "Platform", type: "PlatformBehavior::PlatformBehavior", canBeGrabbed: false, platformType: "Jumpthru", yGrabOffset: 0 }] : [],
    animations: [{ name: "", useMultipleDirections: false, directions: [{ looping: !!it.frames, timeBetweenFrames: it.frameTime || 0.08,
      sprites: images.map(image => ({ hasCustomCollisionMask: !!it.mask, image, points: [], originPoint: { name: "origine", x: 0, y: 0 },
        centerPoint: { automatic: true, name: "centre", x: 0, y: 0 }, customCollisionMask: mask })) }] }]
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
// The light glow: no instances; the lights event creates one per light at scene start.
const GLOW = "assets/backgrounds/hub/light_glow.png";
d.objects.push({ adaptCollisionMaskAutomatically: false, assetStoreId: "", name: "Hub_Light_Glow", persistentUuid: uuid(), type: "Sprite", updateIfNotVisible: false,
  variables: [], effects: [], behaviors: [],
  animations: [{ name: "", useMultipleDirections: false, directions: [{ looping: false, timeBetweenFrames: 0.08, sprites: [{ hasCustomCollisionMask: false,
    image: GLOW, points: [], originPoint: { name: "origine", x: 0, y: 0 }, centerPoint: { automatic: true, name: "centre", x: 0, y: 0 }, customCollisionMask: [] }] }] }] });
subfolder.children.push({ objectName: "Hub_Light_Glow" });
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
  "const camY = game.getGameResolutionHeight() / 2;",
  "runtimeScene.__cameraBase = { x: camX, y: camY };",
  "for (const name of FOLLOW_LAYERS) {",
  "  if (!runtimeScene.hasLayer(name)) continue;",
  "  const layer = runtimeScene.getLayer(name);",
  "  layer.setCameraX(camX);",
  "  layer.setCameraY(camY);",
  "}",
  "for (const name in PARALLAX) {",
  "  if (!runtimeScene.hasLayer(name)) continue;",
  "  const layer = runtimeScene.getLayer(name);",
  "  layer.setCameraX(halfW + (camX - halfW) * PARALLAX[name]);",
  "  layer.setCameraY(camY);",
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
  "// Hub gates. Each Hub_Gate_Glow instance has Scene, Label and Color variables (set on the instance in the editor).",
  "// Standing in front of a glow shows \"[W] Label\" above the gate; W then loads that scene.",
  "// Generated by tools/hub/build.js: edit there and rebuild.",
  "const KEY = \"w\";",
  "const state = runtimeScene.__hubGates || (runtimeScene.__hubGates = { t: 0, tinted: false });",
  "state.t += runtimeScene.getElapsedTime() / 1000;",
  "const glows = runtimeScene.getObjects(\"Hub_Gate_Glow\");",
  "if (!state.tinted) {",
  "  state.tinted = true;",
  "  for (const g of glows) { g.setColor(g.getVariables().get(\"Color\").getAsString()); g.setBlendMode(1); } // Additive: it reads as light.",
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
  comment("Hub gates: stand in front of a gate's glow to see its name, press W to enter. Each Hub_Gate_Glow instance names its scene in its Scene variable."),
  jsEvent(gatesJs));

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
  "  e.g.setOpacity(255 * e.L.strength * k);",
  "}",
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
  comment("Hub lights: the braziers, hearth, candelabras and chandeliers glow and flicker, and embers rise from the fires. Each light source object brings its own glow, so lights can be moved or copied in the editor."),
  jsEvent(lightsJs));

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
const images = new Set([ATLAS, GLOW, ...HUB.items.flatMap(i => i.frames || [i.img])]);
p.resources.resources = p.resources.resources.filter(r => r.name !== OLD_ATLAS && !(r.name.startsWith("assets/backgrounds/hub/") && !images.has(r.name)));
for (const img of images) if (!p.resources.resources.some(r => r.name === img))
  p.resources.resources.push({ file: img, kind: "image", metadata: "", name: img, smoothed: false, userAdded: true });
// The music, preloaded as sounds so the intro starts at once and the loop is gapless.
for (const f of [M.intro, M.loop]) {
  p.resources.resources = p.resources.resources.filter(r => r.name !== f);
  p.resources.resources.push({ file: f, kind: "audio", metadata: "", name: f, preloadAsMusic: false, preloadAsSound: true, preloadInCache: false, userAdded: true });
}
save("Soul Rush.json", p);
console.log("HUB_Area:", HUB.items.length, "piece types,", HUB.tiles.length, "tile pieces,", HUB.gates.length, "gates | images:", images.size);
