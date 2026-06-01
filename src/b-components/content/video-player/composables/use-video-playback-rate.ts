import { ref, type Ref } from 'vue'
import { resolveVideoElement, type ElementRefValue } from './utils'

export function useVideoPlaybackRate(
  videoElement: Ref<ElementRefValue>,
  isPlaying: Ref<boolean>,
  startProgressAnimation: () => void
) {
  // Состояние для управления скоростью воспроизведения
  const playbackRate = ref(1.0) // Скорость воспроизведения (1.0 = нормальная)
  const availablePlaybackRates = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]
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
    const video = resolveVideoElement(videoElement)
    if (!video) return

    playbackRate.value = rate
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
    formatPlaybackRate
  }
}
