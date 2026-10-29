/**
 * Можно ли удалить чужое сообщение у всех. Matrix разрешает это тому, чей
 * уровень в m.room.power_levels не ниже `redact` (по умолчанию 50). В личных
 * чатах у обоих 100 — так их создают и прежний клиент, и наш
 * (trusted_private_chat). В группах — админам и модераторам.
 */

interface PowerLevelsRoom {
  currentState?: {
    getStateEvents?: (
      type: string,
      stateKey: string
    ) => { getContent?: () => Record<string, unknown> } | null
  }
}

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

export function canRedactOthers(room: PowerLevelsRoom | null | undefined, userId: string): boolean {
  const levels = room?.currentState?.getStateEvents?.('m.room.power_levels', '')?.getContent?.()
  if (!levels || !userId) return false
  const users = (levels.users ?? {}) as Record<string, unknown>
  const mine = num(users[userId], num(levels.users_default, 0))
  const events = (levels.events ?? {}) as Record<string, unknown>
  const toSend = num(events['m.room.redaction'], num(levels.events_default, 0))
  return mine >= num(levels.redact, 50) && mine >= toSend
}
