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
const BOSS_COMMENT = "Boss position: Player.BossX and BossY follow the enemy's BloodPoint (the wound point the blood uses: the frame centre sits above the head, the sprites are low in their frames) every frame, for the bolts of Projectile return (brand 4) to fly at.";
const RETURN_COMMENT = "Projectile return (brand 4): a bolt from a deflected arrow or thrown blade (the script above) arrived: it takes ReturnMult times AttackDamage of health (never posture) off the enemy, with the player's hit sound and blood.";
const RETURN_CLEAR_COMMENT = "Projectile return: clear the strike flag.";
const ECHO_CLEAR_COMMENT = "Shadow echo: clear the strike flag.";
const CLEAR_COMMENT = "Riposte: clear the strike flag (also when no enemy was there to hit).";
const CLEAR2_COMMENT = "Riposte: clear the request flag (also when no enemy was there to find).";

const project = L.readJson("Soul Rush.json");
const player = project.objects.find(o => o.name === "Player");
for (const v of L.variables({ RiposteMult: 1.5, RiposteFire: 0, RiposteStrike: 0, RiposteX: 0, EchoMult: 0.5, EchoReach: 140, EchoStrike: 0, EchoX: 0, RiposteSrcX: 0, ReturnMult: 1, ReturnStrike: 0, ReturnSrcX: 0, BossX: 0, BossY: 0, RollDeflectOn: 0, RollDeflectWindow: 0.14 })) if (!player.variables.some(x => x.name === v.name)) player.variables.push(v);
L.writeJson("Soul Rush.json", project);

