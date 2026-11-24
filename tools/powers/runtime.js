// Powers in a fight (docs/design-brand-mercy.md, phase 4, slice 2). One script event in Combat_Shared, every frame. The hub works out the
// loadout and writes it into the globals LoadoutSlot1 to LoadoutSlot3 (tools/powers/powers.js, the altar screen picks them). Here:
//   R        uses the SELECTED power (the first filled slot at the start of a fight).
//   E (tap)  selects the next filled slot. A tap is a press shorter than a quarter of a second, so the mercy hold (one second) never counts.
//   X        (debug) equips Blood pact in slot 1 for this fight, to try it without killing the Gunslinger.
// The tutorial and the hub are exempt: no powers there. The selected power and a message show bottom left. Each power below says what it
// needs and does; paying in HP goes through Player.SacrificeHP (an event in this sheet takes it off, never kills, and rally cannot win it back).
const EXEMPT = ["Tutorial_Level", "HUB_Area"];
const players = runtimeScene.getObjects("Player");
if (players.length && !EXEMPT.includes(runtimeScene.getName())) {
  const player = players[0], pv = player.getVariables(), g = runtimeScene.getGame().getVariables(), input = gdjs.evtTools.input;
  const st = runtimeScene.__powers || (runtimeScene.__powers = { sel: -1, eDown: 0, cool: {}, msg: "", msgLeft: 0, hud: null, shown: "" });
  const dt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000);
  const pn = k => pv.get(k).getAsNumber(), pb = k => pv.get(k).getAsBoolean();
  // The powers. use(): returns a message to show, or "" when it did nothing.
  const POWER = {
    blood_pact: {
      name: "Blood pact", cooldown: 1.5,
      // Pay a part of max HP (BloodPactCost) and get all the stamina back at once. Not if it would leave less than BloodPactFloor of max HP.
      use: function () {
        const max = pn("MaxHealth"), cost = Math.round(max * pn("BloodPactCost"));
        if (pn("Health") - cost < max * pn("BloodPactFloor")) return "Too weak for that";
        pv.get("SacrificeHP").setNumber(pn("SacrificeHP") + cost);
        pv.get("Stamina").setNumber(pn("MaxStamina"));
        return "Blood pact  -" + cost + " HP";
      }
    }
  };
  if (input.wasKeyJustPressed(runtimeScene, "x")) g.get("LoadoutSlot1").setString("blood_pact");        // Debug.
  const slots = [1, 2, 3].map(i => g.get("LoadoutSlot" + i).getAsString());
  const filled = [0, 1, 2].filter(i => slots[i] && POWER[slots[i]]);
  if (!filled.includes(st.sel)) st.sel = filled.length ? filled[0] : -1;
  for (const id of Object.keys(st.cool)) st.cool[id] = Math.max(0, st.cool[id] - dt);
  // E: a tap selects the next power.
  if (input.isKeyPressed(runtimeScene, "e")) st.eDown += dt;
  else { if (st.eDown > 0 && st.eDown < 0.25 && filled.length > 1) st.sel = filled[(filled.indexOf(st.sel) + 1) % filled.length]; st.eDown = 0; }
  // R: use it. Not while the player cannot act.
  if (input.wasKeyJustPressed(runtimeScene, "r") && st.sel >= 0) {
    const id = slots[st.sel], p = POWER[id];
    if (pb("ControlsLocked") || pb("IsDead") || pb("IsDeathblow") || pb("IsGrabbed") || pb("IsPostureBroken")) { /* cannot act */ }
    else if ((st.cool[id] || 0) > 0) { /* still cooling down */ }
    else { const msg = p.use(); if (msg) { st.msg = msg; st.msgLeft = 1.4; if (!msg.startsWith("Too")) st.cool[id] = p.cooldown; } }
  }
  st.msgLeft = Math.max(0, st.msgLeft - dt);
  // The readout, bottom left: "R  Blood pact" (and "E next" when there is more than one), then the last message for a moment.
  let text = "";
  if (st.sel >= 0) text = "R  " + POWER[slots[st.sel]].name + (filled.length > 1 ? "   (tap E: next)" : "") + (st.msgLeft > 0 ? "\n" + st.msg : "");
  if (typeof PIXI !== "undefined") {
    if (!st.hud) {
      try {
        const root = runtimeScene.getLayer("UI").getRenderer().getRendererObject();
        st.hud = new PIXI.Text("", { fontFamily: "Georgia, serif", fontSize: 17, fill: 0xe8dcc0, stroke: 0x000000, strokeThickness: 3 });
        st.hud.x = 20; st.hud.y = runtimeScene.getGame().getGameResolutionHeight() - 64; st.hud.zIndex = 800000;
        root.addChild(st.hud);
      } catch (e) { st.hud = null; }
    }
    if (st.hud && st.shown !== text) { st.hud.text = text; st.shown = text; }
  }
}
