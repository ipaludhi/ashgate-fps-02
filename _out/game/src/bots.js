
import * as THREE from 'three';
import { TUNE, AI, PALETTE, GRENADES, THROW } from './config.js';
import { state, CALLSIGNS, makeBot, actors, sayRadio } from './state.js';
import { slide, land } from './player.js';
import { fireOne, startReload, throwGrenade, hitBlocked, segmentInSmoke, ammoOf } from './weapon.js';
import { plantBomb, defuseTick, canPlantAt } from './rounds.js';
import { SPAWNS, ROUTES, SITE_ANCHORS } from './map.js';
import { buildNav, waypoint } from './nav.js';
const DEG = Math.PI / 180;
const rnd = (pair) => pair[0] + state.rng() * (pair[1] - pair[0]);
function skin(color, rough, metal, emis) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness: rough, metalness: metal,
    emissive: new THREE.Color(emis || 0x000000), emissiveIntensity: emis ? 1.1 : 0,
  });
}
const TEAMMAT = {
  home: { cloth: skin(0x3a3f43, 0.93, 0.02), vest: skin(0xa0471f, 0.62, 0.15, 0x2a0f04), visor: skin(0x2c2116, 0.22, 0.5, 0x3a1d08), tab: skin(0xd08a3c, 0.5, 0.22, 0x3a1a04) },
  away: { cloth: skin(PALETTE.enemyTint, 0.88, 0.04), vest: skin(0x3d6d7c, 0.62, 0.18, 0x0d2630), visor: skin(0x1d3138, 0.18, 0.45, 0x49d8ff), tab: skin(0x59c7e0, 0.45, 0.26, 0x1d6f88) },
};
const SKINM = skin(0x8d6c52, 0.85, 0.0);
const HELM = skin(0x24282b, 0.45, 0.45);
const BOOT = skin(0x1b1f22, 0.80, 0.10);
const GUNM = skin(0x22262a, 0.45, 0.80);
const POSES = {
  stand: { shoulder: 0.22, elbow: -0.52, squat: 1.00 },
  aim: { shoulder: 1.45, elbow: -1.15, squat: 1.00 },
  crouch: { shoulder: 1.35, elbow: -1.05, squat: 0.74 },
  walk: { shoulder: 0.40, elbow: -0.70, squat: 0.98 },
};
function box(parent, m, x, y, z, w, h, d) {
  const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  p.position.set(x, y, z); p.castShadow = true; p.receiveShadow = true; parent.add(p); return p;
}
function joint(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
}
export function makeOperatorModel(parent, team, id, poseName) {
  const tm = TEAMMAT[team] || TEAMMAT.away;
  const pose = POSES[poseName] || POSES.stand;
  const root = new THREE.Group();
  root.name = id;
  root.scale.y = pose.squat;
  parent.add(root);
  for (const s of [-1, 1]) {
    box(root, BOOT, s * 0.13, 0.05, 0.02, 0.16, 0.10, 0.27);
    box(root, tm.cloth, s * 0.12, 0.31, 0, 0.15, 0.42, 0.16);
    box(root, tm.cloth, s * 0.11, 0.72, 0, 0.17, 0.44, 0.18);
  }
  box(root, tm.cloth, 0, 0.95, 0, 0.34, 0.16, 0.22);
  const chest = joint(root, 0, 1.02, 0);
  box(chest, tm.cloth, 0, 0.22, 0, 0.40, 0.46, 0.24);
  box(chest, tm.vest, 0, 0.24, 0, 0.44, 0.40, 0.28);
  box(chest, tm.tab, 0, 0.31, -0.155, 0.30, 0.07, 0.02);      
  box(chest, tm.vest, 0, 0.38, 0.15, 0.26, 0.14, 0.06);
  box(chest, tm.cloth, 0, -0.07, 0.14, 0.30, 0.16, 0.10);
  const hd = joint(root, 0, 1.52, 0);
  box(hd, SKINM, 0, 0.14, 0, 0.22, 0.24, 0.24);
  box(hd, HELM, 0, 0.26, 0, 0.27, 0.15, 0.29);
  box(hd, HELM, 0, 0.18, 0.13, 0.25, 0.20, 0.05);
  box(hd, tm.visor, 0, 0.12, -0.13, 0.20, 0.10, 0.03);
  const arms = {};
  for (const s of [-1, 1]) {
    const sh = joint(root, s * 0.27, 1.40, 0);
    box(sh, tm.vest, 0, -0.06, 0, 0.17, 0.16, 0.21);
    box(sh, tm.cloth, s * 0.01, -0.20, 0, 0.13, 0.30, 0.15);
    const el = joint(sh, s * 0.01, -0.33, 0);
    box(el, tm.cloth, 0, -0.15, 0, 0.12, 0.28, 0.14);
    box(el, BOOT, 0, -0.32, 0, 0.11, 0.11, 0.13);
    sh.rotation.x = pose.shoulder; el.rotation.x = pose.elbow;
    arms[s < 0 ? 'left' : 'right'] = el;
  }
  const gun = joint(arms.right, 0.04, -0.32, -0.06);
  box(gun, GUNM, 0, -0.02, -0.30, 0.07, 0.09, 0.62);
  box(gun, GUNM, 0, -0.10, -0.22, 0.06, 0.16, 0.10);
  box(gun, GUNM, 0, -0.01, -0.66, 0.05, 0.05, 0.20);
  return { root, chest, hd, arms, pose: poseName };
}
const ATTACK_ROUTES = [ROUTES.westToA, ROUTES.midToA, ROUTES.eastToB, ROUTES.westToA, ROUTES.eastToB];
const ATTACK_SITES = ['A', 'A', 'B', 'A', 'B'];
const DEFEND_HOLDS = [ROUTES.holdA, ROUTES.holdB, ROUTES.holdA, ROUTES.holdB, ROUTES.holdB];
const DEFEND_SITES = ['A', 'B', 'A', 'B', 'B'];
// Posisi tahan tiap bertahan di sepanjang rute tahan situsnya: 0 = ujung luar, 1 = di atas site.
const HOLD_T = [0, 0, 1, 1, 0.5];
// Jalur yang akan dipakai penyerang ke tiap site; bertahan menghadap ke sini saat menahan posisi.
const laneAt = ([x, z]) => ({ x, z });
const SITE_LANE = { A: laneAt(ROUTES.westToA[3]), B: laneAt(ROUTES.eastToB[3]) };
export function buildBots(world) {
  buildNav(world);
  const bots = [];
  const nHome = Math.max(1, TUNE.botCount - 1);
  for (let i = 0; i < nHome; i++) {
    const b = makeBot('home', 'h' + i, CALLSIGNS.home[i]);
    const sp = SPAWNS.home[(i + 1) % SPAWNS.home.length];
    b.x = sp.x; b.z = sp.z; b.yaw = sp.yaw;
    b.ai.route = ATTACK_ROUTES[i % ATTACK_ROUTES.length];
    b.ai.site = ATTACK_SITES[i % ATTACK_SITES.length];
    bots.push(b);
  }
  for (let i = 0; i < TUNE.botCount; i++) {
    const b = makeBot('away', 'a' + i, CALLSIGNS.away[i]);
    const sp = SPAWNS.away[i % SPAWNS.away.length];
    b.x = sp.x; b.z = sp.z; b.yaw = sp.yaw;
    b.ai.route = DEFEND_HOLDS[i % DEFEND_HOLDS.length];
    b.ai.site = DEFEND_SITES[i % DEFEND_SITES.length];
    bots.push(b);
  }
  state.bots = bots;
  state.bombCarrier = state.player.id;      
  return bots;
}
export function bombCarrier() {
  if (state.player.alive && state.player.team === 'home') return state.player;
  for (const b of state.bots) if (b.alive && b.team === 'home') return b;
  return null;
}
let blobTex = null;
function contactBlob() {
  if (!blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
    g.addColorStop(0, 'rgba(0,0,0,0.62)'); g.addColorStop(0.55, 'rgba(0,0,0,0.26)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, fog: true }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.renderOrder = 1;
  return m;
}
export function attachSquad(scene) {
  const root = new THREE.Group();
  root.name = 'squads';
  scene.add(root);
  const list = [];
  for (const b of state.bots) {
    const model = makeOperatorModel(root, b.team, 'bot-' + b.id, b.ai.role === 'defend' ? 'aim' : 'walk');
    model.root.add(contactBlob());
    list.push({ id: b.id, actor: b, root: model.root, model, walkT: list.length * 0.7 });
  }
  return {
    root, list,
    update(dt) {
      for (const e of list) {
        const a = e.actor, m = e.model;
        e.root.visible = a.alive;
        if (!a.alive) continue;
        e.root.position.set(a.x, a.y, a.z);
        e.root.rotation.y = a.yaw;
        e.root.scale.y = (1 - a.crouch * 0.26);
        const moving = Math.hypot(a.vx, a.vz) > 0.6;
        e.walkT += dt * (moving ? 6.2 : 1.5);
        m.chest.scale.y = 1 + Math.sin(e.walkT * 1.4) * 0.02;
        m.hd.rotation.x = Math.max(-0.4, Math.min(0.4, -a.pitch * 0.6));
        const aiming = a.ai.state === 'engage' || a.ai.state === 'defuse' || a.ai.state === 'plant';
        const base = aiming ? POSES.aim.shoulder : POSES.walk.shoulder;
        m.arms.right.rotation.x = base + (aiming ? 0 : Math.sin(e.walkT) * 0.20);
        m.arms.left.rotation.x = (aiming ? POSES.aim.elbow + 0.55 : -0.70 + Math.sin(e.walkT + Math.PI) * 0.22);
      }
    },
  };
}
const EYE = TUNE.botHeadHeight;
export function sees(a, t) {
  const dx = t.x - a.x, dz = t.z - a.z;
  const d = Math.hypot(dx, dz);
  if (d > TUNE.botSightRange) return false;
  const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
  const fovCos = Math.cos((TUNE.botFovDeg * 0.5 + 22) * DEG);
  if (d > 3.5 && (dx * fx + dz * fz) / (d || 1) < fovCos) return false;
  if (hitBlocked(a.x, a.y + EYE, a.z, t.x, t.y + 1.15, t.z)) return false;
  if (segmentInSmoke(a.x, a.z, t.x, t.z)) return false;
  return true;
}
export function pickTarget(a) {
  let best = null, bestD = Infinity;
  for (const o of actors()) {
    if (!o.alive || o.team === a.team) continue;
    const d = Math.hypot(o.x - a.x, o.z - a.z);
    if (d < bestD && sees(a, o)) { bestD = d; best = o; }
  }
  return best;
}
// Putar yaw menuju sudut yang diinginkan dengan laju terbatas; kembalikan sisa selisih (rad).
function turnTo(a, yawWant, dt, rate) {
  let diff = yawWant - a.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.min(Math.abs(diff), rate * dt) * Math.sign(diff);
  a.yaw += step;
  return Math.abs(diff - step);
}
export function aimAt(a, t, dt) {
  const dx = t.x - a.x, dz = t.z - a.z;
  const err = turnTo(a, Math.atan2(-dx, -dz), dt, AI.turnRate * 1.7);
  const dist = Math.hypot(dx, dz) || 1;
  const wantP = Math.atan2((t.y + 1.15) - (a.y + EYE), dist);
  a.pitch += (wantP - a.pitch) * Math.min(1, dt * 7);
  return err;
}
// Saat berjalan tanpa target, hadap ke arah gerak supaya kerucut pandang (sees) searah jalan.
function faceHeading(a, dt) {
  if (Math.hypot(a.vx, a.vz) < 0.8) return;
  turnTo(a, Math.atan2(-a.vx, -a.vz), dt, AI.turnRate);
  a.pitch *= Math.max(0, 1 - dt * 6);
}
export function stepTo(a, gx, gz, dt, colliders, speed) {
  const dx = gx - a.x, dz = gz - a.z;
  const d = Math.hypot(dx, dz);
  if (d > 0.06) {
    const ux = dx / d, uz = dz / d;
    const k = Math.min(1, AI.accel * dt * 0.24);
    a.vx += (ux * speed - a.vx) * k;
    a.vz += (uz * speed - a.vz) * k;
  } else {
    const f = Math.min(1, AI.friction * dt); a.vx -= a.vx * f; a.vz -= a.vz * f;
  }
  slide(a, a.vx * dt, a.vz * dt, colliders, TUNE.botRadius, TUNE.playerHeight);
  a.vy -= TUNE.gravity * dt;
  a.onGround = land(a, a.vy * dt, colliders, TUNE.botRadius);
  if (a.onGround && a.vy < 0) a.vy = 0;
  const g = Math.hypot(a.vx, a.vz);
  a.footPhase = (a.footPhase + dt * (3.4 + g * 0.9)) % (Math.PI * 2);
  return d;
}
function siteAnchor(id) {
  for (const s of SITE_ANCHORS) if (s.id === id) return s;
  return SITE_ANCHORS[0];
}
function holdSpot(a) {
  const r = a.ai.route, t = HOLD_T[+a.id.slice(1) % HOLD_T.length];
  const p = r[0], q = r[r.length - 1];
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
}
// Penyerang menunggu di titik tahap sampai rekan satu site berkumpul (atau batas waktu), baru masuk bersama.
function squadReady(a) {
  const ai = a.ai;
  if (ai.stackT0 == null) ai.stackT0 = state.elapsed;
  if (state.elapsed - ai.stackT0 > AI.stackWait) return true;
  for (const m of state.bots) {
    if (m === a || !m.alive || m.team !== a.team || m.ai.site !== ai.site) continue;
    if (Math.hypot(m.x - a.x, m.z - a.z) > AI.stackRadius) return false;
  }
  return true;
}
function advancePath(a) {
  const p = a.ai.route;
  if (!p || p.length === 0) return null;
  if (a.ai.node >= p.length) return null;
  const n = p[a.ai.node];
  if (Math.hypot(a.x - n[0], a.z - n[1]) < AI.nodeReach) a.ai.node++;
  if (a.ai.node >= p.length) return null;
  const m = p[a.ai.node];
  return [m[0], m[1]];
}
export function chooseGoal(a) {
  const bomb = state.bomb;
  if (bomb && !bomb.exploded) {
    if (a.ai.role === 'defend' || a.team !== bomb.plantedBy) return { x: bomb.x, z: bomb.z, kind: 'bomb', site: bomb.site };
    return { x: bomb.x, z: bomb.z, kind: 'guard', site: bomb.site };
  }
  if (a.ai.role === 'attack') {
    if (state.bombCarrier === a.id) {
      const s = siteAnchor(a.ai.site);
      if (Math.hypot(a.x - s.x, a.z - s.z) < s.r) return { x: s.x, z: s.z, kind: 'plant', site: s.id };
    }
    const n = advancePath(a);
    if (n) {
      if (a.ai.node === a.ai.route.length - 2 && !squadReady(a)) return { x: a.x, z: a.z, kind: 'stack', site: a.ai.site };
      return { x: n[0], z: n[1], kind: 'advance', node: true };
    }
    const s = siteAnchor(a.ai.site);
    return { x: s.x, z: s.z, kind: 'advance', site: s.id };
  }
  const spot = holdSpot(a);
  return { x: spot[0], z: spot[1], kind: 'hold', site: a.ai.site };
}
// Lemparan lob: sudut dari jarak (jangkauan ~ v^2 sin2a / g), dibatasi supaya tidak mentok langit-langit.
function lob(a, d, kind) {
  const v = GRENADES[kind].throwSpeed;
  a.pitch = Math.max(0.15, Math.min(0.78, 0.55 * Math.asin(Math.min(1, d * THROW.gravity / (v * v)))));
  return throwGrenade(a, kind);
}
// Frag ke musuh yang terlihat 7-16 m; cooldown acak supaya tidak spam.
function maybeFrag(a, d, dt) {
  const ai = a.ai;
  ai.nadeCd -= dt;
  if (ai.nadeCd > 0 || d < 7 || d > 16 || a.grenades.ironbloom <= 0) return;
  ai.nadeCd = 6 + state.rng() * 4;
  if (state.rng() < 0.55) lob(a, d, 'ironbloom');
}
// Penyerang yang sudah dekat site melempar smoke ke site sekali per ronde, supaya plant tidak terlihat.
function smokeSite(a, dt, world) {
  const ai = a.ai;
  if (ai.smoked || a.grenades.greyveil <= 0) return false;
  const s = siteAnchor(ai.site), d = Math.hypot(a.x - s.x, a.z - s.z);
  if (d > 11 || d < 5) return false;
  const err = turnTo(a, Math.atan2(-(s.x - a.x), -(s.z - a.z)), dt, AI.turnRate * 1.7);
  stepTo(a, a.x, a.z, dt, world.colliders, 0);
  if (err < 0.1) { lob(a, d, 'greyveil'); ai.smoked = true; }
  return true;
}
// Bot macet (bergerak < 0.35 m dalam 0.8 s padahal belum sampai): lewati node rute, lalu geser menyamping.
function checkStuck(a, goal, dt) {
  const ai = a.ai;
  ai.stuckT += dt;
  if (ai.stuckT < 0.8) return;
  const moved = Math.hypot(a.x - ai.px, a.z - ai.pz);
  ai.px = a.x; ai.pz = a.z; ai.stuckT = 0;
  if (moved >= 0.35 || Math.hypot(goal.x - a.x, goal.z - a.z) < AI.goalReach) return;
  if (goal.node) ai.node++;
  ai.nudgeT = 0.7; ai.nudgeDir = state.rng() < 0.5 ? -1 : 1;
}
function combat(a, t, dt, world) {
  const ai = a.ai;
  const dx = t.x - a.x, dz = t.z - a.z;
  const d = Math.hypot(dx, dz) || 1;
  const px = -dz / d, pz = dx / d;
  ai.strafeT -= dt;
  if (ai.strafeT <= 0) { ai.strafeT = rnd(AI.strafePeriod); ai.strafeDir = state.rng() < 0.5 ? -1 : 1; }
  if (a.hp < AI.coverHealth) {
    ai.state = 'cover';
    ai.holdT -= dt;
    if (ai.holdT <= 0) ai.holdT = rnd(AI.coverHold);
    stepTo(a, a.x - (dx / d) * 4 + px * ai.strafeDir * 2, a.z - (dz / d) * 4 + pz * ai.strafeDir * 2,
      dt, world.colliders, TUNE.runSpeed);
    aimAt(a, t, dt);
    if (ai.holdT > AI.peek * 0.5) return;      
  }
  const push = d > 13 ? 2.6 : d < 5 ? -1.8 : 0;
  stepTo(a, a.x + (dx / d) * push + px * ai.strafeDir * 2.2, a.z + (dz / d) * push + pz * ai.strafeDir * 2.2,
    dt, world.colliders, TUNE.walkSpeed);
  const err = aimAt(a, t, dt);
  ai.state = 'engage';
  maybeFrag(a, d, dt);
  ai.burstT -= dt; ai.burstCd -= dt;
  if (ai.burstCd > 0) return;
  if (ai.burstT <= 0) { ai.burstT = rnd(AI.burst); ai.burstCd = rnd(AI.betweenBurst); return; }
  if (ammoOf(a).mag <= 0) { startReload(a); return; }
  if (err < 0.12) fireOne(a, world);
}
export function stepBots(dt, world) {
  for (const a of state.bots) {
    if (!a.alive) continue;
    const ai = a.ai;
    for (const o of actors()) {
      if (o === a || !o.alive || o.team === a.team || !o.lastShot) continue;
      if (state.elapsed - o.lastShot.t > 0.15) continue;
      if (Math.hypot(o.lastShot.x - a.x, o.lastShot.z - a.z) < TUNE.botHearRange * (o.lastShot.loud || 1)) {
        ai.memory = { x: o.lastShot.x, z: o.lastShot.z, t: state.elapsed };
      }
    }
    const target = pickTarget(a);
    if (target) {
      if (ai.targetId !== target.id) {
        ai.seenT = AI.reactBase;
        sayRadio('ENEMY SPOTTED!', 'alert');
      }
      ai.targetId = target.id;
      ai.lastSeen = { x: target.x, z: target.z };
    }
    if (ai.seenT > -9) ai.seenT -= dt;
    if (!target && ai.seenT < -1.3) ai.targetId = null;
    // Carrier close to site prioritises the plant over a distant gunfight.
    const isCarrier = state.bombCarrier === a.id && !state.bomb;
    let nearSite = false;
    if (isCarrier) {
      const s = siteAnchor(a.ai.site);
      nearSite = Math.hypot(a.x - s.x, a.z - s.z) < s.r + 4;
    }
    if (target && ai.seenT <= 0 && !(nearSite && Math.hypot(target.x - a.x, target.z - a.z) > 9)) {
      combat(a, target, dt, world); continue;
    }
    let goal = chooseGoal(a);
    const heard = ai.memory && state.elapsed - ai.memory.t < AI.hearFade ? ai.memory : null;
    // Penyerang menyelidiki setiap suara; bertahan hanya kalau suara dekat posnya, selain itu cukup menengok.
    const onMyPost = heard && Math.hypot(heard.x - goal.x, heard.z - goal.z) < AI.holdLeash;
    if (!state.bomb && !isCarrier && heard && goal.kind !== 'plant' && (ai.role === 'attack' || onMyPost)) {
      goal = { x: heard.x, z: heard.z, kind: 'investigate' };
    }
    if (state.bomb && state.bomb.fuse < 7.0 && Math.hypot(a.x - state.bomb.x, a.z - state.bomb.z) < 18.0) {
      // BOMB IS ABOUT TO BLOW! RUN AWAY!
      const fleeYaw = Math.atan2(a.z - state.bomb.z, a.x - state.bomb.x);
      goal = { x: a.x + Math.cos(fleeYaw) * 20, z: a.z + Math.sin(fleeYaw) * 20, kind: 'flee' };
      if (!ai.fled) { ai.fled = true; sayRadio('BOMB IS BLOWING! RETREAT!', 'warn'); }
    }
    ai.goal = goal;
    if (goal.kind === 'plant' && canPlantAt(a, world)) { 
      if (ai.state !== 'plant') sayRadio('PLANTING THE CHARGE!', 'n');
      ai.state = 'plant'; plantBomb(a); continue; 
    }
    if (goal.kind === 'bomb' && Math.hypot(a.x - goal.x, a.z - goal.z) < AI.goalReach) {
      if (ai.state !== 'defuse') sayRadio('DEFUSING... COVER ME!', 'warn');
      ai.state = 'defuse'; defuseTick(a, dt); continue;
    }
    if (goal.kind === 'hold' && Math.hypot(a.x - goal.x, a.z - goal.z) < AI.goalReach) {
      // Tahan posisi: diam, hadap ke suara terakhir atau ke jalur serbu, sapu pelan kiri-kanan.
      const lane = heard || SITE_LANE[goal.site];
      const sweep = Math.sin(state.elapsed * 0.5 + (+a.id.slice(1))) * 0.25;
      turnTo(a, Math.atan2(a.x - lane.x, a.z - lane.z) + sweep, dt, AI.turnRate * 0.5);
      stepTo(a, a.x, a.z, dt, world.colliders, 0);
      ai.state = 'hold';
      continue;
    }
    if (goal.kind === 'stack') {
      const s = siteAnchor(goal.site);
      turnTo(a, Math.atan2(-(s.x - a.x), -(s.z - a.z)), dt, AI.turnRate);
      stepTo(a, a.x, a.z, dt, world.colliders, 0);
      ai.state = 'stack';
      continue;
    }
    if (goal.kind === 'guard' && Math.hypot(a.x - goal.x, a.z - goal.z) < 6) {
      const ang = state.elapsed * 0.4 + (a.id.charCodeAt(1) - 48);
      stepTo(a, goal.x + Math.cos(ang) * 3, goal.z + Math.sin(ang) * 3, dt, world.colliders, TUNE.walkSpeed);
      aimAt(a, { x: goal.x + Math.cos(ang + 1.6) * 20, z: goal.z + Math.sin(ang + 1.6) * 20, y: 1.2 }, dt);
      ai.state = 'guard';
      continue;
    }
    ai.state = goal.kind;
    if (goal.kind === 'bomb' && a.grenades.greyveil > 0) {
      const db = Math.hypot(a.x - goal.x, a.z - goal.z);
      if (db > 6 && db < 14) lob(a, db, 'greyveil');   // asap penutup sebelum defuse
    }
    if (goal.kind === 'advance' && smokeSite(a, dt, world)) continue;
    checkStuck(a, goal, dt);
    let gx = goal.x, gz = goal.z;
    if (ai.nudgeT <= 0) { const w = waypoint(a, goal.x, goal.z, state.elapsed); gx = w[0]; gz = w[1]; }
    if (ai.nudgeT > 0) {
      ai.nudgeT -= dt;
      const dx = goal.x - a.x, dz = goal.z - a.z, dl = Math.hypot(dx, dz) || 1;
      gx = a.x + (dx / dl) * 1.5 - (dz / dl) * 3 * ai.nudgeDir;
      gz = a.z + (dz / dl) * 1.5 + (dx / dl) * 3 * ai.nudgeDir;
    }
    stepTo(a, gx, gz, dt, world.colliders, goal.kind === 'bomb' || goal.kind === 'flee' ? TUNE.runSpeed : TUNE.walkSpeed);
    faceHeading(a, dt);
  }
}