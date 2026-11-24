// Dash effects (docs/design-brand-mercy.md, phase 4): the Flash step and the Wraith dash draw the Samurai's flash step speed lines, in the player's
// colours. Player_Dash_Trail is a global sprite made by tools/fx/player_trails.js from his trail sheet (Samurai_Dash_Trail: 128x40, four bright-to-dark
// cells, stretched over the dash): animation "Flash" is gold and white, animation "Wraith" is green. It is placed the way his is (the left end at the
// smaller x), but on the player's BODY, not on his 120x80 frame (the body is a 19x37 box low in the frame, so the frame's centre is about 20 px above it):
// TRAIL_H px high and centred on the middle of his collision box. It grows with the dash, and when the dash ends it fades smoothly over
// FADE seconds (the Samurai's fades in five steps over 0.2 s; the player's is a continuous ease-out, and its image is drawn smoothed, not as hard pixels). The dodge script (dodge.js) says which dodge is in progress (runtimeScene.__dodge.active); the
// plain roll draws nothing.
const dd = runtimeScene.__dodge;
const players = runtimeScene.getObjects("Player");
if (dd && players.length) {
  const player = players[0];
  const fx = runtimeScene.__dashFx || (runtimeScene.__dashFx = { run: null, fading: [] });
  const dt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000);
  const FADE = 0.3;                                                   // Seconds from full to gone, an ease-out (it lingers a little, then goes).
  const TRAIL_H = 50;
  const bodyBox = function (o) {      // The box of an object's collision mask (its hit boxes), in the scene: not its whole sprite frame.
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
    const boxes = o.getHitBoxes ? o.getHitBoxes() : [];
    for (const h of boxes) for (const v of h.vertices) { l = Math.min(l, v[0]); r = Math.max(r, v[0]); t = Math.min(t, v[1]); b = Math.max(b, v[1]); }
    if (l === Infinity && o.getAABBLeft) { l = o.getAABBLeft(); r = o.getAABBRight(); t = o.getAABBTop(); b = o.getAABBBottom(); }
    if (l === Infinity) { l = r = o.getCenterXInScene(); t = b = o.getCenterYInScene(); }
    return { l: l, r: r, t: t, b: b };
  };
  const me = bodyBox(player), cx = (me.l + me.r) / 2, cy = (me.t + me.b) / 2;                                              // The body, not the frame.
  const top = cy - TRAIL_H / 2;
  const place = function (obj, sx, ex) { obj.setX(Math.min(sx, ex)); obj.setY(top); obj.setWidth(Math.max(4, Math.abs(ex - sx))); obj.setHeight(TRAIL_H); };
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
    if (f.age >= FADE) { f.obj.deleteFromScene(runtimeScene); fx.fading.splice(i, 1); }
    else f.obj.setOpacity(Math.round(255 * Math.pow(1 - f.age / FADE, 1.6)));
  }
}
