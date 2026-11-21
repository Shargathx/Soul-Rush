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
    if (!/^(Numpad[0-9]|NumpadAdd|NumpadSubtract)$/.test(key)) bad.push(key + " is not a number pad key (the DEBUG_KEYS gate in Combat_Shared only switches off the number pad, F2 to F10 and the like)");
    if (move !== "loseLife" && move !== "toggleIdle" && !B.moves.includes(move)) bad.push(key + " starts " + move + ", which is not a move");
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
    if (move === "toggleIdle") { if (!sc.__bossKit.debugIdle) bad.push(key + " should turn force idle on"); }   // (covered in detail by the force idle test)
    else if (move === "loseLife") { if (boss.vars.get("Health").getAsNumber() !== 0) bad.push(key + " didn't take the boss's HP to 0"); }
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
  for (let i = 0; i < 60 * 2.5; i++) g.frame("f"); if (g.state() === "Petting") bad.push("F worked before the prompt (it shows 3 s after the cat sits down)");
  for (let i = 0; i < 60 * 0.8; i++) g.frame();
  g.frame("f"); if (g.state() !== "Petting") bad.push("F should start the petting once the prompt shows (3 s after it sat), the state is " + g.state());
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
      if (seen && !seen.checked) { seen.checked = true; seen.snap = { cx: seen.x, cy: seen.y, flipped: seen.flipped, anim: seen.anim, cat: boss.x }; }
    }
    if (!sc.created.Cat_Slash) { bad.push(label + ": no Cat_Slash was drawn for a swipe"); continue; }
    if (sc.created.Cat_Slash < 2) bad.push(label + ": a two claw combo should draw two slashes, drew " + sc.created.Cat_Slash);
    if (slashAt !== hitAt) bad.push(label + ": the slash (frame " + slashAt + ") should appear with the hitbox (frame " + hitAt + ")");
    if (seen.snap.flipped !== expectFlip) bad.push(label + ": slash mirrored " + seen.snap.flipped + ", expected " + expectFlip);
    if (seen.snap.anim !== "Horizontal") bad.push(label + ": expected the Horizontal slash, got " + seen.snap.anim);
    const dir = expectFlip ? -1 : 1; if (Math.abs((seen.snap.cx - seen.snap.cat) * dir - 94.5) > 3) bad.push(label + ": the slash should be centred on the cat's front point (94.5 px in front), centre " + Math.round(seen.snap.cx) + ", cat " + Math.round(seen.snap.cat) + ")");
    if (Math.abs(seen.snap.cy - (657 - 35 - 25)) > 3) bad.push(label + ": the slash should sit 25 px above the front point (y " + (657 - 35 - 25) + "), is at " + Math.round(seen.snap.cy));
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
      for (const d of sc.list("Cat_Dust")) if (!d.seen) { d.seen = true; spots.push({ cx: d.x, midY: d.y, cat: boss.x, y: boss.y, wasAirborne: airborne }); }
    }
    if (spots.length !== want) bad.push(lives + " lives: expected " + want + " dust cloud(s), got " + spots.length);
    for (const p of spots) {
      if (Math.abs(p.cx - p.cat) > 2) bad.push("the dust is not centred under the cat (dust " + Math.round(p.cx) + ", cat " + Math.round(p.cat) + ")");
      if (p.y < 655) bad.push("the dust came before the cat landed (cat y " + Math.round(p.y) + ")");
      if (Math.abs(p.midY - 657) > 3) bad.push("the dust belongs at the cat's origin on the floor (y 657), is at " + Math.round(p.midY));
    }
    for (let i = 0; i < 30; i++) { sc.time += 1 / 60; fn(sc, {}); }
    if (sc.list("Cat_Dust").length) bad.push(lives + " lives: a dust cloud was left in the scene");
  }
  return bad;
}]);

