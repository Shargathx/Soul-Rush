// The Necromancer's skeletons (tools/fx/necro_skeleton_logic.js, installed as the "Skeletons" script of Necromancer_Boss), run in the
// stand-in scene (tools/test/sim.js) against a stand-in player and the two bits of the rest of the fight they rely on: his sheet's
// "attack boxes last Life seconds", and Combat_Shared's hitbox check (a hit takes health, a deflect does not; both set HasHit).
const { load, walk, codeOf, exists } = require("./lib");
const { Scene } = require("./sim");

function skeletonScript() {
  const sh = load().sheets.find(s => s.name === "Necromancer_Boss");
  let code = null; walk(sh.events, e => { if (!code && e.type === "BuiltinCommonInstructions::JsCode" && codeOf(e).startsWith("// Skeletons:")) code = codeOf(e); });
  if (!code) throw new Error("no Skeletons script in Necromancer_Boss (node tools/fx/necro_skeleton_install.js)");
  return code;
}
// A fight in the stand-in scene. The player stands at playerX and, with `deflect`, deflects every cut.
function fight(opts = {}) {
  const sc = new Scene(load().scenes.find(s => s.name === "Boss_Necromancer"), "Boss_Necromancer");
  const boss = sc.spawn("Necromancer", 1000, 480); boss.w = 160; boss.h = 300;
  const bv = boss.vars; bv.get("AIState").setString(opts.state || "Neutral"); bv.get("Phase").setNumber(opts.phase || 1);
  const player = sc.spawn("Player", opts.playerX || 300, 617); player.w = 42; player.h = 80;
  const pv = player.vars; pv.get("Health").setNumber(100);
  const sword = sc.spawn("Player_Hitbox", -1000, -1000); sword.w = 60; sword.h = 40;
  const keys = new Set(), gd = { evtTools: { input: { isKeyPressed: (s, k) => keys.has(k) } } };
  const fn = new Function("runtimeScene", "gdjs", skeletonScript()), dt = 1 / 60;
  const r = { sc, boss, bv, player, pv, sword, keys, deflect: !!opts.deflect, hits: 0, deflects: 0, cuts: [], t: 0,
    skeletons: () => sc.list("Necro_Skeleton"), standing: () => sc.list("Necro_Skeleton").filter(o => o.__sk && o.__sk.s !== "crumble"),
    swingAt(o) { pv.get("IsAttacking").setBoolean(true); sword.x = o ? o.x : -1000; sword.y = o ? 617 : -1000; },
    stopSwing() { pv.get("IsAttacking").setBoolean(false); sword.x = -1000; sword.y = -1000; },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        sc.time += dt; r.t += dt;
        // Combat_Shared: a hitbox touching the player lands once (a deflect at `deflect`).
        for (const h of sc.list("Necro_Hitbox")) {
          const hv = h.vars;
          if (!r.cuts.includes(h)) r.cuts.push(h);
          if (hv.get("HasHit").getAsBoolean()) continue;
          if (h.getAABBLeft() < player.getAABBRight() && h.getAABBRight() > player.getAABBLeft() && h.getAABBTop() < player.getAABBBottom() && h.getAABBBottom() > player.getAABBTop()) {
            hv.get("HasHit").setBoolean(true);
            if (r.deflect) r.deflects++; else { r.hits++; pv.get("Health").setNumber(pv.get("Health").getAsNumber() - hv.get("Damage").getAsNumber()); }
          }
        }
        fn(sc, gd);
        // His sheet: attack boxes last Life seconds.
        for (const h of sc.list("Necro_Hitbox")) { const l = h.vars.get("Life"); l.setNumber(l.getAsNumber() - dt); if (l.getAsNumber() <= 0) h.deleteFromScene(); }
      }
    }
  };
  return r;
}
const T = (r, n) => r.bv.get(n).getAsNumber();

const tests = [];

