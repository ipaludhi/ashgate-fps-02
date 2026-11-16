
import * as THREE from 'three';
import { TUNE, WEAPONS, BALLISTICS, ARMOUR, GRENADES, THROW, ECONOMY } from './config.js';
import { state, actorById, actors, pushKill, markHit, awardMoney, noteEvent } from './state.js';
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const DEG = Math.PI / 180;
export function rayBox(ox, oy, oz, dx, dy, dz, b) {
  let t0 = 0, t1 = Infinity;
  const axis = (o, d, lo, hi) => {
    if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
    let ta = (lo - o) / d, tb = (hi - o) / d;
    if (ta > tb) { const s = ta; ta = tb; tb = s; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    return t0 <= t1;
  };
  if (!axis(ox, dx, b.min.x, b.max.x)) return Infinity;
  if (!axis(oy, dy, b.min.y, b.max.y)) return Infinity;
  if (!axis(oz, dz, b.min.z, b.max.z)) return Infinity;
  return t0;
}
export function dirFrom(yaw, pitch) {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}
export function hitBoxes(a) {
  const feet = a.y;
  const h = TUNE.playerHeight * (1 - a.crouch * 0.30);
  const r = 0.22;
  return [
    { zone: 'head', min: { x: a.x - 0.13, y: feet + h - 0.30, z: a.z - 0.13 }, max: { x: a.x + 0.13, y: feet + h + 0.02, z: a.z + 0.13 } },
    { zone: 'body', min: { x: a.x - r, y: feet + h * 0.44, z: a.z - r }, max: { x: a.x + r, y: feet + h - 0.26, z: a.z + r } },
    { zone: 'legs', min: { x: a.x - r * 0.9, y: feet, z: a.z - r * 0.9 }, max: { x: a.x + r * 0.9, y: feet + h * 0.44, z: a.z + r * 0.9 } },
  ];
}
export function hitscan(ox, oy, oz, dir, shooter, colliders) {
  let best = { dist: BALLISTICS.maxRange, kind: 'none', zone: null, actor: null };
  for (const c of colliders) {
    if (c.tag === 'floor' || c.tag === 'site') continue;
    const t = rayBox(ox, oy, oz, dir.x, dir.y, dir.z, c);
    if (t < best.dist && t > 0.02) best = { dist: t, kind: 'world', zone: null, actor: null };
  }
  for (const a of actors()) {
    if (!a.alive || a === shooter) continue;
    for (const b of hitBoxes(a)) {
      const t = rayBox(ox, oy, oz, dir.x, dir.y, dir.z, b);
      if (t < best.dist && t > 0.02) best = { dist: t, kind: 'actor', zone: b.zone, actor: a };
    }
  }
  best.x = ox + dir.x * best.dist;
  best.y = oy + dir.y * best.dist;
  best.z = oz + dir.z * best.dist;
  if (best.dist >= BALLISTICS.maxRange) best.kind = 'none';
  return best;
}
export function spreadOf(a, wp) {
  const moving = Math.hypot(a.vx, a.vz);
  let s = wp.spread + a.spread + moving * 0.16 * (wp.moveSpread / 4.6);
  s *= 1 - a.crouch * (1 - TUNE.spreadCrouchFactor);
  return Math.min(s, TUNE.maxSpreadDeg) * DEG;
}
export function applyDamage(target, amount, zone, attacker, wname) {
  const wp = weaponOf(wname);
  let dmg = amount;
  if (zone === 'head' && target.helmet) dmg *= BALLISTICS.helmetMul;
  if (zone === 'legs') dmg *= wp.legMul;
  if (zone === 'head') dmg *= wp.headMul;
  if (target.armour > 0) {
    const absorbed = dmg * ARMOUR.absorb * (1 - wp.armourPierce);
    dmg -= absorbed;
    target.armour = Math.max(0, target.armour - absorbed * 0.6);
    dmg = Math.max(dmg, amount * BALLISTICS.armourFloor);
  }
  target.hp -= dmg;
  if (target === state.player && attacker && attacker !== state.player) {
    state.damageFrom.push({ t: state.elapsed, x: attacker.x, z: attacker.z, dmg });
    while (state.damageFrom.length > 6) state.damageFrom.shift();
  }
  const attackerIsPlayer = attacker === state.player;
  if (attackerIsPlayer) { state.stats.hits++; if (zone === 'head') state.stats.headshots++; }
  if (target.hp <= 0 && target.alive) {
    target.alive = false;
    target.deaths++;
    attacker.kills++;
    const reward = wname === 'brazier' ? ECONOMY.killRewardShotgun : ECONOMY.killReward;
    awardMoney(attacker.team, reward);
    if (attackerIsPlayer) { state.stats.kills++; markHit(true); }
    else if (target === state.player) markHit(false);
    pushKill(attacker.name || 'YOU', attacker.team, target.name || 'YOU', target.team, wp.name, zone === 'head', false);
    // Immediate hand-off of the charge if the carrier just died.
    if (state.bombCarrier === target.id) {
      const next = actors().find((a) => a.alive && a.team === 'home' && a !== target);
      state.bombCarrier = next ? next.id : null;
    }
    return { killed: true, dealt: dmg, zone };
  }
  if (attackerIsPlayer) markHit(false);
  return { killed: false, dealt: dmg, zone };
}
export function weaponOf(id) { return WEAPONS[id] || WEAPONS.pipit; }
export function ammoOf(a) { return a.mags[a.weapon] || (a.mags[a.weapon] = { mag: 0, reserve: 0 }); }
export function canFire(a) {
  return a.alive && a.reloadT <= 0 && a.fireCd <= 0 && ammoOf(a).mag > 0;
}
export function fireOne(a, world) {
  const wp = WEAPONS[a.weapon] || WEAPONS.pipit;
  if (!canFire(a)) {
    if (a.alive && a.reloadT <= 0 && ammoOf(a).mag <= 0) startReload(a);
    return null;
  }
  const mag = ammoOf(a);
  mag.mag--; a.shots++; state.stats.shots += a === state.player ? 1 : 0;
  a.fireCd = 60 / wp.rpm;
  a.recoilPitch += wp.recoilKick * 60;
  a.recoilYaw += (state.rng() - 0.5) * wp.recoilKick * 40;
  a.spread = Math.min(TUNE.maxSpreadDeg * 1.4, a.spread + TUNE.spreadGrowPerShot);
  const originY = a.y + a.eye;
  const baseYaw = a.yaw + a.recoilYaw * DEG * 0.5;
  const basePitch = a.pitch + a.recoilPitch * DEG;
  const hit = resolveShot(a, originY, baseYaw, basePitch, wp, world);
  a.lastShot = { t: state.elapsed, x: a.x, y: originY, z: a.z, loud: wp.loudness };
  return hit;
}
const PLAYER_FX = { ahead: 1.42, right: 0.24, drop: 0.10 };
function fxOrigin(a, dir, originY) {
  if (a !== state.player) return { x: a.x + dir.x * 0.3, y: originY + dir.y * 0.3 - 0.02, z: a.z + dir.z * 0.3 };
  const rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw);   
  return {
    x: a.x + dir.x * PLAYER_FX.ahead + rx * PLAYER_FX.right,
    y: originY + dir.y * PLAYER_FX.ahead - PLAYER_FX.drop,
    z: a.z + dir.z * PLAYER_FX.ahead + rz * PLAYER_FX.right,
  };
}
export function resolveShot(a, originY, yaw, pitch, wp, world) {
  const spread = spreadOf(a, wp);
  const r = state.rng;
  const own = a === state.player;
  const muzzle = fxOrigin(a, dirFrom(yaw, pitch), originY);
  const muzzleDist = own ? PLAYER_FX.ahead : 0.3;      
  let mainHit = null;
  for (let p = 0; p < wp.pellets; p++) {
    const sy = yaw + (r() - 0.5) * 2 * spread;
    const sp = pitch + (r() - 0.5) * 2 * spread;
    const dir = dirFrom(sy, sp);
    const ox = a.x + dir.x * 0.3, oy = originY + dir.y * 0.3 - 0.02, oz = a.z + dir.z * 0.3;
    const hit = hitscan(ox, oy, oz, dir, a, world.colliders);
    const fall = clamp01((hit.dist - wp.falloffStart) / Math.max(1, wp.falloffEnd - wp.falloffStart));
    const dmg = wp.damage * (1 - fall * 0.55);
    const tracer = p % wp.tracerEvery === 0 && (!own || hit.dist > muzzleDist);
    if (hit.kind === 'actor') {
      const res = applyDamage(hit.actor, dmg, hit.zone, a, a.weapon);
      mainHit = { kind: 'actor', zone: hit.zone, actor: hit.actor, dist: hit.dist, res };
      if (tracer) pushTracer(muzzle.x, muzzle.y, muzzle.z, hit.x, hit.y, hit.z, own);
      pushSpark(hit.x, hit.y, hit.z, 'blood', own);
    } else if (hit.kind === 'world') {
      pushImpact(hit.x, hit.y, hit.z, dir);
      if (tracer) pushTracer(muzzle.x, muzzle.y, muzzle.z, hit.x, hit.y, hit.z, own);
    } else if (p === 0) {
      pushTracer(muzzle.x, muzzle.y, muzzle.z, muzzle.x + dir.x * BALLISTICS.maxRange, muzzle.y + dir.y * BALLISTICS.maxRange, muzzle.z + dir.z * BALLISTICS.maxRange, own);
    }
  }
  pushMuzzle(muzzle.x, muzzle.y, muzzle.z, a.yaw, own);
  if (own) gunBurst(muzzle.x, muzzle.y, muzzle.z, dirFrom(yaw, pitch), a.yaw);
  return mainHit;
}
export function pushTracer(x0, y0, z0, x1, y1, z1, own) {
  if (own) {
    const k = Math.min(0.9, BALLISTICS.tracerLead / (Math.hypot(x1 - x0, y1 - y0, z1 - z0) || 1));
    x0 += (x1 - x0) * k; y0 += (y1 - y0) * k; z0 += (z1 - z0) * k;
  }
  state.tracers.push({ x0, y0, z0, x1, y1, z1, own: !!own, t: BALLISTICS.tracerTime });
  if (state.tracers.length > 200) state.tracers.shift();
}
export function pushMuzzle(x, y, z, yaw, own) {
  state.muzzle.push({ x, y, z, yaw, own: !!own, t: BALLISTICS.muzzleTime });
  if (state.muzzle.length > 80) state.muzzle.shift();
}
export function pushSpark(x, y, z, kind, own) {
  state.sparks.push({ x, y, z, kind, own: !!own, t: BALLISTICS.sparkTime });
  if (state.sparks.length > 160) state.sparks.shift();
}
export function pushImpact(x, y, z, dir) {
  state.decals.push({ x: x + dir.x * 0.02, y: y + dir.y * 0.02, z: z + dir.z * 0.02, yaw: Math.atan2(dir.x, dir.z), t: BALLISTICS.decalTime });
  if (state.decals.length > BALLISTICS.decalCap) state.decals.shift();
}
let fxSeed = 0x9e3779b9;
const frand = () => { fxSeed = (fxSeed * 1664525 + 1013904223) >>> 0; return fxSeed / 4294967296; };
export function gunBurst(mx, my, mz, dir, yaw) {
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);          
  const n = 8 + Math.floor(frand() * 7);                  
  for (let i = 0; i < n; i++) {
    const fan = (frand() - 0.5) * 0.8;                    
    const fwd = 0.35 + frand() * 1.1;                    
    const sx = dir.x * fwd + rx * fan + (frand() - 0.5) * 0.5;
    const sy = dir.y * fwd + 0.35 + frand() * 0.5;        
    const sz = dir.z * fwd + rz * fan + (frand() - 0.5) * 0.5;
    const l = Math.hypot(sx, sy, sz) || 1, sp = 2.2 + frand() * 3.8;
    const reach = 0.03 + frand() * 0.12;                  
    state.gunSparks.push({
      x: mx + dir.x * 0.05 + (sx / l) * reach, y: my + 0.02 + (sy / l) * reach, z: mz + dir.z * 0.05 + (sz / l) * reach,
      vx: (sx / l) * sp, vy: (sy / l) * sp, vz: (sz / l) * sp,
      t: 0.17 + frand() * 0.11, own: true,
    });
  }
  if (state.gunSparks.length > 90) state.gunSparks.splice(0, state.gunSparks.length - 90);
  state.wisps.push({ x: mx + dir.x * 0.13, y: my + 0.05, z: mz + dir.z * 0.13, vy: 0.9, t: 0.6, life: 0.6 });
  if (state.wisps.length > 8) state.wisps.shift();
  const cs = 1.6 + frand() * 1.4;
  state.shells.push({
    x: mx + rx * 0.06 + dir.x * 0.03, y: my - 0.02, z: mz + rz * 0.06 + dir.z * 0.03,
    vx: rx * cs + dir.x * 0.5 + (frand() - 0.5), vy: 1.5 + frand() * 1.4, vz: rz * cs + dir.z * 0.5 + (frand() - 0.5),
    t: 1.0, spin: 9 + frand() * 9, rest: false, own: true,
  });
  if (state.shells.length > 10) state.shells.shift();
}
const GUN_G = 6.0;
function stepBurst(dt) {
  for (let i = state.gunSparks.length - 1; i >= 0; i--) {
    const s = state.gunSparks[i];
    s.vy -= GUN_G * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    s.t -= dt; if (s.t <= 0) state.gunSparks.splice(i, 1);
  }
  for (let i = state.wisps.length - 1; i >= 0; i--) {
    const w = state.wisps[i];
    w.y += w.vy * dt; w.vy *= 0.93; w.t -= dt; if (w.t <= 0) state.wisps.splice(i, 1);
  }
  for (let i = state.shells.length - 1; i >= 0; i--) {
    const c = state.shells[i];
    c.t -= dt;
    if (!c.rest) {
      c.vy -= 9.0 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      if (c.y <= 0.03) { c.y = 0.03; if (c.vy < 0) c.vy = -c.vy * 0.34; c.vx *= 0.6; c.vz *= 0.6; if (Math.abs(c.vy) < 0.35) c.rest = true; }
    }
    if (c.t <= 0) state.shells.splice(i, 1);
  }
}
export function startReload(a) {
  const wp = weaponOf(a.weapon);
  const mag = ammoOf(a);
  if (!a.alive || a.reloadT > 0 || mag.mag >= wp.mag || mag.reserve <= 0) return false;
  a.reloadT = a.kit ? wp.reloadTime * 0.72 : wp.reloadTime;
  return true;
}
export function finishReload(a) {
  const wp = weaponOf(a.weapon);
  const mag = ammoOf(a);
  const take = Math.min(wp.mag - mag.mag, mag.reserve);
  mag.mag += take; mag.reserve -= take;
}
export function giveWeapon(a, id) {
  const wp = WEAPONS[id];
  if (!wp) return;
  if (!a.mags[id]) a.mags[id] = { mag: wp.mag, reserve: wp.reserve };
  a.weapon = id; a.reloadT = 0; a.fireCd = Math.min(a.fireCd, 0.2);
}
const SLOTS = { 1: ['quill', 'brazier', 'rivet'], 2: ['pipit'], 3: [] };
function owned(a, ids) {
  return ids.filter((id) => a.mags[id] && (a.mags[id].mag > 0 || a.mags[id].reserve > 0));
}
export function selectSlot(a, n) {
  const list = owned(a, SLOTS[n] || []);
  if (list.length) giveWeapon(a, list[0]);
}
export function cycleWeapon(a, dir) {
  const list = owned(a, ['quill', 'brazier', 'rivet', 'pipit']);
  if (list.length < 2) return;
  let i = list.indexOf(a.weapon);
  if (i < 0) i = 0;
  giveWeapon(a, list[(i + (dir >= 0 ? 1 : -1) + list.length) % list.length]);
}
export function stepWeapons(dt) {
  for (const a of actors()) {
    if (a.fireCd > 0) a.fireCd -= dt;
    if (a.reloadT > 0) { a.reloadT -= dt; if (a.reloadT <= 0) { a.reloadT = 0; finishReload(a); } }
    if (a.spread > 0) a.spread = Math.max(0, a.spread - TUNE.spreadRecover * dt);
    const rec = Math.min(1, TUNE.recoilRecover * dt);
    a.recoilPitch -= a.recoilPitch * rec;
    a.recoilYaw -= a.recoilYaw * rec;
  }
  age(state.tracers, dt); age(state.muzzle, dt); age(state.sparks, dt); age(state.decals, dt);
  stepBurst(dt);
}
function age(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) { list[i].t -= dt; if (list[i].t <= 0) list.splice(i, 1); }
}
export function throwGrenade(a, kind) {
  const g = GRENADES[kind];
  if (!g || !a.alive || (a.grenades[kind] | 0) <= 0) return false;
  a.grenades[kind]--;
  const dir = dirFrom(a.yaw, a.pitch);
  const oy = a.y + a.eye - 0.12;
  state.grenades.push({
    kind, x: a.x + dir.x * 0.45, y: oy, z: a.z + dir.z * 0.45,
    vx: dir.x * g.throwSpeed + a.vx * 0.5, vy: dir.y * g.throwSpeed + 3.6, vz: dir.z * g.throwSpeed + a.vz * 0.5,
    fuse: g.fuse, t: 0, team: a.team, ownerId: a.id, bounces: 0, rest: false,
  });
  return true;
}
const R_THROW = THROW.radius;
function throwBounce(g, colliders) {
  for (const c of colliders) {
    if (c.tag === 'floor' || c.tag === 'low') continue;
    if (g.x + R_THROW > c.min.x && g.x - R_THROW < c.max.x &&
        g.y + R_THROW > c.min.y && g.y - R_THROW < c.max.y &&
        g.z + R_THROW > c.min.z && g.z - R_THROW < c.max.z) {
      const px = Math.min(g.x + R_THROW - c.min.x, c.max.x - (g.x - R_THROW));
      const py = Math.min(g.y + R_THROW - c.min.y, c.max.y - (g.y - R_THROW));
      const pz = Math.min(g.z + R_THROW - c.min.z, c.max.z - (g.z - R_THROW));
      const m = Math.min(px, py, pz);
      if (m === px) { g.x += g.x < (c.min.x + c.max.x) / 2 ? -px : px; g.vx = -g.vx * THROW.bounce; }
      else if (m === py) { g.y += g.y < (c.min.y + c.max.y) / 2 ? -py : py; g.vy = -g.vy * THROW.bounce; g.vx *= THROW.friction; g.vz *= THROW.friction; }
      else { g.z += g.z < (c.min.z + c.max.z) / 2 ? -pz : pz; g.vz = -g.vz * THROW.bounce; }
      g.bounces++;
    }
  }
  if (g.y < 0.05) { g.y = 0.05; if (g.vy < 0) g.vy = -g.vy * THROW.bounce; g.vx *= THROW.friction; g.vz *= THROW.friction; }
}
export function stepGrenades(dt, world) {
  for (let i = state.grenades.length - 1; i >= 0; i--) {
    const g = state.grenades[i];
    g.t += dt; g.fuse -= dt;
    if (!g.rest) {
      g.vy -= THROW.gravity * dt;
      g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
      if (g.bounces < THROW.maxBounces) throwBounce(g, world.colliders);
      else if (g.y < 0.05) { g.y = 0.05; g.vx = g.vz = g.vy = 0; g.rest = true; }
      if (Math.hypot(g.vx, g.vy, g.vz) < THROW.restSpeed && g.y <= 0.06) { g.vx = g.vy = g.vz = 0; g.rest = true; }
    }
    if (g.fuse <= 0) { explodeGrenade(g); state.grenades.splice(i, 1); }
  }
  for (let i = state.smokes.length - 1; i >= 0; i--) {
    const s = state.smokes[i]; s.t += dt;
    if (s.t >= s.life) state.smokes.splice(i, 1);
  }
}
export function explodeGrenade(g) {
  const G = GRENADES[g.kind];
  if (!G) return;
  if (G.kind === 'smoke') {
    state.smokes.push({ x: g.x, z: g.z, r: G.radius, t: 0, life: G.cloudTime });
    pushSpark(g.x, g.y + 0.3, g.z, 'smoke');
    noteEvent('smoke-cloud', g.kind);
    return;
  }
  pushSpark(g.x, g.y, g.z, 'blast');
  pushMuzzle(g.x, g.y, g.z, 0);
  noteEvent('blast', g.kind);
  const owner = actorById(g.ownerId) || { name: 'FRAGMENT', team: g.team, kills: 0, x: g.x, y: g.y, z: g.z };
  for (const a of actors()) {
    if (!a.alive) continue;
    const d = Math.hypot(a.x - g.x, a.y + 0.9 - g.y, a.z - g.z);
    if (d > G.radius) continue;
    if (hitBlocked(g.x, g.y, g.z, a.x, a.y + 0.9, a.z)) continue;
    applyDamage(a, G.damage * (1 - d / G.radius), 'body', owner, g.kind);
  }
}
let COLL = [];                 
export function bindColliders(list) { COLL = list || []; }
export function hitBlocked(x0, y0, z0, x1, y1, z1) {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
  const len = Math.hypot(dx, dy, dz) || 1;
  const d = { x: dx / len, y: dy / len, z: dz / len };
  for (const c of COLL) {
    if (c.tag === 'floor' || c.tag === 'site') continue;
    const t = rayBox(x0, y0, z0, d.x, d.y, d.z, c);
    if (t > 0.05 && t < len - 0.05) return true;
  }
  return false;
}
export function segmentInSmoke(x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0;
  const len2 = dx * dx + dz * dz || 1e-6;
  for (const s of state.smokes) {
    let t = ((s.x - x0) * dx + (s.z - z0) * dz) / len2;
    t = clamp01(t);
    if (Math.hypot(x0 + dx * t - s.x, z0 + dz * t - s.z) < s.r * 0.85) return true;
  }
  return false;
}
const basic = (color, opts) => new THREE.MeshBasicMaterial(Object.assign({ color }, opts || {}));
function pool(parent, geo, mat, n, name) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.visible = false; m.frustumCulled = false; m.name = name + i;
    parent.add(m); arr.push(m);
  }
  return arr;
}
const TIP = new THREE.Vector3(), MID = new THREE.Vector3();
function segment(m, x0, y0, z0, x1, y1, z1) {
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.lookAt(TIP.set(x1, y1, z1));
  m.scale.set(1, 1, Math.max(0.02, MID.set(x1, y1, z1).distanceTo(m.position) * 2));
}
export class WeaponFX {
  constructor(scene) {
    this.root = new THREE.Group();
    this.root.name = 'weapon-fx';
    scene.add(this.root);
    const beam = new THREE.BoxGeometry(0.022, 0.022, 1);         
    const bit = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const mark = new THREE.BoxGeometry(0.09, 0.09, 0.012);
    const ball = new THREE.SphereGeometry(0.13, 8, 6);
    const flash = new THREE.SphereGeometry(0.048, 8, 6);         
    const cloud = new THREE.SphereGeometry(1, 12, 10);
    this.tracers = pool(this.root, beam, basic(0xffdc8a, { transparent: true, opacity: 0.34, depthWrite: false }), 40, 'tracer');
    this.sparks = pool(this.root, bit, basic(0xff7a2a), 48, 'spark');
    this.muzzle = pool(this.root, flash, basic(0xffdca6, { transparent: true, opacity: 0.42, depthWrite: false }), 12, 'muzzle');
    this.decals = pool(this.root, mark, basic(0x241a14), 48, 'decal');
    this.bodies = pool(this.root, ball, basic(0x2a2e31), 12, 'grenade');
    this.smoke = pool(this.root, cloud, new THREE.MeshBasicMaterial({
      color: 0xbfc4c7, transparent: true, opacity: 0.0, depthWrite: false,
    }), 6, 'smoke');
    this.gunSparks = pool(this.root, new THREE.BoxGeometry(0.016, 0.016, 0.016),
      basic(0xffb050, { transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }), 90, 'gunspark');
    const wgeo = new THREE.SphereGeometry(0.06, 6, 5);
    this.wisps = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(wgeo, new THREE.MeshBasicMaterial({ color: 0xd8d2c6, transparent: true, opacity: 0.0, depthWrite: false }));
      m.visible = false; m.frustumCulled = false; m.name = 'wisp' + i; this.root.add(m); this.wisps.push(m);
    }
    this.shells = pool(this.root, new THREE.CylinderGeometry(0.008, 0.008, 0.028, 6), basic(0xd9a441), 10, 'shell');
    this.beam = beam; this.bit = bit; this.mark = mark; this.ball = ball; this.cloud = cloud;
  }
  render() {
    const T = state.tracers;
    for (let i = 0; i < this.tracers.length; i++) {
      const m = this.tracers[i], e = T[i];
      if (!e) { m.visible = false; continue; }
      m.visible = true; m.userData.own = !!e.own;
      segment(m, e.x0, e.y0, e.z0, e.x1, e.y1, e.z1);
      const a = Math.min(1, e.t / 0.055);
      m.scale.x = 1.0 + a * 0.6; m.scale.y = m.scale.x;
    }
    const S = state.sparks;
    for (let i = 0; i < this.sparks.length; i++) {
      const m = this.sparks[i], e = S[i];
      if (!e) { m.visible = false; continue; }
      m.visible = true; m.userData.own = !!e.own;
      m.position.set(e.x, e.y, e.z);
      const s = 0.5 + e.t * 3.4; m.scale.setScalar(s);
      m.material = e.kind === 'blood' ? this.bloodMat || (this.bloodMat = basic(0x8a2233)) : m.material;
    }
    const M = state.muzzle;
    for (let i = 0; i < this.muzzle.length; i++) {
      const m = this.muzzle[i], e = M[i];
      if (!e) { m.visible = false; continue; }
      m.visible = true; m.userData.own = !!e.own;
      m.position.set(e.x, e.y, e.z);
      m.scale.setScalar(1.0 + e.t * 4);
    }
    const B = state.gunSparks;
    for (let i = 0; i < this.gunSparks.length; i++) {
      const m = this.gunSparks[i], e = B[i];
      if (!e) { m.visible = false; continue; }
      m.visible = true; m.userData.own = true;
      m.position.set(e.x, e.y, e.z);
      const k = Math.max(0.15, Math.min(1, e.t / 0.17));
      m.scale.setScalar(0.6 + k * 0.7);
      m.rotation.set(e.t * 6, e.t * 5, e.t * 7);
    }
    const W = state.wisps;
    for (let i = 0; i < this.wisps.length; i++) {
      const m = this.wisps[i], e = W[i];
      if (!e) { m.visible = false; continue; }
      m.visible = true; m.userData.own = true;
      m.position.set(e.x, e.y, e.z);
      const k = Math.max(0, Math.min(1, e.t / 0.6));
      m.scale.setScalar(1.3 - k * 0.5);
      m.material.opacity = 0.22 * k;
    }
    const C = state.shells;
    for (let i = 0; i < this.shells.length; i++) {
      const m = this.shells[i], e = C[i];
      if (!e) { m.visible = false; continue; }
      m.visible = true; m.userData.own = true;
      const a2 = 1 - Math.max(0, Math.min(1, e.t));
      m.position.set(e.x, e.y, e.z);
      m.rotation.set(e.spin * a2 * 0.7, e.spin * a2, e.spin * a2 * 0.5);
    }
    const D = state.decals;
    for (let i = 0; i < this.decals.length; i++) {
      const m = this.decals[i], e = D[i];
      if (!e) { m.visible = false; continue; }
      m.visible = true; m.position.set(e.x, e.y, e.z); m.rotation.set(0, e.yaw, 0);
      const fade = Math.min(1, e.t / 2.0); m.scale.setScalar(0.6 + fade * 0.5);
      void fade;
    }
    const G = state.grenades;
    for (let i = 0; i < this.bodies.length; i++) {
      const m = this.bodies[i], e = G[i];
      if (!e) { m.visible = false; continue; }
      m.visible = true; m.position.set(e.x, e.y, e.z);
    }
    const K = state.smokes;
    for (let i = 0; i < this.smoke.length; i++) {
      const m = this.smoke[i], e = K[i];
      if (!e) { m.visible = false; continue; }
      m.visible = true; m.position.set(e.x, 1.5, e.z);
      const grow = Math.min(1, e.t / 1.2) * (1 - Math.max(0, (e.t - (e.life - 3)) / 3));
      const gr = GRENADES.greyveil;
      m.scale.setScalar(gr.radius * (0.5 + grow * 0.6));
      m.material.opacity = 0.62 * Math.max(0.05, grow);
    }
  }
}