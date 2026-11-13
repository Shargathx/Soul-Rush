# Debug keys

All of these are for development. One switch turns every one of them off for the demo or a release: `DEBUG_KEYS` at the top of
`Combat_Shared` (the first script event). `true` = they work, `false` = they do nothing. A test checks that the switch works.

Keys are named as GDevelop names them. "Numpad" means the number pad (Num Lock on). The top-row `0` is not the number pad's `0`.

## Every fight (Combat_Shared)

| Key | What it does |
| --- | --- |
| F5 | Restart the current scene |
| F10 | Show or hide the player's attack hitbox (stays on across scenes until pressed again) |
| Left Alt (GDevelop has no numpad-decimal key) | Toggle Desperation: put the player on his last life with every curse stack (4 of 5 lives lost, 15% max HP each), or press again to get his old lives, curse and HP back. Use it to test the wider deflect window, the icon, the blade glow. While on, the next hit kills |

## Samurai fight and Tutorial (Samurai_Boss)

| Key | What it does |
| --- | --- |
| F2 | Cast a Judgement Cut on the player right now (same cut as his Quickdraw) |
| Shift + F2 | Cancel what he is doing and start a triple Quickdraw |
| F3 | Draw every bounding box (blue) and hitbox (red), including hidden ones |
| F6 | Cancel what he is doing and cast the petals |
| F7 | Cancel what he is doing and cast the tornado |
| F8 | Cancel what he is doing and start the grab |
| F9 | Put him on his last life just under 75% HP, which starts the Thousand Cuts ultimate. Press again to repeat |
| 0 (top row) | Toggle him inactive (stands idle, can still be hit, staggered and posture-broken) |

Phase 3 work (fight scene only):

| Key | What it does |
| --- | --- |
| Insert | Jump to phase 2 (second life, full HP, aggressive) |
| PageUp | Jump to phase 3 (last life, full HP, mirror skills and triple cuts on) |
| Delete | He loses a life right now, which starts the intermission: the three sets of cuts into phase 2, and into phase 3 the ENEMY DEFEATED card, then he is back in the fight |
| Home | Mirror Judgement Cut: short dash, the shadow behind him, paired cuts left and right of you |
| End | Mirror petal waves: 2, then 3, then 5 petals |
| Numpad 1 | Mirror tornado (no dash after it) |
| Numpad 2 | Mirror tornado with the dash strike after it, both dashing through you |
| PageDown | A melee window right now: he walks in and swings, no skills, for one skill delay |
| Num1 (top row) | He flash-steps away right now with the old dash speeds (normal animation speed; the mirror dash at 520 px/s for 0.3 s, until Num2) |
| Num2 (top row) | He flash-steps away right now with the faster dash (the default): animation 20% faster, mirror dash at 624 px/s for 0.25 s |
| Num3 (top row) | The front, behind, back attack right now (he swings, steps behind and swings, steps back and swings; no images) |
| Num4 (top row) | The same with the images attacking too (the phase 3 version) |
| Num5 (top row) | The single crossing: he swings, steps to the far side, the image swings, then he swings from the other side |

Most of these are ignored while he is stunned, dead, in an intermission, in the ultimate or in a grab.

## Leaf Ranger fight (Leaf_Ranger_Boss)

| Key | What it does |
| --- | --- |
| F3 | Draw every bounding box (blue) and hitbox (red), including hidden ones |
| F4 | Send him up to the sniper perch (from Neutral, either phase) |
| Numpad 1 | Normal shot |
| Numpad 2 | Entangle shot |
| Numpad 3 | Poison shot |
| Numpad 4 | Delayed shot |
| Numpad 5 | Double shot |
| Numpad 6 | Stab |
| Numpad 7 | Arrow rain |
| Numpad 8 | Air volley |
| Numpad 9 | Beam |
| Numpad / | Thorn wall, ignoring its cooldown |
| Numpad * | Overgrowth now, whatever his HP (counts as his one Overgrowth) |
| Numpad - | Escape slide with its snare trail, ignoring distance |
| Numpad + | Leap over the player |
| Numpad Enter | Bramble Grasp |
| Numpad Shift + Enter | A lingering poison cloud at the player's feet |
| Numpad 0 | Toggle him fully idle (cancels what he is doing on the ground), and back |

The air triple-poison and triple-entangle combos (codes Q and W) have no key yet: they come up in his phase 2 rotation.

## Where the keys are defined

The keys are in the event sheets, each under a comment that starts with "Debug": `externalEvents/combat_shared.json`,
`externalEvents/samurai_boss.json`, `externalEvents/leaf_ranger_boss.json`. When you add a key, put it behind the same switch
(the gate in `Combat_Shared` covers F2 to F10, every Numpad key, Num0, Home, End, Insert, Delete, PageUp and PageDown), add it to
the gate list in `tools/test/behaviour.test.js` if it is a new key name, and add it here and in the README table.
