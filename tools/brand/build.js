// Phase 5 of docs/design-brand-mercy.md, the Brand tree's passives: Riposte (brand 2). Close GDevelop first.
// Usage: node tools/brand/build.js (after tools/composure/build.js and tools/powers/build.js: it adds its debug keys to their gate). Safe to run again. It
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
const COAT_COMMENT = "Metal coat: the Bladekeeper's mercy gift. A hit that took the player's HP to 0 (and the script says he has the power and a use left: Player.MetalCoatReady) forms a metal coating instead of costing a life: he is healed MetalCoatHeal of his max HP, rally and posture are cleared, no life or curse stack is taken, the respawn invulnerability covers him, the enemy flinches (JustStaggered: it stops what it is doing) and slides MetalCoatKnock px away from him over KnockTime seconds (in a grab the coat breaks the grab: the player is released, and the grabbing boss's own sheet staggers it). A harder hit-stop and shake mark it. MetalCoatFire tells the script to spend the use (saved in the progress) and show the effect. This is in front of Player loses a life.";
const COAT_FLINCH_COMMENT = "Metal coat, the flinch: the coat has just formed (MetalCoatFire) and the player was not grabbed: the enemy flinches (JustStaggered: it stops what it is doing) and is set sliding away. NOT when the enemy is invulnerable: that means it is in a protected sequence (the Samurai's ultimate, a grab, his phase intermission), which a flinch would break (the Samurai would stay invulnerable and the player locked). Those sequences are handled by their own boss sheets.";
const COAT_GRAB_COMMENT = "Metal coat, in a grab: the same, when the hit was a grab's stab (the player is IsGrabbed; the blade went in as a direct hit). The coat BREAKS the grab: the player is released at once into the idle pose and the boss slides away like any other. MetalCoatFire stays 1 for the rest of this frame, which is how the grabbing boss's own sheet knows to drop the grab (the Samurai's: Metal coat, the grab breaks, in samurai_boss.json).";
const COAT_KNOCK_COMMENT = "Metal coat, the knockback: for KnockTime seconds the enemy slides away from the player (set when the coat formed), fast at first and slowing to a stop (an ease-out), MetalCoatKnock px in all. A slide, not a jump, so it reads as a shove and not a glitch.";
const REQUIEM_COMMENT = "Requiem (brand 3): the big slash lands (Player.RequiemFire, set by the power's script at its strike): the enemy's HP goes to 0 if it is at or under RequiemHpFracNow of its max (RequiemHpFrac, or a huge number while debug key J has Requiem unlimited). The power checked that the boss was vulnerable when R was pressed and the game has been frozen since, so nothing can have changed, so its own life-loss logic runs: the next life, or on the last life its kneel for the deathblow and the mercy choice. A hard shake (no hit-stop: the whole sequence is frozen already), and the player's own hit sound and blood.";
const REQUIEM_CLEAR_COMMENT = "Requiem: clear the flag (also when the boss was no longer vulnerable).";
const BOSS_INFO_COMMENT = "Boss info for the powers, HP: Player.BossHpFrac is the enemy's HP as a fraction of its max (BossVulnerable, next, is 1 while it is not invulnerable).";
const BOSS_COMMENT = "Boss position: Player.BossX and BossY follow the enemy's BloodPoint (the wound point the blood uses: the frame centre sits above the head, the sprites are low in their frames) every frame, for the bolts of Projectile return (brand 4) to fly at.";
const RETURN_COMMENT = "Projectile return (brand 4): a bolt from a deflected arrow or thrown blade (the script above) arrived: it takes ReturnMult times AttackDamage of health (never posture) off the enemy, with the player's hit sound and blood.";
const RETURN_CLEAR_COMMENT = "Projectile return: clear the strike flag.";
const ECHO_CLEAR_COMMENT = "Shadow echo: clear the strike flag.";
const CLEAR_COMMENT = "Riposte: clear the strike flag (also when no enemy was there to hit).";
const CLEAR2_COMMENT = "Riposte: clear the request flag (also when no enemy was there to find).";

