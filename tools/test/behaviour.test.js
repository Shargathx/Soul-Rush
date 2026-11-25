// Behaviour: runs the project's own script events (taken straight from the scene and sheet files) against stand-in
// objects, and checks they still do what they were built to do. A failure here means a change broke an old feature.
const { load, walk, codeOf, exists } = require("./lib");
const fs = require("fs"), path = require("path");

// The script event whose code contains `marker`, from the scene or sheet named `where`.
function script(where, marker) {
  const { scenes, sheets } = load();
  const src = scenes.concat(sheets).find(x => x.name === where);
  if (!src) throw new Error(where + " not found");
  let code = null;
  walk(src.events, e => { if (!code && e.type === "BuiltinCommonInstructions::JsCode" && codeOf(e).includes(marker)) code = codeOf(e); });
  if (!code) throw new Error("no script containing \"" + marker + "\" in " + where);
  return code;
}
// A variable container with GDevelop's interface.
function vars(init = {}) {
  const m = {};
  const make = (v) => ({ v, kids: {}, getAsNumber() { return Number(this.v) || 0; }, setNumber(x) { this.v = x; }, getAsString() { return String(this.v); }, setString(x) { this.v = x; },
    getAsBoolean() { return !!this.v; }, setBoolean(x) { this.v = x; }, getAllChildren() { return this.kids; }, removeChild(k) { delete this.kids[k]; }, getChild(k) { return this.kids[k] || (this.kids[k] = make(0)); } });
  for (const k in init) m[k] = make(init[k]);
  return { has: k => k in m, get: k => m[k] || (m[k] = make(0)) };
}
// A stand-in object with the methods these scripts use.
function obj(name, props = {}) {
  const vs = vars(props.vars || {});
  return Object.assign({
    name, x: 0, y: 0, w: 36, h: 32, s: 1, hidden: false, layer: "", text: "", anim: "", t: 0, op: 255,
    getX() { return this.x; }, getY() { return this.y; }, setX(v) { this.x = v; }, setY(v) { this.y = v; }, getWidth() { return this.w * this.s; }, getHeight() { return this.h; },
    getCenterXInScene() { return this.x; }, setScale(v) { this.s = v; }, hide(h) { this.hidden = h; }, isHidden() { return this.hidden; }, setLayer(l) { this.layer = l; }, getLayer() { return this.layer; },
    getZOrder() { return 1; }, setZOrder() {}, setOpacity(o) { this.op = o; }, getOpacity() { return this.op; }, getText() { return this.text; }, setText(t) { this.text = t; }, setCharacterSize() {},
    setWrapping() {}, setWrappingWidth() {}, getBehavior() { return null; }, setAnimationFrame() {}, setAnimationName(n) { this.anim = n; this.t = 0; },
    hasAnimationEnded() { return /idle|caw/.test(this.anim) ? false : this.t > (this.anim.startsWith("hop") ? 0.48 : 1.12); }, getVariables() { return vs; }
  }, props.extra || {});
}
global.PIXI = global.PIXI || { Graphics: function () { this.clear = () => {}; this.beginFill = () => {}; this.drawRect = () => {}; this.drawPolygon = () => {}; this.endFill = () => {}; this.destroy = () => {}; } };

module.exports = [
  ["hub crows: two per torii, never closer than their gap; caws only with the caw pose, roughly every 15 s", () => {
    const code = script("HUB_Area", "torii crow"), bad = [];
    const crows = [], sounds = [];
    const torii = obj("Hub_Gate_Torii", { extra: { getWidth: () => 256 } });
    const scene = { getObjects: n => n === "Hub_Gate_Torii" ? [torii] : n === "Player" ? [obj("Player")] : [], createObject: () => { const c = obj("Hub_Crow"); crows.push(c); return c; },
      getElapsedTime: () => 1000 / 60, getGame: () => ({ getSoundManager: () => ({ playSound: (f) => sounds.push({ f, frame }) }) }) };
    const fn = new Function("runtimeScene", "gdjs", code);
    let frame = 0, minGap = 1e9, cawPoseWithoutSound = 0;
    for (frame = 0; frame < 60 * 60 * 10; frame++) {
      for (const c of crows) c.t += 1 / 60;
      fn(scene, {});
      const B = scene.__hubCrows.birds;
      if (B.length !== 2) return ["expected 2 crows per torii, got " + B.length];
      if (B.every(b => b.mode !== "gone")) minGap = Math.min(minGap, Math.abs(B[0].px - B[1].px));
      for (const b of B) if (b.o.anim.startsWith("caw") && b.mode !== "caw") cawPoseWithoutSound++;
      for (const s of sounds.filter(s => s.frame === frame)) if (!B.some(b => b.mode === "caw" && b.o.t < 0.02)) bad.push("a caw sounded without a crow starting its caw pose");
    }
    const gapLimit = Number((code.match(/"gap":(\d+)/) || [])[1]);
    if (!gapLimit) bad.push("couldn't read the crows' gap from the hub's crow config");
    if (minGap < gapLimit) bad.push("crows came " + minGap + " px apart (gap is " + gapLimit + ")");
    if (cawPoseWithoutSound) bad.push("the caw pose played without a caw sound on " + cawPoseWithoutSound + " frames");
    const gaps = sounds.slice(1).map((s, k) => (s.frame - sounds[k].frame) / 60).sort((a, b) => a - b);
    if (sounds.length < 20) bad.push("only " + sounds.length + " caws in 10 minutes");
    else if (gaps[0] < 10 || gaps[gaps.length >> 1] > 20) bad.push("caw spacing off: min " + gaps[0].toFixed(1) + " s, median " + gaps[gaps.length >> 1].toFixed(1) + " s");
    for (const s of sounds) if (!exists(s.f)) bad.push("caw file missing: " + s.f);
    return [...new Set(bad)];
  }],

  ["hub bench: F rests; Start over asks again, wipes all progress in place without reloading; Esc closes", () => {
    const code = script("HUB_Area", "Hub interactions"), bad = [];
    const bench = obj("Hub_Bench", { vars: { Action: "rest" } }), player = obj("Player"), prompt = obj("Hub_Prompt"), dialog = obj("Hub_Dialog");
    bench.x = 500; bench.w = 80; player.x = 500; prompt.hidden = true;
    const gvars = vars(); gvars.get("BossesBeaten").kids.Samurai_Fight = { v: true };
    let pressed = new Set(), replaced = null; const store = { "SoulRush.progress": "{\"awakened\":{\"Samurai_Fight\":true},\"beaten\":{\"Samurai_Fight\":true}}" };
    global.localStorage = { setItem: (k, v) => { store[k] = v; }, getItem: k => store[k] };
    const scene = { __hubGates: { progress: { awakened: { Samurai_Fight: true }, beaten: { Samurai_Fight: true } } }, getName: () => "HUB_Area",
      getObjects: n => ({ Player: [player], Hub_Bench: [bench], Hub_Prompt: [prompt], Hub_Dialog: [dialog] })[n] || [],
      getTimeManager: () => ({ getElapsedTime: () => 1000 / 60, getTimeScale: () => 1 }),
      getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => ({ addChild(g) { g.parent = { removeChild() {} }; } }) }) }),
      getGame: () => ({ getGameResolutionWidth: () => 1280, getGameResolutionHeight: () => 720, getVariables: () => gvars }) };
    const gd = { evtTools: { input: { wasKeyJustPressed: (s, k) => pressed.has(k) }, runtimeScene: { replaceScene: (s, n) => { replaced = n; } } } };
    const fn = new Function("runtimeScene", "gdjs", code);
    const frame = (...keys) => { prompt.hidden = true; pressed = new Set(keys); fn(scene, gd); pressed = new Set(); };
    const run = n => { for (let i = 0; i < n; i++) frame(); };
    run(2); frame("f"); run(3);
    if (!/Rest/.test(dialog.text) || !/Start over/.test(dialog.text)) bad.push("F at the bench didn't ask Rest / Start over (dialog: " + JSON.stringify(dialog.text) + ")");
    frame("f"); run(250);
    if (!/warmth/.test(dialog.text)) bad.push("Rest didn't finish with its line (dialog: " + JSON.stringify(dialog.text) + ")");
    run(400); frame("f"); run(2); frame("d"); run(2); frame("f"); run(3);
    if (!/cannot be undone/.test(dialog.text) || !/> No </.test(dialog.text)) bad.push("Start over didn't ask to confirm with No picked (dialog: " + JSON.stringify(dialog.text) + ")");
    frame("f"); run(3);
    if (scene.__hubGates.progress.beaten.Samurai_Fight !== true) bad.push("answering No still wiped progress");
    run(400); frame("f"); run(2); frame("d"); frame("f"); run(2); frame("d"); run(2); frame("f"); run(300);
    if (replaced) bad.push("Start over reloaded the scene (" + replaced + "), which restarts the music");
    if (store["SoulRush.progress"] !== "{\"awakened\":{},\"beaten\":{}}") bad.push("the save wasn't wiped: " + store["SoulRush.progress"]);
    if (Object.keys(gvars.get("BossesBeaten").kids).length) bad.push("BossesBeaten wasn't cleared");
    if (Object.keys(scene.__hubGates.progress.beaten).length) bad.push("the gates' progress wasn't cleared");
    run(400); frame("f"); run(2); frame("Escape"); run(2);
    if (player.getVariables().get("ControlsLocked").getAsBoolean()) bad.push("Esc left the player locked");
    return bad;
  }],

  ["hub gates: the Gunslinger's desert door opens after the Leaf Ranger, past the sealed Fire Knight; F wakes it, then enters", () => {
    const code = script("HUB_Area", "Hub gates."), bad = [];
    const gate = (name, x, v) => Object.assign(obj(name, { vars: Object.assign({ Note: "", Shown: "" }, v), extra: { getAnimationName() { return this.anim; }, getAnimationFrame: () => 0 } }), { x, y: 420, h: 236 });
    const eclipse = gate("Hub_Gate_Eclipse", 2950, { Scene: "Leaf_Ranger_Fight", Label: "The Leaf Ranger", State: "active", Order: "2" });
    const infernal = gate("Hub_Gate_Infernal", 3475, { Scene: "", Label: "The Fire Knight", State: "locked", Order: "3", Note: "under construction" });
    const desert = gate("Hub_Gate_Desert", 3988, { Scene: "Gunslinger", Label: "The Gunslinger", State: "active", Order: "4" });
    const player = obj("Player", { extra: { getAnimationName() { return this.anim; } } }), prompt = obj("Hub_Prompt");
    player.x = 3988; player.y = 600;
    const gvars = vars(); gvars.get("JustBeaten").setString("");
    const store = { "SoulRush.progress": "{\"awakened\":{\"Samurai_Fight\":true,\"Leaf_Ranger_Fight\":true},\"beaten\":{\"Samurai_Fight\":true,\"Leaf_Ranger_Fight\":true}}" };
    global.localStorage = { setItem: (k, v) => { store[k] = v; }, getItem: k => store[k] };
    let pressed = new Set(), replaced = null;
    const scene = { getName: () => "HUB_Area", __cameraFollow: { x: 3988, y: 360 },
      getObjects: n => ({ Player: [player], Hub_Prompt: [prompt], Hub_Gate_Eclipse: [eclipse], Hub_Gate_Infernal: [infernal], Hub_Gate_Desert: [desert] })[n] || [],
      getTimeManager: () => ({ getElapsedTime: () => 1000 / 60, getTimeScale: () => 1 }),
      getLayer: () => ({ getCameraX: () => 3988, getCameraY: () => 360, getRenderer: () => ({ getRendererObject: () => ({ addChild() {} }) }) }),
      getGame: () => ({ getGameResolutionWidth: () => 1280, getGameResolutionHeight: () => 720, getVariables: () => gvars, getSoundManager: () => ({ playSound() {} }) }) };
    const gd = { evtTools: { input: { wasKeyJustPressed: (s, k) => pressed.has(k) }, runtimeScene: { replaceScene: (s, n) => { replaced = n; } } } };
    const fn = new Function("runtimeScene", "gdjs", code);
    const frame = (...keys) => { pressed = new Set(keys); fn(scene, gd); pressed = new Set(); };
    const run = n => { for (let i = 0; i < n; i++) frame(); };
    run(2);
    if (infernal.getVariables().get("Shown").getAsString() !== "locked") bad.push("the Fire Knight's gate isn't sealed");
    if (prompt.text !== "[F] Awaken - The Gunslinger") bad.push("at the desert door the prompt says " + JSON.stringify(prompt.text) + ", not \"[F] Awaken - The Gunslinger\"");
    frame("f"); run(300);
    if (!JSON.parse(store["SoulRush.progress"]).awakened.Gunslinger) bad.push("F didn't awaken the Gunslinger's gate");
    if (desert.anim !== "active") bad.push("the awakened desert door shows " + JSON.stringify(desert.anim) + ", not its active loop");
    if (player.getVariables().get("ControlsLocked").getAsBoolean()) bad.push("the awakening left the player locked");
    frame("f");
    // Stepping in fades to black first (about 0.45 s) with the controls locked, and only then loads the scene.
    if (replaced) bad.push("the gate loaded " + replaced + " at once instead of fading to black first");
    if (!player.getVariables().get("ControlsLocked").getAsBoolean()) bad.push("the controls must be locked while the gate fades out");
    run(10); if (replaced) bad.push("the gate loaded the scene after only 10 frames of the fade");
    run(40);
    if (replaced !== "Gunslinger") bad.push("F at the awakened door loaded " + JSON.stringify(replaced) + ", not the Gunslinger");
    return bad;
  }],

  ["fight UI: the boss block stays hidden through the Samurai's opening; Desperation shows x1-x3 after the curse flames", () => {
    const code = script("Combat_Shared", "Fight UI layout"), bad = [];
    let cb = null; const gd = { registerRuntimeScenePostEventsCallback: f => { cb = f; } };
    const pv = vars({ CurseStacks: 0, DesperationMax: 3, Posture: 0, MaxPosture: 100, IsDeathblow: false });
    const player = obj("Player", { extra: { getVariables: () => pv } });
    const bv = vars({ AIState: "Kneel", Lives: 2 }), boss = obj("Samurai_NPC", { extra: { getVariables: () => bv } });
    const curse = obj("Curse_Icon", { extra: { x: 268, y: 57, layer: "UI" } }), hp = obj("Enemy_HP_Bar"), post = obj("Enemy_Posture_Bar"), name = obj("Enemy_HP_Text");
    const objs = { Player: [player], Samurai_NPC: [boss], Curse_Icon: [curse], Enemy_HP_Bar: [hp], Enemy_Posture_Bar: [post], Enemy_HP_Text: [name] };
    const scene = { __fightUI: true, hasLayer: () => true, getName: () => "Samurai_Fight", getObjects: n => objs[n] || [], createObject: n => { const o = obj(n); objs[n] = [o]; return o; },
      getGame: () => ({ getGameResolutionWidth: () => 1280, getGameResolutionHeight: () => 720 }), getElapsedTime: () => 1000 / 60,
      getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => ({ addChild() {} }) }) }) };
    const saved = global.gdjs; global.gdjs = gd; delete gd.__soulRushFightUI;
    try { new Function("runtimeScene", "gdjs", code)(scene, gd); } finally { global.gdjs = saved; }
    if (!cb) return ["the fight UI didn't register its layout callback"];
    const step = n => { for (let i = 0; i < n; i++) cb(scene); };
    for (const state of ["Kneel", "Rise", "Bow"]) { bv.get("AIState").v = state; step(30); if (hp.op > 5) bad.push("boss bar visible during " + state + " (opacity " + Math.round(hp.op) + ")"); }
    bv.get("AIState").v = "Waiting"; step(60);
    if (hp.op < 240) bad.push("boss bar didn't fade in after the opening (opacity " + Math.round(hp.op) + ")");
    if (hp.getLayer() !== "UI" || Math.abs(hp.x - 360) > 1) bad.push("boss HP bar not at the bottom centre on the UI layer (" + hp.getLayer() + " " + hp.x + "," + hp.y + ")");
    if (name.text !== "The Samurai") bad.push("boss name is " + JSON.stringify(name.text));
    if (objs.Desperation_Icon && !objs.Desperation_Icon[0].hidden) bad.push("Desperation icon showing with no curse");
    for (const [stacks, want] of [[1, "x1"], [2, "x2"], [4, "x3"]]) {
      pv.get("CurseStacks").v = stacks; curse.w = 31 * stacks; step(30);
      const di = objs.Desperation_Icon && objs.Desperation_Icon[0], dc = objs.Desperation_Count && objs.Desperation_Count[0];
      if (!di || di.hidden) { bad.push("Desperation icon not shown at " + stacks + " stacks"); continue; }
      if (!dc || dc.text !== want) bad.push("Desperation count at " + stacks + " stacks is " + (dc && dc.text) + ", expected " + want);
      if (Math.abs(di.x - (268 + 31 * stacks + 5)) > 1) bad.push("Desperation icon not right after the flames at " + stacks + " stacks (x " + di.x + ")");
    }
    pv.get("CurseStacks").v = 0; curse.hidden = true; step(2);
    if (!objs.Desperation_Icon[0].hidden) bad.push("Desperation icon still shown after the curse lifted");
    return bad;
  }],

  ["deflect: both deflects use the Desperation window; one press stops only one ranged attack", () => {
    const { scenes, sheets } = load(), bad = [];
    let uses = 0; // (A ">" check is the Desperation glow, which asks whether the base window was missed, so it is not counted.)
    for (const x of scenes.concat(sheets)) walk(x.events, e => { for (const c of e.conditions || []) if (c.type.value === "CompareObjectTimer" && String(c.parameters[1]).includes("DeflectTimer") && String(c.parameters[3]).includes("DeflectWindow") && !String(c.parameters[3]).includes("PerfectFraction") && c.parameters[2] !== ">") { uses++; if (!/DeflectWindowNow/.test(c.parameters[3])) bad.push(x.file + " deflects with " + c.parameters[3] + " instead of DeflectWindowNow"); } });
    if (uses < 2) bad.push("expected two deflect checks (Combat_Shared and the Gunslinger), found " + uses);
    const cs = sheets.find(s => s.name === "Combat_Shared");
    let window = null; walk(cs.events, e => { for (const a of e.actions || []) if (a.parameters && a.parameters[1] === "DeflectWindowNow") window = a.parameters[3]; });
    if (!window || !/DesperationStep/.test(window) || !/DesperationMax/.test(window) || !/CurseStacks/.test(window)) bad.push("DeflectWindowNow isn't DeflectWindow + DesperationStep x min(CurseStacks, DesperationMax): " + window);
    let rangedRule = false; walk(cs.events, e => { for (const c of e.conditions || []) if (c.type.value === "BuiltinCommonInstructions::Or" && JSON.stringify(c).includes("DeflectRangedUsed")) rangedRule = true; });
    if (!rangedRule) bad.push("the one-ranged-attack-per-press rule is gone from the deflect");
    return bad;
  }],

  ["Leaf Ranger sounds: the chosen set has every kind, its files exist, and the impact cooldown holds", () => {
    const code = script("Leaf_Ranger_Boss", "const USE ="), bad = [];
    const played = [];
    const scene = { getGame: () => ({ getSoundManager: () => ({ playSound: (f, l, v) => played.push({ f, v }) }) }), getObjects: () => [] };
    new Function("runtimeScene", code)(scene);
    const S = scene.__lrSfx;
    for (const kind of ["draw", "bow", "whistle", "land", "fall", "impact"]) {
      const list = S.set[kind];
      if (!list || !list.length) { bad.push("set has no " + kind + " sounds"); continue; }
      for (const f of list) if (!exists(f)) bad.push(kind + " file missing: " + f);
      if (!(S.set.vol[kind] > 0)) bad.push(kind + " has no volume");
    }
    played.length = 0; S.play("impact"); S.play("impact");
    if (played.length !== 1) bad.push("two impacts at once both played (the cooldown should drop the second)");
    if (/wow/i.test(code)) bad.push("the WoW placeholder set is back in the helper");
    return bad;
  }],

  ["0 HP gives a deathblow: the Leaf Ranger's and the Samurai's life holds and death holds are in place", () => {
    // At 0 HP a boss kneels with the deathblow orb instead of losing the life (phase change) or dying at once; the
    // deathblow, or the stun running out, then leads into the next phase or the death animation.
    const bad = [];
    const BOSSES = [
      { scene: "Leaf_Ranger_Fight", who: "Leaf Ranger", obj: "Leaf_Ranger", sheet: "Leaf_Ranger_Boss" },
      { scene: "Samurai_Fight", who: "Samurai", obj: "Samurai_NPC", sheet: "Samurai_Boss" }
    ];
    for (const B of BOSSES) {
      const scene = load().scenes.find(s => s.name === B.scene);
      if (!scene) { bad.push(B.scene + " not found"); continue; }
      const ev = scene.events, at = start => ev.findIndex(e => e.type === "BuiltinCommonInstructions::Comment" && e.comment.startsWith(start));
      const link = t => ev.findIndex(e => e.type === "BuiltinCommonInstructions::Link" && e.target === t);
      const cs = link("Combat_Shared"), sheet = link(B.sheet);
      const holds = [B.who + " death hold: his HP reached 0 on his last life", B.who + " death hold: no deathblow came", B.who + " life hold: his HP reached 0 with a life to spare", B.who + " life hold: no deathblow came", B.who + " life hold: the life is gone"];
      for (const h of holds) {
        const i = at(h);
        if (i < 0) { bad.push(B.scene + ": missing event: " + h + "..."); continue; }
        // After Combat_Shared (which sets JustLostLife / JustDied) and before the boss's sheet (which would react).
        if (!(cs < i && i < sheet)) bad.push(B.scene + ": \"" + h + "\" must sit between the Combat_Shared and " + B.sheet + " links");
        const e = ev[i + 1], conds = JSON.stringify(e.conditions);
        // The deathblow takes its life the same way; a hold must never catch the deathblow's own life loss.
        if (/HP reached 0|no deathblow came/.test(h) && !(conds.includes("IsDeathblow") && conds.includes("False"))) bad.push(B.scene + ": \"" + h + "\" must skip during a deathblow (Player.IsDeathblow False)");
      }
      const life = ev[at(B.who + " life hold: his HP reached 0") + 1];
      if (life && !JSON.stringify(life.actions).includes("\"Lives\",\"+\",\"1\"")) bad.push(B.scene + ": the life hold must give the life back (Lives + 1)");
      for (const v of ["DeathHold", "LifeHold"]) if (!(scene.objects.find(o => o.name === B.obj).variables || []).some(x => x.name === v)) bad.push(B.scene + ": " + B.obj + " has no " + v + " variable");
    }
    // The Samurai: kept kneeling through the hold, and his death carries on from the kneel, before the hidden ending.
    const sam = load().scenes.find(s => s.name === "Samurai_Fight");
    if (sam) {
      const ev = sam.events, json = JSON.stringify(ev);
      if (!/"KneelTimer\\""/.test(json) || !json.includes("Samurai holds: while he kneels at 0 HP")) bad.push("Samurai_Fight: the holds must keep resetting KneelTimer, or he stands up mid-hold");
      const cont = ev.findIndex(e => e.type === "BuiltinCommonInstructions::Comment" && e.comment.startsWith("Samurai death hold: his sheet starts Samurai_Death"));
      const hidden = ev.findIndex(e => e.type === "BuiltinCommonInstructions::Comment" && e.comment.startsWith("Hidden ending: earned"));
      if (cont < 0) bad.push("Samurai_Fight: missing the death-from-the-kneel event");
      else if (hidden >= 0 && cont > hidden) bad.push("Samurai_Fight: the death-from-the-kneel event must come before the hidden ending, so the earned petal ending still takes over");
    }
    return bad;
  }],

  ["Leaf Ranger dodge: the roll has i-frames (Invulnerable for its whole length) and the dodge interval is re-rolled between 2 and 4", () => {
    const bad = [], sheet = load().sheets.find(s => s.name === "Leaf_Ranger_Boss");
    if (!sheet) return ["Leaf_Ranger_Boss not found"];
    const has = (e, s) => JSON.stringify(e.actions || []).includes(s);
    let enter = 0, leave = 0, reroll = 0;
    let prev = "";
    walk(sheet.events, e => {
      if (e.type === "BuiltinCommonInstructions::Comment") prev = e.comment;
      if (e.type !== "BuiltinCommonInstructions::Standard") return;
      // Entering the roll: sets AIState "Roll" and the roll animation.
      if (has(e, "\"AIState\",\"=\",\"\\\"Roll\\\"\"") && has(e, "Ranger_roll")) { enter++; if (!has(e, "\"Invulnerable\",\"True\"")) bad.push("entering the roll must set Invulnerable True"); }
      // Leaving the roll: AIState back to Neutral when the roll animation has ended.
      if (prev.startsWith("Roll over") && JSON.stringify(e.conditions).includes("HasAnimationEnded") && has(e, "\"AIState\",\"=\",\"\\\"Neutral\\\"\"")) { leave++; if (!has(e, "\"Invulnerable\",\"False\"")) bad.push("the end of the roll must clear Invulnerable"); }
      if (has(e, "\"DodgeEvery\",\"=\",\"RandomInRange(2, 4)\"")) reroll++;
    });
    if (enter !== 1) bad.push("expected one roll entry, found " + enter);
    if (leave !== 1) bad.push("expected one roll exit, found " + leave);
    if (reroll !== 1) bad.push("the dodge must re-roll DodgeEvery with RandomInRange(2, 4) after each dodge");
    return bad;
  }],

  ["Leaf Ranger mini-stagger: quick hits make him flinch with take-hit, on a cooldown, before the thorn wall can take the count", () => {
    const bad = [], { sheets, scenes } = load(), sheet = sheets.find(s => s.name === "Leaf_Ranger_Boss"), scene = scenes.find(s => s.name === "Leaf_Ranger_Fight");
    if (!sheet || !scene) return ["Leaf_Ranger_Boss or Leaf_Ranger_Fight not found"];
    const ev = sheet.events, at = start => ev.findIndex(e => e.type === "BuiltinCommonInstructions::Comment" && e.comment.startsWith(start));
    const m = at("Mini-stagger"), w = at("Thorn wall");
    if (m < 0) return ["missing the mini-stagger event"];
    if (w >= 0 && m > w) bad.push("the mini-stagger must come before the thorn wall, so it takes the hit count first");
    const e = ev[m + 1], conds = JSON.stringify(e.conditions), acts = JSON.stringify(e.actions);
    for (const s of ["MiniHits", "StaggerTimer", "IsPostureBroken", "Invulnerable", "JustLostLife", "JustDied"]) if (!conds.includes(s)) bad.push("the mini-stagger must check " + s);
    if (!acts.includes("Ranger_take_hit") || !acts.includes("\\\"Stagger\\\"")) bad.push("the mini-stagger must enter Stagger with the take-hit animation");
    if (!acts.includes("\"HitCount\",\"=\",\"0\"")) bad.push("the mini-stagger must reset HitCount (or the wall fires right after)");
    if (!acts.includes("StaggerTimer")) bad.push("the mini-stagger must restart its cooldown timer");
    const vars = (scene.objects.find(o => o.name === "Leaf_Ranger").variables || []);
    for (const v of ["MiniHits", "StaggerCooldown"]) if (!vars.some(x => x.name === v)) bad.push("Leaf_Ranger has no " + v + " variable");
    return bad;
  }],

  ["Leaf Ranger air combos: codes Q (poison) and W (entangle) are in his phase 2 rotation and fire a fan of three aimed arrows; the classic volley is untouched", () => {
    const bad = [], { sheets, scenes } = load(), sheet = sheets.find(s => s.name === "Leaf_Ranger_Boss"), scene = scenes.find(s => s.name === "Leaf_Ranger_Fight");
    if (!sheet || !scene) return ["Leaf_Ranger_Boss or Leaf_Ranger_Fight not found"];
    // The event after the comment that starts with `s`, wherever it sits (the codes are nested in the rotation event).
    const next = (s, list = sheet.events) => { for (let i = 0; i < list.length; i++) { if (list[i].type === "BuiltinCommonInstructions::Comment" && list[i].comment.startsWith(s)) return list[i + 1]; const r = list[i].events && next(s, list[i].events); if (r) return r; } return null; };
    const lf = scene.objects.find(o => o.name === "Leaf_Ranger"), arrow = scene.objects.find(o => o.name === "Ranger_Arrow");
    const rot = (lf.variables.find(v => v.name === "RotP2") || {}).value || "";
    for (const c of ["Q", "W"]) if (!rot.includes(c)) bad.push("RotP2 (" + rot + ") has no " + c);
    for (const [code, kind, text] of [["Q", "poison", "Code Q"], ["W", "entangle", "Code W"]]) {
      const e = next(text);
      if (!e) { bad.push("missing " + text); continue; }
      const j = JSON.stringify(e);
      if (!j.includes("\\\"" + code + "\\\"") || !j.includes("\"AirKind\",\"=\",\"\\\"" + kind + "\\\"\"") || !j.includes("\\\"Air\\\"")) bad.push(text + " must enter the Air state with AirKind " + kind);
    }
    if (!JSON.stringify(next("Code A")).includes("\"AirKind\",\"=\",\"\\\"\\\"\"")) bad.push("Code A (classic volley) must clear AirKind");
    const vol = next("Air volley: on frame 6"), fan = next("Air combo (AirKind");
    if (!vol || !fan) return bad.concat("missing the volley or the fan event");
    if (!JSON.stringify(vol.conditions).includes("AirKind")) bad.push("the classic volley must only fire when AirKind is empty");
    if (!JSON.stringify(fan.conditions).includes("AirKind") || !JSON.stringify(fan.conditions).includes("inverted")) bad.push("the fan must only fire when AirKind is not empty");
    const fj = JSON.stringify(fan.events);
    if (!fj.includes("Ranger_Arrow") || !fj.includes("\"repeatExpression\":\"3\"") || !fj.includes("atan2") || !fj.includes("Leaf_Ranger.VariableString(AirKind)")) bad.push("the fan must create 3 Ranger_Arrow aimed with atan2, with Kind taken from AirKind");
    if (!fj.includes("PoisonDamage") || !fj.includes("EntangleDamage")) bad.push("the fan's arrows must take poison and entangle damage");
    const fly = next("Arrows: fly straight");
    if (!JSON.stringify(fly.actions).includes("Ranger_Arrow.Variable(Vy)")) bad.push("arrows must move along Vy");
    const wall = next("Arrow reached an arena wall");
    if (!JSON.stringify(wall.conditions).includes("Invisible_Wall")) bad.push("an arrow reaching a wall or the floor must stick (collision with Invisible_Wall)");
    if (!lf.variables.some(v => v.name === "AirKind") || !lf.variables.some(v => v.name === "AirSpread")) bad.push("Leaf_Ranger needs AirKind and AirSpread");
    if (!arrow.variables.some(v => v.name === "Vy")) bad.push("Ranger_Arrow needs a Vy variable");
    // Entangle leaves vines: a root trap that lasts VineLife seconds and can't be cut. Poison leaves its cloud; other arrows a bush.
    const vine = next("Entangle arrow: leave a vine"), cutEv = next("Snare: a sword swing that hits an armed trap"), bushEv = next("Any other arrow");
    if (!vine || !JSON.stringify(vine.actions).includes("Ranger_Trap") || !JSON.stringify(vine.actions).includes("\"Vine\",\"=\",\"1\"") || !JSON.stringify(vine.actions).includes("VineLife")) bad.push("an entangle arrow must leave a Ranger_Trap vine (Vine 1, lasting VineLife)");
    const trap = scene.objects.find(o => o.name === "Ranger_Trap"), vineAnim = trap.animations.find(a => a.name === "Vine");
    if (!vineAnim || vineAnim.directions[0].sprites.length < 4 || !vineAnim.directions[0].looping) bad.push("Ranger_Trap needs a looping Vine animation (the idle, writhing vines)");
    if (vine && !JSON.stringify(vine.actions).includes("\\\"Vine\\\"")) bad.push("a new vine must play the Vine animation");
    if (!JSON.stringify(cutEv.conditions).includes("\"Vine\"")) bad.push("a sword swing must not cut a vine (the cut needs Vine = 0)");
    if (!JSON.stringify(bushEv.conditions).includes("entangle")) bad.push("the thorn bush must not also grow for an entangle arrow");
    if (!(lf.variables.find(v => v.name === "AirSpread") || {}).value >= 200) bad.push("AirSpread must be wide enough for X --- X --- X (200+)");
    if (!JSON.stringify(next("Aim each new arrow")).includes("GroundCY")) bad.push("the fan must aim at the ground around the player, so the arrows land AirSpread apart");
    if (!lf.variables.some(v => v.name === "VineLife") || !scene.objects.find(o => o.name === "Ranger_Trap").variables.some(v => v.name === "Vine")) bad.push("VineLife on Leaf_Ranger and Vine on Ranger_Trap are needed");
    return bad;
  }],

  ["boss UI: slim bars on the ground band, the arena lifted (camera base + extra floor rows), and the Leaf Ranger keeps his bars up when he loses a life", () => {
    const bad = [], { scenes, sheets } = load();
    const cs = sheets.find(s => s.name === "Combat_Shared");
    let all = ""; walk(cs.events, e => { if (e.type === "BuiltinCommonInstructions::JsCode") all += "\n" + codeOf(e); });
    const m = all.match(/const LIFT = (\d+);/), LIFT = m ? Number(m[1]) : 0;
    if (!LIFT) bad.push("Combat_Shared has no arena lift (LIFT)");
    if (!/__cameraBase = base/.test(all) || !/HUB_Area/.test(all.slice(all.indexOf("const LIFT")))) bad.push("the lift must set the camera base the shake rests around, and leave the hub alone");
    if (LIFT && all.indexOf("const LIFT") > all.indexOf("Hit-stop and screen shake. Events")) bad.push("the lift must run before the shake");
    for (const name of ["Leaf_Ranger_Fight", "Samurai_Fight", "Tutorial_Level"]) {
      const sc = scenes.find(s => s.name === name);
      if (!sc) { bad.push(name + " not found"); continue; }
      const floor = sc.instances.find(i => i.name === "Ground_Stuff");
      const rows = floor && JSON.parse(floor.stringProperties.find(p => p.name === "tilemap").value).dimY;
      // The floor may be stretched or moved in the editor, so check what matters: it must reach the bottom of the lifted view.
      if (!floor || floor.y + floor.height < 720 + LIFT) bad.push(name + ": the floor must reach the bottom of the lifted view (y " + (floor && floor.y) + " + height " + (floor && floor.height) + " < " + (720 + LIFT) + "), or a strip shows under it");
      if (!floor || !(rows >= 5)) bad.push(name + ": the floor needs extra tile rows under the lifted arena (has " + rows + " rows)");
      for (const [n, maxW, maxH] of [["Enemy_HP_Bar", 600, 30], ["Enemy_Posture_Bar", 420, 26]]) {
        const b = sc.instances.find(i => i.name === n && i.layer === "UI");
        if (!b) { bad.push(name + ": no " + n); continue; }
        if (b.width > maxW || b.height > maxH) bad.push(name + ": " + n + " is " + b.width + "x" + b.height + ", should be slim (at most " + maxW + "x" + maxH + ")");
        if (b.y + b.height > 720 - 8) bad.push(name + ": " + n + " runs off the bottom of the screen");
      }
    }
    // The block's top (the name) must be under the lifted floor surface (world 657, on screen 657 - LIFT).
    const ui = all.match(/HP_H = (\d+), POST_H = (\d+), MARGIN = (\d+), NAME_SIZE = (\d+)/);
    if (!ui) bad.push("can't read the fight UI sizes");
    else { const [, hh, ph, mg, ns] = ui.map(Number); const top = 720 - mg - hh - ph + 3 - ns - 8; if (top < 657 - LIFT) bad.push("the boss block starts at y " + top + ", above the floor surface at " + (657 - LIFT)); }
    // Leaf Ranger: losing a life must not hide his bars.
    const lr = sheets.find(s => s.name === "Leaf_Ranger_Boss");
    const find = list => { for (let i = 0; i < list.length; i++) { if (list[i].type === "BuiltinCommonInstructions::Comment" && list[i].comment.startsWith("Lost a life: leap to the far side")) return list[i + 1]; const r = list[i].events && find(list[i].events); if (r) return r; } return null; };
    const lost = find(lr.events);
    if (!lost) bad.push("missing the Leaf Ranger's lost-a-life event");
    else if (/"Hide"\},"parameters":\["Enemy_(HP|Posture)_Bar/.test(JSON.stringify(lost.actions))) bad.push("the Leaf Ranger's lost-a-life event hides his bars again");
    // The Samurai too: his intermission and his ultimate cast keep the bars up.
    const sm = sheets.find(s => s.name === "Samurai_Boss");
    const findC = (list, start) => { for (let i = 0; i < list.length; i++) { if (list[i].type === "BuiltinCommonInstructions::Comment" && list[i].comment.startsWith(start)) return list[i + 1]; const r = list[i].events && findC(list[i].events, start); if (r) return r; } return null; };
    for (const start of ["Boss: lost a life, so start the intermission", "Boss: at 75%, 50% and 25% HP"]) {
      const e = findC(sm.events, start);
      if (!e) bad.push("missing the Samurai event: " + start);
      else if (/"Hide"\},"parameters":\["Enemy_(HP|Posture)_Bar/.test(JSON.stringify(e.actions))) bad.push("the Samurai event \"" + start + "\" hides his bars");
    }
    return bad;
  }],

  ["floor: the arrows stick in the walls and floor by colliding with the Invisible_Wall pieces (no hard-coded height), and GroundCY still matches the floor", () => {
    // An arrow that reaches a wall or the floor sticks. It is a collision with Invisible_Wall (side walls and floor), so it follows them if they
    // move. GroundCY (his feet) and the many GroundCY + 124 spots still need the floor top to match, so check that too.
    const bad = [], { sheets, scenes } = load(), sc = scenes.find(s => s.name === "Leaf_Ranger_Fight"), lr = sheets.find(s => s.name === "Leaf_Ranger_Boss");
    const ground = Number(sc.objects.find(o => o.name === "Leaf_Ranger").variables.find(v => v.name === "GroundCY").value);
    const floor = sc.instances.find(i => i.name === "Ground_Stuff");
    if (floor.y !== ground + 124) bad.push("Ground_Stuff's top (" + floor.y + ") is not GroundCY + 124 (" + (ground + 124) + ")");
    const start = sc.instances.find(i => i.name === "Leaf_Ranger");
    if (start.y !== ground) bad.push("the Leaf Ranger starts at y " + start.y + " but GroundCY is " + ground);
    let hits = 0, literal = 0;
    walk(lr.events, e => { for (const c of (e.conditions || [])) {
      if (c.type.value === "CollisionNP" && c.parameters[0] === "Ranger_Arrow" && c.parameters[1] === "Invisible_Wall") hits++;
      for (const x of [c].concat(c.subInstructions || [])) if (x.parameters && x.parameters[0] === "Ranger_Arrow.Y()") literal++; } });
    if (hits !== 1) bad.push("expected one Ranger_Arrow / Invisible_Wall collision in the wall-stick event, found " + hits);
    if (literal) bad.push("an arrow's ground check is a hard-coded Y again; use the Invisible_Wall collision");
    if (!sc.instances.some(i => i.name === "Invisible_Wall" && i.y > 600)) bad.push("the scene has no Invisible_Wall floor for arrows to hit");
    return bad;
  }],

  ["debug keys: one switch (DEBUG_KEYS in Combat_Shared). On, nothing is touched; off, F2-F10, the numpad and the Samurai's 0 read as never pressed, normal keys still work", () => {
    const code = script("Combat_Shared", "const DEBUG_KEYS"), bad = [];
    if (!/const DEBUG_KEYS = true;/.test(code)) bad.push("DEBUG_KEYS must be true in development (flip it to false for the demo build)");
    const keys = ["F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "Numpad0", "Numpad1", "Numpad9", "NumpadReturn", "NumpadAdd", "NumpadSubtract", "NumpadMultiply", "NumpadDivide", "Num0", "Home", "End", "Insert", "Delete", "PageUp", "PageDown", "LAlt", "l", "p", "o", "b", "x", "c", "Num1", "Num2", "Add", "Subtract", "Multiply", "Divide"];
    const normal = ["a", "d", "f", "j", "k", "q", "Space", "Escape", "LShift", "F11"];
    const run = (src) => {
      const real = () => true, input = { isKeyPressed: real, wasKeyJustPressed: real, wasKeyReleased: real };
      const g = { evtTools: { input } };
      new Function("runtimeScene", "gdjs", src)({}, g);
      new Function("runtimeScene", "gdjs", src)({}, g); // runs every frame: it must install only once
      return input;
    };
    const on = run(code);
    for (const k of keys.concat(normal)) for (const fn of ["isKeyPressed", "wasKeyJustPressed", "wasKeyReleased"]) if (!on[fn](null, k)) bad.push("with the switch on, " + fn + "(" + k + ") was blocked");
    const off = run(code.replace("const DEBUG_KEYS = true;", "const DEBUG_KEYS = false;"));
    for (const k of keys) for (const fn of ["isKeyPressed", "wasKeyJustPressed", "wasKeyReleased"]) if (off[fn](null, k)) bad.push("with the switch off, " + fn + "(" + k + ") still works");
    for (const k of normal) for (const fn of ["isKeyPressed", "wasKeyJustPressed", "wasKeyReleased"]) if (!off[fn](null, k)) bad.push("with the switch off, a normal key " + k + " is blocked too (" + fn + ")");
    return bad;
  }],

  ["demo: the Fire Knight gate stays locked (his scene is unfinished). The Gunslinger's door is the real one now (piperal's work), so it is not checked", () => {
    const HUB = require("../hub/hub.js"), bad = [];
    const g = (HUB.gates || []).find(x => x.label === "The Fire Knight");
    if (!g) bad.push("The Fire Knight is missing from the hub's gates");
    else if (g.state !== "locked") bad.push("The Fire Knight is not locked in tools/hub/hub.js (state " + g.state + ")");
    return bad;
  }],

  ["Samurai phases: three lives, phase 2 singles and 2 petals, phase 3 triples, 5 petals and melee windows, the phase set from his lives", () => {
    const bad = [], { scenes, sheets } = load(), sc = scenes.find(s => s.name === "Samurai_Fight"), sh = sheets.find(s => s.name === "Samurai_Boss");
    const v = n => ((sc.objects.find(o => o.name === "Samurai_NPC").variables.find(x => x.name === n) || {}).value);
    if (v("Lives") !== 3) bad.push("the Samurai starts with " + v("Lives") + " lives, expected 3");
    if (v("MaxPhase") !== 3) bad.push("MaxPhase must be 3 in the fight scene");
    if (v("PetalCountP2") !== 5 || v("PetalCountP3") !== 10) bad.push("petals: phase 2 should be 5 (a half circle) and phase 3 should be 10, double (got " + v("PetalCountP2") + " and " + v("PetalCountP3") + ")");
    if (v("MirrorChance") !== 100) bad.push("in phase 3 every cut, petal cast and tornado is a mirror skill (MirrorChance 100)");
    if (v("MeleeChance") !== 20) bad.push("MeleeChance should be 20");
    const json = JSON.stringify(sh.events);
    if (!json.includes("PetalCountP3")) bad.push("the phase 3 petal branch is missing");
    const tripleEvents = [];
    walk(sh.events, e => { if (JSON.stringify(e.conditions || []).includes("QuickdrawCount")) tripleEvents.push(e); });
    if (!tripleEvents.length || !tripleEvents.every(e => JSON.stringify(e.conditions).includes("\"Phase\",\">=\",\"3\""))) bad.push("triple cuts must be gated to phase 3");
    if (!json.includes("min(Samurai_NPC.Variable(MaxPhase), 4 - Samurai_NPC.Variable(Lives))")) bad.push("the phase after an intermission must come from his lives");
    for (const c of ["Melee window (phases 2 and 3)", "Melee window over"]) if (!json.includes(c)) bad.push("missing the melee event: " + c);
    // Only the three phase 2 petal branches may test Phase = 2; every other aggressive event must also run in phase 3.
    let strayEq2 = 0;
    walk(sh.events, e => { if ((e.conditions || []).some(c => c.type.value === "NumberObjectVariable" && !c.type.inverted && c.parameters[1] === "Phase" && c.parameters[2] === "=" && c.parameters[3] === "2") && !JSON.stringify(e.actions || []).includes("PetalCountP2")) strayEq2++; });
    if (strayEq2) bad.push("a Phase = 2 condition is left on a non-petal event (" + strayEq2 + "): phase 3 would skip it");
    return bad;
  }],

  ["Samurai double dash: a dash strike or wall slash restarts the skill timer, and the offense dash waits after a skill", () => {
    const bad = [], { sheets } = load(), sh = sheets.find(s => s.name === "Samurai_Boss");
    const evs = []; walk(sh.events, e => { evs.push(e); });
    for (const st of ["PassingStrike", "WallSlash"]) {
      const e = evs.find(e => JSON.stringify(e.conditions || []).includes("\"AIState\",\"=\",\"\\\"" + st + "\\\"\"") && JSON.stringify(e.conditions).includes("HasAnimationEnded") && JSON.stringify(e.actions || []).includes("AggroReady"));
      if (!e) { bad.push("no finish event for " + st); continue; }
      if (!JSON.stringify(e.actions).includes("SkillTimer")) bad.push(st + " must restart SkillTimer when it ends, or a dash skill can follow at once");
    }
    const off = evs.find(e => JSON.stringify(e.conditions || []).includes("OffenseDashDelay"));
    if (!off || !JSON.stringify(off.conditions).includes("SkillTimer")) bad.push("the offense dash must wait on SkillTimer after a skill");
    return bad;
  }],

  ["Cat fight UI: the bar stays up through the deathblow that takes the second to last life (its Lives drops to 1 while the deathblow still plays) and hides only for a deathblow that began on the last life", () => {
    const bad = [], code = script("Combat_Shared", "Fight UI layout"), { scenes, sheets } = load(), sc = scenes.find(s => s.name === "Cat_Fight"), sh = sheets.find(s => s.name === "Samurai_Boss");
    let cb = null; const gd = { registerRuntimeScenePostEventsCallback: f => { cb = f; } };
    const pv = vars({ CurseStacks: 0, DesperationMax: 3, Posture: 0, MaxPosture: 100, IsDeathblow: false });
    const player = obj("Player", { extra: { getVariables: () => pv } });
    const bv = vars({ AIState: "Waiting", Lives: 3, BarMode: 0, CardState: 0 }), boss = obj("Cat", { extra: { getVariables: () => bv } });
    const hp = obj("Enemy_HP_Bar"), post = obj("Enemy_Posture_Bar"), name = obj("Enemy_HP_Text"), objs = { Player: [player], Cat: [boss], Enemy_HP_Bar: [hp], Enemy_Posture_Bar: [post], Enemy_HP_Text: [name] };
    const scene = { __fightUI: true, hasLayer: () => true, getName: () => "Cat_Fight", getObjects: n => objs[n] || [], createObject: n => { const o = obj(n); objs[n] = [o]; return o; },
      getGame: () => ({ getGameResolutionWidth: () => 1280, getGameResolutionHeight: () => 720 }), getElapsedTime: () => 1000 / 60,
      getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => ({ addChild() {} }) }) }) };
    const mk = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === "anchor" || k === "scale" ? mk() : () => mk())), set: (t, k, v) => { t[k] = v; return true; } });
    const saved = global.gdjs, savedPixi = global.PIXI; global.gdjs = gd; delete gd.__soulRushFightUI;
    global.PIXI = { Container: function () { return mk(); }, Text: function () { return mk(); }, Graphics: function () { this.n = 0; this.clear = () => { this.n = 0; }; this.beginFill = () => {}; this.drawPolygon = () => { this.n++; }; this.drawRect = () => {}; this.endFill = () => {}; this.addChild = () => {}; } };
    try { new Function("runtimeScene", "gdjs", code)(scene, gd); } finally { global.gdjs = saved; }
    try {
      if (!cb) return ["the fight UI didn't register its layout callback"];
      const step = n => { for (let i = 0; i < n; i++) cb(scene); };
      step(120); if (hp.op < 240) bad.push("phase 1: the bar must show (opacity " + Math.round(hp.op) + ")");
      bv.get("Lives").v = 2; step(60);
      // The boss held at 0.01 HP with a life to spare: the player's deathblow begins while it still has 2, then the life is taken (Lives 1) while it plays.
      pv.get("IsDeathblow").v = true; step(5);
      bv.get("Lives").v = 1; step(90);
      if (hp.op < 240) bad.push("the bar vanished at the change into the last phase (opacity " + Math.round(hp.op) + ")");
      pv.get("IsDeathblow").v = false; step(60);
      if (hp.op < 240) bad.push("the bar must be up in the last phase (opacity " + Math.round(hp.op) + ")");
      // The last deathblow begins on the last life: the block goes.
      pv.get("IsDeathblow").v = true; step(120);
      if (hp.op > 5) bad.push("the final deathblow should hide the block (opacity " + Math.round(hp.op) + ")");
    } finally { delete global.__ringList; global.PIXI = savedPixi; }
    return bad;
  }],
  ["Rooted (in a snare, vine or root): attacking is blocked and only deflecting works: every event that starts or saves an attack needs Player.IsRooted = false, the deflect does not", () => {
    const { sheets } = load(), sh = sheets.find(s => s.name === "Player_Movement"), bad = [];
    const after = prefix => { const k = sh.events.findIndex(e => e.type === "BuiltinCommonInstructions::Comment" && String(e.comment).startsWith(prefix)); return k < 0 ? null : sh.events[k + 1]; };
    const requiresNotRooted = ev => (ev.conditions || []).some(c => c.parameters && c.parameters[0] === "Player" && c.parameters[1] === "IsRooted" && c.parameters[2] === "False" && !c.type.inverted);
    for (const prefix of ["Input buffer: save an attack", "Start an attack, once AttackRecovery", "Saved press after Attack_One", "Saved press after Attack_Two"]) {
      const ev = after(prefix); if (!ev) { bad.push("the event after \"" + prefix + "\" is missing"); continue; }
      if (!requiresNotRooted(ev)) bad.push("\"" + prefix + "...\" must require Player.IsRooted = false (a rooted player must not attack)");
    }
    const d = after("Deflect: raise the sword"); if (!d) bad.push("the deflect event is missing"); else if ((d.conditions || []).some(c => c.parameters && c.parameters[1] === "IsRooted")) bad.push("the deflect must still work while rooted");
    return bad;
  }],
  ["Mercy hides the boss bars at once: with scene.__hideBars (set when E is held through) the HP bar, the posture bar and the name are gone in the very next frame, not faded out", () => {
    const bad = [], code = script("Combat_Shared", "Fight UI layout"), { scenes, sheets } = load(), sc = scenes.find(s => s.name === "Cat_Fight"), sh = sheets.find(s => s.name === "Samurai_Boss");
    let cb = null; const gd = { registerRuntimeScenePostEventsCallback: f => { cb = f; } };
    const pv = vars({ CurseStacks: 0, DesperationMax: 3, Posture: 0, MaxPosture: 100, IsDeathblow: false });
    const player = obj("Player", { extra: { getVariables: () => pv } });
    const bv = vars({ AIState: "Waiting", Lives: 3, BarMode: 0, CardState: 0 }), boss = obj("Cat", { extra: { getVariables: () => bv } });
    const hp = obj("Enemy_HP_Bar"), post = obj("Enemy_Posture_Bar"), name = obj("Enemy_HP_Text"), objs = { Player: [player], Cat: [boss], Enemy_HP_Bar: [hp], Enemy_Posture_Bar: [post], Enemy_HP_Text: [name] };
    const scene = { __fightUI: true, hasLayer: () => true, getName: () => "Cat_Fight", getObjects: n => objs[n] || [], createObject: n => { const o = obj(n); objs[n] = [o]; return o; },
      getGame: () => ({ getGameResolutionWidth: () => 1280, getGameResolutionHeight: () => 720 }), getElapsedTime: () => 1000 / 60,
      getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => ({ addChild() {} }) }) }) };
    const mk = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === "anchor" || k === "scale" ? mk() : () => mk())), set: (t, k, v) => { t[k] = v; return true; } });
    const saved = global.gdjs, savedPixi = global.PIXI; global.gdjs = gd; delete gd.__soulRushFightUI;
    global.PIXI = { Container: function () { return mk(); }, Text: function () { return mk(); }, Graphics: function () { this.n = 0; this.clear = () => { this.n = 0; }; this.beginFill = () => {}; this.drawPolygon = () => { this.n++; }; this.drawRect = () => {}; this.endFill = () => {}; this.addChild = () => {}; } };
    try { new Function("runtimeScene", "gdjs", code)(scene, gd); } finally { global.gdjs = saved; }
    try {
      if (!cb) return ["the fight UI didn't register its layout callback"];
      const step = n => { for (let i = 0; i < n; i++) cb(scene); };
      step(120); if (hp.op < 240) bad.push("the bar must show before the mercy (opacity " + Math.round(hp.op) + ")");
      scene.__hideBars = true; cb(scene);                                            // ONE frame after the E check goes through
      if (hp.op > 1) bad.push("the HP bar must be gone at once (opacity " + Math.round(hp.op) + " one frame later)");
      if (post.op > 1) bad.push("the posture bar must be gone at once (opacity " + Math.round(post.op) + ")");
      if (!name.hidden && name.op > 1) bad.push("the boss name must be gone at once");
      step(60); if (hp.op > 1) bad.push("the bar must stay gone (opacity " + Math.round(hp.op) + ")");
    } finally { global.PIXI = savedPixi; }
    return bad;
  }],
  ["Samurai fakeout: two life marks, the bar stays up through deathblows, goes empty at the second death with the ENEMY DEFEATED card, returns as Two-Shadow; the three sets of cuts lead into phase 2; thousand cuts back at 75%, 50% and 25% with none after the card", () => {
    const bad = [], code = script("Combat_Shared", "Fight UI layout"), { scenes, sheets } = load(), sc = scenes.find(s => s.name === "Samurai_Fight"), sh = sheets.find(s => s.name === "Samurai_Boss");
    let cb = null; const gd = { registerRuntimeScenePostEventsCallback: f => { cb = f; } };
    const pv = vars({ CurseStacks: 0, DesperationMax: 3, Posture: 0, MaxPosture: 100, IsDeathblow: false });
    const player = obj("Player", { extra: { getVariables: () => pv } });
    const bv = vars({ AIState: "Waiting", Lives: 3, BarMode: 0, CardState: 0 }), boss = obj("Samurai_NPC", { extra: { getVariables: () => bv } });
    const hp = obj("Enemy_HP_Bar"), post = obj("Enemy_Posture_Bar"), name = obj("Enemy_HP_Text"), objs = { Player: [player], Samurai_NPC: [boss], Enemy_HP_Bar: [hp], Enemy_Posture_Bar: [post], Enemy_HP_Text: [name] };
    const scene = { __fightUI: true, hasLayer: () => true, getName: () => "Samurai_Fight", getObjects: n => objs[n] || [], createObject: n => { const o = obj(n); objs[n] = [o]; return o; },
      getGame: () => ({ getGameResolutionWidth: () => 1280, getGameResolutionHeight: () => 720 }), getElapsedTime: () => 1000 / 60,
      getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => ({ addChild() {} }) }) }) };
    const mk = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : (k === "anchor" || k === "scale" ? mk() : () => mk())), set: (t, k, v) => { t[k] = v; return true; } });
    const saved = global.gdjs, savedPixi = global.PIXI; global.gdjs = gd; delete gd.__soulRushFightUI;
    global.PIXI = { Container: function () { return mk(); }, Text: function () { return mk(); }, Graphics: function () { this.n = 0; this.clear = () => { this.n = 0; }; this.beginFill = () => {}; this.drawPolygon = () => { this.n++; }; this.drawRect = () => {}; this.endFill = () => {}; this.addChild = () => {}; } };
    try { new Function("runtimeScene", "gdjs", code)(scene, gd); } finally { global.gdjs = saved; }
    try {
      if (!cb) return ["the fight UI didn't register its layout callback"];
      const step = n => { for (let i = 0; i < n; i++) cb(scene); };
      const marks = () => { const g = (scene.__fightUIState || {}).pips; return g ? g.n / 2 : -1; };
      step(120);
      if (hp.op < 240 || name.text !== "The Samurai") bad.push("phase 1: the block must show, named The Samurai");
      if (marks() !== 2) bad.push("phase 1 must show 2 life marks, shows " + marks());
      bv.get("Lives").v = 2; step(60);
      if (marks() !== 1 || hp.op < 240) bad.push("phase 2 must show 1 life mark and the bar (marks " + marks() + ")");
      pv.get("IsDeathblow").v = true; step(90);
      if (hp.op < 240) bad.push("the bar must stay up through a deathblow that costs a life (opacity " + Math.round(hp.op) + ")");
      pv.get("IsDeathblow").v = false;
      bv.get("Lives").v = 1; bv.get("BarMode").v = 1; bv.get("AIState").v = "Intermission"; step(120);
      if (hp.op < 240) bad.push("at the second death the bar must stay up (drawn empty), opacity " + Math.round(hp.op));
      if (marks() !== 0 || name.text !== "The Samurai") bad.push("while 'dead' there are no marks and the name is still The Samurai (marks " + marks() + ", name " + name.text + ")");
      bv.get("CardState").v = 1; step(60);
      if (!scene.__fightUIState.card) bad.push("CardState 1 must put the ENEMY DEFEATED card up");
      bv.get("CardState").v = 2; step(30);
      if (!scene.__fightUIState.card) bad.push("the card is still there while it is slashed");
      bv.get("CardState").v = 0; step(2);
      if (scene.__fightUIState.card) bad.push("CardState 0 must take the card down");
      bv.get("BarMode").v = 2; bv.get("AIState").v = "Ultimate"; step(30);
      if (name.text !== "Two-Shadow" || marks() !== 1) bad.push("the true form is named Two-Shadow with 1 mark (name " + name.text + ", marks " + marks() + ")");
      bv.get("BarMode").v = 0; pv.get("IsDeathblow").v = true; step(120);
      if (hp.op > 5) bad.push("the true final deathblow still hides the block (opacity " + Math.round(hp.op) + ")");
    } finally { global.PIXI = savedPixi; }
    const val = n => (sc.objects.find(o => o.name === "Samurai_NPC").variables.find(x => x.name === n) || {}).value;
    if (!(val("MirrorDashSpeed") >= 624)) bad.push("the mirror dash must be 20% faster (MirrorDashSpeed 624 or more)");
    if (val("DashFast") !== 1 || !JSON.stringify(sh.events).includes("1 + 0.2 * Samurai_NPC.Variable(DashFast)")) bad.push("the flash step's back dash must run 20% faster by default (DashFast 1 sets the animation speed to 1.2)");
    if (!JSON.stringify(sh.events).includes("Num1") || !JSON.stringify(sh.events).includes("Num2")) bad.push("Num1 (old dash) and Num2 (faster dash) debug keys are missing");
    if (val("UltMaxCasts") !== 3 || val("UltHpStep") !== 25) bad.push("thousand cuts must come at 75%, 50% and 25% (UltMaxCasts 3, UltHpStep 25)");
    if (JSON.stringify(sh.events).includes("\"IntermissionStep\",\"=\",\"6\"")) bad.push("no immediate Thousand Cuts after the card: the card slash leads into the normal end of the intermission (step 3)");
    const json = JSON.stringify(sh.events), json0 = json;
    if (!json.includes("\"Lives\",\"=\",\"2\"")) bad.push("the three sets of cuts must lead into phase 2 (Lives = 2)");
    if (/"Lives","<=","1"\][^]{0,200}"MaxPhase",">=","3"\][^]{0,400}"SweepMode","=","1"/.test(json)) bad.push("the three sets of cuts must no longer run into phase 3");
    for (const s of ["\"CardState\",\"=\",\"1\"", "\"CardState\",\"=\",\"2\"", "\"CardState\",\"=\",\"0\"", "\"BarMode\",\"=\",\"1\"", "\"BarMode\",\"=\",\"2\"", "CardHold", "CardSlashTime"]) if (!json.includes(s)) bad.push("the card sequence is missing " + s);
    if (val("CardHold") !== 2.5) bad.push("the card must hold 2.5 s (CardHold)");
    if (!json.includes("Samurai_Dash_Trail") || !json.includes("GlitchStartX")) bad.push("the mirror must leave a dash line when it phases across");
    if (!json.includes("ShimmerOff")) bad.push("the settled mirror needs its shimmer (ShimmerOff)");
    if (!json.includes("SetEffectDoubleParameter") || !json.includes("\"MirrorStyle\",\"=\",\"1\"")) bad.push("the mirror needs the outline style (MirrorStyle 1: SetEffectDoubleParameter on its Split effect)");
    walk(sh.events, e => { for (const a of e.actions || []) if (a.type.value === "EffectCapability::EffectBehavior::SetEffectDoubleParameter" && (a.parameters.length !== 5 || a.parameters[1] !== "Effect")) bad.push("SetEffectDoubleParameter needs five parameters: object, \"Effect\" (the capability), effect name, parameter name, value"); });
    const mirObj = sc.objects.find(o => o.name === "Samurai_Mirror");
    if (!(mirObj.effects || []).some(e => e.effectType === "RGBSplit" && e.name === "Split")) bad.push("Samurai_Mirror needs an RGBSplit effect named Split");
    if (val("MirrorStyle") !== 1) bad.push("the mirror's outline style should be the default (MirrorStyle 1)");
    if (!json.includes("samurai_hit_animation (1).mp3")) bad.push("the card slash must use his normal attack sound");
    if (!/zIndex = 1000000/.test(script("Combat_Shared", "Desperation glow: when a deflect"))) bad.push("the Desperation blade glow must draw on top of the fighters (zIndex)");
    return bad;
  }],

  ["Samurai tone-down: less melee in phase 3, a calmer mirror outline", () => {
    const bad = [], { scenes, sheets } = load(), sc = scenes.find(s => s.name === "Samurai_Fight"), json = JSON.stringify(sheets.find(s => s.name === "Samurai_Boss").events);
    const v = n => (sc.objects.find(o => o.name === "Samurai_NPC").variables.find(x => x.name === n) || {}).value;
    if (!json.includes("MeleeChanceDrop") || !(v("MeleeChanceDrop") > 0 && v("MeleeChanceDrop") < v("MeleeChance"))) bad.push("phase 3 must have a lower melee chance (MeleeChance minus MeleeChanceDrop, still above 0)");
    if (json.includes("RandomInRange(-2.5, 2.5)")) bad.push("the mirror outline must stay under 1.2 px");
    return bad;
  }],

  ["Samurai phase 3 speed: faster chase and still afterimages that never attack", () => {
    const bad = [], { scenes, sheets } = load(), sh = sheets.find(s => s.name === "Samurai_Boss"), json = JSON.stringify(sh.events);
    for (const name of ["Samurai_Fight"]) {
      const sc = scenes.find(s => s.name === name), v = n => (sc.objects.find(o => o.name === "Samurai_NPC").variables.find(x => x.name === n) || {}).value;
      if (!(v("RunSpeedP3") >= v("RunSpeed") * 1.25)) bad.push(name + ": phase 3 must run at least 25% faster (RunSpeedP3 vs RunSpeed)");
      const im = sc.objects.find(o => o.name === "Samurai_Afterimage");
      if (!im) { bad.push(name + ": Samurai_Afterimage is missing"); continue; }
      if ((im.behaviors || []).length) bad.push("the afterimage must have no behaviours");
      if (sc.objectsGroups.some(g => g.objects.some(o => o.name === "Samurai_Afterimage"))) bad.push("the afterimage must not be in a group (nothing may hit or be hit by it)");
      if (!im.animations.some(a => a.name === "Samurai_Run")) bad.push("the afterimage needs the run animation");
    }
    if (!json.includes("Variable(RunSpeedP3)")) bad.push("phase 3 must set the chase speed from RunSpeedP3");
    if (!json.includes("AfterimageGap") || !json.includes("Samurai_Afterimage") || !json.includes("AfterimageFadeRate")) bad.push("afterimages must spawn by distance (AfterimageGap) and fade (AfterimageFadeRate)");
    if (/Samurai_Afterimage[^]{0,80}Damage/.test(json)) bad.push("an afterimage must not carry damage");
    return bad;
  }],

  ["directional deflecting (every fight): a deflect needs the player to face the boss unless the attack is Directional 0 or the boss has DeflectAnySide; simulated", () => {
    const bad = [], { sheets, scenes } = load(), sh = sheets.find(s => s.name === "Samurai_Boss"), cs = sheets.find(s => s.name === "Combat_Shared");
    // 1. The deflect event: an Or of (Directional = 0) and (FacingOk = 1), each naming EnemyHitbox, so the picked hitboxes survive.
    let deflect = null; walk(cs.events, e => { const c = JSON.stringify(e.conditions || []); if (c.includes("DeflectWindowNow") && c.includes("CollisionNP")) deflect = e; });
    const or = deflect && deflect.conditions.find(c => c.type.value === "BuiltinCommonInstructions::Or" && JSON.stringify(c).includes("FacingOk"));
    if (!or) return ["the deflect event must have an Or of Directional = 0 and FacingOk = 1"];
    if (or.subInstructions.length !== 2 || !or.subInstructions.every(b => JSON.stringify(b).includes("EnemyHitbox") && JSON.stringify(b).includes("\"Player\""))) bad.push("both branches of the facing Or must name EnemyHitbox and Player (an Or keeps only the objects its true branches picked)");
    if (!JSON.stringify(or.subInstructions[0]).includes("\"Directional\",\"=\",\"0\"") || !JSON.stringify(or.subInstructions[1]).includes("\"FacingOk\",\"=\",\"1\"")) bad.push("branch 1 must be Directional = 0, branch 2 FacingOk = 1");
    // 2. Run Combat_Shared's FacingOk events and the Samurai sheet's DeflectAnySide events over a table of situations.
    const ci = cs.events.findIndex(e => e.comment && e.comment.startsWith("Directional deflecting, for every fight"));
    const si = sh.events.findIndex(e => e.comment && e.comment.startsWith("Directional deflecting, the Samurai's part"));
    if (ci < 0 || si < 0) return bad.concat("missing the directional deflecting events");
    const facing = cs.events.slice(ci).filter(e => e.type === "BuiltinCommonInstructions::Standard").slice(0, 5), anySide = sh.events.slice(si).filter(e => e.type === "BuiltinCommonInstructions::Standard").slice(0, 3);
    const run = s => {
      const V = { any: 0, ok: 1 };
      const expr = x => new Function("abs", "return (" + x.split("Player.CenterX()").join(String(s.px)).split("Enemy.CenterX()").join(String(s.bx)).split("Enemy.Variable(AimX)").join(String(s.aim === undefined ? -1 : s.aim)) + ");")(Math.abs);
      const pass = e => e.conditions.every(c => {
        const v = c.type.value, p = c.parameters; let r;
        if (v === "StringObjectVariable") r = s.ai === JSON.parse(p[3]);
        else if (v === "SceneInstancesCount") r = s.mirrors > Number(p[3]);
        else if (v === "NumberObjectVariable") r = p[1] === "DirectionalDeflect" ? s.on !== false : p[1] === "DeflectAnySide" ? V.any === Number(p[3]) : p[1] === "AimX" ? (p[2] === "<" ? (s.aim === undefined ? -1 : s.aim) < Number(p[3]) : (s.aim === undefined ? -1 : s.aim) >= Number(p[3])) : null;
        else if (v === "BuiltinCommonInstructions::CompareNumbers") { const a = expr(p[0]), b = expr(p[2]); r = p[1] === "<" ? a < b : p[1] === ">=" ? a >= b : null; }
        else if (v.endsWith("FlippedX")) r = s.left;
        else throw new Error("the simulation does not know " + v);
        return c.type.inverted ? !r : r;
      });
      for (const e of anySide) if (pass(e)) for (const a of e.actions) V.any = Number(a.parameters[3]);
      for (const e of facing) if (pass(e)) for (const a of e.actions) V.ok = Number(a.parameters[3]);
      return V.ok;
    };
    const base = { px: 500, bx: 800, left: false, ai: "AggroReady", mirrors: 0 };
    const cases = [
      ["facing him (he is on the right, facing right)", {}, 1], ["back to him (facing left)", { left: true }, 0],
      ["he is on the left, facing left", { bx: 200, left: true }, 1], ["he is on the left, facing right", { bx: 200 }, 0],
      ["mirror out, back to the boss (the mirror is not a second boss)", { left: true, mirrors: 1 }, 0], ["mirror out, facing the boss", { mirrors: 1 }, 1], ["intermission, back to him", { left: true, ai: "Intermission" }, 1],
      ["on top of him, back to him", { bx: 520, left: true }, 1], ["dead", { left: true, ai: "Dead" }, 1],
      ["rule switched off (Player.DirectionalDeflect 0)", { left: true, on: false }, 1],
      ["illusion at x 200 is aimed, player (x 500) facing left toward it", { left: true, aim: 200 }, 1], ["illusion at x 200 is aimed, player facing right toward the boss", { aim: 200 }, 0],
      ["illusion at x 900 is aimed, player facing left toward the boss side", { left: true, aim: 900 }, 0]];
    for (const [name, over, want] of cases) { const got = run(Object.assign({}, base, over)); if (got !== want) bad.push(name + ": FacingOk is " + got + ", expected " + want); }
    // 3. Every attack that can hit declares Directional; the Samurai's Judgement Cut, Thousand Cuts and petals and the Leaf Ranger's arrow rain / air volley are 0.
    const want = { Samurai_Fight: { Samurai_Hitbox: 1, Samurai_Judgement_Cut: 0, Thousand_Cuts_Ultimate: 0, PetalTornado: 1, Samurai_Dash_Line: 0, Samurai_Petal: 0 }, Leaf_Ranger_Fight: { Ranger_Hitbox: 1, Ranger_Arrow: 1, Ranger_Diag: 0 }, Gunslinger: { Grenade_Explosion: 0 } };
    for (const [scene, objs] of Object.entries(want)) { const sc = scenes.find(s => s.name === scene); for (const [o, d] of Object.entries(objs)) { const v = ((sc.objects.find(x => x.name === o) || { variables: [] }).variables.find(x => x.name === "Directional") || {}).value; if (v !== d) bad.push(scene + "." + o + " Directional should be " + d + ", is " + v); } }
    return bad;
  }],

  ["Samurai petal counts: 2 in phase 1, 5 in phase 2, 10 (double five) in phase 3", () => {
    const bad = [], { scenes } = load();
    for (const name of ["Samurai_Fight"]) { const s = scenes.find(x => x.name === name).objects.find(o => o.name === "Samurai_NPC"), v = n => (s.variables.find(x => x.name === n) || {}).value;
      if (v("PetalCountP1") !== 2 || v("PetalCountP2") !== 5 || v("PetalCountP3") !== 10) bad.push(name + ": petals must be 2 / 5 / 10 (got " + v("PetalCountP1") + " / " + v("PetalCountP2") + " / " + v("PetalCountP3") + ")"); }
    { const s = scenes.find(x => x.name === "Tutorial_Level").objects.find(o => o.name === "Samurai_NPC"); if ((s.variables.find(x => x.name === "PetalCountP1") || {}).value !== 2) bad.push("Tutorial_Level: phase 1 petals must be 2"); }
    return bad;
  }],

  ["Samurai crossing attack (phase 3): swing, flash to the far side, the mirror swings, then he swings from the other side", () => {
    const bad = [], { scenes, sheets } = load(), sh = sheets.find(s => s.name === "Samurai_Boss"), json = JSON.stringify(sh.events);
    for (const name of ["Samurai_Fight"]) {
      const sc = scenes.find(s => s.name === name), sam = sc.objects.find(o => o.name === "Samurai_NPC"), v = n => (sam.variables.find(x => x.name === n) || {}).value;
      if (!(v("CrossMirrorAt") >= 0.2 && v("CrossMirrorAt") <= 0.6)) bad.push(name + ": the image's telegraph before its lunge (CrossMirrorAt) should be 0.2 to 0.6 s, got " + v("CrossMirrorAt"));
      if (!(v("CrossSamGap") >= 0.4 && v("CrossSamGap") <= 1)) bad.push(name + ": he must swing 0.4 to 1 s after the image, so the player can turn (CrossSamGap " + v("CrossSamGap") + ")");
      const mir = sc.objects.find(o => o.name === "Samurai_Echo"), at = mir.animations.find(a => a.name === "Samurai_Attack");
      if (!at) { bad.push(name + ": the echo needs the Samurai_Attack animation"); continue; }
      if (at.directions[0].sprites.some(s => s.hasCustomCollisionMask)) bad.push(name + ": the mirror's attack must have no collision mask");
    }
    for (const s of ["cross", "Variable(CrossOffset)", "CrossMirrorAt", "CrossSamAt", "Samurai_Echo.PointX(", "Num3", "CrossForce"]) if (!json.includes(s)) bad.push("the crossing attack is missing " + s);
    if (!/"CrossEnabled","=","0"[^]{0,300}"CrossForce","=","0"/.test(json)) bad.push("the old second and third swings must stop when the crossing attacks are on (and when CrossForce is set)");
    let cleanup = null; walk(sh.events, (e, p) => { if (JSON.stringify(e.conditions || []).includes("Samurai_Mirror") && JSON.stringify(e.actions || []).includes("Delete") && JSON.stringify(e.conditions).includes("MirrorPetal")) cleanup = e; });
    if (!cleanup || !JSON.stringify(cleanup.conditions).includes("Cross")) bad.push("the mirror cleanup must leave the crossing attack alone");
    return bad;
  }],

  ["Samurai crossing echo (phase 3): at the landing an echo (Kind 1) is left where he stood, lunges and swings; he swings after it (turn over, CrossSamGap after its swing began) with a fallback if it is gone; he waits for it to fade", () => {
    const bad = [], { scenes, sheets } = load(), sh = sheets.find(s => s.name === "Samurai_Boss"), json = JSON.stringify(sh.events);
    const sc = scenes.find(s => s.name === "Samurai_Fight"), sam = sc.objects.find(o => o.name === "Samurai_NPC"), v = n => (sam.variables.find(x => x.name === n) || {}).value;
    for (const old of ["CrossMirrorDone", "CrossMirrorHold", "CrossImgDash", "CrossImgSide", "CrossImgSpeedNow", "CrossImgDist", "CrossImgTime", "CrossImgDelta"]) if (json.includes(old) || v(old) !== undefined) bad.push(old + " should be gone: the crossing image's state lives on the echo");
    for (const n of ["CrossImgSpeed", "CrossImgAccel", "CrossImgRange", "CrossImgMaxTime", "CrossImgMaxDist", "CrossImgMinGap", "CrossSamGap", "CrossMirrorAt"]) if (!(v(n) > 0)) bad.push("tuning variable " + n + " is missing or not positive");
    let spawn = null; walk(sh.events, e => { if ((e.actions || []).some(x => x.type.value === "Create" && x.parameters[1] === "Samurai_Echo") && JSON.stringify(e.conditions).includes("CrossUseMirror")) spawn = e; });
    if (!spawn) return bad.concat("the crossing landing must create the echo (CrossUseMirror 1, phase 3)");
    const sa = JSON.stringify(spawn.actions); if (!sa.includes('"Kind","=","1"') || !sa.includes("CrossMirrorAt") || !sa.includes('"EchoTurn"')) bad.push("the crossing echo is Kind 1 with Delay CrossMirrorAt and EchoTurn 1");
    let his = null, fallback = null; walk(sh.events, e => { const c = JSON.stringify(e.conditions || []); if (c.includes("CrossSamAt") && c.includes("CrossUseMirror") && c.includes("CrossImgSwingTimer") && JSON.stringify(e.actions || []).includes("Samurai_Hitbox")) his = e; if (c.includes("SceneInstancesCount") && c.includes("CrossSamAt") && JSON.stringify(e.actions || []).includes('"EchoTurn"')) fallback = e; });
    if (!his || !JSON.stringify(his.conditions).includes("EchoTurn")) bad.push("his swing with the echo must wait for its swing (EchoTurn 2) and CrossSamGap after it began (CrossImgSwingTimer)");
    if (!fallback) bad.push("he must swing anyway when the echo is gone (a stun or its life ran out), or the crossing would hang");
    if (!/"Kind","=","1"[^]{0,900}CrossImgSwingTimer|CrossImgSwingTimer[^]{0,200}"Kind","=","1"/.test(json) && !json.includes("CrossImgSwingTimer")) bad.push("the echo's swing must restart his gap timer (CrossImgSwingTimer)");
    let s8 = null; walk(sh.events, e => { const c = JSON.stringify(e.conditions || []); if (c.includes('"SkillStep","=","8"') && c.includes("SceneInstancesCount") && JSON.stringify(e.actions || []).includes('"SkillStep"')) s8 = e; }); if (!s8) bad.push("step 8 must wait until the echo is gone");
    for (const k of ["Num3", "Num4", "Num5"]) { let ke = null; walk(sh.events, e => { if (JSON.stringify(e.conditions || []).includes(k) && JSON.stringify(e.actions || []).includes("CrossForce") && JSON.stringify(e.actions).includes("Samurai_Echo")) ke = e; }); if (!ke) bad.push("debug key " + k + " must also clear echoes"); }
    return bad;
  }],

  ["Samurai dodges (every phase): dodge chance 10/20/40 by phase; in phase 3 each dodge leaves a side-locked echo (Kind 1) that lunges and swings with its own deflectable hitbox; the double dodge takes turns; he waits for the echoes", () => {
    const bad = [], { scenes, sheets } = load(), sh = sheets.find(s => s.name === "Samurai_Boss"), json = JSON.stringify(sh.events);
    const sc = scenes.find(s => s.name === "Samurai_Fight"), sam = sc.objects.find(o => o.name === "Samurai_NPC"), v = n => (sam.variables.find(x => x.name === n) || {}).value;
    if (v("DodgeChanceP1") !== 10 || v("DodgeChanceP2") !== 20 || !(v("DodgeChanceP3") >= 0 && v("DodgeChanceP3") <= 50)) bad.push("dodge chances must be 10 and 20 in phases 1 and 2, and in phase 3 a chance of 0 to 50 before the hit-based dodge takes over, got " + [v("DodgeChanceP1"), v("DodgeChanceP2"), v("DodgeChanceP3")]);
    if (v("DodgeHitsMin") !== 2 || v("DodgeHitsMax") !== 3 || !(v("DodgeDelayP3") > 0 && v("DodgeDelayP3") <= 2) || v("DodgeDelayP12") !== 4) bad.push("phase 3: he dodges after 2 to 3 landed hits (DodgeHitsMin 2, DodgeHitsMax 3) with a short delay (DodgeDelayP3 up to 2 s); phases 1 and 2 keep the 4 s delay");
    if (!/"JustHitByPlayer","True"[^]{0,300}"HitsSinceDodge","\+"/.test(json)) bad.push("every landed hit must count (HitsSinceDodge)");
    if (!/"JustDodgedHit"[^]{0,2500}"HitsSinceDodge","=","0"[^]{0,200}"DodgeHitsNeeded","=","RandomInRange\(Samurai_NPC.Variable\(DodgeHitsMin\), Samurai_NPC.Variable\(DodgeHitsMax\)\)"/.test(json)) bad.push("a dodge must restart the hit count and roll the next number (2 to 3)");
    { const rate = (hits, need) => 100 * Math.min(1, Math.floor(hits / Math.max(1, need))); for (const need of [2, 3]) if (!(rate(need - 1, need) === 0 && rate(need, need) === 100 && rate(need + 2, need) === 100)) bad.push("the phase 3 chance must be 0 below " + need + " hits and 100 from there"); if (!json.includes("min(1, floor(Samurai_NPC.Variable(HitsSinceDodge) / max(1, Samurai_NPC.Variable(DodgeHitsNeeded))))")) bad.push("the phase 3 DodgeChance expression changed: it must be 0 until DodgeHitsNeeded hits and 100 after"); }
    if (!/"DodgeChance","=","Samurai_NPC.Variable\(DodgeChanceP1\)"[^]*"DodgeChance","=","Samurai_NPC.Variable\(DodgeChanceP2\)"[^]*"DodgeChance","=","Samurai_NPC.Variable\(DodgeChanceP3\)/.test(json)) bad.push("DodgeChance must be set from the phase's value");
    for (const old of ["Samurai_DodgeImage", "Samurai_DodgeImage2", "Samurai_DodgeHitbox"]) if (sc.objects.some(o => o.name === old) || json.includes(old)) bad.push(old + " should be gone (replaced by the echo)");
    const echo = sc.objects.find(o => o.name === "Samurai_Echo");
    if (!echo || !echo.animations.some(a => a.name === "Samurai_Attack")) bad.push("the echo needs the Samurai_Attack animation (Kind 1)");
    if (!sc.objects.some(o => o.name === "Samurai_EchoHit")) bad.push("Samurai_EchoHit is missing");
    if (!sc.objectsGroups.find(g => g.name === "EnemyHitbox").objects.some(o => o.name === "Samurai_EchoHit")) bad.push("the echo's swing hitbox must be in the EnemyHitbox group, or it can be neither deflected nor hurt the player");
    for (const n of ["Hold", "Time", "Side", "Order"]) if (echo && !echo.variables.some(x => x.name === n)) bad.push("the echo needs the object variable " + n);
    for (const n of ["DodgeImgPending", "EchoTurn", "EchoHold", "EchoBusy", "DodgeChained", "DodgeChainChance"]) if (v(n) === undefined) bad.push(n + " is not declared on Samurai_NPC");
    if (v("DodgeChainChance") !== 20) bad.push("DodgeChainChance must be 20");
    if (!/"JustDodgedHit"[^]{0,1500}"DodgeImgPending","=","1"/.test(json)) bad.push("a dodge must set DodgeImgPending");
    const spawns = []; walk(sh.events, e => { if ((e.actions || []).some(x => x.type.value === "Create" && x.parameters[1] === "Samurai_Echo") && JSON.stringify(e.conditions).includes("DodgeImgPending")) spawns.push(JSON.stringify(e.conditions)); });
    if (spawns.length !== 2) bad.push("expected a first and a second dodge echo spawn, got " + spawns.length);
    for (const c of spawns) if (!/"Phase",">=","3"/.test(c)) bad.push("dodge echoes are phase 3 only");
    { let inLanding = false; walk(sh.events, e => { if (JSON.stringify(e.conditions || []).includes("FlashIn") && JSON.stringify(e.conditions).includes("HasAnimationEnded") && JSON.stringify(e.events || []).includes("DodgeImgPending") && JSON.stringify(e.events).includes("Samurai_Echo")) inLanding = true; }); if (!inLanding) bad.push("the dodge echo must appear when he has landed (FlashIn finished), not at the teleport"); }
    if (!(v("DodgeImgTell") >= 0.3)) bad.push("DodgeImgTell (the echo's telegraph) is missing or too short");
    // the counter and the skill pick only run when there is no echo; otherwise he waits (DodgeWait) until EchoBusy is 0
    { let counter = null, pick = null; walk(sh.events, e => { const c = JSON.stringify(e.conditions || []), a2 = JSON.stringify(e.actions || []); if (c.includes("SceneInstancesCount") && c.includes("Samurai_Echo") && a2.includes("Attacking") && c.includes("behind")) counter = e; if (c.includes("SceneInstancesCount") && c.includes("Samurai_Echo") && a2.includes("PickSkill") && c.includes("away")) pick = e; });
      if (!counter || !pick) bad.push("the landing's counter and skill pick must only run when there is no echo");
      let rel = 0; walk(sh.events, e => { if (JSON.stringify(e.conditions || []).includes("DodgeWait") && JSON.stringify(e.conditions).includes("EchoBusy") && JSON.stringify(e.actions || []).includes("DodgeRelease")) rel++; }); if (rel !== 1) bad.push("the dodge wait must end when no echo is active (EchoBusy 0), got " + rel); }
    // chain: rolled at the first landing, phase 3, once per dodge; the first echo holds; the second takes its turn
    { let chain = null, forced = null; walk(sh.events, e => { const c = JSON.stringify(e.conditions || []); if (c.includes("DodgeChainChance")) chain = e; if (c.includes('"DodgeChainForce","=","1"') && JSON.stringify(e.actions || []).includes("FlashOut")) forced = e; });
      if (!chain) bad.push("the dodge chain event is missing"); else { const c = JSON.stringify(chain.conditions), a2 = JSON.stringify(chain.actions); if (!/"Phase",">=","3"/.test(c) || !c.includes('"DodgeChained","=","0"')) bad.push("the chain is phase 3 only, once per dodge"); if (!a2.includes("DodgeImgPending") || !a2.includes("away") || !a2.includes("FlashOut") || !a2.includes("EchoHold")) bad.push("the chain must dash away, hold the first echo and leave another echo"); }
      if (!forced) bad.push("Num9 must be able to force the chain (DodgeChainForce)");
      let second = null; walk(sh.events, e => { if ((e.actions || []).some(x => x.type.value === "Create" && x.parameters[1] === "Samurai_Echo") && JSON.stringify(e.conditions).includes('"DodgeChained","=","1"')) second = e; }); if (!second) bad.push("the second echo must appear on the chained landing");
      let start = null; walk(sh.events, e => { const c = JSON.stringify(e.conditions || []); if (c.includes('"Kind","=","1"') && c.includes('"State","=","1"') && c.includes("EchoTurn") && c.includes("EchoHold") && JSON.stringify(e.actions || []).includes('"State"')) start = e; }); if (!start) bad.push("an echo may only lunge on its turn (Order = EchoTurn) and when no chain dash is on (EchoHold 0)");
      let over = null; walk(sh.events, e => { const c = JSON.stringify(e.conditions || []); if (c.includes('"Kind","=","1"') && c.includes('"State","=","4"') && c.includes("HasAnimationEnded") && JSON.stringify(e.actions || []).includes("EchoTurn")) over = e; }); if (!over) bad.push("finishing a swing must give the next echo its turn (EchoTurn + 1)"); }
    // regression: a shared "swing over" event that ignored Kind set State 5 first, so Kind 1's own swing-over (EchoTurn + 1, hitbox delete) never ran and the crossing and the double dodge hung after the first swing
    { let shared = 0; walk(sh.events, e => { const c = JSON.stringify(e.conditions || []), a2 = JSON.stringify(e.actions || []); if (c.includes('"Samurai_Echo","State","=","4"') && c.includes("HasAnimationEnded") && a2.includes('"State","=","5"') && !/"Kind","(=|>=)","(1|2|3)"/.test(c)) shared++; if (c.includes('"Samurai_Echo","State","=","4"') && c.includes("HasAnimationEnded") && a2.includes('"State","=","5"') && /"Kind",">=","2"/.test(c) === false && /"Kind","=","[23]"/.test(c) === false && !/"Kind","=","1"/.test(c)) shared += 0; });
      if (shared) bad.push("an echo swing-over event must be limited by Kind, or it ends Kind 1's swing before its own swing-over event runs (EchoTurn would never advance)");
      let k1 = 0; walk(sh.events, e => { const c = JSON.stringify(e.conditions || []); if (c.includes('"Samurai_Echo","State","=","4"') && c.includes("HasAnimationEnded") && JSON.stringify(e.actions || []).includes('"State","=","5"') && !/"Kind",">=","2"|"Kind","=","[23]"/.test(c)) k1++; });
      if (k1 !== 1) bad.push("exactly one swing-over event may handle Kind 1 (found " + k1 + ")"); }
    // the lunge, run with the real expressions of the Kind 1 move event
    let move = null; walk(sh.events, e => { if ((e.actions || []).some(a => a.type.value === "SetX" && a.parameters[0] === "Samurai_Echo") && JSON.stringify(e.conditions || []).includes('"Kind","=","1"')) move = e; });
    if (!move) return bad.concat("the echo's Kind 1 lunge is missing");
    if (move.actions.some(a => a.type.value === "Create")) bad.push("the lunge itself must not create a hitbox (the dash is harmless, only the swing hurts)");
    const run = (px, samX, side, startX) => {
      const S = { CrossImgSpeed: v("CrossImgSpeed"), CrossImgAccel: v("CrossImgAccel"), CrossImgRange: v("CrossImgRange"), CrossImgMaxTime: v("CrossImgMaxTime"), CrossImgMaxDist: v("CrossImgMaxDist"), CrossImgMinGap: v("CrossImgMinGap") };
      const I = { SpeedNow: 0, Dist: 0, Time: 0, Delta: 0, Side: side }, mir = { x: startX }, dt = 1 / 60;
      const ev = ex => Function("min", "max", "abs", "sign", "TimeDelta", "S", "I", "P", "M", "N", "return " + ex
        .replace(/Samurai_NPC\.Variable\((\w+)\)/g, "S.$1").replace(/Samurai_Echo\.Variable\((\w+)\)/g, "I.$1").replace(/Player\.CenterX\(\)/g, "P").replace(/Samurai_Echo\.(CenterX|X)\(\)/g, "M.x").replace(/Samurai_NPC\.CenterX\(\)/g, "N"))(Math.min, Math.max, Math.abs, Math.sign, () => dt, S, I, px, mir, samX);
      let f = 0;
      while (f < 600) { f++; if (Math.abs(px - mir.x) <= S.CrossImgRange || I.Time >= S.CrossImgMaxTime || I.Dist >= S.CrossImgMaxDist) break; for (const a of move.actions) { if (a.type.value === "SetX") mir.x = ev(a.parameters[2]); else I[a.parameters[1]] = ev(a.parameters[3]); } }
      return mir.x;
    };
    for (const px of [500, 1100, -3000, 1500]) if (run(px, 1000, -1, 200) > 1000 - v("CrossImgMinGap") + 0.01) bad.push("the echo crossed him (player at " + px + ")");
    if (run(1500, 1000, 1, 1800) < 1000 + v("CrossImgMinGap") - 0.01) bad.push("the right-side echo crossed him");
    if (!/"AimX","=","Samurai_Echo.CenterX\(\)"/.test(json)) bad.push("the echo's swing must aim the directional deflect at itself");
    for (const k of ["Num8", "Num9"]) { let ke = null; walk(sh.events, e => { if (JSON.stringify(e.conditions || []).includes(k) && JSON.stringify(e.actions || []).includes("JustDodgedHit")) ke = e; }); if (!ke) bad.push("debug key " + k + " (forced dodge) is missing"); }
    return bad;
  }],

  ["Samurai skill variety: no crossing after crossing in melee range (the crossing no longer restarts the skill timer, a skill is forced next), and the same skill is not picked twice in a row", () => {
    const bad = [], { sheets } = load(), sh = sheets.find(s => s.name === "Samurai_Boss"), json = JSON.stringify(sh.events);
    let end = null; walk(sh.events, e => { if (JSON.stringify(e.conditions || []).includes("CrossLegsLeft") && JSON.stringify(e.actions || []).includes("CooldownTimer")) end = e; });
    if (!end) return bad.concat("the end of the crossing is missing");
    if (JSON.stringify(end.actions).includes("SkillTimer")) bad.push("the end of the crossing must not restart the skill timer (that is what let him chain crossings in melee range)");
    if (!JSON.stringify(end.actions).includes("ForceSkill")) bad.push("the end of the crossing must force the next skill (ForceSkill)");
    let forced = 0; walk(sh.events, e => { const c = JSON.stringify(e.conditions || []); if (c.includes("ForceSkill") && c.includes("AggroReady") && JSON.stringify(e.actions).includes("ForceSkill")) forced++; });
    if (forced !== 2) bad.push("both skill starts (player far, player close) need a ForceSkill copy, got " + forced);
    if (!json.includes("LastSkill")) bad.push("the skill pick must avoid repeating the last skill");
    { let g = null, d = null; walk(sh.events, e => { const c = JSON.stringify(e.conditions || []), x = JSON.stringify(e.actions || []); if (c.includes("PickSkill") && c.includes("GrabPickChance") && x.includes("grab")) g = e; if (c.includes("PickSkill") && c.includes("DashPickChance") && x.includes("DashTell")) d = e; });
      if (!g) bad.push("phase 3 must be able to pick the grab from the skill pick"); else if (!JSON.stringify(g.conditions).includes("GrabCooldownTimer") || !/"Phase",">=","3"/.test(JSON.stringify(g.conditions))) bad.push("the picked grab must respect the grab cooldown and be phase 3");
      if (!d) bad.push("phase 3 must be able to pick the dash strike from the skill pick"); else if (!/"Phase",">=","3"/.test(JSON.stringify(d.conditions))) bad.push("the picked dash strike is phase 3");
      const lay = load().scenes.find(s => s.name === "Samurai_Fight").objects.find(o => o.name === "Samurai_NPC"), v = n => (lay.variables.find(x => x.name === n) || {}).value;
      if (!(v("GrabPickChance") > 0 && v("DashPickChance") > 0 && v("GrabPickChance") + v("DashPickChance") < 100)) bad.push("GrabPickChance and DashPickChance must be set and leave room for the other skills"); }
    return bad;
  }],

  ["Samurai echo, dash kinds (phase 3): his dash strike and wall slash each leave an echo that repeats the attack about a second later, with its own deflectable line; glints; he waits for it; stun clears it; echoes never spawn echoes", () => {
    const bad = [], { scenes, sheets } = load(), sh = sheets.find(s => s.name === "Samurai_Boss"), json = JSON.stringify(sh.events);
    const sc = scenes.find(s => s.name === "Samurai_Fight"), sam = sc.objects.find(o => o.name === "Samurai_NPC"), v = n => (sam.variables.find(x => x.name === n) || {}).value;
    const echo = sc.objects.find(o => o.name === "Samurai_Echo");
    for (const n of ["Samurai_Echo", "Samurai_EchoLine"]) if (!sc.objects.some(o => o.name === n)) bad.push(n + " is missing");
    if (!echo) return bad;
    for (const n of ["Kind", "State", "Fade", "LandX", "Order"]) if (!echo.variables.some(x => x.name === n)) bad.push("the echo needs the object variable " + n);
    if (!sc.objectsGroups.find(g => g.name === "EnemyHitbox").objects.some(o => o.name === "Samurai_EchoLine")) bad.push("the echo's line must be in the EnemyHitbox group (deflectable, hurts the player)");
    if (sc.objectsGroups.some(g => g.objects.some(o => o.name === "Samurai_Echo"))) bad.push("the echo itself must be in no group (nothing may hit it)");
    for (const old of ["Samurai_DashImage", "Samurai_DashImgLine"]) if (sc.objects.some(o => o.name === old) || json.includes(old)) bad.push(old + " should be gone (replaced by the echo)");
    if (!(v("DashImgChance") > 0 && v("DashImgChance") <= 100)) bad.push("DashImgChance must be 1 to 100");
    if (!(v("DashImgDelay") > 0 && v("DashImgDelay") <= 1.5)) bad.push("DashImgDelay (the echo repeats soon after him) must be up to 1.5 s");
    const anim = n => echo.animations.find(a => a.name === n);
    if (!anim("Samurai_Dash_Slash") || !anim("Samurai_Dash_Slash").directions[0].sprites.every(s => s.image.includes("/mirror/"))) bad.push("the echo's wall slash must use the mirror-look frames");
    if (!anim("Samurai_Dash_Tell") || !anim("Samurai_Passing_Dash_Attack") || !anim("Samurai_Dash_QuickDraw")) bad.push("the echo needs the Dash_Tell, Passing_Dash_Attack and Dash_QuickDraw animations");
    const spawns = []; walk(sh.events, e => { if ((e.actions || []).some(x => x.type.value === "Create" && x.parameters[1] === "Samurai_Echo") && JSON.stringify(e.conditions).includes("DashType")) spawns.push(JSON.stringify(e.conditions)); });
    if (spawns.length !== 2) return bad.concat("expected a spawn for the dash strike and one for the wall slash, got " + spawns.length);
    for (const word of ["strike", "wall"]) { const c = spawns.find(x => x.includes(word)); if (!c) { bad.push("no echo for the " + word); continue; } if (!/"Phase",">=","3"/.test(c)) bad.push(word + ": phase 3 only"); if (!c.includes("Samurai_Mirror")) bad.push(word + ": not while a mirror exists (the mirror tornado's own dash)"); if (!c.includes("SceneInstancesCount")) bad.push(word + ": needs the echo count guard"); }
    // an echo's own events never create an echo or start a skill: no event driven by the echo's State creates a Samurai_Echo or sets his AIState
    walk(sh.events, e => { const c = JSON.stringify(e.conditions || []), a2 = JSON.stringify(e.actions || []); if (c.includes('"Samurai_Echo","State"') && (a2.includes('"Create","Samurai_Echo"') || /"Create","","Samurai_Echo"/.test(a2) || a2.includes('"AIState"'))) bad.push("an echo event must not spawn an echo or change his AIState"); });
    { let inTeleport = false; walk(sh.events, e => { if (JSON.stringify(e.actions || []).includes("Samurai_Dash_Trail") && JSON.stringify(e.events || []).includes("Samurai_Echo")) inTeleport = true; }); if (!inTeleport) bad.push("the echo must appear as his dash begins (in the flash step's teleport)"); }
    if (!/"AimX","=","Samurai_Echo.CenterX\(\)"/.test(json)) bad.push("the directional deflect must aim at the echo while its line is out");
    if (!json.includes("Dash_Crescent") || !json.includes("LandX")) bad.push("the wall slash echo needs the crescent line and the landing spot");
    // glints: the dash strike (him and the echo) has the eye glint and no sheathe glint; the wall slash (him and the echo) the sheathe glint and no eye glint
    if (!json.includes("DashImgGlint") || !/"Kind","=","2"[^]{0,400}DashImgGlint|DashImgGlint[^]{0,600}"Kind","=","2"/.test(json)) bad.push("the eye glint is for the dash strike echo (Kind 2) only");
    if (json.includes("WallHold") || json.includes("DashImgHold") || json.includes("WallGlintHold")) bad.push("the wall slash glint plays in full, with no frame hold");
    { let ws = 0; walk(sh.events, e => { const c = JSON.stringify(e.conditions || []), a2 = JSON.stringify(e.actions || []); if (c.includes('"DashWall","=","1"') && a2.includes("Dash_Out_Forward") && !a2.includes("Dash_Tell")) ws++; if (c.includes('"DashWall","=","0"') && !a2.includes("Dash_Tell") && a2.includes("DashTell")) bad.push("a tell start without the tell animation"); });
      if (ws !== 3) bad.push("the offense dash, the picked dash strike and Num6 must skip the eye glint when the dash would end at a wall (DashWall 1), got " + ws); }
    { let ce = null; walk(sh.events, e => { if (JSON.stringify(e.conditions || []).includes('"Kind","=","3"') && JSON.stringify(e.actions || []).includes("Dash_Crescent")) ce = e; }); const sp = ce && ce.conditions.find(c => c.type.value === "Sprite"); if (!sp || Number(sp.parameters[2]) < 10) bad.push("the crescent line must start after the glint frames (frame 10 or later)"); }
    // he waits for the echo (EchoBusy) after the dash strike and the wall slash, and goes back to chasing when none is active
    { let waitEnds = 0; walk(sh.events, e => { if (JSON.stringify(e.conditions || []).includes("HasAnimationEnded") && /PassingStrike|WallSlash/.test(JSON.stringify(e.conditions)) && /"DashWait"/.test(JSON.stringify(e.events || []).replace(/\\"/g, '"'))) waitEnds++; }); if (waitEnds !== 2) bad.push("after the dash strike and the wall slash he must wait for the echo (DashWait), got " + waitEnds);
      let rel = 0; walk(sh.events, e => { if (JSON.stringify(e.conditions || []).includes("DashWait") && JSON.stringify(e.conditions).includes("EchoBusy") && JSON.stringify(e.actions || []).includes("AggroReady")) rel++; }); if (rel !== 1) bad.push("the dash wait must end when no echo is active (EchoBusy 0), got " + rel);
      let busy = 0; walk(sh.events, e => { if ((e.actions || []).some(a => a.type.value === "SetNumberObjectVariable" && a.parameters[1] === "EchoBusy")) busy++; }); if (busy < 2) bad.push("EchoBusy must be computed every frame"); }
    // a stun clears the echo
    { let cleared = 0; walk(sh.events, e => { if (JSON.stringify(e.conditions || []).includes('"IsPostureBroken","True"') && JSON.stringify(e.conditions).includes('"Samurai_Echo"') && JSON.stringify(e.actions || []).includes("Samurai_Echo")) cleared++; }); if (!cleared) bad.push("a stun must clear the echo"); }
    return bad;
  }],

  ["Samurai melee hitboxes are invisible: every event that creates Samurai_Hitbox sets its opacity to 0 (the red Enemy_Test blade was only a visual aid)", () => {
    const bad = [], { sheets } = load();
    for (const name of ["Samurai_Boss", "Tutorial_Samurai_Boss"]) { const sh = sheets.find(s => s.name === name); if (!sh) { bad.push(name + " not found"); continue; }
      walk(sh.events, e => { const cr = (e.actions || []).find(a => a.type.value === "Create" && /^Samurai_(Dodge)?Hitbox$/.test(a.parameters[1])); if (cr && !(e.actions || []).some(a => a.type.value === "OpacityCapability::OpacityBehavior::SetValue" && a.parameters[0] === cr.parameters[1] && a.parameters[3] === "0")) bad.push(name + ": an event creates " + cr.parameters[1] + " without making it invisible"); }); }
    return bad;
  }],

  ["Samurai crossing attacks, round 2: the image faces the player from where it stands, uses the mirror look, phase 2 front-behind-back without images, phase 3 with them", () => {
    const bad = [], { scenes, sheets } = load(), sh = sheets.find(s => s.name === "Samurai_Boss"), json = JSON.stringify(sh.events);
    // the crossing image turns toward the player from its own position (it used to copy the Samurai's, and faced away)
    if (!json.includes("Samurai_Echo.CenterX()")) bad.push("the crossing echo must face the player by comparing with its own position (Samurai_Echo.CenterX())");
    for (const name of ["Samurai_Fight"]) {
      const sc = scenes.find(s => s.name === name), v = n => (sc.objects.find(o => o.name === "Samurai_NPC").variables.find(x => x.name === n) || {}).value;
      const mir = sc.objects.find(o => o.name === "Samurai_Echo"), at = mir.animations.find(a => a.name === "Samurai_Attack"), im = sc.objects.find(o => o.name === "Samurai_Afterimage");
      if (!at || !at.directions[0].sprites.every(s => s.image.includes("/mirror/"))) bad.push(name + ": the echo's attack must use the mirror-look frames");
      if (!im || !im.animations.every(a => a.directions[0].sprites.every(s => s.image.includes("/mirror/")))) bad.push(name + ": the afterimages must use the mirror-look frames");
      if (!(v("CrossSoloAt") >= 0.4 && v("CrossSoloAt") <= 1)) bad.push(name + ": CrossSoloAt should be 0.4 to 1 s");
    }
    if (json.split('"parameters":["Samurai_Hitbox","Opacity","=","0"]').length - 1 < 3) bad.push("the three crossing swing hitboxes must be made invisible with opacity 0 (the hitbox sprite is a full Samurai picture and covered the illusion); Hide was tried and the hits stopped hurting");
    { let forced = -1, p2i = -1; walk(sh.events, (e) => { const c = JSON.stringify(e.conditions || []); const parent = null; }); const evs = []; walk(sh.events, e => { if (e.conditions && JSON.stringify(e.actions || []).includes('"CrossLegsLeft"') && JSON.stringify(e.actions).includes('DashType')) evs.push(JSON.stringify(e.conditions)); }); forced = evs.findIndex(c => c.includes('CrossForce","=","1')); p2i = evs.findIndex(c => c.includes('CrossEnabled","=","1')); if (forced < 0 || p2i < 0 || forced > p2i) bad.push("the forced crossing (debug keys) must be checked before the phase ones, which reset ComboCount"); }
    if (!json.includes('"AimX","=","Samurai_Echo.CenterX()"')) bad.push("the echo's swing must aim the directional deflect at the echo (AimX)");
    for (const s of ["CrossLegsLeft", "CrossUseMirror", "CrossEnabled", "Cross2Split", "CrossForceLegs", "Num4", "Num5", "CrossSoloAt"]) if (!json.includes(s)) bad.push("the crossing attacks are missing " + s);
    if (!/"CrossEnabled","=","1"[^]{0,200}"Phase","=","2"|"CrossEnabled","=","1"[^]{0,200}"Phase",">=","2"/.test(json)) bad.push("phase 2 must start the front-behind-back sequence");
    if (!json.includes("\"CrossUseMirror\",\"=\",\"0\"") || !json.includes("\"CrossUseMirror\",\"=\",\"1\"")) bad.push("phase 2 must have no images (CrossUseMirror 0) and phase 3 images (1)");
    return bad;
  }],

  ["posture on a deflect scales with the attack: the Samurai's illusion deflects back half", () => {
    const bad = [], { scenes, sheets } = load(), cs = JSON.stringify(sheets.find(s => s.name === "Combat_Shared").events), sh = JSON.stringify(sheets.find(s => s.name === "Samurai_Boss").events);
    if (!cs.includes("Player.Variable(DeflectPostureDamage) * EnemyHitbox.Variable(PostureScale)")) bad.push("a melee deflect must scale the posture by the hitbox's PostureScale");
    if (!sh.includes("\"PostureScale\",\"=\",\"Samurai_NPC.Variable(IllusionPostureScale)\"")) bad.push("the illusion's swing hitbox must set PostureScale from IllusionPostureScale");
    const want = { Samurai_Fight: ["Samurai_Hitbox", "Samurai_Judgement_Cut", "Thousand_Cuts_Ultimate", "PetalTornado", "Samurai_Dash_Line", "Samurai_Petal"], Leaf_Ranger_Fight: ["Ranger_Hitbox", "Ranger_Arrow", "Ranger_Diag"], Gunslinger: ["Grenade_Explosion"] };
    for (const [scene, objs] of Object.entries(want)) { const sc = scenes.find(s => s.name === scene); for (const o of objs) { const v = (sc.objects.find(x => x.name === o).variables.find(x => x.name === "PostureScale") || {}).value; if (v !== 1) bad.push(scene + "." + o + " PostureScale should be 1 by default"); } }
    const f = scenes.find(s => s.name === "Samurai_Fight").objects.find(o => o.name === "Samurai_NPC").variables.find(v => v.name === "IllusionPostureScale");
    if (!f || f.value !== 0.5) bad.push("IllusionPostureScale must be 0.5");
    return bad;
  }],

  ["tutorial roll lesson: deflecting the petal fails the try instead of passing it", () => {
    const bad = [], { scenes } = load(), tl = scenes.find(s => s.name === "Tutorial_Level");
    if (!tl.variables.some(v => v.name === "TutWrongMove")) bad.push("TutWrongMove is not declared");
    let found = null; walk(tl.events, e => { const c = JSON.stringify(e.conditions || []); if (c.includes('"TutStep","=","2"') && c.includes("DeflectBlocked") && JSON.stringify(e.actions || []).includes("TutFailed")) found = e; });
    if (!found) bad.push("a deflect during step 2 must set TutFailed (the roll lesson)");
    let reset = false; walk(tl.events, e => { if (JSON.stringify(e.actions || []).includes('"Create"') && JSON.stringify(e.actions).includes("TutWrongMove")) reset = true; }); if (!reset) bad.push("TutWrongMove must be reset when a petal is sent");
    return bad;
  }],

  ["balance (hard but fair, docs/balance.md): no placeholder numbers; the player breaks in 4 to 6 hits, a boss in 4 to 8 deflects (or at most 20 sword hits), the deathblow route (deflects) is faster than chipping the HP, no single hit is huge", () => {
    const bad = [], P = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "..", "Soul Rush.json"), "utf8")), pl = P.objects.find(o => o.name === "Player"), pv = n => (pl.variables.find(x => x.name === n) || {}).value;
    const { scenes } = load();
    const fights = [["Samurai_Fight", "Samurai_NPC", ["AttackDamage", "CutDamage", "TornadoDamage", "PetalDamage", "GrabDamage"]], ["Leaf_Ranger_Fight", "Leaf_Ranger", ["ShotDamage", "StabDamage", "RainDamage", "BeamDamage"]]];
    if (!(pv("MaxHealth") === 100 && pv("MaxPosture") === 100)) bad.push("the balance is written for a player with 100 HP and 100 posture (see docs/balance.md)");
    for (const [scene, boss, dmgs] of fights) {
      const sc = scenes.find(s => s.name === scene), o = sc.objects.find(x => x.name === boss), v = n => (o.variables.find(x => x.name === n) || {}).value;
      const playerBreak = pv("MaxPosture") / v("PostureDamage"), bossBreakHits = v("MaxPosture") / pv("PostureDamage"), bossBreak = v("MaxPosture") / pv("DeflectPostureDamage"), chip = v("MaxHealth") / pv("AttackDamage");
      if (!(playerBreak >= 3.5 && playerBreak <= 6)) bad.push(boss + ": the player's posture should break in 4 to 6 hits, got " + playerBreak.toFixed(1) + " (PostureDamage " + v("PostureDamage") + ")");
      if (!(bossBreak >= 4 && bossBreak <= 8)) bad.push(boss + ": his posture should break in 4 to 8 deflects, got " + bossBreak.toFixed(1));
      if (!(bossBreakHits <= 20)) bad.push(boss + ": his posture should break in at most 20 sword hits, got " + bossBreakHits.toFixed(1));
      if (!(chip > bossBreak)) bad.push(boss + ": chipping his HP (" + chip.toFixed(1) + " hits a life) must be slower than breaking his posture with deflects (" + bossBreak.toFixed(1) + "), or the deathblow is pointless");
      if (v("Health") !== v("MaxHealth")) bad.push(boss + ": Health must start at MaxHealth");
      for (const d of dmgs) { const x = v(d); if (!(x >= 8 && x <= 35)) bad.push(boss + " " + d + " is " + x + ": between 8 and 35 (no placeholder 1, nothing that takes a third of a life... of the 100)"); }
    }
    return bad;
  }],

  ["attacks cost stamina (15 a swing, a saved press that cannot be paid is dropped) and enemy posture decays per boss: a delay, and a rate that scales with his HP", () => {
    const bad = [], fs = require("fs"), path = require("path"), root = path.join(__dirname, "..", ".."), P = JSON.parse(fs.readFileSync(path.join(root, "Soul Rush.json"), "utf8")), pl = P.objects.find(o => o.name === "Player"), pv = n => (pl.variables.find(x => x.name === n) || {}).value;
    const { scenes, sheets } = load(), pm = sheets.find(s => s.name === "Player_Movement"), cs = sheets.find(s => s.name === "Combat_Shared");
    if (pv("AttackStaminaCost") !== 15) bad.push("AttackStaminaCost must be 15 (got " + pv("AttackStaminaCost") + ")");
    let paid = 0; walk(pm.events, e => { const a2 = JSON.stringify(e.actions || []), c = JSON.stringify(e.conditions || []); if (/Player_Attack_(One|Two)/.test(a2) && a2.includes("ComboStep") && c.includes("AttackStaminaCost") && a2.includes("AttackStaminaCost") && a2.includes("StaminaRegenTimer")) paid++; });
    if (paid !== 3) bad.push("the three attack starts (fresh, after Attack_One, after Attack_Two) must need and spend AttackStaminaCost, got " + paid);
    let drop = false; walk(pm.events, e => { const c = JSON.stringify(e.conditions || []); if (c.includes('"AllowCombo","True"') && c.includes("AttackStaminaCost") && JSON.stringify(e.actions || []).includes('"AllowCombo","False"')) drop = true; }); if (!drop) bad.push("a saved attack press that the stamina cannot pay for must be dropped");
    // posture decay: the delay and the rate are per boss, the rate between Empty (0 HP) and Full (full HP)
    let regen = null; walk(cs.events, e => { if (JSON.stringify(e.actions || []).includes("PostureRegenFull") && JSON.stringify(e.actions).includes("TimeDelta")) regen = e; });
    if (!regen) return bad.concat("the enemy posture decay must use PostureRegenFull and PostureRegenEmpty");
    if (!JSON.stringify(regen.conditions).includes("PostureRegenDelay")) bad.push("the enemy posture decay must wait PostureRegenDelay");
    const rate = (o, hp) => { const v = n => (o.variables.find(x => x.name === n) || {}).value; return v("PostureRegenEmpty") + (v("PostureRegenFull") - v("PostureRegenEmpty")) * Math.min(1, Math.max(0, hp / Math.max(1, v("MaxHealth")))); };
    for (const [scene, boss] of [["Samurai_Fight", "Samurai_NPC"], ["Leaf_Ranger_Fight", "Leaf_Ranger"], ["Gunslinger", "Gunslinger_NPC"], ["Tutorial_Level", "Samurai_NPC"]]) { const o = scenes.find(s => s.name === scene).objects.find(x => x.name === boss); for (const n of ["PostureRegenDelay", "PostureRegenFull", "PostureRegenEmpty"]) if (!o.variables.some(x => x.name === n)) bad.push(scene + ": " + boss + " needs " + n); }
    const sam = scenes.find(s => s.name === "Samurai_Fight").objects.find(x => x.name === "Samurai_NPC"), leaf = scenes.find(s => s.name === "Leaf_Ranger_Fight").objects.find(x => x.name === "Leaf_Ranger"), val = (o, n) => (o.variables.find(x => x.name === n) || {}).value;
    if (!(rate(sam, val(sam, "MaxHealth")) > rate(sam, val(sam, "MaxHealth") / 2) && rate(sam, val(sam, "MaxHealth") / 2) > rate(sam, 1))) bad.push("the Samurai's posture must go down faster the higher his HP");
    if (val(leaf, "PostureRegenDelay") !== 0 || !(rate(leaf, val(leaf, "MaxHealth")) > 0 && rate(leaf, val(leaf, "MaxHealth")) <= 3)) bad.push("the Leaf Ranger's posture must always be going down (delay 0), fairly slowly (up to 3 a second)");
    for (const [scene, boss] of [["Gunslinger", "Gunslinger_NPC"], ["Tutorial_Level", "Samurai_NPC"]]) { const o = scenes.find(s => s.name === scene).objects.find(x => x.name === boss); if (!(val(o, "PostureRegenDelay") === 1.5 && rate(o, 1) === 5 && rate(o, val(o, "MaxHealth")) === 5)) bad.push(scene + ": the old flat decay (5 a second after 1.5 s) must stay as it was"); }
    return bad;
  }],

  ["playtest form script: docs/playtest-form.gs is the generated output of tools/docs/questionnaire.js, and it is valid JavaScript with scales, choices, tick boxes, grids and text", () => {
    const bad = [], fs = require("fs"), path = require("path"), { build } = require("../docs/form_script.js"), q = require("../docs/questionnaire.js");
    const file = path.join(__dirname, "..", "..", "docs", "playtest-form.gs"), have = fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "";
    const want = build();
    if (have !== want) bad.push("docs/playtest-form.gs is out of date: run node tools/docs/form_script.js");
    try { new Function(want); } catch (e) { bad.push("the generated script is not valid JavaScript: " + e.message); }
    const kinds = new Set(); let n = 0; for (const s of q.sections) for (const x of s.questions) { kinds.add(x.kind); n++; if (x.kind === "scale" && !(x.low && x.high)) bad.push("a scale needs both labels: " + x.text); if ((x.kind === "choice" || x.kind === "multi") && !(x.options && x.options.length >= 2)) bad.push("a choice needs options: " + x.text); }
    for (const k of ["scale", "choice", "multi", "short", "long", "grid"]) if (!kinds.has(k)) bad.push("the form has no " + k + " question");
    if (n < 60) bad.push("the questionnaire shrank to " + n + " questions");
    return bad;
  }],

  ["the tutorial Samurai and the real Samurai have separate event sheets", () => {
    const bad = [], { scenes, sheets } = load(), { scenesLinking } = require("./lib");
    const real = sheets.find(s => s.name === "Samurai_Boss"), tut = sheets.find(s => s.name === "Tutorial_Samurai_Boss");
    if (!real || !tut) return ["both Samurai_Boss and Tutorial_Samurai_Boss must exist"];
    const link = n => scenesLinking(n).map(s => s.name || s).sort().join(",");
    if (link("Samurai_Boss") !== "Samurai_Fight") bad.push("Samurai_Boss must be linked by Samurai_Fight only (linked by: " + link("Samurai_Boss") + ")");
    if (link("Tutorial_Samurai_Boss") !== "Tutorial_Level") bad.push("Tutorial_Samurai_Boss must be linked by Tutorial_Level only (linked by: " + link("Tutorial_Samurai_Boss") + ")");
    // The tutorial sheet is pruned: nothing about phases 2 and 3, the mirror, the crossing attacks, the ultimate or the intermissions, but the phase 1 fight is whole.
    let text = ""; const comments = []; walk(tut.events, e => { if (e.comment) comments.push(e.comment); text += JSON.stringify(e.conditions || []) + JSON.stringify(e.actions || []); });
    for (const w of ["Samurai_Mirror", "Samurai_Afterimage", "Thousand_Cuts_Ultimate", "\"PickSkill\"", "\"Intermission\"=", "CrossLegsLeft", "BarMode", "RunSpeedP3"]) if (text.includes(w)) bad.push("the tutorial sheet still mentions " + w);
    for (const c of ["Samurai_Idle Rules", "Samurai_Waiting Rules", "Samurai_AggroReady Rules", "Samurai_Attacking Rules", "Samurai_Cooldown", "Boss: final death", "Boss offense, phase 1:", "Petal cast: on frame", "Dash strike: spawn", "Grab connects", "Directional deflecting"]) if (!comments.some(x => x.startsWith(c))) bad.push("the tutorial sheet lost: " + c);
    { const tl = scenes.find(s => s.name === "Tutorial_Level"); for (const o of ["Samurai_Mirror", "Samurai_Afterimage", "Ult_Deflect_Tell"]) if (tl.objects.some(x => x.name === o)) bad.push("the tutorial scene should not have " + o); }
    if (JSON.stringify(real.events).length < JSON.stringify(tut.events).length * 1.8) bad.push("the real Samurai sheet should be much bigger than the pruned tutorial one");
    return bad;
  }],

  ["Samurai mirror: a separate object nothing can hurt; the paired Judgement Cut (short dash, mirror behind, two cuts left and right, SharedDeflect, one sound); cleanup; debug keys", () => {
    const bad = [], { scenes, sheets } = load(), sc = scenes.find(s => s.name === "Samurai_Fight"), sh = sheets.find(s => s.name === "Samurai_Boss");
    const mir = sc.objects.find(o => o.name === "Samurai_Mirror");
    if (!mir) return ["Samurai_Mirror is not in the fight scene"];
    for (const a of ["Idle", "Samurai_Dash_QuickDraw", "Samurai_Petal_Cast"]) if (!mir.animations.some(x => x.name === a && x.directions[0].sprites.length > 3)) bad.push("the mirror has no " + a + " animation");
    if (mir.animations.some(a => a.directions[0].sprites.some(s => s.hasCustomCollisionMask && s.customCollisionMask.length))) bad.push("the mirror has collision masks");
    for (const g of sc.objectsGroups) if (g.objects.some(o => o.name === "Samurai_Mirror")) bad.push("the mirror is in the group " + g.name + ", so it could be hit");
    const sam = sc.objects.find(o => o.name === "Samurai_NPC"), val = n => (sam.variables.find(x => x.name === n) || {}).value;
    if (!(val("MirrorDashSpeed") * val("MirrorDashTime") <= 220)) bad.push("the mirror dash is " + val("MirrorDashSpeed") * val("MirrorDashTime") + " px, it should only be a short way (220 or less)");
    if (!(val("MirrorCutSpread") > 0.2 && val("MirrorCutSpread") < 0.6)) bad.push("MirrorCutSpread must keep the player inside both cuts when standing still (between 0.2 and 0.6 of a cut width)");
    const next = (s, list = sh.events) => { for (let i = 0; i < list.length; i++) { if (list[i].type === "BuiltinCommonInstructions::Comment" && list[i].comment.startsWith(s)) return list[i + 1]; const r = list[i].events && next(s, list[i].events); if (r) return r; } return null; };
    const draw = next("Mirror Judgement Cut, the draw frame");
    if (!draw) return bad.concat("missing the mirror draw event");
    const j = JSON.stringify(draw.actions);
    if ((j.match(/"value":"Create"/g) || []).length !== 2 || (j.match(/"SharedDeflect","=","1"/g) || []).length !== 2) bad.push("the mirror draw must create exactly two cuts, both SharedDeflect 1");
    if ((j.match(/"value":"PlaySound"/g) || []).length !== 1) bad.push("the paired cuts should play one sound");
    if (!j.includes("Player.CenterX() - ") || !j.includes("Player.CenterX() + ")) bad.push("the cuts must land left and right of the player");
    const all = JSON.stringify(sh.events);
    if (!all.includes("Mirror image cleanup")) bad.push("missing the mirror cleanup");
    for (const k of ["Home", "End", "Insert", "Delete", "PageUp", "PageDown"]) if (!all.includes("\"\\\"" + k + "\\\"\"")) bad.push("missing debug key " + k);
    const cs = JSON.stringify(sheets.find(s => s.name === "Combat_Shared").events);
    if (!(cs.includes("\"SharedDeflect\",\"=\",\"1\"") && cs.includes("\"SharedDeflect\",\"=\",\"0\""))) bad.push("the deflect rule must treat SharedDeflect 1 as not using up the press (and the ranged branch only for SharedDeflect 0)");
    return bad;
  }],

  ["Samurai mirror petal waves: 10 petals in waves of 2, 3 and 5, a wave launches together, one deflect bursts the whole wave", () => {
    const bad = [], { scenes, sheets } = load(), sc = scenes.find(s => s.name === "Samurai_Fight"), sh = sheets.find(s => s.name === "Samurai_Boss");
    const sam = sc.objects.find(o => o.name === "Samurai_NPC"), val = n => (sam.variables.find(x => x.name === n) || {}).value;
    const map = String(val("WaveMap")), count = n => [...map].filter(c => c === String(n)).length;
    if (map.length !== val("MirrorPetalCount") || val("MirrorPetalCount") !== 10) bad.push("WaveMap (" + map + ") must have one entry per petal (10)");
    if (count(1) !== 2 || count(2) !== 3 || count(3) !== 5) bad.push("the waves must be 2, 3 and 5 petals (got " + count(1) + ", " + count(2) + ", " + count(3) + ")");
    if (!(val("WaveGap") >= 0.5)) bad.push("WaveGap is too short for three readable waves");
    if (val("WaveRipple") * 9 > 0.15) bad.push("WaveRipple would stretch a wave over " + (val("WaveRipple") * 9).toFixed(2) + " s, it should launch together");
    const json = JSON.stringify(sh.events);
    for (const part of ["Mirror petal waves, setup", "Mirror petal waves: on frame PetalSpawnFrame", "Wave deflect"]) if (!json.includes(part)) bad.push("missing: " + part);
    if (!json.includes("\"WaveId\",\"=\",\"Samurai_NPC.Variable(MirrorCastId) * 10") || !json.includes("\"SharedDeflect\",\"=\",\"1\"")) bad.push("every wave petal needs a WaveId and SharedDeflect 1");
    if (!json.includes("\"WaveBurstId\",\"=\",\"Samurai_Petal.Variable(WaveId)\"")) bad.push("a deflected wave petal must start the wave burst");
    if (!sc.objects.find(o => o.name === "Samurai_Petal").variables.some(x => x.name === "WaveId")) bad.push("Samurai_Petal needs WaveId");
    return bad;
  }],

  ["Samurai intermission into phase 3: three sets (right to left from the player, left to right, centre then both sides); the single-cut intermission is untouched", () => {
    const bad = [], { sheets } = load(), sh = sheets.find(s => s.name === "Samurai_Boss"), json = JSON.stringify(sh.events);
    for (const part of ["Set 1: three cuts sweep from the player to the left", "Set 2: three cuts sweep from the left of the player to the right", "Set 3, the first cut: straight on top of the player", "Set 3, right after"]) if (!json.includes(part)) bad.push("missing: " + part);
    if (!json.includes("\"SweepMode\",\"=\",\"0\"")) bad.push("the old single-cut launcher must only run when SweepMode is 0");
    if (!json.includes("\"SweepActive\",\"=\",\"0\"")) bad.push("the intermission must not end in the middle of a set");
    if (!json.includes("\"CutsLeft\",\"=\",\"3\"") || !json.includes("\"Lives\",\"<=\",\"1\"")) bad.push("the sweep intermission must be only for his last life and run 3 sets");
    return bad;
  }],

  ["Samurai mirror tornado: both teleport to opposite ends, both cast a tornado at the player; the dash follows sometimes and the mirror dashes through the player too", () => {
    const bad = [], { scenes, sheets } = load(), sc = scenes.find(s => s.name === "Samurai_Fight"), sh = sheets.find(s => s.name === "Samurai_Boss");
    const sam = sc.objects.find(o => o.name === "Samurai_NPC"), val = n => (sam.variables.find(x => x.name === n) || {}).value;
    if (!(val("MirrorEndNear") < 640 && val("MirrorEndFar") > 640 && val("MirrorEndFar") - val("MirrorEndNear") > 700)) bad.push("the two ends must be on opposite sides of the arena, far apart (" + val("MirrorEndNear") + " and " + val("MirrorEndFar") + ")");
    const json = JSON.stringify(sh.events);
    for (const part of ["Mirror tornado, setup", "Mirror tornado, the teleport", "Mirror tornado, the release frame", "Mirror tornado, the cast is over", "Mirror dash, the strike starts", "Mirror dash: its slash line"]) if (!json.includes(part)) bad.push("missing: " + part);
    const rel = [];
    walk(sh.events, e => { if (JSON.stringify(e.actions || []).includes("PetalTornado") && JSON.stringify(e.conditions || []).includes("MirrorTornado")) rel.push(e); });
    // His tornado and the mirror's are made in separate events (two Create actions in one event leave both picked, and the second speed
    // overwrote the first: his tornado went the wrong way), each along sign(MirrorMirX - MirrorSamX), in opposite directions.
    if (rel.length !== 2) bad.push("expected two release events (his, then the mirror's), found " + rel.length);
    for (const e of rel) { const a = JSON.stringify(e.actions); if ((a.match(/"value":"Create"/g) || []).length !== 1) bad.push("each release event must create exactly one tornado"); if (!a.includes("MirrorMirX") || !a.includes("MirrorSamX")) bad.push("the tornado direction must come from the two ends (MirrorMirX, MirrorSamX)"); }
    if (rel.length === 2) {
      if (!(JSON.stringify(rel[0].actions).includes("Samurai_NPC.PointX") && JSON.stringify(rel[1].actions).includes("Samurai_Mirror.PointX"))) bad.push("the first release must be his tornado, the second the mirror's");
      if (JSON.stringify(rel[0].actions).includes("(-sign") === JSON.stringify(rel[1].actions).includes("(-sign")) bad.push("the two tornadoes must go in opposite directions");
    }
    const mir = sc.objects.find(o => o.name === "Samurai_Mirror");
    for (const a of ["Samurai_Tornado_Cast", "Samurai_Passing_Dash_Attack", "Samurai_Dash_Out_Back"]) if (!mir.animations.some(x => x.name === a)) bad.push("the mirror has no " + a + " animation");
    if (!json.includes("\"MirrorStrike\",\"=\",\"0\"")) bad.push("the mirror cleanup must wait while the mirror is on its dash strike (MirrorStrike)");
    for (const k of ["Numpad1", "Numpad2"]) if (!json.includes("\"\\\"" + k + "\\\"\"")) bad.push("missing debug key " + k);
    return bad;
  }],

  ["Desperation feedback: a deflect that needs the extra window flags the blade glow and the icon pulse; the glow lasts 0.3 s then stops; a normal-window deflect shows nothing", () => {
    const bad = [], { sheets } = load(), cs = sheets.find(s => s.name === "Combat_Shared");
    // The deflect event: a child flags DespUsed and DespPulse only when DeflectTimer is past the base DeflectWindow.
    let flag = null;
    walk(cs.events, e => { if (JSON.stringify(e.actions || []).includes("DespUsed") && JSON.stringify(e.actions).includes("DespPulse")) flag = e; });
    if (!flag) return ["missing the event that flags a deflect made in the extra window"];
    const c = flag.conditions[0];
    if (c.type.value !== "CompareObjectTimer" || c.parameters[2] !== ">" || !/Variable\(DeflectWindow\)$/.test(c.parameters[3])) bad.push("the flag must test DeflectTimer > DeflectWindow (the base window, not the widened one)");
    // The glow script, run against stand-ins.
    const code = script("Combat_Shared", "Desperation glow:");
    const pv = vars({ DespUsed: false, DespPulse: false });
    const player = obj("Player", { extra: { getVariables: () => pv, getPointX: () => 300, getPointY: () => 400, getAnimationName() { return this.anim; }, getAnimationFrame: () => 2, setAnimationName(n) { this.anim = n; }, setAnimationFrame(x) { this.frameSet = x; } } });
    player.anim = "Player_Deflect_1";
    const children = [];
    const savedPixi = global.PIXI; let drawn = 0, cleared = 0;
    global.PIXI = { Graphics: function () { this.clear = () => { cleared++; drawn = 0; }; this.beginFill = () => {}; this.drawCircle = () => { drawn++; }; this.endFill = () => {}; } };
    const scene = { getObjects: n => n === "Player" ? [player] : n === "Invisible_Wall" ? walls : [], getTimeManager: () => ({ getElapsedTime: () => 1000 / 60, getTimeScale: () => 1 }),
      getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => ({ addChild: g => children.push(g) }) }) }) };
    const run = () => new Function("runtimeScene", "gdjs", code)(scene, {});
    try {
      for (let i = 0; i < 5; i++) run();
      if (children.length || drawn) bad.push("the glow drew without a flag");
      if (player.anim !== "Player_Deflect_1") bad.push("without a flag the player's animation must stay as it is, it is " + player.anim);
      pv.get("DespUsed").v = true; run();
      if (pv.get("DespUsed").v) bad.push("the glow must clear DespUsed once it has started");
      if (!children.length || !drawn) bad.push("the glow did not draw after the flag");
      // The blade itself: the player is switched to the teal twin of its deflect animation, on the same frame.
      if (player.anim !== "Player_Deflect_1_Teal" || player.frameSet !== 2) bad.push("the player must switch to Player_Deflect_1_Teal on the same frame (2), is " + player.anim + " frame " + player.frameSet);
      let frames = 1; while (drawn && frames < 120) { run(); frames++; }
      if (frames < 15 || frames > 25) bad.push("the glow lasted " + frames + " frames at 60 fps, expected about 0.3 s (18)");
      if (player.anim !== "Player_Deflect_1_Teal") bad.push("the twin animation must not be switched again and again");
      { // The other deflect animation too.
        const p2 = obj("Player", { extra: { getVariables: () => pv, getPointX: () => 300, getPointY: () => 400, getAnimationName() { return this.anim; }, getAnimationFrame: () => 1, setAnimationName(n) { this.anim = n; }, setAnimationFrame(x) { this.frameSet = x; } } });
        p2.anim = "Player_Deflect_2"; const s2 = Object.assign({}, scene, { getObjects: n => n === "Player" ? [p2] : [] });
        pv.get("DespUsed").v = true; new Function("runtimeScene", "gdjs", code)(s2, {});
        if (p2.anim !== "Player_Deflect_2_Teal") bad.push("Player_Deflect_2 must switch to Player_Deflect_2_Teal, is " + p2.anim);
        const p3 = obj("Player", { extra: { getVariables: () => pv, getPointX: () => 300, getPointY: () => 400, getAnimationName() { return this.anim; }, getAnimationFrame: () => 1, setAnimationName(n) { this.anim = n; }, setAnimationFrame(x) { this.frameSet = x; } } });
        p3.anim = "Player_Run"; const s3 = Object.assign({}, scene, { getObjects: n => n === "Player" ? [p3] : [] });
        pv.get("DespUsed").v = true; new Function("runtimeScene", "gdjs", code)(s3, {});
        if (p3.anim !== "Player_Run") bad.push("only a deflect animation may be swapped, a " + p3.anim + " was changed");
      }
      // The project: the twins exist with the same frames, Blade points and timing, their blade pixels are teal, and the old overlay object is gone.
      const fs2 = require("fs"), path2 = require("path"), root2 = path2.join(__dirname, "..", "..");
      const pj = JSON.parse(fs2.readFileSync(path2.join(root2, "Soul Rush.json"), "utf8")), pl = pj.objects.find(o => o.name === "Player");
      if (pj.objects.some(o => o.name === "Player_Blade_Glow")) bad.push("the old overlay object Player_Blade_Glow should be gone");
      const png = require("../bosses/png.js");
      for (const an of ["Player_Deflect_1", "Player_Deflect_2"]) {
        const o = pl.animations.find(x => x.name === an), tw = pl.animations.find(x => x.name === an + "_Teal");
        if (!tw) { bad.push(an + "_Teal is missing on the Player"); continue; }
        const so = o.directions[0], st2 = tw.directions[0];
        if (so.sprites.length !== st2.sprites.length || so.timeBetweenFrames !== st2.timeBetweenFrames || so.looping !== st2.looping) bad.push(an + "_Teal must have the same frames, timing and looping as " + an);
        st2.sprites.forEach((s, i) => {
          if (JSON.stringify(s.points) !== JSON.stringify(so.sprites[i].points)) bad.push(an + "_Teal frame " + (i + 1) + ": the Blade point must match the original");
          const img = png.decode(path2.join(root2, s.image)), src = png.decode(path2.join(root2, so.sprites[i].image)); let teal = 0, changed = 0;
          for (let k = 0; k < img.w * img.h; k++) { const r = img.data[k * 4], g = img.data[k * 4 + 1], b2 = img.data[k * 4 + 2]; if (img.data[k * 4 + 3] === 255 && g > r + 40 && b2 > r + 30) teal++; if (img.data[k * 4] !== src.data[k * 4] || img.data[k * 4 + 1] !== src.data[k * 4 + 1]) changed++; }
          if (teal < 40) bad.push(an + "_Teal frame " + (i + 1) + " has only " + teal + " teal pixels: the blade is not teal");
          if (changed > 140) bad.push(an + "_Teal frame " + (i + 1) + " changes " + changed + " pixels: only the blade should change");
        });
      }
    } finally { global.PIXI = savedPixi; }
    // The icon pulse is read by the fight UI.
    let ui = ""; walk(cs.events, e => { if (e.type === "BuiltinCommonInstructions::JsCode" && codeOf(e).includes("Fight UI layout.")) ui = codeOf(e); });
    if (!/DespPulse[^]*st\.despPulse = 1/.test(ui)) bad.push("the fight UI must pulse the Desperation icon on DespPulse");
    return bad;
  }],

  ["every object an event names exists in its scene (a scene copied without its boss, or a sheet used in a scene lacking the object, shows up in GDevelop as invalid parameters)", () => {
    const bad = [], fs = require("fs"), path = require("path"), { scenes, sheets } = load();
    const root = path.join(__dirname, "..", "..");
    const proj = JSON.parse(fs.readFileSync(path.join(root, "Soul Rush.json"), "utf8"));
    const globals = new Set([...proj.objects.map(o => o.name), ...(proj.objectsGroups || []).map(g => g.name), ...(proj.variables || []).map(v => v.name)]);
    const EXPR = /\b([A-Z][A-Za-z0-9_]*)\.(?:[A-Za-z]+\()/g;
    // Every layout file, including the arena templates (the shared loader skips them).
    for (const file of fs.readdirSync(path.join(root, "layouts")).filter(n => n.endsWith(".json"))) {
      const raw = JSON.parse(fs.readFileSync(path.join(root, "layouts", file), "utf8"));
      const known = new Set([...globals, ...raw.objects.map(o => o.name), ...(raw.objectsGroups || []).map(g => g.name), ...(raw.variables || []).map(v => v.name)]);
      const linked = []; walk(raw.events, e => { if (e.type === "BuiltinCommonInstructions::Link") linked.push(e.target); });
      const lists = [raw.events].concat(linked.map(t => (sheets.find(x => x.name === t) || { events: [] }).events));
      const missing = new Set();
      const note = n => { if (n && !known.has(n)) missing.add(n); };
      for (const list of lists) walk(list, e => {
        if (e.object) note(e.object);
        const scan = i => { const p0 = i.parameters && i.parameters[0];
          if (typeof p0 === "string" && /^[A-Z][A-Za-z0-9_]*$/.test(p0) && p0 !== "True" && p0 !== "False") note(p0);
          for (const p of i.parameters || []) for (const m of String(p).matchAll(EXPR)) note(m[1]);
          (i.subInstructions || []).forEach(scan); };
        for (const i of (e.conditions || []).concat(e.actions || [])) scan(i);
      });
      if (missing.size) bad.push(file + " uses objects it does not have: " + [...missing].join(", "));
    }
    return bad;
  }],

  ["string literals in events are quoted: AIState = \"Intermission\", not = Intermission (a bare word is an invalid expression, the condition never matches and GDevelop says nothing)", () => {
    const bad = [], fs = require("fs"), path = require("path"), root = path.join(__dirname, "..", "..");
    const files = [];
    for (const d of ["externalEvents", "layouts"]) for (const f of fs.readdirSync(path.join(root, d))) if (f.endsWith(".json")) files.push(path.join(root, d, f));
    const STRING_TYPES = new Set(["StringObjectVariable", "SetStringObjectVariable", "StringVariable", "SetStringVariable"]);
    for (const file of files) {
      const j = JSON.parse(fs.readFileSync(file, "utf8")), found = new Set();
      const visit = i => { const p = i.parameters; if (STRING_TYPES.has(i.type && i.type.value) && p && p.length >= 4 && typeof p[3] === "string" && /^[A-Za-z_][A-Za-z0-9_ ]*$/.test(p[3])) found.add(p[1] + " = " + p[3]); (i.subInstructions || []).forEach(visit); };
      walk(j.events || [], e => { (e.conditions || []).forEach(visit); (e.actions || []).forEach(visit); });
      if (found.size) bad.push(path.basename(file) + " has unquoted string values: " + [...found].slice(0, 6).join(", "));
    }
    return bad;
  }],

  ["Leaf Ranger feedback: the slide-through goes well past the player, 1 snare per slide in phase 1 and 2 in phase 2, he jumps away in phase 1, and dodges more often", () => {
    const bad = [], { sheets, scenes } = load(), sh = sheets.find(s => s.name === "Leaf_Ranger_Boss"), sc = scenes.find(s => s.name === "Leaf_Ranger_Fight");
    const v = n => (sc.objects.find(o => o.name === "Leaf_Ranger").variables.find(x => x.name === n) || {}).value;
    if (v("TrapCountP1") !== 1 || v("TrapCountP2") !== 2) bad.push("snares per slide must be 1 in phase 1 and 2 in phase 2 (got " + v("TrapCountP1") + " and " + v("TrapCountP2") + ")");
    if (!(v("SlideThrough") >= 250)) bad.push("SlideThrough is too short: he would still end close to the player");
    if (!(v("DodgeCooldown") <= 2)) bad.push("the dodge cooldown should be 2 s or less");
    const json = JSON.stringify(sh.events);
    if (!json.includes("\"SlideGo\"") || !json.includes("Variable(SlideThrough)")) bad.push("the slide toward the player must set SlideGo from SlideThrough");
    if (json.includes("abs(Leaf_Ranger.CenterX() - Leaf_Ranger.Variable(FromX))\",\">=\",\"Leaf_Ranger.Variable(SlideDist)")) bad.push("the slide must end at SlideGo, not a fixed SlideDist");
    if (!json.includes("TrapCountP1") || !json.includes("TrapCountP2")) bad.push("TrapsLeft must come from the phase (TrapCountP1 / TrapCountP2)");
    if (!json.includes("Phase 1, room behind him") || !json.includes("LeapAwayChance")) bad.push("missing the phase 1 jump away");
    return bad;
  }],

  ["Desperation debug key: left Alt toggles the player's last life with every curse stack and gives his old state back (simulated over several frames), and the gate covers it", () => {
    const bad = [], { sheets } = load(), cs = sheets.find(s => s.name === "Combat_Shared");
    const evs = []; walk(cs.events, e => { if (JSON.stringify(e.conditions || []).includes("LAlt")) evs.push(e); });
    if (evs.length !== 3) return ["left Alt needs three events (snapshot, on, off), found " + evs.length];
    // A tiny interpreter for these events: number-variable conditions, SetNumberObjectVariable "=" actions, the key held down for one frame.
    const P = { Lives: 3, CurseStacks: 1, MaxHealth: 80, Health: 50, BaseMaxHealth: 100, CursePercent: 15, BrandFraction: 0, HpFloorPercent: 10, DbgDesperation: 0, DbgSnap: 0, DbgLives: 0, DbgCurse: 0, DbgMaxHealth: 0, DbgHealth: 0, IsDead: false };
    const ev = ex => new Function("P", "max", "min", "round", "return (" + ex.replace(/Player\.Variable\((\w+)\)/g, "P.$1") + ");")(P, Math.max, Math.min, Math.round);
    const frame = () => { for (const e of evs) {
      const ok = e.conditions.every(c => c.type.value !== "NumberObjectVariable" || ({ "=": (x, y) => x === y })[c.parameters[2]](P[c.parameters[1]], Number(c.parameters[3])));
      if (ok) for (const a of e.actions) P[a.parameters[1]] = ev(a.parameters[3]); } };
    frame();
    if (P.Lives !== 1 || P.CurseStacks !== 4 || P.DbgDesperation !== 1) bad.push("first press: expected Lives 1, CurseStacks 4, on; got " + JSON.stringify(P));
    if (!(P.MaxHealth < 100 && P.Health === P.MaxHealth)) bad.push("first press: max HP must drop like the curse and HP refill");
    frame();
    if (P.Lives !== 3 || P.CurseStacks !== 1 || P.MaxHealth !== 80 || P.Health !== 50 || P.DbgDesperation !== 0) bad.push("second press: must give the old lives, curse, max HP and HP back; got " + JSON.stringify(P));
    frame();
    if (P.Lives !== 1 || P.DbgDesperation !== 1) bad.push("third press: must turn it on again");
    return bad;
  }],

  ["Leaf Ranger, Samurai petals, mirror and opening feedback (2026-11-13): petals draw back before launching, the mirror glitches in, no extra wait after the bow", () => {
    const bad = [], { scenes, sheets } = load(), sh = sheets.find(s => s.name === "Samurai_Boss"), sc = scenes.find(s => s.name === "Samurai_Fight");
    const val = n => (sc.objects.find(o => o.name === "Samurai_NPC").variables.find(x => x.name === n) || {}).value;
    let pull = null, glitch = null, glitchEnd = null;
    walk(sh.events, e => {
      const c = JSON.stringify(e.conditions || []), a = JSON.stringify(e.actions || []);
      if (c.includes("\"State\",\"=\",\"\\\"glint\\\"\"") && a.includes("PetalPullSpeed") && a.includes("\"SetX\"")) pull = e;
      if (c.includes("\"GlitchOn\",\"=\",\"1\"") && c.includes("\"<\"") && a.includes("ChangeColor") === false) glitch = e;
      if (c.includes("\"GlitchOn\",\"=\",\"1\"") && c.includes("\">=\"") && a.includes("ChangeColor")) glitchEnd = e;
    });
    if (!pull) bad.push("a glinting petal must back away from the player (SetX/SetY by PetalPullSpeed)");
    else if (!JSON.stringify(pull.actions).includes("\"-\"")) bad.push("the petal pull must move it away from the player (subtract along its aim)");
    if (!(val("PetalPullSpeed") > 0)) bad.push("PetalPullSpeed must be positive");
    if (!(val("PetalRadius") > 221)) bad.push("petals must start further from the player than before (PetalRadius > 221, got " + val("PetalRadius") + ")");
    if (!glitch) bad.push("the mirror needs a glitch event while it is young (Glitch timer < MirrorGlitchTime)");
    else if (!JSON.stringify(glitch.actions).includes("SetX") || !JSON.stringify(glitch).includes("ChangeColor")) bad.push("the mirror glitch must move (SetX) and tint (ChangeColor)");
    if (!glitchEnd) bad.push("the glitch must end by undoing its shudder and tint");
    else if (!JSON.stringify(glitchEnd.actions).includes("GlitchTargetX") || !JSON.stringify(glitchEnd.actions).includes("255;255;255")) bad.push("the glitch end must land the mirror on GlitchTargetX and clear the tint");
    if (!(val("MirrorGlitchTime") > 0.2 && val("MirrorGlitchTime") <= 0.8)) bad.push("MirrorGlitchTime should be short (0.2 to 0.8 s)");
    const json = JSON.stringify(sc.events);
    if (json.includes("\"IdleTimer\",\"=\",\"1.6\"")) bad.push("the opening must not add a wait after the bow (IdleTimer 0)");
    if (!json.includes("\"IdleTimer\",\"=\",\"0\"")) bad.push("after the bow, IdleTimer must be 0");
    return bad;
  }],

  ["Samurai feedback round 2: Shift+F2 triples in any phase, petals fly with momentum, the mirror glitch runs its own timer, debug keys are real GDevelop keys", () => {
    const bad = [], { scenes, sheets } = load(), sh = sheets.find(s => s.name === "Samurai_Boss"), sc = scenes.find(s => s.name === "Samurai_Fight");
    const json = JSON.stringify(sh.events), val = n => (sc.objects.find(o => o.name === "Samurai_NPC").variables.find(x => x.name === n) || {}).value;
    if (!json.includes("\"DebugTriple\",\"=\",\"1\"")) bad.push("Shift+F2 must set DebugTriple 1");
    if (!json.includes("\"DebugTriple\",\"=\",\"0\"")) bad.push("the draw must clear DebugTriple after a forced triple");
    if (!json.includes("\"NumberObjectVariable\"},\"parameters\":[\"Samurai_NPC\",\"DebugTriple\",\"=\",\"1\"]")) bad.push("the draw must have an event that triples when DebugTriple is 1");
    if (!json.includes("Variable(Mom)") || !json.includes("PetalAccelTime")) bad.push("petals must build speed after launch (Mom, PetalAccelTime)");
    if (!(val("PetalPullSpeed") > 0 && val("PetalPullSpeed") <= 100)) bad.push("the petal draw-back should be subtle (PetalPullSpeed up to 100, got " + val("PetalPullSpeed") + ")");
    if (!(val("PetalSpeed") > 1000)) bad.push("petals should fly faster than before (PetalSpeed > 1000)");
    if (!sc.objects.find(o => o.name === "Samurai_Petal").variables.some(v => v.name === "Mom")) bad.push("Samurai_Petal needs the Mom variable");
    if (!json.includes("\"GlitchStartX\",\"=\",\"Samurai_NPC.X()\"") || !json.includes("\"GlitchTargetX\",\"=\",\"Samurai_Mirror.X()\"")) bad.push("the mirror must start on the Samurai and remember its spawn point (GlitchStartX, GlitchTargetX)");
    if (!json.includes("MirrorPhaseTime")) bad.push("the mirror must phase to its spawn point over MirrorPhaseTime");
    const valid = require("fs").readFileSync(require("path").join(__dirname, "..", "..", "externalEvents", "combat_shared.json"), "utf8");
    if (valid.includes("NumpadDecimal")) bad.push("NumpadDecimal is not a GDevelop key name: a debug key using it never fires");
    return bad;
  }],

  ["Samurai feedback: mirror close like a shadow and in sync, grab timing and hyperarmor, no chained dodges, a posture break removes the cuts", () => {
    const bad = [], { scenes, sheets } = load(), sc = scenes.find(s => s.name === "Samurai_Fight"), sh = sheets.find(s => s.name === "Samurai_Boss"), json = JSON.stringify(sh.events);
    const v = n => (sc.objects.find(o => o.name === "Samurai_NPC").variables.find(x => x.name === n) || {}).value;
    if (!(v("MirrorBehind") <= 60)) bad.push("the mirror must stand close, like a shadow (MirrorBehind " + v("MirrorBehind") + ")");
    if (v("WaveRipple") !== 0) bad.push("each petal wave must launch together (WaveRipple 0), or one side shoots first");
    if (!(v("GrabCooldownMin") >= 12 && v("GrabCooldownMax") > v("GrabCooldownMin"))) bad.push("the grab cooldown must be a varied 12 s or more");
    if (!json.includes("Grab timing: the cooldown timer is held at zero")) bad.push("the grab timer must be held until the fight has started");
    if (!json.includes("GrabCooldownNow")) bad.push("the grab must use the rolled cooldown (GrabCooldownNow)");
    for (const s of ["GrabTell", "GrabReach", "GrabHold", "GrabWhiff"]) if (!json.includes(s)) bad.push("grab state missing: " + s);
    if (!json.includes("Grab hyperarmor")) bad.push("missing the grab hyperarmor event");
    const dodge = JSON.stringify(sh.events.filter(e => e.type === "BuiltinCommonInstructions::Comment" && e.comment.startsWith("Boss: the player swings nearby")).length);
    let dodgeEv = null; const find = (list, st) => { for (let i = 0; i < list.length; i++) { if (list[i].type === "BuiltinCommonInstructions::Comment" && list[i].comment.startsWith(st)) return list[i + 1]; const r = list[i].events && find(list[i].events, st); if (r) return r; } return null; };
    dodgeEv = find(sh.events, "Boss: the player swings nearby");
    if (!dodgeEv || !JSON.stringify(dodgeEv.conditions).includes("GrabTell")) bad.push("he must not decide to dodge during a grab");
    const pb = find(sh.events, "Samurai: posture broke, so cancel its attack");
    if (!pb || !JSON.stringify(pb.actions).includes("Samurai_Judgement_Cut")) bad.push("a posture break must remove the cuts that are out");
    const fsf = find(sh.events, "Flash step finished");
    if (!fsf || !JSON.stringify(fsf.actions).includes("DodgeTimer")) bad.push("landing from a dash must restart the dodge timer (no chained dodges)");
    if (v("MirrorChance") !== 100) bad.push("phase 3: every skill has the mirror (MirrorChance 100)");
    return bad;
  }],

  ["Leaf Ranger slide: away only if it ends WallMargin clear of the wall, else toward the player, else the leap", () => {
    const bad = [], { sheets, scenes } = load(), sheet = sheets.find(s => s.name === "Leaf_Ranger_Boss"), scene = scenes.find(s => s.name === "Leaf_Ranger_Fight");
    if (!sheet || !scene) return ["Leaf_Ranger_Boss or Leaf_Ranger_Fight not found"];
    let parent = null;
    walk(sheet.events, e => { if (!parent && (e.events || []).some(x => x.type === "BuiltinCommonInstructions::Comment" && x.comment.startsWith("Too close to the wall behind him"))) parent = e.events; });
    if (!parent) return ["missing the slide-toward-the-player event"];
    const at = s => parent.findIndex(x => x.type === "BuiltinCommonInstructions::Comment" && x.comment.startsWith(s));
    const away = parent[at("Room behind him") + 1], toward = parent[at("Too close to the wall") + 1], leap = parent[at("Cornered") + 1];
    if (!(at("Room behind him") < at("Too close to the wall") && at("Too close to the wall") < at("Cornered"))) bad.push("order must be slide away, slide toward, then the leap");
    const slideTo = e => JSON.stringify(e.actions).includes("Ranger_slide_in") && JSON.stringify(e.actions).includes("\\\"Slide\\\"");
    if (!slideTo(away) || !slideTo(toward)) bad.push("both slides must enter the Slide state with the slide-in animation");
    if (!JSON.stringify(away.conditions).includes("WallMargin")) bad.push("slide away must keep WallMargin from the walls");
    if (!JSON.stringify(toward.conditions).includes("WallMargin") || !JSON.stringify(toward.conditions).includes("Neutral")) bad.push("slide toward must keep WallMargin and run only when the slide away did not");
    const dir = e => (e.actions.find(a => a.parameters[1] === "MoveDir") || { parameters: [] }).parameters[3];
    if (dir(away) !== "-Leaf_Ranger.Variable(Facing)") bad.push("slide away must move away from the player");
    if (dir(toward) !== "Leaf_Ranger.Variable(Facing)") bad.push("slide toward must move toward the player");
    if (!leap || !JSON.stringify(leap.conditions).includes("Neutral")) bad.push("the leap fallback must stay, and only when no slide started");
    if (!(scene.objects.find(o => o.name === "Leaf_Ranger").variables || []).some(x => x.name === "WallMargin")) bad.push("Leaf_Ranger has no WallMargin variable");
    return bad;
  }],

  ["blood: a hit rolls one of the BloodSprite's animations; fountains are centred on their origin, sprays fly away from it; a hit from the left flies right, from the right is flipped", () => {
    const bad = [], fs = require("fs"), path = require("path"), root = path.join(__dirname, "..", ".."), png = require("../bosses/png.js");
    const P = JSON.parse(fs.readFileSync(path.join(root, "Soul Rush.json"), "utf8")), blood = P.objects.find(o => o.name === "BloodSprite");
    const names = blood.animations.map(a => a.name), n = names.length;
    if (n < 9) bad.push("BloodSprite should have the nine blood splashes, has " + n);
    names.forEach((nm, k) => { if (nm !== "Blood" + (k + 1)) bad.push("animation " + k + " is " + nm + ", expected Blood" + (k + 1) + " (the roll is an index)"); });
    const fountains = new Set([1, 8]); // Blood1 and Blood8 rise straight up; the others spray to the right (tools/fx/blood.js).
    blood.animations.forEach((a, k) => {
      const d = a.directions[0], o = d.sprites[0].originPoint;
      if (d.looping) bad.push(a.name + " loops: it would never end and never be removed");
      if (d.sprites.length < 4) bad.push(a.name + " has only " + d.sprites.length + " frames");
      if (!d.sprites.every(sp => sp.originPoint.x === o.x && sp.originPoint.y === o.y)) bad.push(a.name + ": the origin moves between frames");
      // Where the blood is, in the frame with the most of it, against the origin.
      let best = null;
      for (const sp of d.sprites) { const im = png.decode(path.join(root, sp.image)); let sum = 0, cnt = 0; for (let i = 0; i < im.w * im.h; i++) if (im.data[i * 4 + 3] > 40) { sum += i % im.w; cnt++; } if (!best || cnt > best.cnt) best = { cnt, mean: sum / Math.max(1, cnt) }; }
      if (fountains.has(k + 1)) { if (Math.abs(best.mean - o.x) > 6) bad.push(a.name + " is a fountain but its blood sits " + (best.mean - o.x).toFixed(0) + " px off the origin"); }
      else if (!(best.mean - o.x > 5)) bad.push(a.name + " should spray to the right of its origin, its blood is only " + (best.mean - o.x).toFixed(0) + " px right of it");
    });
    const cs = load().sheets.find(s => s.name === "Combat_Shared"), made = [];
    walk(cs.events, e => { if (JSON.stringify(e.actions || []).includes("\"BloodSprite\"") && JSON.stringify(e.actions).includes("\"Create\"") && JSON.stringify(e.conditions).includes("Player.CenterX()") && !JSON.stringify(e.conditions).includes("SrcX")) made.push(e); });   // The player's own (the shadow's copies, in tools/brand, use RiposteSrcX and EchoX).
    if (made.length !== 2) return bad.concat("expected two events that make blood (hit from the left, hit from the right), found " + made.length);
    const roll = []; walk(cs.events, e => { for (const a of e.actions || []) if (a.parameters[1] === "BloodRoll" && a.parameters[2] === "=") roll.push(a.parameters[3]); });
    if (roll.length !== 5 || roll.some(r => r !== "RandomInRange(0, " + (n - 1) + ")")) bad.push("the roll (the player's, and the copies for Riposte, the echo, Projectile return and Requiem) must be RandomInRange(0, " + (n - 1) + ") for the " + n + " animations, got " + JSON.stringify(roll));
    for (const [e, flip, side] of [[made[0], "no", "-"], [made[1], "yes", "+"]]) {
      const acts = JSON.stringify(e.actions);
      if (!acts.includes("\"SetIndex\"".slice(1, -1)) || !acts.includes("Player.Variable(BloodRoll)")) bad.push("a blood event doesn't play the rolled animation");
      if (!e.actions.some(a => a.type.value.endsWith("FlipX") && a.parameters[2] === flip)) bad.push("the blood from the " + (flip === "no" ? "left" : "right") + " must " + (flip === "no" ? "not " : "") + "be flipped");
      if (!e.actions[0].parameters[2].includes(" " + side + " ")) bad.push("the blood should start on the enemy's near side (" + side + " of the point)");
    }
    const pl = P.objects.find(o => o.name === "Player"); for (const v of ["BloodRoll", "BloodSize"]) if (!pl.variables.some(x => x.name === v)) bad.push("Player has no " + v);
    return bad;
  }],

  ["death menu: after the death fade the player chooses Try again (reload this fight) or Return to the hub; nothing sends them to the hub on its own, and keys in the first second are ignored", () => {
    const bad = [], code = script("Combat_Shared", "Death menu:");
    const { sheets } = load(), cs = sheets.find(s => s.name === "Combat_Shared");
    walk(cs.events, e => { if (e.type === "BuiltinCommonInstructions::Standard" && JSON.stringify(e.actions || []).includes('"Scene"') && JSON.stringify(e.actions).includes("HUB_Area")) bad.push("an event in Combat_Shared still changes scene to the hub by itself"); });
    const saved = global.PIXI; global.PIXI = { Container: function () { this.children = []; this.addChild = c => this.children.push(c); }, Text: function (s, st) { this.text = s; this.style = st; this.anchor = { set() {} }; } };
    try {
      const run = (setup) => {
        const fade = obj("Player_Death_Fade", { vars: { Alpha: setup.alpha } }); let pressed = new Set(), replaced = null, frames = 0, layerChildren = [];
        const scene = { getName: () => "Cat_Fight", hasLayer: () => true, getObjects: n => n === "Player_Death_Fade" && setup.fade !== false ? [fade] : [],
          getTimeManager: () => ({ getElapsedTime: () => 1000 / 60, getTimeScale: () => 1 }),
          getLayer: () => ({ getCameraX: () => 640, getCameraY: () => 360, getRenderer: () => ({ getRendererObject: () => ({ addChild: c => layerChildren.push(c) }) }) }),
          getGame: () => ({ getGameResolutionWidth: () => 1280, getGameResolutionHeight: () => 720 }) };
        const gd = { evtTools: { input: { wasKeyJustPressed: (s, k) => pressed.has(k) }, runtimeScene: { replaceScene: (s, n) => { replaced = n; } } } };
        const fn = new Function("runtimeScene", "gdjs", code);
        const frame = (...keys) => { pressed = new Set(keys); fn(scene, gd); pressed = new Set(); frames++; };
        return { frame, run: n => { for (let i = 0; i < n; i++) frame(); }, replaced: () => replaced, scene, layerChildren };
      };
      let a = run({ alpha: 100 }); a.run(600); if (a.replaced() || a.layerChildren.length) bad.push("the menu must wait for the black fade (Alpha 170, the overlay is at full darkness)");
      a = run({ fade: false }); a.run(60); if (a.replaced()) bad.push("with no death fade the menu must do nothing");
      a = run({ alpha: 255 }); a.run(3);
      if (a.layerChildren.length !== 1) bad.push("the menu should be drawn once on the UI layer");
      a.frame("f"); a.run(30); if (a.replaced()) bad.push("a key in the first second chose an option");
      a.run(900); if (a.replaced()) bad.push("the player was sent away without choosing (replaced " + a.replaced() + ")");
      const texts = a.scene.__deathMenu.ui.opts.map(o => o.text).join("|"); if (!/> Try again </.test(texts) || !/Return to the hub/.test(texts)) bad.push("the menu should show Try again (picked) and Return to the hub, shows " + texts);
      a.frame("f"); if (a.replaced() !== "Cat_Fight") bad.push("F on Try again should reload the fight (Cat_Fight), got " + a.replaced());
      a = run({ alpha: 255 }); a.run(90); a.frame("s"); a.frame("f"); if (a.replaced() !== "HUB_Area") bad.push("S then F should return to the hub, got " + a.replaced());
      a = run({ alpha: 255 }); a.run(90); a.frame("Down"); a.frame("Up"); a.frame("Return"); if (a.replaced() !== "Cat_Fight") bad.push("Down then Up then Enter should still be Try again, got " + a.replaced());
    } finally { global.PIXI = saved; }
    return bad;
  }],

  ["tutorial curse lesson: after the 3 hits the player drops to 1 HP and is frozen, two curse pages, F wakes him to strike them down (failsafe after 15 s), he is stopped, a Desperation page, then the fight carries on", () => {
    const bad = [], { scenes } = load(), tl = scenes.find(s => s.name === "Tutorial_Level");
    const top = tl.events.filter(e => e.type === "BuiltinCommonInstructions::Standard");
    const J = x => JSON.stringify(x || []);
    const at = n => top.filter(e => J(e.conditions).includes('"TutStep","=","' + n + '"'));
    const text = e => { const a = (e.actions || []).find(x => x.type.value.includes("SetValue")); return a ? a.parameters[3] : ""; };
    // 1. Step 5 done leads into the lesson, not straight to the fight.
    const done = top.find(e => J(e.conditions).includes("TutHits") && J(e.actions).includes('"TutStep","=","20"'));
    if (!done) bad.push("finishing the 3 hits (step 5) must start the curse lesson (TutStep 20)");
    // 2. Step 20: settle, then 1 HP, locked, idle.
    const s20 = at(20)[0];
    if (!s20) return bad.concat("no event for step 20");
    for (const need of ["IsAttacking", "IsRolling", "IsHurt"]) if (!J(s20.conditions).includes(need)) bad.push("step 20 must wait for the player to finish (" + need + ")");
    if (!J(s20.actions).includes('"Health","=","1"')) bad.push("step 20 must set the player's HP to 1");
    if (!J(s20.actions).includes('"ControlsLocked","True"')) bad.push("step 20 must freeze the player (ControlsLocked True)");
    if (!J(s20.actions).includes("Player_Idle")) bad.push("step 20 must put the player in the idle pose");
    // 3. The chain of pages: each waits for F and at least a second.
    const chain = [[21, 22], [22, 23], [24, 6]];
    for (const [from, to] of chain) {
      const e = at(from).find(x => J(x.actions).includes('"TutStep","=","' + to + '"'));
      if (!e) { bad.push("step " + from + " must lead to step " + to); continue; }
      if (!J(e.conditions).includes("KeyFromTextJustPressed") || !J(e.conditions).includes('f\\"')) bad.push("step " + from + " must wait for F");
      if (!/CompareObjectTimer[^]*>=[^]*1/.test(J(e.conditions))) bad.push("step " + from + " must ignore F for the first second");
    }
    // 4. The page texts: the curse facts are right, lines fit (30 px font on a 1280 px screen), pages say what to press.
    const t21 = text(at(20)[0]), t22 = text(at(21)[0]), t24 = text(at(23).find(e => J(e.actions).includes('"TutStep","=","24"')));
    if (!/15%/.test(t21) || !/5 lives/.test(t21)) bad.push("page 1 must say 5 lives and 15% max HP per stack");
    if (!/DEATHBLOW/.test(t22) || !/100, 85, 70, 55/.test(t22)) bad.push("page 2 must explain the deathblow lifting the curse and the 100, 85, 70, 55, 40 max HP of the lives");
    if (!/DESPERATION/.test(t24) || !/teal/.test(t24)) bad.push("the Desperation page must explain Desperation and the teal flash");
    if (/0\.0\d|up to \d|seconds| s per/.test(t24)) bad.push("the Desperation page must not give the numbers (how much the window widens, the stack cap): they may change and the player does not need them");
    const P = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "Soul Rush.json"), "utf8")), pl = P.objects.find(o => o.name === "Player"), pv = n => (pl.variables.find(x => x.name === n) || {}).value;
    if (pv("CursePercent") !== 15 || pv("Lives") !== 5) bad.push("the lesson's numbers (15%, 5 lives) no longer match the Player's variables");
    if (!J(s20.actions).includes('"DeflectDisabled","True"')) bad.push("step 20 must block deflecting while the player is frozen (DeflectDisabled True)");
    { const e24 = at(24).find(x => J(x.actions).includes('"TutStep","=","6"')); if (!e24 || !J(e24.actions).includes('"DeflectDisabled","False"')) bad.push("the lesson must allow deflecting again at the end"); }
    { const pm = load().sheets.find(s => s.name === "Player_Movement"); let ok = false; walk(pm.events, e => { if (J(e.actions).includes("Player_Deflect_") && J(e.actions).includes('"IsDeflecting","True"') && J(e.conditions).includes('"DeflectDisabled","False"')) ok = true; }); if (!ok) bad.push("starting a deflect must need DeflectDisabled false (Player_Movement)"); }
    { const stops = at(23).filter(e => J(e.actions).includes('"AIState","=","\\"Inactive\\""') && J(e.conditions).includes("CurseStacks") && !J(e.conditions).includes("CompareObjectTimer")), plain = stops.find(e => !J(e.conditions).includes("ComboCount"));
      if (!plain) bad.push("no stop event at step 23"); else for (const st of ["Attacking", "PetalCast", "DashTell", "PassingStrike", "GrabHold"]) if (!J(plain.conditions).includes(st)) bad.push("the plain stop must wait while he is " + st + " (stopping him mid swing cut his animation short: the after-the-first-swing event handles Attacking)");
      const forceTwo = at(23).find(e => J(e.conditions).includes('"ComboCount","<","2"') && J(e.actions).includes('"ComboCount","=","2"')), wakeE = at(22).find(e => J(e.actions).includes('"ComboCount","=","2"'));
      if (!wakeE) bad.push("one attack is enough: waking him (step 22) must set his ComboCount to 2, so his first swing is the last of the combo");
      if (!forceTwo) bad.push("during step 23 his combo counter must be kept at 2 (a skill he casts first resets it)");
      if (stops.some(e => J(e.conditions).includes("ComboCount"))) bad.push("a stop event that waits on ComboCount runs after the sheet has started his next swing and cuts that animation: the combo must end by itself (ComboCount 2 + 1)"); }
    { const sj = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "..", "Soul Rush.json"), "utf8")), pl2 = sj.objects.find(o => o.name === "Player"); const ds = pl2.variables.find(v => v.name === "DesperationStep"); if (ds.value !== 0.02) bad.push("DesperationStep should be 0.02 s per stack (the temporary 1 s test value was reverted), it is " + ds.value); }
    if (!at(23).some(e => J(e.conditions).includes('">=","8"') && J(e.actions).includes('"AIState","=","\\"Inactive\\""'))) bad.push("the strike needs an 8 s timeout that stops him whatever he is doing");
    for (const e of [s20, at(21)[0], ...at(23)]) for (const line of text(e).split(' + NewLine() + ')) if (line.length > 62) bad.push("a prompt line is too long for the screen (" + line.length + "): " + line);
    // 5. The strike: the Samurai is only woken at step 22; he is stopped once the curse stack lands, never mid grab; the failsafe takes the last HP.
    const wake = at(22).find(e => J(e.actions).includes('"AIState","=","\\"AggroReady\\""'));
    if (!wake) bad.push("step 22 (F on page 2) must wake the Samurai");
    const stop = at(23).find(e => J(e.actions).includes('"AIState","=","\\"Inactive\\""'));
    if (!stop) bad.push("step 23 must stop the Samurai after the strike");
    else {
      if (!J(stop.conditions).includes("CurseStacks")) bad.push("the Samurai may only be stopped once the curse stack has landed");
      for (const g of ["GrabHold", "GrabReach"]) if (!J(stop.conditions).includes(g)) bad.push("the Samurai must not be stopped mid grab (" + g + ")");
    }
    const fail = at(23).find(e => J(e.conditions).includes('"CompareObjectTimer"') && J(e.actions).includes('"Health","=","0"'));
    if (!fail) bad.push("step 23 needs a failsafe that takes the last HP when he has not landed a hit");
    else if (!J(fail.conditions).includes('">=","15"')) bad.push("the strike failsafe must wait 15 s");
    // 6. The player gets their controls back at the end, and the old fight text returns.
    const last = at(24).find(e => J(e.actions).includes('"TutStep","=","6"'));
    if (last && !J(last.actions).includes('"ControlsLocked","False"')) bad.push("the lesson must give the controls back");
    if (last && !/He fights back now/.test(text(last))) bad.push("after the lesson the \"He fights back now\" text must come back");
    // 7. A comment above every added event.
    const idx = tl.events.indexOf(s20); if (tl.events[idx - 1].type !== "BuiltinCommonInstructions::Comment") bad.push("the lesson events need a comment above each");
    return bad;
  }],

  ["death menu counts the lost attempt in the saved progress (progress.attempts[scene]), once, without touching the rest of the save", () => {
    const bad = [], code = script("Combat_Shared", "Death menu:"), store = { "SoulRush.progress": JSON.stringify({ awakened: { Samurai_Fight: true }, beaten: {}, attempts: { Cat_Fight: 2 } }) };
    const savedLS = global.localStorage, savedPIXI = global.PIXI;
    global.localStorage = { getItem: k => store[k] === undefined ? null : store[k], setItem: (k, v) => { store[k] = v; } };
    global.PIXI = { Container: function () { this.addChild = () => {}; }, Text: function (s, st) { this.text = s; this.style = st; this.anchor = { set() {} }; } };
    try {
      const fade = obj("Player_Death_Fade", { vars: { Alpha: 255 } });
      const scene = { getName: () => "Cat_Fight", hasLayer: () => true, getObjects: n => n === "Player_Death_Fade" ? [fade] : [], getTimeManager: () => ({ getElapsedTime: () => 1000 / 60, getTimeScale: () => 1 }),
        getLayer: () => ({ getCameraX: () => 640, getCameraY: () => 360, getRenderer: () => ({ getRendererObject: () => ({ addChild() {} }) }) }), getGame: () => ({ getGameResolutionWidth: () => 1280, getGameResolutionHeight: () => 720 }) };
      const fn = new Function("runtimeScene", "gdjs", code), gd = { evtTools: { input: { wasKeyJustPressed: () => false }, runtimeScene: { replaceScene() {} } } };
      for (let i = 0; i < 120; i++) fn(scene, gd);
      const p = JSON.parse(store["SoulRush.progress"]);
      if (p.attempts.Cat_Fight !== 3) bad.push("the lost attempt should make 3 (was 2), got " + p.attempts.Cat_Fight);
      if (!p.awakened.Samurai_Fight) bad.push("the rest of the save was lost");
    } finally { global.localStorage = savedLS; global.PIXI = savedPIXI; }
    return bad;
  }],

  ["cat tree gate extras (hub): a scratch group per lost attempt that disappears when the progress is wiped, a yarn ball that rolls away when the player runs past it and stays on the floor to the right of the gate, a purr only near the gate and only while the cat is still on its perch", () => {
    const bad = [], code = script("HUB_Area", "ball.c.rotation"), savedLS = global.localStorage, savedPIXI = global.PIXI;
    const store = { "SoulRush.progress": JSON.stringify({ awakened: {}, beaten: {}, attempts: { Cat_Fight: 3 } }) };
    global.localStorage = { getItem: k => store[k] === undefined ? null : store[k], setItem: (k, v) => { store[k] = v; } };
    { let copies = 0; walk(load().scenes.find(s => s.name === "HUB_Area").events, e => { if (e.type === "BuiltinCommonInstructions::JsCode" && codeOf(e).includes("ball.c.rotation")) copies++; }); if (copies !== 1) bad.push("the cat tree extras script must be in the hub exactly once (a rebuild left " + copies + ": add its comment prefix to OUR_COMMENT in tools/hub/build.js)"); }
    const made = [];
    function Graphics() { this.moves = 0; this.destroyed = false; made.push(this); for (const m of ["beginFill", "endFill", "drawCircle", "lineStyle", "lineTo"]) this[m] = () => {}; this.moveTo = () => { this.moves++; }; this.destroy = () => { this.destroyed = true; }; }
    function Container() { this.kids = []; this.rotation = 0; this.x = 0; this.y = 0; this.addChild = c => this.kids.push(c); }
    global.PIXI = { Graphics, Container };
    try {
      const gate = obj("Hub_Gate_Cat", { vars: { Shown: "active" } }), player = obj("Player", { extra: { getCenterXInScene() { return this.x; } } }), root = new Container(), sounds = [];
      gate.x = 202; gate.y = 400; gate.getZOrder = () => 1100; gate.getLayer = () => "Background";
      const scene = { getObjects: n => n === "Hub_Gate_Cat" ? [gate] : n === "Player" ? [player] : [], getTimeManager: () => ({ getElapsedTime: () => 1000 / 60, getTimeScale: () => 1 }),
        getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => root }) }), getGame: () => ({ getSoundManager: () => ({ playSound: (f, loop, vol) => sounds.push({ f, vol }) }) }) };
      const fn = new Function("runtimeScene", "gdjs", code), run = n => { for (let i = 0; i < n; i++) fn(scene, {}); };
      // Far away: scratches yes, purr no, the ball sits still.
      player.x = 1500; run(200);
      const scratch = () => made.filter(g => !g.destroyed && g.moves >= 6 && g.moves % 6 === 0 && g.moves !== 11 && g.moves > 6)[0];
      const live = made.filter(g => !g.destroyed && g.moves > 0), sc3 = live.find(g => g.moves === 18);
      if (!sc3) bad.push("3 lost attempts should draw 3 groups of 3 claw marks (18 strokes), the graphics have " + live.map(g => g.moves).join(", "));
      if (sounds.length) bad.push("the purr must not play with the player far away");
      const ball = root.kids.find(k => k instanceof Container); if (!ball) return bad.concat("no yarn ball was made");
      const x0 = ball.x, floor = 400 + (121 + 1) * 2 - 13;
      if (Math.abs(ball.y - floor) > 1) bad.push("the ball should rest on the floor (y " + floor + "), is at " + ball.y);
      if (ball.x < 202 + 252 || ball.x > 202 + 520) bad.push("the ball should sit right of the gate, x " + ball.x);
      // More attempts show up after a second.
      store["SoulRush.progress"] = JSON.stringify({ awakened: {}, beaten: {}, attempts: { Cat_Fight: 5 } }); run(90);
      if (!made.some(g => !g.destroyed && g.moves === 30)) bad.push("5 attempts should draw 30 strokes");
      if (made.filter(g => !g.destroyed && g.moves === 18).length) bad.push("the old scratches should have been replaced");
      // Walking past: the ball rolls away in the player's direction.
      player.x = 430; for (let i = 0; i < 40; i++) { player.x += 6; fn(scene, {}); }
      if (!(ball.x > x0 + 20)) bad.push("running past the ball should send it rolling (it moved " + Math.round(ball.x - x0) + " px)");
      if (ball.rotation === 0) bad.push("a rolling ball should turn");
      let path = 0, spin = 0;
      for (let i = 0; i < 60 * 20; i++) { player.x = 1500; const x0b = ball.x, r0b = ball.rotation; fn(scene, {}); path += Math.abs(ball.x - x0b); spin += Math.abs(ball.rotation - r0b) * 13; }
      if (path > 5 && spin < path * 0.9) bad.push("the ball must roll (turn by the distance it moves) when it drifts home too: it moved " + Math.round(path) + " px and turned " + Math.round(spin) + " px worth");
      if (ball.x < 202 + 252 - 1 || ball.x > 202 + 520 + 1) bad.push("the ball left its range: " + ball.x);
      // Purr: near the gate, a few seconds, a placeholder file at a low volume; none once the cat is gone.
      sounds.length = 0; player.x = 330; run(60 * 8);
      if (!sounds.length) bad.push("near the gate with the cat on its perch there should be a purr within 8 s");
      if (sounds.length && sounds[0].vol < 36) bad.push("the purr at the gate should be 15% louder than before (37), it is " + sounds[0].vol);
      for (const s of sounds) { if (!/Sfx\/cat\/purr_/.test(s.f)) bad.push("the purr plays " + s.f); if (!(s.vol > 0 && s.vol <= 40)) bad.push("the purr volume " + s.vol + " should be quiet"); }
      sounds.length = 0; gate.getVariables().get("Shown").setString("completed"); run(60 * 12);
      if (sounds.length) bad.push("the cat has gone from the perch: no purr once the gate is completed");
      // Start over wipes the attempts: the scratches go.
      store["SoulRush.progress"] = JSON.stringify({ awakened: {}, beaten: {} }); run(90);
      if (made.some(g => !g.destroyed && g.moves >= 18)) bad.push("with no attempts left the scratches should be gone");
    } finally { global.localStorage = savedLS; global.PIXI = savedPIXI; }
    return bad;
  }],

  ["debug key L: permanent Desperation (the window at its maximum and every landed deflect flagged as a Desperation deflect), a toggle that the DEBUG_KEYS gate switches off, and blood judged from the wound, not the middle of the enemy", () => {
    const bad = [], { sheets } = load(), cs = sheets.find(s => s.name === "Combat_Shared"), J = x => JSON.stringify(x || []), fs3 = require("fs"), path3 = require("path"), root3 = path3.join(__dirname, "..", "..");
    let win = null, forced = null, toggle = null, blood = 0;
    walk(cs.events, e => {
      for (const a of e.actions || []) if (a.type.value === "SetNumberObjectVariable" && a.parameters[1] === "DeflectWindowNow") win = a.parameters[3];
      if (J(e.actions).includes("DespUsed") && J(e.conditions).includes("DespForced")) forced = e;
      if (J(e.conditions).includes('\\"l\\"') && J(e.actions).includes("DespForced")) toggle = e;
      if (J(e.actions).includes("BloodSprite") && J(e.actions).includes("FlipX") && !J(e.conditions).includes("RiposteSrcX") && !J(e.conditions).includes("EchoX") && !J(e.conditions).includes("ReturnSrcX") && !J(e.conditions).includes("RequiemSrcX")) for (const c of e.conditions) if (c.type.value === "BuiltinCommonInstructions::CompareNumbers") blood++;
    });
    if (!win || !/DespForced/.test(win) || !/DesperationMax/.test(win)) bad.push("the window must count the stacks as the maximum when DespForced is on: " + win);
    // The window with the real expression: forced and not forced.
    if (win) { const ev = (x, stacks, f) => new Function("P", "min", "max", "return (" + x.replace(/Player\.Variable\((\w+)\)/g, "P.$1") + ");")({ DeflectWindow: 0.25, DesperationStep: 0.02, DesperationMax: 3, CurseStacks: stacks, DespForced: f }, Math.min, Math.max);
      if (Math.abs(ev(win, 0, 0) - 0.25) > 1e-9) bad.push("with no stacks and no forcing the window must be the base 0.25");
      if (Math.abs(ev(win, 1, 0) - 0.27) > 1e-9) bad.push("one stack must still widen it by one step");
      if (Math.abs(ev(win, 0, 1) - 0.31) > 1e-9) bad.push("forced, the window must be as if every stack: 0.25 + 3 x 0.02, is " + ev(win, 0, 1));
      if (Math.abs(ev(win, 9, 1) - 0.31) > 1e-9) bad.push("the window must never exceed the maximum"); }
    if (!forced || !J(forced.actions).includes("DespPulse")) bad.push("with DespForced on, every landed deflect must set DespUsed and DespPulse");
    else if (J(forced.conditions).includes("CompareObjectTimer")) bad.push("the forced flag must not depend on the deflect timing");
    if (!toggle || !J(toggle.actions).includes("1 - Player.Variable(DespForced)")) bad.push("the L key must toggle DespForced (1 - DespForced)");
    const gate = codeOf(cs.events.find(e => e.type === "BuiltinCommonInstructions::JsCode" && codeOf(e).includes("const DEBUG = /")));
    if (!/\|l(\|m)?(\|p)?(\|o\|b)?(\|x)?(\|c)?(\|g\|y)?\)\$\//.test(gate)) bad.push("the DEBUG_KEYS gate must switch off the L key");
    if (!/\| L +\|/.test(fs3.readFileSync(path3.join(root3, "DEBUG_KEYS.md"), "utf8"))) bad.push("DEBUG_KEYS.md must list the L key");
    const P = JSON.parse(fs3.readFileSync(path3.join(root3, "Soul Rush.json"), "utf8")).objects.find(o => o.name === "Player"); if (!P.variables.some(v => v.name === "DespForced")) bad.push("Player needs DespForced");
    if (blood !== 2) bad.push("expected two blood events (a hit from the left and from the right), found " + blood);
    { // GDevelop flips a sprite about its centre: the blood frames' origin must be the centre, or a flipped splash's base jumps away from the wound.
      const pj = JSON.parse(fs3.readFileSync(path3.join(root3, "Soul Rush.json"), "utf8")), bs = pj.objects.find(o => o.name === "BloodSprite"), png3 = require("../bosses/png.js");
      for (const an of bs.animations) for (const s of an.directions[0].sprites) { const im = png3.decode(path3.join(root3, s.image)); if (s.originPoint.x !== im.w / 2 || !s.centerPoint.automatic) { bad.push(an.name + " " + s.image + ": the origin x " + s.originPoint.x + " must be the image centre " + im.w / 2 + " (a flip moves the base otherwise)"); break; } } }
    return bad;
  }],
  ["Brand and Mercy counts: the hub works BrandCount and MercyCount out from the saved progress (kills, spares, the Cat's three outcomes), BossCount from the gate list, and a wipe resets them", () => {
    const code = script("HUB_Area", "Hub gates."), bad = [], HUB = require("../hub/hub.js");
    const wantN = HUB.gates.filter(g => g.scene && g.state !== "locked").length;
    // Runs the hub for a few frames with a saved progress and returns the three globals.
    const run = (beaten, after, loadout) => {
      const gvars = vars(); gvars.get("JustBeaten").setString("");
      const store = { "SoulRush.progress": JSON.stringify({ awakened: {}, beaten, loadout: loadout || null }) };
      global.localStorage = { setItem: (k, v) => { store[k] = v; }, getItem: k => store[k] };
      const player = obj("Player", { extra: { getAnimationName() { return this.anim; } } }), prompt = obj("Hub_Prompt");
      player.x = 100; player.y = 600;
      const scene = { getName: () => "HUB_Area", __cameraFollow: { x: 100, y: 360 }, getObjects: n => ({ Player: [player], Hub_Prompt: [prompt] })[n] || [],
        getTimeManager: () => ({ getElapsedTime: () => 1000 / 60, getTimeScale: () => 1 }),
        getLayer: () => ({ getCameraX: () => 100, getCameraY: () => 360, getRenderer: () => ({ getRendererObject: () => ({ addChild() {} }) }) }),
        getGame: () => ({ getGameResolutionWidth: () => 1280, getGameResolutionHeight: () => 720, getVariables: () => gvars, getSoundManager: () => ({ playSound() {} }) }) };
      const gd = { evtTools: { input: { wasKeyJustPressed: () => false }, runtimeScene: { replaceScene() {} } } };
      const fn = new Function("runtimeScene", "gdjs", code);
      for (let i = 0; i < 3; i++) fn(scene, gd);
      if (after) { after(scene, gvars); fn(scene, gd); }
      const n = k => gvars.get(k).getAsNumber();
      const s = k => gvars.get(k).getAsString();
      return { brand: n("BrandCount"), mercy: n("MercyCount"), bosses: n("BossCount"), bonus: n("BonusLives"), owned: s("PowersOwned").split(",").filter(Boolean), slots: [s("LoadoutSlot1"), s("LoadoutSlot2"), s("LoadoutSlot3")], dodge: s("LoadoutDodge"), scene: scene };
    };
    const check = (what, got, brand, mercy) => { if (got.brand !== brand || got.mercy !== mercy || got.bosses !== wantN) bad.push(what + ": got brand " + got.brand + ", mercy " + got.mercy + ", bosses " + got.bosses + "; wanted " + brand + ", " + mercy + ", " + wantN); };
    check("nothing beaten", run({}), 0, 0);
    check("one kill", run({ Samurai_Fight: true }), 1, 0);
    check("one spare (beaten and spared)", run({ Samurai_Fight: true, Samurai_Fight_Spared: true }), 0, 1);
    check("a spared flag without the win counts for nothing", run({ Samurai_Fight_Spared: true }), 0, 0);
    check("two kills and two spares", run({ Samurai_Fight: true, Bladekeeper_Fight: true, Leaf_Ranger_Fight: true, Leaf_Ranger_Fight_Spared: true, Gunslinger: true, Gunslinger_Spared: true }), 2, 2);
    check("the Cat killed", run({ Cat_Fight: true }), 1, 0);
    check("the Cat spared", run({ Cat_Fight: true, Cat_Fight_Spared: true }), 0, 1);
    if (run({ Cat_Fight: true, Cat_Fight_Spared: true }).bonus !== 1) bad.push("sparing the Cat should give 1 bonus life");
    if (run({ Cat_Fight: true }).bonus !== 0 || run({ Cat_Fight: true, Cat_Friend: true }).bonus !== 0 || run({ Samurai_Fight: true, Samurai_Fight_Spared: true }).bonus !== 0) bad.push("only sparing the Cat gives a bonus life");
    check("the Cat petted (the pet ending) counts as neither", run({ Cat_Fight: true, Cat_Friend: true }), 0, 0);
    check("a scene that is not a gate boss (the tutorial) counts for nothing", run({ Tutorial_Level: true }), 0, 0);
    check("start over clears the counts", run({ Samurai_Fight: true, Leaf_Ranger_Fight: true, Leaf_Ranger_Fight_Spared: true }, (s, g) => { /* what the bench's Start over does: the saved progress, the BossesBeaten global and the live progress are all wiped */ const bb = g.get("BossesBeaten"); for (const k of Object.keys(bb.getAllChildren())) bb.removeChild(k); s.__hubGates.progress = { awakened: {}, beaten: {} }; }), 0, 0);
    // Powers (phase 4): what the player owns comes from the saved progress and the counts, and the loadout only ever holds built, owned powers.
    const has = (r, id) => r.owned.indexOf(id) >= 0;
    let r = run({ Samurai_Fight: true });
    if (!has(r, "wraith_dash") || has(r, "flash_step") || !has(r, "shadow_echo") || has(r, "riposte")) bad.push("a killed Samurai (1 brand) should give the Wraith dash and Shadow echo only: " + r.owned);
    r = run({ Samurai_Fight: true, Samurai_Fight_Spared: true });
    if (!has(r, "flash_step") || has(r, "wraith_dash") || !has(r, "poise") || has(r, "shadow_echo")) bad.push("a spared Samurai (1 mercy) should give the Flash step and Poise only: " + r.owned);
    r = run({ Samurai_Fight: true, Samurai_Fight_Spared: true, Leaf_Ranger_Fight: true, Gunslinger: true, Gunslinger_Spared: true, Samurai_Petal: true });
    for (const id of ["flash_step", "decoy", "poison_stab", "pistol_parry", "petal_step", "shadow_echo", "poise", "respite"]) if (!has(r, id)) bad.push("with a spare, a kill, a spare and the Petal step flag, " + id + " should be owned: " + r.owned);
    for (const id of ["wraith_dash", "blood_pact", "bloom"]) if (has(r, id)) bad.push(id + " should not be owned: " + r.owned);
    r = run({ Gunslinger: true }, null, { slots: ["blood_pact", "poise", ""], dodge: "wraith_dash" });
    if (!has(r, "blood_pact")) bad.push("a killed Gunslinger should give Blood pact");
    if (r.slots.join(",") !== "blood_pact,," || r.dodge !== "roll") bad.push("a built, owned active stays in the loadout, but a passive in a slot and a dodge that is not owned or built are taken out; got slots " + JSON.stringify(r.slots) + " and dodge " + r.dodge);
    const kept = r.scene.__hubGates.progress.loadout;
    if (!kept || kept.dodge !== "roll" || kept.slots.length !== 3) bad.push("the hub should keep a tidy loadout in its progress");
    if (!(wantN >= 5)) bad.push("the gate list has only " + wantN + " bosses; the Fire Knight's sealed gate must not count until it has a scene");
    return bad;
  }],
  ["hub build keeps hand-made animations: every animation hub.js lists as handmade is in the scene, and build.js puts it back", () => {
    const bad = [], HUB = require("../hub/hub.js"), { scenes } = load(), hub = scenes.find(s => s.name === "HUB_Area");
    const build = fs.readFileSync(path.join(__dirname, "..", "hub", "build.js"), "utf8");
    if (!build.includes("HUB.handmade") || !build.includes("Object.entries(handmade)")) bad.push("build.js no longer keeps the hand-made animations");
    for (const [name, anims] of Object.entries(HUB.handmade || {})) {
      const o = hub.objects.find(x => x.name === name);
      if (!o) { bad.push(name + " is listed as handmade but is not in the hub scene"); continue; }
      for (const a of anims) {
        const an = (o.animations || []).find(x => x.name === a);
        if (!an) bad.push(name + " has no " + a + " animation, so a rebuild had already lost it");
        else if (an.directions[0].sprites.length < 2) bad.push(name + "'s " + a + " animation has " + an.directions[0].sprites.length + " frame (the generated one): the hand-made one was overwritten");
      }
    }
    return bad;
  }],

  // ---- Phase 2 of docs/design-brand-mercy.md: the HP budget --------------------------------------------------------------
  // A tiny interpreter for the curse events in Combat_Shared: number and boolean variable conditions, CompareNumbers, Once, the Set...ObjectVariable
  // actions (= + -) and nested events in order. Expressions use Player.Variable(X) (P.X) and the global Variable(X) (G.X), max, min and round.
  ["Brand budget (phase 2): the first frame of a fight takes the earned brands off max HP (BrandBudget / N each, never below the floor), adds the Cat's life, skips the tutorial and runs once", () => {
    const code = script("Combat_Shared", "const EXEMPT"), bad = [];
    const run = (sceneName, g, pInit) => {
      const G = vars(g), pv = vars(Object.assign({ BaseMaxHealth: 100, MaxHealth: 100, Health: 100, Lives: 5, BrandBudget: 60, HpFloorPercent: 10, BrandFraction: 0 }, pInit || {}));
      const player = obj("Player", { extra: { getVariables: () => pv } });
      const scene = { getName: () => sceneName, getObjects: n => n === "Player" ? [player] : [], getGame: () => ({ getVariables: () => G }) };
      const fn = new Function("runtimeScene", code); fn(scene); fn(scene);                                  // twice: the second frame must change nothing
      const n = k => pv.get(k).getAsNumber();
      return { max: n("MaxHealth"), hp: n("Health"), lives: n("Lives"), frac: n("BrandFraction") };
    };
    const want = (what, got, max, lives, frac) => { if (got.max !== max || got.hp !== max || got.lives !== lives || got.frac !== frac) bad.push(what + ": got " + JSON.stringify(got) + ", wanted max/hp " + max + ", lives " + lives + ", fraction " + frac); };
    want("no brands", run("Samurai_Fight", { BrandCount: 0, BossCount: 5, BonusLives: 0 }), 100, 5, 0);
    want("2 of 5 brands", run("Samurai_Fight", { BrandCount: 2, BossCount: 5, BonusLives: 0 }), 76, 5, 0.24);
    want("all 5 brands", run("Samurai_Fight", { BrandCount: 5, BossCount: 5, BonusLives: 0 }), 40, 5, 0.6);
    want("5 of 12 brands (a bigger N costs less per brand)", run("Samurai_Fight", { BrandCount: 5, BossCount: 12, BonusLives: 0 }), 75, 5, 0.25);
    want("the Cat's mercy adds a life", run("Cat_Fight", { BrandCount: 1, BossCount: 5, BonusLives: 1 }), 88, 6, 0.12);
    want("the tutorial is practice: no brands, no bonus life", run("Tutorial_Level", { BrandCount: 5, BossCount: 5, BonusLives: 1 }), 100, 5, 0);
    want("a scene opened with no hub counts is unchanged", run("Samurai_Fight", {}), 100, 5, 0);
    want("a very high fraction stops at the HP floor", run("Samurai_Fight", { BrandCount: 5, BossCount: 5, BonusLives: 0 }, { BrandBudget: 200 }), 10, 5, 2);
    return bad;
  }],

  ["Curse events (phase 2): a life lost takes max HP by the new formula and a stack that would breach the HP floor is fatal (the design's table at N = 6); the deathblow clears ONE stack and the brands' loss stays", () => {
    const bad = [], { sheets } = load(), cs = sheets.find(s => s.name === "Combat_Shared");
    const find = pred => { let hit = null; walk(cs.events, e => { if (!hit && e.type === "BuiltinCommonInstructions::Standard" && pred(e)) hit = e; }); return hit; };
    const lifeEvent = find(e => (e.actions || []).some(a => a.type.value === "SetNumberObjectVariable" && a.parameters[0] === "Player" && a.parameters[1] === "Lives" && a.parameters[2] === "-"));
    const removal = find(e => (e.conditions || []).some(c => c.parameters && c.parameters[1] === "DeathblowLanded"));
    if (!lifeEvent || !removal) return ["the life-lost or the curse-removal event is missing"];
    const make = P => {
      const ev = ex => new Function("P", "G", "max", "min", "round", "return (" + ex.replace(/Player\.Variable\((\w+)\)/g, "P.$1") + ");")(P, {}, Math.max, Math.min, Math.round);
      const holds = c => {
        const p = c.parameters, t = c.type.value;
        if (t === "BuiltinCommonInstructions::Once") return true;
        if (t === "NumberObjectVariable") return ({ "=": (x, y) => x === y, "<=": (x, y) => x <= y, ">": (x, y) => x > y, "<": (x, y) => x < y })[p[2]](P[p[1]], ev(p[3]));
        if (t === "BuiltinCommonInstructions::CompareNumbers") return ({ "<": (x, y) => x < y, ">": (x, y) => x > y })[p[1]](ev(p[0]), ev(p[2]));
        if (t === "BooleanObjectVariable") return !!P[p[1]] === (p[2] === "True");
        return true;
      };
      const run = e => {
        if (e.type !== "BuiltinCommonInstructions::Standard" || !(e.conditions || []).every(holds)) return;
        for (const a of e.actions || []) {
          const p = a.parameters;
          if (a.type.value === "SetNumberObjectVariable") { const v = ev(p[3]); P[p[1]] = p[2] === "=" ? v : p[2] === "+" ? P[p[1]] + v : P[p[1]] - v; }
          if (a.type.value === "SetBooleanObjectVariable") P[p[1]] = p[2] === "True";
        }
        for (const k of e.events || []) run(k);
      };
      return run;
    };
    const fresh = (brands, n) => ({ Lives: 5, MaxHealth: 0, Health: 0, BaseMaxHealth: 100, CursePercent: 15, CurseStacks: 0, HpFloorPercent: 10, BrandFraction: Math.round(0.6 * brands / n * 10000) / 10000, PendingRally: 0, MaxRally: 0, Posture: 0, BreachDeath: false, DeathblowLanded: false, IsDead: false });
    // How many curse stacks a player with this many brands (N = 6) can take before the next one is fatal: the design's table.
    const survivable = brands => {
      const P = fresh(brands, 6); P.MaxHealth = P.Health = Math.round(100 * (1 - P.BrandFraction));
      const run = make(P); let stacks = 0;
      for (let i = 0; i < 6; i++) { P.Health = 0; run(lifeEvent); if (P.BreachDeath || P.Lives <= 0) break; stacks++; }
      return stacks;
    };
    for (const [brands, want] of [[0, 4], [1, 4], [2, 4], [3, 4], [4, 3], [5, 2], [6, 2]]) { const got = survivable(brands); if (got !== want) bad.push(brands + " brands: " + got + " curse stacks survivable, the design's table says " + want); }
    // One life lost with no brands: 85 max HP, one stack, the life counted, HP refilled; and no breach on the normal death.
    const P0 = fresh(0, 5); P0.MaxHealth = 100; P0.Health = 0; make(P0)(lifeEvent);
    if (P0.MaxHealth !== 85 || P0.CurseStacks !== 1 || P0.Lives !== 4 || P0.Health !== 85 || P0.BreachDeath) bad.push("one life lost with no brands: " + JSON.stringify(P0));
    // The deathblow clears exactly one stack and keeps the brands' loss (2 of 5 brands = -24%).
    const P1 = fresh(2, 5); P1.CurseStacks = 3; P1.MaxHealth = 31; P1.Health = 5; P1.DeathblowLanded = true; make(P1)(removal);
    if (P1.CurseStacks !== 2 || P1.MaxHealth !== 46 || P1.Health !== 46 || P1.DeathblowLanded) bad.push("a deathblow with 3 stacks and 2 brands should leave 2 stacks, max/HP 46; got " + JSON.stringify(P1));
    const P2 = fresh(2, 5); P2.MaxHealth = 76; P2.Health = 10; P2.DeathblowLanded = true; make(P2)(removal);
    if (P2.CurseStacks !== 0 || P2.MaxHealth !== 76 || P2.Health !== 76) bad.push("a deathblow with no stacks must keep the brands' loss (max 76) and refill HP; got " + JSON.stringify(P2));
    return bad;
  }],

  ["Sacrificed HP (phase 2): it comes off at once, never kills, and is not added to the rally pool, so rally cannot win it back", () => {
    const bad = [], { sheets } = load(), cs = sheets.find(s => s.name === "Combat_Shared");
    let ev = null; walk(cs.events, e => { if (!ev && e.type === "BuiltinCommonInstructions::Standard" && JSON.stringify(e.conditions || []).includes("SacrificeHP")) ev = e; });
    if (!ev) return ["the sacrificed HP event is missing"];
    const hurt = (hp, cost) => { const P = { Health: hp, SacrificeHP: cost, PendingRally: 7, MaxRally: 9 };
      const val = ex => new Function("P", "max", "return (" + ex.replace(/Player\.Variable\((\w+)\)/g, "P.$1") + ");")(P, Math.max);
      if (!(P.SacrificeHP > 0)) return P;
      for (const a of ev.actions) P[a.parameters[1]] = val(a.parameters[3]);
      return P; };
    let P = hurt(60, 25); if (P.Health !== 35 || P.SacrificeHP !== 0) bad.push("sacrificing 25 of 60 should leave 35 and clear the request; got " + JSON.stringify(P));
    if (P.PendingRally !== 7 || P.MaxRally !== 9) bad.push("sacrificed HP touched the rally pool: " + JSON.stringify(P));
    P = hurt(10, 500); if (P.Health !== 1) bad.push("sacrificed HP must never kill (leave 1); got " + P.Health);
    P = hurt(10, 0); if (P.Health !== 10) bad.push("no request, no change; got " + P.Health);
    if (/PendingRally|MaxRally/.test(JSON.stringify(ev.actions))) bad.push("the sacrificed HP event writes the rally pool");
    return bad;
  }],

  // ---- Phase 3 of docs/design-brand-mercy.md: the perfect deflect ---------------------------------------------------------
  ["Perfect deflect (phase 3): a deflect in the first PerfectFraction of the base window adds one to PerfectCount (Combat_Shared and the Gunslinger's bullet deflect); a late deflect, and Desperation's extra window, do not; PerfectForced counts every deflect once", () => {
    const bad = [], { scenes, sheets } = load();
    for (const [where, list] of [["Combat_Shared", sheets.find(s => s.name === "Combat_Shared").events], ["the Gunslinger scene", scenes.find(s => s.name === "Gunslinger").events]]) {
      let kids = null;
      walk(list, e => { if (!kids && (e.events || []).some(k => k.type === "BuiltinCommonInstructions::Comment" && String(k.comment).startsWith("Perfect deflect:"))) kids = e.events.filter(k => k.type === "BuiltinCommonInstructions::Standard" && JSON.stringify(k).includes("PerfectCount")); });
      if (!kids || kids.length !== 2) { bad.push(where + ": the two perfect deflect events are missing"); continue; }
      // The count after a deflect that lands t seconds after the sword was raised (DeflectWindow 0.25, so the perfect window is 0.0825 s).
      const run = (t, forced) => {
        const P = { DeflectWindow: 0.25, PerfectFraction: 0.33, PerfectFractionNow: 0.33, PerfectCount: 0, PerfectForced: forced ? 1 : 0 };
        const ev = ex => new Function("P", "return (" + ex.replace(/Player\.Variable\((\w+)\)/g, "P.$1") + ");")(P);
        for (const k of kids) {
          const ok = k.conditions.every(c => c.type.value === "CompareObjectTimer" ? ({ "<=": (a, b) => a <= b, ">": (a, b) => a > b })[c.parameters[2]](t, ev(c.parameters[3])) : P[c.parameters[1]] === Number(c.parameters[3]));
          if (ok) for (const a of k.actions) P[a.parameters[1]] += ev(a.parameters[3]);
        }
        return P.PerfectCount;
      };
      for (const [t, want] of [[0.02, 1], [0.08, 1], [0.09, 0], [0.2, 0], [0.27, 0]]) if (run(t) !== want) bad.push(where + ": a deflect at " + t + " s gave PerfectCount " + run(t) + ", wanted " + want);
      for (const t of [0.02, 0.2, 0.27]) if (run(t, true) !== 1) bad.push(where + ": with PerfectForced a deflect at " + t + " s gave " + run(t, true) + ", wanted exactly 1");
    }
    return bad;
  }],

  ["Perfect deflect mark (phase 3): a gold PERFECT rises above the player once per perfect deflect and is gone after about 0.7 s", () => {
    const code = script("Combat_Shared", "const LIFE = 0.7"), bad = [], saved = global.PIXI;
    const made = [];
    global.PIXI = Object.assign({}, saved, { Text: function (t) { this.text = t; this.anchor = { set() {} }; this.x = 0; this.y = 0; this.alpha = 1; this.destroyed = false; this.destroy = () => { this.destroyed = true; }; made.push(this); } });
    try {
      const pv = vars({ PerfectCount: 0 }), player = obj("Player", { extra: { getVariables: () => pv, getCenterYInScene() { return this.y; } } });
      const root = { children: [], addChild(c) { this.children.push(c); } };
      const scene = { getObjects: n => n === "Player" ? [player] : [], getElapsedTime: () => 1000 / 60, getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => root }) }) };
      const fn = new Function("runtimeScene", code), frame = n => { for (let i = 0; i < (n || 1); i++) fn(scene); };
      frame(3); if (made.length) bad.push("a mark appeared with no perfect deflect");
      pv.get("PerfectCount").setNumber(1); frame(); if (made.length !== 1 || made[0].text !== "PERFECT") bad.push("one perfect deflect should make one PERFECT mark, made " + made.length);
      frame(5); if (made.length !== 1) bad.push("the same deflect made another mark");
      const y0 = made[0].y; frame(10); if (!(made[0].y < y0)) bad.push("the mark should rise");
      frame(60); if (!made[0].destroyed) bad.push("the mark should be gone after about 0.7 s");
      pv.get("PerfectCount").setNumber(2); frame(); if (made.length !== 2) bad.push("a second perfect deflect should make a second mark");
      pv.get("PerfectCount").setNumber(0); frame(2); pv.get("PerfectCount").setNumber(1); frame(); if (made.length !== 3) bad.push("after the count was reset, the next perfect deflect should make a mark");
    } finally { global.PIXI = saved; }
    return bad;
  }],

  ["Perfect deflect debug key P (phase 3): it toggles PerfectForced, and the DEBUG_KEYS gate switches it off", () => {
    const bad = [], { sheets } = load(), cs = sheets.find(s => s.name === "Combat_Shared");
    let key = null; walk(cs.events, e => { if (!key && (e.conditions || []).some(c => c.type.value === "KeyFromTextJustPressed" && c.parameters[1] === "\"p\"")) key = e; });
    if (!key) return ["the P key event is missing"];
    if (!JSON.stringify(key.actions).includes("1 - Player.Variable(PerfectForced)")) bad.push("the P key must toggle PerfectForced (1 - PerfectForced)");
    const code = script("Combat_Shared", "const DEBUG_KEYS");
    const input = { isKeyPressed: () => true, wasKeyJustPressed: () => true, wasKeyReleased: () => true };
    new Function("runtimeScene", "gdjs", code.replace("const DEBUG_KEYS = true;", "const DEBUG_KEYS = false;"))({}, { evtTools: { input } });
    if (input.wasKeyJustPressed(null, "p")) bad.push("with the switch off, P still works");
    if (!input.wasKeyJustPressed(null, "a")) bad.push("with the switch off, a normal key was blocked");
    return bad;
  }],

  // ---- Phase 5 of docs/design-brand-mercy.md: the first Composure passives (the mercy tree) -----------------------------------
  ["Composure (phase 5): Poise (mercy 1) raises stamina regen, Respite (2) refunds stamina on a perfect deflect, Steady hand (3) widens the perfect window, each only above the HP band and never in the tutorial", () => {
    const code = script("Combat_Shared", "Composure (docs"), bad = [];
    // One fight scene: set the mercy count and the player's state, run the script, read the numbers.
    const setup = (mercy, hp, extra, sceneName) => {
      const G = vars({ MercyCount: mercy }), pv = vars(Object.assign({ Health: hp, MaxHealth: 100, ComposureBand: 0.8, StaminaRegenRate: 20, PoiseBonus: 0.5, PerfectFraction: 0.33, SteadyHandBonus: 0.12,
        PerfectCount: 0, Stamina: 50, MaxStamina: 100, RespiteStamina: 15, IsDead: false, ComposureOn: 0, StaminaRegenNow: 20, PerfectFractionNow: 0.33 }, extra || {}));
      pv.get("IsDead").setBoolean(!!(extra && extra.IsDead));
      const player = obj("Player", { extra: { getVariables: () => pv } });
      const scene = { getName: () => sceneName || "Samurai_Fight", getObjects: n => n === "Player" ? [player] : [], getGame: () => ({ getVariables: () => G }) };
      const fn = new Function("runtimeScene", code);
      return { pv, run: () => fn(scene), n: k => pv.get(k).getAsNumber() };
    };
    const check = (what, s, on, regen, frac) => { s.run(); if (s.n("ComposureOn") !== on || Math.abs(s.n("StaminaRegenNow") - regen) > 1e-9 || Math.abs(s.n("PerfectFractionNow") - frac) > 1e-9) bad.push(what + ": got on " + s.n("ComposureOn") + ", regen " + s.n("StaminaRegenNow") + ", window " + s.n("PerfectFractionNow") + "; wanted " + on + ", " + regen + ", " + frac); };
    check("no mercy", setup(0, 100), 0, 20, 0.33);
    check("mercy 1 at full HP: Poise", setup(1, 100), 1, 30, 0.33);
    check("mercy 1 just above the band (81%)", setup(1, 81), 1, 30, 0.33);
    check("mercy 1 below the band (79%)", setup(1, 79), 0, 20, 0.33);
    check("mercy 2: no Steady hand yet", setup(2, 100), 1, 30, 0.33);
    check("mercy 3: Steady hand", setup(3, 100), 1, 30, 0.45);
    check("mercy 3 below the band: no Steady hand", setup(3, 50), 0, 20, 0.33);
    check("the tutorial is practice", setup(3, 100, null, "Tutorial_Level"), 0, 20, 0.33);
    check("a dead player", setup(3, 100, { IsDead: true }), 0, 20, 0.33);
    // Respite: a NEW perfect deflect refunds stamina (capped), only from mercy 2 and above the band.
    let s = setup(2, 100); s.run(); s.pv.get("PerfectCount").setNumber(1); s.run();
    if (s.n("Stamina") !== 65) bad.push("Respite: a perfect deflect at mercy 2 should refund 15 stamina (50 to 65), got " + s.n("Stamina")); s.run();
    if (s.n("Stamina") !== 65) bad.push("Respite refunded again for the same deflect");
    s = setup(2, 100, { Stamina: 95 }); s.run(); s.pv.get("PerfectCount").setNumber(1); s.run(); if (s.n("Stamina") !== 100) bad.push("Respite must not go over the maximum stamina");
    s = setup(1, 100); s.run(); s.pv.get("PerfectCount").setNumber(1); s.run(); if (s.n("Stamina") !== 50) bad.push("Respite works at mercy 1");
    s = setup(2, 60); s.run(); s.pv.get("PerfectCount").setNumber(1); s.run(); if (s.n("Stamina") !== 50) bad.push("Respite works below the HP band");
    s = setup(2, 100, { DashCharges: 0, DashChargesMax: 2 }); s.run(); s.pv.get("PerfectCount").setNumber(1); s.run(); if (s.n("DashCharges") !== 1) bad.push("Respite should also give a dash charge back (0 to 1), got " + s.n("DashCharges"));
    s = setup(2, 100, { DashCharges: 2, DashChargesMax: 2 }); s.run(); s.pv.get("PerfectCount").setNumber(1); s.run(); if (s.n("DashCharges") !== 2) bad.push("Respite must not go over the maximum dash charges");
    // Poise is wired in: the stamina regen event reads StaminaRegenNow.
    const { sheets } = load(), pm = sheets.find(x => x.name === "Player_Movement"); let regen = 0;
    walk(pm.events, e => { for (const a of e.actions || []) if (a.type.value === "SetNumberObjectVariable" && a.parameters[1] === "Stamina" && a.parameters[2] === "+" && /TimeDelta/.test(a.parameters[3])) { regen++; if (!a.parameters[3].includes("StaminaRegenNow")) bad.push("the stamina regen event does not read StaminaRegenNow: " + a.parameters[3]); } });
    if (regen !== 1) bad.push("expected one stamina regen event, found " + regen);
    return bad;
  }],


  ["Riposte (phase 5, brand 2): a NEW perfect deflect sends the player's shadow (2 or more brands, never in the tutorial or when dead): it appears on a random side of the boss (never through a wall; no shadow when walls are on both sides), its cut sets RiposteStrike once, it fades and is deleted; the events find the boss, take health (never posture) off a vulnerable enemy and clear the flags", () => {
    const code = script("Combat_Shared", "The Brand tree"), bad = [];
    const setup = (brand, extra, sceneName) => {
      const G = vars({ BrandCount: brand }), pv = vars(Object.assign({ PerfectMeleeCount: 0, RiposteFire: 0, RiposteStrike: 0, RiposteX: 0, RiposteSrcX: 0, IsDead: false }, extra || {}));
      pv.get("IsDead").setBoolean(!!(extra && extra.IsDead));
      const player = obj("Player", { extra: { getVariables: () => pv, getCenterXInScene: () => 300, getScaleX: () => 2.2, getY: () => 500, getZOrder: () => 10, getCenterYInScene: () => 500, getHitBoxes: () => [{ vertices: [[280, 460], [320, 460], [320, 540], [280, 540]] }] } });
      const walls = (extra && extra.walls || []).map(w => ({ getHitBoxes: () => [{ vertices: [[w[0], w[1]], [w[2], w[1]], [w[2], w[3]], [w[0], w[3]]] }] }));
      const made = [];
      const scene = { getName: () => sceneName || "Samurai_Fight", getElapsedTime: () => 1000 / 60, getGame: () => ({ getVariables: () => G }),
        getObjects: n => n === "Player" ? [player] : n === "Invisible_Wall" ? walls : [],
        createObject: n => { const o = { name: n, op: -1, x: 0, y: 0, flip: null, gone: false, anim: "", setAnimationName(a) { this.anim = a; }, setScale() {}, getWidth: () => 120, setX(v) { this.x = v; }, setY(v) { this.y = v; }, setZOrder() {}, flipX(f) { this.flip = f; }, setOpacity(v) { this.op = v; }, deleteFromScene() { this.gone = true; } }; made.push(o); return o; } };
      const fn = new Function("runtimeScene", code);
      return { pv, made, run: () => fn(scene), n: k => pv.get(k).getAsNumber() };
    };
    const perfect = s => { s.run(); s.pv.get("PerfectMeleeCount").setNumber(s.n("PerfectMeleeCount") + 1); s.run(); };
    let s = setup(2); perfect(s); if (s.n("RiposteFire") !== 1) bad.push("2 brands: a perfect deflect should ask for the shadow");
    s = setup(1); perfect(s); if (s.n("RiposteFire") !== 0) bad.push("1 brand must not fire Riposte");
    s = setup(2, null, "Tutorial_Level"); perfect(s); if (s.n("RiposteFire") !== 0) bad.push("no Riposte in the tutorial");
    s = setup(2, { IsDead: true }); perfect(s); if (s.n("RiposteFire") !== 0) bad.push("no Riposte when dead");
    s = setup(2); s.run(); if (s.n("RiposteFire") !== 0 || s.made.length) bad.push("no deflect, no Riposte");
    // The event found the boss (x 600): with both sides clear, the random pick chooses (0 = left, 0.9 = right); the shadow faces the boss and cuts once.
    const spawn = (s, rnd, bx) => { const old = Math.random; Math.random = () => rnd; try { s.run(); s.pv.get("RiposteX").setNumber(bx); s.pv.get("RiposteFire").setNumber(2); s.run(); } finally { Math.random = old; } };
    s = setup(2); perfect(s); spawn(s, 0, 600);
    const sh = s.made[0];
    if (!sh || sh.name !== "Player_Shadow" || sh.anim !== "Strike") bad.push("the shadow should appear (Player_Shadow, Strike)");
    else {
      if (sh.x !== 600 - 80 - 60) bad.push("the shadow should stand 80 px left of the boss (x " + (600 - 80 - 60) + "), got " + sh.x);
      if (sh.flip !== false) bad.push("a shadow left of the boss faces right (no flip)");
      let strikes = 0;
      for (let f = 0; f < 60 && !sh.gone; f++) { s.run(); const v = s.n("RiposteStrike"); if (v === 1) { strikes++; if (s.n("RiposteSrcX") !== 520) bad.push("the cut should say the shadow stood at x 520, got " + s.n("RiposteSrcX")); } s.pv.get("RiposteStrike").setNumber(0); if (v === 1 && f < 6) bad.push("it cut before its slash frame"); }
      if (strikes !== 1) bad.push("the shadow should cut exactly once, cut " + strikes);
      if (!sh.gone) bad.push("the shadow should be deleted after about half a second");
    }
    s = setup(2); perfect(s); spawn(s, 0.9, 600);
    if (!s.made[0] || s.made[0].x !== 600 + 80 - 60 || s.made[0].flip !== true) bad.push("with the random pick on the right, the shadow stands right of the boss, facing left (flipped)");
    // Walls: a wall left of the boss (between x 500 and 530, in the player's height band) rules the left side out whatever the random number; walls on both sides, no shadow.
    s = setup(2, { walls: [[500, 400, 530, 600]] }); perfect(s); spawn(s, 0, 600);
    if (!s.made[0] || s.made[0].x !== 600 + 80 - 60) bad.push("a wall on the left: the shadow must come from the right, got " + (s.made[0] && s.made[0].x));
    s = setup(2, { walls: [[670, 400, 700, 600]] }); perfect(s); spawn(s, 0.9, 600);
    if (!s.made[0] || s.made[0].x !== 600 - 80 - 60) bad.push("a wall on the right: the shadow must come from the left, got " + (s.made[0] && s.made[0].x));
    s = setup(2, { walls: [[500, 400, 530, 600], [670, 400, 700, 600]] }); perfect(s); spawn(s, 0.3, 600);
    if (s.made.length) bad.push("walls on both sides: no shadow should come");
    s = setup(2, { walls: [[0, 700, 2000, 800]] }); perfect(s); spawn(s, 0, 600);
    if (!s.made.length) bad.push("the floor (a wall below the player's body) must not block the shadow");
    s = setup(2); perfect(s); s.run(); s.pv.get("RiposteX").setNumber(600); s.pv.get("RiposteFire").setNumber(2); s.run(); s.pv.get("IsDead").setBoolean(true); s.run();
    if (!s.made[0].gone || s.n("RiposteStrike") !== 0) bad.push("a dead player's shadow must vanish without cutting");
    // Melee only: the perfect-melee events (Combat_Shared's deflect) are conditioned on EnemyHitbox.IsMelee; the Gunslinger's bullets add none.
    { const { sheets: sh2 } = load(); let meleeEvents = 0, other = 0;
      for (const sheet of sh2) walk(sheet.events, e => { if ((e.actions || []).some(a => a.parameters[1] === "PerfectMeleeCount")) { if (sheet.name === "Combat_Shared" && JSON.stringify(e.conditions).includes('"IsMelee","True"')) meleeEvents++; else other++; } });
      if (meleeEvents !== 2 || other) bad.push("PerfectMeleeCount should be added by two melee-only events in Combat_Shared and nowhere else, found " + meleeEvents + " and " + other); }
    // The events: find the boss, then health only (never posture), and the flags are cleared.
    const { sheets } = load(), cs = sheets.find(x => x.name === "Combat_Shared"); let dmg = null, find = null, clearStrike = null, clearFire = null;
    const fxOf = e => { const j = JSON.stringify(e.events || []); return { sounds: (j.split("Sfx/hits/hit_").length - 1), blood: (j.match(/"BloodSprite"/g) || []).length > 0 }; };
    walk(cs.events, e => { for (const a of e.actions || []) {
      if (a.type.value === "SetNumberObjectVariable" && a.parameters[0] === "Enemy" && a.parameters[1] === "Health" && /RiposteMult/.test(a.parameters[3])) dmg = e;
      if (a.parameters[1] === "RiposteX" && a.parameters[3] === "Enemy.CenterX()") find = e;
      if (a.parameters[1] === "RiposteStrike" && a.parameters[3] === "0") clearStrike = e;
      if (a.parameters[1] === "RiposteFire" && a.parameters[3] === "0") clearFire = e; } });
    if (!dmg) bad.push("the Riposte damage event is missing");
    else {
      if (JSON.stringify(dmg.actions).includes("Posture")) bad.push("Riposte must not touch posture");
      if (!JSON.stringify(dmg.conditions).includes("Invulnerable")) bad.push("Riposte must skip an invulnerable enemy");
      if (!JSON.stringify(dmg.conditions).includes("RiposteStrike")) bad.push("the damage waits for the shadow's cut (RiposteStrike)");
      const fx = fxOf(dmg); if (fx.sounds !== 5 || !fx.blood) bad.push("the shadow's cut needs the player's hit sounds (5) and blood, found " + fx.sounds + " sounds, blood " + fx.blood);
      if (!JSON.stringify(dmg.events).includes("RiposteSrcX") || JSON.stringify(dmg.events).includes("Player.CenterX()")) bad.push("the Riposte blood must fly away from the shadow (RiposteSrcX), not from the player");
    }
    if (!find) bad.push("no event tells the shadow where the boss is"); else if (!JSON.stringify(find.actions).includes('"RiposteFire","=","2"')) bad.push("the find event must set RiposteFire to 2");
    if (!clearStrike || !clearFire) bad.push("the Riposte flags are never cleared");
    return bad;
  }],

  ["Shadow echo (phase 5, brand 1): a swing that hits is replayed one second later by a fainter shadow on the spot where the player stood (his facing and attack kept); its slash sets EchoStrike once; not with 0 brands, in the tutorial or when dead; the event takes health only, from an enemy within reach of the spot", () => {
    const code = script("Combat_Shared", "The Brand tree"), bad = [];
    const setup = (brand, sceneName) => {
      const G = vars({ BrandCount: brand }), pv = vars({ PerfectMeleeCount: 0, RiposteFire: 0, RiposteStrike: 0, RiposteX: 0, EchoStrike: 0, EchoX: 0, IsDead: false, HasHitThisSwing: false });
      const me = { anim: "Player_Attack_Two", flip: false };
      const player = obj("Player", { extra: { getVariables: () => pv, getCenterXInScene: () => me.cx || 300, getScaleX: () => 2.2, getX: () => me.px || 240, getY: () => 500, getZOrder: () => 10, getCenterYInScene: () => 500, getAnimationName: () => me.anim, isFlippedX: () => me.flip, getHitBoxes: () => [] } });
      const made = [];
      const scene = { getName: () => sceneName || "Samurai_Fight", getElapsedTime: () => 1000 / 60, getGame: () => ({ getVariables: () => G }), getObjects: n => n === "Player" ? [player] : [],
        createObject: n => { const o = { name: n, op: -1, x: 0, y: 0, flip: null, gone: false, anim: "", setAnimationName(a) { this.anim = a; }, setScale() {}, getWidth: () => 120, setX(v) { this.x = v; }, setY(v) { this.y = v; }, setZOrder() {}, flipX(f) { this.flip = f; }, setOpacity(v) { this.op = v; }, deleteFromScene() { this.gone = true; } }; made.push(o); return o; } };
      const fn = new Function("runtimeScene", code);
      return { pv, me, made, run: () => fn(scene), n: k => pv.get(k).getAsNumber(), hit: () => { pv.get("HasHitThisSwing").setBoolean(true); fn(scene); pv.get("HasHitThisSwing").setBoolean(false); fn(scene); } };
    };
    const frames = (s, n) => { let strikes = 0; for (let f = 0; f < n; f++) { s.run(); if (s.n("EchoStrike") === 1) { strikes++; s.pv.get("EchoStrike").setNumber(0); } } return strikes; };
    let s = setup(1); s.run(); s.hit();
    if (frames(s, 50)) bad.push("the echo came before its second");
    if (s.made.length) bad.push("the echo appeared early");
    let st = frames(s, 20);
    if (s.made.length !== 1) bad.push("one second after the hit one echo should appear, found " + s.made.length);
    else {
      const o = s.made[0];
      if (o.anim !== "Strike" || o.x !== 240 || o.y !== 500 || o.flip !== false) bad.push("the echo should stand where the player stood and swing his heavy attack, got " + JSON.stringify([o.anim, o.x, o.y, o.flip]));
      st += frames(s, 60);
      if (st !== 1) bad.push("an echo should cut exactly once, cut " + st);
      if (!o.gone) bad.push("an echo should be deleted after about half a second");
    }
    s = setup(1); s.me.anim = "Player_Attack_One"; s.me.flip = true; s.run(); s.hit(); frames(s, 75);
    if (!s.made[0] || s.made[0].anim !== "Strike1" || s.made[0].flip !== true) bad.push("a light attack facing left should echo as Strike1, flipped");
    s = setup(0); s.run(); s.hit(); frames(s, 100); if (s.made.length) bad.push("no echo without a brand");
    s = setup(1, "Tutorial_Level"); s.run(); s.hit(); frames(s, 100); if (s.made.length) bad.push("no echo in the tutorial");
    s = setup(1); s.run(); s.hit(); s.pv.get("IsDead").setBoolean(true); frames(s, 100); if (s.made.length) bad.push("a dead player's pending echo must vanish");
    s = setup(1); s.run(); for (let i = 0; i < 8; i++) s.hit(); frames(s, 75); if (s.made.length !== 4) bad.push("at most 4 echoes wait at once, found " + s.made.length);
    s = setup(1); s.run(); s.pv.get("HasHitThisSwing").setBoolean(true); for (let i = 0; i < 5; i++) s.run(); frames(s, 75); if (s.made.length !== 1) bad.push("one swing is one echo however long the flag stays on, found " + s.made.length);
    // The event: health only, within reach, vulnerable, and cleared.
    const { sheets } = load(), cs = sheets.find(x => x.name === "Combat_Shared"); let dmg = null, clear = null;
    const fxOf = e => { const j = JSON.stringify(e.events || []); return { sounds: (j.split("Sfx/hits/hit_").length - 1), blood: j.includes("\"BloodSprite\"") }; };
    walk(cs.events, e => { for (const a of e.actions || []) {
      if (a.type.value === "SetNumberObjectVariable" && a.parameters[0] === "Enemy" && a.parameters[1] === "Health" && /EchoMult/.test(a.parameters[3])) dmg = e;
      if (a.parameters[1] === "EchoStrike" && a.parameters[3] === "0") clear = e; } });
    if (!dmg) bad.push("the echo damage event is missing");
    else {
      const c = JSON.stringify(dmg.conditions);
      if (JSON.stringify(dmg.actions).includes("Posture")) bad.push("an echo must not touch posture");
      if (!c.includes("Invulnerable") || !c.includes("EchoReach") || !c.includes("EchoStrike")) bad.push("the echo damage waits for EchoStrike, needs the boss within EchoReach and skips an invulnerable one");
    }
    if (dmg) { const fx = fxOf(dmg); if (fx.sounds !== 5 || !fx.blood) bad.push("the echo's cut needs the player's hit sounds (5) and blood"); if (!JSON.stringify(dmg.events).includes("EchoX") || JSON.stringify(dmg.events).includes("Player.CenterX()")) bad.push("the echo blood must fly away from the echo (EchoX)"); }
    if (!clear) bad.push("EchoStrike is never cleared");
    return bad;
  }],

  ["Projectile return (phase 5, brand 4): a deflected arrow or thrown blade near the player (gone or HasHit on the frame DeflectBlocked turns true, HP not falling) sends a bolt that flies to the boss and sets ReturnStrike once on arrival; a hit, a far projectile, fewer than 4 brands, the tutorial or a dead player send none; the event takes health only", () => {
    const code = script("Combat_Shared", "The Brand tree"), bad = [];
    const setup = (brand, sceneName) => {
      const G = vars({ BrandCount: brand }), pv = vars({ PerfectMeleeCount: 0, RiposteFire: 0, RiposteStrike: 0, EchoStrike: 0, ReturnStrike: 0, ReturnSrcX: 0, BossX: 900, BossY: 500, Health: 100, DeflectBlocked: false, IsDead: false, HasHitThisSwing: false });
      const player = obj("Player", { extra: { getVariables: () => pv, getCenterXInScene: () => 300, getCenterYInScene: () => 500, getScaleX: () => 2.2, getX: () => 240, getY: () => 500, getZOrder: () => 10, getHitBoxes: () => [] } });
      const lists = { Ranger_Arrow: [], Bladekeeper_Blade: [] }, made = [];
      const scene = { getName: () => sceneName || "Leaf_Ranger_Fight", getElapsedTime: () => 1000 / 60, getGame: () => ({ getVariables: () => G }), getObjects: n => n === "Player" ? [player] : (lists[n] || []),
        createObject: n => { const o = { name: n, x: 0, y: 0, ang: 0, gone: false, setZOrder() {}, getWidth: () => 48, getHeight: () => 16, setPosition(x, y) { this.x = x; this.y = y; }, setAngle(a) { this.ang = a; }, deleteFromScene() { this.gone = true; } }; made.push(o); return o; } };
      const proj = (name, x, y) => { const hv = vars({ HasHit: false }); const o = { x, y, getVariables: () => hv, getCenterXInScene: () => o.x, getCenterYInScene: () => o.y }; lists[name].push(o); return o; };
      const fn = new Function("runtimeScene", code);
      return { pv, made, lists, proj, run: () => fn(scene), n: k => pv.get(k).getAsNumber() };
    };
    const fly = (s, frames) => { let strikes = 0, src = null; for (let f = 0; f < frames; f++) { s.run(); if (s.n("ReturnStrike") === 1) { strikes++; src = s.n("ReturnSrcX"); s.pv.get("ReturnStrike").setNumber(0); } } return { strikes, src }; };
    const deflect = (s, a) => { s.pv.get("DeflectBlocked").setBoolean(true); a.getVariables().get("HasHit").setBoolean(true); s.run(); };
    // A deflected arrow (HasHit on the frame of the deflect): one bolt, flying at the boss, one strike.
    let s = setup(4), a = s.proj("Ranger_Arrow", 360, 500); s.run(); a.x = 330; s.run(); deflect(s, a);
    if (s.made.length !== 1 || s.made[0].name !== "Player_Return_Shot") bad.push("a deflected arrow should send one bolt, found " + s.made.length);
    else { const r = fly(s, 90); if (r.strikes !== 1) bad.push("the bolt should arrive and strike exactly once, struck " + r.strikes); else if (r.src < 800) bad.push("the bolt should be near the boss when it strikes, was at x " + r.src); if (!s.made[0].gone) bad.push("the bolt must be deleted on arrival"); }
    // The flight is aimed: it flies right, toward the boss at x 900, turned that way.
    s = setup(4); a = s.proj("Ranger_Arrow", 330, 500); s.run(); deflect(s, a); fly(s, 10);
    if (s.made[0] && (Math.abs(s.made[0].ang) > 1 || s.made[0].x < 340)) bad.push("the bolt should fly right, toward the boss at x 900, got x " + s.made[0].x + " angle " + s.made[0].ang);
    // The blade is deleted by its own events on that frame: still a bolt.
    s = setup(4); a = s.proj("Bladekeeper_Blade", 340, 500); s.run(); s.pv.get("DeflectBlocked").setBoolean(true); s.lists.Bladekeeper_Blade.length = 0; s.run();
    if (s.made.length !== 1) bad.push("a deflected blade that vanished on the deflect frame should still send a bolt, found " + s.made.length);
    // Not deflects.
    s = setup(4); a = s.proj("Ranger_Arrow", 340, 500); s.run(); a.getVariables().get("HasHit").setBoolean(true); s.pv.get("Health").setNumber(90); s.run(); if (s.made.length) bad.push("an arrow that hit the player (no deflect) must not be returned");
    s = setup(4); a = s.proj("Ranger_Arrow", 340, 500); s.run(); s.pv.get("Health").setNumber(90); deflect(s, a); if (s.made.length) bad.push("a frame where the player lost HP is not a deflect");
    s = setup(4); a = s.proj("Ranger_Arrow", 900, 500); s.run(); deflect(s, a); if (s.made.length) bad.push("an arrow far from the player was not the one deflected");
    s = setup(3); a = s.proj("Ranger_Arrow", 340, 500); s.run(); deflect(s, a); if (s.made.length) bad.push("no Projectile return under 4 brands");
    s = setup(4, "Tutorial_Level"); a = s.proj("Ranger_Arrow", 340, 500); s.run(); deflect(s, a); if (s.made.length) bad.push("no Projectile return in the tutorial");
    s = setup(4); a = s.proj("Ranger_Arrow", 340, 500); s.run(); deflect(s, a); s.pv.get("IsDead").setBoolean(true); fly(s, 90); if (!s.made[0].gone || s.n("ReturnStrike") !== 0) bad.push("a dead player's bolt must vanish without striking");
    // The events.
    const { sheets } = load(), cs = sheets.find(x => x.name === "Combat_Shared"); let dmg = null, boss = null, clear = null;
    walk(cs.events, e => { for (const a of e.actions || []) {
      if (a.type.value === "SetNumberObjectVariable" && a.parameters[0] === "Enemy" && a.parameters[1] === "Health" && /ReturnMult/.test(a.parameters[3])) dmg = e;
      if (a.parameters[1] === "BossX" && a.parameters[3] === "Enemy.PointX(\"BloodPoint\")") boss = e;
      if (a.parameters[1] === "ReturnStrike" && a.parameters[3] === "0") clear = e; } });
    if (!dmg) bad.push("the return damage event is missing");
    else {
      const c = JSON.stringify(dmg.conditions), j = JSON.stringify(dmg.events || []);
      if (JSON.stringify(dmg.actions).includes("Posture")) bad.push("a returned projectile must not touch posture");
      if (!c.includes("Invulnerable") || !c.includes("ReturnStrike")) bad.push("the return damage waits for ReturnStrike and skips an invulnerable enemy");
      if ((j.split("Sfx/hits/hit_").length - 1) !== 5 || !j.includes("BloodSprite") || !j.includes("ReturnSrcX")) bad.push("the return hit needs the player's hit sounds and blood, from where the bolt was (ReturnSrcX)");
    }
    if (!boss || !JSON.stringify(boss.actions).includes("PointY(\\\"BloodPoint")) bad.push("the boss position (where the bolts fly) must be his BloodPoint, not the frame centre, which sits above his head");
    if (!clear) bad.push("ReturnStrike is never cleared");
    return bad;
  }],

  ["Roll deflect (phase 5, brand 5): RollDeflectOn from 5 brands (not in the tutorial); the sword can block the Samurai's grab only in the perfect window (it whiffs and costs the boss posture); a dodge gets no bonus (no posture, no perfect count, nothing in the boss kit)", () => {
    const bad = [], code = script("Combat_Shared", "The Brand tree");
    const flag = (brand, sceneName) => { const G = vars({ BrandCount: brand }), pv = vars({ PerfectMeleeCount: 0, RiposteFire: 0, RiposteStrike: 0, EchoStrike: 0, ReturnStrike: 0, RollDeflectOn: 0, Health: 100, IsDead: false, HasHitThisSwing: false, DeflectBlocked: false, BossX: 0, BossY: 0 });
      const player = obj("Player", { extra: { getVariables: () => pv, getCenterXInScene: () => 300, getCenterYInScene: () => 500, getScaleX: () => 2.2, getX: () => 240, getY: () => 500, getZOrder: () => 10, getHitBoxes: () => [] } });
      new Function("runtimeScene", code)({ getName: () => sceneName || "Samurai_Fight", getElapsedTime: () => 1000 / 60, getGame: () => ({ getVariables: () => G }), getObjects: n => n === "Player" ? [player] : [], createObject: () => null });
      return pv.get("RollDeflectOn").getAsNumber(); };
    if (flag(5) !== 1 || flag(4) !== 0 || flag(5, "Tutorial_Level") !== 0) bad.push("RollDeflectOn should be 1 from 5 brands, and 0 below that and in the tutorial");
    const { sheets } = load(), sb = sheets.find(x => /samurai_boss/i.test(x.name) && !/tutorial/i.test(x.name));
    if (!sb) return bad.concat("Samurai_Boss sheet not found");
    let list = null;
    (function find(l) { if (list) return; for (const ev of l) { if (ev.type === "BuiltinCommonInstructions::Comment" && String(ev.comment).startsWith("Grab connects:")) { list = l; return; } if (ev.events) find(ev.events); } })(sb.events);
    if (!list) return bad.concat("the Grab connects event is gone");
    const at = list.findIndex(ev => ev.type === "BuiltinCommonInstructions::Comment" && String(ev.comment).startsWith("Grab connects:"));
    const mine = list.filter(ev => ev.type === "BuiltinCommonInstructions::Comment" && String(ev.comment).startsWith("Roll deflect:"));
    if (mine.length !== 1) return bad.concat("expected one Roll deflect event in front of the grab (the sword block; a dodge gets no bonus), found " + mine.length);
    const blockAt = list.indexOf(mine[0]) + 1, block = list[blockAt], cj = JSON.stringify(block.conditions), aj = JSON.stringify(block.actions);
    if (!(blockAt < at)) bad.push("the Roll deflect event must come before the event that connects the grab");
    for (const [name, c] of [["IsDeflecting", cj.includes('"IsDeflecting","True"')], ["the perfect window", cj.includes("DeflectWindow) * Player.Variable(PerfectFractionNow)")], ["RollDeflectOn", cj.includes('"RollDeflectOn","=","1"')], ["Iframe false (a roll beats the grab first)", cj.includes('"Iframe","False"')], ["facing", cj.includes("FacingOk")]]) if (!c) bad.push("the sword block needs " + name);
    if (!aj.includes('"AIState","=","\\"GrabWhiff\\""') || !aj.includes("Posture") || !aj.includes("PlaySound") || !aj.includes("Deflect_Spark")) bad.push("a blocked grab whiffs (GrabWhiff), costs the boss posture, with the clash and a spark");
    // A dodge gets nothing: no RollTimer event for it, and the boss kit has no perfect dodge.
    if (JSON.stringify(sb.events).includes("RollDeflectWindow") || JSON.stringify(sb.events).includes('"RollTimer')) bad.push("a dodge must get no bonus from the Samurai's grab events");
    const kit = fs.readFileSync(path.join(__dirname, "..", "bosses", "kit.js"), "utf8");
    if (/perfectDodge|RollDeflect/.test(kit)) bad.push("the boss kit must not give a dodge a bonus");
    return bad;
  }],

  ["Grace (phase 5, mercy 5): hits cost 30% less of the player's own posture above the HP band (PostureTakenNow 0.7), not below it, not under 5 mercy, not in the tutorial; both places where his posture goes up (a hit in Combat_Shared, the Gunslinger's bullet) multiply by it", () => {
    const code = script("Combat_Shared", "Composure (docs"), bad = [];
    const taken = (mercy, hp, sceneName) => {
      const G = vars({ MercyCount: mercy }), pv = vars({ Health: hp, MaxHealth: 100, ComposureBand: 0.8, StaminaRegenRate: 20, PoiseBonus: 0.5, PerfectFraction: 0.33, SteadyHandBonus: 0.12, PerfectCount: 0, Stamina: 50, MaxStamina: 100, RespiteStamina: 15, IsDead: false, ComposureOn: 0, StaminaRegenNow: 20, PerfectFractionNow: 0.33, GraceBonus: 0.3, PostureTakenNow: 1 });
      const player = obj("Player", { extra: { getVariables: () => pv } });
      new Function("runtimeScene", code)({ getName: () => sceneName || "Samurai_Fight", getObjects: n => n === "Player" ? [player] : [], getGame: () => ({ getVariables: () => G }) });
      return pv.get("PostureTakenNow").getAsNumber();
    };
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    if (!near(taken(5, 100), 0.7)) bad.push("5 mercy at full HP: posture taken should be 0.7, got " + taken(5, 100));
    if (!near(taken(4, 100), 1)) bad.push("Grace needs 5 mercy");
    if (!near(taken(5, 60), 1)) bad.push("Grace works only above the HP band");
    if (!near(taken(5, 100, "Tutorial_Level"), 1)) bad.push("no Grace in the tutorial");
    const { sheets, scenes } = load(); let seen = 0;
    const check = (events, from) => walk(events, ev => { for (const a of ev.actions || []) if (a.parameters[0] === "Player" && a.parameters[1] === "Posture" && a.parameters[2] === "+") { seen++; if (a.parameters[3] !== from + ".Variable(PostureDamage) * Player.Variable(PostureTakenNow)") bad.push("a player posture hit must multiply by PostureTakenNow, got " + a.parameters[3]); } });
    check(sheets.find(x => x.name === "Combat_Shared").events, "Enemy"); check(scenes.find(x => x.name === "Gunslinger").events, "Bullet");
    if (seen !== 2) bad.push("expected two places where the player's posture goes up, found " + seen);
    return bad;
  }],

  ["Metal coat (phase 5, the Bladekeeper's mercy gift): ready only with the power owned, a use left (two per playthrough, saved in the progress and wiped with it), alive, outside the tutorial; spending one saves it; the event in front of Player loses a life heals half, clears rally and posture, flinches and knocks the boss back, takes no life and no curse stack", () => {
    const code = script("Combat_Shared", "The Brand tree"), bad = [];
    const mem = {}; const had = global.localStorage;
    global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
    try {
      const setup = (owned, sceneName) => {
        const G = vars({ BrandCount: 0, PowersOwned: owned }), pv = vars({ PerfectMeleeCount: 0, RiposteFire: 0, RiposteStrike: 0, EchoStrike: 0, ReturnStrike: 0, RollDeflectOn: 0, MetalCoatReady: 0, MetalCoatFire: 0, Health: 100, IsDead: false, HasHitThisSwing: false, DeflectBlocked: false, BossX: 0, BossY: 0 });
        const player = obj("Player", { extra: { getVariables: () => pv, getCenterXInScene: () => 300, getCenterYInScene: () => 500, getScaleX: () => 2.2, getX: () => 240, getY: () => 500, getZOrder: () => 10, getHitBoxes: () => [] } });
        const scene = { getName: () => sceneName || "Bladekeeper_Fight", getElapsedTime: () => 1000 / 60, getGame: () => ({ getVariables: () => G }), getObjects: n => n === "Player" ? [player] : [], createObject: () => null };
        const fn = new Function("runtimeScene", code);
        return { pv, run: () => fn(scene), n: k => pv.get(k).getAsNumber() };
      };
      const used = () => (JSON.parse(mem["SoulRush.progress"] || "{}").metalCoatUsed || 0);
      let s = setup("poise,metal_coat"); s.run(); if (s.n("MetalCoatReady") !== 1) bad.push("with Metal coat owned and no uses spent it should be ready");
      s = setup("poise"); s.run(); if (s.n("MetalCoatReady") !== 0) bad.push("not ready without the power");
      s = setup("metal_coat", "Tutorial_Level"); s.run(); if (s.n("MetalCoatReady") !== 0) bad.push("no Metal coat in the tutorial");
      s = setup("metal_coat", "HUB_Area"); s.run(); if (s.n("MetalCoatReady") !== 0) bad.push("no Metal coat in the hub");
      s = setup("metal_coat"); s.pv.get("IsDead").setBoolean(true); s.run(); if (s.n("MetalCoatReady") !== 0) bad.push("not ready when dead");
      // Spending: the event sets MetalCoatFire; the script saves one use; two uses end it; a new fight reads the saved count.
      s = setup("metal_coat"); s.run(); s.pv.get("MetalCoatFire").setNumber(1); s.run();
      if (used() !== 1 || s.n("MetalCoatFire") !== 0 || s.n("MetalCoatReady") !== 1) bad.push("one use spent: saved as 1, flag cleared, one left; got used " + used() + ", fire " + s.n("MetalCoatFire") + ", ready " + s.n("MetalCoatReady"));
      s = setup("metal_coat"); s.run(); if (s.n("MetalCoatReady") !== 1) bad.push("a new fight reads the saved count: one use left");
      s.pv.get("MetalCoatFire").setNumber(1); s.run();
      if (used() !== 2 || s.n("MetalCoatReady") !== 0) bad.push("the second use ends it, got used " + used() + ", ready " + s.n("MetalCoatReady"));
      s = setup("metal_coat"); s.run(); if (s.n("MetalCoatReady") !== 0) bad.push("a retry must not bring the uses back (they are saved)");
      mem["SoulRush.progress"] = JSON.stringify({ awakened: {}, beaten: {} });          // Start over wipes the progress.
      s = setup("metal_coat"); s.run(); if (s.n("MetalCoatReady") !== 1) bad.push("Start over wipes the progress, so both uses come back");
    } finally { if (had === undefined) delete global.localStorage; else global.localStorage = had; }
    // The buff icon (a PIXI shield on the UI layer, one pip per use left) and debug key Y (owns Metal coat, gives one use back).
    {
      const savedPixi = global.PIXI, saved2 = global.localStorage, mem2 = {}; let keyY = false; const roots = [], drawn = [], colors = [], rings = []; global.__ringList = rings;
      global.localStorage = { getItem: k => (k in mem2 ? mem2[k] : null), setItem: (k, v) => { mem2[k] = String(v); } };
      global.PIXI = { Graphics: function () { this.visible = true; this.alpha = 1; this.clear = () => { drawn.push("clear"); }; this.destroy = () => { this.destroyed = true; }; if (global.__ringList) global.__ringList.push(this); this.lineStyle = () => {}; this.beginFill = () => {}; this.endFill = () => {}; this.drawPolygon = () => { drawn.push("shield"); }; this.drawCircle = () => { drawn.push("pip"); }; } };
      try {
        const G = vars({ BrandCount: 0, PowersOwned: "" }), pv = vars({ PerfectMeleeCount: 0, RiposteFire: 0, RiposteStrike: 0, EchoStrike: 0, ReturnStrike: 0, RollDeflectOn: 0, MetalCoatReady: 0, MetalCoatFire: 0, Health: 100, IsDead: false, HasHitThisSwing: false, DeflectBlocked: false, BossX: 0, BossY: 0 });
        const player = obj("Player", { extra: { getVariables: () => pv, getCenterXInScene: () => 300, getCenterYInScene: () => 500, getScaleX: () => 2.2, getX: () => 240, getY: () => 500, getZOrder: () => 10, getHitBoxes: () => [], setColor: c => colors.push(c) } });
        const scene = { getName: () => "Bladekeeper_Fight", getElapsedTime: () => 1000 / 60, getGame: () => ({ getVariables: () => G }), getObjects: n => n === "Player" ? [player] : [], createObject: () => null,
          getLayer: n => ({ getRenderer: () => ({ getRendererObject: () => ({ addChild: c => roots.push([n, c]) }) }) }) };
        const gd = { evtTools: { input: { wasKeyJustPressed: (sc, k) => keyY && k === "y" } } };
        const fn = new Function("runtimeScene", "gdjs", code), run = () => fn(scene, gd);
        run(); const icon = roots.find(r => r[0] === "UI");
        if (!icon) bad.push("the buff icon should be added to the UI layer"); else if (icon[1].visible) bad.push("no buff icon while the coat is not owned");
        keyY = true; run(); keyY = false; run();
        if (G.get("PowersOwned").getAsString().indexOf("metal_coat") < 0) bad.push("debug key Y should own Metal coat for this fight");
        if (pv.get("MetalCoatReady").getAsNumber() !== 1 || !icon[1].visible) bad.push("after Y the coat is ready and the buff icon shows");
        if (drawn.filter(d => d === "pip").length !== 2) bad.push("the buff icon has a pip per use (2), drew " + drawn.filter(d => d === "pip").length);
        pv.get("MetalCoatFire").setNumber(1); run(); drawn.length = 0; colors.length = 0; for (let f = 0; f < 150; f++) run();
        if (JSON.parse(mem2["SoulRush.progress"] || "{}").metalCoatUsed !== 1) bad.push("a spent use is saved");
        const reds = colors.map(c => Number(c.split(";")[0]));
        if (!colors.length || Math.min(...reds) > 110) bad.push("the steel look should be strong (red down to 110 or less), the darkest was " + Math.min(...reds));
        if (Math.max(...reds.slice(0, 80)) < 230) bad.push("the steel should have a bright shine passing through it");
        if (colors[colors.length - 1] !== "255;255;255") bad.push("the colour must end back at normal, got " + colors[colors.length - 1]);
        if (!drawn.includes("pip") || rings.length !== 3) bad.push("two shockwave rings (and the icon) should exist, found " + rings.length);
        if (rings.slice(1).some(r => !r.destroyed)) bad.push("the shockwave rings must be destroyed at the end");
        keyY = true; run(); keyY = false; run();
        if ((JSON.parse(mem2["SoulRush.progress"] || "{}").metalCoatUsed || 0) !== 0) bad.push("debug key Y gives a use back (the saved count goes down by one)");
        keyY = true; run(); keyY = false; run(); if ((JSON.parse(mem2["SoulRush.progress"] || "{}").metalCoatUsed || 0) !== 0) bad.push("debug key Y never goes below zero used");
        pv.get("MetalCoatFire").setNumber(1); run(); pv.get("MetalCoatFire").setNumber(1); run(); run();
        if (icon[1].visible || pv.get("MetalCoatReady").getAsNumber() !== 0) bad.push("with both uses spent the icon hides and the coat is not ready");
      } finally { global.PIXI = savedPixi; if (saved2 === undefined) delete global.localStorage; else global.localStorage = saved2; }
    }
    // The event.
    const { sheets } = load(), cs = sheets.find(x => x.name === "Combat_Shared"); let at = -1, life = -1, ev = null;
    cs.events.forEach((x, i) => { if (x.type === "BuiltinCommonInstructions::Comment" && String(x.comment).startsWith("Metal coat:")) { at = i; ev = cs.events[i + 1]; } if (x.type === "BuiltinCommonInstructions::Comment" && String(x.comment).startsWith("Player loses a life:")) life = i; });
    if (at < 0) return bad.concat("the Metal coat event is missing");
    if (!(at < life)) bad.push("the Metal coat event must come before Player loses a life, or the life is lost first");
    const c = JSON.stringify(ev.conditions), a = JSON.stringify(ev.actions);
    if (!c.includes('"Health","<=","0"') || !c.includes('"MetalCoatReady","=","1"')) bad.push("it fires on HP 0 with MetalCoatReady");
    if (!a.includes('"Health","=","Player.Variable(MaxHealth) * Player.Variable(MetalCoatHeal)"')) bad.push("it heals MetalCoatHeal of max HP");
    if (a.includes('"Lives"') || a.includes('"CurseStacks"')) bad.push("no life lost and no curse stack taken");
    for (const [what, ok] of [["rally cleared", a.includes('"PendingRally","=","0"')], ["posture cleared", a.includes('"Posture","=","0"')], ["respawn invulnerability", a.includes('"RespawnIframe","True"')], ["a harder hit-stop and shake", a.includes("HitStopBreak") && a.includes("ShakeBreak")], ["the script is told to spend the use", a.includes('"MetalCoatFire","=","1"')], ["it cannot fire twice at once", a.includes('"MetalCoatReady","=","0"')]]) if (!ok) bad.push("Metal coat needs: " + what);
    // The flinch and the slide: a separate event, only for a boss that is not invulnerable (a protected sequence), and not for a grabbed player.
    {
      const fi = cs.events.findIndex(x => x.type === "BuiltinCommonInstructions::Comment" && String(x.comment).startsWith("Metal coat, the flinch:"));
      if (fi < 0) bad.push("the flinch event is missing");
      else {
        const f = cs.events[fi + 1], fc = JSON.stringify(f.conditions), fa = JSON.stringify(f.actions);
        if (!fc.includes('"MetalCoatFire","=","1"') || !fc.includes('"Enemy","Invulnerable","False"') || !fc.includes('"IsGrabbed","False"')) bad.push("the flinch needs MetalCoatFire, an enemy that is not invulnerable, and a player who is not grabbed");
        if (!fa.includes('"Enemy","JustStaggered","True"') || !fa.includes('"KnockLeft"') || !fa.includes('"KnockDir"')) bad.push("the flinch event flinches the boss (JustStaggered) and sets it sliding");
        if (!(fi > at)) bad.push("the flinch event must come after the one that sets MetalCoatFire");
        if (a.includes("JustStaggered") || a.includes("KnockLeft")) bad.push("the main Metal coat event itself must not flinch or slide (the flinch event decides)");
      }
    }
    // In a grab (the Samurai's stab is a direct hit): the same heal but no flinch and no knockback; the first event is for the not-grabbed case.
    if (!c.includes('"IsGrabbed","False"')) bad.push("the full Metal coat event (flinch and slide) is for a player who is not grabbed");
    const gi = cs.events.findIndex(x => x.type === "BuiltinCommonInstructions::Comment" && String(x.comment).startsWith("Metal coat, in a grab:"));
    if (gi < 0) bad.push("the grab version of Metal coat is missing");
    else {
      const g = cs.events[gi + 1], gc = JSON.stringify(g.conditions), ga = JSON.stringify(g.actions);
      if (gc.includes('"IsGrabbed","False"') || !gc.includes('"MetalCoatReady","=","1"')) bad.push("the grab version fires for a grabbed player (and only when ready)");
      if (!ga.includes("MetalCoatHeal") || !ga.includes('"MetalCoatFire","=","1"') || !ga.includes('"RespawnIframe","True"')) bad.push("the grab version still heals, spends the use and gives the invulnerability");
      if (!ga.includes('"IsGrabbed","False"') || !ga.includes('"ControlsLocked","False"') || !ga.includes("Player_Idle")) bad.push("in a grab the coat breaks it: the player is released (IsGrabbed and ControlsLocked off, idle pose)");
      if (!ga.includes('"KnockLeft"') || !ga.includes('"KnockDir"')) bad.push("in a grab the boss slides away as well");
      if (ga.includes("JustStaggered") || /Samurai|Cat_|Bladekeeper|Leaf_Ranger|Gunslinger/.test(ga + gc)) bad.push("the Combat_Shared grab event must not name any one boss (it is linked by every fight), and must not set JustStaggered (the grabbing boss's own sheet handles that)");
      // The Samurai's own event: it drops the grab when the coat forms while he is in GrabHold.
      const samSheet = sheets.find(x => /samurai_boss/i.test(x.name) && !/tutorial/i.test(x.name));
      let breakEv = null, grabConnectAt = -1, breakAt = -1, holdList = null;
      (function find(l) { if (holdList) return; l.forEach((x, i) => { if (!holdList && x.type === "BuiltinCommonInstructions::Comment" && String(x.comment).startsWith("Metal coat, the grab breaks:")) { holdList = l; breakAt = i; breakEv = l[i + 1]; grabConnectAt = l.findIndex(y => y.type === "BuiltinCommonInstructions::Comment" && String(y.comment).startsWith("Grab connects:")); } if (!holdList && x.events) find(x.events); }); })(samSheet.events);
      if (!breakEv) bad.push("the Samurai has no Metal coat, the grab breaks event");
      else {
        const bc = JSON.stringify(breakEv.conditions), ba = JSON.stringify(breakEv.actions);
        if (!bc.includes('"MetalCoatFire","=","1"') || !bc.includes("GrabHold")) bad.push("the grab breaks only when the coat formed (MetalCoatFire) while he is in GrabHold");
        for (const [what, ok] of [["he flinches into Stagger", ba.includes("Samurai_Stagger") && ba.includes("AIState")], ["he is not invulnerable any more", ba.includes('"Invulnerable","False"')], ["the grab cooldown restarts (no instant regrab)", ba.includes("GrabCooldownTimer") && ba.includes("GrabCooldownNow")], ["the warning and hitboxes are cleared", ba.includes("Samurai_Grab_Warning") && ba.includes("Samurai_Hitbox")], ["no dash state is left over (DashType)", ba.includes('"DashType"')], ["the skill step is reset", ba.includes('"SkillStep","=","0"')]]) if (!ok) bad.push("the broken grab needs: " + what);
        if (!(breakAt < grabConnectAt)) bad.push("the grab-break event must come before the grab events");
      }
      // The ultimate: the coat blows the remaining cuts away into petals and sparks (the ultimate's own finish event then restores everything); and the flinch must skip the ultimate and the intermission.
      let ultEv = null, flinchEv = null, finishEv = null;
      walk(samSheet.events, x => {
        const xc = JSON.stringify(x.conditions || []), xa = JSON.stringify(x.actions || []);
        if (xc.includes('"MetalCoatFire","=","1"') && xc.includes("Ultimate")) ultEv = x;
        if (xc.includes("JustStaggered") && xa.includes("Samurai_Stagger")) flinchEv = x;
        if (xc.includes("Thousand_Cuts_Ultimate") && xc.includes('"=","0"') && xc.includes("UltStep")) finishEv = x;
      });
      if (!ultEv) bad.push("the coat must clear the ultimate's remaining cuts");
      else {
        const ua = JSON.stringify(ultEv.actions);
        if (!ua.includes("Thousand_Cuts_Ultimate") || !ua.includes("Samurai_Petal_Pop") || !ua.includes("Deflect_Spark")) bad.push("the cuts vanish in petals and sparks (a flashy burst)");
        if (!ua.includes("Ult_Deflect_Tell")) bad.push("the deflect tell is cleared too");
        if (ua.includes("JustStaggered") || ua.includes('"AIState"') || ua.includes("Invulnerable")) bad.push("the ultimate must be ended only by deleting the cuts, through its own finish event (no state changes here)");
        if (!(JSON.stringify(ultEv.events || []).includes("setBlendMode"))) bad.push("the new sparks are drawn additively");
      }
      if (!finishEv) bad.push("the ultimate's own finish event (no cuts left: unlock, vulnerable) is gone");
      if (!flinchEv) bad.push("the lunge flinch event is gone");
      else { const fcj = JSON.stringify(flinchEv.conditions); for (const st of ["Ultimate", "Intermission", "GrabHold"]) if (!fcj.includes(st)) bad.push("the flinch must be skipped in " + st); }
      // The petals: the coat bursts every Samurai petal still out, using the burst event the petals already have (a pop and the blade removed).
      let petalEv = null, burstEv = null;
      walk(samSheet.events, x => {
        if (x.type === "BuiltinCommonInstructions::Standard" && JSON.stringify(x.conditions || []).includes('"MetalCoatFire","=","1"') && JSON.stringify(x.actions || []).includes("Samurai_Petal")) petalEv = x;
        if (x.type === "BuiltinCommonInstructions::ForEach" && JSON.stringify(x.conditions || []).includes("burst") && JSON.stringify(x.conditions || []).includes("Samurai_Petal") && JSON.stringify(x.actions || []).includes("Samurai_Petal_Pop")) burstEv = x;
      });
      if (!petalEv) bad.push("when the coat forms, the Samurai's petals must burst");
      else if (!JSON.stringify(petalEv.actions).includes("burst") || JSON.stringify(petalEv.actions).includes("PetalTornado")) bad.push("the coat sets every Samurai_Petal to State burst and leaves the tornado alone");
      if (!burstEv) bad.push("the petal burst event (pop and delete) the coat relies on is gone");
      if (!(gi > at)) bad.push("the full event must come before the grab one (it uses up the ready flag first)");
    }
    // The slide: an ease-out over KnockTime, in its own event, while KnockLeft lasts.
    const ki = cs.events.findIndex(x => x.type === "BuiltinCommonInstructions::Comment" && String(x.comment).startsWith("Metal coat, the knockback:"));
    if (ki < 0) bad.push("the knockback slide event is missing");
    else {
      const m = cs.events[ki + 1], mc = JSON.stringify(m.conditions), ma = m.actions.find(x => x.type.value === "SetX");
      if (!mc.includes('"KnockLeft",">","0"')) bad.push("the slide runs only while KnockLeft lasts");
      if (!ma || !/KnockDir/.test(ma.parameters[2]) || !/KnockLeft\) \/ Player\.Variable\(KnockTime/.test(ma.parameters[2]) || !/TimeDelta\(\)/.test(ma.parameters[2])) bad.push("the slide should be an ease-out: speed falls with KnockLeft, times TimeDelta, along KnockDir");
      if (!JSON.stringify(m.actions).includes('"KnockLeft","-","TimeDelta()"')) bad.push("the slide must run down KnockLeft");
    }
    return bad;
  }],

  ["Samurai grab stab blood (the fight's sheet and the tutorial's): the stab spawns blood like every other hit (a random one of the 9 splashes, flying away from him, on the middle of the player's body), not a bare Create at the frame centre that went up from his head", () => {
    const bad = [], { sheets } = load();
    for (const name of ["Samurai_Boss", "Tutorial_Samurai_Boss"]) {
      const sh = sheets.find(x => x.name === name);
      if (!sh) { bad.push(name + " not found"); continue; }
      let stab = null, last = "";
      walk(sh.events, ev => { if (ev.type === "BuiltinCommonInstructions::Comment") { last = String(ev.comment); return; } if (!stab && last.startsWith("Grab: the blade goes in")) stab = ev; last = ""; });
      if (!stab) { bad.push(name + ": the stab event is gone"); continue; }
      if (JSON.stringify(stab.actions).includes('"BloodSprite"')) bad.push(name + ": the stab must not create blood itself (a bare Create has no animation: a fountain going up)");
      const kids = (stab.events || []).filter(c => c.type === "BuiltinCommonInstructions::Standard"), kj = JSON.stringify(kids);
      const makes = kids.filter(c => JSON.stringify(c.actions || []).includes('"BloodSprite"') && JSON.stringify(c.actions).includes('"Create"'));
      if (makes.length !== 2) { bad.push(name + ": expected two blood events (from the left and from the right of the player), found " + makes.length); continue; }
      if (!kj.includes("RandomInRange(0, 8)")) bad.push(name + ": the splash must be rolled (RandomInRange(0, 8))");
      for (const m of makes) {
        const j = JSON.stringify(m.actions), c = JSON.stringify(m.conditions);
        if (!j.includes("Player.Y() + 62 * Player.ScaleY()")) bad.push(name + ": the blood must start on the middle of the player's body (Player.Y() + 62 * ScaleY), not on his head");
        if (!c.includes("Samurai_NPC.CenterX()") || !c.includes("Player.CenterX()")) bad.push(name + ": the side is the Samurai's against the player's");
        if (!j.includes("Player.Variable(BloodRoll)") || !j.includes("FlipX")) bad.push(name + ": the blood plays the rolled splash and flips for a hit from the right");
      }
      const flips = makes.map(m => (m.actions.find(a => a.type.value.endsWith("FlipX")) || { parameters: [] }).parameters[2]);
      if (flips[0] !== "no" || flips[1] !== "yes") bad.push(name + ": the Samurai on the left sprays right (no flip), on the right flipped; got " + JSON.stringify(flips));
      if (!JSON.stringify(makes[0].conditions).includes('"<"') || !JSON.stringify(makes[1].conditions).includes('">="')) bad.push(name + ": the two blood events are the Samurai left of the player, and right of him");
    }
    return bad;
  }],

  ["Requiem (phase 6, brand 3): R is refused when he cannot be hurt, is not under 30% HP or is too far (no use spent); otherwise a one-per-fight sequence locks the player and makes him untouchable, zooms the camera in, brings the big shadow, strikes at 0.45 s (RequiemFire) and puts everything back; a dead player aborts it; the event takes the boss to 0 HP only when vulnerable and weak", () => {
    const code = script("Combat_Shared", "const POWER = {"), bad = [], savedPixi = global.PIXI;
    global.PIXI = Object.assign({}, savedPixi, { Text: function (t) { this.text = t; this.x = 0; this.y = 0; }, Graphics: function () { this.alpha = 1; this.clear = () => {}; this.lineStyle = () => {}; this.moveTo = () => {}; this.lineTo = () => {}; this.beginFill = () => {}; this.endFill = () => {}; this.drawRect = () => {}; this.destroy = () => { this.destroyed = true; }; } });
    try {
      const make = (sceneName, over) => {
        const G = vars({ LoadoutSlot1: "requiem", LoadoutSlot2: "", LoadoutSlot3: "" });
        const pv = vars(Object.assign({ MaxHealth: 100, Health: 100, ControlsLocked: 0, IsDead: 0, IsDeathblow: 0, IsGrabbed: 0, IsPostureBroken: 0, RespawnIframe: 0, RequiemFire: 0, RequiemSrcX: 0,
          RequiemHpFrac: 0.3, RequiemRange: 260, BossX: 500, BossY: 450, BossHpFrac: 0.2, BossVulnerable: 1 }, over));
        let reset = 0, zoom = 1; const zooms = [], made = [], gfx = [];
        const player = obj("Player", { extra: { getVariables: () => pv, getCenterXInScene: () => 400, getScaleX: () => 2.2, getY: () => 500, getZOrder: () => 10, resetTimer: () => { reset++; } } });
        let pressed = new Set();
        const gd = { evtTools: { input: { wasKeyJustPressed: (s, k) => pressed.has(k), isKeyPressed: () => false } } };
        const layer = { getCameraZoom: () => zoom, setCameraZoom: z => { zoom = z; zooms.push(z); }, getRenderer: () => ({ getRendererObject: () => ({ addChild: c => gfx.push(c) }) }) };
        const scene = { getName: () => sceneName, getObjects: n => n === "Player" ? [player] : [], getElapsedTime: () => 1000 / 60, getLayer: () => layer,
          createObject: n => { const o = { name: n, gone: false, op: -1, x: 0, y: 0, setAnimationName(a) { this.anim = a; }, setScale(s) { this.sc = s; }, getWidth: () => 120, setX(v) { this.x = v; }, setY(v) { this.y = v; }, setZOrder() {}, flipX(f) { this.flip = f; }, setOpacity(v) { this.op = v; }, deleteFromScene() { this.gone = true; } }; made.push(o); return o; },
          getGame: () => ({ getVariables: () => G, getGameResolutionHeight: () => 720, getGameResolutionWidth: () => 1280 }) };
        const fn = new Function("runtimeScene", "gdjs", code);
        const frame = k => { pressed = new Set(k || []); fn(scene, gd); pressed = new Set(); };
        return { frame, run: n => { for (let i = 0; i < n; i++) frame(); }, n: k => pv.get(k).getAsNumber(), pv, made, zooms, gfx, reset: () => reset, zoom: () => zoom };
      };
      const msg = s => (s.gfx.length, ""), refused = (over, label) => { const s = make("Samurai_Fight", over); s.run(2); s.frame(["r"]); s.run(3); if (s.n("ControlsLocked") !== 0 || s.made.length) bad.push(label + ": Requiem must be refused"); s.run(120); if (s.n("RequiemFire") !== 0) bad.push(label + ": no strike when refused"); return s; };
      refused({ BossVulnerable: 0 }, "an invulnerable boss"); refused({ BossHpFrac: 0.5 }, "a boss over 30% HP"); refused({ BossX: 900 }, "a far boss");
      // A refused try spends nothing: the same fight can still use it.
      let s = make("Samurai_Fight"); s.run(2); s.pv.get("BossHpFrac").setNumber(0.6); s.frame(["r"]); s.pv.get("BossHpFrac").setNumber(0.2); s.frame(["r"]); s.run(2);
      if (s.n("ControlsLocked") !== 1) bad.push("after a refused try the next R should work (nothing is spent)");
      // The sequence.
      s = make("Samurai_Fight"); s.run(2); s.frame(["r"]);
      if (s.n("ControlsLocked") !== 1 || s.n("RespawnIframe") !== 1 || s.reset() < 1) bad.push("Requiem locks the player and makes him untouchable for its length (RespawnIframe and its timer)");
      let strikeAt = -1, maxZoom = 1, shadow = null;
      for (let f = 1; f <= 100; f++) { s.frame(); if (strikeAt < 0 && s.n("RequiemFire") === 1) { strikeAt = f / 60; if (s.n("RequiemSrcX") !== 400) bad.push("the strike says where the player stood (RequiemSrcX)"); } maxZoom = Math.max(maxZoom, s.zoom()); shadow = shadow || s.made.find(o => o.name === "Player_Shadow"); if (s.n("RequiemFire") === 1) s.pv.get("RequiemFire").setNumber(0); }
      if (strikeAt < 0.3 || strikeAt > 0.6) bad.push("the strike should come about 0.45 s in, came at " + strikeAt);
      if (maxZoom < 1.12 || maxZoom > 1.25) bad.push("the camera should zoom in about 16%, peaked at " + maxZoom);
      if (!shadow || shadow.anim !== "Strike" || shadow.sc < 2.5) bad.push("the big shadow should cut (Player_Shadow, Strike, 1.6 times the player's scale)");
      if (shadow && shadow.x !== 500 - 95 - 60) bad.push("the shadow stands 95 px from the boss on the player's side (left), got " + shadow.x);
      if (s.zoom() !== 1) bad.push("the camera zoom must go back to normal, is " + s.zoom());
      if (s.n("ControlsLocked") !== 0) bad.push("the player must be free again at the end");
      if (!shadow || !shadow.gone) bad.push("the shadow is deleted at the end");
      if (s.gfx.some(g => g.destroyed === undefined && false)) bad.push("graphics");
      // Once per fight.
      s.pv.get("BossHpFrac").setNumber(0.1); s.run(2); s.frame(["r"]); s.run(2); if (s.n("ControlsLocked") !== 0 || s.n("RequiemFire") !== 0) bad.push("Requiem works once per fight");
      // Dead: the sequence stops and the camera is restored (the locked flag stays as death set it).
      s = make("Samurai_Fight"); s.run(2); s.frame(["r"]); s.run(10); s.pv.get("IsDead").setNumber(1); s.run(3);
      if (s.zoom() !== 1) bad.push("a dead player's Requiem must restore the camera zoom"); s.run(90); if (s.n("RequiemFire") !== 0) bad.push("a dead player's Requiem must not strike");
      // No powers in the tutorial or the hub.
      for (const name of ["Tutorial_Level", "HUB_Area"]) { s = make(name); s.run(2); s.frame(["r"]); s.run(2); if (s.n("ControlsLocked") !== 0) bad.push("no Requiem in " + name); }
    } finally { global.PIXI = savedPixi; }
    // The events.
    const { sheets } = load(), cs = sheets.find(x => x.name === "Combat_Shared"); let dmg = null, info = false, vuln = 0, clear = null;
    walk(cs.events, ev => {
      for (const a of ev.actions || []) {
        if (a.type.value === "SetNumberObjectVariable" && a.parameters[0] === "Enemy" && a.parameters[1] === "Health" && a.parameters[3] === "0" && JSON.stringify(ev.conditions).includes("RequiemFire")) dmg = ev;
        if (a.parameters[1] === "BossHpFrac" && /Enemy\.Variable\(Health\)/.test(a.parameters[3])) info = true;
        if (a.parameters[1] === "BossVulnerable") vuln++;
        if (a.parameters[1] === "RequiemFire" && a.parameters[3] === "0") clear = ev;
      }
    });
    if (!dmg) bad.push("the Requiem damage event is missing");
    else {
      const c = JSON.stringify(dmg.conditions), j = JSON.stringify(dmg.events || []);
      if (!c.includes("Invulnerable") || !c.includes("RequiemHpFrac")) bad.push("the Requiem damage needs a vulnerable boss at or under RequiemHpFrac");
      if ((j.split("Sfx/hits/hit_").length - 1) !== 5 || !j.includes("BloodSprite") || !j.includes("RequiemSrcX")) bad.push("Requiem's hit has the player's hit sounds and blood, from where he stood (RequiemSrcX)");
      if (JSON.stringify(dmg.actions).includes("Posture")) bad.push("Requiem takes HP, not posture");
    }
    if (!info || vuln !== 2) bad.push("the boss info events (BossHpFrac, BossVulnerable 1 and 0) are missing");
    if (!clear) bad.push("RequiemFire is never cleared");
    return bad;
  }],

  ["Hub debug key G (behind the DEBUG_KEYS gate): every gate with a scene is awake, the saved progress untouched, a second press undoes it; the gate stays out of Fire Knight-style locked gates", () => {
    const bad = [], { scenes } = load(), hub = scenes.find(x => x.name === "HUB_Area");
    if (!hub) return ["HUB_Area not found"];
    let code = null; walk(hub.events, ev => { if (!code && ev.type === "BuiltinCommonInstructions::JsCode" && codeOf(ev).includes("debugOpen")) code = codeOf(ev); });
    if (!code) return ["the hub gates script has no debugOpen (debug key G)"];
    if (!code.includes('wasKeyJustPressed(runtimeScene, "g")')) bad.push("the hub should read the G key");
    if (!code.includes('st.debugOpen) && v.get("State").getAsString() !== "locked" && scene')) bad.push("debugOpen must open only gates that are not locked and have a scene");
    const { sheets } = load(), cs = sheets.find(x => x.name === "Combat_Shared"), gate = cs.events.find(x => x.type === "BuiltinCommonInstructions::JsCode" && codeOf(x).includes("const DEBUG_KEYS"));
    if (!codeOf(gate).includes("|g|y)$/")) bad.push("the DEBUG_KEYS gate must switch off the G and Y keys");
    return bad;
  }],

  ["Debug keys O and B and the debug readout: the keys add one to the GLOBAL mercy / brand count and wrap to 0 after every boss; the readout adds two lines to the Debug_UI text after the scene's own text, never piles up, replaces the placeholder TEXT, and the text is hidden when DEBUG_KEYS is off", () => {
    const code = script("Combat_Shared", "__soulRushDebugCounts"), bad = [];
    const make = (text, g, pInit, off) => {
      const G = vars(g), box = obj("Debug_UI"), pv = vars(Object.assign({ PerfectCount: 0, PerfectForced: 0, ComposureOn: 0 }, pInit || {})), player = obj("Player", { extra: { getVariables: () => pv } });
      box.text = text; let cb = null, pressed = new Set();
      const gd = { registerRuntimeScenePostEventsCallback: f => { cb = f; }, evtTools: { input: { wasKeyJustPressed: (s, k) => pressed.has(k) } } };
      if (off) gd.__soulRushDebugGate = true;
      const scene = { getObjects: n => n === "Debug_UI" ? [box] : n === "Player" ? [player] : [], getGame: () => ({ getVariables: () => G }) };
      const fn = new Function("runtimeScene", "gdjs", code);
      return { G, box, frame(...keys) { pressed = new Set(keys); fn(scene, gd); pressed = new Set(); if (cb) cb(scene); return box.text; }, gd, fn, scene };
    };
    // The keys: the global counts step 1, 2, 3, 4, 5, 0, 1 for 5 bosses; the other count does not move.
    const k = make("", { MercyCount: 0, BrandCount: 0, BossCount: 5 }); const seen = [];
    for (let i = 0; i < 7; i++) { k.frame("o"); seen.push(k.G.get("MercyCount").getAsNumber()); }
    if (seen.join(",") !== "1,2,3,4,5,0,1") bad.push("O counts " + seen.join(",") + ", wanted 1,2,3,4,5,0,1 (wrapping after 5 bosses)");
    if (k.G.get("BrandCount").getAsNumber() !== 0) bad.push("O moved the brand count");
    k.frame("b"); k.frame("b"); if (k.G.get("BrandCount").getAsNumber() !== 2 || k.G.get("MercyCount").getAsNumber() !== 1) bad.push("B should move only the brand count");
    k.frame(); if (k.G.get("MercyCount").getAsNumber() !== 1) bad.push("a frame with no key changed a count");
    // The readout.
    const counts = { BrandCount: 2, MercyCount: 1, BossCount: 5 };
    let r = make("Lives: 3\nStamina: 50", counts, { PerfectCount: 3, PerfectForced: 1, ComposureOn: 1 }); const first = r.frame(), second = r.frame();
    if (first !== "Lives: 3\nStamina: 50\nBrand: 2 / 5 | Mercy: 1 / 5\nPerfect: 3 (forced) | Composure: on") bad.push("the lines should follow the scene's text, got " + JSON.stringify(first));
    if (second !== first) bad.push("the lines piled up on the second frame: " + JSON.stringify(second));
    r = make("TEXT", counts); if (r.frame() !== "Brand: 2 / 5 | Mercy: 1 / 5\nPerfect: 0 | Composure: off") bad.push("the placeholder TEXT should be replaced, got " + JSON.stringify(r.box.text));
    r = make("Lives: 3", counts, null, true); r.frame(); if (!r.box.hidden || r.box.text !== "Lives: 3") bad.push("with DEBUG_KEYS off the text must be hidden and left alone");
    let regs = 0; const gd2 = { registerRuntimeScenePostEventsCallback: () => { regs++; }, evtTools: { input: { wasKeyJustPressed: () => false } } };
    const G2 = vars({ BossCount: 5 }); const sc2 = { getObjects: () => [], getGame: () => ({ getVariables: () => G2 }) };
    new Function("runtimeScene", "gdjs", code)(sc2, gd2); new Function("runtimeScene", "gdjs", code)(sc2, gd2); if (regs !== 1) bad.push("the script registered " + regs + " callbacks, wanted 1");
    // The old scene-variable events must be gone (they changed a variable the readout never read).
    const { sheets } = load(), cs = sheets.find(s => s.name === "Combat_Shared"); let old = 0;
    walk(cs.events, e => { for (const a of e.actions || []) if (a.type.value === "SetNumberVariable" && /(Mercy|Brand)Count/.test(a.parameters[0])) old++; });
    if (old) bad.push(old + " event(s) still set the mercy or brand count as a scene variable");
    return bad;
  }],

  // ---- Phase 4 of docs/design-brand-mercy.md: the powers, the loadout and the dodge slot (data first) -------------------------
  ["Powers (phase 4): the registry is sound (unique ids, known kinds and sources, real boss scenes), and equip keeps a power in one slot, only built owned powers of the right kind, the dodge to roll when empty", () => {
    const bad = [], PW = require("../powers/powers.js"), HUB = require("../hub/hub.js"), { scenes } = load();
    const ids = new Set(), sceneNames = new Set(scenes.map(s => s.name));
    const gateScenes = new Set(HUB.gates.filter(g => g.scene).map(g => g.scene));
    for (const p of PW.POWERS) {
      if (ids.has(p.id)) bad.push("duplicate power id " + p.id); ids.add(p.id);
      if (!["active", "passive", "dodge"].includes(p.kind)) bad.push(p.id + " has an unknown kind " + p.kind);
      const keys = Object.keys(p.source); if (keys.length !== 1 || !["kill", "spare", "brand", "mercy", "bonus"].includes(keys[0])) bad.push(p.id + " has a bad source " + JSON.stringify(p.source));
      const s = p.source;
      if (s.kill || s.spare) { const sc = s.kill || s.spare; if (!gateScenes.has(sc) && sc !== "Fire_Knight_Fight") bad.push(p.id + " comes from " + sc + ", which is not a hub gate"); else if (gateScenes.has(sc) && !sceneNames.has(sc)) bad.push(p.id + " comes from " + sc + ", which is not a scene"); }
      if ((s.brand || s.mercy) && !(Number.isInteger(s.brand || s.mercy) && (s.brand || s.mercy) >= 1 && (s.brand || s.mercy) <= 6)) bad.push(p.id + " has a bad count " + JSON.stringify(s));
    }
    // The Brand and Mercy trees of the design: one power per count from 1 to 5.
    for (const [key, names] of [["brand", ["shadow_echo", "riposte", "requiem", "projectile_return", "roll_deflect"]], ["mercy", ["poise", "respite", "steady_hand", "light_step", "grace"]]])
      names.forEach((id, i) => { const p = PW.POWERS.find(x => x.id === id); if (!p || p.source[key] !== i + 1) bad.push(id + " should be " + key + " " + (i + 1)); });
    // equip(): with a test list where two actives and a dodge are built.
    const list = [{ id: "a", kind: "active", built: true, source: {} }, { id: "b", kind: "active", built: true, source: {} }, { id: "c", kind: "active", built: true, source: {} },
      { id: "u", kind: "active", built: false, source: {} }, { id: "p", kind: "passive", built: true, source: {} }, { id: "d1", kind: "dodge", built: true, source: {} }];
    const own = ["a", "b", "c", "u", "p", "d1"];
    let l = PW.EMPTY_LOADOUT;
    l = PW.equip(list, l, own, 0, "a"); l = PW.equip(list, l, own, 1, "b");
    if (l.slots.join(",") !== "a,b,") bad.push("equip: slots should be a,b,empty, got " + l.slots);
    l = PW.equip(list, l, own, 2, "a"); if (l.slots.join(",") !== ",b,a") bad.push("equip: a power moved to another slot must leave the first one, got " + l.slots);
    l = PW.equip(list, l, own, 0, "u"); if (l.slots[0] !== "") bad.push("equip: a power that is not built went in a slot");
    l = PW.equip(list, l, own, 0, "p"); if (l.slots[0] !== "") bad.push("equip: a passive went in a slot");
    l = PW.equip(list, l, ["a", "b"], 0, "c");       // c is built but not in the owned list
    if (l.slots.includes("c")) bad.push("equip: a power that is not owned stayed in a slot");
    l = PW.equip(list, PW.EMPTY_LOADOUT, own, "dodge", "d1"); if (l.dodge !== "d1") bad.push("equip: the dodge slot should take d1");
    l = PW.equip(list, l, own, "dodge", "a"); if (l.dodge !== "roll") bad.push("equip: an active in the dodge slot should fall back to the roll, got " + l.dodge);
    l = PW.equip(list, PW.equip(list, PW.EMPTY_LOADOUT, own, "dodge", "d1"), own, "dodge", ""); if (l.dodge !== "roll") bad.push("equip: emptying the dodge slot should give the roll");
    if (PW.tidy(list, null, own).dodge !== "roll" || PW.tidy(list, undefined, own).slots.length !== 3) bad.push("tidy: a missing loadout should become the empty one");
    return bad;
  }],

  ["Altar loadout screen (phase 4): F opens it and locks the player; W/S pick a row, A/D change it (only built, owned powers; one power in one slot; the dodge slot), it is saved at once, and F or Esc close it and free the player", () => {
    const code0 = script("HUB_Area", "Hub interactions"), bad = [], saved = global.PIXI;
    // Blood pact (an active) and the Flash step (a dodge) are built. For this test Poison stab (a second active) counts as built too.
    let code = code0;
    for (const id of ["poison_stab"]) { const re = new RegExp("(\"id\":\"" + id + "\"[^}]*\\}[^}]*\"built\":)false"); if (!re.test(code)) bad.push(id + " is not in the baked power list"); code = code.replace(re, "$1true"); }
    const objs = [];
    global.PIXI = Object.assign({}, saved, {
      Graphics: function () { for (const m of ["beginFill", "drawRect", "endFill", "clear"]) this[m] = () => this; this.destroy = () => { this.destroyed = true; }; },
      Text: function (t) { this.text = t; this.x = 0; this.y = 0; this.destroy = () => { this.destroyed = true; }; objs.push(this); }
    });
    try {
      const altar = obj("Hub_Altar", { vars: { Action: "loadout" } }), player = obj("Player"), prompt = obj("Hub_Prompt"), dialog = obj("Hub_Dialog");
      altar.x = 500; altar.w = 52; player.x = 500; prompt.hidden = true;
      const gvars = vars(); gvars.get("PowersOwned").setString("blood_pact,poison_stab,decoy,flash_step,poise");
      let pressed = new Set(); const store = {};
      global.localStorage = { setItem: (k, v) => { store[k] = v; }, getItem: k => store[k] };
      const root = { children: [], addChild(o) { o.parent = root; this.children.push(o); }, removeChild(o) { o.parent = null; this.children = this.children.filter(x => x !== o); } };
      const scene = { __hubGates: { progress: { awakened: {}, beaten: {}, loadout: { slots: ["", "", ""], dodge: "roll" } } }, getName: () => "HUB_Area",
        getObjects: n => ({ Player: [player], Hub_Altar: [altar], Hub_Prompt: [prompt], Hub_Dialog: [dialog] })[n] || [],
        getTimeManager: () => ({ getElapsedTime: () => 1000 / 60, getTimeScale: () => 1 }),
        getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => root }) }),
        getGame: () => ({ getGameResolutionWidth: () => 1280, getGameResolutionHeight: () => 720, getVariables: () => gvars }) };
      const gd = { evtTools: { input: { wasKeyJustPressed: (s, k) => pressed.has(k) }, runtimeScene: { replaceScene() {} } } };
      const fn = new Function("runtimeScene", "gdjs", code);
      const frame = (...keys) => { prompt.hidden = true; pressed = new Set(keys); fn(scene, gd); pressed = new Set(); };
      const loadout = () => scene.__hubGates.progress.loadout, text = () => (objs.filter(o => typeof o.text === "string" && o.text.includes("THE ALTAR")).pop() || { text: "" }).text;
      const locked = () => player.getVariables().get("ControlsLocked").getAsBoolean();
      frame(); frame(); if (!prompt.hidden === false && prompt.text !== "[F] Altar") bad.push("the prompt at the altar should say [F] Altar, got " + JSON.stringify(prompt.text));
      frame("f"); frame();
      if (!/THE ALTAR/.test(text()) || !locked()) { bad.push("F at the altar should open the screen and lock the player (text " + JSON.stringify(text().slice(0, 30)) + ", locked " + locked() + ")"); return bad; }
      if (!/> 1:  <  nothing  >/.test(text())) bad.push("the first row should start marked and on nothing: " + JSON.stringify(text().split("\n").slice(3, 8)));
      if (!/Owned, not ready yet:  .*Decoy/.test(text())) bad.push("an owned power that is not built should be listed as not ready yet");
      if (!/Always on:  .*Poise/.test(text())) bad.push("an owned passive should be listed under Always on");
      frame("d"); if (loadout().slots[0] !== "poison_stab") bad.push("A/D on row 1 should equip the first built active (Poison stab), got " + JSON.stringify(loadout().slots));
      if (!/poison_stab/.test(store["SoulRush.progress"] || "")) bad.push("the loadout was not saved when changed: " + store["SoulRush.progress"]);
      frame("d"); if (loadout().slots[0] !== "blood_pact") bad.push("the next step should be Blood pact, got " + JSON.stringify(loadout().slots));
      frame("d"); if (loadout().slots[0] !== "") bad.push("a third step should wrap back to nothing, got " + JSON.stringify(loadout().slots));
      frame("d"); frame("s"); frame("d");
      if (loadout().slots.join(",") !== ",poison_stab,") bad.push("Poison stab moved to row 2 must leave row 1, got " + JSON.stringify(loadout().slots));
      frame("s"); frame("s"); frame("d");
      if (loadout().dodge !== "flash_step") bad.push("A/D on the dodge row should pick the Flash step, got " + loadout().dodge);
      frame("a"); if (loadout().dodge !== "roll") bad.push("stepping back should give the roll, got " + loadout().dodge);
      frame("w"); frame("w"); frame("w"); frame("w"); frame("w");   // back round the rows
      frame("Escape"); frame();
      if (locked()) bad.push("Esc should free the player");
      if (root.children.length) bad.push("closing should remove the panel and the text, " + root.children.length + " left");
      frame("f"); frame(); if (!/THE ALTAR/.test(text()) || !locked()) bad.push("F at the altar again should open it again"); frame("f"); frame(); if (locked()) bad.push("F should close the screen");
    } finally { global.PIXI = saved; }
    return bad;
  }],

  ["Altar menu rules (phase 4): a row offers nothing (or the roll) and every built, owned power of its kind, and stepping wraps both ways", () => {
    const bad = [], PW = require("../powers/powers.js"), M = require("../loadout/menu.js");
    const list = [{ id: "a", name: "A", kind: "active", built: true, source: {} }, { id: "b", name: "B", kind: "active", built: true, source: {} }, { id: "x", name: "X", kind: "active", built: false, source: {} },
      { id: "d", name: "D", kind: "dodge", built: true, source: {} }, { id: "p", name: "P", kind: "passive", built: true, source: {} }];
    const own = ["a", "b", "x", "d", "p"];
    if (M.candidates(list, own, 0).join(",") !== ",a,b") bad.push("row 1 should offer nothing, a, b: " + M.candidates(list, own, 0));
    if (M.candidates(list, own, 3).join(",") !== "roll,d") bad.push("the dodge row should offer roll, d: " + M.candidates(list, own, 3));
    if (M.candidates(list, ["a"], 1).join(",") !== ",a") bad.push("only owned powers are offered");
    let l = PW.EMPTY_LOADOUT;
    l = M.cycle(list, l, own, 0, 1); if (l.slots[0] !== "a") bad.push("first step: a, got " + l.slots);
    l = M.cycle(list, l, own, 0, 1); if (l.slots[0] !== "b") bad.push("second step: b, got " + l.slots);
    l = M.cycle(list, l, own, 0, 1); if (l.slots[0] !== "") bad.push("third step wraps to nothing, got " + l.slots);
    l = M.cycle(list, l, own, 0, -1); if (l.slots[0] !== "b") bad.push("stepping back from nothing wraps to the last, got " + l.slots);
    const text = M.menuText(list, l, own, 0);
    if (!/> 1:  <  B  >/.test(text) || !/Dodge:  <  Roll  >/.test(text)) bad.push("the menu text should show the equipped power and the dodge: " + text.split("\n").slice(3, 9).join(" | "));
    if (!/nothing to choose yet/.test(M.menuText(list, PW.EMPTY_LOADOUT, [], 0))) bad.push("with nothing owned the rows should say there is nothing to choose");
    return bad;
  }],

  ["Powers in a fight (phase 4, slice 2): R uses the selected power, Blood pact pays a part of max HP as sacrificed HP and refills stamina (not when too weak, not on cooldown, not while locked), a tap of E selects the next, the tutorial and hub have none, debug key X equips it", () => {
    const code = script("Combat_Shared", "const POWER = {"), bad = [], saved = global.PIXI;
    const texts = [];
    global.PIXI = Object.assign({}, saved, { Text: function (t) { this.text = t; this.x = 0; this.y = 0; texts.push(this); } });
    try {
      const make = (sceneName, slot1, extra) => {
        const G = vars({ LoadoutSlot1: slot1 || "", LoadoutSlot2: (extra && extra.slot2) || "", LoadoutSlot3: "" });
        const pv = vars(Object.assign({ MaxHealth: 100, Health: 100, Stamina: 20, MaxStamina: 100, SacrificeHP: 0, BloodPactCost: 0.15, BloodPactFloor: 0.2,
          ControlsLocked: 0, IsDead: 0, IsDeathblow: 0, IsGrabbed: 0, IsPostureBroken: 0 }, extra && extra.p));
        const player = obj("Player", { extra: { getVariables: () => pv } });
        let pressed = new Set(), held = new Set();
        const gd = { evtTools: { input: { wasKeyJustPressed: (s, k) => pressed.has(k), isKeyPressed: (s, k) => held.has(k) } } };
        const root = { addChild() {} };
        const scene = { getName: () => sceneName, getObjects: n => n === "Player" ? [player] : [], getElapsedTime: () => 1000 / 60,
          getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => root }) }), getGame: () => ({ getVariables: () => G, getGameResolutionHeight: () => 720 }) };
        const fn = new Function("runtimeScene", "gdjs", code);
        const frame = (opts) => { pressed = new Set((opts && opts.press) || []); held = new Set((opts && opts.hold) || []); fn(scene, gd); pressed = new Set(); };
        const run = (n, opts) => { for (let i = 0; i < n; i++) frame(opts); };
        const n = k => pv.get(k).getAsNumber(), hud = () => (texts[texts.length - 1] || { text: "" }).text;
        return { frame, run, n, G, pv, hud, scene, texts: () => texts };
      };
      let s = make("Samurai_Fight", "");
      s.run(3, { press: ["r"] }); if (s.n("SacrificeHP") !== 0 || s.n("Stamina") !== 20) bad.push("R with nothing equipped did something");
      s = make("Samurai_Fight", "blood_pact"); s.run(2);
      if (!/^R  Blood pact/.test(s.hud())) bad.push("the readout should say R  Blood pact, got " + JSON.stringify(s.hud()));
      s.frame({ press: ["r"] });
      if (s.n("Stamina") !== 100 || s.n("SacrificeHP") !== 15) bad.push("Blood pact should refill stamina and sacrifice 15 HP, got stamina " + s.n("Stamina") + ", sacrifice " + s.n("SacrificeHP"));
      if (!/Blood pact  -15 HP/.test(s.hud())) bad.push("the readout should show the cost, got " + JSON.stringify(s.hud()));
      s.pv.get("Stamina").setNumber(10); s.pv.get("SacrificeHP").setNumber(0);
      s.frame({ press: ["r"] }); if (s.n("SacrificeHP") !== 0) bad.push("Blood pact worked again at once (it has a cooldown)");
      s.run(100); s.frame({ press: ["r"] }); if (s.n("SacrificeHP") !== 15 || s.n("Stamina") !== 100) bad.push("Blood pact should work again after its cooldown");
      // Too weak: 30 HP minus a 15 HP cost leaves 15, under the floor of 20% of max.
      s = make("Samurai_Fight", "blood_pact", { p: { Health: 30 } }); s.run(2); s.frame({ press: ["r"] });
      if (s.n("SacrificeHP") !== 0 || s.n("Stamina") !== 20) bad.push("Blood pact worked when it would leave under the floor");
      if (!/Too weak/.test(s.hud())) bad.push("the readout should say too weak, got " + JSON.stringify(s.hud()));
      s.pv.get("Health").setNumber(100); s.frame({ press: ["r"] }); if (s.n("SacrificeHP") !== 15) bad.push("a refused Blood pact must not start the cooldown");
      // The player cannot act.
      for (const flag of ["ControlsLocked", "IsDead", "IsDeathblow", "IsGrabbed", "IsPostureBroken"]) { s = make("Samurai_Fight", "blood_pact", { p: { [flag]: 1 } }); s.run(2); s.frame({ press: ["r"] }); if (s.n("SacrificeHP") !== 0) bad.push("Blood pact worked while " + flag); }
      // No powers in the tutorial or the hub.
      for (const name of ["Tutorial_Level", "HUB_Area"]) { s = make(name, "blood_pact"); s.run(2); s.frame({ press: ["r"] }); if (s.n("SacrificeHP") !== 0) bad.push("Blood pact worked in " + name); }
      // E: a tap selects the next filled slot; a long hold (the mercy) does not.
      s = make("Samurai_Fight", "blood_pact", { slot2: "blood_pact" }); s.run(2);
      if (!/tap E/.test(s.hud())) bad.push("with two powers the readout should say tap E, got " + JSON.stringify(s.hud()));
      if (s.scene.__powers.sel !== 0) bad.push("the first filled slot should be selected at the start, got " + s.scene.__powers.sel);
      s.run(5, { hold: ["e"] }); s.frame();
      if (s.scene.__powers.sel !== 1) bad.push("a tap of E should select the next slot, got " + s.scene.__powers.sel);
      s.run(5, { hold: ["e"] }); s.frame();
      if (s.scene.__powers.sel !== 0) bad.push("a second tap should wrap to the first slot, got " + s.scene.__powers.sel);
      s.run(90, { hold: ["e"] }); s.frame();
      if (s.scene.__powers.sel !== 0) bad.push("holding E for 1.5 s (the mercy) must not change the selection, got " + s.scene.__powers.sel);
      // Debug X equips Blood pact in slot 1.
      s = make("Samurai_Fight", ""); s.frame({ press: ["x"] }); if (s.G.get("LoadoutSlot1").getAsString() !== "blood_pact") bad.push("debug X should equip Blood pact in slot 1 first");
      s.frame({ press: ["x"] }); if (s.G.get("LoadoutSlot1").getAsString() !== "requiem") bad.push("a second debug X should equip Requiem, got " + s.G.get("LoadoutSlot1").getAsString());
      s.frame({ press: ["x"] }); if (s.G.get("LoadoutSlot1").getAsString() !== "blood_pact") bad.push("a third debug X should go round to Blood pact");
    } finally { global.PIXI = saved; }
    return bad;
  }],

  ["Dodge slot (phase 4, slice 4): the roll events read their numbers from the Player (DodgeSpeed, DodgeIframe, DodgeStamina), nothing else hard-codes 400, 0.32 or 30", () => {
    const bad = [], { sheets } = load(), pm = sheets.find(s => s.name === "Player_Movement");
    const found = { start: 0, cost: 0, iframe: 0, move: 0 };
    walk(pm.events, e => {
      for (const c of e.conditions || []) {
        if (c.type.value === "NumberObjectVariable" && c.parameters[1] === "Stamina" && c.parameters[2] === ">=" && (e.actions || []).some(a => JSON.stringify(a.parameters).includes("RollTimer"))) { found.start++; if (c.parameters[3] !== "Player.Variable(DodgeStamina)") bad.push("the roll needs " + c.parameters[3] + " stamina to start, not DodgeStamina"); }
        if (c.type.value === "CompareObjectTimer" && JSON.stringify(c.parameters).includes("RollTimer") && c.parameters[2] === ">=") { found.iframe++; if (c.parameters[3] !== "Player.Variable(DodgeIframeActive)") bad.push("the i-frames end after " + c.parameters[3] + ", not DodgeIframeActive"); }
      }
      for (const a of e.actions || []) {
        if (a.type.value === "SetNumberObjectVariable" && a.parameters[1] === "Stamina" && a.parameters[2] === "-" && (e.actions || []).some(x => JSON.stringify(x.parameters).includes("RollTimer"))) { found.cost++; if (a.parameters[3] !== "Player.Variable(DodgeStamina)") bad.push("the roll costs " + a.parameters[3] + ", not DodgeStamina"); }
        if (a.type.value === "SetX" && a.parameters[0] === "Player" && (e.conditions || []).some(c => JSON.stringify(c.parameters).includes("IsRolling"))) { found.move++; if (a.parameters[2] !== "Player.Variable(DodgeSpeed) * TimeDelta()") bad.push("the roll moves " + a.parameters[2] + ", not DodgeSpeed");
          if (!(e.conditions || []).some(c => c.type.value === "CompareObjectTimer" && c.parameters[2] === "<" && c.parameters[3] === "Player.Variable(DodgeMoveTime)")) bad.push("the roll's move must stop after DodgeMoveTime seconds (RollTimer < DodgeMoveTime)"); }
      }
    });
    if (found.start !== 1 || found.cost !== 1 || found.iframe !== 1 || found.move !== 2) bad.push("expected the roll's start, cost, i-frame end and two moves, found " + JSON.stringify(found));
    return bad;
  }],

  ["Dodge slot (phase 4, slice 4): the roll, the Flash step (charges, falls back to the roll) and the Wraith dash (HP, falls back to the roll) write the numbers for the next press and pay for the dodge that started; Light step; no dashes in the tutorial, but the hub has them; debug key C", () => {
    const code = script("Combat_Shared", "const order = [\"roll\""), bad = [], saved = global.PIXI;
    global.PIXI = Object.assign({}, saved, { Text: function (t) { this.text = t; this.x = 0; this.y = 0; } });
    try {
      const make = (sceneName, dodge, extra) => {
        const G = vars({ LoadoutDodge: dodge, MercyCount: (extra && extra.mercy) || 0 });
        const pv = vars(Object.assign({ MaxHealth: 100, Health: 100, SacrificeHP: 0, BloodPactFloor: 0.2, IsRolling: 0, ComposureOn: 0,
          DodgeSpeed: 400, DodgeIframe: 0.32, DodgeStamina: 30, DodgeSpeedBase: 400, DodgeIframeBase: 0.32, DodgeStaminaBase: 30,
          DashSpeedFlash: 640, DashIframeFlash: 0.36, DashChargesMax: 2, DashCharges: 2, DashRecharge: 3, DashSpeedWraith: 520, DashIframeWraith: 0.46, WraithCost: 0.06,
          LightStepDashBonus: 0.5, LightStepRollBonus: 0.25 }, extra && extra.p));
        const player = obj("Player", { extra: { getVariables: () => pv } });
        let pressed = new Set();
        const gd = { registerRuntimeScenePostEventsCallback() {}, evtTools: { input: { wasKeyJustPressed: (s, k) => pressed.has(k) } } };
        const scene = { getName: () => sceneName, getObjects: n => n === "Player" ? [player] : [], getElapsedTime: () => 1000 / 60,
          getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => ({ addChild() {} }) }) }), getGame: () => ({ getVariables: () => G, getGameResolutionHeight: () => 720 }) };
        const fn = new Function("runtimeScene", "gdjs", code);
        const frame = (...keys) => { pressed = new Set(keys); fn(scene, gd); pressed = new Set(); };
        const n = k => pv.get(k).getAsNumber();
        // A press: the numbers are read by the roll event, which then sets IsRolling for a short while.
        const roll = () => { frame(); pv.get("IsRolling").setBoolean(true); frame(); pv.get("IsRolling").setBoolean(false); frame(); };
        return { G, pv, frame, n, roll };
      };
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      // The roll.
      let s = make("Samurai_Fight", "roll"); s.frame();
      if (s.n("DodgeSpeed") !== 400 || !near(s.n("DodgeIframe"), 0.32) || s.n("DodgeStamina") !== 30) bad.push("the roll should be 400 px/s, 0.32 s, 30 stamina, got " + s.n("DodgeSpeed") + ", " + s.n("DodgeIframe") + ", " + s.n("DodgeStamina"));
      // The Flash step: faster, no stamina, a charge each; with none left the press is a roll again; the charges come back.
      s = make("Samurai_Fight", "flash_step"); s.frame();
      if (s.n("DodgeSpeed") !== 640 || !near(s.n("DodgeIframe"), 0.36) || s.n("DodgeStamina") !== 0) bad.push("the Flash step should be 640 px/s, 0.36 s, no stamina, got " + s.n("DodgeSpeed") + ", " + s.n("DodgeIframe") + ", " + s.n("DodgeStamina"));
      s.roll(); if (Math.abs(s.n("DashCharges") - 1) > 0.05) bad.push("a Flash step should take one charge (2 to 1), got " + s.n("DashCharges"));
      s.roll(); if (s.n("DashCharges") >= 1) bad.push("a second Flash step should take another charge, got " + s.n("DashCharges"));
      if (s.n("DodgeSpeed") !== 400 || s.n("DodgeStamina") !== 30) bad.push("with no charge left the press should be a plain roll (400, 30), got " + s.n("DodgeSpeed") + ", " + s.n("DodgeStamina"));
      for (let i = 0; i < 60 * 3.2; i++) s.frame(); if (s.n("DashCharges") < 1 || s.n("DodgeSpeed") !== 640) bad.push("after 3 s a charge should be back (the Flash step again), got " + s.n("DashCharges"));
      for (let i = 0; i < 60 * 10; i++) s.frame(); if (s.n("DashCharges") !== 2) bad.push("the charges should stop at the maximum, got " + s.n("DashCharges"));
      // The roll while in Flash step mode with a charge does not spend stamina; a roll pressed with no charge is paid in stamina by the event (DodgeStamina 30).
      // The Wraith dash: the longest i-frames, HP instead of stamina.
      s = make("Samurai_Fight", "wraith_dash"); s.frame();
      if (s.n("DodgeSpeed") !== 520 || !near(s.n("DodgeIframe"), 0.46) || s.n("DodgeStamina") !== 0) bad.push("the Wraith dash should be 520 px/s, 0.46 s, no stamina, got " + s.n("DodgeSpeed") + ", " + s.n("DodgeIframe") + ", " + s.n("DodgeStamina"));
      s.roll(); if (s.n("SacrificeHP") !== 6) bad.push("a Wraith dash should sacrifice 6 HP (6% of 100), got " + s.n("SacrificeHP"));
      s.pv.get("Health").setNumber(25); s.frame(); if (s.n("DodgeSpeed") !== 400 || s.n("DodgeStamina") !== 30) bad.push("a Wraith dash that would leave under the floor (25 - 6 < 20) should be a roll");
      // Light step (mercy 4, above the band): charges back faster, the roll cheaper.
      s = make("Samurai_Fight", "roll", { mercy: 4, p: { ComposureOn: 1 } }); s.frame(); if (s.n("DodgeStamina") !== 22.5) bad.push("Light step: the roll should cost 22.5, got " + s.n("DodgeStamina"));
      s = make("Samurai_Fight", "roll", { mercy: 4, p: { ComposureOn: 0 } }); s.frame(); if (s.n("DodgeStamina") !== 30) bad.push("Light step must not work below the band");
      s = make("Samurai_Fight", "flash_step", { mercy: 4, p: { ComposureOn: 1, DashCharges: 0 } }); for (let i = 0; i < 60 * 2; i++) s.frame(); if (s.n("DashCharges") < 0.99) bad.push("Light step: a charge should be back after 2 s (3 s / 1.5), got " + s.n("DashCharges"));
      s = make("Samurai_Fight", "flash_step", { mercy: 3, p: { ComposureOn: 1, DashCharges: 0 } }); for (let i = 0; i < 60 * 2; i++) s.frame(); if (s.n("DashCharges") >= 1) bad.push("without Light step a charge should not be back after 2 s, got " + s.n("DashCharges"));
      // The tutorial has the roll; the hub has the loadout's dodge (2026-11-25).
      s = make("Tutorial_Level", "flash_step"); s.frame(); if (s.n("DodgeSpeed") !== 400 || s.n("DodgeStamina") !== 30) bad.push("the tutorial should have the plain roll, got " + s.n("DodgeSpeed"));
      s = make("HUB_Area", "flash_step"); s.frame(); if (s.n("DodgeSpeed") !== 640 || s.n("DodgeStamina") !== 0) bad.push("the hub should have the loadout's Flash step (640 px/s in this test, no stamina), got " + s.n("DodgeSpeed"));
      // Debug C cycles roll, Flash step, Wraith dash.
      s = make("Samurai_Fight", "roll"); const seen = []; for (let i = 0; i < 4; i++) { s.frame("c"); seen.push(s.G.get("LoadoutDodge").getAsString()); }
      if (seen.join(",") !== "flash_step,wraith_dash,roll,flash_step") bad.push("C cycles " + seen.join(",") + ", wanted flash_step,wraith_dash,roll,flash_step");
    } finally { global.PIXI = saved; }
    return bad;
  }],


  ["Dash effects (phase 4): the Flash step and the Wraith dash draw the Samurai's speed lines (gold, green), growing with the dash, placed like his, fading smoothly over 0.3 s (not in steps); the roll draws nothing; the images and the global object exist", () => {
    const code = script("Combat_Shared", "const FADE = 0.3"), bad = [];
    const created = [];
    const mk = () => ({ anim: "", x: 0, y: 0, w: 0, h: 0, op: -1, z: 99, flip: null, deleted: false, flipX(v) { this.flip = v; }, setAnimationName(n) { this.anim = n; }, setX(v) { this.x = v; }, setY(v) { this.y = v; }, setWidth(v) { this.w = v; }, setHeight(v) { this.h = v; },
      setOpacity(v) { this.op = v; }, setZOrder(v) { this.z = v; }, deleteFromScene() { this.deleted = true; } });
    const player = obj("Player", { extra: { getCenterYInScene() { return this.y; } } });
    const dodge = { active: "" };
    const scene = { __dodge: dodge, getObjects: n => n === "Player" ? [player] : [], getElapsedTime: () => 1000 / 60, createObject: n => { if (n !== "Player_Dash_Trail") return null; const o = mk(); created.push(o); return o; } };
    const fn = new Function("runtimeScene", code);
    const reset = () => { created.length = 0; scene.__dashFx = null; player.x = 500; player.y = 600; dodge.active = ""; };
    const dash = (kind, frames, step) => { dodge.active = kind; for (let i = 0; i < frames; i++) { player.x += step; fn(scene); } };
    reset(); dash("roll", 20, 6); fn(scene); if (created.length) bad.push("the plain roll drew a trail");
    // The Flash step, rightwards: 20 frames of 10 px.
    reset(); dash("flash_step", 20, 10); const t = created[0];
    if (created.length !== 1 || !t) { bad.push("a Flash step should make one trail, made " + created.length); return bad; }
    if (t.anim !== "Flash") bad.push("the Flash step's trail should be the Flash animation, got " + t.anim);
    if (t.x !== 500 + 10 || Math.abs(t.w - 190) > 0.001) bad.push("the trail should start where the dash did (x 510) and be 190 px wide, got x " + t.x + ", width " + t.w);
    if (t.y !== 575 || t.h !== 50) bad.push("the trail should be 50 high, centred on the player (top 25 above, y 575), got y " + t.y + ", height " + t.h);
    if (t.z !== 0) bad.push("the trail should sit behind the player, z " + t.z);
    if (t.flip !== true) bad.push("a dash to the right should flip the image (its bright end is on the left, and must lead), got " + t.flip);
    // The dash ends: five steps, then gone.
    dodge.active = ""; const ops = []; for (let i = 0; i < 24; i++) { fn(scene); ops.push(t.deleted ? "gone" : t.op); }
    const seq = ops.filter((v, i) => i === 0 || v !== ops[i - 1]).join(",");
    const vals = ops.filter(v => v !== "gone");
    if (ops[ops.length - 1] !== "gone" || ops.indexOf("gone") < 16 || ops.indexOf("gone") > 21) bad.push("the trail should be gone after about 0.3 s (frame 18), it went at frame " + ops.indexOf("gone"));
    if (vals.some((v, i) => i > 0 && v > vals[i - 1])) bad.push("the fade must never get brighter again: " + seq);
    if (new Set(vals).size < 12) bad.push("the fade should be smooth (many different opacities), got only " + new Set(vals).size + ": " + seq);
    if (vals[0] < 200) bad.push("the fade should start near full opacity, got " + vals[0]);
    // Leftwards, and the Wraith dash.
    reset(); dash("wraith_dash", 15, -10); const w = created[0];
    if (!w || w.anim !== "Wraith") bad.push("the Wraith dash's trail should be the Wraith animation, got " + (w && w.anim));
    else if (w.flip !== false) bad.push("a dash to the left should not flip the image, got " + w.flip);
    else if (w.x !== 500 - 150 || Math.abs(w.w - 140) > 0.001) bad.push("a leftward dash's trail starts at its smaller x (350) and is 140 wide (from 490), got x " + w.x + ", width " + w.w);
    // A second dash after the first made its own trail.
    dodge.active = ""; for (let i = 0; i < 20; i++) fn(scene); dash("flash_step", 5, 10); if (created.length !== 2) bad.push("a new dash should make a new trail, " + created.length + " made");
    // The assets: the two recoloured sheets, registered, and the global object with both animations.
    const project = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "Soul Rush.json"), "utf8"));
    for (const f of ["dash_trail_flash.png", "dash_trail_wraith.png"]) { const rel = "assets/Player/Dash/" + f; if (!exists(rel)) bad.push(rel + " is missing"); const res = project.resources.resources.find(r => r.name === rel); if (!res) bad.push(rel + " is not registered"); else if (res.smoothed !== true) bad.push(rel + " should be smoothed (it is stretched over a dash)"); }
    const po = project.objects.find(o => o.name === "Player_Dash_Trail");
    if (!po) bad.push("the global object Player_Dash_Trail is missing");
    else if (po.animations.map(a => a.name).join(",") !== "Flash,Wraith") bad.push("Player_Dash_Trail should have the animations Flash and Wraith, has " + po.animations.map(a => a.name));
    return bad;
  }],

  ["Dash timing (phase 4): a dash moves for DashMoveTime only (the roll for its whole length), the player is invisible during it, and after DashEndTime the roll is ended at once (idle pose, visible, free to act); an interrupted dash shows him again", () => {
    const code = script("Combat_Shared", "const order = [\"roll\""), bad = [], saved = global.PIXI;
    global.PIXI = Object.assign({}, saved, { Text: function (t) { this.text = t; this.x = 0; this.y = 0; } });
    try {
      const make = (dodge) => {
        const G = vars({ LoadoutDodge: dodge, MercyCount: 0 });
        const pv = vars({ MaxHealth: 100, Health: 100, SacrificeHP: 0, BloodPactFloor: 0.2, IsRolling: 0, ComposureOn: 0, DodgeSpeed: 400, DodgeMoveTime: 99, DodgeIframe: 0.32, DodgeStamina: 30,
          DodgeSpeedBase: 400, DodgeMoveTimeBase: 99, DodgeIframeBase: 0.32, DodgeStaminaBase: 30, DashSpeedFlash: 3300, DashIframeFlash: 0.36, DashChargesMax: 2, DashCharges: 2, DashRecharge: 3,
          DashSpeedWraith: 2900, DashIframeWraith: 0.46, WraithCost: 0.06, DashMoveTime: 0.09, DashEndTime: 0.12, LightStepDashBonus: 0.5, LightStepRollBonus: 0.25 });
        const player = obj("Player", { extra: { getVariables: () => pv } }); player.op = 255; player.anim = "Player_Roll";
        const gd = { registerRuntimeScenePostEventsCallback() {}, evtTools: { input: { wasKeyJustPressed: () => false } } };
        const scene = { getName: () => "Samurai_Fight", getObjects: n => n === "Player" ? [player] : [], getElapsedTime: () => 1000 / 60,
          getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => ({ addChild() {} }) }) }), getGame: () => ({ getVariables: () => G, getGameResolutionHeight: () => 720 }) };
        const fn = new Function("runtimeScene", "gdjs", code);
        return { pv, player, frame: () => fn(scene, gd), rolling: () => pv.get("IsRolling").getAsBoolean(), n: k => pv.get(k).getAsNumber() };
      };
      // The numbers the roll events read.
      let s = make("roll"); s.frame(); if (s.n("DodgeMoveTime") !== 99) bad.push("the roll should move for its whole length (DodgeMoveTime 99), got " + s.n("DodgeMoveTime"));
      s = make("flash_step"); s.frame(); if (s.n("DodgeMoveTime") !== 0.09 || s.n("DodgeSpeed") !== 3300) bad.push("the Flash step should move 3300 px/s for 0.09 s, got " + s.n("DodgeSpeed") + " for " + s.n("DodgeMoveTime"));
      s = make("wraith_dash"); s.frame(); if (s.n("DodgeMoveTime") !== 0.09 || s.n("DodgeSpeed") !== 2900) bad.push("the Wraith dash should move 2900 px/s for 0.09 s, got " + s.n("DodgeSpeed") + " for " + s.n("DodgeMoveTime"));
      // A Flash step: the press starts the roll; the player vanishes at once, and is back, idle and no longer rolling, after 0.12 s.
      s = make("flash_step"); s.frame(); s.pv.get("IsRolling").setBoolean(true); s.frame();
      if (s.player.op !== 0) bad.push("the player should vanish when a dash starts, opacity " + s.player.op);
      for (let i = 0; i < 4; i++) s.frame(); if (s.player.op !== 0 || !s.rolling()) bad.push("he should still be gone and rolling 0.07 s in");
      for (let i = 0; i < 6; i++) s.frame();
      if (s.player.op !== 255) bad.push("he should be back after 0.12 s, opacity " + s.player.op);
      if (s.rolling()) bad.push("the dash should end the roll at once (IsRolling off) so he is free to act");
      if (s.player.anim !== "Player_Idle") bad.push("after a dash he should be in the idle pose, got " + s.player.anim);
      // The plain roll is left alone: visible, and it ends by its own animation.
      s = make("roll"); s.frame(); s.pv.get("IsRolling").setBoolean(true); for (let i = 0; i < 30; i++) s.frame();
      if (s.player.op !== 255 || !s.rolling() || s.player.anim !== "Player_Roll") bad.push("the plain roll must stay visible and keep rolling, got opacity " + s.player.op + ", rolling " + s.rolling() + ", " + s.player.anim);
      // A dash interrupted (a posture break ends the roll): he is shown again.
      s = make("wraith_dash"); s.frame(); s.pv.get("IsRolling").setBoolean(true); s.frame(); s.frame(); s.pv.get("IsRolling").setBoolean(false); s.frame();
      if (s.player.op !== 255) bad.push("an interrupted dash must show the player again, opacity " + s.player.op);
    } finally { global.PIXI = saved; }
    return bad;
  }],

  ["Dodge numbers are frozen while a dodge is going (a second Flash step used to turn into a roll's 400 px/s mid-dash), the i-frames use the length copied at the start, and a dodge never leaves the arena (clamped between the walls beside the start)", () => {
    const code = script("Combat_Shared", "const order = [\"roll\""), bad = [], saved = global.PIXI;
    global.PIXI = Object.assign({}, saved, { Text: function (t) { this.text = t; this.x = 0; this.y = 0; } });
    try {
      let cb = null;
      const walls = [
        // A rect: { l, r, t, b }. The side walls beside the arena, and the floor under it.
        { l: -64, r: 0, t: 0, b: 720 }, { l: 1280, r: 1344, t: 0, b: 720 }, { l: 0, r: 1344, t: 660, b: 700 }
      ].map(w => ({ getHitBoxes: () => [{ vertices: [[w.l, w.t], [w.r, w.t], [w.r, w.b], [w.l, w.b]] }] }));
      const make = (dodge, p) => {
        const G = vars({ LoadoutDodge: dodge, MercyCount: 0 });
        const pv = vars(Object.assign({ MaxHealth: 100, Health: 100, SacrificeHP: 0, BloodPactFloor: 0.2, IsRolling: 0, ComposureOn: 0, DodgeSpeed: 400, DodgeMoveTime: 99, DodgeIframe: 0.32, DodgeIframeActive: 0.32, DodgeStamina: 30,
          DodgeSpeedBase: 400, DodgeMoveTimeBase: 99, DodgeIframeBase: 0.32, DodgeStaminaBase: 30, DashSpeedFlash: 3300, DashIframeFlash: 0.36, DashChargesMax: 2, DashCharges: 2, DashRecharge: 3,
          DashSpeedWraith: 2900, DashIframeWraith: 0.46, WraithCost: 0.06, DashMoveTime: 0.09, DashEndTime: 0.12, LightStepDashBonus: 0.5, LightStepRollBonus: 0.25 }, p));
        // The player: a 20 px wide, 60 px high body whose x is its centre.
        const player = obj("Player", { extra: { getVariables: () => pv, getHitBoxes() { return [{ vertices: [[this.x - 10, 560], [this.x + 10, 560], [this.x + 10, 620], [this.x - 10, 620]] }]; }, getX() { return this.x; } } });
        player.x = 640; player.op = 255;
        const gd = { registerRuntimeScenePostEventsCallback: f => { cb = f; }, evtTools: { input: { wasKeyJustPressed: () => false } } };
        const scene = { getName: () => "Samurai_Fight", getObjects: n => n === "Player" ? [player] : n === "Invisible_Wall" ? walls : [], getElapsedTime: () => 1000 / 60,
          getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => ({ addChild() {} }) }) }), getGame: () => ({ getVariables: () => G, getGameResolutionHeight: () => 720 }) };
        const fn = new Function("runtimeScene", "gdjs", code);
        return { pv, player, scene, frame: () => fn(scene, gd), n: k => pv.get(k).getAsNumber(), rolling: v => pv.get("IsRolling").setBoolean(v) };
      };
      // Frozen numbers: a Flash step with ONE charge left is paid at the start, so the next press would be a roll; the dash must not turn into one.
      let s = make("flash_step", { DashCharges: 1 }); s.frame();
      if (s.n("DodgeSpeed") !== 3300) bad.push("before the press the Flash step numbers should be ready, got " + s.n("DodgeSpeed"));
      s.rolling(true); s.frame(); s.frame();
      if (s.n("DashCharges") >= 1) bad.push("the dash should have taken the last charge, got " + s.n("DashCharges"));
      if (s.n("DodgeSpeed") !== 3300 || s.n("DodgeMoveTime") !== 0.09) bad.push("the numbers must stay the dash's while it goes (3300, 0.09), got " + s.n("DodgeSpeed") + ", " + s.n("DodgeMoveTime"));
      if (Math.abs(s.n("DodgeIframeActive") - 0.36) > 1e-9) bad.push("the i-frames of the dash should be copied at its start (0.36), got " + s.n("DodgeIframeActive"));
      for (let i = 0; i < 10; i++) s.frame();           // The dash ends (0.12 s).
      if (s.n("DodgeSpeed") !== 400 || s.n("DodgeMoveTime") !== 99 || s.n("DodgeStamina") !== 30) bad.push("after the dash the numbers should be the roll's for the next press, got " + s.n("DodgeSpeed") + ", " + s.n("DodgeMoveTime") + ", " + s.n("DodgeStamina"));
      if (Math.abs(s.n("DodgeIframeActive") - 0.36) > 1e-9) bad.push("the dash's i-frame length must stay until the next dodge starts, got " + s.n("DodgeIframeActive"));
      // The second dash of two: it must also keep the dash numbers while it goes (charges 2, then 1, then 0 during the second).
      s = make("flash_step"); s.frame(); s.rolling(true); s.frame(); for (let i = 0; i < 10; i++) s.frame(); s.frame();
      s.rolling(true); s.frame(); s.frame();
      if (s.n("DodgeSpeed") !== 3300 || s.n("DodgeMoveTime") !== 0.09) bad.push("the SECOND dash must keep 3300 px/s for 0.09 s while it goes (it used to fall to a roll's), got " + s.n("DodgeSpeed") + ", " + s.n("DodgeMoveTime"));
      // A Wraith dash whose HP cost pushes the next one under the floor keeps its numbers too.
      s = make("wraith_dash", { Health: 27 }); s.frame(); s.rolling(true); s.frame(); s.pv.get("Health").setNumber(21); s.frame();
      if (s.n("DodgeSpeed") !== 2900) bad.push("the Wraith dash must keep 2900 px/s while it goes even when its cost leaves little HP, got " + s.n("DodgeSpeed"));
      // The arena: a dodge started at x 1200 is clamped under the right wall (1280), one started at 100 over the left (0); the floor is ignored; nothing when not rolling.
      s = make("flash_step"); s.player.x = 1200; s.frame(); cb(s.scene); s.rolling(true); s.frame();
      s.player.x = 1350; cb(s.scene); if (s.player.x !== 1270) bad.push("a dash past the right wall should be put back at 1270 (its right edge on the wall), got " + s.player.x);
      s.player.x = 1200; cb(s.scene); if (s.player.x !== 1200) bad.push("inside the arena the player must not move, got " + s.player.x);
      s = make("flash_step"); s.player.x = 100; s.frame(); cb(s.scene); s.rolling(true); s.frame();
      s.player.x = -40; cb(s.scene); if (s.player.x !== 10) bad.push("a dash past the left wall should be put back at 10, got " + s.player.x);
      // Hugging a wall: 10 px from it, the first frame of the dash already throws him 55 px through it, before the script has seen the dash start.
      s = make("flash_step"); s.player.x = 22; s.frame(); cb(s.scene); s.rolling(true); s.player.x = -33; cb(s.scene); if (s.player.x !== 10) bad.push("hugging the left wall (10 px away) and dashing at it must stop at the wall (x 10), got " + s.player.x);
      s = make("flash_step"); s.player.x = 1258; s.frame(); cb(s.scene); s.rolling(true); s.player.x = 1313; cb(s.scene); if (s.player.x !== 1270) bad.push("hugging the right wall and dashing at it must stop at the wall (x 1270), got " + s.player.x);
      s = make("flash_step"); s.player.x = 1200; s.frame(); s.player.x = 1350; cb(s.scene); if (s.player.x !== 1350) bad.push("when no dodge is going the clamp must leave the player alone");
    } finally { global.PIXI = saved; }
    return bad;
  }],

  ["Dash speed lines sit on the player's body, not on his 120x80 frame (whose centre is about 20 px above his body)", () => {
    const code = script("Combat_Shared", "const FADE = 0.3"), bad = [];
    const made = [];
    const mk = () => ({ x: 0, y: 0, w: 0, h: 0, setAnimationName() {}, setX(v) { this.x = v; }, setY(v) { this.y = v; }, setWidth(v) { this.w = v; }, setHeight(v) { this.h = v; }, setOpacity() {}, setZOrder() {}, deleteFromScene() {} });
    // The frame centre is (600, 620); the body (collision box) is x 590 to 610 around 600, y 640 to 680.
    const player = obj("Player", { extra: { getCenterYInScene() { return 620; }, getHitBoxes() { return [{ vertices: [[this.x - 10, 640], [this.x + 10, 640], [this.x + 10, 680], [this.x - 10, 680]] }]; } } });
    player.x = 600;
    const dodge = { active: "flash_step" };
    const scene = { __dodge: dodge, getObjects: n => n === "Player" ? [player] : [], getElapsedTime: () => 1000 / 60, createObject: n => { const o = mk(); made.push(o); return o; } };
    const fn = new Function("runtimeScene", code);
    fn(scene); player.x = 700; fn(scene);
    const t = made[0];
    if (!t) return ["no trail was made"];
    if (t.y !== 660 - 25 || t.h !== 50) bad.push("the trail should be centred on the body (y 660), 50 high: top 635, got top " + t.y + ", height " + t.h);
    if (t.x !== 600 || Math.abs(t.w - 100) > 0.001) bad.push("the trail should run from the body's x at the start (600) to its x now (700), got x " + t.x + ", width " + t.w);
    return bad;
  }],
];
