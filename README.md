# Soul Rush

A 2D boss-rush action game made in GDevelop 5, built around deflects and posture: break a boss's posture, then land
a deathblow. Between fights the player rests in a ruined cathedral hub, where each boss waits behind its own gate.

## Opening the project

Open `Soul Rush.json` in GDevelop 5. The game starts in the hub (`HUB_Area`).

The project is saved as separate files, so changes show up clearly in git:

| Path | What it holds |
| --- | --- |
| `Soul Rush.json` | The project: global objects (the player, bars, effects), resources, settings |
| `layouts/` | One file per scene: the hub, each boss fight, the tutorial, and arena templates in progress |
| `externalEvents/` | Event sheets shared between scenes: `Player_Movement`, `Combat_Shared`, each boss's sheet |
| `assets/` | Images, sounds and music the game uses |
| `assets (raw)/` | Raw downloaded packs, kept locally and not in git |
| `tools/` | Node scripts that generate assets and scene content (see below); none of them run in the game |

## Checks before pushing

```bash
node tools/test/run.js
```

This runs the project checks in about a second. It checks that files exist and are registered, and looks for event
mistakes GDevelop accepts silently (unknown instructions, undeclared variables, a known `Or` picking trap). It also
simulates key scripts to catch features that quietly broke. Details are in `tools/test/README.md`.

They also run automatically before every `git push` and stop the push if anything fails. **Turn that on once per
clone:**

```bash
git config core.hooksPath .githooks
```

`git push --no-verify` skips the check if you really need to.

The checks don't run GDevelop itself, so game feel and engine behaviour still need a playtest.

## Working on the files

- **Save and close GDevelop before editing any project file outside it.** GDevelop keeps the project in memory and
  writes it all back on save, so it overwrites outside edits.
- Generated content has a source: the hub is built by `tools/hub/build.js` from `tools/hub/hub.js` (see
  `tools/hub/README.md`), and arena backdrops come from `tools/arenas/`. Edit the source and rerun the script; hand
  edits to generated parts get lost on the next build.
- `tools/fx/` makes effects and sounds: deflect sparks and clash sounds, bow and volley sounds, the crow caws, HUD
  icons, and the attack hitbox's debug view. `gunslinger_hat.js` puts the cowboy hat on every Gunslinger frame and
  (with `gunslinger_revolver.js` and `gunslinger_shotgun.js`) swaps his pistol for a revolver and repaints his
  shotgun as a wooden pump-action, and `gunslinger_night.js` redraws the Gunslinger scene's backdrop at 256x128
  (from 128x64) with a cratered moon and moonlit cacti. Both work from clean copies in `assets (raw)` (`gunslinger-no-hat` and
  `gunslinger-night-original`), so they can be rerun.
- `assets/new TBA/` is a drop folder for new material. It's kept empty: files are moved into place, or into
  `assets (raw)` if unused.

## Debug keys

These are for development. There is one switch for all of them: `DEBUG_KEYS` at the top of `Combat_Shared` (the first script event). It is `true` in development; set it to `false` for the demo or a release and every key below (F2 to F10, the numpad, the Samurai's 0) stops working, with no other edits. A test checks that the switch works and that it is `true` in the repository.

| Where | Keys |
| --- | --- |
| Samurai | F2, Shift+F2, F6–F9, 0; and for the phase 3 work: Home (mirror Judgement Cut), End (mirror petal waves), Insert (jump to phase 2), PageUp (jump to phase 3), PageDown (a melee window), Delete (lose a life now, which starts the intermission into the next phase), Numpad1 (mirror tornado), Numpad2 (mirror tornado with the dash strike after it) |
| Leaf Ranger | F3, F4, numpad 0–9 and / * - + Enter |
| Shared | F5, F10 (shows the attack hitbox), and Numpad . (the player's last life with every curse stack, to test Desperation) |

### Demo build checklist

- Set `DEBUG_KEYS` to `false` (above).
- Keep the Fire Knight gate `locked` in `tools/hub/hub.js` (a test checks it). The Gunslinger's door is open now (piperal's work, after the Leaf Ranger): decide whether the demo should lock it again.
- The hub music loop (`assets/Music/cathedral_background_loop.wav`) is 40 MB. Convert it, and the intro, to OGG (keep them separate files, so the loop stays gapless) and point the hub's music script at them.
- If the music is a free-plan Suno track, it is non-commercial only: generate the final version on a paid plan before a paid release.

## Credits and licences

- **Hub music:** made by the developer in Suno. A previous track, *Cathedral of Shadows* by mumusi_c21 (CC BY 4.0), is
  kept as a fallback.
- **Arrow sounds:** from Pixabay under the Pixabay Content License (`assets/Sfx/arrows/source/LICENSE.txt`).
- **Sprites, tilesets and effects:** from the asset packs in `assets (raw)`. Check each pack's own licence before a
  release.
