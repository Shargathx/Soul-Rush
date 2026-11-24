# Ideas

Not built yet. Move an idea out of here when it becomes a branch.

## The game's twist: Curse, Brand and Mercy (design agreed 2026-11-24; nothing built yet)

This replaces the earlier sketch (curse as the one dial, "mercy makes the curse stick"). Three dials, each with its own source:

| | **Curse** | **Brand** | **Mercy** |
| --- | --- | --- | --- |
| Source | losing a life in a fight | killing a boss (no mercy shown) | sparing a boss (hold E at the last kneel, built) |
| Lasts | temporary: each deathblow clears ONE stack | permanent | permanent |
| Cost | -15% max HP per stack (as now) | -`BrandBudget / N` max HP per brand | none |
| Gives | Desperation (wider deflect window, as now) | the shadow powers (glass cannon: strong, frail) | the boss's gift (tools, the Cat's life) |

- **Curse stays as it is, with one change:** a deathblow clears one stack, not all of them (the `Curse removal` event in Combat_Shared clears all of them today and must change; the Desperation tests and the left-Alt debug key need a look). The deathblow still refills HP to the current max.
- **Brand is the glass cannon.** Each kill adds a brand, at most one per boss. A brand costs max HP permanently and opens a shadow power. Killing is not punished with a separate tax: the power is the trade (strong, frail). Mercy gives a gift instead and keeps full HP.
- **Mercy** is a flag per boss (`BossesBeaten.<scene>_Spared`, built); the count is derived from the flags, so the hub knows WHICH boss was spared. Mercy and killing are meant to be a flavour choice, not a best route: the gifts and the shadow powers are tuned to the same power budget, and the ending is the difference.
- **The Cat has three outcomes:** kill (a brand, no reward), mercy (the Cat lives in the hub, and its mercy gift is **+1 life**, a permanent sixth life, nine-lives joke; this shifts the HP budget table below by one row), and the hidden ending (do not attack, sit, F to pet): the Cat as an ability, counts as neither a brand nor a mercy.
- **Endings** read both: good (mercy), bad (brand), and a mixed one in between, as ratios of N (for example spared/N at or above 2/3 is good, killed/N at or above 2/3 is bad; the numbers are open). The world darkens with killed/N (stepped tint, candles going out, music filter); spared bosses show in the hub, and the hub's light and tones grow warmer with the mercy count. Mercy's feedback stays separate from the darkness (it must not read as one dial). The gates still close behind a spared boss: the game already has closed-gate sprites, and a spared boss is shown as a figure in the hub, not as an open gate.
- **The run can end early.** If a curse stack would take max HP below the floor, that stack is fatal and the run ends for good (the bad ending, reachable early). It is fatal only on the BREACHING curse, never at the moment a brand is taken (dying from getting a brand feels cheap; dying from being greedy and failing feels earned).

### The HP budget (everything scales with N, the boss count)

N comes from one place, the gate list in `tools/hub/hub.js`, so adding a boss there changes everything below. Everything is a ratio of N, so a new boss never needs a rebalance:

- Brand cost per kill = `BrandBudget / N`, with `BrandBudget` 60% of max HP. Killing everything always ends at -60%, whatever N is.
- Curse stays flat: 15% per stack (it comes from the 5 lives, not from N).
- Floor: max HP may not fall below 10%; the stack that would breach it is fatal.
- Free kills (no life lost to the budget) are about N/2. Each kill after that costs a life from the budget.
- The power pool grows by one per boss, but the loadout stays at 3 active slots (see Powers), so more bosses mean more choice, not more power.
- Existing saves: when a boss is added, the HP lost per brand shrinks, which only helps the player.

