// Builds the Fire Knight fight into the project: his object and attack hitbox, the Fire_Knight_Fight scene (a copy of
// the Template_Ruins arena) and his event sheet, Fire_Knight_Boss. Close GDevelop first.
// Usage: node tools/fire_knight/build.js [path to the pack's png/fire_knight folder]
// The pack folder is only needed when assets/Enemies/Fire_Knight is missing frames. Running this again rebuilds the
// scene and the sheet from scratch, so changes made to them in the editor are lost: tune his numbers here (FK_VARS).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const REPO = path.join(__dirname, '..', '..');
const SRC = process.argv[2];
const uuid = () => crypto.randomUUID();
const readJ = (p) => JSON.parse(fs.readFileSync(path.join(REPO, p), 'utf8'));
const writeJ = (p, o) => fs.writeFileSync(path.join(REPO, p), JSON.stringify(o, null, 2).replace(/\n/g, '\r\n') + '\r\n');

// ---------- 1. Sprites ----------
const ANIMS = [
  // [animation, pack folder, frames, time between frames, looping]
  ['FK_idle', '01_idle', 8, 0.1, true],
  ['FK_run', '02_run', 8, 0.07, true],
  ['FK_jump_up', '03_jump_up', 3, 0.08, true],
  ['FK_jump_down', '03_jump_down', 3, 0.08, true],
  ['FK_roll', '04_roll', 8, 0.05, false],
  ['FK_1_atk', '05_1_atk', 11, 0.06, false],
  ['FK_2_atk', '06_2_atk', 19, 0.06, false],
  ['FK_3_atk', '07_3_atk', 28, 0.06, false],
  ['FK_sp_atk', '08_sp_atk', 18, 0.07, false],
  ['FK_defend', '09_defend', 10, 0.06, false],
  ['FK_take_hit', '10_take_hit', 6, 0.07, false],
  ['FK_kneel', '11_death', 5, 0.08, false], // Death frames 1-5 end on the kneel with the sword planted.
  ['FK_death', '11_death', 13, 0.1, false],
  ['FK_air_atk', 'air_atk', 8, 0.06, false],
];
const DEST = 'assets/Enemies/Fire_Knight';
const sub = (folder) => folder.replace(/^\d+_/, '');
const imgOf = (folder, i) => `${DEST}/${sub(folder)}/Fire_Knight_${sub(folder)}_${i}.png`;
const resFiles = [];
for (const [, folder, n] of ANIMS) {
  fs.mkdirSync(path.join(REPO, DEST, sub(folder)), { recursive: true });
  for (let i = 1; i <= n; i++) {
    const rel = imgOf(folder, i);
    if (!fs.existsSync(path.join(REPO, rel))) {
      if (!SRC) throw new Error(rel + ' is missing: pass the pack\'s png/fire_knight folder');
      fs.copyFileSync(path.join(SRC, folder, `${sub(folder)}_${i}.png`), path.join(REPO, rel));
    }
    if (!resFiles.includes(rel)) resFiles.push(rel);
  }
}
const HITBOX_IMG = `${DEST}/fx/hitbox/FK_Hitbox.png`;
fs.mkdirSync(path.join(REPO, DEST, 'fx/hitbox'), { recursive: true });
if (!fs.existsSync(path.join(REPO, HITBOX_IMG)))
  fs.copyFileSync(path.join(REPO, 'assets/Enemies/Leaf_Ranger/fx/hitbox/Ranger_Hitbox.png'), path.join(REPO, HITBOX_IMG));
resFiles.push(HITBOX_IMG);

// ---------- 2. Objects ----------
const MASK = [[{ x: 130, y: 84 }, { x: 158, y: 84 }, { x: 158, y: 126 }, { x: 130, y: 126 }]];
const sprite = (image, mask, origin) => ({
  hasCustomCollisionMask: !!mask, image, points: [],
  originPoint: { name: 'origine', x: origin[0], y: origin[1] },
  centerPoint: { automatic: true, name: 'centre', x: 0, y: 0 },
  customCollisionMask: mask || [],
});
const anim = (name, sprites, t, looping) => ({
  name, useMultipleDirections: false,
  directions: [{ looping, metadata: '{"pskl":{}}', timeBetweenFrames: t, sprites }],
});
const vr = (name, value) => ({
  name, persistentUuid: uuid(),
  type: typeof value === 'boolean' ? 'boolean' : typeof value === 'string' ? 'string' : 'number', value,
});

