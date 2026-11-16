
export const GAME_TITLE = 'ASHGATE WORKS';
export const PALETTE = {
  skyTop: 0x6e7c80,
  skyHorizon: 0xf5b08a,
  skyGlow: 0xffddaa,
  fog: 0xd8c9a8,
  sun: 0xffd280,
  fill: 0x5a6872,
  ground: 0x6a5a46,      
  ember: 0xff6a1e,
  hazard: 0xe8b216,
  ink: 0xf2ece4,
  slate: 0x3c4650,
  meter: 0x8fe3d0,
  danger: 0xff4433,
  allyTint: 0xd8c9a8,
  enemyTint: 0x9fd8e6,
  rust: 0x8a4a2b,
  concrete: 0x8d8375,
  lampWarm: 0xffcf9a,
};
export const TUNE = {
  gravity: 20.0,
  walkSpeed: 5.6,
  runSpeed: 8.4,
  crouchSpeed: 3.1,
  airAccel: 15.0,
  groundAccel: 62.0,
  friction: 9.0,
  jumpSpeed: 6.4,
  eyeStand: 1.62,
  eyeCrouch: 1.05,
  playerRadius: 0.42,
  playerHeight: 1.78,
  stepUp: 0.55,
  simHz: 120,
  maxSubSteps: 8,
  maxSpreadDeg: 9.0,
  spreadGrowPerShot: 0.55,
  spreadRecover: 3.2,
  spreadMoveFactor: 1.9,
  spreadCrouchFactor: 0.55,
  recoilRecover: 9.5,
  botCount: 5,
  botFovDeg: 104,
  botSightRange: 46,
  botHearRange: 40,
  botReaction: 0.24,
  botHeadHeight: 1.62,
  botRadius: 0.44,
  roundTime: 115,
  freezeTime: 8,
  bombFuse: 40,
  defuseTime: 9.5,
  defuseTimeKit: 5.0,
  plantTime: 3.2,
  buyTime: 8,
  roundsToWin: 7,
  maxRounds: 12,
  pointsPerRound: 12,
};
export const ECONOMY = {
  start: 800,
  max: 16000,
  killReward: 300,
  killRewardShotgun: 900,
  winRound: 3250,
  loseRound: 1600,
  loseStreakStep: 500,
  loseStreakMax: 3400,
  plantBonus: 300,
  defuseBonus: 300,
  surviveBonus: 0,
  objectiveSiteBonus: 800,
};
export const WEAPONS = {
  quill: {
    id: 'quill', name: 'QUILL-4', role: 'Rifle', price: 2700, auto: true,
    damage: 31, headMul: 4.1, legMul: 0.78, armourPierce: 0.72,
    rpm: 620, mag: 30, reserve: 90, reloadTime: 2.35, spread: 0.42, moveSpread: 3.1,
    recoil: 1.05, recoilKick: 0.022, falloffStart: 22, falloffEnd: 60, pellets: 1,
    tracerEvery: 1, loudness: 1.0,
  },
  brazier: {
    id: 'brazier', name: 'BRAZIER-12', role: 'Shotgun', price: 1300, auto: false,
    damage: 13, headMul: 1.6, legMul: 0.85, armourPierce: 0.5,
    rpm: 88, mag: 6, reserve: 30, reloadTime: 2.9, spread: 4.6, moveSpread: 5.4,
    recoil: 3.4, recoilKick: 0.05, falloffStart: 5, falloffEnd: 17, pellets: 9,
    tracerEvery: 3, loudness: 1.35,
  },
  rivet: {
    id: 'rivet', name: 'RIVET-9', role: 'SMG', price: 1500, auto: true,
    damage: 24, headMul: 3.0, legMul: 0.8, armourPierce: 0.62,
    rpm: 830, mag: 25, reserve: 100, reloadTime: 2.1, spread: 0.85, moveSpread: 3.6,
    recoil: 0.85, recoilKick: 0.018, falloffStart: 14, falloffEnd: 40, pellets: 1,
    tracerEvery: 2, loudness: 0.94,
  },
  pipit: {
    id: 'pipit', name: 'PIPIT P9', role: 'Sidearm', price: 420, auto: false,
    damage: 26, headMul: 3.6, legMul: 0.8, armourPierce: 0.58,
    rpm: 300, mag: 13, reserve: 52, reloadTime: 1.75, spread: 0.7, moveSpread: 3.0,
    recoil: 1.3, recoilKick: 0.026, falloffStart: 16, falloffEnd: 45, pellets: 1,
    tracerEvery: 2, loudness: 0.9,
  },
};
export const GRENADES = {
  ironbloom: {
    id: 'ironbloom', name: 'IRONBLOOM', slot: 1, price: 300, fuse: 2.6,
    damage: 118, radius: 8.4, throwSpeed: 15.5, kind: 'frag',
  },
  greyveil: {
    id: 'greyveil', name: 'GREYVEIL', slot: 2, price: 260, fuse: 1.5,
    damage: 0, radius: 7.2, throwSpeed: 14.0, kind: 'smoke', cloudTime: 15.0,
  },
};
export const ARMOUR = { price: 650, helmetPrice: 350, absorb: 0.62 };
export const BUY_LIST = [
  { key: 'quill', label: 'QUILL-4  assault rifle', price: WEAPONS.quill.price, cat: 'primary' },
  { key: 'brazier', label: 'BRAZIER-12  pump shotgun', price: WEAPONS.brazier.price, cat: 'primary' },
  { key: 'rivet', label: 'RIVET-9  machine pistol', price: WEAPONS.rivet.price, cat: 'primary' },
  { key: 'pipit', label: 'PIPIT P9  sidearm', price: WEAPONS.pipit.price, cat: 'secondary' },
  { key: 'ironbloom', label: 'IRONBLOOM  frag grenade', price: GRENADES.ironbloom.price, cat: 'gear' },
  { key: 'greyveil', label: 'GREYVEIL  smoke grenade', price: GRENADES.greyveil.price, cat: 'gear' },
  { key: 'armour', label: 'PLATE CARRIER  armour 100', price: ARMOUR.price, cat: 'gear' },
  { key: 'helmet', label: 'HELMET  stops headshots', price: ARMOUR.helmetPrice, cat: 'gear' },
];
export const ZONES = [
  { id: 'quench', name: 'QUENCH YARD', x: -14, z: -14, r: 12 },
  { id: 'basin', name: 'SLAG BASIN', x: -21, z: -19, r: 10 },
  { id: 'weigh', name: 'WEIGHBRIDGE', x: 0, z: 0, r: 9 },
  { id: 'kiln', name: 'KILN HOUSE', x: 20, z: 18, r: 11 },
  { id: 'coke', name: 'COKE SHED', x: 18, z: -16, r: 9 },
  { id: 'trench', name: 'PIPE TRENCH', x: -17, z: 14, r: 9 },
  { id: 'gantry', name: 'GANTRY WALK', x: 3, z: 9, r: 8 },
  { id: 'forge', name: 'FORGE LINE', x: 6, z: -8, r: 9 },
];
export const SITES = [
  { id: 'A', name: 'SLAG BASIN', x: -21, z: -19, r: 6.0 },
  { id: 'B', name: 'KILN HOUSE', x: 20, z: 18, r: 6.0 },
];
export const TEAMS = {
  home: { id: 'home', name: 'PYRE', side: 'attack', tint: PALETTE.ember, mark: 'orange' },
  away: { id: 'away', name: 'QUENCH', side: 'defend', tint: PALETTE.enemyTint, mark: 'cyan' },
};
export const AI = {
  nodeReach: 1.7,          
  accel: 42.0,             
  friction: 8.0,
  turnRate: 4.6,           
  aimLead: 0.16,           
  aimError: 0.055,         
  aimSettle: 1.9,          
  burst: [0.22, 0.55],     
  betweenBurst: [0.28, 0.9],
  reactBase: 0.24,         
  hearFade: 4.5,           
  coverHealth: 45,         
  coverHold: [1.1, 2.4],   
  strafePeriod: [0.7, 1.5],
  goalReach: 1.6,          
  plantChance: 0.85,       
  peek: 0.5,               
  holdLeash: 20,           // bertahan hanya meninggalkan pos untuk suara sedekat ini (m)
  stackWait: 9,            // batas tunggu penyerang di titik kumpul (s)
  stackRadius: 9,          // rekan satu site harus sedekat ini sebelum masuk (m)
};
export const THROW = {
  gravity: 19.0, bounce: 0.42, friction: 0.55, radius: 0.09, maxBounces: 6, restSpeed: 0.8,
};
export const BALLISTICS = {
  maxRange: 90.0,          
  hitbox: { head: 0.24, torso: 0.44, torsoH: 0.74, legsH: 0.70, width: 0.34 },
  helmetMul: 0.34,         
  armourFloor: 0.15,       
  tracerTime: 0.055,
  tracerLead: 5.0,       
  decalTime: 22.0,         
  decalCap: 48,
  sparkTime: 0.24,
  muzzleTime: 0.06,
};
export const HUD = {
  minimapRange: 34.0,      
  minimapSize: 168,        
  killfeedLife: 5.0,
  radioLife: 3.4,
  toastLife: 2.6,
  hitmarkerLife: 0.16,
  hurtLife: 1.1,           
};