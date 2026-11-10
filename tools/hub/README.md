# Hub tools

`HUB_Area` is a ruined hall in a mossy cavern. It's built from two packs in `assets (raw)/claude` (git-ignored):
- **Dungeon Ruins Tileset**: the tile floor, ceiling and steps (`Ruins_Tiles`, a Simple Tilemap), plus recoloured silhouettes (moon, mountains, pillars, vines, props).
- **SHADOW Series Pixel Tile Map Asset Pack 3**: the hanging ceiling rocks, the floating jump-through ledges and the four gate frames. This pack has no tile grid, so its pieces are cut out as sprites.

The files:
- `hub.js`: the layout (every piece, position, scale, layer and animation), the tile pieces, and the gates (label, scene, colour). Edit this to move things.
- `crops.ps1`: rebuilds `assets/backgrounds/hub/*` and the tinted atlas `assets/tilemaps/ruins/ruins_hub.png` from the raw packs. Run `powershell -File tools/hub/crops.ps1`.
- `build.js`: writes `hub.js` into `layouts/hub_area.json` and registers the images. Close GDevelop first, then run `node tools/hub/build.js`. It's safe to run again: it replaces what it added last time (`Hub_*` objects, the `Ruins_Tiles` instances, the `Far` layer and its events) and leaves the rest of the scene alone.

In the game:
- **Layers.** `Far` (sky, moon, mountains) scrolls at 0.3 of the camera, `Background` holds everything else, and the player is on the base layer.
- **Gates.** Each `Hub_Gate_Glow` instance has `Scene`, `Label` and `Color` variables. Standing in front of one shows `[W] Label`, and pressing W loads the scene.
- **Ambience.** It reuses `tools/arenas/ambient.js`: the moon pulses, fog drifts, and fireflies wander.

Tiles you paint by hand in the editor stay as long as you don't run `build.js` again, which rebuilds every `Ruins_Tiles` instance from `hub.js`.
