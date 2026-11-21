// ============================================================================
// Anki Studio — Zen Mode Acoustic Engine v2 (Pure Offline Web Audio Synthesis)
// Zero external audio assets, zero network requests, 100% offline & SSR-safe.
//
// Craft upgrades:
// 1. Algorithmic wooden-hall ConvolverNode reverb (spatial sanctuary resonance)
// 2. Hand-hammered bronze Orin / Tibetan singing bowl with felt-mallet strike
//    transient + 4 inharmonic flexural modes with independent mode-splitting beating
// 3. Sculpted Washi paper turn (filtered pink micro-noise) & kaya-wood Go-stone
//    settle tap (soft resonant wood body)
// 4. Optional procedural seamless ambient soundscapes ('silent' | 'rain' |
//    'wind' | 'warmth') with logarithmic fade-in/out & automatic speech ducking
// ============================================================================

import type { ZenAmbienceScene } from './zenMode';

type AudioContextCtor = typeof AudioContext;

interface SpatialBus {
  dry: GainNode;
  wet: GainNode;
  reverb: ConvolverNode;
}

interface ActiveAmbienceGraph {
  scene: Exclude<ZenAmbienceScene, 'silent'>;
  sceneGain: GainNode;
  duckGain: GainNode;
  targetGain: number;
  cleanup: () => void;
}

let sharedCtx: AudioContext | null = null;
let sharedSfxGain: GainNode | null = null;
let sharedAmbienceGain: GainNode | null = null;
let sharedBus: SpatialBus | null = null;
let activeAmbience: ActiveAmbienceGraph | null = null;
let isDucked = false;
let unduckTimer: ReturnType<typeof setTimeout> | null = null;
let sfxVolume = 0.5;
let ambienceVolume = 0.5;

export function getZenSfxVolume(): number {
  return sfxVolume;
}

export function setZenSfxVolume(volume: number): void {
  const clamped = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.5;
  sfxVolume = clamped;
  if (sharedSfxGain && sharedCtx && sharedCtx.state !== 'closed') {
    const now = sharedCtx.currentTime;
    try {
      sharedSfxGain.gain.cancelScheduledValues(now);
      sharedSfxGain.gain.setTargetAtTime(clamped, now, 0.025);
    } catch {}
  }
}

export function getZenAmbienceVolume(): number {
  return ambienceVolume;
}

export function setZenAmbienceVolume(volume: number): void {
  const clamped = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.5;
  ambienceVolume = clamped;
  if (sharedAmbienceGain && sharedCtx && sharedCtx.state !== 'closed') {
    const now = sharedCtx.currentTime;
    try {
      sharedAmbienceGain.gain.cancelScheduledValues(now);
      sharedAmbienceGain.gain.setTargetAtTime(clamped, now, 0.03);
    } catch {}
  }
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new Ctor();
      sharedSfxGain = null;
      sharedAmbienceGain = null;
      sharedBus = null;
    }
    if (sharedCtx.state === 'suspended') {
      void sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

/**
 * Pre-warms the shared AudioContext and ConvolverNode reverb bus ahead of user-triggered
 * ceremony audio (e.g. incense ignition) so the first sound fires with zero cold-start lag.
 */
export function prewarmZenAudio(enabled = true): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    getSpatialBus(ctx);
  } catch {}
}

/**
 * Generates a warm, wooden-temple algorithmic impulse response (~2.1s stereo)
 * with subtle early reflection taps and warm high-frequency absorption.
 */
function createSanctuaryImpulse(ctx: AudioContext): AudioBuffer {
  const durationSec = 2.1;
  const sampleRate = ctx.sampleRate || 44100;
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(2, length, sampleRate);

  const earlyTaps = [
    { ms: 18, gain: 0.42 },
    { ms: 34, gain: 0.28 },
    { ms: 57, gain: 0.19 },
    { ms: 89, gain: 0.12 },
  ];

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lowpassState = 0;
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      const decay = Math.pow(1 - progress, 2.85);
      const raw = (Math.random() * 2 - 1) * decay;
      // Gentle one-pole low-pass to absorb harsh metallic hiss like cedar/plaster walls
      lowpassState = lowpassState * 0.68 + raw * 0.32;
      data[i] = lowpassState * 0.55;
    }

    for (const tap of earlyTaps) {
      const offset = Math.floor(((tap.ms + ch * 3.5) / 1000) * sampleRate);
      if (offset < length) {
        data[offset] += tap.gain * (ch === 0 ? 1 : -0.92);
      }
    }
  }
  return buffer;
}

