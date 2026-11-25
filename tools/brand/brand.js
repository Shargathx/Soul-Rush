// The Brand tree's passives (docs/design-brand-mercy.md, phase 5), the first one: Riposte (brand 2). Runs every frame, after the Composure script in
// Combat_Shared. SHADOW ECHO (brand 1) comes after the Riposte part below. The player's SHADOW counters for him, so he is free to punish with his own attack. The steps:
//   1. A NEW perfect MELEE deflect (Player.PerfectMeleeCount, which tools/perfect counts for melee attacks only: the Samurai's tornado, Judgement Cut and
//      Thousand Cuts, arrows, petals and grenades never call the shadow), above this script's own seen number, the way every power reads it) sets Player.RiposteFire to 1 when
//      the hub says the player has 2 or more brands (BrandCount, a global).
//   2. The first event below (it can see the Enemy group) writes the boss's x into Player.RiposteX and sets RiposteFire to 2.
//   3. Here, RiposteFire 2 spawns Player_Shadow (tools/fx/player_shadow.js) on a RANDOM side of the boss (a side with a wall in the way is not picked; with walls on both sides, no shadow comes), facing him, and starts its clock.
//   4. At STRIKE seconds (the slash arc of its frame 3) this sets Player.RiposteStrike to 1; the next event takes RiposteMult times AttackDamage of
//      health off the enemy (never posture), with the player's hit sound and blood (from Player.RiposteSrcX, where the shadow stood), and clears it.
//   5. The shadow flickers while it lasts, fades out over its last FADE seconds and is deleted. Not in the tutorial; the player dying clears it.
const EXEMPT = ["Tutorial_Level"];
const GAP = 80;                                                          // Px between the boss's centre and the shadow's body.
const STRIKE = 0.14, LIFE = 0.5, FADE = 0.2, ALPHA = 215;                // Seconds to the cut, seconds alive, the fade at the end, the opacity at full.
const players = runtimeScene.getObjects("Player");
if (players.length) {
  const player = players[0], pv = player.getVariables(), g = runtimeScene.getGame().getVariables();
  const pn = k => pv.get(k).getAsNumber();
  const count = pn("PerfectMeleeCount");
  const st = runtimeScene.__brandPassives || (runtimeScene.__brandPassives = { seen: count, shadows: [] });
  const dt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000);
  if (count < st.seen) st.seen = count;                                   // The count was reset (a new fight).
  if (count > st.seen) {
    st.seen = count;
    const brand = EXEMPT.includes(runtimeScene.getName()) ? 0 : g.get("BrandCount").getAsNumber();
    if (brand >= 2 && !pv.get("IsDead").getAsBoolean()) pv.get("RiposteFire").setNumber(1);
  }
  if (pn("RiposteFire") === 2) {                                          // The event has found the boss: the shadow arrives.
    pv.get("RiposteFire").setNumber(0);
    const bx = pn("RiposteX");
    // A side is clear when no Invisible_Wall (in the player's height band) is between the boss and the shadow, or where the shadow stands.
    const bodyBox = function (o) {      // The box of an object's collision mask (its hit boxes), in the scene: not its whole sprite frame.
      let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
      const boxes = o.getHitBoxes ? o.getHitBoxes() : [];
      for (const h of boxes) for (const v of h.vertices) { l = Math.min(l, v[0]); r = Math.max(r, v[0]); t = Math.min(t, v[1]); b = Math.max(b, v[1]); }
      if (l === Infinity && o.getAABBLeft) { l = o.getAABBLeft(); r = o.getAABBRight(); t = o.getAABBTop(); b = o.getAABBBottom(); }
      if (l === Infinity) { l = r = o.getCenterXInScene(); t = b = o.getCenterYInScene(); }
      return { l: l, r: r, t: t, b: b };
    };
    const me = bodyBox(player), half = Math.max(8, (me.r - me.l) / 2), walls = (runtimeScene.getObjects("Invisible_Wall") || []).map(bodyBox);
    const clear = function (side) {
      const lo = Math.min(bx, bx + side * GAP) - half, hi = Math.max(bx, bx + side * GAP) + half;
      return !walls.some(w => w.b > me.t && w.t < me.b && w.r > lo && w.l < hi);
    };
    const sides = [-1, 1].filter(clear);
    const side = sides.length ? sides[Math.floor(Math.random() * sides.length)] : 0;
    const obj = side ? runtimeScene.createObject("Player_Shadow") : null;
    if (obj) {
      obj.setAnimationName("Strike");
      obj.setScale(player.getScaleX());
      obj.setX(bx + side * GAP - obj.getWidth() / 2);
      obj.setY(player.getY());
      obj.setZOrder(player.getZOrder() + 1);
      if (obj.flipX) obj.flipX(side > 0);                                 // The art faces right: toward the boss when he is on the right.
      obj.setOpacity(0);
      st.shadows.push({ obj: obj, age: 0, struck: false, srcX: bx + side * GAP });
    }
  }
  for (let i = st.shadows.length - 1; i >= 0; i--) {
    const s = st.shadows[i];
    s.age += dt;
    if (!s.struck && s.age >= STRIKE) { s.struck = true; if (!pv.get("IsDead").getAsBoolean()) { pv.get("RiposteSrcX").setNumber(s.srcX); pv.get("RiposteStrike").setNumber(1); } }
    if (s.age >= LIFE || pv.get("IsDead").getAsBoolean()) { s.obj.deleteFromScene(runtimeScene); st.shadows.splice(i, 1); continue; }
    const rise = Math.min(1, s.age / 0.04), fade = Math.min(1, (LIFE - s.age) / FADE);       // In at once, out over the last FADE seconds.
    s.obj.setOpacity(Math.round(ALPHA * rise * fade * (0.85 + 0.15 * Math.sin(s.age * 90))));   // A ghostly flicker.
  }
}

