<template>
  <!-- Плеер — как у YouTube: на компьютере панель внизу, клик — пауза, двойной —
       весь экран; на телефоне касание показывает панель, двойное касание сбоку
       перематывает, удержание — 2× (use-touch-controls). -->
  <SC_VideoContainer
    ref="videoContainer"
    tabindex="0"
    :class="{
      'hide-cursor': shouldHideCursor,
      'is-fullscreen': isFullscreen,
      'pointer-mode': pointerMode,
      'touch-ui': touchUi,
      'menu-open': isQualityMenuOpen,
    }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @mousemove="handleMouseMove"
    @click="handleContainerClick"
    @pointerdown.capture="handlePointerDownCapture"
    @pointerdown="touch.onPointerDown"
    @pointermove="touch.onPointerMove"
    @pointerup="touch.onPointerUp"
    @pointercancel="touch.onPointerCancel"
    @contextmenu="handleContextMenu"
    @keydown.tab="pointerMode = false"
    @focusout="handleFocusOut"
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
          :key="tr.language || i"
          kind="subtitles"
          :src="tr.src"
          :srclang="tr.language"
          :label="tr.label"
          :default="i === 0"
        />
      </SC_VideoElement>
    </SC_VideoWrapper>

    <!-- Загрузка: белое кольцо, как у YouTube (и при первом запуске, и когда
         ролик ждёт данные). -->
    <SC_Spinner v-if="showSpinner" />

    <!-- Сообщение об ошибке + кнопка повтора -->
    <SC_VideoError v-if="error" data-player-control @click.stop>
      <p>{{ error }}</p>
      <SC_VideoRetryButton type="button" @click.stop="retry">
        <ReloadOutlined />
        <span>{{ t('videoMsg.retry') }}</span>
      </SC_VideoRetryButton>
    </SC_VideoError>

    <!-- Под Tor видео идёт напрямую с PeerTube (мимо Tor) — играем только после подтверждения (V21). -->
    <SC_VideoError v-if="torNoticeVisible && !error" data-player-control @click.stop>
      <p>{{ t('torMedia.videoBypassTitle') }}</p>
      <SC_VideoTorBody>{{ t('torMedia.videoBypassBody') }}</SC_VideoTorBody>
      <SC_VideoTorActions>
        <SC_VideoRetryButton type="button" @click.stop="acceptTorBypass">
          <span>{{ t('torMedia.videoBypassOk') }}</span>
        </SC_VideoRetryButton>
        <SC_VideoRetryButton type="button" @click.stop="torNoticeVisible = false">
          <span>{{ t('common.cancel') }}</span>
        </SC_VideoRetryButton>
      </SC_VideoTorActions>
    </SC_VideoError>

    <!-- До первого запуска — большая кнопка пуска в центре. -->
    <SC_BigPlayButton
      v-if="!isInitialized && !isLoading && !error && !torNoticeVisible"
      type="button"
      data-player-control
      :aria-label="t('videoPlayer.play')"
      @click.stop="togglePlay()"
    >
      <PlayIcon />
    </SC_BigPlayButton>

    <template v-if="isInitialized && !isLoading && !error">
      <!-- «Пульс» пуска, паузы и громкости в центре. -->
      <SC_Bezel v-if="bezel.icon" :key="bezel.key">
        <component :is="BEZEL_ICONS[bezel.icon]" />
      </SC_Bezel>

      <!-- Плашка сверху: громкость, скорость, 2× при удержании. -->
      <SC_TopPill v-if="pillText">
        <span>{{ pillText }}</span>
        <template v-if="touchHolding"> <SeekArrowIcon /><SeekArrowIcon /> </template>
      </SC_TopPill>

      <!-- Волна перемотки у края: касания на телефоне, стрелки и J/L на компьютере. -->
      <SC_SeekRipple v-if="seekIndicator" :class="seekIndicator.side">
        <SC_SeekArrows> <SeekArrowIcon /><SeekArrowIcon /><SeekArrowIcon /> </SC_SeekArrows>
        <span>{{ t('videoPlayer.seekSeconds', seekIndicator.seconds) }}</span>
      </SC_SeekRipple>

      <!-- Телефон: затемнение, пуск в центре, настройки наверху, время и экран внизу. -->
      <template v-if="touchUi">
        <SC_TouchScrim :class="{ visible: touchChromeVisible }" />
        <SC_TouchLayer :class="{ visible: touchChromeVisible }">
          <SC_TouchCenterButton
            type="button"
            data-player-control
            :aria-label="playTip"
            @click.stop="handleTouchPlay"
          >
            <ReplayIcon v-if="isEnded" />
            <PlayIcon v-else-if="!isPlaying" />
            <PauseIcon v-else />
          </SC_TouchCenterButton>
          <SC_TouchTopBar>
            <SC_TouchButton
              type="button"
              data-player-control
              data-settings-toggle
              :aria-label="t('videoPlayer.settings')"
              :aria-expanded="isQualityMenuOpen"
              @click.stop="toggleQualityMenu"
            >
              <SettingsIcon />
            </SC_TouchButton>
          </SC_TouchTopBar>
          <SC_TouchBottomBar>
            <SC_TimeDisplay
              >{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</SC_TimeDisplay
            >
            <SC_TouchButton
              v-if="!isAudio"
              type="button"
              data-player-control
              :aria-label="fullscreenTip"
              @click.stop="handleTouchFullscreen"
            >
              <FullscreenExitIcon v-if="isFullscreen" />
              <FullscreenIcon v-else />
            </SC_TouchButton>
          </SC_TouchBottomBar>
        </SC_TouchLayer>
      </template>

      <!-- Компьютер: затемнение снизу и ряд кнопок. -->
      <template v-else>
        <SC_GradientBottom :class="{ visible: desktopChromeVisible }" />
        <SC_ControlsRow :class="{ visible: desktopChromeVisible }" data-player-control @click.stop>
          <SC_ControlsGroup>
            <SC_PlayerButton
              type="button"
              class="tip-start"
              :data-tip="playTip"
              :aria-label="playTip"
              @click.stop="togglePlay(true)"
            >
              <ReplayIcon v-if="isEnded" />
              <PlayIcon v-else-if="!isPlaying" />
              <PauseIcon v-else />
            </SC_PlayerButton>

            <SC_VolumeArea class="volume-area" :class="{ dragging: isDraggingVolume }">
              <SC_PlayerButton
                type="button"
                :data-tip="muteTip"
                :aria-label="muteTip"
                @click.stop="toggleMute"
              >
                <VolumeOffIcon v-if="volume === 0" />
                <VolumeDownIcon v-else-if="volume < 0.5" />
                <VolumeUpIcon v-else />
              </SC_PlayerButton>
              <SC_VolumePanel>
                <SC_VolumeHit
                  :style="{ '--volume': volumeWidth }"
                  role="slider"
                  :aria-label="t('videoPlayer.volume')"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  :aria-valuenow="Math.round(volume * 100)"
                  @mousedown.stop="handleVolumeMouseDown"
                  @click.stop="handleVolumeClick"
                >
                  <SC_VolumeTrack>
                    <SC_VolumeFill />
                    <SC_VolumeKnob />
                  </SC_VolumeTrack>
                </SC_VolumeHit>
              </SC_VolumePanel>
            </SC_VolumeArea>

            <SC_TimeDisplay
              >{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</SC_TimeDisplay
            >

            <SC_ChapterTitle v-if="activeChapter" :title="activeChapter.label">
              <span>{{ activeChapter.label }}</span>
            </SC_ChapterTitle>
          </SC_ControlsGroup>

          <SC_ControlsGroup>
            <SC_PlayerButton
              type="button"
              data-settings-toggle
              :class="{ open: isQualityMenuOpen }"
              :data-tip="t('videoPlayer.settings')"
              :aria-label="t('videoPlayer.settings')"
              :aria-expanded="isQualityMenuOpen"
              @click.stop="toggleQualityMenu"
            >
              <SettingsIcon />
            </SC_PlayerButton>

            <SC_PlayerButton
              v-if="!isAudio && isPipSupported"
              type="button"
              :data-tip="`${t('videoPlayer.pip')} (i)`"
              :aria-label="t('videoPlayer.pip')"
              :aria-pressed="isPip"
              @click.stop="togglePip"
            >
              <PipIcon />
            </SC_PlayerButton>

            <SC_PlayerButton
              v-if="!isAudio"
              type="button"
              class="tip-end"
              :data-tip="fullscreenTip"
              :aria-label="fullscreenTip"
              @click.stop="toggleFullscreen"
            >
              <FullscreenExitIcon v-if="isFullscreen" />
              <FullscreenIcon v-else />
            </SC_PlayerButton>
          </SC_ControlsGroup>
        </SC_ControlsRow>
      </template>

      <PlayerProgress
        :visible="touchUi ? touchChromeVisible : desktopChromeVisible"
        :mini="touchUi && !touchChromeVisible && !isFullscreen"
        :touch="touchUi"
        :progress="progress"
        :buffered="bufferedWidth"
        :duration="duration"
        :current-time="currentTime"
        :chapter-markers="chapterMarkers"
        :chapters="chapters"
        :format-time="formatTime"
        @seek-start="handleSeekStart"
      />

      <PlayerSettings
        :open="isQualityMenuOpen"
        :touch="touchUi"
        :fullscreen="isFullscreen"
        :screen="currentMenuScreen"
        :quality-levels="availableQualityLevels"
        :current-quality="currentQualityLevel"
        :auto-quality="isAutoQuality"
        :quality-label="getCurrentQualityLabel"
        :rates="availablePlaybackRates"
        :current-rate="playbackRate"
        :player-root="containerElement"
        @screen="handleMenuScreen"
        @quality="setQualityLevel"
        @rate="handleSelectRate"
        @close="closeQualityMenu"
      />
    </template>

    <!-- Справка по горячим клавишам -->
    <SC_HotkeysHelpOverlay
      v-if="showHotkeysHelp"
      data-player-control
      @click.stop="toggleHotkeysHelp"
    >
      <SC_HotkeysHelpContent @click.stop>
        <SC_HotkeysCloseButton
          type="button"
          :aria-label="t('videoPlayer.close')"
          @click.stop="toggleHotkeysHelp"
        >
          <CloseIcon />
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
  </SC_VideoContainer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, toRef, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { ReloadOutlined } from '@/components/icons'
import { videoPlayerManager } from './video-player-manager'
import type { Chapter } from '@/helpers/content/timecode-parser'
import { useVideoHotkeys } from './composables/use-video-hotkeys'
import { useVideoControls } from './composables/use-video-controls'
import { CONTROL_SELECTOR, useTouchControls } from './composables/use-touch-controls'
import { useTouchUi } from './composables/use-touch-ui'
import { HOTKEYS_LIST, DOUBLE_CLICK_DELAY } from './consts'
import { createClickHandler } from './helpers'
import { useVideoProgress } from './composables/use-video-progress'
import { useVideoVolume } from './composables/use-video-volume'
import { useVideoPlaybackRate } from './composables/use-video-playback-rate'
import { useVideoChapters } from './composables/use-video-chapters'
import { useVideoFullscreen } from './composables/use-video-fullscreen'
import { useVideoPip } from './composables/use-video-pip'
import { useVideoHls } from './composables/use-video-hls'
import { useVideoResume } from './composables/use-video-resume'
import { useBackgroundPlayback } from './composables/use-background-playback'
import { useVideoNotifications, type BezelIcon } from './composables/use-video-notifications'
import { useVideoThumbnail } from './composables/use-video-thumbnail'
import { useVideoSubtitles } from './composables/use-video-subtitles'
import { useVideoElementEvents } from './composables/use-video-element-events'
import { useTorMedia } from '@/composables/use-tor-media'
import { resolveDomElement, resolveVideoElement } from './composables/utils'
import AudioVisualizer from '@/b-components/content/video-player/components/audio-visualizer/audio-visualizer.vue'
import PlayerProgress from './components/player-progress.vue'
import PlayerSettings from './components/player-settings.vue'
import {
  CloseIcon,
  FullscreenExitIcon,
  FullscreenIcon,
  PauseIcon,
  PipIcon,
  PlayIcon,
  ReplayIcon,
  SeekArrowIcon,
  SettingsIcon,
  VolumeDownIcon,
  VolumeOffIcon,
  VolumeUpIcon,
} from './components/player-icons'
import {
  SC_VideoContainer,
  SC_VideoWrapper,
  SC_VideoElement,
  SC_VideoThumbnailBackdrop,
  SC_VideoThumbnail,
  SC_VideoSkeleton,
  SC_VideoError,
  SC_VideoTorBody,
  SC_VideoTorActions,
  SC_VideoRetryButton,
  SC_Spinner,
  SC_BigPlayButton,
  SC_Bezel,
  SC_TopPill,
  SC_SeekRipple,
  SC_SeekArrows,
  SC_TouchScrim,
  SC_TouchLayer,
  SC_TouchCenterButton,
  SC_TouchTopBar,
  SC_TouchBottomBar,
  SC_TouchButton,
  SC_GradientBottom,
  SC_ControlsRow,
  SC_ControlsGroup,
  SC_PlayerButton,
  SC_TimeDisplay,
  SC_ChapterTitle,
  SC_VolumeArea,
  SC_VolumePanel,
  SC_VolumeHit,
  SC_VolumeTrack,
  SC_VolumeFill,
  SC_VolumeKnob,
  SC_HotkeysHelpOverlay,
  SC_HotkeysHelpContent,
  SC_HotkeysHelpTitle,
  SC_HotkeysHelpList,
  SC_HotkeysHelpItem,
  SC_HotkeysKey,
  SC_HotkeysDescription,
  SC_HotkeysCloseButton,
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

const BEZEL_ICONS: Record<BezelIcon, Component> = {
  play: PlayIcon,
  pause: PauseIcon,
  volumeUp: VolumeUpIcon,
  volumeDown: VolumeDownIcon,
  volumeOff: VolumeOffIcon,
}

// «Пульс» в центре и волна перемотки у края.
const {
  bezel,
  seek: keyboardSeek,
  flashBezel,
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
  syncTime,
  stopProgressAnimation,
  startProgressAnimation,
  handleProgressPointerDown,
  formatTime,
} = useVideoProgress(videoElement, isPlaying)

const {
  volume,
  isDraggingVolume,
  showVolumeNotification,
  volumeWidth,
  setVolume,
  displayVolumeNotification,
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
  isAutoQuality,
  currentMenuScreen,
  initPlayer: hlsInitPlayer,
  retry,
  setQualityLevel,
  openQualityMenu,
  openSpeedMenu,
  goBackToMainMenu,
  toggleQualityMenu,
  closeQualityMenu,
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
const containerElement = (): HTMLElement | null => resolveDomElement(videoContainer)

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
  syncTime,
})
setupVideoEventListeners = videoElementEvents.setupVideoEventListeners
setupIntersectionObserver = videoElementEvents.setupIntersectionObserver

// Продолжение просмотра с последней позиции — по самому ролику, не по посту.
useVideoResume({ videoElement, videoUrl: () => props.videoUrl })

// === Главы (тайм-коды из описания) — в use-video-chapters. ===
const { chapterMarkers, activeChapter } = useVideoChapters(
  () => props.chapters,
  duration,
  currentTime
)
const chapters = computed(() => props.chapters)

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

/** Перемотка на `delta` секунд от текущего места; `false` — перематывать нечего. */
function seekBy(delta: number): boolean {
  const video = getVideoElement()
  if (!video || !isFinite(video.duration) || video.duration <= 0) return false
  applySeek(video.currentTime + delta)
  return true
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

// Tor: плеер грузит HLS/MP4 напрямую с PeerTube — сервер увидит IP. Первый
// запуск под Tor показывает предупреждение, initPlayer идёт только после
// согласия (на этот плеер). Автоплей под Tor тоже упирается в предупреждение.
const { mediaBlocked } = useTorMedia()
const torBypassAccepted = ref(false)
const torNoticeVisible = ref(false)
let torPendingForcePlay = false

function initPlayer(forcePlay = false): ReturnType<typeof hlsInitPlayer> | undefined {
  if (mediaBlocked.value && !torBypassAccepted.value) {
    torPendingForcePlay = forcePlay
    torNoticeVisible.value = true
    return undefined
  }
  return hlsInitPlayer(forcePlay)
}

function acceptTorBypass(): void {
  torBypassAccepted.value = true
  torNoticeVisible.value = false
  void hlsInitPlayer(torPendingForcePlay)
}

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
      // Иконку — сразу по нажатию: play() ждёт, пока ролик реально тронется.
      if (showNotification) triggerPlayPauseNotification(true)
      video
        .play()
        .then(() => {
          isPlaying.value = true
          videoPlayerManager.pauseAllExcept(playerId.value)
        })
        .catch((err) => {
          // AbortError — паузу нажали раньше, чем ролик успел пойти: это не сбой.
          if (err instanceof DOMException && err.name === 'AbortError') return
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

// === Телефон: касания, как в приложении YouTube ===

const touchUi = useTouchUi()

/** Удержание пальца — 2×, отпустили — прежняя скорость. Меню скорости не трогаем. */
let rateBeforeHold: number | null = null
function setHoldSpeed(held: boolean): void {
  const video = getVideoElement()
  if (!video) return
  if (held) {
    rateBeforeHold = video.playbackRate
    video.playbackRate = 2
  } else if (rateBeforeHold !== null) {
    video.playbackRate = rateBeforeHold
    rateBeforeHold = null
  }
}

const touch = useTouchControls({
  isPlaying,
  isFullscreen,
  isActive: () => touchUi.value && isInitialized.value && !isLoading.value && !error.value,
  seekBy,
  exitFullscreen: () => {
    if (isFullscreen.value) void toggleFullscreen()
  },
  setHoldSpeed,
})

/** Удержание пальца: плашка «2x ▸▸». */
const touchHolding = touch.holding

const touchChromeVisible = computed<boolean>(
  () => touch.controlsVisible.value || isQualityMenuOpen.value
)

function handleTouchPlay(): void {
  togglePlay()
  touch.poke()
}

function handleTouchFullscreen(): void {
  void toggleFullscreen()
  touch.poke()
}

// === Компьютер: панель как у YouTube ===

// Панель видна, пока мышь двигается над роликом, пока он на паузе, пока открыто
// меню или тянут громкость; спряталась, пока ролик идёт, — прячется и курсор.
const desktopChromeVisible = computed<boolean>(
  () =>
    showControls.value ||
    showControlsInitially.value ||
    !isPlaying.value ||
    isQualityMenuOpen.value ||
    isDraggingVolume.value
)

const shouldHideCursor = computed<boolean>(
  () => !touchUi.value && isInitialized.value && isHovering.value && !desktopChromeVisible.value
)

const playTip = computed<string>(() => {
  if (isEnded.value) return t('videoPlayer.replay')
  return `${isPlaying.value ? t('videoPlayer.pause') : t('videoPlayer.play')} (k)`
})
const muteTip = computed<string>(
  () => `${volume.value === 0 ? t('videoPlayer.unmute') : t('videoPlayer.mute')} (m)`
)
const fullscreenTip = computed<string>(
  () => `${isFullscreen.value ? t('videoPlayer.exitFullscreen') : t('videoPlayer.fullscreen')} (f)`
)

const showSpinner = computed<boolean>(
  () =>
    !error.value &&
    (isLoading.value || (isBuffering.value && isInitialized.value && isPlaying.value))
)

/** Плашка сверху: 2× при удержании, громкость, скорость. */
const pillText = computed<string>(() => {
  if (touchHolding.value) return '2x'
  if (showVolumeNotification.value) return formatVolumeDisplay()
  if (showPlaybackRateNotification.value) return formatPlaybackRate(playbackRate.value)
  return ''
})

// Громкость клавишами — «пульс» со значком звука, как у YouTube.
watch(showVolumeNotification, (shown) => {
  if (!shown) return
  flashBezel(volume.value === 0 ? 'volumeOff' : volume.value < 0.5 ? 'volumeDown' : 'volumeUp')
})

/** Волна перемотки: касания на телефоне, стрелки и J/L на компьютере. */
const seekIndicator = computed(() => {
  if (touch.ripple.side) return { side: touch.ripple.side, seconds: touch.ripple.seconds }
  if (keyboardSeek.side) return { side: keyboardSeek.side, seconds: keyboardSeek.seconds }
  return null
})

// === Мышь и касания по самому ролику ===

// Плеером пользуются мышью или пальцем. Тогда фокус без обводки: после клика
// по ролику любая клавиша включала :focus-visible, и пробел рисовал рамку
// вокруг плеера. И кнопки плеера, оказавшиеся в фокусе от клика, не забирают
// пробел себе. С Tab обводка и обычные кнопки возвращаются.
const pointerMode = ref(false)
let lastPointerType = ''
/** Последнее нажатие началось на элементе управления: полосе перемотки, панели, меню. */
let pressOnControl = false

function handlePointerDownCapture(event: PointerEvent): void {
  pointerMode.value = true
  lastPointerType = event.pointerType
  pressOnControl = !!(event.target as Element | null)?.closest(CONTROL_SELECTOR)
}

// Мышь: клик — пуск и пауза с «пульсом», двойной — весь экран.
const handleMouseClick = createClickHandler(
  () => togglePlay(true),
  toggleFullscreen,
  DOUBLE_CLICK_DELAY
)

function handleContainerClick(event: MouseEvent): void {
  // Щелчок по полосе перемотки или другому элементу управления — их, а не
  // «пауза/пуск». Полоса щелчок не гасит, а если её тянули и отпустили над
  // роликом, щелчок приходит самому плееру: поэтому смотрим, где началось
  // нажатие. Раньше перемотка мышью заодно ставила ролик на паузу или пускала.
  if (pressOnControl || (event.target as Element | null)?.closest(CONTROL_SELECTOR)) return
  // До первого запуска и клик, и касание запускают ролик — как по превью у YouTube.
  if (!isInitialized.value) {
    if (!isLoading.value && !error.value && !torNoticeVisible.value) togglePlay()
    return
  }
  // Касания разбирает use-touch-controls; щелчок за ними — эхо того же касания.
  if (touchUi.value && lastPointerType === 'touch') return
  // Меню открыто — щелчок по ролику только закрывает его, как у YouTube.
  if (isQualityMenuOpen.value) {
    closeQualityMenu()
    return
  }
  handleMouseClick()
}

/** Удержание пальца — ускорение, а не меню «Сохранить видео». */
function handleContextMenu(event: MouseEvent): void {
  if (touchUi.value) event.preventDefault()
}

function handleSeekStart(event: PointerEvent): void {
  handleProgressPointerDown(event)
  if (touchUi.value) {
    touch.showControls()
    window.addEventListener('pointerup', () => touch.poke(), { once: true })
  }
}

function handleMenuScreen(screen: 'main' | 'quality' | 'speed'): void {
  if (screen === 'quality') openQualityMenu()
  else if (screen === 'speed') openSpeedMenu()
  else goBackToMainMenu()
}

/** Скорость выбрана — меню закрывается, как у YouTube. */
function handleSelectRate(rate: number): void {
  setPlaybackRate(rate)
  closeQualityMenu()
}

// Телефон во весь экран — горизонтально, если ролик горизонтальный, как у YouTube.
watch(isFullscreen, (fullscreen) => {
  if (!touchUi.value) return
  const orientation = window.screen.orientation as typeof window.screen.orientation & {
    lock?: (orientation: string) => Promise<void>
  }
  if (!orientation) return
  if (fullscreen) {
    const video = getVideoElement()
    if (video && video.videoWidth > video.videoHeight) {
      orientation.lock?.('landscape').catch(() => {})
    }
  } else {
    try {
      orientation.unlock?.()
    } catch {
      // Ориентацию не блокировали — снимать нечего.
    }
  }
})

// Горячие клавиши: слушает их и выбирает плеер videoPlayerManager, здесь —
// что они делают с этим плеером.
const { showHotkeysHelp, toggleHotkeysHelp, handleHotkey } = useVideoHotkeys({
  videoElement,
  isInitialized,
  isLoading,
  isFullscreen,
  isUnavailable: () => !!error.value || torNoticeVisible.value,
  volume,
  togglePlay,
  toggleFullscreen,
  toggleMute,
  setVolume,
  displayVolumeNotification,
  increasePlaybackRate,
  decreasePlaybackRate,
  triggerSeekNotification,
  togglePip: !props.isAudio && isPipSupported ? togglePip : undefined,
  isMenuOpen: () => isQualityMenuOpen.value,
  closeMenu: closeQualityMenu,
})
const hotkeysList = HOTKEYS_LIST

function handleFocusOut(event: FocusEvent): void {
  // Окно ушло в фон — фокус вернётся сюда же.
  if (!document.hasFocus()) return
  const next = event.relatedTarget
  if (next instanceof Node && resolveDomElement(videoContainer)?.contains(next)) return
  pointerMode.value = false
}

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
    element: () => resolveDomElement(videoContainer),
    isStarted: () => isInitialized.value,
    isHovered: () => isHovering.value,
    isFullscreen: () => isFullscreen.value,
    isPointerMode: () => pointerMode.value,
    handleHotkey,
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
    touch.reset()

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