tests.push(["Cat force idle (NumpadSubtract): it cancels the move it is in and makes none of its own; a move key starts that one move, after which it idles again; toggling off brings the director back", () => {
  const bad = [], { Scene, bossScript } = require("./sim"), sc0 = load().scenes.find(s => s.name === "Cat_Fight"), code = bossScript("Cat_Boss");
  const sc = new Scene(sc0, "Cat_Fight"), boss = sc.spawn("Cat", 1000, 657); sc.spawn("Player", 500, 457);
  const fn = new Function("runtimeScene", "gdjs", code); let keys = new Set();
  const gd = { evtTools: { input: { wasKeyJustPressed: (s, k) => keys.has(k) } } };
  const frame = (...k) => { sc.time += 1 / 60; keys = new Set(k); fn(sc, gd); keys = new Set(); };
  const kit = () => sc.__bossKit, moved = () => Object.keys(sc.created).filter(n => n === "Cat_Hitbox").length ? sc.created.Cat_Hitbox : 0;
  frame(); kit().force("swipeA");                                       // out of the opening, as the debug keys do
  for (let i = 0; i < 60 * 8 && kit().script; i++) frame();
  for (let i = 0; i < 40; i++) frame();                                 // the director has taken over
  frame("NumpadSubtract");
  if (!kit().debugIdle) bad.push("NumpadSubtract should turn force idle on");
  if (kit().state !== "DebugIdle") bad.push("the state should be DebugIdle right after the toggle, is " + kit().state);
  const hb = moved(); for (let i = 0; i < 60 * 12; i++) frame();
  if (moved() !== hb) bad.push("it made a move by itself while force idle was on");
  if (kit().state !== "DebugIdle") bad.push("it should stay in DebugIdle, is " + kit().state);
  // One move on request, then idle again.
  frame("Numpad4");
  let ran = false; for (let i = 0; i < 60 * 8 && !(ran && kit().state === "DebugIdle"); i++) { frame(); if (kit().state === "Pounce" || kit().state === "pounce") ran = true; }
  if (!ran) bad.push("Numpad4 should have started the pounce");
  if (kit().state !== "DebugIdle") bad.push("after the one move it should be idle again, is " + kit().state);
  const hb2 = moved(); for (let i = 0; i < 60 * 8; i++) frame(); if (moved() !== hb2) bad.push("it made another move after the forced one");
  // Toggling off brings the moves back.
  frame("NumpadSubtract"); if (kit().debugIdle) bad.push("a second press should turn it off");
  const hb3 = moved(); for (let i = 0; i < 60 * 12; i++) frame(); if (moved() === hb3 && !Object.keys(sc.created).some(n => n === "Cat_Dust" || n === "Cat_Slash")) bad.push("after turning force idle off it never moved again");
  return bad;
}]);

// Helper for the Cat tests below: a running fight with the player standing still.
function catRun(move, px, lives) {
  const { Scene, bossScript } = require("./sim"), sc0 = load().scenes.find(s => s.name === "Cat_Fight"), code = bossScript("Cat_Boss");
  const sc = new Scene(sc0, "Cat_Fight"), boss = sc.spawn("Cat", 1000, 657), player = sc.spawn("Player", px === undefined ? 500 : px, 457); if (lives) boss.vars.get("Lives").setNumber(lives);
  const fn = new Function("runtimeScene", "gdjs", code); fn(sc, {}); const kit = sc.__bossKit; kit.force(move);
  return { sc, boss, player, kit, frame() { sc.time += 1 / 60; fn(sc, {}); } };
}

tests.push(["Cat pounce: nothing hurts at the push-off or in the air; the hit and the dust come with the landing", () => {
  const bad = [], r = catRun("pounce", 500); let airborne = false, landed = -1, hitAt = -1, dustAt = -1, hitsInAir = 0;
  for (let i = 0; i < 60 * 6 && r.kit.script; i++) {
    r.frame();
    if (r.boss.y < 650) airborne = true;
    if (airborne && landed < 0 && r.boss.y >= 656) landed = i;
    if (hitAt < 0 && r.sc.created.Cat_Hitbox) { hitAt = i; if (landed < 0) hitsInAir++; }
    if (dustAt < 0 && r.sc.created.Cat_Dust) dustAt = i;
  }
  if (!airborne) bad.push("the cat never left the ground");
  if (hitsInAir) bad.push("a hitbox existed before the cat landed (the push-off or the flight hurt)");
  if (hitAt < 0) bad.push("the landing made no hitbox");
  else if (hitAt - landed > 2) bad.push("the landing hit came " + (hitAt - landed) + " frames after touchdown");
  if (dustAt !== hitAt) bad.push("the dust (frame " + dustAt + ") should come with the landing hit (frame " + hitAt + ")");
  return bad;
}]);

