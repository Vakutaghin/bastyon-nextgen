/**
 * Флаг «приветственный экран уже показан» — per-address, в localStorage.
 * Welcome-модалка появляется один раз, сразу после регистрации (см.
 * use-registration-flow).
 */

const WELCOME_SEEN_PREFIX = 'welcome_seen_'

/** Показывать ли welcome для адреса (true, если ещё не показывали). */
export function shouldShowWelcome(address: string | null): boolean {
  if (!address) return false
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(`${WELCOME_SEEN_PREFIX}${address}`) !== 'true'
    }
  } catch (error) {
    console.error('Failed to read welcome flag:', error)
  }
  return false
}

/** Помечает welcome как показанный для адреса (больше не показывать). */
export function setWelcomeSeen(address: string | null): void {
  if (!address) return
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${WELCOME_SEEN_PREFIX}${address}`, 'true')
    }
  } catch (error) {
    console.error('Failed to set welcome flag:', error)
  }
}
