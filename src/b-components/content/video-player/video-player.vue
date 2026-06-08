<template>
  <SC_VideoContainer
    ref="videoContainer"
    tabindex="0"
    :class="{ 'hide-cursor': shouldHideCursor, 'is-fullscreen': isFullscreen }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @mousemove="handleMouseMove"
    @click="handleVideoClick"
  >
    <SC_VideoWrapper :style="getVideoWrapperStyle()">
      <!-- Skeleton loader while thumbnail is loading -->
      <SC_VideoSkeleton v-if="thumbnailUrl && !isThumbnailLoaded" />

      <!-- Размытый фон из превью (cover) — заполняет пустое пространство под основной превьюшкой -->
      <SC_VideoThumbnailBackdrop
        v-if="(isAudio || !isInitialized) && thumbnailUrl && !isLoading && !error"
        :src="thumbnailUrl"
        alt=""
        aria-hidden="true"
      />

      <!-- Превьюшка видео до инициализации или если это аудио -->
      <SC_VideoThumbnail
        v-if="(isAudio || !isInitialized) && thumbnailUrl && !isLoading && !error"
        :src="thumbnailUrl"
        alt="Video thumbnail"
        :style="getThumbnailStyle()"
        @load="handleThumbnailLoad"
        @error="handleThumbnailError"
      />

      <AudioVisualizer
        v-if="isAudio && isInitialized && !error"
        :videoElement="domVideoElement"
        :isPlaying="isPlaying"
      />

      <SC_VideoElement
        ref="videoElement"
        :controls="false"
        :playsinline="true"
        preload="none"
        crossorigin="anonymous"
        :style="getVideoStyle()"
        @loadedmetadata="handleVideoMetadata"
      >
        <track
          v-for="(tr, i) in subtitleTracks"
          :key="tr.src"
          kind="subtitles"
          :src="tr.src"
          :srclang="tr.language"
          :label="tr.label"
          :default="i === 0"
        />
      </SC_VideoElement>
    </SC_VideoWrapper>

    <!-- Индикатор загрузки (при инициализации) -->
    <SC_VideoLoading v-if="isLoading && !error">
      <LoadingOutlined :style="ICON_WHITE_85_48" spin />
    </SC_VideoLoading>

    <!-- Индикатор загрузки чанков (во время воспроизведения) -->
    <SC_VideoLoading v-if="isBuffering && isInitialized && !error && isPlaying">
      <LoadingOutlined :style="ICON_WHITE_85_48" spin />
    </SC_VideoLoading>

    <!-- Сообщение об ошибке + кнопка повтора -->
    <SC_VideoError v-if="error">
      <p>{{ error }}</p>
      <SC_VideoRetryButton type="button" @click.stop="retry">
        <ReloadOutlined />
        <span>{{ t('videoMsg.retry') }}</span>
      </SC_VideoRetryButton>
    </SC_VideoError>

    <!-- Кнопка Play для неинициализированного проигрывателя -->
    <SC_VideoPlayButton v-if="!isInitialized && !isLoading && !error" @click.stop="togglePlay">
      <PlayCircleOutlined :style="ICON_WHITE_64" />
    </SC_VideoPlayButton>

    <!-- Уведомление о скорости воспроизведения -->
    <SC_PlaybackRateNotification
      v-if="showPlaybackRateNotification && isInitialized"
      :show="showPlaybackRateNotification"
    >
      {{ formatPlaybackRate(playbackRate) }}
    </SC_PlaybackRateNotification>

    <!-- Уведомление о громкости -->
    <SC_VolumeNotification
      v-if="showVolumeNotification && isInitialized"
      :show="showVolumeNotification"
    >
      {{ formatVolumeDisplay() }}
    </SC_VolumeNotification>

    <!-- Уведомление о перемотке -->
    <SC_SeekNotification v-if="showSeekNotification && isInitialized" :show="showSeekNotification">
      {{ seekValue }}
    </SC_SeekNotification>

    <!-- Иконка Play -->
    <SC_SeekNotification v-if="showPlayNotification && isInitialized" :show="showPlayNotification">
      <PlayCircleOutlined :style="ICON_GRAY_EEE_24" />
    </SC_SeekNotification>

    <!-- Иконка Pause -->
    <SC_SeekNotification
      v-if="showPauseNotification && isInitialized"
      :show="showPauseNotification"
    >
      <PauseCircleOutlined :style="ICON_GRAY_EEE_24" />
    </SC_SeekNotification>

    <!-- Справка по горячим клавишам -->
    <SC_HotkeysHelpOverlay v-if="showHotkeysHelp" @click.stop="toggleHotkeysHelp">
      <SC_HotkeysHelpContent @click.stop>
        <SC_HotkeysCloseButton @click.stop="toggleHotkeysHelp">
          <CloseOutlined :style="ICON_SIZE_XL" />
        </SC_HotkeysCloseButton>

        <SC_HotkeysHelpTitle>{{ t('videoPlayer.hotkeysTitle') }}</SC_HotkeysHelpTitle>

        <SC_HotkeysHelpList>
          <SC_HotkeysHelpItem v-for="item in hotkeysList" :key="item.key">
            <SC_HotkeysKey>{{ item.key }}</SC_HotkeysKey>
            <SC_HotkeysDescription>{{ t(item.labelKey) }}</SC_HotkeysDescription>
          </SC_HotkeysHelpItem>
        </SC_HotkeysHelpList>
      </SC_HotkeysHelpContent>
    </SC_HotkeysHelpOverlay>

    <!-- Контролы проигрывателя (только после инициализации) -->
    <SC_VideoControls
      v-if="isInitialized && !isLoading && !error"
      :show="showControls || showControlsInitially"
      @click.stop
    >
      <SC_VideoControlsBar>
        <!-- Кнопка Play/Pause -->
        <SC_VideoPlayPauseButton @click.stop="togglePlay">
          <ReloadOutlined v-if="isEnded" :style="ICON_SIZE_XL" />
          <PlayCircleOutlined v-else-if="!isPlaying" :style="ICON_SIZE_XL" />
          <PauseCircleOutlined v-else :style="ICON_SIZE_XL" />
        </SC_VideoPlayPauseButton>

        <!-- Контрол громкости -->
        <SC_VideoVolumeControl>
          <SC_VideoVolumeButton @click.stop="toggleMute">
            <SC_VideoVolumeMutedIcon v-if="volume === 0">
              <SoundOutlined :style="ICON_MUTED_18" />
              <SC_VideoVolumeMutedCross />
            </SC_VideoVolumeMutedIcon>
            <SoundOutlined v-else :style="ICON_SIZE_LG" />
          </SC_VideoVolumeButton>
          <SC_VideoVolumeSlider
            ref="volumeSliderRef"
            @mousedown.stop="handleVolumeMouseDown"
            @click.stop="handleVolumeClick"
          >
            <SC_VideoVolumeFill :isDragging="isDraggingVolume" :style="{ width: volumeWidth }" />
          </SC_VideoVolumeSlider>
        </SC_VideoVolumeControl>

        <!-- Контрол качества видео и скорости -->
        <SC_VideoQualityControl ref="qualityControlRef">
          <SC_VideoQualityButton @click.stop="toggleQualityMenu">
            <SettingOutlined :style="ICON_SIZE_LG" />
          </SC_VideoQualityButton>
          <SC_VideoQualityDropdown ref="qualityDropdownRef" :isOpen="isQualityMenuOpen" @click.stop>
            <!-- Главное меню -->
            <template v-if="currentMenuScreen === 'main'">
              <!-- Пункт меню: Качество видео -->
              <SC_VideoQualityMenuSection v-if="!isAudio && availableQualityLevels.length > 0">
                <SC_VideoQualitySubmenuItem @click.stop="openQualityMenu">
                  <span>{{ t('videoPlayer.quality') }}</span>
                  <SC_SubmenuArrow>▶</SC_SubmenuArrow>
                </SC_VideoQualitySubmenuItem>
              </SC_VideoQualityMenuSection>

              <!-- Пункт меню: Скорость воспроизведения -->
              <SC_VideoQualityMenuSection>
                <SC_VideoQualitySubmenuItem @click.stop="openSpeedMenu">
                  <span>{{ t('videoPlayer.speed') }}</span>
                  <SC_SubmenuArrow>▶</SC_SubmenuArrow>
                </SC_VideoQualitySubmenuItem>
              </SC_VideoQualityMenuSection>
            </template>

            <!-- Меню качества -->
            <template v-if="currentMenuScreen === 'quality'">
              <SC_VideoQualityMenuSection>
                <SC_VideoQualitySubmenuItem @click.stop="goBackToMainMenu">
                  <span>← {{ t('videoPlayer.back') }}</span>
                </SC_VideoQualitySubmenuItem>
              </SC_VideoQualityMenuSection>
              <SC_VideoQualityMenuSection>
                <SC_VideoQualitySubmenuItemInner
                  v-for="level in availableQualityLevels"
                  :key="level.index"
                  :isActive="currentQualityLevel === level.index"
                  @click.stop="setQualityLevel(level.index)"
                >
                  {{ level.label }}
                </SC_VideoQualitySubmenuItemInner>
              </SC_VideoQualityMenuSection>
            </template>

            <!-- Меню скорости -->
            <template v-if="currentMenuScreen === 'speed'">
              <SC_VideoQualityMenuSection>
                <SC_VideoQualitySubmenuItem @click.stop="goBackToMainMenu">
                  <span>← {{ t('videoPlayer.back') }}</span>
                </SC_VideoQualitySubmenuItem>
              </SC_VideoQualityMenuSection>
              <SC_VideoQualityMenuSection>
                <SC_VideoQualitySubmenuItemInner
                  v-for="rate in availablePlaybackRates"
                  :key="rate"
                  :isActive="playbackRate === rate"
                  @click.stop="setPlaybackRate(rate)"
                >
                  {{ formatPlaybackRate(rate) }}
                </SC_VideoQualitySubmenuItemInner>
              </SC_VideoQualityMenuSection>
            </template>
          </SC_VideoQualityDropdown>
        </SC_VideoQualityControl>

        <!-- Прогресс-бар (Pointer Events: mouse + touch + pen) -->
        <SC_VideoProgressBar @pointerdown.stop="handleProgressPointerDown">
          <SC_VideoBufferFill :style="{ width: bufferedWidth }" />
          <SC_VideoProgressFill :style="{ width: progressWidth }" />
          <SC_VideoChapterMarker
            v-for="(pos, i) in chapterMarkers"
            :key="`chapter-${i}`"
            :style="{ left: pos + '%' }"
            :title="chapters[i]?.label"
          />
        </SC_VideoProgressBar>

        <!-- Время -->
        <SC_VideoTimeDisplay>
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </SC_VideoTimeDisplay>

        <!-- Название текущей главы -->
        <SC_VideoChapterTitle v-if="activeChapter" :title="activeChapter.label">
          {{ activeChapter.label }}
        </SC_VideoChapterTitle>

        <!-- Picture-in-Picture (переиспользуем стиль кнопки fullscreen) -->
        <SC_VideoFullscreenButton
          v-if="!isAudio && isPipSupported"
          :class="{ active: isPip }"
          @click.stop="togglePip"
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor" stroke="none" />
          </svg>
        </SC_VideoFullscreenButton>

        <!-- Кнопка полноэкранного режима -->
        <SC_VideoFullscreenButton v-if="!isAudio" @click.stop="toggleFullscreen">
          <FullscreenExitOutlined v-if="isFullscreen" :style="ICON_SIZE_XL" />
          <FullscreenOutlined v-else :style="ICON_SIZE_XL" />
        </SC_VideoFullscreenButton>
      </SC_VideoControlsBar>
    </SC_VideoControls>
  </SC_VideoContainer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ICON_SIZE_LG,
  ICON_SIZE_XL,
  ICON_MUTED_18,
  ICON_WHITE_85_48,
  ICON_WHITE_64,
  ICON_GRAY_EEE_24,
} from '@/styles/icon-styles'
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
import { videoPlayerManager } from './video-player-manager'
import type { Chapter } from '@/helpers/content/timecode-parser'
import { findActiveChapterIndex } from '@/helpers/content/timecode-parser'
import { useVideoHotkeys } from './composables/use-video-hotkeys'
import { useVideoControls } from './composables/use-video-controls'
import { HOTKEYS_LIST, DOUBLE_CLICK_DELAY } from './consts'
import { createClickHandler } from './helpers'
import { useVideoProgress } from './composables/use-video-progress'
import { useVideoVolume } from './composables/use-video-volume'
import { useVideoPlaybackRate } from './composables/use-video-playback-rate'
import { useVideoFullscreen } from './composables/use-video-fullscreen'
import { useVideoPip } from './composables/use-video-pip'
import { useVideoHls } from './composables/use-video-hls'
import { useBackgroundPlayback } from './composables/use-background-playback'
import { useVideoNotifications } from './composables/use-video-notifications'
import { useVideoThumbnail } from './composables/use-video-thumbnail'
import { useVideoSubtitles } from './composables/use-video-subtitles'
import { useVideoElementEvents } from './composables/use-video-element-events'
import { resolveVideoElement } from './composables/utils'
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
  SC_VideoRetryButton,
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
  SC_SubmenuArrow,
} from './styled'