// Every tunable lives here, so the fight can be balanced from the object's variables.
const FK_VARS = [
  // Combat_Shared contract
  ['Health', 200], ['MaxHealth', 200], ['Lives', 2], ['Posture', 0], ['MaxPosture', 80],
  ['PostureDamage', 20], ['StunDuration', 2.5], ['DeathblowOrbDrop', 190],
  // Posture decay (Combat_Shared, docs/balance.md): after PostureRegenDelay s without a hit, it falls PostureRegenFull
  // a second at full HP down to PostureRegenEmpty at 0 HP. He shrugs posture off fast while healthy, so deflects pay most late.
  ['PostureRegenDelay', 1], ['PostureRegenFull', 4], ['PostureRegenEmpty', 1.5],
  ['IsPostureBroken', false], ['Invulnerable', false], ['WillDodgeHit', false], ['HasDeathAnimation', true],
  ['MeleeDamagesPosture', true], ['DeflectAnySide', 0], ['AimX', -1],
  ['JustHitByPlayer', false], ['JustPostureBroken', false], ['JustRecovered', false], ['JustHitPlayer', false],
  ['JustDodgedHit', false], ['JustLostLife', false], ['JustDied', false], ['JustDeflected', false], ['JustStaggered', false],
  // Life and death holds (in the scene): 0 HP gives a deathblow instead of losing the life outright
  ['LifeHold', 0], ['DeathHold', 0],
  // State machine
  ['AIState', 'Intro'], ['Code', ''], ['Kind', ''], ['Step', 0], ['StateT', 0], ['Facing', -1], ['MoveDir', 0],
  ['FromX', 0], ['TargetX', 0], ['Phase', 1], ['RotIdx', 0], ['CrowdT', 0],
  // Rotation and pacing. Codes: S slash, C combo, E eruption (combo + explosion), F flame wave.
  ['RotP1', 'SCSEF'], ['RotP2', 'CESFEC'], ['ActionDelayP1', 0.8], ['ActionDelayP2', 0.5],
  // Movement and ranges
  ['RunSpeedP1', 260], ['RunSpeedP2', 330], ['AttackRange', 175], ['StopRange', 140], ['TooClose', 110], ['CrowdTime', 0.7],
  ['EscapeCooldown', 4], ['RollSpeed', 650], ['DashMinRange', 420], ['DashCooldownP1', 4], ['DashCooldownP2', 2],
  ['DashSpeed', 1100], ['DashStop', 80], ['ArenaMinX', 110], ['ArenaMaxX', 1170], ['GroundCY', 533],
  // Guard: he blocks every GuardEvery-th swing near him, then counters with a slash
  ['GuardEvery', 3], ['GuardCount', 0], ['GuardCooldown', 2.5],
  // Damage
  ['SlashDamage', 18], ['ComboDamage', 13], ['EruptDamage', 28], ['FlameDamage', 30], ['DashDamage', 20],
  ['OverheatDamage', 40], ['RekindleDamage', 15],
  // Heat
  ['Heat', 0], ['HeatMulP1', 1], ['HeatMulP2', 1.5], ['HeatErupt', 35], ['HeatFlame', 40], ['HeatDash', 10],
  ['VentTime', 2.2], ['VentPostureBonus', 15],
  // Phase change
  ['RekindleTime', 1.8],
];
const fkObject = {
  adaptCollisionMaskAutomatically: false, assetStoreId: '', name: 'Fire_Knight', persistentUuid: uuid(),
  type: 'Sprite', updateIfNotVisible: false,
  variables: FK_VARS.map(([n, v]) => vr(n, v)),
  effects: [],
  behaviors: [{
    isFolded: true, name: 'PlatformerObject', type: 'PlatformBehavior::PlatformerObjectBehavior',
    acceleration: 5000, deceleration: 5000, maxSpeed: 260, ignoreDefaultControls: true, canGoDownFromJumpthru: true,
    canGrabPlatforms: false, canGrabWithoutMoving: true, gravity: 1000, jumpSpeed: 600, jumpSustainTime: 0.2,
    ladderClimbingSpeed: 150, maxFallingSpeed: 700, slopeMaxAngle: 60, useLegacyTrajectory: false,
    useRepeatedJump: false, xGrabTolerance: 10, yGrabOffset: 0,
  }],
  animations: ANIMS.map(([name, folder, n, t, loop]) =>
    anim(name, Array.from({ length: n }, (_, i) => sprite(imgOf(folder, i + 1), MASK, [144, 64])), t, loop)),
};
const hitboxObject = {
  adaptCollisionMaskAutomatically: false, assetStoreId: '', name: 'FK_Hitbox', persistentUuid: uuid(),
  type: 'Sprite', updateIfNotVisible: false,
  variables: [vr('Damage', 0), vr('HasHit', false), vr('IsMelee', false), vr('Life', 0),
    vr('SharedDeflect', 0), vr('Directional', 1), vr('PostureScale', 1)],
  effects: [], behaviors: [],
  animations: [anim('Box', [sprite(HITBOX_IMG, null, [0, 0])], 1, false)],
};

// ---------- 3. Events ----------
const O = 'Fire_Knight', HB = 'FK_Hitbox';
const V = (n) => `${O}.Variable(${n})`;
const I = (type, ...parameters) => ({ type: { value: type }, parameters });
const NOT = (i) => ({ ...i, type: { ...i.type, inverted: true } });
const OR = (...subs) => ({ type: { value: 'BuiltinCommonInstructions::Or' }, parameters: [], subInstructions: subs });
const ev = (conditions, actions, events) => ({
  type: 'BuiltinCommonInstructions::Standard', conditions, actions, ...(events ? { events } : {}),
});
const cm = (comment) => ({
  type: 'BuiltinCommonInstructions::Comment',
  color: { b: 109, g: 230, r: 255, textB: 0, textG: 0, textR: 0 }, comment,
});
const link = (target) => ({ type: 'BuiltinCommonInstructions::Link', include: { includeConfig: 0 }, target });
const q = (s) => `"${s}"`;

// Conditions
const st = (s) => I('StringObjectVariable', O, 'AIState', '=', q(s));
const num = (n, op, v) => I('NumberObjectVariable', O, n, op, String(v));
const flag = (n, v = true) => I('BooleanObjectVariable', O, n, v ? 'True' : 'False', '');
const cmp = (a, op, b) => I('BuiltinCommonInstructions::CompareNumbers', a, op, String(b));
const frame = (op, n) => I('Sprite', O, op, String(n));
const ended = () => I('AnimatableCapability::AnimatableBehavior::HasAnimationEnded', O, 'Animation');
const timer = (t, op, v) => I('CompareObjectTimer', O, q(t), op, String(v));
const key = (k) => I('KeyFromTextJustPressed', '', q(k));
const notDeathblow = () => I('BooleanObjectVariable', 'Player', 'IsDeathblow', 'False', '');
const DIST = `abs(Player.CenterX() - ${O}.CenterX())`;

