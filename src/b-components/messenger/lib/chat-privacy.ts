/**
 * Что о вас видят собеседники в чатах: что вы в сети, что печатаете, что
 * записываете голосовое. Настройка общая для всех устройств аккаунта — лежит
 * в данных аккаунта на сервере чатов, на устройстве — её копия, чтобы
 * «в сети» не ушло раньше, чем пришла серверная.
 */

export interface ChatPrivacy {
  /** Сообщать серверу чатов, что вы в сети (и видеть, кто в сети из собеседников). */
  online: boolean
  /** Показывать собеседнику «печатает…». */
  typing: boolean
  /** Показывать собеседнику «записывает голосовое…». */
  recording: boolean
}

/** По умолчанию — как было до настройки: «в сети» не сообщаем, «печатает» — да. */
export const DEFAULT_CHAT_PRIVACY: ChatPrivacy = { online: false, typing: true, recording: true }

/** Тип данных аккаунта Matrix. */
export const CHAT_PRIVACY_ACCOUNT_DATA = 'app.bastyon.privacy'

/** Ключ копии на устройстве: `<префикс><адрес>`. */
export const CHAT_PRIVACY_STORAGE_PREFIX = 'bastyon_chat_privacy:'

export function sanitizeChatPrivacy(raw: unknown): ChatPrivacy {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Partial<
    Record<keyof ChatPrivacy, unknown>
  >
  const pick = (key: keyof ChatPrivacy): boolean =>
    typeof value[key] === 'boolean' ? (value[key] as boolean) : DEFAULT_CHAT_PRIVACY[key]
  return { online: pick('online'), typing: pick('typing'), recording: pick('recording') }
}

export function sameChatPrivacy(a: ChatPrivacy, b: ChatPrivacy): boolean {
  return a.online === b.online && a.typing === b.typing && a.recording === b.recording
}

/**
 * «Записывает голосовое» — в Matrix для этого нет события (typing — только
 * «да/нет»), поэтому шлём to-device сообщение участникам комнаты. В историю
 * чата оно не попадает; видят его только приложения, которые его знают.
 */
export const RECORDING_EVENT = 'app.bastyon.recording'

/** Пока идёт запись, напоминаем так часто… */
export const RECORDING_REFRESH_MS = 10_000
/** …а без напоминания отметка гаснет через это время (запись оборвалась). */
export const RECORDING_TTL_MS = 15_000

/** Больше участников — не рассылаем: в большой группе это шум и нагрузка на сервер. */
export const RECORDING_MAX_RECIPIENTS = 50

export interface RecordingSignal {
  roomId: string
  recording: boolean
}

export function parseRecordingSignal(content: unknown): RecordingSignal | null {
  if (!content || typeof content !== 'object') return null
  const { room_id: roomId, recording } = content as { room_id?: unknown; recording?: unknown }
  if (typeof roomId !== 'string' || !roomId.startsWith('!') || typeof recording !== 'boolean') {
    return null
  }
  return { roomId, recording }
}