const props = withDefaults(
  defineProps<{
    videoUrl: string
    autoplay?: boolean
    isAudio?: boolean
    chapters?: Chapter[]
    title?: string
    artist?: string
  }>(),
  { autoplay: false, isAudio: false, chapters: () => [], title: '', artist: '' }
)

const { t } = useI18n()

const videoElement = ref<HTMLVideoElement | null>(null)
const videoContainer = ref<HTMLElement | null>(null)
const isPlaying = ref(false)
const isEnded = ref(false)
const playerId = ref(`video-player-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`)

// Уведомления (play/pause/seek — кратковременные pop-up иконки в центре плеера).
const {
  showPlayNotification,
  showPauseNotification,
  showSeekNotification,
  seekValue,
  triggerSeekNotification,
  triggerPlayPauseNotification,
} = useVideoNotifications()

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
const { isPip, isPipSupported, togglePip } = useVideoPip(videoElement)

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

// Позднее связывание: `setupVideoEventListeners` и `setupIntersectionObserver`
// определяются ниже, но передаются в `useVideoHls` уже здесь. Через `let` —
// затем присваиваем настоящие реализации.
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
  retry,
  setQualityLevel,
  openQualityMenu,
  openSpeedMenu,
  goBackToMainMenu,
  toggleQualityMenu,
  getCurrentQualityLabel,
} = useVideoHls(
  props,
  videoElement,
  volume,
  playbackRate,
  playerId,
  updateBuffered,
  () => setupIntersectionObserver(),
  showControlsInitially,
  () => setupVideoEventListeners()
)

