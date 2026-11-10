# Hub tools

`HUB_Area` is a ruined cathedral nave seen past mossy cavern rock. It uses a generated cathedral backdrop and two packs in `assets (raw)/claude` (git-ignored):
- **Dungeon Ruins Tileset**: the tile floor, ceiling and steps (`Ruins_Tiles`, a Simple Tilemap), plus recoloured props (pillars, vines, chains, swords, bushes).
- **SHADOW Series Pixel Tile Map Asset Pack 3**: the hanging ceiling rocks, the floating jump-through ledges and the four gate frames. This pack has no tile grid, so its pieces are cut out as sprites.

The files:
- `cathedral.js`: draws the endless cathedral backdrop as seamless pixel-art strips: `cathedral_far.png` (the nave wall: lancet windows, ribbed pillars, candles) and `cathedral_mid.png` (the arcade: pointed arches, columns, banners). Run `node tools/hub/cathedral.js`.
- `hub.js`: the layout (every piece, position, scale, layer and animation), the tile pieces, and the gates (label, scene, colour). Edit this to move things.
- `crops.ps1`: rebuilds the other images in `assets/backgrounds/hub` and the tinted atlas `assets/tilemaps/ruins/ruins_hub.png` from the raw packs. Run `powershell -File tools/hub/crops.ps1`.
- `build.js`: writes `hub.js` into `layouts/hub_area.json` and registers the images. Close GDevelop first, then run `node tools/hub/build.js`. It's safe to run again: it replaces what it added last time (`Hub_*` objects, the `Ruins_Tiles` instances, the `Far` layer and its events) and leaves the rest of the scene alone.

In the game:
- **Layers.** `Far` (the nave wall) scrolls at 0.25 of the camera and `Mid` (the arcade) at 0.55. `Background` holds everything else, and the player is on the base layer.
- **Endless backdrop.** `Hub_Cathedral_Far` and `Hub_Cathedral_Mid` are Tiled Sprites, so you can stretch them in the editor as far as you like. In the game, the camera event also moves and sizes them to cover the screen, so they never run out, however wide the hub gets.
- **Spawn.** The player starts in the middle of the hub (`spawn` in `hub.js`). The build moves `Player` and `Player_Hitbox` there.
- **Gates.** Each `Hub_Gate_Glow` instance has `Scene`, `Label` and `Color` variables. Standing in front of one shows `[W] Label`, and pressing W loads the scene.
- **Ambience.** It reuses `tools/arenas/ambient.js`: the moon pulses, fog drifts, and fireflies wander.

Tiles you paint by hand in the editor stay as long as you don't run `build.js` again, which rebuilds every `Ruins_Tiles` instance from `hub.js`.
