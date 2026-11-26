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
  BloomHealHP: 25, BloomTime: 6, BloomRadius: 90,                                         // Bloom: the HP it mends, over how long, and how far from the arrow.
  BerserkLeft: 0, BerserkTime: 8, BerserkCost: 0.15, BerserkFloor: 0.2,                  // Berserk: seconds left (0 when off), how long, its price in max HP, and the HP it must leave.
  BerserkDamageMult: 1.4, BerserkRallyBonus: 0.25, BerserkDodgeDiscount: 0.5,             // What it gives: hit damage, extra rally per hit (of MaxRally), and the part of the roll's price it takes off.
  PetalFire: 0, PetalGap: 90, PlayerHits: 0,                                              // Petal step: its stagger request and how far past the boss he lands; PlayerHits counts the hits he takes (the Samurai's trial).
  PetalGuardLeft: 0, PetalGuardTime: 0.5, PetalSoak: 0, PetalShield: 0,                    // Petal counter: how long it stands, a caught hit (for the script), and 1 while nothing may touch him.
  DodgeSpeed: 400, DodgeMoveTime: 99, DodgeIframe: 0.32, DodgeIframeActive: 0.32, DodgeStamina: 30,                // What the next roll uses (written every frame).
  DodgeSpeedBase: 400, DodgeMoveTimeBase: 99, DodgeIframeBase: 0.32, DodgeStaminaBase: 30, // The plain roll (it moves for its whole length).
  DashSpeedFlash: 3300, DashIframeFlash: 0.36, DashChargesMax: 2, DashCharges: 2, DashRecharge: 3,   // The Flash step: about 300 px in DashMoveTime.
  DashSpeedWraith: 2900, DashIframeWraith: 0.46, WraithCost: 0.06,                        // The Wraith dash: about 260 px.
  DashMoveTime: 0.09, DashEndTime: 0.12,                                                  // How long a dash moves, and when the roll is ended (he is free to act).
  LightStepDashBonus: 0.5, LightStepRollBonus: 0.25                                       // Light step (mercy 4).
});
for (const v of add) if (!player.variables.some(x => x.name === v.name)) player.variables.push(v);
player.variables = player.variables.filter(v => v.name !== "BloomHeal");   // Bloom's first version healed a part of max HP.
// The first version of the dashes was slow (640 and 520 px/s over the whole roll); a variable still at that old value is retuned, one set by hand is left alone.
for (const [name, old, now] of [["DashSpeedFlash", 640, 3300], ["DashSpeedWraith", 520, 2900], ["BerserkDodgeDiscount", 0.9, 0.5], ["PetalGuardTime", 1, 0.5]]) { const v = player.variables.find(x => x.name === name); if (v && v.value === old) v.value = now; }
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

// 3b. Berserk's part of the player's hit: more health damage (never posture) and faster rally, as child events of the hit event, so they happen only on a hit that counts.
const BERSERK_HIT = "Berserk, the hit: while Player.BerserkLeft runs, the sword takes BerserkDamageMult times AttackDamage of health in all (this adds the part above the usual hit). Never any posture.";
const BERSERK_LUNGE = "Berserk, a lunge: the same for the lunge's extra damage.";
const BERSERK_RALLY = "Berserk, rally: the hit wins back BerserkRallyBonus of MaxRally on top of the usual quarter, never more than is waiting in the pool nor past max HP.";
const findHit = list => { for (const e of list) { if (e.type === "BuiltinCommonInstructions::Standard" && JSON.stringify(e.conditions).includes("HasHitThisSwing") && JSON.stringify(e.actions).includes("JustHitByPlayer")) return e; if (e.events) { const r = findHit(e.events); if (r) return r; } } return null; };
const hit = findHit(cs.events);
if (!hit) throw new Error("the player's hit event is not in Combat_Shared");
for (let i = hit.events.length - 1; i >= 0; i--) if (isComment(hit.events[i], "Berserk,")) hit.events.splice(i, 2);
const raging = () => L.cond("NumberObjectVariable", ["Player", "BerserkLeft", ">", "0"]);
const set = (obj, name, op, v) => L.act("SetNumberObjectVariable", [obj, name, op, v]);
const extra = of => set("Enemy", "Health", "-", "Player.Variable(" + of + ") * (Player.Variable(BerserkDamageMult) - 1)");
const won = "min(Player.Variable(PendingRally), Player.Variable(MaxRally) * Player.Variable(BerserkRallyBonus))";
const rallyAt = hit.events.findIndex(e => e.type === "BuiltinCommonInstructions::Standard" && (e.conditions || []).some(c => c.parameters[1] === "PendingRally"));
if (rallyAt < 0) throw new Error("the hit's rally event was not found");
hit.events.splice(rallyAt + 1, 0,
  L.comment(BERSERK_HIT), L.standard([raging()], [extra("AttackDamage")], []),
  L.comment(BERSERK_LUNGE), L.standard([raging(), L.cond("BooleanObjectVariable", ["Player", "IsLunging", "True", ""])], [extra("LungeBonusDamage")], []),
  L.comment(BERSERK_RALLY), L.standard([raging(), L.cond("NumberObjectVariable", ["Player", "PendingRally", ">", "0"])], [set("Player", "Health", "+", won), set("Player", "PendingRally", "-", won)],
    [L.standard([L.cond("NumberObjectVariable", ["Player", "Health", ">", "Player.Variable(MaxHealth)"])], [set("Player", "Health", "=", "Player.Variable(MaxHealth)")], [])]));

