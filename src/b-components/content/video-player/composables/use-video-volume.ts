import { ref, computed, onBeforeUnmount, type Ref } from 'vue'
import { resolveVideoElement, type ElementRefValue } from './utils'
import { VIDEO_PLAYER_VOLUME_KEY } from '@/blockchain/constants/storage'

export function useVideoVolume(videoElement: Ref<ElementRefValue>) {
  // Ключ для сохранения громкости в localStorage
  const VOLUME_STORAGE_KEY = VIDEO_PLAYER_VOLUME_KEY

  /**
   * Загружает сохраненную громкость из localStorage
   */
  const loadSavedVolume = (): number => {
    try {
      const saved = localStorage.getItem(VOLUME_STORAGE_KEY)
      if (saved !== null) {
        const volume = parseFloat(saved)
        // Проверяем, что значение валидное (от 0 до 1)
        if (!isNaN(volume) && volume >= 0 && volume <= 1) {
          return volume
        }
      }
    } catch (err) {
      console.warn('Failed to load saved volume:', err)
    }
    return 1 // Значение по умолчанию
  }

  /**
   * Сохраняет громкость в localStorage
   */
  const saveVolume = (vol: number) => {
    try {
      localStorage.setItem(VOLUME_STORAGE_KEY, vol.toString())
    } catch (err) {
      console.warn('Failed to save volume:', err)
    }
  }

  const volume = ref(loadSavedVolume()) // Громкость от 0 до 1
  const previousVolume = ref(volume.value) // Сохраняем предыдущую громкость для mute/unmute
  const isDraggingVolume = ref(false) // Флаг перетаскивания слайдера громкости
  const showVolumeNotification = ref(false) // Показывать уведомление о громкости
  let volumeNotificationTimeout: ReturnType<typeof setTimeout> | null = null
  const volumeSliderRef = ref<HTMLElement | null>(null) // Ref для слайдера громкости
  let volumeMouseMoveHandler: ((e: MouseEvent) => void) | null = null
  let volumeMouseUpHandler: (() => void) | null = null

  /**
   * Показывает уведомление о громкости на 1 секунду
   */
  const displayVolumeNotification = () => {
    // Очищаем предыдущий таймер, если есть
    if (volumeNotificationTimeout) {
      clearTimeout(volumeNotificationTimeout)
    }

    // Показываем уведомление
    showVolumeNotification.value = true

    // Скрываем через 1 секунду
    volumeNotificationTimeout = setTimeout(() => {
      showVolumeNotification.value = false
      volumeNotificationTimeout = null
    }, 1000)
  }

  /**
   * Устанавливает громкость и сохраняет её
   */
  const setVolume = (value: number) => {
    const video = resolveVideoElement(videoElement)
    const normalizedValue = Math.max(0, Math.min(1, value))

    volume.value = normalizedValue

    if (video) {
      video.volume = normalizedValue
    }

    // Если громкость больше 0, сохраняем её как предыдущую (для восстановления после mute)
    if (normalizedValue > 0) {
      previousVolume.value = normalizedValue
    }

    saveVolume(normalizedValue)
  }

  /**
   * Обновление громкости на основе позиции мыши
   */
  const updateVolumeFromMouse = (event: MouseEvent, sliderElement: HTMLElement) => {
    const video = resolveVideoElement(videoElement)
    if (!video) return

    const rect = sliderElement.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const percentage = Math.max(0, Math.min(1, clickX / rect.width))

    volume.value = percentage
    video.volume = percentage

    // Если громкость больше 0, сохраняем её
    if (percentage > 0) {
      previousVolume.value = percentage
    }

    // Сохраняем громкость в localStorage
    saveVolume(percentage)
  }

  /**
   * Обработка начала перетаскивания слайдера громкости
   */
  const handleVolumeMouseDown = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const volumeSlider = event.currentTarget as HTMLElement
    if (!volumeSlider) return

    isDraggingVolume.value = true

    // Обновляем громкость при клике
    updateVolumeFromMouse(event, volumeSlider)

    // Обработчик движения мыши
    volumeMouseMoveHandler = (moveEvent: MouseEvent) => {
      if (!isDraggingVolume.value) return
      updateVolumeFromMouse(moveEvent, volumeSlider)
    }

    // Обработчик отпускания мыши
    volumeMouseUpHandler = () => {
      isDraggingVolume.value = false
      if (volumeMouseMoveHandler) {
        document.removeEventListener('mousemove', volumeMouseMoveHandler)
        volumeMouseMoveHandler = null
      }
      if (volumeMouseUpHandler) {
        document.removeEventListener('mouseup', volumeMouseUpHandler)
        volumeMouseUpHandler = null
      }
    }

    document.addEventListener('mousemove', volumeMouseMoveHandler)
    document.addEventListener('mouseup', volumeMouseUpHandler)
  }

  /**
   * Обработка клика по слайдеру громкости
   */
  const handleVolumeClick = (event: MouseEvent) => {
    // Если уже обрабатывается drag, не обрабатываем клик
    if (isDraggingVolume.value) {
      event.stopPropagation()
      return
    }

    const volumeSlider = event.currentTarget as HTMLElement
    updateVolumeFromMouse(event, volumeSlider)
    event.stopPropagation()
  }

  /**
   * Форматирует громкость для отображения (0 или процент)
   */
  const formatVolumeDisplay = (): string => {
    if (volume.value === 0) {
      return '0'
    }
    return `${Math.round(volume.value * 100)}%`
  }

  /**
   * Переключение mute/unmute
   */
  const toggleMute = () => {
    const video = resolveVideoElement(videoElement)
    if (!video) return

    if (volume.value > 0) {
      // Если есть громкость - запоминаем её и выключаем звук
      previousVolume.value = volume.value
      volume.value = 0
      video.volume = 0
      // При mute сохраняем нулевой уровень звука в localStorage
      saveVolume(0)
    } else if (previousVolume.value > 0) {
      // Если звук выключен и есть запомненная громкость - возвращаем её
      volume.value = previousVolume.value
      video.volume = previousVolume.value
      // При unmute сохраняем восстановленную громкость в localStorage
      saveVolume(previousVolume.value)
    } else {
      // Если нет запомненной громкости, устанавливаем по умолчанию
      volume.value = 0.5
      previousVolume.value = 0.5
      video.volume = 0.5
      // Сохраняем громкость по умолчанию
      saveVolume(0.5)
    }

    // Показываем уведомление о громкости
    displayVolumeNotification()
  }

  const volumeWidth = computed(() => {
    const val = volume.value * 100
    if (!isFinite(val) || val < 0 || val > 100) return '0%'
    return `${val}%`
  })

  // Очистка при размонтировании
  onBeforeUnmount(() => {
    // Сбрасываем флаг перетаскивания и очищаем обработчики
    if (isDraggingVolume.value) {
      isDraggingVolume.value = false
    }
    // Удаляем обработчики drag, если они еще активны
    if (volumeMouseMoveHandler) {
      document.removeEventListener('mousemove', volumeMouseMoveHandler)
      volumeMouseMoveHandler = null
    }
    if (volumeMouseUpHandler) {
      document.removeEventListener('mouseup', volumeMouseUpHandler)
      volumeMouseUpHandler = null
    }
    // Очищаем таймер уведомления о громкости
    if (volumeNotificationTimeout) {
      clearTimeout(volumeNotificationTimeout)
      volumeNotificationTimeout = null
    }
  })

  return {
    volume,
    previousVolume,
    isDraggingVolume,
    showVolumeNotification,
    volumeSliderRef,
    volumeWidth,
    loadSavedVolume,
    setVolume,
    saveVolume,
    handleVolumeMouseDown,
    handleVolumeClick,
    formatVolumeDisplay,
    toggleMute
  }
}
