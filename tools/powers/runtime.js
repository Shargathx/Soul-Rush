// Powers in a fight (docs/design-brand-mercy.md, phase 4, slice 2). One script event in Combat_Shared, every frame. The hub works out the
// loadout and writes it into the globals LoadoutSlot1 to LoadoutSlot3 (tools/powers/powers.js, the altar screen picks them). Here:
//   R        uses the SELECTED power (the first filled slot at the start of a fight).
//   E (tap)  selects the next filled slot. A tap is a press shorter than a quarter of a second, so the mercy hold (one second) never counts.
//   J        (debug) toggles Requiem unlimited: no once-per-fight limit and any boss HP (range and vulnerability still count).
//   X        (debug) puts the next built active in slot 1 for this fight (Blood pact, then Requiem, then round again), to try them without earning them.
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
    const ids = ["blood_pact", "requiem"].filter(i => POWER[i]), now = ids.indexOf(g.get("LoadoutSlot1").getAsString());   // (add each new built active here)
    g.get("LoadoutSlot1").setString(ids[(now + 1) % ids.length]);
  }
  if (input.wasKeyJustPressed(runtimeScene, "j")) { st.requiemDebug = !st.requiemDebug; st.msg = "Debug: Requiem unlimited " + (st.requiemDebug ? "ON (any HP, as often as you like)" : "OFF"); st.msgLeft = 2.5; }
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
    else if ((st.cool[id] || 0) > 0) { /* still cooling down */ }
    else { const msg = p.use(); if (msg) { st.msg = msg; st.msgLeft = 1.4; if (!msg.startsWith("Too")) st.cool[id] = p.cooldown; } }
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
