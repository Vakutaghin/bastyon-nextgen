// localStorage-обёртка для незавершённой регистрации.
// Используется register-modal (старт/обновление шагов) и header-user (retry на ребуте).
// Запись TTL — 30 минут, после автоматически очищается при чтении.

const PENDING_REG_KEY = 'pending_registration'
const PENDING_NICKNAME_KEY = 'pending_nickname'
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
    localStorage.setItem(PENDING_REG_KEY, JSON.stringify(data))
  } catch {
    /* localStorage недоступен */
  }
}

export function loadPendingRegistration(): PendingRegistration | null {
  try {
    const raw = localStorage.getItem(PENDING_REG_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as PendingRegistration
    if (Date.now() - data.timestamp > TTL_MS) {
      clearPendingRegistration()
      return null
    }
    return data
  } catch {
    return null
  }
}

export function clearPendingRegistration(): void {
  try {
    localStorage.removeItem(PENDING_REG_KEY)
    localStorage.removeItem(PENDING_NICKNAME_KEY)
  } catch {
    /* ignore */
  }
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
