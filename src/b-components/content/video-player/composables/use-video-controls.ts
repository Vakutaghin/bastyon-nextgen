import { ref, computed, onBeforeUnmount } from 'vue'

export function useVideoControls() {
  const showControls = ref(false)
  const isHovering = ref(false)
  // Показываем контролы на несколько секунд после инициализации
  const showControlsInitially = ref(true)
  
  let controlsTimeout: ReturnType<typeof setTimeout> | null = null
  let lastMouseMoveTime = 0 // Время последнего движения мыши
  let mouseMoveDebounceTimeout: ReturnType<typeof setTimeout> | null = null

  /**
   * Планирует скрытие контролов через 4 секунды
   */
  const scheduleControlsHide = () => {
    // Отменяем только таймер скрытия, но не debounce
    if (controlsTimeout) {
      clearTimeout(controlsTimeout)
      controlsTimeout = null
    }

    // Планируем скрытие через 4 секунды, даже если мышь внутри контейнера
    controlsTimeout = setTimeout(() => {
      // Проверяем, прошло ли 4 секунды с последнего движения мыши
      const timeSinceLastMove = Date.now() - lastMouseMoveTime
      // Скрываем тулбар только если мышь все еще внутри и прошло достаточно времени
      if (isHovering.value && timeSinceLastMove >= 3000) {
        showControls.value = false
      }
    }, 3000) // 4 секунды без движения мыши
  }

  /**
   * Отменяет запланированное скрытие контролов
   */
  const cancelControlsHide = () => {
    if (controlsTimeout) {
      clearTimeout(controlsTimeout)
      controlsTimeout = null
    }
    if (mouseMoveDebounceTimeout) {
      clearTimeout(mouseMoveDebounceTimeout)
      mouseMoveDebounceTimeout = null
    }
  }

  // Обработка наведения на контейнер
  const handleMouseEnter = () => {
    isHovering.value = true
    showControls.value = true
    lastMouseMoveTime = Date.now() // Обновляем время при входе мыши
    cancelControlsHide()
    // Планируем скрытие через 4 секунды, если мышь не будет двигаться
    scheduleControlsHide()
  }

  // Обработка движения мыши внутри контейнера
  const handleMouseMove = () => {
    if (!isHovering.value) return

    // Обновляем время последнего движения мыши
    lastMouseMoveTime = Date.now()
    // Показываем тулбар при движении мыши
    showControls.value = true

    // Отменяем предыдущий debounce
    if (mouseMoveDebounceTimeout) {
      clearTimeout(mouseMoveDebounceTimeout)
    }

    // Используем debounce, чтобы не сбрасывать таймер слишком часто
    mouseMoveDebounceTimeout = setTimeout(() => {
      // Сбрасываем таймер и планируем новое скрытие через 4 секунды
      scheduleControlsHide()
      mouseMoveDebounceTimeout = null
    }, 100) // Небольшая задержка для debounce
  }

  const handleMouseLeave = () => {
    isHovering.value = false
    showControls.value = false
    cancelControlsHide()
  }

  // Очистка при размонтировании
  onBeforeUnmount(() => {
    cancelControlsHide()
    if (mouseMoveDebounceTimeout) {
      clearTimeout(mouseMoveDebounceTimeout)
      mouseMoveDebounceTimeout = null
    }
  })

  return {
    showControls,
    isHovering,
    showControlsInitially,
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
    scheduleControlsHide,
    cancelControlsHide
  }
}
