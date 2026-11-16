// Helpers for tools/bosses/build.js: GDevelop JSON for sprite objects, instances, events and the project's resource list.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..", "..");
const uuid = () => crypto.randomUUID();
const yellow = { b: 109, g: 230, r: 255, textB: 0, textG: 0, textR: 0 };
const comment = text => ({ type: "BuiltinCommonInstructions::Comment", color: yellow, comment: text });
const jsEvent = text => ({ type: "BuiltinCommonInstructions::JsCode", inlineCode: text.replace(/\r\n/g, "\n").split("\n"), parameterObjects: "", useStrict: true, eventsSheetExpanded: false });
const link = target => ({ type: "BuiltinCommonInstructions::Link", include: { includeConfig: 0 }, target });
const cond = (type, parameters) => ({ type: { inverted: false, value: type }, parameters });
const act = (type, parameters) => ({ type: { value: type }, parameters });
const standard = (conditions, actions, events) => ({ type: "BuiltinCommonInstructions::Standard", conditions, actions, events: events || [] });

const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const writeJson = (rel, data) => fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(data, null, 2) + "\n");

// A GDevelop variable list from { name: value }: numbers, booleans and strings keep their type.
const variables = obj => Object.keys(obj).map(name => {
  const value = obj[name], type = typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
  return { name, persistentUuid: uuid(), type, value };
});

// frames: [{ image, origin: [x, y], mask: [x0, y0, x1, y1] | null, points: { Name: [x, y] } }]
function animation(name, frames, dt, loop) {
  const times = Array.isArray(dt) ? dt : null;
  // GDevelop has one time per animation; a per-frame list is only used by the kit, which drives the frames itself.
  const time = times ? times.reduce((a, b) => a + b, 0) / times.length : dt;
  return { name, useMultipleDirections: false, directions: [{ looping: !!loop, metadata: "{\"pskl\":{}}", timeBetweenFrames: time,
    sprites: frames.map(f => ({
      hasCustomCollisionMask: !!f.mask, image: f.image,
      points: Object.keys(f.points || {}).map(n => ({ name: n, x: f.points[n][0], y: f.points[n][1] })),
      originPoint: { name: "origine", x: f.origin[0], y: f.origin[1] },
      centerPoint: { automatic: true, name: "centre", x: 0, y: 0 },
      customCollisionMask: f.mask ? [[{ x: f.mask[0], y: f.mask[1] }, { x: f.mask[2], y: f.mask[1] }, { x: f.mask[2], y: f.mask[3] }, { x: f.mask[0], y: f.mask[3] }]] : []
    })) }] };
}

function spriteObject(name, vars, animations) {
  return { adaptCollisionMaskAutomatically: false, assetStoreId: "", name, persistentUuid: uuid(), type: "Sprite", updateIfNotVisible: false,
    variables: variables(vars || {}), effects: [], behaviors: [], animations };
}

function instance(name, x, y, width, height, z, layer) {
  return { angle: 0, customSize: true, depth: 1, height, keepRatio: true, layer: layer || "", name, persistentUuid: uuid(), width, x, y, zOrder: z || 16,
    numberProperties: [], stringProperties: [], initialVariables: [] };
}

function pngSize(rel) { const b = fs.readFileSync(path.join(ROOT, rel)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }

// Register image files as resources (the project's resource list) if they aren't there yet.
function registerImages(project, files) {
  const have = new Set(project.resources.resources.map(r => r.name));
  for (const f of files) if (!have.has(f)) {
    project.resources.resources.push({ file: f, kind: "image", metadata: JSON.stringify({ localFilePath: f, extension: ".png" }), name: f, smoothed: false, userAdded: false });
    have.add(f);
  }
}
// Register a scene or an event sheet in the project file (it is stored split, one file each).
function registerSplit(project, list, ref) {
  if (!project[list].some(x => x.referenceTo === ref)) project[list].push({ __REFERENCE_TO_SPLIT_OBJECT: true, referenceTo: ref });
}
// List a scene or event sheet in the project's folder tree (the editor's lists), before any folder at the root.
function registerListed(project, treeName, itemName) {
  const tree = project[treeName]; if (tree.children.some(c => c.itemName === itemName)) return;
  const firstFolder = tree.children.findIndex(c => c.folderName);
  tree.children.splice(firstFolder < 0 ? tree.children.length : firstFolder, 0, { itemName });
}
// Put an object name into a folder of a scene's object tree, making the folder if needed.
function addToFolder(tree, folderName, objectNames) {
  let f = tree.children.find(c => c.folderName === folderName);
  if (!f) { f = { folderName, children: [] }; tree.children.push(f); }
  for (const n of objectNames) if (!f.children.some(c => c.objectName === n)) f.children.push({ objectName: n });
}

module.exports = { ROOT, uuid, comment, jsEvent, link, cond, act, standard, readJson, writeJson, variables, animation, spriteObject, instance, pngSize, registerImages, registerSplit, registerListed, addToFolder };