tests.push(["Cat hind kick: it leaps over the player and lands close enough that a player who stands still is inside the kick (so he must roll or deflect); the slash is drawn behind the cat", () => {
  const bad = [], r = catRun("swipeB", 500); let touched = false, seen = new Set(), backSlash = null;
  for (let i = 0; i < 60 * 8 && r.kit.script; i++) {
    r.frame();
    for (const h of r.sc.list("EnemyHitbox")) if (!seen.has(h)) { seen.add(h); if (h.x <= r.player.x && r.player.x <= h.x + h.w) touched = true; }
    if (!backSlash && r.sc.list("Cat_Slash").length) backSlash = { flipped: r.sc.list("Cat_Slash")[0].flipped, cat: r.boss.flipped };
  }
  if (!touched) bad.push("a player standing still was never inside the kick: the leap carried too far");
  if (!backSlash) bad.push("the kick drew no slash");
  else if (backSlash.flipped === backSlash.cat) bad.push("the kick's slash should point backwards (mirrored against the cat's facing)");
  return bad;
}]);

tests.push(["Cat tells: an eye glint starts a move (yellow for the combo, kick, pounce and charge; RED for the flurry and the maul), once per move and never on follow-up swings; no body flash", () => {
  const bad = [];
  for (const [move, color, lives] of [["swipeA", "Yellow", 3], ["swipeC", "Yellow", 3], ["swipeB", "Yellow", 3], ["pounce", "Yellow", 3], ["zoom", "Yellow", 3], ["flurry", "Red", 2], ["maul", "Red", 1]]) {
    const r = catRun(move, 500, lives), glints = [];
    for (let i = 0; i < 60 * 12 && r.kit.script; i++) { r.frame(); for (const g of r.sc.list("Cat_Glint")) if (!g.noted) { g.noted = true; glints.push({ anim: g.anim, x: g.x, y: g.y, cat: r.boss.x, pose: r.boss.anim, frame: r.boss.frame }); } }
    if (glints.length !== 1) bad.push(move + ": expected exactly one glint, got " + glints.length);
    else {
      if (glints[0].anim !== color) bad.push(move + ": the glint should be " + color + ", is " + glints[0].anim);
      if (move === "flurry" && !(glints[0].pose === "rear" && glints[0].frame >= 5)) bad.push("flurry: the glint comes AFTER he stands up (rear frame 5 or later), was in " + glints[0].pose + " " + glints[0].frame);
      if (move === "maul" && !(glints[0].pose === "rear" && glints[0].frame >= 7)) bad.push("maul: the glint comes AFTER he stands up (rear frame 7), was in " + glints[0].pose + " " + glints[0].frame);
      if (Math.abs(glints[0].x - glints[0].cat) > 120 || glints[0].y > 657 || glints[0].y < 657 - 230) bad.push(move + ": the glint is not at the cat's head (" + Math.round(glints[0].x - glints[0].cat) + " px sideways, y " + Math.round(glints[0].y) + ")");
    }
    if ((r.boss.colorLog || []).some(c => c !== "255;255;255")) bad.push(move + ": the body flashed a colour (" + r.boss.colorLog.join(" ") + "); the tell is the eye glint now");
  }
  return bad;
}]);

tests.push(["Cat combos: the cat stays where it is between the claws of a combo (no step forward)", () => {
  const bad = [];
  for (const move of ["swipeA", "swipeC"]) {
    const r = catRun(move, 500); let arrived = -1, x0 = null, moved = 0;
    for (let i = 0; i < 60 * 10 && r.kit.script; i++) {
      r.frame();
      if (arrived < 0 && r.sc.created.Cat_Hitbox) { arrived = i; x0 = r.boss.x; }   // the first claw is out: the chase is over
      else if (arrived >= 0) moved = Math.max(moved, Math.abs(r.boss.x - x0));
    }
    if (arrived < 0) bad.push(move + ": no hit at all");
    else if (moved > 1) bad.push(move + ": the cat moved " + Math.round(moved) + " px during the combo after its first claw");
  }
  return bad;
}]);

