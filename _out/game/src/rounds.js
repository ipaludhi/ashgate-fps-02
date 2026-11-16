
import { TUNE, ECONOMY, WEAPONS, GRENADES, ARMOUR, BUY_LIST } from './config.js';
import { state, resetMatch, reviveAll, teamAlive, actors, actorById, awardMoney, pushKill, sayRadio, noteEvent } from './state.js';
import { giveWeapon } from './weapon.js';
import { SITE_ANCHORS, SPAWNS } from './map.js';
let WORLD = null;
let idleT = 0;                                     
export const hooks = { onRoundStart: null, onRoundEnd: null };
export function bind(world) { WORLD = world; }
const roundClock = () => Math.max(0, Math.ceil(state.phaseTime));
export function siteAt(x, z) {
  for (const s of SITE_ANCHORS) if (Math.hypot(x - s.x, z - s.z) < s.r) return s;
  return null;
}
export function startMatch(world, seed) {
  resetMatch(world, seed);
  state.bombCarrier = state.player.id;
  beginRound();
}
function placeAtSpawns() {
  const put = (a, sp) => { a.x = sp.x; a.z = sp.z; a.yaw = sp.yaw; a.pitch = 0; if (a.ai) { a.ai.px = a.x; a.ai.pz = a.z; } };
  put(state.player, SPAWNS.home[0]);
  state.bots.forEach((b, i) => {
    const l = SPAWNS[b.team], k = +b.id.slice(1);
    put(b, l[(b.team === 'home' ? k + 1 : k) % l.length]);
  });
}
function beginRound() {
  reviveAll();
  placeAtSpawns();
  state.phase = 'buy';                             // buy() hanya jalan di fase buy/live
  autoBuy();
  if (hooks.onRoundStart) hooks.onRoundStart();
  state.phaseTime = TUNE.buyTime;
  state.bombCarrier = state.player.id;
  idleT = 0;
  sayRadio('BUY PHASE — ' + TUNE.buyTime + 's', 'n');
  noteEvent('round-start', state.round);
}
export function step(dt) {
  if (state.phase === 'menu' || state.phase === 'matchover') return;
  state.phaseTime -= dt;
  if (state.phase === 'buy') {
    if (state.phaseTime <= 0) { state.phase = 'live'; state.phaseTime = TUNE.roundTime; sayRadio('LIVE', 'n'); }
    return;
  }
  if (state.phase === 'roundend') { if (state.phaseTime <= 0) nextRound(); return; }
  if (state.phase === 'live') liveStep(dt);
}
function liveStep(dt) {
  if (state.bombCarrier != null) {
    const c = actorById(state.bombCarrier);
    if (!c || !c.alive) handBomb();
    else if (c === state.player && !state.bomb) {
      // Carrier manusia yang diam (AFK/ngobrol) tidak boleh mengunci ronde: charge dioper ke bot.
      const sp = Math.hypot(c.vx || 0, c.vz || 0);
      if (sp < 0.7 && c.onGround !== false) {
        idleT += dt;
        if (idleT >= TUNE.bombIdleHandoff) { handBomb(true); idleT = 0; }
      } else idleT = 0;
    }
  }
  if (state.bomb && !state.bomb.exploded) {
    state.bomb.fuse -= dt;
    if (state.bomb.fuse <= 0) {
      state.bomb.exploded = true;
      noteEvent('detonation', state.bomb.site);
      const siteName = (SITE_ANCHORS.find((s) => s.id === state.bomb.site) || { name: state.bomb.site }).name;
      pushKill('CHARGE', 'home', siteName, 'away', 'detonation', false, false);
      return endRound('home', 'detonation');
    }
  }
  if (teamAlive('away') === 0) return endRound('home', 'elimination');
  if (teamAlive('home') === 0) return endRound('away', 'elimination');
  if (state.phaseTime <= 0 && !state.bomb) return endRound('away', 'time');
}
export function endRound(winner, reason) {
  const loser = winner === 'home' ? 'away' : 'home';
  state.roundWinner = winner;
  state.roundReason = reason;
  state.score[winner]++;
  awardMoney(winner, ECONOMY.winRound);
  const bonus = Math.min(ECONOMY.loseStreakMax, ECONOMY.loseRound + state.loseStreak[loser] * ECONOMY.loseStreakStep);
  awardMoney(loser, bonus);
  state.loseStreak[loser]++;
  state.loseStreak[winner] = 0;
  if (state.bomb && state.bomb.plantedBy === winner && reason !== 'detonation') awardMoney(winner, ECONOMY.plantBonus);
  if (hooks.onRoundEnd) hooks.onRoundEnd(winner, reason);
  noteEvent('round-end', winner + ':' + reason);
  sayRadio((winner === 'home' ? 'PYRE' : 'QUENCH') + ' TAKE THE ROUND', 'warn');
  if (state.score[winner] >= TUNE.roundsToWin || state.round >= TUNE.maxRounds) {
    state.matchWinner = state.score.home === state.score.away ? 'draw'
      : (state.score.home > state.score.away ? 'home' : 'away');
    state.phase = 'matchover';
    state.phaseTime = 0;
    noteEvent('match-over', state.matchWinner);
    return;
  }
  state.phase = 'roundend';
  state.phaseTime = 5;
}
function nextRound() {
  state.round++;
  beginRound();
}
export function restart(seed) {
  startMatch(WORLD, (seed >>> 0) || 1);
}
export function handBomb(preferBot) {
  const alive = actors().filter((a) => a.alive && a.team === 'home');
  const pool = preferBot ? alive.filter((a) => a !== state.player) : alive;
  const next = (pool.length ? pool : alive).find((a) => a.alive && a.team === 'home');
  state.bombCarrier = next ? next.id : null;
}
export function autoBuy() {
  const reserve = WEAPONS.quill.price + ARMOUR.price;   // kas tim pemain yang tidak disentuh bot
  for (const b of state.bots) {
    const bank = () => state.money[b.team] - (b.team === state.player.team ? reserve : 0);
    if (bank() >= WEAPONS.quill.price + ARMOUR.price) { buy(b, 'quill'); buy(b, 'armour'); }
    else if (bank() >= WEAPONS.rivet.price + ARMOUR.price) { buy(b, 'rivet'); buy(b, 'armour'); }
    else if (bank() >= WEAPONS.rivet.price) buy(b, 'rivet');
    if (b.ai.role === 'defend' && bank() >= ARMOUR.price && !b.armour) buy(b, 'armour');
    if (bank() >= GRENADES.ironbloom.price && !b.grenades.ironbloom) buy(b, 'ironbloom');
    if (bank() >= GRENADES.greyveil.price && !b.grenades.greyveil) buy(b, 'greyveil');
  }
}
export function canPlantAt(a) {
  if (state.phase !== 'live' || state.bomb || !a.alive) return false;
  if (a.team !== 'home' || state.bombCarrier !== a.id) return false;
  return !!siteAt(a.x, a.z) && a.onGround !== false;
}
export function plantBomb(a) {
  const s = siteAt(a.x, a.z) || SITE_ANCHORS[0];
  state.bomb = {
    x: a.x, y: 0.06, z: a.z, fuse: TUNE.bombFuse, plantedBy: a.team,
    site: s.id, defuseT: 0, defuser: null, exploded: false,
  };
  state.bombCarrier = null;
  noteEvent('plant', s.id);
  sayRadio('CHARGE PLANTED — ' + s.name, 'warn');
}
export function defuseTick(a, dt) {
  const b = state.bomb;
  if (!b || b.exploded || state.phase !== 'live' || !a.alive || a.team !== 'away') return;
  if (Math.hypot(a.x - b.x, a.z - b.z) > 1.9) return;
  b.defuser = a.id;
  b.defuseT += dt;
  const need = a.kit ? TUNE.defuseTimeKit : TUNE.defuseTime;
  if (b.defuseT >= need) { noteEvent('defuse', a.name); endRound('away', 'defuse'); }
}
export function clockText() {
  if (state.bomb && !state.bomb.exploded) {
    const f = Math.max(0, state.bomb.fuse);
    return Math.floor(f / 60) + ':' + (f % 60).toFixed(1).padStart(4, '0');
  }
  if (state.phase === 'buy') return 'BUY   ' + roundClock();
  if (state.phase === 'roundend') return 'NEXT  ' + roundClock();
  const t = roundClock();
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}
export function buy(actor, key) {
  if (state.phase !== 'buy' && state.phase !== 'live') return false;
  const item = BUY_LIST.find((i) => i.key === key);
  if (!item || state.money[actor.team] < item.price) return false;
  if (!applyBuy(actor, key)) return false;
  state.money[actor.team] -= item.price;
  actor.spent += item.price;
  return true;
}
function applyBuy(a, key) {
  if (WEAPONS[key]) {
    const w = WEAPONS[key];
    a.mags[key] = { mag: w.mag, reserve: w.reserve };
    giveWeapon(a, key);
    return true;
  }
  if (GRENADES[key]) { a.grenades[key] = Math.min(2, (a.grenades[key] | 0) + 1); return true; }
  if (key === 'armour') { a.armour = 100; return true; }
  if (key === 'helmet') { a.helmet = true; return true; }
  return false;
}