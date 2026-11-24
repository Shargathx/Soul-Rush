// The dodge slot in a fight (docs/design-brand-mercy.md, phase 4, slice 4). The roll (Space) is the player's dodge; the loadout can swap it for the
// Flash step or the Wraith dash (the hub writes the choice into the global LoadoutDodge). A dash is the same roll with other numbers, so this script
// does not start anything: every frame it writes the numbers the roll events read (Player.DodgeSpeed, DodgeIframe, DodgeStamina), for the dodge that
// the NEXT press will use, and pays for the dodge that has just started:
//   roll        400 px/s, 0.32 s of i-frames, costs DodgeStaminaBase (30) stamina. The fallback for everything below.
//   flash_step  DashSpeedFlash px/s, a little more i-frames, costs no stamina but a dash charge (DashChargesMax, each back after DashRecharge s).
//               With no charge left the press rolls instead.
//   wraith_dash DashSpeedWraith px/s, the longest i-frames, no stamina, no charges: it costs WraithCost of max HP as sacrificed HP (Player.SacrificeHP),
//               so not when that would leave less than BloodPactFloor of max HP (then the press rolls). (Attacking out of it comes later.)
// Light step (mercy 4, above the HP band, the Composure script sets ComposureOn): charges come back faster and the roll costs less stamina.
// The tutorial and the hub have the plain roll. Debug key C cycles the dodge for this fight. The charges show bottom left, above the power readout.
const EXEMPT = ["Tutorial_Level", "HUB_Area"];
const players = runtimeScene.getObjects("Player");
if (players.length) {
  const pv = players[0].getVariables(), g = runtimeScene.getGame().getVariables(), input = gdjs.evtTools.input;
  const pn = k => pv.get(k).getAsNumber();
  const st = runtimeScene.__dodge || (runtimeScene.__dodge = { eff: "roll", was: false, hud: null, shown: "" });
  const exempt = EXEMPT.includes(runtimeScene.getName());
  const dt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000);
  if (!exempt && input.wasKeyJustPressed(runtimeScene, "c")) {                  // Debug.
    const order = ["roll", "flash_step", "wraith_dash"], now = g.get("LoadoutDodge").getAsString();
    g.get("LoadoutDodge").setString(order[(Math.max(0, order.indexOf(now)) + 1) % order.length]);
  }
  const mode = exempt ? "roll" : g.get("LoadoutDodge").getAsString();
  const light = !exempt && g.get("MercyCount").getAsNumber() >= 4 && pn("ComposureOn") === 1;
  const max = pn("DashChargesMax");
  let charges = pn("DashCharges");
  // A dodge has just started: pay for the one the press used (the numbers written last frame).
  const rolling = pv.get("IsRolling").getAsBoolean();
  if (rolling && !st.was) {
    if (st.eff === "flash_step") charges = Math.max(0, charges - 1);
    if (st.eff === "wraith_dash") pv.get("SacrificeHP").setNumber(pn("SacrificeHP") + Math.round(pn("MaxHealth") * pn("WraithCost")));
  }
  if (rolling && !st.was) st.active = st.eff;      // Which dodge is in progress (the dash effects read it): roll, flash_step or wraith_dash.
  if (!rolling) st.active = "";
  st.was = rolling;
  // The charges come back (not while one is being spent into a dash this frame, which is just a number going down).
  if (charges < max) charges = Math.min(max, charges + dt * (1 + (light ? pn("LightStepDashBonus") : 0)) / pn("DashRecharge"));
  pv.get("DashCharges").setNumber(charges);
  // The dodge the next press will use.
  let eff = "roll";
  if (mode === "flash_step" && charges >= 1) eff = "flash_step";
  else if (mode === "wraith_dash" && pn("Health") - Math.round(pn("MaxHealth") * pn("WraithCost")) >= pn("MaxHealth") * pn("BloodPactFloor")) eff = "wraith_dash";
  st.eff = eff;
  pv.get("DodgeSpeed").setNumber(eff === "flash_step" ? pn("DashSpeedFlash") : eff === "wraith_dash" ? pn("DashSpeedWraith") : pn("DodgeSpeedBase"));
  pv.get("DodgeIframe").setNumber(eff === "flash_step" ? pn("DashIframeFlash") : eff === "wraith_dash" ? pn("DashIframeWraith") : pn("DodgeIframeBase"));
  pv.get("DodgeStamina").setNumber(eff === "roll" ? pn("DodgeStaminaBase") * (light ? 1 - pn("LightStepRollBonus") : 1) : 0);
  // The readout: the dash and its charges.
  let text = "";
  if (mode === "flash_step") { const full = Math.floor(charges); text = "Flash step  " + "●".repeat(full) + "○".repeat(Math.max(0, max - full)); }
  else if (mode === "wraith_dash") text = "Wraith dash  (" + Math.round(pn("MaxHealth") * pn("WraithCost")) + " HP)";
  if (typeof PIXI !== "undefined") {
    if (!st.hud) {
      try {
        const root = runtimeScene.getLayer("UI").getRenderer().getRendererObject();
        st.hud = new PIXI.Text("", { fontFamily: "Georgia, serif", fontSize: 17, fill: 0xc9d8e8, stroke: 0x000000, strokeThickness: 3 });
        st.hud.x = 20; st.hud.y = runtimeScene.getGame().getGameResolutionHeight() - 100; st.hud.zIndex = 800000;
        root.addChild(st.hud);
      } catch (e) { st.hud = null; }
    }
    if (st.hud && st.shown !== text) { st.hud.text = text; st.shown = text; }
  }
}
