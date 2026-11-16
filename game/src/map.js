
import { SITES } from './config.js';
export const BOUNDS = { min: -31.5, max: 31.5, wallH: 7.2, thick: 1.2 };
function B(m, x, y, z, w, h, d, t) { return { m, x, y, z, w, h, d, t: t || 'solid' }; }
function P(m, x, y, z, w, h, d, t) { return [B(m, x, y, z, w, h, d, t), B(m, -x, y, -z, w, h, d, t)]; }

// Bangunan dihitung dari SATU set angka: dinding, ambang pintu, dan atap
// selalu menempel. (cx,cz)=pusat, w=lebar X, d=dalam Z, h=tinggi dinding, t=tebal.
// doors: { n:[{c,w}], s:[...], e:[...], w:[...] }  n = sisi z kecil, s = z besar,
// c = koordinat pusat pintu (x untuk n/s, z untuk e/w), w = lebar pintu.
function wallRun(m, fixed, a0, a1, h, t, doors, alongX, doorH) {
  const out = [];
  const ds = (doors || []).map((q) => [q.c - q.w / 2, q.c + q.w / 2]).sort((p, q) => p[0] - q[0]);
  let cur = a0;
  const seg = (s, e, hh, y) => {
    if (e - s < 0.05) return;
    const c = (s + e) / 2, len = e - s;
    out.push(alongX ? B(m, c, y, fixed, len, hh, t, 'wall') : B(m, fixed, y, c, t, hh, len, 'wall'));
  };
  for (const [s, e] of ds) {
    seg(cur, s, h, h / 2);
    seg(s, e, h - doorH, doorH + (h - doorH) / 2);   // ambang di atas pintu
    cur = e;
  }
  seg(cur, a1, h, h / 2);
  return out;
}
function building(m, cx, cz, w, d, h, t, doors, roofM, roofT, doorH) {
  doorH = doorH || 2.8;
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const dd = doors || {};
  return [
    ...wallRun(m, z0, x0 - t / 2, x1 + t / 2, h, t, dd.n, true, doorH),
    ...wallRun(m, z1, x0 - t / 2, x1 + t / 2, h, t, dd.s, true, doorH),
    ...wallRun(m, x0, z0 + t / 2, z1 - t / 2, h, t, dd.w, false, doorH),
    ...wallRun(m, x1, z0 + t / 2, z1 - t / 2, h, t, dd.e, false, doorH),
    B(roofM, cx, h + roofT / 2 - 0.05, cz, w + t + 0.3, roofT, d + t + 0.3, 'roof'),
  ];
}
// Tangga: n anak tangga naik menuju (x,z) arah dir ('-x','+x'), tinggi akhir topH.
function stairs(m, xStart, z, dir, n, topH, run, width) {
  const out = [], s = dir === '-x' ? -1 : 1;
  for (let i = 0; i < n; i++) {
    const top = topH * (n - i) / n;           // i=0 paling dekat catwalk
    const cx = xStart + s * (run * i + run / 2);
    out.push(B(m, cx, top / 2, z, run, top, width, 'stairs'));
  }
  return out;
}
const WALL_H = BOUNDS.wallH;
export const BRUSHES = [
  // lantai + kerb + dinding batas (celah gerbang tengah ditutup)
  B('gravel', 0, -0.5, 0, 64, 1, 64, 'floor'),
  ...P('concrete', 31.0, 0.15, 0, 2.0, 0.3, 64, 'kerb'),
  ...P('concrete', 0, 0.15, 31.0, 64, 0.3, 2.0, 'kerb'),
  ...P('steel', 18, WALL_H / 2, -30.6, 24, WALL_H, BOUNDS.thick),
  ...P('steel', 18, WALL_H / 2, 30.6, 24, WALL_H, BOUNDS.thick),
  B('steel', 0, WALL_H / 2, -30.6, 12, WALL_H, BOUNDS.thick),
  B('steel', 0, WALL_H / 2, 30.6, 12, WALL_H, BOUNDS.thick),
  ...P('steel', -30.6, WALL_H / 2, 0, BOUNDS.thick, WALL_H, 64),
  ...P('hazard', 12, 0.7, -29.4, 0.5, 1.4, 1.0, 'brace'),
  ...P('hazard', 24, 0.7, -29.4, 0.5, 1.4, 1.0, 'brace'),

  // WEIGHBRIDGE: dek + tangga naik yang benar (tiap anak tangga <= 0.5)
  B('concrete', 0, 0.7, 0, 10, 1.4, 10, 'deck'),
  B('hazard', 0, 1.42, 4.6, 10, 0.14, 0.5, 'edge'),
  B('hazard', 0, 1.42, -4.6, 10, 0.14, 0.5, 'edge'),
  B('hazard', 4.6, 1.42, 0, 0.5, 0.14, 10, 'edge'),
  B('hazard', -4.6, 1.42, 0, 0.5, 0.14, 10, 'edge'),
  B('concrete', 0, 0.235, 6.5, 4.0, 0.47, 1.0, 'stairs'),
  B('concrete', 0, 0.465, 5.5, 4.0, 0.93, 1.0, 'stairs'),
  B('concrete', 0, 0.235, -6.5, 4.0, 0.47, 1.0, 'stairs'),
  B('concrete', 0, 0.465, -5.5, 4.0, 0.93, 1.0, 'stairs'),

  // GANTRY WALK: catwalk di atas 4 tiang, tangga penuh dari tanah, pagar DI ATAS lantai
  ...P('concrete', 6.0, 2.2, 8.6, 0.7, 4.4, 0.7, 'pillar'),
  ...P('concrete', 6.0, 2.2, 12.0, 0.7, 4.4, 0.7, 'pillar'),
  B('grate', 0, 4.5, 10.3, 13.0, 0.3, 4.0, 'catwalk'),
  ...stairs('concrete', -6.5, 10.3, '-x', 9, 4.65, 0.6, 2.0),
  B('paint', 0, 5.25, 8.45, 13.0, 0.12, 0.12, 'rail'),
  B('paint', 0, 5.25, 12.15, 13.0, 0.12, 0.12, 'rail'),
  ...[-6.3, -3.15, 0, 3.15, 6.3].flatMap((x) => [
    B('paint', x, 5.1, 8.45, 0.12, 0.9, 0.12, 'post'),
    B('paint', x, 5.1, 12.15, 0.12, 0.9, 0.12, 'post'),
  ]),

  // FORGE LINE: tiga tangki karat, pipa duduk di atasnya
  B('rust', 3.0, 1.7, -7.5, 2.8, 3.4, 2.8),
  B('rust', 7.2, 1.7, -9.0, 2.8, 3.4, 2.8),
  B('rust', 11.0, 1.7, -6.6, 2.8, 3.4, 2.8),
  B('lampGlass', 3.0, 1.1, -6.1, 1.2, 0.9, 0.16, 'vent'),
  B('lampGlass', 7.2, 1.1, -7.6, 1.2, 0.9, 0.16, 'vent'),
  B('lampGlass', 11.0, 1.1, -5.2, 1.2, 0.9, 0.16, 'vent'),
  B('rust', 7.0, 3.7, -7.7, 12.0, 0.6, 0.6, 'pipe'),
  B('concrete', 7.0, 0.35, -5.0, 12.0, 0.9, 2.0, 'stairs'),

  // SLAG BASIN (site A): lantai beton polos, bibir rendah 0.45 (bisa diinjak), 3 pintu masuk, tanpa kerucut
  B('concrete', -21, 0.06, -19, 13, 0.12, 13, 'site'),
  B('concrete', -21, 0.225, -25.5, 13.6, 0.45, 0.6, 'lip'),
  B('concrete', -27.5, 0.225, -19, 0.6, 0.45, 13, 'lip'),
  B('concrete', -14.5, 0.225, -19, 0.6, 0.45, 13, 'lip'),
  B('concrete', -24.5, 0.225, -12.5, 6.0, 0.45, 0.6, 'lip'),
  B('concrete', -16.0, 0.225, -12.5, 3.0, 0.45, 0.6, 'lip'),
  B('concrete', -24, 0.6, -21, 2.6, 1.2, 1.0, 'barrier'),
  B('crate', -18, 0.7, -22, 1.4, 1.4, 1.4),
  B('concrete', -24.5, 0.6, -15.5, 3.0, 1.2, 1.0, 'barrier'),
  B('crate', -17.2, 0.7, -17.2, 1.4, 1.4, 1.4),
  B('crate', -17.2, 2.1, -17.2, 1.4, 1.4, 1.4),

  // KILN HOUSE (site B): bangunan bata utuh, 3 pintu, atap menempel
  ...building('brick', 20, 18, 13, 11, 6, 0.6,
    { n: [{ c: 20, w: 3.4 }], s: [{ c: 19, w: 3.0 }], w: [{ c: 18, w: 3.2 }] }, 'steel', 0.5, 3.0),
  B('concrete', 20, 0.06, 18, 8, 0.12, 8, 'site'),
  B('crate', 24, 0.7, 15, 1.4, 1.4, 1.4),
  B('crate', 24, 2.1, 15, 1.4, 1.4, 1.4),
  B('crate', 17, 0.7, 21, 1.4, 1.4, 1.4),

  // COKE SHED: pintu di empat sisi (rute bot lewat sini)
  ...building('steel', 18, -16, 10, 8, 4.5, 0.5,
    { n: [{ c: 18, w: 4.0 }], s: [{ c: 17.5, w: 4.0 }], w: [{ c: -18, w: 3.5 }], e: [{ c: -14, w: 3.0 }] }, 'steel', 0.4, 2.8),

  // PIPE TRENCH: dua dinding rendah sejajar + lantai kisi di antaranya
  B('concrete', -19.5, 0.5, 14.5, 0.7, 1.0, 11.0),
  B('concrete', -15.5, 0.5, 14.5, 0.7, 1.0, 11.0),
  B('grate', -17.5, 0.12, 14.5, 3.0, 0.24, 10.0, 'low'),

  // CRATES / PALLETS (semua menapak, rute dibersihkan)
  B('crate', -4.6, 0.7, 16, 1.4, 1.4, 1.4),
  B('crate', -6.2, 0.7, 16.8, 1.4, 1.4, 1.4),
  B('crate', 6, 0.7, -14, 1.4, 1.4, 1.4),
  B('crate', 13, 0.7, 4, 1.4, 1.4, 1.4),
  B('crate', -12, 0.7, -6, 1.4, 1.4, 1.4),
  B('crate', -12, 2.1, -6, 1.4, 1.4, 1.4),
  B('crate', 16, 0.7, -6, 1.4, 1.4, 1.4),
  B('crate', 16, 2.1, -6, 1.4, 1.4, 1.4),
  B('hazard', 0, 0.14, -20, 5.0, 0.28, 0.6, 'kerb'),
  B('hazard', 0, 0.14, 20, 5.0, 0.28, 0.6, 'kerb'),

  // GANTRY RANGKA UTARA: 4 kaki dari tanah + balok di atasnya + crate digantung rantai
  ...[-14, 14].flatMap((x) => [
    B('steel', x, 4.1, -24.5, 0.6, 8.2, 0.6, 'column'),
    B('steel', x, 4.1, -23.5, 0.6, 8.2, 0.6, 'column'),
  ]),
  B('rust', 0, 8.5, -24, 29.2, 0.7, 0.9, 'pipe'),
  B('steel', 6, 7.575, -24, 0.1, 1.15, 0.1, 'chain'),
  B('crate', 6, 6.2, -24, 1.6, 1.6, 1.6, 'hook'),

  // PIPA DI ATAS TIANG (tiang tepat di bawah pipa)
  B('rust', 14, 2.6, 12, 6.0, 0.4, 0.4, 'pipe'),
  B('steel', 12, 1.2, 12, 0.4, 2.4, 0.4, 'brace'),
  B('steel', 16, 1.2, 12, 0.4, 2.4, 0.4, 'brace'),
  B('rust', -14, 2.6, -12, 6.0, 0.4, 0.4, 'pipe'),
  B('steel', -12, 1.2, -12, 0.4, 2.4, 0.4, 'brace'),
  B('steel', -16, 1.2, -12, 0.4, 2.4, 0.4, 'brace'),
  ...P('crate', 8.0, 0.4, -14.2, 2.2, 0.8, 1.6, 'pallet'),
  ...P('crate', 8.0, 1.2, -14.2, 2.2, 0.8, 1.6, 'pallet'),
  B('crate', -8.5, 0.4, 6.0, 1.2, 0.8, 1.6, 'pallet'),
  B('crate', -8.5, 1.2, 6.0, 1.2, 0.8, 1.6, 'pallet'),
  B('crate', 9.0, 0.4, 17.5, 1.6, 0.8, 1.2, 'pallet'),
];
export const PROPS = [
  { k: 'cyl', m: 'brick', x: 23, y: 2.3, z: 21, r: 2.0, h: 4.6 },
  { k: 'cyl', m: 'brick', x: 26.5, y: 7.0, z: 18, r: 1.7, h: 14.0 },
  { k: 'cyl', m: 'steel', x: -14.5, y: 2.3, z: -13.5, r: 2.6, h: 4.6 },
  { k: 'cyl', m: 'steel', x: -9.0, y: 2.3, z: -12.0, r: 2.6, h: 4.6 },
  { k: 'cyl', m: 'rust', x: 21, y: 4.0, z: -16, r: 1.1, h: 8.0 },
  { k: 'cyl', m: 'paint', x: 0, y: 2.6, z: 0, r: 0.18, h: 5.2 },
];
export const SPAWNS = {
  home: [
    { x: -3.5, z: 27.0, yaw: 0 }, { x: 0, z: 27.6, yaw: 0 }, { x: 3.5, z: 27.0, yaw: 0 },
    { x: -6.5, z: 26.0, yaw: 0.22 }, { x: 6.5, z: 26.0, yaw: -0.22 },
  ],
  away: [
    { x: -3.5, z: -24.0, yaw: Math.PI }, { x: 0, z: -24.6, yaw: Math.PI }, { x: 3.5, z: -24.0, yaw: Math.PI },
    { x: -20, z: -22.5, yaw: 2.5 }, { x: 18.5, z: -21.5, yaw: -2.4 },
  ],
};
export const ROUTES = {
  westToA: [[-2, 23], [-8, 19], [-13, 12], [-17, 2], [-20, -8], [-21, -17]],
  midToA: [[0, 23], [0, 10], [-3.5, 7.5], [-6.5, 5.8], [-6.5, 3], [-15, -5], [-21, -17]],
  eastToB: [[2, 23], [7.6, 15], [9.5, 8], [11, 3], [16, -4], [20, 10], [20, 16]],
  northToA: [[0, -23], [-8, -18], [-16, -19], [-21, -19]],
  northToB: [[0, -23], [8, -19], [16, -17], [20, 2], [20, 16]],
  holdA: [[-21, -24], [-21, -19]],
  holdB: [[20, -1], [20, 16]],
};
export const SITE_ANCHORS = SITES.map((s) => ({ id: s.id, name: s.name, x: s.x, z: s.z, r: s.r }));