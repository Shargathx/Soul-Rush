// Phase 5 of docs/design-brand-mercy.md, the first Composure passives (Poise, Respite, Steady hand). Close GDevelop first.
// Usage: node tools/composure/build.js (after tools/budget/build.js and tools/perfect/build.js). Safe to run again. It
//   1. declares the Player's variables (ComposureBand, ComposureOn, PoiseBonus, SteadyHandBonus, RespiteStamina, StaminaRegenNow, PerfectFractionNow);
//   2. makes the stamina regen event read StaminaRegenNow;
//   3. puts the Composure script (composure.js) into Combat_Shared after the Brand budget script;
//   4. adds debug keys O and B (one more mercy / brand count, wrapping after every boss) and puts them behind the DEBUG_KEYS gate.
const fs = require("fs");
const path = require("path");
const L = require("../bosses/lib.js");

const COMMENT = "Composure: while the player is above ComposureBand of max HP (and the hub says he has mercy), Poise (mercy 1) raises stamina regen, Respite (mercy 2) refunds stamina on a perfect deflect, and Steady hand (mercy 3) widens the perfect-deflect window. It works out StaminaRegenNow and PerfectFractionNow for the events that read them. Not in the tutorial.";
const O_COMMENT = "Debug, O: one more mercy for the passives (the global MercyCount goes up by one and wraps to 0 after every boss), to test the Composure passives without beating the bosses. The hub sets the real count again on the next visit. Remove before release (DEBUG_KEYS).";
const B_COMMENT = "Debug, B: one more brand (the global BrandCount goes up by one and wraps to 0 after every boss), to test the brand passives. The brands' HP loss is applied when a fight starts, so this does not change max HP. Remove before release (DEBUG_KEYS).";

// 1. The Player's variables.
const project = L.readJson("Soul Rush.json");
const player = project.objects.find(o => o.name === "Player");
for (const v of L.variables({ ComposureBand: 0.8, ComposureOn: 0, PoiseBonus: 0.5, SteadyHandBonus: 0.12, RespiteStamina: 15, StaminaRegenNow: 20, PerfectFractionNow: 0.33 })) if (!player.variables.some(x => x.name === v.name)) player.variables.push(v);
L.writeJson("Soul Rush.json", project);

// 2. The stamina regen event reads StaminaRegenNow.
const pm = L.readJson("externalEvents/player_movement.json");
let regen = 0;
(function walk(evs) { for (const e of evs) { for (const a of e.actions || []) if (a.type && a.type.value === "SetNumberObjectVariable" && a.parameters[1] === "Stamina" && a.parameters[2] === "+" && /StaminaRegen(Rate|Now)\) \* TimeDelta\(\)/.test(a.parameters[3])) { a.parameters[3] = "Player.Variable(StaminaRegenNow) * TimeDelta()"; regen++; } if (e.events) walk(e.events); } })(pm.events);
if (regen !== 1) throw new Error("expected one stamina regen event, found " + regen);
L.writeJson("externalEvents/player_movement.json", pm);

// 3 and 4. The events in Combat_Shared.
const cs = L.readJson("externalEvents/combat_shared.json");
const isComment = (e, start) => e.type === "BuiltinCommonInstructions::Comment" && String(e.comment).startsWith(start);
for (let i = cs.events.length - 1; i >= 0; i--) if (isComment(cs.events[i], "Composure:")) cs.events.splice(i, 2);
const budget = cs.events.findIndex(e => isComment(e, "Brand budget:"));
if (budget < 0) throw new Error("run tools/budget/build.js first");
cs.events.splice(budget + 2, 0, L.comment(COMMENT), L.jsEvent(fs.readFileSync(path.join(__dirname, "composure.js"), "utf8")));

for (const start of ["Debug, O:", "Debug, B:"]) for (let i = cs.events.length - 1; i >= 0; i--) if (isComment(cs.events[i], start)) cs.events.splice(i, 2);
const pKey = cs.events.findIndex(e => isComment(e, "Debug, P:"));
if (pKey < 0) throw new Error("run tools/perfect/build.js first");
const bump = (key, name) => L.standard([L.cond("KeyFromTextJustPressed", ["", `"${key}"`])], [L.act("SetNumberVariable", [name, "=", `mod(Variable(${name}) + 1, Variable(BossCount) + 1)`])], []);
cs.events.splice(pKey + 2, 0, L.comment(O_COMMENT), bump("o", "MercyCount"), L.comment(B_COMMENT), bump("b", "BrandCount"));

const gate = cs.events.find(e => e.type === "BuiltinCommonInstructions::JsCode" && (e.inlineCode || []).some(l => /const DEBUG_KEYS/.test(l)));
gate.inlineCode = gate.inlineCode.map(l => (l.includes("|l|m|p)$/") ? l.replace("|l|m|p)$/", "|l|m|p|o|b)$/") : l));
if (!gate.inlineCode.some(l => l.includes("|l|m|p|o|b)$/"))) throw new Error("the debug gate was not updated");
L.writeJson("externalEvents/combat_shared.json", cs);
console.log("Composure written (script, stamina regen, debug keys O and B).");
