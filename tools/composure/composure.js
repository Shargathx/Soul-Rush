// Composure (docs/design-brand-mercy.md, phase 5): the mercy tree's passives, which work only while the player is at HIGH HP (more than
// ComposureBand of max HP, so one small mistake does not turn them off). Runs every frame, early in Combat_Shared, and works out the values the
// other events read, the way Desperation does with DeflectWindowNow:
//   Poise        (mercy 1): StaminaRegenNow = the regen rate plus PoiseBonus (the stamina regen event reads it).
//   Respite      (mercy 2): a new perfect deflect refunds RespiteStamina stamina (reads PerfectCount with its own seen number).
//   Steady hand  (mercy 3): PerfectFractionNow = the perfect window plus SteadyHandBonus (the perfect deflect events read it).
// MercyCount is a global the hub fills in. The tutorial is practice: no passives. Light step (4) and Grace (5) come with the dodge and the posture hits.
const EXEMPT = ["Tutorial_Level"];
const players = runtimeScene.getObjects("Player");
if (players.length) {
  const pv = players[0].getVariables(), g = runtimeScene.getGame().getVariables();
  const pn = k => pv.get(k).getAsNumber();
  const mercy = EXEMPT.includes(runtimeScene.getName()) ? 0 : g.get("MercyCount").getAsNumber();
  const max = pn("MaxHealth");
  const on = mercy > 0 && max > 0 && pn("Health") / max > pn("ComposureBand") && !pv.get("IsDead").getAsBoolean();
  pv.get("ComposureOn").setNumber(on ? 1 : 0);
  pv.get("StaminaRegenNow").setNumber(pn("StaminaRegenRate") * (on && mercy >= 1 ? 1 + pn("PoiseBonus") : 1));
  pv.get("PerfectFractionNow").setNumber(pn("PerfectFraction") + (on && mercy >= 3 ? pn("SteadyHandBonus") : 0));
  const count = pn("PerfectCount");
  const st = runtimeScene.__composure || (runtimeScene.__composure = { seen: count });
  if (count < st.seen) st.seen = count;                                   // The count was reset (a new fight).
  if (count > st.seen) {
    st.seen = count;
    if (on && mercy >= 2) pv.get("Stamina").setNumber(Math.min(pn("MaxStamina"), pn("Stamina") + pn("RespiteStamina")));
  }
}
