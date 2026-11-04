/**
 * Загрузка + воспроизведение голосового сообщения.
 *
 * Поддерживает Bastyon-шифрование (msg.info.secrets) через messenger-store.
 * Делит глобальный реестр `playingByChat` со всеми экземплярами — при старте
 * нового аудио предыдущее в том же чате ставится на паузу.
 *
 * Время — как в Telegram: длительность видна сразу (из события, `info.duration`
 * в мс), потом уточняется по самому звуку; с первого нажатия — позиция. Где
 * остановили, помнит `audio-positions` (пауза, другое голосовое, уход из
 * чата); дослушали — снова с начала.
 *
 * На onerror пробуем MIME-fixup `audio/mpeg` — типичная починка для серверов,
 * отдающих octet-stream вместо реального MIME аудио.
 *
 * См. CODE_AUDIT.md §1.
 */
import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'
import { matrixFetch } from '@/helpers/api/request'
import { localMediaBlob } from '../../services/local-media'
import type { Message } from '../../types'
import { t } from '@/i18n'
import { positionKey, rememberPosition, rememberedPosition } from './audio-positions'

// Глобальный реестр активного аудио в каждом чате — старт нового
// автоматически останавливает предыдущее.
const playingByChat = new Map<string, HTMLAudioElement>()

/** `HTMLMediaElement.HAVE_METADATA`: у happy-dom статических констант нет. */
const HAVE_METADATA = 1

export interface AudioPlayback {
  isPlaying: Ref<boolean>
  /** Длительность, с; 0 — пока не известна. */
  duration: Ref<number>
  /** Где играет или где остановили, с. */
  currentTime: Ref<number>
  isLoadingWave: Ref<boolean>
  hasError: Ref<string | null>
  isReady: Ref<boolean>
  /** Показывать позицию, а не длительность: играет или остановлено не в начале. */
  showsPosition: ComputedRef<boolean>
  togglePlay: () => Promise<void>
  seekAt: (ratio: number) => void
  /** Запускает загрузку, decode + setup audio element. */
  prepare: () => Promise<void>
}

export interface AudioPlaybackOptions {
  message: Message
  /**
   * Декодирует blob в waveform (вызывается параллельно с подготовкой audio el).
   * Возвращает длительность звука в секундах, если декодер её узнал.
   */
  computeWaveform: (blob: Blob) => Promise<number | null>
  /** Расшифровка Bastyon-secrets (messenger-store API). */
  decryptAudioData: (blob: Blob, message: Message) => Promise<Blob | null>
}

/** Длительность из события: Matrix пишет её в миллисекундах. */
function infoDuration(message: Message): number {
  const ms = message.info?.duration
  return typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? ms / 1000 : 0
}