// ---- Shadow echo (brand 1) ---------------------------------------------------------------------------------------------------------------------
// Every swing of the player that HITS (Player.HasHitThisSwing turns true) is remembered: where he stood, which way he faced, which attack it was.
// ECHO_DELAY seconds later a fainter shadow appears on that spot and swings the same attack. At its slash frame it sets Player.EchoStrike (with the
// spot in Player.EchoX); the event below takes EchoMult times AttackDamage off an enemy within EchoReach px of that spot, health only, never posture.
// So an echo lands only if the boss is still there: a hit-and-run leaves it swinging at air. The echoes do not echo, and the tutorial has none.
if (players.length) {
  const player = players[0], pv = player.getVariables(), g = runtimeScene.getGame().getVariables();
  const ECHO_DELAY = 1.0, ECHO_ALPHA = 120, MAX_PENDING = 4;
  const st = runtimeScene.__brandPassives;
  const dt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000);
  const dead = pv.get("IsDead").getAsBoolean();
  const brand = EXEMPT.includes(runtimeScene.getName()) ? 0 : g.get("BrandCount").getAsNumber();
  const hit = pv.get("HasHitThisSwing").getAsBoolean();
  if (!st.echoes) { st.echoes = []; st.hadHit = hit; }
  if (hit && !st.hadHit && brand >= 1 && !dead && st.echoes.length < MAX_PENDING) {
    const light = String(player.getAnimationName ? player.getAnimationName() : "").indexOf("Attack_One") >= 0;
    st.echoes.push({ wait: ECHO_DELAY, light: light, x: player.getX(), y: player.getY(), cx: player.getCenterXInScene(), flip: !!(player.isFlippedX && player.isFlippedX()), scale: player.getScaleX(), obj: null, age: 0, struck: false });
  }
  st.hadHit = hit;
  for (let i = st.echoes.length - 1; i >= 0; i--) {
    const e = st.echoes[i], strikeAt = e.light ? 0.16 : 0.14, life = e.light ? 0.4 : 0.5;
    if (dead) { if (e.obj) e.obj.deleteFromScene(runtimeScene); st.echoes.splice(i, 1); continue; }
    if (!e.obj) {
      e.wait -= dt;
      if (e.wait > 0) continue;
      e.obj = runtimeScene.createObject("Player_Shadow");
      if (!e.obj) { st.echoes.splice(i, 1); continue; }
      e.obj.setAnimationName(e.light ? "Strike1" : "Strike");
      e.obj.setScale(e.scale); e.obj.setX(e.x); e.obj.setY(e.y); e.obj.setZOrder(player.getZOrder() + 1);
      if (e.obj.flipX) e.obj.flipX(e.flip);
      e.obj.setOpacity(0);
    }
    e.age += dt;
    if (!e.struck && e.age >= strikeAt) { e.struck = true; pv.get("EchoX").setNumber(e.cx); pv.get("EchoStrike").setNumber(1); }
    if (e.age >= life) { e.obj.deleteFromScene(runtimeScene); st.echoes.splice(i, 1); continue; }
    const rise = Math.min(1, e.age / 0.04), fade = Math.min(1, (life - e.age) / 0.2);
    e.obj.setOpacity(Math.round(ECHO_ALPHA * rise * fade * (0.85 + 0.15 * Math.sin(e.age * 90))));
  }
}

