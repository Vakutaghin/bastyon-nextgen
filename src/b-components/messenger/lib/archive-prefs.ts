/**
 * Какие чаты сохранять на устройстве. По умолчанию выключено. Включили — все
 * чаты, кроме отключённых по одному, или только выбранные. Привязано к
 * аккаунту: у каждого свои чаты.
 */

export type ArchiveMode = 'all' | 'selected'

export interface ArchivePrefs {
  enabled: boolean
  mode: ArchiveMode
  /** Выбор по чату: true — сохранять, false — нет. Нет записи — как велит режим. */
  chats: Record<string, boolean>
}

export const DEFAULT_ARCHIVE_PREFS: ArchivePrefs = { enabled: false, mode: 'all', chats: {} }

export function sanitizeArchivePrefs(raw: unknown): ArchivePrefs {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<ArchivePrefs>
  const chats: Record<string, boolean> = {}
  if (value.chats && typeof value.chats === 'object') {
    for (const [id, on] of Object.entries(value.chats)) {
      if (typeof on === 'boolean' && archivableChatId(id)) chats[id] = on
    }
  }
  return {
    enabled: value.enabled === true,
    mode: value.mode === 'selected' ? 'selected' : 'all',
    chats,
  }
}

/** Сохранять можно только комнаты Matrix: mesh-переписка и так живёт на устройстве, каналы — в блокчейне. */
export function archivableChatId(chatId: string): boolean {
  return chatId.startsWith('!')
}

/** Сохраняется ли этот чат. */
export function isChatArchived(prefs: ArchivePrefs, chatId: string): boolean {
  if (!prefs.enabled || !archivableChatId(chatId)) return false
  const choice = prefs.chats[chatId]
  return prefs.mode === 'all' ? choice !== false : choice === true
}

/**
 * Включить или выключить один чат. Включили чат при выключенном сохранении —
 * сохраняется только он: остальные чаты без спроса не начинают сохраняться.
 */
export function withChat(prefs: ArchivePrefs, chatId: string, on: boolean): ArchivePrefs {
  const chats = { ...prefs.chats, [chatId]: on }
  if (on && !prefs.enabled) return { enabled: true, mode: 'selected', chats }
  return { ...prefs, chats }
}
