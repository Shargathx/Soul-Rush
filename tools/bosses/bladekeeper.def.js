// The Bladekeeper: what tools/bosses/build.js needs to make the fight. Sprites come from "Elementals metal bladekeeper FREE v1.1"
// (kept extracted in assets (raw)): 288x128 frames like the Leaf Ranger's, drawn at 2x, plus a thrown blade and a blade trap.
const fs = require("fs");
const path = require("path");
const png = require("./png.js");
const L = require("./lib.js");

const PACK = "assets (raw)/Elementals_metal_bladekeeper_FREE_v1.1_extracted/PNG animations/";
const DIR = "assets/Enemies/Bladekeeper/";
const FW = 288, FH = 128, SCALE = 2;
// Animations: the pack's folder, our name, seconds per frame (or a list), loop.
const ANIMS = [
  { name: "idle", dir: "01_idle", dt: 0.1, loop: true },
  { name: "run", dir: "02_run", dt: 0.07, loop: true },
  { name: "jumpUp", dir: "03_jump_up", dt: 0.08, loop: true },
  { name: "jumpDown", dir: "03_jump_down", dt: 0.08, loop: true },
  { name: "jump", dir: "03_jump_full", dt: 0.045 },                        // the whole jump, 20 frames: crouch, rise, tumble, fall, land
  { name: "roll", dir: "04_roll", dt: 0.05 },
  { name: "cast", dir: "05_projectile_cast", dt: 0.07 },                   // the throw: the blade leaves on frame 2
  { name: "trapCast", dir: "06_trap_cast", dt: 0.07 },                     // she leaps and slams a trap down
  { name: "atk1", dir: "07_1_atk", dt: 0.06 },
  { name: "atk2", dir: "08_2_atk", dt: 0.06 },
  { name: "atk3", dir: "09_3_atk", dt: 0.06 },
  { name: "special", dir: "10_sp_atk", dt: [0.09, 0.09, 0.09, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.09] }, // the blade garden
  { name: "defend", dir: "11_defend", dt: 0.07 },
  { name: "hit", dir: "12_take_hit", dt: 0.07 },
  { name: "death", dir: "13_death", dt: [0.06, 0.06, 0.06, 0.06, 0.06, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09, 0.09] },   // the fall is quick, the lying frames slow
  { name: "airAtk", dir: "air_atk", dt: 0.06 }
];
// The stun pose: she kneels on one knee, head down, a hand on the floor. The pack has no kneel, so it is the blade garden's kneeling frame
// (special, 4th frame) with the garden's spikes and the wind-blown cape wisps taken out: grey spike colours are kept only on the chest plate
// (x 150 to 163, y 100 to 112), cape colours only below y 104. ONE frame is held (the garden's other kneeling frames differ in hair, cape and leg,
// which clipped in and out). The kneel drops in through a bowing lead-in frame (idle bowed from the waist); the rise uses the garden's two standing-up frames.
const SPIKES = ["174,180,186", "228,231,231", "112,114,123"], CAPE = ["68,52,59", "96,83,87", "119,107,115"];
function cleanedKneel(img) {
  const o = { w: img.w, h: img.h, data: Buffer.from(img.data) };
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const p = (y * img.w + x) * 4; if (!o.data[p + 3]) continue;
    const key = o.data[p] + "," + o.data[p + 1] + "," + o.data[p + 2];
    if (SPIKES.includes(key) && !(x >= 150 && x <= 163 && y >= 100 && y <= 112)) o.data[p + 3] = 0;
    if (CAPE.includes(key) && y < 104) o.data[p + 3] = 0;
  }
  // The cape now hangs: from her shoulders down her back to the floor, ragged at the bottom, in the cape's own three greys (light edge, body,
  // dark folds). It is drawn BEHIND her (only what shows past her back is kept).
  const put = (img2, x, y, c) => { if (x < 0 || y < 0 || x >= img2.w || y >= img2.h) return; const q = (y * img2.w + x) * 4; if (img2.data[q + 3]) return; img2.data[q] = c[0]; img2.data[q + 1] = c[1]; img2.data[q + 2] = c[2]; img2.data[q + 3] = 255; };
  const LIGHT = [119, 107, 115], MIDC = [96, 83, 87], DARKC = [68, 52, 59];
  for (let y = 102; y <= 125; y++) {
    const left = Math.round(150 - (y - 102) * 1.0 - 1.5 * Math.sin(y * 0.9)), ragged = y > 119 ? ((y * 7) % 4) : 0;
    for (let x = left; x <= 156; x++) {
      const d = x - left, fold = (x + y) % 7 === 0;
      put(o, x + ragged, y, d < 1 ? LIGHT : (fold || d > 6) ? DARKC : MIDC);
    }
  }
  // The blade: she drives it into the floor with her front hand. A short crossguard under the fist, and a blade slanting down and forward into the floor.
  const GUARD = [112, 114, 123], BLADE = [174, 180, 186], EDGE = [228, 231, 231];
  const bx0 = 163, by0 = 121;
  for (let i = 0; i < 5; i++) put(o, bx0 - 1 + i, by0 - 1, GUARD);
  for (let i = 0; i < 6; i++) { const x = bx0 + 1 + Math.floor(i / 3), y = by0 + i; put(o, x, y, EDGE); put(o, x + 1, y, BLADE); put(o, x + 2, y, i > 3 ? GUARD : BLADE); }   // nearly straight down: one pixel across in three rows
  return o;
}

