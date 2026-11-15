// Arena layouts for Soul Rush, shared by the browser preview and the GDevelop builder.
// Screen is 1280x720. The floor strip starts at y 657, the walls are at x 0 and 1280.
// Each item is one GDevelop object with one or more instances. Items are drawn in list order
// (first = furthest back). scale applies to both axes unless sx/sy are given.
// anim: drift (wraps sideways), bob (floats up and down), pulse (alpha breathes), flicker.
(function (root) {
  const B = "assets/backgrounds/";
  const row = (y, xs) => xs.map(x => [x, y]);

  const ARENAS = [
    {
      id: "Forest", name: "Deep Forest",
      blurb: "Dense dark forest with light shafts and fireflies. Matches the Leaf Ranger.",
      items: [
        // The forest pack's 12 layers, merged into 3 still images with the 2 light-shaft layers between them,
        // at 2x and positioned so the painted grass line meets the floor.
        { name: "Forest_Back", img: B + "forest/back.png", scale: 2, at: [[-288, -813]] },
        { name: "Forest_Lights_Back", img: B + "forest/lights_back.png", scale: 2, at: [[-288, -813]], anim: { type: "pulse", min: 0.45, max: 1, period: 9.5 } },
        { name: "Forest_Mid", img: B + "forest/mid.png", scale: 2, at: [[-288, -813]] },
        { name: "Forest_Lights_Front", img: B + "forest/lights_front.png", scale: 2, at: [[-288, -813]], anim: { type: "pulse", min: 0.45, max: 1, period: 7 } },
        { name: "Forest_Front", img: B + "forest/front.png", scale: 2, at: [[-288, -813]] }
      ],
      ambient: { fireflies: { count: 26, color: 0xc8f07a, area: [20, 330, 1240, 640] } }
    },
    {
      id: "Ruins", name: "Moonlit Ruins",
      blurb: "Broken pillars and grave markers under a big moon. Quiet, cold, lots of empty sky.",
      items: [
        { name: "Ruins_Sky", img: B + "ruins/sky.png", sx: 1280, sy: 4, at: [[0, 0]] },
        { name: "Ruins_Moon", img: B + "ruins/moon.png", scale: 2, alpha: 0.8, at: [[960, 70]], anim: { type: "pulse", min: 0.8, max: 1, period: 6 } },
        { name: "Ruins_Cloud_A", img: B + "ruins/cloud_a.png", scale: 4, alpha: 0.22, at: [[140, 110], [700, 210], [1100, 40]], anim: { type: "drift", speed: 6 } },
        { name: "Ruins_Cloud_B", img: B + "ruins/cloud_b.png", scale: 4, alpha: 0.2, at: [[420, 150], [880, 250]], anim: { type: "drift", speed: 4 } },
        { name: "Ruins_Mountains", img: B + "ruins/mountains_far.png", scale: 4, at: [[-60, 440], [400, 452], [860, 436]] },
        { name: "Ruins_Hills", img: B + "ruins/hills_far.png", scale: 4, at: [[-120, 580], [640, 586]] },
        { name: "Ruins_Fog_Back", img: B + "ruins/fog.png", sx: 6, sy: 2, alpha: 0.10, at: [[-200, 540], [500, 560]], anim: { type: "drift", speed: 10 } },
        { name: "Ruins_Pillar_Far", img: B + "ruins/pillar_far.png", scale: 3, at: [[330, 369], [1010, 381]] },
        { name: "Ruins_Arch_Far", img: B + "ruins/arch_far.png", scale: 3, at: [[560, 489]] },
        { name: "Ruins_Pillar", img: B + "ruins/pillar_near.png", scale: 4, at: [[-60, 273]] },
        { name: "Ruins_Arch", img: B + "ruins/arch_near.png", scale: 4, at: [[1000, 465]] },
        { name: "Ruins_Chain", img: B + "ruins/chain.png", scale: 4, at: [[150, 0]] },
        { name: "Ruins_Vine_A", img: B + "ruins/vine_a.png", scale: 4, at: [[40, 0], [1210, 0]] },
        { name: "Ruins_Vine_B", img: B + "ruins/vine_b.png", scale: 4, at: [[96, 0], [1150, 0]] },
        { name: "Ruins_Rubble_Tall", img: B + "ruins/rubble_tall.png", scale: 3, at: [[170, 513]] },
        { name: "Ruins_Cross_A", img: B + "ruins/cross_a.png", scale: 3, at: [[290, 549]] },
        { name: "Ruins_Cross_B", img: B + "ruins/cross_b.png", scale: 3, at: [[770, 549]] },
        { name: "Ruins_Cross_Small", img: B + "ruins/cross_small_a.png", scale: 3, at: [[350, 609], [830, 609], [1190, 609]] },
        { name: "Ruins_Swords", img: B + "ruins/swords.png", scale: 3, at: [[530, 576]] },
        { name: "Ruins_Fence", img: B + "ruins/fence.png", scale: 3, at: [[390, 624], [880, 624]] },
        { name: "Ruins_Rubble", img: B + "ruins/rubble.png", scale: 3, at: [[1130, 561]] },
        { name: "Ruins_Bush", img: B + "ruins/bush.png", scale: 2, at: [[640, 600], [-30, 600]] },
        { name: "Ruins_Fog_Front", img: B + "ruins/fog.png", sx: 5, sy: 1.5, alpha: 0.12, at: [[0, 600], [700, 610]], anim: { type: "drift", speed: -14 } }
      ],
      ambient: { fireflies: { count: 10, color: 0xa8d8c8, area: [20, 360, 1240, 640] } }
    },
    {
      id: "Graveyard", name: "Gothic Graveyard",
      blurb: "Purple night graveyard: gravestones, dead trees, an angel statue and a lit lamp post.",
      items: [
        { name: "Grave_Sky", img: B + "graveyard/sky.png", sx: 1280, sy: 4, at: [[0, 0]] },
        { name: "Grave_Moon", img: B + "graveyard/moon.png", scale: 2, alpha: 0.9, at: [[160, 60]], anim: { type: "pulse", min: 0.75, max: 0.95, period: 7 } },
        { name: "Grave_Mountains", img: B + "graveyard/mountains_far.png", scale: 4, alpha: 0.7, at: [[-80, 470], [380, 480], [840, 466]] },
        { name: "Grave_Fog_Back", img: B + "graveyard/fog.png", sx: 6, sy: 2, alpha: 0.10, at: [[-150, 520], [560, 540]], anim: { type: "drift", speed: 9 } },
        { name: "Grave_Arch_Wall", img: B + "graveyard/arch_wall.png", scale: 3, at: [[904, 273]] },
        { name: "Grave_Pillar", img: B + "graveyard/pillar.png", scale: 3, at: [[30, 333]] },
        { name: "Grave_Tree", img: B + "graveyard/dead_tree.png", scale: 3, at: [[540, 441]] },
        { name: "Grave_Tree_B", img: B + "graveyard/dead_tree_b.png", scale: 3, at: [[190, 453]] },
        { name: "Grave_Fence", img: B + "graveyard/fence.png", scale: 3, at: row(591, [130, 226, 322, 610, 706]) },
        { name: "Grave_Angel", img: B + "graveyard/angel.png", scale: 3, at: [[770, 456]] },
        { name: "Grave_Obelisk", img: B + "graveyard/obelisk.png", scale: 3, at: [[470, 513]] },
        { name: "Grave_Tombstone", img: B + "graveyard/tombstone.png", scale: 3, at: [[330, 528]] },
        { name: "Grave_Knight", img: B + "graveyard/knight.png", scale: 3, at: [[1190, 564]] },
        { name: "Grave_Lamp", img: B + "graveyard/lamp_post.png", scale: 3, at: [[690, 483]], anim: { type: "flicker" } },
        { name: "Grave_Round", img: B + "graveyard/grave_round.png", scale: 3, at: [[150, 591], [1010, 591]] },
        { name: "Grave_Cross", img: B + "graveyard/grave_cross.png", scale: 3, at: [[640, 591]] },
        { name: "Grave_Plaque", img: B + "graveyard/grave_plaque.png", scale: 3, at: [[580, 597]] },
        { name: "Grave_Small", img: B + "graveyard/grave_a.png", scale: 3, at: [[420, 615], [1100, 615]] },
        { name: "Grave_Mound", img: B + "graveyard/mound.png", scale: 3, at: [[250, 633], [720, 633]] },
        { name: "Grave_Fog_Front", img: B + "graveyard/fog.png", sx: 5, sy: 1.5, alpha: 0.14, at: [[100, 606], [800, 612]], anim: { type: "drift", speed: -12 } }
      ],
      ambient: { fireflies: { count: 12, color: 0xd8b0ff, area: [20, 380, 1240, 640] } }
    }
  ];
  if (typeof module !== "undefined") module.exports = ARENAS; else root.ARENAS = ARENAS;
})(this);