function getSfxGain(ctx: AudioContext): GainNode {
  if (sharedSfxGain) return sharedSfxGain;
  const node = ctx.createGain();
  node.gain.setValueAtTime(sfxVolume, ctx.currentTime);
  node.connect(ctx.destination);
  sharedSfxGain = node;
  return node;
}

function getAmbienceGain(ctx: AudioContext): GainNode {
  if (sharedAmbienceGain) return sharedAmbienceGain;
  const node = ctx.createGain();
  node.gain.setValueAtTime(ambienceVolume, ctx.currentTime);
  node.connect(ctx.destination);
  sharedAmbienceGain = node;
  return node;
}

function getSpatialBus(ctx: AudioContext): SpatialBus {
  if (sharedBus) return sharedBus;
  const sfxOut = getSfxGain(ctx);
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const reverb = ctx.createConvolver();
  reverb.buffer = createSanctuaryImpulse(ctx);

  const wetTone = ctx.createBiquadFilter();
  wetTone.type = 'lowpass';
  wetTone.frequency.setValueAtTime(2400, ctx.currentTime);

  dry.gain.setValueAtTime(0.76, ctx.currentTime);
  wet.gain.setValueAtTime(0.38, ctx.currentTime);

  dry.connect(sfxOut);
  reverb.connect(wetTone);
  wetTone.connect(wet);
  wet.connect(sfxOut);

  sharedBus = { dry, wet, reverb };
  return sharedBus;
}

function createNoiseBuffer(
  ctx: AudioContext,
  durationSec: number,
  color: 'white' | 'pink' | 'brown'
): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const length = Math.max(1, Math.floor(sampleRate * durationSec));
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const out = buffer.getChannelData(ch);
    if (color === 'white') {
      for (let i = 0; i < length; i++) {
        out[i] = Math.random() * 2 - 1;
      }
    } else if (color === 'pink') {
      // Paul Kellet's refined pink-noise filter
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else {
      // Smooth leaky brownian noise (warm room rumble)
      let lastOut = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        out[i] = lastOut * 2.8;
      }
    }

    // Seamless circular cross-fade across loop edges (~120ms) to guarantee zero audible loop seam
    const fadeSamples = Math.min(Math.floor(sampleRate * 0.12), Math.floor(length / 4));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const tailIdx = length - fadeSamples + i;
      out[i] = out[i] * t + out[tailIdx] * (1 - t);
    }
  }
  return buffer;
}

interface BowlVoiceOptions {
  fundamentalHz: number;
  durationSec: number;
  masterGain: number;
  startOffsetSec?: number;
}

/**
 * Physical-modeled Japanese Orin / Tibetan bronze singing bowl:
 * - Soft suede-wrapped wooden mallet strike transient
 * - 4 inharmonic flexural modes (Fletcher & Rossing ratios)
 * - Dual detuned oscillators per mode creating authentic hand-hammered beating shimmer
 * - Routed through wooden-hall ConvolverNode reverb
 */
