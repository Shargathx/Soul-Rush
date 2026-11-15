// Blood effects: cuts the nine blood splashes of "VFX Blood Batch 1" (one row each in its Rows sheet, 14 cells of 110x93)
// into frames, and puts them on the BloodSprite object as nine animations, Blood1 to Blood9. Combat_Shared picks one at
// random every time the player lands a hit (see the "Blood" events there; this script writes them too).
//
// Directional or not:
//   - Blood1 and Blood8 are fountains that rise straight up from where the blade went in: no direction, so they are placed
//     with their origin at the middle of the base and may be flipped either way.
//   - Blood2-7 and Blood9 are sprays that fly up and to the right (Blood6 almost flat). Their origin is the base of the
//     spray, on its left, so the sprite is flipped to throw the blood away from the player and the base stays on the wound.
// Combat_Shared flips by the side of the hit, so a hit from the left throws blood to the right and the other way round.
//
// Usage: node tools/fx/blood.js   (close GDevelop first; safe to run again)
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const png = require("../bosses/png.js");

const ROOT = path.join(__dirname, "..", "..");
const DIR = "assets/Hit Reactions, Blood etc/BloodFX Batch 1/";
const OUT = DIR + "fx/";
const SHEET = DIR + "VFX Blood Batch 1_SpriteSheetRows.png";
const CELL = [110, 93], COLS = 14;
const SECONDS = 0.06; // The pack's own frame time (6 cs in every gif).
// kind: "up" (a fountain, no direction) or "right" (a spray that flies to the right, flipped for hits from the right).
const EFFECTS = [
  { n: 1, kind: "up" }, { n: 2, kind: "right" }, { n: 3, kind: "right" }, { n: 4, kind: "right" }, { n: 5, kind: "right" },
  { n: 6, kind: "right" }, { n: 7, kind: "right" }, { n: 8, kind: "up" }, { n: 9, kind: "right" }
];

function cut() {
  const sheet = png.decode(path.join(ROOT, SHEET));
  fs.mkdirSync(path.join(ROOT, OUT), { recursive: true });
  const result = [];
  for (const e of EFFECTS) {
    const frames = [];
    for (let c = 0; c < COLS; c++) {
      const cell = png.crop(sheet, c * CELL[0], (e.n - 1) * CELL[1], CELL[0], CELL[1]);
      const box = png.bbox(cell);
      if (box) frames.push({ cell, box });
    }
    // Origin: the base of the effect, from its first frame (the splash at its smallest).
    const first = frames[0].box;
    const origin = e.kind === "up" ? [Math.round((first.x0 + first.x1) / 2), first.y1] : [Math.round(first.x0 + (first.x1 - first.x0) * 0.25), first.y1];
    const files = frames.map((f, k) => {
      const file = OUT + "blood_" + e.n + "_" + (k + 1) + ".png";
      png.encode(f.cell, path.join(ROOT, file));
      return file;
    });
    result.push(Object.assign({}, e, { files, origin }));
  }
  return result;
}

function register(effects) {
  const pf = path.join(ROOT, "Soul Rush.json");
  const P = JSON.parse(fs.readFileSync(pf, "utf8"));
  const have = new Set(P.resources.resources.map(r => r.name));
  for (const e of effects) for (const f of e.files) if (!have.has(f)) {
    P.resources.resources.push({ file: f, kind: "image", metadata: JSON.stringify({ localFilePath: f, extension: ".png" }), name: f, smoothed: false, userAdded: false });
    have.add(f);
  }
  const blood = P.objects.find(o => o.name === "BloodSprite");
  blood.animations = effects.map(e => ({
    name: "Blood" + e.n, useMultipleDirections: false,
    directions: [{ looping: false, metadata: "{\"pskl\":{}}", timeBetweenFrames: SECONDS,
      sprites: e.files.map(f => ({ hasCustomCollisionMask: false, image: f, points: [], originPoint: { name: "origine", x: e.origin[0], y: e.origin[1] },
        centerPoint: { automatic: true, name: "centre", x: 0, y: 0 }, customCollisionMask: [] })) }]
  }));
  // Two numbers on the Player carry the roll between the events that make the blood.
  const pl = P.objects.find(o => o.name === "Player");
  for (const [name, value] of [["BloodRoll", 0], ["BloodSize", 1]]) if (!pl.variables.some(v => v.name === name))
    pl.variables.push({ name, persistentUuid: crypto.randomUUID(), type: "number", value });
  fs.writeFileSync(pf, JSON.stringify(P, null, 2) + "\n");
}

