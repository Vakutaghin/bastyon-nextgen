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
      />
    </SC_VideoWrapper>

    <!-- Индикатор загрузки (при инициализации) -->
    <SC_VideoLoading v-if="isLoading && !error">
      <LoadingOutlined :style="{ fontSize: '48px', color: 'rgba(255, 255, 255, 0.8)' }" spin />
    </SC_VideoLoading>

    <!-- Индикатор загрузки чанков (во время воспроизведения) -->
    <SC_VideoLoading v-if="isBuffering && isInitialized && !error && isPlaying">
      <LoadingOutlined :style="{ fontSize: '48px', color: 'rgba(255, 255, 255, 0.8)' }" spin />
    </SC_VideoLoading>

    <!-- Сообщение об ошибке -->
    <SC_VideoError v-if="error">
      <p>{{ error }}</p>
    </SC_VideoError>

    <!-- Кнопка Play для неинициализированного проигрывателя -->
    <SC_VideoPlayButton
      v-if="!isInitialized && !isLoading && !error"
      @click.stop="togglePlay"
    >
      <PlayCircleOutlined :style="{ fontSize: '64px', color: '#ffffff' }" />
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
    <SC_SeekNotification
      v-if="showSeekNotification && isInitialized"
      :show="showSeekNotification"
    >
      {{ seekValue }}
    </SC_SeekNotification>

    <!-- Иконка Play -->
    <SC_SeekNotification
      v-if="showPlayNotification && isInitialized"
      :show="showPlayNotification"
    >
      <PlayCircleOutlined :style="{ fontSize: '24px', color: '#eee' }" />
    </SC_SeekNotification>

    <!-- Иконка Pause -->
    <SC_SeekNotification
      v-if="showPauseNotification && isInitialized"
      :show="showPauseNotification"
    >
      <PauseCircleOutlined :style="{ fontSize: '24px', color: '#eee' }" />
    </SC_SeekNotification>

    <!-- Справка по горячим клавишам -->
    <SC_HotkeysHelpOverlay v-if="showHotkeysHelp" @click.stop="toggleHotkeysHelp">
      <SC_HotkeysHelpContent @click.stop>
        <SC_HotkeysCloseButton @click.stop="toggleHotkeysHelp">
          <CloseOutlined :style="{ fontSize: '20px' }" />
        </SC_HotkeysCloseButton>

        <SC_HotkeysHelpTitle>Горячие клавиши</SC_HotkeysHelpTitle>

        <SC_HotkeysHelpList>
          <SC_HotkeysHelpItem v-for="item in hotkeysList" :key="item.key">
            <SC_HotkeysKey>{{ item.key }}</SC_HotkeysKey>
            <SC_HotkeysDescription>{{ item.description }}</SC_HotkeysDescription>
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
        <SC_VideoPlayPauseButton
          @click.stop="togglePlay"
        >
          <ReloadOutlined v-if="isEnded" :style="{ fontSize: '20px' }" />
          <PlayCircleOutlined v-else-if="!isPlaying" :style="{ fontSize: '20px' }" />
          <PauseCircleOutlined v-else :style="{ fontSize: '20px' }" />
        </SC_VideoPlayPauseButton>

        <!-- Контрол громкости -->
        <SC_VideoVolumeControl>
          <SC_VideoVolumeButton
            @click.stop="toggleMute"
          >
            <SC_VideoVolumeMutedIcon v-if="volume === 0">
              <SoundOutlined
                :style="{
                  fontSize: '18px',
                  color: '#999',
                  position: 'relative',
                  zIndex: 0
                }"
              />
              <SC_VideoVolumeMutedCross />
            </SC_VideoVolumeMutedIcon>
            <SoundOutlined
              v-else
              :style="{
                fontSize: '18px'
              }"
            />
          </SC_VideoVolumeButton>
          <SC_VideoVolumeSlider
            ref="volumeSliderRef"
            @mousedown.stop="handleVolumeMouseDown"
            @click.stop="handleVolumeClick"
          >
            <SC_VideoVolumeFill
              :isDragging="isDraggingVolume"
              :style="{ width: volumeWidth }"
            />
          </SC_VideoVolumeSlider>
        </SC_VideoVolumeControl>

        <!-- Контрол качества видео и скорости -->
        <SC_VideoQualityControl
          ref="qualityControlRef"
        >
          <SC_VideoQualityButton
            @click.stop="toggleQualityMenu"
          >
            <SettingOutlined :style="{ fontSize: '18px' }" />
          </SC_VideoQualityButton>
          <SC_VideoQualityDropdown
            ref="qualityDropdownRef"
            :isOpen="isQualityMenuOpen"
            @click.stop
          >
            <!-- Главное меню -->
            <template v-if="currentMenuScreen === 'main'">
              <!-- Пункт меню: Качество видео -->
              <SC_VideoQualityMenuSection v-if="!isAudio && availableQualityLevels.length > 0">
                <SC_VideoQualitySubmenuItem
                  @click.stop="openQualityMenu"
                >
                  <span>Качество</span>
                  <span style="font-size: 10px; color: #999; margin-left: 8px;">▶</span>
                </SC_VideoQualitySubmenuItem>
              </SC_VideoQualityMenuSection>

              <!-- Пункт меню: Скорость воспроизведения -->
              <SC_VideoQualityMenuSection>
                <SC_VideoQualitySubmenuItem
                  @click.stop="openSpeedMenu"
                >
                  <span>Скорость</span>
                  <span style="font-size: 10px; color: #999; margin-left: 8px;">▶</span>
                </SC_VideoQualitySubmenuItem>
              </SC_VideoQualityMenuSection>
            </template>

            <!-- Меню качества -->
            <template v-if="currentMenuScreen === 'quality'">
              <SC_VideoQualityMenuSection>
                <SC_VideoQualitySubmenuItem
                  @click.stop="goBackToMainMenu"
                >
                  <span>← Назад</span>
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
                <SC_VideoQualitySubmenuItem
                  @click.stop="goBackToMainMenu"
                >
                  <span>← Назад</span>
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

        <!-- Прогресс-бар -->
        <SC_VideoProgressBar
          @click.stop="handleProgressClick"
        >
          <SC_VideoBufferFill
            :style="{ width: bufferedWidth }"
          />
          <SC_VideoProgressFill
            :style="{ width: progressWidth }"
          />
        </SC_VideoProgressBar>

        <!-- Время -->
        <SC_VideoTimeDisplay>
          {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
        </SC_VideoTimeDisplay>

        <!-- Кнопка полноэкранного режима -->
        <SC_VideoFullscreenButton
          v-if="!isAudio"
          @click.stop="toggleFullscreen"
        >
          <FullscreenExitOutlined v-if="isFullscreen" :style="{ fontSize: '20px' }" />
          <FullscreenOutlined v-else :style="{ fontSize: '20px' }" />
        </SC_VideoFullscreenButton>
      </SC_VideoControlsBar>
    </SC_VideoControls>
  </SC_VideoContainer>
</template>

<script>
import { videoPlayer } from './video-player.ts'

export default videoPlayer
</script>