function strikeBronzeBowl(ctx: AudioContext, opts: BowlVoiceOptions): void {
  const now = ctx.currentTime + (opts.startOffsetSec || 0);
  const { fundamentalHz, durationSec, masterGain } = opts;
  const bus = getSpatialBus(ctx);

  const voiceOut = ctx.createGain();
  voiceOut.gain.setValueAtTime(0.0001, now);
  voiceOut.gain.linearRampToValueAtTime(masterGain, now + 0.024);
  voiceOut.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

  const toneFilter = ctx.createBiquadFilter();
  toneFilter.type = 'lowpass';
  toneFilter.frequency.setValueAtTime(Math.min(3100, fundamentalHz * 8.2), now);
  toneFilter.frequency.exponentialRampToValueAtTime(
    Math.max(460, fundamentalHz * 2.0),
    now + durationSec * 0.85
  );
  toneFilter.Q.setValueAtTime(0.65, now);

  toneFilter.connect(voiceOut);
  voiceOut.connect(bus.dry);
  voiceOut.connect(bus.reverb);

  // 1. Soft felt-mallet strike transient (~34ms damped impulse)
  try {
    const malletLen = Math.max(1, Math.floor((ctx.sampleRate || 44100) * 0.036));
    const malletBuf = ctx.createBuffer(1, malletLen, ctx.sampleRate || 44100);
    const ch = malletBuf.getChannelData(0);
    for (let i = 0; i < malletLen; i++) {
      ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (malletLen * 0.24));
    }
    const malletSrc = ctx.createBufferSource();
    malletSrc.buffer = malletBuf;

    const malletFilter = ctx.createBiquadFilter();
    malletFilter.type = 'bandpass';
    malletFilter.frequency.setValueAtTime(Math.min(1150, fundamentalHz * 3.4), now);
    malletFilter.Q.setValueAtTime(2.6, now);

    const malletGain = ctx.createGain();
    malletGain.gain.setValueAtTime(0.11, now);
    malletGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.034);

    malletSrc.connect(malletFilter);
    malletFilter.connect(malletGain);
    malletGain.connect(voiceOut);
    malletSrc.start(now);
  } catch {
    // Graceful fallback if short buffer creation fails
  }

  // 2. Four inharmonic flexural modes, each with subtle hand-hammered mode-splitting beat
  const modes: Array<{
    ratio: number;
    beatHz: number;
    gain: number;
    decayRatio: number;
    swellSec: number;
  }> = [
    { ratio: 1.0, beatHz: 0.48, gain: 0.54, decayRatio: 1.0, swellSec: 0.032 },
    { ratio: 2.756, beatHz: 0.86, gain: 0.135, decayRatio: 0.5, swellSec: 0.022 },
    { ratio: 5.404, beatHz: 1.24, gain: 0.035, decayRatio: 0.24, swellSec: 0.015 },
    { ratio: 8.93, beatHz: 1.65, gain: 0.012, decayRatio: 0.12, swellSec: 0.01 },
  ];

  for (const mode of modes) {
    const freq = fundamentalHz * mode.ratio;
    const endAt = now + Math.max(0.22, durationSec * mode.decayRatio);

    const modeGain = ctx.createGain();
    modeGain.gain.setValueAtTime(0.0001, now);
    modeGain.gain.linearRampToValueAtTime(mode.gain, now + mode.swellSec);
    modeGain.gain.exponentialRampToValueAtTime(0.0001, endAt);
    modeGain.connect(toneFilter);

    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    oscA.type = 'sine';
    oscB.type = 'sine';
    oscA.frequency.setValueAtTime(freq, now);
    oscB.frequency.setValueAtTime(freq + mode.beatHz, now);

    const mixB = ctx.createGain();
    mixB.gain.setValueAtTime(0.58, now);

    oscA.connect(modeGain);
    oscB.connect(mixB);
    mixB.connect(modeGain);

    oscA.start(now);
    oscB.start(now);
    oscA.stop(endAt + 0.05);
    oscB.stop(endAt + 0.05);
  }
}

/**
 * Incense ignition micro-ceremony sound ("燃香星火"):
 * Soft warm tinder breath (~360ms) + 3 tiny organic cedar-ember crackles routed lightly
 * into the wooden-hall reverb. Completely gentle, never startling.
 */
