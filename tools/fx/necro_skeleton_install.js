// Puts the Necromancer's skeletons into the project (safe to run again): close GDevelop first.
//   1. Boss_Necromancer gets the Necro_Skeleton object: every animation tools/fx/necro_skeleton.js drew (Rise, Walk, Windup, Swing,
//      Stagger, Crumble, and the red-eyed *_P2 set), origin at the feet (bottom middle), in the Necromancer folder.
//   2. Soul Rush.json registers its frames and the three skeleton sounds.
//   3. The Necromancer gets the tuning variables (only the ones he lacks, so values changed in GDevelop are kept).
//   4. Necromancer_Boss gets (or has replaced) the "Necromancer: skeletons" group with tools/fx/necro_skeleton_logic.js as its script.
// Run: node tools/fx/necro_skeleton.js (the art), node tools/fx/necro_sounds.js (the sounds), then node tools/fx/necro_skeleton_install.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ROOT = path.join(__dirname, "..", "..");
const P = f => path.join(ROOT, f);
const load = f => JSON.parse(fs.readFileSync(P(f), "utf8"));
const save = (f, d) => fs.writeFileSync(P(f), JSON.stringify(d, null, 2) + "\n");
const uuid = () => crypto.randomUUID();

const DIR = "assets/Enemies/Necromancer/skeleton/";
const W = 44, H = 42;
const TIMES = { Rise: 0.1, Walk: 0.12, Windup: 0.15, Swing: 0.07, Stagger: 0.15, Crumble: 0.08 };   // the script drives the frames; these are for the editor
const TUNING = [
  ["SkelMaxP1", 1, "skeletons standing at once in phase 1"], ["SkelMaxP2", 2, "in phase 2"],
  ["SkelDelayP1", 3, "seconds before a new one rises while there are fewer (phase 1)"], ["SkelDelayP2", 2.5, "phase 2"],
  ["SkelFirstDelay", 2.5, "seconds before the first one (fight start, and after the Rekindle)"],
  ["SkelSpeed", 95, "walk speed, px per second"], ["SkelReach", 64, "how close it gets before it cuts, px"],
  ["SkelWindup", 0.5, "seconds the sword is raised before the cut (the tell)"], ["SkelRecover", 0.7, "seconds after the cut before it moves again"],
  ["SkelDamage", 8, "damage of a cut"]
];

// 1. The object.
const LAYOUT = "layouts/boss_necromancer.json";
const scene = load(LAYOUT);
const files = fs.readdirSync(P(DIR)).filter(f => f.endsWith(".png")).sort();
const anims = [];
for (const base of Object.keys(TIMES)) for (const suf of ["", "_P2"]) {
  const pre = (base + suf).toLowerCase() + "_";
  const frames = files.filter(f => f.startsWith(pre) && /^\d+\.png$/.test(f.slice(pre.length)));
  if (!frames.length) throw new Error("no frames for " + base + suf + ": run node tools/fx/necro_skeleton.js first");
  anims.push({ name: base + suf, useMultipleDirections: false, directions: [{ looping: base === "Walk", timeBetweenFrames: TIMES[base], sprites: frames.map(f => ({
    hasCustomCollisionMask: false, image: DIR + f, points: [], originPoint: { name: "origine", x: W / 2, y: H },
    centerPoint: { automatic: true, name: "centre", x: 0, y: 0 }, customCollisionMask: [] })) }] });
}
const old = scene.objects.find(o => o.name === "Necro_Skeleton");
const obj = { adaptCollisionMaskAutomatically: false, assetStoreId: "", name: "Necro_Skeleton", persistentUuid: old ? old.persistentUuid : uuid(), type: "Sprite",
  updateIfNotVisible: false, variables: [], effects: [], behaviors: [], animations: anims };
if (old) scene.objects[scene.objects.indexOf(old)] = obj;
else {
  const after = scene.objects.findIndex(o => o.name === "Necro_Spark");
  scene.objects.splice(after >= 0 ? after + 1 : scene.objects.length, 0, obj);
}
// In the same folder as his other objects.
const findFolder = (f, name) => { for (const ch of f.children || []) { if (ch.objectName === name) return f; if (ch.children) { const r = findFolder(ch, name); if (r) return r; } } return null; };
const has = (f, name) => !!findFolder(f, name);
if (scene.objectsFolderStructure && !has(scene.objectsFolderStructure, "Necro_Skeleton")) (findFolder(scene.objectsFolderStructure, "Necro_Spark") || scene.objectsFolderStructure).children.push({ objectName: "Necro_Skeleton" });
// 3. The tuning variables.
const necro = scene.objects.find(o => o.name === "Necromancer");
for (const [name, value] of TUNING) if (!necro.variables.some(v => v.name === name)) necro.variables.push({ name, persistentUuid: uuid(), type: "number", value });
save(LAYOUT, scene);

// 2. Resources.
const PROJECT = "Soul Rush.json";
const proj = load(PROJECT);
const want = [...anims.flatMap(a => a.directions[0].sprites.map(s => [s.image, "image"])), ...["rise", "swing", "break"].map(n => ["assets/Sfx/necro/necro_skel_" + n + ".wav", "audio"])];
for (const r of proj.resources.resources.filter(r => r.name.startsWith(DIR) && !want.some(([f]) => f === r.name))) proj.resources.resources.splice(proj.resources.resources.indexOf(r), 1);
const sample = kind => proj.resources.resources.find(r => r.kind === kind);
for (const [file, kind] of want) if (!proj.resources.resources.some(r => r.name === file)) {
  const r = JSON.parse(JSON.stringify(sample(kind))); r.name = file; r.file = file; proj.resources.resources.push(r);
}
save(PROJECT, proj);

// 4. The script.
const SHEET = "externalEvents/necromancer_boss.json";
const sheet = load(SHEET);
const code = fs.readFileSync(path.join(__dirname, "necro_skeleton_logic.js"), "utf8").replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n")
  .filter((l, i, all) => !/^\/\/ This file is the source of/.test(l));
const group = {
  type: "BuiltinCommonInstructions::Group", colorB: 109, colorG: 72, colorR: 74, creationTime: 0, name: "Necromancer: skeletons", source: "", parameters: [],
  events: [
    { type: "BuiltinCommonInstructions::Comment", color: { b: 109, g: 230, r: 255, textB: 0, textG: 0, textR: 0 },
      comment: "Skeletons: one at a time in phase 1, two in phase 2, a new one rising a few seconds after one falls; one sword hit kills one. Generated from tools/fx/necro_skeleton_logic.js by tools/fx/necro_skeleton_install.js: edit there and run it again. The numbers are the Skel* variables on the Necromancer." },
    { type: "BuiltinCommonInstructions::JsCode", inlineCode: code, parameterObjects: "", useStrict: true, eventsSheetExpanded: false }
  ]
};
const at = sheet.events.findIndex(e => e.type === "BuiltinCommonInstructions::Group" && e.name === "Necromancer: skeletons");
if (at >= 0) sheet.events[at] = group;
else {
  const colour = sheet.events.findIndex(e => e.type === "BuiltinCommonInstructions::Group" && e.name === "Necromancer: colour");
  sheet.events.splice(colour >= 0 ? colour : sheet.events.length, 0, group);
}
save(SHEET, sheet);
console.log("necro_skeleton_install: Necro_Skeleton (" + anims.length + " animations), " + want.length + " resources, " + TUNING.length + " tuning variables, the Skeletons script");
