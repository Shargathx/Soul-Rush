# Boss tools: the Cat and the Bladekeeper

Two fights built from a generator instead of by hand in the editor: `Cat_Fight` (The Cat, 3 lives, graveyard arena) and
`Bladekeeper_Fight` (The Bladekeeper, 2 lives, ruins arena). Their scenes, event sheets and objects are **generated**: edit the
files here and rebuild, never the output (`layouts/cat_fight.json`, `layouts/bladekeeper_fight.json`, `externalEvents/cat_boss.json`,
`externalEvents/bladekeeper_boss.json`).

```bash
node tools/bosses/build.js               # both (close GDevelop first)
node tools/bosses/build.js cat           # one
node tools/fx/player_pet.js         # the player's kneeling pose (once)
node tools/fx/cat_sounds.js              # the Cat's voice (then build cat, which registers the files)
node tools/hub/gates_new.js              # the two hub gates' art (then node tools/hub/build.js)
node tools/test/run.js boss              # their tests
```

## Files

| File | What it is |
| --- | --- |
| `kit.js` | The runtime both bosses share (see below). Joined into each boss's one script event. |
| `cat.js`, `bladekeeper.js` | One boss's moves, written as generator functions, and its director (which move next). |
| `cat.def.js`, `bladekeeper.def.js` | What the build needs: the animations (which sheet rows or pack folders, frame times), the object variables (HP, damage, speeds), the extra objects (hitbox, knife, trap, mound), the music, the debug keys. |
| `build.js`, `lib.js` | Cuts the frames, builds the objects, clones the arena template into a scene, writes the sheet, registers images and sounds, adds the boss to the fight UI's name table. Safe to run again. |
| `../fx/cat_slash.js` | The Cat's red claw slashes (`Cat_Slash` object, one animation per kind: Horizontal, Vertical, Diagonal), drawn in code; `node tools/fx/cat_slash.js` writes a preview GIF. `kit.fxOnce` plays one over a swipe. |
| `png.js` | A small PNG reader and writer (no dependencies). |

