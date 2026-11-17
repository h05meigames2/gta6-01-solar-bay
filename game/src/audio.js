// Procedural sound for SOLAR BAY: every sound is synthesized with WebAudio, no files.
// The context is created on the first user gesture; every call is guarded so a
// headless screenshot run (no gesture) stays silent and error-free.
let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let sirenOn = false;
let sirenOscA = null;
let sirenOscB = null;
let sirenGain = null;
let musicTimer = null;
let musicStep = 0;

function ensure() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch {
    return null;
  }
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
  startMusic();
}

function blip(freq, dur, type = 'sine', vol = 0.2, slideTo = 0) {
  const c = ensure();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  } catch {
    // Audio is decoration; never break the game.
  }
}

function noiseBurst(dur, vol = 0.3, low = 400) {
  const c = ensure();
  if (!c) return;
  try {
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = low;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  } catch {
    // ignore
  }
}

export const sfx = {
  pickup() { blip(660, 0.12, 'sine', 0.22); setTimeout(() => blip(990, 0.16, 'sine', 0.2), 90); },
  cash() { blip(880, 0.1, 'triangle', 0.22); setTimeout(() => blip(1174, 0.14, 'triangle', 0.2), 80); setTimeout(() => blip(1568, 0.2, 'triangle', 0.18), 170); },
  punch() { noiseBurst(0.12, 0.35, 300); blip(120, 0.1, 'square', 0.15, 60); },
  gunshot() { noiseBurst(0.16, 0.5, 1800); blip(220, 0.08, 'square', 0.2, 55); },
  crash() { noiseBurst(0.25, 0.4, 500); },
  door() { blip(180, 0.08, 'square', 0.12, 120); },
  wanted() { blip(392, 0.18, 'sawtooth', 0.16); setTimeout(() => blip(311, 0.24, 'sawtooth', 0.16), 160); },
  mission() { blip(523, 0.12, 'triangle', 0.2); setTimeout(() => blip(659, 0.12, 'triangle', 0.2), 110); setTimeout(() => blip(784, 0.22, 'triangle', 0.2), 220); },
  hurt() { blip(160, 0.2, 'sawtooth', 0.2, 70); },
  busted() { blip(220, 0.3, 'sawtooth', 0.2, 110); setTimeout(() => blip(165, 0.4, 'sawtooth', 0.2, 82), 260); },
};

// Engine hum follows driving speed; call every frame with 0..1 throttle.
export function setEngine(level, on) {
  const c = ensure();
  if (!c) return;
  try {
    if (on && !engineOsc) {
      engineOsc = c.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = c.createGain();
      engineGain.gain.value = 0;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      engineOsc.connect(f);
      f.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    }
    if (!engineOsc) return;
    if (!on) {
      engineGain.gain.setTargetAtTime(0, c.currentTime, 0.1);
      return;
    }
    engineOsc.frequency.setTargetAtTime(55 + level * 130, c.currentTime, 0.08);
    engineGain.gain.setTargetAtTime(0.03 + level * 0.05, c.currentTime, 0.08);
  } catch {
    // ignore
  }
}

// Two-tone police siren while wanted > 0.
export function setSiren(on) {
  const c = ensure();
  if (!c || on === sirenOn) return;
  sirenOn = on;
  try {
    if (on) {
      sirenOscA = c.createOscillator();
      sirenOscA.type = 'sine';
      sirenOscA.frequency.value = 700;
      sirenOscB = c.createOscillator();
      sirenOscB.type = 'sine';
      sirenOscB.frequency.value = 950;
      sirenGain = c.createGain();
      sirenGain.gain.value = 0;
      const lfo = c.createOscillator();
      lfo.frequency.value = 1.1;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 0.035;
      lfo.connect(lfoGain);
      lfoGain.connect(sirenGain.gain);
      sirenOscA.connect(sirenGain);
      sirenOscB.connect(sirenGain);
      sirenGain.connect(master);
      sirenOscA.start();
      sirenOscB.start();
      lfo.start();
      sirenGain.gain.value = 0.035;
      sirenOscA._lfo = lfo;
    } else if (sirenOscA) {
      const a = sirenOscA;
      const b = sirenOscB;
      const lfo = a._lfo;
      try { a.stop(); b.stop(); if (lfo) lfo.stop(); } catch { /* already stopped */ }
      sirenOscA = null;
      sirenOscB = null;
    }
  } catch {
    sirenOn = false;
  }
}

// A slow, sunny bass-and-pad loop: four chords, one note a beat, no samples.
const CHORDS = [
  [130.81, 164.81, 196.0],
  [110.0, 164.81, 196.0],
  [87.31, 130.81, 164.81],
  [98.0, 146.83, 196.0],
];
function startMusic() {
  const c = ensure();
  if (!c || musicTimer) return;
  musicTimer = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    const chord = CHORDS[musicStep % CHORDS.length];
    musicStep += 1;
    for (const freq of chord) blip(freq, 1.9, 'triangle', 0.045);
    blip(chord[0] * 2, 0.5, 'sine', 0.05);
  }, 500);
}
