// Dash effects (docs/design-brand-mercy.md, phase 4): the Flash step and the Wraith dash draw the Samurai's flash step speed lines, in the player's
// colours. Player_Dash_Trail is a global sprite made by tools/fx/player_trails.js from his trail sheet (Samurai_Dash_Trail: 128x40, four bright-to-dark
// cells, stretched over the dash): animation "Flash" is gold and white, animation "Wraith" is green. It is placed the way his is (the left end at the
// smaller x, 60 px high, the top 30 px above the player's centre), grows with the dash, and when the dash ends it fades in the same five steps over
// 0.2 s (opacity 255, 190, 130, 75, 30, then gone). The dodge script (dodge.js) says which dodge is in progress (runtimeScene.__dodge.active); the
// plain roll draws nothing.
const dd = runtimeScene.__dodge;
const players = runtimeScene.getObjects("Player");
if (dd && players.length) {
  const player = players[0];
  const fx = runtimeScene.__dashFx || (runtimeScene.__dashFx = { run: null, fading: [] });
  const dt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000);
  const STEPS = [[0.04, 255], [0.08, 190], [0.12, 130], [0.16, 75], [0.2, 30]];   // Until this age the trail has this opacity; after 0.2 s it is gone.
  const cx = player.getCenterXInScene(), top = player.getCenterYInScene() - 30;
  const place = function (obj, sx, ex) { obj.setX(Math.min(sx, ex)); obj.setY(top); obj.setWidth(Math.max(4, Math.abs(ex - sx))); obj.setHeight(60); };
  const dashing = dd.active === "flash_step" || dd.active === "wraith_dash";
  if (fx.run && (!dashing || fx.run.kind !== dd.active)) {          // The dash ended (or changed): the trail stops growing and fades.
    place(fx.run.obj, fx.run.sx, cx);
    fx.fading.push({ obj: fx.run.obj, age: 0 });
    fx.run = null;
  }
  if (dashing && !fx.run) {                                           // A dash started.
    const obj = runtimeScene.createObject("Player_Dash_Trail");
    if (obj) {
      obj.setAnimationName(dd.active === "flash_step" ? "Flash" : "Wraith");
      obj.setZOrder(player.getZOrder() - 1);
      obj.setOpacity(255);
      fx.run = { kind: dd.active, sx: cx, obj: obj };
      place(obj, cx, cx);
    }
  } else if (fx.run) place(fx.run.obj, fx.run.sx, cx);                // It goes on: the trail grows with the player.
  for (let i = fx.fading.length - 1; i >= 0; i--) {
    const f = fx.fading[i];
    f.age += dt;
    const step = STEPS.find(function (s) { return f.age < s[0]; });
    if (!step) { f.obj.deleteFromScene(runtimeScene); fx.fading.splice(i, 1); } else f.obj.setOpacity(step[1]);
  }
}