function getVideoElement(): HTMLVideoElement | null {
  return resolveVideoElement(videoElement)
}
const domVideoElement = computed(() => resolveVideoElement(videoElement))

// Превью + соотношение сторон. refreshMetadata определяется ниже
// (useBackgroundPlayback); handleVideoMetadata дёргает его только по событию
// loadedmetadata (уже после setup), поэтому связываем позднее.
let refreshMetadata: () => void = () => {}
const {
  thumbnailUrl,
  isThumbnailLoaded,
  loadThumbnail,
  handleThumbnailLoad,
  handleThumbnailError,
  handleVideoMetadata,
  getVideoWrapperStyle,
  getThumbnailStyle,
  getVideoStyle,
} = useVideoThumbnail(videoElement, toRef(props, 'videoUrl'), () => refreshMetadata())

// Субтитры (PeerTube captions → blob <track>).
const { subtitleTracks } = useVideoSubtitles(toRef(props, 'videoUrl'))

// Фоновое воспроизведение: native media session (Android) + MediaSession API
// (iOS / web), даунгрейд качества при сворачивании, синхронизация контролов
// с lock screen. Singleton-контроллер гарантирует, что в каждый момент
// только один плеер владеет media notification.
const { isInBackground, refreshMetadata: backgroundRefreshMetadata } = useBackgroundPlayback({
  playerId,
  videoElement,
  hls,
  isPlaying,
  isAudio: toRef(props, 'isAudio'),
  getMetadata: () => ({
    title: props.title || t('videoPlayer.defaultTitle'),
    artist: props.artist || '',
    artworkUrl: thumbnailUrl.value || undefined,
  }),
})
refreshMetadata = backgroundRefreshMetadata

