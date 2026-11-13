// Behaviour: runs the project's own script events (taken straight from the scene and sheet files) against stand-in
// objects, and checks they still do what they were built to do. A failure here means a change broke an old feature.
const { load, walk, codeOf, exists } = require("./lib");

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
    for (const x of scenes.concat(sheets)) walk(x.events, e => { for (const c of e.conditions || []) if (c.type.value === "CompareObjectTimer" && String(c.parameters[1]).includes("DeflectTimer") && String(c.parameters[3]).includes("DeflectWindow") && c.parameters[2] !== ">") { uses++; if (!/DeflectWindowNow/.test(c.parameters[3])) bad.push(x.file + " deflects with " + c.parameters[3] + " instead of DeflectWindowNow"); } });
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
    const keys = ["F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "Numpad0", "Numpad1", "Numpad9", "NumpadReturn", "NumpadAdd", "NumpadSubtract", "NumpadMultiply", "NumpadDivide", "Num0", "Home", "End", "Insert", "Delete", "PageUp", "PageDown", "LAlt"];
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
    if (v("PetalCountP2") !== 5 || v("PetalCountP3") !== 5) bad.push("petals: phase 2 should be 5 (a half circle) and phase 3 should be 5 (got " + v("PetalCountP2") + " and " + v("PetalCountP3") + ")");
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
    if (!(sc.objects.find(o => o.name === "Samurai_NPC").animations.find(a => a.name === "Samurai_Dash_Out_Back").directions[0].timeBetweenFrames <= 0.034)) bad.push("the flash step's back dash must be 20% faster (0.033 s a frame or less)");
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
    const mirObj = sc.objects.find(o => o.name === "Samurai_Mirror");
    if (!(mirObj.effects || []).some(e => e.effectType === "RGBSplit" && e.name === "Split")) bad.push("Samurai_Mirror needs an RGBSplit effect named Split");
    if (val("MirrorStyle") !== 1) bad.push("the mirror's outline style should be the default (MirrorStyle 1)");
    if (!json.includes("samurai_hit_animation (1).mp3")) bad.push("the card slash must use his normal attack sound");
    if (!/zIndex = 1000000/.test(script("Combat_Shared", "Desperation glow: when a deflect"))) bad.push("the Desperation blade glow must draw on top of the fighters (zIndex)");
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
    const player = obj("Player", { extra: { getVariables: () => pv, getPointX: () => 300, getPointY: () => 400 } });
    const children = [];
    const savedPixi = global.PIXI; let drawn = 0, cleared = 0;
    global.PIXI = { Graphics: function () { this.clear = () => { cleared++; drawn = 0; }; this.beginFill = () => {}; this.drawCircle = () => { drawn++; }; this.endFill = () => {}; } };
    const scene = { getObjects: n => n === "Player" ? [player] : [], getTimeManager: () => ({ getElapsedTime: () => 1000 / 60, getTimeScale: () => 1 }),
      getLayer: () => ({ getRenderer: () => ({ getRendererObject: () => ({ addChild: g => children.push(g) }) }) }) };
    const run = () => new Function("runtimeScene", "gdjs", code)(scene, {});
    try {
      for (let i = 0; i < 5; i++) run();
      if (children.length || drawn) bad.push("the glow drew without a flag");
      pv.get("DespUsed").v = true; run();
      if (pv.get("DespUsed").v) bad.push("the glow must clear DespUsed once it has started");
      if (!children.length || !drawn) bad.push("the glow did not draw after the flag");
      let frames = 1; while (drawn && frames < 120) { run(); frames++; }
      if (frames < 15 || frames > 25) bad.push("the glow lasted " + frames + " frames at 60 fps, expected about 0.3 s (18)");
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
    const P = { Lives: 3, CurseStacks: 1, MaxHealth: 80, Health: 50, BaseMaxHealth: 100, CursePercent: 15, DbgDesperation: 0, DbgSnap: 0, DbgLives: 0, DbgCurse: 0, DbgMaxHealth: 0, DbgHealth: 0, IsDead: false };
    const ev = ex => new Function("P", "max", "min", "return (" + ex.replace(/Player\.Variable\((\w+)\)/g, "P.$1") + ");")(P, Math.max, Math.min);
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
  }]
];
