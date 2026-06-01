// Хелперы мессенджера: работа с Matrix-событиями, конвертация адресов, детекция аудио

import CryptoJS from 'crypto-js'

import { matrixService } from './services/matrix-service'

/**
 * Универсальное представление Matrix-события: либо обёртка SDK (`MatrixEvent` с
 * методами `getId`/`getContent`/...), либо «сырой» JSON-объект (поля `event_id`,
 * `content`, `type`, ...). Хелперы ниже принимают оба варианта, поэтому опираемся
 * на структурный тип с опциональными методами и полями.
 */
export interface EventLike {
  getId?: () => string
  getContent?: () => Record<string, unknown>
  getType?: () => string
  getRoomId?: () => string
  getSender?: () => string
  getTs?: () => number
  getStateKey?: () => string | undefined
  event_id?: string
  id?: string
  content?: Record<string, unknown>
  type?: string
  room_id?: string
  sender?: string
  origin_server_ts?: number
  // Поля «сырого» события и подмножества MxEvent — чтобы события из разных частей
  // кода (SDK `MatrixEvent`, локальный `MxEvent`, raw JSON) были присваиваемы
  // этому типу (без них срабатывает weak-type-проверка «нет общих свойств»).
  event?: Record<string, unknown>
  state_key?: string
}

/** Минимальное представление комнаты для хелперов (SDK Room или сырой объект). */
export interface RoomLike {
  tetatet?: boolean
  name?: string
  timeline?: unknown[]
  getJoinedMembers?: () => MemberLike[]
  currentState?: { getMembers?: () => MemberLike[] }
  getCanonicalAlias?: () => string | null | undefined
  getLiveTimeline?: () => { getEvents?: () => unknown[] } | null | undefined
}

/** Минимальное представление участника комнаты. */
export interface MemberLike {
  userId: string
}

// --- Извлечение данных из Matrix-событий ---

/** Безопасное извлечение ID события (обёртка SDK или raw JSON) */
export const getEventId = (event: EventLike | null | undefined): string => {
  if (!event) return 'unknown'
  if (typeof event.getId === 'function') return event.getId()
  return event.event_id || event.id || 'unknown'
}

/**
 * Извлечение содержимого события.
 * Возвращает `any`, т.к. вызывающий код (messenger-chat-store) выполняет глубокий
 * динамический доступ/мутации полей расшифрованного Matrix-контента
 * (`content.info.secrets = ...`, `content.msgtype`, `content.file?.url` и т.д.),
 * для которых строгий тип неприменим без каскада ошибок.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- расшифрованный Matrix-контент: динамический доступ/мутации полей у вызывающих
export const getEventContent = (event: EventLike | null | undefined): any => {
  if (!event) return {}
  if (typeof event.getContent === 'function') return event.getContent()
  return event.content || {}
}

/** Извлечение типа события */
export const getEventType = (event: EventLike | null | undefined): string => {
  if (!event) return 'unknown'
  if (typeof event.getType === 'function') return event.getType()
  return event.type || 'unknown'
}

/** Извлечение roomId события */
export const getEventRoomId = (event: EventLike | null | undefined): string => {
  if (!event) return 'unknown'
  if (typeof event.getRoomId === 'function') return event.getRoomId()
  return event.room_id || 'unknown'
}

/** Извлечение отправителя события */
export const getEventSender = (event: EventLike | null | undefined): string => {
  if (!event) return 'unknown'
  if (typeof event.getSender === 'function') return event.getSender()
  return event.sender || 'unknown'
}

/** Извлечение timestamp события */
export const getEventTs = (event: EventLike | null | undefined): number => {
  if (!event) return 0
  if (typeof event.getTs === 'function') return event.getTs()
  return event.origin_server_ts || 0
}

// --- Определение типов событий ---

/**
 * Проверяет, является ли событие отображаемым сообщением
 * (текст, аудио, зашифрованное сообщение)
 */