const project = L.readJson("Soul Rush.json");
const player = project.objects.find(o => o.name === "Player");
for (const v of L.variables({ RequiemFire: 0, RequiemSrcX: 0, RequiemHpFracNow: 0.3, RequiemHpFrac: 0.3, RequiemRange: 260, BossHpFrac: 1, BossVulnerable: 1, KnockLeft: 0, KnockDir: 0, KnockTime: 0.3, RiposteMult: 1.5, RiposteFire: 0, RiposteStrike: 0, RiposteX: 0, EchoMult: 0.5, EchoReach: 140, EchoStrike: 0, EchoX: 0, RiposteSrcX: 0, ReturnMult: 1, ReturnStrike: 0, ReturnSrcX: 0, BossX: 0, BossY: 0, RollDeflectOn: 0, MetalCoatReady: 0, MetalCoatFire: 0, MetalCoatHeal: 0.5, MetalCoatKnock: 130 })) if (!player.variables.some(x => x.name === v.name)) player.variables.push(v);
L.writeJson("Soul Rush.json", project);

const cs = L.readJson("externalEvents/combat_shared.json");
const isComment = (e, start) => e.type === "BuiltinCommonInstructions::Comment" && String(e.comment).startsWith(start);
for (let i = cs.events.length - 1; i >= 0; i--) {
  if (isComment(cs.events[i], "Brand passives:") || isComment(cs.events[i], "Shadow echo") || isComment(cs.events[i], "Boss position:") || isComment(cs.events[i], "Boss info for") || isComment(cs.events[i], "Requiem") || isComment(cs.events[i], "Metal coat") || isComment(cs.events[i], "Projectile return")) cs.events.splice(i, 2);
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
  L.comment(BOSS_INFO_COMMENT), L.standard([], [L.act("SetNumberObjectVariable", ["Player", "BossHpFrac", "=", "Enemy.Variable(Health) / max(1, Enemy.Variable(MaxHealth))"])], []),
  L.comment("Boss info for the powers, vulnerable: BossVulnerable is 1."), L.standard([L.cond("BooleanObjectVariable", ["Enemy", "Invulnerable", "False", ""])], [L.act("SetNumberObjectVariable", ["Player", "BossVulnerable", "=", "1"])], []),
  L.comment("Boss info for the powers, invulnerable: BossVulnerable is 0."), L.standard([L.cond("BooleanObjectVariable", ["Enemy", "Invulnerable", "True", ""])], [L.act("SetNumberObjectVariable", ["Player", "BossVulnerable", "=", "0"])], []),
  L.comment(REQUIEM_COMMENT), L.standard([flag("RequiemFire", 1), L.cond("BuiltinCommonInstructions::CompareNumbers", ["Enemy.Variable(Health)", "<=", `Enemy.Variable(MaxHealth) * ${P}(RequiemHpFracNow)`])], [
    L.act("SetNumberObjectVariable", ["Enemy", "Health", "=", "0"]),
    L.act("SetNumberObjectVariable", ["Player", "ShakeLeft", "=", `${P}(ShakeTime)`]), L.act("SetNumberObjectVariable", ["Player", "ShakeStrength", "=", `max(${P}(ShakeStrength), ${P}(ShakeBreak))`])], hitEffects(`${P}(RequiemSrcX)`)),
  L.comment(REQUIEM_CLEAR_COMMENT), L.standard([flag("RequiemFire", 1)], [L.act("SetNumberObjectVariable", ["Player", "RequiemFire", "=", "0"])], []),
  L.comment(BOSS_COMMENT), L.standard([], [L.act("SetNumberObjectVariable", ["Player", "BossX", "=", "Enemy.PointX(\"BloodPoint\")"]), L.act("SetNumberObjectVariable", ["Player", "BossY", "=", "Enemy.PointY(\"BloodPoint\")"])], []),
  L.comment(RETURN_COMMENT), L.standard([flag("ReturnStrike", 1), vulnerable()], [
    L.act("SetNumberObjectVariable", ["Enemy", "Health", "-", `${P}(AttackDamage) * ${P}(ReturnMult)`]),
    L.act("SetNumberObjectVariable", ["Player", "HitStopLeft", "=", `max(${P}(HitStopLeft), ${P}(HitStopHit))`])], hitEffects(`${P}(ReturnSrcX)`)),
  L.comment(RETURN_CLEAR_COMMENT), L.standard([flag("ReturnStrike", 1)], [L.act("SetNumberObjectVariable", ["Player", "ReturnStrike", "=", "0"])], []),
  L.comment(ECHO_CLEAR_COMMENT), L.standard([flag("EchoStrike", 1)], [L.act("SetNumberObjectVariable", ["Player", "EchoStrike", "=", "0"])], []),
  L.comment(CLEAR_COMMENT), L.standard([flag("RiposteStrike", 1)], [L.act("SetNumberObjectVariable", ["Player", "RiposteStrike", "=", "0"])], []),
  L.comment(CLEAR2_COMMENT), L.standard([flag("RiposteFire", 1)], [L.act("SetNumberObjectVariable", ["Player", "RiposteFire", "=", "0"])], []));
