// A small stand-in for GDevelop and Combat_Shared, to run a boss's real script (the code in its event sheet) for thousands of
// frames against a scripted player: hitboxes that hurt or get deflected, hits that build posture and break it, deathblows,
// lives, the boss's death. It is not the engine: it checks that the script never throws, never reads an undeclared variable,
// never gets stuck, never leaks hitboxes, and walks through its states the way Combat_Shared drives them.
const fs = require("fs");
const path = require("path");
const { ROOT, load, walk, codeOf } = require("./lib");

// Just enough PIXI for the scripts that draw a prompt, hearts or a fade.
{ const G = function () { this.x = 0; this.y = 0; this.alpha = 1; this.visible = true; this.children = []; this.anchor = { set() {} }; };
  for (const m of ["beginFill", "drawRoundedRect", "endFill", "lineStyle", "drawCircle", "drawPolygon", "drawRect", "clear"]) G.prototype[m] = function () { return this; };
  G.prototype.addChild = function (c) { this.children.push(c); }; G.prototype.destroy = function () { this.destroyed = true; };
  global.PIXI = Object.assign({ Graphics: G, Container: G, Text: G }, global.PIXI || {}); for (const n of ["Container", "Text", "Graphics"]) if (!global.PIXI[n]) global.PIXI[n] = G;
  for (const n of ["Container", "Text", "Graphics"]) for (const m of Object.getOwnPropertyNames(G.prototype)) if (m !== "constructor" && !global.PIXI[n].prototype[m]) global.PIXI[n].prototype[m] = G.prototype[m]; }

class Vars {
  constructor(list, who) { this.m = {}; this.who = who; for (const v of list || []) this.m[v.name] = { v: v.value, type: v.type, used: 0 }; this.touched = new Set(); }
  has(n) { return n in this.m; }
  get(n) {
    if (!(n in this.m)) throw new Error(this.who + " reads the undeclared variable " + n);
    const c = this.m[n]; this.touched.add(n);
    return { getAsNumber: () => Number(c.v) || 0, setNumber: x => { c.v = x; }, getAsString: () => String(c.v), setString: x => { c.v = x; }, getAsBoolean: () => !!c.v, setBoolean: x => { c.v = !!x; } };
  }
}

class Obj {
  constructor(scene, def, x, y) {
    this.scene = scene; this.name = def.name; this.def = def; this.vars = new Vars(def.variables, def.name);
    this.x = x || 0; this.y = y || 0; this.w = 100; this.h = 100; this.hidden = false; this.flipped = false; this.anim = (def.animations && def.animations[0] && def.animations[0].name) || ""; this.frame = 0;
    this.deleted = false; this.timers = {}; this.scale = 1; this.angle = 0; this.paused = false; this.animLog = new Set();
  }
  getX() { return this.x; } getY() { return this.y; } setX(v) { this.x = v; } setY(v) { this.y = v; } setPosition(x, y) { this.x = x; this.y = y; }
  getWidth() { return this.w; } getHeight() { return this.h; } setWidth(v) { this.w = v; } setHeight(v) { this.h = v; } setScale(v) { this.scale = v; } setAngle(v) { this.angle = v; }
  setZOrder(z) { this.z = z; } getZOrder() { return this.z || 0; } hide(h) { this.hidden = h !== false; } isHidden() { return this.hidden; } flipX(f) { this.flipped = !!f; } isFlippedX() { return this.flipped; }
  getVariables() { return this.vars; } getCenterXInScene() { return this.x; } setOpacity() {} setLayer() {} getLayer() { return ""; }
  setAnimationName(n) {
    const a = (this.def.animations || []).find(x => x.name === n);
    if (!a) throw new Error(this.name + " has no animation " + n);
    this.anim = n; this.frame = 0; this.animLog.add(n);
  }
  setAnimationFrame(f) {
    const a = (this.def.animations || []).find(x => x.name === this.anim), n = a.directions[0].sprites.length;
    if (!(f >= 0 && f < n) || f !== Math.floor(f)) throw new Error(this.name + "." + this.anim + " has " + n + " frames, asked for frame " + f);
    this.frame = f;
  }
  getAnimationFrame() { return this.frame; } getAnimationName() { return this.anim; }
  getAnimationFrameCount() { const a = (this.def.animations || []).find(x => x.name === this.anim); return a ? a.directions[0].sprites.length : 1; }
  hasAnimationEnded() { return false; } setAnimationIndex() {} setBlendMode() {} setOpacity() {}
  setColor(c) { this.color = c; (this.colorLog || (this.colorLog = [])).push(c); }
  pauseAnimation() { this.paused = true; } playAnimation() { this.paused = false; }
  resetTimer(n) { this.timers[n] = this.scene.time; }
  timerElapsed(n) { return this.scene.time - (this.timers[n] === undefined ? this.scene.time : this.timers[n]); }
  deleteFromScene() { this.deleted = true; this.scene.remove(this); }
}