// ---- Projectile return (brand 4) ---------------------------------------------------------------------------------------------------------------
// A DEFLECTED arrow of the Leaf Ranger or thrown blade of the Bladekeeper flies back at the boss as a bolt (Player_Return_Shot) and takes ReturnMult
// times AttackDamage of health off him on arrival (never posture), with the player's hit sound and blood. (The Gunslinger's parried bullets already fly
// back at him by themselves, and area attacks, beams, cuts and the Samurai's tornado and petals are not projectiles that can be returned.)
// No boss script is touched: every frame the projectiles of RETURNABLE are watched. A deflect is when Player.DeflectBlocked turns true and a watched
// projectile near the player (within NEAR px, seen last frame) is gone or has HasHit set; the player's HP did not fall on that frame (a hit is not a
// deflect). Player.BossX/BossY (an event writes them every frame) are where the bolt flies. On arrival it sets Player.ReturnStrike and
// Player.ReturnSrcX (where the bolt was, for the blood); the event below does the damage. The tutorial has none.
if (players.length) {
  const player = players[0], pv = player.getVariables(), g = runtimeScene.getGame().getVariables();
  const RETURNABLE = ["Ranger_Arrow", "Bladekeeper_Blade"], NEAR = 170, SPEED = 1100, HIT_DIST = 50, LIFE = 2;
  const st = runtimeScene.__brandPassives;
  const dt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000);
  const dead = pv.get("IsDead").getAsBoolean();
  const brand = EXEMPT.includes(runtimeScene.getName()) ? 0 : g.get("BrandCount").getAsNumber();
  const blocked = pv.get("DeflectBlocked").getAsBoolean(), hp = pv.get("Health").getAsNumber();
  if (!st.seenProj) st.seenProj = new Map(), st.shots = [], st.wasBlocked = blocked, st.lastHp = hp;
  const px = player.getCenterXInScene(), py = player.getCenterYInScene();
  const deflected = blocked && !st.wasBlocked && hp >= st.lastHp;
  const alive = new Set();
  for (const name of RETURNABLE) for (const o of runtimeScene.getObjects(name) || []) {
    alive.add(o);
    const hit = o.getVariables().get("HasHit").getAsBoolean(), x = o.getCenterXInScene(), y = o.getCenterYInScene();
    const was = st.seenProj.get(o);
    if (hit && was && !was.done) {                                       // It just hit something: the player (or his sword).
      was.done = true;
      if (deflected && brand >= 4 && !dead && Math.hypot(was.x - px, was.y - py) < NEAR) st.spawn = (st.spawn || []).concat([[x, y]]);
    } else if (!hit) st.seenProj.set(o, { x: x, y: y, done: false });
  }
  for (const [o, was] of Array.from(st.seenProj)) if (!alive.has(o)) {   // Gone this frame (deleted by its own boss events).
    st.seenProj.delete(o);
    if (!was.done && deflected && brand >= 4 && !dead && Math.hypot(was.x - px, was.y - py) < NEAR) st.spawn = (st.spawn || []).concat([[was.x, was.y]]);
  }
  st.wasBlocked = blocked; st.lastHp = hp;
  for (const [sx, sy] of st.spawn || []) {                               // A returned bolt starts where the projectile was.
    const obj = runtimeScene.createObject("Player_Return_Shot");
    if (obj) { obj.setZOrder(player.getZOrder() + 2); st.shots.push({ obj: obj, x: sx, y: sy, age: 0 }); }
  }
  st.spawn = [];
  const bx = pv.get("BossX").getAsNumber(), by = pv.get("BossY").getAsNumber();
  for (let i = st.shots.length - 1; i >= 0; i--) {
    const s = st.shots[i];
    s.age += dt;
    const dx = bx - s.x, dy = by - s.y, d = Math.hypot(dx, dy);
    if (dead || s.age > LIFE) { s.obj.deleteFromScene(runtimeScene); st.shots.splice(i, 1); continue; }
    if (d <= HIT_DIST || d <= SPEED * dt) {                              // It arrives.
      pv.get("ReturnSrcX").setNumber(s.x); pv.get("ReturnStrike").setNumber(1);
      s.obj.deleteFromScene(runtimeScene); st.shots.splice(i, 1); continue;
    }
    s.x += dx / d * SPEED * dt; s.y += dy / d * SPEED * dt;
    s.obj.setPosition(s.x - s.obj.getWidth() / 2, s.y - s.obj.getHeight() / 2);
    s.obj.setAngle(Math.atan2(dy, dx) * 180 / Math.PI);
  }
}

// ---- Roll deflect (brand 5) --------------------------------------------------------------------------------------------------------------------
// Switches it on for the events, which cannot read the global brand count: Player.RollDeflectOn is 1 from 5 brands (not in the tutorial). With it the
// sword can block the Samurai's grab, but only in the perfect window of a deflect (PerfectFractionNow): the grab whiffs and he is open. (Dodging is its
// own reward: a roll, the Flash step or the Wraith dash still just avoids a grab, the Cat's dash, landing and eruption, with no bonus on top.)
if (players.length) {
  const pv = players[0].getVariables(), g = runtimeScene.getGame().getVariables();
  const on = !EXEMPT.includes(runtimeScene.getName()) && g.get("BrandCount").getAsNumber() >= 5;
  pv.get("RollDeflectOn").setNumber(on ? 1 : 0);
}
