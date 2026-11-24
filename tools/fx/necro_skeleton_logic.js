// Skeletons: the Necromancer keeps the graveyard stirring. At most SkelMaxP1 skeletons stand at a time (phase 2: SkelMaxP2); whenever
// there are fewer, a new one claws out of the ground SkelDelayP1 (SkelDelayP2) seconds later, so killing them only buys a breather.
// They are weak: one sword hit (a swing or the lunge) and they fall apart. Each walks at the player (SkelSpeed), and in reach
// (SkelReach) raises its sword (SkelWindup seconds, its eyes flare: the tell), cuts (a Necro_Hitbox: SkelDamage, melee, deflectable
// facing it, no posture to the Necromancer), then recovers (SkelRecover). A deflected cut knocks it back (Stagger), open to a hit.
// No new ones while he is in his intro, stunned or staggered, or the player is down; those standing hold still meanwhile. The Rekindle,
// his death and the mercy ending make every skeleton crumble. Phase 2 skeletons have red eyes (the *_P2 animations).
// Art: tools/fx/necro_skeleton.js. Sounds: necro_skel_rise, necro_skel_swing, necro_skel_break (tools/fx/necro_sounds.js).
// Debug: Numpad8 raises one now (through the DEBUG_KEYS gate, like his other keys).
// This file is the source of the "Skeletons" script in Necromancer_Boss; tools/fx/necro_skeleton_install.js copies it in.
const necro = runtimeScene.getObjects("Necromancer")[0];
const st = runtimeScene.__skel || (runtimeScene.__skel = { timer: -1, key: false, seed: 7 });
const dt = runtimeScene.getElapsedTime() / 1000;
const players = runtimeScene.getObjects("Player"), player = players[0], swordBox = runtimeScene.getObjects("Player_Hitbox")[0];
const V = (o, n) => o.getVariables().get(n), num = (o, n) => V(o, n).getAsNumber();
const sm = runtimeScene.getGame().getSoundManager();
const sound = (f, vol) => { try { sm.playSound("assets/Sfx/necro/" + f + ".wav", false, vol, 1); } catch (e) { /* no sound */ } };
const rnd = () => ((st.seed = (st.seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const FLOOR = 657, SCALE = 3;
const T = n => (necro ? num(necro, n) : 0);
const state = necro ? V(necro, "AIState").getAsString() : "Dead";
const p2 = !!necro && num(necro, "Phase") >= 2;
const gone = !necro || state === "Dead" || state === "Rekindle" || !!runtimeScene.__hideBars || !!runtimeScene.__mercy;
const calm = !player || ["Intro", "Stunned", "Stagger", "Idle"].indexOf(state) >= 0 || (player && V(player, "Health").getAsNumber() <= 0);
// Where a thing is, whatever its origin: the middle of its box and its bottom; and moving it so they land somewhere.
const midX = o => (o.getAABBLeft() + o.getAABBRight()) / 2;
const putFeet = (o, x, y) => { o.setX(o.getX() + x - midX(o)); o.setY(o.getY() + y - o.getAABBBottom()); };
const putBox = (o, left, top) => { o.setX(o.getX() + left - o.getAABBLeft()); o.setY(o.getY() + top - o.getAABBTop()); };
const body = o => { const x = midX(o), b = o.getAABBBottom(); return { l: x - 22, r: x + 22, t: b - 90, b: b }; };
const overlaps = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const boxOf = o => ({ l: o.getAABBLeft(), r: o.getAABBRight(), t: o.getAABBTop(), b: o.getAABBBottom() });
const ANIM = { Rise: 8, Walk: 6, Windup: 3, Swing: 3, Stagger: 2, Crumble: 8 };
const show = (o, a, f) => { const name = a + (o.__sk.p2 ? "_P2" : ""); if (o.getAnimationName() !== name) o.setAnimationName(name); o.pauseAnimation(); o.setAnimationFrame(Math.max(0, Math.min(ANIM[a] - 1, Math.floor(f)))); };
const go = (o, s) => { o.__sk.s = s; o.__sk.t = 0; };
const live = runtimeScene.getObjects("Necro_Skeleton").filter(o => o.__sk && o.__sk.s !== "crumble");
const crumble = o => {
  if (o.__sk.s === "crumble") return;
  if (o.__sk.hb) { try { o.__sk.hb.deleteFromScene(runtimeScene); } catch (e) { /* gone */ } o.__sk.hb = null; }
  go(o, "crumble"); sound("necro_skel_break", 70);
};

// Raising one: on the floor, 260 to 420 px from the player (toward him if there is room), clear of the others.
const raise = () => {
  const o = runtimeScene.createObject("Necro_Skeleton"); if (!o) return;
  o.__sk = { s: "rise", t: 0, p2: p2, hb: null, hp: 0, cool: 0 };
  if (o.setScale) o.setScale(SCALE);
  o.setZOrder(12);
  const px = player ? midX(player) : 640, side0 = necro && midX(necro) < px ? -1 : 1;
  let x = px;
  for (let k = 0; k < 8; k++) {
    const side = k % 2 ? -side0 : side0, d = 260 + rnd() * 160, cx = Math.max(80, Math.min(1200, px + side * d));
    if (Math.abs(cx - px) < 200) continue;
    if (!live.some(s => Math.abs(midX(s) - cx) < 70)) { x = cx; break; }
    x = cx;
  }
  putFeet(o, x, FLOOR);
  o.flipX(px < x);
  show(o, "Rise", 0);
  sound("necro_skel_rise", 60);
  live.push(o);
};

// The summoning clock.
if (gone) { for (const o of live) crumble(o); st.timer = -1; }
else {
  const cap = T(p2 ? "SkelMaxP2" : "SkelMaxP1"), delay = T(p2 ? "SkelDelayP2" : "SkelDelayP1");
  if (st.timer < 0) st.timer = T("SkelFirstDelay");
  if (calm || live.length >= cap) st.timer = Math.max(st.timer, live.length >= cap ? delay : st.timer);
  else { st.timer -= dt; if (st.timer <= 0) { raise(); st.timer = delay; } }
}
// Debug key: one more, now.
let keyDown = false;
try { keyDown = gdjs.evtTools.input.isKeyPressed(runtimeScene, "Numpad8"); } catch (e) { keyDown = false; }
if (keyDown && !st.key && !gone) raise();
st.key = keyDown;

// Each skeleton.
const swinging = player && V(player, "IsAttacking").getAsBoolean() && swordBox;
for (const o of runtimeScene.getObjects("Necro_Skeleton")) {
  const k = o.__sk; if (!k) continue;
  k.t += dt;
  // A sword hit ends it (not in the first instants of the rise, while only a hand is out, or once it is already falling).
  if (k.s !== "crumble" && !(k.s === "rise" && k.t < 0.25) && swinging && overlaps(boxOf(swordBox), body(o))) crumble(o);
  // Its cut: a deflect (it landed, but the player lost no health) knocks it back.
  if (k.hb) {
    const still = runtimeScene.getObjects("Necro_Hitbox").indexOf(k.hb) >= 0;
    if (still && V(k.hb, "HasHit").getAsBoolean()) {
      const deflected = player && V(player, "Health").getAsNumber() >= k.hp;
      k.hb = null;
      if (deflected && k.s !== "crumble") go(o, "stagger");
    } else if (!still) k.hb = null;
  }
  const face = () => { if (player) o.flipX(midX(player) < midX(o)); };
  const dir = () => (o.isFlippedX() ? -1 : 1);
  if (k.s === "rise") { show(o, "Rise", k.t / 0.8 * 8); if (k.t >= 0.8) { go(o, "walk"); k.cool = 0.3; } }
  else if (k.s === "walk") {
    face(); k.cool -= dt;
    const dx = player ? midX(player) - midX(o) : 0, reach = T("SkelReach");
    if (calm) show(o, "Walk", 0);
    else if (Math.abs(dx) > reach) {
      const blocked = live.some(s => s !== o && Math.abs(midX(s) - midX(o)) < 48 && Math.sign(midX(s) - midX(o)) === Math.sign(dx) && Math.abs(midX(s) - (midX(o) + dx)) < Math.abs(dx));
      if (!blocked) { const x = Math.max(40, Math.min(1240, midX(o) + Math.sign(dx) * T("SkelSpeed") * dt)); putFeet(o, x, FLOOR); }
      show(o, "Walk", (k.t / 0.12) % 6);
    } else if (k.cool <= 0) { go(o, "windup"); }
    else show(o, "Walk", 0);
  }
  else if (k.s === "windup") { if (calm) { go(o, "walk"); continue; } show(o, "Windup", k.t / T("SkelWindup") * 3); if (k.t >= T("SkelWindup")) { go(o, "swing"); sound("necro_skel_swing", 55); } }
  else if (k.s === "swing") {
    show(o, "Swing", k.t / 0.07);
    if (!k.cut && k.t >= 0.07) {
      k.cut = true;
      const hb = runtimeScene.createObject("Necro_Hitbox");
      if (hb) {
        const w = T("SkelReach") + 30, h = 80, x0 = dir() > 0 ? midX(o) : midX(o) - w;
        if (hb.setOpacity) hb.setOpacity(0);
        hb.setWidth(w); hb.setHeight(h); putBox(hb, x0, FLOOR - h - 6);
        V(hb, "Life").setNumber(0.12); V(hb, "Damage").setNumber(T("SkelDamage")); V(hb, "IsMelee").setBoolean(true); V(hb, "HasHit").setBoolean(false);
        V(hb, "PostureScale").setNumber(0); V(hb, "Directional").setNumber(1); V(hb, "SharedDeflect").setNumber(0); V(hb, "Kind").setString("skeleton");
        k.hb = hb; k.hp = player ? V(player, "Health").getAsNumber() : 0;
      }
    }
    if (k.t >= 0.21 + T("SkelRecover")) { k.cut = false; go(o, "walk"); k.cool = 0.4; }
  }
  else if (k.s === "stagger") { show(o, "Stagger", k.t / 0.3); const x = Math.max(40, Math.min(1240, midX(o) - dir() * 70 * dt * Math.max(0, 1 - k.t / 0.6))); putFeet(o, x, FLOOR); if (k.t >= 0.6) { go(o, "walk"); k.cool = 0.5; } }
  else if (k.s === "crumble") { show(o, "Crumble", k.t / 0.08); if (k.t >= 0.66) o.deleteFromScene(runtimeScene); }
}
