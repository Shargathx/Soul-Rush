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
    if (hp.getLayer() !== "UI" || Math.abs(hp.x - 320) > 1) bad.push("boss HP bar not at the bottom centre on the UI layer (" + hp.getLayer() + " " + hp.x + "," + hp.y + ")");
    if (name.text !== "The Samurai") bad.push("boss name is " + JSON.stringify(name.text));
    if (objs.Desperation_Icon && !objs.Desperation_Icon[0].hidden) bad.push("Desperation icon showing with no curse");
    for (const [stacks, want] of [[1, "x1"], [2, "x2"], [4, "x3"]]) {
      pv.get("CurseStacks").v = stacks; curse.w = 36 * stacks; step(30);
      const di = objs.Desperation_Icon && objs.Desperation_Icon[0], dc = objs.Desperation_Count && objs.Desperation_Count[0];
      if (!di || di.hidden) { bad.push("Desperation icon not shown at " + stacks + " stacks"); continue; }
      if (!dc || dc.text !== want) bad.push("Desperation count at " + stacks + " stacks is " + (dc && dc.text) + ", expected " + want);
      if (Math.abs(di.x - (268 + 36 * stacks + 6)) > 1) bad.push("Desperation icon not right after the flames at " + stacks + " stacks (x " + di.x + ")");
    }
    pv.get("CurseStacks").v = 0; curse.hidden = true; step(2);
    if (!objs.Desperation_Icon[0].hidden) bad.push("Desperation icon still shown after the curse lifted");
    return bad;
  }],

  ["deflect: both deflects use the Desperation window; one press stops only one ranged attack", () => {
    const { scenes, sheets } = load(), bad = [];
    let uses = 0;
    for (const x of scenes.concat(sheets)) walk(x.events, e => { for (const c of e.conditions || []) if (c.type.value === "CompareObjectTimer" && String(c.parameters[1]).includes("DeflectTimer") && String(c.parameters[3]).includes("DeflectWindow")) { uses++; if (!/DeflectWindowNow/.test(c.parameters[3])) bad.push(x.file + " deflects with " + c.parameters[3] + " instead of DeflectWindowNow"); } });
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

  ["Leaf Ranger dodge: the roll has i-frames (Invulnerable for its whole length) and the dodge interval is re-rolled between 2 and 5", () => {
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
      if (has(e, "\"DodgeEvery\",\"=\",\"RandomInRange(2, 5)\"")) reroll++;
    });
    if (enter !== 1) bad.push("expected one roll entry, found " + enter);
    if (leave !== 1) bad.push("expected one roll exit, found " + leave);
    if (reroll !== 1) bad.push("the dodge must re-roll DodgeEvery with RandomInRange(2, 5) after each dodge");
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
