# Echo object: plan (2026-11-14)

Branch `echo-object`, off `development` (which has the images work merged). Nothing here is built yet.

## Why

The Samurai's images exist as four copies of one pattern (an object, a state variable, tell, move, swing, fade, cleanup):

| Copy | Object | Events (touching it) | Variables on `Samurai_NPC` |
| --- | --- | --- | --- |
| Crossing image (phase 3 triple slash) | `Samurai_Mirror` (shared with the mirror skills) | ~26 | `Cross*` |
| Dodge image 1 | `Samurai_DodgeImage` + `Samurai_DodgeHitbox` | ~37 | `DodgeImg*` |
| Dodge image 2 (double dodge) | `Samurai_DodgeImage2` | ~30 | `DodgeImg2*` |
| Dash image (dash strike, wall slash) | `Samurai_DashImage` + `Samurai_DashImgLine` | ~38 | `DashImg*` |

That is about 130 of the sheet's 880 events and 57 variables, mostly copy and paste. Every tuning or bug fix has to be made four times, and a new image type means another copy.

## What "copy his last skill" can and cannot mean in GDevelop

His skills are hand-written event sequences, not data, so a generic "repeat whatever he just did" does not exist. What does work is the other direction: one **echo** object whose behaviour is chosen by a `Kind` variable, and skills that only **spawn** an echo with a kind. A new image type is then one new kind (a block of events), not a copy of everything.

## Design

**One object, `Samurai_Echo`**: the mirror look, with every animation any kind needs (Attack, Dash_QuickDraw, Passing_Dash_Attack, Dash_Slash, Dash_Tell). One hitbox object for swings and one for dash lines, both in the `EnemyHitbox` group (so deflects and directional deflects work as now).

**State lives on the echo, not on the Samurai.** Object variables on each echo instance: `Kind`, `State`, `Order`, `Side`, `SpeedNow`, `Dist`, `Delta`, `Fade`, `LandX`, `Delay`. Object timers are per instance too. Because the state is per instance, two echoes at once (the double dodge) need no second copy of anything. The Samurai keeps only the shared tuning (`CrossImgSpeed`, `DodgeImgTell`, ...) and a few control variables.

**Kinds** (each is a small block of events keyed by `Kind`; everything else is shared):

| Kind | Tell | Move | Strike | Replaces |
| --- | --- | --- | --- | --- |
| 1 swing | sword raised | lunge toward the player (side locked) | swing hitbox at the sword point | crossing image, dodge images |
| 2 strike | eye glint | flash step to `LandX` with a dash line | passing strike and its line | dash image kind 1 |
| 3 wall | none (the sheathe glint is inside the animation) | flash step to `LandX` | wall slash and the crescent | dash image kind 2 |

**Shared events** (written once): facing the player, opacity from `Fade`, tell and glint timing, the lunge maths, fade and delete, cleanup on stun and after a maximum life, AimX for the directional deflect, the trail line and its fade.

**Taking turns.** The double dodge currently has hand-written "the second waits for the first" conditions. Replace it with `Order` on each echo and one Samurai variable `EchoTurn`: an echo may only strike when `EchoTurn` equals its `Order`, and finishing a strike adds 1. That covers any number of echoes.

**Him waiting.** `DodgeWait`, `DashWait` and the crossing's wait become one rule: while any echo is not yet done (`State` below fading), he stands and faces the player. This replaces the four release events with one.

