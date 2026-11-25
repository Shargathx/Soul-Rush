// The Brand tree's passives (docs/design-brand-mercy.md, phase 5), the first one: Riposte (brand 2). Runs every frame, after the Composure script in
// Combat_Shared. The player's SHADOW counters for him, so he is free to punish with his own attack. The steps:
//   1. A NEW perfect deflect (Player.PerfectCount above this script's own seen number, the way every power reads it) sets Player.RiposteFire to 1 when
//      the hub says the player has 2 or more brands (BrandCount, a global).
//   2. The first event below (it can see the Enemy group) writes the boss's x into Player.RiposteX and sets RiposteFire to 2.
//   3. Here, RiposteFire 2 spawns Player_Shadow (tools/fx/player_shadow.js) on the player's side of the boss, facing him, and starts its clock.
//   4. At STRIKE seconds (the slash arc of its frame 3) this sets Player.RiposteStrike to 1; the next event takes RiposteMult times AttackDamage of
//      health off the enemy (never posture) and clears it.
//   5. The shadow flickers while it lasts, fades out over its last FADE seconds and is deleted. Not in the tutorial; the player dying clears it.
const EXEMPT = ["Tutorial_Level"];
const GAP = 80;                                                          // Px between the boss's centre and the shadow's body.
const STRIKE = 0.14, LIFE = 0.5, FADE = 0.2, ALPHA = 215;                // Seconds to the cut, seconds alive, the fade at the end, the opacity at full.
const players = runtimeScene.getObjects("Player");
if (players.length) {
  const player = players[0], pv = player.getVariables(), g = runtimeScene.getGame().getVariables();
  const pn = k => pv.get(k).getAsNumber();
  const count = pn("PerfectCount");
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
    const bx = pn("RiposteX"), side = player.getCenterXInScene() < bx ? -1 : 1;   // Which side of the boss the player is on.
    const obj = runtimeScene.createObject("Player_Shadow");
    if (obj) {
      obj.setAnimationName("Strike");
      obj.setScale(player.getScaleX());
      obj.setX(bx + side * GAP - obj.getWidth() / 2);
      obj.setY(player.getY());
      obj.setZOrder(player.getZOrder() + 1);
      if (obj.flipX) obj.flipX(side > 0);                                 // The art faces right: toward the boss when he is on the right.
      obj.setOpacity(0);
      st.shadows.push({ obj: obj, age: 0, struck: false });
    }
  }
  for (let i = st.shadows.length - 1; i >= 0; i--) {
    const s = st.shadows[i];
    s.age += dt;
    if (!s.struck && s.age >= STRIKE) { s.struck = true; if (!pv.get("IsDead").getAsBoolean()) pv.get("RiposteStrike").setNumber(1); }
    if (s.age >= LIFE || pv.get("IsDead").getAsBoolean()) { s.obj.deleteFromScene(runtimeScene); st.shadows.splice(i, 1); continue; }
    const rise = Math.min(1, s.age / 0.04), fade = Math.min(1, (LIFE - s.age) / FADE);       // In at once, out over the last FADE seconds.
    s.obj.setOpacity(Math.round(ALPHA * rise * fade * (0.85 + 0.15 * Math.sin(s.age * 90))));   // A ghostly flicker.
  }
}