tests.push(["Necromancer skeletons: the object, its art (every animation, green and red-eyed), the three sounds, the tuning variables and the script are in place", () => {
  const bad = [], { scenes, project } = load(), sc = scenes.find(s => s.name === "Boss_Necromancer");
  const o = sc.objects.find(x => x.name === "Necro_Skeleton");
  if (!o) return ["Boss_Necromancer has no Necro_Skeleton (node tools/fx/necro_skeleton_install.js)"];
  for (const a of ["Rise", "Walk", "Windup", "Swing", "Stagger", "Crumble"]) for (const suf of ["", "_P2"]) {
    const an = o.animations.find(x => x.name === a + suf);
    if (!an) { bad.push("no animation " + a + suf); continue; }
    const n = { Rise: 8, Walk: 6, Windup: 3, Swing: 3, Stagger: 2, Crumble: 8 }[a];
    if (an.directions[0].sprites.length !== n) bad.push(a + suf + " should have " + n + " frames (the script counts on it)");
  }
  for (const f of ["rise", "swing", "break"]) { const file = "assets/Sfx/necro/necro_skel_" + f + ".wav"; if (!exists(file) || !project.resources.resources.some(r => r.name === file)) bad.push(file + " missing or not registered"); }
  const necro = sc.objects.find(x => x.name === "Necromancer");
  for (const v of ["SkelMaxP1", "SkelMaxP2", "SkelDelayP1", "SkelDelayP2", "SkelFirstDelay", "SkelSpeed", "SkelReach", "SkelWindup", "SkelRecover", "SkelDamage"]) if (!necro.variables.some(x => x.name === v)) bad.push("the Necromancer lacks " + v);
  const max = n => (necro.variables.find(x => x.name === n) || {}).value;
  if (max("SkelMaxP1") !== 1 || max("SkelMaxP2") !== 2) bad.push("one skeleton at a time in phase 1, two in phase 2");
  skeletonScript();
  return bad;
}]);

tests.push(["Necromancer skeletons: one at a time in phase 1 and two in phase 2, never more; the first rises after SkelFirstDelay", () => {
  const bad = [];
  for (const phase of [1, 2]) {
    const r = fight({ phase, deflect: true }), cap = phase === 1 ? 1 : 2;
    let most = 0, first = -1;
    for (let i = 0; i < 60 * 25; i++) { r.step(); const n = r.standing().length; most = Math.max(most, n); if (n && first < 0) first = r.t; }
    if (most !== cap) bad.push("phase " + phase + ": " + most + " stood at once, should be " + cap);
    if (first < T(r, "SkelFirstDelay") - 0.05 || first > T(r, "SkelFirstDelay") + 0.1) bad.push("phase " + phase + ": the first rose at " + first.toFixed(2) + " s, not after SkelFirstDelay");
    if (phase === 2 && !r.skeletons().every(o => /_P2$/.test(o.getAnimationName()))) bad.push("phase 2 skeletons should use the red-eyed *_P2 animations");
    if (phase === 1 && r.skeletons().some(o => /_P2$/.test(o.getAnimationName()))) bad.push("phase 1 skeletons should have green eyes");
  }
  return bad;
}]);

tests.push(["Necromancer skeletons: one sword hit kills one (it crumbles and is gone), and a new one rises SkelDelay seconds later: semi-constant", () => {
  const bad = [], r = fight({ phase: 1, deflect: true });
  r.step(60 * 4);
  const s = r.standing()[0]; if (!s) return ["no skeleton rose"];
  r.swingAt(s); r.step(1); r.stopSwing();
  if (s.__sk.s !== "crumble") bad.push("one hit should start its crumble");
  if (!r.sc.sounds.some(f => /necro_skel_break/.test(f))) bad.push("it should break with necro_skel_break");
  r.step(45);
  if (!s.deleted) bad.push("it should be gone once the crumble has played");
  if (!s.animLog.has("Crumble")) bad.push("it should play Crumble");
  let back = -1; const killedAt = r.t - 45 / 60;
  for (let i = 0; i < 60 * 8 && back < 0; i++) { r.step(); if (r.standing().length) back = r.t - killedAt; }
  const d = T(r, "SkelDelayP1");
  if (back < 0) bad.push("no new skeleton after the kill");
  else if (back < d - 0.05 || back > d + 0.2) bad.push("the next one rose " + back.toFixed(2) + " s after the kill, not SkelDelayP1 (" + d + ")");
  return bad;
}]);

