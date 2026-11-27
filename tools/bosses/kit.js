// Boss kit: the runtime both new bosses (the Cat and the Bladekeeper) are built on. tools/bosses/build.js joins this file, the
// boss's own script (cat.js, bladekeeper.js) and the generated animation table into one script event of that boss's sheet; the
// behaviour tests run the same text against stand-in objects.
//
// What it does, each frame (kit.step):
//   1. reads what Combat_Shared flagged (JustPostureBroken, JustRecovered, JustLostLife, JustDied, JustStaggered, JustDodgedHit),
//      and applies the "hold" rules the Leaf Ranger has: HP running out without a posture break first kneels the boss for
//      StunDuration with the deathblow orb up (DeathHold on the last life, LifeHold with a life to spare);
//   2. routes the flags to the boss's reactions (stunned, recover, lifeLost, died, dodge, stagger), which interrupt whatever
//      move was running;
//   3. runs the current move. A move is a generator: it `yield`s once per frame and uses kit.play / kit.wait / kit.glide /
//      kit.arc with `yield*`. When it ends the boss's director() picks the next one;
//   4. moves the boss's hitboxes and projectiles and removes the spent ones.
// The boss's animations are driven here, frame by frame (the sprite's own playback is paused), so a move knows exactly which
// frame a strike lands on and the animation can't drift out of step with its hitbox.
//
// Boss contract with Combat_Shared (see its header): the boss object is in the Enemy group with the usual variables (Health,
// Lives, Posture, ...), and everything that hurts the player is an EnemyHitbox object with Damage, HasHit and IsMelee.
function makeKit(scene, CFG, defineAI) {
  const one = n => { const a = scene.getObjects(n); return a && a.length ? a[0] : null; };
  const o = one(CFG.boss), V = o ? o.getVariables() : null;
  const k = { scene, CFG, o, t: 0, dt: 1 / 60, facing: 1, state: "Intro", script: null, air: false, anim: "", frame: 0, hits: [], shots: [], fx: [], wasDead: false };
  k.rand = (a, b) => a + Math.random() * (b - a);
  k.pick = list => list[Math.floor(Math.random() * list.length)];
  k.num = n => V.get(n).getAsNumber();
  k.set = (n, x) => V.get(n).setNumber(x);
  k.flag = n => V.get(n).getAsBoolean();
  k.setFlag = (n, b) => V.get(n).setBoolean(b);
  k.str = n => V.get(n).getAsString();
  k.player = () => one("Player");
  k.px = () => { const p = one("Player"); return p ? p.getCenterXInScene() : k.x; };
  k.pv = n => { const p = one("Player"); return p ? p.getVariables().get(n) : null; };
  k.pflag = n => { const v = k.pv(n); return !!v && v.getAsBoolean(); };
  Object.defineProperty(k, "x", { get: () => o.getX(), set: x => o.setX(Math.max(CFG.minX, Math.min(CFG.maxX, x))) });
  Object.defineProperty(k, "y", { get: () => o.getY(), set: y => o.setY(y) });
  k.dist = () => Math.abs(k.px() - k.x);
  k.dirToPlayer = () => (k.px() >= k.x ? 1 : -1);
  k.face = d => { if (d) { k.facing = d > 0 ? 1 : -1; o.flipX(k.facing < 0); } };
  k.facePlayer = () => k.face(k.dirToPlayer());
  k.setState = s => { k.state = s; V.get("AIState").setString(s); };
  k.invuln = b => k.setFlag("Invulnerable", !!b);
  k.sfx = (file, vol, pitch) => { if (file) scene.getGame().getSoundManager().playSound(file, false, vol === undefined ? 70 : vol, pitch || 1); };
  k.sfxPick = (list, vol) => k.sfx(k.pick(list), vol, 0.94 + Math.random() * 0.12);

  // ---- Animation ------------------------------------------------------------------------------------------------------
  // CFG.anims[name] = { n: frames, dt: seconds per frame (a number, or a list per frame), loop }.
  const A = n => { const a = CFG.anims[n]; if (!a) throw new Error("no animation " + n); return a; };
  k.frameTime = (n, f) => { const a = A(n); return Array.isArray(a.dt) ? a.dt[f] : a.dt; };
  k.duration = (n, from, to) => { const a = A(n); let s = 0; for (let f = from || 0; f <= (to === undefined ? a.n - 1 : to); f++) s += k.frameTime(n, f); return s; };
  k.show = (name, frame) => {
    A(name);
    if (k.anim !== name) { o.setAnimationName(name); k.anim = name; }
    k.frame = Math.max(0, Math.min(A(name).n - 1, frame | 0));
    o.setAnimationFrame(k.frame);
  };
  // Play an animation from frame `from` to `to`. opt.speed scales time; opt.on = { frame: fn } calls fn when that frame
  // is first shown; opt.loops plays a looping animation that many times; opt.until() ends it early.
  k.play = function* (name, opt) {
    opt = opt || {}; const a = A(name), speed = opt.speed || 1, from = opt.from || 0, to = opt.to === undefined ? a.n - 1 : opt.to;
    const loops = opt.loops || 1;
    for (let l = 0; l < loops; l++) for (let f = from; f <= to; f++) {
      k.show(name, f);
      if (opt.on && opt.on[f]) opt.on[f](f);
      if (opt.onEach) opt.onEach(f, l);
      let left = k.frameTime(name, f) / speed;
      if (f === to && l === loops - 1 && opt.noWaitLast) return;
      while (left > 0) { yield; left -= k.dt; if (opt.until && opt.until()) return; }
    }
  };
  k.wait = function* (s) { while (s > 0) { yield; s -= k.dt; } };
  // Hold one frame of an animation for s seconds.
  k.hold = function* (name, frame, s) { k.show(name, frame); yield* k.wait(s); };
  // Stand for s seconds with the idle animation PLAYING (a frozen pose between moves looked like a stuck animation).
  k.idleFor = function* (s, until) {
    const a = A("idle"); let f = 0, ft = 0;
    while (s > 0) { k.show("idle", f); yield; s -= k.dt; ft += k.dt; if (ft >= k.frameTime("idle", f)) { ft = 0; f = (f + 1) % a.n; } if (until && until()) return; }
  };
  // A reddish tint on the boss while it winds up (a tell); k.tint() puts the colour back.
  k.tint = c => { if (o.setColor) o.setColor(c || "255;255;255"); };
  // Move along the ground to x over dur seconds (eased); `during(u)` is called each frame with the progress 0 to 1 (to show a pose).
  k.glide = function* (toX, dur, ease, during) {
    const x0 = k.x; let t = 0;
    while (t < dur) { yield; t += k.dt; const u = Math.min(1, t / dur), e = ease === "out" ? 1 - (1 - u) * (1 - u) : ease === "in" ? u * u : ease === "inout" ? u * u * (3 - 2 * u) : u; k.x = x0 + (toX - x0) * e; if (during) during(u); }
    k.x = toX;
  };
  // A jump to x: a parabola `height` high over dur seconds. The feet leave and return to the floor at CFG.ground.
  k.arc = function* (toX, height, dur, during) {
    const x0 = k.x; let t = 0; k.air = true;
    while (t < dur) { yield; t += k.dt; const u = Math.min(1, t / dur); k.x = x0 + (toX - x0) * u; k.y = CFG.ground - 4 * height * u * (1 - u); if (during) during(u); }
    k.x = toX; k.y = CFG.ground; k.air = false;
  };
  // Walk toward x at speed px/s (animation looping), stopping within `stop` px of it or after `max` seconds.
  k.walkTo = function* (getTarget, speed, anim, stop, max, until) {
    let t = 0, f = 0, ft = 0;
    const a = A(anim);
    while (t < (max || 3)) {
      if (until && until()) return false;
      const tx = getTarget(), d = tx - k.x;
      if (Math.abs(d) <= stop) return true;
      k.face(d); k.x = k.x + Math.sign(d) * Math.min(Math.abs(d), speed * k.dt);
      ft += k.dt; if (ft >= k.frameTime(anim, f)) { ft = 0; f = (f + 1) % a.n; }
      k.show(anim, f); yield; t += k.dt;
    }
    return false;
  };

  // ---- Hitboxes and projectiles -----------------------------------------------------------------------------------------
  // A hitbox follows the boss: dx is how far in front of him (in facing terms) the box starts, dy from his feet (up is
  // negative). It lives for `life` seconds. Damage, HasHit and IsMelee are what Combat_Shared reads; kind, directional,
  // shared (one deflect stops every box of the same kind) and posture are the optional extras the Samurai and Leaf Ranger use.
  k.hitbox = function (s) {
    const h = scene.createObject(CFG.hitbox); if (!h) return null;
    const hv = h.getVariables();
    hv.get("Damage").setNumber(s.dmg); hv.get("HasHit").setBoolean(false); hv.get("IsMelee").setBoolean(s.melee !== false);
    if (hv.has("Directional")) hv.get("Directional").setNumber(s.directional === 0 ? 0 : 1);
    if (hv.has("SharedDeflect")) hv.get("SharedDeflect").setNumber(s.shared ? 1 : 0);
    if (hv.has("PostureScale")) hv.get("PostureScale").setNumber(s.posture === undefined ? 1 : s.posture);
    h.hide(true);
    const rec = { o: h, dx: s.dx, dy: s.dy, w: s.w, h: s.h, born: k.t, life: s.life, follow: s.follow !== false, fixedX: null };
    if (!rec.follow) rec.fixedX = s.x;
    rec.zone = s.zone || k.zoneOn(s, s.kind); if (rec.zone) rec.zone.hit = true;
    k.hits.push(rec); k.placeHit(rec); return rec;
  };
  // ---- Strike zones (CFG.zones): the area an attack is about to hit is drawn on the floor as a pulsing patch while the boss winds
  // up, and flashes bright while the hitbox is live. Red = claws and blades (deflect it), orange = the body or the ground (roll it).
  // A tell zone is made with k.zoneOn(spec, kind) and handed to k.hitbox as spec.zone, which turns it into the flash.
  k.zones = [];
  const zoneRoot = () => { try { return typeof PIXI !== "undefined" && PIXI.Graphics && scene.getLayer ? scene.getLayer("").getRenderer().getRendererObject() : null; } catch (e) { return null; } };
  k.placeZone = r => { r.g.x = r.fixedX !== null ? r.fixedX : (k.facing > 0 ? k.x + r.dx : k.x - r.dx - r.w); r.g.y = k.y + r.dy; };
  k.zoneOn = function (s, kind) {
    const root = CFG.zones ? zoneRoot() : null; if (!root) return null;
    const g = new PIXI.Graphics(), col = kind === "body" ? 0xff9a2a : 0xff3030;
    g.beginFill(col, 1); g.drawRect(0, 0, s.w, s.h); g.endFill(); g.alpha = 0.15; g.zIndex = 900000; root.addChild(g);
    const r = { g, dx: s.dx, dy: s.dy, w: s.w, h: s.h, fixedX: s.follow === false ? s.x : null, t: 0, hit: false };
    k.zones.push(r); k.placeZone(r); return r;
  };
  k.zoneOff = r => { if (!r) return; const i = k.zones.indexOf(r); if (i < 0) return; k.zones.splice(i, 1); if (r.g.destroy) r.g.destroy(); };
  k.clearZones = () => { for (const r of k.zones.slice()) k.zoneOff(r); };
  k.placeHit = r => {
    const left = r.fixedX !== null ? r.fixedX : (k.facing > 0 ? k.x + r.dx : k.x - r.dx - r.w);
    r.o.setPosition(left, k.y + r.dy); r.o.setWidth(r.w); r.o.setHeight(r.h);
  };
  k.dropHit = r => { const i = k.hits.indexOf(r); if (i >= 0) k.hits.splice(i, 1); k.zoneOff(r.zone); r.o.deleteFromScene(scene); };
  k.clearHits = () => { for (const r of k.hits.slice()) k.dropHit(r); };
  // A projectile: a hitbox object of its own, flying by vx, vy (+gravity) from (x, y) until it hits the floor, the player
  // or leaves the arena. anim names one of the projectile object's animations; onLand(shot) runs at the floor.
  k.shoot = function (s) {
    const p = scene.createObject(s.object || CFG.projectile); if (!p) return null;
    const pv = p.getVariables();
    pv.get("Damage").setNumber(s.dmg); pv.get("HasHit").setBoolean(false); pv.get("IsMelee").setBoolean(false);
    if (pv.has("Directional")) pv.get("Directional").setNumber(1);
    p.setPosition(s.x, s.y); if (s.anim) { p.setAnimationName(s.anim); p.setAnimationFrame(0); }
    if (s.scale) p.setScale(s.scale);
    if (s.flip) p.flipX(true);
    if (s.angle !== undefined) p.setAngle(s.angle);
    const rec = Object.assign({ o: p, vx: 0, vy: 0, g: 0, born: k.t, life: 6, landed: 0 }, s);
    k.shots.push(rec); return rec;
  };
  k.clearShots = () => { for (const r of k.shots.slice()) { r.o.deleteFromScene(scene); } k.shots.length = 0; };
  k.clearAll = () => { k.clearHits(); k.clearZones(); k.tint(); k.clearShots(); for (const f of k.fx.slice()) f.o.deleteFromScene(scene); k.fx.length = 0; };
  // A visual only object (a mound, a trap), kept so the kit can clean it up when the fight ends.
  k.spawnFx = (name, x, y) => { const f = scene.createObject(name); if (!f) return null; f.setPosition(x, y); const r = { o: f }; k.fx.push(r); return r; };
  k.dropFx = r => { const i = k.fx.indexOf(r); if (i < 0) return; k.fx.splice(i, 1); r.o.deleteFromScene(scene); };
  // A one-shot visual (a claw slash): the object's animation `anim` plays once, frame by frame from the kit's own clock, centred on
  // (x, y), mirrored for a boss facing left, drawn in front of the boss; then it removes itself. CFG.fx[object][anim] = { n, dt }.
  k.fxOnce = (name, anim, x, y, flip, scale) => {
    const info = CFG.fx && CFG.fx[name] && CFG.fx[name][anim]; if (!info) return null;
    const r = k.spawnFx(name, x, y); if (!r) return null;
    r.o.setAnimationName(anim); r.o.pauseAnimation(); r.o.setAnimationFrame(0);
    r.o.setPosition(x, y);                  // a sprite is placed by its ORIGIN point (the effect's own: its picture centre for a slash, the ground line for dust)
    if (scale && scale !== 1) r.o.setScale(scale);
    if (flip) r.o.flipX(true);
    if (r.o.setZOrder && o.getZOrder) r.o.setZOrder(o.getZOrder() + 1);
    r.once = { n: info.n, dt: info.dt, t: 0 }; return r;
  };
  // The world position [x, y] of one of the boss's points (Point2 in front of the cat, Point behind it) in its current frame. The engine
  // knows it (flip and scale included); a stand-in object without getPointX uses the default sheet position from CFG.points.
  k.point = name => {
    if (o.getPointX) return [o.getPointX(name), o.getPointY(name)];
    const p = (CFG.points && CFG.points[name]) || [CFG.cell / 2, CFG.cell], s = CFG.scale || 1;
    return [k.x + k.facing * (p[0] - CFG.cell / 2) * s, k.y + (p[1] - CFG.cell) * s];
  };
  k.tickFx = () => { for (const r of k.fx.slice()) if (r.once) { r.once.t += k.dt; const f = Math.floor(r.once.t / r.once.dt); if (f >= r.once.n) k.dropFx(r); else r.o.setAnimationFrame(f); } };

  // ---- The frame -------------------------------------------------------------------------------------------------------
  const AI = defineAI(k);
  k.AI = AI;
  // A move says how long until its strike (or until it lets a projectile go): Pistol parry reads it (the boss object's __strikeIn, seconds; -1 none).
  k.telegraph = s => { k.strikeAt = k.t + s; };
  k.interrupt = function (gen, state) {
    k.strikeAt = undefined;
    k.clearHits(); k.clearZones(); k.tint(); if (AI.cleanup) AI.cleanup();
    k.air = false; if (k.y !== CFG.ground) k.y = CFG.ground;
    k.script = gen; if (state) k.setState(state);
  };
  // Start one of the boss's moves now (debug keys, tests): it replaces whatever is running, and the director takes over after.
  k.force = function (name) {
    const m = AI.moves && AI.moves[name]; if (!m) return false;
    k.interrupt((function* () { yield* m(); })(), name); return true;
  };
  // Debug: while debugIdle is on (Numpad 0), a boss whose director honours it (the Cat and the Bladekeeper) stands in its idle and makes no move of its own; a debug
  // key still starts one move (k.force), and after it the boss goes back to idle. toggleDebugIdle also cancels the move it was in.
  k.debugIdle = false;
  k.toggleDebugIdle = function () {
    k.debugIdle = !k.debugIdle;
    if (k.debugIdle && ["Intro", "Curious", "Befriend", "Petting", "Dead", "Idle", "Stunned", "LifeLost", "Recover", "Dodge", "Stagger"].indexOf(k.state) < 0) k.interrupt((function* () { yield* k.idleFor(0.1); })(), "DebugIdle");
    return k.debugIdle;
  };
  // The end of a farewell (mercy): the boss and everything it made are removed, so the victory event in Combat_Shared fades back to the hub.
  k.finish = () => { k.finished = true; k.clearAll(); o.deleteFromScene(scene); };
  k.step = function () {
    if (!o || k.finished) return;
    k.dt = Math.min(0.05, scene.getElapsedTime() / 1000); k.t += k.dt;
    o.pauseAnimation();
    V.get("StateT") && V.get("StateT").setNumber(k.num("StateT") + k.dt);
    const gone = !one("Player") || k.pflag("IsDead");   // a dead player (the object stays in the scene while the death plays) counts as gone: the boss stands down
    const deathblow = k.pflag("IsDeathblow");
    const F = { broke: k.flag("JustPostureBroken"), recovered: k.flag("JustRecovered"), lost: k.flag("JustLostLife"), died: k.flag("JustDied"),
      dodged: k.flag("JustDodgedHit"), staggered: k.flag("JustStaggered"), hit: k.flag("JustHitByPlayer"), hitPlayer: k.flag("JustHitPlayer"), deflected: k.flag("JustDeflected") };
    // Holds. HP ran out on the last life with no posture break: kneel for StunDuration with the orb up, HP just above 0
    // so the life is not taken, until a deathblow lands or the time runs out (then HP 0 and the death follows).
    if (F.died && k.num("DeathHold") === 0 && !deathblow) {
      k.setFlag("JustDied", false); F.died = false; k.setFlag("JustLostLife", false); F.lost = false;
      k.set("Lives", 1); k.set("Health", 0.01); k.set("Posture", k.num("MaxPosture")); k.setFlag("IsPostureBroken", true);
      o.resetTimer("StunTimer"); k.setFlag("JustPostureBroken", true); F.broke = true; k.set("DeathHold", 1);
      k.sfx("assets/Sfx/posture_broken.mp3", 80);
    }
    if (k.num("DeathHold") === 1 && F.recovered && !deathblow) { k.setFlag("JustRecovered", false); F.recovered = false; k.set("Health", 0); k.set("DeathHold", 2); }
    // The same with a life to spare: he gets the life back and kneels at 0.01 HP, posture broken.
    if (F.lost && k.num("Lives") > 0 && k.num("LifeHold") === 0 && !deathblow) {
      k.setFlag("JustLostLife", false); F.lost = false; k.set("Lives", k.num("Lives") + 1); k.set("Health", 0.01);
      k.set("Posture", k.num("MaxPosture")); k.setFlag("IsPostureBroken", true); o.resetTimer("StunTimer");
      k.setFlag("JustPostureBroken", true); F.broke = true; k.set("LifeHold", 1); k.sfx("assets/Sfx/posture_broken.mp3", 80);
    }
    if (k.num("LifeHold") === 1 && F.recovered && !deathblow) { k.setFlag("JustRecovered", false); F.recovered = false; k.set("Health", 0); k.set("LifeHold", 2); }
    if (k.num("LifeHold") >= 1 && F.lost) k.set("LifeHold", 0);
    // A timed Pistol parry (Player.PistolParried) cuts off whatever was coming, even a move a flinch cannot stop.
    const word = k.pv("PistolParried"), parried = !!word && word.getAsNumber() === 1;
    if (parried) word.setNumber(0);
    // Reactions, most important first. Each replaces the running move.
    const dying = k.state === "Dead", wasStunned = k.state === "Stunned"; // a stunned boss is already down: its death or lost life carries on from there
    const spared = V.has("Spared") && k.num("Spared") === 1, inSpare = k.state === "Spared";   // mercy: Combat_Shared sets Spared when the player holds E at the last kneel
    if (spared) o.resetTimer("StunTimer");                                                     // a spared boss stays down: it never recovers into the fight
    if (!dying && !inSpare) {
      if (spared && AI.spared) { k.interrupt(AI.spared(), "Spared"); }
      else if (gone) { if (k.state !== "Idle") { k.clearShots(); k.interrupt(AI.idle(), "Idle"); } }
      else if (F.died) { k.interrupt(AI.died(k.num("DeathHold") >= 1 || wasStunned), "Dead"); }
      else if (k.num("Lives") <= 0) { k.interrupt(AI.died(false), "Dead"); }
      else if (F.lost && k.num("Lives") > 0) { k.interrupt(AI.lifeLost(wasStunned), "LifeLost"); }
      else if (F.broke) { k.invuln(false); k.interrupt(AI.stunned(), "Stunned"); }
      else if (F.recovered && k.state === "Stunned" && !F.lost && !F.died) { k.interrupt(AI.recover(), "Recover"); }
      else if (!F.broke && ((parried && !k.flag("Invulnerable") && ["Intro", "Stunned", "LifeLost", "Curious", "Befriend", "Petting"].indexOf(k.state) < 0) || (F.staggered && AI.canStagger && AI.canStagger(k.state)))) { k.interrupt(AI.stagger(), "Stagger"); }
      else if (F.dodged && AI.dodge) { k.interrupt(AI.dodge(), "Dodge"); }
      if (AI.watch && !gone && !dying) AI.watch(F);
    }
    // A kneeling boss during a hold can't be hurt by plain hits: only the deathblow (which sets HP directly) ends it.
    if ((k.num("DeathHold") === 1 || k.num("LifeHold") === 1) && k.flag("IsPostureBroken")) k.invuln(true);
    // Run the move.
    if (k.state !== "Dead" || k.script) {
      if (!k.script) k.script = k.state === "Idle" ? AI.idle() : AI.director();
      const r = k.script.next();
      if (r.done) k.script = null;
    }
    o.__strikeIn = k.strikeAt !== undefined && k.strikeAt >= k.t - 0.03 ? Math.max(0, k.strikeAt - k.t) : -1;
    // Hitboxes: follow the boss, expire.
    for (const r of k.hits.slice()) { if (k.t - r.born >= r.life) k.dropHit(r); else if (r.follow) k.placeHit(r); }
    for (const r of k.zones) { r.t += k.dt; r.g.alpha = r.hit ? 0.5 : 0.13 + 0.12 * Math.sin(r.t * 18); if (r.fixedX === null) k.placeZone(r); }
    // Projectiles.
    for (const r of k.shots.slice()) {
      const p = r.o;
      if (r.landed) { r.landed -= k.dt; if (r.landed <= 0) { p.deleteFromScene(scene); k.shots.splice(k.shots.indexOf(r), 1); } continue; }
      r.vy += (r.g || 0) * k.dt; p.setX(p.getX() + r.vx * k.dt); p.setY(p.getY() + r.vy * k.dt);
      if (r.angleFromV) p.setAngle(Math.atan2(r.vy, r.vx) * 180 / Math.PI);
      const hitIt = p.getVariables().get("HasHit").getAsBoolean();
      const out = p.getX() < -100 || p.getX() > 1400 || k.t - r.born > r.life;
      if (hitIt || out) { p.deleteFromScene(scene); k.shots.splice(k.shots.indexOf(r), 1); continue; }
      if (r.floor !== undefined && p.getY() >= r.floor) { p.setY(r.floor); if (r.onLand) r.onLand(r); r.landed = r.landLife || 0.4; r.vx = r.vy = 0; p.getVariables().get("HasHit").setBoolean(true); }
    }
    k.tickFx();
    if (AI.tick) AI.tick();
    // The enemy bars stay with him: Combat_Shared's fight UI lays them out; only their visibility is decided here.
  };
  if (o) k.setState("Intro");
  return k;
}