const cs = L.readJson("externalEvents/combat_shared.json");
const isComment = (e, start) => e.type === "BuiltinCommonInstructions::Comment" && String(e.comment).startsWith(start);
for (let i = cs.events.length - 1; i >= 0; i--) {
  if (isComment(cs.events[i], "Brand passives:") || isComment(cs.events[i], "Shadow echo") || isComment(cs.events[i], "Boss position:") || isComment(cs.events[i], "Projectile return")) cs.events.splice(i, 2);
  else if (isComment(cs.events[i], "Riposte:")) cs.events.splice(i, 2);
}
const comp = cs.events.findIndex(e => isComment(e, "Composure:"));
if (comp < 0) throw new Error("run tools/composure/build.js first");
const flag = (name, v) => L.cond("NumberObjectVariable", ["Player", name, "=", String(v)]);
const vulnerable = () => L.cond("BooleanObjectVariable", ["Enemy", "Invulnerable", "False", ""]);
// The hit effects of a shadow's cut: the player's own hit sound (one of hit_1 to hit_5 at volume 85) and blood (one of the 9 splashes, flying away from the
// shadow), copied from the events of the player's hit in this sheet so they stay the same as his. srcX is where the shadow stood.
function hitEffects(srcX) {
  const hit = (function find(list) { for (const e of list) { if (e.type === "BuiltinCommonInstructions::Standard" && JSON.stringify(e.conditions).includes("Player_Hitbox") && JSON.stringify(e.conditions).includes("HasHitThisSwing") && JSON.stringify(e.actions).includes("JustHitByPlayer")) return e; if (e.events) { const r = find(e.events); if (r) return r; } } return null; })(cs.events);
  if (!hit) throw new Error("the player's hit event is not in Combat_Shared");
  const mine = list => list.filter(e => e.type === "BuiltinCommonInstructions::Standard");
  const roll = mine(hit.events).find(e => JSON.stringify(e.actions).includes("RandomInRange(0, 8)"));
  const bloods = mine(hit.events).filter(e => JSON.stringify(e.actions).includes('"BloodSprite"') && JSON.stringify(e.conditions).includes("Player.CenterX()"));
  if (!roll || bloods.length !== 2) throw new Error("the player's blood events were not found (roll " + !!roll + ", splashes " + bloods.length + ")");
  const copy = e => JSON.parse(JSON.stringify(e).split("Player.CenterX()").join(srcX));
  const sounds = [1, 2, 3, 4, 5].map(n => L.standard([L.cond("NumberObjectVariable", ["Player", "HitSoundRoll", "=", String(n)])], [L.act("PlaySound", ["", "assets/Sfx/hits/hit_" + n + ".mp3", "", "85", ""])], []));
  return [L.comment("Hit effects: the player's own hit sound and blood, from the shadow's side (the blood flies away from it)."),
    L.standard([], [L.act("SetNumberObjectVariable", ["Player", "HitSoundRoll", "=", "RandomInRange(1, 5)"])], []), copy(roll), ...bloods.map(copy), ...sounds];
}
cs.events.splice(comp + 2, 0,
  L.comment(COMMENT), L.jsEvent(fs.readFileSync(path.join(__dirname, "brand.js"), "utf8")),
  L.comment(FIND_COMMENT), L.standard([flag("RiposteFire", 1), vulnerable()], [
    L.act("SetNumberObjectVariable", ["Player", "RiposteX", "=", "Enemy.CenterX()"]),
    L.act("SetNumberObjectVariable", ["Player", "RiposteFire", "=", "2"])], []),
  L.comment(DAMAGE_COMMENT), L.standard([flag("RiposteStrike", 1), vulnerable()], [
    L.act("SetNumberObjectVariable", ["Enemy", "Health", "-", `${P}(AttackDamage) * ${P}(RiposteMult)`]),
    L.act("SetNumberObjectVariable", ["Player", "HitStopLeft", "=", `max(${P}(HitStopLeft), ${P}(HitStopHit))`]),
    L.act("SetNumberObjectVariable", ["Player", "ShakeLeft", "=", `${P}(ShakeTime)`]),
    L.act("SetNumberObjectVariable", ["Player", "ShakeStrength", "=", `max(${P}(ShakeStrength), ${P}(ShakeHit))`])], hitEffects(`${P}(RiposteSrcX)`)),
  L.comment(ECHO_COMMENT), L.standard([flag("EchoStrike", 1), vulnerable(), L.cond("BuiltinCommonInstructions::CompareNumbers", [`abs(Enemy.CenterX() - ${P}(EchoX))`, "<", `${P}(EchoReach)`])], [
    L.act("SetNumberObjectVariable", ["Enemy", "Health", "-", `${P}(AttackDamage) * ${P}(EchoMult)`])], hitEffects(`${P}(EchoX)`)),
  L.comment(BOSS_COMMENT), L.standard([], [L.act("SetNumberObjectVariable", ["Player", "BossX", "=", "Enemy.PointX(\"BloodPoint\")"]), L.act("SetNumberObjectVariable", ["Player", "BossY", "=", "Enemy.PointY(\"BloodPoint\")"])], []),
  L.comment(RETURN_COMMENT), L.standard([flag("ReturnStrike", 1), vulnerable()], [
    L.act("SetNumberObjectVariable", ["Enemy", "Health", "-", `${P}(AttackDamage) * ${P}(ReturnMult)`]),
    L.act("SetNumberObjectVariable", ["Player", "HitStopLeft", "=", `max(${P}(HitStopLeft), ${P}(HitStopHit))`])], hitEffects(`${P}(ReturnSrcX)`)),
  L.comment(RETURN_CLEAR_COMMENT), L.standard([flag("ReturnStrike", 1)], [L.act("SetNumberObjectVariable", ["Player", "ReturnStrike", "=", "0"])], []),
  L.comment(ECHO_CLEAR_COMMENT), L.standard([flag("EchoStrike", 1)], [L.act("SetNumberObjectVariable", ["Player", "EchoStrike", "=", "0"])], []),
  L.comment(CLEAR_COMMENT), L.standard([flag("RiposteStrike", 1)], [L.act("SetNumberObjectVariable", ["Player", "RiposteStrike", "=", "0"])], []),
  L.comment(CLEAR2_COMMENT), L.standard([flag("RiposteFire", 1)], [L.act("SetNumberObjectVariable", ["Player", "RiposteFire", "=", "0"])], []));
L.writeJson("externalEvents/combat_shared.json", cs);

