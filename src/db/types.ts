/**
 * Базовый интерфейс для всех сущностей в базе данных
 */
export interface BaseEntity<TId = number> {
  id?: TId
  createdAt?: number
  updatedAt?: number
}

/**
 * Пример интерфейса для видео данных
 * Можно расширить или заменить на нужные типы
 */
export interface VideoData extends BaseEntity<string> {
  id: string
  url: string
  title?: string
  thumbnail?: string
  duration?: number
  metadata?: Record<string, unknown>
}

/**
 * Пример интерфейса для кэша контента
 */
export interface ContentCache extends BaseEntity {
  key: string
  data: unknown
  expiresAt?: number
}

/**
 * Интерфейс для транскодированных видео
 */
export interface TranscodedVideo extends BaseEntity<string> {
  id: string
  originalFileName: string
  originalSize: number
  transcodedBlob: Blob
  resolution: string // '144p' | '240p' | '360p' | '480p' | '720p'
  bitrate: number // kbps
  hasAudio: boolean
  duration: number // seconds
  width: number
  height: number
  mimeType: string // 'video/mp4' или 'video/webm'
  fps?: number // кадров в секунду
}

export type PendingStatus = 'pending' | 'submitted' | 'confirmed' | 'failed'

export interface PendingPostRating extends BaseEntity {
  id?: number
  shareId: string
  userAddress: string
  ratingValue: number
  status: PendingStatus
  txid?: string
  expiresAt: number
  lastError?: string
  postTitle?: string
}

/**
 * Интерфейс для настроек приложения
 */
export interface AppSettings extends BaseEntity<string> {
  key: string
  value: unknown
}

/**
 * Интерфейс для избранных постов
 */
export interface FavoritePost {
  /** Владелец (Р5): избранное per-account. '' — legacy-записи до привязки/аноним. */
  address: string
  id: string
  addedAt: number
}

/**
 * Расшифрованный текст матрикс-сообщения. Ключ — пара (userId, eventId).
 * События в матрице иммутабельны, поэтому кэш можно хранить «вечно».
 * userId нужен, чтобы при смене аккаунта чужие расшифровки не подтекали.
 */
export interface DecryptedMessage {
  userId: string
  eventId: string
  text: string
  createdAt: number
}

/**
 * Уведомление в IDB: привязано к адресу, есть номер блока для подсчёта непрочитанных
 */
export interface StoredNotification {
  address: string
  id: string
  nblock: number
  type: string
  title: string
  description?: string
  time: number
  link?: string
  from?: string
  shareId?: string
  commentId?: string
  mesType?: string
  upvoteVal?: number
}

/**
 * Позиция просмотра видео. Ключ — стабильная часть ссылки (хост + путь),
 * см. `helpers/common/video-progress`. Не per-account: это удобство плеера на
 * устройстве, а не данные аккаунта.
 */
export interface VideoProgress {
  id: string
  /** Секунды от начала. */
  position: number
  /** Длительность на момент сохранения — чтобы не продолжать чужой/обрезанный ролик. */
  duration: number
  updatedAt: number
}

/** Статус своего mesh-сообщения; `received` — чужое. */
export type MeshMessageStatus = 'sending' | 'sent' | 'delivered' | 'failed' | 'received'

/**
 * Диалог в mesh-сети (MeshCore, Meshtastic): личный с узлом или канал. История
 * живёт только здесь — радио её не хранит (очередь в его памяти очищается, как
 * только приложение забрало сообщение). Привязан к аккаунту Bastyon.
 */
export interface MeshDialogRecord {
  /**
   * `mesh:mc:<свой ключ, 6 байт>:u:<ключ собеседника, 6 байт>`,
   * `mesh:mt:<свой номер>:u:<номер собеседника>` или `…:g:<id канала>`.
   */
  id: string
  account: string
  network: 'meshcore' | 'meshtastic' | 'lxmf'
  /** Свой узел (hex): у каждого радио своя переписка. MeshCore — 6 байт ключа, Meshtastic — номер. */
  selfKey: string
  /** room — комната MeshCore (room server): пишут в неё разные люди. */
  kind: 'direct' | 'channel' | 'room'
  /** MeshCore — полный ключ собеседника (если он в контактах радио); Meshtastic — номер узла. */
  peerKey: string | null
  /**
   * Meshtastic: открытый ключ собеседника, каким его видело приложение. База
   * радио меньше и вытесняет старые узлы — перед ЛС ключ отдаётся радио.
   */
  peerPublicKey?: string
  channelKind?: 'public' | 'hashtag' | 'private'
  name: string
  /** Время последнего сообщения, мс; 0 — сообщений нет. */
  lastTs: number
  lastText: string
  lastMine: boolean
  unread: number
  /** Создан, мс. */
  createdAt: number
}

/** Вложение LXMF: картинка, файл или голос; байты — в самой записи. */
export interface MeshAttachment {
  kind: 'image' | 'file' | 'audio'
  name: string
  mime: string
  data: Uint8Array
}

export interface MeshMessageRecord {
  id: string
  dialogId: string
  account: string
  /**
   * Одно сообщение — одна запись: радио повторяет ЛС, пока не дойдёт ACK, и
   * каждая копия приходит получателю заново. Для чужих — отправитель, его время
   * и текст; для своих — id записи.
   */
  dedupKey: string
  /** Когда отправлено или получено здесь, мс: по нему порядок в чате. */
  ts: number
  /** Время по часам отправителя, секунды. */
  senderTs: number
  mine: boolean
  senderId: string
  senderName: string | null
  text: string
  status: MeshMessageStatus
  attempt?: number
  flood?: boolean
  error?: string
  hops?: number | null
  snr?: number | null
  /** Meshtastic: id пакета — на него ссылаются ответы и реакции. */
  packetId?: number
  /** Meshtastic: ответ на пакет с этим id. */
  replyToPacket?: number
  /** Meshtastic: реакция (text — эмодзи) на пакет с этим id; отдельным сообщением не показывается. */
  reactionTo?: number
  /** Meshtastic: ЛС пришло зашифрованным ключами узлов (PKI). */
  pki?: boolean
  /** Кто-то ретранслировал, но получатель ещё не подтвердил. */
  relayed?: boolean
  /** LXMF: id сообщения (хэш), по нему приходят статусы доставки. */
  lxmfId?: string
  /** LXMF: вложения (картинка, файлы, голос). */
  attachments?: MeshAttachment[]
}
