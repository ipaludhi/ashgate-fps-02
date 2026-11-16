// Navigasi bot: grid 0.5 m di atas collider dunia + A* 8 arah + penghalusan garis-pandang.
// Aturan lewat dibuat sama dengan fisika di player.js (slide/land): rintangan <= TUNE.stepUp bisa dinaiki.
import { TUNE } from './config.js';
import { BOUNDS } from './map.js';

const CELL = 0.5;
const FLOOR_TAGS = { floor: 1, site: 1, low: 1 };
let N = 0, G = null, H = null, X0 = 0;

function inside(c, x, z) { return x >= c.min.x && x <= c.max.x && z >= c.min.z && z <= c.max.z; }

export function buildNav(world) {
  const cols = world.colliders;
  const rad = TUNE.botRadius + 0.06;
  const step = TUNE.stepUp + 0.02;
  X0 = BOUNDS.min; N = Math.ceil((BOUNDS.max - BOUNDS.min) / CELL);
  G = new Uint8Array(N * N); H = new Float32Array(N * N);
  const sorted = cols.slice().sort((a, b) => a.max.y - b.max.y);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = X0 + (i + 0.5) * CELL, z = X0 + (j + 0.5) * CELL;
    let g = 0;
    for (const c of sorted) if (inside(c, x, z) && c.max.y <= g + step) g = Math.max(g, c.max.y);
    H[j * N + i] = g;
    let blocked = 0;
    for (const c of cols) {
      if (FLOOR_TAGS[c.tag]) continue;
      if (c.max.y <= g + step || c.min.y >= g + TUNE.playerHeight) continue;
      if (x + rad > c.min.x && x - rad < c.max.x && z + rad > c.min.z && z - rad < c.max.z) { blocked = 1; break; }
    }
    G[j * N + i] = blocked;
  }
}

const ci = (v) => Math.max(0, Math.min(N - 1, Math.floor((v - X0) / CELL)));
const cx = (i) => X0 + (i + 0.5) * CELL;

function free(i, j) { return i >= 0 && j >= 0 && i < N && j < N && !G[j * N + i]; }
function link(i, j, ni, nj) {
  if (!free(ni, nj)) return false;
  if (Math.abs(H[nj * N + ni] - H[j * N + i]) > TUNE.stepUp) return false;
  if (ni !== i && nj !== j) return free(ni, j) && free(i, nj);   // tidak potong sudut
  return true;
}
function nearestFree(i, j) {
  if (free(i, j)) return [i, j];
  for (let r = 1; r < 12; r++) {
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      if (free(i + di, j + dj)) return [i + di, j + dj];
    }
  }
  return null;
}
function los(a, b) {
  const [i0, j0] = a, [i1, j1] = b;
  const n = Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0)) * 2 || 1;
  let pi = i0, pj = j0;
  for (let k = 1; k <= n; k++) {
    const i = Math.round(i0 + ((i1 - i0) * k) / n), j = Math.round(j0 + ((j1 - j0) * k) / n);
    if (i === pi && j === pj) continue;
    if (!link(pi, pj, i, j) && !(Math.abs(i - pi) + Math.abs(j - pj) === 2 && link(pi, pj, i, pj) && link(i, pj, i, j))) return false;
    pi = i; pj = j;
  }
  return true;
}

// Heap biner kecil untuk open set.
class Heap {
  constructor() { this.a = []; }
  push(k, v) { const a = this.a; a.push([k, v]); let c = a.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (a[p][0] <= a[c][0]) break; [a[p], a[c]] = [a[c], a[p]]; c = p; } }
  pop() { const a = this.a, t = a[0], l = a.pop(); if (a.length) { a[0] = l; let c = 0; for (;;) { let m = c; const L = 2 * c + 1, R = L + 1; if (L < a.length && a[L][0] < a[m][0]) m = L; if (R < a.length && a[R][0] < a[m][0]) m = R; if (m === c) break; [a[m], a[c]] = [a[c], a[m]]; c = m; } } return t; }
  get size() { return this.a.length; }
}
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

// Jalur dari (x0,z0) ke (x1,z1) sebagai [[x,z],...] tanpa titik awal; null kalau tidak ada.
export function findPath(x0, z0, x1, z1) {
  if (!G) return null;
  const s = nearestFree(ci(x0), ci(z0)), e = nearestFree(ci(x1), ci(z1));
  if (!s || !e) return null;
  const sk = s[1] * N + s[0], ek = e[1] * N + e[0];
  const gs = new Float32Array(N * N).fill(Infinity), from = new Int32Array(N * N).fill(-1), done = new Uint8Array(N * N);
  const open = new Heap();
  gs[sk] = 0; open.push(0, sk);
  while (open.size) {
    const [, k] = open.pop();
    if (done[k]) continue;
    done[k] = 1;
    if (k === ek) break;
    const i = k % N, j = (k / N) | 0;
    for (const [di, dj, w] of DIRS) {
      const ni = i + di, nj = j + dj;
      if (!link(i, j, ni, nj)) continue;
      const nk = nj * N + ni, ng = gs[k] + w;
      if (ng < gs[nk]) { gs[nk] = ng; from[nk] = k; open.push(ng + Math.hypot(ni - e[0], nj - e[1]), nk); }
    }
  }
  if (from[ek] === -1 && sk !== ek) return null;
  const cells = [];
  for (let k = ek; k !== -1; k = from[k]) cells.push([k % N, (k / N) | 0]);
  cells.reverse();
  // penghalusan: lompat ke titik terjauh yang masih terlihat lurus
  const out = [];
  let at = 0;
  while (at < cells.length - 1) {
    let nx = at + 1;
    for (let t = cells.length - 1; t > at + 1; t--) if (los(cells[at], cells[t])) { nx = t; break; }
    out.push([cx(cells[nx][0]), cx(cells[nx][1])]);
    at = nx;
  }
  // tujuan asli (bukan pusat sel) sebagai titik akhir kalau selnya bebas
  if (out.length && free(ci(x1), ci(z1))) out[out.length - 1] = [x1, z1];
  return out;
}

// Titik tujuan berikutnya untuk bot a menuju (gx,gz). Rute di-cache di a.ai.nav dan dihitung ulang
// kalau tujuan bergeser > 1.5 m atau sudah 1.2 s.
export function waypoint(a, gx, gz, now) {
  const ai = a.ai;
  let n = ai.nav;
  if (!n || Math.hypot(n.gx - gx, n.gz - gz) > 1.5 || now - n.t > 1.2 || !n.pts.length) {
    const pts = findPath(a.x, a.z, gx, gz);
    n = ai.nav = { gx, gz, t: now, pts: pts || [] };
  }
  while (n.pts.length > 1 && Math.hypot(n.pts[0][0] - a.x, n.pts[0][1] - a.z) < 0.7) n.pts.shift();
  if (!n.pts.length) return [gx, gz];
  return n.pts[0];
}
