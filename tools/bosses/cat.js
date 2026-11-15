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
  // One swipe: hold the wind-up pose (the telegraph), then the strike frames with a hitbox in front.
  function* swing(anim, windup, low, reach) {
    k.facePlayer(); yield* k.hold(anim, 0, windup);
    swish();
    const dy = low ? -62 : -118, h = low ? 62 : 112;
    yield* k.play(anim, { from: 1, on: { 1: () => k.hitbox({ dmg: dmg("SwipeDamage"), dx: 10, w: reach || 110, dy, h, life: 0.16 }) } });
    yield* k.wait(0.04);
  }
  // Get a step closer between swipes so a combo keeps its reach.
  function* lungeStep(px) { const to = k.x + k.facing * px; yield* k.glide(to, 0.1, "out"); }

  // ---- Moves ---------------------------------------------------------------------------------------------------------
  // Swipes: a combo of 2 or 3 claws, the last one slower. A is high-high, B is low-low, C ends in the spinning double sweep.
  function* swipes(kind) {
    k.setState("Swipe");
    yield* chase(120, 1.8);
    if (k.dist() > 260) return;
    const w = byPhase(0.4, 0.32, 0.24);
    const combos = { A: ["atk1", "atk2"], B: ["atk3", "atk4"], C: ["atk1", "atk2", "atk5"] };
    const list = combos[kind];
    for (let i = 0; i < list.length; i++) {
      const a = list[i], last = i === list.length - 1 && list.length > 2;
      if (a === "atk5") { // The spin: claws out on both sides at once, so it is deflected like any other swing but cannot be dodged by stepping behind.
        k.facePlayer(); yield* k.hold("atk5", 0, w + 0.12); swish();
        yield* k.play("atk5", { from: 1, on: { 1: () => k.hitbox({ dmg: dmg("SwipeDamage") + 4, dx: -110, w: 220, dy: -118, h: 112, life: 0.2, directional: 0 }) } });
      } else yield* swing(a, i ? w * 0.7 : w, a === "atk3" || a === "atk4", 118);
      if (i < list.length - 1) yield* lungeStep(34);
    }
    yield* k.hold("idle", 0, k.rand(0.35, 0.6));
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
      yield* k.hold("pounce", 0, 0.14); yield* k.hold("pounce", 1, byPhase(0.3, 0.25, 0.2)); // the crouch: nothing moves for a moment
      const target = Math.max(k.CFG.minX, Math.min(k.CFG.maxX, k.px() + k.facing * -20)), dur = 0.5;
      cry("meow"); swish();
      const box = k.hitbox(Object.assign({ dmg: dmg("PounceDamage"), life: dur + 0.1 }, BODY));
      yield* k.arc(target, 190, dur, u => k.show("pounce", 2 + Math.min(3, Math.floor(u * 4))));
      yield* k.hold("pounce", 6, 0.12); k.dropHit(box);
      yield* k.hold("pounce", 7, byPhase(0.7, 0.55, 0.4)); // landed: a gap to punish
    }
  }
  // The zoomies: a play bow (rear up, tail high: the tell), then a sprint through the player to the far wall and a skid.
  // The body is the weapon, so it is best rolled through (a deflect timed at contact still works). In the last life it turns and comes back.
  function* zoomies() {
    k.setState("Zoomies");
    k.facePlayer();
    yield* k.play("bowPlay", { speed: byPhase(1, 1.15, 1.3) });
    const passes = byPhase(1, 1, 2);
    for (let n = 0; n < passes; n++) {
      k.facePlayer(); const dir = k.facing, far = dir > 0 ? k.CFG.maxX : k.CFG.minX; cry("meow");
      const box = k.hitbox(Object.assign({ dmg: dmg("DashDamage"), life: 2 }, BODY));
      let f = 0, ft = 0;
      while ((far - k.x) * dir > 0) {
        yield; k.x = k.x + dir * k.num("DashSpeed") * k.dt; ft += k.dt; if (ft >= 0.06) { ft = 0; f = (f + 1) % 5; } k.show("dash", f);
      }
      k.dropHit(box);
      k.face(-dir); yield* k.play("stop", { speed: 1.2 });
      if (n < passes - 1) yield* k.hold("idle", 0, 0.25);
    }
    yield* k.hold("idle", 0, byPhase(0.8, 0.6, 0.5));
  }
  // Dig: the cat paws a hole and vanishes; a mound creeps under the player and, after a beat that shows it stopping, the cat
  // erupts from it straight up. Roll out from over the mound (a deflect at the eruption works too). (Life 2 and 1.)
  function* burrow() {
    k.setState("Burrow");
    k.facePlayer(); yield* k.play("dig", { speed: 1 });
    k.invuln(true); k.o.hide(true);
    const m = k.spawnFx("Cat_Mound", k.x, k.CFG.ground); if (m) { mounds.push(m); m.o.setAnimationName("Rise"); m.o.setAnimationFrame(0); m.o.pauseAnimation(); }
    let x = k.x, t = 0; const follow = byPhase(1.5, 1.4, 1.1), freeze = 0.55;
    while (t < follow + freeze) {
      yield; t += k.dt; const going = t < follow;
      if (going) { const d = k.px() - x; x += Math.sign(d) * Math.min(Math.abs(d), k.num("MoundSpeed") * k.dt); }
      if (m) { m.o.setPosition(x, k.CFG.ground); const shake = going ? 0 : Math.sin(t * 90) * 3; m.o.setX(x + shake); m.o.setAnimationFrame(going ? (Math.floor(t * 8) % 2) : 2 + (Math.floor(t * 20) % 2)); }
    }
    k.x = x; k.o.hide(false); k.invuln(false); k.face(k.dirToPlayer());
    if (m) { mounds.splice(mounds.indexOf(m), 1); k.dropFx(m); }
    cry("hiss");
    k.hitbox({ dmg: dmg("BurrowDamage"), dx: 0, w: 130, dy: -290, h: 290, life: 0.32, follow: false, x: k.x - 65, directional: 0 });
    yield* k.arc(k.x, 230, 0.55, u => k.show(u < 0.5 ? "jumpUp" : "jumpDown", Math.min(3, Math.floor((u < 0.5 ? u * 2 : (u - 0.5) * 2) * 4))));
    yield* k.hold("jumpDown", 3, byPhase(0.8, 0.7, 0.6));
  }
  // Claw flurry: rears up, then three spinning swipes on both sides. One deflect stops all of them (shared).
  function* flurry() {
    k.setState("Flurry"); k.facePlayer();
    yield* chase(150, 1.4);
    yield* k.play("rear", { to: 4, speed: 0.8 });      // rising on the hind legs
    yield* k.hold("rear", 5, 0.25);
    cry("hiss");
    for (let n = 0; n < 3; n++) {
      swish();
      k.hitbox({ dmg: dmg("ScratchDamage"), dx: -140, w: 280, dy: -190, h: 190, life: 0.2, directional: 0, shared: true });
      yield* k.play("scratch", { speed: 1.1, to: 3 });
    }
    yield* k.play("rear", { from: 11, to: 15, speed: 1 }); // dropping back down
    yield* k.hold("idle", 0, 0.5);
  }
  // Maul (last life): rises high on its hind legs, roaring (a long, readable tell), then slams down in front of it.
  function* maul() {
    k.setState("Maul"); k.facePlayer();
    yield* chase(160, 1.4);
    cry("hiss");
    yield* k.play("rear", { to: 7, speed: 0.55 });     // up, up, up
    yield* k.wait(0.15);
    swish(); cry("meow");
    k.hitbox({ dmg: dmg("MaulDamage"), dx: 0, w: 250, dy: -210, h: 210, life: 0.22 });
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
    k.invuln(false); yield* k.hold("idle", 0, 0.25);
  }
  function* stagger() { k.clearHits(); yield* k.play("hurt"); yield* k.wait(0.15); }
  // Stunned: it sits down heavily, lies down, and dozes: the loaf, then asleep, over and over until it wakes.
  function* stunned() {
    k.invuln(false);
    for (const m of mounds.splice(0)) k.dropFx(m); k.o.hide(false);
    yield* k.play("sitDown"); yield* k.play("rest_in");
    while (true) { yield* k.play("rest"); yield* k.play("dream"); }
  }
  function* recover() { yield* k.play("sitUp"); yield* k.hold("idle", 0, 0.25); }
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
  function* intro() {
    k.invuln(true);
    k.facePlayer(); yield* k.play("eat", { loops: 2, speed: 0.9 }); // busy with its supper...
    k.facePlayer(); cry("hiss"); yield* k.play("aggress"); // ...notices you
    k.invuln(false);
  }

  // ---- The director ----------------------------------------------------------------------------------------------------
  // A fixed rotation per life, with the player's distance deciding the opening when he stands right on it.
  const ROT = { 1: ["prowl", "A", "pounce", "B", "zoom", "pounce"], 2: ["A", "burrow", "pounce", "flurry", "B", "zoom", "C"], 3: ["C", "maul", "zoom", "burrow", "pounce", "flurry", "maul", "C"] };
  function* director() {
    if (k.state === "Intro") { k.setState("Intro"); yield* intro(); }
    k.setState("Neutral"); k.facePlayer();
    yield* k.wait(byPhase(0.35, 0.22, 0.12));
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
    yield* k.wait(byPhase(0.55, 0.35, 0.2));
  }

  // Every move by name, for the debug keys and the tests (kit.force).
  const moves = { swipeA: () => swipes("A"), swipeB: () => swipes("B"), swipeC: () => swipes("C"), pounce: () => pounce(phase() === 3 ? 2 : 1), zoom: zoomies, burrow, flurry, maul, hiss: hissFeint, dodge, stagger, lifeLost };
  return {
    director, idle, died, lifeLost, stunned, recover, stagger, dodge, moves,
    canStagger: s => ["Neutral", "Stalk", "Swipe", "Hiss"].indexOf(s) >= 0,
    cleanup() { for (const m of mounds.splice(0)) k.dropFx(m); k.o.hide(false); k.o.setOpacity && k.o.setOpacity(255); },
    // Dodge decision, the Leaf Ranger's way: every DodgeEvery-th swing near it (2 to 4, re-rolled after each dodge) is dodged,
    // so a player can't count it out. The dodge itself happens when Combat_Shared flags that swing as dodged.
    watch() {
      if (k.pflag("AttackPressed") && k.dist() < 230 && (k.state === "Neutral" || k.state === "Stalk") && !k.flag("WillDodgeHit") && !k.flag("Invulnerable") && k.t - lastDodge >= k.num("DodgeCooldown")) {
        dodgeCount++;
        if (dodgeCount >= dodgeEvery) { k.setFlag("WillDodgeHit", true); dodgeCount = 0; dodgeEvery = Math.floor(k.rand(2, 5)); wantDodge = k.t; }
      }
      if (k.flag("WillDodgeHit") && k.t - wantDodge > 1.2 && k.state !== "Dodge") k.setFlag("WillDodgeHit", false);
    }
  };
}
