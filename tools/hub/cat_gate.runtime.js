// Runtime for the cat tree gate's extras. tools/hub/build.js puts this text in a script event of HUB_Area, after a line that defines CFG
// ({ saveKey, scene, ground, purrs }). It is not run by node.
//   - Scratch marks: every lost attempt at the cat fight (counted by the death menu in Combat_Shared in the saved progress, under
//     progress.attempts) adds a group of three claw marks to the sisal posts; Start over wipes them with the rest of the progress.
//   - A ball of yarn on the floor to the right of the gate: it rolls away when the player runs or rolls past it, comes to rest, and
//     drifts home after a while.
//   - A purr when the player is near the gate while the cat is still on its perch (not once the fight is won): a placeholder voice.
const gates = runtimeScene.getObjects("Hub_Gate_Cat");
if (gates.length === 0 || typeof PIXI === "undefined") return;
const g = gates[0];
const time = runtimeScene.getTimeManager();
const dt = Math.min(0.05, time.getElapsedTime() / 1000 / Math.max(0.0001, time.getTimeScale()));
const st = runtimeScene.__catGate || (runtimeScene.__catGate = { attempts: -1, poll: 0, scratches: null, ball: null, lastPx: null, purr: 3 });
const root = runtimeScene.getLayer(g.getLayer()).getRenderer().getRendererObject();
const gx = g.getX(), gy = g.getY(), R = 13;
const seeded = function (seed) { return function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; };

function drawScratches() {
  if (st.scratches) { st.scratches.destroy(); st.scratches = null; }
  if (st.attempts <= 0) return;
  const s = new PIXI.Graphics();
  s.zIndex = g.getZOrder() + 5;
  for (let k = 0; k < Math.min(st.attempts, 48); k++) {
    const post = k % 2, row = Math.floor(k / 2) % 6, extra = Math.floor(k / 12), rnd = seeded(k + 1);
    const cx = gx + (post ? 98 : 30) * 2 + (rnd() - 0.5) * 8 + extra * 3, cy = gy + (46 + row * 11) * 2 + (rnd() - 0.5) * 6, lean = 0.35 + (rnd() - 0.5) * 0.3;
    for (let i = -1; i <= 1; i++) {
      const ox = cx + i * 6;
      s.lineStyle(2, 0x5a3f22, 1); s.moveTo(ox - 8 * lean, cy - 10); s.lineTo(ox + 8 * lean, cy + 10);
      s.lineStyle(1, 0xf2dca4, 1); s.moveTo(ox - 8 * lean + 2, cy - 10); s.lineTo(ox + 8 * lean + 2, cy + 10);
    }
  }
  root.addChild(s); st.scratches = s;
}
st.poll -= dt;
if (st.poll <= 0) {
  st.poll = 1;
  let n = 0;
  try { const p = JSON.parse(localStorage.getItem(CFG.saveKey) || "null"); n = (p && p.attempts && p.attempts[CFG.scene]) || 0; } catch (e) {}
  if (n !== st.attempts) { st.attempts = n; drawScratches(); }
}

// The yarn ball.
const floorY = gy + (CFG.ground + 1) * 2, LO = gx + 252, HI = gx + 520;
if (!st.ball) {
  const c = new PIXI.Container(), b = new PIXI.Graphics();
  b.beginFill(0x8a2c3c, 1); b.drawCircle(0, 0, R); b.endFill(); b.beginFill(0xcc4455, 1); b.drawCircle(-1, -1, R - 1.5); b.endFill();
  b.lineStyle(2, 0xee8899, 1);
  b.moveTo(-10, -3); b.lineTo(8, -9); b.moveTo(-11, 3); b.lineTo(11, -3); b.moveTo(-8, 9); b.lineTo(10, 5); b.moveTo(-3, -12); b.lineTo(5, 12);
  b.lineStyle(2, 0xcc4455, 1); b.moveTo(11, 8); b.lineTo(23, 11);                 // a loose end of yarn
  c.addChild(b); c.zIndex = g.getZOrder() + 6; root.addChild(c);
  st.ball = { c: c, x: gx + 268, home: gx + 268, vx: 0, idle: 0 };
}
const ball = st.ball, players = runtimeScene.getObjects("Player");
if (players.length) {
  const px = players[0].getCenterXInScene();
  if (st.lastPx !== null) {
    const pv = (px - st.lastPx) / Math.max(dt, 1 / 120);
    if (Math.abs(px - ball.x) < 36 && Math.abs(pv) > 70) { ball.vx = Math.max(-650, Math.min(650, pv * 0.9 + (pv > 0 ? 90 : -90))); ball.idle = 0; }
  }
  st.lastPx = px;
}
ball.x += ball.vx * dt; ball.vx *= Math.pow(0.35, dt);
if (ball.x < LO) { ball.x = LO; ball.vx = Math.abs(ball.vx) * 0.4; }
if (ball.x > HI) { ball.x = HI; ball.vx = -Math.abs(ball.vx) * 0.4; }
if (Math.abs(ball.vx) < 6) { ball.vx = 0; ball.idle += dt; if (ball.idle > 10) ball.x += Math.sign(ball.home - ball.x) * Math.min(Math.abs(ball.home - ball.x), 40 * dt); } else ball.idle = 0;
ball.c.rotation += ball.vx * dt / R;
ball.c.x = ball.x; ball.c.y = floorY - R;

// The purr.
const shown = g.getVariables().get("Shown").getAsString();
if (players.length && shown !== "completed") {
  const d = Math.abs(players[0].getCenterXInScene() - (gx + 128));
  st.purr -= dt;
  if (d < 320 && st.purr <= 0) {
    runtimeScene.getGame().getSoundManager().playSound(CFG.purrs[Math.floor(Math.random() * CFG.purrs.length)], false, Math.round(10 + 22 * (1 - d / 320)), 0.95 + Math.random() * 0.1);
    st.purr = 3.5 + Math.random() * 3;
  }
}
