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
- **Camera: zoom or move every layer except `UI`, never just the base one.** In the fight scenes the floor (`Ground_Stuff`)
  and the backdrops are on the `Background` layer and the fighters are on the base layer (`""`). Zooming only the base
  layer scales the fighters but not the floor, so they sink into the ground. Both layers also share one camera centre
  (Combat_Shared's Arena lift and the shake around `__cameraBase`), so keep them in step. Requiem's zoom is the
  example (`tools/powers/runtime.js`).
- **Branches:** do new work on a feature branch off `development`, and commit each change. Pushing needs the user's
  go-ahead; the pre-push hook runs the checks (`git config core.hooksPath .githooks` once per clone).
- **Assets:** `assets/new TBA/` is the user's drop folder and should end up empty. Raw packs go in `assets (raw)`,
  which is git-ignored. Check licences: sounds ripped from other games may only be placeholders.
