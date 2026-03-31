/**
 * Lightweight notification sound utility.
 * Generates a short "ding" tone using the Web Audio API.
 * No external audio file required.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (autoplay policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * Plays a short, pleasant notification "ding" sound.
 * Gracefully no-ops if Web Audio API is unavailable or blocked.
 */
export function playMessageNotification(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Create two overlapping tones for a pleasant "ding" sound
    // Tone 1: Higher pitch
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(660, now + 0.15);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Tone 2: Slightly delayed, lower pitch for warmth
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.05); // E6
    osc2.frequency.exponentialRampToValueAtTime(880, now + 0.2);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.05);
    osc2.stop(now + 0.35);
  } catch (e) {
    // Silently fail — audio is non-critical
    console.warn('Notification sound failed:', e);
  }
}
