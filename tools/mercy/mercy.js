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
//   - Necromancer: the curse lifts. Green ghosts climb out of the graveyard, he stands, and he, the ghosts and the arena all turn
//     a calm blue-white; then the ghosts drift up and fade, and so does he: they can rest now.
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
    // The Leaf Ranger kneels (his stun pose), rises, and does his volley (the arrow rain, Ranger_3_atk; the volley goes up on frame 9).
    // Three arrows come down out of the sky at high speed, one after another and from different heights, onto spots with room (never within
    // 90 px of the player); each takes root and blooms (Ranger_Sprout, Fly then Grow). The player nods to him while the last one blooms; when
    // it has bloomed he dissolves into leaves (Ranger_Dissolve) from the head down and is gone. The sprouts stay.
    const b = c.boss, p = c.player, pins = new Map(), sm = c.scene.getGame().getSoundManager();
    const show = (o, anim, f) => { if (o.getAnimationName() !== anim) o.setAnimationName(anim); o.pauseAnimation(); o.setAnimationFrame(Math.max(0, Math.min(f, (o.getAnimationFrameCount ? o.getAnimationFrameCount() : f + 1) - 1))); };
    const pin = (o, anim, f) => { pins.set(o, [anim, f]); show(o, anim, f); };            // held every frame, so his own script cannot change the pose
    const sound = (f, v) => { try { sm.playSound(f, false, v, 1); } catch (e) { /* no sound */ } };
    // His own sounds (runtimeScene.__lrSfx, made by his sheet): the draw, a spread of releases and the whoosh as the volley goes up, a landing
    // for each arrow; the plain files if his helper is not there.
    const lr = c.scene.__lrSfx, sfx = {
      draw: () => (lr ? lr.play("draw") : sound("assets/Sfx/arrows/draw_1.wav", 45)),
      volley: () => { if (lr) { lr.spread(4, 0.06); lr.play("fall"); } else { for (let k = 0; k < 4; k++) sound("assets/Sfx/arrows/release_" + (1 + k) + ".wav", 60 - k * 8); } },
      land: () => (lr ? lr.play("land") : sound("assets/Sfx/arrows/land_1.wav", 60))
    };
    const dir = p.getCenterXInScene() < b.getCenterXInScene() ? -1 : 1;                   // toward the player
    b.flipX(dir < 0); p.flipX(dir > 0);                                                    // his sprites face right
    const bb = body(b), px = body(p).x, ground = bb.bottom, W = c.scene.getGame().getGameResolutionWidth ? c.scene.getGame().getGameResolutionWidth() : 1280;
    // Three spots with room, nearest to him first: behind him, then further, then past the player's side if the arena is short.
    const spots = [];
    for (const off of [-75, -150, -225, 205, 290, -300, 375]) { const x = bb.x + dir * off; if (spots.length < 3 && Math.abs(x - px) >= 90 && x > 60 && x < W - 60 && spots.every(q => Math.abs(q - x) >= 70)) spots.push(x); }
    while (spots.length < 3) spots.push(bb.x - dir * (75 * (spots.length + 1)));
    // The arrows: each has a delay (one after another), a start height (different levels) and falls at 3000 px/s; then it blooms (12 frames).
    const arrows = spots.map((sx, i) => {
      const ar = c.scene.createObject("Ranger_Sprout");
      if (ar) { if (ar.setZOrder && b.getZOrder) ar.setZOrder(b.getZOrder() + 1); show(ar, "Fly", 0); ar.setPosition(sx, ground - 800 - i * 260); ar.hide(true); }
      return { ar, sx, y: ground - 800 - i * 260, delay: i * 0.4, t: 0, released: false, landed: false, g: 0, bloomed: false };
    });
    // His idle (Ranger_idle, 12 frames, 0.1 s each, as in the fight): runs on its own clock while idle.on, so he breathes while he waits.
    const idle = { on: false, t: 0, n: 12, dt: 0.1 };
    const nod = { on: false, t: 0 };                                                       // the player's nod (Player_Nod, 8 frames of 0.15 s), on its own clock
    const idleFrame = () => Math.floor(idle.t / idle.dt) % idle.n;
    const tick = () => {
      if (idle.on) { idle.t += c.dt; pins.set(b, ["Ranger_idle", idleFrame()]); }
      if (nod.on) { nod.t += c.dt; const f = Math.floor(nod.t / 0.15); if (f >= 8) { nod.on = false; pins.delete(p); p.setAnimationName("Player_Idle"); p.playAnimation(); } else pins.set(p, ["Player_Nod", f]); }
      for (const a of arrows) {
        if (!a.released || !a.ar) continue;
        a.t += c.dt; if (a.t < a.delay) continue;
        if (!a.landed) { a.ar.hide(false); a.y = Math.min(ground, a.y + 3000 * c.dt); a.ar.setPosition(a.sx, a.y); if (a.y >= ground) { a.landed = true; sfx.land(); } }
        else if (!a.bloomed) { a.g += c.dt; show(a.ar, "Grow", Math.min(11, Math.floor(a.g / 0.12))); if (a.g >= 12 * 0.12) { a.bloomed = true; pins.set(a.ar, ["Grow", 11]); } }
      }
    };
    const wait = function* (s) { while (s > 0) { for (const [o, [an, f]] of pins) show(o, an, f); tick(); yield; s -= c.dt; } };
    pin(b, "Ranger_kneel", 7); yield* wait(0.8);
    // He gets up. Not his kneel played backwards (its frames 1 and 2 are the leap with the cloak flung out, which makes a rigid, flying rise):
    // his arm reaches down, takes the bow and lifts it (Ranger_BowGrab, tools/fx/ranger_grab.js: in his kneel animation the bow jumps from the
    // ground into his hand), he comes out of the kneel (frames 5 to 3, slowly at first), comes up through the crouch of his landing recovery (Ranger_jump_full 20,
    // 21) and settles standing (Ranger_idle 0), each step a little quicker than the one before.
    for (const [an, f, t] of [["Ranger_BowGrab", 0, 0.16], ["Ranger_BowGrab", 1, 0.13], ["Ranger_kneel", 5, 0.14], ["Ranger_kneel", 4, 0.12], ["Ranger_kneel", 3, 0.11], ["Ranger_jump_full", 20, 0.1], ["Ranger_jump_full", 21, 0.1], ["Ranger_idle", 0, 0.1]]) { pin(b, an, f); yield* wait(t); }
    idle.on = true; idle.t = 0; yield* wait(0.45); idle.on = false;                          // standing a moment, breathing
    sfx.draw();
    const n = (show(b, "Ranger_3_atk", 0), b.getAnimationFrameCount ? b.getAnimationFrameCount() : 12);
    for (let f = 0; f < n; f++) { pin(b, "Ranger_3_atk", f); if (f === 9) { for (const a of arrows) a.released = true; sfx.volley(); } yield* wait(0.08); }   // the volley goes up on frame 9
    // The volley is cast: he idles while the arrows come down. The idle clock is set so that his idle frame 0 (the frame the dissolve is made
    // from) comes just as the last arrow lands: that is when he starts to disappear.
    const last = arrows[arrows.length - 1], cycle = idle.n * idle.dt, rem = Math.max(0, last.delay - last.t) + Math.max(0, ground - last.y) / 3000;
    idle.on = true; idle.t = (((cycle - rem) % cycle) + cycle) % cycle;
    while (!arrows.every(a => a.landed)) yield* wait(c.dt);                                // the last arrow comes down and starts to bloom...
    nod.on = true; nod.t = 0;                                                               // ...the player nods to him...
    for (let k = 0; k < 14 && idleFrame() > 1 && idleFrame() < idle.n - 1; k++) yield* wait(c.dt);   // (a frame or two off his idle frame 0 at most: wait for it)
    idle.on = false; pin(b, "Ranger_idle", 0);                                              // ...and he starts to disappear at once
    // He dissolves into leaves, like the Samurai into petals: an animation of his own (Ranger_Dissolve, tools/fx/ranger_dissolve.js) that
    // takes his idle frame 0 to pieces from the head down and ends empty. It starts when the last arrow starts to bloom; the arrows and the nod carry on during it. No physics meanwhile, as in the Samurai's intermission.
    if (b.activateBehavior) b.activateBehavior("PlatformerObject", false);
    const nd = (show(b, "Ranger_Dissolve", 0), b.getAnimationFrameCount ? b.getAnimationFrameCount() : 34);
    for (let f = 0; f < nd; f++) { pin(b, "Ranger_Dissolve", f); yield* wait(0.07); }
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
  function* necromancer(c) {
    // He is kneeling (the held last frame of Hurt, his stun pose). The ghosts of the graveyard climb out of the ground across the arena, green
    // like his curse. He gets up (Hurt backwards) and stands (Idle), facing the player; the player nods. Then the curse lifts: over PEACE
    // seconds he, his outline, the ghosts, the fireflies and the arena turn from their phase colours to a calm blue-white. The ghosts drift up
    // and fade one by one, and he fades last, rising a little. Then he is gone.
    const b = c.boss, p = c.player, pins = new Map(), sm = c.scene.getGame().getSoundManager();
    const show = (o, anim, f) => { if (o.getAnimationName() !== anim) o.setAnimationName(anim); o.pauseAnimation(); o.setAnimationFrame(Math.max(0, Math.min(f, (o.getAnimationFrameCount ? o.getAnimationFrameCount() : f + 1) - 1))); };
    const pin = (o, anim, f) => { pins.set(o, [anim, f]); show(o, anim, f); };            // held every frame, so his own sheet cannot change the pose
    const sound = (f, v) => { try { sm.playSound(f, false, v, 1); } catch (e) { /* no sound */ } };
    const lerp = (a, z, k) => a.map((v, i) => Math.round(v + (z[i] - v) * k));
    const hex = col => (col[0] << 16) | (col[1] << 8) | col[2];
    const GREEN = [120, 255, 150], BLUE = [190, 225, 255];                                   // a ghost's colour: his curse, then at rest
    const SELF_TO = [200, 225, 255], OUTLINE_TO = [150, 200, 255], ARENA_TO = [170, 190, 235];
    const ARENA = ["Grave_Sky", "Grave_Moon", "Grave_Mountains", "Grave_Fog_Back", "Grave_Arch_Wall", "Grave_Pillar", "Grave_Tree", "Grave_Tree_B", "Grave_Fence", "Grave_Angel",
      "Grave_Obelisk", "Grave_Tombstone", "Grave_Knight", "Grave_Lamp", "Grave_Round", "Grave_Cross", "Grave_Plaque", "Grave_Small", "Grave_Mound", "Grave_Fog_Front", "Grave_Ground", "Grave_Far", "Grave_Moon_Glow"];
    // Where the colours start: his phase (BgMix 0 green, 1 red), as his own Phase colours script sets them.
    const bv = b.getVariables(), mix0 = Math.max(0, Math.min(1, num(bv, "BgMix")));
    const arena0 = lerp([190, 235, 195], [255, 112, 112], mix0), outline0 = lerp([70, 190, 110], [220, 50, 50], mix0), fx0 = lerp([120, 255, 150], [255, 70, 70], mix0);
    let peace = 0, selfAlpha = 1, selfLift = 0;
    const y0 = b.getY();
    // His sprite is dark (a black cloak, red eyes and flame), so a tint alone cannot make him pale: a colour matrix (PixiJS's ColorMatrixFilter,
    // put in front of his Outline effect so the outline goes round the new colours) blends him from his own colours (identity) to a blue-white
    // spirit (each colour becomes its brightness, lifted toward pale blue). Without PixiJS (or its filters) the plain tint is all there is.
    const LUM = [0.3, 0.55, 0.15], SPIRIT = [[0.55, 140], [0.6, 165], [0.6, 205]];        // per channel: brightness weight, lift (in 0-255, written as 0-1)
    let cm = null;
    try {
      const ro = b.getRendererObject ? b.getRendererObject() : null, CM = typeof PIXI !== "undefined" && ((PIXI.filters && PIXI.filters.ColorMatrixFilter) || PIXI.ColorMatrixFilter);
      if (ro && CM) { cm = new CM(); ro.filters = [cm].concat(ro.filters || []); }
    } catch (e) { cm = null; }
    const spirit = k => {
      if (!cm) return;
      const m = [];
      for (let ch = 0; ch < 3; ch++) { for (let i = 0; i < 3; i++) m.push((i === ch ? 1 : 0) * (1 - k) + SPIRIT[ch][0] * LUM[i] * k); m.push(0, SPIRIT[ch][1] / 255 * k); }   // the matrix setter takes the offset as 0-1 (only _loadMatrix divides by 255)
      m.push(0, 0, 0, 1, 0);
      cm.matrix = m;
    };
    const paint = () => {
      spirit(peace);
      b.setColor(lerp([255, 255, 255], SELF_TO, peace).join(";"));
      if (b.setEffectStringParameter) b.setEffectStringParameter("Outline", "color", lerp(outline0, OUTLINE_TO, peace).join(";"));
      const ar = lerp(arena0, ARENA_TO, peace).join(";");
      for (const n of ARENA) for (const o of c.scene.getObjects(n) || []) o.setColor(ar);
      const flies = c.scene.__arena && c.scene.__arena.flies; if (flies) for (const f of flies) f.s.tint = hex(lerp(fx0, BLUE, peace));
      b.setOpacity(Math.round(255 * selfAlpha)); b.setY(y0 - selfLift);
    };
    // The ghosts: small pixel spirits (3 px pixels, like his sprite), drawn on the scene's layer. 12 x 17 cells: a round head, two eyes,
    // a body that narrows to a curling tail that wags. Each rises out of the ground (clipped there), hovers bobbing, and later drifts up and fades.
    const PX = 3, GW = 12, GH = 17;
    const SHAPE = ["....####....", "..########..", ".##########.", ".##########.", "###..##..###", "###..##..###", "############", "############",
      "############", "############", ".###########", ".##########.", "..#########.", "...#######..", "....#####...", "......###...", "........##.."];
    const r = root(c.scene), feet = body(p).bottom, bx = body(b).x;
    const ghosts = [];
    if (r) {
      const xs = [];
      for (let k = 0; k < 9; k++) { const x = 170 + k * 120 + ((k * 37) % 23) - 11; if (Math.abs(x - body(p).x) > 70 && Math.abs(x - bx) > 90) xs.push(x); }
      xs.forEach((x, i) => {
        const g = new PIXI.Graphics(); g.zIndex = 1000000; r.addChild(g);
        ghosts.push({ g, x, delay: i * 0.18 + ((i * 7) % 3) * 0.05, t: 0, rise: 0, hover: 54 + (i % 3) * 18, phase: i * 1.3, alpha: 0, up: 0, out: false, outT: 0, outDelay: 0 });
      });
    }
    const drawGhost = (gh, col) => {
      const g = gh.g; g.clear();
      const wag = Math.floor((c.scene.__mercyT || 0) * 6 + gh.phase) % 2;
      const top = feet - gh.rise - Math.sin((c.scene.__mercyT || 0) * 2.2 + gh.phase) * 4 - gh.up;
      for (let yy = 0; yy < GH; yy++) {
        const row = SHAPE[yy], py = top + (yy - GH) * PX;
        if (py + PX > feet) continue;                                                     // under the ground: not out yet
        const shift = yy >= GH - 3 ? (wag ? 1 : -1) * (yy - (GH - 4)) * 0.5 : 0;           // the tail wags
        for (let xx = 0; xx < GW; xx++) {
          const ch = row[xx];                                                              // "#" body, "." air (or an eye, rows 4 and 5)
          if (ch === "#") { g.beginFill(hex(col), gh.alpha * (yy < 2 ? 0.75 : 0.9)); g.drawRect(gh.x + (xx - GW / 2 + shift) * PX, py, PX, PX); g.endFill(); }
          else if ((yy === 4 || yy === 5) && (xx === 3 || xx === 4 || xx === 7 || xx === 8)) { g.beginFill(0x0a1410, gh.alpha); g.drawRect(gh.x + (xx - GW / 2) * PX, py, PX, PX); g.endFill(); }
        }
      }
    };
    let T = 0;
    const tick = () => {
      T += c.dt; c.scene.__mercyT = T;
      const col = lerp(GREEN, BLUE, peace);
      for (const gh of ghosts) {
        gh.t += c.dt; if (gh.t < gh.delay) continue;
        if (!gh.out) { gh.rise = Math.min(gh.hover, gh.rise + c.dt * 75); gh.alpha = Math.min(0.85, gh.alpha + c.dt * 1.4); }
        else { gh.outT += c.dt; if (gh.outT > gh.outDelay) { gh.up += c.dt * 55; gh.alpha = Math.max(0, gh.alpha - c.dt * 0.55); } }
        drawGhost(gh, col);
      }
      paint();
    };
    const wait = function* (s) { while (s > 0) { for (const [o, [an, f]] of pins) show(o, an, f); tick(); yield; s -= c.dt; } };
    pin(b, "Hurt", 4); yield* wait(0.7);
    sound("assets/Sfx/necro/necro_call.wav", 35);                                          // the dead stir
    yield* wait(1.6);                                                                       // the ghosts climb out around them
    for (const f of [3, 2, 1, 0]) { pin(b, "Hurt", f); yield* wait(0.12); }                // he gets up
    b.flipX(p.getCenterXInScene() < b.getCenterXInScene()); p.flipX(b.getCenterXInScene() < p.getCenterXInScene());   // (his sprites face right)
    let idleT = 0;
    const idle = function* (s) { while (s > 0) { idleT += c.dt; pins.set(b, ["Idle", Math.floor(idleT / 0.12) % 8]); yield* wait(c.dt); s -= c.dt; } };
    yield* idle(0.5);
    // The curse lifts, and the player nods to him while it does.
    for (let t = 0; t < 2.2; t += c.dt) {
      const u = Math.min(1, t / 2.2); peace = u * u * (3 - 2 * u);
      const nf = Math.floor(t / 0.15); if (nf < 8) pins.set(p, ["Player_Nod", nf]); else if (pins.has(p)) { pins.delete(p); p.setAnimationName("Player_Idle"); p.playAnimation(); }
      yield* idle(c.dt);
    }
    peace = 1; if (pins.has(p)) { pins.delete(p); p.setAnimationName("Player_Idle"); p.playAnimation(); }
    yield* idle(0.8);
    // At rest: the ghosts drift up and fade one after another (the nearest to him last), then he follows them.
    ghosts.slice().sort((g1, g2) => Math.abs(g2.x - bx) - Math.abs(g1.x - bx)).forEach((gh, i) => { gh.out = true; gh.outT = 0; gh.outDelay = i * 0.22; });
    yield* idle(1.4);
    for (let t = 0; t < 2.4; t += c.dt) { selfAlpha = 1 - t / 2.4; selfLift = 40 * (t / 2.4); yield* idle(c.dt); }
    while (ghosts.some(gh => gh.alpha > 0.01)) yield* idle(c.dt);
    selfAlpha = 0; paint();
    try { const ro = b.getRendererObject ? b.getRendererObject() : null; if (ro && cm && ro.filters) ro.filters = ro.filters.filter(x => x !== cm); } catch (e) { /* gone already */ }
    for (const gh of ghosts) if (gh.g.destroy) gh.g.destroy();
    c.leave();
  }
  const SPARE = {
    // ok: when the prompt may show. hold: kept up every frame of the farewell so the boss's own death script stays out of it.
    // prep: puts the boss into its kneel for the debug key.
    Samurai_Fight: { obj: "Samurai_NPC", run: samurai, ok: v => num(v, "DeathStep") <= 2, prep: (o, v) => { if (v.has("AIState")) v.get("AIState").setString("Dead"); o.setAnimationName("Samurai_Posture_Broken"); }, hold: v => { if (v.has("DeathStep")) v.get("DeathStep").setNumber(99); } },
    Gunslinger: { obj: "Gunslinger_NPC", run: gunslinger },
    Leaf_Ranger_Fight: { obj: "Leaf_Ranger", run: ranger, prep: (o, v) => { if (v.has("AIState")) v.get("AIState").setString("Stunned"); o.setAnimationName("Ranger_kneel"); } },
    Bladekeeper_Fight: { obj: "Bladekeeper", kit: true },
    Boss_Necromancer: { obj: "Necromancer", run: necromancer, prep: (o, v) => { if (v.has("AIState")) v.get("AIState").setString("Stunned"); o.setAnimationName("Hurt"); } }
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
      // Debug key M (switched off with the other debug keys by DEBUG_KEYS in Combat_Shared): spare the boss right now, from any state: the
      // boss is put on its last life and into its kneel (S.prep), the player is brought to 150 px if he is far, attacks in flight go.
      const force = !!input && input.wasKeyJustPressed(scene, "m") && !flag(pv, "IsDead");
      if (force) {
        if (bv.has("Lives") && num(bv, "Lives") > 1) bv.get("Lives").setNumber(1);
        if (bv.has("IsPostureBroken")) bv.get("IsPostureBroken").setBoolean(true);
        if (S.prep) S.prep(boss, bv);
        const gap = player.getCenterXInScene() - boss.getCenterXInScene();
        if (Math.abs(gap) > 300) player.setX(player.getX() + (Math.sign(gap || 1) * 150 - gap));
        for (const h of scene.getObjects("EnemyHitbox") || []) h.deleteFromScene(scene);
      }
      if (st.hold >= HOLD || force) {                                          // mercy: committed
        st.phase = "run";
        for (const n of ["IsAttacking", "IsDeflecting", "IsRolling", "IsLunging", "AllowCombo", "RollQueued", "DeflectQueued", "IsHurt"]) if (pv.has(n)) pv.get(n).setBoolean(false);
        pv.get("ControlsLocked").setBoolean(true); if (pv.has("Iframe")) pv.get("Iframe").setBoolean(true);
        scene.getGame().getVariables().get("BossesBeaten").getChild(scene.getName() + "_Spared").setBoolean(true);
        scene.__hideBars = true;                                                 // the boss's bars (HP, posture, name, life marks) go at once: the fight UI reads this
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
    // The camera's target: the boss's spot is LATCHED when the farewell starts (his hitbox jumps when his animation changes: the petal
    // frames are another size) and the player's is smoothed (he runs up in the Bladekeeper's salute). Remembered: the camera must stay
    // put after the boss is gone.
    const pb = body(player), lk = st.lock || (st.lock = { bossX: body(boss).x, bottom: pb.bottom, px: pb.x });
    lk.px += (pb.x - lk.px) * Math.min(1, dt * 5); st.aim = { x: (lk.bossX + lk.px) / 2, bottom: lk.bottom };
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
