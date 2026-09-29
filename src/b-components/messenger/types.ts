export interface User {
  id: string
  name: string
  avatar?: string
  online?: boolean
  verified?: boolean
}

/** Одна агрегированная реакция (эмодзи + количество + поставил ли текущий пользователь) */
export interface MessageReaction {
  key: string
  count: number
  my?: boolean
}

/**
 * Метаданные вложения (Matrix `content.info` + локальные поля прогресса).
 * Свободная по форме структура декодированного Matrix-контента: известные поля
 * типизированы, остальные доступны через индексную сигнатуру.
 */
export interface MessageInfo {
  mimetype?: string
  size?: number
  duration?: number
  w?: number
  h?: number
  uploadProgress?: number
  url?: string
  httpUrl?: string
  posterUrl?: string | null
  thumbnail_url?: string
  thumbnail_info?: Record<string, unknown>
  secrets?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Сеть диалога: Matrix (по умолчанию, поле не задано) или mesh-сеть через
 * радио (src/mesh). У mesh-диалогов id начинается с `mesh:`.
 */
export type ChatTransport = 'matrix' | 'meshcore' | 'meshtastic' | 'lxmf'

/** Диалог или сообщение идёт через mesh-сеть (MeshCore, Meshtastic, Reticulum/LXMF). */
export function isMeshTransport(
  t: ChatTransport | undefined
): t is 'meshcore' | 'meshtastic' | 'lxmf' {
  return t === 'meshcore' || t === 'meshtastic' || t === 'lxmf'
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  senderName?: string
  text: string
  type?: 'text' | 'audio' | 'image' | 'video' | 'file' | 'transaction'
  url?: string
  info?: MessageInfo
  rawContent?: Record<string, unknown> | null
  timestamp: number
  read: boolean
  /** `delivered` — mesh: радио получателя подтвердило (ACK), прочтения там нет. */
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
  /** Реакции на сообщение (эмодзи), заполняется из Matrix m.reaction */
  reactions?: MessageReaction[]
  /** Ответ на сообщение: event_id оригинала (Matrix m.in_reply_to). Превью
   *  резолвится в message-item по store.messages текущего диалога. */
  replyTo?: { id: string }
  /** Пришло зашифрованным (E2E): OG-превью ссылок для таких не запрашиваем (S33). */
  encrypted?: boolean
  /** Не задано — Matrix. */
  transport?: ChatTransport
  /** Meshtastic: у сообщения есть id пакета — на него можно ответить и отреагировать по радио. */
  meshReplyable?: boolean
}

export interface Dialog {
  id: string
  partner: User
  unreadCount: number
  lastMessage?: Message
  /** Время создания комнаты (Unix, сек) — для сортировки диалогов без сообщений в общем ряду */
  createdAt?: number
  /** Не задано — Matrix. */
  transport?: ChatTransport
  /** Mesh: личный диалог с узлом, канал или комната (room server MeshCore). */
  meshKind?: 'direct' | 'channel' | 'room'
  /** Mesh-канал: открытый (Public, #тег, ключ по умолчанию) или приватный. */
  channelKind?: 'public' | 'hashtag' | 'private'
}
