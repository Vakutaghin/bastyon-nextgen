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
  metadata?: Record<string, any>
}

/**
 * Пример интерфейса для кэша контента
 */
export interface ContentCache extends BaseEntity {
  key: string
  data: any
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
  value: any
}

/**
 * Интерфейс для избранных постов
 */
export interface FavoritePost {
  id: string
  addedAt: number
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
  mesType?: string
  upvoteVal?: number
}
