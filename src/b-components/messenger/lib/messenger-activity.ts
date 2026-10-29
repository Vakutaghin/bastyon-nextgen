// Что мессенджер сейчас догружает — для значка в шапке списка и чата. Без него
// при медленной сети пустой или старый список выглядел готовым: человек думал,
// что сообщений нет, а они ещё шли.

export type MessengerActivity = 'connecting' | 'updating' | 'reconnecting' | 'messages'

export interface ListActivityState {
  authenticated: boolean
  /** Красная полоса «Ошибка синхронизации» уже говорит, в чём дело. */
  syncError: string | null
  /** Состояние синка matrix-js-sdk: STOPPED, PREPARED, SYNCING… */
  syncState: string
  /** Список собирается заново, не тихо. */
  dialogsLoading: boolean
}

/** Список чатов: вход, первый ответ сервера после списка из кэша, обрыв связи. */
export function listActivityOf(s: ListActivityState): MessengerActivity | null {
  if (!s.authenticated || s.syncError) return null
  switch (s.syncState) {
    case 'SYNCING':
      return s.dialogsLoading ? 'updating' : null
    // PREPARED — список встал из кэша прошлого раза, а сервер ещё не ответил;
    // CATCHUP — связь вернулась, догоняем пропущенное.
    case 'PREPARED':
    case 'CATCHUP':
      return 'updating'
    case 'RECONNECTING':
    case 'ERROR':
      return 'reconnecting'
    default:
      return 'connecting'
  }
}

/** Открытый чат: его сообщения и история выше — поверх состояния списка. */
export function chatActivityOf(
  list: MessengerActivity | null,
  messagesLoading: boolean
): MessengerActivity | null {
  return messagesLoading ? 'messages' : list
}