const VARS = {
  JustHitByPlayer: false, AIState: "Intro", Health: 200, MaxHealth: 200, Lives: 2, Posture: 0, MaxPosture: 80, PostureDamage: 20, StunDuration: 2.5,
  DeathblowOrbDrop: 40, IsPostureBroken: false, JustPostureBroken: false, JustRecovered: false, JustHitPlayer: false, JustDodgedHit: false,
  JustLostLife: false, JustDied: false, JustDeflected: false, JustStaggered: false, Invulnerable: false, WillDodgeHit: false, HasDeathAnimation: true,
  MeleeDamagesPosture: true, DeflectAnySide: 0, AimX: -1, PostureRegenDelay: 1, PostureRegenFull: 3, PostureRegenEmpty: 1.5, DeathHold: 0, LifeHold: 0, StateT: 0,
  // Tuning (bladekeeper.js): damage per hit, speeds in px/s, cooldowns in seconds.
  SlashDamage: 12, FinisherDamage: 18, ThrowDamage: 12, DiveDamage: 16, TrapDamage: 18, GardenDamage: 25, CounterDamage: 14,
  RunSpeed: 440, KnifeSpeed: 860, DodgeCooldown: 3, TrapArm: 0.7, TrapLife: 4
};

const SFX = {};

function cut() {
  const out = [];
  for (const a of ANIMS) {
    const dir = path.join(L.ROOT, PACK, a.dir);
    const names = fs.readdirSync(dir).filter(f => /\.png$/.test(f)).sort((x, y) => +x.match(/(\d+)\.png/)[1] - +y.match(/(\d+)\.png/)[1]);
    fs.mkdirSync(path.join(L.ROOT, DIR + a.name), { recursive: true });
    const frames = names.map((n, i) => {
      const img = png.decode(path.join(dir, n)), file = DIR + a.name + "/Bladekeeper_" + a.name + "_" + (i + 1) + ".png";
      fs.copyFileSync(path.join(dir, n), path.join(L.ROOT, file));
      // The hurtbox: her body, from the solid pixels near the middle of the frame (the trails of a swing and the blade garden's
      // spikes are see-through or off to the side, and don't count).
      let x0 = 999, y0 = 999, x1 = -1, y1 = -1;
      for (let y = 0; y < img.h; y++) for (let x = 100; x < 190; x++) if (img.data[(y * img.w + x) * 4 + 3] === 255) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      if (a.name === "special" || a.name === "trapCast") { // spikes are solid: keep to her own column
        x0 = 999; y0 = 999; x1 = -1; y1 = -1;
        for (let y = 0; y < img.h; y++) for (let x = 124; x < 166; x++) if (img.data[(y * img.w + x) * 4 + 3] === 255) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      }
      const mask = x1 < 0 ? [140, 80, 148, 126] : [x0, y0, x1 + 1, y1 + 1];
      return { image: file, origin: [FW / 2, FH - 1], mask, points: { BloodPoint: [Math.round((mask[0] + mask[2]) / 2), Math.round(mask[1] + (mask[3] - mask[1]) * 0.4)] } };
    });
    out.push({ name: a.name, dt: a.dt, loop: !!a.loop, frames });
  }
  // The kneel frame: the cleaned image, with a hurtbox from its own solid pixels like the others.
  const special = out.find(a => a.name === "special"), roll = out.find(a => a.name === "roll");
  const kimg = cleanedKneel(png.decode(path.join(L.ROOT, PACK, "10_sp_atk", fs.readdirSync(path.join(L.ROOT, PACK, "10_sp_atk")).filter(f => /\.png$/.test(f)).sort((x, y) => +x.match(/(\d+)\.png/)[1] - +y.match(/(\d+)\.png/)[1])[3])));
  fs.mkdirSync(path.join(L.ROOT, DIR + "kneel"), { recursive: true });
  const frameOfImage = (img, file) => {          // a generated frame: written out, with a hurtbox from its own solid pixels
    png.encode(img, path.join(L.ROOT, file));
    let x0 = 999, y0 = 999, x1 = -1, y1 = -1;
    for (let y = 0; y < img.h; y++) for (let x = 100; x < 190; x++) if (img.data[(y * img.w + x) * 4 + 3] === 255) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const mask = [x0, y0, x1 + 1, y1 + 1];
    return { image: file, origin: [FW / 2, FH - 1], mask, points: { BloodPoint: [Math.round((mask[0] + mask[2]) / 2), Math.round(mask[1] + (mask[3] - mask[1]) * 0.4)] } };
  };
  const kframe = frameOfImage(kimg, DIR + "kneel/Bladekeeper_kneel_1.png");
  // The lead-in: struck and bowing. Her idle pose bowed from the waist (tools/fx/bladekeeper_slump.js) with the blade still low at her side
  // and the cape still flying, so she folds forward as if she had just been hit, instead of swinging the blade overhead.
  const { slump } = require("../fx/bladekeeper_slump.js");
  const lead = frameOfImage(slump(png.decode(path.join(L.ROOT, DIR + "idle/Bladekeeper_idle_1.png")), 0.7, 0, true), DIR + "kneel/Bladekeeper_kneel_lead.png");
  const hit = out.find(a => a.name === "hit");
  // She is struck (the first three frames of her hit reaction: the flinch and the impact flash) and slumps at once: the bow, then the held kneel.
  out.push({ name: "kneel", dt: [0.05, 0.05, 0.06, 0.07, 0.1], loop: false, frames: [hit.frames[0], hit.frames[1], hit.frames[2], lead, kframe] });
  out.push({ name: "rise", dt: [0.08, 0.1, 0.1], loop: false, frames: [kframe, special.frames[9], special.frames[10]] });
  return out;
}

