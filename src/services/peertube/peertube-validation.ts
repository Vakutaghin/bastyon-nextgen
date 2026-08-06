/**
 * Фаза D — валидация/препроцессинг видеофайла ПЕРЕД загрузкой (чистая, без сети).
 *
 * Порт из pocketnet.gui/components/uploadpeertube/index.js:285-326 + functions.js:10509-10527.
 * Ключевое:
 * - Локальный транскод НЕ обязателен: грузить можно сырой файл, PeerTube транскодит сам.
 *   Этот модуль лишь проверяет пригодность файла к прямой загрузке.
 * - MIME может быть пустым (Matroska не в IANA) → сниффим magic-байты `1A 45 DF A3`
 *   и оборачиваем в новый File с типом `video/x-matroska`.
 * - Клиентский потолок 4 ГиБ (в оригинале — index.js:321). Это лимит ПРЯМОЙ загрузки;
 *   отдельный лимит стейджинга транскода в IndexedDB (500 МБ в use-upload-state) — другой контур.
 * - Реджекты инстанса 413/415 при init ловятся отдельно в initResumableUpload (peertube-upload).
 */

/** Потолок размера файла для прямой загрузки (4 ГиБ). */
export const MAX_VIDEO_SIZE_BYTES = 4 * 1024 * 1024 * 1024

/** Magic-байты контейнера Matroska (EBML header). */
const MATROSKA_MAGIC = [0x1a, 0x45, 0xdf, 0xa3] as const

export type VideoValidationCode =
  | 'video_not_selected'
  | 'video_format_unsupported'
  | 'video_too_large'

/** Ошибка валидации с машиночитаемым кодом — UI мапит код в локализованный текст. */
export class VideoValidationError extends Error {
  code: VideoValidationCode
  constructor(code: VideoValidationCode) {
    super(code)
    this.name = 'VideoValidationError'
    this.code = code
  }
}

export interface VideoValidationResult {
  /** Файл, пригодный к загрузке (для MKV с пустым MIME — пере-обёрнут в video/x-matroska). */
  file: File
  isAudio: boolean
  isVideo: boolean
}

/** Проверяет первые байты файла на magic-последовательность. Читает ровно magic.length байт. */
async function hasMagicBytes(file: Blob, magic: readonly number[]): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, magic.length).arrayBuffer())
  if (head.length < magic.length) return false
  return magic.every((b, i) => head[i] === b)
}

/** true, если файл — контейнер Matroska (по magic-байтам, даже когда MIME пустой). */
export function isMatroska(file: Blob): Promise<boolean> {
  return hasMagicBytes(file, MATROSKA_MAGIC)
}

/**
 * Валидирует файл к прямой загрузке: определяет video/audio (со сниффингом MKV при
 * пустом MIME), проверяет потолок 4 ГиБ. Кидает VideoValidationError с кодом.
 * Возвращает (возможно пере-обёрнутый) файл и флаги типа.
 */
export async function validateVideoFile(
  file: File | null | undefined
): Promise<VideoValidationResult> {
  if (!file) throw new VideoValidationError('video_not_selected')

  const type = file.type || ''
  const isMimeVideo = type.includes('video')
  const isMimeEmpty = type === ''

  // Matroska с пустым MIME — распознаём по magic-байтам.
  const isMkv = isMimeEmpty && (await isMatroska(file))

  // isAudio считаем по ИСХОДНОМУ типу (до пере-обёртки), как в оригинале.
  const isAudio = type.includes('audio')
  const isVideo = isMimeVideo || isMkv

  if (!isVideo && !isAudio) throw new VideoValidationError('video_format_unsupported')
  if (file.size > MAX_VIDEO_SIZE_BYTES) throw new VideoValidationError('video_too_large')

  // MKV: MIME пустой — оборачиваем в новый File с корректным типом, чтобы инстанс не отверг.
  const outFile = isMkv
    ? new File([file], file.name, { type: 'video/x-matroska', lastModified: file.lastModified })
    : file

  return { file: outFile, isAudio, isVideo }
}
