import { ref, computed, nextTick, type Ref, onBeforeUnmount } from 'vue'
import Hls from 'hls.js'
import { getHlsPlaylistFromUrl } from '@/helpers/api/peertube-url'
import { videoPlayerManager } from '../video-player-manager'
import { resolveVideoElement } from './utils'

export function useVideoHls(
  p: { videoUrl: string; autoplay: boolean },
  videoElement: Ref<any>,
  volume: Ref<number>,
  playbackRate: Ref<number>,
  playerId: Ref<string>,
  updateBuffered: () => void,
  setupIntersectionObserver: () => void,
  showControlsInitially: Ref<boolean>,
  setupVideoEventListeners: () => void
) {
  const hls = ref<Hls | null>(null)
  const isInitialized = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Состояние для управления качеством видео
  const isQualityMenuOpen = ref(false)
  const availableQualityLevels = ref<Array<{ index: number; height: number; label: string }>>([])
  const currentQualityLevel = ref<number | null>(null)
  const qualityControlRef = ref<HTMLElement | null>(null)
  const qualityDropdownRef = ref<HTMLElement | null>(null)
  let qualityMenuClickOutsideHandler: ((e: MouseEvent) => void) | null = null

  // Состояние для текущего экрана меню (main, quality, speed)
  type MenuScreen = 'main' | 'quality' | 'speed'
  const currentMenuScreen = ref<MenuScreen>('main')

  /**
   * Форматирует высоту видео в строку качества (144p, 240p, 360p, 480p, 720p)
   */
  const formatQualityLabel = (height: number): string => {
    // Округляем до ближайшего стандартного значения
    if (height <= 144) return '144p'
    if (height <= 240) return '240p'
    if (height <= 360) return '360p'
    if (height <= 480) return '480p'
    if (height <= 720) return '720p'
    if (height <= 1080) return '1080p'
    return `${height}p`
  }

  /**
   * Обновляет список доступных уровней качества
   */
  const updateQualityLevels = () => {
    if (!hls.value || !hls.value.levels || hls.value.levels.length === 0) {
      availableQualityLevels.value = []
      return
    }

    const levels = hls.value.levels.map((level, index) => ({
      index,
      height: level.height || 0,
      label: formatQualityLabel(level.height || 0)
    }))

    // Сортируем по высоте (от большего к меньшему)
    levels.sort((a, b) => b.height - a.height)

    availableQualityLevels.value = levels

    // Устанавливаем текущий уровень качества
    if (hls.value.currentLevel !== null && hls.value.currentLevel !== undefined) {
      currentQualityLevel.value = hls.value.currentLevel
    } else {
      currentQualityLevel.value = hls.value.firstLevel
    }
  }

  /**
   * Переключает качество видео
   */
  const setQualityLevel = (levelIndex: number) => {
    if (!hls.value) return

    hls.value.currentLevel = levelIndex
    currentQualityLevel.value = levelIndex
    currentMenuScreen.value = 'main'
    isQualityMenuOpen.value = false
  }

  /**
   * Открывает меню качества
   */
  const openQualityMenu = () => {
    currentMenuScreen.value = 'quality'
  }

  /**
   * Открывает меню скорости
   */
  const openSpeedMenu = () => {
    currentMenuScreen.value = 'speed'
  }

  /**
   * Возвращается в главное меню
   */
  const goBackToMainMenu = () => {
    currentMenuScreen.value = 'main'
  }

  /**
   * Переключает открытие/закрытие меню качества
   */
  const toggleQualityMenu = () => {
    if (isQualityMenuOpen.value) {
      // Если меню открыто - закрываем
      isQualityMenuOpen.value = false
      currentMenuScreen.value = 'main'

      if (qualityMenuClickOutsideHandler) {
        window.removeEventListener('click', qualityMenuClickOutsideHandler, true)
        qualityMenuClickOutsideHandler = null
      }
    } else {
      // Если меню закрыто - открываем
      isQualityMenuOpen.value = true
      currentMenuScreen.value = 'main'

      // Добавляем обработчик клика вне меню для закрытия
      // Используем setTimeout, чтобы текущий клик не закрыл меню сразу
      setTimeout(() => {
        qualityMenuClickOutsideHandler = (e: MouseEvent) => {
          // Если меню уже закрыто, удаляем обработчик и выходим
          if (!isQualityMenuOpen.value) {
             if (qualityMenuClickOutsideHandler) {
                window.removeEventListener('click', qualityMenuClickOutsideHandler, true)
                qualityMenuClickOutsideHandler = null
             }
             return
          }

          const target = e.target as HTMLElement
          if (!target) return

          // Проверяем, кликнули ли мы внутрь дропдауна или кнопки
          const getElement = (ref: any) => {
             if (!ref) return null
             return (ref instanceof HTMLElement) ? ref : (ref.$el || ref)
          }

          const controlEl = getElement(qualityControlRef.value)
          const dropdownEl = getElement(qualityDropdownRef.value)

          // Если клик внутри контрола или дропдауна - ничего не делаем (меню не закрываем)
          // Клик по кнопке "шестеренки" обрабатывается отдельно в toggleQualityMenu
          if ((controlEl && controlEl.contains(target)) || (dropdownEl && dropdownEl.contains(target))) {
             return
          }

          // Иначе закрываем меню
          isQualityMenuOpen.value = false
          currentMenuScreen.value = 'main'

          e.preventDefault()
          e.stopPropagation()

          if (qualityMenuClickOutsideHandler) {
            window.removeEventListener('click', qualityMenuClickOutsideHandler, true)
            qualityMenuClickOutsideHandler = null
          }
        }

        window.addEventListener('click', qualityMenuClickOutsideHandler, true)
      }, 50)
    }
  }

  /**
   * Получает текущую метку качества
   */
  const getCurrentQualityLabel = computed(() => {
    if (currentQualityLevel.value === null || !hls.value || !hls.value.levels) {
      return 'Авто'
    }

    const level = hls.value.levels[currentQualityLevel.value]
    if (!level) return 'Авто'

    return formatQualityLabel(level.height || 0)
  })

  /**
   * Инициализация проигрывателя
   */
  const initPlayer = async (forcePlay = false) => {
    if (!p.videoUrl) {
      error.value = 'URL видео не указан'
      isLoading.value = false
      return
    }

    try {
      isLoading.value = true
      error.value = null

      const video = resolveVideoElement(videoElement)
      if (!video) {
        throw new Error('Video element not found or not an HTMLVideoElement')
      }

      // Проверяем, является ли URL blob URL или обычным URL для локального видео
      const isBlobUrl = p.videoUrl.startsWith('blob:') || p.videoUrl.startsWith('data:')

      if (isBlobUrl) {
        // Для blob URLs используем напрямую без HLS
        video.src = p.videoUrl
        video.load()

        // Настраиваем обработчики событий для blob видео
        setupVideoEventListeners()

        // Устанавливаем громкость и скорость
        video.volume = volume.value
        video.playbackRate = playbackRate.value

        video.addEventListener('loadedmetadata', () => {
          isLoading.value = false
          isInitialized.value = true
          showControlsInitially.value = true
          setTimeout(() => {
            showControlsInitially.value = false
          }, 3000)

          // Начальное обновление буферизации
          setTimeout(updateBuffered, 300)

          // Настраиваем Intersection Observer после инициализации видео
          nextTick(() => {
            setupIntersectionObserver()
          })

          if ((p.autoplay || forcePlay) && video) {
            // Останавливаем все другие видеоплееры перед автозапуском
            videoPlayerManager.pauseAllExcept(playerId.value)
            video.play().catch((err) => {
              console.warn('Autoplay failed:', err)
            })
          }
        }, { once: true })

        video.addEventListener('error', () => {
          isLoading.value = false
          error.value = 'Ошибка загрузки видео'
        }, { once: true })

        return
      }

      // Для PeerTube URLs получаем HLS плейлист
      const playlistUrl = await getHlsPlaylistFromUrl(p.videoUrl)

      if (!playlistUrl) {
        throw new Error('HLS плейлист не найден')
      }

      // Проверяем поддержку HLS
      if (Hls.isSupported()) {
        // Используем HLS.js для браузеров без нативной поддержки HLS
        hls.value = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 60, // Минимум 1 минута
          maxMaxBufferLength: 300, // Максимум 5 минут
          // Ограничиваем размер буфера в байтах (по умолчанию 60MB, можно оставить или увеличить если нужно 2 мин 4k)
          // maxBufferSize: 60 * 1000 * 1000,
        })

        hls.value.loadSource(playlistUrl)
        hls.value.attachMedia(video)

        // Обработка событий HLS
        hls.value.on(Hls.Events.MANIFEST_PARSED, () => {
          isLoading.value = false
          isInitialized.value = true
          // Показываем контролы на 3 секунды после инициализации
          showControlsInitially.value = true
          setTimeout(() => {
            showControlsInitially.value = false
          }, 3000)

          // Получаем доступные уровни качества
          updateQualityLevels()

          // Настраиваем обработчики событий video элемента
          setupVideoEventListeners()

          // Устанавливаем начальную громкость и скорость
          if (video) {
            video.volume = volume.value
            video.playbackRate = playbackRate.value
          }

          // Начальное обновление буферизации после настройки обработчиков
          setTimeout(updateBuffered, 300)

          // Настраиваем Intersection Observer после инициализации видео
          nextTick(() => {
            setupIntersectionObserver()
          })

          if ((p.autoplay || forcePlay) && video) {
            // Останавливаем все другие видеоплееры перед автозапуском
            videoPlayerManager.pauseAllExcept(playerId.value)
            video.play().catch((err) => {
              console.warn('Autoplay failed:', err)
            })
          }
        })

        // Отслеживаем изменения уровня качества
        hls.value.on(Hls.Events.LEVEL_SWITCHED, () => {
          if (hls.value) {
            currentQualityLevel.value = hls.value.currentLevel
          }
        })

        hls.value.on(Hls.Events.ERROR, (event, data) => {
          // Обрабатываем некритичные ошибки отдельно
          if (!data.fatal) {
            // bufferStalledError - не критичная ошибка, возникает при остановке буфера
            if (data.details === 'bufferStalledError') {
              return
            }
            // Другие некритичные ошибки логируем как предупреждения
            console.warn('HLS non-fatal error:', data)
            return
          }

          // Критичные ошибки логируем и обрабатываем
          console.error('HLS fatal error:', data)
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              error.value = 'Ошибка сети при загрузке видео'
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              error.value = 'Ошибка воспроизведения видео'
              // Пытаемся восстановиться
              if (hls.value) {
                hls.value.recoverMediaError()
              }
              break
            default:
              error.value = 'Ошибка загрузки видео'
              if (hls.value) {
                hls.value.destroy()
              }
              break
          }
          isLoading.value = false
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Нативная поддержка HLS (Safari)
        video.src = playlistUrl

        // Настраиваем обработчики событий video элемента
        setupVideoEventListeners()

        // Устанавливаем громкость и скорость
        video.volume = volume.value
        video.playbackRate = playbackRate.value
        isLoading.value = false
        isInitialized.value = true
        // Показываем контролы на 3 секунды после инициализации
        showControlsInitially.value = true
        setTimeout(() => {
          showControlsInitially.value = false
        }, 3000)

        // Начальное обновление буферизации после настройки обработчиков
        setTimeout(updateBuffered, 300)

        // Настраиваем Intersection Observer после инициализации видео
        nextTick(() => {
          setupIntersectionObserver()
        })

        if (p.autoplay || forcePlay) {
          // Останавливаем все другие видеоплееры перед автозапуском
          videoPlayerManager.pauseAllExcept(playerId.value)
          video.play().catch((err) => {
            console.warn('Autoplay failed:', err)
          })
        }
      } else {
        throw new Error('HLS не поддерживается в этом браузере')
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Неизвестная ошибка при загрузке видео'
      isLoading.value = false
      console.error('Video player initialization error:', err)
    }
  }

  onBeforeUnmount(() => {
    if (hls.value) {
      hls.value.destroy()
      hls.value = null
    }
    // Удаляем обработчик меню качества
    if (qualityMenuClickOutsideHandler) {
      window.removeEventListener('click', qualityMenuClickOutsideHandler, true)
      qualityMenuClickOutsideHandler = null
    }
  })

  return {
    hls,
    isInitialized,
    isLoading,
    error,
    isQualityMenuOpen,
    availableQualityLevels,
    currentQualityLevel,
    qualityControlRef,
    qualityDropdownRef,
    currentMenuScreen,
    initPlayer,
    updateQualityLevels,
    setQualityLevel,
    openQualityMenu,
    openSpeedMenu,
    goBackToMainMenu,
    toggleQualityMenu,
    getCurrentQualityLabel
  }
}
