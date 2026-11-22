// The Cat: what tools/bosses/build.js needs to make the fight. Sprites come from "Cat 50+ Animations" (a 256x1632 sheet of
// 32x32 cells, one animation per row; the aseprite file in assets (raw) names them). Close GDevelop before running the build.
const fs = require("fs");
const path = require("path");
const png = require("./png.js");
const L = require("./lib.js");

const SHEET = "assets (raw)/Cat 50+ Animations/Cat 50 Animations/Cat-Sheet.png";
const DIR = "assets/Enemies/Cat/";
const SCALE = 7;            // 32 px cells drawn at 7x: a 224 px frame, the cat's body about 140 px long.
const CELL = 32;
// Animations: sheet rows (8 cells wide; empty cells are skipped), time per frame, loop. The names are what cat.js plays.
const ANIMS = [
  { name: "idle", rows: [2], dt: 0.12, loop: true },        // Idle_1: standing, tail twitching
  { name: "sit", rows: [0], dt: 0.14, loop: true },         // Sit_1
  { name: "eat", rows: [31, 32], dt: 0.14, loop: true },    // Eat_1, Eat_2
  { name: "walk", rows: [4], dt: 0.1, loop: true },        // W_1
  { name: "run", rows: [5], dt: 0.06, loop: true },        // W_2, fast
  { name: "dash", rows: [7, 8], dt: 0.06, loop: true },    // Run_1, Rum_2: the stretched out sprint
  { name: "creep", rows: [12], dt: 0.12, loop: true },     // Creep_Up
  { name: "crawl", rows: [13], dt: 0.12, loop: true },     // Crawl
  { name: "stop", rows: [16], dt: 0.08 },                  // Stop: the skid
  { name: "aggress", rows: [17], dt: 0.1 },                // Aggress: the hiss, fur up
  { name: "pounce", rows: [18], dt: [0.1, 0.1, 0.07, 0.07, 0.07, 0.07, 0.1, 0.1] }, // J_1: crouch, crouch, leap x4, land, recover
  { name: "jumpUp", rows: [19], dt: 0.08 },                // J_2
  { name: "jumpDown", rows: [20], dt: 0.08 },              // J_3
  { name: "atk1", rows: [38], dt: 0.07 }, { name: "atk2", rows: [39], dt: 0.07 }, { name: "atk3", rows: [40], dt: 0.07 },
  { name: "atk4", rows: [41], dt: 0.07 }, { name: "atk5", rows: [42], dt: 0.08 },
  { name: "hurt", rows: [33], dt: 0.12 },                  // Dmg
  { name: "death", rows: [34, 36], dt: 0.1 },              // Death_1 (8) then Deat_End (4): knocked flat, stays down
  { name: "spawn", rows: [37], dt: 0.1 },                  // Spawn_2: the ghost-cat halo, then the cat solidifies
  { name: "rest_in", rows: [9], dt: 0.1 },                 // Rest_1: lying down
  { name: "rest", rows: [10], dt: 0.14, loop: true },      // Rest_2: the loaf
  { name: "dream", rows: [11], dt: 0.16, loop: true },     // Dream: dozing
  { name: "sitUp", rows: [14], dt: 0.1 },                  // Sit_Up
  { name: "sitDown", rows: [15], dt: 0.1 },                // Sit_Down
  { name: "dig", rows: [43, 44], dt: 0.09 },               // Dig_1, Dig_2
  { name: "rear", rows: [46, 47], dt: [0.07, 0.07, 0.07, 0.07, 0.07, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.07, 0.07, 0.07, 0.07, 0.07] }, // On_2_Paws, On_4_Paws: up on the hind legs and down
  { name: "scratch", rows: [48], dt: 0.07 },               // Scratching: standing, clawing
  { name: "bowPlay", rows: [23, 24], dt: 0.1 }             // B_I_1, B_I_2: the play bow
];