const yellow = { b: 109, g: 230, r: 255, textB: 0, textG: 0, textR: 0 };
const comment = text => ({ type: "BuiltinCommonInstructions::Comment", color: yellow, comment: text });
const cond = (type, params, inverted) => ({ type: { inverted: !!inverted, value: type }, parameters: params });
const act = (type, params) => ({ type: { value: type }, parameters: params });

function events(count) {
  const fromLeft = cond("BuiltinCommonInstructions::CompareNumbers", ["Player.CenterX()", "<", "Enemy.CenterX()"]);
  const fromRight = cond("BuiltinCommonInstructions::CompareNumbers", ["Player.CenterX()", ">=", "Enemy.CenterX()"]);
  const make = (x, flip) => [
    act("Create", ["", "BloodSprite", x, "Enemy.PointY(\"BloodPoint\")", "\"Background\""]),
    act("AnimatableCapability::AnimatableBehavior::SetIndex", ["BloodSprite", "Animation", "=", "Player.Variable(BloodRoll)"]),
    act("ScalableCapability::ScalableBehavior::SetX", ["BloodSprite", "Scale", "=", "Player.Variable(BloodSize)"]),
    act("ScalableCapability::ScalableBehavior::SetY", ["BloodSprite", "Scale", "=", "Player.Variable(BloodSize)"]),
    act("FlippableCapability::FlippableBehavior::FlipX", ["BloodSprite", "Flippable", flip])
  ];
  return [
    comment("Blood, the roll: one of the " + count + " splashes (Blood1 to Blood" + count + ", tools/fx/blood.js) and a size from 1 to 1.4. Two of them are fountains with no direction, the rest spray to the right and are flipped below for a hit from the right, so the blood always flies away from the player. A lunge hits harder, so its blood is bigger."),
    { type: "BuiltinCommonInstructions::Standard", conditions: [], actions: [
      act("SetNumberObjectVariable", ["Player", "BloodRoll", "=", "RandomInRange(0, " + (count - 1) + ")"]),
      act("SetNumberObjectVariable", ["Player", "BloodSize", "=", "RandomInRange(100, 140) / 100"])
    ], events: [] },
    comment("Blood, a lunge: bigger."),
    { type: "BuiltinCommonInstructions::Standard", conditions: [cond("BooleanObjectVariable", ["Player", "IsLunging", "True", ""])], actions: [
      act("SetNumberObjectVariable", ["Player", "BloodSize", "*", "1.3"])
    ], events: [] },
    comment("Blood, the player is left of the enemy: the splash starts on the enemy's near side and flies to the right."),
    { type: "BuiltinCommonInstructions::Standard", conditions: [fromLeft], actions: make("Enemy.PointX(\"BloodPoint\") - 10", "no"), events: [] },
    comment("Blood, the player is right of the enemy: the same, flipped, flying to the left."),
    { type: "BuiltinCommonInstructions::Standard", conditions: [fromRight], actions: make("Enemy.PointX(\"BloodPoint\") + 10", "yes"), events: [] }
  ];
}

function wire(count) {
  const f = path.join(ROOT, "externalEvents", "combat_shared.json");
  const S = JSON.parse(fs.readFileSync(f, "utf8"));
  let done = false;
  const visit = list => {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const text = JSON.stringify(e.actions || []);
      if (e.type === "BuiltinCommonInstructions::Standard" && /"BloodSprite"/.test(text) && /"Create"/.test(text) && !done) {
        // From a previous run's first comment (or from this event) to the last event that makes blood.
        let first = list.findIndex(x => x.type === "BuiltinCommonInstructions::Comment" && /^Blood, the roll/.test(x.comment));
        if (first < 0) first = i;
        let last = i;
        for (let k = i + 1; k < list.length; k++) if (/"BloodSprite"/.test(JSON.stringify(list[k].actions || []))) last = k;
        list.splice(first, last - first + 1, ...events(count));
        done = true; return;
      }
      if (e.events) visit(e.events);
      if (done) return;
    }
  };
  visit(S.events);
  if (!done) throw new Error("couldn't find the blood events in combat_shared.json");
  fs.writeFileSync(f, JSON.stringify(S, null, 2) + "\n");
}

const effects = cut();
register(effects);
wire(effects.length);
console.log("blood: " + effects.length + " effects, " + effects.reduce((n, e) => n + e.files.length, 0) + " frames; origins " + effects.map(e => e.n + "@" + e.origin).join(" "));
