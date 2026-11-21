// Mercy: sparing a boss instead of taking its deathblow. This is the body of one script event in Combat_Shared, put there by
// tools/mercy/build.js (edit THIS file and rebuild, never the event).
//
// When a boss that can be spared is on its LAST life and is posture broken (kneeling, the same moment the deathblow orb shows),
// and the player is in deathblow range, a small "E" prompt comes up beside the orb. Holding E for HOLD seconds fills its ring and
// spares the boss: the player is locked and the boss plays its own farewell, and then it is gone, which the victory event in
// Combat_Shared turns into the usual fade back to the hub. The hub learns that the boss was spared (BossesBeaten.<scene>_Spared,
// which is saved with the rest of the progress); the number of those flags is the hidden mercy counter.
//   - Samurai: he kneels, stands, bows, and vanishes into petals (his Hidden_Ending frames).
//   - Gunslinger: a text exchange in binary: "friend?", "...", "friend!".
//   - Bladekeeper: a duel salute; the generated boss kit plays her side (tools/bosses/bladekeeper.js, spared()).
// It runs after all the events each frame (a post-events callback), so what it sets on the boss wins over the boss's own sheet.
runtimeScene.__mercy = true;
if (!gdjs.__soulRushMercy) {
  gdjs.__soulRushMercy = true;
  const HOLD = 1.0;                // seconds E has to be held
  const KEY = "e";
  const WINDOW = 7;                // seconds the kneel lasts while the choice (deathblow or mercy) is open; then the usual death scene follows
  const one = (scene, n) => { const a = scene.getObjects(n); return a && a.length ? a[0] : null; };
  const num = (v, n) => (v.has(n) ? v.get(n).getAsNumber() : 0);
  const flag = (v, n) => v.has(n) && v.get(n).getAsBoolean();
  const root = scene => { try { return typeof PIXI !== "undefined" && scene.getLayer ? scene.getLayer("").getRenderer().getRendererObject() : null; } catch (e) { return null; } };
  // Where a character really is: its hitbox, not the middle of its picture (the pictures are mostly empty above the head).
  const body = o => {
    try { const l = o.getAABBLeft(), r = o.getAABBRight(), t = o.getAABBTop(), b = o.getAABBBottom(); if ([l, r, t, b].every(Number.isFinite) && b > t) return { x: (l + r) / 2, top: t, bottom: b }; } catch (e) { /* no hitbox */ }
    return { x: o.getCenterXInScene(), top: o.getCenterYInScene() - o.getHeight() / 2, bottom: o.getCenterYInScene() + o.getHeight() / 2 };
  };
  // The camera closes in on the two of them for the farewell, with the same logic as the hub's gate cutscene: the camera glides from where
  // it is to the target and zooms with the same easing, and the zoomed view never leaves the screen the fight started with (so nothing
  // outside the arena is drawn: the camera may only move as far as the zoom leaves room for). The target is the middle between the
  // player and the boss, at body height above the floor. The fight UI is on its own layer, so it does not scale.
  const ZOOM = 1.55, ZOOM_TIME = 1.4, CAM_LIFT = 80;   // CAM_LIFT: how far above the feet the camera looks
  const layerOf = scene => { try { const l = scene.getLayer(""); return l && l.setCameraZoom ? l : null; } catch (e) { return null; } };
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  function cameraStep(st, scene, aimX, aimBottom, dt) {
    const l = layerOf(scene); if (!l) return;
    if (!st.cam) {
      const g = scene.getGame ? scene.getGame() : null;
      st.cam = { t: 0, z0: l.getCameraZoom(), x0: l.getCameraX(), y0: l.getCameraY(),
        vw: g && g.getGameResolutionWidth ? g.getGameResolutionWidth() : 1280, vh: g && g.getGameResolutionHeight ? g.getGameResolutionHeight() : 720 };
    }
    const c = st.cam; c.t = Math.min(ZOOM_TIME, c.t + dt);
    const k = c.t / ZOOM_TIME, e = k * k * (3 - 2 * k);
    const hx = c.vw / 2 * (1 - 1 / ZOOM), hy = c.vh / 2 * (1 - 1 / ZOOM);          // how far the centre may move from the start without showing past the screen
    const tx = clamp(aimX, c.x0 - hx, c.x0 + hx), ty = clamp(aimBottom - CAM_LIFT, c.y0 - hy, c.y0 + hy);
    const z = c.z0 + (ZOOM - c.z0) * e, cx = c.x0 + (tx - c.x0) * e, cy = c.y0 + (ty - c.y0) * e;
    // The ground and the sky are on the Background layer: every layer but the UI gets the same camera, or the characters would float off the floor.
    const names = []; try { scene.getAllLayerNames(names); } catch (err) { /* older runtime */ }
    if (!names.length) names.push("", "Background");
    for (const n of names) { if (n === "UI") continue; let ly = null; try { ly = scene.getLayer(n); } catch (err) { /* no such layer */ } if (ly && ly.setCameraZoom) { ly.setCameraZoom(z); ly.setCameraX(cx); ly.setCameraY(cy); } }
  }
  const bitsOf = s => Array.from(s).map(ch => ch.charCodeAt(0).toString(2).padStart(8, "0")).join(" ");

  // A speech bubble above an object: a dark box with monospaced text that types itself out, and a small decoded line under it.
  function bubble(c, who, color) {
    const r = root(c.scene); if (!r) return null;
    const box = new PIXI.Container(), g = new PIXI.Graphics();
    const txt = new PIXI.Text("", { fontFamily: "Courier New, monospace", fontSize: 15, fill: color || 0xdfe6ee, align: "center" });
    const sub = new PIXI.Text("", { fontFamily: "Georgia, serif", fontSize: 12, fill: 0x9aa3b0, align: "center", fontStyle: "italic" });
    if (txt.anchor) txt.anchor.set(0.5, 0.5); if (sub.anchor) sub.anchor.set(0.5, 0);
    box.addChild(g); box.addChild(txt); box.addChild(sub); box.zIndex = 1000002; r.addChild(box);
    const b = { box, g, txt, sub, who, text: "", lines: 1, subText: "" };
    b.place = () => { const w = body(who); box.x = w.x; box.y = w.top - 36 - (b.lines - 1) * 9; };
    b.draw = () => {
      const w = Math.max(60, (b.text.split("\n").reduce((m, l) => Math.max(m, l.length), 0)) * 9.2 + 22), h = 14 + b.lines * 19;
      g.clear(); g.beginFill(0x05070c, 0.78); g.drawRoundedRect(-w / 2, -h / 2, w, h, 6); g.endFill(); g.lineStyle(1, 0x5d6b7d, 1); g.drawRoundedRect(-w / 2, -h / 2, w, h, 6);
      sub.y = h / 2 + 3;
    };
    b.set = (text, subText) => { b.text = text; b.lines = text.split("\n").length; txt.text = text; sub.text = subText || ""; b.draw(); b.place(); };
    b.destroy = () => { if (box.destroy) box.destroy(); };
    return b;
  }

  // ---- The farewells ----------------------------------------------------------------------------------------------------
  // Each is a generator: it yields once per frame, uses c.wait / c.show, and ends by removing the boss (c.leave) or just returning.
  function* samurai(c) {
    // He is either in the seated kneel of his last-life death (Samurai_Death, DeathStep 2, waiting out DeathKneelHold) or in the crouch of a
    // posture break. He stands up from where he is, bows, the player nods back, and he bursts into petals like in his intermission.
    const b = c.boss, p = c.player, pins = new Map();
    const show = (o, anim, f) => { if (o.getAnimationName() !== anim) o.setAnimationName(anim); o.pauseAnimation(); o.setAnimationFrame(Math.max(0, Math.min(f, (o.getAnimationFrameCount ? o.getAnimationFrameCount() : f + 1) - 1))); };
    const pin = (o, anim, f) => { pins.set(o, [anim, f]); show(o, anim, f); };            // held every frame, so nothing else can change the pose
    const wait = function* (s) { while (s > 0) { for (const [o, [an, f]] of pins) show(o, an, f); yield; s -= c.dt; } };
    const seated = b.getAnimationName() === "Samurai_Death";
    if (seated) {
      pin(b, "Samurai_Death", 7); yield* wait(0.9);
      for (const f of [4, 3, 2, 1, 0]) { pin(b, "Samurai_Death", f); yield* wait(0.12); }   // the death's first frames backwards: seated to standing
    } else {
      pin(b, "Samurai_Posture_Broken", 7); yield* wait(0.9);
      for (let f = 8; f <= 11; f++) { pin(b, "Samurai_Posture_Broken", f); yield* wait(0.14); }
    }
    b.flipX(p.getCenterXInScene() < b.getCenterXInScene());                               // face the player
    p.flipX(b.getCenterXInScene() < p.getCenterXInScene());                               // and the player faces him
    yield* wait(0.4);
    const n = (show(b, "Samurai_Bow", 0), b.getAnimationFrameCount ? b.getAnimationFrameCount() : 8);
    for (let f = 0; f < n; f++) { pin(b, "Samurai_Bow", f); pin(p, "Player_Nod", Math.min(f, 7)); yield* wait(0.15); }   // he bows, the player nods with him
    pins.delete(p); p.setAnimationName("Player_Idle"); p.playAnimation();
    yield* wait(0.8);
    if (b.activateBehavior) b.activateBehavior("PlatformerObject", false);                 // as in the intermission: no physics during the petals
    const m = (show(b, "Samurai_Petal_Burst", 0), b.getAnimationFrameCount ? b.getAnimationFrameCount() : 25);
    for (let f = 0; f < m; f++) { pin(b, "Samurai_Petal_Burst", f); yield* wait(0.08); }   // he bursts into petals, straight from standing
    c.leave();
  }
  function* ranger(c) {
    // The Leaf Ranger kneels (his stun pose). He plants his last arrow in the ground in front of him; it puts out a vine, leaves and blossoms
    // (Ranger_Sprout) while he rises. The player nods to him, and he is gone in a drift of leaves (Ranger_Leaves). The sprout stays.
    const b = c.boss, p = c.player, pins = new Map();
    const show = (o, anim, f) => { if (o.getAnimationName() !== anim) o.setAnimationName(anim); o.pauseAnimation(); o.setAnimationFrame(Math.max(0, Math.min(f, (o.getAnimationFrameCount ? o.getAnimationFrameCount() : f + 1) - 1))); };
    const pin = (o, anim, f) => { pins.set(o, [anim, f]); show(o, anim, f); };            // held every frame, so his own script cannot change the pose
    const wait = function* (s) { while (s > 0) { for (const [o, [an, f]] of pins) show(o, an, f); yield; s -= c.dt; } };
    const dir = p.getCenterXInScene() < b.getCenterXInScene() ? -1 : 1;                   // toward the player
    b.flipX(dir < 0); p.flipX(dir > 0);                                                    // his sprites face right
    pin(b, "Ranger_kneel", 7); yield* wait(0.9);
    const bb = body(b), sx = bb.x + dir * 80, ground = bb.bottom;
    const sp = c.scene.createObject("Ranger_Sprout"); if (sp) { sp.setPosition(sx, ground); if (sp.setZOrder && b.getZOrder) sp.setZOrder(b.getZOrder() + 1); }
    const rise = [7, 7, 7, 6, 5, 4, 3, 2, 1, 0, 0, 0];                                   // he stays down while the arrow lands, then stands as it grows
    for (let f = 0; f < rise.length; f++) { if (sp) show(sp, "Grow", f); pin(b, "Ranger_kneel", rise[f]); yield* wait(0.12); }
    if (sp) pins.set(sp, ["Grow", rise.length - 1]);
    yield* wait(0.6);
    for (let f = 0; f < 8; f++) { pin(p, "Player_Nod", f); yield* wait(0.15); }           // the player nods to him
    pins.delete(p); p.setAnimationName("Player_Idle"); p.playAnimation();
    yield* wait(0.7);
    const lv = c.scene.createObject("Ranger_Leaves"), lb = body(b); if (lv) { lv.setPosition(lb.x, (lb.top + lb.bottom) / 2); if (lv.setZOrder && b.getZOrder) lv.setZOrder(b.getZOrder() + 2); }
    for (let f = 0; f < 12; f++) { if (lv) show(lv, "Drift", f); b.setOpacity(Math.max(0, Math.round(255 * (1 - f / 8)))); yield* wait(0.1); }   // he fades into the leaves
    c.leave();
  }
  function* gunslinger(c) {
    const b = c.boss;
    yield* c.wait(0.9);
    const you = bubble(c, c.player), him = bubble(c, b, 0xe8d9a8);
    const type = function* (bub, text, per, decoded) {
      for (let i = 1; i <= text.length; i++) { bub.set(text.slice(0, i), ""); yield* c.wait(per); }
      if (decoded) { bub.set(text, decoded); }
    };
    const wrap = s => { const w = s.split(" "); return w.slice(0, 4).join(" ") + (w.length > 4 ? "\n" + w.slice(4).join(" ") : ""); };
    if (you) { yield* type(you, wrap(bitsOf("friend?")), 0.03, "friend?"); } else yield* c.wait(2);
    yield* c.wait(1.1);
    if (him) { yield* type(him, "...", 0.35); }
    yield* c.wait(1.0);
    if (him) { yield* type(him, wrap(bitsOf("friend!")), 0.03, "friend!"); } else yield* c.wait(2);
    yield* c.wait(1.8);
    if (you) you.destroy(); if (him) him.destroy();
    for (let t = 0; t < 1; t += c.dt) { b.setOpacity(Math.round(255 * (1 - t))); yield; }   // he fades out where he sits
    c.leave();
  }
  const SPARE = {
    // ok: when the prompt may show. hold: kept up every frame of the farewell so the boss's own death script stays out of it.
    Samurai_Fight: { obj: "Samurai_NPC", run: samurai, ok: v => num(v, "DeathStep") <= 2, hold: v => { if (v.has("DeathStep")) v.get("DeathStep").setNumber(99); } },
    Gunslinger: { obj: "Gunslinger_NPC", run: gunslinger },
    Leaf_Ranger_Fight: { obj: "Leaf_Ranger", run: ranger },
    Bladekeeper_Fight: { obj: "Bladekeeper", kit: true }
  };

  gdjs.registerRuntimeScenePostEventsCallback(function (scene) {
    if (!scene.__mercy) return;
    const S = SPARE[scene.getName()]; if (!S) return;
    const st = scene.__mercyState || (scene.__mercyState = { hold: 0, phase: "idle", ring: null, gen: null, c: null });
    // The fight's own scripts reset the camera every frame (the arena lift), so after the farewell (boss gone, the victory fade running) this
    // callback keeps setting the zoomed camera where it was, until the scene ends; or it would snap back for the length of the fade.
    const keepCamera = () => { if (st.cam && st.aim) cameraStep(st, scene, st.aim.x, st.aim.bottom, Math.min(0.05, scene.getElapsedTime() / 1000)); };
    if (st.phase === "done") { keepCamera(); return; }
    const boss = one(scene, S.obj), player = one(scene, "Player");
    if (!boss || !player) { if (st.phase === "run") { st.phase = "done"; if (st.ring) { st.ring.destroy(); st.ring = null; } } keepCamera(); return; }
    const dt = Math.min(0.05, scene.getElapsedTime() / 1000);
    const bv = boss.getVariables(), pv = player.getVariables();
    const input = gdjs.evtTools && gdjs.evtTools.input;

    if (st.phase === "idle") {
      const dist = Math.hypot(player.getCenterXInScene() - boss.getCenterXInScene(), player.getCenterYInScene() - boss.getCenterYInScene());
      const can = Math.round(num(bv, "Lives")) <= 1 && flag(bv, "IsPostureBroken") && num(bv, "BarMode") === 0 && !flag(pv, "IsDeathblow") && !flag(pv, "ControlsLocked")
        && !flag(pv, "IsDead") && !flag(pv, "IsPostureBroken") && dist <= num(pv, "DeathblowRange") && (!S.ok || S.ok(bv));
      // The choice is open: the kneel lasts WINDOW seconds (the stun, or the Samurai's death kneel) before the usual death scene.
      if (can && !st.windowed) { st.windowed = true; for (const n of ["StunDuration", "DeathKneelHold"]) if (bv.has(n) && num(bv, n) < WINDOW) bv.get(n).setNumber(WINDOW); }
      const held = !!input && input.isKeyPressed(scene, KEY);
      st.hold = can && held ? st.hold + dt : Math.max(0, st.hold - dt * 2);
      // The prompt: a boxed E with a ring that fills while it is held, beside the deathblow orb.
      const r = root(scene);
      if (can && r && !st.ring) {
        const box = new PIXI.Container(), g = new PIXI.Graphics(), t = new PIXI.Text("E", { fontFamily: "Georgia, serif", fontSize: 22, fill: 0xffffff });
        if (t.anchor) t.anchor.set(0.5); box.addChild(g); box.addChild(t); box.zIndex = 1000001; r.addChild(box); st.ring = { box, g };
        st.ring.destroy = () => { if (box.destroy) box.destroy(); };
      }
      if (st.ring) {
        st.ring.box.visible = can;
        if (can) {
          const g = st.ring.g, p = Math.min(1, st.hold / HOLD);
          st.ring.box.x = boss.getCenterXInScene() + 62; st.ring.box.y = boss.getCenterYInScene() - boss.getHeight() / 2 - 44 + Math.sin(performance.now() / 260) * 3;
          g.clear(); g.beginFill(0x000000, 0.65); g.drawCircle(0, 0, 21); g.endFill(); g.lineStyle(3, 0xffffff, 0.22); g.drawCircle(0, 0, 21);
          if (p > 0) { g.lineStyle(3, 0xd9c27a, 1); g.arc(0, 0, 21, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); }
        }
      }
      if (st.hold >= HOLD) {                                                   // mercy: committed
        st.phase = "run";
        for (const n of ["IsAttacking", "IsDeflecting", "IsRolling", "IsLunging", "AllowCombo", "RollQueued", "DeflectQueued", "IsHurt"]) if (pv.has(n)) pv.get(n).setBoolean(false);
        pv.get("ControlsLocked").setBoolean(true); if (pv.has("Iframe")) pv.get("Iframe").setBoolean(true);
        scene.getGame().getVariables().get("BossesBeaten").getChild(scene.getName() + "_Spared").setBoolean(true);
        if (st.ring) { st.ring.destroy(); st.ring = null; }
        if (S.kit) { if (bv.has("Spared")) bv.get("Spared").setNumber(1); }   // the boss's own script plays the farewell
        else {
          if (bv.has("AIPaused")) bv.get("AIPaused").setBoolean(true);
          if (S.hold) S.hold(bv);
          st.c = { scene, boss, player, dt, leave() { boss.deleteFromScene(scene); st.phase = "done"; }, *wait(s) { while (s > 0) { yield; s -= st.c.dt; } } };
          st.gen = S.run(st.c);
        }
      }
      return;
    }
    // Running. Keep the boss where it is (still stunned, unhurtable, its AI paused) and hide the deathblow orb, then step the farewell.
    const orb = one(scene, "Deathblow_Prompt"); if (orb) orb.hide(true);
    const pb = body(player); st.aim = { x: (body(boss).x + pb.x) / 2, bottom: pb.bottom };   // remembered: the camera must stay put after the boss is gone
    cameraStep(st, scene, st.aim.x, st.aim.bottom, dt);
    if (S.kit) { if (!boss) st.phase = "done"; return; }
    if (S.hold) S.hold(bv);
    if (bv.has("IsPostureBroken")) bv.get("IsPostureBroken").setBoolean(true);
    if (bv.has("Invulnerable")) bv.get("Invulnerable").setBoolean(true);
    if (boss.resetTimer) boss.resetTimer("StunTimer");
    if (pv.has("ControlsLocked")) pv.get("ControlsLocked").setBoolean(true);
    st.c.dt = dt;
    if (st.gen && st.phase === "run") { const r = st.gen.next(); if (r.done) st.phase = "done"; }
  });
}