// Actions
const setN = (n, op, v) => I('SetNumberObjectVariable', O, n, op, String(v));
const setS = (n, v) => I('SetStringObjectVariable', O, n, '=', q(v));
const setB = (n, v) => I('SetBooleanObjectVariable', O, n, v ? 'True' : 'False', '');
const resetT = (t) => I('ResetObjectTimer', O, q(t));
const playAnim = (a, from = 0) => [
  I('AnimatableCapability::AnimatableBehavior::SetName', O, 'Animation', '=', q(a)),
  I('ChangeSprite', O, '=', String(from)),
  I('AnimatableCapability::AnimatableBehavior::PlayAnimation', O, 'Animation'),
];
const pause = () => I('AnimatableCapability::AnimatableBehavior::PauseAnimation', O, 'Animation');
const go = (state, a, from = 0) => [setS('AIState', state), setN('Step', '=', 0), setN('StateT', '=', 0), ...(a ? playAnim(a, from) : [])];
const sound = (file, vol = 80) => I('PlaySound', '', file, '', String(vol), '');
const clearAttacks = () => [I('Delete', HB, ''), setN('Step', '=', 0), I('ActivateBehavior', O, 'PlatformerObject', 'yes')];
const flipX = (yes) => I('FlippableCapability::FlippableBehavior::FlipX', O, 'Flippable', yes ? 'yes' : 'no');
const facePlayer = () => [
  cm('Player on his right: face right.'),
  ev([cmp('Player.CenterX()', '>=', `${O}.CenterX()`)], [setN('Facing', '=', 1), flipX(false)]),
  cm('Player on his left: face left.'),
  ev([cmp('Player.CenterX()', '<', `${O}.CenterX()`)], [setN('Facing', '=', -1), flipX(true)]),
];
const heatMul = `(${V('HeatMulP1')} * (2 - ${V('Phase')}) + ${V('HeatMulP2')} * (${V('Phase')} - 1))`;
const addHeat = (varName) => setN('Heat', '=', `min(100, ${V('Heat')} + ${V(varName)} * ${heatMul})`);
const hitboxVars = (dmgVar, melee, life, directional) => [
  I('SetNumberObjectVariable', HB, 'Damage', '=', V(dmgVar)),
  I('SetBooleanObjectVariable', HB, 'IsMelee', melee ? 'True' : 'False', ''),
  I('SetNumberObjectVariable', HB, 'Life', '=', String(life)),
  I('SetNumberObjectVariable', HB, 'Directional', '=', directional ? '1' : '0'),
  I('SetNumberObjectVariable', HB, 'PostureScale', '=', '1'),
];

// A hidden hitbox from `from` to `to` px in front of his body centre (negative is behind him), and from `top` to
// `bottom` px below his origin. Feet are at +124, the top of his head at about +40. Blasts that reach both sides of
// him are not Directional, so they can be deflected whichever way the player faces.
const hitbox = (from, to, top, bottom, dmgVar, melee, life) => {
  const a = `${O}.CenterX() + ${V('Facing')} * ${from}`, b = `${O}.CenterX() + ${V('Facing')} * ${to}`;
  return [
    I('Create', '', HB, `min(${a}, ${b})`, `${O}.Y() + ${top}`, ''),
    I('Hide', HB),
    I('ScalableCapability::ScalableBehavior::SetX', HB, 'Scale', '=', `abs((${b}) - (${a})) / 8`),
    I('ScalableCapability::ScalableBehavior::SetY', HB, 'Scale', '=', `(${bottom} - ${top}) / 8`),
    ...hitboxVars(dmgVar, melee, life, from >= 0),
  ];
};

// How each move starts. Used by the rotation, the reactions and the debug keys.
const START = {
  S: () => [...go('Slash', 'FK_1_atk')],
  C: () => [...go('Combo', 'FK_2_atk'), setS('Kind', 'C')],
  E: () => [...go('Combo', 'FK_3_atk'), setS('Kind', 'E')],
  F: () => [...go('Flame', 'FK_sp_atk')],
  D: () => [...go('Dash', 'FK_air_atk')],
};
const NAMES = { S: 'Slash', C: 'Combo', E: 'Eruption', F: 'Flame Wave', D: 'Dash Strike' };