tests.push(["Cat charge (zoomies): the direction is locked when the bow starts; dodging behind him during the bow or the run does not turn him", () => {
  const bad = [];
  for (const lives of [3, 1]) {
    const r = catRun("zoom", 300, lives), dir0 = r.boss.x > 300 ? -1 : 1; let x = r.boss.x, moves = [], swapped = false;
    for (let i = 0; i < 60 * 14 && r.kit.script; i++) {
      r.frame();
      if (i === 5) { r.player.x = r.boss.x + 400; swapped = true; }                  // he rolls behind the cat during the bow
      if (i > 5 && Math.abs(r.player.x - r.boss.x) < 700 && i % 40 === 0) r.player.x = r.boss.x > 640 ? 100 : 1180;   // and keeps switching sides
      const dx = r.boss.x - x; if (Math.abs(dx) > 5) moves.push(Math.sign(dx)); x = r.boss.x;
    }
    if (!swapped) bad.push("test setup");
    if (!moves.length) { bad.push(lives + " lives: it never charged"); continue; }
    if (moves[0] !== dir0) bad.push(lives + " lives: it charged " + (moves[0] > 0 ? "right" : "left") + " but was facing " + (dir0 > 0 ? "right" : "left") + " when the bow started");
    let flips = 0; for (let i = 1; i < moves.length; i++) if (moves[i] !== moves[i - 1]) flips++;
    if (flips > (lives === 1 ? 1 : 0)) bad.push(lives + " lives: it changed direction " + flips + " times during the run (only the second pass of the last life may come back)");
  }
  return bad;
}]);

tests.push(["Cat flurry (Numpad7) reaches the player: each of its three claw rounds covers a player who stands still, wherever he stood when it began", () => {
  const bad = [];
  for (const px of [150, 300, 560, 900, 1150]) {
    const r = catRun("flurry", px, 2), boxes = [], seen = new Set();
    for (let i = 0; i < 60 * 12 && r.kit.script; i++) { r.frame(); for (const h of r.sc.list("Cat_Hitbox")) if (!seen.has(h)) { seen.add(h); boxes.push({ l: h.x, r: h.x + h.w, y0: h.y, y1: h.y + h.h }); } }
    if (boxes.length !== 3) { bad.push("player at " + px + ": expected 3 claw rounds, got " + boxes.length); continue; }
    boxes.forEach((b, n) => { if (!(b.l <= r.player.x && r.player.x <= b.r)) bad.push("player at " + px + ": round " + (n + 1) + " covered x " + Math.round(b.l) + " to " + Math.round(b.r) + ", he stood at " + r.player.x + " (cat at " + Math.round(r.boss.x) + ")"); });
  }
  return bad;
}]);

tests.push(["Cat deflect facing: the pounce landing and the burrow eruption can be deflected from any side (Directional 0); the claws keep the facing rule", () => {
  const bad = [];
  for (const [move, lives, expect] of [["pounce", 3, 0], ["burrow", 2, 0], ["swipeA", 3, 1]]) {
    const r = catRun(move, 500, lives); let got = null;
    for (let i = 0; i < 60 * 8 && r.kit.script; i++) { r.frame(); for (const h of r.sc.list("Cat_Hitbox")) if (got === null) got = h.vars.get("Directional").getAsNumber(); }
    if (got === null) bad.push(move + ": made no hitbox");
    else if (got !== expect) bad.push(move + ": the hitbox has Directional " + got + ", expected " + expect);
  }
  return bad;
}]);

