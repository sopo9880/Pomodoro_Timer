/**
 * Garden and interface sounds. Each one is synthesised once (garden/sfx.mjs) into a sample buffer and
 * played with a tiny random pitch change so repeats do not sound like a machine. They follow the app's
 * sound switch and volume and stay silent while a focus session runs (unless the caller says otherwise).
 */
import { SFX_NAMES, SFX_RATE, sfxSamples } from "./sfx.mjs";

export const SOUND_NAMES = SFX_NAMES;

export function createGardenSound({ AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext, getSettings = () => ({ enabled: true, volume: 60 }), isQuiet = () => false } = {}) {
  let ctx = null;
  const buffers = new Map();
  function context() {
    if (ctx || typeof AudioContextClass !== "function") return ctx;
    try { ctx = new AudioContextClass(); } catch { ctx = null; }
    return ctx;
  }
  function bufferFor(audio, name) {
    if (buffers.has(name)) return buffers.get(name);
    const samples = sfxSamples(name);
    if (!samples) return null;
    const buffer = audio.createBuffer(1, samples.length, SFX_RATE);
    if (buffer.copyToChannel) buffer.copyToChannel(samples, 0); else buffer.getChannelData(0).set(samples);
    buffers.set(name, buffer);
    return buffer;
  }
  /** Plays a named sound; false when silenced, unknown or unavailable. `rate` and `gain` adjust one play. */
  function play(name, { rate = 1, gain = 1, ignoreQuiet = false } = {}) {
    const { enabled, volume } = getSettings();
    if (!SFX_NAMES.includes(name) || !enabled || (!ignoreQuiet && isQuiet())) return false;
    const master = Math.max(0, Math.min(1, (Number(volume) || 0) / 100)) * .55 * gain;
    if (master <= 0) return false;
    const audio = context();
    if (!audio) return false;
    try {
      if (audio.state === "suspended") audio.resume?.();
      const buffer = bufferFor(audio, name);
      if (!buffer) return false;
      const source = audio.createBufferSource(), amp = audio.createGain();
      source.buffer = buffer;
      source.playbackRate.value = rate * (.97 + Math.random() * .06);
      amp.gain.value = master;
      source.connect(amp); amp.connect(audio.destination);
      source.start();
      return true;
    } catch { return false; }
  }
  return { play };
}
