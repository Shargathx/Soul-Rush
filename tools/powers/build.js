// Phase 4, slice 2 of docs/design-brand-mercy.md: R and the first real power, Blood pact. Close GDevelop first.
// Usage: node tools/powers/build.js (after tools/composure/build.js). Safe to run again. It
//   1. declares the Player's variables for Blood pact (BloodPactCost, BloodPactFloor);
//   2. puts the powers script (runtime.js) into Combat_Shared after the Composure script (so the Sacrificed HP event, further down, takes the cost in the same frame);
//   3. puts debug key X (equip Blood pact for this fight) behind the DEBUG_KEYS gate.
const fs = require("fs");
const path = require("path");
const L = require("../bosses/lib.js");

const COMMENT = "Powers: R uses the selected power of the loadout (the hub writes LoadoutSlot1 to LoadoutSlot3), a tap of E selects the next one, and the selection and the last message show bottom left. Blood pact (the Gunslinger's kill power) pays BloodPactCost of max HP as sacrificed HP and refills stamina. Not in the tutorial or the hub. Debug key X equips Blood pact for this fight (remove before release).";

const project = L.readJson("Soul Rush.json");
const player = project.objects.find(o => o.name === "Player");
for (const v of L.variables({ BloodPactCost: 0.15, BloodPactFloor: 0.2 })) if (!player.variables.some(x => x.name === v.name)) player.variables.push(v);
L.writeJson("Soul Rush.json", project);

const cs = L.readJson("externalEvents/combat_shared.json");
const isComment = (e, start) => e.type === "BuiltinCommonInstructions::Comment" && String(e.comment).startsWith(start);
for (let i = cs.events.length - 1; i >= 0; i--) if (isComment(cs.events[i], "Powers:")) cs.events.splice(i, 2);
const at = cs.events.findIndex(e => isComment(e, "Composure:"));
if (at < 0) throw new Error("run tools/composure/build.js first");
cs.events.splice(at + 2, 0, L.comment(COMMENT), L.jsEvent(fs.readFileSync(path.join(__dirname, "runtime.js"), "utf8")));

const gate = cs.events.find(e => e.type === "BuiltinCommonInstructions::JsCode" && (e.inlineCode || []).some(l => /const DEBUG_KEYS/.test(l)));
gate.inlineCode = gate.inlineCode.map(l => (l.includes("|l|m|p|o|b)$/") ? l.replace("|l|m|p|o|b)$/", "|l|m|p|o|b|x)$/") : l));
if (!gate.inlineCode.some(l => l.includes("|l|m|p|o|b|x)$/"))) throw new Error("the debug gate was not updated");
L.writeJson("externalEvents/combat_shared.json", cs);
console.log("Powers written (R, Blood pact, debug key X).");
