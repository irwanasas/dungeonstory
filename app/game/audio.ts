export type Cue =
  | 'tap'
  | 'place'
  | 'door'
  | 'step'
  | 'swing'
  | 'impact'
  | 'trap'
  | 'fire'
  | 'frost'
  | 'poison'
  | 'monster'
  | 'coin'
  | 'heal'
  | 'death'
  | 'win'
  | 'lose'
  | 'escape'
  | 'lord';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambient: { osc: OscillatorNode[]; gain: GainNode } | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0): void {
  const a = ac();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur: number, vol: number, hp: number, delay = 0): void {
  const a = ac();
  if (!a || !master) return;
  const t = a.currentTime + delay;
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = hp;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start(t);
}

export function play(cue: Cue): void {
  switch (cue) {
    case 'tap':
      tone(520, 0.05, 'square', 0.06);
      break;
    case 'place':
      tone(300, 0.07, 'square', 0.09);
      tone(460, 0.09, 'square', 0.07, undefined, 0.05);
      break;
    case 'door':
      noise(0.35, 0.14, 240);
      tone(90, 0.4, 'sawtooth', 0.07, 60);
      break;
    case 'step':
      noise(0.06, 0.05, 900);
      break;
    case 'swing':
      noise(0.1, 0.09, 2400);
      tone(700, 0.07, 'square', 0.04, 300);
      break;
    case 'impact':
      noise(0.12, 0.16, 500);
      tone(160, 0.12, 'square', 0.1, 70);
      break;
    case 'trap':
      tone(220, 0.12, 'sawtooth', 0.11, 90);
      noise(0.16, 0.12, 1400);
      break;
    case 'fire':
      noise(0.5, 0.13, 900);
      tone(120, 0.4, 'sawtooth', 0.06, 320);
      break;
    case 'frost':
      tone(1400, 0.24, 'triangle', 0.08, 620);
      tone(2100, 0.18, 'sine', 0.05, 1100, 0.05);
      break;
    case 'poison':
      noise(0.45, 0.07, 420);
      tone(180, 0.4, 'sine', 0.05, 120);
      break;
    case 'monster':
      tone(110, 0.32, 'sawtooth', 0.12, 70);
      noise(0.24, 0.08, 320);
      break;
    case 'coin':
      tone(1180, 0.07, 'square', 0.08);
      tone(1560, 0.1, 'square', 0.07, undefined, 0.06);
      break;
    case 'heal':
      tone(520, 0.14, 'sine', 0.08, 880);
      tone(780, 0.16, 'sine', 0.06, 1180, 0.07);
      break;
    case 'death':
      tone(320, 0.5, 'sawtooth', 0.13, 60);
      noise(0.4, 0.1, 260);
      break;
    case 'win':
      [392, 523, 659, 784].forEach((f, i) => tone(f, 0.26, 'square', 0.09, undefined, i * 0.11));
      break;
    case 'lose':
      [440, 392, 330, 262].forEach((f, i) => tone(f, 0.3, 'triangle', 0.09, undefined, i * 0.13));
      break;
    case 'escape':
      [523, 440, 392].forEach((f, i) => tone(f, 0.2, 'sine', 0.08, undefined, i * 0.1));
      break;
    case 'lord':
      [131, 165, 196].forEach((f, i) => tone(f, 0.7, 'sawtooth', 0.1, undefined, i * 0.16));
      break;
  }
}

export function startAmbient(): void {
  const a = ac();
  if (!a || !master || ambient) return;
  const gain = a.createGain();
  gain.gain.value = 0.05;
  gain.connect(master);
  const osc: OscillatorNode[] = [];
  for (const f of [55, 82.5, 110]) {
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const lfo = a.createOscillator();
    lfo.frequency.value = 0.07 + Math.random() * 0.09;
    const lg = a.createGain();
    lg.gain.value = 3;
    lfo.connect(lg);
    lg.connect(o.frequency);
    o.connect(gain);
    o.start();
    lfo.start();
    osc.push(o, lfo);
  }
  ambient = { osc, gain };
}

