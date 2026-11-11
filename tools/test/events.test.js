// Event lint: mistakes in event JSON that GDevelop accepts silently but that break the game.
const fs = require("fs");
const path = require("path");
const { load, walk, instructions, scenesLinking, sceneContext } = require("./lib");

const KNOWN = path.join(__dirname, "known_instructions.json");
const OBJ_VAR = /ObjectVariable/;                               // e.g. NumberObjectVariable, SetBooleanObjectVariable
const SCENE_VAR = /^(Set)?(Number|String|Boolean)Variable$/;   // scene variables
const EXPR_VAR = /\b([A-Za-z_][A-Za-z0-9_]*)\.Variable\(\s*([A-Za-z_][A-Za-z0-9_]*)/g;

// Where each event list is checked: a scene against itself, a sheet against every scene that links it.
function targets() {
  const { scenes, sheets } = load();
  return scenes.map(s => ({ name: s.file, events: s.events, ctxs: [sceneContext(s)] }))
    .concat(sheets.map(sh => ({ name: sh.file, events: sh.events, ctxs: scenesLinking(sh.name).map(sceneContext) })));
}
const allInstructionTypes = () => {
  const types = new Set();
  for (const t of targets()) walk(t.events, e => { for (const { i } of instructions(e)) types.add(i.type.value); });
  return types;
};

module.exports = [
  ["every instruction type is one the project has used before (GDevelop silently drops unknown ones)", () => {
    if (process.argv.includes("--accept")) { fs.writeFileSync(KNOWN, JSON.stringify([...allInstructionTypes()].sort(), null, 2) + "\n"); return []; }
    const known = new Set(JSON.parse(fs.readFileSync(KNOWN, "utf8")));
    return [...allInstructionTypes()].filter(t => !known.has(t)).map(t => "new instruction type " + t + " (if it is a real GDevelop instruction, run with --accept to record it)");
  }],

  ["object variables used by events are declared on every object they can refer to", () => {
    const bad = new Set();
    for (const t of targets()) for (const ctx of t.ctxs) walk(t.events, e => {
      const uses = [];
      for (const { i } of instructions(e)) {
        if (OBJ_VAR.test(i.type.value) && i.parameters[0] && i.parameters[1]) uses.push([i.parameters[0], i.parameters[1]]);
        for (const p of i.parameters || []) for (const m of String(p).matchAll(EXPR_VAR)) uses.push([m[1], m[2]]);
      }
      for (const [obj, varName] of uses) {
        const name = String(varName).split(/[.[]/)[0];
        if (!ctx.isObject(obj)) continue; // Not an object in this scene (another scene's sheet branch, or a scene variable).
        for (const m of ctx.members(obj)) {
          const o = ctx.objects.get(m);
          if (o && !(o.variables || []).some(v => v.name === name)) bad.add(t.name + ": " + m + (m !== obj ? " (in " + obj + ")" : "") + " has no variable " + name);
        }
      }
    });
    return [...bad];
  }],

  ["scene variables used by events are declared", () => {
    const bad = new Set();
    for (const t of targets()) for (const ctx of t.ctxs) walk(t.events, e => {
      for (const { i } of instructions(e)) if (SCENE_VAR.test(i.type.value)) {
        const name = String(i.parameters[0]).split(/[.[]/)[0];
        if (name && !ctx.sceneVars.has(name)) bad.add(t.name + ": scene variable " + name + " is not declared");
      }
    });
    return [...bad];
  }],

  ["an Or names every object its event acts on in every branch (an Or keeps only what its true branches picked)", () => {
    // The 2026-11-11 deflect bug: Or(EnemyHitbox.IsMelee, Player.DeflectRangedUsed) — for an arrow the true branch never
    // named EnemyHitbox, so no hitbox stayed picked and the deflect blocked nothing.
    const bad = [];
    for (const t of targets()) for (const ctx of t.ctxs) walk(t.events, e => {
      const ors = (e.conditions || []).filter(c => c.type.value === "BuiltinCommonInstructions::Or");
      if (!ors.length) return;
      const named = list => { const s = new Set(); const add = l => { for (const i of l || []) { const p0 = i.parameters && i.parameters[0]; if (p0 && ctx.isObject(p0)) s.add(p0); for (const p of i.parameters || []) for (const m of String(p).matchAll(EXPR_VAR)) if (ctx.isObject(m[1])) s.add(m[1]); add(i.subInstructions); } }; add(list); return s; };
      const used = new Set();
      named(e.actions).forEach(o => used.add(o));
      walk(e.events, sub => { named(sub.conditions).forEach(o => used.add(o)); named(sub.actions).forEach(o => used.add(o)); });
      for (const or of ors) {
        const branches = or.subInstructions.map(b => named([b]));
        const inAny = new Set(branches.flatMap(b => [...b]));
        for (const o of inAny) if (used.has(o) && branches.some(b => !b.has(o))) {
          const msg = t.name + ": an Or names " + o + " in only some branches, but the event acts on " + o + " (" + (e.conditions.map(c => c.type.value).join(" & ")).slice(0, 90) + ")";
          if (!bad.includes(msg)) bad.push(msg);
        }
      }
    });
    return bad;
  }]
];
