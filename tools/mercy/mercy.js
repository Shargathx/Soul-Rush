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
  const one = (scene, n) => { const a = scene.getObjects(n); return a && a.length ? a[0] : null; };
  const num = (v, n) => (v.has(n) ? v.get(n).getAsNumber() : 0);
  const flag = (v, n) => v.has(n) && v.get(n).getAsBoolean();
  const root = scene => { try { return typeof PIXI !== "undefined" && scene.getLayer ? scene.getLayer("").getRenderer().getRendererObject() : null; } catch (e) { return null; } };
  // The camera closes in on the two of them for the farewell: an ease to ZOOM over ZOOM_TIME seconds, then it keeps following the
  // midpoint between the player and the boss (the fight UI is on its own layer, so it does not scale). The scene ends afterwards.
  const ZOOM = 1.55, ZOOM_TIME = 1.4;
  const layerOf = scene => { try { const l = scene.getLayer(""); return l && l.setCameraZoom ? l : null; } catch (e) { return null; } };
  function cameraStep(st, scene, boss, player, dt) {
    const l = layerOf(scene); if (!l) return;
    if (!st.cam) st.cam = { t: 0, z0: l.getCameraZoom(), x: l.getCameraX(), y: l.getCameraY() };
    const c = st.cam; c.t = Math.min(ZOOM_TIME, c.t + dt);
    const k = c.t / ZOOM_TIME, e = k * k * (3 - 2 * k);
    const tx = (boss.getCenterXInScene() + player.getCenterXInScene()) / 2, ty = (boss.getCenterYInScene() + player.getCenterYInScene()) / 2;
    const f = Math.min(1, dt * 4); c.x += (tx - c.x) * f; c.y += (ty - c.y) * f;
    l.setCameraZoom(c.z0 + (ZOOM - c.z0) * e); l.setCameraX(c.x); l.setCameraY(c.y);
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
    b.place = () => { box.x = who.getCenterXInScene(); box.y = who.getCenterYInScene() - who.getHeight() / 2 - 40 - (b.lines - 1) * 9; };
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
    const b = c.boss, show = (anim, f) => { if (b.getAnimationName() !== anim) b.setAnimationName(anim); b.pauseAnimation(); b.setAnimationFrame(Math.max(0, Math.min(f, (b.getAnimationFrameCount ? b.getAnimationFrameCount() : f + 1) - 1))); };
    show("Samurai_Posture_Broken", 7); yield* c.wait(0.9);                        // kneeling, as in his stun (frame 7 is its kneeling frame)
    for (let f = 8; f <= 11; f++) { show("Samurai_Posture_Broken", f); yield* c.wait(0.14); }   // the get-up frames of the same stun
    b.flipX(c.player.getCenterXInScene() < b.getCenterXInScene());               // face the player
    yield* c.wait(0.4);
    const n = b.getAnimationFrameCount ? (show("Samurai_Bow", 0), b.getAnimationFrameCount()) : 8;
    for (let f = 0; f < n; f++) { show("Samurai_Bow", f); yield* c.wait(0.15); }  // the bow (his own opening bow)
    yield* c.wait(0.8);
    const m = b.getAnimationFrameCount ? (show("Samurai_Hidden_Ending", 0), b.getAnimationFrameCount()) : 44;
    for (let f = 0; f < m; f++) { show("Samurai_Hidden_Ending", f); yield* c.wait(0.07); }   // he dissolves into petals
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
    Samurai_Fight: { obj: "Samurai_NPC", run: samurai },
    Gunslinger: { obj: "Gunslinger_NPC", run: gunslinger },
    Bladekeeper_Fight: { obj: "Bladekeeper", kit: true }
  };

  gdjs.registerRuntimeScenePostEventsCallback(function (scene) {
    if (!scene.__mercy) return;
    const S = SPARE[scene.getName()]; if (!S) return;
    const st = scene.__mercyState || (scene.__mercyState = { hold: 0, phase: "idle", ring: null, gen: null, c: null });
    if (st.phase === "done") return;
    const boss = one(scene, S.obj), player = one(scene, "Player");
    if (!boss || !player) { if (st.phase === "run") { st.phase = "done"; if (st.ring) { st.ring.destroy(); st.ring = null; } } return; }
    const dt = Math.min(0.05, scene.getElapsedTime() / 1000);
    const bv = boss.getVariables(), pv = player.getVariables();
    const input = gdjs.evtTools && gdjs.evtTools.input;

    if (st.phase === "idle") {
      const dist = Math.hypot(player.getCenterXInScene() - boss.getCenterXInScene(), player.getCenterYInScene() - boss.getCenterYInScene());
      const can = Math.round(num(bv, "Lives")) <= 1 && flag(bv, "IsPostureBroken") && num(bv, "BarMode") === 0 && !flag(pv, "IsDeathblow") && !flag(pv, "ControlsLocked")
        && !flag(pv, "IsDead") && !flag(pv, "IsPostureBroken") && dist <= num(pv, "DeathblowRange");
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
          st.c = { scene, boss, player, dt, leave() { boss.deleteFromScene(scene); st.phase = "done"; }, *wait(s) { while (s > 0) { yield; s -= st.c.dt; } } };
          st.gen = S.run(st.c);
        }
      }
      return;
    }
    // Running. Keep the boss where it is (still stunned, unhurtable, its AI paused) and hide the deathblow orb, then step the farewell.
    const orb = one(scene, "Deathblow_Prompt"); if (orb) orb.hide(true);
    cameraStep(st, scene, boss, player, dt);
    if (S.kit) { if (!boss) st.phase = "done"; return; }
    if (bv.has("IsPostureBroken")) bv.get("IsPostureBroken").setBoolean(true);
    if (bv.has("Invulnerable")) bv.get("Invulnerable").setBoolean(true);
    if (boss.resetTimer) boss.resetTimer("StunTimer");
    if (pv.has("ControlsLocked")) pv.get("ControlsLocked").setBoolean(true);
    st.c.dt = dt;
    if (st.gen && st.phase === "run") { const r = st.gen.next(); if (r.done) st.phase = "done"; }
  });
}
