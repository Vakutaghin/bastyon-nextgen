import {
  defineComponent,
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
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
  SettingOutlined
} from '@ant-design/icons-vue'

import { getVideoThumbnailFromUrl } from '@/helpers/api/peertube-url'
import { videoPlayerManager } from './video-player-manager'

// Composables
import { useVideoControls } from './composables/use-video-controls'
import { useVideoProgress } from './composables/use-video-progress'
import { useVideoVolume } from './composables/use-video-volume'
import { useVideoPlaybackRate } from './composables/use-video-playback-rate'
import { useVideoFullscreen } from './composables/use-video-fullscreen'
import { useVideoHls } from './composables/use-video-hls'
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
  SC_SeekNotification
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
    SettingOutlined
  },
  props: {
    videoUrl: {
      type: String as PropType<string>,
      required: true
    },
    autoplay: {
      type: Boolean as PropType<boolean>,
      default: false
    },
    isAudio: {
      type: Boolean as PropType<boolean>,
      default: false
    }
  },
  setup(p) {
    const videoElement = ref<HTMLVideoElement | null>(null)
    const videoContainer = ref<HTMLElement | null>(null)
    const isPlaying = ref(false)
    const isEnded = ref(false)
    const thumbnailUrl = ref<string | null>(null)
    const isThumbnailLoaded = ref(false)
    const thumbnailAspectRatio = ref<{ width: number; height: number; useContain: boolean } | null>(null)
    const videoAspectRatio = ref<{ width: number; height: number; useContain: boolean } | null>(null)
    const playerId = ref(`video-player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
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
      formatTime
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
      toggleMute
    } = useVideoVolume(videoElement)

    const {
      isFullscreen,
      toggleFullscreen
    } = useVideoFullscreen(videoElement, videoContainer)

    const {
      playbackRate,
      availablePlaybackRates,
      showPlaybackRateNotification,
      setPlaybackRate: internalSetPlaybackRate,
      increasePlaybackRate,
      decreasePlaybackRate,
      resetPlaybackRate,
      formatPlaybackRate
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
      getCurrentQualityLabel
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
          video.play()
            .then(() => {
              isPlaying.value = true
              videoPlayerManager.pauseAllExcept(playerId.value)

              if (showNotification) {
                triggerPlayPauseNotification(true)
              }
            })
            .catch(err => {
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
        setTimeout(() => showPlaybackRateNotification.value = false, 1000)
      }
    }

    const loadThumbnail = () => {
      getVideoThumbnailFromUrl(p.videoUrl)
        .then(url => {
          thumbnailUrl.value = url
        })
        .catch(err => {
          console.warn('Failed to load video thumbnail:', err)
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
        const useContain = aspectRatio > (1 / 1.5) // Если слишком широкое или узкое

        thumbnailAspectRatio.value = {
          width: img.naturalWidth,
          height: img.naturalHeight,
          useContain
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

      intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) {
            // Если видео ушло с экрана - ставим на паузу
            const video = getVideoElement()
            if (video && !video.paused) {
              video.pause()
            }
          }
        })
      }, {
        threshold: 0.5 // 50% видимости
      })

      intersectionObserver.observe(element)
    }

    const handleVideoMetadata = () => {
      const video = getVideoElement()
      if (!video) return

      const videoWidth = video.videoWidth
      const videoHeight = video.videoHeight

      if (videoWidth === 0 || videoHeight === 0) return

      const aspectRatio = videoWidth / videoHeight
      const useContain = aspectRatio > (1 / 1.5)

      videoAspectRatio.value = {
        width: videoWidth,
        height: videoHeight,
        useContain
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

    // Hotkeys Help
    const showHotkeysHelp = ref(false)

    const hotkeysList = [
      { key: 'Space', description: 'Воспроизведение / Пауза' },
      { key: 'M', description: 'Включить / Выключить звук' },
      { key: 'F', description: 'На весь экран' },
      { key: 'Shift + >', description: 'Увеличить скорость' },
      { key: 'Shift + <', description: 'Уменьшить скорость' },
      { key: 'Shift + / (?)', description: 'Показать эту справку' },
      { key: '← / →', description: 'Перемотка на 10 сек' },
      { key: '↑ / ↓', description: 'Громкость' },
    ]

    const toggleHotkeysHelp = () => {
      showHotkeysHelp.value = !showHotkeysHelp.value
    }

    // Computed
    const shouldHideCursor = computed(() => {
      return isFullscreen.value && !showControls.value
    })

    // Обработка клика по видео
    let clickTimer: any = null
    const CLICK_DELAY = 200 // ms

    const handleVideoClick = () => {
      if (clickTimer) {
        // Double click detected
        clearTimeout(clickTimer)
        clickTimer = null
        toggleFullscreen()
      } else {
        // Single click candidate
        clickTimer = setTimeout(() => {
          clickTimer = null
          togglePlay()
        }, CLICK_DELAY)
      }
    }

    // Обработка горячих клавиш
    const handleKeydown = (e: KeyboardEvent) => {
      // Игнорируем ввод в текстовые поля
      const target = e.target as HTMLElement
      if ([
        'INPUT',
        'TEXTAREA',
        'SELECT',
        'BUTTON'
      ].includes(target.tagName) || target.isContentEditable) return

      // Проверяем, был ли запущен хотя бы один плеер (глобально)
      // Если нет - игнорируем любые горячие клавиши, даже при наведении
      if (!videoPlayerManager.getHasUserInteracted()) {
        return
      }

      // Получаем состояние из менеджера
      const isActivePlayer = videoPlayerManager.getLastActivePlayer()?.id === playerId.value

      // Для пробела и K - особая логика
      // Space перехватывается глобальным обработчиком (use-global-keyboard),
      // но если он дошел сюда (например, из-за stopPropagation в другом месте), обработаем его
      if (e.code === 'Space' || e.code === 'KeyK') {
        // Если это активный плеер ИЛИ мышь над ним ИЛИ он в фулскрине
        if (isActivePlayer || isHovering.value || isFullscreen.value) {
          e.preventDefault() // Обязательно предотвращаем скролл
          togglePlay(true)
          return
        }
      }

      // Для остальных клавиш проверяем условия активности
      // Разрешаем управление, если:
      // 1. Мышь над видео
      // 2. Видео в полноэкранном режиме
      // 3. Плеер является последним активным (по клику)
      if (!isHovering.value && !isFullscreen.value && !isActivePlayer) return

      const video = getVideoElement()
      if (!video) return

      switch(e.code) {
        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault()
          video.currentTime = Math.min(video.duration, video.currentTime + 10)

          triggerSeekNotification('+10s')
          break
        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault()
          video.currentTime = Math.max(0, video.currentTime - 10)

          triggerSeekNotification('-10s')
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(volume.value + 0.1)
          showVolumeNotification.value = true
          setTimeout(() => showVolumeNotification.value = false, 1000)
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(volume.value - 0.1)
          showVolumeNotification.value = true
          setTimeout(() => showVolumeNotification.value = false, 1000)
          break
        case 'KeyF':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'Slash':
          if (e.shiftKey) {
            e.preventDefault()
            toggleHotkeysHelp()
          }
          break
        case 'KeyM':
          // M также перехватывается глобальным обработчиком
          e.preventDefault()
          toggleMute()
          break
        case 'Period':
          // > также перехватывается глобальным обработчиком
          e.preventDefault()
          increasePlaybackRate()
          break
        case 'Comma':
          // < также перехватывается глобальным обработчиком
          e.preventDefault()
          decreasePlaybackRate()
          break
        case 'Escape':
          if (showHotkeysHelp.value) {
            e.preventDefault()
            toggleHotkeysHelp()
          } else if (isFullscreen.value) {
            e.preventDefault()
            toggleFullscreen()
          }
          break
      }
    }

    // Lifecycle
    onMounted(() => {
      window.addEventListener('keydown', handleKeydown)

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
        toggleHotkeysHelp: () => toggleHotkeysHelp()
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
      window.removeEventListener('keydown', handleKeydown)

      if (clickTimer) {
        clearTimeout(clickTimer)
      }

      if (unregisterPlayer) {
        unregisterPlayer()
      }

      if (intersectionObserver) {
        intersectionObserver.disconnect()
      }

      stopVideo()
    })

    watch(() => p.videoUrl, () => {
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
    })

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
      seekValue
    }
  }
})
