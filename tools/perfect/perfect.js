// Perfect deflect mark (docs/design-brand-mercy.md, phase 3): a placeholder. When a deflect lands in the perfect window (the deflect events in
// Combat_Shared and the Gunslinger's scene add one to Player.PerfectCount), a small gold "PERFECT" rises and fades above the player, so the
// timing can be seen and tuned (Player.PerfectFraction, PerfectForced on debug key P). It reads the count and keeps its own "seen" number, which is
// how every power should read it: it does not matter which event sheet runs first. Real art can replace the text later.
const players = runtimeScene.getObjects("Player");
if (players.length && typeof PIXI !== "undefined") {
  const player = players[0], pv = player.getVariables();
  const count = pv.get("PerfectCount").getAsNumber();
  const st = runtimeScene.__perfectMark || (runtimeScene.__perfectMark = { seen: count, marks: [] });
  const LIFE = 0.7, RISE = 28;                                            // Seconds the mark lasts, and how far it rises.
  const dt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000);
  let root = null;
  try { root = runtimeScene.getLayer("").getRenderer().getRendererObject(); } catch (e) { root = null; }
  if (count < st.seen) st.seen = count;                                   // The count was reset (a new fight).
  if (count > st.seen) {
    st.seen = count;
    if (root) {
      const text = new PIXI.Text("PERFECT", { fontFamily: "Georgia, serif", fontSize: 20, fontWeight: "bold", fill: 0xf2d27a, stroke: 0x000000, strokeThickness: 4 });
      if (text.anchor) text.anchor.set(0.5);
      text.zIndex = 1000002;
      root.addChild(text);
      st.marks.push({ text: text, age: 0, x: player.getCenterXInScene(), y: player.getCenterYInScene() - player.getHeight() / 2 - 14 });
    }
  }
  for (let i = st.marks.length - 1; i >= 0; i--) {
    const m = st.marks[i];
    m.age += dt;
    const k = Math.min(1, m.age / LIFE);
    m.text.x = m.x; m.text.y = m.y - RISE * k; m.text.alpha = 1 - k * k;
    if (m.age >= LIFE) { if (m.text.destroy) m.text.destroy(); st.marks.splice(i, 1); }
  }
}
