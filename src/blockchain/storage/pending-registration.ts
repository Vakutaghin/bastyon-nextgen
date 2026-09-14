// localStorage-обёртка для незавершённой регистрации (один читатель на проект,
// аудит S15/X10). Используется register-modal (старт/обновление шагов),
// header-user (retry на ребуте) и restore-session (чистка брошенной регистрации).
// Запись TTL — 30 минут: `loadPendingRegistration` протухшее удаляет,
// `peekPendingRegistration` читает как есть (для решений об очистке на буте).

import { PENDING_NICKNAME_KEY, PENDING_REGISTRATION_KEY } from '../constants/storage'

const TTL_MS = 30 * 60 * 1000

export interface PendingRegistration {
  nickname: string
  address: string
  /** 1 = keys generated, 2 = free/balance requested (optimistic done), 3 = tx sent */
  step: number
  timestamp: number
}

export function savePendingRegistration(data: PendingRegistration): void {
  try {
    localStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify(data))
    localStorage.setItem(PENDING_NICKNAME_KEY, data.nickname)
  } catch {
    /* localStorage недоступен */
  }
}

/** Запись без проверки TTL и без побочных эффектов; null, если её нет/битая. */
export function peekPendingRegistration(): PendingRegistration | null {
  try {
    const raw = localStorage.getItem(PENDING_REGISTRATION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<PendingRegistration> | null
    if (!data || typeof data !== 'object' || typeof data.step !== 'number') return null
    return {
      nickname: typeof data.nickname === 'string' ? data.nickname : '',
      address: typeof data.address === 'string' ? data.address : '',
      step: data.step,
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : 0,
    }
  } catch {
    return null
  }
}

export function loadPendingRegistration(): PendingRegistration | null {
  const data = peekPendingRegistration()
  if (!data) return null
  if (Date.now() - data.timestamp > TTL_MS) {
    clearPendingRegistration()
    return null
  }
  return data
}

export function clearPendingRegistration(): void {
  try {
    localStorage.removeItem(PENDING_REGISTRATION_KEY)
    localStorage.removeItem(PENDING_NICKNAME_KEY)
  } catch {
    /* ignore */
  }
}

/** Чистит запись, только если она про этот адрес (удаление/откат аккаунта). */
export function clearPendingRegistrationFor(address: string): void {
  const current = peekPendingRegistration()
  if (current && current.address === address) clearPendingRegistration()
}

/**
 * Помечает текущую запись шагом step (без перетирания nickname/address/timestamp).
 * No-op, если записи нет.
 */
export function markPendingRegistrationStep(step: number): void {
  const current = loadPendingRegistration()
  if (!current) return
  savePendingRegistration({ ...current, step })
}
