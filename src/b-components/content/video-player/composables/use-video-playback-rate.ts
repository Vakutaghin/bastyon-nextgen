import { ref, watch, type Ref } from 'vue'
import {
  PLAYBACK_RATES,
  playbackRate,
  setPlaybackRate as saveRate,
} from '@/services/media/playback-rate'
import { resolveVideoElement, type ElementRefValue } from './utils'

/**
 * Скорость плеера — общая на всё приложение (services/media/playback-rate):
 * новый плеер начинает с выбранной, смена в одном плеере доходит до всех.
 */
export function useVideoPlaybackRate(
  videoElement: Ref<ElementRefValue>,
  isPlaying: Ref<boolean>,
  startProgressAnimation: () => void
) {
  const availablePlaybackRates = [...PLAYBACK_RATES]
  const showPlaybackRateNotification = ref(false) // Показывать уведомление о скорости
  let playbackRateNotificationTimeout: ReturnType<typeof setTimeout> | null = null

  /**
   * Показывает уведомление о скорости воспроизведения на 1 секунду
   */
  const displayPlaybackRateNotification = () => {
    // Очищаем предыдущий таймер, если есть
    if (playbackRateNotificationTimeout) {
      clearTimeout(playbackRateNotificationTimeout)
    }

    // Показываем уведомление
    showPlaybackRateNotification.value = true

    // Скрываем через 1 секунду
    playbackRateNotificationTimeout = setTimeout(() => {
      showPlaybackRateNotification.value = false
      playbackRateNotificationTimeout = null
    }, 1000)
  }

  /**
   * Устанавливает скорость воспроизведения
   */
  const setPlaybackRate = (rate: number, showNotification = false) => {
    saveRate(rate)
    const video = resolveVideoElement(videoElement)
    if (!video) return
    video.playbackRate = rate

    // Анимация автоматически подхватит новую скорость через video.playbackRate
    // Перезапуск не требуется, но можно для надежности
    if (isPlaying.value) {
      startProgressAnimation()
    }

    // Показываем уведомление, если запрошено
    if (showNotification) {
      displayPlaybackRateNotification()
    }
  }

  // Скорость сменили в другом плеере — этот играет так же.
  watch(playbackRate, (rate) => {
    const video = resolveVideoElement(videoElement)
    if (video && video.playbackRate !== rate) video.playbackRate = rate
  })

  /**
   * Увеличивает скорость воспроизведения на один шаг
   */
  const increasePlaybackRate = () => {
    const currentIndex = availablePlaybackRates.indexOf(playbackRate.value)
    if (currentIndex < availablePlaybackRates.length - 1) {
      setPlaybackRate(availablePlaybackRates[currentIndex + 1] ?? 1.0, true)
    }
  }

  /**
   * Уменьшает скорость воспроизведения на один шаг
   */
  const decreasePlaybackRate = () => {
    const currentIndex = availablePlaybackRates.indexOf(playbackRate.value)
    if (currentIndex > 0) {
      setPlaybackRate(availablePlaybackRates[currentIndex - 1] ?? 1.0, true)
    }
  }

  /**
   * Сбрасывает скорость воспроизведения до стандартной (1.0x)
   */
  const resetPlaybackRate = () => {
    setPlaybackRate(1.0, true)
  }

  /**
   * Форматирует скорость воспроизведения для отображения
   */
  const formatPlaybackRate = (rate: number): string => {
    if (rate === 1.0) return '1x'
    return `${rate}x`
  }

  return {
    playbackRate,
    availablePlaybackRates,
    showPlaybackRateNotification,
    setPlaybackRate,
    increasePlaybackRate,
    decreasePlaybackRate,
    resetPlaybackRate,
    formatPlaybackRate,
  }
}
