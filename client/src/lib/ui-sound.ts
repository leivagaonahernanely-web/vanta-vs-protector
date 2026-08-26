const SOUND_STORAGE_KEY = "vanta.ui.sound";

export function getSoundPreference(storage?: Pick<Storage, "getItem">) {
  if (!storage) return false;
  return storage.getItem(SOUND_STORAGE_KEY) === "on";
}

export function setSoundPreference(storage: Pick<Storage, "setItem">, enabled: boolean) {
  storage.setItem(SOUND_STORAGE_KEY, enabled ? "on" : "off");
}

export function playUiChime(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return false;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return false;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(520, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(760, context.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.17);
  void oscillator.addEventListener("ended", () => { void context.close(); });
  return true;
}