class Scene {
  constructor(sceneJson, name) {
    this.json = sceneJson; this.sceneName = name; this.objs = []; this.time = 0; this.sounds = []; this.created = {}; this.maxLive = {};
    const node = () => { const n = { v: 0, kids: {}, getChild(k) { return this.kids[k] || (this.kids[k] = node()); }, get(k) { return this.getChild(k); }, setBoolean(b) { this.v = !!b; }, setString(s) { this.v = String(s); }, setNumber(x) { this.v = x; }, getAsBoolean() { return !!this.v; }, getAsString() { return String(this.v); } }; return n; };
    this.globals = node();
    this.groups = {}; for (const g of sceneJson.objectsGroups || []) this.groups[g.name] = g.objects.map(o => o.name);
  }
  def(name) { return this.json.objects.find(o => o.name === name) || load().project.objects.find(o => o.name === name); }
  spawn(name, x, y) { const d = this.def(name); if (!d) throw new Error("no object " + name + " in the scene"); const o = new Obj(this, d, x, y); this.objs.push(o); this.created[name] = (this.created[name] || 0) + 1; this.maxLive[name] = Math.max(this.maxLive[name] || 0, this.list(name).length); return o; }
  remove(o) { const i = this.objs.indexOf(o); if (i >= 0) this.objs.splice(i, 1); }
  list(name) { const names = this.groups[name] || [name]; return this.objs.filter(o => !o.deleted && names.includes(o.name)); }
  getObjects(n) { return this.list(n); }
  createObject(n) { return this.spawn(n, 0, 0); }
  getName() { return this.sceneName; }
  getElapsedTime() { return 1000 / 60; }
  getGame() { return { getSoundManager: () => ({ playSound: (f) => this.sounds.push(f) }), getVariables: () => this.globals }; }
  hasLayer() { return false; }
  getLayer() { return { getRenderer: () => ({ getRendererObject: () => ({ addChild(c) { c.parent = this; } }) }) }; }
}

// The JavaScript event of a boss's sheet (the one that holds the kit).
function bossScript(sheetName) {
  const sh = load().sheets.find(s => s.name === sheetName); if (!sh) throw new Error("sheet " + sheetName + " not found");
  let code = null; walk(sh.events, e => { if (!code && e.type === "BuiltinCommonInstructions::JsCode" && /makeKit/.test(codeOf(e))) code = codeOf(e); });
  if (!code) throw new Error("no kit script in " + sheetName);
  return code;
}

