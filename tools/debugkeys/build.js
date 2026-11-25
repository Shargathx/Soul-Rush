// The boss debug keys, one numpad layout for all four bosses (2026-11-26). Close GDevelop first. Usage: node tools/debugkeys/build.js
// (after tools/brand/build.js; then tools/bosses/build.js for the Cat's and the Bladekeeper's keys, which live in their .def.js files).
// Safe to run again: moving an old key to its new one happens once (an already moved event is left alone), the events this file adds are replaced.
//   Numpad 0 idle on/off    Numpad 1-9 moves of the page    Numpad Enter page 1/2 (Samurai, Leaf Ranger)    Numpad + dodge    Numpad - take a life
//   F3 hitboxes (every fight)    F5 restart
// Numpad digits with Shift are NOT used: Windows turns them into arrow / Home keys. DEBUG_KEYS.md lists every key.
const L = require("../bosses/lib.js");

const isComment = e => e.type === "BuiltinCommonInstructions::Comment";
const J = x => JSON.stringify(x);
const isKeyCond = c => /KeyFromText/.test(c.type.value) || (/BuiltinCommonInstructions::(Or|And)/.test(c.type.value) && (c.subInstructions || []).length && c.subInstructions.every(isKeyCond));
const keysOf = c => (/KeyFromText/.test(c.type.value) ? [(c.type.inverted ? "!" : "") + (/JustPressed/.test(c.type.value) ? "" : "held:") + String(c.parameters[1]).split('"').join("")] : [].concat(...(c.subInstructions || []).map(keysOf)));
const eventKeys = e => (e.conditions || []).filter(isKeyCond).map(keysOf).map(k => k.join("|")).join(" & ");
const pressed = name => L.cond("KeyFromTextJustPressed", ["", "\"" + name + "\""]);
const either = (a, b) => ({ type: { value: "BuiltinCommonInstructions::Or" }, parameters: [], subInstructions: [pressed(a), pressed(b)] });
const onPage = n => L.cond("NumberObjectVariable", ["Player", "DebugPage", "=", String(n)]);
const copy = x => JSON.parse(J(x));
const PAGE = n => "Debug, Numpad " + n;
const note = (what, extra) => "Debug, " + what + (extra ? ". " + extra : "") + " (DEBUG_KEYS.md; tools/debugkeys/build.js)";

// Puts `text` in the comment above events[i], adding one if there is none. Returns the new index of the event.
function comment(list, i, text) {
  if (i > 0 && isComment(list[i - 1])) { list[i - 1].comment = text; return i; }
  list.splice(i, 0, L.comment(text));
  return i + 1;
}
const find = (list, keys, extra) => list.findIndex(e => !isComment(e) && eventKeys(e) === keys && (!extra || extra(e)));
// Replace an event's key conditions with `keyConds` (they come first, the rest stay).
const rekey = (e, keyConds) => { e.conditions = keyConds.concat((e.conditions || []).filter(c => !isKeyCond(c))); };
// Move every event on the old keys to the new ones. Returns how many it moved.
function move(list, oldKeys, keyConds, text) {
  let n = 0;
  for (let i = find(list, oldKeys); i >= 0; i = find(list, oldKeys)) { rekey(list[i], keyConds()); comment(list, i, text); n++; if (n > 4) throw new Error("the new keys of " + text + " look like the old ones"); }
  return n;
}
// Delete the events on a key, with their own comment.
function drop(list, keys) {
  let n = 0;
  for (let i = find(list, keys); i >= 0; i = find(list, keys)) { const c = i > 0 && isComment(list[i - 1]) ? 1 : 0; list.splice(i - c, 1 + c); n++; }
  return n;
}
const report = {};

