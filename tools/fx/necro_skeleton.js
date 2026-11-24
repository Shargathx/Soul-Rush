// Draws the Necromancer's summoned skeleton: 44 x 42 frames (drawn at 3x in the fight, so about the player's height), facing right,
// feet on the bottom row, a rusty notched sword in the front hand. The skeleton is a little rig (hip, spine, neck, skull, two arms
// and two legs as angles), so every animation is a list of poses, and the crumble can drop each bone on its own.
//   Rise     8 frames  a hand claws out of the dirt, then it climbs out (clipped at the ground) with clods flying
//   Walk     6 frames  a shambling walk: legs and arms swing, the skull bobs
//   Windup   3 frames  the sword goes back over its shoulder (its eyes flare: the tell)
//   Swing    3 frames  the cut: forward and down (the attack box comes with frame 1)
//   Stagger  2 frames  knocked back by a deflect: leaning away, arms out
//   Crumble  8 frames  it falls apart: the bones drop and scatter, the skull bounces, then the pile fades
// Each animation is drawn twice: green eyes (phase 1) and red eyes (phase 2), the second set named <Anim>_P2.
// Output: assets/Enemies/Necromancer/skeleton/<anim>[_p2]_NN.png
// Run: node tools/fx/necro_skeleton.js
const fs = require("fs");
const path = require("path");
const png = require("../bosses/png.js");

const W = 44, H = 42, GROUND = 41;
const ROOT = path.join(__dirname, "..", "..");
const DIR = "assets/Enemies/Necromancer/skeleton/";
const BONE = [[232, 226, 204], [192, 184, 158], [132, 124, 104]], INK = [24, 20, 30], RUST = [[150, 96, 64], [110, 66, 46]], STEEL = [[170, 170, 178], [120, 120, 130]];
const DIRT = [[82, 64, 70], [58, 46, 54]];
const EYES = { p1: [[150, 255, 170], [80, 220, 120]], p2: [[255, 150, 140], [230, 60, 60]] };

function canvas() { const c = { data: Buffer.alloc(W * H * 4) }; return c; }
const set = (c, x, y, col, a = 255) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const p = (y * W + x) * 4; c.data[p] = col[0]; c.data[p + 1] = col[1]; c.data[p + 2] = col[2]; c.data[p + 3] = a; };
const alpha = (c, x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : c.data[(y * W + x) * 4 + 3];
const line = (c, x0, y0, x1, y1, col, thick) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; set(c, x, y, col); if (thick) set(c, x, y + 1, col); } };
const rad = d => d * Math.PI / 180;
const at = (p, len, deg) => [p[0] + Math.cos(rad(deg)) * len, p[1] + Math.sin(rad(deg)) * len];   // 0 deg = right, 90 = down
function outline(c, keepAbove) {
  const add = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!alpha(c, x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => alpha(c, x + dx, y + dy) > 200)) add.push([x, y]);
  for (const [x, y] of add) if (y <= keepAbove) set(c, x, y, INK);
}

