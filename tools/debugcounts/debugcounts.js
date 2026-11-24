// Debug counts (docs/design-brand-mercy.md). Runs every frame in Combat_Shared.
// 1. Keys O and B: one more mercy / brand count (the globals MercyCount and BrandCount, wrapping to 0 after every boss), to try the passives
//    without beating the bosses. They are done here, in script, because the counts are GLOBAL variables, which this project's events do not use.
//    The hub works the real counts out again every frame, so the keys do nothing in the hub and the numbers go back on the next visit.
// 2. A readout: after all the events of a frame, two lines are added to the text of the Debug_UI object that the fight scenes already have
//    (the Samurai's event writes his debug text into it every frame):
//        Brand: x / N | Mercy: y / N
//        Perfect: n (forced) | Composure: on
//    The lines are cut off and put back each frame, so they never pile up. With DEBUG_KEYS off (the gate sets gdjs.__soulRushDebugGate) the
//    Debug_UI text is hidden instead. The readout is registered once for the whole game.
const gv = runtimeScene.getGame().getVariables();
const bump = function (key, name) {
  if (!gdjs.evtTools.input.wasKeyJustPressed(runtimeScene, key)) return;
  const v = gv.get(name), n = gv.get("BossCount").getAsNumber() || 5;   // 5 when no hub count has been worked out (a scene opened from the editor)
  v.setNumber((v.getAsNumber() + 1) % (n + 1));
};
bump("o", "MercyCount");
bump("b", "BrandCount");
if (!gdjs.__soulRushDebugCounts) {
  gdjs.__soulRushDebugCounts = true;
  gdjs.registerRuntimeScenePostEventsCallback(function (scene) {
    const boxes = scene.getObjects("Debug_UI");
    if (!boxes || !boxes.length) return;
    const g = scene.getGame().getVariables();
    const n = g.get("BossCount").getAsNumber();
    let text = "Brand: " + g.get("BrandCount").getAsNumber() + " / " + n + " | Mercy: " + g.get("MercyCount").getAsNumber() + " / " + n;
    const players = scene.getObjects("Player");
    if (players && players.length) {
      const pv = players[0].getVariables();
      text += "\nPerfect: " + pv.get("PerfectCount").getAsNumber() + (pv.get("PerfectForced").getAsNumber() ? " (forced)" : "") + " | Composure: " + (pv.get("ComposureOn").getAsNumber() ? "on" : "off");
    }
    for (const box of boxes) {
      if (gdjs.__soulRushDebugGate) { box.hide(true); continue; }
      const base = String(box.getText()).split("\nBrand: ")[0].split("Brand: ")[0];   // The scene's own text, without our lines.
      box.setText((base === "TEXT" || base === "" ? "" : base + "\n") + text);
    }
  });
}
