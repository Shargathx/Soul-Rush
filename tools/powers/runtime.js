// Powers in a fight (docs/design-brand-mercy.md, phase 4, slice 2). One script event in Combat_Shared, every frame. The hub works out the
// loadout and writes it into the globals LoadoutSlot1 to LoadoutSlot3 (tools/powers/powers.js, the altar screen picks them). Here:
//   R        uses the SELECTED power (the first filled slot at the start of a fight).
//   E (tap)  selects the next filled slot. A tap is a press shorter than a quarter of a second, so the mercy hold (one second) never counts.
//   U        (debug; it must not be J or K: those are the player's attack and deflect) toggles UNLIMITED actives: Requiem with no once-per-fight limit and at any boss HP, Bloom even at full HP, and no cooldowns at all (Poison stab, Blood pact, Bloom, Berserk, Petal step, Petal counter); range and vulnerability still count.
//   X        (debug) puts the next built active in slot 1 for this fight (Blood pact, Requiem, Poison stab, Bloom, Berserk, Petal step, Petal counter, then round again), to try them without earning them.
// The tutorial and the hub are exempt: no powers there. The selected power and a message show bottom left. Each power below says what it
// needs and does; paying in HP goes through Player.SacrificeHP (an event in this sheet takes it off, never kills, and rally cannot win it back).
const EXEMPT = ["Tutorial_Level", "HUB_Area"];
const players = runtimeScene.getObjects("Player");
if (players.length && !EXEMPT.includes(runtimeScene.getName())) {
  const player = players[0], pv = player.getVariables(), g = runtimeScene.getGame().getVariables(), input = gdjs.evtTools.input;
  const st = runtimeScene.__powers || (runtimeScene.__powers = { sel: -1, eDown: 0, cool: {}, msg: "", msgLeft: 0, hud: null, shown: "" });
  const dt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000);
  const pn = k => pv.get(k).getAsNumber(), pb = k => pv.get(k).getAsBoolean();
  const thousandCuts = () => (runtimeScene.getObjects("Samurai_NPC") || []).some(o => o.getVariables().get("AIState").getAsString() === "Ultimate");
  // In the middle of something: an attack or a saved follow-up, a lunge, a roll or dash, a deflect, a hit reaction, or rooted. The petal powers never cut these short.
  const midAction = () => ["IsAttacking", "AllowCombo", "IsLunging", "IsRolling", "IsDeflecting", "IsHurt", "IsRooted"].some(pb);
  // The powers. use(): returns a message to show, or "" when it did nothing.
  const POWER = {
    // Poison stab (the Leaf Ranger's kill power): a SEMI-RANGED arrow stab (StabRange 420 px: an emergency posture stop). Within StabRange px of a boss that can be hurt, the player lunges an arrow into him (a short
    // lock, about 0.45 s); at the strike Player.StabFire goes to 1 and the event in Combat_Shared (tools/brand) does a small hit (StabDamageMult of his damage,
    // with the hit sound and blood) and starts StabPoison (StabPoisonTime s), during which the boss's posture CANNOT recover (its regen timer is held at zero each frame).
    // Strong against the Samurai, whose posture recovers fast at full HP. Cooldown 14 s. A boss that cannot be hurt at the strike takes nothing (a whiff).
    poison_stab: {
      name: "Poison stab", cooldown: 14,
      use: function () {
        if (st.stab) return "Too soon";
        if (pn("BossVulnerable") !== 1) return "Too early: he cannot be hurt now";
        if (Math.abs(pn("BossX") - player.getCenterXInScene()) > pn("StabRange")) return "Too far from him";
        st.stab = { age: 0, started: false, struck: false, arrow: null, dir: player.getCenterXInScene() < pn("BossX") ? 1 : -1 };
        return "Poison stab";
      }
    },
    // Requiem (brand 3): the big one-time slash. Close to the boss (RequiemRange px) and with him at or under RequiemHpFrac of his HP (this life), once per
    // fight. The GAME IS FROZEN for the whole sequence (the time scale goes to 0.0001; only the shadow, the camera and the effects move, on real time), so the boss
    // cannot dash away or dodge between the press and the cut: it always lands where he stood. The player is locked and untouchable while the camera zooms in, his shadow (big) cuts the boss, and at the strike Player.RequiemFire
    // goes to 1 (the sequence is about 2.5 s: long enough to take in): the event in Combat_Shared (tools/brand) leaves the boss at 1 HP with his posture broken, so he drops into the stunned kneel at once and the player finishes him with the deathblow (F).
    // Player.BossX, BossHpFrac and BossVulnerable are written every frame by events (tools/brand).
    requiem: {
      name: "Requiem", cooldown: 0,
      use: function () {
        if (st.requiemUsed && !st.requiemDebug) return "Requiem is spent for this fight";
        if (pn("BossVulnerable") !== 1) return "Too early: he cannot be hurt now";
        if (pn("BossHpFrac") > pn("RequiemHpFrac") && !st.requiemDebug) return "Too early: he is not weak enough";
        if (Math.abs(pn("BossX") - player.getCenterXInScene()) > pn("RequiemRange")) return "Too far from him";
        st.requiemUsed = true; st.requiem = { age: 0, started: false, struck: false, shadow: null, arc: null, flash: null, side: player.getCenterXInScene() < pn("BossX") ? -1 : 1, bx: pn("BossX"), by: pn("BossY") };
        return "Requiem";
      }
    },
    // Bloom (the Leaf Ranger's mercy gift): an arrow driven into the ground at the player's feet flowers into a healing patch. While he STANDS IN IT
    // (BloomRadius px to each side of the arrow) it heals BloomHealHP HP over BloomTime s (the whole BloomHealHP for the whole time in it, whatever his max HP); walking out only pauses the healing, the patch's time
    // runs on. It never heals the boss and never restores sacrificed HP (Player.SacrificedOwed, counted by the Sacrificed HP event). No animation and no
    // lock, like Poison stab. Cooldown 20 s.
    bloom: {
      name: "Bloom", cooldown: 20,
      use: function () {
        if (st.bloom) return "Too soon";
        if (pn("Health") >= pn("MaxHealth") - pn("SacrificedOwed") - 0.5 && !st.requiemDebug) return "Too healthy: nothing to mend";
        st.bloom = { age: 0, x: player.getCenterXInScene(), y: player.getY() + 80 * player.getScaleX(), arrow: null, gfx: null, text: null, acc: 0 };
        return "Bloom";
      }
    },
    // Berserk (the Bladekeeper's kill power): a stance of BerserkTime s. It costs BerserkCost of max HP as sacrificed HP (not if that would leave less than
    // BerserkFloor of max HP). While Player.BerserkLeft runs: his sword and lunge hits take BerserkDamageMult times the HP (events in the hit event of
    // Combat_Shared; never more posture), a hit wins back BerserkRallyBonus of MaxRally on top of the usual 0.25, NO DASHES (whatever the loadout's dodge,
    // he rolls: dodge.js) but the roll costs BerserkDodgeDiscount (half) less stamina, and he CANNOT DEFLECT
    // (Player.DeflectDisabled; this also takes the sword block on the Samurai's grab away). There is no way to end it early. It ends when its time is up,
    // when he dies or when he loses a life. The Samurai's Thousand Cuts BREAKS it as it starts (only a deflect answers those cuts), and it cannot be started
    // during them. Cooldown 25 s from the press.
    berserk: {
      name: "Berserk", cooldown: 25,
      use: function () {
        if (st.berserk) return "Too soon";
        if (pb("IsDeflecting")) return "Too busy deflecting";
        if (thousandCuts()) return "Too late: not in the Thousand Cuts";
        const max = pn("MaxHealth"), cost = Math.round(max * pn("BerserkCost"));
        if (pn("Health") - cost < max * pn("BerserkFloor")) return "Too weak for that";
        pv.get("SacrificeHP").setNumber(pn("SacrificeHP") + cost);
        pv.get("BerserkLeft").setNumber(pn("BerserkTime"));
        pv.get("DeflectDisabled").setBoolean(true); pv.get("DeflectQueued").setBoolean(false);
        st.berserk = { age: 0, lives: pn("Lives"), gfx: null, text: null, acc: 0 };
        return "Berserk  -" + cost + " HP";
      }
    },
    // Petal step (the Samurai's bonus power): the player bursts into petals and reappears BEHIND the boss (on its far side from where he stood; if a wall is
    // there, beside it on his own side), facing it, with the boss ministunned (the flinch of a lunge: Player.PetalFire, an event of Combat_Shared) and
    // confused, so there is room to punish. The petals he leaves fade slowly (Player_Petals, tools/fx/player_petals.js); he is back fast. Nothing can
    // hurt him on the way. Not in Berserk (no dashes then), and it never cuts another action short (midAction, as Petal counter). Cooldown 18 s, no HP cost.
    petal_step: {
      name: "Petal step", cooldown: 18,
      use: function () {
        if (st.petal) return "Too soon";
        if (pn("BerserkLeft") > 0) return "Too wild: no Petal step in Berserk";
        if (midAction()) return "Too busy to step";
        st.petal = { age: 0, started: false, moved: false, mark: null };
        return "Petal step";
      }
    },
    // Petal counter (the Samurai's bonus power, the REACTIVE version beside Petal step; both are kept to compare): a COMMITTED STANCE. For PetalGuardTime s
    // (Player.PetalGuardLeft) he stands still and ready: no moving, attacking, lunging, rolling, deflecting or other powers. If a hit would land in that time, it does NOTHING (no damage, posture, grab or root) and he vanishes
    // and reappears behind the boss, exactly as Petal step does. The hit is caught by events in front of each way a boss hurts him (they set PetalSoak and
    // PetalShield): an attack (Combat_Shared), the Gunslinger's bullets, the Samurai's grab (it whiffs; tools/brand), the Leaf Ranger's bramble and snare.
    // The poison cloud is not a hit. If nothing hits him, the stance ends and it is wasted. It NEVER cuts another action short: refused (nothing spent)
    // during an attack, a saved follow-up attack, a lunge, a roll or dash, a deflect, a hit reaction or while rooted. Not in Berserk, and the
    // Thousand Cuts end it (his deflect is open again for them). Cooldown 12 s from the press.
    petal_counter: {
      name: "Petal counter", cooldown: 12,
      use: function () {
        if (st.petal && !st.petal.done) return "Too soon";
        if (pn("PetalGuardLeft") > 0) return "Too soon";
        if (pn("BerserkLeft") > 0) return "Too wild: no Petal counter in Berserk";
        if (thousandCuts()) return "Too late: not in the Thousand Cuts";
        if (midAction()) return "Too busy to counter";
        pv.get("PetalGuardLeft").setNumber(pn("PetalGuardTime"));
        st.guard = { age: 0 };
        if (st.sakura && st.sakura.gfx && st.sakura.gfx.destroy) st.sakura.gfx.destroy();
        st.sakura = { guard: st.guard, age: 0, acc: 0, attached: 5, petals: [], gfx: null, x: 0, y: 0 };
        // Into the stance. The lock stops moving, attacks, the lunge, the roll and R; a deflect ignores the lock, so it is shut too. A press saved just now is dropped.
        for (const n of ["RollQueued", "DeflectQueued"]) pv.get(n).setBoolean(false);
        pv.get("ComboStep").setNumber(0); pv.get("ControlsLocked").setBoolean(true); pv.get("DeflectDisabled").setBoolean(true);
        player.setAnimationName("Player_Idle"); if (player.playAnimation) player.playAnimation();
        return "Petal counter";
      }
    },
    blood_pact: {
      name: "Blood pact", cooldown: 1.5,
      // Pay a part of max HP (BloodPactCost) and get all the stamina back at once. Not if it would leave less than BloodPactFloor of max HP.
      use: function () {
        const max = pn("MaxHealth"), cost = Math.round(max * pn("BloodPactCost"));
        if (pn("Health") - cost < max * pn("BloodPactFloor")) return "Too weak for that";
        pv.get("SacrificeHP").setNumber(pn("SacrificeHP") + cost);
        pv.get("Stamina").setNumber(pn("MaxStamina"));
        return "Blood pact  -" + cost + " HP";
      }
    }
  };
  if (input.wasKeyJustPressed(runtimeScene, "x")) {                                                          // Debug: the next built active in slot 1.
    const ids = ["blood_pact", "requiem", "poison_stab", "bloom", "berserk", "petal_step", "petal_counter"].filter(i => POWER[i]), now = ids.indexOf(g.get("LoadoutSlot1").getAsString());   // (add each new built active here)
    g.get("LoadoutSlot1").setString(ids[(now + 1) % ids.length]);
  }
  if (input.wasKeyJustPressed(runtimeScene, "u")) { st.requiemDebug = !st.requiemDebug; st.msg = "Debug: unlimited powers " + (st.requiemDebug ? "ON (Requiem at any HP, no cooldowns)" : "OFF"); st.msgLeft = 2.5; }
  pv.get("RequiemHpFracNow").setNumber(st.requiemDebug ? 99 : pn("RequiemHpFrac"));                  // What the damage event checks (the debug key lifts it).
  const slots = [1, 2, 3].map(i => g.get("LoadoutSlot" + i).getAsString());
  const filled = [0, 1, 2].filter(i => slots[i] && POWER[slots[i]]);
  if (!filled.includes(st.sel)) st.sel = filled.length ? filled[0] : -1;
  for (const id of Object.keys(st.cool)) st.cool[id] = Math.max(0, st.cool[id] - dt);
  // E: a tap selects the next power.
  if (input.isKeyPressed(runtimeScene, "e")) st.eDown += dt;
  else { if (st.eDown > 0 && st.eDown < 0.25 && filled.length > 1) st.sel = filled[(filled.indexOf(st.sel) + 1) % filled.length]; st.eDown = 0; }
  // R: use it. Not while the player cannot act.
  if (input.wasKeyJustPressed(runtimeScene, "r") && st.sel >= 0) {
    const id = slots[st.sel], p = POWER[id];
    if (pb("ControlsLocked") || pb("IsDead") || pb("IsDeathblow") || pb("IsGrabbed") || pb("IsPostureBroken")) { /* cannot act */ }
    else if ((st.cool[id] || 0) > 0 && !st.requiemDebug) { /* still cooling down */ }
    else { const msg = p.use(); if (msg) { st.msg = msg; st.msgLeft = 1.4; if (!msg.startsWith("Too")) st.cool[id] = st.requiemDebug ? 0 : p.cooldown; } }
  }
  // What he has paid in HP and not yet got back by a full refill (a deathblow, a new life): Bloom cannot mend it. It can never be more than what is missing.
  pv.get("SacrificedOwed").setNumber(pn("Health") >= pn("MaxHealth") - 0.5 ? 0 : Math.min(pn("SacrificedOwed"), Math.max(0, pn("MaxHealth") - pn("Health"))));
  // Poison stab's sequence (see its entry above) and the poison's look: when the arrow lands it DISSOLVES into green motes, and while Player.StabPoison lasts spores
  // rise from the boss inside a soft green aura, with a countdown. The motes and spores are one list (st.spores) drawn in one Graphics.
  st.spores = st.spores || [];
  const addSpore = (x, y, vx, vy, life, size, col) => { if (st.spores.length < 140) st.spores.push({ x: x, y: y, vx: vx, vy: vy, age: 0, life: life, size: size, col: col, ph: Math.random() * 6.28 }); };
  const rnd = (a, b) => a + Math.random() * (b - a);
  if (st.stab) {
    // No body animation and no lock (decided 2026-11-26, option 1): the arrow is conjured above the player's head (a green charge glint for STRIKE s, following him) and fired,
    // and he can attack, deflect or dash the whole time. PLAYER_ANIM is the switch for later: with an animation name here it plays and locks the player for LOCK s.
    const PLAYER_ANIM = "", q = st.stab, LOCK = 0.45, STRIKE = 0.18, ARROW_LEN = 63, ARROW_ABOVE = 70, ARROW_LIFE = 0.7, W = runtimeScene.getGame().getGameResolutionWidth ? runtimeScene.getGame().getGameResolutionWidth() : 1280;
    const cleanup = function () { if (q.arrow && q.arrow.destroy) q.arrow.destroy(); if (PLAYER_ANIM && !pb("IsDead")) pv.get("ControlsLocked").setBoolean(false); st.stab = null; };
    if (!q.started) {
      q.started = true;
      if (PLAYER_ANIM) { pv.get("ControlsLocked").setBoolean(true); player.setAnimationName(PLAYER_ANIM); }
      if (typeof PIXI !== "undefined" && PIXI.Graphics) { try { q.arrow = new PIXI.Graphics(); q.arrow.zIndex = 1000003; runtimeScene.getLayer("").getRenderer().getRendererObject().addChild(q.arrow); } catch (e) { q.arrow = null; } }
    }
    q.age += dt;
    if (pb("IsDead") || q.age >= ARROW_LIFE) cleanup();
    else {
      if (PLAYER_ANIM && q.age >= LOCK && !pb("IsDead") && pb("ControlsLocked")) pv.get("ControlsLocked").setBoolean(false);        // (only with an animation) free again before the arrow fades.
      if (!q.struck && q.arrow) {                                                        // The charge: a green orb conjured over his head, growing and shimmering, following him until it fires.
        const u = Math.min(1, q.age / STRIKE), ox = player.getCenterXInScene(), oy = player.getY() + 44 * player.getScaleX() - ARROW_ABOVE, rad = 3 + 9 * u * u, sh = q.age * 38;
        q.arrow.clear();
        for (const [k, al] of [[2.6, 0.12], [1.8, 0.2], [1.2, 0.35]]) { q.arrow.beginFill(0x6fd16a, al * (0.6 + 0.4 * u)); q.arrow.drawCircle(ox, oy, rad * k); q.arrow.endFill(); }
        q.arrow.beginFill(0xe8ffd8, 0.5 + 0.5 * u); q.arrow.drawCircle(ox, oy, rad * 0.7); q.arrow.endFill();
        for (let i = 0; i < 4; i++) { q.arrow.beginFill(0xa6ec7c, 0.8 * u); q.arrow.drawCircle(ox + Math.cos(sh + i * 1.57) * rad * 2.1, oy + Math.sin(sh + i * 1.57) * rad * 2.1, 1.8); q.arrow.endFill(); }
      }
      if (!q.struck && q.age >= STRIKE) {
        q.struck = true; q.sx = player.getCenterXInScene(); q.sy = player.getY() + 44 * player.getScaleX() - ARROW_ABOVE;   /* the arrow starts ABOVE the player's head and comes down at the boss, at a declining angle */  q.tx = pn("BossX"); q.ty = pn("BossY");
        if (pn("BossVulnerable") === 1 && Math.abs(pn("BossX") - q.sx) <= pn("StabRange") + 80) { pv.get("StabSrcX").setNumber(q.sx); pv.get("StabFire").setNumber(1); q.hit = true; }
        else { st.msg = "Poison stab missed"; st.msgLeft = 1.4; }
        if (q.arrow) q.arrow.clear();                                        // The charge is over: the arrow flies.
      }
      if (q.struck && q.arrow) {                                           // A green arrow driven from the player into the boss, then it fades.
        const t = q.age - STRIKE, fly = 0.07 + 0.09 * Math.min(1, Math.hypot(q.tx - q.sx, q.ty - q.sy) / 420), p = Math.min(1, t / fly), fade = Math.min(1, Math.max(0, (ARROW_LIFE - q.age) / 0.25)), len = ARROW_LEN, ex = q.sx + (q.tx - q.sx) * p, ey = q.sy + (q.ty - q.sy) * p;
        const ang = Math.atan2(q.ty - q.sy, q.tx - q.sx), bx = ex - Math.cos(ang) * len, by = ey - Math.sin(ang) * len;
        if (p >= 1 && !q.landed) {                                          // It lands: the arrow dissolves into rising green motes along its length.
          q.landed = true;
          for (let i = 0; i < 20; i++) { const u = i / 19; addSpore(bx + (ex - bx) * u + rnd(-3, 3), by + (ey - by) * u + rnd(-3, 3), rnd(-28, 28), -rnd(25, 85), rnd(0.55, 1.05), rnd(2.5, 5), [0x6fd16a, 0xe8ffd8, 0x9be86a][i % 3]); }
        }
        if (q.landed) { q.arrow.clear(); }
        else {
        q.arrow.clear(); q.arrow.lineStyle(4, 0x6fd16a, fade); q.arrow.moveTo(bx, by); q.arrow.lineTo(ex, ey);
        q.arrow.lineStyle(2, 0xe8ffd8, fade); q.arrow.moveTo(bx, by); q.arrow.lineTo(ex, ey);
        q.arrow.lineStyle(3, 0x3f9a45, fade); q.arrow.moveTo(bx, by); q.arrow.lineTo(bx - Math.cos(ang + 0.5) * 14, by - Math.sin(ang + 0.5) * 14); q.arrow.moveTo(bx, by); q.arrow.lineTo(bx - Math.cos(ang - 0.5) * 14, by - Math.sin(ang - 0.5) * 14);
        }
      }
    }
  }
  if (typeof PIXI !== "undefined" && PIXI.Graphics && PIXI.Text) {
    const left = pn("StabPoison"), on = left > 0;
    if ((on || st.spores.length) && !st.poisonFx) {
      try {
        st.poisonFx = { gfx: new PIXI.Graphics(), text: new PIXI.Text("", { fontFamily: "Georgia, serif", fontSize: 18, fill: 0x9be08f, stroke: 0x000000, strokeThickness: 3 }) };
        st.poisonFx.gfx.zIndex = 1000002; runtimeScene.getLayer("").getRenderer().getRendererObject().addChild(st.poisonFx.gfx);
        if (st.poisonFx.text.anchor) st.poisonFx.text.anchor.set(0.5); st.poisonFx.text.x = (runtimeScene.getGame().getGameResolutionWidth ? runtimeScene.getGame().getGameResolutionWidth() : 1280) / 2; st.poisonFx.text.y = 638; st.poisonFx.text.zIndex = 800000;
        runtimeScene.getLayer("UI").getRenderer().getRendererObject().addChild(st.poisonFx.text);
      } catch (e) { st.poisonFx = null; }
    }
    if (st.poisonFx) {
      const fx = st.poisonFx, g = fx.gfx, bx = pn("BossX"), by = pn("BossY");
      st.poisonT = (st.poisonT || 0) + dt; const t = st.poisonT, fade = Math.min(1, left / 0.6);
      fx.text.visible = on; fx.text.text = "POISON  " + left.toFixed(1) + " s";
      if (on) { st.sporeAcc = (st.sporeAcc || 0) + dt * 18; while (st.sporeAcc >= 1) { st.sporeAcc -= 1; addSpore(bx + rnd(-42, 42), by + rnd(-15, 70), 0, -rnd(22, 52), rnd(1.3, 2.1), rnd(1.8, 3.8), Math.random() < 0.7 ? 0xa6ec7c : 0xe2ffb4); } }   // Spores rise from his body.
      g.clear();
      if (on) for (const [rad, al] of [[88, 0.04], [66, 0.06], [46, 0.08], [28, 0.1]]) { g.beginFill(0x4fd35a, al * fade * (0.75 + 0.25 * Math.sin(t * 5 + rad))); g.drawCircle(bx, by, rad * (1 + 0.05 * Math.sin(t * 3 + rad))); g.endFill(); }   // A soft pulsing aura, fainter than before.
      for (let i = st.spores.length - 1; i >= 0; i--) {                                 // The motes and spores: drift up with a slow sway, shrink and fade.
        const s = st.spores[i]; s.age += dt;
        if (s.age >= s.life) { st.spores.splice(i, 1); continue; }
        const u = s.age / s.life; s.x += (s.vx + Math.sin(s.age * 4 + s.ph) * 14) * dt; s.y += s.vy * dt;
        g.beginFill(s.col, 0.9 * (1 - u) * (u < 0.15 ? u / 0.15 : 1)); g.drawCircle(s.x, s.y, s.size * (1 - 0.5 * u)); g.endFill();
      }
      g.visible = on || st.spores.length > 0;
    }
  }
  // Berserk's stance (see its entry above): the time runs, deflecting stays shut, and he burns red: a pulsing tint and aura, rising embers, a ring that bursts
  // out as it starts, and a countdown.
  if (st.berserk) {
    const q = st.berserk, left = Math.max(0, pn("BerserkLeft") - dt), coat = runtimeScene.__brandPassives && runtimeScene.__brandPassives.coat;
    q.age += dt; pv.get("BerserkLeft").setNumber(left);
    const broken = thousandCuts();
    if (broken) { st.msg = "The Thousand Cuts break the Berserk"; st.msgLeft = 2; }
    if (left <= 0 || pb("IsDead") || pn("Lives") < q.lives || broken) {
      pv.get("BerserkLeft").setNumber(0); pv.get("DeflectDisabled").setBoolean(false); pv.get("DeflectQueued").setBoolean(false);
      if (!coat && player.setColor) player.setColor("255;255;255");
      for (const o of [q.gfx, q.text]) if (o && o.destroy) o.destroy();
      st.berserk = null;
    } else {
      pv.get("DeflectDisabled").setBoolean(true); pv.get("DeflectQueued").setBoolean(false);   // (A press saved during a swing must not wait for the stance to end.)
      if (pb("DeflectPressed")) { st.msg = "No deflecting in Berserk"; st.msgLeft = 1; }
      const beat = 0.5 + 0.5 * Math.sin(q.age * 9), ending = Math.min(1, left / 1.5);              // It dims over the last second and a half: a warning that it is running out.
      if (!coat && player.setColor) player.setColor("255;" + Math.round(255 - (130 + 45 * beat) * ending) + ";" + Math.round(255 - (150 + 45 * beat) * ending));   // (The Metal coat's steel look wins.)
      const cx = player.getCenterXInScene(), feet = player.getY() + 80 * player.getScaleX();
      q.acc += dt * 20; while (q.acc >= 1) { q.acc -= 1; addSpore(cx + rnd(-26, 26), feet - rnd(0, 70), rnd(-10, 10), -rnd(45, 100), rnd(0.35, 0.75), rnd(1.6, 3.4), [0xff3b2a, 0xb0101e, 0xff9a40][Math.floor(rnd(0, 3))]); }
      if (!q.gfx && typeof PIXI !== "undefined" && PIXI.Graphics && PIXI.Text) {
        try {
          q.gfx = new PIXI.Graphics(); q.gfx.zIndex = 1000001; runtimeScene.getLayer("").getRenderer().getRendererObject().addChild(q.gfx);
          q.text = new PIXI.Text("", { fontFamily: "Georgia, serif", fontSize: 19, fill: 0xff6a50, stroke: 0x000000, strokeThickness: 3 });
          if (q.text.anchor) q.text.anchor.set(0.5); q.text.x = (runtimeScene.getGame().getGameResolutionWidth ? runtimeScene.getGame().getGameResolutionWidth() : 1280) / 2; q.text.y = 590; q.text.zIndex = 800000;
          runtimeScene.getLayer("UI").getRenderer().getRendererObject().addChild(q.text);
        } catch (e) { q.gfx = q.text = null; }
      }
      if (q.text) q.text.text = "BERSERK  " + left.toFixed(1) + " s";
      if (q.gfx) {
        const g = q.gfx, cy = feet - 34;
        g.clear();
        for (const [w, h, al] of [[46, 56, 0.05], [34, 44, 0.07], [22, 32, 0.09]]) { g.beginFill(0xd01828, al * (0.6 + 0.4 * beat) * ending); g.drawEllipse(cx, cy, w + 3 * beat, h + 4 * beat); g.endFill(); }
        g.beginFill(0xff3b2a, 0.16 * ending); g.drawEllipse(cx, feet, 34 + 6 * beat, 7 + beat); g.endFill();
        const burst = q.age / 0.4;
        if (burst < 1) { const out = 1 - (1 - burst) * (1 - burst); g.lineStyle(7 * (1 - burst) + 1, 0xff3b2a, 0.9 * (1 - burst)); g.drawCircle(cx, cy, 20 + 150 * out); g.lineStyle(0); }
      }
    }
  }
  // The Samurai's trial for Petal step (he must also WIN: the Boss beaten script saves BossesBeaten.Samurai_Petal when earned is true): EITHER not hit once in
  // the whole fight, OR all three Thousand Cuts of his last life passed without a hit (every slash deflected). Player.PlayerHits is counted by the two events
  // that hurt him there (an attack, the grab's stab); HP he pays for a power is not a hit.
  if (runtimeScene.getName() === "Samurai_Fight") {
    const t = runtimeScene.__petalTrial || (runtimeScene.__petalTrial = { base: pn("PlayerHits"), cuts: 0, dirty: false, inCuts: false, mark: 0, unhit: true, earned: true, told: false });
    const hits = pn("PlayerHits") - t.base, cutting = thousandCuts();
    if (cutting && !t.inCuts) { t.inCuts = true; t.mark = hits; }
    else if (!cutting && t.inCuts) { t.inCuts = false; if (hits === t.mark && !pb("IsDead")) t.cuts++; else t.dirty = true; }
    t.unhit = hits === 0;
    t.earned = t.unhit || (t.cuts >= 3 && !t.dirty && !(t.inCuts && hits !== t.mark));
    if (t.earned && !t.told && !pb("IsDead") && (runtimeScene.getObjects("Samurai_NPC") || []).some(o => o.getVariables().get("Lives").getAsNumber() <= 0)) {
      t.told = true;
      if (typeof PIXI !== "undefined" && PIXI.Text) {
        try {
          const label = new PIXI.Text("PETAL STEP EARNED", { fontFamily: "Georgia, serif", fontSize: 34, fill: 0xffc4da, stroke: 0x3a0a1c, strokeThickness: 5 });
          if (label.anchor) label.anchor.set(0.5); label.x = (runtimeScene.getGame().getGameResolutionWidth ? runtimeScene.getGame().getGameResolutionWidth() : 1280) / 2; label.y = 190; label.zIndex = 800000;
          runtimeScene.getLayer("UI").getRenderer().getRendererObject().addChild(label);
        } catch (e) { /* no label */ }
      }
    }
  }
  // Petal counter's stance (see its entry above; its look is below). A caught hit (PetalSoak, from the events) starts Petal step's sequence.
  // Leaving the stance. His controls come back, unless something else has taken them (the Thousand Cuts lock him themselves, and a dead man stays locked).
  const endGuard = function () {
    if (st.guard) {
      pv.get("DeflectDisabled").setBoolean(false); pv.get("DeflectQueued").setBoolean(false); pv.get("RollQueued").setBoolean(false);
      if (!thousandCuts() && !pb("IsDead")) pv.get("ControlsLocked").setBoolean(false);
    }
    st.guard = null; pv.get("PetalGuardLeft").setNumber(0);
  };
  if (pn("PetalSoak") === 1) {
    pv.get("PetalSoak").setNumber(0); endGuard();
    if (st.petal) {                                                              // An earlier step's petals may still be fading: they go now.
      if (st.petal.cloud) st.petal.cloud.deleteFromScene(runtimeScene);
      if (st.petal.mark && st.petal.mark.destroy) st.petal.mark.destroy();
    }
    st.petal = { age: 0, started: false, moved: false, mark: null, caught: true };
    st.msg = "Petal counter!"; st.msgLeft = 1.4;
  } else if (st.guard) {
    const q = st.guard, broken = thousandCuts() || pn("BerserkLeft") > 0 || pb("IsDead"), left = broken ? 0 : Math.max(0, pn("PetalGuardLeft") - dt);
    q.age += dt;
    if (left <= 0) { if (!broken) { st.msg = "Nothing to counter"; st.msgLeft = 1.2; } endGuard(); }
    else {
      pv.get("PetalGuardLeft").setNumber(left);
      pv.get("DeflectDisabled").setBoolean(true); pv.get("DeflectQueued").setBoolean(false); pv.get("RollQueued").setBoolean(false);   // (A press in the stance must not fire after it.)
    }
  }
  // The stance's look, cherry blossom: a blossom opens above his head and SHEDS ITS FIVE PETALS one by one as the window runs out (so it is the timer too),
  // while petals tumble down around him. A caught hit scatters what is left; a wasted stance lets it wilt. Falling petals live on a moment after it ends.
  if (st.sakura) {
    const fx = st.sakura, SIZE = 17, OPEN = 0.09, AFTER = 0.55, standing = st.guard === fx.guard && !!st.guard;
    fx.age += dt;
    // Over his BODY (the hit box), not the middle of his sprite frame, which is about 13 px to one side of it (and the other side when he turns).
    let hl = Infinity, hr = -Infinity;
    for (const h of (player.getHitBoxes ? player.getHitBoxes() : [])) for (const v of h.vertices) { hl = Math.min(hl, v[0]); hr = Math.max(hr, v[0]); }
    const cx = hl <= hr ? (hl + hr) / 2 : player.getCenterXInScene(), feet = player.getY() + 80 * player.getScaleX(), top = feet - 126;
    const drop = function (x, y, vx, vy, a, len, life) { if (fx.petals.length < 70) fx.petals.push({ x: x, y: y, vx: vx, vy: vy, a: a, spin: rnd(-5, 5), flip: rnd(0, 6.28), len: len, age: 0, life: life, col: [0xffc4da, 0xffe3ee, 0xf59ab9][Math.floor(rnd(0, 3))] }); };
    const turn = -1.5708 + fx.age * 1.1;                                          // The blossom turns slowly.
    const open = Math.min(1, fx.age / OPEN), grow = open * (1 + 0.25 * Math.sin(open * 3.14));
    if (standing) {
      const left = pn("PetalGuardLeft") / Math.max(0.1, pn("PetalGuardTime")), keep = Math.max(1, Math.min(5, Math.ceil(left * 5)));
      while (fx.attached > keep) { fx.attached--; const a = turn + fx.attached * 1.2566; drop(cx + Math.cos(a) * 6, top + Math.sin(a) * 6, Math.cos(a) * 55, Math.sin(a) * 30 - 10, a, SIZE, 0.6); }
      fx.acc += dt * 46; while (fx.acc >= 1) { fx.acc -= 1; drop(cx + rnd(-50, 50), feet - rnd(55, 125), rnd(-18, 18), rnd(60, 125), rnd(0, 6.28), rnd(7, 12), rnd(0.35, 0.65)); }
    } else {
      if (fx.endAge === undefined) {
        fx.endAge = 0;
        const caught = !!(st.petal && st.petal.caught);
        while (fx.attached > 0) { fx.attached--; const a = turn + fx.attached * 1.2566, v = caught ? 150 : 25; drop(fx.x + Math.cos(a) * 6, fx.y + Math.sin(a) * 6, Math.cos(a) * v, Math.sin(a) * v * 0.7, a, SIZE, caught ? 0.5 : 0.45); }
      }
      fx.endAge += dt;
    }
    if (standing) { fx.x = cx; fx.y = top; }
    if (!fx.gfx && typeof PIXI !== "undefined" && PIXI.Graphics && PIXI.Text) { try { fx.gfx = new PIXI.Graphics(); fx.gfx.zIndex = 1000001; runtimeScene.getLayer("").getRenderer().getRendererObject().addChild(fx.gfx); } catch (e) { fx.gfx = null; } }
    // One cherry petal: its base at (x, y), pointing along a, with the notch in its tip; squash narrows it as it tumbles.
    const SHAPE = [[0, 0], [0.28, -0.3], [0.62, -0.46], [0.9, -0.38], [1.02, -0.17], [0.84, 0], [1.02, 0.17], [0.9, 0.38], [0.62, 0.46], [0.28, 0.3]];
    const petal = function (g, x, y, a, len, squash, col, alpha) {
      const co = Math.cos(a), si = Math.sin(a), pts = [];
      for (const p of SHAPE) { const u = p[0] * len, v = p[1] * len * squash; pts.push(x + u * co - v * si, y + u * si + v * co); }
      g.beginFill(col, alpha); g.drawPolygon(pts); g.endFill();
    };
    for (let i = fx.petals.length - 1; i >= 0; i--) {
      const p = fx.petals[i]; p.age += dt;
      if (p.age >= p.life) { fx.petals.splice(i, 1); continue; }
      p.x += (p.vx + Math.sin(p.age * 9 + p.flip) * 30) * dt; p.y += p.vy * dt; p.a += p.spin * dt;
    }
    if (fx.gfx) {
      const g = fx.gfx; g.clear();
      for (const p of fx.petals) petal(g, p.x, p.y, p.a, p.len, 0.35 + 0.65 * Math.abs(Math.cos(p.age * 8 + p.flip)), p.col, 0.95 * Math.min(1, (p.life - p.age) / (p.life * 0.4)));
      if (fx.attached > 0) {
        for (let i = 0; i < fx.attached; i++) {
          const a = turn + i * 1.2566;
          petal(g, fx.x, fx.y, a, SIZE * grow * 1.16, grow ? 1.04 : 0, 0xd9507f, 0.55);        // A deeper rim, so it reads on any backdrop.
          petal(g, fx.x, fx.y, a, SIZE * grow, 0.96, 0xffc4da, 1);
          petal(g, fx.x, fx.y, a, SIZE * grow * 0.55, 0.6, 0xf27aa8, 0.9);
        }
        for (let i = 0; i < 5; i++) { const a = turn + 0.628 + i * 1.2566; g.beginFill(0xf0c448, 1); g.drawCircle(fx.x + Math.cos(a) * 5.5 * grow, fx.y + Math.sin(a) * 5.5 * grow, 1.4); g.endFill(); }   // The stamens.
        g.beginFill(0xfff0c0, 1); g.drawCircle(fx.x, fx.y, 2.8 * grow); g.endFill();
      }
    }
    if (fx.endAge !== undefined && (fx.endAge >= AFTER || !fx.petals.length)) { if (fx.gfx && fx.gfx.destroy) fx.gfx.destroy(); st.sakura = null; }
  }
  // Petal step's sequence (see its entry above): VANISH s unseen, then he re-forms at the new spot over REFORM s (the frames stepped by hand, fast).
  if (st.petal) {
    const q = st.petal, VANISH = 0.12, REFORM = 0.24, CLOUD = 1.6, MARK = 0.9, FRAMES = 12;
    const petalColor = () => [0xffb7d0, 0xf27aa8, 0xffe3ee, 0xd9507f][Math.floor(rnd(0, 4))];
    if (!q.started) {
      q.started = true;
      // Where to: the far side of the boss. A side is clear when no Invisible_Wall (in his height band) is between the boss and the spot, or on it.
      const box = function (o) {
        let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
        for (const h of (o.getHitBoxes ? o.getHitBoxes() : [])) for (const v of h.vertices) { l = Math.min(l, v[0]); r = Math.max(r, v[0]); t = Math.min(t, v[1]); b = Math.max(b, v[1]); }
        if (l === Infinity && o.getAABBLeft) { l = o.getAABBLeft(); r = o.getAABBRight(); t = o.getAABBTop(); b = o.getAABBBottom(); }
        if (l === Infinity) { l = r = o.getCenterXInScene(); t = b = o.getY(); }
        return { l: l, r: r, t: t, b: b };
      };
      const me = box(player), half = Math.max(8, (me.r - me.l) / 2), walls = (runtimeScene.getObjects("Invisible_Wall") || []).map(box);
      const bx = pn("BossX"), gap = pn("PetalGap"), from = player.getCenterXInScene(), far = from < bx ? 1 : -1;
      const clear = side => !walls.some(w => w.b > me.t && w.t < me.b && w.r > Math.min(bx, bx + side * gap) - half && w.l < Math.max(bx, bx + side * gap) + half);
      const side = clear(far) ? far : clear(-far) ? -far : 0;
      q.to = side ? bx + side * gap : from; q.faceLeft = q.to > bx; q.behind = side === far;
      // The petals he leaves: his own burst, where and how he stood.
      const o = runtimeScene.createObject("Player_Petals");
      if (o) { o.setAnimationName("Burst"); o.setScale(player.getScaleX()); if (o.flipX && player.isFlippedX) o.flipX(player.isFlippedX()); o.setX(player.getX()); o.setY(player.getY()); o.setZOrder(player.getZOrder() - 1); q.cloud = o; }
      const feet = player.getY() + 80 * player.getScaleX();
      for (let i = 0; i < 34; i++) addSpore(from + rnd(-30, 30), feet - rnd(5, 85), rnd(-55, 55), rnd(-45, 28), rnd(1.1, 2.1), rnd(2, 4.2), petalColor());
      // He lets go of whatever he was doing; IsGrabbed keeps a press or a stray hit from touching him while he is gone.
      q.shielded = pb("RespawnIframe");
      for (const n of ["IsAttacking", "IsRolling", "IsDeflecting", "IsLunging", "IsHurt", "AllowCombo", "RollQueued", "DeflectQueued"]) pv.get(n).setBoolean(false);
      pv.get("ComboStep").setNumber(0);
      pv.get("ControlsLocked").setBoolean(true); pv.get("IsGrabbed").setBoolean(true); pv.get("RespawnIframe").setBoolean(true); if (player.resetTimer) player.resetTimer("RespawnTimer");
      player.setOpacity(0);
      pv.get("PetalShield").setNumber(1);                                        // Nothing catches him on the way (the events that do not look at IsGrabbed look at this).
      pv.get("PetalFire").setNumber(1);                                          // The event staggers the boss.
      // Its confusion: a question mark over it for a moment (only on a boss that can be staggered now; the Gunslinger has no flinch).
      if (pn("BossVulnerable") === 1 && runtimeScene.getName() !== "Gunslinger" && typeof PIXI !== "undefined" && PIXI.Text) {
        try {
          q.mark = new PIXI.Text("?", { fontFamily: "Georgia, serif", fontSize: 40, fill: 0xffe3ee, stroke: 0x3a0a1c, strokeThickness: 5 });
          if (q.mark.anchor) q.mark.anchor.set(0.5); q.mark.zIndex = 1000004; runtimeScene.getLayer("").getRenderer().getRendererObject().addChild(q.mark);
        } catch (e) { q.mark = null; }
      }
    }
    q.age += dt;
    const release = function () {
      if (q.done) return;
      q.done = true; player.setOpacity(255); pv.get("PetalShield").setNumber(0);
      if (!pb("IsDead")) {
        pv.get("ControlsLocked").setBoolean(false); pv.get("IsGrabbed").setBoolean(false); if (!q.shielded) pv.get("RespawnIframe").setBoolean(false);
        player.setAnimationName("Player_Idle"); if (player.playAnimation) player.playAnimation();
      }
    };
    if (pb("IsDead")) release();
    else if (!q.done && q.age >= VANISH) {
      if (!q.moved) {
        q.moved = true; player.setX(player.getX() + (q.to - player.getCenterXInScene())); if (player.flipX) player.flipX(q.faceLeft);
        player.setAnimationName("Player_Petal_Gather"); if (player.pauseAnimation) player.pauseAnimation(); player.setOpacity(255);
        const feet = player.getY() + 80 * player.getScaleX();
        for (let i = 0; i < 18; i++) { const a = rnd(0, 6.28), d = rnd(35, 70); addSpore(q.to + Math.cos(a) * d, feet - 40 + Math.sin(a) * d, -Math.cos(a) * d * 3.2, -Math.sin(a) * d * 3.2, 0.3, rnd(2, 3.6), petalColor()); }   // Petals rushing in to where he re-forms.
      }
      if (q.age >= VANISH + REFORM) release();
      else if (player.setAnimationFrame) player.setAnimationFrame(Math.min(FRAMES - 1, Math.floor((q.age - VANISH) / REFORM * FRAMES)));
    }
    if (q.mark) { q.mark.x = pn("BossX") + 6 * Math.sin(q.age * 11); q.mark.y = pn("BossY") - 105; q.mark.alpha = Math.max(0, Math.min(1, (MARK - q.age) / 0.3)); if (q.age >= MARK) { if (q.mark.destroy) q.mark.destroy(); q.mark = null; } }
    if (q.age >= CLOUD || pb("IsDead")) {
      release();
      if (q.cloud) q.cloud.deleteFromScene(runtimeScene);
      if (q.mark && q.mark.destroy) q.mark.destroy();
      st.petal = null;
    }
  }
  // Bloom's sequence (see its entry above): the arrow comes in from the TOP OF THE SCREEN at a slight slant, from the side away from the boss (PLANT s, with a
  // green-gold trail, a few petals and a ring on the floor closing in on the spot), bursts where he stood at the press, the flowers open, and the patch heals
  // for BloomTime s. No shake and no freeze.
  if (st.bloom) {
    const q = st.bloom, PLANT = 0.28, FADE = 0.5, SLANT = 0.28, TAIL = 50, BURST = 0.4, life = pn("BloomTime"), radius = pn("BloomRadius"), end = PLANT + life;
    // The sprite turns about the middle of its image, TAIL px above the arrow's tip: this puts the TIP at (x, y) with the arrow turned a (radians).
    const place = function (x, y, a) { q.arrow.setAngle(a * 180 / Math.PI); q.arrow.setX(x + TAIL * Math.sin(a)); q.arrow.setY(y + TAIL * (1 - Math.cos(a))); };
    const cleanup = function () {
      if (q.arrow) q.arrow.deleteFromScene(runtimeScene);
      for (const o of [q.gfx, q.text]) if (o && o.destroy) o.destroy();
      st.bloom = null;
    };
    if (!q.started) {
      q.started = true;
      // Where it comes from: just above the top edge of what the camera shows, behind him as he faces the boss.
      const sky = runtimeScene.getLayer(""), H = runtimeScene.getGame().getGameResolutionHeight ? runtimeScene.getGame().getGameResolutionHeight() : 720;
      const top = sky.getCameraY ? sky.getCameraY() - H / 2 / ((sky.getCameraZoom && sky.getCameraZoom()) || 1) : q.y - 500;
      q.sy = Math.min(top - 10, q.y - 200); q.sx = q.x - (q.x < pn("BossX") ? 1 : -1) * SLANT * (q.y - q.sy); q.angle = Math.atan2(q.sx - q.x, q.y - q.sy);
      const o = runtimeScene.createObject("Player_Bloom");
      if (o) { o.setAnimationName("Fly"); o.setZOrder(player.getZOrder() - 1); q.arrow = o; place(q.sx, q.sy, q.angle); }
      if (typeof PIXI !== "undefined" && PIXI.Graphics && PIXI.Text) {
        try {
          q.gfx = new PIXI.Graphics(); q.gfx.zIndex = 1000001; runtimeScene.getLayer("").getRenderer().getRendererObject().addChild(q.gfx);
          q.text = new PIXI.Text("", { fontFamily: "Georgia, serif", fontSize: 18, fill: 0xf0e2a8, stroke: 0x000000, strokeThickness: 3 });
          if (q.text.anchor) q.text.anchor.set(0.5); q.text.x = (runtimeScene.getGame().getGameResolutionWidth ? runtimeScene.getGame().getGameResolutionWidth() : 1280) / 2; q.text.y = 614; q.text.zIndex = 800000;
          runtimeScene.getLayer("UI").getRenderer().getRendererObject().addChild(q.text);
        } catch (e) { q.gfx = q.text = null; }
      }
    }
    q.age += dt;
    if (pb("IsDead") || q.age >= end + FADE) cleanup();
    else {
      // The flight: a straight line to the spot, a little faster as it goes.
      const u = Math.min(1, q.age / PLANT), way = u * (0.6 + 0.4 * u), tx = q.sx + (q.x - q.sx) * way, ty = q.sy + (q.y - q.sy) * way;
      if (u < 1) {
        if (q.arrow) place(tx, ty, q.angle);
        q.petalAcc = (q.petalAcc || 0) + dt * 30; while (q.petalAcc >= 1) { q.petalAcc -= 1; addSpore(tx + rnd(-6, 6), ty - rnd(20, 60), rnd(-24, 24), rnd(10, 45), rnd(0.4, 0.8), rnd(2, 3.6), [0xfcf6e2, 0xf0c448, 0x9be86a][Math.floor(rnd(0, 3))]); }
      } else if (!q.planted) {                                                            // It lands: it stands upright in the ground, with a burst of petals.
        q.planted = true;
        if (q.arrow) { q.arrow.setAnimationName("Grow"); place(q.x, q.y, 0); }
        for (let i = 0; i < 26; i++) { const a = -Math.PI * (i + rnd(0.2, 0.8)) / 26, sp = rnd(40, 150); addSpore(q.x + rnd(-8, 8), q.y - rnd(2, 14), Math.cos(a) * sp, Math.sin(a) * sp * 0.7, rnd(0.45, 0.9), rnd(2.2, 4.4), [0xfcf6e2, 0xf0c448, 0x9be86a][i % 3]); }
      }
      if (q.planted && q.arrow) q.arrow.setOpacity(Math.round(255 * Math.min(1, Math.max(0, (end + FADE - q.age) / FADE))));
      const on = q.age >= PLANT && q.age < end, inside = on && Math.abs(player.getCenterXInScene() - q.x) <= radius;
      // How much of this frame was inside the patch's healing time: cut at both ends, so the whole time in it heals exactly BloomHealHP.
      const part = Math.max(0, Math.min(q.age, end) - Math.max(q.age - dt, PLANT));
      if (part > 0 && Math.abs(player.getCenterXInScene() - q.x) <= radius) {
        // Heal, never past what rally and the sacrifice leave: sacrificed HP stays gone, and what the flowers mend leaves the rally pool (not healed twice).
        const cap = pn("MaxHealth") - pn("SacrificedOwed"), hp = pn("Health");
        if (hp > 0 && hp < cap) {
          const now = Math.min(cap, hp + pn("BloomHealHP") * part / Math.max(0.1, life));
          pv.get("Health").setNumber(now);
          if (pn("PendingRally") > cap - now) pv.get("PendingRally").setNumber(Math.max(0, cap - now));
          q.acc += dt * 12; while (q.acc >= 1) { q.acc -= 1; addSpore(player.getCenterXInScene() + rnd(-24, 24), q.y - rnd(8, 90), 0, -rnd(25, 55), rnd(0.6, 1.1), rnd(1.8, 3.2), Math.random() < 0.6 ? 0xfcf6e2 : 0xf0c448); }
        }
      }
      if (q.text) { q.text.visible = on; q.text.text = "BLOOM  " + Math.max(0, end - q.age).toFixed(1) + " s" + (inside ? "" : "   (stand in the flowers)"); }
      if (q.gfx) {                                                               // The patch on the floor: soft flattened rings, brighter while he stands in it, with small blossoms.
        const g = q.gfx, grow = Math.min(1, Math.max(0, (q.age - PLANT) / 0.5)), fade = Math.min(1, Math.max(0, (end + FADE - q.age) / FADE)), glow = (inside ? 1 : 0.55) * (0.85 + 0.15 * Math.sin(q.age * 5));
        g.clear();
        if (u < 1) {                                                              // While it falls: a faint ring closing in on the spot.
          g.lineStyle(2, 0xf0e2a8, 0.2 + 0.45 * u); g.drawEllipse(q.x, q.y, radius - (radius - 14) * u, 13 - 9 * u); g.lineStyle(0);
        }
        const trail = Math.max(0, 1 - Math.max(0, q.age - PLANT) / 0.18);
        if (trail > 0) {                                                          // The streak behind the arrow: green outside, gold inside, thinner the further back; it dies away just after the landing.
          const ux = Math.sin(q.angle), uy = -Math.cos(q.angle), reach = Math.min(150, Math.hypot(tx - q.sx, ty - q.sy)) * trail;
          for (let i = 0; i < 6; i++) {
            const a = TAIL * 0.7 + reach * i / 6, b = TAIL * 0.7 + reach * (i + 1) / 6, k = 1 - i / 6;
            for (const [w, col, al] of [[9, 0x7fd66a, 0.35], [3, 0xf6e6a0, 0.85]]) { g.lineStyle(w * k + 0.5, col, al * k * trail); g.moveTo(tx + ux * a, ty + uy * a); g.lineTo(tx + ux * b, ty + uy * b); }
          }
          g.lineStyle(0);
        }
        const burst = (q.age - PLANT) / BURST;
        if (burst >= 0 && burst < 1) {                                            // The impact: a ring running out along the floor and a short glow.
          const out = 1 - (1 - burst) * (1 - burst);
          g.lineStyle(4 * (1 - burst) + 1, 0xfcf6e2, 0.9 * (1 - burst)); g.drawEllipse(q.x, q.y, 10 + radius * 1.4 * out, 3 + 20 * out); g.lineStyle(0);
          g.beginFill(0xf6e6a0, 0.45 * (1 - burst)); g.drawCircle(q.x, q.y - 8, 12 + 16 * out); g.endFill();
        }
        if (grow > 0) {
          for (const [k, al] of [[1, 0.1], [0.72, 0.13], [0.42, 0.16]]) { g.beginFill(0x7fd66a, al * fade * glow); g.drawEllipse(q.x, q.y, radius * k * grow, 13 * k * grow); g.endFill(); }
          for (let i = 0; i < 12; i++) {
            const fx = q.x + (-1 + 2 * (i + 0.5) / 12) * radius * grow, fy = q.y - 2 + ((i * 7) % 5);
            g.beginFill(0xfcf6e2, 0.9 * fade); g.drawCircle(fx, fy, 2.6 * grow); g.endFill(); g.beginFill(0xf0c448, fade); g.drawCircle(fx, fy, 1.1 * grow); g.endFill();
          }
        }
      }
    }
  }
  // Requiem's sequence (see its entry above): zoom, lock, the big shadow, the strike, the flash and the crescent, then everything back.
  if (st.requiem) {
    const time = runtimeScene.getTimeManager ? runtimeScene.getTimeManager() : null, FREEZE = 0.0001;
    // The sequence runs on REAL seconds (the game time is frozen below, like the hit-stop does the other way round: elapsed time divided by the time scale).
    const realDt = time ? Math.min(0.05, time.getElapsedTime() / 1000 / Math.max(FREEZE, time.getTimeScale())) : dt;
    const q = st.requiem, layer = runtimeScene.getLayer(""), zoomLayers = ["Background", ""].filter(n => !runtimeScene.hasLayer || runtimeScene.hasLayer(n)).map(n => runtimeScene.getLayer(n)), W = runtimeScene.getGame().getGameResolutionWidth ? runtimeScene.getGame().getGameResolutionWidth() : 1280, H = runtimeScene.getGame().getGameResolutionHeight();
    const ZOOM = 0.3, T_IN = 0.4, SHADOW_AT = 0.5, STRIKE = 0.78, T_OUT = 1.7, END = 2.5, GAP = 95, FRAME_T = 0.117, ease = u => u * u * (3 - 2 * u);
    const cleanup = function () {
      zoomLayers.forEach((l, i) => { if (l.setCameraZoom) l.setCameraZoom((q.baseZooms && q.baseZooms[i]) || 1); });
      if (q.shadow) q.shadow.deleteFromScene(runtimeScene);
      if (time) time.setTimeScale(1);
      for (const gfx of [q.arc, q.flash]) if (gfx && gfx.destroy) gfx.destroy();
      if (!pb("IsDead")) pv.get("ControlsLocked").setBoolean(false);
      st.requiem = null;
    };
    if (!q.started) {
      q.started = true; q.realDt = realDt; q.baseZooms = zoomLayers.map(l => (l.getCameraZoom ? l.getCameraZoom() : 1));
      pv.get("ControlsLocked").setBoolean(true); pv.get("RespawnIframe").setBoolean(true); if (player.resetTimer) player.resetTimer("RespawnTimer");
    }
    q.age += realDt;
    if (time) { time.setTimeScale(FREEZE); pv.get("HitStopLeft").setNumber(0); }          // Frozen from the frame the sequence starts (a hit-stop must not end it early).
    if (pb("IsDead") || q.age >= END) cleanup();
    else {
      const zk = q.age < T_IN ? ease(q.age / T_IN) : q.age < T_OUT ? 1 : 1 - ease(Math.min(1, (q.age - T_OUT) / (END - T_OUT)));
      zoomLayers.forEach((l, i) => { if (l.setCameraZoom) l.setCameraZoom(q.baseZooms[i] * (1 + ZOOM * zk)); });   // Every layer but the UI: the floor and the backdrop are on the Background layer, and must scale with the fighters.
      if (!q.shadow && q.age >= SHADOW_AT) {                                  // The big shadow arrives beside the boss, on the player's side, and starts the cut.
        const o = runtimeScene.createObject("Player_Shadow");
        if (o) {
          const sc = player.getScaleX() * 1.6;
          o.setAnimationName("Strike"); if (o.pauseAnimation) o.pauseAnimation(); o.setScale(sc); o.setX(q.bx + q.side * GAP - o.getWidth() / 2); o.setY(player.getY() + 80 * player.getScaleX() - 80 * sc);
          o.setZOrder(player.getZOrder() + 1); if (o.flipX) o.flipX(q.side > 0); o.setOpacity(0); q.shadow = o;
        }
      }
      if (q.shadow) { const a = q.age - SHADOW_AT; if (q.shadow.setAnimationFrame) q.shadow.setAnimationFrame(Math.min(5, Math.floor(a / FRAME_T)));   // The frames are stepped by hand: the game time is frozen.
        q.shadow.setOpacity(Math.round(235 * Math.min(1, a / 0.1) * Math.min(1, Math.max(0, (1.2 - a) / 0.4)))); }
      if (!q.struck && q.age >= STRIKE) {
        q.struck = true; pv.get("RequiemSrcX").setNumber(player.getCenterXInScene()); pv.get("RequiemFire").setNumber(1);
        if (typeof PIXI !== "undefined" && PIXI.Graphics) {
          try {
            const wr = layer.getRenderer().getRendererObject(), ur = runtimeScene.getLayer("UI").getRenderer().getRendererObject();
            q.arc = new PIXI.Graphics(); q.arc.zIndex = 1000003; wr.addChild(q.arc);
            q.flash = new PIXI.Graphics(); q.flash.beginFill(0xffffff, 1); q.flash.drawRect(0, 0, W, H); q.flash.endFill(); q.flash.zIndex = 900000; ur.addChild(q.flash);
          } catch (e) { q.arc = q.flash = null; }
        }
      }
      if (q.struck) {
        const t = q.age - STRIKE;
        if (q.flash) q.flash.alpha = Math.max(0, 0.6 * (1 - t / 0.5));
        if (q.arc) {                                                          // A crescent cut by the shadow: its centre is the shadow (GAP px from the boss, at the height of his wound), its radius reaches just past the boss, so the middle of the sweep goes THROUGH him. Dark crimson with a white core, thinning as it fades.
          const sweep = Math.min(1, t / 0.22), fade = Math.max(0, 1 - t / 0.8), dir = -q.side, gfx = q.arc, cx = q.bx + q.side * GAP, R = GAP + 14;
          gfx.clear();
          for (const [w, col, al] of [[26 * fade + 2, 0xb0183c, 0.8 * fade], [9 * fade + 1, 0xffffff, 0.95 * fade]]) {
            gfx.lineStyle(w, col, al);
            for (let i = 0; i <= 14; i++) {
              const ang = -1.4 + 2.4 * sweep * i / 14, x = cx + dir * Math.cos(ang) * R, y = q.by + Math.sin(ang) * R;      // from high on the boss's side to low, toward him
              if (i === 0) gfx.moveTo(x, y); else gfx.lineTo(x, y);
            }
          }
        }
      }
    }
  }
  st.msgLeft = Math.max(0, st.msgLeft - dt);
  // The readout, bottom left: "R  Blood pact" (and "E next" when there is more than one), then the last message for a moment.
  let text = "";
  if (st.sel >= 0) text = "R  " + POWER[slots[st.sel]].name + (filled.length > 1 ? "   (tap E: next)" : "") + (st.msgLeft > 0 ? "\n" + st.msg : "");
  if (typeof PIXI !== "undefined") {
    if (!st.hud) {
      try {
        const root = runtimeScene.getLayer("UI").getRenderer().getRendererObject();
        st.hud = new PIXI.Text("", { fontFamily: "Georgia, serif", fontSize: 17, fill: 0xe8dcc0, stroke: 0x000000, strokeThickness: 3 });
        st.hud.x = 20; st.hud.y = runtimeScene.getGame().getGameResolutionHeight() - 64; st.hud.zIndex = 800000;
        root.addChild(st.hud);
      } catch (e) { st.hud = null; }
    }
    if (st.hud && st.shown !== text) { st.hud.text = text; st.shown = text; }
  }
}
