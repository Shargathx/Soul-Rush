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

  // The gates, left to right. Walking up to one shows its name; F loads its scene.
  // (The Training Grounds glow gate was removed on 2026-11-11: the training dummy where it stood offers practice, see dummy.)
  // art: a gate from the boss gates pack ("assets (raw)/gates/all_gates_pack", copied in by gates.ps1), drawn at 2x
  //   (256x256). ground is the row of its 128px frame that stands on the floor (the lantern and pillar feet); steps
  //   and rubble below it spill forward over the floor, so the gate art is drawn in front of the floor tiles.
  //   Without art, a gate is a soft glow in its colour, always open.
  // order: the art gates open one at a time, in this order. All start inert. The lowest unbeaten one can be awakened
  //   (F, with a short camera move); beating its boss opens the next. state "locked" keeps a gate sealed whatever the
  //   order (the Fire Knight, until its scene exists). A sealed gate (locked, or no scene) doesn't hold up the order:
  //   the next gate after it can still open. Progress is saved in the browser's local storage.
  // size: the art's drawn size, when it isn't the pack's 256x256; without ground, it stands on the floor.
  const gates = [
    { label: "The Samurai", scene: "Samurai_Fight", art: "torii", ground: 121, order: 1, cx: 1850 },
    { label: "The Leaf Ranger", scene: "Leaf_Ranger_Fight", art: "eclipse", ground: 119, order: 2, cx: 2950 },
    { label: "The Fire Knight", scene: "", art: "infernal", ground: 123, order: 3, cx: 3475, state: "locked", note: "under construction" }, // WIP: no scene yet.
    { label: "The Gunslinger", scene: "Gunslinger", art: "desert", order: 4, cx: 3987.5, size: [223, 181] }
  ];
  // note: what the prompt says at a locked gate instead of "sealed".
  const ART_SIZE = 256;
  const artGates = name => gates.filter(g => g.art === name);
  const artSize = g => g.size || [ART_SIZE, ART_SIZE];
  const artAt = name => artGates(name).map(g => [g.cx - artSize(g)[0] / 2, g.ground === undefined ? FLOOR - artSize(g)[1] : FLOOR - (g.ground + 1) * 2]);
  const ART_Z = 1100; // In front of the floor tiles (1000), behind the light glows (1500).
  const gateVars = list => list.map(g => ({ Scene: g.scene, Label: g.label, State: g.state || "active", Order: String(g.order || ""), Note: g.note || "" }));
  // The construction gag at the unfinished boss's gate (props.js): tape in an X across the Fire Knight's doorway and an
  // UNDER CONSTRUCTION sign beside it. (The Gunslinger's KEEP OUT cones and sign went when its gate opened, 2026-11-12.)
  const gateX = label => gates.find(g => g.label === label).cx;
  const GAG_Z = 1150; // In front of the gate art (1100), behind the light glows.
  // Glow gates: the soft oval (260x196 at 2x) hovering where a doorway would be.
  const glowGates = gates.filter(g => !g.art);
  const glowAt = glowGates.map(g => [g.cx - 130, 397]);
  // The gate pack's animations: 48-frame loops at 0.1 s; inactive and completed are single frames (completed is a
  // loop for the infernal gate).
  const G = H + "gates/";
  const D = H + "desert_gate/"; // Not under gates/: gates.ps1 empties that folder when it copies the pack in.
  const seq = (dir, name, n) => Array.from({ length: n }, (_, k) => G + dir + "/" + name + "_" + String(k).padStart(2, "0") + ".png");
  const gateAnims = (dir, activeName, completedFrames) => [
    { name: "inactive", frames: seq(dir, "inactive", 1) },
    { name: "active", frames: seq(dir, activeName, 48), time: 0.1, loop: true },
    { name: "completed", frames: seq(dir, "completed", completedFrames), time: 0.1, loop: completedFrames > 1 }
  ];
  // The torii crow (HANDOFF.md in the pack): every animation's origin is its feet anchor, so the bird stands on one spot.
  // `pick` picks frames out of another animation's files, `from` (default: this animation's own).
  const crowAnim = (a, side, n, time, loop, feet, pick, from) => ({ name: a + "_" + side, frames: (pick || (f => f))(seq("torii/crow", (from || a) + "_" + side, n)), time, loop, origin: feet });
  // The pack's 48-frame idle has the caw in it: frames 14-23 are one held pose (neck stretched, beak open). They're
  // cut out of idle into their own "caw" animation, which only plays while a caw sounds.
  const CAW_FRAMES = [14, 24];
  const idleOnly = f => f.filter((_, k) => k < CAW_FRAMES[0] || k >= CAW_FRAMES[1]), cawOnly = f => f.slice(CAW_FRAMES[0], CAW_FRAMES[1]);
  const CROW = {
    animations: [
      crowAnim("idle", "right", 48, 0.1, true, [7, 12], idleOnly), crowAnim("idle", "left", 48, 0.1, true, [8, 12], idleOnly),
      crowAnim("caw", "right", 48, 0.1, true, [7, 12], cawOnly, "idle"), crowAnim("caw", "left", 48, 0.1, true, [8, 12], cawOnly, "idle"),
      crowAnim("hop", "right", 8, 0.06, false, [9, 22]), crowAnim("hop", "left", 8, 0.06, false, [22, 22]),
      crowAnim("vanish", "right", 16, 0.07, false, [8, 37]), crowAnim("vanish", "left", 16, 0.07, false, [31, 37]),
      crowAnim("appear", "right", 16, 0.07, false, [8, 37]), crowAnim("appear", "left", 16, 0.07, false, [31, 37])
    ],
    // perch_feet_positions_in_gate from torii_meta.json (1x pixels from the gate's top-left; the gate is drawn at 2x).
    perchX: [12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116],
    perchY: [8,9,9,9,9,10,10,10,10,10,11,11,11,11,11,12,12,12,12,12,12,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,14,13,13,12,12,11,11,11,11,11,10,10,10,10,10,9,9,9,9,8],
    hopBy: 10, hopFrames: 8, hopTime: 0.06,
    // Suggested behaviour (seconds, randomised): stay, hop every, hops in a row, gone.
    stay: [15, 40], hopEvery: [4, 10], hops: [1, 3], gone: [6, 15],
    // Two crows per torii. They keep at least `gap` px apart (1x pixels; a crow is 16 px wide, its dust 40 px), so a
    // crow never appears on, or hops into, the other. The second first shows up later, so they don't move in step.
    birds: 2, gap: 28, firstAppear: [[1, 4], [10, 22]],
    // Roughly every 15 s (`every`, randomised) one perched crow, picked at random, caws. If none is perched, the next
    // one to settle caws. It holds the caw pose while the clip's two caws sound (sounds.caw.hold), then goes back to idle.
    // Volume falls off with the player's distance from the gate, down to `minVolume` (0-1) at `far` px.
    caw: { every: [11, 19], far: 1400, minVolume: 0.2 }
  };

  // Light sources. The hearth burns in the middle, where the player starts. (Braziers by the glow gates were
  // removed on 2026-11-11: they didn't match the hall.)
  const HEARTH = 2256;
  const CANDELABRAS = [1305, 2603];
  const CHANDELIERS = [1305, HEARTH, 3212];
  // Wall torches on the arcade columns. The arcade (Mid layer) repeats every 512 px with a column at every multiple
  // of 512, so the torches sit on the Mid layer too and scroll with their columns. These cover the hub's width;
  // a wider hub needs more (the Mid camera reaches about x = 0.55 * the walls' distance).
  const TORCH_COLUMNS = [0, 1, 2, 3, 4, 5, 6].map(k => k * 512);
  // God rays: one under each window of the far wall. The far wall repeats every 320 px (Far layer, instance at
  // x -320), with a window centred 160 px into each tile; the beam starts 40 px into its image.
  const RAY_WINDOWS = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => -320 + 160 + 320 * k);
  // Furniture and trophies (props.js draws them).
  const BENCH = HEARTH - 112, KEEPER = HEARTH + 100, LECTERN = 1400, DUMMY = 760; // The dummy stands where the Training Grounds gate was.
  const PEWS = [1112, 3212];
  // The pair of candles that flanked the Gunslinger's old glow gate, kept where they stood.
  const CANDLES = [3800, 4150];
  // Trophies, by their gates: the Samurai's katana-kake (sword stand) on the floor; the Leaf Ranger's plinth, with
  // his bow leaning against its side and his quiver beside it.
  // The relic appears on its stand once that boss is beaten.
  const KATANA_STAND = 2040, BOW_PLINTH = 2730;

  const items = [
    // Cathedral backdrop: endless Tiled Sprites. width is the editor size; the game keeps them covering the view.
    { name: "Hub_Cathedral_Far", img: H + "cathedral_far.png", layer: "Far", tiled: true, at: [[-320, 0]], width: 2880 },
    { name: "Hub_Fog_Back", img: H + "fog.png", layer: "Far", sx: 6, sy: 2, alpha: 0.08, at: xs(560, [0, 800, 1600]), anim: { type: "drift", speed: 8, wrap: 2700 } },
    // Moonlight falling through the windows, softly breathing (the lights event pulses them).
    { name: "Hub_God_Ray", img: H + "god_ray.png", layer: "Far", scale: 1, at: RAY_WINDOWS.map(x => [x - 40, 150]) },
    { name: "Hub_Cathedral_Mid", img: H + "cathedral_mid.png", layer: "Mid", tiled: true, at: [[-512, 0]], width: 4096 },
    { name: "Hub_Torch", img: H + "torch.png", layer: "Mid", scale: 1, at: TORCH_COLUMNS.map(x => [x - 14, 400]) },
    { name: "Hub_Torch_Fire", frames: [1, 2, 3, 4].map(k => H + "flame_torch_" + k + ".png"), frameTime: 0.09, layer: "Mid", scale: 1,
      at: TORCH_COLUMNS.map(x => [x - 10, 382]),
      light: [{ x: 10, y: 22, r: 170, color: [255, 160, 80], strength: 0.42 }] },

    // Background layer: back to front. (Rocks, ledges, gate frames, vines, chains and floor props were removed in
    // the editor on 2026-11-11: they didn't fit the cathedral.)
    { name: "Hub_Gate_Glow", img: H + "gate_glow.png", scale: 2, at: glowAt, vars: glowGates.map((g, k) => Object.assign(gateVars(glowGates)[k], { Color: g.color.join(";") })) },
    // Gate art (gate: true marks the objects the gates event treats as art gates). states: how bright each glow is per
    // state the gate shows (missing = off).
    { name: "Hub_Gate_Torii", gate: true, z: ART_Z, animations: gateAnims("torii", "back", 1), size: [ART_SIZE, ART_SIZE], at: artAt("torii"), vars: gateVars(artGates("torii")),
      light: [{ x: 128, y: 150, r: 210, color: [150, 110, 230], strength: 0.35, states: { active: 1, ready: 0.25 } },
        { x: 28, y: 186, r: 110, color: [255, 190, 110], strength: 0.55, states: { active: 1, completed: 1 } },
        { x: 228, y: 186, r: 110, color: [255, 190, 110], strength: 0.55, states: { active: 1, completed: 1 } }] },
    { name: "Hub_Gate_Eclipse", gate: true, z: ART_Z, animations: gateAnims("eclipse", "active", 1), size: [ART_SIZE, ART_SIZE], at: artAt("eclipse"), vars: gateVars(artGates("eclipse")),
      light: [{ x: 128, y: 160, r: 230, color: [80, 210, 180], strength: 0.4, states: { active: 1, ready: 0.25 } },
        { x: 128, y: 150, r: 150, color: [255, 200, 90], strength: 0.3, states: { completed: 1 } }] },
    { name: "Hub_Gate_Infernal", gate: true, z: ART_Z, animations: gateAnims("infernal", "active", 48), size: [ART_SIZE, ART_SIZE], at: artAt("infernal"), vars: gateVars(artGates("infernal")),
      light: [{ x: 128, y: 160, r: 280, color: [255, 120, 40], strength: 0.6, states: { active: 1, completed: 0.35, ready: 0.25 } }] },
    // The Gunslinger's desert door (its own art, not the pack's: assets/backgrounds/hub/desert_gate): an empty cactus arch
    // while inert, a red sand swirl once awake. completed is a placeholder (a still swirl frame) until its art exists.
    { name: "Hub_Gate_Desert", gate: true, z: ART_Z, size: artSize(artGates("desert")[0]), at: artAt("desert"), vars: gateVars(artGates("desert")),
      animations: [
        { name: "inactive", frames: [D + "inactive_00.png"] },
        { name: "active", frames: [0, 1, 2].map(k => D + "active_0" + k + ".png"), time: 0.16, loop: true },
        { name: "completed", frames: [D + "completed_00.png"] }
      ],
      light: [{ x: 111, y: 105, r: 220, color: [240, 150, 80], strength: 0.4, states: { active: 1, ready: 0.25 } }] },
    { name: "Hub_Construction_Tape_X", img: H + "construction_tape_x.png", scale: 1, z: GAG_Z, at: [[gateX("The Fire Knight") - 56, 500]] },
    { name: "Hub_Construction_Sign", img: H + "construction_sign.png", scale: 1, z: GAG_Z + 1,
      at: [[gateX("The Fire Knight") + 30, FLOOR - 72]] },
    // Made at runtime for each torii (no instances): its front layer (spirits, petals) and the crow, which goes between.
    { name: "Hub_Gate_Torii_Front", animations: [{ name: "active", frames: seq("torii", "front", 48), time: 0.1, loop: true }], at: [] },
    { name: "Hub_Crow", animations: CROW.animations, at: [] },
    // Light sources (lights.js). Their images are saved at 2x already, so scale 1. light: glows the game adds at runtime, at an offset from each instance's
    // top-left corner (on screen pixels), so a light you move or copy in the editor brings its glow along.
    // Fires are listed before their bowls so the rim covers the flame's base.
    // r is the glow radius, strength its brightness (0-1), embers makes sparks rise from it.
    { name: "Hub_Chandelier", img: H + "chandelier.png", scale: 1, at: CHANDELIERS.map(x => [x - 60, 86]),
      light: [{ x: 60, y: 176, r: 210, color: [255, 190, 120], strength: 0.45 }] },
    { name: "Hub_Candelabra", img: H + "candelabra.png", scale: 1, at: CANDELABRAS.map(x => [x - 22, FLOOR - 150]),
      light: [{ x: 22, y: 10, r: 150, color: [255, 200, 130], strength: 0.5 }] },
    { name: "Hub_Hearth_Fire", frames: [1, 2, 3, 4].map(k => H + "flame_hearth_" + k + ".png"), frameTime: 0.1, scale: 1,
      at: [[HEARTH - 40, FLOOR - 128]],
      light: [{ x: 40, y: 64, r: 420, color: [255, 140, 60], strength: 0.7, embers: 3 }] },
    { name: "Hub_Hearth", img: H + "hearth.png", scale: 1, at: [[HEARTH - 56, FLOOR - 56]] },
    // Furniture. action: what F does there (the gates event handles it): rest, speak or read.
    { name: "Hub_Pew", img: H + "pew.png", scale: 1, at: PEWS.map(x => [x - 92, FLOOR - 46]) },
    { name: "Hub_Bench", img: H + "bench.png", scale: 1, at: [[BENCH - 40, FLOOR - 26]], vars: [{ Action: "rest" }] },
    { name: "Hub_Keeper", frames: [H + "keeper_1.png", H + "keeper_2.png"], frameTime: 1.1, scale: 1, at: [[KEEPER - 26, FLOOR - 70]], vars: [{ Action: "speak" }],
      light: [{ x: 47, y: 14, r: 70, color: [255, 190, 110], strength: 0.45 }] },
    { name: "Hub_Lectern", img: H + "lectern.png", scale: 1, at: [[LECTERN - 22, FLOOR - 66]], vars: [{ Action: "read" }] },
    { name: "Hub_Dummy", img: H + "dummy.png", scale: 1, at: [[DUMMY - 30, FLOOR - 92]], vars: [{ Action: "train" }] },
    { name: "Hub_Candles", img: H + "candles.png", scale: 1, at: CANDLES.map(x => [x - 24, FLOOR - 30]),
      light: [{ x: 24, y: 6, r: 110, color: [255, 190, 110], strength: 0.45 }] },
    // Trophies: the stands always; the relic only once its boss is beaten (Scene: whose win shows it).
    { name: "Hub_Sword_Stand", img: H + "sword_stand.png", scale: 1, at: [[KATANA_STAND - 56, FLOOR - 38]] },
    { name: "Hub_Relic_Katana", img: H + "relic_katana.png", scale: 1, at: [[KATANA_STAND - 56, FLOOR - 38 + 4]], vars: [{ Scene: "Samurai_Fight" }] },
    { name: "Hub_Plinth", img: H + "plinth.png", scale: 1, at: [[BOW_PLINTH - 26, FLOOR - 62]] },
    { name: "Hub_Relic_Bow", img: H + "relic_bow.png", scale: 1, at: [[BOW_PLINTH - 26 - 66, FLOOR - 94]], vars: [{ Scene: "Leaf_Ranger_Fight" }] },
    // The rug lies on the floor, so it is drawn over the floor tiles' top edge.
    { name: "Hub_Rug", img: H + "rug.png", scale: 1, z: 1050, at: [[HEARTH - 140, FLOOR - 5]] },
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
    floor: FLOOR, parallax: PARALLAX, gates, items, tiles, crow: CROW,
    // Player instance position: the middle of the hub (walls at 0 and 4512), feet on the floor (657 - the sprite's
    // 176 px height), so the player doesn't drop onto the floor in the first frames.
    spawn: [2256 - 132, 657 - 176],
    // The user's own Suno track (assets/Music/cathedral_music_background.mp3), cut by tools/hub/music_suno.js into a
    // 10.6 s intro and a 208 s seamless loop. It is about 8 dB louder than the old track, hence the lower volume (12, then raised 12.5% to 13.5 by ear).
    // The old track (Cathedral of Shadows by mumusi_c21, CC BY 4.0; tools/hub/music.js) is kept as a fallback:
    //   { title: "Cathedral of Shadows", credit: "Music by mumusi_c21, https://mumusi-c21.itch.io, CC BY 4.0",
    //     intro: "assets/Music/cathedral_of_shadows_intro.wav", loop: "assets/Music/cathedral_of_shadows_loop.wav", volume: 30 }
    music: { title: "Cathedral background", credit: "made in Suno",
      intro: "assets/Music/cathedral_background_intro.wav", loop: "assets/Music/cathedral_background_loop.wav", volume: 13.5, channel: 1 },
    ambient: { fireflies: { count: 34, color: 0xffd8a0, area: [20, 200, 4490, 640] } }, // Drifting dust motes in the candlelight.
    // Sounds (sounds.js synthesizes them). Volumes are 0-100. The hearth gets louder as the player nears it.
    sounds: {
      gong: { file: "assets/Sfx/hub/gate_gong.wav", volume: 85 },
      hearth: { file: "assets/Sfx/hub/hearth_loop.wav", volume: 35, channel: 2, near: 120, far: 1100 },
      bell: { file: "assets/Sfx/hub/distant_bell.wav", volume: 22, every: [45, 100] },
      // The torii crows' caws (tools/fx/crow_cut.js, from a real recording), one picked at random each time; see crow.caw for when.
      // `hold`: per clip, seconds from its start to the end of its second caw (plus a beat), the caw pose's length.
      caw: { files: [1, 2, 3, 4, 5, 6].map(k => "assets/Sfx/hub/crow_caw_" + k + ".wav"), hold: [1.05, 0.95, 1.0, 0.95, 0.95, 1.0], volume: 38 }
    },
    // What the keeper says, by how far the player has come (cycles through the lines on each F).
    keeper: {
      start: ["The fire still burns. Few walk these halls anymore.", "The torii stirs. Wake it, if you have the will."],
      samuraiAwake: ["He waits beneath the blossoms. He will bow before he draws.", "Watch his eyes. The blade follows a breath behind."],
      samuraiBeaten: ["The blossoms have settled. Can you hear the eclipse gate humming?", "Rest a while. The fire will keep."],
      leafBeaten: ["Two have fallen. The forge-gate sleeps still; even I cannot wake it.", "Rest. The fire will keep."]
    },
    // The training dummy: F asks this yes/no question (A/D to choose, F to answer, Esc for no). Yes loads the scene;
    // no shows the declined line over the dummy.
    dummy: { ask: "Practise against the old drills?", yes: "Yes", no: "No", scene: "Tutorial_Level", declined: "The dummy sags on its post. It will wait." },
    // F at the bench: rest, or start the whole journey over (asked twice; "No" is picked on the second question).
    bench: { ask: "The bench is worn smooth by others who sat here.", rest: "Rest", reset: "Start over",
      confirm: "Forget every gate woken and every foe felled? This cannot be undone.", no: "No", yes: "Yes",
      kept: "You stay as you are.", forgotten: "The embers settle. It is as if you never came." },
    // The lectern's pages (cycles on each F).
    lectern: [
      "Of this hall: travellers rest by the hearth, and the gates wake one at a time.",
      "A and D to walk, Space to roll, J to strike, K to deflect, Q to lunge. F to finish a broken foe.",
      "Those who fall return to the fire. It remembers every step."
    ]
  };
  if (typeof module !== "undefined") module.exports = HUB; else root.HUB = HUB;
})(this);