tests.push(["Cat pounce landing: a wide, tall hitbox (about 260 x 130) with a bigger dust cloud", () => {
  const bad = [], r = catRun("pounce", 500); let box = null, dust = null;
  for (let i = 0; i < 60 * 6 && r.kit.script; i++) { r.frame(); for (const h of r.sc.list("Cat_Hitbox")) if (!box) box = { w: h.w, h: h.h }; for (const d of r.sc.list("Cat_Dust")) if (!dust) dust = d.scale; }
  if (!box) return ["no landing hitbox"];
  if (box.w < 250 || box.h < 125) bad.push("the landing hitbox should be about 260 x 130, is " + Math.round(box.w) + " x " + Math.round(box.h));
  if (!(dust > 1.2)) bad.push("the landing dust should be scaled up (1.3), is " + dust);
  return bad;
}]);

tests.push(["Cat slashes: the spin and the flurry draw them on both sides (front and back points), the maul draws one big one", () => {
  const bad = [];
  let r = catRun("swipeC", 500); for (let i = 0; i < 60 * 12 && r.kit.script; i++) r.frame();
  const spin = r.sc.list("Cat_Slash").length; if ((r.sc.created.Cat_Slash || 0) < 4) bad.push("swipe C: the crossed claws and then the spin should draw 4 slashes (1 + 1 + front and back of the spin), drew " + (r.sc.created.Cat_Slash || 0)); void spin;
  r = catRun("flurry", 500, 2); for (let i = 0; i < 60 * 12 && r.kit.script; i++) r.frame();
  if ((r.sc.created.Cat_Slash || 0) !== 6) bad.push("flurry: 3 rounds on both sides is 6 slashes, drew " + (r.sc.created.Cat_Slash || 0));
  r = catRun("maul", 500, 1); let big = 0; for (let i = 0; i < 60 * 12 && r.kit.script; i++) { r.frame(); for (const sl of r.sc.list("Cat_Slash")) if (sl.scale > 1.5) big = sl.scale; }
  if ((r.sc.created.Cat_Slash || 0) !== 1) bad.push("maul: one big slash, drew " + (r.sc.created.Cat_Slash || 0));
  if (!big) bad.push("maul: the slash should be scaled up (about 1.9)");
  return bad;
}]);

tests.push(["Cat burrow: the mound always reaches a player who stands still (near or far, up to the arena edge the cat can reach), he comes up exactly there, puffs dust and settles instead of freezing", () => {
  const bad = [];
  for (const px of [150, 520, 1150, 1170, 110]) {
    const r = catRun("burrow", px, 2); let anims = new Set(), after = false;
    for (let i = 0; i < 60 * 8 && r.kit.script; i++) { r.frame(); if (r.sc.created.Cat_Dust) { after = true; } if (after) anims.add(r.boss.anim); }
    if (Math.abs(r.boss.x - px) > 8) bad.push("player at " + px + ": it came up at " + Math.round(r.boss.x) + " (" + Math.round(Math.abs(r.boss.x - px)) + " px away)");
    if (!r.sc.created.Cat_Dust) bad.push("player at " + px + ": no dust when it landed");
    if (!anims.has("stop") && !anims.has("idle")) bad.push("player at " + px + ": after landing it never settled (stuck in " + [...anims].join(",") + ")");
  }
  return bad;
}]);

// ---- Generators keep IDs: a rebuild must not change the persistentUuid of anything that did not change (so git shows real changes only) ----
tests.push(["Generators keep the IDs of unchanged nodes (tools/bosses/lib.js keepIds): same content keeps its ID, changed content gets a new one", () => {
  const { keepIds } = require("../bosses/lib.js"), bad = [];
  const mk = (a, b) => ({ objects: [{ name: "A", persistentUuid: a, variables: [{ name: "v", persistentUuid: "v-" + a, value: 1 }] }, { name: "B", persistentUuid: b, variables: [] }] });
  const before = mk("old-a", "old-b"), now = mk("new-a", "new-b");
  now.objects[1].name = "B2";                                   // B changed, A did not
  keepIds(before, now);
  if (now.objects[0].persistentUuid !== "old-a" || now.objects[0].variables[0].persistentUuid !== "v-old-a") bad.push("an unchanged object and its variable should keep their IDs");
  if (now.objects[1].persistentUuid !== "new-b") bad.push("a changed object should keep its new ID");
  return bad;
}]);

