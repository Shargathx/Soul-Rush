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
| `externalEvents/` | Event sheets shared between scenes: `Player_Movement`, `Combat_Shared`, each boss's sheet (the tutorial has its own copy of the Samurai sheet, `Tutorial_Samurai_Boss`) |
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
- `tools/mercy/` is the mercy mechanic (hold E at a kneeling boss's last stun to spare it instead of the deathblow): `mercy.js` is the script, `build.js` puts it into Combat_Shared. Samurai (bow, petals), Gunslinger (a text exchange in binary) and Bladekeeper (a duel salute, `spared()` in `tools/bosses/bladekeeper.js`). Debug key M spares the boss at once (see `DEBUG_KEYS.md`). See `docs/ideas.md`. `tools/fx/ranger_sprout.js` draws the Leaf Ranger's mercy arrow and `tools/fx/ranger_dissolve.js` his dissolve into leaves and `tools/fx/ranger_grab.js` his reach for the bow (`--install` registers them). `tools/fx/player_bow.js` makes the player's nod (`--install-nod` registers Player_Nod) and a backup full bow.
- `tools/bosses/` builds the Cat and Bladekeeper fights (scene, event sheet and objects are generated from the scripts and definitions there; see its README). `tools/fx/blood.js` cuts the nine blood splashes and wires the random pick into `Combat_Shared`; `tools/fx/cat_sounds.js` synthesizes the Cat's voice; `tools/hub/gates_new.js` draws their two hub gates.
- `assets/new TBA/` is a drop folder for new material. It's kept empty: files are moved into place, or into
  `assets (raw)` if unused.

## Debug keys

These are for development. There is one switch for all of them: `DEBUG_KEYS` at the top of `Combat_Shared` (the first script event). It is `true` in development; set it to `false` for the demo or a release and every debug key (the numpad, the F keys and the letter keys in [DEBUG_KEYS.md](DEBUG_KEYS.md)) stops working, with no other edits. A test checks that the switch works and that it is `true` in the repository.

| Where | Keys |
| --- | --- |
| Every boss fight | Numpad 0 idle, 1 to 9 moves, Enter page 1/2 (Samurai, Leaf Ranger), + dodge, - take a life; F3 hitboxes, F5 restart |
| Every fight, player and powers | F10 (your attack hitbox), left Alt, L, P (Desperation and perfect deflects), B, O (brands, mercies), X, C, U, Y (powers), M (mercy farewell) |
| Hub | G (open every gate), C (cycle the dodge) |

Every key, with each boss's moves, is in [DEBUG_KEYS.md](DEBUG_KEYS.md).

### Demo build checklist

- Set `DEBUG_KEYS` to `false` (above).
- The Bladekeeper and Cat gates are open (orders 5 and 6, after the Gunslinger): decide whether the demo includes them. Their numbers have not been playtested.
- Keep the Fire Knight gate `locked` in `tools/hub/hub.js` (a test checks it). The Gunslinger's door is open now (piperal's work, after the Leaf Ranger): decide whether the demo should lock it again.
- Music is OGG now. The hub plays `assets/Music/cathedral_full.ogg` (about 4 min) as one looping sound. The old mp3/wav files (the hub intro and loop, the boss mp3s, cathedral_full.mp3) are no longer used and can be deleted.
- If the music is a free-plan Suno track, it is non-commercial only: generate the final version on a paid plan before a paid release.

## Credits and licences

- **Hub music:** made by the developer in Suno. A previous track, *Cathedral of Shadows* by mumusi_c21 (CC BY 4.0), is
  kept as a fallback.
- **Cat fight music:** *Faded Keys* (Broken Piano, Horror Music, Royalty Free) by Vivek Abhishek: the track's own note asks for a credit, a link to the channel or the video it came from (`assets/Music/READ.txt`).
- **Arrow sounds:** from Pixabay under the Pixabay Content License (`assets/Sfx/arrows/source/LICENSE.txt`).
- **Sprites, tilesets and effects:** from the asset packs in `assets (raw)`. Check each pack's own licence before a
  release.