export const isRenderableMessageEvent = (event: EventLike | null | undefined): boolean => {
  const type = getEventType(event)
  if (type === 'm.room.encrypted') return true
  if (type !== 'm.room.message') return false

  const content = getEventContent(event)
  const msgtype = content.msgtype

  if (
    msgtype === 'm.text' ||
    msgtype === 'm.notice' ||
    msgtype === 'm.emote' ||
    msgtype === 'm.encrypted' ||
    msgtype === 'm.audio'
  )
    return true

  return typeof content.body === 'string' && content.body.trim().length > 0
}

/** Событие — именно сообщение (не реакция). Нужно для lastMessage/сортировки диалогов */
export const isMessageEvent = (event: EventLike | null | undefined): boolean => {
  const type = getEventType(event)
  return type === 'm.room.message' || type === 'm.room.encrypted'
}

// --- Конвертация идентификаторов ---

/** Извлекает локальную часть Matrix ID (без @ и :server) */
export const getMatrixId = (userId: string): string => {
  if (!userId) return ''
  return userId.split(':')[0]?.replace('@', '') || ''
}

/**
 * Вычисляет ID тет-а-тет комнаты из двух пользовательских ID.
 * Используется для определения DM-комнат.
 */
export const tetatetid = (user1: string, user2: string): string | null => {
  if (!user1 || !user2 || user1 === user2) return null
  const id1 = parseInt(user1, 16)
  const id2 = parseInt(user2, 16)
  if (Number.isNaN(id1) || Number.isNaN(id2)) return null
  const seed = 2
  const id = id1 * id2 * seed
  return CryptoJS.SHA224(id.toString()).toString(CryptoJS.enc.Hex)
}

/** Определяет, является ли комната тет-а-тет (DM) */
export const isTetatetchat = (room: RoomLike | null | undefined): boolean => {
  if (!room) return false
  if (typeof room.tetatet !== 'undefined') return room.tetatet

  const members =
    typeof room.getJoinedMembers === 'function'
      ? room.getJoinedMembers()
      : room.currentState?.getMembers
        ? room.currentState.getMembers()
        : []

  if (!members || members.length !== 2) return false

  const ids = members.map((m: MemberLike) => getMatrixId(m.userId)).filter(Boolean)
  if (ids.length !== 2) return false

  const tid = tetatetid(ids[0]!, ids[1]!)
  if (!tid) return false

  const roomName = room.name || ''
  const alias = typeof room.getCanonicalAlias === 'function' ? room.getCanonicalAlias() || '' : ''
  const tt = roomName === `#${tid}` || alias.includes(tid)

  if (members.length > 1) room.tetatet = tt
  return tt
}

/**
 * Извлекает Pocketnet-адрес из Matrix ID (@hex:server).
 * Hex конвертируется в Base58 адрес через matrixService.
 */
export const getAddressFromMatrixId = (matrixId: string): string | null => {
  if (matrixId && matrixId.startsWith('@') && matrixId.includes(':')) {
    const parts = matrixId.split(':')
    let userId = parts[0]!.substring(1)

    // Hex-encoded адреса (стандарт для Bastyon)
    if (/^(0x)?[0-9a-fA-F]+$/.test(userId)) {
      if (userId.startsWith('0x')) userId = userId.substring(2)
      const address = matrixService.hexToAddress(userId)
      if (address && address.length > 10) return address
      return null
    }

    return userId
  }
  return null
}

// --- Работа с таймлайном ---

/**
 * Извлекает события из таймлайна комнаты.
 * Возвращает `any[]`: события передаются дальше двум вызывающим (messenger-store
 * и messenger-chat-store), каждый из которых трактует их под собственным узким
 * интерфейсом события (`EventLike` / `MxEvent`); общий строгий тип здесь дал бы
 * каскад несовместимостей у вызывающих.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- события таймлайна потребляются под разными узкими интерфейсами у вызывающих
export const getRoomTimelineEvents = (room: RoomLike | null | undefined): any[] => {
  if (!room) return []
  if (typeof room.getLiveTimeline === 'function') {
    const liveTimeline = room.getLiveTimeline()
    if (liveTimeline && typeof liveTimeline.getEvents === 'function') {
      return liveTimeline.getEvents() ?? []
    }
  }
  return Array.isArray(room.timeline) ? room.timeline : []
}

// --- Конвертация hex/base64 ---

/** Конвертация hex-строки в Uint8Array */
export function hexStringToUint8Array(hexString: string): Uint8Array {
  const bytes = new Uint8Array(hexString.length / 2)
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16)
  }
  return bytes
}

