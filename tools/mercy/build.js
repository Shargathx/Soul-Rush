// Puts the Mercy script (tools/mercy/mercy.js) into Combat_Shared as one script event, right after the fight UI layout event.
// Safe to run again: it replaces its own event. Close GDevelop first. Usage: node tools/mercy/build.js
const fs = require("fs");
const path = require("path");
const L = require("../bosses/lib.js");

const COMMENT = "Mercy: holding E at a kneeling boss's last stun spares it instead of the deathblow (F). The boss plays its own farewell and the victory event below takes the fight back to the hub. Generated from tools/mercy/mercy.js by tools/mercy/build.js: edit that and rebuild. See docs/ideas.md (the mercy path).";
const code = fs.readFileSync(path.join(__dirname, "mercy.js"), "utf8").replace(/\r\n/g, "\n");

const cs = L.readJson("externalEvents/combat_shared.json");
// Drop an earlier copy (the comment and the script after it).
for (let i = cs.events.length - 1; i >= 0; i--) {
  const e = cs.events[i];
  if (e.type === "BuiltinCommonInstructions::Comment" && String(e.comment).startsWith("Mercy:")) cs.events.splice(i, 2);
}
const at = cs.events.findIndex(e => e.type === "BuiltinCommonInstructions::JsCode" && Array.isArray(e.inlineCode) && e.inlineCode.some(l => /const BOSSES = \{/.test(l)));
if (at < 0) throw new Error("the fight UI event is not in Combat_Shared");
cs.events.splice(at + 1, 0, L.comment(COMMENT), L.jsEvent(code));
L.writeJson("externalEvents/combat_shared.json", cs);
console.log("Mercy event written after event " + at + " of Combat_Shared");
