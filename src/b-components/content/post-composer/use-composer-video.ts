/**
 * Загрузка своего видео или аудио из композера (P3): файл → PeerTube-инстанс
 * (uploadVideoToPeertube: хост от ноды, вход подписью, возобновляемая загрузка)
 * → указатель `peertube://host/uuid[/audio]` в `u` поста.
 *
 * Состояния: idle → uploading → done | error. Отмена возвращает в idle,
 * «Повторить» продолжает с места обрыва (транспорт помнит upload_id).
 */

import { computed, ref, shallowRef } from 'vue'

import { t } from '@/i18n'
import type { KeyPair } from '@/blockchain/types/keys'
import { formatFileSize } from '@/b-components/video-uploader/utils/video-formatter'
import { uploadVideoToPeertube } from '@/services/peertube/peertube-video-service'
import { QuotaExceededError } from '@/services/peertube/peertube-quota'
import { PeertubeUploadError } from '@/services/peertube/peertube-upload'
import { MAX_VIDEO_SIZE_BYTES, VideoValidationError } from '@/services/peertube/peertube-validation'

export type ComposerVideoState = 'idle' | 'uploading' | 'done' | 'error'

export interface UploadedComposerVideo {
  pointer: string
  isAudio: boolean
  /** Имя файла без расширения — заготовка заголовка поста. */
  title: string
}

export interface UseComposerVideoOptions {
  /** Ключи автора; null — не вошёл (композер откроет вход). */
  getAuth: () => { keyPair: KeyPair; address: string } | null
  /** Заголовок поста к моменту загрузки — имя видео на инстансе. */
  getTitle: () => string
  onUploaded: (video: UploadedComposerVideo) => void
  onRemoved: () => void
  onAuthRequired: () => void
  /** Подмена сервиса в тестах. */
  upload?: typeof uploadVideoToPeertube
}

/** Имя файла без расширения: «Отпуск 2026.mp4» → «Отпуск 2026». */
export function titleFromFileName(name: string): string {
  return name.replace(/\.[^./\\]{1,8}$/, '').trim()
}

/** Ошибка загрузки → текст для человека. */
export function describeVideoUploadError(error: unknown): string {
  if (error instanceof VideoValidationError) {
    if (error.code === 'video_too_large') {
      return t('postComposer.videoErrTooLarge', { max: formatFileSize(MAX_VIDEO_SIZE_BYTES) })
    }
    return t('postComposer.videoErrFormat')
  }
  if (error instanceof QuotaExceededError) {
    return t('postComposer.videoErrQuota', {
      left: formatFileSize(Math.max(0, error.remainingDaily)),
    })
  }
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof PeertubeUploadError) {
    if (error.status === 413) return t('postComposer.videoErrServerSize')
    if (error.status === 415) return t('postComposer.videoErrFormat')
  }
  if (message === 'peertube_no_host') return t('postComposer.videoErrNoServer')
  if (
    /^peertube_(oauth|blockchain_auth|token|me)_/.test(message) ||
    message === 'peertube_no_channel'
  ) {
    return t('postComposer.videoErrAuth')
  }
  // Обрыв связи или временный отказ инстанса: повтор продолжит с места обрыва.
  if (
    /^peertube_chunk_retryable_/.test(message) ||
    /timeout|network|failed to fetch|load failed/i.test(message)
  ) {
    return t('postComposer.videoErrNetwork')
  }
  return t('postComposer.videoErrGeneric')
}

export function useComposerVideo(options: UseComposerVideoOptions) {
  const upload = options.upload ?? uploadVideoToPeertube

  const state = ref<ComposerVideoState>('idle')
  const percent = ref(0)
  // shallowRef: File уходит в fetch/slice как есть, без reactive-прокси.
  const file = shallowRef<File | null>(null)
  const isAudio = ref(false)
  const errorText = ref('')
  let controller: AbortController | null = null

  const fileLabel = computed(() =>
    file.value ? `${file.value.name} · ${formatFileSize(file.value.size)}` : ''
  )

  async function start(picked: File): Promise<void> {
    const auth = options.getAuth()
    if (!auth) {
      options.onAuthRequired()
      return
    }
    file.value = picked
    state.value = 'uploading'
    percent.value = 0
    errorText.value = ''
    const current = new AbortController()
    controller = current

    try {
      const result = await upload({
        file: picked,
        name: options.getTitle().trim() || titleFromFileName(picked.name),
        keyPair: auth.keyPair,
        address: auth.address,
        signal: current.signal,
        onProgress: (p) => {
          if (controller === current) percent.value = Math.min(100, Math.round(p.percent))
        },
      })
      if (controller !== current) return
      isAudio.value = result.isAudio
      state.value = 'done'
      options.onUploaded({
        pointer: result.pointer,
        isAudio: result.isAudio,
        title: titleFromFileName(picked.name),
      })
    } catch (error) {
      if (controller !== current) return
      if (error instanceof PeertubeUploadError && error.cancelled) {
        state.value = 'idle'
        return
      }
      console.error('[composer-video] upload failed:', error)
      errorText.value = describeVideoUploadError(error)
      state.value = 'error'
    } finally {
      if (controller === current) controller = null
    }
  }

  /** Прервать загрузку: инстанс получит DELETE, композер вернётся к выбору файла. */
  function cancel(): void {
    controller?.abort()
    controller = null
    state.value = 'idle'
    percent.value = 0
  }

  /** Тот же файл ещё раз: загрузка продолжится с места обрыва. */
  function retry(): void {
    if (file.value) void start(file.value)
  }

  /** Убрать загруженное видео из поста (на инстансе оно остаётся, как в старом клиенте). */
  function remove(): void {
    state.value = 'idle'
    file.value = null
    percent.value = 0
    options.onRemoved()
  }

  /**
   * Панель смонтировалась заново, а видео уже в посте (переключали режим
   * статьи): показать «прикреплено», а не выбор файла.
   */
  function restore(pointer: string): void {
    if (!pointer || state.value !== 'idle') return
    isAudio.value = /\/audio$/.test(pointer)
    state.value = 'done'
  }

  /** Композер сбросился (пост опубликован) — начать с чистого листа. */
  function reset(): void {
    controller?.abort()
    controller = null
    state.value = 'idle'
    file.value = null
    percent.value = 0
    errorText.value = ''
  }

  return {
    state,
    percent,
    fileLabel,
    isAudio,
    errorText,
    start,
    cancel,
    retry,
    remove,
    restore,
    reset,
  }
}
