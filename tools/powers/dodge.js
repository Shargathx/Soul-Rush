// The dodge slot in a fight (docs/design-brand-mercy.md, phase 4, slice 4). The roll (Space) is the player's dodge; the loadout can swap it for the
// Flash step or the Wraith dash (the hub writes the choice into the global LoadoutDodge). A dash is the roll's start with other numbers, so this
// script does not start anything: every frame it writes the numbers the roll events read, for the dodge that the NEXT press will use (Player.DodgeSpeed,
// DodgeMoveTime, DodgeIframe, DodgeStamina), and pays for the dodge that has just started:
//   roll        400 px/s for the whole roll (DodgeMoveTime 99), 0.32 s of i-frames, costs DodgeStaminaBase (30) stamina. The fallback for everything below.
//   flash_step  a near-instant dash like the Samurai's: DashSpeedFlash px/s for DashMoveTime s (about 300 px in 0.09 s), a little more i-frames, no
//               stamina but a dash charge (DashChargesMax, each back after DashRecharge s). With no charge left the press rolls instead.
//   wraith_dash the same, a little shorter, the longest i-frames, no stamina and no charges: it costs WraithCost of max HP as sacrificed HP
//               (Player.SacrificeHP), so not when that would leave less than BloodPactFloor of max HP (then the press rolls).
// The numbers are FROZEN while a dodge is in progress: the roll events read DodgeSpeed and DodgeMoveTime every frame of the dodge, and paying for it
// (a charge gone, HP spent) changes what the next press would be, which must not change the dodge already going (a second Flash step used to turn
// into a roll's 400 px/s in the middle of the dash). The i-frame length is copied into DodgeIframeActive when the dodge starts, and the i-frames end by that.
// A dash is a vanish and a reappear, not a tumble: the player is invisible while he crosses (the speed lines of dashfx.js show the way), and after
// DashEndTime seconds the roll is ended at once (idle pose, free to act, the i-frames carry on), so he can attack straight out of it.
// A dodge never leaves the arena: after all the events of a frame the player is put back inside the Invisible_Wall walls that were beside him before
// the dodge (a dash moves about 55 px a frame, and the walls are only 64 px thick). Boxes are the collision masks (getHitBoxes), not the 120x80 frames.
// Light step (mercy 4, above the HP band, the Composure script sets ComposureOn): charges come back faster and the roll costs less stamina.
// The tutorial and the hub have the plain roll. Debug key C cycles the dodge for this fight. The charges show bottom left, above the power readout.
const EXEMPT = ["Tutorial_Level", "HUB_Area"];
const bodyBox = function (o) {      // The box of an object's collision mask (its hit boxes), in the scene: not its whole sprite frame.
  let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
  const boxes = o.getHitBoxes ? o.getHitBoxes() : [];
  for (const h of boxes) for (const v of h.vertices) { l = Math.min(l, v[0]); r = Math.max(r, v[0]); t = Math.min(t, v[1]); b = Math.max(b, v[1]); }
  if (l === Infinity && o.getAABBLeft) { l = o.getAABBLeft(); r = o.getAABBRight(); t = o.getAABBTop(); b = o.getAABBBottom(); }
  if (l === Infinity) { l = r = o.getCenterXInScene(); t = b = o.getCenterYInScene(); }
  return { l: l, r: r, t: t, b: b };
};
if (!gdjs.__soulRushDodgeClamp) {
  gdjs.__soulRushDodgeClamp = true;
  gdjs.registerRuntimeScenePostEventsCallback(function (scene) {
    const d = scene.__dodge, ps = scene.getObjects("Player");
    if (!d || !ps.length) return;
    const p = ps[0], me = bodyBox(p);
    // Not dodging: remember where he is. The first frame of a dodge has already moved him (a dash: up to 55 px), so the side of each wall comes from here.
    if (!p.getVariables().get("IsRolling").getAsBoolean()) { d.lastX = (me.l + me.r) / 2; return; }
    let lo = -Infinity, hi = Infinity;
    for (const w of scene.getObjects("Invisible_Wall") || []) {
      const wb = bodyBox(w);
      if (wb.b <= me.t || wb.t >= me.b) continue;                                    // Only the walls beside him, not the floor under him.
      if (wb.r <= d.lastX) lo = Math.max(lo, wb.r);
      else if (wb.l >= d.lastX) hi = Math.min(hi, wb.l);
    }
    if (me.l < lo) p.setX(p.getX() + (lo - me.l));
    else if (me.r > hi) p.setX(p.getX() + (hi - me.r));
  });
}
const players = runtimeScene.getObjects("Player");
if (players.length) {
  const player = players[0], pv = player.getVariables(), g = runtimeScene.getGame().getVariables(), input = gdjs.evtTools.input;
  const pn = k => pv.get(k).getAsNumber();
  const st = runtimeScene.__dodge || (runtimeScene.__dodge = { eff: "roll", active: "", was: false, t: 0, lastX: 0, hidden: false, hud: null, shown: "" });
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
  let rolling = pv.get("IsRolling").getAsBoolean();
  // A dodge has just started: pay for the one the press used (the numbers written last frame); a dash makes the player vanish.
  if (rolling && !st.was) {
    st.active = st.eff; st.t = 0;
    pv.get("DodgeIframeActive").setNumber(pn("DodgeIframe"));                   // The i-frames of THIS dodge, whatever the next press would be.
    if (st.eff === "flash_step") charges = Math.max(0, charges - 1);
    if (st.eff === "wraith_dash") pv.get("SacrificeHP").setNumber(pn("SacrificeHP") + Math.round(pn("MaxHealth") * pn("WraithCost")));
    if (st.eff !== "roll") { player.setOpacity(0); st.hidden = true; }
  }
  // A dash is over after DashEndTime: appear, end the roll at once (idle pose, free to act; the i-frames end by their own timer).
  if (rolling && (st.active === "flash_step" || st.active === "wraith_dash")) {
    st.t += dt;
    if (st.t >= pn("DashEndTime")) { pv.get("IsRolling").setBoolean(false); player.setAnimationName("Player_Idle"); rolling = false; }
  }
  if (!rolling) { st.active = ""; if (st.hidden) { player.setOpacity(255); st.hidden = false; } }   // Also when something interrupted the dash.
  st.was = rolling;
  // The charges come back.
  if (charges < max) charges = Math.min(max, charges + dt * (1 + (light ? pn("LightStepDashBonus") : 0)) / pn("DashRecharge"));
  pv.get("DashCharges").setNumber(charges);
  // The dodge the next press will use (not while one is going: its numbers are frozen).
  if (!rolling) {
    let eff = "roll";
    if (mode === "flash_step" && charges >= 1) eff = "flash_step";
    else if (mode === "wraith_dash" && pn("Health") - Math.round(pn("MaxHealth") * pn("WraithCost")) >= pn("MaxHealth") * pn("BloodPactFloor")) eff = "wraith_dash";
    st.eff = eff;
    pv.get("DodgeSpeed").setNumber(eff === "flash_step" ? pn("DashSpeedFlash") : eff === "wraith_dash" ? pn("DashSpeedWraith") : pn("DodgeSpeedBase"));
    pv.get("DodgeMoveTime").setNumber(eff === "roll" ? pn("DodgeMoveTimeBase") : pn("DashMoveTime"));
    pv.get("DodgeIframe").setNumber(eff === "flash_step" ? pn("DashIframeFlash") : eff === "wraith_dash" ? pn("DashIframeWraith") : pn("DodgeIframeBase"));
    pv.get("DodgeStamina").setNumber(eff === "roll" ? pn("DodgeStaminaBase") * (light ? 1 - pn("LightStepRollBonus") : 1) : 0);
  }
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
