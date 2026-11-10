// HUB_Area layout: a ruined hall in a mossy cavern, built from the Dungeon Ruins tileset (tile floor, ceiling,
// steps, recoloured silhouettes) and the SHADOW Series rocks (hanging ceiling rocks, floating ledges, gates).
// Used by build.js (writes the scene) and preview.ps1 (renders a mockup). Images come from crops.ps1.
// World: walls at x 0 and 4512, floor top at y 657, screen 1280x720.
// Layers: "Far" scrolls at PARALLAX of the camera (sky, moon, mountains); "Background" moves 1:1 (everything else).
// Items are drawn in list order within a layer (first = furthest back). scale applies to both axes unless sx/sy.
// platform: the item is a jump-through ledge; mask is its standing band in image pixels [x0, y0, x1, y1].
// anim and alpha work as in tools/arenas (drift, bob, pulse, flicker).
(function (root) {
  const H = "assets/backgrounds/hub/";
  const FLOOR = 657;
  const PARALLAX = 0.3;
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
  const gateAt = gates.map(g => [g.cx - GATE_W / 2, gateY]);
  // The glow sits in the frame's hole: 130x98 at offset (31, 30) in the 1x frame.
  const glowAt = gates.map(g => [g.cx - GATE_W / 2 + 62, gateY + 60]);

  const items = [
    // Far layer.
    { name: "Hub_Sky", img: H + "sky.png", layer: "Far", sx: 2600, sy: 4, at: [[-100, 0]] },
    { name: "Hub_Moon", img: H + "moon.png", layer: "Far", scale: 2, alpha: 0.85, at: [[1090, 26]], anim: { type: "pulse", min: 0.75, max: 1, period: 7 } },
    { name: "Hub_Mountains", img: H + "mountains_far.png", layer: "Far", scale: 4, at: xs(476, [-60, 420, 900, 1380, 1860]) },
    { name: "Hub_Pillar_Far", img: H + "pillar_far.png", layer: "Far", scale: 3, at: xs(372, [240, 820, 1560, 2080]) },
    { name: "Hub_Arch_Far", img: H + "arch_far.png", layer: "Far", scale: 3, at: [[1180, 492]] },
    { name: "Hub_Hills", img: H + "hills_far.png", layer: "Far", scale: 4, at: xs(592, [-120, 640, 1400, 2160]) },
    { name: "Hub_Fog_Back", img: H + "fog.png", layer: "Far", sx: 6, sy: 2, alpha: 0.10, at: xs(540, [0, 800, 1600]), anim: { type: "drift", speed: 8, wrap: 2700 } },

    // Background layer: back to front.
    { name: "Hub_Pillar", img: H + "pillar.png", scale: 4, at: xs(FLOOR - 384, [1250, 3420]) },
    { name: "Hub_Chain", img: H + "chain.png", scale: 4, at: [[1420, 150], [3640, 150]] },
    { name: "Hub_Vine_A", img: H + "vine_a.png", scale: 4, at: xs(130, [300, 1120, 3060, 4300]) },
    { name: "Hub_Vine_B", img: H + "vine_b.png", scale: 4, at: xs(130, [372, 1700, 3150, 4130]) },
    { name: "Hub_Gate_Glow", img: H + "gate_glow.png", scale: 2, at: glowAt, gate: true },
    { name: "Hub_Gate", img: H + "gate.png", scale: 2, at: gateAt },
    // Hanging ceiling rocks under the tile ceiling, broken by a skylight between x ~1980 and ~2760.
    { name: "Hub_Ceiling_Slab", img: H + "slab_bare.png", scale: 2, at: xs(78, [-40, 640, 1360, 2860, 3560, 4250]) },
    { name: "Hub_Ceiling_Rock", img: H + "rock_a_bare.png", scale: 2, at: xs(84, [230, 960, 1640, 3130, 3880]) },
    { name: "Hub_Ceiling_Small", img: H + "rock_small_bare.png", scale: 2, at: xs(88, [480, 1180, 3380, 4080]) },
    { name: "Hub_Ceiling_Tall", img: H + "rock_tall_bare.png", scale: 2, at: [[1880, 80], [2690, 80]] },
    // Floating jump-through ledges (mossy SHADOW rocks).
    { name: "Hub_Ledge", img: H + "ledge.png", scale: 2, platform: true, mask: [2, 3, 110, 12], at: [[1210, 470], [2330, 410], [3240, 520]] },
    { name: "Hub_Slab", img: H + "slab.png", scale: 2, platform: true, mask: [4, 4, 123, 30], at: [[1400, 330]] },
    { name: "Hub_Rock_Small", img: H + "rock_small.png", scale: 2, platform: true, mask: [3, 3, 49, 26], at: [[2140, 510]] },
    { name: "Hub_Rock", img: H + "rock_a.png", scale: 2, platform: true, mask: [3, 3, 75, 30], at: [[2520, 300]] },
    { name: "Hub_Rock_Root", img: H + "rock_root.png", scale: 2, platform: true, mask: [3, 3, 76, 30], at: [[3470, 410]] },
    // Floor props.
    { name: "Hub_Rubble", img: H + "rubble.png", scale: 3, at: [[20, FLOOR - 90], [4330, FLOOR - 90]] },
    { name: "Hub_Swords", img: H + "swords.png", scale: 3, at: [[2070, FLOOR - 76]] },
    { name: "Hub_Bush", img: H + "bush.png", scale: 2, at: [[2760, FLOOR - 58], [3150, FLOOR - 58]] },
    { name: "Hub_Cross", img: H + "cross_a.png", scale: 3, at: [[3770, FLOOR - 104], [4240, FLOOR - 104]] },
    { name: "Hub_Fog_Front", img: H + "fog.png", sx: 5, sy: 1.5, alpha: 0.12, at: xs(604, [0, 1000, 2000, 3000, 4000]), anim: { type: "drift", speed: -14, wrap: 5200 } }
  ];

  // Ruins_Tiles pieces (16px tiles drawn at 2x, so 32px). Tile ids are row * 32 + column in the atlas.
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
    spawn: [100, 456],
    ambient: { fireflies: { count: 40, color: 0x9fe0b0, area: [20, 260, 4490, 640] } }
  };
  if (typeof module !== "undefined") module.exports = HUB; else root.HUB = HUB;
})(this);
