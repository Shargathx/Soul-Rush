// Puts the debug counts script (debugcounts.js) into Combat_Shared after the Composure script. Close GDevelop first.
// Usage: node tools/debugcounts/build.js (after tools/composure/build.js). Safe to run again: it replaces its own event.
const fs = require("fs");
const path = require("path");
const L = require("../bosses/lib.js");

const COMMENT = "Debug counts: a line \"Brand: x / N | Mercy: y / N\" is added to the Debug_UI text in every scene that has one (after the scene's own events, so it adds to what they wrote). With DEBUG_KEYS off the Debug_UI text is hidden. Remove before release (DEBUG_KEYS).";
const cs = L.readJson("externalEvents/combat_shared.json");
const isComment = (e, start) => e.type === "BuiltinCommonInstructions::Comment" && String(e.comment).startsWith(start);
for (let i = cs.events.length - 1; i >= 0; i--) if (isComment(cs.events[i], "Debug counts:")) cs.events.splice(i, 2);
const at = cs.events.findIndex(e => isComment(e, "Composure:"));
if (at < 0) throw new Error("run tools/composure/build.js first");
cs.events.splice(at + 2, 0, L.comment(COMMENT), L.jsEvent(fs.readFileSync(path.join(__dirname, "debugcounts.js"), "utf8")));
L.writeJson("externalEvents/combat_shared.json", cs);
console.log("Debug counts written after event " + (at + 1) + " of Combat_Shared");
