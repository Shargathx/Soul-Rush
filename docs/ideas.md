# Ideas

Not built yet. Move an idea out of here when it becomes a branch.

## The game's twist (open, 2026-11-18, the user is still thinking it over)

Where the curse and the tools stand: each deathblow clears ONE curse stack (not all, and the old Grudge idea is dropped as it was). Tools are meant to be fairly spammable, so they are limited by a separate currency later, not by the curse (so "tools cost a curse stack" was rejected).

- **Mercy path for every boss (planned, rewards still open).** The Cat's hidden ending (do not attack, sit, F to pet; BossesBeaten.Cat_Friend) generalised: each boss has a non-violent resolution next to killing it. Killing gives the boss's tool; sparing gives something different (the Cat becomes a friend in the hall). The hub shows who was spared and who was killed, and the keeper's lines change. The user finds the idea good but not very original, so the reward for sparing and what makes it unusual are the open part.
- **Cursed sight (open question: how would it look without breaking the flow of combat?).** More curse stacks show more information about what the boss does next, as a trade against the curse's costs. Fixed timings stay. Needs a visual that does not clutter the fight, and it must NOT build on the Cat's red/orange strike zones (those are placeholders to see where damage lands and come out before release). A tell on the boss's own body (weapon hand or eyes) is the nearest idea.

### Ways to raise the curse ON PURPOSE (2026-11-18; not raw damage, not stat boosts: the user finds those boring; all four liked, to be combined)

1. **The curse unlocks things you cannot normally do.** At 2 to 3 stacks you can deflect the roll-only attacks (the Cat's dash and eruption, the Samurai's grab), with a tighter window. It changes your verbs, not your numbers, and sits next to Desperation (more stacks, more timing room).
2. **A shadow of you.** At stacks, an echo of you repeats your last action about a second later (a swing lands twice, a deflect leaves a delayed deflect). The Samurai_Echo tech exists; it needs its own look (a faint blue outline) so it does not read as his.
3. **The curse as a key, not a power.** Some things only exist while you are cursed (a hidden fight, a hub altar, secret keeper lines), others only while you are clean. Your curse level is how the world sees you.
4. **Tools change character, not cost.** Curse stacks change what a tool does (the dash leaves a short damaging trail, poison spreads). Tools stay spammable, limited by the currency, not by the curse.

### Combining them (a sketch, to be argued with)

