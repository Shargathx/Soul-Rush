// HUB_Area layout: a ruined cathedral nave, seen past mossy cavern rock. Built from the Dungeon Ruins tileset (tile
// floor, ceiling, steps, recoloured props), the SHADOW Series rocks (hanging ceiling rocks, floating ledges, gates)
// and the generated cathedral backdrop (cathedral.js). Used by build.js. Other images come from crops.ps1.
// World: walls at x 0 and 4512, floor top at y 657, screen 1280x720.
// Layers: "Far" (the nave wall and its windows) and "Mid" (the arcade) scroll at their PARALLAX share of the camera;
// "Background" moves 1:1 (everything else).
// tiled: a Tiled Sprite that repeats its image sideways. Stretch it in the editor as far as you like; in the game the
// camera event also keeps it covering the screen, so it never runs out.
// Items are drawn in list order within a layer (first = furthest back). scale applies to both axes unless sx/sy.
// platform: the item is a jump-through ledge; mask is its standing band in image pixels [x0, y0, x1, y1].
// anim and alpha work as in tools/arenas (drift, bob, pulse, flicker).
(function (root) {
  const H = "assets/backgrounds/hub/";
  const FLOOR = 657;
  const PARALLAX = { Far: 0.25, Mid: 0.55 }; // Layers listed back to front.
  const xs = (y, list) => list.map(x => [x, y]);

  // The gates: SHADOW frames standing on the floor (384x334 at 2x), each with a tinted glow in its hole.
  // Walking into a glow and pressing W loads the scene.
  const GATE_W = 384, GATE_H = 334, GATE_SINK = 14;
  const gates = [
    { label: "Training Grounds", scene: "Tutorial_Level", color: [150, 190, 230], cx: 760 },
    { label: "The Samurai", scene: "Samurai_Fight", color: [235, 90, 125], cx: 1850 },
    { label: "The Leaf Ranger", scene: "Leaf_Ranger_Fight", color: [110, 215, 125], cx: 2950 },
    { label: "The Gunslinger", scene: "Gunslinger", color: [240, 170, 80], cx: 4000 }
  ];
  const gateY = FLOOR - GATE_H + GATE_SINK;
  // The glow sits in the frame's hole: 130x98 at offset (31, 30) in the 1x frame.
  const glowAt = gates.map(g => [g.cx - GATE_W / 2 + 62, gateY + 60]);

  // Light sources. Each gate is flanked by braziers; the hearth burns in the middle, where the player starts.
  const HEARTH = 2256;
  const BRAZIERS = gates.flatMap(g => [g.cx - 220, g.cx + 220]);
  const CANDELABRAS = [1305, 3405];
  const CHANDELIERS = [1305, HEARTH, 3405];

  const items = [
    // Cathedral backdrop: endless Tiled Sprites. width is the editor size; the game keeps them covering the view.
    { name: "Hub_Cathedral_Far", img: H + "cathedral_far.png", layer: "Far", tiled: true, at: [[-320, 0]], width: 2880 },
    { name: "Hub_Fog_Back", img: H + "fog.png", layer: "Far", sx: 6, sy: 2, alpha: 0.08, at: xs(560, [0, 800, 1600]), anim: { type: "drift", speed: 8, wrap: 2700 } },
    { name: "Hub_Cathedral_Mid", img: H + "cathedral_mid.png", layer: "Mid", tiled: true, at: [[-512, 0]], width: 4096 },

    // Background layer: back to front. (Rocks, ledges, gate frames, most vines and floor props were removed in
    // the editor on 2026-11-11: they didn't fit the cathedral.)
    { name: "Hub_Chain", img: H + "chain.png", scale: 4, at: [[1420, 150]] },
    { name: "Hub_Vine_B", img: H + "vine_b.png", scale: 4, at: [[1700, 130]] },
    { name: "Hub_Gate_Glow", img: H + "gate_glow.png", scale: 2, at: glowAt, gate: true },
    // Light sources (lights.js). Their images are saved at 2x already, so scale 1. light: glows the game adds at runtime, at an offset from each instance's
    // top-left corner (on screen pixels), so a light you move or copy in the editor brings its glow along.
    // Fires are listed before their bowls so the rim covers the flame's base.
    // r is the glow radius, strength its brightness (0-1), embers makes sparks rise from it.
    { name: "Hub_Chandelier", img: H + "chandelier.png", scale: 1, at: CHANDELIERS.map(x => [x - 60, 86]),
      light: [{ x: 60, y: 176, r: 210, color: [255, 190, 120], strength: 0.45 }] },
    { name: "Hub_Candelabra", img: H + "candelabra.png", scale: 1, at: CANDELABRAS.map(x => [x - 22, FLOOR - 150]),
      light: [{ x: 22, y: 10, r: 150, color: [255, 200, 130], strength: 0.5 }] },
    { name: "Hub_Brazier_Fire", frames: [1, 2, 3, 4].map(k => H + "flame_brazier_" + k + ".png"), frameTime: 0.11, scale: 1,
      at: BRAZIERS.map(x => [x - 18, FLOOR - 128]),
      light: [{ x: 18, y: 36, r: 260, color: [255, 150, 70], strength: 0.6, embers: 1 }] },
    { name: "Hub_Brazier", img: H + "brazier.png", scale: 1, at: BRAZIERS.map(x => [x - 24, FLOOR - 86]) },
    { name: "Hub_Hearth_Fire", frames: [1, 2, 3, 4].map(k => H + "flame_hearth_" + k + ".png"), frameTime: 0.1, scale: 1,
      at: [[HEARTH - 40, FLOOR - 128]],
      light: [{ x: 40, y: 64, r: 420, color: [255, 140, 60], strength: 0.7, embers: 3 }] },
    { name: "Hub_Hearth", img: H + "hearth.png", scale: 1, at: [[HEARTH - 56, FLOOR - 56]] },
    { name: "Hub_Fog_Front", img: H + "fog.png", sx: 5, sy: 1.5, alpha: 0.12, at: xs(604, [0, 1000, 2000, 3000, 4000]), anim: { type: "drift", speed: -14, wrap: 5200 } }
  ];

  // Ruins_Tiles pieces for a fresh scene only: once HUB_Area has Ruins_Tiles instances, build.js leaves them alone
  // (they are painted by hand in the editor now). 16px tiles drawn at 2x, so 32px. Tile ids are row * 32 + column in the atlas.
  // The carved 3x3 block is 33-35 / 65-67 / 97-99; repeating its rows gives a line of stone blocks.
  const blockRow = (ids, n) => Array.from({ length: n }, (_, k) => ids[k % 3]);
  const TOP = [33, 34, 35], MID = [65, 66, 67], BOTTOM = [97, 98, 99];
  const tiles = [
    { what: "floor", x: -64, y: FLOOR, rows: [blockRow(TOP, 145), blockRow(BOTTOM, 145)] },
    { what: "ceiling, left of the skylight", x: -64, y: -32, rows: [blockRow(MID, 63), blockRow(MID, 63), blockRow(MID, 63), blockRow(BOTTOM, 63)] },
    { what: "ceiling, right of the skylight", x: 2752, y: -32, rows: [blockRow(MID, 57), blockRow(MID, 57), blockRow(MID, 57), blockRow(BOTTOM, 57)] },
    { what: "step by the first ledge", x: 1152, y: FLOOR - 64, rows: [blockRow(TOP, 9), blockRow(BOTTOM, 9)] },
    { what: "steps at the far right", x: 4256, y: FLOOR - 64, rows: [blockRow(TOP, 9), blockRow(BOTTOM, 9)] },
    { what: "steps at the far right, upper", x: 4352, y: FLOOR - 128, rows: [blockRow(TOP, 6), blockRow(BOTTOM, 6)] }
  ];

  const HUB = {
    floor: FLOOR, parallax: PARALLAX, gates, items, tiles,
    spawn: [2256 - 132, 456], // Player instance position: the middle of the hub (walls at 0 and 4512).
    // Raw files in "assets (raw)/music/Cathedral of Shadows_mumusi_bgm", converted to 16-bit WAV. CC BY 4.0: keep the credit.
    music: { title: "Cathedral of Shadows", credit: "Music by mumusi_c21, https://mumusi-c21.itch.io, CC BY 4.0",
      intro: "assets/Music/cathedral_of_shadows_intro.wav", loop: "assets/Music/cathedral_of_shadows_loop.wav", volume: 30, channel: 1 },
    ambient: { fireflies: { count: 34, color: 0xffd8a0, area: [20, 200, 4490, 640] } } // Drifting dust motes in the candlelight.
  };
  if (typeof module !== "undefined") module.exports = HUB; else root.HUB = HUB;
})(this);