// The debug gate also switches off the keys G (the hub opens every gate), Y (Metal coat) and J (Requiem unlimited): DEBUG_KEYS.md lists them.
{
  const gate = cs.events.find(e => e.type === "BuiltinCommonInstructions::JsCode" && (e.inlineCode || []).some(l => /const DEBUG_KEYS/.test(l)));
  gate.inlineCode = gate.inlineCode.map(l => (l.includes("|x|c)$/") ? l.replace("|x|c)$/", "|x|c|g|y|j)$/") : l.includes("|x|c|g|y)$/") ? l.replace("|x|c|g|y)$/", "|x|c|g|y|j)$/") : l));
  if (!gate.inlineCode.some(l => l.includes("|x|c|g|y|j)$/"))) throw new Error("the debug gate was not updated");
}
// Metal coat goes in front of "Player loses a life:" (so the life is never lost).
const lifeAt = cs.events.findIndex(e => isComment(e, "Player loses a life:"));
if (lifeAt < 0) throw new Error("the Player loses a life event was not found");
const heal = () => [
  L.act("SetNumberObjectVariable", ["Player", "Health", "=", `${P}(MaxHealth) * ${P}(MetalCoatHeal)`]),
  L.act("SetNumberObjectVariable", ["Player", "PendingRally", "=", "0"]), L.act("SetNumberObjectVariable", ["Player", "MaxRally", "=", "0"]), L.act("SetNumberObjectVariable", ["Player", "Posture", "=", "0"]),
  L.act("SetBooleanObjectVariable", ["Player", "IsPostureBroken", "False", ""]),
  L.act("SetBooleanObjectVariable", ["Player", "RespawnIframe", "True", ""]), L.act("ResetObjectTimer", ["Player", "\"RespawnTimer\""]),
  L.act("SetNumberObjectVariable", ["Player", "HitStopLeft", "=", `max(${P}(HitStopLeft), ${P}(HitStopBreak))`]),
  L.act("SetNumberObjectVariable", ["Player", "ShakeLeft", "=", `${P}(ShakeTime)`]), L.act("SetNumberObjectVariable", ["Player", "ShakeStrength", "=", `max(${P}(ShakeStrength), ${P}(ShakeBreak))`]),
  L.act("SetNumberObjectVariable", ["Player", "MetalCoatFire", "=", "1"]), L.act("SetNumberObjectVariable", ["Player", "MetalCoatReady", "=", "0"])];
const lethal = () => [L.cond("NumberObjectVariable", ["Player", "Health", "<=", "0"]), flag("MetalCoatReady", 1)];
cs.events.splice(lifeAt, 0,
  L.comment(COAT_COMMENT), L.standard([...lethal(), L.cond("BooleanObjectVariable", ["Player", "IsGrabbed", "False", ""])], heal(), []),
  L.comment(COAT_FLINCH_COMMENT), L.standard([flag("MetalCoatFire", 1), L.cond("BooleanObjectVariable", ["Player", "IsGrabbed", "False", ""]), L.cond("BooleanObjectVariable", ["Enemy", "Invulnerable", "False", ""])], [
    L.act("SetBooleanObjectVariable", ["Enemy", "JustStaggered", "True", ""]),
    L.act("SetNumberObjectVariable", ["Player", "KnockDir", "=", "sign(Enemy.CenterX() - Player.CenterX())"]), L.act("SetNumberObjectVariable", ["Player", "KnockLeft", "=", `${P}(KnockTime)`])], []),
  L.comment(COAT_GRAB_COMMENT), L.standard(lethal(), [...heal(),
    L.act("SetBooleanObjectVariable", ["Player", "IsGrabbed", "False", ""]), L.act("SetBooleanObjectVariable", ["Player", "ControlsLocked", "False", ""]),
    L.act("AnimatableCapability::AnimatableBehavior::SetName", ["Player", "Animation", "=", "\"Player_Idle\""]), L.act("ChangeSprite", ["Player", "=", "0"]), L.act("AnimatableCapability::AnimatableBehavior::PlayAnimation", ["Player", "Animation"]),
    L.act("SetNumberObjectVariable", ["Player", "KnockDir", "=", "sign(Enemy.CenterX() - Player.CenterX())"]), L.act("SetNumberObjectVariable", ["Player", "KnockLeft", "=", `${P}(KnockTime)`])], []),
  L.comment(COAT_KNOCK_COMMENT), L.standard([L.cond("NumberObjectVariable", ["Player", "KnockLeft", ">", "0"])], [
    L.act("SetX", ["Enemy", "+", `${P}(KnockDir) * 2 * ${P}(MetalCoatKnock) / ${P}(KnockTime) * (${P}(KnockLeft) / ${P}(KnockTime)) * TimeDelta()`]),
    L.act("SetNumberObjectVariable", ["Player", "KnockLeft", "-", "TimeDelta()"])], []));
