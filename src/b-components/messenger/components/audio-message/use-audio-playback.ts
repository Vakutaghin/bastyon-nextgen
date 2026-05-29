/**
 * Загрузка + воспроизведение голосового сообщения.
 *
 * Поддерживает Bastyon-шифрование (msg.info.secrets) через messenger-store.
 * Делит глобальный реестр `playingByChat` со всеми экземплярами — при старте
 * нового аудио предыдущее в том же чате паузится через кастомный event 'forcedpause'.
 *
 * На onerror пробуем MIME-fixup `audio/mpeg` — типичная починка для серверов,
 * отдающих octet-stream вместо реального MIME аудио.
 *
 * См. CODE_AUDIT.md §1.
 */
import { onBeforeUnmount, ref, type Ref } from 'vue'
import { matrixFetch } from '@/helpers/api/request'
import type { Message } from '../../types'

// Глобальный реестр активного аудио в каждом чате — старт нового
// автоматически останавливает предыдущее.
const playingByChat = new Map<string, HTMLAudioElement>()

export interface AudioPlayback {
  isPlaying: Ref<boolean>
  duration: Ref<number>
  currentTime: Ref<number>
  isLoadingWave: Ref<boolean>
  hasError: Ref<string | null>
  isReady: Ref<boolean>
  showDurationMode: Ref<boolean>
  togglePlay: () => Promise<void>
  seekAt: (ratio: number) => void
  /** Запускает загрузку, decode + setup audio element. */
  prepare: () => Promise<void>
}

export interface AudioPlaybackOptions {
  message: Message
  /** Декодирует blob в waveform (вызывается параллельно с подготовкой audio el). */
  computeWaveform: (blob: Blob) => Promise<void>
  /** Расшифровка Bastyon-secrets (messenger-store API). */
  decryptAudioData: (blob: Blob, message: Message) => Promise<Blob | null>
}

export function useAudioPlayback(opts: AudioPlaybackOptions): AudioPlayback {
  const { message, computeWaveform, decryptAudioData } = opts

  const audioEl = ref<HTMLAudioElement | null>(null)
  const objectUrl = ref<string | null>(null)
  const lastBlob = ref<Blob | null>(null)
  const isPlaying = ref(false)
  const duration = ref(0)
  const currentTime = ref(0)
  const isLoadingWave = ref(true)
  const hasError = ref<string | null>(null)
  const isReady = ref(false)
  const showDurationMode = ref(true)

  async function prepare(): Promise<void> {
    try {
      hasError.value = null
      isLoadingWave.value = true
      const url = message.url
      if (!url) {
        hasError.value = 'Нет URL аудио'
        return
      }
      const response = await matrixFetch(url, { mode: 'cors' })

      if (!response.ok) {
        hasError.value = `HTTP ${response.status}`
        return
      }

      let blob = await response.blob()

      // Bastyon-шифрованные аудио (secrets) — расшифровываем через store.
      if (message.info?.secrets) {
        const decrypted = await decryptAudioData(blob, message)
        if (decrypted) blob = decrypted
      }

      lastBlob.value = blob
      await computeWaveform(blob)
      isLoadingWave.value = false

      const oUrl = URL.createObjectURL(blob)
      objectUrl.value = oUrl

      const el = new Audio()
      el.src = oUrl
      el.preload = 'auto'

      el.addEventListener('loadedmetadata', () => {
        duration.value = el.duration || 0
        isReady.value = true
        showDurationMode.value = true
      })

      el.addEventListener('timeupdate', () => {
        currentTime.value = el.currentTime || 0
      })

      el.addEventListener('ended', () => {
        isPlaying.value = false
        showDurationMode.value = true
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

        hasError.value = 'Ошибка воспроизведения аудио'
      })

      el.addEventListener('pause', () => {
        isPlaying.value = false
        // Если пауза от пользователя — оставляем currentTime видимым.
        // forcedpause (другое аудио стартовало) переключит на длительность.
      })

      el.addEventListener('forcedpause', () => {
        // Внешний стоп из-за старта другого аудио в этом чате.
        showDurationMode.value = true
      })

      audioEl.value = el
    } catch (e) {
      hasError.value = e instanceof Error ? e.message : 'Ошибка загрузки аудио'
      isLoadingWave.value = false
    }
  }

  async function togglePlay(): Promise<void> {
    if (!audioEl.value) return

    try {
      if (!isPlaying.value) {
        if (message.chatId) {
          const prev = playingByChat.get(message.chatId)
          if (prev && prev !== audioEl.value) {
            try {
              prev.dispatchEvent(new Event('forcedpause'))
              prev.pause()
            } catch {
              // ignore
            }
          }
        }

        await audioEl.value.play()

        isPlaying.value = true
        showDurationMode.value = false

        if (message.chatId) {
          playingByChat.set(message.chatId, audioEl.value)
        }
      } else {
        audioEl.value.pause()
        isPlaying.value = false

        // Пользователь нажал паузу — оставляем currentTime видимым.
        showDurationMode.value = false

        if (message.chatId) {
          const cur = playingByChat.get(message.chatId)
          if (cur === audioEl.value) {
            playingByChat.delete(message.chatId)
          }
        }
      }
    } catch (e) {
      console.error('[AudioMessage] play/pause failed:', e)
    }
  }

  function seekAt(ratio: number): void {
    if (!audioEl.value || duration.value <= 0) return

    const t = Math.max(0, Math.min(duration.value, ratio * duration.value))

    audioEl.value.currentTime = t
    currentTime.value = t
  }

  onBeforeUnmount(() => {
    try {
      audioEl.value?.pause()
    } catch {
      // ignore
    }
    try {
      if (message.chatId) {
        const cur = playingByChat.get(message.chatId)
        if (cur === audioEl.value) playingByChat.delete(message.chatId)
      }
    } catch {
      // ignore
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
    showDurationMode,
    togglePlay,
    seekAt,
    prepare,
  }
}
