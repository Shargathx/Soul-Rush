// Phase 2 of docs/design-brand-mercy.md: the HP budget. Close GDevelop first. Usage: node tools/budget/build.js
// Safe to run again (it changes nothing the second time). It
//   1. declares the Player's budget variables (BrandBudget, HpFloorPercent, BrandFraction, SacrificeHP, BreachDeath);
//   2. puts the Brand budget script (budget.js) into Combat_Shared right after the scene start event;
//   3. changes the curse events there: a life lost now takes max HP by the new formula (brands and curse stacks, never below the
//      floor) and a curse stack that would breach the floor is fatal; the deathblow clears ONE stack, not all of them; the Alt debug
//      key uses the same formula; and a new event takes "sacrificed" HP off directly (rally cannot win it back).
const fs = require("fs");
const path = require("path");
const L = require("../bosses/lib.js");

const P = "Player.Variable";
const FLOOR = `${P}(BaseMaxHealth) * ${P}(HpFloorPercent) / 100`;
// Max HP with the brands' loss and `stacks` curse stacks, never below the floor.
const maxAfter = stacks => `max(${FLOOR}, round(${P}(BaseMaxHealth) * (1 - ${P}(BrandFraction) - (${stacks}) * ${P}(CursePercent) / 100)))`;
const OLD_LIFE_MAX = `max(1, ${P}(MaxHealth) - ${P}(BaseMaxHealth) * ${P}(CursePercent) / 100)`;
const OLD_ALT_MAX = `max(1, ${P}(BaseMaxHealth) * (1 - 4 * ${P}(CursePercent) / 100))`;

const SCRIPT_COMMENT = "Brand budget: on the first frame of a fight, the brands the player has earned take max HP (BrandBudget / N each, never below the HP floor) and the Cat's mercy adds a life. Not in the tutorial. The curse stacks of this fight work on top of it.";
const BREACH_COMMENT = "Curse breach: a curse stack that takes max HP below the HP floor (HpFloorPercent of the base) is fatal. The life count is set to 0, so the last-life-gone event below plays the death, and BreachDeath marks it for the ending. (A player with many brands cannot afford many curse stacks.)";
const SACRIFICE_COMMENT = "Sacrificed HP: a power that pays in HP sets Player.SacrificeHP. The HP comes off at once, never kills (at least 1 is left), and is not written into the rally pool, so rally cannot win it back. It is added up in SacrificedOwed so Bloom cannot mend it either. The deathblow's refill still restores it.";

// 1. The Player's variables.
const project = L.readJson("Soul Rush.json");
const player = project.objects.find(o => o.name === "Player");
const add = L.variables({ BrandBudget: 60, HpFloorPercent: 10, BrandFraction: 0, SacrificeHP: 0, SacrificedOwed: 0, BreachDeath: false });
for (const v of add) if (!player.variables.some(x => x.name === v.name)) player.variables.push(v);
L.writeJson("Soul Rush.json", project);

// 2 and 3. The events.
const cs = L.readJson("externalEvents/combat_shared.json");
const isComment = (e, start) => e.type === "BuiltinCommonInstructions::Comment" && String(e.comment).startsWith(start);
const setNum = (e, name, op) => (e.actions || []).find(a => a.type.value === "SetNumberObjectVariable" && a.parameters[1] === name && (!op || a.parameters[2] === op));
const walk = (events, fn) => { for (const e of events) { fn(e); if (e.events) walk(e.events, fn); } };

// The script event: replace an earlier copy, then put it right after the scene start event (a comment and a standard event).
for (let i = cs.events.length - 1; i >= 0; i--) if (isComment(cs.events[i], "Brand budget:")) cs.events.splice(i, 2);
const start = cs.events.findIndex(e => isComment(e, "Scene start: remember"));
if (start < 0) throw new Error("the scene start event is not in Combat_Shared");
cs.events.splice(start + 2, 0, L.comment(SCRIPT_COMMENT), L.jsEvent(fs.readFileSync(path.join(__dirname, "budget.js"), "utf8")));