const events = [
  cm('Fire_Knight_Boss: the Fire Knight fight. Generated by tools/fire_knight/build.js. The scene links Player_Movement and Combat_Shared before this sheet. ' +
    'A close-range swordsman who chases the player down. He fights with a fixed rotation of attacks per phase (RotP1, RotP2) ' +
    'once he is in range, closes distance with a Dash Strike, and reacts: he guards every GuardEvery-th swing and counters, ' +
    'and backsteps out when crowded. Fire moves fill his Heat. At 100 Heat he Overheats with a blast around him, ' +
    'then vents and takes extra posture damage. Losing his first life starts the Rekindle and phase 2. ' +
    'Frame numbers below are GDevelop frame indexes, starting at 0.'),

  cm('Scene start: set his speed and start his timers. He waits a moment in Intro before fighting.'),
  ev([I('SceneJustBegins', '')], [
    I('PlatformBehavior::MaxSpeed', O, 'PlatformerObject', '=', V('RunSpeedP1')),
    resetT('ActionTimer'), resetT('EscapeTimer'), resetT('DashTimer'), resetT('GuardTimer'),
    ...go('Intro', 'FK_idle'),
  ]),

  cm('His state clock: StateT counts the seconds since the current state or step started.'),
  ev([], [setN('StateT', '+', 'TimeDelta()')]),

  cm('Heat glow: the more Heat, the hotter his colour. Venting cools it back down.'),
  ev([], [I('ChangeColor', O, `"255;" + ToString(round(255 - ${V('Heat')} * 1.1)) + ";" + ToString(round(255 - ${V('Heat')} * 1.9))`)]),

  cm('The player is gone: stand idle.'),
  ev([I('SceneInstancesCount', '', 'Player', '=', '0'), NOT(st('Dead')), NOT(st('Idle'))], [
    ...clearAttacks(), ...go('Idle', 'FK_idle'),
  ]),

  cm('Final death: play the death animation and leave the body on its last frame.'),
  ev([flag('JustDied')], [
    ...clearAttacks(), ...go('Dead', 'FK_death'), setN('Heat', '=', 0),
    I('Hide', 'Enemy_HP_Bar'), I('Hide', 'Enemy_Posture_Bar'),
  ]),
  cm('Safety net: no lives left, but he is not in his death state, so die now.'),
  ev([num('Lives', '<=', 0), NOT(st('Dead'))], [
    ...clearAttacks(), ...go('Dead', 'FK_death'), setN('Heat', '=', 0), setB('Invulnerable', true),
    I('Hide', 'Enemy_HP_Bar'), I('Hide', 'Enemy_Posture_Bar'),
  ]),

  cm('Lost a life: the Rekindle. He drops to one knee, sword planted, for RekindleTime seconds. He CAN be hit here, ' +
    'and every hit comes off his phase 2 HP, so an aggressive player starts phase 2 ahead. His posture is held at 0, so it cannot break. ' +
    'His bars stay up.'),
  ev([flag('JustLostLife'), num('Lives', '>', 0)], [
    ...clearAttacks(), setB('Invulnerable', false), setN('Posture', '=', 0), setB('IsPostureBroken', false),
    setN('Heat', '=', 0), ...go('Rekindle', 'FK_kneel'),
  ]),
  cm('Rekindle: keep posture at 0 while he kneels.'),
  ev([st('Rekindle')], [setN('Posture', '=', 0)]),
  cm('Rekindle: the kneel is over. He rises in a burst of flame. He cannot be hit now.'),
  ev([st('Rekindle'), num('Step', '=', 0), num('StateT', '>=', V('RekindleTime'))], [
    setN('Step', '=', 1), setB('Invulnerable', true), ...playAnim('FK_sp_atk'), sound('assets/Sfx/swing_2_lower.mp3', 90),
  ], facePlayer()),
  cm('Rekindle burst: on frame 12 the flames hit both sides of him, to push the player off.'),
  ev([st('Rekindle'), num('Step', '=', 1), frame('>=', 12)], [
    setN('Step', '=', 2), ...hitbox(-150, 220, -40, 124, 'RekindleDamage', false, 0.3), sound('assets/Sfx/shotgun.mp3', 80),
  ]),
  cm('Rekindle over: phase 2. Faster, a faster rotation, a shorter dash cooldown and Heat that fills faster.'),
  ev([st('Rekindle'), num('Step', '=', 2), ended()], [
    setN('Phase', '=', 2), setN('RotIdx', '=', 0), setB('Invulnerable', false),
    I('PlatformBehavior::MaxSpeed', O, 'PlatformerObject', '=', V('RunSpeedP2')),
    ...go('Neutral', 'FK_idle'), resetT('ActionTimer'), resetT('DashTimer'),
  ]),

  cm('Posture broken: cancel everything and kneel. Combat_Shared runs the stun and the deathblow.'),
  ev([flag('JustPostureBroken')], [
    ...clearAttacks(), setB('Invulnerable', false), ...go('Stunned', 'FK_kneel'),
  ]),
  cm('Stun over: get up and carry on. A deathblow that took a life is handled by the Rekindle above.'),
  ev([flag('JustRecovered'), st('Stunned'), flag('JustLostLife', false), flag('JustDied', false)], [
    ...go('Neutral', 'FK_idle'), resetT('ActionTimer'),
  ]),

  cm('A lunge landed: flinch. His heavy fire moves (Flame Wave, Overheat, the vent and the Rekindle) have super armour and ignore it.'),
  ev([flag('JustStaggered'), flag('IsPostureBroken', false), flag('JustLostLife', false), flag('JustDied', false),
    NOT(st('Flame')), NOT(st('Overheat')), NOT(st('Vent')), NOT(st('Rekindle')), NOT(st('Dead')), NOT(st('Stunned'))], [
    ...clearAttacks(), ...go('Stagger', 'FK_take_hit'),
  ]),
  cm('Flinch over: back to Neutral.'),
  ev([st('Stagger'), ended()], [...go('Neutral', 'FK_idle'), resetT('ActionTimer')]),

  cm('Vent: hits on him while he cools down add VentPostureBonus extra posture. This is the reward for surviving the Overheat.'),
  ev([st('Vent'), flag('JustHitByPlayer')], [setN('Posture', '+', V('VentPostureBonus'))]),

  cm('Guard decision: every GuardEvery-th swing near him, while he is standing in Neutral and the guard is off cooldown, he blocks it. No randomness, so it can be learned.'),
  ev([I('BooleanObjectVariable', 'Player', 'AttackPressed', 'True', ''), I('Distance', O, 'Player', '220', ''), st('Neutral'),
    flag('WillDodgeHit', false), flag('Invulnerable', false), timer('GuardTimer', '>=', V('GuardCooldown'))], [
    setN('GuardCount', '+', 1),
  ], [
    cm('This is the swing he blocks.'),
    ev([num('GuardCount', '>=', V('GuardEvery'))], [setB('WillDodgeHit', true), setN('GuardCount', '=', 0), resetT('GuardTimer')]),
  ]),
  cm('The blocked swing never reached him: forget the block, so it does not catch a later hit.'),
  ev([flag('WillDodgeHit'), timer('GuardTimer', '>=', 0.6)], [setB('WillDodgeHit', false)]),
  cm('Blocked a swing: raise the sword with a spark and a clash, then counter with a slash.'),
  ev([flag('JustDodgedHit')], [
    ...clearAttacks(), ...go('Guard', 'FK_defend', 2), sound('assets/Sfx/sword_clash_01.wav', 85),
    I('Create', '', 'Deflect_Spark', `${O}.CenterX() + ${V('Facing')} * 30`, `${O}.Y() + 70`, ''),
    I('ScalableCapability::ScalableBehavior::SetX', 'Deflect_Spark', 'Scale', '=', '1.5'),
    I('ScalableCapability::ScalableBehavior::SetY', 'Deflect_Spark', 'Scale', '=', '1.5'),
  ], facePlayer()),
  cm('Guard over: the counter slash comes straight away.'),
  ev([st('Guard'), frame('>=', 7)], [...START.S()]),

  cm('Intro: after a moment, start fighting.'),
  ev([st('Intro'), num('StateT', '>=', 1.2)], [...go('Neutral', 'FK_idle'), resetT('ActionTimer')]),

  cm('Neutral: face the player.'),
  ev([st('Neutral')], [], facePlayer()),

  cm('Overheat: at 100 Heat, the next thing he does in Neutral is blow up. The blast hits both sides of him, so roll away or out of it.'),
  ev([st('Neutral'), num('Heat', '>=', 100)], [...go('Overheat', 'FK_sp_atk'), sound('assets/Sfx/swing_2_lower.mp3', 90)]),

  cm('Crowded: count how long the player stays within TooClose.'),
  ev([st('Neutral'), cmp(DIST, '<', V('TooClose'))], [setN('CrowdT', '+', 'TimeDelta()')]),
  cm('Not crowded, or busy: the count starts over.'),
  ev([NOT(st('Neutral'))], [setN('CrowdT', '=', 0)]),
  ev([cmp(DIST, '>=', V('TooClose'))], [setN('CrowdT', '=', 0)]),
  cm('Crowded for CrowdTime seconds: backstep away if there is room behind him, otherwise answer with the Flame Wave.'),
  ev([st('Neutral'), num('CrowdT', '>=', V('CrowdTime')), timer('EscapeTimer', '>=', V('EscapeCooldown'))], [
    resetT('EscapeTimer'), setN('CrowdT', '=', 0),
  ], [
    cm('Room behind him: roll away from the player, facing the way he rolls.'),
    ev([cmp(`${O}.CenterX() - ${V('Facing')} * 260`, '>=', V('ArenaMinX')), cmp(`${O}.CenterX() - ${V('Facing')} * 260`, '<=', V('ArenaMaxX'))], [
      setN('MoveDir', '=', `-${V('Facing')}`), ...go('Backstep', 'FK_roll'),
    ], [
      ev([num('MoveDir', '>', 0)], [flipX(false)]),
      ev([num('MoveDir', '<', 0)], [flipX(true)]),
    ]),
    cm('Cornered: Flame Wave.'),
    ev([st('Neutral')], [...START.F()]),
  ]),

  cm('Neutral, player far away: Dash Strike to close the gap when it is off cooldown. Each phase has its own cooldown.'),
  ev([st('Neutral'), cmp(DIST, '>', V('DashMinRange')), num('Phase', '=', 1), timer('DashTimer', '>=', V('DashCooldownP1'))], [...START.D()]),
  ev([st('Neutral'), cmp(DIST, '>', V('DashMinRange')), num('Phase', '=', 2), timer('DashTimer', '>=', V('DashCooldownP2'))], [...START.D()]),

  cm('Neutral, in range: when the action delay for this phase is over, take the next attack from the rotation.'),
  ev([st('Neutral'), cmp(DIST, '<=', V('AttackRange'))], [], [
    cm('Phase 1: wait ActionDelayP1, then read the next code from RotP1.'),
    ev([num('Phase', '=', 1), timer('ActionTimer', '>=', V('ActionDelayP1'))], [
      I('SetStringObjectVariable', O, 'Code', '=', `SubStr(${O}.VariableString(RotP1), ${V('RotIdx')}, 1)`),
      setN('RotIdx', '=', `mod(${V('RotIdx')} + 1, StrLength(${O}.VariableString(RotP1)))`),
    ]),
    cm('Phase 2: wait ActionDelayP2, then read the next code from RotP2.'),
    ev([num('Phase', '=', 2), timer('ActionTimer', '>=', V('ActionDelayP2'))], [
      I('SetStringObjectVariable', O, 'Code', '=', `SubStr(${O}.VariableString(RotP2), ${V('RotIdx')}, 1)`),
      setN('RotIdx', '=', `mod(${V('RotIdx')} + 1, StrLength(${O}.VariableString(RotP2)))`),
    ]),
    ...['S', 'C', 'E', 'F'].flatMap((c) => [
      cm(`Code ${c}: ${NAMES[c]}.`),
      ev([I('StringObjectVariable', O, 'Code', '=', q(c))], [setS('Code', ''), ...START[c]()]),
    ]),
  ]),

  cm('Neutral, out of reach: run toward the player.'),
  ev([st('Neutral'), cmp(DIST, '>', V('StopRange'))], [
    I('AnimatableCapability::AnimatableBehavior::SetName', O, 'Animation', '=', q('FK_run')),
  ], [
    cm('Player to the right.'),
    ev([num('Facing', '>', 0)], [I('PlatformBehavior::SimulateControl', O, 'PlatformerObject', q('Right'))]),
    cm('Player to the left.'),
    ev([num('Facing', '<', 0)], [I('PlatformBehavior::SimulateControl', O, 'PlatformerObject', q('Left'))]),
  ]),
  cm('Neutral, close enough: stand.'),
  ev([st('Neutral'), cmp(DIST, '<=', V('StopRange'))], [
    I('AnimatableCapability::AnimatableBehavior::SetName', O, 'Animation', '=', q('FK_idle')),
  ]),

  // Slash
  cm('Slash: on frame 4 the blade comes over his head and down in front of him, about 130 px of reach. Melee, so a deflect costs him posture.'),
  ev([st('Slash'), num('Step', '=', 0), frame('>=', 4)], [
    setN('Step', '=', 1), ...hitbox(0, 130, -10, 124, 'SlashDamage', true, 0.18), sound('assets/Sfx/SwordSwing_1.wav', 75),
  ]),
  cm('Slash finished: back to Neutral.'),
  ev([st('Slash'), ended()], [...go('Neutral', 'FK_idle'), resetT('ActionTimer')]),

  // Combo and Eruption
  cm('Combo and Eruption, first hit: the same overhead slash on frame 4.'),
  ev([st('Combo'), num('Step', '=', 0), frame('>=', 4)], [
    setN('Step', '=', 1), ...hitbox(0, 130, -10, 124, 'ComboDamage', true, 0.15), sound('assets/Sfx/SwordSwing_1.wav', 75),
  ]),
  cm('Combo: he steps in during the spin, frames 9 to 13.'),
  ev([st('Combo'), frame('>=', 9), frame('<=', 13)], [
    I('SetX', O, '=', `clamp(${O}.X() + ${V('Facing')} * 150 * TimeDelta(), ${V('ArenaMinX')}, ${V('ArenaMaxX')})`),
  ]),
  cm('Combo, second hit: the spin on frame 11.'),
  ev([st('Combo'), num('Step', '=', 1), frame('>=', 11)], [
    setN('Step', '=', 2), ...hitbox(0, 140, 20, 124, 'ComboDamage', true, 0.15), sound('assets/Sfx/SwordSwing_1.wav', 75),
  ]),
  cm('Combo, third hit: the rising cut on frame 14.'),
  ev([st('Combo'), num('Step', '=', 2), frame('>=', 14)], [
    setN('Step', '=', 3), ...hitbox(0, 145, 20, 124, 'ComboDamage', true, 0.15), sound('assets/Sfx/sword_swing_01.wav', 75),
  ]),
  cm('Eruption: on frame 23 the ground in front of him explodes, from 40 to 205 px away, and his Heat rises. ' +
    'Not melee, so a deflect stops the damage but costs him no posture. Standing right next to him is safe.'),
  ev([st('Combo'), I('StringObjectVariable', O, 'Kind', '=', q('E')), num('Step', '=', 3), frame('>=', 23)], [
    setN('Step', '=', 4), addHeat('HeatErupt'),
    ...hitbox(40, 205, -30, 124, 'EruptDamage', false, 0.25), sound('assets/Sfx/shotgun.mp3', 80),
  ]),
  cm('Combo or Eruption finished: back to Neutral.'),
  ev([st('Combo'), ended()], [...go('Neutral', 'FK_idle'), resetT('ActionTimer')]),

  // Flame Wave
  cm('Flame Wave: frames 0 to 11 are the tell, the flame swinging over his head. On frame 12 it slams down in front of him, up to 210 px away. ' +
    'Not melee. Super armour: a lunge does not flinch him.'),
  ev([st('Flame'), num('Step', '=', 0), frame('>=', 3)], [setN('Step', '=', 1), sound('assets/Sfx/swing_2_lower.mp3', 85)]),
  cm('Flame Wave: the slam.'),
  ev([st('Flame'), num('Step', '=', 1), frame('>=', 12)], [
    setN('Step', '=', 2), addHeat('HeatFlame'),
    ...hitbox(0, 210, -60, 124, 'FlameDamage', false, 0.3), sound('assets/Sfx/shotgun.mp3', 85),
  ]),
  cm('Flame Wave finished: back to Neutral.'),
  ev([st('Flame'), ended()], [...go('Neutral', 'FK_idle'), resetT('ActionTimer')]),

  // Dash Strike
  cm('Dash Strike: frames 0 to 2 are the crouch, facing the player.'),
  ev([st('Dash'), num('Step', '=', 0)], [], facePlayer()),
  cm('Dash Strike: on frame 3 he lunges at the player and stops DashStop px in front of them. ' +
    'One melee hitbox covers the whole path and the thrust past its end.'),
  ev([st('Dash'), num('Step', '=', 0), frame('>=', 3)], [
    setN('Step', '=', 1), addHeat('HeatDash'),
    setN('FromX', '=', `${O}.CenterX()`),
    setN('TargetX', '=', `clamp(Player.CenterX() - ${V('Facing')} * ${V('DashStop')}, ${V('ArenaMinX')}, ${V('ArenaMaxX')})`),
    I('Create', '', HB, `min(${V('FromX')}, ${V('TargetX')} + ${V('Facing')} * 120)`, `${O}.Y() + 40`, ''),
    I('Hide', HB),
    I('ScalableCapability::ScalableBehavior::SetX', HB, 'Scale', '=', `abs(${V('TargetX')} + ${V('Facing')} * 120 - ${V('FromX')}) / 8`),
    I('ScalableCapability::ScalableBehavior::SetY', HB, 'Scale', '=', '(124 - 40) / 8'),
    ...hitboxVars('DashDamage', true, 0.25, true),
    sound('assets/Sfx/dashswoosh.mp3', 80),
  ]),
  cm('Dash Strike: move at DashSpeed until he reaches TargetX.'),
  ev([st('Dash'), num('Step', '=', 1)], [
    I('SetX', O, '=', `clamp(${O}.X() + ${V('Facing')} * ${V('DashSpeed')} * TimeDelta(), ${V('ArenaMinX')}, ${V('ArenaMaxX')})`),
  ], [
    cm('Reached it: stop.'),
    ev([cmp(`${V('Facing')} * (${O}.CenterX() - ${V('TargetX')})`, '>=', 0)], [setN('Step', '=', 2)]),
  ]),
  cm('Dash Strike finished: back to Neutral and start the dash cooldown.'),
  ev([st('Dash'), ended()], [...go('Neutral', 'FK_idle'), resetT('ActionTimer'), resetT('DashTimer')]),

  // Backstep
  cm('Backstep: roll away at RollSpeed for the length of the roll.'),
  ev([st('Backstep')], [
    I('SetX', O, '=', `clamp(${O}.X() + ${V('MoveDir')} * ${V('RollSpeed')} * TimeDelta(), ${V('ArenaMinX')}, ${V('ArenaMaxX')})`),
  ], [
    cm('Roll over. Phase 1: back to Neutral. Phase 2: dash straight back in, an in-and-out attack.'),
    ev([ended()], [], [
      ev([num('Phase', '=', 1)], [...go('Neutral', 'FK_idle'), resetT('ActionTimer')]),
      ev([num('Phase', '=', 2)], [...START.D()]),
      ...facePlayer(),
    ]),
  ]),

  // Overheat and Vent
  cm('Overheat blast: on frame 12 the flames hit both sides of him.'),
  ev([st('Overheat'), num('Step', '=', 0), frame('>=', 12)], [
    setN('Step', '=', 1), ...hitbox(-150, 220, -60, 124, 'OverheatDamage', false, 0.3), sound('assets/Sfx/shotgun.mp3', 95),
  ]),
  cm('Overheat over: vent. He hunches over, frozen on a frame of the hit reaction, for VentTime seconds while his Heat drains.'),
  ev([st('Overheat'), ended()], [...go('Vent', 'FK_take_hit', 3), pause()]),
  cm('Vent: the Heat drains to 0 over VentTime.'),
  ev([st('Vent')], [setN('Heat', '=', `max(0, 100 - 100 * ${V('StateT')} / ${V('VentTime')})`)]),
  cm('Vent over: back to Neutral.'),
  ev([st('Vent'), num('StateT', '>=', V('VentTime'))], [setN('Heat', '=', 0), ...go('Neutral', 'FK_idle'), resetT('ActionTimer')]),

  cm('Hitboxes: count down each one\'s Life and remove it when time is up.'),
  ev([], [I('SetNumberObjectVariable', HB, 'Life', '-', 'TimeDelta()')], [
    cm('Time is up.'),
    ev([I('NumberObjectVariable', HB, 'Life', '<=', '0')], [I('Delete', HB, '')]),
  ]),
];

