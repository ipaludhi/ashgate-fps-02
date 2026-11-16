const dir = process.argv[2], seed = +process.argv[3] || 1, secs = +process.argv[4] || 600;
const P = (f) => `${dir}/src/${f}`;
const THREE = await import('three');
const { state, makeRng, makeBot, CALLSIGNS } = await import(P('state.js'));
const rounds = await import(P('rounds.js'));
const { buildWorld } = await import(P('world.js'));
const { buildBots, stepBots } = await import(P('bots.js'));
const W = await import(P('weapon.js'));
const { TUNE } = await import(P('config.js'));
const { ROUTES } = await import(P('map.js'));
const mats = new Proxy({}, { get: () => new THREE.MeshBasicMaterial() });
const world = buildWorld(new THREE.Scene(), mats);
state.rng = makeRng(seed);
W.bindColliders(world.colliders); rounds.bind(world); buildBots(world);
// 5 lawan 5: pemain tidak bermain di sim, jadi sisi penyerang diberi bot ke-5 dan pemain dimatikan tiap ronde.
const extra = makeBot('home', 'h4', CALLSIGNS.home[4] || 'EXTRA');
extra.ai.route = ROUTES.eastToB; extra.ai.site = 'B';
state.bots.push(extra);
rounds.startMatch(world, seed);
state.paused = false;
let seenG = new WeakSet();
const dt = 1 / TUNE.simHz;
const stat = { stuckBotSec: 0, liveBotSec: 0, rounds: {}, plants: 0, nades: 0 };
const win = new Map(); let t = 0, wt = 0, lastN = 0;
const seen = new Set();
for (let i = 0; i < secs / dt; i++) {
  state.elapsed += dt;
  if (state.phase === 'live' && state.bombCarrier === state.player.id) state.bombCarrier = 'h0';
  state.player.alive = false;
  rounds.step(dt); W.stepWeapons(dt); W.stepGrenades(dt, world); stepBots(dt, world);
  for (const g of state.grenades) if (!seenG.has(g)) { seenG.add(g); stat.nades++; stat['nade_' + g.kind] = (stat['nade_' + g.kind] || 0) + 1; }
  if (state.bomb && !state.bomb._c) { state.bomb._c = 1; stat.plants++; }
  wt += dt;
  if (wt >= 1) {
    wt = 0;
    for (const b of state.bots) {
      if (!b.alive || state.phase !== 'live') { win.set(b.id, null); continue; }
      const p = win.get(b.id); stat.liveBotSec++;
      const goalFar = b.ai.goal && Math.hypot(b.ai.goal.x - b.x, b.ai.goal.z - b.z) > 2.5;
      if (p && Math.hypot(b.x - p[0], b.z - p[1]) < 0.35 && goalFar && b.ai.state !== 'engage' && b.ai.state !== 'cover') stat.stuckBotSec++;
      win.set(b.id, [b.x, b.z]);
    }
  }
  if (state.roundReason && !seen.has(state.round + state.roundReason)) { seen.add(state.round + state.roundReason); stat.rounds[state.roundReason] = (stat.rounds[state.roundReason] || 0) + 1; }
}
console.log(JSON.stringify({ dir: dir.split('_')[1], seed, simSec: secs, round: state.round, score: state.score, ...stat, stuckPct: +(100 * stat.stuckBotSec / Math.max(1, stat.liveBotSec)).toFixed(1) }));
