/**
 * Фаза E — высокоуровневый сервис загрузки видео: связывает A→D в один вызов и
 * возвращает готовый указатель `peertube://host/uuid[/audio]` для post.url.
 *
 * Последовательность (порт из pocketnet.gui uploadpeertube/index.js + peertube.js:758-796):
 *   validate → resolveHost('upload') → ensureToken(blockChainAuth) → getChannel →
 *   checkDailyQuota → uploadVideoResumable(metadata) → composePeerTubeUrl.
 *
 * Метаданные upload: privacy:1 + channelId + name (фолбэк `PocketVideo:<ISO>`) +
 * scheduleUpdate[updateAt] задаются в initResumableUpload (Фаза C).
 *
 * invalid_token mid-request (отложено из Фаз B/C): при 401 на аплоуде делаем разовую
 * ПОЛНУЮ переавторизацию (минуя кэш) и повторяем — resume-state продолжит с места обрыва.
 *
 * Все шаги — инъектируемые зависимости (deps): логика тестируется без живой ноды.
 */

import type { KeyPair } from '@/blockchain/types/keys'
import { composePeerTubeUrl } from '@/helpers/api/peertube-parser'
import { resolvePeertubeHost } from './peertube-host'
import {
  authenticatePeertube,
  buildPeertubeSignature,
  ensurePeertubeToken,
  getPeertubeChannel,
  savePeertubeToken,
} from './peertube-auth'
import { checkDailyQuota } from './peertube-quota'
import { validateVideoFile } from './peertube-validation'
import {
  PeertubeUploadError,
  uploadVideoResumable,
  type UploadProgress,
  type UploadVideoResult,
} from './peertube-upload'
import { peertubeInstanceFetch, type InstanceFetch } from './peertube-instance'

/** Итог загрузки: указатель для post.url + разобранные части. */
export interface UploadedVideo {
  /** peertube://host/uuid[/audio] — кладётся в post.url. */
  pointer: string
  host: string
  uuid: string
  isAudio: boolean
}

/** Инъектируемые шаги (для тестов). По умолчанию — реальные функции слоёв A→D. */
export interface VideoServiceDeps {
  validate: typeof validateVideoFile
  resolveHost: typeof resolvePeertubeHost
  buildSignature: typeof buildPeertubeSignature
  ensureToken: typeof ensurePeertubeToken
  getChannel: typeof getPeertubeChannel
  checkQuota: typeof checkDailyQuota
  upload: typeof uploadVideoResumable
  /** Полная переавторизация для retry на invalid_token (минуя кэш). */
  authenticate: typeof authenticatePeertube
  /** Сохранение свежего токена после переавторизации. */
  saveToken: typeof savePeertubeToken
}

const DEFAULT_DEPS: VideoServiceDeps = {
  validate: validateVideoFile,
  resolveHost: resolvePeertubeHost,
  buildSignature: buildPeertubeSignature,
  ensureToken: ensurePeertubeToken,
  getChannel: getPeertubeChannel,
  checkQuota: checkDailyQuota,
  upload: uploadVideoResumable,
  authenticate: authenticatePeertube,
  saveToken: savePeertubeToken,
}

export interface UploadVideoParams {
  file: File
  /** Имя видео; фолбэк — имя файла, затем `PocketVideo:<ISO>`. */
  name?: string
  keyPair: KeyPair
  address: string
  /** Обложка (dataURL→File делает вызывающий). */
  thumbnailFile?: File
  signal?: AbortSignal
  onProgress?: (p: UploadProgress) => void
  /** Частичная замена шагов для тестов. */
  deps?: Partial<VideoServiceDeps>
  /** DI времени для детерминизма фолбэка имени. */
  nowIso?: () => string
}

/** true — ошибка авторизации инстанса (истёк/невалидный токен) на upload-запросе. */
function isAuthError(e: unknown): boolean {
  return e instanceof PeertubeUploadError && e.status === 401
}

/**
 * Грузит видео на PeerTube-инстанс и возвращает указатель для поста.
 * Кидает: VideoValidationError (валидация), QuotaExceededError (квота),
 * PeertubeUploadError (транспорт, в т.ч. cancelled), Error('peertube_no_host').
 */
export async function uploadVideoToPeertube(params: UploadVideoParams): Promise<UploadedVideo> {
  const deps = { ...DEFAULT_DEPS, ...params.deps }
  const { keyPair, address } = params
  const nowIso = params.nowIso ?? (() => new Date().toISOString())

  // A. Валидация файла (+ пере-обёртка MKV). isAudio для указателя берём из ответа
  // инстанса (result.isAudio) — он авторитетнее MIME-догадки на клиенте.
  const { file } = await deps.validate(params.file)

  // A. Выбор хоста под задачу upload.
  const host = await deps.resolveHost('upload')
  const fetchInstance: InstanceFetch = (path, init) => peertubeInstanceFetch(host, path, init)

  // B. Авторизация (blockChainAuth OAuth, кэш пер-user-пер-host).
  const signature = deps.buildSignature(keyPair, address)
  const token = await deps.ensureToken({ host, address, signature })

  // B. Канал (channelId + квоты) — из users/me.
  const channel = await deps.getChannel({ host, accessToken: token.access_token })

  // D. Дневная квота ДО старта аплоуда (реюз квот из канала, без второго users/me).
  await deps.checkQuota({
    size: file.size,
    videoQuotaDaily: channel.videoQuotaDaily,
    videoQuota: channel.videoQuota,
    host,
    accessToken: token.access_token,
  })

  // E. Метаданные: имя с фолбэками.
  const name = params.name?.trim() || file.name || `PocketVideo:${nowIso()}`
  const metadata = {
    channelId: channel.channelId,
    name,
    thumbnailFile: params.thumbnailFile,
  }

  const runUpload = (accessToken: string): Promise<UploadVideoResult> =>
    deps.upload({
      host,
      address,
      accessToken,
      file,
      metadata,
      signal: params.signal,
      onProgress: params.onProgress,
    })

  // C. Транспорт + разовый retry на invalid_token (полная переавторизация минуя кэш).
  let result: UploadVideoResult
  try {
    result = await runUpload(token.access_token)
  } catch (e) {
    if (!isAuthError(e)) throw e
    const fresh = await deps.authenticate(signature, fetchInstance)
    deps.saveToken(address, host, fresh)
    result = await runUpload(fresh.access_token)
  }

  // E. Указатель для post.url (истинный host — из результата, мог смениться mid-flow).
  const pointer = composePeerTubeUrl(result.host, result.uuid, { isAudio: result.isAudio })
  return { pointer, host: result.host, uuid: result.uuid, isAudio: result.isAudio }
}
