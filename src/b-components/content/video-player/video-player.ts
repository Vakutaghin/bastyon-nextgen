import {
  defineComponent,
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
  toRef,
  type PropType,
} from 'vue'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  LoadingOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  ReloadOutlined,
  SoundOutlined,
  CloseOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue'

import { getVideoThumbnailFromUrl } from '@/helpers/api/peertube-url'
import { videoPlayerManager } from './video-player-manager'
import type { Chapter } from '@/helpers/content/timecode-parser'
import { findActiveChapterIndex } from '@/helpers/content/timecode-parser'

// Composables
import { useVideoHotkeys } from './composables/use-video-hotkeys'
import { useVideoControls } from './composables/use-video-controls'
import { HOTKEYS_LIST, DOUBLE_CLICK_DELAY } from './consts'
import { createClickHandler } from './helpers'
import { useVideoProgress } from './composables/use-video-progress'
import { useVideoVolume } from './composables/use-video-volume'
import { useVideoPlaybackRate } from './composables/use-video-playback-rate'
import { useVideoFullscreen } from './composables/use-video-fullscreen'
import { useVideoHls } from './composables/use-video-hls'
import { useBackgroundPlayback } from './composables/use-background-playback'
import { resolveVideoElement, resolveDomElement } from './composables/utils'
import AudioVisualizer from '@/b-components/content/video-player/components/audio-visualizer/audio-visualizer.vue'

import {
  SC_VideoContainer,
  SC_VideoWrapper,
  SC_VideoElement,
  SC_VideoThumbnailBackdrop,
  SC_VideoThumbnail,
  SC_VideoSkeleton,
  SC_VideoControls,
  SC_VideoControlsBar,
  SC_VideoPlayPauseButton,
  SC_VideoPlayButton,
  SC_VideoTimeDisplay,
  SC_VideoProgressBar,
  SC_VideoProgressFill,
  SC_VideoBufferFill,
  SC_VideoChapterMarker,
  SC_VideoChapterTitle,
  SC_VideoLoading,
  SC_VideoError,
  SC_VideoVolumeControl,
  SC_VideoVolumeButton,
  SC_VideoVolumeSlider,
  SC_VideoVolumeFill,
  SC_VideoVolumeMutedIcon,
  SC_VideoVolumeMutedCross,
  SC_VideoQualityControl,
  SC_VideoQualityButton,
  SC_VideoQualityDropdown,
  SC_VideoQualityMenuItem,
  SC_VideoQualityMenuSection,
  SC_VideoQualityMenuSectionTitle,
  SC_VideoQualitySubmenuItem,
  SC_VideoQualitySubmenu,
  SC_VideoQualitySubmenuItemInner,
  SC_VideoFullscreenButton,
  SC_PlaybackRateNotification,
  SC_VolumeNotification,
  SC_HotkeysHelpOverlay,
  SC_HotkeysHelpContent,
  SC_HotkeysHelpTitle,
  SC_HotkeysHelpList,
  SC_HotkeysHelpItem,
  SC_HotkeysKey,
  SC_HotkeysDescription,
  SC_HotkeysCloseButton,
  SC_IconNotification,
  SC_SeekNotification,
} from './styled'

