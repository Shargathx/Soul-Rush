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
  { name: "death", dir: "13_death", dt: 0.09 },
  { name: "airAtk", dir: "air_atk", dt: 0.06 }
];
// Two more animations out of the same files: the kneel (the first frames of her death, held on the last) and the rise (the same backwards).
const DERIVED = [
  { name: "kneel", from: "death", frames: [0, 1, 2, 3, 4], dt: 0.09 },
  { name: "rise", from: "death", frames: [4, 3, 2, 1, 0], dt: 0.09 }
];

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
  for (const d of DERIVED) {
    const src = out.find(a => a.name === d.from);
    out.push({ name: d.name, dt: d.dt, loop: false, frames: d.frames.map(i => src.frames[i]) });
  }
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
