// Phase 5 of docs/design-brand-mercy.md, the Brand tree's passives: Riposte (brand 2). Close GDevelop first.
// Usage: node tools/brand/build.js (after tools/composure/build.js). Safe to run again. It
//   1. declares the Player's variables (RiposteMult, RiposteFire);
//   2. puts the script (brand.js) and the Riposte events into Combat_Shared after the Composure script.
const fs = require("fs");
const path = require("path");
const L = require("../bosses/lib.js");

const P = "Player.Variable";
const COMMENT = "Brand passives: Riposte (brand 2): a new perfect deflect makes the player's blade counter at once, RiposteMult times AttackDamage taken off the enemy's health (never its posture). The script sets Player.RiposteFire; the two events below do the damage and clear it. Not in the tutorial.";
const DAMAGE_COMMENT = "Riposte: the counter. Health only, no posture, and not while the enemy is invulnerable. Adds a little hit-stop and shake like a hit.";
const CLEAR_COMMENT = "Riposte: clear the flag (also when no enemy was there to hit).";

const project = L.readJson("Soul Rush.json");
const player = project.objects.find(o => o.name === "Player");
for (const v of L.variables({ RiposteMult: 1.5, RiposteFire: 0 })) if (!player.variables.some(x => x.name === v.name)) player.variables.push(v);
L.writeJson("Soul Rush.json", project);

const cs = L.readJson("externalEvents/combat_shared.json");
const isComment = (e, start) => e.type === "BuiltinCommonInstructions::Comment" && String(e.comment).startsWith(start);
for (let i = cs.events.length - 1; i >= 0; i--) {
  if (isComment(cs.events[i], "Brand passives:")) cs.events.splice(i, 2);
  else if (isComment(cs.events[i], "Riposte:")) cs.events.splice(i, 2);
}
const comp = cs.events.findIndex(e => isComment(e, "Composure:"));
if (comp < 0) throw new Error("run tools/composure/build.js first");
const fire = L.cond("NumberObjectVariable", ["Player", "RiposteFire", "=", "1"]);
cs.events.splice(comp + 2, 0,
  L.comment(COMMENT), L.jsEvent(fs.readFileSync(path.join(__dirname, "brand.js"), "utf8")),
  L.comment(DAMAGE_COMMENT), L.standard([fire, L.cond("BooleanObjectVariable", ["Enemy", "Invulnerable", "False", ""])], [
    L.act("SetNumberObjectVariable", ["Enemy", "Health", "-", `${P}(AttackDamage) * ${P}(RiposteMult)`]),
    L.act("SetNumberObjectVariable", ["Player", "HitStopLeft", "=", `max(${P}(HitStopLeft), ${P}(HitStopHit))`]),
    L.act("SetNumberObjectVariable", ["Player", "ShakeLeft", "=", `${P}(ShakeTime)`]),
    L.act("SetNumberObjectVariable", ["Player", "ShakeStrength", "=", `max(${P}(ShakeStrength), ${P}(ShakeHit))`])], []),
  L.comment(CLEAR_COMMENT), L.standard([JSON.parse(JSON.stringify(fire))], [L.act("SetNumberObjectVariable", ["Player", "RiposteFire", "=", "0"])], []));
L.writeJson("externalEvents/combat_shared.json", cs);
console.log("Brand passives written (Riposte).");