// Roll deflect (brand 5), the Samurai's grab: two events go in front of "Grab connects" in samurai_boss.json, built from its conditions.
//   a perfect sword block (the grab whiffs and he is open, as a missed grab is), and a perfect dodge (the roll still beats the grab as before; the boss takes
//   posture damage and Player.PerfectCount goes up). The Cat's dash and eruption are done in tools/bosses/kit.js.
const sb = L.readJson("externalEvents/samurai_boss.json");
const BLOCK_COMMENT = "Roll deflect: the grab would connect, but the player's sword is up in the PERFECT window of a deflect (brand 5, Player.RollDeflectOn): the grab is blocked and whiffs (he is left over-reached for the punish window), the boss takes deflect posture, with the clash and a spark. The dodge below is what the roll does.";
const DODGE_COMMENT = "Roll deflect: the grab would connect, but the player's dodge (roll, Flash step or Wraith dash) started within RollDeflectWindow: a perfect dodge. The grab misses as before; the boss takes deflect posture and the dodge counts as a perfect one (the PERFECT mark, Respite). No sparks.";
(function put(list) {
  for (let i = list.length - 1; i >= 0; i--) if (isComment(list[i], "Roll deflect:")) list.splice(i, 2);
  const at = list.findIndex(e => isComment(e, "Grab connects:"));
  if (at >= 0) {
    const grab = list[at + 1], base = (without) => JSON.parse(JSON.stringify(grab.conditions.filter(c => !(c.type.value === "BooleanObjectVariable" && c.parameters[0] === "Player" && c.parameters[1] === "Iframe" && c.parameters[2] === without))));
    const posture = [L.act("SetNumberObjectVariable", ["Samurai_NPC", "Posture", "+", `${P}(DeflectPostureDamage)`]), L.act("ResetObjectTimer", ["Samurai_NPC", "\"PostureRegenTimer\""]), L.act("SetNumberObjectVariable", ["Player", "PerfectCount", "+", "1"])];
    const block = L.standard([...base(null), L.cond("BooleanObjectVariable", ["Player", "IsDeflecting", "True", ""]), L.cond("NumberObjectVariable", ["Player", "FacingOk", "=", "1"]), L.cond("NumberObjectVariable", ["Player", "RollDeflectOn", "=", "1"]),
      L.cond("CompareObjectTimer", ["Player", "\"DeflectTimer\"", "<=", `${P}(DeflectWindow) * ${P}(PerfectFractionNow)`])], [
      L.act("SetStringObjectVariable", ["Samurai_NPC", "AIState", "=", "\"GrabWhiff\""]), L.act("SetNumberObjectVariable", ["Samurai_NPC", "SkillStep", "=", "0"]),
      L.act("Delete", ["Samurai_Grab_Warning", ""]), L.act("ResetObjectTimer", ["Samurai_NPC", "\"GrabTimer\""]),
      L.act("SetBooleanObjectVariable", ["Player", "DeflectBlocked", "True", ""]), ...posture,
      L.act("PlaySound", ["", "assets/Sfx/deflect_clash_mid_echo.wav", "", "51", ""]),
      L.act("Create", ["", "Deflect_Spark", "Player.PointX(\"Blade\")", "Player.PointY(\"Blade\")", ""]),
      L.act("AnimatableCapability::AnimatableBehavior::SetIndex", ["Deflect_Spark", "Animation", "=", "RandomInRange(0, 2)"]),
      L.act("SetNumberObjectVariable", ["Player", "HitStopLeft", "=", `max(${P}(HitStopLeft), ${P}(HitStopDeflect))`]),
      L.act("SetNumberObjectVariable", ["Player", "ShakeLeft", "=", `${P}(ShakeTime)`]), L.act("SetNumberObjectVariable", ["Player", "ShakeStrength", "=", `max(${P}(ShakeStrength), ${P}(ShakeDeflect))`])],
      [L.jsEvent("// The new spark is drawn additively, as in Combat_Shared's deflect.\nfor (const s of runtimeScene.getObjects(\"Deflect_Spark\")) if (!s.__lit) { s.__lit = true; s.setBlendMode(1); }")]);
    const dodge = L.standard([...base("False").concat([L.cond("BooleanObjectVariable", ["Player", "Iframe", "True", ""])]), L.cond("BooleanObjectVariable", ["Player", "IsRolling", "True", ""]), L.cond("NumberObjectVariable", ["Player", "RollDeflectOn", "=", "1"]),
      L.cond("CompareObjectTimer", ["Player", "\"RollTimer\"", "<=", `${P}(RollDeflectWindow)`])], posture, []);
    list.splice(at, 0, L.comment(BLOCK_COMMENT), block, L.comment(DODGE_COMMENT), dodge);
    return true;
  }
  for (const e of list) if (e.events && put(e.events)) return true;
  return false;
})(sb.events) || (() => { throw new Error("the Samurai's Grab connects event was not found"); })();
L.writeJson("externalEvents/samurai_boss.json", sb);
console.log("Brand passives written (Riposte).");
