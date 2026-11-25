// Phase 4 of docs/design-brand-mercy.md: R, the first power (Blood pact) and the dodge slot (the Flash step and the Wraith dash). Close GDevelop first.
// Usage: node tools/powers/build.js (after tools/composure/build.js). Safe to run again. It
//   1. declares the Player's variables (Blood pact, and the numbers of the roll and the two dashes);
//   2. puts the powers script (runtime.js: R, E, Blood pact), the dodge script (dodge.js) and the dash effects (dashfx.js) into Combat_Shared after the Composure script
//      (so the Sacrificed HP event, further down, takes their HP costs in the same frame);
//   3. makes the roll read its numbers from the Player (DodgeSpeed, DodgeMoveTime, DodgeIframeActive, DodgeStamina) instead of 400, 0.32 and 30, in Player_Movement;
//   4. puts debug keys X (equip Blood pact) and C (cycle the dodge) behind the DEBUG_KEYS gate.
const fs = require("fs");
const path = require("path");
const L = require("../bosses/lib.js");

const POWERS_COMMENT = "Powers: R uses the selected power of the loadout (the hub writes LoadoutSlot1 to LoadoutSlot3), a tap of E selects the next one, and the selection and the last message show bottom left. Blood pact (the Gunslinger's kill power) pays BloodPactCost of max HP as sacrificed HP and refills stamina. Not in the tutorial or the hub. Debug key X equips Blood pact for this fight (remove before release).";
const FX_COMMENT = "Dash effects: the Flash step and the Wraith dash draw the Samurai's flash step speed lines (Player_Dash_Trail, made by tools/fx/player_trails.js): gold and white for the Flash step, green for the Wraith dash, growing with the dash and fading in his five steps over 0.2 s. The plain roll draws nothing.";
const DODGE_COMMENT = "Dodge: the roll (Space) is the dodge, and the loadout may swap it for the Flash step or the Wraith dash, which are the same roll with other numbers. Every frame this writes DodgeSpeed, DodgeIframe and DodgeStamina for the next press (the roll events below read them), and pays for a dodge that has just started: a Flash step takes a dash charge, a Wraith dash takes WraithCost of max HP as sacrificed HP. Light step helps. No dashes in the tutorial or the hub. Debug key C cycles the dodge for this fight (remove before release).";

// 1. The Player's variables.
const project = L.readJson("Soul Rush.json");
const player = project.objects.find(o => o.name === "Player");
const add = L.variables({
  BloodPactCost: 0.15, BloodPactFloor: 0.2,
  DodgeSpeed: 400, DodgeMoveTime: 99, DodgeIframe: 0.32, DodgeIframeActive: 0.32, DodgeStamina: 30,                // What the next roll uses (written every frame).
  DodgeSpeedBase: 400, DodgeMoveTimeBase: 99, DodgeIframeBase: 0.32, DodgeStaminaBase: 30, // The plain roll (it moves for its whole length).
  DashSpeedFlash: 3300, DashIframeFlash: 0.36, DashChargesMax: 2, DashCharges: 2, DashRecharge: 3,   // The Flash step: about 300 px in DashMoveTime.
  DashSpeedWraith: 2900, DashIframeWraith: 0.46, WraithCost: 0.06,                        // The Wraith dash: about 260 px.
  DashMoveTime: 0.09, DashEndTime: 0.12,                                                  // How long a dash moves, and when the roll is ended (he is free to act).
  LightStepDashBonus: 0.5, LightStepRollBonus: 0.25                                       // Light step (mercy 4).
});
for (const v of add) if (!player.variables.some(x => x.name === v.name)) player.variables.push(v);
// The first version of the dashes was slow (640 and 520 px/s over the whole roll); a variable still at that old value is retuned, one set by hand is left alone.
for (const [name, old, now] of [["DashSpeedFlash", 640, 3300], ["DashSpeedWraith", 520, 2900]]) { const v = player.variables.find(x => x.name === name); if (v && v.value === old) v.value = now; }
L.writeJson("Soul Rush.json", project);

