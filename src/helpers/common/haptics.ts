/**
 * Тактильная отдача (vibration) на пользовательских действиях.
 *
 * Ничего не делает на десктопе и в браузерах без navigator.vibrate.
 * Аналог legacy: app.mobile.vibration.small()/medium() (components/comments/index.js:1736, 1787).
 */

type HapticIntensity = 'small' | 'medium' | 'strong'

const PATTERNS: Record<HapticIntensity, number | number[]> = {
  small: 15,
  medium: 30,
  strong: [40, 30, 40],
}

/** Безопасный вызов navigator.vibrate; молча возвращается если API нет. */
export function haptic(intensity: HapticIntensity = 'small'): void {
  const nav = typeof navigator !== 'undefined' ? navigator : null
  if (!nav || typeof nav.vibrate !== 'function') return
  try {
    nav.vibrate(PATTERNS[intensity])
  } catch {
    // некоторые движки вне user-gesture рейзят — игнорируем
  }
}