export function useAudioPlayback(opts: AudioPlaybackOptions): AudioPlayback {
  const { message, computeWaveform, decryptAudioData } = opts
  const key = positionKey(message)

  const audioEl = ref<HTMLAudioElement | null>(null)
  const objectUrl = ref<string | null>(null)
  const lastBlob = ref<Blob | null>(null)
  const isPlaying = ref(false)
  const duration = ref(infoDuration(message))
  const currentTime = ref(rememberedPosition(key))
  const isLoadingWave = ref(true)
  const hasError = ref<string | null>(null)
  const isReady = ref(false)
  const showsPosition = computed<boolean>(() => isPlaying.value || currentTime.value > 0)

  /** Длительность по самому звуку; Infinity (запись без длительности в файле) не берём. */
  function setDuration(seconds: number): void {
    if (Number.isFinite(seconds) && seconds > 0) duration.value = seconds
  }

  function hasMetadata(el: HTMLAudioElement): boolean {
    return el.readyState >= HAVE_METADATA
  }

  function releaseChat(el: HTMLAudioElement): void {
    if (message.chatId && playingByChat.get(message.chatId) === el) {
      playingByChat.delete(message.chatId)
    }
  }

  async function prepare(): Promise<void> {
    try {
      hasError.value = null
      isLoadingWave.value = true
      const url = message.url
      if (!url) {
        hasError.value = t('messenger.audioNoUrl')
        return
      }
      // Голосовое mesh-сети уже в памяти (`blob:`): fetch такой ссылки CSP
      // не пускает (connect-src), да и незачем.
      let blob = localMediaBlob(url) ?? null
      if (!blob) {
        const response = await matrixFetch(url, { mode: 'cors' })
        if (!response.ok) {
          hasError.value = `HTTP ${response.status}`
          return
        }
        blob = await response.blob()
      }

      // Bastyon-шифрованные аудио (secrets) — расшифровываем через store.
      if (message.info?.secrets) {
        const decrypted = await decryptAudioData(blob, message)
        if (decrypted) blob = decrypted
      }

      lastBlob.value = blob
      setDuration((await computeWaveform(blob)) ?? 0)
      isLoadingWave.value = false

      const oUrl = URL.createObjectURL(blob)
      objectUrl.value = oUrl

      const el = new Audio()
      el.src = oUrl
      el.preload = 'auto'

      el.addEventListener('loadedmetadata', () => {
        setDuration(el.duration)
        isReady.value = true
        // Остановились раньше (или перемотали до загрузки) — продолжаем оттуда.
        if (currentTime.value > 0) el.currentTime = currentTime.value
      })

      el.addEventListener('durationchange', () => setDuration(el.duration))

      el.addEventListener('timeupdate', () => {
        // До метаданных позиция элемента — ноль загрузки, а не место остановки.
        if (hasMetadata(el)) currentTime.value = el.currentTime || 0
      })

      el.addEventListener('ended', () => {
        isPlaying.value = false
        currentTime.value = 0
        rememberPosition(key, 0)
      })

      el.addEventListener('error', () => {
        // Пытаемся прижать MIME = audio/mpeg и перезагрузить — типичная починка
        // для серверов, отдающих octet-stream / encrypted/audio/mpeg.
        try {
          if (lastBlob.value) {
            const fixedBlob = new Blob([lastBlob.value], { type: 'audio/mpeg' })
            const fixedUrl = URL.createObjectURL(fixedBlob)

            el.src = fixedUrl
            el.load()

            if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
            objectUrl.value = fixedUrl

            hasError.value = null
            return
          }
        } catch {
          // ignore — упадём в общую ошибку ниже
        }

        hasError.value = t('messenger.audioPlayFailed')
      })

      el.addEventListener('pause', () => {
        // Своя пауза, старт другого голосового или уход из чата — место
        // остановки остаётся за сообщением. Конец записи — тоже pause, но
        // за ним ended: там позиция сбрасывается.
        isPlaying.value = false
        if (!el.ended && hasMetadata(el)) rememberPosition(key, el.currentTime)
        releaseChat(el)
      })

      audioEl.value = el
    } catch (e) {
      hasError.value = e instanceof Error ? e.message : t('messenger.audioLoadFailed')
      isLoadingWave.value = false
    }
  }

  async function togglePlay(): Promise<void> {
    const el = audioEl.value
    if (!el) return

    try {
      if (isPlaying.value) {
        el.pause()
        isPlaying.value = false
        return
      }
      const prev = message.chatId ? playingByChat.get(message.chatId) : undefined
      if (prev && prev !== el) prev.pause()

      await el.play()
      isPlaying.value = true
      if (message.chatId) playingByChat.set(message.chatId, el)
    } catch (e) {
      console.error('[AudioMessage] play/pause failed:', e)
    }
  }

  function seekAt(ratio: number): void {
    if (duration.value <= 0) return

    const t = Math.max(0, Math.min(duration.value, ratio * duration.value))
    currentTime.value = t
    const el = audioEl.value
    // Файл ещё грузится — позицию применит loadedmetadata.
    if (el && hasMetadata(el)) el.currentTime = t
    if (!isPlaying.value) rememberPosition(key, t)
  }

  onBeforeUnmount(() => {
    const el = audioEl.value
    if (el) {
      if (!el.ended && hasMetadata(el)) rememberPosition(key, el.currentTime)
      try {
        el.pause()
      } catch {
        // ignore
      }
      releaseChat(el)
    }
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value)
  })

  return {
    isPlaying,
    duration,
    currentTime,
    isLoadingWave,
    hasError,
    isReady,
    showsPosition,
    togglePlay,
    seekAt,
    prepare,
  }
}
