// Tes geometri map: tidak ada benda melayang, atap selalu bertumpu, rute bot bebas, tidak ada permukaan z-fight.
import { BRUSHES, PROPS, ROUTES, SPAWNS, SITE_ANCHORS } from '../game/src/map.js';
const bb = (b) => ({ ...b, x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: b.y - b.h / 2, y1: b.y + b.h / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 });
const L = BRUSHES.map(bb);
const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
let fail = 0; const bad = (m) => { fail++; console.log('GAGAL:', m); };
const name = (b) => `${b.m}/${b.t}@(${b.x},${b.y},${b.z})`;

// 1. floating: tiap brush harus menapak tanah / ditopang / digantung
for (const b of L) {
  if (b.t === 'floor') continue;
  if (b.y0 <= 0.06) continue;
  const sup = L.filter((o) => o !== b && ov(b.x0, b.x1, o.x0, o.x1) > 0.01 && ov(b.z0, b.z1, o.z0, o.z1) > 0.01 &&
    ((o.y0 <= b.y0 + 0.01 && o.y1 >= b.y0 - 0.06) || (o.y0 <= b.y1 + 0.06 && o.y1 >= b.y1 - 0.01 && o.y0 >= b.y1 - 0.06)));
  if (!sup.length) bad('melayang ' + name(b));
  if (b.t === 'roof' && sup.length < 3) bad('atap hanya ditopang ' + sup.length + ' brush ' + name(b));
}
// 2. z-fighting: dua brush punya bidang atas sama persis & saling tumpuk
for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
  const a = L[i], b = L[j];
  if (Math.abs(a.y1 - b.y1) < 1e-3 && ov(a.x0, a.x1, b.x0, b.x1) > 0.01 && ov(a.z0, a.z1, b.z0, b.z1) > 0.01 && a.m !== b.m)
    bad(`z-fight atas ${name(a)} vs ${name(b)}`);
  if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) < 1e-6 && a.w === b.w && a.h === b.h && a.d === b.d)
    bad('duplikat ' + name(a));
}
// 3. rute & spawn bebas tabrakan (radius pemain 0.42, hanya yang menghalangi tinggi 0.55..1.78)
const R = 0.42;
const blockers = L.filter((b) => b.y1 > 0.55 && b.y0 < 1.78 && b.t !== 'floor');
for (const p of PROPS) if (p.k === 'cyl' && !p.axis) blockers.push({ t: 'prop', m: p.m, x: p.x, y: p.y, z: p.z, x0: p.x - p.r * 0.9, x1: p.x + p.r * 0.9, z0: p.z - p.r * 0.9, z1: p.z + p.r * 0.9 });
const hit = (x, z) => blockers.find((b) => x > b.x0 - R && x < b.x1 + R && z > b.z0 - R && z < b.z1 + R);
for (const [rn, pts] of Object.entries(ROUTES)) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2);
    for (let k = 0; k <= n; k++) {
      const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n, h = hit(x, z);
      if (h) { bad(`rute ${rn} seg${i} terhalang ${name(h)} di (${x.toFixed(1)},${z.toFixed(1)})`); break; }
    }
  }
}
for (const [side, arr] of Object.entries(SPAWNS)) arr.forEach((s, i) => { const h = hit(s.x, s.z); if (h) bad(`spawn ${side}${i} di dalam ${name(h)}`); });
for (const s of SITE_ANCHORS) { const h = hit(s.x, s.z); if (h) bad(`site ${s.id} tertutup ${name(h)}`); }
console.log(fail ? `\n${fail} masalah` : 'SEMUA TES LOLOS (' + L.length + ' brush)');
process.exit(fail ? 1 : 0);
