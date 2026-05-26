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

export interface Message {
  id: string
  chatId: string
  senderId: string
  senderName?: string
  text: string
  type?: 'text' | 'audio' | 'image' | 'video' | 'file' | 'transaction'
  url?: string
  info?: any
  rawContent?: any
  timestamp: number
  read: boolean
  status: 'sending' | 'sent' | 'read' | 'failed'
  /** Реакции на сообщение (эмодзи), заполняется из Matrix m.reaction */
  reactions?: MessageReaction[]
}

export interface Dialog {
  id: string
  partner: User
  unreadCount: number
  lastMessage?: Message
  /** Время создания комнаты (Unix, сек) — для сортировки диалогов без сообщений в общем ряду */
  createdAt?: number
}