// Debug keys (numpad), behind Combat_Shared's DEBUG_KEYS switch. Each one starts a move right away.
const idleStates = () => OR(st('Intro'), st('Neutral'), st('Stagger'));
for (const [k, c] of [['Numpad1', 'S'], ['Numpad2', 'C'], ['Numpad3', 'E'], ['Numpad4', 'F'], ['Numpad5', 'D']]) {
  events.push(
    cm(`Debug, ${k}: the ${NAMES[c]}. Remove before release.`),
    ev([key(k), idleStates()], [...clearAttacks(), ...START[c]()], facePlayer()),
  );
}
events.push(
  cm('Debug, Numpad6: the backstep. Remove before release.'),
  ev([key('Numpad6'), idleStates()], [...clearAttacks(), setN('MoveDir', '=', `-${V('Facing')}`), ...go('Backstep', 'FK_roll')], [
    cm('Face the way he rolls.'),
    ev([num('MoveDir', '>', 0)], [flipX(false)]),
    ev([num('MoveDir', '<', 0)], [flipX(true)]),
  ]),
  cm('Debug, Numpad7: fill his Heat, so he Overheats next. Remove before release.'),
  ev([key('Numpad7')], [setN('Heat', '=', 100)]),
  cm('Debug, Numpad8: put him on 1 HP, so the next hit starts the 0 HP kneel. Remove before release.'),
  ev([key('Numpad8')], [setN('Health', '=', 1)]),
  cm('Debug text: his state, phase, Heat and HP.'),
  ev([], [I('TextContainerCapability::TextContainerBehavior::SetValue', 'Debug_UI', 'Text', '=',
    `"FK: " + ${O}.VariableString(AIState) + "  Phase " + ToString(${V('Phase')}) + "  Heat " + ToString(round(${V('Heat')})) + "  HP " + ToString(round(${V('Health')})) + "  Lives " + ToString(${V('Lives')})`)]),
);
writeJ('externalEvents/fire_knight_boss.json', { associatedLayout: 'Fire_Knight_Fight', name: 'Fire_Knight_Boss', events });

