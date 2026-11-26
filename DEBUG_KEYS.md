# Debug keys

All of these are for development. One switch turns every one of them off for the demo or a release: `DEBUG_KEYS` at the top of
`Combat_Shared` (the first script event). `true` = they work, `false` = they do nothing. A test checks that the switch works.

Keys are named as GDevelop names them. "Numpad" means the number pad (Num Lock on). The top-row `0` is not the number pad's `0`.

## Every fight (Combat_Shared)

| Key                                           | What it does                                                                                                                                                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F5                                            | Restart the current scene                                                                                                                                                                                                                                                |
| F3 | Show or hide every bounding box (blue) and hitbox (red), hidden ones too |
| F10                                           | Show or hide the player's attack hitbox (stays on across scenes until pressed again)                                                                                                                                                                                     |
| L                                             | Toggle permanent Desperation: the deflect window is always at its maximum and every deflect that lands counts as a Desperation deflect (teal blade, icon pulse). Press again to turn it off. |
| P                                             | Toggle forced perfect deflects: while on, every deflect that lands counts as a perfect one (PERFECT mark above the player), whatever the timing, to test the powers that read it |
| O                                             | One more mercy for the passives: the global MercyCount goes up by one and wraps to 0 after every boss, to test the Composure passives without beating the bosses. Use it in a fight: the hub works the real count out again every frame, so it does nothing there |
| B                                             | One more brand: the global BrandCount goes up by one and wraps to 0 after every boss, for the brand passives. The brands' HP loss is applied when a fight starts, so this does not change max HP |
| X | Put the next built active in power slot 1 for this fight: Blood pact, Requiem, Poison stab, Bloom, Berserk, Petal step, Petal counter, then round again (the hub sets the real loadout again on the next visit). R uses it |
| C                                             | Cycle the dodge for this fight: roll, Flash step, Wraith dash (in the hub too, where the choice is kept until you change the loadout at the altar). The dash and its charges show bottom left |
| U | Toggle UNLIMITED actives: Requiem can be used as often as you like and on a boss at any HP, Bloom can be planted at full HP, and no power has a cooldown (Poison stab, Blood pact, Bloom, Berserk, Petal step, Petal counter; Berserk still costs HP and still cannot be ended early). Range and vulnerability still count. A message shows bottom left |
| Y | Own Metal coat for this fight and give one use back (the saved count of spent uses goes down by one, never below 0), to try it without sparing the Bladekeeper. The steel shield with its pips shows right of the HP bar while the coat is ready |
| Left Alt (GDevelop has no numpad-decimal key) | Toggle Desperation: put the player on his last life with every curse stack (4 of 5 lives lost, 15% max HP each), or press again to get his old lives, curse and HP back. Use it to test the wider deflect window, the icon, the blade glow. While on, the next hit kills |

## The hub (tools/hub)

| Key | What it does |
| --- | --- |
| G | Open every gate that has a scene (each one awake, as if awakened with F), without touching the saved progress. Press again to undo. The locked Fire Knight gate stays locked |

## The debug text