// 3c. Petal step: its stagger of the boss (after the player's hit, like his lunge: any earlier and "Boss reaction flags" would clear JustStaggered before
// the boss's sheet reads it), the count of the hits the player takes, and the Samurai's
// bonus saved with the win.
const PETAL_FIRE = "Petal step, the boss: he has stepped behind it (Player.PetalFire): it flinches and is confused (JustStaggered, like a lunge), unless it cannot be hurt now or is on its knees (a flinch would break a protected sequence or the stun).";
const PETAL_CLEAR = "Petal step: clear the request.";
for (let i = cs.events.length - 1; i >= 0; i--) if (isComment(cs.events[i], "Petal step")) cs.events.splice(i, 2);
const asked = () => L.cond("NumberObjectVariable", ["Player", "PetalFire", "=", "1"]);
const hitAt = cs.events.indexOf(hit);
if (hitAt < 0) throw new Error("the player's hit event is not a top level event any more");
cs.events.splice(hitAt + 1, 0,
  L.comment(PETAL_FIRE), L.standard([asked(), L.cond("BooleanObjectVariable", ["Enemy", "Invulnerable", "False", ""]), L.cond("BooleanObjectVariable", ["Enemy", "IsPostureBroken", "False", ""])], [L.act("SetBooleanObjectVariable", ["Enemy", "JustStaggered", "True", ""])], []),
  L.comment(PETAL_CLEAR), L.standard([asked()], [set("Player", "PetalFire", "=", "0")], []));
// Counts a hit in the event that takes the player's HP by the amount expr.
const countHit = (list, expr) => { let n = 0; for (const e of list) {
  if (e.type === "BuiltinCommonInstructions::Standard" && (e.actions || []).some(a => a.type.value === "SetNumberObjectVariable" && a.parameters[0] === "Player" && a.parameters[1] === "Health" && a.parameters[2] === "-" && a.parameters[3] === expr)) {
    if (!e.actions.some(a => a.parameters[1] === "PlayerHits")) e.actions.push(set("Player", "PlayerHits", "+", "1"));
    n++;
  }
  if (e.events) n += countHit(e.events, expr);
} return n; };
if (countHit(cs.events, "EnemyHitbox.Variable(Damage)") !== 1) throw new Error("the event of an attack hitting the player was not found once");
const samurai = L.readJson("externalEvents/samurai_boss.json");
if (countHit(samurai.events, "Samurai_NPC.Variable(GrabDamage)") !== 1) throw new Error("the Samurai's grab stab event was not found once");
L.writeJson("externalEvents/samurai_boss.json", samurai);
const SAVE = "  if (runtimeScene.__petalTrial && runtimeScene.__petalTrial.earned) runtimeScene.getGame().getVariables().get(\"BossesBeaten\").getChild(\"Samurai_Petal\").setBoolean(true); // Petal step, earned in this fight (tools/powers/runtime.js).";
const WIN = "getChild(runtimeScene.getName()).setBoolean(true);";
let saves = 0;
(function walk(list) { for (const e of list) {
  if (e.type === "BuiltinCommonInstructions::JsCode") {
    const lines = Array.isArray(e.inlineCode) ? e.inlineCode : e.inlineCode.split("\n");
    const at = lines.findIndex(l => l.includes(WIN) && l.includes("BossesBeaten"));
    if (at >= 0 && lines.some(l => l.includes("JustBeaten"))) {
      if (!lines.some(l => l.includes("Samurai_Petal"))) lines.splice(at + 1, 0, SAVE);
      e.inlineCode = Array.isArray(e.inlineCode) ? lines : lines.join("\n");
      saves++;
    }
  }
  if (e.events) walk(e.events);
} })(cs.events);
if (saves !== 1) throw new Error("the Boss beaten script was not found once (" + saves + ")");

