# Ideas

Not built yet. Move an idea out of here when it becomes a branch.

## Samurai: the crossing attack (built 2026-11-14, phase 3; Num3 tests it)

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

As built (2026-11-14), in the fight scene only: after his first swing he does not swing again but crosses. Phase 2: front, behind, back (three swings, two flash steps, no images; CrossSoloAt 0.6 s after each landing). Phase 3: the image he leaves behind at each step swings too (CrossMirrorAt 0.5 s after he lands, he follows at CrossSamAt 1.1 s), and the sequence is one step (the single crossing) or two, 50/50 (Cross2Split). The image and the afterimages use the mirror sprites. Debug keys Num3 to Num5.

Image lunge (2026-11-14, phase 3): the image no longer waits where it spawned. After CrossMirrorAt (0.3 s, the telegraph, sword raised) it dashes at the player (harmless, no hitbox), then swings; he swings CrossSamGap (0.6 s) after it. Tuning, all on Samurai_NPC in the fight scene: CrossImgSpeed 1400 px/s, CrossImgAccel 9000 px/s2, CrossImgRange 90 (strike distance), CrossImgMaxTime 0.45 s and CrossImgMaxDist 600 px (cutoffs if the player runs off), CrossImgMinGap 120 (side lock: it stays on its spawn side of him, never closer than this to him). It homes on the player's position each frame; there is no velocity prediction yet.

Dodge images (2026-11-14, every phase): dodge chance is 10 / 20 / 40 % in phases 1 / 2 / 3 (DodgeChanceP1-P3, copied into DodgeChance by phase). Every dodge, behind or away, leaves an image at the spot he left (Samurai_DodgeImage, a copy of the mirror look): it holds its sword for CrossMirrorAt, lunges at the player with the CrossImg tuning, and swings with its own hitbox (Samurai_DodgeHitbox, in the EnemyHitbox group, so it is deflected like his own; the deflect has to face the image). One at a time; a stun or 3 s removes it. State is DodgeImgState on Samurai_NPC.

Revised the same day: dodge images are phase 3 only (phases 1 and 2 dodge without one; phase 1 keeps the plain triple swing, phase 2 the crossing without images). The image appears when he has landed from the dodge (FlashIn finished) and telegraphs for DodgeImgTell (0.5 s) before it lunges and swings, so there is time to react.

Directional deflecting and the illusion: the boss sets AimX (the x of whoever attacks right now); Combat_Shared uses it instead of the boss position when it is 0 or more. The Samurai aims it at the illusion while the illusion swings, so that swing has to be faced.

Dodge wait and chain (2026-11-14): in phase 3, when a dodge leaves an image he stands and waits (DodgeWait) until the image has swung, so his counter or skill never lands on top of it. Then, with DodgeChainChance (20 %) and once per dodge (DodgeChained), instead of the counter or skill he dashes away once more and leaves a second image, and waits for that one too.