// ---------- 4. Scene events: the life and death holds, as in the other fights ----------
const W = 'Fire Knight';
const kneelAt0 = (holdVar) => [
  I('SetNumberObjectVariable', O, 'Health', '=', '0.01'),
  I('SetNumberObjectVariable', O, 'Posture', '=', V('MaxPosture')),
  I('SetBooleanObjectVariable', O, 'IsPostureBroken', 'True', ''),
  I('ResetObjectTimer', O, q('StunTimer')),
  I('SetBooleanObjectVariable', O, 'JustPostureBroken', 'True', ''),
  I('SetNumberObjectVariable', O, holdVar, '=', '1'),
  sound('assets/Sfx/posture_broken.mp3', 80),
  I('Delete', HB, ''),
];
const holdsBefore = [
  cm(`${W} death hold: his HP reached 0 on his last life without a posture break (Combat_Shared just set JustDied). Instead of dying at once, he drops into the kneel, posture-broken at 0.01 HP with the deathblow orb, so the fight ends on a deathblow. JustDied and JustLostLife are both cleared.`),
  ev([flag('JustDied'), num('DeathHold', '=', 0), notDeathblow()], [
    setB('JustDied', false), setB('JustLostLife', false), setN('Lives', '=', 1), ...kneelAt0('DeathHold'),
  ]),
  cm(`${W} death hold: no deathblow came before the stun ran out, so he finishes dying on his own. HP 0 lets Combat_Shared take the last life next frame, and clearing JustRecovered stops his sheet from standing him up.`),
  ev([num('DeathHold', '=', 1), flag('JustRecovered'), notDeathblow()], [
    setB('JustRecovered', false), setN('Health', '=', 0), setN('DeathHold', '=', 2),
  ]),
  cm(`${W} life hold: his HP reached 0 with a life to spare (phase 1). Combat_Shared already took the life (JustLostLife). Instead he gets it back and kneels at 0.01 HP, posture-broken, with the deathblow orb; the deathblow then starts the Rekindle.`),
  ev([flag('JustLostLife'), num('Lives', '>', 0), num('LifeHold', '=', 0), notDeathblow()], [
    setB('JustLostLife', false), setN('Lives', '+', 1), ...kneelAt0('LifeHold'),
  ]),
  cm(`${W} life hold: no deathblow came before the stun ran out, so he loses the life anyway. HP 0 lets Combat_Shared take it next frame, and his sheet's Rekindle then starts phase 2. LifeHold 2 keeps the hold above from catching it again.`),
  ev([num('LifeHold', '=', 1), flag('JustRecovered'), notDeathblow()], [
    setB('JustRecovered', false), setN('Health', '=', 0), setN('LifeHold', '=', 2),
  ]),
  cm(`${W} life hold: the life is gone (to the deathblow or the timeout), so the hold is over.`),
  ev([num('LifeHold', '>=', 1), flag('JustLostLife')], [setN('LifeHold', '=', 0)]),
];
const holdsAfter = [
  cm(`${W} death hold: plain hits cannot land while he kneels, so only the deathblow (which ignores Invulnerable) or the timeout ends him. His sheet's kneel event clears Invulnerable, so this runs after it.`),
  ev([num('DeathHold', '=', 1), flag('IsPostureBroken')], [setB('Invulnerable', true)]),
  cm(`${W} life hold: the same, plain hits cannot land while he kneels at 0 HP, or one would take the life without a deathblow.`),
  ev([num('LifeHold', '=', 1), flag('IsPostureBroken')], [setB('Invulnerable', true)]),
  cm(`${W} death hold: his sheet starts FK_death from frame 0, but he is already kneeling, which is its frame 4. Carry on from there, so he does not pop up and fall again.`),
  ev([num('DeathHold', '>=', 1), num('DeathHold', '<', 3), st('Dead')], [I('ChangeSprite', O, '=', '4'), setN('DeathHold', '=', 3)]),
];