// DOM-события <video> + IntersectionObserver (авто-пауза вне вьюпорта).
// setup* — позднее связывание: их уже захватил useVideoHls выше.
const videoElementEvents = useVideoElementEvents({
  videoElement,
  videoContainer,
  playerId,
  isPlaying,
  isEnded,
  isBuffering,
  isInBackground,
  stopProgressAnimation,
  updateDuration,
  updateBuffered,
  handleVideoMetadata,
})
setupVideoEventListeners = videoElementEvents.setupVideoEventListeners
setupIntersectionObserver = videoElementEvents.setupIntersectionObserver

// === Главы (тайм-коды из описания). ===

// Маркеры на прогресс-баре (в процентах); пропускаем 0:00 и тайм-коды
// за пределами длительности.
const chapterMarkers = computed<number[]>(() => {
  const chapters = props.chapters || []
  const total = duration.value
  if (!chapters.length || !total || !isFinite(total) || total <= 0) return []
  return chapters
    .filter((ch) => ch.start > 0 && ch.start < total)
    .map((ch) => (ch.start / total) * 100)
})

// Текущая активная глава по currentTime (показывается рядом со временем).
const activeChapter = computed<Chapter | null>(() => {
  const chapters = props.chapters || []
  if (!chapters.length) return null
  const idx = findActiveChapterIndex(chapters, currentTime.value)
  return idx >= 0 ? chapters[idx] : null
})

