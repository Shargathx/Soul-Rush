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

Double dodge reworked + skill variety (2026-11-14): the chain roll (DodgeChainChance 20 %) now happens at the first landing, so the order is dash, first image, dash again, second image, then the first image swings, then the second, then he carries on (the first image holds its sword while he dashes: DodgeChainWait; the second lunges once the first is done; he waits until both are). Samurai_DodgeImage2 and the DodgeImg2 variables are a copy of the first image's events. Melee spam fix: the end of the crossing no longer restarts the skill timer (that let him chain crossings while the player stayed close); it sets ForceSkill, so a skill comes next. The skill pick also avoids the same skill twice in a row (LastSkill).

Grabs and dash strikes in phase 3 (2026-11-14): the skill pick first rolls PickRoll (1 to 100): up to GrabPickChance (20) a grab (if its cooldown is ready), the next DashPickChance (25) a dash strike with the eye glint, otherwise the Judgement Cut / tornado / petals pick.

Dash strike image (2026-11-14, phase 3): when his dash strike is over, with DashImgChance (50 %) an image appears where he began the dash, holds the drawn-sword pose for DodgeImgTell, flash-steps through the player with the same passing strike (its own line hitbox, so the player has to face it for the deflect) and phases back into him. Not while a mirror exists, and not for the wall slash.

Reuse note: the crossing image, the two dodge images and this one are separate copies of one pattern (an object, a state variable, tell, move, swing, fade, cleanup). A generic "copy my last skill" is not possible in GDevelop because the skills are hand-written event sequences, not data. The way to reuse is one echo object with per-instance variables (Kind, State, timers) and events that pick the behaviour by Kind; that would replace the copies. Not done yet.

Dash image, revised (2026-11-14): phase 3, 100 % (DashImgChance). The image is left the moment he vanishes into a dash strike or a wall slash (not after it), and repeats the same attack DashImgDelay (1 s) later: flash step with the dash line, his own animation (passing strike, or the wall slash with the crescent), landing where he landed (DashImgLandX), then it fades there. It does not slide. The wall slash needed mirror-look frames for Samurai_Dash_Slash: added to tools/fx/mirror_frames.js and generated.

Dash image, glint and wait (2026-11-14): the image plays his red eye glint (mirror-look Samurai_Dash_Tell, DashImgGlint 0.5 s) just before its dash, and the dash starts when the glint has played. After his own dash strike or wall slash he waits (DashWait) until the image has finished its attack, then goes back to chasing.

Wall slash tuning (2026-11-14): his sheathe glint (frames 7 to 9 of the slash) was only 0.24 s and the crescent came straight after it, so the attack felt like it came during the glint. He now holds on the first glint frame for WallGlintHold (0.35 s) and the crescent hitbox starts one frame later (frame 11, off at 13). The wall slash image does the same hold (DashImgSlashGlint 0.35 s) and its crescent follows the same frames. The image has no eye glint any more (removed with its Dash_Tell frames); the dash strike image only has the drawn-sword pose before its dash.

Glint rules (2026-11-14): dash strike, him and the image: red eye glint, no sheathe glint. Wall slash, him and the image: the sheathe glint inside the slash animation, no eye glint, and no frame hold (the hold looked off; the glint plays in full and the crescent hitbox starts after it, frame 11). To make that true for him the eye glint is skipped when the dash would land at a wall: DashWall (computed every frame, 1 when the strike target is outside 70 to 1210) sends the offense dash, the picked dash strike and Num6 straight into the flash step. The tornado combos' dash still has the eye glint.
