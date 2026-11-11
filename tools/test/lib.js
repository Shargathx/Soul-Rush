// Shared helpers for the project checks: loads Soul Rush the way GDevelop sees it (the project file, the scene files in
// layouts/, the event sheets in externalEvents/) and walks events and instructions.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");

// Scenes still being built (their own work in progress); the checks leave them alone.
const SKIP_SCENES = new Set(["Template_Forest", "Template_Graveyard", "Template_Ruins"]);
const SKIP_SCENE_FILES = /^template_/;

const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const exists = rel => fs.existsSync(path.join(ROOT, rel));

let cache = null;
function load() {
  if (cache) return cache;
  const project = readJson("Soul Rush.json");
  const scenes = fs.readdirSync(path.join(ROOT, "layouts")).filter(f => f.endsWith(".json") && !SKIP_SCENE_FILES.test(f))
    .map(f => Object.assign(readJson("layouts/" + f), { file: "layouts/" + f })).filter(s => !SKIP_SCENES.has(s.name));
  const sheets = fs.readdirSync(path.join(ROOT, "externalEvents")).filter(f => f.endsWith(".json"))
    .map(f => Object.assign(readJson("externalEvents/" + f), { file: "externalEvents/" + f }));
  cache = { project, scenes, sheets };
  return cache;
}

// Every event, depth first, with its parent chain.
function walk(events, fn, parents = []) {
  for (const e of events || []) { fn(e, parents); if (e.events) walk(e.events, fn, parents.concat(e)); }
}
// Every instruction (conditions and actions, including those nested in Or / And / Not), with whether it is an action.
function instructions(e) {
  const out = [];
  const add = (list, isAction) => { for (const i of list || []) { out.push({ i, isAction }); if (i.subInstructions) add(i.subInstructions, isAction); } };
  add(e.conditions, false); add(e.actions, true);
  return out;
}
const codeOf = e => Array.isArray(e.inlineCode) ? e.inlineCode.join("\n") : String(e.inlineCode || "");

// The scenes that link a sheet (directly, or through another linked sheet).
function scenesLinking(sheetName) {
  const { scenes, sheets } = load();
  const linksOf = events => { const t = []; walk(events, e => { if (e.type === "BuiltinCommonInstructions::Link") t.push(e.target); }); return t; };
  return scenes.filter(s => {
    const seen = new Set(), todo = linksOf(s.events);
    while (todo.length) { const t = todo.pop(); if (t === sheetName) return true; if (seen.has(t)) continue; seen.add(t); const sh = sheets.find(x => x.name === t); if (sh) todo.push(...linksOf(sh.events)); }
    return false;
  });
}

// What a scene can see: its own objects, the global ones, its groups (name -> member names), its variables.
function sceneContext(scene) {
  const { project } = load();
  const objects = new Map();
  for (const o of project.objects) objects.set(o.name, o);
  for (const o of scene.objects || []) objects.set(o.name, o);
  const groups = new Map((scene.objectsGroups || []).concat(project.objectsGroups || []).map(g => [g.name, g.objects.map(o => o.name)]));
  const sceneVars = new Set((scene.variables || []).map(v => v.name).concat((project.variables || []).map(v => v.name)));
  return { objects, groups, sceneVars, isObject: n => objects.has(n) || groups.has(n), members: n => groups.has(n) ? groups.get(n) : objects.has(n) ? [n] : [] };
}

module.exports = { ROOT, load, walk, instructions, codeOf, scenesLinking, sceneContext, readJson, exists };