// Перемотка к моменту (вызывается извне через template ref).
// Если плеер ещё не инициализирован — запускаем загрузку и применяем seek
// после готовности.
let pendingSeek: number | null = null
function applySeek(seconds: number): void {
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

function seekTo(seconds: number): void {
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
    const tryApply = (): void => {
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

function togglePlay(showNotification = false): void {
  const video = getVideoElement()
  if (!video) return

  if (video.paused) {
    // Сбрасываем флаг завершения, если видео закончилось.
    if (isEnded.value) {
      isEnded.value = false
      video.currentTime = 0
    }

    if (!isInitialized.value) {
      initPlayer(true)
    } else {
      video
        .play()
        .then(() => {
          isPlaying.value = true
          videoPlayerManager.pauseAllExcept(playerId.value)
          if (showNotification) triggerPlayPauseNotification(true)
        })
        .catch((err) => {
          console.error('Error playing video:', err)
        })
    }
  } else {
    video.pause()
    isPlaying.value = false
    if (showNotification) triggerPlayPauseNotification(false)
  }
}

function setPlaybackRate(rate: number): void {
  internalSetPlaybackRate(rate)
  // Если видео на паузе — показываем уведомление вручную, поскольку
  // событие `ratechange` без воспроизведения не сработает.
  if (!isPlaying.value) {
    showPlaybackRateNotification.value = true
    setTimeout(() => (showPlaybackRateNotification.value = false), 1000)
  }
}

function stopVideo(): void {
  const video = getVideoElement()
  if (video) {
    video.pause()
    video.currentTime = 0
  }
  isPlaying.value = false
  isEnded.value = false
}

const shouldHideCursor = computed<boolean>(() => isFullscreen.value && !showControls.value)

// Click handler: single → play/pause, double → fullscreen.
const handleVideoClick = createClickHandler(togglePlay, toggleFullscreen, DOUBLE_CLICK_DELAY)

// Горячие клавиши (composable сам регистрирует/снимает listener).
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

let unregisterPlayer: (() => void) | null = null

onMounted(() => {
  // Регистрируем плеер в менеджере (взаимный pause при старте другого плеера).
  unregisterPlayer = videoPlayerManager.register(playerId.value, {
    id: playerId.value,
    pause: () => {
      const video = getVideoElement()
      if (video && !video.paused) video.pause()
    },
    isPlaying: () => isPlaying.value,
    togglePlay: () => togglePlay(),
    toggleMute: () => toggleMute(),
    increasePlaybackRate: () => increasePlaybackRate(),
    decreasePlaybackRate: () => decreasePlaybackRate(),
    resetPlaybackRate: () => resetPlaybackRate(),
    toggleHotkeysHelp: () => toggleHotkeysHelp(),
  })

  loadThumbnail()

  if (props.autoplay) initPlayer()
})

onBeforeUnmount(() => {
  if (unregisterPlayer) unregisterPlayer()
  stopVideo()
})

watch(
  () => props.videoUrl,
  () => {
    stopVideo()
    isInitialized.value = false
    error.value = null
    thumbnailUrl.value = null
    isThumbnailLoaded.value = false

    // Сбрасываем HLS и инициализируем заново.
    if (hls.value) {
      hls.value.destroy()
      hls.value = null
    }

    loadThumbnail()
    if (props.autoplay) initPlayer()
  }
)

// `seekTo` нужен родителю post-card для перехода по клику на тайм-код в описании.
defineExpose({ seekTo })
</script>