The `Debug_UI` text object (top left in most scenes; the Samurai's event fills it with his state) also shows two lines after the scene's own text, `Brand: x / N | Mercy: y / N` and `Perfect: n (forced) | Composure: on`, in every scene that has the object (`tools/debugcounts/`). With `DEBUG_KEYS` off the text is hidden.

## Mercy (every fight that has one: Samurai, Gunslinger, Bladekeeper, Leaf Ranger; tools/mercy/mercy.js)

| Key | What it does                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M   | Spare the boss right now, from any state: it goes on its last life and into its kneel, the player is brought to 150 px if far, attacks in flight go, and the farewell plays (then the fade to the hub). Marks the boss as spared like the real thing. |

## The bosses: one numpad layout

The same keys in all four boss fights (Num Lock on). Shift with a numpad digit is not used: Windows turns it into an arrow or Home key.

| Key | What it does |
| --- | --- |
| Numpad 0 | **Idle** on or off. While idle the boss stands (it can still be hit, staggered and posture-broken) and makes no move of its own; a move key does that ONE move, then it goes back to idle |
| Numpad 1 to 9 | The boss's moves on the current page (tables below). Each starts at once |
| Numpad Enter | Page 1 or 2 of the moves (Samurai and Leaf Ranger, who have more than nine). The top right corner says which page is on. Every fight starts on page 1 |
| Numpad + | Dodge (the Leaf Ranger's is his escape slide) |
| Numpad - | Take a life: the boss's HP goes to 0, so its own life-loss logic runs (the next life, or on the last one its kneel or death). Not while it cannot be hurt |
| F3 | Hitboxes (see above) |
| F5 | Restart the scene |

`*` and `/` on the numpad are free.

### Moves, page 1

| Key | Cat | Bladekeeper | Samurai | Leaf Ranger |
| --- | --- | --- | --- | --- |
| 1 | Swipe A (high, then diagonal claws) | Combo | Judgement Cut on you | Normal shot |
| 2 | Swipe B (the hind kick) | Knife throw | Triple Quickdraw | Entangle shot |
| 3 | Swipe C (crossed claws, then the spin) | Roll | Petals | Poison shot |
| 4 | Pounce (two in the last life) | Guard | Tornado | Delayed shot |
| 5 | Zoomies | Air strike | Grab | Double shot |
| 6 | Burrow | Trap | Dash strike | Stab |
| 7 | Claw flurry | Blade garden | Wall slash | Arrow rain |
| 8 | Maul | | Melee window (phase 2 on) | Air volley |
| 9 | Hiss feint | | Front, behind, back (no images) | Beam |

The Cat and the Bladekeeper have one page only.

### Moves, page 2 (Numpad Enter first)

| Key | Samurai (fight scene) | Leaf Ranger |
| --- | --- | --- |
| 1 | Mirror Judgement Cut | Thorn wall, ignoring its cooldown |
| 2 | Mirror petal waves (2, 3, then 5 petals) | Overgrowth now, whatever his HP (it counts as his one) |
| 3 | Mirror tornado (no dash after it) | Escape slide with its snare trail |
| 4 | Mirror tornado with the dash strike, both through you | Leap over you |
| 5 | Front, behind, back, with the images attacking too | Bramble Grasp |
| 6 | Single crossing | A lingering poison cloud at your feet |
| 7 | Double dodge, forced (second dash and image) | Up to the sniper perch (from Neutral or idle) |
| 8 | Next phase: one press, one phase (1 to 2, then 2 to 3) | Air triple poison |
| 9 | His last life in phase 3 just under 75% HP, which starts Thousand Cuts (repeatable) | Air triple entangle |

Most Samurai moves are ignored while he is stunned, dead, in an intermission, in the ultimate or in a grab. The tutorial has its own pruned Samurai sheet: only Numpad 0 (and the shared keys) there.

## Where the keys are defined

- The Samurai's and the Leaf Ranger's moves: their event sheets, each under a comment that starts with "Debug". `tools/debugkeys/build.js` moved them to this layout and holds the shared ones (Numpad Enter, F3, Numpad -) that it puts into `Combat_Shared`.
- The Cat's and the Bladekeeper's: `debugKeys` in `tools/bosses/cat.def.js` and `bladekeeper.def.js` (then `node tools/bosses/build.js`).

When you add a key, keep it behind the `DEBUG_KEYS` switch (the gate in `Combat_Shared` covers F2 to F10, every Numpad key, every Num0-Num9 key, left Alt, Add, Subtract, Multiply and Divide, Home, End, Insert, Delete, PageUp and PageDown, and the letters L, M, P, O, B, X, C, G, Y and U). **Never use a control key** (A, D, J, K, Q, W, S, E, R, F, Space, Escape): a test checks it. Add the key here and to the README table.
