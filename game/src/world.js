
import * as THREE from 'three';
import { BRUSHES, PROPS, BOUNDS } from './map.js';
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 18, 1, false);
const CONE = new THREE.ConeGeometry(1, 1, 9, 1, false);
function aabb(x, y, z, w, h, d, tag) {
  return {
    min: { x: x - w / 2, y: y - h / 2, z: z - d / 2 },
    max: { x: x + w / 2, y: y + h / 2, z: z + d / 2 },
    tag,
  };
}
function buildBoxes(root, mats, colliders) {
  const byMat = new Map();
  for (const b of BRUSHES) {
    if (!byMat.has(b.m)) byMat.set(b.m, []);
    byMat.get(b.m).push(b);
    colliders.push(aabb(b.x, b.y, b.z, b.w, b.h, b.d, b.t));
  }
  const d = new THREE.Object3D();
  for (const [key, list] of byMat) {
    const inst = new THREE.InstancedMesh(BOX, mats[key] || mats.concrete, list.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.name = 'boxes-' + key;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      d.position.set(b.x, b.y, b.z);
      d.rotation.set(0, 0, 0);
      d.scale.set(b.w, b.h, b.d);
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    root.add(inst);
  }
}
function buildProps(root, mats, colliders) {
  const byKey = new Map();
  for (const p of PROPS) {
    const key = p.k + '|' + p.m + '|' + (p.axis || 'y');
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(p);
    if (p.k === 'cyl' && !p.axis) colliders.push(aabb(p.x, p.y, p.z, p.r * 1.8, p.h, p.r * 1.8, 'prop'));
  }
  const d = new THREE.Object3D();
  for (const [key, list] of byKey) {
    const [kind, mat, axis] = key.split('|');
    const geo = kind === 'cone' ? CONE : CYL;
    const inst = new THREE.InstancedMesh(geo, mats[mat] || mats.steel, list.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    inst.name = 'props-' + kind + '-' + mat;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(0, 0, axis === 'x' ? Math.PI / 2 : 0);
      d.scale.set(p.r, p.h, p.r);
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    root.add(inst);
  }
}
function buildSignage(root, mats) {
  const square = new THREE.PlaneGeometry(3.2, 3.2);
  const wide = new THREE.PlaneGeometry(3.0, 1.5);
  const put = (mat, x, y, z, yaw, geo) => {
    const m = new THREE.Mesh(geo || square, mat);
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    root.add(m);
    return m;
  };
  for (const [mat, x, z] of [[mats.signA, -21, -12.2], [mats.signB, 20, 24.2]]) {
    const post = new THREE.Mesh(BOX, mats.concrete);
    post.position.set(x, 1.5, z);
    post.scale.set(0.3, 3.0, 0.3);
    post.castShadow = true;
    root.add(post);
    put(mat, x, 3.1, z, 0, wide);
  }
  put(mats.board, 0, 4.3, -29.7, 0);                       
  put(mats.signDir, 30.0, 2.6, 0, -Math.PI / 2);           
  put(mats.signDir, -30.0, 2.6, 0, Math.PI / 2);
  put(mats.arrowA, -4.8, 1.5, 0, -Math.PI / 2);  
  put(mats.arrowB, 4.8, 1.5, 0, Math.PI / 2);    
  put(mats.arrowA, -25.0, 2.0, -10.0, 0);        
  put(mats.arrowB, 25.0, 2.0, 10.0, Math.PI);    
}
export function buildWorld(scene, mats) {
  const root = new THREE.Group();
  root.name = 'ashgate';
  scene.add(root);
  const colliders = [];
  buildBoxes(root, mats, colliders);
  buildProps(root, mats, colliders);
  buildSignage(root, mats);
  buildGroundBeyond(root, mats);
  return { root, colliders, bounds: BOUNDS };
}
function buildGroundBeyond(root, mats) {
  const plane = new THREE.PlaneGeometry(128, 128);
  const groundMat = mats.gravel.clone();
  groundMat.side = THREE.DoubleSide;
  groundMat.transparent = false;
  groundMat.opacity = 1.0;
  const mesh = new THREE.Mesh(plane, groundMat);
  mesh.position.set(0, -0.5, 0);
  mesh.rotation.x = -Math.PI / 2;
  mesh.name = 'ground-beyond';
  mesh.receiveShadow = true;
  root.add(mesh);
}
export function buildCharge(scene) {
  const body = new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 0.78, metalness: 0.36 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xd8a020, roughness: 0.58, metalness: 0.24 });
  const lamp = new THREE.MeshStandardMaterial({
    color: 0x2a1410, roughness: 0.4, metalness: 0.1,
    emissive: new THREE.Color(0xff4433), emissiveIntensity: 1.6,
  });
  const root = new THREE.Group();
  root.name = 'charge';
  const put = (geo, mat, x, y, z, sx, sy, sz, ry) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (ry) m.rotation.y = ry;
    root.add(m);
    return m;
  };
  put(BOX, body, 0, 0.14, 0, 0.44, 0.28, 0.32);              
  put(BOX, trim, 0, 0.15, 0.166, 0.30, 0.05, 0.02);          
  put(BOX, trim, 0, 0.15, -0.166, 0.30, 0.05, 0.02);
  put(BOX, body, 0.15, 0.31, 0, 0.12, 0.06, 0.20);           
  for (let i = 0; i < 3; i++) put(BOX, lamp, -0.10 + i * 0.10, 0.30, 0.115, 0.05, 0.02, 0.045);
  put(CYL, trim, 0, 0.60, -0.13, 0.018, 0.60, 0.018);        
  const blip = put(BOX, lamp, 0, 0.93, -0.13, 0.12, 0.10, 0.12);
  put(CYL, body, 0.30, 0.04, 0.17, 0.15, 0.08, 0.15);        
  root.visible = false;
  scene.add(root);
  return {
    root,
    place(x, y, z, yaw) {
      root.position.set(x, y || 0, z);
      root.rotation.y = yaw || 0;
      root.visible = true;
    },
    hide() { root.visible = false; },
    blink(t, fuse) {
      const rate = fuse < 10 ? 7.4 : 2.4;
      const on = (Math.sin(t * rate) + 1) * 0.5;
      lamp.emissiveIntensity = 0.5 + on * 2.8;
      blip.scale.set(0.12 + on * 0.05, 0.10 + on * 0.06, 0.12 + on * 0.05);
    },
  };
}
