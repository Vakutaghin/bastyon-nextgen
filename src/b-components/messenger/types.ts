export interface User {
  id: string
  name: string
  avatar?: string
  online?: boolean
  verified?: boolean
}

export interface Message {
  id: string
  chatId: string
  senderId: string
  senderName?: string
  text: string
  type?: 'text' | 'audio' | 'image' | 'file'
  url?: string
  info?: any
  rawContent?: any
  timestamp: number
  read: boolean
  status: 'sending' | 'sent' | 'read' | 'failed'
}

export interface Dialog {
  id: string
  partner: User
  unreadCount: number
  lastMessage?: Message
  /** Время создания комнаты (Unix, сек) — для сортировки диалогов без сообщений в общем ряду */
  createdAt?: number
}
