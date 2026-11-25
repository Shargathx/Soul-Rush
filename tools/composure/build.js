// Phase 5 of docs/design-brand-mercy.md, the first Composure passives (Poise, Respite, Steady hand). Close GDevelop first.
// Usage: node tools/composure/build.js (after tools/budget/build.js and tools/perfect/build.js). Safe to run again. It
//   1. declares the Player's variables (ComposureBand, ComposureOn, PoiseBonus, SteadyHandBonus, RespiteStamina, StaminaRegenNow, PerfectFractionNow);
//   2. makes the stamina regen event read StaminaRegenNow;
//   3. puts the Composure script (composure.js) into Combat_Shared after the Brand budget script;
//   (and Grace, mercy 5: the two places where the player's posture goes up are made to multiply by PostureTakenNow, which composure.js works out)
//   4. puts debug keys O and B behind the DEBUG_KEYS gate (the keys themselves are in tools/debugcounts) and removes their old events.
const fs = require("fs");
const path = require("path");
const L = require("../bosses/lib.js");

const COMMENT = "Composure: while the player is above ComposureBand of max HP (and the hub says he has mercy), Poise (mercy 1) raises stamina regen, Respite (mercy 2) refunds stamina on a perfect deflect, Steady hand (mercy 3) widens the perfect-deflect window, and Grace (mercy 5) makes hits cost less of his posture. It works out StaminaRegenNow, PerfectFractionNow and PostureTakenNow for the events that read them. Not in the tutorial.";

// 1. The Player's variables.
const project = L.readJson("Soul Rush.json");
const player = project.objects.find(o => o.name === "Player");
for (const v of L.variables({ ComposureBand: 0.8, ComposureOn: 0, PoiseBonus: 0.5, SteadyHandBonus: 0.12, RespiteStamina: 15, StaminaRegenNow: 20, PerfectFractionNow: 0.33, GraceBonus: 0.3, PostureTakenNow: 1 })) if (!player.variables.some(x => x.name === v.name)) player.variables.push(v);
L.writeJson("Soul Rush.json", project);

// 2. The stamina regen event reads StaminaRegenNow.
const pm = L.readJson("externalEvents/player_movement.json");
let regen = 0;
(function walk(evs) { for (const e of evs) { for (const a of e.actions || []) if (a.type && a.type.value === "SetNumberObjectVariable" && a.parameters[1] === "Stamina" && a.parameters[2] === "+" && /StaminaRegen(Rate|Now)\) \* TimeDelta\(\)/.test(a.parameters[3])) { a.parameters[3] = "Player.Variable(StaminaRegenNow) * TimeDelta()"; regen++; } if (e.events) walk(e.events); } })(pm.events);
if (regen !== 1) throw new Error("expected one stamina regen event, found " + regen);
L.writeJson("externalEvents/player_movement.json", pm);

// Grace: the player's posture goes up in exactly two places (a hit in Combat_Shared, a bullet in the Gunslinger's scene): both multiply by PostureTakenNow.
function graceWalk(events, from) {
  let n = 0;
  (function walk(list) { for (const e of list) { for (const a of e.actions || []) if (a.type && a.type.value === "SetNumberObjectVariable" && a.parameters[0] === "Player" && a.parameters[1] === "Posture" && a.parameters[2] === "+" && (a.parameters[3] === from + ".Variable(PostureDamage)" || a.parameters[3] === from + ".Variable(PostureDamage) * Player.Variable(PostureTakenNow)")) { a.parameters[3] = from + ".Variable(PostureDamage) * Player.Variable(PostureTakenNow)"; n++; } if (e.events) walk(e.events); } })(events);
  return n;
}
const csGrace = L.readJson("externalEvents/combat_shared.json");
if (graceWalk(csGrace.events, "Enemy") !== 1) throw new Error("expected one player-posture hit event in Combat_Shared");
L.writeJson("externalEvents/combat_shared.json", csGrace);
const gsGrace = L.readJson("layouts/gunslinger.json");
if (graceWalk(gsGrace.events, "Bullet") !== 1) throw new Error("expected one player-posture hit event in the Gunslinger scene");
L.writeJson("layouts/gunslinger.json", gsGrace);

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
// (Debug keys O and B are in the debug counts script now, tools/debugcounts: the counts are global variables, which events here do not use.)

const gate = cs.events.find(e => e.type === "BuiltinCommonInstructions::JsCode" && (e.inlineCode || []).some(l => /const DEBUG_KEYS/.test(l)));
gate.inlineCode = gate.inlineCode.map(l => (l.includes("|l|m|p)$/") ? l.replace("|l|m|p)$/", "|l|m|p|o|b)$/") : l));
if (!gate.inlineCode.some(l => l.includes("|l|m|p|o|b"))) throw new Error("the debug gate was not updated");
L.writeJson("externalEvents/combat_shared.json", cs);
console.log("Composure written (script, stamina regen, debug gate).");
