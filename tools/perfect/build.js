// Phase 3 of docs/design-brand-mercy.md: the perfect deflect. Close GDevelop first. Usage: node tools/perfect/build.js
// Safe to run again (it replaces its own events). It
//   1. declares the Player's variables (PerfectFraction, PerfectCount, PerfectForced);
//   2. adds two child events to the deflect events (Combat_Shared's melee and ranged deflect, and the Gunslinger's bullet deflect): a deflect
//      that lands within PerfectFraction of the base DeflectWindow (never Desperation's extra window) adds one to Player.PerfectCount;
//   3. puts the placeholder mark script (perfect.js) into Combat_Shared after the Brand budget script;
//   4. adds debug key P (every deflect counts as perfect) and puts P behind the DEBUG_KEYS gate.
const fs = require("fs");
const path = require("path");
const L = require("../bosses/lib.js");

const P = "Player.Variable";
// PerfectFractionNow is PerfectFraction, plus Steady hand's bonus (the Composure script works it out every frame).
const PERFECT = `${P}(DeflectWindow) * ${P}(PerfectFractionNow)`;
const DEFLECT_COMMENT = "Perfect deflect: the deflect landed within PerfectFractionNow (PerfectFraction, wider with Steady hand) of the base DeflectWindow (the first part of it, never Desperation's extra window), so Player.PerfectCount goes up by one. Powers read it by keeping their own seen number (PerfectCount above it), so it does not matter which event sheet runs first. PerfectForced (debug key P) makes every deflect count.";
const MARK_COMMENT = "Perfect deflect mark: a placeholder \"PERFECT\" rises above the player when PerfectCount goes up (a deflect in the perfect window). It is also the model for powers: keep your own seen number and compare it with PerfectCount.";
const KEY_COMMENT = "Debug, P: toggle forced perfect deflects (Player.PerfectForced). While it is on, every deflect that lands counts as a perfect one, whatever the timing, to test the powers that read it. Remove before release (DEBUG_KEYS).";

// 1. The Player's variables.
const project = L.readJson("Soul Rush.json");
const player = project.objects.find(o => o.name === "Player");
for (const v of L.variables({ PerfectFraction: 0.33, PerfectFractionNow: 0.33, PerfectCount: 0, PerfectForced: 0 })) if (!player.variables.some(x => x.name === v.name)) player.variables.push(v);
L.writeJson("Soul Rush.json", project);

const isComment = (e, start) => e.type === "BuiltinCommonInstructions::Comment" && String(e.comment).startsWith(start);
const hasCond = (e, text) => JSON.stringify(e.conditions || []).includes(text);

// 2. The child events, under each deflect event.
function addChildren(events, deflectEvent) {
  const timer = deflectEvent.conditions.find(c => c.type.value === "CompareObjectTimer" && JSON.stringify(c.parameters).includes("DeflectTimer"));
  if (!timer) throw new Error("a deflect event has no DeflectTimer condition");
  const cmp = (op) => { const c = JSON.parse(JSON.stringify(timer)); c.parameters[2] = op; c.parameters[3] = PERFECT; return c; };
  const kids = deflectEvent.events;
  for (let i = kids.length - 1; i >= 0; i--) if (isComment(kids[i], "Perfect deflect:")) kids.splice(i, 3);
  const plus = L.act("SetNumberObjectVariable", ["Player", "PerfectCount", "+", "1"]);
  kids.push(L.comment(DEFLECT_COMMENT),
    L.standard([cmp("<=")], [plus], []),
    L.standard([L.cond("NumberObjectVariable", ["Player", "PerfectForced", "=", "1"]), cmp(">")], [JSON.parse(JSON.stringify(plus))], []));
}
function findDeflect(events, test) { let hit = null; (function walk(l) { for (const e of l) { if (!hit && e.type === "BuiltinCommonInstructions::Standard" && test(e)) hit = e; if (e.events) walk(e.events); } })(events); return hit; }

const cs = L.readJson("externalEvents/combat_shared.json");
const melee = findDeflect(cs.events, e => hasCond(e, "DeflectWindowNow") && hasCond(e, "EnemyHitbox") && hasCond(e, "DeflectTimer"));
if (!melee) throw new Error("the deflect event is not in Combat_Shared");
addChildren(cs.events, melee);

const gs = L.readJson("layouts/gunslinger.json");
const bullet = findDeflect(gs.events, e => hasCond(e, "DeflectWindowNow") && hasCond(e, "Parryable") && hasCond(e, "DeflectTimer"));
if (!bullet) throw new Error("the bullet deflect event is not in the Gunslinger scene");
addChildren(gs.events, bullet);
L.writeJson("layouts/gunslinger.json", gs);

// 3. The mark script, after the Brand budget script (a comment and a script event).
for (let i = cs.events.length - 1; i >= 0; i--) if (isComment(cs.events[i], "Perfect deflect mark:")) cs.events.splice(i, 2);
const budget = cs.events.findIndex(e => isComment(e, "Brand budget:"));
if (budget < 0) throw new Error("run tools/budget/build.js first (the Brand budget script is the anchor)");
cs.events.splice(budget + 2, 0, L.comment(MARK_COMMENT), L.jsEvent(fs.readFileSync(path.join(__dirname, "perfect.js"), "utf8")));

// 4. Debug key P, right after the L key event (a comment and an event), and P behind the gate.
for (let i = cs.events.length - 1; i >= 0; i--) if (isComment(cs.events[i], "Debug, P:")) cs.events.splice(i, 2);
const lKey = cs.events.findIndex(e => isComment(e, "Debug, L:"));
if (lKey < 0) throw new Error("the L key event is not in Combat_Shared");
cs.events.splice(lKey + 2, 0, L.comment(KEY_COMMENT), L.standard(
  [L.cond("KeyFromTextJustPressed", ["", "\"p\""])],
  [L.act("SetNumberObjectVariable", ["Player", "PerfectForced", "=", `1 - ${P}(PerfectForced)`])], []));
const gate = cs.events.find(e => e.type === "BuiltinCommonInstructions::JsCode" && (e.inlineCode || []).some(l => /const DEBUG_KEYS/.test(l)));
gate.inlineCode = gate.inlineCode.map(l => (l.includes("|l|m)$/") ? l.replace("|l|m)$/", "|l|m|p)$/") : l));
if (!gate.inlineCode.some(l => l.includes("|l|m|p"))) throw new Error("the debug gate was not updated");
L.writeJson("externalEvents/combat_shared.json", cs);
console.log("Perfect deflect written (events, mark script, debug key P).");
