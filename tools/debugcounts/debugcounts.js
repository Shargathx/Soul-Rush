// Debug readout of the Brand and Mercy counts (docs/design-brand-mercy.md): adds a line "Brand: x / N | Mercy: y / N" to the text of the
// Debug_UI object that the fight scenes already have (the Samurai's event writes his debug text into it every frame). It runs after all the
// events of a frame, so it adds its line to whatever the scene wrote; the line is cut off and put back each frame, so it never piles up.
// With DEBUG_KEYS off (the gate sets gdjs.__soulRushDebugGate) the Debug_UI text is hidden instead. Registered once for the whole game.
if (!gdjs.__soulRushDebugCounts) {
  gdjs.__soulRushDebugCounts = true;
  gdjs.registerRuntimeScenePostEventsCallback(function (scene) {
    const boxes = scene.getObjects("Debug_UI");
    if (!boxes || !boxes.length) return;
    const g = scene.getGame().getVariables();
    const n = g.get("BossCount").getAsNumber();
    const line = "Brand: " + g.get("BrandCount").getAsNumber() + " / " + n + " | Mercy: " + g.get("MercyCount").getAsNumber() + " / " + n;
    for (const box of boxes) {
      if (gdjs.__soulRushDebugGate) { box.hide(true); continue; }
      const base = String(box.getText()).split("\nBrand: ")[0].split("Brand: ")[0];   // The scene's own text, without our line.
      box.setText((base === "TEXT" || base === "" ? "" : base + "\n") + line);
    }
  });
}
