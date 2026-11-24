// Dash effects (docs/design-brand-mercy.md, phase 4): what the Flash step and the Wraith dash look like. Drawn with PIXI in script, no new art, on the
// same logic as the Samurai's flash step (a dash line from where he was to where he is, pale still afterimages that fade, a puff where he vanishes).
// The dodge script (dodge.js) says which dodge is in progress (runtimeScene.__dodge.active); the plain roll draws nothing.
//   Flash step   a thin pale line from the start to the player, growing as he goes and fading after, and cool-tinted still copies of the player's
//                current frame left every FLASH_GAP px (the Samurai's afterimages), and a small white puff at both ends.
//   Wraith dash  green and smoky: soft green puffs left every SMOKE_GAP px that swell, rise and fade, a few dark-green copies of the frame, and a
//                bigger burst of smoke at both ends. No line: smoke has no edge.
// Everything fades and is destroyed (at most MAX things at once). A copy of the frame needs the player's PIXI sprite (getRendererObject); without it
// the line and the smoke still draw.
const dd = runtimeScene.__dodge;
const players = runtimeScene.getObjects("Player");
if (dd && players.length && typeof PIXI !== "undefined") {
  const player = players[0];
  const fx = runtimeScene.__dashFx || (runtimeScene.__dashFx = { things: [], run: null });
  const dt = Math.min(0.05, runtimeScene.getElapsedTime() / 1000);
  const FLASH_GAP = 34, SMOKE_GAP = 15, GHOST_GAP_WRAITH = 46, MAX = 70;
  const FLASH = { tint: 0xbfe0ff, line: 0xdff2ff }, WRAITH = { tint: 0x35c47d, smoke: [0x1f7a4d, 0x2fa36b, 0x6fe39a] };
  const src = (function () { try { return player.getRendererObject ? player.getRendererObject() : null; } catch (e) { return null; } })();
  let box = null;
  try { box = (src && src.parent) || runtimeScene.getLayer("").getRenderer().getRendererObject(); } catch (e) { box = null; }
  const cx = player.getCenterXInScene(), cy = player.getCenterYInScene();
  const add = function (thing) {
    if (!box) return;
    if (fx.things.length >= MAX) { const old = fx.things.shift(); if (old.obj.parent) old.obj.parent.removeChild(old.obj); if (old.obj.destroy) old.obj.destroy(); }
    box.addChild(thing.obj); fx.things.push(thing);
  };
  // A still copy of the player's current frame, tinted, that fades.
  const ghost = function (tint, alpha, life) {
    if (!src || !src.texture) return;
    const s = new PIXI.Sprite(src.texture);
    for (const k of ["position", "scale", "pivot", "anchor"]) if (s[k] && src[k] && s[k].copyFrom) s[k].copyFrom(src[k]);
    s.rotation = src.rotation || 0; s.tint = tint; s.alpha = alpha; s.zIndex = (src.zIndex || 0) - 1;
    add({ obj: s, age: 0, life: life, a0: alpha, kind: "ghost" });
  };
  // A soft puff that swells, rises and fades.
  const puff = function (x, y, color, alpha, r0, r1, life, rise) {
    const g = new PIXI.Graphics();
    g.beginFill(color, 1); g.drawCircle(0, 0, 1); g.endFill();
    g.x = x; g.y = y; g.alpha = alpha;
    add({ obj: g, age: 0, life: life, a0: alpha, kind: "puff", r0: r0, r1: r1, rise: rise, y0: y });
  };
  const burst = function (kind, x, y) {
    if (kind === "flash_step") { for (let i = 0; i < 3; i++) puff(x + (i - 1) * 8, y, 0xeaf6ff, 0.5, 8, 22, 0.28, 10); }
    else for (let i = 0; i < 7; i++) puff(x + (Math.random() - 0.5) * 36, y + (Math.random() - 0.5) * 36, WRAITH.smoke[i % 3], 0.5, 12, 38, 0.8, 38);
  };
  const dashing = dd.active === "flash_step" || dd.active === "wraith_dash";
  // A dash starts, goes on, or ends.
  if (dashing && (!fx.run || fx.run.kind !== dd.active)) {
    fx.run = { kind: dd.active, sx: cx, sy: cy, lx: cx, line: null };
    burst(dd.active, cx, cy);
    if (dd.active === "flash_step" && box) { const g = new PIXI.Graphics(); box.addChild(g); fx.run.line = { obj: g, age: 0, life: 99, a0: 1, kind: "line" }; fx.things.push(fx.run.line); }
  } else if (fx.run && dashing) {
    const run = fx.run, gap = run.kind === "flash_step" ? FLASH_GAP : SMOKE_GAP;
    while (Math.abs(cx - run.lx) >= gap) {
      run.lx += Math.sign(cx - run.lx) * gap;
      if (run.kind === "flash_step") ghost(FLASH.tint, 0.55, 0.3);
      else { puff(run.lx, cy + 6 + (Math.random() - 0.5) * 18, WRAITH.smoke[Math.floor(Math.random() * 3)], 0.42, 10, 30, 0.75, 30); if (Math.round(Math.abs(run.lx - run.sx) / gap) % 3 === 0) ghost(WRAITH.tint, 0.35, 0.4); }
    }
    if (run.line) { const g = run.line.obj; g.clear(); g.lineStyle(5, FLASH.line, 0.85); g.moveTo(run.sx, run.sy); g.lineTo(cx, cy); }
  } else if (fx.run && !dashing) {
    burst(fx.run.kind, cx, cy);
    if (fx.run.line) fx.run.line.life = 0.28;            // The line stops growing and fades.
    if (fx.run.line) fx.run.line.age = 0;
    fx.run = null;
  }
  // Everything ages, fades and goes.
  for (let i = fx.things.length - 1; i >= 0; i--) {
    const t = fx.things[i];
    if (t.kind === "line" && t.life === 99) continue;    // Still growing.
    t.age += dt;
    const k = Math.min(1, t.age / t.life);
    t.obj.alpha = t.a0 * (1 - k);
    if (t.kind === "puff") { const r = t.r0 + (t.r1 - t.r0) * k; t.obj.scale.set ? t.obj.scale.set(r, r) : (t.obj.scale = { x: r, y: r }); t.obj.y = t.y0 - t.rise * t.age; }
    if (t.age >= t.life) { if (t.obj.parent) t.obj.parent.removeChild(t.obj); if (t.obj.destroy) t.obj.destroy(); fx.things.splice(i, 1); }
  }
}
