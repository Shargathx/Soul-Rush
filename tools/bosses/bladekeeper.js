// The Bladekeeper: a blade dancer in metal and shadow, two lives. Its script, joined to tools/bosses/kit.js by tools/bosses/build.js.
// Everything tunable is a variable on the Bladekeeper object (tools/bosses/bladekeeper.def.js), so a playtest can change it in the editor.
//
// Life 1: slash combos, a thrown knife, a roll through the player, a guard that punishes mashing, a diving strike.
// Life 2 adds a third slash to the combo and a fan of three knives, plants blade traps and cuts the blade garden: the ground
// erupts in blades for a wide stretch around her. Each life is a phase.
//
// How it fights fair: every attack holds a wind-up pose you can read and is a hitbox you can deflect (a deflect adds posture to
// her). The roll, the dive and the garden are best avoided by rolling too; the garden is the one that makes you move.
function bladekeeperAI(k) {
  const lives = () => Math.round(k.num("Lives")), phase = () => (lives() <= 1 ? 2 : 1);
  const byPhase = (a, b) => (phase() === 1 ? a : b);
  const dmg = n => k.num(n);
  const BODY = { dx: -50, w: 140, dy: -100, h: 100 };
  const swish = () => k.sfxPick(["assets/Sfx/sword_swing_01.wav", "assets/Sfx/swing_2_lower.mp3", "assets/Sfx/SwordSwing_1.wav"], 50);
  const clang = () => k.sfx("assets/Sfx/sword_clash_01.wav", 60);
  const bars = hide => { for (const n of ["Enemy_HP_Bar", "Enemy_Posture_Bar"]) for (const b of k.scene.getObjects(n)) b.hide(hide); };
  const clamp = x => Math.max(k.CFG.minX, Math.min(k.CFG.maxX, x));
  const traps = [];
  const GUARD_CHANCE = [0.10, 0.25, 0.55, 0.85], GUARDABLE = ["Neutral", "Combo", "Throw", "Trap"];
  let hitStreak = 0, lastHitT = -99, dodgeCount = 0, dodgeEvery = 3, lastDodge = -99, wantDodge = 0, rot = 0;

  // ---- Pieces ---------------------------------------------------------------------------------------------------------
  function* approach(stop, max) { yield* k.walkTo(k.px, k.num("RunSpeed") * byPhase(1, 1.15), "run", stop, max); }
  // A hit box in front of her blade. dy is up from her feet; the sword swings at chest height.
  const blade = (damage, w, dy, h, life, extra) => Object.assign({ dmg: damage, dx: 10, w: w || 125, dy: dy === undefined ? -118 : dy, h: h || 80, life: life || 0.15 }, extra || {});
  // One slash animation: hold the wind-up pose (the tell), then play it, a hitbox on each frame in `hits`.
  function* slash(anim, windup, hits) {
    k.facePlayer(); yield* k.hold(anim, 0, windup); swish();
    const on = {}; for (const f of Object.keys(hits)) on[f] = () => k.hitbox(hits[f]);
    yield* k.play(anim, { from: 1, on });
  }
  const step = px => k.glide(clamp(k.x + k.facing * px), 0.1, "out", u => k.show("run", Math.floor(u * 4)));

  // ---- Moves ---------------------------------------------------------------------------------------------------------
  // Combo: two slashes (three in life 2), stepping in between. The last is a rising cut that reaches higher.
  function* combo() {
    k.setState("Combo");
    yield* approach(135, 1.8); if (k.dist() > 320) return;
    const w = byPhase(0.42, 0.3), D = dmg("SlashDamage");
    yield* slash("atk1", w, { 1: blade(D) }); yield* step(36);
    yield* slash("atk2", w * 0.65, { 1: blade(D), 4: blade(D, 135) });
    if (phase() === 2) { yield* step(30); yield* slash("atk3", w * 0.7, { 1: blade(D), 8: blade(D, 140, -126, 90), 12: blade(dmg("FinisherDamage"), 150, -150, 140) }); }
    yield* k.idleFor(byPhase(0.7, 0.45));
  }
  // Throw: a knife at her own height, flying straight. Life 2: three, one after another (each takes its own deflect).
  function* throwKnife() {
    k.setState("Throw"); k.facePlayer();
    const n = byPhase(1, 3);
    for (let i = 0; i < n; i++) {
      k.facePlayer();
      yield* k.play("cast", { speed: i ? 1.4 : 1, on: { 2: () => {
        k.sfxPick(["assets/Sfx/dashswoosh.mp3"], 40);
        k.shoot({ x: k.x + k.facing * 64, y: k.y - 78, vx: k.facing * k.num("KnifeSpeed"), vy: 0, dmg: dmg("ThrowDamage"), anim: "Fly", scale: 3, flip: k.facing < 0, life: 3 });
      } } });
      // Between knives she hops back, so the fan of three comes from three places.
      if (i < n - 1) yield* k.arc(clamp(k.x - k.facing * 90), 60, 0.3, u => k.show(u < 0.5 ? "jumpUp" : "jumpDown", Math.min(2, Math.floor((u < 0.5 ? u * 2 : (u - 0.5) * 2) * 3))));
    }
    yield* k.idleFor(byPhase(0.7, 0.4));
  }
  // Roll through the player and cut from behind. The roll has i-frames; the cut after it has the usual tell, just short.
  function* rollThrough() {
    k.setState("Roll"); k.facePlayer();
    yield* k.hold("roll", 0, 0.28);
    const dir = k.dirToPlayer(), to = clamp(k.px() + dir * 150);
    k.invuln(true);
    yield* k.glide(to, 0.4, "out", u => k.show("roll", Math.min(6, Math.floor(u * 7))));
    k.invuln(false); k.facePlayer();
    yield* slash("atk1", byPhase(0.3, 0.2), { 1: blade(dmg("SlashDamage")) });
    yield* k.idleFor(0.5);
  }
  // Guard (the armor): the blade across her body. Nothing hurts her while it is up. She only raises it in answer to being hit: after the
  // 1st hit that connects there is a 10% chance, after the 2nd 25%, the 3rd 55%, the 4th or later 85% (GUARD_CHANCE; the count restarts
  // after a guard or 5 s without a hit). If you swing at her while it is up she answers at once; if you don't, she lowers it and lunges.
  // Standing off and deflecting is the way to beat it.
  function* guard(reactive) {
    k.setState("Guard");
    if (!reactive) yield* approach(240, 1.5);
    k.facePlayer();
    yield* k.play("defend", { to: 1 });
    k.invuln(true);
    let t = 0, struck = false; const hold = byPhase(1.2, 0.95);
    while (t < hold) {
      yield; t += k.dt; k.show("defend", 2 + (Math.floor(t * 8) % 8));
      if (k.pflag("IsAttacking") && k.dist() < 240) { struck = true; break; }
    }
    k.invuln(false);
    if (struck) {
      clang(); k.facePlayer();
      const s = k.scene.createObject("Deflect_Spark"); if (s) { s.setPosition(k.x + k.facing * 56, k.y - 80); s.setAnimationIndex(Math.floor(Math.random() * 3)); s.setBlendMode(1); }
      yield* slash("atk2", 0.1, { 1: blade(dmg("CounterDamage")), 4: blade(dmg("CounterDamage"), 135) });
    } else {
      yield* k.play("defend", { from: 10 });
      yield* step(110);
      yield* slash("atk1", 0.25, { 1: blade(dmg("SlashDamage")) });
    }
    yield* k.idleFor(0.5);
  }
  // Air strike: back-flips away and up, hangs a moment (the tell), then dives at where the player stood, blade first.
  function* airStrike() {
    k.setState("Air"); k.facePlayer();
    const H = 250, x0 = k.x, x1 = clamp(k.x - k.facing * 250);
    let t = 0; k.air = true;
    while (t < 0.5) { yield; t += k.dt; const u = Math.min(1, t / 0.5); k.x = x0 + (x1 - x0) * u; k.y = k.CFG.ground - H * Math.sin(u * Math.PI / 2); k.show("jump", 1 + Math.min(8, Math.floor(u * 9))); }
    k.facePlayer(); t = 0;
    const hang = byPhase(0.55, 0.4);
    while (t < hang) { yield; t += k.dt; k.show("airAtk", t < hang * 0.5 ? 0 : 1); k.y = k.CFG.ground - H + Math.sin(t * 14) * 4; k.facePlayer(); }
    const sx = k.x, sy = k.y, tx = clamp(k.px() + k.facing * -10), dur = 0.34;
    swish(); const box = k.hitbox(Object.assign({ dmg: dmg("DiveDamage"), life: dur + 0.15 }, BODY));
    t = 0;
    while (t < dur) { yield; t += k.dt; const u = Math.min(1, t / dur); k.x = sx + (tx - sx) * u; k.y = sy + (k.CFG.ground - sy) * u * u; k.show("airAtk", 2 + Math.min(3, Math.floor(u * 4))); }
    k.x = tx; k.y = k.CFG.ground; k.air = false;
    yield* k.hold("airAtk", 6, 0.12); k.dropHit(box);
    yield* k.hold("airAtk", 7, 0.12);
    yield* k.play("jump", { from: 16 });
    yield* k.idleFor(byPhase(0.6, 0.4));
  }
  // Trap: she hops and slams a knife into the floor at the player's feet. It arms, then goes off as a fan of blades when he
  // is close or when its time is up. Life 2 sets two. They stay while she fights on.
  function* trap() {
    k.setState("Trap"); k.facePlayer();
    const n = byPhase(1, 2);
    for (let i = 0; i < n; i++) {
      k.facePlayer();
      const spot = clamp(k.px() + (i ? (Math.random() < 0.5 ? -1 : 1) * 230 : 0));
      yield* k.play("trapCast", { speed: i ? 1.3 : 1, on: { 3: () => launchTrap(spot) } });
    }
    yield* k.idleFor(byPhase(0.8, 0.5));
  }
  function launchTrap(x) {
    const fx = k.spawnFx("Bladekeeper_Trap", k.x, k.y - 90); if (!fx) return;
    fx.o.setScale(3); fx.o.setAnimationName("Throw"); fx.o.setAnimationFrame(0); fx.o.pauseAnimation();
    traps.push({ fx, x0: k.x + k.facing * 40, y0: k.y - 120, x1: x, t: 0, mode: "fly", boom: 0 });
  }
  // The blade garden (life 2): she drives her blade into the floor, holds it there (a long, readable tell, the ground glints),
  // and blades burst out of the floor all around her.
  function* garden() {
    k.setState("Garden"); k.facePlayer();
    yield* approach(210, 1.6);
    k.facePlayer();
    yield* k.play("special", { to: 2, speed: 0.9 });
    yield* k.wait(0.55);                                   // the pause: the blade is in the floor, nothing has happened yet
    swish(); clang();
    yield* k.play("special", { from: 3, to: 8, on: { 3: () => k.hitbox({ dmg: dmg("GardenDamage"), dx: -205, w: 410, dy: -118, h: 118, life: 0.5, follow: false, x: k.x - 205, directional: 0, shared: true }) } });
    yield* k.play("special", { from: 9 });
    yield* k.idleFor(0.9);                        // the garden leaves her open
  }

  // ---- Reactions ------------------------------------------------------------------------------------------------------
  function* dodge() {
    k.invuln(true); k.setFlag("WillDodgeHit", false); lastDodge = k.t; k.facePlayer();
    const to = clamp(k.x - k.facing * 330);
    yield* k.glide(to, 0.4, "out", u => k.show("roll", Math.min(6, Math.floor(u * 7))));
    k.invuln(false); yield* k.idleFor(0.2);
  }
  function* stagger() { k.clearHits(); yield* k.play("hit"); yield* k.wait(0.1); }
  function* stunned() { k.invuln(false); yield* k.play("kneel"); while (true) { k.show("kneel", 4); yield; } }
  function* recover() { yield* k.play("rise"); yield* k.idleFor(0.2); }
  // A life is gone: staggered, then she leaps to the far side of the arena and holds the guard pose a moment. No hits meanwhile.
  function* lifeLost(wasDown) {
    k.invuln(true); k.clearShots(); k.set("Posture", 0); k.setFlag("IsPostureBroken", false); clearTraps();
    if (wasDown) yield* k.play("rise"); else yield* k.play("hit"); // up from the kneel, or staggered
    const to = k.px() < 640 ? k.CFG.maxX - 120 : k.CFG.minX + 120;
    yield* k.arc(to, 220, 0.95, u => k.show("jump", Math.min(19, Math.floor(u * 20))));
    k.facePlayer(); yield* k.play("defend");
    k.invuln(false); dodgeEvery = 3; dodgeCount = 0;
  }
  function* died(held) {
    k.invuln(true); k.clearShots(); clearTraps(); bars(true);
    k.sfx("assets/Sfx/body_fall_01.wav", 55);
    yield* k.play("death", { from: held ? 5 : 0 });
    while (true) { k.show("death", 11); yield; }
  }
  function* idle() { k.clearHits(); while (true) yield* k.play("idle"); }
  function* intro() {
    k.invuln(true); k.facePlayer();
    yield* k.play("idle", { loops: 3, speed: 0.8 });       // she stands there, scarf moving, as if you were not worth drawing for
    k.facePlayer(); yield* k.play("defend", { to: 1 }); yield* k.wait(0.35); yield* k.play("defend", { from: 10 }); // then the guard salute
    k.invuln(false);
  }
  function clearTraps() { for (const t of traps.splice(0)) k.dropFx(t.fx); }

  // ---- The director ----------------------------------------------------------------------------------------------------
  const ROT = { 1: ["combo", "throw", "roll", "combo", "air", "throw"], 2: ["trap", "combo", "garden", "throw", "roll", "air", "trap", "garden", "combo"] };
  function* director() {
    if (k.state === "Intro") { k.setState("Intro"); yield* intro(); }
    k.setState("Neutral"); k.facePlayer();
    yield* k.idleFor(byPhase(0.4, 0.22));
    const list = ROT[phase()]; let pick = list[rot++ % list.length];
    if (k.dist() < 120 && pick === "throw") pick = "combo"; // crowded: a knife would be wasted
    k.setFlag("WillDodgeHit", false);
    if (pick === "combo") yield* combo();
    else if (pick === "throw") yield* throwKnife();
    else if (pick === "roll") yield* rollThrough();
    else if (pick === "guard") yield* guard();
    else if (pick === "air") yield* airStrike();
    else if (pick === "trap") yield* trap();
    else if (pick === "garden") yield* garden();
    yield* k.idleFor(byPhase(0.5, 0.3));
  }

  // ---- Traps, each frame ------------------------------------------------------------------------------------------------
  function tickTraps() {
    for (const t of traps.slice()) {
      const o = t.fx.o;
      if (t.mode === "fly") {
        t.t += k.dt; const u = Math.min(1, t.t / 0.45);
        o.setPosition(t.x0 + (t.x1 - t.x0) * u, t.y0 + (k.CFG.ground - t.y0) * u - 90 * Math.sin(u * Math.PI));
        if (u >= 1) { t.mode = "armed"; t.t = 0; o.setPosition(t.x1, k.CFG.ground); o.setAnimationName("Land"); o.setAnimationFrame(0); }
      } else if (t.mode === "armed") {
        t.t += k.dt; o.setAnimationFrame(Math.min(2, Math.floor(t.t / 0.1)));
        // Blinks while it waits, so it can be seen against the floor; the last half second it blinks fast.
        const late = t.t > k.num("TrapLife") - 0.5; o.hide(Math.floor(t.t * (late ? 16 : 5)) % 2 === 1 && t.t > 0.5);
        if (t.t >= k.num("TrapArm") && (Math.abs(k.px() - t.x1) < 95 || t.t >= k.num("TrapLife"))) {
          t.mode = "boom"; t.t = 0; o.hide(false); o.setAnimationName("Detonate"); o.setAnimationFrame(0);
          k.sfx("assets/Sfx/stab_flesh_01.wav", 55);
          k.hitbox({ dmg: dmg("TrapDamage"), dx: 0, w: 250, dy: -125, h: 125, life: 0.25, follow: false, x: t.x1 - 125, directional: 0 });
        }
      } else if (t.mode === "boom") {
        t.t += k.dt; o.setAnimationFrame(Math.min(4, Math.floor(t.t / 0.06)));
        if (t.t > 0.4) { traps.splice(traps.indexOf(t), 1); k.dropFx(t.fx); }
      }
    }
  }

  const moves = { combo, throw: throwKnife, roll: rollThrough, guard: () => guard(false), air: airStrike, trap, garden, dodge, stagger, lifeLost };
  return {
    director, idle, died, lifeLost, stunned, recover, stagger, dodge, moves,
    canStagger: s => ["Neutral", "Combo", "Throw", "Guard"].indexOf(s) >= 0,
    cleanup() { k.o.hide(false); },
    tick() { tickTraps(); },
    // Dodge decision, the Leaf Ranger's way: every DodgeEvery-th swing near her (2 to 4, re-rolled after each dodge) is dodged by a
    // roll back, so the player can't count it out.
    watch(F) {
      if (F && F.hit) {                                   // a player hit connected: maybe raise the guard
        k.setFlag("JustHitByPlayer", false);
        if (k.t - lastHitT > 5) hitStreak = 0;
        lastHitT = k.t; hitStreak++;
        if (GUARDABLE.indexOf(k.state) >= 0 && Math.random() < GUARD_CHANCE[Math.min(hitStreak, GUARD_CHANCE.length) - 1]) {
          hitStreak = 0; k.interrupt((function* () { yield* guard(true); })(), "Guard");
        }
      }
      if (k.pflag("AttackPressed") && k.dist() < 230 && k.state === "Neutral" && !k.flag("WillDodgeHit") && !k.flag("Invulnerable") && k.t - lastDodge >= k.num("DodgeCooldown")) {
        dodgeCount++;
        if (dodgeCount >= dodgeEvery) { k.setFlag("WillDodgeHit", true); dodgeCount = 0; dodgeEvery = Math.floor(k.rand(2, 5)); wantDodge = k.t; }
      }
      if (k.flag("WillDodgeHit") && k.t - wantDodge > 1.2 && k.state !== "Dodge") k.setFlag("WillDodgeHit", false);
    }
  };
}
