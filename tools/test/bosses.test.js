// The Cat and Bladekeeper fights (tools/bosses): their scenes are wired to Combat_Shared the way the older bosses are, every
// move of their script runs to its end in every phase, and a whole fight against a scripted player (tools/test/sim.js, a stand-in
// for GDevelop and Combat_Shared) never throws, never leaks hitboxes and ends with the boss's death.
const fs = require("fs");
const path = require("path");
const { load, ROOT, exists, walk, codeOf } = require("./lib");
const { simulate, runMove } = require("./sim");

// What each boss must have. moves: every move the script names; states: what a full fight must pass through.
const BOSSES = [
  { scene: "Cat_Fight", boss: "Cat", sheet: "Cat_Boss", lives: 3, label: "Ferocious Beast",
    moves: ["swipeA", "swipeB", "swipeC", "pounce", "zoom", "burrow", "flurry", "maul", "hiss", "dodge", "stagger", "lifeLost"],
    attacks: ["swipeA", "swipeB", "swipeC", "pounce", "zoom", "burrow", "flurry", "maul"],
    states: ["Intro", "Neutral", "Swipe", "Stunned", "LifeLost", "Dead"] },
  { scene: "Bladekeeper_Fight", boss: "Bladekeeper", sheet: "Bladekeeper_Boss", lives: 2, label: "The Bladekeeper",
    moves: ["combo", "throw", "roll", "guard", "air", "trap", "garden", "dodge", "stagger", "lifeLost"],
    attacks: ["combo", "throw", "roll", "guard", "air", "trap", "garden"],
    states: ["Intro", "Neutral", "Stunned", "LifeLost", "Dead"] }
].filter(b => load().scenes.some(s => s.name === b.scene));

// Combat_Shared's contract for a boss, from its header and the Leaf Ranger: the Enemy group, and these variables on the object.
const CONTRACT = ["JustHitByPlayer", "AIState", "Health", "MaxHealth", "Lives", "Posture", "MaxPosture", "PostureDamage", "StunDuration", "DeathblowOrbDrop", "IsPostureBroken",
  "JustPostureBroken", "JustRecovered", "JustHitPlayer", "JustDodgedHit", "JustLostLife", "JustDied", "JustDeflected", "JustStaggered", "Invulnerable", "WillDodgeHit", "HasDeathAnimation",
  "MeleeDamagesPosture", "DeflectAnySide", "AimX", "PostureRegenDelay", "PostureRegenFull", "PostureRegenEmpty", "DeathHold", "LifeHold", "StateT"];

const tests = [];
if (!BOSSES.length) tests.push(["boss fights: none built yet (node tools/bosses/build.js)", () => []]);