export const videoPlayer = defineComponent({
  name: 'VideoPlayer',
  components: {
    SC_VideoContainer,
    AudioVisualizer,
    SC_VideoWrapper,
    SC_VideoElement,
    SC_VideoThumbnailBackdrop,
    SC_VideoThumbnail,
    SC_VideoSkeleton,
    SC_VideoControls,
    SC_VideoControlsBar,
    SC_VideoPlayPauseButton,
    SC_VideoPlayButton,
    SC_VideoTimeDisplay,
    SC_VideoProgressBar,
    SC_VideoProgressFill,
    SC_VideoBufferFill,
    SC_VideoChapterMarker,
    SC_VideoChapterTitle,
    SC_VideoLoading,
    SC_VideoError,
    SC_VideoVolumeControl,
    SC_VideoVolumeButton,
    SC_VideoVolumeSlider,
    SC_VideoVolumeFill,
    SC_VideoVolumeMutedIcon,
    SC_VideoVolumeMutedCross,
    SC_VideoQualityControl,
    SC_VideoQualityButton,
    SC_VideoQualityDropdown,
    SC_VideoQualityMenuItem,
    SC_VideoQualityMenuSection,
    SC_VideoQualityMenuSectionTitle,
    SC_VideoQualitySubmenuItem,
    SC_VideoQualitySubmenu,
    SC_VideoQualitySubmenuItemInner,
    SC_VideoFullscreenButton,
    SC_PlaybackRateNotification,
    SC_VolumeNotification,
    SC_HotkeysHelpOverlay,
    SC_HotkeysHelpContent,
    SC_HotkeysHelpTitle,
    SC_HotkeysHelpList,
    SC_HotkeysHelpItem,
    SC_HotkeysKey,
    SC_HotkeysDescription,
    SC_HotkeysCloseButton,
    SC_IconNotification,
    SC_SeekNotification,
    PlayCircleOutlined,
    PauseCircleOutlined,
    LoadingOutlined,
    FullscreenOutlined,
    FullscreenExitOutlined,
    ReloadOutlined,
    SoundOutlined,
    CloseOutlined,
    SettingOutlined,
  },
  props: {
    videoUrl: {
      type: String as PropType<string>,
      required: true,
    },
    autoplay: {
      type: Boolean as PropType<boolean>,
      default: false,
    },
    isAudio: {
      type: Boolean as PropType<boolean>,
      default: false,
    },
    chapters: {
      type: Array as PropType<Chapter[]>,
      default: () => [],
    },
    title: {
      type: String as PropType<string>,
      default: '',
    },
    artist: {
      type: String as PropType<string>,
      default: '',
    },
  },
  setup(p) {
    const videoElement = ref<HTMLVideoElement | null>(null)
    const videoContainer = ref<HTMLElement | null>(null)
    const isPlaying = ref(false)
    const isEnded = ref(false)
    const thumbnailUrl = ref<string | null>(null)
    const isThumbnailLoaded = ref(false)
    const thumbnailAspectRatio = ref<{ width: number; height: number; useContain: boolean } | null>(
      null
    )
    const videoAspectRatio = ref<{ width: number; height: number; useContain: boolean } | null>(
      null
    )
    const playerId = ref(
      `video-player-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    )
    let intersectionObserver: IntersectionObserver | null = null

    // Notifications
    const showPlayNotification = ref(false)
    const showPauseNotification = ref(false)
    const showSeekNotification = ref(false)
    const seekValue = ref('')
    let seekNotificationTimer: any = null
    let playPauseNotificationTimer: any = null

    const triggerSeekNotification = (value: string) => {
      // Clear existing timer and hide immediately to reset animation
      if (seekNotificationTimer) {
        clearTimeout(seekNotificationTimer)
        seekNotificationTimer = null
      }

      showSeekNotification.value = false

      // Force a reflow/next tick to ensure the transition restarts
      setTimeout(() => {
        seekValue.value = value
        showSeekNotification.value = true

        seekNotificationTimer = setTimeout(() => {
          showSeekNotification.value = false
          seekNotificationTimer = null
        }, 500)
      }, 0)
    }

    const triggerPlayPauseNotification = (isPlay: boolean) => {
      if (playPauseNotificationTimer) {
        clearTimeout(playPauseNotificationTimer)
        playPauseNotificationTimer = null
      }

      showPlayNotification.value = false
      showPauseNotification.value = false

      setTimeout(() => {
        if (isPlay) {
          showPlayNotification.value = true
        } else {
          showPauseNotification.value = true
        }

        playPauseNotificationTimer = setTimeout(() => {
          showPlayNotification.value = false
          showPauseNotification.value = false
          playPauseNotificationTimer = null
        }, 500)
      }, 0)
    }

    // Composables
    const {
      showControls,
      isHovering,
      showControlsInitially,
      handleMouseEnter,
      handleMouseMove,
      handleMouseLeave,
    } = useVideoControls()

    const {
      currentTime,
      duration,
      progress,
      isBuffering,
      bufferedWidth,
      updateBuffered,
      updateDuration,
      stopProgressAnimation,
      startProgressAnimation,
      handleProgressClick,
      handleProgressPointerDown,
      formatTime,
    } = useVideoProgress(videoElement, isPlaying)

    const progressWidth = computed(() => `${progress.value}%`)

    const {
      volume,
      previousVolume,
      isDraggingVolume,
      showVolumeNotification,
      volumeSliderRef,
      volumeWidth,
      setVolume,
      handleVolumeMouseDown,
      handleVolumeClick,
      formatVolumeDisplay,
      toggleMute,
    } = useVideoVolume(videoElement)

    const { isFullscreen, toggleFullscreen } = useVideoFullscreen(videoElement, videoContainer)

    const {
      playbackRate,
      availablePlaybackRates,
      showPlaybackRateNotification,
      setPlaybackRate: internalSetPlaybackRate,
      increasePlaybackRate,
      decreasePlaybackRate,
      resetPlaybackRate,
      formatPlaybackRate,
    } = useVideoPlaybackRate(videoElement, isPlaying, startProgressAnimation)

    // Определения функций для позднего связывания
    let setupVideoEventListeners: () => void = () => {}
    let setupIntersectionObserver: () => void = () => {}

    const {
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
      setQualityLevel,
      openQualityMenu,
      openSpeedMenu,
      goBackToMainMenu,
      toggleQualityMenu,
      getCurrentQualityLabel,
    } = useVideoHls(
      p,
      videoElement,
      volume,
      playbackRate,
      playerId,
      updateBuffered,
      () => setupIntersectionObserver(),
      showControlsInitially,
      () => setupVideoEventListeners()
    )

    const getVideoElement = () => resolveVideoElement(videoElement)
    const domVideoElement = computed(() => resolveVideoElement(videoElement))

    // Фоновое воспроизведение: native media session (Android) + MediaSession API (iOS / web),
    // даунгрейд качества при сворачивании, синхронизация контролов с lock screen.
    // Singleton-контроллер обеспечивает, что в каждый момент только один плеер
    // владеет media notification.
    const { isInBackground, refreshMetadata } = useBackgroundPlayback({
      playerId,
      videoElement,
      hls,
      isPlaying,
      isAudio: toRef(p, 'isAudio'),
      getMetadata: () => ({
        title: p.title || 'Видео',
        artist: p.artist || '',
        artworkUrl: thumbnailUrl.value || undefined,
      }),
    })

    // === Главы (тайм-коды из описания) ===

    // Маркеры на прогресс-баре (в процентах), пропускаем 0:00 и тайм-коды за пределами длительности.
    const chapterMarkers = computed<number[]>(() => {
      const chapters = p.chapters || []
      const total = duration.value
      if (!chapters.length || !total || !isFinite(total) || total <= 0) return []
      return chapters
        .filter((ch) => ch.start > 0 && ch.start < total)
        .map((ch) => (ch.start / total) * 100)
    })

    // Текущая активная глава по currentTime (показывается рядом со временем).
    const activeChapter = computed<Chapter | null>(() => {
      const chapters = p.chapters || []
      if (!chapters.length) return null
      const idx = findActiveChapterIndex(chapters, currentTime.value)
      return idx >= 0 ? chapters[idx] : null
    })

    // Перемотка к моменту (вызывается извне через template ref).
    // Если плеер ещё не инициализирован — запускаем загрузку и применяем seek после готовности.
    let pendingSeek: number | null = null
    const applySeek = (seconds: number) => {
      const video = getVideoElement()
      if (!video) return
      const clamped = Math.max(0, seconds)
      const safe =
        video.duration && isFinite(video.duration) && video.duration > 0
          ? Math.min(clamped, video.duration)
          : clamped
      video.currentTime = safe
      currentTime.value = safe
      isEnded.value = false
    }

    const seekTo = (seconds: number) => {
      if (!isFinite(seconds) || seconds < 0) return

      if (!isInitialized.value) {
        // Запоминаем точку и инициализируем плеер с воспроизведением.
        pendingSeek = seconds
        initPlayer(true)
        return
      }

      applySeek(seconds)
      const video = getVideoElement()
      if (video && video.paused) {
        video
          .play()
          .then(() => {
            isPlaying.value = true
            videoPlayerManager.pauseAllExcept(playerId.value)
          })
          .catch((err) => console.warn('Seek + play failed:', err))
      }
    }

    // Применяем отложенный seek сразу после инициализации плеера.
    watch(isInitialized, (initialized) => {
      if (initialized && pendingSeek !== null) {
        const target = pendingSeek
        pendingSeek = null
        // Дожидаемся, чтобы видео получило длительность (loadedmetadata).
        const tryApply = () => {
          const video = getVideoElement()
          if (video && video.readyState >= 1) {
            applySeek(target)
          } else if (video) {
            video.addEventListener('loadedmetadata', () => applySeek(target), { once: true })
          }
        }
        tryApply()
      }
    })

    const togglePlay = (showNotification: boolean = false) => {
      const video = getVideoElement()
      if (!video) return

      if (video.paused) {
        // Сбрасываем флаг завершения, если видео закончилось
        if (isEnded.value) {
          isEnded.value = false
          video.currentTime = 0
        }

        // Если HLS еще не инициализирован, инициализируем
        if (!isInitialized.value) {
          initPlayer(true)
        } else {
          video
            .play()
            .then(() => {
              isPlaying.value = true
              videoPlayerManager.pauseAllExcept(playerId.value)

              if (showNotification) {
                triggerPlayPauseNotification(true)
              }
            })
            .catch((err) => {
              console.error('Error playing video:', err)
            })
        }
      } else {
        video.pause()
        isPlaying.value = false

        if (showNotification) {
          triggerPlayPauseNotification(false)
        }
      }
    }

    const setPlaybackRate = (rate: number) => {
      internalSetPlaybackRate(rate)
      // Если видео на паузе, показываем уведомление вручную, так как ratechange не сработает
      if (!isPlaying.value) {
        showPlaybackRateNotification.value = true
        setTimeout(() => (showPlaybackRateNotification.value = false), 1000)
      }
    }

    const loadThumbnail = () => {
      getVideoThumbnailFromUrl(p.videoUrl)
        .then((url) => {
          thumbnailUrl.value = url
        })
        .catch(() => {
          // Превью не критично: невалидный URL / PeerTube 5xx — просто
          // показываем плеер без превью, не засоряя консоль.
          thumbnailUrl.value = null
        })
    }

    const stopVideo = () => {
      const video = getVideoElement()
      if (video) {
        video.pause()
        video.currentTime = 0
      }
      isPlaying.value = false
      isEnded.value = false
    }

    const handleThumbnailLoad = (e: Event) => {
      isThumbnailLoaded.value = true

      const img = e.target as HTMLImageElement
      if (img.naturalWidth && img.naturalHeight) {
        const aspectRatio = img.naturalWidth / img.naturalHeight
        const useContain = aspectRatio > 1 / 1.5 // Если слишком широкое или узкое

        thumbnailAspectRatio.value = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          useContain,
        }
      }
    }

    const handleThumbnailError = () => {
      isThumbnailLoaded.value = true
    }

    // Реализация позднего связывания
    setupVideoEventListeners = () => {
      const video = getVideoElement()
      if (!video) return

      video.addEventListener('play', () => {
        isPlaying.value = true
        isEnded.value = false
        // Сообщаем менеджеру
        videoPlayerManager.pauseAllExcept(playerId.value)
      })

      video.addEventListener('pause', () => {
        isPlaying.value = false
      })

      video.addEventListener('ended', () => {
        isPlaying.value = false
        isEnded.value = true
        stopProgressAnimation()
        if (document.fullscreenElement) {
          document.exitFullscreen()
        }
      })

      video.addEventListener('waiting', () => {
        isBuffering.value = true
      })

      video.addEventListener('playing', () => {
        isBuffering.value = false
        isEnded.value = false
      })

      video.addEventListener('canplay', () => {
        // Видео готово к воспроизведению
        updateDuration()
        updateBuffered()
      })

      video.addEventListener('loadedmetadata', () => {
        updateDuration()
        updateBuffered()
        handleVideoMetadata()
      })

      video.addEventListener('durationchange', () => {
        updateDuration()
      })

      video.addEventListener('progress', () => {
        updateBuffered()
      })
    }

    setupIntersectionObserver = () => {
      if (intersectionObserver) {
        intersectionObserver.disconnect()
      }

      const element = resolveDomElement(videoContainer)
      if (!element) return

      intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              // Видео ушло с экрана — обычно ставим на паузу. НО: если приложение
              // ушло в фон (document.hidden / isInBackground), это «ложный» уход
              // из вьюпорта и плеер должен продолжать играть звук.
              if (isInBackground.value || document.hidden) return

              const video = getVideoElement()
              if (video && !video.paused) {
                video.pause()
              }
            }
          })
        },
        {
          threshold: 0.5, // 50% видимости
        }
      )

      intersectionObserver.observe(element)
    }

    const handleVideoMetadata = () => {
      const video = getVideoElement()
      if (!video) return

      // Длительность стала известна — обновим media session, чтобы scrubber на
      // lock screen / в notification получил корректный диапазон.
      refreshMetadata()

      const videoWidth = video.videoWidth
      const videoHeight = video.videoHeight

      if (videoWidth === 0 || videoHeight === 0) return

      const aspectRatio = videoWidth / videoHeight
      const useContain = aspectRatio > 1 / 1.5

      videoAspectRatio.value = {
        width: videoWidth,
        height: videoHeight,
        useContain,
      }
    }

    // Стили
    const getVideoWrapperStyle = (): Record<string, string> => {
      const aspectInfo = videoAspectRatio.value || thumbnailAspectRatio.value
      if (aspectInfo && aspectInfo.useContain) {
        return { backgroundColor: '#f5f5f5' }
      }
      return {}
    }

    const getThumbnailStyle = (): Record<string, string> => ({ objectFit: 'contain' })
    const getVideoStyle = (): Record<string, string> => ({ objectFit: 'contain' })

    // Computed
    const shouldHideCursor = computed(() => {
      return isFullscreen.value && !showControls.value
    })

    // Click handler: single → play/pause, double → fullscreen
    const handleVideoClick = createClickHandler(togglePlay, toggleFullscreen, DOUBLE_CLICK_DELAY)

    // Горячие клавиши (регистрация/снятие listener'а делает сам composable)
    const { showHotkeysHelp, toggleHotkeysHelp } = useVideoHotkeys({
      videoElement,
      playerId,
      isHovering,
      isFullscreen,
      volume,
      showVolumeNotification,
      togglePlay,
      toggleFullscreen,
      toggleMute,
      setVolume,
      increasePlaybackRate,
      decreasePlaybackRate,
      triggerSeekNotification,
    })
    const hotkeysList = HOTKEYS_LIST

    // Lifecycle
    onMounted(() => {
      // Регистрируем плеер в менеджере
      unregisterPlayer = videoPlayerManager.register(playerId.value, {
        id: playerId.value,
        pause: () => {
          const video = getVideoElement()
          if (video && !video.paused) {
            video.pause()
          }
        },
        isPlaying: () => isPlaying.value,
        togglePlay: () => togglePlay(),
        toggleMute: () => toggleMute(),
        increasePlaybackRate: () => increasePlaybackRate(),
        decreasePlaybackRate: () => decreasePlaybackRate(),
        resetPlaybackRate: () => resetPlaybackRate(),
        toggleHotkeysHelp: () => toggleHotkeysHelp(),
      })

      // Загружаем thumbnail
      loadThumbnail()

      // Инициализируем плеер
      if (p.autoplay) {
        initPlayer()
      }
    })

    let unregisterPlayer: (() => void) | null = null

    onBeforeUnmount(() => {
      if (unregisterPlayer) {
        unregisterPlayer()
      }

      if (intersectionObserver) {
        intersectionObserver.disconnect()
      }

      stopVideo()
    })

    watch(
      () => p.videoUrl,
      () => {
        stopVideo()
        isInitialized.value = false
        error.value = null
        thumbnailUrl.value = null
        isThumbnailLoaded.value = false

        // Сбрасываем HLS и инициализируем заново
        if (hls.value) {
          hls.value.destroy()
          hls.value = null
        }

        loadThumbnail()
        if (p.autoplay) {
          initPlayer()
        }
      }
    )

    return {
      videoElement,
      domVideoElement,
      videoContainer,
      // State
      isPlaying,
      isEnded,
      isLoading,
      isInitialized,
      isBuffering,
      error,
      thumbnailUrl,
      isThumbnailLoaded,

      // Controls
      showControls,
      isHovering,
      showControlsInitially,
      handleMouseEnter,
      handleMouseMove,
      handleMouseLeave,
      shouldHideCursor,
      togglePlay,

      // Progress
      currentTime,
      duration,
      progressWidth,
      bufferedWidth,
      handleProgressClick,
      handleProgressPointerDown,
      formatTime,

      // Volume
      volume,
      previousVolume,
      isDraggingVolume,
      showVolumeNotification,
      volumeSliderRef,
      volumeWidth,
      handleVolumeMouseDown,
      handleVolumeClick,
      formatVolumeDisplay,
      toggleMute,

      // Fullscreen
      isFullscreen,
      toggleFullscreen,

      // Playback Rate
      playbackRate,
      availablePlaybackRates,
      showPlaybackRateNotification,
      setPlaybackRate,
      increasePlaybackRate,
      decreasePlaybackRate,
      resetPlaybackRate,
      formatPlaybackRate,

      // Quality & Menu
      isQualityMenuOpen,
      availableQualityLevels,
      currentQualityLevel,
      qualityControlRef,
      qualityDropdownRef,
      currentMenuScreen,
      setQualityLevel,
      openQualityMenu,
      openSpeedMenu,
      goBackToMainMenu,
      toggleQualityMenu,
      getCurrentQualityLabel,

      // Handlers
      handleThumbnailLoad,
      handleThumbnailError,
      handleVideoMetadata,
      getVideoWrapperStyle,
      getThumbnailStyle,
      getVideoStyle,
      initPlayer,
      handleVideoClick,

      // Hotkeys Help
      showHotkeysHelp,
      toggleHotkeysHelp,
      hotkeysList,

      // Notifications
      showPlayNotification,
      showPauseNotification,
      showSeekNotification,
      seekValue,

      // Chapters
      chapterMarkers,
      activeChapter,
      seekTo,
    }
  },
})
