
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { BOUNDS } from './map.js';
const SUN_POS = new THREE.Vector3(-52, 20, -30);
const GLOW_DIR = new THREE.Vector3(-0.83, 0.32, -0.48).normalize();
function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
      glow: { value: new THREE.Color(PALETTE.skyGlow) },
      sunDir: { value: GLOW_DIR.clone() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float y = clamp(d.y, -1.0, 1.0);
        float up = clamp(y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(up, 0.45));
        col = mix(col, glow, pow(1.0 - up, 6.0) * 0.62);
        float s = max(dot(d, sunDir), 0.0);
        col += glow * (pow(s, 3.0) * 0.20 + pow(s, 30.0) * 0.75);   
        col += vec3(1.0, 0.84, 0.62) * smoothstep(0.99955, 0.99985, s) * 3.5; 
        col = mix(col, col * 0.5, smoothstep(0.0, -0.3, y));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), mat);
  dome.name = 'sky';
  return dome;
}
function addLamp(scene, mats, x, y, z, power, reach) {
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.55), mats.lampGlass);
  head.position.set(x, y, z);
  scene.add(head);
  const light = new THREE.PointLight(PALETTE.lampWarm, power, reach, 2.0);
  light.position.set(x, y - 0.4, z);
  scene.add(light);
  return light;
}
function embers(scene, mats, count, size, color, top) {
  const pos = new Float32Array(count * 3);
  const span = (BOUNDS.max - 1) * 2;
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * span;
    pos[i * 3 + 1] = 0.4 + Math.random() * top;
    pos[i * 3 + 2] = (Math.random() - 0.5) * span;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: mats.spark.map, size, color, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'embers-' + count;
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
}
export function buildLighting(scene, mats) {
  scene.add(skyDome());
  scene.background = new THREE.Color(PALETTE.skyHorizon).lerp(new THREE.Color(PALETTE.skyTop), 0.5);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0125);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 7.8);
  sun.position.copy(SUN_POS);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera;
  c.left = -46; c.right = 46; c.top = 46; c.bottom = -46; c.near = 1; c.far = 170;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.025;   
  scene.add(sun);
  scene.add(sun.target);
  scene.add(new THREE.AmbientLight(PALETTE.ground, 0.35));   
  scene.add(new THREE.HemisphereLight(PALETTE.skyTop, PALETTE.ground, 1.25));
  const fill = new THREE.DirectionalLight(PALETTE.fill, 0.95);
  fill.position.set(38, 24, -42);
  scene.add(fill);
  addLamp(scene, mats, 3.0, 1.7, -5.9, 10, 17);
  addLamp(scene, mats, 7.2, 1.7, -7.4, 10, 17);
  addLamp(scene, mats, 11.0, 1.7, -5.0, 9, 16);
  addLamp(scene, mats, 0, 5.3, 0, 12, 21);        
  addLamp(scene, mats, 22, 3.4, 19, 9, 18);       
  addLamp(scene, mats, -16, 4.2, -16, 8, 16);     
  embers(scene, mats, 210, 0.11, 0xffbe86, 6.5);
  embers(scene, mats, 46, 0.26, 0xff8a3a, 8.5);
  return { sun, sky: scene.background, fog: scene.fog };
}