L.writeJson("externalEvents/combat_shared.json", cs);

// Roll deflect (brand 5), the Samurai's grab: one event goes in front of "Grab connects" in samurai_boss.json, built from its conditions: a perfect sword
// block (the grab whiffs and he is open, as a missed grab is). Dodging is its own reward (the roll still beats the grab as before), so a dodge gets nothing extra.
const sb = L.readJson("externalEvents/samurai_boss.json");
const ULT_COMMENT = "Metal coat, the ultimate: the coat forms (Player.MetalCoatFire) while Thousand Cuts is running: the cuts still to come are blown away into blossom petals and sparks (the cut object and the deflect tell are deleted), so the ultimate's own finish event runs at once and gives everything back: the player is unlocked, he is vulnerable again, the bars return. There is no flinch and no slide here (he is invulnerable, see the flinch event in Combat_Shared), so the sequence is never broken.";
const PETALS_COMMENT = "Metal coat, the petals burst: when the player's metal coat forms (Player.MetalCoatFire), every Samurai petal still out (the petal casts and the mirror's waves) is set to State burst, so the petal event below pops each one into blossom petals and removes its blade. The tornado is not a petal and stays.";
const BREAK_COMMENT = "Metal coat, the grab breaks: the player's metal coat just formed (Player.MetalCoatFire, set this frame by Combat_Shared) while he was holding them in the stab: the blade glances off, so the grab is dropped. He flinches into Stagger (the same state a lunge causes, ending in AggroReady when it finishes), is no longer invulnerable, his attack bits are cleared and the grab cooldown starts so he cannot grab again at once. Combat_Shared has already released the player and set the boss sliding.";
const BLOCK_COMMENT = "Roll deflect: the grab would connect, but the player's sword is up in the PERFECT window of a deflect (brand 5, Player.RollDeflectOn): the grab is blocked and whiffs (he is left over-reached for the punish window), the boss takes deflect posture, with the clash and a spark.";
(function put(list) {
  for (let i = list.length - 1; i >= 0; i--) if (isComment(list[i], "Roll deflect:") || isComment(list[i], "Metal coat")) list.splice(i, 2);
  const at = list.findIndex(e => isComment(e, "Grab connects:"));
  if (at >= 0) {
    const grab = list[at + 1], base = (without) => JSON.parse(JSON.stringify(grab.conditions.filter(c => !(c.type.value === "BooleanObjectVariable" && c.parameters[0] === "Player" && c.parameters[1] === "Iframe" && c.parameters[2] === without))));
    const posture = [L.act("SetNumberObjectVariable", ["Samurai_NPC", "Posture", "+", `${P}(DeflectPostureDamage)`]), L.act("ResetObjectTimer", ["Samurai_NPC", "\"PostureRegenTimer\""]), L.act("SetNumberObjectVariable", ["Player", "PerfectCount", "+", "1"])];   // (a blocked grab is a perfect block: it counts)
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
    const S = "Samurai_NPC", set = (name, op, v) => L.act("SetNumberObjectVariable", [S, name, op, v]);
    const breaks = L.standard([L.cond("NumberObjectVariable", ["Player", "MetalCoatFire", "=", "1"]), L.cond("StringObjectVariable", [S, "AIState", "=", "\"GrabHold\""])], [
      L.act("Delete", ["Samurai_Hitbox", ""]), L.act("Delete", ["Samurai_Dash_Line", ""]), L.act("Delete", ["Samurai_Grab_Warning", ""]),
      set("AttackSubState", "=", "0"), set("ComboCount", "=", "0"), set("SkillStep", "=", "0"), L.act("SetBooleanObjectVariable", [S, "ComboPending", "False", ""]), L.act("SetBooleanObjectVariable", [S, "WillDodgeHit", "False", ""]),
      L.act("SetBooleanObjectVariable", [S, "Invulnerable", "False", ""]), L.act("SetStringObjectVariable", [S, "DashType", "=", "\"\""]),
      L.act("ResetObjectTimer", [S, "\"GrabCooldownTimer\""]), set("GrabCooldownNow", "=", `RandomInRange(${S}.Variable(GrabCooldownMin), ${S}.Variable(GrabCooldownMax))`),
      L.act("SetStringObjectVariable", [S, "AIState", "=", "\"Stagger\""]), L.act("AnimatableCapability::AnimatableBehavior::SetName", [S, "Animation", "=", "\"Samurai_Stagger\""]), L.act("ChangeSprite", [S, "=", "0"]),
      L.act("AnimatableCapability::AnimatableBehavior::PlayAnimation", [S, "Animation"]), set("RecoilLeft", "=", `${S}.Variable(RecoilTime)`)], []);
    const petals = L.standard([L.cond("NumberObjectVariable", ["Player", "MetalCoatFire", "=", "1"])], [L.act("SetStringObjectVariable", ["Samurai_Petal", "State", "=", "\"burst\""])], []);
    const ult = L.standard([L.cond("NumberObjectVariable", ["Player", "MetalCoatFire", "=", "1"]), L.cond("StringObjectVariable", [S, "AIState", "=", "\"Ultimate\""])], [
      L.act("Delete", ["Thousand_Cuts_Ultimate", ""]), L.act("Delete", ["Ult_Deflect_Tell", ""]),
      ...[-170, -100, -35, 35, 100, 170].map(dx => L.act("Create", ["", "Samurai_Petal_Pop", `Player.CenterX() + ${dx} + RandomInRange(-25, 25)`, "Player.CenterY() + RandomInRange(-90, 30)", ""])),
      L.act("ScalableCapability::ScalableBehavior::SetX", ["Samurai_Petal_Pop", "Scale", "=", `${S}.ScaleX()`]), L.act("ScalableCapability::ScalableBehavior::SetY", ["Samurai_Petal_Pop", "Scale", "=", `${S}.ScaleY()`]),
      ...[0, 1, 2].map(() => L.act("Create", ["", "Deflect_Spark", "Player.CenterX() + RandomInRange(-90, 90)", "Player.CenterY() + RandomInRange(-70, 20)", ""])),
      L.act("AnimatableCapability::AnimatableBehavior::SetIndex", ["Deflect_Spark", "Animation", "=", "RandomInRange(0, 2)"]),
      L.act("ScalableCapability::ScalableBehavior::SetX", ["Deflect_Spark", "Scale", "=", "1.6"]), L.act("ScalableCapability::ScalableBehavior::SetY", ["Deflect_Spark", "Scale", "=", "1.6"])],
      [L.jsEvent("// The new sparks are drawn additively, as in Combat_Shared's deflect: a flash.\nfor (const s of runtimeScene.getObjects(\"Deflect_Spark\")) if (!s.__lit) { s.__lit = true; s.setBlendMode(1); }")]);
    // The flinch event of a lunge must not break the ultimate or the intermission either (they end through their own events).
    (function guard(l) { for (const e of l) { if (e.type === "BuiltinCommonInstructions::Standard" && JSON.stringify(e.conditions || []).includes("JustStaggered") && JSON.stringify(e.actions || []).includes("Samurai_Stagger")) {
      for (const st of ["Ultimate", "Intermission"]) if (!JSON.stringify(e.conditions).includes("\\\"" + st + "\\\"")) e.conditions.push(L.cond("StringObjectVariable", [S, "AIState", "=", "\"" + st + "\""])), e.conditions[e.conditions.length - 1].type.inverted = true;
    } if (e.events) guard(e.events); } })(sb.events);
    list.splice(at, 0, L.comment(ULT_COMMENT), ult, L.comment(PETALS_COMMENT), petals, L.comment(BREAK_COMMENT), breaks, L.comment(BLOCK_COMMENT), block);
    return true;
  }
  for (const e of list) if (e.events && put(e.events)) return true;
  return false;
})(sb.events) || (() => { throw new Error("the Samurai's Grab connects event was not found"); })();
L.writeJson("externalEvents/samurai_boss.json", sb);
console.log("Brand passives written (Riposte).");
