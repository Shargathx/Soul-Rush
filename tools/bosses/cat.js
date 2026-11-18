// The Cat: a quick orange tabby with three lives. Its script, joined to tools/bosses/kit.js by tools/bosses/build.js.
// Everything tunable is a variable on the Cat object (listed in tools/bosses/cat.def.js), so a playtest can change it in the editor.
//
// Lives are its phases: with 3 left it stalks, swipes and pounces; with 2 it also digs under the floor and comes up beneath the
// player and spins a flurry of claws; with 1 it rears up for a heavy maul and its dashes come in threes. Each time a life goes
// (a deathblow, or its HP running out) it is knocked flat, and comes back from the ghost-cat halo with a hiss.
//
// How it fights fair: every attack has a held wind-up pose you can read, and every strike is a melee hitbox you can deflect
// (each deflect adds posture to it). The two things you can't deflect are the dash through you and the dig's eruption: roll them.
function catAI(k) {
  const lives = () => Math.round(k.num("Lives")), phase = () => 4 - Math.max(1, Math.min(3, lives())); // 1, 2, 3
  const byPhase = (a, b, c) => (phase() === 1 ? a : phase() === 2 ? b : c);
  const dmg = n => k.num(n);
  const BODY = { dx: -70, w: 140, dy: -100, h: 100 };   // the cat's body, for moves where the body is the weapon
  const cry = kind => { const l = k.CFG.sfx && k.CFG.sfx[kind]; if (l && l.length) k.sfxPick(l, kind === "hiss" ? 60 : 55); };
  const swish = () => k.sfxPick(["assets/Sfx/sword_swing_01.wav", "assets/Sfx/dashswoosh.mp3", "assets/Sfx/SwordSwing_1.wav"], 45);
  const bars = hide => { for (const n of ["Enemy_HP_Bar", "Enemy_Posture_Bar"]) for (const b of k.scene.getObjects(n)) b.hide(hide); };
  const mounds = [];
  let wantDodge = 0, dodgeCount = 0, dodgeEvery = 3, lastDodge = -99, rot = 0;

  // ---- Small pieces ---------------------------------------------------------------------------------------------------
  // Run to within `stop` px of the player (up to `max` s). The cat is fast: it is the player who has to read it.
  function* chase(stop, max) { yield* k.walkTo(k.px, k.num("RunSpeed") * byPhase(1, 1.1, 1.25), "run", stop, max); }
  // Stalking: a walk in the first life, a low crawl once it means it.
  function* prowl(max) { yield* k.walkTo(k.px, k.num("WalkSpeed") * byPhase(1, 0.85, 0.85), byPhase("walk", "crawl", "crawl"), 240, max); }
  const clampX = x => Math.max(k.CFG.minX, Math.min(k.CFG.maxX, x));
  const behind = () => (k.px() - k.x) * k.facing < 0;      // the player is behind the cat (it faces away from him)
  // A wind-up you can read: the cat flushes red, the area it is about to hit pulses on the floor (red: claws and kicks, deflect
  // them; orange: the body or the ground, roll them), and the pose is held for secs. Returns the zone, which the strike's hitbox adopts.
  function* windup(anim, frame, secs, spec, kind) {
    k.tint("255;150;140"); const z = spec ? k.zoneOn(spec, kind) : null;
    if (anim) k.show(anim, frame);
    yield* k.wait(secs); k.tint(); return z;
  }
  // One swipe: hold the wind-up pose (the telegraph), then the strike frames with a hitbox in front.
  function* swing(anim, windupT, low, reach, kind) {
    k.facePlayer();
    const spec = { dmg: dmg("SwipeDamage"), dx: 10, w: reach || 110, dy: low ? -62 : -118, h: low ? 62 : 112, life: 0.16 };
    const z = yield* windup(anim, 0, windupT, spec);
    swish();
    yield* k.play(anim, { from: 1, on: { 1: () => { k.hitbox(Object.assign({ zone: z }, spec)); if (kind) clawSlash(kind, spec); } } });
    yield* k.wait(0.04);
  }
  // The red claw streaks drawn over a swipe so it can be seen (tools/fx/cat_slash.js), centred on the swipe's hitbox, a little
  // longer than it. Kinds: Horizontal, Vertical, Diagonal, CrossX, CrossPlus (a combo mixes them).
  function clawSlash(kind, spec) { k.fxOnce("Cat_Slash", kind, k.x + k.facing * (spec.dx + 70), k.y + spec.dy + spec.h / 2, k.facing < 0); }
  // A cloud of dust where the cat lands from a leap (tools/fx/cat_dust.js): its bottom edge sits on the floor, centred under the cat.
  function landDust() { const d = k.CFG.fx.Cat_Dust.Puff; k.fxOnce("Cat_Dust", "Puff", k.x, k.CFG.ground + 14 - d.h / 2, false); }
  // Get a step closer between swipes so a combo keeps its reach.
  function* lungeStep(px) { const to = k.x + k.facing * px; yield* k.glide(to, 0.1, "out"); }

  // ---- Moves ---------------------------------------------------------------------------------------------------------
  // Swipes: a combo of 2 or 3 claws, the last one slower. A is high-high, B is low-low, C ends in the spinning double sweep.
  function* swipes(kind) {
    if (kind === "B") { yield* hindKick(); return; }
    k.setState("Swipe");
    yield* chase(120, 1.8);
    if (k.dist() > 260) return;
    const w = byPhase(0.4, 0.32, 0.24);
    const combos = { A: ["atk1", "atk2"], C: ["atk1", "atk2", "atk5"] };
    const slashes = { A: ["Horizontal", "Diagonal"], C: ["CrossX", "CrossPlus"] };   // C is the crossed pair, to compare (Vertical is made but not used right now)   // the claw streaks drawn over each swipe (the spin has none yet)
    const list = combos[kind];
    for (let i = 0; i < list.length; i++) {
      const a = list[i], last = i === list.length - 1 && list.length > 2;
      if (a === "atk5") { // The spin: claws out on both sides at once, so it is deflected like any other swing but cannot be dodged by stepping behind.
        k.facePlayer();
        const spec = { dmg: dmg("SwipeDamage") + 4, dx: -110, w: 220, dy: -118, h: 112, life: 0.2, directional: 0 };
        const z = yield* windup("atk5", 0, w + 0.12, spec); swish();
        yield* k.play("atk5", { from: 1, on: { 1: () => k.hitbox(Object.assign({ zone: z }, spec)) } });
      } else yield* swing(a, i ? w * 0.7 : w, a === "atk3" || a === "atk4", 118, slashes[kind][i]);
      if (i < list.length - 1) yield* lungeStep(34);
    }
    yield* k.idleFor(k.rand(0.35, 0.6));
  }
  // Hind kick (the B swipes): the cat can only kick what is BEHIND it. With the player in front it first crouches and leaps over him,
  // landing past him and facing away; then it holds the back-turned pose (the zone behind it pulses) and kicks, twice if he is still there.
  function* hindKick() {
    k.setState("Swipe");
    if (!behind()) yield* chase(190, 1.8);                    // (already facing away from him: no turning round to run at him)
    if (k.dist() > 330) return;
    if (!behind()) {
      k.facePlayer();
      yield* windup("pounce", 0, 0.3);                       // the crouch: it is about to jump over you
      const land = clampX(k.px() + k.facing * 190);
      cry("meow");
      yield* k.arc(land, 160, 0.42, u => k.show("pounce", 2 + Math.min(3, Math.floor(u * 4))));
      yield* k.hold("pounce", 6, 0.1);
    }
    const w = byPhase(0.42, 0.34, 0.26);
    for (let i = 0; i < 2; i++) {
      if (!behind()) break;                                  // he got round to the front: nothing to kick
      const anim = i ? "atk4" : "atk3", spec = { dmg: dmg("SwipeDamage") + 2, dx: -125, w: 100, dy: -95, h: 80, life: 0.18 };
      const z = yield* windup(anim, 0, i ? w * 0.7 : w, spec); swish();
      yield* k.play(anim, { from: 1, on: { 2: () => k.hitbox(Object.assign({ zone: z }, spec)) } });
      yield* k.wait(0.04);
    }
    yield* k.idleFor(k.rand(0.35, 0.6));
  }
  // Pounce: creep toward the player (telegraph), crouch, then a leap that lands where the player stood. The cat is the weapon.
  function* pounce(times) {
    k.setState("Pounce");
    for (let n = 0; n < (times || 1); n++) {
      k.facePlayer();
      let t = 0; const creepTime = n ? 0.3 : byPhase(0.7, 0.55, 0.4), f = { i: 0, t: 0 };
      while (t < creepTime) { // creeping: slinks toward the player, the tail low. The longer it creeps the nearer it comes.
        yield; t += k.dt; f.t += k.dt; if (f.t >= 0.12) { f.t = 0; f.i = (f.i + 1) % 4; }
        k.facePlayer(); if (Math.abs(k.px() - k.x) > 220) k.x = k.x + k.facing * 130 * k.dt; k.show("creep", f.i);
      }
      const target = clampX(k.px() + k.facing * -20), dur = 0.5;   // fixed when the crouch starts: the zone shows where it will land
      const land = k.zoneOn({ dx: 0, w: 140, dy: -100, h: 100, follow: false, x: target - 70 }, "body");
      k.tint("255;150;140"); yield* k.hold("pounce", 0, 0.14); yield* k.hold("pounce", 1, byPhase(0.3, 0.25, 0.2)); k.tint(); // the crouch: nothing moves for a moment
      cry("meow"); swish();
      const box = k.hitbox(Object.assign({ dmg: dmg("PounceDamage"), life: dur + 0.1, kind: "body" }, BODY));
      yield* k.arc(target, 190, dur, u => k.show("pounce", 2 + Math.min(3, Math.floor(u * 4))));
      k.zoneOff(land); landDust();
      yield* k.hold("pounce", 6, 0.12); k.dropHit(box);
      yield* k.hold("pounce", 7, byPhase(0.7, 0.55, 0.4)); // landed: a gap to punish
    }
  }
  // The zoomies: a play bow (rear up, tail high: the tell), then a sprint through the player to the far wall and a skid.
  // The body is the weapon, so it is best rolled through (a deflect timed at contact still works). In the last life it turns and comes back.
  function* zoomies() {
    k.setState("Zoomies");
    k.facePlayer();
    {
      const far0 = k.dirToPlayer() > 0 ? k.CFG.maxX : k.CFG.minX;   // the lane it will run down pulses while it plays the bow
      const lane = k.zoneOn({ dx: 0, w: Math.abs(far0 - k.x), dy: -100, h: 100, follow: false, x: Math.min(k.x, far0) }, "body");
      k.tint("255;150;140"); yield* k.play("bowPlay", { speed: byPhase(1, 1.15, 1.3) }); k.tint(); k.zoneOff(lane);
    }
    const passes = byPhase(1, 1, 2);
    for (let n = 0; n < passes; n++) {
      k.facePlayer(); const dir = k.facing, far = dir > 0 ? k.CFG.maxX : k.CFG.minX; cry("meow");
      const box = k.hitbox(Object.assign({ dmg: dmg("DashDamage"), life: 2, kind: "body" }, BODY));
      let f = 0, ft = 0;
      while ((far - k.x) * dir > 0) {
        yield; k.x = k.x + dir * k.num("DashSpeed") * k.dt; ft += k.dt; if (ft >= 0.06) { ft = 0; f = (f + 1) % 5; } k.show("dash", f);
      }
      k.dropHit(box);
      k.face(-dir); yield* k.play("stop", { speed: 1.2 });
      if (n < passes - 1) yield* k.idleFor(0.25);
    }
    yield* k.idleFor(byPhase(0.8, 0.6, 0.5));
  }
  // Dig: the cat paws a hole and vanishes; a mound creeps under the player and, after a beat that shows it stopping, the cat
  // erupts from it straight up. Roll out from over the mound (a deflect at the eruption works too). (Life 2 and 1.)
  function* burrow() {
    k.setState("Burrow");
    k.facePlayer(); yield* k.play("dig", { speed: 1 });
    k.invuln(true); k.o.hide(true);
    const m = k.spawnFx("Cat_Mound", k.x, k.CFG.ground); if (m) { mounds.push(m); m.o.setAnimationName("Rise"); m.o.setAnimationFrame(0); m.o.pauseAnimation(); }
    let x = k.x, t = 0, boom = null; const follow = byPhase(1.5, 1.4, 1.1), freeze = 0.55;
    while (t < follow + freeze) {
      yield; t += k.dt; const going = t < follow;
      if (!going && !boom) boom = k.zoneOn({ dx: 0, w: 130, dy: -290, h: 290, follow: false, x: x - 65 }, "body"); // it has stopped: this is where it comes up
      if (going) { const d = k.px() - x; x += Math.sign(d) * Math.min(Math.abs(d), k.num("MoundSpeed") * k.dt); }
      if (m) { m.o.setPosition(x, k.CFG.ground); const shake = going ? 0 : Math.sin(t * 90) * 3; m.o.setX(x + shake); m.o.setAnimationFrame(going ? (Math.floor(t * 8) % 2) : 2 + (Math.floor(t * 20) % 2)); }
    }
    k.x = x; k.o.hide(false); k.invuln(false); k.face(k.dirToPlayer());
    if (m) { mounds.splice(mounds.indexOf(m), 1); k.dropFx(m); }
    cry("hiss");
    k.hitbox({ dmg: dmg("BurrowDamage"), dx: 0, w: 130, dy: -290, h: 290, life: 0.32, follow: false, x: k.x - 65, directional: 0, kind: "body", zone: boom });
    // Straight up and straight down: jumpUp 0 to 2, then jumpDown 1 to 3 (jumpDown 0 is a flat, stretched pose that flashed between the two).
    yield* k.arc(k.x, 230, 0.55, u => k.show(u < 0.5 ? "jumpUp" : "jumpDown", u < 0.5 ? Math.min(2, Math.floor(u * 6)) : 1 + Math.min(2, Math.floor((u - 0.5) * 6))));
    yield* k.hold("jumpDown", 3, byPhase(0.8, 0.7, 0.6));
  }
  // Claw flurry: rears up, then three spinning swipes on both sides. One deflect stops all of them (shared).
  function* flurry() {
    k.setState("Flurry"); k.facePlayer();
    yield* chase(150, 1.4);
    const fspec = { dmg: dmg("ScratchDamage"), dx: -140, w: 280, dy: -190, h: 190, life: 0.2, directional: 0, shared: true };
    k.tint("255;150;140"); const fz = k.zoneOn(fspec);
    yield* k.play("rear", { to: 4, speed: 0.8 });      // rising on the hind legs
    yield* k.hold("rear", 5, 0.25); k.tint();
    cry("hiss");
    for (let n = 0; n < 3; n++) {
      swish();
      k.hitbox(Object.assign({}, fspec, n === 0 ? { zone: fz } : {}));
      yield* k.play("scratch", { speed: 1.1, to: 3 });
    }
    yield* k.play("rear", { from: 11, to: 15, speed: 1 }); // dropping back down
    yield* k.idleFor(0.5);
  }
  // Maul (last life): rises high on its hind legs, roaring (a long, readable tell), then slams down in front of it.
  function* maul() {
    k.setState("Maul"); k.facePlayer();
    yield* chase(160, 1.4);
    cry("hiss");
    const mspec = { dmg: dmg("MaulDamage"), dx: 0, w: 250, dy: -210, h: 210, life: 0.22 };
    k.tint("255;150;140"); const mz = k.zoneOn(mspec);
    yield* k.play("rear", { to: 7, speed: 0.55 });     // up, up, up
    yield* k.wait(0.15); k.tint();
    swish(); cry("meow");
    k.hitbox(Object.assign({ zone: mz }, mspec));
    yield* k.play("rear", { from: 8, to: 12, speed: 1.1 });
    yield* k.hold("rear", 13, byPhase(1, 1, 0.9));      // the slam leaves it open
    yield* k.play("rear", { from: 14, to: 15 });
  }
  // A hiss that shakes the player's timing: the fur goes up and the cat waits a random beat before the next move.
  function* hissFeint() { k.setState("Hiss"); k.facePlayer(); cry("hiss"); yield* k.play("aggress"); yield* k.wait(k.rand(0.1, 0.45)); }

  // ---- Reactions ------------------------------------------------------------------------------------------------------
  // Back-flip away from a swing it dodged (a free, safe hop; the player's swing hit nothing).
  function* dodge() {
    k.invuln(true); k.setFlag("WillDodgeHit", false); lastDodge = k.t; k.facePlayer();
    const to = Math.max(k.CFG.minX, Math.min(k.CFG.maxX, k.x - k.facing * 300));
    yield* k.arc(to, 150, 0.45, u => k.show(u < 0.5 ? "jumpUp" : "jumpDown", Math.min(3, Math.floor((u < 0.5 ? u * 2 : (u - 0.5) * 2) * 4))));
    k.invuln(false); yield* k.idleFor(0.25);
  }
  function* stagger() { k.clearHits(); yield* k.play("hurt"); yield* k.wait(0.15); }
  // Stunned: it sits down heavily, lies down, and dozes: the loaf, then asleep, over and over until it wakes.
  function* stunned() {
    k.invuln(false);
    for (const m of mounds.splice(0)) k.dropFx(m); k.o.hide(false);
    yield* k.play("sitDown"); yield* k.play("rest_in");
    while (true) { yield* k.play("rest"); yield* k.play("dream"); }
  }
  function* recover() { yield* k.play("sitUp"); yield* k.idleFor(0.25); }
  // A life is gone: knocked flat, a beat on the floor, then back from the ghost halo somewhere else, with a hiss.
  function* lifeLost(wasDown) {
    k.invuln(true); k.clearShots(); k.set("Posture", 0); k.setFlag("IsPostureBroken", false);
    k.o.hide(false); cry("meow");
    if (wasDown) k.show("death", 4); else yield* k.play("death", { to: 4 }); // already flat if it was stunned
    yield* k.wait(0.7);
    const side = k.px() < 640 ? k.CFG.maxX - 130 : k.CFG.minX + 130;
    k.x = side; k.facePlayer();
    yield* k.play("spawn", { speed: 0.9 });
    yield* k.play("sit", { to: 3 });                          // a smug wash after the comeback
    yield* k.play("aggress"); cry("hiss");
    k.invuln(false); dodgeEvery = 3; dodgeCount = 0;
    yield* k.wait(0.4);
  }
  function* died(held) {
    k.invuln(true); k.clearShots(); bars(true); k.o.hide(false);
    for (const m of mounds) k.dropFx(m);
    cry("meow");
    yield* k.play("death", { from: held ? 4 : 0 });
    while (true) { k.show("death", 11); yield; }
  }
  function* idle() { k.clearHits(); k.face(k.facing); while (true) { yield* k.play("idle"); } }
  // The opening, and the hidden ending. The cat hisses, then walks toward the player. Nothing can hurt it yet. If the player never
  // attacks, it sits down in front of him and a prompt (F) comes up: F kneels him to pet it, the fight ends in peace, and the cat joins
  // him (BossesBeaten.Cat_Friend, which the hub reads to put the cat in the hall). The first swing, lunge or hit on it turns it hostile for
  // good: it hisses again and the fight begins.
  let provokedYet = false, prompt = null, hearts = [];
  const provoked = () => provokedYet || (provokedYet = k.pflag("AttackPressed") || k.pflag("IsAttacking") || k.pflag("IsLunging") || k.flag("JustHitByPlayer") || k.num("Health") < k.num("MaxHealth"));
  const layer = () => (k.scene.getLayer ? k.scene.getLayer("").getRenderer().getRendererObject() : null);
  function showPrompt(on) {
    if (typeof PIXI === "undefined" || !layer()) return;
    if (on && !prompt) {
      const c = new PIXI.Container(), g = new PIXI.Graphics();
      g.beginFill(0x000000, 0.65); g.drawRoundedRect(-17, -17, 34, 34, 7); g.endFill(); g.lineStyle(2, 0xd9c27a, 1); g.drawRoundedRect(-17, -17, 34, 34, 7);
      const t = new PIXI.Text("F", { fontFamily: "Georgia, serif", fontSize: 22, fill: 0xffffff }); if (t.anchor) t.anchor.set(0.5);
      c.addChild(g); c.addChild(t); c.zIndex = 1000000; layer().addChild(c); prompt = c;
    }
    if (prompt) { prompt.visible = !!on; if (on) { prompt.x = k.x; prompt.y = k.CFG.ground - 250 + Math.sin(k.t * 4) * 4; } }
  }
  function floatHeart() {
    if (typeof PIXI === "undefined" || !layer()) return;
    // Hearts rise from the space BETWEEN the knight and the cat, at the height of his hand, in a few sizes.
    const h = new PIXI.Graphics(), sc = k.rand(0.9, 1.7); h.beginFill(k.pick([0xe0485c, 0xff6f86, 0xf2899b]), 1); h.drawCircle(-4, -3, 5); h.drawCircle(4, -3, 5); h.drawPolygon([-9, -1, 9, -1, 0, 10]); h.endFill();
    if (h.scale && h.scale.set) h.scale.set(sc);
    h.x = (k.x + k.px()) / 2 + k.rand(-22, 22); h.y = k.CFG.ground - 100 + k.rand(-15, 15); h.zIndex = 1000001; layer().addChild(h); hearts.push({ g: h, t: 0, dx: k.rand(-14, 14), ph: k.rand(0, 6.28) });
  }
  function tickHearts() { for (const h of hearts.slice()) { h.t += k.dt; h.g.y -= 60 * k.dt; h.g.x += h.dx * k.dt + Math.sin(h.t * 5 + h.ph) * 0.6; h.g.alpha = Math.max(0, 1 - h.t / 1.6); if (h.t > 1.6) { h.g.destroy(); hearts.splice(hearts.indexOf(h), 1); } } }
  function tidyUi() { showPrompt(false); for (const h of hearts.splice(0)) h.g.destroy(); if (prompt) { prompt.destroy(); prompt = null; } }
  function* angry() { showPrompt(false); k.facePlayer(); cry("hiss"); yield* k.play("aggress"); k.invuln(false); }
  function* petting() {
    showPrompt(false); k.setState("Petting");
    const P = k.player(), pv = P.getVariables();
    for (const n of ["IsAttacking", "IsDeflecting", "IsRolling", "IsLunging", "AllowCombo"]) pv.get(n).setBoolean(false);
    pv.get("ControlsLocked").setBoolean(true); pv.get("Iframe").setBoolean(true);
    const dir = k.x >= k.px() ? 1 : -1; P.flipX(dir < 0); k.face(-dir);
    const setAnim = n => { if (P.getAnimationName() !== n) { P.setAnimationName(n); P.setAnimationFrame(0); P.playAnimation(); } };
    // The cat is drawn IN FRONT of the knight from here on: his reaching arm is behind its body, which hides the rough parts.
    if (k.o.setZOrder && P.getZOrder) k.o.setZOrder(P.getZOrder() + 1);
    // Step up to the cat (close: the reaching hand ends inside the cat's outline), then kneel.
    let t = 0; while (Math.abs(k.px() - k.x) > 96 && t < 2) { yield; t += k.dt; setAnim("Player_Run"); P.setX(P.getX() + dir * 330 * k.dt); }
    setAnim("Player_Pet");
    // He kneels (3 frames, then holds) while the cat lies down in front of him; only then does the arm come out.
    t = 0; let f = 0, ft = 0; const lie = k.CFG.anims.rest_in.n;
    while (f < lie) { yield; t += k.dt; ft += k.dt; setAnim("Player_Pet"); k.show("rest_in", f); if (ft >= k.frameTime("rest_in", f)) { ft = 0; f++; } }
    t = 0; while (t < 0.4) { yield; t += k.dt; setAnim("Player_Pet"); k.show("rest_in", lie - 1); }
    t = 0; let beat = 0;
    while (t < 3.2) { yield; t += k.dt; setAnim("Player_PetStroke"); const nm = t < 1.6 ? "rest" : "dream"; k.show(nm, Math.floor(t * 7) % k.CFG.anims[nm].n); if (t > 0.5) { beat += k.dt; if (beat > 0.3) { beat = 0; floatHeart(); } } tickHearts(); }
    // Fade to black, then the hub: the fight counts as won, and the cat is a friend.
    let fade = 0, overlay = null;
    if (typeof PIXI !== "undefined" && layer()) { overlay = new PIXI.Graphics(); overlay.beginFill(0x000000, 1); overlay.drawRect(-100, -100, 1500, 900); overlay.endFill(); overlay.zIndex = 2000000; overlay.alpha = 0; layer().addChild(overlay); }
    while (fade < 1.2) { yield; fade += k.dt; tickHearts(); if (overlay) overlay.alpha = Math.min(1, fade / 1.2); }
    const g = k.scene.getGame().getVariables(), bb = g.get("BossesBeaten");
    bb.getChild("Cat_Fight").setBoolean(true); bb.getChild("Cat_Friend").setBoolean(true); g.get("JustBeaten").setString("Cat_Fight");
    tidyUi();
    if (typeof gdjs !== "undefined" && gdjs.evtTools && gdjs.evtTools.runtimeScene) gdjs.evtTools.runtimeScene.replaceScene(k.scene, "HUB_Area", false);
    k.friend = true;
    while (true) yield;
  }
  function* intro() {
    k.invuln(true); k.facePlayer(); k.setState("Intro");
    yield* k.idleFor(1.5, provoked);                                                  // breathing room: it stands there, tail twitching
    if (!provoked()) { cry("hiss"); yield* k.play("aggress", { until: provoked }); }  // then it hisses at you...
    while (true) {
      if (provoked()) { yield* angry(); return; }
      if (k.dist() > 230) { // ...and RUNS over, to bait an attack
        k.setState("Curious"); showPrompt(false);
        const came = yield* k.walkTo(k.px, k.num("RunSpeed"), "run", 170, 4, provoked);
        if (came && !provoked()) yield* k.play("stop", { speed: 1.2 });              // a skid, then it sits
        continue;
      }
      k.setState("Befriend"); k.facePlayer(); showPrompt(true);
      const input = typeof gdjs !== "undefined" && gdjs.evtTools && gdjs.evtTools.input;
      let f = 0, ft = 0;                                                                // sitting in front of you, the tail wagging; F is read every frame
      while (!provoked() && k.dist() <= 260) {
        yield; ft += k.dt; if (ft >= 0.14) { ft = 0; f = (f + 1) % 8; } k.show("sit", f); k.facePlayer();
        if (input && input.wasKeyJustPressed(k.scene, "f")) { yield* petting(); return; }
      }
    }
  }

  // ---- The director ----------------------------------------------------------------------------------------------------
  // A fixed rotation per life, with the player's distance deciding the opening when he stands right on it.
  const ROT = { 1: ["prowl", "A", "pounce", "B", "zoom", "pounce"], 2: ["A", "burrow", "pounce", "flurry", "B", "zoom", "C"], 3: ["C", "maul", "zoom", "burrow", "pounce", "flurry", "maul", "C"] };
  function* director() {
    if (k.state === "Intro") { k.setState("Intro"); yield* intro(); }
    k.setState("Neutral"); k.facePlayer();
    yield* k.idleFor(byPhase(0.35, 0.22, 0.12));
    const list = ROT[phase()]; let pick = list[rot++ % list.length];
    if (k.dist() < 150 && pick === "prowl") pick = "A"; // crowded: claw first
    if (pick === "prowl") { k.setState("Stalk"); yield* prowl(1.6); pick = k.dist() < 300 ? "A" : "pounce"; }
    k.setFlag("WillDodgeHit", false);
    if (phase() >= 2 && (pick === "pounce" || pick === "B") && Math.random() < 0.4) yield* hissFeint();
    if (pick === "A" || pick === "B" || pick === "C") yield* swipes(pick);
    else if (pick === "pounce") yield* pounce(phase() === 3 ? 2 : 1);
    else if (pick === "zoom") yield* zoomies();
    else if (pick === "burrow") yield* burrow();
    else if (pick === "flurry") yield* flurry();
    else if (pick === "maul") yield* maul();
    yield* k.idleFor(byPhase(0.55, 0.35, 0.2));
  }

  // Every move by name, for the debug keys and the tests (kit.force).
  const moves = { swipeA: () => swipes("A"), swipeB: hindKick, swipeC: () => swipes("C"), pounce: () => pounce(phase() === 3 ? 2 : 1), zoom: zoomies, burrow, flurry, maul, hiss: hissFeint, dodge, stagger, lifeLost };
  return {
    director, idle, died, lifeLost, stunned, recover, stagger, dodge, moves, peaceful: () => !provokedYet,
    canStagger: s => ["Neutral", "Stalk", "Swipe", "Hiss"].indexOf(s) >= 0,
    cleanup() { for (const m of mounds.splice(0)) k.dropFx(m); k.o.hide(false); k.o.setOpacity && k.o.setOpacity(255); tidyUi(); },
    tick() { if (k.state === "Befriend") { showPrompt(k.dist() <= 260 && !provokedYet); } tickHearts(); },
    // Dodge decision, the Leaf Ranger's way: every DodgeEvery-th swing near it (2 to 4, re-rolled after each dodge) is dodged,
    // so a player can't count it out. The dodge itself happens when Combat_Shared flags that swing as dodged.
    watch() {
      if (!provokedYet) provoked();                       // latched every frame: a swing is only flagged for one
      if (k.pflag("AttackPressed") && k.dist() < 230 && (k.state === "Neutral" || k.state === "Stalk") && !k.flag("WillDodgeHit") && !k.flag("Invulnerable") && k.t - lastDodge >= k.num("DodgeCooldown")) {
        dodgeCount++;
        if (dodgeCount >= dodgeEvery) { k.setFlag("WillDodgeHit", true); dodgeCount = 0; dodgeEvery = Math.floor(k.rand(2, 5)); wantDodge = k.t; }
      }
      if (k.flag("WillDodgeHit") && k.t - wantDodge > 1.2 && k.state !== "Dodge") k.setFlag("WillDodgeHit", false);
    }
  };
}