export function playZenIncenseIgnite(enabled = true): boolean {
  if (!enabled) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    const now = ctx.currentTime;
    const bus = getSpatialBus(ctx);
    const sampleRate = ctx.sampleRate || 44100;

    // 1. Soft warm tinder flame-breath whoosh (~380ms) with crisp ~16ms onset synced to visual spark
    const breathDur = 0.38;
    const breathLen = Math.max(1, Math.floor(sampleRate * breathDur));
    const breathBuf = ctx.createBuffer(1, breathLen, sampleRate);
    const bData = breathBuf.getChannelData(0);
    let lpState = 0;
    for (let i = 0; i < breathLen; i++) {
      const t = i / breathLen;
      const attack = 0.055;
      const env = t < attack ? t / attack : Math.pow(1 - (t - attack) / (1 - attack), 1.55);
      const white = Math.random() * 2 - 1;
      lpState = lpState * 0.68 + white * 0.32;
      bData[i] = lpState * env;
    }

    const breathSrc = ctx.createBufferSource();
    breathSrc.buffer = breathBuf;

    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = 'bandpass';
    breathFilter.frequency.setValueAtTime(780, now);
    breathFilter.frequency.exponentialRampToValueAtTime(1320, now + 0.045);
    breathFilter.frequency.exponentialRampToValueAtTime(420, now + breathDur);
    breathFilter.Q.setValueAtTime(0.95, now);

    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.0001, now);
    breathGain.gain.linearRampToValueAtTime(0.185, now + 0.012);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, now + breathDur);

    breathSrc.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(bus.dry);

    const breathWet = ctx.createGain();
    breathWet.gain.setValueAtTime(0.32, now);
    breathGain.connect(breathWet);
    breathWet.connect(bus.reverb);
    breathSrc.start(now);

    // 2. Immediate ignition spark + organic cedar-ember micro-crackles
    const crackles = [
      { delay: 0.0, hz: 2550, gain: 0.072, dur: 0.014 },
      { delay: 0.065, hz: 3050, gain: 0.056, dur: 0.013 },
      { delay: 0.15, hz: 2100, gain: 0.048, dur: 0.015 },
      { delay: 0.245, hz: 2650, gain: 0.034, dur: 0.014 },
    ];
    for (const c of crackles) {
      const startAt = now + c.delay;
      const len = Math.max(1, Math.floor(sampleRate * c.dur));
      const cBuf = ctx.createBuffer(1, len, sampleRate);
      const cData = cBuf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        cData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.28));
      }
      const cSrc = ctx.createBufferSource();
      cSrc.buffer = cBuf;

      const cFilter = ctx.createBiquadFilter();
      cFilter.type = 'bandpass';
      cFilter.frequency.setValueAtTime(c.hz * (0.94 + Math.random() * 0.12), startAt);
      cFilter.Q.setValueAtTime(2.6, startAt);

      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(c.gain, startAt);
      cGain.gain.exponentialRampToValueAtTime(0.0001, startAt + c.dur);

      cSrc.connect(cFilter);
      cFilter.connect(cGain);
      cGain.connect(bus.dry);
      cSrc.start(startAt);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Entry ceremony bell ("一磬入静"): warm D4 (293.66 Hz) sanctuary singing bowl over ~4.2s.
 * Calibrated to sit evenly with incense ignition and the temple opening drum.
 */