// Where the swipes appear, in sheet pixels (32 x 32 cell, the cat faces right, origin at the bottom middle): Point2 in front, Point behind.
// Eye: the glint's place (the default is the idle frame's eye; every frame gets the dark pixel found inside its head, move it in the editor if it is off).
const POINTS = { Point: [4.5, 27], Point2: [29.5, 27], Eye: [20.5, 22.5] };
const VARS = {
  JustHitByPlayer: false, AIState: "Intro", Health: 120, MaxHealth: 120, Lives: 3, Posture: 0, MaxPosture: 70, PostureDamage: 20, StunDuration: 3,
  DeathblowOrbDrop: 0, IsPostureBroken: false, JustPostureBroken: false, JustRecovered: false, JustHitPlayer: false, JustDodgedHit: false,
  JustLostLife: false, JustDied: false, JustDeflected: false, JustStaggered: false, Invulnerable: false, WillDodgeHit: false, HasDeathAnimation: true,
  MeleeDamagesPosture: true, DeflectAnySide: 0, AimX: -1, PostureRegenDelay: 1.2, PostureRegenFull: 5, PostureRegenEmpty: 2, DeathHold: 0, LifeHold: 0, StateT: 0,
  // Tuning (cat.js): damage per hit, speeds in px/s, the dodge cooldown in seconds.
  SwipeDamage: 10, PounceDamage: 14, DashDamage: 12, ScratchDamage: 8, MaulDamage: 22, BurrowDamage: 14,
  WalkSpeed: 200, PeaceSpeed: 150, RunSpeed: 520, DashSpeed: 1150, MoundSpeed: 320, DodgeCooldown: 2.5
};

// The cat's sounds (tools/fx/cat_sounds.js); a missing list is just silence.
const SFX = { meow: [1, 2, 3, 4].map(k => "assets/Sfx/cat/meow_" + k + ".wav"), hiss: [1, 2, 3].map(k => "assets/Sfx/cat/hiss_" + k + ".wav"), purr: [1, 2].map(k => "assets/Sfx/cat/purr_" + k + ".wav") };   // purr: played by the hub at the cat tree