Example at N = 6 (brand 10%, curse 15%, floor 10%, 5 lives; the Cat's extra life shifts it one row):

| Brands | Curse stacks survivable (the next one is fatal) | Effective lives |
| --- | --- | --- |
| 0 to 3 | 4 (all of them) | 5 |
| 4 | 3 | 4 |
| 5 | 2 | 3 |
| 6 | 2 | 3 |

Five and six give the same lives, so the per-brand cost may want to be 12%. Tune it in a playtest.

**Healing is left alone.** The deathblow refills to the current max, so a lower max already means a smaller absolute heal; taxing it again per stack would double-charge. Check that rally healing is a % of max, not a flat amount.

**Sacrificed HP** (Blood pact, Wraith dash) is removed directly and skips the rally record, so rally cannot win it back. The deathblow refill still restores it.

### Powers (the user went through the list on 2026-11-24)

Design rules: change a verb, not a number (no stat boosts); each has a real cost (glass cannon); nothing may add posture (it would speedrun the meter).

**Perfect deflect** is the shared trigger for the passive powers: a deflect landed in the first part of the base window (a `PerfectFraction` constant, about the first third to start; to be tuned by playtest). Desperation's extra window never counts as perfect, so the curse widens the forgiveness but never the reward. Needs a visual confirmation when it happens: a placeholder mark above the player for now.

**Free order.** The gate order will change, and the player may pick which gate to unlock and in what order (a playtest build has every gate open anyway). Fights are not repeatable, so a power only helps the fights fought after the one that gave it; the boss fought last gives a reward with no fight left, which is the price of free order (it still counts toward the ending). Fighting the Samurai early means a curse stack early; nothing here depends on the order, because the HP budget is ratios of N. Most powers are earned from the boss they belong to (the table below). The ones with no boss (Requiem and the rest, see Open) unlock from the brand count alone.

**The loadout.** The player carries 3 ACTIVE powers, the mercy gifts and the shadow powers sharing the same slots, so the kill or spare choice shows up as a build choice. Once the third power is in, a new brand only adds variety and still costs max HP, which makes mixed runs the sensible outcome (the soft cap on killing).
- **Switching happens in the hub**, not mid-fight: a new interactable (an altar or similar) or the glossary. Q is the "activate power" key. A tap of E, or R, could cycle the equipped power in a fight; open, and only if playtests want it (E is the mercy hold, so it must be a tap).
- **Passives do not take slots.** They are always on once unlocked. The kill passives unlock by brand count, so they cannot become strong too fast: Shadow echo at 1 brand, Riposte at 2, Projectile return at 4, Roll deflect at 5 (the order may change for balancing). A spared boss can give a passive too: the Bladekeeper's Metal coat. The mercy count also unlocks the Composure passives (below), the mirror of the brand ladder, so a run that spares everyone is not left without passives.
- **The dodge slot.** Separate from the 3 active slots: the player picks ONE dodge, the roll (default, the fallback), the Flash step or the Wraith dash. A dash replaces the roll on the same key, with no Q. It is picked in the hub with the rest of the loadout. See the dodge rows in the power table.
- A spared boss's gift is a tool in the pool, equal to a shadow power; the Cat's +1 life is permanent and outside the loadout.

| Power | Type | What it does | Cost / notes |
| --- | --- | --- | --- |
| **Shadow echo** | passive | Your attacks echo about 1 s later. (Its deflect part was dropped: the knockback was more annoying than useful.) | The Samurai_Echo tech exists; it needs its own look (a faint blue outline) so it does not read as his. Brand 1 |
| **Riposte** | passive | A perfect deflect fires an auto-counter (HP damage only, no posture) | Brand 2. Needs the perfect-deflect trigger |
| **Projectile return** | passive | A deflected projectile flies back at the boss for HP damage, never posture | Brand 4. Returnable: the Bladekeeper's ranged attack, the Ranger's arrows, the Gunslinger's bullets. Not returnable: area attacks (arrow rain, grenades, `Directional = 0`) and beams (the laser). The Samurai's tornado is open (iconic, but a moving hazard) |
| **Cinder blade** | active | The blade is lit for a few seconds: hits burn | Costs on use. Must look different from the Fire Knight's mercy flame |
| **Requiem** | active | The big one-time slash with a camera zoom; it can take HP to 0 and end a phase | Close to the boss and at or below about 30% HP (not limited to the last life). On the last life HP 0 still puts the boss in the deathblow kneel, so the deathblow and the mercy choice still happen. Built as once per fight; once per playthrough is a one-flag change (better story beat, but it can be wasted). Comes from brand alone, not from a boss: unlocked at 3 bosses killed, so it still has fights left to be used in |
| **Poison stab** | active | A short-range arrow stab: the boss's posture cannot recover for about 5 s | Cooldown. Strong against the Samurai (his regen is fast at full HP). The Ranger's kill power |
| **Decoy** | active | A dodge (the roll, or a dash) leaves an afterimage for about 2 s that bosses may face and aim at, but only when the cooldown is ready; a boss that swings at it whiffs, which opens a recovery window. When it is hit it puffs into air (flavour only: the boss is NOT stunned or confused) | The Leaf Ranger's second kill power (a leaf substitution; he already dissolves into leaves). Cooldown of X seconds (a dodge made while it is cooling down leaves no decoy, so spamming the Flash step cannot spam decoys), and an HP sliver per decoy is an option. The cost is in the bosses: each boss script must be able to aim at it (the Samurai already aims at his illusion with `AimX`). It fires on any dodge: the roll, the Flash step or the Wraith dash |
| **Berserk** | active | A timed stance (about 8 s): more damage (HP damage, never posture), your dodge costs 90% less of whatever it costs (stamina for the roll, recharge time for the dash charges; HP is never discounted, so the Wraith dash cannot be spammed for free), and hits landed regain rally HP faster | No deflecting while it is on. Entry costs sacrificed HP. There is NO early end after two hits: that would make it too safe. The Bladekeeper's kill power for now (it replaces the earlier plan of giving it to the 6th brand; it may move again). Must not become the meta |
| **Blood pact** | active | Spend current HP to refill stamina at once | The Gunslinger's kill power (a devil's bargain). Stamina is a real bottleneck in fast trading, so start with the plain refill. If it proves too weak, the next version pays sacrificed HP to reset the cooldown of one of the other two equipped powers (left open on purpose). The HP is sacrificed HP (see above), with a threshold below which it cannot be used |
| **Wraith dash** | dodge | Replaces the roll. Dash through enemies and attacks, with the best i-frames of the three, and attacking is allowed out of it. No charges: every dash costs sacrificed HP | The Samurai's kill power ONLY: sparing him gives the Flash step instead, never the Wraith dash. Costs sacrificed HP (see above) |
| **Flash step** | dodge | Replaces the roll. A faster, longer dash that passes through enemies and attacks, with i-frames. Runs on dash charges (2 to 3, recharging) instead of stamina, so it can be spammed | The Samurai's mercy gift (the player has only a roll today). Crossing to the other side of a boss is the player's choice (dash toward him and through), not automatic, so it does not fight the facing rule for deflects. The earlier "only during an attack's active frames" rule is dropped |
| **Roll deflect** (rename to Dodge deflect) | passive | Deflect the roll-only attacks (the Cat's dash and eruption, the Samurai's grab) with a tight window | Brand 5. Works with any dodge. The Cat's older "curse unlocks verbs" idea |
| **Metal coat** | passive (a mercy gift) | When a hit would take the player's HP to 0, a metal coating forms (like the Bladekeeper's own guard): the player is healed 50% and the boss is knocked back and has to stop attacking | The Bladekeeper's mercy gift. Because the hit no longer costs a life, no curse stack is taken. Limit: twice per playthrough (decided; the game must stay challenging). The knockback stays: it is only a small break from the boss's attacks and breaks his attack pattern (the deflect knockback was dropped because it was a routine effect; this one is a rare rescue) |