tests.push(["Necromancer skeletons: it walks up, raises its sword for SkelWindup (the tell), then cuts: a melee Necro_Hitbox with SkelDamage, deflectable facing it, no posture to the Necromancer; an undeflected cut costs the player health", () => {
  const bad = [], r = fight({ phase: 1, playerX: 300 });
  r.step(60 * 3.5);
  const s = r.standing()[0]; if (!s) return ["no skeleton rose"];
  const startGap = Math.abs(s.x - r.player.x);
  let windupAt = -1, cutAt = -1, cut = null;
  for (let i = 0; i < 60 * 12 && !cut; i++) {
    r.step();
    if (windupAt < 0 && /^Windup/.test(s.getAnimationName())) windupAt = r.t;
    if (r.cuts.length) { cut = r.cuts[0]; cutAt = r.t; }
  }
  if (!cut) return ["it never cut (gap at the start " + Math.round(startGap) + " px)"];
  if (!(Math.abs(s.x - r.player.x) < startGap)) bad.push("it should have walked toward the player");
  if (!s.animLog.has("Walk")) bad.push("it should walk (Walk)");
  if (windupAt < 0) bad.push("no Windup before the cut");
  else if (cutAt - windupAt < T(r, "SkelWindup") - 0.02) bad.push("the cut came " + (cutAt - windupAt).toFixed(2) + " s after the windup, less than SkelWindup");
  const v = n => cut.vars.get(n);
  if (v("Damage").getAsNumber() !== T(r, "SkelDamage")) bad.push("the cut should do SkelDamage");
  if (!v("IsMelee").getAsBoolean() || v("Directional").getAsNumber() !== 1 || v("PostureScale").getAsNumber() !== 0 || v("Kind").getAsString() !== "skeleton") bad.push("the cut: IsMelee, Directional 1, PostureScale 0, Kind skeleton");
  r.step(30);
  if (r.hits !== 1 || r.pv.get("Health").getAsNumber() !== 100 - T(r, "SkelDamage")) bad.push("the undeflected cut should land once for SkelDamage (hits " + r.hits + ", health " + r.pv.get("Health").getAsNumber() + ")");
  if (!r.sc.sounds.some(f => /necro_skel_swing/.test(f)) || !r.sc.sounds.some(f => /necro_skel_rise/.test(f))) bad.push("rise and swing sounds should play");
  return bad;
}]);

tests.push(["Necromancer skeletons: a deflected cut knocks it back (Stagger, pushed away), then it comes again", () => {
  const bad = [], r = fight({ phase: 1, playerX: 300, deflect: true });
  r.step(60 * 3.5);
  const s = r.standing()[0]; if (!s) return ["no skeleton rose"];
  let x0 = null;
  for (let i = 0; i < 60 * 12 && !s.animLog.has("Stagger"); i++) { r.step(); if (r.cuts.length && x0 === null) x0 = s.x; }
  if (!s.animLog.has("Stagger")) return ["a deflected cut should stagger it"];
  r.step(36);
  if (!(Math.abs(s.x - r.player.x) > Math.abs(x0 - r.player.x))) bad.push("the stagger should push it away from the player");
  if (r.pv.get("Health").getAsNumber() !== 100) bad.push("a deflected cut costs no health");
  r.step(60 * 3);
  if (r.cuts.length < 2) bad.push("after the stagger it should come and cut again");
  return bad;
}]);

tests.push(["Necromancer skeletons: the Rekindle, his death and the mercy make them all crumble; none rise while he is stunned or the player is down, and those standing hold still (no cuts); Numpad8 raises one at once", () => {
  const bad = [];
  for (const [what, set] of [["the Rekindle", r => r.bv.get("AIState").setString("Rekindle")], ["his death", r => r.bv.get("AIState").setString("Dead")], ["the mercy", r => { r.sc.__hideBars = true; }]]) {
    const r = fight({ phase: 2, deflect: true }); r.step(60 * 8);
    if (r.standing().length !== 2) { bad.push(what + ": setup should have two standing"); continue; }
    set(r); r.step(60 * 4);
    if (r.skeletons().length) bad.push(what + ": every skeleton should crumble and go");
    if (r.sc.list("Necro_Hitbox").length) bad.push(what + ": no cut may be left behind");
  }
  for (const state of ["Stunned", "Intro", "Idle"]) {
    const r = fight({ phase: 1, state, playerX: 300 }); r.step(60 * 10);
    if (r.skeletons().length) bad.push(state + ": none should rise");
  }
  { const r = fight({ phase: 1, playerX: 300 }); r.step(60 * 3); const s = r.standing()[0];
    if (!s) bad.push("setup: none rose"); else { r.bv.get("AIState").setString("Stunned"); const n = r.cuts.length; r.step(60 * 6); if (r.cuts.length !== n) bad.push("while he is stunned the skeletons should hold still, not cut"); } }
  { const r = fight({ phase: 1 }); r.step(5); r.keys.add("Numpad8"); r.step(2); r.keys.delete("Numpad8"); r.step(2); r.keys.add("Numpad8"); r.step(2);
    if (r.standing().length !== 2) bad.push("Numpad8 should raise one per press (got " + r.standing().length + " from two presses)"); }
  return bad;
}]);

module.exports = tests;