// The points the artist placed in the editor (layouts/cat_fight.json as last saved): { animation: [ { Point: [x, y], Point2: [x, y] } per frame ] }.
// The build rewrites that file, so it reads them first and writes them back.
function savedPoints() {
  const out = {}; let scene = null;
  try { scene = L.readJson("layouts/cat_fight.json"); } catch (e) { return out; }
  const cat = (scene.objects || []).find(o => o.name === "Cat"); if (!cat) return out;
  for (const a of cat.animations || []) out[a.name] = ((a.directions && a.directions[0] && a.directions[0].sprites) || []).map(s => { const m = {}; for (const p of s.points || []) if (p.name === "Point" || p.name === "Point2" || p.name === "Eye") m[p.name] = [p.x, p.y]; return m; });
  return out;
}
// The eye: the topmost dark pixel with colour on all four sides (the outline is dark too, but it always touches empty space or
// other dark pixels). Null when a frame has none (the cat facing away, curled up): then the default is used.
function findEye(cell) {
  const px = (x, y) => { if (x < 0 || y < 0 || x >= CELL || y >= CELL) return null; const p = (y * CELL + x) * 4, d = cell.data; return d[p + 3] < 200 ? null : [d[p], d[p + 1], d[p + 2]]; };
  const dark = c => c && c[0] < 70 && c[1] < 70 && c[2] < 90, solid = c => c && !dark(c);
  for (let y = 0; y < CELL; y++) for (let x = CELL - 1; x >= 0; x--) if (dark(px(x, y)) && solid(px(x - 1, y)) && solid(px(x + 1, y)) && solid(px(x, y - 1)) && solid(px(x, y + 1))) return [x + 0.5, y + 0.5];
  return null;
}
// Cut the sheet into frames (writes the PNGs) and work out each frame's hurtbox: the body, without the white claw arcs.
function cut() {
  const saved = savedPoints();
  const sheet = png.decode(path.join(L.ROOT, SHEET));
  const out = [];
  for (const a of ANIMS) {
    const frames = [];
    for (const row of a.rows) for (let c = 0; c < sheet.w / CELL; c++) {
      const cell = png.crop(sheet, c * CELL, row * CELL, CELL, CELL);
      if (!png.bbox(cell) && !(a.name === "spawn" && row === 37 && c === 0)) continue; // empty cell (the spawn's first frame is deliberately blank)
      frames.push(cell);
    }
    const files = [];
    frames.forEach((cell, i) => {
      const f = DIR + a.name + "/Cat_" + a.name + "_" + (i + 1) + ".png";
      fs.mkdirSync(path.join(L.ROOT, DIR + a.name), { recursive: true });
      png.encode(cell, path.join(L.ROOT, f)); files.push(f);
    });
    out.push({ name: a.name, dt: a.dt, loop: !!a.loop, frames: frames.map((cell, i) => {
      let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
      for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
        const p = (y * CELL + x) * 4, d = cell.data;
        if (d[p + 3] > 200 && !(d[p] > 225 && d[p + 1] > 225 && d[p + 2] > 225)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      const mask = x1 < 0 ? [0, 0, 1, 1] : [x0, y0, x1 + 1, y1 + 1];
      // Points: BloodPoint (generated), and the two the artist places in the editor: Point2 = where a swipe appears IN FRONT of the cat,
      // Point = BEHIND it (the hind kick). A point already in the saved scene is kept; a frame without one gets the default.
      const pts = { BloodPoint: [Math.round((mask[0] + mask[2]) / 2), Math.round((mask[1] + mask[3]) / 2)] };
      for (const n of ["Point", "Point2"]) pts[n] = (saved[a.name] && saved[a.name][i] && saved[a.name][i][n]) || POINTS[n];
      pts.Eye = (saved[a.name] && saved[a.name][i] && saved[a.name][i].Eye) || findEye(cell) || POINTS.Eye;   // where the eye glint flashes
      return { image: files[i], origin: [CELL / 2, CELL], mask, points: pts };
    }) });
  }
  return out;
}

// The dirt mound the cat travels under in its dig: four frames at 4x (160x80), origin at the bottom middle.
function mound() {
  const W = 40, H = 20, frames = [];
  for (let f = 0; f < 4; f++) {
    const img = { w: W, h: H, data: Buffer.alloc(W * H * 4) };
    const grow = f < 2 ? 0.55 + 0.05 * f : 0.85, cx = 20 + (f === 3 ? 1 : 0), top = H - 2 - Math.round(12 * grow), half = Math.round(17 * grow);
    const set = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const p = (y * W + x) * 4; img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255; };
    for (let y = top; y < H; y++) for (let x = cx - half - (y - top); x <= cx + half + (y - top); x++) {
      const edge = y - top < 1 || x === cx - half - (y - top) || x === cx + half + (y - top) || y === H - 1;
      const noise = (x * 7 + y * 13 + f) % 5 === 0;
      set(x, y, edge ? [58, 36, 24] : noise ? [122, 82, 52] : (y - top) < (H - top) / 2 ? [104, 70, 44] : [84, 56, 36]);
    }
    if (f >= 2) for (let i = 0; i < 6; i++) { set(cx - 2 + (i % 2) * 2, top + 1 + i, [40, 24, 16]); set(cx + 3 - (i % 2), top + 3 + i, [40, 24, 16]); } // cracks
    const scaled = png.scale(img, 4);
    const file = DIR + "mound/Cat_mound_" + (f + 1) + ".png";
    fs.mkdirSync(path.join(L.ROOT, DIR + "mound"), { recursive: true });
    png.encode(scaled, path.join(L.ROOT, file));
    frames.push({ image: file, origin: [80, 80], mask: null, points: {} });
  }
  return frames;
}