// ---------- the Samurai ----------
const sam = L.readJson("externalEvents/samurai_boss.json"), se = sam.events;
if (find(se, "F8") >= 0) {                                            // Not moved yet.
  const N = (page, digit) => () => [pressed("Numpad" + digit), onPage(page)];
  // The old keys that clash with new ones go first (his mirror tornados were on Numpad 1 and 2).
  const table = [
    ["Numpad1", N(2, 3), "page 2, Numpad 3: the mirror tornado (no dash after it)"],
    ["Numpad2", N(2, 4), "page 2, Numpad 4: the mirror tornado with the dash strike after it, both through the player"],
    ["F2 & !held:LShift & !held:RShift", N(1, 1), "page 1, Numpad 1: a Judgement Cut on the player"],
    ["F2 & held:LShift|held:RShift", N(1, 2), "page 1, Numpad 2: he cancels what he is doing and starts a triple Quickdraw"],
    ["F6", N(1, 3), "page 1, Numpad 3: the petals"],
    ["F7", N(1, 4), "page 1, Numpad 4: the tornado"],
    ["F8", N(1, 5), "page 1, Numpad 5: the grab"],
    ["Num6", N(1, 6), "page 1, Numpad 6: the dash strike"],
    ["Num7", N(1, 7), "page 1, Numpad 7: the wall slash"],
    ["PageDown", N(1, 8), "page 1, Numpad 8: a melee window"],
    ["Num3", N(1, 9), "page 1, Numpad 9: the front, behind, back attack (no images)"],
    ["Home", N(2, 1), "page 2, Numpad 1: the mirror Judgement Cut"],
    ["End", N(2, 2), "page 2, Numpad 2: the mirror petal waves"],
    ["Num4", N(2, 5), "page 2, Numpad 5: the front, behind, back attack with the images attacking too"],
    ["Num5", N(2, 6), "page 2, Numpad 6: the single crossing"],
    ["Num9", N(2, 7), "page 2, Numpad 7: the double dodge (second dash and second image)"],
    ["Insert", N(2, 8), "page 2, Numpad 8: the next phase (from the first life to phase 2; this event comes AFTER the phase 3 one, so one press moves one phase)"],
    ["PageUp", N(2, 8), "page 2, Numpad 8: the next phase (from the second life to phase 3)"],
    ["F9", N(2, 9), "page 2, Numpad 9: his last life in phase 3 just under 75% HP, which starts Thousand Cuts"],
    ["Num8", () => [either("Add", "NumpadAdd")], "Numpad +: he dodges"]
  ];
  // Next phase: one press, one phase. The phase 3 event goes first and needs exactly two lives; the phase 2 event needs three.
  const lives = (op, v) => L.cond("NumberObjectVariable", ["Samurai_NPC", "Lives", op, String(v)]);
  const up = find(se, "PageUp"), upBlock = se.splice(up - 1, 2), ins = find(se, "Insert");
  upBlock[1].conditions.push(lives("=", 2));
  se[ins].conditions.push(lives(">=", 3));
  se.splice(ins - 1, 0, ...upBlock);
  for (const [old, conds, text] of table) {
    const n = move(se, old, conds, note(text));
    if (n < 1) throw new Error("Samurai: no event on " + old);
    report["Samurai " + old] = n;
  }
  // Replaced by the shared keys (take a life, F3), or an experiment that is over (Num1 and Num2: the old and the faster dash).
  for (const old of ["Delete", "Num1", "Num2", "held:F3"]) if (drop(se, old) < 1) throw new Error("Samurai: no event to remove on " + old);
}
// The idle toggle is Numpad 0 only (the top-row 0 went).
function numpadZero(list, who) {
  const i = find(list, "Num0|Numpad0");
  if (i >= 0) { rekey(list[i], [pressed("Numpad0")]); comment(list, i, note("Numpad 0: idle on or off", "While idle he stands and can still be hit; a move key does that one move, then he goes back to idle")); report[who + " idle"] = 1; }
}
numpadZero(se, "Samurai");
L.writeJson("externalEvents/samurai_boss.json", sam);

const tut = L.readJson("externalEvents/tutorial_samurai_boss.json");
numpadZero(tut.events, "Tutorial");
drop(tut.events, "held:F3");
L.writeJson("externalEvents/tutorial_samurai_boss.json", tut);

