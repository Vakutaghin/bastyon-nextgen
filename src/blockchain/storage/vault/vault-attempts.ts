// Троттлинг попыток ввода passphrase: экспоненциальный backoff после 3 промахов,
// персист счётчика/кулдауна в localStorage. Чистый адаптер (см. LARGE_FILE_SPLIT_AUDIT.md).

import { VAULT_ATTEMPTS_KEY } from '../../constants/storage'
import { ls, lsRemove } from './vault-ls'

export interface AttemptState {
  attempts: number
  cooldownUntil: number
}

export function getAttemptState(): AttemptState {
  const raw = ls()?.getItem(VAULT_ATTEMPTS_KEY)
  if (!raw) return { attempts: 0, cooldownUntil: 0 }
  try {
    const o = JSON.parse(raw) as Partial<AttemptState>
    return {
      attempts: typeof o.attempts === 'number' ? o.attempts : 0,
      cooldownUntil: typeof o.cooldownUntil === 'number' ? o.cooldownUntil : 0,
    }
  } catch {
    return { attempts: 0, cooldownUntil: 0 }
  }
}

function backoffMs(attempts: number): number {
  if (attempts <= 3) return 0
  if (attempts === 4) return 5_000
  if (attempts === 5) return 15_000
  if (attempts === 6) return 30_000
  return 60_000
}

export function recordFailedAttempt(): AttemptState {
  const cur = getAttemptState()
  const attempts = cur.attempts + 1
  // now берём из Date через переданный источник времени нельзя (framework-free) —
  // используем Date.now(): это app-runtime, не workflow-скрипт.
  const next: AttemptState = { attempts, cooldownUntil: Date.now() + backoffMs(attempts) }
  try {
    ls()?.setItem(VAULT_ATTEMPTS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function clearAttempts(): void {
  lsRemove(VAULT_ATTEMPTS_KEY)
}
