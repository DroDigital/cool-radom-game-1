// Procedural WebAudio: punchy sound effects plus a looping arcade track. No audio files.
let ctx = null, out = null, sfxBus = null, musBus = null, noiseBuf = null;
let muted = false, step = 0, nextTime = 0, overdrive = false;

const ROOTS = [33, 29, 36, 31];           // Am  F  C  G  (bass MIDI notes)
const ARP = [0, 3, 7, 12, 7, 3, 0, 10];   // arpeggio shape in semitones
const PENT = [0, 2, 4, 7, 9];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  out = ctx.createGain();
  out.gain.value = muted ? 0 : 0.85;
  out.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.6;
  sfxBus.connect(out);
  musBus = ctx.createGain();
  musBus.gain.value = 0.22;
  musBus.connect(out);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  nextTime = ctx.currentTime + 0.12;
  setInterval(schedule, 30);
}

export function setMuted(m) {
  muted = m;
  if (out) out.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.05);
}

export function isMuted() {
  return muted;
}

export function setOverdrive(on) {
  overdrive = !!on;
}

// ---------- music scheduler (look-ahead, sample accurate) ----------
function schedule() {
  if (!ctx) return;
  while (nextTime < ctx.currentTime + 0.12) {
    const bpm = 124 + (overdrive ? 16 : 0);
    const spb = 60 / bpm / 4; // one sixteenth note
    playStep(step, nextTime, spb);
    nextTime += spb;
    step++;
  }
}

function playStep(s, t, spb) {
  const pos = s % 16;
  const root = ROOTS[Math.floor(s / 16) % 4];
  if (pos % 4 === 0) kick(t);
  if (pos % 2 === 1) hat(t, pos % 4 === 3 ? 0.9 : 0.4);
  if (pos % 2 === 0) bass(t, spb * 1.8, root + (pos % 8 === 4 ? 12 : 0));
  arp(t, root + 24 + ARP[s % ARP.length], spb);
}

function kick(t) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(155, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
  g.gain.setValueAtTime(0.95, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  o.connect(g).connect(musBus);
  o.start(t);
  o.stop(t + 0.26);
}

function hat(t, v) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.22 * v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  src.connect(f).connect(g).connect(musBus);
  src.start(t, Math.random());
  src.stop(t + 0.06);
}

function bass(t, dur, m) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(mtof(m), t);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 6;
  f.frequency.setValueAtTime(overdrive ? 1800 : 900, t);
  f.frequency.exponentialRampToValueAtTime(160, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(musBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function arp(t, m, spb) {
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(mtof(m), t);
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = overdrive ? 3800 : 2200;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.07, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + spb * 0.85);
  o.connect(f).connect(g).connect(musBus);
  o.start(t);
  o.stop(t + spb);
}

// ---------- sound effects ----------
function tone(type, f, t, dur, vol, slideTo = 0) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(t, dur, vol, type, f0, f1) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const flt = ctx.createBiquadFilter();
  flt.type = type;
  flt.Q.value = 1.2;
  flt.frequency.setValueAtTime(f0, t);
  flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt).connect(g).connect(sfxBus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.02);
}

export const sfx = {
  pickup(streak) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const i = Math.min(streak, 24); // climb a pentatonic ladder, capped to stay audible
    const m = 60 + Math.floor(i / 5) * 12 + PENT[i % 5];
    tone('triangle', mtof(m), t, 0.16, 0.32);
    tone('sine', mtof(m + 12), t, 0.1, 0.12);
  },
  crystal() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [0, 4, 7, 12].forEach((n, i) => tone('triangle', mtof(76 + n), t + i * 0.05, 0.22, 0.3));
  },
  near() {
    if (!ctx) return;
    noise(ctx.currentTime, 0.3, 0.3, 'bandpass', 500, 3400);
  },
  smash() {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 0.45, 0.7, 'lowpass', 2600, 180);
    tone('sine', 120, t, 0.4, 0.9, 32);
  },
  crash() {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 1.1, 1.0, 'lowpass', 1800, 90);
    tone('sawtooth', 240, t, 0.9, 0.35, 36);
  },
  overdrive() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone('sawtooth', 110, t, 0.8, 0.2, 990);
    noise(t, 0.8, 0.35, 'bandpass', 250, 4500);
  },
  ready() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone('square', mtof(88), t, 0.12, 0.12);
    tone('square', mtof(93), t + 0.08, 0.14, 0.12);
  },
  zone() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [0, 4, 7, 12].forEach((n, i) => tone('triangle', mtof(64 + n), t + i * 0.09, 0.22, 0.28));
  },
};
