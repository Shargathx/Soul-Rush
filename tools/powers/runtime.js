// Powers in a fight (docs/design-brand-mercy.md, phase 4, slice 2). One script event in Combat_Shared, every frame. The hub works out the
// loadout and writes it into the globals LoadoutSlot1 to LoadoutSlot3 (tools/powers/powers.js, the altar screen picks them). Here:
//   R        uses the SELECTED power (the first filled slot at the start of a fight).
//   E (tap)  selects the next filled slot. A tap is a press shorter than a quarter of a second, so the mercy hold (one second) never counts.
//   U        (debug; it must not be J or K: those are the player's attack and deflect) toggles UNLIMITED actives: Requiem with no once-per-fight limit and at any boss HP, Bloom even at full HP, and no cooldowns at all (Poison stab, Blood pact, Bloom); range and vulnerability still count.
//   X        (debug) puts the next built active in slot 1 for this fight (Blood pact, Requiem, Poison stab, Bloom, then round again), to try them without earning them.
// The tutorial and the hub are exempt: no powers there. The selected power and a message show bottom left. Each power below says what it
// needs and does; paying in HP goes through Player.SacrificeHP (an event in this sheet takes it off, never kills, and rally cannot win it back).
const EXEMPT = ["Tutorial_Level", "HUB_Area"];
const players = runtimeScene.getObjects("Player");
if (players.length && !EXEMPT.includes(runtimeScene.getName())) {
  const player = players[0], pv = player.getVariables(), g = runtimeScene.getGame().getVariables(), input = gdjs.evtTools.input;
  const st = runtimeScene.__powers || (runtimeScene.__powers = { sel: -1, eDown: 0, cool: {}, msg: "", msgLeft: 0, hud: null, shown: "" });
  const dt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000);
  const pn = k => pv.get(k).getAsNumber(), pb = k => pv.get(k).getAsBoolean();
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
    const ids = ["blood_pact", "requiem", "poison_stab", "bloom"].filter(i => POWER[i]), now = ids.indexOf(g.get("LoadoutSlot1").getAsString());   // (add each new built active here)
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
  // Bloom's sequence (see its entry above): the arrow drops from his hand into the ground (PLANT s), the flowers open, and the patch heals for BloomTime s.
  if (st.bloom) {
    const q = st.bloom, PLANT = 0.18, FADE = 0.5, DROP = 70, life = pn("BloomTime"), radius = pn("BloomRadius"), end = PLANT + life;
    const cleanup = function () {
      if (q.arrow) q.arrow.deleteFromScene(runtimeScene);
      for (const o of [q.gfx, q.text]) if (o && o.destroy) o.destroy();
      st.bloom = null;
    };
    if (!q.started) {
      q.started = true;
      const o = runtimeScene.createObject("Player_Bloom");
      if (o) { o.setAnimationName("Fly"); o.setX(q.x); o.setY(q.y - DROP); o.setZOrder(player.getZOrder() - 1); q.arrow = o; }
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
      if (q.arrow) {
        if (q.age < PLANT) q.arrow.setY(q.y - DROP * (1 - (q.age / PLANT) * (q.age / PLANT)));               // Faster as it goes: driven in, not dropped.
        else { if (!q.planted) { q.planted = true; q.arrow.setAnimationName("Grow"); q.arrow.setY(q.y); } q.arrow.setOpacity(Math.round(255 * Math.min(1, Math.max(0, (end + FADE - q.age) / FADE)))); }
      }
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
