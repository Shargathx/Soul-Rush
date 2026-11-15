// Soul Rush project checks. Runs every tools/test/*.test.js and exits non-zero if anything fails, so a git push
// (the pre-push hook in .githooks) is stopped before something broken goes out.
//
//   node tools/test/run.js            run everything
//   node tools/test/run.js crow       only the tests whose name contains "crow"
//   node tools/test/run.js --accept   record the current instruction types as known (after adding a real new one)
//
// A test file exports a list of [name, fn]. fn returns a list of problems (strings); an empty list, or nothing, is a
// pass. Throwing counts as a failure too. These check the project files and simulate scripts in Node: they don't run
// GDevelop itself, so a playtest is still needed for feel and anything the engine does.
const fs = require("fs");
const path = require("path");

const filter = process.argv.slice(2).find(a => !a.startsWith("--"));
const color = (c, s) => process.stdout.isTTY ? "\x1b[" + c + "m" + s + "\x1b[0m" : s;
let pass = 0, fail = 0;
const start = Date.now();
for (const file of fs.readdirSync(__dirname).filter(f => f.endsWith(".test.js")).sort()) {
  const tests = require(path.join(__dirname, file));
  console.log(color("1", file.replace(".test.js", "")));
  for (const [name, fn] of tests) {
    if (filter && !name.toLowerCase().includes(filter.toLowerCase())) continue;
    let problems;
    try { problems = fn() || []; } catch (err) { problems = ["threw: " + (err && err.stack ? err.stack.split("\n").slice(0, 3).join(" | ") : err)]; }
    if (problems.length) {
      fail++;
      console.log("  " + color("31", "FAIL") + " " + name);
      for (const p of problems.slice(0, 12)) console.log("       - " + p);
      if (problems.length > 12) console.log("       ... and " + (problems.length - 12) + " more");
    } else { pass++; console.log("  " + color("32", "ok") + "   " + name); }
  }
}
console.log((fail ? color("31", fail + " failed") : color("32", "all passed")) + ", " + pass + " passed, " + ((Date.now() - start) / 1000).toFixed(1) + " s");
process.exit(fail ? 1 : 0);