// ---- Mercy (tools/mercy/mercy.js, the "Mercy:" script in Combat_Shared): hold E at a kneeling boss's last stun ----
function mercyRun(sceneName, bossName, kitSheet, setup) {
  const { Scene, bossScript } = require("./sim"), data = load(), sc0 = data.scenes.find(s => s.name === sceneName);
  const sheet = data.sheets.find(s => s.name === "Combat_Shared"); let mercyCode = null;
  (function walk(l) { for (const e of l) { if (e.type === "BuiltinCommonInstructions::JsCode" && /^\/\/ Mercy:/.test(codeOf(e))) mercyCode = codeOf(e); if (e.events) walk(e.events); } })(sheet.events);
  if (!mercyCode) throw new Error("no Mercy script in Combat_Shared");
  const sc = new Scene(sc0, sceneName), boss = sc.spawn(bossName, 1000, 657), player = sc.spawn("Player", 900, 657);
  const bv = boss.vars; setup(bv, player);
  const texts = [], hist = []; let held = false, cb = null;
  const saved = global.PIXI;
  global.PIXI = {
    Container: function () { this.addChild = () => {}; this.destroy = () => {}; this.x = 0; this.y = 0; },
    Graphics: function () { for (const m of ["clear", "beginFill", "endFill", "drawRoundedRect", "drawCircle", "lineStyle", "arc"]) this[m] = () => this; },
    Text: function (t) { let v = t; Object.defineProperty(this, "text", { get: () => v, set: x => { v = x; hist.push(x); } }); this.anchor = { set() {} }; texts.push(this); }
  };
  const gd = { registerRuntimeScenePostEventsCallback: f => { cb = f; }, evtTools: { input: { isKeyPressed: (s, k) => held && k === "e", wasKeyJustPressed: () => false } } };
  const kitFn = kitSheet ? new Function("runtimeScene", "gdjs", bossScript(kitSheet)) : null, ev = new Function("runtimeScene", "gdjs", mercyCode);
  if (kitFn) kitFn(sc, gd);
  const flagsOff = ["JustPostureBroken", "JustRecovered", "JustHitPlayer", "JustDodgedHit", "JustLostLife", "JustDied", "JustDeflected", "JustStaggered", "JustHitByPlayer"];
  return {
    sc, boss, player, bv, texts, hist, restore: () => { global.PIXI = saved; },
    frame(e) { held = !!e; sc.time += 1 / 60; for (const n of flagsOff) if (bv.has(n)) bv.get(n).setBoolean(false); if (kitFn) kitFn(sc, gd); ev(sc, gd); if (cb) cb(sc); },
    spared: () => sc.globals.getChild("BossesBeaten").getChild(sceneName + "_Spared").v === true
  };
}
const kneelLast = (bv, player) => { bv.get("Lives").setNumber(1); bv.get("IsPostureBroken").setBoolean(true); };

