// A "slumped over" stun pose for the Bladekeeper, built from her idle frame (the pack has no stun pose): the head and torso lean
// forward and sink while the legs stay planted, the windblown cape streamer is dropped (a stunned body has no wind), arms and blade
// go with the torso. amount 0 is idle, 1 is fully slumped. Exports slump(img, amount, bob) and idleFrame(n).
// Preview: node tools/fx/bladekeeper_slump.js out.png   (a contact sheet of the poses)
const fs = require("fs");
const path = require("path");
const png = require("../bosses/png.js");
const ROOT = path.join(__dirname, "..", "..");
const DIR = path.join(ROOT, "assets/Enemies/Bladekeeper/");
const load = (a, n) => png.decode(DIR + a + "/Bladekeeper_" + a + "_" + (n + 1) + ".png");
const CAPE = ["96,83,87", "119,107,115", "68,52,59", "70,61,61"];
const HEAD_BOTTOM = 92, TORSO_TOP = 93, WAIST = 107;                // rows of the idle frame (feet at 126)
function slump(src, amount, bob) {
  const out = { w: src.w, h: src.h, data: Buffer.alloc(src.data.length) };
  const put = (x, y, p) => { if (x < 0 || y < 0 || x >= src.w || y >= src.h) return; const q = (y * src.w + x) * 4; out.data[q] = src.data[p]; out.data[q + 1] = src.data[p + 1]; out.data[q + 2] = src.data[p + 2]; out.data[q + 3] = 255; };
  // Legs and boots first (they stay), then the torso and head over them.
  for (const pass of [0, 1]) for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const p = (y * src.w + x) * 4; if (src.data[p + 3] < 255) continue;
    const upper = y <= WAIST; if ((pass === 0) === upper) continue;
    const key = src.data[p] + "," + src.data[p + 1] + "," + src.data[p + 2];
    if (CAPE.includes(key) && x > 152 && y >= 90 && y <= 102) continue;          // the flying cape streamer
    if (!upper) { put(x, y, p); continue; }
    const t = Math.max(0, Math.min(1, (WAIST - y) / (WAIST - 85)));              // 0 at the waist, 1 at the top of the head
    const head = y <= HEAD_BOTTOM;
    const dx = Math.round(amount * (9 * Math.pow(t, 1.6) + (head ? 3 : 0))), dy = Math.round(amount * (2 + 3 * t + (head ? 3 : 0)) + (bob || 0) * (0.4 + t));
    put(x + dx, y + dy, p);
  }
  return out;
}
module.exports = { slump, load };

if (require.main === module) {
  const frames = [load("idle", 0), slump(load("idle", 0), 0.35), slump(load("idle", 0), 0.7), slump(load("idle", 0), 1), slump(load("idle", 0), 1, 1)];
  const sc = 7, cw = 60 * sc, ch = 60 * sc, W = cw * frames.length, H = ch, out = { w: W, h: H, data: Buffer.alloc(W * H * 4) };
  for (let i = 0; i < W * H; i++) { const v = ((i % W >> 4) + (Math.floor(i / W) >> 4)) % 2 ? 70 : 90; out.data[i * 4] = v; out.data[i * 4 + 1] = v; out.data[i * 4 + 2] = v + 10; out.data[i * 4 + 3] = 255; }
  frames.forEach((f, k) => { const s = png.scale(png.crop(f, 114, 72, 60, 60), sc); for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const p = (y * s.w + x) * 4; if (s.data[p + 3] < 10) continue; const q = (y * W + k * cw + x) * 4; out.data[q] = s.data[p]; out.data[q + 1] = s.data[p + 1]; out.data[q + 2] = s.data[p + 2]; } });
  png.encode(out, process.argv[2]); console.log("written");
}