Dropped: Thorn trail (replaced by the poison), Dead eye (slows the game), Pounce, Cursed sight (the eye glints and attack tells already do this job), and the old "tools cost a curse stack".

### The mercy gifts (the pair for each kill power)

| Boss | Gift (mercy) | Kill power |
| --- | --- | --- |
| Cat | +1 life; the Cat in the hub | none (a brand) |
| Leaf Ranger | **Bloom:** the player drives one arrow into the ground at their feet (the Ranger_Sprout art exists); the patch heals the player slowly for about 6 s, with a cooldown. It never heals the boss. It heals as a % of max and cannot restore sacrificed HP. Needs a short plant animation (a crouch or kneel frame) | Poison stab, and Decoy as a second kill power |
| Gunslinger | **Pistol parry:** a quick shot, usable as a ranged parry, that ministuns and adds a fixed amount of posture (not a break) | Blood pact |
| Fire Knight | **A heavy flame attack** like the knight's own. The user has an unused player attack animation to pull in later | Cinder blade |
| Samurai | **Flash step** (the dash on charges; so he has two dashes, a plain one for mercy and the Wraith dash for a kill) | Wraith dash |
| Bladekeeper | **Metal coat** (passive, see the table above) | Berserk |

Riposte is a brand-count unlock, not the Bladekeeper's; the user may tie more abilities to bosses later.