/** Конвертация base64-строки в Uint8Array */
export function base64StringToUint8Array(base64String: string): Uint8Array {
  const binaryString = atob(base64String)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

// --- Детекция MIME-типа аудио ---

/** Определяет MIME-тип аудио по магическим байтам */
export const detectAudioMime = (bytes: Uint8Array): string | null => {
  if (!bytes || bytes.length < 4) return null
  const b0 = bytes[0]!,
    b1 = bytes[1]!,
    b2 = bytes[2]!,
    b3 = bytes[3]!
  if (b0 === 0x49 && b1 === 0x44 && b2 === 0x33) return 'audio/mpeg'
  if (b0 === 0xff && (b1 & 0xe0) === 0xe0) return 'audio/mpeg'
  if (b0 === 0x4f && b1 === 0x67 && b2 === 0x67 && b3 === 0x53) return 'audio/ogg'
  if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46) return 'audio/wav'
  if (b0 === 0xff && (b1 & 0xf0) === 0xf0) return 'audio/aac'
  if (b0 === 0x1a && b1 === 0x45 && b2 === 0xdf && b3 === 0xa3) return 'audio/webm'
  if (b0 === 0x66 && b1 === 0x4c && b2 === 0x61 && b3 === 0x43) return 'audio/flac'
  return null
}

// --- Вспомогательные утилиты ---

/** Извлекает URL из различных форматов (строка, объект с uri/url) */
export const extractUrl = (u: unknown): string | null => {
  if (!u) return null
  if (typeof u === 'string') return u
  if (typeof u === 'object') {
    const obj = u as { uri?: unknown; url?: unknown }
    if (typeof obj.uri === 'string') return obj.uri
    if (typeof obj.url === 'string') return obj.url
  }
  return null
}

/** Парсит строку ключей профиля в массив */
export const parseProfileKeys = (keys?: string): string[] => {
  if (!keys) return []
  return keys
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
}

/** Содержимое события с (опциональными) секретами шифрования. */
interface SecretsHolder {
  block?: number
}
interface BlockableContent {
  info?: { secrets?: SecretsHolder }
  pbody?: { secrets?: SecretsHolder }
  secrets?: SecretsHolder
  block?: number
}

/** Применяет номер блока к содержимому события (для шифрования) */
export const applyBlockToContent = (content: BlockableContent | null | undefined, block: number) => {
  if (!content || !block) return
  if (content.info?.secrets) content.info.secrets.block = block
  if (content.pbody?.secrets) content.pbody.secrets.block = block
  if (content.secrets) content.secrets.block = block
  content.block = block
}

/**
 * Форматирует timestamp сообщения как «{дата ru-RU}, HH:MM».
 * Год добавляется только если сообщение не из текущего года.
 */
export const formatMessageTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const isCurrentYear = date.getFullYear() === now.getFullYear()

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  if (!isCurrentYear) dateOptions.year = 'numeric'
  const dateStr = date.toLocaleDateString('ru-RU', dateOptions)

  return `${dateStr}, ${timeStr}`
}

/**
 * Форматирует продолжительность в секундах как «MM:SS» (с ведущими нулями).
 * Используется для рекордера голосовых сообщений и плеера аудио.
 */
export const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/**
 * Резолвит Matrix-хост из baseUrl матрицы.
 * Для localhost/127.0.0.1 возвращает дефолтный хост.
 */
export const resolveMatrixHost = (): string => {
  const DEFAULT_HOST = 'matrix.pocketnet.app'
  try {
    const base = matrixService.getBaseUrl()
    const parsed = new URL(base.startsWith('http') ? base : window.location.origin)
    const h = parsed.host || window.location.host
    return h.includes('localhost') || h.startsWith('127.') ? DEFAULT_HOST : h
  } catch (_e) {
    const h = window.location.host
    return h.includes('localhost') || h.startsWith('127.') ? DEFAULT_HOST : h
  }
}
