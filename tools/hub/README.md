# Hub tools

`HUB_Area` is a candlelit cathedral nave. It uses a generated cathedral backdrop and light sources, plus the **Dungeon Ruins Tileset** in `assets (raw)/claude` (git-ignored) for the tile floor, ceiling and steps (`Ruins_Tiles`, a Simple Tilemap) and a recoloured chain and vine. (The SHADOW Series rocks, ledges and gate frames were removed in the editor on 2026-11-11.)

The files:
- `cathedral.js`: draws the endless cathedral backdrop as seamless pixel-art strips: `cathedral_far.png` (the nave wall: lancet windows, ribbed pillars, candles) and `cathedral_mid.png` (the arcade: pointed arches, columns, banners). Run `node tools/hub/cathedral.js`.
- `gates.ps1`: copies the boss gate frames from `assets (raw)/gates/all_gates_pack` (git-ignored; read its `HANDOFF.md`) into `assets/backgrounds/hub/gates`. It splits the torii's active loop into a back part (portal, gate, lanterns) and a front part (spirits, petals) so the crow goes between them, and checks that the two rebuild the pack's frames exactly. Run `powershell -File tools/hub/gates.ps1`.
- `lights.js`: draws the light sources: the brazier, the hearth, the candelabra, the chandelier, 4-frame flame animations, and a smooth glow texture. Run `node tools/hub/lights.js`.
- `pixel.js`: the pixel-art helpers shared by `cathedral.js` and `lights.js`.
- `hub.js`: the layout (every piece, position, scale, layer and animation), the tile pieces, and the gates (label, scene, colour). Edit this to move things.
- `crops.ps1`: rebuilds the other images in `assets/backgrounds/hub` and the tinted atlas `assets/tilemaps/ruins/ruins_hub.png` from the raw packs. Run `powershell -File tools/hub/crops.ps1`.
- `build.js`: writes `hub.js` into `layouts/hub_area.json` and registers the images. Close GDevelop first, then run `node tools/hub/build.js`. It's safe to run again: it replaces what it added last time (`Hub_*` objects, the `Far` and `Mid` layers and its events), puts the player back at the spawn point, and leaves the rest of the scene alone.

In the game:
- **Layers.** `Far` (the nave wall) scrolls at 0.25 of the camera and `Mid` (the arcade) at 0.55. `Background` holds everything else, and the player is on the base layer.
- **Endless backdrop.** `Hub_Cathedral_Far` and `Hub_Cathedral_Mid` are Tiled Sprites, so you can stretch them in the editor as far as you like. In the game, the camera event also moves and sizes them to cover the screen, so they never run out, however wide the hub gets.
- **Spawn.** The player starts in the middle of the hub (`spawn` in `hub.js`). The build moves `Player` and `Player_Hitbox` there.
- **Gates.** From left to right: Training Grounds (a glow), the Samurai (the torii), the Leaf Ranger (the eclipse gate), the Fire Knight (the infernal gate, sealed until its scene exists) and the Gunslinger (a glow). Every gate instance has `Scene`, `Label` and `State` variables; `State` `locked` shows the inactive art and seals the gate. Standing in front of a gate shows `[W] Label`, and W loads the scene. When a boss falls, Combat_Shared sets `BossesBeaten.<scene>`, and its gate shows its completed art, until the game is closed (there's no save system yet).
- **The crow.** Each torii gets a crow at runtime, drawn between the torii's back and front: it appears as dust, perches, hops along the beam (following its curve), and vanishes again, with the pack's suggested timings.
- **Lights.** The hearth (the middle of the hub), braziers flanking the glow gates, coloured light from the gate art (off while sealed, changing when completed), candelabras and chandeliers. Each light object listed with a `light` entry in `hub.js` gets additive, flickering glows at scene start, and the fires throw embers. Move or copy a light in the editor and its glow comes with it.
- **Ambience.** It reuses `tools/arenas/ambient.js`: fog drifts and dust motes float in the candlelight.

`Ruins_Tiles` are yours: once the scene has any, `build.js` leaves them exactly as they are, so paint and resize them freely. The tile pieces in `hub.js` are only used for an empty scene.

`Hub_*` objects are different: `build.js` rebuilds them from `hub.js`. If you delete or move one in the editor, change `hub.js` to match (or ask Claude to sync it), or the next build puts it back.