**Samurai bonus: Petal step.** A bonus power, like the Cat's ability. The player gets it if they fulfil EITHER requirement: they are not hit once during the normal Samurai fight (all phases), OR they deflect every Thousand Cuts (the 3 sequences of it through phase 3). The player vanishes in a shower of petals and reappears behind the enemy, with room to punish. The appearance is fast; the petals fade slowly as his do. The boss is ministunned during it (confusion, like the Mist Raven in Sekiro). It is an active power, so it takes a loadout slot. The assumption is that it comes on top of the kill or spare outcome, which still counts as normal (to confirm).

### Composure: the mercy ladder (decided 2026-11-24)

Desperation is the silver lining of being hurt (more curse stacks, a wider deflect window). Composure is its mirror: the silver lining of staying unhurt. These are passives (always on, they take no slot) unlocked by the mercy count, the way the kill passives unlock by brand count, and each works only while the player is at HIGH HP: above about 80 to 85% of max HP, a band and not full HP, so one small mistake does not turn everything off. The band value is open for playtest.

| Mercy | Name | While the player is above the HP band |
| --- | --- | --- |
| 1 | **Poise** | Stamina regenerates faster. Stamina is a real bottleneck in fast trading, so this is felt at once |
| 2 | **Respite** | A perfect deflect refunds some stamina and a dash charge. The mercy twin of Riposte: Riposte gives damage, Respite keeps the player moving |
| 3 | **Steady hand** | The perfect-deflect window is a little wider (the Desperation extension still never counts as perfect) |
| 4 | **Light step** | The dodge is cheaper: dash charges recharge faster (the Flash step), and the roll costs less stamina (the fallback). The Wraith dash gains nothing, since HP is never discounted |
| 5 | **Grace** | Hits cost less of the player's own posture, a sturdier defence without extra HP |

Rules: no boss posture and no raw damage (it would speedrun the meter). The kill side has damage and burst, the mercy side has uptime and consistency.

Hub: spared bosses stay in the hub as figures (some may give a hint line about a later boss), and the hub's light and tones grow warmer with the mercy count (the counterpart to the darkening from kills). The gates still close.

### The talent trees (decided 2026-11-24)

The two ladders become two talent trees, in the style of a World of Warcraft talent tree: the Brand tree in shadowy art, the Mercy tree in warm light, side by side on one hub interactable (the same altar that switches the loadout, or the glossary). One kill is one Brand point and one spare is one Mercy point, so a mixed run fills half of each tree. Some nodes are fixed (they simply unlock), some are choice nodes (pick one of several). Respeccing the choice nodes is free in the hub, so a choice is a preference and not a trap; the counts themselves are permanent.

| Tier | Brand tree (kills) | Mercy tree (spares, above the HP band) |
| --- | --- | --- |
| 1 | Shadow echo (passive) | Poise (passive) |
| 2 | Riposte (passive) | Respite (passive) |
| 3 | Requiem (active, takes a slot) | Steady hand (passive) |
| 4 | Projectile return (passive) | Light step (passive) |
| 5 | Roll deflect (passive) | Grace (passive) |
| 6 | CHOICE: Reap, or Soul Rush | CHOICE: Kindred, or Halo |

