# Balance pass 1 (2026-11-14): hard but fair

First pass, made by reading the numbers and the combat rules, **not by playtesting**. Every number below is a variable, so a playtest can adjust it without touching events. The behaviour test "balance" keeps the ratios honest (and fails if a placeholder like 1 or 80 comes back).

## How combat works (the facts the numbers rest on)

- **Player:** 100 HP, 100 posture, 5 lives. Each death costs a curse stack (15% max HP, so lives have 100, 85, 70, 55, 40 HP); the deathblow lifts the curse. Hitting an enemy gives back 25% of the damage taken in the last 2.5 s (rally).
- **Posture on the player:** every enemy hit adds the boss's `PostureDamage`; it recovers 5 per second after 1.5 s without a hit. At 100 the player is stunned for 2 s (can be hit, cannot act).
- **Boss:** HP per life (3 lives Samurai, 2 Leaf Ranger) and posture 80. A sword hit adds the player's `PostureDamage`, a deflected melee attack adds `DeflectPostureDamage`. Posture recovers 5 per second after 1.5 s. At 80 he is stunned for 2.5 s and the deathblow (F) takes a whole life.
- **Two routes to a life:** break the posture and deathblow (the intended route: it lifts the curse and heals), or chip the HP to 0.
- The player's `AttackDamage` (20) is shared with the Gunslinger, whose HP (600 per instance) is tuned around it, so it was left alone. The boss HP was scaled instead.

## What changed

| Where | Variable | Before | After | Why |
| --- | --- | --- | --- | --- |
| Player (all fights) | `PostureDamage` (sword hit on a boss's posture) | 80 | 10 | 80 broke the 80-posture boss in one hit (a test value). Now 8 hits. |
| Player (all fights) | `DeflectPostureDamage` | 20 | 14 | A deflected melee attack is worth a bit more than a hit, about 6 deflects. Mixing hits and deflects breaks him in about 6 to 7 actions. |
| Samurai | `MaxHealth` / `Health` per life | 100 | 200 | With 20 damage a hit, 100 HP was 5 hits, faster than breaking posture. Now 10 hits, so the posture break and deathblow is the fast route. |
| Samurai | `AttackDamage` (combo, crossing, dash strike, wall slash, echo swings) | 1 | 14 | 1 was a placeholder. 7 hits drain a fresh life, 3 on the last cursed one. |
| Samurai | `PostureDamage` (on the player, per hit) | 50 | 25 | 50 stunned the player in 2 hits, then a stunned player was a dead one. Now 4 hits. |
| Samurai | `PetalDamage` | 15 | 10 | Phase 3 has 10 petals in waves. |
| Samurai | `GrabDamage` | 35 | 30 | The grab cannot be deflected, so it should not cost a third of a life. |
| Samurai | `IntermissionCutDamage` | 25 | 20 | Matches the Judgement Cut. |
| Leaf Ranger | `MaxHealth` / `Health` / `LastHealth` per life | 100 | 200 | Same reason as the Samurai. |
| Leaf Ranger | `PostureDamage` (on the player, per hit) | 30 | 20 | 30 stunned the player in 4 arrows. Now 5 hits. |

Unchanged on purpose: the Samurai's `CutDamage` 20, `TornadoDamage` 20, `UltDamage` 5 (8 slashes), `SweepCutDamage` 15, the Leaf Ranger's damage values (6 to 30, already a sensible spread), the player's HP, lives, curse, stamina, roll and deflect window, and the tutorial's own numbers.

## Not touched

- **Gunslinger:** piperal's fight, tuned around its own numbers (bullets 10, posture parries 150/75/450). Say if you want it included.
- **Tutorial Samurai:** it keeps `AttackDamage` 1 and `PostureDamage` 50 as a gentle lesson. The player's new posture numbers do apply there, so the last part of the tutorial (breaking his posture) now takes more hits. Worth one playtest.

## Rough expectations (to check in play)

- Samurai: about 8 hits or 6 deflects to break one life. With his dodges (10, 20 and 40%) and the waits after his echoes, a good player needs roughly 2 to 3 minutes for the fight and loses 1 to 3 lives.
- A mistake costs 14 HP and 25 posture; two quick mistakes cost 28 HP and 50 posture; four hits in a row (about 8 seconds without a recovery) stun the player, which is the real danger.

## What to look at when playtesting

1. Does the first life feel winnable by hit and deflect, with the posture bar filling in about 6 to 8 actions?
2. Is the last life (40 HP after four deaths) three hits from death? If that feels unfair, lower `AttackDamage` (not the posture numbers).
3. Do the fights run too long? If so lower the boss `MaxHealth` back toward 150 first.
4. In phase 3, do the echoes plus his own attacks stack too much damage? The echo swings use the same 14.
5. Leaf Ranger: are 5 arrows (20 posture each) a fair way to get stunned?

All of these live as variables on `Samurai_NPC`, `Leaf_Ranger` (in their scene files) and `Player` (in `Soul Rush.json`), so they can also be changed in the GDevelop editor.

## Pass 2 (2026-11-14): your tuning, attack stamina, posture decay

**Your tuning, kept:** the player's `PostureDamage` (a sword hit on a boss's posture) is 5 and `AttackDamage` is 15. So posture mostly comes from deflects (14 each, about 6 to break) and a sword hit is a chip (16 hits to break by hits alone). Note `AttackDamage` is shared with the Gunslinger, whose 600 HP is now 40 hits.

