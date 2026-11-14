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