// ---------- 5. Scene: a copy of the Template_Ruins arena with the Fire Knight in it ----------
const scene = readJ('layouts/template_ruins.json');
const leaf = readJ('layouts/leaf_ranger_fight.json');
scene.name = 'Fire_Knight_Fight';
scene.mangledName = 'Fire_95Knight_95Fight';
scene.objects = scene.objects.concat([fkObject, hitboxObject]);
scene.objectsGroups = [
  { name: 'Enemy', objects: [{ name: 'Fire_Knight' }] },
  { name: 'EnemyHitbox', objects: [{ name: 'FK_Hitbox' }] },
];
scene.objectsFolderStructure.children.push({ folderName: 'Fire Knight', children: [{ objectName: 'Fire_Knight' }, { objectName: 'FK_Hitbox' }] });
const start = leaf.instances.find((i) => i.name === 'Leaf_Ranger');
scene.instances = scene.instances.map((i) => ({ ...i, persistentUuid: uuid() }))
  .concat([{ ...start, name: 'Fire_Knight', persistentUuid: uuid(), initialVariables: [] }]);
const tmpl = scene.events.filter((e) => !(e.type === 'BuiltinCommonInstructions::Comment' && e.comment.startsWith('Template:')));
const cs = tmpl.findIndex((e) => e.type === 'BuiltinCommonInstructions::Link' && e.target === 'Combat_Shared');
scene.events = [
  ...tmpl.slice(0, cs + 1),
  ...holdsBefore,
  cm('Scene start: the Fire Knight\'s own music goes here, like the other fights. TODO: add a track to assets/Music and a PlayMusic action.'),
  ...tmpl.slice(cs + 1),
  cm('The Fire Knight, from the Fire_Knight_Boss sheet.'),
  link('Fire_Knight_Boss'),
  ...holdsAfter,
];
writeJ('layouts/fire_knight_fight.json', scene);