**Attacks cost stamina:** `AttackStaminaCost` on the Player, 15 per swing, spent when the swing starts (each hit of the combo, like a roll). A fresh press, and a saved press that continues the combo, both need 15. A saved press the stamina cannot pay for is dropped (like a saved roll), so it cannot fire seconds later. With 100 stamina that is 6 swings, then 20 a second comes back after 1.2 s idle. Rolls (30) and lunges (50) share the pool, so attacking costs rolls.

**Posture decay is now per boss** (in `Combat_Shared`, the shared posture system, with the numbers on each boss). Three variables on the boss: `PostureRegenDelay` (seconds after the last hit before decay starts), `PostureRegenFull` and `PostureRegenEmpty` (decay per second at full HP and at 0 HP, scaled linearly between). The old behaviour is 1.5 / 5 / 5, which the Gunslinger and the tutorial Samurai keep.

| Boss | Delay | Full HP | 0 HP | Meaning |
| --- | --- | --- | --- | --- |
| Samurai | 1.5 s | 6 per s | 1 per s | The higher his HP the faster his posture goes down: healthy he shrugs off 6 a second once you stop, near death only 1. Pressure pays more as he weakens. |
| Leaf Ranger | 0 s | 1.5 per s | 1.5 per s | Always going down, slowly, even while he is being hit, so a few hits spread over a long chase still add up (a hit is 5 and a deflect 14, he loses 1.5 a second). |

Leaf Ranger check: with decay 1.5 a second you need on average a hit every 3.3 seconds to make progress, and a stab deflect (14) is worth about 9 seconds of decay. If he is still out of reach, lower `PostureRegenFull` and `PostureRegenEmpty` on `Leaf_Ranger` (or lower his `MaxPosture`).

## The Cat and the Bladekeeper (2026-11-15)

Two new fights (`tools/bosses`), set by the same rules as above and **not playtested**. The numbers are variables on `Cat` and `Bladekeeper` in their scenes.

| | Cat | Bladekeeper |
| --- | --- | --- |
| Lives / HP per life | 3 / 120 | 2 / 200 |
| `MaxPosture` | 70 (5 deflects) | 80 (6 deflects) |
| Posture decay | after 1.2 s, 5 a second at full HP down to 2 at 0 HP | after 1 s, 3 a second down to 1.5 |
| `PostureDamage` on the player | 20 (5 hits to stun) | 20 |
| Stun | 3 s | 2.5 s |
| Hit damage | swipe 10, claw flurry 8 (x3), dash 12, pounce 14, burrow 14, maul 22 | slash 12, finisher 18, knife 12, dive 16, trap 18, garden 25, counter 14 |

Why: the Cat has less HP per life but three lives, and attacks in short strings with a readable wind-up, so it is a fast, reading-heavy fight; its three phases add the dig, the claw flurry and the maul. The Bladekeeper is the Leaf Ranger's shape (2 lives, 200 HP) but fights close: combos, a guard that punishes mashing, and in life 2 the traps and the blade garden. A test keeps their ratios inside the same bounds as the older bosses (the player breaks in 4 to 6 hits, a boss in 4 to 8 deflects, chipping a life takes longer than breaking posture, no hit under 8 or over 35).

## Phase 3 dodges are hit-based (2026-11-14)

In phase 3 the Samurai no longer rolls a 40% chance. He takes 2 or 3 landed sword hits (`DodgeHitsNeeded`, rolled again after every dodge from `DodgeHitsMin` 2 to `DodgeHitsMax` 3) and then dodges the next swing. Only `DodgeDelayP3` (1 s) separates two dodges (phases 1 and 2 keep `DodgeDelayP12`, 4 s, and their 10% and 20% chances). Hits that land are counted when they land (`JustHitByPlayer`), so a dodged swing does not count and a lunge hit does. `DodgeChanceP3` is the chance of a random dodge before the hits are reached (set to 25 in the editor on 2026-11-14; it was 0), so he can also dodge on a swing earlier than the 2 to 3 hits. The first dodge of the fight is still the guaranteed opening one.
