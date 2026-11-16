
import * as THREE from 'three';
function mat(color, metal, rough) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), metalness: metal, roughness: rough
  });
}
function createMesh(geom, mat, x, y, z, rx=0, ry=0, rz=0) {
  const m = new THREE.Mesh(geom, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}
export function buildViewmodel(camera) {
  const group = new THREE.Group();
  group.frustumCulled = false;
  const fde = mat(0xc2b280, 0.2, 0.7); 
  const black = mat(0x0a0a0a, 0.85, 0.25); 
  const gunmetal = mat(0x1c1c1c, 0.75, 0.35);
  const weapon = new THREE.Group();
  group.add(weapon);
  const X = 0.15;
  weapon.add(createMesh(new THREE.BoxGeometry(0.06, 0.08, 0.46), fde, X, -0.15, -0.3));
  weapon.add(createMesh(new THREE.BoxGeometry(0.055, 0.045, 0.38), black, X, -0.105, -0.32, -0.05));
  weapon.add(createMesh(new THREE.BoxGeometry(0.04, 0.04, 0.28), fde, X, -0.105, -0.58));
  weapon.add(createMesh(new THREE.BoxGeometry(0.055, 0.04, 0.2), fde, X, -0.105, -0.58)); 
  weapon.add(createMesh(new THREE.BoxGeometry(0.06, 0.06, 0.22), fde, X, -0.155, -0.6)); 
  weapon.add(createMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5), gunmetal, X, -0.12, -0.9, Math.PI/2));
  const sight = new THREE.Group();
  sight.position.set(X, -0.08, -1.0);
  sight.add(createMesh(new THREE.BoxGeometry(0.005, 0.04, 0.005), gunmetal, 0, 0, 0)); 
  sight.add(createMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.01), gunmetal, 0, 0, 0, Math.PI/2)); 
  weapon.add(sight);
  weapon.add(createMesh(new THREE.CylinderGeometry(0.018, 0.014, 0.08), black, X, -0.12, -1.18, Math.PI/2));
  weapon.add(createMesh(new THREE.BoxGeometry(0.055, 0.1, 0.3), fde, X, -0.15, 0.1, 0.1, 0, 0.1));
  const mag = new THREE.Group();
  mag.position.set(X, -0.28, -0.4);
  mag.rotation.x = -0.3;
  mag.add(createMesh(new THREE.BoxGeometry(0.045, 0.18, 0.09), black, 0, 0, 0));
  weapon.add(mag);
  weapon.add(createMesh(new THREE.BoxGeometry(0.045, 0.12, 0.06), black, X, -0.25, -0.15, 0.5, 0, 0));
  const glove = mat(0x7d6544, 0.04, 0.82);      
  const knuckle = mat(0x9a8158, 0.05, 0.76);    
  const sleeve = mat(0x40453a, 0.0, 0.96);      
  const patch = mat(0xc08a3a, 0.15, 0.7);
  function hand(x, y, z, roll) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.z = roll;
    g.add(createMesh(new THREE.BoxGeometry(0.08, 0.095, 0.105), glove, 0, 0, 0, 0.12));          
    g.add(createMesh(new THREE.BoxGeometry(0.034, 0.036, 0.078), glove, -0.03, 0.04, -0.032, 0, 0, 0.34)); 
    g.add(createMesh(new THREE.BoxGeometry(0.086, 0.036, 0.032), knuckle, 0.002, 0.046, -0.03, 0.16)); 
    g.add(createMesh(new THREE.BoxGeometry(0.058, 0.034, 0.098), glove, 0.004, -0.046, -0.006, 0.2)); 
    g.add(createMesh(new THREE.CylinderGeometry(0.047, 0.054, 0.055, 10), sleeve, 0.008, -0.014, 0.076, Math.PI / 2, 0, 0)); 
    g.add(createMesh(new THREE.BoxGeometry(0.028, 0.026, 0.014), patch, 0.03, 0.026, 0.05));       
    g.add(createMesh(new THREE.CylinderGeometry(0.052, 0.043, 0.32, 10), sleeve, 0.034, -0.078, 0.22, 1.24, 0, 0.18)); 
    return g;
  }
  weapon.add(hand(0.146, -0.268, -0.126, -0.16));    
  weapon.add(hand(0.150, -0.196, -0.582, 0.26));     
  group.position.set(0.17, -0.015, -0.3);
  camera.add(group);
  let bobT = 0, kick = 0, ads = 0;
  return {
    group, weapon,
    fire() { kick = 1; },
    setAds(on) { ads = on ? 1 : 0; },
    update(dt, s) {
      const moving = !!s.moving;
      bobT += dt * (moving ? 10 : 2);
      kick = Math.max(0, kick - dt * 6);
      const sway = Math.sin(bobT) * (moving ? 0.015 : 0.003);
      const bobY = Math.abs(Math.cos(bobT)) * (moving ? 0.01 : 0.002);
      weapon.position.set(sway - 0.18 * ads, bobY + 0.08 * ads, 0.08 * kick);
      weapon.rotation.set(-0.08 * kick, 0.03 * kick, 0);
    },
  };
}
