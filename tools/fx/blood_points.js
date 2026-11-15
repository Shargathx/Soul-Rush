// Gives every frame of the Leaf Ranger a "BloodPoint" (the Samurai has one; the Gunslinger is piperal's fight and is left alone): the middle of the frame's
// hurtbox, at chest height, so the blood tools/fx/blood.js makes starts on the body instead of at the object's origin.
// Close GDevelop first. Safe to run again.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..", "..");
for (const [file, name] of [["layouts/leaf_ranger_fight.json", "Leaf_Ranger"]]) {
  const p = path.join(ROOT, file), scene = JSON.parse(fs.readFileSync(p, "utf8")), obj = scene.objects.find(o => o.name === name);
  let n = 0;
  for (const a of obj.animations) for (const d of a.directions) for (const s of d.sprites) {
    const m = s.customCollisionMask && s.customCollisionMask[0]; if (!m || !m.length) continue;
    const xs = m.map(v => v.x), ys = m.map(v => v.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const pt = { name: "BloodPoint", x: Math.round((x0 + x1) / 2), y: Math.round(y0 + (y1 - y0) * 0.4) };
    const i = s.points.findIndex(q => q.name === "BloodPoint"); if (i >= 0) s.points[i] = pt; else s.points.push(pt); n++;
  }
  fs.writeFileSync(p, JSON.stringify(scene, null, 2) + "\n"); console.log(name + ": " + n + " frames");
}
