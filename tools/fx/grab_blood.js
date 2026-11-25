// The blood of the Samurai's grab stab. The stab applies its damage directly (it never goes through Combat_Shared's hit event), and it made its blood with a bare
// Create at Player.CenterX() / CenterY(): no animation picked (so the first one, a fountain that goes straight up), no flip, and at the middle of the player's
// 120x80 frame, which sits about 20 px above his body, so the blood spawned on top of his head and went upward.
// This replaces that Create with the same logic as every other hit (copied from the player's own hit event in Combat_Shared, so they stay the same): one of the 9
// splashes at a random size, flying AWAY from the Samurai (flipped when he is on the right), starting on the wound: the middle of the player's BODY (the frame's
// origin plus 62 px down, times his scale), on his side that faces the Samurai.
// Usage: node tools/fx/grab_blood.js   (close GDevelop first; safe to run again; fixes both the fight's Samurai sheet and the tutorial's copy)
const L = require("../bosses/lib.js");

const isComment = (e, start) => e.type === "BuiltinCommonInstructions::Comment" && String(e.comment).startsWith(start);
const walk = (list, f) => { for (const e of list) { f(e); if (e.events) walk(e.events, f); } };

// The player's blood events, from his own hit in Combat_Shared.
const cs = L.readJson("externalEvents/combat_shared.json");
let hit = null;
walk(cs.events, e => { if (!hit && e.type === "BuiltinCommonInstructions::Standard" && JSON.stringify(e.conditions).includes("Player_Hitbox") && JSON.stringify(e.conditions).includes("HasHitThisSwing") && JSON.stringify(e.actions).includes("JustHitByPlayer")) hit = e; });
if (!hit) throw new Error("the player's hit event is not in Combat_Shared");
const std = hit.events.filter(e => e.type === "BuiltinCommonInstructions::Standard");
const roll = std.find(e => JSON.stringify(e.actions).includes("RandomInRange(0, 8)"));
const bloods = std.filter(e => JSON.stringify(e.actions).includes("\"BloodSprite\"") && JSON.stringify(e.conditions).includes("Player.CenterX()"));
if (!roll || bloods.length !== 2) throw new Error("the player's blood events were not found");
// attacker = the Samurai, victim = the player. The wound is on the player's body.
const copy = e => JSON.parse(JSON.stringify(e).split("Player.CenterX()").join("@ATT@").split("Enemy.CenterX()").join("Player.CenterX()").split("@ATT@").join("Samurai_NPC.CenterX()")
  .split('Enemy.PointX(\\"BloodPoint\\")').join("Player.CenterX()").split('Enemy.PointY(\\"BloodPoint\\")').join("Player.Y() + 62 * Player.ScaleY()"));

for (const file of ["externalEvents/samurai_boss.json", "externalEvents/tutorial_samurai_boss.json"]) {
  const sheet = L.readJson(file);
  let n = 0;
  (function put(list) {
    for (let i = 0; i < list.length; i++) {
      if (isComment(list[i], "Grab: the blade goes in")) {
        const ev = list[i + 1];
        ev.actions = ev.actions.filter(a => !(a.type.value === "Create" && a.parameters[1] === "BloodSprite" && a.parameters[2] === "Player.CenterX()"));
        ev.events = ev.events || [];
        for (let k = ev.events.length - 1; k >= 0; k--) if (isComment(ev.events[k], "Grab blood:")) ev.events.splice(k, 4);       // The comment, the roll and the two splashes (a rerun replaces them).
        ev.events.push(L.comment("Grab blood: the stab's blood, as for every other hit (tools/fx/grab_blood.js): one of the 9 splashes at a random size, flying away from the Samurai, starting on the middle of the player's body (not the middle of his frame, which is above his head). Children of the stab event, so it happens once."),
          copy(roll), ...bloods.map(copy));
        n++;
      }
      if (list[i].events) put(list[i].events);
    }
  })(sheet.events);
  if (n !== 1) throw new Error(file + ": expected one grab stab event, found " + n);
  L.writeJson(file, sheet);
}
console.log("Grab blood written (the fight's Samurai sheet and the tutorial's).");
