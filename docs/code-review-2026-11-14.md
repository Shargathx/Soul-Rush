# Code and event review, 2026-11-14

A read-only pass over the event sheets, scenes and project file. Nothing was deleted or changed. The scans were scripts over
the JSON (variable usage, timers, animations, objects, resources, string states, keys), then a manual read of the risky
parts. The hub, the Gunslinger and the Fire Knight work were only scanned, not read in depth.

## Real problems (fix soon)

1. **Fixed 2026-11-14: some debug keys survived `DEBUG_KEYS = false`.** The gate in `Combat_Shared` blocks `Numpad*`, `Num0-9`, `F2-F10`, `Home`, `End`,
   `Insert`, `Delete`, `PageUp`, `PageDown` and `LAlt`. The Leaf Ranger sheet also reads `Add`, `Subtract`, `Multiply` and `Divide`
   (the names GDevelop gives the numpad's operator keys, alongside `NumpadAdd` and so on). Those four are not in the gate, so in a demo build
   the Leaf Ranger's debug shortcuts for them would still fire. Add them to the regex, and to the key list in the gate test.
2. **A ternary in an expression, in the Gunslinger scene** (`abs(Gunslinger_NPC.X() - (Player.CenterX() < 628 ? 1037 - ... : 220))`).
   GDevelop expressions have no `? :`. GDevelop already flagged it as an invalid parameter, and an invalid expression compiles to 0 with no
   error, so that condition does not do what it says. Work for piperal; it is the only ternary in the project.
3. **The Gunslinger's own deflect event ignores the new rules.** It reads no `FacingOk` and no `PostureScale`, and its bullets have no `Directional`
   variable (only `Grenade_Explosion` has one). Its deflect is not directional.
4. **The attack hitbox object draws a full Samurai picture.** `Samurai_Hitbox` uses `Enemy_Test*.png`. For his own swings it sits exactly on him and
   nobody notices. Anything that moves it elsewhere shows it (the illusion bug). Right now the three crossing swing hitboxes are made invisible
   with opacity 0. His normal swings, the wall slash and the combo swings still show the picture. Replace the images with empty frames, or hide
   it for every swing, when convenient. **Never use `Hide` on a hitbox object**: it made the crossing hits stop hurting.
5. **No hitbox anchor.** Neither the Samurai nor the illusion has a `Sword` point. `PointX("Sword")` falls back to the figure's origin, so every
   swing hitbox spawns at the origin and relies on the hitbox pictures to be offset correctly. Fragile if a frame ever changes.

## Risky, works today

- **Sibling-order bugs.** Events in a list run top to bottom, and several swing and crossing events reset shared variables (`ComboCount`,
  `SkillStep`, `DashType`). The `Num4` bug was exactly this. Any new sibling event that reads a variable an earlier sibling resets will
  misfire. The crossing start events and the swing-finished events are the main hotspots.
- **`SkillStep` is shared by every Samurai skill** (mirror cut, petals, tornado, crossing, melee). A stale value after an interrupted skill
  is only safe because each event also checks `AIState`. Keep doing that.
- **`DashType` is stale after a dash.** Every one of the 15 events that enter `FlashOut` sets it today (checked), but the landing event
  branches on it, so a new dash that forgets to set it would repeat the last type. The old `cross` value is the dangerous one.
- **The dishonor rule** (attacking during the kneel, rise or bow) sets `Phase = 2` without touching his lives. He then casts 5 petals in "phase 1"
  and the UI still shows two life marks. `Phase` is only recomputed at the next intermission (`4 - Lives`). `Dishonored` is set but never read.
- **Group expressions read the first instance only.** `Enemy.CenterX()`, `Enemy.Variable(AimX)` and `EnemyHitbox.Variable(PostureScale)` use the first
  instance of the group. Fine with one boss and one deflected hit at a time; wrong if two different hitboxes are deflected on the same frame
  (the posture scale of the first is used for both).
- **Two `Create` actions in one event** leave both new objects picked, so later actions apply to both. It already caused one bug (the tornado
  speed). The mirror cut draw and the intermission sweeps still do it, but their values are the same for both, so it is harmless.
- **`Cross2Split` is a divisor** in `RandomInRange(0, 99.99) / Cross2Split`. Setting it to 0 gives infinity (it would still pick 2 steps).
- **`MirrorChance` is 100 in the fight**, so every phase 3 petal or cut roll is the mirror version; the plain 10-petal phase 3 cast
  (and the plain phase 3 Judgement Cut) can no longer happen in the fight. It is only live in the Tutorial (65%, no phase 3).
- **Fixed 2026-11-14: the fight and the Tutorial used one Samurai sheet; the Tutorial now has its own copy (`Tutorial_Samurai_Boss`), still identical to the real one, so new variables and keys must now be copied by hand if the tutorial should have them.** Before the split: Every new Samurai variable and object must be added to both scenes; the tests
  catch a missing one, but the two will keep drifting. Already different on purpose: `Lives`, `MaxPhase`, `MirrorChance`, `MirrorBehind`,
  `PetalRadius`. In the fight only: the opening, `Dishonored`, `LifeHold`, `DeathHold`, `HiddenEndingEarned`.
- **Never tested in the real engine:** the mirror's RGB split (`SetEffectDoubleParameter` with five parameters), the card sequence's
  drawing code, the afterimage z-order (15 against his 16) and the layout of the 10 petals. The tests simulate the events in Node, not GDevelop.
- **`Random(2)` returns 0, 1 or 2** in GDevelop (inclusive), which the glitch and shimmer picks rely on. A different GDevelop version could change
  that.
- **The facing rule depends on the player's `FlippedX` meaning "facing left".** Correct today (checked against the movement events).

## Unused or dead (declared, never used)

Variables that no event names at all:
- Player: `AttackBuffer`, `Variable` (a default name left over), plus `Enemy_HP_Bar.Unnamed`.
- Leaf Ranger: `RainDamage`, `TrapCount` (the debug key used it until it was changed to the phase counts).
- Samurai: `GrabCooldown` (replaced by `GrabCooldownMin`, `GrabCooldownMax` and `GrabCooldownNow`).
- Samurai mirror: `GlitchOff` (the old shudder; the glitch now moves it with `GlitchStartX` and `GlitchTargetX`).
- Gunslinger: `TouchDuration`.

Set but never read: `Samurai_NPC.Dishonored`, `Gunslinger_NPC.AssaultDir`.

Read but never set by an event (so only the default ever applies): these are mostly intended tuning constants (35 on the Player,
about 97 on the Samurai, about 90 on the Leaf Ranger, 33 on the Gunslinger), but a few are worth a look because they look like they were
meant to be driven: `Samurai.MeleeChanceDrop`, `Samurai.WaveRipple`, `Samurai.WaveMap`, `Leaf.TooClose`, `Leaf.RallyHold`.

Timers: no timer is compared without being reset (good). Reset but never compared: `Player.IdleBuffer`, `Samurai.AttackTimer`,
`Samurai.StunTimer`, `Leaf.StunTimer`, `Gunslinger.FireTimer`, `Gunslinger.PostureRegenTimer`.

Animations never named in an event: `Samurai_Dash_In_Forward` (the rest are chosen by index or by the `MoveAnimation` variable, so the scan
cannot see them), `Ranger_defend_pose`, the Gunslinger background animations (`bg`, `NewSprite`), and the Gunslinger scene has five
background objects that are never placed (`BG_1` to `BG_4`, `GunslingerBackground`).

String states with no matching value: the Leaf Ranger sets `AIState` to `Rally` and `Overgrowth` only through the `LeapNext`
variable (fine). `Ranger_Arrow.Kind` is compared against three kinds that are only set by default or by the shooter. The Samurai's `AIState`
has no state that is compared but never set, or set but never compared.

Resources: 774 of the 2821 registered resources are not referenced by any object or event (498 directly under `assets`, 198 in
`assets/Enemies/Gunslinger`, 36 Leaf Ranger arrow-shower frames, 21 sounds). Not wrong, but they add to the project file and probably to
exports. Several large unused music files are also tracked in git (the 40 MB hub loop, `cathedral_of_shadows_*`, a 11 MB piano track).

## Housekeeping

- **Line endings.** GDevelop saves LF; my scripts wrote CRLF. With `autocrlf` git hides it, but every file shows as modified after a
  GDevelop save. A `.gitattributes` (`*.json text eol=lf`) would end that. There is none.
- **One huge sheet.** `samurai_boss.json` is 773 KB with 395 top-level events; `leaf_ranger_boss.json` is 677 KB. They are hard to review in
  the editor. Splitting by skill would help the next big feature.
- **Many tests match text patterns** inside the events JSON (quotes, parameter order). They broke twice this session from escaping alone. A
  small helper to find an event by comment and read its conditions would be sturdier.
- **Branches.** Everything from this session is on `feedback-2026-11-13` and nothing is pushed. `development` is behind it.
- **Stray files.** `gunslinger_door.png` sits at the project root; `assets/new TBA` is empty as it should be.
- **README and `DEBUG_KEYS.md`** are current for the keys that exist; the README's gate description still lists only the old key groups.

## After the review: the tutorial split and prune (2026-11-14)

The tutorial now has its own sheet, `Tutorial_Samurai_Boss`, pruned from 695 to 312 events (all depths): everything that needs phase 2 or 3, the crossing attacks, the mirror and afterimages, the ultimate, the intermissions, the card fakeout, the skill debug keys, and every state that nothing in the tutorial can reach (found by a reachability pass over AIState and DashType). Then removed from the tutorial scene: the 92 Samurai variables nothing used any more, and the objects `Samurai_Mirror`, `Samurai_Afterimage` and `Ult_Deflect_Tell`. Their picture resources are still registered (the fight uses them).
