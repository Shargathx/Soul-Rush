// Arena ambience: one function shared by the browser preview and the GDevelop JS event.
// scene: { getObjects(name) -> objects with getX/setX/getY/setY/setOpacity, dt (seconds), pixiLayer }
// arena: one entry from arenas.js (only items[].name/at/alpha/anim and ambient are used).
function arenaAmbience(scene, arena, state) {
  const dt = scene.dt;
  state.time = (state.time || 0) + dt;
  const t = state.time;
  if (!state.base) state.base = {};
  if (!state.alphaSet) {
    // Starting opacity for see-through props (fog, clouds), set once.
    state.alphaSet = true;
    for (const item of arena.items) if (item.alpha !== undefined)
      scene.getObjects(item.name).forEach(function (o) { o.setOpacity(item.alpha * 255); });
  }
  for (const item of arena.items) {
    if (!item.anim) continue;
    const objs = scene.getObjects(item.name);
    const baseAlpha = (item.alpha === undefined ? 1 : item.alpha) * 255;
    objs.forEach(function (o, i) {
      const key = item.name + "#" + i;
      if (!state.base[key]) state.base[key] = { x: o.getX(), y: o.getY(), phase: i * 1.7 + item.name.length };
      const b = state.base[key];
      const a = item.anim;
      if (a.type === "drift") {
        // Wrap around the screen. Wide images (clouds) wrap at their own span.
        const w = a.wrap || 1280 + 600;
        let x = b.x + a.speed * t;
        x = ((x + 300) % w + w) % w - 300;
        o.setX(x);
      } else if (a.type === "bob") {
        o.setY(b.y + Math.round(Math.sin(t * 2 * Math.PI / a.period + b.phase) * a.amp));
      } else if (a.type === "pulse") {
        const k = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI / a.period + b.phase);
        o.setOpacity(baseAlpha * (a.min + (a.max - a.min) * k));
      } else if (a.type === "flicker") {
        const k = 0.88 + 0.12 * Math.sin(t * 13 + b.phase) * Math.sin(t * 7.3);
        o.setOpacity(baseAlpha * k);
      }
    });
  }
  // Fireflies: soft dots that wander and blink, drawn on the background layer.
  const ff = arena.ambient && arena.ambient.fireflies;
  if (ff && scene.pixiLayer) {
    if (!state.flies) {
      state.flies = [];
      state.container = new PIXI.Container();
      state.container.zIndex = ff.z || 900; // Above the backdrop, below the floor strip (z 1000) and fighters.
      scene.pixiLayer.addChild(state.container);
      const g = new PIXI.Graphics();
      g.beginFill(0xffffff, 0.25); g.drawCircle(4, 4, 4); g.endFill();
      g.beginFill(0xffffff, 1); g.drawRect(3, 3, 2, 2); g.endFill();
      state.texture = scene.renderer.generateTexture(g);
      const ar = ff.area;
      for (let i = 0; i < ff.count; i++) {
        const s = new PIXI.Sprite(state.texture);
        s.anchor.set(0.5); s.tint = ff.color;
        state.container.addChild(s);
        state.flies.push({ s: s, x: ar[0] + Math.random() * (ar[2] - ar[0]), y: ar[1] + Math.random() * (ar[3] - ar[1]),
          vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 12, p: Math.random() * 10, rate: 0.6 + Math.random() * 0.9 });
      }
    }
    const ar = ff.area;
    for (const f of state.flies) {
      f.vx += (Math.random() - 0.5) * 30 * dt; f.vy += (Math.random() - 0.5) * 20 * dt;
      f.vx = Math.max(-22, Math.min(22, f.vx)); f.vy = Math.max(-14, Math.min(14, f.vy));
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < ar[0] || f.x > ar[2]) f.vx = -f.vx;
      if (f.y < ar[1] || f.y > ar[3]) f.vy = -f.vy;
      f.x = Math.max(ar[0], Math.min(ar[2], f.x)); f.y = Math.max(ar[1], Math.min(ar[3], f.y));
      f.p += dt * f.rate;
      f.s.alpha = Math.max(0, Math.sin(f.p * 2)) * 0.9;
      f.s.x = Math.round(f.x); f.s.y = Math.round(f.y);
    }
  }
}
if (typeof module !== "undefined") module.exports = arenaAmbience;