// ---------- the Leaf Ranger ----------
const leaf = L.readJson("externalEvents/leaf_ranger_boss.json"), le = leaf.events;
const OURS = "Debug keys (Leaf):";
for (let i = le.length - 2; i >= 0; i--) if (isComment(le[i]) && String(le[i].comment).startsWith(OURS)) le.splice(i, 2);
const setStr = (name, value) => L.act("SetStringObjectVariable", ["Leaf_Ranger", name, "=", "\"" + value + "\""]);
const flagIs = v => L.cond("BooleanObjectVariable", ["Leaf_Ranger", "DebugInactive", v, ""]);
const setFlag = v => L.act("SetBooleanObjectVariable", ["Leaf_Ranger", "DebugInactive", v, ""]);
const stateIs = (s, inverted) => { const c = L.cond("StringObjectVariable", ["Leaf_Ranger", "AIState", "=", "\"" + s + "\""]); if (inverted) c.type.inverted = true; return c; };
if (find(le, "F4") >= 0) {                                            // Not moved yet.
  for (let d = 1; d <= 9; d++) {                                      // Page 1: the same digits, now on page 1 only.
    const i = find(le, "Numpad" + d);
    if (i < 0) throw new Error("Leaf: no event on Numpad" + d);
    rekey(le[i], [pressed("Numpad" + d), onPage(1)]);
    comment(le, i, note("page 1, Numpad " + d + ": " + ["the normal shot", "the entangle shot", "the poison shot", "the delayed shot", "the double shot", "the stab", "the arrow rain", "the air volley", "the beam"][d - 1]));
  }
  // The plain air volley must say its arrows are plain: after a triple poison or entangle volley, AirKind would still be set.
  le[find(le, "Numpad8")].actions.push(setStr("AirKind", ""));
  const table = [
    ["Divide|NumpadDivide", 1, "the thorn wall, ignoring its cooldown"],
    ["Multiply|NumpadMultiply", 2, "Overgrowth now, whatever his HP"],
    ["Subtract|NumpadSubtract", 3, "the escape slide with its snare trail"],
    ["Add|NumpadAdd", 4, "the leap over the player"],
    ["NumpadReturn & !held:LShift", 5, "the Bramble Grasp"],
    ["NumpadReturn & held:LShift", 6, "a lingering poison cloud at the player's feet"],
    ["F4", 7, "up to the sniper perch"]
  ];
  for (const [old, digit, text] of table) if (move(le, old, () => [pressed("Numpad" + digit), onPage(2)], note("page 2, Numpad " + digit + ": " + text)) !== 1) throw new Error("Leaf: expected one event on " + old);
  // The perch also from idle.
  const perch = le[find(le, "Numpad7", e => J(e.actions).includes("PerchNow"))];
  perch.conditions = perch.conditions.filter(c => !(c.type.value === "StringObjectVariable" && c.parameters[1] === "AIState"));
  perch.conditions.push({ type: { value: "BuiltinCommonInstructions::Or" }, parameters: [], subInstructions: [stateIs("Neutral"), stateIs("Inactive")] });
  // The idle toggle: it now STAYS idle after a move (DebugInactive), and pressing it during such a move only switches idle off.
  const z = find(le, "Numpad0"), toggle = le[z];
  comment(le, z, note("Numpad 0: idle on or off", "While idle he stands and can still be hit; a move key does that one move, then he goes back to idle"));
  const off = toggle.events.filter(e => !isComment(e));
  if (off.length !== 3) throw new Error("Leaf: the idle toggle has changed");
  const [fighting, , finish] = off;
  fighting.conditions.push(flagIs("False"));
  fighting.actions.push(setFlag("True"));
  toggle.events = [
    L.comment("Fighting: cancel whatever he is doing and switch him off."), fighting,
    L.comment("Idle and standing: switch him back on."), L.standard([flagIs("True"), stateIs("Inactive")], [setFlag("False"), setStr("AIState", "Neutral"), L.act("ResetObjectTimer", ["Leaf_Ranger", "\"ActionTimer\""])], []),
    L.comment("Idle but in the middle of a move he was asked for: only switch idle off; the move finishes."), L.standard([flagIs("True"), stateIs("InactiveNow", true)], [setFlag("False")], []),
    L.comment("Finish switching off, so the press above does not switch him straight back on."), finish
  ];
  report["Leaf moved"] = 17;
}
// The additions: stay idle after a move; the escape slide as his dodge on +; the two air triples (they had no key).
const stay = L.standard([flagIs("True"), stateIs("Neutral")], [setStr("AIState", "Inactive")], []);
le.unshift(L.comment(OURS + " while debug idle is on, a finished move goes back to idle instead of to Neutral, so one key is one move."), stay);
const at = find(le, "Numpad9", e => J(e.conditions).includes('"DebugPage","=","1"'));
const slide = copy(le[find(le, "Numpad3", e => J(e.conditions).includes('"DebugPage","=","2"'))]);
rekey(slide, [either("Add", "NumpadAdd")]);
slide.conditions = slide.conditions.filter(c => !(c.type.value === "NumberObjectVariable" && c.parameters[1] === "DebugPage"));
const volley = le[find(le, "Numpad8", e => J(e.conditions).includes('"DebugPage","=","1"'))];
const triple = (digit, kind) => { const e = copy(volley); rekey(e, [pressed("Numpad" + digit)]); e.conditions = [e.conditions[0], onPage(2)].concat(e.conditions.slice(1).filter(c => !(c.type.value === "NumberObjectVariable" && c.parameters[1] === "DebugPage"))); e.actions = e.actions.filter(a => !(a.parameters[1] === "AirKind")).concat([setStr("AirKind", kind)]); return e; };
le.splice(at + 1, 0,
  L.comment(OURS + " Numpad +: his dodge, the escape slide (the same as page 2, Numpad 3)."), slide,
  L.comment(OURS + " page 2, Numpad 8: the air triple poison (as in his phase 2 rotation, code Q)."), triple(8, "poison"),
  L.comment(OURS + " page 2, Numpad 9: the air triple entangle (code W)."), triple(9, "entangle"));
