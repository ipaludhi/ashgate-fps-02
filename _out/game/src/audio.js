
let ac = null, master = null, noiseBuf = null, enabled = true;
function ctx() {
  if (ac) return ac;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try { ac = new AC(); } catch (e) { return null; }
  master = ac.createGain();
  master.gain.value = 0.42;
  master.connect(ac.destination);
  return ac;
}
export function unlock() {
  const c = ctx();
  if (!c) return;
  if (c.state === 'suspended' && c.resume) c.resume().catch(() => {});
}
function brownNoise(c) {
  if (noiseBuf) return noiseBuf;
  const n = Math.max(256, Math.floor(c.sampleRate * 0.6));
  noiseBuf = c.createBuffer(1, n, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) { last = (last + (Math.random() * 2 - 1) * 0.32) * 0.94; d[i] = last; }
  return noiseBuf;
}
function burst(at, dur, from, to, gain, q) {
  const c = ac, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = brownNoise(c);
  src.loop = true;
  f.type = 'bandpass'; f.Q.value = q || 1.1;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, to), at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(at); src.stop(at + dur + 0.02);
}
function tone(at, dur, f0, f1, gain, type) {
  const c = ac, o = c.createOscillator(), g = c.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(master);
  o.start(at); o.stop(at + dur + 0.02);
}
function at(vol, dist) { return ac.currentTime + (dist ? Math.min(0.5, dist / 340) : 0) + 0.001 * Math.random(); }
export function shot(kind, dist) {
  if (!enabled || !ctx() || !master) return;
  const t = at(1, dist), heavy = kind === 'brazier' || kind === 'rivet';
  const vol = dist ? Math.max(0.12, 0.85 - dist / 90) : 0.85;
  burst(t, heavy ? 0.26 : 0.15, heavy ? 2600 : 3400, heavy ? 260 : 420, 0.55 * vol, 1.2);
  tone(t, 0.06, heavy ? 190 : 260, 70, 0.30 * vol, 'square');
  if (!dist) tone(t + 0.09, 0.10, 1500, 700, 0.05, 'triangle');   
}
export function hit(kill) {
  if (!enabled || !ctx() || !master) return;
  const t = at();
  tone(t, 0.05, 1250, 900, 0.16, 'square');
  if (kill) { tone(t + 0.07, 0.09, 900, 1500, 0.15, 'triangle'); tone(t + 0.16, 0.12, 1500, 2100, 0.11, 'triangle'); }
}
export function reload(stage) {
  if (!enabled || !ctx() || !master) return;
  const t = at();
  burst(t + (stage === 'end' ? 0.28 : 0), 0.05, 2600, 900, 0.22, 3.0);
  tone(t + (stage === 'end' ? 0.3 : 0.02), 0.04, 420, 300, 0.10, 'square');
}
export function step(hard) {
  if (!enabled || !ctx() || !master) return;
  burst(at(), 0.06, 700, 190, hard ? 0.14 : 0.085, 1.6);
}
export function plant() {
  if (!enabled || !ctx() || !master) return;
  const t = at();
  tone(t, 1.0, 240, 1180, 0.14, 'sawtooth');
  burst(t, 0.5, 900, 300, 0.18, 2.0);
}
export function fusePip(secsLeft) {
  if (!enabled || !ctx() || !master) return;
  const t = at();
  const fast = secsLeft < 10;
  tone(t, fast ? 0.07 : 0.05, fast ? 1750 : 1350, 1200, 0.10, 'square');
}
export function explosion(dist) {
  if (!enabled || !ctx() || !master) return;
  const t = at(1, dist);
  burst(t, 1.1, 900, 60, 0.7, 0.8);
  tone(t, 0.6, 90, 32, 0.5, 'sine');
  burst(t + 0.06, 0.5, 400, 120, 0.3, 1.0);
}
export function throwable(kind) {
  if (!enabled || !ctx() || !master) return;
  const t = at();
  if (kind === 'greyveil') { burst(t, 0.7, 1400, 260, 0.22, 1.0); tone(t, 0.4, 300, 90, 0.08, 'sine'); }
  else { burst(t, 0.5, 1900, 120, 0.5, 1.0); tone(t, 0.3, 140, 40, 0.35, 'sine'); }
}
export function ui(ok) {
  if (!enabled || !ctx() || !master) return;
  const t = at();
  tone(t, 0.05, ok ? 780 : 300, ok ? 1180 : 240, 0.12, 'triangle');
}
export function radio() {
  if (!enabled || !ctx() || !master) return;
  const t = at();
  burst(t, 0.05, 3000, 1400, 0.10, 3.5);
  tone(t + 0.06, 0.07, 980, 980, 0.11, 'square');
  tone(t + 0.17, 0.07, 1320, 1320, 0.10, 'square');
}
export function roundCue(win) {
  if (!enabled || !ctx() || !master) return;
  const t = at();
  const seq = win ? [523, 659, 784] : [392, 330, 262];
  for (let i = 0; i < seq.length; i++) tone(t + i * 0.13, 0.16, seq[i], seq[i], 0.13, 'triangle');
}