// A pose: angles in degrees (0 right, 90 down), plus a body offset. Arms: shoulder->elbow, elbow->hand. Legs: hip->knee, knee->foot.
const POSE = (o) => Object.assign({ dx: 0, dy: 0, lean: 0, head: 0, bArm: [100, 80], fArm: [80, 40], bLeg: [95, 95], fLeg: [85, 95], sword: 20 }, o);
// Builds the bones of a pose as segments, so the crumble can move them one by one.
function bones(p) {
  const hip = [21 + p.dx, 29 + p.dy];
  const neck = at(hip, 9, -90 + p.lean);
  const skull = at(neck, 3.5, -90 + p.lean + p.head);
  const seg = [];
  // Legs: thigh 6, shin 6.
  for (const [k, leg] of [["bLeg", p.bLeg], ["fLeg", p.fLeg]]) { const knee = at(hip, 6, leg[0]), foot = at(knee, 6, leg[1]); seg.push({ kind: "line", a: hip, b: knee, col: k === "bLeg" ? BONE[2] : BONE[1], back: k === "bLeg" }, { kind: "line", a: knee, b: foot, col: k === "bLeg" ? BONE[2] : BONE[1], back: k === "bLeg" }, { kind: "foot", a: foot, col: k === "bLeg" ? BONE[2] : BONE[1], back: k === "bLeg" }); }
  seg.push({ kind: "pelvis", a: hip, col: BONE[1] });
  seg.push({ kind: "spine", a: hip, b: neck, col: BONE[1], lean: p.lean });
  seg.push({ kind: "ribs", a: hip, b: neck, col: BONE[0], lean: p.lean });
  // Arms: upper 5, fore 5; the sword in the front hand.
  const shoulder = at(neck, 1.5, 90 + p.lean);
  for (const [k, arm] of [["bArm", p.bArm], ["fArm", p.fArm]]) {
    const el = at(shoulder, 5, arm[0]), hand = at(el, 5, arm[1]);
    seg.push({ kind: "line", a: shoulder, b: el, col: k === "bArm" ? BONE[2] : BONE[0], back: k === "bArm" }, { kind: "line", a: el, b: hand, col: k === "bArm" ? BONE[2] : BONE[0], back: k === "bArm" });
    if (k === "fArm") seg.push({ kind: "sword", a: hand, deg: p.sword });
  }
  seg.push({ kind: "skull", a: skull, tilt: p.head + p.lean });
  return seg;
}
function drawSeg(c, s, eyes, off) {
  const [ox, oy] = off || [0, 0], A = [s.a[0] + ox, s.a[1] + oy], B = s.b ? [s.b[0] + ox, s.b[1] + oy] : null;
  if (s.kind === "line") line(c, A[0], A[1], B[0], B[1], s.col, false);
  else if (s.kind === "foot") { set(c, A[0], A[1], s.col); set(c, A[0] + 1, A[1], s.col); set(c, A[0] + 2, A[1], s.col); }
  else if (s.kind === "pelvis") { line(c, A[0] - 2, A[1], A[0] + 2, A[1], s.col); set(c, A[0] - 2, A[1] + 1, s.col); set(c, A[0] + 2, A[1] + 1, s.col); }
  else if (s.kind === "spine") line(c, A[0], A[1], B[0], B[1], s.col);
  else if (s.kind === "ribs") for (let k = 0; k < 3; k++) { const t = 0.45 + k * 0.17, x = A[0] + (B[0] - A[0]) * t, y = A[1] + (B[1] - A[1]) * t, w = 3 - (k === 0 ? 1 : 0); line(c, x - w + 1, y, x + w, y, s.col); set(c, x - w, y + 1, BONE[2]); set(c, x + w + 1, y + 1, BONE[2]); }
  else if (s.kind === "sword") {
    const tip = at(A, 11, s.deg), guardA = at(A, 2, s.deg - 90), guardB = at(A, 2, s.deg + 90), pom = at(A, 2, s.deg + 180);
    line(c, A[0], A[1], tip[0], tip[1], STEEL[0]); const mid = at(A, 6, s.deg); set(c, mid[0], mid[1], RUST[0]); const n2 = at(A, 9, s.deg); set(c, n2[0], n2[1], STEEL[1]);
    line(c, guardA[0], guardA[1], guardB[0], guardB[1], RUST[1]); set(c, pom[0], pom[1], RUST[0]);
  } else if (s.kind === "skull") {
    const [x, y] = A;
    for (let dy = -3; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx * 0.8 + dy * dy <= 9.5) set(c, x + dx, y + dy, dy < -1 ? BONE[0] : BONE[1]);
    for (let dx = -1; dx <= 2; dx++) set(c, x + dx, y + 3, BONE[2]);                          // jaw
    set(c, x, y + 4, BONE[2]); set(c, x + 2, y + 4, BONE[2]);
    if (eyes) { set(c, x, y, eyes[0]); set(c, x + 2, y, eyes[0]); set(c, x, y - 1, eyes[1]); }   // sockets lit (facing right)
    else { set(c, x, y, INK); set(c, x + 2, y, INK); }
    set(c, x + 1, y + 2, INK);                                                                 // nose
  }
}
function draw(pose, eyes, opts = {}) {
  const c = canvas(), segs = bones(pose);
  const back = segs.filter(s => s.back), front = segs.filter(s => !s.back);
  for (const s of back) drawSeg(c, s, null, opts.off && opts.off(s));
  for (const s of front) drawSeg(c, s, s.kind === "skull" ? eyes : null, opts.off && opts.off(s));
  outline(c, opts.clip !== undefined ? opts.clip : H);
  if (opts.clip !== undefined) for (let y = opts.clip + 1; y < H; y++) for (let x = 0; x < W; x++) set(c, x, y, [0, 0, 0], 0);   // under the ground
  return c;
}
function dirt(c, k, seed) {
  // The broken ground at its feet while it climbs out, and clods thrown up.
  for (let x = 13; x < 31; x++) { const h = Math.round(1 + 1.5 * Math.sin(x * 1.7 + seed)); for (let y = GROUND - h + 1; y <= GROUND; y++) if (!alpha(c, x, y)) set(c, x, y, DIRT[(x + y) % 3 ? 1 : 0]); }
  for (let i = 0; i < 5; i++) { const x = 15 + i * 3.5 + Math.sin(i * 2 + seed) * 2, y = GROUND - 2 - k * (6 + i % 3 * 3) + k * k * 8; set(c, x, y, DIRT[i % 2]); set(c, x + 1, y, DIRT[1]); }
}

