
import { state, actors } from './state.js';
import { WEAPONS, GRENADES, BUY_LIST, HUD, PALETTE, SITES, TEAMS, TUNE } from './config.js';
import { clockText } from './rounds.js';
const $ = (id) => document.getElementById(id);
let el = {};
let onBuy = null, onRestart = null, colliders = [];
function setText(node, v) { if (node && node._v !== v) { node._v = v; node.textContent = v; } }
function setStyle(node, prop, v) { if (node && node._s !== v + prop) { node._s = v + prop; node.style[prop] = v; } }
export function mount(opts) {
  opts = opts || {};
  onBuy = opts.onBuy; onRestart = opts.onRestart;
  colliders = (opts.world && opts.world.colliders) || [];
  el = {
    timer: $('timer'), score: $('score-value'), money: $('money-value'),
    hp: $('health-value'), armour: $('armour-value'), hpFill: $('health-fill'),
    mag: $('ammo-mag'), reserve: $('ammo-reserve'), weapon: $('weapon-name'),
    killfeed: $('killfeed'), radio: $('radio'), toast: $('toast'),
    minimap: $('minimap'), crosshair: $('crosshair'), hitmarker: $('hitmarker'),
    buyMenu: $('buy-menu'), buyList: $('buy-list'), buyMoney: $('buy-money'),
    banner: $('round-banner'), end: $('end-overlay'), endTitle: $('end-title'),
    endCopy: $('end-copy'), endBtn: $('end-restart'), phase: $('phase-banner'),
    objective: $('objective'), fuse: $('objective-fuse'), defuse: $('defuse-fill'),
    defuseRow: $('defuse-row'), damage: $('damage'), dmgDirs: $('damage-dirs'),
  };
  if (el.minimap) { el.minimap.width = HUD.minimapSize; el.minimap.height = HUD.minimapSize; }
  buildBuyMenu();
  if (el.endBtn) el.endBtn.addEventListener('click', () => { if (onRestart) onRestart(); });
  if (el.buyMenu) {
    el.buyMenu.removeAttribute('hidden');
    el.buyMenu.classList.add('gone');
    el.buyMenu.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
}
function buildBuyMenu() {
  if (!el.buyList) return;
  const cats = { primary: 'PRIMARY', secondary: 'SIDEARM', gear: 'GEAR' };
  const byCat = {};
  for (const item of BUY_LIST) (byCat[item.cat] = byCat[item.cat] || []).push(item);
  el.buyList.innerHTML = '';
  for (const cat of ['primary', 'secondary', 'gear']) {
    const head = document.createElement('div');
    head.className = 'buy-cat'; head.textContent = cats[cat];
    el.buyList.appendChild(head);
    for (const item of byCat[cat] || []) {
      const row = document.createElement('button');
      row.className = 'buy-item'; row.dataset.key = item.key;
      row.innerHTML = '<span class="buy-name">' + item.label + '</span><span class="buy-price">$' + item.price + '</span>';
      row.addEventListener('click', () => { if (onBuy) onBuy(item.key); });
      el.buyList.appendChild(row);
    }
  }
}
function renderBuy() {
  if (!el.buyMenu || !el.buyList) return;
  const show = state.buyOpen;
  if (el.buyMenu.classList.contains('gone') === show) el.buyMenu.classList.toggle('gone', !show);
  if (!show) return;
  const bank = state.money[state.player.team];
  setText(el.buyMoney, '$' + Math.floor(bank));
  for (const row of el.buyList.querySelectorAll('.buy-item')) {
    const item = BUY_LIST.find((i) => i.key === row.dataset.key);
    row.disabled = !item || bank < item.price;
  }
}
function renderReadouts() {
  const p = state.player;
  setText(el.timer, clockText());
  setText(el.score, state.score.home + ' : ' + state.score.away);
  setText(el.money, '$' + Math.floor(state.money[p.team]));
  setText(el.hp, String(Math.max(0, Math.round(p.hp))));
  setText(el.armour, p.armour > 0 ? '+' + Math.round(p.armour) : p.helmet ? 'HELM' : '+0');
  setStyle(el.hpFill, 'width', Math.max(0, Math.min(100, p.hp)) + '%');
  const wp = WEAPONS[p.weapon] || WEAPONS.pipit;
  const mag = p.mags[p.weapon] || { mag: 0, reserve: 0 };
  setText(el.mag, String(mag.mag));
  setText(el.reserve, '/ ' + mag.reserve);
  setText(el.weapon, wp.name + '  ·  ' + wp.role + (p.reloadT > 0 ? '  RELOADING' : ''));
  const nades = ['ironbloom', 'greyveil'].map((k) => (p.grenades[k] ? p.grenades[k] + '×' + GRENADES[k].name.split(' ')[0] : null)).filter(Boolean);
  setText(el.phase, phaseBanner() + (nades.length ? '     ' + nades.join('  ') : ''));
}
function phaseBanner() {
  if (state.phase === 'menu') return 'STANDBY';
  if (state.phase === 'buy') return 'BUY PHASE  ·  B closes';
  if (state.phase === 'roundend') return 'ROUND ' + state.round + ' OVER  ·  ' + (state.roundWinner === 'home' ? TEAMS.home.name : TEAMS.away.name) + ' ' + state.roundReason;
  if (state.phase === 'matchover') return 'MATCH OVER';
  const sites = SITES.map((s) => s.id + ' ' + s.name).join('   ');
  return 'ROUND ' + state.round + '   ' + sites;
}
function renderFeed() {
  if (!el.killfeed) return;
  const rows = state.killfeed.filter((k) => state.elapsed - k.t < HUD.killfeedLife);
  const key = rows.map((k) => k.killer + k.victim + k.weapon + k.head).join('|');
  if (el.killfeed._k === key) return;
  el.killfeed._k = key;
  el.killfeed.innerHTML = rows.map((k) => {
    const a = k.killerTeam === 'home' ? 'mix-a' : 'mix-b';
    return '<div class="feed ' + a + '"><span class="feed-w">' + (k.weapon || '') + (k.head ? ' · HEAD' : '') + '</span>'
      + k.killer + '  ▸  ' + k.victim + '</div>';
  }).join('');
}
function renderBanners() {
  setText(el.radio, state.radio && state.elapsed - state.radio.time < HUD.radioLife ? state.radio.text : '');
  setText(el.toast, state.toast ? state.toast.text : '');
  setText(el.banner, state.phase === 'roundend' ? (state.roundWinner === 'home' ? 'PYRE WIN THE ROUND' : 'QUENCH WIN THE ROUND') : '');
  const over = state.phase === 'matchover';
  if (el.end && el.end.hasAttribute('hidden') === over) el.end.toggleAttribute('hidden', !over);
  if (over) {
    setText(el.endTitle, state.matchWinner === 'draw' ? 'DRAW' : (state.matchWinner === 'home' ? 'PYRE WIN THE MATCH' : 'QUENCH WIN THE MATCH'));
    setText(el.endCopy, 'Final score ' + state.score.home + ' : ' + state.score.away + '  ·  press ENTER to play again');
  }
  const hm = state.hitmarker > 0;
  setStyle(el.hitmarker, 'opacity', hm ? '1' : '0');
  if (el.hitmarker) {
    el.hitmarker.style.transform = 'translate(-50%,-50%) scale(' + (hm ? (state.hitmarkerKill ? 1.6 : 1.22) : 1) + ')';
    el.hitmarker.classList.toggle('kill', hm && state.hitmarkerKill);
  }
}
function siteNameOf(id) { const s = SITES.find((x) => x.id === id); return s ? s.name : ''; }
function renderObjective() {
  const b = state.bomb;
  let text = '', fuse = '';
  if (b && !b.exploded) {
    text = (b.plantedBy === 'home' ? 'CHARGE ARMED  ·  ' : 'ENEMY CHARGE  ·  ') + b.site + ' ' + siteNameOf(b.site);
    const f = Math.max(0, b.fuse);
    fuse = (f < 10 ? f.toFixed(1) : Math.ceil(f) + '') + 's';
  } else if (state.phase === 'live') {
    const carrier = state.player.team === 'home';
    text = carrier ? 'PLANT THE CHARGE  ·  ' + SITES.map((s) => s.id + ' ' + s.name).join('   ')
                   : 'DEFEND BOTH SITES  ·  ' + SITES.map((s) => s.id + ' ' + s.name).join('   ');
  } else if (state.phase === 'buy') {
    text = 'BUY PHASE';
  } else if (state.phase === 'roundend' || state.phase === 'matchover') {
    text = state.roundWinner === 'home' ? 'ROUND WON  ·  PYRE' : 'ROUND LOST  ·  QUENCH';
  }
  if (el.objective) {
    el.objective.classList.toggle('gone', !text);
    el.objective.classList.toggle('armed', !!b && !b.exploded);
    setText(el.objective, text);
  }
  setText(el.fuse, fuse);
  if (el.fuse) el.fuse.classList.toggle('gone', !fuse);
  const prog = b && b.defuser && b.defuseT > 0 ? Math.min(1, b.defuseT / TUNE.defuseTime) : 0;
  if (el.defuseRow) el.defuseRow.classList.toggle('gone', prog <= 0);
  setStyle(el.defuse, 'width', (prog * 100).toFixed(1) + '%');
}
function renderDamage() {
  const p = state.player, now = state.elapsed;
  let recent = 0, dirs = '';
  for (const d of state.damageFrom) {
    const age = now - d.t;
    if (age < 0 || age > HUD.hurtLife) continue;
    recent = Math.max(recent, 1 - age / HUD.hurtLife);
    if (age < HUD.hurtLife * 0.8) {
      const bearing = Math.atan2(d.x - p.x, d.z - p.z) - p.yaw;   
      dirs += '<i class="wedge" style="transform:rotate(' + (-bearing * 180 / Math.PI).toFixed(0) + 'deg)"></i>';
    }
  }
  setStyle(el.damage, 'opacity', (recent * 0.8).toFixed(3));
  if (el.dmgDirs && el.dmgDirs._d !== dirs) { el.dmgDirs._d = dirs; el.dmgDirs.innerHTML = dirs; }
}
function mapPoint(x, z) {
  const R = HUD.minimapRange, c = HUD.minimapSize / 2;
  return [c + (x / R) * c, c + (z / R) * c];
}
function renderMinimap() {
  const cv = el.minimap;
  if (!cv) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const S = HUD.minimapSize, R = HUD.minimapRange, c = S / 2;
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath(); ctx.arc(c, c, c - 1, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = 'rgba(8,10,12,0.62)'; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(150,158,164,0.30)';
  ctx.lineWidth = 1;
  let drawn = 0;
  for (const c of colliders) {
    if (drawn > 90 || c.max.y - c.min.y < 1.4) continue;
    if (c.max.x - c.min.x < 0.35 || c.max.z - c.min.z < 0.35) continue;
    const [x0, y0] = mapPoint(c.min.x, c.min.z), [x1, y1] = mapPoint(c.max.x, c.max.z);
    ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    drawn++;
  }
  ctx.strokeStyle = 'rgba(229,165,10,0.18)';
  ctx.beginPath(); ctx.arc(c, c, c * 0.5, 0, Math.PI * 2); ctx.stroke();
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(190,196,199,0.6)'; ctx.fillText('N', c - 3, 11);
  for (const s of SITES) {
    const [x, y] = mapPoint(s.x, s.z);
    ctx.beginPath(); ctx.arc(x, y, (s.r / R) * c, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(229,165,10,0.14)'; ctx.fill();
    ctx.fillStyle = 'rgba(229,165,10,0.9)'; ctx.fillText(s.id, x - 3, y + 3);
  }
  for (const sm of state.smokes) {
    const [x, y] = mapPoint(sm.x, sm.z);
    ctx.beginPath(); ctx.arc(x, y, (sm.r / R) * c, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(190,196,199,0.20)'; ctx.fill();
  }
  for (const a of actors()) {
    if (!a.alive || a === state.player) continue;
    const [x, y] = mapPoint(a.x, a.z);
    ctx.fillStyle = a.team === 'home' ? 'rgba(255,106,30,0.85)' : 'rgba(159,216,230,0.92)';
    ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
  }
  if (state.bomb && !state.bomb.exploded) {
    const [x, y] = mapPoint(state.bomb.x, state.bomb.z);
    ctx.fillStyle = ((state.elapsed * 3) | 0) % 2 === 0 ? 'rgba(255,68,51,0.95)' : 'rgba(255,68,51,0.3)';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  }
  const [px, py] = mapPoint(state.player.x, state.player.z);
  ctx.translate(px, py); ctx.rotate(-state.player.yaw);
  ctx.beginPath();
  ctx.moveTo(0, -5); ctx.lineTo(3.4, 4); ctx.lineTo(0, 2.2); ctx.lineTo(-3.4, 4); ctx.closePath();
  ctx.fillStyle = '#' + PALETTE.meter.toString(16).padStart(6, '0'); ctx.fill();
  ctx.restore();
}
export function render() {
  renderReadouts();
  renderFeed();
  renderBanners();
  renderObjective();
  renderDamage();
  renderBuy();
  renderMinimap();
  const spread = state.player.spread || 0;
  setStyle(el.crosshair, 'transform', 'translate(-50%,-50%) scale(' + (1 + Math.min(3, spread) * 0.09).toFixed(2) + ')');
}