// ---------- 6. Register everything in the project ----------
const proj = readJ('Soul Rush.json');
const have = new Set(proj.resources.resources.map((r) => r.name));
for (const f of resFiles) if (!have.has(f)) proj.resources.resources.push({
  file: f, kind: 'image', metadata: JSON.stringify({ localFilePath: f, extension: '.png' }), name: f, smoothed: false, userAdded: false,
});
const addRef = (list, ref) => { if (!list.some((x) => x.referenceTo === ref)) list.push({ __REFERENCE_TO_SPLIT_OBJECT: true, referenceTo: ref }); };
addRef(proj.layouts, '/layouts/fire_knight_fight');
addRef(proj.externalEvents, '/externalEvents/fire_knight_boss');
const addItem = (folder, n) => {
  const i = folder.children.findIndex((c) => c.folderName);
  if (!folder.children.some((c) => c.itemName === n)) folder.children.splice(i < 0 ? folder.children.length : i, 0, { itemName: n });
};
addItem(proj.layoutsFolderStructure, 'Fire_Knight_Fight');
addItem(proj.externalEventsFolderStructure, 'Fire_Knight_Boss');
writeJ('Soul Rush.json', proj);

console.log(`Fire Knight built: ${resFiles.length} images, ${events.length} top-level events in Fire_Knight_Boss.`);
