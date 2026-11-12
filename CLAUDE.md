# Notes for AI agents

Read `README.md` first for what the project is and how it's laid out. These are the working rules on top of it.

- **GDevelop must be closed before you edit project files.** Ask the user to save and close it. On Windows, a
  `GDevelop 5` window title with no project path means no project is open.
- **Run `node tools/test/run.js` after every change,** and keep it passing. When you add a feature, add a behaviour
  test for it in `tools/test/behaviour.test.js`. After deliberately using a new GDevelop instruction type, record it
  with `node tools/test/run.js --accept`.
- **Event JSON:**
  - Put a comment event above every event you add.
  - GDevelop silently drops instruction types it doesn't know.
  - In an `Or` condition, every object the event acts on must be named in every branch: an `Or` keeps only the
    objects its true branches picked. This broke all ranged deflects once.
- **Don't hand-edit generated content.** Edit the generator in `tools/` and rerun it. The hub comes from
  `tools/hub/build.js` and its data from `tools/hub/hub.js`.
- **Branches:** do new work on a feature branch off `development`, and commit each change. Pushing needs the user's
  go-ahead; the pre-push hook runs the checks (`git config core.hooksPath .githooks` once per clone).
- **Assets:** `assets/new TBA/` is the user's drop folder and should end up empty. Raw packs go in `assets (raw)`,
  which is git-ignored. Check licences: sounds ripped from other games may only be placeholders.
