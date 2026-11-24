// Brand budget (docs/design-brand-mercy.md, phase 2). Runs once, on the first frame of a fight, after the scene start event has set
// Player.BaseMaxHealth. It applies what the player has permanently earned, from the globals the hub fills in (BrandCount, BossCount,
// BonusLives): each brand costs BrandBudget / N of the base max HP (BrandFraction), never below the HP floor (HpFloorPercent), and the Cat's
// mercy adds a life. The curse stacks are the fight's own (events in this sheet: Player loses a life, Curse removal) and work on top of it.
// The tutorial is practice: no brands, no bonus lives. With no hub counts (a scene opened straight from the editor) nothing changes.
const EXEMPT = ["Tutorial_Level"];
const players = runtimeScene.getObjects("Player");
if (players.length && !runtimeScene.__brandBudget) {
  runtimeScene.__brandBudget = true;
  if (!EXEMPT.includes(runtimeScene.getName())) {
    const g = runtimeScene.getGame().getVariables(), pv = players[0].getVariables();
    const gn = k => g.get(k).getAsNumber(), pn = k => pv.get(k).getAsNumber();
    const n = Math.max(1, gn("BossCount"));
    const fraction = Math.round(pn("BrandBudget") / 100 * gn("BrandCount") / n * 10000) / 10000;   // Rounded so the floor check below has no float noise.
    const base = pn("BaseMaxHealth"), floor = base * pn("HpFloorPercent") / 100;
    const max = Math.max(floor, Math.round(base * (1 - fraction)));
    pv.get("BrandFraction").setNumber(fraction);
    pv.get("MaxHealth").setNumber(max);
    pv.get("Health").setNumber(max);
    pv.get("Lives").setNumber(pn("Lives") + gn("BonusLives"));
  }
}