**Spawning.** Skills call a single spawn step: create an echo at a position and set `Kind`, `Order`, `LandX`, `Delay`. In JSON this is a short action list at each call site, or (if the project's instruction set allows) one events function. The call sites stay where they are: the flash step's teleport, the landing, the crossing's landing.

## Can it loop forever?

No, and the design makes that structural:

1. An echo's events only ever change the echo, its own hitbox and the shared `EchoTurn`. They never create an echo, start a skill or touch his `AIState`. Only skill events spawn echoes.
2. Spawning is guarded: `SceneInstancesCount(Samurai_Echo)` below a cap (`EchoMax`, 2) and a `ChainDepth` passed at spawn (an echo-spawning dodge may happen once per dodge, as `DodgeChained` does now).
3. Hard stop: every echo deletes itself after a maximum life and on any stun.

So when he does the triple slash in phase 3, the echo plays kind 1 (lunge and one swing) and fades. It cannot start another triple slash.

## Order of work

Each step ends with the tests passing and a playtest checkpoint, because the checks do not run the engine.

1. **Test harness.** New debug keys to force a dodge and a double dodge (today only the dash strike and wall slash have keys). Playtest the current behaviour once as the reference.
2. **Echo infrastructure plus the dash image** (kinds 2 and 3): the simplest and newest copy. Build the object, the per-instance variables, the shared events and the spawn step. Delete the old dash image objects, events and variables.
3. **Dodge images** (kind 1 with `Order` and `EchoTurn`): replaces dodge image 1 and 2 and the two wait events.
4. **Crossing image**: the riskiest, because it is wired into his crossing sequence (his swing comes after the image's, the directional deflect aims at it, and `Samurai_Mirror` is shared with the mirror skills). Move it to kind 1 last. This step can be dropped if it is not worth the risk.
5. **Cleanup and tests.** Remove the leftover objects, variables, mirror frames and resources, and retarget the behaviour tests to the new names. The tests keep their meaning: side lock, phase 3 only, the glint rules, the wait, the chain rule. Add one that proves no echo event creates an echo.

Expected result: about 45 echo events instead of 130, about 6 control variables on the Samurai instead of 57, one object instead of four.

## Risks

- **Picking with several instances.** GDevelop applies an event to every echo matching its conditions, one at a time. That is what makes per-instance state work, but it is the main thing I cannot test outside the engine. Playtest after steps 2, 3 and 4.
- **Shared hitbox.** `Delete(Samurai_Hitbox)` in his own events must not remove an echo's hitbox. Echo hitboxes are separate objects, so they stay out of his deletes.
- **Same behaviour.** The timings and tuning stay as they are now (telegraph 0.5 s, dash image delay 1 s, side lock, glints). The refactor changes structure, not feel.

## Open choices

1. **How far to go on OOP.** Plan above: external-style events plus per-instance variables, which can all be done in the project JSON. A true GDevelop custom behaviour (an extension with properties and its own events) is more encapsulated but has to be authored and debugged in the editor, and I could not generate or test it from here. Recommended: the JSON approach now, with the kinds laid out so that a behaviour could wrap them later.
2. **Crossing image in or out** (step 4).

## Progress

- Step 1 done: debug keys Num8 (forced dodge) and Num9 (forced double dodge).
- Step 2 done, awaiting playtest: `Samurai_Echo` and `Samurai_EchoLine` exist, with the per-instance variables Kind, State, Order, Side, SpeedNow, Dist, Delta, Fade, LandX, Delay. The dash image is migrated (Kind 2 dash strike, Kind 3 wall slash) and its old objects, events and variables are gone. `EchoBusy` (computed every frame) drives his DashWait. Playtest with PageUp (phase 3), then Num6 and Num7.

- Hotfix: the red Enemy_Test blade (a visual aid) showed on his combo swing; the combo hitbox is now invisible like all the others (fight and tutorial).
- Step 3 done, awaiting playtest: the dodge images are echoes (Kind 1) with Order, EchoTurn and EchoHold for the double dodge. `Samurai_DodgeImage`, `Samurai_DodgeImage2` and `Samurai_DodgeHitbox` are gone (`Samurai_EchoHit` is the swing hitbox). One release event instead of four. Known edge: a dodge landing while a dash echo is still alive spawns no first echo but can still roll the chain; the lone second echo then waits for its turn until its 4 s life ends.
