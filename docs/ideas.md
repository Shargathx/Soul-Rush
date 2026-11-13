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

Built for every fight that uses Combat_Shared (the Samurai and the Leaf Ranger; the Tutorial too): the deflect event needs Player.FacingOk = 1 (worked out just above it: the player is not facing the boss) unless the attack has Directional = 0. Each attack object has a Directional variable: 1 normally, 0 for the Samurai's Judgement Cut, Thousand Cuts and petals, the Leaf Ranger's Ranger_Diag (arrow rain and air volley) and the Gunslinger's Grenade_Explosion. A boss can also set DeflectAnySide to 1 while several attacks hit at once (the Samurai does it in the intermission and at his death; the mirror image is not a second boss, so its attacks only need the player to face him). Also skipped when the boss is within 40 px sideways. Player.DirectionalDeflect (1/0) switches the whole rule. Still open: the Gunslinger's own deflect event (in its scene) does not read FacingOk yet, arrows from behind may need a tell, and there is no visual tell yet for a deflect that failed because of facing.