Sources: the Cat's frames are cut from `assets (raw)/Cat 50+ Animations` (a sheet with one animation per row; its aseprite file names them), the Bladekeeper's from `assets (raw)/Elementals_metal_bladekeeper_FREE_v1.1_extracted` (the pack's PNG animations). Both are git-ignored: the cut frames are in `assets/Enemies/Cat` and `assets/Enemies/Bladekeeper`.

## How a boss runs (kit.js)

One script event per boss, every frame. It reads what `Combat_Shared` flagged (`JustPostureBroken`, `JustRecovered`, `JustLostLife`, `JustDied`, `JustStaggered`, `JustDodgedHit`) and routes it to the boss's reactions, which interrupt the running move. A move is a generator: it `yield`s once per frame and uses `kit.play` (an animation, frame by frame, with a callback on a frame), `kit.hold`, `kit.wait`, `kit.glide`, `kit.arc` with `yield*`. When it ends, the director picks the next. The sprite's own playback is paused and the kit sets every frame, so a strike always lands on the frame the move names.

- **Hitboxes** (`kit.hitbox`) follow the boss and expire; they are `EnemyHitbox` objects with `Damage`, `HasHit`, `IsMelee` (and `Directional`, `SharedDeflect`, `PostureScale`) like every other boss's.
- **Projectiles** (`kit.shoot`) fly, and vanish when they hit, are deflected or leave the arena.
- **Holds** (the Leaf Ranger's rule): HP running out without a posture break first kneels the boss for `StunDuration` with the deathblow orb up (`DeathHold` on the last life, `LifeHold` with a life to spare). Only the deathblow, or the time running out, takes the life.
- **Debug keys** (all through the `DEBUG_KEYS` switch in `Combat_Shared`): Numpad1 and up start a move, `NumpadAdd` the dodge, Numpad0 takes a life. They are listed in the README.

### The Cat

In the game it is called **Ferocious Beast** (`name` in `cat.def.js`: the boss name under the bars and the hub gate label). The object, scene and sheet keep the names `Cat`, `Cat_Fight`, `Cat_Boss`.

Three lives are its phases. It fights close and fast; every strike has a held wind-up you can read.

| Move | What it does | Answer |
| --- | --- | --- |
| Swipes A / B / C | Two high claws, two low ones, or two and a spinning double sweep that reaches both sides | Deflect each (adds posture) |
| Pounce | Creeps in, crouches, leaps onto where you stood (twice in life 3) | Deflect on landing, or roll under |
| Zoomies | A play bow, then a sprint through you to the far wall and a skid (two passes in life 3) | Roll through it |
| Burrow (life 2+) | Digs in and vanishes; a mound creeps under you, freezes and shakes, the cat erupts straight up | Leave the mound when it shakes |
| Claw flurry (life 2+) | Rears up and scratches three times on both sides; one deflect stops all three | Deflect once |
| Maul (life 1) | Rises high on its hind legs, slowly, then slams down in front of it | Deflect or roll |
| Hiss feint (life 2+) | Fur up, a random pause, then the next move | Don't deflect early |

When it loses a life it is knocked flat, and returns from the ghost-cat halo (`spawn`) on the far side with a hiss. Stunned, it sits, lies down and dozes. It dodges every 2nd to 4th swing you make near it (re-rolled), by a back-flip.

### The Bladekeeper

| Move | What it does | Answer |
| --- | --- | --- |
| Combo | Two slashes (three in life 2, the last a rising cut) | Deflect each |
| Throw | A knife at chest height; three, one after another with a hop back between, in life 2 | One deflect per knife |
| Roll | A roll through you (invulnerable) and a cut from behind | Turn and deflect |
| Guard | The blade across her body, nothing hurts her. Swing at it and she ripostes at once; wait and she lunges | Stand off and deflect |
| Air strike | Back-flips up, hangs, dives at where you were | Roll |
| Trap (life 2) | Slams a knife into the floor at your feet; it arms, then goes off as a fan of blades (near it, or after 4 s) | Walk off it |
| Blade garden (life 2) | Drives her blade into the floor, a long pause, then blades burst out of the floor 200 px either way | Roll out, or deflect |

She dodges every 2nd to 4th swing near her by rolling back. A lost life: she is staggered, leaps to the far side and takes the guard pose.

### The Cat's hidden ending

The fight opens with a hiss, and the cat then walks over to the player, slowly (`PeaceSpeed`), and nothing it does can hurt. If the player never attacks (no swing, lunge or hit on it), it sits in front of him and a prompt (F) comes up above it; F makes the player step up and kneel (`Player_Pet`, made from the idle frame by `tools/fx/player_pet.js`, since there is no kneel sprite), hearts rise, the screen fades and the hub loads with the fight counted as won. The first swing, lunge or hit on the cat, at any moment before that, turns it hostile for good (it hisses again, the fight starts as normal, and F does nothing). If the player walks away, the cat follows and sits again.

What it leaves behind: `BossesBeaten.Cat_Fight` (the gate shows completed) and `BossesBeaten.Cat_Friend`, which the hub saves with the progress (`progress.beaten.Cat_Friend`, wiped by Start over). **The "power" itself is not implemented**: read `Cat_Friend` wherever it should count. In the hub the cat then sits at one of the spots in `CAT` in `tools/hub/hub.js` (the bench, the cat tree's perch, a pew, the plinth, the lectern, the rug), a different one each time the hub loads, and the keeper has a line about it. The cat tree's completed art has no painted tabby on the perch, so the real cat can sit there.

## Tuning

Everything is a variable on the boss object (open the scene in GDevelop): `Health`/`MaxHealth`, `Lives`, `MaxPosture`, `PostureDamage` (on the player, per hit), `StunDuration`, `PostureRegen*`, each move's damage, the speeds, `DodgeCooldown`. The timings (wind-up lengths, gaps) are in the move scripts and change per life with `byPhase(a, b, c)`. `docs/balance.md` has the numbers' reasoning.

## Checks

`tools/test/bosses.test.js`, with `tools/test/sim.js`, a stand-in for GDevelop and `Combat_Shared`: each fight's contract with `Combat_Shared` (groups, variables, link order, UI table), every animation the script plays exists, every hurtbox is a rectangle, the balance ratios, every move runs to its end in every phase and stays in the arena, a whole fight against a scripted player (3 seeds) ends with the boss's death with no errors or leaked hitboxes, the debug keys, and the hub gates. **None of this runs the engine**: feel, the art against the floor, hitbox reach and fairness need a playtest.

## Adding a boss

Copy `cat.def.js` and `cat.js`, add the name to `NAMES` in `build.js`, give it a hub gate in `tools/hub/hub.js`, and add it to `BOSSES` in `tools/test/bosses.test.js`.

### Feedback round 2 (2026-11-16)

- **Idle plays between moves** (`k.idleFor` in `kit.js`): holds on idle frame 0 looked like a stuck animation; the director's pauses and the recoveries now loop the idle. The Bladekeeper's steps between slashes show run frames.
- **Strike zones** (`zones: true` in `cat.def.js`, `k.zoneOn` in `kit.js`): the area of an attack pulses on the floor during the wind-up (the boss also flushes red) and flashes while the hitbox is live. Red = claws and kicks (deflect), orange = body or ground (roll). Pass `zone` to a hitbox spec to adopt a tell zone. Zones are removed with their hitbox, on interruption and at the end.
- **Cat hind kick** (the B swipes): the cat can only kick behind itself. With the player in front it crouches, leaps over him and lands facing away, then kicks (one or two). Its kick hitboxes are behind it.
- **Cat opening:** 1.5 s of standing still, a hiss, then it runs over (to bait an attack) and skids; the hidden ending is unchanged.
- **Bladekeeper guard (armor):** out of the rotation. After a connected hit she may guard: 10% after the 1st, 25% after the 2nd, 55% after the 3rd, 85% after the 4th or later (`GUARD_CHANCE` in `bladekeeper.js`; the count restarts after a guard or 5 s without a hit).
