// Arena layouts for Soul Rush, shared by the browser preview and the GDevelop builder.
// Screen is 1280x720. The floor strip starts at y 657, the walls are at x 0 and 1280.
// Each item is one GDevelop object with one or more instances. Items are drawn in list order
// (first = furthest back). scale applies to both axes unless sx/sy are given.
// anim: drift (wraps sideways), bob (floats up and down), pulse (alpha breathes), flicker.
(function (root) {
  const A = "assets/arenas/";
  const row = (y, xs) => xs.map(x => [x, y]);

  const ARENAS = [
    {
      id: "Forest", name: "Deep Forest",
      blurb: "Dense dark forest with light shafts and fireflies. Matches the Leaf Ranger.",
      items: [
        // Full-screen parallax layers at 2x, positioned so the painted grass line meets the floor.
        ...["0011_0", "0010_1", "0009_2", "0008_3", "0007_lights", "0006_4", "0005_5", "0004_lights", "0003_6", "0002_7", "0001_8", "0000_9"]
          .map(n => ({ name: "Forest_" + n.replace(/^\d+_/, "L"), img: A + "forest/layer_" + n + ".png", scale: 2, at: [[-288, -813]],
            anim: n.includes("lights") ? { type: "pulse", min: 0.45, max: 1, period: n === "0004_lights" ? 7 : 9.5 } : undefined }))
      ],
      ambient: { fireflies: { count: 26, color: 0xc8f07a, area: [20, 330, 1240, 640] } }
    },
    {
      id: "Ruins", name: "Moonlit Ruins",
      blurb: "Broken pillars and grave markers under a big moon. Quiet, cold, lots of empty sky.",
      items: [
        { name: "Ruins_Sky", img: A + "ruins/sky.png", sx: 1280, sy: 4, at: [[0, 0]] },
        { name: "Ruins_Moon", img: A + "ruins/moon.png", scale: 2, alpha: 0.8, at: [[960, 70]], anim: { type: "pulse", min: 0.8, max: 1, period: 6 } },
        { name: "Ruins_Cloud_A", img: A + "ruins/cloud_a.png", scale: 4, alpha: 0.22, at: [[140, 110], [700, 210], [1100, 40]], anim: { type: "drift", speed: 6 } },
        { name: "Ruins_Cloud_B", img: A + "ruins/cloud_b.png", scale: 4, alpha: 0.2, at: [[420, 150], [880, 250]], anim: { type: "drift", speed: 4 } },
        { name: "Ruins_Mountains", img: A + "ruins/mountains_far.png", scale: 4, at: [[-60, 440], [400, 452], [860, 436]] },
        { name: "Ruins_Hills", img: A + "ruins/hills_far.png", scale: 4, at: [[-120, 580], [640, 586]] },
        { name: "Ruins_Fog_Back", img: A + "fog.png", sx: 6, sy: 2, alpha: 0.10, at: [[-200, 540], [500, 560]], anim: { type: "drift", speed: 10 } },
        { name: "Ruins_Pillar_Far", img: A + "ruins/pillar_far.png", scale: 3, at: [[330, 369], [1010, 381]] },
        { name: "Ruins_Arch_Far", img: A + "ruins/arch_far.png", scale: 3, at: [[560, 489]] },
        { name: "Ruins_Pillar", img: A + "ruins/pillar_near.png", scale: 4, at: [[-60, 273]] },
        { name: "Ruins_Arch", img: A + "ruins/arch_near.png", scale: 4, at: [[1000, 465]] },
        { name: "Ruins_Chain", img: A + "ruins/chain.png", scale: 4, at: [[150, 0]] },
        { name: "Ruins_Vine_A", img: A + "ruins/vine_a.png", scale: 4, at: [[40, 0], [1210, 0]] },
        { name: "Ruins_Vine_B", img: A + "ruins/vine_b.png", scale: 4, at: [[96, 0], [1150, 0]] },
        { name: "Ruins_Rubble_Tall", img: A + "ruins/rubble_tall.png", scale: 3, at: [[170, 513]] },
        { name: "Ruins_Cross_A", img: A + "ruins/cross_a.png", scale: 3, at: [[290, 549]] },
        { name: "Ruins_Cross_B", img: A + "ruins/cross_b.png", scale: 3, at: [[770, 549]] },
        { name: "Ruins_Cross_Small", img: A + "ruins/cross_small_a.png", scale: 3, at: [[350, 609], [830, 609], [1190, 609]] },
        { name: "Ruins_Swords", img: A + "ruins/swords.png", scale: 3, at: [[530, 576]] },
        { name: "Ruins_Fence", img: A + "ruins/fence.png", scale: 3, at: [[390, 624], [880, 624]] },
        { name: "Ruins_Rubble", img: A + "ruins/rubble.png", scale: 3, at: [[1130, 561]] },
        { name: "Ruins_Bush", img: A + "ruins/bush.png", scale: 2, at: [[640, 600], [-30, 600]] },
        { name: "Ruins_Fog_Front", img: A + "fog.png", sx: 5, sy: 1.5, alpha: 0.12, at: [[0, 600], [700, 610]], anim: { type: "drift", speed: -14 } }
      ],
      ambient: { fireflies: { count: 10, color: 0xa8d8c8, area: [20, 360, 1240, 640] } }
    },
    {
      id: "Cliffs", name: "Magic Cliffs",
      blurb: "Bright seaside cliff with drifting clouds and a floating island. The lightest, most open option.",
      mute: { saturation: 0.85, brightness: 0.88 },
      items: [
        { name: "Cliffs_Sky", img: A + "cliffs/sky.png", sx: 11.5, sy: 2.4, at: [[0, 0]] },
        { name: "Cliffs_Clouds", img: A + "cliffs/clouds.png", scale: 2, at: [[0, 150], [1088, 150]], anim: { type: "drift", speed: 8, wrap: 2176 } },
        { name: "Cliffs_Far_Ground", img: A + "cliffs/far_grounds.png", scale: 2, at: [[60, 300]] },
        { name: "Cliffs_Sea", img: A + "cliffs/sea.png", scale: 2, at: row(476, [0, 224, 448, 672, 896, 1120]) },
        { name: "Cliffs_Island", img: A + "cliffs/island.png", scale: 2, at: [[860, 110]], anim: { type: "bob", amp: 6, period: 5 } },
        { name: "Cliffs_Rock", img: A + "cliffs/rock_small.png", scale: 2, at: [[600, 210]], anim: { type: "bob", amp: 4, period: 3.7 } },
        { name: "Cliffs_Column", img: A + "cliffs/cliff_column.png", scale: 3, at: [[1150, 399], [1060, 470]] },
        { name: "Cliffs_Block", img: A + "cliffs/cliff_block.png", scale: 3, at: [[-100, 354]] },
        { name: "Cliffs_Tree", img: A + "cliffs/tree.png", scale: 3, at: [[-40, 32]] },
        { name: "Cliffs_Fern", img: A + "cliffs/fern_rock.png", scale: 2, at: [[690, 583]] }
      ]
    },
    {
      id: "Graveyard", name: "Gothic Graveyard",
      blurb: "Purple night graveyard: gravestones, dead trees, an angel statue and a lit lamp post.",
      items: [
        { name: "Grave_Sky", img: A + "gothic/sky.png", sx: 1280, sy: 4, at: [[0, 0]] },
        { name: "Grave_Moon", img: A + "ruins/moon.png", scale: 2, alpha: 0.9, at: [[160, 60]], anim: { type: "pulse", min: 0.75, max: 0.95, period: 7 } },
        { name: "Grave_Mountains", img: A + "ruins/mountains_far.png", scale: 4, alpha: 0.7, at: [[-80, 470], [380, 480], [840, 466]] },
        { name: "Grave_Fog_Back", img: A + "fog.png", sx: 6, sy: 2, alpha: 0.10, at: [[-150, 520], [560, 540]], anim: { type: "drift", speed: 9 } },
        { name: "Grave_Arch_Wall", img: A + "gothic/arch_wall.png", scale: 3, at: [[904, 273]] },
        { name: "Grave_Pillar", img: A + "gothic/pillar.png", scale: 3, at: [[30, 333]] },
        { name: "Grave_Tree", img: A + "gothic/dead_tree.png", scale: 3, at: [[540, 441]] },
        { name: "Grave_Tree_B", img: A + "gothic/dead_tree_b.png", scale: 3, at: [[190, 453]] },
        { name: "Grave_Fence", img: A + "gothic/fence.png", scale: 3, at: row(591, [130, 226, 322, 610, 706]) },
        { name: "Grave_Angel", img: A + "gothic/angel.png", scale: 3, at: [[770, 456]] },
        { name: "Grave_Obelisk", img: A + "gothic/obelisk.png", scale: 3, at: [[470, 513]] },
        { name: "Grave_Tombstone", img: A + "gothic/tombstone.png", scale: 3, at: [[330, 528]] },
        { name: "Grave_Knight", img: A + "gothic/knight.png", scale: 3, at: [[1190, 564]] },
        { name: "Grave_Lamp", img: A + "gothic/lamp_post.png", scale: 3, at: [[690, 483]], anim: { type: "flicker" } },
        { name: "Grave_Round", img: A + "gothic/grave_round.png", scale: 3, at: [[150, 591], [1010, 591]] },
        { name: "Grave_Cross", img: A + "gothic/grave_cross.png", scale: 3, at: [[640, 591]] },
        { name: "Grave_Plaque", img: A + "gothic/grave_plaque.png", scale: 3, at: [[580, 597]] },
        { name: "Grave_Small", img: A + "gothic/grave_a.png", scale: 3, at: [[420, 615], [1100, 615]] },
        { name: "Grave_Mound", img: A + "gothic/mound.png", scale: 3, at: [[250, 633], [720, 633]] },
        { name: "Grave_Fog_Front", img: A + "fog.png", sx: 5, sy: 1.5, alpha: 0.14, at: [[100, 606], [800, 612]], anim: { type: "drift", speed: -12 } }
      ],
      ambient: { fireflies: { count: 12, color: 0xd8b0ff, area: [20, 380, 1240, 640] } }
    }
  ];
  if (typeof module !== "undefined") module.exports = ARENAS; else root.ARENAS = ARENAS;
})(this);