for (const B of BOSSES) {
  tests.push([B.label + ": scene, groups, sheet and variables fit Combat_Shared", () => {
    const bad = [], { scenes, sheets } = load(), sc = scenes.find(s => s.name === B.scene), obj = sc.objects.find(o => o.name === B.boss);
    const grp = n => (sc.objectsGroups.find(g => g.name === n) || { objects: [] }).objects.map(o => o.name);
    if (!grp("Enemy").includes(B.boss)) bad.push(B.boss + " is not in the Enemy group");
    const boxes = grp("EnemyHitbox"); if (!boxes.includes(B.boss + "_Hitbox")) bad.push(B.boss + "_Hitbox is not in the EnemyHitbox group");
    for (const n of boxes) { const o = sc.objects.find(x => x.name === n); for (const v of ["Damage", "HasHit", "IsMelee"]) if (!o.variables.some(x => x.name === v)) bad.push(n + " has no " + v + " variable (Combat_Shared needs it)"); }
    const have = new Set(obj.variables.map(v => v.name)); for (const v of CONTRACT) if (!have.has(v)) bad.push(B.boss + " lacks the variable " + v);
    const val = n => (obj.variables.find(v => v.name === n) || {}).value;
    if (val("Lives") !== B.lives) bad.push("expected " + B.lives + " lives, has " + val("Lives"));
    if (val("Health") !== val("MaxHealth")) bad.push("Health must start at MaxHealth");
    if (val("AimX") !== -1) bad.push("AimX must start at -1 (directional deflects use the boss's own position)");
    const sh = sheets.find(s => s.name === B.sheet); if (!sh || sh.associatedLayout !== B.scene) bad.push("sheet " + B.sheet + " must be associated with " + B.scene);
    let linked = false, order = [];
    walk(sc.events, e => { if (e.type === "BuiltinCommonInstructions::Link") order.push(e.target); });
    if (order.join(",") !== "Player_Movement,Combat_Shared," + B.sheet) bad.push("the scene must link Player_Movement, Combat_Shared, then " + B.sheet + " (so the flags are fresh when the boss reads them), got " + order.join(","));
    const cs = sheets.find(s => s.name === "Combat_Shared"); if (!cs || !JSON.stringify(cs.events).includes(B.scene + ": { obj: \\\"" + B.boss + "\\\"")) bad.push("the fight UI's BOSSES table in Combat_Shared has no entry for " + B.scene);
    // The boss's first frame is on its feet: instance at floor level, scaled to its frame.
    const inst = sc.instances.find(i => i.name === B.boss); if (!inst) bad.push("no " + B.boss + " instance in the scene"); else if (inst.y !== 657) bad.push(B.boss + " should start with its feet on the floor (y 657), is at " + inst.y);
    const need = ["Player", "Player_Hitbox", "Enemy_HP_Bar", "Enemy_Posture_Bar", "Deathblow_Prompt", "Ground_Stuff"]; for (const n of need) if (!sc.instances.some(i => i.name === n)) bad.push("the scene has no " + n);
    return bad;
  }]);

  tests.push([B.label + ": every animation the script plays exists, every hurtbox is a real rectangle, balance numbers are in range (docs/balance.md)", () => {
    const bad = [], sc = load().scenes.find(s => s.name === B.scene), obj = sc.objects.find(o => o.name === B.boss), names = new Set(obj.animations.map(a => a.name));
    const code = codeOf(load().sheets.find(s => s.name === B.sheet).events.find(e => e.type === "BuiltinCommonInstructions::JsCode"));
    const used = new Set([...code.matchAll(/\b(?:play|hold|show)\("([A-Za-z_0-9]+)"/g)].map(m => m[1])); for (const m of code.matchAll(/setAnimationName\("([A-Za-z_0-9]+)"/g)) used.add(m[1]);
    for (const u of used) if (!names.has(u) && !sc.objects.some(o => (o.animations || []).some(a => a.name === u))) bad.push("the script plays \"" + u + "\", which no object has");
    const cfg = JSON.parse(code.match(/const CFG = (\{.*\});/)[1]);
    for (const a of obj.animations) {
      const n = a.directions[0].sprites.length; if (!cfg.anims[a.name] || cfg.anims[a.name].n !== n) bad.push(a.name + ": the script's table says " + (cfg.anims[a.name] || {}).n + " frames, the object has " + n);
      if (Array.isArray(cfg.anims[a.name].dt) && cfg.anims[a.name].dt.length !== n) bad.push(a.name + ": " + cfg.anims[a.name].dt.length + " frame times for " + n + " frames");
      a.directions[0].sprites.forEach((s, i) => { const m = s.customCollisionMask[0]; if (!exists(s.image)) bad.push(s.image + " is missing"); if (!m || m.length !== 4) bad.push(a.name + " frame " + i + " has no hurtbox"); else if (!(m[2].x > m[0].x && m[2].y > m[0].y)) bad.push(a.name + " frame " + i + " has an empty hurtbox"); });
    }
    const o = n => (obj.variables.find(v => v.name === n) || {}).value;
    for (const [k, v] of Object.entries({ PostureDamage: o("PostureDamage") })) if (!(v >= 15 && v <= 25)) bad.push(k + " " + v + ": the player should break in 4 to 6 hits (100 posture)");
    const P = JSON.parse(fs.readFileSync(path.join(ROOT, "Soul Rush.json"), "utf8")).objects.find(x => x.name === "Player"), pv = n => (P.variables.find(x => x.name === n) || {}).value;
    const bossBreak = o("MaxPosture") / pv("DeflectPostureDamage"), chip = o("MaxHealth") / pv("AttackDamage");
    if (!(bossBreak >= 4 && bossBreak <= 8)) bad.push("his posture should break in 4 to 8 deflects, got " + bossBreak.toFixed(1));
    if (!(chip > bossBreak)) bad.push("chipping his HP (" + chip.toFixed(1) + " hits a life) must be slower than breaking his posture with deflects (" + bossBreak.toFixed(1) + ")");
    for (const v of obj.variables) if (/Damage$/.test(v.name) && v.name !== "PostureDamage" && !(v.value >= 8 && v.value <= 35)) bad.push(v.name + " is " + v.value + ": between 8 and 35");
    for (const n of ["PostureRegenDelay", "PostureRegenFull", "PostureRegenEmpty"]) if (o(n) === undefined) bad.push("needs " + n);
    return bad;
  }]);

  tests.push([B.label + ": every move runs to its end in every phase, stays in the arena, and the attacks make hitboxes that can hit the player", () => {
    const bad = [];
    for (const lives of Array.from({ length: B.lives }, (_, i) => i + 1)) for (const m of B.moves) {
      const R = runMove(B.scene, B.boss, B.sheet, m, lives, 600, { after: m === "trap" ? 600 : 0 });
      const tag = B.boss + " " + m + " (" + lives + " lives left): ";
      if (R.errors.length) { bad.push(tag + R.errors[0]); continue; }
      if (!R.ended) { bad.push(tag + "didn't end in 25 s (state " + R.state + ")"); continue; }
      if (R.minX < 60 || R.maxX > 1230) bad.push(tag + "left the arena: x " + Math.round(R.minX) + " to " + Math.round(R.maxX));
      if (Math.abs(R.boss.y - 657) > 1) bad.push(tag + "ended off the floor (y " + R.boss.y + ")");
      if (R.scene.list("EnemyHitbox").length) bad.push(tag + R.scene.list("EnemyHitbox").length + " hitboxes still alive at the end");
      if (B.attacks.includes(m)) { if (!R.hitboxes && !R.shots) bad.push(tag + "made no hitbox or projectile"); else if (!R.touched && !R.shots) bad.push(tag + "no hitbox reached a player standing 400 px away (it should close in)"); }
    }
    return bad;
  }]);

  tests.push([B.label + ": a whole fight against a scripted player (3 seeds, 2 skill levels): no errors, no leaks, the boss goes through its states and dies", () => {
    const bad = [], seen = new Set();
    for (const [seed, skill] of [[1, 0.2], [2, 0.6], [3, 0.9]]) {
      const S = simulate(B.scene, B.boss, B.sheet, { seed, skill, frames: 60 * 60 * 8 });
      const tag = "seed " + seed + " skill " + skill + ": ";
      if (S.errors.length) { bad.push(tag + S.errors[0]); continue; }
      if (!S.died) bad.push(tag + "the boss never died in 8 minutes (lives left " + S.finalLives + ", state " + [...S.states].pop() + ")");
      S.states.forEach(s => seen.add(s));
      if (S.scene.maxLive[B.boss + "_Hitbox"] > 10) bad.push(tag + "too many hitboxes at once");
    }
    for (const s of B.states) if (!seen.has(s)) bad.push("never reached the state " + s);
    return bad;
  }]);
}

for (const B of BOSSES) tests.push([B.label + ": the debug keys start its moves (Numpad1 and up), Numpad0 takes a life, and they go through the DEBUG_KEYS gate", () => {
  const bad = [], code = codeOf(load().sheets.find(s => s.name === B.sheet).events.find(e => e.type === "BuiltinCommonInstructions::JsCode")), keys = JSON.parse(code.match(/const KEYS = (\{.*\});/)[1]);
  if (!/wasKeyJustPressed/.test(code)) bad.push("no debug keys in the script");
  for (const [key, move] of Object.entries(keys)) {
    if (!/^(Numpad[0-9]|NumpadAdd)$/.test(key)) bad.push(key + " is not a number pad key (the DEBUG_KEYS gate in Combat_Shared only switches off the number pad, F2 to F10 and the like)");
    if (move !== "loseLife" && !B.moves.includes(move)) bad.push(key + " starts " + move + ", which is not a move");
  }
  if (keys.Numpad0 !== "loseLife") bad.push("Numpad0 should take a life");
  // Press each key in a running fight: the move starts (or the boss's HP goes to 0).
  const { Scene, Obj, Vars, bossScript } = require("./sim"); const sc0 = load().scenes.find(s => s.name === B.scene);
  for (const [key, move] of Object.entries(keys)) {
    const sc = new Scene(sc0, B.scene), boss = sc.spawn(B.boss, 1000, 657); const player = sc.spawn("Player", 300, 457);
    const fn = new Function("runtimeScene", "gdjs", bossScript(B.sheet)); let pressed = null;
    const gd = { evtTools: { input: { wasKeyJustPressed: (s, k) => k === pressed } } };
    for (let f = 0; f < 5; f++) { sc.time += 1 / 60; fn(sc, gd); }
    pressed = key; sc.time += 1 / 60; fn(sc, gd); pressed = null;
    if (move === "loseLife") { if (boss.vars.get("Health").getAsNumber() !== 0) bad.push(key + " didn't take the boss's HP to 0"); }
    else if (sc.__bossKit.state !== move) bad.push(key + " should start " + move + ", the boss is in state " + sc.__bossKit.state);
  }
  return bad;
}]);

for (const B of BOSSES) tests.push([B.label + ": it dodges every 2nd to 4th swing made near it (not the others), and the dodge starts when Combat_Shared flags it", () => {
  const bad = [], { Scene, Obj, Vars, bossScript } = require("./sim"), sc = new Scene(load().scenes.find(s => s.name === B.scene), B.scene);
  const boss = sc.spawn(B.boss, 1000, 657); const player = sc.spawn("Player", 900, 457);
  const fn = new Function("runtimeScene", "gdjs", bossScript(B.sheet)), bv = boss.vars, clear = () => { for (const n of ["JustPostureBroken", "JustRecovered", "JustHitPlayer", "JustDodgedHit", "JustLostLife", "JustDied", "JustDeflected", "JustStaggered", "JustHitByPlayer"]) bv.get(n).setBoolean(false); };
  const frame = () => { sc.time += 1 / 60; clear(); fn(sc, {}); };
  const swing = player.vars.get("AttackPressed"); swing.setBoolean(true); frame(); swing.setBoolean(false); // a first swing: the cat turns hostile (see the hidden ending test)
  for (let i = 0; i < 60 * 12 && !(sc.__bossKit && sc.__bossKit.state === "Neutral"); i++) frame();   // past the intro, standing near the player
  if (!sc.__bossKit || sc.__bossKit.state !== "Neutral") return ["never reached Neutral"];
  let presses = 0, armedAt = 0;
  for (let n = 1; n <= 6 && !armedAt; n++) {
    sc.__bossKit.setState("Neutral"); sc.__bossKit.script = (function* () { while (true) yield; })(); // hold it in a neutral pause
    player.vars.get("AttackPressed").setBoolean(true); sc.time += 3; frame(); player.vars.get("AttackPressed").setBoolean(false); presses++;
    if (bv.get("WillDodgeHit").getAsBoolean()) armedAt = presses;
  }
  if (!armedAt) return ["it never decided to dodge in 6 swings"];
  if (armedAt < 2 || armedAt > 4) bad.push("it dodged on swing " + armedAt + " (expected the 2nd to 4th)");
  bv.get("WillDodgeHit").setBoolean(false); bv.get("JustDodgedHit").setBoolean(true); fn(sc, {});
  if (sc.__bossKit.state !== "Dodge") bad.push("a dodged swing should start the dodge, the boss is in " + sc.__bossKit.state);
  for (let i = 0; i < 90; i++) frame();
  if (bv.get("Invulnerable").getAsBoolean()) bad.push("still invulnerable 1.5 s after the dodge");
  return bad;
}]);

tests.push(["The Cat's hidden ending: it hisses and walks over; if the player never attacks it sits and F kneels him to pet it, the fight ends in peace (BossesBeaten.Cat_Fight and Cat_Friend, back to the hub); any attack turns it hostile for good", () => {
  const bad = [], { Scene, bossScript } = require("./sim"), sc0 = load().scenes.find(s => s.name === "Cat_Fight"), code = bossScript("Cat_Boss");
  const start = (px) => {
    const sc = new Scene(sc0, "Cat_Fight"), boss = sc.spawn("Cat", 1000, 657), player = sc.spawn("Player", px, 457), fn = new Function("runtimeScene", "gdjs", code);
    const env = { replaced: null, keys: new Set() }, gd = { evtTools: { input: { wasKeyJustPressed: (s, k) => env.keys.has(k) }, runtimeScene: { replaceScene: (s, n) => { env.replaced = n; } } } };
    const frame = (...keys) => { sc.time += 1 / 60; for (const n of ["JustPostureBroken", "JustRecovered", "JustHitPlayer", "JustDodgedHit", "JustLostLife", "JustDied", "JustDeflected", "JustStaggered", "JustHitByPlayer"]) boss.vars.get(n).setBoolean(false); env.keys = new Set(keys); fn(sc, gd); env.keys = new Set(); };
    return { sc, boss, player, frame, env, state: () => sc.__bossKit && sc.__bossKit.state };
  };
  // 1. Peaceful: the player stands still.
  let g = start(300);
  for (let i = 0; i < 60 * 14 && g.state() !== "Befriend"; i++) g.frame();
  if (g.state() !== "Befriend") return ["the cat never sat down in front of a player who stood still (state " + g.state() + ")"];
  if (Math.abs(g.boss.x - g.player.x) > 260) bad.push("it sat " + Math.round(Math.abs(g.boss.x - g.player.x)) + " px away");
  if (!g.boss.vars.get("Invulnerable").getAsBoolean()) bad.push("it should be unhurtable while it is friendly");
  g.frame("f"); if (g.state() !== "Petting") bad.push("F should start the petting, the state is " + g.state());
  for (let i = 0; i < 60 * 10 && !g.env.replaced; i++) g.frame();
  if (g.env.replaced !== "HUB_Area") bad.push("the fight should end by going to the hub, replaced with " + g.env.replaced);
  const bb = g.sc.globals.get("BossesBeaten"); if (!bb.getChild("Cat_Fight").getAsBoolean() || !bb.getChild("Cat_Friend").getAsBoolean()) bad.push("BossesBeaten needs Cat_Fight and Cat_Friend");
  if (g.sc.globals.get("JustBeaten").getAsString() !== "Cat_Fight") bad.push("JustBeaten should be Cat_Fight");
  if (!g.player.vars.get("ControlsLocked").getAsBoolean()) bad.push("the player should be locked while he pets it");
  if (!/^Player_Pet/.test(g.player.anim)) bad.push("the player should be kneeling (Player_Pet / Player_PetStroke), is in " + g.player.anim);
  if (g.sc.created.Cat_Hitbox) bad.push("a friendly cat must not make hitboxes");
  if (g.boss.vars.get("Health").getAsNumber() !== g.boss.vars.get("MaxHealth").getAsNumber()) bad.push("the cat was hurt");
  // 2. Hostile: a swing while it walks over.
  g = start(300);
  for (let i = 0; i < 60 * 3; i++) g.frame();
  g.player.vars.get("AttackPressed").setBoolean(true); g.frame(); g.player.vars.get("AttackPressed").setBoolean(false);
  for (let i = 0; i < 60 * 8 && g.state() !== "Neutral"; i++) g.frame();
  if (g.state() !== "Neutral") bad.push("a swing should start the fight, the state is " + g.state());
  if (g.boss.vars.get("Invulnerable").getAsBoolean()) bad.push("the cat should be hurtable once the fight begins");
  for (let i = 0; i < 60 * 5; i++) g.frame("f");
  if (g.state() === "Petting" || g.env.replaced) bad.push("F must not pet a hostile cat");
  // 3. A hit on it (not just a swing) also counts.
  g = start(300); for (let i = 0; i < 60 * 2; i++) g.frame(); g.boss.vars.get("Health").setNumber(100);
  for (let i = 0; i < 60 * 8 && g.state() !== "Neutral"; i++) g.frame();
  if (g.state() !== "Neutral") bad.push("damage should start the fight");
  return bad;
}]);

tests.push(["hub: the befriended Cat sits in the hall (not before), at a different spot each load, on real furniture, and the cat-tree gate's completed art has no painted cat", () => {
  const bad = [], { Obj, Scene } = require("./sim"), hub = load().scenes.find(s => s.name === "HUB_Area"), HUB = require(path.join(ROOT, "tools", "hub", "hub.js"));
  let code = null; walk(hub.events, e => { if (e.type === "BuiltinCommonInstructions::JsCode" && /Hub_Cat/.test(codeOf(e)) && codeOf(e).includes("Generated by tools"+String.fromCharCode(47)+"hub")) code = codeOf(e); });
  if (!code) return ["the hub has no Hub_Cat script (node tools/hub/build.js)"];
  const obj = hub.objects.find(o => o.name === "Hub_Cat"); if (!obj) return ["no Hub_Cat object"];
  for (const s of HUB.cat.spots) { if (!obj.animations.some(a => a.name === s.anim)) bad.push(s.name + " uses the animation " + s.anim + ", which Hub_Cat lacks"); if (s.x < 0 || s.x > 4512 || s.y > 660 || s.y < 300) bad.push(s.name + " is off: " + s.x + ", " + s.y); }
  const fn = new Function("runtimeScene", "gdjs", code), game = {}, seen = []; let last = -1;
  const load1 = friend => {
    const sc = new Scene(hub, "HUB_Area"); sc.getGame = () => game; sc.__hubGates = { progress: { beaten: friend ? { Cat_Friend: true } : {} } };
    const made = []; sc.createObject = n => { const o = new Obj(sc, hub.objects.find(x => x.name === n), 0, 0); o.setZOrder = z => { o.z = z; }; made.push(o); return o; };
    for (let i = 0; i < 3; i++) fn(sc, {});
    return made;
  };
  if (load1(false).length) bad.push("the cat is in the hall before it is a friend");
  for (let n = 0; n < 40; n++) { const made = load1(true); if (made.length !== 1) { bad.push("expected one cat in the hall, got " + made.length); break; } const i = HUB.cat.spots.findIndex(s => s.x === made[0].x && s.y === made[0].y); if (i < 0) { bad.push("the cat is not at one of its spots"); break; } if (i === last) bad.push("the same spot twice in a row"); last = i; seen.push(i); }
  if (new Set(seen).size < HUB.cat.spots.length) bad.push("over 40 loads the cat only used " + new Set(seen).size + " of " + HUB.cat.spots.length + " spots");
  // The cat tree's completed art: no painted tabby (an orange pixel cluster on the perch).
  const png = require("../bosses/png.js"), im = png.decode(path.join(ROOT, "assets/backgrounds/hub/cat_gate/completed_00.png"));
  let orange = 0; for (let y = 0; y < 22; y++) for (let x = 14; x < 50; x++) { const p = (y * im.w + x) * 4; if (im.data[p + 3] && im.data[p] > 200 && im.data[p + 1] > 100 && im.data[p + 1] < 150 && im.data[p + 2] < 70) orange++; }
  if (orange > 4) bad.push("the cat tree's completed art still has a painted cat on the perch");
  return bad;
}]);

tests.push(["hub: the Bladekeeper's and the Cat's gates (inactive, active, completed), in order after the Gunslinger, clear of the furniture, with their scenes and keeper lines", () => {
  const bad = [], hub = load().scenes.find(s => s.name === "HUB_Area"), scenes = new Set(load().scenes.map(s => s.name)), HUB = require(path.join(ROOT, "tools", "hub", "hub.js"));
  const gates = [["The Bladekeeper", "Bladekeeper_Fight", "Hub_Gate_Blades", 5], ["Ferocious Beast", "Cat_Fight", "Hub_Gate_Cat", 6]];
  for (const [label, scene, obj, order] of gates) {
    if (!scenes.has(scene)) { bad.push(scene + " doesn't exist"); continue; }
    const g = HUB.gates.find(x => x.label === label); if (!g) { bad.push(label + " has no gate in hub.js"); continue; }
    if (g.scene !== scene || g.order !== order) bad.push(label + ": scene " + g.scene + ", order " + g.order + " (expected " + scene + ", " + order + ")");
    if (g.state === "locked") bad.push(label + " is locked");
    const o = hub.objects.find(x => x.name === obj); if (!o) { bad.push(obj + " isn't in the hub"); continue; }
    for (const a of ["inactive", "active", "completed"]) if (!o.animations.some(x => x.name === a && x.directions[0].sprites.length)) bad.push(obj + " has no " + a + " animation");
    const act = o.animations.find(x => x.name === "active"); if (act && (act.directions[0].sprites.length !== 12 || !act.directions[0].looping)) bad.push(obj + ": active should loop 12 frames");
    const inst = hub.instances.find(i => i.name === obj); if (!inst) { bad.push("no " + obj + " instance"); continue; }
    const vars = Object.fromEntries(inst.initialVariables.map(v => [v.name, v.value])); if (vars.Scene !== scene || vars.Label !== label) bad.push(obj + " instance has Scene " + vars.Scene + " / Label " + vars.Label);
    // The gate's footprint must not overlap other hub furniture (a gate is 256 wide).
    for (const other of hub.instances.filter(i => /^Hub_(Pew|Dummy|Lectern|Candelabra|Bench|Keeper|Gate_)/.test(i.name) && i !== inst && i.y + i.height > 500)) {
      const l = Math.max(inst.x, other.x), r = Math.min(inst.x + inst.width, other.x + other.width);
      if (r - l > 8) bad.push(obj + " overlaps " + other.name + " at x " + other.x);
    }
    if (inst.x < 0 || inst.x + inst.width > 4512) bad.push(obj + " is outside the hub's walls");
  }
  if (!(HUB.gates.find(x => x.label === "The Gunslinger").order < 5)) bad.push("the new gates should come after the Gunslinger");
  for (const stage of ["bladeBeaten", "catBeaten"]) if (!(HUB.keeper[stage] && HUB.keeper[stage].length)) bad.push("the keeper has no " + stage + " lines");
  if (!JSON.stringify(hub.events).includes("catBeaten")) bad.push("the hub's keeper script doesn't read catBeaten");
  return bad;
}]);

tests.push(["blood: every frame of the Leaf Ranger has a BloodPoint inside its hurtbox (tools/fx/blood_points.js)", () => {
  const bad = [], { scenes } = load();
  for (const [sc, name] of [["Leaf_Ranger_Fight", "Leaf_Ranger"]]) for (const a of scenes.find(s => s.name === sc).objects.find(o => o.name === name).animations) a.directions[0].sprites.forEach((sp, i) => {
    const p = sp.points.find(q => q.name === "BloodPoint"), m = sp.customCollisionMask[0]; if (!p) { bad.push(name + " " + a.name + " frame " + i + " has no BloodPoint"); return; }
    const xs = m.map(v => v.x), ys = m.map(v => v.y); if (p.x < Math.min(...xs) || p.x > Math.max(...xs) || p.y < Math.min(...ys) || p.y > Math.max(...ys)) bad.push(name + " " + a.name + " frame " + i + ": BloodPoint outside the hurtbox");
  });
  return bad.slice(0, 10);
}]);

tests.push(["hub (testing): the Bladekeeper's and the Ferocious Beast's gates start awake (Open 1, whatever the order and progress); no other gate does; the boss shows as Ferocious Beast in the fight UI and the hub", () => {
  const bad = [], hub = load().scenes.find(s => s.name === "HUB_Area"), { sheets } = load(), cs = sheets.find(s => s.name === "Combat_Shared");
  const open = {};
  for (const i of hub.instances) { const v = (i.initialVariables || []).find(x => x.name === "Open"), l = (i.initialVariables || []).find(x => x.name === "Label"); if (v && l) open[l.value] = v.value; }
  for (const l of ["The Bladekeeper", "Ferocious Beast"]) if (open[l] !== "1") bad.push(l + "'s gate must start awake (Open 1), has " + JSON.stringify(open[l]));
  for (const l of Object.keys(open)) if (!["The Bladekeeper", "Ferocious Beast"].includes(l) && open[l]) bad.push(l + "'s gate must not start awake");
  let rule = false; walk(hub.events, e => { if (e.type === "BuiltinCommonInstructions::JsCode" && /get\("Open"\)\.getAsString\(\) === "1"/.test(codeOf(e))) rule = true; });
  if (!rule) bad.push("the hub's gate script must honour the Open variable");
  if (!JSON.stringify(cs.events).includes('Cat_Fight: { obj: \\"Cat\\", name: \\"Ferocious Beast\\" }')) bad.push("the fight UI table must name the Cat fight's boss Ferocious Beast");
  if (JSON.stringify(hub.instances).includes('"The Cat"')) bad.push("the hub still labels a gate The Cat");
  return bad;
}]);

tests.push(["Cat hind kick (swipe B): every kick hitbox is BEHIND the cat; with the player in front it leaps over him first and lands facing away; with him already behind it just kicks; with him in front it never kicks forward", () => {
  const bad = [], { Scene, bossScript } = require("./sim"), sc0 = load().scenes.find(s => s.name === "Cat_Fight"), code = bossScript("Cat_Boss");
  for (const [label, px, bossFacesLeft] of [["player in front", 500, false], ["player behind", 880, true]]) {
    const sc = new Scene(sc0, "Cat_Fight"), boss = sc.spawn("Cat", 1000, 657), player = sc.spawn("Player", px, 457), fn = new Function("runtimeScene", "gdjs", code);
    // The boss starts facing left (toward a player at 500); "player behind" turns it to face right, away from him.
    fn(sc, {}); const kit = sc.__bossKit; kit.force("swipeB");
    if (bossFacesLeft) { kit.face(1); }
    const seen = new Set(); let leapt = false, kicks = 0, touched = false;
    for (let i = 0; i < 60 * 20 && kit.script; i++) {
      sc.time += 1 / 60; for (const n of ["JustPostureBroken", "JustRecovered", "JustHitPlayer", "JustDodgedHit", "JustLostLife", "JustDied", "JustDeflected", "JustStaggered", "JustHitByPlayer"]) boss.vars.get(n).setBoolean(false);
      fn(sc, {}); if (boss.y < 640) leapt = true;
      for (const h of sc.list("EnemyHitbox")) if (!seen.has(h)) { seen.add(h); kicks++; const cx = h.x + h.w / 2, facing = boss.flipped ? -1 : 1; if ((cx - boss.x) * facing >= 0) bad.push(label + ": a kick hitbox was in FRONT of the cat (x " + Math.round(cx) + ", cat " + Math.round(boss.x) + ", facing " + facing + ")"); if (Math.abs(cx - player.x) < 150) touched = true; }
    }
    if (!kicks) bad.push(label + ": no kick at all"); else if (!touched) bad.push(label + ": the kick never reached the player behind it");
    if (label === "player in front" && !leapt) bad.push("with the player in front it should leap over him first");
    if (label === "player behind" && leapt) bad.push("with the player already behind it should not leap");
  }
  return bad;
}]);

tests.push(["Cat strike zones: every zone drawn for a wind-up or a hitbox is removed again (all moves, all phases, and an interrupted move); the tell zones exist before the hitbox does", () => {
  const bad = [], { Scene, bossScript } = require("./sim"), sc0 = load().scenes.find(s => s.name === "Cat_Fight"), code = bossScript("Cat_Boss");
  const saved = global.PIXI; let made = 0, destroyed = 0;
  global.PIXI = { Graphics: function () { this.alpha = 1; this.x = 0; this.y = 0; this.beginFill = () => {}; this.drawRect = () => {}; this.endFill = () => {}; made++; this.destroy = () => { destroyed++; }; } };
  try {
    for (const lives of [3, 2, 1]) for (const m of ["swipeA", "swipeB", "swipeC", "pounce", "zoom", "burrow", "flurry", "maul"]) {
      made = 0; destroyed = 0;
      const sc = new Scene(sc0, "Cat_Fight"), boss = sc.spawn("Cat", 1000, 657); sc.spawn("Player", 500, 457);
      boss.vars.get("Lives").setNumber(lives);
      const fn = new Function("runtimeScene", "gdjs", code); fn(sc, {}); const kit = sc.__bossKit; kit.force(m);
      let firstZone = -1, firstHit = -1;
      for (let i = 0; i < 60 * 20 && kit.script; i++) {
        sc.time += 1 / 60; fn(sc, {});
        if (firstZone < 0 && made > 0) firstZone = i; if (firstHit < 0 && sc.created.Cat_Hitbox) firstHit = i;
      }
      if (!made) bad.push(m + " (" + lives + "): drew no zone at all");
      if (firstZone >= 0 && firstHit >= 0 && firstZone > firstHit) bad.push(m + ": the zone appeared after the hitbox");
      if (m !== "burrow" || true) { kit.interrupt((function* () { yield; })(), "Neutral"); }
      if (made !== destroyed) bad.push(m + " (" + lives + " lives): " + made + " zones made, " + destroyed + " removed");
    }
  } finally { global.PIXI = saved; }
  return bad;
}]);

tests.push(["Cat claw slash: each high claw swipe draws a red Cat_Slash in front of the cat (mirrored when it faces left), at the moment the hitbox appears, and removes it again", () => {
  const bad = [], { Scene, bossScript } = require("./sim"), sc0 = load().scenes.find(s => s.name === "Cat_Fight"), code = bossScript("Cat_Boss");
  for (const [label, px, expectFlip] of [["player on the right", 1200, false], ["player on the left", 100, true]]) {
    const sc = new Scene(sc0, "Cat_Fight"), boss = sc.spawn("Cat", 640, 657); sc.spawn("Player", px, 457);
    const fn = new Function("runtimeScene", "gdjs", code); fn(sc, {}); const kit = sc.__bossKit; kit.force("swipeA");
    let seen = null, hitAt = -1, slashAt = -1;
    for (let i = 0; i < 60 * 8 && kit.script; i++) {
      sc.time += 1 / 60; fn(sc, {});
      if (hitAt < 0 && sc.created.Cat_Hitbox) hitAt = i; if (slashAt < 0 && sc.created.Cat_Slash) { slashAt = i; seen = sc.list("Cat_Slash")[0]; }
      if (seen && !seen.checked) { seen.checked = true; seen.snap = { cx: seen.x + seen.w / 2, flipped: seen.flipped, anim: seen.anim }; }
    }
    if (!sc.created.Cat_Slash) { bad.push(label + ": no Cat_Slash was drawn for a swipe"); continue; }
    if (sc.created.Cat_Slash < 2) bad.push(label + ": a two claw combo should draw two slashes, drew " + sc.created.Cat_Slash);
    if (slashAt !== hitAt) bad.push(label + ": the slash (frame " + slashAt + ") should appear with the hitbox (frame " + hitAt + ")");
    if (seen.snap.flipped !== expectFlip) bad.push(label + ": slash mirrored " + seen.snap.flipped + ", expected " + expectFlip);
    if (seen.snap.anim !== "Horizontal") bad.push(label + ": expected the Horizontal slash, got " + seen.snap.anim);
    const dir = expectFlip ? -1 : 1; if ((seen.snap.cx - boss.x) * dir < 40) bad.push(label + ": the slash is not in front of the cat (centre " + Math.round(seen.snap.cx) + ", cat " + Math.round(boss.x) + ")");
    for (let i = 0; i < 20; i++) { sc.time += 1 / 60; fn(sc, {}); }   // 0.33 s: past the slash's life, before the director starts another move
    if (sc.list("Cat_Slash").length) bad.push(label + ": a slash was left in the scene");
  }
  return bad;
}]);

tests.push(["Cat landing dust: each pounce (two in the last life) puffs a Cat_Dust where it lands, on the floor, and removes it again", () => {
  const bad = [], { Scene, bossScript } = require("./sim"), sc0 = load().scenes.find(s => s.name === "Cat_Fight"), code = bossScript("Cat_Boss");
  for (const [lives, want] of [[3, 1], [1, 2]]) {
    const sc = new Scene(sc0, "Cat_Fight"), boss = sc.spawn("Cat", 1000, 657); sc.spawn("Player", 500, 457); boss.vars.get("Lives").setNumber(lives);
    const fn = new Function("runtimeScene", "gdjs", code); fn(sc, {}); const kit = sc.__bossKit; kit.force("pounce");
    const spots = []; let airborne = false;
    for (let i = 0; i < 60 * 8 && kit.script; i++) {
      sc.time += 1 / 60; fn(sc, {}); if (boss.y < 640) airborne = true;
      for (const d of sc.list("Cat_Dust")) if (!d.seen) { d.seen = true; spots.push({ cx: d.x + d.w / 2, midY: d.y + d.h / 2, cat: boss.x, y: boss.y, wasAirborne: airborne }); }
    }
    if (spots.length !== want) bad.push(lives + " lives: expected " + want + " dust cloud(s), got " + spots.length);
    for (const p of spots) {
      if (Math.abs(p.cx - p.cat) > 2) bad.push("the dust is not centred under the cat (dust " + Math.round(p.cx) + ", cat " + Math.round(p.cat) + ")");
      if (p.y < 655) bad.push("the dust came before the cat landed (cat y " + Math.round(p.y) + ")");
      if (Math.abs(p.midY - 611) > 3) bad.push("the dust should rest on the floor (a 120 px picture centred at y 611, is at " + Math.round(p.midY) + ")");
    }
    for (let i = 0; i < 30; i++) { sc.time += 1 / 60; fn(sc, {}); }
    if (sc.list("Cat_Dust").length) bad.push(lives + " lives: a dust cloud was left in the scene");
  }
  return bad;
}]);

tests.push(["Cat opening: about 1.5 s of breathing room standing still, then a hiss, then it RUNS (not walks) toward the player", () => {
  const bad = [], { Scene, bossScript } = require("./sim"), sc0 = load().scenes.find(s => s.name === "Cat_Fight"), code = bossScript("Cat_Boss");
  const sc = new Scene(sc0, "Cat_Fight"), boss = sc.spawn("Cat", 1000, 657); sc.spawn("Player", 300, 457);
  const fn = new Function("runtimeScene", "gdjs", code); let hissAt = -1, moveAt = -1, x0 = boss.x;
  for (let i = 0; i < 60 * 3; i++) {
    sc.time += 1 / 60; fn(sc, {});
    if (hissAt < 0 && sc.sounds.some(s => /hiss/.test(s))) hissAt = i / 60;
    if (moveAt < 0 && Math.abs(boss.x - x0) > 1) moveAt = i / 60;
  }
  if (!(hissAt >= 1.4 && hissAt <= 2.2)) bad.push("the hiss should come after about 1.5 s of breathing room, it came at " + hissAt);
  if (!(moveAt >= 1.4)) bad.push("the cat moved at " + moveAt + " s, before its breathing room was over");
  // Speed once it runs: more than 400 px/s over half a second.
  const sc2 = new Scene(sc0, "Cat_Fight"), boss2 = sc2.spawn("Cat", 1000, 657); sc2.spawn("Player", 300, 457);
  const fn2 = new Function("runtimeScene", "gdjs", code); let xs = [];
  for (let i = 0; i < 60 * 4; i++) { sc2.time += 1 / 60; fn2(sc2, {}); xs.push(boss2.x); }
  let best = 0; for (let i = 0; i + 30 < xs.length; i++) best = Math.max(best, Math.abs(xs[i] - xs[i + 30]) * 2);
  if (best < 400) bad.push("it should run over (more than 400 px/s), top speed was " + Math.round(best) + " px/s");
  return bad;
}]);

tests.push(["Bladekeeper guard (the armor): only in answer to hits that connect, 10% after the 1st, 25% after the 2nd, 55% after the 3rd, then more; never part of the rotation", () => {
  const bad = [], { Scene, bossScript } = require("./sim"), sc0 = load().scenes.find(s => s.name === "Bladekeeper_Fight"), code = bossScript("Bladekeeper_Boss");
  const realRandom = Math.random;
  try {
    // Never without a hit: a long fight against a player who never swings.
    { const sc = new Scene(sc0, "Bladekeeper_Fight"), boss = sc.spawn("Bladekeeper", 1000, 657); sc.spawn("Player", 700, 457); const fn = new Function("runtimeScene", "gdjs", code); let guarded = false;
      for (let i = 0; i < 60 * 150; i++) { sc.time += 1 / 60; fn(sc, {}); if (sc.__bossKit.state === "Guard") guarded = true; if (!sc.list("Player").length) break; }
      if (guarded) bad.push("she raised the guard without being hit"); }
    // The ladder: with Math.random fixed, which hit makes her guard?
    const firstGuard = r => {
      const sc = new Scene(sc0, "Bladekeeper_Fight"), boss = sc.spawn("Bladekeeper", 1000, 657); sc.spawn("Player", 800, 457); const fn = new Function("runtimeScene", "gdjs", code);
      sc.time += 1 / 60; fn(sc, {}); const kit = sc.__bossKit; Math.random = () => r;
      for (let hit = 1; hit <= 6; hit++) {
        kit.setState("Neutral"); kit.script = (function* () { while (true) yield; })();
        for (const n of ["JustPostureBroken", "JustRecovered", "JustHitPlayer", "JustDodgedHit", "JustLostLife", "JustDied", "JustDeflected", "JustStaggered"]) boss.vars.get(n).setBoolean(false);
        boss.vars.get("JustHitByPlayer").setBoolean(true); sc.time += 0.5; fn(sc, {});
        if (kit.state === "Guard") return hit;
      }
      return 0;
    };
    const want = [[0.05, 1], [0.2, 2], [0.5, 3], [0.8, 4], [0.95, 0]];
    for (const [r, hit] of want) { const got = firstGuard(r); if (got !== hit) bad.push("with a roll of " + r + " she should guard on hit " + (hit || "none") + ", it was " + got); }
  } finally { Math.random = realRandom; }
  return bad;
}]);

tests.push(["Petting: the cat lies down (rest_in) BEFORE the arm comes out (Player_PetStroke), the cat is drawn in front of the knight, and he stops close (96 px) so the hand ends behind its body", () => {
  const bad = [], { Scene, bossScript } = require("./sim"), sc0 = load().scenes.find(s => s.name === "Cat_Fight"), code = bossScript("Cat_Boss");
  const sc = new Scene(sc0, "Cat_Fight"), boss = sc.spawn("Cat", 1000, 657), player = sc.spawn("Player", 300, 457), fn = new Function("runtimeScene", "gdjs", code);
  let keys = new Set(); const gd = { evtTools: { input: { wasKeyJustPressed: (s, k) => keys.has(k) }, runtimeScene: { replaceScene() {} } } };
  const frame = (...k) => { sc.time += 1 / 60; for (const n of ["JustPostureBroken", "JustRecovered", "JustHitPlayer", "JustDodgedHit", "JustLostLife", "JustDied", "JustDeflected", "JustStaggered", "JustHitByPlayer"]) boss.vars.get(n).setBoolean(false); keys = new Set(k); fn(sc, gd); };
  for (let i = 0; i < 60 * 14 && !(sc.__bossKit && sc.__bossKit.state === "Befriend"); i++) frame();
  if (!sc.__bossKit || sc.__bossKit.state !== "Befriend") return ["the cat never sat down"];
  player.getAnimationName = () => player.anim; player.setAnimationName = n => { player.anim = n; }; frame("f");
  let lay = -1, stroke = -1, minGap = 1e9, lastBossAnim = "";
  for (let i = 0; i < 60 * 12; i++) {
    frame(); if (boss.anim === "rest_in" && lay < 0) lay = i; if (player.anim === "Player_PetStroke" && stroke < 0) stroke = i;
    if (stroke < 0) minGap = Math.min(minGap, Math.abs(player.x - boss.x));
    if (stroke >= 0 && i === stroke) lastBossAnim = boss.anim;
  }
  if (lay < 0) bad.push("the cat never lay down (rest_in)");
  if (stroke < 0) bad.push("the arm never came out (Player_PetStroke)");
  if (lay >= 0 && stroke >= 0 && !(lay < stroke)) bad.push("the arm came out (frame " + stroke + ") before the cat lay down (frame " + lay + ")");
  if (!(minGap <= 100)) bad.push("the knight should stop within 96 px of the cat, he stopped " + Math.round(minGap) + " px away");
  if (!(boss.getZOrder() > player.getZOrder())) bad.push("the cat must be drawn in front of the knight while he pets it (cat z " + boss.getZOrder() + ", knight z " + player.getZOrder() + ")");
  return bad;
}]);

for (const B of BOSSES) tests.push([B.label + ": when the player is dead (the object stays while the death plays) it stands down: Idle state, no hitboxes, no new attacks", () => {
  const bad = [], { Scene, bossScript } = require("./sim"), sc0 = load().scenes.find(s => s.name === B.scene), code = bossScript(B.sheet);
  for (const move of B.attacks.slice(0, 4)) {
    const sc = new Scene(sc0, B.scene), boss = sc.spawn(B.boss, 1000, 657), player = sc.spawn("Player", 800, 457), fn = new Function("runtimeScene", "gdjs", code);
    fn(sc, {}); const kit = sc.__bossKit; kit.force(move);
    for (let i = 0; i < 25; i++) { sc.time += 1 / 60; fn(sc, {}); }
    player.vars.get("IsDead").setBoolean(true);
    const hitboxesBefore = (sc.created[B.boss + "_Hitbox"] || 0);
    for (let i = 0; i < 60 * 8; i++) { sc.time += 1 / 60; fn(sc, {}); }
    if (kit.state !== "Idle") bad.push(move + ": still in state " + kit.state + " 8 s after the player died");
    if (sc.list("EnemyHitbox").length) bad.push(move + ": " + sc.list("EnemyHitbox").length + " hitboxes still alive after the player died");
    if ((sc.created[B.boss + "_Hitbox"] || 0) > hitboxesBefore + 1) bad.push(move + ": it kept attacking a dead player (" + ((sc.created[B.boss + "_Hitbox"] || 0) - hitboxesBefore) + " new hitboxes)");
  }
  return bad;
}]);

module.exports = tests;
