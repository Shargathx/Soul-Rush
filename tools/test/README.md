# Project checks

```
node tools/test/run.js            # everything (about 1 s)
node tools/test/run.js crow       # only tests whose name contains "crow"
node tools/test/run.js --accept   # after using a new, real GDevelop instruction: record it as known
node tools/test/selftest.js       # proves the checks still catch known bugs (GDevelop closed)
```

They run automatically before every `git push` (`.githooks/pre-push`) and stop the push if anything fails. On a fresh
clone, turn the hook on once with `git config core.hooksPath .githooks`. `git push --no-verify` skips it.

They check the project files and simulate scripts in Node. They don't run GDevelop, so a playtest is still needed
for feel and for anything only the engine does.

| File | What it checks |
| --- | --- |
| `integrity.test.js` | Every registered file exists; every sprite frame is registered; every sound the events play exists and is registered; links point at real sheets; every script event parses; the hub's generated scripts are present. |
| `events.test.js` | No unknown instruction types (GDevelop drops those silently); every object and scene variable the events use is declared, checked in every scene that links a sheet; every `Or` names each object its event acts on in every branch (the deflect bug of 2026-11-11). |
| `behaviour.test.js` | Runs the project's own scripts against stand-in objects: hub crows (spacing, caws only with the caw pose, ~15 s apart), the bench (rest; start over wipes in place without reloading; Esc), the fight UI (boss bars hidden through the Samurai's opening; Desperation x1-x3), deflects (Desperation window in both; one arrow per press), Leaf Ranger sounds (every kind present, files exist, cooldown), the Leaf Ranger's life and death holds. |

A test file exports a list of `[name, fn]`; `fn` returns a list of problems (empty = pass). When a feature is added,
add a behaviour test for it next to the others, so a later change can't quietly break it.
