/**
 * Phase 4M — small garden sounds, synthesized with Web Audio. No audio files,
 * so there is nothing to download, license or credit. They follow the app's
 * existing sound switch and volume and stay silent while a focus session runs.
 */

/** name -> notes: [frequency Hz, start s, length s, gain, wave] */
const VOICES = Object.freeze({
  pop: [[520, 0, .09, .5, "sine"], [780, .04, .1, .35, "sine"]],
  ding: [[880, 0, .5, .45, "sine"], [1320, 0, .35, .22, "sine"]],
  chime: [[1318, 0, .6, .3, "sine"], [1568, .14, .6, .26, "sine"], [1976, .3, .8, .22, "sine"]],
  splash: [[640, 0, .22, .35, "sine"], [380, .08, .3, .3, "sine"], [260, .16, .35, .22, "sine"]],
  sit: [[180, 0, .18, .5, "triangle"]],
  warm: [[110, 0, .25, .18, "sawtooth"], [147, .1, .22, .12, "sawtooth"]],
});
export const SOUND_NAMES = Object.freeze(Object.keys(VOICES));

export function createGardenSound({ AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext, getSettings = () => ({ enabled: true, volume: 60 }), isQuiet = () => false } = {}) {
  let ctx = null;
  function context() {
    if (ctx || typeof AudioContextClass !== "function") return ctx;
    try { ctx = new AudioContextClass(); } catch { ctx = null; }
    return ctx;
  }
  /** Plays a named sound; false when silenced, unknown or unavailable. */
  function play(name) {
    const voice = VOICES[name];
    const { enabled, volume } = getSettings();
    if (!voice || !enabled || isQuiet()) return false;
    const master = Math.max(0, Math.min(1, (Number(volume) || 0) / 100)) * .5;
    if (master <= 0) return false;
    const audio = context();
    if (!audio) return false;
    try {
      if (audio.state === "suspended") audio.resume?.();
      const now = audio.currentTime;
      for (const [freq, start, length, gain, wave] of voice) {
        const osc = audio.createOscillator(), amp = audio.createGain();
        osc.type = wave; osc.frequency.setValueAtTime(freq, now + start);
        amp.gain.setValueAtTime(0.0001, now + start);
        amp.gain.exponentialRampToValueAtTime(Math.max(.0002, gain * master), now + start + .015);
        amp.gain.exponentialRampToValueAtTime(.0001, now + start + length);
        osc.connect(amp); amp.connect(audio.destination);
        osc.start(now + start); osc.stop(now + start + length + .05);
      }
      return true;
    } catch { return false; }
  }
  return { play };
}
