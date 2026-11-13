# Ideas

Not built yet. Move an idea out of here when it becomes a branch.

## Samurai: the crossing attack (replaces the old basic attacks)

Instead of his plain melee combo, he attacks, then dashes to the other side of the player. He leaves a mirror image
behind that attacks too, and then he attacks from the new side. The rhythm should be right for the player to turn
around for each attack and deflect it: front, behind, front (or the reverse), each one readable and each one on a beat.

Notes for when it is built:
- Reuses the mirror image, the flash step and the Judgement Cut dash (`MirrorDashTime`, `MirrorBehind`) from the phase 3 work.
- The beat between swings is the thing to tune: long enough to turn and raise the sword, short enough to feel like a chain.

## Long-term: deflects need the right facing (first step built 2026-11-14, Samurai only)

A deflect only works if the player faces the attack. Combined with the crossing attack above, this makes turning a
real part of the fight. It changes every boss (Samurai, Leaf Ranger, Gunslinger), so it needs a design pass on ranged
attacks first: arrows and bullets from behind would need a tell.

## Samurai: faster in phase 3, with afterimages

In phase 3 he runs faster, and his running leaves afterimages behind: a speed technique in the style of Naoya
(Jujutsu Kaisen) or the Sandevistan (Cyberpunk: Edgerunners).

- The afterimages use the mirror image's sprite, but they never attack and never move.
- One is spawned every X pixels he travels (or per fixed time step, whichever looks better at his speed), and each fades out quickly.
- Tint them the way the mirror's glitch is tinted, so they read as one family with the mirror and don't look like a second enemy.
- Needs a cap on how many exist at once, and cleanup when he is stunned or dies.

First step, built for the Samurai: `Player.FacingOk` (set every frame by the Samurai sheet, read by the deflect in `Combat_Shared`) is 0 when the player is not facing him. It stays 1 while the mirror is out (two sources), in the intermission and at his death, when he is within 40 px sideways, and for petals within 120 px. `DirectionalDeflect` on the Samurai (1/0) switches it. Still open: the Leaf Ranger and Gunslinger (arrows from behind need a tell; the arrow rain is multi-source), and a visual tell when a deflect fails for facing.
