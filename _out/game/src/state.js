
import { TUNE, ECONOMY, WEAPONS, TEAMS } from './config.js';
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function freshMags() {
  const mags = {};
  for (const key of Object.keys(WEAPONS)) {
    const w = WEAPONS[key];
    mags[key] = { mag: w.mag, reserve: key === 'pipit' ? w.reserve : 0 };
  }
  return mags;
}
export function makeActor(team, id) {
  return {
    id, team, kind: 'actor',
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    yaw: 0, pitch: 0,
    hp: 100, armour: 0, helmet: false, alive: true,
    crouch: 0, onGround: true, eye: TUNE.eyeStand,
    weapon: 'pipit', mags: freshMags(),
    reloadT: 0, fireCd: 0, shots: 0,
    spread: 0, recoilPitch: 0, recoilYaw: 0,
    grenades: { ironbloom: 0, greyveil: 0 },
    kit: false, kills: 0, deaths: 0, spent: 0, earned: 0,
    footAccum: 0, footPhase: 0, hearingMemory: null,
  };
}
export const state = {
  phase: 'menu',            
  phaseTime: 0,
  elapsed: 0,
  simTime: 0,
  shotMode: null,
  seed: 1,
  rng: makeRng(1),
  round: 1,
  score: { home: 0, away: 0 },
  money: { home: ECONOMY.start, away: ECONOMY.start },
  loseStreak: { home: 0, away: 0 },
  roundWinner: null,
  roundReason: '',
  matchWinner: null,
  bomb: null,               
  bombCarrier: null,        
  grenades: [],
  smokes: [],
  tracers: [],
  sparks: [],
  muzzle: [],
  gunSparks: [],            
  wisps: [],
  shells: [],
  decals: [],
  killfeed: [],
  radio: null,              
  toast: null,
  hitmarker: 0,
  hitmarkerKill: false,
  damageFrom: [],
  buyOpen: false,
  paused: false,
  stats: { shots: 0, hits: 0, headshots: 0, kills: 0, deaths: 0 },
  player: makeActor('home', 0),
  bots: [],
  events: [],
};
export function resetActor(actor, team) {
  actor.team = team;
  actor.x = 0; actor.y = 0; actor.z = 0;
  actor.vx = 0; actor.vy = 0; actor.vz = 0;
  actor.hp = 100; actor.armour = 0; actor.helmet = false;
  actor.alive = true; actor.crouch = 0; actor.onGround = true;
  actor.eye = TUNE.eyeStand;
  actor.weapon = 'pipit';
  actor.mags = freshMags();
  actor.reloadT = 0; actor.fireCd = 0; actor.shots = 0;
  actor.spread = 0; actor.recoilPitch = 0; actor.recoilYaw = 0;
  actor.kit = false; actor.footAccum = 0; actor.footPhase = 0;
  actor.hearingMemory = null;
  actor.grenades = { ironbloom: 0, greyveil: 0 };
  return actor;
}
export function resetMatch(world, seed) {
  state.seed = seed >>> 0 || 1;
  state.rng = makeRng(state.seed);
  state.round = 1;
  state.score = { home: 0, away: 0 };
  state.money = { home: ECONOMY.start, away: ECONOMY.start };
  state.loseStreak = { home: 0, away: 0 };
  state.roundWinner = null;
  state.roundReason = '';
  state.matchWinner = null;
  state.killfeed = [];
  state.radio = null;
  state.toast = null;
  state.bomb = null;
  state.grenades = [];
  state.smokes = [];
  state.tracers = [];
  state.sparks = [];
  state.muzzle = [];
  state.gunSparks = [];
  state.wisps = [];
  state.shells = [];
  state.decals = [];
  state.buyOpen = false;
  state.stats = { shots: 0, hits: 0, headshots: 0, kills: 0, deaths: 0 };
  state.elapsed = 0;
  resetActor(state.player, 'home');
  state.player.mags.pipit.reserve = 52;
  return world;
}
export const ATTACK = TEAMS.home.id;
export const DEFEND = TEAMS.away.id;
export function awardMoney(team, amount) {
  state.money[team] = Math.max(0, Math.min(ECONOMY.max, state.money[team] + amount));
}
export function pushKill(killerName, killerTeam, victimName, victimTeam, weaponName, head, wallbang) {
  state.killfeed.push({
    killer: killerName, killerTeam, victim: victimName, victimTeam,
    weapon: weaponName, head: !!head, wall: !!wallbang, t: state.elapsed,
  });
  if (state.killfeed.length > 6) state.killfeed.shift();
}
export function sayRadio(text, tone) {
  state.radio = { text, tone: tone || 'n', time: state.elapsed };
}
export function markHit(kill) {
  state.hitmarker = 0.16;
  state.hitmarkerKill = !!kill;
}
export function noteEvent(kind, detail) {
  state.events.push({ kind, detail, t: state.elapsed });
  if (state.events.length > 64) state.events.shift();
}
export const CALLSIGNS = {
  home: ['PYRE-BRAND', 'PYRE-TINDER', 'PYRE-FLINT', 'PYRE-KILN', 'PYRE-QUENCH'],
  away: ['CINDER-ASH', 'CINDER-LARK', 'CINDER-ROOK', 'CINDER-WARDEN', 'CINDER-SLAG'],
};
function newAi(role) {
  return {
    role,                    
    state: 'advance',        
    route: null, path: null, node: 0,
    stuckT: 0, px: 0, pz: 0, nudgeT: 0, nudgeDir: 1, nadeCd: 2, fled: false,
    goal: null,              
    targetId: null, seenT: 0, lostT: 0,
    memory: null,            
    burstT: 0, burstCd: 0, shotT: 0,
    holdT: 0, strafeT: 0, strafeDir: 1,
    aimError: 0, lookX: 0, lookZ: 0, aimBlend: 0,
    hasBomb: false, planted: false, actionT: 0, defuseKit: false,
    stackT0: null, smoked: false,
  };
}
export function makeBot(team, id, name) {
  const a = makeActor(team, id);
  a.name = name;
  a.ai = newAi(team === ATTACK ? 'attack' : 'defend');
  return a;
}
export function teamAlive(team) {
  let n = 0;
  if (state.player.team === team && state.player.alive) n++;
  for (const b of state.bots) if (b.team === team && b.alive) n++;
  return n;
}
export function actors() { return [state.player, ...state.bots]; }
export function actorById(id) {
  if (state.player.id === id) return state.player;
  for (const b of state.bots) if (b.id === id) return b;
  return null;
}
export function clearTransient() {
  state.bomb = null;
  state.grenades = [];
  state.smokes = [];
  state.tracers = [];
  state.sparks = [];
  state.muzzle = [];
  state.gunSparks = [];
  state.wisps = [];
  state.shells = [];
  state.decals = [];
  state.killfeed = [];
  state.damageFrom = [];
  state.hitmarker = 0;
  state.radio = null;
  state.toast = null;
}
export function reviveAll() {
  clearTransient();
  resetActor(state.player, state.player.team);
  state.player.mags.pipit.reserve = 52;
  for (const b of state.bots) {
    const ai = b.ai;                 
    resetActor(b, b.team);
    b.ai = ai;
    if (ai) {
      ai.state = 'advance'; ai.path = null; ai.node = 0; ai.goal = null;
      ai.stuckT = 0; ai.px = b.x; ai.pz = b.z; ai.nudgeT = 0; ai.nadeCd = 2; ai.fled = false; ai.stackT0 = null; ai.smoked = false;
      ai.targetId = null; ai.seenT = 0; ai.lostT = 0; ai.memory = null;
      ai.burstT = 0; ai.burstCd = 0; ai.shotT = 0; ai.holdT = 0; ai.strafeT = 0;
      ai.aimError = 0; ai.aimBlend = 0; ai.hasBomb = false; ai.planted = false; ai.actionT = 0;
    }
  }
}