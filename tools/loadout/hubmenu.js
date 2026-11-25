// The altar's loadout screen (docs/design-brand-mercy.md, phase 4). These lines are not a script of their own: tools/hub/build.js splices them into
// the hub's interactions script, where st, input, pv, player, progress, POWERS, KEY, PIXI and the functions of menu.js, tidy and equip exist.
// F at the altar opens a dark panel over the hub: W / S choose a row (the three powers on R, then the dodge), A / D change it, F or Esc close.
// The loadout is saved at once in the hub's progress (localStorage); the gates script tidies it and writes the globals the fights read.
const EMPTY_LOADOUT = { slots: ["", "", ""], dodge: "roll" };
const ownedNow = function () { return runtimeScene.getGame().getVariables().get("PowersOwned").getAsString().split(",").filter(Boolean); };
const saveProgress = function () { try { localStorage.setItem("SoulRush.progress", JSON.stringify(progress)); } catch (e) {} };
const drawMenu = function () {
  const m = st.menu;
  if (m) m.text.text = menuText(POWERS, progress.loadout || EMPTY_LOADOUT, ownedNow(), m.row);
};
const openMenu = function () {
  const game = runtimeScene.getGame(), root = runtimeScene.getLayer("UI").getRenderer().getRendererObject();
  const w = game.getGameResolutionWidth(), h = game.getGameResolutionHeight();
  const panel = new PIXI.Graphics();
  panel.beginFill(0x000000, 0.84); panel.drawRect(w / 2 - 330, h / 2 - 250, 660, 500); panel.endFill();
  panel.zIndex = 900000;
  const text = new PIXI.Text("", { fontFamily: "Georgia, serif", fontSize: 19, fill: 0xe8dcc0, lineHeight: 27 });
  text.x = w / 2 - 300; text.y = h / 2 - 230; text.zIndex = 900001;
  root.addChild(panel); root.addChild(text);
  st.menu = { row: 0, panel: panel, text: text };
  pv.get("ControlsLocked").setBoolean(true);
  const pb = player.getBehavior("PlatformerObject"); if (pb) pb.setCurrentSpeed(0);
  player.setAnimationName("Player_Idle");
  drawMenu();
};
const closeMenu = function () {
  const m = st.menu;
  if (m) { for (const o of [m.panel, m.text]) { if (o.parent) o.parent.removeChild(o); if (o.destroy) o.destroy(); } }
  st.menu = null;
  pv.get("ControlsLocked").setBoolean(false);
};
if (st.menu) {
  const m = st.menu;
  const keyDown = function (keys) { return keys.some(function (k) { return input.wasKeyJustPressed(runtimeScene, k); }); };
  if (keyDown(["s", "Down"])) m.row = (m.row + 1) % 4;
  if (keyDown(["w", "Up"])) m.row = (m.row + 3) % 4;
  const dir = keyDown(["d", "Right"]) ? 1 : keyDown(["a", "Left"]) ? -1 : 0;
  if (dir) { progress.loadout = cycle(POWERS, progress.loadout || EMPTY_LOADOUT, ownedNow(), m.row, dir); gdjs.__soulRushDebugDodge = null; saveProgress(); }
  if (keyDown([KEY, "Return", "Escape"])) closeMenu(); else drawMenu();
  const shown = runtimeScene.getObjects("Hub_Prompt"); if (shown.length) shown[0].hide(true);
  return;
}
