
import * as THREE from 'three';
import { TUNE, GAME_TITLE, HUD, WEAPONS, BALLISTICS, ARMOUR, GRENADES, SITES } from './config.js';
import { state, makeRng, actors } from './state.js';
import * as hud from './hud.js';
import * as audio from './audio.js';
import { ROUTES, BOUNDS } from './map.js';
import { buildWorld, buildCharge } from './world.js';
import { buildLighting } from './lighting.js';
import { buildViewmodel } from './viewmodel.js';
import { input, bindInput, consume, clearIntents, stepPlayer, look, syncCamera, bindAction } from './player.js';
import { WeaponFX, fireOne, startReload, stepWeapons, stepGrenades, throwGrenade, cycleWeapon,
  selectSlot, canFire, hitscan, applyDamage, dirFrom, hitBoxes, giveWeapon, bindColliders } from './weapon.js';
import { buildBots, attachSquad, stepBots, aimAt, sees } from './bots.js';
import * as rounds from './rounds.js';
import { paintMaterials } from './materials.js';
import { PostFX } from './post.js';
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = (params.get('seed') | 0) || 1;
const container = document.getElementById('game') || document.body;
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);
renderer.domElement.id = 'viewport';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.06, 900);
const mats = paintMaterials(renderer);
const world = buildWorld(scene, mats);
const charge = buildCharge(scene);                 
const light = buildLighting(scene, mats);
const post = new PostFX(renderer);
scene.add(camera);                                  
const viewmodel = buildViewmodel(camera);
state.rng = makeRng(SEED);
bindColliders(world.colliders);
rounds.bind(world);
const fx = new WeaponFX(scene);
buildBots(world);                                   
const squad = attachSquad(scene);                   
rounds.startMatch(world, SEED);                     
state.paused = true;                                
const SHOTS = {
  firefight: { x: 0.6, y: 1.62, z: 17.4, warm: 21, stage: 'fight', fps: true, ads: true },
  buy: { x: 0, y: 1.62, z: 20.0, look: [2.4, 1.35, 7.6], warm: 3, stage: 'shop', fps: true },
  charge: { x: -21, y: 1.62, z: -19, warm: 12, stage: 'plant', fps: true },   
  push: { x: -10, y: 1.62, z: -8, warm: 15, stage: 'squad', fps: true },
  wide: { x: -27, y: 22, z: 33, look: [3, 0, -6], warm: 20 },
  start: { x: 0, y: 1.62, z: 20, look: [2.4, 1.35, 7.6], fps: true, warm: 3 },
  mid: { x: 2.0, y: 1.62, z: 17, look: [2.4, 1.32, 7.6], fps: true, warm: 6 },
  end: { x: -4.0, y: 1.62, z: 18, look: [-2.0, 1.05, 5.4], fps: true, warm: 6 },
  play: { x: 0, y: 1.62, z: 22, look: [2.8, 1.36, 4.0], fps: true, warm: 21, stage: 'fight' },
  close: { x: 1.4, y: 1.62, z: 13, look: [2.4, 1.30, 7.6], fps: true, warm: 6 },
};
function aim(s) {
  const look = s.look || [s.x, s.y - 0.25, s.z - 8];
  const dx = look[0] - s.x, dy = look[1] - s.y, dz = look[2] - s.z;
  return {
    x: s.x, y: s.y, z: s.z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)),
    fps: !!s.fps, ads: !!s.ads,
  };
}
const shot = SHOT ? (SHOTS[SHOT] || SHOTS.firefight) : null;
let shotAim = null;                                 
let staged = false;                                 
function stageShot() {
  const s = shot;
  advance(s.warm);
  if (s.stage === 'fight' || s.stage === 'plant') ensureLive();
  shotAim = aim(s);
  if (s.stage === 'shop') state.buyOpen = true;
  else if (s.stage === 'plant') plantFrame(s);
  else if (s.stage === 'fight') fightFrame(s);
  else if (s.stage === 'squad') squadFrame(s);
  state.paused = true;                              
  hud.render();
}
function ensureLive() {
  for (let i = 0; i < 40 && state.phase !== 'live'; i++) advance(1);
}
function plantFrame(s) {
  const p = state.player;
  p.alive = true; p.hp = 100; p.armour = 100; p.crouch = 0;
  p.x = -21; p.z = -19; p.y = 0; p.vx = 0; p.vz = 0; p.onGround = true;
  state.bombCarrier = p.id;
  if (!state.bomb && rounds.canPlantAt(p)) rounds.plantBomb(p);
  advance(2.6);                                     
  const b = state.bomb;
  if (!b) return;
  const ox = 0 - b.x, oz = 0 - b.z, od = Math.hypot(ox, oz) || 1;
  const ca = Math.cos(-0.7), sa = Math.sin(-0.7), rx = (ox * ca - oz * sa) / od, rz = (ox * sa + oz * ca) / od;
  p.x = b.x + rx * 4.6; p.z = b.z + rz * 4.6;
  p.y = b.y || 0; p.vx = 0; p.vz = 0; p.onGround = true;
  if (!p.alive) { p.alive = true; p.hp = 42; }
  p.weapon = 'quill'; p.mags.quill = { mag: 17, reserve: 68 }; p.spread = 0; p.fireCd = 0; p.reloadT = 0;
  const tx = b.x - p.x, tz = b.z - p.z, td = Math.hypot(tx, tz) || 1;
  p.yaw = Math.atan2(-tx, -tz);
  p.pitch = Math.atan2((b.y || 0) + 0.45 - (p.y + p.eye), td);      
  shotAim = { x: p.x, y: p.y + p.eye, z: p.z, yaw: p.yaw, pitch: p.pitch, fps: true };
  state.toast = { text: 'CHARGE PLANTED  ·  HOLD THE ANGLE', time: state.elapsed };
  state.radio = { text: 'PYRE-BRAND  ·  charge is down, watch the lane', time: state.elapsed };
}
function ready(a) {
  a.alive = true; a.hp = Math.max(a.hp || 0, 70); a.crouch = 0;
  if (!a.mags[a.weapon]) a.mags[a.weapon] = { mag: 20, reserve: 60 };
  return a;
}
function armed(a) {
  a.mags[a.weapon].mag = Math.max(a.mags[a.weapon].mag, 8);
  a.fireCd = 0; a.reloadT = 0;
  return a;
}
function fightFrame(s) {
  const p = state.player;
  const yard = state.bots.filter((b) => b.alive && b.team === 'away' && b.z > 1 && b.z < 19 && Math.abs(b.x) < 13);
  const A = yard[0] || state.bots.find((b) => b.team === 'away');
  if (!A) return;
  const H = state.bots.find((b) => b.team === 'home' && b !== p) || null;
  ready(A);
  if (H) ready(H);
  let mx, mz;
  if (H) {
    let lx = -A.x, lz = -A.z;                        
    const ld = Math.hypot(lx, lz) || 1; lx /= ld; lz /= ld;   
    const LANE = 6.0;                                  
    H.x = A.x + lx * LANE; H.z = A.z + lz * LANE; H.y = A.y;
    H.vx = 0; H.vz = 0;
    mx = A.x + lx * LANE * 0.5; mz = A.z + lz * LANE * 0.5;
    let ox = -lz, oz = lx;                           
    if ((0 - mx) * ox + (0 - mz) * oz < 0) { ox = -ox; oz = -oz; }
    let spot = null;
    for (let k = 0; k < 11 && !spot; k++) {
      const ang = -1.0 + (k / 10) * 2.0;
      const ux2 = Math.cos(ang) * ox - Math.sin(ang) * oz;
      const uz2 = Math.sin(ang) * ox + Math.cos(ang) * oz;
      p.x = A.x + ux2 * 6.2; p.z = A.z + uz2 * 6.2; p.y = 0;
      p.yaw = Math.atan2(-(A.x - p.x), -(A.z - p.z));
      if (sees(p, A)) spot = { x: p.x, z: p.z };
    }
    if (spot) { p.x = spot.x; p.z = spot.z; }
    else { p.x = mx + ox * 6.2; p.z = mz + oz * 6.2; }
  } else {                                           
    const dx = A.x - s.x, dz = A.z - s.z, d = Math.hypot(dx, dz) || 1;
    mx = A.x; mz = A.z;
    p.x = A.x - (dx / d) * 4.6 - (dz / d) * 1.5;
    p.z = A.z - (dz / d) * 4.6 + (dx / d) * 1.5;
  }
  p.y = 0; p.vx = 0; p.vz = 0; p.onGround = true;
  p.alive = true; p.hp = 100; p.armour = 100; p.crouch = 0; p.weapon = 'quill';
  p.mags.quill = { mag: 24, reserve: 90 }; p.spread = 0; p.fireCd = 0; p.reloadT = 0;
  const tx = A.x - p.x, tz = A.z - p.z, td = Math.hypot(tx, tz) || 1;   
  p.yaw = Math.atan2(-tx, -tz);
  p.pitch = Math.atan2(1.15 - (p.y + p.eye), td);
  shotAim = { x: p.x, y: p.y + p.eye, z: p.z, yaw: p.yaw, pitch: p.pitch, fps: true };
  advance(0.06);                                     
  for (let i = 0; i < 2; i++) {                      
    advance(0.14);
    p.fireCd = 0; p.spread = 0;
    fireOne(p, world);
  }
  armed(A);
  aimAt(A, H || p, 1); A.ai.state = 'engage';
  fireOne(A, world);                                 
  state.tracers = state.tracers.filter((t) => t.own);
  if (H) {
    armed(H);
    aimAt(H, A, 1); H.ai.state = 'engage';
    fireOne(H, world);                               
    if (!H.alive || H.hp < 25) { H.alive = true; H.hp = 60; }
  }
  if (!A.alive || A.hp < 25) { A.alive = true; A.hp = 60; }
  ensureKill();                                      
  if (!p.alive || p.hp < 34) { p.alive = true; p.hp = 34; }
  p.crouch = 0; p.fireCd = 0; p.spread = 0;
  fireOne(p, world);                                 
  state.toast = { text: 'CONTACT  ·  WEST YARD', time: state.elapsed };
}
function ensureKill() {
  if (state.killfeed.length) return;
  const killer = actors().find((a) => a.alive && a.team === 'home');
  const victim = actors().find((a) => a.alive && a.team === 'away');
  if (killer && victim) applyDamage(victim, 500, 'body', killer, 'quill');
}
function squadFrame(s) {
  const p = state.player;
  const A = SITES.find((x) => x.id === 'A') || { x: -21, z: -19 };
  let m = null, bd = Infinity;
  for (const b of state.bots) {
    if (b.team !== 'home' || b === p) continue;
    const d = Math.hypot(b.x - A.x, b.z - A.z);
    if (d < bd) { bd = d; m = b; }
  }
  if (!m) return;
  ready(m);
  const dx = A.x - m.x, dz = A.z - m.z, d = Math.hypot(dx, dz) || 1;
  const ux = dx / d, uz = dz / d;                    
  let ox = -uz, oz = ux;                             
  if ((A.x - m.x) * ox + (A.z - m.z) * oz === 0) { ox = 1; oz = 0; }
  p.x = m.x - ux * 6.0 + ox * 1.7; p.z = m.z - uz * 6.0 + oz * 1.7;
  p.y = 0; p.vx = 0; p.vz = 0; p.onGround = true;
  p.alive = true; p.hp = 100; p.armour = 100; p.crouch = 0; p.weapon = 'quill';
  p.mags.quill = { mag: 22, reserve: 90 }; p.spread = 0; p.fireCd = 0; p.reloadT = 0;
  let E = null, ed = Infinity;
  for (const b of state.bots) {
    if (b.team !== 'away') continue;
    const d2 = Math.abs(Math.hypot(b.x - m.x, b.z - m.z) - 15);
    if (d2 < ed) { ed = d2; E = b; }
  }
  if (E) {
    ready(E);
    E.x = m.x + ux * 15.5; E.z = m.z + uz * 15.5; E.y = m.y || 0;
    E.vx = 0; E.vz = 0;
  }
  const aimX = E ? E.x : A.x, aimZ = E ? E.z : A.z;
  const tx = aimX - p.x, tz = aimZ - p.z, td = Math.hypot(tx, tz) || 1;
  p.yaw = Math.atan2(-tx, -tz);
  p.pitch = Math.atan2(1.15 - (p.y + p.eye), td);
  shotAim = { x: p.x, y: p.y + p.eye, z: p.z, yaw: p.yaw, pitch: p.pitch, fps: true };
  advance(0.42);                                     
  p.fireCd = 0; p.spread = 0;
  fireOne(p, world);                                 
  if (E) {
    armed(E);
    aimAt(E, p, 1); E.ai.state = 'engage';
    fireOne(E, world);                               
    if (!E.alive || E.hp < 25) { E.alive = true; E.hp = 60; }
  }
  ensureKill();
  state.toast = { text: 'PYRE PUSH  ·  A SLAG BASIN', time: state.elapsed };
}
const snd = {
  pShots: 0, bots: new Map(), killT: -1, hurtT: -1, reload: false, bomb: null, lastPip: 99,
  phase: '', radioT: -1, buyOpen: false, nades: 0, stepT: 0,
};
function stepAudio(dt) {
  const p = state.player, dt2 = Math.min(dt, 0.2);
  if (p.shots > snd.pShots) { snd.pShots = p.shots; audio.shot(p.weapon, 0); }
  for (const b of state.bots) {
    const n = snd.bots.get(b.id) || 0;
    if (b.shots > n) { snd.bots.set(b.id, b.shots); audio.shot(b.weapon, Math.hypot(b.x - p.x, b.z - p.z)); }
  }
  if (state.killfeed.length === 0) snd.killT = -1;
  const k = state.killfeed[state.killfeed.length - 1];
  if (k && k.t > snd.killT) { snd.killT = k.t; audio.hit(true); }
  const hurt = state.damageFrom[state.damageFrom.length - 1];
  if (hurt && hurt.t > snd.hurtT) { snd.hurtT = hurt.t; audio.hit(false); }
  const rl = p.reloadT > 0;
  if (rl !== snd.reload) { snd.reload = rl; audio.reload(rl ? 'start' : 'end'); }
  const b = state.bomb;
  if (b && !snd.bomb && !b.exploded) audio.plant();
  if (b && !b.exploded) {
    const left = Math.ceil(b.fuse);
    if (left <= 5 && left !== snd.lastPip) { snd.lastPip = left; audio.fusePip(left); }
  } else if (!b) { snd.lastPip = 99; }
  if (snd.bomb && !b) audio.explosion(0);
  snd.bomb = b;
  const nades = state.nades ? state.nades.length : 0;
  if (nades > snd.nades) {
    snd.nades = nades;
    const g = state.nades[nades - 1];
    audio.throwable(g && g.kind);
  } else snd.nades = nades;
  if (state.radio && state.radio.time > snd.radioT) { snd.radioT = state.radio.time; audio.radio(); }
  if (state.buyOpen !== snd.buyOpen) { snd.buyOpen = state.buyOpen; audio.ui(state.buyOpen); }
  if (state.phase === 'roundend' && snd.phase !== 'roundend') audio.roundCue(state.roundWinner === 'home');
  snd.phase = state.phase;
  const speed = Math.hypot(p.vx, p.vz);
  if (p.alive && p.onGround && speed > 1.1) {
    snd.stepT -= dt2 * (speed > 5 ? 1.45 : 1);
    if (snd.stepT <= 0) { snd.stepT = 0.44; audio.step(speed > 5); }
  } else { snd.stepT = 0.08; }
}
let plantT = 0;
function openBuy() {
  state.buyOpen = !state.buyOpen;
  if (state.buyOpen && document.pointerLockElement) document.exitPointerLock();
}
function handleActions(dt) {
  const p = state.player;
  if (consume('buy')) openBuy();
  if (consume('restart')) doRestart();
  if (state.buyOpen && consume('gear')) selectSlot(p, 3);
  if (consume('reload')) startReload(p);
  if (consume('primary')) selectSlot(p, 1);
  if (consume('secondary')) selectSlot(p, 2);
  if (input.intent.cycle) { cycleWeapon(p, input.intent.cycle); input.intent.cycle = 0; }
  if (consume('frag')) throwGrenade(p, 'ironbloom');
  if (consume('smoke')) throwGrenade(p, 'greyveil');
  if (consume('inspect')) { state.toast = { text: 'CARRYING ' + weaponLabel(p), time: state.elapsed }; }
  const wp = WEAPONS[p.weapon] || WEAPONS.pipit;
  if (input.firing && p.alive && !state.buyOpen && !state.paused) {
    if (wp.auto || input.firePress) fireOne(p, world);
  }
  input.firePress = false;
  if (input.keys.has('KeyE') && rounds.canPlantAt(p)) {
    plantT += dt;
    state.toast = { text: 'ARMING CHARGE ' + Math.min(99, Math.round(plantT / TUNE.plantTime * 100)) + '%', time: state.elapsed };
    if (plantT >= TUNE.plantTime) { rounds.plantBomb(p); plantT = 0; }
  } else plantT = 0;
}
function weaponLabel(p) {
  const wp = WEAPONS[p.weapon] || WEAPONS.pipit;
  const mag = p.mags[p.weapon] || { mag: 0, reserve: 0 };
  return wp.name + ' (' + mag.mag + '/' + mag.reserve + ')';
}
function doRestart() {
  clearIntents();
  state.buyOpen = false;
  state.paused = false;
  plantT = 0;
  rounds.restart(SEED);
}
const FIXED = 1 / TUNE.simHz;                       
let acc = 0, last = 0, prevShots = 0;
function stepSim(dt) {
  state.elapsed += dt;
  state.hitmarker = Math.max(0, state.hitmarker - dt);
  if (state.toast && state.elapsed - state.toast.time > HUD.toastLife) state.toast = null;
  rounds.step(dt);
  stepPlayer(dt, world);
  stepWeapons(dt);
  stepGrenades(dt, world);
  stepBots(dt, world);
}
export function advance(seconds) {
  state.paused = false;
  let t = 0;
  while (t < seconds) { stepSim(FIXED); t += FIXED; }
  return state.elapsed;
}
function stepCharge() {
  const b = state.bomb;
  if (b && !b.exploded) {
    charge.place(b.x, b.y, b.z, b.yaw);
    charge.blink(state.elapsed, b.fuse);
  } else charge.hide();
}
function frame(now) {
  requestAnimationFrame(frame);
  window.__ashgate = window.__ashgate || { frames: 0 };
  window.__ashgate.frames++;
  const dt = Math.min((now - last) / 1000 || 0, 0.1);
  last = now;
  if (shot) {                                       
    if (!staged) { staged = true; stageShot(); }
    if (!shotAim) shotAim = aim(shot);
    camera.position.set(shotAim.x, shotAim.y, shotAim.z);
    camera.rotation.set(shotAim.pitch, shotAim.yaw, 0, 'YXZ');
    squad.update(dt);
    stepCharge();                                    
    viewmodel.update(dt, { moving: false, speed: 0 });
    if (shotAim.ads) viewmodel.setAds(true);
    fx.render();
    hud.render();
    post.render(scene, camera);
    return;
  }
  look();                                           
  handleActions(dt);
  acc += dt;
  let n = 0;
  while (acc >= FIXED && n < TUNE.maxSubSteps) { if (!state.paused) stepSim(FIXED); acc -= FIXED; n++; }
  if (n >= TUNE.maxSubSteps) acc = 0;               
  syncCamera(camera);
  stepCharge();
  if (!state.paused) stepAudio(dt);
  squad.update(dt);
  if (state.player.shots > prevShots) { prevShots = state.player.shots; viewmodel.fire(); }
  const speed = Math.hypot(state.player.vx, state.player.vz);
  viewmodel.update(dt, { moving: speed > 0.7, speed });
  viewmodel.setAds(!!input.ads);
  fx.render();
  hud.render();
  post.render(scene, camera);
}
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize(window.innerWidth, window.innerHeight);
}
function engage() {
  const ov = document.getElementById('overlay');
  if (ov) ov.classList.add('gone');
  state.paused = false;
  audio.unlock();
  if (renderer.domElement.requestPointerLock) renderer.domElement.requestPointerLock();
}
function show(id, on) {
  const e = document.getElementById(id);
  if (e) e.classList.toggle('gone', !on);
}
function boot() {
  document.title = GAME_TITLE;
  hud.mount({ onBuy: (k) => rounds.buy(state.player, k), onRestart: doRestart, world });
  bindInput(renderer.domElement, engage);
  bindAction('buy', openBuy);                       
  bindAction('restart', doRestart);                 
  const wake = () => audio.unlock();                
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);
  if (shot) {
    show('overlay', false);
    show('hud', shot.fps);                          
    if (!shot.fps) { const h = document.getElementById('hud'); if (h) h.setAttribute('hidden', ''); }
  } else {
    show('overlay', true);
  }
  window.addEventListener('resize', onResize);
  onResize();
  window.game = {
    renderer, scene, camera, light, post, viewmodel, fx, squad, mats,
    world, state, rounds, hud, input, actors, player: state.player, audio, charge,
    shots: SHOTS, routes: ROUTES, bounds: BOUNDS, title: GAME_TITLE,
    operators: state.bots.map((b) => ({ id: b.id, name: b.name, team: b.team })),
    setBuy: (v) => { state.buyOpen = !!v; },
    openBuy, shotName: SHOT, stageShot, shotAim: () => shotAim,
    advance, stepSim, fixed: FIXED,
    setPaused: (v) => { state.paused = !!v; },
    restart: (s) => rounds.restart((s | 0) || SEED),
    fire: () => fireOne(state.player, world),
    fireAt: (yaw, pitch) => { state.player.yaw = yaw; state.player.pitch = pitch; return fireOne(state.player, world); },
    buy: (key) => rounds.buy(state.player, key),
    grenade: (kind) => throwGrenade(state.player, kind || 'ironbloom'),
    reload: () => startReload(state.player),
    give: (id) => { const w = WEAPONS[id]; state.player.mags[id] = { mag: w.mag, reserve: w.reserve }; giveWeapon(state.player, id); },
    weaponApi: { fireOne, startReload, canFire, hitscan, applyDamage, hitBoxes, dirFrom, giveWeapon },
    config: { TUNE, WEAPONS, GRENADES, ARMOUR, BALLISTICS },
  };
  requestAnimationFrame((t) => { last = t; frame(t); });
}
boot();