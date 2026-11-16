
import * as THREE from 'three';
const PALETTE_LAMP = 0xffcf9a;
function mkCtx(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}
function hashRng(seed) {
  let a = seed >>> 0;
  return () => {
    a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0;
    return a / 4294967296;
  };
}
function noiseField(ctx, w, h, rng, scale, strength, hue) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const grid = new Float32Array((scale + 1) * (scale + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  const sample = (u, v) => {
    const gx = u * scale, gy = v * scale;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const i00 = grid[y0 * (scale + 1) + x0];
    const i10 = grid[y0 * (scale + 1) + Math.min(x0 + 1, scale)];
    const i01 = grid[Math.min(y0 + 1, scale) * (scale + 1) + x0];
    const i11 = grid[Math.min(y0 + 1, scale) * (scale + 1) + Math.min(x0 + 1, scale)];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (i00 * (1 - sx) + i10 * sx) * (1 - sy) + (i01 * (1 - sx) + i11 * sx) * sy;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = sample(x / w, y / h);
      const fine = rng() - 0.5;
      const k = (n - 0.5) * strength + fine * strength * 0.22;
      const o = (y * w + x) * 4;
      d[o] = Math.max(0, Math.min(255, d[o] * (1 + k) + k * hue[0]));
      d[o + 1] = Math.max(0, Math.min(255, d[o + 1] * (1 + k) + k * hue[1]));
      d[o + 2] = Math.max(0, Math.min(255, d[o + 2] * (1 + k) + k * hue[2]));
    }
  }
  ctx.putImageData(img, 0, 0);
}
function pit(ctx, w, h, count, rng, dark, light) {
  for (let i = 0; i < count; i++) {
    const x = rng() * w, y = rng() * h, r = 0.6 + rng() * 2.4;
    ctx.fillStyle = rng() > 0.45 ? dark : light;
    ctx.globalAlpha = 0.16 + rng() * 0.4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function streaks(ctx, w, h, count, rng, colour, vertical) {
  ctx.strokeStyle = colour;
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.05 + rng() * 0.18;
    ctx.lineWidth = 1 + rng() * 5;
    ctx.beginPath();
    if (vertical) {
      const x = rng() * w;
      ctx.moveTo(x, rng() * h * 0.3);
      ctx.lineTo(x + (rng() - 0.5) * 6, h * (0.5 + rng() * 0.5));
    } else {
      const y = rng() * h;
      ctx.moveTo(rng() * w * 0.3, y);
      ctx.lineTo(w * (0.5 + rng() * 0.5), y + (rng() - 0.5) * 6);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function cropCorners(ctx, w, h, colour) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(2, w / 64);
  const m = w * 0.09, L = w * 0.2;
  const corners = [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L);
    ctx.stroke();
  }
}
function texify(canvas, bumpCanvas, repX, repY, aniso) {
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(repX, repY);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = aniso;
  let bump = null;
  if (bumpCanvas) {
    bump = new THREE.CanvasTexture(bumpCanvas);
    bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
    bump.repeat.set(repX, repY);
    bump.anisotropy = aniso;
  }
  return { map, bump };
}
function greyBump(canvas) {
  const { canvas: c, ctx } = mkCtx(canvas.width, canvas.height);
  ctx.drawImage(canvas, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] * 0.3 + d[i + 1] * 0.6 + d[i + 2] * 0.1;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
export function paintMaterials(renderer) {
  const aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
  const out = {};
  const rng = hashRng(0x5a17);
  {
    const { canvas, ctx } = mkCtx(256, 256);
    ctx.fillStyle = '#584a3b'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const x = rng() * 256, y = rng() * 256, r = 0.5 + rng() * 2.2;
      const t = rng();
      ctx.fillStyle = t < 0.35 ? '#5c4d3c' : t < 0.7 ? '#3a3028' : t < 0.9 ? '#6d5c46' : '#241d18';
      ctx.globalAlpha = 0.5 + rng() * 0.5;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.75, rng() * 3.14, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    noiseField(ctx, 256, 256, hashRng(11), 24, 0.3, [6, 3, 0]);
    streaks(ctx, 256, 256, 10, hashRng(12), '#20180f', false);
    out.gravel = new THREE.MeshStandardMaterial({
      ...texify(canvas, greyBump(canvas), 22, 22, aniso), roughness: 0.97, metalness: 0.02, bumpScale: 0.45,
    });
  }
  {
    const { canvas, ctx } = mkCtx(256, 256);
    ctx.fillStyle = '#8b8377'; ctx.fillRect(0, 0, 256, 256);
    noiseField(ctx, 256, 256, hashRng(23), 12, 0.24, [4, 3, 0]);
    ctx.strokeStyle = 'rgba(60,54,46,0.55)'; ctx.lineWidth = 2;
    for (let y = 64; y < 256; y += 88) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
    for (let x = 128; x < 256; x += 190) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
    pit(ctx, 256, 256, 260, hashRng(24), '#5f584e', '#a9a294');
    streaks(ctx, 256, 256, 14, hashRng(25), '#4c463c', true);
    out.concrete = new THREE.MeshStandardMaterial({
      ...texify(canvas, greyBump(canvas), 7, 7, aniso), roughness: 0.92, metalness: 0.02, bumpScale: 0.7,
    });
  }
  {
    const { canvas, ctx } = mkCtx(256, 256);
    ctx.fillStyle = '#6f5a4c'; ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.03)');
      g.addColorStop(0.62, 'rgba(0,0,0,0.28)');
      g.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = g; ctx.fillRect(x, 0, 16, 256);
    }
    noiseField(ctx, 256, 256, hashRng(33), 8, 0.2, [5, 2, 0]);
    streaks(ctx, 256, 256, 26, hashRng(34), '#3b2317', true);
    for (let i = 0; i < 8; i++) {
      const x = rng() * 256, y = rng() * 256, r = 3 + rng() * 12;
      ctx.fillStyle = 'rgba(120,58,24,0.5)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    }
    out.steel = new THREE.MeshStandardMaterial({
      ...texify(canvas, greyBump(canvas), 9, 9, aniso), roughness: 0.68, metalness: 0.38, bumpScale: 0.55,
    });
  }
  {
    const { canvas, ctx } = mkCtx(256, 256);
    ctx.fillStyle = '#5b4738'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 130; i++) {
      const x = rng() * 256, y = rng() * 256, r = 2 + rng() * 16;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(150,62,26,0.75)');
      g.addColorStop(0.6, 'rgba(102,48,22,0.4)');
      g.addColorStop(1, 'rgba(70,45,30,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    }
    noiseField(ctx, 256, 256, hashRng(43), 20, 0.24, [8, 2, 0]);
    ctx.fillStyle = 'rgba(40,34,28,0.55)';
    for (const y of [42, 214]) ctx.fillRect(0, y, 256, 6);
    for (let i = 0; i < 26; i++) {
      ctx.beginPath(); ctx.arc(10 + i * 9.4, 45, 1.6, 0, 6.283); ctx.fill();
      ctx.beginPath(); ctx.arc(10 + i * 9.4, 217, 1.6, 0, 6.283); ctx.fill();
    }
    out.rust = new THREE.MeshStandardMaterial({
      ...texify(canvas, greyBump(canvas), 6, 6, aniso), roughness: 0.82, metalness: 0.26, bumpScale: 0.6,
    });
  }
  {
    const { canvas, ctx } = mkCtx(256, 256);
    ctx.fillStyle = '#d9a417'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#241f1a';
    ctx.save();
    ctx.translate(0, 0);
    for (let x = -256; x < 512; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 32 - 128, 256); ctx.lineTo(x - 128, 256);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    noiseField(ctx, 256, 256, hashRng(53), 16, 0.22, [4, 3, 0]);
    streaks(ctx, 256, 256, 18, hashRng(54), '#3b2f18', true);
    out.hazard = new THREE.MeshStandardMaterial({
      ...texify(canvas, greyBump(canvas), 4, 4, aniso), roughness: 0.8, metalness: 0.05, bumpScale: 0.5,
    });
  }
  {
    const { canvas, ctx } = mkCtx(256, 256);
    ctx.fillStyle = '#7d5a34'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5; i++) {
      const y = i * 51.2;
      const g = ctx.createLinearGradient(0, y, 0, y + 51.2);
      g.addColorStop(0, 'rgba(255,220,160,0.14)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.04)');
      g.addColorStop(1, 'rgba(0,0,0,0.34)');
      ctx.fillStyle = g; ctx.fillRect(0, y, 256, 51.2);
      ctx.fillStyle = 'rgba(38,24,12,0.7)'; ctx.fillRect(0, y + 48, 256, 4);
    }
    for (let i = 0; i < 220; i++) {
      ctx.globalAlpha = 0.05 + rng() * 0.16;
      ctx.strokeStyle = rng() > 0.5 ? '#4a3117' : '#a67c48';
      ctx.lineWidth = 1;
      const y = rng() * 256;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x < 256; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.06 + i) * 2.2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(30,20,10,0.5)';
    ctx.fillRect(0, 0, 4, 256); ctx.fillRect(252, 0, 4, 256);
    out.crate = new THREE.MeshStandardMaterial({
      ...texify(canvas, greyBump(canvas), 1, 1, aniso), roughness: 0.86, metalness: 0.02,
    });
  }
  {
    const { canvas, ctx } = mkCtx(128, 128);
    ctx.fillStyle = '#211f1d'; ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#7b7568'; ctx.lineWidth = 4;
    for (let x = 2; x < 128; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
    for (let y = 2; y < 128; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
    noiseField(ctx, 128, 128, hashRng(63), 10, 0.2, [5, 4, 3]);
    out.grate = new THREE.MeshStandardMaterial({
      ...texify(canvas, greyBump(canvas), 4, 4, aniso), roughness: 0.55, metalness: 0.62,
    });
  }
  {
    const { canvas, ctx } = mkCtx(256, 256);
    ctx.fillStyle = '#5d3a2c'; ctx.fillRect(0, 0, 256, 256);
    const bh = 32, bw = 84;
    for (let r = 0; r * bh < 256; r++) {
      for (let c = -1; c * bw < 256 + bw; c++) {
        const x = c * bw + (r % 2 ? bw * 0.5 : 0);
        const y = r * bh;
        ctx.fillStyle = `rgba(${150 + Math.floor(rng() * 26)},${86 + Math.floor(rng() * 22)},${62 + Math.floor(rng() * 18)},1)`;
        ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      }
    }
    noiseField(ctx, 256, 256, hashRng(73), 14, 0.22, [6, 2, 0]);
    pit(ctx, 256, 256, 180, hashRng(74), '#33190f', '#a4694a');
    out.brick = new THREE.MeshStandardMaterial({
      ...texify(canvas, greyBump(canvas), 3, 3, aniso), roughness: 0.9, metalness: 0.03,
    });
  }
  {
    const { canvas, ctx } = mkCtx(128, 128);
    ctx.fillStyle = '#3d4a48'; ctx.fillRect(0, 0, 128, 128);
    noiseField(ctx, 128, 128, hashRng(83), 10, 0.26, [4, 5, 5]);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(140,74,34,0.45)';
      ctx.beginPath(); ctx.arc(rng() * 128, rng() * 128, 1 + rng() * 5, 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = 'rgba(20,26,26,0.6)';
    for (const y of [24, 100]) ctx.fillRect(0, y, 128, 5);
    out.paint = new THREE.MeshStandardMaterial({
      ...texify(canvas, greyBump(canvas), 1, 1, aniso), roughness: 0.6, metalness: 0.45,
    });
  }
  const signTex = (text, sub, bg, fg) => {
    const { canvas, ctx } = mkCtx(256, 256);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 256);
    noiseField(ctx, 256, 256, hashRng(93), 12, 0.18, [4, 3, 0]);
    ctx.strokeStyle = fg; ctx.lineWidth = 8; ctx.strokeRect(12, 12, 232, 232);
    ctx.fillStyle = fg;
    ctx.font = 'bold 132px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, sub ? 112 : 128);
    if (sub) {
      ctx.font = 'bold 26px "Helvetica Neue", Arial, sans-serif';
      ctx.fillText(sub, 128, 196);
    }
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(30,26,22,${0.05 + rng() * 0.2})`;
      ctx.fillRect(rng() * 256, rng() * 256, 1 + rng() * 3, 1 + rng() * 3);
    }
    cropCorners(ctx, 256, 256, bg);
    return new THREE.MeshStandardMaterial({
      ...texify(canvas, greyBump(canvas), 1, 1, aniso), roughness: 0.78, metalness: 0.06,
      emissive: new THREE.Color(fg).multiplyScalar(0.06),
    });
  };
  out.signA = signTex('A', 'SLAG BASIN', '#c8441b', '#f6ecdd');
  out.signB = signTex('B', 'KILN HOUSE', '#c8441b', '#f6ecdd');
  const arrowTex = (text, bg, fg) => {
    const { canvas, ctx } = mkCtx(256, 256);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = fg;
    ctx.font = 'bold 160px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 128);
    return new THREE.MeshStandardMaterial({
      ...texify(canvas, null, 1, 1, aniso), roughness: 0.8, metalness: 0.05,
      transparent: true, opacity: 0.85,
    });
  };
  out.arrowA = arrowTex('← A', 'rgba(0,0,0,0)', '#c8441b');
  out.arrowB = arrowTex('B →', 'rgba(0,0,0,0)', '#c8441b');
  out.board = signTex('09', 'ASHGATE WORKS', '#26333a', '#e8dcc6');
  out.signDir = (() => {
    const { canvas, ctx } = mkCtx(256, 128);
    ctx.fillStyle = '#26333a'; ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#e8b216';
    ctx.font = 'bold 34px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('GANTRY  /  KILN', 128, 40);
    ctx.fillText('BASIN  /  COKE', 128, 88);
    return new THREE.MeshStandardMaterial({
      ...texify(canvas, null, 1, 1, aniso), roughness: 0.8, metalness: 0.05,
    });
  })();
  {
    const { canvas, ctx } = mkCtx(64, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,226,170,0.85)');
    g.addColorStop(0.6, 'rgba(255,140,40,0.28)');
    g.addColorStop(1, 'rgba(255,90,10,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const glow = new THREE.CanvasTexture(canvas);
    glow.colorSpace = THREE.SRGBColorSpace;
    out.glow = new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    out.spark = new THREE.PointsMaterial({ map: glow, size: 0.34, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc78a });
  }
  {
    const { canvas, ctx } = mkCtx(128, 128);
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(214,206,196,0.92)');
    g.addColorStop(0.55, 'rgba(178,172,166,0.6)');
    g.addColorStop(1, 'rgba(150,148,144,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const smokeTex = new THREE.CanvasTexture(canvas);
    smokeTex.colorSpace = THREE.SRGBColorSpace;
    out.smoke = new THREE.MeshBasicMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.94, side: THREE.DoubleSide });
  }
  {
    const { canvas, ctx } = mkCtx(64, 64);
    const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
    g.addColorStop(0, 'rgba(18,14,12,0.95)');
    g.addColorStop(0.5, 'rgba(26,20,16,0.6)');
    g.addColorStop(1, 'rgba(30,24,20,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    const hole = new THREE.CanvasTexture(canvas);
    hole.colorSpace = THREE.SRGBColorSpace;
    out.bulletHole = new THREE.MeshBasicMaterial({ map: hole, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    out.scorch = new THREE.MeshBasicMaterial({ map: hole, transparent: true, depthWrite: false, opacity: 0.85, color: 0x3a3128, polygonOffset: true, polygonOffsetFactor: -4 });
  }
  {
    const { canvas, ctx } = mkCtx(64, 64);
    ctx.fillStyle = 'rgba(120,10,8,0.9)';
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      ctx.arc(32 + (rng() - 0.5) * 40, 32 + (rng() - 0.5) * 40, 1 + rng() * 7, 0, 6.283);
      ctx.fill();
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    out.decal = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -5 });
  }
  out.glass = new THREE.MeshStandardMaterial({
    color: 0x7fa6b4, transparent: true, opacity: 0.28, roughness: 0.12, metalness: 0.3, side: THREE.DoubleSide,
  });
  out.lampGlass = new THREE.MeshStandardMaterial({
    color: PALETTE_LAMP, emissive: new THREE.Color(PALETTE_LAMP), emissiveIntensity: 2.4, roughness: 0.4,
  });
  return out;
}