// The powers of the Curse, Brand and Mercy design (docs/design-brand-mercy.md), as data, and the rules that say which ones the player owns and what
// the loadout may hold. tools/hub/build.js bakes the POWERS list and the functions below into the hub's gates script (owned() and tidy() are
// written as plain functions so they can be copied into the script as text), and the tests run the same functions.
//
// kind:   "active" (R, takes one of the 3 loadout slots), "passive" (always on, no slot), "dodge" (one dodge slot: the roll, Flash step or Wraith dash).
// source: where the player gets it, one of
//   { kill: scene }   the boss of that scene was beaten without mercy (a brand)
//   { spare: scene }  the boss of that scene was spared (a mercy)
//   { brand: n }      the brand count is n or more (the Brand tree)
//   { mercy: n }      the mercy count is n or more (the Mercy tree)
//   { bonus: flag }   a progress flag (the Samurai's flawless fight: Samurai_Petal)
// built:  false until the power works in the game; the hub only lets the player equip built actives and dodges.
const POWERS = [
  // The Brand tree (kills): the passives and Requiem come from the brand count alone.
  { id: "shadow_echo", name: "Shadow echo", kind: "passive", source: { brand: 1 }, built: true },
  { id: "riposte", name: "Riposte", kind: "passive", source: { brand: 2 }, built: true },
  { id: "requiem", name: "Requiem", kind: "active", source: { brand: 3 }, built: false },
  { id: "projectile_return", name: "Projectile return", kind: "passive", source: { brand: 4 }, built: true },
  { id: "roll_deflect", name: "Roll deflect", kind: "passive", source: { brand: 5 }, built: true },
  // The Mercy tree (spares): Composure.
  { id: "poise", name: "Poise", kind: "passive", source: { mercy: 1 }, built: true },
  { id: "respite", name: "Respite", kind: "passive", source: { mercy: 2 }, built: true },
  { id: "steady_hand", name: "Steady hand", kind: "passive", source: { mercy: 3 }, built: true },
  { id: "light_step", name: "Light step", kind: "passive", source: { mercy: 4 }, built: true },
  { id: "grace", name: "Grace", kind: "passive", source: { mercy: 5 }, built: false },
  // The bosses: a kill power and a mercy gift each (the Cat gives only a life, and a brand; the Fire Knight's scene is not in the game yet).
  { id: "wraith_dash", name: "Wraith dash", kind: "dodge", source: { kill: "Samurai_Fight" }, built: true },
  { id: "flash_step", name: "Flash step", kind: "dodge", source: { spare: "Samurai_Fight" }, built: true },
  { id: "poison_stab", name: "Poison stab", kind: "active", source: { kill: "Leaf_Ranger_Fight" }, built: false },
  { id: "decoy", name: "Decoy", kind: "active", source: { kill: "Leaf_Ranger_Fight" }, built: false },
  { id: "bloom", name: "Bloom", kind: "active", source: { spare: "Leaf_Ranger_Fight" }, built: false },
  { id: "blood_pact", name: "Blood pact", kind: "active", source: { kill: "Gunslinger" }, built: true },
  { id: "pistol_parry", name: "Pistol parry", kind: "active", source: { spare: "Gunslinger" }, built: false },
  { id: "berserk", name: "Berserk", kind: "active", source: { kill: "Bladekeeper_Fight" }, built: false },
  { id: "metal_coat", name: "Metal coat", kind: "passive", source: { spare: "Bladekeeper_Fight" }, built: false },
  { id: "cinder_blade", name: "Cinder blade", kind: "active", source: { kill: "Fire_Knight_Fight" }, built: false },
  { id: "flame_attack", name: "Flame attack", kind: "active", source: { spare: "Fire_Knight_Fight" }, built: false },
  // Bonus powers.
  { id: "petal_step", name: "Petal step", kind: "active", source: { bonus: "Samurai_Petal" }, built: false },
];

// The ids of the powers the player owns, from the saved progress ({ beaten: { scene: true, scene_Spared: true, flag: true } }) and the counts
// ({ brand, mercy }). A plain function: it is copied into the hub script as text, so it uses nothing from outside.
function owned(powers, beaten, counts) {
  const out = [];
  for (const p of powers) {
    const s = p.source;
    let has = false;
    if (s.kill) has = !!beaten[s.kill] && !beaten[s.kill + "_Spared"];
    else if (s.spare) has = !!beaten[s.spare] && !!beaten[s.spare + "_Spared"];
    else if (s.brand) has = counts.brand >= s.brand;
    else if (s.mercy) has = counts.mercy >= s.mercy;
    else if (s.bonus) has = !!beaten[s.bonus];
    if (has) out.push(p.id);
  }
  return out;
}

// A loadout is { slots: [id or "", id or "", id or ""], dodge: id or "roll" }. tidy() returns it with anything the player does not own (or that is
// not built yet, or is the wrong kind for its place) taken out, so a wiped save, a changed design or a hand-edited file never leaves a bad power equipped.
function tidy(powers, loadout, ownedIds) {
  const by = {};
  for (const p of powers) by[p.id] = p;
  const ok = (id, kind) => !!id && by[id] && by[id].kind === kind && by[id].built && ownedIds.indexOf(id) >= 0;
  const slots = [];
  for (let i = 0; i < 3; i++) {
    const id = loadout && loadout.slots ? loadout.slots[i] : "";
    slots.push(ok(id, "active") && slots.indexOf(id) < 0 ? id : "");
  }
  const dodge = loadout && ok(loadout.dodge, "dodge") ? loadout.dodge : "roll";
  return { slots: slots, dodge: dodge };
}

// Puts a power into a slot (0 to 2) or the dodge slot (slot "dodge"), returning the new loadout; "" empties a slot, "roll" resets the dodge. A power can be in one slot only.
function equip(powers, loadout, ownedIds, slot, id) {
  const next = { slots: loadout.slots.slice(), dodge: loadout.dodge };
  if (slot === "dodge") next.dodge = id || "roll";
  else {
    const at = next.slots.indexOf(id);
    if (id && at >= 0) next.slots[at] = "";
    next.slots[slot] = id || "";
  }
  return tidy(powers, next, ownedIds);
}

const EMPTY_LOADOUT = { slots: ["", "", ""], dodge: "roll" };
if (typeof module !== "undefined") module.exports = { POWERS, owned, tidy, equip, EMPTY_LOADOUT };