- Curse is the one dial (0 to 3 stacks, from lost lives). A deathblow clears one stack.
- **Mercy makes the curse stick.** The merciful ending of a boss means no final deathblow, so that is one clearing less per boss, and mid-fight deathblows (one per life lost on the Cat and Bladekeeper) can be missed, which makes it harder. So the merciful route is the cursed, harder route, and the killing route stays clean.
- **That gives the two routes different rewards without numbers.** Killing a boss gives its tool (clean, strong tools, few curse verbs). Sparing gives curse verbs and cursed-only content (1, 2, 3 above), and tools get their curse flavour (4).
- **Rulings (2026-11-18):** the Cat's ending is a BONUS (it gives the Cat as an ability, TBA) and counts as neither merciful nor killing. The merciful ending is tracked by a hidden mercy counter, +1 for each boss spared, so a flawless player who never takes a curse stack stays on the merciful track anyway (they were good enough not to die). So the counter is the story, and the curse is a separate dial the player raises on purpose for the curse abilities.
- Open: how a boss is spared in the fight itself (the Leaf Ranger's death hold, where the deathblow waits 2 to 3 s and then he dies on his own, could become "he yields" when you do not take it); whether the counter is one number or a flag per boss (a flag per boss also says WHICH boss, and is better for the hub); what the counter's steps unlock (the ending, hub changes); whether the cap of 3 stacks is enough for four curse ideas.

### How each boss is spared (2026-11-21, the user's ideas; nothing built; the Cat's ending already exists and is the bonus)

- **Gunslinger:** a short text exchange above their heads: the player says "friend?", the Gunslinger answers "...", then "friend!". (Read as plain text bubbles; if the user meant it literally in binary, show the bits first and decode them.)
- **Bladekeeper ("metal"):** open, the user has no idea yet. Candidates to talk over: lay the sword down in front of her while she holds her guard; offer the sword hilt first; or a duel salute where the blades touch (the deflect sparks, one soft clink) and she lowers her guard. Her guard stance is the natural place to start it.
- **Fire Knight:** a pixel-art handshake picture (two armoured forearms clasped, reference: the famous forearm-clasp still) shown as a small card or inset, like the ENEMY DEFEATED card. Needs the Fire Knight fight merged first (branch fire-knight is not in development).
- **Samurai:** a bow, answered by his own Bow animation (assets/Enemies/Samurai/Bow, 8 frames), and then he can dissolve into petals leaving his sword, using the Hidden_Ending frames he already has (44 frames: he fades into petals, a sword stays). The player has no bow animation: try making a short one by tilting the upper body of the idle frame; if it is not smooth, skip it and let only the Samurai bow.
- **Built 2026-11-21 (branch mercy, unplaytested): hold E for 1 s at the last kneel** (a boxed E with a filling ring appears beside the deathblow orb; F still deathblows). Samurai: from his seated death kneel he stands (the death's first frames backwards), bows with his Bow animation while the player nods (Player_Nod, head only), then bursts into petals like in his intermission (Samurai_Petal_Burst), gone; his own death script is stopped meanwhile. While the choice is open the kneel lasts 7 s (WINDOW in mercy.js: StunDuration / DeathKneelHold), then the usual death scene runs. The camera eases to 1.55x on the two of them (looking 80 px above the player's feet). Gunslinger: "friend?" in binary (01100110 01110010 01101001 01100101 01101110 01100100 00111111) with the decoded word under it, "...", then "friend!" in binary; he fades. Bladekeeper: she rises and takes her guard, the player steps up and raises his blade, one soft clink and a spark, she lowers her guard and fades. Each sets BossesBeaten.<scene>_Spared (saved by the hub with the rest; the number of those is the hidden mercy counter) and ends the fight through the usual victory fade. The player only nods (head only; a full bow was made too and kept as a backup: tools/fx/player_bow.js, docs/previews/player_bow.*). Leaf Ranger (built 2026-11-21): he kneels (his stun), rises and does his volley (the arrow rain animation, Ranger_3_atk); three arrows come down out of the sky at high speed one after another from different heights, onto spots at least 90 px from the player; each puts out a vine, leaves and blossoms (Ranger_Sprout, they stay in the arena); the player nods while the last blooms, and only then he dissolves into leaves, like the Samurai into petals: an animation of his own (Ranger_Dissolve, 34 frames, tools/fx/ranger_dissolve.js) that takes his standing frame to pieces pixel by pixel from the head down, the pieces flying off as green leaves and specks in his colours. His own sounds play: the draw, four releases and the whoosh as the volley goes up, a landing per arrow; art in code, tools/fx/ranger_sprout.js. Only offered in his posture-break kneel on the last life (if his HP reaches 0 first he just dies; no death-kneel stall like the Samurai's yet). The key and the power scroll: the scroll must be on another key, or a tap of E; the mercy needs a hold.
- **Was still open:** the shared trigger. How does the player choose mercy at the moment of the last stun (instead of the deathblow prompt F)? A second prompt and key next to F is the simplest; it must not be pressable by accident. The mercy counter (+1 per boss spared) is set when the exchange ends.

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

Echo refactor (2026-11-14, done): the crossing image, the dodge images and the dash images are all `Samurai_Echo` now (see docs/echo-plan.md). Where the earlier notes above say image, read echo; the tuning variables kept their names (CrossMirrorAt, CrossSamGap, CrossImg*, DodgeImgTell, DashImg*).