// 3d. Petal counter: in front of each event that hurts the player, one that catches the hit while the counter stands (PetalGuardLeft). It uses up the attack,
// and sets PetalSoak (the script starts the vanish) and PetalShield. (The Samurai's grab is in tools/brand, which orders it behind the sword's block.)
const CATCH = "Petal counter, ";
const guarding = () => L.cond("NumberObjectVariable", ["Player", "PetalGuardLeft", ">", "0"]);
const unshielded = () => L.cond("NumberObjectVariable", ["Player", "PetalShield", "=", "0"]);
const caught = () => [set("Player", "PetalSoak", "=", "1"), set("Player", "PetalShield", "=", "1"), set("Player", "PetalGuardLeft", "=", "0"),
  L.act("SetBooleanObjectVariable", ["Player", "IsGrabbed", "True", ""]), L.act("SetBooleanObjectVariable", ["Player", "IsHurt", "False", ""])];
const copyConds = e => JSON.parse(JSON.stringify(e.conditions));
const without = list => { for (let i = list.length - 1; i >= 0; i--) { if (isComment(list[i], CATCH)) list.splice(i, 2); else if (list[i].events) without(list[i].events); } };
// Finds the one event that has the action (object, variable, operator, value) and hands it to place(list, index, event).
const before = (events, action, what, place) => { let n = 0; (function walk(list) { for (let i = 0; i < list.length; i++) { const e = list[i];
  if ((e.actions || []).some(a => action.every((v, k) => a.parameters[k] === v))) { i += place(list, i, e); n++; continue; }
  if (e.events) walk(e.events); } })(events); if (n !== 1) throw new Error("Petal counter: " + what + " was not found once (" + n + ")"); };
// An attack (melee, arrows, petals, blades: everything in EnemyHitbox). The attack is used up, as a hit would use it.
without(cs.events);
before(cs.events, ["Player", "Health", "-", "EnemyHitbox.Variable(Damage)"], "the attack hit", (list, i, e) => {
  list.splice(i - 1, 0, L.comment(CATCH + "an attack: it would hit while the counter stands, so it does nothing at all and the player vanishes."),
    L.standard([...copyConds(e), guarding()], [L.act("SetBooleanObjectVariable", ["EnemyHitbox", "HasHit", "True", ""]), ...caught()], []));
  return 2; });
// The Gunslinger's bullets (the bullet is still removed as usual).
const gun = L.readJson("layouts/gunslinger.json");
without(gun.events);
before(gun.events, ["Player", "Health", "-", "Bullet.Damage"], "the bullet hit", (list, i, e) => {
  const soak = L.standard([...copyConds(e).filter(c => c.parameters[1] !== "PetalShield"), unshielded(), guarding()], caught(), []);
  if (!e.conditions.some(c => c.parameters[1] === "PetalShield")) e.conditions.push(unshielded());
  list.splice(i, 0, L.comment(CATCH + "a bullet: caught, it does nothing."), soak);
  return 2; });
L.writeJson("layouts/gunslinger.json", gun);
// The Leaf Ranger's bramble (a grab from the ground) and snare: caught, the roots close on nothing.
const ranger = L.readJson("externalEvents/leaf_ranger_boss.json");
without(ranger.events);
for (const [what, action, spend] of [
  ["the bramble", ["Player", "Health", "-", "Leaf_Ranger.Variable(GraspDamage)"], () => set("Ranger_Bramble", "Caught", "=", "1")],
  ["the snare", ["Player", "RootLeft", "=", "Leaf_Ranger.Variable(TrapRootTime)"], () => L.act("SetStringObjectVariable", ["Ranger_Trap", "State", "=", "\"snap\""])]]) {
  before(ranger.events, action, what, (list, i, e) => {
    const base = copyConds(e).filter(c => c.parameters[1] !== "PetalShield");
    if (!e.conditions.some(c => c.parameters[1] === "PetalShield")) e.conditions.push(unshielded());
    const soak = { ...JSON.parse(JSON.stringify(e)), conditions: [...base, unshielded(), guarding()], actions: [spend(), ...caught()], events: [] };
    list.splice(i - 1, 0, L.comment(CATCH + what + ": caught, the roots close on nothing."), soak);
    return 2; });
}
L.writeJson("externalEvents/leaf_ranger_boss.json", ranger);

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