// F3 is shared now.
drop(le, "F3");
L.writeJson("externalEvents/leaf_ranger_boss.json", leaf);

const leafScene = L.readJson("layouts/leaf_ranger_fight.json");
const ranger = leafScene.objects.find(o => o.name === "Leaf_Ranger");
if (!ranger.variables.some(v => v.name === "DebugInactive")) ranger.variables.push(...L.variables({ DebugInactive: false }));
L.writeJson("layouts/leaf_ranger_fight.json", leafScene);

// ---------- shared: Combat_Shared ----------
const project = L.readJson("Soul Rush.json");
const player = project.objects.find(o => o.name === "Player");
for (const v of L.variables({ DebugPage: 1, DebugDraw: 0 })) if (!player.variables.some(x => x.name === v.name)) player.variables.push(v);
L.writeJson("Soul Rush.json", project);

const cs = L.readJson("externalEvents/combat_shared.json"), ce = cs.events;
const SHARED = "Debug keys (shared):";
for (let i = ce.length - 2; i >= 0; i--) if (isComment(ce[i]) && String(ce[i].comment).startsWith(SHARED)) ce.splice(i, 2);
const PAGES = `// Debug keys: the page of the numpad's move keys. Numpad Enter switches between page 1 and page 2 in the fights whose boss has two pages (the Samurai and
// the Leaf Ranger), and a line at the top says which one is on. The boss sheets read Player.DebugPage. With DEBUG_KEYS off the key reads as never
// pressed and the line is not shown.
const TWO_PAGES = ["Samurai_Fight", "Leaf_Ranger_Fight"];
const players = runtimeScene.getObjects("Player");
if (players.length && TWO_PAGES.includes(runtimeScene.getName())) {
  const pv = players[0].getVariables(), input = gdjs.evtTools.input;
  const st = runtimeScene.__debugPage || (runtimeScene.__debugPage = { text: null, shown: "" });
  if (input.wasKeyJustPressed(runtimeScene, "NumpadReturn")) pv.get("DebugPage").setNumber(pv.get("DebugPage").getAsNumber() === 1 ? 2 : 1);
  const text = gdjs.__soulRushDebugGate ? "" : "Debug moves: page " + pv.get("DebugPage").getAsNumber() + " of 2";
  if (typeof PIXI !== "undefined" && PIXI.Text) {
    if (!st.text) {
      try {
        st.text = new PIXI.Text("", { fontFamily: "Georgia, serif", fontSize: 15, fill: 0xe8dcc0, stroke: 0x000000, strokeThickness: 3 });
        if (st.text.anchor) st.text.anchor.set(1, 0);
        st.text.x = runtimeScene.getGame().getGameResolutionWidth() - 16; st.text.y = 12; st.text.zIndex = 800000;
        runtimeScene.getLayer("UI").getRenderer().getRendererObject().addChild(st.text);
      } catch (e) { st.text = null; }
    }
    if (st.text && st.shown !== text) { st.text.text = text; st.shown = text; }
  }
}`;
const draw = (v, on) => L.standard([L.cond("NumberObjectVariable", ["Player", "DebugDraw", "=", v])], [L.act("DebuggerTools::EnableDebugDraw", ["", on, "yes", "no", "no"])], []);
const f5 = ce.findIndex(e => isComment(e) && String(e.comment).startsWith("Debug: F5"));
if (f5 < 0) throw new Error("the F5 event is not in Combat_Shared");
ce.splice(f5, 0,
  L.comment(SHARED + " the page of the numpad's move keys (Numpad Enter; the Samurai and the Leaf Ranger)."), L.jsEvent(PAGES),
  L.comment(SHARED + " F3 draws every bounding box (blue) and hitbox (red), hidden ones too; press again to turn it off. Every fight."),
  L.standard([pressed("F3")], [L.act("SetNumberObjectVariable", ["Player", "DebugDraw", "=", "1 - Player.Variable(DebugDraw)"])], [L.comment("On."), draw("1", "yes"), L.comment("Off."), draw("0", "no")]),
  L.comment(SHARED + " Numpad -: take a life from the boss (HP to 0, so its own life-loss logic runs: the next life, or on the last one its kneel or death). Not while it cannot be hurt. Every fight."),
  L.standard([either("Subtract", "NumpadSubtract"), L.cond("BooleanObjectVariable", ["Enemy", "Invulnerable", "False", ""])], [L.act("SetNumberObjectVariable", ["Enemy", "Health", "=", "0"])], []));
L.writeJson("externalEvents/combat_shared.json", cs);
console.log("Debug keys written." + (Object.keys(report).length ? " Moved: " + Object.keys(report).length + " groups." : " (The old keys were already moved.)"));