// Run a fight. opts: { frames, skill (0 to 1: how often the player deflects a hitbox), seed, aggression }.
function simulate(sceneName, bossName, sheetName, opts) {
  opts = opts || {};
  const sceneJson = load().scenes.find(s => s.name === sceneName); if (!sceneJson) throw new Error("scene " + sceneName + " not found");
  let seed = opts.seed || 1; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const sc = new Scene(sceneJson, sceneName);
  const boss = sc.spawn(bossName, 1000, 657), bv = boss.vars;
  const player = sc.spawn("Player", 200, 457);
  const code = bossScript(sheetName), fn = new Function("runtimeScene", "gdjs", code);
  const S = { frames: 0, states: new Set(), anims: boss.animLog, died: false, deathFrame: 0, playerHits: 0, deflects: 0, bossHits: 0, deathblows: 0, lifeLosses: 0, playerDeaths: 0, stunFrames: 0, errors: [], hitTypes: new Set(), dodges: 0, staggers: 0 };
  const N = opts.frames || 60 * 60 * 6, skill = opts.skill === undefined ? 0.5 : opts.skill, dt = 1 / 60;
  let swing = 0, nextSwing = 0, swingOpen = false, deathblowAt = -1, deathblowEnd = -1, onceHP = true, lastFlagReset = 0;
  const pvar = n => player.vars.get(n);
  const num = n => bv.get(n).getAsNumber(), setN = (n, x) => bv.get(n).setNumber(x), flag = n => bv.get(n).getAsBoolean(), setF = (n, b) => bv.get(n).setBoolean(b);
  const overlap = (h, p) => h.x < p.x + 40 && h.x + h.w > p.x - 40 && h.y < p.y + 176 && h.y + h.h > p.y;
  for (let f = 0; f < N; f++) {
    sc.time += dt; S.frames = f;
    // Combat_Shared, as far as it matters: the boss's one-frame flags are cleared first.
    for (const n of ["JustPostureBroken", "JustRecovered", "JustHitPlayer", "JustDodgedHit", "JustLostLife", "JustDied", "JustDeflected", "JustStaggered", "JustHitByPlayer"]) setF(n, false);
    pvar("AttackPressed").setBoolean(false);
    if (!sc.list("Player").length) break;
    // The scripted player: walks to the boss, swings every so often, deathblows a broken boss.
    const px = player.x, bx = boss.x, near = Math.abs(px - bx);
    if (deathblowEnd < 0) {
      if (flag("IsPostureBroken") && near > 90 && deathblowAt < 0) player.x += Math.sign(bx - px) * 500 * dt;
      else if (!flag("IsPostureBroken") && near > 130) player.x += Math.sign(bx - px) * 420 * dt;
      else if (!flag("IsPostureBroken") && near < 90) player.x -= Math.sign(bx - px) * 300 * dt;
      player.x = Math.max(60, Math.min(1220, player.x));
    }
    if (flag("IsPostureBroken") && near <= 115 && deathblowAt < 0 && deathblowEnd < 0 && !pvar("IsDeathblow").getAsBoolean() && rnd() < 0.9) { deathblowAt = sc.time + 0.3; pvar("IsDeathblow").setBoolean(true); }
    if (deathblowAt >= 0 && sc.time >= deathblowAt) {
      deathblowAt = -1; deathblowEnd = sc.time + 1; S.deathblows++;
      setN("Health", 0); setN("Posture", 0); setF("IsPostureBroken", false); boss.resetTimer("StunTimer"); setF("JustRecovered", true);
    }
    if (deathblowEnd >= 0 && sc.time >= deathblowEnd) { deathblowEnd = -1; pvar("IsDeathblow").setBoolean(false); }
    if (!pvar("IsDeathblow").getAsBoolean() && !flag("IsPostureBroken") && sc.time >= nextSwing && near < 200 + (opts.aggression || 0)) {
      pvar("AttackPressed").setBoolean(true); swing = sc.time + 0.25; nextSwing = sc.time + 0.45 + rnd() * 0.4; pvar("IsAttacking").setBoolean(true); swingOpen = true;
    }
    if (pvar("IsAttacking").getAsBoolean() && sc.time >= swing) pvar("IsAttacking").setBoolean(false);
    // The player's swing lands (Combat_Shared: a hit, a dodge, or nothing while Invulnerable).
    if (pvar("IsAttacking").getAsBoolean() && swingOpen && near < 180) {
      if (!flag("Invulnerable")) {
        swingOpen = false;
        if (flag("WillDodgeHit")) { setF("WillDodgeHit", false); setF("JustDodgedHit", true); S.dodges++; }
        else { setF("JustHitByPlayer", true); setN("Health", num("Health") - 15); setN("Posture", num("Posture") + 5); boss.resetTimer("PostureRegenTimer"); S.bossHits++; if (rnd() < 0.08) setF("JustStaggered", true); }
      }
    }
    // Enemy hitboxes against the player: deflected at `skill`, else damage. One hit per object.
    for (const h of sc.list("EnemyHitbox")) {
      const hv = h.vars; S.hitTypes.add(h.name);
      if (hv.get("HasHit").getAsBoolean() || !overlap(h, player)) continue;
      hv.get("HasHit").setBoolean(true);
      if (rnd() < skill) { S.deflects++; if (hv.get("IsMelee").getAsBoolean()) { setN("Posture", num("Posture") + 14); setF("JustDeflected", true); boss.resetTimer("PostureRegenTimer"); } }
      else { S.playerHits++; setF("JustHitPlayer", true); pvar("Health").setNumber(pvar("Health").getAsNumber() - hv.get("Damage").getAsNumber()); if (pvar("Health").getAsNumber() <= 0) { S.playerDeaths++; pvar("Health").setNumber(100); } }
    }
    // Posture break, stun end, life loss, death: Combat_Shared's rules.
    if (num("Posture") >= num("MaxPosture") && !flag("IsPostureBroken")) { setF("IsPostureBroken", true); setN("Posture", num("MaxPosture")); boss.resetTimer("StunTimer"); setF("JustPostureBroken", true); }
    if (flag("IsPostureBroken") && boss.timerElapsed("StunTimer") > num("StunDuration")) { setF("IsPostureBroken", false); setN("Posture", 0); setF("JustRecovered", true); }
    if (num("Health") <= 0 && onceHP) { onceHP = false; setN("Lives", num("Lives") - 1); setN("Health", num("MaxHealth")); setF("JustLostLife", true); S.lifeLosses++; if (num("Lives") <= 0) { setN("Health", 0); setF("Invulnerable", true); setF("JustDied", true); } }
    if (num("Health") > 0) onceHP = true;
    if (num("Posture") > num("MaxPosture")) setN("Posture", num("MaxPosture"));
    // The boss.
    try { fn(sc, {}); } catch (e) { S.errors.push("frame " + f + ": " + (e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); break; }
    S.states.add(bv.get("AIState").getAsString());
    if (flag("IsPostureBroken")) S.stunFrames++;
    if (bv.get("AIState").getAsString() === "Dead" && !S.died && num("Lives") <= 0) { S.died = true; S.deathFrame = f; }
    if (S.died && f - S.deathFrame > 60 * 5) break;
    // Sanity, every frame: bounds and leaks.
    if (!(boss.x >= 0 && boss.x <= 1300)) { S.errors.push("frame " + f + ": the boss left the arena (x " + boss.x + ")"); break; }
    if (sc.list("EnemyHitbox").length > 12) { S.errors.push("frame " + f + ": " + sc.list("EnemyHitbox").length + " hitboxes alive at once (a leak?)"); break; }
  }
  S.scene = sc; S.boss = boss; S.player = player; S.finalLives = num("Lives");
  return S;
}

// Run one of the boss's moves on its own (kit.force), with the player standing still at playerX and every hitbox that touches
// him counted. lives sets the phase. Returns what happened, or a problem if the move never ended.
function runMove(sceneName, bossName, sheetName, move, lives, playerX, opts) {
  opts = opts || {};
  const sceneJson = load().scenes.find(s => s.name === sceneName), sc = new Scene(sceneJson, sceneName);
  const boss = sc.spawn(bossName, opts.bossX || 1000, 657), bv = boss.vars;
  const player = sc.spawn("Player", playerX, 457);
  const fn = new Function("runtimeScene", "gdjs", bossScript(sheetName));
  const R = { frames: 0, ended: false, hitboxes: 0, shots: 0, touched: 0, maxDamage: 0, anims: boss.animLog, state: "", errors: [], minX: 1e9, maxX: -1e9, kit: null };
  bv.get("Lives").setNumber(lives);
  fn(sc, {}); // builds the kit (the first frame runs the intro)
  const kit = sc.__bossKit; R.kit = kit;
  if (!kit.force(move)) { R.errors.push("no move called " + move); return R; }
  const seen = new Set();
  for (let f = 0; f < 60 * 25; f++) {
    sc.time += 1 / 60; R.frames = f;
    for (const n of ["JustPostureBroken", "JustRecovered", "JustHitPlayer", "JustDodgedHit", "JustLostLife", "JustDied", "JustDeflected", "JustStaggered", "JustHitByPlayer"]) bv.get(n).setBoolean(false);
    try { fn(sc, {}); } catch (e) { R.errors.push("frame " + f + ": " + (e.stack || e).toString().split(String.fromCharCode(10)).slice(0, 3).join(" | ")); return R; }
    for (const h of sc.list("EnemyHitbox")) { if (!seen.has(h)) { seen.add(h); R.maxDamage = Math.max(R.maxDamage, h.vars.get("Damage").getAsNumber()); } if (!h.vars.get("HasHit").getAsBoolean() && h.x < player.x + 40 && h.x + h.w > player.x - 40 && h.y < player.y + 176 && h.y + h.h > player.y) { R.touched++; h.vars.get("HasHit").setBoolean(true); } }
    R.minX = Math.min(R.minX, boss.x); R.maxX = Math.max(R.maxX, boss.x);
    if (kit.script === null) { R.ended = true; break; }
  }
  for (let f = 0; f < (opts.after || 0) && R.ended; f++) { // keep going after the move (a trap goes off later)
    sc.time += 1 / 60;
    for (const n of ["JustPostureBroken", "JustRecovered", "JustHitPlayer", "JustDodgedHit", "JustLostLife", "JustDied", "JustDeflected", "JustStaggered", "JustHitByPlayer"]) bv.get(n).setBoolean(false);
    try { fn(sc, {}); } catch (e) { R.errors.push("after the move, frame " + f + ": " + String(e.stack || e).split(String.fromCharCode(10)).slice(0, 3).join(" | ")); return R; }
    for (const h of sc.list("EnemyHitbox")) if (!seen.has(h)) { seen.add(h); R.late = (R.late || 0) + 1; if (h.x < player.x + 40 && h.x + h.w > player.x - 40) R.touched++; }
  }
  R.hitboxes = Object.keys(sc.created).filter(n => /Hitbox$/.test(n)).reduce((n, k) => n + sc.created[k], 0); R.shots = Object.keys(sc.created).filter(n => !/Hitbox$/.test(n) && n !== bossName).reduce((n, k) => n + sc.created[k], 0);
  R.state = bv.get("AIState").getAsString(); R.scene = sc; R.boss = boss; R.player = player;
  return R;
}

module.exports = { runMove, simulate, Scene, Obj, Vars, bossScript };