const STAND = POSE({});
const ANIMS = {
  Walk: [0, 1, 2, 3, 4, 5].map(i => { const s = Math.sin(i / 6 * Math.PI * 2), b = Math.abs(Math.cos(i / 6 * Math.PI * 2)); return POSE({ dy: Math.round(-b), lean: 4, head: s * 4, bLeg: [90 - s * 26, 95 - s * 10], fLeg: [90 + s * 26, 95 + s * 10], bArm: [95 + s * 25, 75 + s * 10], fArm: [70 - s * 15, 30 - s * 10], sword: 10 - s * 10 }); }),
  Windup: [0, 1, 2].map(i => POSE({ lean: -3 - i * 3, head: -4, fArm: [-70 - i * 15, -95 - i * 12], bArm: [60, 40], sword: -100 - i * 14, bLeg: [100, 95], fLeg: [70, 100] })),
  Swing: [0, 1, 2].map(i => POSE({ lean: 8 + i * 4, head: 6, fArm: [-20 + i * 30, 0 + i * 35], bArm: [130, 110], sword: -10 + i * 40, bLeg: [110, 100], fLeg: [60, 100], dx: 1 + i })),
  Stagger: [0, 1].map(i => POSE({ dx: -2 - i, lean: -16 - i * 6, head: -12, fArm: [-40, -70], bArm: [-140, -170], sword: -90, bLeg: [70, 100], fLeg: [110, 90] }))
};
const frames = {};
for (const [set2, eyes] of [["p1", EYES.p1], ["p2", EYES.p2]]) {
  const suf = set2 === "p1" ? "" : "_P2";
  for (const a of Object.keys(ANIMS)) frames[a + suf] = ANIMS[a].map((p, i) => draw(p, a === "Windup" ? [eyes[0], eyes[0]] : eyes));
  // Rise: a hand first, then it climbs out, clipped at the ground.
  frames["Rise" + suf] = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
    const k = Math.min(1, Math.max(0, (i - 1) / 6)), up = Math.round((1 - k) * 30);
    const c = i === 0 ? canvas() : draw(POSE({ dy: up, lean: 10 - k * 10, head: 8 - 8 * k, fArm: [-60 + k * 140, -80 + k * 110], bArm: [-100 + k * 200, -110 + k * 190], sword: -60 + 80 * k }), i > 2 ? eyes : null, { clip: GROUND - 1 });
    if (i === 0) { line(c, 24, GROUND - 1, 24, GROUND - 4, BONE[1]); set(c, 23, GROUND - 5, BONE[1]); set(c, 25, GROUND - 5, BONE[1]); set(c, 24, GROUND - 5, BONE[0]); outline(c, GROUND - 1); }
    dirt(c, i / 7, i); return c;
  });
  // Crumble: every bone falls with its own speed and spin direction; the skull bounces once; then the pile fades.
  frames["Crumble" + suf] = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
    const t = i / 5, segs = bones(STAND);
    const off = s => {
      const idx = segs.indexOf(s), drift = (idx % 3 - 1) * (2 + idx % 4) * Math.min(1, t), fall = Math.max(0, GROUND - 1 - Math.max(s.a[1], s.b ? s.b[1] : s.a[1]));
      let dy = Math.min(fall, 30 * t * t);
      if (s.kind === "skull") { const land = Math.sqrt(fall / 30); dy = t < land ? 30 * t * t : fall - Math.max(0, 3 * Math.sin((t - land) * 6)); return [drift + 4 * t, Math.min(fall, dy)]; }
      return [drift, dy];
    };
    const c = draw(STAND, i < 2 ? EYES[set2] : null, { off });
    if (i >= 6) for (let p = 3; p < c.data.length; p += 4) c.data[p] = Math.round(c.data[p] * (i === 6 ? 0.6 : 0.3));
    return c;
  });
}

fs.mkdirSync(path.join(ROOT, DIR), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, DIR))) if (f.endsWith(".png")) fs.unlinkSync(path.join(ROOT, DIR, f));
const written = {};
for (const [name, list] of Object.entries(frames)) {
  written[name] = list.map((c, i) => { const rel = DIR + name.toLowerCase() + "_" + String(i).padStart(2, "0") + ".png"; png.encode({ w: W, h: H, data: c.data }, path.join(ROOT, rel)); return rel; });
}
console.log("necro_skeleton: " + Object.values(written).flat().length + " frames in " + DIR);
module.exports = { written, W, H };