for (const [label, scene, boss, kit] of [["Bladekeeper", "Bladekeeper_Fight", "Bladekeeper", "Bladekeeper_Boss"], ["Samurai", "Samurai_Fight", "Samurai_NPC", null], ["Gunslinger", "Gunslinger", "Gunslinger_NPC", null]]) {
  tests.push(["Mercy (" + label + "): holding E for a second at the last kneel, in range, spares the boss; it is not hurt and leaves, which ends the fight; E does nothing on an earlier life, out of range, or when only tapped", () => {
    const bad = [];
    // Not allowed: an earlier life, out of range, not kneeling, a tap.
    for (const [why, setup] of [["on an earlier life", (bv, p) => { bv.get("Lives").setNumber(2); bv.get("IsPostureBroken").setBoolean(true); }],
      ["out of range", (bv, p) => { kneelLast(bv, p); p.x = 300; }], ["not kneeling", (bv, p) => { bv.get("Lives").setNumber(1); }]]) {
      const r = mercyRun(scene, boss, kit, setup);
      try { for (let i = 0; i < 60 * 3; i++) r.frame(true); if (r.spared()) bad.push("E spared the boss " + why); } finally { r.restore(); }
    }
    let r = mercyRun(scene, boss, kit, kneelLast);
    try {
      for (let i = 0; i < 40; i++) r.frame(true); r.frame(false);               // a tap of 0.7 s, then let go
      for (let i = 0; i < 90; i++) r.frame(false);
      if (r.spared()) bad.push("a tap of E spared the boss");
    } finally { r.restore(); }
    r = mercyRun(scene, boss, kit, kneelLast);
    try {
      const hp0 = r.bv.get("Health").getAsNumber();
      for (let i = 0; i < 50; i++) r.frame(true);
      if (r.spared()) bad.push("0.8 s of E is not enough");
      for (let i = 0; i < 20; i++) r.frame(true);
      if (!r.spared()) bad.push("E held for over a second did not spare the boss");
      if (!r.player.vars.get("ControlsLocked").getAsBoolean()) bad.push("the player should be locked during the farewell");
      for (let i = 0; i < 60 * 2; i++) r.frame(false);                          // the camera closes in on the two of them
      const lay = r.sc.getLayer(""); if (lay.zoom < 1.4) bad.push("the camera should zoom in for the farewell (zoom " + lay.zoom.toFixed(2) + ")");
      const mid = (r.boss.x + r.player.x) / 2; if (Math.abs(lay.cx - mid) > 150) bad.push("the camera should centre between the player and the boss");
      let gone = -1; for (let i = 0; i < 60 * 40 && gone < 0; i++) { r.frame(false); if (r.boss.deleted) gone = i; }
      if (gone < 0) bad.push("the boss never left (the fight cannot end)");
      if (r.bv.get("Health").getAsNumber() < hp0) bad.push("the boss lost health in the farewell");
      r.sc.list("Cat_Hitbox");
    } finally { r.restore(); }
    return bad;
  }]);
}

tests.push(["Mercy (Samurai): he kneels, stands (the get-up frames), bows with his Bow animation and dissolves in his Hidden_Ending petals, in that order", () => {
  const bad = [], r = mercyRun("Samurai_Fight", "Samurai_NPC", null, kneelLast); const order = [];
  try {
    for (let i = 0; i < 70; i++) r.frame(true);
    for (let i = 0; i < 60 * 40 && !r.boss.deleted; i++) { r.frame(false); if (order[order.length - 1] !== r.boss.anim) order.push(r.boss.anim); }
    const want = ["Samurai_Posture_Broken", "Samurai_Bow", "Samurai_Hidden_Ending"], got = order.filter(a => want.includes(a));
    if (JSON.stringify(got) !== JSON.stringify(want)) bad.push("the farewell animations came as " + got.join(" > ") + ", expected " + want.join(" > "));
    if (!r.boss.deleted) bad.push("the Samurai was not removed after the petals");
  } finally { r.restore(); }
  return bad;
}]);

tests.push(["Mercy (Gunslinger): the exchange is in binary: the player says friend? (7 bytes), he answers ..., then friend!; his AI is paused and he fades out", () => {
  const bad = [], r = mercyRun("Gunslinger", "Gunslinger_NPC", null, kneelLast);
  try {
    for (let i = 0; i < 70; i++) r.frame(true);
    if (!r.bv.get("AIPaused").getAsBoolean()) bad.push("his AI should be paused during the exchange");
    for (let i = 0; i < 60 * 40 && !r.boss.deleted; i++) r.frame(false);
    const said = r.hist.join("|");
    if (!said.includes("01100110 01110010 01101001 01100101\n01101110 01100100 00111111")) bad.push("the player's friend? in binary never appeared whole (01100110 01110010 01101001 01100101 / 01101110 01100100 00111111)");
    if (!said.includes("01100110 01110010 01101001 01100101\n01101110 01100100 00100001")) bad.push("the Gunslinger's friend! in binary never appeared whole");
    if (!said.includes("...")) bad.push("the Gunslinger's ... never appeared");
    if (said.indexOf("00111111") > said.indexOf("...") || said.indexOf("...") > said.indexOf("00100001")) bad.push("the order should be friend? then ... then friend!");
    if (!r.boss.deleted) bad.push("he never left");
  } finally { r.restore(); }
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
  for (let i = 0; i < 60 * 3.2; i++) frame();   // the F prompt shows 3 s after it sits
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
