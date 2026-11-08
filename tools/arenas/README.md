# Arena tools

Candidate arenas for the boss fights, built from the packs in `assets/claude`.

- `arenas.js`: every arena's layout (images, positions, scale, animation). Edit this to move things.
- `ambient.js`: the moving parts (drifting clouds and fog, bobbing rocks, pulsing light, lamp flicker, fireflies).
- `preview.html` + `serve.js`: browser preview with the floor, fighters and HUD. Run `node tools/arenas/serve.js`, then open http://127.0.0.1:8766/ (`?arena=Forest|Ruins|Graveyard`).
- `build.js`: gives `Leaf_Ranger_Fight` the Deep Forest backdrop and writes one fight-ready template scene per arena (`Template_Forest`, `Template_Ruins`, `Template_Graveyard`, in the Templates scene folder). Close GDevelop first, then run `node tools/arenas/build.js`. Safe to run again after editing `arenas.js`.
- `crops.ps1`: cuts the props out of the source sheets into `assets/arenas`.
