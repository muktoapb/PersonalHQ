// A short tick on phones that support it (Android Chrome); a no-op elsewhere.
export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}
