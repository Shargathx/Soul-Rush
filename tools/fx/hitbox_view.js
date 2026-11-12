// Draws Player_Hitbox's frames from its own collision masks, so what the F10 debug view shows is exactly what can hit:
// each mask polygon filled translucent pink with a bright edge, on an otherwise empty 120x80 frame (the same size and
// origin as before, so nothing moves). Then points the object's sprites at the new images.
//
//   node tools/fx/hitbox_view.js
//
// Rerun it after editing the masks in GDevelop (with GDevelop closed), so the view keeps matching them.
// Before this, the frames were copies of the whole player with a pink sword, which showed as a second player
// whenever the hitbox and the player fell out of step.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const ROOT = path.join(__dirname, "..", "..");
const PROJECT = path.join(ROOT, "Soul Rush.json");
const DIR = "assets/Player/Hitbox_mask";
const W = 120, H = 80;
const FILL = [255, 70, 190, 140], EDGE = [255, 150, 225, 240]; // RGBA

function savePng(file, px) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; for (let x = 0; x < W; x++) for (let c = 0; c < 4; c++) raw[y * (W * 4 + 1) + 1 + x * 4 + c] = px[(y * W + x) * 4 + c]; }
  const table = Array.from({ length: 256 }, (_, n) => { let k = n; for (let j = 0; j < 8; j++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1; return k >>> 0; });
  const crc = buf => { let k = 0xffffffff; for (const b of buf) k = table[(k ^ b) & 255] ^ (k >>> 8); return (k ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
}
// Is the pixel centre (x + 0.5, y + 0.5) inside the polygon (even-odd rule)?
const inside = (poly, x, y) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
function draw(polys) {
  const px = Buffer.alloc(W * H * 4), on = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (polys.some(p => inside(p, x + 0.5, y + 0.5))) on[y * W + x] = 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!on[y * W + x]) continue;
    const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1 || !on[y * W + x - 1] || !on[y * W + x + 1] || !on[(y - 1) * W + x] || !on[(y + 1) * W + x];
    (edge ? EDGE : FILL).forEach((v, c) => { px[(y * W + x) * 4 + c] = v; });
  }
  return px;
}

const p = JSON.parse(fs.readFileSync(PROJECT, "utf8"));
const obj = p.objects.find(o => o.name === "Player_Hitbox");
fs.mkdirSync(path.join(ROOT, DIR), { recursive: true });
const old = new Set(), made = [];
for (const a of obj.animations) a.directions[0].sprites.forEach((s, k) => {
  const file = DIR + "/" + a.name + "_" + (k + 1) + ".png";
  savePng(path.join(ROOT, file), draw(s.customCollisionMask));
  if (s.image !== file) old.add(s.image);
  s.image = file; made.push(file);
  console.log(file, s.customCollisionMask.length + " mask polygon(s)");
});
// Resources: the new images in, the old player-copy images out (nothing else used them).
const stillUsed = new Set(p.objects.flatMap(o => (o.animations || []).flatMap(a => a.directions.flatMap(d => d.sprites.map(s => s.image)))));
p.resources.resources = p.resources.resources.filter(r => !(old.has(r.name) && !stillUsed.has(r.name)));
for (const f of made) if (!p.resources.resources.some(r => r.name === f))
  p.resources.resources.push({ file: f, kind: "image", metadata: "", name: f, smoothed: false, userAdded: true });
fs.writeFileSync(PROJECT, JSON.stringify(p, null, 2) + "\n");
console.log("Player_Hitbox now uses " + made.length + " mask images; dropped " + [...old].filter(n => !stillUsed.has(n)).length + " old resources.");
