// Self-test for the checks: applies known bugs (most of them real ones from this project's history) one at a time,
// runs the suite, expects the right test to fail, and restores each file exactly. Run it after changing the tests:
//   node tools/test/selftest.js
// It edits project files briefly, so run it with GDevelop closed.
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..", "..");
const P = f => path.join(ROOT, f);
const mutations = [
  ["the old deflect Or bug (Player-only branch)", "externalEvents/combat_shared.json", s => {
    const E = JSON.parse(s); let done = false;
    (function w(es) { for (const e of es) { for (const c of e.conditions || []) if (!done && c.type.value === "BuiltinCommonInstructions::Or" && JSON.stringify(c).includes("DeflectRangedUsed")) {
      c.subInstructions = [{ type: { value: "BooleanObjectVariable" }, parameters: ["EnemyHitbox", "IsMelee", "True", ""] }, { type: { value: "BooleanObjectVariable" }, parameters: ["Player", "DeflectRangedUsed", "False", ""] }]; done = true; }
      if (e.events) w(e.events); } })(E.events);
    return JSON.stringify(E, null, 2);
  }, "an Or names"],
  ["a variable typo in an event", "externalEvents/leaf_ranger_boss.json", s => s.replace("\"Leaf_Ranger\",\n                \"AIState\"", "\"Leaf_Ranger\",\n                \"AIStat\""), "object variables used by events"],
  ["an unknown instruction type", "externalEvents/player_movement.json", s => s.replace("\"value\": \"SceneJustBegins\"", "\"value\": \"SceneJustBegin\""), "every instruction type"],
  ["a sound path pointing at a missing file", "externalEvents/leaf_ranger_boss.json", s => s.replace("assets/Sfx/arrows/release_1.wav", "assets/Sfx/arrows/release_9.wav"), "Leaf Ranger sounds"],
  ["start over reloading the hub again (music restart)", "layouts/hub_area.json", s => s.replace("if (runtimeScene.__hubGates) runtimeScene.__hubGates.progress = { awakened: {}, beaten: {} };", "gdjs.evtTools.runtimeScene.replaceScene(runtimeScene, runtimeScene.getName(), false);"), "hub bench"],
  ["a syntax error in a script event", "layouts/hub_area.json", s => s.replace("const caw = function (b) {", "const caw = function (b) {{"), "every JavaScript event parses"],
  ["the Gunslinger deflect losing Desperation", "layouts/gunslinger.json", s => s.replace("Player.Variable(DeflectWindowNow)", "Player.Variable(DeflectWindow)"), "deflect: both deflects"],
  ["the crows' gap ignored", "layouts/hub_area.json", s => s.replace("if (Math.abs(px - o.px) < C.gap) return false;", "if (false) return false;"), "hub crows"]
];
let ok = 0;
for (const [label, file, mutate, expect] of mutations) {
  const orig = fs.readFileSync(P(file), "utf8"), changed = mutate(orig);
  if (changed === orig) { console.log("SKIP (mutation didn't apply): " + label); continue; }
  fs.writeFileSync(P(file), changed);
  let out = "", failed = false;
  try { out = execSync("node tools/test/run.js", { cwd: ROOT, encoding: "utf8" }); } catch (e) { out = e.stdout; failed = true; }
  fs.writeFileSync(P(file), orig);
  const caught = failed && out.split("\n").some(l => l.includes("FAIL") && l.includes(expect));
  console.log((caught ? "caught   " : "MISSED   ") + label + (caught ? "" : "\n" + out.split("\n").filter(l => /FAIL|^\s+-/.test(l)).slice(0, 6).join("\n")));
  if (caught) ok++;
}
console.log(ok + "/" + mutations.length + " bugs caught");
process.exit(ok === mutations.length ? 0 : 1);
