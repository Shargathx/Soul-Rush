// The Brand tree's passives (docs/design-brand-mercy.md, phase 5), the first one: Riposte (brand 2). Runs every frame, after the Composure script in
// Combat_Shared. A NEW perfect deflect (Player.PerfectCount goes above this script's own seen number, the way every power reads it) sets
// Player.RiposteFire to 1 when the hub says the player has 2 or more brands. The event under this script then takes RiposteMult times AttackDamage off
// every Enemy's HEALTH (never its posture) and puts RiposteFire back to 0. Not in the tutorial. Brands are a global the hub fills in.
const EXEMPT = ["Tutorial_Level"];
const players = runtimeScene.getObjects("Player");
if (players.length) {
  const pv = players[0].getVariables(), g = runtimeScene.getGame().getVariables();
  const count = pv.get("PerfectCount").getAsNumber();
  const st = runtimeScene.__brandPassives || (runtimeScene.__brandPassives = { seen: count });
  if (count < st.seen) st.seen = count;                                   // The count was reset (a new fight).
  if (count > st.seen) {
    st.seen = count;
    const brand = EXEMPT.includes(runtimeScene.getName()) ? 0 : g.get("BrandCount").getAsNumber();
    if (brand >= 2 && !pv.get("IsDead").getAsBoolean()) pv.get("RiposteFire").setNumber(1);
  }
}
