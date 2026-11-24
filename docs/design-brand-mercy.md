# Curse, Brand and Mercy: the design

Design agreed on 2026-11-24 in a long brainstorm; **nothing here is built yet** except the mercy mechanic itself (hold E at the last kneel, `tools/mercy/`). It was moved out of `docs/ideas.md`, which is for loose ideas. The sections below are the design; the **Build plan** at the end says in what order to build it.

Related: `docs/balance.md` (the current combat numbers, which this design changes), `docs/echo-plan.md` (the Samurai's echo object: the Shade and the Decoy borrow its ideas), `tools/test/README.md` (the checks every change must pass).

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

## Glossary

The terms of this design, so the words stay fixed. Existing game terms are marked (existing).

| Term | Meaning |
| --- | --- |
| **Curse / curse stack** | The temporary penalty for losing a life in a fight: one stack per life, -15% max HP each (existing). A deathblow clears ONE stack (a change). |
| **Desperation** | The curse's silver lining: each stack (up to 3) widens the deflect window a little (existing). |
| **Brand** | The permanent mark for killing a boss with no mercy shown: one per boss, -`BrandBudget / N` max HP each. Opens the Brand tree. |
| **Mercy** | Sparing a boss (hold E at the last kneel; existing). A flag per boss; the count is derived from the flags. Opens the Mercy tree. |
| **Pet ending** | The Cat's hidden outcome: do not attack, sit, pet it. Counts as neither a brand nor a mercy; gives the Cat's ability. |
| **N** | The boss count, read from the hub's gate list. Every budget and ending threshold is a ratio of N. |
| **BrandBudget** | The total max HP a full killer loses: 60%, split over N bosses. |
| **HP floor** | The minimum max HP (10%). A curse stack that would take it lower is fatal and ends the run. |
| **Effective lives** | How many lives the player can lose before the next curse stack breaches the floor. It shrinks as brands grow. |
| **Sacrificed HP** | HP paid as a cost (Blood pact, Wraith dash, Berserk's entry). Removed directly; rally cannot win it back; the deathblow refill restores it. |
| **Rally** | Hitting an enemy gives back part of the HP you recently lost (existing). |
| **Deathblow** | The finishing cut on a posture-broken enemy (F; existing). Takes a boss life, refills the player's HP, now clears one curse stack. |
| **Kneel / hold** | The boss's stun with the deathblow orb up (existing). The last kneel is where the kill or spare choice is made. |
| **Perfect deflect** | A deflect landed in the first part of the base window (`PerfectFraction`). Desperation's extra window never counts. The trigger for Riposte, Respite, Steady hand and Kindred's gauge. |
| **Composure** | The mercy tree's passives, which work only above the HP band (about 80 to 85% of max HP). The mirror of Desperation. |
| **HP band** | The "high HP" threshold Composure checks. |
| **Passive** | A power that is always on once unlocked. Takes no slot. |
| **Active** | A power used with the power key (R, decided 2026-11-24; Q stays the lunge, a basic player skill outside the loadout). Takes one of the 3 loadout slots. |
| **Dodge slot** | One slot for the dodge: the roll (default and fallback), the Flash step or the Wraith dash. A dash replaces the roll on the same key. |
| **Loadout** | The 3 active powers plus the dodge, chosen in the hub. |
| **Kill power / gift** | What a boss gives: a kill power (a shadow power, for a kill) or a gift (a tool, for a mercy). Bound to that boss, not to the trees. |
| **Bonus power** | A power outside the kill and spare choice: the Samurai's Petal step and the Cat's pet ability. |
| **Talent tree** | The Brand tree (shadowy art) and the Mercy tree (warm art): tiers 1 to 6, filled by the counts. Tiers 1 to 5 are fixed nodes, tier 6 is a choice node. |
| **Capstone** | The tier-6 choice: Reap or Soul Rush (Brand), Kindred or Halo (Mercy). |
| **Shade** | The forced fight at brand 6: a boss that borrows the player's equipped powers as telegraphed attacks. |
| **Kindred** | The Mercy 6 capstone: a spirit of a spared boss strikes, charged by perfect deflects. Needs the end boss to be useful. |

## The HP budget (everything scales with N, the boss count)

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

## Powers (the user went through the list on 2026-11-24)

Design rules: change a verb, not a number (no stat boosts); each has a real cost (glass cannon); nothing may add posture (it would speedrun the meter).

**Perfect deflect** is the shared trigger for the passive powers: a deflect landed in the first part of the base window (a `PerfectFraction` constant, about the first third to start; to be tuned by playtest). Desperation's extra window never counts as perfect, so the curse widens the forgiveness but never the reward. Needs a visual confirmation when it happens: a placeholder mark above the player for now.

**Free order.** The gate order will change, and the player may pick which gate to unlock and in what order (a playtest build has every gate open anyway). Fights are not repeatable, so a power only helps the fights fought after the one that gave it; the boss fought last gives a reward with no fight left, which is the price of free order (it still counts toward the ending). Fighting the Samurai early means a curse stack early; nothing here depends on the order, because the HP budget is ratios of N. Most powers are earned from the boss they belong to (the table below). The ones with no boss (Requiem and the rest, see Open) unlock from the brand count alone.

**The loadout.** The player carries 3 ACTIVE powers, the mercy gifts and the shadow powers sharing the same slots, so the kill or spare choice shows up as a build choice. Once the third power is in, a new brand only adds variety and still costs max HP, which makes mixed runs the sensible outcome (the soft cap on killing).
- **Switching happens in the hub**, not mid-fight: a new interactable (an altar or similar) or the glossary. The power key activates the equipped power: R (decided 2026-11-24), NOT Q, which stays the lunge (a basic skill, separate from the loadout). A tap of E could cycle the equipped power in a fight; open, and only if playtests want it (E is the mercy hold, so it must be a tap).
- **Passives do not take slots.** They are always on once unlocked. The kill passives unlock by brand count, so they cannot become strong too fast: Shadow echo at 1 brand, Riposte at 2, Projectile return at 4, Roll deflect at 5 (the order may change for balancing). A spared boss can give a passive too: the Bladekeeper's Metal coat. The mercy count also unlocks the Composure passives (below), the mirror of the brand ladder, so a run that spares everyone is not left without passives.
- **The dodge slot.** Separate from the 3 active slots: the player picks ONE dodge, the roll (default, the fallback), the Flash step or the Wraith dash. A dash replaces the roll on the same key, with no power key. It is picked in the hub with the rest of the loadout. See the dodge rows in the power table.
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

## The mercy gifts (the pair for each kill power)

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

## Composure: the mercy ladder (decided 2026-11-24)

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

## The talent trees (decided 2026-11-24)

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

## Open

- The Composure HP band (above 80 to 85% to start), and the size of Light step's two effects (the charge recharge rate and the roll's stamina discount).
- Brand-count unlocks so far: Shadow echo 1, Riposte 2, Requiem 3, Projectile return 4, Roll deflect 5 (the order may change for balancing). Brand 6 and Mercy 6 are the tier-6 choice nodes of the talent trees.
- The dash numbers: how many charges and how fast they recharge for the Flash step, the Wraith dash's HP cost per dash, and the Berserk discount on charges (all by playtest). Decided: a dash replaces the roll on the same key, the roll stays as the fallback, and the dodge has its own slot.
- Blood pact: plain stamina refill first, the cooldown-reset version if it is too weak.
- **The power key.** Decided 2026-11-24: Q stays the lunge, a basic player skill outside the loadout (the hub lectern says "Q to lunge"; it costs 50 stamina). Powers use R (decided 2026-11-24; E is the mercy hold).
- The hub interactable for switching powers (an altar, or the glossary), and whether a tap of E or R cycles powers in a fight.
- Whether the Samurai's tornado can be returned, and how the laser reacts.
- Where the ending triggers: the user will add an end boss at some point (which also gives Kindred its fights). Still open: whether the Shade is that end boss on the bad path, and the ending thresholds.
- The `PerfectFraction` value and the per-brand cost: both by playtest.
- Whether the Petal step counts alongside the kill or spare outcome (assumed yes).
- The Cat: petting counts as neither a brand nor a mercy, so a player who pets the Cat tops out at 5 mercies and misses Mercy 6. Intended as a dilemma (the Cat's ability against the capstone), or should the pet count as a mercy for the tree?
- The Cat's hidden ability (the pet ending) is still TBA.
- Soul Rush: keep as a Brand 6 option or cut.
- The Shade's fight design (see the trees section) and where the tree's art and interactable go.

## Build plan

Nothing here is started. Each phase is its own feature branch off `development`, ends with `node tools/test/run.js` passing and a behaviour test for what it added (`tools/test/behaviour.test.js`), and a playtest checkpoint, because the checks do not run the engine. GDevelop must be closed for every project-file edit. Generated content (the hub) is changed in `tools/hub/`, not by hand. Phases 1 to 3 are the foundation: everything else depends on them. After that the order is by cost, cheap first.

### Phase 1: record the outcomes and count N (BUILT 2026-11-24, branch `brand-counts`; no gameplay change)

- N is the number of gates in `tools/hub/hub.js` that have a scene (the Fire Knight gate has none yet, so N is 5 until that fight exists; everything is a ratio, so the change is harmless). Expose N as one global variable the hub fills in.
- Derive the counts from the flags the hub already saves in `BossesBeaten`: Mercy is the number of `<scene>_Spared` flags; Brand is the bosses beaten without one. The Cat's pet ending (`Cat_Friend`) counts as neither. Verified: a win sets `BossesBeaten.<scene>` (for example `Samurai_Fight`), mercy adds `<scene>_Spared`, and the hub copies every true flag into its saved `progress.beaten`.
- Tests: the counts from a set of flags (kills, spares, the Cat's three outcomes), N from a changed gate list.
- **As built:** the hub's "Hub gates." script (generated by `tools/hub/build.js`) works the counts out every frame from the saved progress and writes the globals `BrandCount`, `MercyCount` and `BossCount` (declared in `Soul Rush.json`). `BossCount` is every gate in `tools/hub/hub.js` with a scene that is not `locked`. A gate's `neutral` property (the Cat's is `Cat_Friend`) makes a win count as neither. A `_Spared` flag without the win counts for nothing. A test in `behaviour.test.js` covers all of it, including the Start over wipe.

### Phase 2: the HP budget and the curse change (BUILT 2026-11-24, branch `hp-budget`, not yet playtested)

- A deathblow clears ONE curse stack: change the `Curse removal` event in Combat_Shared (it clears all of them today), and update the Desperation tests, the left-Alt debug key (`DEBUG_KEYS.md`) and the numbers in `docs/balance.md` (its test keeps the ratios).
- Apply the Brand HP loss at scene start: `BrandBudget / N` per brand, `BrandBudget` 60%, floor 10%. A curse stack that would breach the floor is fatal (the run ends: for now, the existing death path to the hub, a proper bad ending comes in phase 8).
- Sacrificed HP: a direct HP removal that skips the rally record (rally must not win it back; the deathblow refill still restores it). Check rally healing is a % of max.
- The Cat's +1 life (a sixth life): the lives count comes from a saved value.
- Tests: the budget table at N = 6 and at another N, the floor and the breaching stack, the deathblow clearing exactly one, sacrificed HP not recoverable by rally.
- **As built** (`node tools/budget/build.js` writes it, safe to rerun): the Player gets the variables `BrandBudget` (60), `HpFloorPercent` (10), `BrandFraction`, `SacrificeHP` and `BreachDeath`. A script event in Combat_Shared (`tools/budget/budget.js`) runs on the first frame of a fight: max HP and HP become the base minus `BrandBudget / N` per brand (never below the floor), and the Cat's mercy adds a life (`BonusLives`, a global the hub fills in from the gate's `mercyLives`). The tutorial is exempt. The life-lost event takes max HP as `max(floor, round(base * (1 - BrandFraction - stacks * CursePercent / 100)))`, and a new sub-event makes a stack that would breach the floor fatal (Lives set to 0, `BreachDeath` true: the death plays as on the last life; the real bad ending is phase 8). The deathblow clears one stack and keeps the brands' loss. A new event takes `Player.SacrificeHP` off Health at once, never below 1, without touching the rally pool (a power sets `SacrificeHP`; none does yet). The left-Alt debug key uses the same formula. The black bar on the HP bar shows the brands' loss too for now (it has no look of its own yet). Tests: `behaviour.test.js` (the budget script, the curse events against the design's table at N = 6, sacrificed HP, the hub's `BonusLives`).

### Phase 3: perfect deflect (BUILT 2026-11-24, branch `perfect-deflect`, not yet playtested)

- A `PerfectFraction` constant (about the first third of the base window), the Desperation extension never counting, a placeholder mark above the player when it fires, and a debug toggle. Everything that reads it (Riposte, Respite, Steady hand, Projectile return) comes later.
- Tests: a deflect at the start of the window is perfect, one in the Desperation extension is not.
- **As built** (`node tools/perfect/build.js`, safe to rerun): the Player gets `PerfectFraction` (0.33 of the 0.25 s base window, so about 0.08 s), `PerfectCount` and `PerfectForced`. Each deflect event (Combat_Shared's melee and ranged one, and the Gunslinger's bullet one) has two child events that add one to `PerfectCount` when the deflect landed within `DeflectWindow * PerfectFraction`, or, with `PerfectForced` on (debug key P), whenever it did not. Desperation's extra window is never inside it. **How a power reads it:** keep your own "seen" number and compare it with `PerfectCount` (a count above it is a new perfect deflect). A counter was chosen over a flag because the Gunslinger's deflect runs in the scene's events and the others in Combat_Shared, so no clearing point is safe for every power. A script in Combat_Shared (`tools/perfect/perfect.js`) shows a gold PERFECT above the player as the placeholder mark, and is the model for a power's reader.

### Phase 4: the loadout and the dodge slot (STARTED 2026-11-24, branch `loadout`: the data layer and the hub switch screen are built; R, the powers and the dodge are not)

- Data first: three active slots and one dodge slot, saved with the hub's progress (local storage), plus the passives' saved counters (Metal coat's two uses per playthrough).
- The hub interactable for switching (an altar, or the glossary), with a plain list as a placeholder; the tree art comes in phase 7. R (not Q, which stays the lunge) activates the equipped power.
- The dodge: the roll stays the default and the fallback. A dash replaces it on the same key; dash charges (2 to 3, recharging) for the Flash step; the Wraith dash pays sacrificed HP.
- Tests: switching saves and loads; the dodge fallback to the roll; the dash charges recharge.
- **Built so far (slice 1, the data layer):** `tools/powers/powers.js` lists every power (id, kind, source, and whether it is built) and holds three plain functions: `owned` (what the player owns from the saved progress and the brand and mercy counts), `tidy` (a loadout with anything unowned, unbuilt or of the wrong kind taken out) and `equip` (one power per slot, passives never in a slot, the dodge falls back to the roll). The hub's gates script (`tools/hub/build.js` copies those functions in as text) keeps `loadout` in the saved progress and writes the globals `PowersOwned`, `LoadoutSlot1` to `LoadoutSlot3` and `LoadoutDodge` every frame. No power is built as an active yet, so nothing can be equipped. **Slice 3, the hub switch screen (built, not yet played):** a `Hub_Altar` in the hall (the relic plinth's art as a placeholder, `ALTAR = HEARTH + 260` in `tools/hub/hub.js`); F opens a dark panel (`tools/loadout/hubmenu.js`, spliced into the hub's interactions script by `tools/hub/build.js`) with the three power slots and the dodge slot. W/S pick a row, A/D change it, F or Esc close. A row offers nothing (or the roll) and the built, owned powers of its kind (`tools/loadout/menu.js`); one power sits in one slot only; every change is saved at once in the hub's progress. The panel also lists the passives that are on and the owned powers that are not built yet. With no active built there is nothing to choose yet, so the screen shows "nothing to choose yet" on every row. **Next slices:** (2) R and the three slots, with Blood pact as the first real active (the simplest: pay sacrificed HP, refill stamina); (3) the hub screen for switching (an altar with art, or a placeholder list); (4) the dodge slot with the Flash step and the Wraith dash.

### Phase 5: the passives (STARTED 2026-11-24: Poise, Respite and Steady hand are built, branch `hp-budget`, not yet playtested)

Easiest first, and the ones that need no boss work: Poise, Light step and Grace (they need the HP band: above about 80 to 85% of max), Steady hand and Respite (need perfect deflect), Riposte, Metal coat, then Shadow echo (needs its own look), Projectile return and Roll deflect (they touch every boss's attacks; the Samurai's tornado and the laser are open questions). Tests: one per passive, plus that none of them adds boss posture.
- **Built so far** (`node tools/composure/build.js`, after the budget and perfect builds; safe to rerun): a script in Combat_Shared (`tools/composure/composure.js`) works out, every frame, whether the player is above `ComposureBand` (0.8) of max HP, and from the global `MercyCount` sets `StaminaRegenNow` (Poise, mercy 1: +50%, read by the stamina regen event), `PerfectFractionNow` (Steady hand, mercy 3: +0.12 of the base window, read by the perfect deflect events) and refunds `RespiteStamina` (15) on a new perfect deflect (Respite, mercy 2; the dash charge comes with the dash). Not in the tutorial. Debug keys O and B step the mercy and brand counts so these can be tried without beating the bosses, and the Debug_UI text shows "Brand: x / N | Mercy: y / N" and "Perfect: n (forced) | Composure: on" (`tools/debugcounts/`, which also holds the O and B keys: the counts are global variables, which this project's events do not use, so those keys are script). Light step and Grace wait for the dodge (phase 4) and a central place for the player's posture hits.

### Phase 6: the boss powers and the actives

Cheap to expensive: Blood pact, Requiem, Poison stab, Cinder blade, the Flash step and the Wraith dash (with phase 4), Bloom, Pistol parry, the Fire Knight's flame attack (when that fight exists), Berserk, Decoy (each boss script must learn to aim at it: see `AimX` and `docs/echo-plan.md`), and the Petal step (the Samurai's bonus: the `no hit in the fight` or `every Thousand Cuts deflected` check). Each one is a behaviour test and a debug key for testing it.

### Phase 7: the talent trees and the capstones

The tree screen (shadowy and warm art, one interactable), respec of the choice nodes, then the capstones: Halo, Reap (spend a life, never breach the floor, never clear a stack) and Soul Rush if it stays. Kindred waits for the end boss (phase 9) because it needs fights to be useful.

### Phase 8: the world and the endings

The darkening with killed/N, the warm tones with the mercy count, the spared bosses as hub figures (the gates stay closed), the ending thresholds and the three endings (good, bad, mixed), and the run-ending bad ending when a curse stack breaches the floor.

### Phase 9: the Shade, the end boss and Kindred

The Shade: a boss that borrows the player's equipped powers as telegraphed attacks, forced at brand 6, with the tree's capstone chosen just before it. The end boss and Kindred (a shuffled bag of spared bosses, 5 perfect deflects per use, up to 3 uses a fight, about 5% of the boss's current life HP, guaranteed). The Cat's pet ability, once it is defined.

### What a playtest should answer before phase 5

Is the Brand cost (10% at N = 6) felt, is the HP band right, is the perfect-deflect window the right size, is a spare really not the better route. These numbers are variables and are all open (see the open list above).

