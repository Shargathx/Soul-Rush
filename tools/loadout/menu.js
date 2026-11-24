// The altar's loadout menu: its rules and its text, as plain functions (docs/design-brand-mercy.md, phase 4). tools/hub/build.js copies them into
// the hub's interactions script as text (together with tidy and equip from tools/powers/powers.js, which they call), so they use nothing from
// outside; the tests run these same functions. The screen itself (the panel, the keys) is tools/loadout/hubmenu.js.
//
// Rows: 0 to 2 are the three active slots (R), row 3 is the dodge slot. A row's choices are "nothing" (or the roll, for the dodge) and every power
// of that kind the player owns AND that is built. Left and right step through them.

// (As a module, equip comes from powers.js; in the hub script it is a function of the same name copied in next to these.)
const equip = typeof require !== "undefined" ? require("../powers/powers.js").equip : undefined;

function candidates(powers, ownedIds, row) {
  const kind = row === 3 ? "dodge" : "active";
  const out = [row === 3 ? "roll" : ""];
  for (const p of powers) if (p.kind === kind && p.built && ownedIds.indexOf(p.id) >= 0) out.push(p.id);
  return out;
}

// The loadout after stepping a row's choice by dir (+1 or -1), through equip (which keeps a power in one slot only).
function cycle(powers, loadout, ownedIds, row, dir) {
  const list = candidates(powers, ownedIds, row);
  const now = row === 3 ? loadout.dodge : loadout.slots[row];
  let i = list.indexOf(now);
  if (i < 0) i = 0;
  const next = list[(i + dir + list.length) % list.length];
  return equip(powers, loadout, ownedIds, row === 3 ? "dodge" : row, next);
}

// The screen's text for the loadout, the owned powers and the cursor row.
function menuText(powers, loadout, ownedIds, row) {
  const by = {};
  for (const p of powers) by[p.id] = p;
  const name = function (id) { return by[id] ? by[id].name : id === "roll" ? "Roll" : "nothing"; };
  const line = function (r, label, id) {
    const many = candidates(powers, ownedIds, r).length > 1;
    return (r === row ? "> " : "   ") + label + ":  " + (many ? "<  " + name(id) + "  >" : name(id) + "   (nothing to choose yet)");
  };
  const names = function (kind, built) {
    const out = [];
    for (const p of powers) if (p.kind === kind && !!p.built === built && ownedIds.indexOf(p.id) >= 0) out.push(p.name);
    return out.length ? out.join(", ") : "none";
  };
  return [
    "THE ALTAR", "What will you carry?", "",
    "Powers (R)",
    line(0, "1", loadout.slots[0]), line(1, "2", loadout.slots[1]), line(2, "3", loadout.slots[2]),
    "", "Dodge (Space)", line(3, "Dodge", loadout.dodge),
    "", "Always on:  " + names("passive", true),
    "Owned, not ready yet:  " + [names("active", false), names("dodge", false), names("passive", false)].filter(function (s) { return s !== "none"; }).join(", ").replace(/^$/, "none"),
    "", "W / S choose a row    A / D change it    F or Esc close"
  ].join("\n");
}

if (typeof module !== "undefined") module.exports = { candidates, cycle, menuText };
