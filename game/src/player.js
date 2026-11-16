
import { TUNE } from './config.js';
import { state } from './state.js';
export const SENS = 0.0022;                 
const KEY_INTENT = {
  reload: ['KeyR'],
  buy: ['KeyB', 'Escape'],
  frag: ['KeyG'],
  smoke: ['KeyH'],
  primary: ['Digit1'],
  secondary: ['Digit2'],
  gear: ['Digit3'],
  use: ['KeyE'],
  drop: ['KeyF'],
  restart: ['Enter'],
  inspect: ['KeyV'],
};
export const input = {
  keys: new Set(),
  intent: Object.create(null),
  lookX: 0, lookY: 0,          
  firing: false, firePress: false,
  ads: false,
  locked: false,
  started: false,             
};
export function consume(name) {
  if (input.intent[name]) { input.intent[name] = false; return true; }
  return false;
}
export const actions = Object.create(null);
export function bindAction(name, fn) { actions[name] = fn; }
export function clearIntents() { input.intent = Object.create(null); input.firing = false; input.firePress = false; }
export function bindInput(canvas, onEngage) {
  const byCode = {};
  for (const name of Object.keys(KEY_INTENT)) for (const code of KEY_INTENT[name]) byCode[code] = name;
  canvas.addEventListener('click', () => {
    if (!input.locked) canvas.requestPointerLock();
  });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === canvas;
    if (!input.locked) { input.keys.clear(); input.firing = false; input.ads = false; }
  });
  document.addEventListener('mousemove', (e) => {
    if (!input.locked) return;
    input.lookX += e.movementX || 0;
    input.lookY += e.movementY || 0;
  });
  document.addEventListener('mousedown', (e) => {
    if (!input.locked) return;
    if (e.button === 0) { if (!input.firing) input.firePress = true; input.firing = true; }
    else if (e.button === 2) input.ads = true;
  });
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.firing = false;
    else if (e.button === 2) input.ads = false;
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('wheel', (e) => {
    if (input.locked) input.intent.cycle = e.deltaY > 0 ? 1 : -1;
  }, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (e.repeat) { return; }
    input.keys.add(e.code);
    if (e.code === 'Space') e.preventDefault();
    const name = byCode[e.code];
    if (name) {
      e.preventDefault();
      if (actions[name]) actions[name]();      
      else input.intent[name] = true;          
    }
  });
  document.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.firing = false; input.ads = false; });
  canvas.addEventListener('pointerlockerror', () => { input.locked = false; });
  const engage = () => { input.started = true; if (onEngage) onEngage(); };
  document.getElementById('play')?.addEventListener('click', engage);
}
const FLOOR_TAGS = { floor: 1, site: 1, low: 1 };
function overlapXZ(p, c, rad) {
  return p.x + rad > c.min.x && p.x - rad < c.max.x && p.z + rad > c.min.z && p.z - rad < c.max.z;
}
function pushOut(p, c, rad) {
  const px = Math.min(p.x + rad - c.min.x, c.max.x - (p.x - rad));
  const pz = Math.min(p.z + rad - c.min.z, c.max.z - (p.z - rad));
  if (px < pz) p.x += p.x < (c.min.x + c.max.x) / 2 ? -px : px;
  else p.z += p.z < (c.min.z + c.max.z) / 2 ? -pz : pz;
}
export function slide(a, dx, dz, colliders, rad, height) {
  a.x += dx; a.z += dz;
  const top = a.y + TUNE.stepUp + 0.02, feet = a.y + height;
  for (let k = 0; k < 2; k++) {
    for (const c of colliders) {
      if (FLOOR_TAGS[c.tag]) continue;
      if (top >= c.max.y || feet <= c.min.y) continue;
      if (overlapXZ(a, c, rad)) pushOut(a, c, rad);
    }
  }
}
export function land(a, dy, colliders, rad) {
  const feet = a.y;
  a.y += dy;
  let ground = -Infinity;
  for (const c of colliders) {
    if (c.max.y > feet + TUNE.stepUp + 0.02) continue;
    if (overlapXZ(a, c, rad * 0.9)) ground = Math.max(ground, c.max.y);
  }
  if (ground === -Infinity) ground = 0;
  if (dy <= 0 && a.y <= ground + 0.001) { a.y = ground; return true; }
  return a.y <= ground + 0.02 && dy <= 0;
}
export function canMove() {
  return !state.buyOpen && !state.paused && state.phase !== 'menu';
}
export function look() {
  const p = state.player;
  p.yaw -= input.lookX * SENS;
  p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch - input.lookY * SENS));
  input.lookX = 0; input.lookY = 0;
}
export function stepPlayer(dt, world) {
  const p = state.player;
  const colliders = world.colliders;
  const R = TUNE.playerRadius, H = TUNE.playerHeight;
  const crouching = input.keys.has('ControlLeft') || input.keys.has('KeyC');
  p.crouch += ((crouching ? 1 : 0) - p.crouch) * Math.min(1, dt * 12);
  p.eye = TUNE.eyeStand + (TUNE.eyeCrouch - TUNE.eyeStand) * p.crouch;
  const run = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  let speed = crouching ? TUNE.crouchSpeed : run ? TUNE.runSpeed : TUNE.walkSpeed;
  let fwd = 0, str = 0;
  if (canMove()) {
    fwd = (input.keys.has('KeyW') ? 1 : 0) - (input.keys.has('KeyS') ? 1 : 0);
    str = (input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('KeyA') ? 1 : 0);
    if (p.alive === false) { fwd = 0; str = 0; }
  }
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  const n = Math.hypot(fwd, str) || 1;
  const tx = ((-fwd * sin + str * cos) / n) * speed;
  const tz = ((-fwd * cos - str * sin) / n) * speed;
  const accel = p.onGround ? TUNE.groundAccel : TUNE.airAccel;
  const k = Math.min(1, accel * dt * 0.12);
  if (fwd || str) { p.vx += (tx - p.vx) * k; p.vz += (tz - p.vz) * k; }
  else if (p.onGround) {
    const f = Math.min(1, TUNE.friction * dt);
    p.vx -= p.vx * f; p.vz -= p.vz * f;
  }
  slide(p, p.vx * dt, p.vz * dt, colliders, R, H);
  p.vy -= TUNE.gravity * dt;
  if (input.keys.has('Space') && p.onGround && canMove()) p.vy = TUNE.jumpSpeed;
  p.onGround = land(p, p.vy * dt, colliders, R);
  if (p.onGround && p.vy < 0) p.vy = 0;
  const ground = Math.hypot(p.vx, p.vz);
  p.footAccum += ground * dt;
  p.footPhase = (p.footPhase + dt * (3.4 + ground * 0.9)) % (Math.PI * 2);
  p.speed = ground;
}
export function syncCamera(camera) {
  const p = state.player;
  camera.position.set(p.x, p.y + p.eye, p.z);
  camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
}