// Phase 5 of docs/design-brand-mercy.md, the Brand tree's passives: Riposte (brand 2). Close GDevelop first.
// Usage: node tools/brand/build.js (after tools/composure/build.js). Safe to run again. It
//   1. declares the Player's variables (RiposteMult, RiposteFire);
//   2. puts the script (brand.js) and the Riposte events into Combat_Shared after the Composure script.
const fs = require("fs");
const path = require("path");
const L = require("../bosses/lib.js");

const P = "Player.Variable";
const COMMENT = "Brand passives: Riposte (brand 2): a new perfect deflect sends the player's SHADOW (Player_Shadow: a dark double, tools/fx/player_shadow.js) to the boss, so the player himself stays free to punish. The script spawns it and, when its slash lands, sets Player.RiposteStrike; the events below find the boss for it and do the damage: RiposteMult times AttackDamage off the enemy's health (never its posture). Not in the tutorial.";
const FIND_COMMENT = "Riposte: a perfect deflect asks for the shadow (RiposteFire 1): tell it where the boss stands (RiposteX) and let it come (RiposteFire 2). Skipped while the enemy is invulnerable.";
const DAMAGE_COMMENT = "Riposte: the shadow's slash lands. Health only, no posture, and not while the enemy is invulnerable. Adds a little hit-stop and shake like a hit.";
const ECHO_COMMENT = "Shadow echo (brand 1): an echo of a hit swing (a fainter shadow, one second later, on the spot where the player stood) swings: the script sets EchoStrike and EchoX at its slash frame. It takes EchoMult times AttackDamage of health (never posture) off an enemy within EchoReach px of that spot, so it lands only if the boss is still there.";
const ECHO_CLEAR_COMMENT = "Shadow echo: clear the strike flag.";
const CLEAR_COMMENT = "Riposte: clear the strike flag (also when no enemy was there to hit).";
const CLEAR2_COMMENT = "Riposte: clear the request flag (also when no enemy was there to find).";

const project = L.readJson("Soul Rush.json");
const player = project.objects.find(o => o.name === "Player");
for (const v of L.variables({ RiposteMult: 1.5, RiposteFire: 0, RiposteStrike: 0, RiposteX: 0, EchoMult: 0.5, EchoReach: 140, EchoStrike: 0, EchoX: 0 })) if (!player.variables.some(x => x.name === v.name)) player.variables.push(v);
L.writeJson("Soul Rush.json", project);

const cs = L.readJson("externalEvents/combat_shared.json");
const isComment = (e, start) => e.type === "BuiltinCommonInstructions::Comment" && String(e.comment).startsWith(start);
for (let i = cs.events.length - 1; i >= 0; i--) {
  if (isComment(cs.events[i], "Brand passives:") || isComment(cs.events[i], "Shadow echo")) cs.events.splice(i, 2);
  else if (isComment(cs.events[i], "Riposte:")) cs.events.splice(i, 2);
}
const comp = cs.events.findIndex(e => isComment(e, "Composure:"));
if (comp < 0) throw new Error("run tools/composure/build.js first");
const flag = (name, v) => L.cond("NumberObjectVariable", ["Player", name, "=", String(v)]);
const vulnerable = () => L.cond("BooleanObjectVariable", ["Enemy", "Invulnerable", "False", ""]);
cs.events.splice(comp + 2, 0,
  L.comment(COMMENT), L.jsEvent(fs.readFileSync(path.join(__dirname, "brand.js"), "utf8")),
  L.comment(FIND_COMMENT), L.standard([flag("RiposteFire", 1), vulnerable()], [
    L.act("SetNumberObjectVariable", ["Player", "RiposteX", "=", "Enemy.CenterX()"]),
    L.act("SetNumberObjectVariable", ["Player", "RiposteFire", "=", "2"])], []),
  L.comment(DAMAGE_COMMENT), L.standard([flag("RiposteStrike", 1), vulnerable()], [
    L.act("SetNumberObjectVariable", ["Enemy", "Health", "-", `${P}(AttackDamage) * ${P}(RiposteMult)`]),
    L.act("SetNumberObjectVariable", ["Player", "HitStopLeft", "=", `max(${P}(HitStopLeft), ${P}(HitStopHit))`]),
    L.act("SetNumberObjectVariable", ["Player", "ShakeLeft", "=", `${P}(ShakeTime)`]),
    L.act("SetNumberObjectVariable", ["Player", "ShakeStrength", "=", `max(${P}(ShakeStrength), ${P}(ShakeHit))`])], []),
  L.comment(ECHO_COMMENT), L.standard([flag("EchoStrike", 1), vulnerable(), L.cond("BuiltinCommonInstructions::CompareNumbers", [`abs(Enemy.CenterX() - ${P}(EchoX))`, "<", `${P}(EchoReach)`])], [
    L.act("SetNumberObjectVariable", ["Enemy", "Health", "-", `${P}(AttackDamage) * ${P}(EchoMult)`])], []),
  L.comment(ECHO_CLEAR_COMMENT), L.standard([flag("EchoStrike", 1)], [L.act("SetNumberObjectVariable", ["Player", "EchoStrike", "=", "0"])], []),
  L.comment(CLEAR_COMMENT), L.standard([flag("RiposteStrike", 1)], [L.act("SetNumberObjectVariable", ["Player", "RiposteStrike", "=", "0"])], []),
  L.comment(CLEAR2_COMMENT), L.standard([flag("RiposteFire", 1)], [L.act("SetNumberObjectVariable", ["Player", "RiposteFire", "=", "0"])], []));
L.writeJson("externalEvents/combat_shared.json", cs);
console.log("Brand passives written (Riposte).");