let changed = { life: false, removal: false, alt: false, sacrifice: false };
walk(cs.events, e => {
  if (e.type !== "BuiltinCommonInstructions::Standard") return;
  // A life lost.
  const lifeMax = setNum(e, "MaxHealth", "=");
  if (lifeMax && [OLD_LIFE_MAX, maxAfter(`${P}(CurseStacks) + 1`)].includes(lifeMax.parameters[3]) && (e.actions || []).some(a => a.type.value === "SetNumberObjectVariable" && a.parameters[1] === "Lives" && a.parameters[2] === "-")) {
    lifeMax.parameters[3] = maxAfter(`${P}(CurseStacks) + 1`);
    if (!e.events.some(k => isComment(k, "Curse breach:"))) {
      const breach = L.standard(
        [L.cond("BuiltinCommonInstructions::CompareNumbers", [`${P}(BaseMaxHealth) * (1 - ${P}(BrandFraction) - ${P}(CurseStacks) * ${P}(CursePercent) / 100)`, "<", `${FLOOR} - 0.001`])],
        [L.act("SetNumberObjectVariable", ["Player", "Lives", "=", "0"]), L.act("SetBooleanObjectVariable", ["Player", "BreachDeath", "True", ""])], []);
      e.events.unshift(L.comment(BREACH_COMMENT), breach);
    }
    changed.life = true;
  }
  // The deathblow clears one stack.
  if ((e.conditions || []).some(c => c.type.value === "BooleanObjectVariable" && c.parameters[1] === "DeathblowLanded")) {
    const m = setNum(e, "MaxHealth", "="), c = setNum(e, "CurseStacks", "=");
    if (m && c && [`${P}(BaseMaxHealth)`, maxAfter(`max(0, ${P}(CurseStacks) - 1)`)].includes(m.parameters[3])) {
      m.parameters[3] = maxAfter(`max(0, ${P}(CurseStacks) - 1)`);
      c.parameters[3] = `max(0, ${P}(CurseStacks) - 1)`;
      changed.removal = true;
    }
  }
  // The Alt debug key's "on" event.
  const alt = setNum(e, "MaxHealth", "=");
  if (alt && (e.conditions || []).some(c => JSON.stringify(c).includes("LAlt")) && [OLD_ALT_MAX, maxAfter("4")].includes(alt.parameters[3])) { alt.parameters[3] = maxAfter("4"); changed.alt = true; }
});

// The comments that describe the changed events.
for (const e of cs.events) {
  if (isComment(e, "Player loses a life:")) e.comment = "Player loses a life: applies the curse (one more CurseStacks; max HP is the base minus the brands' loss and the curse stacks, never below the HP floor), clears rally and posture, and starts respawn invulnerability. On the last life, or when the stack breaches the floor, the player dies instead.";
  if (isComment(e, "Curse removal:")) e.comment = "Curse removal: the deathblow sets Player.DeathblowLanded. This clears ONE curse stack and gives its max HP back (the brands' loss stays), refills HP, and clears rally.";
}
// The sacrificed HP event goes right after the curse removal event (its comment, then the event).
for (let k = cs.events.length - 1; k >= 0; k--) if (isComment(cs.events[k], "Sacrificed HP:")) cs.events.splice(k, 2);
const removalAt = cs.events.findIndex(x => isComment(x, "Curse removal:"));
if (removalAt >= 0) {
  cs.events.splice(removalAt + 2, 0, L.comment(SACRIFICE_COMMENT), L.standard(
    [L.cond("NumberObjectVariable", ["Player", "SacrificeHP", ">", "0"])],
    [L.act("SetNumberObjectVariable", ["Player", "SacrificedOwed", "+", `min(${P}(SacrificeHP), max(0, ${P}(Health) - 1))`]), L.act("SetNumberObjectVariable", ["Player", "Health", "=", `max(1, ${P}(Health) - ${P}(SacrificeHP))`]), L.act("SetNumberObjectVariable", ["Player", "SacrificeHP", "=", "0"])], []));
  changed.sacrifice = true;
}
for (const e of cs.events) {
  if (isComment(e, "Deathblow:")) e.comment = e.comment.replace("and the curse lifts as the life wisps reach the player", "and one curse stack lifts as the life wisps reach the player");
  if (isComment(e, "Deathblow glow:")) e.comment = e.comment.replace("the curse lifts and HP refills", "one curse stack lifts and HP refills");
}
if (Object.values(changed).some(v => !v)) throw new Error("an event was not found or already differs: " + JSON.stringify(changed));
L.writeJson("externalEvents/combat_shared.json", cs);
console.log("Brand budget written; the curse events changed:", Object.keys(changed).join(", "));
