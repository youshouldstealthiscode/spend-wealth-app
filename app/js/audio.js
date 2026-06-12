// FILE: js/audio.js — Sound effects (kaching, subtle tick)

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

const kachingAudio = new Audio("./sfx/kaching.mp3");
kachingAudio.preload = "auto";
kachingAudio.volume = 0.7;

export function playKaching(soundEnabled) {
  if (!soundEnabled) return;
  try {
    kachingAudio.currentTime = 0;
    kachingAudio.play().catch(() => {});
  } catch (e) {
    // Audio not available — fail silently
  }
}

export function playSubtleTick(soundEnabled) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.1));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2500;
    filter.Q.value = 3;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  } catch (e) {
    // Audio not available
  }
}
