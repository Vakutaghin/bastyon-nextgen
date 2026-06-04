import { ref, computed, watch, type Ref, onBeforeUnmount } from 'vue'
import Hls from 'hls.js'
import { t } from '@/i18n'
import { getVideoSourcesFromUrl, PeerTubeFetchError } from '@/helpers/api/peertube-url'
import { VIDEO_LOAD_WATCHDOG_MS } from '../consts'
import { resolveVideoElement, type ElementRefValue } from './utils'
import { applyNetworkQualityCap } from '../services/network-quality'
import {
  initBlobVideo,
  initHlsJsVideo,
  initNativeHlsVideo,
  initProgressiveVideo,
  type VideoInitContext,
} from '../services/hls-initializer'

/**
 * Сопоставляет ошибку загрузки видео с понятным локализованным сообщением.
 * Главное — отличить «нода не настроена на CORS / недоступна» от обычной сети,
 * иначе пользователь видит загадочное "Failed to fetch".
 */
function resolvePlayerErrorMessage(err: unknown): string {
  if (err instanceof PeerTubeFetchError) {
    switch (err.code) {
      case 'cors-or-network':
        return t('videoMsg.corsOrUnreachable')
      case 'timeout':
        return t('videoMsg.networkError')
      case 'not-found':
        return t('videoMsg.videoNotFound')
      default:
        return err.message
    }
  }
  return err instanceof Error ? err.message : t('videoMsg.videoLoadUnknownError')
}

export function useVideoHls(
  p: { videoUrl: string; autoplay: boolean },
  videoElement: Ref<ElementRefValue>,
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

  // Watchdog начальной загрузки: гасит вечный спиннер, если плеер так и не
  // инициализировался (зависший манифест/сегмент, не отдающий даже ошибку).
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null
  const clearWatchdog = (): void => {
    if (watchdogTimer !== null) {
      clearTimeout(watchdogTimer)
      watchdogTimer = null
    }
  }
  // Успешная инициализация (в т.ч. после mp4-fallback) — снимаем watchdog.
  watch(isInitialized, (initialized) => {
    if (initialized) clearWatchdog()
  })

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
   * Форматирует высоту видео в строку качества (144p, 240p, 360p, 480p, 720p, 1080p)
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
          const getElement = (refValue: ElementRefValue): Element | null => {
            if (!refValue) return null
            if (refValue instanceof Element) return refValue
            return refValue.$el instanceof Element ? refValue.$el : null
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

    // Каждая (пере)инициализация — чистый старт: снимаем прошлый watchdog и
    // разрешаем ровно один mp4-fallback в этой сессии воспроизведения.
    clearWatchdog()
    let hasFallenBack = false

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

      // Watchdog: если за VIDEO_LOAD_WATCHDOG_MS плеер не инициализировался (зависшая
      // загрузка, не отдающая даже ошибку) — показываем ошибку + кнопку «Повторить».
      // Бюджет покрывает весь путь: retry hls.js и последующий mp4-fallback.
      watchdogTimer = setTimeout(() => {
        watchdogTimer = null
        if (isInitialized.value) return
        if (hls.value) {
          hls.value.destroy()
          hls.value = null
        }
        error.value = t('videoMsg.loadTimeout')
        isLoading.value = false
      }, VIDEO_LOAD_WATCHDOG_MS)

      // Проверяем, является ли URL blob URL или обычным URL для локального видео
      const isBlobUrl = p.videoUrl.startsWith('blob:') || p.videoUrl.startsWith('data:')

      if (isBlobUrl) {
        initBlobVideo(video, p.videoUrl, ctx)
        return
      }

      // Для PeerTube URL берём оба источника одним запросом: HLS и прямой mp4 (fallback).
      const { hlsPlaylistUrl, progressiveUrl } = await getVideoSourcesFromUrl(p.videoUrl)

      // Деградация на прямой mp4 на той же ноде, когда HLS фатально не воспроизводится.
      // Срабатывает максимум один раз; если файла нет — показываем ошибку.
      const fallbackToProgressive = (): void => {
        if (hasFallenBack || !progressiveUrl) {
          error.value = t('videoMsg.playbackError')
          isLoading.value = false
          return
        }
        hasFallenBack = true
        if (hls.value) {
          hls.value.destroy()
          hls.value = null
        }
        const v = resolveVideoElement(videoElement)
        if (!v) {
          error.value = t('videoMsg.playbackError')
          isLoading.value = false
          return
        }
        console.warn('HLS unrecoverable — falling back to progressive mp4')
        isLoading.value = true
        error.value = null
        initProgressiveVideo(v, progressiveUrl, ctx)
      }

      // Нет HLS, но есть прямой файл — играем его сразу (старые web-видео / нода без HLS).
      if (!hlsPlaylistUrl) {
        if (progressiveUrl) {
          initProgressiveVideo(video, progressiveUrl, ctx)
          return
        }
        throw new Error(t('videoMsg.hlsPlaylistNotFound'))
      }

      if (Hls.isSupported()) {
        // Используем HLS.js для браузеров без нативной поддержки HLS
        hls.value = initHlsJsVideo(
          video,
          hlsPlaylistUrl,
          ctx,
          (instance) => {
            // MANIFEST_PARSED — обновляем список качества для UI
            updateQualityLevels()
            // На медленной сети ограничиваем ABR сверху (быстрее первый кадр).
            applyNetworkQualityCap(instance)
            // Отслеживаем изменения уровня качества из HLS auto-switch
            instance.on(Hls.Events.LEVEL_SWITCHED, () => {
              currentQualityLevel.value = instance.currentLevel
            })
          },
          fallbackToProgressive
        )
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Нативная поддержка HLS (Safari) — при ошибке тоже деградируем на mp4.
        initNativeHlsVideo(video, hlsPlaylistUrl, ctx, fallbackToProgressive)
      } else if (progressiveUrl) {
        // Ни hls.js, ни нативного HLS — но есть прямой mp4.
        initProgressiveVideo(video, progressiveUrl, ctx)
      } else {
        throw new Error(t('videoMsg.hlsNotSupported'))
      }
    } catch (err) {
      clearWatchdog()
      error.value = resolvePlayerErrorMessage(err)
      isLoading.value = false
      console.error('Video player initialization error:', err)
    }
  }

  /** Повторная попытка после ошибки: чистим инстанс/watchdog и инициализируем заново. */
  const retry = (): void => {
    clearWatchdog()
    if (hls.value) {
      hls.value.destroy()
      hls.value = null
    }
    isInitialized.value = false
    error.value = null
    initPlayer(true)
  }

  onBeforeUnmount(() => {
    clearWatchdog()
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
    retry,
    updateQualityLevels,
    setQualityLevel,
    openQualityMenu,
    openSpeedMenu,
    goBackToMainMenu,
    toggleQualityMenu,
    getCurrentQualityLabel,
  }
}