// 2. The script events in Combat_Shared.
const cs = L.readJson("externalEvents/combat_shared.json");
const isComment = (e, start) => e.type === "BuiltinCommonInstructions::Comment" && String(e.comment).startsWith(start);
for (const start of ["Powers:", "Dodge:", "Dash effects:"]) for (let i = cs.events.length - 1; i >= 0; i--) if (isComment(cs.events[i], start)) cs.events.splice(i, 2);
const at = cs.events.findIndex(e => isComment(e, "Composure:"));
if (at < 0) throw new Error("run tools/composure/build.js first");
cs.events.splice(at + 2, 0,
  L.comment(POWERS_COMMENT), L.jsEvent(fs.readFileSync(path.join(__dirname, "runtime.js"), "utf8")),
  L.comment(DODGE_COMMENT), L.jsEvent(fs.readFileSync(path.join(__dirname, "dodge.js"), "utf8")),
  L.comment(FX_COMMENT), L.jsEvent(fs.readFileSync(path.join(__dirname, "dashfx.js"), "utf8")));

// 4. The debug keys behind the gate.
const gate = cs.events.find(e => e.type === "BuiltinCommonInstructions::JsCode" && (e.inlineCode || []).some(l => /const DEBUG_KEYS/.test(l)));
gate.inlineCode = gate.inlineCode.map(l => (l.includes("|l|m|p|o|b|x)$/") ? l.replace("|l|m|p|o|b|x)$/", "|l|m|p|o|b|x|c)$/") : l.includes("|l|m|p|o|b)$/") ? l.replace("|l|m|p|o|b)$/", "|l|m|p|o|b|x|c)$/") : l));
if (!gate.inlineCode.some(l => l.includes("|l|m|p|o|b|x|c"))) throw new Error("the debug gate was not updated");
L.writeJson("externalEvents/combat_shared.json", cs);

// 3. The roll reads its numbers from the Player.
const pm = L.readJson("externalEvents/player_movement.json");
const found = { start: 0, cost: 0, iframe: 0, move: 0 };
(function walk(events) {
  for (const e of events) {
    for (const c of e.conditions || []) {
      // The roll's start: enough stamina.
      if (c.type.value === "NumberObjectVariable" && c.parameters[1] === "Stamina" && c.parameters[2] === ">=" && ["30", "Player.Variable(DodgeStamina)"].includes(c.parameters[3]) && (e.actions || []).some(a => JSON.stringify(a.parameters).includes("RollTimer"))) { c.parameters[3] = "Player.Variable(DodgeStamina)"; found.start++; }
      // The i-frames end after RollTimer.
      if (c.type.value === "CompareObjectTimer" && JSON.stringify(c.parameters).includes("RollTimer") && ["0.32", "Player.Variable(DodgeIframe)", "Player.Variable(DodgeIframeActive)"].includes(c.parameters[3])) { c.parameters[3] = "Player.Variable(DodgeIframeActive)"; found.iframe++; }
    }
    for (const a of e.actions || []) {
      if (a.type.value === "SetNumberObjectVariable" && a.parameters[1] === "Stamina" && a.parameters[2] === "-" && ["30", "Player.Variable(DodgeStamina)"].includes(a.parameters[3]) && (e.actions || []).some(x => JSON.stringify(x.parameters).includes("RollTimer"))) { a.parameters[3] = "Player.Variable(DodgeStamina)"; found.cost++; }
      if (a.type.value === "SetX" && a.parameters[0] === "Player" && ["400 * TimeDelta()", "Player.Variable(DodgeSpeed) * TimeDelta()"].includes(a.parameters[2]) && (e.conditions || []).some(c => JSON.stringify(c.parameters).includes("IsRolling"))) {
        a.parameters[2] = "Player.Variable(DodgeSpeed) * TimeDelta()"; found.move++;
        // It moves only for DodgeMoveTime seconds after the roll started (a dash is over in about 0.09 s; the roll's time is 99, so it moves all along).
        if (!e.conditions.some(c => c.type.value === "CompareObjectTimer" && JSON.stringify(c.parameters).includes("DodgeMoveTime"))) e.conditions.push(L.cond("CompareObjectTimer", ["Player", "\"RollTimer\"", "<", "Player.Variable(DodgeMoveTime)"]));
      }
    }
    if (e.events) walk(e.events);
  }
})(pm.events);
if (found.start !== 1 || found.cost !== 1 || found.iframe !== 1 || found.move !== 2) throw new Error("the roll events were not all found: " + JSON.stringify(found));
L.writeJson("externalEvents/player_movement.json", pm);
console.log("Powers and the dodge written (R, Blood pact, the dodge numbers, debug keys X and C).");
