import { ref, computed, type Ref, onBeforeUnmount } from 'vue'
import Hls from 'hls.js'
import { t } from '@/i18n'
import { getHlsPlaylistFromUrl } from '@/helpers/api/peertube-url'
import { resolveVideoElement } from './utils'
import {
  initBlobVideo,
  initHlsJsVideo,
  initNativeHlsVideo,
  type VideoInitContext,
} from '../services/hls-initializer'

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
      label: formatQualityLabel(level.height || 0),
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
            return ref instanceof HTMLElement ? ref : ref.$el || ref
          }

          const controlEl = getElement(qualityControlRef.value)
          const dropdownEl = getElement(qualityDropdownRef.value)

          // Если клик внутри контрола или дропдауна - ничего не делаем (меню не закрываем)
          // Клик по кнопке "шестеренки" обрабатывается отдельно в toggleQualityMenu
          if (
            (controlEl && controlEl.contains(target)) ||
            (dropdownEl && dropdownEl.contains(target))
          ) {
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
      return t('videoMsg.qualityAuto')
    }

    const level = hls.value.levels[currentQualityLevel.value]
    if (!level) return t('videoMsg.qualityAuto')

    return formatQualityLabel(level.height || 0)
  })

  /**
   * Инициализация проигрывателя
   */
  const initPlayer = async (forcePlay = false) => {
    if (!p.videoUrl) {
      error.value = t('videoMsg.videoUrlMissing')
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

      const ctx: VideoInitContext = {
        volume,
        playbackRate,
        showControlsInitially,
        isLoading,
        isInitialized,
        error,
        playerId,
        autoplay: p.autoplay,
        forcePlay,
        setupVideoEventListeners,
        updateBuffered,
        setupIntersectionObserver,
      }

      // Проверяем, является ли URL blob URL или обычным URL для локального видео
      const isBlobUrl = p.videoUrl.startsWith('blob:') || p.videoUrl.startsWith('data:')

      if (isBlobUrl) {
        initBlobVideo(video, p.videoUrl, ctx)
        return
      }

      // Для PeerTube URLs получаем HLS плейлист
      const playlistUrl = await getHlsPlaylistFromUrl(p.videoUrl)

      if (!playlistUrl) {
        throw new Error(t('videoMsg.hlsPlaylistNotFound'))
      }

      if (Hls.isSupported()) {
        // Используем HLS.js для браузеров без нативной поддержки HLS
        hls.value = initHlsJsVideo(video, playlistUrl, ctx, (instance) => {
          // MANIFEST_PARSED — обновляем список качества для UI
          updateQualityLevels()
          // Отслеживаем изменения уровня качества из HLS auto-switch
          instance.on(Hls.Events.LEVEL_SWITCHED, () => {
            currentQualityLevel.value = instance.currentLevel
          })
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Нативная поддержка HLS (Safari)
        initNativeHlsVideo(video, playlistUrl, ctx)
      } else {
        throw new Error(t('videoMsg.hlsNotSupported'))
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : t('videoMsg.videoLoadUnknownError')
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
    getCurrentQualityLabel,
  }
}
