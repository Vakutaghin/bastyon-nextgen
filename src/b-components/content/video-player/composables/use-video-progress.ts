import { ref, computed, type Ref, onBeforeUnmount, watch } from 'vue'
import { resolveVideoElement } from './utils'

export function useVideoProgress(videoElement: Ref<any>, isPlaying: Ref<boolean>) {
  const currentTime = ref(0)
  const duration = ref(0)
  const progress = ref(0)
  const buffered = ref(0) // Процент загруженного (забуферизованного) видео
  const isBuffering = ref(false) // Загрузка чанков во время воспроизведения

  // Переменные для плавной анимации прогресса
  let animationFrameId: number | null = null // ID кадра анимации

  /**
   * Обновление буферизации
   */
  const updateBuffered = () => {
    const video = resolveVideoElement(videoElement)
    if (!video) return

    if (!video.duration || !isFinite(video.duration) || video.duration <= 0) {
      buffered.value = 0
      return
    }

    if (video.buffered.length === 0) {
      buffered.value = 0
      return
    }

    // Находим самый дальний загруженный сегмент
    let maxBufferedEnd = 0
    for (let i = 0; i < video.buffered.length; i++) {
      const bufferedEnd = video.buffered.end(i)
      if (bufferedEnd > maxBufferedEnd) {
        maxBufferedEnd = bufferedEnd
      }
    }

    const bufferedPercent = (maxBufferedEnd / video.duration) * 100
    buffered.value = Math.min(100, Math.max(0, bufferedPercent))
  }

  /**
   * Останавливает анимацию прогресса
   */
  const stopProgressAnimation = () => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  /**
   * Плавная интерполяция прогресса между обновлениями timeupdate
   * Использует video.currentTime напрямую для максимальной плавности и синхронизации
   */
  const animateProgress = () => {
    const video = resolveVideoElement(videoElement)
    if (!video || !isPlaying.value) {
      stopProgressAnimation()
      return
    }

    const actualDuration = video.duration

    if (actualDuration && isFinite(actualDuration) && actualDuration > 0) {
      // Обновляем длительность если она изменилась
      if (duration.value !== actualDuration) {
        duration.value = actualDuration
      }

      // Используем реальное время видео напрямую - это свойство обновляется браузером плавно
      const actualVideoTime = video.currentTime

      // Вычисляем прогресс напрямую из реального времени видео
      const calculatedProgress = (actualVideoTime / actualDuration) * 100

      // Обновляем прогресс - это будет плавно, так как video.currentTime обновляется браузером
      progress.value = Math.min(100, Math.max(0, calculatedProgress))

      // Обновляем currentTime для отображения
      currentTime.value = actualVideoTime
    }

    // Продолжаем анимацию
    animationFrameId = requestAnimationFrame(animateProgress)
  }

  /**
   * Запускает анимацию прогресса
   */
  const startProgressAnimation = () => {
    stopProgressAnimation()
    // Анимация будет читать video.currentTime напрямую, инициализация не требуется
    animationFrameId = requestAnimationFrame(animateProgress)
  }

  /**
   * Обновляет длительность видео
   */
  const updateDuration = () => {
    const video = resolveVideoElement(videoElement)
    if (!video) return

    if (video.duration && isFinite(video.duration) && video.duration > 0) {
      duration.value = video.duration
    }
  }

  /**
   * Обработка клика по прогресс-бару
   */
  const handleProgressClick = (event: MouseEvent) => {
    const video = resolveVideoElement(videoElement)
    if (!video || !duration.value) return

    const progressBar = event.currentTarget as HTMLElement
    const rect = progressBar.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * duration.value

    video.currentTime = newTime
    const newProgress = percentage * 100
    progress.value = newProgress

    // Перезапускаем анимацию для синхронизации
    if (isPlaying.value) {
      startProgressAnimation()
    }

    // Останавливаем всплытие события, чтобы не сработал клик на видео
    event.stopPropagation()
  }

  // ── Drag-to-seek (mouse + touch) ────────────────────────────────────────
  // Поддержка как мыши на десктопе, так и пальца на мобильных устройствах.
  // touchstart на progress bar → запоминаем bar rect, на touchmove
  // обновляем seek, на touchend отвязываем listener.
  let dragBar: HTMLElement | null = null
  let dragBarRect: DOMRect | null = null
  let wasPlayingBeforeDrag = false

  const seekToClientX = (clientX: number) => {
    const video = resolveVideoElement(videoElement)
    if (!video || !duration.value || !dragBarRect) return

    const x = Math.max(0, Math.min(clientX - dragBarRect.left, dragBarRect.width))
    const percentage = x / dragBarRect.width
    video.currentTime = percentage * duration.value
    progress.value = percentage * 100
    currentTime.value = video.currentTime
  }

  const onPointerMove = (e: PointerEvent) => {
    e.preventDefault()
    seekToClientX(e.clientX)
  }

  const onPointerUp = (e: PointerEvent) => {
    e.preventDefault()
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    dragBar = null
    dragBarRect = null

    const video = resolveVideoElement(videoElement)
    if (video && wasPlayingBeforeDrag) {
      void video.play()
    }
    if (isPlaying.value) {
      startProgressAnimation()
    }
  }

  /**
   * Pointer-down на progress bar: запускает drag-to-seek.
   * Универсальный обработчик для mouse + touch + pen через Pointer Events API.
   * Это полностью заменяет handleProgressClick на мобилке (а на десктопе
   * сохраняет тот же UX — клик = моментальный seek без перетаскивания).
   */
  const handleProgressPointerDown = (event: PointerEvent) => {
    const video = resolveVideoElement(videoElement)
    if (!video || !duration.value) return

    event.stopPropagation()
    event.preventDefault()

    dragBar = event.currentTarget as HTMLElement
    dragBarRect = dragBar.getBoundingClientRect()
    wasPlayingBeforeDrag = isPlaying.value

    // Сразу делаем seek по точке нажатия — если пользователь просто
    // тапнул без перетаскивания, мы уже отработали как клик.
    seekToClientX(event.clientX)

    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp, { passive: false })
    window.addEventListener('pointercancel', onPointerUp, { passive: false })
  }

  /**
   * Форматирование времени в формат MM:SS или HH:MM:SS
   */
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) {
      return '0:00'
    }

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`
  }

  // Computed свойства для безопасного форматирования ширины
  const progressWidth = computed(() => {
    const val = progress.value
    if (!isFinite(val) || val < 0 || val > 100) return '0%'
    return `${val}%`
  })

  const bufferedWidth = computed(() => {
    const val = buffered.value
    if (!isFinite(val) || val < 0 || val > 100) return '0%'
    return `${val}%`
  })

  onBeforeUnmount(() => {
    stopProgressAnimation()
  })

  // Следим за состоянием воспроизведения для запуска/остановки анимации
  watch(isPlaying, (newValue) => {
    if (newValue) {
      startProgressAnimation()
    } else {
      stopProgressAnimation()
    }
  })

  return {
    currentTime,
    duration,
    progress,
    buffered,
    isBuffering,
    progressWidth,
    bufferedWidth,
    updateBuffered,
    updateDuration,
    stopProgressAnimation,
    startProgressAnimation,
    handleProgressClick,
    handleProgressPointerDown,
    formatTime,
  }
}