export function playZenEnterBell(enabled = true): boolean {
  if (!enabled) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    strikeBronzeBowl(ctx, {
      fundamentalHz: 293.66, // D4 — grounded, calm, resonant
      durationSec: 4.2,
      masterGain: 0.072,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Deep temple taiko / Buddhist hall drum ("法鼓开卷") struck upon clicking "开卷".
 * Psychoacoustically balanced for both laptop speakers and headphones: deep membrane pitch-drop
 * + warm 2nd/3rd wooden-cavity harmonics (115–245 Hz) + tactile leather-mallet thump.
 */
export function playZenStartDrum(enabled = true): boolean {
  if (!enabled) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    const now = ctx.currentTime;
    const bus = getSpatialBus(ctx);
    const sampleRate = ctx.sampleRate || 44100;

    const voiceOut = ctx.createGain();
    voiceOut.gain.setValueAtTime(0.0001, now);
    voiceOut.gain.linearRampToValueAtTime(0.92, now + 0.008);
    voiceOut.gain.exponentialRampToValueAtTime(0.0001, now + 1.52);

    voiceOut.connect(bus.dry);
    const wetSend = ctx.createGain();
    wetSend.gain.setValueAtTime(0.62, now);
    voiceOut.connect(wetSend);
    wetSend.connect(bus.reverb);

    // 1. Primary drumhead fundamental: deep pitch bend 118 Hz -> 58 Hz
    const headOsc = ctx.createOscillator();
    headOsc.type = 'sine';
    headOsc.frequency.setValueAtTime(118, now);
    headOsc.frequency.exponentialRampToValueAtTime(58, now + 0.13);
    headOsc.frequency.exponentialRampToValueAtTime(50, now + 1.38);

    const headGain = ctx.createGain();
    headGain.gain.setValueAtTime(0.0001, now);
    headGain.gain.linearRampToValueAtTime(0.48, now + 0.009);
    headGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.38);

    headOsc.connect(headGain);
    headGain.connect(voiceOut);

    // 2. Sub-body chest resonance (felt on headphones & full-range speakers)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(64, now);
    subOsc.frequency.exponentialRampToValueAtTime(46, now + 0.95);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.28, now + 0.022);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.28);

    subOsc.connect(subGain);
    subGain.connect(voiceOut);

    // 3. Upper-bass drumhead harmonic (176 -> 116 Hz): delivers clear deep presence on laptop speakers
    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(176, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(116, now + 0.11);
    bodyOsc.frequency.exponentialRampToValueAtTime(104, now + 0.92);

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.linearRampToValueAtTime(0.28, now + 0.008);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(voiceOut);

    // 4. Warm cedar wooden-shell cavity mode (245 -> 165 Hz)
    const shellOsc = ctx.createOscillator();
    shellOsc.type = 'triangle';
    shellOsc.frequency.setValueAtTime(245, now);
    shellOsc.frequency.exponentialRampToValueAtTime(165, now + 0.085);

    const shellLp = ctx.createBiquadFilter();
    shellLp.type = 'lowpass';
    shellLp.frequency.setValueAtTime(420, now);

    const shellGain = ctx.createGain();
    shellGain.gain.setValueAtTime(0.0001, now);
    shellGain.gain.linearRampToValueAtTime(0.14, now + 0.006);
    shellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.56);

    shellOsc.connect(shellLp);
    shellLp.connect(shellGain);
    shellGain.connect(voiceOut);

    // 5. Soft leather-wrapped mallet strike transient (warm physical thump)
    const malletDur = 0.055;
    const malletLen = Math.max(1, Math.floor(sampleRate * malletDur));
    const malletBuf = ctx.createBuffer(1, malletLen, sampleRate);
    const mData = malletBuf.getChannelData(0);
    for (let i = 0; i < malletLen; i++) {
      mData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (malletLen * 0.28));
    }
    const malletSrc = ctx.createBufferSource();
    malletSrc.buffer = malletBuf;

    const malletFilter = ctx.createBiquadFilter();
    malletFilter.type = 'lowpass';
    malletFilter.frequency.setValueAtTime(420, now);
    malletFilter.Q.setValueAtTime(0.85, now);

    const malletGain = ctx.createGain();
    malletGain.gain.setValueAtTime(0.34, now);
    malletGain.gain.exponentialRampToValueAtTime(0.0001, now + malletDur);

    malletSrc.connect(malletFilter);
    malletFilter.connect(malletGain);
    malletGain.connect(voiceOut);

    headOsc.start(now);
    subOsc.start(now);
    bodyOsc.start(now);
    shellOsc.start(now);
    malletSrc.start(now);

    headOsc.stop(now + 1.45);
    subOsc.stop(now + 1.35);
    bodyOsc.stop(now + 1.0);
    shellOsc.stop(now + 0.62);

    return true;
  } catch {
    return false;
  }
}

/**
 * Completion closure bell ("圆满合卷"): D4 resolving into a warm A4 fifth over ~5.0s.
 */