Only tier 6 is a choice node for now; more choice nodes below it need two powers per node, so they come later if wanted. The boss-bound powers (Wraith dash, Poison stab, Decoy, Cinder blade, Blood pact, Berserk, and the mercy gifts) are NOT in the trees: they come from the boss, as in the tables above.

**Reap (Brand 6).** An upgraded Requiem: spend a life to take a boss life outright, an instant deathblow with no posture break. It costs a curse stack and does not clear one (a deathblow clears one stack, so Reap must not count as one), and it gives no refill heal. The game refuses it when the extra stack would breach the HP floor, so it is never a suicide button. It cannot be used in an intermission or an invulnerable phase. On a last life it still sends the boss into the deathblow kneel, so the mercy choice is not skipped.

**Soul Rush (Brand 6, the title move).** After each deathblow, a short rush with free dodges and a chain of hits. It is close to Berserk, so it stays an option only if a clear difference is found; it may be cut.

**The Shade (a forced fight at brand 6).** When the player reaches 6 brands the Shade comes for them: they return to the hub after the 6th kill, the tree's capstone node lights up, they pick Reap or Soul Rush, and then the fight is forced. So the capstone has a fight to be used in. It appears on the bad path; whether it appears earlier on a bad path with fewer brands (for example 2/3 or more kills) is open. The cheap and readable design is a boss with its own stable moveset that BORROWS the player's equipped powers as telegraphed attacks, not an AI that plays like a human: Cinder blade becomes a fire-sword phase, Flash step becomes crossing attacks (the Samurai's mirror and crossing tech exists), Poison stab locks the player's posture recovery, Decoy becomes afterimages that swing. It needs a new fight design.

**Kindred (Mercy 6).** A spirit of a spared boss strikes the boss.
- Which spirit: varied, from a shuffled bag of the spared bosses (each appears once before any repeats), not purely random.
- A gauge fills with perfect deflects (about 5 per use); it can be used up to 3 times in a fight (for now), and the gauge resets per fight.
- Guaranteed landing: every assist locks onto the boss and cannot miss. All six are offensive blows (the Bladekeeper's guard-bash, the Cat's pounce), with no posture damage.
- Damage is a ratio so it scales with every boss: about 5% of the boss's current life HP per use, about 15% of a life per fight at most.
- The boss is held for about a second during an assist, except in an intermission, and it cannot be used in a last-life kneel.
- Samurai: a flurry of petal cuts (the thousand cuts). Ranger: an arrow rain from above. Gunslinger: three quick shots. Bladekeeper: a guard-bash. Cat: a pounce.
- Kindred needs fights to be useful, so it waits for the end boss the user plans to add (see Open). Until then Halo is the capstone that always works.

**Halo (Mercy 6).** The Composure HP band drops to about 50%, so all five Composure passives work most of the time. Simple and always useful.

**The last salute** is not a tree node: it is the mercy ending scene (a nod and a bow, like the bosses' own mercy scenes) once the end boss or finale is spared.

### Open

- The Composure HP band (above 80 to 85% to start), and the size of Light step's two effects (the charge recharge rate and the roll's stamina discount).
- Brand-count unlocks so far: Shadow echo 1, Riposte 2, Requiem 3, Projectile return 4, Roll deflect 5 (the order may change for balancing). Brand 6 and Mercy 6 are the tier-6 choice nodes of the talent trees.
- The dash numbers: how many charges and how fast they recharge for the Flash step, the Wraith dash's HP cost per dash, and the Berserk discount on charges (all by playtest). Decided: a dash replaces the roll on the same key, the roll stays as the fallback, and the dodge has its own slot.
- Blood pact: plain stamina refill first, the cooldown-reset version if it is too weak.
- The hub interactable for switching powers (an altar, or the glossary), and whether a tap of E or R cycles powers in a fight.
- Whether the Samurai's tornado can be returned, and how the laser reacts.
- Where the ending triggers: the user will add an end boss at some point (which also gives Kindred its fights). Still open: whether the Shade is that end boss on the bad path, and the ending thresholds.
- The `PerfectFraction` value and the per-brand cost: both by playtest.
- Whether the Petal step counts alongside the kill or spare outcome (assumed yes).
- The Cat: petting counts as neither a brand nor a mercy, so a player who pets the Cat tops out at 5 mercies and misses Mercy 6. Intended as a dilemma (the Cat's ability against the capstone), or should the pet count as a mercy for the tree?
- The Cat's hidden ability (the pet ending) is still TBA.
- Soul Rush: keep as a Brand 6 option or cut.
- The Shade's fight design (see the trees section) and where the tree's art and interactable go.

### How each boss is spared (2026-11-21, the user's ideas; nothing built; the Cat's ending already exists and is the bonus)

- **Gunslinger:** a short text exchange above their heads: the player says "friend?", the Gunslinger answers "...", then "friend!". (Read as plain text bubbles; if the user meant it literally in binary, show the bits first and decode them.)
- **Bladekeeper ("metal"):** open, the user has no idea yet. Candidates to talk over: lay the sword down in front of her while she holds her guard; offer the sword hilt first; or a duel salute where the blades touch (the deflect sparks, one soft clink) and she lowers her guard. Her guard stance is the natural place to start it.
- **Fire Knight:** a pixel-art handshake picture (two armoured forearms clasped, reference: the famous forearm-clasp still) shown as a small card or inset, like the ENEMY DEFEATED card. Needs the Fire Knight fight merged first (branch fire-knight is not in development).
- **Samurai:** a bow, answered by his own Bow animation (assets/Enemies/Samurai/Bow, 8 frames), and then he can dissolve into petals leaving his sword, using the Hidden_Ending frames he already has (44 frames: he fades into petals, a sword stays). The player has no bow animation: try making a short one by tilting the upper body of the idle frame; if it is not smooth, skip it and let only the Samurai bow.
- **Built 2026-11-21 (branch mercy, unplaytested): hold E for 1 s at the last kneel** (a boxed E with a filling ring appears beside the deathblow orb; F still deathblows). Samurai: from his seated death kneel he stands (the death's first frames backwards), bows with his Bow animation while the player nods (Player_Nod, head only), then bursts into petals like in his intermission (Samurai_Petal_Burst), gone; his own death script is stopped meanwhile. The moment the hold goes through the boss's bars (HP, posture, name, life marks) disappear at once, no fade (scene.__hideBars, read by the fight UI in Combat_Shared). While the choice is open the kneel lasts 7 s (WINDOW in mercy.js: StunDuration / DeathKneelHold), then the usual death scene runs. The camera eases to 1.55x on the two of them (looking 80 px above the player's feet). Gunslinger: "friend?" in binary (01100110 01110010 01101001 01100101 01101110 01100100 00111111) with the decoded word under it, "...", then "friend!" in binary; he fades. Bladekeeper: she rises and takes her guard, the player steps up and raises his blade, one soft clink and a spark, she lowers her guard and fades. Each sets BossesBeaten.<scene>_Spared (saved by the hub with the rest; the number of those is the hidden mercy counter) and ends the fight through the usual victory fade. The player only nods (head only; a full bow was made too and kept as a backup: tools/fx/player_bow.js, docs/previews/player_bow.*). Leaf Ranger (built 2026-11-21): he kneels (his stun), rises and does his volley (the arrow rain animation, Ranger_3_atk); three arrows come down out of the sky at high speed one after another from different heights, onto spots at least 90 px from the player; each puts out a vine, leaves and blossoms (Ranger_Sprout, they stay in the arena); the moment the last arrow lands and starts to bloom the player nods and he starts to dissolve (the other blooms and the nod carry on while he goes) into leaves, like the Samurai into petals: an animation of his own (Ranger_Dissolve, 34 frames, tools/fx/ranger_dissolve.js) that takes his standing frame to pieces pixel by pixel from the head down, the pieces flying off as green leaves and specks in his colours. His own sounds play: the draw, four releases and the whoosh as the volley goes up, a landing per arrow; art in code, tools/fx/ranger_sprout.js. Only offered in his posture-break kneel on the last life (if his HP reaches 0 first he just dies; no death-kneel stall like the Samurai's yet). The key and the power scroll: the scroll must be on another key, or a tap of E; the mercy needs a hold.
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