// The claw slash drawn over each swipe (tools/fx/cat_slash.js): one animation per kind, centred on the picture. Only Horizontal so far.
const slash = require("../fx/cat_slash.js");
function slashFrames(kind) {
  return slash.frames(kind).map((img, i) => {
    const f = DIR + "fx/slash_" + kind.toLowerCase() + "/Cat_slash_" + kind.toLowerCase() + "_" + (i + 1) + ".png";
    fs.mkdirSync(path.join(L.ROOT, path.dirname(f)), { recursive: true }); png.encode(img, path.join(L.ROOT, f));
    return { image: f, origin: [slash.W / 2, slash.H / 2], mask: null, points: {} };
  });
}
// The landing dust (tools/fx/cat_dust.js): one Puff animation; its origin is the ground line at the middle of the picture, so it is
// placed at the cat's own origin (its lowest point, middle) when it lands.
const glint = require("../fx/cat_glint.js");
function glintFrames(color) {
  return glint.frames(color).map((img, i) => {
    const f = DIR + "fx/glint_" + color.toLowerCase() + "/Cat_glint_" + color.toLowerCase() + "_" + (i + 1) + ".png";
    fs.mkdirSync(path.join(L.ROOT, path.dirname(f)), { recursive: true }); png.encode(img, path.join(L.ROOT, f));
    return { image: f, origin: [glint.W / 2, glint.H / 2], mask: null, points: {} };
  });
}
const dust = require("../fx/cat_dust.js");
function dustFrames() {
  return dust.frames().map((img, i) => {
    const f = DIR + "fx/dust/Cat_dust_" + (i + 1) + ".png";
    fs.mkdirSync(path.join(L.ROOT, path.dirname(f)), { recursive: true }); png.encode(img, path.join(L.ROOT, f));
    return { image: f, origin: [dust.W / 2, dust.GROUND], mask: null, points: {} };
  });
}
const FX = { Cat_Slash: {}, Cat_Dust: { Puff: { n: dust.FRAMES, dt: dust.DT } }, Cat_Glint: {} };
for (const color of glint.colors) FX.Cat_Glint[color] = { n: glint.FRAMES, dt: glint.DT }; for (const kind of slash.kinds) FX.Cat_Slash[kind] = { n: slash.FRAMES, dt: slash.DT };

module.exports = {
  fx: FX, points: POINTS,
  id: "cat", object: "Cat", scene: "Cat_Fight", sheet: "Cat_Boss", template: "template_graveyard", folder: "Cat",
  name: "Ferocious Beast", scale: SCALE, cell: CELL, ground: 657, minX: 110, maxX: 1170,
  start: [1000, 657], zones: true,    // strike zones: the area of each attack pulses on the floor while it winds up (kit.js)
  music: { file: "assets/Music/Faded Keys_Broken Piano_Horror Music_Royalty Free Music_Vivek Abhishek.ogg", volume: 30 },
  vars: VARS, cut, sfx: SFX,
  ai: "cat.js", aiFn: "catAI",
  debugKeys: { Numpad1: "swipeA", Numpad2: "swipeB", Numpad3: "swipeC", Numpad4: "pounce", Numpad5: "zoom", Numpad6: "burrow", Numpad7: "flurry", Numpad8: "maul", Numpad9: "hiss", NumpadAdd: "dodge", NumpadSubtract: "toggleIdle", Numpad0: "loseLife" },
  summary: "The Cat: a quick tabby with three lives. Swipes, pounces, zoomies, a dig-and-erupt from under the floor, a claw flurry and a heavy maul; each life is a phase.",
  // Objects besides the boss: [object, group or null].
  extras() {
    const hitVars = { Damage: 0, HasHit: false, IsMelee: true, Life: 0, Kind: "", SharedDeflect: 0, Directional: 1, PostureScale: 1 };
    const hitbox = L.spriteObject("Cat_Hitbox", hitVars, [L.animation("Box", [{ image: "assets/Enemies/Leaf_Ranger/fx/hitbox/Ranger_Hitbox.png", origin: [0, 0], mask: null }], 1, false)]);
    const mnd = L.spriteObject("Cat_Mound", {}, [L.animation("Rise", mound(), 0.12, false)]);
    const sl = L.spriteObject("Cat_Slash", {}, slash.kinds.map(kind => L.animation(kind, slashFrames(kind), slash.DT, false)));   // visual only: no hitbox, not in EnemyHitbox
    const dst = L.spriteObject("Cat_Dust", {}, [L.animation("Puff", dustFrames(), dust.DT, false)]);   // visual only
    const gl = L.spriteObject("Cat_Glint", {}, glint.colors.map(color => L.animation(color, glintFrames(color), glint.DT, false)));   // visual only
    return [[hitbox, "EnemyHitbox"], [mnd, null], [sl, null], [dst, null], [gl, null]];
  }
};