export function playZenCompleteBell(enabled = true): boolean {
  if (!enabled) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    strikeBronzeBowl(ctx, {
      fundamentalHz: 293.66, // D4
      durationSec: 5.0,
      masterGain: 0.072,
      startOffsetSec: 0,
    });
    strikeBronzeBowl(ctx, {
      fundamentalHz: 440.0, // A4 — peaceful resolving fifth
      durationSec: 4.3,
      masterGain: 0.044,
      startOffsetSec: 0.38,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Tactile physical-material cue on card flip or settle:
 * - 'flip': whisper-soft sculpted Washi paper lift (bandpass-swept pink micro-noise, ~52ms)
 * - 'settle': muted kaya-wood Go-stone / soft mokugyo tap (~58ms, warm low resonance)
 * Identical neutral softness for every rating — zero harshness, zero punishment buzzers.
 * Callers must skip this whenever card audio is present to avoid overlapping speech.
 */
export function playZenPaperTouch(enabled = true, kind: 'flip' | 'settle' = 'flip'): boolean {
  if (!enabled) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    const now = ctx.currentTime;
    const jitter = 0.965 + Math.random() * 0.07;

    if (kind === 'flip') {
      // Sculpted Washi rice-paper brush (soft fingertip lifting paper)
      const dur = 0.056;
      const sampleRate = ctx.sampleRate || 44100;
      const len = Math.max(1, Math.floor(sampleRate * dur));
      const buf = ctx.createBuffer(1, len, sampleRate);
      const data = buf.getChannelData(0);
      let prev = 0;
      for (let i = 0; i < len; i++) {
        const env = Math.sin((i / len) * Math.PI);
        const white = Math.random() * 2 - 1;
        prev = prev * 0.55 + white * 0.45;
        data[i] = prev * env * env;
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;

      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.setValueAtTime(1420 * jitter, now);
      band.frequency.exponentialRampToValueAtTime(680 * jitter, now + dur);
      band.Q.setValueAtTime(1.35, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      src.connect(band);
      band.connect(gain);
      gain.connect(getSfxGain(ctx));
      src.start(now);
      return true;
    }

    // 'settle': warm kaya-wood Go-stone / soft mokugyo tap
    const bus = getSpatialBus(ctx);
    const dur = 0.064;
    const bodyHz = 286 * jitter;

    const bodyOsc = ctx.createOscillator();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(bodyHz * 1.24, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(bodyHz * 0.72, now + dur);

    const woodKnock = ctx.createOscillator();
    woodKnock.type = 'triangle';
    woodKnock.frequency.setValueAtTime(bodyHz * 2.38, now);
    woodKnock.frequency.exponentialRampToValueAtTime(bodyHz * 1.65, now + 0.028);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(860, now);

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.linearRampToValueAtTime(0.044, now + 0.004);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    const knockGain = ctx.createGain();
    knockGain.gain.setValueAtTime(0.0001, now);
    knockGain.gain.linearRampToValueAtTime(0.018, now + 0.003);
    knockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.026);

    bodyOsc.connect(bodyGain);
    woodKnock.connect(knockGain);
    bodyGain.connect(lp);
    knockGain.connect(lp);

    lp.connect(bus.dry);
    // Tiny touch of wood-room reflection
    const tinySend = ctx.createGain();
    tinySend.gain.setValueAtTime(0.18, now);
    lp.connect(tinySend);
    tinySend.connect(bus.reverb);

    bodyOsc.start(now);
    woodKnock.start(now);
    bodyOsc.stop(now + dur + 0.015);
    woodKnock.stop(now + 0.036);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Procedural Ambient Soundscape Bed ('silent' | 'rain' | 'wind' | 'warmth')
// ============================================================================

function teardownAmbience(graph: ActiveAmbienceGraph, fadeSec = 1.1): void {
  const ctx = sharedCtx;
  if (!ctx || ctx.state === 'closed') {
    graph.cleanup();
    return;
  }
  const now = ctx.currentTime;
  try {
    graph.sceneGain.gain.cancelScheduledValues(now);
    graph.sceneGain.gain.setValueAtTime(Math.max(0.0001, graph.sceneGain.gain.value), now);
    graph.sceneGain.gain.setTargetAtTime(0.0001, now, Math.max(0.08, fadeSec / 3.2));
  } catch {
    // Ignore scheduling errors during teardown
  }
  setTimeout(() => {
    graph.cleanup();
  }, Math.round(fadeSec * 1000) + 120);
}

function buildAmbienceGraph(
  ctx: AudioContext,
  scene: Exclude<ZenAmbienceScene, 'silent'>
): ActiveAmbienceGraph {
  const now = ctx.currentTime;
  const bus = getSpatialBus(ctx);

  const sceneGain = ctx.createGain();
  const duckGain = ctx.createGain();
  sceneGain.gain.setValueAtTime(0.0001, now);
  duckGain.gain.setValueAtTime(isDucked ? 0.22 : 1.0, now);

  sceneGain.connect(duckGain);
  duckGain.connect(getAmbienceGain(ctx));

  const stopCallbacks: Array<() => void> = [];
  let targetGain = 0.085;

  if (scene === 'rain') {
    // Eaves rain (檐雨): gentle pink rain curtain + subtle randomized distant eaves droplets
    targetGain = 0.095;
    const curtainSrc = ctx.createBufferSource();
    curtainSrc.buffer = createNoiseBuffer(ctx, 6.0, 'pink');
    curtainSrc.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(220, now);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2150, now);
    lp.Q.setValueAtTime(0.55, now);

    curtainSrc.connect(hp);
    hp.connect(lp);
    lp.connect(sceneGain);
    curtainSrc.start(now);

    let disposed = false;
    let dropTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleDroplet = () => {
      if (disposed || !sharedCtx || sharedCtx.state !== 'running') return;
      try {
        const t = sharedCtx.currentTime;
        const osc = sharedCtx.createOscillator();
        const dropGain = sharedCtx.createGain();
        const startHz = 950 + Math.random() * 1150;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startHz, t);
        osc.frequency.exponentialRampToValueAtTime(startHz * 1.48, t + 0.042);

        const peak = 0.014 + Math.random() * 0.018;
        dropGain.gain.setValueAtTime(0.0001, t);
        dropGain.gain.linearRampToValueAtTime(peak, t + 0.006);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.068);

        osc.connect(dropGain);
        dropGain.connect(sceneGain);
        // Whisper of eaves reflection
        const dropWet = sharedCtx.createGain();
        dropWet.gain.setValueAtTime(0.28, t);
        dropGain.connect(dropWet);
        dropWet.connect(bus.reverb);

        osc.start(t);
        osc.stop(t + 0.08);
      } catch {
        // Ignore transient drop error
      }
      const nextDelayMs = 320 + Math.random() * 880;
      dropTimer = setTimeout(scheduleDroplet, nextDelayMs);
    };
    dropTimer = setTimeout(scheduleDroplet, 600);

    stopCallbacks.push(() => {
      disposed = true;
      if (dropTimer) clearTimeout(dropTimer);
      try {
        curtainSrc.stop();
        curtainSrc.disconnect();
        hp.disconnect();
        lp.disconnect();
        sceneGain.disconnect();
        duckGain.disconnect();
      } catch {}
    });
  } else if (scene === 'wind') {
    // Pine wind (松风): two slowly breathing resonant filters with non-repeating incommensurate LFOs
    targetGain = 0.105;
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = createNoiseBuffer(ctx, 7.0, 'pink');
    windSrc.loop = true;

    const bandA = ctx.createBiquadFilter();
    bandA.type = 'bandpass';
    bandA.frequency.setValueAtTime(340, now);
    bandA.Q.setValueAtTime(1.85, now);

    const bandB = ctx.createBiquadFilter();
    bandB.type = 'bandpass';
    bandB.frequency.setValueAtTime(590, now);
    bandB.Q.setValueAtTime(2.4, now);

    const lfoA = ctx.createOscillator();
    const lfoAGain = ctx.createGain();
    lfoA.frequency.setValueAtTime(0.062, now); // ~16.1s wave
    lfoAGain.gain.setValueAtTime(125, now);
    lfoA.connect(lfoAGain);
    lfoAGain.connect(bandA.frequency);

    const lfoB = ctx.createOscillator();
    const lfoBGain = ctx.createGain();
    lfoB.frequency.setValueAtTime(0.041, now); // ~24.4s wave (never repeats mechanically)
    lfoBGain.gain.setValueAtTime(160, now);
    lfoB.connect(lfoBGain);
    lfoBGain.connect(bandB.frequency);

    const mixB = ctx.createGain();
    mixB.gain.setValueAtTime(0.45, now);

    windSrc.connect(bandA);
    windSrc.connect(bandB);
    bandA.connect(sceneGain);
    bandB.connect(mixB);
    mixB.connect(sceneGain);

    windSrc.start(now);
    lfoA.start(now);
    lfoB.start(now);

    stopCallbacks.push(() => {
      try {
        windSrc.stop();
        lfoA.stop();
        lfoB.stop();
        windSrc.disconnect();
        lfoA.disconnect();
        lfoB.disconnect();
        bandA.disconnect();
        bandB.disconnect();
        sceneGain.disconnect();
        duckGain.disconnect();
      } catch {}
    });
  } else {
    // Warm silence (暖寂): velvety low-passed brownian room warmth
    targetGain = 0.088;
    const brownSrc = ctx.createBufferSource();
    brownSrc.buffer = createNoiseBuffer(ctx, 6.0, 'brown');
    brownSrc.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(260, now);
    lp.Q.setValueAtTime(0.5, now);

    brownSrc.connect(lp);
    lp.connect(sceneGain);
    brownSrc.start(now);

    stopCallbacks.push(() => {
      try {
        brownSrc.stop();
        brownSrc.disconnect();
        lp.disconnect();
        sceneGain.disconnect();
        duckGain.disconnect();
      } catch {}
    });
  }

  // Smooth logarithmic-feeling swell in (~1.6s)
  sceneGain.gain.setTargetAtTime(targetGain, now, 0.52);

  return {
    scene,
    sceneGain,
    duckGain,
    targetGain,
    cleanup: () => {
      for (const fn of stopCallbacks) fn();
    },
  };
}

/**
 * Transitions the continuous Zen ambient soundscape bed smoothly.
 * Defaults to 'silent'; smoothly crossfades when switching scenes or muting.
 */
export function setZenAmbienceScene(scene: ZenAmbienceScene, enabled = true): boolean {
  if (!enabled || scene === 'silent') {
    if (activeAmbience) {
      const prev = activeAmbience;
      activeAmbience = null;
      teardownAmbience(prev, 1.25);
    }
    return false;
  }

  const ctx = getAudioContext();
  if (!ctx) return false;

  if (activeAmbience && activeAmbience.scene === scene) {
    return true;
  }

  if (activeAmbience) {
    const prev = activeAmbience;
    activeAmbience = null;
    teardownAmbience(prev, 1.0);
  }

  try {
    activeAmbience = buildAmbienceGraph(ctx, scene);
    return true;
  } catch {
    return false;
  }
}

/** Smoothly fades out and stops any active ambient soundscape (e.g., on exiting Zen Mode). */
export function stopZenAmbience(fadeSec = 1.2): void {
  if (unduckTimer) {
    clearTimeout(unduckTimer);
    unduckTimer = null;
  }
  isDucked = false;
  if (activeAmbience) {
    const prev = activeAmbience;
    activeAmbience = null;
    teardownAmbience(prev, fadeSec);
  }
}

/**
 * Gently ducks ambient soundscape down when card speech plays, then swells back smoothly
 * once speech finishes (or after autoReleaseMs).
 */
export function setZenAmbienceDucked(ducked: boolean, autoReleaseMs = 0): void {
  if (unduckTimer) {
    clearTimeout(unduckTimer);
    unduckTimer = null;
  }
  isDucked = ducked;
  if (activeAmbience && sharedCtx && sharedCtx.state !== 'closed') {
    const now = sharedCtx.currentTime;
    try {
      activeAmbience.duckGain.gain.cancelScheduledValues(now);
      activeAmbience.duckGain.gain.setTargetAtTime(
        ducked ? 0.22 : 1.0,
        now,
        ducked ? 0.08 : 0.36
      );
    } catch {}
  }
  if (ducked && autoReleaseMs > 0) {
    unduckTimer = setTimeout(() => {
      unduckTimer = null;
      setZenAmbienceDucked(false, 0);
    }, autoReleaseMs);
  }
}