const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(L.ROOT, to)), { recursive: true }); fs.copyFileSync(path.join(L.ROOT, PACK, "projectile_and_trap", from), path.join(L.ROOT, to)); return to; };

module.exports = {
  id: "bladekeeper", object: "Bladekeeper", scene: "Bladekeeper_Fight", sheet: "Bladekeeper_Boss", template: "template_ruins", folder: "Bladekeeper",
  name: "The Bladekeeper", scale: SCALE, cell: FW, cellH: FH, ground: 657, minX: 120, maxX: 1160,
  start: [1000, 657], projectile: "Bladekeeper_Blade",
  music: { file: "assets/Music/Dust and Steel - usesuno.com.mp3", volume: 30 },
  vars: VARS, cut, sfx: SFX,
  ai: "bladekeeper.js", aiFn: "bladekeeperAI",
  debugKeys: { Numpad1: "combo", Numpad2: "throw", Numpad3: "roll", Numpad4: "guard", Numpad5: "air", Numpad6: "trap", Numpad7: "garden", NumpadAdd: "dodge", Numpad0: "loseLife" },
  summary: "The Bladekeeper: a blade dancer in two lives. Slash combos, thrown knives, a roll through the player, a guard that punishes mashing, a diving strike, blade traps and the blade garden.",
  extras() {
    const hitVars = { Damage: 0, HasHit: false, IsMelee: true, Life: 0, Kind: "", SharedDeflect: 0, Directional: 1, PostureScale: 1 };
    // A frame's hit area is its drawn pixels (a knife is a few pixels, not the 80x32 canvas it sits in).
    const one = (img, o) => { const b = png.bbox(png.decode(path.join(L.ROOT, img))); return { image: img, origin: o, mask: b ? [b.x0, b.y0, b.x1 + 1, b.y1 + 1] : null }; };
    const hitbox = L.spriteObject("Bladekeeper_Hitbox", hitVars, [L.animation("Box", [one("assets/Enemies/Leaf_Ranger/fx/hitbox/Ranger_Hitbox.png", [0, 0])], 1, false)]);
    // The thrown knife: 80x32 canvas, the blade in the middle; it lands in the floor. Hit area is the whole (small) sprite.
    const fly = [one(copy("projectile_throw/projectile_throw.png", DIR + "fx/knife_fly.png"), [40, 16])];
    const land = [1, 2, 3, 4, 5].map(k => one(copy("projectile_land/projectile_land_" + k + ".png", DIR + "fx/knife_land_" + k + ".png"), [40, 16]));
    const blade = L.spriteObject("Bladekeeper_Blade", Object.assign({}, hitVars, { IsMelee: false }), [L.animation("Fly", fly, 1, false), L.animation("Land", land, 0.07, false)]);
    // The trap: a knife thrown into the floor (80x32 canvas) that goes off as a fan of blades.
    const tf = n => ({ image: copy(n[0] + "/" + n[1] + ".png", DIR + "fx/" + n[1] + ".png"), origin: [40, 31], mask: null });
    const trap = L.spriteObject("Bladekeeper_Trap", {}, [
      L.animation("Throw", [tf(["trap_throw", "trap_throw"])], 1, false),
      L.animation("Land", [1, 2, 3].map(k => tf(["trap_land", "trap_land_" + k])), 0.08, false),
      L.animation("Detonate", [1, 2, 3, 4, 5].map(k => tf(["trap_detonate", "trap_detonate_" + k])), 0.06, false)
    ]);
    return [[hitbox, "EnemyHitbox"], [blade, "EnemyHitbox"], [trap, null]];
  }
};
