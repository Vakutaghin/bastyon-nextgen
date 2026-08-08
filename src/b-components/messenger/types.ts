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
  status: 'sending' | 'sent' | 'read' | 'failed'
  /** Реакции на сообщение (эмодзи), заполняется из Matrix m.reaction */
  reactions?: MessageReaction[]
  /** Ответ на сообщение: event_id оригинала (Matrix m.in_reply_to). Превью
   *  резолвится в message-item по store.messages текущего диалога. */
  replyTo?: { id: string }
}

export interface Dialog {
  id: string
  partner: User
  unreadCount: number
  lastMessage?: Message
  /** Время создания комнаты (Unix, сек) — для сортировки диалогов без сообщений в общем ряду */
  createdAt?: number
}
